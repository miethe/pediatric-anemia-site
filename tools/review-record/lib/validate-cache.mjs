// tools/review-record/lib/validate-cache.mjs — Clinical Review Workflow v1, Phase 2, P2-T3
// (FR-8, R9, F3): persistent, composite-keyed, fail-closed per-record `validate` cache.
//
// WHY THIS FILE EXISTS: `validate` (`lib/verbs/validate.mjs`) recomputes four per-record facts for
// every scoped record on every invocation — schema shape (`scripts/lib/json-schema-lite.mjs`),
// D-4 roster resolution (`lib/roster.mjs`), Ed25519 signature verification (`lib/signature.mjs`),
// and that record's own `previousRecordHash` chain-link fact (`lib/chain.mjs`). None of those facts
// change unless SOMETHING they depend on changes — this module lets a later `validate` invocation
// (a wholly separate `node` process, no shared memory) reuse a prior invocation's per-record result
// instead of recomputing it, IFF every one of six composite-key components still matches.
//
// THE COMPOSITE KEY (F3 — "not the record+immediate-predecessor pair alone"): a cached per-record
// result is trustworthy ONLY when ALL SIX of the following are unchanged since it was computed:
//   1. `recordContentHash` — this record's own `canonicalRecordHash` (`lib/chain.mjs`).
//   2. `predecessorSetHash` — a hash of the COMPLETE ordered list of every canonical hash of every
//      record that precedes this one in the module's committed sequence (every record whose file
//      sorts before this one — not merely the immediate predecessor). F3 exists precisely because an
//      earlier, narrower design keyed only on "record + immediate predecessor," which under-
//      invalidates: this composite key is deliberately conservative (over-invalidates rather than
//      risks a stale pass) and costs nothing extra to compute (everything here is an in-memory
//      SHA-256 over already-loaded records; no re-reads).
//   3. `rosterFileHash` — SHA-256 of `governance/reviewer-roster.yaml` (or a `--root` fixture's
//      standing-in copy) raw bytes, or the literal string `"absent"` when no such file exists (a
//      distinct, stable value that can never collide with a real `sha256:<64 hex>` digest, so a
//      roster file created/deleted/restored between two calls always changes this component).
//   4. `schemaFileHash` — same idea, over `schemas/review-record.schema.json`.
//   5. `validatorPolicyVersion` — `VALIDATOR_POLICY_VERSION` below, a plain integer this tool's own
//      source bumps whenever `validate.mjs`'s PER-RECORD validation semantics change in a way that
//      could alter a previously-cached result's correctness even though every on-disk byte named
//      above is unchanged (e.g. a new per-record check is added, or an existing one's logic
//      changes). A stale on-disk cache from an OLDER version of this tool must never be trusted
//      just because the input files happen to still match.
//   6. `historyMode` — `options.history === true` at the call site. `validate --history`'s own
//      git-log walk (`lib/history.mjs`) is module-wide, I/O-dependent, and NEVER itself cached by
//      this module (OQ-6, P2-T4) — this component exists so a per-record cache entry written under
//      one history-mode setting is never silently matched against a lookup made under the other,
//      even though today's four cached facts do not themselves depend on `--history`.
//
// `keysMatch` below is a strict, all-six-fields-equal comparison — ANY single differing component
// is a cache MISS, never a partial/stale hit. `getCachedRecordResult` returns `null` (never throws)
// on a miss, absent entry, or any read/parse failure of the underlying persistent store — the
// caller (`validate.mjs`) always has a safe, correct fallback: recompute.
//
// WHAT IS NEVER CACHE-ELIGIBLE (R9): reviewer-2 independence, PRD OQ-5 authorship-union / FR-5
// adjudicator-authorship, and FR-6 release-authorization validity are module-wide facts about the
// module's WHOLE record set (a pairwise comparison, a git-authorship union, an aggregate
// completeness policy) — none of them are a fact about any ONE record in isolation, and none of
// them are computed or stored by this module. `validate.mjs` always recomputes them, every
// invocation, unconditionally — see that file's own P2-T3 header addendum.
//
// PERSISTENCE (F3 — "OUTSIDE the repo tree ... survives across separate CLI processes"): the cache
// is ONE JSON file per `{root, moduleId}` pair, written with an atomic write-then-rename
// (`writeCacheFileAtomic`) so a reader never observes a partially-written file and a crash mid-write
// never corrupts the previously-committed cache. Its ROOT directory (`resolveCacheRootDir`) never
// depends on `rootDir` at all, by construction — it cannot resolve inside the repo working tree.
// Zero new runtime dependencies (`node:crypto`/`node:fs`/`node:os`/`node:path` only), zero network,
// zero LLM — matches this whole tool's standing guardrail.
//
// --- fix-cycle addendum (Clinical Review Workflow v1, Wave-2 gate, BLOCKER 3, CRW-F9): per-ENTRY
// structural hardening. `readCacheFile` above only ever validated the top-level `{cacheFormatVersion,
// root, moduleId, records}` envelope — it never inspected any individual `records[reviewId]` entry's
// own shape. `getCachedRecordResult` then returned a matching entry's `result` verbatim. A
// well-formed-JSON but malformed-shaped entry (a missing field, a wrong type, an extra property) could
// therefore either CRASH a downstream consumer (`validate.mjs` spreads `result.schemaViolations` and
// reads the other three fields as strings-or-null) or, worse, silently PASS THROUGH an all-clear
// forged result (`{schemaViolations:[], rosterViolation:null, ...}`) under otherwise-correct
// composite-key values, suppressing that record's real per-record findings. `getCachedRecordResult`
// now runs `isValidCachedEntryShape` (below) against BOTH the entry's stored `key` and its `result` —
// exact expected key sets, exact types (string / string-or-null / string[] / integer / boolean), zero
// extra properties — before even attempting `keysMatch`. ANY deviation, in either the key block or
// the result block, is treated exactly like an absent entry: a cache MISS forcing full recompute,
// never a crash, never a partial trust. This mirrors `readCacheFile`'s own already-fail-closed
// envelope check, just one layer deeper, and changes no exported function's signature.
//
// ORCHESTRATOR-ADJUDICATED THREAT MODEL (stated once, plainly, no hedging): this cache lives in a
// same-user OS tmp/XDG directory. An attacker who already has write access there can already replace
// this CLI's own source files or the `node` binary that runs them — at that point they do not need to
// forge a cache entry at all. Consequently a PERFECTLY-SHAPED forged entry (right keys, right types,
// matching the correct composite-key values) is explicitly OUTSIDE this tool's threat model and this
// fix does not attempt to defend against it; what this fix defends against is corruption, truncation,
// format drift, and accidental-or-hostile MALFORMED content, which is a materially different (and
// materially cheaper-to-trigger) failure mode than a fully-privileged same-user forger. Per-record
// cached results are, and remain, integrity-bounded by the exact same trust boundary as the working
// tree itself — this module makes that boundary fail closed on malformed input, not attacker-proof.

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Re-exported so `lib/verbs/validate.mjs` never needs its own direct `from '../chain.mjs'` import
// (an existing structural invariant test, `tests/ef-review-workflow.test.mjs`'s "validate.mjs
// contains zero duplicated derived-state logic," forbids that verb from importing `../chain.mjs`
// at all — P1-T1's guard against `checkModuleChainLinkage`/chain-linkage reasoning being forked
// into a second, independently-maintained copy inside `validate.mjs`). This is the SAME
// `canonicalRecordHash` implementation (`lib/chain.mjs`'s own header already anticipates this task
// importing it), not a reimplementation — only the import path changes.
export { canonicalRecordHash } from './chain.mjs';

