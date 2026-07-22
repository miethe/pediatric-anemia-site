// tools/rf-bundle-to-kb-pack/lib/eligibility.mjs — converter-eligibility + status-reconciliation
// checks (P2-T4, FR-9, 02 §2.3 invariants 1/3/4, 02 §3.7).
//
//   checkEligibility(pinnedBundle) -> EligibilityReport
//
// Two responsibilities, run in this order:
//
//   1. Bundle-level status reconciliation (02 §2.3 invariants 1, 3, 4). Fails closed (throws) —
//      no partial `EligibilityReport` is ever returned once this stage fails, matching this task's
//      AC ("non-zero exit and zero output files").
//   2. Per-claim eligibility against the 02 §3.7 field table (02 §4.6 Phase 4 "Select"). Rejected
//      claims are RETAINED in the returned report with their rejection reason(s), never silently
//      dropped ("retain rejected items with reason").
//
// This module performs no I/O and no filesystem writes of any kind — it is a pure function over
// the `PinnedBundle` shape `hashing.mjs` (P2-T3) resolves to (itself a superset of `loader.mjs`'s
// (P2-T2) `LoadedBundle`: `{ bundle: { parsed }, artifacts: { verification: { parsed },
// claimLedger: { parsed }, sourceCards: [...] }, ... }` plus a per-artifact hash map this module
// does not need to read). Because it never touches the filesystem, a thrown error here can never
// have produced partial output — the "zero output files" half of this task's first AC is true by
// construction, not by a separate guard.
//
// Zero network calls, zero LLM/generative-model invocations, ever (FR-10) — this file imports
// nothing beyond `./errors.mjs`.

import { SchemaError } from './errors.mjs';

// ---------------------------------------------------------------------------------------------
// 1. Bundle-level status reconciliation (02 §2.3 invariants 1, 3, 4)
// ---------------------------------------------------------------------------------------------

/**
 * 02 §2.3 invariant 1: "The seam accepts only an `rf` bundle whose `status` is `verified`."
 * Mapped to `SchemaError` (exit 2) per 02 §4.6's own phase table, whose "Validate upstream" row
 * lists "nonzero unresolved verify state" as exactly this failure's category — a non-`verified`
 * bundle status is an unresolved verify state at the bundle level, not a usage mistake (exit 1)
 * or a governance/human-review halt (exits 3/7), so `SchemaError` is the closest fit among the 8
 * taxonomy states, not a 9th invented one.
 */
export class BundleNotVerifiedError extends SchemaError {
  constructor(actualStatus, bundleId) {
    super(
      `bundle "${bundleId ?? '(unknown)'}" has status "${actualStatus}", not "verified" — the ` +
        'converter accepts only a verified rf bundle (02 §2.3 invariant 1). Refusing to proceed.',
    );
    this.actualStatus = actualStatus;
  }
}

/**
 * 02 §2.3 invariants 3-4: "The seam records the `rf` process exit code and
 * `reviews/verification.yaml.exit_code`" / "The seam rejects any disagreement between process and
 * artifact status." `evidence_bundle.yaml.status` is the bundle's own process-level record of the
 * run's outcome; `reviews/verification.yaml`'s `exit_code`/`passed` fields are the verification
 * artifact's own record of that same outcome. A `verified`-status bundle whose verification
 * artifact does NOT independently agree (`exit_code !== 0` or `passed !== true`), or a
 * verification artifact whose own `exit_code`/`passed` fields disagree with each other, is exactly
 * the "process/artifact status disagreement" this task's acceptance criteria names — two
 * independently-recorded signals about the same event must not be trusted individually.
 */
export class VerificationStateMismatchError extends SchemaError {
  constructor(detail) {
    super(`process/artifact status disagreement: ${detail}`);
  }
}

/**
 * Runs invariants 1/3/4 against the pinned bundle's `evidence_bundle.yaml` and
 * `reviews/verification.yaml`. Throws (never returns a partial result) on any disagreement.
 *
 * @param {object} pinnedBundle
 * @returns {{ status: string, verification: { exitCode: number, passed: boolean } }}
 */
