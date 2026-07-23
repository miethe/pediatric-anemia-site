// tests/ef-converter-semantic-diff.test.mjs — P5-T3 (evidence-foundry-buildout Phase 5, FR-21,
// this plan's binding OQ-4 resolution).
//
// Task acceptance criteria (phase-3-5-projection-slice-manifest.md, row P5-T3):
//   1. "semantic-diff.json reports exactly 4 added rule IDs (the slice rules), 0 removed, 0
//      changed, against modules/anemia/rules.json" — proven below with a real `propose` run
//      against the real fixture + committed `modules/cbc_suite_v1/` package.
//   2. "output is byte-identical across two runs with unchanged inputs" — proven with a scoped
//      double-run proof for this task's own artifact (the FULL cross-artifact double-run proof is
//      P5-T5's own dedicated test file).
//
// Also covers `computeSemanticDiff`/`buildSemanticDiffReport` in isolation (pure functions, no I/O)
// against synthetic fixtures, including the same-module "removed"/"changed" case this task's
// header comment promises is non-trivial in E1.
//
// multi-bundle-conversion-e1-finish Phase 4 (P4-T4, FR-F16) ADDS coverage below for the SECOND,
// independent comparison mode this phase adds -- `diffEvidenceAssertions`/
// `buildEvidenceAssertionsDiffReport` (assertionId-level, over two evidence-assertions.json
// documents) -- plus an integration proof that `propose`'s emission for the 3 non-cbc modules
// (anemia/kidney_suite_v1/growth_suite_v1) writes `semantic-diff.json` in THIS mode, never the
// rule-id mode above (which stays exclusively `cbc_suite_v1`'s, unchanged).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeSemanticDiff,
  buildSemanticDiffReport,
  diffEvidenceAssertions,
  buildEvidenceAssertionsDiffReport,
} from '../tools/rf-bundle-to-kb-pack/lib/semantic-diff.mjs';
import { run as runPropose } from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');

const ANEMIA_RULE_IDS_SAMPLE = ['SCOPE-001', 'SCOPE-002', 'SCOPE-003'];

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
// computeSemanticDiff — pure function, synthetic fixtures
// =================================================================================================

test('P5-T3: computeSemanticDiff reports every head-only rule id as added (cross-module, disjoint ids)', () => {
  const baseRules = ANEMIA_RULE_IDS_SAMPLE.map((id) => ({ id, category: 'x', when: {}, output: {} }));
  const headRules = [
    { id: 'CBC-A-001', category: 'y', when: {}, output: {} },
    { id: 'CBC-B-001', category: 'y', when: {}, output: {} },
  ];
  const diff = computeSemanticDiff({
    baseModuleId: 'anemia',
    baseRules,
    headModuleId: 'cbc_suite_v1',
    headRules,
  });
  assert.deepEqual(diff.added, ['CBC-A-001', 'CBC-B-001']);
  assert.deepEqual(diff.removed, [], 'a cross-module additive proposal never reports an existing rule as removed');
  assert.deepEqual(diff.changed, []);
});

test('P5-T3: computeSemanticDiff detects a same-id content divergence as "changed", never "added"', () => {
  const baseRules = [{ id: 'SHARED-001', category: 'x', when: { fact: 'a' }, output: { type: 'note' } }];
  const headRules = [{ id: 'SHARED-001', category: 'x', when: { fact: 'b' }, output: { type: 'note' } }];
  const diff = computeSemanticDiff({
    baseModuleId: 'anemia',
    baseRules,
    headModuleId: 'anemia', // same module -- a real content edit within one module's own file
    headRules,
  });
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.changed, ['SHARED-001']);
  assert.deepEqual(diff.removed, []);
});

test('P5-T3: computeSemanticDiff omits an identical shared-id rule from every category (no false "changed")', () => {
  const rule = { id: 'SHARED-002', category: 'x', when: { fact: 'a' }, output: { type: 'note' } };
  const diff = computeSemanticDiff({
    baseModuleId: 'anemia',
    baseRules: [rule],
    headModuleId: 'anemia',
    headRules: [{ ...rule }], // structurally identical, different object identity
  });
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.changed, []);
  assert.deepEqual(diff.removed, []);
});

test('P5-T3: computeSemanticDiff reports base-only rule ids as "removed" ONLY for a same-module comparison', () => {
  const baseRules = [
    { id: 'V1-001', category: 'x', when: {}, output: {} },
    { id: 'V1-002', category: 'x', when: {}, output: {} },
  ];
  const headRules = [{ id: 'V1-001', category: 'x', when: {}, output: {} }]; // V1-002 dropped in v2

  const sameModule = computeSemanticDiff({
    baseModuleId: 'cbc_suite_v1',
    baseRules,
    headModuleId: 'cbc_suite_v1',
    headRules,
  });
  assert.deepEqual(sameModule.removed, ['V1-002'], 'a genuine same-module generation-to-generation drop is reported');

  const crossModule = computeSemanticDiff({
    baseModuleId: 'anemia',
    baseRules,
    headModuleId: 'cbc_suite_v1',
    headRules,
  });
  assert.deepEqual(
    crossModule.removed,
    [],
    'the identical base-only ids never report as removed when base/head are different modules',
  );
});

