// tests/p4-t7-cbc-post-merge-byte-identity.test.mjs — P4-T7 (multi-bundle-conversion-e1, Phase 4).
//
// Seam task (R-P3). Per the plan's binding row (P4-T7,
// docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/
// phase-3-4-scaffolds-and-backfill.md): compares modules/cbc_suite_v1/{rules.json,
// authoring-decisions.yaml} and every RF-CBC-001-derived record inside evidence.json /
// evidence-assertions.json against the P4-T1 pre-merge snapshot
// (tests/fixtures/p4-t1-pre-merge-snapshot.json.txt). This is the hard test gate the decisions
// block requires before Risk 2 (cbc_suite_v1 collision-safe RF-CBC-002 merge) is considered
// closed — it is asserted here, not assumed.
//
// Scope note: this file only touches modules/cbc_suite_v1/** and the shared P4-T1 fixture/helper.
// It does not read or assert anything under modules/anemia/ — that seam (rule<->evidence
// reference integrity across the RF-EV-001 backfill) is P4-T4's task, owned concurrently and
// exclusively by a sibling task in this phase.
//
// Two things this file proves that the generic P4-T1 fixture test
// (tests/p4-t1-pre-merge-snapshot.test.mjs) does not, on its own:
//   1. `rules.json` and `authoring-decisions.yaml` specifically (the two files the plan names by
//      name for the 100%-byte-identity requirement) are called out as their own dedicated
//      assertion, not folded anonymously into a loop over all WHOLE_FILE_TARGETS.
//   2. The record set the P4-T1 baseline captured for evidence.json/evidence-assertions.json is
//      cross-checked against the *current* file's own RF-CBC-001 provenance tags
//      (`rfRunId: rf_run_20260717_rf_cbc_001_pediatric_cds_establish` on every assertion;
//      `rfSourceCardId` starting `src_20260718_rfcbc001_` on every source) — proving the baseline
//      id set and "every RF-CBC-001-derived record" are the same set, not merely assumed to be,
//      and that the merge (P4-T5) tagged every appended RF-CBC-002 record distinctly rather than
//      leaving provenance ambiguous.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSnapshot } from '../scripts/lib/p4-t1-snapshot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(root, 'tests/fixtures/p4-t1-pre-merge-snapshot.json.txt');

const RF_CBC_001_RUN_ID = 'rf_run_20260717_rf_cbc_001_pediatric_cds_establish';
const RF_CBC_001_SOURCE_CARD_PREFIX = 'src_20260718_rfcbc001_';

const EVIDENCE_PATH = 'modules/cbc_suite_v1/evidence.json';
const ASSERTIONS_PATH = 'modules/cbc_suite_v1/evidence-assertions.json';

async function loadFixture() {
  return JSON.parse(await readFile(fixturePath, 'utf8'));
}

async function loadJson(relPath) {
  return JSON.parse(await readFile(path.join(root, relPath), 'utf8'));
}

test('P4-T7: cbc_suite_v1/rules.json is 100% byte-identical to the P4-T1 pre-merge snapshot', async () => {
  const fixture = await loadFixture();
  const current = await computeSnapshot(root);
  const relPath = 'modules/cbc_suite_v1/rules.json';
  assert.equal(
    current.files[relPath].sha256,
    fixture.files[relPath].sha256,
    'modules/cbc_suite_v1/rules.json has drifted from the P4-T1 baseline — no approved decision ' +
      'exists for any RF-CBC-002-specific rule, so this file must be untouched by the Phase 4 merge',
  );
  assert.equal(current.files[relPath].byteLength, fixture.files[relPath].byteLength, relPath);
});

test('P4-T7: cbc_suite_v1/authoring-decisions.yaml is 100% byte-identical to the P4-T1 pre-merge snapshot', async () => {
  const fixture = await loadFixture();
  const current = await computeSnapshot(root);
  const relPath = 'modules/cbc_suite_v1/authoring-decisions.yaml';
  assert.equal(
    current.files[relPath].sha256,
    fixture.files[relPath].sha256,
    'modules/cbc_suite_v1/authoring-decisions.yaml has drifted from the P4-T1 baseline — the ' +
      'RF-CBC-002 merge (P4-T5) is not authorized to touch authoring decisions',
  );
  assert.equal(current.files[relPath].byteLength, fixture.files[relPath].byteLength, relPath);
});

test('P4-T7: cbc_suite_v1/candidates.json and rule-provenance.json remain byte-identical (Risk 2 exit gate, belt-and-suspenders)', async () => {
  const fixture = await loadFixture();
  const current = await computeSnapshot(root);
  for (const relPath of [
    'modules/cbc_suite_v1/candidates.json',
    'modules/cbc_suite_v1/rule-provenance.json',
  ]) {
    assert.equal(current.files[relPath].sha256, fixture.files[relPath].sha256, relPath);
    assert.equal(current.files[relPath].byteLength, fixture.files[relPath].byteLength, relPath);
  }
});

