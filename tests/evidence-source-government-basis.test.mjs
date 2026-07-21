// tests/evidence-source-government-basis.test.mjs — EPR2-T4 (FR-WP2-04).
//
// Per FR-WP2-04: encodes CDC2025_LEAD as a U.S. federal government work under 17 U.S.C. §105,
// and — the part of this task that actually matters — records the distinction the reviewed spec's
// §3.7 conflates (.claude/findings/rights-governance-spec-v1.0-review-findings.md §2.B):
// government *works* are uncopyrightable regardless of who funded them; government-*funded* works
// by non-federal (e.g. university) authors are NOT — a case abundant in the PMC corpus this
// project searches. Collapsing the two would silently mark a copyrighted, grant-funded article
// public domain.
//
// This file proves three things:
//   1. schemas/evidence.schema.json's `$defs/license` now carries a required `government_basis`
//      object with two independent, explicitly-described boolean|null members — `government_work`
//      and `government_funded` — and the schema's own field descriptions state the distinction in
//      words (not just structurally), per the phase's literal acceptance criterion.
//   2. The distinction is enforced STRUCTURALLY, not just descriptively: a fixture that tries to
//      justify `license.status: "public_domain"` from `government_basis.government_funded: true`
//      alone (`government_work` not `true`) fails validation — the phase file's named acceptance
//      test. The converse (funded, non-government-work, still copyrighted) validates cleanly,
//      proving the fix does not just forbid public_domain outright — it forbids the specific
//      funding-alone justification for it.
//   3. The real committed modules/anemia/evidence.json encodes CDC2025_LEAD exactly this way —
//      `license.status: "us_federal_government_work"`, `government_basis.government_work: true` —
//      and every other source's `government_basis` is left in the explicit "genuinely unassessed"
//      null shape (D2): this task records a statutory basis already recorded in the findings, and
//      makes no new legal determination about any other source.
//
// No `CLEARED_*`/attestation/approval vocabulary is introduced anywhere on this surface (D6) —
// `us_federal_government_work` is a copyright-status fact transcribed from statute, never a
// clearance grant.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = new URL('../', import.meta.url);

let schema;
let evidenceDoc;

test('fixtures load: schemas/evidence.schema.json and modules/anemia/evidence.json', async () => {
  schema = JSON.parse(await readFile(new URL('schemas/evidence.schema.json', REPO_ROOT), 'utf8'));
  evidenceDoc = JSON.parse(await readFile(new URL('modules/anemia/evidence.json', REPO_ROOT), 'utf8'));
  assert.ok(schema.$defs.license, 'schema must define $defs/license');
  assert.ok(schema.$defs.governmentBasis, 'schema must define $defs/governmentBasis');
});

// A minimal but structurally complete source fixture, mirroring
// tests/evidence-source-rights-metadata.test.mjs's baseSource() helper.
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
      },
    ],
    access_basis: 'unknown',
    license: {
      status: 'unknown',
      rights_holder: null,
      license_url: null,
      noncommercial_only: null,
      no_derivatives: null,
      government_basis: { government_work: null, government_funded: null },
    },
    terms: {
      incorporation_into_other_products: 'unknown',
      adaptation: 'unknown',
      commercial_use: 'unknown',
      redistribution: 'unknown',
      sublicensing: 'unknown',
    },
    terms_snapshot: { status: 'unknown', locator: null, sha256: null, retrieved_at: null },
    ...overrides,
  };
  return source;
}

function withLicense(licenseOverrides) {
  return baseSource({ license: { ...baseSource().license, ...licenseOverrides } });
}

// --- 1. structural shape: government_basis exists, is required, has two independent members ------

test('`license.government_basis` is a required member of $defs/license', () => {
  assert.ok(
    schema.$defs.license.required.includes('government_basis'),
    'government_basis must be a required member of $defs/license',
  );
});

test('omitting `license.government_basis` fails validation', () => {
  const bad = baseSource();
  delete bad.license.government_basis;
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(
    errors.some((e) => e.path.endsWith('.license.government_basis')),
    `expected a government_basis error, got:\n${JSON.stringify(errors, null, 2)}`,
  );
});

