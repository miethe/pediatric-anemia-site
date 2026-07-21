// tests/review-record-schema.test.mjs — EP7-T1 (schemas/review-record.schema.json).
//
// Covers the deliverable's own definition of done: a hand-authored example record round-trips
// through all 4 workflow-transition stages (change-proposal -> dual-review -> conflict-resolution
// -> approval, i.e. `proposed` -> `under-review` -> `disputed` -> `approved`); D-4 is enforced at
// the schema layer for THIS contract exactly as tests/clinical-approvers-d4.test.mjs and
// tests/module-manifest-schema.test.mjs enforce it for `clinicalApprovers`/`approvedBy` — a
// populated approver-adjacent field from anything other than a real named human is a hard schema
// violation, not merely a test failure; and `approvedBy`'s shape is proven byte-compatible with
// schemas/module-manifest.schema.json's `approvedBy` (both: array of non-empty strings).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');
const MANIFEST_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'module-manifest.schema.json');
// Deliberately NOT under tests/fixtures/ or tests/witness/: those two trees are the rule-governance
// coverage corpus scanned by scripts/evidence/backfill-rule-governance.mjs (fixtureDirs, FR-WP4-02).
// This is a schema example for a paper contract, not an engine/assessment fixture — filing it there
// would perturb governance-tracked coverage in modules/anemia/rules.json.
const EXAMPLE_PATH = path.join(REPO_ROOT, 'schemas', 'examples', 'review-record.example.json');

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

async function loadSchemaAndExample() {
  const schema = await readJson(SCHEMA_PATH);
  const example = await readJson(EXAMPLE_PATH);
  return { schema, example };
}

// --- round trip through all 4 workflow transitions -------------------------------------------
//
// The hand-authored fixture is the terminal `approved` record (full history + resolved dispute).
// The three earlier snapshots below are derived from it by construction — each is what the SAME
// record legitimately looked like at that point in its life — and each must independently satisfy
// the schema's per-state gates (empty reviewers/approvedBy while `proposed`; >=2 reviewers once
// `under-review`; a live, unresolved `conflictResolution` while `disputed`; >=2 human approvals and
// a resolved `conflictResolution` once `approved`).

function buildSnapshots(example) {
  const proposed = {
    ...example,
    workflowState: 'proposed',
    reviewers: [],
    conflictResolution: null,
    approvedBy: [],
    history: example.history.slice(0, 1),
    updatedAt: example.history[0].enteredAt,
  };

  const underReview = {
    ...example,
    workflowState: 'under-review',
    reviewers: example.reviewers.slice(0, 2).map((r) => {
      const { comment, ...rest } = r;
      return { ...rest, decision: 'pending', decidedAt: null };
    }),
    conflictResolution: null,
    approvedBy: [],
    history: example.history.slice(0, 2),
    updatedAt: example.history[1].enteredAt,
  };

  const disputed = {
    ...example,
    workflowState: 'disputed',
    reviewers: example.reviewers.slice(0, 2),
    conflictResolution: {
      triggeredAt: example.conflictResolution.triggeredAt,
      reason: example.conflictResolution.reason,
      resolvedBy: null,
      resolution: null,
      resolvedAt: null,
      notes: null,
    },
    approvedBy: [],
    history: example.history.slice(0, 3),
    updatedAt: example.history[2].enteredAt,
  };

  // `approved` is the fixture exactly as authored.
  return { proposed, underReview, disputed, approved: example };
}

test('the hand-authored example round-trips through all 4 workflow states: proposed, under-review, disputed, approved', async () => {
  const { schema, example } = await loadSchemaAndExample();
  const { proposed, underReview, disputed, approved } = buildSnapshots(example);

  for (const [state, snapshot] of Object.entries({ proposed, underReview, disputed, approved })) {
    const errors = validate(schema, snapshot);
    assert.deepEqual(errors, [], `${state} snapshot failed validation: ${JSON.stringify(errors)}`);
  }
});

test('the terminal example record has workflowState "approved" and a fully resolved conflictResolution', async () => {
  const { example } = await loadSchemaAndExample();
  assert.equal(example.workflowState, 'approved');
  assert.equal(example.history.at(-1).state, 'approved');
  assert.equal(example.history[0].state, 'proposed', 'history must start at proposed');
  assert.ok(example.conflictResolution && example.conflictResolution.resolvedAt, 'dispute must be resolved by the time the record is approved');
});

// --- D-4 enforcement at the schema layer -------------------------------------------------------

test('a reviewer with reviewerType other than "human" is REJECTED (D-4: no synthetic reviewer source)', async () => {
  const { schema, example } = await loadSchemaAndExample();
  for (const poison of ['arc-council-run', 'automated', 'ai', 'model-self-review']) {
    const copy = JSON.parse(JSON.stringify(example));
    copy.reviewers[0].reviewerType = poison;
    const errors = validate(schema, copy);
    assert.ok(errors.length > 0, `reviewerType "${poison}" must be rejected`);
    assert.ok(errors.some((e) => e.path.includes('reviewerType')), `expected a reviewerType error for "${poison}", got: ${JSON.stringify(errors)}`);
  }
});

