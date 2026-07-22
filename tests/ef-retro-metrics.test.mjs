// tests/ef-retro-metrics.test.mjs -- P4-T4 (Evidence Foundry E1 Phase 4, FR-21, OQ-5, ADR-0006).
//
// Proves this task's own acceptance criteria (phase-4-progress.md / phase-2-4-workstreams.md
// P4-T4 row):
//   1. `report` emits `agreement-report.json` with EXACTLY the 5 OQ-5 measures (case-level exact-
//      agreement rate; per-candidate-pattern agreement/disagreement counts; dangerous-miss
//      discordance count; safety-flag agreement coverage; missing-data-prompt agreement rate),
//      each labeled `"software agreement"`.
//   2. Grep-test: the strings "sensitivity", "specificity", "clinical performance" appear nowhere
//      in report output except inside the explicit negation banner.
//   3. The report header carries the unvalidated-prototype banner and the FR-24 "non-qualifying --
//      protocol not prespecified by humans" banner -- unconditionally, regardless of whether/what
//      `--protocol` supplies.
//   4. `run-provenance.json` is complete (corpus id, harness version, candidate registry digest,
//      run timestamp) and is the SOLE timestamp location -- `agreement-report.json` carries none.
//   5. `agreement-report.json` bytes are deterministic: two `report` invocations over an identical
//      (corpus, run dir, protocol) triple produce byte-identical bytes.
//
// This file assumes tests/ef-retro-boundary.test.mjs's boundary-first/call-order contract and
// tests/ef-retro-determinism.test.mjs's candidate-resolution/replay contract already hold -- it
// focuses on what `report` does with an already-boundary-passed corpus and an already-replayed
// `replay-output.json` (this task's own scope).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeAgreementMeasures,
  isDangerousMissDiscordant,
  evaluateProtocolQualification,
  findPopulatedProtocolFields,
  buildAgreementReportDocument,
  buildRunProvenanceDocument,
  writeAgreementReport,
  writeRunProvenance,
  UNVALIDATED_PROTOTYPE_BANNER,
  SOFTWARE_AGREEMENT_NEGATION_BANNER,
  NON_QUALIFYING_PROTOCOL_BANNER,
  SOFTWARE_AGREEMENT_LABEL,
  AGREEMENT_REPORT_FILENAME,
  RUN_PROVENANCE_FILENAME,
} from '../tools/retro-validate/lib/metrics.mjs';
import {
  resolveCandidate,
  replayCorpus,
  writeReplayOutput,
  defaultOutputDir,
  canonicalStringify,
} from '../tools/retro-validate/lib/replay.mjs';
import { loadCorpusDocument } from '../tools/retro-validate/lib/corpus.mjs';
import { run as runReportVerb } from '../tools/retro-validate/lib/verbs/report.mjs';
import { UsageError, EXIT_OK, EXIT_USAGE } from '../tools/retro-validate/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RETRO_VALIDATE_ROOT = path.join(REPO_ROOT, 'tools', 'retro-validate');
const CLI_PATH = path.join(RETRO_VALIDATE_ROOT, 'cli.mjs');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-retro');

const METRICS_CORPUS_DIR = path.join(FIXTURES_ROOT, 'metrics-corpus');
const REPLAY_CORPUS_DIR = path.join(FIXTURES_ROOT, 'replay-corpus');
const VALID_REGISTRY_PATH = path.join(FIXTURES_ROOT, 'registries', 'valid', 'registry.json');
const VALID_DIGEST = 'sha256:ef1adfb4d4e2640812f9d1de363c68c979c9c159b60ede121376e1befbe7212c';

// Isolated tmp access log per this file, same pattern the other ef-retro-*.test.mjs files already
// established -- `npm test` must never mutate the tracked access-log.jsonl.
const ACCESS_LOG_TMP_DIR = await mkdtemp(path.join(os.tmpdir(), 'ef-retro-metrics-test-access-log-'));
const ACCESS_LOG_PATH = path.join(ACCESS_LOG_TMP_DIR, 'access-log.jsonl');

async function resolveValidCandidate() {
  return resolveCandidate({ registryPath: VALID_REGISTRY_PATH, candidateDigest: VALID_DIGEST });
}

