// tests/ef-review-record-migration.test.mjs -- P1-T3 (Evidence Foundry E1 Phase 1, FR-2).
//
// Proves .claude/worknotes/evidence-foundry-e1-v1/contracts-design.md §(a)'s R5 field-by-field
// mapping is real, not just prose: tools/review-record/lib/wave0-migration.mjs maps a representative
// wave0-shaped fixture for EACH of the 5 wave0 `workflowState` values (proposed, under-review,
// disputed, rejected, approved -- `WAVE0_STATES`) onto the P1-T2 canonical schema
// (schemas/review-record.schema.json) with D-4 guarantees intact, and refuses (fails closed) to map
// a fixture carrying a non-human reviewer identity.
//
// Each wave0-shaped input fixture is first checked against a frozen copy of the wave0 EP7-T1 schema
// (tests/fixtures/ef-review-record-migration/wave0-schema-reference.json, copied verbatim from git
// history at commit 268ea99, before P1-T2 replaced schemas/review-record.schema.json at the same
// path) -- proving these are genuinely wave0-shaped inputs, not approximations. Every migrated
// OUTPUT is then checked against the live canonical schema at schemas/review-record.schema.json.
//
// Structural validity proven here never implies clinical validity, safety, or that a named human
// clinician reviewed anything -- see schemas/review-record.schema.json's own top-level description
// for that standing caveat. Every migrated record this module produces is `synthetic: true` with a
// `TESTKEY-` signature; nothing here is asserted to be a real, gate-cleared clinical review act.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import {
  WAVE0_STATES,
  mapWave0RecordToCanonical,
  computeSubjectContentHash,
  Wave0MigrationError,
} from '../tools/review-record/lib/wave0-migration.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');
const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-review-record-migration');
const WAVE0_SCHEMA_REFERENCE_PATH = path.join(FIXTURES_DIR, 'wave0-schema-reference.json');

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

// One representative fixture per wave0 workflowState, per this task's own acceptance criteria
// wording ("a representative wave0-shaped fixture for each of the 5 wave0 states").
const STATE_FIXTURES = Object.freeze({
  proposed: 'wave0-proposed.json',
  'under-review': 'wave0-under-review.json',
  disputed: 'wave0-disputed.json',
  rejected: 'wave0-rejected.json',
  approved: 'wave0-approved.json',
});

const UNMAPPABLE_FIXTURE = 'wave0-unmappable-non-human-reviewer.json';

async function loadCanonicalSchema() {
  return readJson(CANONICAL_SCHEMA_PATH);
}

async function loadWave0SchemaReference() {
  return readJson(WAVE0_SCHEMA_REFERENCE_PATH);
}

async function loadStateFixture(state) {
  return readJson(path.join(FIXTURES_DIR, STATE_FIXTURES[state]));
}

// --- fixture inventory sanity ---------------------------------------------------------------------

test('exactly the 5 wave0 states have a committed fixture, matching WAVE0_STATES', async () => {
  assert.deepEqual(Object.keys(STATE_FIXTURES).sort(), [...WAVE0_STATES].sort());
});

test('every state fixture file exists and its workflowState matches the key it is filed under', async () => {
  for (const [state, filename] of Object.entries(STATE_FIXTURES)) {
    const fixture = await readJson(path.join(FIXTURES_DIR, filename));
    assert.equal(fixture.workflowState, state, `${filename} must have workflowState "${state}"`);
  }
});

// --- input fixtures are genuinely wave0-shaped (checked against the frozen wave0 schema) ----------

test('every one of the 5 state fixtures validates cleanly against the frozen wave0 EP7-T1 schema reference', async () => {
  const wave0Schema = await loadWave0SchemaReference();
  for (const [state, filename] of Object.entries(STATE_FIXTURES)) {
    const fixture = await readJson(path.join(FIXTURES_DIR, filename));
    const errors = validate(wave0Schema, fixture);
    assert.deepEqual(errors, [], `${filename} (state "${state}") must be genuinely wave0-shaped: ${JSON.stringify(errors)}`);
  }
});

// --- migration succeeds (no throw) for all 5 states, output validates against the canonical schema -

test('mapWave0RecordToCanonical does not throw for any of the 5 wave0 states', async () => {
  for (const state of WAVE0_STATES) {
    const fixture = await loadStateFixture(state);
    assert.doesNotThrow(() => mapWave0RecordToCanonical(fixture), `state "${state}" must not throw`);
  }
});

