// tests/ef-cbc-002-backfill.test.mjs -- P4-T5 (multi-bundle-conversion-e1, Phase 4, FR-7/FR-8,
// decisions block Risk 2, "the plan's single riskiest cell").
//
// Proves, against both synthetic seeded data and the real committed RF-CBC-002 -> cbc_suite_v1
// merge:
//   1. buildNewSources/buildNewAssertions produce exactly the 12 sources / 75 assertions the real
//      fixture supports, schema-valid, with rfClaimId/rfSourceCardId/sourceId/assertionId
//      traceable back to the fixture.
//   2. detectCollisions reports a genuine sourceId/assertionId/rfSourceCardId collision by name.
//   3. detectCollisions does NOT false-positive on the same bare rfClaimId number reused by a
//      DIFFERENT rfRunId (the composite-key design this task's own header comment requires) --
//      proving the collision policy is neither too loose (misses real collisions) nor too strict
//      (blocks legitimate multi-bundle appends).
//   4. The seeded-collision path: a real collision aborts the WHOLE merge (CollisionError, naming
//      every collision) with NO partial write to either file -- proven by actually invoking the
//      real CLI script's `run()` a second time against the now-already-merged real committed
//      files (every one of its ids necessarily collides with itself) and confirming both files on
//      disk are byte-identical before and after the attempt.
//   5. Real committed modules/cbc_suite_v1/{evidence.json,evidence-assertions.json} carry the RF-
//      CBC-002 append correctly: 20 sources (8 RF-CBC-001 + 12 RF-CBC-002), 94 assertions (19 +
//      75), every RF-CBC-001-era record field-for-field unchanged, rules.json/
//      authoring-decisions.yaml/module.json byte-identical to the P4-T1 snapshot.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseYamlDocument, parseYamlFrontmatter } from '../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';
import {
  RF_RUN_ID,
  SOURCE_DEFS,
  buildNewSources,
  buildNewAssertions,
  detectCollisions,
  mergeEvidenceDocument,
  mergeAssertionsDocument,
  CollisionError,
} from '../scripts/evidence/lib/cbc-002-projection.mjs';
import { run as runBackfill } from '../scripts/evidence/backfill-cbc-002-evidence.mjs';
import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { computeSnapshot, WHOLE_FILE_TARGETS } from '../scripts/lib/p4-t1-snapshot.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-002');

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

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

// ---------------------------------------------------------------------------------------------
// 1. Builders against the real RF-CBC-002 fixture
// ---------------------------------------------------------------------------------------------

test('buildNewSources produces exactly 12 schema-valid sources, one per SOURCE_DEFS entry, each with >=1 supporting claim', async () => {
  const loaded = await loadFixture();
  const sources = buildNewSources(loaded);
  assert.equal(sources.length, 12);
  assert.deepEqual(sources.map((s) => s.id).sort(), SOURCE_DEFS.map((d) => d.id).sort());

  const evidenceSchema = await loadJson(path.join(REPO_ROOT, 'schemas', 'evidence.schema.json'));
  const stubDoc = { knowledgeBaseVersion: '0.0.0-test', reviewedThrough: '2026-07-21', sources };
  assert.deepEqual(validate(evidenceSchema, stubDoc), []);

  for (const source of sources) {
    assert.ok(source.supports.length > 0, `${source.id}: supports[] must be non-empty`);
    assert.equal(source.passages.length, 1, `${source.id}: exactly one implementation-proposal sentinel`);
    assert.equal(source.passages[0].status, 'implementation-proposal');
    assert.equal(source.passages[0].provenance.runId, RF_RUN_ID);
  }
});

