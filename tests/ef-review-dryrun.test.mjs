// tests/ef-review-dryrun.test.mjs — P2-T8 (Evidence Foundry E1 Phase 2, FR-11, ruling R4).
//
// Covers this task's own acceptance criteria
// (docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-2-4-workstreams.md,
// row P2-T8):
//   - 5/5 record types committed, chain-valid, each `synthetic: true` with non-qualifying language.
//   - `npm run validate` (scripts/validate-kb.mjs's own wiring) green over the committed set.
//   - Schema test proves zero approver fields populated anywhere.
//   - Friction note committed (observations only, no portal recommendation).
//
// Two kinds of coverage: (a) the `dry-run` MECHANISM, exercised end to end against a throwaway
// git-fixture module (never the real repo tree — a re-run there would correctly fail closed, since
// this store is append-only and dry-run is a one-time act, see lib/verbs/dry-run.mjs's own header);
// (b) the REAL, already-committed `modules/cbc_suite_v1/reviews/` artifact this task produced by
// running `dry-run` once for real — static structural assertions against those actual files,
// without re-invoking the mutating verb a second time.
//
// Structural validity proven here never implies clinical validity, safety, or that a named human
// clinician reviewed anything — see schemas/review-record.schema.json's own top-level description
// for that standing caveat.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate as validateAgainstSchema } from '../scripts/lib/json-schema-lite.mjs';
import { validateModuleReviews } from '../scripts/validate-kb.mjs';
import { computeModuleContentHash } from '../tools/review-record/lib/subject.mjs';
import {
  DEFAULT_DRY_RUN_MODULE_ID,
  DRY_RUN_PERSONAS,
  computeDryRunReviewedAt,
  isExpectedTerminalNonQualifyingViolations,
  run as runDryRun,
} from '../tools/review-record/lib/verbs/dry-run.mjs';
import { run as runValidate } from '../tools/review-record/lib/verbs/validate.mjs';
import { REVIEW_ROLES, listModuleReviewRecords } from '../tools/review-record/lib/store.mjs';
import { checkModuleChainLinkage } from '../tools/review-record/lib/chain.mjs';
import { checkReviewerIndependence } from '../tools/review-record/lib/independence.mjs';
import { verifyRecordSignature } from '../tools/review-record/lib/signature.mjs';
import { loadRosterIndex, resolveReviewer } from '../tools/review-record/lib/roster.mjs';
import { UsageError, ValidationFailedError, EXIT_OK } from '../tools/review-record/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');
const GOLDEN_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-review-dryrun', 'golden', 'modules', 'cbc_suite_v1', 'reviews');
const FRICTION_NOTE_PATH = path.join(REPO_ROOT, '.claude', 'worknotes', 'evidence-foundry-e1-v1', 'dryrun-friction.md');
const REAL_ROSTER_PATH = path.join(REPO_ROOT, 'governance', 'reviewer-roster.yaml');

async function loadSchema() {
  return JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
}

// -------------------------------------------------------------------------------------------
// Temp-git-repo test helper — mirrors tests/ef-review-adjudication.test.mjs's own makeGitFixture,
// full control over commit authorship, isolated from this repo.
// -------------------------------------------------------------------------------------------

async function makeGitFixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'ef-dryrun-git-'));
  const git = (args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'ignore', 'ignore'] });
  git(['init', '--quiet']);
  git(['config', 'user.email', 'test-fixture-committer@example.test']);
  git(['config', 'user.name', 'Test Fixture Committer']);
  git(['config', 'commit.gpgsign', 'false']);
  return {
    dir,
    async commitFile(relPath, content, authorName, authorEmail, message) {
      const fullPath = path.join(dir, relPath);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, 'utf8');
      git(['add', relPath]);
      git(['commit', '--quiet', '--author', `${authorName} <${authorEmail}>`, '-m', message]);
    },
  };
}

async function cleanup(dir) {
  await rm(dir, { recursive: true, force: true });
}

