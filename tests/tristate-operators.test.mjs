import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCondition } from '../src/ruleEngine.js';
import { allAssessed, anyUnknown, countPresent, toTri } from '../src/facts/tristate.js';

const operatorCases = [
  {
    op: 'is-present',
    expected: [true, false, false, true, false, false],
  },
  {
    op: 'is-absent',
    expected: [false, true, false, false, true, false],
  },
  {
    op: 'is-unknown',
    expected: [false, false, true, false, false, true],
  },
  {
    op: 'is-not-assessed',
    expected: [false, false, true, false, false, true],
  },
];

const inputCases = [
  { label: "'true'", facts: { value: 'true' } },
  { label: "'false'", facts: { value: 'false' } },
  { label: "'unknown'", facts: { value: 'unknown' } },
  { label: 'true', facts: { value: true } },
  { label: 'false', facts: { value: false } },
  { label: 'missing path', facts: {} },
];

for (const { op, expected } of operatorCases) {
  test(`${op} has the specified tri-state truth table`, () => {
    inputCases.forEach(({ label, facts }, index) => {
      assert.equal(evaluateCondition({ fact: 'value', op }, facts), expected[index], `${op}: ${label}`);
    });
  });
}

test('unrecognized rule operators still fail closed', () => {
  assert.throws(
    () => evaluateCondition({ fact: 'value', op: 'unrecognized-operator' }, { value: 'true' }),
    /Unknown rule operator: unrecognized-operator/,
  );
});

test('toTri converts booleans and preserves tri-shaped strings', () => {
  assert.equal(toTri(true), 'true');
  assert.equal(toTri(false), 'false');
  assert.equal(toTri('true'), 'true');
  assert.equal(toTri('false'), 'false');
  assert.equal(toTri('unknown'), 'unknown');
  assert.equal(toTri(undefined), 'unknown');
  assert.equal(toTri(null), 'unknown');
  assert.equal(toTri('not-assessed'), 'unknown');
});

test('countPresent excludes unknown values', () => {
  assert.equal(countPresent(['true', 'unknown', true, false, 'false', undefined]), 2);
});

test('anyUnknown recognizes missing and unrecognized values', () => {
  assert.equal(anyUnknown(['true', false]), false);
  assert.equal(anyUnknown(['true', undefined]), true);
  assert.equal(anyUnknown(['not-assessed']), true);
});

test('allAssessed requires every value to have a known tri-state value', () => {
  assert.equal(allAssessed(['true', false]), true);
  assert.equal(allAssessed(['true', null]), false);
  assert.equal(allAssessed(['not-assessed']), false);
});

// EP-1 adjudication (orchestrator): an absence spelled `null` or `''` must behave
// identically to an absent path. Otherwise a prompt-on-unknown question rule would
// silently fail to fire on an explicitly-nulled field — "missingness is never treated
// as normal" must not depend on how the caller encoded the absence.
for (const [label, value] of [['null', null], ["empty string", '']]) {
  test(`is-unknown/is-not-assessed match an absence spelled ${label}`, () => {
    const facts = { history: { pica: value } };
    assert.equal(evaluateCondition({ fact: 'history.pica', op: 'is-unknown' }, facts), true);
    assert.equal(evaluateCondition({ fact: 'history.pica', op: 'is-not-assessed' }, facts), true);
  });

  test(`is-present/is-absent reject an absence spelled ${label}`, () => {
    const facts = { history: { pica: value } };
    assert.equal(evaluateCondition({ fact: 'history.pica', op: 'is-present' }, facts), false);
    assert.equal(evaluateCondition({ fact: 'history.pica', op: 'is-absent' }, facts), false);
  });
}
