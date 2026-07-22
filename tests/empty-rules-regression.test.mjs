// tests/empty-rules-regression.test.mjs — P3-T4 (FR-15, phase-3-4-scaffolds-and-backfill.md).
//
// A module whose rules.json is a schema-valid empty array `[]` is a legitimate E1 state — this
// is exactly the shape modules/kidney_suite_v1/ and modules/growth_suite_v1/ ship with (P3-T1/
// P3-T2, unsigned-stub scaffolds carrying zero clinical logic) — and scripts/validate-kb.mjs's
// validateModule() must report it as VALID (zero errors), not as an error. There is no explicit
// "rules.length === 0 is illegal" guard anywhere in validateModule (confirmed by reading it: the
// `for (const rule of rules)` loop and `Object.entries(candidates)` loop both simply do not
// iterate when their input is empty, so they raise nothing), but this task's own acceptance
// criteria calls for a dedicated, explicit regression test — not just an inference from reading
// the code — so this file seeds a throwaway empty-rules module (mirroring
// tests/rule-schema-seeded-invalid.test.mjs's temp-module pattern) and proves it directly.
//
// Three layers of proof:
//   1. A synthetic throwaway module directory with rules.json: [] / candidates.json: {} (the
//      exact E1 empty-module shape) validates cleanly via validateModule() — the actual function
//      npm run validate calls per module — with zero errors, ruleCount 0, candidateCount 0.
//   2. The real, committed modules/kidney_suite_v1/ and modules/growth_suite_v1/ packages (both
//      genuinely empty-rules E1 scaffolds, not synthetic fixtures) validate cleanly the same way.
//   3. A non-empty rules.json is unaffected by this change — the empty-rules code path is
//      additive/no-op, not a general error-suppression shortcut (proven against the real,
//      non-empty modules/anemia/rules.json).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, cp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateModule } from '../scripts/validate-kb.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function seedEmptyRulesModule(tempRoot, moduleId) {
  await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
  for (const schemaFile of [
    'rule.schema.json', 'candidate.schema.json', 'evidence.schema.json', 'module-manifest.schema.json',
  ]) {
    await cp(path.join(REPO_ROOT, 'schemas', schemaFile), path.join(tempRoot, 'schemas', schemaFile));
  }

  const moduleDir = path.join(tempRoot, 'modules', moduleId);
  await mkdir(moduleDir, { recursive: true });

  // The E1 empty-module shape, per P3-T1/P3-T2's acceptance criteria: rules.json is a
  // schema-valid empty array, candidates.json a schema-valid empty object.
  await writeFile(path.join(moduleDir, 'rules.json'), JSON.stringify([], null, 2));
  await writeFile(path.join(moduleDir, 'candidates.json'), JSON.stringify({}, null, 2));
  await writeFile(
    path.join(moduleDir, 'evidence.json'),
    JSON.stringify({ knowledgeBaseVersion: '0.0.0-test', reviewedThrough: '2026-07-22', sources: [] }, null, 2),
  );

  // A real, valid manifest (kidney_suite_v1's own Phase 3 unsigned-stub shape, which already
  // carries the full module-variable envelope) with `id` renamed to match this temp module's
  // directory name — validateModule cross-checks that agreement and, for any non-'anemia'
  // moduleId, also requires the envelope fields to be present and non-empty.
  const manifest = JSON.parse(
    await readFile(path.join(REPO_ROOT, 'modules', 'kidney_suite_v1', 'module.json'), 'utf8'),
  );
  await writeFile(
    path.join(moduleDir, 'module.json'),
    JSON.stringify({ ...manifest, id: moduleId }, null, 2),
  );
}

test('validateModule() treats a schema-valid empty rules.json ([]) as VALID — zero errors — not a regression', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-empty-rules-'));
  const moduleId = 'synthetic_empty_rules_module';
  try {
    await seedEmptyRulesModule(tempRoot, moduleId);

    const result = await validateModule(moduleId, tempRoot);

    assert.deepEqual(
      result.errors, [],
      `validateModule() must report zero errors for a schema-valid empty rules.json: ${JSON.stringify(result.errors, null, 2)}`,
    );
    assert.equal(result.ruleCount, 0, 'ruleCount must be 0 for an empty rules.json');
    assert.equal(result.candidateCount, 0, 'candidateCount must be 0 for an empty candidates.json');
    // The resolved sourcePassageId status split must show zero of everything — not an implicit
    // "unresolved" or "missing" penalty for having no rules at all.
    assert.deepEqual(
      result.rulePassageStatusCounts,
      { 'source-supported': 0, quarantined: 0, 'implementation-proposal': 0, unresolved: 0 },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validateModule() validates the real, committed modules/kidney_suite_v1/ (empty rules.json) cleanly', async () => {
  const result = await validateModule('kidney_suite_v1', REPO_ROOT);
  assert.deepEqual(
    result.errors, [],
    `modules/kidney_suite_v1/ must validate with zero errors: ${JSON.stringify(result.errors, null, 2)}`,
  );
  assert.equal(result.ruleCount, 0, 'modules/kidney_suite_v1/rules.json must be the E1 empty-array scaffold state');
});

test('validateModule() validates the real, committed modules/growth_suite_v1/ (empty rules.json) cleanly', async () => {
  const result = await validateModule('growth_suite_v1', REPO_ROOT);
  assert.deepEqual(
    result.errors, [],
    `modules/growth_suite_v1/ must validate with zero errors: ${JSON.stringify(result.errors, null, 2)}`,
  );
  assert.equal(result.ruleCount, 0, 'modules/growth_suite_v1/rules.json must be the E1 empty-array scaffold state');
});

test('the empty-rules code path is a no-op, not general error suppression — the real, non-empty modules/anemia/rules.json (91 rules) still validates with its usual result shape', async () => {
  const result = await validateModule('anemia', REPO_ROOT);
  assert.deepEqual(result.errors, [], `modules/anemia/ must still validate with zero errors: ${JSON.stringify(result.errors, null, 2)}`);
  assert.equal(result.ruleCount, 91, 'modules/anemia/rules.json rule count must be unaffected by the empty-rules handling');
});
