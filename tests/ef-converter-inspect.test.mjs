// tests/ef-converter-inspect.test.mjs — P2-T6: `inspect` verb (02 §4.5).
//
// Task acceptance criteria (phase-1-2-foundation-converter.md, row P2-T6):
//   1. "`inspect` run against the P1-T6 fixture prints a structured, non-empty summary" —
//      asserted below by capturing `process.stdout.write` while `run()` executes against the
//      real, committed `tests/fixtures/rf-cbc-001` fixture and parsing the captured output as
//      JSON.
//   2. "A test asserts zero outbound network calls and zero calls to any model-invocation hook
//      during `inspect`" — asserted two ways: (a) at runtime, by spying on `http.request`,
//      `https.request`, and global `fetch` across a live `run()` call and asserting none fire;
//      (b) structurally, by scanning every source file this converter ships for a forbidden
//      import (`node:http`, `node:https`, `node:dgram`, `fetch(`, or a known AI/model SDK name) —
//      matching the README's own "Zero network / zero LLM, structurally" design note.
//
// This suite covers the `inspect` verb in isolation. It is deliberately NOT
// `tests/ef-converter-invariants.test.mjs` — that flat, 15-invariant-numbered file is P2-T8's seam
// task, and this repo's task table treats the two as separate, separately-owned artifacts (same
// convention `tests/ef-converter-loader.test.mjs`, `tests/ef-converter-hashing.test.mjs`,
// `tests/ef-converter-eligibility.test.mjs`, and `tests/ef-converter-error-taxonomy.test.mjs`
// already document for themselves).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runInspect, buildSummary } from '../tools/rf-bundle-to-kb-pack/lib/verbs/inspect.mjs';
import { loadBundle } from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import { pinArtifacts } from '../tools/rf-bundle-to-kb-pack/lib/hashing.mjs';
import { checkEligibility } from '../tools/rf-bundle-to-kb-pack/lib/eligibility.mjs';
import { UsageError, EXIT_OK, EXIT_USAGE } from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const CONVERTER_ROOT = path.join(REPO_ROOT, 'tools', 'rf-bundle-to-kb-pack');

// Same synthetic-module-with-decisions convention every other P2 converter test file uses: a
// throwaway module.json + authoring-decisions.yaml pair, since the real
// `modules/cbc_suite_v1/authoring-decisions.yaml` does not exist until P3-T1 lands (this repo's
// read-only-until-a-task-explicitly-owns-it convention means this test must not pre-empt it).
async function makeTempModuleWithDecisions() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ef-inspect-test-module-'));
  const modulePath = path.join(dir, 'module.json');
  await writeFile(modulePath, JSON.stringify({ id: 'test_stub_module', title: 'Test Stub Module' }), 'utf8');
  await writeFile(path.join(dir, 'authoring-decisions.yaml'), 'notes: temp stub for P2-T6 inspect tests\n', 'utf8');
  return { dir, modulePath };
}

/** Captures everything written to `process.stdout.write` while `fn` runs, then restores it. */
async function withCapturedStdout(fn) {
  const chunks = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    return true;
  };
  try {
    const result = await fn();
    return { result, output: chunks.join('') };
  } finally {
    process.stdout.write = original;
  }
}

// ----- 1. AC 1: inspect against the real fixture prints a structured, non-empty summary --------

test('P2-T6: inspect prints a structured, non-empty JSON summary against the real rf-cbc-001 fixture', async () => {
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  try {
    const { result: exitCode, output } = await withCapturedStdout(() =>
      runInspect({ runDir: FIXTURE_DIR, module: modulePath }),
    );

    assert.equal(exitCode, EXIT_OK);
    assert.ok(output.trim().length > 0, 'inspect must print a non-empty summary');

    const summary = JSON.parse(output);
    assert.equal(summary.verb, 'inspect');
    assert.equal(summary.bundle.status, 'verified');
    assert.ok(Array.isArray(summary.artifacts));
    assert.ok(summary.artifacts.length > 0, 'artifact list must be non-empty');
    assert.ok(summary.artifacts.every((a) => typeof a.sha256 === 'string' && a.sha256.length === 64));
    assert.ok(Array.isArray(summary.claims));
    assert.equal(summary.claims.length, 87); // matches P2-T4's eligibility test's known fixture count
    assert.ok(summary.claims.every((c) => typeof c.eligible === 'boolean'));
    assert.equal(summary.counts.claims, 87);
    assert.equal(summary.counts.eligible, 82);
    assert.equal(summary.counts.rejected, 5);
  } finally {
    await rm(moduleDir, { recursive: true, force: true });
  }
});

