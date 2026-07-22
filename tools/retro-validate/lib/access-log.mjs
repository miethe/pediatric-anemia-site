// tools/retro-validate/lib/access-log.mjs -- ACCESS-LOG module (P4-T7, FR-22, ADR-0006 audit
// clause).
//
// Every `check-fixtures`/`run`/`report` invocation appends exactly one structured entry to
// `tools/retro-validate/access-log.jsonl` (default path) recording WHO ran it, WHEN, WHY, on
// WHICH corpus reference, and WHICH verb -- an audit trail this task's own scope description
// requires be kept DISTINCT from the review-record chain (`tools/review-record/`,
// `modules/<id>/reviews/*.yaml`): no shared file, no shared schema, no cross-import in either
// direction (test-asserted, tests/ef-retro-access-log.test.mjs).
//
// Append-only enforcement mirrors the shape `tools/review-record/lib/chain.mjs` documents for its
// own OQ-2 hash-chain primitive (P2-T1 scaffold; P2-T3 lands that tool's fail-closed chain
// ENFORCEMENT), adapted from "one hash-linked file per review act" to "one hash-linked LINE per
// access-log entry, within a single file": `appendAccessLogEntry` links each new line to the exact
// raw bytes of the immediately preceding line via `prevEntryHash` (sha256 of those bytes, no
// trailing newline); `verifyAccessLogChain` recomputes and compares that chain, fail-closed
// (`AccessLogChainError`) on the first line whose declared `prevEntryHash` does not match. Node's
// `fs.appendFile` always opens with the `O_APPEND` flag (creating the file if absent) -- nothing in
// this module ever opens the log for truncating write ("w") or in-place edit, so there is no
// in-process code path that could rewrite an existing line; the residual gap (a whole-file
// truncate/replace performed OUTSIDE this module, e.g. by hand) is the same one
// `schemas/review-record.schema.json`'s own header documents for that tool's per-file chain --
// closed by keeping this file git-tracked and append-only BY CONVENTION at the VCS layer too, not
// by anything this module alone can enforce.
//
// Entries carry NO case-level data -- only corpus-level references (`corpusId` is the raw
// `--corpus` argument string, never parsed case content) plus invocation metadata. The entry shape
// itself is the enforcement mechanism (`schemas/access-log-entry.schema.json`'s closed
// `additionalProperties:false` property set has no slot a case-level field could occupy), exactly
// like `lib/boundary.mjs`'s own schema-enforced-not-procedural posture for FR-20.

import { appendFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../../../scripts/lib/json-schema-lite.mjs';
import { UsageError } from './errors.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to this tool's own access-log-entry schema (tool-local, FR-22). */
export const ACCESS_LOG_ENTRY_SCHEMA_PATH = path.join(MODULE_DIR, '..', 'schemas', 'access-log-entry.schema.json');

/** Default (real) access-log location -- `tools/retro-validate/access-log.jsonl`. */
export const DEFAULT_ACCESS_LOG_PATH = path.join(MODULE_DIR, '..', 'access-log.jsonl');

/** Env-var override for the actor field, mirrored by the `--actor` CLI flag (flag wins). */
export const ACTOR_ENV_VAR = 'RETRO_VALIDATE_ACTOR';

/** Env-var override for the purpose field, mirrored by the `--purpose` CLI flag (flag wins). */
export const PURPOSE_ENV_VAR = 'RETRO_VALIDATE_PURPOSE';

/** Env-var override for the access-log path itself, mirrored by `--access-log-path` (flag wins). */
export const ACCESS_LOG_PATH_ENV_VAR = 'RETRO_VALIDATE_ACCESS_LOG_PATH';

/** Value logged when no actor identity is supplied via flag or env var -- never silently omitted. */
export const UNKNOWN_ACTOR = 'unknown';

/** Value logged when no purpose is supplied via flag or env var -- never silently omitted. */
export const UNSPECIFIED_PURPOSE = 'unspecified';

/** Value logged as `corpusId` when the invocation supplied no `--corpus` argument at all. */
export const UNSPECIFIED_CORPUS = 'unspecified';

const ACCESS_LOG_SCHEMA_VERSION = 1;

/** The 3 verbs this audit trail covers (FR-22) -- `--help`/an unknown verb never logs. */
export const LOGGED_VERBS = Object.freeze(['check-fixtures', 'run', 'report']);

let cachedSchema;

/**
 * Loads and parses `schemas/access-log-entry.schema.json` once per process (same caching posture
 * as `lib/corpus.mjs#loadFixtureCorpusSchema` for its own committed, static schema).
 * @returns {Promise<object>}
 */
export async function loadAccessLogEntrySchema() {
  if (!cachedSchema) {
    const raw = await readFile(ACCESS_LOG_ENTRY_SCHEMA_PATH, 'utf8');
    cachedSchema = JSON.parse(raw);
  }
  return cachedSchema;
}

/** A structurally invalid access-log entry (should be unreachable in normal operation -- this
 * module only ever builds entries matching the schema itself; a thrown instance here means the
 * entry-construction logic below has drifted from the schema it is supposed to satisfy). */
export class AccessLogEntryError extends UsageError {
  constructor(message) {
    super(`access-log entry failed schema validation (internal invariant, FR-22): ${message}`);
  }
}

/** The within-file hash chain (`prevEntryHash`) does not recompute cleanly -- an existing line was
 * mutated, reordered, or deleted after being written. Fail-closed, same taxonomy code (USAGE) the
 * rest of this tool uses for "something about the input/state is wrong," not a 4th exit code. */
export class AccessLogChainError extends UsageError {
  constructor(message) {
    super(`access-log chain integrity check failed (append-only violation, FR-22): ${message}`);
  }
}

/**
 * sha256 of the exact raw bytes of one already-written JSONL line (no trailing newline, no
 * re-canonicalization -- the line is hashed exactly as it sits on disk).
 * @param {string} line
 * @returns {string} `sha256:<64 hex>`
 */
function hashLine(line) {
  return `sha256:${createHash('sha256').update(line, 'utf8').digest('hex')}`;
}

/**
 * Reads `logPath` and returns its non-empty lines, in file order. An absent file is NOT an error --
 * a tool that has never been invoked yet has a legitimately empty/nonexistent log -- it simply
 * yields `[]`.
 * @param {string} logPath
 * @returns {Promise<string[]>}
 */
async function readLogLines(logPath) {
  let raw;
  try {
    raw = await readFile(logPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return raw.split('\n').filter((line) => line.length > 0);
}

/**
 * Resolves the actor identity for one invocation: `--actor` flag wins over `RETRO_VALIDATE_ACTOR`
 * env var, which wins over the literal `"unknown"` fallback -- resolution order is fixed and never
 * silent (an unresolved actor is always logged as the explicit string `"unknown"`, not omitted).
 * @param {{ actor?: unknown }} options parsed CLI flags
 * @returns {string}
 */
export function resolveActor(options) {
  if (typeof options?.actor === 'string' && options.actor.length > 0) return options.actor;
  const fromEnv = process.env[ACTOR_ENV_VAR];
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return UNKNOWN_ACTOR;
}

/**
 * Resolves the purpose for one invocation -- same `--purpose` flag / `RETRO_VALIDATE_PURPOSE` env
 * var / literal-fallback resolution order as `resolveActor`.
 * @param {{ purpose?: unknown }} options parsed CLI flags
 * @returns {string}
 */
export function resolvePurpose(options) {
  if (typeof options?.purpose === 'string' && options.purpose.length > 0) return options.purpose;
  const fromEnv = process.env[PURPOSE_ENV_VAR];
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return UNSPECIFIED_PURPOSE;
}

/**
 * Resolves the access-log file path for one invocation -- `--access-log-path` flag wins over
 * `RETRO_VALIDATE_ACCESS_LOG_PATH` env var, which wins over `DEFAULT_ACCESS_LOG_PATH`. The flag/env
 * override exists for test and tooling isolation (so exercising this tool's verbs does not mutate
 * the real, git-tracked `tools/retro-validate/access-log.jsonl` on every test run) -- production
 * invocations of `node tools/retro-validate/cli.mjs ...` use the default.
 * @param {{ accessLogPath?: unknown }} options parsed CLI flags
 * @returns {string}
 */
export function resolveAccessLogPath(options) {
  if (typeof options?.accessLogPath === 'string' && options.accessLogPath.length > 0) return options.accessLogPath;
  const fromEnv = process.env[ACCESS_LOG_PATH_ENV_VAR];
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return DEFAULT_ACCESS_LOG_PATH;
}

/**
 * Appends exactly one structured entry to the access log (FR-22). This is the ONLY write path this
 * module exposes -- there is no update/delete function anywhere in `tools/retro-validate/`, and
 * this function itself only ever calls `fs.appendFile` (which always opens `O_APPEND`, creating the
 * file if absent) -- never a truncating write.
 *
 * @param {object} params
 * @param {'check-fixtures'|'run'|'report'} params.verb
 * @param {string} [params.corpusId] the raw `--corpus` argument, or `UNSPECIFIED_CORPUS` if absent
 * @param {string} [params.actor] pre-resolved actor (see `resolveActor`)
 * @param {string} [params.purpose] pre-resolved purpose (see `resolvePurpose`)
 * @param {string} [params.accessLogPath] pre-resolved log path (see `resolveAccessLogPath`)
 * @param {string} [params.timestamp] ISO-8601 override for tests; defaults to `new Date().toISOString()`
 * @returns {Promise<object>} the entry that was appended (already validated + written)
 * @throws {AccessLogEntryError} the constructed entry fails its own schema (internal invariant)
 */
export async function appendAccessLogEntry({
  verb,
  corpusId = UNSPECIFIED_CORPUS,
  actor = UNKNOWN_ACTOR,
  purpose = UNSPECIFIED_PURPOSE,
  accessLogPath = DEFAULT_ACCESS_LOG_PATH,
  timestamp,
} = {}) {
  if (!LOGGED_VERBS.includes(verb)) {
    throw new UsageError(`appendAccessLogEntry: "verb" must be one of ${LOGGED_VERBS.join(', ')}, got ${JSON.stringify(verb)}`);
  }

  const existingLines = await readLogLines(accessLogPath);
  const prevEntryHash = existingLines.length > 0 ? hashLine(existingLines[existingLines.length - 1]) : null;

  const entry = {
    schemaVersion: ACCESS_LOG_SCHEMA_VERSION,
    timestamp: timestamp ?? new Date().toISOString(),
    actor,
    purpose,
    corpusId,
    verb,
    prevEntryHash,
  };

  const schema = await loadAccessLogEntrySchema();
  const errors = validate(schema, entry);
  if (errors.length > 0) {
    const detail = errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
    throw new AccessLogEntryError(`${errors.length} violation(s):\n${detail}`);
  }

  const line = JSON.stringify(entry);
  await appendFile(accessLogPath, `${line}\n`, 'utf8');
  return entry;
}

/**
 * Recomputes and verifies the within-file hash chain over every entry currently in `logPath`
 * (FR-22 append-only proof). Fail-closed: the first entry whose `prevEntryHash` does not match the
 * recomputed hash of its immediate predecessor line throws `AccessLogChainError` -- there is no
 * partial/best-effort "mostly ok" result.
 *
 * @param {string} [logPath] defaults to `DEFAULT_ACCESS_LOG_PATH`
 * @returns {Promise<{ ok: true, entryCount: number }>}
 * @throws {AccessLogChainError} the chain does not recompute cleanly
 * @throws {AccessLogEntryError} a line is not valid JSON, or fails the entry schema
 */
export async function verifyAccessLogChain(logPath = DEFAULT_ACCESS_LOG_PATH) {
  const lines = await readLogLines(logPath);
  const schema = await loadAccessLogEntrySchema();

  let previousLine = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (err) {
      throw new AccessLogEntryError(`line ${i + 1} of "${logPath}" is not valid JSON: ${err.message}`);
    }
    const errors = validate(schema, entry);
    if (errors.length > 0) {
      const detail = errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
      throw new AccessLogEntryError(`line ${i + 1} of "${logPath}" fails the entry schema:\n${detail}`);
    }

    const expectedPrev = previousLine === null ? null : hashLine(previousLine);
    if (entry.prevEntryHash !== expectedPrev) {
      throw new AccessLogChainError(
        `line ${i + 1} of "${logPath}" declares prevEntryHash ${JSON.stringify(entry.prevEntryHash)}, `
          + `expected ${JSON.stringify(expectedPrev)} (recomputed from the immediately preceding line) `
          + '-- an existing entry was mutated, reordered, or deleted after being written',
      );
    }
    previousLine = line;
  }

  return { ok: true, entryCount: lines.length };
}

/**
 * Convenience wrapper the 3 verb handlers call as the FIRST statement of their own `run()` --
 * resolves actor/purpose/log-path from the same `options` bag `cli.mjs#parseFlags` already hands
 * them, then appends. Every `check-fixtures`/`run`/`report` invocation calls this exactly once,
 * unconditionally -- including invocations that go on to fail usage or boundary checks, since a
 * rejected/malformed attempt is itself an auditable event (FR-22 does not say "only successful
 * invocations").
 *
 * @param {'check-fixtures'|'run'|'report'} verb
 * @param {{ corpus?: unknown, actor?: unknown, purpose?: unknown, accessLogPath?: unknown }} options
 * @returns {Promise<object>} the appended entry
 */
export async function logAccessAttempt(verb, options) {
  const corpusId = typeof options?.corpus === 'string' && options.corpus.length > 0 ? options.corpus : UNSPECIFIED_CORPUS;
  return appendAccessLogEntry({
    verb,
    corpusId,
    actor: resolveActor(options),
    purpose: resolvePurpose(options),
    accessLogPath: resolveAccessLogPath(options),
  });
}
