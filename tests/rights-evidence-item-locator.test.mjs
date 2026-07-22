// tests/rights-evidence-item-locator.test.mjs — EPR3-T4 (FR-WP3-04, FR-WP3-06; D1, D2, D7).
//
// Proves the structured-locator model and `not_captured[]` are in place and enforced across the two
// layers they are split over:
//
//   SCHEMA (schemas/evidence.schema.json, validated by scripts/validate-kb.mjs) owns PRESENCE and
//   SHAPE — every passage must carry a `structured_locator` (a component-addressable object with no
//   free-text catch-all) and a `not_captured[]` (non-empty on every located record; `{kind,rationale}`
//   entries over a closed omission vocabulary).
//
//   GATE (checkEvidenceItemLocatorCapture in scripts/validate-rights.mjs, run by `npm run validate`)
//   owns the CROSS-FIELD SEMANTICS JSON Schema cannot express — a component may not be both valued and
//   listed unresolved; a table-derived item must address table/row/column individually rather than
//   collapse them; a table-derived item must name the omitted `table_structure`. The gate is a no-op
//   over records that do not yet carry the fields, which is what keeps it clean over the real,
//   not-yet-backfilled evidence.json during the EPR3-T5 migration window.
//
// This file, like tests/rights-evidence-item-axes.test.mjs, does NOT require modules/anemia/evidence.json
// to carry the new fields yet: EPR3-T5 backfills the 41 committed passages. Until then `npm run
// validate` reports the expected "required property is missing" errors — the intended shape of the
// schema-first migration, not a regression introduced here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { checkEvidenceItemLocatorCapture, GATES } from '../scripts/validate-rights.mjs';

const REPO_ROOT = new URL('../', import.meta.url);

let schema;

test('fixtures load: schemas/evidence.schema.json defines $defs/structuredLocator and $defs/notCaptured', async () => {
  schema = JSON.parse(await readFile(new URL('schemas/evidence.schema.json', REPO_ROOT), 'utf8'));
  assert.ok(schema.$defs.structuredLocator, 'schema must define $defs/structuredLocator');
  assert.ok(schema.$defs.notCaptured, 'schema must define $defs/notCaptured');
});

// A schema-complete passage carrying legal EPR3-T2 axis values AND a well-formed structured_locator
// and not_captured. Hand-authored (the KB is backfilled by EPR3-T5).
function basePassage(overrides = {}) {
  return {
    id: 'FAKE_SRC#ev_001',
    sourceId: 'FAKE_SRC',
    status: 'source-supported',
    sourceLocator: { raw: 'p. 1, Table 2', page: '1', section: null, table: '2', figure: null },
    exactPassage: 'A located value, restated independently.',
    passageFidelity: 'paraphrase',
    reviewFlags: [],
    reviewFindingIds: [],
    evidenceGrade: 'source-supported-fact',
    applicability: { age: null, sex: null, assay: null },
    reviewDate: '2026-07-21',
    supersedes: null,
    surveillanceQuery: 'q',
    provenance: { runId: 'r', sourceCardId: 's', evidenceId: 'ev_001' },
    evidence_item_type: 'reference_interval_value',
    judgment_basis: 'unassessed',
    judgment_basis_attestation: null,
    rights_component_class: 'table',
    structured_locator: {
      source: 'FAKE_SRC',
      edition_or_version: null,
      section: null,
      table: 'Table 2',
      row: 'Hb, 6-24 mo',
      column: 'Lower limit (g/dL)',
      assay_or_method: null,
      population_or_scope: null,
      retrieved_at: '2026-07-20',
      unresolved_components: [],
    },
    not_captured: [{ kind: 'table_structure', rationale: 'per-value atom captured; table layout not stored' }],
    ...overrides,
  };
}

function errorsFor(passage) {
  return validate(schema.$defs.passage, passage, { rootSchema: schema });
}

// --- SCHEMA layer: presence + shape ---------------------------------------------------------------

test('FR-WP3-04/06: a passage carrying a well-formed structured_locator and not_captured validates clean', () => {
  assert.deepEqual(errorsFor(basePassage()), []);
});

test('FR-WP3-04/06 (D2): structured_locator and not_captured are each REQUIRED — omitting either fails', () => {
  for (const field of ['structured_locator', 'not_captured']) {
    const passage = basePassage();
    delete passage[field];
    const errors = errorsFor(passage);
    assert.notEqual(errors.length, 0, `omitting ${field} must fail validation`);
    assert.ok(
      errors.some((e) => `${e.path} ${e.message}`.includes(field)),
      `the failure for a missing ${field} must name it, got ${JSON.stringify(errors)}`,
    );
  }
});

