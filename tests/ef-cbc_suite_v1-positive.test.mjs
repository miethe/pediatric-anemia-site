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
