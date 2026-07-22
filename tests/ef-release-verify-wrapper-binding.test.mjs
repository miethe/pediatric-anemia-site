// tests/ef-release-verify-wrapper-binding.test.mjs — evidence-foundry-e1 P3 laundering fix (Codex
// second-opinion review): `tools/release-sign/lib/verify.mjs`'s `checkWrapperManifestBinding`.
//
// A Codex second-opinion review of P3-T3's `verify` found a MAJOR laundering path:
// `tools/release-sign/lib/verify.mjs`'s `verify` validated/cryptographically verified only the
// top-level (wrapper) signature fields (`candidate.signature`/`candidate.signerPublicKey`) and used
// `candidate.manifest` (the NESTED, embedded manifest document a wrapper carries) ONLY for
// `moduleId`/`packVersion` — never independently checked. A crafted, genuinely-valid dry-run
// TESTKEY wrapper (whose OWN top-level signature verifies cleanly against fresh on-disk bytes)
// could therefore embed a nested `manifest` whose OWN `signature` slot was populated with a
// non-TESTKEY value — or whose content was silently swapped for something else entirely — and
// `verify` would still report `verified: true`. Neither the registry checks nor
// `scripts/validate-kb.mjs` ever validated that embedded wrapper either.
//
// The fix, exercised below, adds two new fail-closed checks (`checkWrapperManifestBinding`,
// `./lib/verify.mjs`), run strictly BEFORE `checkDigestMismatch` (the one cryptographic check this
// verb performs):
//   (6) NestedManifestInvalidError / EXIT_NESTED_MANIFEST_INVALID (7) — `candidate.manifest` must
//       itself validate against `schemas/release-manifest.schema.json`.
//   (7) WrapperManifestMismatchError / EXIT_WRAPPER_MANIFEST_MISMATCH (8) — even a schema-valid
//       nested manifest must match, by canonical digest, the document this wrapper's own
//       already-verified top-level signature was produced alongside (recomputed from a FRESH re-
//       read of the pack's own bytes merged with the wrapper's own dryRun/signature).
//
// This file proves each class fails closed with the DISTINCT documented exit code, produces ZERO
// stdout output, fires BEFORE the cryptographic check, and never regresses the happy path — mirrors
// tests/ef-release-sign-verify.test.mjs's own AC7/AC8 style byte-for-byte, scoped to this fix only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runManifest } from '../tools/release-sign/lib/manifest.mjs';
import { run as runSign } from '../tools/release-sign/lib/sign.mjs';
import { run as runVerify } from '../tools/release-sign/lib/verify.mjs';
import { readCanonicalManifestBytes } from '../tools/release-sign/lib/canonical-bytes.mjs';
import { validate as validateSchema } from '../scripts/lib/json-schema-lite.mjs';
import {
  NestedManifestInvalidError,
  WrapperManifestMismatchError,
  DigestMismatchError,
  CandidateByteDriftError,
  EXIT_NESTED_MANIFEST_INVALID,
  EXIT_WRAPPER_MANIFEST_MISMATCH,
  EXIT_DIGEST_MISMATCH,
  EXIT_BYTE_DRIFT,
  EXIT_UNKNOWN_KEYID,
  EXIT_REGISTRY_INCONSISTENCY,
  EXIT_TESTKEY_ON_REAL,
  EXIT_OK,
  EXIT_USAGE,
} from '../tools/release-sign/lib/errors.mjs';
import { main as cliMain } from '../tools/release-sign/cli.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');
const RELEASE_MANIFEST_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-manifest.schema.json');
const RELEASE_FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-release');

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
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-wrapper-binding-pack-'));
  await withCapturedStdout(() =>
    runManifest({
      runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir,
    }),
  );
  return outDir;
}

/**
 * Builds a fresh, genuinely valid dry-run candidate (signed + persisted via --out-candidate) and a
 * matching, schema-valid registry entry for it — mirrors
 * tests/ef-release-sign-verify.test.mjs#buildVerifiableFixture byte-for-byte (independent copy, not
 * a cross-file import — this file owns a disjoint scope in the same wave).
 */
