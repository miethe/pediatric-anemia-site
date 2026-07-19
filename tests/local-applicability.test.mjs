// Local laboratory and terminology applicability — fail-closed behaviour.
//
// AC P3.1 (arc-clinical-council-adoption-v1): local applicability cannot be inferred. These tests
// exist to prove the negative: that missing, conflicting, expired, superseded, unmapped,
// preliminary, stale, corrected, amended, and unknown states each fail closed AND stay visible.
//
// Test method note: negative cases are driven from tests/fixtures/local-profile/negative-cases.json
// as mutations of the SYNTHETIC base fixtures rather than as full duplicate documents. The
// mutation is the thing under test, and single-sourcing the base means a schema change cannot
// leave a stale near-copy quietly passing. Each case asserts three things — the decision is
// `fail_closed`, the specific expected blocker code is present, and the blockers are visible and
// individually reportable — because "it failed" is not sufficient for a clinical gate; the reason
// must reach a human.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BLOCKER,
  SEVERITY,
  severityOf,
  evaluateActivationGate,
  evaluateReferenceIntervalApplicability,
  evaluateTerminologyApplicability,
  validateReferenceIntervalProfile,
  validateTerminologyProfile,
} from '../scripts/lib/local-applicability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'tests', 'fixtures', 'local-profile');

// A fixed evaluation instant. Staleness and expiry tests are meaningless against a moving clock:
// a test that passes today and fails in a year is not a gate, it is a time bomb.
const NOW = new Date('2026-07-19T00:00:00Z');

async function readFixture(name) {
  return JSON.parse(await readFile(path.join(fixtureDir, name), 'utf8'));
}

const referenceProfile = await readFixture('SYNTHETIC-reference-interval-profile.json');
const terminologyProfile = await readFixture('SYNTHETIC-terminology-profile.json');
const negativeCases = await readFixture('negative-cases.json');

// --- mutation helpers --------------------------------------------------------

function parsePath(pathExpression) {
  const segments = [];
  for (const part of pathExpression.split('.')) {
    const match = /^([^[\]]+)((?:\[\d+\])*)$/.exec(part);
    assert.ok(match, `unparsable fixture path segment "${part}"`);
    segments.push(match[1]);
    for (const index of match[2].matchAll(/\[(\d+)\]/g)) segments.push(Number(index[1]));
  }
  return segments;
}

function applyMutations(document, mutations = []) {
  const next = structuredClone(document);
  for (const mutation of mutations) {
    const segments = parsePath(mutation.path);
    const leaf = segments.pop();
    let target = next;
    for (const segment of segments) {
      target = target[segment];
      assert.ok(target !== undefined, `fixture path "${mutation.path}" does not resolve`);
    }
    if (mutation.op === 'push') {
      assert.ok(Array.isArray(target[leaf]), `push target "${mutation.path}" is not an array`);
      target[leaf].push(structuredClone(mutation.value));
    } else if (mutation.op === 'unset') {
      delete target[leaf];
    } else {
      target[leaf] = structuredClone(mutation.value);
    }
  }
  return next;
}

