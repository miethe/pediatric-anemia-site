// tests/ef-cbc_suite_v1-negative.test.mjs — P4-T5 (FR-17): negative-case test corpus for the
// `modules/cbc_suite_v1/` vertical-slice rules, run through the real engine seam
// (`src/engine.js#assess(input, 'cbc_suite_v1', rules, candidates)`).
//
// Companion to tests/ef-cbc_suite_v1-positive.test.mjs — see that file's header for the full
// rule-(a)..(d) roadmap this flat file gains cases for across P4-T5..T8.
//
// Negative case for rule (a): a patient at/above the module's 6-month supported-age floor must NOT
// produce the CBC-NEUT-YOUNGINF-001 alert — it is scoped strictly to ages below the floor, not a
// general "always warn" rule.
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

test('rule (a) young-infant scope-abstention does NOT fire at 24 months (well above the floor)', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'female' },
    cbc: {},
  });

  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-NEUT-YOUNGINF-001'),
    'a 24-month-old (well above the 6-month floor) must not match CBC-NEUT-YOUNGINF-001',
  );
  assert.ok(
    !result.alerts.some((entry) => entry.id === 'CBC-NEUT-YOUNGINF-001'),
    'the young-infant scope-abstention alert must not appear in result.alerts for an in-scope age',
  );
});

// Negative case for rule (b) (P4-T6): an explicit local-lab neutropenia flag is a valid local
// profile in its own right (`modules/anemia/facts.anemia.js#cytopeniaTri` short-circuits to
// `'false'` on an explicit `localFlags.neutropenia: false`, without needing a numeric
// `localRanges.ancLower` at all) — once neutropenia status is actually resolved,
// `CBC-NEUT-LOCALRANGE-001`'s `is-unknown` guard must NOT match, so the note must not fire.
test('rule (b) local-range-precedence does NOT fire when a local-lab flag already resolves neutropenia status', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: { anc: 1.0, localFlags: { neutropenia: false } },
  });

  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-NEUT-LOCALRANGE-001'),
    'a resolved (non-unknown) neutropenia status via a local-lab flag must not match CBC-NEUT-LOCALRANGE-001',
  );
  assert.ok(
    !result.interpretiveNotes.some((entry) => entry.id === 'CBC-NEUT-LOCALRANGE-001'),
    'the local-range-required note must not appear once a local profile has resolved neutropenia status',
  );
});

// Negative case for rule (c) (P4-T7): a resolved-FALSE cbc.neutropenia fact (an explicit
// local-lab flag of `false`) must NOT match CBC-NEUT-BENIGNDIFF-001 — the rule's `is-present`
// guard fires only on the resolved-true state, never on a resolved-false one.
test('rule (c) benign-ethnic/Duffy-null neutropenia differential does NOT fire when cbc.neutropenia resolves false', () => {
  const result = assessCbcSuite({
    patient: { ageMonths: 24, sexAtBirth: 'male' },
    cbc: { localFlags: { neutropenia: false } },
  });

  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-NEUT-BENIGNDIFF-001'),
    'a resolved-false cbc.neutropenia fact must not match CBC-NEUT-BENIGNDIFF-001',
  );
  assert.ok(
    !result.rankedDifferential.some(
      (entry) => entry.id === 'benign-ethnic-neutropenia-differential-pattern',
    ),
    'the benign-ethnic-neutropenia-differential-pattern candidate must not appear in rankedDifferential',
  );
});

// Negative case for rule (d) (P4-T8): isolated anemia — anemia present, but every other lineage
// (WBC/ANC/platelets) is explicitly resolved NOT cytopenic via a compatible local range — must NOT
// fire CBC-MARROW-REDFLAG-001. `multilineageCytopenia = triAll([anemiaPresentTri,
// triAny([leukopeniaTri, neutropeniaTri, thrombocytopeniaTri])])` resolves 'false' whenever the
// second `triAny` term resolves 'false' (all three lineages definitively ruled out), regardless of
// anemia being present — proving the rule is genuinely gated on CO-OCCURRING cytopenia, not on
// anemia alone.
test('rule (d) marrow-red-flag alert does NOT fire for isolated anemia with no co-occurring cytopenia', () => {
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
    'anemia present with every other lineage definitively ruled out (not cytopenic) must not match '
      + 'CBC-MARROW-REDFLAG-001',
  );
  assert.ok(
    !result.alerts.some((entry) => entry.id === 'CBC-MARROW-REDFLAG-001'),
    'the marrow-red-flag alert must not appear in result.alerts for isolated (non-multilineage) anemia',
  );
});
