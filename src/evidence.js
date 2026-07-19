// DEF-1 (evidence dual-source unification, per
// docs/project_plans/design-specs/evidence-dual-source-unification.md, Direction 1): this module
// used to hand-duplicate modules/anemia/evidence.json as a JS object literal. That second,
// hand-maintained copy is gone. modules/anemia/evidence.json is now the single source of truth;
// this file is a thin loader/reshaper over it, using the same `with { type: 'json' }`
// import-attribute pattern modules/anemia/ranges.js already relies on for reference-ranges.json
// (proven to load under both the Node/API path and the browser SPA path — see DEF-8 and
// scripts/check-app-imports.mjs's dynamic module-graph load pass).
import evidenceData from '../modules/anemia/evidence.json' with { type: 'json' };

export const KNOWLEDGE_BASE_VERSION = evidenceData.knowledgeBaseVersion;
export const REVIEWED_THROUGH = evidenceData.reviewedThrough;

/**
 * Evidence registry. Rule outputs reference these IDs; the UI renders the
 * citation, relevance, publication date, and direct source link.
 *
 * Reshaped from evidenceData.sources (an array, the natural JSON shape) into an
 * id-keyed object (the shape the SPA's citation rendering in src/app.js and
 * src/algorithmExplorer.js expects) — same record order, same fields, no content change.
 */
export const EVIDENCE = Object.freeze(
  Object.fromEntries(evidenceData.sources.map((source) => [source.id, source])),
);

export function evidenceFor(ids = []) {
  return [...new Set(ids)].map((id) => EVIDENCE[id]).filter(Boolean);
}
