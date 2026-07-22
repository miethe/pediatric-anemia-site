// tests/ef-cbc-suite-v1-merge-safety.test.mjs -- P4-T6 (multi-bundle-conversion-e1, Phase 4,
// FR-8, decisions block Risk 2's own merge-idempotency gate).
//
// P4-T5 (tests/ef-cbc-002-backfill.test.mjs, a sibling task's own test file -- not touched here)
// already proved the FIRST `RF-CBC-002` -> `modules/cbc_suite_v1/` merge landed collision-free and
// additive. This file is P4-T6's OWN, dedicated proof of the complementary half of FR-8: the merge
// step is additive AND IDEMPOTENT against a module package that already carries prior-bundle
// content -- re-running the merge a SECOND time (now that `modules/cbc_suite_v1/` already carries
// the `RF-CBC-002` append from P4-T5) must produce ZERO duplicate or new records, and every file
// the merge path touches must be byte-identical before and after that second run.
//
// This repo's actual `RF-CBC-002` merge implementation is the bespoke, collision-checked
// `scripts/evidence/backfill-cbc-002-evidence.mjs` script (see that file's header and
// `scripts/evidence/lib/cbc-002-projection.mjs`'s header for why this bundle is NOT routed through
// the generic `tools/rf-bundle-to-kb-pack` `propose` verb) -- FR-8's "re-run `propose` for
// `RF-CBC-002` a second time" is this converter family's own name for re-invoking that same real
// merge entry point a second time against the now-already-merged real committed files. That is
// exactly what every test below does: no synthetic module, no temp directory -- the real
// `modules/cbc_suite_v1/` package, the real fixture, the real `run()` export.
//
// Idempotent here means: a second run can never silently duplicate or overwrite anything. This
// converter's collision policy achieves that by FAILING CLOSED (throwing a named `CollisionError`
// naming every collision, before either `writeFile` call is ever reached) rather than by silently
// no-op-succeeding -- both are valid "zero duplicate records, byte-identical files" outcomes; this
// converter chose fail-closed, per FR-7/FR-8's explicit "a collision fails the batch closed... never
// silently overwrites" mandate. This file proves that choice actually holds for every one of the
// 87 records (12 sources + 75 assertions) the first merge appended -- not just "some" of them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseYamlDocument, parseYamlFrontmatter } from '../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';
import {
  RF_RUN_ID,
  SOURCE_DEFS,
  buildNewSources,
  buildNewAssertions,
  detectCollisions,
  CollisionError,
} from '../scripts/evidence/lib/cbc-002-projection.mjs';
import { run as runBackfill } from '../scripts/evidence/backfill-cbc-002-evidence.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-002');

// Every file the merge path can possibly touch (the two it writes to, plus the three it must
// never write to per FR-7's own "rules.json and authoring-decisions.yaml are NOT touched" clause
// and module.json's OQ-2 immutability) -- this file's byte-identity proof covers the whole set, not
// only the two files the collision path happens to write.
const WATCHED_FILES = [
  'evidence.json',
  'evidence-assertions.json',
  'rules.json',
  'authoring-decisions.yaml',
  'module.json',
];

async function snapshotWatchedFiles() {
  const snapshot = {};
  for (const filename of WATCHED_FILES) {
    snapshot[filename] = await readFile(path.join(MODULE_DIR, filename), 'utf8');
  }
  return snapshot;
}

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

/** Loads the real RF-CBC-002 fixture the same way both the CLI script and P4-T5's own test file
 * do -- read-only, independent of any committed module state. */
async function loadFixture() {
  const claimLedgerRaw = await readFile(path.join(FIXTURE_DIR, 'claims', 'claim_ledger.yaml'), 'utf8');
  const claimLedger = parseYamlDocument(claimLedgerRaw);
  const sourcesDir = path.join(FIXTURE_DIR, 'sources');
  const sourceFiles = (await readdir(sourcesDir)).filter((f) => f.startsWith('src_') && f.endsWith('.md')).sort();
  const sourceCards = [];
  for (const filename of sourceFiles) {
    const raw = await readFile(path.join(sourcesDir, filename), 'utf8');
    const { frontmatter } = parseYamlFrontmatter(raw);
    sourceCards.push({ path: filename, frontmatter });
  }
  return { claims: claimLedger.claims, sourceCards };
}

