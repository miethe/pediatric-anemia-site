// tests/ef-converter-loader.test.mjs — P2-T2: read-only bundle loader + artifact resolution
// (FR-6, 02 §4.3).
//
// Task acceptance criteria (phase-1-2-foundation-converter.md, row P2-T2):
//   1. "Loader resolves every artifact listed in the P1-T6 fixture's evidence_bundle.yaml
//      .artifacts" — asserted below against the real, committed `tests/fixtures/rf-cbc-001`.
//   2. "A missing authoring-decisions.yaml produces the specific fail-closed error, not a stack
//      trace" — asserted against the real `modules/cbc_suite_v1/module.json` (whose sibling
//      `authoring-decisions.yaml` legitimately does not exist until P3-T1 lands).
//   3. "A test asserts the run directory's file mtimes/permissions are unchanged after a full
//      loader pass" — asserted via an mtimeMs/mode snapshot of every file under a temp copy of the
//      fixture, before and after `loadBundle`.
//
// Additional coverage beyond the three AC bullets (path-escape rejection, malformed-YAML
// rejection, missing-single-file-artifact rejection) exercises `loader.mjs`'s other named,
// fail-closed error paths so a future regression surfaces as a specific assertion failure, not a
// silent behavior change. This file is deliberately NOT `tests/ef-converter-invariants.test.mjs`
// (P2-T8's seam task) — same convention `tests/ef-converter-error-taxonomy.test.mjs` (P2-T5)
// documents for its own file.

import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadBundle,
  MissingArtifactError,
  DecisionsNotFoundError,
  PathEscapeError,
  BundleParseError,
  BundleShapeError,
} from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import { UsageError, SchemaError, EXIT_USAGE, EXIT_SCHEMA } from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');

async function makeTempRunDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ef-loader-test-rundir-'));
  await cp(FIXTURE_DIR, dir, { recursive: true });
  return dir;
}

// A synthetic module directory (module.json + authoring-decisions.yaml) used ONLY so this test
// file can exercise loadBundle's happy path without creating a real
// `modules/cbc_suite_v1/authoring-decisions.yaml` — that file is P3-T1's deliverable, not P2-T2's,
// and this repo's read-only-until-a-task-explicitly-owns-it convention (CLAUDE.md) means this test
// must not pre-empt it.
async function makeTempModuleWithDecisions() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ef-loader-test-module-'));
  const modulePath = path.join(dir, 'module.json');
  await writeFile(modulePath, JSON.stringify({ id: 'test_stub_module', title: 'Test Stub Module' }), 'utf8');
  await writeFile(path.join(dir, 'authoring-decisions.yaml'), 'notes: temp stub for P2-T2 loader tests\n', 'utf8');
  return { dir, modulePath };
}

async function collectSnapshot(dir) {
  const snapshot = new Map();
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const info = await stat(full);
        snapshot.set(path.relative(dir, full), { mtimeMs: info.mtimeMs, mode: info.mode, size: info.size });
      }
    }
  }
  await walk(dir);
  return snapshot;
}

// ----- 1. Full artifact resolution against the real, committed fixture ------------------------

