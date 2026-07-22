// tools/review-record/lib/store.mjs — OQ-2 store layout (P2-T1, FR-1/FR-7).
//
// Owns the "store" module boundary named in this tool's README: where a review-record file lives
// on disk, how its filename/`review_id` decompose into `seq`/`role`, and how to read (list) the
// full set of already-committed records for one module. This is a READ-ONLY module in P2-T1 — it
// exposes no write/create path. `scaffold` (P2-T2) is the first verb that needs to WRITE a new
// review-record file; that write path (YAML serialization + the append-only "never overwrite an
// existing path" guard) is P2-T2's own deliverable, built on top of the path/parse primitives
// here, not pre-built speculatively by this task.
//
// Layout (ADR-0004 §Decision item 1, OQ-2, `schemas/review-record.schema.json`):
//   modules/<module_id>/reviews/rr-<seq4>-<role>.yaml
// `<seq4>` is a zero-padded 4-digit sequence number GLOBAL PER MODULE (not per role) — successive
// review acts for the same proposal share the module's sequence, not a per-role counter (see the
// schema's own `review_id` field description).
//
// Every function here is pure w.r.t. its inputs plus (for the two `async` functions) read-only
// filesystem access — nothing in this module ever writes, renames, or deletes a path.

import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { RecordAlreadyExistsError, UsageError } from './errors.mjs';
import { parseYamlDocument } from '../../rf-bundle-to-kb-pack/lib/yaml-lite.mjs';

/**
 * The five ADR-0004 review-act roles, in the PRD's canonical table order. Mirrors
 * `schemas/review-record.schema.json`'s own `role` enum exactly — do not reorder or add to this
 * list without also revisiting that schema.
 */
export const REVIEW_ROLES = Object.freeze([
  'clinical-1',
  'clinical-2',
  'lab',
  'adjudication',
  'release-auth',
]);

const REVIEW_ID_RE = /^rr-([0-9]{4})-(clinical-1|clinical-2|lab|adjudication|release-auth)$/;

/** A `review_id` (or the filename it was derived from) does not match the OQ-2 shape. */
export class MalformedReviewIdError extends UsageError {
  constructor(reviewId) {
    super(
      `"${reviewId}" is not a valid review_id — expected "rr-<seq4>-<role>" with role one of `
        + `${REVIEW_ROLES.join(', ')} (OQ-2, schemas/review-record.schema.json)`,
    );
    this.reviewId = reviewId;
  }
}

/**
 * Splits a `review_id` (e.g. `"rr-0001-clinical-1"`) into its sequence number and role. Fails
 * closed on any shape outside the OQ-2 pattern — a malformed review-record filename in the store
 * is a real defect this function surfaces rather than silently working around.
 *
 * @param {string} reviewId
 * @returns {{ seq: number, role: string }}
 */
export function parseReviewId(reviewId) {
  const match = typeof reviewId === 'string' ? reviewId.match(REVIEW_ID_RE) : null;
  if (!match) throw new MalformedReviewIdError(reviewId);
  return { seq: Number.parseInt(match[1], 10), role: match[2] };
}

/**
 * Builds a `review_id` from a sequence number and role — the inverse of `parseReviewId`.
 *
 * @param {number} seq a positive integer, 1-9999 (the OQ-2 `<seq4>` zero-padded width)
 * @param {string} role one of `REVIEW_ROLES`
 * @returns {string}
 */
export function buildReviewId(seq, role) {
  if (!REVIEW_ROLES.includes(role)) {
    throw new UsageError(`buildReviewId: role "${role}" is not one of ${REVIEW_ROLES.join(', ')}`);
  }
  if (!Number.isInteger(seq) || seq < 1 || seq > 9999) {
    throw new UsageError(`buildReviewId: seq must be an integer in 1..9999, got ${JSON.stringify(seq)}`);
  }
  return `rr-${String(seq).padStart(4, '0')}-${role}`;
}

/**
 * @param {string} rootDir repo root (or a fixture root standing in for it — `list`'s `--root`)
 * @param {string} moduleId
 * @returns {string} absolute path to `modules/<moduleId>/reviews/`
 */
export function reviewsDirFor(rootDir, moduleId) {
  return path.join(rootDir, 'modules', moduleId, 'reviews');
}

/**
 * @param {string} rootDir
 * @param {string} moduleId
 * @param {string} reviewId
 * @returns {string} absolute path to the record's `.yaml` file
 */
export function recordFilePathFor(rootDir, moduleId, reviewId) {
  return path.join(reviewsDirFor(rootDir, moduleId), `${reviewId}.yaml`);
}

/**
 * Reads and parses every `*.yaml` file directly under `modules/<moduleId>/reviews/`, sorted by
 * filename (equivalently by `seq`, since `<seq4>` is a fixed-width zero-padded field). An absent
 * `reviews/` directory is NOT an error — a module with no review acts yet is a legitimate, common
 * state (mirrors `scripts/validate-kb.mjs`'s own existence-gate posture for this same directory) —
 * it simply yields an empty array. Every `.yaml` filename found IS parsed and its `review_id`/role
 * shape validated (`parseReviewId`, fail-closed) — nothing found there is silently skipped.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {Promise<{ reviewId: string, seq: number, role: string, filePath: string, record: object }[]>}
 */