test('P5-T3: computeSemanticDiff output arrays are always sorted (deterministic regardless of input order)', () => {
  const headRules = [
    { id: 'ZZZ-003', category: 'x', when: {}, output: {} },
    { id: 'AAA-001', category: 'x', when: {}, output: {} },
    { id: 'MMM-002', category: 'x', when: {}, output: {} },
  ];
  const diff = computeSemanticDiff({ baseModuleId: 'anemia', baseRules: [], headModuleId: 'cbc_suite_v1', headRules });
  assert.deepEqual(diff.added, ['AAA-001', 'MMM-002', 'ZZZ-003']);
});

test('P5-T3: computeSemanticDiff is a pure function (no I/O, deterministic given identical inputs)', () => {
  const input = {
    baseModuleId: 'anemia',
    baseRules: ANEMIA_RULE_IDS_SAMPLE.map((id) => ({ id, category: 'x', when: {}, output: {} })),
    headModuleId: 'cbc_suite_v1',
    headRules: [{ id: 'CBC-Z-001', category: 'y', when: {}, output: {} }],
  };
  assert.deepEqual(computeSemanticDiff(input), computeSemanticDiff(input));
});

// =================================================================================================
// buildSemanticDiffReport — full document shape
// =================================================================================================

test('P5-T3: buildSemanticDiffReport emits the base/head/added/removed/changed/summary shape, no timestamp field', () => {
  const report = buildSemanticDiffReport({
    baseModuleId: 'anemia',
    baseRulesPath: 'modules/anemia/rules.json',
    baseRules: ANEMIA_RULE_IDS_SAMPLE.map((id) => ({ id, category: 'x', when: {}, output: {} })),
    headModuleId: 'cbc_suite_v1',
    headRules: [{ id: 'CBC-Z-001', category: 'y', when: {}, output: {} }],
  });
  assert.deepEqual(
    Object.keys(report).sort(),
    ['added', 'base', 'changed', 'head', 'removed', 'schemaVersion', 'scope', 'summary'],
  );
  assert.equal(report.base.moduleId, 'anemia');
  assert.equal(report.base.path, 'modules/anemia/rules.json');
  assert.equal(report.base.ruleCount, 3);
  assert.equal(report.head.moduleId, 'cbc_suite_v1');
  assert.equal(report.head.ruleCount, 1);
  assert.deepEqual(report.added, ['CBC-Z-001']);
  assert.deepEqual(report.removed, []);
  assert.deepEqual(report.changed, []);
  assert.deepEqual(report.summary, { addedCount: 1, removedCount: 0, changedCount: 0 });
  // Never a timestamp/generatedAt-style field -- this artifact must be byte-identical across two
  // clean runs against unchanged inputs (FR-20 seam invariant 13).
  const raw = JSON.stringify(report);
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(raw), 'semantic-diff.json must never embed a wall-clock timestamp');
});

// =================================================================================================
// Integration: a real `propose` run's semantic-diff.json against the real fixture + committed
// modules/cbc_suite_v1/ package (this task's own binding AC: "exactly 4 added, 0 removed, 0 changed").
// =================================================================================================

