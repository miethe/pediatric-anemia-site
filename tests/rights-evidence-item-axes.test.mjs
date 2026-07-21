// tests/rights-evidence-item-axes.test.mjs — EPR3-T2 (FR-WP3-01, FR-WP3-02, FR-WP3-03; D2, D6).
//
// Proves schemas/evidence.schema.json's `$defs/passage` now carries the three orthogonal,
// REQUIRED axis fields of the evidence-item taxonomy, plus the forced-null attestation that
// gates the third:
//   - `evidence_item_type` — closed 7-member enum; an unrecognised value fails; omission fails.
//   - `rights_component_class` — valued from schemas/rights/rights_record.schema.json's
//     `component_decisions[].component_type` ENUM (RF handoff §9.2 declares the enum
//     authoritative over the spec's §5.1 prose table), copied rather than `$ref`'d (FR-WP3-11).
//   - `judgment_basis` — `unassessed` today, always; any other value requires a human
//     attestation record, which `judgment_basis_attestation`'s `const: null` makes structurally
//     unreachable in this schema version (OQ-1 routes to counsel; no agent may resolve it).
//   - The three axes are declared SEPARATELY: no `if`/`then`, `const`, or shared `$ref` in the
//     schema derives any one of them from another (D2). The full pairwise-representability proof
//     is EPR3-T3's (tests/rights-axis-separation.test.mjs); this file asserts the structural
//     non-derivation that makes it possible.
//
// This file deliberately does NOT require modules/anemia/evidence.json to carry the new fields:
// per the phase's atomic-migration sequencing (schema-first, then mechanical backfill, then
// validate — the same shape EPR2-T1/EPR2-T3 used, and the sequencing recorded in
// docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1/
// phase-r3-evidence-taxonomy.md), the committed 41 passage records are backfilled by EPR3-T5,
// not by this task. Until EPR3-T5 lands, `npm run validate` and the schema cases in
// tests/evidence-passages.test.mjs report the expected "required property is missing" errors on
// all 41 records — that is the intended shape of the migration, not a regression introduced here.
// What this file DOES assert against the real KB is the D6 direction: nothing in the committed
// evidence.json carries a non-`unassessed` `judgment_basis` or a non-null attestation, now or
// after EPR3-T5 backfills.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = new URL('../', import.meta.url);
const SCHEMA_PATH = 'schemas/evidence.schema.json';

let schema;
let rightsRecordSchema;
let evidenceDoc;

test('fixtures load: schemas/evidence.schema.json, schemas/rights/rights_record.schema.json, modules/anemia/evidence.json', async () => {
  schema = JSON.parse(await readFile(new URL(SCHEMA_PATH, REPO_ROOT), 'utf8'));
  rightsRecordSchema = JSON.parse(await readFile(new URL('schemas/rights/rights_record.schema.json', REPO_ROOT), 'utf8'));
  evidenceDoc = JSON.parse(await readFile(new URL('modules/anemia/evidence.json', REPO_ROOT), 'utf8'));
  assert.ok(schema.$defs.passage, 'schema must define $defs/passage');
  assert.ok(schema.$defs.evidenceItemType, 'schema must define $defs/evidenceItemType');
  assert.ok(schema.$defs.judgmentBasis, 'schema must define $defs/judgmentBasis');
  assert.ok(schema.$defs.judgmentBasisAttestation, 'schema must define $defs/judgmentBasisAttestation');
  assert.ok(schema.$defs.rightsComponentClass, 'schema must define $defs/rightsComponentClass');
});

// A structurally complete passage record carrying the EPR3-T2 axis fields at their
// this-feature-legal values. Hand-authored rather than drawn from the KB, because the KB is
// backfilled by EPR3-T5 (see the header note).
function basePassage(overrides = {}) {
  return {
    id: 'FAKE_SRC#ev_001',
    sourceId: 'FAKE_SRC',
    status: 'source-supported',
    sourceLocator: { raw: 'p. 1, Table 2', page: '1', section: null, table: '2', figure: null },
    exactPassage: 'Something located, restated independently.',
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
    ...overrides,
  };
}

function errorsFor(passage) {
  return validate(schema.$defs.passage, passage, { rootSchema: schema });
}

test('FR-WP3-01/02/03: a record carrying all three axis fields at their legal values validates clean', () => {
  assert.deepEqual(errorsFor(basePassage()), []);
});

test('FR-WP3-01/02/03 (D2): each of the three axis fields is REQUIRED — omitting any one fails validation (omission is never a legitimate way to express "unclassified")', () => {
  for (const field of ['evidence_item_type', 'judgment_basis', 'rights_component_class', 'judgment_basis_attestation']) {
    const passage = basePassage();
    delete passage[field];
    const errors = errorsFor(passage);
    assert.notEqual(errors.length, 0, `omitting ${field} must fail validation`);
    assert.ok(
      errors.some((error) => `${error.path} ${error.message}`.includes(field)),
      `the failure for a missing ${field} must name that field, got ${JSON.stringify(errors)}`,
    );
  }
});

