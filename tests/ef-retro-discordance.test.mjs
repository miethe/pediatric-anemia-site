// tests/ef-retro-discordance.test.mjs -- P4-T5 (Evidence Foundry E1 Phase 4, FR-23, PRD OQ-5).
//
// Proves this task's own acceptance criteria
// (docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-2-4-workstreams.md,
// row P4-T5):
//   1. `computeDiscordanceRecords` emits one adjudication-ready discordance record per (labeled
//      case, disagreeing dimension) -- exercised against the ALREADY-ESTABLISHED P4-T4
//      `metrics-corpus` fixture (tests/ef-retro-metrics.test.mjs's own hand-derived expected
//      values are reused here as cross-checks, not re-derived independently).
//   2. Every emitted record validates against `schemas/discordance-record.schema.json`.
//   3. A seeded discordant corpus (the same metrics-corpus fixture) yields discordance records
//      that `tools/review-record scaffold --role adjudication` accepts as subject input --
//      integration test against the REAL `tools/review-record/lib/verbs/scaffold.mjs#run`.
//   4. The adjudicator-≠-author check reuses `tools/review-record/lib/adjudication.mjs`'s own PRD
//      OQ-5 authorship-union helper (import, not copy) -- proven both functionally and by a
//      source-level grep-test.
//   5. A missing-field discordance-record fixture is rejected by the schema (fail-closed).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DISAGREEMENT_CLASSES,
  DISCORDANCE_RECORD_SCHEMA_VERSION,
  DISCORDANCE_RECORD_SCHEMA_PATH,
  loadDiscordanceRecordSchema,
  validateDiscordanceRecord,
  computeDiscordanceRecords,
  buildDiscordanceRationale,
  toAdjudicationScaffoldInput,
  checkAdjudicatorNotAuthor,
} from '../tools/retro-validate/lib/discordance.mjs';
import { computeAgreementMeasures } from '../tools/retro-validate/lib/metrics.mjs';
import { resolveCandidate, replayCorpus } from '../tools/retro-validate/lib/replay.mjs';
import { loadCorpusDocument } from '../tools/retro-validate/lib/corpus.mjs';
import { run as runScaffold } from '../tools/review-record/lib/verbs/scaffold.mjs';
import { UsageError, EXIT_OK } from '../tools/review-record/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-retro');
const METRICS_CORPUS_DIR = path.join(FIXTURES_ROOT, 'metrics-corpus');
const VALID_REGISTRY_PATH = path.join(FIXTURES_ROOT, 'registries', 'valid', 'registry.json');
const VALID_DIGEST = 'sha256:ef1adfb4d4e2640812f9d1de363c68c979c9c159b60ede121376e1befbe7212c';
const DISCORDANCE_RECORDS_FIXTURES_DIR = path.join(FIXTURES_ROOT, 'discordance-records');
const SCAFFOLD_BRIDGE_FIXTURES_ROOT = path.join(FIXTURES_ROOT, 'discordance-adjudication-scaffold');
const DISCORDANCE_LIB_PATH = path.join(REPO_ROOT, 'tools', 'retro-validate', 'lib', 'discordance.mjs');

async function buildMetricsReplayDocument() {
  const { parsed: corpusDoc } = await loadCorpusDocument(METRICS_CORPUS_DIR);
  const candidate = await resolveCandidate({ registryPath: VALID_REGISTRY_PATH, candidateDigest: VALID_DIGEST });
  return replayCorpus({ corpusDoc, candidate });
}

async function readFixtureRecord(filename) {
  const raw = await readFile(path.join(DISCORDANCE_RECORDS_FIXTURES_DIR, filename), 'utf8');
  return JSON.parse(raw);
}

// -------------------------------------------------------------------------------------------
// Schema shape sanity.
// -------------------------------------------------------------------------------------------

test('loadDiscordanceRecordSchema loads a real JSON Schema document with the expected $id', async () => {
  const schema = await loadDiscordanceRecordSchema();
  assert.match(schema.$id, /discordance-record\.schema\.json$/);
  assert.deepEqual(schema.required.sort(), [
    'candidateDigest', 'caseRef', 'corpusId', 'disagreementClass', 'discordanceId',
    'engineOutputSet', 'moduleId', 'referenceLabelSet', 'schemaVersion',
  ]);
});

