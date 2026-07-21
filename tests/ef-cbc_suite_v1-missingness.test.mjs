// tests/ef-cbc_suite_v1-missingness.test.mjs — P4-T5 (FR-17): missingness-case test corpus for
// the `modules/cbc_suite_v1/` vertical-slice rules, run through the real engine seam
// (`src/engine.js#assess(input, 'cbc_suite_v1', rules, candidates)`).
//
// Companion to tests/ef-cbc_suite_v1-positive.test.mjs — see that file's header for the full
// rule-(a)..(d) roadmap this flat file gains cases for across P4-T5..T8.
//
// Missingness case for rule (a) — IMPORTANT, documents an ALREADY-FLAGGED gap, does not assert a
// safety property that does not exist:
//
// `modules/cbc_suite_v1/rule-provenance.json`'s own committed entry for CBC-NEUT-YOUNGINF-001
// states this exactly: "scope.neonatalOrYoungInfant is a plain boolean derived from
// patient.ageMonths ... when ageMonths is absent it resolves to false, not to a missing/unknown
// state, so this rule does NOT fire and does NOT abstain when age is unrecorded. This vertical
// slice carries no missing-age question rule of its own in modules/cbc_suite_v1/rules.json (unlike
// modules/anemia's committed Q-001) — an unrecorded age is silently treated as 'not a young
// infant' rather than prompted for. Flagged as a known E1 gap (02 §7.3 item 7), not silently
// treated as safe."
//
// The test below asserts that DOCUMENTED ACTUAL behavior — an absent age neither fires the
// alert nor produces any missing-age question (there is none in this module yet) — rather than
// asserting the "age absent -> question/abstention" property this slice does not implement. That
// would be a false-positive test disguising a real gap as covered. If a future task adds the
// missing-age question rule this gap calls for, this test's second assertion
// (`nextQuestions` empty) must be updated alongside it, and the "does NOT abstain" framing above
// removed.
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

test('rule (a) missingness: an absent age does not throw, and does not fire the young-infant alert (documented gap, not a safety claim)', () => {
  const result = assessCbcSuite({ patient: {}, cbc: {} });

  assert.ok(
    !result.provenance.matchedRuleIds.includes('CBC-NEUT-YOUNGINF-001'),
    'per rule-provenance.json, an absent age resolves scope.neonatalOrYoungInfant to false, so the '
      + 'rule does not fire — this is a known, flagged gap (silent "not a young infant"), not a '
      + 'safe abstention',
  );
  assert.ok(
    !result.alerts.some((entry) => entry.id === 'CBC-NEUT-YOUNGINF-001'),
    'the young-infant alert must not appear when age is unrecorded',
  );
  assert.deepEqual(
    result.nextQuestions,
    [],
    'this module carries no missing-age question rule yet (unlike modules/anemia\'s Q-001) — '
      + 'an unrecorded age is not prompted for',
  );
});
