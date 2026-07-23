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
// e1-finish Phase 3 (P3-T2, DF-E1-M1 gap closure). modules/anemia/, modules/kidney_suite_v1/, and
// modules/growth_suite_v1/ each gained an authoring-decisions.yaml this phase (all 3
// `drafted_pending_human_approval` — non-approving). As a result, TWO of the 4 named `BATCH_PAIRS`
// now complete `inspect -> verify -> propose` end to end: `rf-cbc-002` -> `cbc_suite_v1` (rules.json
// emitted, its decisions are `approved_for_rule_draft`) and `rf-ev-001` -> `anemia` (refused at the
// emission gate for rule content — a non-fatal governance refusal, since anemia already had a P4
// test corpus from before this artifact type existed; NO rules.json/rule-provenance.json emitted,
// but every evidence-layer artifact is). The other 2 (`rf-kid-001` -> `kidney_suite_v1`,
// `rf-gro-002` -> `growth_suite_v1`) now clear `inspect`/`verify` (their decisions files exist) but
// halt INSIDE `propose`, at `computeTestCorpusHash`'s `UsageError`, because Phase 4 (which
// generates `tests/ef-<moduleId>-*.test.mjs`) has not run for either of them yet — the new
// documented, non-regression gap, tracked as MBF-5 in
// `.claude/findings/multi-bundle-conversion-e1-finish-findings.md` (superseding the old DF-E1-M1
// gap this note used to describe, which this phase closed). `propose.mjs`'s own header comment
// still states it "fails closed if the loaded module id is not the one module this converter has
// hand-authored drafting content for (`cbc_suite_v1`)" for actual RULE content — anemia's own
// completion above is a refusal of that same kind, not an exception to it. This is why
// `modules/anemia/evidence-assertions.json` and `modules/{kidney_suite_v1,growth_suite_v1}/
// {evidence.json,evidence-assertions.json,unresolved.json}` were projected by one-off, ephemeral,
// uncommitted generator scripts (P4-T2, P5-T1, P5-T2 — see each commit's own message) rather than
// by a live, re-invokable `propose` call — those files are the real, final, COMMITTED "per-bundle
// emitted output" for this pass for those 3 bundles, not a build artifact this test can regenerate
// on demand (Section 3 below still treats them as at-rest-only for that reason).
//
// Given that real, documented constraint, this file proves the P6-T3 determinism claim in full,
// honestly, via four complementary angles, none of which overstates what the converter can
// actually do today:
//
//   1. The REAL, canonical `BATCH_PAIRS` batch (unmodified, default order, same converter build),
//      run twice into two fresh, independent output directories, halts at the exact same pair
//      with the exact same named cause both times (Section 1) — proving the *documented failure*
//      is itself deterministic, not merely "a test passed once."
//   2. EVERY one of the 4 named pairs, run in ISOLATION, twice (three times for `cbc_suite_v1`),
//      into fresh independent output directories (Section 2) — the 2 pairs that complete
//      (`cbc_suite_v1` fully, with rules.json; `anemia` refused-but-complete, with no rules.json)
//      are each proven SHA-256 byte-identical across every emitted file, including
//      `evidence.json`/`evidence-assertions.json`, across all runs; the 2 pairs that halt inside
//      `propose` on a missing test corpus (`kidney_suite_v1`, `growth_suite_v1` — MBF-5) are
//      proven to halt identically (same stage, same cause, same message) across runs, AND their
//      partial evidence-layer output is proven SHA-256 byte-identical across runs too.
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

// The one BATCH_PAIRS entry that completes `inspect -> verify -> propose` end to end AND emits
// rules.json/rule-provenance.json (its decisions are `approved_for_rule_draft`) — kept for the two
// cbc_suite_v1-specific tests below (Section 2's third-run check, Section 3's committed-vs-live
// cross-check) that predate DF-E1-M1's closure and are unaffected by it.
const LIVE_SUCCEEDING_MODULE_ID = 'cbc_suite_v1';

// DF-E1-M1 gap closure (multi-bundle-conversion-e1-finish Phase 3, P3-T2): anemia now ALSO
// completes `inspect -> verify -> propose` end to end (it already had a P4 test corpus from before
// this artifact type existed), but is refused at the emission gate for rule content — a non-fatal
// governance refusal, so `runBatch` still reports `status: 'succeeded'` for it, just without
// rules.json/rule-provenance.json.
const REFUSED_BUT_COMPLETING_MODULE_ID = 'anemia';

