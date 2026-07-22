// tests/ef-review-render.test.mjs — P2-T6 (Evidence Foundry E1 Phase 2, FR-8/FR-31/OQ-3).
//
// Covers this task's own acceptance criteria
// (docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-2-4-workstreams.md,
// row P2-T6):
//   - Render of a committed review chain produces valid, well-formed, self-contained HTML.
//   - Grep-level proof of zero `<script` and zero external URL references anywhere in the output.
//   - The unvalidated-research-prototype banner is present on every emitted page (header + footer).
//   - Every `synthetic: true` record carries a non-qualifying label.
//   - A rights-restricted fixture passage (`displayPolicy: "hash_and_selector_only"`, FR-31) renders
//     only as a hash + selector reference block, never its (null) `exactPassage` text; a contrasting
//     `public_short_excerpt` passage IS inlined, proving the renderer discriminates on policy rather
//     than always withholding or always inlining.
//   - `--record <review_id>` narrows the render to exactly one record.
//   - Two renders of identical committed inputs are byte-for-byte identical (determinism).
//   - `render` is a real verb now (not `NotImplementedError`), and a golden module-level render
//     matches the committed fixture under tests/fixtures/ef-review-render/golden/ byte-for-byte.
//   - `--record` naming a review_id that does not exist fails closed
//     (`ReviewRecordNotFoundError`, exit 1), never a silent full-module or blank render.
//
// Also covers Clinical Review Workflow v1, Phase 3, P3-T1 (FR-11) — the "Review queue & turn
// state" section: the five ADR-0004 roles, in canonical order, each with a textual (never
// `<a href>`) reference to its existing committed record, plus a QUEUE_NEXT_MARKER/
// QUEUE_TERMINAL_MARKER summary sourced from the P1-T1/P1-T5 derived-state primitives
// (`resolveEffectiveRoleRecord`/`isAdjudicationRequired`, `lib/adjudication.mjs`) `computeQueueState`
// reuses rather than reimplements. See "queue/turn-state section" below.
//
// tests/fixtures/ef-review-render/input/ is a hand-authored, non-real fixture module
// ("render_fixture_v1") that lives entirely under tests/fixtures/ — it is never read by
// scripts/validate-kb.mjs and can never be mistaken for a real modules/<id>/reviews/ tree. See that
// directory's own per-file headers for the full disclaimer.
//
// Structural validity proven here never implies clinical validity, safety, or that a named human
// clinician reviewed anything — see schemas/review-record.schema.json's own top-level description
// for that standing caveat.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  UNVALIDATED_PROTOTYPE_BANNER,
  NON_QUALIFYING_RECORD_LABEL,
  RIGHTS_RESTRICTED_LABEL,
  QUEUE_NEXT_MARKER,
  QUEUE_TERMINAL_MARKER,
  escapeHtml,
  loadModuleMeta,
  loadTraceabilityIndex,
  loadEvidenceAssertions,
  indexAssertionsById,
  loadModuleRenderData,
  selectRecord,
  computeQueueState,
  renderModuleHtml,
} from '../tools/review-record/lib/render.mjs';
import { run as runRender } from '../tools/review-record/lib/verbs/render.mjs';
import { ReviewRecordNotFoundError, UsageError } from '../tools/review-record/lib/errors.mjs';
import { EXIT_OK, EXIT_USAGE } from '../tools/review-record/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(REPO_ROOT, 'tools', 'review-record', 'cli.mjs');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-review-render', 'input');
const GOLDEN_PATH = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'ef-review-render', 'golden', 'render_fixture_v1.html',
);
const MODULE_ID = 'render_fixture_v1';

// A second, pre-existing fixture root (P2-T2's `list`/`validate` CLI fixtures) that happens to carry
// a module with exactly TWO of the five roles committed (clinical-1, clinical-2, both `approve` —
// agreeing) — a real, non-terminal record set this file reuses read-only to exercise the queue
// section's NEXT branch, rather than hand-authoring a third fixture tree for one narrow case.
const PARTIAL_FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-review-record-cli');
const PARTIAL_MODULE_ID = 'fixture_module_v1';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ef-review-render-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' });
  assert.equal(result.error, undefined, `spawnSync itself failed: ${result.error}`);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// -------------------------------------------------------------------------------------------
