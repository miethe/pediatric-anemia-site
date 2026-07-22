// tests/evidence-source-rights-metadata.test.mjs — EPR2-T1 (FR-WP2-01/05).
//
// Proves schemas/evidence.schema.json's `$defs/source` now carries required, structured
// `license`, `access_basis`, and `terms` fields:
//   - Omitting any of the three new fields (or a required member inside `license`/`terms`) fails
//     validation.
//   - An explicit typed `unknown` (or `not_addressed`/null, per field) passes — D2: omission is
//     never a legitimate way to express "unassessed".
//   - No `format: "uri"` is introduced anywhere on the new fields; `license.license_url` uses
//     `pattern` instead, and a malformed value is rejected by it.
//   - `terms.commercial_use` accepts the spec-vocabulary `not_granted_by_subscription` value
//     FR-WP2-03 (EPR2-T3) will need.
//
// This file deliberately does NOT read or assert against modules/anemia/evidence.json: per the
// phase's atomic-migration sequencing (schema-first, then mechanical backfill, then validate;
// docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1/
// phase-r2-source-rights-metadata.md), the committed evidence.json is backfilled with these fields
// by EPR2-T3, not this task. Until EPR2-T3 lands, `npm run validate` and
// tests/evidence-passages.test.mjs's "evidence.json validates against schemas/evidence.schema.json"
// case are expected to fail on the as-yet-unbackfilled 6 sources — that is the intended shape of
// the migration, not a regression introduced here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = new URL('../', import.meta.url);
const SCHEMA_PATH = 'schemas/evidence.schema.json';

let schema;

test('schemas/evidence.schema.json fixture loads', async () => {
  schema = JSON.parse(await readFile(new URL(SCHEMA_PATH, REPO_ROOT), 'utf8'));
  assert.ok(schema.$defs.source, 'schema must define $defs/source');
  assert.ok(schema.$defs.license, 'schema must define $defs/license');
  assert.ok(schema.$defs.terms, 'schema must define $defs/terms');
});

// A minimal but structurally complete source fixture — one passage (the implementation-proposal
// sentinel, the only status that permits an empty exactPassage) plus every new EPR2-T1 field set
// to its explicit "genuinely unassessed" value. This fixture must validate clean: it is the proof
// that an unassessed source is representable without inventing a false certainty.
function baseSource(overrides = {}) {
  const source = {
    id: 'TEST_SOURCE',
    priority: 'primary',
    year: 2026,
    title: 'Test Source',
    organization: 'Test Org',
    journal: 'Test Journal',
    url: 'https://example.org/test-source',
    supports: ['a test claim'],
    passages: [
      {
        id: 'TEST_SOURCE#implementation-proposal',
        sourceId: 'TEST_SOURCE',
        status: 'implementation-proposal',
        sourceLocator: { raw: 'sentinel', page: null, section: null, table: null, figure: null },
        exactPassage: '',
        passageFidelity: 'paraphrase',
        reviewFlags: [],
        reviewFindingIds: [],
        evidenceGrade: null,
        reviewDate: '2026-07-21',
        supersedes: null,
        surveillanceQuery: 'q',
        provenance: { runId: 'r', sourceCardId: 's', evidenceId: 'implementation-proposal' },
        // EPR3-T2 (FR-WP3-01/02/03): the three axis fields are REQUIRED on every passage record.
        // These are structurally-legal fixture values on a synthetic sentinel, not a
        // classification of any real source content (that backfill is EPR3-T5's).
        evidence_item_type: 'bibliographic_metadata',
        judgment_basis: 'unassessed',
        judgment_basis_attestation: null,
        rights_component_class: 'bibliographic_metadata',
        // EPR3-T4 (FR-WP3-04/06): structured_locator + not_captured are also REQUIRED. The sentinel
        // is exempt from the non-empty not_captured[] rule (it captured nothing from a source).
        structured_locator: {
          source: 'TEST_SOURCE', edition_or_version: null, section: null, table: null, row: null,
          column: null, assay_or_method: null, population_or_scope: null, retrieved_at: null,
          unresolved_components: [],
        },
        not_captured: [],
      },
    ],
    access_basis: 'unknown',
    license: {
      status: 'unknown',
      rights_holder: null,
      license_url: null,
      noncommercial_only: null,
      no_derivatives: null,
      // EPR2-T4 (FR-WP2-04): government_basis became a required sibling of the other license
      // members after this fixture was authored. Kept in sync here so this file's own "fully
      // unassessed source validates clean" case stays representative of the current
      // required-fields shape; see tests/evidence-source-government-basis.test.mjs for the
      // dedicated government_basis coverage.
      government_basis: {
        government_work: null,
        government_funded: null,
      },
    },
    terms: {
      incorporation_into_other_products: 'unknown',
      adaptation: 'unknown',
      commercial_use: 'unknown',
      redistribution: 'unknown',
      sublicensing: 'unknown',
    },
    // EPR2-T2 (FR-WP2-02, D1): terms_snapshot became a required sibling of terms/license/
    // access_basis after this fixture was authored. Kept in sync here so this file's own
    // "fully unassessed source validates clean" case stays representative of the current
    // required-fields shape; see tests/evidence-source-terms-snapshot.test.mjs for the
    // dedicated terms_snapshot coverage.
    terms_snapshot: {
      status: 'unknown',
      locator: null,
      sha256: null,
      retrieved_at: null,
    },
    ...overrides,
  };
  return source;
}

