// tests/ef-multi-bundle-determinism.test.mjs — multi-bundle-conversion-e1 Phase 6, row P6-T3
// (FR-17; decisions block Risk 5 mitigation).
//
// Task acceptance criteria (phase-5-6-7-projection-determinism-docs.md, row P6-T3):
//   "Two independent full-batch runs produce SHA-256-identical output for all 4 bundles'
//    evidence.json/evidence-assertions.json/unresolved.json and the aggregate report; test is
//    part of `npm run check`." (This file matches `tests/*.test.mjs`, already run by `npm test`,
//    itself the first step of `npm run check` — no `package.json` change is needed to wire it in.)
//
// HONESTY NOTE, load-bearing (read before editing this file): UPDATED for multi-bundle-conversion-
// e1-finish Phase 4 (Step 0/MBF-5 CLOSED). Prior phases: modules/anemia/, modules/kidney_suite_v1/,
// and modules/growth_suite_v1/ each gained an authoring-decisions.yaml (all 3
// `drafted_pending_human_approval` — non-approving). Phase 4's Step 0 fix gates
// `computeTestCorpusHash` on the emission gate's own `permitted` value (exactly parallel to
// `writeStagedRulesAndProvenance`'s existing conditional call): a module with no hand-authored
// rule content never calls `computeTestCorpusHash` at all, so it can no longer halt over a missing
// test corpus it was never going to need. As a result, ALL 4 named `BATCH_PAIRS` now complete
// `inspect -> verify -> propose` end to end: `rf-cbc-002` -> `cbc_suite_v1` (rules.json emitted,
// its decisions are `approved_for_rule_draft`) and the other 3 (`rf-ev-001` -> `anemia`,
// `rf-kid-001` -> `kidney_suite_v1`, `rf-gro-002` -> `growth_suite_v1`) are each refused at the
// emission gate for rule content — a non-fatal governance refusal; every evidence-layer artifact
// (including `release-manifest.unsigned.json`, with `testCorpusHash: null`) is written, but no
// `rules.json`/`rule-provenance.json`. `propose.mjs`'s own header comment still states it "invents
// nothing new about clinical content" for these 3 modules — their completion above is a refusal of
// that same kind, not an exception to it. This is why `modules/anemia/evidence-assertions.json` and
// `modules/{kidney_suite_v1,growth_suite_v1}/{evidence.json,evidence-assertions.json,
// unresolved.json}` were projected by one-off, ephemeral, uncommitted generator scripts (earlier
// phases — see each commit's own message) rather than by a live, re-invokable `propose` call —
// those files are the real, final, COMMITTED "per-bundle emitted output" for this pass for those 3
// bundles, not a build artifact this test can regenerate on demand (Section 3 below still treats
// them as at-rest-only for that reason).
//
// Given that real, documented constraint, this file proves the P6-T3/P4-T3 determinism claim in
// full, honestly, via four complementary angles, none of which overstates what the converter can
// actually do today:
//
//   1. The REAL, canonical `BATCH_PAIRS` batch (unmodified, default order, same converter build),
//      run twice into two fresh, independent output directories, completes ALL 4 pairs, with
//      byte-identical output for every emitted file across both runs (Section 1) — the
//      reproducibility claim is true for 4/4 (P4-T3, FR-F15), not merely "a test passed once."
//   2. EVERY one of the 4 named pairs, run in ISOLATION, twice (three times for `cbc_suite_v1`),
//      into fresh independent output directories (Section 2) — ALL 4 pairs complete `propose` end
//      to end (`cbc_suite_v1` with rules.json; the other 3 refused-but-complete, with no
//      rules.json) and are each proven SHA-256 byte-identical across every emitted file, including
//      `evidence.json`/`evidence-assertions.json`/`release-manifest.unsigned.json`/
//      `semantic-diff.json`, across all runs. This test fails loudly (via the exhaustive
//      `MODULE_IDS_COVERED` cross-check below) if any of the 4 modules is silently skipped from the
//      per-pair comparison.
//   3. Section 3 is an AT-REST INTEGRITY CHECK, NOT a determinism proof: the REAL, COMMITTED
//      per-bundle `evidence.json`/`evidence-assertions.json`/`unresolved.json` for ALL 4 modules
//      are confirmed non-corrupt/non-truncated via two reads each (reading an unmodified file
//      twice in one process is tautologically identical and proves nothing about the converter's
//      determinism). The one genuinely determinism-relevant check in this section is for
//      `cbc_suite_v1` (the one live-executable pair): its committed files are proven identical to
//      what a fresh, live `propose` run emits.
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

