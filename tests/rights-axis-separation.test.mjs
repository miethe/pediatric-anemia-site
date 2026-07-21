// tests/rights-axis-separation.test.mjs — EPR3-T3 / FR-WP3-03 / AC-WP3-AXES (decisions-block D2).
//
// THE AXIS-SEPARATION INVARIANT: the axes are independent, and nothing may quietly re-couple them.
//
// The failure mode this file exists to prevent is the one every rights/evidence model drifts into:
// three (here four) conceptually distinct axes collapsing into a single de-facto "status" field,
// where knowing one lets you infer the others. That collapse is not a tidiness problem. It is a
// fail-open:
//
//   - Infer LEGAL from EPISTEMIC and a well-sourced passage silently reads as cleared to reuse.
//   - Infer EPISTEMIC from LEGAL and an unrestricted source silently reads as clinically grounded.
//   - Infer either from the rights COMPONENT and "it came from a table" starts deciding both.
//
// The AAP2026_IDA case is the concrete one named by the plan and it is the reason a single field
// cannot work: a passage may be `source-supported` (epistemically sound — located, audited, zero
// fidelity flags) AND sit against a `CONTRACT_RESTRICTED` rights record AT THE SAME TIME. Those are
// answers to different questions. Neither one implies, weakens, or overrides the other.
//
// ---------------------------------------------------------------------------------------------
// THE FOUR AXES (and the fifth, pinned)
// ---------------------------------------------------------------------------------------------
//
//   A. `evidence_item_type`      (7 members)  — WHAT KIND OF THING this item is, epistemically.
//                                               schemas/evidence.schema.json#/$defs/passage
//   B. `rights_component_class`  (20 members) — WHICH RIGHTS COMPONENT of the source it draws on.
//                                               schemas/evidence.schema.json#/$defs/passage
//   C. passage `status`          (3 members)  — the EPISTEMIC verdict on the passage itself
//                                               (source-supported / quarantined / proposal).
//   D. `overall_status`          (7 writable) — the LEGAL disposition, on the JOINED rights record
//                                               in rights/rights-records.json — a different file,
//                                               reached only through rights/rights-ledger.json (D4).
//
// Axis D's enum has 11 members; the four `CLEARED_*` ones are structurally unwritable under EPR0-T3's
// declared local amendment (D6 — no agent-authored clearance), so the agent-writable domain is 7.
// This file asserts that unwritability rather than working around it, and never seeds a `CLEARED_*`.
//
// The fifth axis, `judgment_basis` (measured vs. judged), has exactly ONE legal value today —
// `unassessed` — because OQ-1 routes that determination to counsel and `judgment_basis_attestation`
// is `const: null` (EPR3-T2, D6). A one-member domain cannot vary, so it does not participate in the
// cross product; it is held constant and its structural separateness is asserted directly. When a
// real attestation process relaxes that `const`, this file's `LEGAL_JUDGMENT_BASIS_VALUES` assertion
// fails loudly and the axis must be added to the cross product — that failure is the point.
//
// ---------------------------------------------------------------------------------------------
// WHAT IS ASSERTED, IN THREE LAYERS
// ---------------------------------------------------------------------------------------------
//
//   1. REPRESENTABILITY (positive). All 7 x 20 x 3 x 7 = 2940 tuples are constructed and validated:
//      the passage against `schemas/evidence.schema.json#/$defs/passage`, the joined rights record
//      against `schemas/rights/rights_record.schema.json`. Every one must be legal. A schema that
//      cannot express a combination has already made an inference.
//
//   2. NON-DERIVATION (negative), three independent probes, because no single one is sufficient:
//      (a) SCHEMA-STRUCTURAL — no conditional clause couples two axes;
//      (b) CODE-STRUCTURAL   — no executable code (comments stripped) reads an item axis and a
//                              rights-authority field together, and no line derives one axis from
//                              another through a comparison or conditional;
//      (c) BEHAVIOURAL       — `src/evidence.js#isBindableAsSourceSupported` returns an identical
//                              verdict across all 140 (A x B) combinations and all 7 D values, and
//                              varies only with the epistemic axis. Same for the ledger join.
//
//   3. NO DUPLICATE AXIS FIELD. `verbatim_excerpt_allowed` — the vendored field that would duplicate
//      `passageFidelity` — is proven unreachable rather than merely absent (see its test below).
//
// ---------------------------------------------------------------------------------------------
// RESIDUAL GAP R-2 — **OPEN, NOT CLOSED**.
// ---------------------------------------------------------------------------------------------
//
// Probe 2(b) is a lexical scan over source text, not a dataflow analysis. A determined inference —
// one axis copied into an intermediate variable in one function and consumed in another, or routed
// through a lookup table keyed by a renamed constant — passes it. Probes 2(a) and 2(c) constrain the
// two surfaces that actually matter today (the schema, and the one exported predicate any consumer
// binds through), but they do not generalise to code that does not yet exist. Do not read a green
// run of this file as proof that no inference exists anywhere; read it as proof that none exists in
// the schema, in the bindability predicate, or in any form this scan can see. R-2 stays open and is
// re-narrowed by review, not by this test.
//
// Determinism: no `Date.now()`, no `new Date()`, no `localeCompare()`. All ordering is by codepoint.
//
// Scope note: this file asserts REPRESENTABILITY over fixtures. It deliberately does not require the
// committed `modules/anemia/evidence.json` to carry the axis fields — EPR3-T5 backfills those (see
// tests/rights-evidence-item-axes.test.mjs's header for the migration sequencing). What it does
// assert against real committed data is the D6/D7 direction: every real rights record still sits at
// a non-`CLEARED_*` `overall_status`, and the real AAP2026_IDA join resolves.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { isBindableAsSourceSupported, passageApplicability, sourceRightsPosition } from '../src/evidence.js';
import { resolveRightsRecordsForIdentifier } from '../scripts/validate-kb.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(readFileSync(path.join(REPO_ROOT, relative), 'utf8'));
const byCodepoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------------------------------------
// Axis-name vocabularies used by the code scan (probe 2b).
// ---------------------------------------------------------------------------------------------

