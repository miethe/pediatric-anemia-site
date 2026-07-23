// tests/module-status-vocabulary.test.mjs — P1-04 (spa-module-switcher-v1, Phase 1).
//
// UNIT-TEST SCOPE ONLY. This file pins src/moduleStatusVocabulary.js's data shape and derivation
// behavior in isolation. It does NOT re-run the full doc-truth pin across index.html/src/app.js/
// dist/ — that is P6-004's job, later in this plan. Duplicating it here would create two sources
// of truth for the same assertion that could silently drift apart.
//
// PLAN-CITATION NOTE: the Phase 1 task table (phase-0-2-foundation.md, P1-02) instructs asserting
// the FR-34 staleness disclosure equal to a string it says lives at
// src/evidenceStalenessPolicy.js:11-14. As verified below, that is not the case as of this
// writing — those lines are a comment describing an obligation, and the file's one exported
// string (`EVIDENCE_STALENESS_POLICY.rationale`) is worded differently. This file instead pins
// the FR-34 sentence against its Must-priority source of truth, the PRD, and separately asserts
// the plan's citation does not hold today so the drift is visible rather than silently assumed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MODULE_STATUS_SENTENCES,
  getStatusSentence,
  UNKNOWN_STATUS_SENTINEL,
  deriveApprovedByClause,
  PANEL_HEADER,
  HONESTY_BOUNDARY_DISCLOSURE,
  EVIDENCE_STALENESS_DISCLOSURE,
  UNSIGNED_STUB_SUBTITLE,
  RULES_EMPTY_STATE,
  // P4-GATE fix 1 (spa-module-switcher-v1, Phase 4 post-review) — the four showModuleRefusal()
  // reason-derivation functions (src/moduleStatusVocabulary.js:127-172) had zero direct unit
  // tests: they are pure and node-importable, so D-6's "no browser automation" ceiling never
  // sheltered them from an executed test the way DOM-dependent src/app.js is sheltered.
  deriveEvidenceUnavailableReason,
  deriveNotYetImplementedReason,
  deriveKbLoadFailureReason,
  deriveUnregisteredModuleReason,
} from '../src/moduleStatusVocabulary.js';
import { MODULE_MANIFESTS } from '../src/moduleManifests.js';
import { MODULE_IDS } from '../src/modules/registry.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const readText = async (p) => readFile(p, 'utf8');

const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'module-manifest.schema.json');
const PRD_PATH = path.join(
  REPO_ROOT, 'docs', 'project_plans', 'PRDs', 'features', 'spa-module-switcher-v1.md',
);
const STALENESS_POLICY_PATH = path.join(REPO_ROOT, 'src', 'evidenceStalenessPolicy.js');
const VOCAB_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'moduleStatusVocabulary.js');
const MANIFESTS_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'moduleManifests.js');

// --- enum coverage, derived from the schema, not hand-copied ---------------------------------

test('P1-04: every closed-enum status value has exactly one canonical sentence, no extras', async () => {
  const schema = await readJson(SCHEMA_PATH);
  const enumValues = schema.properties.status.enum;
  assert.ok(Array.isArray(enumValues) && enumValues.length > 0, 'schema enum is empty — this test would be vacuous');

  const vocabKeys = Object.keys(MODULE_STATUS_SENTENCES);
  assert.deepEqual(
    [...vocabKeys].sort(),
    [...enumValues].sort(),
    'MODULE_STATUS_SENTENCES keys must exactly match schemas/module-manifest.schema.json\'s status '
      + 'enum — a future enum addition (or a stale extra key) must fail this test, not pass silently.',
  );

  for (const status of enumValues) {
    assert.equal(typeof MODULE_STATUS_SENTENCES[status], 'string');
    assert.ok(MODULE_STATUS_SENTENCES[status].length > 0, `${status}: sentence must not be empty`);
  }
});

test('P1-04: MODULE_STATUS_SENTENCES is frozen', () => {
  assert.ok(Object.isFrozen(MODULE_STATUS_SENTENCES));
});

// --- unknown status -> refusal sentinel, never a fallback string ------------------------------

test('P1-04: an unknown/absent status returns the refusal sentinel, never a friendlier default', () => {
  for (const bogus of ['not-a-real-status', '', 'released', undefined, null, 123, {}]) {
    assert.equal(getStatusSentence(bogus), UNKNOWN_STATUS_SENTINEL, `bogus input: ${JSON.stringify(bogus)}`);
  }
  assert.equal(typeof UNKNOWN_STATUS_SENTINEL, 'symbol', 'the sentinel must not be a plain string that could accidentally render as clinician-facing text');
  for (const status of Object.keys(MODULE_STATUS_SENTENCES)) {
    assert.notEqual(getStatusSentence(status), UNKNOWN_STATUS_SENTINEL, `${status} is a real enum value and must not hit the sentinel path`);
  }
});

