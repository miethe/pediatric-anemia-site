// P4-V1 remediation (fix cycle 1) — regression coverage for the V3/V4/V5 clinical dependency-chain
// schemas (docs/clinical/schemas/v3-protocol-result.schema.json and
// docs/clinical/schemas/v4-v5-safety-human-factors-result.schema.json).
//
// The P4-V1 diagnostic-accuracy-methods reviewer FAILed P4-T3/P4-T4 on two grounds:
//
//   Finding 1 (CRITICAL): v3ProtocolContract could reach `protocolStatus: protocol_frozen` with an
//   `endpoints[]` entry carrying `status: asserted` but `metric`/`thresholdValue`/`goNoGoDirection`
//   all null -- the field carrying the actual go/no-go threshold PEDS-DX-002 exists to protect.
//
//   Finding 2 (HIGH, systemic): JSON Schema `required` enforces key PRESENCE, not non-null CONTENT.
//   Several `then` blocks required a key without re-narrowing its type, so `status: "asserted"`
//   could coexist with `null` content across nine named locations in the two schemas (the reviewer
//   sampled; this suite verifies the full owner-held-content surface, not only the nine cited).
//
//   Root cause: ZERO test files referenced either clinical schema before this file, so nothing
//   prevented either defect from regressing silently. Both schemas live outside `schemas/`
//   (docs/clinical/schemas/), which is why `npm run check`'s schema-lint step never touched them.
//
// Every case below is a pair: a POSITIVE fixture proving the schema still accepts a genuinely
// complete record, and a NEGATIVE mutation proving each individual guard fails closed when its
// target field is nulled out. If any guard added in this remediation is later reverted, the
// corresponding negative test here fails.
//
// Cross-file $ref note: docs/clinical/schemas/v4-v5-safety-human-factors-result.schema.json
// deliberately cross-file `$ref`s seven primitives out of v3-protocol-result.schema.json's `$defs`
// (see docs/clinical/v4-v5-safety-human-factors-contract.md section 2.1) rather than duplicating
// them. scripts/lib/json-schema-lite.mjs's `resolveRef` only supports local `#/` refs (by design --
// see its own header comment), so this file bundles the seven primitives into a local copy of the
// V4/V5 schema before validating against it. `bundleV4V5Schema`'s coverage-drift test below fails
// loudly if a cross-file `$ref` is added or removed without updating the bundle, rather than the
// bundler silently validating against a stale copy.
//
// Fix cycle 1b: the KNOWN LIMITATION below (json-schema-lite.mjs throwing on
// `exclusiveMinimum`/`exclusiveMaximum`) is now FIXED -- both keywords are implemented (numeric
// draft-2020-12 form) and added to SUPPORTED_KEYWORDS. Whole-document validate() calls against
// v3ProtocolContract and v5HumanFactorsProtocol no longer throw. The "whole-document coverage" cases
// added under "=== Whole-document coverage (fix cycle 1b) ===" below exercise this end to end,
// alongside the reviewer's own P4-V1 reproductions, and are the proof this remediation asked for.
// The pre-existing fragment-only tests above and below that section are left exactly as they were:
// they remain correct, targeted regression coverage for each individual guard and are not weakened
// or replaced by the addition of whole-document coverage.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';

// FORMERLY A KNOWN LIMITATION, FIXED IN FIX CYCLE 1B (discovered during fix cycle 1, reported
// rather than silently patched because scripts/lib/json-schema-lite.mjs was outside that task's
// file-ownership scope): scripts/lib/json-schema-lite.mjs's SUPPORTED_KEYWORDS omitted
// `exclusiveMinimum`/`exclusiveMaximum`. v3-protocol-result.schema.json's
// `uncertaintyPlan.confidenceLevel` (untouched by any remediation -- the constraint, confidence
// strictly between 0 and 1, was always correct and meaningful) declares both. Because the
// validator's fail-closed keyword check ran unconditionally on every schema node reached during
// recursion -- regardless of the *value* being validated, and regardless of which `oneOf` branch a
// document is "meant" to match, since `oneOf` evaluates every branch -- ANY document containing a
// `confidenceLevel` key (required, unconditionally, whenever `uncertaintyPlan` is present) THREW
// instead of returning an errors array, for both v3ProtocolContract and v5HumanFactorsProtocol
// (v4SilentModeProtocol has no uncertaintyPlan and was unaffected).
//
// Fix cycle 1b implemented `exclusiveMinimum`/`exclusiveMaximum` (draft 2020-12 numeric form) in
// json-schema-lite.mjs and added both to SUPPORTED_KEYWORDS (see tests/json-schema-lite.test.mjs
// for the validator's own unit coverage of the new keywords, including the boundary-equality
// cases). Whole-document validate() calls against v3ProtocolContract and v5HumanFactorsProtocol no
// longer throw -- see "=== Whole-document coverage (fix cycle 1b) ===" below, which re-runs the
// reviewer's Finding-1/study-completion reproductions against the FULL document rather than a
// fragment, closing the gap this comment used to describe.
//
// This gap was more disruptive than it first looked while it was open: an earlier draft of this
// suite tried wrapping whole-document validate() calls in a try/catch that treated "threw with this
// specific message" as equivalent to "rejected". That was WRONG for a regression test, because the
// throw was unconditional (independent of any guard in this remediation) -- a whole-document test
// built that way would keep reporting a false "pass" even with the endpoints/humanFactorsMeasures/
// etc. guard entirely reverted, since the exclusiveMinimum exception fired before, or regardless of
// whether, the guard under test ever got a chance to reject anything. This was caught empirically:
// temporarily reverting the Finding-1 `endpoints` gate left the try/catch-wrapped test still green.
// It was removed. The tests immediately below instead validate the SMALLEST schema fragment that
// actually contains the guard under test (a `$defs` entry, or a `.then.properties.<field>`
// fragment); that fragment-only pattern remains correct, targeted coverage and is kept unchanged --
// it is not weakened or made redundant by the whole-document coverage added alongside it.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clinicalSchemaDir = path.join(root, 'docs', 'clinical', 'schemas');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

const v3Schema = await readJson('docs/clinical/schemas/v3-protocol-result.schema.json');
const v4v5RawText = await readFile(path.join(clinicalSchemaDir, 'v4-v5-safety-human-factors-result.schema.json'), 'utf8');
const v4v5Schema = JSON.parse(v4v5RawText);

// --- cross-file $ref bundling -------------------------------------------------------------------
//
// Known aliases in v4-v5-safety-human-factors-result.schema.json's $defs that are pure cross-file
// `$ref`s into v3-protocol-result.schema.json. Overwriting each alias with the real V3 definition
// means every *internal* `#/$defs/...` ref inside the copied content (e.g. analysisPlan's own
// `$ref: "#/$defs/ownerHeldStatus"`) resolves correctly against the bundled schema's own root,
// because the target key now holds real content at that same top-level $defs path.
const V3_ALIASED_DEF_KEYS = ['ownerHeldStatus', 'candidateBinding', 'referenceLocator', 'analysisPlan', 'uncertaintyPlan', 'adjudicationSystemBinding'];

function bundleV4V5Schema() {
  const bundled = structuredClone(v4v5Schema);
  for (const key of V3_ALIASED_DEF_KEYS) {
    bundled.$defs[key] = structuredClone(v3Schema.$defs[key]);
  }
  // ownerDecisionSignatureRef aliases a *deep path* inside v3OwnerDecision, not a top-level $def.
  bundled.$defs.ownerDecisionSignatureRef = structuredClone(v3Schema.$defs.v3OwnerDecision.properties.signatureRef);
  return bundled;
}

const v4v5Schema_bundled = bundleV4V5Schema();

test('coverage-drift guard: the bundler covers exactly the cross-file $refs the V4/V5 schema actually declares', () => {
  // If a new `v3-protocol-result.schema.json#/...` $ref is added later without updating
  // V3_ALIASED_DEF_KEYS / the ownerDecisionSignatureRef special case above, this test fails loudly
  // instead of the bundle silently leaving a dangling external $ref that resolveRef() would throw
  // on the moment any fixture below exercised that branch.
  const found = [...v4v5RawText.matchAll(/"v3-protocol-result\.schema\.json#\/([^"]+)"/g)].map((m) => m[1]);
  const expected = [
    '$defs/ownerHeldStatus',
    '$defs/candidateBinding',
    '$defs/referenceLocator',
    '$defs/analysisPlan',
    '$defs/uncertaintyPlan',
    '$defs/adjudicationSystemBinding',
    '$defs/v3OwnerDecision/properties/signatureRef',
  ];
  assert.deepEqual(found.sort(), [...expected].sort());
});

test('every external $ref target actually resolves inside v3-protocol-result.schema.json (no dangling cross-file ref)', () => {
  const paths = [
    '$defs.ownerHeldStatus', '$defs.candidateBinding', '$defs.referenceLocator',
    '$defs.analysisPlan', '$defs.uncertaintyPlan', '$defs.adjudicationSystemBinding',
    '$defs.v3OwnerDecision.properties.signatureRef',
  ];
  for (const dotted of paths) {
    const resolved = dotted.split('.').reduce((node, segment) => node?.[segment], v3Schema);
    assert.ok(resolved !== undefined, `${dotted} did not resolve in v3-protocol-result.schema.json`);
  }
});

// --- shared synthetic fixture builders -----------------------------------------------------------
//
// These are schema-conformance fixtures only, never clinical content: every string is an obvious
// TEST-SYNTHETIC placeholder, no dataset/site/participant/threshold value is presented as real, and
// nothing here is written back into docs/clinical/ or asserted as owner-held evidence. They exist
// solely to prove the JSON Schema guards fixed in this remediation actually discriminate between
// "asserted with real content" and "asserted with null content masquerading as real".

