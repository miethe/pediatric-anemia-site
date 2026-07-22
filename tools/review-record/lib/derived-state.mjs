// tools/review-record/lib/derived-state.mjs — shared derived-state library (Clinical Review
// Workflow v1, Phase 1, P1-T1, FR-2/R2).
//
// WHY THIS FILE EXISTS: `validate` (`lib/verbs/validate.mjs`) previously computed its module-wide
// findings -- FR-4 reviewer-2 independence, FR-9 `previousRecordHash` chain linkage, the optional
// FR-9/OQ-2 git-history append-only layer, PRD OQ-5's authorship-union / FR-5 adjudicator-authorship
// check, and FR-6 release-authorization validity -- inline, in one long function body. This module
// extracts that exact reasoning, UNCHANGED, into ONE pure function, `computeDerivedReviewState`, so
// `validate` and every future consumer (the `status` verb, P1-T2; the FR-26 adjudication
// conditional-completeness reconciliation, P1-T5) share ONE derived-state implementation rather than
// forking it. `validate.mjs`'s refactor onto this function is explicitly BEHAVIOR-PRESERVING: every
// violation string this file produces is byte-identical to what `validate.mjs` used to build inline
// (same wording, same conditions) -- this task changes WHERE the logic lives, not WHAT it decides.
//
// PURE FUNCTION, DELIBERATELY: every check below reasons only over already-loaded, in-memory inputs
// (`allModuleRecords`, a precomputed roster-verification map, and a small `opts` bag of other
// already-computed facts) -- it performs no filesystem or `git` I/O itself. The two module-wide
// facts that DO require I/O -- PRD OQ-5's authorship union (`lib/adjudication.mjs`'s
// `computeAuthorshipUnion`, which shells out to local, offline `git`) and the optional FR-9/OQ-2
// git-history append-only report (`lib/history.mjs`'s `checkAppendOnlyHistory`, same local-git
// posture) -- are computed by the CALLER (`validate.mjs`) and passed in through `opts`, exactly the
// same way `rosterVerifiedByReviewId` (built from `lib/roster.mjs`'s file-reading
// `loadRosterIndex`) already was. This keeps this file a plain, synchronous, side-effect-free
// function over data the caller already holds -- easy to unit-test directly, and safe to call from
// `status` (P1-T2) without that verb re-deriving its own copy of any of this reasoning.
//
// SCOPE NOTE (what this task deliberately does NOT add): the fuller Phase 1 design
// (`.claude/worknotes/clinical-review-workflow/decisions-block.md`, risk R2) describes this
// function's eventual return shape as `{ state, nextExpectedRole, eligibility, blockers: string[] }`
// -- a full derived-state-machine result. This task (P1-T1, scoped narrowly to "extract validate's
// existing release-authorization evaluator, no output-shape change to validate") ships only the
// `blockers` half of that shape (plus the raw `chainReport`, already-structured data `validate`
// itself never needed to re-derive). The `state`/`nextExpectedRole`/`eligibility` fields that name a
// human-readable lifecycle position (e.g. "not-started", "in-progress", `status`'s frozen
// `--json` enum) are new reasoning this task's acceptance criteria do not cover, and are left to
// P1-T2 (the `status` verb, which owns that frozen enum) to add on top of `blockers` -- see this
// task's own finding entry in `.claude/findings/clinical-review-workflow-findings.md` for the
// explicit record of this scope boundary.
//
// P1-T5 (FR-26, governance-sensitive) reconciled `lib/adjudication.mjs`'s release-authorization
// completeness policy against ADR-0004 decision item 5 ("adjudication produced only when reviewer 1
// and reviewer 2 disagree"): `adjudication` is now a CONDITIONAL completeness requirement rather
// than an unconditional fifth role. That policy (the effective-record resolution and the
// agree/disagree predicate) lives ENTIRELY in `lib/adjudication.mjs`'s `evaluateReleaseAuthorization`
// (via `isAdjudicationRequired`/`resolveEffectiveRoleRecord`) -- this file was deliberately NOT
// changed to fork a second copy of that reasoning; the release-auth block below already calls
// `evaluateReleaseAuthorization` as its one release-auth sub-check, so `status` (once P1-T2 lands)
// and `validate` inherit the FR-26 policy identically, from the same call, with zero drift risk
// (the F2 blocker this task exists to close).