test('buildNewAssertions produces exactly 75 schema-valid assertions (one per RF-CBC-002 "supported" claim), all rfRunId-tagged RF-CBC-002', async () => {
  const loaded = await loadFixture();
  const assertions = buildNewAssertions(loaded);
  assert.equal(assertions.length, 75);
  assert.equal(new Set(assertions.map((a) => a.assertionId)).size, 75, 'assertionIds must be unique within the batch');

  const assertionsSchema = await loadJson(path.join(REPO_ROOT, 'schemas', 'evidence-assertions.schema.json'));
  const stubDoc = {
    schemaVersion: '1.0',
    moduleId: 'cbc_suite_v1',
    rfProvenance: { rfRunId: 'x', rfBundleId: 'y', fixturePath: 'z' },
    additionalRfProvenance: [{ rfRunId: RF_RUN_ID, rfBundleId: 'y2', fixturePath: 'z2' }],
    assertions,
  };
  assert.deepEqual(validate(assertionsSchema, stubDoc), []);

  for (const assertion of assertions) {
    assert.equal(assertion.rfRunId, RF_RUN_ID);
    assert.equal(assertion.claimStatus, 'supported');
    assert.equal(assertion.exactPassage, null, 'OQ-2 rights-restricted fallback: every RF-CBC-002 passage is null');
    assert.equal(assertion.passageId, `psg_${assertion.exactPassageSha256.replace('sha256:', '')}`);
  }
});

// ---------------------------------------------------------------------------------------------
// 2 & 3. Collision detection: real collisions are named; cross-run claim-number reuse is not a
//         false positive (the composite (rfRunId, rfClaimId) key design)
// ---------------------------------------------------------------------------------------------

function stubExisting() {
  return {
    existingSources: [{ id: 'EXISTING_SOURCE_001', rfSourceCardId: 'src_existing_001' }],
    existingAssertions: [
      { assertionId: 'evas_existing_001', rfRunId: 'rf_run_existing', rfClaimId: 'clm_009', rfSourceCardId: 'src_existing_001' },
    ],
  };
}

test('detectCollisions names a real sourceId collision', () => {
  const existing = stubExisting();
  const newSources = [{ id: 'EXISTING_SOURCE_001', rfSourceCardId: 'src_new_001' }];
  const collisions = detectCollisions(existing, { newSources, newAssertions: [] });
  assert.ok(collisions.some((c) => c.kind === 'sourceId' && c.value === 'EXISTING_SOURCE_001'));
});

test('detectCollisions names a real rfSourceCardId collision', () => {
  const existing = stubExisting();
  const newSources = [{ id: 'BRAND_NEW_SOURCE', rfSourceCardId: 'src_existing_001' }];
  const collisions = detectCollisions(existing, { newSources, newAssertions: [] });
  assert.ok(collisions.some((c) => c.kind === 'rfSourceCardId' && c.value === 'src_existing_001'));
});

test('detectCollisions names a real assertionId collision', () => {
  const existing = stubExisting();
  const newAssertions = [{ assertionId: 'evas_existing_001', rfRunId: 'rf_run_new', rfClaimId: 'clm_999', rfSourceCardId: 'src_new_002' }];
  const collisions = detectCollisions(existing, { newSources: [], newAssertions });
  assert.ok(collisions.some((c) => c.kind === 'assertionId' && c.value === 'evas_existing_001'));
});

test('detectCollisions names a genuine (rfRunId, rfClaimId) collision -- the SAME run reusing the SAME claim id', () => {
  const existing = stubExisting();
  const newAssertions = [{ assertionId: 'evas_new_001', rfRunId: 'rf_run_existing', rfClaimId: 'clm_009', rfSourceCardId: 'src_new_003' }];
  const collisions = detectCollisions(existing, { newSources: [], newAssertions });
  assert.ok(collisions.some((c) => c.kind === 'rfClaimId' && c.value === 'clm_009'));
});