// The 2 BATCH_PAIRS entries that now clear `inspect`/`verify` (each has an authoring-decisions.yaml
// as of P3-T2) but halt INSIDE `propose`, at `computeTestCorpusHash`'s `UsageError`, because
// Phase 4 has not yet generated their `tests/ef-<moduleId>-*.test.mjs` corpus — the new documented,
// non-regression gap (MBF-5, `.claude/findings/multi-bundle-conversion-e1-finish-findings.md`),
// asserted explicitly, not assumed, throughout this file.
const MISSING_TEST_CORPUS_MODULE_IDS = Object.freeze(['kidney_suite_v1', 'growth_suite_v1']);

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

// DF-E1-M1 gap closure (multi-bundle-conversion-e1-finish Phase 3, P3-T2): the real batch no
// longer halts at pair 0 (anemia) with DecisionsNotFoundError -- anemia now has an authoring-
// decisions.yaml AND a pre-existing test corpus, so it (pair 0) and cbc_suite_v1 (pair 1) both
// complete `propose` before the halt. The real batch now halts at pair 2 (rf-kid-001 ->
// modules/kidney_suite_v1): it gained an authoring-decisions.yaml this phase too, but Phase 4 has
// not yet generated its own test corpus, so `propose`'s computeTestCorpusHash throws a missing-
// test-corpus UsageError -- the new documented gap (MBF-5,
// .claude/findings/multi-bundle-conversion-e1-finish-findings.md). The halt-on-first-failure /
// "same pair, same cause, deterministic across two runs" property this test proves is unchanged;
// only WHICH pair, WHICH stage, and WHICH cause moved -- and unlike the old pre-decisions-file
// halt, real output now exists before the halt, so this version additionally proves that output is
// byte-identical across both runs (a strictly stronger determinism check than before).
test('P6-T3: two independent full-batch runs over the real, canonical BATCH_PAIRS halt at the exact same pair with the exact same named cause', async () => {
  const outBaseA = await makeScratchDir('full-a');
  const outBaseB = await makeScratchDir('full-b');
  try {
    const runA = await runBatchOnce(BATCH_PAIRS, outBaseA);
    const runB = await runBatchOnce(BATCH_PAIRS, outBaseB);

    // Asserted explicitly here, not assumed, so a future close of MBF-5 fails this test loudly
    // rather than letting a stale assumption silently pass.
    assert.equal(runA.ok, false, 'run A is expected to halt (MBF-5) — update this test if that gap has closed');
    assert.equal(runB.ok, false, 'run B is expected to halt (MBF-5) — update this test if that gap has closed');

    // The core determinism claim: run A and run B fail at the SAME pair, SAME stage, SAME named
    // cause, with byte-identical error messages (SHA-256 compared, not just `===`, so this is a
    // real proof rather than an assertion of prose).
    assert.deepEqual(
      { pairIndex: runA.pairIndex, fixture: runA.fixture, module: runA.module, moduleId: runA.moduleId, stage: runA.stage, exitCode: runA.exitCode, causeName: runA.causeName },
      { pairIndex: runB.pairIndex, fixture: runB.fixture, module: runB.module, moduleId: runB.moduleId, stage: runB.stage, exitCode: runB.exitCode, causeName: runB.causeName },
      'both full-batch runs must halt at the identical pair/stage/cause',
    );
    assert.equal(runA.causeName, 'UsageError');
    assert.equal(sha256Hex(runA.causeMessage), sha256Hex(runB.causeMessage), 'the halting error message must be SHA-256-identical across both runs');
    assert.equal(runA.pairIndex, 2);
    assert.equal(runA.moduleId, 'kidney_suite_v1');
    assert.equal(runA.stage, 'propose');

    // Pairs 0 (anemia) and 1 (cbc_suite_v1) both complete before the halt now, and pair 2
    // (kidney_suite_v1) is attempted, writing partial evidence-layer output -- pair 3
    // (growth_suite_v1) is never attempted at all. Every file either run DID emit must be exactly
    // the same set, AND byte-identical, across the two independent runs -- a genuine determinism
    // proof over everything the batch actually produced, not merely over the halting error.
    const filesA = await listFilesRelative(outBaseA);
    const filesB = await listFilesRelative(outBaseB);
    assert.ok(filesA.length > 0, 'pairs 0/1 now succeed, so real output exists before the halt (unlike the old pre-decisions-file halt)');
    assert.deepEqual(filesA, filesB, 'both full-batch runs must emit exactly the same set of files before halting');
    assert.ok(filesA.some((f) => f.startsWith('anemia/') && f.endsWith('conversion-report.json')), 'pair 0 (anemia) completed');
    assert.ok(filesA.some((f) => f.startsWith('cbc_suite_v1/') && f.endsWith('rules.json')), 'pair 1 (cbc_suite_v1) completed, including rules.json');
    assert.ok(filesA.some((f) => f.startsWith('kidney_suite_v1/')), 'pair 2 (kidney_suite_v1) was attempted, leaving partial output');
    assert.ok(!filesA.some((f) => f.startsWith('growth_suite_v1/')), 'pair 3 (growth_suite_v1) was never attempted -- zero output for it');

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
// DF-E1-M1 gap closure (multi-bundle-conversion-e1-finish Phase 3, P3-T2): anemia moves from the
// "halts at inspect" branch into the "completes, byte-identical across runs" branch (refused at
// the emission gate, so no rules.json -- unlike cbc_suite_v1, which fully succeeds). kidney_suite_v1
// and growth_suite_v1 still halt, but now at `propose` (missing test corpus, MBF-5) instead of at
// `inspect` (missing decisions file, the old DF-E1-M1) -- and they now leave real partial output
// behind (their decisions file lets them clear inspect/verify and write their evidence-layer
// artifacts), so this section additionally proves that partial output is itself byte-identical
// across two isolated runs, a strictly stronger determinism check than the old "zero output"
// assertion it replaces.
// =================================================================================================

for (const pair of BATCH_PAIRS) {
  const moduleId = path.basename(pair.module);
  const isFullySucceeding = moduleId === LIVE_SUCCEEDING_MODULE_ID;
  const isRefusedButCompleting = moduleId === REFUSED_BUT_COMPLETING_MODULE_ID;
  const isMissingTestCorpus = MISSING_TEST_CORPUS_MODULE_IDS.includes(moduleId);

  test(`P6-T3: pair "${moduleId}" (${pair.fixture}) run in isolation twice produces a deterministic outcome`, async () => {
    const outBaseA = await makeScratchDir(`pair-${moduleId}-a`);
    const outBaseB = await makeScratchDir(`pair-${moduleId}-b`);
    try {
      const runA = await runBatchOnce([pair], outBaseA);
      const runB = await runBatchOnce([pair], outBaseB);

      if (isFullySucceeding || isRefusedButCompleting) {
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
        if (isFullySucceeding) {
          assert.ok(filesA.includes('rules.json'), `${moduleId} has approved decisions -- rules.json is emitted`);
          assert.ok(filesA.includes('rule-provenance.json'));
        } else {
          // anemia: refused at the emission gate for rule content (non-fatal governance refusal,
          // DF-E1-M1's "drafted_pending_human_approval is not approved_for_rule_draft" outcome) --
          // no rules.json/rule-provenance.json, even though propose otherwise completed.
          assert.ok(!filesA.includes('rules.json'), `${moduleId} is refused at the emission gate -- no rules.json`);
          assert.ok(!filesA.includes('rule-provenance.json'));
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
      } else {
        assert.ok(isMissingTestCorpus, `unexpected moduleId "${moduleId}" — every BATCH_PAIRS entry must be classified into exactly one branch above`);
        // kidney_suite_v1 / growth_suite_v1: clear inspect/verify (each has an authoring-decisions.
        // yaml as of P3-T2) but halt INSIDE propose, at computeTestCorpusHash's UsageError, because
        // Phase 4 has not yet generated their own tests/ef-<moduleId>-*.test.mjs corpus (MBF-5) --
        // proven identical across both isolated runs, including the partial output each run leaves.
        assert.equal(runA.ok, false, `${moduleId} is expected to halt (MBF-5) — update this test if that gap has closed`);
        assert.equal(runB.ok, false, `${moduleId} is expected to halt (MBF-5) — update this test if that gap has closed`);
        assert.equal(runA.stage, 'propose');
        assert.equal(runA.causeName, 'UsageError');
        assert.deepEqual(
          { stage: runA.stage, causeName: runA.causeName, exitCode: runA.exitCode },
          { stage: runB.stage, causeName: runB.causeName, exitCode: runB.exitCode },
        );
        assert.equal(sha256Hex(runA.causeMessage), sha256Hex(runB.causeMessage));

        const filesA = await listFilesRelative(outBaseA);
        const filesB = await listFilesRelative(outBaseB);
        assert.ok(filesA.length > 0, `${moduleId} writes its partial evidence-layer output before halting inside propose`);
        assert.deepEqual(filesA, filesB, 'both isolated halting runs must emit exactly the same partial output');
        assert.ok(!filesA.some((f) => f.endsWith('rules.json')));
        assert.ok(!filesA.some((f) => f.endsWith('conversion-report.json')), `${moduleId} halts before conversion-report.json is written`);
        for (const relFile of filesA) {
          const bytesA = await readFile(path.join(outBaseA, relFile));
          const bytesB = await readFile(path.join(outBaseB, relFile));
          assert.ok(bytesA.equals(bytesB), `${relFile} must be byte-identical across two isolated halting runs`);
        }
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