function checkBundleStatus(pinnedBundle) {
  const bundleParsed = pinnedBundle?.bundle?.parsed ?? {};
  const status = bundleParsed.status;
  const bundleId = bundleParsed.id ?? pinnedBundle?.bundleId ?? null;

  if (status !== 'verified') {
    throw new BundleNotVerifiedError(status, bundleId);
  }

  const verification = pinnedBundle?.artifacts?.verification?.parsed ?? {};
  const exitCode = verification.exit_code;
  const passed = verification.passed;

  // The verification artifact's own two fields must agree with each other first...
  if (passed === true && exitCode !== 0) {
    throw new VerificationStateMismatchError(
      `reviews/verification.yaml reports passed=true but exit_code=${JSON.stringify(exitCode)} (expected 0)`,
    );
  }
  if (passed !== true && exitCode === 0) {
    throw new VerificationStateMismatchError(
      `reviews/verification.yaml reports exit_code=0 but passed=${JSON.stringify(passed)} (expected true)`,
    );
  }
  // ...and then the bundle's own `status: verified` claim must agree with the verification
  // artifact it is standing on. Given the two checks above already forced internal
  // self-consistency, this reduces to requiring passed===true/exitCode===0 outright.
  if (passed !== true || exitCode !== 0) {
    throw new VerificationStateMismatchError(
      `evidence_bundle.yaml declares status="verified" but reviews/verification.yaml reports ` +
        `passed=${JSON.stringify(passed)}, exit_code=${JSON.stringify(exitCode)}`,
    );
  }

  return { status, verification: { exitCode, passed } };
}

// ---------------------------------------------------------------------------------------------
// 2. Per-claim eligibility against the 02 §3.7 field table (02 §4.6 Phase 4 "Select")
// ---------------------------------------------------------------------------------------------

// Claim statuses this task's own acceptance criteria and 02 §2.3 items 7-10 name explicitly.
const STATUS_FACT_CANDIDATE = 'fact_candidate'; // supported claims whose sources+passages resolve
const STATUS_CONFLICT_OBJECT = 'conflict_object'; // mixed/contradicted -> conflict-visible only
const STATUS_IMPLEMENTATION_PROPOSAL_INPUT = 'implementation_proposal_input'; // inference claims
const STATUS_REJECTED = 'rejected';

const DEGRADED_LOCATOR_PATTERN = /^para\/0$/i;
const REDACTED_PASSAGE_PATTERN = /^\[redacted[\s\S]*sha256:[0-9a-f]{64}\]$/i;

function buildSourceCardIndex(sourceCards) {
  const index = new Map();
  for (const card of sourceCards ?? []) {
    const id = card?.frontmatter?.source_card_id;
    if (typeof id === 'string' && id !== '') index.set(id, card.frontmatter);
  }
  return index;
}

function findExtractedPoint(sourceCardFrontmatter, evidenceId) {
  const points = sourceCardFrontmatter?.extracted_points;
  if (!Array.isArray(points)) return null;
  return points.find((point) => point?.evidence_id === evidenceId) ?? null;
}

/**
 * 02 §3.7 "exact passage" row: present and within permitted quotation/reuse terms, OR an
 * immutable passage reference (hash) MUST resolve. This fixture's rights-restricted disposition
 * (P1-T6, `02 §4.10`'s fallback) replaces every verbatim quote with
 * `[redacted — content-rights: restricted (...); sha256:<hash>]` — that redaction marker IS the
 * immutable passage reference resolving, not a missing passage.
 */
function passageResolves(point) {
  const quote = point?.quote;
  if (typeof quote !== 'string' || quote.trim() === '') return false;
  if (REDACTED_PASSAGE_PATTERN.test(quote.trim())) return true; // immutable hash reference resolves
  return true; // a real, non-redacted exact-passage quote is present
}

