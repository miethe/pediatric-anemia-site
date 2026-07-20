/**
 * Regression coverage for the three defects found by the final adversarial verification pass.
 *
 * Each of these survived the full 560-test suite, so each test here is written to fail against
 * the pre-fix behavior rather than merely restate the fix.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { assessPediatricAnemia } from '../src/engine.js';
import { classifyUnit, prepareUnitValidatedInput } from '../src/units.js';
import { getEffectiveRanges } from '../modules/anemia/ranges.js';

const rules = JSON.parse(readFileSync(new URL('../modules/anemia/rules.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(readFileSync(new URL('../modules/anemia/candidates.json', import.meta.url), 'utf8'));

const PATIENT = { ageMonths: 120, sexAtBirth: 'female' };

test('a non-string unit is never coerced into an accepted spelling', () => {
  // `String(["g/dL"]) === "g/dL"`, so a schema-invalid array previously stringified into the
  // canonical unit and produced a clinical assessment over the real API path.
  const spec = { canonical: 'g/dL', synonyms: ['g/dl'], confusables: [{ unit: 'g/L' }] };
  for (const provided of [['g/dL'], ['g/dl'], 1, true, { toString: () => 'g/dL' }, null, undefined]) {
    const classification = classifyUnit(spec, provided);
    assert.equal(classification.accepted, false, `expected rejection for ${JSON.stringify(provided)}`);
  }
  assert.equal(classifyUnit(spec, 'g/dL').accepted, true);
  assert.equal(classifyUnit(spec, 'g/dl').accepted, true);
});

test('an array-wrapped canonical unit is rejected at the assessment boundary', () => {
  assert.throws(
    () => assessPediatricAnemia(
      { patient: PATIENT, cbc: { hemoglobin: 11, hemoglobinUnit: ['g/dL'] } },
      rules,
      candidates,
    ),
    (error) => error.code === 'UNIT_REJECTED'
      && error.details[0].field === 'cbc.hemoglobin'
      && error.details[0].reason === 'unrecognized',
  );
});

test('cached validation metadata cannot be mutated to suppress a disclosed assumption', () => {
  const raw = { patient: PATIENT, cbc: { hemoglobin: 11 } };
  const prepared = prepareUnitValidatedInput('anemia', raw);

  const assumed = prepared.unitValidation.fields.find((field) => field.field === 'cbc.hemoglobin');
  assert.equal(assumed.unitAssumed, true, 'precondition: the omitted unit is assumed');

  // Freezing must make the suppression attempt a no-op (silent in sloppy mode, throwing in strict).
  assert.throws(() => { assumed.unitAssumed = false; }, TypeError);
  assert.equal(prepared.unitValidation.fields.find((f) => f.field === 'cbc.hemoglobin').unitAssumed, true);

  const result = assessPediatricAnemia(raw, rules, candidates);
  assert.ok(
    result.provenance.unitsAssumed.includes('cbc.hemoglobin'),
    'the assumption must still be disclosed in provenance',
  );
});

test('getEffectiveRanges rejects a bad local-range unit when called directly', () => {
  // A local limit takes override precedence over the AAP fallback, so an unchecked
  // `hbLower: 110 g/L` would be compared against an assumed `g/dL` measurement.
  assert.throws(
    () => getEffectiveRanges({
      patient: PATIENT,
      cbc: { hemoglobin: 11.5, localRanges: { hbLower: 110, hbLowerUnit: 'g/L' } },
    }),
    (error) => error.code === 'UNIT_REJECTED'
      && error.details[0].field === 'cbc.localRanges.hbLower'
      && error.details[0].expectedUnit === 'g/dL',
  );
});

test('every local-range key is unit-checked, not just hbLower', () => {
  const cases = [
    ['hbLower', 110, 'g/L'],
    ['mcvLower', 80, 'um3'],
    ['mcvUpper', 95, 'um3'],
    ['rdwUpper', 14, 'not-a-unit'],
  ];
  for (const [key, value, badUnit] of cases) {
    assert.throws(
      () => getEffectiveRanges({
        patient: PATIENT,
        cbc: { hemoglobin: 11.5, localRanges: { [key]: value, [`${key}Unit`]: badUnit } },
      }),
      (error) => error.code === 'UNIT_REJECTED' && error.details[0].field === `cbc.localRanges.${key}`,
      `expected ${key} to be unit-checked`,
    );
  }
});

test('an accepted local-range synonym normalizes the label without changing the number', () => {
  const canonical = getEffectiveRanges({
    patient: PATIENT,
    cbc: { hemoglobin: 11.5, localRanges: { hbLower: 11.2, hbLowerUnit: 'g/dL' } },
  });
  const synonym = getEffectiveRanges({
    patient: PATIENT,
    cbc: { hemoglobin: 11.5, localRanges: { hbLower: 11.2, hbLowerUnit: 'g/dl' } },
  });
  assert.deepEqual(synonym, canonical);
  assert.equal(synonym.hbLower, 11.2);
});

test('an omitted local-range unit is still accepted (OQ-5 assume-and-disclose)', () => {
  const result = assessPediatricAnemia(
    { patient: PATIENT, cbc: { hemoglobin: 11.5, localRanges: { hbLower: 11.2 } } },
    rules,
    candidates,
  );
  assert.ok(result.provenance.unitsAssumed.includes('cbc.localRanges.hbLower'));
});
