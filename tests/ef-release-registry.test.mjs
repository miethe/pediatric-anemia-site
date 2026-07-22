// tests/ef-release-registry.test.mjs — evidence-foundry-e1 P3-T4 (FR-14/OQ-4).
//
// Task acceptance criteria (.claude/progress/evidence-foundry-e1/phase-3-progress.md, row P3-T4):
//   1. `releases/registry.json` exists at repo root: top-level `schemaVersion` + empty `entries[]`,
//      validating against `schemas/release-registry.schema.json` (P1-T5).
//   2. `register` appends an entry — dry-run candidates carry the structural dry-run marker in
//      `register`'s OWN reporting object (never in the persisted registry entry, which has no such
//      field); real (unsigned, pre-G2) entries have `signature: null`, same as dry-run ones — the
//      registry NEVER bears a real signature under this schema version, regardless of input shape.
//   3. `register` rejects any mutation/removal of an existing entry — append-only, git-tracked,
//      the same two-layer approach as P2-T3 (in-process + git-history walk), adapted to this
//      registry's flat single-document shape rather than review-record's one-file-per-record shape.
//   4. E1 never sets `withdrawalState != "none"` — validator-enforced `const` (P1-T5's own schema),
//      re-asserted here at the `register`-output level.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runManifest } from '../tools/release-sign/lib/manifest.mjs';
import { run as runSign } from '../tools/release-sign/lib/sign.mjs';
import {
  run as runRegister,
  stableStringify,
  assertEntriesPrefixPreserving,
  assertRegisterAppendsExactlyOne,
  checkRegistryHistoryAppendOnly,
} from '../tools/release-sign/lib/registry.mjs';
import { computePackDigest } from '../tools/release-sign/lib/pack-digest.mjs';
import { readCanonicalManifestBytes } from '../tools/release-sign/lib/canonical-bytes.mjs';
import { validate as validateSchema } from '../scripts/lib/json-schema-lite.mjs';
import {
  UsageError,
  RegisterByteDriftError,
  RegisterRealCandidateSignedError,
  RegistrySchemaInvalidError,
  RegistryDuplicateEntryError,
  RegistryAppendOnlyViolationError,
} from '../tools/release-sign/lib/errors.mjs';
import { main as cliMain } from '../tools/release-sign/cli.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');
const REGISTRY_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-registry.schema.json');

async function withCapturedStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  let output = '';
  process.stdout.write = (chunk) => {
    output += chunk;
    return true;
  };
  try {
    const result = await fn();
    return { result, output };
  } finally {
    process.stdout.write = original;
  }
}

/** Builds a fresh real kb-pack (via propose, delegated through `manifest`) in a tmpdir. Caller owns cleanup. */
async function buildFreshPack() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-pack-'));
  await withCapturedStdout(() =>
    runManifest({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir }),
  );
  return outDir;
}

