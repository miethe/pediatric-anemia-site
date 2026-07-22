// tests/reviewer-roster-schema.test.mjs — P1-T4 (Evidence Foundry E1 Phase 1, PRD OQ-1/FR-3).
//
// schemas/reviewer-roster.schema.json validates governance/reviewer-roster.yaml: the ONE place a
// review-record file's `reviewerId` (schemas/review-record.schema.json) can resolve to a named
// human identity plus credential/module-scope facts. This file is a standalone paper contract at
// this phase — it is NOT wired into scripts/validate-kb.mjs (that cross-file validator wiring, and
// the roster's actual use, land in P1-T7/P2-T2) — so this test file exercises the schema directly
// against parsed YAML/JSON, following the same inline-copy pattern tests/ef-review-record-schema.test.mjs
// uses for schemas/review-record.schema.json, rather than the validateModule()-against-a-temp-directory
// pattern used for KB-wired schemas.
//
// Three things this task's own binding acceptance criteria require proving:
//   1. [Updated by P2-T8, Evidence Foundry E1 Phase 2] The shipped governance/reviewer-roster.yaml
//      ships with ZERO `synthetic: false` (real) entries and validates cleanly — FR-3's "the roster
//      itself ships empty of REAL entries ... until G1" requirement, non-vacuously. P1-T4 shipped it
//      literally empty; P2-T8 (the five-role synthetic dry-run, FR-11) added the roster's first
//      content — exactly five `synthetic: true`, clearly-labeled, non-credentialed personas scoped
//      to `cbc_suite_v1` — which is exactly the "or synthetic-only" branch FR-3's own wording always
//      allowed. See governance/reviewer-roster.yaml's own header for the full P2-T8 note.
//   2. A representative hand-authored example (schemas/examples/reviewer-roster.example.json,
//      never itself committed as the live roster) round-trips through both legal entry shapes:
//      a synthetic dry-run persona and a real (`synthetic: false`) entry with `verificationRef`.
//   3. The two structural guardrails at the entry level are actually enforced, not merely
//      documented: `synthetic: false` without `verificationRef` is REJECTED (real entries must be
//      G1-verified), and `synthetic: true` WITH `verificationRef` is REJECTED (a synthetic persona
//      can never be dressed up as though it underwent G1's out-of-band human verification).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { parseYamlDocument } from '../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'reviewer-roster.schema.json');
const ROSTER_PATH = path.join(REPO_ROOT, 'governance', 'reviewer-roster.yaml');
const EXAMPLE_PATH = path.join(REPO_ROOT, 'schemas', 'examples', 'reviewer-roster.example.json');

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

async function loadSchema() {
  return loadJson(SCHEMA_PATH);
}

function baseEntry(overrides = {}) {
  return {
    reviewerId: 'synth-clinical-1',
    name: 'Synthetic Dry-Run Clinician 1',
    credentialRef: 'SYNTHETIC-NO-CREDENTIAL',
    moduleScopes: ['cbc_suite_v1'],
    synthetic: true,
    ...overrides,
  };
}

// --- FR-3 non-vacuity: the shipped roster carries zero REAL entries and actually validates -----

test('the shipped governance/reviewer-roster.yaml carries ZERO synthetic:false (real) reviewers and parses via the shared YAML-lite parser', async () => {
  const raw = await readFile(ROSTER_PATH, 'utf8');
  const doc = parseYamlDocument(raw);
  assert.equal(doc.schemaVersion, 1);
  assert.ok(Array.isArray(doc.reviewers), 'reviewers must be an array');
  assert.ok(
    doc.reviewers.every((entry) => entry.synthetic === true),
    'FR-3: every shipped entry must be synthetic:true — zero real entries pre-G1',
  );
});

