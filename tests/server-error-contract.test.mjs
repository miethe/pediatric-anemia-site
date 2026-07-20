import assert from 'node:assert/strict';
import test from 'node:test';
import { RangeUnitMismatchError } from '../src/ranges/registry.js';
import { shapeServerError } from '../src/serverErrors.js';
import { UnitRejectionError } from '../src/units.js';

test('filesystem and arbitrary error metadata is not exposed', () => {
  const missing = new Error('internal filesystem message');
  missing.code = 'ENOENT';
  missing.details = [{ internal: true }];

  assert.deepEqual(shapeServerError(missing), {
    status: 404,
    body: { error: 'Not found' },
  });

  const arbitrary = new Error('Invalid request');
  arbitrary.code = 'INTERNAL_PARSE_CODE';
  arbitrary.details = [{ internal: true }];

  assert.deepEqual(shapeServerError(arbitrary), {
    status: 400,
    body: { error: 'Invalid request' },
  });
});

test('typed patient-input unit rejection retains null providedUnit details', () => {
  const error = new UnitRejectionError([{
    field: 'cbc.hemoglobin',
    providedUnit: null,
    expectedUnit: 'g/dL',
    reason: 'unrecognized',
  }]);

  assert.deepEqual(shapeServerError(error), {
    status: 400,
    body: {
      error: 'Unit mismatch or unrecognized unit in patient input.',
      code: 'UNIT_REJECTED',
      details: [{
        field: 'cbc.hemoglobin',
        providedUnit: null,
        expectedUnit: 'g/dL',
        reason: 'unrecognized',
      }],
    },
  });
});

test('typed patient-input unit rejection stringifies numeric providedUnit details', () => {
  const error = new UnitRejectionError([{
    field: 'labs.stfrFerritinIndex',
    providedUnit: 0,
    expectedUnit: '1',
    reason: 'incompatible',
  }]);

  const shaped = shapeServerError(error);
  assert.equal(shaped.body.details[0].providedUnit, '0');
  assert.equal(typeof shaped.body.details[0].providedUnit, 'string');
});

test('typed missing-reference-unit rejection details are forwarded', () => {
  const error = new RangeUnitMismatchError(
    'cbc.hemoglobin',
    undefined,
    undefined,
    'missing_reference_unit',
  );
  const shaped = shapeServerError(error);

  assert.equal(shaped.status, 400);
  assert.equal(shaped.body.code, 'UNIT_REJECTED');
  assert.deepEqual(shaped.body.details, error.details);
  assert.deepEqual(JSON.parse(JSON.stringify(shaped.body)), {
    error: 'Reference unit missing for cbc.hemoglobin.',
    code: 'UNIT_REJECTED',
    details: [{
      field: 'cbc.hemoglobin',
      providedUnit: null,
      expectedUnit: null,
      reason: 'missing_reference_unit',
    }],
  });
});
