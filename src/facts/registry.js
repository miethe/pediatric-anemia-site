import { deriveFacts as deriveAnemiaFacts } from '../../modules/anemia/facts.anemia.js';
import { deriveFacts as deriveCbcSuiteV1Facts } from '../../modules/cbc_suite_v1/facts.cbc.js';
import kidneySuiteV1Module from '../../modules/kidney_suite_v1/index.js';
import { deriveFacts as deriveGrowthSuiteV1Facts } from '../../modules/growth_suite_v1/index.js';

// cbc_suite_v1 extends anemia's shared CBC fact substrate with a fail-closed local-profile fact
// and explicit unsupported high-count states. It deliberately does not execute the pending
// platelet/pancytopenia/smear proposals or add a portable count threshold.
//
// `kidney_suite_v1` and `growth_suite_v1` (P3-T3, Phase 3) each map to their OWN module's
// placeholder `deriveFacts` instead — literal, enumerated entries, never a variable or
// template-string specifier, and never delegating to `anemia`'s or `cbc_suite_v1`'s fact module.
// Neither new module has a sibling fact-derivation module to delegate to (PRD §2's explicit
// note), so each placeholder `deriveFacts` here returns only the same explicit "not yet
// implemented for this module" posture documented in its own `modules/<id>/index.js`.
// `growth_suite_v1/index.js` exports `deriveFacts` as a named export directly;
// `kidney_suite_v1/index.js` exports it only on its default hook-descriptor object, so it is
// referenced here as `kidneySuiteV1Module.deriveFacts`.
const REGISTRY = new Map([
  ['anemia', deriveAnemiaFacts],
  ['cbc_suite_v1', deriveCbcSuiteV1Facts],
  ['kidney_suite_v1', kidneySuiteV1Module.deriveFacts],
  ['growth_suite_v1', deriveGrowthSuiteV1Facts],
]);

export function deriveFacts(input, moduleId) {
  const fn = REGISTRY.get(moduleId);
  if (!fn) {
    throw new Error('Unknown module: ' + moduleId);
  }
  return fn(input);
}
