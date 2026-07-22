// tests/ef-review-validate-cache.test.mjs — Clinical Review Workflow v1, Phase 2, P2-T3
// (FR-8, R9, F3): incremental, composite-keyed, cross-process, fail-closed `validate` cache.
//
// This file's own target surfaces are `tools/review-record/lib/validate-cache.mjs` and
// `tools/review-record/lib/verbs/validate.mjs` (P2-T3's target-surfaces list did not itself name a
// test file — P2-T4, a sibling task, owns further additions to `tests/ef-review-workflow.test.mjs`,
// e.g. its own five dedicated fresh-process adversarial invalidation tests and the cross-process
// microbenchmark script; this file proves P2-T3's own, narrower acceptance criteria independently,
// as a NEW file rather than an edit to a file a sibling task owns this batch).
//
// TEST-SEAM CACHE ISOLATION: every test in this file shares ONE throwaway cache ROOT directory
// (`REVIEW_RECORD_CACHE_DIR`, set once below, at module-load time, before any test body runs) so
// this suite's cache traffic never touches this machine's real OS temp/XDG cache location (see
// `validate-cache.mjs`'s own header for why that location is `os.tmpdir()`-anchored by default).
// Individual tests still get mutually ISOLATED cache entries within that shared root because the
// cache is keyed by `{root, moduleId}` and every test uses its own unique `mkdtemp`-created
// `--root` and/or a module id unique to that test.
//
// Two proof strategies, matching this task's own acceptance criteria:
//   (A) UNIT-level tests against `validate-cache.mjs`'s exported primitives directly — the cleanest,
//       most direct way to prove "changing any ONE of the six composite-key components forces a
//       cache miss" for ALL SIX components (including `schemaFileHash` and
//       `validatorPolicyVersion`, neither of which a CLI-level test can cleanly vary without either
//       mutating the real committed schema file or being a pure code constant — both out of scope
//       for a caching task).
//   (B) CLI-level (`spawnSync`, real `node cli.mjs validate ...` child processes, matching this
//       tool's established `runCli` convention) integration tests proving the cache is actually
//       WIRED IN correctly: cross-process warmth via a call-count/marker hook parsed from stdout
//       (never wall-clock alone, per this task's own acceptance criterion), roster/record/
//       predecessor-content changes forcing recompute end-to-end, and module-wide checks (FR-4
//       independence, in this file's case) re-running — and still catching the SAME violation —
//       even when the per-record cache is fully warm.
//
// Structural validity proven here never implies clinical validity, safety, or that a named human
// clinician reviewed anything — see schemas/review-record.schema.json's own top-level description
// for that standing caveat every output of this tool carries.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VALIDATOR_POLICY_VERSION,
  canonicalRecordHash,
  getCachedRecordResult,
  hashFileIfExists,
  hashPredecessorSet,
  keysMatch,
  readCacheFile,
  resolveCacheFilePath,
  resolveCacheRootDir,
  setCachedRecordResult,
  writeCacheFileAtomic,
} from '../tools/review-record/lib/validate-cache.mjs';
import { buildReviewId, listModuleReviewRecords, recordFilePathFor } from '../tools/review-record/lib/store.mjs';
import { rosterFilePathFor } from '../tools/review-record/lib/roster.mjs';
import { draftFilePathFor, run as runScaffold } from '../tools/review-record/lib/verbs/scaffold.mjs';
import { run as runSign } from '../tools/review-record/lib/verbs/sign.mjs';
import { run as runValidate } from '../tools/review-record/lib/verbs/validate.mjs';
import { EXIT_OK, EXIT_USAGE, UsageError } from '../tools/review-record/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(REPO_ROOT, 'tools', 'review-record', 'cli.mjs');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');
const SUBJECT_HASH = 'sha256:537d2dcf29f8e2871a4b91129ec3da3d0012d48ee90af0784ea8c93db7398c6d';

// Module-load-time (before any `test()` body runs) shared, throwaway cache root — see this file's
// header. Every `runCli`/`runValidate` call in this file inherits this via `process.env`.
const SHARED_CACHE_ROOT = mkdtempSync(path.join(tmpdir(), 'ef-review-validate-cache-'));
process.env.REVIEW_RECORD_CACHE_DIR = SHARED_CACHE_ROOT;

after(async () => {
  await rm(SHARED_CACHE_ROOT, { recursive: true, force: true });
});

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' });
  assert.equal(result.error, undefined, `spawnSync itself failed: ${result.error}`);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Parses this task's own `validate-cache: hits=<N> misses=<M> ...` marker line out of stdout. */
function parseCacheMarker(stdout) {
  const match = stdout.match(/validate-cache: hits=(\d+) misses=(\d+) of (\d+) scoped/);
  assert.ok(match, `expected a validate-cache marker line in stdout, got:\n${stdout}`);
  return { hits: Number(match[1]), misses: Number(match[2]), scoped: Number(match[3]) };
}

