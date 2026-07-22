// tests/ef-release-sign-verify.test.mjs — evidence-foundry-e1 Phase 3 signed-release machinery.
//
// P3-T2: Ed25519 `sign` verb, human-offline design, dry-run only in E1 (OQ-6), FR-12/FR-15
// (ruling R3). P3-T3 extends this SAME file with `verify`'s own fail-closed 5-class exit-code
// taxonomy tests (FR-13) — verify signs candidates with this file's own dry-run helper before
// checking them, per this file's original P3-T2-era forward note.
//
// P3-T2 acceptance criteria exercised below:
//   1. `--dry-run` signing produces a structurally valid, cryptographically correct detached
//      Ed25519 signature over the exact P3-T1 manifest digest (never a re-derived digest).
//   2. The dry-run `signature.keyId` ALWAYS carries the `TESTKEY-` prefix — forced, not merely
//      validated (a caller cannot opt out).
//   3. The private key never touches disk, and two dry-run signs of the same candidate produce two
//      independent signatures (proves a fresh ephemeral keypair per call, never reused/cached).
//   4. Real (non-dry-run) signing is fully guarded: missing --key, missing --key-id, a --key-id
//      carrying TESTKEY-, a --key path inside the repo, and --dry-run combined with --key are ALL
//      rejected fail-closed with UsageError — and NONE of these tests ever completes a real
//      signature (no automated check invokes sign outside dry-run, this file included).
//   5. A dry-run-signed candidate's `manifest` field validates cleanly against
//      schemas/release-manifest.schema.json; the structural shape a real (non-dry-run) sign would
//      produce does NOT validate — proving this tool cannot bypass or weaken the P1-T5
//      schema-forced-empty signature slot on a real candidate, by construction.
//   6. No key-generation verb exists in this CLI at all (`--help` lists exactly the 4 documented
//      verbs) — "no key-generation verb writes anything to the tree" holds trivially.
//
// P3-T3 acceptance criteria exercised in the "verify" section below (FR-13):
//   7. `verify --candidate <candidate.json> --registry <registry.json>` succeeds (exit 0) on a
//      genuinely valid dry-run candidate registered consistently — proving the happy path works
//      end-to-end, not just the 5 failure paths.
//   8. Each of the 5 documented failure classes — (1) byte drift, (2) digest mismatch,
//      (3) unknown keyId, (4) registry inconsistency, (5) TESTKEY- on a non-dry-run candidate —
//      is independently reachable via its own seeded tamper fixture, fails closed with the
//      DISTINCT documented exit code, and produces ZERO stdout output (no partial output).
//   9. `verify` never imports a signing primitive from `node:crypto` — structurally it can only
//      ever check a signature, never produce one (ruling R3: CI/agents can verify but never sign).

import test from 'node:test';
import assert from 'node:assert/strict';
import { verify as cryptoVerify, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runManifest } from '../tools/release-sign/lib/manifest.mjs';
import { run as runSign, signEd25519, forceTestKeyId, TESTKEY_PREFIX } from '../tools/release-sign/lib/sign.mjs';
import { run as runVerify } from '../tools/release-sign/lib/verify.mjs';
import { readCanonicalManifestBytes } from '../tools/release-sign/lib/canonical-bytes.mjs';
import {
  UsageError,
  CandidateByteDriftError,
  DigestMismatchError,
  UnknownKeyIdError,
  RegistryInconsistencyError,
  TestKeyOnRealCandidateError,
  EXIT_OK,
  EXIT_BYTE_DRIFT,
  EXIT_DIGEST_MISMATCH,
  EXIT_UNKNOWN_KEYID,
  EXIT_REGISTRY_INCONSISTENCY,
  EXIT_TESTKEY_ON_REAL,
} from '../tools/release-sign/lib/errors.mjs';
import { main as cliMain } from '../tools/release-sign/cli.mjs';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');
const RELEASE_MANIFEST_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-manifest.schema.json');

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

async function withCapturedStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  let output = '';
  process.stdout.write = (chunk) => {
    output += chunk;
    return true;
  };
  try {
    const result = await fn();
    return { result, output };
  } finally {
    process.stdout.write = original;
  }
}

