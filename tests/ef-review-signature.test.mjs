// tests/ef-review-signature.test.mjs — P2-T5 (Evidence Foundry E1 Phase 2, FR-10/OQ-2/OQ-6).
//
// Covers this task's own acceptance criteria
// (docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md, row P2-T5):
//   - The record signature object: detached Ed25519 (`node:crypto` only) over the canonicalized
//     record bytes MINUS the signature object, binding `reviewerId` to `subjectContentHash` (and
//     every other field) by construction.
//   - E1 signing exists ONLY in synthetic dry-run mode: an ephemeral in-memory keypair generated
//     per invocation, NEVER written to disk, no `--test-keys` flag anywhere in this tool, `keyId`
//     forced to the `TESTKEY-` prefix, writable only onto `synthetic:true` records.
//   - `validate` verifies present signatures and fails closed on tamper.
//
// Structural validity proven here never implies clinical validity, safety, or that a named human
// clinician reviewed anything — see schemas/review-record.schema.json's own top-level description
// for that standing caveat.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ED25519_ALGORITHM,
  TESTKEY_PREFIX,
  signingPreimageBytes,
  signRecordDryRun,
  verifyRecordSignature,
} from '../tools/review-record/lib/signature.mjs';
import { serializeReviewRecordYaml, writeNewReviewRecordFile } from '../tools/review-record/lib/store.mjs';
import { run as runValidate } from '../tools/review-record/lib/verbs/validate.mjs';
import { UsageError, ValidationFailedError, EXIT_OK, EXIT_USAGE } from '../tools/review-record/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(REPO_ROOT, 'tools', 'review-record', 'cli.mjs');
const SIGNATURE_SRC_PATH = path.join(REPO_ROOT, 'tools', 'review-record', 'lib', 'signature.mjs');

const SUBJECT_HASH = 'sha256:537d2dcf29f8e2871a4b91129ec3da3d0012d48ee90af0784ea8c93db7398c6d';

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' });
  assert.equal(result.error, undefined, `spawnSync itself failed: ${result.error}`);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A fully-shaped, unsigned synthetic draft record (the exact shape `lib/verbs/scaffold.mjs`'s
 * `buildDraftRecord` produces before P2-T5 signing composes on top of it). */
function draftRecord(overrides = {}) {
  return {
    schemaVersion: 1,
    review_id: 'rr-0001-clinical-1',
    role: 'clinical-1',
    moduleId: 'signature_target_v1',
    subjectContentHash: SUBJECT_HASH,
    previousRecordHash: null,
    supersedes: null,
    reviewerId: 'synthetic-signature-reviewer',
    decision: 'approve',
    rationale: 'P2-T5 signature-module fixture record -- not a real clinical review act.',
    reviewedAt: '2026-02-05T00:00:00Z',
    synthetic: true,
    signature: null,
    ...overrides,
  };
}

// -------------------------------------------------------------------------------------------
// signRecordDryRun — happy path
// -------------------------------------------------------------------------------------------

test('signRecordDryRun produces a signature that verifyRecordSignature accepts', () => {
  const signed = signRecordDryRun(draftRecord());
  assert.equal(signed.signature.algorithm, ED25519_ALGORITHM);
  assert.match(signed.signature.keyId, /^TESTKEY-/);
  assert.equal(typeof signed.signature.value, 'string');
  assert.ok(signed.signature.value.length > 0);
  assert.deepEqual(verifyRecordSignature(signed), { ok: true, reason: null });
});

test('signRecordDryRun does not mutate its input record', () => {
  const draft = draftRecord();
  const before = JSON.stringify(draft);
  signRecordDryRun(draft);
  assert.equal(JSON.stringify(draft), before);
});

test('signRecordDryRun preserves every non-signature field verbatim', () => {
  const draft = draftRecord({ rationale: 'A distinctive rationale for field-preservation proof.' });
  const signed = signRecordDryRun(draft);
  for (const key of Object.keys(draft)) {
    if (key === 'signature') continue;
    assert.deepEqual(signed[key], draft[key], `field "${key}" must be preserved verbatim`);
  }
});