async function seedRegistry(dir) {
  const registryPath = path.join(dir, 'registry.json');
  await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [] }, null, 2)}\n`, 'utf8');
  return registryPath;
}

async function readJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

// =================================================================================================
// AC1 — the committed seed file itself.
// =================================================================================================

test('AC1: the committed releases/registry.json seed is exactly {schemaVersion: 1, entries: []} and validates cleanly', async () => {
  const seedPath = path.join(REPO_ROOT, 'releases', 'registry.json');
  const raw = await readFile(seedPath, 'utf8');
  const doc = JSON.parse(raw);
  assert.deepEqual(doc, { schemaVersion: 1, entries: [] });
  assert.equal(raw, `${JSON.stringify(doc, null, 2)}\n`, 'the seed file must use the same 2-space, trailing-newline JSON formatting register itself writes');

  const schema = JSON.parse(await readFile(REGISTRY_SCHEMA_PATH, 'utf8'));
  assert.deepEqual(validateSchema(schema, doc), []);
});

// =================================================================================================
// AC2 — `register` happy paths: a dry-run signed candidate, and a fully unsigned (pre-G2, no sign
// step at all) real candidate. Both produce a persisted entry with `signature: null`.
// =================================================================================================

test('AC2a: register appends a schema-valid entry from a dry-run signed candidate; dryRun surfaces only in register\'s OWN report, never on the persisted entry', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-work-'));
  try {
    const candidatePath = path.join(workDir, 'candidate.json');
    const { result: signed } = await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true, keyId: 'ef-p3t4-demo', outCandidate: candidatePath }),
    );
    const registryPath = await seedRegistry(workDir);

    const { result, output } = await withCapturedStdout(() =>
      runRegister({ candidate: candidatePath, registry: registryPath }),
    );

    assert.equal(result.dryRun, true, 'register\'s own report surfaces the candidate\'s dryRun marker');
    assert.equal(result.entryIndex, 0);
    assert.equal(result.totalEntries, 1);
    assert.match(output, /"totalEntries": 1/);

    const entry = result.entry;
    assert.equal(entry.version, signed.manifest.packVersion);
    assert.equal(entry.moduleId, signed.manifest.moduleId);
    assert.equal(entry.manifestDigest, signed.preimageSha256);
    assert.match(entry.packDigest, /^sha256:[0-9a-f]{64}$/);
    // The persisted entry itself carries NO trace of dryRun/TESTKEY- — signature is always null.
    assert.equal(entry.signature, null);
    assert.equal(entry.signedAt, null);
    assert.equal(entry.supersedes, null);
    assert.equal(entry.withdrawalState, 'none');
    assert.equal(entry.withdrawnAt, null);
    assert.equal(entry.withdrawalReason, null);
    assert.deepEqual(Object.keys(entry).sort(), [
      'manifestDigest', 'moduleId', 'packDigest', 'signature', 'signedAt', 'supersedes',
      'version', 'withdrawalReason', 'withdrawalState', 'withdrawnAt',
    ]);

    const onDisk = await readJson(registryPath);
    assert.deepEqual(onDisk, { schemaVersion: 1, entries: [entry] });
    const schema = JSON.parse(await readFile(REGISTRY_SCHEMA_PATH, 'utf8'));
    assert.deepEqual(validateSchema(schema, onDisk), []);
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});

test('AC2b: register appends a schema-valid entry from a fully unsigned, pre-G2 real candidate (manifest verb output, no sign step at all)', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-work-'));
  try {
    const { result: manifestCandidate } = await withCapturedStdout(() => runManifest({ pack: packDir }));
    assert.ok(!Object.hasOwn(manifestCandidate, 'signature'), 'sanity: the bare manifest-verb candidate carries no signature field at all');
    assert.ok(!Object.hasOwn(manifestCandidate, 'dryRun'));

    const candidatePath = path.join(workDir, 'manifest-candidate.json');
    await writeFile(candidatePath, `${JSON.stringify(manifestCandidate, null, 2)}\n`, 'utf8');
    const registryPath = await seedRegistry(workDir);

    const { result } = await withCapturedStdout(() => runRegister({ candidate: candidatePath, registry: registryPath }));

    assert.equal(result.dryRun, false);
    assert.equal(result.entry.signature, null);
    assert.equal(result.entry.withdrawalState, 'none');

    const { manifestPath: freshManifestPath } = await readCanonicalManifestBytes(packDir);
    const manifestJson = JSON.parse(await readFile(freshManifestPath, 'utf8'));
    assert.equal(result.entry.moduleId, manifestJson.moduleId);
    assert.equal(result.entry.version, manifestJson.packVersion);
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});

test('AC2c: register never trusts the candidate\'s own moduleId/version claims — it re-derives both from a fresh packDir read', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-work-'));
  try {
    const candidatePath = path.join(workDir, 'candidate.json');
    await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true, keyId: 'ef-p3t4-tamper', outCandidate: candidatePath }),
    );
    const candidateRaw = await readJson(candidatePath);
    // Hand-tamper the embedded manifest sub-object's identity fields — register must ignore them.
    candidateRaw.manifest.moduleId = 'not_the_real_module';
    candidateRaw.manifest.packVersion = '99.9.9-fake';
    await writeFile(candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');
    const registryPath = await seedRegistry(workDir);

    const { result } = await withCapturedStdout(() => runRegister({ candidate: candidatePath, registry: registryPath }));

    assert.notEqual(result.entry.moduleId, 'not_the_real_module');
    assert.notEqual(result.entry.version, '99.9.9-fake');
    assert.equal(result.entry.moduleId, 'cbc_suite_v1');
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// AC3a — packDigest: deterministic, and sensitive to any file content change under packDir.
// =================================================================================================

test('computePackDigest is deterministic across repeated calls, and changes when pack content changes', async () => {
  const packDir = await buildFreshPack();
  try {
    const first = await computePackDigest(packDir);
    const second = await computePackDigest(packDir);
    assert.equal(first.sha256, second.sha256);
    assert.ok(first.files.length > 1, 'sanity: a real staged pack has more than one file');
    assert.deepEqual(first.files, [...first.files].sort(), 'file list must be sorted');

    const someFile = path.join(packDir, first.files[0]);
    const original = await readFile(someFile, 'utf8');
    await writeFile(someFile, `${original}\n`, 'utf8');
    const third = await computePackDigest(packDir);
    assert.notEqual(third.sha256, first.sha256);
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('computePackDigest fails closed on a missing or empty pack directory', async () => {
  await assert.rejects(() => computePackDigest(path.join(os.tmpdir(), 'ef-release-registry-does-not-exist')), UsageError);
  const emptyDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-empty-'));
  try {
    await assert.rejects(() => computePackDigest(emptyDir), UsageError);
  } finally {
    await rm(emptyDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// Fail-closed classes — every rejection leaves the on-disk registry byte-identical to before the
// call (no partial write).
// =================================================================================================

async function buildDryRunCandidate(workDir, packDir, keyId = 'ef-p3t4-fixture') {
  const candidatePath = path.join(workDir, 'candidate.json');
  await withCapturedStdout(() => runSign({ candidate: packDir, dryRun: true, keyId, outCandidate: candidatePath }));
  return candidatePath;
}

test('register: a candidate preimageSha256 that disagrees with a fresh re-read fails closed with RegisterByteDriftError, registry untouched', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-work-'));
  try {
    const candidatePath = await buildDryRunCandidate(workDir, packDir);
    const candidateRaw = await readJson(candidatePath);
    candidateRaw.preimageSha256 = `sha256:${'9'.repeat(64)}`;
    await writeFile(candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');
    const registryPath = await seedRegistry(workDir);
    const before = await readFile(registryPath, 'utf8');

    await assert.rejects(
      () => runRegister({ candidate: candidatePath, registry: registryPath }),
      (err) => {
        assert.ok(err instanceof RegisterByteDriftError);
        return true;
      },
    );
    assert.equal(await readFile(registryPath, 'utf8'), before);
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});

test('register: a non-dry-run candidate carrying a populated signature is rejected outright with RegisterRealCandidateSignedError, registry untouched', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-work-'));
  try {
    const candidatePath = await buildDryRunCandidate(workDir, packDir);
    const candidateRaw = await readJson(candidatePath);
    // Simulate a hand-crafted "looks real" candidate: dryRun stripped, but the (still cryptographically
    // valid, still TESTKEY-marked) signature left in place — register must reject on shape alone, before
    // ever reasoning about whether the signature itself is trustworthy (that is verify's job, not register's).
    delete candidateRaw.dryRun;
    await writeFile(candidatePath, `${JSON.stringify(candidateRaw, null, 2)}\n`, 'utf8');
    const registryPath = await seedRegistry(workDir);
    const before = await readFile(registryPath, 'utf8');

    await assert.rejects(
      () => runRegister({ candidate: candidatePath, registry: registryPath }),
      (err) => {
        assert.ok(err instanceof RegisterRealCandidateSignedError);
        return true;
      },
    );
    assert.equal(await readFile(registryPath, 'utf8'), before);
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});

test('register: an already schema-invalid --registry document is rejected with RegistrySchemaInvalidError before any write is attempted', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-work-'));
  try {
    const candidatePath = await buildDryRunCandidate(workDir, packDir);
    const registryPath = path.join(workDir, 'registry.json');
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [{ garbage: true }] }, null, 2)}\n`, 'utf8');
    const before = await readFile(registryPath, 'utf8');

    await assert.rejects(
      () => runRegister({ candidate: candidatePath, registry: registryPath }),
      RegistrySchemaInvalidError,
    );
    assert.equal(await readFile(registryPath, 'utf8'), before);
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});

