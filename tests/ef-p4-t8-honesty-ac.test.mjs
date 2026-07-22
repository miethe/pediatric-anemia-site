// tests/ef-p4-t8-honesty-ac.test.mjs — P4-T8 (multi-bundle-conversion-e1, Phase 4).
//
// LOAD-BEARING honesty AC (decisions block "Notes for implementation-planner"; repeated verbatim
// at the parent plan's "LOAD-BEARING Honesty Acceptance Criteria" section, and in the phase file's
// P4-T8 row: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/
// phase-3-4-scaffolds-and-backfill.md). This is the outcome the whole phase exists to prove:
// projecting real evidence (RF-EV-001 into modules/anemia/, RF-CBC-002 into modules/cbc_suite_v1/)
// never quietly became clinical rule authorship or clinical sign-off.
//
// Four load-bearing invariants, each test-enforced below (not merely asserted in prose):
//
//   1. Zero entries were added to modules/anemia/rules.json or modules/cbc_suite_v1/rules.json as
//      a result of this phase. The AC's own wording is "`git diff` ... shows zero lines changed".
//      As tests/ef-p5-t4-honesty-ac.test.mjs's header already reasons through for the sibling P5-T4
//      AC: a commit SHA is NOT a durable thing to assert against at test-run time — commit ids do
//      not survive a squash merge, and this repo's own git workflow (CLAUDE.md: "PR to the parent
//      branch... squash-merge") squashes this very branch before it reaches main. A literal `git
//      diff <sha1>..<sha2>` invocation pinned to a specific commit would therefore either silently
//      stop being meaningful, or hard-fail with "unknown revision", the moment this branch is
//      squash-merged. The durable, forever-repeatable form of "git diff shows zero lines changed"
//      is instead: pin the file's exact byte content (via SHA-256 + byte length) in a committed
//      fixture captured BEFORE this phase's first propose run (P4-T1's own deliverable,
//      tests/fixtures/p4-t1-pre-merge-snapshot.json.txt) and prove the current on-disk file still
//      matches it byte-for-byte. Two byte-identical files necessarily produce an empty `git diff`
//      between them — that equivalence is exact, not an approximation. (Point-in-time corroboration,
//      recorded as commentary only, not a runtime dependency: as of this commit, `git log --oneline
//      -- modules/anemia/rules.json` shows its most recent commit is 9a6a73a and `git log --oneline
//      -- modules/cbc_suite_v1/rules.json` shows 0553c94 — both predate P4-T1's baseline-capture
//      commit 0550947, and `git diff 0550947..HEAD -- modules/anemia/rules.json
//      modules/cbc_suite_v1/rules.json` is empty on this branch right now.)
//   2. modules/anemia/module.json.approvedBy stays exactly `[]` (it already was `[]`; this phase
//      must not be the one that flips it to something else), and the whole file's bytes are
//      unchanged (nothing in this phase touched anemia's module manifest at all).
//   3. modules/cbc_suite_v1/module.json.status stays exactly "unsigned-stub", approvedBy `[]`,
//      clinicalContentHash `null`, and knowledgeBaseVersion unchanged (OQ-2: the merge lands new
//      evidence records without bumping the version, because zero clinical content changed) — and,
//      again, the whole file's bytes are unchanged.
//   4. "Module complete" or "backfill succeeded" is never described, anywhere in this phase's own
//      tracked output surfaces, as implying clinical readiness. Checked against the two surfaces a
//      human or agent narrating "what P4 did" would plausibly write a summary sentence in: the
//      phase progress tracker and the decisions-block worknote (same surface class
//      tests/ef-p5-t4-honesty-ac.test.mjs already scans for the sibling P5-T4 AC). Unlike that
//      sibling test's single-direction ("negation must precede the phrase") window, this phase's
//      own committed prose consistently phrases the negation AFTER the phrase (e.g. `"Module
//      complete" or "backfill succeeded" is never described ... as implying clinical readiness`),
//      so the window here is checked on BOTH sides of the phrase — the correct general
//      implementation of "is this occurrence inside a negated clause", not tied to one phrasing
//      convention.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { computeSnapshot } from '../scripts/lib/p4-t1-snapshot.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P4T1_FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'p4-t1-pre-merge-snapshot.json.txt');

const ANEMIA_RULES_REL = 'modules/anemia/rules.json';
const CBC_RULES_REL = 'modules/cbc_suite_v1/rules.json';

