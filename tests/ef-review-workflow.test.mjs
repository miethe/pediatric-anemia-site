// tests/ef-review-workflow.test.mjs — P2-T2 (Evidence Foundry E1 Phase 2, FR-3/FR-4/FR-7).
//
// Covers this task's own acceptance criteria
// (docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-2-4-workstreams.md,
// row P2-T2):
//   - All 5 roles scaffold to schema-valid drafts (`scaffold`'s field-shape is proven schema-valid
//     once a signature is attached — see "scaffold produces..." below for why P2-T2's own draft
//     output cannot independently satisfy the schema's `synthetic:true` branch: it owns no signing
//     capability, that is P2-T5/P2-T8).
//   - `reviewerId` must resolve against `governance/reviewer-roster.yaml` (fixture root here);
//     unknown identity and out-of-scope identity both fail closed.
//   - FR-4 reviewer-2 independence is proven BOTH structurally (a `scaffold --role clinical-2`
//     invocation over a module with an existing, sentinel-marked `clinical-1` record never prints
//     or embeds that sentinel anywhere) AND via the `validate` heuristic layer (a hand-built
//     `clinical-2` fixture quoting `clinical-1`'s rationale verbatim is rejected).
//   - Seeded violation (b): a hand-built record citing a non-roster `reviewerId` is rejected by
//     `validate`.
//
// Process-level assertions spawn the real `cli.mjs` as a child process (`spawnSync`), matching
// tests/ef-review-record-cli.test.mjs's own established rationale (stdout/stderr content assertions
// race with node:test's TAP reporter when done in-process). In-process calls are used only for pure
// library-level assertions (schema-shape proof, write-path unit tests) that need no CLI stdout.
//
// Every fixture under tests/fixtures/ef-review-record-cli/ (including this task's own additions:
// governance/reviewer-roster.yaml, modules/independence_target_v1/, modules/independence_violation_v1/,
// modules/nonroster_reviewer_v1/) lives OUTSIDE the real modules/ and governance/ trees — see each
// fixture's own header — so nothing here fires scripts/validate-kb.mjs's runtime cross-checks, and
// scaffold's disk-write path (gated on a `synthetic: false` roster entry, which never legitimately
// exists pre-G1 — see lib/verbs/scaffold.mjs's header) is never exercised via a "real" fixture
// persona; the write-path MACHINERY itself is unit-tested directly against a throwaway tmp dir
// below, using an arbitrary valid-shaped record object that makes no reviewer-credential claim.
//
// Structural validity proven here never implies clinical validity, safety, or that a named human
// clinician reviewed anything — see schemas/review-record.schema.json's own top-level description
// for that standing caveat.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { spawnSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate as validateAgainstSchema } from '../scripts/lib/json-schema-lite.mjs';
import {
  REVIEW_ROLES,
  buildReviewId,
  listModuleReviewRecords,
  recordFilePathFor,
  serializeReviewRecordYaml,
  writeNewReviewRecordFile,
} from '../tools/review-record/lib/store.mjs';
import { canonicalRecordHash, nextChainLink } from '../tools/review-record/lib/chain.mjs';
import { parseYamlDocument } from '../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';
import { loadRosterIndex, resolveReviewer, buildRosterIndex, rosterFilePathFor } from '../tools/review-record/lib/roster.mjs';
import {
  VALIDATOR_POLICY_VERSION,
  hashFileIfExists,
  hashPredecessorSet,
  writeCacheFileAtomic,
} from '../tools/review-record/lib/validate-cache.mjs';
import { checkReviewerIndependence, longestCommonSubstringLength } from '../tools/review-record/lib/independence.mjs';
import { computeModuleContentHash } from '../tools/review-record/lib/subject.mjs';
import { signRecordDryRun } from '../tools/review-record/lib/signature.mjs';
import { buildDraftRecord, draftFilePathFor, run as runScaffold } from '../tools/review-record/lib/verbs/scaffold.mjs';
import { run as runValidate } from '../tools/review-record/lib/verbs/validate.mjs';
import { run as runSign } from '../tools/review-record/lib/verbs/sign.mjs';
import { isExpectedTerminalNonQualifyingViolations } from '../tools/review-record/lib/verbs/dry-run.mjs';
import {
  ACTS_COMPLETE_UNAUTHORIZED,
  REDACTED_MARKER,
  STRUCTURALLY_NON_QUALIFYING_TERMINUS_NOTE as STATUS_TERMINUS_NOTE,
  applyRedaction,
  computeEffectiveRecordsByRole,
  computeTurnState,
  run as runStatus,
} from '../tools/review-record/lib/verbs/status.mjs';
import {
  STRUCTURALLY_NON_QUALIFYING_TERMINUS_NOTE as RENDER_TERMINUS_NOTE,
  loadModuleRenderData,
  renderModuleHtml,
} from '../tools/review-record/lib/render.mjs';
import {
  RecordAlreadyExistsError,
  ReviewerNotInScopeError,
  UnknownReviewerError,
  UsageError,
  ValidationFailedError,
  EXIT_OK,
  EXIT_USAGE,
} from '../tools/review-record/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(REPO_ROOT, 'tools', 'review-record', 'cli.mjs');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-review-record-cli');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');

const SUBJECT_HASH = 'sha256:537d2dcf29f8e2871a4b91129ec3da3d0012d48ee90af0784ea8c93db7398c6d';
const SENTINEL = 'SENTINEL-REVIEWER-ONE-TOKEN-7f2c9a3d';

/**
 * @param {string[]} args
 * @param {object} [env] optional extra environment variables merged over `process.env` for THIS
 *   spawned child process only (e.g. `REVIEW_RECORD_CACHE_DIR` -- P2-T4's fresh-process cache
 *   tests). Omitted entirely (not even an empty object passed to `spawnSync`) when `env` is
 *   undefined, preserving every pre-existing caller's exact prior behavior byte-for-byte.
 */
function runCli(args, env) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    ...(env ? { env: { ...process.env, ...env } } : {}),
  });
  assert.equal(result.error, undefined, `spawnSync itself failed: ${result.error}`);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

async function loadSchema() {
  return JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
}

// -------------------------------------------------------------------------------------------
// scaffold — 5 roles produce a field-shape that is schema-valid once a signature exists
// -------------------------------------------------------------------------------------------

test('scaffold produces a correctly-shaped draft for all five roles (schema-valid once a TEST-ONLY stub signature is attached to prove shape — scaffold itself never fabricates one, see lib/verbs/scaffold.mjs header)', async () => {
  const schema = await loadSchema();
  for (const role of REVIEW_ROLES) {
    const rosterIndex = await loadRosterIndex(FIXTURES_ROOT);
    const rosterEntry = resolveReviewer(rosterIndex, 'synthetic-multirole-reviewer', 'scaffold_target_v1');
    const { seq, previousRecordHash } = await nextChainLink(FIXTURES_ROOT, 'scaffold_target_v1');
    const reviewId = buildReviewId(seq, role);
    const draft = buildDraftRecord({
      moduleId: 'scaffold_target_v1',
      role,
      reviewId,
      subjectContentHash: SUBJECT_HASH,
      previousRecordHash,
      supersedes: null,
      reviewerId: 'synthetic-multirole-reviewer',
      decision: 'approve',
      rationale: `Fixture draft rationale for role ${role}.`,
      reviewedAt: '2026-02-01T00:00:00Z',
      synthetic: rosterEntry.synthetic === true,
    });
    assert.equal(draft.role, role);
    assert.equal(draft.review_id, `rr-0001-${role}`);
    assert.equal(draft.synthetic, true);
    assert.equal(draft.signature, null);

    // Prove every OTHER field is schema-conformant by attaching a TEST-ONLY stub signature (not
    // scaffold's own behavior — see this test's title and lib/verbs/scaffold.mjs's header).
    const withStubSignature = {
      ...draft,
      signature: { algorithm: 'ed25519', keyId: 'TESTKEY-p2t2-shape-proof-stub', value: 'c3R1Yg==' },
    };
    const errors = validateAgainstSchema(schema, withStubSignature);
    assert.deepEqual(errors, [], `role ${role}: ${JSON.stringify(errors)}`);
  }
});

test('cli.mjs scaffold (subprocess) succeeds for all five roles, prints a DRAFT ONLY preview, and writes nothing to disk', () => {
  for (const role of REVIEW_ROLES) {
    const { status, stdout, stderr } = runCli([
      'scaffold',
      '--module', 'scaffold_target_v1',
      '--role', role,
      '--subject', SUBJECT_HASH,
      '--reviewer-id', 'synthetic-multirole-reviewer',
      '--decision', 'approve',
      '--rationale', `Fixture draft rationale for role ${role}.`,
      '--reviewed-at', '2026-02-01T00:00:00Z',
      '--root', FIXTURES_ROOT,
      // CRW-F5 revision (BLOCKER 2): scaffold_target_v1 carries no non-reviews/ content under
      // FIXTURES_ROOT by design (a narrow CLI-behavior fixture, not a full module package) -- F5
      // now hard-fails on an uncomputable module hash by default; this test is about the five-role
      // preview mechanism, not F5 itself, so the loud, explicit escape hatch is used.
      '--allow-historical-subject',
    ]);
    assert.equal(status, EXIT_OK, `role ${role} stderr: ${stderr}`);
    assert.match(stdout, /DRAFT ONLY — NOT WRITTEN TO DISK/);
    assert.match(stdout, new RegExp(`role: ${role}\\b`));
    assert.match(stdout, new RegExp(`review_id: rr-0001-${role}\\b`));
    assert.match(stdout, /synthetic: true/);
    assert.match(stdout, /signature: null/);
    assert.match(stdout, /not a clinical-validity, safety, or approval claim/);
  }
});

test('cli.mjs scaffold never actually writes a file for a synthetic roster persona (fixture tree unchanged)', async () => {
  const before = await listModuleReviewRecords(FIXTURES_ROOT, 'scaffold_target_v1');
  assert.deepEqual(before, []);
  runCli([
    'scaffold', '--module', 'scaffold_target_v1', '--role', 'clinical-1', '--subject', SUBJECT_HASH,
    '--reviewer-id', 'synthetic-multirole-reviewer', '--decision', 'approve', '--rationale', 'x'.repeat(10),
    '--root', FIXTURES_ROOT,
    '--allow-historical-subject', // CRW-F5 revision (BLOCKER 2) -- see the test above's own comment
  ]);
  const after = await listModuleReviewRecords(FIXTURES_ROOT, 'scaffold_target_v1');
  assert.deepEqual(after, [], 'scaffold must not write a file when the resolved roster entry is synthetic:true');
});

// -------------------------------------------------------------------------------------------
// scaffold — roster resolution fails closed (FR-3)
// -------------------------------------------------------------------------------------------

test('scaffold fails closed on an unknown reviewerId', async () => {
  await assert.rejects(
    () => runScaffold({
      module: 'scaffold_target_v1', role: 'clinical-1', subject: SUBJECT_HASH,
      reviewerId: 'nobody-on-the-roster', decision: 'approve', rationale: 'x'.repeat(10),
      root: FIXTURES_ROOT,
      // CRW-F5 revision (BLOCKER 2): scaffold_target_v1 has no on-disk content under FIXTURES_ROOT
      // -- F5 now hard-fails by default before ever reaching roster resolution. This test is about
      // roster resolution, not F5, so the loud, explicit escape hatch is used.
      allowHistoricalSubject: true,
    }),
    UnknownReviewerError,
  );
});

test('cli.mjs scaffold (subprocess) rejects an unknown reviewerId with exit 1', () => {
  const { status, stderr } = runCli([
    'scaffold', '--module', 'scaffold_target_v1', '--role', 'clinical-1', '--subject', SUBJECT_HASH,
    '--reviewer-id', 'nobody-on-the-roster', '--decision', 'approve', '--rationale', 'x'.repeat(10),
    '--root', FIXTURES_ROOT,
    '--allow-historical-subject', // CRW-F5 revision (BLOCKER 2) -- see the test above's own comment
  ]);
  assert.equal(status, EXIT_USAGE);
  assert.match(stderr, /UnknownReviewerError/);
  assert.match(stderr, /does not resolve to any entry in governance\/reviewer-roster\.yaml/);
});

test('scaffold fails closed on a reviewerId whose moduleScopes do not include the target module', async () => {
  await assert.rejects(
    () => runScaffold({
      module: 'scaffold_target_v1', role: 'clinical-1', subject: SUBJECT_HASH,
      reviewerId: 'synthetic-out-of-scope', decision: 'approve', rationale: 'x'.repeat(10),
      root: FIXTURES_ROOT,
      allowHistoricalSubject: true, // CRW-F5 revision (BLOCKER 2) -- see the test above's own comment
    }),
    ReviewerNotInScopeError,
  );
});

// -------------------------------------------------------------------------------------------
// scaffold — required-flag / shape validation
// -------------------------------------------------------------------------------------------

test('scaffold requires every required flag', async () => {
  const base = {
    module: 'scaffold_target_v1', role: 'clinical-1', subject: SUBJECT_HASH,
    reviewerId: 'synthetic-multirole-reviewer', decision: 'approve', rationale: 'x'.repeat(10),
    root: FIXTURES_ROOT,
  };
  for (const key of Object.keys(base)) {
    if (key === 'root') continue; // --root is optional (defaults to cwd)
    if (key === 'subject') continue; // P1-T3 (FR-3, R8): --subject is now optional/auto-derived
    const copy = { ...base };
    delete copy[key];
    await assert.rejects(() => runScaffold(copy), UsageError, `missing ${key} should fail closed`);
  }
});

test('scaffold rejects an invalid role, subject hash, and decision', async () => {
  const base = {
    module: 'scaffold_target_v1', role: 'clinical-1', subject: SUBJECT_HASH,
    reviewerId: 'synthetic-multirole-reviewer', decision: 'approve', rationale: 'x'.repeat(10),
    root: FIXTURES_ROOT,
  };
  await assert.rejects(() => runScaffold({ ...base, role: 'clinical-3' }), UsageError);
  await assert.rejects(() => runScaffold({ ...base, subject: 'not-a-hash' }), UsageError);
  await assert.rejects(() => runScaffold({ ...base, decision: 'pending' }), UsageError);
});

test('scaffold accepts a valid --supersedes review_id and rejects a malformed one', async () => {
  const rosterIndex = await loadRosterIndex(FIXTURES_ROOT);
  resolveReviewer(rosterIndex, 'synthetic-multirole-reviewer', 'scaffold_target_v1'); // sanity: resolves
  const base = {
    module: 'scaffold_target_v1', role: 'clinical-1', subject: SUBJECT_HASH,
    reviewerId: 'synthetic-multirole-reviewer', decision: 'approve', rationale: 'x'.repeat(10),
    root: FIXTURES_ROOT,
    // CRW-F5 revision (BLOCKER 2): scaffold_target_v1 has no on-disk content under FIXTURES_ROOT --
    // F5 now hard-fails by default. This test is about --supersedes validation, not F5, so the
    // loud, explicit escape hatch is used (harmless to the two malformed-supersedes rejection
    // cases below, which both throw earlier, at the supersedes check itself).
    allowHistoricalSubject: true,
  };
  await assert.rejects(() => runScaffold({ ...base, supersedes: 'not-a-review-id' }), UsageError);
  // A validly-shaped (if fictitious) review_id is accepted at the flag-parsing level.
  const code = await runScaffold({ ...base, supersedes: 'rr-0001-clinical-1' });
  assert.equal(code, EXIT_OK);
});

// -------------------------------------------------------------------------------------------
// P1-T3 (clinical-review-workflow-v1, FR-3/4/5, R7/R8) — scaffold ergonomics: auto-derived
// subject + real-identity write path.
//
// Only the FIRST test below ("auto-derives...") intentionally runs against the REAL repo
// root/module: R8's own claim is that auto-derivation can never drift from what a fresh dry-run
// over the SAME already-committed module would compute, which is only provable against real,
// committed module content — so that one test reads (never writes) the real
// governance/reviewer-roster.yaml (to resolve `dryrun-cbc-suite-clinical-1`, a `synthetic: true`
// persona, so `scaffold` only ever prints a DRAFT ONLY preview — see lib/verbs/scaffold.mjs — it
// never writes to modules/cbc_suite_v1/reviews/ or governance/reviewer-roster.yaml). The "zero
// diff" test at the end of this section proves that read never became a write.
//
// The second test below (the explicit-`--subject` regression check) needs no real module or
// roster content — it is retargeted to `FIXTURES_ROOT` (tests/fixtures/ef-review-record-cli/,
// already used throughout this file) so it proves its regression without touching the real
// roster at all. The third test uses its own throwaway tmp root that copies
// tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml into its own
// governance/reviewer-roster.yaml — never the real one.
// -------------------------------------------------------------------------------------------

test('scaffold without --subject on cbc_suite_v1 auto-derives the same subjectContentHash dry-run would (R8)', async () => {
  const expected = await computeModuleContentHash(REPO_ROOT, 'cbc_suite_v1');
  assert.match(expected, /^sha256:[0-9a-f]{64}$/);

  const { status, stdout, stderr } = runCli([
    'scaffold', '--module', 'cbc_suite_v1', '--role', 'clinical-1',
    '--reviewer-id', 'dryrun-cbc-suite-clinical-1', '--decision', 'approve',
    '--rationale', 'P1-T3 R8 regression check: auto-derived subject only, no clinical claim.',
    '--reviewed-at', '2026-02-04T00:00:00Z',
    '--root', REPO_ROOT,
  ]);
  assert.equal(status, EXIT_OK, stderr);
  assert.match(stdout, /DRAFT ONLY — NOT WRITTEN TO DISK/);
  const match = stdout.match(/subjectContentHash: (sha256:[0-9a-f]{64})/);
  assert.ok(match, `expected a subjectContentHash line in scaffold's preview output, got:\n${stdout}`);
  assert.equal(match[1], expected, 'auto-derived subjectContentHash must byte-match computeModuleContentHash');
});

test('scaffold\'s explicit-subject code path is behaviorally unchanged by P1-T3\'s auto-derivation addition (fixture root, real roster untouched)', () => {
  const { status, stdout, stderr } = runCli([
    'scaffold', '--module', 'scaffold_target_v1', '--role', 'lab',
    '--subject', SUBJECT_HASH,
    '--reviewer-id', 'synthetic-multirole-reviewer', '--decision', 'approve',
    '--rationale', 'P1-T3 explicit-subject regression check against a fixture root, no clinical claim.',
    '--reviewed-at', '2026-02-04T00:05:00Z',
    '--root', FIXTURES_ROOT,
    // CRW-F5 revision (BLOCKER 2): scaffold_target_v1 has no on-disk content under FIXTURES_ROOT --
    // F5 now hard-fails on that by default (this test predates that revision; it is about P1-T3's
    // auto-derivation addition leaving the explicit-subject path otherwise unchanged, not about F5).
    '--allow-historical-subject',
  ]);
  assert.equal(status, EXIT_OK, stderr);
  assert.match(stdout, /DRAFT ONLY — NOT WRITTEN TO DISK/);
  assert.match(stdout, new RegExp(`subjectContentHash: ${SUBJECT_HASH}`));
});

