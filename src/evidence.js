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

// EP3-T6 (AC-WP3-RESIL): passage accessors over the same EVIDENCE import above — no second
// evidence store (DEF-1). Every accessor below tolerates a legacy-shape record (a source with no
// `passages` array at all, or a passage missing `sourceLocator`/`exactPassage`) encountered
// mid-migration: it must degrade, never throw.
const LOCATOR_PENDING = 'locator pending';

/** All passage records for a source id. Unknown id or a source with no `passages` array → []. */
export function passagesFor(sourceId) {
  const source = EVIDENCE[sourceId];
  return Array.isArray(source?.passages) ? source.passages : [];
}

/** A single passage record by id, searched across every source. Unknown id → null. */
export function passageById(passageId) {
  if (!passageId) return null;
  for (const source of Object.values(EVIDENCE)) {
    const match = (Array.isArray(source.passages) ? source.passages : []).find((passage) => passage?.id === passageId);
    if (match) return match;
  }
  return null;
}

/**
 * Render-safe locator text. A legacy-shape passage missing `sourceLocator` (or with an empty
 * `raw`) degrades to the literal string "locator pending" rather than throwing.
 */
export function passageLocatorText(passage) {
  const raw = passage?.sourceLocator?.raw;
  return typeof raw === 'string' && raw.length > 0 ? raw : LOCATOR_PENDING;
}

/**
 * Render-safe passage text. Degrades to "locator pending" both for a legacy-shape passage
 * missing `exactPassage` and for the intentional empty-string `implementation-proposal` sentinel
 * — from the caller's point of view both mean "nothing located here yet."
 */
export function passageExactText(passage) {
  const text = passage?.exactPassage;
  return typeof text === 'string' && text.length > 0 ? text : LOCATOR_PENDING;
}

/**
 * Render-safe applicability. Absent `applicability` reads as "unrestricted" ONLY on an
 * `implementation-proposal` record (D-EP3-3 sentinel — there is no clinical claim to restrict).
 * On any other record, absence is an unresolved defect (scripts/validate-kb.mjs fails the build
 * on it — AC-WP3-RESIL), so this returns null rather than fabricating an "unrestricted" claim.
 */
export function passageApplicability(passage) {
  if (!passage) return null;
  if (passage.applicability) return passage.applicability;
  return passage.status === 'implementation-proposal' ? { age: null, sex: null, assay: null } : null;
}

/**
 * EP3-T5 binding rule (safety-critical, fail-safe by construction): the SOLE predicate for
 * whether a passage may be used as source-supported grounding for a rule. A passage carrying ANY
 * `reviewFlags` entry — from the independent fidelity audit in
 * evidence-packs/rf-ev-001/fidelity-findings.json — is stamped `status: "quarantined"` by
 * scripts/evidence/build-evidence-pack.mjs (reviewer-gate fix-2) and therefore already fails the
 * `status !== 'source-supported'` check below; a rule that would bind to it falls back to that
 * source's `<sourceId>#implementation-proposal` sentinel instead. Both EP-4's rule->passage binder
 * and scripts/validate-kb.mjs call this one definition rather than re-deriving the rule, so the
 * two can never drift apart.
 *
 * Fails CLOSED (reviewer-gate fix-3): `reviewFlags` must be an explicit array. A legacy-shape
 * passage missing `status`/`reviewFlags` entirely, or carrying a non-array `reviewFlags`, is
 * "not bindable" — never throws, and never defaults to permissive by treating "absent" the same
 * as "explicitly empty." An un-audited `{status: "source-supported"}` record with no `reviewFlags`
 * key at all must NOT be bindable just because it also isn't flagged; the fidelity audit having
 * run at all is itself part of the claim.
 */
export function isBindableAsSourceSupported(passage) {
  if (!passage || passage.status !== 'source-supported') return false;
  if (!Array.isArray(passage.reviewFlags)) return false;
  return passage.reviewFlags.length === 0;
}
