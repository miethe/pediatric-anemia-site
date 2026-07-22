// tests/authoring-decisions-schema.test.mjs — P3-T4 (evidence-foundry-buildout Phase 3, FR-13/
// FR-14, `02 §4.11`/`02 §4.12`).
//
// modules/<moduleId>/authoring-decisions.yaml is a NEW, existence-gated artifact type
// (schemas/authoring-decisions.schema.json, wired into scripts/validate-kb.mjs). This test file
// follows the same three-layer proof pattern tests/evidence-assertions-schema.test.mjs (P3-T3)
// already established for schemas/evidence-assertions.schema.json:
//
//   1. A committed, intentionally-invalid fixture
//      (tests/fixtures/invalid-authoring-decisions/SYNTHETIC-INVALID-MISSING-REASONING-001.json.txt,
//      an otherwise schema-legal decision record with no `basis.reasoning` key at all) violates the
//      schema in exactly one way — R-P2 analog: the validator rejects the missing-field case, it
//      does not silently pass. This is this task's own binding acceptance criteria, verbatim.
//   2. validateModule(), run against a throwaway temp module directory seeded with that fixture
//      (parsed to the same shape parseYamlDocument() would produce) as its authoring-decisions
//      data, reports that specific schema error — the actual function `npm run validate`'s CLI
//      entrypoint calls per module.
//   3. The real, committed modules/cbc_suite_v1/authoring-decisions.yaml (4 decision records, one
//      per FR-16 slice rule) still validates cleanly, and a module directory with NO
//      authoring-decisions.yaml at all (modules/anemia/, which predates this artifact type)
//      validates just as cleanly — the existence-gate has no false positives in either direction.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { validateModule, validateAuthoringDecisions } from '../scripts/validate-kb.mjs';
import { parseYamlDocument } from '../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'authoring-decisions.schema.json');
// `.json.txt`, not `.json` — mirrors tests/fixtures/invalid-evidence-assertions/'s own naming
// rationale (tests/evidence-assertions-schema.test.mjs's header comment): a stray non-intake
// `.json` blob under tests/fixtures/ would risk being swept by an unrelated regeneration script.
const FIXTURE_PATH = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'invalid-authoring-decisions', 'SYNTHETIC-INVALID-MISSING-REASONING-001.json.txt',
);

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

test('seeded-bad authoring-decisions fixture violates authoring-decisions.schema.json in exactly one way (missing basis.reasoning)', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const badDoc = await loadJson(FIXTURE_PATH);

  assert.equal(badDoc.decisions.length, 1, 'fixture must carry exactly one seeded-bad decision record');
  assert.ok(
    !Object.hasOwn(badDoc.decisions[0].basis, 'reasoning'),
    'the seeded decision must be missing basis.reasoning entirely',
  );

  const errors = validate(schema, badDoc);
  assert.deepEqual(
    errors,
    [{ path: '$.decisions[0].basis.reasoning', message: 'required property is missing' }],
    `expected exactly one missing-required-property violation, got: ${JSON.stringify(errors)}`,
  );
});

test('all 4 committed modules/cbc_suite_v1/authoring-decisions.yaml records validate cleanly against authoring-decisions.schema.json', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const raw = await readFile(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml'), 'utf8');
  const doc = parseYamlDocument(raw);
  assert.equal(doc.decisions.length, 4);
  assert.deepEqual(validate(schema, doc), [], 'the committed document should validate with zero errors');
  for (const decision of doc.decisions) {
    assert.equal(decision.status, 'approved_for_rule_draft', `${decision.decision_id}: status must be approved_for_rule_draft in E0`);
    for (const role of ['evidence_methodologist', 'clinician_1', 'clinician_2', 'laboratory_medicine']) {
      assert.equal(decision.review[role], 'pending', `${decision.decision_id}: review.${role} must stay "pending" — no named clinical review occurs in E0`);
    }
    assert.ok(decision.basis.rf_claim_ids.length > 0, `${decision.decision_id}: must cite >=1 real rf claim id`);
    assert.ok(decision.basis.reasoning.length > 0, `${decision.decision_id}: must carry non-empty basis.reasoning`);
  }
});