test('P2-T2: loadBundle resolves every artifact declared in evidence_bundle.yaml.artifacts', async (t) => {
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  t.after(() => rm(moduleDir, { recursive: true, force: true }));

  const loaded = await loadBundle({ runDir: FIXTURE_DIR, modulePath });

  assert.equal(loaded.runDir, FIXTURE_DIR);
  assert.equal(loaded.bundle.parsed.status, 'verified');
  assert.equal(loaded.runId, loaded.bundle.parsed.run_id);
  assert.equal(loaded.bundleId, loaded.bundle.parsed.id);
  assert.equal(loaded.moduleId, 'test_stub_module');

  // Single-file artifacts: raw bytes present and byte-identical to the committed file.
  assert.ok(Buffer.isBuffer(loaded.artifacts.researchBrief.raw));
  const expectedResearchBrief = await readFile(path.join(FIXTURE_DIR, 'research_brief.md'));
  assert.ok(loaded.artifacts.researchBrief.raw.equals(expectedResearchBrief));

  assert.equal(loaded.artifacts.verification.parsed.run_id, loaded.runId);
  assert.equal(loaded.artifacts.verification.parsed.passed, true);
  assert.equal(loaded.artifacts.verification.parsed.exit_code, 0);

  assert.equal(loaded.artifacts.claimLedger.parsed.claims.length, 87);
  assert.equal(loaded.artifacts.swarmPlan.parsed.type, 'swarm_plan');
  assert.equal(loaded.artifacts.ccdashEvent.parsed.metrics.claims_total, 87);

  // Directory artifacts: every card in the fixture is resolved, sorted, and parsed.
  assert.equal(loaded.artifacts.sourceCards.length, 12);
  assert.equal(loaded.artifacts.extractionCards.length, 12);
  for (const card of loaded.artifacts.sourceCards) {
    assert.ok(Buffer.isBuffer(card.raw));
    assert.equal(typeof card.frontmatter.source_card_id, 'string');
    assert.ok(Array.isArray(card.frontmatter.extracted_points));
    assert.ok(card.frontmatter.extracted_points.length > 0);
    assert.equal(typeof card.body, 'string');
  }
  const sourceIds = loaded.artifacts.sourceCards.map((c) => c.frontmatter.source_card_id);
  assert.deepEqual(sourceIds, [...sourceIds].sort(), 'source cards are resolved in deterministic, sorted order');

  for (const card of loaded.artifacts.extractionCards) {
    assert.ok(Buffer.isBuffer(card.raw));
    assert.ok(Array.isArray(card.parsed.extracted_facts));
  }

  // Decisions file: this test's own temp stub, resolved relative to the module path's directory.
  assert.equal(loaded.decisions.parsed.notes, 'temp stub for P2-T2 loader tests');
});

// ----- 2. Missing authoring-decisions.yaml fails closed with a specific, named error -----------

test('P2-T2: a missing authoring-decisions.yaml fails closed with DecisionsNotFoundError, not a generic crash', async () => {
  await assert.rejects(
    () => loadBundle({ runDir: FIXTURE_DIR, modulePath: REAL_MODULE_PATH }),
    (err) => {
      assert.ok(err instanceof DecisionsNotFoundError, `expected DecisionsNotFoundError, got ${err.constructor.name}`);
      assert.ok(err instanceof UsageError);
      assert.equal(err.exitCode, EXIT_USAGE);
      assert.match(err.message, /authoring-decisions\.yaml/);
      assert.match(err.message, /not found/);
      return true;
    },
  );
});

// ----- 3. Read-only: runDir file mtimes/permissions are unchanged after a full loader pass -----

test('P2-T2: loadBundle never mutates runDir (seam invariant 6)', async (t) => {
  const runDir = await makeTempRunDir();
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  t.after(() => Promise.all([rm(runDir, { recursive: true, force: true }), rm(moduleDir, { recursive: true, force: true })]));

  const before = await collectSnapshot(runDir);
  await loadBundle({ runDir, modulePath });
  const after = await collectSnapshot(runDir);

  assert.deepEqual(after, before, 'runDir file mtimes/modes/sizes must be byte-identical after a full loader pass');
});

// ----- Path-escape rejection --------------------------------------------------------------------

test('P2-T2: an artifact path escaping runDir is rejected with PathEscapeError', async (t) => {
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
    () => loadBundle({ runDir, modulePath }),
    (err) => {
      assert.ok(err instanceof PathEscapeError, `expected PathEscapeError, got ${err.constructor.name}`);
      assert.ok(err instanceof UsageError);
      assert.equal(err.exitCode, EXIT_USAGE);
      assert.match(err.message, /outside the run directory/);
      return true;
    },
  );
});

