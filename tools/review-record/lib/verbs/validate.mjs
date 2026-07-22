// tools/review-record/lib/verbs/validate.mjs — `validate` verb, P2-T2's first increment
// (FR-3/FR-4/FR-7). Full fail-closed behavior still lands incrementally, one dimension per later
// task, over this exact same verb:
//   - P2-T2: per-record schema shape (`schemas/review-record.schema.json`, reused
//     additively — see this tool's README "Why this tool exists"), D-4 roster resolution
//     (`lib/roster.mjs`, mirrors `scripts/validate-kb.mjs`'s own cross-check), and the FR-4
//     reviewer-2 textual-independence heuristic (`lib/independence.mjs`).
//   - P2-T3 (this task): the two-layer FR-9/OQ-2 append-only enforcement —
//     (a) `previousRecordHash` chain recomputation, ALWAYS run (reuses `lib/chain.mjs`'s
//     `checkModuleChainLinkage`, the exact same structured, deterministic report `list` already
//     prints informationally — this task turns that same report into a fail-closed enforcement
//     input rather than reimplementing chain recomputation a second way); and
//     (b) `validate --history`, an OPT-IN git-history append-only check (`lib/history.mjs`) that
//     rejects any commit-visible mutation/deletion of an existing `modules/<id>/reviews/*.yaml`
//     path. Both layers report every violation they find (not just the first) into the same
//     `ValidationFailedError`, each violation string prefixed `chain:`/`git-history:` respectively
//     so the two layers' findings are always distinguishable from each other and from the
//     schema/roster/independence findings above them.
//   - P2-T4: authorship-union computation (`lib/adjudication.mjs`, PRD OQ-5) +
//     adjudicator/release-authorizer-not-in-authorship-union enforcement (FR-5), plus release-
//     authorization chain validity (FR-6: a `release-auth` record is valid only over a complete,
//     chain-valid, roster-verified, non-synthetic record set). Both checks are module-wide, like
//     the independence and chain checks above, and always run over the module's full record set
//     regardless of `--record`.
//   - P2-T5 (this task): Ed25519 signature verification (`lib/signature.mjs`'s
//     `verifyRecordSignature`), fail closed on tamper. Per-record, like the schema/roster checks
//     above -- respects `--record` narrowing, unlike the module-wide checks (a signature is a fact
//     about one record, not a module-wide fact). A `synthetic: true` record with no signature, a
//     malformed/non-TESTKEY- signature, or one that fails cryptographic verification against the
//     record's own canonicalized bytes (any field mutated after signing invalidates it) fails
//     closed with a `signature:`-prefixed violation. A `synthetic: false` record's forced-null
//     signature slot verifies trivially -- nothing to check, by design.
//
// `validate --module <id> [--root <dir>] [--record <review_id>] [--history]`: loads every
// committed record for `moduleId` (or a `--root` fixture tree standing in for it), schema- and
// roster-validates each one (all of them, or just `--record`'s one if given — that flag narrows
// ONLY the schema/roster pass; the reviewer-2 independence check AND the chain-linkage check are
// both inherently module-scoped, not per-record, and always run over the WHOLE module's record set
// regardless of `--record` — same rationale as the independence check's own comment below: a chain
// break at record N is a fact about the module's whole sequence, not about any one record in
// isolation). `--history` is additionally opt-in (never implied by a plain `validate`) because it
// requires `--root` to be inside an actual git working tree (`lib/history.mjs`'s
// `NotAGitRepositoryError` otherwise) — a fixture tree that is not its own git repo (most of
// `tests/fixtures/ef-review-record-cli/`) cannot satisfy it, and the check is genuinely optional
// tooling (layer (a) alone already gives the primary fail-closed guarantee for a module's own
// internal consistency). Collects every violation found (does not stop at the first) and fails
// closed with `ValidationFailedError` if the collected list is non-empty.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate as validateAgainstSchema } from '../../../../scripts/lib/json-schema-lite.mjs';
import { listModuleReviewRecords } from '../store.mjs';
import { loadRosterIndex, resolveReviewer } from '../roster.mjs';
import { checkAppendOnlyHistory } from '../history.mjs';
import { computeAuthorshipUnion } from '../adjudication.mjs';
import { verifyRecordSignature } from '../signature.mjs';
import { computeDerivedReviewState } from '../derived-state.mjs';
import { EXIT_OK, UsageError, ValidationFailedError } from '../errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');
const REVIEW_ID_RE = /^rr-[0-9]{4}-(clinical-1|clinical-2|lab|adjudication|release-auth)$/;

async function loadSchema() {
  return JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
}

/**
 * @param {{ module?: string, root?: string, record?: string }} options
 * @returns {Promise<number>}
 */