/** Fields carried by an EVIDENCE ITEM — the epistemic/taxonomy side of the barrier. */
const ITEM_AXIS_FIELDS = Object.freeze([
  'evidence_item_type',
  'rights_component_class',
  'judgment_basis',
  'judgment_basis_attestation',
  'passageFidelity',
]);

/**
 * Fields carried by a RIGHTS RECORD that express a legal DISPOSITION — the authority side. A code
 * path that reads one of these together with an item axis is inferring across the barrier D2 draws.
 */
const RIGHTS_AUTHORITY_FIELDS = Object.freeze([
  'overall_status',
  'clearance_status',
  'release_gate',
  'review_status',
]);

/**
 * Operators that turn a co-mention into a derivation. A line listing two axis names in an array
 * literal (e.g. a key-order constant in a generator) is not an inference; a line that BRANCHES on
 * one to produce another is.
 */
const DERIVATION_OPERATORS = Object.freeze([
  '===', '!==', '==', '!=', '?', 'if (', 'if(', 'switch', '.includes(', '&&', '||',
]);

/**
 * Files whose executable code is permitted to co-mention an item axis and a rights-authority field.
 * FROZEN AND EMPTY. An entry here is an admission that some code path spans the barrier; it may only
 * be added with a plan amendment naming the reviewed reason, and it may only shrink.
 */
const CROSS_BARRIER_FILE_ALLOWLIST = Object.freeze([]);

// ---------------------------------------------------------------------------------------------
// Pure helpers (exported so they are independently unit-testable, and self-tested below).
// ---------------------------------------------------------------------------------------------

/**
 * Remove JavaScript comments from `source`, leaving string and template literals intact. Prose
 * carries most of this repository's reasoning ABOUT the axes — including sentences that name two
 * axes in order to say they are unrelated — so scanning raw text would flag exactly the files that
 * document the invariant most carefully. Only executable code is evidence of a code path.
 *
 * Deliberately a small scanner, not a parser: it tracks string/template/regex-free state well enough
 * for this repository's style. It over-strips at worst (a `//` inside a regex literal), which can
 * only produce false NEGATIVES on the surrounding line, never false positives — and R-2 already
 * records that this probe is not sound.
 *
 * @param {string} source
 * @returns {string} the source with comment bodies replaced by spaces, line structure preserved.
 */
export function stripJsComments(source) {
  let out = '';
  let index = 0;
  let state = 'code'; // code | line-comment | block-comment | single | double | template
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (state === 'code') {
      if (char === '/' && next === '/') { state = 'line-comment'; out += '  '; index += 2; continue; }
      if (char === '/' && next === '*') { state = 'block-comment'; out += '  '; index += 2; continue; }
      if (char === "'") state = 'single';
      else if (char === '"') state = 'double';
      else if (char === '`') state = 'template';
      out += char; index += 1; continue;
    }
    if (state === 'line-comment') {
      if (char === '\n') { state = 'code'; out += char; } else out += ' ';
      index += 1; continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') { state = 'code'; out += '  '; index += 2; continue; }
      out += char === '\n' ? char : ' '; index += 1; continue;
    }
    // inside a string/template literal
    if (char === '\\') { out += char + (next ?? ''); index += 2; continue; }
    if ((state === 'single' && char === "'") || (state === 'double' && char === '"') || (state === 'template' && char === '`')) {
      state = 'code';
    }
    out += char; index += 1;
  }
  return out;
}

/**
 * Probe 2(b). Reports every way a file's executable code appears to bridge two axes.
 *
 * Two distinct findings, because they are different defects:
 *   - `cross-barrier` — the file's code names an item axis AND a rights-authority field. There is no
 *     legitimate reason for one module to hold both: the join between them is the ledger (D4), and
 *     the coverage gates that walk it never read a disposition (D7).
 *   - `derivation`    — a single line names two DIFFERENT axis fields alongside a comparison or
 *     conditional operator, i.e. the shape an inference has to take. A line that merely lists axis
 *     names (a key-order array, a required-fields list) is not reported.
 *
 * @param {{path: string, source: string}[]} files
 * @param {{allowlist?: readonly string[]}} [options]
 * @returns {string[]} violations, sorted by codepoint.
 */
