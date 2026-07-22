// tests/ef-cbc_suite_v1-missingness.test.mjs — P4-T5 (FR-17): missingness-case test corpus for
// the `modules/cbc_suite_v1/` vertical-slice rules, run through the real engine seam
// (`src/engine.js#assess(input, 'cbc_suite_v1', rules, candidates)`).
//
// Companion to tests/ef-cbc_suite_v1-positive.test.mjs — see that file's header for the full
// rule-(a)..(d) roadmap this flat file gains cases for across P4-T5..T8.
//
// Missingness case for rule (a) — IMPORTANT, documents an ALREADY-FLAGGED gap, does not assert a
// safety property that does not exist:
//
// `modules/cbc_suite_v1/rule-provenance.json`'s own committed entry for CBC-NEUT-YOUNGINF-001
// states this exactly: "scope.neonatalOrYoungInfant is a plain boolean derived from
// patient.ageMonths ... when ageMonths is absent it resolves to false, not to a missing/unknown
// state, so this rule does NOT fire and does NOT abstain when age is unrecorded. This vertical
// slice carries no missing-age question rule of its own in modules/cbc_suite_v1/rules.json (unlike
// modules/anemia's committed Q-001) — an unrecorded age is silently treated as 'not a young
// infant' rather than prompted for. Flagged as a known E1 gap (02 §7.3 item 7), not silently
// treated as safe."
//
// The test below asserts that DOCUMENTED ACTUAL behavior — an absent age neither fires the
// alert nor produces any missing-age question (there is none in this module yet) — rather than
// asserting the "age absent -> question/abstention" property this slice does not implement. That
// would be a false-positive test disguising a real gap as covered. If a future task adds the
// missing-age question rule this gap calls for, this test's second assertion
// (`nextQuestions` empty) must be updated alongside it, and the "does NOT abstain" framing above
// removed.
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

test('rule (a) missingness: an absent age does not throw, and does not fire the young-infant alert (documented gap, not a safety claim)', () => {
  const result = assessCbcSuite({ patient: {}, cbc: {} });

  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-NEUT-YOUNGINF-001'),
    'per rule-provenance.json, an absent age resolves scope.neonatalOrYoungInfant to false, so the '
      + 'rule does not fire — this is a known, flagged gap (silent "not a young infant"), not a '
      + 'safe abstention',
  );
  assert.ok(
    !result.alerts.some((entry) => entry.id === 'CBC-NEUT-YOUNGINF-001'),
    'the young-infant alert must not appear when age is unrecorded',
  );
  assert.deepEqual(
    result.nextQuestions,
    [],
    'this module carries no missing-age question rule yet (unlike modules/anemia\'s Q-001) — '
      + 'an unrecorded age is not prompted for',
  );
});

// Missingness case for rule (b) (P4-T6): proves an absent local profile ABSTAINS (surfaces the
// local-range-required note) rather than silently defaulting to a universal ANC cutoff. The ANC
// value below (0.3 x10^9/L) is numerically well below any plausible neutropenia threshold an
// invented universal cutoff might apply — if this module silently fell back to such a cutoff
// despite dec_cbc_local_range_precedence_001's fail-closed intent, the benign-ethnic/Duffy-null
// neutropenia differential candidate (CBC-NEUT-BENIGNDIFF-001, gated on `cbc.neutropenia
// is-present`) would incorrectly fire on this "unknown" status. It must not: `cytopeniaTri` only
// resolves 'true'/'false' from a count value when a compatible local lower bound is present, so a
// low ANC with no local profile stays 'unknown', and no rule anywhere in this module treats
// 'unknown' as a positive match.
test('rule (b) missingness: a low ANC with no local profile abstains (fires the note) instead of falling back to a universal cutoff', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: { anc: 0.3 },
  });

  assert.ok(
    result.provenance.matchedRuleIds.includes('CBC-NEUT-LOCALRANGE-001'),
    'an ANC value with no local profile must match CBC-NEUT-LOCALRANGE-001 regardless of magnitude',
  );
  const note = result.interpretiveNotes.find((entry) => entry.id === 'CBC-NEUT-LOCALRANGE-001');
  assert.ok(
    note.detail.includes('does not fall back to a universal ANC cutoff'),
    'the note must explicitly state that no universal ANC cutoff is applied in place of a local range',
  );
  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-NEUT-BENIGNDIFF-001'),
    'an unresolved (unknown) neutropenia status must not fire the neutropenia-gated differential candidate',
  );
  assert.deepEqual(
    result.rankedDifferential,
    [],
    'no candidate should be produced from a numerically low ANC that has no compatible local profile — '
      + 'proving the module does not invent a universal-threshold conclusion in place of the missing profile',
  );
});

