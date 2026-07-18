import { deriveFacts as deriveAnemiaFacts } from '../../modules/anemia/facts.anemia.js';

const REGISTRY = new Map([
  ['anemia', deriveAnemiaFacts],
]);

export function deriveFacts(input, moduleId) {
  const fn = REGISTRY.get(moduleId);
  if (!fn) {
    throw new Error('Unknown module: ' + moduleId);
  }
  return fn(input);
}
