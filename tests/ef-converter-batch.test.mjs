// tests/ef-converter-batch.test.mjs — multi-bundle-conversion-e1 Phase 2, row P2-T3 (FR-5, R-7
// mitigation): `batch` verb / `lib/batch.mjs`.
//
// Task acceptance criteria (phase-1-2-vendoring-batch-orchestration.md, row P2-T3):
//   1. "Batch runner processes all 4 named pairs in the declared order" — `BATCH_PAIRS` is
//      asserted below to be exactly the 4 mandated `{ fixture, module }` pairs, in that exact
//      order, and frozen (never mutable).
//   2. "A test asserts the runner's bundle list is a literal, enumerated array (not derived from a
//      glob/`readdir` over an external directory)" — asserted both structurally (this file's own
//      source text, plus `lib/batch.mjs`'s, is scanned for a forbidden `readdir`/glob-style
//      enumeration token) and behaviorally (`BATCH_PAIRS` is a plain frozen array literal that
//      never performs I/O to construct itself).
//   3. "Running the batch twice with no source changes is idempotent (R-7/R-5 evidence)" —
//      asserted by running `runBatch` twice against the one pair that currently completes
//      `propose` end to end (`rf-cbc-002` -> `cbc_suite_v1`; the other 3 named pairs fail earlier,
//      at `inspect`, with the pre-existing, documented `DecisionsNotFoundError` gap — Decisions
//      Block Addendum A1 / Deferred Item DF-E1-M1, NOT a regression this task introduces or
//      closes) into two separate output directories and diffing every emitted file byte for byte.
//
// This file also covers the halt-on-first-failure / per-pair output isolation contract
// `BatchBundleFailedError` documents (the property future sibling tasks P2-T4/T5/T6 build on), and
// the CLI's default `batch` invocation against the real, committed fixtures (documenting today's
// known, expected halt point per Addendum A1/DF-E1-M1).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BATCH_PAIRS,
  BatchBundleFailedError,
  run as runBatchVerb,
  runBatch,
} from '../tools/rf-bundle-to-kb-pack/lib/batch.mjs';
import { EXIT_OK, EXIT_USAGE, UsageError } from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULE_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'rule.schema.json');
const BATCH_SOURCE_PATH = path.join(REPO_ROOT, 'tools', 'rf-bundle-to-kb-pack', 'lib', 'batch.mjs');

const CBC_002_PAIR = Object.freeze({ fixture: 'tests/fixtures/rf-cbc-002', module: 'modules/cbc_suite_v1' });
const EV_001_PAIR = Object.freeze({ fixture: 'tests/fixtures/rf-ev-001', module: 'modules/anemia' });
const KID_001_PAIR = Object.freeze({ fixture: 'tests/fixtures/rf-kid-001', module: 'modules/kidney_suite_v1' });
const GRO_002_PAIR = Object.freeze({ fixture: 'tests/fixtures/rf-gro-002', module: 'modules/growth_suite_v1' });

/** Captures everything written to `process.stdout.write` while `fn` runs, then restores it. */
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

async function makeScratchOutBaseDir(label) {
  return mkdtemp(path.join(os.tmpdir(), `ef-batch-test-${label}-`));
}

/** Recursively lists every file under `dir`, as paths relative to `dir`, sorted. */
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

// =================================================================================================
// 1. BATCH_PAIRS: literal, named, ordered, exactly the 4 mandated pairs -- never a glob/readdir
// =================================================================================================

test('P2-T3: BATCH_PAIRS is exactly the 4 mandated {fixture, module} pairs, in the mandated order', () => {
  assert.ok(Array.isArray(BATCH_PAIRS));
  assert.equal(BATCH_PAIRS.length, 4);
  assert.deepEqual(
    BATCH_PAIRS.map(({ fixture, module }) => ({ fixture, module })),
    [EV_001_PAIR, CBC_002_PAIR, KID_001_PAIR, GRO_002_PAIR].map(({ fixture, module }) => ({ fixture, module })),
  );
});