test('signRecordDryRun generates a FRESH keypair every call -- two signings of the identical record produce different keyId/value', () => {
  const draft = draftRecord();
  const first = signRecordDryRun(draft);
  const second = signRecordDryRun(draft);
  assert.notEqual(first.signature.keyId, second.signature.keyId, 'ephemeral keys must differ call to call');
  assert.notEqual(first.signature.value, second.signature.value);
  // Both are independently valid -- neither is a stale/cached signature.
  assert.equal(verifyRecordSignature(first).ok, true);
  assert.equal(verifyRecordSignature(second).ok, true);
});

// -------------------------------------------------------------------------------------------
// signRecordDryRun — "writable only onto synthetic:true records" (OQ-6), enforced structurally
// -------------------------------------------------------------------------------------------

test('signRecordDryRun refuses to sign a synthetic:false record', () => {
  assert.throws(() => signRecordDryRun(draftRecord({ synthetic: false })), UsageError);
});

test('signRecordDryRun refuses to sign a record whose synthetic flag is missing/non-boolean', () => {
  assert.throws(() => signRecordDryRun(draftRecord({ synthetic: undefined })), UsageError);
  assert.throws(() => signRecordDryRun(draftRecord({ synthetic: 'true' })), UsageError);
});

test('signRecordDryRun refuses to re-sign an already-signed record', () => {
  const signed = signRecordDryRun(draftRecord());
  assert.throws(() => signRecordDryRun(signed), UsageError);
});

test('signRecordDryRun and signingPreimageBytes reject non-object input', () => {
  assert.throws(() => signRecordDryRun(null), UsageError);
  assert.throws(() => signRecordDryRun('not an object'), UsageError);
  assert.throws(() => signRecordDryRun([1, 2, 3]), UsageError);
  assert.throws(() => signingPreimageBytes(null), UsageError);
});

// -------------------------------------------------------------------------------------------
// signingPreimageBytes — "canonicalized record bytes minus the signature object"
// -------------------------------------------------------------------------------------------

test('signingPreimageBytes excludes the signature field entirely (not merely nulled)', () => {
  const withoutSig = draftRecord();
  delete withoutSig.signature;
  const withNullSig = draftRecord({ signature: null });
  const withStubSig = draftRecord({ signature: { algorithm: 'ed25519', keyId: 'TESTKEY-x', value: 'eA==' } });
  const a = signingPreimageBytes(withoutSig);
  const b = signingPreimageBytes(withNullSig);
  const c = signingPreimageBytes(withStubSig);
  assert.equal(a.toString('utf8'), b.toString('utf8'));
  assert.equal(b.toString('utf8'), c.toString('utf8'), 'the preimage must not depend on the signature value');
});

test('signingPreimageBytes changes when ANY other field changes', () => {
  const base = signingPreimageBytes(draftRecord());
  for (const [key, value] of Object.entries({
    reviewerId: 'someone-else',
    decision: 'reject',
    rationale: 'a different rationale entirely',
    subjectContentHash: `sha256:${'0'.repeat(64)}`,
    moduleId: 'a_different_module_v1',
    review_id: 'rr-0002-clinical-1',
    reviewedAt: '2026-03-01T00:00:00Z',
    previousRecordHash: `sha256:${'1'.repeat(64)}`,
  })) {
    const mutated = signingPreimageBytes(draftRecord({ [key]: value }));
    assert.notEqual(mutated.toString('utf8'), base.toString('utf8'), `mutating "${key}" must change the preimage`);
  }
});

// -------------------------------------------------------------------------------------------
// verifyRecordSignature — structured, never-throwing verification contract
// -------------------------------------------------------------------------------------------

test('verifyRecordSignature accepts a synthetic:false record with signature:null (forced-empty ceiling, nothing to verify)', () => {
  const result = verifyRecordSignature(draftRecord({ synthetic: false, signature: null }));
  assert.deepEqual(result, { ok: true, reason: null });
});