// -------------------------------------------------------------------------------------------
// 1. The real second run, in both modes (`--check` and the writing mode), against the real,
//    already-merged package -- fails closed, zero writes, zero duplicate records.
// -------------------------------------------------------------------------------------------

test('P4-T6 (FR-8): re-running the real RF-CBC-002 merge in --check mode against the already-merged real package fails closed with zero writes', async () => {
  const before = await snapshotWatchedFiles();

  await assert.rejects(
    () => runBackfill({ check: true }),
    (err) => {
      assert.ok(err instanceof CollisionError, `expected CollisionError, got ${err?.constructor?.name}: ${err?.message}`);
      assert.ok(err.collisions.length > 0, 'a second run must name at least one collision -- silently reporting "0 collisions" would be the exact bug FR-8 exists to prevent');
      return true;
    },
  );

  const after = await snapshotWatchedFiles();
  for (const filename of WATCHED_FILES) {
    assert.equal(after[filename], before[filename], `${filename} must be byte-identical after a --check-mode second run (--check must never write, even on failure)`);
  }
});

test('P4-T6 (FR-8) LOAD-BEARING: re-running the real RF-CBC-002 merge (writing mode) a SECOND time against the already-merged real package produces zero duplicate/new records and leaves every watched file byte-identical', async () => {
  const before = await snapshotWatchedFiles();

  await assert.rejects(
    () => runBackfill({ check: false }),
    (err) => {
      assert.ok(err instanceof CollisionError, `expected CollisionError, got ${err?.constructor?.name}: ${err?.message}`);
      // Every one of the 12 sourceIds + 12 rfSourceCardIds (from sources) + 75 assertionIds +
      // 75 rfSourceCardIds (from assertions) + 75 rfClaimId pairs this second attempt would mint
      // already exists -- 12*2 + 75*3 = 249 named collisions, none silently swallowed.
      assert.equal(err.collisions.length, 249, 'the second run must name a collision for EVERY record it would otherwise duplicate, not merely detect that "something" collided');
      const byKind = {};
      for (const c of err.collisions) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
      assert.deepEqual(byKind, { sourceId: 12, rfSourceCardId: 87, assertionId: 75, rfClaimId: 75 }, 'collision kinds must account for all 12 sources and all 75 assertions the second run attempted to append');
      return true;
    },
  );

  const after = await snapshotWatchedFiles();
  for (const filename of WATCHED_FILES) {
    assert.equal(after[filename], before[filename], `${filename} must be byte-identical before and after the second RF-CBC-002 merge attempt (FR-8's own AC)`);
  }

  // "Zero duplicate records were created" restated at the record-count level, not just the
  // byte-identity level: the merge is idempotent, not merely additive-once.
  const evidenceAfter = JSON.parse(after['evidence.json']);
  const assertionsAfter = JSON.parse(after['evidence-assertions.json']);
  assert.equal(evidenceAfter.sources.length, 20, 'source count must stay 8 (RF-CBC-001) + 12 (RF-CBC-002) = 20 -- no second append occurred');
  assert.equal(assertionsAfter.assertions.length, 94, 'assertion count must stay 19 (RF-CBC-001) + 75 (RF-CBC-002) = 94 -- no second append occurred');
  assert.equal(new Set(evidenceAfter.sources.map((s) => s.id)).size, 20, 'every sourceId must remain unique -- zero duplicate ids');
  assert.equal(new Set(assertionsAfter.assertions.map((a) => a.assertionId)).size, 94, 'every assertionId must remain unique -- zero duplicate ids');
});