const DIGEST = `sha256:${'a'.repeat(64)}`;

function candidateBinding() {
  return { candidateId: 'TEST-SYNTHETIC-candidate', candidateVersion: '0.0.0-test', candidateDigest: DIGEST };
}

function emptyRef() {
  return { systemName: null, recordId: null, status: null };
}

function namedRef(recordId) {
  return { systemName: 'TEST-SYNTHETIC-system', recordId, status: 'TEST-SYNTHETIC-status' };
}

function validIntendedUse() {
  return {
    status: 'asserted',
    population: 'TEST-SYNTHETIC population statement',
    ageOrDevelopmentalPartitions: ['TEST-SYNTHETIC-partition'],
    setting: 'TEST-SYNTHETIC-setting',
    candidateScopeStatement: 'TEST-SYNTHETIC-scope',
    regulatoryClassification: 'TEST-SYNTHETIC-classification',
    scopeExits: ['TEST-SYNTHETIC-scope-exit'],
  };
}

function validDatasetAndReferenceStandard() {
  return {
    status: 'asserted',
    datasetSource: 'TEST-SYNTHETIC-source',
    dataPartner: 'TEST-SYNTHETIC-partner',
    sampleFrame: { inclusionCriteria: ['TEST-SYNTHETIC-inclusion'], targetSampleSize: 100 },
    referenceStandardDefinition: 'TEST-SYNTHETIC-reference-standard',
    referenceStandardBlinding: 'blinded_to_index_test',
    phiHandling: 'not_applicable_repository_never_receives_records',
    rightsReceiptRef: emptyRef(),
  };
}

function validEndpoint(endpointId = 'dangerous_miss_rate') {
  return {
    endpointId,
    status: 'asserted',
    metric: 'TEST-SYNTHETIC-metric-definition',
    thresholdValue: 'TEST-SYNTHETIC-threshold',
    goNoGoDirection: 'lower_is_better',
    isIllustrative: false,
  };
}

function validUncertaintyPlan() {
  return { status: 'asserted', intervalType: 'confidence_interval', confidenceLevel: 0.95, estimationMethod: 'TEST-SYNTHETIC-method' };
}

function validSubgroupPlan() {
  return {
    status: 'asserted',
    dimensions: ['age_band'],
    strataDefinition: [{ dimension: 'age_band', strata: ['TEST-SYNTHETIC-stratum'] }],
    minimumCellSize: 10,
    prespecified: true,
  };
}

function validAnalysisPlan() {
  return {
    status: 'asserted',
    primaryAnalysisMethod: 'TEST-SYNTHETIC-method',
    missingDataHandling: 'TEST-SYNTHETIC-missing-data-handling',
    interimAnalysis: null,
    blinding: 'TEST-SYNTHETIC-blinding',
    statisticalAuthorityRef: emptyRef(),
    prespecifiedBeforeUnblinding: true,
  };
}

function validAdjudicationSystemBinding() {
  return {
    status: 'asserted',
    systemRef: emptyRef(),
    adjudicatorRefs: [namedRef('TEST-SYNTHETIC-adjudicator-1'), namedRef('TEST-SYNTHETIC-adjudicator-2')],
    independenceAttestation: 'independent_of_candidate_development',
    discordanceResolutionMethod: 'TEST-SYNTHETIC-discordance-method',
  };
}

function validV3ProtocolContract() {
  return {
    recordType: 'v3ProtocolContract',
    protocolId: 'TEST-SYNTHETIC-protocol',
    protocolVersion: '1.0.0-test',
    candidateBinding: candidateBinding(),
    protocolStatus: 'protocol_frozen',
    intendedUse: validIntendedUse(),
    datasetAndReferenceStandard: validDatasetAndReferenceStandard(),
    endpoints: [validEndpoint()],
    uncertaintyPlan: validUncertaintyPlan(),
    subgroupPlan: validSubgroupPlan(),
    analysisPlan: validAnalysisPlan(),
    adjudicationSystemBinding: validAdjudicationSystemBinding(),
    frozenAt: '2026-07-19T00:00:00Z',
    frozenBy: emptyRef(),
    supersededBy: null,
  };
}

// === Finding 1 (CRITICAL): endpoints must be asserted-with-content before protocol_frozen validates ===
//
// The reviewer's exact repro (`protocolStatus: protocol_frozen`, `frozenAt`/`frozenBy` populated,
// six owner-held sections `asserted`, and one `endpoints[]` entry with
// `status: "not_executed_owner_held"`/all-null content) necessarily includes a fully-asserted
// `uncertaintyPlan`, which triggers the KNOWN LIMITATION above the moment it is run through the
// whole schema. These tests instead validate `v3ProtocolContract.then.properties.endpoints` -- the
// EXACT schema fragment the reviewer identified as missing -- directly. This is not a weaker proxy:
// it is the literal mechanism under test (see Finding 1's suggested fix), and unlike a whole-document
// run it reports a clean, non-thrown errors[] result either way.

test('NEGATIVE (Finding 1 reproduction, permanent regression case): the reviewer\'s exact repro -- an endpoints[] entry with status "not_executed_owner_held" and metric/threshold/direction all null -- fails the protocol_frozen freeze gate', () => {
  // Before this remediation, `v3ProtocolContract.then` had no `endpoints` entry at all, so this
  // array validated against the freeze gate with zero errors regardless of content.
  const errors = validate(v3Schema.$defs.v3ProtocolContract.then.properties.endpoints, [{
    endpointId: 'dangerous_miss_rate', status: 'not_executed_owner_held', metric: null, thresholdValue: null, goNoGoDirection: null, isIllustrative: false,
  }], { rootSchema: v3Schema });
  assert.ok(errors.length > 0, 'a protocol_frozen document whose only endpoint is not_executed_owner_held must fail the freeze gate');
});

// The content-narrowing half of Finding 1 (status: asserted alone must not be sufficient --
// metric/thresholdValue/goNoGoDirection must also be non-null) is NOT expressible by
// `.then.properties.endpoints` in isolation -- that fragment only ever carries the status-const
// check. The content guard lives on `endpointDefinition`'s own if/then (added by this remediation,
// mirroring intendedUse/uncertaintyPlan) and is combined with this status-const check only when
// BOTH `v3ProtocolContract.properties.endpoints` (always-on, `$ref`s endpointDefinition) and
// `v3ProtocolContract.then.properties.endpoints` (freeze-gate-only) are applied together, i.e. on a
// real document -- see the endpointDefinition-level POSITIVE/NEGATIVE pair below for that half,
// proven cleanly without touching uncertaintyPlan.

test('POSITIVE: protocol_frozen freeze gate -- an endpoints[] entry asserted with real content passes', () => {
  const errors = validate(v3Schema.$defs.v3ProtocolContract.then.properties.endpoints, [validEndpoint()], { rootSchema: v3Schema });
  assert.deepEqual(errors, []);
});

test('NEGATIVE: endpointDefinition in isolation -- status asserted with null content fails its own if/then (not only the parent gate)', () => {
  const errors = validate(v3Schema.$defs.endpointDefinition, {
    endpointId: 'dangerous_miss_rate', status: 'asserted', metric: null, thresholdValue: null, goNoGoDirection: null, isIllustrative: false,
  }, { rootSchema: v3Schema });
  assert.ok(errors.length > 0);
});

test('POSITIVE: endpointDefinition in isolation -- status asserted with real content is valid', () => {
  const errors = validate(v3Schema.$defs.endpointDefinition, validEndpoint(), { rootSchema: v3Schema });
  assert.deepEqual(errors, []);
});

// === Finding 2 (systemic): per-field null-content guards, v3 ===================================

test('NEGATIVE: datasetAndReferenceStandard.sampleFrame null while asserted must NOT validate', () => {
  const data = validDatasetAndReferenceStandard();
  data.sampleFrame = null;
  const errors = validate(v3Schema.$defs.datasetAndReferenceStandard, data, { rootSchema: v3Schema });
  assert.ok(errors.length > 0);
});

test('POSITIVE: datasetAndReferenceStandard fully asserted is valid', () => {
  const errors = validate(v3Schema.$defs.datasetAndReferenceStandard, validDatasetAndReferenceStandard(), { rootSchema: v3Schema });
  assert.deepEqual(errors, []);
});

test('NEGATIVE: subgroupPlan.minimumCellSize null while asserted must NOT validate', () => {
  const data = validSubgroupPlan();
  data.minimumCellSize = null;
  const errors = validate(v3Schema.$defs.subgroupPlan, data, { rootSchema: v3Schema });
  assert.ok(errors.length > 0);
});

test('NEGATIVE: subgroupPlan.strataDefinition missing/null while asserted must NOT validate (previously not even required)', () => {
  const data = validSubgroupPlan();
  data.strataDefinition = null;
  const errors = validate(v3Schema.$defs.subgroupPlan, data, { rootSchema: v3Schema });
  assert.ok(errors.length > 0);
});

test('POSITIVE: subgroupPlan fully asserted is valid', () => {
  const errors = validate(v3Schema.$defs.subgroupPlan, validSubgroupPlan(), { rootSchema: v3Schema });
  assert.deepEqual(errors, []);
});

test('NEGATIVE: analysisPlan.missingDataHandling null while asserted must NOT validate', () => {
  const data = validAnalysisPlan();
  data.missingDataHandling = null;
  const errors = validate(v3Schema.$defs.analysisPlan, data, { rootSchema: v3Schema });
  assert.ok(errors.length > 0);
});

