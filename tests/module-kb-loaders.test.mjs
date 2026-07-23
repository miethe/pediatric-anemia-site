// tests/module-kb-loaders.test.mjs — P2-01/P2-04/P2-06 (spa-module-switcher-v1, Phase 2,
// phase-0-2-foundation.md), plus post-P2 second-opinion review findings 2 and 3.
//
// Covers: (1) src/moduleKbLoaders.js's MODULE_KB_LOADERS map shape (frozen, null-prototype,
// exactly 4 thunks, no anemia fallback for an unregistered moduleId, fail-closed on
// prototype-chain-only ids — finding 2); (2) the P2-04 reset-before-fetch ordering contract, as
// a static source-order assertion, an executed invocation-order proof, AND an executed proof of
// the actual caller-visible EFFECT via a realistic caller harness (finding 3); (3) the P2-06 R-4
// regression guard — no APP_SURFACE_FILES entry may contain a template-literal fetch specifier.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODULE_KB_LOADERS, loadModuleKb } from '../src/moduleKbLoaders.js';
import { MODULE_IDS } from '../src/modules/registry.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --------------------------------------------------------------------------------------------
// (1) MODULE_KB_LOADERS shape
// --------------------------------------------------------------------------------------------

test('MODULE_KB_LOADERS is frozen', () => {
  assert.ok(Object.isFrozen(MODULE_KB_LOADERS), 'MODULE_KB_LOADERS must be Object.freeze()d');
});

test('MODULE_KB_LOADERS has exactly 4 thunks, one per MODULE_IDS entry', () => {
  const keys = Object.keys(MODULE_KB_LOADERS);
  assert.equal(keys.length, 4, 'MODULE_KB_LOADERS must have exactly 4 entries');
  assert.deepEqual(
    [...keys].sort(),
    [...MODULE_IDS].sort(),
    'MODULE_KB_LOADERS keys must exactly match src/modules/registry.js MODULE_IDS',
  );
  for (const key of keys) {
    assert.equal(typeof MODULE_KB_LOADERS[key], 'function', `MODULE_KB_LOADERS.${key} must be a thunk (function)`);
  }
});

test('MODULE_KB_LOADERS has no entry for an unregistered moduleId — absent, not an anemia fallback', () => {
  assert.equal(
    Object.hasOwn(MODULE_KB_LOADERS, 'not_a_real_module'),
    false,
    'an unregistered moduleId must not be a key on MODULE_KB_LOADERS at all',
  );
  assert.equal(
    MODULE_KB_LOADERS.not_a_real_module,
    undefined,
    'an unregistered moduleId must resolve to undefined, never to the anemia thunk or any other fallback',
  );
});

// --------------------------------------------------------------------------------------------
// Finding 2 — fail-closed against inherited-property resolution (MODULE_KB_LOADERS and
// loadModuleKb). `moduleId` arrives raw from the `?module=` URL param starting in Phase 3, so a
// hostile caller can pass a JS-prototype-chain name. `Object.prototype.constructor` is a truthy
// FUNCTION (the `Object` constructor), so an unguarded `MODULE_KB_LOADERS[moduleId]` lookup for
// `moduleId === 'constructor'` would resolve a real, callable, but entirely wrong "loader" —
// `loader()` would call `Object()` and resolve to `{}` instead of throwing. These names are
// therefore the concrete hostile-input surface, not an arbitrary fuzz list.
// --------------------------------------------------------------------------------------------

const PROTOTYPE_CHAIN_IDS = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];

test('Finding 2: MODULE_KB_LOADERS has a null prototype (defense in depth alongside the Object.hasOwn guard)', () => {
  assert.equal(Object.getPrototypeOf(MODULE_KB_LOADERS), null, 'MODULE_KB_LOADERS must have a null prototype');
  for (const id of PROTOTYPE_CHAIN_IDS) {
    assert.equal(MODULE_KB_LOADERS[id], undefined, `MODULE_KB_LOADERS['${id}'] must be undefined under a null prototype`);
  }
  // Null-prototype hardening must not change the map's shape.
  assert.ok(Object.isFrozen(MODULE_KB_LOADERS));
  assert.equal(Object.keys(MODULE_KB_LOADERS).length, 4);
});