test('DISCORDANCE_RECORD_SCHEMA_PATH points at the tool-local schema file (not schemas/)', () => {
  assert.match(DISCORDANCE_RECORD_SCHEMA_PATH, /tools[\\/]retro-validate[\\/]schemas[\\/]discordance-record\.schema\.json$/);
});

test('the hand-built valid-record.json fixture is schema-valid (sanity: proves the missing-field fixtures below fail because of the field removed, not the base shape)', async () => {
  const record = await readFixtureRecord('valid-record.json');
  const errors = await validateDiscordanceRecord(record);
  assert.deepEqual(errors, []);
});

// -------------------------------------------------------------------------------------------
// AC 5: missing-field fixtures rejected, fail-closed.
// -------------------------------------------------------------------------------------------

for (const [filename, missingField] of [
  ['missing-caseRef.json', 'caseRef'],
  ['missing-candidateDigest.json', 'candidateDigest'],
  ['missing-disagreementClass.json', 'disagreementClass'],
  ['missing-engineOutputSet.json', 'engineOutputSet'],
  ['missing-referenceLabelSet.json', 'referenceLabelSet'],
]) {
  test(`validateDiscordanceRecord rejects a record missing "${missingField}" (${filename})`, async () => {
    const record = await readFixtureRecord(filename);
    const errors = await validateDiscordanceRecord(record);
    assert.ok(errors.length > 0, `expected at least one validation error for a record missing "${missingField}"`);
    assert.ok(
      errors.some((e) => e.path.endsWith(`.${missingField}`) && e.message === 'required property is missing'),
      `expected a "required property is missing" error at .${missingField}, got: ${JSON.stringify(errors)}`,
    );
  });
}

test('validateDiscordanceRecord rejects an unknown additional property (closed shape, additionalProperties:false)', async () => {
  const record = await readFixtureRecord('valid-record.json');
  const errors = await validateDiscordanceRecord({ ...record, patientName: 'should never be here' });
  assert.ok(errors.some((e) => e.path.endsWith('.patientName')));
});

test('validateDiscordanceRecord rejects an invalid disagreementClass value', async () => {
  const record = await readFixtureRecord('valid-record.json');
  const errors = await validateDiscordanceRecord({ ...record, disagreementClass: 'not-a-real-class' });
  assert.ok(errors.length > 0);
});

test('validateDiscordanceRecord rejects a candidateDigest not matching sha256:<64 hex>', async () => {
  const record = await readFixtureRecord('valid-record.json');
  const errors = await validateDiscordanceRecord({ ...record, candidateDigest: 'not-a-digest' });
  assert.ok(errors.length > 0);
});

// -------------------------------------------------------------------------------------------
// AC 1/2: computeDiscordanceRecords over the P4-T4 metrics-corpus fixture -- cross-checked
// against tests/ef-retro-metrics.test.mjs's already-established, hand-derived measure values
// (this file does not independently re-derive the engine's own per-case output).
// -------------------------------------------------------------------------------------------

