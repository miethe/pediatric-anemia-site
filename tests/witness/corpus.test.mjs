// Activation witnesses for the 52 candidate/note/question rules that never fired in any
// fixture prior to EP05-T2 (see
// docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-0.5-activation-witness-corpus.md,
// EP05-T2 row). EP05-T3 (a parallel task) owns the 9 ALERT-*/SCOPE-* rules under
// tests/witness/alerts/ — this file does not touch those.
//
// Each fixture in tests/witness/corpus/*.json is a synthetic, test-only input whose only job is
// to make one or more specific, otherwise-unwitnessed rules fire (see tests/witness/README.md).
// Every fixture's rationale — which rules it witnesses, the one-sentence clinical picture, and
// the exact KB threshold each numeric value was chosen against — is recorded in
// tests/witness/corpus/NOTES.md.
//
// Each test below asserts that ALL rule ids a fixture is meant to witness appear in
// result.provenance.matchedRuleIds, naming the fixture and the specific missing rule id on
// failure so a regression names exactly what stopped firing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assessPediatricAnemia } from '../../src/engine.js';

const rules = JSON.parse(await readFile(new URL('../../modules/anemia/rules.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(
  await readFile(new URL('../../modules/anemia/candidates.json', import.meta.url), 'utf8'),
);

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`./corpus/${name}.json`, import.meta.url), 'utf8'));
}

function assess(input) {
  return assessPediatricAnemia(input, rules, candidates);
}

/** Asserts every ruleId in `expectedRuleIds` appears in matchedRuleIds, one clear message each. */
function assertWitnessed(result, fixtureName, expectedRuleIds) {
  for (const ruleId of expectedRuleIds) {
    assert.ok(
      result.provenance.matchedRuleIds.includes(ruleId),
      `${ruleId} did not fire for fixture "${fixtureName}" — expected it in provenance.matchedRuleIds ` +
        `(got: ${result.provenance.matchedRuleIds.join(', ')})`,
    );
  }
}

// Fixture name -> the rule ids it is authored to witness. Kept alongside the tests (rather than
// only inside each `test()` call) so the end-of-file coverage guard can iterate it without
// duplicating the list.
const FIXTURE_TARGETS = {
  'microcytic-no-ferritin-iron-risk': ['ID-002', 'Q-MICRO-001', 'Q-004'],
  'microcytic-alpha-thalassemia-nonlow-ferritin': ['Q-MICRO-002', 'THAL-ALPHA-001', 'THAL-ALPHA-002'],
  'iron-deficiency-without-anemia': ['ID-004', 'NOTE-001'],
  'blood-loss-adolescent': ['LOSS-001', 'LOSS-002', 'LOSS-003'],
  'administrative-interpretation-caveats': ['MIX-002', 'NOTE-005', 'NOTE-006'],
  'g6pd-oxidant-hemolysis-tested-during-acute-episode': ['G6PD-002', 'G6PD-003', 'NOTE-004'],
  'g6pd-deficient-hemolysis-retic-pending': ['G6PD-001', 'HEM-003'],
  'autoimmune-hemolytic-anemia': ['AIHA-001'],
  'possible-hemolysis-malaria-incomplete-workup': ['Q-NORMO-HIGH-001', 'MAL-001'],
  'microangiopathic-hemolysis-tma': ['TMA-001'],
  'sickle-cell-parvovirus-aplastic-crisis': ['SICKLE-001', 'PARVO-001'],
  'transient-erythroblastopenia-childhood': ['TEC-001', 'Q-NORMO-LOW-001'],
  'renal-anemia': ['REN-001'],
  'fanconi-anemia-phenotype': ['IMF-FANCONI-001'],
  'copper-deficiency-anemia': ['COPPER-001'],
  'diamond-blackfan-infant': ['IMF-001', 'IMF-DBA-001'],
  'macrocytosis-from-reticulocytosis': ['MACRO-004', 'Q-MACRO-002', 'Q-SMEAR-001'],
  'macrocytic-b12-thyroid-pernicious': ['MEG-001', 'MEG-002', 'MACRO-001', 'Q-MACRO-001'],
  'macrocytic-liver-disease-medication': ['MACRO-002', 'MACRO-003'],
  'mixed-iron-folate-deficiency': ['MIX-001'],
  'iron-refractory-anemia-irida': ['ID-003', 'IRIDA-001'],
  'sideroblastic-iron-loading-microcytosis': ['SID-001', 'SID-002'],
  'microcytic-beta-thalassemia-inflammation-confounded': ['ID-005', 'THAL-BETA-002'],
  'minimal-intake-no-data': ['Q-001', 'Q-002', 'Q-003', 'Q-005'],
};

test('microcytic anemia with no ferritin available and iron-risk history witnesses ID-002, Q-MICRO-001, Q-004', async () => {
  const result = assess(await fixture('microcytic-no-ferritin-iron-risk'));
  assertWitnessed(result, 'microcytic-no-ferritin-iron-risk', FIXTURE_TARGETS['microcytic-no-ferritin-iron-risk']);
});

