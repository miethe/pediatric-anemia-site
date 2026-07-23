// tests/ef-rule-emission-invariant.test.mjs — P1-T6 (multi-bundle-conversion-e1-finish, Phase 1,
// FR-F24).
//
// A repo-level invariant, independent of any single converter run: this pass's fail-closed
// emission gate (P1-T2/T3/T4/T8) must leave the repository's COMMITTED knowledge-base state
// exactly as it already was —
//
//   (a) modules/kidney_suite_v1/rules.json and modules/growth_suite_v1/rules.json stay the empty
//       array `[]` — committed, pre-existing (per the prior E1 pass, PR #22), unaffected by this
//       phase (this phase touches zero module content — schemas/authoring-decisions.schema.json,
//       tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs, scripts/evidence/govern-staged-rules.mjs,
//       tools/rf-bundle-to-kb-pack/lib/errors.mjs only).
//   (b) modules/anemia/rules.json's 91 hand-authored, pre-existing rules stay byte-identical to a
//       pinned baseline SHA-256 — this pass never touches them. They predate the converter entirely
//       (hand-authored, not converter output) — this is exactly what distinguishes them from what
//       this invariant actually forbids (a converter-drafted rule appearing in a module this pass
//       must keep at zero new clinical rules), not a claim that anemia's rules are somehow immune
//       to ever changing for other reasons.
//   (c) none of anemia/kidney_suite_v1/growth_suite_v1 has a rule-provenance.json file at all —
//       only cbc_suite_v1 (this repo's ONE already-committed, already-verified rule content) does.
//
// Per this task's own binding acceptance criteria, this test MUST stay green through every
// subsequent phase (P2/P3/P4) — re-verified at each phase's own GATE row, not merely assumed here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Captured from the real, committed modules/anemia/rules.json at Phase 1 authoring time (`shasum
// -a 256 modules/anemia/rules.json`) — a genuine regression pin, not a re-assertion of "whatever
// the file currently is."
const ANEMIA_RULES_JSON_SHA256 = 'f1317f02bca4e46226be04bb131101024a6822a19caf1987b2ffff6ce7bf01a8';

const NON_CONVERTER_MODULES_WITH_EMPTY_RULES = ['kidney_suite_v1', 'growth_suite_v1'];
const ALL_NON_CBC_MODULES = ['anemia', 'kidney_suite_v1', 'growth_suite_v1'];

test('FR-F24 (a): modules/kidney_suite_v1/rules.json and modules/growth_suite_v1/rules.json stay the empty array []', async () => {
  for (const moduleId of NON_CONVERTER_MODULES_WITH_EMPTY_RULES) {
    const rulesPath = path.join(REPO_ROOT, 'modules', moduleId, 'rules.json');
    const raw = await readFile(rulesPath, 'utf8');
    const parsed = JSON.parse(raw);
    assert.ok(Array.isArray(parsed), `modules/${moduleId}/rules.json must be a JSON array`);
    assert.equal(parsed.length, 0, `modules/${moduleId}/rules.json must stay empty ([]) — this phase emits zero new clinical rules`);
  }
});

test('FR-F24 (b): modules/anemia/rules.json\'s 91 hand-authored, pre-existing rules stay byte-identical to the pinned Phase-1 baseline (this pass never touches them)', async () => {
  const rulesPath = path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json');
  const raw = await readFile(rulesPath, 'utf8');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.length, 91, 'modules/anemia/rules.json must still carry exactly its 91 hand-authored rules');
  const actualSha256 = createHash('sha256').update(raw).digest('hex');
  assert.equal(
    actualSha256,
    ANEMIA_RULES_JSON_SHA256,
    'modules/anemia/rules.json must be byte-identical (by SHA-256) to the pinned Phase-1 baseline — ' +
      'these 91 rules predate the converter entirely and are never "traceable to converter output"',
  );
});

test('FR-F24 (c): none of anemia/kidney_suite_v1/growth_suite_v1 has a rule-provenance.json file — only cbc_suite_v1 (the one already-committed, already-verified rule content) does', async () => {
  for (const moduleId of ALL_NON_CBC_MODULES) {
    const provenancePath = path.join(REPO_ROOT, 'modules', moduleId, 'rule-provenance.json');
    await assert.rejects(
      () => access(provenancePath),
      (err) => {
        assert.equal(err.code, 'ENOENT', `modules/${moduleId}/rule-provenance.json must not exist`);
        return true;
      },
    );
  }

  // Sanity control: cbc_suite_v1's own committed rule-provenance.json DOES exist (proves the
  // assertion above is a real, non-vacuous existence check, not an artifact of a wrong path).
  const cbcProvenancePath = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'rule-provenance.json');
  await access(cbcProvenancePath); // throws (fails the test) if missing
});

test('FR-F24 sanity: cbc_suite_v1\'s own committed rules.json still carries its 4 rules (not itself zeroed by this invariant)', async () => {
  const rulesPath = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'rules.json');
  const parsed = JSON.parse(await readFile(rulesPath, 'utf8'));
  assert.equal(parsed.length, 4);
});
