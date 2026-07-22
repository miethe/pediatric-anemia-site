// tools/review-record/lib/chain.mjs — OQ-2 hash-chain primitive + read-only linkage reporting
// (P2-T1 scaffold; P2-fix hardened reviewer-2 structural independence, see `nextChainLink` below).
//
// This module defines the ONE canonical `previousRecordHash` hashing convention every later task
// in this phase must reuse rather than re-derive: `canonicalRecordHash` — SHA-256 over a
// deterministic, sorted-key JSON serialization of a parsed review-record document, exactly as
// `schemas/review-record.schema.json`'s own `previousRecordHash` field description names it ("the
// SHA-256 of the prior record's canonical bytes"). It is deliberately its own module (not folded
// into `store.mjs`) because `signature.mjs` (P2-T5) needs the same canonicalization applied to a
// record with its `signature` field held aside, and `validate`'s fail-closed chain ENFORCEMENT
// (P2-T3 — "the risk-hotspot task in this phase," `extended` effort) is the authoritative consumer
// of this primitive, not this file.
//
// IMPORTANT SCOPE NOTE: `checkModuleChainLinkage` below is READ-ONLY, INFORMATIONAL reporting for
// the `list` verb (P2-T1's own explicit deliverable — OQ-2: "`list` prints per-module review state
// ... chain validity"). It is NOT the fail-closed append-only enforcement path FR-9/OQ-2 requires —
// that is P2-T3's job (`validate`/`validate --history`), which additionally recomputes hashes over
// a committed git history and rejects mutation/deletion of existing record paths, something no
// purely in-memory function like this one can do. `list` never exits non-zero on a broken-chain
// finding; it only reports it. Do not read a `list` "chainLinkage: ok" line as proof this record
// set has passed P2-T3's real validator, and do not read ANY output of this module as a
// clinical-validity, safety, or release-readiness claim — see schemas/review-record.schema.json's
// own top-level description for that standing caveat.
//
// This module also does not attempt to reconstruct a chain across records that are missing from
// disk entirely (e.g. `rr-0001-...` deleted, only `rr-0002-...` present) — `checkModuleChainLinkage`
// only compares each LISTED record against its immediately preceding LISTED record. Detecting a
// wholesale-missing predecessor is exactly the kind of thing P2-T3's git-history validator exists
// for, not an in-memory listing.
//
// STRUCTURAL SCOPING (P2-fix): `checkModuleChainLinkage` (this file) and `validate`/`list`
// (P2-T3/P2-T1) legitimately parse EVERY committed record in a module — a validator's whole job is
// to read everything and check it, and `list`'s per-module summary is likewise allowed full read
// access. That full-read posture is explicitly NOT extended to `nextChainLink` below: it is the one
// scaffold-facing channel FR-4/ADR-0004 reviewer-2 independence depends on, and it is scoped to
// touch at most ONE predecessor file's bytes, never "every prior record." Do not refactor
// `nextChainLink` to route through `listModuleReviewRecords` (or any other full-module read) again
// — that reintroduces the exact structural gap this comment documents the fix for (Codex
// second-opinion finding against the original ADR-0004 reviewer-2 claim: the old implementation's
// documented guarantee was contractual — "the return value is narrow" — not structural, because the
// full parsed array of every sibling record, decision/rationale included, existed in memory on the
// call stack en route to that narrow return).

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseReviewId, reviewsDirFor } from './store.mjs';
import { parseYamlDocument } from '../../rf-bundle-to-kb-pack/lib/yaml-lite.mjs';

/**
 * Deterministic, sorted-key JSON serialization of any JSON-compatible value (the same recursive
 * shape `tools/review-record/lib/wave0-migration.mjs`'s own internal-only `stableStringify` uses,
 * and which that module's header explicitly disclaims as "not... the authoritative
 * implementation" of the canonical hash-chain spec). THIS function is that authoritative
 * implementation for the OQ-2 store/chain boundary — P2-T3 and P2-T5 import it rather than
 * re-deriving their own.
 *
 * @param {*} value
 * @returns {string}
 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

/**
 * SHA-256 of `stableStringify(record)`, formatted `sha256:<64 hex>` to match every hash-shaped
 * field in `schemas/review-record.schema.json` (`subjectContentHash`, `previousRecordHash`). Takes
 * the FULL parsed record document, including whatever `signature` it already carries — a record's
 * chain hash is computed once that record is complete and immutable, which for `signature` means
 * "already signed (synthetic dry-run) or already forced-null (real, pre-G1/G2)," never a
 * still-in-progress value.
 *
 * @param {object} record a parsed review-record document (e.g. from `store.mjs`'s
 *   `listModuleReviewRecords`)
 * @returns {string} `sha256:<64 hex>`
 */
export function canonicalRecordHash(record) {
  return `sha256:${createHash('sha256').update(stableStringify(record)).digest('hex')}`;
}