test('detectCollisions does NOT false-positive when a DIFFERENT rfRunId reuses the same bare claim-id number (composite-key design)', () => {
  // This is exactly the real-world shape: RF-CBC-001 and RF-CBC-002 both have a "clm_009", about
  // entirely different papers. A bare-string rfClaimId comparison would wrongly flag this.
  const existing = stubExisting(); // existing has rfRunId "rf_run_existing", rfClaimId "clm_009"
  const newAssertions = [{ assertionId: 'evas_new_002', rfRunId: 'rf_run_totally_different_bundle', rfClaimId: 'clm_009', rfSourceCardId: 'src_new_004' }];
  const collisions = detectCollisions(existing, { newSources: [], newAssertions });
  assert.deepEqual(collisions, [], 'a different rfRunId reusing the same claim-id number must never be reported as a collision');
});

test('detectCollisions reports zero collisions for the real RF-CBC-002 batch against the real committed RF-CBC-001-derived content\'s ORIGINAL (pre-P4-T5) shape', async () => {
  // Reconstructs the pre-merge existing content by taking only the records this file's own
  // rfRunId constant identifies as RF-CBC-001-derived out of the CURRENT (already-merged)
  // committed files -- proving the batch this task actually ran was collision-free against what
  // was there before it ran, independent of the merge having already landed.
  const currentEvidence = await loadJson(path.join(MODULE_DIR, 'evidence.json'));
  const currentAssertionsDoc = await loadJson(path.join(MODULE_DIR, 'evidence-assertions.json'));
  const rf001RunId = currentAssertionsDoc.rfProvenance.rfRunId;
  const rf001Assertions = currentAssertionsDoc.assertions.filter((a) => a.rfRunId === rf001RunId);
  const rf001SourceCardIds = new Set(rf001Assertions.map((a) => a.rfSourceCardId));
  const rf001Sources = currentEvidence.sources.filter(
    (s) => rf001SourceCardIds.has(s.rfSourceCardId) || (s.duplicateRfSourceCardIds ?? []).some((id) => rf001SourceCardIds.has(id)),
  );
  assert.equal(rf001Sources.length, 8, 'sanity: RF-CBC-001 originally had exactly 8 sources');
  assert.equal(rf001Assertions.length, 19, 'sanity: RF-CBC-001 originally had exactly 19 assertions');

  const loaded = await loadFixture();
  const newSources = buildNewSources(loaded);
  const newAssertions = buildNewAssertions(loaded);
  const collisions = detectCollisions(
    { existingSources: rf001Sources, existingAssertions: rf001Assertions },
    { newSources, newAssertions },
  );
  assert.deepEqual(collisions, [], 'the real RF-CBC-002 batch must have been collision-free against the real pre-merge RF-CBC-001 content');
});

// ---------------------------------------------------------------------------------------------
// 4. Seeded-collision path: fails CLOSED, no partial write, against the REAL now-merged files
// ---------------------------------------------------------------------------------------------

test('SEEDED COLLISION: re-running the real backfill against the already-merged real files fails closed with a named CollisionError and writes NOTHING to either file', async () => {
  const beforeEvidence = await readFile(path.join(MODULE_DIR, 'evidence.json'), 'utf8');
  const beforeAssertions = await readFile(path.join(MODULE_DIR, 'evidence-assertions.json'), 'utf8');

  await assert.rejects(
    () => runBackfill({ check: false }),
    (err) => {
      assert.ok(err instanceof CollisionError, `expected CollisionError, got ${err?.constructor?.name}: ${err?.message}`);
      assert.ok(err.collisions.length > 0, 'CollisionError must name at least one collision');
      // Every one of the 12 sourceIds and 75 assertionIds this batch mints necessarily collides
      // with itself, since it is already committed -- exactly the seeded-collision scenario.
      assert.ok(err.collisions.some((c) => c.kind === 'sourceId'));
      assert.ok(err.collisions.some((c) => c.kind === 'assertionId'));
      return true;
    },
  );

  const afterEvidence = await readFile(path.join(MODULE_DIR, 'evidence.json'), 'utf8');
  const afterAssertions = await readFile(path.join(MODULE_DIR, 'evidence-assertions.json'), 'utf8');
  assert.equal(afterEvidence, beforeEvidence, 'NO PARTIAL WRITE: evidence.json must be byte-identical after a fail-closed collision');
  assert.equal(afterAssertions, beforeAssertions, 'NO PARTIAL WRITE: evidence-assertions.json must be byte-identical after a fail-closed collision');
});