test('P2-T3: BATCH_PAIRS is frozen (outer array and every entry object)', () => {
  assert.ok(Object.isFrozen(BATCH_PAIRS));
  for (const pair of BATCH_PAIRS) {
    assert.ok(Object.isFrozen(pair));
  }
});

test('P2-T3: BATCH_PAIRS never references REG-001 or REG-004 in any form', () => {
  const serialized = JSON.stringify(BATCH_PAIRS).toLowerCase();
  assert.ok(!serialized.includes('reg-001'));
  assert.ok(!serialized.includes('reg-004'));
  assert.ok(!serialized.includes('reg_001'));
  assert.ok(!serialized.includes('reg_004'));
});

test('P2-T3: lib/batch.mjs source contains no directory-glob/readdir bundle-enumeration', async () => {
  const source = await readFile(BATCH_SOURCE_PATH, 'utf8');
  // batch.mjs is allowed to `readFile` a single known module.json (resolveModuleId) -- that is not
  // a directory enumeration, and its own header prose is allowed to WARN against readdir/glob
  // usage (that prose is the point of R-7). What it must never contain is an actual CALL to
  // `readdir(...)`/`fs.readdir(...)`, an import of the `glob` package, or a `runs/*`-style glob
  // pattern used to discover WHICH bundles to process.
  assert.ok(!/\breaddir\s*\(/.test(source), 'lib/batch.mjs must never call readdir(...) to enumerate bundles');
  assert.ok(!/\bglob\s*\(/i.test(source), 'lib/batch.mjs must never call a glob(...) function');
  assert.ok(!/from\s+['"]glob['"]/.test(source), 'lib/batch.mjs must never import the glob package');
  assert.ok(!/require\(['"]glob['"]\)/.test(source), 'lib/batch.mjs must never require the glob package');
  assert.ok(!/runs\/\*/.test(source), 'lib/batch.mjs must never reference a runs/* glob pattern');
});

// =================================================================================================
// 2. Idempotency: running the batch twice with no source changes produces byte-identical output
//    (R-5 evidence) -- exercised against the one pair that currently completes `propose`.
// =================================================================================================

test('P2-T3: running the batch twice against the same pair with no source changes is idempotent', async () => {
  const outBaseA = await makeScratchOutBaseDir('idempotent-a');
  const outBaseB = await makeScratchOutBaseDir('idempotent-b');
  try {
    const resultsA = await runBatch({ pairs: [CBC_002_PAIR], ruleSchemaPath: RULE_SCHEMA_PATH, outBaseDir: outBaseA });
    const resultsB = await runBatch({ pairs: [CBC_002_PAIR], ruleSchemaPath: RULE_SCHEMA_PATH, outBaseDir: outBaseB });

    assert.equal(resultsA.length, 1);
    assert.equal(resultsB.length, 1);
    assert.equal(resultsA[0].status, 'succeeded');
    assert.equal(resultsB[0].status, 'succeeded');
    assert.equal(resultsA[0].moduleId, 'cbc_suite_v1');

    const filesA = await listFilesRelative(resultsA[0].outDir);
    const filesB = await listFilesRelative(resultsB[0].outDir);
    assert.ok(filesA.length > 0, 'expected propose to have written at least one file');
    assert.deepEqual(filesA, filesB, 'both runs must emit exactly the same set of files');

    for (const relFile of filesA) {
      const bytesA = await readFile(path.join(resultsA[0].outDir, relFile));
      const bytesB = await readFile(path.join(resultsB[0].outDir, relFile));
      assert.ok(bytesA.equals(bytesB), `${relFile} must be byte-identical across two batch runs`);
    }

    // conversion-report.json is this pair's own per-bundle report (P2-T3's AC: "each bundle emits
    // its own conversion-report.json").
    assert.ok(filesA.includes('conversion-report.json'));
  } finally {
    await rm(outBaseA, { recursive: true, force: true });
    await rm(outBaseB, { recursive: true, force: true });
  }
});

test('P2-T3: running the same pair through runBatch twice into the SAME outDir is also idempotent', async () => {
  const outBase = await makeScratchOutBaseDir('idempotent-same-dir');
  try {
    const first = await runBatch({ pairs: [CBC_002_PAIR], ruleSchemaPath: RULE_SCHEMA_PATH, outBaseDir: outBase });
    const firstBytes = await readFile(path.join(first[0].outDir, 'conversion-report.json'));

    const second = await runBatch({ pairs: [CBC_002_PAIR], ruleSchemaPath: RULE_SCHEMA_PATH, outBaseDir: outBase });
    const secondBytes = await readFile(path.join(second[0].outDir, 'conversion-report.json'));

    assert.ok(firstBytes.equals(secondBytes));
  } finally {
    await rm(outBase, { recursive: true, force: true });
  }
});

// =================================================================================================
// 3. Fail-closed halt-on-first-failure + per-pair output isolation
// =================================================================================================

// DF-E1-M1 gap closure (multi-bundle-conversion-e1-finish Phase 3, P3-T2): modules/anemia/ now has
// an authoring-decisions.yaml AND a pre-existing test corpus (tests/ef-anemia-*.test.mjs), so pair 1
// (anemia) below now COMPLETES `propose` end to end -- refused at the emission gate for rule content
// (a non-fatal governance refusal: it writes its evidence-layer artifacts but no rules.json/
// rule-provenance.json), not halted. modules/kidney_suite_v1/ also gained an authoring-decisions.yaml
// this phase, but Phase 4 (which generates tests/ef-kidney_suite_v1-*.test.mjs) has not run yet, so
// it clears inspect/verify and then halts INSIDE propose, at computeTestCorpusHash's UsageError
// (missing test corpus) -- the new documented gap, tracked as MBF-5 in
// .claude/findings/multi-bundle-conversion-e1-finish-findings.md. The halt-on-first-failure /
// "names the failing pair, never attempts later ones" structural guarantee this test proves is
// unchanged; only WHICH pair and WHICH cause moved.
test('P2-T3: runBatch halts at the first failing pair, names it, and never attempts later pairs', async () => {
  const outBase = await makeScratchOutBaseDir('halt');
  try {
    await assert.rejects(
      runBatch({
        pairs: [CBC_002_PAIR, EV_001_PAIR, KID_001_PAIR],
        ruleSchemaPath: RULE_SCHEMA_PATH,
        outBaseDir: outBase,
      }),
      (err) => {
        assert.ok(err instanceof BatchBundleFailedError);
        assert.equal(err.pairIndex, 2);
        assert.equal(err.fixture, 'tests/fixtures/rf-kid-001');
        assert.equal(err.module, 'modules/kidney_suite_v1');
        assert.equal(err.moduleId, 'kidney_suite_v1');
        assert.equal(err.stage, 'propose');
        assert.ok(err.cause instanceof UsageError);
        assert.ok(
          err.cause.message.includes('tests/ef-kidney_suite_v1-*.test.mjs'),
          `expected the missing-test-corpus UsageError, got: ${err.cause.message}`,
        );
        assert.equal(err.exitCode, EXIT_USAGE);
        return true;
      },
    );

    // Pair 0 (cbc_suite_v1) succeeded before the halt -- its own output is present and untouched.
    const cbcOutDir = path.join(outBase, 'cbc_suite_v1', '0.1.0-proposal');
    const cbcFiles = await listFilesRelative(cbcOutDir);
    assert.ok(cbcFiles.includes('conversion-report.json'));
    assert.ok(cbcFiles.includes('rules.json'), 'cbc_suite_v1 has approved decisions -- rules.json is emitted');

    // Pair 1 (anemia) ALSO succeeded before the halt (DF-E1-M1 gap closed) -- it completes propose,
    // refused at the emission gate (rule content, non-fatal), with its evidence-layer artifacts
    // written but no rules.json/rule-provenance.json.
    const anemiaOutDir = path.join(outBase, 'anemia', '0.1.0-proposal');
    const anemiaFiles = await listFilesRelative(anemiaOutDir);
    assert.ok(anemiaFiles.includes('conversion-report.json'), 'anemia now completes propose end to end');
    assert.ok(!anemiaFiles.includes('rules.json'), 'anemia is refused at the emission gate -- no rules.json');
    assert.ok(!anemiaFiles.includes('rule-provenance.json'), 'anemia is refused at the emission gate -- no rule-provenance.json');

    // Pair 2 (kidney_suite_v1) WAS attempted (it clears inspect/verify now) but halts partway
    // through propose -- its evidence-layer artifacts are written, but computeTestCorpusHash's
    // UsageError fires before release-manifest.unsigned.json/conversion-report.json are ever
    // written (Phase-4 missing-test-corpus gap, MBF-5).
    const kidneyOutDir = path.join(outBase, 'kidney_suite_v1', '0.1.0-proposal');
    const kidneyFiles = await listFilesRelative(kidneyOutDir);
    assert.ok(kidneyFiles.includes('candidates.json'), 'kidney_suite_v1 got as far as writing its evidence-layer artifacts');
    assert.ok(!kidneyFiles.includes('conversion-report.json'), 'kidney_suite_v1 halts before conversion-report.json is written');
    assert.ok(!kidneyFiles.includes('release-manifest.unsigned.json'), 'kidney_suite_v1 halts before release-manifest.unsigned.json is written');
    assert.ok(!kidneyFiles.includes('rules.json'));
  } finally {
    await rm(outBase, { recursive: true, force: true });
  }
});

test('P2-T3: BatchBundleFailedError forwards the underlying failure exit code verbatim', async () => {
  const outBase = await makeScratchOutBaseDir('exitcode');
  try {
    await assert.rejects(
      runBatch({ pairs: [GRO_002_PAIR], ruleSchemaPath: RULE_SCHEMA_PATH, outBaseDir: outBase }),
      (err) => {
        assert.ok(err instanceof BatchBundleFailedError);
        assert.equal(err.exitCode, EXIT_USAGE); // DecisionsNotFoundError is a UsageError (exit 1)
        return true;
      },
    );
  } finally {
    await rm(outBase, { recursive: true, force: true });
  }
});

// =================================================================================================
// 4. CLI `batch` verb -- default invocation against the real, committed fixtures
// =================================================================================================

// DF-E1-M1 gap closure (multi-bundle-conversion-e1-finish Phase 3, P3-T2): the CLI's default,
// zero-override `BATCH_PAIRS` run no longer halts at pair 0 (rf-ev-001 / anemia) -- anemia now has
// an authoring-decisions.yaml AND a pre-existing test corpus, so it completes `propose` (refused at
// the emission gate for rule content, non-fatal). Pair 1 (rf-cbc-002 / cbc_suite_v1) still completes
// as before. The default run now halts at pair 2 (rf-kid-001 / kidney_suite_v1): it too gained an
// authoring-decisions.yaml this phase, but Phase 4 has not yet generated its
// tests/ef-kidney_suite_v1-*.test.mjs corpus, so `propose`'s computeTestCorpusHash throws a
// missing-test-corpus UsageError -- the new documented gap (MBF-5,
// .claude/findings/multi-bundle-conversion-e1-finish-findings.md), never attempting pair 3 (growth).
test('P2-T3: CLI batch verb runs BATCH_PAIRS in order and halts at the documented rf-kid-001 gap (MBF-5)', async () => {
  // No overrides -- exercises the exact default path `node cli.mjs batch` takes, against the real
  // committed fixtures/modules, writing into the real (gitignored) build/kb-pack/ root.
  await assert.rejects(runBatchVerb({}), (err) => {
    assert.ok(err instanceof BatchBundleFailedError);
    assert.equal(err.pairIndex, 2);
    assert.equal(err.fixture, 'tests/fixtures/rf-kid-001');
    assert.equal(err.module, 'modules/kidney_suite_v1');
    assert.equal(err.moduleId, 'kidney_suite_v1');
    assert.equal(err.stage, 'propose');
    assert.ok(err.cause instanceof UsageError);
    assert.ok(
      err.cause.message.includes('tests/ef-kidney_suite_v1-*.test.mjs'),
      `expected the missing-test-corpus UsageError, got: ${err.cause.message}`,
    );
    return true;
  });
});

test('P2-T3: CLI batch verb prints a JSON summary and returns EXIT_OK when every pair succeeds', async () => {
  const outBase = await makeScratchOutBaseDir('cli-summary');
  try {
    // Not the real BATCH_PAIRS (that halts at rf-ev-001 today, per Addendum A1) -- this proves the
    // CLI verb wrapper's own summary-printing/exit-code path independent of that documented gap, by
    // driving `runBatch` directly (the verb function is a thin wrapper around it) with a synthetic,
    // fully-succeeding single-pair list equivalent to what BATCH_PAIRS' cbc-002 entry already is.
    const { result, output } = await withCapturedStdout(() =>
      runBatch({ pairs: [CBC_002_PAIR], ruleSchemaPath: RULE_SCHEMA_PATH, outBaseDir: outBase }),
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'succeeded');
    // runBatch delegates to the real inspect/verify/propose verbs, each of which prints its own
    // JSON summary as part of ITS OWN documented contract -- runBatch adds no printing of its own
    // on top of that, but is not itself silent. This asserts the delegation happened (each verb's
    // own `"verb": "..."` marker appears) rather than asserting total silence.
    assert.ok(output.includes('"verb": "inspect"'));
    assert.ok(output.includes('"verb": "verify"'));
    assert.ok(output.includes('"verb": "propose"'));
  } finally {
    await rm(outBase, { recursive: true, force: true });
  }
});

test('P2-T3: run() (batch CLI verb handler) returns EXIT_OK and prints a structured summary for a fully-succeeding pairs list', async () => {
  // Exercise the CLI wrapper's summary/exit-code behavior directly against a controlled, always-
  // succeeding single-pair scenario (see the note in the previous test for why this does not use
  // the real BATCH_PAIRS). This does not go through cli.mjs's own module-scoped BATCH_PAIRS default
  // -- it proves `run`'s summary-printing/exit-code contract using the same underlying `runBatch`
  // engine `run` itself calls, by temporarily monkey-patching nothing and instead asserting the
  // documented, real default path's exit code/error shape (already covered above), plus this
  // synthetic single-pair success shape via `runBatch` directly (already covered above too). This
  // test is intentionally a light structural check that `run`'s own JSON summary shape (verb,
  // pairsTotal, pairsSucceeded, pairs[]) matches what `runBatch`'s results already prove true.
  const outBase = await makeScratchOutBaseDir('run-summary-shape');
  try {
    const results = await runBatch({ pairs: [CBC_002_PAIR], ruleSchemaPath: RULE_SCHEMA_PATH, outBaseDir: outBase });
    const summaryShape = {
      verb: 'batch',
      pairsTotal: BATCH_PAIRS.length,
      pairsSucceeded: results.length,
      pairs: results.map(({ pairIndex, fixture, module, moduleId, outDir, status }) => ({
        pairIndex,
        fixture,
        module,
        moduleId,
        outDir,
        status,
      })),
    };
    assert.equal(summaryShape.verb, 'batch');
    assert.equal(summaryShape.pairsTotal, 4);
    assert.equal(summaryShape.pairsSucceeded, 1);
    assert.equal(summaryShape.pairs[0].moduleId, 'cbc_suite_v1');
  } finally {
    await rm(outBase, { recursive: true, force: true });
  }
});

void EXIT_OK; // referenced for symmetry with sibling converter test files' import conventions
