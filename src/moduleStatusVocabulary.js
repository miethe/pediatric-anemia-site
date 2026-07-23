// src/moduleStatusVocabulary.js — D-3 / FR-8, FR-9, FR-10, FR-13, FR-34, OQ-3
// (docs/project_plans/PRDs/features/spa-module-switcher-v1.md).
//
// This is the ONLY place any clinician-facing module-status string lives. No component may
// hardcode a status sentence, the honesty-boundary disclosure, the staleness disclosure, the
// panel header, or the empty-rules copy — every one of them is imported from here. Frozen,
// side-effect-free data + pure derivation only: no DOM access, no network calls, no invocation
// of the rule-evaluation engine.
//
// SOURCE-VARIANCE NOTE (resolved, do not rediscover): SQ-1 §4 wrote "content hashes verified
// only"; decision D-3 corrected this to "recorded only" — the browser never verifies anything
// (FR-12), so "recorded" is the only honest reading. Every string below uses "recorded".
//
// PLAN-CITATION CORRECTION (recorded here for the next reader): the Phase 1 task table
// (phase-0-2-foundation.md, P1-02) states that `src/evidenceStalenessPolicy.js:11-14` "already
// returns" the FR-34 disclosure string below, and instructs reuse rather than retyping. As of
// this writing that file's lines 11-14 are a code comment describing the disclosure OBLIGATION
// ("every caller ... must disclose that non-enforcement loudly"), not the disclosure text
// itself — `EVIDENCE_STALENESS_POLICY.rationale` (same file) is a longer, differently-worded
// developer-facing string, not this clinician-facing sentence. There is no exported string in
// that file byte-equal to FR-34's sentence to import. This module therefore carries the FR-34
// sentence verbatim from the PRD directly (the higher-priority, Must-priority source), and
// tests/module-status-vocabulary.test.mjs pins it against the PRD text instead of against
// evidenceStalenessPolicy.js.

/** FR-2/D-1/D-3 — the panel header rendered above every module row, verbatim. */
export const PANEL_HEADER = 'These modules are not peers. Read each row.';

/** FR-13 — the honesty-boundary disclosure, rendered in the panel, never a tooltip, verbatim. */
export const HONESTY_BOUNDARY_DISCLOSURE = "Status shown is read from this module's published "
  + 'manifest. The browser has not verified it — no content digest was recomputed, no schema '
  + 'was validated, and no check confirms the loaded rules are the rules that were signed.';

/** FR-34 — the evidence-staleness non-enforcement disclosure, rendered adjacent to the date. */
export const EVIDENCE_STALENESS_DISCLOSURE = 'Evidence-staleness expiry is not enforced — no '
  + 'governance window has been set. This date is declared by the module, not checked.';

/** FR-10 — human-readable subtitle. Applies ONLY where status === 'unsigned-stub' (Should). */
export const UNSIGNED_STUB_SUBTITLE = 'unsigned proposal · not clinically reviewed';

/** OQ-3 — the #rules tab's empty state when rules.length === 0, verbatim. */
export const RULES_EMPTY_STATE = 'This module contains no rules. No assessment can be produced from it.';

/**
 * FR-9 — the universal second clause. Every module (including anemia) renders this, and it is
 * DERIVED from `approvedBy.length === 0` — never a hardcoded string independent of the input —
 * because `approvedBy` is schema-pinned to `maxItems: 0` (schemas/module-manifest.schema.json)
 * and this clause must not silently stop reflecting that the day a manifest's `approvedBy`
 * somehow carried a value (a schema violation in itself, but this clause must not compound it
 * by lying about it).
 *
 * @param {unknown} approvedBy
 * @returns {string}
 */
export function deriveApprovedByClause(approvedBy) {
  const list = Array.isArray(approvedBy) ? approvedBy : [];
  if (list.length === 0) {
    return 'approvedBy is empty: no credentialed clinician has reviewed or approved this module.';
  }
  return `approvedBy carries ${list.length} recorded entr${list.length === 1 ? 'y' : 'ies'} `
    + `(${list.join(', ')}) — this is a schema violation (maxItems: 0) and must be treated as `
    + 'ineligible data, not as clinical sign-off.';
}

/**
 * FR-7/FR-8 — one canonical sentence per closed enum value (schemas/module-manifest.schema.json).
 * Copied verbatim from PRD §6.1.B-1. `integrity-recorded` reads "recorded", never "verified" —
 * see the source-variance note above. No enum value gets a positive-affect visual/severity
 * treatment: `integrity-recorded` is styled identically to the scaffolds, and the word "only"
 * in its sentence is load-bearing.
 */
