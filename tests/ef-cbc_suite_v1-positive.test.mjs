// tests/ef-cbc_suite_v1-positive.test.mjs — P4-T5 (FR-17): positive-case test corpus for the
// `modules/cbc_suite_v1/` vertical-slice rules, run through the real engine seam
// (`src/engine.js#assess(input, 'cbc_suite_v1', rules, candidates)` — the exact path P4-T9's
// integration run re-verifies), never a hand-rolled facts object.
//
// This flat file gains one `test()` per migrated slice rule as P4-T5..T8 land:
//   - rule (a) young-infant/age-under-6-months scope-abstention (CBC-NEUT-YOUNGINF-001) — this file
//   - rule (b) local-lab-range-precedence — P4-T6
//   - rule (c) benign-ethnic/Duffy-null neutropenia differential (CBC-NEUT-BENIGNDIFF-001) — P4-T7
//   - rule (d) marrow-red-flag safety alert — P4-T8
//
// Positive case for rule (a): a patient below the module's 6-month supported-age floor
// (`modules/cbc_suite_v1/module.json#supportedAgeMonths.min`) must produce the
// `CBC-NEUT-YOUNGINF-001` alert.
//
// `cbc.localRanges` is supplied deliberately (not incidental filler): a young-infant age with NO
// local ranges hits `modules/anemia/facts.anemia.js#assertAgeWithinSupportedScope`'s refusal path
// (`AgeOutOfSupportedRangeError`, thrown by `assess()` BEFORE any rule ever evaluates — see
// tests/engine.test.mjs's "young infant outside the supported age range is refused" case for the
// same behavior in the `anemia` module this one delegates `deriveFacts`/`assertInScope` to). This
// fixture instead exercises the documented carve-out — local ranges covering the age — so the
// module proceeds to actually fire rule (a)'s alert, matching
// `tests/witness/alerts/scope-neonatal-young-infant.json`'s established pattern for the identical
// `anemia`-module rule (SCOPE-001) this rule mirrors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assess } from '../src/engine.js';

const rules = JSON.parse(
  await readFile(new URL('../modules/cbc_suite_v1/rules.json', import.meta.url), 'utf8'),
);
const candidates = JSON.parse(
  await readFile(new URL('../modules/cbc_suite_v1/candidates.json', import.meta.url), 'utf8'),
);

function assessCbcSuite(input) {
  return assess(input, 'cbc_suite_v1', rules, candidates);
}

test('rule (a) young-infant scope-abstention fires below the 6-month supported-age floor', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 3, sexAtBirth: 'male' },
    cbc: { localRanges: { hbLower: 9, mcvLower: 70, mcvUpper: 85 } },
  });

  assert.ok(
    result.provenance.matchedRuleIds.includes('CBC-NEUT-YOUNGINF-001'),
    'a 3-month-old (below the 6-month floor) must match CBC-NEUT-YOUNGINF-001',
  );
  const alert = result.alerts.find((entry) => entry.id === 'CBC-NEUT-YOUNGINF-001');
  assert.ok(alert, 'the young-infant scope-abstention alert must be present in result.alerts');
  assert.equal(alert.severity, 'important');
  assert.ok(
    alert.title.toLowerCase().includes('out of scope'),
    'the alert must communicate that interpretation is out of scope, not a clinical finding',
  );
});

