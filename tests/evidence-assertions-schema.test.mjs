// tests/evidence-assertions-schema.test.mjs — P3-T3 (evidence-foundry-buildout Phase 3, FR-12
// second half, `02 §4.10`, OQ-3/OQ-7).
//
// modules/<moduleId>/evidence-assertions.json is a NEW, existence-gated artifact type
// (schemas/evidence-assertions.schema.json, wired into scripts/validate-kb.mjs). This test file
// follows the same three-layer proof pattern tests/rule-schema-seeded-invalid.test.mjs already
// established for schemas/rule.schema.json:
//
//   1. A committed, intentionally-invalid fixture
//      (tests/fixtures/invalid-evidence-assertions/SYNTHETIC-INVALID-MISSING-SHA256-001.json.txt,
//      an otherwise schema-legal assertion with `exactPassage: null` and no `exactPassageSha256`
//      key at all) violates the schema in exactly one way — R-P2 analog: the validator rejects
//      the missing-field case, it does not silently pass.
//   2. validateModule(), run against a throwaway temp module directory seeded with that fixture as
//      its evidence-assertions.json, reports that specific schema error — the actual function
//      `npm run validate`'s CLI entrypoint calls per module.
//   3. The real, committed modules/cbc_suite_v1/evidence-assertions.json (19 assertions, one per
//      slice-rule-supporting claim) still validates cleanly. modules/anemia/ used to predate this
//      artifact type entirely (proving the existence-gate had no false positive on total absence);
//      multi-bundle-conversion-e1 P4-T2 (FR-6/OQ-1) additively backfilled
//      modules/anemia/evidence-assertions.json (35 assertions, one per RF-EV-001 "supported"-status
//      claim) WITHOUT touching modules/anemia/evidence.json or rules.json — OQ-1 resolves the two
//      files as permanently separate, parallel provenance views of the same upstream bundle,
//      neither superseding the other. This file's existence-gate-on-total-absence proof now rests
//      on cbc_suite_v1 (file present) above; the test below instead proves anemia's own backfilled
//      file validates cleanly and reports the expected count.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { validateModule, validateEvidenceAssertions } from '../scripts/validate-kb.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'evidence-assertions.schema.json');
// `.json.txt`, not `.json` — mirrors tests/fixtures/invalid-rule/'s own naming rationale
// (tests/rule-schema-seeded-invalid.test.mjs's header comment): scripts/evidence/
// backfill-rule-governance.mjs sweeps every `*.json` under tests/fixtures/ when regenerating
// rules' witnessFixtures coverage, and a stray non-intake `.json` blob there would silently drift
// the committed modules/anemia/rules.json.
const FIXTURE_PATH = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'invalid-evidence-assertions', 'SYNTHETIC-INVALID-MISSING-SHA256-001.json.txt',
);

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

test('seeded-bad evidence-assertions fixture violates evidence-assertions.schema.json in exactly one way (missing exactPassageSha256 when exactPassage is null)', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const badDoc = await loadJson(FIXTURE_PATH);

  assert.equal(badDoc.assertions.length, 1, 'fixture must carry exactly one seeded-bad assertion');
  assert.equal(badDoc.assertions[0].exactPassage, null, 'the seeded assertion must have exactPassage: null');
  assert.ok(
    !Object.hasOwn(badDoc.assertions[0], 'exactPassageSha256'),
    'the seeded assertion must be missing exactPassageSha256 entirely',
  );

  const errors = validate(schema, badDoc);
  assert.deepEqual(
    errors,
    [{ path: '$.assertions[0].exactPassageSha256', message: 'required property is missing' }],
    `expected exactly one missing-required-property violation, got: ${JSON.stringify(errors)}`,
  );
});

test('all 19 committed modules/cbc_suite_v1/evidence-assertions.json records validate cleanly against evidence-assertions.schema.json', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const doc = await loadJson(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'evidence-assertions.json'));
  assert.equal(doc.assertions.length, 19);
  assert.deepEqual(validate(schema, doc), [], 'the committed document should validate with zero errors');
  for (const assertion of doc.assertions) {
    assert.equal(assertion.exactPassage, null, `${assertion.assertionId}: OQ-2 rights-restricted fallback means exactPassage must be null for every RF-CBC-001 passage`);
    assert.match(assertion.exactPassageSha256, /^sha256:[0-9a-f]{64}$/, `${assertion.assertionId}: must carry an immutable passage hash`);
    assert.equal(assertion.passageId, `psg_${assertion.exactPassageSha256.replace('sha256:', '')}`, `${assertion.assertionId}: passageId must be minted from exactPassageSha256`);
  }
});

