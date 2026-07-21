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