function assertFailClosed(result, expectedBlockers, caseId) {
  assert.equal(result.decision, 'fail_closed', `${caseId}: must fail closed`);
  assert.equal(result.applicable, false, `${caseId}: must not be applicable`);
  assert.ok(result.blockers.length > 0, `${caseId}: must report at least one blocker`);

  // Visibility: a fail-closed decision that cannot explain itself is indistinguishable from a
  // crash, and a clinician cannot act on it. Every blocker must name a code, a field, and a
  // human-readable reason.
  assert.equal(result.visible, true, `${caseId}: blockers must be visible`);
  for (const blocker of result.blockers) {
    assert.ok(blocker.code, `${caseId}: blocker missing code`);
    assert.ok(blocker.field, `${caseId}: blocker ${blocker.code} missing field locator`);
    assert.ok(blocker.message?.length > 0, `${caseId}: blocker ${blocker.code} missing message`);
    // Severity is part of the refusal, not decoration: a flat unordered list made PROFILE_STALE
    // and CORRECTION_UNRESOLVED read as peers.
    assert.ok(
      Object.values(SEVERITY).includes(blocker.severity),
      `${caseId}: blocker ${blocker.code} carries no valid severity`,
    );
  }

  // Ordering: most dangerous first, so a caller rendering only the head of the list still shows
  // the blocker that matters most.
  const rank = { critical: 0, high: 1, moderate: 2 };
  for (let i = 1; i < result.blockers.length; i += 1) {
    assert.ok(
      rank[result.blockers[i - 1].severity] <= rank[result.blockers[i].severity],
      `${caseId}: blockers must be ordered by descending severity`,
    );
  }
  assert.equal(result.highestSeverity, result.blockers[0].severity, `${caseId}: highestSeverity must match the head of the list`);

  const codes = result.blockers.map((blocker) => blocker.code);
  for (const expected of expectedBlockers) {
    assert.ok(
      codes.includes(expected),
      `${caseId}: expected blocker ${expected}, got [${codes.join(', ')}]`,
    );
  }
}

// --- structural validity of the shipped fixtures -----------------------------

test('both SYNTHETIC base fixtures are structurally valid against their schemas', async () => {
  const referenceResult = await validateReferenceIntervalProfile(referenceProfile);
  assert.deepEqual(referenceResult.errors, [], 'reference profile fixture must satisfy its schema');

  const terminologyResult = await validateTerminologyProfile(terminologyProfile);
  assert.deepEqual(terminologyResult.errors, [], 'terminology profile fixture must satisfy its schema');

  // The single most dangerous inference available from a green structural check.
  assert.match(referenceResult.note, /does not imply clinical validity/);
  assert.match(terminologyResult.note, /does not imply clinical validity/);
});

// --- positive path: dimensions match -----------------------------------------

test('positive: a fully asserted profile whose dimensions all match yields an applicable decision', () => {
  const result = evaluateReferenceIntervalApplicability(
    referenceProfile,
    negativeCases.referenceBaseRequest,
    { now: NOW },
  );
  assert.deepEqual(result.blockers, [], 'the positive baseline must have no blockers');
  assert.equal(result.decision, 'applicable');
});

test('positive: a final, mapped, in-date observation is interpretable under the terminology profile', () => {
  const result = evaluateTerminologyApplicability(
    terminologyProfile,
    negativeCases.terminologyBaseObservation,
    { now: NOW },
  );
  assert.deepEqual(result.blockers, [], 'the positive baseline must have no blockers');
  assert.equal(result.decision, 'applicable');
});

// The positive baselines above establish that these tests can distinguish pass from fail. Without
// them, every negative case below would also pass against a validator that rejected everything.

// --- negative case per failure mode ------------------------------------------

for (const testCase of negativeCases.cases) {
  const baseProfile = testCase.target === 'reference' ? referenceProfile : terminologyProfile;

  if (testCase.layer === 'structural') {
    test(`${testCase.id} — ${testCase.failureMode} is rejected structurally`, async () => {
      const mutated = applyMutations(baseProfile, testCase.profileMutations);
      const result =
        testCase.target === 'reference'
          ? await validateReferenceIntervalProfile(mutated)
          : await validateTerminologyProfile(mutated);
      assert.equal(result.ok, false, `${testCase.id}: mutation must be structurally invalid`);
      assert.ok(result.errors.length > 0, `${testCase.id}: schema errors must be reported, not swallowed`);
      for (const error of result.errors) {
        assert.ok(error.path, `${testCase.id}: schema error missing path locator`);
        assert.ok(error.message, `${testCase.id}: schema error missing message`);
      }
    });
    continue;
  }

  test(`${testCase.id} — ${testCase.failureMode} fails closed and stays visible`, () => {
    const profile = applyMutations(baseProfile, testCase.profileMutations);
    // A case may pin its own evaluation instant to exercise clock handling itself.
    const now = testCase.evaluationTime ?? NOW;

    const result =
      testCase.target === 'reference'
        ? evaluateReferenceIntervalApplicability(
            profile,
            applyMutations(negativeCases.referenceBaseRequest, testCase.requestMutations),
            { now },
          )
        : evaluateTerminologyApplicability(
            profile,
            applyMutations(negativeCases.terminologyBaseObservation, testCase.observationMutations),
            { now },
          );

    assertFailClosed(result, testCase.expectedBlockers, testCase.id);
  });
}