/** Roster fixture YAML carrying the exact P2-T8 persona reviewerIds, scoped to `fixtureModuleId`. */
function fixtureRosterYaml(fixtureModuleId) {
  const lines = ['schemaVersion: 1', 'reviewers:'];
  for (const role of REVIEW_ROLES) {
    const persona = DRY_RUN_PERSONAS[role];
    lines.push(
      `  - reviewerId: ${persona.reviewerId}`,
      `    name: "SYNTHETIC -- NOT A CREDENTIALED REVIEWER (fixture ${role} persona)"`,
      `    credentialRef: fixture-placeholder-credential-${role}`,
      '    moduleScopes:',
      `      - ${fixtureModuleId}`,
      '    synthetic: true',
    );
  }
  return `${lines.join('\n')}\n`;
}

/** Sets up a fresh throwaway git-fixture module + matching roster, ready for a `dry-run` pass. */
async function makeDryRunFixture(fixtureModuleId) {
  const fixture = await makeGitFixture();
  await fixture.commitFile(
    `modules/${fixtureModuleId}/module.json`,
    `{"id":"${fixtureModuleId}","note":"P2-T8 dry-run mechanism fixture, not a real module"}\n`,
    'Fixture Author',
    'fixture-author@example.test',
    `add ${fixtureModuleId}/module.json`,
  );
  await fixture.commitFile(
    'governance/reviewer-roster.yaml',
    fixtureRosterYaml(fixtureModuleId),
    'Fixture Author',
    'fixture-author@example.test',
    'add fixture reviewer-roster.yaml',
  );
  return fixture;
}

// -------------------------------------------------------------------------------------------
// lib/subject.mjs — computeModuleContentHash
// -------------------------------------------------------------------------------------------

test('computeModuleContentHash is deterministic over the same content', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-subject-hash-'));
  try {
    await mkdir(path.join(tmp, 'modules', 'hash_target_v1'), { recursive: true });
    await writeFile(path.join(tmp, 'modules', 'hash_target_v1', 'a.json'), '{"x":1}\n', 'utf8');
    await writeFile(path.join(tmp, 'modules', 'hash_target_v1', 'b.json'), '{"y":2}\n', 'utf8');
    const first = await computeModuleContentHash(tmp, 'hash_target_v1');
    const second = await computeModuleContentHash(tmp, 'hash_target_v1');
    assert.equal(first, second);
    assert.match(first, /^sha256:[0-9a-f]{64}$/);
  } finally {
    await cleanup(tmp);
  }
});

test('computeModuleContentHash changes when a file\'s content changes', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-subject-hash-drift-'));
  try {
    await mkdir(path.join(tmp, 'modules', 'hash_drift_v1'), { recursive: true });
    await writeFile(path.join(tmp, 'modules', 'hash_drift_v1', 'a.json'), '{"x":1}\n', 'utf8');
    const before = await computeModuleContentHash(tmp, 'hash_drift_v1');
    await writeFile(path.join(tmp, 'modules', 'hash_drift_v1', 'a.json'), '{"x":2}\n', 'utf8');
    const after = await computeModuleContentHash(tmp, 'hash_drift_v1');
    assert.notEqual(before, after);
  } finally {
    await cleanup(tmp);
  }
});

test('computeModuleContentHash excludes a module\'s own reviews/ directory from the hashed set', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-subject-hash-excl-'));
  try {
    await mkdir(path.join(tmp, 'modules', 'hash_excl_v1'), { recursive: true });
    await writeFile(path.join(tmp, 'modules', 'hash_excl_v1', 'a.json'), '{"x":1}\n', 'utf8');
    const before = await computeModuleContentHash(tmp, 'hash_excl_v1');
    await mkdir(path.join(tmp, 'modules', 'hash_excl_v1', 'reviews'), { recursive: true });
    await writeFile(path.join(tmp, 'modules', 'hash_excl_v1', 'reviews', 'rr-0001-clinical-1.yaml'), 'irrelevant\n', 'utf8');
    const after = await computeModuleContentHash(tmp, 'hash_excl_v1');
    assert.equal(before, after, 'adding files under reviews/ must never change the subject hash');
  } finally {
    await cleanup(tmp);
  }
});

