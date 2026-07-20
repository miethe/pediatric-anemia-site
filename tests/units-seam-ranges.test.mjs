/**
 * EP2-T5 seam verification (consumer side, AC-SEAM).
 *
 * `modules/anemia/ranges.js`'s tri-state-aware `menstruating` read inside
 * `ferritinThresholdRule()` is owned by EP-1 (see `tests/tristate-seam-ranges.test.mjs`). This
 * file does not edit that line, does not import any private/internal symbol from `ranges.js` to
 * monkeypatch it, and does not modify `modules/anemia/ranges.js` in any way — it only calls the
 * module's existing public exports (`getFerritinThreshold`) as a black box, plus the shared
 * `deriveFacts`/`validateUnits`/`normalizeRegisteredUnits`/`assessPediatricAnemia` entry points
 * that already compose with it in production. Verification only.
 *
 * Cross product under test: menstruating tri-state read (5 states, using the repo's own
 * tristate vocabulary confirmed against `tests/tristate-operators.test.mjs` and
 * `src/facts/tristate.js`'s `toTri()`) x ferritin unit (4 states, drawn from
 * `modules/anemia/units.json`'s ferritin row) = 20 combinations.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { assessPediatricAnemia } from '../src/engine.js';
import { validateUnits, normalizeRegisteredUnits } from '../src/units.js';
import { getFerritinThreshold } from '../modules/anemia/ranges.js';
import { deriveFacts } from '../modules/anemia/facts.anemia.js';

const rules = JSON.parse(await readFile(new URL('../modules/anemia/rules.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(await readFile(new URL('../modules/anemia/candidates.json', import.meta.url), 'utf8'));

const AGE_MONTHS = 120; // within [6, 144) months: the "young or school-aged child" age band

// toTri(true) === 'true', toTri(false) === 'false', toTri('unknown') === 'unknown',
// toTri(undefined) === 'unknown', toTri('not-assessed') === 'unknown' (confirmed against
// tests/tristate-operators.test.mjs and src/facts/tristate.js). Only an explicit tri-state
// `true` selects the menstruating branch; every other state falls through to the age-based
// branch — this table is EP-1's own contract, not re-derived from toTri here.
const MENSTRUATING_STATES = [
  { label: 'present-true', value: true, expected: { value: 30, rationale: 'all menstruating patients' } },
  { label: 'present-false', value: false, expected: { value: 20, rationale: 'young or school-aged child' } },
  { label: 'absent', value: undefined, expected: { value: 20, rationale: 'young or school-aged child' } },
  { label: 'unknown', value: 'unknown', expected: { value: 20, rationale: 'young or school-aged child' } },
  { label: 'not-assessed', value: 'not-assessed', expected: { value: 20, rationale: 'young or school-aged child' } },
];

const FERRITIN_UNIT_CASES = [
  { label: 'canonical', unit: 'ng/mL', outcome: 'accept' },
  { label: 'accepted-synonym', unit: 'ug/L', outcome: 'accept' },
  { label: 'rejected-confusable', unit: 'ng/L', outcome: 'reject' },
  { label: 'omitted', unit: undefined, outcome: 'accept' },
];

function buildInput(menstruatingValue, unit) {
  const patient = { ageMonths: AGE_MONTHS, sexAtBirth: 'female' };
  if (menstruatingValue !== undefined) patient.menstruating = menstruatingValue;
  const labs = { ferritin: 50 };
  if (unit !== undefined) labs.ferritinUnit = unit;
  return { patient, labs };
}

test('EP2-T5 cross product covers all 20 menstruating x ferritin-unit combinations', () => {
  assert.equal(MENSTRUATING_STATES.length * FERRITIN_UNIT_CASES.length, 20);
});

for (const { label: menstruatingLabel, value: menstruatingValue, expected } of MENSTRUATING_STATES) {
  for (const { label: unitLabel, unit, outcome } of FERRITIN_UNIT_CASES) {
    test(`ferritin threshold: menstruating=${menstruatingLabel}, ferritinUnit=${unitLabel}`, () => {
      const input = buildInput(menstruatingValue, unit);
      const unitCheck = validateUnits('anemia', input);

      if (outcome === 'reject') {
        assert.equal(unitCheck.ok, false, 'a rejected-confusable ferritin unit must not pass validateUnits');
        assert.deepEqual(unitCheck.errors, [{
          field: 'labs.ferritin',
          providedUnit: unit,
          expectedUnit: 'ng/mL',
          reason: 'incompatible',
        }]);

        // The full API/browser entry point must reject identically, and before the
        // menstruating-gated threshold is ever consulted.
        assert.throws(
          () => assessPediatricAnemia(input, rules, candidates),
          (error) => error.code === 'UNIT_REJECTED'
            && error.statusCode === 400
            && error.details.some((detail) => detail.field === 'labs.ferritin' && detail.reason === 'incompatible'),
        );
        return;
      }

      assert.equal(unitCheck.ok, true, `expected ${unitLabel} to be accepted: ${JSON.stringify(unitCheck.errors)}`);
      const ferritinField = unitCheck.fields.find((field) => field.field === 'labs.ferritin');
      assert.ok(ferritinField, 'labs.ferritin must be a registered analyte');
      assert.equal(ferritinField.unitAssumed, unit === undefined);

      // Normalization never transforms the numeric value — only the unit label.
      const normalizedInput = normalizeRegisteredUnits(input, unitCheck.fields);
      assert.equal(normalizedInput.labs.ferritin, input.labs.ferritin);

      // The seam itself: EP-1's tri-state `menstruating` read inside getFerritinThreshold
      // (ranges.js), called directly, exactly as EP-1's own seam test does.
      const threshold = getFerritinThreshold(AGE_MONTHS, menstruatingValue);
      assert.equal(threshold.value, expected.value);
      assert.equal(threshold.rationale, expected.rationale);
      assert.equal(threshold.source, 'AAP2026_IDA');

      // And through the exact composition src/engine.js's assess() performs in production:
      // validateUnits -> normalizeRegisteredUnits -> deriveFacts -> (ranges.js) getFerritinThreshold.
      const facts = deriveFacts(normalizedInput);
      assert.equal(facts.thresholds.ferritin, expected.value);
      assert.equal(facts.thresholds.ferritinRationale, expected.rationale);

      // The end-to-end entry point both the API and the browser SPA call must not throw for
      // an accepted ferritin unit, for any menstruating state.
      assert.doesNotThrow(() => assessPediatricAnemia(input, rules, candidates));
    });
  }
}

test('accepted-synonym ferritin unit yields the identical numeric threshold as canonical, for every menstruating state', () => {
  for (const { value: menstruatingValue, expected } of MENSTRUATING_STATES) {
    const canonicalInput = buildInput(menstruatingValue, 'ng/mL');
    const synonymInput = buildInput(menstruatingValue, 'ug/L');

    const canonicalCheck = validateUnits('anemia', canonicalInput);
    const synonymCheck = validateUnits('anemia', synonymInput);
    assert.equal(canonicalCheck.ok, true);
    assert.equal(synonymCheck.ok, true);

    const canonicalFacts = deriveFacts(normalizeRegisteredUnits(canonicalInput, canonicalCheck.fields));
    const synonymFacts = deriveFacts(normalizeRegisteredUnits(synonymInput, synonymCheck.fields));

    // Same measured value, same threshold, same rationale — the synonym's label was
    // normalized, but no arithmetic conversion was ever applied to any number.
    assert.equal(synonymFacts.ferritin.value, canonicalFacts.ferritin.value);
    assert.equal(synonymFacts.thresholds.ferritin, canonicalFacts.thresholds.ferritin);
    assert.equal(synonymFacts.thresholds.ferritin, expected.value);
    assert.equal(synonymFacts.thresholds.ferritinRationale, canonicalFacts.thresholds.ferritinRationale);

    const canonicalDirect = getFerritinThreshold(AGE_MONTHS, menstruatingValue, 'ng/mL');
    const synonymDirect = getFerritinThreshold(AGE_MONTHS, menstruatingValue, 'ug/L');
    assert.deepEqual(synonymDirect, canonicalDirect);
  }
});
