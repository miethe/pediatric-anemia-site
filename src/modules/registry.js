import anemiaModule from '../../modules/anemia/index.js';
import cbcSuiteV1Module from '../../modules/cbc_suite_v1/index.js';
import kidneySuiteV1Module from '../../modules/kidney_suite_v1/index.js';
import growthSuiteV1Module from '../../modules/growth_suite_v1/index.js';

const REGISTRY = new Map([
  ['anemia', anemiaModule],
  ['cbc_suite_v1', cbcSuiteV1Module],
  ['kidney_suite_v1', kidneySuiteV1Module],
  ['growth_suite_v1', growthSuiteV1Module],
]);

export function getModule(id) {
  const module = REGISTRY.get(id);
  if (!module) {
    throw new Error('Unknown module: ' + id);
  }
  return module;
}

export function listModules() {
  return [...REGISTRY.values()];
}

// --- Phase 5 additions (SPIKE-002 Q1 / Sequencing Note 2) ---
// Additive to the getModule/listModules API above (authored in Phase 3 for src/engine.js).
// This half is enumeration- and script/server/test-facing: MODULE_IDS/DEFAULT_MODULE_ID for
// iteration, MODULE_CODE_LOADERS/loadModuleCode for on-demand code access, and
// isRegisteredModule for existence checks — none of it replaces the synchronous hook-object
// accessors above.

// DERIVED, not restated (reviewer gate 2026-07-21, finding 4, second pass). MODULE_IDS was a
// hand-maintained literal that could silently drift from REGISTRY — a module registered in
// REGISTRY but omitted here would be invisible to every MODULE_IDS-driven gate, including the D-4
// clinicalApprovers check and validate-kb. Deriving it makes that divergence impossible by
// construction rather than by remembering.
export const MODULE_IDS = Object.freeze([...REGISTRY.keys()]);

// Deliberate tripwire (SPIKE-002 Q5 assertion 1, tests/module-registry.test.mjs): a second
// module (`cbc_suite_v1`) registered in Phase 1 (P1-T3, OQ-1), and now a 3rd and 4th
// (`kidney_suite_v1`, `growth_suite_v1` — Phase 3, P3-T3, the E1 dual-registry seam task) are
// registered too — 4 modules total. `DEFAULT_MODULE_ID` still correctly stays `'anemia'` rather
// than becoming a real selection decision. Why: neither E0 nor this E1 pass (multi-bundle-
// conversion-e1) adds any client-selectable moduleId surface — no UI/API change lets any existing
// caller choose a moduleId (R-P4/PRD §6.1 confirms this explicitly for E0; P3-T3's own scope note
// confirms it again for E1) — so `'anemia'` remains the only module any caller can actually
// reach, and there is still nothing to select between, no matter how many modules sit in
// `REGISTRY`. Revisit this again the day a client-selectable moduleId surface actually ships (a
// UI control, an API parameter, a CDS Hooks card selector, etc.) — that is the real trigger for
// turning this into a selection decision, not merely the count of registered modules.
//
// P6-010 Tripwire B FIRED (spa-module-switcher-v1, phase-6-7-gates-docs.md) — DECISION RECORDED,
// NOT MERELY A MECHANICAL EDIT (R-6). The client-selectable-surface trigger named immediately
// above has now actually fired: the spa-module-switcher-v1 feature ships a real client-facing
// module-selection UI (the header-dropdown switcher — a row click, or a `?module=` URL param, both
// funnelling through `src/app.js#activateModule()`). This is a DIFFERENT trigger from — and must
// never be conflated with — the separate, already-overdue "second module registers" tripwire at
// `tests/module-registry.test.mjs:20-24` (that one fired at commit `263120b`, unrelated to this
// feature, and was corrected there as pre-existing debt).
//
// The decision, made deliberately rather than by default: `DEFAULT_MODULE_ID` STAYS `'anemia'`.
// It is now the switcher's INITIAL selection on load (absent `?module=`), not the ONLY module a
// caller can ever reach — but it remains the correct default because no module's manifest
// `status` changed as part of this feature (FR-35; still 3× `unsigned-stub` + 1× `integrity-
// recorded`), so `anemia` is still the only module `isModuleSelectable()` (src/moduleEligibility.js,
// FR-4/FR-6) ever returns `true` for. There is nothing else eligible to become the default.
//
// Authority for lifting the prior freeze: E1's own `multi-bundle-conversion-e1.md` FR-14/R-8
// froze `DEFAULT_MODULE_ID` and prohibited a new client-selectable moduleId surface for that
// pass specifically — but R-8's own text conditions that freeze on "ahead of any UI/API decision
// to support it," not permanently. `docs/adr/0009-module-eligibility-policy-for-clinician-facing-
// surfaces.md` ("The FR-14/R-8 lifting authority" section) records that the switcher PRD
// (`docs/project_plans/PRDs/features/spa-module-switcher-v1.md`) IS that decision, and that the
// ADR governs HOW eligibility is decided once such a surface exists — "which today still yields
// exactly one selectable module (`anemia`) and three inert ones... `DEFAULT_MODULE_ID` itself is
// unaffected by this ADR; the switcher adds a UI-level selection layer on top of the existing
// registry, it does not change which module the registry treats as default."
export const DEFAULT_MODULE_ID = 'anemia';

// Literal, enumerated import() map — never build a specifier from a template string or
// variable, which would defeat static analysis/bundler discovery and could enable path
// injection from an untrusted moduleId.
//
// `cbc_suite_v1` intentionally points at the same `modules/anemia/facts.anemia.js` specifier as
// `anemia` — this is the OQ-1 delegation, not a copy-paste error: `cbc_suite_v1` has no fact-
// derivation code of its own in E0 (see modules/cbc_suite_v1/index.js's header comment).
//
// `kidney_suite_v1` and `growth_suite_v1` (P3-T3) each point at their OWN module's `index.js`
// instead — unlike `cbc_suite_v1`, neither has a sibling fact-derivation module to delegate to
// (PRD §2's explicit note, restated in each module's own header comment), so pointing either of
// them at `anemia`'s or `cbc_suite_v1`'s fact module would misrepresent an unimplemented stub as
// a real delegation relationship. Each loaded module currently exports only the same explicit
// "not yet implemented for this module" posture its `deriveFacts`/`summarize`/`limitations`
// hooks already return.
const MODULE_CODE_LOADERS = Object.freeze({
  anemia: () => import('../../modules/anemia/facts.anemia.js'),
  cbc_suite_v1: () => import('../../modules/anemia/facts.anemia.js'),
  kidney_suite_v1: () => import('../../modules/kidney_suite_v1/index.js'),
  growth_suite_v1: () => import('../../modules/growth_suite_v1/index.js'),
});

export function isRegisteredModule(moduleId) {
  return MODULE_IDS.includes(moduleId);
}

export async function loadModuleCode(moduleId) {
  const loader = MODULE_CODE_LOADERS[moduleId];
  if (!loader) {
    throw new Error('Unknown module: ' + moduleId);
  }
  return loader();
}
