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
//
// EPR2-T6 (R-P2 resilience): sourceRightsPositionById is registered the same way — a moduleId-
// scoped accessor over src/evidence.js's own sourceRightsPositionById, never a second store.
import {
  passageById as anemiaPassageById,
  passagesFor as anemiaPassagesFor,
  sourceRightsPositionById as anemiaSourceRightsPositionById,
} from '../evidence.js';
// The second module has registered (P4-T5) — its own evidence.js-shaped loader over its own
// evidence.json, exactly the extension this file's header comment anticipated. Never anemia's.
// cbc_suite_v1 rights-metadata backfill (integration follow-up to EP-R2/EP-R3): its evidence.js
// now also exports its own sourceRightsPositionById (mirroring anemiaSourceRightsPositionById
// above), so this entry is complete the same way the anemia entry is.
import {
  passageById as cbcSuiteV1PassageById,
  passagesFor as cbcSuiteV1PassagesFor,
  sourceRightsPositionById as cbcSuiteV1SourceRightsPositionById,
} from '../../modules/cbc_suite_v1/evidence.js';

const REGISTRY = new Map([
  ['anemia', {
    passageById: anemiaPassageById,
    passagesFor: anemiaPassagesFor,
    sourceRightsPositionById: anemiaSourceRightsPositionById,
  }],
  ['cbc_suite_v1', {
    passageById: cbcSuiteV1PassageById,
    passagesFor: cbcSuiteV1PassagesFor,
    sourceRightsPositionById: cbcSuiteV1SourceRightsPositionById,
  }],
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

/**
 * Rights-position label for `sourceId`, scoped to `moduleId`'s own evidence — never another
 * module's. Unknown moduleId throws (fail loud, same contract as passageByIdForModule); an
 * unknown or absent sourceId within a known module degrades to "rights position unassessed" via
 * src/evidence.js#sourceRightsPositionById, never throws.
 */
export function sourceRightsPositionForModule(moduleId, sourceId) {
  return accessorsFor(moduleId).sourceRightsPositionById(sourceId);
}
