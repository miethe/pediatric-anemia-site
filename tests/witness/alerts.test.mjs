// Activation witnesses for the 9 ALERT-*/SCOPE-* rules that had zero fixtures anywhere in the
// suite (EP05-T3; see
// docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-0.5-activation-witness-corpus.md).
//
// The bar here is deliberately higher than "the rule id appears in provenance.matchedRuleIds".
// These are emergency/urgent safety alerts: a rule that fires but is silently downgraded from an
// `alert` to a `note` (or has its `severity` weakened) is mutation M55, and a suite that only
// checks matchedRuleIds cannot see that mutation at all. Every assertion below therefore inspects
// the actual `result.alerts` entry — its presence, and its `severity` — and separately confirms
// the same rule id is *absent* from `result.interpretiveNotes`.
//
// Fixtures live in tests/witness/alerts/*.json. Per tests/witness/README.md, these are synthetic
// activation-only inputs (not published clinical examples) built exclusively from thresholds
// already present in modules/anemia/rules.json, modules/anemia/facts.anemia.js, and
// modules/anemia/reference-ranges.json. See tests/witness/alerts/NOTES.md for the per-fixture
// clinical rationale and the exact KB threshold each numeric value was chosen against.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assessPediatricAnemia } from '../../src/engine.js';
import { deriveFacts } from '../../modules/anemia/facts.anemia.js';

const rules = JSON.parse(await readFile(new URL('../../modules/anemia/rules.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(
  await readFile(new URL('../../modules/anemia/candidates.json', import.meta.url), 'utf8'),
);

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`./alerts/${name}.json`, import.meta.url), 'utf8'));
}

function assess(input) {
  return assessPediatricAnemia(input, rules, candidates);
}

// Expected severity for each targeted rule, read directly from each rule's `output.severity` in
// modules/anemia/rules.json (not re-derived or guessed) — this is the exact value that must
// survive a migration/refactor unweakened.
const EXPECTED_SEVERITY = {
  'ALERT-001': 'emergency',
  'ALERT-002': 'emergency',
  'ALERT-003': 'urgent',
  'ALERT-006': 'emergency',
  'ALERT-007': 'emergency',
  'ALERT-008': 'urgent',
  'SCOPE-001': 'important',
  'SCOPE-002': 'important',
  'SCOPE-003': 'important',
};

/**
 * Asserts that `ruleId` fired (appears in provenance.matchedRuleIds), produced a genuine entry in
 * result.alerts (the identifying field is `id`), carries the severity declared in rules.json, and
 * did NOT also/instead surface as a result.interpretiveNotes entry. Returns the alert entry so a
 * caller can add rule-specific assertions on top.
 */
function assertAlertWitnessed(result, ruleId) {
  assert.ok(
    result.provenance.matchedRuleIds.includes(ruleId),
    `${ruleId} did not appear in provenance.matchedRuleIds — fixture no longer activates this rule`,
  );

  const alertEntry = result.alerts.find((entry) => entry.id === ruleId);
  assert.ok(
    alertEntry,
    `${ruleId} matched the rule engine but produced no entry in result.alerts — check for an ` +
      'alert->note/candidate output.type downgrade in modules/anemia/rules.json (mutation M55)',
  );

  assert.equal(
    alertEntry.severity,
    EXPECTED_SEVERITY[ruleId],
    `${ruleId} fired with severity "${alertEntry.severity}", expected "${EXPECTED_SEVERITY[ruleId]}" ` +
      '— severity was weakened',
  );

  const noteEntry = result.interpretiveNotes.find((entry) => entry.id === ruleId);
  assert.equal(
    noteEntry,
    undefined,
    `${ruleId} also appeared in result.interpretiveNotes — an alert rule must never surface as a note`,
  );

  return alertEntry;
}

test('ALERT-001 (unstable symptomatic anemia) fires as an emergency alert, not a note', async () => {
  const result = assess(await fixture('unstable-major-bleeding-severe-anemia'));
  const entry = assertAlertWitnessed(result, 'ALERT-001');
  assert.equal(entry.title, 'Potentially unstable symptomatic anemia');
});

test('ALERT-002 (active major bleeding) fires as an emergency alert, not a note', async () => {
  const result = assess(await fixture('unstable-major-bleeding-severe-anemia'));
  const entry = assertAlertWitnessed(result, 'ALERT-002');
  assert.equal(entry.title, 'Active major bleeding');
});

test('ALERT-003 (hemoglobin below 7 g/dL, IDA category) fires as an urgent alert, not a note', async () => {
  const result = assess(await fixture('unstable-major-bleeding-severe-anemia'));
  const entry = assertAlertWitnessed(result, 'ALERT-003');
  assert.equal(entry.title, 'Hemoglobin is below 7 g/dL');
});

