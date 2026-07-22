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
//       REVISED by CRW-F5 (clinical-review-workflow-v1 Wave-2 codex gate, BLOCKER 2 -- see
//       .claude/findings/clinical-review-workflow-findings.md's CRW-F5 entry for the full history):
//       an UNCOMPUTABLE `computeModuleContentHash` (module directory absent, or present but empty
//       of non-`reviews/` content) is now treated EXACTLY like a computed MISMATCH -- it hard-fails
//       by default, naming the underlying failure, rather than being silently accepted as "nothing
//       to compare." The earlier exemption let a root with a valid roster but a missing/empty
//       module stage+sign a wrong, merely pattern-valid `--subject` that `validate` would never
//       catch (validate has nothing to recompute against either). `--allow-historical-subject`
//       remains the ONLY suppression for either condition (an actual mismatch, or an uncomputable
//       hash) -- and using it is always LOUD in this verb's own stdout output (a `NOTICE (--allow-
//       historical-subject): ...` line), never a silent skip. Every already-shipped caller that
//       legitimately scaffolds against a non-module root WITH an explicit `--subject` (the
//       `--role adjudication` bridge, `tools/retro-validate/lib/discordance.mjs`'s
//       `toAdjudicationScaffoldInput`, and this tool's own narrow CLI-behavior fixtures) now passes
//       `--allow-historical-subject`/`allowHistoricalSubject: true` explicitly rather than relying
//       on the removed silent exemption.
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
 *   uses for its own default (and hard-fails, unconditionally, if that derivation itself fails —
 *   unchanged by the CRW-F5 revision below); when supplied, its `sha256:<64 hex>` shape is
 *   validated AND (F5, default, unless `allowHistoricalSubject`) compared against a freshly
 *   recomputed `computeModuleContentHash` — an uncomputable module hash is now treated exactly like
 *   a computed mismatch (CRW-F5 revision, see this file's header) rather than "nothing to compare."
 *   `allowHistoricalSubject: true` is the ONLY suppression for either condition, and this verb
 *   always prints a loud stdout NOTICE when it actually suppresses something. `draft: true` (F1
 *   seam) writes the built record to
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
  // Set below, ONLY when --allow-historical-subject actually suppresses a would-be hard-fail (an
  // uncomputable module hash, or an actual computed mismatch) -- prepended to whichever stdout
  // branch below ultimately fires, so the suppression is always LOUD in this verb's own output,
  // never a silent skip (CRW-F5 revision requirement).
  let subjectOverrideNotice = '';
  let subjectContentHash = options.subject;
  if (typeof subjectContentHash === 'string' && subjectContentHash.length > 0) {
    if (!SUBJECT_HASH_RE.test(subjectContentHash)) {
      throw new UsageError(`--subject "${subjectContentHash}" must match sha256:<64 hex>`);
    }

    // F5 (CRW-F2 gap closure, REVISED by CRW-F5 -- clinical-review-workflow-v1 Wave-2 codex gate,
    // BLOCKER 2; see .claude/findings/clinical-review-workflow-findings.md's CRW-F5 entry): the
    // comparison ALWAYS attempts to recompute modules/<moduleId>/'s own content hash, whether or
    // not --allow-historical-subject is set, so the outcome (match / mismatch / uncomputable) can
    // always be reported -- an uncomputable module is now treated exactly like a computed MISMATCH,
    // never "nothing to compare." --allow-historical-subject remains the ONLY suppression for
    // either condition, and it is always loud (a NOTICE line) when it actually suppresses something.
    let recomputed = null;
    let recomputeError = null;
    try {
      recomputed = await computeModuleContentHash(rootDir, moduleId);
    } catch (err) {
      recomputeError = err;
    }

    if (recomputeError !== null) {
      if (!allowHistoricalSubject) {
        throw new UsageError(
          `--subject "${subjectContentHash}" was supplied, but modules/${moduleId}/'s content hash ` +
            `could not be recomputed to verify it against (${recomputeError.message}) -- F5 hard-` +
            'fails by default whenever an explicitly-supplied --subject cannot be verified against ' +
            'the target module\'s current on-disk content, the same as an actual computed mismatch ' +
            '(CRW-F5 revision: "cannot verify" is no longer treated as "nothing to compare"). If ' +
            'this --subject is intentionally NOT a module-content hash (e.g. an adjudication act\'s ' +
            'subject is a discordance record\'s own candidateDigest -- tools/retro-validate/lib/' +
            'discordance.mjs\'s toAdjudicationScaffoldInput bridge), or this is intentionally ' +
            `reviewing historical content that predates modules/${moduleId}/'s current state, pass ` +
            '--allow-historical-subject to proceed anyway -- this suppresses ONLY this comparison, ' +
            'never the sha256:<64 hex> pattern check above, and this verb prints a loud NOTICE when ' +
            'it does.',
        );
      }
      subjectOverrideNotice =
        'NOTICE (--allow-historical-subject): the F5 content-hash comparison for --subject ' +
        `"${subjectContentHash}" was SKIPPED -- modules/${moduleId}/'s content hash could not be ` +
        `recomputed to compare against it (${recomputeError.message}). Proceeding WITHOUT ` +
        'verifying this --subject against the module\'s current on-disk content.\n';
    } else if (recomputed !== subjectContentHash) {
      if (!allowHistoricalSubject) {
        throw new UsageError(
          `--subject "${subjectContentHash}" does not match modules/${moduleId}/'s current content ` +
            `hash (recomputed "${recomputed}") — the sha256:<64 hex> pattern check alone cannot ` +
            'catch a transposed-but-pattern-valid hash pointing at the wrong content (F5). If this ' +
            'is intentionally reviewing historical content (a --subject computed against an earlier ' +
            `state of modules/${moduleId}/, since superseded), pass --allow-historical-subject to ` +
            'suppress ONLY this comparison — the sha256:<64 hex> pattern check above still always runs.',
        );
      }
      subjectOverrideNotice =
        'NOTICE (--allow-historical-subject): the F5 content-hash comparison for --subject ' +
        `"${subjectContentHash}" was SUPPRESSED -- it does not match modules/${moduleId}/'s current ` +
        `recomputed content hash ("${recomputed}"). Proceeding with the supplied --subject as-is ` +
        '(historical-content review).\n';
    }
    // else: recomputed === subjectContentHash -- nothing was suppressed, no notice to print.
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
      subjectOverrideNotice +
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
      subjectOverrideNotice +
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
    subjectOverrideNotice +
      `Wrote ${filePath}\n` +
      'Structural review-record content only -- not a clinical-validity, safety, or approval claim.\n',
  );
  return EXIT_OK;
}
