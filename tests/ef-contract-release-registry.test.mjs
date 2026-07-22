// tests/ef-contract-release-registry.test.mjs — evidence-foundry-e1 P1-T5 (OQ-4/FR-14/FR-16).
//
// P1-T5 ships two schemas plus fixtures only (the registry seed file itself lands in P3-T4):
//
//   (a) schemas/release-manifest.schema.json is extended with the ADR-0005 `dryRun`/`signature`
//       pair — schema-forced empty (`signature: null`) on any real (non-dry-run) candidate;
//       populated only when `dryRun: true`, and then only with a `TESTKEY-`-prefixed `keyId`
//       (OQ-6). This mirrors schemas/module-manifest.schema.json's `approvedBy` `maxItems: 0`
//       idiom for an object-typed field.
//   (b) schemas/release-registry.schema.json is authored new, for the future `releases/registry.json`
//       — exactly the OQ-4 entry field list, `withdrawalState` pinned `const: "none"` in E1, and
//       `signature`/`signedAt`/`supersedes`/`withdrawnAt`/`withdrawalReason` pinned `type: "null"`.
//
// This file proves both schemas validate their positive fixtures under
// tests/fixtures/ef-release/, and that every seeded negative fixture in that same directory is
// rejected fail-closed with a specific, named error — never a silent pass, never a generic crash.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-release');
const MANIFEST_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-manifest.schema.json');
const REGISTRY_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-registry.schema.json');

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

function fixture(name) {
  return path.join(FIXTURE_DIR, name);
}

// --- (a) schemas/release-manifest.schema.json — dryRun/signature slot ---------------------------

test('schemas/release-manifest.schema.json is itself well-formed and self-describing (no unsupported keywords)', async () => {
  const schema = await loadJson(MANIFEST_SCHEMA_PATH);
  // json-schema-lite fails closed on any keyword it does not understand (see its own header
  // comment); validating a trivially-empty-shaped instance against it exercises every keyword the
  // schema itself uses without needing a full valid document.
  assert.doesNotThrow(() => validate(schema, {}));
});

test('positive: an unsigned E0-shaped manifest (no dryRun/signature keys at all) validates cleanly', async () => {
  const schema = await loadJson(MANIFEST_SCHEMA_PATH);
  const doc = await loadJson(fixture('release-manifest-unsigned-valid.json'));
  assert.ok(!Object.hasOwn(doc, 'dryRun') && !Object.hasOwn(doc, 'signature'), 'fixture must omit both new keys entirely');
  assert.deepEqual(validate(schema, doc), []);
});

test('positive: a dry-run candidate (dryRun: true, TESTKEY- signature) validates cleanly', async () => {
  const schema = await loadJson(MANIFEST_SCHEMA_PATH);
  const doc = await loadJson(fixture('release-manifest-dryrun-signed-valid.json'));
  assert.equal(doc.dryRun, true);
  assert.match(doc.signature.keyId, /^TESTKEY-/);
  assert.deepEqual(validate(schema, doc), []);
});

test('negative (FR-16 proof): a real-candidate manifest (no dryRun marker) with a populated signature is rejected', async () => {
  const schema = await loadJson(MANIFEST_SCHEMA_PATH);
  const doc = await loadJson(fixture('invalid-release-manifest-real-candidate-populated-signature-001.json.txt'));
  assert.ok(!Object.hasOwn(doc, 'dryRun'), 'fixture must carry no dryRun marker — this is the "real candidate" case');
  const errors = validate(schema, doc);
  assert.deepEqual(errors, [{ path: '$.signature', message: 'expected type null, got object' }]);
});

test('negative: a dry-run candidate whose signature.keyId lacks the TESTKEY- marker is rejected', async () => {
  const schema = await loadJson(MANIFEST_SCHEMA_PATH);
  const doc = await loadJson(fixture('invalid-release-manifest-dryrun-non-testkey-002.json.txt'));
  assert.equal(doc.dryRun, true);
  const errors = validate(schema, doc);
  assert.deepEqual(errors, [{ path: '$.signature.keyId', message: 'string does not match pattern ^TESTKEY-' }]);
});

test('negative (R-P2): a manifest missing a required field (testCorpusHash) is rejected', async () => {
  const schema = await loadJson(MANIFEST_SCHEMA_PATH);
  const doc = await loadJson(fixture('invalid-release-manifest-missing-testcorpushash-003.json.txt'));
  assert.ok(!Object.hasOwn(doc, 'testCorpusHash'));
  const errors = validate(schema, doc);
  assert.deepEqual(errors, [{ path: '$.testCorpusHash', message: 'required property is missing' }]);
});

test('signature stays legal-object-shaped ONLY when dryRun is explicitly true — dryRun: false routes to the null branch same as absent', async () => {
  const schema = await loadJson(MANIFEST_SCHEMA_PATH);
  const doc = await loadJson(fixture('release-manifest-unsigned-valid.json'));
  const withDryRunFalse = { ...doc, dryRun: false, signature: { algorithm: 'ed25519', keyId: 'TESTKEY-x', value: 'y' } };
  const errors = validate(schema, withDryRunFalse);
  assert.deepEqual(errors, [{ path: '$.signature', message: 'expected type null, got object' }]);
});