/** Builds a fresh real kb-pack (via propose, delegated through `manifest`) in a tmpdir. Caller owns cleanup. */
async function buildFreshPack() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-p3t2-'));
  await withCapturedStdout(() =>
    runManifest({
      runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir,
    }),
  );
  return outDir;
}

// =================================================================================================
// AC1/AC2 — dry-run signing: cryptographically correct, digest-faithful, TESTKEY-forced.
// =================================================================================================

test('P3-T2 AC1/AC2: --dry-run sign produces a structurally + cryptographically correct signature over the exact manifest digest, with a forced TESTKEY- keyId', async () => {
  const packDir = await buildFreshPack();
  try {
    const { result: signed } = await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true, keyId: 'ef-release-p3t2-001' }),
    );

    assert.equal(signed.dryRun, true);
    assert.equal(signed.signature.algorithm, 'ed25519');
    assert.equal(signed.signature.keyId, 'TESTKEY-ef-release-p3t2-001');
    assert.match(signed.signature.keyId, /^TESTKEY-/);
    assert.equal(typeof signed.signature.value, 'string');
    assert.ok(signed.signature.value.length > 0);

    // The preimage `sign` reports must equal `manifest`'s own preimage for the same pack — sign
    // never re-derives or diverges from P3-T1's canonical digest.
    const { sha256 } = await readCanonicalManifestBytes(packDir);
    assert.equal(signed.preimageSha256, `sha256:${sha256}`);

    // Cryptographic correctness: the embedded signerPublicKey actually verifies the embedded
    // signature over the exact canonical preimage bytes (never a re-serialized copy).
    const { bytes } = await readCanonicalManifestBytes(packDir);
    const publicKeyObj = createPublicKey(signed.signerPublicKey.value);
    const ok = cryptoVerify(
      null, bytes, publicKeyObj, Buffer.from(signed.signature.value, 'base64'),
    );
    assert.equal(ok, true, 'the dry-run signature must cryptographically verify against its own embedded public key over the exact manifest preimage');

    // A signature over a tampered copy of the same bytes must NOT verify (sanity: this is a real
    // signature check, not something that always returns true).
    const tampered = Buffer.from(bytes);
    tampered[0] = tampered[0] === 0x7b ? 0x7c : 0x7b; // flip the leading byte
    const shouldFail = cryptoVerify(
      null, tampered, publicKeyObj, Buffer.from(signed.signature.value, 'base64'),
    );
    assert.equal(shouldFail, false, 'sanity: a tampered preimage must fail cryptographic verification');
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('P3-T2 AC2: a --key-id that already carries TESTKEY- is not double-prefixed', async () => {
  const packDir = await buildFreshPack();
  try {
    const { result: signed } = await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true, keyId: 'TESTKEY-already-prefixed' }),
    );
    assert.equal(signed.signature.keyId, 'TESTKEY-already-prefixed');
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('P3-T2 AC2: an omitted --key-id in dry-run mode still produces a TESTKEY--prefixed keyId', async () => {
  const packDir = await buildFreshPack();
  try {
    const { result: signed } = await withCapturedStdout(() => runSign({ candidate: packDir, dryRun: true }));
    assert.match(signed.signature.keyId, /^TESTKEY-/);
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('P3-T2: forceTestKeyId is a structural force, not a mere validator — every input shape ends up TESTKEY--prefixed', () => {
  assert.equal(forceTestKeyId('abc'), `${TESTKEY_PREFIX}abc`);
  assert.equal(forceTestKeyId('TESTKEY-abc'), 'TESTKEY-abc');
  assert.match(forceTestKeyId(undefined), /^TESTKEY-/);
  assert.match(forceTestKeyId(true), /^TESTKEY-/); // a bare `--key-id` flag parses to boolean true
  assert.match(forceTestKeyId(''), /^TESTKEY-/);
});

// =================================================================================================
// AC3 — private key never touches disk; a fresh ephemeral keypair is generated every call.
// =================================================================================================

test('P3-T2 AC3: two independent --dry-run signs of the SAME candidate produce two DIFFERENT signatures (fresh ephemeral keypair per call, never reused)', async () => {
  const packDir = await buildFreshPack();
  try {
    const { result: first } = await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true, keyId: 'run-a' }),
    );
    const { result: second } = await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true, keyId: 'run-a' }),
    );
    // Same preimage both times (byte-stable — P3-GATE's "dry-run sign->verify byte-stable across
    // 2 runs" criterion, at the digest level)...
    assert.equal(first.preimageSha256, second.preimageSha256);
    // ...but a genuinely fresh keypair each call means the signature bytes and the public key both
    // differ between runs, even with an identical requested keyId label.
    assert.notEqual(first.signature.value, second.signature.value);
    assert.notEqual(first.signerPublicKey.value, second.signerPublicKey.value);
    // Each signature still only verifies against ITS OWN embedded public key.
    const firstPk = createPublicKey(first.signerPublicKey.value);
    const secondPk = createPublicKey(second.signerPublicKey.value);
    const { bytes } = await readCanonicalManifestBytes(packDir);
    assert.equal(cryptoVerify(null, bytes, firstPk, Buffer.from(first.signature.value, 'base64')), true);
    assert.equal(cryptoVerify(null, bytes, secondPk, Buffer.from(second.signature.value, 'base64')), true);
    assert.equal(
      cryptoVerify(null, bytes, firstPk, Buffer.from(second.signature.value, 'base64')), false,
      'the second run\'s signature must not verify against the first run\'s (different, ephemeral) key',
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('P3-T2 AC3: the printed stdout output and returned result of a --dry-run sign never contain PEM private-key material', async () => {
  const packDir = await buildFreshPack();
  try {
    const { result, output } = await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true }),
    );
    const serializedResult = JSON.stringify(result);
    for (const marker of ['PRIVATE KEY', 'BEGIN EC PRIVATE', 'BEGIN RSA PRIVATE']) {
      assert.ok(!output.includes(marker), `stdout must never contain "${marker}"`);
      assert.ok(!serializedResult.includes(marker), `the returned result must never contain "${marker}"`);
    }
    // The PUBLIC key, by contrast, is expected and legitimate.
    assert.match(result.signerPublicKey.value, /BEGIN PUBLIC KEY/);
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('P3-T2: signEd25519 is the single primitive both signing paths use — a hand-rolled cross-check against node:crypto directly agrees', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const data = Buffer.from('evidence-foundry-e1 P3-T2 sanity payload');
  const valueBase64 = signEd25519(data, privateKey);
  const ok = cryptoVerify(null, data, publicKey, Buffer.from(valueBase64, 'base64'));
  assert.equal(ok, true);
});

