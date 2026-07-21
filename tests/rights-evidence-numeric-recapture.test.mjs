// tests/rights-evidence-numeric-recapture.test.mjs — EPR3-T6 (FR-WP3-05, AC-WP3-NUMERICS; D1, D7).
//
// Proves the numerics re-capture is in place and enforced across the two layers it is split over:
//
//   SCHEMA (schemas/evidence.schema.json, validated by scripts/validate-kb.mjs) owns the SHAPE — the
//   optional `numeric_recapture` object, its two-state `resolution` enum, the atoms-present-iff-
//   per_value_atoms allOf, and the per-value `numericAtom` (value + unit + the three taxonomy axes +
//   a component-addressable structured_locator + not_captured, with judgment_basis_attestation forced
//   null, D6).
//
//   GATE (checkNumericRecaptureResolution in scripts/lib/evidence-numeric-recapture-gate.mjs,
//   registered in scripts/validate-rights.mjs and run by `npm run validate`) owns the COVERAGE JSON
//   Schema cannot express: that every in-scope numeric-omission passage CARRIES a resolution at all
//   — resolves to per_value_atoms or no_reported_value_available, never to neither — plus the
//   resolution/atoms consistency.
//
// AC-WP3-NUMERICS, restated: each in-scope passage resolves to state (a) or (b); no reproduced table
// exists in any form (the table structure stays named in not_captured — asserted by EPR3-T1's
// negative invariant and EPR3-T4's locator gate, not re-litigated here); every captured value is the
// source's reported value; partial capture records the uncaptured facets explicitly.
//
// D7: this gate is coverage/consistency-shaped. A `no_reported_value_available` resolution is a valid
// outcome, not a failure — the negative test below pins that a state-(b) passage passes cleanly.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import {
  checkNumericRecaptureResolution,
  OMITS_NUMERICS_FLAG,
  AUDIT_NAMED_NUMERIC_OMISSION_PASSAGES,
} from '../scripts/lib/evidence-numeric-recapture-gate.mjs';
import { GATES, loadRightsContext } from '../scripts/validate-rights.mjs';

const REPO_ROOT = new URL('../', import.meta.url);
const ROOT_PATH = fileURLToPath(REPO_ROOT);

let schema;
let evidence;

test('fixtures load: schema defines $defs/numericRecapture and $defs/numericAtom; evidence.json parses', async () => {
  schema = JSON.parse(await readFile(new URL('schemas/evidence.schema.json', REPO_ROOT), 'utf8'));
  evidence = JSON.parse(await readFile(new URL('modules/anemia/evidence.json', REPO_ROOT), 'utf8'));
  assert.ok(schema.$defs.numericRecapture, 'schema must define $defs/numericRecapture');
  assert.ok(schema.$defs.numericAtom, 'schema must define $defs/numericAtom');
  assert.ok(schema.$defs.passage.properties.numeric_recapture, 'the passage record must carry an optional numeric_recapture property');
});