test('computeModuleContentHash fails closed on a missing module directory', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-subject-hash-missing-'));
  try {
    await assert.rejects(() => computeModuleContentHash(tmp, 'does_not_exist_v1'), UsageError);
  } finally {
    await cleanup(tmp);
  }
});

test('computeModuleContentHash fails closed on an empty module directory (excluding reviews/)', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'ef-subject-hash-empty-'));
  try {
    await mkdir(path.join(tmp, 'modules', 'hash_empty_v1', 'reviews'), { recursive: true });
    await writeFile(path.join(tmp, 'modules', 'hash_empty_v1', 'reviews', 'rr-0001-clinical-1.yaml'), 'x\n', 'utf8');
    await assert.rejects(() => computeModuleContentHash(tmp, 'hash_empty_v1'), UsageError);
  } finally {
    await cleanup(tmp);
  }
});

// -------------------------------------------------------------------------------------------
// DRY_RUN_PERSONAS — shape + FR-4 independence-heuristic cleanliness
// -------------------------------------------------------------------------------------------

test('DRY_RUN_PERSONAS has exactly one entry per REVIEW_ROLES role, each with a distinct reviewerId', () => {
  assert.deepEqual(Object.keys(DRY_RUN_PERSONAS).sort(), [...REVIEW_ROLES].sort());
  const reviewerIds = REVIEW_ROLES.map((role) => DRY_RUN_PERSONAS[role].reviewerId);
  assert.equal(new Set(reviewerIds).size, reviewerIds.length, 'reviewerIds must be pairwise distinct');
  for (const role of REVIEW_ROLES) {
    assert.match(DRY_RUN_PERSONAS[role].reviewerId, /^[a-z][a-z0-9-]*$/);
  }
});

test('every DRY_RUN_PERSONAS rationale carries explicit non-credentialed / synthetic language', () => {
  for (const role of REVIEW_ROLES) {
    const { rationale } = DRY_RUN_PERSONAS[role];
    assert.match(rationale, /SYNTHETIC|DRY-RUN/i, `role ${role} rationale must self-identify as synthetic/dry-run`);
    assert.match(rationale, /NOT.{0,20}CREDENTIALED|NON-CREDENTIALED/i, `role ${role} rationale must self-identify as non-credentialed`);
  }
});

test('the clinical-1 / clinical-2 persona rationales are independently clean of the FR-4 textual-overlap heuristic', () => {
  const c1 = { review_id: 'rr-0001-clinical-1', reviewerId: DRY_RUN_PERSONAS['clinical-1'].reviewerId, rationale: DRY_RUN_PERSONAS['clinical-1'].rationale };
  const c2 = { review_id: 'rr-0002-clinical-2', reviewerId: DRY_RUN_PERSONAS['clinical-2'].reviewerId, rationale: DRY_RUN_PERSONAS['clinical-2'].rationale };
  assert.deepEqual(checkReviewerIndependence(c1, c2), [], 'the two persona rationales must not trip the FR-4 heuristic (no shared boilerplate >=20 chars, no cross-reference)');
});

// -------------------------------------------------------------------------------------------
// computeDryRunReviewedAt
// -------------------------------------------------------------------------------------------

test('computeDryRunReviewedAt offsets by whole minutes per role index from a fixed base', () => {
  const base = '2026-03-01T00:00:00Z';
  assert.equal(computeDryRunReviewedAt(base, 0), '2026-03-01T00:00:00.000Z');
  assert.equal(computeDryRunReviewedAt(base, 1), '2026-03-01T00:01:00.000Z');
  assert.equal(computeDryRunReviewedAt(base, 4), '2026-03-01T00:04:00.000Z');
});

test('computeDryRunReviewedAt defaults to "now" when no base is given', () => {
  const before = Date.now();
  const iso = computeDryRunReviewedAt(undefined, 0);
  const after = Date.now();
  const parsed = new Date(iso).getTime();
  assert.ok(parsed >= before && parsed <= after + 1000, 'expected a timestamp near "now"');
});

test('computeDryRunReviewedAt fails closed on an invalid base date-time', () => {
  assert.throws(() => computeDryRunReviewedAt('not-a-date', 0), UsageError);
});

