// tests/ef-converter-rule-candidate-drafting.test.mjs — P3-T5 (evidence-foundry-buildout Phase 3,
// `02 §4.13`/`02 §4.14`).
//
// Proves tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs's hand-authored content and its
// writeDraftPack() helper satisfy this task's binding acceptance criteria:
//
//   1. rule-proposals.json has EXACTLY 4 entries, each joined to a REAL
//      modules/cbc_suite_v1/authoring-decisions.yaml record by `decisionId` — cross-checked
//      against the actual parsed YAML file, not a second hardcoded string list.
//   2. The differential candidate's `label` contains "pattern," never a diagnostic assertion.
//   3. At least one proposal rule's `output` references the candidate (output.type === 'candidate'
//      && output.candidateId === the candidate's id).
//   4. The candidate is schema-legal against schemas/candidate.schema.json, and its `evidence[]` +
//      `sourcePassageId` genuinely resolve against the real, committed
//      modules/cbc_suite_v1/evidence.json (reusing validateCandidates(), the same function
//      `npm run validate` calls per module) — not merely schema-shape-legal in isolation.
//   5. writeDraftPack() materializes both files at the `02 §4.4` staged-pack path
//      (build/kb-pack/cbc_suite_v1/0.1.0-proposal/, gitignored per P1-T7) and the written bytes
//      round-trip byte-for-byte with the in-memory constants.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RULE_PROPOSALS,
  CANDIDATES,
  writeDraftPack,
} from '../tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs';
import { parseYamlDocument } from '../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';
import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { validateEvidenceDocument, validateCandidates } from '../scripts/validate-kb.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUTHORING_DECISIONS_PATH = path.join(
  REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml',
);
const EVIDENCE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'evidence.json');
const CANDIDATE_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'candidate.schema.json');
const EVIDENCE_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'evidence.schema.json');
const STAGED_PACK_DIR = path.join(
  REPO_ROOT, 'build', 'kb-pack', 'cbc_suite_v1', '0.1.0-proposal',
);

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

test('rule-proposals.json has exactly 4 entries, each joined by decisionId to a real authoring-decisions.yaml record', async () => {
  const decisionsDoc = parseYamlDocument(await readFile(AUTHORING_DECISIONS_PATH, 'utf8'));
  const realDecisionIds = new Set((decisionsDoc.decisions ?? []).map((d) => d.decision_id));

  assert.equal(RULE_PROPOSALS.length, 4, 'exactly 4 rule proposals (one per FR-16 slice rule)');
  assert.equal(realDecisionIds.size, 4, 'sanity: the real authoring-decisions.yaml has 4 records');

  const usedDecisionIds = new Set();
  for (const proposal of RULE_PROPOSALS) {
    assert.ok(
      realDecisionIds.has(proposal.decisionId),
      `proposal ${proposal.id}'s decisionId "${proposal.decisionId}" must name a real decision_id `
        + 'in modules/cbc_suite_v1/authoring-decisions.yaml',
    );
    assert.ok(!usedDecisionIds.has(proposal.decisionId), `decisionId ${proposal.decisionId} used more than once`);
    usedDecisionIds.add(proposal.decisionId);
  }
  // Every real decision has exactly one drafted proposal joined to it — no orphaned decision.
  assert.deepEqual(usedDecisionIds, realDecisionIds);
});

test('every rule-proposal `when`/`output` is well-formed and every claim id cited is real', async () => {
  const decisionsDoc = parseYamlDocument(await readFile(AUTHORING_DECISIONS_PATH, 'utf8'));
  const decisionsById = new Map((decisionsDoc.decisions ?? []).map((d) => [d.decision_id, d]));

  for (const proposal of RULE_PROPOSALS) {
    assert.match(proposal.id, /^[A-Z0-9-]+$/, `${proposal.id}: rule id must match rule.schema.json's id pattern`);
    assert.ok(proposal.when && typeof proposal.when === 'object', `${proposal.id}: when must be an object`);
    assert.ok(Array.isArray(proposal.evidence) && proposal.evidence.length > 0, `${proposal.id}: evidence[] must be non-empty`);
    assert.ok(['candidate', 'alert', 'question', 'note'].includes(proposal.output?.type), `${proposal.id}: output.type must be a recognized kind`);
    // Invariant 15 (tests/ef-converter-invariants.test.mjs): no file under
    // tools/rf-bundle-to-kb-pack/ may ever name a clinical-approval field, even as an
    // always-empty placeholder — so this drafting module deliberately carries none.
    assert.ok(
      !Object.prototype.hasOwnProperty.call(proposal, 'clinicalApprovers'),
      `${proposal.id}: must not carry a clinical-approval field (Invariant 15)`,
    );

    // Every rfClaimId this proposal cites must actually appear in its joined decision's basis —
    // proves the proposal did not invent a claim id the decision never approved.
    const decision = decisionsById.get(proposal.decisionId);
    assert.ok(decision, `${proposal.id}: joined decision ${proposal.decisionId} must exist`);
    const decisionClaimIds = new Set(decision.basis?.rf_claim_ids ?? []);
    for (const claimId of proposal.rfClaimIds ?? []) {
      assert.ok(
        decisionClaimIds.has(claimId),
        `${proposal.id}: rfClaimId ${claimId} must be present in ${proposal.decisionId}'s basis.rf_claim_ids`,
      );
    }
  }
});