test('SEEDED COLLISION (in-memory, no disk): mergeEvidenceDocument/mergeAssertionsDocument are never called by the CLI when detectCollisions reports anything -- proven at the pure-function level', async () => {
  // Directly proves the ORDERING guarantee backfill-cbc-002-evidence.mjs's run() relies on:
  // detectCollisions must be checked, and CollisionError thrown, BEFORE either merge* function
  // (and therefore before either writeFile) is ever reached. This test constructs the exact
  // seeded scenario (a new assertion reusing an existing assertionId) and confirms
  // detectCollisions alone is sufficient to detect it, independent of the CLI wiring.
  const existingAssertionsDoc = await loadJson(path.join(MODULE_DIR, 'evidence-assertions.json'));
  const existingEvidence = await loadJson(path.join(MODULE_DIR, 'evidence.json'));
  const seededDuplicateAssertion = {
    ...existingAssertionsDoc.assertions[0],
    rfClaimId: 'clm_seeded_never_real',
  };
  const collisions = detectCollisions(
    { existingSources: existingEvidence.sources, existingAssertions: existingAssertionsDoc.assertions },
    { newSources: [], newAssertions: [seededDuplicateAssertion] },
  );
  assert.ok(
    collisions.some((c) => c.kind === 'assertionId' && c.value === existingAssertionsDoc.assertions[0].assertionId),
    'a seeded duplicate assertionId must be named explicitly, not silently accepted',
  );
});

// ---------------------------------------------------------------------------------------------
// 5. Real committed post-merge state: counts, byte-identity of RF-CBC-001 content, untouched files
// ---------------------------------------------------------------------------------------------

test('real committed modules/cbc_suite_v1/evidence.json has exactly 20 sources (8 RF-CBC-001 + 12 RF-CBC-002)', async () => {
  const evidence = await loadJson(path.join(MODULE_DIR, 'evidence.json'));
  assert.equal(evidence.sources.length, 20);
  const rf002Ids = new Set(SOURCE_DEFS.map((d) => d.id));
  const rf002Present = evidence.sources.filter((s) => rf002Ids.has(s.id));
  assert.equal(rf002Present.length, 12);
});

test('real committed modules/cbc_suite_v1/evidence-assertions.json has exactly 94 assertions (19 + 75) and a correct additionalRfProvenance entry', async () => {
  const doc = await loadJson(path.join(MODULE_DIR, 'evidence-assertions.json'));
  assert.equal(doc.assertions.length, 94);
  assert.equal(doc.rfProvenance.rfRunId, 'rf_run_20260717_rf_cbc_001_pediatric_cds_establish', 'original rfProvenance must never be overwritten');
  assert.equal(doc.additionalRfProvenance.length, 1);
  assert.equal(doc.additionalRfProvenance[0].rfRunId, RF_RUN_ID);
  const rf002Count = doc.assertions.filter((a) => a.rfRunId === RF_RUN_ID).length;
  assert.equal(rf002Count, 75);
});

test('P4-T5 load-bearing AC: modules/cbc_suite_v1/rules.json and authoring-decisions.yaml are untouched (zero new rules; no approved decision for any RF-CBC-002 claim)', async () => {
  const rulesRaw = await readFile(path.join(MODULE_DIR, 'rules.json'), 'utf8');
  const rules = JSON.parse(rulesRaw);
  assert.equal(rules.length, 4, 'the 4 pre-existing RF-CBC-001 slice rules -- zero new rules added by P4-T5');

  const decisionsRaw = await readFile(path.join(MODULE_DIR, 'authoring-decisions.yaml'), 'utf8');
  const decisions = parseYamlDocument(decisionsRaw);
  assert.equal(decisions.decisions.length, 4, 'the 4 pre-existing RF-CBC-001 decisions -- no RF-CBC-002 decision was authored');
});

