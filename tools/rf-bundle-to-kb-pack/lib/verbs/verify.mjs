// tools/rf-bundle-to-kb-pack/lib/verbs/verify.mjs — `verify` verb (structural pre-check)
// (P2-T1 scaffold; implemented by P2-T7, 02 §4.5).
//
// Contract P2-T7 must satisfy:
//   - `verify --pack <dir> --rule-schema schemas/rule.schema.json` validates a staged pack's
//     structural shape. This phase (Phase 2) implements the *input*-side pre-checks only, built
//     against loader/hashing/eligibility's (P2-T2..T4) output — no `build/kb-pack/` pack exists
//     to validate on the output side until `propose` (Phase 3) runs.
//   - The pack-output-validation path (validating an actual `build/kb-pack/<module>/<version>/`
//     directory against `schemas/rule.schema.json` et al.) MUST be left as an explicit,
//     clearly-marked stub for P5-T1 to complete once `release-manifest.unsigned.json` exists —
//     "explicitly marked (not silently incomplete)" per this task's own acceptance criteria.
//   - Exits 0 against a structurally sound fixture and non-zero against a seeded-malformed one.
//
// Verb-handler contract: see `lib/verbs/inspect.mjs`'s header comment (same contract applies here).

import { NotImplementedError } from '../errors.mjs';

/**
 * @param {{ pack?: string, ruleSchema?: string }} _options parsed CLI flags for this verb
 * @returns {Promise<number>} process exit code
 */
export async function run(_options) {
  throw new NotImplementedError('P2-T7', 'lib/verbs/verify.js#run');
}

// P5-T1 stub marker: the pack-output-validation path (validating a real build/kb-pack/ directory
// once release-manifest.unsigned.json exists) is intentionally NOT implemented anywhere in this
// file yet. P5-T1 must add it here, not silently assume `run()` above already covers it.
