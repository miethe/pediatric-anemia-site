import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { validateBooleanFactPathAllowList } from '../scripts/validate-kb.mjs';

const patientInputSchema = JSON.parse(await readFile(new URL('../schemas/patient-input.schema.json', import.meta.url), 'utf8'));
const ruleSchema = JSON.parse(await readFile(new URL('../schemas/rule.schema.json', import.meta.url), 'utf8'));
const anemiaRules = JSON.parse(await readFile(new URL('../modules/anemia/rules.json', import.meta.url), 'utf8'));

function validateHistoryValue(value) {
  return validate(patientInputSchema, { history: { pica: value } });
}

test('booleanMap remains wire-compatible with bare booleans', () => {
  assert.deepEqual(validateHistoryValue(true), []);
});

for (const state of ['true', 'false', 'unknown']) {
  test(`booleanMap accepts the tri-state string ${state}`, () => {
    assert.deepEqual(validateHistoryValue(state), []);
  });
}

test('booleanMap rejects out-of-enum strings', () => {
  const errors = validateHistoryValue('maybe');
  assert.ok(errors.length > 0);
  assert.match(errors[0].message, /anyOf/);
});

test('validate-kb rejects and names an unrecognized boolean fact field', () => {
  const errors = validateBooleanFactPathAllowList([{
    id: 'TEST-UNKNOWN-BOOLEAN-FIELD',
    when: { fact: 'history.unrecognizedBooleanField', op: 'eq', value: true },
  }], 'anemia');

  assert.deepEqual(errors, [
    'anemia/TEST-UNKNOWN-BOOLEAN-FIELD: unrecognized boolean fact field "history.unrecognizedBooleanField"',
  ]);
});

test('every anemia rule validates against rule.schema.json', () => {
  for (const rule of anemiaRules) {
    assert.deepEqual(validate(ruleSchema, rule), [], `${rule.id}: rule.schema.json errors`);
  }
});

test('rule.schema.json rejects a synthetic bogus operator', () => {
  const syntheticRule = structuredClone(anemiaRules[0]);
  syntheticRule.when.op = 'bogus-operator';

  const errors = validate(ruleSchema, syntheticRule);
  assert.ok(errors.length > 0, 'a bogus operator must fail rule.schema.json validation');
  assert.ok(
    errors.some((error) => error.path === '$.when' && /oneOf/.test(error.message)),
    `expected the condition oneOf to reject the bogus operator; got ${JSON.stringify(errors)}`,
  );
});
