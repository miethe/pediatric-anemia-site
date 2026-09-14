import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assess } from '../src/engine.js';
import { deriveFacts as deriveCbcFacts } from '../modules/cbc_suite_v1/facts.cbc.js';
import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { parseYamlDocument } from '../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';

const moduleUrl = new URL('../modules/cbc_suite_v1/', import.meta.url);
const rules = JSON.parse(await readFile(new URL('rules.json', moduleUrl), 'utf8'));
const candidates = JSON.parse(await readFile(new URL('candidates.json', moduleUrl), 'utf8'));
const assertions = JSON.parse(await readFile(new URL('evidence-assertions.json', moduleUrl), 'utf8'));
const decisionSchema = JSON.parse(await readFile(new URL('../schemas/authoring-decisions.schema.json', import.meta.url), 'utf8'));
const ruleSchema = JSON.parse(await readFile(new URL('../schemas/rule.schema.json', import.meta.url), 'utf8'));
const proposalPack = JSON.parse(await readFile(new URL('rule-proposals.cbc-suite-expansion.json', moduleUrl), 'utf8'));

const proposalDocuments = await Promise.all([
  'authoring-proposals.cbc-suite-expansion.yaml',
  'authoring-proposals.rf-cbc-002.yaml',
].map(async (filename) => ({
  filename,
  document: parseYamlDocument(await readFile(new URL(filename, moduleUrl), 'utf8')),
})));

test('all CBC expansion decisions are schema-valid, pending, and trace to their declared RF run', () => {
  const assertionById = new Map(assertions.assertions.map((entry) => [entry.assertionId, entry]));
  for (const { filename, document } of proposalDocuments) {
    assert.deepEqual(validate(decisionSchema, document), [], filename);
    for (const decision of document.decisions) {
      assert.equal(decision.status, 'drafted_pending_human_approval', decision.decision_id);
      for (const assertionId of decision.basis.exact_assertion_ids) {
        const assertion = assertionById.get(assertionId);
        assert.ok(assertion, `${assertionId} must resolve`);
        assert.equal(assertion.rfRunId, document.rfProvenance.rfRunId);
        assert.ok(decision.basis.rf_claim_ids.includes(assertion.rfClaimId));
      }
    }
  }
});

test('six structurally valid CBC rule proposals remain disjoint from the four-rule runtime package', () => {
  const pendingDecisionIds = new Set(
    proposalDocuments.flatMap(({ document }) => document.decisions.map((entry) => entry.decision_id)),
  );
  const runtimeIds = new Set(rules.map((rule) => rule.id));
  const proposedIds = new Set();

  assert.equal(rules.length, 4, 'the historical unsigned E0 runtime remains unchanged');
  assert.equal(proposalPack.posture, 'non-executable-pending-human-approval');
  assert.equal(proposalPack.proposals.length, 6);
  for (const proposal of proposalPack.proposals) {
    assert.equal(proposal.status, 'drafted_pending_human_approval');
    assert.ok(pendingDecisionIds.has(proposal.decisionId), `${proposal.decisionId} must resolve`);
    assert.deepEqual(validate(ruleSchema, proposal.proposedRule), [], proposal.proposedRule.id);
    assert.ok(!runtimeIds.has(proposal.proposedRule.id), `${proposal.proposedRule.id} must not execute`);
    proposedIds.add(proposal.proposedRule.id);
  }
  assert.equal(proposedIds.size, 6);
});

test('canonical runtime provenance covers only executable rules and references no pending decision', async () => {
  const provenance = JSON.parse(await readFile(new URL('rule-provenance.json', moduleUrl), 'utf8'));
  const pendingDecisionIds = new Set(
    proposalDocuments.flatMap(({ document }) => document.decisions.map((entry) => entry.decision_id)),
  );
  assert.deepEqual(
    new Set(provenance.entries.map((entry) => entry.ruleId)),
    new Set(rules.map((rule) => rule.id)),
  );
  for (const entry of provenance.entries) {
    assert.ok(!pendingDecisionIds.has(entry.basis.decisionId));
  }
});

test('pending CBC expansion rules cannot emit even when their draft conditions would be relevant', () => {
  const result = assess({
    patient: {},
    cbc: {
      hemoglobin: 9,
      anc: 0.8,
      platelets: 80,
      localFlags: { neutropenia: 'true', thrombocytopenia: 'true' },
    },
    smearReviewed: 'false',
  }, 'cbc_suite_v1', rules, candidates);
  const emittedIds = new Set([
    ...result.alerts,
    ...result.nextQuestions,
    ...result.interpretiveNotes,
  ].map((entry) => entry.id));
  for (const { proposedRule } of proposalPack.proposals) {
    assert.ok(!emittedIds.has(proposedRule.id), `${proposedRule.id} is pending and must not emit`);
  }
  assert.ok(!Object.hasOwn(result.classification, 'pancytopenia'));
  assert.ok(!Object.hasOwn(result.classification, 'localProfileIncomplete'));
});

test('the internal local-profile substrate is fail-closed without becoming an executable output', () => {
  const unresolved = deriveCbcFacts({
    patient: { ageMonths: 24 },
    cbc: { anc: 0.3, platelets: 80 },
  });
  assert.equal(unresolved.cbc.urgency.localProfileIncomplete, 'true');
  assert.equal(unresolved.cbc.neutropenia, 'unknown');
  assert.equal(unresolved.cbc.thrombocytopenia, 'unknown');

  const placeholders = deriveCbcFacts({
    patient: { ageMonths: 24 },
    cbc: { wbc: null, anc: null, platelets: null, localFlags: {} },
  });
  assert.equal(placeholders.cbc.urgency.localProfileIncomplete, 'false');
  assert.equal(placeholders.cbc.leukocytosis, 'unknown');
  assert.equal(placeholders.cbc.eosinophilia, 'unknown');
  assert.ok(!Object.hasOwn(placeholders.cbc, 'pancytopenia'));
  assert.ok(!Object.hasOwn(placeholders.cbc.urgency, 'smearReviewRequired'));
});