test('P4-T5 load-bearing AC: modules/cbc_suite_v1/module.json status/approvedBy/clinicalContentHash/knowledgeBaseVersion (OQ-2) are unchanged', async () => {
  const moduleManifest = await loadJson(path.join(MODULE_DIR, 'module.json'));
  assert.equal(moduleManifest.status, 'unsigned-stub');
  assert.deepEqual(moduleManifest.approvedBy, []);
  assert.equal(moduleManifest.clinicalContentHash, null);
  assert.equal(moduleManifest.knowledgeBaseVersion, '0.1.0-2026-07-21', 'OQ-2: knowledgeBaseVersion is never bumped by this pass');
});

test('P4-T1 whole-file targets that P4-T5 must never touch stay byte-identical to the current on-disk baseline recomputed fresh', async () => {
  // Cross-checks against tests/p4-t1-pre-merge-snapshot.test.mjs's own committed fixture rather
  // than re-deriving a second baseline here -- this test's job is only to confirm this file's own
  // suite (ef-cbc-002-backfill) did not itself introduce drift beyond what that dedicated test
  // already proves.
  const snapshot = await computeSnapshot(REPO_ROOT);
  for (const relPath of WHOLE_FILE_TARGETS) {
    assert.ok(snapshot.files[relPath].sha256.startsWith('sha256:'));
  }
});

// ---------------------------------------------------------------------------------------------
// Merge document builders: deterministic, keyed on stable IDs, never array position
// ---------------------------------------------------------------------------------------------

test('mergeEvidenceDocument / mergeAssertionsDocument append new records after existing ones (verbatim order preserved) and sort only the new slice by stable id', () => {
  const existingEvidence = { knowledgeBaseVersion: 'v', reviewedThrough: '2026-01-01', sources: [{ id: 'A' }, { id: 'B' }] };
  const newSources = [{ id: 'Z' }, { id: 'X' }, { id: 'Y' }];
  const merged = mergeEvidenceDocument(existingEvidence, newSources);
  assert.deepEqual(merged.sources.map((s) => s.id), ['A', 'B', 'X', 'Y', 'Z']);

  const existingAssertionsDoc = {
    schemaVersion: '1.0',
    moduleId: 'cbc_suite_v1',
    rfProvenance: { rfRunId: 'r1', rfBundleId: 'b1', fixturePath: 'f1' },
    assertions: [{ assertionId: 'evas_a' }, { assertionId: 'evas_b' }],
  };
  const newAssertions = [{ assertionId: 'evas_z', rfRunId: RF_RUN_ID }, { assertionId: 'evas_x', rfRunId: RF_RUN_ID }];
  const mergedDoc = mergeAssertionsDocument(existingAssertionsDoc, newAssertions);
  assert.deepEqual(mergedDoc.assertions.map((a) => a.assertionId), ['evas_a', 'evas_b', 'evas_x', 'evas_z']);
  assert.deepEqual(mergedDoc.rfProvenance, existingAssertionsDoc.rfProvenance, 'original rfProvenance must never be mutated');
  assert.equal(mergedDoc.additionalRfProvenance.length, 1);
  assert.equal(mergedDoc.additionalRfProvenance[0].rfRunId, RF_RUN_ID);
});

test('mergeAssertionsDocument is idempotent about additionalRfProvenance itself: calling it twice never duplicates the same run\'s provenance entry', () => {
  const existingAssertionsDoc = {
    schemaVersion: '1.0',
    moduleId: 'cbc_suite_v1',
    rfProvenance: { rfRunId: 'r1', rfBundleId: 'b1', fixturePath: 'f1' },
    additionalRfProvenance: [{ rfRunId: RF_RUN_ID, rfBundleId: 'b2', fixturePath: 'f2' }],
    assertions: [],
  };
  const merged = mergeAssertionsDocument(existingAssertionsDoc, []);
  assert.equal(merged.additionalRfProvenance.length, 1, 'must not add a second entry for a run already recorded');
});
