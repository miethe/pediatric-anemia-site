// tests/rule-schema-seeded-invalid.test.mjs — P1-T5 (evidence-foundry-buildout Phase 1, FR-3).
//
// scripts/validate-kb.mjs already runs real JSON Schema (draft 2020-12) validation of every
// module's rules.json against schemas/rule.schema.json (see validateModule's `for (const
// schemaError of validate(ruleSchema, rule))` loop) — that machinery predates this task. What
// this task adds is the missing proof: a committed, intentionally-invalid rule fixture
// (tests/fixtures/invalid-rule/SYNTHETIC-INVALID-EXTRA-PROP-001.json, an otherwise schema-legal
// rule with one illegal extra top-level property) and an executable assertion that
// `npm run validate`'s own code path — `validateModule`, imported directly rather than shelled
// out to, exactly as tests/candidate-governance.test.mjs and tests/module-manifest-schema.test.mjs
// already do for their own schemas — actually fails closed on it, with a specific
// additionalProperties message naming the offending field, not a generic crash.
//
// Three layers of proof:
//   1. The fixture violates schemas/rule.schema.json's `additionalProperties: false` in exactly
//      one way (isolates the defect: nothing else about the fixture is invalid).
//   2. validateModule(), run against a throwaway temp module directory seeded with the fixture
//      as its only rule, reports that specific schema error — i.e. the actual function
//      scripts/validate-kb.mjs's CLI entrypoint calls per module (`MODULE_IDS.map((moduleId) =>
//      validateModule(moduleId, root))`) rejects this KB, not merely the standalone schema
//      validator.
//   3. The real, committed KBs (modules/anemia's 91 rules, modules/cbc_suite_v1's empty
//      rules.json) still validate cleanly — the schema gate has no false positives on shipped
//      content.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { validateModule } from '../scripts/validate-kb.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULE_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'rule.schema.json');
const FIXTURE_PATH = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'invalid-rule', 'SYNTHETIC-INVALID-EXTRA-PROP-001.json',
);

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

test('seeded-bad rule fixture violates rule.schema.json in exactly one way (additionalProperties)', async () => {
  const schema = await loadJson(RULE_SCHEMA_PATH);
  const badRule = await loadJson(FIXTURE_PATH);

  assert.ok(
    Object.hasOwn(badRule, 'notAllowedExtraField'),
    'fixture must carry the seeded extra property this test targets',
  );

  const errors = validate(schema, badRule);
  assert.deepEqual(
    errors,
    [{ path: '$.notAllowedExtraField', message: 'additional property is not permitted' }],
    `expected exactly one additionalProperties violation, got: ${JSON.stringify(errors)}`,
  );
});

test('all 91 committed modules/anemia rules still validate cleanly against rule.schema.json', async () => {
  const schema = await loadJson(RULE_SCHEMA_PATH);
  const rules = await loadJson(path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json'));
  assert.equal(rules.length, 91);
  for (const rule of rules) {
    assert.deepEqual(validate(schema, rule), [], `${rule.id} should validate cleanly`);
  }
});

test('the empty modules/cbc_suite_v1/rules.json still validates (vacuously) against rule.schema.json', async () => {
  const rules = await loadJson(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'rules.json'));
  assert.deepEqual(rules, [], 'cbc_suite_v1 ships an empty-but-valid rules.json in Phase 1 (P1-T3)');
});

test('validateModule() — the exact function npm run validate calls per module — fails closed on the seeded-bad KB with a specific rule.schema.json message', async () => {
  // Build a throwaway module tree outside modules/ (never touch the real, read-only
  // modules/anemia/ or modules/cbc_suite_v1/ trees) that mirrors validateModule's expected
  // on-disk shape: rootDir/schemas/*.schema.json + rootDir/modules/<id>/{rules,candidates,
  // evidence,module}.json. This exercises validateModule's real disk-reading code path, not a
  // re-implementation of it.
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-seeded-bad-kb-'));
  const moduleId = 'synthetic_seeded_bad_kb';
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    for (const schemaFile of [
      'rule.schema.json', 'candidate.schema.json', 'evidence.schema.json', 'module-manifest.schema.json',
    ]) {
      await cp(path.join(REPO_ROOT, 'schemas', schemaFile), path.join(tempRoot, 'schemas', schemaFile));
    }

    const moduleDir = path.join(tempRoot, 'modules', moduleId);
    await mkdir(moduleDir, { recursive: true });

    const badRule = await loadJson(FIXTURE_PATH);
    await writeFile(path.join(moduleDir, 'rules.json'), JSON.stringify([badRule], null, 2));
    await writeFile(path.join(moduleDir, 'candidates.json'), JSON.stringify({}, null, 2));
    await writeFile(
      path.join(moduleDir, 'evidence.json'),
      JSON.stringify({ knowledgeBaseVersion: '0.0.0-test', reviewedThrough: '2026-07-21', sources: [] }, null, 2),
    );
    // A real, valid manifest (cbc_suite_v1's Phase 1 unsigned-stub shape) with `id` renamed to
    // match this temp module's directory name — validateModule cross-checks that agreement.
    const manifest = await loadJson(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json'));
    await writeFile(
      path.join(moduleDir, 'module.json'),
      JSON.stringify({ ...manifest, id: moduleId }, null, 2),
    );

    const result = await validateModule(moduleId, tempRoot);

    assert.ok(result.errors.length > 0, 'validateModule must report errors on the seeded-bad KB');
    assert.ok(
      result.errors.some(
        (e) => e.includes('rule.schema.json') && e.includes('$.notAllowedExtraField') && e.includes('additional property is not permitted'),
      ),
      `expected a specific rule.schema.json additionalProperties error, got: ${JSON.stringify(result.errors, null, 2)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