export function findAxisCodeCouplings(files, options = {}) {
  const allowed = new Set(options.allowlist ?? CROSS_BARRIER_FILE_ALLOWLIST);
  const violations = [];
  const allAxisFields = [...ITEM_AXIS_FIELDS, ...RIGHTS_AUTHORITY_FIELDS];

  for (const file of files) {
    if (allowed.has(file.path)) continue;
    const code = stripJsComments(file.source);

    const items = ITEM_AXIS_FIELDS.filter((field) => code.includes(field));
    const authorities = RIGHTS_AUTHORITY_FIELDS.filter((field) => code.includes(field));
    if (items.length > 0 && authorities.length > 0) {
      violations.push(
        `${file.path}: executable code reads item axis [${items.join(', ')}] together with rights-authority field `
        + `[${authorities.join(', ')}] — the epistemic and legal axes are joined through rights/rights-ledger.json (D4), `
        + 'never inferred from one another (D2/D7)',
      );
    }

    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const mentioned = allAxisFields.filter((field) => line.includes(field));
      const distinct = new Set(mentioned);
      if (distinct.size < 2) continue;
      if (!DERIVATION_OPERATORS.some((operator) => line.includes(operator))) continue;
      violations.push(
        `${file.path}:${i + 1}: one line branches across axes [${[...distinct].sort(byCodepoint).join(', ')}] — `
        + 'deriving one axis from another collapses them into a single de-facto status field (D2)',
      );
    }
  }

  return violations.sort(byCodepoint);
}

/**
 * The functional-dependency detector. Given a corpus of records and the axis keys, reports every
 * ORDERED pair (A -> B) where every distinct value of A maps to exactly one value of B — i.e. B is
 * computable from A, which is what "the axes collapsed into one field" looks like in data.
 *
 * Requires both axes to actually vary (>= 2 distinct values each) before reporting: a corpus in
 * which one axis is constant proves nothing either way, and reporting it would make the detector
 * fire on every small or single-valued sample.
 *
 * @param {Record<string, unknown>[]} records
 * @param {readonly string[]} axes
 * @returns {string[]} findings, sorted by codepoint.
 */
export function findAxisFunctionalDependencies(records, axes) {
  const findings = [];
  for (const from of axes) {
    for (const to of axes) {
      if (from === to) continue;
      const mapping = new Map();
      let consistent = true;
      for (const record of records) {
        const key = JSON.stringify(record?.[from]);
        const value = JSON.stringify(record?.[to]);
        if (!mapping.has(key)) mapping.set(key, value);
        else if (mapping.get(key) !== value) { consistent = false; break; }
      }
      const distinctTo = new Set(records.map((record) => JSON.stringify(record?.[to])));
      if (!consistent || mapping.size < 2 || distinctTo.size < 2) continue;
      findings.push(
        `${to} is functionally determined by ${from} across ${records.length} records `
        + `(${mapping.size} distinct ${from} values, each mapping to exactly one ${to}) — the axes have collapsed`,
      );
    }
  }
  return findings.sort(byCodepoint);
}

/**
 * Probe 2(a). Reports every conditional clause in a schema subtree that mentions two different axis
 * fields — the only way a JSON Schema can make one axis constrain another.
 *
 * @param {{allOf?: unknown[]}} subschema
 * @param {readonly string[]} axisFields
 * @param {string} label
 * @returns {string[]}
 */
export function findSchemaAxisCouplings(subschema, axisFields, label) {
  const violations = [];
  const clauses = [];
  (function collect(node) {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!node || typeof node !== 'object') return;
    if ('if' in node || 'then' in node || 'else' in node) {
      clauses.push(JSON.stringify({ if: node.if, then: node.then, else: node.else }));
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'description') continue;
      collect(value);
    }
  })(subschema);

  for (const clause of clauses) {
    const mentioned = axisFields.filter((field) => clause.includes(`"${field}"`));
    if (new Set(mentioned).size > 1) {
      violations.push(`${label}: a conditional clause couples ${[...new Set(mentioned)].sort(byCodepoint).join(' + ')} — one axis constraining another is a D2 violation`);
    }
  }
  return violations.sort(byCodepoint);
}

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

let evidenceSchema;
let rightsRecordSchema;
let rightsRecords;
let rightsLedger;

let EVIDENCE_ITEM_TYPES;
let RIGHTS_COMPONENT_CLASSES;
let PASSAGE_STATUSES;
let CLEARED_OVERALL_STATUSES;
let AGENT_WRITABLE_OVERALL_STATUSES;
let LEGAL_JUDGMENT_BASIS_VALUES;
let baseRightsRecord;