/**
 * Bump whenever `lib/verbs/validate.mjs`'s PER-RECORD validation semantics change in any way that
 * could change a previously-cached result's correctness — a new per-record check added, an
 * existing one's logic or violation wording changed in a way a caller might depend on, etc. This is
 * composite-key component (5): a code change that alters what "valid" means for a record must never
 * be masked by an otherwise-unchanged on-disk key. Starts at 1.
 */
export const VALIDATOR_POLICY_VERSION = 1;

/** Bumped independently of `VALIDATOR_POLICY_VERSION` whenever THIS module's own on-disk JSON
 * SHAPE changes (not the validation semantics themselves). A cache file written under a different
 * format version is treated as absent — fail-closed, never partially trusted/migrated. */
const CACHE_FORMAT_VERSION = 1;

/**
 * Test-only filesystem-location seam — NOT a validation or signing seam (unrelated in kind to this
 * tool's "no --keyfile seam" guardrail, which is about signing key material). Overrides the
 * persistent cache ROOT directory so tests get a deterministic, isolated cache location instead of
 * either depending on, or polluting, this machine's real OS temp/XDG cache directory. Unset in
 * every real (non-test) invocation this tool documents; read-only, carries no secret material, zero
 * network.
 */
const CACHE_DIR_OVERRIDE_ENV = 'REVIEW_RECORD_CACHE_DIR';

