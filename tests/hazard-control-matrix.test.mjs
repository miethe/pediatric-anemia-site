// Hazard-to-control release-dependency manifest — arc-clinical-council-adoption-v1 P4-T2 / AC P4.1.
//
// Binds each of the ten DM-CBC-001..DM-WORKFLOW-010 hazards (validation_plan.md catalog, converted
// to executable synthetic scenarios by P4-T1) to its rule/control id(s), required test(s), candidate
// version, evidence, owner, and blocked release gate(s): docs/safety/hazard-control-matrix.json,
// validated against schemas/hazard-control-matrix.schema.json.
//
// This test lane does NOT trust the manifest's own claims. Every binding is cross-checked live
// against the repository state it claims to describe: fixture digests are recomputed, control ids
// are checked against the P4-T1 fixture's own expectedTrace/expectedBehavior, candidate/profile
// digests are recomputed from modules/anemia/*.json and the SYNTHETIC local-profile fixtures, and
// required-test markers are grepped against the real test source so a renamed/deleted test breaks
// this binding loudly. NO UNOWNED GAP is enforced twice: once structurally by the schema's per-row
// if/then (see schemas/hazard-control-matrix.schema.json), and once here by an explicit assertion
// plus a NEGATIVE test proving a blanked cell fails validation.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function sha256Of(relativePath) {
  const bytes = await readFile(path.join(root, relativePath));
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const schema = await readJson('schemas/hazard-control-matrix.schema.json');
const manifest = await readJson('docs/safety/hazard-control-matrix.json');
const dmScenarioSchema = await readJson('schemas/dangerous-miss-scenario.schema.json');
const dmTestSource = await readText('tests/dangerous-miss-scenarios.test.mjs');

const EXPECTED_HAZARD_IDS = [
  'DM-CBC-001', 'DM-HEME-002', 'DM-AGE-003', 'DM-URGENT-004', 'DM-LAB-005',
  'DM-IRON-006', 'DM-RESULT-007', 'DM-FHIR-008', 'DM-EQUITY-009', 'DM-WORKFLOW-010',
];

const NO_ENGINE_HAZARDS = new Set(['DM-EQUITY-009', 'DM-WORKFLOW-010']);

// --- schema validity of the manifest itself ------------------------------------------------------

test('docs/safety/hazard-control-matrix.json validates against schemas/hazard-control-matrix.schema.json', () => {
  const errors = validate(schema, manifest);
  assert.deepEqual(errors, [], `schema errors: ${JSON.stringify(errors)}`);
});

// --- exactly the ten catalog hazards, no more no fewer, one row each -----------------------------

test('exactly the ten DM-CBC-001..DM-WORKFLOW-010 catalog hazards are present, one row each', () => {
  assert.equal(manifest.rows.length, 10);
  const hazardIds = manifest.rows.map((row) => row.hazardId).sort();
  assert.deepEqual(hazardIds, [...EXPECTED_HAZARD_IDS].sort());
});

const byHazard = Object.fromEntries(manifest.rows.map((row) => [row.hazardId, row]));

// --- NO UNOWNED GAP: structural property, asserted directly ---------------------------------------

test('NO UNOWNED GAP: every row is either control_bound with >=1 control id and no finding, or no_control_exists with a non-null owned finding', () => {
  for (const row of manifest.rows) {
    if (row.controlBinding.status === 'control_bound') {
      assert.ok(row.controlBinding.controlIds.length >= 1, `${row.hazardId}: control_bound but controlIds is empty`);
      assert.equal(row.finding, null, `${row.hazardId}: control_bound but carries a finding`);
    } else if (row.controlBinding.status === 'no_control_exists') {
      assert.ok(row.finding, `${row.hazardId}: no_control_exists but finding is null — this is an UNOWNED GAP`);
      assert.equal(row.controlBinding.controlIds.length, 0, `${row.hazardId}: no_control_exists but controlIds is non-empty`);
      assert.ok(typeof row.finding.ownerRole === 'string' && row.finding.ownerRole.length > 0, `${row.hazardId}: finding has no ownerRole`);
      assert.ok(typeof row.finding.blockedOnTask === 'string' && row.finding.blockedOnTask.length > 0, `${row.hazardId}: finding has no blockedOnTask`);
      assert.ok(typeof row.ownerBinding.releaseGateOwnerRole === 'string', `${row.hazardId}: ownerBinding has no releaseGateOwnerRole`);
    } else {
      assert.fail(`${row.hazardId}: unknown controlBinding.status ${row.controlBinding.status}`);
    }
  }
});

