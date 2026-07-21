// tests/ef-converter-rule-provenance-projection.test.mjs — P3-T6 (evidence-foundry-buildout Phase 3,
// FR-15, `02 §4.13`).
//
// Proves this task's binding acceptance criteria:
//
//   1. Each staged rule (scripts/evidence/govern-staged-rules.mjs's STAGED_STRICT_RULES) validates
//      against schemas/rule.schema.json with ZERO errors.
//   2. Every field the strict schema rejects (decisionId/rfClaimIds/evidenceAssertionIds/
//      decisionBasisKind/reviewBy/supersedes/authoringNotes) is carried forward into the joined
//      rule-provenance.json entry instead of being silently discarded — proven by an explicit
//      per-proposal join, not merely "the file exists."
//   3. A rule-provenance.json entry missing `basis.decisionId` fails schema validation (R-P2
//      analog) — the seeded-invalid case this schema exists to reject.
//   4. writeStagedRulesAndProvenance() materializes both files at the `02 §4.4` staged-pack path
//      and the write is deterministic (byte-identical across two runs against an isolated temp
//      directory, so this test never races P3-T5's own writes into the shared staged-pack dir).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RULE_PROPOSALS } from '../tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs';
import {
  PARTIAL_STRICT_RULES,
  RULE_PROVENANCE_ENTRIES,
  buildRuleProvenanceDocument,
} from '../tools/rf-bundle-to-kb-pack/lib/rule-provenance-drafts.mjs';
import {
  GOVERNED_KEY_ORDER,
  STAGED_STRICT_RULES,
  finalizeStrictRule,
  writeStagedRulesAndProvenance,
} from '../scripts/evidence/govern-staged-rules.mjs';
import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { validateRuleProvenance } from '../scripts/validate-kb.mjs';
import { parseYamlDocument } from '../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULE_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'rule.schema.json');
const RULE_PROVENANCE_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'rule-provenance.schema.json');
const AUTHORING_DECISIONS_PATH = path.join(
  REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml',
);
const STAGED_PACK_DIR = path.join(
  REPO_ROOT, 'build', 'kb-pack', 'cbc_suite_v1', '0.1.0-proposal',
);

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

test('exactly 4 staged rules and 4 rule-provenance entries, one per RULE_PROPOSALS entry', () => {
  assert.equal(RULE_PROPOSALS.length, 4);
  assert.equal(PARTIAL_STRICT_RULES.length, 4);
  assert.equal(STAGED_STRICT_RULES.length, 4);
  assert.equal(RULE_PROVENANCE_ENTRIES.length, 4);
});