test('ALERT-006 (schistocytes + numerically-derived thrombocytopenia ONLY — possible TMA) fires as an emergency alert, not a note', async () => {
  const input = await fixture('tma-schistocytes-thrombocytopenia');
  const result = assess(input);
  const entry = assertAlertWitnessed(result, 'ALERT-006');
  assert.equal(entry.title, 'Possible thrombotic microangiopathy or severe microangiopathic process');

  // This fixture is deliberately built to isolate the `cbc.thrombocytopenia` arm of ALERT-006's
  // `any`: no `localFlags.thrombocytopenia` override and no renal/neurologic symptom is present,
  // so the only way this alert can fire is via the numeric `platelets < localRanges.plateletsLower`
  // derivation in facts.anemia.js. Asserting the derived fact directly means a broken derivation
  // (e.g. the comparison flipped, or the localRanges lookup dropped) fails loudly here instead of
  // being silently masked by a second satisfied arm.
  const facts = deriveFacts(input);
  assert.equal(
    facts.cbc.thrombocytopenia,
    true,
    'cbc.thrombocytopenia must be derived TRUE from platelets(42) < localRanges.plateletsLower(150) — ' +
      'this fixture supplies no localFlags override and no renal/neurologic symptom, so this is the only ' +
      'arm available to drive ALERT-006',
  );
  assert.equal(input.symptoms?.renalSymptoms, undefined, 'this fixture must not also satisfy the renal arm');
  assert.equal(input.symptoms?.oliguria, undefined, 'this fixture must not also satisfy the renal arm');
  assert.equal(
    facts.symptoms.neurologicSymptoms,
    false,
    'this fixture must not also satisfy the neurologic arm',
  );
});

test('ALERT-006 (schistocytes + renal symptoms ONLY, no thrombocytopenia — possible TMA) fires as an emergency alert, not a note', async () => {
  const input = await fixture('tma-schistocytes-renal-symptoms');
  const result = assess(input);
  const entry = assertAlertWitnessed(result, 'ALERT-006');
  assert.equal(entry.title, 'Possible thrombotic microangiopathy or severe microangiopathic process');

  // Isolates the `symptoms.renalSymptoms` arm: no localFlags override and no localRanges
  // plateletsLower supplied, so cbc.thrombocytopenia must be false here.
  const facts = deriveFacts(input);
  assert.equal(
    facts.cbc.thrombocytopenia,
    false,
    'this fixture must NOT witness ALERT-006 via thrombocytopenia — it isolates the renal-symptoms arm',
  );
  assert.equal(facts.symptoms.renalSymptoms, true, 'the renal-symptoms arm must be the one driving this alert');
  assert.equal(facts.symptoms.neurologicSymptoms, false, 'this fixture must not also satisfy the neurologic arm');
});

test('ALERT-006 (schistocytes + neurologic symptoms ONLY — possible TMA) fires as an emergency alert, not a note', async () => {
  const input = await fixture('tma-schistocytes-neurologic-symptoms');
  const result = assess(input);
  const entry = assertAlertWitnessed(result, 'ALERT-006');
  assert.equal(entry.title, 'Possible thrombotic microangiopathy or severe microangiopathic process');

  // Isolates the third and last `any` arm, `symptoms.neurologicSymptoms`. Without this fixture the
  // neurologic arm could be deleted outright and every other ALERT-006 test would still pass — the
  // rule would keep firing off the thrombocytopenia and renal arms. Rule-level activation coverage
  // does NOT catch that; only a per-arm witness does.
  const facts = deriveFacts(input);
  assert.equal(
    facts.cbc.thrombocytopenia,
    false,
    'this fixture must NOT witness ALERT-006 via thrombocytopenia — it isolates the neurologic arm',
  );
  assert.equal(
    facts.symptoms.renalSymptoms,
    false,
    'this fixture must NOT witness ALERT-006 via renal symptoms — it isolates the neurologic arm',
  );
  assert.equal(
    facts.symptoms.neurologicSymptoms,
    true,
    'the neurologic-symptoms arm must be the one driving this alert',
  );
});

test('ALERT-006: every arm of its `any` is witnessed in isolation by exactly one fixture', async () => {
  // Guards the claim made in alerts/NOTES.md. ALERT-006's condition is
  // `schistocytes AND any(cbc.thrombocytopenia, symptoms.renalSymptoms, symptoms.neurologicSymptoms)`.
  // A fixture satisfying more than one arm witnesses the rule but tests nothing about any single
  // arm — the original corpus made exactly that mistake. This test fails if an arm loses its
  // isolated witness, or if a fixture starts satisfying two arms at once.
  const ARMS = [
    ['tma-schistocytes-thrombocytopenia', (f) => f.cbc.thrombocytopenia],
    ['tma-schistocytes-renal-symptoms', (f) => f.symptoms.renalSymptoms],
    ['tma-schistocytes-neurologic-symptoms', (f) => f.symptoms.neurologicSymptoms],
  ];
  for (const [name, targetArm] of ARMS) {
    const facts = deriveFacts(await fixture(name));
    const satisfied = [
      facts.cbc.thrombocytopenia,
      facts.symptoms.renalSymptoms,
      facts.symptoms.neurologicSymptoms,
    ].filter(Boolean).length;
    assert.equal(
      satisfied,
      1,
      `${name} must satisfy exactly ONE arm of ALERT-006's \`any\` (satisfies ${satisfied}) — `
        + 'a fixture satisfying two arms cannot detect either one breaking',
    );
    assert.equal(targetArm(facts), true, `${name} must satisfy its own designated arm`);
    assert.equal(facts.smear.schistocytes, true, `${name} must supply schistocytes`);
  }
});

