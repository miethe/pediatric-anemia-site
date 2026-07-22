// tests/ef-converter-verify.test.mjs — P2-T7: `verify` verb, structural pre-check (02 §4.5).
//
// Task acceptance criteria (phase-1-2-foundation-converter.md, row P2-T7):
//   1. "`verify` exits 0 against a structurally sound fixture and non-zero against a
//      seeded-malformed one" — asserted below with a synthetic `--pack` directory whose
//      `rules.json` is, respectively, schema-valid and the P1-T5 seeded-bad-rule fixture
//      (tests/fixtures/invalid-rule/SYNTHETIC-INVALID-EXTRA-PROP-001.json.txt, an otherwise
//      schema-legal rule with one illegal extra top-level property).
//   2. (P5-T1 closed the former stub here — see tests/ef-converter-release-manifest.test.mjs and
//      tests/release-manifest-schema.test.mjs for the dedicated coverage of that task) — this file
//      keeps only the `verify`-verb-level proof: a present, schema-valid manifest is reported
//      `validated: true`; a present, schema-INVALID manifest throws (`ReleaseManifestValidationError`,
//      exit 2) rather than being silently accepted; and an absent manifest is still a vacuous pass.
//
// This suite covers the `verify` verb in isolation, the same convention `tests/ef-converter-
// inspect.test.mjs` (P2-T6) and its siblings already document for themselves — it is deliberately
// NOT `tests/ef-converter-invariants.test.mjs` (P2-T8's separate seam task).
//
// No `propose` verb exists yet (Phase 3) to build a real `build/kb-pack/...` directory, so every
// "pack" fixture here is a throwaway temp directory this test constructs by hand — `verify` itself
// does not care whether `rules.json` was drafted by `propose` or written directly, the same
// convention `tests/rule-schema-seeded-invalid.test.mjs` already established for `validateModule`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  run as runVerify,
  checkRulesJsonShape,
  PackNotFoundError,
  RuleSchemaNotFoundError,
  RulesJsonValidationError,
  ReleaseManifestParseError,
  ReleaseManifestValidationError,
} from '../tools/rf-bundle-to-kb-pack/lib/verbs/verify.mjs';
import {
  UsageError,
  SchemaError,
  EXIT_OK,
  EXIT_USAGE,
  EXIT_SCHEMA,
} from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULE_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'rule.schema.json');
const CONVERTER_ROOT = path.join(REPO_ROOT, 'tools', 'rf-bundle-to-kb-pack');
// Deliberately `.json.txt`, not `.json` — see tests/rule-schema-seeded-invalid.test.mjs's own
// header for why (this fixture must not be swept by scripts/rule-coverage.mjs's `*.json` glob).
const INVALID_RULE_FIXTURE = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'invalid-rule', 'SYNTHETIC-INVALID-EXTRA-PROP-001.json.txt',
);

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

/** A throwaway `--pack` directory. `rulesArray === undefined` leaves `rules.json` absent entirely
 * (this phase's "no propose output exists yet" case). */
async function makeTempPack(rulesArray) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ef-verify-test-pack-'));
  if (rulesArray !== undefined) {
    await writeFile(path.join(dir, 'rules.json'), JSON.stringify(rulesArray, null, 2), 'utf8');
  }
  return dir;
}

/** Captures everything written to `process.stdout.write` while `fn` runs, then restores it. */
async function withCapturedStdout(fn) {
  const chunks = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    return true;
  };
  try {
    const result = await fn();
    return { result, output: chunks.join('') };
  } finally {
    process.stdout.write = original;
  }
}

// ----- AC 1a: exits 0 against a structurally sound fixture --------------------------------------