// A schema-valid per-value atom (state a) at the WHO band-unresolved coordinate.
function atom(overrides = {}) {
  return {
    label: 'An independently-worded description of one reported value.',
    value: '<105 g/L',
    unit: 'g/L',
    evidence_item_type: 'reference_interval_value',
    rights_component_class: 'reference_interval_values',
    judgment_basis: 'unassessed',
    judgment_basis_attestation: null,
    structured_locator: {
      source: 'WHO2024_HB',
      edition_or_version: '2024 guideline',
      section: 'Executive summary',
      table: 'Table 2',
      row: null,
      column: null,
      assay_or_method: 'haemoglobin concentration',
      population_or_scope: 'children 6 mo-14 y; band unresolved',
      retrieved_at: '2026-07-18',
      unresolved_components: ['row', 'column'],
    },
    not_captured: [
      { kind: 'table_structure', rationale: 'per-value atom captured; table layout not stored (D1).' },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------------
// LAYER 1 — schema shape
// ---------------------------------------------------------------------------------------------

test('schema: a per_value_atoms recapture with >= 1 well-formed atom validates', () => {
  const recapture = { resolution: 'per_value_atoms', reason: 'four cutoffs transcribed', atoms: [atom()] };
  assert.deepEqual(validate(schema.$defs.numericRecapture, recapture, { rootSchema: schema }), []);
});

test('schema: a no_reported_value_available recapture with empty atoms validates', () => {
  const recapture = { resolution: 'no_reported_value_available', reason: 'no reported value in provenance', atoms: [] };
  assert.deepEqual(validate(schema.$defs.numericRecapture, recapture, { rootSchema: schema }), []);
});

test('schema: per_value_atoms with zero atoms is UNREPRESENTABLE (a state (a) that captured nothing)', () => {
  const recapture = { resolution: 'per_value_atoms', reason: 'x', atoms: [] };
  assert.notEqual(validate(schema.$defs.numericRecapture, recapture, { rootSchema: schema }).length, 0);
});

test('schema: no_reported_value_available carrying an atom is UNREPRESENTABLE (mislabelled state (a))', () => {
  const recapture = { resolution: 'no_reported_value_available', reason: 'x', atoms: [atom()] };
  assert.notEqual(validate(schema.$defs.numericRecapture, recapture, { rootSchema: schema }).length, 0);
});

test('schema: an unrecognised resolution fails (closed enum — there is no third state)', () => {
  const recapture = { resolution: 'partial', reason: 'x', atoms: [] };
  assert.notEqual(validate(schema.$defs.numericRecapture, recapture, { rootSchema: schema }).length, 0);
});

test('D6: an atom cannot carry a non-null judgment_basis_attestation, and cannot leave judgment_basis unassessed without one', () => {
  assert.notEqual(
    validate(schema.$defs.numericAtom, atom({ judgment_basis_attestation: { attested_by: 'x', attestation_ref: 'y', attested_on: '2026-07-18' } }), { rootSchema: schema }).length,
    0,
    'judgment_basis_attestation is const null — no attestation may be agent-authored',
  );
  assert.notEqual(
    validate(schema.$defs.numericAtom, atom({ judgment_basis: 'measured_or_observed' }), { rootSchema: schema }).length,
    0,
    'a non-unassessed judgment_basis with a null attestation is structurally unreachable',
  );
});

// ---------------------------------------------------------------------------------------------
// LAYER 2 — the coverage gate
// ---------------------------------------------------------------------------------------------

const ctx = (passages) => ({ evidencePassages: passages.map((passage) => ({ moduleId: 'anemia', sourceId: passage.sourceId ?? null, passage })) });

test('gate: the gate is registered in the exported GATES list under its stable id', () => {
  const gate = GATES.find((g) => g.id === 'evidence-numeric-recapture-resolution');
  assert.ok(gate, 'evidence-numeric-recapture-resolution must be a registered gate');
  assert.equal(gate.run, checkNumericRecaptureResolution);
});

test('gate COVERAGE: an in-scope (omits-source-numerics) passage with no numeric_recapture fails', () => {
  const { errors } = checkNumericRecaptureResolution(ctx([
    { id: 'WHO2024_HB#ev_009', sourceId: 'WHO2024_HB', reviewFlags: [OMITS_NUMERICS_FLAG] },
  ]));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /WHO2024_HB#ev_009/);
  assert.match(errors[0], /never to neither/);
});

test('gate COVERAGE: an audit-named passage with no numeric_recapture fails even without the flag', () => {
  const named = AUDIT_NAMED_NUMERIC_OMISSION_PASSAGES[0];
  const { errors } = checkNumericRecaptureResolution(ctx([
    { id: named, sourceId: named.split('#')[0], reviewFlags: ['adds-claim-not-in-located-passage'] },
  ]));
  assert.equal(errors.length, 1);
  assert.match(errors[0], new RegExp(named.replace(/[#]/g, '\\#')));
});

test('gate: both valid resolutions pass — a state-(b) not-captured record is a valid outcome, never a failure (D7)', () => {
  const stateA = { id: 'S#ev_001', sourceId: 'S', reviewFlags: [OMITS_NUMERICS_FLAG], numeric_recapture: { resolution: 'per_value_atoms', reason: 'x', atoms: [atom()] } };
  const stateB = { id: 'S#ev_002', sourceId: 'S', reviewFlags: [OMITS_NUMERICS_FLAG], numeric_recapture: { resolution: 'no_reported_value_available', reason: 'x', atoms: [] } };
  assert.deepEqual(checkNumericRecaptureResolution(ctx([stateA, stateB])).errors, []);
});

test('gate CONSISTENCY: per_value_atoms with zero atoms, or an atom missing its value, fails', () => {
  const empty = { id: 'S#ev_003', sourceId: 'S', reviewFlags: [OMITS_NUMERICS_FLAG], numeric_recapture: { resolution: 'per_value_atoms', reason: 'x', atoms: [] } };
  assert.match(checkNumericRecaptureResolution(ctx([empty])).errors[0], /captured zero atoms/);

  const noValue = { id: 'S#ev_004', sourceId: 'S', reviewFlags: [OMITS_NUMERICS_FLAG], numeric_recapture: { resolution: 'per_value_atoms', reason: 'x', atoms: [atom({ value: '   ' })] } };
  assert.match(checkNumericRecaptureResolution(ctx([noValue])).errors[0], /carries no reported/);
});

test('gate CONSISTENCY: no_reported_value_available carrying atoms fails', () => {
  const bad = { id: 'S#ev_005', sourceId: 'S', reviewFlags: [OMITS_NUMERICS_FLAG], numeric_recapture: { resolution: 'no_reported_value_available', reason: 'x', atoms: [atom()] } };
  assert.match(checkNumericRecaptureResolution(ctx([bad])).errors[0], /mislabelled/);
});

test('gate: a passage NOT in scope and carrying no recapture is clean (this is not a blanket requirement)', () => {
  assert.deepEqual(checkNumericRecaptureResolution(ctx([
    { id: 'S#ev_010', sourceId: 'S', reviewFlags: [] },
  ])).errors, []);
});

// ---------------------------------------------------------------------------------------------
// LAYER 3 — over the real committed corpus
// ---------------------------------------------------------------------------------------------

test('AC-WP3-NUMERICS: every in-scope passage in the committed evidence.json resolves — the gate is clean over real data', async () => {
  const context = await loadRightsContext(ROOT_PATH);
  assert.deepEqual(checkNumericRecaptureResolution(context).errors, []);
});

test('AC-WP3-NUMERICS: the four in-scope passages are exactly the ones carrying numeric_recapture, and each resolves to a valid state', () => {
  const passages = evidence.sources.flatMap((s) => s.passages ?? []);
  const withRecapture = passages.filter((p) => p.numeric_recapture).map((p) => p.id).sort();
  assert.deepEqual(withRecapture, [
    'AAP2026_IDA#ev_002',
    'BSH2020_G6PD#ev_006',
    'WHO2024_HB#ev_001',
    'WHO2024_HB#ev_004',
  ], 'the union of omits-source-numerics passages and the audit-named AAP case (EPR3-T6 scope)');

  // Every omits-source-numerics passage is covered (none resolves to neither).
  for (const p of passages) {
    if ((p.reviewFlags ?? []).includes(OMITS_NUMERICS_FLAG)) {
      assert.ok(p.numeric_recapture, `${p.id} is flagged ${OMITS_NUMERICS_FLAG} but carries no numeric_recapture resolution`);
    }
  }

  // Exactly one resolves to atoms (WHO band cutoffs), the other three to explicit not-captured.
  const byId = new Map(passages.filter((p) => p.numeric_recapture).map((p) => [p.id, p.numeric_recapture]));
  assert.equal(byId.get('WHO2024_HB#ev_001').resolution, 'per_value_atoms');
  assert.equal(byId.get('WHO2024_HB#ev_001').atoms.length, 4);
  for (const id of ['WHO2024_HB#ev_004', 'BSH2020_G6PD#ev_006', 'AAP2026_IDA#ev_002']) {
    assert.equal(byId.get(id).resolution, 'no_reported_value_available');
    assert.equal(byId.get(id).atoms.length, 0);
  }
});

test('D1: every captured atom carries the omitted table_structure in its not_captured — no reproduced table', () => {
  const passages = evidence.sources.flatMap((s) => s.passages ?? []);
  const atoms = passages.flatMap((p) => p.numeric_recapture?.atoms ?? []);
  assert.ok(atoms.length > 0, 'expected the WHO band cutoffs to be captured as atoms');
  for (const a of atoms) {
    assert.ok(
      (a.not_captured ?? []).some((n) => n.kind === 'table_structure'),
      `atom "${a.value}" must name the omitted table_structure — the value is captured, the table is not`,
    );
    // The captured value is a transcribed reported value, not authored: it is a non-empty scalar.
    assert.equal(typeof a.value, 'string');
    assert.ok(a.value.trim().length > 0);
  }
});
