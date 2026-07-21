// tools/rf-bundle-to-kb-pack/lib/eligibility.mjs — converter-eligibility + status-reconciliation
// checks (P2-T1 scaffold; implemented by P2-T4, FR-9, 02 §2.3 invariants 1/3/4, 02 §3.7).
//
// Module boundary (defined here, filled in by P2-T4):
//
//   checkEligibility(pinnedBundle) -> EligibilityReport
//
// Contract P2-T4 must satisfy:
//   - Reject (non-zero exit, no partial output) any bundle whose `evidence_bundle.yaml.status` is
//     not exactly `"verified"` (02 §2.3 item 1).
//   - Reject any disagreement between the recorded process exit code and
//     `reviews/verification.yaml`'s `exit_code`/`passed` fields (02 §2.3 items 3-4) — this is a
//     distinct, specifically-named error ("process/artifact status disagreement"), never a
//     silent pass-through.
//   - Apply the 02 §3.7 converter-eligibility field table per claim (source_card_id, evidence_id,
//     locator, exact passage, source status, recency, applicability, laboratory context,
//     threshold portability, conflicts, claim status, lifecycle) as pre-flight checks, retaining
//     rejected items with their rejection reason rather than dropping them silently (02 §4.6
//     Phase 4: "retain rejected items with reason").
//   - Operates only on the `PinnedBundle` `hashing.mjs` (P2-T3) returns.
//
// EligibilityReport shape is left for P2-T4 to define; at minimum it should distinguish
// bundle-level eligibility (verified/not) from per-claim eligibility (eligible/rejected + reason),
// since the `inspect` verb (P2-T6) must print both.

import { NotImplementedError } from './errors.mjs';

/**
 * @param {object} _pinnedBundle the value `hashing.pinArtifacts()` (P2-T3) resolves to
 * @returns {object} bundle-level and per-claim eligibility results (shape defined by P2-T4)
 */
export function checkEligibility(_pinnedBundle) {
  throw new NotImplementedError('P2-T4', 'lib/eligibility.js#checkEligibility');
}
