// src/moduleKbLoaders.js — MODULE_KB_LOADERS literal-specifier map
// (FR-36 / R-4 / SQ-3 §6, docs/project_plans/PRDs/features/spa-module-switcher-v1.md, P2-01).
//
// Mirrors the existing `MODULE_CODE_LOADERS` shape (src/modules/registry.js:68-73) rather than
// inventing a new one: a frozen, moduleId-keyed map of thunks. Each thunk's `fetch()` calls are
// LITERAL — never built from a template-string interpolation over `moduleId` — for two
// independent, load-bearing reasons (spike-leg-sq3-failure-surface.md §6):
//
//   1. scripts/check-app-imports.mjs:121-132 resolves a *dynamic* (template-literal) fetch
//      specifier by checking only its static directory prefix exists (`./modules`), losing the
//      per-file dev+dist existence verification every literal specifier gets.
//   2. scripts/build-static.mjs:148's stamping regex
//      `` (fetch\(\s*(['"`]))(\.\.?\/[^'"`?]+\.json)(\2) `` does not match a template literal at
//      all, so a template-built specifier would silently ship WITHOUT a `?v=` cache-busting
//      stamp — serving unstamped, cacheable KB JSON to a returning clinician's browser, exactly
//      the stale-rules hazard build-static.mjs:100-106 exists to prevent (R-4).
//
// A thunk for an unregistered moduleId is deliberately ABSENT from this map rather than falling
// through to `anemia` — `loadModuleKb` below throws on lookup miss instead of defaulting.
//
// FAIL-CLOSED-ON-INHERITED-KEYS (post-P2 hardening, second-opinion review finding 2): `moduleId`
// arrives raw from the `?module=` URL param starting in Phase 3. Without a guard, indexing a
// plain object with `'constructor'` (or `'toString'`, `'__proto__'`, etc.) resolves an INHERITED
// `Object.prototype` value — not a registered thunk, but a truthy function nonetheless
// (`Object.prototype.constructor` is the `Object` constructor itself) — so
// `loadModuleKb('constructor', reset)` would call `Object()` instead of throwing, silently
// "succeeding" with `{}` rather than rejecting the unregistered id. `loadModuleKb` below now
// checks `Object.hasOwn(MODULE_KB_LOADERS, moduleId)` before any lookup. As a second, independent
// layer of the same defense this map also carries a `null` prototype (`__proto__: null` below,
// special-cased object-literal syntax, not a regular property) — an inherited-property read
// against it returns `undefined` even without the `hasOwn` guard.
export const MODULE_KB_LOADERS = Object.freeze({
  __proto__: null,
  anemia: () => Promise.all([
    fetch('./modules/anemia/rules.json'),
    fetch('./modules/anemia/candidates.json'),
  ]),
  cbc_suite_v1: () => Promise.all([
    fetch('./modules/cbc_suite_v1/rules.json'),
    fetch('./modules/cbc_suite_v1/candidates.json'),
  ]),
  growth_suite_v1: () => Promise.all([
    fetch('./modules/growth_suite_v1/rules.json'),
    fetch('./modules/growth_suite_v1/candidates.json'),
  ]),
  kidney_suite_v1: () => Promise.all([
    fetch('./modules/kidney_suite_v1/rules.json'),
    fetch('./modules/kidney_suite_v1/candidates.json'),
  ]),
});

/**
 * loadModuleKb(moduleId, resetState) — P2-04, the reset-before-fetch ordering contract (SQ-3
 * §4.4, "Module fetch 404": "Must NOT leave `rules`/`candidates` holding the previous module's
 * data — reset both to `[]`/`{}` **before** the fetch.").
 *
 * This is the loader CALL SITE a later phase's module-switch handler (P3/P4) invokes on every
 * module switch. It does not own `rules`/`candidates` state itself (that lives in the caller —
 * `src/app.js`, out of this file's scope) — instead it accepts a `resetState` callback.
 *
 * BINDING CONTRACT ON THE CALLER (SQ-3 §4.4 — not merely a suggestion): `resetState` MUST
 * synchronously set the caller's `rules` variable to `[]` and its `candidates` variable to `{}`
 * before returning. This function only guarantees WHEN `resetState` runs relative to the fetch
 * (before, always, by source order below) — it cannot, and does not try to, guarantee WHAT
 * `resetState` does; a caller that passes `() => {}` satisfies this function's own invocation
 * contract while still violating SQ-3 §4.4's actual safety property. The real caller is wired in
 * P3/P4, and P6-005/P6-012 re-assert the end-to-end effect at gate level against that real wiring
 * — tests/module-kb-loaders.test.mjs's "realistic caller harness" test below is the honest limit
 * of what this non-DOM, no-real-caller-yet phase can prove: it exercises real `let` variables and
 * a genuine clearing `resetState`, and asserts the POST-REJECTION state, not merely invocation
 * order.
 *
 * VALIDATION ORDER (post-P2 hardening, second-opinion review finding 2): `moduleId` is checked
 * against `MODULE_KB_LOADERS` via `Object.hasOwn` FIRST — before `resetState()` is ever called.
 * An unregistered/hostile id (e.g. `'constructor'`, reachable once Phase 3 reads `moduleId` raw
 * from the `?module=` URL param) is rejected before this function touches the caller's state at
 * all, so a bogus switch attempt can never trigger a real module's reset side effect. Only once
 * `moduleId` is confirmed to be one of this map's own four literal keys does the SQ-3 §4.4
 * reset-before-fetch sequence run: `resetState()`, then `loader()`.
 *
 * Do not reorder the `Object.hasOwn` check above `resetState()`, or `resetState()` below the
 * `loader()` invocation — tests/module-kb-loaders.test.mjs pins this exact source ordering (both
 * statically, by reading this function's source text, and by executing it with instrumented
 * `fetch`/`resetState` pairs) specifically so a later refactor cannot silently move validation
 * after a side effect, or the reset after the fetch.
 *
 * @param {string} moduleId
 * @param {() => void} resetState - invoked synchronously, before any fetch is issued, ONLY for a
 *   registered moduleId. MUST clear the caller's rules/candidates state to []/{} (SQ-3 §4.4).
 * @returns {Promise<[Response, Response]>} `[rulesResponse, candidatesResponse]`
 */
export async function loadModuleKb(moduleId, resetState) {
  if (typeof resetState !== 'function') {
    throw new TypeError('loadModuleKb requires a resetState() callback invoked before any fetch is issued');
  }
  // Validate BEFORE any side effect (finding 2) — Object.hasOwn rejects inherited-only keys
  // ('constructor', 'toString', '__proto__', ...) that a plain `moduleId in MODULE_KB_LOADERS` or
  // `MODULE_KB_LOADERS[moduleId]` truthiness check would not reliably reject.
  if (!Object.hasOwn(MODULE_KB_LOADERS, moduleId)) {
    throw new Error('Unknown module: ' + moduleId);
  }
  // SQ-3 §4.4 reset-before-fetch ordering contract — this line must stay above the loader lookup
  // and above `loader()` below. Do not reorder.
  resetState();
  const loader = MODULE_KB_LOADERS[moduleId];
  return loader();
}