// ----- Missing single-file artifact -------------------------------------------------------------

test('P2-T2: a missing single-file artifact is rejected with MissingArtifactError, not a stack trace', async (t) => {
  const runDir = await makeTempRunDir();
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  t.after(() => Promise.all([rm(runDir, { recursive: true, force: true }), rm(moduleDir, { recursive: true, force: true })]));

  await unlink(path.join(runDir, 'reviews', 'verification.yaml'));

  await assert.rejects(
    () => loadBundle({ runDir, modulePath }),
    (err) => {
      assert.ok(err instanceof MissingArtifactError, `expected MissingArtifactError, got ${err.constructor.name}`);
      assert.ok(err instanceof UsageError);
      assert.equal(err.exitCode, EXIT_USAGE);
      assert.equal(err.label, 'verification');
      return true;
    },
  );
});

// ----- Missing run-dir / module path -------------------------------------------------------------

test('P2-T2: a nonexistent runDir is rejected with MissingArtifactError', async () => {
  await assert.rejects(
    () => loadBundle({ runDir: path.join(os.tmpdir(), 'ef-loader-test-does-not-exist'), modulePath: REAL_MODULE_PATH }),
    (err) => {
      assert.ok(err instanceof MissingArtifactError);
      assert.equal(err.exitCode, EXIT_USAGE);
      return true;
    },
  );
});

test('P2-T2: a nonexistent module.json path is rejected with MissingArtifactError', async () => {
  await assert.rejects(
    () => loadBundle({ runDir: FIXTURE_DIR, modulePath: path.join(REPO_ROOT, 'modules', 'does_not_exist', 'module.json') }),
    (err) => {
      assert.ok(err instanceof MissingArtifactError);
      assert.equal(err.exitCode, EXIT_USAGE);
      return true;
    },
  );
});

// ----- Malformed YAML fails closed with a schema-classed error, not a generic crash -------------

test('P2-T2: a malformed YAML artifact is rejected with BundleParseError (schema), not a stack trace', async (t) => {
  const runDir = await makeTempRunDir();
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  t.after(() => Promise.all([rm(runDir, { recursive: true, force: true }), rm(moduleDir, { recursive: true, force: true })]));

  // Corrupt claim_ledger.yaml with a construct outside this hand-rolled parser's subset (a block
  // scalar) — the parser fails closed on it rather than guessing.
  await writeFile(path.join(runDir, 'claims', 'claim_ledger.yaml'), 'id: broken\nnotes: |\n  literal block scalar\nclaims: []\n', 'utf8');

  await assert.rejects(
    () => loadBundle({ runDir, modulePath }),
    (err) => {
      assert.ok(err instanceof BundleParseError, `expected BundleParseError, got ${err.constructor.name}`);
      assert.ok(err instanceof SchemaError);
      assert.equal(err.exitCode, EXIT_SCHEMA);
      return true;
    },
  );
});

// ----- evidence_bundle.yaml missing its "artifacts" map fails closed with BundleShapeError ------

test('P2-T2: evidence_bundle.yaml without an "artifacts" map is rejected with BundleShapeError (schema)', async (t) => {
  const runDir = await makeTempRunDir();
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  t.after(() => Promise.all([rm(runDir, { recursive: true, force: true }), rm(moduleDir, { recursive: true, force: true })]));

  await writeFile(path.join(runDir, 'evidence_bundle.yaml'), 'id: bundle_no_artifacts\nstatus: verified\n', 'utf8');

  await assert.rejects(
    () => loadBundle({ runDir, modulePath }),
    (err) => {
      assert.ok(err instanceof BundleShapeError, `expected BundleShapeError, got ${err.constructor.name}`);
      assert.ok(err instanceof SchemaError);
      assert.equal(err.exitCode, EXIT_SCHEMA);
      return true;
    },
  );
});