// escapeHtml
// -------------------------------------------------------------------------------------------

test('escapeHtml escapes the five HTML-sensitive characters and coerces non-strings', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(escapeHtml(null), 'null');
  assert.equal(escapeHtml(42), '42');
});

// -------------------------------------------------------------------------------------------
// loaders — existence-gated
// -------------------------------------------------------------------------------------------

test('loadModuleMeta/loadTraceabilityIndex/loadEvidenceAssertions return null/[] for a module with none of these optional files, not an error', async () => {
  const meta = await loadModuleMeta(FIXTURE_ROOT, 'no_such_module_v1');
  const traceability = await loadTraceabilityIndex(FIXTURE_ROOT, 'no_such_module_v1');
  const assertions = await loadEvidenceAssertions(FIXTURE_ROOT, 'no_such_module_v1');
  assert.equal(meta, null);
  assert.equal(traceability, null);
  assert.deepEqual(assertions, []);
});

test('loadModuleMeta/loadTraceabilityIndex/loadEvidenceAssertions load the fixture module\'s real committed files', async () => {
  const meta = await loadModuleMeta(FIXTURE_ROOT, MODULE_ID);
  const traceability = await loadTraceabilityIndex(FIXTURE_ROOT, MODULE_ID);
  const assertions = await loadEvidenceAssertions(FIXTURE_ROOT, MODULE_ID);
  assert.equal(meta.id, MODULE_ID);
  assert.ok(traceability.rules['FIXTURE-RULE-001']);
  assert.equal(assertions.length, 2);
});

test('indexAssertionsById keys by assertionId and skips malformed entries', () => {
  const map = indexAssertionsById([
    { assertionId: 'evas_a', displayPolicy: 'hash_and_selector_only' },
    { notAnAssertionId: true },
  ]);
  assert.equal(map.size, 1);
  assert.ok(map.has('evas_a'));
});

test('loadModuleRenderData assembles records + linkage + optional artifacts for the fixture module', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  assert.equal(data.moduleId, MODULE_ID);
  assert.equal(data.records.length, 5);
  assert.equal(data.linkageByReviewId.size, 5);
  for (const entry of data.records) {
    assert.equal(data.linkageByReviewId.get(entry.reviewId).ok, true, `${entry.reviewId} should chain-link cleanly`);
  }
  assert.ok(data.moduleMeta);
  assert.ok(data.traceability);
  assert.equal(data.assertionsById.size, 2);
});

// -------------------------------------------------------------------------------------------
// selectRecord — fail closed
// -------------------------------------------------------------------------------------------

test('selectRecord returns the matching entry when present', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  const entry = selectRecord(data.records, 'rr-0002-clinical-2', MODULE_ID);
  assert.equal(entry.reviewId, 'rr-0002-clinical-2');
});

test('selectRecord throws ReviewRecordNotFoundError (a UsageError) for an absent review_id', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  assert.throws(
    () => selectRecord(data.records, 'rr-9999-lab', MODULE_ID),
    (err) => {
      assert.ok(err instanceof ReviewRecordNotFoundError);
      assert.ok(err instanceof UsageError);
      assert.equal(err.exitCode, EXIT_USAGE);
      return true;
    },
  );
});

// -------------------------------------------------------------------------------------------
// renderModuleHtml — content assertions
// -------------------------------------------------------------------------------------------