// -------------------------------------------------------------------------------------------
// isExpectedTerminalNonQualifyingViolations — the narrow "this is the correct FR-6 end state"
// check, proven both to accept the real shape and to reject anything else.
// -------------------------------------------------------------------------------------------

test('isExpectedTerminalNonQualifyingViolations accepts exactly the FR-6 synthetic-set violation shape', () => {
  const violations = [
    'rr-0005-release-auth: release-authorization is not valid — record(s) rr-0001-clinical-1, ' +
      'rr-0002-clinical-2, rr-0003-lab, rr-0004-adjudication, rr-0005-release-auth are ' +
      'synthetic:true (or missing a boolean `synthetic` field); a synthetic record can never ' +
      'satisfy release-authorization validity (FR-6, D-4) regardless of its decision or signature.',
  ];
  assert.equal(isExpectedTerminalNonQualifyingViolations(violations), true);
});

test('isExpectedTerminalNonQualifyingViolations rejects an empty list, a wrong count, and unrelated wording', () => {
  assert.equal(isExpectedTerminalNonQualifyingViolations([]), false);
  assert.equal(isExpectedTerminalNonQualifyingViolations([
    'rr-0005-release-auth: release-authorization is not valid — synthetic:true (FR-6, D-4)',
    'some other unrelated violation',
  ]), false);
  assert.equal(isExpectedTerminalNonQualifyingViolations(['chain: rr-0003-lab: broken link']), false);
  assert.equal(isExpectedTerminalNonQualifyingViolations(null), false);
});

// -------------------------------------------------------------------------------------------
// Full mechanism, end to end, against a throwaway git fixture (never the real repo tree)
// -------------------------------------------------------------------------------------------

test('dry-run: full mechanism — 5 records written in role order, chain-linked, TESTKEY-signed, schema-valid, and validated in sequence, ending in the expected FR-6 terminal state', async () => {
  const fixtureModuleId = 'dryrun_mechanism_v1';
  const fixture = await makeDryRunFixture(fixtureModuleId);
  try {
    const schema = await loadSchema();
    const code = await runDryRun({ module: fixtureModuleId, root: fixture.dir });
    assert.equal(code, EXIT_OK);

    const records = await listModuleReviewRecords(fixture.dir, fixtureModuleId);
    assert.equal(records.length, 5);
    assert.deepEqual(records.map((r) => r.role), REVIEW_ROLES);

    const subjectHashes = new Set(records.map((r) => r.record.subjectContentHash));
    assert.equal(subjectHashes.size, 1, 'all five records must share one subjectContentHash');

    for (const entry of records) {
      const errors = validateAgainstSchema(schema, entry.record);
      assert.deepEqual(errors, [], `role ${entry.role}: ${JSON.stringify(errors)}`);
      assert.equal(entry.record.synthetic, true);
      assert.equal(entry.record.decision, 'approve');
      const sigResult = verifyRecordSignature(entry.record);
      assert.equal(sigResult.ok, true, `role ${entry.role} signature must verify: ${sigResult.reason}`);
      assert.match(entry.record.signature.keyId, /^TESTKEY-/);
    }

    const chainReport = checkModuleChainLinkage(records);
    assert.ok(chainReport.every((link) => link.ok), `expected a clean chain: ${JSON.stringify(chainReport)}`);

    const c1 = records.find((r) => r.role === 'clinical-1').record;
    const c2 = records.find((r) => r.role === 'clinical-2').record;
    assert.deepEqual(checkReviewerIndependence(c1, c2), []);

    // Terminal validate() over the finished set reproduces the same expected, structural FR-6
    // non-qualifying finding dry-run itself already tolerated mid-run.
    await assert.rejects(
      () => runValidate({ module: fixtureModuleId, root: fixture.dir }),
      (err) => {
        assert.ok(err instanceof ValidationFailedError);
        assert.equal(isExpectedTerminalNonQualifyingViolations(err.violations), true, JSON.stringify(err.violations));
        return true;
      },
    );
  } finally {
    await cleanup(fixture.dir);
  }
});