test('NEGATIVE: analysisPlan.blinding null while asserted must NOT validate', () => {
  const data = validAnalysisPlan();
  data.blinding = null;
  const errors = validate(v3Schema.$defs.analysisPlan, data, { rootSchema: v3Schema });
  assert.ok(errors.length > 0);
});

test('POSITIVE: analysisPlan fully asserted is valid', () => {
  const errors = validate(v3Schema.$defs.analysisPlan, validAnalysisPlan(), { rootSchema: v3Schema });
  assert.deepEqual(errors, []);
});

test('NEGATIVE: adjudicationSystemBinding.discordanceResolutionMethod null while asserted must NOT validate', () => {
  const data = validAdjudicationSystemBinding();
  data.discordanceResolutionMethod = null;
  const errors = validate(v3Schema.$defs.adjudicationSystemBinding, data, { rootSchema: v3Schema });
  assert.ok(errors.length > 0);
});

test('POSITIVE: adjudicationSystemBinding fully asserted is valid', () => {
  const errors = validate(v3Schema.$defs.adjudicationSystemBinding, validAdjudicationSystemBinding(), { rootSchema: v3Schema });
  assert.deepEqual(errors, []);
});

// === Finding 2 (systemic): per-field null-content guards, v4/v5 =================================

function validGoNoGoCriterion() {
  return { criterionId: 'no_hidden_dangerous_behavior', status: 'asserted', thresholdDescription: 'TEST-SYNTHETIC-threshold-description', isIllustrative: false };
}

function validHumanFactorsMeasure() {
  return { measureId: 'time_on_task', status: 'asserted', metric: 'TEST-SYNTHETIC-metric', thresholdValue: 'TEST-SYNTHETIC-threshold', thresholdUnit: 'TEST-SYNTHETIC-unit', isIllustrative: false };
}

function validAlertLifecycle() {
  return {
    status: 'asserted',
    acknowledgmentAndEscalationSla: 'TEST-SYNTHETIC-sla',
    deferralPolicy: 'TEST-SYNTHETIC-deferral',
    overrideRationalePolicy: 'TEST-SYNTHETIC-override-rationale',
    duplicateSuppressionRule: 'TEST-SYNTHETIC-duplicate-suppression',
    downtimeReplayProcedure: 'TEST-SYNTHETIC-downtime-replay',
    downtimeProcedureOwnerRef: emptyRef(),
    crossShiftHandoffProcedure: 'TEST-SYNTHETIC-handoff',
    urgentDominanceVerificationMethod: 'TEST-SYNTHETIC-urgent-dominance',
    incidentLinkageProcedure: 'TEST-SYNTHETIC-incident-linkage',
  };
}

function validEquityAndAccessibilityPlan() {
  return {
    status: 'asserted',
    dimensions: ['age_band'],
    minimumRepresentation: 'TEST-SYNTHETIC-minimum-representation',
    prespecified: true,
    equityGovernanceProtocolRef: emptyRef(),
  };
}

test('NEGATIVE: goNoGoCriterion.thresholdDescription null while asserted must NOT validate (previously had no if/then at all)', () => {
  const data = validGoNoGoCriterion();
  data.thresholdDescription = null;
  const errors = validate(v4v5Schema_bundled.$defs.goNoGoCriterion, data, { rootSchema: v4v5Schema_bundled });
  assert.ok(errors.length > 0);
});

test('POSITIVE: goNoGoCriterion fully asserted is valid', () => {
  const errors = validate(v4v5Schema_bundled.$defs.goNoGoCriterion, validGoNoGoCriterion(), { rootSchema: v4v5Schema_bundled });
  assert.deepEqual(errors, []);
});

test('NEGATIVE: humanFactorsMeasureDefinition metric/thresholdValue/thresholdUnit null while asserted must NOT validate (previously had no if/then at all)', () => {
  const data = validHumanFactorsMeasure();
  data.metric = null;
  data.thresholdValue = null;
  data.thresholdUnit = null;
  const errors = validate(v4v5Schema_bundled.$defs.humanFactorsMeasureDefinition, data, { rootSchema: v4v5Schema_bundled });
  assert.ok(errors.length > 0);
});

test('POSITIVE: humanFactorsMeasureDefinition fully asserted is valid', () => {
  const errors = validate(v4v5Schema_bundled.$defs.humanFactorsMeasureDefinition, validHumanFactorsMeasure(), { rootSchema: v4v5Schema_bundled });
  assert.deepEqual(errors, []);
});

test('NEGATIVE: equityAndAccessibilityPlan.minimumRepresentation null while asserted must NOT validate', () => {
  const data = validEquityAndAccessibilityPlan();
  data.minimumRepresentation = null;
  const errors = validate(v4v5Schema_bundled.$defs.equityAndAccessibilityPlan, data, { rootSchema: v4v5Schema_bundled });
  assert.ok(errors.length > 0);
});

test('POSITIVE: equityAndAccessibilityPlan fully asserted is valid', () => {
  const errors = validate(v4v5Schema_bundled.$defs.equityAndAccessibilityPlan, validEquityAndAccessibilityPlan(), { rootSchema: v4v5Schema_bundled });
  assert.deepEqual(errors, []);
});

// --- full-record V4 (v4SilentModeProtocol) fixtures ----------------------------------------------

function validOperationsWindow() {
  return {
    status: 'asserted',
    dataPartnerOrSite: emptyRef(),
    startDate: '2026-08-01T00:00:00Z',
    endDate: '2026-09-01T00:00:00Z',
    durationDays: 31,
    environment: 'TEST-SYNTHETIC-environment',
  };
}

function validLiveDataSourceBinding() {
  return { status: 'asserted', dataPartner: 'TEST-SYNTHETIC-partner', ehrSystemRef: emptyRef(), dataBoundaryPosture: 'no_data_leaves_data_partner_environment' };
}

function validMissingnessMonitoringPlan() {
  return { status: 'asserted', monitoringMethod: 'TEST-SYNTHETIC-monitoring-method', missingnessNeverClearsVerificationMethod: 'TEST-SYNTHETIC-verification-method' };
}

function validWouldBeAlertCapturePlan() {
  return { status: 'asserted', captureMethod: 'TEST-SYNTHETIC-capture-method', hazardMatrixRef: emptyRef() };
}

function validOverrideSimulationPlan() {
  return { status: 'asserted', scenarios: ['TEST-SYNTHETIC-scenario'], method: 'TEST-SYNTHETIC-method' };
}

function validV4SilentModeProtocol() {
  return {
    recordType: 'v4SilentModeProtocol',
    protocolId: 'TEST-SYNTHETIC-v4-protocol',
    protocolVersion: '1.0.0-test',
    candidateBinding: candidateBinding(),
    protocolStatus: 'protocol_frozen',
    operationsWindow: validOperationsWindow(),
    liveDataSourceBinding: validLiveDataSourceBinding(),
    alertLifecycle: validAlertLifecycle(),
    missingnessMonitoringPlan: validMissingnessMonitoringPlan(),
    wouldBeAlertCapturePlan: validWouldBeAlertCapturePlan(),
    overrideSimulationPlan: validOverrideSimulationPlan(),
    goNoGoCriteria: [validGoNoGoCriterion()],
    equityAndAccessibilityPlan: validEquityAndAccessibilityPlan(),
    localProfileRef: emptyRef(),
    adjudicationSystemBinding: validAdjudicationSystemBinding(),
    frozenAt: '2026-07-19T00:00:00Z',
    frozenBy: emptyRef(),
    supersededBy: null,
  };
}

test('POSITIVE: a fully-asserted v4SilentModeProtocol validates cleanly at protocol_frozen (exercises the bundled cross-file $refs end to end)', () => {
  const errors = validate(v4v5Schema_bundled, validV4SilentModeProtocol());
  assert.deepEqual(errors, []);
});

