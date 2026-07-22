// tests/ef-retro-boundary.test.mjs -- P4-T2 (Evidence Foundry E1 Phase 4, FR-20, ADR-0006 binding
// boundary clause).
//
// Proves this task's own acceptance criteria (phase-4-progress.md P4-T2 row):
//   1. `check-fixtures` is the structural gate every other verb (`run`, `report`) calls FIRST --
//      a call-order proof, not just "the boundary module exists".
//   2. `run`/`report` refuse to start (fail-closed, non-zero exit, no partial output) on:
//        (a) an unchecked corpus -- no `--corpus` given at all;
//        (b) a failing corpus -- any of the 3 FR-20 rejection classes.
//      In every failing case the verb throws the boundary/usage error BEFORE it ever reaches its
//      own scaffold-only `NotImplementedError` placeholder.
//   3. All 3 rejection classes are seeded and proven to fail closed, each with a distinct,
//      class-identifiable error:
//        - an identifier-bearing case (represented by the `identifier-name` fixture; the full
//          >=6-class enumeration is tests/ef-retro-corpus.test.mjs's own AC, P4-T1);
//        - a case lacking its `provenance` marker (`missing-provenance` fixture);
//        - a corpus lacking corpus-level `sourceAttestation` entirely (`missing-source-attestation`
//          fixture -- new in this task).
//   4. The boundary is schema-enforced, not procedural: no file under tools/retro-validate/
//      implements ad hoc field-by-field identifier stripping/detection logic outside the JSON
//      Schema validation call.
//
// Schema/CORPUS-module-level proofs (schema loads, valid fixtures pass, the >=6 identifier
// classes, zero-network) already live in tests/ef-retro-corpus.test.mjs (P4-T1) and are not
// duplicated here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkFixtures } from '../tools/retro-validate/lib/boundary.mjs';
import { run as runRunVerb } from '../tools/retro-validate/lib/verbs/run.mjs';
import { run as runReportVerb } from '../tools/retro-validate/lib/verbs/report.mjs';
import { BoundaryError, UsageError, NotImplementedError, EXIT_BOUNDARY, EXIT_USAGE } from '../tools/retro-validate/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RETRO_VALIDATE_ROOT = path.join(REPO_ROOT, 'tools', 'retro-validate');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-retro');
const CLI_PATH = path.join(RETRO_VALIDATE_ROOT, 'cli.mjs');

function fixtureDir(name) {
  return path.join(FIXTURES_ROOT, name);
}

// P4-T7 (FR-22): `run`/`report` now access-log every invocation. This file's own AC is the
// boundary-gate call-order/refusal contract, not the access log itself (that is
// tests/ef-retro-access-log.test.mjs's job) -- so every verb call/CLI subprocess below is pointed
// at an isolated tmp log path, never the real committed tools/retro-validate/access-log.jsonl.
const ACCESS_LOG_TMP_DIR = await mkdtemp(path.join(os.tmpdir(), 'ef-retro-boundary-test-access-log-'));
const ACCESS_LOG_PATH = path.join(ACCESS_LOG_TMP_DIR, 'access-log.jsonl');
const ACCESS_LOG_ENV = { ...process.env, RETRO_VALIDATE_ACCESS_LOG_PATH: ACCESS_LOG_PATH };

// The 3 rejection classes named in this task's own AC wording. `identifier-name` stands in for
// the full identifier-field-denylist enumeration (>=6 classes, proven exhaustively in
// tests/ef-retro-corpus.test.mjs, P4-T1) -- this file's job is the call-order/refusal contract,
// not re-proving every identifier class fails closed.
const REJECTION_CLASSES = [
  { name: 'identifier-bearing case', dir: 'identifier-name', pathFragment: '.name' },
  { name: 'case lacking provenance marker', dir: 'missing-provenance', pathFragment: 'provenance' },
  { name: 'corpus lacking sourceAttestation', dir: 'missing-source-attestation', pathFragment: 'sourceAttestation' },
];

// -------------------------------------------------------------------------------------------
// AC 3: all 3 rejection classes fail closed, each with a distinct, class-identifiable error.
// -------------------------------------------------------------------------------------------

for (const { name, dir, pathFragment } of REJECTION_CLASSES) {
  test(`rejection class "${name}": checkFixtures throws BoundaryError naming the violated field (fail-closed)`, async () => {
    await assert.rejects(
      () => checkFixtures(fixtureDir(dir)),
      (err) => {
        assert.ok(err instanceof BoundaryError, `expected BoundaryError, got ${err?.constructor?.name}`);
        assert.equal(err.exitCode, EXIT_BOUNDARY);
        assert.ok(
          err.message.includes(pathFragment),
          `expected the error to name "${pathFragment}" (class-identifiable), got: ${err.message}`,
        );
        return true;
      },
    );
  });
}