/**
 * Read-only linkage report over an already-loaded, seq-ordered list of module review records (the
 * shape `store.mjs`'s `listModuleReviewRecords` returns: `{ reviewId, seq, role, filePath, record
 * }[]`). For each entry, reports whether its own `record.previousRecordHash` agrees with what this
 * module's `canonicalRecordHash` recomputes from the immediately preceding LISTED entry (or, for
 * the first listed entry, whether `previousRecordHash` is `null` as OQ-2 requires for a module's
 * very first record).
 *
 * @param {{ reviewId: string, record: object }[]} records seq-ordered (ascending) module records
 * @returns {{ reviewId: string, ok: boolean, reason: string|null }[]} one entry per input record,
 *   same order
 */
export function checkModuleChainLinkage(records) {
  const report = [];
  let previous = null;
  for (const entry of records) {
    const declared = entry.record?.previousRecordHash ?? null;
    if (previous === null) {
      const ok = declared === null;
      report.push({
        reviewId: entry.reviewId,
        ok,
        reason: ok ? null : 'first listed record must carry previousRecordHash: null',
      });
    } else {
      const expected = canonicalRecordHash(previous.record);
      const ok = declared === expected;
      report.push({
        reviewId: entry.reviewId,
        ok,
        reason: ok
          ? null
          : `previousRecordHash "${declared}" does not match the recomputed hash of the preceding `
            + `listed record "${previous.reviewId}" (expected "${expected}")`,
      });
    }
    previous = entry;
  }
  return report;
}

/**
 * Hash-only reader for exactly ONE review-record file. Reads the file's raw bytes, parses them
 * PURELY LOCALLY to compute the canonical hash, and returns nothing but that hash string — the
 * parsed record object is a local variable in this function's own stack frame and is never
 * returned, stored, or passed to any caller. This is deliberately the narrowest possible interface
 * over "what does this one predecessor file's content hash to": callers get a `sha256:<64 hex>`
 * string and nothing else, structurally, not merely by convention.
 *
 * @param {string} filePath absolute path to one `rr-<seq4>-<role>.yaml` file
 * @returns {Promise<string>} `sha256:<64 hex>`
 */
async function hashRecordFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const record = parseYamlDocument(raw); // scoped to this function only; never propagated further
  return canonicalRecordHash(record);
}

/**
 * P2-T2 (P2-fix hardened): the ONE channel `scaffold` (any role, including `clinical-2`) uses to
 * link a new record into a module's chain. Structurally — not just by return-type convention —
 * incapable of exposing more than one predecessor's canonical hash to its caller:
 *
 *   1. The sequence number comes from directory FILENAMES ALONE (`rr-<seq4>-<role>.yaml` naming is
 *      authoritative per OQ-2/`store.mjs`'s own header) — sorted, highest wins, +1. No file's
 *      CONTENT is read to compute `seq`.
 *   2. `previousRecordHash` is computed by opening and hashing ONLY the single highest-numbered
 *      (immediately preceding) file via `hashRecordFile` above — never "every prior record." A
 *      module with N>1 existing records never has records 1..N-1 read at all by this function; only
 *      record N (the immediate predecessor) is ever touched, and even then only its hash — never
 *      its parsed `decision`/`rationale`/`reviewerId` — leaves this function.
 *
 * This is what makes reviewer-2 independence (FR-4, ADR-0004 "no read dependency") structural
 * rather than a convention every role's scaffold code has to remember to respect: `clinical-2`'s
 * draft-building code calls this exact same function every other role calls, and there is no data
 * path through it — not even an unreturned one sitting on the call stack — by which a sibling
 * record's content could reach `clinical-2`'s scaffold. See `lib/independence.mjs`'s header for the
 * supplementary (non-structural) heuristic layer `validate` runs on top of this guarantee, and this
 * file's own top-of-file "STRUCTURAL SCOPING" note for why `checkModuleChainLinkage`/`validate`/
 * `list` are correctly exempt from this narrow-touch discipline.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {Promise<{ seq: number, previousRecordHash: string|null }>}
 */
export async function nextChainLink(rootDir, moduleId) {
  const reviewsDir = reviewsDirFor(rootDir, moduleId);
  let entries;
  try {
    entries = await readdir(reviewsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return { seq: 1, previousRecordHash: null };
    throw err;
  }

  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
    .map((entry) => entry.name)
    .sort(); // fixed-width zero-padded <seq4> ⇒ lexicographic sort == seq order (matches store.mjs)
  if (filenames.length === 0) return { seq: 1, previousRecordHash: null };

  const lastFilename = filenames[filenames.length - 1];
  const { seq: lastSeq } = parseReviewId(lastFilename.slice(0, -'.yaml'.length)); // filename only
  const previousRecordHash = await hashRecordFile(path.join(reviewsDir, lastFilename));
  return { seq: lastSeq + 1, previousRecordHash };
}
