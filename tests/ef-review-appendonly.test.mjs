// tests/ef-review-appendonly.test.mjs — P2-T3 (Evidence Foundry E1 Phase 2, FR-9/OQ-2).
//
// Covers this task's own acceptance criteria
// (docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-2-4-workstreams.md,
// row P2-T3):
//   - Layer (a) — previousRecordHash chain: `validate` now fails closed (not just `list`'s own
//     informational reporting, P2-T1) when a module's chain does not recompute cleanly. Seeded
//     mutation: one-byte mutation of a committed fixture record fails chain validation.
//   - Layer (b) — git-history: `validate --history` fails closed on any commit-visible
//     mutation/deletion of an existing `modules/<id>/reviews/*.yaml` path. Seeded mutation: a
//     simulated history rewrite (an in-place edit committed a second time) fails the history
//     validator, EVEN WHEN layer (a) alone would not catch it (a lone, un-superseded record with no
//     successor referencing its hash) — proving layer (b) closes a real gap layer (a) leaves open.
//   - A valid superseding record (a brand-new path, `supersedes` set) passes both layers.
//   - Both layers report distinct, prefixed violations (`chain:` / `git-history:`) and both are
//     deterministic (two runs over the same input produce byte-identical structured output).
//
// Every scratch git repository below is built fresh in a temp directory (`mkdtemp` + `git init`)
// and torn down at the end of its own test — never the real repository, and never any fixture
// tree already committed under tests/fixtures/ (most of which are NOT their own git repository and
// would themselves fail closed with NotAGitRepositoryError if pointed at directly — see the
// dedicated test for that below).
//
// Structural validity proven here never implies clinical validity, safety, or that a named human
// clinician reviewed anything — see schemas/review-record.schema.json's own top-level description
// for that standing caveat.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkModuleChainLinkage,
  canonicalRecordHash,
} from '../tools/review-record/lib/chain.mjs';
import {
  checkAppendOnlyHistory,
  parseNameStatusLog,
  isGitWorkTree,
  NotAGitRepositoryError,
  GitHistoryCheckError,
} from '../tools/review-record/lib/history.mjs';
import { serializeReviewRecordYaml, listModuleReviewRecords } from '../tools/review-record/lib/store.mjs';
import { run as runValidate } from '../tools/review-record/lib/verbs/validate.mjs';
import { EXIT_OK, EXIT_USAGE, UsageError, ValidationFailedError } from '../tools/review-record/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(REPO_ROOT, 'tools', 'review-record', 'cli.mjs');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-review-record-cli');

const SUBJECT_HASH = 'sha256:537d2dcf29f8e2871a4b91129ec3da3d0012d48ee90af0784ea8c93db7398c6d';

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' });
  assert.equal(result.error, undefined, `spawnSync itself failed: ${result.error}`);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Initializes a throwaway git repo at `dir` with a deterministic local test identity. */
function gitInit(dir) {
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'ef-e1-p2t3-test@example.invalid'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'EF-E1 P2-T3 Test'], { cwd: dir });
}

function gitCommitAll(dir, message) {
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', message], { cwd: dir });
}

async function mkTmpDir(prefix) {
  return mkdtemp(path.join(tmpdir(), prefix));
}

/** A single well-formed, schema-shaped, synthetic review record (fields the CLI's own store/schema
 * expect) — used only to exercise the git-history mechanics below, never claimed as a real review
 * act (synthetic: true throughout). */
function buildRecord(overrides = {}) {
  return {
    schemaVersion: 1,
    review_id: 'rr-0001-clinical-1',
    role: 'clinical-1',
    moduleId: 'history_target_v1',
    subjectContentHash: SUBJECT_HASH,
    previousRecordHash: null,
    supersedes: null,
    reviewerId: 'synthetic-history-reviewer',
    decision: 'approve',
    rationale: 'P2-T3 git-history-layer fixture record -- not a real clinical review act.',
    reviewedAt: '2026-02-04T00:00:00Z',
    synthetic: true,
    signature: { algorithm: 'ed25519', keyId: 'TESTKEY-ef-e1-p2t3-history-fixture', value: 'aGlzdG9yeS1maXh0dXJlLTE=' },
    ...overrides,
  };
}

const ROSTER_YAML = `schemaVersion: 1
reviewers:
  - reviewerId: "synthetic-history-reviewer"
    name: "SYNTHETIC -- NOT A CREDENTIALED REVIEWER (P2-T3 history-layer fixture persona)"
    credentialRef: "fixture-placeholder-credential-history"
    moduleScopes:
      - history_target_v1
    synthetic: true
`;