/**
 * Resolves the persistent cache ROOT directory. Order:
 *   1. `REVIEW_RECORD_CACHE_DIR` env var, if set (test seam — see above).
 *   2. `XDG_CACHE_HOME`, if set (XDG Base Directory spec) — `<XDG_CACHE_HOME>/review-record`.
 *   3. DEFAULT: a subdirectory of `os.tmpdir()` — `<tmpdir>/review-record-validate-cache`.
 *
 * Why the OS temp dir, not a permanent home-directory cache, is the DEFAULT (both are explicitly
 * allowed by this task's own spec — "OS temp/XDG cache dir"): every `--root` this tool's own test
 * suite exercises against a `mkdtemp`-created throwaway fixture root produces a UNIQUE
 * `{root, moduleId}` cache-key hash on every single test run (a fresh random tmp path each time) —
 * a PERMANENT cache location would accumulate one small orphaned JSON file per historical test run,
 * forever, with nothing ever pruning it. `os.tmpdir()` is still exactly what F3 requires — a
 * persistent store OUTSIDE the repo tree whose warmth survives across separate CLI processes within
 * an OS session — while additionally degrading gracefully via ordinary OS temp-directory hygiene
 * (most systems periodically clear or reset `/tmp`-equivalent locations; CI runners typically start
 * from a fresh container/VM with no prior `/tmp` contents at all). An operator who explicitly wants
 * a longer-lived location can still opt in via `XDG_CACHE_HOME`.
 *
 * Never resolves to any path inside `rootDir` or the repo working tree — this directory does not
 * depend on `rootDir` at all, by construction.
 *
 * @returns {string}
 */
export function resolveCacheRootDir() {
  const override = process.env[CACHE_DIR_OVERRIDE_ENV];
  if (typeof override === 'string' && override.length > 0) return override;

  const xdg = process.env.XDG_CACHE_HOME;
  if (typeof xdg === 'string' && xdg.length > 0) return path.join(xdg, 'review-record');

  return path.join(os.tmpdir(), 'review-record-validate-cache');
}

/**
 * @param {string} input
 * @returns {string} lowercase hex SHA-256 digest of `input`
 */
function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * The ONE persistent cache file for a `{root, moduleId}` pair (F3 — "keyed by {root, moduleId}").
 * `rootDir` is resolved to an absolute path before hashing so two callers naming the same directory
 * via different relative/absolute spellings always agree on the same file.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {string} absolute path to this pair's cache file
 */
export function resolveCacheFilePath(rootDir, moduleId) {
  const resolvedRoot = path.resolve(rootDir);
  const keyHash = sha256Hex(`${resolvedRoot} ${moduleId}`);
  return path.join(resolveCacheRootDir(), `${keyHash}.json`);
}

