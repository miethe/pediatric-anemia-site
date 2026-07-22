// tests/rights-brief-contamination.test.mjs — EPR4-T3 (FR-WP4-03, decisions-block D5).
//
// THE CLEAN-ROOM CONTAMINATION GUARD.
//
// docs/workflows/clean-room-authoring.md and scripts/rights/build-decision-brief.mjs
// (EPR4-T1/T2) exist so an agent can prepare a decision-ready brief and a human spends scarce
// minutes reading it instead of raw JSON (D5). That defense only works if the brief SUMMARISES
// source guidance and never QUOTES it into the implementation record: a brief that reproduces a
// verbatim span from a restricted source (a) is itself the exact D1 violation the rest of this
// feature exists to prevent, committed one layer downstream of the evidence records D1 already
// guards, and (b) hands a clinician a rework loop — they adjudicate a "clean" summary that turns
// out to be contaminated, and every downstream decision built on it has to be redone.
//
// So this file is a GATE, not a review note. `npm test` runs it; a contamination signal in
// generated brief output makes the run — and therefore `npm run check` — exit non-zero. Nobody
// has to remember to look.
//
// SCOPE: THIS CHECKS GENERATOR **OUTPUT**, NOT GENERATOR SOURCE.
// ---------------------------------------------------------------------------------------------
// tests/rights-decision-brief-generator.test.mjs (EPR4-T2's own test) already proves
// `buildAtomsForPassage` redacts non-paraphrase text at the point atoms are constructed. This
// file does not re-litigate that — it sits one layer downstream and inspects the *rendered brief
// a human actually reads* (both `--format markdown`, the default "one screen per decision"
// surface, and the structured text fields of the `--format json` object), independent of which
// code path produced it. That independence is the point: if a future change adds a new atom
// kind, a new brief section, or otherwise bypasses `buildAtomsForPassage`'s redaction, a check
// that only re-tested that one function would not notice. A check over the final rendered
// surface still would. This file never modifies `scripts/rights/build-decision-brief.mjs`
// (EPR4-T2's file, not this task's); it only reads the generator's exported functions and real
// committed data.
//
// Both scans are scoped to the fields the generator's own header comment names as content DRAWN
// FROM SOURCE — atom text and notes (object side), and the rendered "## Atoms" / "## Notes"
// sections (markdown side) — not the whole object or the whole document. Two constructs the
// template itself introduces are deliberately out of scope, and are NOT contamination:
// "## Scope / population" renders `JSON.stringify(sp.applicability)`, whose double-quote-per-key
// shape is JSON syntax, not a quoted excerpt; and every decision question quotes a short
// first-party rule/candidate id and category title purely for readability
// (`buildBindingDecisionQuestion` et al. — see `collectBriefTextFields`'s comment below). Scanning
// either would flag this project's own template formatting and first-party naming as if it were
// reproduced source text.
//
// THE DETECTOR IS A STRUCTURAL PROXY, NOT A DIFF AGAINST SOURCE TEXT — RESIDUAL GAP R-1 APPLIES.
// ---------------------------------------------------------------------------------------------
// Exactly as tests/rights-negative-invariant.test.mjs's header records for the capture-surface
// gate (R-1, OPEN, NOT CLOSED): the only sound way to prove a string is not a near-verbatim
// reproduction of restricted source text is to diff it against that source text, and this
// repository is forbidden from holding that text (D1) — there is nothing on disk to diff
// against. What this file enforces, like that one, is a *proxy*: a quoted-run budget over
// generated brief output. A brief that announces a span as a quotation (straight or curly double
// quotes, or an unambiguous single-quote pair) beyond a short word budget fails. A brief that
// silently reuses source phrasing without quote marks would pass this check undetected — that
// gap is real, is not closed here, and stays open until an independent fidelity audit (of the
// kind DEF-R5 already ran once over the capture surfaces) covers generated brief output too. Do
// not read a green run of this file as proof no generated brief has ever reproduced source
// phrasing; it is proof no *detectable* (quote-announced) reproduction currently exists in
// generator output over the committed knowledge base, and that the detector demonstrably fires
// when one is present.
//
// This file's quoted-run detector is a self-contained copy of the same technique
// tests/rights-negative-invariant.test.mjs applies to capture-surface JSON, deliberately not
// imported from that file: importing a sibling test module would re-run its own top-level
// `test()` registrations a second time under this file, and the two gates watch different
// surfaces (committed capture JSON there; generated brief output here) that must be free to
// diverge without one file's edit silently reshaping the other's assertions.
//
// Determinism: no `Date.now()`, no `new Date()`, no `localeCompare()` — same discipline as every
// other rights-substrate gate in this feature.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_IDS } from '../src/modules/registry.js';
import {
  parseArgs,
  generateDecisionBrief,
  renderDecisionBriefMarkdown,
} from '../scripts/rights/build-decision-brief.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------------------------
// The detector. A quoted run beyond the budget, wherever it appears in generated brief output,
// is treated as a potential verbatim reproduction of restricted source text — the brief's job is
// to state atoms in independent wording (D5), so an announced quotation of any length is already
// a signal something upstream reused source phrasing rather than restating it.
// ---------------------------------------------------------------------------------------------