// --- integrity-recorded: "recorded", never "verified" (D-3 corrects SQ-1 §4) -------------------

test('P1-04: integrity-recorded reads "recorded", never "verified" (source-variance note)', () => {
  const sentence = MODULE_STATUS_SENTENCES['integrity-recorded'];
  assert.match(sentence, /content hashes recorded only/);
  assert.doesNotMatch(sentence, /verified/i);
});

// --- four canonical sentences + panel header byte-match PRD §6.1.B-1 verbatim ------------------

test('P1-04: all four canonical sentences and the panel header are verbatim substrings of PRD §6.1.B-1', async () => {
  const prd = await readText(PRD_PATH);
  for (const [status, sentence] of Object.entries(MODULE_STATUS_SENTENCES)) {
    assert.ok(prd.includes(sentence), `${status}: sentence is not a byte-exact substring of the PRD — retyped incorrectly?\n${sentence}`);
  }
  assert.ok(prd.includes(PANEL_HEADER), 'PANEL_HEADER is not a byte-exact substring of the PRD');
});

// --- FR-13 honesty-boundary disclosure ---------------------------------------------------------

test('P1-04: FR-13 honesty-boundary disclosure is verbatim from the PRD', async () => {
  const prd = await readText(PRD_PATH);
  assert.ok(
    prd.includes(HONESTY_BOUNDARY_DISCLOSURE),
    'HONESTY_BOUNDARY_DISCLOSURE is not a byte-exact substring of the PRD (FR-13)',
  );
  assert.match(HONESTY_BOUNDARY_DISCLOSURE, /has not verified it/);
});

// --- FR-34 evidence-staleness disclosure --------------------------------------------------------

test('P1-04: FR-34 staleness disclosure is verbatim from the PRD', async () => {
  const prd = await readText(PRD_PATH);
  assert.ok(
    prd.includes(EVIDENCE_STALENESS_DISCLOSURE),
    'EVIDENCE_STALENESS_DISCLOSURE is not a byte-exact substring of the PRD (FR-34)',
  );
});

test('P1-04: plan-citation check — src/evidenceStalenessPolicy.js does NOT literally contain the FR-34 sentence today', async () => {
  const policySource = await readText(STALENESS_POLICY_PATH);
  assert.equal(
    policySource.includes(EVIDENCE_STALENESS_DISCLOSURE),
    false,
    'src/evidenceStalenessPolicy.js now contains the FR-34 sentence verbatim — if a future edit added '
      + 'it as an exported constant, moduleStatusVocabulary.js should import/reuse it per the original '
      + 'plan instruction instead of carrying its own literal copy. This assertion exists so that '
      + 'change is a deliberate, reviewed decision rather than something noticed by accident.',
  );
});

// --- FR-10 subtitle (unsigned-stub only) --------------------------------------------------------

test('P1-04: FR-10 subtitle is verbatim from the PRD', async () => {
  const prd = await readText(PRD_PATH);
  assert.equal(UNSIGNED_STUB_SUBTITLE, 'unsigned proposal · not clinically reviewed');
  assert.ok(prd.includes(UNSIGNED_STUB_SUBTITLE), 'UNSIGNED_STUB_SUBTITLE is not a byte-exact substring of the PRD (FR-10)');
});

// --- OQ-3 #rules empty state ---------------------------------------------------------------------

test('P1-04: OQ-3 rules-empty-state copy is verbatim from the PRD', async () => {
  const prd = await readText(PRD_PATH);
  assert.equal(RULES_EMPTY_STATE, 'This module contains no rules. No assessment can be produced from it.');
  assert.ok(prd.includes(RULES_EMPTY_STATE), 'RULES_EMPTY_STATE is not a byte-exact substring of the PRD (OQ-3)');
});

// --- FR-9: the approvedBy clause is DERIVED, never hardcoded ------------------------------------

test('P1-04: FR-9 clause is derived from approvedBy.length === 0 — a non-empty array changes the output', () => {
  const emptyClause = deriveApprovedByClause([]);
  const nonEmptyClause = deriveApprovedByClause(['Dr. A. Clinician, MD']);
  assert.notEqual(emptyClause, nonEmptyClause, 'the clause must differ for empty vs. non-empty approvedBy — otherwise it is a hardcoded constant, not a derivation');

  // Non-array / absent input must be treated as the safe (empty) case, never throw.
  assert.equal(deriveApprovedByClause(undefined), emptyClause);
  assert.equal(deriveApprovedByClause(null), emptyClause);

  // A second, differently-sized non-empty array must also differ from the first non-empty case,
  // proving the function reads .length rather than returning a second hardcoded string.
  const biggerClause = deriveApprovedByClause(['Dr. A', 'Dr. B']);
  assert.notEqual(biggerClause, nonEmptyClause);
});