test('NEGATIVE: blanking a no_control_exists row\'s finding to null is schema-invalid (proves the no-unowned-gap guard is enforced, not decorative)', () => {
  const mutated = structuredClone(manifest);
  const target = mutated.rows.find((row) => row.hazardId === 'DM-EQUITY-009');
  assert.equal(target.controlBinding.status, 'no_control_exists');
  target.finding = null; // blank the cell
  const errors = validate(schema, mutated);
  assert.ok(errors.length > 0, 'blanking finding on a no_control_exists row must fail schema validation');
  // restore is implicit: `mutated` is a structuredClone, `manifest` is untouched.
  const stillValid = validate(schema, manifest);
  assert.deepEqual(stillValid, [], 'the original (unblanked) manifest must remain schema-valid');
});

test('NEGATIVE: dropping ownerRole from an open finding is schema-invalid', () => {
  const mutated = structuredClone(manifest);
  const target = mutated.rows.find((row) => row.hazardId === 'DM-WORKFLOW-010');
  delete target.finding.ownerRole;
  const errors = validate(schema, mutated);
  assert.ok(errors.length > 0, 'a finding missing ownerRole must fail schema validation');
});

test('NEGATIVE: emptying controlIds on a control_bound row is schema-invalid', () => {
  const mutated = structuredClone(manifest);
  const target = mutated.rows.find((row) => row.hazardId === 'DM-CBC-001');
  assert.equal(target.controlBinding.status, 'control_bound');
  target.controlBinding.controlIds = [];
  const errors = validate(schema, mutated);
  assert.ok(errors.length > 0, 'a control_bound row with empty controlIds must fail schema validation');
});

// --- P4-T1's claim is re-verified independently, not taken on trust ------------------------------

test('exactly DM-EQUITY-009 and DM-WORKFLOW-010 are no_control_exists; the other eight are control_bound', () => {
  for (const row of manifest.rows) {
    const expectedStatus = NO_ENGINE_HAZARDS.has(row.hazardId) ? 'no_control_exists' : 'control_bound';
    assert.equal(row.controlBinding.status, expectedStatus, `${row.hazardId}: expected controlBinding.status ${expectedStatus}`);
  }
});

test('the two no_control_exists hazards independently verify against the live P4-T1 fixture: executionBinding.engine is not_yet_implemented', async () => {
  for (const hazardId of NO_ENGINE_HAZARDS) {
    const row = byHazard[hazardId];
    const fixture = await readJson(row.scenarioRef.fixturePath);
    assert.equal(fixture.hazardId, hazardId);
    assert.equal(fixture.executionBinding.engine, 'not_yet_implemented', `${hazardId}: fixture no longer declares not_yet_implemented — re-author this matrix row`);
    assert.equal(row.finding.blockedOnTask, fixture.executionBinding.blockedOnTask, `${hazardId}: finding.blockedOnTask has drifted from the fixture's own executionBinding.blockedOnTask`);
  }
});

// --- scenarioRef digests are live, not stale ------------------------------------------------------

test('every row scenarioRef points at the CURRENT P4-T1 fixture (digest, scenarioId, scenarioVersion all match live file)', async () => {
  for (const row of manifest.rows) {
    const liveDigest = await sha256Of(row.scenarioRef.fixturePath);
    assert.equal(row.scenarioRef.fixtureDigest, liveDigest, `${row.hazardId}: scenarioRef.fixtureDigest is stale — the P4-T1 fixture changed since this row was authored`);
    const fixture = await readJson(row.scenarioRef.fixturePath);
    assert.equal(row.scenarioRef.scenarioId, fixture.scenarioId, `${row.hazardId}: scenarioRef.scenarioId does not match the fixture`);
    assert.equal(row.scenarioRef.scenarioVersion, fixture.scenarioVersion, `${row.hazardId}: scenarioRef.scenarioVersion does not match the fixture`);
    assert.equal(row.hazardFamily, fixture.hazardFamily, `${row.hazardId}: hazardFamily does not match the fixture`);
    // the referenced fixture itself must still be a schema-valid P4-T1 scenario specification
    const errors = validate(dmScenarioSchema, fixture);
    assert.deepEqual(errors, [], `${row.hazardId}: referenced fixture is no longer schema-valid against dangerous-miss-scenario.schema.json`);
  }
});

// --- controlIds trace directly to the P4-T1 fixture's own expectedTrace/expectedBehavior ----------

test('control_bound controlIds equal the referenced fixture\'s expectedTrace.matchedRuleIdsMustInclude (engine rows) or expectedBehavior.expectedBlockers (applicability rows)', async () => {
  for (const row of manifest.rows) {
    if (row.controlBinding.status !== 'control_bound') continue;
    const fixture = await readJson(row.scenarioRef.fixturePath);
    const expected = row.controlBinding.controlType === 'engine_rule'
      ? fixture.expectedTrace.matchedRuleIdsMustInclude
      : fixture.expectedBehavior.expectedBlockers;
    assert.deepEqual([...row.controlBinding.controlIds].sort(), [...expected].sort(), `${row.hazardId}: controlIds diverges from the fixture's own authored expectation`);
  }
});

