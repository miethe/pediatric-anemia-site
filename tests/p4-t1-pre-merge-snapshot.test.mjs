// tests/p4-t1-pre-merge-snapshot.test.mjs — P4-T1 (multi-bundle-conversion-e1, Phase 4).
//
// Proves the committed Phase 4 pre-merge baseline
// (tests/fixtures/p4-t1-pre-merge-snapshot.json.txt) is well-formed and, as of right now (before
// any propose run in this phase has landed), an accurate fingerprint of every file it targets.
//
// Fixture filename is deliberately `.json.txt`, not `.json`: scripts/evidence/
// backfill-rule-governance.mjs sweeps every `*.json` under tests/fixtures/ (via
// scripts/rule-coverage.mjs computeCoverage, fixtureDirs: ['tests/witness', 'tests/fixtures'])
// and runs each through assessPediatricAnemia() to regenerate rules' requiredTestCaseIds
// coverage — this snapshot is not a patient-intake payload, so a plain-`.json` name here made
// that regeneration diverge from the committed modules/anemia/rules.json
// (tests/rule-governance.test.mjs's `--check` subtest failed). Same mitigation
// tests/fixtures/rf-cbc-001/passage-hash-ledger.json.txt and tests/fixtures/invalid-rule/'s
// seeded-invalid fixture already apply, for the same reason. Content below is still loaded with
// plain readFile + JSON.parse — the extension is invisible to this test.
//
// This file is the P4-T1 deliverable's own gate — NOT the phase's byte-identity seam tasks
// themselves. P4-T4 (anemia rule<->evidence reference integrity) and P4-T7 (cbc_suite_v1
// post-merge byte-identity) are separate, later tasks; they import the same
// scripts/lib/p4-t1-snapshot.mjs helpers and load this same fixture to do their own comparisons
// once RF-EV-001/RF-CBC-002 have actually run. The two assertions below stay true for the rest of
// Phase 4 regardless of what those later tasks do:
//   - every WHOLE_FILE_TARGETS path must never drift from this baseline (Risk 1 / Risk 2 exit gate)
//   - every RF-CBC-001-era record hash captured here must still be present and unchanged, even
//     after RF-CBC-002 appends new sibling records alongside it (additive-only merge, FR-7/FR-8)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeSnapshot,
  WHOLE_FILE_TARGETS,
  RECORD_TARGETS,
  ALL_TARGET_PATHS,
} from '../scripts/lib/p4-t1-snapshot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(root, 'tests/fixtures/p4-t1-pre-merge-snapshot.json.txt');

async function loadFixture() {
  return JSON.parse(await readFile(fixturePath, 'utf8'));
}

test('P4-T1 fixture exists and is schema-shaped', async () => {
  const fixture = await loadFixture();
  assert.equal(fixture.$schema, 'p4-t1-pre-merge-snapshot@1');
  assert.equal(fixture.taskId, 'P4-T1');
  assert.deepEqual(fixture.wholeFileInvariants, WHOLE_FILE_TARGETS);
  assert.deepEqual(
    fixture.recordInvariants,
    RECORD_TARGETS.map((t) => ({ relPath: t.relPath, arrayField: t.arrayField, idField: t.idField })),
  );
  for (const relPath of ALL_TARGET_PATHS) {
    assert.ok(fixture.files[relPath], `fixture is missing files["${relPath}"]`);
    assert.match(fixture.files[relPath].sha256, /^sha256:[0-9a-f]{64}$/);
    assert.equal(typeof fixture.files[relPath].byteLength, 'number');
    assert.ok(fixture.files[relPath].byteLength > 0);
  }
  for (const target of RECORD_TARGETS) {
    const entry = fixture.records[target.relPath];
    assert.ok(entry, `fixture is missing records["${target.relPath}"]`);
    assert.equal(entry.arrayField, target.arrayField);
    assert.equal(entry.idField, target.idField);
    assert.ok(entry.recordCount > 0, `${target.relPath} baseline captured zero records`);
    assert.equal(Object.keys(entry.byId).length, entry.recordCount);
    for (const hash of Object.values(entry.byId)) {
      assert.match(hash, /^sha256:[0-9a-f]{64}$/);
    }
  }
});

test('whole-file invariant targets are byte-identical to the P4-T1 baseline (R-1/R-2)', async () => {
  const fixture = await loadFixture();
  const current = await computeSnapshot(root);
  for (const relPath of WHOLE_FILE_TARGETS) {
    assert.equal(
      current.files[relPath].sha256,
      fixture.files[relPath].sha256,
      `${relPath} has drifted from the P4-T1 pre-merge snapshot — Phase 4 must not mutate this file`,
    );
    assert.equal(current.files[relPath].byteLength, fixture.files[relPath].byteLength, relPath);
  }
});

test('every RF-CBC-001-era record hash is still present and byte-for-byte unchanged', async () => {
  const fixture = await loadFixture();
  const current = await computeSnapshot(root);
  for (const target of RECORD_TARGETS) {
    const baselineIds = fixture.records[target.relPath].byId;
    const currentIds = current.records[target.relPath].byId;
    for (const [id, hash] of Object.entries(baselineIds)) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(currentIds, id),
        `${target.relPath}: baseline record "${id}" is missing from the current file`,
      );
      assert.equal(
        currentIds[id],
        hash,
        `${target.relPath}: record "${id}" no longer matches its P4-T1 baseline hash — it was mutated, not left additive-only`,
      );
    }
  }
});

test('post-P4-T5: the two append-only files retain the full baseline record set as a subset (never fewer, legitimately more)', async () => {
  // Originally asserted exact equality ("before any propose run has landed"). P4-T5
  // (multi-bundle-conversion-e1) has now appended 12 RF-CBC-002 sources / 75 RF-CBC-002 assertions
  // alongside the RF-CBC-001 baseline captured here — record counts legitimately grew, so this is
  // now a SUBSET check (every baseline id is still present) rather than exact-set equality. The
  // stronger guarantee — every baseline record's hash is byte-for-byte unchanged, not merely
  // present — is already proven by the preceding test; this one only guards against a baseline
  // record being silently DROPPED, which subset-of would also catch. P4-T7 (this phase's own
  // dedicated seam task) performs the authoritative RF-CBC-001-vs-current comparison once the
  // rest of Phase 4 has landed.
  const fixture = await loadFixture();
  const current = await computeSnapshot(root);
  for (const target of RECORD_TARGETS) {
    const baselineIds = Object.keys(fixture.records[target.relPath].byId).sort();
    const currentIds = new Set(Object.keys(current.records[target.relPath].byId));
    for (const id of baselineIds) {
      assert.ok(currentIds.has(id), `${target.relPath}: baseline record "${id}" is missing from the current file — P4-T1 baseline records must never be dropped`);
    }
  }
});