test('Finding 2 (regression proof): loadModuleKb rejects every prototype-chain-only id even with Object.prototype polluted to a callable value', async () => {
  // The honest proof the Object.hasOwn(MODULE_KB_LOADERS, moduleId) guard — not merely the null
  // prototype — is doing the work: pollute Object.prototype.constructor with a stand-in function
  // that would masquerade as a "loader" if the guard were absent, then confirm loadModuleKb still
  // rejects. Removed in finally so the pollution can never leak into another test.
  const pollutionCalls = [];
  const originalDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, 'constructor');
  Object.defineProperty(Object.prototype, 'constructor', {
    value: () => {
      pollutionCalls.push('pollution-loader-called');
      return Promise.resolve({});
    },
    configurable: true,
    writable: true,
  });
  try {
    const callOrder = [];
    await assert.rejects(
      () => loadModuleKb('constructor', () => callOrder.push('reset')),
      /Unknown module: constructor/,
    );
    assert.deepEqual(callOrder, [], 'resetState() must never run for a rejected/unregistered moduleId (finding 2 validates before any side effect)');
    assert.deepEqual(pollutionCalls, [], 'the polluted inherited "constructor" must never be invoked as a loader');
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(Object.prototype, 'constructor', originalDescriptor);
    } else {
      delete Object.prototype.constructor;
    }
  }
});

test('Finding 2: loadModuleKb rejects every prototype-chain-only id on a clean prototype, without calling resetState', async () => {
  for (const id of PROTOTYPE_CHAIN_IDS) {
    const callOrder = [];
    // eslint-disable-next-line no-await-in-loop
    await assert.rejects(
      () => loadModuleKb(id, () => callOrder.push('reset')),
      new RegExp(`Unknown module: ${id}`),
      `loadModuleKb('${id}') must reject`,
    );
    assert.deepEqual(callOrder, [], `resetState() must not run for loadModuleKb('${id}')`);
  }
});

