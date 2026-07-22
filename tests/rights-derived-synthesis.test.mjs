// tests/rights-derived-synthesis.test.mjs — EPR3-T7 (FR-WP3-07; D3, D6; RF handoff §4.3/§4.4/§9.5).
//
// Proves schemas/evidence.schema.json ships `derived_synthesis` as a FIRST-CLASS first-party item
// type, with attribution-to-inputs modelled from day one (D3) and reachable ONLY in a `candidate`
// state (D6):
//   - a top-level `derived_syntheses[]` container plus `$defs/derivedSynthesis` — the item is
//     first-party (no `sourceId`/`passageFidelity`/third-party locator), so it lives OUTSIDE
//     `sources[].passages[]`.
//   - attribution: `synthesis.input_refs` is an ordered list with `minItems: 2` — a synthesis with
//     no input attribution fails validation (AC FR-WP3-07). Attribution cannot be backfilled (D3),
//     so it is required from the first release.
//   - the AUTHORITATIVE state is STRUCTURALLY UNREPRESENTABLE (D6, the load-bearing constraint):
//     `attestation.status` may leave `candidate` only against an `attestation_record` matching
//     `$defs/synthesisAttestationRecord`, and that field is `const: null` in this schema version —
//     so no enum value, flag, or field combination reaches `attested` without a human attestation
//     record this feature does not create. This mirrors the `judgment_basis` D6 pattern exactly.
//   - per handoff §9.5 (DEF-R4) a `derived_synthesis` gets NO `rights_record`: `rights_record`
//     cannot describe first-party content, so authorship is modelled on the item itself. The gap is
//     recorded in the schema description AND in schemas/rights/VENDORING.md — asserted here.
//
// This feature ships ZERO `derived_synthesis` instances (a real one is an unattested clinical claim,
// which D6 forbids any agent from authoring) and ZERO attestations: the committed
// modules/anemia/evidence.json carries an EMPTY `derived_syntheses[]`. The constraints are proven
// against hand-authored fixtures, the D6 direction against the real KB.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = new URL('../', import.meta.url);

let schema;
let evidenceDoc;
let vendoringDoc;

test('fixtures load: schemas/evidence.schema.json, modules/anemia/evidence.json, schemas/rights/VENDORING.md', async () => {
  schema = JSON.parse(await readFile(new URL('schemas/evidence.schema.json', REPO_ROOT), 'utf8'));
  evidenceDoc = JSON.parse(await readFile(new URL('modules/anemia/evidence.json', REPO_ROOT), 'utf8'));
  vendoringDoc = await readFile(new URL('schemas/rights/VENDORING.md', REPO_ROOT), 'utf8');

  for (const def of ['derivedSynthesis', 'synthesis', 'synthesisInputRef', 'synthesisAttestation', 'synthesisAttestationRecord']) {
    assert.ok(schema.$defs[def], `schema must define $defs/${def}`);
  }
  assert.ok(schema.properties.derived_syntheses, 'schema must declare a top-level derived_syntheses property');
  assert.equal(schema.properties.derived_syntheses.items.$ref, '#/$defs/derivedSynthesis');
});

// A structurally complete, this-feature-legal (candidate, unattested) derived_synthesis item.
function baseSynthesis() {
  return {
    id: 'SYNTH_ANEMIA_EXAMPLE_001',
    evidence_item_type: 'derived_synthesis',
    synthesis: {
      input_refs: [
        { evidence_item_id: 'AAP2026_IDA#ev_002', rights_record_id: null, contribution: 'anchor' },
        { evidence_item_id: 'WHO2024_HB#ev_001', rights_record_id: null, contribution: 'corroborating' },
      ],
      method: 'Independently combined the two reported thresholds into a single first-party statement.',
      divergence_notes: [],
      reproduces_source_arrangement: false,
      first_party_rights_holder: null,
      attestation: { status: 'candidate', attestation_record: null },
    },
  };
}

