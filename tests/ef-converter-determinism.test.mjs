// tests/ef-converter-determinism.test.mjs — P5-T5 (evidence-foundry-buildout Phase 5, FR-20,
// `02 §2.3` invariant 13, High-risk hotspot per the plan's own decisions-block Risk Mitigation
// table).
//
// Task acceptance criteria (phase-3-5-projection-slice-manifest.md, row P5-T5):
//   "Two clean `propose` runs produce byte-identical output for every emitted file (SHA-256
//    equality demonstrated by the test, not merely asserted in prose); both new test files pass."
//
// This is the FULL cross-artifact double-run proof: run `propose` TWICE, from two entirely
// separate, freshly-created output directories, against the SAME byte-identical inputs (the real,
// committed `tests/fixtures/rf-cbc-001` fixture + the real, committed `modules/cbc_suite_v1/`
// module + `authoring-decisions.yaml`) and the SAME converter build (this checkout's own code —
// `CONVERTER_VERSION` never changes mid-test). Every P3-T1..T6/P5-T1..T3 artifact `propose` emits
// under `--out` is compared byte-for-byte (SHA-256 digest, not merely `===` on parsed JSON, so a
// whitespace/key-order drift would also be caught): `pack-provenance.json`, `evidence.json`,
// `evidence-assertions.json`, `candidates.json`, `rule-proposals.json`, `rules.json`,
// `rule-provenance.json`, `release-manifest.unsigned.json` (P5-T1), `conversion-report.json`
// (P5-T2), `semantic-diff.json` (P5-T3).
//
// `release-manifest.unsigned.json` is the artifact most exposed to accidental non-determinism —
// individual scoped proofs already exist for its own pure builders (P5-T1's own
// `tests/ef-converter-release-manifest.test.mjs`) — this file's job is the CROSS-artifact,
// whole-pack proof, run as its own real end-to-end `propose` invocation rather than re-using any
// other test's fixture state.
//
// `modules/cbc_suite_v1/traceability-index.json` (P5-T4) is a separately-generated, separately-
// committed artifact (not part of `propose`'s `--out` pack — see
// `tools/rf-bundle-to-kb-pack/lib/traceability-index.mjs`'s header comment) but it is still one of
// "the P5-T1..T4 outputs" this task's own row names, so its own determinism is proven here too:
// `generateTraceabilityIndex()` called twice against the same committed inputs must produce
// byte-identical JSON (this complements, rather than duplicates,
// `tests/ef-converter-traceability-index.test.mjs`'s item 5, which proves the pure
// `buildTraceabilityIndex` function alone is deterministic; this file additionally proves the I/O
// wrapper end-to-end).
//
// No timestamps are embedded in any hashed content (this file's own equality assertions are the
// proof: if a wall-clock value were embedded anywhere, two real invocations separated by even a
// few milliseconds of wall-clock time would produce different bytes and this test would fail).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runPropose } from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { generateTraceabilityIndex } from '../tools/rf-bundle-to-kb-pack/lib/traceability-index.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');

// Every file `propose` writes directly into `--out` (P3-T7's assembled staged pack, plus the
// P5-T1/T2/T3 additions this phase adds on top). Order here is only for readable failure output —
// the comparison itself does not depend on iteration order.
const EXPECTED_PACK_FILES = [
  'pack-provenance.json',
  'evidence.json',
  'evidence-assertions.json',
  'candidates.json',
  'rule-proposals.json',
  'rules.json',
  'rule-provenance.json',
  'release-manifest.unsigned.json',
  'conversion-report.json',
  'semantic-diff.json',
];

async function withCapturedStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = original;
  }
}

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// =================================================================================================
// The core double-run proof: two clean, independent `propose` runs, every emitted file compared.
// =================================================================================================

test('P5-T5: two clean propose runs against byte-identical inputs produce SHA-256-identical output for every emitted pack file', async () => {
  const outDirA = await mkdtemp(path.join(os.tmpdir(), 'ef-determinism-a-'));
  const outDirB = await mkdtemp(path.join(os.tmpdir(), 'ef-determinism-b-'));
  try {
    const exitCodeA = await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR,
        module: REAL_MODULE_PATH,
        decisions: REAL_DECISIONS_PATH,
        out: outDirA,
      }),
    );
    const exitCodeB = await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR,
        module: REAL_MODULE_PATH,
        decisions: REAL_DECISIONS_PATH,
        out: outDirB,
      }),
    );

    assert.equal(exitCodeA, 0, 'run A must succeed');
    assert.equal(exitCodeB, 0, 'run B must succeed');

    // Neither run may emit a file the other did not, and vice versa (a determinism claim that
    // silently ignored an extra/missing file would not be a real proof).
    const filesA = (await readdir(outDirA)).sort();
    const filesB = (await readdir(outDirB)).sort();
    assert.deepEqual(filesA, filesB, 'both runs must emit exactly the same set of files');
    assert.deepEqual(filesA, [...EXPECTED_PACK_FILES].sort(), 'both runs must emit exactly the 10 expected pack files, no more, no fewer');

    const mismatches = [];
    for (const filename of EXPECTED_PACK_FILES) {
      const rawA = await readFile(path.join(outDirA, filename), 'utf8');
      const rawB = await readFile(path.join(outDirB, filename), 'utf8');
      const hashA = sha256Hex(rawA);
      const hashB = sha256Hex(rawB);
      if (hashA !== hashB) {
        mismatches.push({ filename, hashA, hashB });
      }
    }
    assert.deepEqual(
      mismatches,
      [],
      `every emitted file must be SHA-256-identical across two clean runs; mismatches: ${JSON.stringify(mismatches, null, 2)}`,
    );
  } finally {
    await rm(outDirA, { recursive: true, force: true });
    await rm(outDirB, { recursive: true, force: true });
  }
});