test('fixtures load, and every axis domain is read from its schema rather than hard-coded (so a widened enum cannot silently go untested)', () => {
  evidenceSchema = readJson('schemas/evidence.schema.json');
  rightsRecordSchema = readJson('schemas/rights/rights_record.schema.json');
  rightsRecords = readJson('rights/rights-records.json');
  rightsLedger = readJson('rights/rights-ledger.json');

  EVIDENCE_ITEM_TYPES = evidenceSchema.$defs.evidenceItemType.enum;
  RIGHTS_COMPONENT_CLASSES = evidenceSchema.$defs.rightsComponentClass.enum;
  PASSAGE_STATUSES = evidenceSchema.$defs.passage.properties.status.enum;

  const overallStatus = rightsRecordSchema.properties.overall_status;
  CLEARED_OVERALL_STATUSES = overallStatus.not.enum;
  AGENT_WRITABLE_OVERALL_STATUSES = overallStatus.enum.filter((value) => !CLEARED_OVERALL_STATUSES.includes(value));

  // `judgment_basis` is the pinned fifth axis: enum members exist, but only `unassessed` is reachable
  // while `judgment_basis_attestation` is `const: null` (EPR3-T2, OQ-1, D6).
  assert.equal(evidenceSchema.$defs.passage.properties.judgment_basis_attestation.const, null);
  LEGAL_JUDGMENT_BASIS_VALUES = evidenceSchema.$defs.judgmentBasis.enum.filter((value) => value === 'unassessed');

  assert.equal(EVIDENCE_ITEM_TYPES.length, 7, 'axis A (evidence_item_type) domain changed — extend the cross product deliberately');
  assert.equal(RIGHTS_COMPONENT_CLASSES.length, 20, 'axis B (rights_component_class) domain changed — extend the cross product deliberately');
  assert.equal(PASSAGE_STATUSES.length, 3, 'axis C (passage status) domain changed — extend the cross product deliberately');
  assert.equal(AGENT_WRITABLE_OVERALL_STATUSES.length, 7, 'axis D (agent-writable overall_status) domain changed — extend the cross product deliberately');
  assert.equal(CLEARED_OVERALL_STATUSES.length, 4, 'the four CLEARED_* members must stay structurally unwritable (EPR0-T3 amendment, D6)');
  assert.deepEqual(LEGAL_JUDGMENT_BASIS_VALUES, ['unassessed'],
    'judgment_basis has exactly one legal value today; if that changed, it is now a varying axis and belongs in the cross product');

  baseRightsRecord = rightsRecords.records.find((record) => record.rights_record_id === 'RR-AAP2026_IDA');
  assert.ok(baseRightsRecord, 'RR-AAP2026_IDA must exist as the shape-donor for the rights-record fixtures');
  assert.deepEqual(validate(rightsRecordSchema, baseRightsRecord, { rootSchema: rightsRecordSchema }), [],
    'sanity: the donor record itself validates, so a fixture failure below means the axis override, not the donor');
});

/**
 * A structurally complete passage record at the requested axis coordinates. `reviewFlags` and
 * `applicability` track `status` because the record's OWN pre-existing consistency rules require it
 * (a `quarantined` passage has >= 1 flag; a non-proposal record carries `applicability`) — those are
 * intra-axis-C constraints that predate this feature, not a cross-axis inference.
 */
function passageAt({ itemType, componentClass, status }) {
  return {
    id: 'AAP2026_IDA#ev_001',
    sourceId: 'AAP2026_IDA',
    status,
    sourceLocator: { raw: 'p. 1, Table 2', page: '1', section: null, table: '2', figure: null },
    exactPassage: 'A located finding, restated in independent wording.',
    passageFidelity: 'paraphrase',
    reviewFlags: status === 'quarantined' ? ['omits-source-numerics'] : [],
    reviewFindingIds: [],
    evidenceGrade: 'source-supported-fact',
    applicability: { age: null, sex: null, assay: null },
    reviewDate: '2026-07-21',
    supersedes: null,
    surveillanceQuery: 'pediatric anemia surveillance',
    provenance: { runId: 'r', sourceCardId: 's', evidenceId: 'ev_001' },
    evidence_item_type: itemType,
    judgment_basis: 'unassessed',
    judgment_basis_attestation: null,
    rights_component_class: componentClass,
  };
}

const rightsRecordAt = (overallStatus) => ({ ...baseRightsRecord, overall_status: overallStatus });

/** Every (A, B, C, D) coordinate. Built once, reused by the representability and probe tests. */
function allAxisTuples() {
  const tuples = [];
  for (const itemType of EVIDENCE_ITEM_TYPES) {
    for (const componentClass of RIGHTS_COMPONENT_CLASSES) {
      for (const status of PASSAGE_STATUSES) {
        for (const overallStatus of AGENT_WRITABLE_OVERALL_STATUSES) {
          tuples.push({ itemType, componentClass, status, overallStatus });
        }
      }
    }
  }
  return tuples;
}

