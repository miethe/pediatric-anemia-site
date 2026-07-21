// tests/module-manifest-schema.test.mjs — EP5-T2 / DEF-5 (schemas/module-manifest.schema.json).
//
// Covers the deliverable's own definition of done: the real signed modules/anemia/module.json
// validates; the SPIKE-006 RQ4 `status` enum is closed (a pre-amendment "signed" value is
// rejected); D-4 is enforced at the schema layer (a populated `approvedBy` is rejected, mirroring
// tests/clinical-approvers-d4.test.mjs's schema-layer check for `clinicalApprovers`); the
// `clinicalContentHash` pattern is well-formed-only (`sha256:<64 hex>`); and the AC-WP5-RESIL
// distinction — `supersedes: null`/`approvedBy: []` legitimately empty vs. `clinicalContentHash`/
// `governanceHash`/`validationRunId` must-not-be-empty for a servable manifest — is enforced
// structurally via the schema's `allOf`/`if`/`then`/`else` conditionals, not left to prose.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'module-manifest.schema.json');
const MODULE_JSON_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'module.json');

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

async function loadSchemaAndManifest() {
  const schema = await readJson(SCHEMA_PATH);
  const manifest = await readJson(MODULE_JSON_PATH);
  return { schema, manifest };
}

test('the real, signed modules/anemia/module.json validates against module-manifest.schema.json', async () => {
  const { schema, manifest } = await loadSchemaAndManifest();
  const errors = validate(schema, manifest);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

test('a manifest with status "signed" (not in the SPIKE-006 RQ4 enum) is REJECTED', async () => {
  const { schema, manifest } = await loadSchemaAndManifest();
  const poisoned = { ...manifest, status: 'signed' };
  const errors = validate(schema, poisoned);
  assert.ok(errors.length > 0, 'a non-enum status must be rejected');
  assert.ok(
    errors.some((e) => e.path === '$.status'),
    `expected a $.status error, got: ${JSON.stringify(errors)}`,
  );
});

test('a manifest with a non-empty approvedBy is REJECTED (D-4 enforcement at the schema layer)', async () => {
  const { schema, manifest } = await loadSchemaAndManifest();
  const poisoned = { ...manifest, approvedBy: ['Dr. A. Clinician, MD'] };
  const errors = validate(schema, poisoned);
  assert.ok(errors.length > 0, 'a populated approvedBy must be rejected');
  assert.ok(
    errors.some((e) => e.path === '$.approvedBy'),
    `expected a $.approvedBy error, got: ${JSON.stringify(errors)}`,
  );
});

test('module-manifest.schema.json pins approvedBy to maxItems: 0, matching rule.schema.json\'s clinicalApprovers pattern', async () => {
  const { schema } = await loadSchemaAndManifest();
  assert.equal(schema.properties.approvedBy.maxItems, 0,
    'approvedBy must be maxItems: 0 — a populated approver list must be a hard schema violation, '
    + 'never merely a test failure. Raising this is the deliberate act by which this project would '
    + 'first claim clinical sign-off; it must never be done to make a build pass.');
});

test('a manifest with a malformed clinicalContentHash (wrong prefix) is REJECTED', async () => {
  const { schema, manifest } = await loadSchemaAndManifest();
  const poisoned = { ...manifest, clinicalContentHash: `sha1:${'a'.repeat(64)}` };
  const errors = validate(schema, poisoned);
  assert.ok(errors.length > 0, 'a "sha1:" prefix must be rejected');
});

test('a manifest with a malformed clinicalContentHash (wrong hex length) is REJECTED', async () => {
  const { schema, manifest } = await loadSchemaAndManifest();
  const poisoned = { ...manifest, clinicalContentHash: `sha256:${'a'.repeat(63)}` };
  const errors = validate(schema, poisoned);
  assert.ok(errors.length > 0, 'a 63-hex-char digest must be rejected (must be exactly 64)');
});

test('a manifest with a malformed governanceHash (wrong hex length) is REJECTED', async () => {
  const { schema, manifest } = await loadSchemaAndManifest();
  const poisoned = { ...manifest, governanceHash: `sha256:${'a'.repeat(65)}` };
  const errors = validate(schema, poisoned);
  assert.ok(errors.length > 0, 'a 65-hex-char digest must be rejected (must be exactly 64)');
});

test('supersedes: null and approvedBy: [] are ACCEPTED — the legitimately-empty first-release case (AC-WP5-RESIL)', async () => {
  const { schema, manifest } = await loadSchemaAndManifest();
  const legitimatelyEmpty = { ...manifest, supersedes: null, approvedBy: [] };
  const errors = validate(schema, legitimatelyEmpty);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

test('supersedes: <prior version string> is also ACCEPTED — non-null is legal, not just null', async () => {
  const { schema, manifest } = await loadSchemaAndManifest();
  const withPrior = { ...manifest, supersedes: '0.9.4-2026-11-01' };
  const errors = validate(schema, withPrior);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

test('an unsigned-stub manifest with null clinicalContentHash/governanceHash/validationRunId is ACCEPTED', async () => {
  const { schema } = await loadSchemaAndManifest();
  const stub = {
    id: 'anemia',
    title: 'Pediatric Anemia',
    schemaVersion: 1,
    status: 'unsigned-stub',
    knowledgeBaseVersion: '0.1.0-2026-07-15',
    evidenceReviewedThrough: '2026-07-15',
    engineLabel: 'Pediatric Anemia Deterministic CDSS',
    supportedAgeMonths: { min: 6, max: 216 },
    clinicalContentHash: null,
    governanceHash: null,
    approvedBy: [],
    validationRunId: null,
    supersedes: null,
    releasedAt: null,
  };
  const errors = validate(schema, stub);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

test('an integrity-recorded manifest missing validationRunId is REJECTED (must-not-be-empty case, AC-WP5-RESIL)', async () => {
  const { schema, manifest } = await loadSchemaAndManifest();
  assert.equal(manifest.status, 'integrity-recorded', 'fixture assumption: modules/anemia/module.json is integrity-recorded');
  const missingRunId = { ...manifest, validationRunId: null };
  const errors = validate(schema, missingRunId);
  assert.ok(errors.length > 0, 'a null validationRunId on an integrity-recorded manifest must be rejected');
  assert.ok(
    errors.some((e) => e.path === '$.validationRunId'),
    `expected a $.validationRunId error, got: ${JSON.stringify(errors)}`,
  );
});

test('a non-unsigned-stub manifest with a null clinicalContentHash is REJECTED (nullable ONLY when unsigned-stub)', async () => {
  const { schema, manifest } = await loadSchemaAndManifest();
  const poisoned = { ...manifest, clinicalContentHash: null };
  const errors = validate(schema, poisoned);
  assert.ok(errors.length > 0, 'clinicalContentHash must not be nullable once status has moved past unsigned-stub');
});

test('a non-unsigned-stub manifest with a null governanceHash is REJECTED (nullable ONLY when unsigned-stub)', async () => {
  const { schema, manifest } = await loadSchemaAndManifest();
  const poisoned = { ...manifest, governanceHash: null };
  const errors = validate(schema, poisoned);
  assert.ok(errors.length > 0, 'governanceHash must not be nullable once status has moved past unsigned-stub');
});