async function writeFixtureRoster(tmp, entries) {
  const lines = ['schemaVersion: 1', 'reviewers:'];
  for (const entry of entries) {
    lines.push(`  - reviewerId: ${entry.reviewerId}`);
    lines.push(`    name: "SYNTHETIC -- NOT A CREDENTIALED REVIEWER (${entry.label})"`);
    lines.push(`    credentialRef: fixture-placeholder-${entry.reviewerId}`);
    lines.push('    moduleScopes:');
    lines.push(`      - ${entry.moduleId}`);
    lines.push('    synthetic: true');
  }
  await mkdir(path.join(tmp, 'governance'), { recursive: true });
  await writeFile(path.join(tmp, 'governance', 'reviewer-roster.yaml'), `${lines.join('\n')}\n`, 'utf8');
}

/**
 * Builds and signs a chain of `roles.length` records (roles applied in order, seq 1..N) for
 * `moduleId` under throwaway root `tmp`, each with a distinct rationale and its own fixture
 * roster entry. Returns the ordered list of `review_id`s written.
 */
async function buildSignedChain(tmp, moduleId, roles) {
  await writeFixtureRoster(
    tmp,
    roles.map((role, i) => ({
      reviewerId: `cache-fixture-reviewer-${i + 1}`,
      moduleId,
      label: `cache fixture role ${role} #${i + 1}`,
    })),
  );

  const reviewIds = [];
  for (let i = 0; i < roles.length; i += 1) {
    const role = roles[i];
    const seq = i + 1;
    const scaffoldCode = await runScaffold({
      module: moduleId,
      role,
      reviewerId: `cache-fixture-reviewer-${seq}`,
      decision: 'approve',
      rationale: `Cache fixture rationale #${seq} for role ${role} -- structural only, no clinical claim.`,
      subject: SUBJECT_HASH,
      reviewedAt: `2026-03-0${seq}T00:00:00Z`,
      root: tmp,
      draft: true,
      // CRW-F5 revision (BLOCKER 2): this throwaway tmp root carries a fixture roster but no
      // modules/<moduleId>/ content -- F5 now hard-fails by default on that "uncomputable module
      // content hash" shape. This suite is about the validate cache, not F5, so the loud, explicit
      // escape hatch is used (see findings doc CRW-F5(e)).
      allowHistoricalSubject: true,
    });
    assert.equal(scaffoldCode, EXIT_OK);

    const reviewId = buildReviewId(seq, role);
    const draftPath = draftFilePathFor(tmp, moduleId, reviewId);
    const signCode = await runSign({ draft: draftPath, module: moduleId, root: tmp });
    assert.equal(signCode, EXIT_OK);
    reviewIds.push(reviewId);
  }
  return reviewIds;
}

async function mutateRationale(filePath, newRationale) {
  const raw = await readFile(filePath, 'utf8');
  const mutated = raw.replace(/^rationale: ".*"$/m, `rationale: "${newRationale}"`);
  assert.notEqual(mutated, raw, `expected to find a rationale line to mutate in ${filePath}`);
  await writeFile(filePath, mutated, 'utf8');
  return mutated;
}

/**
 * Fix-cycle addendum (BLOCKER 3, CRW-F9) helper: computes the EXACT `RecordCacheKey` `validate.mjs`
 * itself would compute for `allRecords[targetIndex]` at the CURRENT on-disk state of `tmp` (same
 * formulas as `lib/verbs/validate.mjs`'s own per-record loop -- ascending-seq-order canonical
 * hashes, the full predecessor-set hash, current roster/schema file hashes, the live
 * `VALIDATOR_POLICY_VERSION`). Used ONLY to construct a cache entry whose composite KEY is
 * genuinely correct (matches what a real `validate` call would compute) so a test can isolate
 * "the stored RESULT's own shape is malformed" as the ONLY variable under test -- never used to
 * forge a key that would not otherwise legitimately match.
 *
 * @param {string} tmp
 * @param {string} moduleId
 * @param {number} targetIndex
 * @param {{ historyMode?: boolean }} [opts]
 * @returns {Promise<{ reviewId: string, key: object }>}
 */
async function computeExpectedKeyForRecord(tmp, moduleId, targetIndex, opts = {}) {
  const allRecords = await listModuleReviewRecords(tmp, moduleId);
  const canonicalHashes = allRecords.map((entry) => canonicalRecordHash(entry.record));
  const rosterFileHash = await hashFileIfExists(rosterFilePathFor(tmp));
  const schemaFileHash = await hashFileIfExists(SCHEMA_PATH);
  return {
    reviewId: allRecords[targetIndex].reviewId,
    key: {
      recordContentHash: canonicalHashes[targetIndex],
      predecessorSetHash: hashPredecessorSet(canonicalHashes.slice(0, targetIndex)),
      rosterFileHash,
      schemaFileHash,
      validatorPolicyVersion: VALIDATOR_POLICY_VERSION,
      historyMode: opts.historyMode === true,
    },
  };
}

// -------------------------------------------------------------------------------------------
// (A) validate-cache.mjs — direct unit coverage of the composite-key primitives
// -------------------------------------------------------------------------------------------

test('resolveCacheRootDir respects the REVIEW_RECORD_CACHE_DIR test seam', () => {
  assert.equal(resolveCacheRootDir(), SHARED_CACHE_ROOT);
});