test('FR-WP3-01: evidence_item_type is the closed 7-member enum, and an unrecognised value fails', () => {
  assert.deepEqual(schema.$defs.evidenceItemType.enum, [
    'observed_finding',
    'reference_interval_value',
    'equation_or_method',
    'guideline_recommendation',
    'instrument_or_questionnaire',
    'bibliographic_metadata',
    'derived_synthesis',
  ]);

  for (const value of schema.$defs.evidenceItemType.enum) {
    assert.deepEqual(errorsFor(basePassage({ evidence_item_type: value })), [], `${value} must validate`);
  }

  for (const bad of ['lab_value', 'Observed_Finding', 'observed finding', '', 'unknown']) {
    assert.notEqual(errorsFor(basePassage({ evidence_item_type: bad })).length, 0,
      `unrecognised evidence_item_type ${JSON.stringify(bad)} must fail — the enum is closed`);
  }
});

test('FR-WP3-03 / handoff §9.2: rights_component_class matches rights_record.schema.json component_decisions[].component_type ENUM one-for-one (the schema enum, not the §5.1 prose table)', () => {
  const expected = rightsRecordSchema.properties.component_decisions.items.properties.component_type.enum;
  assert.deepEqual(
    schema.$defs.rightsComponentClass.enum,
    expected,
    'rights_component_class enum must stay identical to the vendored component_type enum (copied, never $ref\'d — FR-WP3-11)',
  );

  // The §5.1-prose-table divergence the amendment records: "Prose or abstract" and
  // "Figure or chart" are single rows in the prose table but two enum members each here.
  for (const member of ['prose', 'abstract', 'figure', 'chart']) {
    assert.ok(schema.$defs.rightsComponentClass.enum.includes(member),
      `${member} must be an independently selectable member (handoff §9.2)`);
    assert.deepEqual(errorsFor(basePassage({ rights_component_class: member })), []);
  }

  assert.notEqual(errorsFor(basePassage({ rights_component_class: 'prose_or_abstract' })).length, 0,
    'a value taken from the §5.1 prose table rather than the enum must fail');
});

test('FR-WP3-11: no axis field $refs or imports an RF-owned schema — every $ref in evidence.schema.json is internal', () => {
  const refs = [];
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') refs.push(value);
      else walk(value);
    }
  })(schema);
  assert.ok(refs.length > 0, 'sanity: the schema does use internal $refs');
  for (const ref of refs) {
    assert.ok(ref.startsWith('#/'), `every $ref must be internal to this document; found ${ref}`);
  }
});

test('FR-WP3-02 (OQ-1, D6) NEGATIVE CRITERION: judgment_basis other than `unassessed` without a human-attested reference fails validation', () => {
  for (const value of ['measured_or_observed', 'committee_judged']) {
    const errors = errorsFor(basePassage({ judgment_basis: value }));
    assert.notEqual(errors.length, 0,
      `judgment_basis: ${value} with judgment_basis_attestation: null must fail — an unattested measured-vs-judged determination is exactly the fail-open this gate prevents`);
  }
});

test('FR-WP3-02 (D6): the attested state is structurally unreachable — even a fully-formed attestation object fails, because judgment_basis_attestation is const null in this schema version', () => {
  const attested = basePassage({
    judgment_basis: 'committee_judged',
    judgment_basis_attestation: {
      attested_by: 'Some Person',
      attestation_ref: 'attestation://not-a-real-ledger/1',
      attested_on: '2026-07-21',
    },
  });
  const errors = errorsFor(attested);
  assert.notEqual(errors.length, 0,
    'no field combination may reach a measured-vs-judged determination without a human attestation record this feature does not create');
  assert.equal(schema.$defs.passage.properties.judgment_basis_attestation.const, null,
    'judgment_basis_attestation must be schema-forced null (the rule.schema.json clinicalApprovers posture)');
});

test('FR-WP3-02: the pairing rule is written against the attestation SHAPE, so it survives the day the const is relaxed', () => {
  const shape = schema.$defs.judgmentBasisAttestation;
  assert.equal(shape.type, 'object');
  assert.equal(shape.additionalProperties, false);
  assert.deepEqual(shape.required, ['attested_by', 'attestation_ref', 'attested_on']);

  // Applied directly (as the allOf `then` clause applies it), the shape rejects a null and an
  // incomplete attestation — the constraint that keeps doing the work after `const: null` goes.
  assert.notEqual(validate(shape, null, { rootSchema: schema }).length, 0);
  assert.notEqual(validate(shape, { attested_by: 'Some Person' }, { rootSchema: schema }).length, 0);
  assert.deepEqual(
    validate(shape, { attested_by: 'Some Person', attestation_ref: 'ref', attested_on: '2026-07-21' }, { rootSchema: schema }),
    [],
  );
});

test('D7: an item at judgment_basis `unassessed` validates cleanly — this is a coverage constraint, never a clearance gate', () => {
  assert.deepEqual(errorsFor(basePassage({ judgment_basis: 'unassessed' })), []);
  assert.equal(schema.$defs.judgmentBasis.default, 'unassessed');
});

