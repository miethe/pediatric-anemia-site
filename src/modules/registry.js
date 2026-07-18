import anemiaModule from '../../modules/anemia/index.js';

const REGISTRY = new Map([
  ['anemia', anemiaModule],
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

export const MODULE_IDS = Object.freeze(['anemia']);

// Deliberate tripwire (SPIKE-002 Q5 assertion 1, tests/module-registry.test.mjs): today there
// is exactly one registered module, so the default is hardcoded. Revisit this the day a second
// module is registered — it must become a real selection decision, not stay a literal.
export const DEFAULT_MODULE_ID = 'anemia';

// Literal, enumerated import() map — never build a specifier from a template string or
// variable, which would defeat static analysis/bundler discovery and could enable path
// injection from an untrusted moduleId.
const MODULE_CODE_LOADERS = Object.freeze({
  anemia: () => import('../../modules/anemia/facts.anemia.js'),
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