import { checkReviewerIndependence } from './independence.mjs';
import { checkModuleChainLinkage } from './chain.mjs';
import {
  evaluateReleaseAuthorization,
  resolveEffectiveRoleRecord,
  rosterEntryInAuthorshipUnion,
} from './adjudication.mjs';

/**
 * Computes every module-wide derived-state finding `validate` enforces fail-closed, as a flat list
 * of human-readable `blockers` strings (each already carrying its own explanatory prefix/wording,
 * exactly as `validate.mjs` used to build them inline) plus the raw chain-linkage report. Per-record
 * checks (schema shape, per-record roster resolution, signature verification) are NOT part of this
 * function -- they respect `--record` narrowing in a way these module-wide checks structurally
 * cannot (a chain break, an independence violation, or a release-authorization defect is a fact
 * about the module's whole record set, never about one record in isolation), and `validate.mjs`
 * continues to compute them directly in its own per-record loop.
 *
 * @param {{ reviewId: string, seq: number, role: string, record: object }[]} allModuleRecords every
 *   committed record for the module, in ascending `seq` order (`lib/store.mjs`'s
 *   `listModuleReviewRecords` shape) -- the FULL module set, never narrowed by `--record`.
 * @param {Map<string, boolean>} rosterVerifiedByReviewId `reviewId -> whether its reviewerId
 *   resolved against the roster` (computed once, module-wide, by the caller via `lib/roster.mjs`).
 * @param {{
 *   resolvedRosterEntryByReviewId?: Map<string, object>,
 *   authorship?: { authors: string[], sources: string[], incomplete: boolean, notes: string[] } | null,
 *   historyReport?: { paths: { path: string, ok: boolean, reason?: string }[] } | null,
 *   moduleId?: string,
 * }} [opts] already-computed, possibly-I/O-derived facts this pure function does not derive itself:
 *   - `resolvedRosterEntryByReviewId` -- `reviewId -> resolved roster entry`, needed only for the
 *     FR-5 authorship-union membership check below (defaults to an empty Map: no violations from
 *     this sub-check when omitted).
 *   - `authorship` -- PRD OQ-5's authorship-union block (`lib/adjudication.mjs`'s
 *     `computeAuthorshipUnion` result). When omitted/`null`, the authorship/FR-5 check is skipped
 *     entirely (the caller is responsible for always computing it when FR-5 enforcement is desired
 *     -- `validate.mjs` always does).
 *   - `historyReport` -- the FR-9/OQ-2 opt-in git-history append-only report
 *     (`lib/history.mjs`'s `checkAppendOnlyHistory` result). When omitted/`null`, the git-history
 *     layer is skipped (matches `validate`'s own `--history`-opt-in posture -- a plain `validate`
 *     call never computes or passes this).
 *   - `moduleId` -- included only so the authorship-union-incomplete blocker message can name the
 *     module, exactly as `validate.mjs`'s inline version used to (byte-identical wording).
 * @returns {{ blockers: string[], chainReport: { reviewId: string, ok: boolean, reason?: string }[] }}
 *   `blockers` -- every module-wide violation string found (independence, chain, optional
 *   git-history, authorship/FR-5, FR-6 release-authorization), in that order; empty when nothing is
 *   wrong. `chainReport` -- the raw `checkModuleChainLinkage` result, exposed so a caller (e.g. a
 *   future `status --json` consumer) can report per-record chain linkage without recomputing it.
 */
