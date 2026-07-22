// tests/ef-review-record-cli.test.mjs — P2-T1 (Evidence Foundry E1 Phase 2, OQ-1/OQ-2/FR-1/FR-7).
//
// Covers this task's own acceptance criteria
// (docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-2-4-workstreams.md,
// row P2-T1):
//   - `cli.mjs --help` lists all 5 verbs.
//   - [Historical, P2-T1] `dry-run` originally failed closed with a distinct, named "not yet
//     implemented" error (`NotImplementedError`, exit 1) rather than a silent no-op or a crash —
//     this file exercised that stub. `scaffold`/`validate` got real implementations in P2-T2 (see
//     tests/ef-review-workflow.test.mjs), `render` in P2-T6 (see tests/ef-review-render.test.mjs),
//     and `dry-run` itself in P2-T8 (see tests/ef-review-dryrun.test.mjs for its full coverage —
//     mechanism, real committed artifact, terminal FR-6 state, friction note, zero-approver-field
//     proof). Every verb this tool exposes is now real; this file no longer exercises any stub.
//   - `list` over a fixture module prints a structured, non-empty per-module review-record state
//     summary (OQ-2 store layout).
//   - Zero network calls / zero model-invocation hooks across all verbs, proven both statically
//     (source grep over every file in the tool) and dynamically (a patched `fetch` that throws if
//     called during an actual verb invocation).
// Plus direct unit coverage of the two P2-T1 primitive modules (`lib/store.mjs`, `lib/chain.mjs`)
// this task's README documents as the "store" / "chain" module boundaries P2-T2..T6 build against.
//
// Process-level assertions below (`--help` output, `list`'s printed text, non-zero exit codes)
// spawn the real `cli.mjs` as a CHILD PROCESS (`node:child_process` `spawnSync`, this repo's own
// established pattern — see e.g. tests/ef-contract-forced-empty.test.mjs) rather than monkey-patch
// `process.stdout.write`/`process.stderr.write` in-process: with 30+ tests in one file, in-process
// stream patching raced with `node --test`'s own TAP reporter writes and intermittently dropped
// whole subtests' result lines. Spawning a real subprocess sidesteps that entirely, and is a more
// faithful end-to-end check of the actual `#!/usr/bin/env node` entry point besides. In-process
// calls are used only where no stdout/stderr content needs inspecting (pure functions, and
// error-type/exit-code assertions via `assert.rejects`).
//
// Every fixture under tests/fixtures/ef-review-record-cli/ lives OUTSIDE the real modules/ tree —
// see that directory's own per-file headers — so nothing here fires scripts/validate-kb.mjs's
// runtime modules/<id>/reviews/*.yaml roster cross-check.
//
// Structural validity proven here never implies clinical validity, safety, or that a named human
// clinician reviewed anything — see schemas/review-record.schema.json's own top-level description
// for that standing caveat.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFlags, dispatchVerb } from '../tools/review-record/cli.mjs';
import { CliError, EXIT_OK, EXIT_USAGE, NotImplementedError, UsageError } from '../tools/review-record/lib/errors.mjs';
import {
  REVIEW_ROLES,
  buildReviewId,
  parseReviewId,
  MalformedReviewIdError,
  reviewsDirFor,
  recordFilePathFor,
  listModuleReviewRecords,
  nextSequenceFor,
} from '../tools/review-record/lib/store.mjs';
import { stableStringify, canonicalRecordHash, checkModuleChainLinkage } from '../tools/review-record/lib/chain.mjs';
import { run as runList, formatModuleState } from '../tools/review-record/lib/verbs/list.mjs';
import { run as runRender } from '../tools/review-record/lib/verbs/render.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL_ROOT = path.join(REPO_ROOT, 'tools', 'review-record');
const CLI_PATH = path.join(TOOL_ROOT, 'cli.mjs');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-review-record-cli');

