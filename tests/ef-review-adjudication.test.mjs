// tests/ef-review-adjudication.test.mjs — P2-T4 (Evidence Foundry E1 Phase 2, PRD OQ-5/FR-5/FR-6).
//
// Covers this task's own acceptance criteria
// (docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-2-4-workstreams.md,
// row P2-T4):
//   - Authorship-union computed correctly for the cbc_suite_v1 fixture pack (both sources
//     represented) — exercised against the REAL, already-committed modules/cbc_suite_v1 package
//     and its real git history (no fixture needed; see "authorship union — cbc_suite_v1" below).
//   - Both seeded violations rejected: (a) adjudicator = an authorship-union identity; (b) a
//     release-auth record over a chain containing any synthetic:true record.
//   - A test proves no code path in this tool can set release-ready or populate
//     approvedBy[]/clinicalApprovers[] (structural).
//
// Every dynamically-constructed git fixture in this file lives under a throwaway `mkdtemp`
// directory, entirely outside the real repo tree — `git init`'d there directly, so nothing here
// touches this repo's own commit history or its real `modules/`/`governance/` trees.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AUTHORSHIP_SOURCE_AUTHORING_DECISIONS,
  AUTHORSHIP_SOURCE_GIT_COMMIT_AUTHOR,
  computeAuthorshipUnion,
  evaluateReleaseAuthorization,
  isAdjudicationRequired,
  resolveEffectiveRoleRecord,
  rosterEntryInAuthorshipUnion,
} from '../tools/review-record/lib/adjudication.mjs';
import { canonicalRecordHash } from '../tools/review-record/lib/chain.mjs';
import { computeDerivedReviewState } from '../tools/review-record/lib/derived-state.mjs';
import { checkReviewerIndependence } from '../tools/review-record/lib/independence.mjs';
import { signRecordDryRun } from '../tools/review-record/lib/signature.mjs';
import { run as runValidate } from '../tools/review-record/lib/verbs/validate.mjs';
import { isExpectedTerminalNonQualifyingViolations } from '../tools/review-record/lib/verbs/dry-run.mjs';
import { ValidationFailedError } from '../tools/review-record/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL_ROOT = path.join(REPO_ROOT, 'tools', 'review-record');

const SUBJECT_HASH = 'sha256:537d2dcf29f8e2871a4b91129ec3da3d0012d48ee90af0784ea8c93db7398c6d';

/**
 * P2-T5: `validate` now cryptographically verifies every present signature (FR-10/OQ-2) and fails
 * closed on a mismatch (tamper detection) -- so any hand-authored YAML fixture below whose
 * `validate` outcome this file asserts as a HAPPY path needs a REAL, verifiable Ed25519 dry-run
 * signature, not an opaque stub value. Builds the exact record object the hand-authored YAML lines
 * below represent, signs it via `lib/signature.mjs`'s `signRecordDryRun`, and returns the 4 YAML
 * lines (`signature:` block) to splice into the fixture's hand-written line array -- so the fixture
 * text and the signed bytes can never silently drift apart.
 *
 * @param {object} recordWithoutSignature every review-record field except `signature`
 * @returns {string[]} `['signature:', '  algorithm: ed25519', '  keyId: TESTKEY-...', '  value: "..."']`
 */
function realSignatureYamlLines(recordWithoutSignature) {
  const { signature: signed } = signRecordDryRun({ ...recordWithoutSignature, signature: null });
  return ['signature:', '  algorithm: ed25519', `  keyId: ${signed.keyId}`, `  value: "${signed.value}"`];
}

// -------------------------------------------------------------------------------------------
// Temp-git-repo test helper — full control over commit authorship, isolated from this repo.
// -------------------------------------------------------------------------------------------

async function makeGitFixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'ef-adjudication-git-'));
  const git = (args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'ignore', 'ignore'] });
  git(['init', '--quiet']);
  git(['config', 'user.email', 'test-fixture-committer@example.test']);
  git(['config', 'user.name', 'Test Fixture Committer']);
  git(['config', 'commit.gpgsign', 'false']);
  return {
    dir,
    async commitFile(relPath, content, authorName, authorEmail, message) {
      const fullPath = path.join(dir, relPath);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, 'utf8');
      git(['add', relPath]);
      git(['commit', '--quiet', '--author', `${authorName} <${authorEmail}>`, '-m', message]);
    },
  };
}

async function cleanup(dir) {
  await rm(dir, { recursive: true, force: true });
}

// -------------------------------------------------------------------------------------------
// computeAuthorshipUnion — authorship union (unit-level, isolated git fixtures)
// -------------------------------------------------------------------------------------------

test('computeAuthorshipUnion unions two DIFFERENT identities from source (a) (authoring-decisions.yaml git history) and source (b) (module.json-introducing commit), both sources represented', async () => {
  const fixture = await makeGitFixture();
  try {
    await fixture.commitFile(
      'modules/union_target_v1/authoring-decisions.yaml',
      'schemaVersion: "1.0"\nmoduleId: union_target_v1\ndecisions: []\n',
      'Alice Author',
      'alice@example.test',
      'add authoring-decisions.yaml',
    );
    await fixture.commitFile(
      'modules/union_target_v1/module.json',
      '{"id":"union_target_v1"}\n',
      'Bob Builder',
      'bob@example.test',
      'add module.json',
    );

    const union = computeAuthorshipUnion(fixture.dir, 'union_target_v1');
    assert.equal(union.incomplete, false);
    assert.deepEqual(union.sources, [AUTHORSHIP_SOURCE_AUTHORING_DECISIONS, AUTHORSHIP_SOURCE_GIT_COMMIT_AUTHOR]);
    assert.deepEqual(union.authors, ['Alice Author <alice@example.test>', 'Bob Builder <bob@example.test>']);
  } finally {
    await cleanup(fixture.dir);
  }
});

