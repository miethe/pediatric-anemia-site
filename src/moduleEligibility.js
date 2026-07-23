// src/moduleEligibility.js — the single eligibility predicate
// (D-1 / FR-4, FR-6, docs/project_plans/PRDs/features/spa-module-switcher-v1.md, P2-03).
//
// `isModuleSelectable(moduleId)` is the SOLE gate on (a) whether a module row is activatable in
// the UI and (b) whether `MODULE_KB_LOADERS`/`assess()` are ever invoked for that module (AC-2
// propagation contract) — there must be no second, divergent eligibility check anywhere else in
// the UI layer.
//
// Eligibility is decided from the manifest's declared `status`, BEFORE any `assess()` call —
// never by catching an engine throw (D-4: catching an engine throw produces a refusal, but a
// MISATTRIBUTED one — it would report a generic "assessment failed" instead of the specific,
// governance-relevant "this module's manifest status is not the ready one" reason).
//
// The comparison is against `READY_STATUS`, imported from src/kbVerify.js:43 — this file never
// spells out that status value as a hardcoded string literal of its own. Importing the constant
// (rather than retyping its value) keeps the client, the build (scripts/build-static.mjs) and the
// server (server.mjs) enforcing the exact same value; a hardcoded literal here could drift from
// that constant silently, and this file's own value would then no longer be the single truth
// src/kbVerify.js:43 defines.
//
// A manifest that is entirely absent, whose `status` field is absent, or whose `status` is any
// other member of the closed enum (schemas/module-manifest.schema.json:22 lists all four) fails
// the strict equality check below and therefore returns `false` — ineligible, routing to an
// FR-17 refusal. There is no code path in this file that can default to eligible.
//
// FAIL-CLOSED-ON-INHERITED-KEYS (post-P2 hardening, second-opinion review finding 1): `moduleId`
// arrives raw from the `?module=` URL param starting in Phase 3, so a hostile caller can pass any
// string, including `'__proto__'`, `'constructor'`, or `'toString'`. `MODULE_MANIFESTS` is a
// plain object — indexing it with one of those names resolves an INHERITED property from
// `Object.prototype`, not an own, registered manifest. On a clean prototype that inherited value
// is `undefined` (already safe by accident), but if `Object.prototype` were ever polluted
// elsewhere in the runtime (a genuinely different bug, but one this predicate must not compound),
// an inherited `status` could read as `READY_STATUS` and this — THE sole eligibility gate — would
// fail OPEN. `Object.hasOwn(MODULE_MANIFESTS, moduleId)` rejects any id that is not one of this
// map's own four literal keys before any property read happens at all; the `?.` below stays as
// belt-and-braces, not as the only guard. `MODULE_MANIFESTS` is also now built with a `null`
// prototype (src/moduleManifests.js) as a second, independent layer of the same defense.
import { MODULE_MANIFESTS } from './moduleManifests.js';
import { READY_STATUS } from './kbVerify.js';

/**
 * @param {string} moduleId
 * @returns {boolean} true only when `moduleId` is an OWN key of `MODULE_MANIFESTS` (never an
 *   inherited one — see the fail-closed-on-inherited-keys note above) and that manifest declares
 *   `status === READY_STATUS`.
 */
export function isModuleSelectable(moduleId) {
  if (!Object.hasOwn(MODULE_MANIFESTS, moduleId)) return false;
  const status = MODULE_MANIFESTS[moduleId]?.status;
  return status === READY_STATUS;
}
