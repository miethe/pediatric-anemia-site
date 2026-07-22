// tests/ef-review-runbook.test.mjs — clinical-review-workflow P3-T3 (FR-13, OQ-3, OQ-7).
//
// THE DOCS-TRUTH INVARIANT THIS PROVES: `docs/governance/reviewer-runbook.md` carries all of the
// plan's own binding acceptance criteria for P3-T3 — every required section is present, and the
// `sign` verb is demonstrated as something to actually RUN only under the "Exercise track"
// heading, never under "Post-G1 real-reviewer track". A future edit that silently drops a section,
// or that lets a `sign` invocation leak into the post-G1 narrative (the exact leak P3-GATE2's
// codex second-opinion review is separately tasked with catching), fails this suite instead of
// being noticed only by eye.
//
// SCOPE NOTE ON "sign appears only under the exercise track" (the plan's own AC wording): the
// post-G1 track legitimately needs to SAY, in prose, that real reviewers never run `sign` — that
// sentence is itself part of the honesty contract (FR-14/R4). What must never appear in the
// post-G1 section is `sign` demonstrated as a command to actually type and run. This suite checks
// the narrower, meaningful thing: every literal `node tools/review-record/cli.mjs sign` invocation
// in the whole document falls inside the exercise-track section, and the post-G1 section contains
// none.
//
// WHY A GREP/HEADING-SPAN TEST, NOT A FULL MARKDOWN PARSER. Mirrors
// tests/clinical-review-portal-design-spec.test.mjs's own justification: no markdown-parsing
// library is introduced for a handful of docs-truth checks over one file.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNBOOK_PATH = path.join(REPO_ROOT, 'docs/governance/reviewer-runbook.md');

const SIGN_INVOCATION = 'tools/review-record/cli.mjs sign';

/**
 * Extract the text of one `## Heading` section (from the heading line, exclusive, to the next
 * top-level `## ` heading or end of file). Deliberately narrow, matching this file's own flat,
 * single-level-of-`##`-headings structure. Implemented with indexOf rather than a single `^...$`
 * regex on purpose: combining a multiline `^` (needed to find the heading anywhere in the file)
 * with a multiline `$` (needed to stop at the NEXT heading) makes `$` match after every line, not
 * only at that heading — a lazy `[\s\S]*?` then stops at the first line break it finds, truncating
 * every section to one line. Plain string search has no such trap.
 */
function sectionText(docText, headingText) {
  const marker = `## ${headingText}\n`;
  const startIdx = docText.indexOf(marker);
  if (startIdx === -1) {
    return null;
  }
  const bodyStart = startIdx + marker.length;
  const nextHeadingIdx = docText.indexOf('\n## ', bodyStart);
  return nextHeadingIdx === -1 ? docText.slice(bodyStart) : docText.slice(bodyStart, nextHeadingIdx);
}

let runbookText;

test('setup: read the reviewer runbook', () => {
  runbookText = readFileSync(RUNBOOK_PATH, 'utf8');
  assert.ok(runbookText.length > 0, `expected non-empty content at ${RUNBOOK_PATH}`);
});

test('P3-T3 acceptance criterion: all required section headers are present', () => {
  const requiredHeadings = [
    '## What this is',
    '## The five roles',
    '## How corrections work: supersedes, never edits',
    '## What "structurally non-qualifying" means',
    '## Exercise track (synthetic personas)',
    '## Post-G1 real-reviewer track',
    '## The honesty boundary',
  ];
  for (const heading of requiredHeadings) {
    assert.ok(
      runbookText.includes(`${heading}\n`),
      `expected the runbook to contain the section heading "${heading}"`,
    );
  }
  assert.match(
    runbookText,
    /^# .+Review.+Workflow/m,
    'expected a top-level title mentioning the review workflow',
  );
});

test('all five ADR-0004 roles are named, in order, under "The five roles"', () => {
  const section = sectionText(runbookText, 'The five roles');
  assert.ok(section, 'expected a "## The five roles" section');
  const roles = ['clinical-1', 'clinical-2', 'lab', 'adjudication', 'release-auth'];
  let cursor = -1;
  for (const role of roles) {
    const idx = section.indexOf(`\`${role}\``);
    assert.ok(idx !== -1, `expected role "${role}" to be named in "The five roles" section`);
    assert.ok(idx > cursor, `expected role "${role}" to appear after the previous role, in ADR-0004 order`);
    cursor = idx;
  }
});