test('microcytic anemia with non-low ferritin and unknown CRP, plus alpha-thalassemia markers, witnesses Q-MICRO-002, THAL-ALPHA-001, THAL-ALPHA-002', async () => {
  const result = assess(await fixture('microcytic-alpha-thalassemia-nonlow-ferritin'));
  assertWitnessed(
    result,
    'microcytic-alpha-thalassemia-nonlow-ferritin',
    FIXTURE_TARGETS['microcytic-alpha-thalassemia-nonlow-ferritin'],
  );
});

test('non-anemic child with low ferritin witnesses ID-004 (iron deficiency without anemia) and NOTE-001 (no anemia)', async () => {
  const result = assess(await fixture('iron-deficiency-without-anemia'));
  assertWitnessed(result, 'iron-deficiency-without-anemia', FIXTURE_TARGETS['iron-deficiency-without-anemia']);
});

test('adolescent with active major bleeding, high retic, and low ferritin witnesses LOSS-001, LOSS-002, LOSS-003', async () => {
  const result = assess(await fixture('blood-loss-adolescent'));
  assertWitnessed(result, 'blood-loss-adolescent', FIXTURE_TARGETS['blood-loss-adolescent']);
});

test('recent transfusion + high altitude witnesses MIX-002, NOTE-005, NOTE-006', async () => {
  const result = assess(await fixture('administrative-interpretation-caveats'));
  assertWitnessed(
    result,
    'administrative-interpretation-caveats',
    FIXTURE_TARGETS['administrative-interpretation-caveats'],
  );
});

test('oxidant-triggered hemolysis with bite/blister cells, G6PD tested normal during the acute episode, witnesses G6PD-002, G6PD-003, NOTE-004', async () => {
  const result = assess(await fixture('g6pd-oxidant-hemolysis-tested-during-acute-episode'));
  assertWitnessed(
    result,
    'g6pd-oxidant-hemolysis-tested-during-acute-episode',
    FIXTURE_TARGETS['g6pd-oxidant-hemolysis-tested-during-acute-episode'],
  );
});

test('G6PD-deficient hemolysis with reticulocyte response not yet known witnesses G6PD-001, HEM-003', async () => {
  const result = assess(await fixture('g6pd-deficient-hemolysis-retic-pending'));
  assertWitnessed(
    result,
    'g6pd-deficient-hemolysis-retic-pending',
    FIXTURE_TARGETS['g6pd-deficient-hemolysis-retic-pending'],
  );
});

test('DAT-positive hemolysis witnesses AIHA-001', async () => {
  const result = assess(await fixture('autoimmune-hemolytic-anemia'));
  assertWitnessed(result, 'autoimmune-hemolytic-anemia', FIXTURE_TARGETS['autoimmune-hemolytic-anemia']);
});

test('febrile child with malaria travel history and high retic but incomplete hemolysis workup witnesses Q-NORMO-HIGH-001, MAL-001', async () => {
  const result = assess(await fixture('possible-hemolysis-malaria-incomplete-workup'));
  assertWitnessed(
    result,
    'possible-hemolysis-malaria-incomplete-workup',
    FIXTURE_TARGETS['possible-hemolysis-malaria-incomplete-workup'],
  );
});

test('schistocytes with thrombocytopenia and high retic witnesses TMA-001', async () => {
  const result = assess(await fixture('microangiopathic-hemolysis-tma'));
  assertWitnessed(result, 'microangiopathic-hemolysis-tma', FIXTURE_TARGETS['microangiopathic-hemolysis-tma']);
});

test('known sickle cell disease with a recent viral illness and reticulocytopenia witnesses SICKLE-001, PARVO-001', async () => {
  const result = assess(await fixture('sickle-cell-parvovirus-aplastic-crisis'));
  assertWitnessed(
    result,
    'sickle-cell-parvovirus-aplastic-crisis',
    FIXTURE_TARGETS['sickle-cell-parvovirus-aplastic-crisis'],
  );
});

test('isolated normocytic reticulocytopenic anemia after a viral illness witnesses TEC-001, Q-NORMO-LOW-001', async () => {
  const result = assess(await fixture('transient-erythroblastopenia-childhood'));
  assertWitnessed(
    result,
    'transient-erythroblastopenia-childhood',
    FIXTURE_TARGETS['transient-erythroblastopenia-childhood'],
  );
});

test('normocytic reticulocytopenic anemia with chronic kidney disease witnesses REN-001', async () => {
  const result = assess(await fixture('renal-anemia'));
  assertWitnessed(result, 'renal-anemia', FIXTURE_TARGETS['renal-anemia']);
});

test('anemia with another cytopenia plus congenital phenotype witnesses IMF-FANCONI-001', async () => {
  const result = assess(await fixture('fanconi-anemia-phenotype'));
  assertWitnessed(result, 'fanconi-anemia-phenotype', FIXTURE_TARGETS['fanconi-anemia-phenotype']);
});