test('the differential candidate says "pattern," never a diagnostic assertion, and is schema-legal', async () => {
  const schema = await loadJson(CANDIDATE_SCHEMA_PATH);
  const candidateIds = Object.keys(CANDIDATES);
  assert.equal(candidateIds.length, 1, 'exactly 1 drafted candidate for this slice');

  const [candidateId] = candidateIds;
  const candidate = CANDIDATES[candidateId];
  assert.equal(candidate.id, candidateId, 'object key must match candidate.id');
  assert.match(candidate.label.toLowerCase(), /pattern/, 'label must say "pattern," not diagnostic certainty');
  assert.doesNotMatch(
    candidate.label.toLowerCase(),
    /\b(diagnosis|diagnosed|confirmed)\b/,
    'label must not assert diagnostic certainty',
  );

  const schemaErrors = validate(schema, candidate);
  assert.deepEqual(schemaErrors, [], `candidate must be schema-legal: ${JSON.stringify(schemaErrors)}`);
});

test('≥1 proposal rule references the drafted candidate by id', () => {
  const [candidateId] = Object.keys(CANDIDATES);
  const referencing = RULE_PROPOSALS.filter(
    (p) => p.output?.type === 'candidate' && p.output?.candidateId === candidateId,
  );
  assert.ok(referencing.length >= 1, 'at least one proposal must emit the drafted candidate');
});

test('the candidate\'s evidence[] and sourcePassageId genuinely resolve against the real, committed modules/cbc_suite_v1/evidence.json', async () => {
  const evidenceSchema = await loadJson(EVIDENCE_SCHEMA_PATH);
  const candidateSchema = await loadJson(CANDIDATE_SCHEMA_PATH);
  const evidenceData = await loadJson(EVIDENCE_PATH);

  const { errors: evidenceErrors, passageIndex, sourcesWithPassages } =
    validateEvidenceDocument(evidenceData, 'cbc_suite_v1', evidenceSchema);
  assert.deepEqual(evidenceErrors, [], `real evidence.json must itself be schema-valid: ${JSON.stringify(evidenceErrors)}`);

  const evidenceIds = new Set((evidenceData.sources ?? []).map((s) => s.id));
  const { errors: candidateErrors } = validateCandidates(CANDIDATES, 'cbc_suite_v1', {
    candidateSchema, evidenceIds, sourcesWithPassages, passageIndex,
  });
  assert.deepEqual(candidateErrors, [], `candidate must resolve cleanly against real evidence.json: ${JSON.stringify(candidateErrors)}`);
});

test('writeDraftPack() materializes rule-proposals.json + candidates.json at the 02 §4.4 staged-pack path, byte-identical to the in-memory constants', async () => {
  await rm(STAGED_PACK_DIR, { recursive: true, force: true });

  const { ruleProposalsPath, candidatesPath } = await writeDraftPack();
  assert.equal(ruleProposalsPath, path.join(STAGED_PACK_DIR, 'rule-proposals.json'));
  assert.equal(candidatesPath, path.join(STAGED_PACK_DIR, 'candidates.json'));

  const writtenProposalsDoc = await loadJson(ruleProposalsPath);
  assert.equal(writtenProposalsDoc.moduleId, 'cbc_suite_v1');
  assert.deepEqual(writtenProposalsDoc.proposals, RULE_PROPOSALS);

  const writtenCandidates = await loadJson(candidatesPath);
  assert.deepEqual(writtenCandidates, CANDIDATES);

  // Determinism smoke check (full double-run proof is P5-T5's job): re-running writeDraftPack()
  // against the same in-memory constants produces byte-identical files.
  const beforeProposalsBytes = await readFile(ruleProposalsPath, 'utf8');
  const beforeCandidatesBytes = await readFile(candidatesPath, 'utf8');
  await writeDraftPack();
  const afterProposalsBytes = await readFile(ruleProposalsPath, 'utf8');
  const afterCandidatesBytes = await readFile(candidatesPath, 'utf8');
  assert.equal(afterProposalsBytes, beforeProposalsBytes);
  assert.equal(afterCandidatesBytes, beforeCandidatesBytes);
});
