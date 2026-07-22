// tests/ef-retro-e0-adapter.test.mjs -- P4-T8 (Evidence Foundry E1 Phase 4, FR-26, PRD OQ-6).
//
// Proves this task's own acceptance criteria (phase-2-4-workstreams.md P4-T8 row):
//   1. Adapter output validates against the P4-T1 fixture-corpus schema.
//   2. Byte-level content equality with the E0 source case is proven (envelope-only diff): the
//      generated case's `input` is exactly what tests/ef-cbc_suite_v1-dangerous-miss.test.mjs's own
//      dangerousMissInput() literal says -- nothing added, removed, or reshaped.
//   3. A stability test pins the adapter's committed output bytes.
//   4. That stability test FAILS to reproduce the pinned bytes when the upstream E0 fixture has
//      drifted (seeded mutation) -- proving drift is caught, not silently absorbed.
//   5. The adapter's committed corpus fixture runs green through P4-T3's replay runner (the
//      "regression lane"), producing exactly the marrow-red-flag alert + benign-differential
//      candidate co-occurrence the E0 test itself asserts.
//
// This file does NOT `import()` tests/ef-cbc_suite_v1-dangerous-miss.test.mjs -- see
// tools/retro-validate/lib/adapters/e0-dangerous-miss-cbc-suite.mjs's own header for why (a plain
// import of a node:test file executes its top-level test() registrations as a side effect).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { checkFixtures } from '../tools/retro-validate/lib/boundary.mjs';
import { loadFixtureCorpusSchema } from '../tools/retro-validate/lib/corpus.mjs';
import { resolveCandidate, replayCorpus } from '../tools/retro-validate/lib/replay.mjs';
import {
  buildE0DangerousMissCorpus,
  loadE0DangerousMissFixture,
  canonicalCorpusBytes,
  AdapterExtractionError,
  E0_SOURCE_PATH,
  ADAPTER_CORPUS_DIR,
  ADAPTER_CORPUS_ID,
  ADAPTER_CASE_ID,
} from '../tools/retro-validate/lib/adapters/e0-dangerous-miss-cbc-suite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADAPTER_SOURCE_PATH = path.join(
  REPO_ROOT, 'tools', 'retro-validate', 'lib', 'adapters', 'e0-dangerous-miss-cbc-suite.mjs',
);
const COMMITTED_CORPUS_PATH = path.join(ADAPTER_CORPUS_DIR, 'corpus.json');
const REGRESSION_LANE_REGISTRY_PATH = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'ef-retro', 'registries', 'e0-dangerous-miss-cbc-suite-v1', 'registry.json',
);
const REGRESSION_LANE_DIGEST = 'sha256:f1a885677a377bd31cf91ab4f55be096599a6812a27a234ef07a52dbda975975';

// Golden, hand-pinned copy of tests/ef-cbc_suite_v1-dangerous-miss.test.mjs's own
// dangerousMissInput() literal, AS OF this task's authoring -- the "envelope-only diff" proof (AC
// #2) compares the adapter's extracted `input` against this constant. This is deliberately NOT
// itself the adapter's source of truth (the adapter always re-derives from the live E0 file, never
// from this constant) -- it exists purely so a future edit to the E0 literal that the adapter
// faithfully picks up shows up here as a FAILING assertion, which is exactly the "drift is caught"
// contract: keeping this constant in sync with tests/ef-cbc_suite_v1-dangerous-miss.test.mjs is a
// deliberate, reviewable act a human takes when the E0 fixture intentionally changes.
const GOLDEN_E0_INPUT = {
  patient: { ageMonths: 24, sexAtBirth: 'male' },
  cbc: {
    hemoglobin: 9.5,
    localFlags: { neutropenia: true },
  },
};
const GOLDEN_ALERT_ID = 'CBC-MARROW-REDFLAG-001';
const GOLDEN_CANDIDATE_ID = 'benign-ethnic-neutropenia-differential-pattern';

let tmpDir;

