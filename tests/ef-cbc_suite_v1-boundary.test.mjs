// tests/ef-cbc_suite_v1-boundary.test.mjs — P4-T5 (FR-17): boundary-case test corpus for the
// `modules/cbc_suite_v1/` vertical-slice rules, run through the real engine seam
// (`src/engine.js#assess(input, 'cbc_suite_v1', rules, candidates)`).
//
// Companion to tests/ef-cbc_suite_v1-positive.test.mjs — see that file's header for the full
// rule-(a)..(d) roadmap this flat file gains cases for across P4-T5..T8. P4-T6/T7's "boundary" is
// a state transition (local-profile presence, `cbc.neutropenia` tri-state), not a numeric edge —
// this file's rule-(a) case is the one genuinely numeric boundary in the slice.
//
// Boundary case for rule (a): exercises the `>=`/`>` operator correctness at the exact 6-month
// edge (`modules/anemia/facts.anemia.js`'s `neonatalOrYoungInfant = ageMonths < SUPPORTED_AGE_MONTHS_MIN`,
// SUPPORTED_AGE_MONTHS_MIN read from `modules/cbc_suite_v1/module.json#supportedAgeMonths.min` = 6).
// The module's supported range is defined as inclusive of the 6-month floor (`ageMonths >= min`),
// so exactly 6 months must NOT be treated as a young infant, while a fraction of a month below 6
// must. Both sub-cases assert against the SAME real assess() call, on either side of the edge, so
// a future accidental swap of `<` for `<=` (or vice versa) in the fact derivation would flip one of
// these two assertions.
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

test('rule (a) boundary: exactly 6 months is in-scope (the floor is inclusive) — alert does not fire', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 6, sexAtBirth: 'male' },
    cbc: {},
  });

  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-NEUT-YOUNGINF-001'),
    'exactly 6 months must be treated as in-scope, not a young infant',
  );
});

test('rule (a) boundary: a fraction of a month below 6 is out-of-scope — alert fires', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 5.9, sexAtBirth: 'male' },
    cbc: { localRanges: { hbLower: 9, mcvLower: 70, mcvUpper: 85 } },
  });

  assert.ok(
    result.provenance.matchedRuleIds.includes('CBC-NEUT-YOUNGINF-001'),
    '5.9 months (just below the 6-month floor) must match CBC-NEUT-YOUNGINF-001',
  );
  assert.ok(result.alerts.some((entry) => entry.id === 'CBC-NEUT-YOUNGINF-001'));
});

// Boundary case for rule (b) (P4-T6): this rule's "boundary" is local-profile PRESENCE, not a
// numeric edge (the ANC value itself is held identical across both sub-cases below — only whether
// a compatible local range accompanies it changes). Sub-case A supplies a local ANC lower reference
// limit alongside the ANC value, so `cbc.neutropenia` resolves definitively (not `'unknown'`) and
// the note must NOT fire. Sub-case B is the exact same ANC value with the local range removed, so
// `cbc.neutropenia` resolves to `'unknown'` and the note MUST fire — proving the rule tracks local-
// profile presence/absence, not the ANC magnitude.
test('rule (b) boundary: an ANC value WITH a compatible local range does not fire the local-range-required note', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: { anc: 3.0, localRanges: { ancLower: 1.5 } },
  });

  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-NEUT-LOCALRANGE-001'),
    'an ANC value accompanied by a compatible local range must not match CBC-NEUT-LOCALRANGE-001',
  );
});

test('rule (b) boundary: the SAME ANC value WITHOUT a compatible local range fires the local-range-required note', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: { anc: 3.0 },
  });

  assert.ok(
    result.provenance.matchedRuleIds.includes('CBC-NEUT-LOCALRANGE-001'),
    'the identical ANC value with no compatible local range must match CBC-NEUT-LOCALRANGE-001',
  );
});