test('resolveCacheRootDir falls back to XDG_CACHE_HOME, then an os.tmpdir()-anchored default, when the test seam is unset', () => {
  const saved = { override: process.env.REVIEW_RECORD_CACHE_DIR, xdg: process.env.XDG_CACHE_HOME };
  try {
    delete process.env.REVIEW_RECORD_CACHE_DIR;

    process.env.XDG_CACHE_HOME = '/fake/xdg/cache/home';
    assert.equal(resolveCacheRootDir(), path.join('/fake/xdg/cache/home', 'review-record'));

    delete process.env.XDG_CACHE_HOME;
    const defaultDir = resolveCacheRootDir();
    assert.ok(defaultDir.startsWith(tmpdir()), `expected default cache root under os.tmpdir(), got ${defaultDir}`);
    assert.match(defaultDir, /review-record-validate-cache$/);
  } finally {
    if (saved.override !== undefined) process.env.REVIEW_RECORD_CACHE_DIR = saved.override; else delete process.env.REVIEW_RECORD_CACHE_DIR;
    if (saved.xdg !== undefined) process.env.XDG_CACHE_HOME = saved.xdg; else delete process.env.XDG_CACHE_HOME;
  }
});

test('resolveCacheFilePath never resolves inside the given rootDir (F3: persistent store OUTSIDE the repo tree)', () => {
  const filePath = resolveCacheFilePath('/some/repo/root', 'some_module_v1');
  assert.ok(!filePath.startsWith(path.resolve('/some/repo/root')), `cache file must not live under rootDir, got ${filePath}`);
  assert.ok(filePath.startsWith(SHARED_CACHE_ROOT), `expected the cache file under the resolved cache root, got ${filePath}`);
});

test('resolveCacheFilePath is deterministic for the same {root, moduleId} and differs for a different root or moduleId', () => {
  const a = resolveCacheFilePath('/repo/a', 'module_x');
  const b = resolveCacheFilePath('/repo/a', 'module_x');
  const c = resolveCacheFilePath('/repo/a', 'module_y');
  const d = resolveCacheFilePath('/repo/b', 'module_x');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
});