test('NEGATIVE: v4SilentModeProtocol protocol_frozen with goNoGoCriteria[0].thresholdDescription null must NOT validate', () => {
  const doc = validV4SilentModeProtocol();
  doc.goNoGoCriteria = [{ criterionId: 'no_hidden_dangerous_behavior', status: 'asserted', thresholdDescription: null, isIllustrative: false }];
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('NEGATIVE: v4SilentModeProtocol protocol_frozen with operationsWindow.startDate/endDate null must NOT validate', () => {
  const doc = validV4SilentModeProtocol();
  doc.operationsWindow.startDate = null;
  doc.operationsWindow.endDate = null;
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

// --- full-record V5 (v5HumanFactorsProtocol) fixtures ----------------------------------------------

function validStudyArtifactScope() {
  return { status: 'asserted', candidateArtifacts: ['TEST-SYNTHETIC-artifact'] };
}

function validParticipantsAndRecruitment() {
  return {
    status: 'asserted',
    recruitmentCriteria: 'TEST-SYNTHETIC-recruitment-criteria',
    targetParticipantCount: 12,
    participantRoles: ['TEST-SYNTHETIC-role'],
    consentProcess: 'TEST-SYNTHETIC-consent-process',
  };
}

function validV5HumanFactorsProtocol() {
  return {
    recordType: 'v5HumanFactorsProtocol',
    protocolId: 'TEST-SYNTHETIC-v5-protocol',
    protocolVersion: '1.0.0-test',
    candidateBinding: candidateBinding(),
    protocolStatus: 'protocol_frozen',
    studyType: 'summative_human_factors',
    studyArtifactScope: validStudyArtifactScope(),
    participantsAndRecruitment: validParticipantsAndRecruitment(),
    humanFactorsMeasures: [validHumanFactorsMeasure()],
    alertLifecycle: validAlertLifecycle(),
    equityAndAccessibilityPlan: validEquityAndAccessibilityPlan(),
    analysisPlan: validAnalysisPlan(),
    uncertaintyPlan: validUncertaintyPlan(),
    adjudicationSystemBinding: validAdjudicationSystemBinding(),
    frozenAt: '2026-07-19T00:00:00Z',
    frozenBy: emptyRef(),
    supersededBy: null,
  };
}

// NOTE: v5HumanFactorsProtocol also unconditionally requires `uncertaintyPlan` and `analysisPlan`
// (both reused via cross-file $ref from V3). Before fix cycle 1b this made a whole-document
// validate() call hit the exclusiveMinimum/exclusiveMaximum validator gap documented above; that gap
// is now fixed (see "=== Whole-document coverage (fix cycle 1b) ===" below for the whole-document
// proof). These two tests are kept as-is: they validate the exact schema fragments the guards live
// in -- `.properties.participantsAndRecruitment` and `.then.properties.humanFactorsMeasures` --
// directly, which remains valid, more targeted coverage of each individual guard in isolation.

test('NEGATIVE: v5HumanFactorsProtocol.properties.participantsAndRecruitment with participantRoles null while asserted must NOT validate', () => {
  const data = validParticipantsAndRecruitment();
  data.participantRoles = null;
  const errors = validate(v4v5Schema_bundled.$defs.v5HumanFactorsProtocol.properties.participantsAndRecruitment, data, { rootSchema: v4v5Schema_bundled });
  assert.ok(errors.length > 0, 'participantRoles null must fail even though participantsAndRecruitment.status is asserted');
});

test('POSITIVE: v5HumanFactorsProtocol.properties.participantsAndRecruitment fully asserted is valid', () => {
  const errors = validate(v4v5Schema_bundled.$defs.v5HumanFactorsProtocol.properties.participantsAndRecruitment, validParticipantsAndRecruitment(), { rootSchema: v4v5Schema_bundled });
  assert.deepEqual(errors, []);
});

test('NEGATIVE: v5HumanFactorsProtocol.then gate -- humanFactorsMeasures item left unasserted (status not_executed_owner_held) fails the freeze gate', () => {
  const errors = validate(v4v5Schema_bundled.$defs.v5HumanFactorsProtocol.then.properties.humanFactorsMeasures, [{
    measureId: 'time_on_task', status: 'not_executed_owner_held', metric: null, thresholdValue: null, thresholdUnit: null, isIllustrative: false,
  }], { rootSchema: v4v5Schema_bundled });
  assert.ok(errors.length > 0);
});

test('POSITIVE: v5HumanFactorsProtocol.then gate -- humanFactorsMeasures item asserted with real content passes', () => {
  const errors = validate(v4v5Schema_bundled.$defs.v5HumanFactorsProtocol.then.properties.humanFactorsMeasures, [validHumanFactorsMeasure()], { rootSchema: v4v5Schema_bundled });
  assert.deepEqual(errors, []);
});

// --- structural guards untouched by this remediation, spot-checked so a future edit cannot ------
// --- silently weaken them while "fixing" something else -----------------------------------------

test('v3DependencyChain.clinicalValidationComplete: true is still schema-invalid (const: false untouched)', () => {
  const errors = validate(v3Schema, {
    recordType: 'v3DependencyChain',
    chainId: 'TEST-SYNTHETIC-chain',
    candidateBinding: candidateBinding(),
    protocolRef: null,
    executionReceiptRef: null,
    resultRef: null,
    adjudicationRef: null,
    ownerDecisionRef: null,
    clinicalValidationComplete: true,
    blockedReleaseStates: ['clinical_validation_complete'],
  });
  assert.ok(errors.length > 0);
});

test('endpointDefinition.isIllustrative: true is still schema-invalid (const: false untouched, PEDS-DX-002 guard)', () => {
  const errors = validate(v3Schema.$defs.endpointDefinition, { ...validEndpoint(), isIllustrative: true }, { rootSchema: v3Schema });
  assert.ok(errors.length > 0);
});

test('goNoGoCriterion.isIllustrative: true is still schema-invalid (const: false untouched)', () => {
  const errors = validate(v4v5Schema_bundled.$defs.goNoGoCriterion, { ...validGoNoGoCriterion(), isIllustrative: true }, { rootSchema: v4v5Schema_bundled });
  assert.ok(errors.length > 0);
});

test('humanFactorsMeasureDefinition.isIllustrative: true is still schema-invalid (const: false untouched)', () => {
  const errors = validate(v4v5Schema_bundled.$defs.humanFactorsMeasureDefinition, { ...validHumanFactorsMeasure(), isIllustrative: true }, { rootSchema: v4v5Schema_bundled });
  assert.ok(errors.length > 0);
});

// === Whole-document coverage (fix cycle 1b) ======================================================
//
// scripts/lib/json-schema-lite.mjs now implements `exclusiveMinimum`/`exclusiveMaximum` (draft
// 2020-12 numeric form) and lists both in SUPPORTED_KEYWORDS, so a whole-document validate() call
// against v3ProtocolContract or v5HumanFactorsProtocol no longer throws on `confidenceLevel` --
// see the "FORMERLY A KNOWN LIMITATION" comment near the top of this file and
// tests/json-schema-lite.test.mjs for the validator's own unit coverage of the new keywords.
//
// The P4-V1 methods reviewer's core finding was that these schemas were unwired and unenforceable
// end-to-end; the fragment-only tests throughout this file proved each individual guard works in
// isolation, but never proved a real, complete document actually passes (or fails) `validate()` run
// against the whole schema the way a caller would really invoke it. These tests close that gap:
// every case below calls `validate(schema, doc)` with NO `path`/fragment narrowing, on a complete
// document carrying every required top-level key.

// --- v3ProtocolContract, honest not_executed_owner_held (the default; nothing asserted) ---------

function validV3ProtocolContractNotExecuted() {
  return {
    recordType: 'v3ProtocolContract',
    protocolId: 'TEST-SYNTHETIC-protocol',
    protocolVersion: '1.0.0-test',
    candidateBinding: candidateBinding(),
    protocolStatus: 'not_executed_owner_held',
    intendedUse: { status: 'not_executed_owner_held', population: null, ageOrDevelopmentalPartitions: null, setting: null, candidateScopeStatement: null, regulatoryClassification: null, scopeExits: null },
    datasetAndReferenceStandard: { status: 'not_executed_owner_held', datasetSource: null, dataPartner: null, sampleFrame: null, referenceStandardDefinition: null, referenceStandardBlinding: null, phiHandling: null, rightsReceiptRef: emptyRef() },
    endpoints: [{ endpointId: 'dangerous_miss_rate', status: 'not_executed_owner_held', metric: null, thresholdValue: null, goNoGoDirection: null, isIllustrative: false }],
    uncertaintyPlan: { status: 'not_executed_owner_held', intervalType: null, confidenceLevel: null, estimationMethod: null },
    subgroupPlan: { status: 'not_executed_owner_held', dimensions: null, strataDefinition: null, minimumCellSize: null, prespecified: null },
    analysisPlan: { status: 'not_executed_owner_held', primaryAnalysisMethod: null, missingDataHandling: null, interimAnalysis: null, blinding: null, statisticalAuthorityRef: emptyRef(), prespecifiedBeforeUnblinding: null },
    adjudicationSystemBinding: { status: 'not_executed_owner_held', systemRef: emptyRef(), adjudicatorRefs: null, independenceAttestation: null, discordanceResolutionMethod: null },
    frozenAt: null,
    frozenBy: emptyRef(),
    supersededBy: null,
  };
}

test('WHOLE-DOCUMENT POSITIVE: a complete, honest not_executed_owner_held v3ProtocolContract validates cleanly (nothing asserted, no owner-held content invented)', () => {
  const errors = validate(v3Schema, validV3ProtocolContractNotExecuted());
  assert.deepEqual(errors, []);
});

test('WHOLE-DOCUMENT POSITIVE: a fully-asserted v3ProtocolContract validates cleanly at protocol_frozen (exercises confidenceLevel exclusiveMinimum/exclusiveMaximum end to end)', () => {
  const errors = validate(v3Schema, validV3ProtocolContract());
  assert.deepEqual(errors, []);
});

test('WHOLE-DOCUMENT NEGATIVE (Finding 1 reproduction, run against the FULL document): protocol_frozen with a null-content endpoints[] entry is REJECTED', () => {
  // The reviewer's exact repro, this time validated against the whole schema rather than only
  // `v3ProtocolContract.then.properties.endpoints` -- proving the guard actually blocks a real
  // document, not just the isolated fragment it lives in.
  const doc = validV3ProtocolContract();
  doc.endpoints = [{ endpointId: 'dangerous_miss_rate', status: 'not_executed_owner_held', metric: null, thresholdValue: null, goNoGoDirection: null, isIllustrative: false }];
  const errors = validate(v3Schema, doc);
  assert.ok(errors.length > 0, 'a protocol_frozen document whose only endpoint is not_executed_owner_held must be rejected end-to-end');
});

test('WHOLE-DOCUMENT NEGATIVE: v3DependencyChain asserting clinical study completion (clinicalValidationComplete: true) is REJECTED', () => {
  // The reviewer's study-completion reproduction, run whole-document: no schema-valid v3DependencyChain
  // can ever claim clinicalValidationComplete: true (plan hard constraint 3 -- no evaluator exists).
  const errors = validate(v3Schema, {
    recordType: 'v3DependencyChain',
    chainId: 'TEST-SYNTHETIC-chain',
    candidateBinding: candidateBinding(),
    protocolRef: null,
    executionReceiptRef: null,
    resultRef: null,
    adjudicationRef: null,
    ownerDecisionRef: null,
    clinicalValidationComplete: true,
    blockedReleaseStates: ['clinical_validation_complete'],
  });
  assert.ok(errors.length > 0, 'clinicalValidationComplete: true must be rejected end-to-end, not only at the const-check fragment level');
});

// --- v5HumanFactorsProtocol, honest not_executed_owner_held (the default; nothing asserted) -----

function validV5HumanFactorsProtocolNotExecuted() {
  return {
    recordType: 'v5HumanFactorsProtocol',
    protocolId: 'TEST-SYNTHETIC-v5-protocol',
    protocolVersion: '1.0.0-test',
    candidateBinding: candidateBinding(),
    protocolStatus: 'not_executed_owner_held',
    studyType: 'summative_human_factors',
    studyArtifactScope: { status: 'not_executed_owner_held', candidateArtifacts: null },
    participantsAndRecruitment: { status: 'not_executed_owner_held', recruitmentCriteria: null, targetParticipantCount: null, participantRoles: null, consentProcess: null },
    humanFactorsMeasures: [{ measureId: 'time_on_task', status: 'not_executed_owner_held', metric: null, thresholdValue: null, thresholdUnit: null, isIllustrative: false }],
    alertLifecycle: { status: 'not_executed_owner_held', acknowledgmentAndEscalationSla: null, deferralPolicy: null, overrideRationalePolicy: null, duplicateSuppressionRule: null, downtimeReplayProcedure: null, downtimeProcedureOwnerRef: emptyRef(), crossShiftHandoffProcedure: null, urgentDominanceVerificationMethod: null, incidentLinkageProcedure: null },
    equityAndAccessibilityPlan: { status: 'not_executed_owner_held', dimensions: null, minimumRepresentation: null, prespecified: null, equityGovernanceProtocolRef: emptyRef() },
    analysisPlan: { status: 'not_executed_owner_held', primaryAnalysisMethod: null, missingDataHandling: null, interimAnalysis: null, blinding: null, statisticalAuthorityRef: emptyRef(), prespecifiedBeforeUnblinding: null },
    uncertaintyPlan: { status: 'not_executed_owner_held', intervalType: null, confidenceLevel: null, estimationMethod: null },
    adjudicationSystemBinding: { status: 'not_executed_owner_held', systemRef: emptyRef(), adjudicatorRefs: null, independenceAttestation: null, discordanceResolutionMethod: null },
    frozenAt: null,
    frozenBy: emptyRef(),
    supersededBy: null,
  };
}

test('WHOLE-DOCUMENT POSITIVE: a complete, honest not_executed_owner_held v5HumanFactorsProtocol validates cleanly (nothing asserted, no participant count/recruitment/threshold invented)', () => {
  const errors = validate(v4v5Schema_bundled, validV5HumanFactorsProtocolNotExecuted());
  assert.deepEqual(errors, []);
});

test('WHOLE-DOCUMENT POSITIVE: a fully-asserted v5HumanFactorsProtocol validates cleanly at protocol_frozen (exercises confidenceLevel exclusiveMinimum/exclusiveMaximum end to end, via the bundled cross-file $ref)', () => {
  const errors = validate(v4v5Schema_bundled, validV5HumanFactorsProtocol());
  assert.deepEqual(errors, []);
});

test('WHOLE-DOCUMENT NEGATIVE (Finding-1-pattern reproduction for V5, run against the FULL document): protocol_frozen with a null-content humanFactorsMeasures[] entry is REJECTED', () => {
  const doc = validV5HumanFactorsProtocol();
  doc.humanFactorsMeasures = [{ measureId: 'time_on_task', status: 'not_executed_owner_held', metric: null, thresholdValue: null, thresholdUnit: null, isIllustrative: false }];
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0, 'a protocol_frozen document whose only human-factors measure is not_executed_owner_held must be rejected end-to-end');
});

test('WHOLE-DOCUMENT NEGATIVE: v5DependencyChain asserting summative human-factors completion (summativeHumanFactorsComplete: true) is REJECTED', () => {
  // The reviewer's study-completion reproduction, run whole-document, for the V5 chain's own
  // completion guard (mirrors v3DependencyChain.clinicalValidationComplete above).
  const errors = validate(v4v5Schema_bundled, {
    recordType: 'v5DependencyChain',
    chainId: 'TEST-SYNTHETIC-chain',
    candidateBinding: candidateBinding(),
    protocolRef: null,
    executionReceiptRef: null,
    resultRef: null,
    adjudicationRef: null,
    ownerDecisionRef: null,
    summativeHumanFactorsComplete: true,
    blockedReleaseStates: ['clinical_validation_complete'],
  });
  assert.ok(errors.length > 0, 'summativeHumanFactorsComplete: true must be rejected end-to-end, not only at the const-check fragment level');
});

// === Fix cycle 2 (P4-V1 second FAIL) remediation ================================================
//
// The P4-V1 reviewer FAILed a second time. Two grounds:
//
//   (a) A real unfixed instance of the Finding-2 defect class (status: asserted coexisting with
//   null content) was found independently: `datasetAndReferenceStandard.phiHandling` -- the
//   fix-cycle-1 sweep that touched nine other locations, and the V4 sibling
//   `liveDataSourceBinding.dataBoundaryPosture`, missed this one.
//
//   (b) The fix-cycle-1 claim that "a systematic pass found no additional instances" was false and
//   should not have been asserted without an auditable, field-by-field sweep.
//
// This section closes five items from the fix-cycle-2 assignment: (1) phiHandling narrowing,
// (2) v3/v4/v5OwnerDecision.decidedAt narrowing, (3) v3/v4/v5 ExecutionReceipt/ResultRecord/
// AdjudicationRecord own-status narrowing, (4) supersededBy enforcement, (5) the missing V4
// not_executed_owner_held whole-document positive pair. Every NEGATIVE case here is run against the
// CURRENT (fixed) schema and is the executable form of "this must fail if the guard is reverted" --
// each guard was additionally hand-reverted and re-run once during this fix cycle to confirm the
// specific test fails without it (see the delivery report for the exact commands/output; not
// re-run automatically here because that would require mutating the checked-in schema file at test
// time, which is a worse risk than the one this remediation exists to close).

// --- Item 1: datasetAndReferenceStandard.phiHandling ---------------------------------------------

test('NEGATIVE (fix cycle 2, new finding): datasetAndReferenceStandard.phiHandling null while asserted must NOT validate', () => {
  const data = validDatasetAndReferenceStandard();
  data.phiHandling = null;
  const errors = validate(v3Schema.$defs.datasetAndReferenceStandard, data, { rootSchema: v3Schema });
  assert.ok(errors.length > 0, 'phiHandling: null must be rejected once datasetAndReferenceStandard.status is asserted');
});

test('WHOLE-DOCUMENT NEGATIVE (fix cycle 2 reproduction): protocol_frozen with datasetAndReferenceStandard.phiHandling null is REJECTED', () => {
  const doc = validV3ProtocolContract();
  doc.datasetAndReferenceStandard.phiHandling = null;
  const errors = validate(v3Schema, doc);
  assert.ok(errors.length > 0, 'a protocol_frozen document asserting a dataset section with phiHandling: null must be rejected end-to-end');
});

test('WHOLE-DOCUMENT POSITIVE (fix cycle 2): the honest not_executed_owner_held v3ProtocolContract fixture (phiHandling: null, status not asserted) still validates cleanly', () => {
  // Confirms the new `required` entry on phiHandling did not over-narrow the honest default: the
  // key must be PRESENT (it already was, in every existing fixture) but may still be null while
  // datasetAndReferenceStandard.status is not_executed_owner_held.
  const errors = validate(v3Schema, validV3ProtocolContractNotExecuted());
  assert.deepEqual(errors, []);
});

// --- Item 2: owner-decision timestamp (v3/v4/v5OwnerDecision.decidedAt) --------------------------

function validV3OwnerDecision(decision = 'go') {
  return {
    recordType: 'v3OwnerDecision',
    decisionId: 'TEST-SYNTHETIC-decision',
    adjudicationRef: { adjudicationId: 'TEST-SYNTHETIC-adjudication' },
    decision,
    decidedBy: namedRef('TEST-SYNTHETIC-decider'),
    decidedAt: '2026-07-19T00:00:00Z',
    conditions: [],
    signatureRef: { attachmentContract: 'p2-authenticated-attachment', signatureState: 'not_executed_owner_held', attachmentRef: null },
  };
}

test('NEGATIVE (fix cycle 2, new finding): v3OwnerDecision decision "go" with decidedAt null must NOT validate', () => {
  const doc = validV3OwnerDecision();
  doc.decidedAt = null;
  const errors = validate(v3Schema, doc);
  assert.ok(errors.length > 0, 'a go decision with no decidedAt timestamp must be rejected');
});

test('POSITIVE (fix cycle 2): a fully-populated v3OwnerDecision (decision go, decidedAt set) validates cleanly', () => {
  const errors = validate(v3Schema, validV3OwnerDecision());
  assert.deepEqual(errors, []);
});

test('POSITIVE (fix cycle 2): v3OwnerDecision decision not_executed_owner_held with decidedAt null still validates (the honest default is not over-narrowed)', () => {
  const doc = validV3OwnerDecision('not_executed_owner_held');
  doc.decidedAt = null;
  doc.decidedBy = emptyRef();
  const errors = validate(v3Schema, doc);
  assert.deepEqual(errors, []);
});

function validV4OwnerDecision(decision = 'go') {
  return { ...validV3OwnerDecision(decision), recordType: 'v4OwnerDecision' };
}
function validV5OwnerDecision(decision = 'go') {
  return { ...validV3OwnerDecision(decision), recordType: 'v5OwnerDecision' };
}

test('NEGATIVE (fix cycle 2, new finding): v4OwnerDecision decision "conditional_go" with decidedAt null must NOT validate', () => {
  const doc = validV4OwnerDecision('conditional_go');
  doc.decidedAt = null;
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): a fully-populated v4OwnerDecision validates cleanly', () => {
  const errors = validate(v4v5Schema_bundled, validV4OwnerDecision());
  assert.deepEqual(errors, []);
});

test('NEGATIVE (fix cycle 2, new finding): v5OwnerDecision decision "go" with decidedAt null must NOT validate', () => {
  const doc = validV5OwnerDecision();
  doc.decidedAt = null;
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): a fully-populated v5OwnerDecision validates cleanly', () => {
  const errors = validate(v4v5Schema_bundled, validV5OwnerDecision());
  assert.deepEqual(errors, []);
});

// --- Item 3: receipt/result/adjudication self-status narrowing -----------------------------------
//
// Deliberate choice (documented here and in both contract .md files): these records describe an
// off-repository event this repository cannot itself verify happened or was reported truthfully --
// narrowing cannot add authenticity, only internal coherence. The same is true of every AUTHORED-
// side owner-held field this whole remediation already narrows (nothing stops a false "asserted"
// claim either). Given that parallel, EXEMPTING the executed-side records would be the inconsistent
// choice, not the narrowing. Narrowing was chosen: it catches an internally incoherent record (a
// generation bug -- e.g. a receipt-writer that sets status executed but forgets executedAt) the
// same way the AUTHORED-side guards catch an incomplete assertion, without claiming to verify
// truthfulness it cannot verify. Reference-only fields (executedBy, adjudicationSystemRef,
// discordanceRecords) are deliberately left unnarrowed, consistent with every other
// `referenceLocator` usage in both schemas.

function validV3ExecutionReceipt(status = 'executed') {
  return {
    recordType: 'v3ExecutionReceipt',
    receiptId: 'TEST-SYNTHETIC-receipt',
    protocolRef: { protocolId: 'TEST-SYNTHETIC-protocol', protocolVersion: '1.0.0-test' },
    candidateBindingAtExecution: candidateBinding(),
    executionReceiptStatus: status,
    executedBy: emptyRef(),
    executedAt: '2026-07-19T00:00:00Z',
    environment: 'TEST-SYNTHETIC-environment',
    dataAccessAttestation: { noPatientDataEnteredRepository: true, noPatientDataEnteredArcOrAos: true },
  };
}

test('NEGATIVE (fix cycle 2, new finding): v3ExecutionReceipt executionReceiptStatus "executed" with executedAt null must NOT validate', () => {
  const doc = validV3ExecutionReceipt();
  doc.executedAt = null;
  const errors = validate(v3Schema, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): a fully-populated executed v3ExecutionReceipt validates cleanly', () => {
  const errors = validate(v3Schema, validV3ExecutionReceipt());
  assert.deepEqual(errors, []);
});

test('POSITIVE (fix cycle 2): v3ExecutionReceipt executionReceiptStatus "not_executed" with executedAt null still validates (default not over-narrowed)', () => {
  const doc = validV3ExecutionReceipt('not_executed');
  doc.executedAt = null;
  doc.executedBy = emptyRef();
  const errors = validate(v3Schema, doc);
  assert.deepEqual(errors, []);
});

function validV3ResultRecord(status = 'executed_unadjudicated') {
  return {
    recordType: 'v3ResultRecord',
    resultId: 'TEST-SYNTHETIC-result',
    executionReceiptRef: { receiptId: 'TEST-SYNTHETIC-receipt' },
    resultStatus: status,
    endpointResults: [{ endpointId: 'dangerous_miss_rate', pointEstimate: 0.001, interval: { low: 0.0005, high: 0.002 }, n: 500 }],
    subgroupResults: [],
    dangerousMissRateObserved: 0.001,
  };
}

test('NEGATIVE (fix cycle 2, new finding): v3ResultRecord resultStatus "executed_unadjudicated" with an empty endpointResults array must NOT validate', () => {
  const doc = validV3ResultRecord();
  doc.endpointResults = [];
  const errors = validate(v3Schema, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): a fully-populated executed_unadjudicated v3ResultRecord validates cleanly', () => {
  const errors = validate(v3Schema, validV3ResultRecord());
  assert.deepEqual(errors, []);
});

test('POSITIVE (fix cycle 2): v3ResultRecord resultStatus "not_executed" with an empty endpointResults array still validates (default not over-narrowed)', () => {
  const doc = validV3ResultRecord('not_executed');
  doc.endpointResults = [];
  const errors = validate(v3Schema, doc);
  assert.deepEqual(errors, []);
});

function validV3AdjudicationRecord(status = 'adjudicated') {
  return {
    recordType: 'v3AdjudicationRecord',
    adjudicationId: 'TEST-SYNTHETIC-adjudication',
    resultRef: { resultId: 'TEST-SYNTHETIC-result' },
    adjudicationStatus: status,
    adjudicationSystemRef: emptyRef(),
    discordanceRecords: [],
    adjudicationDecidedAt: '2026-07-19T00:00:00Z',
  };
}

test('NEGATIVE (fix cycle 2, new finding): v3AdjudicationRecord adjudicationStatus "adjudicated" with adjudicationDecidedAt null must NOT validate', () => {
  const doc = validV3AdjudicationRecord();
  doc.adjudicationDecidedAt = null;
  const errors = validate(v3Schema, doc);
  assert.ok(errors.length > 0);
});

test('NEGATIVE (fix cycle 2, new finding): v3AdjudicationRecord adjudicationStatus "discordant_unresolved" with adjudicationDecidedAt null must NOT validate', () => {
  const doc = validV3AdjudicationRecord('discordant_unresolved');
  doc.adjudicationDecidedAt = null;
  const errors = validate(v3Schema, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): a fully-populated adjudicated v3AdjudicationRecord validates cleanly', () => {
  const errors = validate(v3Schema, validV3AdjudicationRecord());
  assert.deepEqual(errors, []);
});

test('POSITIVE (fix cycle 2): v3AdjudicationRecord adjudicationStatus "not_executed_owner_held" with adjudicationDecidedAt null still validates (default not over-narrowed)', () => {
  const doc = validV3AdjudicationRecord('not_executed_owner_held');
  doc.adjudicationDecidedAt = null;
  const errors = validate(v3Schema, doc);
  assert.deepEqual(errors, []);
});

// V4 siblings (extra clinicianFacingDisplayAttestation on the receipt; eventClass-shaped results)

function validV4ExecutionReceipt(status = 'executed') {
  return {
    recordType: 'v4ExecutionReceipt',
    receiptId: 'TEST-SYNTHETIC-v4-receipt',
    protocolRef: { protocolId: 'TEST-SYNTHETIC-v4-protocol', protocolVersion: '1.0.0-test' },
    candidateBindingAtExecution: candidateBinding(),
    executionReceiptStatus: status,
    executedBy: emptyRef(),
    executedAt: '2026-07-19T00:00:00Z',
    environment: 'TEST-SYNTHETIC-environment',
    clinicianFacingDisplayAttestation: { noDisplayDuringSilentMode: true },
    dataBoundaryAttestation: { noPatientDataEnteredRepository: true, noPatientDataEnteredArcOrAos: true },
  };
}

test('NEGATIVE (fix cycle 2, new finding): v4ExecutionReceipt executionReceiptStatus "executed" with executedAt null must NOT validate', () => {
  const doc = validV4ExecutionReceipt();
  doc.executedAt = null;
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): a fully-populated executed v4ExecutionReceipt validates cleanly', () => {
  const errors = validate(v4v5Schema_bundled, validV4ExecutionReceipt());
  assert.deepEqual(errors, []);
});

