// scripts/lib/evidence-guideline-recommendation-gate.mjs — EPR3-T8 (FR-WP3-08; D1, D2, D7).
//
// Gate (h) of the rights-substrate validator, homed in its own module and registered in
// scripts/validate-rights.mjs's exported GATES list (run by `npm run validate`). It proves the
// FR-WP3-08 "captured, not avoided" coverage property: every evidence item classified as a
// `guideline_recommendation` CARRIES the fact of the recommendation — a named issuing body and an
// independently-worded restatement — rather than silently omitting it. The SHAPE of that capture
// (an `issuing_body` object with a non-empty `name`, a non-empty `restatement`, a scope field) is
// owned by schemas/evidence.schema.json ($defs/guidelineRecommendationCapture); this gate owns the
// cross-record COVERAGE that JSON Schema cannot express without coupling the capture's presence to
// the `evidence_item_type` axis (which a $defs/passage allOf clause would do, tripping
// tests/rights-axis-separation.test.mjs's schema probe). Presence is therefore a gate, exactly as
// EPR3-T6's numeric-recapture presence is a gate rather than a schema `required`.
//
// WHY THIS FILE READS AN AXIS AND STILL PASSES THE D2 BARRIER PROBE. Scoping "which items are
// guideline recommendations" requires reading ONE item-taxonomy axis — `evidence_item_type`. That is
// legitimate: the D2 barrier (tests/rights-axis-separation.test.mjs, probe 2b) forbids a single
// runtime FILE from co-mentioning an item axis AND a rights-AUTHORITY field (overall_status /
// clearance_status / release_gate / review_status), and forbids one LINE from branching one axis on
// another. This file reads `evidence_item_type` and NOTHING ELSE from the axis vocabularies — no
// rights-authority field anywhere, and no second taxonomy axis on any line — so neither probe can
// fire. Homing here (not inside scripts/validate-rights.mjs, which reads authority fields in gate
// (b)) keeps that separation clean without an allowlist exemption, the same reason EPR3-T4's locator
// gate and EPR3-T6's numeric gate each live in their own module.
//
// D7 — COVERAGE ONLY, never a clearance gate. Naming an issuing body and restating a recommendation
// makes no legal determination; a guideline_recommendation item at any rights disposition (including
// the UNKNOWN every real record sits at) passes so long as it captured the fact. This gate never
// reads a rights-authority field. Determinism (FR-WP0-07): reads only the passages handed to it;
// constructs no `Date`.

/** The evidence-item type whose items must carry the fact of a recommendation. */
export const GUIDELINE_RECOMMENDATION_TYPE = 'guideline_recommendation';

/**
 * EPR3-T8. For every guideline_recommendation item, prove it captured the fact of the recommendation:
 *   1. COVERAGE — a `guideline_recommendation_capture` object is present (never silently omitted).
 *   2. CONSISTENCY — that capture names a non-empty issuing `issuing_body.name` and a non-empty
 *      `restatement`. (Schema also enforces these via minLength when the object is present; this
 *      re-asserts them with a gate-level message and covers the coverage case in one place.)
 *
 * @param {{ evidencePassages?: Array<{ passage?: object, sourceId?: string|null }> }} context
 * @returns {{ errors: string[] }}
 */
export function checkGuidelineRecommendationCapture(context) {
  const errors = [];
  for (const entry of context?.evidencePassages ?? []) {
    const passage = entry?.passage;
    if (!passage || typeof passage !== 'object') continue;
    const id = passage.id ?? `${entry?.sourceId ?? '<unknown source>'}#<unknown>`;

    // Scope: guideline_recommendation items only. Reads ONE item axis (evidence_item_type) and no
    // rights-authority field, on its own line — the D2 barrier probe cannot fire (see header).
    if (passage.evidence_item_type !== GUIDELINE_RECOMMENDATION_TYPE) continue;

    const capture = passage.guideline_recommendation_capture;
    const hasCapture = capture !== null && capture !== undefined && typeof capture === 'object';

    // COVERAGE: a guideline is captured, not avoided (FR-WP3-08, D2).
    if (!hasCapture) {
      errors.push(
        `evidence-guideline-recommendation-capture: guideline_recommendation passage "${id}" carries no `
        + 'guideline_recommendation_capture — the fact of the recommendation (issuing body, independently-'
        + 'worded restatement, scope) must be captured, not avoided (EPR3-T8, FR-WP3-08, D2)',
      );
      continue;
    }

    const issuingBodyName = capture.issuing_body?.name;
    if (typeof issuingBodyName !== 'string' || issuingBodyName.trim() === '') {
      errors.push(
        `evidence-guideline-recommendation-capture: guideline_recommendation passage "${id}" names no `
        + 'issuing body — the recommendation\'s issuing body must be a named structured field (EPR3-T8, FR-WP3-08)',
      );
    }

    const restatement = capture.restatement;
    if (typeof restatement !== 'string' || restatement.trim() === '') {
      errors.push(
        `evidence-guideline-recommendation-capture: guideline_recommendation passage "${id}" carries no `
        + 'independently-worded restatement — the fact of the recommendation must be restated, not quoted '
        + 'and not omitted (EPR3-T8, FR-WP3-08)',
      );
    }
  }

  return { errors };
}