test('`$defs/governmentBasis` requires both `government_work` and `government_funded` as independent boolean|null members', () => {
  const gb = schema.$defs.governmentBasis;
  assert.deepEqual(new Set(gb.required), new Set(['government_work', 'government_funded']));
  assert.equal(gb.additionalProperties, false);
  assert.deepEqual(gb.properties.government_work.type.sort(), ['boolean', 'null']);
  assert.deepEqual(gb.properties.government_funded.type.sort(), ['boolean', 'null']);
});

test('a fully unassessed government_basis ({work: null, funded: null}) validates clean', () => {
  const ok = baseSource();
  const errors = validate(schema.$defs.source, ok, { rootSchema: schema });
  assert.deepEqual(errors, [], `unexpected errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('omitting a required member of `government_basis` (e.g. government_funded) fails validation', () => {
  const bad = baseSource();
  delete bad.license.government_basis.government_funded;
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(
    errors.some((e) => e.path.endsWith('.license.government_basis.government_funded')),
    `expected a government_funded error, got:\n${JSON.stringify(errors, null, 2)}`,
  );
});

test('an unrecognized additional property on `government_basis` is rejected (additionalProperties: false posture preserved)', () => {
  const bad = baseSource();
  bad.license.government_basis.grant_id = 'R01-XYZ';
  const errors = validate(schema.$defs.source, bad, { rootSchema: schema });
  assert.ok(errors.length > 0, 'expected an error for an additional government_basis property');
});

// --- the acceptance criterion in the phase file's own words: the schema's field descriptions -----
// distinguish government_work from government_funded ------------------------------------------

test("the schema's own field descriptions distinguish government_work from government_funded (the phase file's literal acceptance criterion)", () => {
  const gb = schema.$defs.governmentBasis;
  const workDesc = gb.properties.government_work.description;
  const fundedDesc = gb.properties.government_funded.description;
  assert.ok(/17 U\.S\.C\. §105/.test(workDesc), 'government_work description must cite 17 U.S.C. §105');
  assert.ok(/govern(ment|s|ed)? work|federal employees/i.test(workDesc), 'government_work description must describe authorship by the government');
  assert.ok(/fund(ed|ing)/i.test(fundedDesc), 'government_funded description must describe funding, not authorship');
  assert.ok(
    /remains fully copyrighted|never justify|alone/i.test(fundedDesc),
    'government_funded description must state that funding alone does not confer public-domain/government-work status',
  );
  assert.notEqual(workDesc, fundedDesc, 'the two descriptions must not be identical (i.e. one field must not just alias the other)');
});

// --- 2. the acceptance TEST named in the phase file: funding alone cannot mark public domain ------

test('FR-WP2-04 acceptance test: a fixture marking a source public_domain on funding grounds alone (government_funded: true, government_work not true) fails validation', () => {
  const fundedOnly = withLicense({
    status: 'public_domain',
    government_basis: { government_work: null, government_funded: true },
  });
  const errors = validate(schema.$defs.source, fundedOnly, { rootSchema: schema });
  assert.ok(errors.length > 0, 'expected a validation error: public_domain must not rest on government_funded alone');

  const fundedButExplicitlyNotAWork = withLicense({
    status: 'public_domain',
    government_basis: { government_work: false, government_funded: true },
  });
  const errors2 = validate(schema.$defs.source, fundedButExplicitlyNotAWork, { rootSchema: schema });
  assert.ok(errors2.length > 0, 'expected a validation error: government_work: false must not coexist with a funding-justified public_domain claim');
});

test('a fixture marking a source us_federal_government_work while explicitly denying government_work fails validation', () => {
  const contradiction = withLicense({
    status: 'us_federal_government_work',
    government_basis: { government_work: false, government_funded: null },
  });
  const errors = validate(schema.$defs.source, contradiction, { rootSchema: schema });
  assert.ok(errors.length > 0, 'expected a validation error: us_federal_government_work requires government_work: true');

  const unassessed = withLicense({
    status: 'us_federal_government_work',
    government_basis: { government_work: null, government_funded: null },
  });
  const errorsUnassessed = validate(schema.$defs.source, unassessed, { rootSchema: schema });
  assert.ok(errorsUnassessed.length > 0, 'expected a validation error: us_federal_government_work requires government_work: true, not merely non-false');
});

test('a genuinely non-government public_domain claim (no funding assertion) still validates — the invariant blocks the funding-alone route, not public_domain itself', () => {
  const ok = withLicense({
    status: 'public_domain',
    government_basis: { government_work: null, government_funded: null },
  });
  const errors = validate(schema.$defs.source, ok, { rootSchema: schema });
  assert.deepEqual(errors, [], `unexpected errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('us_federal_government_work validates cleanly when government_work: true is actually asserted', () => {
  const ok = withLicense({
    status: 'us_federal_government_work',
    government_basis: { government_work: true, government_funded: null },
  });
  const errors = validate(schema.$defs.source, ok, { rootSchema: schema });
  assert.deepEqual(errors, [], `unexpected errors:\n${JSON.stringify(errors, null, 2)}`);
});

test('the converse case the conflation would get wrong: a government-funded, non-government-work source stays copyrighted, and validates cleanly — proving the fields are independent, not one inferred from the other', () => {
  // The abundant PMC case: an NIH-funded article by a university author. Government-funded, but
  // NOT a government work — copyright is retained by the author/institution.
  const nihFundedPmcArticle = withLicense({
    status: 'copyrighted',
    rights_holder: 'A University Author',
    government_basis: { government_work: false, government_funded: true },
  });
  const errors = validate(schema.$defs.source, nihFundedPmcArticle, { rootSchema: schema });
  assert.deepEqual(errors, [], `unexpected errors:\n${JSON.stringify(errors, null, 2)}`);
});

// --- 3. the real committed CDC2025_LEAD record, and the other 5 sources left unassessed -----------

test('the real committed CDC2025_LEAD source encodes a U.S. federal government work under 17 U.S.C. §105, structurally — not left "unknown"', () => {
  const cdc = evidenceDoc.sources.find((s) => s.id === 'CDC2025_LEAD');
  assert.ok(cdc, 'CDC2025_LEAD must be present');
  assert.equal(cdc.license.status, 'us_federal_government_work');
  assert.notEqual(cdc.license.status, 'public_domain', 'must use the statute-naming status, not the generic public_domain member');
  assert.notEqual(cdc.license.status, 'unknown');
  assert.equal(cdc.license.government_basis.government_work, true);

  const errors = validate(schema.$defs.source, cdc, { rootSchema: schema });
  assert.deepEqual(errors, [], `CDC2025_LEAD must validate: ${JSON.stringify(errors)}`);
});

test('the other 5 sources\' government_basis stays in the explicit "genuinely unassessed" null shape — this task records only the CDC2025_LEAD statutory basis already in the findings, and makes no new legal determination about any other source', () => {
  const others = evidenceDoc.sources.filter((s) => s.id !== 'CDC2025_LEAD');
  assert.equal(others.length, 5);
  for (const source of others) {
    assert.ok(
      Object.hasOwn(source.license, 'government_basis'),
      `${source.id}: government_basis must be present (required field, D2)`,
    );
    assert.equal(source.license.government_basis.government_work, null, `${source.id}: government_basis.government_work`);
    assert.equal(source.license.government_basis.government_funded, null, `${source.id}: government_basis.government_funded`);
  }
});

test('the full evidence document (all 6 sources, including CDC2025_LEAD) validates end-to-end (matches npm run validate)', () => {
  const errors = validate(schema, evidenceDoc);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

test('D6: no CLEARED_*, attestation, or approval vocabulary appears anywhere in the government_basis fields — a statutory copyright fact is not a clearance grant', () => {
  const serialized = JSON.stringify(evidenceDoc.sources.map((s) => ({ status: s.license.status, government_basis: s.license.government_basis })));
  assert.ok(!/CLEARED_/i.test(serialized));
  assert.ok(!/attestation/i.test(serialized));
  assert.ok(!/approved/i.test(serialized));
});