test.after(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

async function writeTmpVariant(transform) {
  if (!tmpDir) tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ef-retro-e0-adapter-test-'));
  const source = await readFile(E0_SOURCE_PATH, 'utf8');
  const mutated = transform(source);
  assert.notEqual(mutated, source, 'test bug: transform must actually change the source it is given');
  const outPath = path.join(tmpDir, `variant-${Math.random().toString(36).slice(2)}.mjs`);
  await writeFile(outPath, mutated, 'utf8');
  return outPath;
}

test('adapter extracts the E0 dangerousMissInput() literal byte-for-byte (envelope-only diff, AC #2)', async () => {
  const { input, alertId, candidateId } = await loadE0DangerousMissFixture();
  assert.deepStrictEqual(
    input,
    GOLDEN_E0_INPUT,
    'the adapter\'s extracted clinical input must be an exact structural match for the E0 source\'s '
      + 'own dangerousMissInput() literal -- any difference here means either the adapter mutated '
      + 'content it must not, or the E0 fixture has changed and this golden constant needs a '
      + 'deliberate, reviewed update',
  );
  assert.equal(alertId, GOLDEN_ALERT_ID);
  assert.equal(candidateId, GOLDEN_CANDIDATE_ID);
});

test('adapter output corpus validates against the P4-T1 fixture-corpus schema (AC #1)', async () => {
  const corpus = await buildE0DangerousMissCorpus();
  const schema = await loadFixtureCorpusSchema();
  const errors = validate(schema, corpus);
  assert.deepStrictEqual(errors, [], 'freshly built adapter output must pass schemas/fixture-corpus.schema.json with zero violations');

  assert.equal(corpus.corpusId, ADAPTER_CORPUS_ID);
  assert.equal(corpus.sourceAttestation.provenanceClass, 'synthetic');
  assert.equal(corpus.cases.length, 1);
  assert.equal(corpus.cases[0].caseId, ADAPTER_CASE_ID);
  assert.equal(corpus.cases[0].provenance, 'synthetic', 'PRD OQ-6 requires provenance "synthetic" for the E0 adapter output');
});

test('the committed fixture at tests/fixtures/ef-retro/e0-dangerous-miss-cbc-suite-v1/ also passes the real boundary gate', async () => {
  const summary = await checkFixtures(ADAPTER_CORPUS_DIR);
  assert.equal(summary.corpusId, ADAPTER_CORPUS_ID);
  assert.equal(summary.caseCount, 1);
  assert.equal(summary.provenanceClass, 'synthetic');
});

test('adapter output bytes are deterministic across repeated builds', async () => {
  const first = canonicalCorpusBytes(await buildE0DangerousMissCorpus());
  const second = canonicalCorpusBytes(await buildE0DangerousMissCorpus());
  assert.equal(first, second, 'two builds over the same, unchanged E0 source must produce byte-identical output');
});

test('stability test pins the committed corpus.json bytes to what the adapter builds today (AC #3)', async () => {
  const freshBytes = canonicalCorpusBytes(await buildE0DangerousMissCorpus());
  const committedBytes = await readFile(COMMITTED_CORPUS_PATH, 'utf8');
  assert.equal(
    freshBytes,
    committedBytes,
    'the committed fixture at tests/fixtures/ef-retro/e0-dangerous-miss-cbc-suite-v1/corpus.json has '
      + 'drifted from what re-running the adapter against the live E0 source produces -- regenerate it '
      + 'with `node tools/retro-validate/lib/adapters/e0-dangerous-miss-cbc-suite.mjs` and review the '
      + 'diff (this is the intended, human-reviewed path for an upstream E0 fixture change)',
  );

  const committedHash = `sha256:${createHash('sha256').update(committedBytes, 'utf8').digest('hex')}`;
  assert.equal(
    committedHash,
    'sha256:11eb2afbc3c82ac35007f066f54018dd234f2e8d8e4d7d103e5145e9489dfae4',
    'the committed corpus.json bytes no longer match this test\'s own pinned hash -- either the file '
      + 'was regenerated (update this constant deliberately alongside that change) or it was hand-edited '
      + 'out of band (regenerate it via the adapter instead)',
  );
});

test('stability test FAILS to reproduce the pinned bytes when the upstream E0 fixture has drifted (AC #4)', async () => {
  const driftedPath = await writeTmpVariant((source) => source.replace('hemoglobin: 9.5,', 'hemoglobin: 8.0,'));

  const driftedCorpus = await buildE0DangerousMissCorpus({ sourcePath: driftedPath });
  assert.equal(
    driftedCorpus.cases[0].input.cbc.hemoglobin,
    8.0,
    'sanity check: the seeded mutation must actually reach the extracted input',
  );

  const driftedBytes = canonicalCorpusBytes(driftedCorpus);
  const committedBytes = await readFile(COMMITTED_CORPUS_PATH, 'utf8');
  assert.notEqual(
    driftedBytes,
    committedBytes,
    'a corpus built from a DRIFTED E0 source must NOT byte-match the committed, pinned fixture -- if '
      + 'it did, this adapter would be silently absorbing upstream drift instead of catching it',
  );
});

test('extraction fails closed when dangerousMissInput() cannot be located (seeded upstream refactor)', async () => {
  const renamedPath = await writeTmpVariant((source) => source.replace(
    'function dangerousMissInput() {',
    'function renamedDangerousMissInput() {',
  ));
  await assert.rejects(
    () => loadE0DangerousMissFixture({ sourcePath: renamedPath }),
    (err) => {
      assert.ok(err instanceof AdapterExtractionError);
      assert.match(err.message, /could not locate "function dangerousMissInput\(\) \{"/);
      return true;
    },
  );
});

test('extraction fails closed when the expected alert-id assertion pattern is missing', async () => {
  const mutatedPath = await writeTmpVariant((source) => source.replace(
    "result.alerts.find((entry) => entry.id === 'CBC-MARROW-REDFLAG-001')",
    "result.alerts.find((entry) => entry.somethingElse === 'CBC-MARROW-REDFLAG-001')",
  ));
  await assert.rejects(
    () => loadE0DangerousMissFixture({ sourcePath: mutatedPath }),
    (err) => {
      assert.ok(err instanceof AdapterExtractionError);
      assert.match(err.message, /alerts\.find/);
      return true;
    },
  );
});

test('extraction fails closed when the expected candidate-id assertion pattern is missing', async () => {
  const mutatedPath = await writeTmpVariant((source) => source.replace(
    "(entry) => entry.id === 'benign-ethnic-neutropenia-differential-pattern',",
    "(entry) => entry.somethingElse === 'benign-ethnic-neutropenia-differential-pattern',",
  ));
  await assert.rejects(
    () => loadE0DangerousMissFixture({ sourcePath: mutatedPath }),
    (err) => {
      assert.ok(err instanceof AdapterExtractionError);
      assert.match(err.message, /rankedDifferential\.find/);
      return true;
    },
  );
});

test('regression lane: the committed adapter corpus runs green through P4-T3\'s replay runner (AC #5)', async () => {
  await checkFixtures(ADAPTER_CORPUS_DIR); // the boundary gate every verb calls first

  const candidate = await resolveCandidate({
    registryPath: REGRESSION_LANE_REGISTRY_PATH,
    candidateDigest: REGRESSION_LANE_DIGEST,
  });
  assert.equal(candidate.moduleId, 'cbc_suite_v1');

  const { parsed: corpusDoc } = await import('../tools/retro-validate/lib/corpus.mjs')
    .then((m) => m.loadCorpusDocument(ADAPTER_CORPUS_DIR));
  const document = replayCorpus({ corpusDoc, candidate });

  assert.equal(document.caseCount, 1);
  const [caseResult] = document.cases;
  assert.equal(caseResult.caseId, ADAPTER_CASE_ID);

  const alert = caseResult.output.alerts.find((entry) => entry.id === GOLDEN_ALERT_ID);
  assert.ok(alert, 'the marrow-red-flag alert must fire when replaying the adapter\'s promoted corpus');
  assert.equal(alert.severity, 'urgent');

  const candidateEntry = caseResult.output.rankedDifferential.find((entry) => entry.id === GOLDEN_CANDIDATE_ID);
  assert.ok(candidateEntry, 'the benign-differential candidate must remain visible alongside the alert (never suppressed)');

  assert.deepStrictEqual(
    caseResult.referenceLabels.safetyFlagIds,
    [GOLDEN_ALERT_ID],
    'reference labels must name the same alert id the replay actually produced',
  );
  assert.deepStrictEqual(
    caseResult.referenceLabels.candidatePatternIds,
    [GOLDEN_CANDIDATE_ID],
    'reference labels must name the same candidate id the replay actually produced',
  );
  assert.equal(caseResult.referenceLabels.dangerousMissExpected, true);
});

test('the adapter module makes zero network calls (structural check)', async () => {
  const source = await readFile(ADAPTER_SOURCE_PATH, 'utf8');
  for (const forbidden of ['node:http', 'node:https', 'node:dgram', 'fetch(']) {
    assert.ok(
      !source.includes(forbidden),
      `tools/retro-validate/lib/adapters/e0-dangerous-miss-cbc-suite.mjs must not reference "${forbidden}"`,
    );
  }
});