async function buildReplayDocument(corpusDir) {
  const { parsed: corpusDoc } = await loadCorpusDocument(corpusDir);
  const candidate = await resolveValidCandidate();
  return replayCorpus({ corpusDoc, candidate });
}

// -------------------------------------------------------------------------------------------
// isDangerousMissDiscordant -- unit coverage of every branch (no referenceLabels; not expected;
// named-flags concordant/discordant; fallback with no named flags).
// -------------------------------------------------------------------------------------------

test('isDangerousMissDiscordant: a case with no referenceLabels is never discordant', () => {
  assert.equal(isDangerousMissDiscordant({ output: { alerts: [] } }), false);
});

test('isDangerousMissDiscordant: dangerousMissExpected:false is never discordant, regardless of alerts', () => {
  assert.equal(
    isDangerousMissDiscordant({ referenceLabels: { dangerousMissExpected: false, safetyFlagIds: ['X'] }, output: { alerts: [] } }),
    false,
  );
});

test('isDangerousMissDiscordant: named safetyFlagIds present among engine alerts -> concordant (false)', () => {
  assert.equal(
    isDangerousMissDiscordant({
      referenceLabels: { dangerousMissExpected: true, safetyFlagIds: ['ALERT-A'] },
      output: { alerts: [{ id: 'ALERT-A' }] },
    }),
    false,
  );
});

test('isDangerousMissDiscordant: named safetyFlagIds absent from engine alerts -> discordant (true)', () => {
  assert.equal(
    isDangerousMissDiscordant({
      referenceLabels: { dangerousMissExpected: true, safetyFlagIds: ['ALERT-A'] },
      output: { alerts: [{ id: 'ALERT-B' }] },
    }),
    true,
  );
});

test('isDangerousMissDiscordant: no named safetyFlagIds, engine emitted zero alerts -> discordant fallback (true)', () => {
  assert.equal(
    isDangerousMissDiscordant({
      referenceLabels: { dangerousMissExpected: true, safetyFlagIds: [] },
      output: { alerts: [] },
    }),
    true,
  );
});

test('isDangerousMissDiscordant: no named safetyFlagIds, engine emitted at least one alert -> concordant fallback (false)', () => {
  assert.equal(
    isDangerousMissDiscordant({
      referenceLabels: { dangerousMissExpected: true, safetyFlagIds: [] },
      output: { alerts: [{ id: 'ANY-ALERT' }] },
    }),
    false,
  );
});

// -------------------------------------------------------------------------------------------
// computeAgreementMeasures -- edge-case unit coverage on hand-built replay documents (zero
// denominators must yield `null` rates, never NaN/division-by-zero).
// -------------------------------------------------------------------------------------------

test('computeAgreementMeasures: an all-unlabeled corpus yields null rates and zero counts, never NaN', () => {
  const doc = {
    cases: [
      { caseId: 'c1', output: { rankedDifferential: [], alerts: [], nextQuestions: [] } },
      { caseId: 'c2', referenceLabels: null, output: { rankedDifferential: [], alerts: [], nextQuestions: [] } },
    ],
  };
  const measures = computeAgreementMeasures(doc);
  assert.equal(measures.caseCoverage.totalCaseCount, 2);
  assert.equal(measures.caseCoverage.labeledCaseCount, 0);
  assert.equal(measures.caseCoverage.unlabeledCaseCount, 2);
  assert.equal(measures.caseLevelExactAgreementRate.rate, null);
  assert.equal(measures.caseLevelExactAgreementRate.agreeCount, 0);
  assert.equal(measures.safetyFlagAgreementCoverage.rate, null);
  assert.equal(measures.missingDataPromptAgreementRate.rate, null);
  assert.deepEqual(measures.perCandidatePatternAgreement.byPatternId, {});
  assert.equal(measures.dangerousMissDiscordanceCount.discordantCount, 0);
  assert.equal(measures.dangerousMissDiscordanceCount.dangerousMissExpectedCount, 0);
});

test('computeAgreementMeasures: an empty corpus (zero cases) does not throw and yields null rates', () => {
  const measures = computeAgreementMeasures({ cases: [] });
  assert.equal(measures.caseCoverage.totalCaseCount, 0);
  assert.equal(measures.caseLevelExactAgreementRate.rate, null);
});