test('dry-run refuses (fails closed) to re-run over a module that already has committed records — append-only, never a re-run', async () => {
  const fixtureModuleId = 'dryrun_rerun_guard_v1';
  const fixture = await makeDryRunFixture(fixtureModuleId);
  try {
    await runDryRun({ module: fixtureModuleId, root: fixture.dir });
    const before = await listModuleReviewRecords(fixture.dir, fixtureModuleId);
    assert.equal(before.length, 5);

    await assert.rejects(() => runDryRun({ module: fixtureModuleId, root: fixture.dir }), UsageError);

    const after = await listModuleReviewRecords(fixture.dir, fixtureModuleId);
    assert.equal(after.length, 5, 're-run must never add, overwrite, or remove records');
    assert.deepEqual(after, before, 'the existing 5 records must be byte-for-byte untouched by the refused re-run');
  } finally {
    await cleanup(fixture.dir);
  }
});

test('dry-run fails closed when a persona reviewerId is not on the target module\'s roster (out-of-scope / unknown)', async () => {
  const fixtureModuleId = 'dryrun_no_roster_v1';
  const fixture = await makeGitFixture();
  await fixture.commitFile(
    `modules/${fixtureModuleId}/module.json`,
    `{"id":"${fixtureModuleId}"}\n`,
    'Fixture Author',
    'fixture-author@example.test',
    'add module.json (no matching roster entries)',
  );
  try {
    await assert.rejects(() => runDryRun({ module: fixtureModuleId, root: fixture.dir }), UsageError);
    const records = await listModuleReviewRecords(fixture.dir, fixtureModuleId);
    assert.deepEqual(records, [], 'nothing should be written when the first role fails to resolve');
  } finally {
    await cleanup(fixture.dir);
  }
});

test('dry-run accepts an explicit --subject and rejects a malformed one', async () => {
  const fixtureModuleId = 'dryrun_explicit_subject_v1';
  const fixture = await makeDryRunFixture(fixtureModuleId);
  try {
    const explicitSubject = `sha256:${'ab'.repeat(32)}`;
    await runDryRun({ module: fixtureModuleId, root: fixture.dir, subject: explicitSubject });
    const records = await listModuleReviewRecords(fixture.dir, fixtureModuleId);
    assert.ok(records.every((r) => r.record.subjectContentHash === explicitSubject));
  } finally {
    await cleanup(fixture.dir);
  }

  const badFixture = await makeDryRunFixture('dryrun_bad_subject_v1');
  try {
    await assert.rejects(
      () => runDryRun({ module: 'dryrun_bad_subject_v1', root: badFixture.dir, subject: 'not-a-hash' }),
      UsageError,
    );
  } finally {
    await cleanup(badFixture.dir);
  }
});

test('dry-run defaults --module to cbc_suite_v1 when omitted', () => {
  assert.equal(DEFAULT_DRY_RUN_MODULE_ID, 'cbc_suite_v1');
});

test('dry-run makes zero network calls at runtime (patched global fetch throws if invoked)', async () => {
  const fixtureModuleId = 'dryrun_no_network_v1';
  const fixture = await makeDryRunFixture(fixtureModuleId);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network call attempted during a dry-run invocation');
  };
  try {
    await assert.doesNotReject(() => runDryRun({ module: fixtureModuleId, root: fixture.dir }));
  } finally {
    globalThis.fetch = originalFetch;
    await cleanup(fixture.dir);
  }
});

// -------------------------------------------------------------------------------------------
// The REAL, already-committed modules/cbc_suite_v1/reviews/ artifact (this task's own output) —
// static structural assertions only, never a second live dry-run against the real repo tree.
// -------------------------------------------------------------------------------------------

test('the real modules/cbc_suite_v1/reviews/ carries exactly the 5 expected roles, in role order, all synthetic:true with non-qualifying rationale language', async () => {
  const records = await listModuleReviewRecords(REPO_ROOT, 'cbc_suite_v1');
  assert.equal(records.length, 5);
  assert.deepEqual(records.map((r) => r.role), REVIEW_ROLES);
  for (const entry of records) {
    assert.equal(entry.record.synthetic, true, `${entry.reviewId} must be synthetic:true`);
    assert.match(entry.record.rationale, /SYNTHETIC|DRY-RUN/i, `${entry.reviewId} rationale must self-identify as synthetic/dry-run`);
    assert.match(entry.record.rationale, /NOT.{0,20}CREDENTIALED|NON-CREDENTIALED/i, `${entry.reviewId} rationale must self-identify as non-credentialed`);
    assert.equal(entry.record.decision, 'approve');
    assert.equal(entry.record.moduleId, 'cbc_suite_v1');
    assert.equal(entry.record.review_id, entry.reviewId);
  }
});