test('P1-04: the FR-9 empty-approvedBy clause is byte-identical to the clause embedded in every canonical sentence', () => {
  const emptyClause = deriveApprovedByClause([]);
  assert.equal(emptyClause, 'approvedBy is empty: no credentialed clinician has reviewed or approved this module.');
  for (const [status, sentence] of Object.entries(MODULE_STATUS_SENTENCES)) {
    assert.ok(sentence.includes(emptyClause), `${status}: canonical sentence does not embed the derived FR-9 clause verbatim`);
  }
});

// --- prohibited vocabulary: no maturity-ladder / false-positive-affect wording ------------------
//
// A literal substring ban on every word in the plan's prohibited-token list is not possible: the
// PRD's own Must-priority verbatim text (FR-8's canonical sentences, FR-13's honesty-boundary
// sentence) necessarily contains "hash"/"hashes", "verified" (negated: "has not verified"), and
// "approved" (negated: "no ... has ... approved") — banning those substrings outright would make
// the mandated verbatim quotes impossible to write. What this file actually guards against is an
// AFFIRMATIVE claim of success/approval/verification/release, or maturity-ladder wording implying
// a pipeline stage toward release (gates-registry.md: unsigned-stub -> release-ready is schema-
// impossible). Those are checked precisely below.

test('P1-04: no maturity-ladder or false-attestation phrase anywhere in the vocabulary file', async () => {
  const source = (await readText(VOCAB_SOURCE_PATH)).toLowerCase();
  const bannedExactPhrases = [
    'integrity verified',
    'content unmodified',
    'coming soon',
    'temporarily unavailable',
    'preview',
    'beta',
    'released',
  ];
  const hits = bannedExactPhrases.filter((phrase) => source.includes(phrase));
  assert.deepEqual(hits, [], `banned maturity-ladder/false-attestation phrase(s) found: ${JSON.stringify(hits)}`);
});

test('P1-04: no affirmative approval/verification/release claim anywhere in the vocabulary file', async () => {
  const source = await readText(VOCAB_SOURCE_PATH);
  const affirmativeClaimPatterns = [
    /\bis\s+approved\b/i,
    /\bhas\s+been\s+approved\b/i,
    /\bwas\s+approved\b/i,
    /\bis\s+verified\b/i,
    /\bhas\s+been\s+verified\b/i,
    /\bwas\s+verified\b/i,
    /\bis\s+released\b/i,
    /\bhas\s+been\s+released\b/i,
    /\bintegrity\s+confirmed\b/i,
    /sha256:[0-9a-f]{64}/i,
  ];
  const hits = affirmativeClaimPatterns.filter((re) => re.test(source)).map((re) => re.source);
  assert.deepEqual(hits, [], `affirmative approval/verification/release pattern(s) matched: ${JSON.stringify(hits)}`);
});

