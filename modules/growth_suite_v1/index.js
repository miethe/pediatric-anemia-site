// modules/growth_suite_v1 — greenfield module package scaffold (P3-T2, RF-GRO-002,
// docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/
// phase-3-4-scaffolds-and-backfill.md).
//
// This module carries ZERO clinical fact derivation, threshold lookup, or pattern-matching
// logic of any kind. `growth_suite_v1` has no sibling fact-derivation module to delegate to
// (unlike `modules/cbc_suite_v1/index.js`'s explicit OQ-1 delegation to `modules/anemia/index.js`
// — that delegation exists only because `cbc_suite_v1`'s slice rules consume exactly the fact
// shape `anemia` already derives; growth has no such sibling and authoring a real delegation here
// would be inventing an untrue relationship). Every hook below is a deliberately inert,
// explicitly-labeled "not yet implemented" stand-in so this package's shape (module.json, empty
// rules.json/candidates.json/evidence.json, this hook descriptor) can exist and be registered
// (P3-T3) ahead of real growth-suite clinical content, which is out of scope for this task.
//
// Read this file and modules/growth_suite_v1/module.json directly (P3-T5's honesty spot-check):
// module.json.status is "unsigned-stub", and every hook here states plainly that no clinical
// fact derivation has been authored yet — that conclusion should be reachable in one read-through,
// without inference.

const NOT_YET_IMPLEMENTED_NOTICE =
  'growth_suite_v1 fact derivation is not yet implemented for this module. This is a package-shape '
  + 'scaffold only (P3-T2, RF-GRO-002): it performs no growth-specific clinical fact derivation, '
  + 'threshold lookup, or pattern matching, and it does not delegate to any other module\'s fact '
  + 'derivation. Real growth-suite clinical content is authored in a later, separately reviewed '
  + 'phase.';

/**
 * Deliberately inert. Returns an honestly-labeled "not yet implemented" facts object rather than
 * deriving any growth-specific clinical fact (weight/height/BMI velocity, growth-faltering flags,
 * etc.) and rather than delegating to another module's `deriveFacts` — growth has no sibling
 * fact-derivation module to delegate to, and inventing one here would misrepresent this scaffold
 * as clinically functional.
 */
export function deriveFacts(_input) {
  return {
    moduleId: 'growth_suite_v1',
    notYetImplemented: true,
    notice: NOT_YET_IMPLEMENTED_NOTICE,
  };
}

/**
 * Deliberately inert. Mirrors deriveFacts's "not yet implemented" posture rather than summarizing
 * any real classification.
 */
export function summarize(_facts) {
  return {
    notYetImplemented: true,
    notice: NOT_YET_IMPLEMENTED_NOTICE,
  };
}

/**
 * Deliberately inert, but load-bearing for honesty (P3-T5): explicitly states the "not yet
 * implemented" posture in the same output surface `src/engine.js#assess()` folds into every
 * assessment's `limitations[]` array, so a caller sees this notice even if it inspects only the
 * assessment output and never opens this file.
 */
export function limitations(_facts) {
  return [NOT_YET_IMPLEMENTED_NOTICE];
}

export default {
  id: 'growth_suite_v1',
  // Hook descriptor carries the same "not yet implemented" labeling `engineLabel` names
  // explicitly, so a reviewer scanning only this exported object (no other context) reaches the
  // same conclusion the limitations() output states in prose.
  manifest: {
    engineLabel: 'Pediatric Growth Suite Deterministic CDSS (not yet implemented)',
    knowledgeBaseVersion: '0.1.0-2026-07-21',
    evidenceReviewedThrough: '2026-07-21',
  },
  deriveFacts,
  summarize,
  limitations,
};