/** 02 §3.7 "locator" row: present, and not a degraded-content placeholder like `para/0`. */
function locatorSufficient(locator) {
  if (typeof locator !== 'string' || locator.trim() === '') return false;
  return !DEGRADED_LOCATOR_PATTERN.test(locator.trim());
}

/**
 * 02 §3.7 "recency" row: sources older than five years must state a foundational,
 * not-superseded rationale. The reference point is the bundle's own `created_at` — never
 * wall-clock `Date.now()`, which would make eligibility (and therefore converter output,
 * invariant 13) depend on when the converter happens to run rather than on the bundle's content.
 * A source whose `published_at` cannot be parsed is not asserted stale (no invented judgment from
 * absent data) — the rest of the field-table checks still apply to it independently.
 */
function sourceIsStaleWithoutRationale(sourceCardFrontmatter, bundleCreatedAt) {
  const publishedAt = sourceCardFrontmatter?.source?.published_at;
  const publishedMatch = typeof publishedAt === 'string' ? /^(\d{4})/.exec(publishedAt) : null;
  const bundleMatch = typeof bundleCreatedAt === 'string' ? /^(\d{4})/.exec(bundleCreatedAt) : null;
  if (!publishedMatch || !bundleMatch) return false;

  const publishedYear = Number(publishedMatch[1]);
  const bundleYear = Number(bundleMatch[1]);
  const isStale = bundleYear - publishedYear >= 5;
  if (!isStale) return false;

  const rationale = sourceCardFrontmatter?.trust?.reliability_notes;
  return typeof rationale !== 'string' || rationale.trim() === '';
}

/**
 * Applies the resolvable subset of the 02 §3.7 field table to one cited source of one claim.
 * Returns a list of human-readable rejection reasons (empty when the source fully resolves).
 *
 * Two 02 §3.7 rows are explicitly NOT enforced as hard gates here, by design:
 *   - "threshold portability" (`universal`/`local_lab_dependent`/`implementation_proposed`) is an
 *     authoring DECISION this converter reads from `modules/<id>/authoring-decisions.yaml`
 *     (02 §4.12) — that file does not exist, and has no defined schema, until P3-T1. Hard-gating
 *     on it here would either invent a threshold-portability judgment this task has no authority
 *     to make, or reject every claim in Phase 2 outright. Phase 3's drafting logic owns this gate.
 *   - "conflicts" (`trust.conflicts_with`) is about VISIBILITY (02 §2.3 invariant 8: conflicts
 *     must be visible, not resolved-away), not eligibility — it is passed through unmodified
 *     rather than used to reject a claim.
 */
