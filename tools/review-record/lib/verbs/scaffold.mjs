// tools/review-record/lib/verbs/scaffold.mjs — `scaffold` verb, real implementation (P2-T2,
// FR-3/FR-4/FR-7).
//
// `scaffold --module <id> --role <role> --subject <content-hash> --reviewer-id <id> --decision
// <approve|reject|request-changes> --rationale <text> [--reviewed-at <iso>] [--supersedes
// <review_id>] [--root <dir>]` builds a schema-shaped review-record draft for one of the five
// ADR-0004 roles. Two D-4/FR-3 requirements enforced here:
//
//   1. `reviewerId` MUST resolve against `governance/reviewer-roster.yaml` — unknown identity, or
//      an identity outside the target module's `moduleScopes[]`, fails closed
//      (`lib/roster.mjs`'s `UnknownReviewerError`/`ReviewerNotInScopeError`).
//   2. Reviewer-2 independence (FR-4, ADR-0004 "no read dependency") is STRUCTURAL: this verb —
//      for every role, `clinical-2` included — links a new draft into the module's hash chain via
//      `lib/chain.mjs`'s `nextChainLink`, which returns only a sequence number and a hash STRING,
//      never a sibling record's parsed content. There is no code path below (or anywhere else in
//      this file) that ever reads a `clinical-1` record's `decision`/`rationale`/`reviewerId` when
//      building a `clinical-2` draft. See `lib/independence.mjs`'s header for the supplementary
//      heuristic layer `validate` runs on top of this structural guarantee.
//
// Signature-gated write (OQ-2/OQ-6, honesty posture — "signature slots const-null on real
// candidates, roster synthetic-only pre-G1"): `governance/reviewer-roster.yaml` ships empty and,
// per FR-3, no task ever adds a `synthetic: false` entry to it pre-G1 — so every `reviewerId` this
// verb can currently resolve belongs to a `synthetic: true` dry-run persona. Per
// `schemas/review-record.schema.json`'s own `allOf`, a `synthetic: true` record's `signature` MUST
// be a populated `{algorithm, keyId, value}` object, never `null` — and this task owns NO signing
// capability (that is P2-T5's `node:crypto` Ed25519 work, composed with this module's own
// `buildDraftRecord` by the later `dry-run` verb, P2-T8). This verb therefore never writes a
// `synthetic: true` draft to disk on its own — doing so would either (a) write a schema-invalid
// file, or (b) require fabricating a signature-shaped value with no real signing behind it, which
// is exactly the "gated capability" this repository's guardrails require to stay inert rather than
// faked. Resolving against a synthetic roster entry instead prints the fully-shaped draft to
// stdout, explicitly labeled NOT WRITTEN, pending a real signature. The disk-write path below fires
// only for a `synthetic: false` roster entry — which cannot exist before gate G1 clears (a human
// act, never performed by any task) — so it is correctly, structurally inert today; see
// `lib/store.mjs`'s `writeNewReviewRecordFile` for the append-only guard once it does fire.
//
// P1-T3 addition (clinical-review-workflow-v1, FR-3/FR-4/FR-5, R7/R8): `--subject` is now OPTIONAL.
// When omitted, this verb derives `subjectContentHash` via `lib/subject.mjs`'s
// `computeModuleContentHash` — the exact same function `dry-run` (`lib/verbs/dry-run.mjs`) already
// uses for its own default `--subject` — so a scaffolded draft's auto-derived subject can never
// silently drift from what a full dry-run over the same module would have used (R8). This verb's
// real-identity (`synthetic: false`) write path above is unchanged by this addition — it is
// exercised in this task's own tests only against a throwaway fixture roster
// (`tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml`), never
// `governance/reviewer-roster.yaml` itself, which ships (and stays) 5 `synthetic: true` entries / 0
// real entries.
//
// CRW-F2 gap closure (P2-T1, Clinical Review Workflow v1 Phase 2 prerequisite): the Revision-1 plan
// row for P1-T3 additionally specified two things the originally-dispatched P1-T3 task did not ship
// (see `.claude/findings/clinical-review-workflow-findings.md`, CRW-F2) — both added here, since
// Phase 2's `sign` verb (`lib/verbs/sign.mjs`) structurally depends on the second one:
//
//   (a) F5 — when `--subject` IS supplied, this verb now recomputes `computeModuleContentHash` for
//       the target module and hard-fails (`UsageError`) by default if the two disagree: the
//       `sha256:<64 hex>` pattern check alone cannot catch a transposed-but-pattern-valid hash that
//       is syntactically fine but points at the wrong content. `--allow-historical-subject`
//       suppresses ONLY this comparison (never the pattern check), for the legitimate case of
//       reviewing historical content that no longer matches the module's current on-disk bytes.
//
//       SCOPE NOTE on this comparison (see CRW-F5 in the findings doc for the full reasoning): it
//       only fires when `computeModuleContentHash` can actually produce a value for `moduleId`
//       under `rootDir` — i.e. `modules/<moduleId>/` exists on disk with at least one non-`reviews/`
//       file. When it CANNOT (module directory absent, or present but empty of non-`reviews/`
//       content), there is no freshly-computed module-content hash for the supplied `--subject` to
//       disagree with in the first place, so this is treated as "nothing to compare" rather than a
//       hard-fail — distinct from an actual computed MISMATCH, which always hard-fails by default
//       regardless of this exemption. This keeps the already-shipped `--role adjudication` scaffold
//       bridge (`tools/retro-validate/lib/discordance.mjs`'s `toAdjudicationScaffoldInput`, Evidence
//       Foundry E1 Phase 4) working unmodified: an adjudication act's `subjectContentHash` there is
//       legitimately a discordance record's own `candidateDigest`, never a fresh module-content
//       hash, and that bridge's own fixture root carries no `modules/` directory at all.
//
//   (b) `--draft` staging write (F1 seam, feeds Phase 2's `sign` verb) — with `--draft`, this verb
//       builds the record exactly as it otherwise would (regardless of the resolved roster entry's
//       `synthetic` flag) and writes it to `draftFilePathFor(rootDir, moduleId, reviewId)` —
//       `<rootDir>/.review-drafts/<moduleId>/<reviewId>.draft.yaml`, OUTSIDE `reviews/`, gitignored
//       (`.gitignore`) — instead of running the preview-vs-direct-write branch below at all. Nothing
//       is ever written under `reviews/` when `--draft` is set. `sign` (`lib/verbs/sign.mjs`) reads
//       ONLY from this exact staging path.

