import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assessPediatricAnemia } from '../src/engine.js';
import { getBuiltInRange } from '../src/referenceRanges.js';

const rules = JSON.parse(await readFile(new URL('../modules/anemia/rules.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(await readFile(new URL('../modules/anemia/candidates.json', import.meta.url), 'utf8'));

async function example(name) {
  return JSON.parse(await readFile(new URL(`../examples/${name}.json`, import.meta.url), 'utf8'));
}

function assess(input) {
  return assessPediatricAnemia(input, rules, candidates);
}

test('AAP fallback interval is selected by age and sex', () => {
  assert.deepEqual(getBuiltInRange(20, 'female'), {
    hbLower: 11,
    mcvLower: 73.3,
    mcvUpper: 83.2,
    rdwUpper: 15.4,
    ageBand: '6 to <24 months',
    source: 'AAP2026_IDA',
    isFallback: true,
  });
  assert.equal(getBuiltInRange(4, 'female'), null);
  assert.equal(getBuiltInRange(216, 'male'), null);
});

test('local ranges override built-in ranges', () => {
  const result = assess({
    patient: { ageMonths: 120, sexAtBirth: 'male' },
    cbc: { hemoglobin: 11.1, mcv: 76, localRanges: { hbLower: 12, mcvLower: 77, mcvUpper: 95 } },
  });
  assert.equal(result.classification.anemiaStatus, 'present');
  assert.equal(result.classification.morphology, 'microcytic');
  assert.equal(result.classification.thresholdSource, 'LOCAL_LAB');
});

test('iron deficiency anemia example meets the research-defined pattern', async () => {
  const result = assess(await example('ida-toddler'));
  assert.equal(result.classification.anemiaStatus, 'present');
  assert.equal(result.classification.morphology, 'microcytic');
  assert.equal(result.rankedDifferential[0].id, 'iron-deficiency-anemia');
  assert.equal(result.rankedDifferential[0].level, 'meets-defined-pattern');
  assert.ok(result.provenance.matchedRuleIds.includes('ID-001'));
});

test('beta-thalassemia example ranks a beta-thalassemia pattern', async () => {
  const result = assess(await example('beta-thalassemia-trait'));
  assert.equal(result.classification.morphology, 'microcytic');
  assert.equal(result.rankedDifferential[0].id, 'beta-thalassemia-pattern');
  assert.ok(result.provenance.matchedRuleIds.includes('THAL-BETA-001'));
});

test('inflammatory example ranks anemia of inflammation', async () => {
  const result = assess(await example('anemia-inflammation'));
  assert.equal(result.rankedDifferential[0].id, 'anemia-of-inflammation');
  assert.equal(result.rankedDifferential[0].level, 'strongly-supported');
  assert.ok(result.provenance.matchedRuleIds.includes('AINF-001'));
  assert.ok(result.provenance.matchedRuleIds.includes('AINF-003'));
});

test('DAT-negative spherocytic hemolysis includes hereditary spherocytosis', async () => {
  const result = assess(await example('hemolysis-hs'));
  const hs = result.rankedDifferential.find((entry) => entry.id === 'hereditary-spherocytosis');
  assert.ok(hs);
  assert.equal(hs.level, 'strongly-supported');
  assert.ok(hs.matchedRules.includes('HS-001'));
});

test('marrow red flags trigger emergency and urgent alerts', async () => {
  const result = assess(await example('marrow-red-flags'));
  assert.ok(result.alerts.some((entry) => entry.id === 'ALERT-009' && entry.severity === 'emergency'));
  assert.ok(result.alerts.some((entry) => entry.id === 'ALERT-005' && entry.severity === 'urgent'));
  assert.ok(result.rankedDifferential.some((entry) => entry.id === 'marrow-failure-infiltration'));
});

test('elevated capillary lead triggers confirmation alert and lead pathway', async () => {
  const result = assess(await example('lead-capillary'));
  assert.ok(result.alerts.some((entry) => entry.id === 'ALERT-LEAD-CAPILLARY'));
  const lead = result.rankedDifferential.find((entry) => entry.id === 'lead-exposure-associated-anemia');
  assert.ok(lead);
  assert.equal(lead.level, 'meets-defined-pattern');
});

// EP5-T6 (ARCH §10 condition 2) hardened this from a soft abstention to a refusal. The original
// intent — a young infant must never be forced through the built-in 6-24-month thresholds — is
// preserved and strengthened: the engine now refuses before any rule evaluates, so there is no
// result object to carry a fallback threshold at all. The pre-EP5-T6 behavior returned a normal
// result with anemiaStatus 'indeterminate' plus SCOPE-001; the plan required "refuse to assess
// (not merely narrow limitations text)", which that did not meet.
test('young infant outside the supported age range is refused, not forced through built-in thresholds', () => {
  assert.throws(
    () => assess({ patient: { ageMonths: 2, sexAtBirth: 'female' }, cbc: { hemoglobin: 9, mcv: 90 } }),
    (error) => error.code === 'AGE_OUT_OF_SUPPORTED_RANGE',
    'an age below supportedAgeMonths.min with no local limits must refuse to produce an assessment',
  );
});

// The documented carve-out: supplying local reference limits that cover the age means the module is
// no longer relying on out-of-scope built-in intervals, so it proceeds normally.
test('young infant WITH local reference limits supplied is assessed normally (the carve-out)', () => {
  const result = assess({
    patient: { ageMonths: 2, sexAtBirth: 'female' },
    cbc: { hemoglobin: 9, mcv: 90, localRanges: { hbLower: 9.5, mcvLower: 75, mcvUpper: 95 } },
  });
  assert.ok(result, 'a result must be produced when local limits cover the out-of-range age');
  assert.ok(result.classification, 'the carve-out path must still produce a classification');
});

test('rule execution is deterministic for identical input', async () => {
  const input = await example('ida-toddler');
  const first = assess(input);
  const second = assess(input);
  const scrub = (result) => ({ ...result, meta: { ...result.meta, generatedAt: 'x' } });
  assert.deepEqual(scrub(first), scrub(second));
});
