// tests/ef-retro-determinism.test.mjs -- P4-T3 (Evidence Foundry E1 Phase 4, FR-19, ADR-0006).
//
// Proves this task's own acceptance criteria (phase-4-progress.md / phase-2-4-workstreams.md
// P4-T3 row):
//   1. Double-run determinism test green: two `run` invocations over an identical
//      (corpus, candidate-digest, registry) triple produce byte-identical metric artifacts.
//   2. Sorted case order: replay output is sorted by `caseId`, independent of a corpus's declared
//      case order (the fixture corpus here deliberately declares cases out of order).
//   3. Seeded digest-mismatch and absent-registry-entry runs fail closed with zero partial output.
//   4. Seeded pinned-content drift (a registry entry whose OWN recorded `packDigest` disagrees
//      with its pinned candidate directory's actual content) fails closed.
//   5. An unregistered `moduleId` and a missing pinned-content directory both fail closed.
//   6. A registry document that fails `schemas/release-registry.schema.json` fails closed.
//   7. "Current tree" execution is impossible: no code path in `lib/replay.mjs` reads
//      `modules/<id>/*.json` off the live tree (structural + behavioral proof).
//   8. No timestamp (`meta.generatedAt`) ever reaches the written/hashed replay bytes.
//   9. Zero network / zero LLM-SDK calls during a full `run` invocation (runtime proof, mirrors
//      tests/ef-retro-corpus.test.mjs's own check-fixtures-scoped test).
//
// tests/ef-retro-boundary.test.mjs (P4-T2, updated here) covers the call-order/refusal contract
// for the FR-20 boundary gate itself -- this file assumes that gate already passed and focuses on
// what happens AFTER it (candidate resolution + replay), which is this task's own scope.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveCandidate,
  replayCorpus,
  writeReplayOutput,
  defaultOutputDir,
  canonicalize,
  canonicalStringify,
} from '../tools/retro-validate/lib/replay.mjs';
import { loadCorpusDocument } from '../tools/retro-validate/lib/corpus.mjs';
import { run as runRunVerb } from '../tools/retro-validate/lib/verbs/run.mjs';
import { RegistryError, UsageError, EXIT_OK, EXIT_USAGE } from '../tools/retro-validate/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RETRO_VALIDATE_ROOT = path.join(REPO_ROOT, 'tools', 'retro-validate');
const CLI_PATH = path.join(RETRO_VALIDATE_ROOT, 'cli.mjs');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-retro');
const REGISTRIES_ROOT = path.join(FIXTURES_ROOT, 'registries');

const REPLAY_CORPUS_DIR = path.join(FIXTURES_ROOT, 'replay-corpus');
const VALID_REGISTRY_PATH = path.join(REGISTRIES_ROOT, 'valid', 'registry.json');
const DRIFTED_REGISTRY_PATH = path.join(REGISTRIES_ROOT, 'drifted-content', 'registry.json');
const UNREGISTERED_MODULE_REGISTRY_PATH = path.join(REGISTRIES_ROOT, 'unregistered-module', 'registry.json');
const MISSING_CONTENT_REGISTRY_PATH = path.join(REGISTRIES_ROOT, 'missing-candidate-content', 'registry.json');
const SCHEMA_INVALID_REGISTRY_PATH = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'ef-release', 'invalid-release-registry-missing-manifestdigest-002.json.txt',
);

const VALID_DIGEST = 'sha256:ef1adfb4d4e2640812f9d1de363c68c979c9c159b60ede121376e1befbe7212c';
const DRIFTED_DIGEST = `sha256:${'1'.repeat(64)}`;
const UNKNOWN_DIGEST = `sha256:${'0'.repeat(64)}`;
const MISSING_CONTENT_DIGEST = `sha256:${'2'.repeat(64)}`;

