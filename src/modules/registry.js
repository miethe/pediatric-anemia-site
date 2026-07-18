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
