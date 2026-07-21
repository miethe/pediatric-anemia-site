import { deriveFacts as deriveAnemiaFacts } from '../../modules/anemia/facts.anemia.js';

// `cbc_suite_v1` maps to the exact same delegated function reference as `anemia` (OQ-1,
// modules/cbc_suite_v1/index.js's header comment) — CBC-Suite-specific fact derivation is out
// of scope for E0, so there is no second function to author here.
const REGISTRY = new Map([
  ['anemia', deriveAnemiaFacts],
  ['cbc_suite_v1', deriveAnemiaFacts],
]);

export function deriveFacts(input, moduleId) {
  const fn = REGISTRY.get(moduleId);
  if (!fn) {
    throw new Error('Unknown module: ' + moduleId);
  }
  return fn(input);
}
