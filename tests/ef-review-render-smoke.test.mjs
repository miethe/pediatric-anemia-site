// tests/ef-review-render-smoke.test.mjs — P2-T7 (Evidence Foundry E1 Phase 2, R-P4 runtime smoke).
//
// The render surface (P2-T6/T7) is the only UI-adjacent output in the whole E1 plan, so it gets its
// own runtime smoke test rather than being waved through on unit tests alone (phase-2-progress.md
// "Known Gotchas"). tests/ef-review-render.test.mjs already exercises `render.mjs`'s library
// functions and the CLI verb against scratch temp directories; this file is deliberately narrower
// and end-to-end: it drives the REAL `cli.mjs render` entry point exactly the way a human/CI
// invocation would (no `--out` override), over the already-COMMITTED fixture module
// (tests/fixtures/ef-review-render/input/modules/render_fixture_v1 — the same fixture P2-T6's own
// golden lives against), and asserts the four things this task's acceptance criteria name:
//
//   1. The output file exists on disk and is non-empty, well-formed, self-contained HTML.
//   2. The unvalidated-research-prototype banner and per-record synthetic non-qualifying labels are
//      present in the rendered output.
//   3. Zero outbound network calls occur during a real render invocation (http.request /
//      https.request / fetch never invoked) — this repo's own established runtime-proof pattern
//      (e.g. tests/ef-converter-invariants.test.mjs's cross-cutting zero-network test).
//   4. The render output lives under `build/`, which `.gitignore` excludes wholesale (the E0 P1-T7
//      precedent: `build/` was gitignored for `tools/rf-bundle-to-kb-pack/` output and committed
//      goldens live under `tests/fixtures/` instead — see .gitignore's own comment) — proven both by
//      asserting the `.gitignore` rule exists and by asking git itself (`git check-ignore`) about the
//      real emitted file path.
//
// This is a smoke test, not a duplicate of P2-T6's own coverage: it never reaches into
// `render.mjs`'s internals (no imported loader/render-data functions), it always goes through the
// real `#!/usr/bin/env node` CLI entry point via a spawned subprocess for the end-to-end checks, and
// it exercises the CLI's actual default `--out` behavior (`<cwd>/build/review-render/`) that every
// other render test deliberately overrides with a scratch temp directory.
//
// Structural validity proven here never implies clinical validity, safety, or that a named human
// clinician reviewed anything — see schemas/review-record.schema.json's own top-level description
// for that standing caveat. The fixture module's five review records are all `synthetic: true` and
// carry non-qualifying language; they are not real review activity (phase-2-progress.md's own
// named honesty-posture risk).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runRender } from '../tools/review-record/lib/verbs/render.mjs';
import { EXIT_OK } from '../tools/review-record/lib/errors.mjs';
import {
  UNVALIDATED_PROTOTYPE_BANNER,
  NON_QUALIFYING_RECORD_LABEL,
  escapeHtml,
} from '../tools/review-record/lib/render.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(REPO_ROOT, 'tools', 'review-record', 'cli.mjs');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-review-render', 'input');
const MODULE_ID = 'render_fixture_v1';

// Matches lib/verbs/render.mjs's own default: `path.join(process.cwd(), 'build', 'review-render')`,
// with the subprocess spawned at cwd: REPO_ROOT below.
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'build', 'review-render');
const DEFAULT_OUTPUT_FILE = path.join(DEFAULT_OUT_DIR, MODULE_ID, 'index.html');

function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// -------------------------------------------------------------------------------------------
// End-to-end: real CLI entry point, real default --out, committed fixture artifacts.
// -------------------------------------------------------------------------------------------

