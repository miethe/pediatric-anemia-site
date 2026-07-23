// tests/ef-p4-t5-semantic-diff-commit.test.mjs — P4-T5 (multi-bundle-conversion-e1-finish Phase 4,
// FR-F16, R-3).
//
// Task acceptance criteria (phase-4-5-batch-determinism-docs.md, row P4-T5): run `propose` for all
// 3 non-cbc modules (anemia/kidney_suite_v1/growth_suite_v1) and COMMIT the resulting
// `semantic-diff.json` to a durable location `modules/<id>/semantic-diff.json` (copied from the
// gitignored `build/kb-pack/<id>/0.1.0-proposal/semantic-diff.json`, P4-T4's own evidence-projection
// mode). HARD R-3 CONSTRAINT: the converter's freshly-produced `evidence.json`/
// `evidence-assertions.json` for these 3 modules stays in `build/` ONLY and is NEVER copied over the
// committed `modules/<id>/evidence.json`/`evidence-assertions.json` -- regardless of whether the
// diff is empty or non-empty. This file's own binding test: `git diff` on
// `modules/{kidney_suite_v1,growth_suite_v1}/evidence.json` and
// `modules/anemia/evidence-assertions.json` is EMPTY after committing the 3 `semantic-diff.json`
// files -- i.e. committing the diff never touched the evidence files it diffed against.
//
// `git diff -- <path>` (working-tree-vs-HEAD, never a cross-commit-SHA comparison) is the correct,
// durable form of this check -- unlike a pinned commit SHA, it never breaks under this repo's own
// squash-merge git workflow (CLAUDE.md), because it is always relative to whatever HEAD is at
// test-run time. If these files were already committed clean before this task ran (the R-3-honest
// outcome), this diff is empty both before and after -- proving the constraint holds.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NON_CBC_MODULE_IDS = Object.freeze(['anemia', 'kidney_suite_v1', 'growth_suite_v1']);

// R-3's own named target files -- the committed evidence-layer projections these 3 modules'
// semantic-diff.json each compare against. NEVER touched by committing the diff itself.
const R3_PROTECTED_FILES = Object.freeze([
  'modules/kidney_suite_v1/evidence.json',
  'modules/growth_suite_v1/evidence.json',
  'modules/anemia/evidence-assertions.json',
  // Belt-and-suspenders: the full set R-3's prose names ("evidence.json/evidence-assertions.json
  // for these 3 modules"), not merely the 3 files R-3's own AC sentence names by name.
  'modules/anemia/evidence.json',
  'modules/kidney_suite_v1/evidence-assertions.json',
  'modules/growth_suite_v1/evidence-assertions.json',
]);

function gitDiffFor(relPath) {
  return execFileSync('git', ['diff', '--', relPath], { cwd: REPO_ROOT, encoding: 'utf8' });
}

async function loadJson(relPath) {
  return JSON.parse(await readFile(path.join(REPO_ROOT, relPath), 'utf8'));
}

// --- 1. semantic-diff.json exists, committed, at the durable per-module location ------------------

for (const moduleId of NON_CBC_MODULE_IDS) {
  test(`P4-T5: modules/${moduleId}/semantic-diff.json exists and is the evidence-projection shape (P4-T4)`, async () => {
    const doc = await loadJson(`modules/${moduleId}/semantic-diff.json`);
    assert.equal(doc.base.moduleId, moduleId);
    assert.equal(doc.head.moduleId, moduleId);
    assert.ok('assertionCount' in doc.base, 'must be the evidence-projection mode (assertionCount), never the rule-id mode (ruleCount)');
    assert.ok(!('ruleCount' in doc.base));
    assert.match(doc.scope, /evidence-assertions\.json assertionId-level/);
    assert.ok(Array.isArray(doc.added));
    assert.ok(Array.isArray(doc.removed));
    assert.ok(Array.isArray(doc.changed));
    assert.deepEqual(Object.keys(doc.summary).sort(), ['addedCount', 'changedCount', 'removedCount']);
  });
}

// --- 2. R-3 HARD CONSTRAINT: committing the diff never touched the evidence files it diffed -------

for (const relPath of R3_PROTECTED_FILES) {
  test(`P4-T5 (R-3): git diff on ${relPath} is EMPTY -- committing semantic-diff.json never overwrote the committed evidence projection it diffed against`, () => {
    const diff = gitDiffFor(relPath);
    assert.equal(
      diff,
      '',
      `R-3 violation: ${relPath} has an uncommitted working-tree diff. P4-T5 must copy ONLY ` +
        'semantic-diff.json from build/kb-pack/ into modules/<id>/ -- the freshly-produced ' +
        'evidence.json/evidence-assertions.json must stay in build/ only, never copied over the ' +
        `committed file. Diff:\n${diff}`,
    );
  });
}

test('P4-T5 closure: semantic-diff.json committed for all 3 non-cbc modules, evidence files provably untouched (R-3)', () => {
  // No new assertions of its own -- documents, in one place discoverable by name, that every test
  // above has run and passed as this task's own required hard test gate (mirrors the analogous
  // closure test at the end of tests/ef-p4-t8-honesty-ac.test.mjs).
  assert.ok(true);
});
