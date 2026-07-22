// tests/ef-retro-access-log.test.mjs -- P4-T7 (Evidence Foundry E1 Phase 4, FR-22, ADR-0006 audit
// clause).
//
// Proves this task's own acceptance criteria (phase-4-progress.md / phase-2-4-workstreams.md
// P4-T7 row):
//   1. Each of the 3 data-touching verbs (check-fixtures, run, report) appends EXACTLY ONE entry
//      per invocation -- success, boundary-rejection, and usage-rejection paths all included.
//   2. A seeded entry mutation (an already-written line altered after the fact) is REJECTED by the
//      hash-chain verifier, fail-closed (`verifyAccessLogChain` throws `AccessLogChainError`).
//   3. Zero overlap between the access log and the review-record chain: distinct schema files,
//      distinct on-disk paths, no cross-`$ref`, no cross-import between the two tools.
//   4. No case-level data can ever occupy an access-log entry: the schema's closed property set
//      structurally forbids it (an extra case-shaped key is rejected exactly like an unsupported
//      keyword would be).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import {
  loadAccessLogEntrySchema,
  appendAccessLogEntry,
  verifyAccessLogChain,
  logAccessAttempt,
  resolveActor,
  resolvePurpose,
  resolveAccessLogPath,
  AccessLogChainError,
  AccessLogEntryError,
  ACCESS_LOG_ENTRY_SCHEMA_PATH,
  DEFAULT_ACCESS_LOG_PATH,
  ACTOR_ENV_VAR,
  PURPOSE_ENV_VAR,
  ACCESS_LOG_PATH_ENV_VAR,
  UNKNOWN_ACTOR,
  UNSPECIFIED_PURPOSE,
  UNSPECIFIED_CORPUS,
} from '../tools/retro-validate/lib/access-log.mjs';
import { run as runCheckFixtures } from '../tools/retro-validate/lib/verbs/check-fixtures.mjs';
import { run as runRunVerb } from '../tools/retro-validate/lib/verbs/run.mjs';
import { run as runReportVerb } from '../tools/retro-validate/lib/verbs/report.mjs';
import { UsageError } from '../tools/retro-validate/lib/errors.mjs';
import { FIXTURE_CORPUS_SCHEMA_PATH } from '../tools/retro-validate/lib/corpus.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RETRO_VALIDATE_ROOT = path.join(REPO_ROOT, 'tools', 'retro-validate');
const REVIEW_RECORD_ROOT = path.join(REPO_ROOT, 'tools', 'review-record');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-retro');
const CLI_PATH = path.join(RETRO_VALIDATE_ROOT, 'cli.mjs');
const REVIEW_RECORD_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');

function fixtureDir(name) {
  return path.join(FIXTURES_ROOT, name);
}

async function freshLogPath(prefix) {
  const dir = await mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  return path.join(dir, 'access-log.jsonl');
}

async function readEntries(logPath) {
  const raw = await readFile(logPath, 'utf8');
  return raw.split('\n').filter((l) => l.length > 0).map((l) => JSON.parse(l));
}

// -------------------------------------------------------------------------------------------
// Schema self-check + entry shape.
// -------------------------------------------------------------------------------------------

test('access-log-entry schema loads without an unsupported-keyword error', async () => {
  const schema = await loadAccessLogEntrySchema();
  assert.doesNotThrow(() => validate(schema, {
    schemaVersion: 1,
    timestamp: '2026-07-22T00:00:00.000Z',
    actor: 'test-actor',
    purpose: 'test-purpose',
    corpusId: 'some/corpus/dir',
    verb: 'check-fixtures',
    prevEntryHash: null,
  }));
});

test('appendAccessLogEntry writes one entry validating cleanly against its own schema', async () => {
  const logPath = await freshLogPath('ef-access-log-shape');
  const entry = await appendAccessLogEntry({
    verb: 'check-fixtures',
    corpusId: 'tests/fixtures/ef-retro/valid-synthetic',
    actor: 'nick',
    purpose: 'unit test',
    accessLogPath: logPath,
  });
  const schema = await loadAccessLogEntrySchema();
  assert.deepEqual(validate(schema, entry), []);
  assert.equal(entry.prevEntryHash, null, 'the first entry in a fresh log has no predecessor');

  const onDisk = await readEntries(logPath);
  assert.equal(onDisk.length, 1);
  assert.deepEqual(onDisk[0], entry);
});

