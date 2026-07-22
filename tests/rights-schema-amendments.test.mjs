// tests/rights-schema-amendments.test.mjs — EPR0-T3 (handoff §9.2–§9.6, D6).
//
// Proves the declared local amendment layer EPR0-T3 applies in place to the vendored schemas under
// schemas/rights/ actually does what schemas/rights/VENDORING.md's "Declared amendments" section
// says it does:
//   - D6: no agent-writable path can produce a `CLEARED_*` overall_status, a `counsel_approved`
//     review_status, a non-null human/counsel/clinical reviewer, or a non-empty rights_failure
//     reviewer list — each proven with a failing fixture, not merely a passing one.
//   - A record at `overall_status: UNKNOWN` still passes (D7: coverage/consistency gates only,
//     never a clearance gate).
//   - Every constrained field path actually resolves in the live schema, so a future typo in the
//     amendment (e.g. a renamed property) cannot silently disable a constraint.
//   - §9.3: `access.basis` accepts `unknown`.
//   - §9.6: no `format: "uri"` remains anywhere under schemas/rights/; the empty `contract` object
//     is rejected, `contract: null` and a populated `contract` both remain valid.
//   - §9.2 / §9.4: the annotated fields carry a `description` recording the divergence.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = new URL('../', import.meta.url);

const readJsonSchema = async (relPath) => JSON.parse(await readFile(new URL(relPath, REPO_ROOT), 'utf8'));
const readRawText = async (relPath) => readFile(new URL(relPath, REPO_ROOT), 'utf8');

const RIGHTS_RECORD_SCHEMA_PATH = 'schemas/rights/rights_record.schema.json';
const CONTENT_REUSE_SCHEMA_PATH = 'schemas/rights/content_reuse_assessment.schema.json';
const RIGHTS_FAILURE_SCHEMA_PATH = 'schemas/rights/rights_failure.schema.json';

const SCHEMAS_RIGHTS_FILES = [
  RIGHTS_RECORD_SCHEMA_PATH,
  CONTENT_REUSE_SCHEMA_PATH,
  RIGHTS_FAILURE_SCHEMA_PATH,
  'schemas/rights/permission_record.schema.json',
  'schemas/rights/rights_extension.schema.json',
];

let rightsRecordSchema;
let contentReuseSchema;
let rightsFailureSchema;

test.before(async () => {
  rightsRecordSchema = await readJsonSchema(RIGHTS_RECORD_SCHEMA_PATH);
  contentReuseSchema = await readJsonSchema(CONTENT_REUSE_SCHEMA_PATH);
  rightsFailureSchema = await readJsonSchema(RIGHTS_FAILURE_SCHEMA_PATH);
});

// --- §9.6: no `format: "uri"` remains anywhere under schemas/rights/ -------------------------------

test('§9.6: no "format": "uri" remains anywhere under schemas/rights/', async () => {
  for (const relPath of SCHEMAS_RIGHTS_FILES) {
    const text = await readRawText(relPath);
    assert.ok(
      !/"format"\s*:\s*"uri"/.test(text),
      `${relPath} must not contain "format": "uri" — json-schema-lite silently ignores it (fail-open)`,
    );
  }
});

// --- companion test: every D6-constrained field path resolves in the live vendored schema ----------
//
// Guards against a future typo (a renamed property, a re-nested object) silently disabling a
// constraint without any test noticing, because the property the constraint was attached to no
// longer exists under that path.

function resolveProperty(schema, propertyPath) {
  let node = schema;
  for (const segment of propertyPath) {
    node = node?.properties?.[segment];
    if (node === undefined) return undefined;
  }
  return node;
}

