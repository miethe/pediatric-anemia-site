// tests/ef-retro-corpus.test.mjs -- P4-T1 (Evidence Foundry E1 Phase 4, FR-19/FR-20, ADR-0006).
//
// Proves this task's own acceptance criteria (phase-4-progress.md / phase-2-4-workstreams.md
// P4-T1 row):
//   1. The tool-local fixture-corpus schema (tools/retro-validate/schemas/fixture-corpus.schema.json)
//      rejects a case missing its `provenance` marker (R-P2 seeded violation).
//   2. It rejects each of >=6 enumerated identifier-field-denylist classes -- name, MRN, DOB,
//      address, contact (field-name-based, via the schema's closed `case` property set), and an
//      SSN-like value pattern (value-based, independent of field name) -- one seeded fixture per
//      class.
//   3. A valid synthetic (and, for good measure, a valid fixture-shaped de-identified) corpus
//      fixture passes `check-fixtures`.
//   4. Zero network / zero LLM-SDK calls anywhere in tools/retro-validate/ (structural + runtime).
//
// `run`/`report`'s FULL boundary-enforcement hardening (call-order proof, "no partial output",
// distinct rejection-class error identity) is P4-T2's own AC and lives in
// tests/ef-retro-boundary.test.mjs -- this file only proves the CORPUS + BOUNDARY modules this
// task ships are correct in isolation.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, mkdtemp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { loadFixtureCorpusSchema, loadCorpusDocument, FIXTURE_CORPUS_SCHEMA_PATH } from '../tools/retro-validate/lib/corpus.mjs';
import { checkFixtures } from '../tools/retro-validate/lib/boundary.mjs';
import { run as runCheckFixtures } from '../tools/retro-validate/lib/verbs/check-fixtures.mjs';
import { run as runRunVerb } from '../tools/retro-validate/lib/verbs/run.mjs';
import { run as runReportVerb } from '../tools/retro-validate/lib/verbs/report.mjs';
import { BoundaryError, UsageError, NotImplementedError, EXIT_OK, EXIT_BOUNDARY, EXIT_USAGE } from '../tools/retro-validate/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RETRO_VALIDATE_ROOT = path.join(REPO_ROOT, 'tools', 'retro-validate');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-retro');

function fixtureDir(name) {
  return path.join(FIXTURES_ROOT, name);
}

// P4-T7 (FR-22): every check-fixtures/run/report invocation now appends to the access log. This
// file's own AC is the CORPUS/BOUNDARY-module shape, not the access log (that is
// tests/ef-retro-access-log.test.mjs's job) -- so every verb call/CLI subprocess below is pointed
// at an isolated tmp log path, never the real committed tools/retro-validate/access-log.jsonl.
const ACCESS_LOG_TMP_DIR = await mkdtemp(path.join(os.tmpdir(), 'ef-retro-corpus-test-access-log-'));
const ACCESS_LOG_PATH = path.join(ACCESS_LOG_TMP_DIR, 'access-log.jsonl');

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(full)));
    } else if (entry.name.endsWith('.mjs')) {
      files.push(full);
    }
  }
  return files;
}

// -------------------------------------------------------------------------------------------
// Schema self-check + valid fixtures pass.
// -------------------------------------------------------------------------------------------

test('fixture-corpus schema loads without an unsupported-keyword error', async () => {
  const schema = await loadFixtureCorpusSchema();
  const { parsed } = await loadCorpusDocument(fixtureDir('valid-synthetic'));
  // json-schema-lite throws (rather than silently skipping) on any keyword it does not support --
  // a clean call here proves the schema uses only the supported 2020-12 subset.
  assert.doesNotThrow(() => validate(schema, parsed));
});

test('a valid synthetic corpus fixture passes schema validation with zero errors', async () => {
  const schema = await loadFixtureCorpusSchema();
  const { parsed } = await loadCorpusDocument(fixtureDir('valid-synthetic'));
  const errors = validate(schema, parsed);
  assert.deepEqual(errors, []);
});

test('a valid fixture-shaped de-identified corpus passes schema validation with zero errors', async () => {
  const schema = await loadFixtureCorpusSchema();
  const { parsed } = await loadCorpusDocument(fixtureDir('valid-deidentified'));
  const errors = validate(schema, parsed);
  assert.deepEqual(errors, []);
});

test('check-fixtures verb accepts a valid synthetic corpus (in-process, exit 0)', async () => {
  const exitCode = await runCheckFixtures({ corpus: fixtureDir('valid-synthetic'), accessLogPath: ACCESS_LOG_PATH });
  assert.equal(exitCode, EXIT_OK);
});