// ---------------------------------------------------------------------------------------------
// LAYER 1 — representability
// ---------------------------------------------------------------------------------------------

test('AC-WP3-AXES: every one of the 2940 evidence_item_type x rights_component_class x status x overall_status combinations is representable', () => {
  const tuples = allAxisTuples();
  assert.equal(tuples.length, 7 * 20 * 3 * 7);

  const failures = [];
  for (const tuple of tuples) {
    const passage = passageAt(tuple);
    const record = rightsRecordAt(tuple.overallStatus);
    const passageErrors = validate(evidenceSchema.$defs.passage, passage, { rootSchema: evidenceSchema });
    const recordErrors = validate(rightsRecordSchema, record, { rootSchema: rightsRecordSchema });
    if (passageErrors.length > 0 || recordErrors.length > 0) {
      failures.push(
        `${tuple.itemType} x ${tuple.componentClass} x ${tuple.status} x ${tuple.overallStatus}: `
        + `${JSON.stringify([...passageErrors, ...recordErrors])}`,
      );
    }
  }
  assert.deepEqual(failures.slice(0, 5), [],
    'a combination the schemas cannot express is an inference the schemas have already made');
  assert.equal(failures.length, 0);
});

test('AC-WP3-AXES: each of the six axis PAIRS is independently fully crossed — no pair of axes constrains each other', () => {
  const axes = {
    evidence_item_type: EVIDENCE_ITEM_TYPES,
    rights_component_class: RIGHTS_COMPONENT_CLASSES,
    status: PASSAGE_STATUSES,
    overall_status: AGENT_WRITABLE_OVERALL_STATUSES,
  };
  const names = Object.keys(axes);
  const tuples = allAxisTuples();
  const keyOf = { evidence_item_type: 'itemType', rights_component_class: 'componentClass', status: 'status', overall_status: 'overallStatus' };

  let pairsChecked = 0;
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const [left, right] = [names[i], names[j]];
      const observed = new Set(tuples.map((t) => `${t[keyOf[left]]}||${t[keyOf[right]]}`));
      assert.equal(observed.size, axes[left].length * axes[right].length,
        `${left} x ${right} is not fully crossed — every value of one must be pairable with every value of the other`);
      pairsChecked += 1;
    }
  }
  assert.equal(pairsChecked, 6, 'four axes yield exactly six unordered pairs');
});

test('THE AAP CASE (named by the plan): a passage may be `source-supported` AND its joined rights record CONTRACT_RESTRICTED at the same time', () => {
  const passage = passageAt({ itemType: 'reference_interval_value', componentClass: 'table', status: 'source-supported' });
  const record = rightsRecordAt('CONTRACT_RESTRICTED');

  assert.deepEqual(validate(evidenceSchema.$defs.passage, passage, { rootSchema: evidenceSchema }), [],
    'a contract-restricted rights position must not make an epistemically sound passage unrepresentable');
  assert.deepEqual(validate(rightsRecordSchema, record, { rootSchema: rightsRecordSchema }), []);
  assert.equal(isBindableAsSourceSupported(passage), true,
    'the legal axis must not reach into the bindability verdict — that would silently un-ground a well-sourced rule');

  // And the mirror image, which is the same defect pointed the other way: an unrestricted-looking
  // rights position must not make a quarantined passage look bindable.
  const quarantined = passageAt({ itemType: 'reference_interval_value', componentClass: 'table', status: 'quarantined' });
  assert.deepEqual(validate(evidenceSchema.$defs.passage, quarantined, { rootSchema: evidenceSchema }), []);
  assert.equal(isBindableAsSourceSupported(quarantined), false);

  // The join itself is real, not hypothetical: AAP2026_IDA resolves through the committed ledger.
  const { recordIds, errors } = resolveRightsRecordsForIdentifier('evidence_source_id', 'AAP2026_IDA', { rightsLedger, rightsRecords });
  assert.deepEqual(errors, []);
  assert.ok(recordIds.includes('RR-AAP2026_IDA'), 'the AAP source must join to its rights record through rights/rights-ledger.json (D4)');
});

test('D6: the four CLEARED_* overall_status members are structurally unwritable — the "every combination is representable" claim above is scoped to the agent-writable domain, deliberately', () => {
  for (const cleared of CLEARED_OVERALL_STATUSES) {
    const errors = validate(rightsRecordSchema, rightsRecordAt(cleared), { rootSchema: rightsRecordSchema });
    assert.notEqual(errors.length, 0, `${cleared} must fail validation — no clearance may be agent-authored (EPR0-T3 amendment, D6)`);
  }
  // And nothing already committed carries one.
  for (const record of rightsRecords.records) {
    assert.ok(!CLEARED_OVERALL_STATUSES.includes(record.overall_status),
      `${record.rights_record_id} carries ${record.overall_status} — no clearance exists in this project`);
  }
});