test('P2-T7: verify exits 0 against a structurally sound pack (rules.json entries all validate)', async () => {
  const rules = await loadJson(path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json'));
  const dir = await makeTempPack(rules.slice(0, 5)); // a handful is enough to prove the path works
  try {
    const { result: exitCode, output } = await withCapturedStdout(() =>
      runVerify({ pack: dir, ruleSchema: RULE_SCHEMA_PATH }),
    );
    assert.equal(exitCode, EXIT_OK);
    const summary = JSON.parse(output);
    assert.equal(summary.verb, 'verify');
    assert.equal(summary.rulesJson.present, true);
    assert.equal(summary.rulesJson.count, 5);
    assert.equal(summary.rulesJson.valid, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('P2-T7: verify exits 0 (vacuous pass) against a pack with no rules.json yet (no propose output exists in Phase 2)', async () => {
  const dir = await makeTempPack(undefined);
  try {
    const { result: exitCode, output } = await withCapturedStdout(() =>
      runVerify({ pack: dir, ruleSchema: RULE_SCHEMA_PATH }),
    );
    assert.equal(exitCode, EXIT_OK);
    const summary = JSON.parse(output);
    assert.equal(summary.rulesJson.present, false);
    assert.equal(summary.rulesJson.count, 0);
    assert.equal(summary.rulesJson.valid, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('P2-T7: verify exits 0 against the real, committed modules/cbc_suite_v1/rules.json (Phase 4 migrates slice rules in; count and rules must all still validate)', async () => {
  const rules = await loadJson(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'rules.json'));
  // Phase 4 (P4-T1..T4) migrates exactly the 4 named slice rules into this file over several
  // tasks — do not hardcode a specific count here (this test would go stale after every one of
  // those tasks lands); assert only that whatever is committed is schema-valid, matching
  // `verify`'s own actual contract.
  const dir = await makeTempPack(rules);
  try {
    const { result: exitCode, output } = await withCapturedStdout(() =>
      runVerify({ pack: dir, ruleSchema: RULE_SCHEMA_PATH }),
    );
    assert.equal(exitCode, EXIT_OK);
    const summary = JSON.parse(output);
    assert.equal(summary.rulesJson.count, rules.length);
    assert.equal(summary.rulesJson.valid, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ----- AC 1b: exits non-zero against a seeded-malformed one --------------------------------------

test('P2-T7: verify exits non-zero (SchemaError, exit 2) against a seeded-malformed pack (additionalProperties violation)', async () => {
  const badRule = await loadJson(INVALID_RULE_FIXTURE);
  assert.ok(Object.hasOwn(badRule, 'notAllowedExtraField'), 'sanity: fixture must carry its seeded defect');
  const dir = await makeTempPack([badRule]);
  try {
    await assert.rejects(
      () => runVerify({ pack: dir, ruleSchema: RULE_SCHEMA_PATH }),
      (err) => {
        assert.ok(err instanceof RulesJsonValidationError);
        assert.ok(err instanceof SchemaError);
        assert.equal(err.exitCode, EXIT_SCHEMA);
        assert.equal(err.violations.length, 1);
        assert.equal(err.violations[0].ruleId, 'SYNTHETIC-INVALID-EXTRA-PROP-001');
        assert.match(err.message, /notAllowedExtraField/);
        assert.match(err.message, /additional property is not permitted/);
        return true;
      },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('P2-T7: a malformed pack produces NO printed summary (fails closed before stdout is written)', async () => {
  const badRule = await loadJson(INVALID_RULE_FIXTURE);
  const dir = await makeTempPack([badRule]);
  try {
    const { output } = await withCapturedStdout(async () => {
      try {
        await runVerify({ pack: dir, ruleSchema: RULE_SCHEMA_PATH });
      } catch {
        // expected — verify's own top-level cli.mjs dispatch handles the exit code/stderr message
      }
    });
    assert.equal(output, '', 'verify must not print a summary once it has decided to fail closed');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ----- Usage errors (fail closed, never a generic crash) ----------------------------------------

test('P2-T7: verify requires --pack and --rule-schema (usage error, not a stack trace)', async () => {
  await assert.rejects(() => runVerify({}), (err) => {
    assert.ok(err instanceof UsageError);
    assert.equal(err.exitCode, EXIT_USAGE);
    return true;
  });
  await assert.rejects(() => runVerify({ pack: '/tmp/whatever' }), UsageError);
  await assert.rejects(() => runVerify({ ruleSchema: RULE_SCHEMA_PATH }), UsageError);
});

test('P2-T7: verify fails closed (PackNotFoundError) when --pack does not exist', async () => {
  const missing = path.join(os.tmpdir(), `ef-verify-does-not-exist-${Date.now()}`);
  await assert.rejects(
    () => runVerify({ pack: missing, ruleSchema: RULE_SCHEMA_PATH }),
    (err) => {
      assert.ok(err instanceof PackNotFoundError);
      assert.equal(err.exitCode, EXIT_USAGE);
      return true;
    },
  );
});

test('P2-T7: verify fails closed (RuleSchemaNotFoundError) when --rule-schema does not exist', async () => {
  const dir = await makeTempPack(undefined);
  try {
    await assert.rejects(
      () => runVerify({ pack: dir, ruleSchema: path.join(dir, 'does-not-exist.schema.json') }),
      (err) => {
        assert.ok(err instanceof RuleSchemaNotFoundError);
        assert.equal(err.exitCode, EXIT_USAGE);
        return true;
      },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ----- AC 2: release-manifest.unsigned.json content validation (P5-T1, closing the former stub) -

const VALID_RELEASE_MANIFEST = {
  schemaVersion: '1.0',
  moduleId: 'cbc_suite_v1',
  packVersion: '0.1.0-proposal',
  rfInputs: [{
    runId: 'rf_run_test',
    bundleSha256: `sha256:${'a'.repeat(64)}`,
    claimLedgerSha256: `sha256:${'b'.repeat(64)}`,
    verificationExitCode: 0,
  }],
  converter: { name: 'rf-bundle-to-kb-pack', version: '0.1.0', configSha256: `sha256:${'c'.repeat(64)}` },
  testCorpusHash: `sha256:${'d'.repeat(64)}`,
  traceabilityHash: `sha256:${'e'.repeat(64)}`,
};

test('P5-T1: a present, schema-valid release-manifest.unsigned.json is reported validated: true', async () => {
  const dir = await makeTempPack([]);
  await writeFile(
    path.join(dir, 'release-manifest.unsigned.json'),
    JSON.stringify(VALID_RELEASE_MANIFEST),
    'utf8',
  );
  try {
    const { result: exitCode, output } = await withCapturedStdout(() =>
      runVerify({ pack: dir, ruleSchema: RULE_SCHEMA_PATH }),
    );
    assert.equal(exitCode, EXIT_OK);
    const summary = JSON.parse(output);
    assert.equal(summary.releaseManifest.present, true);
    assert.equal(summary.releaseManifest.validated, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('P5-T1: a present, schema-INVALID release-manifest.unsigned.json throws (ReleaseManifestValidationError, exit 2) — never a silent pass', async () => {
  const dir = await makeTempPack([]);
  const badManifest = JSON.parse(JSON.stringify(VALID_RELEASE_MANIFEST));
  delete badManifest.rfInputs[0].bundleSha256;
  await writeFile(path.join(dir, 'release-manifest.unsigned.json'), JSON.stringify(badManifest), 'utf8');
  try {
    await assert.rejects(
      () => runVerify({ pack: dir, ruleSchema: RULE_SCHEMA_PATH }),
      (err) => {
        assert.ok(err instanceof ReleaseManifestValidationError);
        assert.ok(err instanceof SchemaError);
        assert.equal(err.exitCode, EXIT_SCHEMA);
        assert.match(err.message, /bundleSha256/);
        return true;
      },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('P5-T1: a present but unparseable release-manifest.unsigned.json throws (ReleaseManifestParseError, exit 2)', async () => {
  const dir = await makeTempPack([]);
  await writeFile(path.join(dir, 'release-manifest.unsigned.json'), '{ this is not valid json', 'utf8');
  try {
    await assert.rejects(
      () => runVerify({ pack: dir, ruleSchema: RULE_SCHEMA_PATH }),
      (err) => {
        assert.ok(err instanceof ReleaseManifestParseError);
        assert.ok(err instanceof SchemaError);
        assert.equal(err.exitCode, EXIT_SCHEMA);
        return true;
      },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('P5-T1: release-manifest.unsigned.json absent is reported as such, not conflated with "validated"', async () => {
  const dir = await makeTempPack(undefined);
  try {
    const { output } = await withCapturedStdout(() => runVerify({ pack: dir, ruleSchema: RULE_SCHEMA_PATH }));
    const summary = JSON.parse(output);
    assert.equal(summary.releaseManifest.present, false);
    assert.equal(summary.releaseManifest.validated, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ----- checkRulesJsonShape: pure function, no I/O ------------------------------------------------

test('P2-T7: checkRulesJsonShape is a pure function of its inputs (no I/O) and matches all 91 committed modules/anemia rules', async () => {
  const schema = await loadJson(RULE_SCHEMA_PATH);
  const rules = await loadJson(path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json'));
  const reportA = checkRulesJsonShape('irrelevant-for-this-call', rules, schema);
  const reportB = checkRulesJsonShape('irrelevant-for-this-call', rules, schema);
  assert.deepEqual(reportA, reportB);
  assert.equal(reportA.present, true);
  assert.equal(reportA.count, 91);
  assert.deepEqual(reportA.errors, []);
});

// ----- Zero network calls (same posture as every verb in this tool) ------------------------------

test('P2-T7: verify makes zero outbound network calls (http.request/https.request/fetch never invoked)', async () => {
  const dir = await makeTempPack([]);
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalFetch = globalThis.fetch;
  let httpCalls = 0;
  let httpsCalls = 0;
  let fetchCalls = 0;

  http.request = (...args) => {
    httpCalls += 1;
    return originalHttpRequest.apply(http, args);
  };
  https.request = (...args) => {
    httpsCalls += 1;
    return originalHttpsRequest.apply(https, args);
  };
  if (typeof originalFetch === 'function') {
    globalThis.fetch = (...args) => {
      fetchCalls += 1;
      return originalFetch.apply(globalThis, args);
    };
  }

  try {
    await withCapturedStdout(() => runVerify({ pack: dir, ruleSchema: RULE_SCHEMA_PATH }));
  } finally {
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    if (typeof originalFetch === 'function') globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }

  assert.equal(httpCalls, 0, 'verify must never call http.request');
  assert.equal(httpsCalls, 0, 'verify must never call https.request');
  assert.equal(fetchCalls, 0, 'verify must never call fetch');
});

// Structural half of the "zero network/zero LLM" guarantee, matching
// tests/ef-converter-inspect.test.mjs's own copy of this scan verbatim (each verb-owning task's
// test file re-runs it against the whole converter tree so no single file's tests can drift the
// guarantee out from under a sibling's coverage).
async function collectConverterSourceFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectConverterSourceFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(full);
    }
  }
  return files;
}

const FORBIDDEN_IMPORT_PATTERNS = [
  /^\s*import\b[^;]*from\s+['"](?:node:)?http['"]/m,
  /^\s*import\b[^;]*from\s+['"](?:node:)?https['"]/m,
  /^\s*import\b[^;]*from\s+['"](?:node:)?dgram['"]/m,
  /^\s*import\b[^;]*from\s+['"]@anthropic-ai\/[^'"]*['"]/m,
  /^\s*import\b[^;]*from\s+['"]openai['"]/m,
  /(?<!\/\/[^\n]*)\bfetch\s*\(/,
];

test('P2-T7: no file under tools/rf-bundle-to-kb-pack/ imports a network or AI/model-SDK module (structural)', async () => {
  const files = await collectConverterSourceFiles(CONVERTER_ROOT);
  assert.ok(files.length > 0, 'sanity: the converter source tree must not be empty');

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      assert.ok(
        !pattern.test(source),
        `${path.relative(REPO_ROOT, file)} matches forbidden pattern ${pattern} (network/AI-SDK import)`,
      );
    }
  }
});