/**
 * Reads and parses the persistent cache file for `{rootDir, moduleId}`. FAIL-CLOSED: any problem
 * at all — the file does not exist, its bytes do not parse as JSON, its top-level shape is not what
 * this module writes, its `cacheFormatVersion`/`root`/`moduleId` do not match what the caller
 * expects — yields `null` (an ABSENT cache, prompting full recompute), never a partially-trusted
 * value. Never throws.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {Promise<{ cacheFormatVersion: number, root: string, moduleId: string, records: object } | null>}
 */
export async function readCacheFile(rootDir, moduleId) {
  const filePath = resolveCacheFilePath(rootDir, moduleId);
  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return null; // absent (ENOENT) or any other read failure — fail-closed to "recompute everything"
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // corrupt JSON — fail-closed
  }

  const resolvedRoot = path.resolve(rootDir);
  if (
    parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)
    || parsed.cacheFormatVersion !== CACHE_FORMAT_VERSION
    || parsed.root !== resolvedRoot
    || parsed.moduleId !== moduleId
    || parsed.records === null || typeof parsed.records !== 'object' || Array.isArray(parsed.records)
  ) {
    return null; // unexpected/foreign/stale-format shape — fail-closed rather than trusting a stray file
  }
  return parsed;
}

/**
 * Atomically writes `{rootDir, moduleId}`'s cache file: serialize, write to a unique temp path in
 * the SAME directory as the final path, then `rename()` over it. `rename()` within one directory
 * is atomic on every platform Node targets, so a concurrent reader never observes a partially-
 * written file, and a crash mid-write leaves only an orphaned temp file — never a corrupt cache
 * file at the real path (F3 — "atomic write-then-rename").
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @param {object} records the full `records` map to persist (reviewId -> `{ key, result }`)
 * @returns {Promise<void>}
 */
export async function writeCacheFileAtomic(rootDir, moduleId, records) {
  const filePath = resolveCacheFilePath(rootDir, moduleId);
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });

  const payload = JSON.stringify(
    {
      cacheFormatVersion: CACHE_FORMAT_VERSION,
      root: path.resolve(rootDir),
      moduleId,
      records,
    },
    null,
    2,
  );

  const tmpPath = path.join(
    dir,
    `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}-${path.basename(filePath)}`,
  );
  await writeFile(tmpPath, payload, 'utf8');
  await rename(tmpPath, filePath);
}

/**
 * @typedef {{
 *   recordContentHash: string,
 *   predecessorSetHash: string,
 *   rosterFileHash: string,
 *   schemaFileHash: string,
 *   validatorPolicyVersion: number,
 *   historyMode: boolean,
 * }} RecordCacheKey
 */

/**
 * @typedef {{
 *   schemaViolations: string[],
 *   rosterViolation: string | null,
 *   signatureViolation: string | null,
 *   chainViolation: string | null,
 * }} RecordCacheResult
 */

/**
 * SHA-256 of a file's raw bytes, formatted `sha256:<64 hex>`, or the literal string `"absent"` when
 * the file does not exist. `"absent"` is a distinct, stable sentinel — it can never collide with a
 * real digest (always exactly `sha256:` + 64 hex chars) — so a roster/schema file that is created,
 * deleted, or restored between two calls always changes this composite-key component.
 *
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export async function hashFileIfExists(filePath) {
  let raw;
  try {
    raw = await readFile(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') return 'absent';
    throw err;
  }
  return `sha256:${createHash('sha256').update(raw).digest('hex')}`;
}

/**
 * Hash of an ORDERED array of predecessor `canonicalRecordHash` strings — composite-key component
 * (2), F3's "complete predecessor-set content hashes, not the record+immediate-predecessor pair
 * alone." Any single predecessor's content changing anywhere in the chain — not only the immediate
 * one — changes this value.
 *
 * @param {string[]} predecessorHashes ascending-seq-order canonical hashes of every record
 *   preceding the target record (empty array for a module's first record)
 * @returns {string} `sha256:<64 hex>`
 */
