// Branch-seam pins for modules/anemia/ranges.js (Phase EP-0.5, task EP05-T4).
//
// WHY THIS FILE EXISTS — the M57 class.
// The clinical *numbers* in this project live in code (modules/anemia/ranges.js),
// not in the rule JSON. EP-0 verified a mutation (M57) that deletes the
// `menstruating === true` branch of the ferritin threshold rule: the structural
// KB differ only reads JSON so it cannot see a .js change, and the behavioral
// fixture probe was blind because the only menstruating patient in the corpus
// was 168 months old — old enough that the *adolescent* branch still returns 30.
// Measured result: 0 of 6 golden fixtures moved while a confirmed
// iron-deficiency finding silently became a provisional one.
//
// The fix is to pin the RESOLVED THRESHOLD AND ITS RATIONALE (the evidential
// basis), not the final differential — the differential survived M57 via a
// different rule, which is exactly why asserting it proved nothing. Each case
// below chooses an input that ONLY one branch can serve, so the assertion is a
// unique pin: deleting or reordering that branch changes the asserted value.
//
// NO NEW CLINICAL THRESHOLDS ARE INTRODUCED HERE. Every asserted number is
// read out of modules/anemia/ranges.js and modules/anemia/reference-ranges.json
// as they stand today. Values are written as literals on purpose: importing the
// JSON would make the assertion self-fulfilling and pin nothing.
//
// Fixture inputs live in tests/witness/branches/*.json (plain assess() inputs,
// so scripts/rule-coverage.mjs can also walk them). Expectations live here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveFacts } from '../../modules/anemia/facts.anemia.js';
import { getFerritinThreshold, getBuiltInRange } from '../../modules/anemia/ranges.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(here, 'branches');

function facts(fixtureName) {
  const file = path.join(FIXTURE_DIR, `${fixtureName}.json`);
  return deriveFacts(JSON.parse(readFileSync(file, 'utf8')));
}

// ---------------------------------------------------------------------------
// ferritinThresholdRule() — 5 distinct outcomes, each pinned by an input that
// no other branch can serve.
// ---------------------------------------------------------------------------

test('BRANCH ferritin/menstruating (M57): a menstruating patient BELOW the adolescent band resolves 30 via the menstruating branch', () => {
  const f = facts('ferritin-menstruating-under-adolescent-band');

  // Pin the *evidential basis*, not the differential. This is the M57 case.
  assert.equal(
    f.thresholds.ferritin,
    30,
    'M57: ferritin threshold for a menstruating 120-month-old must be 30 (menstruating branch of ranges.js). '
      + 'A value of 20 means the `menstruating === true` branch was deleted or reordered below the age bands.',
  );
  assert.equal(
    f.thresholds.ferritinRationale,
    'all menstruating patients',
    'M57: the threshold must be attributed to the menstruating branch. A different rationale means the '
      + 'threshold survived via another branch and the evidential basis silently changed.',
  );
  assert.equal(f.ferritin.threshold, 30);
  assert.equal(
    f.ferritin.low,
    true,
    'M57: ferritin 25 must read LOW against the 30 threshold. `false` is the silent downgrade from a '
      + 'confirmed to a provisional iron-deficiency finding.',
  );

  // Uniqueness of the pin: at 120 months no other branch can produce 30.
  const withoutMenstruating = getFerritinThreshold(120, false);
  assert.equal(
    withoutMenstruating?.value,
    20,
    'the menstruating pin is only unique while the 120-month age band resolves 20 — if this is 30, the '
      + 'fixture above no longer isolates the menstruating branch and must be re-chosen',
  );
});

test('BRANCH ferritin/menstruating precedence: the menstruating branch wins over the adolescent band', () => {
  // Pins ORDER, not just presence: moving the menstruating check below the age
  // checks leaves the value 30 but changes the rationale.
  const t = getFerritinThreshold(168, true);
  assert.equal(t?.value, 30, 'a menstruating 168-month-old must still resolve a threshold of 30');
  assert.equal(
    t?.rationale,
    'all menstruating patients',
    'the menstruating branch must be evaluated before the age bands; an "adolescent age band" rationale '
      + 'here means the branches were reordered',
  );
});

