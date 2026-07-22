// tests/ef-review-honesty-boundary.test.mjs — clinical-review-workflow P3-T4 (FR-14, R4).
//
// THE DOCS-TRUTH INVARIANT THIS PROVES (the plan's own binding AC for P3-T4,
// docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md, Phase 3):
// every user-visible surface Phase 3 touches -- docs/governance/reviewer-runbook.md, the render's
// "Review queue & turn state" section, and tools/review-record/README.md -- carries this program's
// canonical honesty-boundary phrase ("unvalidated research prototype"), so none of these surfaces
// can be edited in a way that silently drops the language implying clinical validity, real
// sign-off, or a non-synthetic roster is being guarded against. Mirrors the exact case-insensitive
// substring convention already established by tests/ef-review-runbook.test.mjs's own
// '"unvalidated research prototype" appears near the top of the document' test and
// tests/portal-concept-assets-manifest.test.mjs's own honesty-boundary test, rather than inventing a
// fourth independent check style for the same fact.
//
// Structural validity proven here never implies clinical validity, safety, or that a named human
// clinician reviewed anything -- see schemas/review-record.schema.json's own top-level description
// for that standing caveat.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadModuleRenderData, renderModuleHtml } from '../tools/review-record/lib/render.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNBOOK_PATH = path.join(REPO_ROOT, 'docs', 'governance', 'reviewer-runbook.md');
const README_PATH = path.join(REPO_ROOT, 'tools', 'review-record', 'README.md');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-review-render', 'input');
const MODULE_ID = 'render_fixture_v1';

// One of this program's three canonical honesty-boundary phrases named by the plan's AC. Every
// surface below is authored to literally carry "unvalidated research prototype" -- the same
// case-insensitive substring tests/ef-review-runbook.test.mjs and
// tests/portal-concept-assets-manifest.test.mjs already check for elsewhere in this codebase.
const BOUNDARY_PATTERN = /unvalidated research prototype/i;

/** Extracts just the `<section class="queue">...</section>` fragment -- mirrors
 * tests/ef-review-render.test.mjs's own `extractQueueSection` helper, so this file's assertion is
 * scoped to the render's queue/turn-state section specifically, not the whole page (the page-wide
 * banner in the header/footer would trivially pass otherwise). */
function extractQueueSection(html) {
  const match = html.match(/<section class="queue">[\s\S]*?<\/section>/);
  assert.ok(match, 'expected exactly one <section class="queue"> block in the render output');
  return match[0];
}

test('P3-T4 honesty-language pass: docs/governance/reviewer-runbook.md carries the boundary statement', () => {
  const text = readFileSync(RUNBOOK_PATH, 'utf8');
  assert.match(text, BOUNDARY_PATTERN);
});

test('P3-T4 honesty-language pass: tools/review-record/README.md carries the boundary statement', () => {
  const text = readFileSync(README_PATH, 'utf8');
  assert.match(text, BOUNDARY_PATTERN);
});

test('P3-T4 honesty-language pass: the render\'s "Review queue & turn state" section itself carries the boundary statement (scoped to the section, not just the page-wide banner)', async () => {
  const data = await loadModuleRenderData(FIXTURE_ROOT, MODULE_ID);
  const html = renderModuleHtml(data);
  const queueSection = extractQueueSection(html);
  assert.match(queueSection, BOUNDARY_PATTERN);
});