test('computeAgreementMeasures: exactly 5 named measures are returned, alongside caseCoverage', () => {
  const measures = computeAgreementMeasures({ cases: [] });
  const { caseCoverage, ...rest } = measures;
  assert.deepEqual(
    Object.keys(rest).sort(),
    [
      'caseLevelExactAgreementRate',
      'dangerousMissDiscordanceCount',
      'missingDataPromptAgreementRate',
      'perCandidatePatternAgreement',
      'safetyFlagAgreementCoverage',
    ],
  );
});

// -------------------------------------------------------------------------------------------
// AC 1 (integration): the metrics-corpus fixture exercises every branch of every measure --
// hand-derived expected values (see tests/fixtures/ef-retro/metrics-corpus/corpus.json's own
// per-case tags for the intent behind each number below).
// -------------------------------------------------------------------------------------------

test('computeAgreementMeasures: metrics-corpus fixture yields the hand-derived expected values for all 5 measures', async () => {
  const replayDocument = await buildReplayDocument(METRICS_CORPUS_DIR);
  const measures = computeAgreementMeasures(replayDocument);

  assert.equal(measures.caseCoverage.totalCaseCount, 8);
  assert.equal(measures.caseCoverage.labeledCaseCount, 7);
  assert.equal(measures.caseCoverage.unlabeledCaseCount, 1);

  assert.equal(measures.caseLevelExactAgreementRate.agreeCount, 4);
  assert.equal(measures.caseLevelExactAgreementRate.labeledCaseCount, 7);
  assert.equal(measures.caseLevelExactAgreementRate.rate, 4 / 7);

  assert.deepEqual(measures.perCandidatePatternAgreement.byPatternId, {
    'iron-deficiency-anemia-fixture': { agree: 6, disagree: 1 },
  });

  assert.equal(measures.dangerousMissDiscordanceCount.dangerousMissExpectedCount, 3);
  assert.equal(measures.dangerousMissDiscordanceCount.discordantCount, 2);

  assert.equal(measures.safetyFlagAgreementCoverage.matchedCount, 1);
  assert.equal(measures.safetyFlagAgreementCoverage.referencedCount, 2);
  assert.equal(measures.safetyFlagAgreementCoverage.rate, 0.5);

  assert.equal(measures.missingDataPromptAgreementRate.matchedCount, 2);
  assert.equal(measures.missingDataPromptAgreementRate.referencedCount, 2);
  assert.equal(measures.missingDataPromptAgreementRate.rate, 1);
});

// -------------------------------------------------------------------------------------------
// evaluateProtocolQualification / findPopulatedProtocolFields -- FR-24: `qualifying` is
// structurally always `false`, no matter what the protocol document contains (or whether one was
// supplied at all).
// -------------------------------------------------------------------------------------------

test('evaluateProtocolQualification: no protocol supplied -> non-qualifying, protocolSupplied:false', () => {
  const result = evaluateProtocolQualification(undefined);
  assert.equal(result.qualifying, false);
  assert.equal(result.protocolSupplied, false);
  assert.deepEqual(result.populatedFields, []);
  assert.match(result.reason, /no prespecified protocol document/);
});

test('evaluateProtocolQualification: an all-null-threshold protocol -> still non-qualifying', () => {
  const result = evaluateProtocolQualification({ schemaVersion: 1, thresholds: { dangerousMissRate: null, utilityMeasures: null } });
  assert.equal(result.qualifying, false);
  assert.equal(result.protocolSupplied, true);
  assert.deepEqual(result.populatedFields, []);
  assert.match(result.reason, /all null/);
});

test('evaluateProtocolQualification: a populated-threshold protocol is DETECTED but STILL non-qualifying (never invents/honors a threshold)', () => {
  const result = evaluateProtocolQualification({ schemaVersion: 1, thresholds: { dangerousMissRate: 0.05 } });
  assert.equal(result.qualifying, false);
  assert.equal(result.protocolSupplied, true);
  assert.deepEqual(result.populatedFields, ['thresholds.dangerousMissRate']);
  assert.match(result.reason, /non-null field/);
});

test('findPopulatedProtocolFields: schemaVersion alone (bare metadata) does not count as populated', () => {
  assert.deepEqual(findPopulatedProtocolFields({ schemaVersion: 1 }), []);
});