function validV4ResultRecord(status = 'executed_unadjudicated') {
  return {
    recordType: 'v4ResultRecord',
    resultId: 'TEST-SYNTHETIC-v4-result',
    executionReceiptRef: { receiptId: 'TEST-SYNTHETIC-v4-receipt' },
    resultStatus: status,
    silentModeEventResults: [{ eventClass: 'would_be_alert_fired', count: 1, hiddenDangerousBehaviorObserved: false, n: 500 }],
    missingnessNeverClearedObserved: false,
    subgroupResults: [],
  };
}

test('NEGATIVE (fix cycle 2, new finding): v4ResultRecord resultStatus "executed_unadjudicated" with an empty silentModeEventResults array must NOT validate', () => {
  const doc = validV4ResultRecord();
  doc.silentModeEventResults = [];
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): a fully-populated executed_unadjudicated v4ResultRecord validates cleanly', () => {
  const errors = validate(v4v5Schema_bundled, validV4ResultRecord());
  assert.deepEqual(errors, []);
});

function validV4AdjudicationRecord(status = 'adjudicated') {
  return {
    recordType: 'v4AdjudicationRecord',
    adjudicationId: 'TEST-SYNTHETIC-v4-adjudication',
    resultRef: { resultId: 'TEST-SYNTHETIC-v4-result' },
    adjudicationStatus: status,
    adjudicationSystemRef: emptyRef(),
    discordanceRecords: [],
    adjudicationDecidedAt: '2026-07-19T00:00:00Z',
  };
}

