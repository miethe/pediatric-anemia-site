// tests/rights-validate-gates.test.mjs — EPR0-T5 (FR-WP0-06, FR-WP0-07, D7).
//
// Proves scripts/validate-rights.mjs's module contract and its four coverage/consistency gates:
//   - the real, on-disk rights/ substrate (seeded by EPR0-T1..T4) passes all four gates cleanly.
//   - each gate is independently unit-tested with both a passing fixture and a failing one — a
//     positive-only test proves nothing (a gate that always returns { errors: [] } would also pass).
//   - D7's central negative criterion: a rights_record at `overall_status: "UNKNOWN"` passes gate
//     (b) — it is a legitimate enum member, not a judged-bad value.
//   - FR-WP0-07: `--as-of` / the `RIGHTS_VALIDATE_AS_OF` env var resolve deterministically, no gate
//     or CLI code path calls `Date.now()` or constructs a bare `new Date()`, and re-running the
//     gates against unchanged input is byte-identical.
//   - `GATES` is a single exported list of `{ id, description, run }` entries a later phase appends
//     to; `runAllGates` fails closed on a malformed gate result.
//
// tests/rights-validate-gates.test.mjs also covers EPR1-T2's (FR-WP1-02/03) 5th gate,
// `checkKbJsonFileCoverage`, plus scripts/validate-kb.mjs's exported `resolveRightsRecordsForIdentifier`
// — the R-P3 seam helper EP-R2's EPR2-T5 reuses unmodified — and EPR2-T5's own call site,
// `validateSourceRightsCoverage` (FR-WP2-06): every evidence.json source must resolve to >=1 real
// rights record via that same unmodified helper.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveAsOf,
  loadRightsContext,
  checkMissingAssessmentCoverage,
  checkBlockingStatusEnumMembership,
  checkOpenFailurePresence,
  checkReleaseContextContainment,
  runReleaseContextContainmentGate,
  checkKbJsonFileCoverage,
  GATES,
  runAllGates,
} from '../scripts/validate-rights.mjs';
import { resolveRightsRecordsForIdentifier, validateSourceRightsCoverage } from '../scripts/validate-kb.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- real substrate passes cleanly ------------------------------------------------------------------

test('the real rights/ substrate passes all four gates with zero errors', async () => {
  const context = await loadRightsContext(REPO_ROOT, { argv: [], env: {} });
  const { errors } = runAllGates(context);
  assert.deepEqual(errors, [], `expected zero errors against the real substrate, got:\n${errors.join('\n')}`);
});

test('runAllGates against the real substrate is byte-identical across two runs (determinism)', async () => {
  const context = await loadRightsContext(REPO_ROOT, { argv: [], env: {} });
  const first = runAllGates(context);
  const second = runAllGates(context);
  assert.deepEqual(JSON.stringify(first), JSON.stringify(second));
});

// --- GATES / runAllGates structural contract ----------------------------------------------------

test('GATES is a single exported list of >=4 { id, description, run } entries', () => {
  assert.ok(Array.isArray(GATES));
  assert.ok(GATES.length >= 4, `expected >=4 gates, got ${GATES.length}`);
  const ids = new Set();
  for (const gate of GATES) {
    assert.equal(typeof gate.id, 'string');
    assert.ok(gate.id.length > 0);
    assert.equal(typeof gate.description, 'string');
    assert.equal(typeof gate.run, 'function');
    assert.ok(!ids.has(gate.id), `duplicate gate id "${gate.id}"`);
    ids.add(gate.id);
  }
});

test('runAllGates fails closed when a gate returns a malformed result', () => {
  const badGates = [{ id: 'broken', description: 'returns undefined errors', run: () => ({}) }];
  assert.throws(() => runAllGates({}, badGates), /did not return \{ errors: string\[\] \}/);

  const nullGates = [{ id: 'broken-null', description: 'returns null', run: () => null }];
  assert.throws(() => runAllGates({}, nullGates), /did not return \{ errors: string\[\] \}/);
});