// =================================================================================================
// AC4 — real (non-dry-run) signing is fully guarded; NONE of these tests ever completes a real
// signature (no automated check invokes sign outside dry-run — this file included).
// =================================================================================================

test('P3-T2 AC4: real signing (no --dry-run) requires --candidate at minimum', async () => {
  await assert.rejects(() => runSign({}), UsageError);
});

test('P3-T2 AC4: real signing fails closed (UsageError) with no --key at all', async () => {
  const packDir = await buildFreshPack();
  try {
    await assert.rejects(() => runSign({ candidate: packDir }), UsageError);
    await assert.rejects(() => runSign({ candidate: packDir, keyId: 'someone' }), UsageError);
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('P3-T2 AC4: real signing fails closed (UsageError) with --key but no --key-id', async () => {
  const packDir = await buildFreshPack();
  const outsideKeyDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-outside-key-'));
  try {
    const keyPath = path.join(outsideKeyDir, 'not-actually-read.pem');
    await assert.rejects(() => runSign({ candidate: packDir, key: keyPath }), UsageError);
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(outsideKeyDir, { recursive: true, force: true });
  }
});

test('P3-T2 AC4: real signing fails closed (UsageError) when --key-id carries the TESTKEY- prefix', async () => {
  const packDir = await buildFreshPack();
  const outsideKeyDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-outside-key-'));
  try {
    const keyPath = path.join(outsideKeyDir, 'not-actually-read.pem');
    await assert.rejects(
      () => runSign({ candidate: packDir, key: keyPath, keyId: 'TESTKEY-should-be-rejected' }),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.match(err.message, /TESTKEY-/);
        return true;
      },
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(outsideKeyDir, { recursive: true, force: true });
  }
});

test('P3-T2 AC4: real signing fails closed (UsageError) when --key resolves inside the repository tree', async () => {
  const packDir = await buildFreshPack();
  try {
    // An in-repo path (this very test file) — must be rejected before ever being read, regardless
    // of whether it is a well-formed key.
    const inRepoKeyPath = path.join(REPO_ROOT, 'tests', 'ef-release-sign-verify.test.mjs');
    await assert.rejects(
      () => runSign({ candidate: packDir, key: inRepoKeyPath, keyId: 'real-custodian-2026' }),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.match(err.message, /inside this repository tree/);
        return true;
      },
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('P3-T2 AC4: --dry-run combined with --key is rejected outright (structurally separate postures)', async () => {
  const packDir = await buildFreshPack();
  const outsideKeyDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-outside-key-'));
  try {
    const keyPath = path.join(outsideKeyDir, 'irrelevant.pem');
    await assert.rejects(
      () => runSign({ candidate: packDir, dryRun: true, key: keyPath }),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.match(err.message, /--dry-run cannot be combined with --key/);
        return true;
      },
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(outsideKeyDir, { recursive: true, force: true });
  }
});

test('P3-T2 AC4: the CLI dispatches "sign" with no args to exit 1 (fail closed), never exit 0', async () => {
  const { result: exitCode } = await withCapturedStdout(() => cliMain(['sign']));
  assert.equal(exitCode, 1);
});

// =================================================================================================
// AC5 — dry-run-signed output validates against schemas/release-manifest.schema.json; a real-mode
// structural shape does NOT — proving `sign` cannot bypass or weaken the P1-T5 forced-empty slot.
// =================================================================================================

test('P3-T2 AC5: a --dry-run signed candidate\'s manifest field validates cleanly against schemas/release-manifest.schema.json', async () => {
  const packDir = await buildFreshPack();
  try {
    const { result: signed } = await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true, keyId: 'ef-release-p3t2-schema-check' }),
    );
    const schema = await readJson(RELEASE_MANIFEST_SCHEMA_PATH);
    const errors = validate(schema, signed.manifest);
    assert.deepEqual(errors, [], `dry-run signed manifest must validate cleanly: ${JSON.stringify(errors)}`);
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('P3-T2 AC5: the structural shape a real (non-dry-run) sign would produce does NOT validate against schemas/release-manifest.schema.json — the P1-T5 forced-empty slot is never bypassed', async () => {
  const packDir = await buildFreshPack();
  try {
    // Construct, by hand, exactly the document shape signReal's finalizeSignedCandidate would
    // build (unsigned manifest fields + a populated `signature`, `dryRun` absent) — WITHOUT ever
    // calling a real-mode `sign` invocation (this test still never exercises real signing).
    const { bytes } = await readCanonicalManifestBytes(packDir);
    const unsignedManifest = JSON.parse(bytes.toString('utf8'));
    const realShapedCandidate = {
      ...unsignedManifest,
      signature: { algorithm: 'ed25519', keyId: 'real-custodian-2026', value: 'ZmFrZS1yZWFsLXNpZ25hdHVyZQ==' },
    };
    const schema = await readJson(RELEASE_MANIFEST_SCHEMA_PATH);
    const errors = validate(schema, realShapedCandidate);
    assert.ok(errors.length > 0, 'a real (non-dry-run) candidate with a populated signature must fail schema validation — this schema has no branch that admits one');
    assert.ok(
      errors.some((e) => /signature/i.test(e.path) || /signature/i.test(e.message)),
      `at least one validation error must reference the signature field: ${JSON.stringify(errors)}`,
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// AC6 — no key-generation verb exists in this CLI at all.
// =================================================================================================

test('P3-T2 AC6: --help lists exactly the 4 documented verbs — no genkey/keygen verb exists in this CLI', async () => {
  const { result: exitCode, output } = await withCapturedStdout(() => cliMain(['--help']));
  assert.equal(exitCode, 0);
  for (const verb of ['manifest', 'register', 'sign', 'verify']) {
    assert.match(output, new RegExp(`\\b${verb}\\b`));
  }
  assert.doesNotMatch(output, /gen-?key/i);
});

// =================================================================================================
// --out / --out-public-key persistence, and the guard against overwriting the unsigned source.
// =================================================================================================

test('--out persists a schema-conformant signed manifest (never the unsigned source path); --out-public-key persists the public key separately', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-out-'));
  try {
    const outPath = path.join(workDir, 'release-manifest.dryrun-signed.json');
    const outPublicKeyPath = path.join(workDir, 'signer-public-key.pem');
    const { result: signed } = await withCapturedStdout(() =>
      runSign({
        candidate: packDir, dryRun: true, keyId: 'ef-release-p3t2-out',
        out: outPath, outPublicKey: outPublicKeyPath,
      }),
    );
    assert.equal(signed.outPath, outPath);
    assert.equal(signed.outPublicKeyPath, outPublicKeyPath);

    const writtenManifest = await readJson(outPath);
    assert.deepEqual(writtenManifest, signed.manifest);

    const writtenPublicKey = await readFile(outPublicKeyPath, 'utf8');
    assert.equal(writtenPublicKey, signed.signerPublicKey.value);
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});

test('--out pointed at the unsigned source manifest itself is rejected (never overwritten in place)', async () => {
  const packDir = await buildFreshPack();
  try {
    const { manifestPath } = await readCanonicalManifestBytes(packDir);
    await assert.rejects(
      () => runSign({ candidate: packDir, dryRun: true, out: manifestPath }),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.match(err.message, /must not point at the unsigned source manifest/);
        return true;
      },
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('--out-candidate persists sign\'s own full reporting object (packDir/manifestPath/preimageSha256/dryRun/signature/signerPublicKey/manifest) — the shape "verify" consumes', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-out-candidate-'));
  try {
    const outCandidatePath = path.join(workDir, 'candidate.json');
    const { result: signed } = await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true, keyId: 'ef-release-p3t3-out-candidate', outCandidate: outCandidatePath }),
    );
    assert.equal(signed.outCandidatePath, outCandidatePath);
    const written = await readJson(outCandidatePath);
    assert.deepEqual(written, signed);
    assert.ok(written.signerPublicKey && written.signerPublicKey.value, 'the persisted candidate must carry signerPublicKey');
    assert.equal(written.packDir, packDir);
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// P3-T3 — `verify` verb: fail-closed 5-class exit-code taxonomy (FR-13). `verify` is the sole
// CI/agent-reachable surface of this tool (ruling R3 — CI can never sign).
// =================================================================================================

/**
 * Builds a fresh, genuinely valid dry-run candidate (signed + persisted via --out-candidate) and a
 * matching, schema-valid registry entry for it. The happy-path fixture every failure-class test
 * below tampers exactly one thing away from.
 */
async function buildVerifiableFixture({ keyId = 'ef-release-p3t3-fixture' } = {}) {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-verify-'));
  const candidatePath = path.join(workDir, 'candidate.json');
  const registryPath = path.join(workDir, 'registry.json');

  const { result: signed } = await withCapturedStdout(() =>
    runSign({ candidate: packDir, dryRun: true, keyId, outCandidate: candidatePath }),
  );

  const registry = {
    schemaVersion: 1,
    entries: [
      {
        version: signed.manifest.packVersion,
        moduleId: signed.manifest.moduleId,
        packDigest: `sha256:${'1'.repeat(64)}`,
        manifestDigest: signed.preimageSha256,
        signature: null,
        signedAt: null,
        supersedes: null,
        withdrawalState: 'none',
        withdrawnAt: null,
        withdrawalReason: null,
      },
    ],
  };
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

  return { packDir, workDir, candidatePath, registryPath, signed, registry };
}

async function cleanupFixture(fixture) {
  await rm(fixture.packDir, { recursive: true, force: true });
  await rm(fixture.workDir, { recursive: true, force: true });
}

test('P3-T3 AC7: verify succeeds (exit 0) on a genuine, consistently registered dry-run candidate', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const { result, output } = await withCapturedStdout(() =>
      runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
    );
    assert.equal(result.verified, true);
    assert.equal(result.dryRun, true);
    assert.match(result.keyId, /^TESTKEY-/);
    assert.equal(result.moduleId, fixture.signed.manifest.moduleId);
    assert.equal(result.packVersion, fixture.signed.manifest.packVersion);
    assert.equal(result.preimageSha256, fixture.signed.preimageSha256);
    assert.match(output, /"verified": true/);

    const { result: exitCode, output: cliOutput } = await withCapturedStdout(() =>
      cliMain(['verify', '--candidate', fixture.candidatePath, '--registry', fixture.registryPath]),
    );
    assert.equal(exitCode, EXIT_OK);
    assert.match(cliOutput, /"verified": true/);
  } finally {
    await cleanupFixture(fixture);
  }
});

test('P3-T3 AC8 class (1): byte drift vs canonical bytes — a pack manifest tampered after signing fails closed with EXIT_BYTE_DRIFT and zero stdout output', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const { manifestPath } = await readCanonicalManifestBytes(fixture.packDir);
    const original = await readFile(manifestPath, 'utf8');
    await writeFile(manifestPath, original.replace('"schemaVersion"', '"schemaVersionTampered"'), 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof CandidateByteDriftError);
        assert.equal(err.exitCode, EXIT_BYTE_DRIFT);
        return true;
      },
    );

    const { result: exitCode, output } = await withCapturedStdout(() =>
      cliMain(['verify', '--candidate', fixture.candidatePath, '--registry', fixture.registryPath]),
    );
    assert.equal(exitCode, EXIT_BYTE_DRIFT);
    assert.equal(output, '', 'a failed verify must produce zero stdout output — no partial output on non-zero exit');
  } finally {
    await cleanupFixture(fixture);
  }
});

test('P3-T3 AC8 class (2): digest mismatch vs manifest — a tampered signature value fails closed with EXIT_DIGEST_MISMATCH and zero stdout output', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const candidateRaw = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));
    const original = candidateRaw.signature.value;
    candidateRaw.signature.value = original[0] === 'A' ? `B${original.slice(1)}` : `A${original.slice(1)}`;
    await writeFile(fixture.candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof DigestMismatchError);
        assert.equal(err.exitCode, EXIT_DIGEST_MISMATCH);
        return true;
      },
    );

    const { result: exitCode, output } = await withCapturedStdout(() =>
      cliMain(['verify', '--candidate', fixture.candidatePath, '--registry', fixture.registryPath]),
    );
    assert.equal(exitCode, EXIT_DIGEST_MISMATCH);
    assert.equal(output, '');
  } finally {
    await cleanupFixture(fixture);
  }
});

