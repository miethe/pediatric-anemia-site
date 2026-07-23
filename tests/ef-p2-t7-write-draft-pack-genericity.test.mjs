// tests/ef-p2-t7-write-draft-pack-genericity.test.mjs — P2-T7 (multi-bundle-conversion-e1-finish,
// Phase 2), phase-2-3-genericity-decisions-authoring.md row P2-T7.
//
// Genericizes writeDraftPack()/CANDIDATES by moduleId (FR-F10, FR-F11 -- planning-gate
// BLOCKING-finding fix): P2-T3 only genericized the emission GATE's consumption of
// RULE_PROPOSALS -- it never touched writeDraftPack()/CANDIDATES, so left as-is, running propose
// for e.g. kidney_suite_v1 would have written cbc's 4 neutropenia proposals and cbc's
// benign-ethnic-neutropenia-differential-pattern candidate -- with moduleId: "cbc_suite_v1"
// embedded -- into kidney_suite_v1's own output tree. This file proves that regression is closed.
//
// This task's own AC (verbatim scope):
//   1. writeDraftPack({ outDir: <scratch>, moduleId: 'kidney_suite_v1' }) -> rule-proposals.json's
//      proposals array is [] and its moduleId field is "kidney_suite_v1" (never "cbc_suite_v1");
//      candidates.json is {}.
//   2. The emitted documents contain ZERO occurrence of any dec_cbc_* decision id, any
//      CBC-NEUT-*/CBC-MARROW-REDFLAG-* rule-proposal id, the candidate id
//      benign-ethnic-neutropenia-differential-pattern, or cbc_suite_v1's own RF_PROVENANCE
//      (rf_run_20260717_rf_cbc_001_pediatric_cds_establish /
//      bundle_20260718_intent_research_20260717_rf_cbc_001).
//   3. A regression test confirms writeDraftPack({ outDir, moduleId: 'cbc_suite_v1' })'s output is
//      unchanged (byte-identical) from its pre-this-task output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  writeDraftPack,
  RULE_PROPOSALS,
  CANDIDATES,
  RF_PROVENANCE,
  MODULE_ID,
} from '../tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs';

// cbc_suite_v1's own decision/rule/candidate identities -- the exact strings a cross-module leak
// would reproduce under a different module's identity. Sourced directly from the real committed
// content (not re-typed by hand) so this list can never silently drift from what the converter
// actually emits.
const CBC_DECISION_IDS = [...new Set(RULE_PROPOSALS.map((p) => p.decisionId))];
const CBC_RULE_PROPOSAL_IDS = RULE_PROPOSALS.map((p) => p.id);
const CBC_CANDIDATE_IDS = Object.keys(CANDIDATES);
const CBC_RF_PROVENANCE_STRINGS = [RF_PROVENANCE.rfRunId, RF_PROVENANCE.rfBundleId];

test('P2-T7: writeDraftPack for a non-cbc module (kidney_suite_v1) emits inert, empty, correctly-identified output', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-p2-t7-kidney-'));
  try {
    const { ruleProposalsPath, candidatesPath } = await writeDraftPack({
      outDir,
      moduleId: 'kidney_suite_v1',
    });

    const ruleProposalsRaw = await readFile(ruleProposalsPath, 'utf8');
    const ruleProposalsDoc = JSON.parse(ruleProposalsRaw);
    assert.equal(ruleProposalsDoc.moduleId, 'kidney_suite_v1', 'moduleId must be the ACTUAL target module, never cbc_suite_v1');
    assert.deepEqual(ruleProposalsDoc.proposals, [], 'kidney_suite_v1 has no hand-authored proposals -- must be []');

    const candidatesRaw = await readFile(candidatesPath, 'utf8');
    const candidatesDoc = JSON.parse(candidatesRaw);
    assert.deepEqual(candidatesDoc, {}, 'kidney_suite_v1 has no hand-authored candidates -- must be the bare empty object {}');

    // Cross-module-leak negative control: grep the raw serialized bytes of both emitted files for
    // ANY cbc-identifying string.
    const haystacks = { 'rule-proposals.json': ruleProposalsRaw, 'candidates.json': candidatesRaw };
    const forbiddenStrings = [
      ...CBC_DECISION_IDS,
      ...CBC_RULE_PROPOSAL_IDS,
      ...CBC_CANDIDATE_IDS,
      ...CBC_RF_PROVENANCE_STRINGS,
    ];
    assert.ok(forbiddenStrings.length > 0, 'sanity: the forbidden-string list must be non-empty (derived from real cbc content)');

    const leaks = [];
    for (const [filename, raw] of Object.entries(haystacks)) {
      for (const forbidden of forbiddenStrings) {
        if (raw.includes(forbidden)) {
          leaks.push({ filename, forbidden });
        }
      }
    }
    assert.deepEqual(
      leaks,
      [],
      `cross-module content leak: cbc_suite_v1 identifiers must never appear in kidney_suite_v1's own output: ${JSON.stringify(leaks, null, 2)}`,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('P2-T7: writeDraftPack for the other two non-cbc modules (growth_suite_v1, anemia) is equally inert and leak-free', async () => {
  for (const moduleId of ['growth_suite_v1', 'anemia']) {
    const outDir = await mkdtemp(path.join(os.tmpdir(), `ef-p2-t7-${moduleId}-`));
    try {
      const { ruleProposalsPath, candidatesPath } = await writeDraftPack({ outDir, moduleId });

      const ruleProposalsDoc = JSON.parse(await readFile(ruleProposalsPath, 'utf8'));
      assert.equal(ruleProposalsDoc.moduleId, moduleId);
      assert.deepEqual(ruleProposalsDoc.proposals, []);
      assert.equal(ruleProposalsDoc.rfProvenance, null, `${moduleId} has no drafted proposals -- rfProvenance must be null, never cbc's`);

      const candidatesDoc = JSON.parse(await readFile(candidatesPath, 'utf8'));
      assert.deepEqual(candidatesDoc, {});
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }
});

test('P2-T7: writeDraftPack for cbc_suite_v1 is unchanged (byte-identical) from its pre-genericity output', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-p2-t7-cbc-regression-'));
  try {
    const { ruleProposalsPath, candidatesPath } = await writeDraftPack({ outDir, moduleId: MODULE_ID });

    const ruleProposalsDoc = JSON.parse(await readFile(ruleProposalsPath, 'utf8'));
    assert.equal(ruleProposalsDoc.moduleId, 'cbc_suite_v1');
    assert.deepEqual(ruleProposalsDoc.proposals, RULE_PROPOSALS);
    assert.deepEqual(ruleProposalsDoc.rfProvenance, RF_PROVENANCE);

    const candidatesDoc = JSON.parse(await readFile(candidatesPath, 'utf8'));
    assert.deepEqual(candidatesDoc, CANDIDATES);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('P2-T7: writeDraftPack requires a non-empty moduleId (fails closed rather than silently defaulting to cbc)', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-p2-t7-noModuleId-'));
  try {
    await assert.rejects(() => writeDraftPack({ outDir }), TypeError);
    await assert.rejects(() => writeDraftPack({ outDir, moduleId: '' }), TypeError);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