test('BRANCH ferritin/adolescent-band: a non-menstruating 12-to-<18-year-old resolves 30 via the adolescent branch', () => {
  const male = facts('ferritin-adolescent-band-male');
  assert.equal(male.thresholds.ferritin, 30);
  assert.equal(
    male.thresholds.ferritinRationale,
    'adolescent age band',
    'a non-menstruating 168-month-old must resolve 30 via the adolescent age band branch of ranges.js',
  );
  assert.equal(male.ferritin.low, true, 'ferritin 25 must read LOW against the adolescent 30 threshold');

  const female = facts('ferritin-adolescent-band-female-not-menstruating');
  assert.equal(female.thresholds.ferritin, 30);
  assert.equal(female.thresholds.ferritinRationale, 'adolescent age band');
});

test('BRANCH ferritin/young-child-band: a 6-month-to-<12-year-old resolves 20 via the young-child branch', () => {
  const f = facts('ferritin-young-child-band');
  assert.equal(
    f.thresholds.ferritin,
    20,
    'a non-menstruating 30-month-old must resolve 20 via the young-or-school-aged-child branch of ranges.js',
  );
  assert.equal(f.thresholds.ferritinRationale, 'young or school-aged child');
  assert.equal(
    f.ferritin.notLow,
    true,
    'ferritin 25 must read NOT-LOW against the 20 threshold — `low: true` here means the 30 threshold '
      + 'leaked into the young-child band',
  );
  assert.equal(f.ferritin.low, false);
});

test('BRANCH ferritin/below-supported-age: under 6 months resolves no threshold at all', () => {
  const f = facts('ferritin-below-supported-age');
  assert.equal(
    f.thresholds.ferritin,
    null,
    'a 4-month-old is below the ranges.js age floor (6 months) — no ferritin threshold may be asserted',
  );
  assert.equal(f.thresholds.ferritinRationale, null);
  assert.equal(
    f.ferritin.low,
    null,
    'with no threshold, ferritin low/not-low must be unknown (null), never silently false',
  );
});

test('BRANCH ferritin/above-pediatric-range: 216 months and above resolves no threshold at all', () => {
  const f = facts('ferritin-above-pediatric-range');
  assert.equal(
    f.thresholds.ferritin,
    null,
    '216 months (18 years) is at/above the ranges.js pediatric ceiling — no ferritin threshold may be asserted',
  );
  assert.equal(f.thresholds.ferritinRationale, null);
  assert.equal(f.ferritin.low, null);
});

test('BRANCH ferritin/age-not-finite: a missing age resolves no threshold (and does not throw)', () => {
  const f = facts('ranges-age-not-supplied');
  assert.equal(
    f.thresholds.ferritin,
    null,
    'with no ageMonths and menstruating !== true, the non-finite-age guard in ranges.js must return null',
  );
  assert.equal(f.thresholds.ferritinRationale, null);
  assert.equal(f.ferritin.low, null);
  assert.equal(getFerritinThreshold(undefined, false), null);
  assert.equal(getFerritinThreshold(Number.NaN, false), null);
});

test('BRANCH ferritin/sex-independence: the ferritin threshold resolves without a recorded sex', () => {
  // The ferritin rule is deliberately NOT banded by sex (unlike hb/mcv/rdw).
  const f = facts('ranges-sex-not-supplied');
  assert.equal(f.thresholds.ferritin, 20);
  assert.equal(f.thresholds.ferritinRationale, 'young or school-aged child');
  assert.equal(
    f.thresholds.hbLower,
    null,
    'the CBC bands DO require a sex; without one they must return null rather than silently defaulting',
  );
});

// ---------------------------------------------------------------------------
// Ferritin threshold boundaries. An off-by-one or a `<`-to-`<=` flip is the same
// invisible class as M57, so each edge is pinned at/just-below/just-above.
// ---------------------------------------------------------------------------