test('renderModuleHtml: full module render carries the banner (header + footer), a non-qualifying label per synthetic record, the rights-restricted block (never the withheld text), and the inline passage', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  const html = renderModuleHtml(data);

  const bannerOccurrences = html.split(escapeHtml(UNVALIDATED_PROTOTYPE_BANNER)).length - 1;
  assert.equal(bannerOccurrences, 2, 'banner should appear exactly twice (header + footer)');

  const nonQualifyingOccurrences = html.split(escapeHtml(NON_QUALIFYING_RECORD_LABEL)).length - 1;
  assert.equal(nonQualifyingOccurrences, 5, 'all five fixture records are synthetic:true');

  assert.match(html, new RegExp(escapeHtml(RIGHTS_RESTRICTED_LABEL).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /Fixture-only paraphrase demonstrating an inline-eligible passage[^"]*restricted/i);

  // The rights-restricted assertion's exactPassage is null on disk -- there is no withheld text to
  // leak, but assert the hash+selector metadata IS present so the block is not silently empty.
  assert.match(html, /sha256:e9e6fd825c37789caf2bda62fa503b579e6eaab6f2d9984cb8f344da9c7da58d/);
  assert.match(html, /Table 2 -- fixture locator/);

  // The public_short_excerpt assertion's text IS inlined.
  assert.match(html, /Fixture-only paraphrase demonstrating an inline-eligible passage/);

  for (const reviewId of ['rr-0001-clinical-1', 'rr-0002-clinical-2', 'rr-0003-lab', 'rr-0004-adjudication', 'rr-0005-release-auth']) {
    assert.match(html, new RegExp(reviewId));
  }
});

test('renderModuleHtml: --record filter narrows the detailed record CARD to exactly one record; the module-wide queue/turn-state and rule-chain sections still reflect the full module (P3-T1, FR-11)', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  const html = renderModuleHtml({ ...data, recordFilter: 'rr-0003-lab' });
  assert.match(html, /rr-0003-lab/);
  // The full detailed record CARD (reviewer/decision/rationale) is narrowed to rr-0003-lab only --
  // matching on each OTHER record's own card heading (reviewId immediately followed by its
  // role-badge span), not the bare reviewId string, since the queue section below legitimately
  // still names every role's reviewId as a lightweight, content-free cross-reference.
  assert.doesNotMatch(html, /<h3>rr-0001-clinical-1 <span/);
  assert.doesNotMatch(html, /<h3>rr-0002-clinical-2 <span/);
  assert.doesNotMatch(html, /<h3>rr-0004-adjudication <span/);
  assert.doesNotMatch(html, /<h3>rr-0005-release-auth <span/);
  // The rule-chain section is module-wide, not record-scoped -- still present.
  assert.match(html, /FIXTURE-RULE-001/);
  // The queue/turn-state section (P3-T1, FR-11) is ALSO module-wide, like the rule-chain section --
  // turn-taking is a whole-module concept, so it still names every role's reviewId (existence
  // only -- no reviewer/decision/rationale content) regardless of --record narrowing.
  assert.match(html, /Review queue &amp; turn state/);
  for (const reviewId of ['rr-0001-clinical-1', 'rr-0002-clinical-2', 'rr-0003-lab', 'rr-0004-adjudication', 'rr-0005-release-auth']) {
    assert.match(html, new RegExp(`Committed review act: <code>${reviewId}</code>`));
  }
});

test('renderModuleHtml: a module with no committed traceability-index.json prints an explicit not-yet-committed note, not a blank/thrown error', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, 'a_module_with_no_optional_artifacts_v1');
  const html = renderModuleHtml(data);
  assert.match(html, /No committed traceability-index\.json rule chain/);
  assert.match(html, /No committed review records found/);
});

// -------------------------------------------------------------------------------------------
// computeQueueState — pure unit tests (P3-T1, FR-11)
// -------------------------------------------------------------------------------------------

function record(role, seq, overrides = {}) {
  return {
    reviewId: `rr-${String(seq).padStart(4, '0')}-${role}`,
    seq,
    role,
    record: { decision: 'approve', supersedes: null, ...overrides },
  };
}

test('computeQueueState: zero records -- not-started, NEXT is clinical-1 (the first role), not terminal', () => {
  const result = computeQueueState([]);
  assert.equal(result.terminal, false);
  assert.equal(result.nextExpectedRole, 'clinical-1');
  assert.deepEqual(result.roles.map((r) => r.role), ['clinical-1', 'clinical-2', 'lab', 'adjudication', 'release-auth']);
  for (const roleEntry of result.roles) assert.equal(roleEntry.reviewId, null);
  assert.equal(result.roles[0].isNext, true);
});