// The one BATCH_PAIRS entry with hand-authored, approved rule content (its decisions are
// `approved_for_rule_draft`) -- the other 3 modules are refused at the emission gate for rule
// content (multi-bundle-conversion-e1-finish Phase 4, MBF-5 CLOSED: ALL 4 now complete `propose`
// end to end regardless of this distinction; only cbc_suite_v1 emits rules.json/rule-provenance.
// json). Kept for the cbc_suite_v1-specific tests below (Section 2's third-run check, Section 3's
// committed-vs-live cross-check).
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

/** Suppresses (discards, never accumulates) `process.stdout.write` while `fn` runs, then restores
 * it -- used for calls whose printed volume can be large (a real, all-4-pair batch run prints 12+
 * verb summaries) and whose captured TEXT this file never needs to inspect (only `fn`'s own return
 * value / thrown error matter here). Buffering that much captured text via `withCapturedStdout`
 * above is what this file's own P4-T3 rewrite discovered can destabilize this suite's TAP
 * reporting (see `tests/ef-converter-batch.test.mjs`'s own P4-T1 test for the same finding). */
async function withSuppressedStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    return await fn();
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
    const results = await withSuppressedStdout(() => runBatch({ pairs, ruleSchemaPath: RULE_SCHEMA_PATH, outBaseDir }));
    return { ok: true, results };
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

// multi-bundle-conversion-e1-finish Phase 4 (P4-T3, FR-F15, MBF-5 CLOSED): the real batch now
// completes ALL 4 named pairs end to end -- `cbc_suite_v1` emits its 4 rules; `anemia`/
// `kidney_suite_v1`/`growth_suite_v1` are each refused at the emission gate for rule content (a
// non-fatal governance refusal), with every evidence-layer artifact written. This test proves the
// reproducibility claim is true for 4/4 (this plan's own Phase 4 exit gate wording): two
// independent full-batch runs, same converter build, same committed fixture inputs, produce
// EXACTLY the same set of files, SHA-256-identical byte for byte, for every one of the 4 modules --
// asserted explicitly per-module (never a bare "the directories matched") so this test fails loudly
// if any of the 4 modules were ever silently skipped from the comparison.
test('P4-T3: two independent full-batch runs over the real, canonical BATCH_PAIRS complete ALL 4 pairs, byte-identical file for file', async () => {
  const outBaseA = await makeScratchDir('full-a');
  const outBaseB = await makeScratchDir('full-b');
  try {
    const runA = await runBatchOnce(BATCH_PAIRS, outBaseA);
    const runB = await runBatchOnce(BATCH_PAIRS, outBaseB);

    // Asserted explicitly here, not assumed, so a future regression (a new halt reappearing) fails
    // this test loudly rather than letting a stale "it completes" assumption silently pass.
    assert.equal(runA.ok, true, 'run A is expected to complete all 4 pairs (MBF-5 closed) — update this test if a new halt was introduced');
    assert.equal(runB.ok, true, 'run B is expected to complete all 4 pairs (MBF-5 closed) — update this test if a new halt was introduced');
    assert.equal(runA.results.length, 4);
    assert.equal(runB.results.length, 4);

    const expectedModuleIds = ['anemia', 'cbc_suite_v1', 'kidney_suite_v1', 'growth_suite_v1'];
    assert.deepEqual(runA.results.map((r) => r.moduleId), expectedModuleIds);
    assert.deepEqual(runB.results.map((r) => r.moduleId), expectedModuleIds);
    for (const result of [...runA.results, ...runB.results]) {
      assert.equal(result.status, 'succeeded');
    }

    // Every file either run emitted must be exactly the same set, AND byte-identical, across the
    // two independent runs -- a genuine determinism proof over everything the batch actually
    // produced, for ALL 4 modules, not merely for whichever pairs used to complete before a halt.
    const filesA = await listFilesRelative(outBaseA);
    const filesB = await listFilesRelative(outBaseB);
    assert.ok(filesA.length > 0);
    assert.deepEqual(filesA, filesB, 'both full-batch runs must emit exactly the same set of files');

    // Exhaustive per-module coverage check (FR-F15's own "fails loudly if any module is silently
    // skipped" AC): every one of the 4 module ids must own at least one file in the output, and the
    // union of module prefixes actually covered must equal the full expected set exactly.
    const moduleIdsCovered = new Set(filesA.map((relFile) => relFile.split(path.sep)[0]));
    assert.deepEqual(
      [...moduleIdsCovered].sort(),
      [...expectedModuleIds].sort(),
      'every one of the 4 modules must be represented in the batch output -- none silently skipped',
    );
    for (const moduleId of expectedModuleIds) {
      assert.ok(filesA.some((f) => f.startsWith(`${moduleId}/`) && f.endsWith('conversion-report.json')), `${moduleId} must have completed propose (conversion-report.json present)`);
    }
    assert.ok(filesA.some((f) => f.startsWith('cbc_suite_v1/') && f.endsWith('rules.json')), 'cbc_suite_v1 completed, including rules.json');
    for (const moduleId of ['anemia', 'kidney_suite_v1', 'growth_suite_v1']) {
      assert.ok(!filesA.some((f) => f.startsWith(`${moduleId}/`) && f.endsWith('rules.json')), `${moduleId} must never emit rules.json (refused at the emission gate)`);
    }

    for (const relFile of filesA) {
      const bytesA = await readFile(path.join(outBaseA, relFile));
      const bytesB = await readFile(path.join(outBaseB, relFile));
      assert.ok(bytesA.equals(bytesB), `${relFile} must be byte-identical across two independent full-batch runs`);
    }
  } finally {
    await rm(outBaseA, { recursive: true, force: true });
    await rm(outBaseB, { recursive: true, force: true });
  }
});