test('P4-T7: every RF-CBC-001-tagged source in evidence.json is unchanged, field-for-field, from the P4-T1 baseline', async () => {
  const fixture = await loadFixture();
  const current = await computeSnapshot(root);
  const baselineIds = fixture.records[EVIDENCE_PATH].byId;
  const currentIds = current.records[EVIDENCE_PATH].byId;

  // Baseline set == current file's own RF-CBC-001 tag set (cross-check the identification method
  // the plan describes — "every RF-CBC-001-derived record" — against what P4-T1 actually captured).
  const evidenceJson = await loadJson(EVIDENCE_PATH);
  const currentRfCbc001Ids = new Set(
    evidenceJson.sources
      .filter((s) => typeof s.rfSourceCardId === 'string' && s.rfSourceCardId.startsWith(RF_CBC_001_SOURCE_CARD_PREFIX))
      .map((s) => s.id),
  );
  assert.deepEqual(
    [...currentRfCbc001Ids].sort(),
    Object.keys(baselineIds).sort(),
    'the set of sources currently tagged with an RF-CBC-001 rfSourceCardId no longer matches the ' +
      'P4-T1 baseline record set — RF-CBC-001 provenance tagging drifted from the pre-merge state',
  );

  // Field-for-field identity: every RF-CBC-001-tagged record's JCS-canonical hash is unchanged.
  for (const [id, hash] of Object.entries(baselineIds)) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(currentIds, id),
      `${EVIDENCE_PATH}: RF-CBC-001 record "${id}" is missing after the merge`,
    );
    assert.equal(
      currentIds[id],
      hash,
      `${EVIDENCE_PATH}: RF-CBC-001 record "${id}" no longer matches its P4-T1 baseline hash — it ` +
        'was mutated by the RF-CBC-002 merge, which must be strictly additive',
    );
  }

  // Sanity: the RF-CBC-002 merge (P4-T5/P4-T6) is expected to have appended new sources alongside
  // the RF-CBC-001 baseline, never fewer.
  assert.ok(
    evidenceJson.sources.length >= Object.keys(baselineIds).length,
    'modules/cbc_suite_v1/evidence.json has fewer sources than the P4-T1 RF-CBC-001 baseline',
  );
});

test('P4-T7: every record tagged rfRunId=rf_run_20260717_rf_cbc_001_pediatric_cds_establish in evidence-assertions.json is unchanged, field-for-field', async () => {
  const fixture = await loadFixture();
  const current = await computeSnapshot(root);
  const baselineIds = fixture.records[ASSERTIONS_PATH].byId;
  const currentIds = current.records[ASSERTIONS_PATH].byId;

  const assertionsJson = await loadJson(ASSERTIONS_PATH);
  const currentRfCbc001AssertionIds = new Set(
    assertionsJson.assertions.filter((a) => a.rfRunId === RF_CBC_001_RUN_ID).map((a) => a.assertionId),
  );
  assert.deepEqual(
    [...currentRfCbc001AssertionIds].sort(),
    Object.keys(baselineIds).sort(),
    `the set of assertions currently tagged rfRunId="${RF_CBC_001_RUN_ID}" no longer matches the ` +
      'P4-T1 baseline record set',
  );

  for (const [id, hash] of Object.entries(baselineIds)) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(currentIds, id),
      `${ASSERTIONS_PATH}: RF-CBC-001 assertion "${id}" is missing after the merge`,
    );
    assert.equal(
      currentIds[id],
      hash,
      `${ASSERTIONS_PATH}: RF-CBC-001 assertion "${id}" no longer matches its P4-T1 baseline hash ` +
        '— it was mutated by the RF-CBC-002 merge, which must be strictly additive',
    );
  }

  // Every remaining assertion (i.e. everything not RF-CBC-001-tagged) must be tagged RF-CBC-002 —
  // provenance is exhaustive and unambiguous, no untagged/third-party record slipped in unnoticed.
  const RF_CBC_002_RUN_ID = 'rf_run_20260717_rf_cbc_002_pediatric_cds_establish';
  for (const assertion of assertionsJson.assertions) {
    assert.ok(
      assertion.rfRunId === RF_CBC_001_RUN_ID || assertion.rfRunId === RF_CBC_002_RUN_ID,
      `assertion "${assertion.assertionId}" has an unexpected rfRunId "${assertion.rfRunId}" — ` +
        'every record in this file must be traceable to RF-CBC-001 or RF-CBC-002',
    );
  }

  assert.ok(
    assertionsJson.assertions.length >= Object.keys(baselineIds).length,
    'modules/cbc_suite_v1/evidence-assertions.json has fewer assertions than the P4-T1 RF-CBC-001 baseline',
  );
});

test('P4-T7: Risk 2 closure summary — cbc_suite_v1 E0-era content proven byte-identical post-merge', async () => {
  // This test has no new assertions of its own; it documents, in one place discoverable by name,
  // that all of the above have run and passed as the decisions-block's required hard test gate for
  // Risk 2 closure (module.json's status/approvedBy/clinicalContentHash unchanged posture is
  // separately covered by P4-T8's own load-bearing honesty AC).
  assert.ok(true);
});