test('D7: a record at overall_status UNKNOWN is fully representable at every item-axis coordinate — an unassessed rights position never blocks capture', () => {
  for (const itemType of EVIDENCE_ITEM_TYPES) {
    const passage = passageAt({ itemType, componentClass: 'prose', status: 'source-supported' });
    assert.deepEqual(validate(evidenceSchema.$defs.passage, passage, { rootSchema: evidenceSchema }), []);
  }
  assert.deepEqual(validate(rightsRecordSchema, rightsRecordAt('UNKNOWN'), { rootSchema: rightsRecordSchema }), []);
});

// ---------------------------------------------------------------------------------------------
// LAYER 2(a) — schema-structural non-derivation
// ---------------------------------------------------------------------------------------------

test('D2 probe (a): no conditional clause in evidence.schema.json couples two axis fields', () => {
  const axisFields = ['evidence_item_type', 'rights_component_class', 'judgment_basis', 'status', 'passageFidelity'];
  assert.deepEqual(
    findSchemaAxisCouplings(evidenceSchema.$defs.passage, axisFields, 'evidence.schema.json#/$defs/passage'),
    [],
  );
});

test('D2 probe (a): evidence.schema.json never mentions a rights-authority field on the item surface, and rights_record.schema.json never mentions an item axis', () => {
  const propertyNames = new Set();
  (function collect(node) {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'properties' && value && typeof value === 'object') for (const name of Object.keys(value)) propertyNames.add(name);
      if (key !== 'description') collect(value);
    }
  })(evidenceSchema);
  for (const authority of RIGHTS_AUTHORITY_FIELDS) {
    assert.ok(!propertyNames.has(authority),
      `evidence.schema.json must not carry a \`${authority}\` property — the legal axis lives on the joined rights record (D4/D7)`);
  }

  const rightsText = JSON.stringify(rightsRecordSchema);
  for (const itemAxis of ITEM_AXIS_FIELDS) {
    assert.ok(!rightsText.includes(`"${itemAxis}"`),
      `rights_record.schema.json must not carry a \`${itemAxis}\` field — a rights record describes the source's rights, not our epistemic verdict`);
  }
});

test('AC-WP3-AXES: no `verbatim_excerpt_allowed`-style field duplicates passageFidelity on any capture surface — the vendored one is proven UNREACHABLE, not merely absent', () => {
  // The field does exist, in the vendored `schemas/rights/rights_extension.schema.json`. Two fields
  // that can disagree about whether verbatim reuse is permitted is a fail-open, so what matters is
  // that nothing in this repository can carry both. RF handoff §9.1 already re-homed the taxonomy off
  // `rights_extension` (EPR3-T2); this asserts the consequence.
  const rightsExtension = readJson('schemas/rights/rights_extension.schema.json');
  assert.ok('verbatim_excerpt_allowed' in rightsExtension.properties, 'sanity: the vendored field is the one being excluded');

  const evidenceText = JSON.stringify(evidenceSchema);
  for (const duplicate of ['verbatim_excerpt_allowed', 'shippable_claim_text_allowed', 'verbatimExcerptAllowed', 'reuse_allowed', 'quote_allowed']) {
    assert.ok(!evidenceText.includes(duplicate),
      `${duplicate} must not appear on the evidence-item surface — passageFidelity is the single field that states what kind of text was retained`);
  }

  // Unreachable in code as well as in schema: no runtime module validates against, imports, or
  // instantiates rights_extension, so no artifact can acquire the duplicate field.
  for (const file of runtimeSourceFiles()) {
    assert.ok(!stripJsComments(file.source).includes('rights_extension'),
      `${file.path}: no runtime module may instantiate or validate against rights_extension (handoff §9.1)`);
  }

  // passageFidelity remains the sole reuse-posture field on the passage record.
  const passageProperties = Object.keys(evidenceSchema.$defs.passage.properties);
  const reusePosture = passageProperties.filter((name) => /verbatim|excerpt|quote|reuse|fidelity/i.test(name));
  assert.deepEqual(reusePosture, ['passageFidelity']);
});

// ---------------------------------------------------------------------------------------------
// LAYER 2(b) — code-structural non-derivation
// ---------------------------------------------------------------------------------------------

/** Every runtime JS/MJS module the clinical path or the gates can execute. Tests are excluded. */
function runtimeSourceFiles() {
  const files = [];
  const stack = ['src', 'scripts'];
  while (stack.length > 0) {
    const relative = stack.pop();
    const absolute = path.join(REPO_ROOT, relative);
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) stack.push(child);
      else if (/\.(mjs|js)$/.test(entry.name)) files.push({ path: child, source: readFileSync(path.join(REPO_ROOT, child), 'utf8') });
    }
  }
  return files.sort((a, b) => byCodepoint(a.path, b.path));
}

test('D2 probe (b): no runtime module bridges the epistemic and legal axes, and no line derives one axis from another', () => {
  const files = runtimeSourceFiles();
  assert.ok(files.length > 20, 'sanity: the source walk found the runtime modules, not an empty directory');
  assert.deepEqual(findAxisCodeCouplings(files), []);
  assert.deepEqual(CROSS_BARRIER_FILE_ALLOWLIST, [],
    'the cross-barrier allowlist is frozen empty; adding an entry requires a plan amendment');
});

