// tests/ef-converter-release-manifest.test.mjs — P5-T1 (evidence-foundry-buildout Phase 5, FR-18,
// `02 §4.18` minus the `signature` block).
//
// Task acceptance criteria (phase-3-5-projection-slice-manifest.md, row P5-T1):
//   1. "Manifest emitted and validates against the new schema" — proven both here (the pure
//      builder functions in isolation, and a real `propose` run's byte-identical-across-two-runs
//      emission) and in tests/release-manifest-schema.test.mjs (schema-level proof, including the
//      seeded-bad-fixture rejection).
//   2. "`verify --pack ... --rule-schema schemas/rule.schema.json` now validates the manifest too,
//      closing P2-T7's stub" — covered in tests/ef-converter-verify.test.mjs.
//
// This suite covers `propose`'s four new pure builder functions
// (computeConverterConfigSha256/computeTestCorpusHash/computeTraceabilityHash/buildReleaseManifest)
// plus a scoped determinism proof for the one artifact this task adds (release-manifest.unsigned.
// json) — the FULL cross-artifact double-run proof is P5-T5's own dedicated test file.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONVERTER_NAME,
  CONVERTER_VERSION,
  PACK_VERSION,
  buildReleaseManifest,
  computeConverterConfigSha256,
  computeTestCorpusHash,
  computeTraceabilityHash,
  run as runPropose,
} from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { loadBundle } from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import { pinArtifacts } from '../tools/rf-bundle-to-kb-pack/lib/hashing.mjs';
import { checkEligibility } from '../tools/rf-bundle-to-kb-pack/lib/eligibility.mjs';
import { UsageError } from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const CONVERTER_ROOT = path.join(REPO_ROOT, 'tools', 'rf-bundle-to-kb-pack');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');

async function withCapturedStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = original;
  }
}

// =================================================================================================
// computeConverterConfigSha256 — deterministic, content-derived, sort-independent
// =================================================================================================

