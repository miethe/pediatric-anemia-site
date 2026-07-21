// tests/evidence-source-terms-snapshot.test.mjs — EPR2-T2 (FR-WP2-02, D1).
//
// Proves schemas/evidence.schema.json's `$defs/source` now carries a required, structured
// `terms_snapshot` field that is an ADDRESSABLE LOCATOR — a scheme-qualified reference, a content
// hash, and a retrieval date — and is structurally INCAPABLE of holding terms prose:
//   - Omitting `terms_snapshot` (or any of its required members) fails validation.
//   - An explicit typed "not_captured"/"unknown" snapshot (all three data members null) passes —
//     D2: omission is never a legitimate way to express "unassessed" or "not captured".
//   - A fixture attempting to store a paragraph of terms text in `locator` fails validation: the
//     `pattern` requires a scheme prefix and forbids whitespace, so prose (which contains spaces)
//     can never validate as a locator. This is the D1 boundary this task exists to enforce.
//   - `sha256` is a closed 64-hex-digit hash shape; `retrieved_at` is a bare date. Neither can hold
//     free text either.
//   - No `format: "uri"` is introduced (FR-WP0-08); `locator` uses `pattern` instead.
//
// This file deliberately does NOT read or assert against modules/anemia/evidence.json: per the
// phase's atomic-migration sequencing, the committed evidence.json is backfilled with these fields
// by EPR2-T3, not this task (see tests/evidence-source-rights-metadata.test.mjs for the identical
// rationale re: `license`/`access_basis`/`terms`). Until EPR2-T3 lands, `npm run validate` is
// expected to keep failing on the as-yet-unbackfilled 6 sources — intended migration shape, not a
// regression introduced here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = new URL('../', import.meta.url);
const SCHEMA_PATH = 'schemas/evidence.schema.json';

let schema;

test('schemas/evidence.schema.json fixture loads and defines $defs/termsSnapshot', async () => {
  schema = JSON.parse(await readFile(new URL(SCHEMA_PATH, REPO_ROOT), 'utf8'));
  assert.ok(schema.$defs.source, 'schema must define $defs/source');
  assert.ok(schema.$defs.termsSnapshot, 'schema must define $defs/termsSnapshot');
  assert.equal(
    schema.$defs.source.properties.terms_snapshot.$ref,
    '#/$defs/termsSnapshot',
    'source.terms_snapshot must reference $defs/termsSnapshot',
  );
  assert.ok(
    schema.$defs.source.required.includes('terms_snapshot'),
    'terms_snapshot must be a required member of $defs/source',
  );
});

// A minimal but structurally complete source fixture — one passage (the implementation-proposal
// sentinel) plus every EPR2-T1/T2 field set to its explicit "genuinely unassessed" value. Mirrors
// tests/evidence-source-rights-metadata.test.mjs's baseSource(), extended with terms_snapshot.
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
      // members after this fixture was authored. Kept in sync here for the same reason as
      // tests/evidence-source-rights-metadata.test.mjs's baseSource().
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

