// tests/ef-converter-multi-bundle-report.test.mjs — multi-bundle-conversion-e1 Phase 2, row P2-T4
// (FR-5; R-P2 binding acceptance criterion).
//
// Task acceptance criteria (phase-1-2-vendoring-batch-orchestration.md, row P2-T4):
//   1. "Report schema documented (inline comment or short README section) with every field's
//      missing/empty representation stated" — see the header comment in
//      tools/rf-bundle-to-kb-pack/lib/multi-bundle-report.mjs plus the "Multi-bundle aggregate
//      report" section this task adds to tools/rf-bundle-to-kb-pack/README.md.
//   2. "A test asserts a bundle producing zero unresolved claims still emits `"unresolved": []`
//      (not an absent key) in its section of the report" — see section 3 below (both the pure
//      builder and a real, on-disk, ENOENT-driven zero-unresolved-claims path), and section 5's
//      literal-substring check on the actual bytes `run()` writes to disk.
//
// R-P2 (binding, repo-wide plan rule): every field this report introduces has a defined 0/empty
// representation — this suite proves that for every field this module's own header schema doc
// names (claimsProcessed, conflictsPreserved, unresolved/unresolvedCount, candidateScaffolds/
// candidateScaffoldsCount, rulesEmitted), not only "unresolved".

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MULTI_BUNDLE_REPORT_FILENAME,
  buildBundleReportSection,
  buildMultiBundleConversionReport,
  collectBundleReportSections,
  readBundleConversionReport,
  readFixtureClaimCount,
  readOptionalJsonArray,
  run as runAggregate,
} from '../tools/rf-bundle-to-kb-pack/lib/multi-bundle-report.mjs';
import { BATCH_PAIRS, runBatch } from '../tools/rf-bundle-to-kb-pack/lib/batch.mjs';
import { run as runPropose } from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { EXIT_OK } from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function makeScratchDir(label) {
  return mkdtemp(path.join(os.tmpdir(), `ef-multi-bundle-report-test-${label}-`));
}

async function withCapturedStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  const chunks = [];
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

// =================================================================================================
// 1. buildBundleReportSection — pure function, exact shape, every field defaults to 0/[]/null
// =================================================================================================

test('P2-T4: buildBundleReportSection emits exactly the documented per-bundle key set', () => {
  const section = buildBundleReportSection({
    pairIndex: 0,
    fixture: 'tests/fixtures/rf-ev-001',
    module: 'modules/anemia',
    moduleId: 'anemia',
  });
  assert.deepEqual(Object.keys(section).sort(), [
    'candidateScaffolds', 'candidateScaffoldsCount', 'claimsProcessed', 'conflictClasses',
    'conflictClassesCount', 'conflictsPreserved', 'fixture', 'module', 'moduleId', 'pairIndex',
    'rulesEmitted', 'status', 'statusReason', 'unresolved', 'unresolvedCount',
  ]);
});

test('P2-T4 AC: a bundle with no conversion-report.json still emits explicit 0/[] for every count field, never an absent key', () => {
  const section = buildBundleReportSection({
    pairIndex: 2,
    fixture: 'tests/fixtures/rf-kid-001',
    module: 'modules/kidney_suite_v1',
    moduleId: 'kidney_suite_v1',
  });
  assert.equal(section.status, 'not_available');
  assert.ok(typeof section.statusReason === 'string' && section.statusReason.length > 0);
  assert.equal(section.claimsProcessed, 0);
  assert.equal(section.conflictsPreserved, 0);
  // The literal AC text: a bundle producing zero unresolved claims still emits "unresolved": [],
  // never a missing key or `null`.
  assert.ok('unresolved' in section, 'unresolved key must be present, never omitted');
  assert.deepEqual(section.unresolved, []);
  assert.equal(section.unresolvedCount, 0);
  assert.ok('candidateScaffolds' in section);
  assert.deepEqual(section.candidateScaffolds, []);
  assert.equal(section.candidateScaffoldsCount, 0);
  assert.equal(section.rulesEmitted, 0);
  // Serialized bytes must literally contain the empty-array form, not merely the in-memory value.
  assert.ok(JSON.stringify(section).includes('"unresolved":[]'));
  assert.ok(JSON.stringify(section).includes('"candidateScaffolds":[]'));
});