// =================================================================================================
// Section 2: EVERY one of the 4 named pairs, run in isolation, twice (three times for cbc_suite_v1)
// — the strongest per-bundle proof this converter can actually exercise live today.
//
// multi-bundle-conversion-e1-finish Phase 4 (P4-T3, MBF-5 CLOSED): ALL 4 pairs now complete
// `propose` end to end in isolation -- `cbc_suite_v1` fully (rules.json emitted); the other 3
// refused at the emission gate for rule content (non-fatal governance refusal, no rules.json/
// rule-provenance.json, but every evidence-layer artifact + release-manifest.unsigned.json +
// conversion-report.json + semantic-diff.json IS written, with testCorpusHash: null). A tracking
// Set (`moduleIdsExercised`) proves, after the loop, that all 4 module ids were genuinely iterated
// -- this test fails loudly if any of the 4 modules were ever silently skipped from this per-pair
// comparison (FR-F15's own binding AC).
// =================================================================================================

const moduleIdsExercised = new Set();

for (const pair of BATCH_PAIRS) {
  const moduleId = path.basename(pair.module);
  moduleIdsExercised.add(moduleId);
  const isFullySucceeding = moduleId === LIVE_SUCCEEDING_MODULE_ID;

  test(`P4-T3: pair "${moduleId}" (${pair.fixture}) run in isolation twice produces a deterministic outcome`, async () => {
    const outBaseA = await makeScratchDir(`pair-${moduleId}-a`);
    const outBaseB = await makeScratchDir(`pair-${moduleId}-b`);
    try {
      const runA = await runBatchOnce([pair], outBaseA);
      const runB = await runBatchOnce([pair], outBaseB);

      assert.equal(runA.ok, true, `${moduleId} is expected to complete propose end to end (MBF-5 closed)`);
      assert.equal(runB.ok, true, `${moduleId} is expected to complete propose end to end (MBF-5 closed)`);
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
      assert.ok(filesA.includes('conversion-report.json'));
      assert.ok(filesA.includes('release-manifest.unsigned.json'));
      assert.ok(filesA.includes('semantic-diff.json'));
      if (isFullySucceeding) {
        assert.ok(filesA.includes('rules.json'), `${moduleId} has approved decisions -- rules.json is emitted`);
        assert.ok(filesA.includes('rule-provenance.json'));
      } else {
        // anemia/kidney_suite_v1/growth_suite_v1: refused at the emission gate for rule content
        // (non-fatal governance refusal) -- no rules.json/rule-provenance.json, even though
        // propose otherwise completed. Step 0 fix (MBF-5): testCorpusHash is honestly null.
        assert.ok(!filesA.includes('rules.json'), `${moduleId} is refused at the emission gate -- no rules.json`);
        assert.ok(!filesA.includes('rule-provenance.json'));
        const releaseManifest = JSON.parse(await readFile(path.join(outDirA, 'release-manifest.unsigned.json'), 'utf8'));
        assert.equal(releaseManifest.testCorpusHash, null);
      }

      const mismatches = [];
      for (const relFile of filesA) {
        const bytesA = await readFile(path.join(outDirA, relFile));
        const bytesB = await readFile(path.join(outDirB, relFile));
        const hashA = sha256Hex(bytesA);
        const hashB = sha256Hex(bytesB);
        if (hashA !== hashB) mismatches.push({ relFile, hashA, hashB });
      }
      assert.deepEqual(mismatches, [], `every emitted file for "${moduleId}" must be SHA-256-identical across two isolated runs; mismatches: ${JSON.stringify(mismatches)}`);
    } finally {
      await rm(outBaseA, { recursive: true, force: true });
      await rm(outBaseB, { recursive: true, force: true });
    }
  });
}