test('appendAccessLogEntry rejects a verb outside the 3-verb allowlist', async () => {
  const logPath = await freshLogPath('ef-access-log-badverb');
  await assert.rejects(
    () => appendAccessLogEntry({ verb: 'delete-everything', accessLogPath: logPath }),
    (err) => {
      assert.ok(err instanceof UsageError);
      return true;
    },
  );
});

test('an access-log entry with an extra (case-shaped) key is rejected by the schema -- structural, not procedural', async () => {
  const schema = await loadAccessLogEntrySchema();
  const entryWithCaseData = {
    schemaVersion: 1,
    timestamp: '2026-07-22T00:00:00.000Z',
    actor: 'nick',
    purpose: 'unit test',
    corpusId: 'some-corpus',
    verb: 'check-fixtures',
    prevEntryHash: null,
    caseId: 'smuggled-case-level-field',
  };
  const errors = validate(schema, entryWithCaseData);
  assert.ok(errors.length > 0, 'an entry carrying an extra key must fail additionalProperties:false');
});

// -------------------------------------------------------------------------------------------
// AC 1: each of the 3 verbs appends EXACTLY ONE entry per invocation, across success, boundary
// rejection, and usage rejection.
// -------------------------------------------------------------------------------------------

const VERBS = [
  { name: 'check-fixtures', run: runCheckFixtures },
  { name: 'run', run: runRunVerb },
  { name: 'report', run: runReportVerb },
];

for (const { name: verbName, run: verbRun } of VERBS) {
  test(`\`${verbName}\`: a successful/boundary-cleared invocation appends exactly one entry`, async () => {
    const logPath = await freshLogPath(`ef-access-log-${verbName}-ok`);
    await verbRun({ corpus: fixtureDir('valid-synthetic'), accessLogPath: logPath, actor: 'a1', purpose: 'p1' }).catch(() => {});
    const entries = await readEntries(logPath);
    assert.equal(entries.length, 1, `expected exactly one access-log entry for one \`${verbName}\` invocation`);
    assert.equal(entries[0].verb, verbName);
    assert.equal(entries[0].corpusId, fixtureDir('valid-synthetic'));
    assert.equal(entries[0].actor, 'a1');
    assert.equal(entries[0].purpose, 'p1');
  });

  test(`\`${verbName}\`: a boundary-rejected invocation (identifier-bearing corpus) still appends exactly one entry`, async () => {
    const logPath = await freshLogPath(`ef-access-log-${verbName}-boundary`);
    await assert.rejects(() => verbRun({ corpus: fixtureDir('identifier-name'), accessLogPath: logPath }));
    const entries = await readEntries(logPath);
    assert.equal(entries.length, 1, 'a fail-closed rejection is itself an auditable event -- it must still be logged');
    assert.equal(entries[0].corpusId, fixtureDir('identifier-name'));
  });

  test(`\`${verbName}\`: an invocation with NO --corpus at all still appends exactly one entry (corpusId "unspecified")`, async () => {
    const logPath = await freshLogPath(`ef-access-log-${verbName}-nocorpus`);
    await assert.rejects(() => verbRun({ accessLogPath: logPath }));
    const entries = await readEntries(logPath);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].corpusId, UNSPECIFIED_CORPUS);
    assert.equal(entries[0].actor, UNKNOWN_ACTOR);
    assert.equal(entries[0].purpose, UNSPECIFIED_PURPOSE);
  });
}

test('CLI: `check-fixtures --corpus <valid-synthetic>` (subprocess) appends exactly one entry via RETRO_VALIDATE_ACCESS_LOG_PATH', async () => {
  const logPath = await freshLogPath('ef-access-log-cli');
  const result = spawnSync(
    process.execPath,
    [CLI_PATH, 'check-fixtures', '--corpus', fixtureDir('valid-synthetic'), '--actor', 'cli-actor', '--purpose', 'cli-purpose'],
    { encoding: 'utf8', env: { ...process.env, RETRO_VALIDATE_ACCESS_LOG_PATH: logPath } },
  );
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const entries = await readEntries(logPath);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].actor, 'cli-actor');
  assert.equal(entries[0].purpose, 'cli-purpose');
});

test('two sequential invocations against the same log path append two chained entries (second links to the first)', async () => {
  const logPath = await freshLogPath('ef-access-log-sequence');
  await runCheckFixtures({ corpus: fixtureDir('valid-synthetic'), accessLogPath: logPath });
  await assert.rejects(() => runRunVerb({ corpus: fixtureDir('identifier-name'), accessLogPath: logPath }));

  const entries = await readEntries(logPath);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].prevEntryHash, null);
  assert.notEqual(entries[1].prevEntryHash, null);

  const chainResult = await verifyAccessLogChain(logPath);
  assert.deepEqual(chainResult, { ok: true, entryCount: 2 });
});