import {
  REVIEW_ROLES,
  buildReviewId,
  serializeReviewRecordYaml,
  writeDraftRecordFile,
  writeNewReviewRecordFile,
} from '../store.mjs';
import { nextChainLink } from '../chain.mjs';
import { loadRosterIndex, resolveReviewer } from '../roster.mjs';
import { computeModuleContentHash } from '../subject.mjs';
import { EXIT_OK, UsageError } from '../errors.mjs';

// Re-exported for callers (e.g. `lib/verbs/sign.mjs`, tests) that want the draft-staging path
// convention without importing `store.mjs` directly — the actual definition, and the one
// `writeFile` call site (`tests/ef-review-adjudication.test.mjs`'s structural invariant), both live
// in `store.mjs`; see this file's header (CRW-F2/CRW-F6) and that file's own "Draft staging path"
// section for why.
export { draftFilePathFor, draftsDirFor } from '../store.mjs';

const DECISIONS = Object.freeze(['approve', 'reject', 'request-changes']);
const SUBJECT_HASH_RE = /^sha256:[0-9a-f]{64}$/;
const REVIEW_ID_RE = /^rr-[0-9]{4}-(clinical-1|clinical-2|lab|adjudication|release-auth)$/;
const REVIEWED_AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const SCHEMA_VERSION = 1;