test('verifyRecordSignature rejects a synthetic:true record with signature:null', () => {
  const result = verifyRecordSignature(draftRecord({ synthetic: true, signature: null }));
  assert.equal(result.ok, false);
  assert.match(result.reason, /carries no signature/);
});

test('verifyRecordSignature rejects a POPULATED signature on a synthetic:false record, independent of cryptographic validity', () => {
  const signed = signRecordDryRun(draftRecord()); // valid signature, but over a synthetic:true record
  const relabeled = { ...signed, synthetic: false };
  const result = verifyRecordSignature(relabeled);
  assert.equal(result.ok, false);
  assert.match(result.reason, /can never be valid in E1/);
});

test('verifyRecordSignature rejects an unsupported algorithm', () => {
  const signed = signRecordDryRun(draftRecord());
  const tampered = { ...signed, signature: { ...signed.signature, algorithm: 'rsa' } };
  const result = verifyRecordSignature(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /unsupported signature\.algorithm/);
});

test('verifyRecordSignature rejects a keyId missing the TESTKEY- prefix', () => {
  const signed = signRecordDryRun(draftRecord());
  const tampered = {
    ...signed,
    signature: { ...signed.signature, keyId: signed.signature.keyId.replace(TESTKEY_PREFIX, '') },
  };
  const result = verifyRecordSignature(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /does not carry the required "TESTKEY-" prefix/);
});

test('verifyRecordSignature rejects an empty signature.value', () => {
  const signed = signRecordDryRun(draftRecord());
  const tampered = { ...signed, signature: { ...signed.signature, value: '' } };
  const result = verifyRecordSignature(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /non-empty string/);
});

test('verifyRecordSignature rejects a keyId whose embedded public-key material does not parse', () => {
  const signed = signRecordDryRun(draftRecord());
  const tampered = { ...signed, signature: { ...signed.signature, keyId: `${TESTKEY_PREFIX}not-valid-base64url-jwk-x!!` } };
  const result = verifyRecordSignature(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /could not be parsed as an Ed25519 JWK x-coordinate/);
});

test('verifyRecordSignature rejects null/non-object records without throwing', () => {
  assert.equal(verifyRecordSignature(null).ok, false);
  assert.equal(verifyRecordSignature('not an object').ok, false);
  assert.equal(verifyRecordSignature([1, 2, 3]).ok, false);
});

// -------------------------------------------------------------------------------------------
// TAMPER DETECTION — the core FR-10/OQ-2 requirement: validate fails closed on tamper
// -------------------------------------------------------------------------------------------

test('verifyRecordSignature detects tamper in EVERY field, not just rationale', () => {
  const signed = signRecordDryRun(draftRecord());
  for (const [key, value] of Object.entries({
    reviewerId: 'a-different-reviewer',
    decision: 'reject',
    rationale: 'a tampered rationale',
    subjectContentHash: `sha256:${'0'.repeat(64)}`,
    moduleId: 'a_different_module_v1',
    review_id: 'rr-0002-clinical-1',
    reviewedAt: '2026-03-01T00:00:00Z',
    // `synthetic` is deliberately NOT swept here: draftRecord() is already synthetic:true, so the
    // only "tamper" available for a boolean field already at its sole legal value would be a no-op
    // (true -> true) or synthetic:false, which `verifyRecordSignature` rejects for an UNRELATED,
    // non-cryptographic reason (a populated signature is never legal on a synthetic:false record --
    // see the dedicated "rejects a POPULATED signature on a synthetic:false record" test above) --
    // sweeping it here would conflate two different rejection reasons.
  })) {
    const tampered = { ...signed, [key]: value };
    const result = verifyRecordSignature(tampered);
    assert.equal(result.ok, false, `tampering "${key}" must be detected`);
    assert.match(result.reason, /tamper finding/);
  }
});