test('every required P3 failure mode is covered by at least one negative case', () => {
  // A coverage tripwire. Deleting a negative case must break this test rather than silently
  // shrinking the safety net.
  const requiredModes = [
    'missing interval',
    'conflicting intervals',
    'expired profile',
    'superseded without successor',
    'unmapped local code',
    'preliminary result treated as final',
    'stale profile',
    'corrected state dropped',
    'amended state dropped',
    'unit mismatch',
    'analyzer mismatch',
    'method mismatch',
    'population mismatch',
    'age-band mismatch',
    'unknown-value coercion',
    // Added after the P3-V1 clinical-informatics review. Each corresponds to a confirmed defect
    // that the previous suite could not have detected.
    'interval with no bounds',
    'interval with inverted bounds',
    'conflicting local mappings',
    'unbounded age band',
    'age bands leave a gap',
    'age bands overlap',
    'age band exceeds',
    'age band straddles',
    'missing critical value',
    'conflicting critical values',
    'critical value in a different unit',
    'corrected age required but not supplied',
    'gestational age outside',
    'retracted result',
    'cancelled result',
    'not-yet-resulted observation',
    'revision that is itself superseded',
    'superseding observation reference points at the observation itself',
    'current status absent from the lineage',
    'status lineage is not ordered',
    'status value set applied without a resource type',
    'absent profile section crashes instead of failing closed',
  ];
  const declared = negativeCases.cases.map((testCase) => testCase.failureMode).join(' | ');
  for (const mode of requiredModes) {
    assert.ok(declared.includes(mode), `no negative case declares the failure mode "${mode}"`);
  }
});

// --- the activation gate refuses ---------------------------------------------

test('the activation gate refuses even when every applicability dimension matches', () => {
  const applicability = evaluateReferenceIntervalApplicability(
    referenceProfile,
    negativeCases.referenceBaseRequest,
    { now: NOW },
  );
  assert.equal(applicability.applicable, true, 'precondition: dimensions match');

  const gate = evaluateActivationGate(referenceProfile, applicability);
  assert.equal(gate.decision, 'fail_closed', 'a matching profile must still not be activatable');

  const codes = gate.blockers.map((blocker) => blocker.code);
  // Three INDEPENDENT refusals. Any one of them alone would be a single point of failure.
  assert.ok(codes.includes(BLOCKER.SYNTHETIC_PROFILE_CANNOT_ACTIVATE), 'refused on profile class');
  assert.ok(codes.includes(BLOCKER.AUTHORITY_NOT_EXECUTED_OWNER_HELD), 'refused on absent named authority');
  assert.ok(codes.includes(BLOCKER.SIGNATURE_NOT_EXECUTED_OWNER_HELD), 'refused on absent signature');
});

test('an unsigned profile fails the activation gate today, before the P2 attachment contract exists', () => {
  // The signature envelope itself is out of scope here (it is P2's authenticated-attachment
  // primitive). What must hold NOW is that its absence is refused rather than ignored.
  assert.equal(referenceProfile.attestation.attachmentContract, 'p2-authenticated-attachment');
  assert.equal(referenceProfile.attestation.signatureState, 'not_executed_owner_held');
  assert.equal(referenceProfile.attestation.attachmentRef, null);

  const gate = evaluateActivationGate(referenceProfile, { applicable: true });
  const codes = gate.blockers.map((blocker) => blocker.code);
  assert.equal(gate.decision, 'fail_closed');
  assert.ok(codes.includes(BLOCKER.SIGNATURE_NOT_EXECUTED_OWNER_HELD));
});