test('the 3 rejection classes produce 3 distinguishable error messages (no single generic "rejected" string)', async () => {
  const messages = [];
  for (const { dir } of REJECTION_CLASSES) {
    try {
      await checkFixtures(fixtureDir(dir));
      assert.fail(`fixture "${dir}" was expected to fail the boundary check`);
    } catch (err) {
      messages.push(err.message);
    }
  }
  assert.equal(new Set(messages).size, messages.length, 'each rejection class must produce a distinct error message');
});

// -------------------------------------------------------------------------------------------
// AC 1 + 2: `run`/`report` call the boundary gate FIRST -- a failing corpus surfaces as
// BoundaryError, NEVER as NotImplementedError (i.e. the scaffold placeholder is unreachable past
// a failing/unchecked corpus).
// -------------------------------------------------------------------------------------------

const VERBS_UNDER_TEST = [
  { name: 'run', run: runRunVerb, ownerTask: 'P4-T3' },
  { name: 'report', run: runReportVerb, ownerTask: 'P4-T4' },
];

// P4-T3 landed `run`'s real post-boundary logic (candidate resolution + replay) -- it no longer
// falls through to the scaffold `NotImplementedError` the moment the boundary check clears; it now
// has its OWN next usage requirement (`--candidate-digest`/`--registry`). `report` still lands in
// P4-T4, so it is unchanged: reaching `NotImplementedError` (never `BoundaryError`/`UsageError`) is
// still the proof its own boundary gate cleared. See tests/ef-retro-determinism.test.mjs for
// `run`'s own real-replay ACs (candidate resolution, determinism, "never current tree").
const POST_BOUNDARY_EXPECTATION = {
  run: (err) => {
    assert.ok(err instanceof UsageError, `expected UsageError, got ${err?.constructor?.name}: ${err?.message}`);
    assert.ok(
      !(err instanceof NotImplementedError),
      '`run` has real post-boundary logic since P4-T3 -- a boundary-passing corpus must not fall through to the scaffold placeholder',
    );
    assert.equal(err.exitCode, EXIT_USAGE);
    assert.match(err.message, /--candidate-digest/, 'the next-required-flag error must name what is still missing');
  },
  report: (err) => {
    // Reaching NotImplementedError (rather than BoundaryError/UsageError) is itself the proof
    // that the boundary gate was cleared -- this verb's ONLY logic before its scaffold
    // placeholder is the checkFixtures() call (still true; P4-T4 has not landed).
    assert.ok(err instanceof NotImplementedError);
    assert.equal(err.exitCode, EXIT_USAGE);
  },
};

for (const { name: verbName, run: verbRun } of VERBS_UNDER_TEST) {
  for (const { name: className, dir } of REJECTION_CLASSES) {
    test(`\`${verbName}\` verb refuses to start on a failing corpus (${className}): throws BoundaryError, not NotImplementedError`, async () => {
      await assert.rejects(
        () => verbRun({ corpus: fixtureDir(dir), accessLogPath: ACCESS_LOG_PATH }),
        (err) => {
          assert.ok(err instanceof BoundaryError, `expected BoundaryError, got ${err?.constructor?.name}: ${err?.message}`);
          assert.ok(!(err instanceof NotImplementedError));
          assert.equal(err.exitCode, EXIT_BOUNDARY);
          return true;
        },
      );
    });
  }

  test(`\`${verbName}\` verb refuses to start on an UNCHECKED corpus (no --corpus given): throws UsageError, not NotImplementedError`, async () => {
    await assert.rejects(
      () => verbRun({ accessLogPath: ACCESS_LOG_PATH }),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.ok(!(err instanceof NotImplementedError), 'a missing --corpus must not fall through to the scaffold placeholder');
        assert.equal(err.exitCode, EXIT_USAGE);
        return true;
      },
    );
  });

  test(`\`${verbName}\` verb refuses to start on a nonexistent corpus directory: throws UsageError (no corpus.json found)`, async () => {
    await assert.rejects(
      () => verbRun({ corpus: fixtureDir('does-not-exist'), accessLogPath: ACCESS_LOG_PATH }),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.equal(err.exitCode, EXIT_USAGE);
        return true;
      },
    );
  });

  test(`\`${verbName}\` verb: once a corpus PASSES the boundary check, it proceeds past the gate to its own next logic`, async () => {
    await assert.rejects(
      () => verbRun({ corpus: fixtureDir('valid-synthetic'), accessLogPath: ACCESS_LOG_PATH }),
      (err) => {
        POST_BOUNDARY_EXPECTATION[verbName](err);
        return true;
      },
    );
  });
}

// -------------------------------------------------------------------------------------------
// AC 2 (fail-closed, no partial output): CLI subprocess-level proof for `run`/`report` -- exit
// code is EXIT_BOUNDARY (2), never EXIT_USAGE (1)'s NotImplementedError code, and stdout carries
// no partial output.
// -------------------------------------------------------------------------------------------