test('each staged rule validates against schemas/rule.schema.json with zero errors', async () => {
  const ruleSchema = await loadJson(RULE_SCHEMA_PATH);
  for (const rule of STAGED_STRICT_RULES) {
    const errors = validate(ruleSchema, rule);
    assert.deepEqual(errors, [], `${rule.id} must validate against rule.schema.json: ${JSON.stringify(errors)}`);
    assert.deepEqual(Object.keys(rule), GOVERNED_KEY_ORDER, `${rule.id}: key order must match GOVERNED_KEY_ORDER`);
    assert.deepEqual(rule.clinicalApprovers, [], `${rule.id}: clinicalApprovers must be the fixed empty list`);
    assert.match(rule.sourcePassageId, /^[A-Z0-9_]+#implementation-proposal$/, `${rule.id}: sourcePassageId must be the D-EP3-6 implementation-proposal sentinel`);
  }
});

test('the strict projection carries no field schemas/rule.schema.json forbids (additionalProperties: false)', () => {
  const allowedKeys = new Set(GOVERNED_KEY_ORDER);
  for (const rule of STAGED_STRICT_RULES) {
    for (const key of Object.keys(rule)) {
      assert.ok(allowedKeys.has(key), `${rule.id}: key "${key}" is not permitted by rule.schema.json`);
    }
  }
});

test('finalizeStrictRule() throws if a required governed key is missing (fail closed, not silently permissive)', () => {
  const { id, ...incomplete } = PARTIAL_STRICT_RULES[0];
  void id;
  assert.throws(() => finalizeStrictRule(incomplete), /missing required field "id"/);
});

test('every field the strict rule schema has no slot for is carried forward into the joined rule-provenance.json entry, not silently discarded', () => {
  const entriesByRuleId = new Map(RULE_PROVENANCE_ENTRIES.map((entry) => [entry.ruleId, entry]));

  for (const proposal of RULE_PROPOSALS) {
    const entry = entriesByRuleId.get(proposal.id);
    assert.ok(entry, `${proposal.id}: must have a joined rule-provenance.json entry`);

    assert.equal(entry.moduleId, 'cbc_suite_v1');
    assert.equal(entry.basis.kind, proposal.decisionBasisKind, `${proposal.id}: basis.kind must carry forward decisionBasisKind`);
    assert.equal(entry.basis.decisionId, proposal.decisionId, `${proposal.id}: basis.decisionId must carry forward decisionId`);
    assert.deepEqual(entry.basis.rfClaimIds, proposal.rfClaimIds, `${proposal.id}: basis.rfClaimIds must carry forward rfClaimIds`);
    assert.deepEqual(entry.basis.evidenceAssertionIds, proposal.evidenceAssertionIds, `${proposal.id}: basis.evidenceAssertionIds must carry forward evidenceAssertionIds`);
    assert.equal(entry.reviewBy, proposal.reviewBy, `${proposal.id}: reviewBy must carry forward (no slot on the strict rule)`);
    assert.equal(entry.supersedes, proposal.supersedes, `${proposal.id}: supersedes must carry forward (no slot on the strict rule at all)`);
    assert.equal(entry.authoringNotes, proposal.authoringNotes, `${proposal.id}: authoringNotes must carry forward`);
    assert.equal(entry.reviewStatus, 'draft', `${proposal.id}: reviewStatus must be "draft" (no clinical review has occurred)`);
    assert.ok(typeof entry.missingness === 'string' && entry.missingness.length > 0, `${proposal.id}: missingness must be a non-empty, code-grounded description`);
    assert.ok(Array.isArray(entry.testIds), `${proposal.id}: testIds must be an array`);
  }
});

test('rule-provenance.json validates against schemas/rule-provenance.schema.json with zero errors', async () => {
  const schema = await loadJson(RULE_PROVENANCE_SCHEMA_PATH);
  const doc = buildRuleProvenanceDocument();
  const errors = validate(schema, doc);
  assert.deepEqual(errors, [], `rule-provenance.json must be schema-valid: ${JSON.stringify(errors)}`);

  const { errors: crossErrors, entryCount } = validateRuleProvenance(doc, 'cbc_suite_v1', schema);
  assert.deepEqual(crossErrors, []);
  assert.equal(entryCount, 4);
});

test('a rule-provenance.json entry missing basis.decisionId fails schema validation (R-P2 analog)', async () => {
  const schema = await loadJson(RULE_PROVENANCE_SCHEMA_PATH);
  const doc = structuredClone(buildRuleProvenanceDocument());
  delete doc.entries[0].basis.decisionId;

  const errors = validate(schema, doc);
  assert.ok(errors.length > 0, 'a doc with a missing basis.decisionId must fail schema validation, not silently pass');
});

test('a rule-provenance.json entry with an unknown moduleId fails validateRuleProvenance\'s cross-record check', async () => {
  const schema = await loadJson(RULE_PROVENANCE_SCHEMA_PATH);
  const doc = structuredClone(buildRuleProvenanceDocument());
  doc.entries[0].moduleId = 'some_other_module';

  const { errors } = validateRuleProvenance(doc, 'cbc_suite_v1', schema);
  assert.ok(
    errors.some((e) => e.includes('does not match the document\'s top-level moduleId')),
    'a mismatched per-entry moduleId must be reported, not silently accepted',
  );
});

test('every rule-provenance entry\'s basis.decisionId resolves to a real modules/cbc_suite_v1/authoring-decisions.yaml decision_id', async () => {
  const decisionsDoc = parseYamlDocument(await readFile(AUTHORING_DECISIONS_PATH, 'utf8'));
  const realDecisionIds = new Set((decisionsDoc.decisions ?? []).map((d) => d.decision_id));

  for (const entry of RULE_PROVENANCE_ENTRIES) {
    assert.ok(
      realDecisionIds.has(entry.basis.decisionId),
      `${entry.ruleId}: basis.decisionId "${entry.basis.decisionId}" must name a real authoring-decisions.yaml record`,
    );
  }
});

test('every rule-provenance entry\'s ruleId resolves to a real staged rule (bijective join)', () => {
  const stagedRuleIds = new Set(STAGED_STRICT_RULES.map((r) => r.id));
  const provenanceRuleIds = new Set(RULE_PROVENANCE_ENTRIES.map((e) => e.ruleId));
  assert.deepEqual(provenanceRuleIds, stagedRuleIds);
});

test('writeStagedRulesAndProvenance() materializes rules.json + rule-provenance.json at the 02 §4.4 staged-pack path', async () => {
  // Does NOT rm() the shared STAGED_PACK_DIR (P3-T5's own test also writes into it, concurrently
  // in the same `npm test` run) — only adds/overwrites this task's own two files, non-destructively.
  const { rulesPath, ruleProvenancePath } = await writeStagedRulesAndProvenance();
  assert.equal(rulesPath, path.join(STAGED_PACK_DIR, 'rules.json'));
  assert.equal(ruleProvenancePath, path.join(STAGED_PACK_DIR, 'rule-provenance.json'));

  const writtenRules = await loadJson(rulesPath);
  assert.deepEqual(writtenRules, STAGED_STRICT_RULES);

  const writtenProvenance = await loadJson(ruleProvenancePath);
  assert.deepEqual(writtenProvenance, buildRuleProvenanceDocument());
});

test('writeStagedRulesAndProvenance() is deterministic — byte-identical across two runs against an isolated temp directory', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ef-rule-provenance-determinism-'));
  try {
    await writeStagedRulesAndProvenance({ outDir: tempDir });
    const beforeRules = await readFile(path.join(tempDir, 'rules.json'), 'utf8');
    const beforeProvenance = await readFile(path.join(tempDir, 'rule-provenance.json'), 'utf8');

    await writeStagedRulesAndProvenance({ outDir: tempDir });
    const afterRules = await readFile(path.join(tempDir, 'rules.json'), 'utf8');
    const afterProvenance = await readFile(path.join(tempDir, 'rule-provenance.json'), 'utf8');

    assert.equal(afterRules, beforeRules);
    assert.equal(afterProvenance, beforeProvenance);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