test('CLI: `check-fixtures --corpus <valid-synthetic>` exits 0 and prints a JSON summary (subprocess)', () => {
  const result = spawnSync(
    process.execPath,
    [path.join(RETRO_VALIDATE_ROOT, 'cli.mjs'), 'check-fixtures', '--corpus', fixtureDir('valid-synthetic')],
    { encoding: 'utf8', env: { ...process.env, RETRO_VALIDATE_ACCESS_LOG_PATH: ACCESS_LOG_PATH } },
  );
  assert.equal(result.status, EXIT_OK, `stderr: ${result.stderr}`);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.corpusId, 'ef-retro-valid-synthetic');
  assert.equal(summary.caseCount, 2);
  assert.equal(summary.provenanceClass, 'synthetic');
});

test('CLI: `check-fixtures --corpus <identifier-name>` exits 2 (boundary) and prints no summary (subprocess)', () => {
  const result = spawnSync(
    process.execPath,
    [path.join(RETRO_VALIDATE_ROOT, 'cli.mjs'), 'check-fixtures', '--corpus', fixtureDir('identifier-name')],
    { encoding: 'utf8', env: { ...process.env, RETRO_VALIDATE_ACCESS_LOG_PATH: ACCESS_LOG_PATH } },
  );
  assert.equal(result.status, EXIT_BOUNDARY, `stderr: ${result.stderr}`);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /BoundaryError/);
});

// -------------------------------------------------------------------------------------------
// R-P2: missing `provenance` marker is rejected.
// -------------------------------------------------------------------------------------------

test('a case missing the required `provenance` marker is rejected by the schema (R-P2)', async () => {
  const schema = await loadFixtureCorpusSchema();
  const { parsed } = await loadCorpusDocument(fixtureDir('missing-provenance'));
  const errors = validate(schema, parsed);
  assert.ok(errors.length > 0);
  assert.ok(
    errors.some((e) => e.path.includes('provenance') && e.message.includes('required')),
    `expected a required-property error naming provenance, got: ${JSON.stringify(errors)}`,
  );
});

test('check-fixtures verb fail-closed rejects a corpus with a case missing `provenance` (exit 2, no summary)', async () => {
  await assert.rejects(
    () => runCheckFixtures({ corpus: fixtureDir('missing-provenance'), accessLogPath: ACCESS_LOG_PATH }),
    (err) => {
      assert.ok(err instanceof BoundaryError);
      assert.equal(err.exitCode, EXIT_BOUNDARY);
      return true;
    },
  );
});

// -------------------------------------------------------------------------------------------
// Identifier-field denylist: >=6 classes, one seeded fixture each (5 field-name-based +
// 1 value-pattern-based, per this task's own AC wording).
// -------------------------------------------------------------------------------------------

const IDENTIFIER_FIXTURE_CLASSES = [
  { name: 'name', dir: 'identifier-name' },
  { name: 'MRN', dir: 'identifier-mrn' },
  { name: 'DOB', dir: 'identifier-dob' },
  { name: 'address', dir: 'identifier-address' },
  { name: 'contact', dir: 'identifier-contact' },
  { name: 'SSN-like pattern', dir: 'identifier-ssn-pattern' },
];

assert.ok(IDENTIFIER_FIXTURE_CLASSES.length >= 6, 'sanity: this task requires >=6 identifier classes');

for (const { name, dir } of IDENTIFIER_FIXTURE_CLASSES) {
  test(`identifier-field denylist class "${name}": seeded fixture is rejected by the schema`, async () => {
    const schema = await loadFixtureCorpusSchema();
    const { parsed } = await loadCorpusDocument(fixtureDir(dir));
    const errors = validate(schema, parsed);
    assert.ok(errors.length > 0, `expected schema validation to reject fixture "${dir}"`);
  });

  test(`identifier-field denylist class "${name}": check-fixtures verb fails closed (BoundaryError, exit 2)`, async () => {
    await assert.rejects(
      () => checkFixtures(fixtureDir(dir)),
      (err) => {
        assert.ok(err instanceof BoundaryError);
        assert.equal(err.exitCode, EXIT_BOUNDARY);
        return true;
      },
    );
  });
}

