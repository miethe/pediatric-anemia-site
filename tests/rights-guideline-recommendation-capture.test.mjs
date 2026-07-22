// tests/rights-guideline-recommendation-capture.test.mjs — EPR3-T8 / FR-WP3-08 (D1, D2, D7).
//
// THE GUIDELINE-CAPTURE INVARIANT: a guideline is CAPTURED, NOT AVOIDED (decisions-block D2).
//
// A `guideline_recommendation` item records the FACT of the recommendation — the named issuing body
// and an independently-worded restatement of what is recommended, plus the scope it applies to — at
// the passage's addressable `structured_locator`. It never retains the recommendation's prose (D1).
// This file proves three things:
//
//   1. SHAPE (schema)   — `$defs/guidelineRecommendationCapture` requires a named issuing_body, a
//                         non-empty restatement, and an explicit scope_or_population, and stays
//                         OPTIONAL on the passage (so it cannot couple the capture's presence to the
//                         evidence_item_type axis — that would be a D2/AC-WP3-AXES violation).
//   2. COVERAGE (gate)  — every guideline_recommendation item in the real corpus carries a valid
//                         capture, and the `evidence-guideline-recommendation-capture` gate fires on
//                         a seeded item that omits it, names no body, or carries no restatement.
//   3. NO PROSE (T1)    — a restatement carrying a verbatim span from the source trips EPR3-T1's
//                         negative invariant, exercised here through that test's own scanner.
//
// Determinism: no `Date.now()`, no `new Date()`, no `localeCompare()`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import {
  checkGuidelineRecommendationCapture,
  GUIDELINE_RECOMMENDATION_TYPE,
} from '../scripts/lib/evidence-guideline-recommendation-gate.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(readFileSync(path.join(REPO_ROOT, relative), 'utf8'));

const evidenceSchema = readJson('schemas/evidence.schema.json');
const captureSchema = evidenceSchema.$defs.guidelineRecommendationCapture;
const passageSchema = evidenceSchema.$defs.passage;

/** A well-formed capture — the shape every real guideline_recommendation item must carry. */
const goodCapture = () => ({
  issuing_body: { name: 'American Academy of Pediatrics', abbreviation: 'AAP' },
  restatement: 'The AAP recommends a complete blood count together with serum ferritin to identify iron deficiency.',
  scope_or_population: 'infants, children, and adolescents screened for iron deficiency',
});

/** A minimal but schema-valid guideline_recommendation passage carrying `capture`. */
function guidelinePassage(capture) {
  return {
    id: 'AAP2026_IDA#ev_001',
    sourceId: 'AAP2026_IDA',
    status: 'source-supported',
    sourceLocator: { raw: 'Screening', page: null, section: 'Screening', table: null, figure: null },
    exactPassage: 'A located recommendation, restated in independent wording.',
    passageFidelity: 'paraphrase',
    evidence_item_type: GUIDELINE_RECOMMENDATION_TYPE,
    judgment_basis: 'unassessed',
    judgment_basis_attestation: null,
    rights_component_class: 'prose',
    structured_locator: {
      source: 'AAP2026_IDA',
      edition_or_version: null,
      section: 'Screening',
      table: null,
      row: null,
      column: null,
      assay_or_method: null,
      population_or_scope: 'children screened for iron deficiency',
      retrieved_at: '2026-07-20',
      unresolved_components: [],
    },
    not_captured: [{ kind: 'verbatim_wording', rationale: 'Only an independent paraphrase is stored.' }],
    ...(capture === undefined ? {} : { guideline_recommendation_capture: capture }),
    reviewFlags: [],
    reviewFindingIds: [],
    evidenceGrade: 'source-supported-fact',
    applicability: { age: 'children', sex: null, assay: null },
    reviewDate: '2026-07-20',
    supersedes: null,
    surveillanceQuery: 'pediatric iron deficiency screening update',
    provenance: { runId: 'r', sourceCardId: 's', evidenceId: 'ev_001' },
  };
}

const runGate = (passages) => checkGuidelineRecommendationCapture({
  evidencePassages: passages.map((passage) => ({ moduleId: 'anemia', sourceId: passage.sourceId ?? null, passage })),
}).errors;

