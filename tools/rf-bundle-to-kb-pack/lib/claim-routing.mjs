// tools/rf-bundle-to-kb-pack/lib/claim-routing.mjs — claim-ledger eligibility ROUTING (P3-T4,
// FR-13, `02 §4.11`).
//
//   routeClaim(claim, { hasResolvedExactPassage }) -> RoutedClaim
//   routeClaims(claims, assertions)                -> RoutingReport
//
// This is a DIFFERENT, later-stage classification from `./eligibility.mjs`'s (P2-T4) per-claim
// eligibility gate. `eligibility.mjs` answers "is this claim converter-eligible at all" against
// the `02 §3.7` field table (source/passage/locator/population/lab-context resolution) and
// produces its own `CLAIM_CATEGORIES` vocabulary (`fact_candidate`/`conflict_object`/
// `implementation_proposal_input`/`rejected`). This module answers a narrower, later question —
// "given an ALREADY-ELIGIBLE claim, what `02 §4.11` authoring/evidence target (`basis.kind`) may
// `modules/<id>/authoring-decisions.yaml` (P3-T1, `02 §4.12`) legally cite it as, and is it ever
// allowed to be the SOLE positive basis for a drafted rule" — the exact routing table FR-13 names.
// `Phase 3's `propose` verb (P3-T7) will call this module once it assembles the full staged pack;
// this task only builds and unit-tests the pure routing function itself.
//
// The routing table this module implements, verbatim from `02 §4.11` / this task's own binding
// acceptance criteria:
//
//   status=supported     -> basis.kind=source_supported_fact,      ELIGIBLE ONLY with a resolved
//                            exact passage (immutable hash+selector counts as "resolved" under
//                            this plan's OQ-2 rights-restricted fallback — the same convention
//                            `eligibility.mjs`'s `passageResolves()` already applies).
//   status=mixed         -> basis.kind=conflicting_source_facts,   conflict-visible object ONLY —
//                            never a one-sided rule (never the sole positive basis).
//   status=contradicted  -> basis.kind=contradicted_source_fact,   never the sole positive basis
//                            for a rule (it MAY still appear as a conflict-visible input alongside
//                            other basis).
//   status=inference     -> basis.kind=implementation_proposal,    ELIGIBLE ONLY with a populated,
//                            non-empty `inference_basis.from_claims`.
//   status=speculation,
//   status=unsupported   -> NEVER emitted as rule evidence at all — no legal `basis.kind`, zero
//                            rule-evidence output, regardless of anything else about the claim.
//   (unrecognized status) -> fails closed with a named reason, exactly like an unrecognized status
//                            in `eligibility.mjs` — absence/ambiguity is never silently admitted.
//
// Zero network calls, zero LLM/generative-model invocations, ever (FR-10) — this file performs no
// I/O and imports nothing beyond the small set of frozen constants it defines itself. Pure
// function throughout: same claim + same options always routes identically (02 §2.3 invariant 13,
// determinism).

/** The 4 `02 §4.11` `basis.kind` values a decision record may legally cite — see schemas/
 * authoring-decisions.schema.json's own `basis.kind` enum, which this constant mirrors exactly. A
 * rejected claim's `basisKind` is `null` (see `BASIS_KIND.NONE` below), never one of these 4 — a
 * `speculation`/`unsupported`/malformed claim has no legal authoring target at all. */
export const BASIS_KIND = Object.freeze({
  SOURCE_SUPPORTED_FACT: 'source_supported_fact',
  CONFLICTING_SOURCE_FACTS: 'conflicting_source_facts',
  CONTRADICTED_SOURCE_FACT: 'contradicted_source_fact',
  IMPLEMENTATION_PROPOSAL: 'implementation_proposal',
  NONE: null,
});

/**
 * @typedef {object} RoutedClaim
 * @property {string|null} claimId
 * @property {string|undefined} status the raw `claim_ledger.yaml.claims[].status` value
 * @property {string|null} basisKind one of `BASIS_KIND`'s 4 named values, or `null` if this claim
 *   has no legal rule-evidence target at all
 * @property {boolean} ruleEvidenceEligible whether this claim may appear in rule/candidate
 *   drafting evidence AT ALL (as any role — sole basis, conflict-visible object, or combined
 *   evidence). `false` for speculation/unsupported/malformed claims — FR-13's hard floor.
 * @property {boolean} eligibleAsSolePositiveBasis whether this claim, alone, may ground a drafted
 *   rule's positive clinical assertion with no other supporting claim. `false` for mixed and
 *   contradicted claims even when `ruleEvidenceEligible` is `true` — this is the specific
 *   "never a one-sided rule" / "never the sole positive basis" invariant FR-13 and this task's
 *   AC name explicitly.
 * @property {boolean} isConflictVisible whether this claim's drafted authoring object must
 *   surface a competing/disputed interpretation rather than presenting a single settled fact
 *   (`02 §2.3` invariant 8).
 * @property {string[]} reasons human-readable rejection or routing-constraint reasons; empty only
 *   for an unconditionally-eligible-as-sole-basis route (supported-with-passage, inference-with-
 *   basis).
 */

