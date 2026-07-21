#!/usr/bin/env node
// scripts/verify-d4-built.mjs — D-4 post-build gate.
//
// WHY THIS EXISTS (reviewer gate 2026-07-21, finding 4, second pass):
// `npm run check` runs `npm test` BEFORE `npm run build`. The D-4 test's built-artifact case
// therefore inspects whatever `dist/` happened to be lying around — and skips entirely on a clean
// checkout. A transform inside `scripts/build-static.mjs` could populate `clinicalApprovers` in the
// built knowledge base after the only D-4 check had already run and passed.
//
// This script closes that ordering hole by running AFTER the build, over the artifacts the build
// actually produced. It is deliberately standalone rather than a node:test file, so it cannot be
// reordered by the test runner and cannot silently skip.
//
// It fails CLOSED: a missing build output is an error, not a pass.

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODULE_IDS } from '../src/modules/registry.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = async (p) => access(p).then(() => true, () => false);

const errors = [];
let checkedModules = 0;
let checkedRules = 0;

for (const moduleId of MODULE_IDS) {
  const builtPath = path.join(REPO_ROOT, 'dist', 'modules', moduleId, 'rules.json');

  if (!(await exists(builtPath))) {
    errors.push(
      `${moduleId}: built rules.json is MISSING at dist/modules/${moduleId}/rules.json. `
      + 'This gate runs after `npm run build` and fails closed — a missing artifact is not a pass.',
    );
    continue;
  }

  let rules;
  try {
    rules = JSON.parse(await readFile(builtPath, 'utf8'));
  } catch (error) {
    errors.push(`${moduleId}: built rules.json is unparseable: ${error.message}`);
    continue;
  }

  if (!Array.isArray(rules) || rules.length === 0) {
    errors.push(`${moduleId}: built rules.json is empty or not an array — this gate would be vacuous`);
    continue;
  }

  for (const rule of rules) {
    checkedRules += 1;
    const value = rule?.clinicalApprovers;
    if (!Array.isArray(value)) {
      errors.push(`${moduleId}/${rule?.id ?? '<no id>'}: built clinicalApprovers is not an array (${JSON.stringify(value)})`);
    } else if (value.length > 0) {
      errors.push(`${moduleId}/${rule.id}: built clinicalApprovers is POPULATED (${JSON.stringify(value)})`);
    }
  }
  checkedModules += 1;
}

if (errors.length > 0) {
  console.error('== verify-d4-built: D-4 VIOLATION IN BUILT ARTIFACTS ==');
  console.error(
    'The shipped knowledge base claims credentialed clinical approval that does not exist, or could '
    + 'not be verified. No synthetic review may populate clinicalApprovers[].',
  );
  for (const error of errors) console.error(`  - ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `verify-d4-built: OK — clinicalApprovers[] is empty on all ${checkedRules} built rule(s) across `
    + `${checkedModules} module(s). Checked AFTER the build, so a build-time transform cannot slip past.`,
  );
}