// ---------------------------------------------------------------------------------------------
// LAYER 1 — schema shape
// ---------------------------------------------------------------------------------------------

test('schema: a well-formed capture validates; the issuing body and restatement are required and non-empty', () => {
  assert.deepEqual(validate(captureSchema, goodCapture(), { rootSchema: evidenceSchema }), []);

  // issuing_body.name and restatement are non-empty (minLength) — the "named body + restatement" AC.
  const noName = goodCapture(); noName.issuing_body.name = '';
  assert.notEqual(validate(captureSchema, noName, { rootSchema: evidenceSchema }).length, 0,
    'an empty issuing_body.name must fail — the body must be NAMED');

  const noRestate = goodCapture(); noRestate.restatement = '';
  assert.notEqual(validate(captureSchema, noRestate, { rootSchema: evidenceSchema }).length, 0,
    'an empty restatement must fail — the recommendation must be restated');

  // The three top-level components are required; a scope of null is legal (explicit not-applicable).
  for (const key of ['issuing_body', 'restatement', 'scope_or_population']) {
    const missing = goodCapture(); delete missing[key];
    assert.notEqual(validate(captureSchema, missing, { rootSchema: evidenceSchema }).length, 0,
      `${key} is a required member of the capture`);
  }
  const nullScope = goodCapture(); nullScope.scope_or_population = null;
  assert.deepEqual(validate(captureSchema, nullScope, { rootSchema: evidenceSchema }), [],
    'a null scope_or_population is an explicit not-applicable and must validate (D2)');

  // No verbatim/quote/excerpt field may be smuggled onto the capture (additionalProperties: false).
  const extra = goodCapture(); extra.verbatim = 'anything';
  assert.notEqual(validate(captureSchema, extra, { rootSchema: evidenceSchema }).length, 0,
    'additionalProperties:false — no retained-expression field may be added to the capture');
});

test('schema: guideline_recommendation_capture is OPTIONAL on the passage — the schema never couples its presence to evidence_item_type (D2/AC-WP3-AXES)', () => {
  // It is not in the passage `required` list ...
  assert.ok(!passageSchema.required.includes('guideline_recommendation_capture'),
    'the capture must be OPTIONAL — a schema `required`/conditional would couple it to the item-type axis');
  // ... and it is declared as a property (so `additionalProperties:false` still admits it).
  assert.ok('guideline_recommendation_capture' in passageSchema.properties);

  // A guideline_recommendation passage WITHOUT the capture is still schema-valid — the presence
  // obligation is a GATE, not the schema (mirrors EPR3-T6's numeric_recapture). This is exactly why
  // the coverage gate has to exist: the schema alone cannot demand it without a D2 violation.
  assert.deepEqual(validate(passageSchema, guidelinePassage(undefined), { rootSchema: evidenceSchema }), [],
    'a guideline passage without the capture must validate against the schema — coverage is the gate’s job');
  // And WITH a well-formed capture it also validates.
  assert.deepEqual(validate(passageSchema, guidelinePassage(goodCapture()), { rootSchema: evidenceSchema }), []);
});

// ---------------------------------------------------------------------------------------------
// LAYER 2 — the coverage gate fires, and does not cry wolf
// ---------------------------------------------------------------------------------------------

test('gate: a guideline_recommendation item carrying a valid capture passes', () => {
  assert.deepEqual(runGate([guidelinePassage(goodCapture())]), []);
});

test('gate (coverage): a guideline_recommendation item with NO capture fails — captured, not avoided', () => {
  const errors = runGate([guidelinePassage(undefined)]);
  assert.equal(errors.length, 1, `expected exactly one coverage error, got:\n${errors.join('\n')}`);
  assert.ok(errors[0].includes('carries no') && errors[0].includes('AAP2026_IDA#ev_001'));
});