test('P2-T4: buildBundleReportSection extracts real counts from a supplied conversion-report.json-shaped object', () => {
  const section = buildBundleReportSection({
    pairIndex: 1,
    fixture: 'tests/fixtures/rf-cbc-002',
    module: 'modules/cbc_suite_v1',
    moduleId: 'cbc_suite_v1',
    conversionReport: {
      schemaVersion: '1.0',
      moduleId: 'cbc_suite_v1',
      packVersion: '0.1.0-proposal',
      summary: {
        claimsTotal: 88,
        claimsEligibleForRuleEvidence: 27,
        claimsConflictVisible: 3,
        claimsExcluded: 58,
        sourcesExcluded: 0,
        candidatesExcluded: 0,
      },
      exclusions: { claims: [], sources: [], candidates: [] },
    },
  });
  assert.equal(section.status, 'reported');
  assert.equal(section.statusReason, null);
  assert.equal(section.claimsProcessed, 88);
  assert.equal(section.conflictsPreserved, 3);
});

test('P2-T4: buildBundleReportSection carries a non-empty unresolved/candidateScaffolds array through untouched when supplied', () => {
  const section = buildBundleReportSection({
    pairIndex: 2,
    fixture: 'tests/fixtures/rf-kid-001',
    module: 'modules/kidney_suite_v1',
    moduleId: 'kidney_suite_v1',
    unresolved: [{ claimId: 'clm_x', reason: 'no matching decision record' }],
    candidateScaffolds: [{ scaffoldId: 'scaf_1' }],
  });
  assert.equal(section.unresolvedCount, 1);
  assert.equal(section.candidateScaffoldsCount, 1);
  assert.deepEqual(section.unresolved, [{ claimId: 'clm_x', reason: 'no matching decision record' }]);
});

// =================================================================================================
// 2. buildMultiBundleConversionReport — aggregate rollup, exact shape, strict partition
// =================================================================================================

test('P2-T4: buildMultiBundleConversionReport emits exactly the documented top-level and aggregate key sets', () => {
  const report = buildMultiBundleConversionReport({
    bundles: [
      buildBundleReportSection({ pairIndex: 0, fixture: 'f0', module: 'm0', moduleId: 'm0' }),
    ],
  });
  assert.deepEqual(
    Object.keys(report).sort(),
    ['aggregate', 'bundles', 'bundlesTotal', 'conflictClasses', 'reportKind', 'schemaVersion'],
  );
  assert.equal(report.schemaVersion, '1.0');
  assert.equal(report.reportKind, 'multi-bundle-conversion-report');
  assert.deepEqual(Object.keys(report.aggregate).sort(), [
    'bundlesNotAvailable', 'bundlesReported', 'candidateScaffoldsCount', 'claimsProcessed',
    'conflictClassesCount', 'conflictsPreserved', 'rulesEmitted', 'unresolvedCount',
  ]);
});

test('P2-T4: buildMultiBundleConversionReport aggregate is a strict partition (reported + notAvailable === total) and sums correctly', () => {
  const reportedSection = buildBundleReportSection({
    pairIndex: 0,
    fixture: 'f0',
    module: 'm0',
    moduleId: 'm0',
    conversionReport: { summary: { claimsTotal: 10, claimsConflictVisible: 2 } },
    unresolved: [{ id: 'a' }],
    candidateScaffolds: [{ id: 'b' }, { id: 'c' }],
    rulesEmitted: 0,
  });
  const notAvailableSection = buildBundleReportSection({ pairIndex: 1, fixture: 'f1', module: 'm1', moduleId: 'm1' });

  const report = buildMultiBundleConversionReport({ bundles: [reportedSection, notAvailableSection] });

  assert.equal(report.bundlesTotal, 2);
  assert.equal(report.aggregate.bundlesReported, 1);
  assert.equal(report.aggregate.bundlesNotAvailable, 1);
  assert.equal(
    report.aggregate.bundlesReported + report.aggregate.bundlesNotAvailable,
    report.bundlesTotal,
    'reported + notAvailable must reconstruct the total bundle count (strict partition)',
  );
  assert.equal(report.aggregate.claimsProcessed, 10);
  assert.equal(report.aggregate.conflictsPreserved, 2);
  assert.equal(report.aggregate.unresolvedCount, 1);
  assert.equal(report.aggregate.candidateScaffoldsCount, 2);
  assert.equal(report.aggregate.rulesEmitted, 0);
  assert.equal(report.aggregate.conflictClassesCount, 0);
  assert.deepEqual(report.conflictClasses, []);
});