export async function run(options = {}) {
  const moduleId = options.module;
  if (typeof moduleId !== 'string' || moduleId.length === 0) {
    throw new UsageError('validate requires --module <module_id>');
  }
  const rootDir = typeof options.root === 'string' && options.root.length > 0 ? options.root : process.cwd();

  if (typeof options.record === 'string' && !REVIEW_ID_RE.test(options.record)) {
    throw new UsageError(`--record "${options.record}" must be a valid review_id (rr-<seq4>-<role>)`);
  }

  const allRecords = await listModuleReviewRecords(rootDir, moduleId);

  let scoped = allRecords;
  if (typeof options.record === 'string') {
    scoped = allRecords.filter((r) => r.reviewId === options.record);
    if (scoped.length === 0) {
      throw new UsageError(`--record "${options.record}" was not found under modules/${moduleId}/reviews/`);
    }
  }

  const violations = [];
  const schema = await loadSchema();
  const rosterIndex = await loadRosterIndex(rootDir);

  for (const entry of scoped) {
    for (const schemaError of validateAgainstSchema(schema, entry.record)) {
      violations.push(`${entry.reviewId}: schema ${schemaError.path}: ${schemaError.message}`);
    }

    const reviewerId = entry.record?.reviewerId;
    if (typeof reviewerId === 'string') {
      try {
        resolveReviewer(rosterIndex, reviewerId, moduleId);
      } catch (err) {
        violations.push(`${entry.reviewId}: ${err.message}`);
      }
    }

    // P2-T5 — FR-10/OQ-2 Ed25519 signature verification, per-record (respects --record narrowing,
    // unlike the module-wide chain/independence/authorship checks below). See lib/signature.mjs's
    // own header for the full verification-order contract.
    const sigResult = verifyRecordSignature(entry.record);
    if (!sigResult.ok) {
      violations.push(`${entry.reviewId}: signature: ${sigResult.reason}`);
    }
  }

  // P1-T1 (Clinical Review Workflow v1, FR-2/R2): every module-wide check below — FR-4 reviewer-2
  // independence, FR-9/OQ-2 chain linkage (always) + optional git-history layer, PRD OQ-5
  // authorship-union / FR-5 adjudicator-authorship, and FR-6 release-authorization validity — used
  // to be computed inline, here, in this verb. That reasoning now lives in the ONE shared
  // `computeDerivedReviewState` (`lib/derived-state.mjs`), so `validate` and any future consumer
  // (the `status` verb, P1-T2) share a single derived-state implementation rather than forking it.
  // This verb still owns every I/O-dependent input that function needs (roster resolution,
  // authorship-union git computation, the opt-in git-history walk) — `computeDerivedReviewState`
  // itself is a pure function over already-loaded data, exactly as its own header documents.

  // Roster resolution is recomputed once here, module-wide, deliberately independent of the
  // per-scoped-record loop above (which is narrowed by --record and does not retain resolved
  // entries) — mirrors this tool's existing "small, independently-reasoned-about functions" posture
  // (lib/roster.mjs's own header) rather than threading extra state through the scoped loop.
  const rosterVerifiedByReviewId = new Map();
  const resolvedRosterEntryByReviewId = new Map();
  for (const entry of allRecords) {
    const reviewerId = entry.record?.reviewerId;
    if (typeof reviewerId !== 'string') {
      rosterVerifiedByReviewId.set(entry.reviewId, false);
      continue;
    }
    try {
      const resolved = resolveReviewer(rosterIndex, reviewerId, moduleId);
      rosterVerifiedByReviewId.set(entry.reviewId, true);
      resolvedRosterEntryByReviewId.set(entry.reviewId, resolved);
    } catch {
      rosterVerifiedByReviewId.set(entry.reviewId, false);
    }
  }

  const authorship = computeAuthorshipUnion(rootDir, moduleId);

  // P2-T3 layer (b) — git-history append-only check, OPT-IN via --history (see this file's own
  // header for why it is not unconditional). NotAGitRepositoryError/GitHistoryCheckError (a genuine
  // tool-usage failure, not a detected mutation) propagate straight out of this verb rather than
  // being folded into `violations` — those two error classes are already UsageError subclasses
  // (lib/history.mjs), so cli.mjs's dispatcher maps them to the same fail-closed exit code a
  // collected-violations rejection would use, without this verb pretending a tooling failure was a
  // content finding.
  const historyReport = options.history === true ? checkAppendOnlyHistory(rootDir, moduleId) : null;

  const derived = computeDerivedReviewState(allRecords, rosterVerifiedByReviewId, {
    resolvedRosterEntryByReviewId,
    authorship,
    historyReport,
    moduleId,
  });
  violations.push(...derived.blockers);

  if (violations.length > 0) throw new ValidationFailedError(violations);

  process.stdout.write(
    `OK — ${scoped.length} record(s) validated for module "${moduleId}" (schema shape + D-4 roster ` +
      'resolution + FR-4 reviewer-2 independence heuristic + FR-9 previousRecordHash chain' +
      `${options.history === true ? ' + FR-9 git-history append-only check' : ''} + PRD OQ-5 ` +
      'authorship-union / FR-5 adjudicator-authorship check + FR-6 release-authorization validity + ' +
      'FR-10 Ed25519 signature verification, TESTKEY- dry-run only).\n' +
      'Structural review-record state only -- not a clinical-validity, safety, or approval claim.\n',
  );
  return EXIT_OK;
}