test('every canonical record produced from any of the 5 states validates against schemas/review-record.schema.json with zero errors', async () => {
  const canonicalSchema = await loadCanonicalSchema();
  for (const state of WAVE0_STATES) {
    const fixture = await loadStateFixture(state);
    const outputs = mapWave0RecordToCanonical(fixture);
    for (const record of outputs) {
      const errors = validate(canonicalSchema, record);
      assert.deepEqual(errors, [], `state "${state}" produced an invalid canonical record ${record.review_id}: ${JSON.stringify(errors)}`);
    }
  }
});

// --- per-state expected shape (proves the R5 reshape, not just "it validates") ---------------------

test('proposed and under-review (no decided reviewer yet) map onto ZERO canonical records -- "no file means no act yet" (contracts-design.md §a.3 item 4)', async () => {
  for (const state of ['proposed', 'under-review']) {
    const fixture = await loadStateFixture(state);
    const outputs = mapWave0RecordToCanonical(fixture);
    assert.deepEqual(outputs, [], `state "${state}" must map onto zero canonical records`);
  }
});

test('disputed (dual review complete, dispute still open) maps onto exactly 2 canonical records: clinical-1 and clinical-2, no adjudication yet', async () => {
  const fixture = await loadStateFixture('disputed');
  const outputs = mapWave0RecordToCanonical(fixture);
  assert.equal(outputs.length, 2);
  assert.deepEqual(outputs.map((r) => r.role).sort(), ['clinical-1', 'clinical-2']);
  const clinical1 = outputs.find((r) => r.role === 'clinical-1');
  const clinical2 = outputs.find((r) => r.role === 'clinical-2');
  assert.equal(clinical1.decision, 'approve');
  assert.equal(clinical2.decision, 'request-changes');
});

test('rejected (unanimous dual reject, no dispute) maps onto exactly 2 canonical records: clinical-1 and clinical-2, both "reject"', async () => {
  const fixture = await loadStateFixture('rejected');
  const outputs = mapWave0RecordToCanonical(fixture);
  assert.equal(outputs.length, 2);
  assert.deepEqual(outputs.map((r) => r.role).sort(), ['clinical-1', 'clinical-2']);
  for (const record of outputs) {
    assert.equal(record.decision, 'reject');
  }
});

test('approved (dual review + resolved dispute) maps onto exactly 3 canonical records: clinical-1, clinical-2, adjudication', async () => {
  const fixture = await loadStateFixture('approved');
  const outputs = mapWave0RecordToCanonical(fixture);
  assert.equal(outputs.length, 3);
  assert.deepEqual(outputs.map((r) => r.role).sort(), ['adjudication', 'clinical-1', 'clinical-2']);
  const adjudication = outputs.find((r) => r.role === 'adjudication');
  assert.equal(adjudication.decision, 'approve', 'the arbiter\'s own decision carries the adjudication outcome (contracts-design.md §a.3 item 6a)');
});

// --- D-4 guarantees intact on every migrated output --------------------------------------------

test('every migrated canonical record is synthetic:true with a TESTKEY- signature -- never asserted as a real gate-cleared review act', async () => {
  for (const state of WAVE0_STATES) {
    const fixture = await loadStateFixture(state);
    for (const record of mapWave0RecordToCanonical(fixture)) {
      assert.equal(record.synthetic, true);
      assert.ok(record.signature, `${record.review_id} must carry a signature object (synthetic:true records must)`);
      assert.match(record.signature.keyId, /^TESTKEY-/);
      assert.equal(record.signature.algorithm, 'ed25519');
    }
  }
});

test('every migrated canonical record\'s review_id suffix agrees with its role property', async () => {
  for (const state of WAVE0_STATES) {
    const fixture = await loadStateFixture(state);
    for (const record of mapWave0RecordToCanonical(fixture)) {
      assert.ok(record.review_id.endsWith(`-${record.role}`), `${record.review_id} must end with role "${record.role}"`);
    }
  }
});

test('all canonical records migrated from the SAME wave0 record share one subjectContentHash', async () => {
  const fixture = await loadStateFixture('approved');
  const outputs = mapWave0RecordToCanonical(fixture);
  const hashes = new Set(outputs.map((r) => r.subjectContentHash));
  assert.equal(hashes.size, 1, 'every role-file for one proposal must carry the identical subjectContentHash');
  assert.equal([...hashes][0], computeSubjectContentHash(fixture));
});