// Historical (P2-T1): every verb this tool exposes was once a stub here. `render` went real in
// P2-T6 (tests/ef-review-render.test.mjs); `dry-run` went real in P2-T8
// (tests/ef-review-dryrun.test.mjs) — this array is now intentionally empty, kept (rather than
// deleted along with the for-loop below) so a FUTURE net-new verb added to this tool has an
// obvious place to register its own stub-phase coverage, matching this file's own established
// pattern.
const STUB_VERBS = Object.freeze([]);

/** Runs the real `cli.mjs` as a child process and returns its exit status + captured output. */
function runCli(args) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' });
  assert.equal(result.error, undefined, `spawnSync itself failed: ${result.error}`);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

async function listAllToolFiles() {
  const out = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
        out.push(full);
      }
    }
  }
  await walk(TOOL_ROOT);
  return out;
}

/**
 * Strips whole-line `//` comments before the forbidden-pattern scan below. Several files in this
 * tool (this task's own cli.mjs/README) legitimately NAME `node:http`/`fetch`/etc. in prose
 * explaining what they must never import — real code is what this check cares about, not
 * documentation describing the guardrail itself.
 */
function stripLineComments(source) {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

// -------------------------------------------------------------------------------------------
// --help lists all 5 verbs (real subprocess)
// -------------------------------------------------------------------------------------------

test('cli.mjs --help lists all five verbs and exits 0', () => {
  const { status, stdout } = runCli(['--help']);
  assert.equal(status, EXIT_OK);
  for (const verb of ['scaffold', 'validate', 'list', 'render', 'dry-run']) {
    assert.match(stdout, new RegExp(`\\b${verb.replace('-', '\\-')}\\b`), `--help should mention "${verb}"`);
  }
});

test('cli.mjs with no arguments also prints help and exits 0', () => {
  const { status, stdout } = runCli([]);
  assert.equal(status, EXIT_OK);
  assert.match(stdout, /review-record/);
});

test('cli.mjs rejects an unknown verb with exit 1', () => {
  const { status, stderr } = runCli(['not-a-real-verb']);
  assert.equal(status, EXIT_USAGE);
  assert.match(stderr, /unknown verb/);
});

// -------------------------------------------------------------------------------------------
// scaffold / validate / render / dry-run — fail closed, "not yet implemented"
// -------------------------------------------------------------------------------------------

for (const { verb, run, owner } of STUB_VERBS) {
  test(`cli.mjs ${verb} fails closed with exit 1 (subprocess)`, () => {
    const { status, stderr } = runCli([verb]);
    assert.equal(status, EXIT_USAGE);
    assert.match(stderr, /NotImplementedError/);
    assert.match(stderr, /not yet implemented/);
  });

  test(`lib/verbs/${verb}.mjs run() throws a NotImplementedError naming its owning task (${owner})`, async () => {
    await assert.rejects(() => run({}), (err) => {
      assert.ok(err instanceof NotImplementedError);
      assert.ok(err instanceof UsageError);
      assert.equal(err.exitCode, EXIT_USAGE);
      assert.equal(err.verb, verb);
      assert.match(err.owningTasks, new RegExp(owner));
      return true;
    });
  });
}

test('dispatchVerb forwards a NotImplementedError exit code verbatim', async () => {
  const handler = async () => {
    throw new NotImplementedError('dry-run', 'P2-T8');
  };
  const code = await dispatchVerb(handler, {});
  assert.equal(code, EXIT_USAGE);
});

test('dispatchVerb maps a non-CliError throw to EXIT_USAGE without forwarding it as a CliError', async () => {
  const handler = async () => {
    throw new Error('a genuine programmer bug, not a taxonomy-mapped failure');
  };
  const code = await dispatchVerb(handler, {});
  assert.equal(code, EXIT_USAGE);
});

test('dispatchVerb returns EXIT_OK for a handler that resolves without a numeric return', async () => {
  const code = await dispatchVerb(async () => undefined, {});
  assert.equal(code, EXIT_OK);
});

// -------------------------------------------------------------------------------------------
// list — real in P2-T1 (real subprocess for printed-output content; pure-function unit tests below)
// -------------------------------------------------------------------------------------------

test('cli.mjs list over a fixture module prints a structured, non-empty state summary', () => {
  const { status, stdout } = runCli(['list', '--module', 'fixture_module_v1', '--root', FIXTURES_ROOT]);
  assert.equal(status, EXIT_OK);
  assert.match(stdout, /Module: fixture_module_v1/);
  assert.match(stdout, /Reviews: 2/);
  assert.match(stdout, /rr-0001-clinical-1/);
  assert.match(stdout, /rr-0002-clinical-2/);
  assert.match(stdout, /role: clinical-1/);
  assert.match(stdout, /role: clinical-2/);
  assert.match(stdout, /synthetic: true/);
  assert.match(stdout, /decision: approve/);
  // Not a clinical-validity claim (guardrail):
  assert.match(stdout, /not a clinical-validity, safety, or approval claim/);
  // Valid chain -> both records report ok linkage.
  assert.doesNotMatch(stdout, /BROKEN/);
});

test('cli.mjs list reports informational chainLinkage: BROKEN for a deliberately mismatched pair', () => {
  const { status, stdout } = runCli(['list', '--module', 'broken_chain_v1', '--root', FIXTURES_ROOT]);
  assert.equal(status, EXIT_OK);
  assert.match(stdout, /rr-0002-lab/);
  assert.match(stdout, /BROKEN/);
});

test('cli.mjs list over a module with no reviews/ directory reports zero records without crashing', () => {
  const { status, stdout } = runCli(['list', '--module', 'nonexistent_module_v1', '--root', FIXTURES_ROOT]);
  assert.equal(status, EXIT_OK);
  assert.match(stdout, /Reviews: 0/);
  assert.match(stdout, /no review records found/);
});

test('cli.mjs list requires --module and fails closed (exit 1) without it', () => {
  const { status, stderr } = runCli(['list', '--root', FIXTURES_ROOT]);
  assert.equal(status, EXIT_USAGE);
  assert.match(stderr, /--module/);
});

test('cli.mjs list fails closed on a malformed review_id filename rather than silently skipping it', () => {
  const { status, stderr } = runCli(['list', '--module', 'malformed_v1', '--root', FIXTURES_ROOT]);
  assert.equal(status, EXIT_USAGE);
  assert.match(stderr, /MalformedReviewIdError/);
});

test('runList (in-process) resolves EXIT_OK and rejects with UsageError when --module is missing', async () => {
  await assert.rejects(() => runList({ root: FIXTURES_ROOT }), UsageError);
});

test('formatModuleState is a pure function producing the same structure the list verb prints', () => {
  const records = [
    {
      reviewId: 'rr-0001-clinical-1',
      record: {
        role: 'clinical-1',
        reviewerId: 'r1',
        decision: 'approve',
        synthetic: true,
        reviewedAt: '2026-01-01T00:00:00Z',
        supersedes: null,
        previousRecordHash: null,
      },
    },
  ];
  const linkage = new Map([['rr-0001-clinical-1', { ok: true, reason: null }]]);
  const text = formatModuleState('m1', records, linkage);
  assert.match(text, /Module: m1/);
  assert.match(text, /Reviews: 1/);
  assert.match(text, /chainLinkage.*: ok/);
});

test('formatModuleState reports an empty module distinctly, not as an error', () => {
  const text = formatModuleState('empty_mod', [], new Map());
  assert.match(text, /Reviews: 0/);
  assert.match(text, /no review records found/);
});

// -------------------------------------------------------------------------------------------
// lib/store.mjs — OQ-2 store layout primitives
// -------------------------------------------------------------------------------------------

test('REVIEW_ROLES matches the schema role enum order', () => {
  assert.deepEqual(REVIEW_ROLES, ['clinical-1', 'clinical-2', 'lab', 'adjudication', 'release-auth']);
});

test('buildReviewId / parseReviewId round-trip for every role', () => {
  for (const role of REVIEW_ROLES) {
    const reviewId = buildReviewId(7, role);
    assert.equal(reviewId, `rr-0007-${role}`);
    const parsed = parseReviewId(reviewId);
    assert.deepEqual(parsed, { seq: 7, role });
  }
});

test('buildReviewId rejects an unknown role', () => {
  assert.throws(() => buildReviewId(1, 'not-a-role'), /is not one of/);
});

test('buildReviewId rejects a non-1..9999 sequence', () => {
  assert.throws(() => buildReviewId(0, 'lab'));
  assert.throws(() => buildReviewId(10000, 'lab'));
  assert.throws(() => buildReviewId(1.5, 'lab'));
});

test('parseReviewId fails closed (MalformedReviewIdError) on a bad shape', () => {
  for (const bad of ['not-a-review-id', 'rr-1-clinical-1', 'rr-0001-not-a-role', '']) {
    assert.throws(() => parseReviewId(bad), MalformedReviewIdError);
  }
});

test('reviewsDirFor / recordFilePathFor build the exact OQ-2 layout', () => {
  const reviewsDir = reviewsDirFor('/repo', 'cbc_suite_v1');
  assert.equal(reviewsDir, path.join('/repo', 'modules', 'cbc_suite_v1', 'reviews'));
  const recordPath = recordFilePathFor('/repo', 'cbc_suite_v1', 'rr-0001-clinical-1');
  assert.equal(recordPath, path.join(reviewsDir, 'rr-0001-clinical-1.yaml'));
});

test('listModuleReviewRecords reads and parses every record, sorted by seq', async () => {
  const records = await listModuleReviewRecords(FIXTURES_ROOT, 'fixture_module_v1');
  assert.equal(records.length, 2);
  assert.deepEqual(records.map((r) => r.reviewId), ['rr-0001-clinical-1', 'rr-0002-clinical-2']);
  assert.equal(records[0].seq, 1);
  assert.equal(records[0].role, 'clinical-1');
  assert.equal(records[0].record.moduleId, 'fixture_module_v1');
  assert.equal(records[1].record.decision, 'approve');
});

test('listModuleReviewRecords returns [] for a module with no reviews/ directory (not an error)', async () => {
  const records = await listModuleReviewRecords(FIXTURES_ROOT, 'nonexistent_module_v1');
  assert.deepEqual(records, []);
});

test('listModuleReviewRecords fails closed on a malformed filename rather than skipping it', async () => {
  await assert.rejects(
    () => listModuleReviewRecords(FIXTURES_ROOT, 'malformed_v1'),
    MalformedReviewIdError,
  );
});

test('nextSequenceFor is 1 for an empty module and max+1 for a populated one', async () => {
  assert.equal(await nextSequenceFor(FIXTURES_ROOT, 'nonexistent_module_v1'), 1);
  assert.equal(await nextSequenceFor(FIXTURES_ROOT, 'fixture_module_v1'), 3);
});

// -------------------------------------------------------------------------------------------
// lib/chain.mjs — canonicalization + informational linkage report
// -------------------------------------------------------------------------------------------

test('stableStringify is deterministic regardless of input key order', () => {
  const a = { b: 1, a: 2, c: { y: 1, x: 2 } };
  const b = { c: { x: 2, y: 1 }, a: 2, b: 1 };
  assert.equal(stableStringify(a), stableStringify(b));
});

test('canonicalRecordHash is deterministic and sha256:<64 hex>-shaped', () => {
  const record = { a: 1, b: [1, 2, 3], c: null };
  const h1 = canonicalRecordHash(record);
  const h2 = canonicalRecordHash({ c: null, b: [1, 2, 3], a: 1 });
  assert.equal(h1, h2);
  assert.match(h1, /^sha256:[0-9a-f]{64}$/);
});

test('canonicalRecordHash changes on any field mutation (tamper-sensitive)', () => {
  const record = { review_id: 'rr-0001-clinical-1', decision: 'approve' };
  const tampered = { review_id: 'rr-0001-clinical-1', decision: 'reject' };
  assert.notEqual(canonicalRecordHash(record), canonicalRecordHash(tampered));
});

test('checkModuleChainLinkage reports ok for a valid fixture chain', async () => {
  const records = await listModuleReviewRecords(FIXTURES_ROOT, 'fixture_module_v1');
  const linkage = checkModuleChainLinkage(records);
  assert.equal(linkage.length, 2);
  assert.deepEqual(linkage.map((l) => l.ok), [true, true]);
});

test('checkModuleChainLinkage reports a broken link with a specific reason for the mismatched fixture', async () => {
  const records = await listModuleReviewRecords(FIXTURES_ROOT, 'broken_chain_v1');
  const linkage = checkModuleChainLinkage(records);
  assert.equal(linkage[0].ok, true); // first record: previousRecordHash: null is correct
  assert.equal(linkage[1].ok, false);
  assert.match(linkage[1].reason, /does not match the recomputed hash/);
});

test('checkModuleChainLinkage rejects a first record whose previousRecordHash is not null', () => {
  const records = [
    { reviewId: 'rr-0001-clinical-1', record: { previousRecordHash: `sha256:${'0'.repeat(64)}` } },
  ];
  const linkage = checkModuleChainLinkage(records);
  assert.equal(linkage[0].ok, false);
  assert.match(linkage[0].reason, /must carry previousRecordHash: null/);
});

// -------------------------------------------------------------------------------------------
// Zero network / zero model-invocation, structurally (static) and dynamically (patched fetch)
// -------------------------------------------------------------------------------------------

const FORBIDDEN_IMPORT_PATTERNS = [
  /node:http\b/,
  /node:https\b/,
  /node:dgram\b/,
  /node:net\b/,
  /\bfetch\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /@anthropic-ai/,
  /\bopenai\b/i,
  /google-generativeai/i,
];

test('no file under tools/review-record/ imports a network or generative-model API (static)', async () => {
  const files = await listAllToolFiles();
  assert.ok(files.length >= 5, 'expected to find at least the cli.mjs + lib files');
  for (const file of files) {
    const code = stripLineComments(await readFile(file, 'utf8'));
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      assert.doesNotMatch(
        code,
        pattern,
        `${path.relative(REPO_ROOT, file)} must not match forbidden network/model pattern ${pattern}`,
      );
    }
  }
});

