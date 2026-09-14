import test from 'node:test';
import assert from 'node:assert/strict';

import {
  captureStateFromControlValue,
  controlValueFromState,
  isAssessed,
  isPresent,
  stateFromControlValue,
} from '../src/facts/fieldState.js';

test('four questionnaire control values serialize without a fourth engine value', () => {
  assert.equal(stateFromControlValue('true'), 'true');
  assert.equal(stateFromControlValue('false'), 'false');
  assert.equal(stateFromControlValue('unknown'), 'unknown');
  assert.equal(stateFromControlValue(''), undefined);
  assert.equal(stateFromControlValue('unexpected'), undefined);
});

test('existing engine values round-trip to distinct controls', () => {
  assert.equal(controlValueFromState(true), 'true');
  assert.equal(controlValueFromState(false), 'false');
  assert.equal(controlValueFromState('unknown'), 'unknown');
  assert.equal(controlValueFromState(undefined), '');
  assert.notEqual(controlValueFromState('false'), controlValueFromState('unknown'));
});

test('capture envelope keeps every clinician-facing state inspectable', () => {
  assert.deepEqual(['true', 'false', 'unknown', ''].map(captureStateFromControlValue), [
    'present', 'absent', 'unknown', 'not-assessed',
  ]);
});

test('presence and assessment are separate predicates', () => {
  assert.equal(isPresent('true'), true);
  assert.equal(isPresent('false'), false);
  assert.equal(isPresent('unknown'), false);
  assert.equal(isAssessed('true'), true);
  assert.equal(isAssessed('false'), true);
  assert.equal(isAssessed('unknown'), true);
  assert.equal(isAssessed(undefined), false);
});

test('smear review uses the same four capture states without adding an engine literal', () => {
  assert.equal(captureStateFromControlValue('true'), 'present');
  assert.equal(captureStateFromControlValue('false'), 'absent');
  assert.equal(captureStateFromControlValue('unknown'), 'unknown');
  assert.equal(captureStateFromControlValue(''), 'not-assessed');
  assert.equal(stateFromControlValue(''), undefined);
});