// Roster for the dedicated (non-git) chain-only fixture tree below. Deliberately uses
// clinical-1 + lab roles (NOT clinical-1 + clinical-2) so this fixture never engages the FR-4
// reviewer-2 independence heuristic (`lib/independence.mjs`, pairwise over clinical-1/clinical-2
// only) -- these tests exercise layer (a) chain enforcement in isolation, on a fixture this task
// fully controls (never the pre-existing `fixture_module_v1` P2-T1 `list`-only fixture, whose
// clinical-1/clinical-2 rationale pair happens to share a long verbatim prefix -- a P2-T1 fixture
// property this task neither introduced nor should mask by loosening the independence heuristic).
const CHAIN_ONLY_ROSTER_YAML = `schemaVersion: 1
reviewers:
  - reviewerId: "synthetic-chain-reviewer-1"
    name: "SYNTHETIC -- NOT A CREDENTIALED REVIEWER (P2-T3 chain-only fixture persona 1)"
    credentialRef: "fixture-placeholder-credential-chain-1"
    moduleScopes:
      - chain_only_v1
    synthetic: true
  - reviewerId: "synthetic-chain-reviewer-lab"
    name: "SYNTHETIC -- NOT A CREDENTIALED REVIEWER (P2-T3 chain-only fixture persona lab)"
    credentialRef: "fixture-placeholder-credential-chain-lab"
    moduleScopes:
      - chain_only_v1
    synthetic: true
`;

/** Builds a plain (non-git) tmp tree with a valid, chain-linked, independence-heuristic-clean
 * two-record module (`chain_only_v1`, roles clinical-1 + lab) plus a matching
 * `governance/reviewer-roster.yaml`. Caller owns cleanup (`rm`). Used to exercise layer (a) chain
 * enforcement in isolation -- no git repo is created here (layer (a) needs none). */
async function buildChainOnlyFixtureTree() {
  const dir = await mkTmpDir('ef-review-appendonly-chainonly-');
  await mkdir(path.join(dir, 'modules', 'chain_only_v1', 'reviews'), { recursive: true });
  await mkdir(path.join(dir, 'governance'), { recursive: true });
  await writeFile(path.join(dir, 'governance', 'reviewer-roster.yaml'), CHAIN_ONLY_ROSTER_YAML, 'utf8');

  const rr1 = buildRecord({
    moduleId: 'chain_only_v1',
    review_id: 'rr-0001-clinical-1',
    role: 'clinical-1',
    reviewerId: 'synthetic-chain-reviewer-1',
    rationale: 'Chain-only fixture record 1 (P2-T3) -- exercises layer (a) enforcement in isolation.',
  });
  await writeFile(
    path.join(dir, 'modules', 'chain_only_v1', 'reviews', 'rr-0001-clinical-1.yaml'),
    serializeReviewRecordYaml(rr1),
    'utf8',
  );

  const rr2 = buildRecord({
    moduleId: 'chain_only_v1',
    review_id: 'rr-0002-lab',
    role: 'lab',
    reviewerId: 'synthetic-chain-reviewer-lab',
    previousRecordHash: canonicalRecordHash(rr1),
    rationale: 'Chain-only fixture record 2 (P2-T3), lab role, unrelated wording from record 1.',
  });
  await writeFile(
    path.join(dir, 'modules', 'chain_only_v1', 'reviews', 'rr-0002-lab.yaml'),
    serializeReviewRecordYaml(rr2),
    'utf8',
  );

  return dir;
}

/** Builds a scratch git repo with a committed, schema-valid, roster-resolvable module at
 * `modules/history_target_v1/reviews/rr-0001-clinical-1.yaml` plus a matching
 * `governance/reviewer-roster.yaml`, and returns its root dir. Caller owns cleanup (`rm`). */
async function buildScratchRepoWithOneCommittedRecord() {
  const dir = await mkTmpDir('ef-review-appendonly-');
  gitInit(dir);
  await mkdir(path.join(dir, 'modules', 'history_target_v1', 'reviews'), { recursive: true });
  await mkdir(path.join(dir, 'governance'), { recursive: true });
  await writeFile(path.join(dir, 'governance', 'reviewer-roster.yaml'), ROSTER_YAML, 'utf8');
  await writeFile(
    path.join(dir, 'modules', 'history_target_v1', 'reviews', 'rr-0001-clinical-1.yaml'),
    serializeReviewRecordYaml(buildRecord()),
    'utf8',
  );
  gitCommitAll(dir, 'add rr-0001-clinical-1');
  return dir;
}

