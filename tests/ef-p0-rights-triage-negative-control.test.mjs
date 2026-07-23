// tests/ef-p0-rights-triage-negative-control.test.mjs -- P0-T9 (multi-bundle-conversion-e1-finish,
// Phase 0, FR-F4, Risk-3 mitigation: "an agent triage pass silently drifts into looking like a real
// rights clearance").
//
// THE NEGATIVE CONTROL. Phase 0 of this bundle minted 35 NEW rights/rights-records.json triage
// records and backfilled rights-shaped fields onto 35 evidence sources across three module evidence
// files (12 in modules/cbc_suite_v1/evidence.json -- the RF-CBC-002 batch this repo's own
// scripts/evidence/lib/cbc-002-projection.mjs SOURCE_DEFS constant identifies -- plus all 12 sources
// in modules/kidney_suite_v1/evidence.json and all 11 in modules/growth_suite_v1/evidence.json).
// None of that work is a rights assessment: no human reviewer, no counsel, no license lookup, no
// access-terms retrieval ever ran. This test exists to make it mechanically impossible for that
// honest-unknown posture to quietly regress into something that reads as a real clearance --
// whether by a future edit accidentally setting a real license status, a copy-paste of a template
// that fills in a plausible-looking value, or a "helpful" normalization pass that collapses
// "unknown" into "not_applicable" or drops a null into a string.
//
// Every assertion below checks a CLOSED vocabulary (an exact value, or a fixed small set of
// permitted values), never merely "is truthy" or "is not empty" -- a closed-vocabulary check is the
// only kind of check that fails when a real-looking value sneaks in.
//
// Determinism: no Date.now()/new Date(), no locale-dependent sort. Plain object property reads and
// exact-string/exact-null comparisons only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SOURCE_DEFS as CBC002_SOURCE_DEFS } from '../scripts/evidence/lib/cbc-002-projection.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P0_MARKER = 'multi-bundle-conversion-e1-finish-p0';

async function loadJson(relPath) {
  return JSON.parse(await readFile(path.join(REPO_ROOT, relPath), 'utf8'));
}

// ---------------------------------------------------------------------------------------------
// Part 1 -- rights/rights-records.json: exactly 35 P0-marked records, every one honest-unknown
// ---------------------------------------------------------------------------------------------

/**
 * Asserts a single rights-records.json record carries ONLY the honest-unknown/unassessed/null
 * closed vocabulary this task requires. Deliberately throws (via `assert`) on ANY value outside
 * that vocabulary -- including a value that looks plausible, e.g. a real license string, a real
 * human name, or a "cleaned up" status like "not_applicable" substituted for "unknown".
 */
function assertHonestUnknownRightsRecord(record) {
  const id = record.rights_record_id ?? '(missing rights_record_id)';

  assert.equal(record.overall_status, 'UNKNOWN', `${id}: overall_status must be exactly "UNKNOWN"`);

  assert.equal(record.review.review_status, 'agent_triage_only', `${id}: review.review_status must be exactly "agent_triage_only"`);
  assert.equal(record.review.human_reviewer, null, `${id}: review.human_reviewer must be null (no human has reviewed this)`);
  assert.equal(record.review.counsel_reviewer, null, `${id}: review.counsel_reviewer must be null (no counsel has reviewed this)`);
  assert.equal(record.review.assessed_by_agent, P0_MARKER, `${id}: review.assessed_by_agent must be the P0 marker`);

  assert.equal(record.access.basis, 'unknown', `${id}: access.basis must be exactly "unknown"`);
  assert.equal(record.access.automated_retrieval_allowed, 'unknown', `${id}: access.automated_retrieval_allowed must be exactly "unknown"`);
  assert.equal(record.access.model_training_allowed, 'not_assessed', `${id}: access.model_training_allowed must be exactly "not_assessed"`);

  assert.equal(record.copyright.status, 'unknown', `${id}: copyright.status must be exactly "unknown"`);
}

test('rights/rights-records.json has EXACTLY 35 records with review.assessed_by_agent === "multi-bundle-conversion-e1-finish-p0"', async () => {
  const doc = await loadJson('rights/rights-records.json');
  const marked = doc.records.filter((r) => r.review?.assessed_by_agent === P0_MARKER);
  assert.equal(marked.length, 35, 'exactly 35 records must carry the P0 marker -- not fewer, not more');
});

test('every P0-marked rights-records.json record is honest-unknown on every rights-relevant field (closed vocabulary, no exceptions)', async () => {
  const doc = await loadJson('rights/rights-records.json');
  const marked = doc.records.filter((r) => r.review?.assessed_by_agent === P0_MARKER);
  assert.equal(marked.length, 35, 'sanity re-check: still exactly 35');

  for (const record of marked) {
    assertHonestUnknownRightsRecord(record);
  }
});