test('computeAuthorshipUnion dedupes when both sources resolve to the same identity', async () => {
  const fixture = await makeGitFixture();
  try {
    await fixture.commitFile(
      'modules/same_author_v1/authoring-decisions.yaml',
      'schemaVersion: "1.0"\nmoduleId: same_author_v1\ndecisions: []\n',
      'Carol Committer',
      'carol@example.test',
      'add authoring-decisions.yaml',
    );
    await fixture.commitFile(
      'modules/same_author_v1/module.json',
      '{"id":"same_author_v1"}\n',
      'Carol Committer',
      'carol@example.test',
      'add module.json',
    );

    const union = computeAuthorshipUnion(fixture.dir, 'same_author_v1');
    assert.deepEqual(union.authors, ['Carol Committer <carol@example.test>']);
    assert.equal(union.incomplete, false);
  } finally {
    await cleanup(fixture.dir);
  }
});

test('computeAuthorshipUnion excludes a non-human/converter-shaped git author name (the converter is never an identity)', async () => {
  const fixture = await makeGitFixture();
  try {
    await fixture.commitFile(
      'modules/bot_author_v1/authoring-decisions.yaml',
      'schemaVersion: "1.0"\nmoduleId: bot_author_v1\ndecisions: []\n',
      'kb-pack-converter-bot',
      'converter-bot@example.test',
      'add authoring-decisions.yaml',
    );
    await fixture.commitFile(
      'modules/bot_author_v1/module.json',
      '{"id":"bot_author_v1"}\n',
      'Dana Developer',
      'dana@example.test',
      'add module.json',
    );

    const union = computeAuthorshipUnion(fixture.dir, 'bot_author_v1');
    assert.deepEqual(union.authors, ['Dana Developer <dana@example.test>']);
    assert.ok(union.notes.some((n) => n.includes('non-human/converter/automation denylist')));
  } finally {
    await cleanup(fixture.dir);
  }
});

test('computeAuthorshipUnion is incomplete (fail-closed marker) when no commit introduced module.json', async () => {
  const fixture = await makeGitFixture();
  try {
    await fixture.commitFile(
      'modules/no_manifest_v1/authoring-decisions.yaml',
      'schemaVersion: "1.0"\nmoduleId: no_manifest_v1\ndecisions: []\n',
      'Eve Editor',
      'eve@example.test',
      'add authoring-decisions.yaml',
    );

    const union = computeAuthorshipUnion(fixture.dir, 'no_manifest_v1');
    assert.equal(union.incomplete, true);
    assert.ok(union.notes.some((n) => n.includes('could not be determined')));
  } finally {
    await cleanup(fixture.dir);
  }
});

test('computeAuthorshipUnion returns incomplete:true, empty authors, for a rootDir outside any git working tree', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ef-adjudication-nogit-'));
  try {
    const union = computeAuthorshipUnion(dir, 'whatever_v1');
    assert.equal(union.incomplete, true);
    assert.deepEqual(union.authors, []);
  } finally {
    await cleanup(dir);
  }
});

test('computeAuthorshipUnion is not itself incomplete just because authoring-decisions.yaml is absent (existence-gated, source (a) contributes zero identities, not an error)', async () => {
  const fixture = await makeGitFixture();
  try {
    await fixture.commitFile(
      'modules/no_decisions_v1/module.json',
      '{"id":"no_decisions_v1"}\n',
      'Frank Founder',
      'frank@example.test',
      'add module.json',
    );

    const union = computeAuthorshipUnion(fixture.dir, 'no_decisions_v1');
    assert.equal(union.incomplete, false);
    assert.deepEqual(union.authors, ['Frank Founder <frank@example.test>']);
  } finally {
    await cleanup(fixture.dir);
  }
});

test('authorship union computed correctly for the REAL cbc_suite_v1 module package (both sources represented, real git history)', () => {
  const union = computeAuthorshipUnion(REPO_ROOT, 'cbc_suite_v1');
  assert.equal(union.incomplete, false);
  assert.deepEqual(union.sources, [AUTHORSHIP_SOURCE_AUTHORING_DECISIONS, AUTHORSHIP_SOURCE_GIT_COMMIT_AUTHOR]);
  assert.ok(union.authors.length >= 1, 'expected at least one real identity in the authorship union');
  assert.ok(
    union.authors.some((a) => a.startsWith('Nick Miethe <')),
    `expected the known cbc_suite_v1-introducing commit author in the union, got ${JSON.stringify(union.authors)}`,
  );
});

// -------------------------------------------------------------------------------------------
// rosterEntryInAuthorshipUnion — name-based heuristic membership check (pure, no I/O)
// -------------------------------------------------------------------------------------------

test('rosterEntryInAuthorshipUnion matches a roster entry name against a union author (case-insensitive)', () => {
  const authorship = { authors: ['Alice Author <alice@example.test>'] };
  assert.equal(rosterEntryInAuthorshipUnion({ name: 'alice author' }, authorship), true);
  assert.equal(rosterEntryInAuthorshipUnion({ name: 'Someone Else' }, authorship), false);
  assert.equal(rosterEntryInAuthorshipUnion({}, authorship), false);
});