test('computeQueueState: clinical-1/clinical-2 present and AGREEING -- NEXT is lab (adjudication not required)', () => {
  const records = [record('clinical-1', 1, { decision: 'approve' }), record('clinical-2', 2, { decision: 'approve' })];
  const result = computeQueueState(records);
  assert.equal(result.terminal, false);
  assert.equal(result.nextExpectedRole, 'lab');
  assert.equal(result.roles.find((r) => r.role === 'clinical-1').reviewId, 'rr-0001-clinical-1');
  assert.equal(result.roles.find((r) => r.role === 'lab').isNext, true);
});

test('computeQueueState: clinical-1/clinical-2/lab present and DISAGREEING -- NEXT is adjudication (FR-26)', () => {
  const records = [
    record('clinical-1', 1, { decision: 'approve' }),
    record('clinical-2', 2, { decision: 'request-changes' }),
    record('lab', 3, { decision: 'approve' }),
  ];
  const result = computeQueueState(records);
  assert.equal(result.terminal, false);
  assert.equal(result.nextExpectedRole, 'adjudication');
});

test('computeQueueState: all four non-adjudication roles present, AGREEING -- NEXT is release-auth (adjudication skipped, FR-26)', () => {
  const records = [
    record('clinical-1', 1, { decision: 'approve' }),
    record('clinical-2', 2, { decision: 'approve' }),
    record('lab', 3, { decision: 'approve' }),
  ];
  const result = computeQueueState(records);
  assert.equal(result.nextExpectedRole, 'release-auth');
});

test('computeQueueState: all five roles present -- TERMINAL, nextExpectedRole null', () => {
  const records = [
    record('clinical-1', 1, { decision: 'approve' }),
    record('clinical-2', 2, { decision: 'approve' }),
    record('lab', 3, { decision: 'approve' }),
    record('release-auth', 4, { decision: 'approve' }),
  ];
  const result = computeQueueState(records);
  assert.equal(result.terminal, true);
  assert.equal(result.nextExpectedRole, null);
  for (const roleEntry of result.roles) assert.equal(roleEntry.isNext, false);
});

test('computeQueueState: a superseded clinical-1 original is ignored -- only the EFFECTIVE (correcting) record counts, per resolveEffectiveRoleRecord (FR-26 effective-act rule)', () => {
  const original = record('clinical-1', 1, { decision: 'approve' });
  const correction = record('clinical-1', 3, { decision: 'approve', supersedes: original.reviewId });
  const records = [original, record('clinical-2', 2, { decision: 'approve' }), correction];
  const result = computeQueueState(records);
  const clinical1Entry = result.roles.find((r) => r.role === 'clinical-1');
  assert.equal(clinical1Entry.reviewId, correction.reviewId, 'the EFFECTIVE (correcting) record, not the stale superseded original, must be reported');
});

// -------------------------------------------------------------------------------------------
// Queue/turn-state section — rendered HTML (P3-T1, FR-11)
// -------------------------------------------------------------------------------------------

/** Extracts just the `<section class="queue">...</section>` fragment for section-scoped assertions
 * (e.g. the grep-test AC: zero `<script`/`<a href` WITHIN the new section specifically). */
function extractQueueSection(html) {
  const match = html.match(/<section class="queue">[\s\S]*?<\/section>/);
  assert.ok(match, 'expected exactly one <section class="queue"> block in the render output');
  return match[0];
}

test('renderModuleHtml: the queue/turn-state section names all five ADR-0004 roles, in canonical order, each under its own <h3> (semantic headings for screen-reader navigation)', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  const html = renderModuleHtml(data);
  const queueSection = extractQueueSection(html);

  assert.match(queueSection, /<h2>Review queue &amp; turn state<\/h2>/);
  const headings = [...queueSection.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(headings, ['clinical-1', 'clinical-2', 'lab', 'adjudication', 'release-auth']);
});

