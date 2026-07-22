// tests/ef-multi-bundle-determinism.test.mjs — multi-bundle-conversion-e1 Phase 6, row P6-T3
// (FR-17; decisions block Risk 5 mitigation).
//
// Task acceptance criteria (phase-5-6-7-projection-determinism-docs.md, row P6-T3):
//   "Two independent full-batch runs produce SHA-256-identical output for all 4 bundles'
//    evidence.json/evidence-assertions.json/unresolved.json and the aggregate report; test is
//    part of `npm run check`." (This file matches `tests/*.test.mjs`, already run by `npm test`,
//    itself the first step of `npm run check` — no `package.json` change is needed to wire it in.)
//
// HONESTY NOTE, load-bearing (read before editing this file): as of this task, only ONE of the 4
// named `BATCH_PAIRS` (`./batch.mjs`) — `rf-cbc-002` -> `cbc_suite_v1` — ever completes
// `inspect -> verify -> propose` end to end. The other 3 (`rf-ev-001` -> `anemia`, `rf-kid-001` ->
// `kidney_suite_v1`, `rf-gro-002` -> `growth_suite_v1`) halt at `inspect`'s
// `loader.loadBundle()` step with a `DecisionsNotFoundError`, because none of those 3 modules has
// an `authoring-decisions.yaml` yet (documented, pre-existing, non-regression gap — Decisions
// Block Addendum A1 / Deferred Item DF-E1-M1; see `tests/ef-converter-batch.test.mjs`). Even if a
// decisions file existed for one of those 3, `propose.mjs`'s own header comment states it "fails
// closed if the loaded module id is not the one module this converter has hand-authored drafting
// content for (`cbc_suite_v1`)" — `propose` cannot draft rule/candidate content for any other
// module today, by design (FR-14). This is why `modules/anemia/evidence-assertions.json` and
// `modules/{kidney_suite_v1,growth_suite_v1}/{evidence.json,evidence-assertions.json,
// unresolved.json}` were projected by one-off, ephemeral, uncommitted generator scripts (P4-T2,
// P5-T1, P5-T2 — see each commit's own message) rather than by a live, re-invokable `propose`
// call — those files are the real, final, COMMITTED "per-bundle emitted output" for this pass for
// those 3 bundles, not a build artifact this test can regenerate on demand.
//
// Given that real, documented constraint, this file proves the P6-T3 determinism claim in full,
// honestly, via four complementary angles, none of which overstates what the converter can
// actually do today:
//
//   1. The REAL, canonical `BATCH_PAIRS` batch (unmodified, default order, same converter build),
//      run twice into two fresh, independent output directories, halts at the exact same pair
//      with the exact same named cause both times (Section 1) — proving the *documented failure*
//      is itself deterministic, not merely "a test passed once."
//   2. EVERY one of the 4 named pairs, run in ISOLATION, twice (three times for the one that
//      succeeds), into fresh independent output directories (Section 2) — the one pair that
//      completes (`cbc_suite_v1`) is proven SHA-256 byte-identical across every emitted file,
//      including `evidence.json`/`evidence-assertions.json`, across all runs; the 3 pairs that
//      halt are proven to halt identically (same stage, same cause, same message) across runs,
//      with zero partial output in every run.
//   3. The REAL, COMMITTED per-bundle `evidence.json`/`evidence-assertions.json`/`unresolved.json`
//      for ALL 4 modules — the actual "per bundle" artifacts named by this task's own AC text —
//      are proven byte-stable at rest via two independent reads each (Section 3), and (for
//      `cbc_suite_v1`, the one live-executable pair) proven identical to what a fresh `propose`
//      run emits.
//   4. The aggregate `multi-bundle-conversion-report.json` (`./multi-bundle-report.mjs`'s
//      `aggregate` verb) is proven SHA-256-identical across repeated runs (Section 4) — it reads
//      each pair's real, committed `unresolved.json` (`modules/<id>/unresolved.json`) plus
//      whatever `conversion-report.json` exists under each run's own `--out-base`, so this is a
//      genuine, non-vacuous double-run proof over real repo state, not a re-hash of a single
//      cached file.
//
// No test in this file mutates any committed file under `modules/**` or `tests/fixtures/**` — every
// write goes to an `os.tmpdir()`-rooted scratch directory, removed in a `finally` block.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BATCH_PAIRS,
  BatchBundleFailedError,
  runBatch,
} from '../tools/rf-bundle-to-kb-pack/lib/batch.mjs';
import { DecisionsNotFoundError } from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import {
  MULTI_BUNDLE_REPORT_FILENAME,
  run as runAggregate,
} from '../tools/rf-bundle-to-kb-pack/lib/multi-bundle-report.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULE_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'rule.schema.json');