test('NEGATIVE (fix cycle 2, new finding): v4AdjudicationRecord adjudicationStatus "adjudicated" with adjudicationDecidedAt null must NOT validate', () => {
  const doc = validV4AdjudicationRecord();
  doc.adjudicationDecidedAt = null;
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): a fully-populated adjudicated v4AdjudicationRecord validates cleanly', () => {
  const errors = validate(v4v5Schema_bundled, validV4AdjudicationRecord());
  assert.deepEqual(errors, []);
});

// V5 siblings (measureId-shaped results, no clinicianFacingDisplayAttestation)

function validV5ExecutionReceipt(status = 'executed') {
  return {
    recordType: 'v5ExecutionReceipt',
    receiptId: 'TEST-SYNTHETIC-v5-receipt',
    protocolRef: { protocolId: 'TEST-SYNTHETIC-v5-protocol', protocolVersion: '1.0.0-test' },
    candidateBindingAtExecution: candidateBinding(),
    executionReceiptStatus: status,
    executedBy: emptyRef(),
    executedAt: '2026-07-19T00:00:00Z',
    environment: 'TEST-SYNTHETIC-environment',
    dataBoundaryAttestation: { noPatientDataEnteredRepository: true, noPatientDataEnteredArcOrAos: true },
  };
}