// -------------------------------------------------------------------------------------------
// evaluateReleaseAuthorization — FR-6 (pure, no I/O)
// -------------------------------------------------------------------------------------------

function buildFiveRoleChain({ synthetic }) {
  // Ascending-seq five-role chain, correctly hash-linked, all sharing SUBJECT_HASH. `synthetic` is
  // either a single boolean applied to all five, or a per-role override object.
  const roles = ['clinical-1', 'clinical-2', 'lab', 'adjudication', 'release-auth'];
  const records = [];
  let previous = null;
  roles.forEach((role, i) => {
    const isSynthetic = typeof synthetic === 'object' ? synthetic[role] : synthetic;
    const record = {
      schemaVersion: 1,
      review_id: `rr-000${i + 1}-${role}`,
      role,
      moduleId: 'release_target_v1',
      subjectContentHash: SUBJECT_HASH,
      previousRecordHash: previous === null ? null : canonicalRecordHash(previous),
      supersedes: null,
      reviewerId: `fixture-${role}`,
      decision: 'approve',
      rationale: `Fixture rationale for role ${role}.`,
      reviewedAt: '2026-02-01T00:00:00Z',
      synthetic: isSynthetic,
      signature: isSynthetic
        ? { algorithm: 'ed25519', keyId: `TESTKEY-${role}`, value: 'c3R1Yg==' }
        : null,
    };
    records.push({ reviewId: record.review_id, seq: i + 1, role, record });
    previous = record;
  });
  return records;
}

test('evaluateReleaseAuthorization qualifies (zero violations) over a complete, chain-valid, roster-verified, fully non-synthetic set', () => {
  const records = buildFiveRoleChain({ synthetic: false });
  const rosterVerified = new Map(records.map((r) => [r.reviewId, true]));
  const releaseAuth = records.find((r) => r.role === 'release-auth');
  const violations = evaluateReleaseAuthorization(records, releaseAuth, rosterVerified);
  assert.deepEqual(violations, []);
});

test('evaluateReleaseAuthorization rejects a set containing ANY synthetic:true record — seeded violation', () => {
  const records = buildFiveRoleChain({
    synthetic: { 'clinical-1': false, 'clinical-2': false, lab: true, adjudication: false, 'release-auth': false },
  });
  const rosterVerified = new Map(records.map((r) => [r.reviewId, true]));
  const releaseAuth = records.find((r) => r.role === 'release-auth');
  const violations = evaluateReleaseAuthorization(records, releaseAuth, rosterVerified);
  assert.ok(violations.length >= 1);
  assert.ok(violations.some((v) => v.includes('synthetic:true') && v.includes('rr-0003-lab')));
});

test('evaluateReleaseAuthorization rejects an all-synthetic:true dry-run-shaped set too (the common real case pre-G1)', () => {
  const records = buildFiveRoleChain({ synthetic: true });
  const rosterVerified = new Map(records.map((r) => [r.reviewId, true]));
  const releaseAuth = records.find((r) => r.role === 'release-auth');
  const violations = evaluateReleaseAuthorization(records, releaseAuth, rosterVerified);
  assert.ok(violations.some((v) => v.includes('synthetic:true')));
});

test('evaluateReleaseAuthorization rejects an incomplete record set (missing role)', () => {
  const records = buildFiveRoleChain({ synthetic: false }).filter((r) => r.role !== 'lab');
  const rosterVerified = new Map(records.map((r) => [r.reviewId, true]));
  const releaseAuth = records.find((r) => r.role === 'release-auth');
  const violations = evaluateReleaseAuthorization(records, releaseAuth, rosterVerified);
  assert.ok(violations.some((v) => v.includes('incomplete record set') && v.includes('lab')));
});

test('evaluateReleaseAuthorization rejects a broken chain', () => {
  const records = buildFiveRoleChain({ synthetic: false });
  records[2] = { ...records[2], record: { ...records[2].record, previousRecordHash: 'sha256:' + 'ab'.repeat(32) } };
  const rosterVerified = new Map(records.map((r) => [r.reviewId, true]));
  const releaseAuth = records.find((r) => r.role === 'release-auth');
  const violations = evaluateReleaseAuthorization(records, releaseAuth, rosterVerified);
  assert.ok(violations.some((v) => v.includes('chain')));
});

test('evaluateReleaseAuthorization rejects an unverified reviewerId', () => {
  const records = buildFiveRoleChain({ synthetic: false });
  const rosterVerified = new Map(records.map((r) => [r.reviewId, true]));
  rosterVerified.set('rr-0004-adjudication', false);
  const releaseAuth = records.find((r) => r.role === 'release-auth');
  const violations = evaluateReleaseAuthorization(records, releaseAuth, rosterVerified);
  assert.ok(violations.some((v) => v.includes('roster-verified') && v.includes('rr-0004-adjudication')));
});

// -------------------------------------------------------------------------------------------
// FR-26 adjudication conditional-completeness (P1-T5, governance-sensitive, ADR-0004 decision
// item 5) -- `resolveEffectiveRoleRecord` / `isAdjudicationRequired` (pure, no I/O),
// `evaluateReleaseAuthorization`'s conditional role-set, and the shared `computeDerivedReviewState`
// consumer (F2: single source of truth -- `validate` and any future `status` consumer must never
// see a forked copy of this policy).
// -------------------------------------------------------------------------------------------

