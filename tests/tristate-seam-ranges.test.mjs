/**
 * EP1-T7 seam verification for the menstruating ferritin-threshold branch.
 * These are existing thresholds and rationales; this test introduces no clinical values.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { getFerritinThreshold } from '../modules/anemia/ranges.js';

const cases = [
  {
    state: 'true',
    value: 'true',
    expected: { value: 30, source: 'AAP2026_IDA', rationale: 'all menstruating patients' },
  },
  {
    state: 'false',
    value: 'false',
    expected: { value: 20, source: 'AAP2026_IDA', rationale: 'young or school-aged child' },
  },
  {
    state: 'unknown',
    value: 'unknown',
    expected: { value: 20, source: 'AAP2026_IDA', rationale: 'young or school-aged child' },
  },
  {
    state: 'absent',
    value: undefined,
    expected: { value: 20, source: 'AAP2026_IDA', rationale: 'young or school-aged child' },
  },
];

for (const { state, value, expected } of cases) {
  test(`120-month ferritin threshold resolves the ${state} menstruating state`, () => {
    assert.deepEqual(getFerritinThreshold(120, value), expected);
  });
}