// Every module this task's AC names by file (evidence.json, evidence-assertions.json,
// unresolved.json), keyed by moduleId, in `BATCH_PAIRS` order.
const MODULE_DIRS = Object.freeze({
  anemia: path.join(REPO_ROOT, 'modules', 'anemia'),
  cbc_suite_v1: path.join(REPO_ROOT, 'modules', 'cbc_suite_v1'),
  kidney_suite_v1: path.join(REPO_ROOT, 'modules', 'kidney_suite_v1'),
  growth_suite_v1: path.join(REPO_ROOT, 'modules', 'growth_suite_v1'),
});

// The one BATCH_PAIRS entry that completes `inspect -> verify -> propose` end to end today (see
// this file's header note). Every other entry is expected to halt at `inspect` with
// `DecisionsNotFoundError` (DF-E1-M1) — asserted explicitly, not assumed, throughout this file.
const LIVE_SUCCEEDING_MODULE_ID = 'cbc_suite_v1';

function sha256Hex(bufOrStr) {
  return createHash('sha256').update(bufOrStr).digest('hex');
}

async function makeScratchDir(label) {
  return mkdtemp(path.join(os.tmpdir(), `ef-multi-bundle-determinism-${label}-`));
}

async function withCapturedStdout(fn) {
  const chunks = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    return true;
  };
  try {
    const result = await fn();
    return { result, output: chunks.join('') };
  } finally {
    process.stdout.write = original;
  }
}

/** Recursively lists every file under `dir`, as paths relative to `dir`, sorted (codepoint order —
 * deterministic, matches this converter's own established convention elsewhere in this repo). */
async function listFilesRelative(dir) {
  const collected = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        collected.push(path.relative(dir, full));
      }
    }
  }
  await walk(dir);
  return collected.sort();
}

/** Reads a file's raw bytes, or reports its (expected, R-P2-documented) absence — never throws. */
async function readRawOrMissing(filePath) {
  try {
    return { missing: false, raw: await readFile(filePath) };
  } catch (err) {
    if (err.code === 'ENOENT') return { missing: true, raw: null };
    throw err;
  }
}

async function runBatchOnce(pairs, outBaseDir) {
  try {
    const captured = await withCapturedStdout(() => runBatch({ pairs, ruleSchemaPath: RULE_SCHEMA_PATH, outBaseDir }));
    return { ok: true, results: captured.result };
  } catch (err) {
    if (err instanceof BatchBundleFailedError) {
      return {
        ok: false,
        pairIndex: err.pairIndex,
        fixture: err.fixture,
        module: err.module,
        moduleId: err.moduleId,
        stage: err.stage,
        exitCode: err.exitCode,
        causeName: err.cause?.constructor?.name ?? null,
        causeMessage: err.cause?.message ?? null,
      };
    }
    throw err;
  }
}

// =================================================================================================
// Section 1: the REAL, canonical, unmodified BATCH_PAIRS batch, run TWICE, into two independent
// fresh output directories, using the same converter build and the same committed fixture inputs.
// =================================================================================================