const FR26_SUBJECT_HASH = `sha256:${'11'.repeat(32)}`;

/**
 * Builds an ascending-seq, correctly hash-linked module record set from a flat list of
 * `{ role, decision, supersedes? }` specs -- unlike `buildFiveRoleChain` above (fixed five roles,
 * one each), this allows an arbitrary role sequence, including a role appearing more than once
 * (e.g. a `clinical-1` correction), so FR-26's supersedes-aware effective-record fixtures can be
 * built directly rather than by post-hoc splicing a five-role chain (which would break the hash
 * chain linking every record to its immediate predecessor).
 *
 * @param {{ role: string, decision: string, supersedes?: string, rationale?: string }[]} specs
 *   `rationale` is optional -- defaults to an auto-generated, deliberately non-overlapping fixture
 *   string; CRW-F4's independence fixtures below override it per-record so they can seed a
 *   controlled verbatim-substring overlap (or its absence) between specific records.
 * @returns {{ reviewId: string, seq: number, role: string, record: object }[]}
 */
function buildRecordSequence(specs) {
  const records = [];
  let previous = null;
  specs.forEach((spec, i) => {
    const seq = i + 1;
    const reviewId = `rr-${String(seq).padStart(4, '0')}-${spec.role}`;
    const record = {
      schemaVersion: 1,
      review_id: reviewId,
      role: spec.role,
      moduleId: 'fr26_target_v1',
      subjectContentHash: FR26_SUBJECT_HASH,
      previousRecordHash: previous === null ? null : canonicalRecordHash(previous),
      supersedes: spec.supersedes ?? null,
      reviewerId: `fixture-${spec.role}-${seq}`,
      decision: spec.decision,
      rationale: spec.rationale ?? `Fixture rationale for role ${spec.role}, seq ${seq}.`,
      reviewedAt: '2026-02-01T00:00:00Z',
      synthetic: false,
      signature: null,
    };
    records.push({ reviewId, seq, role: spec.role, record });
    previous = record;
  });
  return records;
}

/** @param {{ reviewId: string }[]} records @returns {Map<string, boolean>} every reviewId -> true */
function allRosterVerified(records) {
  return new Map(records.map((r) => [r.reviewId, true]));
}

test('resolveEffectiveRoleRecord returns the sole record for a role with no correction', () => {
  const records = buildRecordSequence([
    { role: 'clinical-1', decision: 'approve' },
    { role: 'clinical-2', decision: 'approve' },
  ]);
  const effective = resolveEffectiveRoleRecord(records, 'clinical-1');
  assert.equal(effective.reviewId, 'rr-0001-clinical-1');
});

test('resolveEffectiveRoleRecord returns the correcting record, never the superseded original, once a role is corrected', () => {
  const records = buildRecordSequence([
    { role: 'clinical-1', decision: 'reject' },
    { role: 'clinical-1', decision: 'approve', supersedes: 'rr-0001-clinical-1' },
    { role: 'clinical-2', decision: 'approve' },
  ]);
  const effective = resolveEffectiveRoleRecord(records, 'clinical-1');
  assert.equal(effective.reviewId, 'rr-0002-clinical-1');
  assert.equal(effective.record.decision, 'approve');
});

test('resolveEffectiveRoleRecord returns undefined when no record of the role exists in the set', () => {
  const records = buildRecordSequence([{ role: 'clinical-1', decision: 'approve' }]);
  assert.equal(resolveEffectiveRoleRecord(records, 'clinical-2'), undefined);
});

test('isAdjudicationRequired is false (agree path) when the resolved clinical-1/clinical-2 decisions agree', () => {
  const records = buildRecordSequence([
    { role: 'clinical-1', decision: 'approve' },
    { role: 'clinical-2', decision: 'approve' },
  ]);
  assert.equal(isAdjudicationRequired(records), false);
});

test('isAdjudicationRequired is true (disagree path) when the resolved clinical-1/clinical-2 decisions disagree', () => {
  const records = buildRecordSequence([
    { role: 'clinical-1', decision: 'approve' },
    { role: 'clinical-2', decision: 'reject' },
  ]);
  assert.equal(isAdjudicationRequired(records), true);
});

test('isAdjudicationRequired fails closed (true) when clinical-1 or clinical-2 is entirely missing from the set', () => {
  const records = buildRecordSequence([{ role: 'clinical-1', decision: 'approve' }]);
  assert.equal(isAdjudicationRequired(records), true);
});

test('isAdjudicationRequired resolves the EFFECTIVE (post-correction) clinical-1 decision, not the superseded original -- FR-26 effective-act rule', () => {
  // clinical-1's ORIGINAL decision (reject) disagrees with clinical-2 (approve); the CORRECTION
  // (approve) agrees. The superseded original must never re-enter the agree/disagree predicate.
  const records = buildRecordSequence([
    { role: 'clinical-1', decision: 'reject' },
    { role: 'clinical-1', decision: 'approve', supersedes: 'rr-0001-clinical-1' },
    { role: 'clinical-2', decision: 'approve' },
  ]);
  assert.equal(isAdjudicationRequired(records), false);
});

