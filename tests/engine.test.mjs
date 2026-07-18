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

test('young infant is not forced through built-in thresholds', () => {
  const result = assess({ patient: { ageMonths: 2, sexAtBirth: 'female' }, cbc: { hemoglobin: 9, mcv: 90 } });
  assert.equal(result.classification.anemiaStatus, 'indeterminate');
  assert.ok(result.alerts.some((entry) => entry.id === 'SCOPE-001'));
});

test('rule execution is deterministic for identical input', async () => {
  const input = await example('ida-toddler');
  const first = assess(input);
  const second = assess(input);
  const scrub = (result) => ({ ...result, meta: { ...result.meta, generatedAt: 'x' } });
  assert.deepEqual(scrub(first), scrub(second));
});
