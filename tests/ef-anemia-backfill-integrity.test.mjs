// tests/ef-anemia-backfill-integrity.test.mjs — P4-T4 (multi-bundle-conversion-e1, Phase 4).
//
// Seam task (R-P3, Risk 1 closure). P4-T2 landed a NEW, additive `modules/anemia/
// evidence-assertions.json` (RF-EV-001 backfill, EF pipeline) alongside the PRE-EXISTING
// `modules/anemia/rules.json` (91 rules) and `modules/anemia/evidence.json` (the EP-3/EP-4
// pipeline's evidence store, unchanged). This file is the explicit join point proving that
// additive backfill did not silently corrupt the pre-existing rule<->evidence graph:
//
//   1. `modules/anemia/rules.json` and `modules/anemia/evidence.json` are still byte-identical to
//      the P4-T1 pre-merge baseline (scripts/lib/p4-t1-snapshot.mjs) -- the backfill's own
//      acceptance criterion (P4-T2) restated here as this seam task's own independent check, not
//      borrowed by reference alone.
//   2. Every `evidenceId` a rule cites via its `evidence[]` array still resolves to a real source
//      in `modules/anemia/evidence.json`'s `sources[]`.
//   3. Every `evidenceRef` a rule cites via its `sourcePassageId` field (the passage-level
//      pointer, `<sourceId>#<passageId>`) still resolves to a real passage record under that
//      source.
//   4. Zero unresolved references exist anywhere across all 91 rules -- reported as a single,
//      named list on failure, not merely "some rule failed."
//
// `scripts/validate-kb.mjs` (npm run validate) already performs an equivalent check as part of
// full module validation -- this test is a deliberately independent, narrowly-scoped assertion
// dedicated to the Phase 4 seam so its pass/fail is legible on its own, without relying on the
// validator's much broader surface to prove this one specific invariant held after the backfill.
//
// This test does not re-run the rest of `modules/anemia/`'s test suite -- that suite already runs
// unchanged, in full, under `npm test` (tests/engine.test.mjs, tests/rule-governance.test.mjs,
// tests/dangerous-miss-scenarios.test.mjs, tests/rule-coverage.test.mjs, tests/property.test.mjs,
// tests/mutation.test.mjs, tests/tristate-*.test.mjs, tests/units-*.test.mjs, and more), and this
// phase adds no changes to any of those tests or their fixtures. `npm test` passing 100% (verified
// as part of landing this task) IS the "full existing modules/anemia/ test suite passes unchanged"
// half of P4-T4's acceptance criteria; this file is the phase's dedicated NEW check for the other
// half (the reference-integrity join point).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeSnapshot, WHOLE_FILE_TARGETS } from '../scripts/lib/p4-t1-snapshot.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json');
const EVIDENCE_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'evidence.json');
const P4T1_FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'p4-t1-pre-merge-snapshot.json.txt');

const ANEMIA_WHOLE_FILE_TARGETS = WHOLE_FILE_TARGETS.filter((relPath) => relPath.startsWith('modules/anemia/'));

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

let rules;
let evidence;

test('modules/anemia/rules.json and evidence.json load', async () => {
  rules = await loadJson(RULES_PATH);
  evidence = await loadJson(EVIDENCE_PATH);
  assert.ok(Array.isArray(rules));
  assert.ok(Array.isArray(evidence.sources));
});

test('sanity: exactly 91 anemia rules remain after the RF-EV-001 backfill (P4-T2 added zero rules)', () => {
  assert.equal(rules.length, 91, 'modules/anemia/rules.json must still carry exactly 91 rules');
});

test("modules/anemia/rules.json and evidence.json are byte-identical to the P4-T1 pre-merge baseline (backfill did not touch either file)", async () => {
  const fixture = await loadJson(P4T1_FIXTURE_PATH);
  const current = await computeSnapshot(REPO_ROOT);
  assert.ok(
    ANEMIA_WHOLE_FILE_TARGETS.length >= 2,
    'sanity: expected modules/anemia/rules.json and evidence.json to be in scope for this comparison',
  );
  for (const relPath of ANEMIA_WHOLE_FILE_TARGETS) {
    assert.equal(
      current.files[relPath].sha256,
      fixture.files[relPath].sha256,
      `${relPath} has drifted from the P4-T1 pre-merge snapshot -- P4-T2's evidence-assertions.json backfill must never touch this file`,
    );
    assert.equal(current.files[relPath].byteLength, fixture.files[relPath].byteLength, relPath);
  }
});

test('every rule-cited evidenceId (rule.evidence[]) resolves to a real source in evidence.json', () => {
  const sourceIds = new Set(evidence.sources.map((source) => source.id));
  const unresolved = [];
  for (const rule of rules) {
    for (const evidenceId of rule.evidence ?? []) {
      if (!sourceIds.has(evidenceId)) {
        unresolved.push({ ruleId: rule.id, evidenceId, kind: 'rule.evidence[] -> evidence.sources[].id' });
      }
    }
  }
  assert.deepEqual(
    unresolved,
    [],
    `found ${unresolved.length} unresolved rule.evidence[] reference(s) introduced or exposed by the RF-EV-001 backfill: ${JSON.stringify(unresolved, null, 2)}`,
  );
});

test('every rule-cited evidenceRef (rule.sourcePassageId) resolves to a real passage record in evidence.json', () => {
  const passageIds = new Set();
  for (const source of evidence.sources) {
    for (const passage of source.passages ?? []) {
      passageIds.add(passage.id);
    }
  }
  const unresolved = [];
  for (const rule of rules) {
    const ref = rule.sourcePassageId;
    if (ref === undefined || ref === null) continue; // absence is covered by rule-governance.test.mjs, not this seam task
    if (!passageIds.has(ref)) {
      unresolved.push({ ruleId: rule.id, evidenceRef: ref, kind: 'rule.sourcePassageId -> evidence.sources[].passages[].id' });
    }
  }
  assert.deepEqual(
    unresolved,
    [],
    `found ${unresolved.length} unresolved rule.sourcePassageId reference(s) introduced or exposed by the RF-EV-001 backfill: ${JSON.stringify(unresolved, null, 2)}`,
  );
});

test('zero unresolved references across the full rule<->evidence graph (single combined assertion)', () => {
  const sourceIds = new Set(evidence.sources.map((source) => source.id));
  const passageIds = new Set();
  for (const source of evidence.sources) {
    for (const passage of source.passages ?? []) {
      passageIds.add(passage.id);
    }
  }

  const unresolved = [];
  for (const rule of rules) {
    for (const evidenceId of rule.evidence ?? []) {
      if (!sourceIds.has(evidenceId)) {
        unresolved.push(`${rule.id}: evidence[] cites unresolved source "${evidenceId}"`);
      }
    }
    if (rule.sourcePassageId != null && !passageIds.has(rule.sourcePassageId)) {
      unresolved.push(`${rule.id}: sourcePassageId cites unresolved passage "${rule.sourcePassageId}"`);
    }
  }

  assert.equal(
    unresolved.length,
    0,
    `Phase 4's RF-EV-001 additive backfill (P4-T2) must introduce ZERO unresolved rule<->evidence references. Found ${unresolved.length}:\n${unresolved.join('\n')}`,
  );
});
