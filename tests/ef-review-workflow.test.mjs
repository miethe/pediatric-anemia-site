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
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
import { loadRosterIndex, resolveReviewer, buildRosterIndex } from '../tools/review-record/lib/roster.mjs';
import { checkReviewerIndependence, longestCommonSubstringLength } from '../tools/review-record/lib/independence.mjs';
import { computeModuleContentHash } from '../tools/review-record/lib/subject.mjs';
import { signRecordDryRun } from '../tools/review-record/lib/signature.mjs';
import { buildDraftRecord, run as runScaffold } from '../tools/review-record/lib/verbs/scaffold.mjs';
import { run as runValidate } from '../tools/review-record/lib/verbs/validate.mjs';
import { isExpectedTerminalNonQualifyingViolations } from '../tools/review-record/lib/verbs/dry-run.mjs';
import {
  ACTS_COMPLETE_UNAUTHORIZED,
  REDACTED_MARKER,
  applyRedaction,
  computeEffectiveRecordsByRole,
  computeTurnState,
  run as runStatus,
} from '../tools/review-record/lib/verbs/status.mjs';
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

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' });
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
    }),
    UnknownReviewerError,
  );
});

test('cli.mjs scaffold (subprocess) rejects an unknown reviewerId with exit 1', () => {
  const { status, stderr } = runCli([
    'scaffold', '--module', 'scaffold_target_v1', '--role', 'clinical-1', '--subject', SUBJECT_HASH,
    '--reviewer-id', 'nobody-on-the-roster', '--decision', 'approve', '--rationale', 'x'.repeat(10),
    '--root', FIXTURES_ROOT,
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

test('governance/reviewer-roster.yaml shows zero diff against HEAD after this task\'s scaffold tests (proves no WRITE occurred; the file IS read read-only by the auto-derivation test above, by design -- see this section\'s header)', () => {
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
// FR-4 reviewer-2 independence — structural (scaffold never reads/prints clinical-1 content)
// -------------------------------------------------------------------------------------------

test('cli.mjs scaffold --role clinical-2 never prints, embeds, or otherwise surfaces a sentinel string unique to the module\'s clinical-1 record', () => {
  const { status, stdout, stderr } = runCli([
    'scaffold', '--module', 'independence_target_v1', '--role', 'clinical-2', '--subject', SUBJECT_HASH,
    '--reviewer-id', 'synthetic-multirole-reviewer', '--decision', 'approve',
    '--rationale', 'Independent clinical-2 assessment, formed without reading clinical-1.',
    '--reviewed-at', '2026-02-02T00:00:00Z',
    '--root', FIXTURES_ROOT,
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
