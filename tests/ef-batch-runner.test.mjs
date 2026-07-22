// tests/ef-batch-runner.test.mjs — multi-bundle-conversion-e1 Phase 2, row P2-T5 (R-6 mitigation,
// PRD Reliability NFR): the fail-closed PARTIAL-BATCH-FAILURE test for `runBatch`
// (tools/rf-bundle-to-kb-pack/lib/batch.mjs).
//
// Task acceptance criteria (phase-1-2-vendoring-batch-orchestration.md, row P2-T5): "Seed a
// mid-batch failure (e.g., a corrupted 3rd-of-4 fixture) and assert the batch runner names the
// failing bundle explicitly, halts without partially writing that bundle's output, and leaves
// already-succeeded bundles' output unaffected — no shared mutable state between bundles." Concrete
// per-bundle assertions: bundles 1-2's output is present and unaffected; bundle 3 has ZERO partial
// output under `build/kb-pack/`; bundle 4 is never attempted; the runner's error names bundle 3
// specifically.
//
// This is a DIFFERENT seeded failure than the one `tests/ef-converter-batch.test.mjs` (P2-T3)
// already exercises. That sibling file's halt-on-failure coverage relies on the pre-existing,
// documented `DecisionsNotFoundError` gap (Decisions Block Addendum A1 / Deferred Item DF-E1-M1) —
// a `modules/<id>/authoring-decisions.yaml` that has not been authored yet for 3 of the 4 real
// `BATCH_PAIRS` modules. This file instead SEEDS a fresh, deliberate corruption (an unparseable
// `evidence_bundle.yaml`) to prove the halt-and-isolate contract against a genuinely different
// failure signature (`BundleParseError`, a `SchemaError`, exit 2) than DF-E1-M1's `UsageError`
// (exit 1) — coverage of the "any stage of any pair can fail, and the isolation contract holds
// regardless of which ConverterError subclass causes it" property, not a re-test of DF-E1-M1 itself.
//
// Real-code constraint this file's scenario design works around (documented here, not hidden):
// `lib/verbs/propose.mjs`'s `MODULE_ID` guard means the converter has hand-authored drafting
// content (P3-T1..T6) for exactly ONE real module today — `cbc_suite_v1` — matching production
// `BATCH_PAIRS`' own documented state (Addendum A1/DF-E1-M1: only the `rf-cbc-002` -> `cbc_suite_v1`
// pair currently completes `propose` end to end). Because `runBatch`'s per-pair `outDir` is keyed
// SOLELY by the target module's own `id` (`resolveModuleId`), a *second*, independently-succeeding
// pair, at a *distinct* output directory, cannot be constructed today without either (a) drafting a
// second module's clinical content (out of scope — no random calculator/module expansion without
// clinical review, CLAUDE.md's hard guardrails) or (b) editing `propose.mjs`'s hard-coded module
// scope (out of scope for a test-authoring task; this file owns only its own test, not the shared
// converter library). So "bundle 1" and "bundle 2" below are both represented by the one real,
// currently-succeeding pair (`rf-cbc-002` -> `cbc_suite_v1`, via a second, independent bundle
// directory copy) — proving the exact, meaningful property this scenario needs: a second bundle
// legitimately reaching (and re-writing, idempotently) the SAME already-correct output directory
// does not corrupt it, and a LATER bundle's failure does not touch it either. "Bundle 3" (seeded
// corruption) and "bundle 4" (never attempted) each get their own distinct, synthetic module id
// (a renamed copy of `cbc_suite_v1`'s module directory) precisely so each has its OWN unambiguous
// `outDir` to assert zero footprint against — never sharing a directory with bundle 1/2's real
// success, and never with each other.

import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BATCH_PAIRS, BatchBundleFailedError, runBatch } from '../tools/rf-bundle-to-kb-pack/lib/batch.mjs';
import { BundleParseError } from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import { EXIT_SCHEMA } from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULE_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'rule.schema.json');
const REAL_CBC_002_FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-002');
const REAL_CBC_MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');
const REAL_CBC_MODULE_ID = 'cbc_suite_v1';
const PACK_VERSION = '0.1.0-proposal'; // mirrors lib/verbs/propose.mjs's PACK_VERSION constant.

const BUNDLE3_SENTINEL_MODULE_ID = 'batch_test_bundle3_corrupted';
const BUNDLE4_SENTINEL_MODULE_ID = 'batch_test_bundle4_never_attempted';