test('P3-V1 F1 regression: no sequence of self-declared field edits can satisfy the activation gate', () => {
  // The exact four edits the review used to promote the shipped synthetic fixture to
  // `{decision: "applicable", blockers: []}`: reclassify, drop the synthetic marker, self-declare
  // authority with every identity field still null, and self-declare a bound signature with a
  // null attachment reference.
  const promoted = structuredClone(referenceProfile);
  promoted.profileClass = 'site_asserted';
  delete promoted.syntheticDeclaration;
  promoted.authority.assertion = 'asserted';
  promoted.attestation.signatureState = 'bound';

  const applicability = evaluateReferenceIntervalApplicability(promoted, negativeCases.referenceBaseRequest, { now: NOW });
  const gate = evaluateActivationGate(promoted, applicability);
  const codes = gate.blockers.map((blocker) => blocker.code);

  assert.equal(gate.decision, 'fail_closed', 'four self-declared field edits must not produce an activatable profile');
  assert.ok(codes.includes(BLOCKER.AUTHORITY_INCOMPLETE), 'an assertion with no named accountable individual is not an assertion');
  assert.ok(
    codes.includes(BLOCKER.SIGNATURE_SELF_DECLARED_NOT_VERIFIED),
    'a self-declared signatureState string must be named as unverified, not accepted as a signature',
  );
  assert.ok(codes.includes(BLOCKER.SIGNATURE_NOT_EXECUTED_OWNER_HELD), 'the signature remains not executed regardless of what the document claims');
});

test('P3-V1 F1 regression: `bound` is unreachable on this side because no attachment verifier exists', () => {
  // The charter's §4 claim ("unsigned profiles fail closed today") was true of the fixtures that
  // happened to be checked in and false of the mechanism. It must be true of the mechanism.
  const signed = structuredClone(referenceProfile);
  signed.profileClass = 'site_asserted';
  delete signed.syntheticDeclaration;
  signed.attestation.signatureState = 'bound';
  signed.attestation.attachmentRef = 'urn:synthetic:attachment-0001';
  signed.authority = {
    institutionName: 'SYNTHETIC-INSTITUTION-PLACEHOLDER',
    laboratoryDirectorName: 'SYNTHETIC-DIRECTOR-PLACEHOLDER',
    laboratoryDirectorCredential: 'SYNTHETIC-CREDENTIAL-PLACEHOLDER',
    designeeName: null,
    assertionStatement: 'SYNTHETIC placeholder assertion statement.',
    assertedOn: '2026-01-01',
    assertion: 'asserted',
  };

  // Even a structurally complete, fully self-declared, "signed" profile is refused: nothing in
  // this repository can resolve or verify an authenticated attachment.
  const gate = evaluateActivationGate(signed, { applicable: true, decision: 'applicable', blockers: [] });
  assert.equal(gate.decision, 'fail_closed');
  assert.ok(gate.blockers.map((blocker) => blocker.code).includes(BLOCKER.SIGNATURE_NOT_EXECUTED_OWNER_HELD));
});

test('P3-V1 C1 regression: a multi-analyte panel with per-analyte units is expressible', () => {
  // A complete blood count reports hemoglobin in g/dL, hematocrit in %, MCV in fL, RBC in
  // 10*12/L, platelets in 10*9/L and reticulocytes in %. With a single profile-level unit code,
  // any real profile covered exactly one analyte or self-blocked with UNIT_MISMATCH on every
  // other one. The fixture carries two analytes with different units for exactly this reason.
  const second = structuredClone(negativeCases.referenceBaseRequest);
  second.analyteCode = { code: 'SYN-0002' };
  second.unitCode = 'SYN-UNIT-B';

  const result = evaluateReferenceIntervalApplicability(referenceProfile, second, { now: NOW });
  assert.deepEqual(result.blockers, [], 'a second analyte in its own unit must not self-block');
  assert.equal(result.decision, 'applicable');

  // ...and the units are still not interchangeable across analytes.
  const crossed = structuredClone(second);
  crossed.unitCode = 'SYN-UNIT-A';
  const mismatch = evaluateReferenceIntervalApplicability(referenceProfile, crossed, { now: NOW });
  assert.ok(mismatch.blockers.map((blocker) => blocker.code).includes(BLOCKER.UNIT_MISMATCH));
});