// --- versionBinding digests are live, not stale -----------------------------------------------

test('candidate_rules versionBinding rows are pinned to the CURRENT modules/anemia/{rules,candidates,module}.json digests', async () => {
  const rulesDigest = await sha256Of('modules/anemia/rules.json');
  const candidatesDigest = await sha256Of('modules/anemia/candidates.json');
  const moduleDigest = await sha256Of('modules/anemia/module.json');

  for (const row of manifest.rows) {
    if (row.versionBinding.bindingType !== 'candidate_rules') continue;
    assert.equal(row.versionBinding.candidateBinding.rulesFileDigest, rulesDigest, `${row.hazardId}: rulesFileDigest is stale`);
    assert.equal(row.versionBinding.candidateBinding.candidatesFileDigest, candidatesDigest, `${row.hazardId}: candidatesFileDigest is stale`);
    assert.equal(row.versionBinding.candidateBinding.moduleFileDigest, moduleDigest, `${row.hazardId}: moduleFileDigest is stale`);
  }
});

test('local_profile versionBinding rows are pinned to the CURRENT SYNTHETIC local-profile fixture digests', async () => {
  const refDigest = await sha256Of('tests/fixtures/local-profile/SYNTHETIC-reference-interval-profile.json');
  const termDigest = await sha256Of('tests/fixtures/local-profile/SYNTHETIC-terminology-profile.json');

  for (const row of manifest.rows) {
    if (row.versionBinding.bindingType !== 'local_profile') continue;
    const expected = row.versionBinding.profileBinding.profileId === 'SYNTHETIC-reference-interval-profile' ? refDigest : termDigest;
    assert.equal(row.versionBinding.profileBinding.profileDigest, expected, `${row.hazardId}: profileBinding.profileDigest is stale`);
  }
});

// --- required tests actually exist in the real test file, not invented ---------------------------

test('every requiredTests.testMarkers entry is a real, present substring of the referenced testFile source', () => {
  const sourceByFile = { 'tests/dangerous-miss-scenarios.test.mjs': dmTestSource };
  for (const row of manifest.rows) {
    const source = sourceByFile[row.requiredTests.testFile];
    assert.ok(source, `${row.hazardId}: requiredTests.testFile "${row.requiredTests.testFile}" is not a known/loaded test source`);
    for (const marker of row.requiredTests.testMarkers) {
      assert.ok(source.includes(marker), `${row.hazardId}: required test marker not found in ${row.requiredTests.testFile}: "${marker}"`);
    }
  }
});

test('coverageKind is honesty_absence_of_coverage only for the two no_control_exists hazards; behavioral_positive_and_negative for the rest', () => {
  for (const row of manifest.rows) {
    const expected = NO_ENGINE_HAZARDS.has(row.hazardId) ? 'honesty_absence_of_coverage' : 'behavioral_positive_and_negative';
    assert.equal(row.requiredTests.coverageKind, expected, `${row.hazardId}: unexpected coverageKind`);
  }
});

// --- ownerBinding.reviewerRole matches the fixture's own owner.role (no drift, no invention) ------

test('ownerBinding.reviewerRole matches the referenced fixture\'s owner.role', async () => {
  for (const row of manifest.rows) {
    const fixture = await readJson(row.scenarioRef.fixturePath);
    assert.equal(row.ownerBinding.reviewerRole, fixture.owner.role, `${row.hazardId}: ownerBinding.reviewerRole diverges from the fixture's owner.role`);
    assert.equal(row.ownerBinding.name, null, `${row.hazardId}: ownerBinding.name must never name a credentialed individual (OQ-2 is owner-held)`);
  }
});

// --- AUTHORED vs EXECUTED: technicalExecution and clinicalAdjudication never claim more than true --

test('AUTHORED != EXECUTED: clinicalAdjudication.status is not_executed_owner_held for every row (OQ-6 is unresolved; nothing here can self-adjudicate)', () => {
  for (const row of manifest.rows) {
    assert.equal(row.evidence.clinicalAdjudication.status, 'not_executed_owner_held', `${row.hazardId}: clinicalAdjudication.status must not be adjudicated — OQ-6 is unresolved and this repository never self-adjudicates`);
    assert.equal(row.evidence.clinicalAdjudication.systemRef, null);
  }
});