test('P6-T3: two independent full-batch runs over the real, canonical BATCH_PAIRS halt at the exact same pair with the exact same named cause', async () => {
  const outBaseA = await makeScratchDir('full-a');
  const outBaseB = await makeScratchDir('full-b');
  try {
    const runA = await runBatchOnce(BATCH_PAIRS, outBaseA);
    const runB = await runBatchOnce(BATCH_PAIRS, outBaseB);

    // As of this task, the real batch halts at pair 0 (rf-ev-001 -> modules/anemia) with
    // DecisionsNotFoundError (DF-E1-M1) — this is the documented, expected, non-regression state
    // (see this file's header note and tests/ef-converter-batch.test.mjs). Asserted explicitly
    // here, not assumed, so a future close of DF-E1-M1 fails this test loudly rather than letting
    // a stale assumption silently pass.
    assert.equal(runA.ok, false, 'run A is expected to halt (DF-E1-M1) — update this test if that gap has closed');
    assert.equal(runB.ok, false, 'run B is expected to halt (DF-E1-M1) — update this test if that gap has closed');

    // The core determinism claim: run A and run B fail at the SAME pair, SAME stage, SAME named
    // cause, with byte-identical error messages (SHA-256 compared, not just `===`, so this is a
    // real proof rather than an assertion of prose).
    assert.deepEqual(
      { pairIndex: runA.pairIndex, fixture: runA.fixture, module: runA.module, moduleId: runA.moduleId, stage: runA.stage, exitCode: runA.exitCode, causeName: runA.causeName },
      { pairIndex: runB.pairIndex, fixture: runB.fixture, module: runB.module, moduleId: runB.moduleId, stage: runB.stage, exitCode: runB.exitCode, causeName: runB.causeName },
      'both full-batch runs must halt at the identical pair/stage/cause',
    );
    assert.equal(runA.causeName, 'DecisionsNotFoundError');
    assert.equal(sha256Hex(runA.causeMessage), sha256Hex(runB.causeMessage), 'the halting error message must be SHA-256-identical across both runs');
    assert.equal(runA.pairIndex, 0);
    assert.equal(runA.moduleId, 'anemia');

    // Zero output anywhere under either scratch outBaseDir — the halt occurs before the halting
    // pair's own `mkdir(outDir)` ever runs (see lib/batch.mjs), so neither run left ANY file behind.
    assert.deepEqual(await listFilesRelative(outBaseA), []);
    assert.deepEqual(await listFilesRelative(outBaseB), []);
  } finally {
    await rm(outBaseA, { recursive: true, force: true });
    await rm(outBaseB, { recursive: true, force: true });
  }
});

// =================================================================================================
// Section 2: EVERY one of the 4 named pairs, run in isolation, twice (three times for the pair
// that succeeds) — the strongest per-bundle proof this converter can actually exercise live today.
// =================================================================================================