test('previousRecordHash chains: the first migrated record is null, every subsequent record is a distinct non-null sha256 hash', async () => {
  const fixture = await loadStateFixture('approved');
  const outputs = mapWave0RecordToCanonical(fixture);
  assert.equal(outputs[0].previousRecordHash, null);
  for (let i = 1; i < outputs.length; i += 1) {
    assert.match(outputs[i].previousRecordHash, /^sha256:[0-9a-f]{64}$/);
  }
  const nonNullHashes = outputs.slice(1).map((r) => r.previousRecordHash);
  assert.equal(new Set(nonNullHashes).size, nonNullHashes.length, 'each chain link must be distinct');
});

test('two independently migrated wave0 records (different proposals) never collide on moduleId', async () => {
  const rejected = await loadStateFixture('rejected');
  const approved = await loadStateFixture('approved');
  const rejectedOutputs = mapWave0RecordToCanonical(rejected);
  const approvedOutputs = mapWave0RecordToCanonical(approved);
  assert.notEqual(rejectedOutputs[0].moduleId, approvedOutputs[0].moduleId);
});

// --- unmappable fixture: fails closed, never silently dropped ----------------------------------

test('a fixture with a decided non-human reviewer (D-4 violation) is REJECTED by the mapper -- fails closed, never produces output', async () => {
  const poisoned = await readJson(path.join(FIXTURES_DIR, UNMAPPABLE_FIXTURE));
  assert.throws(
    () => mapWave0RecordToCanonical(poisoned),
    (err) => err instanceof Wave0MigrationError && /D-4 violation/.test(err.message) && err.reviewerId === 'REV-901',
    'a non-human reviewer entry must raise Wave0MigrationError naming the offending reviewerId, not silently skip it',
  );
});

test('the poisoned fixture never produces even a partial output before throwing (the poisoned reviewer is first in the array)', async () => {
  const poisoned = await readJson(path.join(FIXTURES_DIR, UNMAPPABLE_FIXTURE));
  let outputs;
  let threw = false;
  try {
    outputs = mapWave0RecordToCanonical(poisoned);
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
  assert.equal(outputs, undefined);
});

test('an unrecognized workflowState is REJECTED by the mapper (fails closed on malformed input)', async () => {
  const fixture = await loadStateFixture('approved');
  const malformed = { ...fixture, workflowState: 'not-a-real-state' };
  assert.throws(() => mapWave0RecordToCanonical(malformed), Wave0MigrationError);
});

// --- consumer migration: the wave0 test file + its fixture no longer live at their old paths -------

test('the retired wave0 test (tests/review-record-schema.test.mjs) no longer exists', async () => {
  await assert.rejects(readFile(path.join(REPO_ROOT, 'tests', 'review-record-schema.test.mjs')));
});

test('the retired wave0 example fixture (schemas/examples/review-record.example.json) no longer exists at its old path', async () => {
  await assert.rejects(readFile(path.join(REPO_ROOT, 'schemas', 'examples', 'review-record.example.json')));
});

// --- zero remaining wave0 5-state references outside this migration helper/fixtures ----------------
//
// Guards the AC directly: greps scripts/, tests/, src/, tools/ for the two most wave0-specific,
// low-false-positive-risk tokens (`workflowState`, `conflictResolution` -- neither wave0 field has a
// canonical analog anywhere, contracts-design.md §a.3 items 4/6) and asserts they appear ONLY inside
// this migration helper, this test file, or tests/ef-review-record-schema.test.mjs's own NEGATIVE
// assertions (which prove those fields are ABSENT from the canonical schema -- a guard for R5, not a
// wave0 consumer).

const ALLOWED_WAVE0_TOKEN_FILES = new Set([
  'tests/ef-review-record-migration.test.mjs',
  'tests/ef-review-record-schema.test.mjs',
  'tools/review-record/lib/wave0-migration.mjs',
]);

async function collectSourceFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'fixtures') continue;
      out.push(...(await collectSourceFiles(full)));
    } else if (entry.isFile() && (entry.name.endsWith('.mjs') || entry.name.endsWith('.js'))) {
      out.push(full);
    }
  }
  return out;
}

test('zero remaining wave0 workflowState/conflictResolution references outside the migration helper/fixtures', async () => {
  const roots = ['scripts', 'tests', 'src', 'tools'].map((d) => path.join(REPO_ROOT, d));
  const files = (await Promise.all(roots.map(collectSourceFiles))).flat();
  const offenders = [];
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    if (ALLOWED_WAVE0_TOKEN_FILES.has(rel)) continue;
    const content = await readFile(file, 'utf8');
    if (content.includes('workflowState') || content.includes('conflictResolution')) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `unexpected wave0 5-state references outside the migration helper/fixtures: ${JSON.stringify(offenders)}`);
});