test('D2 probe (b) self-test: the detector actually fires on a seeded coupling (a gate nobody has seen fail is not a gate)', () => {
  const crossBarrier = findAxisCodeCouplings([{
    path: 'fake/infer.mjs',
    source: 'export const f = (p, r) => p.evidence_item_type && r.overall_status === "UNKNOWN";',
  }]);
  assert.ok(crossBarrier.some((v) => v.includes('rights-authority field')), 'a module reading an item axis and overall_status must be reported');

  const derivation = findAxisCodeCouplings([{
    path: 'fake/derive.mjs',
    source: 'const cls = p.evidence_item_type === "reference_interval_value" ? "table" : p.rights_component_class;',
  }]);
  assert.ok(derivation.some((v) => v.includes('branches across axes')), 'a line branching on one axis to produce another must be reported');

  // ...and does NOT fire on the two shapes that are legitimate and will appear in EPR3-T4/T5 code.
  assert.deepEqual(findAxisCodeCouplings([{
    path: 'fake/keyorder.mjs',
    source: "const PASSAGE_KEY_ORDER = ['evidence_item_type', 'judgment_basis', 'rights_component_class'];",
  }]), [], 'a key-order literal listing axis names is not a derivation');

  assert.deepEqual(findAxisCodeCouplings([{
    path: 'fake/prose.mjs',
    source: '// evidence_item_type === "table" would let us skip overall_status. We do not do that.\nexport const x = 1;\n',
  }]), [], 'a comment explaining why the inference is NOT made must not be flagged — otherwise the invariant punishes documenting itself');
});

test('the comment stripper leaves executable code intact and removes only comment bodies', () => {
  const stripped = stripJsComments([
    'const a = 1; // overall_status',
    '/* evidence_item_type */',
    'const b = "overall_status";',
    'const c = `evidence_item_type`;',
  ].join('\n'));
  assert.ok(stripped.includes('const a = 1;'));
  assert.ok(!stripped.includes('// overall_status'));
  assert.ok(!stripped.includes('/* evidence_item_type */'));
  assert.ok(stripped.includes('"overall_status"'), 'a string literal is code, not prose, and must survive stripping');
  assert.ok(stripped.includes('`evidence_item_type`'));
  assert.equal(stripped.split('\n').length, 4, 'line numbering must be preserved so violations report a usable line');
});

// ---------------------------------------------------------------------------------------------
// LAYER 2(c) — behavioural non-derivation
// ---------------------------------------------------------------------------------------------

test('AC-WP3-AXES: src/evidence.js#isBindableAsSourceSupported reads ONLY the epistemic axis — its verdict is invariant across all 140 (item_type x component_class) coordinates and all 7 overall_status values', () => {
  for (const status of PASSAGE_STATUSES) {
    const expected = status === 'source-supported';
    for (const itemType of EVIDENCE_ITEM_TYPES) {
      for (const componentClass of RIGHTS_COMPONENT_CLASSES) {
        const passage = passageAt({ itemType, componentClass, status });
        assert.equal(isBindableAsSourceSupported(passage), expected,
          `bindability changed with a non-epistemic axis (${itemType} x ${componentClass} x ${status}) — the predicate must read status and reviewFlags only`);

        // The legal axis is not even an argument: the predicate is unary. Varying the joined
        // record's disposition cannot reach it, and this asserts the arity that guarantees that.
        for (const overallStatus of AGENT_WRITABLE_OVERALL_STATUSES) {
          void rightsRecordAt(overallStatus);
          assert.equal(isBindableAsSourceSupported(passage), expected);
        }
      }
    }
  }
  assert.equal(isBindableAsSourceSupported.length, 1,
    'the predicate takes exactly one argument (the passage) — it has no channel through which a rights record could reach it');
});

test('AC-WP3-AXES: the epistemic axis DOES move the verdict — the invariance above is separation, not a stuck predicate', () => {
  const clean = passageAt({ itemType: 'observed_finding', componentClass: 'prose', status: 'source-supported' });
  assert.equal(isBindableAsSourceSupported(clean), true);
  assert.equal(isBindableAsSourceSupported({ ...clean, status: 'quarantined', reviewFlags: ['omits-source-numerics'] }), false);
  assert.equal(isBindableAsSourceSupported({ ...clean, reviewFlags: ['adds-claim-not-in-located-passage'] }), false);
});