test('a reviewer with attestedHuman: false is REJECTED', async () => {
  const { schema, example } = await loadSchemaAndExample();
  const copy = JSON.parse(JSON.stringify(example));
  copy.reviewers[0].attestedHuman = false;
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'attestedHuman: false must be rejected');
  assert.ok(errors.some((e) => e.path.includes('attestedHuman')));
});

test('review-record.schema.json pins reviewerType to const "human" and attestedHuman to const true', async () => {
  const { schema } = await loadSchemaAndExample();
  const reviewerDef = schema.$defs.humanReviewer;
  assert.equal(reviewerDef.properties.reviewerType.const, 'human',
    'reviewerType must be pinned to the single legal value "human" — no automated/ARC/AI source can ever satisfy this field');
  assert.equal(reviewerDef.properties.attestedHuman.const, true,
    'attestedHuman must be pinned to literal true, giving reviewer identity two independent structural markers');
});

test('approvedBy populated while workflowState is not "approved" is REJECTED for every non-approved state', async () => {
  const { schema, example } = await loadSchemaAndExample();
  for (const state of ['proposed', 'under-review', 'disputed', 'rejected']) {
    const copy = JSON.parse(JSON.stringify(example));
    copy.workflowState = state;
    copy.approvedBy = ['Dr. A. Ibarra', 'Dr. C. Whitfield'];
    if (state === 'proposed') { copy.reviewers = []; copy.conflictResolution = null; }
    const errors = validate(schema, copy);
    assert.ok(errors.length > 0, `a populated approvedBy while workflowState="${state}" must be rejected`);
    assert.ok(errors.some((e) => e.path === '$.approvedBy'), `expected a $.approvedBy error for state "${state}", got: ${JSON.stringify(errors)}`);
  }
});

test('an "approved" record with fewer than 2 human approve decisions among reviewers is REJECTED', async () => {
  const { schema, example } = await loadSchemaAndExample();
  const copy = JSON.parse(JSON.stringify(example));
  // Flip the arbiter's approval to request-changes, leaving only 1 qualifying approve decision.
  copy.reviewers[2].decision = 'request-changes';
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'an approved record needs at least 2 human approve decisions (dual sign-off)');
});

test('an "approved" record whose conflictResolution.resolvedBy is still null is REJECTED (dispute must be closed by a real human before approval)', async () => {
  const { schema, example } = await loadSchemaAndExample();
  const copy = JSON.parse(JSON.stringify(example));
  copy.conflictResolution.resolvedBy = null;
  copy.conflictResolution.resolution = null;
  copy.conflictResolution.resolvedAt = null;
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'an approved record cannot carry an unresolved conflictResolution');
});

test('a "disputed" record with conflictResolution: null is REJECTED (a live dispute must be recorded)', async () => {
  const { schema, example } = await loadSchemaAndExample();
  const copy = JSON.parse(JSON.stringify(example));
  copy.workflowState = 'disputed';
  copy.conflictResolution = null;
  copy.approvedBy = [];
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'a disputed record with no conflictResolution object must be rejected');
});

test('a "rejected" record with a non-empty approvedBy is REJECTED (rejection must never carry an approval)', async () => {
  const { schema, example } = await loadSchemaAndExample();
  const copy = JSON.parse(JSON.stringify(example));
  copy.workflowState = 'rejected';
  copy.approvedBy = ['Dr. A. Ibarra', 'Dr. C. Whitfield'];
  const errors = validate(schema, copy);
  assert.ok(errors.length > 0, 'a rejected record must never carry a populated approvedBy');
});

// --- approvedBy[] shape compatibility with EP-5's signed manifest ------------------------------

test("review-record's approvedBy[] item shape is byte-compatible with module-manifest.schema.json's approvedBy[] item shape", async () => {
  const reviewSchema = await readJson(SCHEMA_PATH);
  const manifestSchema = await readJson(MANIFEST_SCHEMA_PATH);
  assert.deepEqual(
    reviewSchema.properties.approvedBy.items,
    manifestSchema.properties.approvedBy.items,
    'both schemas must require approvedBy items to be the same shape (non-empty string) so an approved '
      + "review record's approvedBy[] can be copied verbatim into a module manifest's approvedBy[] once "
      + "that field's maxItems: 0 ceiling is deliberately raised — a future, separately gated act this "
      + 'schema does not perform',
  );
});

test("an approved review record's approvedBy[] values validate against module-manifest.schema.json's approvedBy item schema", async () => {
  const { example } = await loadSchemaAndExample();
  const manifestSchema = await readJson(MANIFEST_SCHEMA_PATH);
  for (const approver of example.approvedBy) {
    const errors = validate(manifestSchema.properties.approvedBy.items, approver);
    assert.deepEqual(errors, [], `approvedBy entry "${approver}" must validate against the manifest's approvedBy item shape: ${JSON.stringify(errors)}`);
  }
});

// --- non-vacuity: the real fixture must actually validate cleanly ------------------------------

test('the hand-authored fixture as shipped validates against review-record.schema.json with zero errors', async () => {
  const { schema, example } = await loadSchemaAndExample();
  const errors = validate(schema, example);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});