test('all 35 committed modules/anemia/evidence-assertions.json records validate cleanly against evidence-assertions.schema.json (P4-T2 backfill, RF-EV-001)', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const doc = await loadJson(path.join(REPO_ROOT, 'modules', 'anemia', 'evidence-assertions.json'));
  assert.equal(doc.moduleId, 'anemia');
  assert.equal(doc.rfProvenance.rfRunId, 'rf_run_20260717_rf_ev_001_pediatric_cds_backfill');
  assert.equal(doc.assertions.length, 35, 'one assertion per RF-EV-001 "supported"-status claim (35/48; the rest are inference/speculation, per FR-13\'s routing table)');
  assert.deepEqual(validate(schema, doc), [], 'the committed document should validate with zero errors');
  for (const assertion of doc.assertions) {
    assert.equal(assertion.claimStatus, 'supported', `${assertion.assertionId}: every P4-T2 anemia assertion binds a "supported"-status RF-EV-001 claim`);
    assert.equal(assertion.exactPassage, null, `${assertion.assertionId}: OQ-2 rights-restricted fallback means exactPassage must be null for every RF-EV-001 passage`);
    assert.match(assertion.exactPassageSha256, /^sha256:[0-9a-f]{64}$/, `${assertion.assertionId}: must carry an immutable passage hash`);
    assert.equal(assertion.passageId, `psg_${assertion.exactPassageSha256.replace('sha256:', '')}`, `${assertion.assertionId}: passageId must be minted from exactPassageSha256`);
    assert.equal(assertion.rfRunId, doc.rfProvenance.rfRunId, `${assertion.assertionId}: per-assertion rfRunId must agree with the document's rfProvenance.rfRunId`);
  }
});

test('every authoring-decisions.yaml exact_assertion_ids reference resolves to a real assertion in evidence-assertions.json', async () => {
  // Cross-file resolution proof for P3-T1 <-> P3-T3's join. Parsed with the repo's own
  // dependency-free YAML-lite loader (tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs) rather than
  // adding a YAML dependency just for this test.
  const { parseYamlDocument } = await import('../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs');
  const decisionsRaw = await readFile(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml'), 'utf8');
  const decisions = parseYamlDocument(decisionsRaw);
  const assertionsDoc = await loadJson(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'evidence-assertions.json'));
  const assertionIds = new Set(assertionsDoc.assertions.map((a) => a.assertionId));

  const referenced = decisions.decisions.flatMap((d) => d.basis.exact_assertion_ids ?? []);
  assert.ok(referenced.length > 0, 'expected at least one exact_assertion_ids reference across the 4 decision records');
  for (const assertionId of referenced) {
    assert.ok(assertionIds.has(assertionId), `authoring-decisions.yaml references assertionId "${assertionId}" with no matching evidence-assertions.json record`);
  }
});

test('validateModule() validates the real, P4-T2-backfilled modules/anemia/evidence-assertions.json cleanly and reports its count', async () => {
  const result = await validateModule('anemia', REPO_ROOT);
  assert.deepEqual(result.errors, [], `validateModule('anemia', ...) should report zero errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.evidenceAssertionsCount, 35, 'modules/anemia/evidence-assertions.json carries 35 assertions, one per RF-EV-001 "supported"-status claim (P4-T2, multi-bundle-conversion-e1)');
});

test('validateModule() validates the real modules/cbc_suite_v1/evidence-assertions.json cleanly and reports its count', async () => {
  const result = await validateModule('cbc_suite_v1', REPO_ROOT);
  assert.deepEqual(result.errors, [], `validateModule('cbc_suite_v1', ...) should report zero errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.evidenceAssertionsCount, 19);
});