test('cli.mjs render --module render_fixture_v1 --root <committed fixture> (no --out) writes real, non-empty, well-formed, banner-stamped HTML to the default build/review-render/ path, and that path is git-ignored', async () => {
  await rm(DEFAULT_OUT_DIR, { recursive: true, force: true }); // start clean regardless of prior local runs
  try {
    const result = spawnSync(
      process.execPath,
      [CLI_PATH, 'render', '--module', MODULE_ID, '--root', FIXTURE_ROOT],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    assert.equal(result.error, undefined, `spawnSync itself failed: ${result.error}`);
    assert.equal(result.status, EXIT_OK, `render exited non-zero; stderr: ${result.stderr}`);

    // (1) output file exists and is non-empty, well-formed, self-contained HTML.
    const stats = await stat(DEFAULT_OUTPUT_FILE);
    assert.ok(stats.isFile(), `${DEFAULT_OUTPUT_FILE} must be a real file`);
    assert.ok(stats.size > 0, 'rendered HTML file must be non-empty');

    const html = await readFile(DEFAULT_OUTPUT_FILE, 'utf8');
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<head>[\s\S]*<\/head>/);
    assert.match(html, /<body>[\s\S]*<\/body>/);
    assert.match(html, /<\/html>\s*$/);
    assert.doesNotMatch(html, /<script/i, 'a static render must never carry a <script> tag');
    assert.doesNotMatch(html, /https?:\/\//i, 'a static render must never carry a remote/third-party URL');

    // (2) unvalidated-research-prototype banner present.
    const bannerPattern = new RegExp(escapeRegExp(escapeHtml(UNVALIDATED_PROTOTYPE_BANNER)));
    assert.match(html, bannerPattern, 'the unvalidated-research-prototype banner must render');

    // (2) synthetic non-qualifying labels present — all five fixture records are synthetic: true.
    const nonQualifyingOccurrences = html.split(escapeHtml(NON_QUALIFYING_RECORD_LABEL)).length - 1;
    assert.equal(
      nonQualifyingOccurrences, 5,
      'each of the fixture\'s five synthetic:true records must carry its own non-qualifying label',
    );

    // (4) the emitted file lives under a path git itself recognizes as ignored.
    const ignoreCheck = spawnSync('git', ['check-ignore', '-q', DEFAULT_OUTPUT_FILE], { cwd: REPO_ROOT });
    assert.equal(
      ignoreCheck.status, 0,
      `${DEFAULT_OUTPUT_FILE} must be matched by .gitignore's build/ rule (git check-ignore exit 0)`,
    );

    // (4) ...and is consequently never a tracked file.
    const lsFiles = spawnSync(
      'git', ['ls-files', '--error-unmatch', DEFAULT_OUTPUT_FILE],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    assert.notEqual(lsFiles.status, 0, `${DEFAULT_OUTPUT_FILE} must not be a git-tracked file`);
  } finally {
    await rm(DEFAULT_OUT_DIR, { recursive: true, force: true });
  }
});

test('.gitignore excludes the entire build/ tree (E0 P1-T7 precedent) under which review-record render output is written by default', async () => {
  const gitignore = await readFile(path.join(REPO_ROOT, '.gitignore'), 'utf8');
  assert.match(gitignore, /^build\/$/m, '.gitignore must carry a bare build/ ignore rule');
});

// -------------------------------------------------------------------------------------------
// (3) Zero outbound network calls during a real render invocation.
// -------------------------------------------------------------------------------------------

test('a full render invocation over committed fixture artifacts makes zero outbound network calls (http.request/https.request/fetch never invoked)', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-review-render-smoke-netcheck-'));
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalFetch = globalThis.fetch;
  let calls = 0;

  http.request = (...args) => {
    calls += 1;
    return originalHttpRequest.apply(http, args);
  };
  https.request = (...args) => {
    calls += 1;
    return originalHttpsRequest.apply(https, args);
  };
  if (typeof originalFetch === 'function') {
    globalThis.fetch = (...args) => {
      calls += 1;
      return originalFetch.apply(globalThis, args);
    };
  }

  try {
    const code = await runRender({ module: MODULE_ID, root: FIXTURE_ROOT, out: outDir });
    assert.equal(code, EXIT_OK);
  } finally {
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    if (typeof originalFetch === 'function') globalThis.fetch = originalFetch;
    await rm(outDir, { recursive: true, force: true });
  }

  assert.equal(calls, 0, 'a full render invocation must make zero outbound network calls');
});