test('P4-T3: the per-pair isolation loop above genuinely exercised all 4 named modules (none silently skipped)', () => {
  assert.deepEqual(
    [...moduleIdsExercised].sort(),
    ['anemia', 'cbc_suite_v1', 'growth_suite_v1', 'kidney_suite_v1'],
  );
});

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
// Section 3: at-rest integrity check — NOT a determinism proof. Reading an unmodified, committed
// file twice in the same process is tautologically identical and proves nothing about the
// converter's determinism (a determinism proof requires two independent RUNS producing the same
// output, which is what Sections 1/2/4 actually do). This section only guards against accidental
// corruption/truncation of the REAL, COMMITTED per-bundle evidence.json / evidence-assertions.json
// / unresolved.json for ALL 4 modules at rest, and (for cbc_suite_v1) cross-checks the committed
// files against what a fresh, live `propose` run emits — that cross-check IS a real determinism-
// relevant proof (Section 3's final test, below); the "read twice" checks are not.
// =================================================================================================

for (const [moduleId, moduleDir] of Object.entries(MODULE_DIRS)) {
  test(`P6-T3: at-rest integrity check (NOT a determinism proof) -- modules/${moduleId}/'s committed evidence.json and evidence-assertions.json read back identically twice`, async () => {
    for (const filename of ['evidence.json', 'evidence-assertions.json']) {
      const filePath = path.join(moduleDir, filename);
      const first = await readFile(filePath);
      const second = await readFile(filePath);
      assert.equal(sha256Hex(first), sha256Hex(second), `${moduleId}/${filename} must read back identically twice (at-rest integrity, not a determinism proof)`);
      assert.ok(first.length > 0, `${moduleId}/${filename} must not be empty`);
    }
  });

  test(`P6-T3: at-rest integrity check (NOT a determinism proof) -- modules/${moduleId}/'s unresolved.json is stable (or consistently, explicitly absent per R-P2) across two reads`, async () => {
    const filePath = path.join(moduleDir, 'unresolved.json');
    const first = await readRawOrMissing(filePath);
    const second = await readRawOrMissing(filePath);
    assert.equal(first.missing, second.missing, `${moduleId}/unresolved.json's presence/absence must itself be stable across two reads`);
    if (!first.missing) {
      assert.equal(sha256Hex(first.raw), sha256Hex(second.raw), `${moduleId}/unresolved.json must read back identically twice (at-rest integrity, not a determinism proof)`);
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