// Boundary case for rule (d) (P4-T8): like rule (b)/(c), this rule's "boundary" is a state
// transition (the co-occurring-cytopenia count crossing from zero to one), not a numeric edge —
// `cbc.multilineageCytopenia`'s own numeric inputs (ANC/WBC/platelets vs local lower bounds)
// already have their edges covered by rule (b)'s boundary case above and are not re-tested here.
// Sub-case A: anemia present + zero of the three other lineages resolved cytopenic (all three
// definitively ruled out) — `triAny(...)` resolves 'false', so `multilineageCytopenia` resolves
// 'false' and the alert must NOT fire. Sub-case B: the IDENTICAL input with exactly ONE of those
// three lineages (ANC) flipped to cytopenic — `triAny(...)` now resolves 'true' on a single
// positive, `multilineageCytopenia` resolves 'true', and the alert MUST fire. Both sub-cases hold
// hemoglobin and every other value fixed across the edge, so a future accidental change to
// `triAny`'s "any one is enough" semantics would flip one of these two assertions.
test('rule (d) boundary: anemia + zero co-occurring cytopenias does not fire the marrow-red-flag alert', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: {
      hemoglobin: 9,
      wbc: 8,
      anc: 2,
      platelets: 250,
      localRanges: { wbcLower: 5, ancLower: 1, plateletsLower: 150 },
    },
  });

  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-MARROW-REDFLAG-001'),
    'anemia with zero co-occurring cytopenias (all three definitively ruled out) must not match '
      + 'CBC-MARROW-REDFLAG-001',
  );
});

test('rule (d) boundary: the SAME anemia with exactly ONE co-occurring cytopenia (ANC) fires the marrow-red-flag alert', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: {
      hemoglobin: 9,
      wbc: 8,
      anc: 0.5,
      platelets: 250,
      localRanges: { wbcLower: 5, ancLower: 1, plateletsLower: 150 },
    },
  });

  assert.ok(
    result.provenance.matchedRuleIds.includes('CBC-MARROW-REDFLAG-001'),
    'anemia with exactly one co-occurring cytopenia (ANC 0.5 < local lower 1) must match '
      + 'CBC-MARROW-REDFLAG-001',
  );
  assert.ok(result.alerts.some((entry) => entry.id === 'CBC-MARROW-REDFLAG-001'));
});

// Boundary case for rule (c) (P4-T7): this rule's `when` gates on the RESOLVED `cbc.neutropenia`
// tri-state, not a numeric threshold of its own (the ANC<0.5 numeric cutoff belongs to rule (d)) —
// so the boundary of interest is the true/false TRANSITION of that fact, not a fractional ANC edge.
// Both sub-cases below hold `cbc.localRanges.ancLower` identical and vary only whether the supplied
// ANC value is strictly below it (`modules/anemia/facts.anemia.js#cytopeniaTri`'s
// `countValue < Number(localLowerBound)` comparison) — proving CBC-NEUT-BENIGNDIFF-001 tracks the
// resolved true/false state, not the local-profile-presence toggle rule (b)'s boundary already
// exercises above.
test('rule (c) boundary: an ANC value strictly below the local lower limit resolves neutropenia true — candidate fires', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: { anc: 0.9, localRanges: { ancLower: 1.0 } },
  });

  assert.ok(
    result.provenance.matchedRuleIds.includes('CBC-NEUT-BENIGNDIFF-001'),
    'an ANC value strictly below the local lower limit must resolve cbc.neutropenia true and match CBC-NEUT-BENIGNDIFF-001',
  );
  assert.ok(
    result.rankedDifferential.some(
      (entry) => entry.id === 'benign-ethnic-neutropenia-differential-pattern',
    ),
  );
});

test('rule (c) boundary: an ANC value AT the local lower limit resolves neutropenia false — candidate does not fire', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: { anc: 1.0, localRanges: { ancLower: 1.0 } },
  });

  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-NEUT-BENIGNDIFF-001'),
    'an ANC value exactly at (not below) the local lower limit must resolve cbc.neutropenia false and must not match CBC-NEUT-BENIGNDIFF-001',
  );
  assert.ok(
    !result.rankedDifferential.some(
      (entry) => entry.id === 'benign-ethnic-neutropenia-differential-pattern',
    ),
  );
});