test('P3-T3 AC8 class (3a): unknown keyId — a dry-run candidate whose keyId lost the TESTKEY- marker fails closed with EXIT_UNKNOWN_KEYID', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const candidateRaw = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));
    assert.match(candidateRaw.signature.keyId, /^TESTKEY-/); // sanity: starts out valid
    // keyId is metadata, not signed content — stripping it leaves the signature itself
    // cryptographically valid, so this isolates the key-identity check specifically.
    candidateRaw.signature.keyId = candidateRaw.signature.keyId.replace(/^TESTKEY-/, '');
    await writeFile(fixture.candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof UnknownKeyIdError);
        assert.equal(err.exitCode, EXIT_UNKNOWN_KEYID);
        return true;
      },
    );

    const { result: exitCode, output } = await withCapturedStdout(() =>
      cliMain(['verify', '--candidate', fixture.candidatePath, '--registry', fixture.registryPath]),
    );
    assert.equal(exitCode, EXIT_UNKNOWN_KEYID);
    assert.equal(output, '');
  } finally {
    await cleanupFixture(fixture);
  }
});

test('P3-T3 AC8 class (3b): unknown keyId — a non-dry-run candidate has no signing-custodian roster to check against in E1 (gate G2 has not happened), fails closed with EXIT_UNKNOWN_KEYID', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const candidateRaw = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));
    candidateRaw.dryRun = false;
    candidateRaw.signature.keyId = 'real-custodian-2026'; // NOT TESTKEY- prefixed
    await writeFile(fixture.candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof UnknownKeyIdError);
        assert.equal(err.exitCode, EXIT_UNKNOWN_KEYID);
        assert.doesNotMatch(err.message, /TESTKEY-.*prefix/); // distinct from class (5)'s message
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