test('P2-T4: buildMultiBundleConversionReport over zero bundles still emits explicit 0 aggregate counts and an empty bundles array, never absent keys', () => {
  const report = buildMultiBundleConversionReport({ bundles: [] });
  assert.equal(report.bundlesTotal, 0);
  assert.deepEqual(report.bundles, []);
  assert.deepEqual(report.aggregate, {
    bundlesReported: 0,
    bundlesNotAvailable: 0,
    claimsProcessed: 0,
    conflictsPreserved: 0,
    unresolvedCount: 0,
    candidateScaffoldsCount: 0,
    rulesEmitted: 0,
    conflictClassesCount: 0,
  });
  assert.deepEqual(report.conflictClasses, []);
});

test('P2-T4: buildMultiBundleConversionReport is a pure function (no I/O, deterministic given identical inputs)', () => {
  const bundles = [buildBundleReportSection({ pairIndex: 0, fixture: 'f0', module: 'm0', moduleId: 'm0' })];
  const a = buildMultiBundleConversionReport({ bundles });
  const b = buildMultiBundleConversionReport({ bundles });
  assert.deepEqual(a, b);
});

// =================================================================================================
// 3. readBundleConversionReport / readOptionalJsonArray — the actual 0/[] disk-read paths
// =================================================================================================