async function buildVerifiableFixture({ keyId = 'ef-release-p3-wrapper-binding-fixture' } = {}) {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-wrapper-binding-verify-'));
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

// =================================================================================================
// Regression: the new checks do not break the happy path.
// =================================================================================================

test('regression: a genuine dry-run candidate still verifies (exit 0) after the wrapper-binding fix', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    // Sanity: the genuinely-signed wrapper's nested manifest.signature is exactly the wrapper's own
    // top-level signature — this is the invariant the new binding check enforces.
    const candidateRaw = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));
    assert.deepEqual(candidateRaw.manifest.signature, candidateRaw.signature);
    assert.equal(candidateRaw.manifest.dryRun, true);

    const { result, output } = await withCapturedStdout(() =>
      runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
    );
    assert.equal(result.verified, true);
    assert.match(output, /"verified": true/);
  } finally {
    await cleanupFixture(fixture);
  }
});

// =================================================================================================
// Class (6) — NestedManifestInvalidError / EXIT_NESTED_MANIFEST_INVALID: the exact crafted case a
// Codex second-opinion review described (tests/fixtures/ef-release/
// laundered-nested-manifest-signature-override.json).
// =================================================================================================

test('P3 laundering fix, class (6): a genuinely valid TESTKEY dry-run wrapper embedding a nested manifest.signature populated with a non-TESTKEY value fails closed with EXIT_NESTED_MANIFEST_INVALID (Codex\'s exact crafted case)', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const laundered = await readJson(path.join(RELEASE_FIXTURE_DIR, 'laundered-nested-manifest-signature-override.json'));
    const candidateRaw = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));

    // Sanity: the seeded override is genuinely non-TESTKEY- (the exact shape being guarded against).
    assert.doesNotMatch(laundered.signatureOverride.keyId, /^TESTKEY-/);

    // Top-level wrapper fields (packDir/manifestPath/preimageSha256/signature/signerPublicKey) stay
    // completely untouched and genuinely valid — only the NESTED manifest.signature is laundered.
    candidateRaw.manifest = { ...candidateRaw.manifest, signature: laundered.signatureOverride };
    await writeFile(fixture.candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');

    // Sanity: the wrapper's own TOP-LEVEL signature is untouched and would still cryptographically
    // verify on its own — proving this is specifically a NESTED-manifest laundering attempt, not a
    // garden-variety tampered-wrapper case class (2) already catches.
    assert.match(candidateRaw.signature.keyId, /^TESTKEY-/);

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof NestedManifestInvalidError, `expected NestedManifestInvalidError, got ${err.constructor.name}: ${err.message}`);
        assert.equal(err.exitCode, EXIT_NESTED_MANIFEST_INVALID);
        assert.equal(err.exitCode, 7);
        return true;
      },
    );

    const { result: exitCode, output } = await withCapturedStdout(() =>
      cliMain(['verify', '--candidate', fixture.candidatePath, '--registry', fixture.registryPath]),
    );
    assert.equal(exitCode, EXIT_NESTED_MANIFEST_INVALID);
    assert.equal(output, '', 'a failed verify must produce zero stdout output — no partial output on non-zero exit');
  } finally {
    await cleanupFixture(fixture);
  }
});

test('P3 laundering fix, class (6): a nested manifest with a populated signature but no dryRun marker (the "real candidate" laundering shape) also fails closed with EXIT_NESTED_MANIFEST_INVALID', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const candidateRaw = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));
    // Strip the nested manifest's own dryRun marker while leaving its (still TESTKEY-) signature
    // populated — schemas/release-manifest.schema.json's own allOf requires signature: null whenever
    // dryRun is not true, so this is independently schema-invalid, a second crafted shape entirely
    // distinct from the non-TESTKEY-value case above.
    delete candidateRaw.manifest.dryRun;
    await writeFile(fixture.candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof NestedManifestInvalidError);
        assert.equal(err.exitCode, EXIT_NESTED_MANIFEST_INVALID);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