test('findPopulatedProtocolFields: walks nested arrays/objects and reports dotted paths, sorted', () => {
  const fields = findPopulatedProtocolFields({
    schemaVersion: 1,
    thresholds: { dangerousMissRate: null },
    strata: { site: [null, 'site-a', null] },
  });
  assert.deepEqual(fields, ['strata.site.1']);
});

// -------------------------------------------------------------------------------------------
// AC 3: report banners -- unvalidated-prototype, software-agreement negation, and the FR-24
// non-qualifying-protocol banner all present verbatim, regardless of --protocol content.
// -------------------------------------------------------------------------------------------

test('buildAgreementReportDocument: carries the unvalidated-prototype and software-agreement-negation banners verbatim', async () => {
  const replayDocument = await buildReplayDocument(METRICS_CORPUS_DIR);
  const doc = buildAgreementReportDocument({ replayDocument });
  assert.equal(doc.banners.unvalidatedPrototype, UNVALIDATED_PROTOTYPE_BANNER);
  assert.equal(doc.banners.softwareAgreementNegation, SOFTWARE_AGREEMENT_NEGATION_BANNER);
});

test('buildAgreementReportDocument: FR-24 non-qualifying-protocol banner is present and qualifying:false, with no protocol supplied', async () => {
  const replayDocument = await buildReplayDocument(METRICS_CORPUS_DIR);
  const doc = buildAgreementReportDocument({ replayDocument });
  assert.equal(doc.banners.nonQualifyingProtocol.text, NON_QUALIFYING_PROTOCOL_BANNER);
  assert.match(doc.banners.nonQualifyingProtocol.text, /non-qualifying — protocol not prespecified by humans/i);
  assert.equal(doc.banners.nonQualifyingProtocol.qualifying, false);
});

test('buildAgreementReportDocument: FR-24 banner stays qualifying:false even when a populated protocol document is supplied', async () => {
  const replayDocument = await buildReplayDocument(METRICS_CORPUS_DIR);
  const doc = buildAgreementReportDocument({
    replayDocument,
    protocolDoc: { schemaVersion: 1, thresholds: { dangerousMissRate: 0.1 } },
  });
  assert.equal(doc.banners.nonQualifyingProtocol.qualifying, false);
  assert.deepEqual(doc.banners.nonQualifyingProtocol.populatedFields, ['thresholds.dangerousMissRate']);
});

// -------------------------------------------------------------------------------------------
// AC: exactly 5 named software-agreement measures, each labeled "software agreement".
// -------------------------------------------------------------------------------------------

test('buildAgreementReportDocument: softwareAgreementMeasures has EXACTLY the 5 OQ-5 measure keys, each label:"software agreement"', async () => {
  const replayDocument = await buildReplayDocument(METRICS_CORPUS_DIR);
  const doc = buildAgreementReportDocument({ replayDocument });
  const keys = Object.keys(doc.softwareAgreementMeasures).sort();
  assert.deepEqual(keys, [
    'caseLevelExactAgreementRate',
    'dangerousMissDiscordanceCount',
    'missingDataPromptAgreementRate',
    'perCandidatePatternAgreement',
    'safetyFlagAgreementCoverage',
  ]);
  for (const key of keys) {
    assert.equal(doc.softwareAgreementMeasures[key].label, SOFTWARE_AGREEMENT_LABEL, `measure "${key}" must carry the software-agreement label`);
  }
});

// -------------------------------------------------------------------------------------------
// AC 2: grep-test -- "sensitivity"/"specificity"/"clinical performance" appear nowhere in
// agreement-report.json except inside the one explicit negation banner.
// -------------------------------------------------------------------------------------------