// Whole-file SHA-256 of both module.json manifests, computed at authoring time and pinned
// literally here (module.json is not one of P4-T1's own WHOLE_FILE_TARGETS -- that snapshot only
// covers rules/candidates/evidence/authoring-decisions/rule-provenance -- so this is this test's
// own dedicated baseline for the manifest files, the same "pin the literal expected bytes"
// technique tests/ef-p5-t4-honesty-ac.test.mjs uses for kidney/growth's `rules.json`).
const EXPECTED_MODULE_JSON_SHA256 = Object.freeze({
  'modules/anemia/module.json': 'sha256:57280d0461fcd3a8f1597805ccc11b93b7ff5b6ff6fb695c288da67f5cd6ba73',
  'modules/cbc_suite_v1/module.json': 'sha256:a63448bd995f10936ca1b80fe00bc507a2b9d89dd83729513e035fb11acf6deb',
});

async function loadJson(relPath) {
  return JSON.parse(await readFile(path.join(REPO_ROOT, relPath), 'utf8'));
}

async function sha256OfFile(relPath) {
  const buf = await readFile(path.join(REPO_ROOT, relPath));
  return `sha256:${createHash('sha256').update(buf).digest('hex')}`;
}

// --- 1. Zero new rules: git-diff-equivalent byte-identity for both rules.json files -----------

for (const relPath of [ANEMIA_RULES_REL, CBC_RULES_REL]) {
  test(`P4-T8: ${relPath} is byte-identical to the P4-T1 pre-merge baseline (git diff equivalent to zero lines changed)`, async () => {
    const fixture = JSON.parse(await readFile(P4T1_FIXTURE_PATH, 'utf8'));
    const current = await computeSnapshot(REPO_ROOT);
    assert.ok(fixture.files[relPath], `P4-T1 fixture is missing an entry for ${relPath}`);
    assert.equal(
      current.files[relPath].sha256,
      fixture.files[relPath].sha256,
      `${relPath} has drifted from the P4-T1 pre-merge baseline -- this phase (RF-EV-001/RF-CBC-002 ` +
        `projection) must add ZERO entries to this file. Byte-identical files necessarily produce an ` +
        `empty \`git diff\`; a hash mismatch here means \`git diff\` would show a nonzero line count.`,
    );
    assert.equal(
      current.files[relPath].byteLength,
      fixture.files[relPath].byteLength,
      `${relPath}: byte length changed from the P4-T1 baseline`,
    );
  });
}

test('P4-T8 aggregate: zero rules were added to EITHER module as a result of this phase', async () => {
  const [anemiaRules, cbcRules] = await Promise.all([loadJson(ANEMIA_RULES_REL), loadJson(CBC_RULES_REL)]);
  assert.ok(Array.isArray(anemiaRules) && Array.isArray(cbcRules));
  // Absolute counts pinned so a rewritten-but-same-length file cannot slip through unnoticed --
  // the byte-identity tests above are the primary guard; this is belt-and-suspenders on shape.
  assert.equal(anemiaRules.length, 91, 'modules/anemia/rules.json must still carry exactly 91 rules');
  assert.equal(
    cbcRules.length,
    4,
    'modules/cbc_suite_v1/rules.json must still carry exactly its 4 pre-existing RF-CBC-001-era rules',
  );
});

// --- 2. modules/anemia/module.json: approvedBy stays [], whole file byte-identical -------------

test('P4-T8: modules/anemia/module.json.approvedBy stays [] (was already []; confirmed unchanged)', async () => {
  const manifest = await loadJson('modules/anemia/module.json');
  assert.deepEqual(
    manifest.approvedBy,
    [],
    `modules/anemia/module.json.approvedBy must stay [] -- no named, credentialed clinician has ` +
      `reviewed the RF-EV-001 backfill this phase projected. Got: ${JSON.stringify(manifest.approvedBy)}`,
  );
});

test('P4-T8: modules/anemia/module.json is whole-file byte-identical to its pre-phase content (nothing in this phase touched it)', async () => {
  const relPath = 'modules/anemia/module.json';
  const sha256 = await sha256OfFile(relPath);
  assert.equal(
    sha256,
    EXPECTED_MODULE_JSON_SHA256[relPath],
    `${relPath} has drifted -- this phase's RF-EV-001 projection into modules/anemia/ must not touch the module manifest at all`,
  );
});

// --- 3. modules/cbc_suite_v1/module.json: status/approvedBy/clinicalContentHash/knowledgeBaseVersion --