function checkSourceAgainstFieldTable(source, sourceCardIndex, bundleCreatedAt) {
  const reasons = [];
  const sourceCardId = source?.source_card_id;
  const evidenceId = source?.evidence_id;

  if (typeof sourceCardId !== 'string' || sourceCardId === '') {
    reasons.push('source has no source_card_id');
    return reasons;
  }
  const frontmatter = sourceCardIndex.get(sourceCardId);
  if (!frontmatter) {
    reasons.push(`source_card_id "${sourceCardId}" does not resolve to a source card in this bundle`);
    return reasons;
  }

  if (typeof evidenceId !== 'string' || evidenceId === '') {
    reasons.push(`source "${sourceCardId}" has no evidence_id`);
    return reasons;
  }
  const point = findExtractedPoint(frontmatter, evidenceId);
  if (!point) {
    reasons.push(`evidence_id "${evidenceId}" does not resolve to an extracted point in "${sourceCardId}"`);
    return reasons;
  }

  const locator = source?.locator ?? point?.locator;
  if (!locatorSufficient(locator)) {
    reasons.push(
      `source "${sourceCardId}"/"${evidenceId}" locator ${JSON.stringify(locator ?? null)} does not ` +
        'identify a page/section/table/figure/paragraph (a degraded-content placeholder like ' +
        '"para/0" is insufficient for a threshold)',
    );
  }

  if (!passageResolves(point)) {
    reasons.push(
      `source "${sourceCardId}"/"${evidenceId}" has no exact passage and no immutable passage reference resolves`,
    );
  }

  const pediatricCds = point?.pediatric_cds;
  if (!pediatricCds || typeof pediatricCds.population !== 'string' || pediatricCds.population.trim() === '') {
    reasons.push(
      `source "${sourceCardId}"/"${evidenceId}" is missing population/applicability qualifiers ` +
        '(age, setting, physiology, comorbidity, jurisdiction)',
    );
  }

  const thresholdValue = pediatricCds?.threshold?.value;
  if (thresholdValue !== null && thresholdValue !== undefined) {
    const assayMethod = pediatricCds?.assay_method;
    if (typeof assayMethod !== 'string' || assayMethod.trim() === '') {
      reasons.push(
        `source "${sourceCardId}"/"${evidenceId}" carries a threshold value but no laboratory ` +
          'context (test/specimen/method/analyzer/units/reference interval/timing)',
      );
    }
  }

  if (!pediatricCds || !pediatricCds.lifecycle || typeof pediatricCds.lifecycle !== 'object') {
    reasons.push(
      `source "${sourceCardId}"/"${evidenceId}" is missing lifecycle metadata (update/correction/` +
        'retraction/withdrawal/supersession and review-date/surveillance tracking must be recorded)',
    );
  }

  if (sourceIsStaleWithoutRationale(frontmatter, bundleCreatedAt)) {
    reasons.push(
      `source "${sourceCardId}" is more than five years old (relative to the bundle) without a ` +
        'stated foundational, not-superseded rationale (trust.reliability_notes)',
    );
  }

  return reasons;
}

/**
 * Classifies and gates one claim from `claims/claim_ledger.yaml` against 02 §2.3 items 7-10 and
 * the 02 §3.7 field table. Never drops a rejected claim — it is returned with `eligible: false`
 * and its rejection reason(s) (02 §4.6 Phase 4: "retain rejected items with reason").
 */
function checkClaim(claim, sourceCardIndex, bundleCreatedAt) {
  const claimId = claim?.claim_id ?? null;
  const status = claim?.status;
  const sources = Array.isArray(claim?.sources) ? claim.sources : [];

  // 02 §2.3 invariant 10: speculation and unsupported claims are rejected outright from clinical
  // rule evidence, regardless of anything else about them.
  if (status === 'speculation' || status === 'unsupported') {
    return {
      claimId,
      status,
      category: STATUS_REJECTED,
      eligible: false,
      reasons: [`claim status "${status}" is not converter-eligible for clinical rule evidence (02 §2.3 invariant 10)`],
    };
  }

  // 02 §2.3 invariant 9: inference claims are admitted only as implementation-proposal inputs,
  // and only when they declare their basis. They do not go through the source/passage field-table
  // gate below — an inference claim's own `sources` is legitimately empty (its "sources" are the
  // claims it reasons from, tracked via `inference_basis.from_claims`).
  if (status === 'inference') {
    const fromClaims = claim?.inference_basis?.from_claims;
    if (!Array.isArray(fromClaims) || fromClaims.length === 0) {
      return {
        claimId,
        status,
        category: STATUS_REJECTED,
        eligible: false,
        reasons: [
          'inference claim has no inference_basis.from_claims — 02 §2.3 invariant 9 admits ' +
            'inference claims only as implementation-proposal inputs with a declared basis',
        ],
      };
    }
    return {
      claimId,
      status,
      category: STATUS_IMPLEMENTATION_PROPOSAL_INPUT,
      eligible: true,
      reasons: [],
    };
  }

  // supported / mixed / contradicted all go through the same source/passage field-table gate.
  // Only the OUTCOME category differs (02 §2.3 invariant 8: mixed/contradicted land in
  // conflict-visible objects, never a one-sided rule, even when every field resolves).
  if (status === 'supported' || status === 'mixed' || status === 'contradicted') {
    if (sources.length === 0) {
      return {
        claimId,
        status,
        category: STATUS_REJECTED,
        eligible: false,
        reasons: [`claim status "${status}" has no cited sources to resolve`],
      };
    }
    const reasons = sources.flatMap((source) =>
      checkSourceAgainstFieldTable(source, sourceCardIndex, bundleCreatedAt),
    );
    if (reasons.length > 0) {
      return { claimId, status, category: STATUS_REJECTED, eligible: false, reasons };
    }
    return {
      claimId,
      status,
      category: status === 'supported' ? STATUS_FACT_CANDIDATE : STATUS_CONFLICT_OBJECT,
      eligible: true,
      reasons: [],
    };
  }

  // An unrecognized claim status is not silently admitted — fail closed with a named reason.
  return {
    claimId,
    status,
    category: STATUS_REJECTED,
    eligible: false,
    reasons: [`unrecognized claim status ${JSON.stringify(status ?? null)}`],
  };
}