// =================================================================================================
// Sanity: the digest comparison above is non-vacuous — it would actually catch a real difference.
// =================================================================================================

test('sanity: sha256Hex distinguishes different content (the equality check above is not vacuously true)', () => {
  assert.notEqual(sha256Hex('a'), sha256Hex('b'));
  assert.equal(sha256Hex('a'), sha256Hex('a'));
});

// =================================================================================================
// A third independent run confirms the equality is not a two-run coincidence.
// =================================================================================================

test('P5-T5: a third independent propose run still matches the first two, file by file', async () => {
  const outDirA = await mkdtemp(path.join(os.tmpdir(), 'ef-determinism-3a-'));
  const outDirC = await mkdtemp(path.join(os.tmpdir(), 'ef-determinism-3c-'));
  try {
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDirA }),
    );
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDirC }),
    );

    for (const filename of EXPECTED_PACK_FILES) {
      const rawA = await readFile(path.join(outDirA, filename), 'utf8');
      const rawC = await readFile(path.join(outDirC, filename), 'utf8');
      assert.equal(sha256Hex(rawA), sha256Hex(rawC), `${filename} must remain identical on a third run`);
    }
  } finally {
    await rm(outDirA, { recursive: true, force: true });
    await rm(outDirC, { recursive: true, force: true });
  }
});

// =================================================================================================
// P5-T4's traceability-index.json (separately-generated/committed, not part of `--out`) is still
// named by this task's own row ("the P5-T1..T4 outputs") — proven deterministic end-to-end here.
// =================================================================================================

test('P5-T5: generateTraceabilityIndex() produces byte-identical JSON across two calls against the real committed module', async () => {
  const indexA = await generateTraceabilityIndex({ moduleDir: REAL_MODULE_DIR, repoRoot: REPO_ROOT });
  const indexB = await generateTraceabilityIndex({ moduleDir: REAL_MODULE_DIR, repoRoot: REPO_ROOT });
  const rawA = JSON.stringify(indexA);
  const rawB = JSON.stringify(indexB);
  assert.equal(sha256Hex(rawA), sha256Hex(rawB));

  // Also matches the committed copy on disk (mirrors ef-converter-traceability-index.test.mjs's
  // own "not stale" proof; re-asserted here as part of this task's own cross-artifact scope).
  const committedRaw = await readFile(path.join(REAL_MODULE_DIR, 'traceability-index.json'), 'utf8');
  assert.equal(
    `${JSON.stringify(indexA, null, 2)}\n`,
    committedRaw,
    'the freshly-regenerated index must equal the committed modules/cbc_suite_v1/traceability-index.json byte-for-byte',
  );
});

// =================================================================================================
// No wall-clock value anywhere in the emitted bytes: every hashed artifact is free of ISO-8601
// timestamp patterns that were NOT already present, verbatim, in the fixture's own committed input
// (`bundleCreatedAt` on pack-provenance.json legitimately echoes the fixture's own
// `evidence_bundle.yaml.created_at` field — that is a copied INPUT value, not a freshly-generated
// wall-clock stamp, and is explicitly excluded from this scan).
// =================================================================================================

test('P5-T5: no freshly-generated timestamp is embedded in the manifest/report/diff artifacts this task proves deterministic', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-determinism-notimestamp-'));
  try {
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir }),
    );
    const isoTimestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    // release-manifest.unsigned.json, conversion-report.json, semantic-diff.json are the 3 new
    // Phase 5 artifact types this task's own row lists (P5-T1/T2/T3) — none of them binds a
    // release/generation timestamp field (see release-manifest.schema.json's own
    // `additionalProperties: false` + this task row's field list).
    for (const filename of ['release-manifest.unsigned.json', 'conversion-report.json', 'semantic-diff.json']) {
      const raw = await readFile(path.join(outDir, filename), 'utf8');
      assert.equal(
        isoTimestampPattern.test(raw),
        false,
        `${filename} must not embed a freshly-generated ISO-8601 timestamp (FR-20 seam invariant 13)`,
      );
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