// Override helper: shallow-merges top-level fields and (separately) the nested synthesis sub-object.
function synthesisItem({ synthesis, ...rest } = {}) {
  const base = baseSynthesis();
  return {
    ...base,
    ...rest,
    synthesis: { ...base.synthesis, ...synthesis },
  };
}

function errorsFor(item) {
  return validate(schema.$defs.derivedSynthesis, item, { rootSchema: schema });
}

test('FR-WP3-07: a well-formed candidate derived_synthesis validates clean', () => {
  assert.deepEqual(errorsFor(synthesisItem()), []);
});

test('FR-WP3-07: the whole evidence document validates with a candidate derived_synthesis in derived_syntheses[]', () => {
  const doc = {
    ...evidenceDoc,
    derived_syntheses: [synthesisItem()],
  };
  assert.deepEqual(validate(schema, doc, { rootSchema: schema }), []);
});

test('FR-WP3-07 (D3): a derived_synthesis with NO input attribution fails validation', () => {
  // Absent input_refs.
  const noRefs = synthesisItem();
  delete noRefs.synthesis.input_refs;
  assert.notEqual(errorsFor(noRefs).length, 0, 'missing input_refs must fail — attribution is required from day one (D3)');

  // Empty input_refs.
  assert.notEqual(errorsFor(synthesisItem({ synthesis: { input_refs: [] } })).length, 0,
    'empty input_refs must fail');

  // A single input — a "synthesis" over one input is not one (handoff §4.3, minItems 2).
  assert.notEqual(
    errorsFor(synthesisItem({ synthesis: { input_refs: [{ evidence_item_id: 'AAP2026_IDA#ev_002', rights_record_id: null, contribution: 'anchor' }] } })).length,
    0,
    'one input must fail — minItems 2',
  );
});

test('FR-WP3-07 (D6) NEGATIVE CRITERION: the authoritative state is structurally unrepresentable — status `attested` with a null record fails', () => {
  const attestedNullRecord = synthesisItem({ synthesis: { attestation: { status: 'attested', attestation_record: null } } });
  assert.notEqual(errorsFor(attestedNullRecord).length, 0,
    'status: attested with attestation_record: null must fail — an unattested authoritative synthesis is exactly the fail-open D6 prevents');
});

test('FR-WP3-07 (D6) NEGATIVE CRITERION: even a fully-formed attestation record cannot reach `attested`, because attestation_record is const null', () => {
  const attestedFullRecord = synthesisItem({
    synthesis: {
      attestation: {
        status: 'attested',
        attestation_record: {
          attested_by: 'Some Named Human',
          attestation_ref: 'attestation://not-a-real-ledger/1',
          attested_on: '2026-07-21',
        },
      },
    },
  });
  assert.notEqual(errorsFor(attestedFullRecord).length, 0,
    'no field combination may reach an authoritative synthesis without a human attestation record this feature does not create');
  assert.equal(schema.$defs.synthesisAttestation.properties.attestation_record.const, null,
    'attestation_record must be schema-forced null (the rule.schema.json clinicalApprovers / judgment_basis_attestation posture)');
});

test('FR-WP3-07 (D6): the pairing rule is written against the attestation SHAPE, so it survives the day the const is relaxed', () => {
  const shape = schema.$defs.synthesisAttestationRecord;
  assert.equal(shape.type, 'object');
  assert.equal(shape.additionalProperties, false);
  assert.deepEqual(shape.required, ['attested_by', 'attestation_ref', 'attested_on']);

  // Applied directly (as the allOf `then` applies it), the shape rejects null and an incomplete
  // record — the constraint that keeps doing the work after `const: null` is relaxed.
  assert.notEqual(validate(shape, null, { rootSchema: schema }).length, 0);
  assert.notEqual(validate(shape, { attested_by: 'Some Human' }, { rootSchema: schema }).length, 0);
  assert.deepEqual(
    validate(shape, { attested_by: 'Some Human', attestation_ref: 'ref', attested_on: '2026-07-21' }, { rootSchema: schema }),
    [],
  );

  // And the pairing clause references the shape $ref, not a bare `false`.
  const clause = schema.$defs.synthesisAttestation.allOf.find((c) => JSON.stringify(c).includes('synthesisAttestationRecord'));
  assert.ok(clause, 'the attestation pairing rule must reference $defs/synthesisAttestationRecord');
});