/** Canonical shape of the production `BATCH_PAIRS` array, asserted unchanged at the end of this
 * file's scenario — proves running `runBatch` with a wholly separate, synthetic `pairs` array never
 * leaks state back into the shared, frozen production constant (part of this task's "no shared
 * mutable state between bundles" requirement, read at the module-scope level). */
const CANONICAL_BATCH_PAIRS_SHAPE = Object.freeze([
  Object.freeze({ fixture: 'tests/fixtures/rf-ev-001', module: 'modules/anemia' }),
  Object.freeze({ fixture: 'tests/fixtures/rf-cbc-002', module: 'modules/cbc_suite_v1' }),
  Object.freeze({ fixture: 'tests/fixtures/rf-kid-001', module: 'modules/kidney_suite_v1' }),
  Object.freeze({ fixture: 'tests/fixtures/rf-gro-002', module: 'modules/growth_suite_v1' }),
]);

async function makeScratchDir(label) {
  return mkdtemp(path.join(os.tmpdir(), `ef-batch-runner-test-${label}-`));
}

/** Recursively lists every file under `dir`, as paths relative to `dir`, sorted — mirrors
 * `tests/ef-converter-batch.test.mjs`'s own helper of the same shape. */
async function listFilesRelative(dir) {
  const collected = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        collected.push(path.relative(dir, full));
      }
    }
  }
  await walk(dir);
  return collected.sort();
}

async function pathExists(target) {
  return stat(target).then(() => true).catch((err) => {
    if (err.code === 'ENOENT') return false;
    throw err;
  });
}

/** A fresh, independent byte-for-byte copy of the real, committed `rf-cbc-002` fixture tree, in its
 * own scratch directory — so mutating one bundle's copy (bundle 3's corruption) can never touch
 * another bundle's copy, or the real committed fixture itself. */
async function makeCbc002FixtureCopy(label) {
  const dir = await makeScratchDir(`fixture-${label}`);
  await cp(REAL_CBC_002_FIXTURE_DIR, dir, { recursive: true });
  return dir;
}

/** A fresh, independent copy of the real, committed `cbc_suite_v1` module directory, with
 * `module.json`'s `"id"` field rewritten to `sentinelModuleId` — giving this synthetic pair its own,
 * unambiguous `outDir` (`<outBaseDir>/<sentinelModuleId>/<PACK_VERSION>/`) distinct from the real
 * `cbc_suite_v1` module's own output directory and from every other synthetic pair's. Everything
 * else about the module (its `authoring-decisions.yaml`, `evidence.json`, etc.) is left byte-for-
 * byte identical to the real, committed module. */