test('the shipped roster carries exactly the P2-T8 five-role synthetic dry-run persona set, scoped to cbc_suite_v1', async () => {
  const raw = await readFile(ROSTER_PATH, 'utf8');
  const doc = parseYamlDocument(raw);
  assert.equal(doc.reviewers.length, 5, 'expected exactly the 5 P2-T8 dry-run personas');
  const reviewerIds = doc.reviewers.map((entry) => entry.reviewerId).sort();
  assert.deepEqual(reviewerIds, [
    'dryrun-cbc-suite-adjudication',
    'dryrun-cbc-suite-clinical-1',
    'dryrun-cbc-suite-clinical-2',
    'dryrun-cbc-suite-lab',
    'dryrun-cbc-suite-release-auth',
  ]);
  for (const entry of doc.reviewers) {
    assert.deepEqual(entry.moduleScopes, ['cbc_suite_v1']);
    assert.match(entry.name, /SYNTHETIC/, `entry "${entry.reviewerId}" name must self-identify as synthetic`);
    assert.match(entry.name, /NOT A CREDENTIALED REVIEWER/, `entry "${entry.reviewerId}" name must self-identify as non-credentialed`);
    assert.equal('verificationRef' in entry, false, 'a synthetic entry must never carry verificationRef');
  }
});

test('the shipped roster validates against reviewer-roster.schema.json with zero errors', async () => {
  const schema = await loadSchema();
  const raw = await readFile(ROSTER_PATH, 'utf8');
  const doc = parseYamlDocument(raw);
  assert.deepEqual(validate(schema, doc), [], 'the committed roster must validate cleanly');
});

test('the shipped roster file header documents gate G1 and the synthetic-can-never-authorize-release invariant', async () => {
  const raw = await readFile(ROSTER_PATH, 'utf8');
  assert.match(raw, /\bG1\b/, 'header must name gate G1');
  assert.match(raw, /SYNTHETIC ENTRIES CAN NEVER SATISFY RELEASE-AUTHORIZATION/i,
    'header must state synthetic entries can never satisfy release-authorization');
  assert.match(raw, /ZERO `synthetic: false` \(REAL\) ENTRIES/i,
    'header must state the roster ships with zero real entries');
});

// --- example fixture round-trips through both legal entry shapes -------------------------------

test('the hand-authored example roster (one synthetic, one real+verified entry) validates cleanly', async () => {
  const schema = await loadSchema();
  const example = await loadJson(EXAMPLE_PATH);
  assert.equal(example.reviewers.length, 2);
  assert.deepEqual(validate(schema, example), [], JSON.stringify(validate(schema, example)));
});

test('the example fixture is never itself the shipped roster (documents intent only)', async () => {
  const raw = await readFile(EXAMPLE_PATH, 'utf8');
  assert.match(raw, /never shipped/i);
});

// --- structural guardrail: real entries (synthetic: false) MUST carry verificationRef ----------

test('a synthetic:false entry missing verificationRef is REJECTED', async () => {
  const schema = await loadSchema();
  const roster = { schemaVersion: 1, reviewers: [baseEntry({ reviewerId: 'real-1', synthetic: false })] };
  const errors = validate(schema, roster);
  assert.ok(errors.length > 0, 'a real entry with no verificationRef must be rejected');
  assert.ok(errors.some((e) => e.path.includes('verificationRef')), `expected a verificationRef error, got: ${JSON.stringify(errors)}`);
});

test('a synthetic:false entry WITH verificationRef validates cleanly', async () => {
  const schema = await loadSchema();
  const roster = {
    schemaVersion: 1,
    reviewers: [baseEntry({ reviewerId: 'real-1', synthetic: false, verificationRef: 'gate-g1-verification-log:0001' })],
  };
  assert.deepEqual(validate(schema, roster), []);
});

// --- structural guardrail: synthetic entries MUST NOT carry verificationRef --------------------

test('a synthetic:true entry that ALSO carries verificationRef is REJECTED (cannot fake a G1 verification)', async () => {
  const schema = await loadSchema();
  const roster = {
    schemaVersion: 1,
    reviewers: [baseEntry({ synthetic: true, verificationRef: 'gate-g1-verification-log:0001' })],
  };
  const errors = validate(schema, roster);
  assert.ok(errors.length > 0, 'a synthetic entry with a populated verificationRef must be rejected');
});

test('a synthetic:true entry with NO verificationRef validates cleanly', async () => {
  const schema = await loadSchema();
  const roster = { schemaVersion: 1, reviewers: [baseEntry()] };
  assert.deepEqual(validate(schema, roster), []);
});