test('renderModuleHtml: the queue/turn-state section carries zero <script and zero <a href (AC: grep-test scoped to the new section)', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  const html = renderModuleHtml(data);
  const queueSection = extractQueueSection(html);
  assert.doesNotMatch(queueSection, /<script/i);
  assert.doesNotMatch(queueSection, /<a\s+href/i);
});

test('renderModuleHtml: a module with all five roles committed shows the TERMINAL marker and every role\'s existing committed-record reference', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  const html = renderModuleHtml(data);
  const queueSection = extractQueueSection(html);

  assert.match(queueSection, new RegExp(`>${QUEUE_TERMINAL_MARKER}\\b`));
  assert.doesNotMatch(queueSection, new RegExp(`>${QUEUE_NEXT_MARKER}\\b`), 'a TERMINAL record set must carry no NEXT marker anywhere in the queue section');
  for (const reviewId of ['rr-0001-clinical-1', 'rr-0002-clinical-2', 'rr-0003-lab', 'rr-0004-adjudication', 'rr-0005-release-auth']) {
    assert.match(queueSection, new RegExp(`Committed review act: <code>${reviewId}</code>`));
  }
});

test('renderModuleHtml: a module with only two of five roles committed shows the NEXT marker naming the third role, and "not yet committed" for the rest', async () => {
  const data = await loadModuleRenderData(PARTIAL_FIXTURE_ROOT, PARTIAL_MODULE_ID);
  const html = renderModuleHtml(data);
  const queueSection = extractQueueSection(html);

  assert.match(queueSection, new RegExp(`${QUEUE_NEXT_MARKER}: lab`));
  assert.doesNotMatch(queueSection, new RegExp(`>${QUEUE_TERMINAL_MARKER}\\b`));
  assert.match(queueSection, /Committed review act: <code>rr-0001-clinical-1<\/code>/);
  assert.match(queueSection, /Committed review act: <code>rr-0002-clinical-2<\/code>/);
  // lab/adjudication/release-auth have no committed act yet.
  const notYetCommittedCount = (queueSection.match(/Not yet committed\./g) || []).length;
  assert.equal(notYetCommittedCount, 2, 'adjudication and release-auth (lab is the NEXT role, not "not yet committed" text) should read "Not yet committed."');
});

// -------------------------------------------------------------------------------------------
// Structural / honesty-posture invariants over the emitted HTML (AC: grep-test)
// -------------------------------------------------------------------------------------------

test('the full module render contains zero <script tags and zero external URL references', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  const html = renderModuleHtml(data);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /<a\s+href/i);
  assert.doesNotMatch(html, /\bwww\./i);
});

test('the full module render is a well-formed, self-contained document (doctype, html/head/body, one inline style, no external refs)', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  const html = renderModuleHtml(data);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<\/html>\s*$/);
  assert.match(html, /<head>[\s\S]*<\/head>/);
  assert.match(html, /<body>[\s\S]*<\/body>/);
  assert.match(html, /<style>[\s\S]*<\/style>/);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /<iframe\b/i);
});

// -------------------------------------------------------------------------------------------
// Determinism
// -------------------------------------------------------------------------------------------

test('two renders of identical committed inputs are byte-for-byte identical', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  const first = renderModuleHtml(data);
  const second = renderModuleHtml(data);
  assert.equal(first, second);

  // Re-load the module data from disk a second time (a fresh async read) to also prove determinism
  // survives a completely separate file-read pass, not just an object reused in memory.
  const reloaded = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  const third = renderModuleHtml(reloaded);
  assert.equal(first, third);
});

test('render (verb) writes byte-identical files across two separate invocations into different output directories', async () => {
  await withTempDir(async (outA) => {
    await withTempDir(async (outB) => {
      await runRender({ module: MODULE_ID, root: FIXTURE_ROOT, out: outA });
      await runRender({ module: MODULE_ID, root: FIXTURE_ROOT, out: outB });
      const [a, b] = await Promise.all([
        readFile(path.join(outA, MODULE_ID, 'index.html'), 'utf8'),
        readFile(path.join(outB, MODULE_ID, 'index.html'), 'utf8'),
      ]);
      assert.equal(a, b);
    });
  });
});