test('evaluateReleaseAuthorization: agree-path five-record set MINUS adjudication evaluates as complete (no missing-role blocker) -- FR-26', () => {
  const records = buildRecordSequence([
    { role: 'clinical-1', decision: 'approve' },
    { role: 'clinical-2', decision: 'approve' },
    { role: 'lab', decision: 'approve' },
    { role: 'release-auth', decision: 'approve' },
  ]);
  const rosterVerified = allRosterVerified(records);
  const releaseAuth = records.find((r) => r.role === 'release-auth');
  const violations = evaluateReleaseAuthorization(records, releaseAuth, rosterVerified);
  assert.ok(
    !violations.some((v) => v.includes('incomplete record set')),
    `expected no incomplete-record-set violation on the agree path, got: ${JSON.stringify(violations)}`,
  );
});

test('evaluateReleaseAuthorization: disagree-path set MINUS adjudication reports the adjudication-missing blocker -- FR-26', () => {
  const records = buildRecordSequence([
    { role: 'clinical-1', decision: 'approve' },
    { role: 'clinical-2', decision: 'reject' },
    { role: 'lab', decision: 'approve' },
    { role: 'release-auth', decision: 'approve' },
  ]);
  const rosterVerified = allRosterVerified(records);
  const releaseAuth = records.find((r) => r.role === 'release-auth');
  const violations = evaluateReleaseAuthorization(records, releaseAuth, rosterVerified);
  assert.ok(
    violations.some((v) => v.includes('incomplete record set') && v.includes('adjudication')),
    `expected an adjudication-missing violation on the disagree path, got: ${JSON.stringify(violations)}`,
  );
});

test('evaluateReleaseAuthorization: a superseded-correction fixture applies FR-26\'s predicate to the EFFECTIVE (latest non-superseded) records only -- the superseded clinical-1 decision must not trigger a spurious adjudication requirement', () => {
  const records = buildRecordSequence([
    { role: 'clinical-1', decision: 'reject' }, // superseded original -- disagreed with clinical-2
    { role: 'clinical-1', decision: 'approve', supersedes: 'rr-0001-clinical-1' }, // correction -- now agrees
    { role: 'clinical-2', decision: 'approve' },
    { role: 'lab', decision: 'approve' },
    { role: 'release-auth', decision: 'approve' },
  ]);
  const rosterVerified = allRosterVerified(records);
  const releaseAuth = records.find((r) => r.role === 'release-auth');
  const violations = evaluateReleaseAuthorization(records, releaseAuth, rosterVerified);
  assert.ok(
    !violations.some((v) => v.includes('incomplete record set')),
    'expected no incomplete-record-set violation once the superseded clinical-1 record is excluded ' +
      `from the agree/disagree predicate, got: ${JSON.stringify(violations)}`,
  );
});

test('computeDerivedReviewState: agree-path set MINUS adjudication produces zero adjudication-missing blockers (single derived-state consumer, F2)', () => {
  const records = buildRecordSequence([
    { role: 'clinical-1', decision: 'approve' },
    { role: 'clinical-2', decision: 'approve' },
    { role: 'lab', decision: 'approve' },
    { role: 'release-auth', decision: 'approve' },
  ]);
  const { blockers } = computeDerivedReviewState(records, allRosterVerified(records), {});
  assert.ok(
    !blockers.some((b) => b.includes('incomplete record set')),
    `expected no incomplete-record-set blocker, got: ${JSON.stringify(blockers)}`,
  );
});

test('computeDerivedReviewState: disagree-path set MINUS adjudication reports the adjudication-missing blocker (single derived-state consumer, F2)', () => {
  const records = buildRecordSequence([
    { role: 'clinical-1', decision: 'approve' },
    { role: 'clinical-2', decision: 'reject' },
    { role: 'lab', decision: 'approve' },
    { role: 'release-auth', decision: 'approve' },
  ]);
  const { blockers } = computeDerivedReviewState(records, allRosterVerified(records), {});
  assert.ok(
    blockers.some((b) => b.includes('incomplete record set') && b.includes('adjudication')),
    `expected an adjudication-missing blocker, got: ${JSON.stringify(blockers)}`,
  );
});

// -------------------------------------------------------------------------------------------
// CRW-F4 (P1-GATE2 finding 3, MAJOR): `computeDerivedReviewState`'s FR-4 independence check used
// to resolve its clinical-1/clinical-2 pair via a plain `allModuleRecords.find(...)` -- the FIRST
// record of that role, never the FR-26 supersedes-aware EFFECTIVE (latest non-superseded) act
// `resolveEffectiveRoleRecord` already resolves for the release-authorization completeness check
// above. Fixed by reusing `resolveEffectiveRoleRecord` for the independence check too (see
// `lib/derived-state.mjs`'s updated comment). Both failure directions, adversarially:
//   (a) a superseded clinical-1 ORIGINAL is independence-clean, but its EFFECTIVE correction
//       verbatim-overlaps clinical-2's rationale -- must now be FLAGGED (previously a false
//       negative: the violation lived only in the correction, which the old `.find()` never saw).
//   (b) a superseded clinical-1 ORIGINAL verbatim-overlaps clinical-2's rationale, but its
//       EFFECTIVE correction is independence-clean -- must now be CLEAN (previously a false
//       `invalid`/wrong derived state: the old `.find()` kept flagging the stale, already-corrected
//       violation forever).
// -------------------------------------------------------------------------------------------

const CRW_F4_OVERLAP_TEXT =
  'abnormal reticulocyte response was overlooked during the initial pass through the labs';

