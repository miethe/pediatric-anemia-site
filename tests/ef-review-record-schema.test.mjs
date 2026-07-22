// tests/ef-review-record-schema.test.mjs — Evidence Foundry E1 P1-T2 (schemas/review-record.schema.json).
//
// Covers P1-T2's own acceptance criteria (docs/project_plans/implementation_plans/infrastructure/
// evidence-foundry-e1-v1/phase-1-contracts-gates.md): the canonical ADR-0004 five-role model
// (contracts-design.md §(a)/§(b), P1-T1) replaces the wave0 5-state contract at this exact file
// path. Five role fixtures (one per role) under tests/fixtures/ef-review-records/ each validate;
// a fixture missing any required field is rejected (R-P2); a `synthetic: false` fixture with a
// populated `signature` is rejected; a `synthetic: true` fixture with a non-`TESTKEY-` `keyId` is
// rejected; the `const`/pattern mechanisms this schema uses in furtherance of D-4 (the signature
// object's forced-null-unless-synthetic shape, and the `role`/`review_id` cross-check) are
// verified directly. The wave0 EP7-T1 `reviewerType`/`attestedHuman` embedded consts are DELIBERATELY
// ABSENT from this schema — contracts-design.md §a.1/§a.3 item 5c rules that D-4 is preserved as a
// three-layer system guarantee (roster schema P1-T4 + downstream synthetic-rejection P2-T4 +
// validator cross-check P1-T7) once the record no longer embeds a reviewer-identity object; this
// file does not attempt to re-impose those two fields on the reshaped schema.
//
// Structural validity proven here never implies clinical validity, safety, or that a named human
// clinician reviewed anything — see the schema's own top-level description for that standing caveat.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');
const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-review-records');

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

async function loadSchema() {
  return readJson(SCHEMA_PATH);
}

async function loadFixtures() {
  const entries = (await readdir(FIXTURES_DIR)).filter((f) => f.endsWith('.json')).sort();
  const fixtures = {};
  for (const entry of entries) {
    fixtures[entry] = await readJson(path.join(FIXTURES_DIR, entry));
  }
  return fixtures;
}

const EXPECTED_ROLES = ['clinical-1', 'clinical-2', 'lab', 'adjudication', 'release-auth'];

// --- one committed fixture per role, all valid --------------------------------------------------

test('exactly five role fixtures are committed under tests/fixtures/ef-review-records/, one per ADR-0004 role', async () => {
  const fixtures = await loadFixtures();
  const roles = Object.values(fixtures).map((f) => f.role).sort();
  assert.deepEqual(roles, [...EXPECTED_ROLES].sort());
});

test('every committed role fixture validates against the canonical schema with zero errors', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  for (const [name, fixture] of Object.entries(fixtures)) {
    const errors = validate(schema, fixture);
    assert.deepEqual(errors, [], `${name} failed validation: ${JSON.stringify(errors)}`);
  }
});

test('each role fixture\'s review_id suffix agrees with its role property', async () => {
  const fixtures = await loadFixtures();
  for (const [name, fixture] of Object.entries(fixtures)) {
    assert.ok(
      fixture.review_id.endsWith(`-${fixture.role}`),
      `${name}: review_id "${fixture.review_id}" must end with role "${fixture.role}"`,
    );
  }
});

// --- required-field rejection (R-P2) --------------------------------------------------------------

test('a fixture missing any required field is REJECTED', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0001-clinical-1.json'];
  for (const key of Object.keys(base)) {
    const copy = { ...base };
    delete copy[key];
    const errors = validate(schema, copy);
    assert.ok(errors.length > 0, `removing required field "${key}" must be rejected`);
  }
});

// --- signature forced-empty-unless-synthetic (D-4 adjacent mechanism) ----------------------------

test('a synthetic: false fixture with a populated signature is REJECTED', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0001-clinical-1.json'];
  const copy = { ...base, synthetic: false };
  // signature stays populated (copied from base) — this is the violation under test.
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'synthetic:false with a populated signature must be rejected');
});

test('a synthetic: false fixture with signature: null validates (real records ship a null signature pre-G1/G2)', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0001-clinical-1.json'];
  const copy = { ...base, synthetic: false, signature: null };
  const errors = validate(schema, copy);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

test('a synthetic: true fixture with a non-TESTKEY- keyId is REJECTED', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0001-clinical-1.json'];
  const copy = {
    ...base,
    signature: { ...base.signature, keyId: 'REALKEY-prod-signing-01' },
  };
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'a synthetic:true record with a non-TESTKEY- keyId must be rejected');
  assert.ok(errors.some((e) => e.path.includes('signature')), `expected a signature error, got: ${JSON.stringify(errors)}`);
});

