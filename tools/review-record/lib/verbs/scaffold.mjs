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
// silently drift from what a full dry-run over the same module would have used (R8). When
// `--subject` IS supplied, the existing pattern-shape validation runs unchanged; this task does not
// add the `computeModuleContentHash` cross-check against a supplied `--subject` (that comparison,
// plus `--allow-historical-subject`, is F5 — out of this task's narrower scope, see this feature's
// findings doc if that gap needs tracking). This verb's real-identity (`synthetic: false`) write
// path above is unchanged by this addition — it is exercised in this task's own tests only against
// a throwaway fixture roster (`tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml`),
// never `governance/reviewer-roster.yaml` itself, which ships (and stays) 5 `synthetic: true`
// entries / 0 real entries.

import { REVIEW_ROLES, buildReviewId, serializeReviewRecordYaml, writeNewReviewRecordFile } from '../store.mjs';
import { nextChainLink } from '../chain.mjs';
import { loadRosterIndex, resolveReviewer } from '../roster.mjs';
import { computeModuleContentHash } from '../subject.mjs';
import { EXIT_OK, UsageError } from '../errors.mjs';

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
 * }} options `subject` is OPTIONAL (P1-T3, FR-3/R8) — when omitted, it is auto-derived via
 *   `lib/subject.mjs`'s `computeModuleContentHash(rootDir, moduleId)`, the same function `dry-run`
 *   uses for its own default; when supplied, its `sha256:<64 hex>` shape is still validated exactly
 *   as before.
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
  let subjectContentHash = options.subject;
  if (typeof subjectContentHash === 'string' && subjectContentHash.length > 0) {
    if (!SUBJECT_HASH_RE.test(subjectContentHash)) {
      throw new UsageError(`--subject "${subjectContentHash}" must match sha256:<64 hex>`);
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

  if (record.synthetic) {
    // Signature-gated: see this file's header. Preview only, never written.
    process.stdout.write(
      'DRAFT ONLY — NOT WRITTEN TO DISK.\n' +
        `reviewerId "${reviewerId}" resolves to a synthetic dry-run roster persona; ` +
        `schemas/review-record.schema.json requires a populated TESTKEY- signature on every ` +
        'synthetic:true record, and this verb (P2-T2) has no signing capability (that is P2-T5, ' +
        'composed by the P2-T8 dry-run flow). This draft is otherwise fully shaped:\n\n' +
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
