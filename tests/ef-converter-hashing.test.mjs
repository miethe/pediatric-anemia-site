// tests/ef-converter-hashing.test.mjs — P2-T3: hash pinning ("Pin" phase)
// (FR-7, 02 §4.6 Phase 1, seam invariant 5).
//
// Task acceptance criteria (phase-1-2-foundation-converter.md, row P2-T3):
//   1. "Every artifact in the P1-T6 fixture is hashed" — asserted below against the real,
//      committed `tests/fixtures/rf-cbc-001`, walking every key of the `hashes` map
//      `pinArtifacts` returns.
//   2. "A test that mutates one byte of a source card after pinning and re-runs the pin step
//      detects the drift and fails closed" — asserted below: pin once (succeeds), mutate one byte
//      of a source card on disk, pin again on the same `LoadedBundle` (whose in-memory `raw`
//      buffer still reflects the pre-mutation bytes) — the second pin re-reads the now-mutated
//      file from disk, finds it no longer matches, and throws `HashMismatchError`.
//   3. "A path-escape attempt (`../` in an artifact path) is rejected" — asserted below via the
//      full loader -> hashing pipeline. Path resolution is `loader.mjs`'s (P2-T2) responsibility,
//      not this module's (see `lib/hashing.mjs`'s header comment) — this test proves the Pin
//      phase's overall failure mode holds end-to-end: a malicious `../` artifact path never
//      reaches `pinArtifacts` at all, because `loadBundle` rejects it first with
//      `PathEscapeError`.
//
// This suite covers the hashing module in isolation. It is deliberately NOT
// `tests/ef-converter-invariants.test.mjs` — that flat, 15-invariant-numbered file is P2-T8's seam
// task, and this repo's task table treats the two as separate, separately-owned artifacts (same
// convention `tests/ef-converter-loader.test.mjs` and `tests/ef-converter-error-taxonomy.test.mjs`
// already document for themselves).

import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBundle, MissingArtifactError, PathEscapeError } from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import { pinArtifacts, HashMismatchError } from '../tools/rf-bundle-to-kb-pack/lib/hashing.mjs';
import { UsageError, EXIT_USAGE } from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');

async function makeTempRunDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ef-hashing-test-rundir-'));
  await cp(FIXTURE_DIR, dir, { recursive: true });
  return dir;
}

// Same synthetic module + authoring-decisions stub `tests/ef-converter-loader.test.mjs` uses —
// `modules/cbc_suite_v1/authoring-decisions.yaml` is P3-T1's deliverable, not this task's; this
// repo's read-only-until-a-task-explicitly-owns-it convention (CLAUDE.md) means this test file
// must not pre-empt it.
async function makeTempModuleWithDecisions() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ef-hashing-test-module-'));
  const modulePath = path.join(dir, 'module.json');
  await writeFile(modulePath, JSON.stringify({ id: 'test_stub_module', title: 'Test Stub Module' }), 'utf8');
  await writeFile(path.join(dir, 'authoring-decisions.yaml'), 'notes: temp stub for P2-T3 hashing tests\n', 'utf8');
  return { dir, modulePath };
}

async function loadFixtureBundle(runDir) {
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  const loaded = await loadBundle({ runDir, modulePath });
  return { loaded, moduleDir };
}

// ----- 1. Every artifact in the fixture is hashed -----------------------------------------------

test('P2-T3: pinArtifacts hashes every artifact resolved from the P1-T6 fixture', async (t) => {
  const runDir = await makeTempRunDir();
  const { loaded, moduleDir } = await loadFixtureBundle(runDir);
  t.after(() => Promise.all([rm(runDir, { recursive: true, force: true }), rm(moduleDir, { recursive: true, force: true })]));

  const pinned = await pinArtifacts(loaded);

  const sha256HexPattern = /^[0-9a-f]{64}$/;

  // Top-level identity fields carried through unmodified.
  assert.equal(pinned.runId, loaded.bundle.parsed.run_id);
  assert.equal(pinned.bundleId, loaded.bundle.parsed.id);

  // module.json, authoring-decisions.yaml, evidence_bundle.yaml.
  assert.match(pinned.hashes.module, sha256HexPattern);
  assert.match(pinned.hashes.decisions, sha256HexPattern);
  assert.match(pinned.hashes.bundle, sha256HexPattern);
  assert.equal(pinned.module.sha256, pinned.hashes.module);
  assert.equal(pinned.decisions.sha256, pinned.hashes.decisions);
  assert.equal(pinned.bundle.sha256, pinned.hashes.bundle);

  // Cross-check the bundle hash against an independently computed digest of the same bytes.
  const { createHash } = await import('node:crypto');
  const expectedBundleHash = createHash('sha256')
    .update(await readFile(path.join(runDir, 'evidence_bundle.yaml')))
    .digest('hex');
  assert.equal(pinned.hashes.bundle, expectedBundleHash);

  // Every single-file artifact (research_brief, swarm_plan, claim_ledger, report, verification,
  // ccdash_event) — seam invariant 5 explicitly names "claim-ledger SHA-256".
  for (const key of ['researchBrief', 'swarmPlan', 'claimLedger', 'report', 'verification', 'ccdashEvent']) {
    assert.match(pinned.hashes[key], sha256HexPattern, `expected a sha256 hex digest for "${key}"`);
    assert.equal(pinned.artifacts[key].sha256, pinned.hashes[key]);
  }

  // Every source card and extraction card is hashed — seam invariant 5's "source-card hashes".
  assert.equal(Object.keys(pinned.hashes.sourceCards).length, 12);
  assert.equal(Object.keys(pinned.hashes.extractionCards).length, 12);
  assert.equal(pinned.artifacts.sourceCards.length, 12);
  assert.equal(pinned.artifacts.extractionCards.length, 12);
  for (const card of pinned.artifacts.sourceCards) {
    assert.match(card.sha256, sha256HexPattern);
    assert.equal(pinned.hashes.sourceCards[path.basename(card.path)], card.sha256);
  }
  for (const card of pinned.artifacts.extractionCards) {
    assert.match(card.sha256, sha256HexPattern);
    assert.equal(pinned.hashes.extractionCards[path.basename(card.path)], card.sha256);
  }

  // Determinism (seam invariant 13): pinning the same LoadedBundle twice yields identical hashes.
  const pinnedAgain = await pinArtifacts(loaded);
  assert.deepEqual(pinnedAgain.hashes, pinned.hashes);
});