// -------------------------------------------------------------------------------------------
// `report` (still scaffold-only, lands in P4-T4): given a corpus that PASSES the FR-20 boundary
// check, it still throws NotImplementedError, not a silent no-op. `run` landed its real
// post-boundary logic in P4-T3 (candidate resolution + replay) -- it no longer reaches this
// scaffold placeholder once the boundary clears; see tests/ef-retro-determinism.test.mjs for its
// own ACs, and tests/ef-retro-boundary.test.mjs for the updated (P4-T3) `run`-vs-`report`
// post-boundary expectation split. Their shared P4-T2 boundary-first hardening (call-order proof,
// refusal on a missing/failing corpus, all 3 rejection classes) is exercised in full by
// tests/ef-retro-boundary.test.mjs; this file only proves the CORPUS + BOUNDARY modules in
// isolation (this task's own scope, P4-T1).
// -------------------------------------------------------------------------------------------

test('`run` verb: given a corpus that passes the boundary check, requires --candidate-digest/--registry (P4-T3 landed; UsageError, not NotImplementedError)', async () => {
  await assert.rejects(
    () => runRunVerb({ corpus: fixtureDir('valid-synthetic'), accessLogPath: ACCESS_LOG_PATH }),
    (err) => {
      assert.ok(err instanceof UsageError);
      assert.ok(!(err instanceof NotImplementedError), '`run` has real post-boundary logic since P4-T3');
      assert.equal(err.exitCode, EXIT_USAGE);
      return true;
    },
  );
});

test('`report` verb: given a corpus that passes the boundary check, still throws NotImplementedError (exit 1)', async () => {
  await assert.rejects(
    () => runReportVerb({ corpus: fixtureDir('valid-synthetic'), accessLogPath: ACCESS_LOG_PATH }),
    (err) => {
      assert.ok(err instanceof NotImplementedError);
      assert.equal(err.exitCode, EXIT_USAGE);
      return true;
    },
  );
});

// -------------------------------------------------------------------------------------------
// Zero network calls / zero LLM-SDK calls (structural + runtime), matching
// tests/ef-converter-invariants.test.mjs's own two-layer proof for tools/rf-bundle-to-kb-pack/.
// -------------------------------------------------------------------------------------------

test('zero-network: check-fixtures (pass and fail paths) makes zero outbound network calls', async () => {
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalFetch = globalThis.fetch;
  let calls = 0;

  http.request = (...args) => {
    calls += 1;
    return originalHttpRequest.apply(http, args);
  };
  https.request = (...args) => {
    calls += 1;
    return originalHttpsRequest.apply(https, args);
  };
  if (typeof originalFetch === 'function') {
    globalThis.fetch = (...args) => {
      calls += 1;
      return originalFetch.apply(globalThis, args);
    };
  }

  try {
    await checkFixtures(fixtureDir('valid-synthetic'));
    await assert.rejects(() => checkFixtures(fixtureDir('identifier-name')));
  } finally {
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    if (typeof originalFetch === 'function') globalThis.fetch = originalFetch;
  }

  assert.equal(calls, 0, 'check-fixtures (pass + fail) combined must make zero outbound network calls');
});

test('zero-network/zero-LLM: no file under tools/retro-validate/ imports a network or AI/model-SDK module (structural)', async () => {
  const files = await collectSourceFiles(RETRO_VALIDATE_ROOT);
  assert.ok(files.length > 0, 'sanity: the retro-validate source tree must not be empty');

  const forbidden = [
    /^\s*import\b[^;]*from\s+['"](?:node:)?http['"]/m,
    /^\s*import\b[^;]*from\s+['"](?:node:)?https['"]/m,
    /^\s*import\b[^;]*from\s+['"](?:node:)?dgram['"]/m,
    /^\s*import\b[^;]*from\s+['"]@anthropic-ai\/[^'"]*['"]/m,
    /^\s*import\b[^;]*from\s+['"]openai['"]/m,
    /(?<!\/\/[^\n]*)\bfetch\s*\(/,
  ];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(source), `${path.relative(REPO_ROOT, file)} matches forbidden pattern ${pattern} (network/AI-SDK import)`);
    }
  }
});

// -------------------------------------------------------------------------------------------
// Schema location sanity (tool-local by design -- ADR-0006's file-disjoint parallel-workstream
// rule: no Phase-4 task touches scripts/validate-kb.mjs or a schema under the shared schemas/
// directory).
// -------------------------------------------------------------------------------------------

test('the fixture-corpus schema lives under tools/retro-validate/schemas/, not the shared schemas/ dir', () => {
  const relative = path.relative(REPO_ROOT, FIXTURE_CORPUS_SCHEMA_PATH);
  assert.equal(relative, path.join('tools', 'retro-validate', 'schemas', 'fixture-corpus.schema.json'));
});