export async function listModuleReviewRecords(rootDir, moduleId) {
  const reviewsDir = reviewsDirFor(rootDir, moduleId);
  let entries;
  try {
    entries = await readdir(reviewsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
    .map((entry) => entry.name)
    .sort();

  const records = [];
  for (const filename of filenames) {
    const reviewId = filename.slice(0, -'.yaml'.length);
    const { seq, role } = parseReviewId(reviewId);
    const filePath = path.join(reviewsDir, filename);
    const raw = await readFile(filePath, 'utf8');
    const record = parseYamlDocument(raw);
    records.push({ reviewId, seq, role, filePath, record });
  }
  return records;
}

/**
 * The next module-global sequence number a new review-record file for `moduleId` would use
 * (OQ-2: the sequence is shared across all five roles, not per-role). `1` when the module has no
 * review records yet.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {Promise<number>}
 */
export async function nextSequenceFor(rootDir, moduleId) {
  const records = await listModuleReviewRecords(rootDir, moduleId);
  if (records.length === 0) return 1;
  return Math.max(...records.map((r) => r.seq)) + 1;
}

// ---------------------------------------------------------------------------------------------
// Write path (P2-T2). Everything above this line is read-only, per this file's own header. This
// is the ONLY place in the whole `review-record` tool that ever writes a `modules/<id>/reviews/`
// file — `scaffold` (lib/verbs/scaffold.mjs) is its sole caller.
// ---------------------------------------------------------------------------------------------

/**
 * Double-quotes and escapes a string for a single-line YAML scalar, using exactly the escape set
 * `tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs`'s double-quoted-scalar reader supports
 * (`\\`, `\"`, `\n`, `\t`) — anything outside that set would round-trip incorrectly through this
 * repo's own hand-rolled parser, so this serializer stays deliberately narrow rather than emitting
 * YAML a wider spec would allow but this codebase's own reader cannot parse back.
 *
 * @param {string} value
 * @returns {string}
 */
function yamlDoubleQuote(value) {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

/**
 * Deterministic YAML serialization of one review-record document, in the exact field order
 * `schemas/review-record.schema.json`'s `required` array lists them — matching every hand-authored
 * fixture under `tests/fixtures/ef-review-record-cli/` and `tests/fixtures/ef-review-records/`.
 * Free-text fields (`rationale`, `reviewerId`, hash/id fields) are always double-quoted (safe
 * regardless of content); enum-shaped fields (`role`, `decision`) and booleans/integers are left
 * unquoted plain scalars, matching this repo's existing committed fixtures' style. Pure — does not
 * touch disk; `writeNewReviewRecordFile` below is the only caller that does.
 *
 * @param {object} record a fully-built review-record document (see `lib/verbs/scaffold.mjs`'s
 *   `buildDraftRecord`)
 * @returns {string} YAML document text, newline-terminated
 */
export function serializeReviewRecordYaml(record) {
  const lines = [
    `schemaVersion: ${record.schemaVersion}`,
    `review_id: ${record.review_id}`,
    `role: ${record.role}`,
    `moduleId: ${record.moduleId}`,
    `subjectContentHash: ${record.subjectContentHash}`,
    `previousRecordHash: ${record.previousRecordHash === null ? 'null' : record.previousRecordHash}`,
    `supersedes: ${record.supersedes === null ? 'null' : record.supersedes}`,
    `reviewerId: ${yamlDoubleQuote(record.reviewerId)}`,
    `decision: ${record.decision}`,
    `rationale: ${yamlDoubleQuote(record.rationale)}`,
    `reviewedAt: ${record.reviewedAt}`,
    `synthetic: ${record.synthetic}`,
  ];
  if (record.signature === null) {
    lines.push('signature: null');
  } else {
    lines.push('signature:');
    lines.push(`  algorithm: ${record.signature.algorithm}`);
    lines.push(`  keyId: ${record.signature.keyId}`);
    lines.push(`  value: ${yamlDoubleQuote(record.signature.value)}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Writes one new review-record file — the OQ-2 append-only guard: fails closed
 * (`RecordAlreadyExistsError`) if a file already sits at the target path rather than ever
 * overwriting it. Creates `modules/<moduleId>/reviews/` if it does not yet exist (a module's very
 * first review act legitimately has no `reviews/` directory yet, mirroring
 * `listModuleReviewRecords`'s own existence-gate posture for reads). This is the only function in
 * this whole tool that writes to `modules/<id>/reviews/` — see this section's header.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @param {string} reviewId
 * @param {object} record a fully-built review-record document
 * @returns {Promise<string>} the absolute path written
 */
export async function writeNewReviewRecordFile(rootDir, moduleId, reviewId, record) {
  const filePath = recordFilePathFor(rootDir, moduleId, reviewId);
  if (await fileExists(filePath)) throw new RecordAlreadyExistsError(filePath);
  await mkdir(reviewsDirFor(rootDir, moduleId), { recursive: true });
  await writeFile(filePath, serializeReviewRecordYaml(record), 'utf8');
  return filePath;
}