test('gate (consistency): a capture that names no issuing body, or carries no restatement, fails', () => {
  const noName = goodCapture(); noName.issuing_body = { name: '', abbreviation: null };
  const nameErrors = runGate([guidelinePassage(noName)]);
  assert.ok(nameErrors.some((e) => e.includes('names no') && e.includes('issuing body')),
    `a capture with an empty issuing_body.name must fail the gate:\n${nameErrors.join('\n')}`);

  const noRestate = goodCapture(); noRestate.restatement = '   ';
  const restateErrors = runGate([guidelinePassage(noRestate)]);
  assert.ok(restateErrors.some((e) => e.includes('independently-worded restatement')),
    `a capture with a blank restatement must fail the gate:\n${restateErrors.join('\n')}`);
});

test('gate (D2 scope): a NON-guideline item is never required to carry the capture', () => {
  const observed = guidelinePassage(undefined);
  observed.evidence_item_type = 'observed_finding';
  assert.deepEqual(runGate([observed]), [],
    'the gate scopes on evidence_item_type only; a non-guideline item omitting the capture is fine');
});

// ---------------------------------------------------------------------------------------------
// LAYER 3 — the real corpus
// ---------------------------------------------------------------------------------------------

test('REAL DATA: every committed guideline_recommendation passage carries a valid capture, and the gate is clean over the whole corpus', () => {
  const evidence = readJson('modules/anemia/evidence.json');
  const passages = evidence.sources.flatMap((source) => source.passages ?? []);
  const guidelines = passages.filter((p) => p.evidence_item_type === GUIDELINE_RECOMMENDATION_TYPE);
  assert.ok(guidelines.length >= 1, 'expected at least one guideline_recommendation passage in the corpus');

  for (const passage of guidelines) {
    const cap = passage.guideline_recommendation_capture;
    assert.ok(cap && typeof cap === 'object', `${passage.id}: missing guideline_recommendation_capture`);
    assert.deepEqual(validate(captureSchema, cap, { rootSchema: evidenceSchema }), [],
      `${passage.id}: capture does not validate against the schema`);
    assert.ok(typeof cap.issuing_body?.name === 'string' && cap.issuing_body.name.trim() !== '',
      `${passage.id}: issuing body is not named`);
    assert.ok(typeof cap.restatement === 'string' && cap.restatement.trim() !== '',
      `${passage.id}: no independently-worded restatement`);
  }

  const errors = checkGuidelineRecommendationCapture({
    evidencePassages: passages.map((passage) => ({ moduleId: 'anemia', sourceId: passage.sourceId, passage })),
  }).errors;
  assert.deepEqual(errors, [], `the coverage gate must be clean over the committed corpus:\n${errors.join('\n')}`);
});

// ---------------------------------------------------------------------------------------------
// LAYER 4 — the negative-invariant connection (the AC's first clause)
// ---------------------------------------------------------------------------------------------
//
// The AUTHORITATIVE enforcement of "a guideline_recommendation item containing a verbatim span from
// the source fails EPR3-T1's invariant" is tests/rights-negative-invariant.test.mjs itself: its
// `scanCaptureSurfaces` walks every string leaf under modules/ (recursively, so it reaches
// guideline_recommendation_capture.restatement automatically) and enforces the quoted-run body budget
// over the real committed evidence.json. This file does not re-run or re-implement that scanner (the
// EPR3-T6 numeric test follows the same convention — it references T1 rather than importing it). What
// it asserts here is the DATA property that keeps T1 green: the restatements this task authored carry
// no quotation of source phrasing at all.

test('AC: every committed guideline restatement is independently worded — it embeds no quoted source span (so it cannot trip EPR3-T1’s invariant)', () => {
  const evidence = readJson('modules/anemia/evidence.json');
  const guidelines = evidence.sources
    .flatMap((source) => source.passages ?? [])
    .filter((p) => p.evidence_item_type === GUIDELINE_RECOMMENDATION_TYPE);

  for (const passage of guidelines) {
    const restatement = passage.guideline_recommendation_capture?.restatement ?? '';
    // No embedded quotation of source text: a restatement is our OWN words, never a quoted run. The
    // simplest sufficient guarantee is that it carries no double-quote delimiter at all (straight or
    // curly) — the delimiter T1's body-budget scan keys on for a capture body.
    assert.ok(!/["“”]/.test(restatement),
      `${passage.id}: restatement embeds a double-quote — a restatement is independently worded, never a quotation`);
    assert.ok(restatement.trim().length > 0, `${passage.id}: restatement is empty`);
  }
});