test('P3-V1 F9 regression: an unparseable evaluation time cannot disable expiry, effective window, or staleness', () => {
  // `nowMs = NaN` made every time comparison false, silently switching off three checks at once.
  const expired = structuredClone(referenceProfile);
  expired.lifecycle.effectiveEnd = '2026-03-01';

  const result = evaluateReferenceIntervalApplicability(expired, negativeCases.referenceBaseRequest, { now: 'not-a-date' });
  assert.equal(result.decision, 'fail_closed');
  assert.ok(
    result.blockers.map((blocker) => blocker.code).includes(BLOCKER.EVALUATION_TIME_INVALID),
    'the unparseable instant itself must be reported, not merely absorbed',
  );
});

test('P3-V1 F9 regression: absent profile sections fail closed instead of throwing', () => {
  // A TypeError is not a decision. A caller that catches it sees no blockers and may read that
  // as no objections.
  for (const section of ['lifecycle', 'applicability', 'ageBandPolicy']) {
    const damaged = structuredClone(referenceProfile);
    delete damaged[section];
    const result = evaluateReferenceIntervalApplicability(damaged, negativeCases.referenceBaseRequest, { now: NOW });
    assert.equal(result.decision, 'fail_closed', `absent ${section} must fail closed`);
    assert.ok(result.blockers.map((blocker) => blocker.code).includes(BLOCKER.PROFILE_SECTION_MISSING));
  }
  for (const section of ['lifecycle', 'resultStatusPolicy', 'observationRequirements']) {
    const damaged = structuredClone(terminologyProfile);
    delete damaged[section];
    const result = evaluateTerminologyApplicability(damaged, negativeCases.terminologyBaseObservation, { now: NOW });
    assert.equal(result.decision, 'fail_closed', `absent ${section} must fail closed`);
    assert.ok(result.blockers.map((blocker) => blocker.code).includes(BLOCKER.PROFILE_SECTION_MISSING));
  }
});

test('every blocker code carries a declared severity, and the dangerous one outranks the merely overdue', () => {
  // A code with no declared severity would fall back to `critical`, which is safe but silent.
  // This test makes the omission visible instead.
  for (const code of Object.values(BLOCKER)) {
    assert.ok(Object.values(SEVERITY).includes(severityOf(code)), `${code} has no valid severity`);
  }
  // The specific pair the review named: these must not read as peers.
  assert.equal(severityOf(BLOCKER.CORRECTION_UNRESOLVED), SEVERITY.CRITICAL);
  assert.equal(severityOf(BLOCKER.PROFILE_STALE), SEVERITY.HIGH);
  // And the five situations the old RESULT_STATUS_BLOCKED conflated are now separable.
  const split = [
    BLOCKER.RESULT_STATUS_BLOCKING_STATE,
    BLOCKER.RESULT_STATUS_NOT_ACCEPTED_FOR_DECISION,
    BLOCKER.RESULT_RETRACTED_ENTERED_IN_ERROR,
    BLOCKER.RESULT_CANCELLED_NEVER_PERFORMED,
    BLOCKER.RESULT_NOT_YET_AVAILABLE,
  ];
  assert.equal(new Set(split).size, 5, 'the five refusal reasons must be distinct codes');
  assert.equal(BLOCKER.RESULT_STATUS_BLOCKED, undefined, 'the overloaded code must be gone, not merely supplemented');
});

test('the activation gate refuses when applicability was never established', () => {
  // Guards against the caller-side failure mode: passing a missing or malformed applicability
  // decision must not read as "no objections".
  for (const absent of [undefined, null, {}, { applicable: false }, { decision: 'applicable' }]) {
    const gate = evaluateActivationGate(referenceProfile, absent);
    const codes = gate.blockers.map((blocker) => blocker.code);
    assert.ok(
      codes.includes(BLOCKER.APPLICABILITY_NOT_ESTABLISHED),
      `absent applicability decision ${JSON.stringify(absent)} must not pass the gate`,
    );
  }
});