function deleteAtPath(obj, dottedPath) {
  const clone = structuredClone(obj);
  const segments = dottedPath.split('.');
  let node = clone;
  for (let i = 0; i < segments.length - 1; i += 1) node = node[segments[i]];
  delete node[segments[segments.length - 1]];
  return clone;
}

test('a fully unassessed source (all-unknown license/access_basis/terms) validates clean', () => {
  const errors = validate(schema.$defs.source, baseSource(), { rootSchema: schema });
  assert.deepEqual(errors, [], `unexpected errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('omitting `access_basis` entirely fails validation', () => {
  const bad = deleteAtPath(baseSource(), 'access_basis');
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.length > 0, 'expected a validation error for missing access_basis');
  assert.ok(errors.some((e) => e.path.endsWith('.access_basis')), `expected an access_basis error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('omitting `license` entirely fails validation', () => {
  const bad = deleteAtPath(baseSource(), 'license');
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.license')), `expected a license error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('omitting `terms` entirely fails validation', () => {
  const bad = deleteAtPath(baseSource(), 'terms');
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.terms')), `expected a terms error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('omitting a required member of `license` (e.g. rights_holder) fails validation', () => {
  const bad = deleteAtPath(baseSource(), 'license.rights_holder');
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.license.rights_holder')), `expected a license.rights_holder error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('omitting a required member of `terms` (e.g. commercial_use) fails validation', () => {
  const bad = deleteAtPath(baseSource(), 'terms.commercial_use');
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.terms.commercial_use')), `expected a terms.commercial_use error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('an unrecognized additional property on `license` or `terms` is rejected (additionalProperties: false posture preserved)', () => {
  const badLicense = baseSource({ license: { ...baseSource().license, spdx_id: 'CC-BY-4.0' } });
  const errorsLicense = validate(schema.$defs.source, badLicense, { rootSchema: schema });
  assert.ok(errorsLicense.length > 0, 'expected an error for an additional license property');

  const badTerms = baseSource({ terms: { ...baseSource().terms, bulk_retrieval: 'unknown' } });
  const errorsTerms = validate(schema.$defs.source, badTerms, { rootSchema: schema });
  assert.ok(errorsTerms.length > 0, 'expected an error for an additional terms property');
});

test('`license.license_url` rejects a malformed URL via `pattern` (never `format: "uri"`)', () => {
  assert.equal(schema.$defs.license.properties.license_url.format, undefined,
    'license_url must not use format: "uri" — scripts/lib/json-schema-lite.mjs silently ignores it (FR-WP0-08)');
  assert.ok(schema.$defs.license.properties.license_url.pattern, 'license_url must use pattern');

  const bad = baseSource({ license: { ...baseSource().license, license_url: 'not a url' } });
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.license.license_url')), `expected a license_url pattern error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('`license.license_url` accepts a well-formed https URL', () => {
  const ok = baseSource({ license: { ...baseSource().license, license_url: 'https://example.org/terms' } });
  const errors = validate(schema.$defs.source, ok, { rootSchema: schema });
  assert.deepEqual(errors, [], `unexpected errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('no `format: "uri"` is introduced anywhere on the new license/terms/access_basis schema nodes', () => {
  const walk = (node, path) => {
    if (node === null || typeof node !== 'object') return;
    if (node.format === 'uri') {
      assert.fail(`format: "uri" found at ${path} — scripts/lib/json-schema-lite.mjs silently ignores it (FR-WP0-08); use pattern instead`);
    }
    for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
  };
  walk(schema.$defs.license, '$defs.license');
  walk(schema.$defs.terms, '$defs.terms');
  walk(schema.$defs.source.properties.access_basis, '$defs.source.properties.access_basis');
});

test('EPR2-T3 (FR-WP2-03) forward-compat: terms.commercial_use accepts the spec-vocabulary "not_granted_by_subscription" value', () => {
  const ok = baseSource({ terms: { ...baseSource().terms, commercial_use: 'not_granted_by_subscription' } });
  const errors = validate(schema.$defs.source, ok, { rootSchema: schema });
  assert.deepEqual(errors, [], `unexpected errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('EPR2-T4 (FR-WP2-04): license.status distinguishes us_federal_government_work from public_domain (distinct enum members, never inferred) — see tests/evidence-source-government-basis.test.mjs for the dedicated government_basis invariant coverage', () => {
  const okGovWork = baseSource({
    license: { ...baseSource().license, status: 'us_federal_government_work', government_basis: { government_work: true, government_funded: null } },
  });
  assert.deepEqual(validate(schema.$defs.source, okGovWork, { rootSchema: schema }), []);

  const okPublicDomain = baseSource({
    license: { ...baseSource().license, status: 'public_domain', government_basis: { government_work: null, government_funded: null } },
  });
  assert.deepEqual(validate(schema.$defs.source, okPublicDomain, { rootSchema: schema }), []);

  assert.notEqual(
    schema.$defs.license.properties.status.enum.indexOf('us_federal_government_work'),
    schema.$defs.license.properties.status.enum.indexOf('public_domain'),
    'us_federal_government_work and public_domain must be distinct enum members',
  );
});

test('access_basis vocabulary matches schemas/rights/rights_record.schema.json\'s access.basis one-for-one', async () => {
  const rightsRecordSchema = JSON.parse(await readFile(new URL('schemas/rights/rights_record.schema.json', REPO_ROOT), 'utf8'));
  const expected = new Set(rightsRecordSchema.properties.access.properties.basis.enum);
  const actual = new Set(schema.$defs.source.properties.access_basis.enum);
  assert.deepEqual(actual, expected, 'evidence.schema.json access_basis enum must match rights_record.schema.json access.basis enum exactly');
});

test('no CLEARED_* / clearance vocabulary appears anywhere on the new license/terms/access_basis fields (D6/D7 — these are coverage fields, not a clearance surface)', () => {
  const text = JSON.stringify({
    license: schema.$defs.license,
    terms: schema.$defs.terms,
    access_basis: schema.$defs.source.properties.access_basis,
  });
  assert.ok(!text.includes('CLEARED_'), 'no CLEARED_* value may appear on this task\'s fields');
});