test('FR-WP3-04: every structured_locator component is an INDIVIDUALLY addressable field, and there is NO free-text catch-all (no `raw`, unlike the EP-3 sourceLocator)', () => {
  const props = schema.$defs.structuredLocator.properties;
  for (const component of ['source', 'edition_or_version', 'section', 'table', 'row', 'column', 'assay_or_method', 'population_or_scope', 'retrieved_at']) {
    assert.ok(props[component], `structured_locator must expose "${component}" as its own field`);
  }
  assert.equal(props.raw, undefined, 'structured_locator must NOT carry a free-text `raw` member — that would allow a collapsed locator (FR-WP3-04)');
  assert.equal(schema.$defs.structuredLocator.additionalProperties, false, 'structured_locator is a closed object');
  // `source` is always present/non-null; the others are nullable (not-applicable) per D2.
  assert.deepEqual(props.source.type, 'string');
  for (const nullable of ['edition_or_version', 'section', 'table', 'row', 'column', 'assay_or_method', 'population_or_scope', 'retrieved_at']) {
    assert.ok(Array.isArray(props[nullable].type) && props[nullable].type.includes('null'),
      `${nullable} must be nullable (a not-applicable component is an explicit null, D2)`);
  }
});

test('FR-WP3-04 (FR-WP0-08): no `format: "uri"` anywhere on structured_locator — json-schema-lite would ignore it silently; retrieved_at uses the enforced `date` format', () => {
  const text = JSON.stringify(schema.$defs.structuredLocator);
  assert.ok(!text.includes('"uri"'), 'no format:"uri" may appear');
  assert.equal(schema.$defs.structuredLocator.properties.retrieved_at.format, 'date');
});

test('FR-WP3-06: not_captured entries require both kind and rationale, over a closed omission vocabulary', () => {
  // Missing rationale fails.
  assert.notEqual(errorsFor(basePassage({ not_captured: [{ kind: 'table_structure' }] })).length, 0);
  // Missing kind fails.
  assert.notEqual(errorsFor(basePassage({ not_captured: [{ rationale: 'because' }] })).length, 0);
  // Unrecognised kind fails (closed enum).
  assert.notEqual(errorsFor(basePassage({ not_captured: [{ kind: 'the_whole_pdf', rationale: 'x' }] })).length, 0);
  // Empty-string rationale fails (minLength).
  assert.notEqual(errorsFor(basePassage({ not_captured: [{ kind: 'prose', rationale: '' }] })).length, 0);
  // A legal entry validates.
  assert.deepEqual(errorsFor(basePassage({ not_captured: [{ kind: 'verbatim_wording', rationale: 'paraphrased; exact wording withheld' }] })), []);
});

test('FR-WP3-06: not_captured[] must be NON-EMPTY on a located record, but the implementation-proposal sentinel is exempt (it captured nothing)', () => {
  // Located record with empty not_captured fails.
  assert.notEqual(errorsFor(basePassage({ not_captured: [] })).length, 0);

  // The implementation-proposal sentinel legitimately carries an empty not_captured.
  const sentinel = basePassage({
    id: 'FAKE_SRC#implementation-proposal',
    status: 'implementation-proposal',
    exactPassage: '',
    evidenceGrade: null,
    not_captured: [],
  });
  delete sentinel.applicability; // sentinel exemption (pre-existing rule)
  assert.deepEqual(errorsFor(sentinel), [], `sentinel with empty not_captured must validate, got ${JSON.stringify(errorsFor(sentinel))}`);
});

test('D2: the not_captured non-empty clause couples only `status` and `not_captured` — it does NOT reference any taxonomy axis field (no axis inference)', () => {
  const axisFields = ['evidence_item_type', 'rights_component_class', 'judgment_basis'];
  const offenders = [];
  for (const clause of schema.$defs.passage.allOf) {
    const text = JSON.stringify({ if: clause.if, then: clause.then, else: clause.else });
    if (!text.includes('not_captured')) continue;
    const mentioned = axisFields.filter((f) => text.includes(`"${f}"`));
    if (mentioned.length > 0) offenders.push(mentioned.join('+'));
  }
  assert.deepEqual(offenders, [], 'a not_captured clause must not reference any taxonomy axis field (D2)');
});

// --- GATE layer: cross-field semantics ------------------------------------------------------------

function gateErrors(passage) {
  return checkEvidenceItemLocatorCapture({ evidencePassages: [{ moduleId: 'anemia', sourceId: passage.sourceId, passage }] }).errors;
}

test('the gate is registered in the single exported GATES list with a stable id', () => {
  const gate = GATES.find((g) => g.id === 'evidence-item-locator-capture');
  assert.ok(gate, 'evidence-item-locator-capture must be a registered gate');
  assert.equal(typeof gate.run, 'function');
});