// -------------------------------------------------------------------------------------------
// Layer (a) — previousRecordHash chain, now FAIL-CLOSED in `validate` (not just `list`'s own
// informational reporting).
// -------------------------------------------------------------------------------------------

test('validate now fails closed (not just reports) on the pre-existing broken_chain_v1 fixture', async () => {
  await assert.rejects(
    () => runValidate({ module: 'broken_chain_v1', root: FIXTURES_ROOT }),
    (err) => {
      assert.ok(err instanceof ValidationFailedError);
      assert.ok(err.violations.some((v) => v.startsWith('chain: rr-0002-lab:')));
      assert.ok(err.violations.some((v) => v.includes('does not match the recomputed hash')));
      return true;
    },
  );
});

test('cli.mjs validate (subprocess) rejects broken_chain_v1 with a chain: -prefixed violation', () => {
  const { status, stderr } = runCli(['validate', '--module', 'broken_chain_v1', '--root', FIXTURES_ROOT]);
  assert.equal(status, EXIT_USAGE);
  assert.match(stderr, /ValidationFailedError/);
  assert.match(stderr, /chain: rr-0002-lab:/);
});

test('validate passes over a dedicated, valid, chain-linked two-record fixture (chain_only_v1)', async () => {
  const dir = await buildChainOnlyFixtureTree();
  try {
    const code = await runValidate({ module: 'chain_only_v1', root: dir });
    assert.equal(code, EXIT_OK);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('SEEDED MUTATION (a): a one-byte mutation of a committed fixture record fails chain validation', async () => {
  const dir = await buildChainOnlyFixtureTree();
  try {
    // Sanity: unmutated tree still validates cleanly.
    assert.equal(await runValidate({ module: 'chain_only_v1', root: dir }), EXIT_OK);

    // Mutate exactly one byte of rr-0001-clinical-1's rationale text (a double-quoted YAML scalar
    // -- inserting one character just before the closing quote is safe and does not break the
    // hand-rolled parser's line-based grammar).
    const rr1Path = path.join(dir, 'modules', 'chain_only_v1', 'reviews', 'rr-0001-clinical-1.yaml');
    const before = await readFile(rr1Path, 'utf8');
    const mutated = before.replace('enforcement in isolation."', 'enforcement in isolation.!"');
    assert.notEqual(mutated, before, 'the mutation must actually change the file');
    assert.equal(mutated.length, before.length + 1, 'this must be a ONE-BYTE mutation');
    await writeFile(rr1Path, mutated, 'utf8');

    await assert.rejects(
      () => runValidate({ module: 'chain_only_v1', root: dir }),
      (err) => {
        assert.ok(err instanceof ValidationFailedError);
        assert.ok(err.violations.some((v) => v.startsWith('chain: rr-0002-lab:')));
        assert.ok(err.violations.some((v) => v.includes('does not match the recomputed hash')));
        return true;
      },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('cli.mjs validate (subprocess) rejects a one-byte-mutated chain_only_v1 fixture with a chain: -prefixed violation', async () => {
  const dir = await buildChainOnlyFixtureTree();
  try {
    const rr1Path = path.join(dir, 'modules', 'chain_only_v1', 'reviews', 'rr-0001-clinical-1.yaml');
    const before = await readFile(rr1Path, 'utf8');
    await writeFile(rr1Path, before.replace('enforcement in isolation."', 'enforcement in isolation.!"'), 'utf8');

    const { status, stderr } = runCli(['validate', '--module', 'chain_only_v1', '--root', dir]);
    assert.equal(status, EXIT_USAGE);
    assert.match(stderr, /ValidationFailedError/);
    assert.match(stderr, /chain: rr-0002-lab:/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkModuleChainLinkage is deterministic: two calls over the same records produce byte-identical structured output', async () => {
  const records = await listModuleReviewRecords(FIXTURES_ROOT, 'fixture_module_v1');
  const first = JSON.stringify(checkModuleChainLinkage(records));
  const second = JSON.stringify(checkModuleChainLinkage(records));
  assert.equal(first, second);
});

// -------------------------------------------------------------------------------------------
// Layer (b) — git-history append-only check (lib/history.mjs), direct unit coverage.
// -------------------------------------------------------------------------------------------

test('parseNameStatusLog parses an empty log to []', () => {
  assert.deepEqual(parseNameStatusLog(''), []);
  assert.deepEqual(parseNameStatusLog('   \n  '), []);
});

test('isGitWorkTree is false for a plain (non-git) tmp directory', async () => {
  const tmp = await mkTmpDir('ef-review-appendonly-notrepo-');
  try {
    assert.equal(isGitWorkTree(tmp), false);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('checkAppendOnlyHistory throws NotAGitRepositoryError (fails closed) for a non-git --root', async () => {
  const tmp = await mkTmpDir('ef-review-appendonly-notrepo2-');
  try {
    assert.throws(() => checkAppendOnlyHistory(tmp, 'any_module_v1'), NotAGitRepositoryError);
    assert.throws(() => checkAppendOnlyHistory(tmp, 'any_module_v1'), UsageError);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('checkAppendOnlyHistory reports ok:true, paths:[] for a module with no git history at all', async () => {
  const dir = await mkTmpDir('ef-review-appendonly-empty-');
  try {
    gitInit(dir);
    // A repo must have at least one commit for `git log` semantics to be well-defined; give it an
    // unrelated commit so the repo is non-empty, but nothing under modules/ at all.
    await writeFile(path.join(dir, 'README.txt'), 'scratch repo\n', 'utf8');
    gitCommitAll(dir, 'unrelated initial commit');

    const report = checkAppendOnlyHistory(dir, 'never_touched_v1');
    assert.deepEqual(report, { moduleId: 'never_touched_v1', ok: true, paths: [] });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkAppendOnlyHistory reports ok:true for a path added exactly once', async () => {
  const dir = await buildScratchRepoWithOneCommittedRecord();
  try {
    const report = checkAppendOnlyHistory(dir, 'history_target_v1');
    assert.equal(report.ok, true);
    assert.equal(report.paths.length, 1);
    assert.deepEqual(report.paths[0].statuses, ['A']);
    assert.equal(report.paths[0].ok, true);
    assert.equal(report.paths[0].reason, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('VALID SUPERSEDING RECORD PASSES: a brand-new path (supersedes set) keeps both records ok:true', async () => {
  const dir = await buildScratchRepoWithOneCommittedRecord();
  try {
    const rr1 = (await listModuleReviewRecords(dir, 'history_target_v1'))[0].record;
    const rr2 = buildRecord({
      review_id: 'rr-0002-clinical-1',
      supersedes: 'rr-0001-clinical-1',
      previousRecordHash: canonicalRecordHash(rr1),
      rationale: 'P2-T3 correction of rr-0001 -- a brand-new superseding record, not an in-place edit.',
    });
    await writeFile(
      path.join(dir, 'modules', 'history_target_v1', 'reviews', 'rr-0002-clinical-1.yaml'),
      serializeReviewRecordYaml(rr2),
      'utf8',
    );
    gitCommitAll(dir, 'add rr-0002-clinical-1 (correction, supersedes rr-0001)');

    const historyReport = checkAppendOnlyHistory(dir, 'history_target_v1');
    assert.equal(historyReport.ok, true);
    assert.deepEqual(historyReport.paths.map((p) => p.statuses), [['A'], ['A']]);

    // The full validate --history pass, end to end: chain (a) AND history (b) both accept this.
    const code = await runValidate({ module: 'history_target_v1', root: dir, history: true });
    assert.equal(code, EXIT_OK);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('SEEDED MUTATION (b): a simulated history rewrite (in-place edit, second commit on the SAME path) fails the history validator', async () => {
  const dir = await buildScratchRepoWithOneCommittedRecord();
  try {
    // This is the gap layer (a) alone cannot see: rr-0001 has no successor whose previousRecordHash
    // depends on it, so mutating it in place leaves the chain (a single record, previousRecordHash:
    // null) still trivially "valid." Only the git-history layer (b) catches this.
    const rr1Path = path.join(dir, 'modules', 'history_target_v1', 'reviews', 'rr-0001-clinical-1.yaml');
    const before = await readFile(rr1Path, 'utf8');
    const rewritten = before.replace('clinical review act."', 'clinical review act -- SILENTLY REWRITTEN."');
    assert.notEqual(rewritten, before);
    await writeFile(rr1Path, rewritten, 'utf8');
    gitCommitAll(dir, 'mutate rr-0001-clinical-1 in place (simulated history rewrite -- BAD)');

    // Layer (a) alone: chain still reports ok (single record, previousRecordHash still null).
    const records = await listModuleReviewRecords(dir, 'history_target_v1');
    assert.deepEqual(checkModuleChainLinkage(records).map((l) => l.ok), [true]);

    // Layer (b): the git-history validator DOES catch it.
    const historyReport = checkAppendOnlyHistory(dir, 'history_target_v1');
    assert.equal(historyReport.ok, false);
    assert.equal(historyReport.paths.length, 1);
    assert.deepEqual(historyReport.paths[0].statuses, ['A', 'M']);
    assert.match(historyReport.paths[0].reason, /must be added exactly once/);

    // Plain `validate` (no --history) still passes -- proving --history is genuinely opt-in and
    // layer (a) alone would have silently missed this mutation.
    assert.equal(await runValidate({ module: 'history_target_v1', root: dir }), EXIT_OK);

    // `validate --history` fails closed with a distinct, git-history-prefixed violation.
    await assert.rejects(
      () => runValidate({ module: 'history_target_v1', root: dir, history: true }),
      (err) => {
        assert.ok(err instanceof ValidationFailedError);
        assert.ok(
          err.violations.some(
            (v) => v.startsWith('git-history:') && v.includes('modules/history_target_v1/reviews/rr-0001-clinical-1.yaml'),
          ),
        );
        return true;
      },
    );

    // cli.mjs subprocess, same assertion end to end.
    const { status, stderr } = runCli(['validate', '--module', 'history_target_v1', '--root', dir, '--history']);
    assert.equal(status, EXIT_USAGE);
    assert.match(stderr, /ValidationFailedError/);
    assert.match(stderr, /git-history:/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkAppendOnlyHistory reports ok:false with status [A, D] for a deleted-then-recreated path', async () => {
  const dir = await buildScratchRepoWithOneCommittedRecord();
  try {
    const filePath = path.join(dir, 'modules', 'history_target_v1', 'reviews', 'rr-0001-clinical-1.yaml');
    execFileSync('git', ['rm', '-q', filePath], { cwd: dir });
    gitCommitAll(dir, 'delete rr-0001-clinical-1 (BAD -- append-only forbids deletion)');

    const report = checkAppendOnlyHistory(dir, 'history_target_v1');
    assert.equal(report.ok, false);
    assert.deepEqual(report.paths[0].statuses, ['A', 'D']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkAppendOnlyHistory is deterministic: two calls over the same git history produce byte-identical structured output', async () => {
  const dir = await buildScratchRepoWithOneCommittedRecord();
  try {
    const first = JSON.stringify(checkAppendOnlyHistory(dir, 'history_target_v1'));
    const second = JSON.stringify(checkAppendOnlyHistory(dir, 'history_target_v1'));
    assert.equal(first, second);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('GitHistoryCheckError and NotAGitRepositoryError are both UsageError subclasses (single fail-closed exit-code taxonomy)', () => {
  const notRepo = new NotAGitRepositoryError('/nonexistent');
  const gitFailed = new GitHistoryCheckError('boom');
  assert.ok(notRepo instanceof UsageError);
  assert.ok(gitFailed instanceof UsageError);
  assert.equal(notRepo.exitCode, EXIT_USAGE);
  assert.equal(gitFailed.exitCode, EXIT_USAGE);
});

// -------------------------------------------------------------------------------------------
// --record narrowing does not skip module-wide chain/history enforcement (mirrors the existing
// reviewer-2 independence precedent in tests/ef-review-workflow.test.mjs).
// -------------------------------------------------------------------------------------------

test('validate --record on ONE record of a broken chain still fails on the chain break (module-wide, not record-scoped)', async () => {
  await assert.rejects(
    () => runValidate({ module: 'broken_chain_v1', root: FIXTURES_ROOT, record: 'rr-0001-clinical-1' }),
    (err) => {
      assert.ok(err instanceof ValidationFailedError);
      assert.ok(err.violations.some((v) => v.startsWith('chain: rr-0002-lab:')));
      return true;
    },
  );
});

// -------------------------------------------------------------------------------------------
// Zero network calls (history.mjs uses node:child_process to invoke local git only).
// -------------------------------------------------------------------------------------------

test('checkAppendOnlyHistory makes zero network calls at runtime (patched global fetch throws if invoked)', async () => {
  const dir = await buildScratchRepoWithOneCommittedRecord();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network call attempted during checkAppendOnlyHistory');
  };
  try {
    assert.doesNotThrow(() => checkAppendOnlyHistory(dir, 'history_target_v1'));
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
});