test('NEGATIVE (fix cycle 2, new finding): v5ExecutionReceipt executionReceiptStatus "executed" with executedAt null must NOT validate', () => {
  const doc = validV5ExecutionReceipt();
  doc.executedAt = null;
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): a fully-populated executed v5ExecutionReceipt validates cleanly', () => {
  const errors = validate(v4v5Schema_bundled, validV5ExecutionReceipt());
  assert.deepEqual(errors, []);
});

function validV5ResultRecord(status = 'executed_unadjudicated') {
  return {
    recordType: 'v5ResultRecord',
    resultId: 'TEST-SYNTHETIC-v5-result',
    executionReceiptRef: { receiptId: 'TEST-SYNTHETIC-v5-receipt' },
    resultStatus: status,
    measureResults: [{ measureId: 'time_on_task', pointEstimate: 42, interval: { low: 38, high: 46 }, n: 12 }],
    subgroupResults: [],
  };
}

test('NEGATIVE (fix cycle 2, new finding): v5ResultRecord resultStatus "executed_unadjudicated" with an empty measureResults array must NOT validate', () => {
  const doc = validV5ResultRecord();
  doc.measureResults = [];
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): a fully-populated executed_unadjudicated v5ResultRecord validates cleanly', () => {
  const errors = validate(v4v5Schema_bundled, validV5ResultRecord());
  assert.deepEqual(errors, []);
});

function validV5AdjudicationRecord(status = 'adjudicated') {
  return {
    recordType: 'v5AdjudicationRecord',
    adjudicationId: 'TEST-SYNTHETIC-v5-adjudication',
    resultRef: { resultId: 'TEST-SYNTHETIC-v5-result' },
    adjudicationStatus: status,
    adjudicationSystemRef: emptyRef(),
    discordanceRecords: [],
    adjudicationDecidedAt: '2026-07-19T00:00:00Z',
  };
}

test('NEGATIVE (fix cycle 2, new finding): v5AdjudicationRecord adjudicationStatus "adjudicated" with adjudicationDecidedAt null must NOT validate', () => {
  const doc = validV5AdjudicationRecord();
  doc.adjudicationDecidedAt = null;
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): a fully-populated adjudicated v5AdjudicationRecord validates cleanly', () => {
  const errors = validate(v4v5Schema_bundled, validV5AdjudicationRecord());
  assert.deepEqual(errors, []);
});

// --- Item 4: supersededBy enforcement --------------------------------------------------------------

function validV3ProtocolContractSuperseded(supersededBy = 'TEST-SYNTHETIC-successor-protocol') {
  const doc = validV3ProtocolContractNotExecuted();
  doc.protocolStatus = 'superseded';
  doc.supersededBy = supersededBy;
  return doc;
}

test('NEGATIVE (fix cycle 2, new finding): v3ProtocolContract protocolStatus "superseded" with supersededBy null must NOT validate', () => {
  const doc = validV3ProtocolContractSuperseded(null);
  const errors = validate(v3Schema, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): v3ProtocolContract protocolStatus "superseded" with supersededBy populated validates cleanly', () => {
  const errors = validate(v3Schema, validV3ProtocolContractSuperseded());
  assert.deepEqual(errors, []);
});

function validV4SilentModeProtocolNotExecuted() {
  return {
    recordType: 'v4SilentModeProtocol',
    protocolId: 'TEST-SYNTHETIC-v4-protocol',
    protocolVersion: '1.0.0-test',
    candidateBinding: candidateBinding(),
    protocolStatus: 'not_executed_owner_held',
    operationsWindow: { status: 'not_executed_owner_held', dataPartnerOrSite: emptyRef(), startDate: null, endDate: null, durationDays: null, environment: null },
    liveDataSourceBinding: { status: 'not_executed_owner_held', dataPartner: null, ehrSystemRef: emptyRef(), dataBoundaryPosture: null },
    alertLifecycle: { status: 'not_executed_owner_held', acknowledgmentAndEscalationSla: null, deferralPolicy: null, overrideRationalePolicy: null, duplicateSuppressionRule: null, downtimeReplayProcedure: null, downtimeProcedureOwnerRef: emptyRef(), crossShiftHandoffProcedure: null, urgentDominanceVerificationMethod: null, incidentLinkageProcedure: null },
    missingnessMonitoringPlan: { status: 'not_executed_owner_held', monitoringMethod: null, missingnessNeverClearsVerificationMethod: null },
    wouldBeAlertCapturePlan: { status: 'not_executed_owner_held', captureMethod: null, hazardMatrixRef: emptyRef() },
    overrideSimulationPlan: { status: 'not_executed_owner_held', scenarios: null, method: null },
    goNoGoCriteria: [{ criterionId: 'no_hidden_dangerous_behavior', status: 'not_executed_owner_held', thresholdDescription: null, isIllustrative: false }],
    equityAndAccessibilityPlan: { status: 'not_executed_owner_held', dimensions: null, minimumRepresentation: null, prespecified: null, equityGovernanceProtocolRef: emptyRef() },
    localProfileRef: emptyRef(),
    adjudicationSystemBinding: { status: 'not_executed_owner_held', systemRef: emptyRef(), adjudicatorRefs: null, independenceAttestation: null, discordanceResolutionMethod: null },
    frozenAt: null,
    frozenBy: emptyRef(),
    supersededBy: null,
  };
}

// Item 5: V3 and V5 already had the honest not_executed_owner_held whole-document positive pair
// (see lines ~659-667 and ~721-724 above); V4 did not. Added here to close that parity gap.
test('WHOLE-DOCUMENT POSITIVE (fix cycle 2, item 5): a complete, honest not_executed_owner_held v4SilentModeProtocol validates cleanly (nothing asserted, no site/data-partner/threshold invented)', () => {
  const errors = validate(v4v5Schema_bundled, validV4SilentModeProtocolNotExecuted());
  assert.deepEqual(errors, []);
});

function validV4SilentModeProtocolSuperseded(supersededBy = 'TEST-SYNTHETIC-successor-v4-protocol') {
  const doc = validV4SilentModeProtocolNotExecuted();
  doc.protocolStatus = 'superseded';
  doc.supersededBy = supersededBy;
  return doc;
}

test('NEGATIVE (fix cycle 2, new finding): v4SilentModeProtocol protocolStatus "superseded" with supersededBy null must NOT validate', () => {
  const doc = validV4SilentModeProtocolSuperseded(null);
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): v4SilentModeProtocol protocolStatus "superseded" with supersededBy populated validates cleanly', () => {
  const errors = validate(v4v5Schema_bundled, validV4SilentModeProtocolSuperseded());
  assert.deepEqual(errors, []);
});

function validV5HumanFactorsProtocolSuperseded(supersededBy = 'TEST-SYNTHETIC-successor-v5-protocol') {
  const doc = validV5HumanFactorsProtocolNotExecuted();
  doc.protocolStatus = 'superseded';
  doc.supersededBy = supersededBy;
  return doc;
}

test('NEGATIVE (fix cycle 2, new finding): v5HumanFactorsProtocol protocolStatus "superseded" with supersededBy null must NOT validate', () => {
  const doc = validV5HumanFactorsProtocolSuperseded(null);
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 2): v5HumanFactorsProtocol protocolStatus "superseded" with supersededBy populated validates cleanly', () => {
  const errors = validate(v4v5Schema_bundled, validV5HumanFactorsProtocolSuperseded());
  assert.deepEqual(errors, []);
});

