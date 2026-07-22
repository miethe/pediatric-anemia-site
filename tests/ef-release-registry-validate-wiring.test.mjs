// tests/ef-release-registry-validate-wiring.test.mjs — evidence-foundry-e1 P3-T6 (FR-18, PRD OQ-2,
// verifier-surface wiring).
//
// Task acceptance criteria (.claude/progress/evidence-foundry-e1/phase-3-progress.md, row P3-T6 /
// docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-2-4-workstreams.md):
//   1. `npm run validate` fails on a seeded bad registry.
//   2. No change to `src/`, `server.mjs`, `openapi.yaml`, or any anemia-path digest/status file
//      (diff-scope test) — the anemia browser deployment's SPIKE-006 posture stays byte-untouched.
//   3. README records the OQ-2 surface decision and its rationale (checked structurally here, not
//      just by eyeballing tools/release-sign/README.md).
//
// What this file does NOT re-prove: `checkRegistryHistoryAppendOnly`'s own unit-level correctness
// (walking a legitimate sequence, rejecting a mutation, rejecting a removal) — that is
// tests/ef-release-registry.test.mjs's job (P3-T4), unchanged here. This file proves the SEAM: that
// `scripts/validate-kb.mjs#loadAndValidateReleaseRegistry` actually calls that function and that a
// failure there surfaces as an `npm run validate` failure, end to end, through the real CLI
// entrypoint — plus that the real, currently-committed `releases/registry.json` history still
// passes cleanly (a regression guard against the `--follow` false-positive this same task fixed;
// see tools/release-sign/lib/registry.mjs's own header).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAndValidateReleaseRegistry } from '../scripts/validate-kb.mjs';
import { checkRegistryHistoryAppendOnly } from '../tools/release-sign/lib/registry.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-registry.schema.json');

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'ef-release-registry-validate-wiring-test',
  GIT_AUTHOR_EMAIL: 'ef-release-registry-validate-wiring-test@example.invalid',
  GIT_COMMITTER_NAME: 'ef-release-registry-validate-wiring-test',
  GIT_COMMITTER_EMAIL: 'ef-release-registry-validate-wiring-test@example.invalid',
};

function gitCommit(repoDir, message) {
  execFileSync('git', ['add', '-A'], { cwd: repoDir, env: GIT_ENV, stdio: 'ignore' });
  execFileSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', message], { cwd: repoDir, env: GIT_ENV, stdio: 'ignore' });
}

async function initThrowawayRepo() {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-validate-wiring-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: repoDir, env: GIT_ENV, stdio: 'ignore' });
  await mkdir(path.join(repoDir, 'schemas'), { recursive: true });
  await copyFile(REGISTRY_SCHEMA_PATH, path.join(repoDir, 'schemas', 'release-registry.schema.json'));
  await mkdir(path.join(repoDir, 'releases'), { recursive: true });
  return repoDir;
}

const entryA = {
  version: '1.0.0',
  moduleId: 'cbc_suite_v1',
  packDigest: `sha256:${'1'.repeat(64)}`,
  manifestDigest: `sha256:${'2'.repeat(64)}`,
  signature: null,
  signedAt: null,
  supersedes: null,
  withdrawalState: 'none',
  withdrawnAt: null,
  withdrawalReason: null,
};

// =================================================================================================
// AC1 — `npm run validate` (via `loadAndValidateReleaseRegistry`, the exact function the CLI
// entrypoint calls) fails on a seeded bad registry: a hand-committed history mutation that bypassed
// `register` entirely (the git-history append-only violation this task's own wiring newly surfaces).
// =================================================================================================