test('P5-T3 AC: a real propose run\'s semantic-diff.json reports exactly the 4 slice rule IDs as added, 0 removed, 0 changed', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-semantic-diff-real-'));
  try {
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir }),
    );
    const report = JSON.parse(await readFile(path.join(outDir, 'semantic-diff.json'), 'utf8'));

    assert.equal(report.base.moduleId, 'anemia');
    assert.equal(report.base.path, 'modules/anemia/rules.json');
    assert.equal(report.head.moduleId, 'cbc_suite_v1');
    assert.equal(report.head.ruleCount, 4);

    // NOTE: the STAGED (propose-drafted, P3-T5's rule-candidate-drafts.mjs) id for the
    // marrow-red-flag rule is "CBC-NEUT-MARROWFLAG-001" -- distinct from the already-migrated,
    // committed modules/cbc_suite_v1/rules.json's "CBC-MARROW-REDFLAG-001" (P4-T4). This is a
    // pre-existing drafting/migration naming drift outside this task's scope (P5-T3 does not own
    // modules/cbc_suite_v1/rules.json or lib/rule-candidate-drafts.mjs); asserted here against the
    // real staged output this run actually produces, not against the committed module's id.
    assert.deepEqual(report.added, [
      'CBC-NEUT-BENIGNDIFF-001',
      'CBC-NEUT-LOCALRANGE-001',
      'CBC-NEUT-MARROWFLAG-001',
      'CBC-NEUT-YOUNGINF-001',
    ]);
    assert.deepEqual(report.removed, []);
    assert.deepEqual(report.changed, []);
    assert.deepEqual(report.summary, { addedCount: 4, removedCount: 0, changedCount: 0 });
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('P5-T3: none of the 4 staged cbc_suite_v1 rule IDs collide with any id in the real modules/anemia/rules.json (sanity, real files)', async () => {
  const anemiaRules = JSON.parse(await readFile(path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json'), 'utf8'));
  const cbcRules = JSON.parse(
    await readFile(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'rules.json'), 'utf8'),
  );
  const anemiaIds = new Set(anemiaRules.map((r) => r.id));
  for (const rule of cbcRules) {
    assert.ok(!anemiaIds.has(rule.id), `cbc_suite_v1 rule id "${rule.id}" must not collide with an anemia rule id`);
  }
});

test('P5-T3 AC: semantic-diff.json is byte-identical across two clean propose runs against the same fixture', async () => {
  const outDirA = await mkdtemp(path.join(os.tmpdir(), 'ef-semantic-diff-determinism-a-'));
  const outDirB = await mkdtemp(path.join(os.tmpdir(), 'ef-semantic-diff-determinism-b-'));
  try {
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDirA }),
    );
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDirB }),
    );
    const rawA = await readFile(path.join(outDirA, 'semantic-diff.json'), 'utf8');
    const rawB = await readFile(path.join(outDirB, 'semantic-diff.json'), 'utf8');
    assert.equal(rawA, rawB, 'semantic-diff.json must be byte-identical across two clean runs');
  } finally {
    await rm(outDirA, { recursive: true, force: true });
    await rm(outDirB, { recursive: true, force: true });
  }
});

// =================================================================================================
// P4-T4 (multi-bundle-conversion-e1-finish Phase 4, FR-F16): diffEvidenceAssertions — pure function,
// synthetic fixtures.
// =================================================================================================

test('P4-T4: diffEvidenceAssertions of a document against itself is always empty (added/removed/changed)', () => {
  const assertions = [
    { assertionId: 'evas_001', text: 'a' },
    { assertionId: 'evas_002', text: 'b' },
  ];
  const diff = diffEvidenceAssertions({ baseAssertions: assertions, headAssertions: assertions });
  assert.deepEqual(diff, { added: [], removed: [], changed: [] });

  // Also true for two SEPARATE (deep-equal, not same-reference) copies of the same content.
  const diffCopies = diffEvidenceAssertions({
    baseAssertions: JSON.parse(JSON.stringify(assertions)),
    headAssertions: JSON.parse(JSON.stringify(assertions)),
  });
  assert.deepEqual(diffCopies, { added: [], removed: [], changed: [] });
});

test('P4-T4: diffEvidenceAssertions reports a seeded single-field change as exactly one `changed` entry naming that assertionId', () => {
  const base = [
    { assertionId: 'evas_001', text: 'original text' },
    { assertionId: 'evas_002', text: 'unchanged' },
  ];
  const head = [
    { assertionId: 'evas_001', text: 'CHANGED text' },
    { assertionId: 'evas_002', text: 'unchanged' },
  ];
  const diff = diffEvidenceAssertions({ baseAssertions: base, headAssertions: head });
  assert.deepEqual(diff.changed, ['evas_001']);
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.removed, []);
});

test('P4-T4: diffEvidenceAssertions reports a head-only assertionId as added and a base-only assertionId as removed', () => {
  const base = [
    { assertionId: 'evas_001', text: 'a' },
    { assertionId: 'evas_002', text: 'b' },
  ];
  const head = [
    { assertionId: 'evas_001', text: 'a' },
    { assertionId: 'evas_003', text: 'c' },
  ];
  const diff = diffEvidenceAssertions({ baseAssertions: base, headAssertions: head });
  assert.deepEqual(diff.added, ['evas_003']);
  assert.deepEqual(diff.removed, ['evas_002']);
  assert.deepEqual(diff.changed, []);
});

test('P4-T4: diffEvidenceAssertions output arrays are always sorted (deterministic regardless of input order)', () => {
  const head = [
    { assertionId: 'evas_zzz', text: 'z' },
    { assertionId: 'evas_aaa', text: 'a' },
    { assertionId: 'evas_mmm', text: 'm' },
  ];
  const diff = diffEvidenceAssertions({ baseAssertions: [], headAssertions: head });
  assert.deepEqual(diff.added, ['evas_aaa', 'evas_mmm', 'evas_zzz']);
});

