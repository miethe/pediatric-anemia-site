// modules/kidney_suite_v1 — greenfield E1 module scaffold (Phase 3, P3-T1; RF-KID-001).
//
// Unlike modules/cbc_suite_v1/index.js (OQ-1: delegates deriveFacts/assertInScope/summarize/
// limitations onto the already-registered `anemia` module), this module has NO sibling
// fact-derivation module to delegate to (PRD §2's explicit note). deriveFacts/summarize/
// limitations below therefore do NOT derive, infer, or invent any clinical fact, threshold, or
// interpretation. They exist only so this package's shape matches the registered-module
// contract src/engine.js#assess() calls (deriveFacts -> optional assertInScope -> summarize/
// limitations), and every one of them returns an explicit, human-readable "not yet implemented
// for this module" posture instead of silence or a guess.
//
// `module.json.status` is "unsigned-stub", `approvedBy: []`, `clinicalContentHash: null`,
// `rules.json` is `[]`, `candidates.json` is `{}`, `evidence.json.sources` is `[]` — there is no
// clinical logic anywhere in this module to read past this file. This module is NOT registered
// in `src/modules/registry.js` or `src/facts/registry.js` yet (P3-T3, a separate seam task,
// owns that wiring) and is not reachable through `assess()` until it is.

const NOT_YET_IMPLEMENTED_MESSAGE =
  'kidney_suite_v1: fact derivation is not yet implemented for this module. No clinical facts, ' +
  'thresholds, reference ranges, or interpretations are computed or inferred here. This module ' +
  'carries zero clinical logic (module.json.status: "unsigned-stub", approvedBy: []).';

// Deliberately does NOT read, transform, or derive anything from `input`. A future
// kidney-specific fact-derivation implementation is out of scope for this scaffold (P3-T1);
// nothing here should be mistaken for it.
function deriveFacts(_input) {
  return {
    moduleId: 'kidney_suite_v1',
    notYetImplemented: true,
    message: NOT_YET_IMPLEMENTED_MESSAGE,
  };
}

function summarize(_facts) {
  return {
    status: 'not_yet_implemented',
    message: NOT_YET_IMPLEMENTED_MESSAGE,
  };
}

function limitations(_facts) {
  return [NOT_YET_IMPLEMENTED_MESSAGE];
}

export default {
  id: 'kidney_suite_v1',
  manifest: {
    engineLabel: 'Pediatric Kidney Suite Deterministic CDSS (not yet implemented)',
    knowledgeBaseVersion: '0.0.0-2026-07-22',
    evidenceReviewedThrough: '2026-07-22',
  },
  deriveFacts,
  summarize,
  limitations,
};