test('technicalExecution.status is repository_test_executed only for control_bound rows; not_executed for no_control_exists rows', () => {
  for (const row of manifest.rows) {
    const expected = row.controlBinding.status === 'control_bound' ? 'repository_test_executed' : 'not_executed';
    assert.equal(row.evidence.technicalExecution.status, expected, `${row.hazardId}: unexpected technicalExecution.status`);
  }
});

// --- release states: BUILD STATE CANNOT SATISFY STUDY STATE --------------------------------------

const ALWAYS_BLOCKED = ['credentialed_review_complete', 'clinical_validation_complete', 'certified_for_defined_scope', 'released', 'activated'];

test('every row blocks credentialed_review_complete, clinical_validation_complete, certified_for_defined_scope, released, and activated (no credentialed/clinical/release evidence exists anywhere in this matrix)', () => {
  for (const row of manifest.rows) {
    for (const state of ALWAYS_BLOCKED) {
      assert.ok(row.blockedReleaseStates.includes(state), `${row.hazardId}: must block ${state}`);
    }
  }
});

test('the two no_control_exists rows additionally block repository_ready, readiness_audit_complete, and qualifying_runtime_pilot', () => {
  for (const hazardId of NO_ENGINE_HAZARDS) {
    const row = byHazard[hazardId];
    for (const state of ['repository_ready', 'readiness_audit_complete', 'qualifying_runtime_pilot']) {
      assert.ok(row.blockedReleaseStates.includes(state), `${hazardId}: must additionally block ${state}`);
    }
  }
});

test('the eight control_bound rows do NOT claim repository_ready/readiness_audit_complete/qualifying_runtime_pilot are unblocked by themselves (they simply do not assert those states at all — silence is not achievement)', () => {
  for (const row of manifest.rows) {
    if (NO_ENGINE_HAZARDS.has(row.hazardId)) continue;
    // absence from blockedReleaseStates means "not blocked BY THIS HAZARD" -- it must never be
    // read as "achieved"; this test only pins the CURRENT authored set so a future edit that
    // silently claims more (e.g. adding clinical_validation_complete as achieved) is impossible
    // by construction (the field can only ever be named in blockedReleaseStates, never elsewhere).
    assert.deepEqual([...row.blockedReleaseStates].sort(), [...ALWAYS_BLOCKED].sort(), `${row.hazardId}: blockedReleaseStates changed from the authored baseline`);
  }
});

// --- release-dependency manifest aggregate is internally consistent, not self-declared -----------

test('releaseDependencyManifest.hazardsWithControl/hazardsWithoutControl match a live recount of rows', () => {
  const withControl = manifest.rows.filter((row) => row.controlBinding.status === 'control_bound').length;
  const withoutControl = manifest.rows.filter((row) => row.controlBinding.status === 'no_control_exists').length;
  assert.equal(manifest.releaseDependencyManifest.hazardsWithControl, withControl);
  assert.equal(manifest.releaseDependencyManifest.hazardsWithoutControl, withoutControl);
  assert.equal(manifest.releaseDependencyManifest.totalHazards, 10);
});

test('releaseDependencyManifest.blockedStates.blockedByHazardIds match a live union of each row\'s blockedReleaseStates', () => {
  const liveAgg = new Map();
  for (const row of manifest.rows) {
    for (const state of row.blockedReleaseStates) {
      if (!liveAgg.has(state)) liveAgg.set(state, new Set());
      liveAgg.get(state).add(row.hazardId);
    }
  }
  const declaredStates = new Set(manifest.releaseDependencyManifest.blockedStates.map((entry) => entry.state));
  assert.deepEqual(declaredStates, new Set(liveAgg.keys()), 'declared blockedStates set diverges from a live recount');
  for (const entry of manifest.releaseDependencyManifest.blockedStates) {
    const live = [...liveAgg.get(entry.state)].sort();
    assert.deepEqual([...entry.blockedByHazardIds].sort(), live, `blockedStates[${entry.state}].blockedByHazardIds diverges from a live recount`);
  }
});

test('releaseDependencyManifest.clinicalValidationComplete and credentialedReviewComplete are structurally false', () => {
  assert.equal(manifest.releaseDependencyManifest.clinicalValidationComplete, false);
  assert.equal(manifest.releaseDependencyManifest.credentialedReviewComplete, false);
});

test('NEGATIVE: a manifest claiming clinicalValidationComplete: true is schema-invalid', () => {
  const mutated = structuredClone(manifest);
  mutated.releaseDependencyManifest.clinicalValidationComplete = true;
  const errors = validate(schema, mutated);
  assert.ok(errors.length > 0, 'clinicalValidationComplete: true must fail schema validation — no evaluator in this repository can prove the full chain');
});