// =================================================================================================
// Class (7) — WrapperManifestMismatchError / EXIT_WRAPPER_MANIFEST_MISMATCH: a nested manifest that
// IS individually schema-valid but whose content was swapped away from what the wrapper's own
// verified signature actually covers (tests/fixtures/ef-release/
// laundered-nested-manifest-content-swap.json).
// =================================================================================================

test('P3 laundering fix, class (7): a schema-valid nested manifest whose content was swapped (testCorpusHash/traceabilityHash) fails closed with EXIT_WRAPPER_MANIFEST_MISMATCH', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const swap = await readJson(path.join(RELEASE_FIXTURE_DIR, 'laundered-nested-manifest-content-swap.json'));
    const candidateRaw = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));

    candidateRaw.manifest = { ...candidateRaw.manifest, ...swap.contentOverride };
    await writeFile(fixture.candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');

    // Sanity: the swapped nested manifest is, ON ITS OWN, still perfectly schema-valid — TESTKEY--
    // marked, dryRun: true, signature intact — proving class (6)'s schema check would NOT catch this
    // case and class (7)'s digest-binding check is what closes it.
    const manifestSchema = JSON.parse(await readFile(RELEASE_MANIFEST_SCHEMA_PATH, 'utf8'));
    const rewritten = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));
    assert.deepEqual(validateSchema(manifestSchema, rewritten.manifest), []);
    assert.equal(rewritten.manifest.moduleId, fixture.signed.manifest.moduleId, 'identity fields (moduleId) deliberately stay matching — the more insidious variant');
    assert.notEqual(rewritten.manifest.testCorpusHash, fixture.signed.manifest.testCorpusHash);

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof WrapperManifestMismatchError, `expected WrapperManifestMismatchError, got ${err.constructor.name}: ${err.message}`);
        assert.equal(err.exitCode, EXIT_WRAPPER_MANIFEST_MISMATCH);
        assert.equal(err.exitCode, 8);
        assert.match(err.expectedDigestHex, /^[0-9a-f]{64}$/);
        assert.match(err.actualDigestHex, /^[0-9a-f]{64}$/);
        assert.notEqual(err.expectedDigestHex, err.actualDigestHex);
        return true;
      },
    );

    const { result: exitCode, output } = await withCapturedStdout(() =>
      cliMain(['verify', '--candidate', fixture.candidatePath, '--registry', fixture.registryPath]),
    );
    assert.equal(exitCode, EXIT_WRAPPER_MANIFEST_MISMATCH);
    assert.equal(output, '');
  } finally {
    await cleanupFixture(fixture);
  }
});

test('P3 laundering fix, class (7): a wholesale different (but individually schema-valid) nested manifest is also refused, even with moduleId/packVersion left matching', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const candidateRaw = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));
    // Swap rfInputs/converter wholesale — a full content-swap attempt, not just two hash fields.
    candidateRaw.manifest = {
      ...candidateRaw.manifest,
      rfInputs: [{
        runId: 'rf_run_evil_unrelated_run',
        bundleSha256: `sha256:${'a'.repeat(64)}`,
        claimLedgerSha256: `sha256:${'b'.repeat(64)}`,
        verificationExitCode: 0,
      }],
    };
    await writeFile(fixture.candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof WrapperManifestMismatchError);
        assert.equal(err.exitCode, EXIT_WRAPPER_MANIFEST_MISMATCH);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

// =================================================================================================
// Ordering — the wrapper-binding checks run strictly BEFORE the cryptographic check, and strictly
// AFTER the byte-drift check.
// =================================================================================================