test('a fully unassessed source (terms_snapshot.status: "unknown", all data members null) validates clean', () => {
  const errors = validate(schema.$defs.source, baseSource(), { rootSchema: schema });
  assert.deepEqual(errors, [], `unexpected errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('a "not_captured" terms_snapshot validates clean', () => {
  const source = baseSource({
    terms_snapshot: { status: 'not_captured', locator: null, sha256: null, retrieved_at: null },
  });
  const errors = validate(schema.$defs.source, source, { rootSchema: schema });
  assert.deepEqual(errors, [], `unexpected errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('a fully "captured" terms_snapshot with locator, sha256, and retrieved_at validates clean', () => {
  const source = baseSource({
    terms_snapshot: {
      status: 'captured',
      locator: 'internal://rights-snapshots/aap-pco-terms-2026-07-21.html',
      sha256: 'a'.repeat(64),
      retrieved_at: '2026-07-21',
    },
  });
  const errors = validate(schema.$defs.source, source, { rootSchema: schema });
  assert.deepEqual(errors, [], `unexpected errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('an https:// locator also validates clean', () => {
  const source = baseSource({
    terms_snapshot: {
      status: 'captured',
      locator: 'https://example.org/terms-of-use',
      sha256: null,
      retrieved_at: '2026-07-21',
    },
  });
  const errors = validate(schema.$defs.source, source, { rootSchema: schema });
  assert.deepEqual(errors, [], `unexpected errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('omitting `terms_snapshot` entirely fails validation', () => {
  const bad = deleteAtPath(baseSource(), 'terms_snapshot');
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.terms_snapshot')), `expected a terms_snapshot error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('omitting a required member of `terms_snapshot` (e.g. status) fails validation', () => {
  const bad = deleteAtPath(baseSource(), 'terms_snapshot.status');
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.terms_snapshot.status')), `expected a terms_snapshot.status error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('omitting `terms_snapshot.locator` (rather than setting it null) fails validation', () => {
  const bad = deleteAtPath(baseSource(), 'terms_snapshot.locator');
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.terms_snapshot.locator')), `expected a terms_snapshot.locator error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('an unrecognized additional property on `terms_snapshot` is rejected (additionalProperties: false posture preserved)', () => {
  const bad = baseSource({ terms_snapshot: { ...baseSource().terms_snapshot, terms_text: 'nope' } });
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.length > 0, 'expected an error for an additional terms_snapshot property');
});

test('D1: a fixture attempting to store a paragraph of terms text in `locator` fails validation', () => {
  const prose = 'You may not alter, abridge, or adapt the Materials, and you may not incorporate ' +
    'the Materials into any other work or product without our prior written approval.';
  const bad = baseSource({
    terms_snapshot: { status: 'captured', locator: prose, sha256: null, retrieved_at: '2026-07-21' },
  });
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.terms_snapshot.locator')), `expected a locator pattern error for a prose value, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('`terms_snapshot.locator` rejects a bare non-scheme-qualified string', () => {
  const bad = baseSource({
    terms_snapshot: { status: 'captured', locator: 'not-a-locator', sha256: null, retrieved_at: '2026-07-21' },
  });
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.terms_snapshot.locator')), `expected a locator pattern error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('`terms_snapshot.sha256` rejects a value that is not a 64-hex-digit hash', () => {
  const bad = baseSource({
    terms_snapshot: { status: 'captured', locator: 'https://example.org/terms', sha256: 'not-a-hash', retrieved_at: '2026-07-21' },
  });
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.terms_snapshot.sha256')), `expected a sha256 pattern error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('`terms_snapshot.retrieved_at` rejects a non-date string', () => {
  const bad = baseSource({
    terms_snapshot: { status: 'captured', locator: 'https://example.org/terms', sha256: null, retrieved_at: 'not-a-date' },
  });
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.some((e) => e.path.endsWith('.terms_snapshot.retrieved_at')), `expected a retrieved_at date-format error, got:\n${JSON.stringify(errors, null, 2)}`);
});

test('no `format: "uri"` is introduced anywhere on `$defs/termsSnapshot`', () => {
  const walk = (node, path) => {
    if (node === null || typeof node !== 'object') return;
    if (node.format === 'uri') {
      assert.fail(`format: "uri" found at ${path} — scripts/lib/json-schema-lite.mjs silently ignores it (FR-WP0-08); use pattern instead`);
    }
    for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
  };
  walk(schema.$defs.termsSnapshot, '$defs.termsSnapshot');
});

test('no CLEARED_* / clearance vocabulary appears anywhere on `terms_snapshot` (D6/D7 — this is a coverage/provenance field, not a clearance surface)', () => {
  const text = JSON.stringify(schema.$defs.termsSnapshot);
  assert.ok(!text.includes('CLEARED_'), 'no CLEARED_* value may appear on terms_snapshot');
});

test('there is no free-text (unconstrained, unpatterned) string property anywhere on `$defs/termsSnapshot` capable of holding terms prose', () => {
  for (const [name, propSchema] of Object.entries(schema.$defs.termsSnapshot.properties)) {
    const types = Array.isArray(propSchema.type) ? propSchema.type : [propSchema.type];
    if (!types.includes('string')) continue; // status is an enum, not a bare string type
    assert.ok(
      propSchema.pattern || propSchema.enum || propSchema.format === 'date' || propSchema.format === 'date-time',
      `terms_snapshot.${name} is a string property with no pattern/enum/date constraint — it could hold arbitrary prose`,
    );
  }
});