test('the P0 marker "multi-bundle-conversion-e1-finish-p0" is distinct from every OTHER assessed_by_agent value in the file', async () => {
  const doc = await loadJson('rights/rights-records.json');
  const otherMarkers = new Set(
    doc.records
      .map((r) => r.review?.assessed_by_agent)
      .filter((marker) => marker !== undefined && marker !== null && marker !== P0_MARKER),
  );
  assert.ok(otherMarkers.size > 0, 'sanity: the file must contain at least one non-P0 marker to compare against');
  assert.ok(!otherMarkers.has(P0_MARKER), 'the P0 marker must not equal (or collide with) any other assessed_by_agent value');
  // Belt-and-suspenders: every other marker string, compared byte-for-byte, must differ.
  for (const marker of otherMarkers) {
    assert.notEqual(marker, P0_MARKER, `other marker "${marker}" must be distinct from the P0 marker`);
  }
});

test('NEGATIVE CONTROL DESIGN CHECK (in-memory only, no data file touched): the assertion helper actually fails on an out-of-vocabulary value', () => {
  // Proves the helper above is not vacuously true -- it must throw when a single field carries a
  // real-looking value instead of the honest-unknown sentinel. Runs entirely against an in-memory
  // clone; no committed file is read or written by this test.
  function honestBaseline() {
    return {
      rights_record_id: 'RR-SYNTHETIC-NEGATIVE-CONTROL',
      overall_status: 'UNKNOWN',
      review: {
        assessed_by_agent: P0_MARKER,
        human_reviewer: null,
        counsel_reviewer: null,
        review_status: 'agent_triage_only',
      },
      access: {
        basis: 'unknown',
        automated_retrieval_allowed: 'unknown',
        model_training_allowed: 'not_assessed',
      },
      copyright: { status: 'unknown' },
    };
  }

  // The honest baseline itself must pass.
  assert.doesNotThrow(() => assertHonestUnknownRightsRecord(honestBaseline()));

  const mutations = [
    (r) => { r.overall_status = 'CLEARED'; },
    (r) => { r.review.review_status = 'human_reviewed'; },
    (r) => { r.review.human_reviewer = 'Jane Q. Counsel'; },
    (r) => { r.review.counsel_reviewer = 'Outside Counsel LLP'; },
    (r) => { r.access.basis = 'licensed'; },
    (r) => { r.access.automated_retrieval_allowed = 'yes'; },
    (r) => { r.access.model_training_allowed = 'allowed'; },
    (r) => { r.copyright.status = 'public_domain'; },
    // The "helpful normalization" failure mode named in this test's own header comment: collapsing
    // the sentinel into a DIFFERENT-looking-but-still-vacuous value must still be caught, because
    // the vocabulary is closed to the ONE exact permitted string, not "anything unknown-ish".
    (r) => { r.access.basis = 'not_applicable'; },
    (r) => { r.review.human_reviewer = ''; },
  ];

  for (const mutate of mutations) {
    const broken = honestBaseline();
    mutate(broken);
    assert.throws(() => assertHonestUnknownRightsRecord(broken), assert.AssertionError, 'mutated record must fail the honest-unknown check');
  }
});

// ---------------------------------------------------------------------------------------------
// Part 2 -- 35 backfilled evidence sources across three module evidence.json files
// ---------------------------------------------------------------------------------------------

const CBC_002_SOURCE_IDS = new Set(CBC002_SOURCE_DEFS.map((def) => def.id));

// The fixed key set every source's `terms` object carries in the real committed data (verified
// identical across all 35 examined sources at authoring time). Checked as an exact set, not just
// "every present key is unknown", so a rename/drop of a terms sub-field (which would otherwise
// silently vanish from the per-key loop below) is still caught.
const EXPECTED_TERMS_KEYS = [
  'incorporation_into_other_products',
  'adaptation',
  'commercial_use',
  'redistribution',
  'sublicensing',
].sort();

/**
 * Asserts a single evidence.json `sources[]` record carries ONLY the honest-unknown closed
 * vocabulary this task requires, on both the source-level rights fields and every one of its
 * passages' judgment_basis / judgment_basis_attestation fields.
 */