test('ordering: wrapper-binding checks (6)/(7) fire BEFORE the cryptographic digest-mismatch check (2) — a candidate tampered in both ways reports the laundering class, not DigestMismatchError', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const laundered = await readJson(path.join(RELEASE_FIXTURE_DIR, 'laundered-nested-manifest-signature-override.json'));
    const candidateRaw = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));

    // Tamper the TOP-LEVEL signature value too (would, on its own, trip DigestMismatchError/class 2)
    // AND launder the nested manifest.signature (class 6) — the laundering class must win, proving
    // execution order, not merely that both checks individually work.
    const originalTopValue = candidateRaw.signature.value;
    candidateRaw.signature.value = originalTopValue[0] === 'A' ? `B${originalTopValue.slice(1)}` : `A${originalTopValue.slice(1)}`;
    candidateRaw.manifest = { ...candidateRaw.manifest, signature: laundered.signatureOverride };
    await writeFile(fixture.candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof NestedManifestInvalidError, `expected the nested-manifest laundering class to win over DigestMismatchError, got ${err.constructor.name}`);
        assert.ok(!(err instanceof DigestMismatchError));
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

test('ordering: byte-drift (1) fires BEFORE the wrapper-binding checks (6)/(7) — a tampered on-disk pack manifest reports CandidateByteDriftError even when the nested manifest is also laundered', async () => {
  const fixture = await buildVerifiableFixture();
  try {
    const laundered = await readJson(path.join(RELEASE_FIXTURE_DIR, 'laundered-nested-manifest-signature-override.json'));
    const candidateRaw = JSON.parse(await readFile(fixture.candidatePath, 'utf8'));
    candidateRaw.manifest = { ...candidateRaw.manifest, signature: laundered.signatureOverride };
    await writeFile(fixture.candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');

    const { manifestPath } = await readCanonicalManifestBytes(fixture.packDir);
    const original = await readFile(manifestPath, 'utf8');
    await writeFile(manifestPath, original.replace('"schemaVersion"', '"schemaVersionTampered"'), 'utf8');

    await assert.rejects(
      () => runVerify({ candidate: fixture.candidatePath, registry: fixture.registryPath }),
      (err) => {
        assert.ok(err instanceof CandidateByteDriftError, `expected CandidateByteDriftError to fire first, got ${err.constructor.name}`);
        assert.equal(err.exitCode, EXIT_BYTE_DRIFT);
        return true;
      },
    );
  } finally {
    await cleanupFixture(fixture);
  }
});

// =================================================================================================
// Exit-code taxonomy — the 2 new codes are pairwise distinct from every existing code.
// =================================================================================================

test('the 2 new P3-laundering-fix exit codes (7, 8) are pairwise distinct from every pre-existing code (0/1/2-6)', () => {
  const codes = [
    EXIT_OK, EXIT_USAGE, EXIT_BYTE_DRIFT, EXIT_DIGEST_MISMATCH, EXIT_UNKNOWN_KEYID,
    EXIT_REGISTRY_INCONSISTENCY, EXIT_TESTKEY_ON_REAL, EXIT_NESTED_MANIFEST_INVALID,
    EXIT_WRAPPER_MANIFEST_MISMATCH,
  ];
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(EXIT_NESTED_MANIFEST_INVALID, 7);
  assert.equal(EXIT_WRAPPER_MANIFEST_MISMATCH, 8);
});

// =================================================================================================
// No real key material — this file's crafted fixtures use only TESTKEY-/REALKEY- LABELED, non-
// cryptographic placeholder values, exactly like tests/ef-release-sign-verify.test.mjs's own
// tamper fixtures (keyId is signature metadata, not signed content).
// =================================================================================================

test('the seeded laundering fixtures carry no real key material — only labeled, non-cryptographic placeholder values', async () => {
  for (const name of ['laundered-nested-manifest-signature-override.json', 'laundered-nested-manifest-content-swap.json']) {
    const raw = await readFile(path.join(RELEASE_FIXTURE_DIR, name), 'utf8');
    for (const marker of ['BEGIN PRIVATE KEY', 'BEGIN EC PRIVATE', 'BEGIN RSA PRIVATE', 'BEGIN OPENSSH PRIVATE']) {
      assert.ok(!raw.includes(marker), `${name} must never contain "${marker}"`);
    }
  }
});