test('validateModule() treats a missing authoring-decisions.yaml as legal (existence-gated) — modules/anemia has none', async () => {
  const result = await validateModule('anemia', REPO_ROOT);
  assert.deepEqual(result.errors, [], `validateModule('anemia', ...) should report zero errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.authoringDecisionsCount, 0, 'modules/anemia/ predates authoring-decisions.yaml; its absence is not an error');
});

test('validateModule() validates the real modules/cbc_suite_v1/authoring-decisions.yaml cleanly and reports its count', async () => {
  const result = await validateModule('cbc_suite_v1', REPO_ROOT);
  assert.deepEqual(result.errors, [], `validateModule('cbc_suite_v1', ...) should report zero errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.authoringDecisionsCount, 4);
});

test('validateModule() — the exact function npm run validate calls per module — fails closed on a seeded-bad authoring-decisions.yaml with a specific authoring-decisions.schema.json message', async () => {
  // Build a throwaway module tree outside modules/ (never touch the real, read-only
  // modules/anemia/ or modules/cbc_suite_v1/ trees), mirroring validateModule's expected on-disk
  // shape and reusing the real cbc_suite_v1 shape for everything except authoring-decisions.yaml.
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-seeded-bad-authoring-decisions-'));
  const moduleId = 'synthetic_seeded_bad_authoring_decisions';
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    for (const schemaFile of [
      'rule.schema.json', 'candidate.schema.json', 'evidence.schema.json', 'module-manifest.schema.json',
      'evidence-assertions.schema.json', 'authoring-decisions.schema.json',
    ]) {
      await cp(path.join(REPO_ROOT, 'schemas', schemaFile), path.join(tempRoot, 'schemas', schemaFile));
    }

    const moduleDir = path.join(tempRoot, 'modules', moduleId);
    await mkdir(moduleDir, { recursive: true });

    await writeFile(path.join(moduleDir, 'rules.json'), JSON.stringify([], null, 2));
    await writeFile(path.join(moduleDir, 'candidates.json'), JSON.stringify({}, null, 2));
    await writeFile(
      path.join(moduleDir, 'evidence.json'),
      JSON.stringify({ knowledgeBaseVersion: '0.0.0-test', reviewedThrough: '2026-07-21', sources: [] }, null, 2),
    );
    const manifest = await loadJson(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json'));
    await writeFile(path.join(moduleDir, 'module.json'), JSON.stringify({ ...manifest, id: moduleId }, null, 2));

    const badDoc = await loadJson(FIXTURE_PATH);
    // authoring-decisions.yaml is YAML on disk, but validateModule() parses it with the same
    // parseYamlDocument() this test imports above — writing the seeded-bad doc as YAML (via a
    // trivial round-trip through the same parser's inverse is unnecessary; a hand-written literal
    // YAML block is clearer and just as faithful to the real on-disk artifact type).
    const yamlBody = [
      `schemaVersion: "${badDoc.schemaVersion}"`,
      `moduleId: ${badDoc.moduleId}`,
      'rfProvenance:',
      `  rfRunId: ${badDoc.rfProvenance.rfRunId}`,
      `  rfBundleId: ${badDoc.rfProvenance.rfBundleId}`,
      `  fixturePath: ${badDoc.rfProvenance.fixturePath}`,
      'decisions:',
      `  - decision_id: ${badDoc.decisions[0].decision_id}`,
      `    module_id: ${badDoc.decisions[0].module_id}`,
      `    status: ${badDoc.decisions[0].status}`,
      '    basis:',
      `      kind: ${badDoc.decisions[0].basis.kind}`,
      `      rf_claim_ids: [${badDoc.decisions[0].basis.rf_claim_ids.join(', ')}]`,
      `      exact_assertion_ids: [${badDoc.decisions[0].basis.exact_assertion_ids.join(', ')}]`,
      '    conflicts:',
      `      visible: ${badDoc.decisions[0].conflicts.visible}`,
      `      representation: ${badDoc.decisions[0].conflicts.representation}`,
      '    clinical_effect:',
      `      intended_output: ${badDoc.decisions[0].clinical_effect.intended_output}`,
      `      prohibited_effects: [${badDoc.decisions[0].clinical_effect.prohibited_effects.join(', ')}]`,
      '    review:',
      `      evidence_methodologist: ${badDoc.decisions[0].review.evidence_methodologist}`,
      `      clinician_1: ${badDoc.decisions[0].review.clinician_1}`,
      `      clinician_2: ${badDoc.decisions[0].review.clinician_2}`,
      `      laboratory_medicine: ${badDoc.decisions[0].review.laboratory_medicine}`,
      '',
    ].join('\n');
    // Sanity-check the hand-written YAML actually round-trips to the same missing-reasoning shape
    // before relying on it below (fails loudly, in this test, if the literal above ever drifts).
    const reparsed = parseYamlDocument(yamlBody);
    assert.ok(!Object.hasOwn(reparsed.decisions[0].basis, 'reasoning'), 'hand-written YAML literal must still omit basis.reasoning');

    await writeFile(path.join(moduleDir, 'authoring-decisions.yaml'), yamlBody);

    const result = await validateModule(moduleId, tempRoot);

    assert.ok(result.errors.length > 0, 'validateModule must report errors on the seeded-bad authoring-decisions.yaml');
    assert.ok(
      result.errors.some(
        (e) => e.includes('authoring-decisions.schema.json')
          && e.includes('$.decisions[0].basis.reasoning')
          && e.includes('required property is missing'),
      ),
      `expected a specific authoring-decisions.schema.json missing-property error, got: ${JSON.stringify(result.errors, null, 2)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// --- validateAuthoringDecisions() cross-record invariants (pure-function unit tests, no disk) ---
// Mirrors tests/evidence-assertions-schema.test.mjs's own in-memory-tamper style for
// validateEvidenceAssertions: these invariants (decision_id uniqueness, per-decision module_id
// agreement with the document's own top-level moduleId) are cross-record checks the schema itself
// cannot express, so they are exercised directly.

function makeValidDecision(overrides = {}) {
  return {
    decision_id: 'dec_test_001',
    module_id: 'cbc_suite_v1',
    status: 'approved_for_rule_draft',
    basis: {
      kind: 'implementation_proposal',
      rf_claim_ids: ['clm_018'],
      exact_assertion_ids: ['evas_test_001'],
      reasoning: 'test reasoning',
    },
    conflicts: { visible: true, representation: 'abstain_below_supported_age' },
    clinical_effect: { intended_output: 'scope_exit_alert', prohibited_effects: ['interpret_result_below_supported_age'] },
    review: { evidence_methodologist: 'pending', clinician_1: 'pending', clinician_2: 'pending', laboratory_medicine: 'pending' },
    ...overrides,
  };
}

function makeValidDoc(decisions) {
  return {
    schemaVersion: '1.0',
    moduleId: 'cbc_suite_v1',
    rfProvenance: {
      rfRunId: 'rf_run_20260717_rf_cbc_001_pediatric_cds_establish',
      rfBundleId: 'bundle_20260718_intent_research_20260717_rf_cbc_001',
      fixturePath: 'tests/fixtures/rf-cbc-001/',
    },
    decisions,
  };
}

test('validateAuthoringDecisions() reports zero errors on a well-formed in-memory document', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const doc = makeValidDoc([makeValidDecision()]);
  const { errors, decisionCount } = validateAuthoringDecisions(doc, 'cbc_suite_v1', schema);
  assert.deepEqual(errors, []);
  assert.equal(decisionCount, 1);
});

test('validateAuthoringDecisions() flags a duplicate decision_id across the array (a cross-record invariant the schema cannot express)', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const doc = makeValidDoc([
    makeValidDecision(),
    makeValidDecision({ basis: { ...makeValidDecision().basis, rf_claim_ids: ['clm_027'] } }), // otherwise identical, including decision_id
  ]);

  const { errors } = validateAuthoringDecisions(doc, 'cbc_suite_v1', schema);
  assert.ok(
    errors.some((e) => e.includes('dec_test_001') && e.includes('duplicate decision_id')),
    `expected a duplicate-decision_id error, got: ${JSON.stringify(errors)}`,
  );
});

test('validateAuthoringDecisions() flags a decision module_id that disagrees with the document top-level moduleId', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const doc = makeValidDoc([makeValidDecision({ module_id: 'some_other_module' })]);

  const { errors } = validateAuthoringDecisions(doc, 'cbc_suite_v1', schema);
  assert.ok(
    errors.some((e) => e.includes('does not match the document\'s top-level moduleId')),
    `expected a module_id disagreement error, got: ${JSON.stringify(errors)}`,
  );
});