test('computeDerivedReviewState (CRW-F4, direction a): a clean superseded clinical-1 ORIGINAL passes independence in isolation, but the EFFECTIVE clinical-1 correction verbatim-overlaps clinical-2 -- must now be flagged', () => {
  const records = buildRecordSequence([
    {
      role: 'clinical-1',
      decision: 'reject',
      rationale:
        'Initial independent impression: findings are most consistent with a microcytic anemia given the ferritin and iron panel drawn at intake.',
    },
    {
      role: 'clinical-1',
      decision: 'approve',
      supersedes: 'rr-0001-clinical-1',
      rationale: `Correcting my initial read after further thought: ${CRW_F4_OVERLAP_TEXT}; revising to approve.`,
    },
    {
      role: 'clinical-2',
      decision: 'approve',
      rationale: `Reviewer 2 independently found that ${CRW_F4_OVERLAP_TEXT}; recommend proceeding.`,
    },
  ]);

  const originalClinical1 = records.find((r) => r.reviewId === 'rr-0001-clinical-1');
  const correctionClinical1 = records.find((r) => r.reviewId === 'rr-0002-clinical-1');
  const clinical2 = records.find((r) => r.role === 'clinical-2');

  // Sanity check on the bug itself: the stale (superseded) original, taken in isolation, is
  // independence-clean -- confirming any violation below can only come from resolving the
  // EFFECTIVE act, not from accidentally still comparing the original.
  assert.deepEqual(
    checkReviewerIndependence(originalClinical1.record, clinical2.record),
    [],
    'expected the superseded clinical-1 ORIGINAL to be independence-clean in isolation',
  );
  // And the EFFECTIVE correction, compared directly, DOES violate -- this is the fixture's seeded
  // violation; the assertion below on computeDerivedReviewState proves the shared library actually
  // finds it once resolved via resolveEffectiveRoleRecord, not just that checkReviewerIndependence
  // itself can detect verbatim overlap.
  assert.ok(
    checkReviewerIndependence(correctionClinical1.record, clinical2.record).length > 0,
    'expected the EFFECTIVE clinical-1 correction to violate independence against clinical-2',
  );

  const { blockers } = computeDerivedReviewState(records, allRosterVerified(records), {});
  assert.ok(
    blockers.some((b) => b.includes('reviewer-2 independence')),
    `expected an independence blocker sourced from the EFFECTIVE clinical-1 correction, got: ${JSON.stringify(blockers)}`,
  );
});

test('computeDerivedReviewState (CRW-F4, direction b): a superseded clinical-1 ORIGINAL violates independence in isolation, but the EFFECTIVE clinical-1 correction is clean -- must now be clean (no stale-violation blocker)', () => {
  const records = buildRecordSequence([
    {
      role: 'clinical-1',
      decision: 'reject',
      rationale: `Initial impression: ${CRW_F4_OVERLAP_TEXT}; recommend rejecting pending further workup.`,
    },
    {
      role: 'clinical-1',
      decision: 'approve',
      supersedes: 'rr-0001-clinical-1',
      rationale:
        'Correction after independent re-review of the primary labs: findings support a normocytic anemia; approving without reference to any other reviewer\'s notes.',
    },
    {
      role: 'clinical-2',
      decision: 'approve',
      rationale: `Reviewer 2 independently found that ${CRW_F4_OVERLAP_TEXT}; recommend approval.`,
    },
  ]);

  const originalClinical1 = records.find((r) => r.reviewId === 'rr-0001-clinical-1');
  const correctionClinical1 = records.find((r) => r.reviewId === 'rr-0002-clinical-1');
  const clinical2 = records.find((r) => r.role === 'clinical-2');

  // Sanity check: the stale (superseded) original DOES violate independence in isolation -- this is
  // the exact shape that used to produce a false blocker/`invalid` derived state forever, since the
  // old `.find()` always picked this original (seq 1) over the later correction (seq 2).
  assert.ok(
    checkReviewerIndependence(originalClinical1.record, clinical2.record).length > 0,
    'expected the superseded clinical-1 ORIGINAL to violate independence against clinical-2',
  );
  // And the EFFECTIVE correction, compared directly, is clean.
  assert.deepEqual(
    checkReviewerIndependence(correctionClinical1.record, clinical2.record),
    [],
    'expected the EFFECTIVE clinical-1 correction to be independence-clean against clinical-2',
  );

  const { blockers } = computeDerivedReviewState(records, allRosterVerified(records), {});
  assert.ok(
    !blockers.some((b) => b.includes('reviewer-2 independence')),
    `expected no independence blocker once the EFFECTIVE (corrected) clinical-1 record is clean, got: ${JSON.stringify(blockers)}`,
  );
});

test('the committed cbc_suite_v1 dry-run fixture\'s existing terminal behavior is UNCHANGED by the FR-26 conditional-completeness policy (clinical-1/clinical-2 agree, adjudication present anyway; the only expected violation is still the FR-6 synthetic:true one)', async () => {
  await assert.rejects(
    () => runValidate({ module: 'cbc_suite_v1', root: REPO_ROOT }),
    (err) => {
      assert.ok(err instanceof ValidationFailedError);
      assert.ok(
        isExpectedTerminalNonQualifyingViolations(err.violations),
        `expected exactly the FR-6 synthetic-set violation (unchanged by FR-26), got: ${JSON.stringify(err.violations)}`,
      );
      return true;
    },
  );
});

test('ADR-0004 status field is untouched by this task -- stays "proposed" (G0 uncleared, hard guardrail)', async () => {
  const adrPath = path.join(REPO_ROOT, 'docs', 'adr', '0004-clinical-approval-identity-adjudication.md');
  const content = await readFile(adrPath, 'utf8');
  assert.match(
    content,
    /^status: proposed$/m,
    'ADR-0004 frontmatter `status` must remain exactly "proposed" -- P1-T5 encodes decision item 5 ' +
      'into code without ratifying the ADR itself',
  );
});

