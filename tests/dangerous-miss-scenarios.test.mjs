// Dangerous-miss synthetic scenario specifications — arc-clinical-council-adoption-v1 P4-T1 / AC P4.1.
//
// Converts DM-CBC-001 through DM-WORKFLOW-010 (the catalog in
// agentic-research/runs/2026-07-19-pediatric-expansion-arc-readiness/validation_plan.md, which
// this task does NOT re-derive or invent — it is the source of truth) into ten versioned,
// non-patient synthetic scenario specifications, validates them against
// schemas/dangerous-miss-scenario.schema.json, and EXECUTES the eight that have a real engine to
// run against (the anemia-assessment engine, or the P3 local-applicability layer).
//
// AUTHORED != EXECUTED. Every fixture's `execution` block is schema-pinned to
// `{state:"not_executed", receipt:null, result:null, adjudication:null, ownerDecision:null}`; this
// test file runs the real engines and asserts against their OUTPUT, but never writes an executed
// result back into the authored fixture. The fixture is a locator plus an expectation, not a
// clinical case, a patient record, or a record of having been run.
//
// Two hazard families (DM-EQUITY-009, DM-WORKFLOW-010) have NO executable engine in this
// repository as of 2026-07-19: there is no subgroup/equity evaluator and no alert-lifecycle
// (override/downtime/handoff/recovery) engine — assessPediatricAnemia is a stateless pure
// function. Rather than inventing one or fabricating a pass, those two fixtures declare
// `executionBinding.engine: "not_yet_implemented"` and this suite asserts that honesty
// structurally, instead of silently claiming coverage it does not have.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { assessPediatricAnemia } from '../src/engine.js';
import {
  evaluateReferenceIntervalApplicability,
  evaluateTerminologyApplicability,
} from '../scripts/lib/local-applicability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'tests', 'fixtures', 'dangerous-miss');
const NOW = new Date('2026-07-19T00:00:00Z');