test('anemia with low copper and neutropenia witnesses COPPER-001', async () => {
  const result = assess(await fixture('copper-deficiency-anemia'));
  assertWitnessed(result, 'copper-deficiency-anemia', FIXTURE_TARGETS['copper-deficiency-anemia']);
});

test('infant with isolated macrocytic reticulocytopenic anemia and a congenital signal witnesses IMF-001, IMF-DBA-001', async () => {
  const result = assess(await fixture('diamond-blackfan-infant'));
  assertWitnessed(result, 'diamond-blackfan-infant', FIXTURE_TARGETS['diamond-blackfan-infant']);
});

test('macrocytosis with high retic and no smear on file witnesses MACRO-004, Q-MACRO-002, Q-SMEAR-001', async () => {
  const result = assess(await fixture('macrocytosis-from-reticulocytosis'));
  assertWitnessed(
    result,
    'macrocytosis-from-reticulocytosis',
    FIXTURE_TARGETS['macrocytosis-from-reticulocytosis'],
  );
});

test('macrocytic anemia with low B12, thyroid disease, and hypersegmented neutrophils witnesses MEG-001, MEG-002, MACRO-001, Q-MACRO-001', async () => {
  const result = assess(await fixture('macrocytic-b12-thyroid-pernicious'));
  assertWitnessed(
    result,
    'macrocytic-b12-thyroid-pernicious',
    FIXTURE_TARGETS['macrocytic-b12-thyroid-pernicious'],
  );
});

test('macrocytic anemia with liver disease and a macrocytosis-associated medication witnesses MACRO-002, MACRO-003', async () => {
  const result = assess(await fixture('macrocytic-liver-disease-medication'));
  assertWitnessed(
    result,
    'macrocytic-liver-disease-medication',
    FIXTURE_TARGETS['macrocytic-liver-disease-medication'],
  );
});

test('normocytic anemia with low ferritin and low folate witnesses MIX-001', async () => {
  const result = assess(await fixture('mixed-iron-folate-deficiency'));
  assertWitnessed(result, 'mixed-iron-folate-deficiency', FIXTURE_TARGETS['mixed-iron-folate-deficiency']);
});

test('elevated sTfR/log10(ferritin) index with a verified-adherent, non-responding iron trial witnesses ID-003, IRIDA-001', async () => {
  const result = assess(await fixture('iron-refractory-anemia-irida'));
  assertWitnessed(result, 'iron-refractory-anemia-irida', FIXTURE_TARGETS['iron-refractory-anemia-irida']);
});

test('microcytosis with high serum iron and basophilic stippling witnesses SID-001, SID-002', async () => {
  const result = assess(await fixture('sideroblastic-iron-loading-microcytosis'));
  assertWitnessed(
    result,
    'sideroblastic-iron-loading-microcytosis',
    FIXTURE_TARGETS['sideroblastic-iron-loading-microcytosis'],
  );
});

test('microcytic anemia with inflammation-confounded ferritin and a positive beta-globin test witnesses ID-005, THAL-BETA-002', async () => {
  const result = assess(await fixture('microcytic-beta-thalassemia-inflammation-confounded'));
  assertWitnessed(
    result,
    'microcytic-beta-thalassemia-inflammation-confounded',
    FIXTURE_TARGETS['microcytic-beta-thalassemia-inflammation-confounded'],
  );
});

test('an intake with no data entered yet witnesses Q-001, Q-002, Q-003, Q-005', async () => {
  const result = assess(await fixture('minimal-intake-no-data'));
  assertWitnessed(result, 'minimal-intake-no-data', FIXTURE_TARGETS['minimal-intake-no-data']);
});

// Coverage guard, mirroring tests/witness/alerts.test.mjs's M55 guard: sweeps every fixture in
// tests/witness/corpus/, and asserts that every rule id any fixture is meant to witness actually
// fired somewhere in the corpus. This catches the case where a fixture file is deleted or edited
// without updating FIXTURE_TARGETS, or where an engine change silently stops a rule from firing
// even though no single per-fixture test above happens to isolate it.
test('EP05-T2 guard: every one of the 52 targeted candidate/note/question rules fires in some tests/witness/corpus/ fixture', async () => {
  const observed = new Set();
  for (const [name, expectedIds] of Object.entries(FIXTURE_TARGETS)) {
    const result = assess(await fixture(name));
    for (const ruleId of expectedIds) {
      if (result.provenance.matchedRuleIds.includes(ruleId)) observed.add(ruleId);
    }
  }

  const allTargets = Object.values(FIXTURE_TARGETS).flat();
  assert.equal(allTargets.length, 52, `expected 52 targeted rule ids across FIXTURE_TARGETS, found ${allTargets.length}`);

  for (const ruleId of allTargets) {
    assert.ok(observed.has(ruleId), `EP05-T2 guard never observed ${ruleId} fire in any tests/witness/corpus/ fixture`);
  }
});