test('P4-T6 (FR-8): running the merge a THIRD time (immediately after the second failed attempt) fails identically -- the fail-closed guard is stable, not a one-time fluke', async () => {
  const before = await snapshotWatchedFiles();

  const collisionCounts = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop -- intentionally sequential: each attempt must
    // observe the real on-disk state left by the previous attempt (none, since it fails closed).
    await assert.rejects(
      () => runBackfill({ check: false }),
      (err) => {
        assert.ok(err instanceof CollisionError);
        collisionCounts.push(err.collisions.length);
        return true;
      },
    );
  }
  assert.equal(collisionCounts[0], collisionCounts[1], 'repeated re-runs must report the identical collision count -- no drift, no partial state accumulating across failed attempts');

  const after = await snapshotWatchedFiles();
  for (const filename of WATCHED_FILES) {
    assert.equal(after[filename], before[filename], `${filename} must still be byte-identical after two more failed re-run attempts`);
  }
});

// -------------------------------------------------------------------------------------------
// 2. Every individual new record collides -- not just "some" -- proven directly at the
//    detectCollisions level against the CURRENT (fully RF-CBC-001 + RF-CBC-002) merged content.
// -------------------------------------------------------------------------------------------

test('P4-T6 (FR-8): every one of the 12 candidate sourceIds a re-run would mint already collides with the real, currently-committed evidence.json', async () => {
  const loaded = await loadFixture();
  const newSources = buildNewSources(loaded);
  assert.equal(newSources.length, 12);

  const existingEvidence = await loadJson(path.join(MODULE_DIR, 'evidence.json'));
  const existingAssertionsDoc = await loadJson(path.join(MODULE_DIR, 'evidence-assertions.json'));

  const collisions = detectCollisions(
    { existingSources: existingEvidence.sources, existingAssertions: existingAssertionsDoc.assertions },
    { newSources, newAssertions: [] },
  );

  const collidedSourceIds = new Set(collisions.filter((c) => c.kind === 'sourceId').map((c) => c.value));
  assert.deepEqual(collidedSourceIds, new Set(SOURCE_DEFS.map((d) => d.id)), 'every candidate sourceId must be reported as an existing collision -- if even one were missed, a re-run could silently duplicate it');
});

test('P4-T6 (FR-8): every one of the 75 candidate assertionIds a re-run would mint already collides with the real, currently-committed evidence-assertions.json', async () => {
  const loaded = await loadFixture();
  const newAssertions = buildNewAssertions(loaded);
  assert.equal(newAssertions.length, 75);

  const existingEvidence = await loadJson(path.join(MODULE_DIR, 'evidence.json'));
  const existingAssertionsDoc = await loadJson(path.join(MODULE_DIR, 'evidence-assertions.json'));

  const collisions = detectCollisions(
    { existingSources: existingEvidence.sources, existingAssertions: existingAssertionsDoc.assertions },
    { newSources: [], newAssertions },
  );

  const collidedAssertionIds = new Set(collisions.filter((c) => c.kind === 'assertionId').map((c) => c.value));
  assert.deepEqual(collidedAssertionIds, new Set(newAssertions.map((a) => a.assertionId)), 'every candidate assertionId must be reported as an existing collision -- if even one were missed, a re-run could silently duplicate it');

  // The (rfRunId, rfClaimId) composite guard (this converter's own disambiguation design, see
  // ../scripts/evidence/lib/cbc-002-projection.mjs's header) must ALSO fire for every one of the
  // 75 assertions -- not merely the bare assertionId check -- since RF_RUN_ID is identical between
  // this candidate batch and the already-committed RF-CBC-002 records.
  const collidedClaimPairs = collisions.filter((c) => c.kind === 'rfClaimId');
  assert.equal(collidedClaimPairs.length, 75, 'the (rfRunId, rfClaimId) composite key must flag all 75 re-attempted RF-CBC-002 claims as already present under the SAME rfRunId');
  assert.ok(newAssertions.every((a) => a.rfRunId === RF_RUN_ID), 'sanity: every candidate assertion is tagged with the real RF-CBC-002 rfRunId');
});