test('register: a duplicate moduleId/version entry already present is rejected with RegistryDuplicateEntryError, registry untouched', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-work-'));
  try {
    const candidatePath = await buildDryRunCandidate(workDir, packDir);
    const registryPath = await seedRegistry(workDir);

    await withCapturedStdout(() => runRegister({ candidate: candidatePath, registry: registryPath }));
    const afterFirst = await readFile(registryPath, 'utf8');

    // A second candidate for the SAME pack (fresh sign call, different signature bytes, same
    // moduleId/packVersion) must still be rejected as a duplicate — uniqueness is per moduleId/version,
    // not per literal candidate file.
    const secondCandidatePath = await buildDryRunCandidate(workDir, packDir, 'ef-p3t4-second');
    await assert.rejects(
      () => runRegister({ candidate: secondCandidatePath, registry: registryPath }),
      RegistryDuplicateEntryError,
    );
    assert.equal(await readFile(registryPath, 'utf8'), afterFirst);
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});

test('register: missing --candidate/--registry, and an unreadable path, fail closed with UsageError', async () => {
  await assert.rejects(() => runRegister({}), UsageError);
  await assert.rejects(() => runRegister({ candidate: '/nonexistent/candidate.json' }), UsageError);

  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-work-'));
  try {
    const candidatePath = await buildDryRunCandidate(workDir, packDir);
    await assert.rejects(
      () => runRegister({ candidate: candidatePath, registry: '/nonexistent/registry.json' }),
      UsageError,
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// AC4 — E1 never sets withdrawalState != "none" (re-asserted at register-output level; the schema
// itself already enforces this as a `const`, P1-T5).
// =================================================================================================

test('AC4: no register code path can produce an entry with withdrawalState other than "none" — grep-level structural guard', async () => {
  const source = await readFile(path.join(REPO_ROOT, 'tools', 'release-sign', 'lib', 'registry.mjs'), 'utf8');
  const withdrawalStateAssignments = [...source.matchAll(/withdrawalState:\s*'([^']*)'/g)].map((m) => m[1]);
  assert.ok(withdrawalStateAssignments.length > 0, 'sanity: registry.mjs must assign withdrawalState somewhere');
  for (const value of withdrawalStateAssignments) {
    assert.equal(value, 'none', `registry.mjs must never literally assign withdrawalState a value other than "none" (found "${value}")`);
  }
});

// =================================================================================================
// AC3 — append-only enforcement, layer 1 (in-process primitives, unit-tested directly).
// =================================================================================================

test('assertEntriesPrefixPreserving accepts a pure append and rejects mutation/reorder/shrink', () => {
  const a = { moduleId: 'x', version: '1' };
  const b = { moduleId: 'y', version: '1' };
  assert.doesNotThrow(() => assertEntriesPrefixPreserving([a], [a, b], 'test'));
  assert.doesNotThrow(() => assertEntriesPrefixPreserving([], [a], 'test'));
  assert.doesNotThrow(() => assertEntriesPrefixPreserving([], [], 'test'));

  assert.throws(() => assertEntriesPrefixPreserving([a], [], 'test'), RegistryAppendOnlyViolationError);
  assert.throws(() => assertEntriesPrefixPreserving([a, b], [a], 'test'), RegistryAppendOnlyViolationError);
  assert.throws(
    () => assertEntriesPrefixPreserving([a], [{ moduleId: 'x', version: '2' }], 'test'),
    RegistryAppendOnlyViolationError,
  );
  assert.throws(() => assertEntriesPrefixPreserving([a, b], [b, a], 'test'), RegistryAppendOnlyViolationError, 'reorder must be rejected');
});

test('assertEntriesPrefixPreserving is key-order-independent (structural equality, not raw JSON.stringify equality)', () => {
  const a1 = { moduleId: 'x', version: '1' };
  const a2 = { version: '1', moduleId: 'x' }; // same content, different key order
  assert.notEqual(JSON.stringify(a1), JSON.stringify(a2), 'sanity: raw stringify differs');
  assert.equal(stableStringify(a1), stableStringify(a2));
  assert.doesNotThrow(() => assertEntriesPrefixPreserving([a1], [a2], 'test'));
});

test('assertRegisterAppendsExactlyOne rejects zero new entries, more than one new entry, and a schemaVersion change', () => {
  const base = { schemaVersion: 1, entries: [{ moduleId: 'x', version: '1' }] };
  assert.doesNotThrow(() =>
    assertRegisterAppendsExactlyOne(base, { schemaVersion: 1, entries: [...base.entries, { moduleId: 'y', version: '1' }] }),
  );
  assert.throws(
    () => assertRegisterAppendsExactlyOne(base, { schemaVersion: 1, entries: base.entries }),
    RegistryAppendOnlyViolationError,
    'zero new entries must be rejected',
  );
  assert.throws(
    () =>
      assertRegisterAppendsExactlyOne(base, {
        schemaVersion: 1,
        entries: [...base.entries, { moduleId: 'y', version: '1' }, { moduleId: 'z', version: '1' }],
      }),
    RegistryAppendOnlyViolationError,
    'more than one new entry must be rejected',
  );
  assert.throws(
    () => assertRegisterAppendsExactlyOne(base, { schemaVersion: 2, entries: [...base.entries, { moduleId: 'y', version: '1' }] }),
    RegistryAppendOnlyViolationError,
    'a schemaVersion change must be rejected',
  );
});

// =================================================================================================
// AC3 — append-only enforcement, layer 2 (git-history walk against a throwaway, disposable git
// repository this test builds and tears down itself — never this project's own repository).
// =================================================================================================

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'ef-release-registry-test',
  GIT_AUTHOR_EMAIL: 'ef-release-registry-test@example.invalid',
  GIT_COMMITTER_NAME: 'ef-release-registry-test',
  GIT_COMMITTER_EMAIL: 'ef-release-registry-test@example.invalid',
};

function gitCommit(repoDir, message) {
  execFileSync('git', ['add', '-A'], { cwd: repoDir, env: GIT_ENV, stdio: 'ignore' });
  execFileSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', message], { cwd: repoDir, env: GIT_ENV, stdio: 'ignore' });
}

async function initThrowawayRepo() {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-git-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: repoDir, env: GIT_ENV, stdio: 'ignore' });
  return repoDir;
}

test('checkRegistryHistoryAppendOnly returns 0 revisions for a file with no committed history yet', async () => {
  const repoDir = await initThrowawayRepo();
  try {
    const result = checkRegistryHistoryAppendOnly(repoDir, 'registry.json');
    assert.equal(result.revisions, 0);
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('checkRegistryHistoryAppendOnly walks a legitimate append-only commit sequence cleanly', async () => {
  const repoDir = await initThrowawayRepo();
  try {
    const registryPath = path.join(repoDir, 'registry.json');
    const entryA = {
      version: '1.0.0', moduleId: 'cbc_suite_v1', packDigest: `sha256:${'1'.repeat(64)}`,
      manifestDigest: `sha256:${'2'.repeat(64)}`, signature: null, signedAt: null, supersedes: null,
      withdrawalState: 'none', withdrawnAt: null, withdrawalReason: null,
    };
    const entryB = { ...entryA, version: '2.0.0', packDigest: `sha256:${'3'.repeat(64)}`, manifestDigest: `sha256:${'4'.repeat(64)}` };

    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'seed empty registry');

    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [entryA] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'register entryA');

    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [entryA, entryB] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'register entryB');

    const result = checkRegistryHistoryAppendOnly(repoDir, 'registry.json');
    assert.equal(result.revisions, 3);
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('checkRegistryHistoryAppendOnly fails closed on a committed mutation of an existing entry that bypassed register entirely', async () => {
  const repoDir = await initThrowawayRepo();
  try {
    const registryPath = path.join(repoDir, 'registry.json');
    const entryA = {
      version: '1.0.0', moduleId: 'cbc_suite_v1', packDigest: `sha256:${'1'.repeat(64)}`,
      manifestDigest: `sha256:${'2'.repeat(64)}`, signature: null, signedAt: null, supersedes: null,
      withdrawalState: 'none', withdrawnAt: null, withdrawalReason: null,
    };

    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [entryA] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'seed with entryA');

    // Hand-edit + commit a mutation directly — never went through `register` at all.
    const tampered = { ...entryA, withdrawalState: 'withdrawn' };
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [tampered] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'hand-edit entryA (bypassing register)');

    assert.throws(
      () => checkRegistryHistoryAppendOnly(repoDir, 'registry.json'),
      RegistryAppendOnlyViolationError,
    );
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('checkRegistryHistoryAppendOnly fails closed on a committed removal of an existing entry', async () => {
  const repoDir = await initThrowawayRepo();
  try {
    const registryPath = path.join(repoDir, 'registry.json');
    const entryA = {
      version: '1.0.0', moduleId: 'cbc_suite_v1', packDigest: `sha256:${'1'.repeat(64)}`,
      manifestDigest: `sha256:${'2'.repeat(64)}`, signature: null, signedAt: null, supersedes: null,
      withdrawalState: 'none', withdrawnAt: null, withdrawalReason: null,
    };

    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [entryA] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'seed with entryA');

    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'remove entryA (bypassing register)');

    assert.throws(
      () => checkRegistryHistoryAppendOnly(repoDir, 'registry.json'),
      RegistryAppendOnlyViolationError,
    );
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// CLI wiring.
// =================================================================================================

test('CLI: register dispatches end to end (exit 0, JSON on stdout) and a bare invocation exits 1', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-work-'));
  try {
    const candidatePath = await buildDryRunCandidate(workDir, packDir);
    const registryPath = await seedRegistry(workDir);

    const { result: exitCode, output } = await withCapturedStdout(() =>
      cliMain(['register', '--candidate', candidatePath, '--registry', registryPath]),
    );
    assert.equal(exitCode, 0);
    assert.match(output, /"totalEntries": 1/);

    const { result: bareExitCode } = await withCapturedStdout(() => cliMain(['register']));
    assert.equal(bareExitCode, 1);
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});