test('grep: forbidden clinical-performance terms appear nowhere in agreement-report.json except inside the explicit negation banner', async () => {
  const replayDocument = await buildReplayDocument(METRICS_CORPUS_DIR);
  const doc = buildAgreementReportDocument({
    replayDocument,
    protocolDoc: { schemaVersion: 1, thresholds: { dangerousMissRate: 0.1 } },
  });
  const bytes = canonicalStringify(doc);

  const forbiddenTerms = ['sensitivity', 'specificity', 'clinical performance'];
  // Sanity: the banner itself DOES contain every forbidden term -- otherwise the strip below
  // would be vacuous.
  for (const term of forbiddenTerms) {
    assert.match(SOFTWARE_AGREEMENT_NEGATION_BANNER.toLowerCase(), new RegExp(term));
  }

  const withoutBanner = bytes.split(SOFTWARE_AGREEMENT_NEGATION_BANNER).join('');
  for (const term of forbiddenTerms) {
    assert.ok(
      !new RegExp(term, 'i').test(withoutBanner),
      `forbidden term "${term}" appears in agreement-report.json outside the explicit negation banner`,
    );
  }
});

// -------------------------------------------------------------------------------------------
// AC 4: run-provenance.json completeness + sole-timestamp-location proof.
// -------------------------------------------------------------------------------------------

const ISO_TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

test('buildRunProvenanceDocument: carries corpus id, harness version, candidate registry digest, and a run timestamp', async () => {
  const replayDocument = await buildReplayDocument(METRICS_CORPUS_DIR);
  const provenance = buildRunProvenanceDocument({ replayDocument });
  assert.equal(provenance.corpusId, replayDocument.corpusId);
  assert.equal(provenance.harnessVersion, replayDocument.harnessVersion);
  assert.equal(provenance.candidateRegistryDigest, replayDocument.candidate.packDigest);
  assert.match(provenance.runTimestamp, ISO_TIMESTAMP_PATTERN);
});

test('agreement-report.json carries NO timestamp anywhere; run-provenance.json is the sole timestamp location', async () => {
  const replayDocument = await buildReplayDocument(METRICS_CORPUS_DIR);
  const reportDoc = buildAgreementReportDocument({ replayDocument });
  const provenanceDoc = buildRunProvenanceDocument({ replayDocument });

  const reportBytes = canonicalStringify(reportDoc);
  const provenanceBytes = canonicalStringify(provenanceDoc);

  assert.ok(!ISO_TIMESTAMP_PATTERN.test(reportBytes), 'agreement-report.json must carry no ISO-8601 timestamp anywhere in its bytes');
  assert.ok(!/timestamp/i.test(reportBytes), 'agreement-report.json must carry no field whose name mentions "timestamp"');
  assert.ok(ISO_TIMESTAMP_PATTERN.test(provenanceBytes), 'sanity: run-provenance.json really does carry a timestamp (otherwise the assertion above is vacuous)');
});

// -------------------------------------------------------------------------------------------
// AC 5: determinism -- two report-document builds over an identical replay document produce
// byte-identical agreement-report.json bytes, across a real wall-clock gap.
// -------------------------------------------------------------------------------------------

test('buildAgreementReportDocument + canonicalStringify: byte-identical across two builds over an identical replay document (real wall-clock gap)', async () => {
  const replayDocument = await buildReplayDocument(METRICS_CORPUS_DIR);
  const bytesA = canonicalStringify(buildAgreementReportDocument({ replayDocument }));
  await new Promise((resolve) => { setTimeout(resolve, 1100); });
  const bytesB = canonicalStringify(buildAgreementReportDocument({ replayDocument }));
  assert.equal(bytesA, bytesB, 'agreement-report.json must be byte-identical across two builds over an identical replay document');
});

// -------------------------------------------------------------------------------------------
// Full-verb / CLI-level integration: `report` end to end, writing both artifacts, and the
// double-invocation byte-identity proof through the real verb + a CLI subprocess.
// -------------------------------------------------------------------------------------------

async function writeMetricsReplayOutput() {
  const replayDocument = await buildReplayDocument(METRICS_CORPUS_DIR);
  const outputDir = defaultOutputDir({ corpusId: replayDocument.corpusId, candidateDigest: VALID_DIGEST });
  await writeReplayOutput({ outputDir, document: replayDocument });
  return outputDir;
}