// -------------------------------------------------------------------------------------------
// AC 2: append-only enforcement -- a seeded mutation of an already-written entry is rejected,
// fail-closed, by the hash-chain verifier. Same enforcement SHAPE
// tools/review-record/lib/chain.mjs documents for its own per-file OQ-2 chain, adapted to a
// within-file, per-line chain (this module's own header explains why).
// -------------------------------------------------------------------------------------------

test('an empty/nonexistent access log verifies as ok with entryCount 0', async () => {
  const logPath = await freshLogPath('ef-access-log-empty');
  const result = await verifyAccessLogChain(logPath);
  assert.deepEqual(result, { ok: true, entryCount: 0 });
});

test('a clean, untouched multi-entry log verifies ok', async () => {
  const logPath = await freshLogPath('ef-access-log-clean');
  await appendAccessLogEntry({ verb: 'check-fixtures', corpusId: 'c1', accessLogPath: logPath });
  await appendAccessLogEntry({ verb: 'run', corpusId: 'c2', accessLogPath: logPath });
  await appendAccessLogEntry({ verb: 'report', corpusId: 'c3', accessLogPath: logPath });
  const result = await verifyAccessLogChain(logPath);
  assert.deepEqual(result, { ok: true, entryCount: 3 });
});

test('seeded entry mutation is rejected fail-closed by verifyAccessLogChain (AccessLogChainError)', async () => {
  const logPath = await freshLogPath('ef-access-log-tamper');
  await appendAccessLogEntry({ verb: 'check-fixtures', corpusId: 'c1', purpose: 'original', accessLogPath: logPath });
  await appendAccessLogEntry({ verb: 'run', corpusId: 'c2', accessLogPath: logPath });
  await appendAccessLogEntry({ verb: 'report', corpusId: 'c3', accessLogPath: logPath });

  // Seed a mutation: tamper the FIRST entry's `purpose` in place, leaving every other byte
  // (including the untouched later lines and their prevEntryHash values) exactly as written --
  // exactly the class of tamper the chain exists to catch, since nothing about the file's own
  // shape (still valid JSONL, still schema-valid per line) reveals the mutation without
  // recomputing the chain.
  const raw = await readFile(logPath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.length > 0);
  const tamperedFirst = JSON.parse(lines[0]);
  tamperedFirst.purpose = 'TAMPERED';
  lines[0] = JSON.stringify(tamperedFirst);
  await writeFile(logPath, `${lines.join('\n')}\n`, 'utf8');

  await assert.rejects(
    () => verifyAccessLogChain(logPath),
    (err) => {
      assert.ok(err instanceof AccessLogChainError, `expected AccessLogChainError, got ${err?.constructor?.name}: ${err?.message}`);
      assert.match(err.message, /line 2/);
      return true;
    },
  );
});

test('seeded entry deletion (removing a middle line) is rejected fail-closed by verifyAccessLogChain', async () => {
  const logPath = await freshLogPath('ef-access-log-delete');
  await appendAccessLogEntry({ verb: 'check-fixtures', corpusId: 'c1', accessLogPath: logPath });
  await appendAccessLogEntry({ verb: 'run', corpusId: 'c2', accessLogPath: logPath });
  await appendAccessLogEntry({ verb: 'report', corpusId: 'c3', accessLogPath: logPath });

  const raw = await readFile(logPath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.length > 0);
  const withMiddleDeleted = [lines[0], lines[2]]; // drop the second entry
  await writeFile(logPath, `${withMiddleDeleted.join('\n')}\n`, 'utf8');

  await assert.rejects(
    () => verifyAccessLogChain(logPath),
    (err) => {
      assert.ok(err instanceof AccessLogChainError);
      return true;
    },
  );
});

test('a malformed (non-JSON) line is rejected fail-closed by verifyAccessLogChain (AccessLogEntryError)', async () => {
  const logPath = await freshLogPath('ef-access-log-malformed');
  await appendAccessLogEntry({ verb: 'check-fixtures', corpusId: 'c1', accessLogPath: logPath });
  await writeFile(logPath, 'not even json\n', { flag: 'a' });

  await assert.rejects(
    () => verifyAccessLogChain(logPath),
    (err) => {
      assert.ok(err instanceof AccessLogEntryError);
      return true;
    },
  );
});