const D6_CONSTRAINED_PATHS = [
  {
    label: 'rights_record.review.human_reviewer',
    schema: () => rightsRecordSchema,
    path: ['review', 'human_reviewer'],
    assertConstraint: (node) => assert.equal(node.const, null, 'expected const: null'),
  },
  {
    label: 'rights_record.review.counsel_reviewer',
    schema: () => rightsRecordSchema,
    path: ['review', 'counsel_reviewer'],
    assertConstraint: (node) => assert.equal(node.const, null, 'expected const: null'),
  },
  {
    label: 'rights_record.review.review_status',
    schema: () => rightsRecordSchema,
    path: ['review', 'review_status'],
    assertConstraint: (node) => assert.equal(node.not?.const, 'counsel_approved', 'expected not.const: "counsel_approved"'),
  },
  {
    label: 'rights_record.overall_status',
    schema: () => rightsRecordSchema,
    path: ['overall_status'],
    assertConstraint: (node) => {
      assert.ok(Array.isArray(node.not?.enum), 'expected not.enum array');
      for (const clearedMember of ['CLEARED_OPEN_LICENSE', 'CLEARED_PUBLIC_DOMAIN', 'CLEARED_FACTS_ONLY', 'CLEARED_PERMISSION']) {
        assert.ok(node.not.enum.includes(clearedMember), `expected not.enum to include ${clearedMember}`);
      }
    },
  },
  {
    label: 'content_reuse_assessment.review.clinical_reviewer',
    schema: () => contentReuseSchema,
    path: ['review', 'clinical_reviewer'],
    assertConstraint: (node) => assert.equal(node.const, null, 'expected const: null'),
  },
  {
    label: 'rights_failure.review.reviewed_by',
    schema: () => rightsFailureSchema,
    path: ['review', 'reviewed_by'],
    assertConstraint: (node) => assert.equal(node.maxItems, 0, 'expected maxItems: 0'),
  },
];

for (const { label, schema, path, assertConstraint } of D6_CONSTRAINED_PATHS) {
  test(`D6 constrained path resolves in the vendored schema: ${label}`, () => {
    const node = resolveProperty(schema(), path);
    assert.ok(node !== undefined, `expected "${path.join('.')}" to resolve under the schema's "properties" tree`);
    assertConstraint(node);
  });
}

// --- §9.3: access.basis accepts "unknown" ------------------------------------------------------------

test('§9.3: rights_record.access.basis enum includes "unknown"', () => {
  const basisNode = resolveProperty(rightsRecordSchema, ['access']).properties.basis;
  assert.ok(basisNode.enum.includes('unknown'), 'expected access.basis enum to include "unknown"');
});

// --- §9.2 / §9.4: annotated fields carry a description recording the divergence ----------------------

test('§9.2: component_decisions[].component_type carries a description declaring the enum authoritative', () => {
  const componentTypeNode = rightsRecordSchema.properties.component_decisions.items.properties.component_type;
  assert.match(componentTypeNode.description, /authoritative/i);
  assert.match(componentTypeNode.description, /§9\.2/);
});

test('§9.4: TDM/model-training duplication is annotated with a designated canonical home', () => {
  const access = rightsRecordSchema.properties.access.properties;
  const contract = rightsRecordSchema.properties.contract.properties;
  assert.match(access.text_and_data_mining_allowed.description, /canonical/i);
  assert.match(access.model_training_allowed.description, /canonical/i);
  assert.match(contract.bulk_retrieval.description, /deprecated-in-copy/i);
  assert.match(contract.model_training.description, /deprecated-in-copy/i);
});

// --- fixtures -----------------------------------------------------------------------------------------

function baseRightsRecordFixture() {
  return {
    schema_version: '1.0.0',
    rights_record_id: 'RR-FIXTURE-001',
    source_id: 'SRC-FIXTURE',
    record_scope: 'source',
    jurisdictions: ['US'],
    access: { basis: 'unknown', terms_verified_at: '2026-07-21T00:00:00Z' },
    copyright: { status: 'unknown' },
    component_decisions: [{ component_type: 'prose', decision: 'unknown' }],
    overall_status: 'UNKNOWN',
    review: {
      reviewed_at: '2026-07-21T00:00:00Z',
      review_status: 'agent_triage_only',
      human_reviewer: null,
      counsel_reviewer: null,
    },
  };
}