export function hashPredecessorSet(predecessorHashes) {
  return `sha256:${createHash('sha256').update(JSON.stringify(predecessorHashes)).digest('hex')}`;
}

/**
 * Whether two composite keys agree on EVERY component (F3) — ANY single differing field returns
 * `false`. `null`/`undefined` on either side is always a mismatch.
 *
 * @param {RecordCacheKey | null | undefined} a
 * @param {RecordCacheKey | null | undefined} b
 * @returns {boolean}
 */
export function keysMatch(a, b) {
  if (!a || !b) return false;
  return (
    a.recordContentHash === b.recordContentHash
    && a.predecessorSetHash === b.predecessorSetHash
    && a.rosterFileHash === b.rosterFileHash
    && a.schemaFileHash === b.schemaFileHash
    && a.validatorPolicyVersion === b.validatorPolicyVersion
    && a.historyMode === b.historyMode
  );
}

// -------------------------------------------------------------------------------------------
// Fix-cycle addendum (BLOCKER 3, CRW-F9) — strict per-entry structural validation. See this
// module's own header addendum above for the "why"; everything below is the "how." Every helper
// here is a pure predicate over already-in-memory (untrusted, disk-derived) data — no I/O, no
// throwing; a `false` return is always interpreted by its caller as "treat this as absent."
// -------------------------------------------------------------------------------------------

const RECORD_CACHE_KEY_FIELDS = Object.freeze([
  'recordContentHash',
  'predecessorSetHash',
  'rosterFileHash',
  'schemaFileHash',
  'validatorPolicyVersion',
  'historyMode',
]);

const RECORD_CACHE_RESULT_FIELDS = Object.freeze([
  'schemaViolations',
  'rosterViolation',
  'signatureViolation',
  'chainViolation',
]);

const CACHE_ENTRY_FIELDS = Object.freeze(['key', 'result']);

/**
 * @param {*} value
 * @returns {boolean} true iff `value` is a non-null, non-array object (`typeof === 'object'`)
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {object} obj already known to be a plain object
 * @param {readonly string[]} expectedFields
 * @returns {boolean} true iff `obj`'s own enumerable keys are EXACTLY `expectedFields` — same
 *   count, same names, no extras, none missing. Order does not matter.
 */
function hasExactOwnKeys(obj, expectedFields) {
  const actual = Object.keys(obj);
  if (actual.length !== expectedFields.length) return false;
  return expectedFields.every((field) => Object.prototype.hasOwnProperty.call(obj, field));
}

/**
 * @param {*} value
 * @returns {boolean} true iff `value` is an array whose every element is a `string`
 */
function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * @param {*} value
 * @returns {boolean} true iff `value` is `null` or a `string` — the shape every one of
 *   `RecordCacheResult`'s three `*Violation` fields must have.
 */
function isNullOrString(value) {
  return value === null || typeof value === 'string';
}

/**
 * Strict structural validation of an untrusted (disk-derived) `RecordCacheKey`: exactly the six
 * expected fields, no extras, and every field's own type matches `RecordCacheKey`'s typedef above
 * (four hash-or-`"absent"` strings, one integer, one boolean). This is deliberately a TYPE check
 * only — it never re-derives or compares against a fresh value, that is `keysMatch`'s job, and
 * `keysMatch` is only ever reached once this returns `true` (see `getCachedRecordResult`).
 *
 * @param {*} key
 * @returns {boolean}
 */
function isValidCachedKeyShape(key) {
  if (!isPlainObject(key)) return false;
  if (!hasExactOwnKeys(key, RECORD_CACHE_KEY_FIELDS)) return false;
  return (
    typeof key.recordContentHash === 'string'
    && typeof key.predecessorSetHash === 'string'
    && typeof key.rosterFileHash === 'string'
    && typeof key.schemaFileHash === 'string'
    && Number.isInteger(key.validatorPolicyVersion)
    && typeof key.historyMode === 'boolean'
  );
}