test('P2-T6: inspect emits NO pack output (build/kb-pack/ is never created, summary.packOutput is null)', async () => {
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  const packOutRoot = path.join(REPO_ROOT, 'build', 'kb-pack');
  const before = await stat(packOutRoot).catch(() => null);
  try {
    const { result: exitCode, output } = await withCapturedStdout(() =>
      runInspect({ runDir: FIXTURE_DIR, module: modulePath }),
    );
    assert.equal(exitCode, EXIT_OK);
    const summary = JSON.parse(output);
    assert.equal(summary.packOutput, null, 'inspect must never emit pack output');

    const after = await stat(packOutRoot).catch(() => null);
    assert.deepEqual(
      before ? { existed: true } : null,
      after ? { existed: true } : null,
      'inspect must not create build/kb-pack/ as a side effect',
    );
  } finally {
    await rm(moduleDir, { recursive: true, force: true });
  }
});

test('P2-T6: inspect requires --run-dir and --module (usage error, not a stack trace)', async () => {
  await assert.rejects(() => runInspect({}), (err) => {
    assert.ok(err instanceof UsageError);
    assert.equal(err.exitCode, EXIT_USAGE);
    return true;
  });
  await assert.rejects(() => runInspect({ runDir: FIXTURE_DIR }), UsageError);
});

test('P2-T6: buildSummary is a pure function of its pinned-bundle/eligibility inputs (no I/O)', async () => {
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  try {
    const loaded = await loadBundle({ runDir: FIXTURE_DIR, modulePath });
    const pinned = await pinArtifacts(loaded);
    const eligibility = checkEligibility(pinned);
    const summaryA = buildSummary(pinned, eligibility);
    const summaryB = buildSummary(pinned, eligibility);
    assert.deepEqual(summaryA, summaryB);
  } finally {
    await rm(moduleDir, { recursive: true, force: true });
  }
});

// ----- 2. AC 2: zero outbound network calls, zero model-invocation-hook calls -------------------

test('P2-T6: inspect makes zero outbound network calls (http.request/https.request/fetch never invoked)', async () => {
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalFetch = globalThis.fetch;
  let httpCalls = 0;
  let httpsCalls = 0;
  let fetchCalls = 0;

  http.request = (...args) => {
    httpCalls += 1;
    return originalHttpRequest.apply(http, args);
  };
  https.request = (...args) => {
    httpsCalls += 1;
    return originalHttpsRequest.apply(https, args);
  };
  if (typeof originalFetch === 'function') {
    globalThis.fetch = (...args) => {
      fetchCalls += 1;
      return originalFetch.apply(globalThis, args);
    };
  }

  try {
    await withCapturedStdout(() => runInspect({ runDir: FIXTURE_DIR, module: modulePath }));
  } finally {
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    if (typeof originalFetch === 'function') globalThis.fetch = originalFetch;
    await rm(moduleDir, { recursive: true, force: true });
  }

  assert.equal(httpCalls, 0, 'inspect must never call http.request');
  assert.equal(httpsCalls, 0, 'inspect must never call https.request');
  assert.equal(fetchCalls, 0, 'inspect must never call fetch');
});

// Every file this converter ships, walked recursively, for a forbidden import token — the
// structural half of the "zero network / zero LLM" guarantee (README "Zero network / zero LLM,
// structurally"). Deliberately matches only real `import ... from '<token>'` statements (or a
// `fetch(` call), not prose mentioning these words in a comment, so this test does not
// false-positive on the very documentation explaining the guarantee.
async function collectConverterSourceFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectConverterSourceFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(full);
    }
  }
  return files;
}

const FORBIDDEN_IMPORT_PATTERNS = [
  /^\s*import\b[^;]*from\s+['"](?:node:)?http['"]/m,
  /^\s*import\b[^;]*from\s+['"](?:node:)?https['"]/m,
  /^\s*import\b[^;]*from\s+['"](?:node:)?dgram['"]/m,
  /^\s*import\b[^;]*from\s+['"]@anthropic-ai\/[^'"]*['"]/m,
  /^\s*import\b[^;]*from\s+['"]openai['"]/m,
  /(?<!\/\/[^\n]*)\bfetch\s*\(/,
];

test('P2-T6: no file under tools/rf-bundle-to-kb-pack/ imports a network or AI/model-SDK module (structural)', async () => {
  const files = await collectConverterSourceFiles(CONVERTER_ROOT);
  assert.ok(files.length > 0, 'sanity: the converter source tree must not be empty');

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      assert.ok(
        !pattern.test(source),
        `${path.relative(REPO_ROOT, file)} matches forbidden pattern ${pattern} (network/AI-SDK import)`,
      );
    }
  }
});
