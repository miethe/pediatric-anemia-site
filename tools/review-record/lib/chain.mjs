// tools/review-record/lib/chain.mjs — OQ-2 hash-chain primitive + read-only linkage reporting
// (P2-T1 scaffold).
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

import { createHash } from 'node:crypto';

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