/**
 * Pure builder: assembles a fully-shaped review-record document from already-validated inputs.
 * `signature` is always `null` here — P2-T2 owns no signing capability (see this file's header);
 * attaching a real `TESTKEY-` signature to a `synthetic: true` draft is P2-T5/P2-T8's job, composed
 * on top of this function's return value, never inside it.
 *
 * @param {object} params
 * @returns {object} a review-record document (may be `synthetic: true` with `signature: null` —
 *   NOT independently schema-valid in that case; see this file's header)
 */
export function buildDraftRecord({
  moduleId,
  role,
  reviewId,
  subjectContentHash,
  previousRecordHash,
  supersedes,
  reviewerId,
  decision,
  rationale,
  reviewedAt,
  synthetic,
}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    review_id: reviewId,
    role,
    moduleId,
    subjectContentHash,
    previousRecordHash,
    supersedes,
    reviewerId,
    decision,
    rationale,
    reviewedAt,
    synthetic,
    signature: null,
  };
}

function requireString(options, flag, key = flag) {
  const value = options[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new UsageError(`scaffold requires --${flag} <value>`);
  }
  return value;
}

/**
 * @param {{
 *   module?: string, role?: string, subject?: string, reviewerId?: string, decision?: string,
 *   rationale?: string, reviewedAt?: string, supersedes?: string, root?: string,
 *   allowHistoricalSubject?: boolean, draft?: boolean,
 * }} options `subject` is OPTIONAL (P1-T3, FR-3/R8) — when omitted, it is auto-derived via
 *   `lib/subject.mjs`'s `computeModuleContentHash(rootDir, moduleId)`, the same function `dry-run`
 *   uses for its own default; when supplied, its `sha256:<64 hex>` shape is validated AND (F5,
 *   default, unless `allowHistoricalSubject`) compared against a freshly recomputed
 *   `computeModuleContentHash` when one can be computed — see this file's header for the exact
 *   scope of that comparison. `draft: true` (F1 seam) writes the built record to
 *   `draftFilePathFor(rootDir, moduleId, reviewId)` instead of running the normal preview-or-write
 *   branch, and makes no write under `reviews/`.
 * @returns {Promise<number>}
 */