// -------------------------------------------------------------------------------------------
// End-to-end seeded violation (a): adjudicator whose roster identity IS an authorship-union
// identity, exercised through the real `validate` verb (integration, temp git repo).
// -------------------------------------------------------------------------------------------

test('validate rejects an adjudication record whose reviewerId resolves to a roster identity that is in the module authorship union — seeded violation (a)', async () => {
  const fixture = await makeGitFixture();
  try {
    await fixture.commitFile(
      'modules/conflicted_v1/authoring-decisions.yaml',
      'schemaVersion: "1.0"\nmoduleId: conflicted_v1\ndecisions: []\n',
      'Grace Author',
      'grace@example.test',
      'add authoring-decisions.yaml',
    );
    await fixture.commitFile(
      'modules/conflicted_v1/module.json',
      '{"id":"conflicted_v1"}\n',
      'Grace Author',
      'grace@example.test',
      'add module.json',
    );

    await mkdir(path.join(fixture.dir, 'governance'), { recursive: true });
    await writeFile(
      path.join(fixture.dir, 'governance', 'reviewer-roster.yaml'),
      [
        'schemaVersion: 1',
        'reviewers:',
        '  - reviewerId: fixture-conflicted-adjudicator',
        '    name: "Grace Author"',
        '    credentialRef: "FIXTURE-CRED-CONFLICT"',
        '    moduleScopes: [conflicted_v1]',
        '    synthetic: true',
      ].join('\n') + '\n',
    );

    await mkdir(path.join(fixture.dir, 'modules', 'conflicted_v1', 'reviews'), { recursive: true });
    await writeFile(
      path.join(fixture.dir, 'modules', 'conflicted_v1', 'reviews', 'rr-0001-adjudication.yaml'),
      [
        'schemaVersion: 1',
        'review_id: rr-0001-adjudication',
        'role: adjudication',
        'moduleId: conflicted_v1',
        `subjectContentHash: ${SUBJECT_HASH}`,
        'previousRecordHash: null',
        'supersedes: null',
        'reviewerId: "fixture-conflicted-adjudicator"',
        'decision: approve',
        'rationale: "Fixture adjudication rationale for the seeded self-authorship violation test."',
        'reviewedAt: 2026-02-01T00:00:00Z',
        'synthetic: true',
        // P2-T5: a REAL, verifiable signature -- this fixture is expected to fail validate anyway
        // (the seeded authorship-union violation below), but there is no reason to also leave a
        // stale, non-verifying stub signature that would add a SECOND, unrelated violation and
        // obscure what this fixture is actually testing.
        ...realSignatureYamlLines({
          schemaVersion: 1,
          review_id: 'rr-0001-adjudication',
          role: 'adjudication',
          moduleId: 'conflicted_v1',
          subjectContentHash: SUBJECT_HASH,
          previousRecordHash: null,
          supersedes: null,
          reviewerId: 'fixture-conflicted-adjudicator',
          decision: 'approve',
          rationale: 'Fixture adjudication rationale for the seeded self-authorship violation test.',
          reviewedAt: '2026-02-01T00:00:00Z',
          synthetic: true,
        }),
      ].join('\n') + '\n',
    );

    await assert.rejects(
      () => runValidate({ module: 'conflicted_v1', root: fixture.dir }),
      (err) => {
        assert.ok(err instanceof ValidationFailedError);
        assert.ok(
          err.violations.some((v) => v.includes('is in the authorship union of the proposal it reviews')),
          `expected an authorship-union violation, got: ${JSON.stringify(err.violations)}`,
        );
        return true;
      },
    );
  } finally {
    await cleanup(fixture.dir);
  }
});

test('validate accepts an adjudication record whose reviewerId does NOT resolve to any authorship-union identity', async () => {
  const fixture = await makeGitFixture();
  try {
    await fixture.commitFile(
      'modules/independent_adjudicator_v1/authoring-decisions.yaml',
      'schemaVersion: "1.0"\nmoduleId: independent_adjudicator_v1\ndecisions: []\n',
      'Henry Author',
      'henry@example.test',
      'add authoring-decisions.yaml',
    );
    await fixture.commitFile(
      'modules/independent_adjudicator_v1/module.json',
      '{"id":"independent_adjudicator_v1"}\n',
      'Henry Author',
      'henry@example.test',
      'add module.json',
    );

    await mkdir(path.join(fixture.dir, 'governance'), { recursive: true });
    await writeFile(
      path.join(fixture.dir, 'governance', 'reviewer-roster.yaml'),
      [
        'schemaVersion: 1',
        'reviewers:',
        '  - reviewerId: fixture-independent-adjudicator',
        '    name: "Irene Independent"',
        '    credentialRef: "FIXTURE-CRED-INDEP"',
        '    moduleScopes: [independent_adjudicator_v1]',
        '    synthetic: true',
      ].join('\n') + '\n',
    );

    await mkdir(path.join(fixture.dir, 'modules', 'independent_adjudicator_v1', 'reviews'), { recursive: true });
    await writeFile(
      path.join(fixture.dir, 'modules', 'independent_adjudicator_v1', 'reviews', 'rr-0001-adjudication.yaml'),
      [
        'schemaVersion: 1',
        'review_id: rr-0001-adjudication',
        'role: adjudication',
        'moduleId: independent_adjudicator_v1',
        `subjectContentHash: ${SUBJECT_HASH}`,
        'previousRecordHash: null',
        'supersedes: null',
        'reviewerId: "fixture-independent-adjudicator"',
        'decision: approve',
        'rationale: "Fixture adjudication rationale, independent reviewer."',
        'reviewedAt: 2026-02-01T00:00:00Z',
        'synthetic: true',
        // P2-T5: this test asserts a HAPPY-PATH `validate` outcome (exit 0), so the signature below
        // must be a REAL, cryptographically-verifiable Ed25519 dry-run signature -- a stub value
        // would now be rejected by validate's FR-10/OQ-2 signature check (see realSignatureYamlLines
        // above this file's test bodies).
        ...realSignatureYamlLines({
          schemaVersion: 1,
          review_id: 'rr-0001-adjudication',
          role: 'adjudication',
          moduleId: 'independent_adjudicator_v1',
          subjectContentHash: SUBJECT_HASH,
          previousRecordHash: null,
          supersedes: null,
          reviewerId: 'fixture-independent-adjudicator',
          decision: 'approve',
          rationale: 'Fixture adjudication rationale, independent reviewer.',
          reviewedAt: '2026-02-01T00:00:00Z',
          synthetic: true,
        }),
      ].join('\n') + '\n',
    );

    const code = await runValidate({ module: 'independent_adjudicator_v1', root: fixture.dir });
    assert.equal(code, 0);
  } finally {
    await cleanup(fixture.dir);
  }
});