// ---------------------------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------------------------

/**
 * @param {object} pinnedBundle the value `hashing.pinArtifacts()` (P2-T3) resolves to — a superset
 *   of `loader.loadBundle()`'s (P2-T2) `LoadedBundle` shape; this function reads only the
 *   `LoadedBundle`-shaped fields (`bundle.parsed`, `artifacts.verification.parsed`,
 *   `artifacts.claimLedger.parsed`, `artifacts.sourceCards`), so it is forward-compatible with
 *   whatever additional hash bookkeeping P2-T3 adds.
 * @returns {{
 *   bundle: { status: string, verification: { exitCode: number, passed: boolean } },
 *   claims: Array<{ claimId: string|null, status: string, category: string, eligible: boolean, reasons: string[] }>,
 *   eligibleClaimIds: string[],
 *   rejectedClaims: Array<{ claimId: string|null, status: string, reasons: string[] }>,
 * }}
 */
export function checkEligibility(pinnedBundle) {
  // Stage 1: bundle-level status reconciliation. Throws (fails closed) on any disagreement —
  // no claim-level work below ever runs, and no partial report is ever constructed, once this
  // stage rejects the bundle (this task's first AC: "non-zero exit and zero output files").
  const bundleReport = checkBundleStatus(pinnedBundle);

  const bundleCreatedAt = pinnedBundle?.bundle?.parsed?.created_at;
  const sourceCardIndex = buildSourceCardIndex(pinnedBundle?.artifacts?.sourceCards);
  const claims = pinnedBundle?.artifacts?.claimLedger?.parsed?.claims;

  if (claims !== undefined && !Array.isArray(claims)) {
    // A malformed claim ledger (claims present but not an array) is a schema problem, not a
    // per-claim eligibility question — fail closed rather than silently treating it as "no claims"
    // (02 §2.3 invariant 12: absence must never be manufactured from a malformed/missing field).
    throw new SchemaError('claims/claim_ledger.yaml has a "claims" field that is not an array');
  }

  const claimReports = (claims ?? []).map((claim) => checkClaim(claim, sourceCardIndex, bundleCreatedAt));

  const eligibleClaimIds = claimReports.filter((c) => c.eligible).map((c) => c.claimId);
  const rejectedClaims = claimReports
    .filter((c) => !c.eligible)
    .map(({ claimId, status, reasons }) => ({ claimId, status, reasons }));

  return {
    bundle: bundleReport,
    claims: claimReports,
    eligibleClaimIds,
    rejectedClaims,
  };
}

// Re-exported for downstream verbs/tests that need the category vocabulary without re-deriving it.
export const CLAIM_CATEGORIES = Object.freeze({
  FACT_CANDIDATE: STATUS_FACT_CANDIDATE,
  CONFLICT_OBJECT: STATUS_CONFLICT_OBJECT,
  IMPLEMENTATION_PROPOSAL_INPUT: STATUS_IMPLEMENTATION_PROPOSAL_INPUT,
  REJECTED: STATUS_REJECTED,
});