// -------------------------------------------------------------------------------------------
// No update/delete write path exists anywhere in this module or the tool that uses it -- the only
// write call in tools/retro-validate/ touching the access log is `appendFile` (never a truncating
// "w" open), matching this module's own header claim.
// -------------------------------------------------------------------------------------------

test('access-log.mjs never opens its own log file for a truncating write ("w"/"w+") -- appendFile only', async () => {
  const source = await readFile(path.join(RETRO_VALIDATE_ROOT, 'lib', 'access-log.mjs'), 'utf8');
  assert.ok(/\bappendFile\s*\(/.test(source), 'sanity: the module must actually write via appendFile');
  assert.ok(!/writeFile\s*\(/.test(source), 'access-log.mjs must never call writeFile (a truncating write) on the log');
  assert.ok(!/flag:\s*['"]w/.test(source), 'access-log.mjs must never open the log with a truncating "w" flag');
});

// -------------------------------------------------------------------------------------------
// Actor/purpose/path resolution: flag wins over env var, which wins over the literal fallback --
// never silently blank.
// -------------------------------------------------------------------------------------------

test('resolveActor: flag wins over env var, which wins over "unknown"', () => {
  const original = process.env[ACTOR_ENV_VAR];
  try {
    delete process.env[ACTOR_ENV_VAR];
    assert.equal(resolveActor({}), UNKNOWN_ACTOR);
    process.env[ACTOR_ENV_VAR] = 'env-actor';
    assert.equal(resolveActor({}), 'env-actor');
    assert.equal(resolveActor({ actor: 'flag-actor' }), 'flag-actor');
  } finally {
    if (original === undefined) delete process.env[ACTOR_ENV_VAR];
    else process.env[ACTOR_ENV_VAR] = original;
  }
});

test('resolvePurpose: flag wins over env var, which wins over "unspecified"', () => {
  const original = process.env[PURPOSE_ENV_VAR];
  try {
    delete process.env[PURPOSE_ENV_VAR];
    assert.equal(resolvePurpose({}), UNSPECIFIED_PURPOSE);
    process.env[PURPOSE_ENV_VAR] = 'env-purpose';
    assert.equal(resolvePurpose({}), 'env-purpose');
    assert.equal(resolvePurpose({ purpose: 'flag-purpose' }), 'flag-purpose');
  } finally {
    if (original === undefined) delete process.env[PURPOSE_ENV_VAR];
    else process.env[PURPOSE_ENV_VAR] = original;
  }
});

test('resolveAccessLogPath: flag wins over env var, which wins over DEFAULT_ACCESS_LOG_PATH', () => {
  const original = process.env[ACCESS_LOG_PATH_ENV_VAR];
  try {
    delete process.env[ACCESS_LOG_PATH_ENV_VAR];
    assert.equal(resolveAccessLogPath({}), DEFAULT_ACCESS_LOG_PATH);
    process.env[ACCESS_LOG_PATH_ENV_VAR] = '/tmp/env-path.jsonl';
    assert.equal(resolveAccessLogPath({}), '/tmp/env-path.jsonl');
    assert.equal(resolveAccessLogPath({ accessLogPath: '/tmp/flag-path.jsonl' }), '/tmp/flag-path.jsonl');
  } finally {
    if (original === undefined) delete process.env[ACCESS_LOG_PATH_ENV_VAR];
    else process.env[ACCESS_LOG_PATH_ENV_VAR] = original;
  }
});

test('logAccessAttempt: options.corpus is used verbatim as corpusId when it is a non-empty string', async () => {
  const logPath = await freshLogPath('ef-access-log-logattempt');
  const entry = await logAccessAttempt('check-fixtures', { corpus: '/some/dir', accessLogPath: logPath });
  assert.equal(entry.corpusId, '/some/dir');
});

// -------------------------------------------------------------------------------------------
// AC 3: zero overlap between the access log and the review-record chain -- distinct schema files,
// distinct on-disk paths, no cross-$ref, no cross-import between the two tools.
// -------------------------------------------------------------------------------------------

test('DEFAULT_ACCESS_LOG_PATH lives under tools/retro-validate/, not under modules/<id>/reviews/ or tools/review-record/', () => {
  const relative = path.relative(REPO_ROOT, DEFAULT_ACCESS_LOG_PATH);
  assert.equal(relative, path.join('tools', 'retro-validate', 'access-log.jsonl'));
  assert.ok(!relative.startsWith(path.join('modules')), 'must not live under modules/<id>/reviews/');
  assert.ok(!relative.startsWith(path.join('tools', 'review-record')), 'must not live under tools/review-record/');
});

test('ACCESS_LOG_ENTRY_SCHEMA_PATH is a distinct file from REVIEW_RECORD_SCHEMA_PATH', async () => {
  assert.notEqual(ACCESS_LOG_ENTRY_SCHEMA_PATH, REVIEW_RECORD_SCHEMA_PATH);
  assert.notEqual(ACCESS_LOG_ENTRY_SCHEMA_PATH, FIXTURE_CORPUS_SCHEMA_PATH);
  // Sanity: both schema files actually exist and are independently parseable JSON.
  await assert.doesNotReject(readFile(ACCESS_LOG_ENTRY_SCHEMA_PATH, 'utf8').then((s) => JSON.parse(s)));
  await assert.doesNotReject(readFile(REVIEW_RECORD_SCHEMA_PATH, 'utf8').then((s) => JSON.parse(s)));
});

test('neither schema $refs, or has a $id colliding with, the other (no shared schema) -- prose cross-references in `description` fields are fine and expected (each schema documents the boundary)', async () => {
  const accessLogSchema = JSON.parse(await readFile(ACCESS_LOG_ENTRY_SCHEMA_PATH, 'utf8'));
  const reviewRecordSchema = JSON.parse(await readFile(REVIEW_RECORD_SCHEMA_PATH, 'utf8'));

  function collectRefs(node, refs = []) {
    if (node && typeof node === 'object') {
      if (typeof node.$ref === 'string') refs.push(node.$ref);
      for (const value of Object.values(node)) collectRefs(value, refs);
    }
    return refs;
  }

  assert.notEqual(accessLogSchema.$id, reviewRecordSchema.$id);
  const accessLogRefs = collectRefs(accessLogSchema);
  const reviewRecordRefs = collectRefs(reviewRecordSchema);
  assert.ok(
    accessLogRefs.every((ref) => !ref.includes('review-record')),
    `access-log-entry.schema.json must not $ref review-record.schema.json, got: ${JSON.stringify(accessLogRefs)}`,
  );
  assert.ok(
    reviewRecordRefs.every((ref) => !ref.includes('access-log')),
    `review-record.schema.json must not $ref access-log-entry.schema.json, got: ${JSON.stringify(reviewRecordRefs)}`,
  );
});

test('no file under tools/retro-validate/ imports from tools/review-record/, and vice versa (no cross-import; a prose mention of the sibling tool in a comment is fine and expected -- both READMEs document the FR-22 distinctness requirement)', async () => {
  async function collectSourceFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...(await collectSourceFiles(full)));
      else if (entry.name.endsWith('.mjs')) files.push(full);
    }
    return files;
  }

  const importRe = /^\s*import\b[^;]*from\s+['"]([^'"]+)['"]/gm;

  const retroValidateFiles = await collectSourceFiles(RETRO_VALIDATE_ROOT);
  for (const file of retroValidateFiles) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(importRe)) {
      assert.ok(
        !match[1].includes('review-record'),
        `${path.relative(REPO_ROOT, file)} imports from "${match[1]}" -- the access-log audit trail must not import tools/review-record`,
      );
    }
  }

  const reviewRecordFiles = await collectSourceFiles(REVIEW_RECORD_ROOT);
  for (const file of reviewRecordFiles) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(importRe)) {
      assert.ok(
        !match[1].includes('retro-validate'),
        `${path.relative(REPO_ROOT, file)} imports from "${match[1]}" -- the review-record chain must not import tools/retro-validate`,
      );
    }
  }
});

test('access-log-entry schema forbids every review-record-shaped key (reviewerId, decision, signature, previousRecordHash) via additionalProperties:false', async () => {
  const schema = await loadAccessLogEntrySchema();
  const entryWithReviewRecordFields = {
    schemaVersion: 1,
    timestamp: '2026-07-22T00:00:00.000Z',
    actor: 'nick',
    purpose: 'unit test',
    corpusId: 'some-corpus',
    verb: 'check-fixtures',
    prevEntryHash: null,
    reviewerId: 'smuggled',
    decision: 'approve',
    signature: null,
    previousRecordHash: null,
  };
  const errors = validate(schema, entryWithReviewRecordFields);
  assert.ok(errors.length > 0);
});