// -------------------------------------------------------------------------------------------
// A test proves no code path in this tool can set release-ready or populate
// approvedBy[]/clinicalApprovers[] — structural.
// -------------------------------------------------------------------------------------------

async function walkJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkJsFiles(full)));
    else if (entry.isFile() && entry.name.endsWith('.mjs')) files.push(full);
  }
  return files;
}

// `lib/store.mjs` is this tool's ONE write path into `modules/<id>/reviews/` (the append-only
// review-record store) -- that invariant is unchanged. P2-T6 adds a second, legitimate, and
// entirely disjoint `writeFile` caller: `lib/verbs/render.mjs`, whose only write target is
// `build/review-render/` (OQ-3, git-ignored) -- never `modules/`, never anything this tool's other
// write-path guarantees are about (see `lib/verbs/render.mjs`'s own header). Clinical Review
// Workflow v1 P2-T3 (FR-8/R9/F3) adds a THIRD, equally disjoint caller: `lib/validate-cache.mjs`,
// whose only write target is its own persistent `validate` cache file, resolved via
// `resolveCacheRootDir()` -- an OS temp/XDG cache directory that is, by construction, ALWAYS
// OUTSIDE the repo working tree entirely (never `modules/`, never `build/`, never any path
// `rootDir` names) and carries nothing but composite-key metadata plus already-derived violation
// strings for four narrow per-record checks -- structurally incapable of setting `release-ready`,
// or populating `approvedBy[]`/`clinicalApprovers[]`, exactly like the other two callers. Any
// FUTURE writeFile caller beyond these three named, narrow-purpose files is still exactly the kind
// of drift this test exists to catch.
const ALLOWED_WRITE_FILE_CALLERS = Object.freeze([
  path.join('lib', 'store.mjs'),
  path.join('lib', 'verbs', 'render.mjs'),
  path.join('lib', 'validate-cache.mjs'),
]);

test('writeFile is called only from lib/store.mjs (modules/<id>/reviews/) and lib/verbs/render.mjs (build/review-render/) across the whole tool — no other write path (structural)', async () => {
  const files = await walkJsFiles(TOOL_ROOT);
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (/\bwriteFile\(/.test(content)) {
      assert.ok(
        ALLOWED_WRITE_FILE_CALLERS.includes(path.relative(TOOL_ROOT, file)),
        `${path.relative(REPO_ROOT, file)} must not call writeFile -- only ` +
          `${ALLOWED_WRITE_FILE_CALLERS.join(' and ')} may write anything in this tool`,
      );
    }
  }
});

test('lib/store.mjs (this tool\'s one write path) never references module.json, approvedBy, clinicalApprovers, or "release-ready" (structural)', async () => {
  const content = await readFile(path.join(TOOL_ROOT, 'lib', 'store.mjs'), 'utf8');
  for (const pattern of [/module\.json/, /approvedBy/, /clinicalApprovers/, /release-ready/]) {
    assert.doesNotMatch(content, pattern, `lib/store.mjs must not reference ${pattern}`);
  }
});

// -------------------------------------------------------------------------------------------
// Zero network calls (adjudication.mjs) — matches this tool's own dynamic pattern elsewhere.
// -------------------------------------------------------------------------------------------

test('computeAuthorshipUnion makes zero network calls at runtime (patched global fetch throws if invoked)', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('network call attempted during computeAuthorshipUnion');
  };
  try {
    assert.doesNotThrow(() => computeAuthorshipUnion(REPO_ROOT, 'cbc_suite_v1'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('no file under tools/review-record/ imports a network or generative-model API (adjudication.mjs static check)', async () => {
  const content = await readFile(path.join(TOOL_ROOT, 'lib', 'adjudication.mjs'), 'utf8');
  for (const pattern of [/node:http\b/, /node:https\b/, /node:dgram\b/, /\bfetch\(/]) {
    assert.doesNotMatch(content, pattern);
  }
});