// Positive case for rule (d) (P4-T8): `cbc.multilineageCytopenia` (delegated tri-state fact,
// `modules/anemia/facts.anemia.js` — `triAll([anemiaPresentTri, triAny([leukopeniaTri,
// neutropeniaTri, thrombocytopeniaTri])])`) resolves 'true' when anemia is present together with
// at least one other cytopenia. In scope (24 months, well above the 6-month floor) so rule (a)
// does not interfere; `cbc.anc` is omitted so rule (b)'s `cbc.anc exists` guard does not match
// either — this case isolates rule (d) only.
test('rule (d) marrow-red-flag alert fires when anemia co-occurs with another cytopenia (multilineage cytopenia)', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: {
      hemoglobin: 9,
      platelets: 80,
      localRanges: { plateletsLower: 150 },
    },
  });

  assert.ok(
    result.provenance.matchedRuleIds.includes('CBC-MARROW-REDFLAG-001'),
    'anemia (hb 9 < hbLower 11) plus thrombocytopenia (platelets 80 < local lower 150) must match '
      + 'CBC-MARROW-REDFLAG-001',
  );
  const alert = result.alerts.find((entry) => entry.id === 'CBC-MARROW-REDFLAG-001');
  assert.ok(alert, 'the marrow-red-flag alert must be present in result.alerts');
  assert.equal(
    alert.severity,
    'urgent',
    'per 02 §4.6\'s fact/type/unit/missingness resolution requirement, severity must be the '
      + 'evidence-resolved "urgent", never a generic default',
  );
  assert.ok(
    alert.title.toLowerCase().includes('marrow'),
    'the alert must name the marrow-failure/infiltration concern, not a paraphrase',
  );
});

// Positive case for rule (c) (P4-T7, re-scoped per the parent plan's binding "FR-16(c) candidate
// identity" resolution — see this module's rule-provenance.json#CBC-NEUT-BENIGNDIFF-001
// authoringNotes): CBC-NEUT-BENIGNDIFF-001's `when` is the tri-state `cbc.neutropenia` fact
// resolved to `'true'` (`op: "is-present"`, src/ruleEngine.js). `modules/anemia/facts.anemia.js`'s
// `cytopeniaTri(localFlags.neutropenia, anc, cbc.localRanges?.ancLower)` resolves 'true'
// immediately whenever `cbc.localFlags.neutropenia` is truthy, regardless of any ANC value — the
// most direct, unambiguous way to drive the fact to 'true' without also depending on the numeric
// ANC/ancLower comparison rule (b) already covers.
test('rule (c) benign-ethnic/Duffy-null neutropenia differential fires when cbc.neutropenia resolves true', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: { localFlags: { neutropenia: true } },
  });

  assert.ok(
    result.provenance.matchedRuleIds.includes('CBC-NEUT-BENIGNDIFF-001'),
    'a resolved-true cbc.neutropenia fact must match CBC-NEUT-BENIGNDIFF-001',
  );
  const candidate = result.rankedDifferential.find(
    (entry) => entry.id === 'benign-ethnic-neutropenia-differential-pattern',
  );
  assert.ok(
    candidate,
    'the benign-ethnic-neutropenia-differential-pattern candidate must be present in rankedDifferential',
  );
  assert.equal(candidate.level, 'possible');
  assert.ok(
    candidate.matchedRules.includes('CBC-NEUT-BENIGNDIFF-001'),
    'the candidate must record CBC-NEUT-BENIGNDIFF-001 as a matched rule',
  );
});

// Positive case for rule (b) (P4-T6): an ANC value is supplied but NEITHER a local-lab neutropenia
// flag (`cbc.localFlags.neutropenia`) NOR a local/analyzer-specific ANC lower reference limit
// (`cbc.localRanges.ancLower`) is — `modules/anemia/facts.anemia.js#cytopeniaTri` therefore resolves
// `cbc.neutropenia` to `'unknown'` (not `'false'`), and `CBC-NEUT-LOCALRANGE-001`'s `when` clause
// (`cbc.anc exists` AND `cbc.neutropenia is-unknown`) must fire, surfacing the interpretive note
// rather than silently proceeding as if neutropenia had been ruled out.
test('rule (b) local-range-precedence fires when an ANC value has no compatible local profile', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: { anc: 1.0 },
  });

  assert.ok(
    result.provenance.matchedRuleIds.includes('CBC-NEUT-LOCALRANGE-001'),
    'an ANC value with no local flag/range must match CBC-NEUT-LOCALRANGE-001',
  );
  const note = result.interpretiveNotes.find((entry) => entry.id === 'CBC-NEUT-LOCALRANGE-001');
  assert.ok(note, 'the local-range-required note must be present in result.interpretiveNotes');
  assert.ok(
    note.detail.includes('local, analyzer-specific ANC lower reference limit'),
    'the note must direct the clinician to supply a local reference range or flag',
  );
});