test('D2: the three axes are separately declared — no schema construct derives one axis from another', () => {
  // Every axis combination of evidence_item_type x rights_component_class is representable.
  // (EPR3-T3 owns the full pairwise proof across `status`/`overall_status` too.)
  for (const itemType of schema.$defs.evidenceItemType.enum) {
    for (const componentClass of schema.$defs.rightsComponentClass.enum) {
      assert.deepEqual(
        errorsFor(basePassage({ evidence_item_type: itemType, rights_component_class: componentClass })),
        [],
        `${itemType} x ${componentClass} must be representable — neither axis constrains the other`,
      );
    }
  }

  // Structural check: no conditional clause on $defs/passage mentions two different axis fields
  // together, which is how an inference between them would have to be written.
  const axisFields = ['evidence_item_type', 'rights_component_class', 'judgment_basis'];
  for (const clause of schema.$defs.passage.allOf) {
    const text = JSON.stringify({ if: clause.if, then: clause.then, else: clause.else });
    const mentioned = axisFields.filter((field) => text.includes(`"${field}"`));
    assert.ok(mentioned.length <= 1,
      `an allOf clause couples ${mentioned.join(' + ')} — one axis inferring another is a D2 violation`);
  }
});

test('D6: nothing in the committed modules/anemia/evidence.json carries a non-`unassessed` judgment_basis or a non-null attestation', () => {
  for (const source of evidenceDoc.sources) {
    for (const passage of source.passages) {
      if ('judgment_basis' in passage) {
        assert.equal(passage.judgment_basis, 'unassessed',
          `${passage.id}: every record this feature produces ships judgment_basis: unassessed (OQ-1 routes to counsel)`);
      }
      if ('judgment_basis_attestation' in passage) {
        assert.equal(passage.judgment_basis_attestation, null,
          `${passage.id}: no attestation may be agent-authored`);
      }
    }
  }
});

test('D6/D7: no CLEARED_* / clearance / approval vocabulary is REPRESENTABLE on the new axis definitions (field names, enum members and consts — prose descriptions legitimately discuss why these are absent)', () => {
  // Strip `description` before scanning: the descriptions deliberately explain WHY the taxonomy
  // does not ride `rights_extension`'s `clearance_status`/`release_gate` pair, and naming a thing
  // in order to exclude it must not read as offering it.
  const withoutProse = (node) => {
    if (Array.isArray(node)) return node.map(withoutProse);
    if (!node || typeof node !== 'object') return node;
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => key !== 'description')
        .map(([key, value]) => [key, withoutProse(value)]),
    );
  };
  const text = JSON.stringify(withoutProse({
    evidenceItemType: schema.$defs.evidenceItemType,
    judgmentBasis: schema.$defs.judgmentBasis,
    judgmentBasisAttestation: schema.$defs.judgmentBasisAttestation,
    rightsComponentClass: schema.$defs.rightsComponentClass,
    evidence_item_type: schema.$defs.passage.properties.evidence_item_type,
    judgment_basis: schema.$defs.passage.properties.judgment_basis,
    judgment_basis_attestation: schema.$defs.passage.properties.judgment_basis_attestation,
    rights_component_class: schema.$defs.passage.properties.rights_component_class,
  }));
  for (const forbidden of ['CLEARED_', 'counsel_approved', 'clearance_status', 'release_gate', 'approvedBy', 'clinicalApprovers']) {
    assert.ok(!text.includes(forbidden), `${forbidden} must not be representable on the taxonomy axis surface`);
  }
});

test('handoff §9.1: the taxonomy does NOT ride extensions.rights — no rights_extension field or import exists on evidence.schema.json, and the vendored rights_extension schema is untouched', async () => {
  // Structural, not textual: the descriptions name `rights_extension` in order to record why the
  // taxonomy is NOT carried there. What must not exist is a property, key or $ref that puts it
  // there. (D4's blanket no-inline-rights-record scan lives in tests/rights-substrate.test.mjs.)
  const passageKeys = Object.keys(schema.$defs.passage.properties);
  for (const forbidden of ['extensions', 'rights', 'rights_extension']) {
    assert.ok(!passageKeys.includes(forbidden),
      `the passage record must carry no \`${forbidden}\` property — the taxonomy is first-class (handoff §9.1, D4)`);
  }
  for (const axis of ['evidence_item_type', 'judgment_basis', 'judgment_basis_attestation', 'rights_component_class']) {
    assert.ok(passageKeys.includes(axis), `${axis} must be a first-class property of the passage record`);
  }

  // rights_extension.schema.json requires a clearance_status/release_gate pair a capture-time
  // record cannot carry — the reason §9.1 re-homes the taxonomy here. Assert that is still true,
  // so a future relaxation of the vendored copy does not quietly invalidate the rationale.
  const rightsExtension = JSON.parse(await readFile(new URL('schemas/rights/rights_extension.schema.json', REPO_ROOT), 'utf8'));
  assert.equal(rightsExtension.additionalProperties, false);
  for (const required of ['clearance_status', 'release_gate']) {
    assert.ok(rightsExtension.required.includes(required),
      `rights_extension still requires ${required} — the §9.1 conflict that put the taxonomy on evidence.schema.json`);
  }
});
