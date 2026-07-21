// src/governance.js — EP4-T4 / AC-WP4-RESIL.
//
// The nine EP-4 governance fields split into two groups with OPPOSITE failure semantics, and the
// whole point of this module is that no consumer gets to re-derive that split for itself:
//
//   HARD-REQUIRED — `version`, `effectiveDate`, `owner`, `safetyClass`, `sourcePassageId`.
//     Absence is a validation failure, never a tolerated default. A rule that cannot say what
//     version it is, when it took effect, who owns it, how safety-critical it is, or what passage
//     grounds it is not a governed rule.
//
//   LEGITIMATELY EMPTY — `retireDate`, `clinicalApprovers`, `requiredTestCaseIds`.
//     `null`/`[]` are NORMAL values carrying a specific meaning, and each has an inviting,
//     dangerous misreading that this module exists to make unavailable:
//       retireDate: null          means ACTIVE            — not "unknown", not "expired"
//       clinicalApprovers: []     means NO APPROVAL YET   — never "approved", never "approval N/A"
//       requiredTestCaseIds: []   means NO LINKAGE YET    — never "exempt from testing"
//
// The two `clinicalApprovers` and `requiredTestCaseIds` misreadings are the dangerous ones: both
// turn "we have not done this" into "we do not need to do this". Read the D-4 rationale in
// tests/clinical-approvers-d4.test.mjs before touching the approval logic here.

const HARD_REQUIRED_FIELDS = Object.freeze([
  'version', 'effectiveDate', 'owner', 'safetyClass', 'sourcePassageId',
]);

const LEGITIMATELY_EMPTY_FIELDS = Object.freeze([
  'retireDate', 'clinicalApprovers', 'requiredTestCaseIds',
]);

export { HARD_REQUIRED_FIELDS, LEGITIMATELY_EMPTY_FIELDS };

/**
 * Fields whose absence (or null) is a governance defect, not a default.
 * `sourcePassageId` is nullable in the JSON Schema (D-EP3-3, Risk 6) but non-null in any shipped
 * KB, so a null here is reported rather than silently tolerated.
 * @returns {string[]} names of missing/null hard-required fields — empty array when the rule is well-formed.
 */
export function missingRequiredGovernanceFields(rule) {
  if (!rule || typeof rule !== 'object') return [...HARD_REQUIRED_FIELDS];
  return HARD_REQUIRED_FIELDS.filter((field) => {
    const value = rule[field];
    return value === undefined || value === null || value === '';
  });
}

/**
 * `retireDate: null` means the rule is ACTIVE. It never means "unknown" or "expired".
 * @param {object} rule
 * @param {Date|string} [asOf] — evaluation date; defaults to now.
 */
export function isActive(rule, asOf = new Date()) {
  const retireDate = rule?.retireDate ?? null;
  if (retireDate === null) return true; // the normal case for every currently active rule
  const retiresAt = new Date(retireDate);
  if (Number.isNaN(retiresAt.getTime())) {
    // An unparseable retireDate is a data defect. Fail CLOSED — treat the rule as retired rather
    // than keep firing a rule whose lifecycle we cannot establish.
    return false;
  }
  return new Date(asOf) < retiresAt;
}

/**
 * Clinical approval status as a descriptive label, for display and logging.
 *
 * CORRECTION (reviewer gate 2026-07-21, finding 5): an earlier version of this file claimed the
 * string return made `if (clinicalApprovalStatus(rule))` safe. That was FALSE — every returned
 * label is a non-empty, therefore truthy, string, so such an `if` passes for an unapproved rule.
 * The claim was exactly the kind of over-statement this codebase forbids, so it is retracted rather
 * than quietly softened.
 *
 * The real protection is that this function does not return a boolean at all, so it cannot be
 * *mistaken* for the approval predicate. `hasCredentialedClinicalApproval()` is the only boolean
 * surface, and it is the one to branch on. Do not branch on this value's truthiness — compare it
 * explicitly, or use the predicate.
 *
 * @returns {'no-credentialed-approval'|'attested'}
 */
export function clinicalApprovalStatus(rule) {
  const approvers = rule?.clinicalApprovers;
  if (!Array.isArray(approvers) || approvers.length === 0) return 'no-credentialed-approval';
  return 'attested';
}

/**
 * Whether a rule carries credentialed clinical approval.
 * Today this is `false` for every rule in the KB and that is the honest, expected state.
 * It must NEVER be inferred from a synthetic review (ARC council, council-review, rf verification,
 * or a model's own sign-off) — see D-4 / tests/clinical-approvers-d4.test.mjs.
 */
export function hasCredentialedClinicalApproval(rule) {
  return clinicalApprovalStatus(rule) === 'attested';
}

/**
 * Test-case linkage status. `[]` means the linkage has not been established — NOT that the rule is
 * exempt from testing. There is deliberately no `isExemptFromTesting()`; no such state exists.
 * @returns {'no-test-linkage'|'linked'}
 */
export function testLinkageStatus(rule) {
  const ids = rule?.requiredTestCaseIds;
  if (!Array.isArray(ids) || ids.length === 0) return 'no-test-linkage';
  return 'linked';
}

/**
 * A single honest governance summary for a rule, safe to attach to provenance output.
 * Throws on a hard-required field being absent — that is a validation failure surfaced loudly,
 * consistent with AC-WP4-RESIL, rather than a silently-defaulted record.
 */
export function governanceSummary(rule) {
  const missing = missingRequiredGovernanceFields(rule);
  if (missing.length > 0) {
    throw new Error(
      `rule ${rule?.id ?? '<unknown>'}: missing required governance field(s): ${missing.join(', ')}. `
      + 'These are not optional and have no safe default.',
    );
  }
  return Object.freeze({
    version: rule.version,
    effectiveDate: rule.effectiveDate,
    owner: rule.owner,
    safetyClass: rule.safetyClass,
    sourcePassageId: rule.sourcePassageId,
    active: isActive(rule),
    clinicalApproval: clinicalApprovalStatus(rule),
    testLinkage: testLinkageStatus(rule),
  });
}