/** Word budget for a quoted run inside GENERATED BRIEF OUTPUT. Deliberately tight: a brief atom
 * is meant to be independently worded prose, not an excerpt, so even a short announced quotation
 * is a signal, not a false positive waiting to happen. Mirrors the body budget in
 * tests/rights-negative-invariant.test.mjs's capture-surface detector (8-word disqualifying
 * spans in the EP3-T5 audit; budget set one below that, at 7). */
const CONTAMINATION_QUOTED_RUN_BUDGET_WORDS = 7;

function wordCount(text) {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Extract quoted runs from a string. Straight and curly double quotes are unambiguous. Single
 * quotes only count when neither delimiter abuts a letter/digit, so a possessive apostrophe
 * ("AAP's", "the module's") is never mistaken for a quotation.
 *
 * @returns {string[]}
 */
export function extractQuotedRuns(text) {
  const patterns = [
    /"([^"]{2,}?)"/g,
    /“([^”]{2,}?)”/g,
    /(?<![\p{L}\p{N}])'([^']{2,}?)'(?![\p{L}\p{N}])/gu,
    /(?<![\p{L}\p{N}])‘([^’]{2,}?)’(?![\p{L}\p{N}])/gu,
  ];
  const runs = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) runs.push(match[1]);
  }
  return runs;
}

/**
 * Scans one piece of rendered/plain brief-output text for a contaminating quoted run.
 * @returns {string[]} violations, sorted deterministically. Empty means clean.
 */
export function scanBriefOutputForContamination(text) {
  if (typeof text !== 'string' || text === '') return [];
  const violations = [];
  for (const run of extractQuotedRuns(text)) {
    const words = wordCount(run);
    if (words > CONTAMINATION_QUOTED_RUN_BUDGET_WORDS) {
      violations.push(
        `quoted run of ${words} words in generated brief output exceeds the `
        + `${CONTAMINATION_QUOTED_RUN_BUDGET_WORDS}-word budget — the brief must independently `
        + `paraphrase, never quote, source guidance (D5): "${run}"`,
      );
    }
  }
  return violations.sort();
}

/**
 * Walks a brief OBJECT (the pre-serialization structure `generateDecisionBrief` returns, and
 * what `--format json` emits) and collects every field the generator's own header comment
 * documents as content it draws FROM SOURCE material: atom text, notes, and — for a
 * `derived_synthesis` — its first-party `method` / `divergence_notes`, recursing into any
 * resolved input's own brief. This is the JSON-shaped counterpart to scanning rendered markdown:
 * it operates on individual field VALUES rather than the serialized JSON text, so it is not
 * defeated by the fact that every JSON string is itself double-quote-delimited.
 *
 * DELIBERATELY EXCLUDES `decision_question`: per the generator's header comment, the decision
 * question is synthesized boilerplate the generator itself authors (`buildItemDecisionQuestion` /
 * `buildBindingDecisionQuestion` / `buildSynthesisDecisionQuestion`) — never content drawn from a
 * source passage. It legitimately quotes short first-party identifiers (a rule/candidate id, or
 * this project's own category `title`, e.g. "Anemia of inflammation / inflammatory iron
 * restriction pattern") purely for readability. Scanning it would flag that first-party
 * formatting convention as if it were reproduced source text — a false positive that would
 * either desensitize this gate or force every candidate/rule label under an 8-word ceiling for
 * reasons that have nothing to do with rights.
 */