test('D7: a candidate synthesis validates cleanly — this is a coverage constraint, never a clearance gate', () => {
  assert.deepEqual(errorsFor(synthesisItem({ synthesis: { attestation: { status: 'candidate', attestation_record: null } } })), []);
  assert.equal(schema.$defs.synthesisAttestation.properties.status.default, 'candidate');
  assert.deepEqual(schema.$defs.synthesisAttestation.properties.status.enum, ['candidate', 'attested']);
});

test('FR-WP3-01/07: evidence_item_type is pinned `const: derived_synthesis`, and that value is a member of the shared evidenceItemType enum', () => {
  assert.equal(schema.$defs.derivedSynthesis.properties.evidence_item_type.const, 'derived_synthesis');
  assert.ok(schema.$defs.evidenceItemType.enum.includes('derived_synthesis'),
    'the const must stay a member of the shared taxonomy enum — vocabulary must not drift');

  // A synthesis item cannot be re-typed as a source-drawn kind.
  assert.notEqual(errorsFor(synthesisItem({ evidence_item_type: 'observed_finding' })).length, 0);
});

test('handoff §9.5 (DEF-R4): a derived_synthesis carries NO rights_record / clearance surface — no such key is representable', () => {
  // additionalProperties: false and no rights-bearing property on the item or its synthesis.
  assert.equal(schema.$defs.derivedSynthesis.additionalProperties, false);
  assert.equal(schema.$defs.synthesis.additionalProperties, false);

  const itemKeys = Object.keys(schema.$defs.derivedSynthesis.properties);
  const synthesisKeys = Object.keys(schema.$defs.synthesis.properties);
  for (const forbidden of ['rights_record', 'rights_record_id', 'rights_extension', 'overall_status', 'clearance_status', 'release_gate']) {
    assert.ok(!itemKeys.includes(forbidden), `derivedSynthesis must not carry a \`${forbidden}\` key (handoff §9.5: no rights_record for first-party content)`);
    assert.ok(!synthesisKeys.includes(forbidden), `synthesis must not carry a \`${forbidden}\` key`);
  }

  // A fixture attempting to attach a rights_record to the item fails (additionalProperties: false).
  const withRightsRecord = synthesisItem();
  withRightsRecord.rights_record = { source_id: 'AAP2026_IDA', overall_status: 'UNKNOWN' };
  assert.notEqual(errorsFor(withRightsRecord).length, 0,
    'a derived_synthesis must not be able to carry a rights_record — §9.5 is a structural gap, not an optional field');
});

test('D6/D7: no CLEARED_* / clearance / approval vocabulary is REPRESENTABLE on the derived-synthesis definitions (field names, enum members and consts — prose descriptions legitimately discuss why these are absent)', () => {
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
    derivedSynthesis: schema.$defs.derivedSynthesis,
    synthesis: schema.$defs.synthesis,
    synthesisInputRef: schema.$defs.synthesisInputRef,
    synthesisAttestation: schema.$defs.synthesisAttestation,
    synthesisAttestationRecord: schema.$defs.synthesisAttestationRecord,
    derived_syntheses: schema.properties.derived_syntheses,
  }));
  for (const forbidden of ['CLEARED_', 'counsel_approved', 'clearance_status', 'release_gate', 'approvedBy', 'clinicalApprovers']) {
    assert.ok(!text.includes(forbidden), `${forbidden} must not be representable on the derived-synthesis surface`);
  }
  // The only attestation status an agent can write is `candidate`; `attested` exists but is gated.
  assert.deepEqual(schema.$defs.synthesisAttestation.properties.status.enum, ['candidate', 'attested']);
});