// === Fix cycle 3 (P4-V1 R3 remediation, gate REOPENED) ===========================================
//
// The diagnostic-accuracy-methods reviewer reopened the gate on a single HIGH finding: the P3
// defect verbatim (a self-declared signature/authentication state read as proof, with no schema
// narrowing behind the claim of unreachability) had been reintroduced in v3OwnerDecision.signatureRef
// (reused by v4/v5OwnerDecision via cross-file $ref). A fabricated `signatureState: "bound"` plus an
// invented, never-verified `attachmentRef` validated cleanly, despite `signatureRef` guarding the
// ONLY field in this schema that directly authorizes clinical_validation_complete. Fixed by mirroring
// schemas/terminology-profile.schema.json's attestation if/then/else pattern (see signatureRef's own
// updated description for the exact narrowing and its limits).
//
// The reviewer additionally ordered a full re-sweep of every `description` in both clinical schemas
// for the same defect class ("a description claims a constraint the schema does not enforce"). That
// sweep found three further unenforced/unrepresentable claims, fixed below:
//   (1) v3ResultRecord.endpointResults[].interval and v5ResultRecord.measureResults[].interval both
//       claimed "required alongside every pointEstimate" with no if/then behind the claim -- a
//       non-null pointEstimate could coexist with interval: null.
//   (2) v3/v4/v5DependencyChain.blockedReleaseStates claimed "must always include
//       clinical_validation_complete" with only `minItems: 1` and an unconstrained enum behind it --
//       an array containing only e.g. ["activated"] validated cleanly. Fixed with `contains`.
//   (3) Three description-only overclaims were corrected rather than newly enforced, specifically to
//       avoid inventing new owner-held schema surface (a new date/signature/timestamp field) or
//       over-narrowing a field whose current looseness is legitimate (v3ProtocolContract.frozenAt
//       retaining a real timestamp through protocol_deviation/superseded/expired transitions):
//       subgroupPlan.prespecified's "and dated" clause, analysisPlan.prespecifiedBeforeUnblinding's
//       "signed, and timestamped" clause, and v3ProtocolContract.frozenAt's "only" (biconditional)
//       framing. These have no executable test below -- there is nothing to assert against a
//       description string; the schema behavior around them is otherwise unchanged and already
//       covered by fix-cycle-1/2 tests above (e.g. the freeze-gate tests still exercise frozenAt).

// --- R3 core finding: v3OwnerDecision.signatureRef bound/not-bound, both directions --------------

function validV3OwnerDecisionBound(attachmentRef = 'TEST-SYNTHETIC-attachment-001') {
  const doc = validV3OwnerDecision();
  doc.signatureRef = { attachmentContract: 'p2-authenticated-attachment', signatureState: 'bound', attachmentRef };
  return doc;
}

test('NEGATIVE (fix cycle 3, R3 -- the P3 defect verbatim, reproduced): v3OwnerDecision signatureState "bound" with attachmentRef null must NOT validate', () => {
  const doc = validV3OwnerDecisionBound(null);
  const errors = validate(v3Schema, doc);
  assert.ok(errors.length > 0, 'a self-declared bound signature with no attachment ref must be rejected -- this is the exact fabricated-authority shape the finding described');
});

test('NEGATIVE (fix cycle 3, R3): v3OwnerDecision signatureState "not_executed_owner_held" with a non-null attachmentRef must NOT validate', () => {
  const doc = validV3OwnerDecision();
  doc.signatureRef = { attachmentContract: 'p2-authenticated-attachment', signatureState: 'not_executed_owner_held', attachmentRef: 'TEST-SYNTHETIC-attachment-should-not-be-here' };
  const errors = validate(v3Schema, doc);
  assert.ok(errors.length > 0, 'an attachmentRef must not survive alongside the honest not_executed_owner_held default');
});

test('POSITIVE (fix cycle 3, R3): v3OwnerDecision signatureState "bound" WITH a populated attachmentRef validates cleanly (bound is exercised positively too, not just rejected)', () => {
  const errors = validate(v3Schema, validV3OwnerDecisionBound());
  assert.deepEqual(errors, []);
});

test('POSITIVE (fix cycle 3, R3): v3OwnerDecision signatureState "not_executed_owner_held" with attachmentRef null (the honest default) still validates cleanly -- not over-narrowed', () => {
  const errors = validate(v3Schema, validV3OwnerDecision());
  assert.deepEqual(errors, []);
});

// --- R3 propagation: v4/v5OwnerDecision.signatureRef reuse v3's def via cross-file $ref -----------
// (bundleV4V5Schema does a structuredClone of the whole v3OwnerDecision.properties.signatureRef
// node, so the if/then/else fixed above must already be present without any change to this file.)

test('NEGATIVE (fix cycle 3, R3 propagation): v4OwnerDecision signatureState "bound" with attachmentRef null must NOT validate', () => {
  const doc = validV4OwnerDecision();
  doc.signatureRef = { attachmentContract: 'p2-authenticated-attachment', signatureState: 'bound', attachmentRef: null };
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 3, R3 propagation): v4OwnerDecision signatureState "bound" with a populated attachmentRef validates cleanly', () => {
  const doc = validV4OwnerDecision();
  doc.signatureRef = { attachmentContract: 'p2-authenticated-attachment', signatureState: 'bound', attachmentRef: 'TEST-SYNTHETIC-attachment-001' };
  const errors = validate(v4v5Schema_bundled, doc);
  assert.deepEqual(errors, []);
});

test('NEGATIVE (fix cycle 3, R3 propagation): v5OwnerDecision signatureState "bound" with attachmentRef null must NOT validate', () => {
  const doc = validV5OwnerDecision();
  doc.signatureRef = { attachmentContract: 'p2-authenticated-attachment', signatureState: 'bound', attachmentRef: null };
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 3, R3 propagation): v5OwnerDecision signatureState "bound" with a populated attachmentRef validates cleanly', () => {
  const doc = validV5OwnerDecision();
  doc.signatureRef = { attachmentContract: 'p2-authenticated-attachment', signatureState: 'bound', attachmentRef: 'TEST-SYNTHETIC-attachment-001' };
  const errors = validate(v4v5Schema_bundled, doc);
  assert.deepEqual(errors, []);
});

// --- Sweep finding 1: interval required alongside a non-null pointEstimate -----------------------

test('NEGATIVE (fix cycle 3, sweep finding): v3ResultRecord endpointResults[] entry with a non-null pointEstimate and interval null must NOT validate', () => {
  const doc = validV3ResultRecord();
  doc.endpointResults = [{ endpointId: 'dangerous_miss_rate', pointEstimate: 0.001, interval: null, n: 500 }];
  const errors = validate(v3Schema, doc);
  assert.ok(errors.length > 0, 'a reported point estimate with no interval must be rejected');
});

test('POSITIVE (fix cycle 3): a v3ResultRecord endpointResults[] entry with both pointEstimate and interval populated validates cleanly (already exercised by validV3ResultRecord above; asserted explicitly here)', () => {
  const errors = validate(v3Schema, validV3ResultRecord());
  assert.deepEqual(errors, []);
});

test('POSITIVE (fix cycle 3): a v3ResultRecord endpointResults[] entry with pointEstimate null and interval null still validates (an unresolved per-endpoint result is not over-narrowed)', () => {
  const doc = validV3ResultRecord();
  doc.endpointResults = [{ endpointId: 'dangerous_miss_rate', pointEstimate: null, interval: null, n: null }];
  const errors = validate(v3Schema, doc);
  assert.deepEqual(errors, []);
});

test('NEGATIVE (fix cycle 3, sweep finding): v5ResultRecord measureResults[] entry with a non-null pointEstimate and interval null must NOT validate', () => {
  const doc = validV5ResultRecord();
  doc.measureResults = [{ measureId: 'time_on_task', pointEstimate: 42, interval: null, n: 12 }];
  const errors = validate(v4v5Schema_bundled, doc);
  assert.ok(errors.length > 0);
});

test('POSITIVE (fix cycle 3): a v5ResultRecord measureResults[] entry with pointEstimate null and interval null still validates (not over-narrowed)', () => {
  const doc = validV5ResultRecord();
  doc.measureResults = [{ measureId: 'time_on_task', pointEstimate: null, interval: null, n: null }];
  const errors = validate(v4v5Schema_bundled, doc);
  assert.deepEqual(errors, []);
});

// --- Sweep finding 2: blockedReleaseStates must actually contain clinical_validation_complete -----

function dependencyChainDoc(recordType, completionField) {
  return {
    recordType,
    chainId: 'TEST-SYNTHETIC-chain',
    candidateBinding: candidateBinding(),
    protocolRef: null,
    executionReceiptRef: null,
    resultRef: null,
    adjudicationRef: null,
    ownerDecisionRef: null,
    [completionField]: false,
    blockedReleaseStates: ['activated'],
  };
}

test('NEGATIVE (fix cycle 3, sweep finding): v3DependencyChain.blockedReleaseStates missing clinical_validation_complete must NOT validate', () => {
  const errors = validate(v3Schema, dependencyChainDoc('v3DependencyChain', 'clinicalValidationComplete'));
  assert.ok(errors.length > 0, 'blockedReleaseStates without clinical_validation_complete must be rejected -- the description claims it is always present');
});

test('POSITIVE (fix cycle 3): v3DependencyChain.blockedReleaseStates containing clinical_validation_complete alongside other states validates cleanly', () => {
  const doc = dependencyChainDoc('v3DependencyChain', 'clinicalValidationComplete');
  doc.blockedReleaseStates = ['clinical_validation_complete', 'activated'];
  const errors = validate(v3Schema, doc);
  assert.deepEqual(errors, []);
});

test('NEGATIVE (fix cycle 3, sweep finding): v4DependencyChain.blockedReleaseStates missing clinical_validation_complete must NOT validate', () => {
  const errors = validate(v4v5Schema_bundled, dependencyChainDoc('v4DependencyChain', 'silentModeValidationComplete'));
  assert.ok(errors.length > 0);
});

test('NEGATIVE (fix cycle 3, sweep finding): v5DependencyChain.blockedReleaseStates missing clinical_validation_complete must NOT validate', () => {
  const errors = validate(v4v5Schema_bundled, dependencyChainDoc('v5DependencyChain', 'summativeHumanFactorsComplete'));
  assert.ok(errors.length > 0);
});