test('P1-04: neither new file references DOM, fetch, or assess() (binding Phase 1 constraint)', async () => {
  for (const file of [VOCAB_SOURCE_PATH, MANIFESTS_SOURCE_PATH]) {
    const source = await readText(file);
    assert.doesNotMatch(source, /\bfetch\s*\(/, `${file}: must not call fetch()`);
    assert.doesNotMatch(source, /\bdocument\./, `${file}: must not touch document`);
    assert.doesNotMatch(source, /\bwindow\./, `${file}: must not touch window`);
    assert.doesNotMatch(source, /\bassess\s*\(/, `${file}: must not call assess()`);
  }
});

// --- src/moduleManifests.js: frozen map keyed by every registered module id --------------------

test('P1-04: MODULE_MANIFESTS is frozen and keyed by exactly the registered MODULE_IDS', () => {
  assert.ok(Object.isFrozen(MODULE_MANIFESTS));
  assert.deepEqual([...Object.keys(MODULE_MANIFESTS)].sort(), [...MODULE_IDS].sort());
  for (const id of MODULE_IDS) {
    assert.equal(MODULE_MANIFESTS[id].id, id, `MODULE_MANIFESTS.${id}.id must equal '${id}'`);
  }
});

test('P1-04: src/moduleManifests.js has zero references to verifyManifest, build-info, or any digest/hash API', async () => {
  const source = await readText(MANIFESTS_SOURCE_PATH);
  assert.doesNotMatch(source, /verifyManifest/);
  assert.doesNotMatch(source, /build-info/i);
  assert.doesNotMatch(source, /\bhash(es)?\b/i, 'moduleManifests.js must not reference "hash"/"hashes" anywhere, including comments');
  assert.doesNotMatch(source, /\bdigest\b/i);
});

test('P1-04: src/moduleManifests.js uses no template-literal import specifier', async () => {
  const source = await readText(MANIFESTS_SOURCE_PATH);
  const importLines = source.split('\n').filter((line) => line.trim().startsWith('import '));
  assert.equal(importLines.length, 4, 'expected exactly 4 import statements');
  for (const line of importLines) {
    assert.doesNotMatch(line, /\$\{/, `template-literal specifier found: ${line}`);
    assert.match(line, /with\s*\{\s*type:\s*'json'\s*\}/, `import must use the JSON import-attribute form: ${line}`);
  }
});

// ================================================================================================
// P4-GATE fix 1 — direct unit tests for the four Phase 4 showModuleRefusal() reason-derivation
// functions (FR-15/FR-16/FR-18/FR-21, src/moduleStatusVocabulary.js:127-172). Exact-string
// assertions with title/id substitution, per case, plus a distinctness check across all four —
// "all 4 refusal cases individually tested" (P4-GATE's own spec wording).
// ================================================================================================

test('P4-GATE fix 1: deriveEvidenceUnavailableReason (FR-15, Case 1) substitutes the module title verbatim', () => {
  assert.equal(
    deriveEvidenceUnavailableReason('Pediatric CBC Suite'),
    'No assessment produced — evidence not available for module Pediatric CBC Suite.',
  );
  // A second, differently-titled call must differ — proving substitution, not a hardcoded string.
  assert.equal(
    deriveEvidenceUnavailableReason('Pediatric Kidney Suite'),
    'No assessment produced — evidence not available for module Pediatric Kidney Suite.',
  );
  assert.match(deriveEvidenceUnavailableReason('X'), /^No assessment produced — evidence not available for module X\.$/);
});

test('P4-GATE fix 1: deriveNotYetImplementedReason (FR-16, Case 2) substitutes the module title verbatim', () => {
  assert.equal(
    deriveNotYetImplementedReason('Pediatric Growth Suite'),
    'Pediatric Growth Suite is a package scaffold — no clinical logic is implemented. No '
      + 'assessment can be produced from this module.',
  );
  assert.equal(
    deriveNotYetImplementedReason('Pediatric Kidney Suite'),
    'Pediatric Kidney Suite is a package scaffold — no clinical logic is implemented. No '
      + 'assessment can be produced from this module.',
  );
  assert.match(deriveNotYetImplementedReason('X'), /^X is a package scaffold — no clinical logic is implemented\./);
});

test('P4-GATE fix 1: deriveKbLoadFailureReason (FR-18, Case 4) substitutes the module title verbatim', () => {
  assert.equal(
    deriveKbLoadFailureReason('Pediatric CBC Suite'),
    "Unable to load module Pediatric CBC Suite's knowledge base.",
  );
  assert.equal(
    deriveKbLoadFailureReason('Pediatric Anemia'),
    "Unable to load module Pediatric Anemia's knowledge base.",
  );
  assert.match(deriveKbLoadFailureReason('X'), /^Unable to load module X's knowledge base\.$/);
});

test('P4-GATE fix 1: deriveUnregisteredModuleReason (FR-21, P4-07) quotes the requested id verbatim, never a title', () => {
  assert.equal(
    deriveUnregisteredModuleReason('not_a_module'),
    'No module is registered with id "not_a_module". No assessment can be produced. Choose a '
      + 'listed module below — this app never substitutes a different module automatically.',
  );
  // A different id must produce a differently-quoted string — proving substitution.
  const other = deriveUnregisteredModuleReason('bogus_id_123');
  assert.match(other, /"bogus_id_123"/);
  assert.doesNotMatch(other, /not_a_module/);
});

test('P4-GATE fix 1: all four reason derivations produce distinct strings for the same input (no accidental aliasing)', () => {
  const sameInput = 'anemia';
  const outputs = new Set([
    deriveEvidenceUnavailableReason(sameInput),
    deriveNotYetImplementedReason(sameInput),
    deriveKbLoadFailureReason(sameInput),
    deriveUnregisteredModuleReason(sameInput),
  ]);
  assert.equal(outputs.size, 4, 'all 4 refusal-case reason strings must be distinct, even given the identical input');
});

test('P4-GATE fix 1: none of the four derived reasons contains a maturity-ladder or false-attestation phrase', () => {
  const sample = [
    deriveEvidenceUnavailableReason('Sample Module'),
    deriveNotYetImplementedReason('Sample Module'),
    deriveKbLoadFailureReason('Sample Module'),
    deriveUnregisteredModuleReason('sample_module'),
  ].join(' ').toLowerCase();
  const bannedExactPhrases = [
    'integrity verified', 'content unmodified', 'coming soon', 'temporarily unavailable',
    'preview', 'beta', 'released',
  ];
  const hits = bannedExactPhrases.filter((phrase) => sample.includes(phrase));
  assert.deepEqual(hits, [], `banned phrase(s) found in a derived reason string: ${JSON.stringify(hits)}`);
});
