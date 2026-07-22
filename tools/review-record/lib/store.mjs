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

import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
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
// Draft staging path (Clinical Review Workflow v1, P1-T3(c)/P2-T1, CRW-F2/CRW-F6 gap closure).
//
// `.review-drafts/<moduleId>/<reviewId>.draft.yaml` — OUTSIDE `modules/<id>/reviews/`, gitignored
// (`.gitignore`), never git-tracked. `scaffold --draft` (`lib/verbs/scaffold.mjs`) writes here; the
// `sign` verb (`lib/verbs/sign.mjs`) reads ONLY from here, never a path already inside `reviews/`
// (F1). These path helpers and the write function below live in `store.mjs` — not in
// `scaffold.mjs`/`sign.mjs` themselves — so `writeFile` is called from exactly one place in this
// whole tool, matching `tests/ef-review-adjudication.test.mjs`'s pre-existing structural invariant
// ("writeFile is called only from lib/store.mjs ... and lib/verbs/render.mjs ... — no other write
// path") without weakening it: this is the SAME `store.mjs` `writeFile` caller that invariant
// already names, gaining a second, disjoint write target (`.review-drafts/`, never
// `modules/<id>/reviews/`) rather than a new caller appearing elsewhere.
//
// UNLIKE `writeNewReviewRecordFile` below, this write path is NOT append-only-guarded — a re-run of
// `scaffold --draft` for the same `moduleId`+`reviewId` (e.g. abandoning and redrafting the SAME
// pending act before it has been signed) simply overwrites the prior draft. This is a deliberate,
// narrow relaxation scoped to this one ephemeral, gitignored, never-committed staging file — it does
// not touch, and has no bearing on, the append-only guarantee `writeNewReviewRecordFile` enforces
// for the real `modules/<id>/reviews/` store.
// ---------------------------------------------------------------------------------------------

/** Directory name (direct child of `rootDir`) holding staged, unsigned draft records. */
export const DRAFTS_DIR_NAME = '.review-drafts';

/**
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {string} absolute path to `<rootDir>/.review-drafts/<moduleId>/`
 */
export function draftsDirFor(rootDir, moduleId) {
  return path.join(rootDir, DRAFTS_DIR_NAME, moduleId);
}

/**
 * @param {string} rootDir
 * @param {string} moduleId
 * @param {string} reviewId
 * @returns {string} absolute path to `<rootDir>/.review-drafts/<moduleId>/<reviewId>.draft.yaml`
 */
export function draftFilePathFor(rootDir, moduleId, reviewId) {
  return path.join(draftsDirFor(rootDir, moduleId), `${reviewId}.draft.yaml`);
}

/**
 * Writes (or overwrites — see this section's header) one draft record to the `.review-drafts/`
 * staging area. Creates the target directory if needed. NOT append-only-guarded — see this
 * section's header for why that is deliberate and narrowly scoped.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @param {string} reviewId
 * @param {object} record a fully-built review-record document (e.g. `lib/verbs/scaffold.mjs`'s
 *   `buildDraftRecord` output — `signature: null`, `synthetic` either value)
 * @returns {Promise<string>} the absolute path written
 */
export async function writeDraftRecordFile(rootDir, moduleId, reviewId, record) {
  const filePath = draftFilePathFor(rootDir, moduleId, reviewId);
  await mkdir(draftsDirFor(rootDir, moduleId), { recursive: true });
  await writeFile(filePath, serializeReviewRecordYaml(record), 'utf8');
  return filePath;
}

// ---------------------------------------------------------------------------------------------
// Write path (P2-T2). Everything above the draft-staging section is read-only, per this file's own
// header. This remains the ONLY place in the whole `review-record` tool that ever writes a
// `modules/<id>/reviews/` file — `scaffold` (lib/verbs/scaffold.mjs) is its sole caller.
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
 * Whether `candidatePath` resolves to a path STRICTLY inside `dirPath` (never equal to it).
 * Path-traversal containment guard (clinical-review-workflow-v1 Wave-2 codex gate, BLOCKER 1(c)):
 * `writeNewReviewRecordFile` below uses this to refuse a computed target path that would land
 * outside `modules/<moduleId>/reviews/`, independent of whatever upstream validation (or lack of
 * it) a caller already ran on `reviewId` -- mirrors `lib/verbs/sign.mjs`'s own identically-shaped,
 * independently-defined helper of the same name (that one checks a caller-supplied `--draft`
 * argument against the drafts directory; this one checks a path THIS module itself computed
 * against `reviews/`, one layer deeper and never dependent on what ran upstream).
 *
 * @param {string} candidatePath
 * @param {string} dirPath
 * @returns {boolean}
 */
function resolvesStrictlyInside(candidatePath, dirPath) {
  const resolvedCandidate = path.resolve(candidatePath);
  const resolvedDir = path.resolve(dirPath);
  const rel = path.relative(resolvedDir, resolvedCandidate);
  return rel !== '' && rel !== '.' && !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel);
}