// --- gate (a): checkMissingAssessmentCoverage -----------------------------------------------------

test('gate (a): a fully covered, bidirectionally-resolving identifier/ledger/record set passes', () => {
  const context = {
    clinicalIdentifiers: [{ type: 'evidence_source_id', id: 'SRC_A' }],
    rightsLedger: { entries: [{ clinical_identifier_type: 'evidence_source_id', clinical_identifier: 'SRC_A', rights_record_id: 'RR-A' }] },
    rightsRecords: { records: [{ rights_record_id: 'RR-A' }] },
  };
  assert.deepEqual(checkMissingAssessmentCoverage(context).errors, []);
});

test('gate (a): FAILS CLOSED — a known clinical identifier with no ledger entry', () => {
  const context = {
    clinicalIdentifiers: [{ type: 'evidence_source_id', id: 'SRC_A' }],
    rightsLedger: { entries: [] },
    rightsRecords: { records: [] },
  };
  const { errors } = checkMissingAssessmentCoverage(context);
  assert.ok(errors.some((e) => e.includes('has no rights/rights-ledger.json entry')), errors.join('\n'));
});

test('gate (a): FAILS CLOSED — a ledger entry pointing at an unknown rights_record_id', () => {
  const context = {
    clinicalIdentifiers: [{ type: 'evidence_source_id', id: 'SRC_A' }],
    rightsLedger: { entries: [{ clinical_identifier_type: 'evidence_source_id', clinical_identifier: 'SRC_A', rights_record_id: 'RR-MISSING' }] },
    rightsRecords: { records: [] },
  };
  const { errors } = checkMissingAssessmentCoverage(context);
  assert.ok(errors.some((e) => e.includes('references unknown rights_record_id "RR-MISSING"')), errors.join('\n'));
});

test('gate (a): FAILS CLOSED — a dangling ledger entry for an identifier that no longer exists (reverse direction)', () => {
  const context = {
    clinicalIdentifiers: [],
    rightsLedger: { entries: [{ clinical_identifier_type: 'evidence_source_id', clinical_identifier: 'SRC_GONE', rights_record_id: 'RR-GONE' }] },
    rightsRecords: { records: [{ rights_record_id: 'RR-GONE' }] },
  };
  const { errors } = checkMissingAssessmentCoverage(context);
  assert.ok(errors.some((e) => e.includes('does not resolve to any known clinical identifier')), errors.join('\n'));
});

test('gate (a): FAILS CLOSED — an orphan rights_record unreachable from any known clinical identifier', () => {
  const context = {
    clinicalIdentifiers: [],
    rightsLedger: { entries: [] },
    rightsRecords: { records: [{ rights_record_id: 'RR-ORPHAN' }] },
  };
  const { errors } = checkMissingAssessmentCoverage(context);
  assert.ok(errors.some((e) => e.includes('is not reachable from any known clinical identifier')), errors.join('\n'));
});

// --- gate (b): checkBlockingStatusEnumMembership --------------------------------------------------

const FIXTURE_RECORD_SCHEMA = {
  properties: {
    overall_status: { enum: ['UNKNOWN', 'PROHIBITED', 'INTERNAL_ONLY'] },
    review: { properties: { review_status: { enum: ['agent_triage_only', 'human_reviewed'] } } },
  },
};
const FIXTURE_FAILURE_SCHEMA = {
  properties: {
    release_gate: { enum: ['PASS', 'PASS_WITH_CONDITIONS', 'BLOCK'] },
    status: { enum: ['open', 'resolved_no_use'] },
  },
};

test('gate (b): D7 negative criterion — a rights_record at overall_status "UNKNOWN" passes', () => {
  const context = {
    rightsRecords: { records: [{ rights_record_id: 'RR-A', overall_status: 'UNKNOWN', review: { review_status: 'agent_triage_only' } }] },
    rightsFailures: { failures: [] },
    rightsRecordSchema: FIXTURE_RECORD_SCHEMA,
    rightsFailureSchema: FIXTURE_FAILURE_SCHEMA,
  };
  assert.deepEqual(checkBlockingStatusEnumMembership(context).errors, []);
});