test('handoff §4.3: input contribution is a closed enum; method is required non-empty; reproduces_source_arrangement is a required boolean', () => {
  // contribution closed enum
  assert.deepEqual(schema.$defs.synthesisInputRef.properties.contribution.enum,
    ['anchor', 'corroborating', 'contradicting', 'scope_limiting']);
  const badContribution = synthesisItem();
  badContribution.synthesis.input_refs[0].contribution = 'primary';
  assert.notEqual(errorsFor(badContribution).length, 0, 'an unrecognised contribution must fail');

  // method required non-empty
  assert.notEqual(errorsFor(synthesisItem({ synthesis: { method: '' } })).length, 0, 'empty method must fail');
  const noMethod = synthesisItem();
  delete noMethod.synthesis.method;
  assert.notEqual(errorsFor(noMethod).length, 0, 'missing method must fail');

  // reproduces_source_arrangement required boolean
  const noArrangement = synthesisItem();
  delete noArrangement.synthesis.reproduces_source_arrangement;
  assert.notEqual(errorsFor(noArrangement).length, 0, 'missing reproduces_source_arrangement must fail');
  assert.notEqual(errorsFor(synthesisItem({ synthesis: { reproduces_source_arrangement: 'no' } })).length, 0,
    'a non-boolean reproduces_source_arrangement must fail');
  // true is representable (an honest rights signal, not cleared here)
  assert.deepEqual(errorsFor(synthesisItem({ synthesis: { reproduces_source_arrangement: true } })), []);
});

test('id is namespaced disjoint from source passage ids (SYNTH_* pattern), so a synthesis cannot be confused with a source-drawn passage', () => {
  assert.notEqual(errorsFor(synthesisItem({ id: 'AAP2026_IDA#ev_002' })).length, 0,
    'a source passage id must not validate as a synthesis id');
  assert.deepEqual(errorsFor(synthesisItem({ id: 'SYNTH_G6PD_HEMOLYSIS_TRIGGERS' })), []);
});

test('D6 (real KB): the committed modules/anemia/evidence.json ships ZERO derived_synthesis instances, and any that ever exist are candidate with a null attestation_record', () => {
  const list = evidenceDoc.derived_syntheses ?? [];
  assert.ok(Array.isArray(list), 'derived_syntheses must be an array when present');
  assert.equal(list.length, 0, 'this feature ships zero derived_synthesis instances (a real one is an unattested clinical claim, D6)');
  // Defensive: if a future edit adds one, it must be candidate with a null record.
  for (const item of list) {
    assert.equal(item.synthesis?.attestation?.status, 'candidate', `${item.id}: agents may only write candidate`);
    assert.equal(item.synthesis?.attestation?.attestation_record, null, `${item.id}: no attestation may be agent-authored`);
  }
});

test('handoff §9.5 (DEF-R4) is recorded in schemas/rights/VENDORING.md and in the schema description', () => {
  // VENDORING.md names the gap, DEF-R4, and this task's item-level model.
  assert.ok(vendoringDoc.includes('§9.5'), 'VENDORING.md must reference handoff §9.5');
  assert.ok(vendoringDoc.includes('DEF-R4'), 'VENDORING.md must reference DEF-R4');
  assert.ok(vendoringDoc.includes('EPR3-T7'), 'VENDORING.md must reference EPR3-T7 (the task that ships the item-level model)');

  // The schema description carries the gap in-file too (a reader of the schema, not only VENDORING.md).
  const containerDesc = schema.properties.derived_syntheses.description;
  assert.ok(containerDesc.includes('§9.5') && containerDesc.includes('DEF-R4'),
    'the derived_syntheses schema description must record the §9.5 / DEF-R4 gap in-file');
  assert.ok(/no\s+`?rights_record`?/i.test(containerDesc),
    'the description must state that a derived_synthesis gets no rights_record');
});