const STATUS_SENTENCES = Object.freeze({
  'integrity-recorded': 'Manifest status: integrity-recorded — content hashes recorded only. '
    + 'approvedBy is empty: no credentialed clinician has reviewed or approved this module. '
    + 'Unvalidated research prototype; not for clinical use.',
  'unsigned-stub': 'Manifest status: unsigned-stub — no content hash recorded; not servable. '
    + 'approvedBy is empty: no credentialed clinician has reviewed or approved this module. '
    + 'No assessment can be produced from this module.',
  superseded: 'Manifest status: superseded — replaced by a later module release; retained for '
    + 'audit only. approvedBy is empty: no credentialed clinician has reviewed or approved this '
    + 'module. No assessment can be produced from this module.',
  revoked: 'Manifest status: revoked — withdrawn; retained for audit only. approvedBy is empty: '
    + 'no credentialed clinician has reviewed or approved this module. No assessment can be '
    + 'produced from this module.',
});

export const MODULE_STATUS_SENTENCES = STATUS_SENTENCES;

/**
 * Sentinel returned by `getStatusSentence` for any status outside the closed enum. A distinct
 * Symbol (not a string) so it can never be accidentally rendered as clinician-facing text or
 * mistaken for a real sentence — callers must branch on it explicitly and route to the FR-14
 * fail-closed refusal state (Phase 4), never to a friendlier default.
 */
export const UNKNOWN_STATUS_SENTINEL = Symbol('module-status-vocabulary:unknown-status-refuse');

/**
 * @param {unknown} status
 * @returns {string | typeof UNKNOWN_STATUS_SENTINEL}
 */
export function getStatusSentence(status) {
  if (typeof status === 'string' && Object.prototype.hasOwnProperty.call(STATUS_SENTENCES, status)) {
    return STATUS_SENTENCES[status];
  }
  return UNKNOWN_STATUS_SENTINEL;
}

// ================================================================================================
// Phase 4 (spa-module-switcher-v1, phase-3-5-ui.md) — showModuleRefusal() reason strings, one per
// SQ-3 §4 case (FR-15/FR-16/FR-18) plus the P4-07 unregistered-id case (FR-21). Each is a pure
// derivation parameterized by the module's own title (or, for the unregistered case, the literal
// requested id) — never a module name hardcoded here, and this file stays side-effect-free (no
// DOM touch, no network call, no rule-evaluation invocation — see the file header and the
// executed test guarding it). Copied as closely to the PRD's quoted templates (§6.1.D) as a
// parameterized template allows; none of the maturity-ladder words this vocabulary file's own
// tests already ban (FR-5/FR-33's prohibited-vocabulary set, tested above) appear anywhere below.
// ================================================================================================

/**
 * FR-15 / SQ-3 §4.1 — Case 1: the evidence registry (src/evidence/registry.js) has no accessor
 * entry for this module, so any rule audit entry would throw resolving its evidence. PRD §6.1.D
 * quotes this verbatim as "No assessment produced — evidence not available for module X".
 *
 * @param {string} moduleTitle
 * @returns {string}
 */
export function deriveEvidenceUnavailableReason(moduleTitle) {
  return `No assessment produced — evidence not available for module ${moduleTitle}.`;
}

/**
 * FR-16 / SQ-3 §4.2 — Case 2: the module's own hooks self-report not-yet-implemented (detected
 * BEFORE any render is attempted, via moduleReportsNotYetImplemented()). PRD §6.1.D's worked
 * example: "Growth Suite is a package scaffold — no clinical logic is implemented. No assessment
 * can be produced from this module." — parameterized here by the module's own title rather than
 * hardcoding "Growth Suite".
 *
 * @param {string} moduleTitle
 * @returns {string}
 */
export function deriveNotYetImplementedReason(moduleTitle) {
  return `${moduleTitle} is a package scaffold — no clinical logic is implemented. No assessment `
    + 'can be produced from this module.';
}

/**
 * FR-18 / SQ-3 §4.4 — Case 4: the module's rules.json/candidates.json request failed or 404'd.
 * Mirrors the existing default-KB-load failure message (src/app.js's initialize(), pre-Phase-3
 * hardcoded network call), module-scoped. PRD §6.1.D quotes this verbatim as "Unable to load
 * module X's knowledge base."
 *
 * @param {string} moduleTitle
 * @returns {string}
 */
export function deriveKbLoadFailureReason(moduleTitle) {
  return `Unable to load module ${moduleTitle}'s knowledge base.`;
}

/**
 * FR-21 / P4-07 — the `?module=` value fails isRegisteredModule() entirely (distinct from Case 3,
 * FR-17, which is for a REGISTERED-but-ineligible id and uses getStatusSentence() instead). Quotes
 * the literal requested id verbatim — there is no manifest/title to substitute, because the id was
 * never registered — and states plainly that no automatic substitution occurred (D-4 "never a
 * silent fallback to anemia").
 *
 * @param {string} requestedId
 * @returns {string}
 */
export function deriveUnregisteredModuleReason(requestedId) {
  return `No module is registered with id "${requestedId}". No assessment can be produced. Choose `
    + 'a listed module below — this app never substitutes a different module automatically.';
}