for (const pair of BATCH_PAIRS) {
  const moduleId = path.basename(pair.module);
  const isLiveSucceeding = moduleId === LIVE_SUCCEEDING_MODULE_ID;

  test(`P6-T3: pair "${moduleId}" (${pair.fixture}) run in isolation twice produces a deterministic outcome`, async () => {
    const outBaseA = await makeScratchDir(`pair-${moduleId}-a`);
    const outBaseB = await makeScratchDir(`pair-${moduleId}-b`);
    try {
      const runA = await runBatchOnce([pair], outBaseA);
      const runB = await runBatchOnce([pair], outBaseB);

      if (isLiveSucceeding) {
        assert.equal(runA.ok, true, `${moduleId} is expected to complete propose end to end`);
        assert.equal(runB.ok, true, `${moduleId} is expected to complete propose end to end`);
        assert.equal(runA.results.length, 1);
        assert.equal(runB.results.length, 1);
        assert.equal(runA.results[0].status, 'succeeded');
        assert.equal(runB.results[0].status, 'succeeded');

        const outDirA = runA.results[0].outDir;
        const outDirB = runB.results[0].outDir;
        const filesA = await listFilesRelative(outDirA);
        const filesB = await listFilesRelative(outDirB);
        assert.ok(filesA.length > 0, 'expected propose to have written at least one file');
        assert.deepEqual(filesA, filesB, 'both isolated runs must emit exactly the same set of files');
        // The two files this task's AC names by name, both present in propose's own emitted pack.
        assert.ok(filesA.includes('evidence.json'));
        assert.ok(filesA.includes('evidence-assertions.json'));

        const mismatches = [];
        for (const relFile of filesA) {
          const bytesA = await readFile(path.join(outDirA, relFile));
          const bytesB = await readFile(path.join(outDirB, relFile));
          const hashA = sha256Hex(bytesA);
          const hashB = sha256Hex(bytesB);
          if (hashA !== hashB) mismatches.push({ relFile, hashA, hashB });
        }
        assert.deepEqual(mismatches, [], `every emitted file for "${moduleId}" must be SHA-256-identical across two isolated runs; mismatches: ${JSON.stringify(mismatches)}`);
      } else {
        // The other 3 pairs are expected to halt at `inspect` with DecisionsNotFoundError
        // (DF-E1-M1) — proven identical across both isolated runs, and proven to leave zero output.
        assert.equal(runA.ok, false, `${moduleId} is expected to halt (DF-E1-M1) — update this test if that gap has closed`);
        assert.equal(runB.ok, false, `${moduleId} is expected to halt (DF-E1-M1) — update this test if that gap has closed`);
        assert.equal(runA.stage, 'inspect');
        assert.equal(runA.causeName, 'DecisionsNotFoundError');
        assert.deepEqual(
          { stage: runA.stage, causeName: runA.causeName, exitCode: runA.exitCode },
          { stage: runB.stage, causeName: runB.causeName, exitCode: runB.exitCode },
        );
        assert.equal(sha256Hex(runA.causeMessage), sha256Hex(runB.causeMessage));
        assert.deepEqual(await listFilesRelative(outBaseA), []);
        assert.deepEqual(await listFilesRelative(outBaseB), []);
      }
    } finally {
      await rm(outBaseA, { recursive: true, force: true });
      await rm(outBaseB, { recursive: true, force: true });
    }
  });
}

test('P6-T3: a third independent isolated run of the one live-succeeding pair (cbc_suite_v1) still matches the first two, file by file', async () => {
  const cbcPair = BATCH_PAIRS.find((p) => path.basename(p.module) === LIVE_SUCCEEDING_MODULE_ID);
  assert.ok(cbcPair, 'expected to find the cbc_suite_v1 pair in BATCH_PAIRS');

  const outBaseA = await makeScratchDir('third-a');
  const outBaseC = await makeScratchDir('third-c');
  try {
    const runA = await runBatchOnce([cbcPair], outBaseA);
    const runC = await runBatchOnce([cbcPair], outBaseC);
    assert.equal(runA.ok, true);
    assert.equal(runC.ok, true);

    const outDirA = runA.results[0].outDir;
    const outDirC = runC.results[0].outDir;
    const filesA = await listFilesRelative(outDirA);
    for (const relFile of filesA) {
      const bytesA = await readFile(path.join(outDirA, relFile));
      const bytesC = await readFile(path.join(outDirC, relFile));
      assert.equal(sha256Hex(bytesA), sha256Hex(bytesC), `${relFile} must remain identical on a third independent run`);
    }
  } finally {
    await rm(outBaseA, { recursive: true, force: true });
    await rm(outBaseC, { recursive: true, force: true });
  }
});

// =================================================================================================
// Section 3: the REAL, COMMITTED per-bundle evidence.json / evidence-assertions.json /
// unresolved.json for ALL 4 modules — the literal "per bundle" artifacts this task's own AC names
// — are byte-stable at rest (two independent reads each), and (for cbc_suite_v1) cross-checked
// against what a fresh, live `propose` run emits.
// =================================================================================================

