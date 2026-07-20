import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBuiltInAnalyteValue,
  getThreshold,
  registerAnalyteBands,
  registerThresholdRule,
} from '../src/ranges/registry.js';
import { getBuiltInRange, getFerritinThreshold } from '../modules/anemia/ranges.js';

const TEST_BAND = {
  minMonths: 0,
  maxMonthsExclusive: 216,
  label: 'test band',
  source: 'TEST_ONLY',
  female: { lower: 1 },
  male: { lower: 1 },
};

const HEMOGLOBIN_UNIT_SPEC = {
  canonical: 'g/dL',
  synonyms: ['g/dl'],
  confusables: [{ unit: 'g/L' }],
};

test('registered band with absent reference-unit metadata fails closed at lookup', () => {
  const moduleId = 'test-missing-band-reference-unit';
  registerAnalyteBands(moduleId, 'analyte', [TEST_BAND]);

  assert.throws(
    () => getBuiltInAnalyteValue(moduleId, 'analyte', 120, 'female'),
    (error) => error.code === 'UNIT_REJECTED'
      && error.details[0].reason === 'missing_reference_unit'
      && error.details[0].expectedUnit === null,
  );
});

test('registered threshold with absent reference-unit metadata fails closed at lookup', () => {
  const moduleId = 'test-missing-threshold-reference-unit';
  registerThresholdRule(moduleId, 'analyte', { get: () => ({ value: 1 }) });

  assert.throws(
    () => getThreshold(moduleId, 'analyte', {}),
    (error) => error.code === 'UNIT_REJECTED'
      && error.details[0].reason === 'missing_reference_unit'
      && error.details[0].expectedUnit === null,
  );
});

test('registered band reference unit is validated even when the request unit is omitted', () => {
  const moduleId = 'test-invalid-band-reference-unit';
  registerAnalyteBands(moduleId, 'analyte', [{ ...TEST_BAND, unit: 'g/L' }], HEMOGLOBIN_UNIT_SPEC);

  assert.throws(
    () => getBuiltInAnalyteValue(moduleId, 'analyte', 120, 'female'),
    (error) => error.code === 'UNIT_REJECTED'
      && error.details[0].reason === 'invalid_reference_unit'
      && error.details[0].providedUnit === null
      && error.details[0].expectedUnit === 'g/L',
  );
});

test('whitespace-only registered reference units fail closed', () => {
  const bandModuleId = 'test-whitespace-band-reference-unit';
  registerAnalyteBands(
    bandModuleId,
    'analyte',
    [{ ...TEST_BAND, unit: ' ' }],
    HEMOGLOBIN_UNIT_SPEC,
  );
  assert.throws(
    () => getBuiltInAnalyteValue(bandModuleId, 'analyte', 120, 'female'),
    (error) => error.details[0].reason === 'missing_reference_unit',
  );

  const thresholdModuleId = 'test-whitespace-threshold-reference-unit';
  registerThresholdRule(thresholdModuleId, 'analyte', {
    unit: '   ',
    unitSpec: HEMOGLOBIN_UNIT_SPEC,
    get: () => ({ value: 1 }),
  });
  assert.throws(
    () => getThreshold(thresholdModuleId, 'analyte', {}),
    (error) => error.details[0].reason === 'missing_reference_unit',
  );
});

test('unregistered range lookups remain tolerant before unit validation', () => {
  assert.equal(
    getBuiltInAnalyteValue('test-unregistered-module', 'analyte', 120, 'female', 'wrong/unit'),
    null,
  );
  assert.equal(
    getThreshold('test-unregistered-module', 'analyte', {}, 'wrong/unit'),
    null,
  );
});

test('direct built-in range lookup accepts registered notation synonyms without changing values', () => {
  const canonical = getBuiltInRange(120, 'female', { hb: 'g/dL', mcv: 'fL', rdw: '%' });
  const synonyms = getBuiltInRange(120, 'female', { hb: 'g/dl', mcv: 'fL', rdw: '%' });

  assert.deepEqual(synonyms, canonical);
});

test('direct ferritin threshold accepts ASCII and Unicode synonyms without changing values', () => {
  const canonical = getFerritinThreshold(120, false, 'ng/mL');

  assert.deepEqual(getFerritinThreshold(120, false, 'ug/L'), canonical);
  assert.deepEqual(getFerritinThreshold(120, false, 'µg/L'), canonical);
  assert.deepEqual(getFerritinThreshold(120, false, 'μg/L'), canonical);
});