test('the real modules/cbc_suite_v1/reviews/ set: schema-valid, roster-resolved (real governance/reviewer-roster.yaml), chain-valid, signature-verified, independence-clean', async () => {
  const schema = await loadSchema();
  const records = await listModuleReviewRecords(REPO_ROOT, 'cbc_suite_v1');
  const rosterIndex = await loadRosterIndex(REPO_ROOT);

  for (const entry of records) {
    const errors = validateAgainstSchema(schema, entry.record);
    assert.deepEqual(errors, [], `${entry.reviewId}: ${JSON.stringify(errors)}`);

    const rosterEntry = resolveReviewer(rosterIndex, entry.record.reviewerId, 'cbc_suite_v1');
    assert.equal(rosterEntry.synthetic, true, `${entry.reviewId}'s roster entry must be synthetic:true`);

    const sigResult = verifyRecordSignature(entry.record);
    assert.equal(sigResult.ok, true, `${entry.reviewId} signature must verify: ${sigResult.reason}`);
  }

  const chainReport = checkModuleChainLinkage(records);
  assert.ok(chainReport.every((link) => link.ok), `expected a clean chain: ${JSON.stringify(chainReport)}`);

  const c1 = records.find((r) => r.role === 'clinical-1').record;
  const c2 = records.find((r) => r.role === 'clinical-2').record;
  assert.deepEqual(checkReviewerIndependence(c1, c2), []);
});

test('tools/review-record validate over the real committed cbc_suite_v1 set rejects with EXACTLY the expected, structural FR-6 non-qualifying finding — not clean, and not any other violation', async () => {
  await assert.rejects(
    () => runValidate({ module: 'cbc_suite_v1', root: REPO_ROOT }),
    (err) => {
      assert.ok(err instanceof ValidationFailedError);
      assert.equal(
        isExpectedTerminalNonQualifyingViolations(err.violations),
        true,
        `expected exactly the FR-6 synthetic-set violation, got: ${JSON.stringify(err.violations)}`,
      );
      return true;
    },
  );
});