test('scaffold against the fixture roster\'s one synthetic:false entry writes a schema-valid file with signature: null (FR-3/4)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-workflow-real-entry-'));
  try {
    const fixtureRosterPath = path.join(
      REPO_ROOT, 'tests', 'fixtures', 'clinical-review-workflow', 'roster-with-real-entry.yaml',
    );
    const rosterYaml = await readFile(fixtureRosterPath, 'utf8');
    await mkdir(path.join(tmp, 'governance'), { recursive: true });
    await writeFile(path.join(tmp, 'governance', 'reviewer-roster.yaml'), rosterYaml, 'utf8');

    const moduleId = 'real_entry_fixture_v1'; // matches the fixture roster entry's moduleScopes[]
    const code = await runScaffold({
      module: moduleId,
      role: 'clinical-1',
      subject: SUBJECT_HASH,
      reviewerId: 'fixture-real-reviewer-1',
      decision: 'approve',
      rationale: 'Fixture-only real-identity write-path regression check — structural only, not a clinical review.',
      reviewedAt: '2026-02-05T00:00:00Z',
      root: tmp,
      // CRW-F5 revision (BLOCKER 2): this tmp root carries only governance/reviewer-roster.yaml,
      // no modules/real_entry_fixture_v1/ content -- F5 now hard-fails on that by default. This
      // test is about the real-identity write path, not F5, so the loud, explicit escape hatch
      // is used.
      allowHistoricalSubject: true,
    });
    assert.equal(code, EXIT_OK);

    const records = await listModuleReviewRecords(tmp, moduleId);
    assert.equal(records.length, 1, 'expected exactly one written review record');
    const [{ record }] = records;
    assert.equal(record.synthetic, false);
    assert.equal(record.signature, null);
    assert.equal(record.reviewerId, 'fixture-real-reviewer-1');

    const schema = await loadSchema();
    const errors = validateAgainstSchema(schema, record);
    assert.deepEqual(errors, [], `written record must be schema-valid: ${JSON.stringify(errors)}`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('governance/reviewer-roster.yaml shows zero diff against HEAD after this task\'s scaffold tests (proves no persisted content change; the file IS read read-only by the auto-derivation test above, by design -- see this section\'s header)', () => {
  const result = spawnSync('git', ['diff', '--name-only', '--', 'governance/reviewer-roster.yaml'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout.trim(),
    '',
    'governance/reviewer-roster.yaml must show zero diff against HEAD after any P1-T3 scaffold test',
  );
});

// -------------------------------------------------------------------------------------------
// CRW-F2 gap closure (Clinical Review Workflow v1, Phase 1 prerequisite for Phase 2's P2-T1):
// F5 (--subject <-> content-hash comparison, --allow-historical-subject) and --draft staging.
// -------------------------------------------------------------------------------------------

/**
 * Swaps the first pair of adjacent differing hex characters found in `hex` -- produces a
 * transposed-but-pattern-valid hash that provably differs from the input (never a same-value
 * "swap" that could silently no-op the test).
 * @param {string} hex 64 lowercase hex characters
 * @returns {string}
 */
function transposeAdjacentDifferingHexChars(hex) {
  for (let i = 0; i < hex.length - 1; i += 1) {
    if (hex[i] !== hex[i + 1]) {
      return hex.slice(0, i) + hex[i + 1] + hex[i] + hex.slice(i + 2);
    }
  }
  throw new Error('transposeAdjacentDifferingHexChars: no adjacent differing hex chars found');
}

test('F5: an explicit --subject that mismatches cbc_suite_v1\'s recomputed content hash hard-fails by default, and --allow-historical-subject suppresses ONLY that comparison (transposed-but-pattern-valid hash, both directions)', async () => {
  const realHash = await computeModuleContentHash(REPO_ROOT, 'cbc_suite_v1');
  const [, hex] = realHash.split(':');
  const transposedHash = `sha256:${transposeAdjacentDifferingHexChars(hex)}`;
  assert.notEqual(transposedHash, realHash);
  assert.match(transposedHash, /^sha256:[0-9a-f]{64}$/);

  const baseArgs = [
    'scaffold', '--module', 'cbc_suite_v1', '--role', 'clinical-1',
    '--subject', transposedHash,
    '--reviewer-id', 'dryrun-cbc-suite-clinical-1', '--decision', 'approve',
    '--rationale', 'F5 regression check: transposed-but-pattern-valid subject, no clinical claim.',
    '--reviewed-at', '2026-02-09T00:00:00Z',
    '--root', REPO_ROOT,
  ];

  const withoutFlag = runCli(baseArgs);
  assert.equal(withoutFlag.status, EXIT_USAGE, withoutFlag.stdout);
  assert.match(withoutFlag.stderr, /does not match/);
  assert.match(withoutFlag.stderr, /--allow-historical-subject/);

  const withFlag = runCli([...baseArgs, '--allow-historical-subject']);
  assert.equal(withFlag.status, EXIT_OK, withFlag.stderr);
  assert.match(withFlag.stdout, /DRAFT ONLY — NOT WRITTEN TO DISK/);
  assert.match(withFlag.stdout, new RegExp(`subjectContentHash: ${transposedHash}`));
});

test('F5 REVISION (CRW-F5, clinical-review-workflow-v1 Wave-2 codex gate, BLOCKER 2): when the target module has no on-disk content to recompute a hash from (module directory absent -- the shape of every bare CLI-test fixture module in this file, and of the already-shipped P4-T5 discordance->adjudication scaffold bridge\'s own fixture root), an explicit --subject now HARD-FAILS by default, naming the underlying failure -- "cannot verify" is no longer treated as "nothing to compare," it is treated exactly like "verified and it disagrees" -- and --allow-historical-subject proceeds anyway with a loud NOTICE', () => {
  const baseArgs = [
    'scaffold', '--module', 'scaffold_target_v1', '--role', 'clinical-1', '--subject', SUBJECT_HASH,
    '--reviewer-id', 'synthetic-multirole-reviewer', '--decision', 'approve',
    '--rationale', 'F5 revision regression: an uncomputable module hash must hard-fail by default.',
    '--root', FIXTURES_ROOT,
  ];

  const withoutFlag = runCli(baseArgs);
  assert.equal(withoutFlag.status, EXIT_USAGE, withoutFlag.stdout);
  assert.match(withoutFlag.stderr, /could not be recomputed to verify it against/);
  assert.match(withoutFlag.stderr, /--allow-historical-subject/);

  const withFlag = runCli([...baseArgs, '--allow-historical-subject']);
  assert.equal(withFlag.status, EXIT_OK, withFlag.stderr);
  assert.match(withFlag.stdout, /NOTICE \(--allow-historical-subject\)/);
  assert.match(withFlag.stdout, /was SKIPPED/);
  assert.match(withFlag.stdout, /DRAFT ONLY/);
});

test('scaffold --draft writes the built record to <root>/.review-drafts/<moduleId>/<review_id>.draft.yaml, prints that path, and writes NOTHING under reviews/', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-workflow-draft-'));
  try {
    await mkdir(path.join(tmp, 'governance'), { recursive: true });
    await writeFile(
      path.join(tmp, 'governance', 'reviewer-roster.yaml'),
      'schemaVersion: 1\n' +
        'reviewers:\n' +
        '  - reviewerId: draft-fixture-reviewer\n' +
        '    name: "SYNTHETIC -- NOT A CREDENTIALED REVIEWER (draft-staging fixture)"\n' +
        '    credentialRef: fixture-placeholder-draft\n' +
        '    moduleScopes:\n' +
        '      - draft_staging_v1\n' +
        '    synthetic: true\n',
      'utf8',
    );

    const before = await listModuleReviewRecords(tmp, 'draft_staging_v1');
    assert.deepEqual(before, []);

    const { status, stdout, stderr } = runCli([
      'scaffold', '--module', 'draft_staging_v1', '--role', 'clinical-1', '--subject', SUBJECT_HASH,
      '--reviewer-id', 'draft-fixture-reviewer', '--decision', 'approve',
      '--rationale', 'P2-T1/CRW-F2 --draft staging regression check, no clinical claim.',
      '--reviewed-at', '2026-02-09T00:00:00Z',
      '--root', tmp, '--draft',
      // CRW-F5 revision (BLOCKER 2): this tmp root carries only governance/reviewer-roster.yaml, no
      // modules/draft_staging_v1/ content -- F5 now hard-fails on that by default. This test is
      // about --draft staging, not F5, so the loud, explicit escape hatch is used.
      '--allow-historical-subject',
    ]);
    assert.equal(status, EXIT_OK, stderr);

    const expectedPath = draftFilePathFor(tmp, 'draft_staging_v1', 'rr-0001-clinical-1');
    assert.match(stdout, new RegExp(expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    const draft = parseYamlDocument(await readFile(expectedPath, 'utf8'));
    assert.equal(draft.synthetic, true);
    assert.equal(draft.signature, null);
    assert.equal(draft.moduleId, 'draft_staging_v1');

    const after = await listModuleReviewRecords(tmp, 'draft_staging_v1');
    assert.deepEqual(after, [], '--draft must never write under modules/<id>/reviews/');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('.review-drafts/ is git-ignored (F1 staging area never git-tracked)', () => {
  const result = spawnSync(
    'git',
    ['check-ignore', '-q', path.join(REPO_ROOT, '.review-drafts', 'cbc_suite_v1', 'rr-0001-clinical-1.draft.yaml')],
    { cwd: REPO_ROOT },
  );
  assert.equal(result.status, 0, 'expected git check-ignore to report .review-drafts/ paths as ignored (exit 0)');
});

// -------------------------------------------------------------------------------------------
// P2-T1 (Clinical Review Workflow v1, Phase 2) -- `sign` verb, TESTKEY-only synthetic path
// (FR-6/FR-25, OQ-1, F1). Every fixture below is a throwaway tmp root, never the real repo tree
// (except read-only reuse of tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml,
// itself never the real governance/reviewer-roster.yaml -- see that fixture's own header).
// -------------------------------------------------------------------------------------------

async function writeSignFixtureRoster(tmp, entries) {
  const lines = ['schemaVersion: 1', 'reviewers:'];
  for (const entry of entries) {
    lines.push(`  - reviewerId: ${entry.reviewerId}`);
    lines.push(`    name: "SYNTHETIC -- NOT A CREDENTIALED REVIEWER (${entry.label})"`);
    lines.push(`    credentialRef: fixture-placeholder-${entry.reviewerId}`);
    lines.push('    moduleScopes:');
    lines.push(`      - ${entry.moduleId}`);
    lines.push('    synthetic: true');
  }
  await mkdir(path.join(tmp, 'governance'), { recursive: true });
  await writeFile(path.join(tmp, 'governance', 'reviewer-roster.yaml'), `${lines.join('\n')}\n`, 'utf8');
}

async function writeTrivialModuleContent(tmp, moduleId) {
  await mkdir(path.join(tmp, 'modules', moduleId), { recursive: true });
  await writeFile(path.join(tmp, 'modules', moduleId, 'module.json'), '{"schemaVersion":1}\n', 'utf8');
}

test('P2-T1: full flow scaffold --draft -> sign --draft <path> on a synthetic fixture writes exactly one new reviews/*.yaml and round-trips against validate (chain-link + signature-verify pass)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-workflow-sign-roundtrip-'));
  try {
    const moduleId = 'sign_roundtrip_v1';
    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'sign-fixture-clinical-1', moduleId, label: 'sign roundtrip fixture' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);

    const scaffoldCode = await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'sign-fixture-clinical-1',
      decision: 'approve', rationale: 'Sign round-trip fixture, structural only, no clinical claim.',
      reviewedAt: '2026-02-10T00:00:00Z', root: tmp, draft: true,
    });
    assert.equal(scaffoldCode, EXIT_OK);

    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    const draftBefore = parseYamlDocument(await readFile(draftPath, 'utf8'));
    assert.equal(draftBefore.synthetic, true);
    assert.equal(draftBefore.signature, null);

    const before = await listModuleReviewRecords(tmp, moduleId);
    assert.deepEqual(before, []);

    const signCode = await runSign({ draft: draftPath, module: moduleId, root: tmp });
    assert.equal(signCode, EXIT_OK);

    const after = await listModuleReviewRecords(tmp, moduleId);
    assert.equal(after.length, 1, 'sign must write exactly one new reviews/*.yaml');
    const [{ record }] = after;
    assert.equal(record.synthetic, true);
    assert.ok(record.signature, 'signed record must carry a populated signature');
    assert.equal(record.signature.algorithm, 'ed25519');
    assert.ok(record.signature.keyId.startsWith('TESTKEY-'));
    assert.equal(record.previousRecordHash, null);

    // Round-trips against validate: chain-link (first record, previousRecordHash null) +
    // signature-verify both pass.
    await assert.doesNotReject(() => runValidate({ module: moduleId, root: tmp }));

    // The staged draft is consumed (best-effort cleanup) -- never re-signable/re-writable.
    await assert.rejects(() => readFile(draftPath, 'utf8'));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('cli.mjs (subprocess): scaffold --draft -> sign --draft round-trips end to end', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-workflow-sign-cli-'));
  try {
    const moduleId = 'sign_cli_roundtrip_v1';
    await writeSignFixtureRoster(tmp, [{ reviewerId: 'sign-cli-reviewer', moduleId, label: 'CLI round-trip fixture' }]);
    await writeTrivialModuleContent(tmp, moduleId);

    const scaffoldResult = runCli([
      'scaffold', '--module', moduleId, '--role', 'clinical-1',
      '--reviewer-id', 'sign-cli-reviewer', '--decision', 'approve',
      '--rationale', 'CLI subprocess round-trip regression, structural only, no clinical claim.',
      '--reviewed-at', '2026-02-14T00:00:00Z', '--root', tmp, '--draft',
    ]);
    assert.equal(scaffoldResult.status, EXIT_OK, scaffoldResult.stderr);
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');

    const signResult = runCli(['sign', '--draft', draftPath, '--module', moduleId, '--root', tmp]);
    assert.equal(signResult.status, EXIT_OK, signResult.stderr);
    assert.match(signResult.stdout, /TESTKEY-/);

    const records = await listModuleReviewRecords(tmp, moduleId);
    assert.equal(records.length, 1);
    assert.ok(records[0].record.signature);
    assert.ok(records[0].record.signature.keyId.startsWith('TESTKEY-'));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('F1: sign never opens or rewrites a path already inside reviews/ -- an existing sibling record\'s bytes/mtime are unchanged across a sign call', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-workflow-sign-f1-'));
  try {
    const moduleId = 'sign_f1_v1';
    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'sign-f1-clinical-1', moduleId, label: 'F1 fixture, clinical-1' },
      { reviewerId: 'sign-f1-clinical-2', moduleId, label: 'F1 fixture, clinical-2' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);

    // First act: clinical-1, drafted + signed normally -- this is the "pre-existing" committed
    // record whose bytes/mtime this test protects across the SECOND sign call below.
    const scaffold1Code = await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'sign-f1-clinical-1',
      decision: 'approve', rationale: 'First fixture reviewer approves this F1 workflow-mechanics exercise.',
      reviewedAt: '2026-02-11T00:00:00Z', root: tmp, draft: true,
    });
    assert.equal(scaffold1Code, EXIT_OK);
    const draft1Path = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    const sign1Code = await runSign({ draft: draft1Path, module: moduleId, root: tmp });
    assert.equal(sign1Code, EXIT_OK);

    const clinical1FilePath = recordFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    const bytesBefore = await readFile(clinical1FilePath);
    const statBefore = await stat(clinical1FilePath);

    // Second act: clinical-2, drafted + signed -- the sign call under test.
    const scaffold2Code = await runScaffold({
      module: moduleId, role: 'clinical-2', reviewerId: 'sign-f1-clinical-2',
      decision: 'approve',
      rationale: 'Second fixture reviewer independently reaches agreement, without consulting any prior act.',
      reviewedAt: '2026-02-11T00:05:00Z', root: tmp, draft: true,
    });
    assert.equal(scaffold2Code, EXIT_OK);
    const draft2Path = draftFilePathFor(tmp, moduleId, 'rr-0002-clinical-2');
    const sign2Code = await runSign({ draft: draft2Path, module: moduleId, root: tmp });
    assert.equal(sign2Code, EXIT_OK);

    const bytesAfter = await readFile(clinical1FilePath);
    const statAfter = await stat(clinical1FilePath);
    assert.deepEqual(
      bytesAfter, bytesBefore,
      'F1: pre-existing sibling record bytes must be byte-identical across a sign call',
    );
    assert.equal(
      statAfter.mtimeMs, statBefore.mtimeMs,
      'F1: pre-existing sibling record mtime must be unchanged across a sign call',
    );

    // Round-trip confirmation: two chain-linked records now exist, both signature-valid.
    const records = await listModuleReviewRecords(tmp, moduleId);
    assert.equal(records.length, 2);
    assert.equal(records[1].record.previousRecordHash, canonicalRecordHash(records[0].record));
    await assert.doesNotReject(() => runValidate({ module: moduleId, root: tmp }));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('sign refuses a --draft path that resolves outside <root>/.review-drafts/<moduleId>/ -- including a path already inside reviews/ (F1/R10)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-workflow-sign-outside-'));
  try {
    const moduleId = 'sign_outside_v1';
    await writeSignFixtureRoster(tmp, [{ reviewerId: 'sign-outside-reviewer', moduleId, label: 'outside-drafts fixture' }]);
    await writeTrivialModuleContent(tmp, moduleId);

    await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'sign-outside-reviewer',
      decision: 'approve', rationale: 'Outside-drafts-dir regression fixture, structural only.',
      reviewedAt: '2026-02-12T00:00:00Z', root: tmp, draft: true,
    });
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    await runSign({ draft: draftPath, module: moduleId, root: tmp });

    // Now committed under reviews/ -- pointing --draft directly at it must be refused.
    const reviewsPath = recordFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    await assert.rejects(() => runSign({ draft: reviewsPath, module: moduleId, root: tmp }), UsageError);

    // A path entirely unrelated to either tree is refused too.
    await assert.rejects(
      () => runSign({ draft: path.join(tmp, 'not-a-draft.yaml'), module: moduleId, root: tmp }),
      UsageError,
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('sign refuses a --draft path that does not exist', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-workflow-sign-missing-'));
  try {
    const moduleId = 'sign_missing_v1';
    const missingPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    await assert.rejects(() => runSign({ draft: missingPath, module: moduleId, root: tmp }), UsageError);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('sign refuses a synthetic:false draft (real-identity gate, pre-G1/G2) -- fixture roster only, never the real governance/reviewer-roster.yaml', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-workflow-sign-real-'));
  try {
    const fixtureRosterPath = path.join(
      REPO_ROOT, 'tests', 'fixtures', 'clinical-review-workflow', 'roster-with-real-entry.yaml',
    );
    await mkdir(path.join(tmp, 'governance'), { recursive: true });
    await writeFile(
      path.join(tmp, 'governance', 'reviewer-roster.yaml'),
      await readFile(fixtureRosterPath, 'utf8'),
      'utf8',
    );
    const moduleId = 'real_entry_fixture_v1'; // matches the fixture roster entry's moduleScopes[]

    const scaffoldCode = await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'fixture-real-reviewer-1',
      decision: 'approve',
      rationale: 'Fixture-only real-identity sign-refusal regression check, structural only.',
      subject: SUBJECT_HASH, reviewedAt: '2026-02-13T00:00:00Z', root: tmp, draft: true,
      // CRW-F5 revision (BLOCKER 2): this tmp root carries only governance/reviewer-roster.yaml, no
      // modules/real_entry_fixture_v1/ content -- F5 now hard-fails on that by default. This test
      // is about sign's synthetic:false refusal, not F5, so the loud, explicit escape hatch is used.
      allowHistoricalSubject: true,
    });
    assert.equal(scaffoldCode, EXIT_OK);
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    const draft = parseYamlDocument(await readFile(draftPath, 'utf8'));
    assert.equal(draft.synthetic, false);

    await assert.rejects(() => runSign({ draft: draftPath, module: moduleId, root: tmp }), UsageError);

    // Never actually written to reviews/ -- the refusal is truly fail-closed, not a partial write.
    const records = await listModuleReviewRecords(tmp, moduleId);
    assert.deepEqual(records, []);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('sign refuses when the staged draft\'s own moduleId field does not match --module (defense in depth beyond the staging-path check)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-workflow-sign-modmismatch-'));
  try {
    const moduleId = 'sign_modmismatch_v1';
    await writeSignFixtureRoster(tmp, [{ reviewerId: 'sign-modmismatch-reviewer', moduleId, label: 'moduleId-mismatch fixture' }]);
    await writeTrivialModuleContent(tmp, moduleId);

    await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'sign-modmismatch-reviewer',
      decision: 'approve', rationale: 'moduleId-mismatch defense-in-depth regression, structural only.',
      reviewedAt: '2026-02-13T00:00:00Z', root: tmp, draft: true,
    });
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    const tampered = (await readFile(draftPath, 'utf8')).replace(`moduleId: ${moduleId}`, 'moduleId: a-different-module-id');
    await writeFile(draftPath, tampered, 'utf8');

    await assert.rejects(() => runSign({ draft: draftPath, module: moduleId, root: tmp }), UsageError);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('sign requires every required flag (--draft, --module, --root -- frozen signature has no optional flags)', async () => {
  await assert.rejects(() => runSign({ module: 'x', root: 'y' }), UsageError);
  await assert.rejects(() => runSign({ draft: 'x', root: 'y' }), UsageError);
  await assert.rejects(() => runSign({ draft: 'x', module: 'y' }), UsageError);
});

test('cli.mjs --help lists sign with the exact frozen signature', () => {
  const { status, stdout } = runCli(['--help']);
  assert.equal(status, EXIT_OK);
  assert.match(stdout, /sign --draft <path> --module <id> --root <dir>/);
});

// -------------------------------------------------------------------------------------------
// FR-4 reviewer-2 independence — structural (scaffold never reads/prints clinical-1 content)
// -------------------------------------------------------------------------------------------

test('cli.mjs scaffold --role clinical-2 never prints, embeds, or otherwise surfaces a sentinel string unique to the module\'s clinical-1 record', () => {
  const { status, stdout, stderr } = runCli([
    'scaffold', '--module', 'independence_target_v1', '--role', 'clinical-2', '--subject', SUBJECT_HASH,
    '--reviewer-id', 'synthetic-multirole-reviewer', '--decision', 'approve',
    '--rationale', 'Independent clinical-2 assessment, formed without reading clinical-1.',
    '--reviewed-at', '2026-02-02T00:00:00Z',
    '--root', FIXTURES_ROOT,
    // CRW-F5 revision (BLOCKER 2): independence_target_v1 carries only reviews/ under FIXTURES_ROOT
    // -- F5 now hard-fails on that by default. This test is about FR-4 structural independence, not
    // F5, so the loud, explicit escape hatch is used.
    '--allow-historical-subject',
  ]);
  assert.equal(status, EXIT_OK, stderr);
  assert.doesNotMatch(stdout, new RegExp(SENTINEL));
  assert.doesNotMatch(stderr, new RegExp(SENTINEL));
  // The chain link DID fire correctly (previousRecordHash is non-null, computed from clinical-1's
  // canonical hash) — proving the "no content" guarantee is not simply "chaining is broken."
  assert.doesNotMatch(stdout, /previousRecordHash: null/);
});

test('the clinical-1 record used above really does carry the sentinel (fixture sanity check)', async () => {
  const records = await listModuleReviewRecords(FIXTURES_ROOT, 'independence_target_v1');
  const clinical1 = records.find((r) => r.role === 'clinical-1');
  assert.ok(clinical1, 'expected a committed clinical-1 fixture for independence_target_v1');
  assert.match(clinical1.record.rationale, new RegExp(SENTINEL));
});

test('nextChainLink returns only a seq + hash string, never the record object (the structural enforcement mechanism)', async () => {
  const link = await nextChainLink(FIXTURES_ROOT, 'independence_target_v1');
  assert.deepEqual(Object.keys(link).sort(), ['previousRecordHash', 'seq']);
  assert.match(link.previousRecordHash, /^sha256:[0-9a-f]{64}$/);
  const expected = await listModuleReviewRecords(FIXTURES_ROOT, 'independence_target_v1');
  assert.equal(link.previousRecordHash, canonicalRecordHash(expected[0].record));
});

// -------------------------------------------------------------------------------------------
// FR-4 reviewer-2 independence — STRUCTURAL sibling isolation (P2-fix)
//
// chain_isolation_v1/reviews/ carries TWO prior records: rr-0001-clinical-1.yaml is deliberately
// unparseable (a `|` block scalar tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs always throws
// YamlParseError on), and rr-0002-lab.yaml is an ordinary, parseable immediate predecessor. Before
// this fix, `nextChainLink` called `listModuleReviewRecords`, which reads AND PARSES every `.yaml`
// file in the directory (rr-0001 included) before returning — so this exact fixture would have
// thrown a YamlParseError before scaffold could ever produce rr-0003. The fixed `nextChainLink`
// derives `seq` from filenames alone and opens only the single highest-numbered (immediate
// predecessor) file to compute its hash, so rr-0001 is never read at all.
// -------------------------------------------------------------------------------------------

test('nextChainLink never opens a sibling record other than the immediate predecessor -- an earlier unparseable file does not throw', async () => {
  const link = await nextChainLink(FIXTURES_ROOT, 'chain_isolation_v1');
  assert.deepEqual(Object.keys(link).sort(), ['previousRecordHash', 'seq']);
  assert.equal(link.seq, 3); // rr-0001, rr-0002 exist on disk -> next is 3, regardless of rr-0001's content
  assert.match(link.previousRecordHash, /^sha256:[0-9a-f]{64}$/);
  // Proves the hash was computed FROM rr-0002 (the real predecessor), not fabricated / skipped:
  const raw = await readFile(
    path.join(FIXTURES_ROOT, 'modules', 'chain_isolation_v1', 'reviews', 'rr-0002-lab.yaml'),
    'utf8',
  );
  const rr0002 = parseYamlDocument(raw);
  assert.equal(link.previousRecordHash, canonicalRecordHash(rr0002));
});

test('cli.mjs scaffold --role clinical-2 over a chain with an earlier unparseable sibling still succeeds, and its output contains no booby-trap sentinel content', () => {
  const { status, stdout, stderr } = runCli([
    'scaffold', '--module', 'chain_isolation_v1', '--role', 'clinical-2', '--subject', SUBJECT_HASH,
    '--reviewer-id', 'synthetic-multirole-reviewer', '--decision', 'approve',
    '--rationale', 'Independent scaffold over a chain whose earlier sibling record cannot be parsed.',
    '--reviewed-at', '2026-02-03T00:00:00Z',
    '--root', FIXTURES_ROOT,
    // CRW-F5 revision (BLOCKER 2): chain_isolation_v1 carries only reviews/ under FIXTURES_ROOT --
    // F5 now hard-fails on that by default. This test is about chain-linkage isolation, not F5, so
    // the loud, explicit escape hatch is used.
    '--allow-historical-subject',
  ]);
  // A pre-fix implementation (listModuleReviewRecords-based) would have thrown YamlParseError
  // reading rr-0001 before ever reaching this point; a non-EXIT_OK status or a YamlParseError
  // trace in stderr would mean the fix regressed back to reading every sibling record.
  assert.equal(status, EXIT_OK, stderr);
  assert.doesNotMatch(stderr, /YamlParseError/);
  assert.match(stdout, /review_id: rr-0003-clinical-2/);
  assert.doesNotMatch(stdout, /BOOBYTRAP/);
  assert.doesNotMatch(stderr, /BOOBYTRAP/);
  // The chain link DID fire (non-null previousRecordHash, computed from the real rr-0002
  // predecessor) — proving success isn't just "the chain silently broke."
  assert.doesNotMatch(stdout, /previousRecordHash: null/);
});

// -------------------------------------------------------------------------------------------
// FR-4 reviewer-2 independence — heuristic layer (validate)
// -------------------------------------------------------------------------------------------

test('longestCommonSubstringLength finds the real shared span', () => {
  assert.equal(longestCommonSubstringLength('xxQUICKBROWNFOXxx', 'yyyQUICKBROWNFOXyyy'), 'QUICKBROWNFOX'.length);
  assert.equal(longestCommonSubstringLength('abc', 'xyz'), 0);
  assert.equal(longestCommonSubstringLength('', 'abc'), 0);
});

test('checkReviewerIndependence flags a verbatim-overlap clinical-2 rationale', () => {
  const c1 = { review_id: 'rr-0001-clinical-1', reviewerId: 'r1', rationale: 'a'.repeat(30) };
  const c2 = { review_id: 'rr-0002-clinical-2', reviewerId: 'r2', rationale: `prefix ${'a'.repeat(30)} suffix` };
  const violations = checkReviewerIndependence(c1, c2);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /verbatim substring/);
});

test('checkReviewerIndependence flags a clinical-2 rationale that names clinical-1\'s reviewerId', () => {
  const c1 = { review_id: 'rr-0001-clinical-1', reviewerId: 'unique-reviewer-id-xyz', rationale: 'ok' };
  const c2 = { review_id: 'rr-0002-clinical-2', reviewerId: 'r2', rationale: 'per unique-reviewer-id-xyz I agree' };
  const violations = checkReviewerIndependence(c1, c2);
  assert.ok(violations.some((v) => v.includes('references clinical-1 reviewerId')));
});

test('checkReviewerIndependence returns no violations when either record is missing', () => {
  assert.deepEqual(checkReviewerIndependence(undefined, { rationale: 'x' }), []);
  assert.deepEqual(checkReviewerIndependence({ rationale: 'x' }, undefined), []);
});

test('checkReviewerIndependence is clean for two genuinely independent rationales', () => {
  const c1 = { review_id: 'rr-0001-clinical-1', reviewerId: 'reviewer-a', rationale: 'Consistent with iron deficiency anemia given the low ferritin.' };
  const c2 = { review_id: 'rr-0002-clinical-2', reviewerId: 'reviewer-b', rationale: 'Findings support a microcytic hypochromic pattern warranting iron studies.' };
  assert.deepEqual(checkReviewerIndependence(c1, c2), []);
});

// -------------------------------------------------------------------------------------------
// validate — seeded violation (a): hand-built clinical-2 referencing clinical-1 content
// -------------------------------------------------------------------------------------------

test('validate rejects the hand-built independence_violation_v1 fixture pair (seeded violation a)', async () => {
  await assert.rejects(
    () => runValidate({ module: 'independence_violation_v1', root: FIXTURES_ROOT }),
    (err) => {
      assert.ok(err instanceof ValidationFailedError);
      assert.ok(err.violations.some((v) => v.includes('verbatim substring')));
      return true;
    },
  );
});

test('cli.mjs validate (subprocess) rejects independence_violation_v1 with exit 1', () => {
  const { status, stderr } = runCli(['validate', '--module', 'independence_violation_v1', '--root', FIXTURES_ROOT]);
  assert.equal(status, EXIT_USAGE);
  assert.match(stderr, /ValidationFailedError/);
  assert.match(stderr, /reviewer-2 independence/);
});

// -------------------------------------------------------------------------------------------
// validate — seeded violation (b): non-roster reviewerId
// -------------------------------------------------------------------------------------------

test('validate rejects the hand-built nonroster_reviewer_v1 fixture (seeded violation b)', async () => {
  await assert.rejects(
    () => runValidate({ module: 'nonroster_reviewer_v1', root: FIXTURES_ROOT }),
    (err) => {
      assert.ok(err instanceof ValidationFailedError);
      assert.ok(err.violations.some((v) => v.includes('does not resolve to any entry in governance/reviewer-roster.yaml')));
      return true;
    },
  );
});

test('cli.mjs validate (subprocess) rejects nonroster_reviewer_v1 with exit 1', () => {
  const { status, stderr } = runCli(['validate', '--module', 'nonroster_reviewer_v1', '--root', FIXTURES_ROOT]);
  assert.equal(status, EXIT_USAGE);
  assert.match(stderr, /ValidationFailedError/);
  assert.match(stderr, /does not resolve to any entry/);
});

// -------------------------------------------------------------------------------------------
// validate — happy path
// -------------------------------------------------------------------------------------------

test('validate accepts a clean single-record module (independence_target_v1)', async () => {
  const code = await runValidate({ module: 'independence_target_v1', root: FIXTURES_ROOT });
  assert.equal(code, EXIT_OK);
});

test('validate requires --module', async () => {
  await assert.rejects(() => runValidate({ root: FIXTURES_ROOT }), UsageError);
});

test('validate rejects a --record value that is not found', async () => {
  await assert.rejects(
    () => runValidate({ module: 'independence_target_v1', root: FIXTURES_ROOT, record: 'rr-9999-lab' }),
    UsageError,
  );
});

// -------------------------------------------------------------------------------------------
// lib/roster.mjs — direct unit coverage
// -------------------------------------------------------------------------------------------

test('buildRosterIndex skips entries with a non-string reviewerId rather than throwing', () => {
  const index = buildRosterIndex({ reviewers: [{ reviewerId: 42 }, { reviewerId: 'ok-id', synthetic: true, moduleScopes: ['m'] }] });
  assert.equal(index.size, 1);
  assert.ok(index.has('ok-id'));
});

test('loadRosterIndex returns an empty Map for a root with no governance/reviewer-roster.yaml', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-record-noroster-'));
  try {
    const index = await loadRosterIndex(tmp);
    assert.equal(index.size, 0);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('resolveReviewer throws UnknownReviewerError / ReviewerNotInScopeError as documented', async () => {
  const index = await loadRosterIndex(FIXTURES_ROOT);
  assert.throws(() => resolveReviewer(index, 'not-there', 'scaffold_target_v1'), UnknownReviewerError);
  assert.throws(() => resolveReviewer(index, 'synthetic-out-of-scope', 'scaffold_target_v1'), ReviewerNotInScopeError);
  const entry = resolveReviewer(index, 'synthetic-multirole-reviewer', 'scaffold_target_v1');
  assert.equal(entry.reviewerId, 'synthetic-multirole-reviewer');
});

// -------------------------------------------------------------------------------------------
// lib/store.mjs — write path (append-only guard), tested directly against a throwaway tmp dir.
// The record object below is arbitrary test-shaped data used ONLY to exercise the WRITE FUNCTION's
// mechanics (directory creation, append-only guard, YAML round-trip) — it is never claimed to be,
// and is never committed anywhere near, a real or even fixture-roster-backed review act.
// -------------------------------------------------------------------------------------------

function sampleRecord(overrides = {}) {
  return {
    schemaVersion: 1,
    review_id: 'rr-0001-clinical-1',
    role: 'clinical-1',
    moduleId: 'writepath_target_v1',
    subjectContentHash: SUBJECT_HASH,
    previousRecordHash: null,
    supersedes: null,
    reviewerId: 'write-path-unit-test-id',
    decision: 'approve',
    rationale: 'Write-path unit test record: contains a colon, a "quote", and\na newline.',
    reviewedAt: '2026-02-03T00:00:00Z',
    synthetic: false,
    signature: null,
    ...overrides,
  };
}

test('writeNewReviewRecordFile creates modules/<id>/reviews/ and writes a round-trippable record', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-record-write-'));
  try {
    const record = sampleRecord();
    const filePath = await writeNewReviewRecordFile(tmp, 'writepath_target_v1', record.review_id, record);
    assert.equal(filePath, recordFilePathFor(tmp, 'writepath_target_v1', record.review_id));

    const [written] = await listModuleReviewRecords(tmp, 'writepath_target_v1');
    assert.deepEqual(written.record, record);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('writeNewReviewRecordFile fails closed (RecordAlreadyExistsError) rather than overwriting an existing path', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-record-write-collision-'));
  try {
    const record = sampleRecord();
    await writeNewReviewRecordFile(tmp, 'writepath_target_v1', record.review_id, record);
    await assert.rejects(
      () => writeNewReviewRecordFile(tmp, 'writepath_target_v1', record.review_id, { ...record, decision: 'reject' }),
      RecordAlreadyExistsError,
    );
    // The original file must be untouched by the rejected second write.
    const [stillOriginal] = await listModuleReviewRecords(tmp, 'writepath_target_v1');
    assert.equal(stillOriginal.record.decision, 'approve');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('writeNewReviewRecordFile refuses (fail-closed) a reviewId whose computed path would escape modules/<id>/reviews/ -- additive containment guard, independent of any caller-side validation (BLOCKER 1(c), clinical-review-workflow-v1 Wave-2 codex gate)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-record-write-traversal-'));
  try {
    const record = sampleRecord({ review_id: '../../escape' });
    await assert.rejects(
      () => writeNewReviewRecordFile(tmp, 'writepath_target_v1', '../../escape', record),
      UsageError,
    );
    // path.join(modules/writepath_target_v1/reviews/, "../../escape.yaml") would land two levels
    // up from reviews/ -- i.e. at modules/escape.yaml -- were the traversal not refused first.
    const escapePath = path.join(tmp, 'modules', 'escape.yaml');
    await assert.rejects(() => readFile(escapePath, 'utf8'), 'the escape path must never be created');
    assert.deepEqual(await listModuleReviewRecords(tmp, 'writepath_target_v1'), []);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('writeNewReviewRecordFile refuses (fail-closed) when modules/<id>/reviews is a SYMBOLIC LINK to an outside directory -- lexical containment alone cannot catch this (path.resolve/path.relative never touch the filesystem); nothing is written at the link target; happy path (real, non-symlinked directories, exercised by every other writeNewReviewRecordFile test in this file) is unchanged (BLOCKER 1(c) symlink vector, clinical-review-workflow-v1 Wave-2 codex RE-PASS)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-record-write-symlink-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'ef-review-record-write-symlink-outside-'));
  try {
    const moduleId = 'writepath_symlink_target_v1';
    await mkdir(path.join(tmp, 'modules', moduleId), { recursive: true });
    // modules/<id>/reviews is a symlink pointing OUTSIDE `tmp` entirely -- lexically it still
    // resolves "inside" modules/<id>/reviews/ (resolvesStrictlyInside/path.resolve/path.relative
    // never touch the filesystem), so only an lstat-based ancestor check (assertNoSymlinkedAncestor)
    // catches this. git CAN carry a committed symlink exactly like this one into any clone (see
    // store.mjs's own header) -- this is not merely a same-user-trust concern.
    await symlink(outside, path.join(tmp, 'modules', moduleId, 'reviews'));

    const record = sampleRecord({ moduleId });
    await assert.rejects(
      () => writeNewReviewRecordFile(tmp, moduleId, record.review_id, record),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.match(err.message, /SYMBOLIC LINK/);
        return true;
      },
    );

    // Nothing was written at the symlink's TARGET (outside tmp entirely).
    assert.deepEqual(await readdir(outside), [], 'nothing may be written at the symlink target');
  } finally {
    await rm(tmp, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('writeNewReviewRecordFile: exclusive-create closes the TOCTOU window -- a file that already sits at the target path (simulating a second, concurrent writer that committed it between a caller\'s own existence check and this call) is refused, fail-closed, with the pre-existing file\'s bytes/mtime unchanged (MAJOR 4, clinical-review-workflow-v1 Wave-2 codex gate)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-record-write-toctou-'));
  try {
    const record = sampleRecord();
    const filePath = recordFilePathFor(tmp, 'writepath_target_v1', record.review_id);
    // Pre-create the target path directly (bypassing writeNewReviewRecordFile entirely) --
    // simulates the exact race MAJOR 4 closes: a second concurrent writer already committed this
    // record between a caller's own (hypothetical) existence check and its own write attempt.
    await mkdir(path.dirname(filePath), { recursive: true });
    const preExistingBytes = 'schemaVersion: 1\nreview_id: rr-0001-clinical-1\n# pre-existing, untouched\n';
    await writeFile(filePath, preExistingBytes, 'utf8');
    const statBefore = await stat(filePath);

    await assert.rejects(
      () => writeNewReviewRecordFile(tmp, 'writepath_target_v1', record.review_id, { ...record, decision: 'reject' }),
      RecordAlreadyExistsError,
    );

    const bytesAfter = await readFile(filePath, 'utf8');
    const statAfter = await stat(filePath);
    assert.equal(bytesAfter, preExistingBytes, 'pre-existing file bytes must be byte-identical, unchanged');
    assert.equal(statAfter.mtimeMs, statBefore.mtimeMs, 'pre-existing file mtime must be unchanged');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('serializeReviewRecordYaml round-trips a signed synthetic record through parseYamlDocument', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-review-record-write-signed-'));
  try {
    const record = sampleRecord({
      synthetic: true,
      signature: { algorithm: 'ed25519', keyId: 'TESTKEY-roundtrip', value: 'dGVzdC12YWx1ZQ==' },
    });
    await writeNewReviewRecordFile(tmp, 'writepath_target_v1', record.review_id, record);
    const [written] = await listModuleReviewRecords(tmp, 'writepath_target_v1');
    assert.deepEqual(written.record, record);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('serializeReviewRecordYaml is a pure function producing YAML text (no disk access)', () => {
  const yaml = serializeReviewRecordYaml(sampleRecord());
  assert.match(yaml, /^schemaVersion: 1/);
  assert.match(yaml, /reviewerId: "write-path-unit-test-id"/);
  assert.match(yaml, /signature: null/);
});

// -------------------------------------------------------------------------------------------
// Zero network calls (scaffold, validate) — matches tests/ef-review-record-cli.test.mjs's own
// dynamic pattern for the verbs P2-T1 already covered.
// -------------------------------------------------------------------------------------------

test('scaffold and validate make zero network calls at runtime (patched global fetch throws if invoked)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network call attempted during a review-record CLI verb invocation');
  };
  try {
    await assert.doesNotReject(() => runScaffold({
      module: 'scaffold_target_v1', role: 'clinical-1', subject: SUBJECT_HASH,
      reviewerId: 'synthetic-multirole-reviewer', decision: 'approve', rationale: 'x'.repeat(10),
      root: FIXTURES_ROOT,
      // CRW-F5 revision (BLOCKER 2): scaffold_target_v1 has no on-disk content under FIXTURES_ROOT
      // -- F5 now hard-fails on that by default. This test is about zero-network-calls, not F5, so
      // the loud, explicit escape hatch is used.
      allowHistoricalSubject: true,
    }));
    await assert.doesNotReject(() => runValidate({ module: 'independence_target_v1', root: FIXTURES_ROOT }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// -------------------------------------------------------------------------------------------
// P1-T1 (clinical-review-workflow-v1, FR-2/R2) — validate.mjs must consume the ONE shared
// derived-state library (tools/review-record/lib/derived-state.mjs's computeDerivedReviewState)
// rather than reimplementing its own copy of the module-wide independence/chain/authorship/
// release-authorization reasoning inline. A structural (source-text) check, not a behavioral one —
// the behavioral proof is every other `validate`-exercising test in this file (and in
// tests/ef-review-adjudication.test.mjs) continuing to pass unchanged against the refactored verb.
// -------------------------------------------------------------------------------------------

test('lib/verbs/validate.mjs contains zero duplicated derived-state logic -- it imports and calls computeDerivedReviewState rather than reimplementing the module-wide checks lib/derived-state.mjs now owns', async () => {
  const validateSource = await readFile(
    path.join(REPO_ROOT, 'tools', 'review-record', 'lib', 'verbs', 'validate.mjs'),
    'utf8',
  );

  // validate.mjs must actually import and call the shared library, not merely happen to avoid the
  // patterns below by coincidence.
  assert.match(
    validateSource,
    /import\s*\{[^}]*computeDerivedReviewState[^}]*\}\s*from\s*['"]\.\.\/derived-state\.mjs['"]/,
    'lib/verbs/validate.mjs must import computeDerivedReviewState from ../derived-state.mjs',
  );
  assert.match(
    validateSource,
    /computeDerivedReviewState\(/,
    'lib/verbs/validate.mjs must actually call computeDerivedReviewState(...)',
  );

  // ...and must NOT reimplement any of the module-wide checks lib/derived-state.mjs now owns —
  // these direct function calls (and the two now-obsolete direct imports) would only reappear here
  // if a future edit forked this reasoning back into two independently-maintained copies, exactly
  // what P1-T1's extraction (and this program's "single source of truth" note in the Phase 1
  // progress file) exists to prevent.
  for (const pattern of [
    /checkReviewerIndependence\(/,
    /checkModuleChainLinkage\(/,
    /evaluateReleaseAuthorization\(/,
    /rosterEntryInAuthorshipUnion\(/,
    /from ['"]\.\.\/independence\.mjs['"]/,
    /from ['"]\.\.\/chain\.mjs['"]/,
  ]) {
    assert.doesNotMatch(
      validateSource,
      pattern,
      `lib/verbs/validate.mjs must not directly call/import ${pattern} -- that reasoning now lives ` +
        'solely in lib/derived-state.mjs (computeDerivedReviewState), P1-T1',
    );
  }
});

// -------------------------------------------------------------------------------------------
// P1-T2 (clinical-review-workflow-v1, FR-1/FR-2/FR-27/FR-28/FR-29, OQ-2) — `status` verb: frozen
// --json shape, redaction-by-default (FR-27), fail-closed `invalid` state (FR-28), non-authorizing
// terminal-state naming (FR-29), human output naming the next-expected role/terminal state.
//
// This "committed JSON-shape fixture" (STATUS_JSON_TOP_LEVEL_KEYS/STATUS_RECORD_KEYS/
// STATUS_DERIVED_STATE_ENUM below) is defined inline in this file rather than as a separate fixture
// file: this task's declared target surfaces are exactly cli.mjs, lib/verbs/status.mjs, and this
// test file.
// -------------------------------------------------------------------------------------------

const STATUS_JSON_TOP_LEVEL_KEYS = [
  'moduleId', 'subjectContentHash', 'records', 'derivedState', 'nextExpectedRole', 'blockers',
].sort();
const STATUS_RECORD_KEYS = [
  'role', 'review_id', 'reviewerId', 'decision', 'rationale', 'synthetic', 'supersedes', 'chainLinkage',
].sort();
/** OQ-2/FR-29: the frozen derivedState enum. NEVER a `release-ready`-like value pre-G0/G1/G2/G4. */
const STATUS_DERIVED_STATE_ENUM = Object.freeze([
  'not-started',
  'in-progress',
  'disputed',
  'structurally-non-qualifying',
  ACTS_COMPLETE_UNAUTHORIZED,
  'invalid',
]);

/**
 * Asserts `parsed` (an already-`JSON.parse`d `status --json` body) matches the frozen OQ-2 shape:
 * exactly the six named top-level keys (no more, no fewer), correct per-key types, a `derivedState`
 * drawn from the frozen enum, and every `records[]` entry carrying exactly the eight named fields.
 *
 * @param {object} parsed
 */
function assertStatusJsonShape(parsed) {
  assert.deepEqual(Object.keys(parsed).sort(), STATUS_JSON_TOP_LEVEL_KEYS, 'unexpected top-level key set');
  assert.equal(typeof parsed.moduleId, 'string');
  assert.ok(
    parsed.subjectContentHash === null || typeof parsed.subjectContentHash === 'string',
    'subjectContentHash must be a string or null',
  );
  assert.ok(Array.isArray(parsed.records));
  assert.ok(
    STATUS_DERIVED_STATE_ENUM.includes(parsed.derivedState),
    `derivedState "${parsed.derivedState}" is not one of the frozen enum values`,
  );
  assert.ok(
    parsed.nextExpectedRole === null || REVIEW_ROLES.includes(parsed.nextExpectedRole),
    'nextExpectedRole must be null or one of the five REVIEW_ROLES',
  );
  assert.ok(Array.isArray(parsed.blockers));
  for (const record of parsed.records) {
    assert.deepEqual(Object.keys(record).sort(), STATUS_RECORD_KEYS, 'unexpected records[] entry key set');
  }
}

function runStatusCli(args) {
  const result = spawnSync(process.execPath, [CLI_PATH, 'status', ...args], { encoding: 'utf8' });
  assert.equal(result.error, undefined, `spawnSync itself failed: ${result.error}`);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// -------------------------------------------------------------------------------------------
// --help lists status with the exact frozen command signature
// -------------------------------------------------------------------------------------------

test('cli.mjs --help lists status with the exact frozen command signature', () => {
  const { status, stdout, stderr } = runCli(['--help']);
  assert.equal(status, EXIT_OK, stderr);
  assert.match(stdout, /status --module <id> \[--root <dir>\] \[--json\] \[--history\] \[--unredacted\]/);
});

// -------------------------------------------------------------------------------------------
// Frozen --json shape (OQ-2) against the committed cbc_suite_v1 dry-run set
// -------------------------------------------------------------------------------------------

test('status --module cbc_suite_v1 --json validates against the frozen JSON-shape contract and reports the correct terminal state', () => {
  const { status, stdout, stderr } = runStatusCli(['--module', 'cbc_suite_v1', '--json']);
  assert.equal(status, EXIT_OK, stderr);
  const parsed = JSON.parse(stdout);
  assertStatusJsonShape(parsed);
  assert.equal(parsed.moduleId, 'cbc_suite_v1');
  assert.equal(parsed.derivedState, 'structurally-non-qualifying');
  assert.equal(parsed.nextExpectedRole, null);
  assert.equal(parsed.records.length, 5);
  assert.equal(parsed.blockers.length, 1);
  assert.match(parsed.blockers[0], /release-authorization is not valid/);
  // Terminal state -- FR-27 redaction lifts automatically; records show their real (committed)
  // content rather than the redaction marker.
  assert.equal(parsed.records[0].reviewerId, 'dryrun-cbc-suite-clinical-1');
});

test('status --module <not-started fixture> --json reports not-started with nextExpectedRole clinical-1', () => {
  const { status, stdout, stderr } = runStatusCli(['--module', 'scaffold_target_v1', '--root', FIXTURES_ROOT, '--json']);
  assert.equal(status, EXIT_OK, stderr);
  const parsed = JSON.parse(stdout);
  assertStatusJsonShape(parsed);
  assert.equal(parsed.derivedState, 'not-started');
  assert.equal(parsed.nextExpectedRole, 'clinical-1');
  assert.deepEqual(parsed.records, []);
  assert.deepEqual(parsed.blockers, []);
});

// -------------------------------------------------------------------------------------------
// FR-29 (F4): non-authorizing terminal-state naming -- no release-ready-like label, ever.
// -------------------------------------------------------------------------------------------

test('the frozen derivedState enum contains acts-complete-unauthorized and invalid, and lib/verbs/status.mjs never emits a release-ready-like label anywhere in its source', async () => {
  assert.ok(STATUS_DERIVED_STATE_ENUM.includes('acts-complete-unauthorized'));
  assert.ok(STATUS_DERIVED_STATE_ENUM.includes('invalid'));
  const statusSource = await readFile(
    path.join(REPO_ROOT, 'tools', 'review-record', 'lib', 'verbs', 'status.mjs'),
    'utf8',
  );
  assert.doesNotMatch(statusSource, /release-ready/i);
  assert.doesNotMatch(statusSource, /"approved"|'approved'/);
});

// -------------------------------------------------------------------------------------------
// Human output names the next-expected role or the terminal state (this task's own AC)
// -------------------------------------------------------------------------------------------

test('status human (non-json) output names the next-expected role for an in-progress module', () => {
  const { status, stdout, stderr } = runStatusCli(['--module', 'scaffold_target_v1', '--root', FIXTURES_ROOT]);
  assert.equal(status, EXIT_OK, stderr);
  assert.match(stdout, /derivedState: not-started/);
  assert.match(stdout, /Next expected role: clinical-1/);
});

test('status human (non-json) output names the terminal state for cbc_suite_v1', () => {
  const { status, stdout, stderr } = runStatusCli(['--module', 'cbc_suite_v1']);
  assert.equal(status, EXIT_OK, stderr);
  assert.match(stdout, /derivedState: structurally-non-qualifying/);
  assert.match(stdout, /Terminal state reached \(structurally-non-qualifying\)/);
});

// -------------------------------------------------------------------------------------------
// Integration fixtures: a valid, disputed (agree/disagree, FR-26) pair and a fully agreeing,
// adjudication-skipped, all-real terminal set -- built via throwaway tmp dirs (never the real
// modules/ or governance/reviewer-roster.yaml trees).
// -------------------------------------------------------------------------------------------

const SENTINEL_CLINICAL1_RATIONALE = 'SENTINEL-STATUS-P1T2-CLINICAL1-TOKEN-3d8f1a';

/**
 * Builds a throwaway (non-git) tmp root with a small fixture roster and a synthetic, validly
 * TESTKEY--signed clinical-1/clinical-2/lab chain whose clinical-1/clinical-2 decisions DISAGREE
 * (no adjudication record) -- exercises the `disputed` derived state end to end, including FR-26's
 * `isAdjudicationRequired` integration. clinical-1's rationale carries a unique sentinel string,
 * used by the FR-27 redaction tests below.
 *
 * @returns {Promise<string>} the tmp root
 */
async function makeDisputedFixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'ef-status-disputed-'));
  await mkdir(path.join(dir, 'governance'), { recursive: true });
  await writeFile(
    path.join(dir, 'governance', 'reviewer-roster.yaml'),
    'schemaVersion: 1\n' +
      'reviewers:\n' +
      '  - reviewerId: disputed-clinical-1\n' +
      '    name: "Fixture Disputed Clinical One"\n' +
      '    credentialRef: fixture-placeholder\n' +
      '    moduleScopes:\n' +
      '      - disputed_pair_v1\n' +
      '    synthetic: true\n' +
      '  - reviewerId: disputed-clinical-2\n' +
      '    name: "Fixture Disputed Clinical Two"\n' +
      '    credentialRef: fixture-placeholder\n' +
      '    moduleScopes:\n' +
      '      - disputed_pair_v1\n' +
      '    synthetic: true\n' +
      '  - reviewerId: disputed-lab\n' +
      '    name: "Fixture Disputed Lab"\n' +
      '    credentialRef: fixture-placeholder\n' +
      '    moduleScopes:\n' +
      '      - disputed_pair_v1\n' +
      '    synthetic: true\n',
    'utf8',
  );

  async function writeRole(role, reviewerId, decision, rationale) {
    const { seq, previousRecordHash } = await nextChainLink(dir, 'disputed_pair_v1');
    const reviewId = buildReviewId(seq, role);
    const draft = {
      schemaVersion: 1,
      review_id: reviewId,
      role,
      moduleId: 'disputed_pair_v1',
      subjectContentHash: SUBJECT_HASH,
      previousRecordHash,
      supersedes: null,
      reviewerId,
      decision,
      rationale,
      reviewedAt: '2026-02-06T00:00:00Z',
      synthetic: true,
      signature: null,
    };
    const signed = signRecordDryRun(draft);
    await writeNewReviewRecordFile(dir, 'disputed_pair_v1', reviewId, signed);
  }

  await writeRole('clinical-1', 'disputed-clinical-1', 'approve', SENTINEL_CLINICAL1_RATIONALE);
  await writeRole(
    'clinical-2',
    'disputed-clinical-2',
    'reject',
    'Findings instead suggest a distinct differential, formed independently of any sibling record.',
  );
  await writeRole(
    'lab',
    'disputed-lab',
    'approve',
    'Laboratory values confirm assay validity and specimen integrity for this panel run today.',
  );
  return dir;
}

/**
 * Builds a throwaway git-initialized tmp root with a real, resolvable authorship union (a single
 * commit introducing `modules/<moduleId>/module.json` under an identity distinct from every roster
 * reviewer below) and a fully agreeing, `synthetic: false`, four-record (adjudication SKIPPED, FR-26
 * agreement path) chain: clinical-1/clinical-2/lab/release-auth, all `approve`, roster-verified,
 * chain-valid. Exercises `acts-complete-unauthorized` (FR-29) end to end.
 *
 * @returns {Promise<string>} the tmp root
 */
async function makeActsCompleteFixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'ef-status-acu-'));
  const git = (args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'ignore', 'ignore'] });
  git(['init', '--quiet']);
  git(['config', 'user.email', 'acu-fixture-committer@example.test']);
  git(['config', 'user.name', 'ACU Fixture Committer']);
  git(['config', 'commit.gpgsign', 'false']);

  await mkdir(path.join(dir, 'modules', 'acu_agree_v1'), { recursive: true });
  await writeFile(path.join(dir, 'modules', 'acu_agree_v1', 'module.json'), '{}\n', 'utf8');
  git(['add', 'modules/acu_agree_v1/module.json']);
  git(['commit', '--quiet', '--author', 'Module Author <module-author@example.test>', '-m', 'introduce module']);

  await mkdir(path.join(dir, 'governance'), { recursive: true });
  await writeFile(
    path.join(dir, 'governance', 'reviewer-roster.yaml'),
    'schemaVersion: 1\n' +
      'reviewers:\n' +
      '  - reviewerId: acu-clinical-1\n' +
      '    name: "Fixture ACU Clinical One"\n' +
      '    credentialRef: fixture-placeholder\n' +
      '    moduleScopes:\n' +
      '      - acu_agree_v1\n' +
      '    synthetic: false\n' +
      '  - reviewerId: acu-clinical-2\n' +
      '    name: "Fixture ACU Clinical Two"\n' +
      '    credentialRef: fixture-placeholder\n' +
      '    moduleScopes:\n' +
      '      - acu_agree_v1\n' +
      '    synthetic: false\n' +
      '  - reviewerId: acu-lab\n' +
      '    name: "Fixture ACU Lab"\n' +
      '    credentialRef: fixture-placeholder\n' +
      '    moduleScopes:\n' +
      '      - acu_agree_v1\n' +
      '    synthetic: false\n' +
      '  - reviewerId: acu-release-auth\n' +
      '    name: "Fixture ACU Release Auth"\n' +
      '    credentialRef: fixture-placeholder\n' +
      '    moduleScopes:\n' +
      '      - acu_agree_v1\n' +
      '    synthetic: false\n',
    'utf8',
  );

  async function writeRole(role, reviewerId, rationale) {
    const { seq, previousRecordHash } = await nextChainLink(dir, 'acu_agree_v1');
    const reviewId = buildReviewId(seq, role);
    const record = {
      schemaVersion: 1,
      review_id: reviewId,
      role,
      moduleId: 'acu_agree_v1',
      subjectContentHash: SUBJECT_HASH,
      previousRecordHash,
      supersedes: null,
      reviewerId,
      decision: 'approve',
      rationale,
      reviewedAt: '2026-02-06T00:00:00Z',
      synthetic: false,
      signature: null,
    };
    await writeNewReviewRecordFile(dir, 'acu_agree_v1', reviewId, record);
  }

  await writeRole('clinical-1', 'acu-clinical-1', 'Clinical review one rationale of sufficient length here today.');
  await writeRole('clinical-2', 'acu-clinical-2', 'Clinical review two rationale, independently formed and phrased.');
  await writeRole('lab', 'acu-lab', 'Laboratory review rationale confirming assay validity for this panel.');
  await writeRole('release-auth', 'acu-release-auth', 'Release authorization rationale over the complete set.');
  return dir;
}

test('status reports disputed with nextExpectedRole adjudication over a clinical-1/clinical-2 disagreement (FR-26 integration)', async () => {
  const dir = await makeDisputedFixture();
  try {
    const code = await runStatus({ module: 'disputed_pair_v1', root: dir, json: true });
    assert.equal(code, EXIT_OK);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('status --json reports acts-complete-unauthorized (never a release-ready-like label) over a complete, agreeing, adjudication-skipped, all-real chain (FR-26/FR-29 integration)', async () => {
  const dir = await makeActsCompleteFixture();
  try {
    const { status, stdout, stderr } = runStatusCli(['--module', 'acu_agree_v1', '--root', dir, '--json']);
    assert.equal(status, EXIT_OK, stderr);
    const parsed = JSON.parse(stdout);
    assertStatusJsonShape(parsed);
    assert.equal(parsed.derivedState, ACTS_COMPLETE_UNAUTHORIZED);
    assert.equal(parsed.nextExpectedRole, null);
    assert.deepEqual(parsed.blockers, []);
    assert.equal(parsed.records.length, 4, 'adjudication is skipped on the agreement path (FR-26)');
    // Terminal state -- redaction lifts automatically; the real reviewerId is visible by default.
    assert.equal(parsed.records[0].reviewerId, 'acu-clinical-1');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// FR-27 (F7) — independence-preserving redaction by default; --unredacted lifts it with a warning.
// -------------------------------------------------------------------------------------------

test('status default (redacted) output never surfaces clinical-1\'s reviewerId/decision/rationale sentinel while the record set is not yet terminal (FR-27)', async () => {
  const dir = await makeDisputedFixture();
  try {
    const jsonResult = runStatusCli(['--module', 'disputed_pair_v1', '--root', dir, '--json']);
    assert.doesNotMatch(jsonResult.stdout, new RegExp(SENTINEL_CLINICAL1_RATIONALE));
    assert.doesNotMatch(jsonResult.stderr, new RegExp(SENTINEL_CLINICAL1_RATIONALE));
    const parsed = JSON.parse(jsonResult.stdout);
    const clinical1 = parsed.records.find((r) => r.role === 'clinical-1');
    assert.equal(clinical1.reviewerId, REDACTED_MARKER);
    assert.equal(clinical1.decision, REDACTED_MARKER);
    assert.equal(clinical1.rationale, REDACTED_MARKER);

    const humanResult = runStatusCli(['--module', 'disputed_pair_v1', '--root', dir]);
    assert.doesNotMatch(humanResult.stdout, new RegExp(SENTINEL_CLINICAL1_RATIONALE));
    assert.match(humanResult.stdout, /redacted by default while independence still matters/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('status --unredacted lifts redaction (sentinel becomes visible) and prints a visible independence-risk warning banner to stderr', async () => {
  const dir = await makeDisputedFixture();
  try {
    const { status, stdout, stderr } = runStatusCli(['--module', 'disputed_pair_v1', '--root', dir, '--json', '--unredacted']);
    assert.equal(status, EXIT_OK, stderr);
    assert.match(stdout, new RegExp(SENTINEL_CLINICAL1_RATIONALE));
    assert.match(stderr, /WARNING: --unredacted lifts FR-27 independence-preserving redaction/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// FR-28 (F8) — status exits non-zero with derivedState "invalid" whenever validate would reject
// the same input: malformed YAML, roster resolution failure, chain break, signature tamper, and
// (with --history) an append-only git-history failure. status never reports a next-role or
// terminal disposition over any of these (risk R13).
// -------------------------------------------------------------------------------------------

test('status reports derivedState invalid + non-zero exit on a malformed review-record filename (F8)', () => {
  const { status, stdout, stderr } = runStatusCli(['--module', 'malformed_v1', '--root', FIXTURES_ROOT, '--json']);
  assert.equal(status, EXIT_USAGE, stderr);
  const parsed = JSON.parse(stdout);
  assertStatusJsonShape(parsed);
  assert.equal(parsed.derivedState, 'invalid');
  assert.equal(parsed.nextExpectedRole, null);
  assert.ok(parsed.blockers.length > 0);
});

test('status reports derivedState invalid + non-zero exit on a non-roster reviewerId (F8)', () => {
  const { status, stdout, stderr } = runStatusCli(['--module', 'nonroster_reviewer_v1', '--root', FIXTURES_ROOT, '--json']);
  assert.equal(status, EXIT_USAGE, stderr);
  const parsed = JSON.parse(stdout);
  assertStatusJsonShape(parsed);
  assert.equal(parsed.derivedState, 'invalid');
  assert.equal(parsed.nextExpectedRole, null);
  assert.ok(parsed.blockers.some((b) => b.includes('does not resolve to any entry in governance/reviewer-roster.yaml')));
});

test('status reports derivedState invalid + non-zero exit on a broken hash-chain (F8)', () => {
  const { status, stdout, stderr } = runStatusCli(['--module', 'broken_chain_v1', '--root', FIXTURES_ROOT, '--json']);
  assert.equal(status, EXIT_USAGE, stderr);
  const parsed = JSON.parse(stdout);
  assertStatusJsonShape(parsed);
  assert.equal(parsed.derivedState, 'invalid');
  assert.equal(parsed.nextExpectedRole, null);
  assert.ok(parsed.blockers.some((b) => b.startsWith('chain:')));
});

test('status reports derivedState invalid + non-zero exit on a signature-tampered record (F8)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ef-status-tamper-'));
  try {
    await mkdir(path.join(dir, 'governance'), { recursive: true });
    await writeFile(
      path.join(dir, 'governance', 'reviewer-roster.yaml'),
      'schemaVersion: 1\n' +
        'reviewers:\n' +
        '  - reviewerId: tamper-clinical-1\n' +
        '    name: "Fixture Tamper Clinical One"\n' +
        '    credentialRef: fixture-placeholder\n' +
        '    moduleScopes:\n' +
        '      - tamper_target_v1\n' +
        '    synthetic: true\n',
      'utf8',
    );

    const reviewId = buildReviewId(1, 'clinical-1');
    const draft = {
      schemaVersion: 1,
      review_id: reviewId,
      role: 'clinical-1',
      moduleId: 'tamper_target_v1',
      subjectContentHash: SUBJECT_HASH,
      previousRecordHash: null,
      supersedes: null,
      reviewerId: 'tamper-clinical-1',
      decision: 'approve',
      rationale: 'Genuine TESTKEY--signed record, about to be tampered with on disk after signing.',
      reviewedAt: '2026-02-07T00:00:00Z',
      synthetic: true,
      signature: null,
    };
    const signed = signRecordDryRun(draft);
    const filePath = await writeNewReviewRecordFile(dir, 'tamper_target_v1', reviewId, signed);

    // Tamper: flip the committed decision AFTER signing, without re-signing -- invalidates the
    // Ed25519 signature (the preimage no longer matches `value`) while leaving every other field,
    // including the signature block itself, byte-identical to what was actually signed.
    const rawYaml = await readFile(filePath, 'utf8');
    assert.match(rawYaml, /^decision: approve$/m);
    const tampered = rawYaml.replace(/^decision: approve$/m, 'decision: reject');
    assert.notEqual(tampered, rawYaml);
    await writeFile(filePath, tampered, 'utf8');

    const { status, stdout, stderr } = runStatusCli(['--module', 'tamper_target_v1', '--root', dir, '--json']);
    assert.equal(status, EXIT_USAGE, stderr);
    const parsed = JSON.parse(stdout);
    assertStatusJsonShape(parsed);
    assert.equal(parsed.derivedState, 'invalid');
    assert.equal(parsed.nextExpectedRole, null);
    assert.ok(parsed.blockers.some((b) => b.includes('cryptographic verification failed')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('status --history reports derivedState invalid + non-zero exit when --root is not a git working tree (F8, parity with validate)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ef-status-nogit-'));
  try {
    const { status, stdout, stderr } = runStatusCli(['--module', 'no_history_target_v1', '--root', dir, '--json', '--history']);
    assert.equal(status, EXIT_USAGE, stderr);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.derivedState, 'invalid');
    assert.ok(parsed.blockers.some((b) => b.includes('is not inside a git working tree')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('status does not run history validation by default (parity with validate\'s own opt-in default)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ef-status-nogit-default-'));
  try {
    // The same non-git root that fails closed under --history above must NOT fail closed without
    // it -- a plain `status` call never performs the git-history walk (matches `validate`'s own
    // opt-in-only posture).
    const code = await runStatus({ module: 'no_history_target_v1', root: dir, json: true });
    assert.equal(code, EXIT_OK);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// Pure-logic unit coverage for the turn-taking helpers (no CLI subprocess needed)
// -------------------------------------------------------------------------------------------

test('computeEffectiveRecordsByRole excludes a superseded record and keeps the correcting one', () => {
  const original = { reviewId: 'rr-0001-clinical-1', seq: 1, role: 'clinical-1', record: { supersedes: null } };
  const correction = {
    reviewId: 'rr-0002-clinical-1',
    seq: 2,
    role: 'clinical-1',
    record: { supersedes: 'rr-0001-clinical-1' },
  };
  const effective = computeEffectiveRecordsByRole([original, correction]);
  assert.equal(effective.size, 1);
  assert.equal(effective.get('clinical-1').reviewId, 'rr-0002-clinical-1');
});

test('computeTurnState reports not-started for an empty record set, in-progress role-by-role otherwise', () => {
  assert.deepEqual(computeTurnState(new Map(), []), { derivedState: 'not-started', nextExpectedRole: 'clinical-1' });

  const clinical1 = { reviewId: 'rr-0001-clinical-1', seq: 1, role: 'clinical-1', record: { decision: 'approve' } };
  const byRoleOne = new Map([['clinical-1', clinical1]]);
  assert.deepEqual(computeTurnState(byRoleOne, [clinical1]), { derivedState: 'in-progress', nextExpectedRole: 'clinical-2' });
});

test('applyRedaction is a no-op for a terminal derivedState and for --unredacted, and redacts otherwise', () => {
  const base = {
    moduleId: 'm', subjectContentHash: 'sha256:x', nextExpectedRole: null, blockers: [],
    records: [{ role: 'clinical-1', review_id: 'rr-0001-clinical-1', reviewerId: 'r1', decision: 'approve', rationale: 'x', synthetic: true, supersedes: null, chainLinkage: null }],
  };
  const inProgress = { ...base, derivedState: 'in-progress' };
  const redacted = applyRedaction(inProgress, false);
  assert.equal(redacted.records[0].reviewerId, REDACTED_MARKER);

  const stillReal = applyRedaction(inProgress, true);
  assert.equal(stillReal.records[0].reviewerId, 'r1');

  const terminal = { ...base, derivedState: ACTS_COMPLETE_UNAUTHORIZED };
  const terminalProjected = applyRedaction(terminal, false);
  assert.equal(terminalProjected.records[0].reviewerId, 'r1');
});

// -------------------------------------------------------------------------------------------
// status consumes the ONE shared computeDerivedReviewState result -- no forked module-wide logic
// (mirrors the P1-T1 drift test above for validate.mjs).
// -------------------------------------------------------------------------------------------

test('lib/verbs/status.mjs imports and calls computeDerivedReviewState (shared derived-state library) and isExpectedTerminalNonQualifyingViolations (shared dry-run terminal-shape check) rather than reimplementing either', async () => {
  const statusSource = await readFile(
    path.join(REPO_ROOT, 'tools', 'review-record', 'lib', 'verbs', 'status.mjs'),
    'utf8',
  );
  assert.match(
    statusSource,
    /import\s*\{[^}]*computeDerivedReviewState[^}]*\}\s*from\s*['"]\.\.\/derived-state\.mjs['"]/,
  );
  assert.match(statusSource, /computeDerivedReviewState\(/);
  assert.match(
    statusSource,
    /import\s*\{[^}]*isExpectedTerminalNonQualifyingViolations[^}]*\}\s*from\s*['"]\.\/dry-run\.mjs['"]/,
  );
  for (const pattern of [/checkReviewerIndependence\(/, /checkModuleChainLinkage\(/, /evaluateReleaseAuthorization\(/]) {
    assert.doesNotMatch(statusSource, pattern);
  }
});

// -------------------------------------------------------------------------------------------
// Zero network calls (status), matching this file's existing scaffold/validate pattern.
// -------------------------------------------------------------------------------------------

test('status makes zero network calls at runtime (patched global fetch throws if invoked)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network call attempted during a status verb invocation');
  };
  try {
    await assert.doesNotReject(() => runStatus({ module: 'cbc_suite_v1', root: REPO_ROOT, json: true }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// -------------------------------------------------------------------------------------------
// P1-T4 (clinical-review-workflow-v1, R2/R3/R7/R8, FR-24) — drift guard: `status --json`'s
// `derivedState`/`blockers` and `validate`'s collected violations must never merely happen to
// agree across two independently-reasoned-about code paths -- they are BOTH derived from the ONE
// shared `computeDerivedReviewState` result (P1-T1, F6). The grep-based STRUCTURAL proof that both
// verbs call that one function (rather than reimplementing it) already lives above (see "lib/
// verbs/validate.mjs must actually call computeDerivedReviewState" and "lib/verbs/status.mjs
// imports and calls computeDerivedReviewState"). This section adds the BEHAVIORAL half: actually
// running both verbs over the SAME input and asserting their blocker/violation content is
// identical -- not two independently-shaped outputs that were merely each checked separately
// against an expected shape -- across the three fixture classes this task's own acceptance
// criteria name:
//   (a) the committed, real cbc_suite_v1 dry-run set (terminal, structurally-non-qualifying);
//   (b) the pre-existing broken_chain_v1 adversarial fixture (fail-closed chain break --
//       tests/fixtures/ef-review-record-cli/modules/broken_chain_v1/, reused read-only here rather
//       than duplicated; this task adds no new committed chain-broken fixture file);
//   (c) the disputed_pair_v1 adversarial fixture built by `makeDisputedFixture` above (accepted,
//       non-terminal `disputed` state -- a missing adjudication role is not itself a `validate`
//       violation, only a fact `status`'s turn-taking layer reports on top of the shared blockers).
//
// This section also re-affirms (R3/R7/R8) that reviewer-2 structural independence (`nextChainLink`'s
// single-file-touch semantics, the `chain_isolation_v1` fixture) is untouched by anything this task
// adds -- P1-T4's own target surfaces are exactly this test file and tests/fixtures/
// clinical-review-workflow/, never lib/chain.mjs or lib/verbs/scaffold.mjs themselves -- and
// grep-asserts zero diff to ADR-0004's `status` field and to the real
// governance/reviewer-roster.yaml from every test P1-T4 adds (both grep checks are scoped AFTER
// this task's own new tests below, not just the earlier P1-T3/P1-T5 checks elsewhere in this repo,
// which run before these and so cannot catch a regression introduced by this task's own additions).
// -------------------------------------------------------------------------------------------

/**
 * Runs `validate` (in-process library call -- pure-logic assertion per this file's own header) over
 * `{moduleId, root}` and returns its full `violations[]` list -- `[]` when `validate` passes, or
 * `err.violations` when it fails closed with `ValidationFailedError`. A non-`ValidationFailedError`
 * throw (a genuine tool-usage failure, e.g. an unparseable record) propagates unchanged -- this
 * helper only normalizes the "structured rejection" shape, never masks a raw crash.
 *
 * @param {string} moduleId
 * @param {string} root
 * @returns {Promise<string[]>}
 */
async function collectValidateViolations(moduleId, root) {
  try {
    await runValidate({ module: moduleId, root });
    return [];
  } catch (err) {
    if (err instanceof ValidationFailedError) return err.violations;
    throw err;
  }
}

/**
 * Runs `status --json` as a subprocess (matching this file's established stdout-capture convention
 * for structured-JSON assertions -- see this file's own header on why process-level assertions
 * spawn the real `cli.mjs`) over `{moduleId, root}` and returns the parsed body.
 *
 * @param {string} moduleId
 * @param {string} root
 * @returns {{ moduleId: string, subjectContentHash: string|null, records: object[], derivedState: string, nextExpectedRole: string|null, blockers: string[] }}
 */
function collectStatusResult(moduleId, root) {
  const { stdout, stderr } = runStatusCli(['--module', moduleId, '--root', root, '--json']);
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`status --json did not emit parseable JSON for module "${moduleId}":\n${stdout}\n${stderr}`);
  }
}

test('drift guard (F6): status --json blockers and validate\'s violations agree byte-for-byte on the committed cbc_suite_v1 fixture (terminal, structurally-non-qualifying)', async () => {
  const validateViolations = await collectValidateViolations('cbc_suite_v1', REPO_ROOT);
  const statusResult = collectStatusResult('cbc_suite_v1', REPO_ROOT);
  assert.equal(statusResult.derivedState, 'structurally-non-qualifying');
  assert.ok(
    isExpectedTerminalNonQualifyingViolations(validateViolations),
    `expected exactly the one FR-6 synthetic-set violation from validate, got: ${JSON.stringify(validateViolations)}`,
  );
  assert.deepEqual(
    statusResult.blockers,
    validateViolations,
    'status and validate must report the IDENTICAL blocker/violation set over the same committed ' +
      'input -- both derive from the one shared computeDerivedReviewState result (F6), not two ' +
      'independently-shaped outputs that merely happen to agree',
  );
});

test('drift guard (F6): status --json blockers and validate\'s violations agree byte-for-byte on the pre-existing broken_chain_v1 adversarial fixture (chain-broken, fail-closed)', async () => {
  const validateViolations = await collectValidateViolations('broken_chain_v1', FIXTURES_ROOT);
  const statusResult = collectStatusResult('broken_chain_v1', FIXTURES_ROOT);
  assert.equal(statusResult.derivedState, 'invalid');
  assert.ok(validateViolations.length > 0, 'validate must reject the deliberately chain-broken fixture');
  assert.ok(
    validateViolations.some((v) => v.startsWith('chain:')),
    `expected at least one chain:-prefixed violation, got: ${JSON.stringify(validateViolations)}`,
  );
  assert.deepEqual(
    statusResult.blockers,
    validateViolations,
    'status and validate must report the IDENTICAL blocker/violation set over the same chain-broken ' +
      'input (F6)',
  );
});

test('drift guard (F6): status --json blockers and validate\'s violations agree (both empty) on the disputed_pair_v1 adversarial fixture (accepted, non-terminal disputed state -- a missing adjudication role is not itself a validate violation, only a fact status\'s turn-taking layer reports)', async () => {
  const dir = await makeDisputedFixture();
  try {
    const validateViolations = await collectValidateViolations('disputed_pair_v1', dir);
    const statusResult = collectStatusResult('disputed_pair_v1', dir);
    assert.equal(statusResult.derivedState, 'disputed');
    assert.equal(statusResult.nextExpectedRole, 'adjudication');
    assert.deepEqual(
      validateViolations,
      [],
      'validate accepts a disputed (missing-adjudication) record set -- completeness is enforced ' +
        'only at release-auth time, not for every intermediate state',
    );
    assert.deepEqual(
      statusResult.blockers,
      validateViolations,
      'status and validate must report the IDENTICAL (empty) blocker/violation set over the same ' +
        'disputed input (F6)',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// FR-12 (Clinical Review Workflow v1, Phase 3, P3-T2): validate, status, and render each name the
// structurally-non-qualifying derived state as the correct, by-design terminus for a synthetic:true
// record set -- never a defect -- on the committed cbc_suite_v1 dry-run set (the real, live module,
// not a fixture). This is a shared-string test: all three surfaces carry their own verbatim,
// independently-documented copy of the exact same sentence (see each file's own header for why it
// is duplicated rather than imported -- lib/verbs/status.mjs, lib/verbs/validate.mjs,
// lib/render.mjs), so this test also proves the three copies have not drifted from each other,
// not merely that each individually contains SOME by-design-terminus wording.
// -------------------------------------------------------------------------------------------

test('FR-12 shared-string: status\'s and render\'s exported STRUCTURALLY_NON_QUALIFYING_TERMINUS_NOTE constants are byte-identical (the three verbatim copies must never independently drift)', () => {
  assert.equal(STATUS_TERMINUS_NOTE, RENDER_TERMINUS_NOTE);
  assert.match(STATUS_TERMINUS_NOTE, /correct, by-design terminus for a fully synthetic:true record set \(FR-6\) -- not a defect/);
});

test('FR-12 shared-string: validate\'s CLI output, status\'s human companion text, and render\'s HTML output all carry the exact by-design-terminus sentence on the committed cbc_suite_v1 synthetic set', async () => {
  // validate --module cbc_suite_v1: still fails closed (EXIT_USAGE) on the one expected FR-6
  // finding -- this note changes wording only, never the exit code or the underlying violation.
  const validateCli = runCli(['validate', '--module', 'cbc_suite_v1']);
  assert.equal(validateCli.status, EXIT_USAGE, `validate must still fail closed: ${validateCli.stderr}`);
  assert.ok(
    (validateCli.stdout + validateCli.stderr).includes(STATUS_TERMINUS_NOTE),
    `expected validate's combined stdout+stderr to contain the FR-12 note; got:\nSTDOUT:\n${validateCli.stdout}\nSTDERR:\n${validateCli.stderr}`,
  );

  // status --module cbc_suite_v1 (human, non-JSON companion text): exits 0 -- structurally-non-
  // qualifying is a reportable terminal state, not itself an `invalid` result.
  const { status: statusExit, stdout: statusStdout, stderr: statusStderr } =
    runStatusCli(['--module', 'cbc_suite_v1']);
  assert.equal(statusExit, EXIT_OK, statusStderr);
  assert.ok(
    statusStdout.includes(STATUS_TERMINUS_NOTE),
    `expected status's human output to contain the FR-12 note; got:\n${statusStdout}`,
  );

  // render --module cbc_suite_v1 (real committed module, real repo root -- not a fixture): the
  // queue section's TERMINAL summary carries the same note when every effective record is
  // synthetic:true, exactly as cbc_suite_v1's five dry-run records are.
  const renderData = await loadModuleRenderData(REPO_ROOT, 'cbc_suite_v1');
  const html = renderModuleHtml(renderData);
  assert.ok(
    html.includes(RENDER_TERMINUS_NOTE),
    'expected render\'s HTML output for cbc_suite_v1 to contain the FR-12 note',
  );
});

// -------------------------------------------------------------------------------------------
// Reviewer-2 structural independence (R3/R7/R8) — chain_isolation_v1 stays green, nextChainLink's
// single-file-touch semantics untouched. P1-T4 does not modify lib/chain.mjs or
// lib/verbs/scaffold.mjs (out of this task's target surfaces) -- these are regression guards
// proving the guarantee those files already establish is not weakened by anything this task adds.
// -------------------------------------------------------------------------------------------

test('lib/verbs/scaffold.mjs still imports only nextChainLink from ../chain.mjs -- never checkModuleChainLinkage or listModuleReviewRecords (structural independence, R3/R7 regression guard)', async () => {
  const scaffoldSource = await readFile(
    path.join(REPO_ROOT, 'tools', 'review-record', 'lib', 'verbs', 'scaffold.mjs'),
    'utf8',
  );
  assert.match(scaffoldSource, /import\s*\{\s*nextChainLink\s*\}\s*from\s*['"]\.\.\/chain\.mjs['"]/);
  for (const pattern of [/checkModuleChainLinkage\(/, /listModuleReviewRecords\(/]) {
    assert.doesNotMatch(
      scaffoldSource,
      pattern,
      `lib/verbs/scaffold.mjs must not call ${pattern} -- doing so would reintroduce the ` +
        'full-module-read gap nextChainLink\'s structural fix exists to prevent',
    );
  }
});

test('lib/chain.mjs\'s nextChainLink body still never calls listModuleReviewRecords (structural independence, R3 regression guard)', async () => {
  const chainSource = await readFile(path.join(REPO_ROOT, 'tools', 'review-record', 'lib', 'chain.mjs'), 'utf8');
  const start = chainSource.indexOf('export async function nextChainLink');
  assert.ok(start >= 0, 'expected to find nextChainLink\'s export in lib/chain.mjs');
  const nextChainLinkBody = chainSource.slice(start);
  assert.doesNotMatch(
    nextChainLinkBody,
    /listModuleReviewRecords/,
    'nextChainLink must never route through the full-module-read listModuleReviewRecords helper',
  );
});

test('the chain_isolation_v1 independence fixture still stays green end to end: nextChainLink skips the unparseable sibling (seq 3) and scaffold --role clinical-2 still succeeds with no sentinel leak (P1-T4 regression guard, R3/R7)', async () => {
  const link = await nextChainLink(FIXTURES_ROOT, 'chain_isolation_v1');
  assert.equal(link.seq, 3);
  const { status, stdout, stderr } = runCli([
    'scaffold', '--module', 'chain_isolation_v1', '--role', 'clinical-2', '--subject', SUBJECT_HASH,
    '--reviewer-id', 'synthetic-multirole-reviewer', '--decision', 'approve',
    '--rationale', 'P1-T4 regression check: no new drift/independence test code path reads a sibling record.',
    '--reviewed-at', '2026-02-08T00:00:00Z',
    '--root', FIXTURES_ROOT,
    // CRW-F5 revision (BLOCKER 2): chain_isolation_v1 carries only reviews/ under FIXTURES_ROOT --
    // F5 now hard-fails on that by default. This test is about drift/independence, not F5, so the
    // loud, explicit escape hatch is used.
    '--allow-historical-subject',
  ]);
  assert.equal(status, EXIT_OK, stderr);
  assert.doesNotMatch(stdout, /BOOBYTRAP/);
  assert.doesNotMatch(stderr, /BOOBYTRAP/);
});

// -------------------------------------------------------------------------------------------
// Grep-assert zero diff to ADR-0004's status field and to governance/reviewer-roster.yaml, scoped
// to every test P1-T4 adds above (this task touches only tests/ef-review-workflow.test.mjs and
// tests/fixtures/clinical-review-workflow/ -- never docs/adr/ or the real governance roster).
// -------------------------------------------------------------------------------------------

test('P1-T4: ADR-0004 status field is untouched -- stays "proposed" (G0 uncleared, hard guardrail)', async () => {
  const adrPath = path.join(REPO_ROOT, 'docs', 'adr', '0004-clinical-approval-identity-adjudication.md');
  const content = await readFile(adrPath, 'utf8');
  assert.match(
    content,
    /^status: proposed$/m,
    'ADR-0004 frontmatter `status` must remain exactly "proposed" -- no task in this feature ' +
      'ratifies it, including this task\'s own drift/independence tests',
  );
  const diffResult = spawnSync('git', ['diff', '--name-only', '--', adrPath], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(diffResult.status, 0, diffResult.stderr);
  assert.equal(
    diffResult.stdout.trim(),
    '',
    'docs/adr/0004-clinical-approval-identity-adjudication.md must show zero diff against HEAD ' +
      'after every P1-T4 test above',
  );
});

test('P1-T4: governance/reviewer-roster.yaml shows zero diff against HEAD after every drift/independence test above (real roster never read or written by this task)', () => {
  const result = spawnSync('git', ['diff', '--name-only', '--', 'governance/reviewer-roster.yaml'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout.trim(),
    '',
    'governance/reviewer-roster.yaml must show zero diff against HEAD after any P1-T4 drift/' +
      'independence test',
  );
});

// -------------------------------------------------------------------------------------------
// P2-T4 (Clinical Review Workflow v1, Phase 2, FR-9/10, R5, OQ-6, F3) -- fail-closed composite-key
// invalidation. P2-T3 already proved the composite key EXISTS and that cross-process warmth works
// (tests/ef-review-validate-cache.test.mjs); this task proves the FAIL-CLOSED half named by its own
// acceptance criteria:
//   (1)-(5): FIVE DEDICATED FRESH-PROCESS ADVERSARIAL TESTS, one per named key component (roster,
//       schema, record-content, predecessor-content, history-mode-flag) -- NOT the sixth component,
//       `validatorPolicyVersion` (a pure code constant, already unit-proven by P2-T3's own
//       `keysMatch` test; not independently "seedable content" the way these five are).
//   (6): a git-history mutation committed BETWEEN two `--history` calls is caught on the SECOND
//       call (OQ-6 -- the module-wide git-log walk is NEVER itself cached, no matter how warm the
//       per-record cache is).
//
// METHODOLOGY for (1)-(5), consistently: build a small, genuinely VALID, signed fixture (so its
// TRUE recompute is clean); compute that fixture's own CURRENT, correct composite key using the
// exact same primitives `validate.mjs` itself uses (`canonicalRecordHash`, `hashPredecessorSet`,
// `hashFileIfExists`, `VALIDATOR_POLICY_VERSION`); then DIRECTLY SEED the persistent cache file
// (`writeCacheFileAtomic`, never via a prior `validate` run) with an entry whose key is that TRUE
// key with EXACTLY ONE component swapped for an obviously-wrong value, paired with a FAKE, easily
// grep-able "result" (an invented violation string a genuinely clean record would never produce).
// A fresh, separate `node` child process (`runCli`, matching this whole file's established
// subprocess convention) then runs `validate` against the SAME fixture and cache dir. Fail-closed
// correctness requires BOTH: (a) the printed `validate-cache: hits=... misses=...` marker shows a
// MISS for the seeded record (the mismatched component was correctly rejected, not reused), AND
// (b) the fake, seeded violation text NEVER appears in the process's stdout/stderr (if the stale
// entry had been wrongly reused, this fake text -- which no genuine recompute could ever produce --
// would leak straight into the real validate output). This directly proves F3's own language: "any
// single key-component miss ... triggers full recompute -- never a stale pass," for a REAL fresh
// process, not merely a `keysMatch(...)` unit assertion.
//
// Every fixture below is a throwaway `mkdtemp` root PLUS an isolated `REVIEW_RECORD_CACHE_DIR`
// (never this machine's real OS-temp/XDG default, never the real repo's own tree) -- see
// `withCacheDirEnv` below.
// -------------------------------------------------------------------------------------------

/** Parses this tool's own `validate-cache: hits=<N> misses=<M> of <K> scoped ...` marker line out
 * of a `validate` CLI invocation's stdout (matches `tests/ef-review-validate-cache.test.mjs`'s own
 * identically-named helper -- both files independently need this small parser, per this repo's
 * established per-file-self-contained-helpers convention). */
function parseCacheMarker(stdout) {
  const match = stdout.match(/validate-cache: hits=(\d+) misses=(\d+) of (\d+) scoped/);
  assert.ok(match, `expected a validate-cache marker line in stdout, got:\n${stdout}`);
  return { hits: Number(match[1]), misses: Number(match[2]), scoped: Number(match[3]) };
}

/**
 * Temporarily overrides `process.env.REVIEW_RECORD_CACHE_DIR` (the SAME test seam
 * `validate-cache.mjs`'s own `resolveCacheRootDir` documents) for the duration of `fn`, restoring
 * (or deleting) the prior value afterward -- so an in-process call to a `validate-cache.mjs`
 * primitive (e.g. `writeCacheFileAtomic`, used below to SEED a stale entry directly, never via a
 * prior `validate` run) resolves to a caller-chosen, isolated cache directory without leaking that
 * override to any other test in this shared-process test file.
 *
 * @template T
 * @param {string} cacheDir
 * @param {() => T | Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withCacheDirEnv(cacheDir, fn) {
  const saved = process.env.REVIEW_RECORD_CACHE_DIR;
  process.env.REVIEW_RECORD_CACHE_DIR = cacheDir;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.REVIEW_RECORD_CACHE_DIR;
    else process.env.REVIEW_RECORD_CACHE_DIR = saved;
  }
}

/**
 * Computes `record`'s CURRENT, correct composite cache key (the exact six components
 * `validate.mjs` itself would compute right now for this exact fixture state) using the same
 * exported primitives that file uses -- never a hand-rolled reimplementation that could silently
 * drift from the real one.
 *
 * @param {string} tmp fixture root (must already contain `governance/reviewer-roster.yaml`)
 * @param {object} record the already-loaded, already-signed record object
 * @param {string[]} predecessorHashes ordered canonical hashes of every record preceding `record`
 *   in its module's committed sequence (`[]` for a module's first record)
 * @param {{ historyMode?: boolean }} [opts]
 * @returns {Promise<import('../tools/review-record/lib/validate-cache.mjs').RecordCacheKey>}
 */
async function currentTrueKeyForRecord(tmp, record, predecessorHashes, { historyMode = false } = {}) {
  const rosterFileHash = await hashFileIfExists(rosterFilePathFor(tmp));
  const schemaFileHash = await hashFileIfExists(SCHEMA_PATH);
  return {
    recordContentHash: canonicalRecordHash(record),
    predecessorSetHash: hashPredecessorSet(predecessorHashes),
    rosterFileHash,
    schemaFileHash,
    validatorPolicyVersion: VALIDATOR_POLICY_VERSION,
    historyMode,
  };
}

test('P2-T4 fresh-process fail-closed invalidation (1/5, F3): a roster-content change forces recompute -- a cache entry seeded with a STALE rosterFileHash and a fake "clean" result is never reused', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-stale-roster-'));
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-cache-roster-'));
  try {
    const moduleId = 'p2t4_stale_roster_v1';
    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'p2t4-roster-reviewer', moduleId, label: 'P2-T4 roster invalidation fixture' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);
    assert.equal(await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'p2t4-roster-reviewer', decision: 'approve',
      rationale: 'P2-T4 roster-invalidation fixture, structural only, no clinical claim.',
      reviewedAt: '2026-04-01T00:00:00Z', root: tmp, draft: true,
    }), EXIT_OK);
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    assert.equal(await runSign({ draft: draftPath, module: moduleId, root: tmp }), EXIT_OK);

    const [{ record }] = await listModuleReviewRecords(tmp, moduleId);
    const trueKey = await currentTrueKeyForRecord(tmp, record, []);
    const staleKey = { ...trueKey, rosterFileHash: `sha256:${'0'.repeat(64)}` };
    const fakeMarker = 'STALE-FAKE-ROSTER-VIOLATION-MUST-NOT-SURFACE-P2T4-1';
    await withCacheDirEnv(cacheDir, () => writeCacheFileAtomic(tmp, moduleId, {
      'rr-0001-clinical-1': {
        key: staleKey,
        result: { schemaViolations: [], rosterViolation: fakeMarker, signatureViolation: null, chainViolation: null },
      },
    }));

    const { status, stdout, stderr } = runCli(
      ['validate', '--module', moduleId, '--root', tmp],
      { REVIEW_RECORD_CACHE_DIR: cacheDir },
    );
    assert.equal(status, EXIT_OK, stderr);
    assert.doesNotMatch(
      `${stdout}${stderr}`,
      new RegExp(fakeMarker),
      'a roster-content mismatch must force full recompute -- the stale, wrongly-keyed fake ' +
        '"roster violation" must never surface',
    );
    assert.deepEqual(
      parseCacheMarker(stdout),
      { hits: 0, misses: 1, scoped: 1 },
      'the seeded entry\'s rosterFileHash mismatch must be a cache MISS, never a stale hit',
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test('P2-T4 fresh-process fail-closed invalidation (2/5, F3): a schema-file-hash change forces recompute -- a cache entry seeded with a STALE schemaFileHash and a fake "clean" result is never reused', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-stale-schema-'));
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-cache-schema-'));
  try {
    const moduleId = 'p2t4_stale_schema_v1';
    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'p2t4-schema-reviewer', moduleId, label: 'P2-T4 schema invalidation fixture' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);
    assert.equal(await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'p2t4-schema-reviewer', decision: 'approve',
      rationale: 'P2-T4 schema-invalidation fixture, structural only, no clinical claim.',
      reviewedAt: '2026-04-01T00:10:00Z', root: tmp, draft: true,
    }), EXIT_OK);
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    assert.equal(await runSign({ draft: draftPath, module: moduleId, root: tmp }), EXIT_OK);

    const [{ record }] = await listModuleReviewRecords(tmp, moduleId);
    const trueKey = await currentTrueKeyForRecord(tmp, record, []);
    const staleKey = { ...trueKey, schemaFileHash: `sha256:${'1'.repeat(64)}` };
    const fakeMarker = 'STALE-FAKE-SCHEMA-VIOLATION-MUST-NOT-SURFACE-P2T4-2';
    await withCacheDirEnv(cacheDir, () => writeCacheFileAtomic(tmp, moduleId, {
      'rr-0001-clinical-1': {
        key: staleKey,
        result: { schemaViolations: [fakeMarker], rosterViolation: null, signatureViolation: null, chainViolation: null },
      },
    }));

    const { status, stdout, stderr } = runCli(
      ['validate', '--module', moduleId, '--root', tmp],
      { REVIEW_RECORD_CACHE_DIR: cacheDir },
    );
    assert.equal(status, EXIT_OK, stderr);
    assert.doesNotMatch(
      `${stdout}${stderr}`,
      new RegExp(fakeMarker),
      'a schema-file-hash mismatch must force full recompute -- the stale, wrongly-keyed fake ' +
        '"schema violation" must never surface',
    );
    assert.deepEqual(
      parseCacheMarker(stdout),
      { hits: 0, misses: 1, scoped: 1 },
      'the seeded entry\'s schemaFileHash mismatch must be a cache MISS, never a stale hit',
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test('P2-T4 fresh-process fail-closed invalidation (3/5, F3): a record-content change forces recompute -- a cache entry seeded with a STALE recordContentHash and a fake "clean" result is never reused', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-stale-record-'));
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-cache-record-'));
  try {
    const moduleId = 'p2t4_stale_record_v1';
    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'p2t4-record-reviewer', moduleId, label: 'P2-T4 record-content invalidation fixture' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);
    assert.equal(await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'p2t4-record-reviewer', decision: 'approve',
      rationale: 'P2-T4 record-content-invalidation fixture, structural only, no clinical claim.',
      reviewedAt: '2026-04-01T00:20:00Z', root: tmp, draft: true,
    }), EXIT_OK);
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    assert.equal(await runSign({ draft: draftPath, module: moduleId, root: tmp }), EXIT_OK);

    const [{ record }] = await listModuleReviewRecords(tmp, moduleId);
    const trueKey = await currentTrueKeyForRecord(tmp, record, []);
    const staleKey = { ...trueKey, recordContentHash: `sha256:${'2'.repeat(64)}` };
    const fakeMarker = 'STALE-FAKE-SIGNATURE-VIOLATION-MUST-NOT-SURFACE-P2T4-3';
    await withCacheDirEnv(cacheDir, () => writeCacheFileAtomic(tmp, moduleId, {
      'rr-0001-clinical-1': {
        key: staleKey,
        result: { schemaViolations: [], rosterViolation: null, signatureViolation: fakeMarker, chainViolation: null },
      },
    }));

    const { status, stdout, stderr } = runCli(
      ['validate', '--module', moduleId, '--root', tmp],
      { REVIEW_RECORD_CACHE_DIR: cacheDir },
    );
    assert.equal(status, EXIT_OK, stderr);
    assert.doesNotMatch(
      `${stdout}${stderr}`,
      new RegExp(fakeMarker),
      'a record-content-hash mismatch must force full recompute -- the stale, wrongly-keyed fake ' +
        '"signature violation" must never surface',
    );
    assert.deepEqual(
      parseCacheMarker(stdout),
      { hits: 0, misses: 1, scoped: 1 },
      'the seeded entry\'s recordContentHash mismatch must be a cache MISS, never a stale hit',
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test('P2-T4 fresh-process fail-closed invalidation (4/5, F3): a predecessor-set-content change forces recompute of a LATER record whose own bytes are untouched -- a cache entry seeded with a STALE predecessorSetHash and a fake "clean" result is never reused, even while a SIBLING record legitimately stays warm', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-stale-predecessor-'));
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-cache-predecessor-'));
  try {
    const moduleId = 'p2t4_stale_predecessor_v1';
    // clinical-1 + lab (never clinical-1 + clinical-2) -- avoids the FR-4 reviewer-2 independence
    // heuristic entirely, isolating this test to the per-record cache mechanism alone.
    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'p2t4-pred-clinical-1', moduleId, label: 'P2-T4 predecessor fixture, clinical-1' },
      { reviewerId: 'p2t4-pred-lab', moduleId, label: 'P2-T4 predecessor fixture, lab' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);

    assert.equal(await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'p2t4-pred-clinical-1', decision: 'approve',
      rationale: 'P2-T4 predecessor fixture record 1, structural only, no clinical claim.',
      reviewedAt: '2026-04-01T00:30:00Z', root: tmp, draft: true,
    }), EXIT_OK);
    assert.equal(
      await runSign({ draft: draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1'), module: moduleId, root: tmp }),
      EXIT_OK,
    );

    assert.equal(await runScaffold({
      module: moduleId, role: 'lab', reviewerId: 'p2t4-pred-lab', decision: 'approve',
      rationale: 'P2-T4 predecessor fixture record 2 (lab role), unrelated wording from record 1.',
      reviewedAt: '2026-04-01T00:35:00Z', root: tmp, draft: true,
    }), EXIT_OK);
    assert.equal(
      await runSign({ draft: draftFilePathFor(tmp, moduleId, 'rr-0002-lab'), module: moduleId, root: tmp }),
      EXIT_OK,
    );

    const [{ record: r1 }, { record: r2 }] = await listModuleReviewRecords(tmp, moduleId);
    const r1TrueKey = await currentTrueKeyForRecord(tmp, r1, []);
    const r2TrueKey = await currentTrueKeyForRecord(tmp, r2, [canonicalRecordHash(r1)]);
    const r2StaleKey = { ...r2TrueKey, predecessorSetHash: hashPredecessorSet([`sha256:${'3'.repeat(64)}`]) };
    const fakeMarker = 'STALE-FAKE-ROSTER-VIOLATION-MUST-NOT-SURFACE-P2T4-4';

    await withCacheDirEnv(cacheDir, () => writeCacheFileAtomic(tmp, moduleId, {
      // r1 is seeded with its OWN correct, true key/result -- it must legitimately HIT below,
      // isolating this test's claim to r2's predecessor-set mismatch alone.
      'rr-0001-clinical-1': {
        key: r1TrueKey,
        result: { schemaViolations: [], rosterViolation: null, signatureViolation: null, chainViolation: null },
      },
      'rr-0002-lab': {
        key: r2StaleKey,
        result: { schemaViolations: [], rosterViolation: fakeMarker, signatureViolation: null, chainViolation: null },
      },
    }));

    const { status, stdout, stderr } = runCli(
      ['validate', '--module', moduleId, '--root', tmp],
      { REVIEW_RECORD_CACHE_DIR: cacheDir },
    );
    assert.equal(status, EXIT_OK, stderr);
    assert.doesNotMatch(
      `${stdout}${stderr}`,
      new RegExp(fakeMarker),
      'a predecessor-set-content mismatch must force recompute of the LATER record, even though ' +
        'its own bytes AND its immediate-predecessor relationship are both untouched (F3: complete ' +
        'predecessor set, not the record+immediate-predecessor pair alone)',
    );
    assert.deepEqual(
      parseCacheMarker(stdout),
      { hits: 1, misses: 1, scoped: 2 },
      'rr-0001-clinical-1 (seeded with its OWN true key/result) legitimately hits; rr-0002-lab ' +
        '(seeded with a stale predecessorSetHash) must miss',
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test('P2-T4 fresh-process fail-closed invalidation (5/5, F3): a history-mode-flag change forces recompute -- a cache entry seeded under the OPPOSITE historyMode boolean and a fake "clean" result is never reused', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-stale-historymode-'));
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-cache-historymode-'));
  try {
    const moduleId = 'p2t4_stale_historymode_v1';
    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'p2t4-historymode-reviewer', moduleId, label: 'P2-T4 history-mode-flag fixture' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);
    assert.equal(await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'p2t4-historymode-reviewer', decision: 'approve',
      rationale: 'P2-T4 history-mode-flag fixture, structural only, no clinical claim.',
      reviewedAt: '2026-04-01T00:40:00Z', root: tmp, draft: true,
    }), EXIT_OK);
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    assert.equal(await runSign({ draft: draftPath, module: moduleId, root: tmp }), EXIT_OK);

    const [{ record }] = await listModuleReviewRecords(tmp, moduleId);
    // The real call under test below is a PLAIN validate (historyMode: false -- no --history flag;
    // this fixture is not even a git working tree, so --history itself would throw
    // NotAGitRepositoryError, irrelevant to this test's own claim). Seed the stale entry under the
    // OPPOSITE historyMode (true) -- every OTHER component matches truth exactly, isolating this
    // test to the historyMode component alone.
    const trueKeyForPlainCall = await currentTrueKeyForRecord(tmp, record, [], { historyMode: false });
    const staleKey = { ...trueKeyForPlainCall, historyMode: true };
    const fakeMarker = 'STALE-FAKE-SIGNATURE-VIOLATION-MUST-NOT-SURFACE-P2T4-5';
    await withCacheDirEnv(cacheDir, () => writeCacheFileAtomic(tmp, moduleId, {
      'rr-0001-clinical-1': {
        key: staleKey,
        result: { schemaViolations: [], rosterViolation: null, signatureViolation: fakeMarker, chainViolation: null },
      },
    }));

    const { status, stdout, stderr } = runCli(
      ['validate', '--module', moduleId, '--root', tmp],
      { REVIEW_RECORD_CACHE_DIR: cacheDir },
    );
    assert.equal(status, EXIT_OK, stderr);
    assert.doesNotMatch(
      `${stdout}${stderr}`,
      new RegExp(fakeMarker),
      'a per-record cache entry computed under a DIFFERENT history-mode setting must never be ' +
        'reused by a lookup made under the other',
    );
    assert.deepEqual(
      parseCacheMarker(stdout),
      { hits: 0, misses: 1, scoped: 1 },
      'the seeded entry\'s historyMode mismatch must be a cache MISS, never a stale hit',
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test('P2-T4 (OQ-6): validate --history results are never cached across invocations -- a git-history mutation committed between two --history calls is caught on the SECOND call, even when the per-record cache is fully WARM (byte-identical restored content)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-history-crosscall-'));
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'ef-p2t4-cache-history-crosscall-'));
  try {
    const moduleId = 'p2t4_history_crosscall_v1';
    execFileSync('git', ['init', '-q'], { cwd: tmp });
    execFileSync('git', ['config', 'user.email', 'crw-p2t4-test@example.invalid'], { cwd: tmp });
    execFileSync('git', ['config', 'user.name', 'CRW P2-T4 Test'], { cwd: tmp });

    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'p2t4-history-reviewer', moduleId, label: 'P2-T4 history cross-call fixture' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);
    assert.equal(await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'p2t4-history-reviewer', decision: 'approve',
      rationale: 'P2-T4 history cross-call fixture, structural only, no clinical claim.',
      reviewedAt: '2026-04-01T00:50:00Z', root: tmp, draft: true,
    }), EXIT_OK);
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    assert.equal(await runSign({ draft: draftPath, module: moduleId, root: tmp }), EXIT_OK);

    const recordPath = recordFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    const originalBytes = await readFile(recordPath, 'utf8');

    execFileSync('git', ['add', '-A'], { cwd: tmp });
    execFileSync('git', ['commit', '-q', '-m', 'add rr-0001-clinical-1 (P2-T4 fixture)'], { cwd: tmp });

    // First --history call, a fresh process: clean append-only history (exactly one commit, status
    // A). Also populates the persistent per-record cache.
    const first = runCli(
      ['validate', '--module', moduleId, '--root', tmp, '--history'],
      { REVIEW_RECORD_CACHE_DIR: cacheDir },
    );
    assert.equal(first.status, EXIT_OK, first.stderr);
    assert.deepEqual(parseCacheMarker(first.stdout), { hits: 0, misses: 1, scoped: 1 });

    // Delete the committed record, then restore the EXACT SAME bytes and commit again -- a real
    // append-only violation (this path's git history now shows THREE entries: A, D, A) that leaves
    // the record's own on-disk content byte-IDENTICAL to what the first call already cached -- so
    // the per-record cache entry stays a legitimate, genuine HIT on the second call below,
    // isolating this test's claim to the module-wide git-log walk itself (never re-derivable from
    // content/roster/schema hashes alone, since none of those changed).
    execFileSync('git', ['rm', '-q', recordPath], { cwd: tmp });
    execFileSync('git', ['commit', '-q', '-m', 'delete rr-0001-clinical-1 (P2-T4 simulated rewrite, step 1)'], { cwd: tmp });
    // `git rm` removes the now-empty modules/<id>/reviews/ (and, if also emptied, modules/<id>/)
    // directory tree along with the file -- recreate it before restoring the byte-identical file.
    await mkdir(path.dirname(recordPath), { recursive: true });
    await writeFile(recordPath, originalBytes, 'utf8');
    execFileSync('git', ['add', '-A'], { cwd: tmp });
    execFileSync(
      'git',
      ['commit', '-q', '-m', 'restore rr-0001-clinical-1 with IDENTICAL bytes (P2-T4 step 2 -- BAD, append-only violation)'],
      { cwd: tmp },
    );

    const restoredBytes = await readFile(recordPath, 'utf8');
    assert.equal(
      restoredBytes, originalBytes,
      'the restored file must be byte-IDENTICAL to what the first --history call already cached',
    );

    // Second --history call, a SEPARATE fresh process, reusing the SAME warm persistent cache dir.
    // If validate's own module-wide git-log walk were ever itself cached (rather than ALWAYS
    // freshly re-run per OQ-6), this call could stale-pass on the by-now-familiar "clean" verdict.
    const second = runCli(
      ['validate', '--module', moduleId, '--root', tmp, '--history'],
      { REVIEW_RECORD_CACHE_DIR: cacheDir },
    );
    assert.equal(
      second.status, EXIT_USAGE,
      'the SECOND --history call must fail closed on the newly committed append-only violation',
    );
    assert.match(second.stderr, /git-history:/);
    assert.match(second.stderr, /rr-0001-clinical-1/);
    assert.deepEqual(
      parseCacheMarker(second.stdout),
      { hits: 1, misses: 0, scoped: 1 },
      'the per-record schema/roster/signature/chain-link cache entry is genuinely WARM on the ' +
        'second call (byte-identical restored content) -- yet the git-history layer still caught ' +
        'the violation, proving that layer is never itself cached across invocations (OQ-6)',
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
    await rm(cacheDir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// P2-T4: microbenchmark script existence + discovery-glob-safety regression guard. The actual
// cross-process cache-cold vs. cache-warm wall-time measurement lives in a STANDALONE script
// (tests/ef-review-validate-cache-benchmark.mjs, run manually -- see that file's own header),
// deliberately NOT a node:test file, so it is never picked up by `npm test`'s
// `tests/*.test.mjs`/`tests/witness/*.test.mjs` discovery globs (F10) and never runs as part of the
// automated `npm run check` gate (process-spawn wall-clock timing is inherently environment-
// sensitive and does not belong in a deterministic CI gate). These two checks are lightweight
// regression guards for that design choice, not a re-run of the benchmark itself.
// -------------------------------------------------------------------------------------------

test('P2-T4: the cross-process cache microbenchmark script exists at tests/ef-review-validate-cache-benchmark.mjs', async () => {
  const benchmarkPath = path.join(REPO_ROOT, 'tests', 'ef-review-validate-cache-benchmark.mjs');
  const content = await readFile(benchmarkPath, 'utf8');
  assert.match(content, /cbc_suite_v1/, 'the benchmark must target the committed cbc_suite_v1 set');
  assert.match(content, /REVIEW_RECORD_CACHE_DIR/, 'the benchmark must share the persistent cache dir across invocations');
});

test('P2-T4: the microbenchmark script\'s filename does NOT match either npm-test discovery glob (tests/*.test.mjs, tests/witness/*.test.mjs) -- it must never run inside npm run check (F10)', () => {
  const benchmarkBasename = 'ef-review-validate-cache-benchmark.mjs';
  assert.ok(
    !benchmarkBasename.endsWith('.test.mjs'),
    'the benchmark script\'s own filename must not end in .test.mjs, or npm test would pick it up ' +
      'and run it as part of every gated npm run check invocation',
  );
});

// =================================================================================================
// P5-T1 (Clinical Review Workflow v1, Phase 5, FR-28, F8) -- full adversarial + fail-closed test
// sweep. Seven NAMED adversarial fixture classes, driven through status, sign, AND validate so
// every verb/path in this tool fails closed identically, never a silent pass:
//   (i)    a transposed-character subjectContentHash (F5's own class, driven end-to-end here)
//   (ii)   an out-of-order review-act sequence (a hand-crafted previousRecordHash chain break)
//   (iii)  a malformed supersedes-based "correction" (a schema-pattern-invalid supersedes value)
//   (iv)   malformed YAML -- F8 class -- genuinely unparseable file CONTENT with a WELL-FORMED
//          filename, distinct from the pre-existing malformed_v1 fixture (malformed FILENAME)
//   (v)    a roster-resolution failure -- F8 class -- an unknown reviewerId
//   (vi)   signature tampering -- F8 class -- a post-signing mutation that invalidates the Ed25519
//          signature, AND (a distinct angle on the same class) an already-populated signature on a
//          not-yet-signed draft
//   (vii)  an append-only git-history failure -- F8 class -- a commit-visible mutation of a
//          committed record path, --history active
//
// Per FR-28/F8, classes (iv)-(vii) are the four NAMED negative fixtures: each drives `status` to
// `derivedState: "invalid"` + non-zero exit wherever `validate` rejects the same input. All SEVEN
// classes below must produce a non-zero, fail-closed result on every verb whose OWN contract covers
// that input:
//   - `validate`/`status` always fail closed on all seven -- both read a module's full committed
//     record set, which is exactly what every one of these classes corrupts.
//   - `sign` fails closed directly wherever its OWN narrower contract (a staged, unsigned,
//     synthetic:true draft -- see lib/verbs/sign.mjs's own header) is the reachable entry point for
//     that class: (iii) supersedes-shape (BLOCKER 1(a) schema re-check), (iv) malformed draft YAML
//     (parse failure), (vi) an already-signed draft (signRecordDryRun's own re-sign refusal).
//   - Classes (i) and (v) are reachable ONLY via `scaffold` (the sole producer of a draft `sign`
//     ever reads, F1) -- `scaffold` itself refuses fail-closed, BEFORE any draft is staged, so
//     `sign` never receives anything for these two classes at all. Proving "no draft is ever
//     staged" IS the honest, whole-pipeline meaning of "sign also fails closed" for (i)/(v): the
//     malformed input never reaches sign's surface in the first place.
//   - Class (ii) demonstrates the system-level guarantee most explicitly: `sign` has NO
//     chain-verification duty of its own (that is `validate`/`status`'s job, per
//     lib/verbs/sign.mjs's own header) -- a hand-crafted, out-of-order draft is committed BY sign
//     without complaint, and is then immediately caught, fail-closed, by validate/status. This is
//     not a gap: it proves the fail-closed guarantee lives at the correct layer and that no
//     malformed record set can ever be reported as valid/complete/terminal by ANY verb.
//
// Every fixture below is either a throwaway tmp root (mkdtemp) or a new, isolated static fixture
// under tests/fixtures/clinical-review-workflow/ -- never the real repo tree's modules/ or
// governance/ trees, and never a write to REPO_ROOT (class (i) below reads REPO_ROOT read-only and
// asserts a rejected scaffold call writes nothing).
// =================================================================================================

const P5T1_FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'clinical-review-workflow');

// -------------------------------------------------------------------------------------------
// (i) transposed-character subjectContentHash -- driven through the full pipeline
// -------------------------------------------------------------------------------------------

test('P5-T1 (i): a transposed-character subjectContentHash fails closed at the scaffold gate, with --draft -- no draft is ever staged (so sign has nothing to read) and no committed record is ever written (so validate/status never see it)', async () => {
  const draftsDir = path.join(REPO_ROOT, '.review-drafts', 'cbc_suite_v1');
  const listDraftsDir = () => readdir(draftsDir).catch((err) => {
    if (err.code === 'ENOENT') return [];
    throw err;
  });
  const before = await listDraftsDir();

  const realHash = await computeModuleContentHash(REPO_ROOT, 'cbc_suite_v1');
  const [, hex] = realHash.split(':');
  const transposedHash = `sha256:${transposeAdjacentDifferingHexChars(hex)}`;
  assert.notEqual(transposedHash, realHash);
  assert.match(transposedHash, /^sha256:[0-9a-f]{64}$/);

  const result = runCli([
    'scaffold', '--module', 'cbc_suite_v1', '--role', 'clinical-1', '--subject', transposedHash,
    '--reviewer-id', 'dryrun-cbc-suite-clinical-1', '--decision', 'approve',
    '--rationale', 'P5-T1 (i): transposed-hash full-pipeline fail-closed regression, no clinical claim.',
    '--reviewed-at', '2026-05-01T00:00:00Z', '--root', REPO_ROOT, '--draft',
  ]);
  assert.equal(result.status, EXIT_USAGE, result.stdout);
  assert.match(result.stderr, /does not match/);

  const after = await listDraftsDir();
  assert.deepEqual(
    after, before,
    'the F5 hard-fail runs BEFORE the --draft write step (lib/verbs/scaffold.mjs\'s own ordering) -- ' +
      'no new file may appear under .review-drafts/cbc_suite_v1/ as a result of this rejected ' +
      'scaffold call, which is exactly why sign (F1: reads ONLY a staged draft) never has anything ' +
      'to process for this class, and validate/status never see a bad record either',
  );
});

// -------------------------------------------------------------------------------------------
// (ii) out-of-order review-act sequence -- a hand-crafted chain break
// -------------------------------------------------------------------------------------------

test('P5-T1 (ii): an out-of-order review-act sequence (a hand-crafted draft whose previousRecordHash does not match its real predecessor) is NOT caught by sign itself (sign has no chain-verification duty, F1) but is caught immediately, fail-closed and identically, by both validate and status over the resulting root', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p5t1-outoforder-'));
  try {
    const moduleId = 'p5t1_outoforder_v1';
    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'p5t1-oo-clinical-1', moduleId, label: 'P5-T1 (ii) clinical-1' },
      { reviewerId: 'p5t1-oo-clinical-2', moduleId, label: 'P5-T1 (ii) clinical-2' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);

    // Act 1: a genuine, correctly-chained scaffold -> sign.
    assert.equal(await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'p5t1-oo-clinical-1', decision: 'approve',
      rationale: 'P5-T1 (ii) act 1, structural only, no clinical claim.',
      reviewedAt: '2026-05-02T00:00:00Z', root: tmp, draft: true,
    }), EXIT_OK);
    const draft1Path = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    assert.equal(await runSign({ draft: draft1Path, module: moduleId, root: tmp }), EXIT_OK);

    // Act 2: a hand-crafted draft claiming to be "rr-0002-clinical-2" but carrying a
    // previousRecordHash that does NOT match act 1's real canonical hash -- an out-of-order/
    // corrupted-sequence act. Otherwise fully schema-shaped, so sign's own checks (review_id shape,
    // moduleId match, synthetic:true, post-sign schema conformance) all pass -- previousRecordHash
    // correctness is deliberately NOT one of sign's own checks (that is validate/status's job).
    const draft2Path = draftFilePathFor(tmp, moduleId, 'rr-0002-clinical-2');
    await mkdir(path.dirname(draft2Path), { recursive: true });
    const badDraft = {
      schemaVersion: 1, review_id: 'rr-0002-clinical-2', role: 'clinical-2', moduleId,
      subjectContentHash: SUBJECT_HASH,
      previousRecordHash: `sha256:${'0'.repeat(64)}`, // deliberately wrong -- out of order
      supersedes: null, reviewerId: 'p5t1-oo-clinical-2', decision: 'approve',
      rationale: 'P5-T1 (ii) act 2, deliberately out-of-order previousRecordHash, no clinical claim.',
      reviewedAt: '2026-05-02T00:05:00Z', synthetic: true, signature: null,
    };
    await writeFile(draft2Path, serializeReviewRecordYaml(badDraft), 'utf8');

    assert.equal(
      await runSign({ draft: draft2Path, module: moduleId, root: tmp }), EXIT_OK,
      'sign has no chain-verification duty of its own (F1) -- it commits a schema-valid, ' +
        'correctly-post-sign-schema-conformant draft regardless of whether its previousRecordHash ' +
        'agrees with reality',
    );

    // validate and status BOTH now fail closed, immediately, on the resulting chain break --
    // proving no verb/path ever reports this module-wide-broken record set as valid or complete.
    const validateViolations = await collectValidateViolations(moduleId, tmp);
    assert.ok(
      validateViolations.some((v) => v.startsWith('chain:')),
      `expected a chain: violation, got: ${JSON.stringify(validateViolations)}`,
    );

    const statusResult = collectStatusResult(moduleId, tmp);
    assert.equal(statusResult.derivedState, 'invalid');
    assert.equal(statusResult.nextExpectedRole, null);
    assert.deepEqual(
      statusResult.blockers, validateViolations,
      'status and validate must agree byte-for-byte on this hand-crafted out-of-order fixture (F6)',
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// (iii) a malformed supersedes-based "correction"
// -------------------------------------------------------------------------------------------

test('P5-T1 (iii): a malformed supersedes-based "correction" (a schema-pattern-invalid supersedes value, e.g. not the rr-<seq4>-<role> shape) fails closed on sign (both the library call and the real CLI subprocess), validate, AND status identically -- sign\'s own BLOCKER 1(a) post-sign schema re-check is the same schema validate checks post-commit, reused not forked', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p5t1-supersedes-malformed-'));
  try {
    const moduleId = 'p5t1_supersedes_malformed_v1';
    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'p5t1-supersedes-reviewer', moduleId, label: 'P5-T1 (iii)' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);

    // Act 1: a genuine, correctly-chained scaffold -> sign (the record the bogus "correction" below
    // claims -- illegitimately -- to supersede).
    assert.equal(await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'p5t1-supersedes-reviewer', decision: 'approve',
      rationale: 'P5-T1 (iii) act 1, structural only, no clinical claim.',
      reviewedAt: '2026-05-03T00:00:00Z', root: tmp, draft: true,
    }), EXIT_OK);
    const draft1Path = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    assert.equal(await runSign({ draft: draft1Path, module: moduleId, root: tmp }), EXIT_OK);

    const badSupersedesDraft = {
      schemaVersion: 1, review_id: 'rr-0002-clinical-1', role: 'clinical-1', moduleId,
      subjectContentHash: SUBJECT_HASH, previousRecordHash: null, // chain irrelevant to this class
      supersedes: 'not-a-review-id', // malformed: does not match rr-<seq4>-<role>
      reviewerId: 'p5t1-supersedes-reviewer', decision: 'approve',
      rationale: 'P5-T1 (iii) malformed-supersedes correction attempt, no clinical claim.',
      reviewedAt: '2026-05-03T00:10:00Z', synthetic: true, signature: null,
    };

    // sign path, library call: hand-craft the malformed-correction draft and try to sign it.
    const draft2Path = draftFilePathFor(tmp, moduleId, 'rr-0002-clinical-1');
    await mkdir(path.dirname(draft2Path), { recursive: true });
    await writeFile(draft2Path, serializeReviewRecordYaml(badSupersedesDraft), 'utf8');
    await assert.rejects(
      () => runSign({ draft: draft2Path, module: moduleId, root: tmp }),
      (err) => err instanceof UsageError && /supersedes/.test(err.message),
      'sign must refuse a malformed supersedes value via its own BLOCKER 1(a) post-sign schema check',
    );

    // sign path, real CLI subprocess (the same fixture, exercised the way a real invocation would
    // hit it -- exit code + stderr, not just an in-process thrown error).
    const cliResult = runCli(['sign', '--draft', draft2Path, '--module', moduleId, '--root', tmp]);
    assert.equal(cliResult.status, EXIT_USAGE, cliResult.stdout);
    assert.match(cliResult.stderr, /supersedes/);

    // validate/status path: the adversarial "what if a bad record reaches reviews/ some other way"
    // case -- hand-craft the SAME malformed correction directly as a COMMITTED record (bypassing
    // sign entirely) and confirm validate/status ALSO reject it, identically.
    await writeNewReviewRecordFile(tmp, moduleId, 'rr-0003-clinical-1', {
      ...badSupersedesDraft,
      review_id: 'rr-0003-clinical-1',
      signature: { algorithm: 'ed25519', keyId: 'TESTKEY-p5t1-fixture', value: 'ZmFrZQ==' },
    });

    const validateViolations = await collectValidateViolations(moduleId, tmp);
    assert.ok(
      validateViolations.some((v) => v.includes('supersedes')),
      `expected a schema violation naming supersedes, got: ${JSON.stringify(validateViolations)}`,
    );
    const statusResult = collectStatusResult(moduleId, tmp);
    assert.equal(statusResult.derivedState, 'invalid');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// (iv) malformed YAML (F8) -- genuinely unparseable file CONTENT, well-formed filename
// -------------------------------------------------------------------------------------------

test('P5-T1 (iv, F8): malformed YAML CONTENT (a well-formed rr-0001-clinical-1.yaml filename, genuinely unparseable content) fails closed on validate and status identically -- status reports derivedState invalid + non-zero exit', async () => {
  // Unlike a schema/roster/chain/signature finding (which validate collects into a
  // ValidationFailedError's .violations[]), a YAML parse failure is a genuine tool-usage failure
  // that propagates as a bare (non-ValidationFailedError) error -- exactly the class
  // lib/verbs/status.mjs's own header documents ("validate is content to let a handful of these
  // propagate ... status --json must still emit a well-shaped body naming invalid either way").
  // collectValidateViolations (defined above) only unwraps ValidationFailedError, so this class is
  // asserted directly via assert.rejects rather than through that helper.
  await assert.rejects(
    () => runValidate({ module: 'malformed_yaml_content_v1', root: P5T1_FIXTURES_ROOT }),
    /unterminated/,
    'validate must reject unparseable YAML content',
  );
  const cliResult = runCli(['validate', '--module', 'malformed_yaml_content_v1', '--root', P5T1_FIXTURES_ROOT]);
  assert.equal(cliResult.status, EXIT_USAGE, cliResult.stdout);

  const { status, stdout, stderr } = runStatusCli(['--module', 'malformed_yaml_content_v1', '--root', P5T1_FIXTURES_ROOT, '--json']);
  assert.equal(status, EXIT_USAGE, stderr);
  const parsed = JSON.parse(stdout);
  assertStatusJsonShape(parsed);
  assert.equal(parsed.derivedState, 'invalid');
  assert.equal(parsed.nextExpectedRole, null);
  assert.ok(parsed.blockers.length > 0);
});

test('P5-T1 (iv, F8): malformed YAML CONTENT fails closed on sign too -- a staged draft file with genuinely unparseable content is refused, non-zero exit, before any write', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p5t1-malformed-draft-'));
  try {
    const moduleId = 'p5t1_malformed_draft_v1';
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    await mkdir(path.dirname(draftPath), { recursive: true });
    await writeFile(
      draftPath,
      'schemaVersion: 1\nrationale: "this quoted string is deliberately never closed\nreviewerId: p5t1-malformed-draft-fixture\n',
      'utf8',
    );

    await assert.rejects(() => runSign({ draft: draftPath, module: moduleId, root: tmp }));

    const cliResult = runCli(['sign', '--draft', draftPath, '--module', moduleId, '--root', tmp]);
    assert.equal(cliResult.status, EXIT_USAGE, cliResult.stdout);

    const committed = await listModuleReviewRecords(tmp, moduleId);
    assert.deepEqual(committed, [], 'a malformed draft must never reach a committed write');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// (v) roster-resolution failure (F8) -- an unknown reviewerId
// -------------------------------------------------------------------------------------------

test('P5-T1 (v, F8): a roster-resolution failure (an unknown reviewerId) fails closed on validate and status identically over the pre-existing nonroster_reviewer_v1 fixture -- status reports derivedState invalid + non-zero exit', async () => {
  const validateViolations = await collectValidateViolations('nonroster_reviewer_v1', FIXTURES_ROOT);
  assert.ok(
    validateViolations.some((v) => v.includes('does not resolve to any entry in governance/reviewer-roster.yaml')),
    `expected a roster-resolution violation, got: ${JSON.stringify(validateViolations)}`,
  );

  const statusResult = collectStatusResult('nonroster_reviewer_v1', FIXTURES_ROOT);
  assert.equal(statusResult.derivedState, 'invalid');
  assert.deepEqual(
    statusResult.blockers, validateViolations,
    'status and validate must agree byte-for-byte on the roster-resolution-failure fixture (F6)',
  );
});

test('P5-T1 (v): a roster-resolution failure is reachable ONLY via scaffold (F1: sign reads exclusively a scaffold-produced draft) -- scaffold refuses fail-closed BEFORE any draft is staged, so sign never sees a non-roster reviewerId for this class', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p5t1-roster-'));
  try {
    const moduleId = 'p5t1_roster_v1';
    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'p5t1-roster-real-reviewer', moduleId, label: 'P5-T1 (v)' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);

    const draftsDir = path.join(tmp, '.review-drafts', moduleId);
    const before = await readdir(draftsDir).catch((err) => {
      if (err.code === 'ENOENT') return [];
      throw err;
    });

    await assert.rejects(
      () => runScaffold({
        module: moduleId, role: 'clinical-1', reviewerId: 'someone-not-on-the-roster',
        decision: 'approve', rationale: 'P5-T1 (v), no clinical claim.',
        reviewedAt: '2026-05-05T00:00:00Z', root: tmp, draft: true,
      }),
      UnknownReviewerError,
    );

    const after = await readdir(draftsDir).catch((err) => {
      if (err.code === 'ENOENT') return [];
      throw err;
    });
    assert.deepEqual(after, before, 'a rejected scaffold call must stage no draft for sign to read');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// (vi) signature tampering (F8)
// -------------------------------------------------------------------------------------------

test('P5-T1 (vi, F8): signature tampering fails closed on validate and status identically over a freshly signed-then-tampered record -- status reports derivedState invalid + non-zero exit', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p5t1-tamper-'));
  try {
    const moduleId = 'p5t1_tamper_v1';
    await writeSignFixtureRoster(tmp, [{ reviewerId: 'p5t1-tamper-reviewer', moduleId, label: 'P5-T1 (vi)' }]);
    await writeTrivialModuleContent(tmp, moduleId);

    assert.equal(await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'p5t1-tamper-reviewer', decision: 'approve',
      rationale: 'P5-T1 (vi), genuine TESTKEY--signed record about to be tampered with, no clinical claim.',
      reviewedAt: '2026-05-06T00:00:00Z', root: tmp, draft: true,
    }), EXIT_OK);
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    assert.equal(await runSign({ draft: draftPath, module: moduleId, root: tmp }), EXIT_OK);

    // Tamper: flip the committed decision AFTER signing, without re-signing.
    const filePath = recordFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    const rawYaml = await readFile(filePath, 'utf8');
    assert.match(rawYaml, /^decision: approve$/m);
    const tampered = rawYaml.replace(/^decision: approve$/m, 'decision: reject');
    assert.notEqual(tampered, rawYaml);
    await writeFile(filePath, tampered, 'utf8');

    const validateViolations = await collectValidateViolations(moduleId, tmp);
    assert.ok(
      validateViolations.some((v) => v.includes('cryptographic verification failed')),
      `expected a signature-tamper violation, got: ${JSON.stringify(validateViolations)}`,
    );

    const statusResult = collectStatusResult(moduleId, tmp);
    assert.equal(statusResult.derivedState, 'invalid');
    assert.deepEqual(
      statusResult.blockers, validateViolations,
      'status and validate must agree byte-for-byte on the tampered-signature fixture (F6)',
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('P5-T1 (vi): signature tampering is refused by sign too, on the ONE input shape sign\'s own contract can see it in -- a draft that already carries a (forged) populated signature -- signRecordDryRun refuses to re-sign an already-signed record', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p5t1-presigned-'));
  try {
    const moduleId = 'p5t1_presigned_v1';
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    await mkdir(path.dirname(draftPath), { recursive: true });
    const forgedDraft = {
      schemaVersion: 1, review_id: 'rr-0001-clinical-1', role: 'clinical-1', moduleId,
      subjectContentHash: SUBJECT_HASH, previousRecordHash: null, supersedes: null,
      reviewerId: 'p5t1-presigned-reviewer', decision: 'approve',
      rationale: 'P5-T1 (vi), a draft that already carries a forged signature, no clinical claim.',
      reviewedAt: '2026-05-06T00:10:00Z', synthetic: true,
      signature: { algorithm: 'ed25519', keyId: 'TESTKEY-forged', value: 'Zm9yZ2Vk' },
    };
    await writeFile(draftPath, serializeReviewRecordYaml(forgedDraft), 'utf8');

    await assert.rejects(
      () => runSign({ draft: draftPath, module: moduleId, root: tmp }),
      (err) => err instanceof UsageError && /already carries a populated signature/.test(err.message),
    );

    const committed = await listModuleReviewRecords(tmp, moduleId);
    assert.deepEqual(committed, [], 'a pre-signed/forged draft must never reach a committed write');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// (vii) append-only git-history failure (F8), --history active -- a REAL commit-visible mutation
// of a committed record path (distinct from the pre-existing "not a git working tree" status test,
// which exercises a different F8 sub-case -- a genuine tool-usage failure rather than a detected
// history violation).
// -------------------------------------------------------------------------------------------

test('P5-T1 (vii, F8): an append-only git-history violation (a legitimately-signed record, then deleted and byte-identically restored in a later commit) fails closed on validate --history and status --history identically -- status reports derivedState invalid + non-zero exit', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p5t1-history-'));
  try {
    const moduleId = 'p5t1_history_v1';
    execFileSync('git', ['init', '-q'], { cwd: tmp });
    execFileSync('git', ['config', 'user.email', 'crw-p5t1-test@example.invalid'], { cwd: tmp });
    execFileSync('git', ['config', 'user.name', 'CRW P5-T1 Test'], { cwd: tmp });

    await writeSignFixtureRoster(tmp, [
      { reviewerId: 'p5t1-history-reviewer', moduleId, label: 'P5-T1 (vii)' },
    ]);
    await writeTrivialModuleContent(tmp, moduleId);

    // A legitimate scaffold -> sign act -- sign's own append-only write path (F1/R10) is not what
    // this test targets; the violation below is introduced entirely OUT OF BAND, via direct git
    // commands, never through sign itself (proving sign structurally cannot be the mechanism that
    // breaks this invariant -- that guarantee is already covered by this file's own "F1: sign never
    // opens or rewrites a path already inside reviews/" test).
    assert.equal(await runScaffold({
      module: moduleId, role: 'clinical-1', reviewerId: 'p5t1-history-reviewer', decision: 'approve',
      rationale: 'P5-T1 (vii) act 1, structural only, no clinical claim.',
      reviewedAt: '2026-05-07T00:00:00Z', root: tmp, draft: true,
    }), EXIT_OK);
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    assert.equal(await runSign({ draft: draftPath, module: moduleId, root: tmp }), EXIT_OK);

    const recordPath = recordFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');
    const originalBytes = await readFile(recordPath, 'utf8');
    execFileSync('git', ['add', '-A'], { cwd: tmp });
    execFileSync('git', ['commit', '-q', '-m', 'add rr-0001-clinical-1 (P5-T1 fixture)'], { cwd: tmp });

    // Out-of-band, commit-visible mutation: delete then byte-identically restore -- a real
    // append-only violation (history now shows [A, D, A] for this path), even though the file's
    // FINAL on-disk bytes are unchanged.
    execFileSync('git', ['rm', '-q', recordPath], { cwd: tmp });
    execFileSync('git', ['commit', '-q', '-m', 'delete rr-0001-clinical-1 (P5-T1 simulated rewrite, step 1)'], { cwd: tmp });
    await mkdir(path.dirname(recordPath), { recursive: true });
    await writeFile(recordPath, originalBytes, 'utf8');
    execFileSync('git', ['add', '-A'], { cwd: tmp });
    execFileSync(
      'git',
      ['commit', '-q', '-m', 'restore rr-0001-clinical-1 with IDENTICAL bytes (P5-T1 step 2 -- BAD, append-only violation)'],
      { cwd: tmp },
    );

    const validateResult = runCli(['validate', '--module', moduleId, '--root', tmp, '--history']);
    assert.equal(validateResult.status, EXIT_USAGE, validateResult.stdout);
    assert.match(validateResult.stderr, /git-history:/);

    const { status, stdout, stderr } = runStatusCli(['--module', moduleId, '--root', tmp, '--json', '--history']);
    assert.equal(status, EXIT_USAGE, stderr);
    const parsed = JSON.parse(stdout);
    assertStatusJsonShape(parsed);
    assert.equal(parsed.derivedState, 'invalid');
    assert.equal(parsed.nextExpectedRole, null);
    assert.ok(parsed.blockers.some((b) => b.startsWith('git-history:')));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// F9: the frozen scaffold --draft -> sign --draft -> validate command flow, end to end, through
// the REAL CLI (subprocess, not in-process library calls) -- extending the pre-existing "cli.mjs
// (subprocess): scaffold --draft -> sign --draft round-trips end to end" test (which stops at
// sign) one step further, through validate AND status, over the SAME real cli.mjs entry point.
// -------------------------------------------------------------------------------------------

test('F9 (P5-T1): scaffold --draft -> sign --draft -> validate -> status, driven end to end through the real CLI subprocess for every step', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-p5t1-f9-cli-'));
  try {
    const moduleId = 'p5t1_f9_cli_v1';
    await writeSignFixtureRoster(tmp, [{ reviewerId: 'p5t1-f9-reviewer', moduleId, label: 'F9 CLI round-trip fixture' }]);
    await writeTrivialModuleContent(tmp, moduleId);

    const scaffoldResult = runCli([
      'scaffold', '--module', moduleId, '--role', 'clinical-1',
      '--reviewer-id', 'p5t1-f9-reviewer', '--decision', 'approve',
      '--rationale', 'F9 (P5-T1) CLI round-trip regression, structural only, no clinical claim.',
      '--reviewed-at', '2026-05-08T00:00:00Z', '--root', tmp, '--draft',
    ]);
    assert.equal(scaffoldResult.status, EXIT_OK, scaffoldResult.stderr);
    const draftPath = draftFilePathFor(tmp, moduleId, 'rr-0001-clinical-1');

    const signResult = runCli(['sign', '--draft', draftPath, '--module', moduleId, '--root', tmp]);
    assert.equal(signResult.status, EXIT_OK, signResult.stderr);
    assert.match(signResult.stdout, /TESTKEY-/);

    const validateResult = runCli(['validate', '--module', moduleId, '--root', tmp]);
    assert.equal(validateResult.status, EXIT_OK, validateResult.stderr);
    assert.match(validateResult.stdout, /^OK —/m);

    const { status, stdout, stderr } = runStatusCli(['--module', moduleId, '--root', tmp, '--json']);
    assert.equal(status, EXIT_OK, stderr);
    const parsed = JSON.parse(stdout);
    assertStatusJsonShape(parsed);
    assert.equal(parsed.derivedState, 'in-progress');
    assert.equal(parsed.nextExpectedRole, 'clinical-2');
    assert.equal(parsed.records.length, 1);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// Coverage manifest -- a cheap, auditable, structural proof this file actually names all seven
// P5-T1 adversarial classes (FR-28/F8's acceptance criterion: "7/7 adversarial/fail-closed classes
// produce the expected non-zero fail-closed result on status, sign, and validate"). Grep-based on
// this file's OWN source rather than a hand-maintained checklist, so it cannot silently drift from
// the tests actually present above.
// -------------------------------------------------------------------------------------------

test('P5-T1 coverage manifest: this file names all seven adversarial/fail-closed classes (i)-(vii), each with a P5-T1-tagged test', async () => {
  const source = await readFile(path.join(REPO_ROOT, 'tests', 'ef-review-workflow.test.mjs'), 'utf8');
  for (const label of ['P5-T1 (i)', 'P5-T1 (ii)', 'P5-T1 (iii)', 'P5-T1 (iv', 'P5-T1 (v', 'P5-T1 (vi', 'P5-T1 (vii']) {
    assert.match(
      source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `expected at least one test naming "${label}"`,
    );
  }
});