test('gate (b): a rights_record at a legitimately "blocking" status (e.g. PROHIBITED) ALSO passes — membership, not judgement', () => {
  const context = {
    rightsRecords: { records: [{ rights_record_id: 'RR-A', overall_status: 'PROHIBITED', review: { review_status: 'agent_triage_only' } }] },
    rightsFailures: { failures: [{ rights_failure_id: 'RF-A', release_gate: 'BLOCK', status: 'open' }] },
    rightsRecordSchema: FIXTURE_RECORD_SCHEMA,
    rightsFailureSchema: FIXTURE_FAILURE_SCHEMA,
  };
  assert.deepEqual(checkBlockingStatusEnumMembership(context).errors, []);
});

test('gate (b): FAILS CLOSED — overall_status not a member of the schema enum', () => {
  const context = {
    rightsRecords: { records: [{ rights_record_id: 'RR-A', overall_status: 'BOGUS_STATUS', review: { review_status: 'agent_triage_only' } }] },
    rightsFailures: { failures: [] },
    rightsRecordSchema: FIXTURE_RECORD_SCHEMA,
    rightsFailureSchema: FIXTURE_FAILURE_SCHEMA,
  };
  const { errors } = checkBlockingStatusEnumMembership(context);
  assert.ok(errors.some((e) => e.includes('overall_status "BOGUS_STATUS" is not a member')), errors.join('\n'));
});

test('gate (b): FAILS CLOSED — rights_failure.release_gate not a member of the schema enum', () => {
  const context = {
    rightsRecords: { records: [] },
    rightsFailures: { failures: [{ rights_failure_id: 'RF-A', release_gate: 'MAYBE', status: 'open' }] },
    rightsRecordSchema: FIXTURE_RECORD_SCHEMA,
    rightsFailureSchema: FIXTURE_FAILURE_SCHEMA,
  };
  const { errors } = checkBlockingStatusEnumMembership(context);
  assert.ok(errors.some((e) => e.includes('release_gate "MAYBE" is not a member')), errors.join('\n'));
});

test('gate (b): FAILS CLOSED — an unresolvable schema enum refuses to validate silently', () => {
  const context = {
    rightsRecords: { records: [] },
    rightsFailures: { failures: [] },
    rightsRecordSchema: {},
    rightsFailureSchema: {},
  };
  const { errors } = checkBlockingStatusEnumMembership(context);
  assert.ok(errors.some((e) => e.includes('could not resolve')), errors.join('\n'));
});

// --- gate (c): checkOpenFailurePresence -------------------------------------------------------------

test('gate (c): an open failure correctly cross-linked to its rights_record passes', () => {
  const context = {
    rightsFailures: { failures: [{ rights_failure_id: 'RF-A', status: 'open', rights_record_id: 'RR-A' }] },
    rightsRecords: { records: [{ rights_record_id: 'RR-A', rights_failure_ids: ['RF-A'] }] },
  };
  assert.deepEqual(checkOpenFailurePresence(context).errors, []);
});

test('gate (c): a CLOSED failure with no cross-link does not fail — only OPEN failures are checked', () => {
  const context = {
    rightsFailures: { failures: [{ rights_failure_id: 'RF-A', status: 'resolved_no_use', rights_record_id: 'RR-A' }] },
    rightsRecords: { records: [{ rights_record_id: 'RR-A', rights_failure_ids: [] }] },
  };
  assert.deepEqual(checkOpenFailurePresence(context).errors, []);
});

test('gate (c): FAILS CLOSED — an open failure not cross-linked back from its rights_record', () => {
  const context = {
    rightsFailures: { failures: [{ rights_failure_id: 'RF-A', status: 'open', rights_record_id: 'RR-A' }] },
    rightsRecords: { records: [{ rights_record_id: 'RR-A', rights_failure_ids: [] }] },
  };
  const { errors } = checkOpenFailurePresence(context);
  assert.ok(errors.some((e) => e.includes('is not cross-linked back from rights_record "RR-A"')), errors.join('\n'));
});