// --- (b) schemas/release-registry.schema.json — new, OQ-4 entry shape ---------------------------

test('schemas/release-registry.schema.json is itself well-formed and self-describing (no unsupported keywords)', async () => {
  const schema = await loadJson(REGISTRY_SCHEMA_PATH);
  assert.doesNotThrow(() => validate(schema, {}));
});

test('positive: the empty-entries registry document (P3-T4\'s own seed shape) validates cleanly', async () => {
  const schema = await loadJson(REGISTRY_SCHEMA_PATH);
  const doc = await loadJson(fixture('release-registry-empty-valid.json'));
  assert.deepEqual(doc, { schemaVersion: 1, entries: [] });
  assert.deepEqual(validate(schema, doc), []);
});

test('positive: a well-formed single-entry registry document validates cleanly', async () => {
  const schema = await loadJson(REGISTRY_SCHEMA_PATH);
  const doc = await loadJson(fixture('release-registry-with-entry-valid.json'));
  assert.equal(doc.entries.length, 1);
  assert.equal(doc.entries[0].withdrawalState, 'none');
  assert.equal(doc.entries[0].signature, null);
  assert.deepEqual(validate(schema, doc), []);
});

test('negative (AC-explicit): a registry entry with withdrawalState "withdrawn" is rejected in E1', async () => {
  // Isolates exactly the `withdrawalState` violation — `withdrawnAt`/`withdrawalReason` stay
  // `null` on this fixture (schema-legal on their own) so this test proves the `const: "none"`
  // gate is enforced independently, not conflated with the separate `withdrawnAt`/`withdrawalReason`
  // null-forcing this same schema also happens to apply.
  const schema = await loadJson(REGISTRY_SCHEMA_PATH);
  const doc = await loadJson(fixture('invalid-release-registry-withdrawn-entry-001.json.txt'));
  assert.equal(doc.entries[0].withdrawalState, 'withdrawn');
  assert.equal(doc.entries[0].withdrawnAt, null);
  assert.equal(doc.entries[0].withdrawalReason, null);
  const errors = validate(schema, doc);
  assert.deepEqual(errors, [{ path: '$.entries[0].withdrawalState', message: 'value "withdrawn" must equal const "none"' }]);
});

test('negative (R-P2): a registry entry missing a required field (manifestDigest) is rejected', async () => {
  const schema = await loadJson(REGISTRY_SCHEMA_PATH);
  const doc = await loadJson(fixture('invalid-release-registry-missing-manifestdigest-002.json.txt'));
  assert.ok(!Object.hasOwn(doc.entries[0], 'manifestDigest'));
  const errors = validate(schema, doc);
  assert.deepEqual(errors, [{ path: '$.entries[0].manifestDigest', message: 'required property is missing' }]);
});

test('negative: a registry entry carrying a field outside the OQ-4 list is rejected (no surveillance/cadence fields)', async () => {
  const schema = await loadJson(REGISTRY_SCHEMA_PATH);
  const doc = await loadJson(fixture('invalid-release-registry-extra-field-003.json.txt'));
  assert.ok(Object.hasOwn(doc.entries[0], 'reverifyCadenceDays'));
  const errors = validate(schema, doc);
  assert.deepEqual(errors, [{ path: '$.entries[0].reverifyCadenceDays', message: 'additional property is not permitted' }]);
});

test('negative: a registry entry with a populated signature is rejected (pre-G2, always null in E1)', async () => {
  const schema = await loadJson(REGISTRY_SCHEMA_PATH);
  const doc = await loadJson(fixture('invalid-release-registry-populated-signature-004.json.txt'));
  assert.equal(typeof doc.entries[0].signature, 'object');
  assert.notEqual(doc.entries[0].signature, null);
  const errors = validate(schema, doc);
  assert.deepEqual(errors, [{ path: '$.entries[0].signature', message: 'expected type null, got object' }]);
});

// --- no ceiling raised anywhere else in the tree --------------------------------------------------

test('no other schema in the repo declares a non-null-forced release-registry-shaped signature field', async () => {
  // Cheap regression guard: this test file, and the two schemas it targets, are the only place
  // release-registry semantics should exist pre-P3-T4. A second, independently-invented registry
  // schema would be exactly the R5-class risk this plan's contracts-design note (P1-T1) exists to
  // prevent for the review-record model — guard the same failure mode here for the registry.
  const { readdir } = await import('node:fs/promises');
  const schemaFiles = await readdir(path.join(REPO_ROOT, 'schemas'));
  const registrySchemas = schemaFiles.filter((f) => f.includes('registry') && f.endsWith('.schema.json'));
  assert.deepEqual(registrySchemas, ['release-registry.schema.json']);
});