test('"How corrections work" section names supersedes and never-edit-in-place', () => {
  const section = sectionText(runbookText, 'How corrections work: supersedes, never edits');
  assert.ok(section, 'expected a "## How corrections work: supersedes, never edits" section');
  assert.match(section, /supersedes/);
  assert.match(section, /never (opened and changed again|edit)/i);
});

test('"structurally non-qualifying" section quotes the tool\'s real terminal-state wording', () => {
  const section = sectionText(runbookText, 'What "structurally non-qualifying" means');
  assert.ok(section, 'expected a \'## What "structurally non-qualifying" means\' section');
  assert.match(section, /structurally-non-qualifying/);
  assert.match(section, /not a (defect|bug)/i);
});

test('P3-T3 acceptance criterion: `sign` is demonstrated ONLY under the exercise track', () => {
  const exerciseSection = sectionText(runbookText, 'Exercise track (synthetic personas)');
  const postG1Section = sectionText(runbookText, 'Post-G1 real-reviewer track');
  assert.ok(exerciseSection, 'expected a "## Exercise track (synthetic personas)" section');
  assert.ok(postG1Section, 'expected a "## Post-G1 real-reviewer track" section');

  const totalInvocations = runbookText.split(SIGN_INVOCATION).length - 1;
  const exerciseInvocations = exerciseSection.split(SIGN_INVOCATION).length - 1;
  const postG1Invocations = postG1Section.split(SIGN_INVOCATION).length - 1;

  assert.ok(
    exerciseInvocations >= 1,
    `expected at least one runnable "${SIGN_INVOCATION}" invocation inside the exercise track`,
  );
  assert.equal(
    postG1Invocations,
    0,
    `expected zero runnable "${SIGN_INVOCATION}" invocations inside the post-G1 track (found ${postG1Invocations})`,
  );
  assert.equal(
    totalInvocations,
    exerciseInvocations,
    'expected every runnable sign invocation in the whole document to fall inside the exercise track ' +
      '(found one outside both known sections)',
  );
});

test('post-G1 track explicitly states real reviewers never run `sign`, in prose (not as a command)', () => {
  const postG1Section = sectionText(runbookText, 'Post-G1 real-reviewer track');
  assert.ok(postG1Section);
  assert.match(
    postG1Section,
    /never (run|runs) (through )?the practice signing step|never something a reviewer does|not something a reviewer does/i,
  );
});

test('post-G1 track ends at scaffold (no --draft) writing the file directly; never demonstrates sign', () => {
  const postG1Section = sectionText(runbookText, 'Post-G1 real-reviewer track');
  assert.ok(postG1Section);
  assert.match(postG1Section, /scaffold/);
  assert.match(postG1Section, /writes the finished record directly/i);
  assert.match(postG1Section, /signature: null/);
});

test('exercise track walkthrough uses a scratch practice copy, never --root pointed at the real repo', () => {
  const section = sectionText(runbookText, 'Exercise track (synthetic personas)');
  assert.ok(section);
  assert.match(section, /--root \/tmp\/review-practice/);
  // Regression guard: the practice copy must be its own git working tree, or the tool's
  // authorship-union check fails closed with `derivedState: invalid` instead of ever reaching the
  // documented `structurally-non-qualifying` terminal state (verified against the real CLI while
  // authoring this runbook).
  assert.match(section, /git init/);
});

test('honesty boundary: the closing section restates the unvalidated-research-prototype boundary', () => {
  const section = sectionText(runbookText, 'The honesty boundary');
  assert.ok(section, 'expected a "## The honesty boundary" section');
  assert.match(section, /unvalidated research prototype/i);
});

test('"unvalidated research prototype" appears near the top of the document (FR-14/R4)', () => {
  assert.match(runbookText, /unvalidated research prototype/i);
});

// --- P3-GATE2 fix-cycle additions (codex second-opinion review) -----------------------------
//
// MAJOR finding fixed: the runbook conflated the CLI's record-file WRITE (`scaffold`/`sign`) with
// creating a git commit -- it claimed `sign` "finalizes and commits" a record and that a reviewer's
// "`scaffold` command's commit lands," neither of which is true; both verbs only write a plain file
// to disk (verified against the real CLI: `git status --short` shows the written file as untracked
// immediately after `sign` returns). The required human `git add` + `git commit` act was omitted
// while being implicitly claimed. The two tests below regression-guard that fix: presence of the
// explicit git step in both tracks' walkthroughs, and absence of any sentence attributing
// git-committing to the verbs themselves.
//
// MINOR finding fixed: "All four commands above are entirely read-only" was false for the displayed
// `render --out /tmp/...` (verified against the real CLI: it creates its own `--out` directory tree
// and writes an `index.html` into it). The third test below checks the corrected, precisely-scoped
// claim.