test('P3-T3 AC8 class (4a): registry inconsistency — a registered manifestDigest that disagrees with the candidate fails closed with EXIT_REGISTRY_INCONSISTENCY and zero stdout output', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const registry = JSON.parse(await readFile(fixture.registryPath, 'utf8'));
    registry.entries[0].manifestDigest = `sha256:${'9'.repeat(64)}`;
    await writeFile(fixture.registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof RegistryInconsistencyError);
        assert.equal(err.exitCode, EXIT_REGISTRY_INCONSISTENCY);
        return true;
      },
    );

    const { result: exitCode, output } = await withCapturedStdout(() =>
      cliMain(['verify', '--candidate', fixture.candidatePath, '--registry', fixture.registryPath]),
    );
    assert.equal(exitCode, EXIT_REGISTRY_INCONSISTENCY);
    assert.equal(output, '');
  } finally {
    await cleanupFixture(fixture);
  }
});

test("P3-T3 AC8 class (4b): registry inconsistency — no entry at all for the candidate's module/version fails closed with EXIT_REGISTRY_INCONSISTENCY", async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const emptyRegistry = { schemaVersion: 1, entries: [] };
    await writeFile(fixture.registryPath, `${JSON.stringify(emptyRegistry, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof RegistryInconsistencyError);
        assert.equal(err.exitCode, EXIT_REGISTRY_INCONSISTENCY);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

test("P3-T3 AC8 class (4c): registry inconsistency — a schema-invalid registry document (extra field) fails closed with EXIT_REGISTRY_INCONSISTENCY", async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const registry = JSON.parse(await readFile(fixture.registryPath, 'utf8'));
    registry.entries[0].reviewerId = 'not-a-legal-field'; // additionalProperties: false
    await writeFile(fixture.registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof RegistryInconsistencyError);
        assert.equal(err.exitCode, EXIT_REGISTRY_INCONSISTENCY);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

test('P3-T3 AC8 class (5): TESTKEY- identity on a non-dry-run candidate — the release-path test-key leak — fails closed with EXIT_TESTKEY_ON_REAL and zero stdout output', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const candidateRaw = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));
    assert.match(candidateRaw.signature.keyId, /^TESTKEY-/);
    // keyId (still TESTKEY--prefixed) is left untouched — only dryRun flips to false, simulating a
    // candidate document laundered to look like a real release while still carrying the ephemeral
    // test-key marker. The signature itself remains cryptographically valid throughout.
    candidateRaw.dryRun = false;
    await writeFile(fixture.candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof TestKeyOnRealCandidateError);
        assert.equal(err.exitCode, EXIT_TESTKEY_ON_REAL);
        assert.match(err.message, /TESTKEY-/);
        return true;
      },
    );

    const { result: exitCode, output } = await withCapturedStdout(() =>
      cliMain(['verify', '--candidate', fixture.candidatePath, '--registry', fixture.registryPath]),
    );
    assert.equal(exitCode, EXIT_TESTKEY_ON_REAL);
    assert.equal(output, '');
  } finally {
    await cleanupFixture(fixture);
  }
});

test('P3-T3: the 5 documented failure-class exit codes (plus OK and USAGE) are all pairwise distinct — README table has no collisions', () => {
  const codes = [
    EXIT_OK, 1 /* EXIT_USAGE */, EXIT_BYTE_DRIFT, EXIT_DIGEST_MISMATCH,
    EXIT_UNKNOWN_KEYID, EXIT_REGISTRY_INCONSISTENCY, EXIT_TESTKEY_ON_REAL,
  ];
  assert.equal(new Set(codes).size, codes.length);
});

test('P3-T3 AC9: verify.mjs structurally cannot sign — it never references a node:crypto signing primitive (ruling R3: verify-only is the CI/agent-reachable surface)', async () => {
  const verifySourcePath = path.join(REPO_ROOT, 'tools', 'release-sign', 'lib', 'verify.mjs');
  const source = await readFile(verifySourcePath, 'utf8');
  for (const forbidden of ['generateKeyPairSync', 'createPrivateKey', 'cryptoSign', 'signEd25519']) {
    assert.ok(!source.includes(forbidden), `verify.mjs must never reference "${forbidden}"`);
  }
  const importLine = source.split('\n').find((line) => line.includes("from 'node:crypto'"));
  assert.ok(importLine, 'expected exactly one node:crypto import line');
  assert.match(importLine, /verify as cryptoVerify/);
  assert.match(importLine, /createPublicKey/);
});

test('P3-T3: verify fails closed (UsageError, exit 1) on a missing --candidate/--registry path, an omitted flag, or a structurally malformed candidate document', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    await assert.rejects(
      () => runVerify({ candidate: path.join(fixture.workDir, 'does-not-exist.json'), registry: fixture.registryPath }),
      UsageError,
    );
    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: path.join(fixture.workDir, 'does-not-exist.json') }),
      UsageError,
    );
    await assert.rejects(() => runVerify({ registry: fixture.registryPath }), UsageError);
    await assert.rejects(() => runVerify({ candidate: fixture.candidatePath }), UsageError);
    await assert.rejects(() => runVerify({}), UsageError);

    const malformedPath = path.join(fixture.workDir, 'malformed-candidate.json');
    await writeFile(malformedPath, JSON.stringify({ notACandidate: true }), 'utf8');
    await assert.rejects(() => runVerify({ candidate: malformedPath, registry: fixture.registryPath }), UsageError);

    const notJsonPath = path.join(fixture.workDir, 'not-json.json');
    await writeFile(notJsonPath, '{ this is not json', 'utf8');
    await assert.rejects(() => runVerify({ candidate: notJsonPath, registry: fixture.registryPath }), UsageError);

    const { result: exitCode } = await withCapturedStdout(() => cliMain(['verify']));
    assert.equal(exitCode, 1);
  } finally {
    await cleanupFixture(fixture);
  }
});

test('P3-T3 (P3-GATE precursor): two independent --dry-run sign->verify roundtrips of the SAME pack each independently verify — byte-stable preimage, independently valid signatures across 2 runs', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-verify-roundtrip-'));
  try {
    let firstPreimage;
    for (const label of ['run-a', 'run-b']) {
      const candidatePath = path.join(workDir, `${label}-candidate.json`);
      const registryPath = path.join(workDir, `${label}-registry.json`);
      const { result: signed } = await withCapturedStdout(() =>
        runSign({ candidate: packDir, dryRun: true, keyId: label, outCandidate: candidatePath }),
      );
      firstPreimage ??= signed.preimageSha256;
      assert.equal(signed.preimageSha256, firstPreimage, 'the same pack must yield a byte-stable preimage across independent sign runs');

      const registryDoc = {
        schemaVersion: 1,
        entries: [{
          version: signed.manifest.packVersion,
          moduleId: signed.manifest.moduleId,
          packDigest: `sha256:${'1'.repeat(64)}`,
          manifestDigest: signed.preimageSha256,
          signature: null, signedAt: null, supersedes: null,
          withdrawalState: 'none', withdrawnAt: null, withdrawalReason: null,
        }],
      };
      await writeFile(registryPath, `${JSON.stringify(registryDoc, null, 2)}\n`, 'utf8');

      const { result } = await withCapturedStdout(() =>
        runVerify({ candidate: candidatePath, registry: registryPath }),
      );
      assert.equal(result.verified, true);
      assert.equal(result.preimageSha256, signed.preimageSha256);
    }
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});