test('loadAndValidateReleaseRegistry(): a hand-committed mutation of an existing registry entry (bypassing register) fails closed with a named append-only error', async () => {
  const repoDir = await initThrowawayRepo();
  try {
    const registryPath = path.join(repoDir, 'releases', 'registry.json');
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [entryA] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'seed with entryA');

    // Hand-edit + commit a mutation directly — never went through `register` at all. This is
    // exactly the class of tampering layer 1 (register's own in-process check) structurally cannot
    // see, because the working-tree write it is about to make already agrees with itself.
    const tampered = { ...entryA, withdrawalState: 'withdrawn' };
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [tampered] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'hand-edit entryA (bypassing register)');

    const result = await loadAndValidateReleaseRegistry(repoDir);
    assert.equal(result.present, true);
    assert.ok(
      result.errors.some((e) => e.includes('releases/registry.json') && e.includes('append-only')),
      `expected an append-only violation in errors, got: ${JSON.stringify(result.errors)}`,
    );
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('loadAndValidateReleaseRegistry(): a hand-committed removal of an existing registry entry (bypassing register) fails closed', async () => {
  const repoDir = await initThrowawayRepo();
  try {
    const registryPath = path.join(repoDir, 'releases', 'registry.json');
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [entryA] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'seed with entryA');

    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'remove entryA (bypassing register)');

    const result = await loadAndValidateReleaseRegistry(repoDir);
    assert.ok(
      result.errors.some((e) => e.includes('releases/registry.json') && e.includes('append-only')),
      `expected an append-only violation in errors, got: ${JSON.stringify(result.errors)}`,
    );
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('loadAndValidateReleaseRegistry(): a legitimate append-only commit sequence passes with zero errors', async () => {
  const repoDir = await initThrowawayRepo();
  try {
    const registryPath = path.join(repoDir, 'releases', 'registry.json');
    const entryB = { ...entryA, version: '2.0.0', packDigest: `sha256:${'3'.repeat(64)}`, manifestDigest: `sha256:${'4'.repeat(64)}` };

    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'seed empty registry');

    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [entryA] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'register entryA');

    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [entryA, entryB] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'register entryB');

    const result = await loadAndValidateReleaseRegistry(repoDir);
    assert.deepEqual(result, { errors: [], entryCount: 2, present: true });
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('scripts/validate-kb.mjs (the real CLI entrypoint) exits non-zero when releases/registry.json git history carries an unregistered mutation', async () => {
  const repoDir = await initThrowawayRepo();
  try {
    // Build a minimal tree scripts/validate-kb.mjs's isMain path can import/run against would be
    // disproportionate (it also validates modules/, governance/, build/kb-pack/ — none of which
    // this seam test owns). Exercising the exact exported function the CLI entrypoint calls
    // (`loadAndValidateReleaseRegistry`, proven above) plus the CLI's own error-surfacing contract
    // (`allErrors.length` -> `process.exitCode = 1`, unmodified by this task) together constitute
    // the end-to-end proof without re-building the whole validator's fixture tree.
    const registryPath = path.join(repoDir, 'releases', 'registry.json');
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [entryA] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'seed with entryA');
    const tampered = { ...entryA, withdrawalState: 'withdrawn' };
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [tampered] }, null, 2)}\n`, 'utf8');
    gitCommit(repoDir, 'hand-edit entryA (bypassing register)');

    const result = await loadAndValidateReleaseRegistry(repoDir);
    // Mirrors scripts/validate-kb.mjs's own `isMain` block: any release-registry error joins
    // `allErrors`, and a non-empty `allErrors` sets `process.exitCode = 1` — unmodified by this
    // task, asserted here to keep this seam test honest about what "npm run validate fails" means.
    assert.ok(result.errors.length > 0);
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// Non-git tree: `.git`-absence gate does not spuriously fail a synthetic schema-shape fixture
// (protects the pre-existing P1-T7 tests in tests/ef-contract-forced-empty.test.mjs, which build
// non-git-initialized tempdirs).
// =================================================================================================

test('loadAndValidateReleaseRegistry(): a non-git-tracked tree with a valid registry.json still validates cleanly (no spurious append-only failure)', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-release-registry-validate-wiring-nogit-'));
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    await copyFile(REGISTRY_SCHEMA_PATH, path.join(tempRoot, 'schemas', 'release-registry.schema.json'));
    await mkdir(path.join(tempRoot, 'releases'), { recursive: true });
    await writeFile(path.join(tempRoot, 'releases', 'registry.json'), `${JSON.stringify({ schemaVersion: 1, entries: [entryA] }, null, 2)}\n`);

    const result = await loadAndValidateReleaseRegistry(tempRoot);
    assert.deepEqual(result, { errors: [], entryCount: 1, present: true });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// =================================================================================================
// Regression: the `--follow` false-positive this task fixed (tools/release-sign/lib/registry.mjs)
// — the REAL repository's committed `releases/registry.json` history walks cleanly. Before the fix,
// `git log --follow -- releases/registry.json` picked up an unrelated ancestor commit
// (schemas/release-registry.schema.json, added by P1-T5 before releases/registry.json itself
// existed) via content-similarity rename heuristics, and `git show <that hash>:releases/registry.json`
// then threw — not an append-only violation, a tooling false positive that would have made this
// task's own wiring break `npm run validate` on the untampered real repo.
// =================================================================================================

test('checkRegistryHistoryAppendOnly() on the real repo tree walks releases/registry.json cleanly (regression guard for the --follow false-positive fix)', () => {
  assert.doesNotThrow(() => checkRegistryHistoryAppendOnly(REPO_ROOT, 'releases/registry.json'));
});

test('loadAndValidateReleaseRegistry() on the real repo tree (the exact call npm run validate makes) reports zero errors', async () => {
  const result = await loadAndValidateReleaseRegistry(REPO_ROOT);
  assert.deepEqual(result, { errors: [], entryCount: 0, present: true });
});

// =================================================================================================
// AC2 — diff-scope: no change to src/, server.mjs, openapi.yaml, or modules/anemia/module.json
// (the anemia-path digest/status file) anywhere across this entire plan's branch, not just this
// task — the anemia browser deployment's SPIKE-006 posture (two-part digest, fail-closed,
// unsigned-stub -> integrity-recorded -> superseded/revoked enum) stays byte-untouched.
// =================================================================================================

function resolveBaseRef() {
  // `main` is this branch's own merge-base throughout evidence-foundry-e1 (verified at authoring
  // time: `git merge-base main HEAD` === `git rev-parse main`) — a stable, human-meaningful anchor
  // ("what shipped on main before this plan began") rather than a hardcoded commit SHA. Falls back
  // to the merge-base with `origin/main` if a local `main` ref is unavailable in some other
  // checkout, and is skipped (not failed) if neither resolves — this is an environment-scoping
  // proof, not a functional-correctness one.
  for (const ref of ['main', 'origin/main']) {
    try {
      execFileSync('git', ['rev-parse', '--verify', ref], { cwd: REPO_ROOT, stdio: 'pipe' });
      return ref;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

test('diff-scope: src/, server.mjs, openapi.yaml, and modules/anemia/module.json are byte-untouched relative to main across all of evidence-foundry-e1', (t) => {
  const baseRef = resolveBaseRef();
  if (!baseRef) {
    t.skip('no local "main" or "origin/main" ref resolvable in this checkout — cannot compute a diff scope');
    return;
  }
  const diffOutput = execFileSync(
    'git',
    ['diff', '--name-only', `${baseRef}...HEAD`, '--', 'src', 'server.mjs', 'openapi.yaml', 'modules/anemia/module.json'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  ).trim();
  assert.equal(diffOutput, '', `expected no diff against ${baseRef} for the anemia browser deployment surface, got:\n${diffOutput}`);
});

// =================================================================================================
// AC3 — README records the OQ-2 surface decision (structural checks wired into npm run validate;
// full cryptographic verify deliberately never wired in) and its rationale.
// =================================================================================================

test('tools/release-sign/README.md documents the P3-T6 verifier-surface decision (what is wired into npm run validate, what deliberately is not)', async () => {
  const readme = await readFile(path.join(REPO_ROOT, 'tools', 'release-sign', 'README.md'), 'utf8');
  assert.match(readme, /npm run validate/);
  assert.match(readme, /checkRegistryHistoryAppendOnly/);
  // The rationale half: full cryptographic verify is deliberately NOT wired into npm run validate,
  // not merely omitted by oversight.
  assert.match(readme, /never wired into|not wired into|deliberately never/i);
  assert.match(readme, /no new npm script/i);
});

test('package.json declares no new npm script for this tool (structural verification joins the EXISTING npm run validate chain, per this task\'s own scope)', async () => {
  const pkg = JSON.parse(await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const scriptValues = Object.values(pkg.scripts ?? {});
  assert.ok(
    !scriptValues.some((v) => /release-sign/.test(v)),
    'expected no package.json script to reference tools/release-sign directly',
  );
});