test('gate (c): FAILS CLOSED — an open failure referencing an unknown rights_record_id', () => {
  const context = {
    rightsFailures: { failures: [{ rights_failure_id: 'RF-A', status: 'open', rights_record_id: 'RR-MISSING' }] },
    rightsRecords: { records: [] },
  };
  const { errors } = checkOpenFailurePresence(context);
  assert.ok(errors.some((e) => e.includes('references unknown rights_record_id "RR-MISSING"')), errors.join('\n'));
});

test('gate (c): FAILS CLOSED — a rights_record referencing an unknown rights_failure_id', () => {
  const context = {
    rightsFailures: { failures: [] },
    rightsRecords: { records: [{ rights_record_id: 'RR-A', rights_failure_ids: ['RF-GHOST'] }] },
  };
  const { errors } = checkOpenFailurePresence(context);
  assert.ok(errors.some((e) => e.includes('references unknown rights_failure_id "RF-GHOST"')), errors.join('\n'));
});

// --- gate (d): checkReleaseContextContainment / runReleaseContextContainmentGate ------------------

const FIXTURE_RELEASE_CONTEXT = {
  release_context_id: 'fixture-context',
  commercial: false,
  intended_uses: { permitted: ['internal reading'], not_permitted: ['commercial runtime logic'] },
  territory: { permitted_jurisdictions: ['US'] },
  channel: { permitted_channels: ['internal_engineering_environment'] },
};

test('gate (d): a requested use fully contained within release-context.json passes', () => {
  const requestedUse = {
    requested_use_id: 'fixture-internal',
    commercial: false,
    intended_uses: ['internal reading'],
    jurisdictions: ['US'],
    channels: ['internal_engineering_environment'],
  };
  assert.deepEqual(checkReleaseContextContainment(FIXTURE_RELEASE_CONTEXT, requestedUse).errors, []);
});

test('gate (d): FAILS CLOSED — a commercial:true request against a commercial:false release context', () => {
  const requestedUse = { requested_use_id: 'fixture-commercial', commercial: true, intended_uses: [] };
  const { errors } = checkReleaseContextContainment(FIXTURE_RELEASE_CONTEXT, requestedUse);
  assert.ok(errors.some((e) => e.includes('commercial:true')), errors.join('\n'));
});

test('gate (d): FAILS CLOSED — an intended use outside the permitted set', () => {
  const requestedUse = { requested_use_id: 'fixture-oob-use', intended_uses: ['patient-facing content'] };
  const { errors } = checkReleaseContextContainment(FIXTURE_RELEASE_CONTEXT, requestedUse);
  assert.ok(errors.some((e) => e.includes('intended use "patient-facing content"')), errors.join('\n'));
});

test('gate (d): FAILS CLOSED — a jurisdiction outside the permitted set', () => {
  const requestedUse = { requested_use_id: 'fixture-oob-territory', jurisdictions: ['EU'] };
  const { errors } = checkReleaseContextContainment(FIXTURE_RELEASE_CONTEXT, requestedUse);
  assert.ok(errors.some((e) => e.includes('jurisdiction "EU"')), errors.join('\n'));
});

test('gate (d): FAILS CLOSED — a channel outside the permitted set', () => {
  const requestedUse = { requested_use_id: 'fixture-oob-channel', channels: ['public_web'] };
  const { errors } = checkReleaseContextContainment(FIXTURE_RELEASE_CONTEXT, requestedUse);
  assert.ok(errors.some((e) => e.includes('channel "public_web"')), errors.join('\n'));
});

test('gate (d): FAILS CLOSED — no release-context.json provided', () => {
  const { errors } = checkReleaseContextContainment(null, { requested_use_id: 'x' });
  assert.ok(errors.some((e) => e.includes('no release-context.json provided')), errors.join('\n'));
});