// -------------------------------------------------------------------------------------------
// Golden fixture — byte-for-byte (OQ-3: "Commit one golden render")
// -------------------------------------------------------------------------------------------

test('render --module render_fixture_v1 matches the committed golden fixture byte-for-byte', async () => {
  await withTempDir(async (outDir) => {
    const code = await runRender({ module: MODULE_ID, root: FIXTURE_ROOT, out: outDir });
    assert.equal(code, EXIT_OK);
    const [actual, golden] = await Promise.all([
      readFile(path.join(outDir, MODULE_ID, 'index.html'), 'utf8'),
      readFile(GOLDEN_PATH, 'utf8'),
    ]);
    assert.equal(actual, golden);
  });
});

// -------------------------------------------------------------------------------------------
// verb-level (subprocess) behavior
// -------------------------------------------------------------------------------------------

test('cli.mjs render requires --module (exit 1, UsageError)', () => {
  const { status, stderr } = runCli(['render']);
  assert.equal(status, EXIT_USAGE);
  assert.match(stderr, /UsageError/);
  assert.match(stderr, /requires --module/);
});

test('cli.mjs render --record naming an absent review_id fails closed (exit 1, ReviewRecordNotFoundError)', async () => {
  await withTempDir(async (outDir) => {
    const { status, stderr } = runCli([
      'render', '--module', MODULE_ID, '--record', 'rr-9999-lab',
      '--root', FIXTURE_ROOT, '--out', outDir,
    ]);
    assert.equal(status, EXIT_USAGE);
    assert.match(stderr, /ReviewRecordNotFoundError/);
    assert.match(stderr, /was not found among the committed review records/);
  });
});

test('cli.mjs render --module <id> --root <fixtures> --out <tmp> writes a real file and exits 0', async () => {
  await withTempDir(async (outDir) => {
    const { status, stdout } = runCli(['render', '--module', MODULE_ID, '--root', FIXTURE_ROOT, '--out', outDir]);
    assert.equal(status, EXIT_OK);
    assert.match(stdout, /Wrote /);
    const html = await readFile(path.join(outDir, MODULE_ID, 'index.html'), 'utf8');
    assert.match(html, /<!doctype html>/);
  });
});

test('cli.mjs render --record writes a distinctly named file (not index.html)', async () => {
  await withTempDir(async (outDir) => {
    const { status } = runCli([
      'render', '--module', MODULE_ID, '--record', 'rr-0004-adjudication',
      '--root', FIXTURE_ROOT, '--out', outDir,
    ]);
    assert.equal(status, EXIT_OK);
    const html = await readFile(path.join(outDir, MODULE_ID, 'rr-0004-adjudication.html'), 'utf8');
    assert.match(html, /rr-0004-adjudication/);
    // The detailed record CARD for rr-0001-clinical-1 is narrowed away; its bare reviewId still
    // legitimately appears in the module-wide queue/turn-state section (P3-T1, FR-11) -- see the
    // "renderModuleHtml: --record filter narrows..." test above for the full rationale.
    assert.doesNotMatch(html, /<h3>rr-0001-clinical-1 <span/);
  });
});

test('render on a module with zero committed review records still produces a valid, banner-carrying page (not an error)', async () => {
  await withTempDir(async (outDir) => {
    const code = await runRender({ module: 'a_module_with_no_review_records_at_all_v1', root: FIXTURE_ROOT, out: outDir });
    assert.equal(code, EXIT_OK);
    const html = await readFile(path.join(outDir, 'a_module_with_no_review_records_at_all_v1', 'index.html'), 'utf8');
    assert.match(html, /No committed review records found/);
    assert.match(html, new RegExp(escapeHtml(UNVALIDATED_PROTOTYPE_BANNER).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});