// Missingness case for rule (d) (P4-T8) — IMPORTANT, documents an ALREADY-FLAGGED gap, does not
// assert a safety property that does not exist:
//
// `modules/cbc_suite_v1/rule-provenance.json`'s own committed entry for CBC-MARROW-REDFLAG-001
// states this exactly: "cbc.multilineageCytopenia ... resolves 'unknown' whenever any contributing
// tri-state input cannot be fully assessed (e.g. hemoglobin absent, or a cytopenia count present
// with no compatible local lower bound/local flag) rather than defaulting to 'false'/not-flagged;
// this rule's is-present check only fires on the resolved-true state, so an unknown/missing input
// neither fires this alert nor is silently treated as ruled out. This vertical slice carries no
// dedicated missing-data question rule for this specific fact combination — the same class of
// known E1 gap (02 §7.3 item 7)."
//
// Anemia is present (hb 9 < hbLower 11), but WBC/ANC/platelets counts are supplied with NO
// compatible local range or local flag for any of them — `cytopeniaTri` resolves each to 'unknown'
// (not 'false'), so `triAny([...])` resolves 'unknown', and `multilineageCytopenia` (`triAll`)
// resolves 'unknown' rather than 'true' or 'false'. The alert's `is-present` guard requires a
// resolved-true fact, so it does NOT fire on this unresolved input — this is the documented gap
// (silently not-flagged), not a safe abstention, and there is no missing-data question raised for
// it in this vertical slice.
test('rule (d) missingness: anemia present but every other lineage unresolved (no local profile) does not fire the marrow-red-flag alert (documented gap, not a safety claim)', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: { hemoglobin: 9, wbc: 3, anc: 0.3, platelets: 90 },
  });

  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-MARROW-REDFLAG-001'),
    'per rule-provenance.json, an unresolved (unknown) multilineageCytopenia fact does not fire — '
      + 'this is a known, flagged gap (silently not-flagged), not a safe abstention',
  );
  assert.ok(
    !result.alerts.some((entry) => entry.id === 'CBC-MARROW-REDFLAG-001'),
    'the marrow-red-flag alert must not appear when co-occurring cytopenia status is unresolved',
  );
});

// Missingness case for rule (c) (P4-T7): per this module's rule-provenance.json entry for
// CBC-NEUT-BENIGNDIFF-001, `cbc.neutropenia` resolves to 'unknown' whenever neutropenia status
// cannot be fully assessed — including the case exercised here, an ANC value ABSENT entirely and
// no local-lab neutropenia flag supplied. CBC-NEUT-BENIGNDIFF-001's `is-present` guard fires only
// on the resolved-true state, so an 'unknown' status must never be silently treated as a positive
// pattern match.
test('rule (c) missingness: an unknown neutropenia state (absent ANC and no local flag) does not fire the candidate', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: {},
  });

  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-NEUT-BENIGNDIFF-001'),
    'an unassessed (unknown) cbc.neutropenia state must not match CBC-NEUT-BENIGNDIFF-001',
  );
  assert.ok(
    !result.rankedDifferential.some(
      (entry) => entry.id === 'benign-ethnic-neutropenia-differential-pattern',
    ),
    'the benign-ethnic-neutropenia-differential-pattern candidate must not fire on an unknown neutropenia state',
  );
});