function collectBriefTextFields(brief, out = []) {
  if (!brief || typeof brief !== 'object') return out;
  for (const atom of brief.atoms ?? []) {
    if (typeof atom?.text === 'string') out.push(atom.text);
  }
  for (const note of brief.notes ?? []) {
    if (typeof note === 'string') out.push(note);
  }
  if (brief.synthesis) {
    if (typeof brief.synthesis.method === 'string') out.push(brief.synthesis.method);
    for (const note of brief.synthesis.divergence_notes ?? []) {
      if (typeof note === 'string') out.push(note);
    }
  }
  for (const input of brief.inputs ?? []) {
    if (input?.resolved) collectBriefTextFields(input.resolved, out);
  }
  return out;
}

/** @returns {string[]} violations across every independently-worded field of a brief object. */
export function scanBriefObjectForContamination(brief) {
  const violations = [];
  for (const text of collectBriefTextFields(brief)) {
    violations.push(...scanBriefOutputForContamination(text));
  }
  return violations.sort();
}

/**
 * Extracts the body of one `## <headingText>` markdown section from a rendered brief (everything
 * up to the next `## ` heading or end of document). Returns `''` when the heading is absent.
 */
function extractMarkdownSection(md, headingText) {
  const lines = md.split('\n');
  const startIndex = lines.findIndex((line) => line.startsWith(`## ${headingText}`));
  if (startIndex === -1) return '';
  const body = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) break;
    body.push(lines[i]);
  }
  return body.join('\n');
}

/**
 * Scans ONLY the "## Atoms" and "## Notes" sections of a RENDERED markdown brief — the sections
 * that render `atom.text` / `brief.notes[]`, the same source-drawn surface
 * `collectBriefTextFields` walks on the object side. Deliberately does not scan the whole
 * document: "## Scope / population" renders `JSON.stringify(sp.applicability)`, and the decision
 * question renders a quoted first-party id/title (see `collectBriefTextFields`'s comment above) —
 * both are template formatting, not source-drawn content, and scanning them would produce the
 * same false positives on the rendered-output side that excluding `decision_question` avoids on
 * the object side.
 */
export function scanRenderedBriefForContamination(md) {
  const atomsSection = extractMarkdownSection(md, 'Atoms');
  const notesSection = extractMarkdownSection(md, 'Notes');
  return [
    ...scanBriefOutputForContamination(atomsSection),
    ...scanBriefOutputForContamination(notesSection),
  ].sort();
}

// ---------------------------------------------------------------------------------------------
// Seeded fixtures — the detector must actually fire (AC-WP4-T3: "a seeded fixture whose atom
// carries a verbatim span from a restricted source makes the gate exit non-zero"). Every fixture
// string below is authored fresh for this test file, never copied from a real captured field or
// from tests/rights-negative-invariant.test.mjs's own allowlisted spans — it stands in for
// "restricted source text" without ever being retained third-party expression itself (D1: this
// is a transient in-memory test value, never written to a capture surface).
// ---------------------------------------------------------------------------------------------

/**
 * A minimal, well-shaped brief object matching what `buildPassageItemBrief` returns, EXCEPT its
 * one atom's `text` carries a long quoted run — as if a future regression bypassed
 * `buildAtomsForPassage`'s redaction and let a restricted-source excerpt reach the brief. This
 * simulates the failure this gate exists to catch; it is never produced by the real generator
 * over real committed data (proven separately below).
 */