async function sha256Of(relativePath) {
  const bytes = await readFile(path.join(root, relativePath));
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

const scenarioSchema = await readJson('schemas/dangerous-miss-scenario.schema.json');
const patientInputSchema = await readJson('schemas/patient-input.schema.json');
const rules = await readJson('modules/anemia/rules.json');
const candidates = await readJson('modules/anemia/candidates.json');
const refProfile = await readJson('tests/fixtures/local-profile/SYNTHETIC-reference-interval-profile.json');
const termProfile = await readJson('tests/fixtures/local-profile/SYNTHETIC-terminology-profile.json');

function assess(patientInput) {
  return assessPediatricAnemia(patientInput, rules, candidates);
}

const filenames = (await readdir(fixtureDir)).filter((name) => name.endsWith('.json')).sort();
const fixtures = await Promise.all(
  filenames.map(async (filename) => ({
    filename,
    document: JSON.parse(await readFile(path.join(fixtureDir, filename), 'utf8')),
  })),
);

const EXPECTED_HAZARD_IDS = [
  'DM-CBC-001',
  'DM-HEME-002',
  'DM-AGE-003',
  'DM-URGENT-004',
  'DM-LAB-005',
  'DM-IRON-006',
  'DM-RESULT-007',
  'DM-FHIR-008',
  'DM-EQUITY-009',
  'DM-WORKFLOW-010',
];

const KNOWN_OWNER_ROLES = new Set([
  'pediatric-hematology-reviewer',
  'pediatric-laboratory-medicine-reviewer',
  'general-pediatrics-reviewer',
  'clinical-informatics-interoperability-reviewer',
  'diagnostic-accuracy-methods-reviewer',
  'pediatric-safety-human-factors-reviewer',
  'pediatric-equity-patient-family-reviewer',
  'prediction-implementation-evaluation-reviewer',
]);

// --- coverage tripwire: exactly the ten catalog hazards, no more, no fewer -------------------

test('exactly the ten DM-CBC-001..DM-WORKFLOW-010 catalog hazards are present, one fixture each', () => {
  assert.equal(fixtures.length, 10, `expected 10 fixtures, found ${fixtures.length}`);
  const hazardIds = fixtures.map(({ document }) => document.hazardId).sort();
  assert.deepEqual(hazardIds, [...EXPECTED_HAZARD_IDS].sort());
});

// --- containment: every fixture is filename- and content-labeled synthetic/non-patient --------

test('every fixture filename is marked SYNTHETIC and lives in the sanctioned directory', () => {
  for (const { filename } of fixtures) {
    assert.ok(filename.startsWith('SYNTHETIC-DM-'), `${filename} must start with "SYNTHETIC-DM-"`);
  }
});

// --- schema validity ---------------------------------------------------------------------------

for (const { filename, document } of fixtures) {
  test(`${filename} validates against schemas/dangerous-miss-scenario.schema.json`, () => {
    const errors = validate(scenarioSchema, document);
    assert.deepEqual(errors, [], `${filename} schema errors: ${JSON.stringify(errors)}`);
  });
}

// --- P4-V1 hardening: input.kind discriminator rejects a mismatched kind/payload pair ----------
//
// schemas/dangerous-miss-scenario.schema.json's `input` def previously did not structurally
// enforce (via if/then, the way executionBinding does) that the three non-selected input.*
// payload fields are null when `kind` is set. All ten fixtures obeyed this by construction, so
// there was no live defect, but a future fixture edit could populate a mismatched kind/payload
// pair and still validate. The schema now carries an `allOf` of four if/then branches (one per
// `kind` value) mirroring executionBinding's pattern — and, per the P3-V1 defect class ("the
// assertion discriminator guarded only one key per container, so every secondary value was a
// silent wildcard when null"), EVERY non-selected key is guarded per branch, not just one.
// These tests prove the guard actually rejects every kind/non-selected-field combination.

const INPUT_KIND_MISMATCH_CASES = [
  { kind: 'patientInput', source: 'DM-CBC-001', badField: 'referenceIntervalRequest', badSource: 'DM-LAB-005' },
  { kind: 'patientInput', source: 'DM-CBC-001', badField: 'terminologyObservation', badSource: 'DM-FHIR-008' },
  { kind: 'referenceIntervalRequest', source: 'DM-LAB-005', badField: 'patientInput', badSource: 'DM-CBC-001' },
  { kind: 'referenceIntervalRequest', source: 'DM-LAB-005', badField: 'terminologyObservation', badSource: 'DM-FHIR-008' },
  { kind: 'terminologyObservation', source: 'DM-FHIR-008', badField: 'patientInput', badSource: 'DM-CBC-001' },
  { kind: 'terminologyObservation', source: 'DM-FHIR-008', badField: 'referenceIntervalRequest', badSource: 'DM-LAB-005' },
  { kind: 'none', source: 'DM-EQUITY-009', badField: 'patientInput', badSource: 'DM-CBC-001' },
  { kind: 'none', source: 'DM-EQUITY-009', badField: 'referenceIntervalRequest', badSource: 'DM-LAB-005' },
  { kind: 'none', source: 'DM-EQUITY-009', badField: 'terminologyObservation', badSource: 'DM-FHIR-008' },
];

for (const { kind, source, badField, badSource } of INPUT_KIND_MISMATCH_CASES) {
  test(`NEGATIVE: input.kind="${kind}" with a populated ${badField} is schema-invalid (non-selected field must be null)`, () => {
    const mutated = structuredClone(byHazard[source]);
    assert.equal(mutated.input.kind, kind, 'fixture setup sanity check: wrong source fixture for this kind');
    assert.equal(mutated.input[badField], null, 'fixture setup sanity check: field must start null');
    mutated.input[badField] = structuredClone(byHazard[badSource].input[badField]);
    const errors = validate(scenarioSchema, mutated);
    assert.ok(errors.length > 0, `kind="${kind}" with ${badField} populated must fail schema validation`);
  });
}

// --- AUTHORED != EXECUTED, structurally, and synthetic declaration content --------------------

for (const { filename, document } of fixtures) {
  test(`${filename}: execution block is frozen not-executed and synthetic declaration is complete`, () => {
    assert.deepEqual(document.execution, {
      state: 'not_executed',
      receipt: null,
      result: null,
      adjudication: null,
      ownerDecision: null,
    });
    assert.deepEqual(document.syntheticDeclaration, {
      synthetic: true,
      nonPatientData: true,
      notForClinicalUse: true,
      notAClinicalCase: true,
      purpose: document.syntheticDeclaration.purpose,
    });
    assert.ok(document.syntheticDeclaration.purpose.length > 0);
    assert.equal(document.owner.name, null, 'owner must never name a credentialed individual (OQ-2 is owner-held)');
    assert.ok(KNOWN_OWNER_ROLES.has(document.owner.role), `${filename}: owner.role "${document.owner.role}" is not a known ARC reviewer role`);
  });
}

// --- candidate/rule version pinning is live, not stale -----------------------------------------

test('every fixture is pinned to the CURRENT modules/anemia/{rules,candidates,module}.json digests', async () => {
  const rulesDigest = await sha256Of('modules/anemia/rules.json');
  const candidatesDigest = await sha256Of('modules/anemia/candidates.json');
  const moduleDigest = await sha256Of('modules/anemia/module.json');

  for (const { filename, document } of fixtures) {
    assert.equal(document.candidateBinding.rulesFileDigest, rulesDigest, `${filename}: rulesFileDigest is stale — rebind or the fixture may no longer describe the running engine`);
    assert.equal(document.candidateBinding.candidatesFileDigest, candidatesDigest, `${filename}: candidatesFileDigest is stale`);
    assert.equal(document.candidateBinding.moduleFileDigest, moduleDigest, `${filename}: moduleFileDigest is stale`);
  }
});

// --- profile-bound fixtures are pinned to the CURRENT SYNTHETIC profile digests ----------------

test('every profileRef is pinned to the CURRENT SYNTHETIC local-profile fixture digest', async () => {
  const refDigest = await sha256Of('tests/fixtures/local-profile/SYNTHETIC-reference-interval-profile.json');
  const termDigest = await sha256Of('tests/fixtures/local-profile/SYNTHETIC-terminology-profile.json');

  for (const { filename, document } of fixtures) {
    const ref = document.input.profileRef;
    if (ref === null) continue;
    const expected = ref.profileId === 'SYNTHETIC-reference-interval-profile' ? refDigest : termDigest;
    assert.equal(ref.profileDigest, expected, `${filename}: profileRef.profileDigest is stale`);
  }
});

// --- by hazard id, for convenient lookup below --------------------------------------------------

const byHazard = Object.fromEntries(fixtures.map(({ document }) => [document.hazardId, document]));

function alertsById(result) {
  return new Map(result.alerts.map((alert) => [alert.id, alert]));
}

function assertExpectedAlertsPresent(result, expectedAlerts, label) {
  const found = alertsById(result);
  for (const expected of expectedAlerts) {
    const actual = found.get(expected.id);
    assert.ok(actual, `${label}: expected alert ${expected.id} did not fire`);
    assert.equal(actual.severity, expected.severity, `${label}: alert ${expected.id} severity mismatch`);
  }
}

function assertMatchedRuleIdsInclude(result, ruleIds, label) {
  for (const ruleId of ruleIds) {
    assert.ok(result.provenance.matchedRuleIds.includes(ruleId), `${label}: expected matched rule ${ruleId} not in provenance.matchedRuleIds`);
  }
}

const LEVEL_RANK = { 'meets-defined-pattern': 4, 'strongly-supported': 3, supported: 2, possible: 1, 'not-excluded': 0 };

function maxCandidateLevel(result) {
  if (result.rankedDifferential.length === 0) return null;
  return result.rankedDifferential.reduce((best, candidate) => (LEVEL_RANK[candidate.level] > LEVEL_RANK[best] ? candidate.level : best), result.rankedDifferential[0].level);
}

const DOSING_PATTERN = /\b\d+(\.\d+)?\s*(mg|mcg|mL|units?)\s*\/\s*kg\b|transfuse\s+\d|give\s+\d+\s*(mg|mL|units)/i;

// === DM-CBC-001: cross-lineage multilineage abnormality must dominate, not reduce to isolated anemia ===

test('DM-CBC-001: multilineage cytopenia + blasts produces emergency-dominant alerts and a marrow-failure top candidate, not an isolated anemia diagnosis', () => {
  const scenario = byHazard['DM-CBC-001'];
  const errors = validate(patientInputSchema, scenario.input.patientInput);
  assert.deepEqual(errors, [], 'patientInput must validate against patient-input.schema.json');

  const result = assess(scenario.input.patientInput);
  assertExpectedAlertsPresent(result, scenario.expectedBehavior.expectedAlerts, 'DM-CBC-001');
  assertMatchedRuleIdsInclude(result, scenario.expectedTrace.matchedRuleIdsMustInclude, 'DM-CBC-001');
  assert.equal(result.rankedDifferential[0]?.id, 'marrow-failure-infiltration', 'top candidate must be marrow-failure-infiltration, not a single-lineage diagnosis');
  assert.equal(result.rankedDifferential[0]?.level, 'meets-defined-pattern');
  assert.ok(alertsById(result).get('ALERT-009'), 'the emergency alert must be present alongside the ranked differential, not replaced by it');
});

test('DM-CBC-001 NEGATIVE: removing the multilineage/blasts findings removes the emergency dominance (proves the suite is not vacuous)', () => {
  const mutated = structuredClone(byHazard['DM-CBC-001'].input.patientInput);
  mutated.smear = [];
  mutated.cbc.wbc = 6.0;
  mutated.cbc.anc = 3.0;
  mutated.cbc.platelets = 250;
  delete mutated.cbc.localFlags;

  const result = assess(mutated);
  assert.equal(result.alerts.length, 0, 'mutated input must NOT raise the emergency alert cluster');
  assert.notEqual(result.rankedDifferential[0]?.level, 'meets-defined-pattern', 'mutated input must NOT reach meets-defined-pattern for marrow-failure-infiltration without the multilineage/blasts findings');
});

// === DM-HEME-002: hemolysis markers with unknown retic must not resolve above "supported" ===

test('DM-HEME-002: hemolysis markers with unknown reticulocyte response abstain from a unifying diagnosis', () => {
  const scenario = byHazard['DM-HEME-002'];
  const errors = validate(patientInputSchema, scenario.input.patientInput);
  assert.deepEqual(errors, [], 'patientInput must validate against patient-input.schema.json');

  const result = assess(scenario.input.patientInput);
  assert.equal(result.alerts.length, 0);
  assert.equal(maxCandidateLevel(result), 'supported', 'no candidate may reach meets-defined-pattern/strongly-supported while retic is unknown');
  assertMatchedRuleIdsInclude(result, scenario.expectedTrace.matchedRuleIdsMustInclude, 'DM-HEME-002');
  const questionIds = result.nextQuestions.map((question) => question.id);
  assert.ok(questionIds.includes('Q-004') || questionIds.includes('Q-SMEAR-001'), 'required confirmatory context (retic count / smear) must remain visible as a next question');
});

test('DM-HEME-002 NEGATIVE: a known high reticulocyte response resolves the pattern to strongly-supported (proves the abstention was driven by the unknown retic value)', () => {
  const mutated = structuredClone(byHazard['DM-HEME-002'].input.patientInput);
  mutated.reticulocytes.response = 'high';

  const result = assess(mutated);
  assert.equal(result.rankedDifferential[0]?.level, 'strongly-supported', 'once retic is known and high, the pattern must resolve above supported');
  assert.ok(result.provenance.matchedRuleIds.includes('HEM-001'));
});

// === DM-AGE-003: young-infant scope exit must not silently use a fallback interval ===

test('DM-AGE-003: an age below the 6-month built-in floor abstains rather than using a fallback interval', () => {
  const scenario = byHazard['DM-AGE-003'];
  const errors = validate(patientInputSchema, scenario.input.patientInput);
  assert.deepEqual(errors, [], 'patientInput must validate against patient-input.schema.json');

  const result = assess(scenario.input.patientInput);
  assert.equal(result.classification.anemiaStatus, 'indeterminate');
  assert.equal(result.classification.morphology, 'indeterminate');
  assert.equal(result.classification.thresholdSource, null, 'no built-in interval may be silently applied below 6 months');
  assert.equal(result.classification.ageBand, null);
  assert.equal(result.rankedDifferential.length, 0);
  assertExpectedAlertsPresent(result, scenario.expectedBehavior.expectedAlerts, 'DM-AGE-003');
  assertMatchedRuleIdsInclude(result, scenario.expectedTrace.matchedRuleIdsMustInclude, 'DM-AGE-003');
});

test('DM-AGE-003 NEGATIVE: the same CBC at a supported age resolves a real threshold (proves indeterminate was driven by age, not the CBC values)', () => {
  const mutated = structuredClone(byHazard['DM-AGE-003'].input.patientInput);
  mutated.patient.ageMonths = 60;

  const result = assess(mutated);
  assert.notEqual(result.classification.anemiaStatus, 'indeterminate');
  assert.ok(result.classification.thresholdSource, 'a supported age must resolve a real threshold source');
});

// === DM-URGENT-004: emergency dominance with escalation wording, never a treatment instruction ===

test('DM-URGENT-004: instability + febrile neutropenia dominates as emergency alerts with escalation wording and no dosing instruction', () => {
  const scenario = byHazard['DM-URGENT-004'];
  const errors = validate(patientInputSchema, scenario.input.patientInput);
  assert.deepEqual(errors, [], 'patientInput must validate against patient-input.schema.json');

  const result = assess(scenario.input.patientInput);
  assertExpectedAlertsPresent(result, scenario.expectedBehavior.expectedAlerts, 'DM-URGENT-004');
  assertMatchedRuleIdsInclude(result, scenario.expectedTrace.matchedRuleIdsMustInclude, 'DM-URGENT-004');
  const emergencyAlerts = result.alerts.filter((alert) => alert.severity === 'emergency');
  assert.ok(emergencyAlerts.length >= 2, 'both instability and febrile-neutropenia emergency alerts must fire');

  const allActionText = result.alerts.flatMap((alert) => alert.actions).join(' \n ');
  assert.doesNotMatch(allActionText, DOSING_PATTERN, 'alert actions must escalate to a clinician, never issue a dose/transfusion-volume instruction');
});

test('DM-URGENT-004 NEGATIVE: removing instability/fever/neutropenia removes emergency-severity dominance (proves it was driven by those findings)', () => {
  const mutated = structuredClone(byHazard['DM-URGENT-004'].input.patientInput);
  mutated.symptoms = {};
  delete mutated.cbc.anc;
  delete mutated.cbc.localRanges;
  delete mutated.cbc.localFlags;

  const result = assess(mutated);
  assert.equal(result.alerts.filter((alert) => alert.severity === 'emergency').length, 0, 'mutated input must not raise any emergency alert');
});

// === DM-IRON-006: incomplete iron studies + inflammation must abstain, not guess ===

test('DM-IRON-006: incomplete iron studies with concurrent inflammation abstain from a ranked iron/inflammation diagnosis', () => {
  const scenario = byHazard['DM-IRON-006'];
  const errors = validate(patientInputSchema, scenario.input.patientInput);
  assert.deepEqual(errors, [], 'patientInput must validate against patient-input.schema.json');

  const result = assess(scenario.input.patientInput);
  assert.equal(result.rankedDifferential.length, 0, 'no candidate may be ranked when ferritin/TSAT/TIBC are unknown, even with elevated CRP and microcytic morphology');
  assert.equal(result.alerts.length, 0);
  assertMatchedRuleIdsInclude(result, scenario.expectedTrace.matchedRuleIdsMustInclude, 'DM-IRON-006');
});

test('DM-IRON-006 NEGATIVE: a real low ferritin value with normal CRP resolves iron-deficiency-anemia (proves the abstention was driven by missingness, not by the CBC alone)', () => {
  const mutated = structuredClone(byHazard['DM-IRON-006'].input.patientInput);
  mutated.labs = { ferritin: 8, crpStatus: 'normal' };

  const result = assess(mutated);
  assert.equal(result.rankedDifferential[0]?.id, 'iron-deficiency-anemia');
  assert.equal(result.rankedDifferential[0]?.level, 'meets-defined-pattern');
});

// === DM-LAB-005: specimen/analyzer/method/unit mismatch fails closed under the P3 gate ===

test('DM-LAB-005: specimen/analyzer/method/unit mismatch against the SYNTHETIC reference-interval profile fails closed on all four independent dimensions', () => {
  const scenario = byHazard['DM-LAB-005'];
  const result = evaluateReferenceIntervalApplicability(refProfile, scenario.input.referenceIntervalRequest, { now: NOW });
  assert.equal(result.decision, 'fail_closed');
  const codes = result.blockers.map((blocker) => blocker.code);
  for (const expected of scenario.expectedBehavior.expectedBlockers) {
    assert.ok(codes.includes(expected), `expected blocker ${expected}, got [${codes.join(', ')}]`);
  }
});

test('DM-LAB-005 NEGATIVE: a fully matching request against the same profile is applicable (proves fail_closed was driven by the mismatch, not the profile itself)', () => {
  const matched = structuredClone(byHazard['DM-LAB-005'].input.referenceIntervalRequest);
  matched.specimen.code = 'SYN-SPECIMEN-A';
  matched.analyzer = { model: 'SYNTHETIC-ANALYZER-MODEL-A', method: 'SYNTHETIC-METHOD-A' };
  matched.unitCode = 'SYN-UNIT-A';

  const result = evaluateReferenceIntervalApplicability(refProfile, matched, { now: NOW });
  assert.equal(result.decision, 'applicable');
  assert.deepEqual(result.blockers, []);
});

// === DM-RESULT-007: dropped correction (final status, later corrected state, no superseding ref) ===

test('DM-RESULT-007: a dropped correction (final status, later corrected state in the lineage, no superseding reference) fails closed', () => {
  const scenario = byHazard['DM-RESULT-007'];
  const result = evaluateTerminologyApplicability(termProfile, scenario.input.terminologyObservation, { now: NOW });
  assert.equal(result.decision, 'fail_closed');
  const codes = result.blockers.map((blocker) => blocker.code);
  for (const expected of scenario.expectedBehavior.expectedBlockers) {
    assert.ok(codes.includes(expected), `expected blocker ${expected}, got [${codes.join(', ')}]`);
  }
});

test('DM-RESULT-007 NEGATIVE: removing the corrected state from the lineage is applicable (proves fail_closed was driven by the dropped correction)', () => {
  const cleaned = structuredClone(byHazard['DM-RESULT-007'].input.terminologyObservation);
  cleaned.statusLineage.states = ['registered', 'preliminary', 'final'];

  const result = evaluateTerminologyApplicability(termProfile, cleaned, { now: NOW });
  assert.equal(result.decision, 'applicable');
  assert.deepEqual(result.blockers, []);
});

// === DM-FHIR-008: unmapped local code fails closed rather than being interpreted ===

test('DM-FHIR-008: an unmapped local code fails closed rather than being interpreted', () => {
  const scenario = byHazard['DM-FHIR-008'];
  const result = evaluateTerminologyApplicability(termProfile, scenario.input.terminologyObservation, { now: NOW });
  assert.equal(result.decision, 'fail_closed');
  const codes = result.blockers.map((blocker) => blocker.code);
  for (const expected of scenario.expectedBehavior.expectedBlockers) {
    assert.ok(codes.includes(expected), `expected blocker ${expected}, got [${codes.join(', ')}]`);
  }
});

test('DM-FHIR-008 NEGATIVE: a mapped local code is applicable (proves fail_closed was driven by the missing mapping)', () => {
  const mapped = structuredClone(byHazard['DM-FHIR-008'].input.terminologyObservation);
  mapped.localCode = 'SYN-LOCAL-0001';

  const result = evaluateTerminologyApplicability(termProfile, mapped, { now: NOW });
  assert.equal(result.decision, 'applicable');
  assert.deepEqual(result.blockers, []);
});

// === DM-EQUITY-009 / DM-WORKFLOW-010: no engine exists; the suite must say so, not fabricate coverage ===

for (const hazardId of ['DM-EQUITY-009', 'DM-WORKFLOW-010']) {
  test(`${hazardId}: no executable engine exists; the fixture declares this honestly rather than claiming coverage`, () => {
    const scenario = byHazard[hazardId];
    assert.equal(scenario.executionBinding.engine, 'not_yet_implemented');
    assert.ok(typeof scenario.executionBinding.blockedOnTask === 'string' && scenario.executionBinding.blockedOnTask.length > 0);
    assert.equal(scenario.expectedBehavior.type, 'not_executable');
    assert.equal(scenario.input.kind, 'none');
    assert.equal(scenario.input.patientInput, null);
    assert.equal(scenario.input.referenceIntervalRequest, null);
    assert.equal(scenario.input.terminologyObservation, null);
    assert.equal(scenario.input.profileRef, null);
  });
}

test('DM-WORKFLOW-010: the one adjacent executable property (per-run rule-audit completeness) is real, but is explicitly NOT claimed as coverage of alert-lifecycle/override/downtime/handoff/recovery', () => {
  // This is deliberately a WEAK, PARTIAL signal: it proves the stateless per-run rule audit does
  // not silently drop a rule from a single evaluation. It says nothing about whether an alert
  // acknowledgement, override, downtime interruption, handoff, or recovery is tracked, because no
  // such state exists in this codebase (see the fixture's executionBinding.engineRationale).
  const result = assess({ patient: { ageMonths: 60, sexAtBirth: 'female' }, cbc: { hemoglobin: 12, mcv: 80 }, reticulocytes: {}, labs: {}, symptoms: {}, history: {}, exam: {}, smear: [] });
  assert.equal(result.provenance.evaluatedRuleCount, rules.length, 'every rule must be evaluated and counted in a single run — this is NOT alert-lifecycle coverage');
  assert.equal(result.provenance.ruleAudit.length, rules.length);
  assert.ok(result.provenance.ruleAudit.every((entry) => typeof entry.ruleId === 'string' && typeof entry.matched === 'boolean'));
});

test('DM-EQUITY-009 / DM-WORKFLOW-010 NEGATIVE: an executionBinding claiming not_yet_implemented without a blockedOnTask is schema-invalid (proves the honesty contract is enforced, not decorative)', () => {
  for (const hazardId of ['DM-EQUITY-009', 'DM-WORKFLOW-010']) {
    const mutated = structuredClone(byHazard[hazardId]);
    mutated.executionBinding.blockedOnTask = null;
    const errors = validate(scenarioSchema, mutated);
    assert.ok(errors.length > 0, `${hazardId}: removing blockedOnTask while engine is not_yet_implemented must fail schema validation`);
  }
});

// --- global negative: a fixture claiming an executed state is schema-invalid (AUTHORED != EXECUTED) ---

test('NEGATIVE: a fixture whose execution.state is mutated to "executed" is schema-invalid', () => {
  const mutated = structuredClone(byHazard['DM-CBC-001']);
  mutated.execution.state = 'executed';
  mutated.execution.result = { alertsFired: true };
  const errors = validate(scenarioSchema, mutated);
  assert.ok(errors.length > 0, 'a fixture claiming to have been executed must fail schema validation — authoring can never represent execution');
});

test('NEGATIVE: a fixture whose owner.name is mutated to a named individual is schema-invalid', () => {
  const mutated = structuredClone(byHazard['DM-LAB-005']);
  mutated.owner.name = 'Dr. Synthetic Placeholder';
  const errors = validate(scenarioSchema, mutated);
  assert.ok(errors.length > 0, 'a fixture naming a credentialed individual must fail schema validation — OQ-2 is owner-held');
});
