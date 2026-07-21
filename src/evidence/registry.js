// src/evidence/registry.js — FIX-E (reviewer re-review, finding E).
//
// Mirrors src/facts/registry.js and src/ranges/registry.js exactly: a moduleId-keyed map over
// each module's OWN evidence accessors, so a second registered module can never be resolved
// against the wrong module's evidence data. Before this file existed, src/engine.js's assess()
// accepted a `moduleId` parameter but resolved every rule's `sourcePassageId` through
// src/evidence.js#passageById, which searches only the statically-imported anemia evidence
// singleton (modules/anemia/evidence.json) — regardless of what `moduleId` was actually passed. A
// second module would either silently get `null` for every passage (a gap) or, on an id
// collision, the WRONG passage's status (a wrong-answer bug, not just a gap).
//
// Today there is exactly one registered module ('anemia'), so this registry has exactly one
// entry — reusing src/evidence.js's own passageById/passagesFor rather than re-loading
// modules/anemia/evidence.json a second time (single source of truth, DEF-1). The day a second
// module registers, it adds its own entry here (its own evidence.js-shaped loader over its own
// evidence.json) exactly the way src/modules/registry.js's own header note describes for
// MODULE_CODE_LOADERS. passageByIdForModule FAILS LOUDLY — throws, never returns anemia's data —
// for any moduleId not present in this map, so a second module can never be silently resolved
// against the wrong module's passages.
import { passageById as anemiaPassageById, passagesFor as anemiaPassagesFor } from '../evidence.js';

const REGISTRY = new Map([
  ['anemia', { passageById: anemiaPassageById, passagesFor: anemiaPassagesFor }],
]);

function accessorsFor(moduleId) {
  const accessors = REGISTRY.get(moduleId);
  if (!accessors) {
    throw new Error(
      `src/evidence/registry.js: unknown module "${moduleId}" — no evidence accessors registered. `
      + 'A rule\'s sourcePassageId must never be resolved against another module\'s evidence data; '
      + 'register this module\'s own evidence accessors here instead of falling back to a default.',
    );
  }
  return accessors;
}

/** Passage lookup scoped to `moduleId`'s own evidence — never another module's. Unknown moduleId throws. */
export function passageByIdForModule(moduleId, passageId) {
  return accessorsFor(moduleId).passageById(passageId);
}

/** Passage list for `sourceId`, scoped to `moduleId`'s own evidence. Unknown moduleId throws. */
export function passagesForModule(moduleId, sourceId) {
  return accessorsFor(moduleId).passagesFor(sourceId);
}