for (const [moduleId, moduleDir] of Object.entries(MODULE_DIRS)) {
  test(`P6-T3: modules/${moduleId}/'s committed evidence.json and evidence-assertions.json are byte-stable across two independent reads`, async () => {
    for (const filename of ['evidence.json', 'evidence-assertions.json']) {
      const filePath = path.join(moduleDir, filename);
      const first = await readFile(filePath);
      const second = await readFile(filePath);
      assert.equal(sha256Hex(first), sha256Hex(second), `${moduleId}/${filename} must be SHA-256-identical across two independent reads`);
      assert.ok(first.length > 0, `${moduleId}/${filename} must not be empty`);
    }
  });

  test(`P6-T3: modules/${moduleId}/'s unresolved.json is byte-stable (or consistently, explicitly absent per R-P2) across two independent reads`, async () => {
    const filePath = path.join(moduleDir, 'unresolved.json');
    const first = await readRawOrMissing(filePath);
    const second = await readRawOrMissing(filePath);
    assert.equal(first.missing, second.missing, `${moduleId}/unresolved.json's presence/absence must itself be stable across two reads`);
    if (!first.missing) {
      assert.equal(sha256Hex(first.raw), sha256Hex(second.raw), `${moduleId}/unresolved.json must be SHA-256-identical across two independent reads`);
      const parsed = JSON.parse(first.raw.toString('utf8'));
      assert.ok(Array.isArray(parsed), `${moduleId}/unresolved.json must be a top-level JSON array`);
    }
  });
}

test("P6-T3: cbc_suite_v1's committed evidence.json/evidence-assertions.json are byte-identical to what a fresh, live propose run emits for the same pair", async () => {
  const cbcPair = BATCH_PAIRS.find((p) => path.basename(p.module) === LIVE_SUCCEEDING_MODULE_ID);
  const outBase = await makeScratchDir('cross-check-committed-vs-live');
  try {
    const run = await runBatchOnce([cbcPair], outBase);
    assert.equal(run.ok, true);
    const outDir = run.results[0].outDir;

    for (const filename of ['evidence.json', 'evidence-assertions.json']) {
      const committed = await readFile(path.join(MODULE_DIRS.cbc_suite_v1, filename));
      const live = await readFile(path.join(outDir, filename));
      assert.equal(
        sha256Hex(committed),
        sha256Hex(live),
        `modules/cbc_suite_v1/${filename} (committed) must be byte-identical to propose's own freshly-emitted ${filename} (per propose.mjs's own documented "byte-verbatim copy" contract)`,
      );
    }
  } finally {
    await rm(outBase, { recursive: true, force: true });
  }
});

// =================================================================================================
// Section 4: the aggregate multi-bundle-conversion-report.json, run repeatedly — a genuine
// double-run proof over real repo state (each pair's real, committed
// `modules/<id>/unresolved.json`), not a re-hash of a cached single file.
//
// NOTE on `--out-base`: `buildBundleReportSection`'s `statusReason` field legitimately embeds the
// absolute `<outDir>/conversion-report.json` path it looked for and did not find (see
// `multi-bundle-report.mjs`'s own `readBundleConversionReport`) — this is real, documented report
// content (a human-readable "where I looked" trail), not an accidental non-determinism. Two
// `aggregate` runs against the SAME `--out-base` (the only way this verb is ever actually invoked
// in practice — there is one canonical `build/kb-pack/` root, `DEFAULT_OUT_BASE_DIR`) are the
// correct "same converter version, same inputs, run twice" comparison for a literal SHA-256 byte
// check; that is this section's primary proof. A supplementary check additionally proves every
// field OTHER than that expected, documented, location-dependent path substring is identical even
// across two entirely different `--out-base` locations, so the underlying data computation itself
// is proven independent of where its output happens to be written.
// =================================================================================================