function contaminatedFixtureBrief() {
  return {
    brief_kind: 'evidence_item',
    item_id: 'FIXTURE_SOURCE#ev_999',
    item_type: 'passage',
    module_id: 'fixture',
    evidence_item_type: 'guideline_recommendation',
    rights_component_class: 'prose',
    judgment_basis: 'unassessed',
    status: 'quarantined',
    passage_fidelity: 'paraphrase',
    source: { id: 'FIXTURE_SOURCE', title: 'Fixture Source', organization: 'Fixture Org', year: 2026 },
    atoms: [
      {
        kind: 'passage_paraphrase',
        text: 'the fixture guideline states "screening should occur for every otherwise healthy '
          + 'infant between the ages of six and twenty four months regardless of risk factors" per '
          + 'section 3',
        evidence_item_type: 'guideline_recommendation',
        rights_component_class: 'prose',
        judgment_basis: 'unassessed',
        structured_locator: { source: 'FIXTURE_SOURCE', section: '3' },
      },
    ],
    scope_and_population: { applicability: null, locator_population_or_scope: null, guideline_scope_or_population: null },
    not_captured: [],
    rights_position: null,
    notes: [],
    decision_question: 'RIGHTS REVIEW REQUIRED: fixture decision question for the contamination guard test.',
  };
}

/** The same shape, but with an independently-worded atom carrying no announced quotation. */
function cleanFixtureBrief() {
  const brief = contaminatedFixtureBrief();
  brief.atoms = [
    {
      ...brief.atoms[0],
      text: 'the fixture guideline recommends screening otherwise healthy infants between six and '
        + 'twenty four months of age, independent of the source wording, per section 3',
    },
  ];
  return brief;
}

test('scanBriefObjectForContamination fires on a fixture atom carrying a verbatim-shaped quoted span', () => {
  const violations = scanBriefObjectForContamination(contaminatedFixtureBrief());
  assert.ok(violations.length > 0, 'a contaminated atom must produce at least one violation');
  assert.ok(violations[0].includes('D5'), 'the violation message must point at the D5 discipline it enforces');
});

test('scanRenderedBriefForContamination fires on the RENDERED MARKDOWN of the same contaminated fixture', () => {
  const md = renderDecisionBriefMarkdown(contaminatedFixtureBrief());
  const violations = scanRenderedBriefForContamination(md);
  assert.ok(violations.length > 0, 'the contamination must be detectable in the final rendered output a human reads, not only in the object');
});

test('a clean fixture brief — same shape, independently-worded atom — passes both scans', () => {
  const brief = cleanFixtureBrief();
  assert.deepEqual(scanBriefObjectForContamination(brief), [], 'a clean brief object must produce zero violations');
  const md = renderDecisionBriefMarkdown(brief);
  assert.deepEqual(scanRenderedBriefForContamination(md), [], 'clean rendered markdown must produce zero violations');
});

test('the quoted-run detector does not fire on possessive apostrophes (a false-positive-prone gate gets switched off)', () => {
  assert.deepEqual(extractQuotedRuns("AAP's own guidance names the module's six sources"), []);
  assert.deepEqual(extractQuotedRuns('the brief said "hello there"'), ['hello there']);
});

test('determinism: scanning the same contaminated fixture twice returns byte-identical violations', () => {
  const brief = contaminatedFixtureBrief();
  assert.deepEqual(scanBriefObjectForContamination(brief), scanBriefObjectForContamination(brief));
  const md = renderDecisionBriefMarkdown(brief);
  assert.deepEqual(scanRenderedBriefForContamination(md), scanRenderedBriefForContamination(md));
});

// ---------------------------------------------------------------------------------------------
// THE GATE: every real committed evidence item and every real rule/candidate binding, generated
// through the real (unmodified) generator, must scan clean. This is what "runs over generator
// output, not over reviewer assurance" means in practice — nobody has to remember to eyeball a
// brief; if a future edit to the generator, an evidence-item record, or a rule/candidate ever
// lets a quote-announced span reach rendered output, this loop's assertion fails and `npm test`
// (and therefore `npm run check`) exits non-zero.
// ---------------------------------------------------------------------------------------------

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function collectRealItemIds(moduleId) {
  const evidenceDoc = await readJson(path.join(REPO_ROOT, 'modules', moduleId, 'evidence.json'));
  const ids = [];
  for (const source of evidenceDoc.sources ?? []) {
    for (const passage of source.passages ?? []) ids.push(passage.id);
  }
  for (const synthesis of evidenceDoc.derived_syntheses ?? []) ids.push(synthesis.id);
  return ids;
}