/**
 * Routes ONE already-eligible claim (per `./eligibility.mjs`'s gate) to its `02 §4.11`
 * authoring/evidence target. Never drops a claim — every input produces exactly one `RoutedClaim`,
 * including rejected ones (mirrors `eligibility.mjs`'s own "retain rejected items with reason"
 * posture, `02 §4.6` Phase 4).
 *
 * @param {object} claim one entry of `claim_ledger.yaml.claims[]`
 * @param {{ hasResolvedExactPassage?: boolean }} [options] `hasResolvedExactPassage` — whether at
 *   least one `modules/<id>/evidence-assertions.json` record (P3-T3) resolves this claim's
 *   `claim_id` to a real passage (verbatim text OR the OQ-2 hash+selector fallback — both count).
 *   Irrelevant for every status except `supported`, where FR-13 makes it the sole eligibility gate.
 * @returns {RoutedClaim}
 */
export function routeClaim(claim, { hasResolvedExactPassage = false } = {}) {
  const claimId = claim?.claim_id ?? null;
  const status = claim?.status;

  const reject = (reasons) => ({
    claimId,
    status,
    basisKind: BASIS_KIND.NONE,
    ruleEvidenceEligible: false,
    eligibleAsSolePositiveBasis: false,
    isConflictVisible: false,
    reasons,
  });

  switch (status) {
    case 'supported': {
      if (!hasResolvedExactPassage) {
        return reject([
          'claim status "supported" has no resolved exact passage in evidence-assertions.json — ' +
            '02 §4.11 requires one before basis.kind=source_supported_fact becomes eligible',
        ]);
      }
      return {
        claimId,
        status,
        basisKind: BASIS_KIND.SOURCE_SUPPORTED_FACT,
        ruleEvidenceEligible: true,
        eligibleAsSolePositiveBasis: true,
        isConflictVisible: false,
        reasons: [],
      };
    }

    case 'mixed': {
      // FR-13/02 §4.11: eligible ONLY as a conflict-visible authoring object — never a one-sided
      // rule, regardless of whether an exact passage resolves for it.
      return {
        claimId,
        status,
        basisKind: BASIS_KIND.CONFLICTING_SOURCE_FACTS,
        ruleEvidenceEligible: true,
        eligibleAsSolePositiveBasis: false,
        isConflictVisible: true,
        reasons: [],
      };
    }

    case 'contradicted': {
      // FR-13/02 §4.11: never the SOLE positive basis for a rule. Unlike speculation/unsupported,
      // a contradicted claim is not banned from rule evidence outright — it may still appear
      // combined with other supporting basis, always conflict-visible.
      return {
        claimId,
        status,
        basisKind: BASIS_KIND.CONTRADICTED_SOURCE_FACT,
        ruleEvidenceEligible: true,
        eligibleAsSolePositiveBasis: false,
        isConflictVisible: true,
        reasons: [],
      };
    }

    case 'inference': {
      const fromClaims = claim?.inference_basis?.from_claims;
      if (!Array.isArray(fromClaims) || fromClaims.length === 0) {
        return reject([
          'inference claim has no populated inference_basis.from_claims — 02 §4.11 requires a ' +
            'valid inference_basis before basis.kind=implementation_proposal becomes eligible',
        ]);
      }
      return {
        claimId,
        status,
        basisKind: BASIS_KIND.IMPLEMENTATION_PROPOSAL,
        ruleEvidenceEligible: true,
        eligibleAsSolePositiveBasis: true,
        isConflictVisible: false,
        reasons: [],
      };
    }

    // FR-13/02 §4.11: never emitted as rule evidence at all — no legal basis.kind, zero
    // rule-evidence output. This is a hard floor with no exceptions (this task's Known Gotchas).
    case 'speculation':
    case 'unsupported': {
      return reject([
        `claim status "${status}" is never emitted as rule evidence (FR-13, 02 §4.11)`,
      ]);
    }

    default: {
      // An unrecognized/missing claim status is not silently admitted — fail closed with a named
      // reason, mirroring eligibility.mjs's own default case.
      return reject([`unrecognized claim status ${JSON.stringify(status ?? null)}`]);
    }
  }
}

/**
 * @typedef {object} RoutingReport
 * @property {RoutedClaim[]} routed every input claim, routed, in input order
 * @property {RoutedClaim[]} eligibleForRuleEvidence the subset with `ruleEvidenceEligible: true`
 * @property {RoutedClaim[]} conflictObjects the subset with `isConflictVisible: true`
 * @property {RoutedClaim[]} rejected the subset with `ruleEvidenceEligible: false`, retained with
 *   reasons (never dropped)
 */

/**
 * Routes an entire `claim_ledger.yaml.claims[]` array against a resolved
 * `evidence-assertions.json.assertions[]` array, determining `hasResolvedExactPassage` per claim
 * from whether any assertion's `rfClaimId` names it.
 *
 * @param {object[]} claims `claim_ledger.yaml.claims[]`
 * @param {object[]} [assertions] `evidence-assertions.json.assertions[]` (P3-T3); defaults to `[]`
 *   so a caller with no assertions yet (e.g. mid-fixture-authoring) still gets a well-formed,
 *   all-`supported`-claims-rejected report rather than a crash.
 * @returns {RoutingReport}
 */
export function routeClaims(claims, assertions = []) {
  const resolvedClaimIds = new Set(
    (assertions ?? [])
      .map((assertion) => assertion?.rfClaimId)
      .filter((rfClaimId) => typeof rfClaimId === 'string' && rfClaimId !== ''),
  );

  const routed = (claims ?? []).map((claim) =>
    routeClaim(claim, { hasResolvedExactPassage: resolvedClaimIds.has(claim?.claim_id) }),
  );

  return {
    routed,
    eligibleForRuleEvidence: routed.filter((r) => r.ruleEvidenceEligible),
    conflictObjects: routed.filter((r) => r.isConflictVisible),
    rejected: routed.filter((r) => !r.ruleEvidenceEligible),
  };
}