test('P3-GATE2 fix-cycle: both tracks show an explicit `git add` + `git commit` step (a written record file is not yet a git commit)', () => {
  const exerciseSection = sectionText(runbookText, 'Exercise track (synthetic personas)');
  const postG1Section = sectionText(runbookText, 'Post-G1 real-reviewer track');
  assert.ok(exerciseSection, 'expected a "## Exercise track (synthetic personas)" section');
  assert.ok(postG1Section, 'expected a "## Post-G1 real-reviewer track" section');

  // Exercise track: every command in that track's practice-copy walkthrough uses the
  // `git -C /tmp/review-practice ...` convention (never `cd`), matching the rest of that track's
  // own commands (the tool invocations all take `--root /tmp/review-practice` instead of a `cd`).
  assert.match(
    exerciseSection,
    /\bgit -C \/tmp\/review-practice add\b/,
    'expected an explicit "git -C /tmp/review-practice add" step in the exercise track walkthrough',
  );
  assert.match(
    exerciseSection,
    /\bgit -C \/tmp\/review-practice commit\b/,
    'expected an explicit "git -C /tmp/review-practice commit" step in the exercise track walkthrough',
  );

  // Post-G1 track: a real reviewer runs the tool from the repository root (no --root/-C), so the
  // commit step there is plain `git add` / `git commit`.
  assert.match(
    postG1Section,
    /\bgit add modules\/<module_id>\/reviews\//,
    'expected an explicit "git add" step in the post-G1 track walkthrough',
  );
  assert.match(
    postG1Section,
    /\bgit commit\b/,
    'expected an explicit "git commit" step in the post-G1 track walkthrough',
  );
});

test('P3-GATE2 fix-cycle: no sentence attributes git-committing to the `sign`/`scaffold` verbs themselves', () => {
  // Deliberately SHORT-RANGE and NEGATION-AWARE rather than a general sentence-level linter (the
  // over-matching risk this task's own instructions warned against): it flags a backtick-quoted
  // `sign`/`scaffold` mention only when a form of "commit(s)" follows within 20 non-period/newline
  // characters with no intervening period or negation ("never", "itself never", "is never", "does
  // not", "doesn't") -- exactly the shape of the two original bad phrases ("`sign` finalizes and
  // commits it", "`scaffold` command's commit lands"), confirmed below. This correctly leaves alone
  // unrelated nearby uses of "commit" this fix-cycle's own corrected prose now contains, e.g. "not
  // the `sign` command that preceded it -- is the actual git commit" (negation precedes the verb;
  // "commit" itself is far outside the 20-char window) and "`sign` never commits anything on its
  // own" (negation immediately follows the verb).
  const ATTRIBUTES_COMMIT_TO_VERB =
    /`(sign|scaffold)`(?!\s+(?:never|itself never|is never|does not|doesn['’]?t))[^.\n]{0,20}?\bcommits?\b/i;

  const match = runbookText.match(ATTRIBUTES_COMMIT_TO_VERB);
  assert.equal(
    match,
    null,
    'expected no sentence to attribute git-committing to `sign`/`scaffold` themselves' +
      (match ? ` (found: ${JSON.stringify(match[0])})` : ''),
  );

  // Confirm the guard is not vacuous: it must actually catch the two original bad phrasings.
  assert.match(
    "Building a record is two steps: `scaffold` drafts it, `sign` finalizes and commits it.",
    ATTRIBUTES_COMMIT_TO_VERB,
  );
  assert.match(
    "your part of the workflow ends the moment your `scaffold` command's commit lands",
    ATTRIBUTES_COMMIT_TO_VERB,
  );
});

test('P3-GATE2 fix-cycle: the read-only claim over the committed-example commands is precisely qualified', () => {
  const section = sectionText(runbookText, 'Reading the committed `cbc_suite_v1` example');
  assert.ok(section, 'expected a \'## Reading the committed `cbc_suite_v1` example\' section');
  assert.match(
    section,
    /read-only\s+\*\*with respect to review records and module content\*\*/i,
    'expected the read-only claim to be scoped to "review records and module content"',
  );
  assert.match(
    section,
    /render.{0,200}--out.{0,80}directory/is,
    'expected an explicit carve-out noting `render` writes its own --out directory',
  );
  assert.doesNotMatch(
    section,
    /all four commands above are entirely read-only/i,
    'expected the old, unqualified "entirely read-only" claim to be gone',
  );
});