function baseContentReuseFixture() {
  return {
    schema_version: '1.0.0',
    reuse_assessment_id: 'CRA-FIXTURE-001',
    source_id: 'SRC-FIXTURE',
    rights_record_ids: ['RR-FIXTURE-001'],
    component: { component_type: 'prose', description: 'fixture component' },
    intended_use: {
      product: 'fixture-product',
      use_type: 'internal_research',
      commercial: false,
      audience: [],
      channels: [],
      territories: [],
    },
    analysis: {
      independently_authored: true,
      copies_source_wording: false,
      copies_source_arrangement: false,
      compilation_similarity: 'none',
      market_substitution_risk: 'none',
      alternative_sources_available: false,
    },
    decision: { status: 'UNKNOWN', release_gate: 'BLOCK', rationale: 'fixture rationale' },
    review: {
      reviewed_at: '2026-07-21T00:00:00Z',
      review_status: 'agent_triage_only',
      clinical_reviewer: null,
    },
  };
}

function baseRightsFailureFixture() {
  return {
    schema_version: '1.0.0',
    rights_failure_id: 'RF-FIXTURE-001',
    source_id: 'SRC-FIXTURE',
    failure_type: 'LICENSE_UNKNOWN',
    intended_use: 'fixture intended use',
    finding: 'fixture finding',
    safe_residual_use: [],
    product_impact: 'fixture product impact',
    release_gate: 'BLOCK',
    status: 'open',
    review: { reviewed_at: '2026-07-21T00:00:00Z', reviewed_by: [] },
  };
}

// --- controls: the base fixtures, unmutated, validate cleanly -----------------------------------------
//
// Required so every negative test below proves the *specific* mutated field fails, not that the
// fixture was already broken. Also proves D7 directly: a record at overall_status: UNKNOWN passes.

test('CONTROL: base rights_record fixture (overall_status: UNKNOWN) validates with zero errors', () => {
  const errors = validate(rightsRecordSchema, baseRightsRecordFixture());
  assert.deepEqual(errors, []);
});

test('CONTROL: base content_reuse_assessment fixture validates with zero errors', () => {
  const errors = validate(contentReuseSchema, baseContentReuseFixture());
  assert.deepEqual(errors, []);
});

test('CONTROL: base rights_failure fixture validates with zero errors', () => {
  const errors = validate(rightsFailureSchema, baseRightsFailureFixture());
  assert.deepEqual(errors, []);
});

// --- negative criterion: D6 -----------------------------------------------------------------------

test('D6 negative: rights_record.review.human_reviewer set to a non-null value fails validation', () => {
  const fixture = baseRightsRecordFixture();
  fixture.review.human_reviewer = 'Dr. Someone';
  const errors = validate(rightsRecordSchema, fixture);
  assert.ok(errors.length > 0);
});

test('D6 negative: rights_record.review.counsel_reviewer set to a non-null value fails validation', () => {
  const fixture = baseRightsRecordFixture();
  fixture.review.counsel_reviewer = 'General Counsel';
  const errors = validate(rightsRecordSchema, fixture);
  assert.ok(errors.length > 0);
});

test('D6 negative: rights_record.review.review_status set to "counsel_approved" fails validation', () => {
  const fixture = baseRightsRecordFixture();
  fixture.review.review_status = 'counsel_approved';
  const errors = validate(rightsRecordSchema, fixture);
  assert.ok(errors.length > 0);
});

for (const clearedMember of ['CLEARED_OPEN_LICENSE', 'CLEARED_PUBLIC_DOMAIN', 'CLEARED_FACTS_ONLY', 'CLEARED_PERMISSION']) {
  test(`D6 negative: rights_record.overall_status set to "${clearedMember}" fails validation`, () => {
    const fixture = baseRightsRecordFixture();
    fixture.overall_status = clearedMember;
    const errors = validate(rightsRecordSchema, fixture);
    assert.ok(errors.length > 0);
  });
}