async function collectRealBindingIds(moduleId) {
  const [rules, candidates] = await Promise.all([
    readJson(path.join(REPO_ROOT, 'modules', moduleId, 'rules.json')),
    readJson(path.join(REPO_ROOT, 'modules', moduleId, 'candidates.json')),
  ]);
  const ruleIds = (Array.isArray(rules) ? rules : [])
    .filter((r) => r.sourcePassageId)
    .map((r) => r.id);
  const candidateIds = Object.values(candidates ?? {})
    .filter((c) => c.sourcePassageId)
    .map((c) => c.id);
  return { ruleIds, candidateIds };
}

test('GATE: every real evidence item, across every module, generates a brief that scans clean', async () => {
  const allViolations = [];
  let scannedCount = 0;
  for (const moduleId of MODULE_IDS) {
    const itemIds = await collectRealItemIds(moduleId);
    for (const itemId of itemIds) {
      const opts = parseArgs(['--item', itemId, '--module', moduleId], {});
      const brief = await generateDecisionBrief(REPO_ROOT, opts);
      const md = renderDecisionBriefMarkdown(brief);
      const violations = [
        ...scanBriefObjectForContamination(brief),
        ...scanRenderedBriefForContamination(md),
      ];
      if (violations.length > 0) {
        allViolations.push(`${moduleId}::${itemId}:\n  ${violations.join('\n  ')}`);
      }
      scannedCount += 1;
    }
  }
  assert.ok(scannedCount > 0, 'expected at least one real evidence item to scan — an empty sweep proves nothing');
  assert.deepEqual(allViolations, [], `contamination detected in real generated output:\n${allViolations.join('\n')}`);
});

test('GATE: every real rule and candidate binding, across every module, generates a brief that scans clean', async () => {
  const allViolations = [];
  let scannedCount = 0;
  for (const moduleId of MODULE_IDS) {
    const { ruleIds, candidateIds } = await collectRealBindingIds(moduleId);
    const targets = [
      ...ruleIds.map((id) => ({ id, entityType: 'rule' })),
      ...candidateIds.map((id) => ({ id, entityType: 'candidate' })),
    ];
    for (const { id, entityType } of targets) {
      const opts = parseArgs(['--binding', id, '--entity-type', entityType, '--module', moduleId], {});
      const brief = await generateDecisionBrief(REPO_ROOT, opts);
      const md = renderDecisionBriefMarkdown(brief);
      const violations = [
        ...scanBriefObjectForContamination(brief),
        ...scanRenderedBriefForContamination(md),
      ];
      if (violations.length > 0) {
        allViolations.push(`${moduleId}::${entityType}:${id}:\n  ${violations.join('\n  ')}`);
      }
      scannedCount += 1;
    }
  }
  assert.ok(scannedCount > 0, 'expected at least one real rule/candidate binding to scan — an empty sweep proves nothing');
  assert.deepEqual(allViolations, [], `contamination detected in real generated output:\n${allViolations.join('\n')}`);
});

test('R-1 is recorded as OPEN, not closed, for this brief-output gate too', () => {
  // Self-check, mirroring tests/rights-negative-invariant.test.mjs's own self-check: proves the
  // header actually states the limits of what this file proves, rather than only asserting it in
  // prose that could silently drift from the code.
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const header = self.slice(0, self.indexOf('import test'));
  assert.ok(header.includes('RESIDUAL GAP R-1') || header.includes('R-1 APPLIES'),
    'the header must name residual gap R-1');
  assert.ok(header.includes('OPEN, NOT CLOSED') || header.includes('stays open'),
    'the header must record R-1 as open, not closed');
  assert.ok(header.includes('proxy'), 'the header must state the detector is a structural proxy, not a source-text diff');
  assert.ok(header.includes("this repository is forbidden") || header.includes('nothing on disk to diff'),
    'the header must state why no diff against real source text is possible here');
});
