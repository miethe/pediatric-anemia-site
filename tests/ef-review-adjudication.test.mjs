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
  rosterEntryInAuthorshipUnion,
} from '../tools/review-record/lib/adjudication.mjs';
import { canonicalRecordHash } from '../tools/review-record/lib/chain.mjs';
import { run as runValidate } from '../tools/review-record/lib/verbs/validate.mjs';
import { ValidationFailedError } from '../tools/review-record/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL_ROOT = path.join(REPO_ROOT, 'tools', 'review-record');

const SUBJECT_HASH = 'sha256:537d2dcf29f8e2871a4b91129ec3da3d0012d48ee90af0784ea8c93db7398c6d';

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
        'signature:',
        '  algorithm: ed25519',
        '  keyId: TESTKEY-conflict-seed',
        '  value: "c3R1Yg=="',
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
        'signature:',
        '  algorithm: ed25519',
        '  keyId: TESTKEY-indep-seed',
        '  value: "c3R1Yg=="',
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

test('writeFile is called only from lib/store.mjs across the whole tool — the ONE write path (structural)', async () => {
  const files = await walkJsFiles(TOOL_ROOT);
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (/\bwriteFile\(/.test(content)) {
      assert.equal(
        path.relative(TOOL_ROOT, file),
        path.join('lib', 'store.mjs'),
        `${path.relative(REPO_ROOT, file)} must not call writeFile -- lib/store.mjs is this tool's ONE write path`,
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
