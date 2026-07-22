// tests/rights-decision-brief-generator.test.mjs — EPR4-T2 (FR-WP4-02, decisions-block D5/D6).
//
// Proves scripts/rights/build-decision-brief.mjs:
//   - is DETERMINISTIC: two runs against unchanged input, separated by real wall-clock time,
//     produce byte-identical output — both through the exported pure functions and through the
//     real CLI entry point.
//   - contains no `Date.now()` and no zero-argument `new Date()` anywhere in the file (the
//     acceptance criterion's own `grep` check, re-asserted here so a regression fails the suite
//     rather than only a manual grep).
//   - resolves both an `--item` (a passage id, and a synthetic `derived_synthesis` id) and a
//     `--binding` (a rule id and a candidate id, via `sourcePassageId`).
//   - redacts non-paraphrase passage text (D1/D5): a "withheld" passage's `exactPassage` never
//     appears in generated output.
//   - states the recorded rights position AS RECORDED — never invents a `CLEARED_*` status, never
//     upgrades an `UNKNOWN` overall_status, and never marks a synthesis `attested` (D6).
//   - fails closed on an unrecognized item-id shape, an unknown item/entity, and a malformed
//     invocation, without crashing.
//
// This is EPR4-T2's own test; the dedicated D5 contamination GATE (asserting no generated brief
// contains a verbatim span from a restricted source, as a gate rather than a review note) is
// EPR4-T3's tests/rights-brief-contamination.test.mjs and is not duplicated here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyItemId,
  findEvidenceItem,
  buildAtomsForPassage,
  buildItemBrief,
  resolveRightsPositionForSource,
  generateDecisionBrief,
  renderDecisionBriefMarkdown,
  parseArgs,
  resolveAsOfDate,
  assertSynthesisAttestationIsCandidateOnly,
} from '../scripts/rights/build-decision-brief.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GENERATOR_SCRIPT = path.join(REPO_ROOT, 'scripts', 'rights', 'build-decision-brief.mjs');

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function runCli(args) {
  return spawnSync(process.execPath, [GENERATOR_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

// --- determinism: static source check ---------------------------------------------------------

test('the generator source contains no Date.now() and no zero-argument new Date()', () => {
  const source = readFileSync(GENERATOR_SCRIPT, 'utf8');
  assert.doesNotMatch(source, /Date\.now\s*\(/, 'must never read the system clock via Date.now()');
  assert.doesNotMatch(source, /new Date\s*\(\s*\)/, 'must never construct a zero-argument new Date()');
});

// --- determinism: byte-identical across real wall-clock time, pure-function path ---------------

test('generateDecisionBrief is byte-identical across two calls separated by real wall-clock time (--item)', async () => {
  const opts = parseArgs(['--item', 'AAP2026_IDA#ev_002'], {});
  const first = await generateDecisionBrief(REPO_ROOT, opts);
  await sleep(30);
  const second = await generateDecisionBrief(REPO_ROOT, opts);
  assert.deepEqual(first, second, 'unchanged input must produce a structurally identical brief regardless of when it is generated');
  assert.equal(renderDecisionBriefMarkdown(first), renderDecisionBriefMarkdown(second), 'rendered markdown must be byte-identical');
});

test('generateDecisionBrief is byte-identical across two calls separated by real wall-clock time (--binding)', async () => {
  const opts = parseArgs(['--binding', 'SCOPE-001', '--entity-type', 'rule'], {});
  const first = await generateDecisionBrief(REPO_ROOT, opts);
  await sleep(30);
  const second = await generateDecisionBrief(REPO_ROOT, opts);
  assert.deepEqual(first, second);
  assert.equal(renderDecisionBriefMarkdown(first), renderDecisionBriefMarkdown(second));
});

test('an explicit --as-of value is reproduced verbatim and never substituted by wall-clock time', async () => {
  const opts = parseArgs(['--item', 'AAP2026_IDA#ev_002', '--as-of', '2026-01-15T00:00:00.000Z'], {});
  const brief = await generateDecisionBrief(REPO_ROOT, opts);
  assert.equal(brief.generated_as_of, '2026-01-15T00:00:00.000Z');
});

test('omitting --as-of never falls back to the current instant: no generated_as_of field at all', async () => {
  const opts = parseArgs(['--item', 'AAP2026_IDA#ev_002'], {});
  const brief = await generateDecisionBrief(REPO_ROOT, opts);
  assert.equal('generated_as_of' in brief, false);
});

test('resolveAsOfDate reads the RIGHTS_BRIEF_AS_OF env var only when no --as-of flag is present', () => {
  const opts = parseArgs(['--item', 'X#ev_001'], { RIGHTS_BRIEF_AS_OF: '2026-02-02' });
  const date = resolveAsOfDate(opts.asOfRaw);
  assert.equal(date.toISOString().slice(0, 10), '2026-02-02');
});

test('resolveAsOfDate rejects an unparsable value rather than silently degrading', () => {
  assert.throws(() => resolveAsOfDate('not-a-date'), /not a valid ISO 8601/);
});

// --- determinism: byte-identical across real wall-clock time, CLI entry point ------------------

test('CLI: two spawned runs of the same invocation are byte-identical stdout', () => {
  const args = ['--item', 'AAP2026_IDA#ev_002'];
  const first = runCli(args);
  const second = runCli(args);
  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.equal(first.stdout, second.stdout);
});

test('CLI: --format json output is deterministic and parses back to the same structure', () => {
  const args = ['--item', 'AAP2026_IDA#ev_002', '--format', 'json'];
  const first = runCli(args);
  const second = runCli(args);
  assert.equal(first.status, 0);
  assert.deepEqual(JSON.parse(first.stdout), JSON.parse(second.stdout));
});

// --- item resolution: passage ------------------------------------------------------------------

test('classifyItemId recognizes passage ids, synthesis ids, and rejects everything else', () => {
  assert.equal(classifyItemId('AAP2026_IDA#ev_001'), 'passage');
  assert.equal(classifyItemId('AAP2026_IDA#implementation-proposal'), 'passage');
  assert.equal(classifyItemId('SYNTH_FOO_001'), 'synthesis');
  assert.equal(classifyItemId('not-an-id'), null);
  assert.equal(classifyItemId(''), null);
  assert.equal(classifyItemId(undefined), null);
});

test('a brief for a real passage carries independently-worded atoms, its locator, and the recorded rights position', async () => {
  const opts = parseArgs(['--item', 'AAP2026_IDA#ev_002'], {});
  const brief = await generateDecisionBrief(REPO_ROOT, opts);
  assert.equal(brief.item_type, 'passage');
  assert.equal(brief.brief_kind, 'evidence_item');
  assert.ok(brief.decision_question.length > 0, 'must state the specific question the human must answer');
  assert.ok(brief.atoms.length > 0);
  for (const atom of brief.atoms) {
    assert.ok(atom.structured_locator, 'every atom must carry its structured locator');
    assert.ok(atom.evidence_item_type);
    assert.ok(atom.rights_component_class);
  }
  assert.ok(brief.rights_position, 'a passage item must carry the source rights position');
  assert.equal(brief.rights_position.source_id, 'AAP2026_IDA');
  assert.ok(Array.isArray(brief.rights_position.rights_records));
  assert.ok(brief.rights_position.rights_records.length > 0);
});

// --- item resolution: derived_synthesis (synthetic fixture; committed KB ships zero) -----------

function fixtureEvidenceDocWithSynthesis() {
  return {
    knowledgeBaseVersion: 'test',
    reviewedThrough: '2026-01-01',
    sources: [],
    derived_syntheses: [
      {
        id: 'SYNTH_TEST_001',
        evidence_item_type: 'derived_synthesis',
        synthesis: {
          input_refs: [
            { evidence_item_id: 'AAP2026_IDA#ev_002', rights_record_id: null, contribution: 'anchor' },
            { evidence_item_id: 'WHO2024_HB#ev_001', rights_record_id: null, contribution: 'corroborating' },
          ],
          method: 'Independently combined two reported intervals into one first-party statement.',
          divergence_notes: [],
          reproduces_source_arrangement: false,
          first_party_rights_holder: null,
          attestation: { status: 'candidate', attestation_record: null },
        },
      },
    ],
  };
}

test('findEvidenceItem resolves a synthetic derived_synthesis by id', () => {
  const doc = fixtureEvidenceDocWithSynthesis();
  const found = findEvidenceItem(doc, 'SYNTH_TEST_001');
  assert.equal(found.kind, 'synthesis');
  assert.equal(found.synthesis.id, 'SYNTH_TEST_001');
});

test('findEvidenceItem returns null for a recognized-shape id with no matching record', () => {
  const doc = fixtureEvidenceDocWithSynthesis();
  assert.equal(findEvidenceItem(doc, 'SYNTH_DOES_NOT_EXIST'), null);
  assert.equal(findEvidenceItem({ sources: [] }, 'NOSUCH#ev_001'), null);
});

test('a synthesis brief never claims attested and never invents a rights_record of its own (D3/D6/DEF-R4)', async () => {
  const doc = fixtureEvidenceDocWithSynthesis();
  const found = findEvidenceItem(doc, 'SYNTH_TEST_001');
  const rightsLedger = JSON.parse(readFileSync(path.join(REPO_ROOT, 'rights', 'rights-ledger.json'), 'utf8'));
  const rightsRecords = JSON.parse(readFileSync(path.join(REPO_ROOT, 'rights', 'rights-records.json'), 'utf8'));
  const brief = buildItemBrief(found, { evidenceDoc: doc, rightsLedger, rightsRecords });
  assert.equal(brief.item_type, 'derived_synthesis');
  assert.equal(brief.synthesis.attestation_status, 'candidate');
  assert.equal(brief.rights_position, null);
  assert.ok(Array.isArray(brief.inputs));
  assert.equal(brief.inputs.length, 2);
  // one input resolves against the real committed KB; the markdown render must not throw.
  const md = renderDecisionBriefMarkdown(brief);
  assert.match(md, /Attributed inputs/);
  assert.match(md, /candidate/);
});

// --- EPR4-T6 (FR-WP4-07, D3/D6): authoritative derived_synthesis is unreachable -----------------
//
// AC-WP4-T6 negative criterion: "a fixture asking the generator to emit an authoritative
// derived_synthesis fails; the generator's only reachable synthesis output is a candidate." The
// committed evidence schema already makes a non-"candidate" `attestation.status` unreachable in
// any file that passes `npm run validate` (schemas/evidence.schema.json's pairing rule), but that
// is a gate over committed JSON, not a property of this generator — a hand-built in-memory fixture
// (exactly what these tests construct) bypasses schema validation entirely. These tests exercise
// the generator's OWN defense (`assertSynthesisAttestationIsCandidateOnly`), not the schema gate.

function fixtureSynthesisWithStatus(status) {
  const doc = fixtureEvidenceDocWithSynthesis();
  doc.derived_syntheses[0].synthesis.attestation.status = status;
  return doc;
}

test('assertSynthesisAttestationIsCandidateOnly accepts a candidate synthesis and rejects every other status', () => {
  const candidate = fixtureEvidenceDocWithSynthesis().derived_syntheses[0];
  assert.doesNotThrow(() => assertSynthesisAttestationIsCandidateOnly(candidate));

  for (const status of ['attested', 'authoritative', 'approved', undefined, null, '']) {
    const bad = fixtureSynthesisWithStatus(status).derived_syntheses[0];
    assert.throws(
      () => assertSynthesisAttestationIsCandidateOnly(bad),
      /only reachable synthesis output is a candidate/,
      `status ${JSON.stringify(status)} must be rejected, not passed through`,
    );
  }
});

test('a fixture asking the generator to emit an authoritative derived_synthesis fails (negative criterion, AC-WP4-T6)', () => {
  const doc = fixtureSynthesisWithStatus('attested');
  const found = findEvidenceItem(doc, 'SYNTH_TEST_001');
  const rightsLedger = JSON.parse(readFileSync(path.join(REPO_ROOT, 'rights', 'rights-ledger.json'), 'utf8'));
  const rightsRecords = JSON.parse(readFileSync(path.join(REPO_ROOT, 'rights', 'rights-records.json'), 'utf8'));
  assert.throws(
    () => buildItemBrief(found, { evidenceDoc: doc, rightsLedger, rightsRecords }),
    /only reachable synthesis output is a candidate/,
    'the generator must refuse to brief a synthesis it cannot label candidate, not silently copy the status through',
  );
});

test('a nested attributed-input synthesis carrying a non-candidate status also fails the outer brief (recursive defense)', () => {
  const doc = fixtureEvidenceDocWithSynthesis();
  // A second, nested synthesis, attributed as an input of the first — with a bad status.
  doc.derived_syntheses.push({
    id: 'SYNTH_TEST_NESTED',
    evidence_item_type: 'derived_synthesis',
    synthesis: {
      input_refs: [{ evidence_item_id: 'AAP2026_IDA#ev_002', rights_record_id: null, contribution: 'anchor' }],
      method: 'A nested first-party synthesis.',
      divergence_notes: [],
      reproduces_source_arrangement: false,
      first_party_rights_holder: null,
      attestation: { status: 'attested', attestation_record: null },
    },
  });
  doc.derived_syntheses[0].synthesis.input_refs.push(
    { evidence_item_id: 'SYNTH_TEST_NESTED', rights_record_id: null, contribution: 'corroborating' },
  );
  const found = findEvidenceItem(doc, 'SYNTH_TEST_001');
  const rightsLedger = JSON.parse(readFileSync(path.join(REPO_ROOT, 'rights', 'rights-ledger.json'), 'utf8'));
  const rightsRecords = JSON.parse(readFileSync(path.join(REPO_ROOT, 'rights', 'rights-records.json'), 'utf8'));
  assert.throws(
    () => buildItemBrief(found, { evidenceDoc: doc, rightsLedger, rightsRecords }),
    /only reachable synthesis output is a candidate/,
    'a non-candidate status buried in an attributed input must also fail the whole brief, not be silently dropped',
  );
});

// --- EPR4-T6 (FR-WP4-07, D5): one screen per decision, question stated first --------------------

test('the rendered markdown states the decision question in the FIRST block, before every other section', async () => {
  const itemOpts = parseArgs(['--item', 'AAP2026_IDA#ev_002'], {});
  const itemBrief = await generateDecisionBrief(REPO_ROOT, itemOpts);
  const itemMd = renderDecisionBriefMarkdown(itemBrief);
  const questionIdx = itemMd.indexOf('**Decision question:**');
  const itemSectionIdx = itemMd.indexOf('## Item');
  assert.ok(questionIdx > -1, 'the decision-question block must be present');
  assert.ok(itemSectionIdx > -1, 'the Item section must be present');
  assert.ok(questionIdx < itemSectionIdx, 'the decision question must precede every other section, including ## Item');

  const bindingOpts = parseArgs(['--binding', 'SCOPE-001', '--entity-type', 'rule'], {});
  const bindingBrief = await generateDecisionBrief(REPO_ROOT, bindingOpts);
  const bindingMd = renderDecisionBriefMarkdown(bindingBrief);
  const bindingQuestionIdx = bindingMd.indexOf('**Decision question:**');
  const bindingItemSectionIdx = bindingMd.indexOf('## Item');
  assert.ok(bindingQuestionIdx > -1 && bindingQuestionIdx < bindingItemSectionIdx);
});

test('a generated brief covers exactly one decision: a single item_id and a single decision_question, never a list', async () => {
  const opts = parseArgs(['--item', 'AAP2026_IDA#ev_002'], {});
  const brief = await generateDecisionBrief(REPO_ROOT, opts);
  assert.equal(typeof brief.item_id, 'string', 'item_id must be a single id, not a collection');
  assert.equal(typeof brief.decision_question, 'string', 'decision_question must be a single question, not a collection');
  // --item and --binding are mutually exclusive (asserted elsewhere in this file) and each
  // invocation resolves exactly one entity id — there is no flag shape through which a single
  // invocation could request more than one decision.
});

// --- binding resolution: rule and candidate -----------------------------------------------------

test('a binding brief for a rule resolves via sourcePassageId and states a two-sided decision question', async () => {
  const opts = parseArgs(['--binding', 'SCOPE-001', '--entity-type', 'rule'], {});
  const brief = await generateDecisionBrief(REPO_ROOT, opts);
  assert.equal(brief.brief_kind, 'binding');
  assert.equal(brief.binding.entity_type, 'rule');
  assert.equal(brief.binding.entity_id, 'SCOPE-001');
  assert.match(brief.decision_question, /CLINICAL \+ RIGHTS ADJUDICATION REQUIRED/);
  assert.equal(typeof brief.binding.currently_bindable_source_supported, 'boolean');
});

test('a binding brief for a candidate resolves via sourcePassageId', async () => {
  const opts = parseArgs(['--binding', 'iron-deficiency-anemia', '--entity-type', 'candidate'], {});
  const brief = await generateDecisionBrief(REPO_ROOT, opts);
  assert.equal(brief.brief_kind, 'binding');
  assert.equal(brief.binding.entity_type, 'candidate');
  assert.equal(brief.binding.entity_id, 'iron-deficiency-anemia');
});

// --- D1/D5 contamination discipline: redaction of non-paraphrase text --------------------------

test('buildAtomsForPassage never surfaces exactPassage text for a "withheld" passage', () => {
  const passage = {
    id: 'X#ev_001',
    status: 'quarantined',
    passageFidelity: 'withheld',
    exactPassage: '[withheld pending rights clearance]',
    evidence_item_type: 'guideline_recommendation',
    rights_component_class: 'prose',
    judgment_basis: 'unassessed',
    structured_locator: { source: 'X' },
  };
  const { atoms, notes } = buildAtomsForPassage(passage);
  assert.equal(atoms.some((a) => a.kind === 'passage_paraphrase'), false, 'withheld text must never become an atom');
  assert.ok(notes.some((n) => n.includes('withheld')));
});

test('buildAtomsForPassage never surfaces exactPassage text for a hypothetical "verbatim" passage', () => {
  const passage = {
    id: 'X#ev_002',
    status: 'source-supported',
    reviewFlags: [],
    passageFidelity: 'verbatim',
    exactPassage: 'a real quoted sentence copied from a restricted source',
    evidence_item_type: 'guideline_recommendation',
    rights_component_class: 'prose',
    judgment_basis: 'unassessed',
    structured_locator: { source: 'X' },
  };
  const { atoms, notes } = buildAtomsForPassage(passage);
  assert.equal(atoms.some((a) => a.text.includes('a real quoted sentence')), false);
  assert.ok(notes.some((n) => n.includes('verbatim')));
});

test('buildAtomsForPassage emits no atom for the implementation-proposal sentinel', () => {
  const passage = {
    id: 'X#implementation-proposal',
    status: 'implementation-proposal',
    passageFidelity: 'paraphrase',
    exactPassage: '',
    evidence_item_type: 'bibliographic_metadata',
    rights_component_class: 'bibliographic_metadata',
    judgment_basis: 'unassessed',
    structured_locator: { source: 'X' },
  };
  const { atoms, notes } = buildAtomsForPassage(passage);
  assert.equal(atoms.length, 0);
  assert.ok(notes.some((n) => n.includes('implementation-proposal sentinel')));
});

test('buildAtomsForPassage surfaces numeric_recapture per_value_atoms as their own atoms', () => {
  const passage = {
    id: 'X#ev_003',
    status: 'quarantined',
    passageFidelity: 'paraphrase',
    exactPassage: 'A paraphrase of the located passage.',
    evidence_item_type: 'reference_interval_value',
    rights_component_class: 'table',
    judgment_basis: 'unassessed',
    structured_locator: { source: 'X' },
    numeric_recapture: {
      resolution: 'per_value_atoms',
      reason: 'transcribed as reported',
      atoms: [
        {
          label: 'Lower limit, 6-24mo',
          value: '<10.5',
          unit: 'g/dL',
          evidence_item_type: 'reference_interval_value',
          rights_component_class: 'table',
          judgment_basis: 'unassessed',
          judgment_basis_attestation: null,
          structured_locator: { source: 'X', table: 'Table 1', row: 'Hb', column: 'Lower' },
          not_captured: [{ kind: 'table_structure', rationale: 'per-value atoms captured instead' }],
        },
      ],
    },
  };
  const { atoms } = buildAtomsForPassage(passage);
  const numericAtoms = atoms.filter((a) => a.kind === 'numeric_value');
  assert.equal(numericAtoms.length, 1);
  assert.match(numericAtoms[0].text, /<10\.5 g\/dL/);
});

// --- rights position: as recorded, never a clearance --------------------------------------------

test('resolveRightsPositionForSource reports overall_status exactly as recorded, never a CLEARED_* value', () => {
  const rightsLedger = JSON.parse(readFileSync(path.join(REPO_ROOT, 'rights', 'rights-ledger.json'), 'utf8'));
  const rightsRecords = JSON.parse(readFileSync(path.join(REPO_ROOT, 'rights', 'rights-records.json'), 'utf8'));
  const source = { id: 'AAP2026_IDA', title: 't', organization: 'AAP', access_basis: 'institutional_subscription', license: { status: 'copyrighted' }, terms: {} };
  const position = resolveRightsPositionForSource(source, rightsLedger, rightsRecords);
  assert.ok(position.rights_records.length > 0);
  for (const record of position.rights_records) {
    assert.equal(record.overall_status, 'UNKNOWN');
    assert.doesNotMatch(String(record.overall_status), /^CLEARED_/);
  }
});

test('a generated brief never contains the literal string "CLEARED_" anywhere', async () => {
  const opts = parseArgs(['--item', 'AAP2026_IDA#ev_002'], {});
  const brief = await generateDecisionBrief(REPO_ROOT, opts);
  const rendered = renderDecisionBriefMarkdown(brief);
  assert.doesNotMatch(rendered, /CLEARED_/);
  assert.doesNotMatch(JSON.stringify(brief), /CLEARED_/);
});

// --- error handling: fails closed, never crashes uncontrolled ------------------------------------

test('CLI: an unrecognized item-id shape exits non-zero with a clear message', () => {
  const result = runCli(['--item', 'not-a-recognized-shape']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not a recognized evidence-item id/);
});

test('CLI: an unknown (but well-shaped) item id exits non-zero', () => {
  const result = runCli(['--item', 'NOPE_SOURCE#ev_999']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /was not found/);
});

test('CLI: an unknown rule id exits non-zero', () => {
  const result = runCli(['--binding', 'NOPE-999', '--entity-type', 'rule']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /was not found/);
});

test('CLI: --binding without --entity-type exits non-zero', () => {
  const result = runCli(['--binding', 'SCOPE-001']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires --entity-type/);
});

test('CLI: no arguments at all exits non-zero', () => {
  const result = runCli([]);
  assert.notEqual(result.status, 0);
});

test('CLI: --item and --binding together are rejected as mutually exclusive', () => {
  const result = runCli(['--item', 'AAP2026_IDA#ev_002', '--binding', 'SCOPE-001', '--entity-type', 'rule']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mutually exclusive/);
});

test('parseArgs rejects an unrecognized flag', () => {
  assert.throws(() => parseArgs(['--nope', 'x'], {}), /unrecognized argument/);
});