test('verifyRecordSignature detects a single flipped byte anywhere in signature.value', () => {
  const signed = signRecordDryRun(draftRecord());
  const bytes = Buffer.from(signed.signature.value, 'base64');
  bytes[0] ^= 0x01; // flip one bit of the first byte
  const tampered = { ...signed, signature: { ...signed.signature, value: bytes.toString('base64') } };
  const result = verifyRecordSignature(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /tamper finding/);
});

test('a valid signature from a DIFFERENT record does not verify against this one (cross-record signature reuse fails)', () => {
  const signedA = signRecordDryRun(draftRecord({ review_id: 'rr-0001-clinical-1' }));
  const signedB = signRecordDryRun(draftRecord({ review_id: 'rr-0002-lab', role: 'lab' }));
  const swapped = { ...signedB, signature: signedA.signature };
  const result = verifyRecordSignature(swapped);
  assert.equal(result.ok, false);
  assert.match(result.reason, /tamper finding/);
});

// -------------------------------------------------------------------------------------------
// OQ-6 — ephemeral, in-memory-only keys: structural + dynamic proof
// -------------------------------------------------------------------------------------------

test('lib/signature.mjs never imports node:fs or node:fs/promises (structural: never persists key material)', async () => {
  const source = await readFile(SIGNATURE_SRC_PATH, 'utf8');
  const code = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /from ['"]node:fs/);
  assert.doesNotMatch(code, /require\(['"]node:fs/);
});

test('no --test-keys flag exists anywhere in tools/review-record/ (OQ-6: no persistent-test-key CLI surface)', async () => {
  const cliSource = await readFile(path.join(REPO_ROOT, 'tools', 'review-record', 'cli.mjs'), 'utf8');
  assert.doesNotMatch(cliSource.replace(/^\s*\/\/.*$/gm, ''), /--test-keys/);
  const signatureSource = await readFile(SIGNATURE_SRC_PATH, 'utf8');
  const signatureCode = signatureSource.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(signatureCode, /--test-keys/);
});

test('signRecordDryRun\'s returned record carries no private-key-shaped field anywhere', () => {
  const signed = signRecordDryRun(draftRecord());
  const flat = JSON.stringify(signed).toLowerCase();
  assert.doesNotMatch(flat, /privatekey/);
  assert.doesNotMatch(flat, /-----begin/); // no embedded PEM material of any kind
});

test('signing and verifying make zero network calls at runtime (patched global fetch throws if invoked)', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network call attempted during review-record signing/verification');
  };
  try {
    const signed = signRecordDryRun(draftRecord());
    assert.equal(verifyRecordSignature(signed).ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// -------------------------------------------------------------------------------------------
// Integration: validate over a committed fixture tree — happy path + seeded tamper (FR-10/OQ-2:
// "validate verifies present signatures and fails closed on tamper").
// -------------------------------------------------------------------------------------------

const FIXTURE_ROSTER_YAML = `schemaVersion: 1
reviewers:
  - reviewerId: "synthetic-signature-reviewer"
    name: "SYNTHETIC -- NOT A CREDENTIALED REVIEWER (P2-T5 signature-module fixture persona)"
    credentialRef: "fixture-placeholder-credential-signature"
    moduleScopes:
      - signature_target_v1
    synthetic: true
`;

async function mkTmpDir(prefix) {
  return mkdtemp(path.join(tmpdir(), prefix));
}

async function buildSignedFixtureTree() {
  const dir = await mkTmpDir('ef-review-signature-');
  await mkdir(path.join(dir, 'governance'), { recursive: true });
  await writeFile(path.join(dir, 'governance', 'reviewer-roster.yaml'), FIXTURE_ROSTER_YAML, 'utf8');
  const signed = signRecordDryRun(draftRecord());
  await writeNewReviewRecordFile(dir, 'signature_target_v1', signed.review_id, signed);
  return dir;
}

test('validate accepts a freshly-signed dry-run record written through the real store write path', async () => {
  const dir = await buildSignedFixtureTree();
  try {
    const code = await runValidate({ module: 'signature_target_v1', root: dir });
    assert.equal(code, EXIT_OK);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('SEEDED MUTATION: a one-byte tamper of a committed, previously-valid signed record fails validate with a signature: -prefixed violation', async () => {
  const dir = await buildSignedFixtureTree();
  try {
    const recordPath = path.join(dir, 'modules', 'signature_target_v1', 'reviews', 'rr-0001-clinical-1.yaml');
    const before = await readFile(recordPath, 'utf8');
    // Mutate the rationale text -- content only, leaving the (now stale) signature block untouched.
    const mutated = before.replace(
      'P2-T5 signature-module fixture record -- not a real clinical review act.',
      'P2-T5 signature-module fixture record -- TAMPERED not a real clinical review act.',
    );
    assert.notEqual(mutated, before);
    await writeFile(recordPath, mutated, 'utf8');

    await assert.rejects(
      () => runValidate({ module: 'signature_target_v1', root: dir }),
      (err) => {
        assert.ok(err instanceof ValidationFailedError);
        assert.ok(
          err.violations.some((v) => v.includes('signature:') && v.includes('tamper finding')),
          `expected a signature tamper violation, got: ${JSON.stringify(err.violations)}`,
        );
        return true;
      },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('cli.mjs validate (subprocess) rejects a tampered signed record with exit 1 and a signature: -prefixed message', async () => {
  const dir = await buildSignedFixtureTree();
  try {
    const recordPath = path.join(dir, 'modules', 'signature_target_v1', 'reviews', 'rr-0001-clinical-1.yaml');
    const before = await readFile(recordPath, 'utf8');
    const mutated = before.replace('approve', 'reject');
    assert.notEqual(mutated, before);
    await writeFile(recordPath, mutated, 'utf8');

    const { status, stderr } = runCli(['validate', '--module', 'signature_target_v1', '--root', dir]);
    assert.equal(status, EXIT_USAGE);
    assert.match(stderr, /ValidationFailedError/);
    assert.match(stderr, /signature:/);
    assert.match(stderr, /tamper finding/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('cli.mjs validate (subprocess) accepts the same freshly-signed fixture tree cleanly', async () => {
  const dir = await buildSignedFixtureTree();
  try {
    const { status, stdout, stderr } = runCli(['validate', '--module', 'signature_target_v1', '--root', dir]);
    assert.equal(status, EXIT_OK, stderr);
    assert.match(stdout, /FR-10 Ed25519 signature verification/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a hand-tampered keyId (public-key substitution) is rejected -- swapping in a DIFFERENT valid TESTKEY- public key does not verify', async () => {
  const dir = await buildSignedFixtureTree();
  try {
    const otherKeypairRecord = signRecordDryRun(draftRecord({ review_id: 'rr-0002-lab', role: 'lab', moduleId: 'signature_target_v1' }));
    const recordPath = path.join(dir, 'modules', 'signature_target_v1', 'reviews', 'rr-0001-clinical-1.yaml');
    const before = await readFile(recordPath, 'utf8');
    const mutated = before.replace(/keyId: TESTKEY-[^\n]+/, `keyId: ${otherKeypairRecord.signature.keyId}`);
    assert.notEqual(mutated, before);
    await writeFile(recordPath, mutated, 'utf8');

    await assert.rejects(
      () => runValidate({ module: 'signature_target_v1', root: dir }),
      (err) => {
        assert.ok(err instanceof ValidationFailedError);
        assert.ok(err.violations.some((v) => v.includes('signature:') && v.includes('tamper finding')));
        return true;
      },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('serializeReviewRecordYaml -> parseYamlDocument round-trip of a signed record preserves signature verifiability', async () => {
  const signed = signRecordDryRun(draftRecord());
  const yaml = serializeReviewRecordYaml(signed);
  const { parseYamlDocument } = await import('../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs');
  const roundTripped = parseYamlDocument(yaml);
  assert.deepEqual(roundTripped, signed);
  assert.deepEqual(verifyRecordSignature(roundTripped), { ok: true, reason: null });
});
