// tests/rule-governance.test.mjs — EP-4 (EP4-T1/EP4-T2) test coverage.
//
// Guards the invariants EP-4 asked for: all 91 rules carry the 9 governance fields and validate
// against the extended schemas/rule.schema.json; `retireDate: null` is schema-legal; a rule
// missing a required governance field is rejected; and `scripts/evidence/backfill-rule-
// governance.mjs --check` exits 0 against the committed modules/anemia/rules.json (the
// determinism/re-runnability guarantee, mirroring tests/evidence-passages.test.mjs's `build-
// evidence-pack --check` coverage for EP-3).
//
// A dedicated `clinicalApprovers` structural safety test is EP4-T3 (written separately) — this
// file does not duplicate it, but the fixtures below never populate `clinicalApprovers` either, so
// it cannot regress that guarantee by omission.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'rule.schema.json');
const BACKFILL_SCRIPT = path.join(REPO_ROOT, 'scripts', 'evidence', 'backfill-rule-governance.mjs');

const GOVERNANCE_FIELDS = [
  'version', 'effectiveDate', 'retireDate', 'owner', 'safetyClass',
  'requiredTestCaseIds', 'changeRationale', 'sourcePassageId', 'clinicalApprovers',
];

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

let rules;
let schema;

test('rules.json and rule.schema.json load', async () => {
  rules = await loadJson(RULES_PATH);
  schema = await loadJson(SCHEMA_PATH);
  assert.equal(rules.length, 91, 'EP-4 governs a fixed 91-rule KB');
});

test('all 91 rules validate against the extended rule.schema.json', () => {
  for (const rule of rules) {
    const errors = validate(schema, rule);
    assert.deepEqual(errors, [], `${rule.id} should validate cleanly: ${JSON.stringify(errors)}`);
  }
});

test('all 9 governance fields are present (as keys) on all 91 rules', () => {
  for (const rule of rules) {
    for (const field of GOVERNANCE_FIELDS) {
      assert.ok(Object.hasOwn(rule, field), `${rule.id} is missing governance field "${field}"`);
    }
  }
});

test('retireDate is null on every rule, and null is schema-legal', () => {
  for (const rule of rules) {
    assert.equal(rule.retireDate, null, `${rule.id}: no rule is retired by the EP-4 backfill`);
  }
  const sample = { ...rules[0], retireDate: null };
  assert.deepEqual(validate(schema, sample), []);
});

test('clinicalApprovers is [] and requiredTestCaseIds is an array on every rule', () => {
  for (const rule of rules) {
    assert.deepEqual(rule.clinicalApprovers, [], `${rule.id}: clinicalApprovers must ship empty`);
    assert.ok(Array.isArray(rule.requiredTestCaseIds), `${rule.id}: requiredTestCaseIds must be an array`);
  }
});

test('sourcePassageId is present, non-null, and resolves to a source-supported or implementation-proposal shape on every rule', () => {
  for (const rule of rules) {
    assert.ok(typeof rule.sourcePassageId === 'string' && rule.sourcePassageId.length > 0, `${rule.id}: sourcePassageId must be a non-empty string post-backfill`);
    assert.match(rule.sourcePassageId, /^[A-Z0-9_]+#(ev_[0-9]{3}|implementation-proposal)$/);
  }
});

test('safetyClass is always one of the closed enum values', () => {
  const allowed = new Set(['safety-critical', 'diagnostic', 'informational']);
  for (const rule of rules) {
    assert.ok(allowed.has(rule.safetyClass), `${rule.id}: unexpected safetyClass "${rule.safetyClass}"`);
  }
});

test('owner is a role/team string on every rule, never a bare name', () => {
  for (const rule of rules) {
    assert.match(rule.owner, /^(role|team):[a-z][a-z0-9-]*$/, `${rule.id}: owner "${rule.owner}" must be a role/team string`);
  }
});

test('a rule missing a required governance field is rejected', () => {
  for (const field of GOVERNANCE_FIELDS) {
    const broken = { ...rules[0] };
    delete broken[field];
    const errors = validate(schema, broken);
    assert.ok(errors.length > 0, `omitting "${field}" should fail validation`);
    assert.ok(
      errors.some((error) => error.path === `$.${field}`),
      `omitting "${field}" should report an error at $.${field}, got ${JSON.stringify(errors)}`,
    );
  }
});

test('a rule missing the pre-existing base fields (id/category/when/evidence/output) is still rejected', () => {
  for (const field of ['id', 'category', 'when', 'evidence', 'output']) {
    const broken = { ...rules[0] };
    delete broken[field];
    const errors = validate(schema, broken);
    assert.ok(errors.length > 0, `omitting "${field}" should still fail validation under the extended schema`);
  }
});

test('backfill-rule-governance.mjs --check exits 0 against the committed rules.json', () => {
  const result = spawnSync(process.execPath, [BACKFILL_SCRIPT, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, `--check should exit 0: stdout=${result.stdout} stderr=${result.stderr}`);
  assert.match(result.stdout, /matches regenerated output/);
});