async function makeRenamedCbcModuleCopy(label, sentinelModuleId) {
  const dir = await makeScratchDir(`module-${label}`);
  await cp(REAL_CBC_MODULE_DIR, dir, { recursive: true });
  const modulePath = path.join(dir, 'module.json');
  const parsed = JSON.parse(await readFile(modulePath, 'utf8'));
  parsed.id = sentinelModuleId;
  await writeFile(modulePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  return dir;
}

/** Seeds the mid-batch failure this task's AC calls for: corrupts `<fixtureDir>/evidence_bundle.yaml`
 * with an unterminated double-quoted scalar appended after the document's real content. This is a
 * genuinely different corruption than DF-E1-M1's "no authoring-decisions.yaml yet" gap — it
 * deterministically trips `yaml-lite.mjs`'s fail-closed "unterminated quoted scalar" check (never
 * silently guesses or truncates), which `loader.mjs#parseYamlOrThrow` re-wraps as a
 * `BundleParseError` (a `SchemaError`, exit code 2) — a real parse failure, not a missing-file
 * usage error. This happens inside `loadBundle`, i.e. during the batch runner's `inspect` stage,
 * strictly BEFORE `batch.mjs`'s own `mkdir(outDir, { recursive: true })` call (that only runs after
 * `inspect` succeeds, ahead of `verify`) — so the corrupted pair's own `outDir` is never created at
 * all, not even as an empty directory. */
async function corruptEvidenceBundleYaml(fixtureDir) {
  const bundlePath = path.join(fixtureDir, 'evidence_bundle.yaml');
  const original = await readFile(bundlePath, 'utf8');
  const corrupted = `${original}\ncorrupted_marker: "seeded P2-T5 corruption — intentionally unterminated quoted scalar\n`;
  await writeFile(bundlePath, corrupted, 'utf8');
}

// =================================================================================================
// Scenario: a synthetic 4-pair batch — bundle 1 (real success), bundle 2 (real success, second
// independent copy), bundle 3 (seeded corruption), bundle 4 (never attempted) — run through the
// real `runBatch` engine exactly once.
// =================================================================================================

test('P2-T5: fail-closed partial-batch-failure — seeded mid-batch corruption halts cleanly, names the failing bundle, and leaves every other bundle unaffected', async (t) => {
  const outBaseDir = await makeScratchDir('out');

  // Bundle 1: the real, committed rf-cbc-002 fixture against the real, committed cbc_suite_v1
  // module — the one pair this converter can currently draft end to end (Addendum A1/DF-E1-M1).
  const bundle1 = { fixture: REAL_CBC_002_FIXTURE_DIR, module: REAL_CBC_MODULE_DIR };

  // Bundle 2: a second, wholly independent copy of the same real fixture, against the same real
  // module — see this file's header comment for why a second pair against a DIFFERENT real,
  // drafting-capable module cannot be constructed today without out-of-scope changes.
  const bundle2FixtureDir = await makeScratchDir('bundle2-fixture');
  await cp(REAL_CBC_002_FIXTURE_DIR, bundle2FixtureDir, { recursive: true });
  const bundle2 = { fixture: bundle2FixtureDir, module: REAL_CBC_MODULE_DIR };

  // Bundle 3: a corrupted copy of the fixture, against its OWN sentinel-id module copy (so its
  // outDir is unambiguously its own, never bundle 1/2's shared cbc_suite_v1 directory).
  const bundle3FixtureDir = await makeCbc002FixtureCopy('bundle3');
  await corruptEvidenceBundleYaml(bundle3FixtureDir);
  const bundle3ModuleDir = await makeRenamedCbcModuleCopy('bundle3', BUNDLE3_SENTINEL_MODULE_ID);
  const bundle3 = { fixture: bundle3FixtureDir, module: bundle3ModuleDir };

  // Bundle 4: an uncorrupted fixture copy that would (if ever reached) succeed just like bundle
  // 1/2 — its own sentinel-id module copy again gives it its own unambiguous outDir. This bundle
  // must NEVER be attempted at all (halt-on-first-failure, per BatchBundleFailedError's contract).
  const bundle4FixtureDir = await makeCbc002FixtureCopy('bundle4');
  const bundle4ModuleDir = await makeRenamedCbcModuleCopy('bundle4', BUNDLE4_SENTINEL_MODULE_ID);
  const bundle4 = { fixture: bundle4FixtureDir, module: bundle4ModuleDir };

  const pairs = [bundle1, bundle2, bundle3, bundle4];

  const cbcOutDir = path.join(outBaseDir, REAL_CBC_MODULE_ID, PACK_VERSION);
  const bundle3OutDir = path.join(outBaseDir, BUNDLE3_SENTINEL_MODULE_ID, PACK_VERSION);
  const bundle4OutDir = path.join(outBaseDir, BUNDLE4_SENTINEL_MODULE_ID, PACK_VERSION);

  try {
    let caughtError;
    try {
      await runBatch({ pairs, ruleSchemaPath: RULE_SCHEMA_PATH, outBaseDir });
      assert.fail('runBatch was expected to reject at the seeded bundle-3 corruption');
    } catch (err) {
      caughtError = err;
    }

    await t.test('names the failing bundle explicitly (bundle 3, pairIndex 2)', () => {
      assert.ok(caughtError instanceof BatchBundleFailedError);
      assert.equal(caughtError.pairIndex, 2, 'bundle 3 is index 2 of the 4-entry pairs array');
      assert.equal(caughtError.fixture, bundle3FixtureDir);
      assert.equal(caughtError.module, bundle3ModuleDir);
      assert.equal(caughtError.moduleId, BUNDLE3_SENTINEL_MODULE_ID);
      assert.equal(caughtError.stage, 'inspect');
      assert.ok(caughtError.cause instanceof BundleParseError, 'the seeded corruption is a schema/parse failure, not a usage error');
      assert.equal(caughtError.exitCode, EXIT_SCHEMA);

      // The thrown error's own message names the failing bundle specifically — never a generic,
      // unattributed failure (this task's own AC wording).
      assert.ok(caughtError.message.includes(bundle3FixtureDir), 'error message names the failing fixture path');
      assert.ok(caughtError.message.includes(BUNDLE3_SENTINEL_MODULE_ID), 'error message names the failing module id');
      assert.ok(caughtError.message.includes('inspect'), 'error message names the stage that was running');
    });

    await t.test('bundles 1-2: output is present under build/kb-pack/ and unaffected by the later failure', async () => {
      const cbcFiles = await listFilesRelative(cbcOutDir);
      assert.ok(cbcFiles.length > 0, 'bundle 1/2\'s shared cbc_suite_v1 output must exist');
      assert.ok(cbcFiles.includes('conversion-report.json'));
      assert.ok(cbcFiles.includes('pack-provenance.json'));
      assert.ok(cbcFiles.includes('rules.json'));
      assert.ok(cbcFiles.includes('release-manifest.unsigned.json'));

      // "Unaffected": pack-provenance.json's rfBundleId is the REAL rf-cbc-002 bundle id — never
      // something derived from bundle 3's corrupted copy or bundle 4's fixture (proves no
      // cross-bundle content leakage into bundle 1/2's own, already-correct output).
      const packProvenance = JSON.parse(await readFile(path.join(cbcOutDir, 'pack-provenance.json'), 'utf8'));
      assert.equal(packProvenance.moduleId, REAL_CBC_MODULE_ID);
      assert.equal(packProvenance.rfBundleId, 'bundle_20260718_intent_research_20260717_rf_cbc_002');

      // Both bundle 1 and bundle 2 target the SAME real, drafting-capable module (`cbc_suite_v1`,
      // see this file's header comment) and therefore the SAME `outDir` — bundle 1 (pairIndex 0)
      // writes first, then bundle 2 (pairIndex 1) idempotently re-writes over it (byte-identical
      // *content*, since both read the same fixture bytes — though `pack-provenance.json`'s
      // `upstreamArtifacts[].path` field is computed relative to each pair's OWN `runDir`, so
      // bundle 2's temp-directory copy legitimately produces different path STRINGS there than
      // bundle 1's in-repo path would; that is a benign, expected property of `propose.mjs`'s
      // existing path math, not something this test is probing). What "unaffected by the later
      // failure" really needs to prove is: bundle 2's own successful write — the one that
      // determines the shared directory's final state before the batch halts at bundle 3 — is
      // exactly what a solo run of that SAME bundle 2 pair produces, uncorrupted by bundle 3's
      // seeded failure or bundle 4's mere presence later in the array. Re-run bundle 2's pair
      // alone, into a fresh, independent outBaseDir, and diff every emitted byte against the
      // actual multi-pair run's final output.
      const referenceOutBaseDir = await makeScratchDir('reference');
      try {
        const referenceResults = await runBatch({
          pairs: [bundle2],
          ruleSchemaPath: RULE_SCHEMA_PATH,
          outBaseDir: referenceOutBaseDir,
        });
        const referenceOutDir = referenceResults[0].outDir;
        const referenceFiles = await listFilesRelative(referenceOutDir);
        assert.deepEqual(referenceFiles, cbcFiles, 'bundle 2 alone must emit the exact same file set as the 4-pair run\'s final shared directory');
        for (const relFile of referenceFiles) {
          const referenceBytes = await readFile(path.join(referenceOutDir, relFile));
          const actualBytes = await readFile(path.join(cbcOutDir, relFile));
          assert.ok(
            referenceBytes.equals(actualBytes),
            `${relFile} must be byte-identical whether or not bundle 3/4 are also in the batch`,
          );
        }
      } finally {
        await rm(referenceOutBaseDir, { recursive: true, force: true });
      }
    });

    await t.test('bundle 3: ZERO partial output under build/kb-pack/ — not even an empty directory', async () => {
      assert.equal(await pathExists(bundle3OutDir), false, 'the corrupted bundle\'s own outDir must never have been created');
    });

    await t.test('bundle 4: never attempted at all', async () => {
      assert.equal(await pathExists(bundle4OutDir), false, 'bundle 4\'s own outDir must never have been created');

      // Its own fixture/module copies are exactly what they were before the batch ran — nothing
      // ever read (or wrote to) them, since the batch halted at bundle 3, before bundle 4's turn.
      const bundle4FixtureBytes = await readFile(path.join(bundle4FixtureDir, 'evidence_bundle.yaml'));
      const originalFixtureBytes = await readFile(path.join(REAL_CBC_002_FIXTURE_DIR, 'evidence_bundle.yaml'));
      assert.ok(bundle4FixtureBytes.equals(originalFixtureBytes), 'bundle 4\'s untouched fixture copy is still byte-identical to the real fixture');
    });

    await t.test('no shared mutable state leaked between bundles', async () => {
      // Bundle 3's corruption was applied to ITS OWN fixture copy only — bundle 2's independent
      // copy (of the same source fixture) is untouched by it.
      const bundle2Bytes = await readFile(path.join(bundle2FixtureDir, 'evidence_bundle.yaml'));
      const originalBytes = await readFile(path.join(REAL_CBC_002_FIXTURE_DIR, 'evidence_bundle.yaml'));
      assert.ok(bundle2Bytes.equals(originalBytes), 'bundle 2\'s own fixture copy must be unaffected by bundle 3\'s corruption of ITS copy');

      // The real, committed module/fixture trees this scenario reads from are themselves
      // untouched — `runBatch`'s pipeline never writes to `--run-dir`/module inputs (seam
      // invariant 6), only to `outDir`.
      const realModuleJsonAfter = JSON.parse(await readFile(path.join(REAL_CBC_MODULE_DIR, 'module.json'), 'utf8'));
      assert.equal(realModuleJsonAfter.id, REAL_CBC_MODULE_ID);
      const realFixtureBytesAfter = await readFile(path.join(REAL_CBC_002_FIXTURE_DIR, 'evidence_bundle.yaml'));
      assert.ok(!realFixtureBytesAfter.toString('utf8').includes('seeded P2-T5 corruption'), 'the real, committed fixture must never be mutated by this test');

      // The production BATCH_PAIRS constant — a wholly separate array from this test's own
      // synthetic `pairs` — is untouched: still frozen, still exactly its 4 canonical entries.
      // Proves running `runBatch` with an arbitrary custom `pairs` array never leaks state back
      // into the shared, module-scope default any other caller (the CLI `batch` verb, or a
      // concurrently-running test file) relies on.
      assert.ok(Object.isFrozen(BATCH_PAIRS));
      assert.deepEqual(
        BATCH_PAIRS.map(({ fixture, module }) => ({ fixture, module })),
        CANONICAL_BATCH_PAIRS_SHAPE.map(({ fixture, module }) => ({ fixture, module })),
      );
    });
  } finally {
    await rm(outBaseDir, { recursive: true, force: true });
    await rm(bundle2FixtureDir, { recursive: true, force: true });
    await rm(bundle3FixtureDir, { recursive: true, force: true });
    await rm(bundle3ModuleDir, { recursive: true, force: true });
    await rm(bundle4FixtureDir, { recursive: true, force: true });
    await rm(bundle4ModuleDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// A second, narrower seeded-corruption case: the failure lands on the very FIRST pair (index 0) —
// proving "zero partial output for the failing bundle" and "never attempted" hold even when there
// are no preceding successes at all, not only in the "2 successes then a failure" shape above.
// =================================================================================================

test('P2-T5: seeded corruption on the very first pair still halts cleanly with zero output and no later pair attempted', async () => {
  const outBaseDir = await makeScratchDir('out-first');

  const corruptedFixtureDir = await makeCbc002FixtureCopy('first-corrupted');
  await corruptEvidenceBundleYaml(corruptedFixtureDir);
  const corruptedModuleDir = await makeRenamedCbcModuleCopy('first-corrupted', 'batch_test_first_corrupted');

  const neverAttemptedFixtureDir = await makeCbc002FixtureCopy('first-never-attempted');
  const neverAttemptedModuleDir = await makeRenamedCbcModuleCopy('first-never-attempted', 'batch_test_first_never_attempted');

  const pairs = [
    { fixture: corruptedFixtureDir, module: corruptedModuleDir },
    { fixture: neverAttemptedFixtureDir, module: neverAttemptedModuleDir },
  ];

  try {
    await assert.rejects(
      runBatch({ pairs, ruleSchemaPath: RULE_SCHEMA_PATH, outBaseDir }),
      (err) => {
        assert.ok(err instanceof BatchBundleFailedError);
        assert.equal(err.pairIndex, 0);
        assert.equal(err.moduleId, 'batch_test_first_corrupted');
        assert.equal(err.stage, 'inspect');
        assert.ok(err.cause instanceof BundleParseError);
        return true;
      },
    );

    const corruptedOutDir = path.join(outBaseDir, 'batch_test_first_corrupted', PACK_VERSION);
    const neverAttemptedOutDir = path.join(outBaseDir, 'batch_test_first_never_attempted', PACK_VERSION);
    assert.equal(await pathExists(corruptedOutDir), false);
    assert.equal(await pathExists(neverAttemptedOutDir), false);
  } finally {
    await rm(outBaseDir, { recursive: true, force: true });
    await rm(corruptedFixtureDir, { recursive: true, force: true });
    await rm(corruptedModuleDir, { recursive: true, force: true });
    await rm(neverAttemptedFixtureDir, { recursive: true, force: true });
    await rm(neverAttemptedModuleDir, { recursive: true, force: true });
  }
});