test('hashFileIfExists returns "absent" for a missing file and a real sha256:<hex> digest for an existing one, matching a manual recomputation', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-validate-cache-hashfile-'));
  try {
    const missing = path.join(tmp, 'does-not-exist.txt');
    assert.equal(await hashFileIfExists(missing), 'absent');

    const present = path.join(tmp, 'present.txt');
    await writeFile(present, 'hello cache world', 'utf8');
    const digest = await hashFileIfExists(present);
    assert.match(digest, /^sha256:[0-9a-f]{64}$/);

    const { createHash } = await import('node:crypto');
    const expected = `sha256:${createHash('sha256').update(await readFile(present)).digest('hex')}`;
    assert.equal(digest, expected);

    // Changing the file's bytes changes the digest.
    await writeFile(present, 'hello cache world, mutated', 'utf8');
    assert.notEqual(await hashFileIfExists(present), digest);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('hashPredecessorSet is deterministic for the same ordered array and differs for a different array (including empty vs. non-empty)', () => {
  const empty = hashPredecessorSet([]);
  const one = hashPredecessorSet(['sha256:aa']);
  const two = hashPredecessorSet(['sha256:aa', 'sha256:bb']);
  const reordered = hashPredecessorSet(['sha256:bb', 'sha256:aa']);
  assert.equal(hashPredecessorSet([]), empty);
  assert.equal(hashPredecessorSet(['sha256:aa']), one);
  assert.notEqual(empty, one);
  assert.notEqual(one, two);
  assert.notEqual(two, reordered, 'predecessor ORDER must matter, not just set membership');
});

function baselineKey() {
  return {
    recordContentHash: 'sha256:' + 'a'.repeat(64),
    predecessorSetHash: 'sha256:' + 'b'.repeat(64),
    rosterFileHash: 'sha256:' + 'c'.repeat(64),
    schemaFileHash: 'sha256:' + 'd'.repeat(64),
    validatorPolicyVersion: VALIDATOR_POLICY_VERSION,
    historyMode: false,
  };
}

test('keysMatch: an identical key matches itself (baseline sanity check)', () => {
  assert.equal(keysMatch(baselineKey(), baselineKey()), true);
});

test('keysMatch: changing ANY ONE of the six composite-key components alone forces a mismatch (F3) — record, predecessor, roster, schema, validator-policy version, history-mode', () => {
  const base = baselineKey();
  const overrides = [
    { recordContentHash: 'sha256:' + 'a'.repeat(63) + '0' },
    { predecessorSetHash: 'sha256:' + 'b'.repeat(63) + '0' },
    { rosterFileHash: 'sha256:' + 'c'.repeat(63) + '0' },
    { schemaFileHash: 'sha256:' + 'd'.repeat(63) + '0' },
    { validatorPolicyVersion: VALIDATOR_POLICY_VERSION + 1 },
    { historyMode: true },
  ];
  for (const override of overrides) {
    const mutated = { ...base, ...override };
    assert.equal(
      keysMatch(base, mutated),
      false,
      `expected a mismatch from changing ${Object.keys(override)[0]} alone`,
    );
  }
});

test('keysMatch treats a missing/undefined key on either side as a mismatch, never a vacuous match', () => {
  assert.equal(keysMatch(null, baselineKey()), false);
  assert.equal(keysMatch(baselineKey(), undefined), false);
  assert.equal(keysMatch(null, null), false);
});

test('getCachedRecordResult / setCachedRecordResult: round-trips on a matching key, misses on any one differing component, and misses for an unknown reviewId', () => {
  const key = baselineKey();
  const result = { schemaViolations: [], rosterViolation: null, signatureViolation: null, chainViolation: null };
  const original = {};
  const records = setCachedRecordResult(original, 'rr-0001-clinical-1', key, result);

  assert.deepEqual(getCachedRecordResult(records, 'rr-0001-clinical-1', key), result);
  assert.equal(getCachedRecordResult(records, 'rr-0001-clinical-1', { ...key, historyMode: true }), null);
  assert.equal(getCachedRecordResult(records, 'rr-9999-lab', key), null);

  // Pure: the ORIGINAL map passed in is left untouched -- setCachedRecordResult returns a NEW map.
  assert.deepEqual(original, {});
  assert.notEqual(records, original);
});

test('readCacheFile / writeCacheFileAtomic: round-trips, absent-file, corrupt JSON, and foreign-shape all fail closed to null', async () => {
  const rootDir = '/fake/repo/root/for/cache/unit/tests';
  const moduleId = `cache_unit_roundtrip_v1_${Date.now()}`;

  // Absent (never written yet).
  assert.equal(await readCacheFile(rootDir, moduleId), null);

  // Round-trip.
  const records = {
    'rr-0001-clinical-1': {
      key: baselineKey(),
      result: { schemaViolations: [], rosterViolation: null, signatureViolation: null, chainViolation: null },
    },
  };
  await writeCacheFileAtomic(rootDir, moduleId, records);
  const readBack = await readCacheFile(rootDir, moduleId);
  assert.ok(readBack);
  assert.equal(readBack.moduleId, moduleId);
  assert.equal(readBack.root, path.resolve(rootDir));
  assert.deepEqual(readBack.records, records);

  // Corrupt JSON on disk.
  const filePath = resolveCacheFilePath(rootDir, moduleId);
  await writeFile(filePath, 'this is not valid JSON {{{', 'utf8');
  assert.equal(await readCacheFile(rootDir, moduleId), null);

  // Foreign/wrong shape: valid JSON, but not this module's own shape (e.g. wrong moduleId inside,
  // or a missing `records` key) -- fail closed rather than trusting a stray file at the same path.
  await writeFile(filePath, JSON.stringify({ cacheFormatVersion: 1, root: path.resolve(rootDir), moduleId: 'someone-elses-module', records: {} }), 'utf8');
  assert.equal(await readCacheFile(rootDir, moduleId), null);

  await writeFile(filePath, JSON.stringify({ cacheFormatVersion: 999, root: path.resolve(rootDir), moduleId, records: {} }), 'utf8');
  assert.equal(await readCacheFile(rootDir, moduleId), null);

  await writeFile(filePath, JSON.stringify({ cacheFormatVersion: 1, root: path.resolve(rootDir), moduleId }), 'utf8');
  assert.equal(await readCacheFile(rootDir, moduleId), null);
});

test('writeCacheFileAtomic leaves no orphaned temp file behind (atomic write-then-rename)', async () => {
  const rootDir = '/fake/repo/root/for/cache/unit/tests';
  const moduleId = `cache_unit_atomic_v1_${Date.now()}`;
  await writeCacheFileAtomic(rootDir, moduleId, {});
  const entries = await readdir(path.dirname(resolveCacheFilePath(rootDir, moduleId)));
  const orphanedTmp = entries.filter((name) => name.startsWith('.tmp-'));
  assert.deepEqual(orphanedTmp, [], `expected no leftover .tmp- files, found: ${JSON.stringify(orphanedTmp)}`);
});

// -------------------------------------------------------------------------------------------
// (B) validate.mjs — CLI-level integration proof (cross-process warmth + fail-closed invalidation)
// -------------------------------------------------------------------------------------------

test('cross-process warmth: a second, separate node process reuses per-record results the first process cached (marker/call-count, not wall-clock)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-validate-cache-warmth-'));
  try {
    const moduleId = 'cache_warmth_v1';
    await buildSignedChain(tmp, moduleId, ['clinical-1', 'lab']);

    const cold = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(cold.status, EXIT_OK, cold.stderr);
    const coldMarker = parseCacheMarker(cold.stdout);
    assert.deepEqual(coldMarker, { hits: 0, misses: 2, scoped: 2 }, 'first (cold) process must recompute both records');

    const warm = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(warm.status, EXIT_OK, warm.stderr);
    const warmMarker = parseCacheMarker(warm.stdout);
    assert.deepEqual(warmMarker, { hits: 2, misses: 0, scoped: 2 }, 'second (warm), SEPARATE process must reuse both records from the persistent cache');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('--record narrowing consults/caches only the scoped record, independently of the other record\'s own cache warmth', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-validate-cache-record-scope-'));
  try {
    const moduleId = 'cache_record_scope_v1';
    const [r1, r2] = await buildSignedChain(tmp, moduleId, ['clinical-1', 'lab']);

    const firstOnlyCold = runCli(['validate', '--module', moduleId, '--record', r1, '--root', tmp]);
    assert.equal(firstOnlyCold.status, EXIT_OK, firstOnlyCold.stderr);
    assert.deepEqual(parseCacheMarker(firstOnlyCold.stdout), { hits: 0, misses: 1, scoped: 1 });

    const firstOnlyWarm = runCli(['validate', '--module', moduleId, '--record', r1, '--root', tmp]);
    assert.equal(firstOnlyWarm.status, EXIT_OK, firstOnlyWarm.stderr);
    assert.deepEqual(parseCacheMarker(firstOnlyWarm.stdout), { hits: 1, misses: 0, scoped: 1 });

    // r2 was never scoped by either call above -- its first appearance in a full --module call is
    // still a fresh miss, proving the cache tracks warmth PER RECORD, not per module-wide call.
    const fullModule = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(fullModule.status, EXIT_OK, fullModule.stderr);
    assert.deepEqual(parseCacheMarker(fullModule.stdout), { hits: 1, misses: 1, scoped: 2 }, `expected r1 warm + r2 cold; r2=${r2}`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('roster file byte-level change forces recompute of every scoped record (F3), and a genuine roster removal is actually re-caught (not blindly reused stale)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-validate-cache-roster-'));
  try {
    const moduleId = 'cache_roster_change_v1';
    await buildSignedChain(tmp, moduleId, ['clinical-1', 'lab']);

    const cold = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(cold.status, EXIT_OK, cold.stderr);
    assert.deepEqual(parseCacheMarker(cold.stdout), { hits: 0, misses: 2, scoped: 2 });

    const warm = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(warm.status, EXIT_OK, warm.stderr);
    assert.deepEqual(parseCacheMarker(warm.stdout), { hits: 2, misses: 0, scoped: 2 }, 'sanity: cache is warm before the roster mutation');

    // Byte-level-only mutation (harmless trailing comment) -- does not change WHICH reviewers
    // resolve, only the file's own bytes (and therefore rosterFileHash).
    const rosterPath = path.join(tmp, 'governance', 'reviewer-roster.yaml');
    const rosterRaw = await readFile(rosterPath, 'utf8');
    await writeFile(rosterPath, `${rosterRaw}# byte-level-only mutation for cache-invalidation test\n`, 'utf8');

    const afterByteChange = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(afterByteChange.status, EXIT_OK, afterByteChange.stderr);
    assert.deepEqual(
      parseCacheMarker(afterByteChange.stdout),
      { hits: 0, misses: 2, scoped: 2 },
      'a roster file byte change alone must force full per-record recompute, even though nobody\'s resolution outcome changed',
    );

    // Now a SEMANTIC roster change (remove the first record's reviewer entirely) -- proves the
    // cache is not just "recomputing and re-caching the same stale answer": the re-evaluation must
    // actually observe the new roster content and fail closed on it.
    await writeFixtureRoster(tmp, [{ reviewerId: 'cache-fixture-reviewer-2', moduleId, label: 'lab only, post-removal' }]);
    const afterRemoval = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(afterRemoval.status, EXIT_USAGE);
    assert.match(afterRemoval.stderr, /does not resolve to any entry in governance\/reviewer-roster\.yaml/);
    assert.deepEqual(parseCacheMarker(afterRemoval.stdout), { hits: 0, misses: 2, scoped: 2 });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('a non-immediate predecessor\'s content change forces recompute of a LATER record whose own bytes AND immediate predecessor are both untouched (F3: complete predecessor set, not the record+immediate-predecessor pair alone)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-validate-cache-predecessor-'));
  try {
    const moduleId = 'cache_predecessor_set_v1';
    // r1=clinical-1, r2=lab, r3=lab -- avoids FR-4 independence (needs BOTH clinical-1 AND
    // clinical-2) and adjudication/release-authorization (neither role present) entirely, so this
    // test isolates the per-record cache mechanism cleanly.
    const [r1, r2, r3] = await buildSignedChain(tmp, moduleId, ['clinical-1', 'lab', 'lab']);

    const cold = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(cold.status, EXIT_OK, cold.stderr);
    assert.deepEqual(parseCacheMarker(cold.stdout), { hits: 0, misses: 3, scoped: 3 });

    const warm = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(warm.status, EXIT_OK, warm.stderr);
    assert.deepEqual(parseCacheMarker(warm.stdout), { hits: 3, misses: 0, scoped: 3 }, `sanity: fully warm before mutation (r1=${r1}, r2=${r2}, r3=${r3})`);

    // Mutate ONLY the grandparent (r1)'s rationale. r2's own bytes AND its immediate-predecessor
    // relationship to r1 are what a NARROWER "record + immediate predecessor" cache would still
    // see as unchanged for r3 (r3's own bytes untouched, r3's immediate predecessor r2 untouched)
    // -- proving this specifically requires the FULL predecessor-set hash, not just the immediate
    // pair, to correctly invalidate r3 too.
    await mutateRationale(
      recordFilePathFor(tmp, moduleId, r1),
      'Grandparent record mutated for the F3 complete-predecessor-set regression check.',
    );

    const afterGrandparentMutation = runCli(['validate', '--module', moduleId, '--root', tmp]);
    // This call now genuinely fails (r1's signature no longer verifies against its mutated bytes,
    // and the chain break propagates) -- irrelevant to this test's own claim, which is purely about
    // the cache's hit/miss accounting, always printed before any possible failure (see validate.mjs
    // P2-T3 addendum).
    assert.deepEqual(
      parseCacheMarker(afterGrandparentMutation.stdout),
      { hits: 0, misses: 3, scoped: 3 },
      'r1 (own content changed) AND r2/r3 (predecessor-set hash changed, even though r2/r3\'s own bytes and r2\'s immediate-predecessor relationship to r1\'s NEW content are otherwise self-consistent) must ALL miss',
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('a warm per-record cache never masks a module-wide (FR-4 reviewer-2 independence) violation -- module-wide checks always re-run and still catch it', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-validate-cache-modulewide-'));
  try {
    const moduleId = 'cache_modulewide_independence_v1';
    await writeFixtureRoster(tmp, [
      { reviewerId: 'cache-mw-clinical-1', moduleId, label: 'module-wide fixture, clinical-1' },
      { reviewerId: 'cache-mw-clinical-2', moduleId, label: 'module-wide fixture, clinical-2' },
    ]);

    const scaffold1 = await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'cache-mw-clinical-1',
      decision: 'approve', rationale: 'Independent first assessment, formed without reading any prior act.',
      subject: SUBJECT_HASH, reviewedAt: '2026-03-10T00:00:00Z', root: tmp, draft: true,
      // CRW-F5 revision (BLOCKER 2): no modules/<moduleId>/ content under this tmp root -- see the
      // comment on buildSignedChain's own scaffold call above.
      allowHistoricalSubject: true,
    });
    assert.equal(scaffold1, EXIT_OK);
    const draft1 = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    assert.equal(await runSign({ draft: draft1, module: moduleId, root: tmp }), EXIT_OK);

    // Deliberately references clinical-1's reviewerId -- the seeded FR-4 independence violation
    // (mirrors tests/ef-review-workflow.test.mjs's own "checkReviewerIndependence flags a
    // clinical-2 rationale that names clinical-1's reviewerId" fixture).
    const scaffold2 = await runScaffold({
      module: moduleId, role: 'clinical-2', reviewerId: 'cache-mw-clinical-2',
      decision: 'approve', rationale: 'Per cache-mw-clinical-1 I independently agree with this assessment.',
      subject: SUBJECT_HASH, reviewedAt: '2026-03-10T00:05:00Z', root: tmp, draft: true,
      // CRW-F5 revision (BLOCKER 2): same reason as scaffold1 above -- no modules/<moduleId>/
      // content under this tmp root.
      allowHistoricalSubject: true,
    });
    assert.equal(scaffold2, EXIT_OK);
    const draft2 = draftFilePathFor(tmp, moduleId, 'rr-0002-clinical-2');
    assert.equal(await runSign({ draft: draft2, module: moduleId, root: tmp }), EXIT_OK);

    const cold = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(cold.status, EXIT_USAGE, 'expected the seeded independence violation to fail closed on the cold run');
    assert.match(cold.stderr, /references clinical-1 reviewerId/);
    assert.deepEqual(parseCacheMarker(cold.stdout), { hits: 0, misses: 2, scoped: 2 });

    const warm = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(
      warm.status, EXIT_USAGE,
      'the SAME independence violation must still fail closed on the warm run -- a warm per-record cache must never mask a module-wide finding',
    );
    assert.match(warm.stderr, /references clinical-1 reviewerId/);
    assert.deepEqual(
      parseCacheMarker(warm.stdout),
      { hits: 2, misses: 0, scoped: 2 },
      'the per-record bundle (schema/roster/signature/chain-link) is fully warm, yet the module-wide independence check still ran and still caught the violation',
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('an unknown --record still throws UsageError before any cache I/O begins (sanity: no orphaned cache file created for a --record that was never found)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-validate-cache-badrecord-'));
  try {
    const moduleId = 'cache_badrecord_v1';
    await buildSignedChain(tmp, moduleId, ['clinical-1']);
    await assert.rejects(
      () => runValidate({ module: moduleId, root: tmp, record: 'rr-9999-lab' }),
      UsageError,
    );
    // No cache file should have been created for this module -- the UsageError throws before any
    // cache I/O begins.
    assert.equal(await readCacheFile(tmp, moduleId), null);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('validate-cache marker line is present in tools/review-record/lib/verbs/validate.mjs\'s own output shape (documentation/regression guard for the parser above)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-validate-cache-markershape-'));
  try {
    const moduleId = 'cache_markershape_v1';
    await buildSignedChain(tmp, moduleId, ['clinical-1']);
    const { status, stdout, stderr } = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(status, EXIT_OK, stderr);
    assert.match(stdout, /validate-cache: hits=\d+ misses=\d+ of \d+ scoped record\(s\)/);
    assert.match(stdout, /module-wide checks .* always re-run this invocation, never cache-eligible \(R9\)/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// (C) Fix-cycle addendum (Wave-2 gate, BLOCKER 3, CRW-F9) — per-entry structural hardening.
// `readCacheFile`'s existing coverage above ("Corrupt JSON on disk" / "Foreign/wrong shape" in the
// "readCacheFile / writeCacheFileAtomic" test) already proves acceptance criterion (ii) — a
// truncated/corrupt cache FILE fails closed to `null` (a full-file miss) — so this section adds
// only the NEW per-ENTRY coverage BLOCKER 3 actually required: (i) a well-formed-JSON entry whose
// stored RESULT has a malformed shape, (iii) one whose stored KEY has wrong-typed composite-key
// fields, and (iv) an end-to-end proof that a poisoned-shape cache never changes `validate`'s
// outcome on a module with a real violation, versus a genuinely cold cache.
// -------------------------------------------------------------------------------------------

test('getCachedRecordResult: a well-formed-JSON entry with a malformed RESULT shape (missing field / wrong type / extra field) is a MISS, never a crash or pass-through (BLOCKER 3, CRW-F9)', () => {
  const key = baselineKey();
  const reviewId = 'rr-0001-clinical-1';
  const validResult = { schemaViolations: [], rosterViolation: null, signatureViolation: null, chainViolation: null };

  const malformedResults = [
    // Missing a required field entirely.
    { rosterViolation: null, signatureViolation: null, chainViolation: null },
    // schemaViolations wrong type: not an array at all.
    { ...validResult, schemaViolations: 'not-an-array' },
    // schemaViolations wrong type: array of non-strings.
    { ...validResult, schemaViolations: [1, 2, 3] },
    // rosterViolation wrong type: number instead of string-or-null.
    { ...validResult, rosterViolation: 42 },
    // signatureViolation wrong type: an injected object masquerading as "no violation".
    { ...validResult, signatureViolation: { ok: true } },
    // chainViolation wrong type: boolean instead of string-or-null.
    { ...validResult, chainViolation: false },
    // Extra, unexpected property alongside an otherwise-correct shape.
    { ...validResult, injected: 'attacker-controlled-extra-field' },
  ];

  for (const malformedResult of malformedResults) {
    const records = { [reviewId]: { key, result: malformedResult } };
    assert.equal(
      getCachedRecordResult(records, reviewId, key),
      null,
      `expected a MISS for malformed result shape: ${JSON.stringify(malformedResult)}`,
    );
  }

  // Sanity: the SAME key against a genuinely well-shaped result is still a HIT (proves the
  // rejections above are shape-driven, not an accidental blanket miss).
  const goodRecords = { [reviewId]: { key, result: validResult } };
  assert.deepEqual(getCachedRecordResult(goodRecords, reviewId, key), validResult);
});

test('getCachedRecordResult: an entry whose RESULT is well-shaped but whose stored KEY has wrong-typed composite-key fields is a MISS, checked before comparison (BLOCKER 3, CRW-F9)', () => {
  const key = baselineKey();
  const reviewId = 'rr-0001-clinical-1';
  const validResult = { schemaViolations: [], rosterViolation: null, signatureViolation: null, chainViolation: null };

  const malformedKeys = [
    { ...key, recordContentHash: 12345 }, // number instead of string
    { ...key, predecessorSetHash: null }, // null instead of string
    { ...key, validatorPolicyVersion: '1' }, // string instead of integer
    { ...key, validatorPolicyVersion: 1.5 }, // non-integer number
    { ...key, historyMode: 'false' }, // string instead of boolean
    (() => { const { historyMode: _drop, ...rest } = key; return rest; })(), // missing field
    { ...key, extraKeyField: 'unexpected' }, // extra field
  ];

  for (const malformedKey of malformedKeys) {
    const records = { [reviewId]: { key: malformedKey, result: validResult } };
    assert.equal(
      getCachedRecordResult(records, reviewId, key),
      null,
      `expected a MISS for malformed key shape: ${JSON.stringify(malformedKey)}`,
    );
  }
});

test('getCachedRecordResult: malformed cacheRecords container itself (not an object, or an entry that is not a {key, result} object) is a MISS, never a crash (BLOCKER 3, CRW-F9)', () => {
  const key = baselineKey();
  const reviewId = 'rr-0001-clinical-1';

  assert.equal(getCachedRecordResult(null, reviewId, key), null);
  assert.equal(getCachedRecordResult(undefined, reviewId, key), null);
  assert.equal(getCachedRecordResult('not-an-object', reviewId, key), null);
  assert.equal(getCachedRecordResult({ [reviewId]: 'not-an-object' }, reviewId, key), null);
  assert.equal(getCachedRecordResult({ [reviewId]: null }, reviewId, key), null);
  assert.equal(getCachedRecordResult({ [reviewId]: { key } }, reviewId, key), null, 'entry missing its result field');
  assert.equal(
    getCachedRecordResult(
      { [reviewId]: { key, result: { schemaViolations: [], rosterViolation: null, signatureViolation: null, chainViolation: null }, extra: 'nope' } },
      reviewId,
      key,
    ),
    null,
    'entry with an extra top-level property beyond {key, result}',
  );
});

test('a well-formed-JSON entry with a malformed RESULT shape never crashes a real validate run end-to-end -- treated as a MISS, silently recomputed, correct passing outcome unaffected (BLOCKER 3, CRW-F9)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-validate-cache-poison-noCrash-'));
  try {
    const moduleId = 'cache_poison_nocrash_v1';
    const [r1, r2] = await buildSignedChain(tmp, moduleId, ['clinical-1', 'lab']);

    const cold = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(cold.status, EXIT_OK, cold.stderr);
    assert.deepEqual(parseCacheMarker(cold.stdout), { hits: 0, misses: 2, scoped: 2 });

    // Poison r1's cached RESULT with a value that would THROW if ever spread with `...` (a plain
    // object has no default iterator) -- exactly the shape `validate.mjs`'s
    // `violations.push(...result.schemaViolations)` would previously have handed straight to the
    // JS runtime. Its stored KEY is left byte-for-byte untouched, so a naive re-check would treat
    // it as a matching, "trustworthy" entry.
    const existingCache = await readCacheFile(tmp, moduleId);
    assert.ok(existingCache, 'expected the cold run above to have written a cache file');
    const poisonedRecords = {
      ...existingCache.records,
      [r1]: {
        ...existingCache.records[r1],
        result: { schemaViolations: { poisoned: true }, rosterViolation: null, signatureViolation: null, chainViolation: null },
      },
    };
    await writeCacheFileAtomic(tmp, moduleId, poisonedRecords);

    const afterPoison = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(afterPoison.status, EXIT_OK, `expected NO crash and a clean pass, got stderr:\n${afterPoison.stderr}`);
    assert.doesNotMatch(afterPoison.stderr, /internal error/, 'a malformed cached result must never surface as an uncaught internal error');
    assert.match(afterPoison.stdout, /OK — 2 record\(s\) validated/, 'the marker line proves the per-record loop ran to completion without throwing');
    assert.deepEqual(
      parseCacheMarker(afterPoison.stdout),
      { hits: 1, misses: 1, scoped: 2 },
      `expected r1 (poisoned shape) to MISS and recompute while r2 stays a clean HIT (r1=${r1}, r2=${r2})`,
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('validate\'s outcome on a module with a REAL violation is IDENTICAL whether a poisoned-shape (well-formed-JSON, malformed-RESULT) cache entry is present at correct composite-key values, or the cache is genuinely cold (BLOCKER 3, CRW-F9)', async () => {
  const moduleId = 'cache_poison_real_violation_v1';
  const trueColdTmp = await mkdtemp(path.join(tmpdir(), 'ef-validate-cache-poison-cold-'));
  const poisonedTmp = await mkdtemp(path.join(tmpdir(), 'ef-validate-cache-poison-warm-'));
  try {
    // Identical construction in two separate roots: a single-record module, then its ONLY
    // roster entry is removed entirely -- a genuine per-record roster-resolution violation
    // (mirrors this file's existing "genuine roster removal is actually re-caught" test).
    const [trueColdReviewId] = await buildSignedChain(trueColdTmp, moduleId, ['clinical-1']);
    await rm(path.join(trueColdTmp, 'governance', 'reviewer-roster.yaml'));

    const [poisonedReviewId] = await buildSignedChain(poisonedTmp, moduleId, ['clinical-1']);
    assert.equal(poisonedReviewId, trueColdReviewId, 'both roots must construct the identically-named record');
    await rm(path.join(poisonedTmp, 'governance', 'reviewer-roster.yaml'));

    // Inject a poisoned-shape (all-clear, but MALFORMED -- missing `chainViolation`) entry into
    // `poisonedTmp`'s cache under the CORRECT composite-key values for this exact on-disk state
    // (post-roster-removal) -- an attacker's best attempt at suppressing the roster violation via
    // a well-formed-JSON-but-wrong-shaped forged result. This must still MISS on shape alone.
    const { key: correctKeyForCurrentState } = await computeExpectedKeyForRecord(poisonedTmp, moduleId, 0);
    const forgedAllClearButMalformedResult = { schemaViolations: [], rosterViolation: null, signatureViolation: null }; // missing chainViolation
    await writeCacheFileAtomic(poisonedTmp, moduleId, {
      [poisonedReviewId]: { key: correctKeyForCurrentState, result: forgedAllClearButMalformedResult },
    });

    const trueCold = runCli(['validate', '--module', moduleId, '--root', trueColdTmp]);
    const poisoned = runCli(['validate', '--module', moduleId, '--root', poisonedTmp]);

    assert.equal(trueCold.status, EXIT_USAGE, 'sanity: the genuinely cold run must fail on the real roster violation');
    assert.equal(
      poisoned.status,
      EXIT_USAGE,
      'the poisoned-shape cache must NOT suppress the real violation -- outcome must match the cold run',
    );

    const violationPattern = /does not resolve to any entry in governance\/reviewer-roster\.yaml/;
    assert.match(trueCold.stderr, violationPattern);
    assert.match(poisoned.stderr, violationPattern);
    assert.equal(
      poisoned.stderr,
      trueCold.stderr,
      'the poisoned-shape-cache run\'s reported violation text must be byte-identical to the cold run\'s',
    );

    // Both runs must show a full per-record MISS for this record -- the poisoned entry was never
    // usable as a hit (shape-rejected before `keysMatch` was ever consulted).
    assert.deepEqual(parseCacheMarker(trueCold.stdout), { hits: 0, misses: 1, scoped: 1 });
    assert.deepEqual(parseCacheMarker(poisoned.stdout), { hits: 0, misses: 1, scoped: 1 });
  } finally {
    await rm(trueColdTmp, { recursive: true, force: true });
    await rm(poisonedTmp, { recursive: true, force: true });
  }
});
