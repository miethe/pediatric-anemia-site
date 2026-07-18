// Permanent equivalence harness (platform-foundation-p0 Phase 1, task P1-T4).
//
// For every examples/*.json worked example, asserts assessPediatricAnemia()
// output is deepEqual to the golden fixture captured in tests/golden/ before
// any code moved (scripts/capture-golden.mjs). This is the safety net every
// subsequent refactor phase's exit gate re-runs: a byte-identical (modulo
// meta.generatedAt) result proves zero clinical-output drift. This file is
// a permanent addition to `npm test`, not a scaffolding step to be removed
// after the refactor completes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { assessPediatricAnemia } from '../src/engine.js';

const rules = JSON.parse(await readFile(new URL('../modules/anemia/rules.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(await readFile(new URL('../modules/anemia/candidates.json', import.meta.url), 'utf8'));

const examplesDir = new URL('../examples/', import.meta.url);
const exampleFiles = (await readdir(examplesDir)).filter((name) => name.endsWith('.json')).sort();

// Same scrub pattern as tests/engine.test.mjs's determinism test and
// scripts/capture-golden.mjs: strip the wall-clock timestamp so output
// captured at different moments still compares equal.
function scrub(result) {
  return { ...result, meta: { ...result.meta, generatedAt: 'x' } };
}

for (const filename of exampleFiles) {
  const name = filename.replace(/\.json$/, '');
  test(`module equivalence: ${name} matches golden fixture`, async () => {
    const input = JSON.parse(await readFile(new URL(filename, examplesDir), 'utf8'));
    const golden = JSON.parse(await readFile(new URL(`../tests/golden/${name}.json`, import.meta.url), 'utf8'));
    const result = scrub(assessPediatricAnemia(input, rules, candidates));
    assert.deepEqual(result, golden);
  });
}
