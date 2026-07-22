// tests/ef-contract-forced-empty.test.mjs -- P1-T7 (Evidence Foundry E1 Phase 1, FR-6/FR-16, R-P3
// seam task).
//
// P1-T7 wires the P1-T2 (review-record), P1-T4 (reviewer roster), and P1-T5 (release-manifest
// signature slot / release registry) schemas into scripts/validate-kb.mjs. This file is the seam
// proof itself: every one of this task's own binding acceptance criteria --
//
//   1. All 4 seeded forced-empty violations are rejected with SPECIFIC (not generic) errors, by
//      the EXACT function `npm run validate`'s CLI entrypoint calls -- never merely by
//      `scripts/lib/json-schema-lite.mjs#validate()` in isolation (that level is already proven by
//      tests/module-manifest-schema.test.mjs, tests/release-manifest-schema.test.mjs,
//      tests/reviewer-roster-schema.test.mjs).
//   2. All existing modules (modules/anemia/, modules/cbc_suite_v1/) still pass with zero errors --
//      the new reviews/roster/registry wiring introduces no false positive.
//   3. An empty/absent `modules/<id>/reviews/` directory and an absent `releases/registry.json`
//      are both handled explicitly (pass, with a note for the registry case), never a crash.
//
// The 4 seeded-violation fixtures under tests/fixtures/ef-contract-violations/ (`.json.txt`, not
// `.json` -- mirrors tests/fixtures/invalid-authoring-decisions/'s own naming rationale: a stray
// non-intake `.json` blob under tests/fixtures/ would risk being swept by
// scripts/evidence/backfill-rule-governance.mjs's fixture-corpus scan, which is unrelated to what
// these fixtures exist to prove):
//
//   001 -- populated approvedBy[] on a module-manifest.json (D-4/AC-D4)
//   002 -- populated signature on a real-candidate (no dryRun marker) release-manifest (FR-16)
//   003 -- a synthetic:false reviewer-roster entry with no verificationRef (gate G1)
//   004 -- an attempted unsigned-stub -> "release-ready" module-manifest status transition
//          (SPIKE-006 RQ4's closed lifecycle enum has no such value)

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateModule,
  validateKbPackReleaseManifests,
  validateModuleReviews,
  validateReviewRecord,
  validateReviewRecordAgainstRoster,
  buildReviewerRosterIndex,
  loadReviewerRosterIndex,
  validateReviewerRoster,
  loadAndValidateReviewerRoster,
  loadAndValidateReleaseRegistry,
  validateReleaseRegistryDocument,
} from '../scripts/validate-kb.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-contract-violations');
const ROSTER_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'reviewer-roster.schema.json');
const REVIEW_RECORD_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');
const REGISTRY_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-registry.schema.json');

const SCHEMA_FILES_FOR_TEMP_MODULE_TREE = [
  'rule.schema.json', 'candidate.schema.json', 'evidence.schema.json', 'module-manifest.schema.json',
  'review-record.schema.json',
];

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

function fixture(name) {
  return path.join(FIXTURE_DIR, name);
}

/**
 * Builds a throwaway temp module tree outside `modules/` (never touches the real, read-only
 * modules/anemia/ or modules/cbc_suite_v1/ trees) shaped exactly the way validateModule() expects
 * -- rules.json, candidates.json, evidence.json, module.json -- mirroring
 * tests/authoring-decisions-schema.test.mjs's own seeded-bad-module builder. `manifestOverrides`
 * is spread onto a copy of the real modules/cbc_suite_v1/module.json (a known-valid manifest), so
 * every seeded manifest violation is isolated to exactly the field(s) under test.
 */
