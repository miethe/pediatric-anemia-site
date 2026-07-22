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
import { spawnSync } from 'node:child_process';
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
import { buildDraftRecord, run as runScaffold } from '../tools/review-record/lib/verbs/scaffold.mjs';
import { run as runValidate } from '../tools/review-record/lib/verbs/validate.mjs';
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
// subject + real-identity write path. This section runs against the REAL repo root/module
// (read-only: `dryrun-cbc-suite-*` roster entries always resolve `synthetic: true`, so `scaffold`
// only ever prints a DRAFT ONLY preview here — see lib/verbs/scaffold.mjs — it never writes to
// modules/cbc_suite_v1/reviews/ or governance/reviewer-roster.yaml) plus one throwaway tmp root
// that copies tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml into its own
// governance/reviewer-roster.yaml — the real roster is never read or written by this section.
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

test('scaffold against the real governance/reviewer-roster.yaml is behaviorally unchanged when --subject is supplied explicitly', () => {
  const { status, stdout, stderr } = runCli([
    'scaffold', '--module', 'cbc_suite_v1', '--role', 'lab',
    '--subject', SUBJECT_HASH,
    '--reviewer-id', 'dryrun-cbc-suite-lab', '--decision', 'approve',
    '--rationale', 'P1-T3 explicit-subject regression check against the real roster, no clinical claim.',
    '--reviewed-at', '2026-02-04T00:05:00Z',
    '--root', REPO_ROOT,
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

test('governance/reviewer-roster.yaml shows zero diff against HEAD after this task\'s scaffold tests (real roster never read/written by this section)', () => {
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
