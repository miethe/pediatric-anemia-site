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

import { MODULE_IDS, DEFAULT_MODULE_ID } from '../src/modules/registry.js';

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

  if (!Array.isArray(rules)) {
    errors.push(`${moduleId}: built rules.json is not an array`);
    continue;
  }

  // evidence-foundry-buildout P1-T3 (in-flight finding): a registered module other than
  // DEFAULT_MODULE_ID may legitimately ship ZERO rules — e.g. `cbc_suite_v1`, an E0 scaffold
  // populated in Phase 4, not yet. That is a real, disclosed "nothing to check yet" state, not
  // vacuity, AS LONG AS this gate still checks a non-zero number of rules SOMEWHERE overall (the
  // `checkedRules > 0` assertion after the loop) — DEFAULT_MODULE_ID is guaranteed non-empty
  // below, so the overall guarantee this gate exists for can never be silently satisfied by zero
  // real checks. Only DEFAULT_MODULE_ID itself being empty is still treated as this gate going
  // vacuous, because that IS the module actually shipped.
  if (rules.length === 0) {
    if (moduleId === DEFAULT_MODULE_ID) {
      errors.push(`${moduleId}: built rules.json is empty — this gate would be vacuous for the served module`);
      continue;
    }
    console.log(`${moduleId}: built rules.json is empty (not yet populated) — 0 rules checked, skipped, not an error.`);
    checkedModules += 1;
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

// Overall non-vacuity guarantee: at least one rule was actually checked SOMEWHERE across all
// registered modules. Per-module zero-rule scaffolds are tolerated above precisely because this
// still holds (DEFAULT_MODULE_ID always carries real rules) — if it ever stopped holding, this
// gate would have silently become a no-op, which is exactly the failure mode this file exists to
// prevent.
if (checkedRules === 0) {
  errors.push('no rules were checked across ANY registered module — this gate would be entirely vacuous');
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
