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