test('gate (d) CLI wrapper: runReleaseContextContainmentGate self-check passes against the real release-context.json', async () => {
  const context = await loadRightsContext(REPO_ROOT, { argv: [], env: {} });
  assert.deepEqual(runReleaseContextContainmentGate(context).errors, []);
});

// --- scripts/validate-kb.mjs: resolveRightsRecordsForIdentifier (EPR1-T2, R-P3 seam helper) -------

test('resolveRightsRecordsForIdentifier: resolves a matching ledger entry to its rights_record_id', () => {
  const rightsLedger = { entries: [{ clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/reference-ranges.json', rights_record_id: 'RR-A' }] };
  const rightsRecords = { records: [{ rights_record_id: 'RR-A' }] };
  const { recordIds, errors } = resolveRightsRecordsForIdentifier('kb_json_file_path', 'modules/anemia/reference-ranges.json', { rightsLedger, rightsRecords });
  assert.deepEqual(recordIds, ['RR-A']);
  assert.deepEqual(errors, []);
});

test('resolveRightsRecordsForIdentifier: returns multiple recordIds when the ledger legitimately double-joins the same identifier', () => {
  const rightsLedger = {
    entries: [
      { clinical_identifier_type: 'evidence_source_id', clinical_identifier: 'AAP2026_IDA', rights_record_id: 'RR-A' },
      { clinical_identifier_type: 'evidence_source_id', clinical_identifier: 'AAP2026_IDA', rights_record_id: 'RR-A-COMPONENT' },
    ],
  };
  const rightsRecords = { records: [{ rights_record_id: 'RR-A' }, { rights_record_id: 'RR-A-COMPONENT' }] };
  const { recordIds, errors } = resolveRightsRecordsForIdentifier('evidence_source_id', 'AAP2026_IDA', { rightsLedger, rightsRecords });
  assert.deepEqual(recordIds.sort(), ['RR-A', 'RR-A-COMPONENT']);
  assert.deepEqual(errors, []);
});

test('resolveRightsRecordsForIdentifier: ignores entries for a different identifier type or id', () => {
  const rightsLedger = {
    entries: [
      { clinical_identifier_type: 'evidence_source_id', clinical_identifier: 'modules/anemia/rules.json', rights_record_id: 'RR-WRONG-TYPE' },
      { clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/candidates.json', rights_record_id: 'RR-WRONG-ID' },
    ],
  };
  const rightsRecords = { records: [{ rights_record_id: 'RR-WRONG-TYPE' }, { rights_record_id: 'RR-WRONG-ID' }] };
  const { recordIds, errors } = resolveRightsRecordsForIdentifier('kb_json_file_path', 'modules/anemia/rules.json', { rightsLedger, rightsRecords });
  assert.deepEqual(recordIds, []);
  assert.deepEqual(errors, []);
});

test('resolveRightsRecordsForIdentifier: FAILS CLOSED — a matching entry whose rights_record_id is dangling', () => {
  const rightsLedger = { entries: [{ clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/rules.json', rights_record_id: 'RR-MISSING' }] };
  const rightsRecords = { records: [] };
  const { recordIds, errors } = resolveRightsRecordsForIdentifier('kb_json_file_path', 'modules/anemia/rules.json', { rightsLedger, rightsRecords });
  assert.deepEqual(recordIds, []);
  assert.ok(errors.some((e) => e.includes('references unknown rights_record_id "RR-MISSING"')), errors.join('\n'));
});

test('resolveRightsRecordsForIdentifier: a dangling entry is reported even alongside another entry for the same identifier that DOES resolve', () => {
  const rightsLedger = {
    entries: [
      { clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/evidence.json', rights_record_id: 'RR-OK' },
      { clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/evidence.json', rights_record_id: 'RR-MISSING' },
    ],
  };
  const rightsRecords = { records: [{ rights_record_id: 'RR-OK' }] };
  const { recordIds, errors } = resolveRightsRecordsForIdentifier('kb_json_file_path', 'modules/anemia/evidence.json', { rightsLedger, rightsRecords });
  assert.deepEqual(recordIds, ['RR-OK']);
  assert.ok(errors.some((e) => e.includes('RR-MISSING')), 'a partially-covered identifier must not swallow its own dangling entry');
});

// --- gate (e): checkKbJsonFileCoverage (EPR1-T2, FR-WP1-02/03) -------------------------------------

test('gate (e): every KB_JSON_FILES artifact bidirectionally resolving to a real record passes', () => {
  const context = {
    kbJsonFileArtifacts: ['modules/anemia/rules.json', 'modules/anemia/reference-ranges.json'],
    rightsLedger: {
      entries: [
        { clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/rules.json', rights_record_id: 'RR-A' },
        { clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/reference-ranges.json', rights_record_id: 'RR-B' },
      ],
    },
    rightsRecords: { records: [{ rights_record_id: 'RR-A' }, { rights_record_id: 'RR-B' }] },
  };
  assert.deepEqual(checkKbJsonFileCoverage(context).errors, []);
});

test('gate (e): the real substrate resolves all 4 modules/anemia KB_JSON_FILES paths bidirectionally', async () => {
  const context = await loadRightsContext(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), { argv: [], env: {} });
  assert.ok(context.kbJsonFileArtifacts.includes('modules/anemia/rules.json'));
  assert.ok(context.kbJsonFileArtifacts.includes('modules/anemia/candidates.json'));
  assert.ok(context.kbJsonFileArtifacts.includes('modules/anemia/evidence.json'));
  assert.ok(context.kbJsonFileArtifacts.includes('modules/anemia/reference-ranges.json'));
  assert.deepEqual(checkKbJsonFileCoverage(context).errors, []);
});

test('gate (e): FAILS CLOSED — a KB_JSON_FILES artifact with no kb_json_file_path ledger entry (breakage b)', () => {
  const context = {
    kbJsonFileArtifacts: ['modules/anemia/rules.json', 'modules/anemia/a-fifth-file.json'],
    rightsLedger: {
      entries: [{ clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/rules.json', rights_record_id: 'RR-A' }],
    },
    rightsRecords: { records: [{ rights_record_id: 'RR-A' }] },
  };
  const { errors } = checkKbJsonFileCoverage(context);
  assert.ok(
    errors.some((e) => e.includes('KB_JSON_FILES artifact "modules/anemia/a-fifth-file.json" has no rights/rights-ledger.json entry')),
    errors.join('\n'),
  );
});

test('gate (e): FAILS CLOSED — a kb_json_file_path ledger entry pointing at a deleted rights_record (breakage a)', () => {
  const context = {
    kbJsonFileArtifacts: ['modules/anemia/rules.json'],
    rightsLedger: {
      entries: [{ clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/rules.json', rights_record_id: 'RR-DELETED' }],
    },
    rightsRecords: { records: [] },
  };
  const { errors } = checkKbJsonFileCoverage(context);
  assert.ok(errors.some((e) => e.includes('references unknown rights_record_id "RR-DELETED"')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('KB_JSON_FILES artifact "modules/anemia/rules.json" has no rights/rights-ledger.json entry')), errors.join('\n'));
});

test('gate (e): FAILS CLOSED — a stale kb_json_file_path ledger entry pointing at a path that is no longer a KB_JSON_FILES artifact (breakage c, reverse direction)', () => {
  const context = {
    kbJsonFileArtifacts: ['modules/anemia/rules.json'],
    rightsLedger: {
      entries: [
        { clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/rules.json', rights_record_id: 'RR-A' },
        { clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/deleted-artifact.json', rights_record_id: 'RR-A' },
      ],
    },
    rightsRecords: { records: [{ rights_record_id: 'RR-A' }] },
  };
  const { errors } = checkKbJsonFileCoverage(context);
  assert.ok(
    errors.some((e) => e.includes('kb_json_file_path entry "modules/anemia/deleted-artifact.json" does not resolve to any current KB_JSON_FILES artifact')),
    errors.join('\n'),
  );
});

test('gate (e): D7 — a resolving record at overall_status "UNKNOWN" (never read by this gate) still passes', () => {
  const context = {
    kbJsonFileArtifacts: ['modules/anemia/rules.json'],
    rightsLedger: {
      entries: [{ clinical_identifier_type: 'kb_json_file_path', clinical_identifier: 'modules/anemia/rules.json', rights_record_id: 'RR-A' }],
    },
    rightsRecords: { records: [{ rights_record_id: 'RR-A', overall_status: 'UNKNOWN' }] },
  };
  assert.deepEqual(checkKbJsonFileCoverage(context).errors, []);
});

test('GATES includes the EPR1-T2 kb-json-file-coverage gate exactly once', () => {
  const matches = GATES.filter((gate) => gate.id === 'kb-json-file-coverage');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].run, checkKbJsonFileCoverage);
});

// --- FR-WP0-07: --as-of / RIGHTS_VALIDATE_AS_OF, no Date.now() -------------------------------------

test('resolveAsOf: returns null when neither --as-of nor the env var is set', () => {
  assert.equal(resolveAsOf([], {}), null);
});

test('resolveAsOf: parses --as-of=<value>', () => {
  const asOf = resolveAsOf(['--as-of=2026-01-01T00:00:00.000Z'], {});
  assert.ok(asOf instanceof Date);
  assert.equal(asOf.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('resolveAsOf: parses the space-separated --as-of <value> form', () => {
  const asOf = resolveAsOf(['--as-of', '2026-01-01T00:00:00.000Z'], {});
  assert.equal(asOf.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('resolveAsOf: falls back to RIGHTS_VALIDATE_AS_OF when no flag is present', () => {
  const asOf = resolveAsOf([], { RIGHTS_VALIDATE_AS_OF: '2026-06-01T00:00:00.000Z' });
  assert.equal(asOf.toISOString(), '2026-06-01T00:00:00.000Z');
});

test('resolveAsOf: the --as-of flag takes precedence over the env var', () => {
  const asOf = resolveAsOf(['--as-of=2026-01-01T00:00:00.000Z'], { RIGHTS_VALIDATE_AS_OF: '2026-06-01T00:00:00.000Z' });
  assert.equal(asOf.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('resolveAsOf: throws on an unparseable --as-of value rather than silently producing Invalid Date', () => {
  assert.throws(() => resolveAsOf(['--as-of=not-a-real-date'], {}), /is not a valid ISO 8601 date\/time/);
});

test('determinism: scripts/validate-rights.mjs contains no Date.now() and no bare `new Date()`', async () => {
  const source = await readFile(path.join(REPO_ROOT, 'scripts', 'validate-rights.mjs'), 'utf8');
  assert.ok(!source.includes('Date.now('), 'must not call Date.now()');
  assert.ok(!/new Date\(\s*\)/.test(source), 'must not construct a bare `new Date()` with no argument');
});

test('loadRightsContext: two loads of the unchanged real substrate produce deep-equal context data', async () => {
  const first = await loadRightsContext(REPO_ROOT, { argv: [], env: {} });
  const second = await loadRightsContext(REPO_ROOT, { argv: [], env: {} });
  assert.deepEqual(first.rightsRecords, second.rightsRecords);
  assert.deepEqual(first.rightsFailures, second.rightsFailures);
  assert.deepEqual(first.rightsLedger, second.rightsLedger);
  assert.deepEqual(first.releaseContext, second.releaseContext);
  assert.deepEqual(first.clinicalIdentifiers, second.clinicalIdentifiers);
  assert.deepEqual(first.kbJsonFileArtifacts, second.kbJsonFileArtifacts);
  assert.equal(first.asOf, null);
  assert.equal(second.asOf, null);
});

// --- scripts/validate-kb.mjs: validateSourceRightsCoverage (EPR2-T5, R-P3 seam CONSUMER, FR-WP2-06) --

test('validateSourceRightsCoverage: a source with a resolving evidence_source_id ledger entry passes', () => {
  const evidenceData = { sources: [{ id: 'AAP2026_IDA' }] };
  const rightsLedger = { entries: [{ clinical_identifier_type: 'evidence_source_id', clinical_identifier: 'AAP2026_IDA', rights_record_id: 'RR-A' }] };
  const rightsRecords = { records: [{ rights_record_id: 'RR-A' }] };
  const errors = validateSourceRightsCoverage(evidenceData, 'anemia', { rightsLedger, rightsRecords });
  assert.deepEqual(errors, []);
});

test('validateSourceRightsCoverage: FAILS CLOSED — a source with no ledger entry at all, naming the source id', () => {
  const evidenceData = { sources: [{ id: 'AAP2026_IDA' }, { id: 'UNCOVERED_SOURCE' }] };
  const rightsLedger = { entries: [{ clinical_identifier_type: 'evidence_source_id', clinical_identifier: 'AAP2026_IDA', rights_record_id: 'RR-A' }] };
  const rightsRecords = { records: [{ rights_record_id: 'RR-A' }] };
  const errors = validateSourceRightsCoverage(evidenceData, 'anemia', { rightsLedger, rightsRecords });
  assert.ok(
    errors.some((e) => e.includes('UNCOVERED_SOURCE') && e.includes('no rights/rights-ledger.json entry resolves')),
    errors.join('\n'),
  );
});

test('validateSourceRightsCoverage: FAILS CLOSED — a ledger entry present but its rights_record_id is dangling', () => {
  const evidenceData = { sources: [{ id: 'AAP2026_IDA' }] };
  const rightsLedger = { entries: [{ clinical_identifier_type: 'evidence_source_id', clinical_identifier: 'AAP2026_IDA', rights_record_id: 'RR-MISSING' }] };
  const rightsRecords = { records: [] };
  const errors = validateSourceRightsCoverage(evidenceData, 'anemia', { rightsLedger, rightsRecords });
  assert.ok(errors.some((e) => e.includes('references unknown rights_record_id "RR-MISSING"')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('AAP2026_IDA') && e.includes('no rights/rights-ledger.json entry resolves')), errors.join('\n'));
});

test('validateSourceRightsCoverage: a source with no id is skipped (already reported by the schema check)', () => {
  const evidenceData = { sources: [{}] };
  const errors = validateSourceRightsCoverage(evidenceData, 'anemia', { rightsLedger: { entries: [] }, rightsRecords: { records: [] } });
  assert.deepEqual(errors, []);
});

test('validateSourceRightsCoverage: D7 — a resolving record at overall_status "UNKNOWN" (never read by this gate) still passes', () => {
  const evidenceData = { sources: [{ id: 'AAP2026_IDA' }] };
  const rightsLedger = { entries: [{ clinical_identifier_type: 'evidence_source_id', clinical_identifier: 'AAP2026_IDA', rights_record_id: 'RR-A' }] };
  const rightsRecords = { records: [{ rights_record_id: 'RR-A', overall_status: 'UNKNOWN' }] };
  const errors = validateSourceRightsCoverage(evidenceData, 'anemia', { rightsLedger, rightsRecords });
  assert.deepEqual(errors, []);
});

test('validateSourceRightsCoverage: the real substrate resolves all 6 modules/anemia evidence.json sources', async () => {
  const evidenceData = JSON.parse(await readFile(path.join(REPO_ROOT, 'modules', 'anemia', 'evidence.json'), 'utf8'));
  const rightsLedger = JSON.parse(await readFile(path.join(REPO_ROOT, 'rights', 'rights-ledger.json'), 'utf8'));
  const rightsRecords = JSON.parse(await readFile(path.join(REPO_ROOT, 'rights', 'rights-records.json'), 'utf8'));
  assert.equal(evidenceData.sources.length, 6, 'expected 6 sources in the real modules/anemia/evidence.json');
  const errors = validateSourceRightsCoverage(evidenceData, 'anemia', { rightsLedger, rightsRecords });
  assert.deepEqual(errors, [], errors.join('\n'));
});