test('report verb: end-to-end writes agreement-report.json + run-provenance.json into the --run dir, alongside replay-output.json', async () => {
  const runDir = await writeMetricsReplayOutput();
  try {
    const code = await runReportVerb({ corpus: METRICS_CORPUS_DIR, run: runDir, accessLogPath: ACCESS_LOG_PATH });
    assert.equal(code, EXIT_OK);

    const reportBytes = await readFile(path.join(runDir, AGREEMENT_REPORT_FILENAME), 'utf8');
    const reportDoc = JSON.parse(reportBytes);
    assert.equal(reportDoc.corpusId, 'ef-retro-metrics-fixture');
    assert.equal(Object.keys(reportDoc.softwareAgreementMeasures).length, 5);

    const provenanceBytes = await readFile(path.join(runDir, RUN_PROVENANCE_FILENAME), 'utf8');
    const provenanceDoc = JSON.parse(provenanceBytes);
    assert.equal(provenanceDoc.corpusId, 'ef-retro-metrics-fixture');
    assert.match(provenanceDoc.runTimestamp, ISO_TIMESTAMP_PATTERN);

    // replay-output.json (written by `run`, P4-T3) is untouched by `report`.
    const replayBytes = await readFile(path.join(runDir, 'replay-output.json'), 'utf8');
    assert.equal(JSON.parse(replayBytes).corpusId, 'ef-retro-metrics-fixture');
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test('report verb: two invocations over an identical --run dir produce byte-identical agreement-report.json', async () => {
  const runDir = await writeMetricsReplayOutput();
  try {
    await runReportVerb({ corpus: METRICS_CORPUS_DIR, run: runDir, accessLogPath: ACCESS_LOG_PATH });
    const bytesA = await readFile(path.join(runDir, AGREEMENT_REPORT_FILENAME));

    await new Promise((resolve) => { setTimeout(resolve, 1100); });

    await runReportVerb({ corpus: METRICS_CORPUS_DIR, run: runDir, accessLogPath: ACCESS_LOG_PATH });
    const bytesB = await readFile(path.join(runDir, AGREEMENT_REPORT_FILENAME));

    assert.ok(bytesA.equals(bytesB), 'agreement-report.json must be byte-identical across two `report` invocations over identical inputs');
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test('CLI: `run` then two `report` subprocess invocations write byte-identical agreement-report.json', async () => {
  const runDir = defaultOutputDir({ corpusId: 'ef-retro-metrics-fixture', candidateDigest: VALID_DIGEST });
  const env = { ...process.env, RETRO_VALIDATE_ACCESS_LOG_PATH: ACCESS_LOG_PATH };
  try {
    const runResult = spawnSync(
      process.execPath,
      [CLI_PATH, 'run', '--corpus', METRICS_CORPUS_DIR, '--candidate-digest', VALID_DIGEST, '--registry', VALID_REGISTRY_PATH],
      { encoding: 'utf8', env },
    );
    assert.equal(runResult.status, EXIT_OK, `stderr: ${runResult.stderr}`);

    const reportArgs = [CLI_PATH, 'report', '--corpus', METRICS_CORPUS_DIR, '--run', runDir];
    const reportA = spawnSync(process.execPath, reportArgs, { encoding: 'utf8', env });
    assert.equal(reportA.status, EXIT_OK, `stderr: ${reportA.stderr}`);

    const reportB = spawnSync(process.execPath, reportArgs, { encoding: 'utf8', env });
    assert.equal(reportB.status, EXIT_OK, `stderr: ${reportB.stderr}`);

    assert.equal(reportA.stdout, reportB.stdout, 'the CLI summary itself carries no timestamp either');
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// Usage-error paths: missing --run, missing replay-output.json under --run, mismatched
// corpus/run pairing, and an unreadable/unparsable --protocol document.
// -------------------------------------------------------------------------------------------

test('report verb: --run naming a directory with no replay-output.json fails closed (UsageError)', async () => {
  const emptyRunDir = await mkdtemp(path.join(os.tmpdir(), 'ef-retro-metrics-empty-run-'));
  try {
    await assert.rejects(
      () => runReportVerb({ corpus: METRICS_CORPUS_DIR, run: emptyRunDir, accessLogPath: ACCESS_LOG_PATH }),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.equal(err.exitCode, EXIT_USAGE);
        assert.match(err.message, /replay-output\.json/);
        return true;
      },
    );
  } finally {
    await rm(emptyRunDir, { recursive: true, force: true });
  }
});

test('report verb: a --run replay output from a DIFFERENT corpus than --corpus fails closed (mismatch, UsageError)', async () => {
  // replay-corpus's own replay output names corpusId "ef-retro-replay-fixture" -- pairing it with
  // --corpus metrics-corpus (corpusId "ef-retro-metrics-fixture") is a genuine mismatch. Written
  // to an ISOLATED tmp dir (not `defaultOutputDir`'s convention-derived path) -- that same
  // (corpusId, digest) path is independently written/cleaned up by
  // tests/ef-retro-determinism.test.mjs's own tests, and `node --test` runs test FILES
  // concurrently by default, so sharing that literal directory here would be a real race.
  const { parsed: replayCorpusDoc } = await loadCorpusDocument(REPLAY_CORPUS_DIR);
  const candidate = await resolveValidCandidate();
  const mismatchedReplayDocument = replayCorpus({ corpusDoc: replayCorpusDoc, candidate });
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'ef-retro-metrics-mismatch-run-'));
  await writeReplayOutput({ outputDir, document: mismatchedReplayDocument });

  try {
    await assert.rejects(
      () => runReportVerb({ corpus: METRICS_CORPUS_DIR, run: outputDir, accessLogPath: ACCESS_LOG_PATH }),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.match(err.message, /does not match/);
        assert.match(err.message, /ef-retro-replay-fixture/);
        assert.match(err.message, /ef-retro-metrics-fixture/);
        return true;
      },
    );
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('report verb: an unreadable --protocol path fails closed (UsageError)', async () => {
  const runDir = await writeMetricsReplayOutput();
  try {
    await assert.rejects(
      () => runReportVerb({
        corpus: METRICS_CORPUS_DIR,
        run: runDir,
        protocol: path.join(runDir, 'does-not-exist-protocol.json'),
        accessLogPath: ACCESS_LOG_PATH,
      }),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.match(err.message, /--protocol/);
        return true;
      },
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test('report verb: an unparsable --protocol file fails closed (UsageError)', async () => {
  const runDir = await writeMetricsReplayOutput();
  const badProtocolPath = path.join(runDir, 'bad-protocol.json');
  await writeFile(badProtocolPath, 'not valid json {{{', 'utf8');
  try {
    await assert.rejects(
      () => runReportVerb({ corpus: METRICS_CORPUS_DIR, run: runDir, protocol: badProtocolPath, accessLogPath: ACCESS_LOG_PATH }),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.match(err.message, /not valid JSON/);
        return true;
      },
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test('report verb: a --protocol document that reads/parses fine is accepted, and is reflected in the non-qualifying banner (still qualifying:false)', async () => {
  const runDir = await writeMetricsReplayOutput();
  const protocolPath = path.join(runDir, 'null-threshold-protocol.json');
  await mkdir(runDir, { recursive: true });
  await writeFile(protocolPath, JSON.stringify({ schemaVersion: 1, thresholds: { dangerousMissRate: null } }), 'utf8');
  try {
    const code = await runReportVerb({ corpus: METRICS_CORPUS_DIR, run: runDir, protocol: protocolPath, accessLogPath: ACCESS_LOG_PATH });
    assert.equal(code, EXIT_OK);
    const reportDoc = JSON.parse(await readFile(path.join(runDir, AGREEMENT_REPORT_FILENAME), 'utf8'));
    assert.equal(reportDoc.banners.nonQualifyingProtocol.qualifying, false);
    assert.equal(reportDoc.banners.nonQualifyingProtocol.protocolSupplied, true);
    assert.deepEqual(reportDoc.banners.nonQualifyingProtocol.populatedFields, []);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// "Only these de-identified aggregates ever cross into repo artifacts": agreement-report.json
// never carries a raw per-case `input`/`output` dump, nor a bare list of caseIds.
// -------------------------------------------------------------------------------------------

test('agreement-report.json carries only aggregate measures -- no per-case "input"/"output"/"caseId" content', async () => {
  const replayDocument = await buildReplayDocument(METRICS_CORPUS_DIR);
  const doc = buildAgreementReportDocument({ replayDocument });
  const bytes = canonicalStringify(doc);
  assert.ok(!/"caseId"/.test(bytes), 'agreement-report.json must not carry a per-case caseId field');
  assert.ok(!/"cbc"|"reticulocytes"|"hemoglobin"/.test(bytes), 'agreement-report.json must not carry raw clinical input content');
});