test('P5-T1: computeConverterConfigSha256 is deterministic across two calls against the real converter tree', async () => {
  const a = await computeConverterConfigSha256(CONVERTER_ROOT);
  const b = await computeConverterConfigSha256(CONVERTER_ROOT);
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('P5-T1: computeConverterConfigSha256 changes when a source file\'s content changes', async () => {
  const tempA = await mkdtemp(path.join(os.tmpdir(), 'ef-config-hash-a-'));
  const tempB = await mkdtemp(path.join(os.tmpdir(), 'ef-config-hash-b-'));
  try {
    await writeFile(path.join(tempA, 'x.mjs'), 'export const x = 1;\n');
    await writeFile(path.join(tempB, 'x.mjs'), 'export const x = 2;\n');
    const a = await computeConverterConfigSha256(tempA);
    const b = await computeConverterConfigSha256(tempB);
    assert.notEqual(a, b);
  } finally {
    await rm(tempA, { recursive: true, force: true });
    await rm(tempB, { recursive: true, force: true });
  }
});

test('P5-T1: computeConverterConfigSha256 is independent of on-disk file creation order (deterministic sort)', async () => {
  const tempA = await mkdtemp(path.join(os.tmpdir(), 'ef-config-hash-order-a-'));
  const tempB = await mkdtemp(path.join(os.tmpdir(), 'ef-config-hash-order-b-'));
  try {
    await mkdir(path.join(tempA, 'sub'), { recursive: true });
    await mkdir(path.join(tempB, 'sub'), { recursive: true });
    // Same final content, opposite creation order.
    await writeFile(path.join(tempA, 'a.mjs'), 'export const a = 1;\n');
    await writeFile(path.join(tempA, 'sub', 'b.mjs'), 'export const b = 2;\n');
    await writeFile(path.join(tempB, 'sub', 'b.mjs'), 'export const b = 2;\n');
    await writeFile(path.join(tempB, 'a.mjs'), 'export const a = 1;\n');

    const a = await computeConverterConfigSha256(tempA);
    const b = await computeConverterConfigSha256(tempB);
    assert.equal(a, b, 'hash must not depend on filesystem creation/listing order');
  } finally {
    await rm(tempA, { recursive: true, force: true });
    await rm(tempB, { recursive: true, force: true });
  }
});

// =================================================================================================
// computeTestCorpusHash — real module test corpus + fail-closed on zero matches
// =================================================================================================

test('P5-T1: computeTestCorpusHash finds the 5 real tests/ef-cbc_suite_v1-*.test.mjs files and hashes deterministically', async () => {
  const a = await computeTestCorpusHash(REPO_ROOT, 'cbc_suite_v1');
  const b = await computeTestCorpusHash(REPO_ROOT, 'cbc_suite_v1');
  assert.deepEqual(a, b);
  assert.match(a.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(
    [...a.files].sort(),
    [
      'ef-cbc_suite_v1-boundary.test.mjs',
      'ef-cbc_suite_v1-dangerous-miss.test.mjs',
      'ef-cbc_suite_v1-missingness.test.mjs',
      'ef-cbc_suite_v1-negative.test.mjs',
      'ef-cbc_suite_v1-positive.test.mjs',
    ],
  );
});

test('P5-T1: computeTestCorpusHash fails closed (UsageError) when a module has zero generated test-corpus files', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-testcorpus-empty-'));
  try {
    await mkdir(path.join(tempRoot, 'tests'), { recursive: true });
    await assert.rejects(
      () => computeTestCorpusHash(tempRoot, 'no_such_module'),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.match(err.message, /no_such_module/);
        return true;
      },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// =================================================================================================
// computeTraceabilityHash — pure function, order-independent, content-sensitive
// =================================================================================================

test('P5-T1: computeTraceabilityHash is a pure, deterministic function of its inputs', () => {
  const parts = {
    decisionsRaw: 'decisions-bytes',
    evidenceAssertionsRaw: 'assertions-bytes',
    ruleProvenanceRaw: 'provenance-bytes',
    rulesRaw: 'rules-bytes',
  };
  const a = computeTraceabilityHash(parts);
  const b = computeTraceabilityHash(parts);
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('P5-T1: computeTraceabilityHash changes when any one input changes', () => {
  const base = {
    decisionsRaw: 'decisions-bytes',
    evidenceAssertionsRaw: 'assertions-bytes',
    ruleProvenanceRaw: 'provenance-bytes',
    rulesRaw: 'rules-bytes',
  };
  const changed = { ...base, rulesRaw: 'rules-bytes-CHANGED' };
  assert.notEqual(computeTraceabilityHash(base), computeTraceabilityHash(changed));
});

// =================================================================================================
// buildReleaseManifest — pure function, exact shape (FR-18 minus `signature`)
// =================================================================================================

test('P5-T1: buildReleaseManifest emits exactly the fields this task binds, no more', () => {
  const manifest = buildReleaseManifest({
    moduleId: 'cbc_suite_v1',
    packVersion: '0.1.0-proposal',
    pinnedBundle: {
      runId: 'rf_run_test',
      hashes: { bundle: 'a'.repeat(64), claimLedger: 'b'.repeat(64) },
    },
    eligibility: { bundle: { verification: { exitCode: 0, passed: true } } },
    converterConfigSha256: 'c'.repeat(64),
    testCorpusSha256: 'd'.repeat(64),
    traceabilityHashHex: 'e'.repeat(64),
  });

  assert.deepEqual(Object.keys(manifest).sort(), [
    'converter', 'moduleId', 'packVersion', 'rfInputs', 'schemaVersion', 'testCorpusHash', 'traceabilityHash',
  ]);
  assert.equal(manifest.moduleId, 'cbc_suite_v1');
  assert.equal(manifest.packVersion, '0.1.0-proposal');
  assert.deepEqual(manifest.rfInputs, [{
    runId: 'rf_run_test',
    bundleSha256: `sha256:${'a'.repeat(64)}`,
    claimLedgerSha256: `sha256:${'b'.repeat(64)}`,
    verificationExitCode: 0,
  }]);
  assert.deepEqual(manifest.converter, {
    name: CONVERTER_NAME,
    version: CONVERTER_VERSION,
    configSha256: `sha256:${'c'.repeat(64)}`,
  });
  assert.equal(manifest.testCorpusHash, `sha256:${'d'.repeat(64)}`);
  assert.equal(manifest.traceabilityHash, `sha256:${'e'.repeat(64)}`);
  assert.equal(manifest.rfInputs[0].verificationExitCode, 0, 'a passing verification exit code is never inflated/deflated');
});

test('P5-T1: buildReleaseManifest is a pure function (no I/O, deterministic given identical inputs)', () => {
  const input = {
    moduleId: 'cbc_suite_v1',
    packVersion: PACK_VERSION,
    pinnedBundle: { runId: 'rf_run_test', hashes: { bundle: 'a'.repeat(64), claimLedger: 'b'.repeat(64) } },
    eligibility: { bundle: { verification: { exitCode: 0, passed: true } } },
    converterConfigSha256: 'c'.repeat(64),
    testCorpusSha256: 'd'.repeat(64),
    traceabilityHashHex: 'e'.repeat(64),
  };
  assert.deepEqual(buildReleaseManifest(input), buildReleaseManifest(input));
});

// =================================================================================================
// Integration: a real propose run's release-manifest.unsigned.json is byte-identical across two
// clean runs against the same, unchanged fixture (FR-20 seam invariant 13, scoped to this task's
// own artifact — P5-T5 owns the full cross-artifact double-run proof).
// =================================================================================================

test('P5-T1: release-manifest.unsigned.json is byte-identical across two clean propose runs against the same fixture', async () => {
  const outDirA = await mkdtemp(path.join(os.tmpdir(), 'ef-manifest-determinism-a-'));
  const outDirB = await mkdtemp(path.join(os.tmpdir(), 'ef-manifest-determinism-b-'));
  try {
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDirA }),
    );
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDirB }),
    );

    const rawA = await readFile(path.join(outDirA, 'release-manifest.unsigned.json'), 'utf8');
    const rawB = await readFile(path.join(outDirB, 'release-manifest.unsigned.json'), 'utf8');
    assert.equal(rawA, rawB, 'release-manifest.unsigned.json must be byte-identical across two clean runs');
  } finally {
    await rm(outDirA, { recursive: true, force: true });
    await rm(outDirB, { recursive: true, force: true });
  }
});

// =================================================================================================
// buildPackProvenance's own moduleId is echoed into the manifest's moduleId, matching pinnedBundle
// (structural sanity: the real run's manifest must not silently drift from the pack it describes).
// =================================================================================================

test('P5-T1: a real propose run\'s release-manifest.unsigned.json moduleId/packVersion match pack-provenance.json', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-manifest-consistency-'));
  try {
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir }),
    );
    const manifest = JSON.parse(await readFile(path.join(outDir, 'release-manifest.unsigned.json'), 'utf8'));
    const packProvenance = JSON.parse(await readFile(path.join(outDir, 'pack-provenance.json'), 'utf8'));
    assert.equal(manifest.moduleId, packProvenance.moduleId);
    assert.equal(manifest.packVersion, packProvenance.packVersion);
    assert.equal(manifest.rfInputs[0].bundleSha256, `sha256:${packProvenance.upstreamVerification.bundleSha256}`);
    assert.equal(manifest.rfInputs[0].verificationExitCode, packProvenance.upstreamVerification.exitCode);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// Sanity: loader/hashing/eligibility compose the same way this file's other tests assume.
test('sanity: loadBundle -> pinArtifacts -> checkEligibility succeeds against the real fixture', async () => {
  const loaded = await loadBundle({ runDir: FIXTURE_DIR, modulePath: REAL_MODULE_PATH });
  const pinned = await pinArtifacts(loaded);
  const eligibility = checkEligibility(pinned);
  assert.equal(eligibility.bundle.verification.exitCode, 0);
});