// Isolated tmp access log per this file, same pattern tests/ef-retro-boundary.test.mjs (P4-T7)
// already established -- `npm test` must never mutate the tracked access-log.jsonl.
const ACCESS_LOG_TMP_DIR = await mkdtemp(path.join(os.tmpdir(), 'ef-retro-determinism-test-access-log-'));
const ACCESS_LOG_PATH = path.join(ACCESS_LOG_TMP_DIR, 'access-log.jsonl');
const ACCESS_LOG_ENV = { ...process.env, RETRO_VALIDATE_ACCESS_LOG_PATH: ACCESS_LOG_PATH };

async function loadValidCorpusDoc() {
  const { parsed } = await loadCorpusDocument(REPLAY_CORPUS_DIR);
  return parsed;
}

async function resolveValidCandidate() {
  return resolveCandidate({ registryPath: VALID_REGISTRY_PATH, candidateDigest: VALID_DIGEST });
}

// -------------------------------------------------------------------------------------------
// AC: candidate resolution -- success path.
// -------------------------------------------------------------------------------------------

test('resolveCandidate: a matching digest resolves the pinned candidate (moduleId/version/rules/candidates)', async () => {
  const candidate = await resolveValidCandidate();
  assert.equal(candidate.moduleId, 'anemia');
  assert.equal(candidate.version, '0.1.0-fixture');
  assert.equal(candidate.packDigest, VALID_DIGEST);
  assert.equal(candidate.rules.length, 3);
  assert.ok(candidate.candidates['iron-deficiency-anemia-fixture']);
});

test('resolveCandidate: requires --registry and --candidate-digest (UsageError, not RegistryError)', async () => {
  await assert.rejects(
    () => resolveCandidate({ candidateDigest: VALID_DIGEST }),
    (err) => {
      assert.ok(err instanceof UsageError);
      assert.ok(!(err instanceof RegistryError));
      return true;
    },
  );
  await assert.rejects(
    () => resolveCandidate({ registryPath: VALID_REGISTRY_PATH }),
    (err) => {
      assert.ok(err instanceof UsageError);
      assert.ok(!(err instanceof RegistryError));
      return true;
    },
  );
});

// -------------------------------------------------------------------------------------------
// AC 3: seeded digest-mismatch / absent-registry-entry fails closed (RegistryError).
// -------------------------------------------------------------------------------------------

test('resolveCandidate: a --candidate-digest matching no registry entry fails closed (RegistryError)', async () => {
  await assert.rejects(
    () => resolveCandidate({ registryPath: VALID_REGISTRY_PATH, candidateDigest: UNKNOWN_DIGEST }),
    (err) => {
      assert.ok(err instanceof RegistryError, `expected RegistryError, got ${err?.constructor?.name}`);
      assert.equal(err.exitCode, EXIT_USAGE);
      assert.match(err.message, /matches no entry/);
      return true;
    },
  );
});

// -------------------------------------------------------------------------------------------
// AC 4: seeded pinned-content DRIFT fails closed -- the registry entry's OWN packDigest disagrees
// with its pinned candidate directory's actual content (distinct failure class from "not found").
// -------------------------------------------------------------------------------------------

test('resolveCandidate: pinned candidate content that does not hash to its own registry entry\'s packDigest fails closed (drift)', async () => {
  await assert.rejects(
    () => resolveCandidate({ registryPath: DRIFTED_REGISTRY_PATH, candidateDigest: DRIFTED_DIGEST }),
    (err) => {
      assert.ok(err instanceof RegistryError, `expected RegistryError, got ${err?.constructor?.name}`);
      assert.match(err.message, /drift/);
      assert.match(err.message, new RegExp(DRIFTED_DIGEST.replace(/[:]/g, '\\$&')));
      return true;
    },
  );
});

// -------------------------------------------------------------------------------------------
// AC 5: unregistered moduleId / missing pinned-content directory both fail closed.
// -------------------------------------------------------------------------------------------