test('the real list verb makes zero network calls at runtime (patched global fetch throws if invoked)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network call attempted during a review-record CLI verb invocation');
  };
  try {
    await assert.doesNotReject(() => runList({ module: 'fixture_module_v1', root: FIXTURES_ROOT }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the real render verb makes zero network calls at runtime (patched global fetch throws if invoked)', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-review-render-fetch-check-'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network call attempted during a review-record CLI verb invocation');
  };
  try {
    await assert.doesNotReject(() => runRender({ module: 'fixture_module_v1', root: FIXTURES_ROOT, out: outDir }));
  } finally {
    globalThis.fetch = originalFetch;
    await rm(outDir, { recursive: true, force: true });
  }
});

// `dry-run`'s own zero-network-calls runtime proof lives in tests/ef-review-dryrun.test.mjs
// (P2-T8) — that test needs a git-fixture module/roster this file does not set up, so it is not
// duplicated here.

// -------------------------------------------------------------------------------------------
// parseFlags
// -------------------------------------------------------------------------------------------

test('parseFlags converts kebab-case flags to camelCase and supports boolean flags', () => {
  const options = parseFlags(['--module', 'cbc_suite_v1', '--root', '/tmp/x', '--history']);
  assert.deepEqual(options, { module: 'cbc_suite_v1', root: '/tmp/x', history: true });
});

test('parseFlags rejects a positional argument', () => {
  assert.throws(() => parseFlags(['not-a-flag']), CliError);
});