test('computeDiscordanceRecords: metrics-corpus fixture -- every record is schema-valid, and record counts per class cross-check against computeAgreementMeasures\'s own hand-derived values', async () => {
  const replayDocument = await buildMetricsReplayDocument();
  const measures = computeAgreementMeasures(replayDocument);
  const records = computeDiscordanceRecords(replayDocument);

  assert.ok(records.length > 0, 'expected at least one discordance record from a deliberately-discordant fixture');

  for (const record of records) {
    const errors = await validateDiscordanceRecord(record);
    assert.deepEqual(errors, [], `record ${record.discordanceId} failed schema validation: ${JSON.stringify(errors)}`);
    assert.equal(record.schemaVersion, DISCORDANCE_RECORD_SCHEMA_VERSION);
    assert.equal(record.corpusId, replayDocument.corpusId);
    assert.equal(record.moduleId, replayDocument.candidate.moduleId);
    assert.equal(record.candidateDigest, replayDocument.candidate.packDigest);
    assert.ok(DISAGREEMENT_CLASSES.includes(record.disagreementClass));
  }

  // Cross-check 1: per-candidate-pattern disagree count (any pattern id) equals the number of
  // candidate-pattern-mismatch records (metrics-corpus names exactly one pattern id total).
  const totalPatternDisagree = Object.values(measures.perCandidatePatternAgreement.byPatternId)
    .reduce((sum, entry) => sum + entry.disagree, 0);
  const candidateMismatchRecords = records.filter((r) => r.disagreementClass === 'candidate-pattern-mismatch');
  assert.equal(candidateMismatchRecords.length, totalPatternDisagree);

  // Cross-check 2: dangerous-miss-discordance record count equals dangerousMissDiscordanceCount.discordantCount.
  const dangerousMissRecords = records.filter((r) => r.disagreementClass === 'dangerous-miss-discordance');
  assert.equal(dangerousMissRecords.length, measures.dangerousMissDiscordanceCount.discordantCount);

  // Cross-check 3: every case NOT counted in caseLevelExactAgreementRate.agreeCount contributes at
  // least one non-dangerous-miss discordance record (candidate/safety-flag/missing-data-prompt),
  // and every case that IS counted in agreeCount contributes NONE of those three classes (it may
  // still contribute a dangerous-miss-discordance record -- that is a 4th, independent dimension).
  const threeSetClasses = ['candidate-pattern-mismatch', 'safety-flag-mismatch', 'missing-data-prompt-mismatch'];
  const casesWithThreeSetMismatch = new Set(
    records.filter((r) => threeSetClasses.includes(r.disagreementClass)).map((r) => r.caseRef),
  );
  const labeledCaseIds = replayDocument.cases.filter((c) => c.referenceLabels != null).map((c) => c.caseId);
  const disagreeingCaseCount = labeledCaseIds.length - measures.caseLevelExactAgreementRate.agreeCount;
  assert.equal(casesWithThreeSetMismatch.size, disagreeingCaseCount);
});

test('computeDiscordanceRecords: an unlabeled case never emits a discordance record', async () => {
  const replayDocument = await buildMetricsReplayDocument();
  const records = computeDiscordanceRecords(replayDocument);
  const unlabeledCaseIds = new Set(
    replayDocument.cases.filter((c) => c.referenceLabels == null).map((c) => c.caseId),
  );
  assert.ok(unlabeledCaseIds.size > 0, 'sanity: metrics-corpus really does have an unlabeled case');
  for (const record of records) {
    assert.ok(!unlabeledCaseIds.has(record.caseRef), `unlabeled case "${record.caseRef}" must never emit a discordance record`);
  }
});

test('computeDiscordanceRecords: a fully-agreeing replay document (hand-built) emits zero records', () => {
  const replayDocument = {
    corpusId: 'hand-built-agree-fixture',
    candidate: { moduleId: 'anemia', packDigest: `sha256:${'a'.repeat(64)}` },
    cases: [
      {
        caseId: 'agree-1',
        referenceLabels: { candidatePatternIds: ['p1'], safetyFlagIds: [], missingDataPromptIds: [], dangerousMissExpected: false },
        output: { rankedDifferential: [{ id: 'p1' }], alerts: [], nextQuestions: [] },
      },
    ],
  };
  assert.deepEqual(computeDiscordanceRecords(replayDocument), []);
});

test('computeDiscordanceRecords: discordanceId is deterministic (same inputs -> same id, no randomness/timestamp)', () => {
  const replayDocument = {
    corpusId: 'det-fixture',
    candidate: { moduleId: 'anemia', packDigest: `sha256:${'b'.repeat(64)}` },
    cases: [
      {
        caseId: 'case-x',
        referenceLabels: { candidatePatternIds: ['p1'], safetyFlagIds: [], missingDataPromptIds: [], dangerousMissExpected: false },
        output: { rankedDifferential: [], alerts: [], nextQuestions: [] },
      },
    ],
  };
  const first = computeDiscordanceRecords(replayDocument);
  const second = computeDiscordanceRecords(replayDocument);
  assert.deepEqual(first, second);
  assert.equal(first[0].discordanceId, 'det-fixture__case-x__candidate-pattern-mismatch');
});