for (const verb of ['run', 'report']) {
  test(`CLI: \`${verb} --corpus <identifier-name>\` exits 2 (BOUNDARY), not 1 -- and prints no stdout (subprocess)`, () => {
    const result = spawnSync(
      process.execPath,
      [CLI_PATH, verb, '--corpus', fixtureDir('identifier-name')],
      { encoding: 'utf8', env: ACCESS_LOG_ENV },
    );
    assert.equal(result.status, EXIT_BOUNDARY, `stderr: ${result.stderr}`);
    assert.equal(result.stdout, '', 'no partial output on a fail-closed boundary rejection');
    assert.match(result.stderr, /BoundaryError/);
  });

  test(`CLI: \`${verb} --corpus <missing-source-attestation>\` exits 2 (BOUNDARY), not 1 -- and prints no stdout (subprocess)`, () => {
    const result = spawnSync(
      process.execPath,
      [CLI_PATH, verb, '--corpus', fixtureDir('missing-source-attestation')],
      { encoding: 'utf8', env: ACCESS_LOG_ENV },
    );
    assert.equal(result.status, EXIT_BOUNDARY, `stderr: ${result.stderr}`);
    assert.equal(result.stdout, '', 'no partial output on a fail-closed boundary rejection');
    assert.match(result.stderr, /BoundaryError/);
  });

  test(`CLI: \`${verb} --corpus <valid-synthetic>\` clears the boundary gate, then exits 1 (usage, not boundary)`, () => {
    const result = spawnSync(
      process.execPath,
      [CLI_PATH, verb, '--corpus', fixtureDir('valid-synthetic')],
      { encoding: 'utf8', env: ACCESS_LOG_ENV },
    );
    assert.equal(result.status, EXIT_USAGE, `stderr: ${result.stderr}`);
    assert.equal(result.stdout, '');
    // `run` (P4-T3, landed) next requires --candidate-digest/--registry -- a plain UsageError, not
    // the scaffold NotImplementedError `report` (P4-T4, not yet landed) still throws.
    assert.match(result.stderr, verb === 'run' ? /UsageError/ : /NotImplementedError/);
  });
}

// -------------------------------------------------------------------------------------------
// AC 4: schema-enforced (not procedural) -- no file under tools/retro-validate/ implements its
// own ad hoc identifier-detection/redaction logic; the ONLY de-identification-boundary logic path
// is the json-schema-lite `validate()` call inside lib/boundary.mjs.
// -------------------------------------------------------------------------------------------

test('schema-enforced, not procedural: no file under tools/retro-validate/ hand-implements identifier-field detection outside boundary.mjs\'s schema-validate call', async () => {
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

  // A hand-maintained identifier-field denylist (e.g. a literal array of field names checked with
  // string comparisons/regex against object keys, rather than delegating to the schema) would be
  // exactly the procedural pattern ADR-0006 and this task's own description rule out. The schema
  // file itself (fixture-corpus.schema.json) is exempt -- it IS the structural enforcement
  // mechanism, not a bypass of it.
  const proceduralPatterns = [
    /Object\.keys\([^)]*\)\.filter\([^)]*(?:name|mrn|dob|ssn|address|contact)/i,
    /delete\s+\w+\.(?:name|mrn|dob|ssn|address|contact)/i,
  ];

  const files = await collectSourceFiles(RETRO_VALIDATE_ROOT);
  const mjsFiles = files.filter((f) => !f.endsWith('.json'));
  assert.ok(mjsFiles.length > 0, 'sanity: the retro-validate source tree must not be empty');

  for (const file of mjsFiles) {
    const source = await readFile(file, 'utf8');
    for (const pattern of proceduralPatterns) {
      assert.ok(
        !pattern.test(source),
        `${path.relative(REPO_ROOT, file)} appears to hand-implement identifier-field logic (matches ${pattern}) -- the boundary must be schema-enforced only`,
      );
    }
  }
});

test('the only caller of boundary.mjs#checkFixtures in tools/retro-validate/ is check-fixtures.mjs, run.mjs, and report.mjs', async () => {
  async function collectSourceFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectSourceFiles(full)));
      } else if (entry.name.endsWith('.mjs') && !full.endsWith(`${path.sep}boundary.mjs`)) {
        files.push(full);
      }
    }
    return files;
  }

  const files = await collectSourceFiles(RETRO_VALIDATE_ROOT);
  const callers = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (/\bcheckFixtures\s*\(/.test(source)) {
      callers.push(path.relative(RETRO_VALIDATE_ROOT, file));
    }
  }
  callers.sort();
  assert.deepEqual(
    callers,
    [path.join('lib', 'verbs', 'check-fixtures.mjs'), path.join('lib', 'verbs', 'report.mjs'), path.join('lib', 'verbs', 'run.mjs')],
    'checkFixtures must be called by exactly the 3 verb handlers -- no other file bypasses or duplicates the gate',
  );
});
