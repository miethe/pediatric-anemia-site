// scripts/lib/p4-t1-snapshot.mjs — shared snapshot logic for Phase 4's pre-merge baseline
// (multi-bundle-conversion-e1, P4-T1).
//
// P4-T1 requires a SHA-256 hash of every file in modules/anemia/{evidence.json,rules.json,
// candidates.json} and every file in modules/cbc_suite_v1/**'s E0-era package (rules.json,
// candidates.json, authoring-decisions.yaml, evidence.json, evidence-assertions.json,
// rule-provenance.json), recorded BEFORE any `propose` run in this phase. That snapshot is the
// baseline the phase's two seam tasks compare against:
//   - P4-T4 (anemia rule<->evidence reference integrity survives the RF-EV-001 backfill)
//   - P4-T7 (cbc_suite_v1's E0-era content proven byte-identical post RF-CBC-002 merge)
//
// Two of the nine files are expected to grow during this phase (P4-T5 APPENDS RF-CBC-002 records
// to cbc_suite_v1/evidence.json and evidence-assertions.json — see FR-7/FR-8, decisions block
// Risk 2). A single whole-file hash can't express "grew, but every pre-existing record is
// unchanged", so this module captures two kinds of fingerprint:
//   - `files`   — whole-file SHA-256 + byte length, for every one of the 9 target files
//                 (informational for all 9; the seven WHOLE_FILE_TARGETS additionally MUST stay
//                 byte-identical for the rest of Phase 4 per the decisions-block exit gate)
//   - `records` — for the two RECORD_TARGETS only, a SHA-256 of each individual record's JCS
//                 canonical form, keyed by that record's stable ID field. A record's hash staying
//                 present and unchanged proves "not silently mutated by the merge" even once new
//                 sibling records have been appended alongside it.
//
// Both the one-time capture script (scripts/capture-p4-t1-snapshot.mjs) and the ongoing
// comparison tests (tests/p4-t1-pre-merge-snapshot.test.mjs, and later P4-T4/P4-T7) import
// `computeSnapshot` from here so "what got hashed and how" can never drift between the baseline
// and the comparisons made against it.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { sha256Hex } from '../../src/lib/digest.mjs';
import { canonicalize } from '../../src/lib/jcs.mjs';

/**
 * Files whose entire byte content must remain identical for the rest of Phase 4 — the
 * decisions-block Risk 1 (anemia additive-only backfill) and Risk 2 (cbc_suite_v1 collision-safe
 * merge) exit-gate proof. `rule-provenance.json` is included because Phase 4 introduces zero new
 * rules (P4-T8's load-bearing AC), so it carries no new provenance entries either.
 */
export const WHOLE_FILE_TARGETS = Object.freeze([
  'modules/anemia/evidence.json',
  'modules/anemia/rules.json',
  'modules/anemia/candidates.json',
  'modules/cbc_suite_v1/rules.json',
  'modules/cbc_suite_v1/candidates.json',
  'modules/cbc_suite_v1/authoring-decisions.yaml',
  'modules/cbc_suite_v1/rule-provenance.json',
]);

/**
 * Files P4-T5 appends RF-CBC-002 records to. Captured per-record (keyed by a stable ID field)
 * rather than whole-file, because these two files are EXPECTED to grow in this phase — the
 * invariant is "every pre-existing (RF-CBC-001-era) record is untouched", not "the file never
 * changes".
 */
export const RECORD_TARGETS = Object.freeze([
  Object.freeze({ relPath: 'modules/cbc_suite_v1/evidence.json', arrayField: 'sources', idField: 'id' }),
  Object.freeze({
    relPath: 'modules/cbc_suite_v1/evidence-assertions.json',
    arrayField: 'assertions',
    idField: 'assertionId',
  }),
]);

/** All nine files this snapshot fingerprints, whole-file-only targets first. */
export const ALL_TARGET_PATHS = Object.freeze([
  ...WHOLE_FILE_TARGETS,
  ...RECORD_TARGETS.map((t) => t.relPath),
]);

async function hashWholeFile(root, relPath) {
  const bytes = await readFile(path.join(root, relPath));
  return { sha256: `sha256:${await sha256Hex(bytes)}`, byteLength: bytes.length };
}

async function hashRecords(root, target) {
  const raw = await readFile(path.join(root, target.relPath), 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`p4-t1-snapshot: ${target.relPath} is not valid JSON (${error.message})`);
  }
  const array = parsed[target.arrayField];
  if (!Array.isArray(array)) {
    throw new Error(`p4-t1-snapshot: ${target.relPath}."${target.arrayField}" is not an array`);
  }
  const byId = {};
  for (const record of array) {
    const id = record?.[target.idField];
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(
        `p4-t1-snapshot: ${target.relPath} has a record with no string "${target.idField}"`,
      );
    }
    if (Object.prototype.hasOwnProperty.call(byId, id)) {
      throw new Error(`p4-t1-snapshot: ${target.relPath} has a duplicate "${target.idField}" (${id})`);
    }
    byId[id] = `sha256:${await sha256Hex(new TextEncoder().encode(canonicalize(record)))}`;
  }
  const wholeFile = {
    sha256: `sha256:${await sha256Hex(new TextEncoder().encode(raw))}`,
    byteLength: Buffer.byteLength(raw, 'utf8'),
  };
  return { wholeFile, recordCount: array.length, byId };
}

/**
 * Computes the current-state snapshot for every P4-T1 target file under `root` (the repo root).
 * Returns `{ files, records }`:
 *   - `files[relPath]`   = { sha256, byteLength } for all nine target paths
 *   - `records[relPath]` = { arrayField, idField, recordCount, byId: { [id]: sha256 } } for the
 *                          two RECORD_TARGETS only
 */
export async function computeSnapshot(root) {
  const files = {};
  for (const relPath of WHOLE_FILE_TARGETS) {
    files[relPath] = await hashWholeFile(root, relPath);
  }
  const records = {};
  for (const target of RECORD_TARGETS) {
    const { wholeFile, recordCount, byId } = await hashRecords(root, target);
    files[target.relPath] = wholeFile;
    records[target.relPath] = {
      arrayField: target.arrayField,
      idField: target.idField,
      recordCount,
      byId,
    };
  }
  return { files, records };
}