test('ALERT-007 (blood lead level >=45 µg/dL) fires as an emergency alert, not a note', async () => {
  const result = assess(await fixture('lead-45plus-alert'));
  const entry = assertAlertWitnessed(result, 'ALERT-007');
  assert.equal(entry.title, 'Blood lead level ≥45 µg/dL');
});

test('ALERT-008 (blood lead level 20-44 µg/dL) fires as an urgent alert, not a note', async () => {
  const result = assess(await fixture('lead-20to44-alert'));
  const entry = assertAlertWitnessed(result, 'ALERT-008');
  assert.equal(entry.title, 'Blood lead level 20–44 µg/dL');
});

test('SCOPE-001 (neonatal/young-infant, age < 6 months) fires as an important alert, not a note', async () => {
  const result = assess(await fixture('scope-neonatal-young-infant'));
  const entry = assertAlertWitnessed(result, 'SCOPE-001');
  assert.equal(entry.title, 'Neonatal/young-infant pathway required');
});

test('SCOPE-002 (age >= 18 years, outside built-in pediatric range) fires as an important alert, not a note', async () => {
  const result = assess(await fixture('scope-outside-pediatric-range'));
  const entry = assertAlertWitnessed(result, 'SCOPE-002');
  assert.equal(entry.title, 'Outside built-in pediatric age range');
});

test('SCOPE-003 (reference interval incomplete — age unknown, no local ranges) fires as an important alert, not a note', async () => {
  const result = assess(await fixture('scope-needs-local-ranges-age-unknown'));
  const entry = assertAlertWitnessed(result, 'SCOPE-003');
  assert.equal(entry.title, 'Reference interval incomplete');
});

// M55 guard — the explicit, named statement of the mutation class this task exists to close.
//
// Today, none of the 9 rules above ever fired in any fixture in the suite: you could delete one,
// or change its output.type from "alert" to "note", or drop its severity from "emergency" to
// "important", and every existing test — including `npm run check` in full — would stay green,
// because nothing anywhere asserted the shape of the emitted alert object, only (at best) that a
// rule id appeared in an audit trail. This test sweeps every fixture in tests/witness/alerts/,
// and for every targeted rule id that fires in any of them, asserts it lands in result.alerts
// (never result.interpretiveNotes) with its declared severity. It also asserts that all 9 rules
// were actually observed to fire across the corpus, so the guard itself cannot silently lose
// coverage of a rule without failing.
test('M55 guard: every targeted alert/scope rule that fires lands in result.alerts with its declared severity, never in interpretiveNotes', async () => {
  const fixtureNames = [
    'unstable-major-bleeding-severe-anemia',
    'tma-schistocytes-thrombocytopenia',
    'tma-schistocytes-renal-symptoms',
    'tma-schistocytes-neurologic-symptoms',
    'lead-45plus-alert',
    'lead-20to44-alert',
    'scope-neonatal-young-infant',
    'scope-outside-pediatric-range',
    'scope-needs-local-ranges-age-unknown',
  ];
  const targetIds = Object.keys(EXPECTED_SEVERITY);
  const observed = new Set();

  for (const name of fixtureNames) {
    const result = assess(await fixture(name));
    for (const ruleId of targetIds) {
      if (!result.provenance.matchedRuleIds.includes(ruleId)) continue;
      observed.add(ruleId);

      const alertEntry = result.alerts.find((entry) => entry.id === ruleId);
      assert.ok(
        alertEntry,
        `M55 CLASS FAILURE: ${ruleId} matched in fixture "${name}" but is absent from result.alerts ` +
          '(alert downgraded away from output.type "alert", or removed from the alerts array)',
      );

      const noteEntry = result.interpretiveNotes.find((entry) => entry.id === ruleId);
      assert.equal(
        noteEntry,
        undefined,
        `M55 CLASS FAILURE: ${ruleId} appeared in result.interpretiveNotes for fixture "${name}" — ` +
          'an alert rule must never also/instead surface as an interpretive note',
      );

      assert.equal(
        alertEntry.severity,
        EXPECTED_SEVERITY[ruleId],
        `M55 CLASS FAILURE: ${ruleId} fired in fixture "${name}" with severity "${alertEntry.severity}", ` +
          `expected "${EXPECTED_SEVERITY[ruleId]}" — severity was weakened`,
      );
    }
  }

  for (const ruleId of targetIds) {
    assert.ok(
      observed.has(ruleId),
      `M55 guard never observed ${ruleId} fire in any tests/witness/alerts/ fixture — witness lost`,
    );
  }
});