test('P2-T4: readBundleConversionReport returns { report: null, reason } (never throws) when conversion-report.json does not exist', async () => {
  const scratch = await makeScratchDir('no-report');
  try {
    const { report, reason } = await readBundleConversionReport(scratch);
    assert.equal(report, null);
    assert.ok(typeof reason === 'string' && reason.includes('conversion-report.json'));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('P2-T4: readBundleConversionReport reads a real conversion-report.json off disk', async () => {
  const scratch = await makeScratchDir('real-report');
  try {
    const payload = { schemaVersion: '1.0', moduleId: 'x', summary: { claimsTotal: 5 } };
    await writeFile(path.join(scratch, 'conversion-report.json'), JSON.stringify(payload), 'utf8');
    const { report } = await readBundleConversionReport(scratch);
    assert.deepEqual(report, payload);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('P2-T4: readBundleConversionReport reports a named reason (not a crash) for malformed JSON', async () => {
  const scratch = await makeScratchDir('malformed-report');
  try {
    await writeFile(path.join(scratch, 'conversion-report.json'), '{ not valid json', 'utf8');
    const { report, reason } = await readBundleConversionReport(scratch);
    assert.equal(report, null);
    assert.ok(reason.includes('not valid JSON'));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

// AC: "a bundle producing zero unresolved claims still emits `unresolved: []`" -- the real, on-disk,
// ENOENT-driven form (unresolved.json does not exist yet for any module, as of this Phase 2 task).
test('P2-T4 AC: readOptionalJsonArray returns [] (never null, never throws) when the file does not exist', async () => {
  const scratch = await makeScratchDir('no-unresolved');
  try {
    const result = await readOptionalJsonArray(path.join(scratch, 'unresolved.json'));
    assert.deepEqual(result, []);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('P2-T4: readOptionalJsonArray returns the real array when the file exists and is a real, non-empty JSON array', async () => {
  const scratch = await makeScratchDir('real-unresolved');
  try {
    const payload = [{ claimId: 'clm_1', reason: 'no matching decision' }];
    await writeFile(path.join(scratch, 'unresolved.json'), JSON.stringify(payload), 'utf8');
    const result = await readOptionalJsonArray(path.join(scratch, 'unresolved.json'));
    assert.deepEqual(result, payload);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('P2-T4: readOptionalJsonArray returns [] (fails soft) for malformed JSON or a non-array top-level value', async () => {
  const scratch = await makeScratchDir('bad-unresolved');
  try {
    await writeFile(path.join(scratch, 'a.json'), '{ not valid json', 'utf8');
    await writeFile(path.join(scratch, 'b.json'), JSON.stringify({ not: 'an array' }), 'utf8');
    assert.deepEqual(await readOptionalJsonArray(path.join(scratch, 'a.json')), []);
    assert.deepEqual(await readOptionalJsonArray(path.join(scratch, 'b.json')), []);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

// =================================================================================================
// 4. collectBundleReportSections — read-only rollup over the real, named BATCH_PAIRS
// =================================================================================================

test('P6-T4: collectBundleReportSections against a fresh outBaseDir returns exactly 4 sections, all not_available (propose never ran against THIS scratch outBaseDir), but claimsProcessed/conflictsPreserved reflect REAL, committed Phase 4/5 module/fixture data via the P6-T4 fallback', async () => {
  const scratch = await makeScratchDir('fresh-collect');
  try {
    const sections = await collectBundleReportSections({ outBaseDir: scratch });
    assert.equal(sections.length, 4);
    assert.deepEqual(
      sections.map((s) => ({ fixture: s.fixture, module: s.module })),
      BATCH_PAIRS.map(({ fixture, module }) => ({ fixture, module })),
    );

    // Real, independently-verified claim-ledger counts for each of the 4 named fixtures (each
    // bundle's own `claims/claim_ledger.yaml` -- a literal count of that YAML file's `claims[]`
    // array, re-confirmed against the real, committed fixtures at authoring time; see this test's
    // own cross-check against `readFixtureClaimCount` immediately below, which is the SAME
    // function `collectBundleReportSections` itself calls, so this is a real integration proof,
    // not merely a re-assertion of the module's own internal computation).
    const EXPECTED_CLAIMS_PROCESSED = Object.freeze({
      anemia: 48,
      cbc_suite_v1: 88,
      kidney_suite_v1: 87,
      growth_suite_v1: 92,
    });
    // Real, committed named-conflict-class counts per module (P6-T4; see
    // `extractConflictClasses`'s own header doc): `unresolved.json` conflict-object entries PLUS
    // `evidence.json` `conflictsWith` source records. `anemia` carries neither (0, real and
    // honest -- RF-EV-001's backfill introduced no conflict-visible content).
    const EXPECTED_CONFLICT_CLASSES_COUNT = Object.freeze({
      anemia: 0,
      cbc_suite_v1: 3,
      kidney_suite_v1: 4,
      growth_suite_v1: 4,
    });

    for (const section of sections) {
      // `outBaseDir` is a fresh scratch directory, so `propose` has never written a
      // conversion-report.json for ANY pair here -- `status` stays "not_available" for all 4 (this
      // is unchanged by P6-T4 -- `propose.mjs` remains structurally scoped to `cbc_suite_v1` only,
      // and `status` continues to reflect whether a LIVE propose pack exists for THIS outBaseDir).
      assert.equal(section.status, 'not_available');

      // P6-T4: claimsProcessed/conflictsPreserved are NOW real, non-zero, Phase 4/5-derived values
      // -- computed directly from this bundle's own committed fixture/module content, independent
      // of `outBaseDir` (which is why a completely fresh scratch dir still yields real counts).
      assert.equal(
        section.claimsProcessed,
        EXPECTED_CLAIMS_PROCESSED[section.moduleId],
        `${section.moduleId}: claimsProcessed must equal the real, committed claim_ledger.yaml count`,
      );
      const fixtureDir = path.join(REPO_ROOT, section.fixture);
      const liveClaimCount = await readFixtureClaimCount(fixtureDir);
      assert.equal(section.claimsProcessed, liveClaimCount, `${section.moduleId}: claimsProcessed must match a fresh readFixtureClaimCount() call over the same real fixture`);

      assert.equal(
        section.conflictClassesCount,
        EXPECTED_CONFLICT_CLASSES_COUNT[section.moduleId],
        `${section.moduleId}: conflictClassesCount must equal the real, committed conflict-object count`,
      );
      // conflictsPreserved === conflictClassesCount here specifically because no fixture's own
      // claim_ledger.yaml carries a mixed/contradicted-status claim (confirmed at authoring time)
      // -- the conversion-report.json-derived component of conflictsPreserved is always 0 for a
      // "not_available" bundle, so the two fields coincide for all 4 bundles today.
      assert.equal(section.conflictsPreserved, section.conflictClassesCount);

      // `unresolved`/`unresolvedCount` reflect whichever real, committed
      // `modules/<id>/unresolved.json` this pair's module actually carries today (R-P2: `[]` is
      // itself a legitimate value here, not a stand-in for "not yet implemented" -- Phase 5,
      // P5-T1/P5-T2, committed real, non-empty `unresolved.json` content for kidney_suite_v1/
      // growth_suite_v1 while those bundles' own `propose` conversion-report.json still
      // legitimately does not exist). Mirror whatever `readOptionalJsonArray` itself reads from
      // that same real path, rather than hardcoding a blanket `[]`.
      const moduleDir = path.join(REPO_ROOT, section.module);
      const expectedUnresolved = await readOptionalJsonArray(path.join(moduleDir, 'unresolved.json'));
      assert.deepEqual(section.unresolved, expectedUnresolved);
      assert.equal(section.unresolvedCount, expectedUnresolved.length);
      // `candidate-scaffolds.json` (OQ-5) is staged only under `build/kb-pack/<moduleId>/<pack
      // version>/` -- this test's scratch `outBaseDir` never has one, for any pair, regardless of
      // Phase 5 state.
      assert.deepEqual(section.candidateScaffolds, []);
      assert.equal(section.candidateScaffoldsCount, 0);
      // rulesEmitted stays 0 -- this plan's own load-bearing honesty AC (P4-T8/P5-T4), re-verified
      // separately below against modules/**/rules.json's real rule counts.
      assert.equal(section.rulesEmitted, 0);
    }

    // R-P2/FR-11 binding AC (this task, P6-T4): at least 3 named conflict classes appear in the
    // report, spanning the 3 conflict topics this plan names by name -- WHO-vs-CDC growth,
    // ANC-cutoff variance (across CBC sources), pediatric-vs-adult proteinuria. Asserted against
    // the actual conflictClasses content, not merely a count.
    const allConflictClassNames = sections.flatMap((s) => s.conflictClasses.map((c) => c.name));
    assert.ok(allConflictClassNames.length >= 3, `expected >=3 named conflict classes, got ${allConflictClassNames.length}`);
    assert.ok(
      allConflictClassNames.some((n) => typeof n === 'string' && /WHO.*CDC|CDC.*WHO/i.test(n)),
      'expected a named WHO-vs-CDC growth-standard conflict class among growth_suite_v1\'s conflictClasses',
    );
    assert.ok(
      allConflictClassNames.some((n) => typeof n === 'string' && /ANC breakpoint|neutropenia severity/i.test(n)),
      'expected a named ANC-cutoff-variance conflict class among cbc_suite_v1\'s conflictClasses',
    );
    assert.ok(
      allConflictClassNames.some((n) => typeof n === 'string' && /proteinuria/i.test(n)),
      'expected a named pediatric-vs-adult proteinuria conflict class among kidney_suite_v1\'s conflictClasses',
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('P2-T4: collectBundleReportSections reports a bundle "reported" with real counts once its own propose run has written conversion-report.json', async () => {
  const scratch = await makeScratchDir('one-reported');
  try {
    const cbcOutDir = path.join(scratch, 'cbc_suite_v1', '0.1.0-proposal');
    await mkdir(cbcOutDir, { recursive: true });
    await withCapturedStdout(() =>
      runPropose({
        runDir: path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-002'),
        module: path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json'),
        decisions: path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml'),
        out: cbcOutDir,
      }),
    );

    const sections = await collectBundleReportSections({ outBaseDir: scratch });
    const cbcSection = sections.find((s) => s.moduleId === 'cbc_suite_v1');
    const otherSections = sections.filter((s) => s.moduleId !== 'cbc_suite_v1');

    assert.equal(cbcSection.status, 'reported');
    assert.equal(cbcSection.statusReason, null);
    assert.ok(cbcSection.claimsProcessed > 0, 'the real rf-cbc-002 fixture has a non-zero claim count');
    assert.equal(sections.length, 4);
    for (const other of otherSections) {
      assert.equal(other.status, 'not_available', 'a bundle this test never ran propose for must stay not_available');
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

// =================================================================================================
// 4b. P4-T2 (multi-bundle-conversion-e1-finish Phase 4, FR-F14): a REAL, hermetic 4-of-4 aggregate --
// bundlesReported: 4, bundlesNotAvailable: 0, and a zero-rule bundle still shows "rulesEmitted": 0
// (present, never absent). Runs the real `runBatch` over ALL 4 named `BATCH_PAIRS` into its OWN
// scratch `--out-base` first (never the shared, real `DEFAULT_OUT_BASE_DIR` -- avoiding any
// dependency on another test file's ambient state/run order) so this test's own result is
// deterministic regardless of what else has or has not run.
//
// Deliberately does NOT capture this call's stdout (`runBatch` over 4 real pairs prints 12+ verb
// summaries) -- matches `tests/ef-converter-batch.test.mjs`'s own P4-T1 test, which found that
// buffering that much captured output can destabilize this suite's own TAP reporting.
// =================================================================================================

test('P4-T2: a real 4-of-4 batch run + aggregate reports bundlesReported: 4, bundlesNotAvailable: 0, and rulesEmitted: 0 is PRESENT (not absent) for every zero-rule bundle', async () => {
  const scratch = await makeScratchDir('four-of-four-aggregate');
  try {
    const results = await runBatch({ pairs: BATCH_PAIRS, outBaseDir: scratch });
    assert.equal(results.length, 4, 'all 4 named pairs must succeed');

    const sections = await collectBundleReportSections({ pairs: BATCH_PAIRS, outBaseDir: scratch });
    const report = buildMultiBundleConversionReport({ bundles: sections });

    assert.equal(report.bundlesTotal, 4);
    assert.equal(report.aggregate.bundlesReported, 4, 'all 4 bundles must show status: reported once propose has genuinely run for each');
    assert.equal(report.aggregate.bundlesNotAvailable, 0);

    const raw = JSON.stringify(report, null, 2);
    for (const section of report.bundles) {
      assert.equal(section.status, 'reported');
      assert.equal(section.statusReason, null);
      // The literal AC text (P4-T2): a bundle producing zero rules still shows "rulesEmitted": 0,
      // present as an explicit key, never an absent one.
      assert.ok(Object.hasOwn(section, 'rulesEmitted'), `${section.moduleId}: rulesEmitted key must be present`);
      assert.equal(section.rulesEmitted, 0, `${section.moduleId}: rulesEmitted must be the explicit 0 this converter always reports at this seam`);
    }
    assert.ok(raw.includes('"rulesEmitted": 0'), 'the serialized report bytes must literally contain "rulesEmitted": 0 for the zero-rule bundles');
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

// =================================================================================================
// 5. `aggregate` CLI verb (run()) — writes multi-bundle-conversion-report.json, exits 0
// =================================================================================================

test('P2-T4: aggregate verb writes multi-bundle-conversion-report.json under --out-base and returns EXIT_OK', async () => {
  const scratch = await makeScratchDir('cli-verb');
  try {
    const { result: exitCode, output } = await withCapturedStdout(() => runAggregate({ outBase: scratch }));
    assert.equal(exitCode, EXIT_OK);
    assert.ok(output.includes('"verb": "aggregate"'));

    const reportPath = path.join(scratch, MULTI_BUNDLE_REPORT_FILENAME);
    const raw = await readFile(reportPath, 'utf8');
    const report = JSON.parse(raw);
    assert.equal(report.bundlesTotal, 4);
    assert.equal(report.aggregate.bundlesReported, 0);
    assert.equal(report.aggregate.bundlesNotAvailable, 4);

    // R-P2 literal AC, proven against the actual bytes written to disk (not just the in-memory
    // object): a bundle with zero unresolved claims still emits "unresolved": [], never omitted.
    assert.ok(raw.includes('"unresolved": []'));
    assert.ok(raw.includes('"candidateScaffolds": []'));
    assert.ok(raw.includes('"rulesEmitted": 0'));
    assert.ok(!raw.includes('"unresolved": null'));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('P2-T4: aggregate verb run twice with no source changes is idempotent (byte-identical report)', async () => {
  const scratch = await makeScratchDir('cli-idempotent');
  try {
    await withCapturedStdout(() => runAggregate({ outBase: scratch }));
    const first = await readFile(path.join(scratch, MULTI_BUNDLE_REPORT_FILENAME), 'utf8');
    await withCapturedStdout(() => runAggregate({ outBase: scratch }));
    const second = await readFile(path.join(scratch, MULTI_BUNDLE_REPORT_FILENAME), 'utf8');
    assert.equal(first, second);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

// =================================================================================================
// 6. P6-T4 (FR-5 / Observability NFR): the FINAL aggregate report, produced by the real `aggregate`
// CLI verb against the canonical `DEFAULT_OUT_BASE_DIR`, reflects real post-Phase-4/5 data -- the
// rules-emitted field is demonstrated by diff against the real modules/**/rules.json rule counts,
// not merely asserted; >=3 named conflict classes appear, by name.
// =================================================================================================

test('P6-T4: the real aggregate report (DEFAULT_OUT_BASE_DIR, no --out-base override) reflects real Phase 4/5 data -- non-zero claims/conflicts, 0 rules, >=3 named conflict classes', async () => {
  const { result: exitCode } = await withCapturedStdout(() => runAggregate({}));
  assert.equal(exitCode, EXIT_OK);

  const reportPath = path.join(REPO_ROOT, 'build', 'kb-pack', MULTI_BUNDLE_REPORT_FILENAME);
  const report = JSON.parse(await readFile(reportPath, 'utf8'));

  assert.equal(report.bundlesTotal, 4);
  assert.ok(report.aggregate.claimsProcessed > 0, 'aggregate claimsProcessed must be real and non-zero across the 4 bundles');
  assert.ok(report.aggregate.conflictsPreserved >= 3, 'aggregate conflictsPreserved must be real, non-zero, and >= the 3 named conflict classes this plan requires');
  assert.ok(report.conflictClasses.length >= 3);

  // R-P2/FR-11 (this task's own binding AC, phase-5-6-7-projection-determinism-docs.md row P6-T4):
  // >=3 named conflict classes across the 4 bundles -- WHO-vs-CDC growth, ANC-cutoff variance,
  // pediatric-vs-adult proteinuria -- demonstrated by name, in the report's own bytes.
  const names = report.conflictClasses.map((c) => c.name).filter((n) => typeof n === 'string');
  assert.ok(names.some((n) => /WHO.*CDC|CDC.*WHO/i.test(n)), 'expected a named WHO-vs-CDC growth conflict class');
  assert.ok(names.some((n) => /ANC breakpoint|neutropenia severity/i.test(n)), 'expected a named ANC-cutoff-variance conflict class');
  assert.ok(names.some((n) => /proteinuria/i.test(n)), 'expected a named pediatric-vs-adult proteinuria conflict class');

  // rulesEmitted MUST read 0 for every bundle and in aggregate -- demonstrated here by a REAL diff
  // against each of the 4 modules' own committed rules.json rule counts (this is the single
  // aggregate surface where the "zero new rules" claim is demonstrated by diff, matching this
  // task's own binding text; the per-module diff/byte-identity proof itself is P4-T8's/P5-T4's own
  // load-bearing test, `tests/ef-p4-t8-honesty-ac.test.mjs`/`tests/ef-p5-t4-honesty-ac.test.mjs`,
  // re-confirmed green as part of this same `npm run check` run).
  const EXPECTED_RULES_JSON_COUNT = Object.freeze({
    anemia: 91,
    cbc_suite_v1: 4,
    kidney_suite_v1: 0,
    growth_suite_v1: 0,
  });
  for (const bundle of report.bundles) {
    assert.equal(bundle.rulesEmitted, 0, `${bundle.moduleId}: rulesEmitted must be 0`);
    const rulesJson = JSON.parse(await readFile(path.join(REPO_ROOT, bundle.module, 'rules.json'), 'utf8'));
    assert.equal(
      rulesJson.length,
      EXPECTED_RULES_JSON_COUNT[bundle.moduleId],
      `${bundle.moduleId}: modules/${bundle.moduleId}/rules.json's real rule count must match its known, unchanged baseline (the actual diff evidence rulesEmitted: 0 stands for)`,
    );
  }
  assert.equal(report.aggregate.rulesEmitted, 0);
});