export function computeDerivedReviewState(allModuleRecords, rosterVerifiedByReviewId, opts = {}) {
  const {
    resolvedRosterEntryByReviewId = new Map(),
    authorship = null,
    historyReport = null,
    moduleId,
  } = opts;

  const blockers = [];

  // FR-4 reviewer-2 independence heuristic -- pairwise and module-scoped, not per-record: always
  // computed over the module's EFFECTIVE clinical-1/clinical-2 pair (if both exist). CRW-F4 (fixed
  // here): this used to resolve the pair via a plain `allModuleRecords.find((r) => r.role ===
  // 'clinical-1' | 'clinical-2')` -- the FIRST record of that role by seq order, NOT the FR-26
  // supersedes-aware EFFECTIVE (latest non-superseded) act `resolveEffectiveRoleRecord` (P1-T5,
  // `lib/adjudication.mjs`) already resolves for the release-authorization completeness check
  // below. That mismatch cut both ways: a superseding correction could hide a real independence
  // violation living only in the stale (superseded) original, OR a stale original's violation could
  // keep surfacing as a blocker even after a clean correction had already superseded it. Both are
  // wrong per OQ-2's append-only model ("once a correction supersedes a record, that corrected
  // record's own `decision` must never re-enter policy reasoning again" -- `resolveEffectiveRoleRecord`'s
  // own header). Reusing `resolveEffectiveRoleRecord` here (rather than forking a second copy of its
  // supersedes logic) means the independence heuristic and the FR-26 completeness check always agree
  // on which act is "the" clinical-1/clinical-2 record for a role -- one supersedes-resolution
  // implementation, not two that can drift. See this feature's findings doc (CRW-F4) for the
  // both-direction fixtures this closes.
  const clinical1 = resolveEffectiveRoleRecord(allModuleRecords, 'clinical-1');
  const clinical2 = resolveEffectiveRoleRecord(allModuleRecords, 'clinical-2');
  blockers.push(...checkReviewerIndependence(clinical1?.record, clinical2?.record));

  // FR-9/OQ-2 layer (a) -- previousRecordHash chain, ALWAYS enforced (fail-closed), module-scoped.
  // Reuses lib/chain.mjs's checkModuleChainLinkage verbatim -- the exact same structured,
  // deterministic report `list` already prints informationally is also this function's fail-closed
  // enforcement input; there is exactly one chain-recomputation implementation in this tool.
  const chainReport = checkModuleChainLinkage(allModuleRecords);
  for (const link of chainReport) {
    if (!link.ok) blockers.push(`chain: ${link.reviewId}: ${link.reason}`);
  }

  // FR-9/OQ-2 layer (b) -- OPT-IN git-history append-only check. Only evaluated when the caller
  // supplies an already-computed `historyReport` (validate's `--history` flag; the underlying git
  // walk is I/O this pure function does not perform).
  if (historyReport) {
    for (const entry of historyReport.paths) {
      if (!entry.ok) blockers.push(`git-history: ${entry.path}: ${entry.reason}`);
    }
  }

  // PRD OQ-5 authorship-union computation + FR-5 (adjudicator/release-authorizer must not be in the
  // authorship union of the proposal they are reviewing). Module-wide, like the independence/chain
  // checks above, and always evaluated over the FULL module record set. Only evaluated when the
  // caller supplies an already-computed `authorship` block (the underlying union computation is
  // git I/O this pure function does not perform).
  const adjudicationLikeRecords = allModuleRecords.filter(
    (entry) => entry.role === 'adjudication' || entry.role === 'release-auth',
  );
  if (authorship) {
    if (authorship.incomplete && adjudicationLikeRecords.length > 0) {
      blockers.push(
        `authorship-union (PRD OQ-5) could not be fully computed for module "${moduleId}" — ` +
          `${authorship.notes.join(' ')} Failing closed: no adjudication/release-auth record can be ` +
          'validated without a complete authorship union.',
      );
    } else {
      for (const entry of adjudicationLikeRecords) {
        const rosterEntry = resolvedRosterEntryByReviewId.get(entry.reviewId);
        if (rosterEntry && rosterEntryInAuthorshipUnion(rosterEntry, authorship)) {
          blockers.push(
            `${entry.reviewId}: reviewerId "${entry.record.reviewerId}" (name "${rosterEntry.name}") is in ` +
              'the authorship union of the proposal it reviews (PRD OQ-5/FR-5) — an author of a proposal, ' +
              'or the git author of the commit that introduced it, may not adjudicate or release-authorize ' +
              'its own review.',
          );
        }
      }
    }
  }

  // FR-6: a release-auth record is valid only over a complete, chain-valid, roster-verified,
  // non-synthetic record set. Always non-qualifying for any record this tool can currently produce
  // (governance/reviewer-roster.yaml ships synthetic-only pre-G1, FR-3) — by design, not a bug.
  // `evaluateReleaseAuthorization`'s violations[] map 1:1 onto this function's blockers[] (this IS
  // its release-auth sub-check, not a parallel path merely agreeing with it). "Complete" here is
  // FR-26's CONDITIONAL completeness policy (P1-T5, governance-sensitive, ADR-0004 decision item
  // 5): `adjudication` is required only when the resolved clinical-1/clinical-2 decisions disagree
  // — see `evaluateReleaseAuthorization`'s own header in `lib/adjudication.mjs` for the policy
  // itself; this file does not duplicate it.
  for (const entry of allModuleRecords.filter((r) => r.role === 'release-auth')) {
    blockers.push(...evaluateReleaseAuthorization(allModuleRecords, entry, rosterVerifiedByReviewId));
  }

  return { blockers, chainReport };
}