/**
 * Refuses (fail-closed) if any of `modules/`, `modules/<moduleId>/`, or `modules/<moduleId>/reviews/`
 * (whichever of these already exist under `rootDir`) is a SYMBOLIC LINK rather than a real directory
 * (clinical-review-workflow-v1 Wave-2 codex RE-PASS, still-open vector on BLOCKER 1(c)).
 *
 * This is LAYER ONE of `writeNewReviewRecordFile`'s path-traversal defense, checked BEFORE the
 * lexical containment check (`resolvesStrictlyInside`) below -- that check (and `path.resolve`/
 * `path.relative` generally) operates on the path STRING alone and never touches the filesystem, so
 * a symlinked `modules/<moduleId>/reviews/` -- lexically "inside" the module's own tree, but
 * pointing anywhere on disk -- would pass it, and `writeFile` would silently follow the link. This
 * is not merely a same-user-trust concern: git CAN carry a committed symlink into any clone, so a
 * malicious or corrupted `modules/<moduleId>/reviews/` symlink can arrive via an ordinary checkout,
 * not just a local attacker.
 *
 * The FINAL path component (the `<reviewId>.yaml` file itself) is deliberately NOT checked here --
 * `writeNewReviewRecordFile`'s exclusive-create write (`writeFile(..., { flag: 'wx' })`, MAJOR 4)
 * already refuses (`EEXIST`) if ANYTHING -- including a symlink -- already sits at that exact path,
 * so a symlinked terminal path is refused by that layer regardless of this one; only the ANCESTOR
 * directory components need an explicit check.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {Promise<void>}
 */
async function assertNoSymlinkedAncestor(rootDir, moduleId) {
  const candidates = [
    path.join(rootDir, 'modules'),
    path.join(rootDir, 'modules', moduleId),
    path.join(rootDir, 'modules', moduleId, 'reviews'),
  ];
  for (const candidatePath of candidates) {
    let stats;
    try {
      stats = await lstat(candidatePath);
    } catch (err) {
      if (err.code === 'ENOENT') continue; // does not exist yet -- mkdir below creates a REAL directory
      throw err;
    }
    if (stats.isSymbolicLink()) {
      throw new UsageError(
        `writeNewReviewRecordFile refuses to write into moduleId "${moduleId}" -- "${candidatePath}" ` +
          'is a SYMBOLIC LINK, not a real directory. A symlinked path component here would let the ' +
          'lexical containment check below pass while the actual write followed the link outside ' +
          'modules/<moduleId>/reviews/ -- including outside this repository entirely, since git can ' +
          'carry a committed symlink into any clone. This store never writes through a symlinked ' +
          'directory component, regardless of caller.',
      );
    }
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
 * Three additive, fail-closed hardenings from the clinical-review-workflow-v1 Wave-2 codex gate (the
 * first two from the initial gate, the third from a codex RE-PASS), all defense-in-depth on top of
 * whatever an upstream caller (e.g. `lib/verbs/sign.mjs`'s own `parseReviewId`/schema-conformance
 * checks) already validated -- neither changes behavior for any well-formed `reviewId`/first-time
 * write against real (non-symlinked) directories:
 *   - BLOCKER 1(c) symlink vector (RE-PASS): `assertNoSymlinkedAncestor` refuses if `modules/`,
 *     `modules/<moduleId>/`, or `modules/<moduleId>/reviews/` is a SYMBOLIC LINK, BEFORE the lexical
 *     containment check below -- a symlinked ancestor directory passes that check trivially (it
 *     never touches the filesystem) while the actual write would follow the link anywhere on disk.
 *   - BLOCKER 1(c) lexical containment: `filePath` is resolved and checked to sit STRICTLY inside
 *     `modules/<moduleId>/reviews/` before any I/O happens. A `reviewId` containing path-traversal
 *     segments (e.g. `"../../escape"`) is refused here even if it somehow reached this function
 *     without having been pattern-validated first.
 *   - MAJOR 4: the existence check and the write are now a SINGLE atomic OS-level operation
 *     (`writeFile(..., { flag: 'wx' })`, exclusive create) instead of a separate
 *     `fileExists()`-then-`writeFile()` pair. The prior two-step form left a TOCTOU window open: two
 *     concurrent `sign` processes could both observe "does not exist yet" and both proceed to write,
 *     the second silently clobbering the first's already-committed record. `EEXIST` from the
 *     exclusive-create attempt maps to the exact same `RecordAlreadyExistsError` this store has
 *     always thrown on a path collision; every other error propagates unchanged. This same `'wx'`
 *     behavior is ALSO the reason the symlink check above never needs to inspect the FINAL path
 *     component itself: `EEXIST` fires on anything -- including a symlink -- already sitting at that
 *     exact terminal path, so a symlinked terminal path is refused by this layer regardless.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @param {string} reviewId
 * @param {object} record a fully-built review-record document
 * @returns {Promise<string>} the absolute path written
 */
export async function writeNewReviewRecordFile(rootDir, moduleId, reviewId, record) {
  const reviewsDir = reviewsDirFor(rootDir, moduleId);
  const filePath = recordFilePathFor(rootDir, moduleId, reviewId);

  await assertNoSymlinkedAncestor(rootDir, moduleId);

  if (!resolvesStrictlyInside(filePath, reviewsDir)) {
    throw new UsageError(
      `writeNewReviewRecordFile refuses to write review_id "${reviewId}" for moduleId "${moduleId}" ` +
        `-- the computed target path does not resolve strictly inside modules/${moduleId}/reviews/ ` +
        '(path-traversal containment guard). This store writes exclusively inside that one directory ' +
        'per module; a reviewId that escapes it is always refused, regardless of caller.',
    );
  }

  await mkdir(reviewsDir, { recursive: true });
  try {
    await writeFile(filePath, serializeReviewRecordYaml(record), { encoding: 'utf8', flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') throw new RecordAlreadyExistsError(filePath);
    throw err;
  }
  return filePath;
}
