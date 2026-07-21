// tests/evidence-source-rights-backfill.test.mjs — EPR2-T3 (FR-WP2-03).
//
// Proves the atomic backfill this task performs on the real modules/anemia/evidence.json — not a
// fixture — actually lands, in one commit, for all 6 sources, and that the AAP2026_IDA block is
// machine-readable rather than the prose-only record it replaces:
//   - Every one of the 6 committed sources validates against schemas/evidence.schema.json's
//     `$defs/source` (EPR2-T1/EPR2-T2's `license`/`access_basis`/`terms`/`terms_snapshot`).
//   - AAP2026_IDA specifically encodes a non-commercial, non-incorporable access basis as
//     STRUCTURED FIELDS: `access_basis` is a subscription-shaped enum member (never "unknown" —
//     the whole point of this task, per findings §1 [S5]-confirmed and the vendored spec's
//     Appendix A), `terms.commercial_use` is `not_granted_by_subscription`, and
//     `terms.incorporation_into_other_products` / `terms.adaptation` are restrictive
//     (never `allowed` / `not_addressed` / `unknown`) — never a free-text note standing in for
//     these facts.
//   - The 5 other sources (CDC2025_LEAD included — its government-work/government-funded
//     distinction is EPR2-T4's job, not this one) are left in the same explicit, typed
//     "genuinely unassessed" `unknown` shape the rights/ ledger's own triage-only records already
//     carry (rights/rights-records.json) — D2: never a convenient invented certainty.
//   - No `CLEARED_*`/attestation/approval vocabulary is introduced anywhere on this surface (D6).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = new URL('../', import.meta.url);

const ALL_SOURCE_IDS = [
  'AAP2026_IDA',
  'WHO2024_HB',
  'BLOOD2022_PED_ANEMIA',
  'CDC2025_LEAD',
  'FDA2026_CDS',
  'BSH2020_G6PD',
];

let schema;
let evidenceDoc;

test('fixtures load: schemas/evidence.schema.json and modules/anemia/evidence.json', async () => {
  schema = JSON.parse(await readFile(new URL('schemas/evidence.schema.json', REPO_ROOT), 'utf8'));
  evidenceDoc = JSON.parse(await readFile(new URL('modules/anemia/evidence.json', REPO_ROOT), 'utf8'));
  assert.ok(Array.isArray(evidenceDoc.sources) && evidenceDoc.sources.length === 6);
});

test('all 6 sources are present and every one validates against $defs/source (the atomic backfill)', () => {
  const ids = evidenceDoc.sources.map((s) => s.id);
  assert.deepEqual(ids.sort(), [...ALL_SOURCE_IDS].sort());
  for (const source of evidenceDoc.sources) {
    const errors = validate(schema.$defs.source, source, { rootSchema: schema });
    assert.deepEqual(errors, [], `${source.id}: ${JSON.stringify(errors)}`);
  }
});

test('the full evidence document validates end-to-end (matches npm run validate)', () => {
  const errors = validate(schema, evidenceDoc);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

test('AAP2026_IDA: access_basis is a structured subscription-shaped fact, never "unknown"', () => {
  const aap = evidenceDoc.sources.find((s) => s.id === 'AAP2026_IDA');
  assert.ok(aap, 'AAP2026_IDA must be present');
  assert.equal(
    aap.access_basis,
    'institutional_subscription',
    'AAP2026_IDA access_basis must be encoded as a subscription-shaped enum member (findings §1 [S5], vendored spec Appendix A) — not left "unknown"',
  );
});

test('AAP2026_IDA: terms encode non-commercial, non-incorporable, non-adaptable restrictions as structured fields, not a free-text note', () => {
  const aap = evidenceDoc.sources.find((s) => s.id === 'AAP2026_IDA');
  assert.equal(aap.terms.commercial_use, 'not_granted_by_subscription');
  assert.notEqual(aap.terms.commercial_use, 'allowed');
  assert.notEqual(aap.terms.commercial_use, 'unknown');

  assert.equal(aap.terms.incorporation_into_other_products, 'restricted_without_written_approval');
  assert.notEqual(aap.terms.incorporation_into_other_products, 'allowed');
  assert.notEqual(aap.terms.incorporation_into_other_products, 'not_addressed');
  assert.notEqual(aap.terms.incorporation_into_other_products, 'unknown');

  assert.equal(aap.terms.adaptation, 'restricted_without_written_approval');
  assert.notEqual(aap.terms.adaptation, 'allowed');
  assert.notEqual(aap.terms.adaptation, 'unknown');

  assert.equal(aap.terms.redistribution, 'restricted');

  // `terms` has no free-text member capable of holding this restriction as prose (D1) — every
  // member is one of the closed enum strings above; the object below is JSON, not a note field.
  for (const value of Object.values(aap.terms)) {
    assert.equal(typeof value, 'string');
  }
});

test('AAP2026_IDA: terms_snapshot records no terms document was independently captured (locator-only, D1) and no terms prose appears anywhere on the source record', () => {
  const aap = evidenceDoc.sources.find((s) => s.id === 'AAP2026_IDA');
  assert.equal(aap.terms_snapshot.status, 'not_captured');
  assert.equal(aap.terms_snapshot.locator, null);
  assert.equal(aap.terms_snapshot.sha256, null);
  assert.equal(aap.terms_snapshot.retrieved_at, null);

  // No value on these three objects is longer than a short enum token/URL/hash/date — nothing here
  // is a paragraph of terms prose.
  const allStrings = [
    aap.license.status, aap.license.rights_holder,
    ...Object.values(aap.terms),
    aap.terms_snapshot.status,
  ].filter((v) => typeof v === 'string');
  for (const s of allStrings) {
    assert.ok(s.length < 80, `unexpectedly long string value on AAP2026_IDA rights-metadata surface: "${s}"`);
  }
});

test('the 4 non-AAP, non-CDC sources stay in the explicit "genuinely unassessed" unknown shape — CDC2025_LEAD is now excluded here because EPR2-T4 (FR-WP2-04) has landed its government-work encoding; see tests/evidence-source-government-basis.test.mjs for that source\'s dedicated coverage', () => {
  const stillUnknown = evidenceDoc.sources.filter((s) => s.id !== 'AAP2026_IDA' && s.id !== 'CDC2025_LEAD');
  assert.equal(stillUnknown.length, 4);
  for (const source of stillUnknown) {
    assert.equal(source.access_basis, 'unknown', `${source.id}: access_basis`);
    assert.equal(source.license.status, 'unknown', `${source.id}: license.status`);
    for (const [key, value] of Object.entries(source.terms)) {
      assert.equal(value, 'unknown', `${source.id}: terms.${key}`);
    }
    assert.equal(source.terms_snapshot.status, 'not_captured', `${source.id}: terms_snapshot.status`);
  }
});

test('D6: no CLEARED_*, attestation, or approval vocabulary appears anywhere in the new rights-metadata fields', async () => {
  const serialized = JSON.stringify(
    evidenceDoc.sources.map((s) => ({
      license: s.license,
      access_basis: s.access_basis,
      terms: s.terms,
      terms_snapshot: s.terms_snapshot,
    })),
  );
  assert.ok(!/CLEARED_/i.test(serialized));
  assert.ok(!/attestation/i.test(serialized));
  assert.ok(!/approved/i.test(serialized));
});