// ----- 2. Mutate one byte after pinning; re-running the pin step detects drift and fails closed -

test('P2-T3: a source card mutated after pinning is detected as drift and rejected (fail closed)', async (t) => {
  const runDir = await makeTempRunDir();
  const { loaded, moduleDir } = await loadFixtureBundle(runDir);
  t.after(() => Promise.all([rm(runDir, { recursive: true, force: true }), rm(moduleDir, { recursive: true, force: true })]));

  // First pin succeeds against the pristine fixture.
  const firstPin = await pinArtifacts(loaded);
  const mutatedCard = loaded.artifacts.sourceCards[0];
  const originalHash = firstPin.artifacts.sourceCards[0].sha256;

  // Mutate exactly one byte of the same source card on disk, without re-loading the bundle — the
  // in-memory `loaded.artifacts.sourceCards[0].raw` buffer still reflects the pre-mutation bytes.
  const originalBytes = await readFile(mutatedCard.path);
  const mutatedBytes = Buffer.from(originalBytes);
  const flipIndex = mutatedBytes.findIndex((byte) => byte !== 0);
  assert.ok(flipIndex >= 0, 'test fixture setup: expected at least one non-zero byte to flip');
  mutatedBytes[flipIndex] = mutatedBytes[flipIndex] ^ 0xff;
  await writeFile(mutatedCard.path, mutatedBytes);

  // Re-running the pin step on the same LoadedBundle re-reads the now-mutated file and must
  // detect the drift rather than silently re-hashing the new bytes.
  await assert.rejects(
    () => pinArtifacts(loaded),
    (err) => {
      assert.ok(err instanceof HashMismatchError, `expected HashMismatchError, got ${err.constructor.name}`);
      assert.ok(err instanceof UsageError);
      assert.equal(err.exitCode, EXIT_USAGE);
      assert.match(err.message, /changed after it was loaded/);
      assert.equal(err.resolvedPath, mutatedCard.path);
      return true;
    },
  );

  // Sanity: the mutated bytes really do hash differently from the original pin (proves the test
  // actually exercised drift, not a no-op mutation).
  const { createHash } = await import('node:crypto');
  const mutatedHash = createHash('sha256').update(mutatedBytes).digest('hex');
  assert.notEqual(mutatedHash, originalHash);
});

// ----- 3. Missing artifact between load and pin fails closed ------------------------------------

test('P2-T3: an artifact deleted between load and pin fails closed with MissingArtifactError', async (t) => {
  const runDir = await makeTempRunDir();
  const { loaded, moduleDir } = await loadFixtureBundle(runDir);
  t.after(() => Promise.all([rm(runDir, { recursive: true, force: true }), rm(moduleDir, { recursive: true, force: true })]));

  const targetCard = loaded.artifacts.sourceCards[3];
  await unlink(targetCard.path);

  await assert.rejects(
    () => pinArtifacts(loaded),
    (err) => {
      assert.ok(err instanceof MissingArtifactError, `expected MissingArtifactError, got ${err.constructor.name}`);
      assert.equal(err.exitCode, EXIT_USAGE);
      assert.equal(err.resolvedPath, targetCard.path);
      return true;
    },
  );
});

// ----- 4. Path-escape rejection holds end-to-end for the Pin phase (loader -> hashing) ----------

test('P2-T3: a path-escape artifact reference never reaches pinArtifacts — loadBundle rejects it first', async (t) => {
  const runDir = await makeTempRunDir();
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  t.after(() => Promise.all([rm(runDir, { recursive: true, force: true }), rm(moduleDir, { recursive: true, force: true })]));

  const bundlePath = path.join(runDir, 'evidence_bundle.yaml');
  const originalBundleText = await readFile(bundlePath, 'utf8');
  const escapedBundleText = originalBundleText.replace(
    'research_brief: research_brief.md',
    'research_brief: ../outside-run-dir.md',
  );
  assert.notEqual(escapedBundleText, originalBundleText, 'test fixture setup: expected line not found to rewrite');
  await writeFile(bundlePath, escapedBundleText, 'utf8');

  await assert.rejects(
    () => loadBundle({ runDir, modulePath }).then(pinArtifacts),
    (err) => {
      assert.ok(err instanceof PathEscapeError, `expected PathEscapeError, got ${err.constructor.name}`);
      assert.equal(err.exitCode, EXIT_USAGE);
      assert.match(err.message, /outside the run directory/);
      return true;
    },
  );
});

// ----- Malformed LoadedBundle input fails closed with a UsageError, not a generic crash ----------

test('P2-T3: pinArtifacts rejects a malformed (non-LoadedBundle) input', async () => {
  await assert.rejects(
    () => pinArtifacts({}),
    (err) => {
      assert.ok(err instanceof UsageError);
      assert.equal(err.exitCode, EXIT_USAGE);
      return true;
    },
  );

  await assert.rejects(
    () => pinArtifacts(undefined),
    (err) => {
      assert.ok(err instanceof UsageError);
      return true;
    },
  );
});