test('P4-T4: diffEvidenceAssertions is a pure function (no I/O, deterministic given identical inputs)', () => {
  const input = {
    baseAssertions: [{ assertionId: 'evas_001', text: 'a' }],
    headAssertions: [{ assertionId: 'evas_001', text: 'a' }, { assertionId: 'evas_002', text: 'b' }],
  };
  assert.deepEqual(diffEvidenceAssertions(input), diffEvidenceAssertions(input));
});

// =================================================================================================
// P4-T4: buildEvidenceAssertionsDiffReport — full document shape
// =================================================================================================

test('P4-T4: buildEvidenceAssertionsDiffReport emits the base/head/added/removed/changed/summary shape, no timestamp field', () => {
  const report = buildEvidenceAssertionsDiffReport({
    baseModuleId: 'kidney_suite_v1',
    basePath: 'modules/kidney_suite_v1/evidence-assertions.json',
    baseAssertions: [{ assertionId: 'evas_001', text: 'a' }],
    headModuleId: 'kidney_suite_v1',
    headAssertions: [{ assertionId: 'evas_001', text: 'a' }, { assertionId: 'evas_002', text: 'b' }],
  });
  assert.deepEqual(
    Object.keys(report).sort(),
    ['added', 'base', 'changed', 'head', 'removed', 'schemaVersion', 'scope', 'summary'],
  );
  assert.equal(report.base.moduleId, 'kidney_suite_v1');
  assert.equal(report.base.path, 'modules/kidney_suite_v1/evidence-assertions.json');
  assert.equal(report.base.assertionCount, 1);
  assert.equal(report.head.moduleId, 'kidney_suite_v1');
  assert.equal(report.head.assertionCount, 2);
  assert.deepEqual(report.added, ['evas_002']);
  assert.deepEqual(report.removed, []);
  assert.deepEqual(report.changed, []);
  assert.deepEqual(report.summary, { addedCount: 1, removedCount: 0, changedCount: 0 });
  const raw = JSON.stringify(report);
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(raw), 'evidence-projection semantic-diff.json must never embed a wall-clock timestamp');
});

// =================================================================================================
// P4-T4: integration — propose's semantic-diff.json for the 3 non-cbc modules uses THIS mode
// =================================================================================================

const NON_CBC_CASES = [
  { moduleId: 'anemia', fixture: 'rf-ev-001' },
  { moduleId: 'kidney_suite_v1', fixture: 'rf-kid-001' },
  { moduleId: 'growth_suite_v1', fixture: 'rf-gro-002' },
];

for (const { moduleId, fixture } of NON_CBC_CASES) {
  test(`P4-T4: propose(${moduleId})'s semantic-diff.json uses the evidence-projection mode (never the rule-id mode) and is empty by construction (self-comparison)`, async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), `ef-semantic-diff-evidence-mode-${moduleId}-`));
    try {
      await withCapturedStdout(() =>
        runPropose({
          runDir: path.join(REPO_ROOT, 'tests', 'fixtures', fixture),
          module: path.join(REPO_ROOT, 'modules', moduleId, 'module.json'),
          decisions: path.join(REPO_ROOT, 'modules', moduleId, 'authoring-decisions.yaml'),
          out: outDir,
        }),
      );
      const report = JSON.parse(await readFile(path.join(outDir, 'semantic-diff.json'), 'utf8'));

      assert.equal(report.base.moduleId, moduleId);
      assert.equal(report.head.moduleId, moduleId);
      assert.ok('assertionCount' in report.base, 'evidence-projection mode names assertionCount, never ruleCount');
      assert.ok(!('ruleCount' in report.base), 'must never be the rule-id mode for a non-cbc module');
      assert.match(report.scope, /evidence-assertions\.json assertionId-level/);

      // Self-comparison (propose only ever copies the committed evidence-assertions.json verbatim
      // today, per propose.mjs's own header comment) -- empty diff by construction.
      assert.deepEqual(report.added, []);
      assert.deepEqual(report.removed, []);
      assert.deepEqual(report.changed, []);
      assert.deepEqual(report.summary, { addedCount: 0, removedCount: 0, changedCount: 0 });
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
}

test('P4-T4: propose(cbc_suite_v1)\'s semantic-diff.json still uses the rule-id mode (unchanged, OQ-4) -- never the evidence-projection mode', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-semantic-diff-rule-id-mode-'));
  try {
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir }),
    );
    const report = JSON.parse(await readFile(path.join(outDir, 'semantic-diff.json'), 'utf8'));
    assert.ok('ruleCount' in report.base, 'cbc_suite_v1 must keep the rule-id mode shape');
    assert.ok(!('assertionCount' in report.base));
    assert.match(report.scope, /rule-id-level/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