// --- other structural constraints ---------------------------------------------------------------

test('an entry with zero moduleScopes is REJECTED (minItems: 1)', async () => {
  const schema = await loadSchema();
  const roster = { schemaVersion: 1, reviewers: [baseEntry({ moduleScopes: [] })] };
  const errors = validate(schema, roster);
  assert.ok(errors.length > 0, 'an entry with no module scopes must be rejected');
});

test('an entry missing any one required field is REJECTED, one field at a time', async () => {
  const schema = await loadSchema();
  for (const field of ['reviewerId', 'name', 'credentialRef', 'moduleScopes', 'synthetic']) {
    const entry = baseEntry();
    delete entry[field];
    const roster = { schemaVersion: 1, reviewers: [entry] };
    const errors = validate(schema, roster);
    assert.ok(errors.length > 0, `an entry missing "${field}" must be rejected`);
    assert.ok(
      errors.some((e) => e.path.endsWith(`.${field}`)),
      `expected a missing-"${field}" error, got: ${JSON.stringify(errors)}`,
    );
  }
});

test('an entry with an unrecognized extra property is REJECTED (additionalProperties: false)', async () => {
  const schema = await loadSchema();
  const roster = { schemaVersion: 1, reviewers: [baseEntry({ notAllowedExtraField: 'nope' })] };
  const errors = validate(schema, roster);
  assert.ok(errors.length > 0, 'an entry with an unrecognized property must be rejected');
  assert.ok(errors.some((e) => e.path.includes('notAllowedExtraField')));
});

test('an unrecognized top-level roster property is REJECTED (additionalProperties: false)', async () => {
  const schema = await loadSchema();
  const roster = { schemaVersion: 1, reviewers: [], notAllowedTopLevelField: 'nope' };
  const errors = validate(schema, roster);
  assert.ok(errors.length > 0, 'an unrecognized top-level property must be rejected');
});

test('reviewerId must match the lowercase-kebab pattern', async () => {
  const schema = await loadSchema();
  for (const badId of ['Synth-Clinical-1', 'synth_clinical_1', '1synth', '']) {
    const roster = { schemaVersion: 1, reviewers: [baseEntry({ reviewerId: badId })] };
    const errors = validate(schema, roster);
    assert.ok(errors.length > 0, `reviewerId "${badId}" must be rejected`);
  }
});

test('moduleScopes entries must match the moduleId pattern', async () => {
  const schema = await loadSchema();
  const roster = { schemaVersion: 1, reviewers: [baseEntry({ moduleScopes: ['Not-A-Valid-Module-Id'] })] };
  const errors = validate(schema, roster);
  assert.ok(errors.length > 0, 'a malformed module id in moduleScopes must be rejected');
});

// --- schema-level structural inspection ---------------------------------------------------------

test('reviewer-roster.schema.json ships with zero entries by default guidance (minItems: 0) and documents the FR-3 empty-ship requirement', async () => {
  const schema = await loadSchema();
  assert.equal(schema.properties.reviewers.minItems, 0);
  assert.match(schema.properties.reviewers.description, /FR-3/);
});

test('reviewer-roster.schema.json structurally pairs synthetic with verificationRef in both directions', async () => {
  const schema = await loadSchema();
  const entryDef = schema.$defs.reviewerEntry;
  assert.equal(entryDef.allOf.length, 2, 'expected exactly one if/then pair per synthetic value');
  const realBranch = entryDef.allOf.find((clause) => clause.if.properties.synthetic.const === false);
  const syntheticBranch = entryDef.allOf.find((clause) => clause.if.properties.synthetic.const === true);
  assert.ok(realBranch, 'expected an if/then clause keyed on synthetic: false');
  assert.ok(syntheticBranch, 'expected an if/then clause keyed on synthetic: true');
  assert.deepEqual(realBranch.then.required, ['verificationRef'], 'synthetic:false must require verificationRef');
  assert.deepEqual(syntheticBranch.then.not.required, ['verificationRef'], 'synthetic:true must forbid verificationRef');
});