test('gate rule 1: a structured_locator component that is BOTH valued AND listed unresolved fails (silent partial masquerading as complete)', () => {
  const passage = basePassage();
  passage.structured_locator.section = 'Screening';
  passage.structured_locator.unresolved_components = ['section'];
  const errors = gateErrors(passage);
  assert.ok(errors.some((e) => e.includes('unresolved') && e.includes('section')), errors.join('\n'));
});

test('gate rule 2: a table-derived item that leaves table/row/column SILENTLY NULL fails (the collapsed-locator failure, FR-WP3-04)', () => {
  // Simulate collapsing "Table 2 / Hb row / lower-limit column" into `section` prose while nulling
  // the addressable components and NOT declaring them unresolved.
  const collapsed = basePassage();
  collapsed.structured_locator = {
    source: 'FAKE_SRC',
    edition_or_version: null,
    section: 'Table 2, Hb 6-24 mo row, lower-limit column',
    table: null,
    row: null,
    column: null,
    assay_or_method: null,
    population_or_scope: null,
    retrieved_at: '2026-07-20',
    unresolved_components: [],
  };
  const errors = gateErrors(collapsed);
  assert.equal(errors.filter((e) => e.includes('silently null')).length, 3, `each of table/row/column must be flagged, got:\n${errors.join('\n')}`);
});

test('gate rule 2: a table-derived item that ADDRESSES table/row/column individually passes', () => {
  assert.deepEqual(gateErrors(basePassage()), []);
});

test('gate rule 2: a table-derived item that lists an un-addressable component in unresolved_components passes (explicit incompleteness is allowed; silence is not)', () => {
  const partial = basePassage();
  partial.structured_locator.column = null;
  partial.structured_locator.unresolved_components = ['column'];
  assert.deepEqual(gateErrors(partial), [], 'declaring column unresolved must satisfy the gate');
});

test('gate rule 2: `reference_interval_value` triggers table-derived even when rights_component_class is NOT `table` (the trigger spans both axes)', () => {
  const p = basePassage({ rights_component_class: 'reference_interval_values' });
  p.structured_locator.table = null;
  p.structured_locator.row = null;
  p.structured_locator.column = null;
  p.structured_locator.unresolved_components = [];
  assert.notEqual(gateErrors(p).length, 0, 'reference_interval_value alone must make table/row/column addressing mandatory');
});

test('gate rule 3: a table-derived item whose not_captured[] does not name `table_structure` fails', () => {
  const p = basePassage({ not_captured: [{ kind: 'verbatim_wording', rationale: 'paraphrased' }] });
  const errors = gateErrors(p);
  assert.ok(errors.some((e) => e.includes('table_structure')), errors.join('\n'));
});

test('gate rule 3: a NON-table-derived item is not required to name table_structure', () => {
  const prose = basePassage({
    evidence_item_type: 'observed_finding',
    rights_component_class: 'prose',
    not_captured: [{ kind: 'verbatim_wording', rationale: 'paraphrased; exact wording withheld' }],
  });
  // prose is not table-derived, so table/row/column may be null and no table_structure is required.
  prose.structured_locator.table = null;
  prose.structured_locator.row = null;
  prose.structured_locator.column = null;
  assert.deepEqual(gateErrors(prose), []);
});

test('gate is a no-op over records that do not yet carry the fields (the EPR3-T5 migration window stays clean)', () => {
  const legacy = basePassage();
  delete legacy.structured_locator;
  delete legacy.not_captured;
  assert.deepEqual(gateErrors(legacy), [], 'a not-yet-backfilled record is a SCHEMA failure, not this gate\'s to re-report');
});

test('D7 + determinism: the gate reads no rights-authority field, and two runs over the same input are byte-identical', () => {
  // A passage whose joined rights disposition would be PROHIBITED changes nothing here: this gate
  // never sees overall_status (it is not a passage field) and only inspects capture consistency.
  const clean = basePassage();
  const first = checkEvidenceItemLocatorCapture({ evidencePassages: [{ passage: clean }] });
  const second = checkEvidenceItemLocatorCapture({ evidencePassages: [{ passage: clean }] });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first.errors, []);

  // Structural D7 proof: the gate's source names no rights-authority field.
  const gateSource = checkEvidenceItemLocatorCapture.toString();
  for (const forbidden of ['overall_status', 'review_status', 'release_gate', 'clearance']) {
    assert.ok(!gateSource.includes(forbidden), `the gate must not read "${forbidden}" — it is coverage/consistency shaped (D7)`);
  }
});

test('the gate fails closed on a missing/empty evidencePassages bag rather than throwing', () => {
  assert.deepEqual(checkEvidenceItemLocatorCapture({}).errors, []);
  assert.deepEqual(checkEvidenceItemLocatorCapture({ evidencePassages: [] }).errors, []);
});
