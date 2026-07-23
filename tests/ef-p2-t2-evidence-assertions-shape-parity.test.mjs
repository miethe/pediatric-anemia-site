// tests/ef-p2-t2-evidence-assertions-shape-parity.test.mjs — P2-T2 front-loaded spike-let
// (multi-bundle-conversion-e1-finish, Phase 2),
// phase-2-3-genericity-decisions-authoring.md row P2-T2.
//
// SPIKE-009 verified `anemia`'s evidence-assertions.json in depth (35 real evas_anemia_* records)
// but only spot-checked kidney_suite_v1 (73 assertions) and growth_suite_v1 (79 assertions) for
// shape parity. Before committing to the full Phase 3 authoring effort (~5-8 pts of hand-authored
// decisions-file content per module), this test parses all 3 modules' evidence-assertions.json and
// asserts every assertion record carries the same required-field shape anemia's own records
// already have (`assertionId`, `rfClaimId`, `rfSourceCardId`, `exactPassageSha256`), and that at
// least one real, resolvable `evas_*` id exists per module for Phase 3's authoring to bind against.
//
// This task's own AC: if any module's assertions are found shape-deficient, this test's own output
// must be a NAMED list of the specific deficiencies (not a silent pass) -- feeding directly into
// Phase 3's authoring task estimates rather than being discovered mid-Phase-3.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The 3 modules this plan's Phase 3 will author authoring-decisions.yaml for (anemia already has
// SPIKE-009's own deep verification; kidney_suite_v1/growth_suite_v1 are this spike-let's real
// subject). cbc_suite_v1 is excluded -- its own authoring-decisions.yaml already exists (P3-T1..T6,
// evidence-foundry-buildout), it is not a Phase 3 (multi-bundle-conversion-e1-finish) authoring
// target.
const MODULES = ['anemia', 'kidney_suite_v1', 'growth_suite_v1'];

// The required-field shape anemia's own evidence-assertions.json records already carry
// (SPIKE-009's deep-verified baseline) -- every module's every assertion record must carry all of
// these, non-null/non-empty for the id-shaped fields.
const REQUIRED_FIELDS = ['assertionId', 'rfClaimId', 'rfSourceCardId', 'exactPassageSha256'];

async function loadAssertions(moduleId) {
  const filePath = path.join(REPO_ROOT, 'modules', moduleId, 'evidence-assertions.json');
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return { filePath, doc: parsed, assertions: parsed?.assertions ?? [] };
}

test('P2-T2: all 3 modules\' evidence-assertions.json share anemia\'s own required-field shape', async () => {
  const deficiencies = [];
  const perModuleCounts = {};

  for (const moduleId of MODULES) {
    const { filePath, assertions } = await loadAssertions(moduleId);
    perModuleCounts[moduleId] = assertions.length;

    if (!Array.isArray(assertions) || assertions.length === 0) {
      deficiencies.push({ moduleId, filePath, issue: 'no assertions[] array or it is empty' });
      continue;
    }

    assertions.forEach((assertion, index) => {
      for (const field of REQUIRED_FIELDS) {
        const value = assertion?.[field];
        const isPresent = typeof value === 'string' ? value.length > 0 : value !== undefined && value !== null;
        if (!isPresent) {
          deficiencies.push({
            moduleId,
            filePath,
            issue: `assertion[${index}] (assertionId=${JSON.stringify(assertion?.assertionId ?? null)}) is missing/empty required field "${field}"`,
          });
        }
      }
    });
  }

  assert.deepEqual(
    deficiencies,
    [],
    `named shape deficiencies (feed directly into Phase 3 authoring estimates, not discovered mid-Phase-3): ${JSON.stringify(deficiencies, null, 2)}`,
  );

  // Sanity: this spike-let is non-vacuous -- all 3 modules really do have real assertion counts,
  // matching the plan's own cited figures (anemia 35, kidney 73, growth 79).
  assert.equal(perModuleCounts.anemia, 35);
  assert.equal(perModuleCounts.kidney_suite_v1, 73);
  assert.equal(perModuleCounts.growth_suite_v1, 79);
});

test('P2-T2: each of the 3 modules has at least one real, resolvable evas_* id suitable for Phase 3 authoring to bind against', async () => {
  const missing = [];
  for (const moduleId of MODULES) {
    const { assertions } = await loadAssertions(moduleId);
    const resolvableIds = assertions
      .map((a) => a?.assertionId)
      .filter((id) => typeof id === 'string' && id.startsWith('evas_') && id.length > 'evas_'.length);
    if (resolvableIds.length === 0) {
      missing.push(moduleId);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `every module must have at least one real evas_* assertionId; modules with none: ${JSON.stringify(missing)}`,
  );
});