// -------------------------------------------------------------------------------------------
// AC 3: "structurally consumable by Workstream A" -- discordance records feed
// tools/review-record's REAL scaffold --role adjudication verb without it rejecting them.
// -------------------------------------------------------------------------------------------

test('toAdjudicationScaffoldInput requires a human-supplied reviewerId and decision (never derived from the record itself)', async () => {
  const replayDocument = await buildMetricsReplayDocument();
  const [record] = computeDiscordanceRecords(replayDocument);
  assert.throws(() => toAdjudicationScaffoldInput(record, { decision: 'request-changes' }), TypeError);
  assert.throws(() => toAdjudicationScaffoldInput(record, { reviewerId: 'synthetic-discordance-adjudicator' }), TypeError);
});

test('toAdjudicationScaffoldInput maps a discordance record onto the exact scaffold(--role adjudication) options shape', async () => {
  const replayDocument = await buildMetricsReplayDocument();
  const [record] = computeDiscordanceRecords(replayDocument);
  const options = toAdjudicationScaffoldInput(record, {
    reviewerId: 'synthetic-discordance-adjudicator',
    decision: 'request-changes',
    root: SCAFFOLD_BRIDGE_FIXTURES_ROOT,
  });
  assert.equal(options.module, record.moduleId);
  assert.equal(options.role, 'adjudication');
  assert.equal(options.subject, record.candidateDigest);
  assert.match(options.subject, /^sha256:[0-9a-f]{64}$/);
  assert.equal(options.reviewerId, 'synthetic-discordance-adjudicator');
  assert.equal(options.decision, 'request-changes');
  assert.match(options.rationale, new RegExp(record.discordanceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(options.root, SCAFFOLD_BRIDGE_FIXTURES_ROOT);
});

test('INTEGRATION: every discordance record from the metrics-corpus fixture is accepted by the REAL tools/review-record scaffold --role adjudication verb', async () => {
  const replayDocument = await buildMetricsReplayDocument();
  const records = computeDiscordanceRecords(replayDocument);
  assert.ok(records.length > 0, 'sanity: expected at least one discordance record to feed into scaffold');

  for (const record of records) {
    const options = toAdjudicationScaffoldInput(record, {
      reviewerId: 'synthetic-discordance-adjudicator',
      decision: 'request-changes',
      reviewedAt: '2026-07-22T00:00:00Z',
      root: SCAFFOLD_BRIDGE_FIXTURES_ROOT,
    });
    const code = await runScaffold(options);
    assert.equal(code, EXIT_OK, `scaffold rejected discordance record ${record.discordanceId}`);
  }
});

test('INTEGRATION: a discordance record whose moduleId is NOT in the adjudicator\'s roster scope still fails closed via scaffold\'s OWN roster check (not silently accepted)', async () => {
  const replayDocument = await buildMetricsReplayDocument();
  const [record] = computeDiscordanceRecords(replayDocument);
  const options = toAdjudicationScaffoldInput({ ...record, moduleId: 'a-module-not-in-scope' }, {
    reviewerId: 'synthetic-discordance-adjudicator',
    decision: 'request-changes',
    root: SCAFFOLD_BRIDGE_FIXTURES_ROOT,
  });
  await assert.rejects(() => runScaffold(options), UsageError);
});

// -------------------------------------------------------------------------------------------
// AC 4: adjudicator-≠-author reuse -- functional proof + source-level grep-test that the
// authorship-union logic is IMPORTED, never re-implemented.
// -------------------------------------------------------------------------------------------

test('checkAdjudicatorNotAuthor reuses tools/review-record/lib/adjudication.mjs#computeAuthorshipUnion (functional proof: a synthetic fixture persona is not in the "anemia" module\'s real authorship union)', () => {
  const result = checkAdjudicatorNotAuthor({
    rootDir: REPO_ROOT,
    moduleId: 'anemia',
    rosterEntry: { name: 'SYNTHETIC -- NOT A CREDENTIALED REVIEWER (P4-T5 discordance-adjudication-bridge fixture persona)' },
  });
  assert.equal(result.eligible, true);
  assert.ok(Array.isArray(result.authorshipUnion.authors));
  assert.deepEqual(result.authorshipUnion.sources.slice().sort(), ['authoring-decisions', 'git-commit-author']);
});

test('checkAdjudicatorNotAuthor: an author-matching name is excluded (eligible:false) -- derived from the module\'s OWN real authorship union, never a hard-coded committer name', () => {
  const union = checkAdjudicatorNotAuthor({
    rootDir: REPO_ROOT,
    moduleId: 'anemia',
    rosterEntry: { name: 'irrelevant, only computing the union here' },
  }).authorshipUnion;
  assert.ok(union.authors.length > 0, 'sanity: modules/anemia/module.json has real git-committed history to derive an authorship union from');

  const [firstAuthorIdentity] = union.authors;
  const authorName = firstAuthorIdentity.split('<')[0].trim();
  const result = checkAdjudicatorNotAuthor({
    rootDir: REPO_ROOT,
    moduleId: 'anemia',
    rosterEntry: { name: authorName },
  });
  assert.equal(result.eligible, false);
  assert.match(result.reason, /authorship union/);
});

test('GREP: tools/retro-validate/lib/discordance.mjs imports the authorship-union helper from tools/review-record -- it does not re-implement git-log-based authorship logic itself', async () => {
  const source = await readFile(DISCORDANCE_LIB_PATH, 'utf8');

  // Imported, not copied:
  assert.match(source, /from ['"]\.\.\/\.\.\/review-record\/lib\/adjudication\.mjs['"]/);
  assert.match(source, /computeAuthorshipUnion/);
  assert.match(source, /rosterEntryInAuthorshipUnion/);

  // No re-implementation: this file must never itself shell out to git or redefine the
  // authorship-source-kind constants tools/review-record/lib/adjudication.mjs owns.
  assert.doesNotMatch(source, /execFileSync/);
  assert.doesNotMatch(source, /node:child_process/);
  assert.doesNotMatch(source, /AUTHORSHIP_SOURCE_GIT_COMMIT_AUTHOR\s*=/);
  assert.doesNotMatch(source, /--diff-filter/);
});

// -------------------------------------------------------------------------------------------
// buildDiscordanceRationale -- deterministic, structural-only prose (no invented clinical claim).
// -------------------------------------------------------------------------------------------

test('buildDiscordanceRationale is deterministic and contains no invented clinical-validity claim', async () => {
  const replayDocument = await buildMetricsReplayDocument();
  const [record] = computeDiscordanceRecords(replayDocument);
  const a = buildDiscordanceRationale(record);
  const b = buildDiscordanceRationale(record);
  assert.equal(a, b);
  assert.match(a, new RegExp(record.discordanceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(a, /SOFTWARE-AGREEMENT/);
  assert.doesNotMatch(a, /sensitivity|specificity|clinical performance/i);
});

// -------------------------------------------------------------------------------------------
// Zero network / zero LLM (same two-layer proof this tool's other test files establish).
// -------------------------------------------------------------------------------------------

test('discordance.mjs imports no network or generative-model API (static)', async () => {
  const source = await readFile(DISCORDANCE_LIB_PATH, 'utf8');
  const forbidden = [
    /node:http\b/, /node:https\b/, /node:dgram\b/, /\bfetch\(/, /XMLHttpRequest/, /WebSocket/,
    /@anthropic-ai/, /\bopenai\b/i, /google-generativeai/i,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern, `discordance.mjs matches forbidden pattern ${pattern}`);
  }
});

test('computeDiscordanceRecords makes zero network calls at runtime (patched global fetch throws if invoked)', async () => {
  const replayDocument = await buildMetricsReplayDocument();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network call attempted during computeDiscordanceRecords');
  };
  try {
    assert.doesNotThrow(() => computeDiscordanceRecords(replayDocument));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