test('src/moduleKbLoaders.js contains exactly 8 literal fetch() specifiers, zero template literals', () => {
  const source = readFileSync(path.join(repoRoot, 'src/moduleKbLoaders.js'), 'utf8');
  const literalFetchMatches = [...source.matchAll(/fetch\('(\.\/modules\/[^']+\.json)'\)/g)];
  assert.equal(literalFetchMatches.length, 8, 'expected exactly 8 literal fetch() specifiers');
  const specifiers = literalFetchMatches.map((m) => m[1]);
  assert.equal(new Set(specifiers).size, 8, 'all 8 fetch specifiers must be distinct paths');
  for (const moduleId of MODULE_IDS) {
    assert.ok(specifiers.includes(`./modules/${moduleId}/rules.json`), `missing literal rules.json fetch for ${moduleId}`);
    assert.ok(specifiers.includes(`./modules/${moduleId}/candidates.json`), `missing literal candidates.json fetch for ${moduleId}`);
  }
  assert.doesNotMatch(source, /fetch\(\s*`[^`]*\$\{/, 'src/moduleKbLoaders.js must contain zero template-literal fetch specifiers');
});

// --------------------------------------------------------------------------------------------
// (2) P2-04 — reset-before-fetch ordering contract (SQ-3 §4.4: rules/candidates must be reset to
// []/{} BEFORE any fetch is issued) AND finding 2's validate-before-any-side-effect ordering
// (Object.hasOwn check precedes resetState(), which precedes the loader() fetch).
// --------------------------------------------------------------------------------------------

test('P2-04/Finding-2 (static): Object.hasOwn precedes resetState(), which precedes the loader() call, in loadModuleKb source order', () => {
  const source = readFileSync(path.join(repoRoot, 'src/moduleKbLoaders.js'), 'utf8');
  const fnMatch = source.match(/export async function loadModuleKb\([\s\S]*?\n\}/);
  assert.ok(fnMatch, 'loadModuleKb function body must be present in src/moduleKbLoaders.js');
  const body = fnMatch[0];
  const hasOwnIndex = body.indexOf('Object.hasOwn(MODULE_KB_LOADERS');
  // NOTE: search for the actual statement `resetState();`, not merely the substring
  // `resetState()` — that substring also appears inside the earlier type-check's error message
  // ("requires a resetState() callback..."), which would otherwise be matched first and make
  // this assertion compare against the wrong occurrence.
  const resetIndex = body.indexOf('resetState();');
  // NOTE: search for the actual declaration statement, not merely the substring
  // `MODULE_KB_LOADERS[moduleId]` — that substring also appears inside a doc comment just above
  // the Object.hasOwn guard (illustrating what an unguarded lookup would look like), which would
  // otherwise be matched first.
  const lookupIndex = body.indexOf('const loader = MODULE_KB_LOADERS[moduleId];');
  const loaderCallIndex = body.lastIndexOf('loader()');
  assert.ok(hasOwnIndex !== -1, 'Object.hasOwn(MODULE_KB_LOADERS, ...) guard must be present in loadModuleKb');
  assert.ok(resetIndex !== -1, 'resetState() call statement must be present in loadModuleKb');
  assert.ok(lookupIndex !== -1, 'MODULE_KB_LOADERS lookup must be present in loadModuleKb');
  assert.ok(loaderCallIndex !== -1, 'loader() invocation must be present in loadModuleKb');
  assert.ok(hasOwnIndex < resetIndex, 'the Object.hasOwn validation guard must precede resetState() — no side effect for an unregistered/hostile id (finding 2)');
  assert.ok(resetIndex < lookupIndex, 'resetState() must precede the MODULE_KB_LOADERS lookup in source order (SQ-3 §4.4)');
  assert.ok(resetIndex < loaderCallIndex, 'resetState() must precede the loader() call in source order (SQ-3 §4.4)');
});

test('P2-04 (executed): resetState() actually runs before any fetch is issued', async () => {
  const callOrder = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    callOrder.push(`fetch:${url}`);
    return { ok: true, status: 200, url, json: async () => [] };
  };
  try {
    await loadModuleKb('anemia', () => callOrder.push('reset'));
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(callOrder[0], 'reset', 'resetState() must be the first recorded call');
  assert.ok(callOrder.length > 1, 'at least one fetch must have been issued after the reset');
  assert.ok(
    callOrder.slice(1).every((entry) => entry.startsWith('fetch:')),
    'every call after the reset must be a fetch — reset must never run more than once nor run after a fetch',
  );
});

test('Finding 2 (executed): resetState() does NOT run for an unregistered moduleId — validation happens before any side effect', async () => {
  const callOrder = [];
  await assert.rejects(
    () => loadModuleKb('not_a_real_module', () => callOrder.push('reset')),
    /Unknown module: not_a_real_module/,
  );
  assert.deepEqual(callOrder, [], 'resetState() must never run for an unregistered moduleId — the hasOwn guard rejects before touching caller state');
});

test('loadModuleKb requires a resetState() callback — a missing/non-function reset is a caller bug, not silently ignored', async () => {
  await assert.rejects(() => loadModuleKb('anemia', undefined), TypeError);
  await assert.rejects(() => loadModuleKb('anemia', 'not-a-function'), TypeError);
});

// --------------------------------------------------------------------------------------------
// Finding 3 — reset-before-fetch must prove the EFFECT (post-rejection rules===[]/candidates==={})
// not merely invocation order. A caller passing `() => {}` satisfies every assertion above while
// still violating SQ-3 §4.4's actual safety property. This is the honest limit of what a non-DOM
// test can prove before P3/P4 wire the real caller (re-asserted at gate level by
// P6-005/P6-012): a REALISTIC caller harness with real `let` variables holding stale module-Y
// data, a resetState that genuinely clears them, and a REJECTING fetch for the newly selected
// module X — asserting the caller's own state, not loadModuleKb's internals, ends up []/{}.
// --------------------------------------------------------------------------------------------

test('Finding 3 (realistic caller harness): after a rejected fetch for module X, the caller\'s own rules/candidates end up []/{} — never module Y\'s prior data', async () => {
  // Module Y's prior, now-stale KB content, held in the SAME shape a real caller (src/app.js's
  // future module-switch handler) would hold it in: plain `let` variables, not a fixture object
  // loadModuleKb reaches into. loadModuleKb never sees these directly — only resetState does.
  let rules = [{ id: 'moduleY-rule-1' }, { id: 'moduleY-rule-2' }];
  let candidates = { moduleYCandidate: { label: 'stale module Y candidate' } };
  const resetState = () => {
    rules = [];
    candidates = {};
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('simulated network failure / 404 for module X');
  };
  try {
    await assert.rejects(() => loadModuleKb('anemia', resetState));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(rules, [], 'the caller\'s rules variable must be [] after a rejected fetch for the newly selected module — never left holding module Y\'s prior rules');
  assert.deepEqual(candidates, {}, 'the caller\'s candidates variable must be {} after a rejected fetch for the newly selected module — never left holding module Y\'s prior candidates');
});

test('Finding 3 (realistic caller harness, no-op reset counter-example — documents the honest limit): a caller-authored no-op resetState still leaves stale data in place', async () => {
  // This is NOT a bug in loadModuleKb — it is the documented, honest boundary of what this
  // function's contract can enforce (see the loadModuleKb JSDoc "BINDING CONTRACT ON THE
  // CALLER"). loadModuleKb guarantees WHEN resetState runs; it cannot guarantee WHAT a caller's
  // resetState does. A real caller that passes `() => {}` is violating SQ-3 §4.4 itself, and that
  // violation is exactly what this test makes visible rather than silently passing.
  let rules = [{ id: 'moduleY-rule-1' }];
  let candidates = { moduleYCandidate: {} };
  const noopResetState = () => {};

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('simulated network failure / 404 for module X');
  };
  try {
    await assert.rejects(() => loadModuleKb('anemia', noopResetState));
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Deliberately asserting the STALE state remains — proving the contract's responsibility
  // boundary is real, not merely asserted in a comment.
  assert.deepEqual(rules, [{ id: 'moduleY-rule-1' }], 'a no-op resetState leaves stale rules in place — this is a caller contract violation, not a loadModuleKb defect');
  assert.deepEqual(candidates, { moduleYCandidate: {} }, 'a no-op resetState leaves stale candidates in place — this is a caller contract violation, not a loadModuleKb defect');
});

// --------------------------------------------------------------------------------------------
// (3) P2-06 — R-4 regression guard: no template-literal fetch specifier may re-enter any
// APP_SURFACE_FILES entry.
//
// WHY THIS TEST EXISTS (do not delete as "redundant" with scripts/check-app-imports.mjs — that
// script only verifies the CURRENT specifiers resolve; this test is the regression guard against
// a future "simplification" reintroducing a template-built one):
//
// A template-literal fetch specifier like `` fetch(`./modules/${id}/rules.json`) `` would make
// scripts/check-app-imports.mjs:121-132 fall back to only checking that the STATIC DIRECTORY
// PREFIX (`./modules`) exists, losing the per-file existence verification every literal
// specifier gets. Independently and more dangerously, scripts/build-static.mjs:148's stamping
// regex — `` (fetch\(\s*(['"`]))(\.\.?\/[^'"`?]+\.json)(\2) `` — does not match a template
// literal at all, so the specifier would silently ship WITHOUT its `?v=` cache-busting stamp.
// That is the exact stale-rules hazard scripts/build-static.mjs:100-106 exists to prevent: a
// returning clinician's browser could then serve a stale, previously-cached rules.json or
// candidates.json behind a URL that never changes, silently evaluating an old rule set behind a
// UI reporting the current knowledge-base version.
// --------------------------------------------------------------------------------------------

// SCOPING NOTE (deviation from the plan text's literal wording, recorded here and in the phase
// progress note): the plan describes this guard as catching "a template-literal fetch specifier
// matching `` fetch(`…${ ``" with no further qualifier. Applied unscoped, that pattern also
// matches src/app.js:525 and src/algorithmExplorer.js:616's PRE-EXISTING, SANCTIONED dynamic
// fetch of `./examples/${id}.json` — a legitimate, already-reviewed use of the `isDynamic` path
// scripts/check-app-imports.mjs:129-145 exists specifically to verify (directory-prefix check,
// not per-file). Both files are on the HARD BOUNDARY list for this phase (never touch
// src/app.js), so an unscoped regex would make this test fail against today's unmodified,
// correct source — not a real regression. The R-4 hazard this guard exists to prevent (per its
// own name and the SQ-3 §6 citation) is specifically about the KB-loader map re-acquiring a
// template-built specifier under `./modules/…` — the `rules.json`/`candidates.json` fetches
// scripts/build-static.mjs:148 must be able to stamp. Scoping the regex to that `./modules/`
// prefix preserves full protection against the actual hazard while not flagging the unrelated,
// already-sanctioned `./examples/` dynamic fetch.
const TEMPLATE_LITERAL_FETCH_RE = /fetch\(\s*`\.\/modules\/[^`]*\$\{/;

function readAppSurfaceFiles() {
  const checkScriptSource = readFileSync(path.join(repoRoot, 'scripts/check-app-imports.mjs'), 'utf8');
  const listMatch = checkScriptSource.match(/const APP_SURFACE_FILES = \[([\s\S]*?)\];/);
  assert.ok(listMatch, 'APP_SURFACE_FILES array must be present in scripts/check-app-imports.mjs');
  const files = [...listMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(files.length > 0, 'APP_SURFACE_FILES must not be empty');
  return files;
}

test('P2-06: no APP_SURFACE_FILES entry contains a template-literal fetch() specifier', () => {
  const files = readAppSurfaceFiles();
  // src/moduleKbLoaders.js and src/moduleEligibility.js must both be covered by this run — if
  // either is missing from APP_SURFACE_FILES, this assertion (not just check-app-imports.mjs)
  // would silently stop protecting it.
  assert.ok(files.includes('src/moduleKbLoaders.js'), 'src/moduleKbLoaders.js must be registered in APP_SURFACE_FILES');
  assert.ok(files.includes('src/moduleEligibility.js'), 'src/moduleEligibility.js must be registered in APP_SURFACE_FILES');
  for (const relFile of files) {
    const source = readFileSync(path.join(repoRoot, relFile), 'utf8');
    assert.doesNotMatch(
      source,
      TEMPLATE_LITERAL_FETCH_RE,
      `${relFile} must not contain a template-literal fetch() specifier (R-4 regression — see file header comment)`,
    );
  }
});

// Permanent, repeatable proof that the guard above actually fires on the hazardous pattern —
// exercises the identical regex against an inline seeded snippet rather than mutating a real
// source file, so the proof survives in CI instead of being a one-time manual observation.
// (The one-time manual observation — seeding a real template-literal specifier into
// src/moduleKbLoaders.js, running this suite, observing the P2-06 test above fail, then
// reverting — was performed during Phase 2 execution; see
// .claude/progress/spa-module-switcher/phase-2-progress.md for the recorded evidence.)
test('P2-06 (regex proof): TEMPLATE_LITERAL_FETCH_RE fires on the exact hazardous pattern', () => {
  const hazardousSnippet = "fetch(`./modules/${moduleId}/rules.json`)";
  assert.match(hazardousSnippet, TEMPLATE_LITERAL_FETCH_RE);
  // Sanity check the negative direction too: today's actual literal specifiers must NOT match.
  assert.doesNotMatch("fetch('./modules/anemia/rules.json')", TEMPLATE_LITERAL_FETCH_RE);
});
