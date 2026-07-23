// tests/module-eligibility.test.mjs — src/moduleEligibility.js (P2-03) plus the post-P2
// second-opinion review's Finding 1 hardening (fail-open via inherited MODULE_MANIFESTS
// properties — src/moduleEligibility.js:33 at review time).
//
// `isModuleSelectable` is billed as THE sole eligibility gate (see the file's own header
// comment) — it must be fail-closed for every moduleId it does not itself own, including ids
// that only resolve to a value via the JavaScript prototype chain rather than as a real,
// registered manifest.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isModuleSelectable } from '../src/moduleEligibility.js';
import { MODULE_MANIFESTS } from '../src/moduleManifests.js';
import { READY_STATUS } from '../src/kbVerify.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --------------------------------------------------------------------------------------------
// Baseline behavior (P2-03 original scope)
// --------------------------------------------------------------------------------------------

test('isModuleSelectable returns true for the one registered module whose manifest status is READY_STATUS', () => {
  // Sourced from the real modules/anemia/module.json, not asserted independently of it, so this
  // test tracks the real manifest rather than a hand-copied assumption about its status.
  assert.equal(MODULE_MANIFESTS.anemia.status, READY_STATUS, 'test precondition: anemia must be integrity-recorded today');
  assert.equal(isModuleSelectable('anemia'), true);
});

test('isModuleSelectable returns false for a registered module whose manifest status is not READY_STATUS', () => {
  assert.notEqual(MODULE_MANIFESTS.cbc_suite_v1.status, READY_STATUS, 'test precondition: cbc_suite_v1 must not be integrity-recorded today');
  assert.equal(isModuleSelectable('cbc_suite_v1'), false);
  assert.equal(isModuleSelectable('growth_suite_v1'), false);
  assert.equal(isModuleSelectable('kidney_suite_v1'), false);
});

test('isModuleSelectable returns false for an entirely unregistered moduleId', () => {
  assert.equal(isModuleSelectable('not_a_real_module'), false);
  assert.equal(isModuleSelectable(''), false);
  assert.equal(isModuleSelectable(undefined), false);
});

// --------------------------------------------------------------------------------------------
// Finding 1 — fail-closed against inherited-property resolution
// --------------------------------------------------------------------------------------------

// `moduleId` arrives raw from the `?module=` URL param starting in Phase 3 — these are exactly
// the property names every plain JS object inherits from Object.prototype, so they are the
// concrete hostile-input surface the review flagged, not an arbitrary fuzz list.
const PROTOTYPE_CHAIN_IDS = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];

test('Finding 1: isModuleSelectable returns false for every prototype-chain-only id, on a clean prototype', () => {
  for (const id of PROTOTYPE_CHAIN_IDS) {
    assert.equal(isModuleSelectable(id), false, `isModuleSelectable('${id}') must be false`);
  }
});

test('Finding 1 (regression proof): isModuleSelectable stays fail-closed even when Object.prototype is polluted with status === READY_STATUS', () => {
  // This is the honest proof that the fix (Object.hasOwn(MODULE_MANIFESTS, moduleId)) is what is
  // actually doing the work, not an accident of a clean prototype. Without the guard, this
  // exact setup — an inherited `status` property equal to READY_STATUS — is precisely how
  // isModuleSelectable('constructor') (or any other prototype-chain id) would have fired the
  // fail-open bug the review found. The pollution is applied to and removed from the REAL global
  // Object.prototype inside a try/finally so it can never leak into another test.
  const originalDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, 'status');
  Object.defineProperty(Object.prototype, 'status', {
    value: READY_STATUS,
    configurable: true,
    enumerable: false,
  });
  try {
    for (const id of PROTOTYPE_CHAIN_IDS) {
      assert.equal(
        isModuleSelectable(id),
        false,
        `isModuleSelectable('${id}') must stay false even with Object.prototype.status polluted to READY_STATUS`,
      );
    }
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(Object.prototype, 'status', originalDescriptor);
    } else {
      delete Object.prototype.status;
    }
    // Prove the pollution was actually removed, not merely intended to be — a leaked pollution
    // here would silently corrupt every other test file run in this same process.
    assert.equal(Object.prototype.status, undefined);
  }
});

test('Finding 1: src/moduleEligibility.js guards with Object.hasOwn(MODULE_MANIFESTS, moduleId) before any property read', () => {
  const source = readFileSync(path.join(repoRoot, 'src/moduleEligibility.js'), 'utf8');
  const fnMatch = source.match(/export function isModuleSelectable\([\s\S]*?\n\}/);
  assert.ok(fnMatch, 'isModuleSelectable function body must be present');
  const body = fnMatch[0];
  assert.match(body, /Object\.hasOwn\(MODULE_MANIFESTS,\s*moduleId\)/, 'must use Object.hasOwn to gate on own-property membership');
  const hasOwnIndex = body.indexOf('Object.hasOwn(MODULE_MANIFESTS');
  const statusReadIndex = body.indexOf('MODULE_MANIFESTS[moduleId]');
  assert.ok(hasOwnIndex !== -1 && statusReadIndex !== -1);
  assert.ok(hasOwnIndex < statusReadIndex, 'the Object.hasOwn guard must precede the property read in source order');
});

test('Finding 1 (defense in depth): src/moduleManifests.js builds MODULE_MANIFESTS with a null prototype', () => {
  assert.equal(
    Object.getPrototypeOf(MODULE_MANIFESTS),
    null,
    'MODULE_MANIFESTS must have a null prototype — a second, independent layer against inherited-property resolution',
  );
  // Even with the null prototype alone (no Object.hasOwn guard), an inherited-only id must
  // resolve to undefined, not to any Object.prototype value.
  for (const id of PROTOTYPE_CHAIN_IDS) {
    assert.equal(MODULE_MANIFESTS[id], undefined, `MODULE_MANIFESTS['${id}'] must be undefined under a null prototype`);
  }
});

test('MODULE_MANIFESTS is still frozen and still holds exactly the 4 registered modules (null-prototype hardening did not change the shape)', () => {
  assert.ok(Object.isFrozen(MODULE_MANIFESTS));
  assert.deepEqual(
    [...Object.keys(MODULE_MANIFESTS)].sort(),
    ['anemia', 'cbc_suite_v1', 'growth_suite_v1', 'kidney_suite_v1'],
  );
});