function assertHonestUnknownEvidenceSource(source, moduleId) {
  const label = `${moduleId}/${source.id ?? '(missing id)'}`;

  assert.equal(source.license?.status, 'unknown', `${label}: license.status must be exactly "unknown"`);
  assert.equal(source.access_basis, 'unknown', `${label}: access_basis must be exactly "unknown"`);

  assert.ok(source.terms && typeof source.terms === 'object', `${label}: terms must be an object`);
  assert.deepEqual(
    Object.keys(source.terms).sort(),
    EXPECTED_TERMS_KEYS,
    `${label}: terms must carry exactly the expected key set (a renamed/dropped/added key is a regression)`,
  );
  for (const [key, value] of Object.entries(source.terms)) {
    assert.equal(value, 'unknown', `${label}: terms.${key} must be exactly "unknown"`);
  }

  assert.equal(source.terms_snapshot?.status, 'unknown', `${label}: terms_snapshot.status must be exactly "unknown"`);

  assert.ok(Array.isArray(source.passages) && source.passages.length > 0, `${label}: must have at least one passage`);
  for (const passage of source.passages) {
    assert.equal(passage.judgment_basis, 'unassessed', `${label}: passage "${passage.id}" judgment_basis must be exactly "unassessed"`);
    assert.equal(passage.judgment_basis_attestation, null, `${label}: passage "${passage.id}" judgment_basis_attestation must be null`);
  }
}

test('the 35 backfilled evidence sources (12 RF-CBC-002 cbc_suite_v1 + 12 kidney_suite_v1 + 11 growth_suite_v1) are all honest-unknown, and the total examined is EXACTLY 35', async () => {
  const cbcEvidence = await loadJson('modules/cbc_suite_v1/evidence.json');
  const kidneyEvidence = await loadJson('modules/kidney_suite_v1/evidence.json');
  const growthEvidence = await loadJson('modules/growth_suite_v1/evidence.json');

  const cbc002Sources = cbcEvidence.sources.filter((s) => CBC_002_SOURCE_IDS.has(s.id));
  assert.equal(cbc002Sources.length, 12, 'exactly 12 RF-CBC-002-tagged sources must be present in modules/cbc_suite_v1/evidence.json');
  assert.equal(CBC_002_SOURCE_IDS.size, 12, 'sanity: cbc-002-projection.mjs SOURCE_DEFS itself defines exactly 12 entries');

  assert.equal(kidneyEvidence.sources.length, 12, 'modules/kidney_suite_v1/evidence.json must have exactly 12 sources (all in scope)');
  assert.equal(growthEvidence.sources.length, 11, 'modules/growth_suite_v1/evidence.json must have exactly 11 sources (all in scope)');

  const examined = [
    ...cbc002Sources.map((s) => ({ source: s, moduleId: 'cbc_suite_v1' })),
    ...kidneyEvidence.sources.map((s) => ({ source: s, moduleId: 'kidney_suite_v1' })),
    ...growthEvidence.sources.map((s) => ({ source: s, moduleId: 'growth_suite_v1' })),
  ];

  assert.equal(examined.length, 35, 'the total number of backfilled sources examined must be exactly 35 -- not fewer, not more');

  for (const { source, moduleId } of examined) {
    assertHonestUnknownEvidenceSource(source, moduleId);
  }
});

test('NEGATIVE CONTROL DESIGN CHECK (in-memory only, no data file touched): the evidence-source assertion helper actually fails on an out-of-vocabulary value', () => {
  function honestBaselineSource() {
    return {
      id: 'SYNTHETIC_NEGATIVE_CONTROL_SOURCE',
      license: { status: 'unknown' },
      access_basis: 'unknown',
      terms: {
        incorporation_into_other_products: 'unknown',
        adaptation: 'unknown',
        commercial_use: 'unknown',
        redistribution: 'unknown',
        sublicensing: 'unknown',
      },
      terms_snapshot: { status: 'unknown' },
      passages: [
        { id: 'p1', judgment_basis: 'unassessed', judgment_basis_attestation: null },
        { id: 'p2', judgment_basis: 'unassessed', judgment_basis_attestation: null },
      ],
    };
  }

  assert.doesNotThrow(() => assertHonestUnknownEvidenceSource(honestBaselineSource(), 'synthetic'));

  const mutations = [
    (s) => { s.license.status = 'copyrighted-all-rights-reserved'; },
    (s) => { s.access_basis = 'purchased'; },
    (s) => { s.terms.commercial_use = 'permitted'; },
    (s) => { s.terms_snapshot.status = 'captured'; },
    (s) => { s.passages[0].judgment_basis = 'clinician-attested'; },
    (s) => { s.passages[1].judgment_basis_attestation = { reviewer: 'Dr. Someone', date: '2026-07-23' }; },
    // A dropped/renamed key must also be caught, not silently skipped.
    (s) => { delete s.terms.adaptation; s.terms.adaptation_scope = 'unknown'; },
  ];

  for (const mutate of mutations) {
    const broken = honestBaselineSource();
    mutate(broken);
    assert.throws(() => assertHonestUnknownEvidenceSource(broken, 'synthetic'), 'mutated source must fail the honest-unknown check');
  }
});