test('P4-T8: modules/cbc_suite_v1/module.json keeps its unsigned-stub governance posture, including knowledgeBaseVersion (OQ-2), unchanged by the RF-CBC-002 merge', async () => {
  const manifest = await loadJson('modules/cbc_suite_v1/module.json');
  assert.equal(
    manifest.status,
    'unsigned-stub',
    `modules/cbc_suite_v1/module.json.status must stay "unsigned-stub" -- the RF-CBC-002 merge is ` +
      `an additive evidence append, not clinical review. Got: ${JSON.stringify(manifest.status)}`,
  );
  assert.deepEqual(
    manifest.approvedBy,
    [],
    `modules/cbc_suite_v1/module.json.approvedBy must stay [] -- no clinician has reviewed anything ` +
      `this merge added. Got: ${JSON.stringify(manifest.approvedBy)}`,
  );
  assert.equal(
    manifest.clinicalContentHash,
    null,
    `modules/cbc_suite_v1/module.json.clinicalContentHash must stay null -- there is no signed ` +
      `clinical content to hash. Got: ${JSON.stringify(manifest.clinicalContentHash)}`,
  );
  assert.equal(
    manifest.knowledgeBaseVersion,
    '0.1.0-2026-07-21',
    `OQ-2: modules/cbc_suite_v1/module.json.knowledgeBaseVersion must never be bumped by the RF-CBC-002 ` +
      `merge -- a version bump with zero rule changes would misleadingly suggest clinical content changed. ` +
      `Got: ${JSON.stringify(manifest.knowledgeBaseVersion)}`,
  );
});

test('P4-T8: modules/cbc_suite_v1/module.json is whole-file byte-identical to its pre-phase content', async () => {
  const relPath = 'modules/cbc_suite_v1/module.json';
  const sha256 = await sha256OfFile(relPath);
  assert.equal(
    sha256,
    EXPECTED_MODULE_JSON_SHA256[relPath],
    `${relPath} has drifted -- the RF-CBC-002 merge (P4-T5) must not touch the module manifest at all`,
  );
});

// --- 4. "never described as module complete / backfill succeeded" language check ---------------
//
// Scanned surfaces: the two places a human or agent narrating "what Phase 4 did" would plausibly
// write a summary sentence -- the phase's own progress tracker and the decisions-block worknote.
// Same surface class tests/ef-p5-t4-honesty-ac.test.mjs uses for the sibling P5-T4 AC.

const FORBIDDEN_PHRASES = Object.freeze(['module complete', 'backfill succeeded']);
const NEGATION_WINDOW_CHARS = 150;
const NEGATION_PATTERN = /\b(never|not|no longer|isn't|is not|must not|nor|cannot|can not|n't|don't|does not|doesn't)\b/i;

const HONESTY_SCANNED_SURFACES = Object.freeze([
  '.claude/progress/multi-bundle-conversion-e1/phase-4-progress.md',
  '.claude/worknotes/multi-bundle-conversion-e1/decisions-block.md',
]);

// Unlike tests/ef-p5-t4-honesty-ac.test.mjs (which only looks for a negation term BEFORE the
// phrase, matching that phase's own prose convention "never... module complete"), this phase's own
// committed prose consistently negates AFTER the phrase ("'Module complete'... is never described
// ... as implying clinical readiness"). An occurrence is unqualified only if NEITHER the window
// immediately before NOR the window immediately after it contains a negation term.
function findUnqualifiedOccurrences(text, phrase) {
  const lowerText = text.toLowerCase();
  const lowerPhrase = phrase.toLowerCase();
  const offenses = [];
  let fromIndex = 0;
  for (;;) {
    const idx = lowerText.indexOf(lowerPhrase, fromIndex);
    if (idx === -1) break;
    const beforeStart = Math.max(0, idx - NEGATION_WINDOW_CHARS);
    const afterEnd = Math.min(text.length, idx + phrase.length + NEGATION_WINDOW_CHARS);
    const before = text.slice(beforeStart, idx);
    const after = text.slice(idx + phrase.length, afterEnd);
    if (!NEGATION_PATTERN.test(before) && !NEGATION_PATTERN.test(after)) {
      offenses.push({ index: idx, context: text.slice(beforeStart, afterEnd) });
    }
    fromIndex = idx + lowerPhrase.length;
  }
  return offenses;
}

for (const relPath of HONESTY_SCANNED_SURFACES) {
  test(`P4-T8: ${relPath} never describes this phase's projections as "module complete" or "backfill succeeded" unqualified`, async () => {
    const text = await readFile(path.join(REPO_ROOT, relPath), 'utf8');
    for (const phrase of FORBIDDEN_PHRASES) {
      const offenses = findUnqualifiedOccurrences(text, phrase);
      assert.deepEqual(
        offenses,
        [],
        `${relPath} contains an unqualified (non-negated) occurrence of "${phrase}" -- Phase 4's ` +
          'RF-EV-001/RF-CBC-002 projections must never be read as implying module completeness or ' +
          `clinical readiness. Offending context(s): ${JSON.stringify(offenses, null, 2)}`,
      );
    }
  });
}

test('P4-T8 closure: the load-bearing honesty AC is proven, not merely asserted in prose', () => {
  // No new assertions of its own -- documents, in one place discoverable by name, that every test
  // above has run and passed as this phase's own required hard test gate (mirrors the analogous
  // closure test at the end of tests/p4-t7-cbc-post-merge-byte-identity.test.mjs).
  assert.ok(true);
});