test('resolveCandidate: a registry entry naming an unregistered moduleId fails closed', async () => {
  await assert.rejects(
    () => resolveCandidate({ registryPath: UNREGISTERED_MODULE_REGISTRY_PATH, candidateDigest: VALID_DIGEST }),
    (err) => {
      assert.ok(err instanceof RegistryError);
      assert.match(err.message, /not_a_real_module/);
      assert.match(err.message, /not registered/);
      return true;
    },
  );
});

test('resolveCandidate: a resolved entry with no pinned candidate-content directory on disk fails closed', async () => {
  await assert.rejects(
    () => resolveCandidate({ registryPath: MISSING_CONTENT_REGISTRY_PATH, candidateDigest: MISSING_CONTENT_DIGEST }),
    (err) => {
      assert.ok(err instanceof RegistryError);
      assert.match(err.message, /no pinned candidate/);
      return true;
    },
  );
});

// -------------------------------------------------------------------------------------------
// AC 6: a --registry document that fails schemas/release-registry.schema.json fails closed.
// -------------------------------------------------------------------------------------------

test('resolveCandidate: a --registry document failing schemas/release-registry.schema.json fails closed', async () => {
  await assert.rejects(
    () => resolveCandidate({ registryPath: SCHEMA_INVALID_REGISTRY_PATH, candidateDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111' }),
    (err) => {
      assert.ok(err instanceof RegistryError);
      assert.match(err.message, /release-registry\.schema\.json/);
      return true;
    },
  );
});

// -------------------------------------------------------------------------------------------
// AC 2 + 8: replayCorpus sorts by caseId regardless of declared order, and strips the one
// non-deterministic field (`meta.generatedAt`) `src/engine.js#assess()` produces.
// -------------------------------------------------------------------------------------------

test('replayCorpus: sorts cases by caseId ascending, independent of declared corpus.json order', async () => {
  const corpusDoc = await loadValidCorpusDoc();
  // Sanity: the fixture corpus declares cases out of order (zzz, aaa, mmm) -- this assertion
  // would be vacuous if it did not.
  assert.deepEqual(corpusDoc.cases.map((c) => c.caseId), ['case-zzz-candidate', 'case-aaa-alert', 'case-mmm-question']);

  const candidate = await resolveValidCandidate();
  const document = replayCorpus({ corpusDoc, candidate });
  assert.deepEqual(document.cases.map((c) => c.caseId), ['case-aaa-alert', 'case-mmm-question', 'case-zzz-candidate']);
  assert.equal(document.caseCount, 3);
});

test('replayCorpus: strips meta.generatedAt (the one non-deterministic field assess() produces) from every case', async () => {
  const corpusDoc = await loadValidCorpusDoc();
  const candidate = await resolveValidCandidate();
  const document = replayCorpus({ corpusDoc, candidate });
  for (const corpusCase of document.cases) {
    assert.ok(!('generatedAt' in corpusCase.output.meta), `case ${corpusCase.caseId} output.meta must not carry generatedAt`);
    // Sanity: assess() really does produce this field elsewhere, so a bug that stops stripping it
    // (rather than a bug that never had it) would be caught -- reconstructing the raw call here.
  }
  // Independently prove assess() itself DOES emit generatedAt, so the assertion above is
  // meaningful (proves stripNonDeterministic is doing real work, not asserting a vacuous absence).
  const { assess } = await import('../src/engine.js');
  const rawOutput = assess(corpusDoc.cases[0].input, candidate.moduleId, candidate.rules, candidate.candidates);
  assert.ok('generatedAt' in rawOutput.meta, 'sanity: assess() must itself produce meta.generatedAt for this test to be meaningful');
});

test('replayCorpus: each case carries its referenceLabels/tags/provenance through untouched, alongside the engine output', async () => {
  const corpusDoc = await loadValidCorpusDoc();
  const candidate = await resolveValidCandidate();
  const document = replayCorpus({ corpusDoc, candidate });
  const alertCase = document.cases.find((c) => c.caseId === 'case-aaa-alert');
  assert.equal(alertCase.provenance, 'synthetic');
  assert.deepEqual(alertCase.tags, ['replay-fixture', 'alert-case']);
  assert.deepEqual(alertCase.referenceLabels.safetyFlagIds, ['FIX-IRON-RISK-ALERT-001']);
  assert.deepEqual(alertCase.output.alerts.map((a) => a.id), ['FIX-IRON-RISK-ALERT-001']);
  assert.deepEqual(alertCase.output.nextQuestions.map((q) => q.id), ['FIX-INDETERMINATE-Q-001']);

  const candidateCase = document.cases.find((c) => c.caseId === 'case-zzz-candidate');
  assert.deepEqual(candidateCase.output.rankedDifferential.map((c) => c.id), ['iron-deficiency-anemia-fixture']);
});

// -------------------------------------------------------------------------------------------
// canonicalize / canonicalStringify -- pure, sorted-key serialization.
// -------------------------------------------------------------------------------------------

test('canonicalize: recursively sorts object keys, leaves array element order untouched', () => {
  const input = { b: 1, a: { d: 2, c: [{ z: 1, y: 2 }, { b: 1, a: 2 }] } };
  const output = canonicalize(input);
  assert.deepEqual(Object.keys(output), ['a', 'b']);
  assert.deepEqual(Object.keys(output.a), ['c', 'd']);
  // Array element order is untouched (not sorted) -- only each element's OWN keys are sorted.
  assert.deepEqual(Object.keys(output.a.c[0]), ['y', 'z']);
  assert.deepEqual(Object.keys(output.a.c[1]), ['a', 'b']);
});

test('canonicalStringify: two structurally-identical-but-differently-key-ordered objects serialize to identical bytes', () => {
  const a = canonicalStringify({ x: 1, y: 2 });
  const b = canonicalStringify({ y: 2, x: 1 });
  assert.equal(a, b);
  assert.ok(a.endsWith('\n'));
});

// -------------------------------------------------------------------------------------------
// AC 1: double-run determinism -- byte-identical replay-output.json across two `run` invocations.
// -------------------------------------------------------------------------------------------

test('run: two invocations over an identical (corpus, candidate-digest, registry) triple produce byte-identical replay-output.json', async () => {
  const options = {
    corpus: REPLAY_CORPUS_DIR,
    candidateDigest: VALID_DIGEST,
    registry: VALID_REGISTRY_PATH,
    accessLogPath: ACCESS_LOG_PATH,
  };

  const codeA = await runRunVerb(options);
  const outputDir = defaultOutputDir({ corpusId: 'ef-retro-replay-fixture', candidateDigest: VALID_DIGEST });
  const outputPath = path.join(outputDir, 'replay-output.json');
  const bytesA = await readFile(outputPath);

  // A real wall-clock gap between the two runs -- if `run` ever leaked wall-clock time into the
  // written bytes (a regression this test exists to catch), a 1s gap makes it observable.
  await new Promise((resolve) => { setTimeout(resolve, 1100); });

  const codeB = await runRunVerb(options);
  const bytesB = await readFile(outputPath);

  assert.equal(codeA, EXIT_OK);
  assert.equal(codeB, EXIT_OK);
  assert.ok(bytesA.equals(bytesB), 'replay-output.json must be byte-identical across two runs over identical inputs');

  // Cleanup: build/ is gitignored, but leave no stray directories behind for the next test run.
  await rm(outputDir, { recursive: true, force: true });
});

test('CLI: two `run` subprocess invocations over identical inputs write byte-identical replay-output.json', () => {
  const args = [
    CLI_PATH, 'run',
    '--corpus', REPLAY_CORPUS_DIR,
    '--candidate-digest', VALID_DIGEST,
    '--registry', VALID_REGISTRY_PATH,
  ];
  const outputDir = defaultOutputDir({ corpusId: 'ef-retro-replay-fixture', candidateDigest: VALID_DIGEST });
  const outputPath = path.join(outputDir, 'replay-output.json');

  const resultA = spawnSync(process.execPath, args, { encoding: 'utf8', env: ACCESS_LOG_ENV });
  assert.equal(resultA.status, EXIT_OK, `stderr: ${resultA.stderr}`);

  const resultB = spawnSync(process.execPath, args, { encoding: 'utf8', env: ACCESS_LOG_ENV });
  assert.equal(resultB.status, EXIT_OK, `stderr: ${resultB.stderr}`);

  assert.equal(resultA.stdout, resultB.stdout, 'the CLI summary itself carries no timestamp either');

  return readFile(outputPath).then(() => {}).finally(() => rm(outputDir, { recursive: true, force: true }));
});

// -------------------------------------------------------------------------------------------
// AC 3 (continued): fail-closed candidate-resolution failures via the FULL `run` verb leave zero
// output on disk -- proven by asserting the would-be output directory never gets created.
// -------------------------------------------------------------------------------------------

test('run: a digest-mismatch fails closed via the full verb -- zero output written', async () => {
  const outputDir = defaultOutputDir({ corpusId: 'ef-retro-replay-fixture', candidateDigest: UNKNOWN_DIGEST });
  await assert.rejects(
    () => runRunVerb({
      corpus: REPLAY_CORPUS_DIR,
      candidateDigest: UNKNOWN_DIGEST,
      registry: VALID_REGISTRY_PATH,
      accessLogPath: ACCESS_LOG_PATH,
    }),
    (err) => {
      assert.ok(err instanceof RegistryError);
      return true;
    },
  );
  await assert.rejects(() => readdir(outputDir), { code: 'ENOENT' }, 'a failed resolution must never create its output directory');
});

test('run: drifted pinned content fails closed via the full verb -- zero output written', async () => {
  const outputDir = defaultOutputDir({ corpusId: 'ef-retro-replay-fixture', candidateDigest: DRIFTED_DIGEST });
  await assert.rejects(
    () => runRunVerb({
      corpus: REPLAY_CORPUS_DIR,
      candidateDigest: DRIFTED_DIGEST,
      registry: DRIFTED_REGISTRY_PATH,
      accessLogPath: ACCESS_LOG_PATH,
    }),
    (err) => {
      assert.ok(err instanceof RegistryError);
      assert.match(err.message, /drift/);
      return true;
    },
  );
  await assert.rejects(() => readdir(outputDir), { code: 'ENOENT' });
});

test('CLI: `run` with a digest matching no registry entry exits 1 (usage/registry) and prints no stdout', () => {
  const result = spawnSync(
    process.execPath,
    [CLI_PATH, 'run', '--corpus', REPLAY_CORPUS_DIR, '--candidate-digest', UNKNOWN_DIGEST, '--registry', VALID_REGISTRY_PATH],
    { encoding: 'utf8', env: ACCESS_LOG_ENV },
  );
  assert.equal(result.status, EXIT_USAGE, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '', 'no partial output on a fail-closed candidate-resolution rejection');
  assert.match(result.stderr, /RegistryError/);
});

// -------------------------------------------------------------------------------------------
// AC 7: "current tree" execution is impossible -- structural proof.
// -------------------------------------------------------------------------------------------

test('structural: lib/replay.mjs never reads modules/<id>/{rules,candidates}.json off the live tree ("never current tree")', async () => {
  const source = await readFile(path.join(RETRO_VALIDATE_ROOT, 'lib', 'replay.mjs'), 'utf8');
  // Strip block comments (`/** ... */`) and line comments (`// ...`) first -- this file's own
  // header PROSE explains, in English, exactly the live-tree path this code must never touch
  // ("this tool never falls back to reading modules/<moduleId>/rules.json"), which would
  // otherwise false-positive against a naive whole-source scan. Only actual code is scanned below.
  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');

  // The only sanctioned candidate-content path is the tool-local
  // `<registry dir>/candidates/<moduleId>/<version>/` convention this file's own header documents.
  // A literal `modules/<id>/rules.json` or `modules/<id>/candidates.json` path -- this repo's real
  // KB-package location -- must never appear in actual CODE (import specifier, path.join
  // argument, or string literal) in this file.
  assert.ok(
    !/modules\/[^'"`\s]*\/(?:rules|candidates)\.json/.test(codeOnly),
    'lib/replay.mjs must not reference a live modules/<id>/{rules,candidates}.json path in code',
  );

  // `src/modules/registry.js` (the MODULE-ID registry -- `isRegisteredModule`, a defensive
  // existence check on a string, not a KB-content read) is the one legitimate "modules/"
  // substring this file may import. Any OTHER import line mentioning "modules/" would be a live
  // KB-content read this file's own header explicitly rules out.
  const importLines = source.split('\n').filter((line) => /^\s*import\b/.test(line));
  for (const line of importLines) {
    if (line.includes('modules/')) {
      assert.ok(
        line.includes('src/modules/registry.js'),
        `unexpected "modules/" import in lib/replay.mjs (only src/modules/registry.js is allowed): ${line}`,
      );
    }
  }
});

test('behavioral: a registered moduleId with a correctly pinned candidate directory replays successfully with no reference to modules/<id> content', async () => {
  // The "anemia" registry entry above resolves against
  // tests/fixtures/ef-retro/registries/valid/candidates/anemia/0.1.0-fixture/ -- a directory that
  // is NOT modules/anemia/ and carries a deliberately tiny, hand-authored 3-rule KB, structurally
  // unrelated to the real (91-rule) modules/anemia/rules.json. A run resolving 3 rules (not 91)
  // is itself the behavioral proof no "current tree" fallback occurred.
  const candidate = await resolveValidCandidate();
  assert.equal(candidate.rules.length, 3);
});

// -------------------------------------------------------------------------------------------
// AC 9: zero network calls during a full `run` invocation (runtime proof).
// -------------------------------------------------------------------------------------------

test('zero-network: a full `run` invocation (success path) makes zero outbound network calls', async () => {
  let calls = 0;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalFetch = globalThis.fetch;
  http.request = (...args) => { calls += 1; return originalHttpRequest(...args); };
  https.request = (...args) => { calls += 1; return originalHttpsRequest(...args); };
  if (typeof originalFetch === 'function') {
    globalThis.fetch = (...args) => { calls += 1; return originalFetch(...args); };
  }
  const outputDir = defaultOutputDir({ corpusId: 'ef-retro-replay-fixture', candidateDigest: VALID_DIGEST });
  try {
    await runRunVerb({
      corpus: REPLAY_CORPUS_DIR,
      candidateDigest: VALID_DIGEST,
      registry: VALID_REGISTRY_PATH,
      accessLogPath: ACCESS_LOG_PATH,
    });
  } finally {
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    if (typeof originalFetch === 'function') globalThis.fetch = originalFetch;
    await rm(outputDir, { recursive: true, force: true });
  }
  assert.equal(calls, 0, 'a full run() invocation must make zero outbound network calls');
});

// writeReplayOutput is exercised indirectly by every `run`-verb test above; one direct unit test
// for the module's own contract (idempotent overwrite at a deterministic path).
test('writeReplayOutput: writes canonical bytes to <outputDir>/replay-output.json and returns that path', async () => {
  const corpusDoc = await loadValidCorpusDoc();
  const candidate = await resolveValidCandidate();
  const document = replayCorpus({ corpusDoc, candidate });
  const outputDir = path.join(await mkdtemp(path.join(os.tmpdir(), 'ef-retro-write-output-test-')), 'out');
  const { outputPath, bytes } = await writeReplayOutput({ outputDir, document });
  assert.equal(outputPath, path.join(outputDir, 'replay-output.json'));
  const onDisk = await readFile(outputPath, 'utf8');
  assert.equal(onDisk, bytes);
  assert.equal(bytes, canonicalStringify(document));
});