test('D7: the ledger join resolves identically whatever the joined record concludes, and whatever the item carries — coverage, never clearance', () => {
  const ledger = {
    schema_version: '1.0.0',
    entries: [{ clinical_identifier_type: 'evidence_source_id', clinical_identifier: 'AAP2026_IDA', rights_record_id: 'RR-AAP2026_IDA' }],
  };
  const baseline = resolveRightsRecordsForIdentifier('evidence_source_id', 'AAP2026_IDA', {
    rightsLedger: ledger,
    rightsRecords: { records: [rightsRecordAt('UNKNOWN')] },
  });
  assert.deepEqual(baseline, { recordIds: ['RR-AAP2026_IDA'], errors: [] });

  for (const overallStatus of AGENT_WRITABLE_OVERALL_STATUSES) {
    assert.deepEqual(
      resolveRightsRecordsForIdentifier('evidence_source_id', 'AAP2026_IDA', {
        rightsLedger: ledger,
        rightsRecords: { records: [rightsRecordAt(overallStatus)] },
      }),
      baseline,
      `resolution changed at overall_status ${overallStatus} — a coverage gate that reads a disposition is a clearance gate (D7)`,
    );
  }
});

test('D7: sourceRightsPosition and passageApplicability read their own axis only — neither consults a rights record', () => {
  // Both are unary and take a source / a passage. Neither can see `overall_status`; assert that as
  // arity plus behaviour, so a future signature change that adds a rights-record parameter fails here.
  assert.equal(sourceRightsPosition.length, 1);
  assert.equal(passageApplicability.length, 1);

  const source = { id: 'AAP2026_IDA', license: { status: 'copyrighted' } };
  assert.equal(sourceRightsPosition(source), 'copyrighted',
    'the source-level rights LABEL comes from license.status, never from the joined record’s overall_status');
  assert.equal(sourceRightsPosition({ id: 'X' }), 'rights position unassessed');

  const proposal = passageAt({ itemType: 'observed_finding', componentClass: 'prose', status: 'implementation-proposal' });
  delete proposal.applicability;
  assert.deepEqual(passageApplicability(proposal), { age: null, sex: null, assay: null });
});

// ---------------------------------------------------------------------------------------------
// LAYER 2(d) — the data-shaped probe: functional dependency between axes
// ---------------------------------------------------------------------------------------------

test('AC-WP3-AXES: a seeded corpus in which rights_component_class is COMPUTED FROM evidence_item_type is detected as a collapse', () => {
  const derive = (itemType) => ({
    observed_finding: 'prose',
    reference_interval_value: 'table',
    equation_or_method: 'equation',
    guideline_recommendation: 'guideline_recommendation',
    instrument_or_questionnaire: 'questionnaire_or_instrument',
    bibliographic_metadata: 'bibliographic_metadata',
    derived_synthesis: 'other',
  }[itemType]);

  const coupled = EVIDENCE_ITEM_TYPES.map((itemType) => ({
    evidence_item_type: itemType,
    rights_component_class: derive(itemType),
  }));

  const findings = findAxisFunctionalDependencies(coupled, ['evidence_item_type', 'rights_component_class']);
  assert.ok(
    findings.some((finding) => finding.startsWith('rights_component_class is functionally determined by evidence_item_type')),
    'the seeded one-to-one mapping must be reported — this is exactly the collapse AC-WP3-AXES forbids',
  );

  // Every such fixture is ALSO individually schema-valid, which is why the schema check alone is not
  // sufficient and this data-shaped probe has to exist: a collapse is legal per-record and only
  // visible across the corpus.
  for (const record of coupled) {
    assert.deepEqual(
      validate(evidenceSchema.$defs.passage, passageAt({ itemType: record.evidence_item_type, componentClass: record.rights_component_class, status: 'source-supported' }), { rootSchema: evidenceSchema }),
      [],
    );
  }
});

test('AC-WP3-AXES: the fully-crossed corpus shows NO functional dependency between any ordered pair of axes', () => {
  const corpus = allAxisTuples().map((tuple) => ({
    evidence_item_type: tuple.itemType,
    rights_component_class: tuple.componentClass,
    status: tuple.status,
    overall_status: tuple.overallStatus,
  }));
  assert.deepEqual(
    findAxisFunctionalDependencies(corpus, ['evidence_item_type', 'rights_component_class', 'status', 'overall_status']),
    [],
  );
});

test('the dependency detector does not cry wolf: a constant axis, or a single record, is not evidence of collapse', () => {
  assert.deepEqual(findAxisFunctionalDependencies([{ a: 1, b: 'x' }], ['a', 'b']), [], 'one record can never demonstrate a dependency');
  assert.deepEqual(findAxisFunctionalDependencies([{ a: 1, b: 'x' }, { a: 2, b: 'x' }], ['a', 'b']), [], 'a constant target axis is not a dependency');
  assert.deepEqual(findAxisFunctionalDependencies([{ a: 1, b: 'x' }, { a: 1, b: 'y' }, { a: 2, b: 'x' }], ['a', 'b']), [], 'a genuinely many-to-many corpus is clean');
});

// The detector is deliberately NOT run against the committed 41 passage records (once EPR3-T5
// backfills them). Six sources and 41 records are far too small a corpus for "each item type happens
// to map to one component class" to be evidence of a code-level inference — it is an ordinary
// property of a small, homogeneous sample, and a gate that fires on it would be switched off within
// a week. What must not be inferable is the CODE PATH, which probes 2(a)-(c) constrain directly.