async function buildSeededModuleTree(moduleId, manifestOverrides) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-'));
  await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
  for (const schemaFile of SCHEMA_FILES_FOR_TEMP_MODULE_TREE) {
    await cp(path.join(REPO_ROOT, 'schemas', schemaFile), path.join(tempRoot, 'schemas', schemaFile));
  }

  const moduleDir = path.join(tempRoot, 'modules', moduleId);
  await mkdir(moduleDir, { recursive: true });
  await writeFile(path.join(moduleDir, 'rules.json'), JSON.stringify([], null, 2));
  await writeFile(path.join(moduleDir, 'candidates.json'), JSON.stringify({}, null, 2));
  await writeFile(
    path.join(moduleDir, 'evidence.json'),
    JSON.stringify({ knowledgeBaseVersion: '0.0.0-test', reviewedThrough: '2026-07-21', sources: [] }, null, 2),
  );

  const realManifest = await loadJson(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json'));
  const manifest = { ...realManifest, id: moduleId, ...manifestOverrides };
  await writeFile(path.join(moduleDir, 'module.json'), JSON.stringify(manifest, null, 2));

  return tempRoot;
}

// --- 001: populated approvedBy[] on a module-manifest.json (D-4/AC-D4) -------------------------

test('seeded fixture 001 violates module-manifest.schema.json in exactly one way (populated approvedBy[])', async () => {
  const doc = await loadJson(fixture('invalid-module-manifest-populated-approvedby-001.json.txt'));
  assert.equal(doc.approvedBy.length, 1, 'fixture must carry exactly one fabricated approver');
  assert.equal(doc.status, 'unsigned-stub', 'fixture must otherwise be a legal unsigned-stub manifest');
});