export async function run(options = {}) {
  const moduleId = requireString(options, 'module');
  const role = requireString(options, 'role');
  const reviewerId = requireString(options, 'reviewer-id', 'reviewerId');
  const decision = requireString(options, 'decision');
  const rationale = requireString(options, 'rationale');

  if (!REVIEW_ROLES.includes(role)) {
    throw new UsageError(`--role "${role}" must be one of ${REVIEW_ROLES.join(', ')}`);
  }
  if (!DECISIONS.includes(decision)) {
    throw new UsageError(`--decision "${decision}" must be one of ${DECISIONS.join(', ')}`);
  }

  const reviewedAt = typeof options.reviewedAt === 'string' && options.reviewedAt.length > 0
    ? options.reviewedAt
    : new Date().toISOString();
  if (!REVIEWED_AT_RE.test(reviewedAt)) {
    throw new UsageError(`--reviewed-at "${reviewedAt}" must be an RFC 3339 date-time`);
  }

  let supersedes = null;
  if (typeof options.supersedes === 'string' && options.supersedes.length > 0) {
    if (!REVIEW_ID_RE.test(options.supersedes)) {
      throw new UsageError(`--supersedes "${options.supersedes}" must be a valid review_id (rr-<seq4>-<role>)`);
    }
    supersedes = options.supersedes;
  }

  const rootDir = typeof options.root === 'string' && options.root.length > 0 ? options.root : process.cwd();

  // P1-T3 (FR-3, R8): `--subject` is optional. When supplied, its shape is validated exactly as
  // before; when omitted, derive it via the SAME `computeModuleContentHash` function `dry-run`
  // uses (lib/subject.mjs), over this module's already-committed content on disk under `rootDir` —
  // so an auto-derived `subjectContentHash` here can never independently drift from what a fresh
  // `dry-run` over the same module/root would compute.
  const allowHistoricalSubject = options.allowHistoricalSubject === true;
  let subjectContentHash = options.subject;
  if (typeof subjectContentHash === 'string' && subjectContentHash.length > 0) {
    if (!SUBJECT_HASH_RE.test(subjectContentHash)) {
      throw new UsageError(`--subject "${subjectContentHash}" must match sha256:<64 hex>`);
    }

    // F5 (CRW-F2 gap closure): recompute and compare, hard-failing on an actual computed mismatch
    // by default — see this file's header for the exact, deliberate scope of this comparison
    // (skipped, not hard-failed, when computeModuleContentHash cannot produce a value at all).
    if (!allowHistoricalSubject) {
      let recomputed = null;
      try {
        recomputed = await computeModuleContentHash(rootDir, moduleId);
      } catch {
        recomputed = null; // nothing on disk to compare against — see this file's header (CRW-F5)
      }
      if (recomputed !== null && recomputed !== subjectContentHash) {
        throw new UsageError(
          `--subject "${subjectContentHash}" does not match modules/${moduleId}/'s current content ` +
            `hash (recomputed "${recomputed}") — the sha256:<64 hex> pattern check alone cannot ` +
            'catch a transposed-but-pattern-valid hash pointing at the wrong content (F5). If this ' +
            'is intentionally reviewing historical content (a --subject computed against an earlier ' +
            `state of modules/${moduleId}/, since superseded), pass --allow-historical-subject to ` +
            'suppress ONLY this comparison — the sha256:<64 hex> pattern check above still always runs.',
        );
      }
    }
  } else {
    subjectContentHash = await computeModuleContentHash(rootDir, moduleId);
  }

  const rosterIndex = await loadRosterIndex(rootDir);
  const rosterEntry = resolveReviewer(rosterIndex, reviewerId, moduleId);

  const { seq, previousRecordHash } = await nextChainLink(rootDir, moduleId);
  const reviewId = buildReviewId(seq, role);

  const record = buildDraftRecord({
    moduleId,
    role,
    reviewId,
    subjectContentHash,
    previousRecordHash,
    supersedes,
    reviewerId,
    decision,
    rationale,
    reviewedAt,
    synthetic: rosterEntry.synthetic === true,
  });

  // --draft (F1 seam, CRW-F2 gap closure): stage the built record for `sign` to consume, regardless
  // of the resolved roster entry's synthetic flag — see this file's header. Never falls through to
  // the preview-vs-direct-write branch below; never writes under reviews/. The actual `writeFile`
  // call lives in `store.mjs`'s `writeDraftRecordFile` — see this file's header (CRW-F6) for why.
  if (options.draft === true) {
    const draftPath = await writeDraftRecordFile(rootDir, moduleId, reviewId, record);
    process.stdout.write(
      `Wrote draft ${draftPath}\n` +
        'STAGED ONLY — NOT A COMMITTED REVIEW RECORD. Outside modules/<id>/reviews/, gitignored. ' +
        'Next: `sign --draft <path> --module <id> --root <dir>` (synthetic:true drafts only, ' +
        'pre-G1/G2).\n' +
        'Structural review-record content only -- not a clinical-validity, safety, or approval claim.\n',
    );
    return EXIT_OK;
  }

  if (record.synthetic) {
    // Signature-gated: see this file's header. Preview only, never written.
    process.stdout.write(
      'DRAFT ONLY — NOT WRITTEN TO DISK.\n' +
        `reviewerId "${reviewerId}" resolves to a synthetic dry-run roster persona; ` +
        `schemas/review-record.schema.json requires a populated TESTKEY- signature on every ` +
        'synthetic:true record, and this verb (P2-T2) has no signing capability on this path (see ' +
        '`sign`, or the P2-T8 dry-run composition). This draft is otherwise fully shaped:\n\n' +
        `${serializeReviewRecordYaml(record)}\n` +
        'Structural review-record content only -- not a clinical-validity, safety, or approval claim.\n',
    );
    return EXIT_OK;
  }

  const filePath = await writeNewReviewRecordFile(rootDir, moduleId, reviewId, record);
  process.stdout.write(
    `Wrote ${filePath}\n` +
      'Structural review-record content only -- not a clinical-validity, safety, or approval claim.\n',
  );
  return EXIT_OK;
}