test('BOUNDARY ferritin age edges: 6 / 144 / 216 month seams resolve exactly as written', () => {
  const at = (age) => getFerritinThreshold(age, false);

  assert.equal(at(5), null, 'age 5 months is below the 6-month floor → no threshold');
  assert.equal(at(6)?.value, 20, 'age 6 months is inclusive at the floor → 20');
  assert.equal(at(6)?.rationale, 'young or school-aged child');

  assert.equal(at(143)?.value, 20, 'age 143 months is the last young-child month → 20');
  assert.equal(at(143)?.rationale, 'young or school-aged child');
  assert.equal(at(144)?.value, 30, 'age 144 months is inclusive at the adolescent floor → 30');
  assert.equal(at(144)?.rationale, 'adolescent age band');

  assert.equal(at(215)?.value, 30, 'age 215 months is the last adolescent month → 30');
  assert.equal(at(216), null, 'age 216 months is exclusive at the ceiling → no threshold');
});

test('BOUNDARY ferritin comparison is inclusive (<=) at the threshold value', () => {
  const lowAt = (ferritinValue, ageMonths) =>
    deriveFacts({
      patient: { ageMonths, sexAtBirth: 'male', menstruating: false },
      labs: { ferritin: ferritinValue },
    }).ferritin.low;

  assert.equal(lowAt(19.9, 30), true, 'just below the 20 threshold → low');
  assert.equal(lowAt(20, 30), true, 'exactly at the 20 threshold → low (comparison is <=)');
  assert.equal(lowAt(20.1, 30), false, 'just above the 20 threshold → not low');

  assert.equal(lowAt(29.9, 168), true, 'just below the 30 threshold → low');
  assert.equal(lowAt(30, 168), true, 'exactly at the 30 threshold → low (comparison is <=)');
  assert.equal(lowAt(30.1, 168), false, 'just above the 30 threshold → not low');
});

// ---------------------------------------------------------------------------
// Age-band range selection (getBuiltInRange, via the generic registry).
// One pin per band per sex — the values are the AAP2026_IDA table as it stands.
// ---------------------------------------------------------------------------

const BAND_PINS = [
  { fixture: 'ranges-band-infant-female', ageBand: '6 to <24 months', hbLower: 11, mcvLower: 73.3, mcvUpper: 83.2, rdwUpper: 15.4 },
  { fixture: 'ranges-band-preschool-male', ageBand: '2 to <6 years', hbLower: 11, mcvLower: 74.1, mcvUpper: 84.3, rdwUpper: 14.7 },
  { fixture: 'ranges-band-school-age-female', ageBand: '6 to <12 years', hbLower: 11.2, mcvLower: 78.3, mcvUpper: 87.7, rdwUpper: 13.9 },
  { fixture: 'ferritin-adolescent-band-male', ageBand: '12 to <18 years', hbLower: 12.4, mcvLower: 80.4, mcvUpper: 90.1, rdwUpper: 13.7 },
  { fixture: 'ferritin-adolescent-band-female-not-menstruating', ageBand: '12 to <18 years', hbLower: 11.4, mcvLower: 80.5, mcvUpper: 91.8, rdwUpper: 14.6 },
];

for (const pin of BAND_PINS) {
  test(`BRANCH range-band ${pin.fixture}: resolves the "${pin.ageBand}" band with AAP2026_IDA provenance`, () => {
    const f = facts(pin.fixture);
    const p = f.thresholds.provenance;

    assert.equal(
      p.builtInAgeBand,
      pin.ageBand,
      `${pin.fixture} must select the "${pin.ageBand}" band — a different band means the age seams or the `
        + 'band ordering in reference-ranges.json changed',
    );
    for (const key of ['hbLower', 'mcvLower', 'mcvUpper', 'rdwUpper']) {
      assert.equal(f.thresholds[key], pin[key], `${pin.fixture}: ${key} must be ${pin[key]}`);
      assert.equal(p[key].source, 'AAP2026_IDA', `${pin.fixture}: ${key} provenance must be AAP2026_IDA`);
      assert.equal(p[key].isFallback, true, `${pin.fixture}: ${key} must be marked a built-in fallback`);
    }
  });
}