test('validateModule() — the exact function npm run validate calls per module — fails closed on a seeded-bad evidence-assertions.json with a specific evidence-assertions.schema.json message', async () => {
  // Build a throwaway module tree outside modules/ (never touch the real, read-only
  // modules/anemia/ or modules/cbc_suite_v1/ trees), mirroring validateModule's expected on-disk
  // shape and reusing the real cbc_suite_v1 shape for everything except evidence-assertions.json.
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-seeded-bad-evidence-assertions-'));
  const moduleId = 'synthetic_seeded_bad_evidence_assertions';
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    for (const schemaFile of [
      'rule.schema.json', 'candidate.schema.json', 'evidence.schema.json', 'module-manifest.schema.json',
      'evidence-assertions.schema.json',
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
    await writeFile(path.join(moduleDir, 'evidence-assertions.json'), JSON.stringify(badDoc, null, 2));

    const result = await validateModule(moduleId, tempRoot);

    assert.ok(result.errors.length > 0, 'validateModule must report errors on the seeded-bad evidence-assertions.json');
    assert.ok(
      result.errors.some(
        (e) => e.includes('evidence-assertions.schema.json')
          && e.includes('$.assertions[0].exactPassageSha256')
          && e.includes('required property is missing'),
      ),
      `expected a specific evidence-assertions.schema.json missing-property error, got: ${JSON.stringify(result.errors, null, 2)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// --- validateEvidenceAssertions() cross-record invariants (pure-function unit tests, no disk) ---
// Mirrors tests/candidate-governance.test.mjs's own in-memory-tamper style for
// validateEvidenceDocument/validateCandidates: these invariants (assertionId uniqueness,
// passageId<->exactPassageSha256 agreement, per-assertion rfRunId agreement with the document)
// are cross-record checks the schema itself cannot express, so they are exercised directly.

const VALID_DOC = {
  schemaVersion: '1.0',
  moduleId: 'cbc_suite_v1',
  rfProvenance: {
    rfRunId: 'rf_run_20260717_rf_cbc_001_pediatric_cds_establish',
    rfBundleId: 'bundle_20260718_intent_research_20260717_rf_cbc_001',
    fixturePath: 'tests/fixtures/rf-cbc-001/',
  },
  assertions: [
    {
      assertionId: 'evas_test_001',
      rfRunId: 'rf_run_20260717_rf_cbc_001_pediatric_cds_establish',
      rfSourceCardId: 'src_20260718_rfcbc001_01',
      sourceId: 'TEST_SOURCE',
      rfEvidenceId: 'ev_001',
      rfClaimId: 'clm_001',
      passageId: 'psg_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      locator: { raw: 'Abstract', page: null, section: 'Abstract', table: null, paragraph: null },
      exactPassage: null,
      exactPassageSha256: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      displayPolicy: 'hash_and_selector_only',
      claimStatus: 'supported',
      applicability: { ageRange: null, sex: null },
      laboratory: { analyzer: null, assayMethod: null },
      reviewBy: '2027-07-21',
    },
  ],
};

function cloneValidDoc() {
  return JSON.parse(JSON.stringify(VALID_DOC));
}

test('validateEvidenceAssertions() reports zero errors on a well-formed in-memory document', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const { errors, assertionCount } = validateEvidenceAssertions(cloneValidDoc(), 'cbc_suite_v1', schema);
  assert.deepEqual(errors, []);
  assert.equal(assertionCount, 1);
});

test('validateEvidenceAssertions() flags a duplicate assertionId across the array (a cross-record invariant the schema cannot express)', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const doc = cloneValidDoc();
  const second = JSON.parse(JSON.stringify(doc.assertions[0]));
  second.rfClaimId = 'clm_002'; // otherwise identical, including assertionId — isolates the defect
  doc.assertions.push(second);

  const { errors } = validateEvidenceAssertions(doc, 'cbc_suite_v1', schema);
  assert.ok(
    errors.some((e) => e.includes('evas_test_001') && e.includes('duplicate assertionId')),
    `expected a duplicate-assertionId error, got: ${JSON.stringify(errors)}`,
  );
});

test('validateEvidenceAssertions() flags a passageId that was not minted from exactPassageSha256', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const doc = cloneValidDoc();
  doc.assertions[0].passageId = 'psg_ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

  const { errors } = validateEvidenceAssertions(doc, 'cbc_suite_v1', schema);
  assert.ok(
    errors.some((e) => e.includes('is not minted from exactPassageSha256')),
    `expected a passageId/exactPassageSha256 mismatch error, got: ${JSON.stringify(errors)}`,
  );
});

test('validateEvidenceAssertions() flags an assertion rfRunId that disagrees with the document rfProvenance.rfRunId', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const doc = cloneValidDoc();
  doc.assertions[0].rfRunId = 'rf_run_some_other_run';

  const { errors } = validateEvidenceAssertions(doc, 'cbc_suite_v1', schema);
  assert.ok(
    errors.some((e) => e.includes('does not match the document\'s rfProvenance.rfRunId')),
    `expected an rfRunId disagreement error, got: ${JSON.stringify(errors)}`,
  );
});
