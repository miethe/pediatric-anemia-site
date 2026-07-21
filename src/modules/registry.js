import anemiaModule from '../../modules/anemia/index.js';
import cbcSuiteV1Module from '../../modules/cbc_suite_v1/index.js';

const REGISTRY = new Map([
  ['anemia', anemiaModule],
  ['cbc_suite_v1', cbcSuiteV1Module],
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
// module (`cbc_suite_v1`) IS now registered (P1-T3, OQ-1) — the day this comment used to say to
// revisit has arrived — but `DEFAULT_MODULE_ID` still correctly stays `'anemia'` rather than
// becoming a real selection decision. Why: E0 (this plan) adds zero client-selectable moduleId
// surface — no UI/API change lets any existing caller choose a moduleId (R-P4/PRD §6.1 confirms
// this explicitly) — so `'anemia'` remains the only module any caller can actually reach, and
// there is still nothing to select between. Revisit this again the day a client-selectable
// moduleId surface actually ships (a UI control, an API parameter, a CDS Hooks card selector,
// etc.) — that is the real trigger for turning this into a selection decision, not merely the
// count of registered modules.
export const DEFAULT_MODULE_ID = 'anemia';

// Literal, enumerated import() map — never build a specifier from a template string or
// variable, which would defeat static analysis/bundler discovery and could enable path
// injection from an untrusted moduleId.
//
// `cbc_suite_v1` intentionally points at the same `modules/anemia/facts.anemia.js` specifier as
// `anemia` — this is the OQ-1 delegation, not a copy-paste error: `cbc_suite_v1` has no fact-
// derivation code of its own in E0 (see modules/cbc_suite_v1/index.js's header comment).
const MODULE_CODE_LOADERS = Object.freeze({
  anemia: () => import('../../modules/anemia/facts.anemia.js'),
  cbc_suite_v1: () => import('../../modules/anemia/facts.anemia.js'),
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