test('BRANCH range-band sex selection: the 12-to-<18 band is sex-specific and must not collapse', () => {
  const female = getBuiltInRange(168, 'female');
  const male = getBuiltInRange(168, 'male');
  assert.equal(female?.hbLower, 11.4, 'adolescent female hbLower must be 11.4');
  assert.equal(male?.hbLower, 12.4, 'adolescent male hbLower must be 12.4');
  assert.notEqual(
    female?.hbLower,
    male?.hbLower,
    'female/male adolescent hemoglobin lower limits differ in the AAP table — identical values mean the '
      + 'sex selection in the registry was collapsed',
  );
});

test('BOUNDARY range-band age seams: 6 / 24 / 72 / 144 / 216 months resolve exactly as written', () => {
  const bandAt = (age) => getBuiltInRange(age, 'female')?.ageBand ?? null;

  assert.equal(bandAt(5), null, 'below 6 months there is no built-in band');
  assert.equal(bandAt(6), '6 to <24 months');
  assert.equal(bandAt(23), '6 to <24 months');
  assert.equal(bandAt(24), '2 to <6 years');
  assert.equal(bandAt(71), '2 to <6 years');
  assert.equal(bandAt(72), '6 to <12 years');
  assert.equal(bandAt(143), '6 to <12 years');
  assert.equal(bandAt(144), '12 to <18 years');
  assert.equal(bandAt(215), '12 to <18 years');
  assert.equal(bandAt(216), null, '216 months is exclusive at the ceiling — no built-in band');
});

test('BRANCH registry guards: a non-finite age or an unrecognized sex yields no built-in range', () => {
  assert.equal(getBuiltInRange(undefined, 'female'), null, 'missing age → null');
  assert.equal(getBuiltInRange(Number.NaN, 'female'), null, 'NaN age → null');
  assert.equal(getBuiltInRange(100, undefined), null, 'missing sex → null');
  assert.equal(getBuiltInRange(100, 'unknown'), null, 'unrecognized sex → null');
});

// ---------------------------------------------------------------------------
// getEffectiveRanges() provenance — the three outcomes of pick().
// ---------------------------------------------------------------------------

test('BRANCH effective-range provenance: a local lab value overrides the built-in and is marked LOCAL_LAB', () => {
  const p = facts('ranges-local-override-partial').thresholds.provenance;

  assert.equal(p.hbLower.source, 'LOCAL_LAB', 'a supplied local hbLower must win over the built-in band');
  assert.equal(p.hbLower.isFallback, false, 'a local value is not a fallback');
  assert.equal(p.hbLower.value, 11.4);
  assert.equal(p.mcvLower.source, 'LOCAL_LAB');
  assert.equal(p.mcvLower.isFallback, false);

  // Same patient, analytes with no local value: built-in must still apply.
  assert.equal(p.mcvUpper.source, 'AAP2026_IDA', 'an analyte with no local value falls back to the built-in band');
  assert.equal(p.mcvUpper.isFallback, true);
  assert.equal(p.mcvUpper.value, 87.7);
  assert.equal(p.rdwUpper.value, 13.9);
  assert.equal(p.builtInAgeBand, '6 to <12 years');
});

test('BRANCH effective-range provenance: with neither a local value nor a built-in band, everything is null', () => {
  const p = facts('ranges-sex-not-supplied').thresholds.provenance;
  for (const key of ['hbLower', 'mcvLower', 'mcvUpper', 'rdwUpper']) {
    assert.equal(p[key].value, null, `${key} must be null, never a silent default`);
    assert.equal(p[key].source, null, `${key} must carry no provenance when no value was resolved`);
    assert.equal(p[key].isFallback, null, `${key} isFallback must be null (unknown), not false`);
  }
  assert.equal(p.builtInAgeBand, null);
});