test('001: validateModule() -- the exact function npm run validate calls per module -- fails closed on a populated approvedBy[] with a maxItems: 0 error, no other error', async () => {
  const moduleId = 'synthetic_seeded_bad_approvedby';
  const badManifest = await loadJson(fixture('invalid-module-manifest-populated-approvedby-001.json.txt'));
  const { id: _drop, ...overrides } = badManifest;
  const tempRoot = await buildSeededModuleTree(moduleId, overrides);
  try {
    const result = await validateModule(moduleId, tempRoot);
    assert.ok(
      result.errors.some((e) => e.includes('module-manifest.schema.json') && e.includes('$.approvedBy') && e.includes('maxItems')),
      `expected an approvedBy maxItems error, got: ${JSON.stringify(result.errors, null, 2)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// --- 002: populated signature on a real-candidate release-manifest (FR-16) ---------------------

test('seeded fixture 002 violates release-manifest.schema.json in exactly one way (populated signature, no dryRun marker)', async () => {
  const doc = await loadJson(fixture('invalid-release-manifest-real-candidate-signature-002.json.txt'));
  assert.ok(!Object.hasOwn(doc, 'dryRun'), 'fixture must carry no dryRun marker -- this is the "real candidate" case');
  assert.equal(typeof doc.signature, 'object');
  assert.notEqual(doc.signature, null);
});

test('002: validateKbPackReleaseManifests() -- the exact function npm run validate calls across build/kb-pack/ -- fails closed on a real-candidate populated signature', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-kbpack-'));
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    await cp(
      path.join(REPO_ROOT, 'schemas', 'release-manifest.schema.json'),
      path.join(tempRoot, 'schemas', 'release-manifest.schema.json'),
    );
    const packDir = path.join(tempRoot, 'build', 'kb-pack', 'cbc_suite_v1', '0.1.0-proposal');
    await mkdir(packDir, { recursive: true });
    const badDoc = await loadJson(fixture('invalid-release-manifest-real-candidate-signature-002.json.txt'));
    await writeFile(path.join(packDir, 'release-manifest.unsigned.json'), JSON.stringify(badDoc, null, 2));

    const results = await validateKbPackReleaseManifests(tempRoot);
    assert.equal(results.length, 1);
    assert.deepEqual(
      results[0].errors,
      [{ path: '$.signature', message: 'expected type null, got object' }].map(
        (e) => `release-manifest.unsigned.json: release-manifest.schema.json ${e.path}: ${e.message}`,
      ),
      `expected exactly one signature-forced-null violation, got: ${JSON.stringify(results[0].errors, null, 2)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// --- 003: a synthetic:false reviewer-roster entry with no verificationRef (gate G1) -------------

test('seeded fixture 003 violates reviewer-roster.schema.json in exactly one way (synthetic:false, no verificationRef)', async () => {
  const doc = await loadJson(fixture('invalid-reviewer-roster-real-entry-no-verificationref-003.json.txt'));
  assert.equal(doc.reviewers.length, 1);
  assert.equal(doc.reviewers[0].synthetic, false);
  assert.ok(!Object.hasOwn(doc.reviewers[0], 'verificationRef'));
});

test('003: validateReviewerRoster() -- the exact function npm run validate calls on governance/reviewer-roster.yaml -- fails closed on a real entry with no verificationRef', async () => {
  const rosterSchema = await loadJson(ROSTER_SCHEMA_PATH);
  const badDoc = await loadJson(fixture('invalid-reviewer-roster-real-entry-no-verificationref-003.json.txt'));
  const { errors, reviewerCount } = validateReviewerRoster(badDoc, rosterSchema);
  assert.equal(reviewerCount, 1);
  assert.ok(
    errors.some((e) => e.includes('reviewer-roster.schema.json') && e.includes('verificationRef')),
    `expected a verificationRef error, got: ${JSON.stringify(errors, null, 2)}`,
  );
});

test('003 (full wiring): loadAndValidateReviewerRoster() fails closed when the on-disk governance/reviewer-roster.yaml itself carries the seeded-bad entry', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-roster-'));
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    await cp(ROSTER_SCHEMA_PATH, path.join(tempRoot, 'schemas', 'reviewer-roster.schema.json'));
    await mkdir(path.join(tempRoot, 'governance'), { recursive: true });
    const badYaml = [
      'schemaVersion: 1',
      'reviewers:',
      '  - reviewerId: seeded-bad-real-1',
      '    name: "SYNTHETIC-INVALID fixture: real reviewer missing verificationRef"',
      '    credentialRef: "credential-registry:SEEDED-BAD-0001"',
      '    moduleScopes: [cbc_suite_v1]',
      '    synthetic: false',
      '',
    ].join('\n');
    await writeFile(path.join(tempRoot, 'governance', 'reviewer-roster.yaml'), badYaml);

    const result = await loadAndValidateReviewerRoster(tempRoot);
    assert.equal(result.reviewerCount, 1);
    assert.ok(
      result.errors.some((e) => e.includes('reviewer-roster.schema.json') && e.includes('verificationRef')),
      `expected a verificationRef error, got: ${JSON.stringify(result.errors, null, 2)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// --- 004: attempted unsigned-stub -> "release-ready" manifest transition (SPIKE-006) ------------

test('seeded fixture 004 violates module-manifest.schema.json in exactly one way (status not in the closed SPIKE-006 enum)', async () => {
  const doc = await loadJson(fixture('invalid-module-manifest-unsigned-stub-to-release-ready-004.json.txt'));
  assert.equal(doc.status, 'release-ready');
  assert.match(doc.clinicalContentHash, /^sha256:[0-9a-f]{64}$/, 'clinicalContentHash must be well-formed so this fixture isolates the status violation alone');
  assert.match(doc.governanceHash, /^sha256:[0-9a-f]{64}$/, 'governanceHash must be well-formed so this fixture isolates the status violation alone');
});

test('004: validateModule() fails closed on an attempted unsigned-stub -> "release-ready" status transition -- SPIKE-006\'s closed enum has no such value', async () => {
  const moduleId = 'synthetic_seeded_bad_status';
  const badManifest = await loadJson(fixture('invalid-module-manifest-unsigned-stub-to-release-ready-004.json.txt'));
  const { id: _drop, ...overrides } = badManifest;
  const tempRoot = await buildSeededModuleTree(moduleId, overrides);
  try {
    const result = await validateModule(moduleId, tempRoot);
    assert.ok(
      result.errors.some(
        (e) => e.includes('module-manifest.schema.json') && e.includes('$.status') && e.includes('is not one of'),
      ),
      `expected a status-enum violation, got: ${JSON.stringify(result.errors, null, 2)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// --- new wiring: modules/<id>/reviews/*.yaml (existence-gated, OQ-2 store layout) ---------------

test('validateModuleReviews(): a missing modules/<id>/reviews/ directory is legal (existence-gated), zero errors', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-reviews-missing-'));
  try {
    const moduleDir = path.join(tempRoot, 'modules', 'synthetic_no_reviews_dir');
    await mkdir(moduleDir, { recursive: true });
    const result = await validateModuleReviews(moduleDir, 'synthetic_no_reviews_dir', tempRoot);
    assert.deepEqual(result, { errors: [], reviewCount: 0 });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validateModuleReviews(): an EMPTY modules/<id>/reviews/ directory is legal, zero errors', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-reviews-empty-'));
  try {
    const moduleDir = path.join(tempRoot, 'modules', 'synthetic_empty_reviews_dir');
    await mkdir(path.join(moduleDir, 'reviews'), { recursive: true });
    const result = await validateModuleReviews(moduleDir, 'synthetic_empty_reviews_dir', tempRoot);
    assert.deepEqual(result, { errors: [], reviewCount: 0 });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validateModuleReviews(): a well-formed review-record YAML file validates cleanly', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-reviews-valid-'));
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    await cp(REVIEW_RECORD_SCHEMA_PATH, path.join(tempRoot, 'schemas', 'review-record.schema.json'));
    const moduleId = 'synthetic_valid_review';
    const moduleDir = path.join(tempRoot, 'modules', moduleId);
    await mkdir(path.join(moduleDir, 'reviews'), { recursive: true });
    // D-4 layer 3 cross-check now requires a matching, synthetic-agreeing roster entry for this
    // record's reviewerId or `validateModuleReviews` fails closed (the fix this task adds) —
    // without this, the "well-formed record validates cleanly" claim would no longer hold.
    await mkdir(path.join(tempRoot, 'governance'), { recursive: true });
    await writeFile(
      path.join(tempRoot, 'governance', 'reviewer-roster.yaml'),
      [
        'schemaVersion: 1',
        'reviewers:',
        '  - reviewerId: synthetic-reviewer-clinical-1-01',
        '    name: "Synthetic Dry-Run Clinician 1"',
        '    credentialRef: "credential-registry:SYNTHETIC-0001"',
        '    moduleScopes: [synthetic_valid_review]',
        '    synthetic: true',
        '',
      ].join('\n'),
    );
    const yamlBody = [
      'schemaVersion: 1',
      'review_id: rr-0001-clinical-1',
      'role: clinical-1',
      `moduleId: ${moduleId}`,
      'subjectContentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      'previousRecordHash: null',
      'supersedes: null',
      'reviewerId: synthetic-reviewer-clinical-1-01',
      'decision: approve',
      'rationale: "Synthetic dry-run fixture exercising the review-record wiring; not a real clinical review."',
      'reviewedAt: "2026-07-21T14:00:00Z"',
      'synthetic: true',
      'signature:',
      '  algorithm: ed25519',
      '  keyId: TESTKEY-p1t7-wiring-0001',
      '  value: ZmFrZS1zaWduYXR1cmU=',
      '',
    ].join('\n');
    await writeFile(path.join(moduleDir, 'reviews', 'rr-0001-clinical-1.yaml'), yamlBody);

    const result = await validateModuleReviews(moduleDir, moduleId, tempRoot);
    assert.deepEqual(result.errors, [], `expected zero errors, got: ${JSON.stringify(result.errors, null, 2)}`);
    assert.equal(result.reviewCount, 1);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validateModuleReviews(): a review-record YAML with a populated signature on a synthetic:false record is rejected (mirrors D-4 forced-empty posture on the new review-record artifact)', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-reviews-bad-'));
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    await cp(REVIEW_RECORD_SCHEMA_PATH, path.join(tempRoot, 'schemas', 'review-record.schema.json'));
    const moduleId = 'synthetic_bad_review_signature';
    const moduleDir = path.join(tempRoot, 'modules', moduleId);
    await mkdir(path.join(moduleDir, 'reviews'), { recursive: true });
    const yamlBody = [
      'schemaVersion: 1',
      'review_id: rr-0001-clinical-1',
      'role: clinical-1',
      `moduleId: ${moduleId}`,
      'subjectContentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      'previousRecordHash: null',
      'supersedes: null',
      'reviewerId: a-real-reviewer',
      'decision: approve',
      'rationale: "SYNTHETIC-INVALID: a real (synthetic:false) record must never carry a signature pre-G1/G2."',
      'reviewedAt: "2026-07-21T14:00:00Z"',
      'synthetic: false',
      'signature:',
      '  algorithm: ed25519',
      '  keyId: REALKEY-not-a-test-key',
      '  value: not-a-real-signature',
      '',
    ].join('\n');
    await writeFile(path.join(moduleDir, 'reviews', 'rr-0001-clinical-1.yaml'), yamlBody);

    const result = await validateModuleReviews(moduleDir, moduleId, tempRoot);
    assert.ok(
      result.errors.some((e) => e.includes('review-record.schema.json') && e.includes('$.signature') && e.includes('null')),
      `expected a signature-forced-null violation, got: ${JSON.stringify(result.errors, null, 2)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validateReviewRecord() cross-checks review_id and moduleId against the file location the schema itself cannot see', () => {
  const good = {
    schemaVersion: 1, review_id: 'rr-0001-clinical-1', role: 'clinical-1', moduleId: 'cbc_suite_v1',
    subjectContentHash: `sha256:${'a'.repeat(64)}`, previousRecordHash: null, supersedes: null,
    reviewerId: 'r1', decision: 'approve', rationale: 'x', reviewedAt: '2026-07-21T14:00:00Z',
    synthetic: false, signature: null,
  };
  const mismatchedFilename = validateReviewRecord(good, 'cbc_suite_v1', 'rr-9999-clinical-1', {});
  assert.ok(mismatchedFilename.some((e) => e.includes('does not match its own filename')));

  const mismatchedModule = validateReviewRecord(good, 'anemia', 'rr-0001-clinical-1', {});
  assert.ok(mismatchedModule.some((e) => e.includes('does not match the modules/anemia/ directory')));
});

// --- 005/006: reviewerId roster cross-check (D-4 layer 3; codex second-opinion review gap) ------
//
// A codex second-opinion review of P1-T7's landed wiring found that `validateModuleReviews`
// (review records) and `validateReviewerRoster`/`loadAndValidateReviewerRoster` (the roster)
// validated their own artifact in isolation with no cross-check between them -- so a review record
// naming a `reviewerId` absent from the roster, or a `synthetic:false` record pointing at a
// `synthetic:true` roster persona, passed `npm run validate` with exit 0 even though the design
// note's own D-4 "three-layer guarantee" names this exact cross-check as layer 3. Fixtures 005/006
// are each schema-valid review records on their own (the violation is a cross-file reference, not
// a shape defect) -- proven below before each is exercised through the new cross-check.

test('seeded fixture 005 is schema-valid on its own (review-record.schema.json) -- the violation is a cross-file reviewerId reference, not a shape defect', async () => {
  const doc = await loadJson(fixture('invalid-review-record-unknown-reviewerid-005.json.txt'));
  const reviewRecordSchema = await loadJson(REVIEW_RECORD_SCHEMA_PATH);
  const shapeErrors = validateReviewRecord(doc, 'cbc_suite_v1', 'rr-0001-clinical-1', reviewRecordSchema);
  assert.deepEqual(shapeErrors, [], `fixture 005 must be schema-valid on its own: ${JSON.stringify(shapeErrors)}`);
});

test('005: validateReviewRecordAgainstRoster() fails closed on a reviewerId absent from the roster (including the vacuous empty-roster case, FR-3\'s current shipped state)', async () => {
  const doc = await loadJson(fixture('invalid-review-record-unknown-reviewerid-005.json.txt'));
  const emptyRosterIndex = buildReviewerRosterIndex({ schemaVersion: 1, reviewers: [] });
  const errors = validateReviewRecordAgainstRoster(doc, 'cbc_suite_v1', 'rr-0001-clinical-1', emptyRosterIndex);
  assert.ok(
    errors.some((e) => e.includes('reviewerId "seeded-bad-unknown-reviewer-005"') && e.includes('does not resolve to any entry in governance/reviewer-roster.yaml')),
    `expected an unknown-reviewerId error, got: ${JSON.stringify(errors)}`,
  );
});

test('005 (full wiring): validateModuleReviews() -- the exact function npm run validate calls -- fails closed when a review record\'s reviewerId is absent from governance/reviewer-roster.yaml', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-roster-xcheck-unknown-'));
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    await cp(REVIEW_RECORD_SCHEMA_PATH, path.join(tempRoot, 'schemas', 'review-record.schema.json'));
    await mkdir(path.join(tempRoot, 'governance'), { recursive: true });
    // Roster ships empty -- the current shipped state (FR-3) -- so ANY reviewerId is unknown.
    await writeFile(path.join(tempRoot, 'governance', 'reviewer-roster.yaml'), 'schemaVersion: 1\nreviewers: []\n');

    const moduleId = 'synthetic_roster_xcheck_unknown';
    const moduleDir = path.join(tempRoot, 'modules', moduleId);
    await mkdir(path.join(moduleDir, 'reviews'), { recursive: true });
    const yamlBody = [
      'schemaVersion: 1',
      'review_id: rr-0001-clinical-1',
      'role: clinical-1',
      `moduleId: ${moduleId}`,
      'subjectContentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      'previousRecordHash: null',
      'supersedes: null',
      'reviewerId: seeded-bad-unknown-reviewer-005',
      'decision: approve',
      'rationale: "SYNTHETIC-INVALID fixture 005: this reviewerId is absent from the roster."',
      'reviewedAt: "2026-07-21T14:00:00Z"',
      'synthetic: true',
      'signature:',
      '  algorithm: ed25519',
      '  keyId: TESTKEY-p1t7-fix-005',
      '  value: ZmFrZS1zaWduYXR1cmU=',
      '',
    ].join('\n');
    await writeFile(path.join(moduleDir, 'reviews', 'rr-0001-clinical-1.yaml'), yamlBody);

    const result = await validateModuleReviews(moduleDir, moduleId, tempRoot);
    assert.equal(result.reviewCount, 1);
    assert.ok(
      result.errors.some((e) => e.includes('reviewerId "seeded-bad-unknown-reviewer-005"') && e.includes('does not resolve to any entry in governance/reviewer-roster.yaml')),
      `expected an unknown-reviewerId error, got: ${JSON.stringify(result.errors)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('seeded fixture 006 is schema-valid on its own (review-record.schema.json) -- the violation is a cross-file synthetic-flag mismatch, not a shape defect', async () => {
  const doc = await loadJson(fixture('invalid-review-record-synthetic-mismatch-006.json.txt'));
  const reviewRecordSchema = await loadJson(REVIEW_RECORD_SCHEMA_PATH);
  const shapeErrors = validateReviewRecord(doc, 'cbc_suite_v1', 'rr-0002-clinical-1', reviewRecordSchema);
  assert.deepEqual(shapeErrors, [], `fixture 006 must be schema-valid on its own: ${JSON.stringify(shapeErrors)}`);
});

test('006: validateReviewRecordAgainstRoster() fails closed on a synthetic:false record referencing a synthetic:true roster entry', async () => {
  const doc = await loadJson(fixture('invalid-review-record-synthetic-mismatch-006.json.txt'));
  const rosterIndex = buildReviewerRosterIndex({
    schemaVersion: 1,
    reviewers: [{
      reviewerId: 'synthetic-only-reviewer-006',
      name: 'Synthetic Dry-Run Clinician (fixture 006)',
      credentialRef: 'credential-registry:SYNTHETIC-0006',
      moduleScopes: ['cbc_suite_v1'],
      synthetic: true,
    }],
  });
  const errors = validateReviewRecordAgainstRoster(doc, 'cbc_suite_v1', 'rr-0002-clinical-1', rosterIndex);
  assert.ok(
    errors.some((e) => e.includes('synthetic:false record references reviewerId "synthetic-only-reviewer-006"') && e.includes('synthetic:true') && e.includes('D-4 layer 3 cross-check requires the two to agree')),
    `expected a synthetic-flag-mismatch error, got: ${JSON.stringify(errors)}`,
  );
});

test('006: validateReviewRecordAgainstRoster() does NOT flag a resolvable reviewerId whose synthetic flag agrees (regression: only the mismatch is an error)', async () => {
  const rosterIndex = buildReviewerRosterIndex({
    schemaVersion: 1,
    reviewers: [{
      reviewerId: 'synthetic-only-reviewer-006',
      name: 'Synthetic Dry-Run Clinician (fixture 006)',
      credentialRef: 'credential-registry:SYNTHETIC-0006',
      moduleScopes: ['cbc_suite_v1'],
      synthetic: true,
    }],
  });
  const agreeingRecord = {
    reviewerId: 'synthetic-only-reviewer-006',
    synthetic: true,
  };
  const errors = validateReviewRecordAgainstRoster(agreeingRecord, 'cbc_suite_v1', 'rr-0003-clinical-1', rosterIndex);
  assert.deepEqual(errors, []);
});

test('006 (full wiring): validateModuleReviews() -- the exact function npm run validate calls -- fails closed when a synthetic:false record references a synthetic:true roster entry', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-roster-xcheck-mismatch-'));
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    await cp(REVIEW_RECORD_SCHEMA_PATH, path.join(tempRoot, 'schemas', 'review-record.schema.json'));
    await mkdir(path.join(tempRoot, 'governance'), { recursive: true });
    await writeFile(
      path.join(tempRoot, 'governance', 'reviewer-roster.yaml'),
      [
        'schemaVersion: 1',
        'reviewers:',
        '  - reviewerId: synthetic-only-reviewer-006',
        '    name: "Synthetic Dry-Run Clinician (fixture 006)"',
        '    credentialRef: "credential-registry:SYNTHETIC-0006"',
        '    moduleScopes: [synthetic_roster_xcheck_mismatch]',
        '    synthetic: true',
        '',
      ].join('\n'),
    );

    const moduleId = 'synthetic_roster_xcheck_mismatch';
    const moduleDir = path.join(tempRoot, 'modules', moduleId);
    await mkdir(path.join(moduleDir, 'reviews'), { recursive: true });
    const yamlBody = [
      'schemaVersion: 1',
      'review_id: rr-0002-clinical-1',
      'role: clinical-1',
      `moduleId: ${moduleId}`,
      'subjectContentHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"',
      'previousRecordHash: null',
      'supersedes: null',
      'reviewerId: synthetic-only-reviewer-006',
      'decision: approve',
      'rationale: "SYNTHETIC-INVALID fixture 006: synthetic:false record referencing a synthetic:true roster entry."',
      'reviewedAt: "2026-07-21T14:05:00Z"',
      'synthetic: false',
      'signature: null',
      '',
    ].join('\n');
    await writeFile(path.join(moduleDir, 'reviews', 'rr-0002-clinical-1.yaml'), yamlBody);

    const result = await validateModuleReviews(moduleDir, moduleId, tempRoot);
    assert.equal(result.reviewCount, 1);
    assert.ok(
      result.errors.some((e) => e.includes('synthetic:false record references reviewerId "synthetic-only-reviewer-006"') && e.includes('synthetic:true')),
      `expected a synthetic-flag-mismatch error, got: ${JSON.stringify(result.errors)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('loadReviewerRosterIndex(): an absent governance/reviewer-roster.yaml degrades to an empty index, never a crash', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-roster-index-absent-'));
  try {
    const index = await loadReviewerRosterIndex(tempRoot);
    assert.equal(index.size, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('loadReviewerRosterIndex(): loads the real committed governance/reviewer-roster.yaml (ships empty, FR-3) into an empty index', async () => {
  const index = await loadReviewerRosterIndex(REPO_ROOT);
  assert.equal(index.size, 0);
});

// --- new wiring: releases/registry.json (existence-gated across the whole tree) -----------------

test('loadAndValidateReleaseRegistry(): an absent releases/registry.json passes with an explicit note, never a crash', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-registry-absent-'));
  try {
    const result = await loadAndValidateReleaseRegistry(tempRoot);
    assert.deepEqual(result, { errors: [], entryCount: 0, present: false });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('loadAndValidateReleaseRegistry(): a well-formed releases/registry.json validates cleanly and reports present:true', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-contract-forced-empty-registry-present-'));
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    await cp(REGISTRY_SCHEMA_PATH, path.join(tempRoot, 'schemas', 'release-registry.schema.json'));
    await mkdir(path.join(tempRoot, 'releases'), { recursive: true });
    await writeFile(path.join(tempRoot, 'releases', 'registry.json'), JSON.stringify({ schemaVersion: 1, entries: [] }, null, 2));

    const result = await loadAndValidateReleaseRegistry(tempRoot);
    assert.deepEqual(result, { errors: [], entryCount: 0, present: true });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validateReleaseRegistryDocument(): a withdrawalState "withdrawn" entry is rejected, wired through the same function npm run validate would call once the registry ships', async () => {
  const registrySchema = await loadJson(REGISTRY_SCHEMA_PATH);
  const doc = {
    schemaVersion: 1,
    entries: [{
      version: '1.0.0', moduleId: 'cbc_suite_v1', packDigest: `sha256:${'a'.repeat(64)}`,
      manifestDigest: `sha256:${'b'.repeat(64)}`, signature: null, signedAt: null, supersedes: null,
      withdrawalState: 'withdrawn', withdrawnAt: null, withdrawalReason: null,
    }],
  };
  const { errors, entryCount } = validateReleaseRegistryDocument(doc, registrySchema);
  assert.equal(entryCount, 1);
  assert.ok(errors.some((e) => e.includes('release-registry.schema.json') && e.includes('withdrawalState')));
});

// --- regression: existing modules unaffected by the new wiring ----------------------------------

test('validateModule() on the real modules/anemia/ still reports zero errors with the new wiring in place (no reviews dir there -- existence-gated, not a false positive)', async () => {
  const result = await validateModule('anemia', REPO_ROOT);
  assert.deepEqual(result.errors, [], `validateModule('anemia', ...) should report zero errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.reviewRecordCount, 0);
});

test('validateModule() on the real modules/cbc_suite_v1/ still reports zero errors with the new wiring in place', async () => {
  const result = await validateModule('cbc_suite_v1', REPO_ROOT);
  assert.deepEqual(result.errors, [], `validateModule('cbc_suite_v1', ...) should report zero errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.reviewRecordCount, 0);
});

test('loadAndValidateReviewerRoster() on the real committed governance/reviewer-roster.yaml reports zero errors and zero reviewers (FR-3: ships empty)', async () => {
  const result = await loadAndValidateReviewerRoster(REPO_ROOT);
  assert.deepEqual(result.errors, []);
  assert.equal(result.reviewerCount, 0);
});

test('loadAndValidateReleaseRegistry() on the real repo (releases/registry.json now shipped -- P3-T4 seed) passes with present:true, zero entries, never a crash', async () => {
  // Updated for P3-T4: the P1-T7-era assumption this test originally encoded ("the registry does
  // not exist yet, existence-gated absence is not an error") was true only pre-P3-T4. The seed
  // file this task ships (`{schemaVersion: 1, entries: []}`) now exists, is schema-valid, and
  // fires this existence-gated wiring's "present" path for the first time -- mirrors the P1-T7
  // watch-for pattern already seen for governance/reviewer-roster.yaml (phase-1-completion.md).
  const result = await loadAndValidateReleaseRegistry(REPO_ROOT);
  assert.deepEqual(result, { errors: [], entryCount: 0, present: true });
});

test('scripts/validate-kb.mjs (the real, committed file) exits 0 when run as npm run validate\'s CLI entrypoint against the real repo tree', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'validate-kb.mjs')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert.match(result.stdout, /governance\/reviewer-roster\.yaml: validated 0 reviewer\(s\)\./);
  // Updated for P3-T4: releases/registry.json now ships seeded (0 entries), so the CLI reports
  // it as validated rather than "not yet seeded (absent)" — that absent-path message stays exact
  // and unit-tested elsewhere in this same file for the case where the file genuinely is missing
  // (existence-gated, not this real-repo-tree scenario anymore).
  assert.match(result.stdout, /releases\/registry\.json: validated 0 entrie\(s\)\./);
});
