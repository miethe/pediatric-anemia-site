import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_IDS, DEFAULT_MODULE_ID, loadModuleCode } from '../src/modules/registry.js';

// SPIKE-002 Q5 / platform-foundation-p0-v1.md Sequencing Note 5: this file ships assertions
// 1, 3, 4, and 5 in Phase 5. Assertion 2 (manifest shape) has a hard dependency on
// modules/<id>/module.json, which does not exist until Phase 6 — P6-T3 extends this same file
// with that assertion once module.json lands.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('assertion 1: registry completeness — MODULE_IDS non-empty, unique, includes DEFAULT_MODULE_ID', () => {
  assert.ok(MODULE_IDS.length > 0, 'MODULE_IDS must not be empty');
  assert.equal(new Set(MODULE_IDS).size, MODULE_IDS.length, 'MODULE_IDS must contain no duplicate ids');
  assert.ok(MODULE_IDS.includes(DEFAULT_MODULE_ID), 'MODULE_IDS must include DEFAULT_MODULE_ID');

  // Deliberate tripwire: today there is exactly one registered module, so DEFAULT_MODULE_ID
  // is a hardcoded literal. This assertion must be updated/deleted the day a second module
  // registers — its failure is the signal that DEFAULT_MODULE_ID needs a real (non-hardcoded)
  // selection decision instead of an assumed constant.
  assert.equal(DEFAULT_MODULE_ID, 'anemia');
});

// Assertion 2 (manifest shape: modules/<id>/module.json exists, parses, and
// manifest.id === id) is deferred to Phase 6 (P6-T3) — module.json is a Phase 6 deliverable.

test('assertion 3: per-module KB files exist and parse for every registered module', async () => {
  for (const moduleId of MODULE_IDS) {
    const moduleDir = path.join(root, 'modules', moduleId);
    for (const filename of ['rules.json', 'candidates.json', 'evidence.json', 'reference-ranges.json']) {
      const filePath = path.join(moduleDir, filename);
      const raw = await readFile(filePath, 'utf8');
      assert.doesNotThrow(() => JSON.parse(raw), `${moduleId}/${filename} must parse as JSON`);
    }
  }
});

test('assertion 4: loadModuleCode resolves module code exporting deriveFacts', async () => {
  const moduleCode = await loadModuleCode('anemia');
  assert.equal(typeof moduleCode.deriveFacts, 'function', 'loaded module code must export a deriveFacts function');
});

// Assertion 5: tests/engine.test.mjs's existing assertions keep running unmodified. This file
// is purely additive and tests/engine.test.mjs is untouched by this phase; both are
// auto-discovered by the `node --test tests/*.test.mjs` glob (package.json "test" script), so
// no duplication is needed here to satisfy that requirement.