test('a synthetic: true fixture with signature: null is REJECTED (dry-run records still carry a TESTKEY- signature)', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0001-clinical-1.json'];
  const copy = { ...base, signature: null };
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'a synthetic:true record with a null signature must be rejected');
});

test('the signature object rejects an algorithm other than "ed25519"', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0001-clinical-1.json'];
  const copy = { ...base, signature: { ...base.signature, algorithm: 'rsa-sha256' } };
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'signature.algorithm must be pinned to the single legal value "ed25519"');
});

// --- role / review_id cross-check (five-branch allOf) ---------------------------------------------

test('a review_id suffix that does not match the role property is REJECTED', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0001-clinical-1.json'];
  const copy = { ...base, review_id: 'rr-0001-lab' }; // role stays "clinical-1"
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'a review_id/role mismatch must be rejected');
});

test('role must be one of the exact five ADR-0004 values — no other value is accepted', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0001-clinical-1.json'];
  for (const poison of ['primary-reviewer', 'arc-council', 'automated', 'model-self-review', 'clinical-3']) {
    const copy = { ...base, role: poison };
    const errors = validate(schema, copy);
    assert.ok(errors.length > 0, `role "${poison}" must be rejected`);
  }
});

// --- decision enum narrowing (contracts-design.md §a.3 item 5e) -----------------------------------

test('decision rejects the dropped wave0 values "pending" and "abstain"', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0001-clinical-1.json'];
  for (const dropped of ['pending', 'abstain']) {
    const copy = { ...base, decision: dropped };
    const errors = validate(schema, copy);
    assert.ok(errors.length > 0, `decision "${dropped}" must be rejected (dropped from the canonical enum)`);
  }
});

// --- nullable-but-required-key fields --------------------------------------------------------------

test('previousRecordHash, supersedes, and signature are required KEYS but legitimately nullable', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0002-clinical-2.json'];
  // previousRecordHash: null is legitimate only for the very first module record; schema itself
  // cannot know sequencing (needs the prior file's bytes, per contracts-design.md §a.2), so it
  // must accept null structurally regardless of position.
  const copy = { ...base, previousRecordHash: null, supersedes: null };
  const errors = validate(schema, copy);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

test('omitting the previousRecordHash key entirely is REJECTED even though null is a legal value', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0001-clinical-1.json'];
  const copy = { ...base };
  delete copy.previousRecordHash;
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'previousRecordHash must be a required key even though its value may be null');
});

// --- additionalProperties: false --------------------------------------------------------------------

test('an unknown top-level property is REJECTED', async () => {
  const schema = await loadSchema();
  const fixtures = await loadFixtures();
  const base = fixtures['rr-0001-clinical-1.json'];
  const copy = { ...base, reviewerType: 'human', attestedHuman: true };
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'wave0 fields reviewerType/attestedHuman must not be re-admitted at the top level');
});

// --- wave0 fields structurally absent from the canonical schema (R5 unification sanity) -----------

test('the canonical schema has no reviewers[], changeProposal, workflowState, conflictResolution, approvedBy, or history property (R5: reshape, not rename)', async () => {
  const schema = await loadSchema();
  const wave0Fields = ['reviewers', 'changeProposal', 'workflowState', 'conflictResolution', 'approvedBy', 'history', 'createdAt', 'updatedAt'];
  for (const field of wave0Fields) {
    assert.ok(!Object.hasOwn(schema.properties ?? {}, field), `wave0 field "${field}" must not exist on the canonical schema`);
  }
});

test('the canonical schema does not embed reviewerType/attestedHuman consts anywhere (guarantee re-homed off this schema, contracts-design.md §a.3 item 5c)', async () => {
  const schema = await loadSchema();
  const serialized = JSON.stringify(schema);
  assert.ok(!serialized.includes('reviewerType'), 'reviewerType must not appear anywhere in the canonical schema');
  assert.ok(!serialized.includes('"attestedHuman"'), 'attestedHuman must not appear anywhere in the canonical schema');
});

// --- module-manifest.schema.json / rule.schema.json byte-compatible approver arrays untouched -----

test('module-manifest.schema.json approvedBy[] and rule.schema.json clinicalApprovers[] stay maxItems: 0 (unmodified by this task)', async () => {
  const manifestSchema = await readJson(path.join(REPO_ROOT, 'schemas', 'module-manifest.schema.json'));
  const ruleSchema = await readJson(path.join(REPO_ROOT, 'schemas', 'rule.schema.json'));
  assert.equal(manifestSchema.properties.approvedBy.maxItems, 0);
  assert.equal(ruleSchema.properties.clinicalApprovers.maxItems, 0);
});