test('scripts/validate-kb.mjs\'s validateModuleReviews (the exact function npm run validate calls) reports zero errors and 5 review records for the real cbc_suite_v1 tree', async () => {
  const moduleDir = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');
  const result = await validateModuleReviews(moduleDir, 'cbc_suite_v1', REPO_ROOT);
  assert.deepEqual(result.errors, [], `expected zero npm-run-validate errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.reviewCount, 5);
});

test('the real governance/reviewer-roster.yaml carries the 5 P2-T8 personas, each scoped only to cbc_suite_v1', async () => {
  const rosterIndex = await loadRosterIndex(REPO_ROOT);
  for (const role of REVIEW_ROLES) {
    const persona = DRY_RUN_PERSONAS[role];
    const entry = rosterIndex.get(persona.reviewerId);
    assert.ok(entry, `expected a real roster entry for "${persona.reviewerId}"`);
    assert.equal(entry.synthetic, true);
    assert.deepEqual(entry.moduleScopes, ['cbc_suite_v1']);
  }
  // Parsed-data check, not a raw-text grep: this file's own prose header legitimately DISCUSSES
  // `synthetic: false` (describing the G1 gate real entries would need) without ever SHIPPING one
  // — the real assertion is over the parsed reviewers[] array, matching every other roster-shape
  // test in this repo (tests/reviewer-roster-schema.test.mjs).
  assert.ok(
    [...rosterIndex.values()].every((entry) => entry.synthetic === true),
    'the real roster must still carry zero synthetic:false entries (FR-3 unchanged)',
  );
});

// -------------------------------------------------------------------------------------------
// Zero approver / clinicalApprovers fields anywhere — the AC's own "schema-proven" claim, checked
// both structurally (the schema itself has no such field) and textually (no committed record file
// contains that string) plus module.json's own unrelated, unmodified approvedBy: [].
// -------------------------------------------------------------------------------------------

test('the review-record schema has no approvedBy/clinicalApprovers property at all -- these fields cannot exist on ANY review-record document', async () => {
  const schema = await loadSchema();
  assert.equal('approvedBy' in schema.properties, false);
  assert.equal('clinicalApprovers' in schema.properties, false);
  assert.equal(schema.additionalProperties, false, 'additionalProperties: false makes a stray approvedBy/clinicalApprovers field a hard schema violation, not silently accepted');
});

test('none of the 5 real committed cbc_suite_v1 review-record files carry an approvedBy/clinicalApprovers FIELD (schema already forbids it structurally — this proves no record even attempts one)', async () => {
  // Field-key check (`^key:` at line start), not a bare substring grep: the release-auth
  // persona's own rationale PROSE honestly explains that this record can never "populate
  // approvedBy[]/clinicalApprovers[]" — that sentence legitimately contains those words without
  // the record carrying any such FIELD. A YAML-key-shaped regex distinguishes the two.
  const files = await readdir(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'reviews'));
  const fieldKeyPattern = /^\s*(approvedBy|clinicalApprovers)\s*:/m;
  for (const file of files.filter((f) => f.endsWith('.yaml'))) {
    const raw = await readFile(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'reviews', file), 'utf8');
    assert.doesNotMatch(raw, fieldKeyPattern, `${file} must not carry an approvedBy/clinicalApprovers field`);
    const record = (await listModuleReviewRecords(REPO_ROOT, 'cbc_suite_v1')).find((r) => `${r.reviewId}.yaml` === file).record;
    assert.equal('approvedBy' in record, false, `${file} parsed record must not have an approvedBy key`);
    assert.equal('clinicalApprovers' in record, false, `${file} parsed record must not have a clinicalApprovers key`);
  }
});

test('modules/cbc_suite_v1/module.json still carries approvedBy: [] -- untouched by this task', async () => {
  const manifest = JSON.parse(await readFile(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json'), 'utf8'));
  assert.deepEqual(manifest.approvedBy, []);
  assert.equal(manifest.status, 'unsigned-stub');
});

// -------------------------------------------------------------------------------------------
// Golden pin — the real committed files must byte-equal their frozen golden copies (guards
// against accidental future modification of this append-only history).
// -------------------------------------------------------------------------------------------

test('the real committed modules/cbc_suite_v1/reviews/*.yaml files byte-equal their golden pin copies', async () => {
  const goldenFiles = (await readdir(GOLDEN_DIR)).filter((f) => f.endsWith('.yaml')).sort();
  assert.equal(goldenFiles.length, 5);
  for (const file of goldenFiles) {
    const real = await readFile(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'reviews', file), 'utf8');
    const golden = await readFile(path.join(GOLDEN_DIR, file), 'utf8');
    assert.equal(real, golden, `${file} has drifted from its golden pin`);
  }
});

// -------------------------------------------------------------------------------------------
// Friction note — committed, non-empty, observations only (no portal recommendation).
// -------------------------------------------------------------------------------------------

test('the friction-observations note is committed, non-empty, and references FR-11/P2-T8/OQ-8', async () => {
  const raw = await readFile(FRICTION_NOTE_PATH, 'utf8');
  assert.ok(raw.trim().length > 0);
  assert.match(raw, /FR-11/);
  assert.match(raw, /P2-T8/);
  assert.match(raw, /OQ-8/);
});

test('the friction-observations note explicitly disclaims making a portal-promotion recommendation', async () => {
  const raw = await readFile(FRICTION_NOTE_PATH, 'utf8');
  assert.match(raw, /observations only/i);
  assert.match(raw, /no recommendation|does not (make|propose)|not this (plan|task)'?s to make/i);
  assert.doesNotMatch(raw, /\bwe recommend\b/i, 'must not itself recommend building a portal');
  assert.doesNotMatch(raw, /\byou should build\b/i, 'must not itself recommend building a portal');
});