/**
 * Strict structural validation of an untrusted (disk-derived) `RecordCacheResult`: exactly the
 * four expected fields, no extras, `schemaViolations` an array of strings (possibly empty), and
 * each of `rosterViolation`/`signatureViolation`/`chainViolation` either `null` or a `string`. This
 * is exactly the shape `validate.mjs`'s `computePerRecordResult` produces and its `run` loop
 * consumes (spreading `schemaViolations`, reading the other three as `string | null`) — any
 * deviation here is precisely what could otherwise crash or silently mislead that consumer.
 *
 * @param {*} result
 * @returns {boolean}
 */
function isValidCachedResultShape(result) {
  if (!isPlainObject(result)) return false;
  if (!hasExactOwnKeys(result, RECORD_CACHE_RESULT_FIELDS)) return false;
  return (
    isStringArray(result.schemaViolations)
    && isNullOrString(result.rosterViolation)
    && isNullOrString(result.signatureViolation)
    && isNullOrString(result.chainViolation)
  );
}

/**
 * Strict structural validation of one ENTIRE cache entry (`{key, result}`) as stored under one
 * `reviewId` inside a cache file's `records` map: the entry itself is a plain object with EXACTLY
 * `key` and `result`, AND both of those pass their own shape checks above. This is the single gate
 * `getCachedRecordResult` runs before it will even attempt `keysMatch` against a freshly computed
 * key — a malformed entry (missing field, wrong type, extra property, at ANY level) never reaches
 * comparison at all.
 *
 * @param {*} entry
 * @returns {boolean}
 */
function isValidCachedEntryShape(entry) {
  if (!isPlainObject(entry)) return false;
  if (!hasExactOwnKeys(entry, CACHE_ENTRY_FIELDS)) return false;
  return isValidCachedKeyShape(entry.key) && isValidCachedResultShape(entry.result);
}

/**
 * Looks up `reviewId`'s cached result inside an already-loaded cache file's `records` map. FAIL
 * CLOSED, in this order:
 *   1. No entry at all for `reviewId` → `null` (absent, ordinary miss).
 *   2. The stored entry does not pass `isValidCachedEntryShape` (BLOCKER 3, CRW-F9 — corrupt,
 *      truncated-but-still-parseable, format-drifted, or hostile-malformed content at either the
 *      `key` or `result` level, including an extra injected property) → `null`, exactly like an
 *      absent entry. Never throws, never returns a partially-trusted value, and never even reaches
 *      step 3 — a malformed entry's `key` is not compared against anything.
 *   3. The (now shape-verified) stored `key` does not match every component of the freshly
 *      computed `key` (`keysMatch`, F3) → `null`, an ordinary stale-key miss.
 *   4. Otherwise → the stored `result`, verbatim (already shape-verified in step 2).
 *
 * @param {object} cacheRecords a `records` map (`reviewId -> { key, result }`), e.g. from
 *   `readCacheFile(...).records`, or `{}` when no cache file was found
 * @param {string} reviewId
 * @param {RecordCacheKey} key the FRESHLY computed key to check the cached entry against
 * @returns {RecordCacheResult | null}
 */
export function getCachedRecordResult(cacheRecords, reviewId, key) {
  if (!isPlainObject(cacheRecords)) return null;
  const entry = cacheRecords[reviewId];
  if (!isValidCachedEntryShape(entry)) return null;
  if (!keysMatch(entry.key, key)) return null;
  return entry.result;
}

/**
 * Pure: returns a NEW `records` map with `reviewId`'s entry set to `{key, result}`, leaving every
 * other entry untouched. Callers accumulate updates across a `validate` run's per-record loop and
 * persist the result once (`writeCacheFileAtomic`) rather than writing the file N times.
 *
 * @param {object} cacheRecords the current `records` map
 * @param {string} reviewId
 * @param {RecordCacheKey} key
 * @param {RecordCacheResult} result
 * @returns {object} a new `records` map
 */
export function setCachedRecordResult(cacheRecords, reviewId, key, result) {
  return { ...cacheRecords, [reviewId]: { key, result } };
}