test('P6-T3: two (then a third) aggregate runs into the SAME --out-base (the real, only way this verb is invoked in practice) produce a SHA-256-identical multi-bundle-conversion-report.json', async () => {
  const outBase = await makeScratchDir('aggregate-same-dir');
  try {
    const { result: exit1 } = await withCapturedStdout(() => runAggregate({ outBase }));
    const raw1 = await readFile(path.join(outBase, MULTI_BUNDLE_REPORT_FILENAME), 'utf8');
    const { result: exit2 } = await withCapturedStdout(() => runAggregate({ outBase }));
    const raw2 = await readFile(path.join(outBase, MULTI_BUNDLE_REPORT_FILENAME), 'utf8');
    const { result: exit3 } = await withCapturedStdout(() => runAggregate({ outBase }));
    const raw3 = await readFile(path.join(outBase, MULTI_BUNDLE_REPORT_FILENAME), 'utf8');

    assert.equal(exit1, 0);
    assert.equal(exit2, 0);
    assert.equal(exit3, 0);
    assert.equal(sha256Hex(raw1), sha256Hex(raw2), 'run 1 and run 2 must be SHA-256-identical');
    assert.equal(sha256Hex(raw2), sha256Hex(raw3), 'run 2 and run 3 must be SHA-256-identical (rules out a 2-run coincidence)');

    const report1 = JSON.parse(raw1);
    assert.equal(report1.bundlesTotal, 4);
    // Stable iteration order: bundles[] preserves BATCH_PAIRS' own declared order.
    assert.deepEqual(
      report1.bundles.map((b) => b.moduleId),
      BATCH_PAIRS.map(({ module }) => path.basename(module)),
    );
  } finally {
    await rm(outBase, { recursive: true, force: true });
  }
});

test("P6-T3: two aggregate runs into DIFFERENT --out-base locations produce identical report content once each location's own path is normalized out of statusReason", async () => {
  const outBaseA = await makeScratchDir('aggregate-diff-a');
  const outBaseB = await makeScratchDir('aggregate-diff-b');
  try {
    await withCapturedStdout(() => runAggregate({ outBase: outBaseA }));
    await withCapturedStdout(() => runAggregate({ outBase: outBaseB }));
    const reportA = JSON.parse(await readFile(path.join(outBaseA, MULTI_BUNDLE_REPORT_FILENAME), 'utf8'));
    const reportB = JSON.parse(await readFile(path.join(outBaseB, MULTI_BUNDLE_REPORT_FILENAME), 'utf8'));

    // Strip each run's own --out-base absolute path out of statusReason before comparing -- the
    // ONLY expected difference between two runs pointed at two different physical locations.
    const normalize = (report, outBase) => ({
      ...report,
      bundles: report.bundles.map((b) => ({
        ...b,
        statusReason: typeof b.statusReason === 'string' ? b.statusReason.split(outBase).join('<OUT_BASE>') : b.statusReason,
      })),
    });
    assert.deepEqual(
      normalize(reportA, outBaseA),
      normalize(reportB, outBaseB),
      'every field of the aggregate report other than the expected, documented --out-base-dependent path substring must be identical regardless of where the report is written',
    );
  } finally {
    await rm(outBaseA, { recursive: true, force: true });
    await rm(outBaseB, { recursive: true, force: true });
  }
});

// =================================================================================================
// Sanity: the digest comparison used throughout this file is non-vacuous — it would actually catch
// a real difference (mirrors the same sanity check in tests/ef-converter-determinism.test.mjs).
// =================================================================================================

test('sanity: sha256Hex distinguishes different content (the equality checks above are not vacuously true)', () => {
  assert.notEqual(sha256Hex('a'), sha256Hex('b'));
  assert.equal(sha256Hex('a'), sha256Hex('a'));
  assert.notEqual(sha256Hex(Buffer.from('x')), sha256Hex(Buffer.from('y')));
});