test('D6 negative: content_reuse_assessment.review.clinical_reviewer set to a non-null value fails validation', () => {
  const fixture = baseContentReuseFixture();
  fixture.review.clinical_reviewer = 'Dr. Pediatric Reviewer';
  const errors = validate(contentReuseSchema, fixture);
  assert.ok(errors.length > 0);
});

test('D6 negative: rights_failure.review.reviewed_by with any entry fails validation', () => {
  const fixture = baseRightsFailureFixture();
  fixture.review.reviewed_by = ['someone'];
  const errors = validate(rightsFailureSchema, fixture);
  assert.ok(errors.length > 0);
});

// --- negative criterion: single combined assertion is not sufficient (D6 acceptance note) -----------
//
// The acceptance criteria for the sibling EPR0-T4 task call out explicitly that "a single combined
// assertion over one field is not sufficient" for review_status vs overall_status. Prove both fail
// independently, not just their conjunction, by asserting each mutation still validates cleanly on
// every field it did NOT touch (i.e. only the intended constraint fired).

test('D6 negative: review_status=counsel_approved does not also spuriously fail overall_status', () => {
  const fixture = baseRightsRecordFixture();
  fixture.review.review_status = 'counsel_approved';
  const errors = validate(rightsRecordSchema, fixture);
  assert.ok(errors.length > 0);
  assert.ok(
    errors.every((error) => !error.path.endsWith('.overall_status')),
    'a review_status violation must not be reported against overall_status',
  );
});

// --- §9.6: empty contract object is forbidden; null and populated contract remain valid -------------

test('§9.6 negative: rights_record.contract = {} fails validation', () => {
  const fixture = baseRightsRecordFixture();
  fixture.contract = {};
  const errors = validate(rightsRecordSchema, fixture);
  assert.ok(errors.length > 0);
});

test('§9.6 control: rights_record.contract = null still validates cleanly', () => {
  const fixture = baseRightsRecordFixture();
  fixture.contract = null;
  const errors = validate(rightsRecordSchema, fixture);
  assert.deepEqual(errors, []);
});

test('§9.6 control: a populated rights_record.contract still validates cleanly', () => {
  const fixture = baseRightsRecordFixture();
  fixture.contract = { model_training: 'not_addressed', bulk_retrieval: 'unknown' };
  const errors = validate(rightsRecordSchema, fixture);
  assert.deepEqual(errors, []);
});

// --- §9.6: pattern rejects a non-URL string, accepts a well-formed URL, null still passes -----------

test('§9.6 negative: access.terms_url set to a non-URL string fails validation', () => {
  const fixture = baseRightsRecordFixture();
  fixture.access.terms_url = 'not a url';
  const errors = validate(rightsRecordSchema, fixture);
  assert.ok(errors.length > 0);
});

test('§9.6 control: access.terms_url set to a well-formed URL validates cleanly', () => {
  const fixture = baseRightsRecordFixture();
  fixture.access.terms_url = 'https://example.org/terms';
  const errors = validate(rightsRecordSchema, fixture);
  assert.deepEqual(errors, []);
});

test('§9.6 negative: copyright.license_url set to a non-URL string fails validation', () => {
  const fixture = baseRightsRecordFixture();
  fixture.copyright.license_url = 'not a url';
  const errors = validate(rightsRecordSchema, fixture);
  assert.ok(errors.length > 0);
});

// --- global: no `CLEARED_` string appears in the amendment layer's own test fixtures -----------------
//
// Mirrors EPR0-T4's negative criterion at the schema-file level: this test module itself, which
// stands in for the amendment layer's worked examples, must not leave a `CLEARED_` value in any
// fixture that is NOT explicitly the negative-criterion fixture proving it is rejected.

test('none of the CONTROL fixtures in this file carry a CLEARED_ value', () => {
  const controlFixtures = [baseRightsRecordFixture(), baseContentReuseFixture(), baseRightsFailureFixture()];
  for (const fixture of controlFixtures) {
    assert.ok(!JSON.stringify(fixture).includes('CLEARED_'), 'control fixtures must not carry a CLEARED_ value');
  }
});
