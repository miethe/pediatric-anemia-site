// tests/assessment-output-schema.test.mjs — FIX-D and FIX-F test coverage.
//
// Before this fix, nothing in this repo validated live assess() output — or even the committed
// golden fixtures — against schemas/assessment-output.schema.json at all; `sourcePassageId` and
// `sourcePassageStatus` on provenance.ruleAudit items were optional and `sourcePassageStatus`
// accepted any string (a document with `"clinically-approved-by-magic"` used to validate). This
// file proves the tightened contract — both fields REQUIRED, `sourcePassageStatus` constrained to
// the closed evidence-status enum plus null — actually holds for real engine output, not just in
// the schema text, and that the FIX-F additive governance fields are present and boolean.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { assessPediatricAnemia } from '../src/engine.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'assessment-output.schema.json');
const GOLDEN_DIR = path.join(REPO_ROOT, 'tests', 'golden');

let schema;

test('assessment-output.schema.json loads', async () => {
  schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
  assert.ok(schema.$defs.candidate, 'schema must define $defs/candidate');
});

test('every committed golden fixture validates against the tightened assessment-output.schema.json', async () => {
  const files = (await readdir(GOLDEN_DIR)).filter((name) => name.endsWith('.json'));
  assert.ok(files.length > 0, 'expected at least one golden fixture');
  for (const filename of files) {
    const fixture = JSON.parse(await readFile(path.join(GOLDEN_DIR, filename), 'utf8'));
    // scripts/capture-golden.mjs deliberately scrubs meta.generatedAt to the literal "x" so
    // fixtures compare stably regardless of capture time (tests/module-equivalence.test.mjs's
    // own scrub()); restore a real timestamp before schema validation so this test exercises the
    // fixture's actual content, not that unrelated scrubbing convention.
    fixture.meta = { ...fixture.meta, generatedAt: '2026-07-20T00:00:00.000Z' };
    const errors = validate(schema, fixture);
    assert.deepEqual(errors, [], `${filename} should validate cleanly: ${JSON.stringify(errors)}`);
  }
});

test('live assess() output for every ruleAudit entry carries required, correctly-typed sourcePassageId/sourcePassageStatus and the FIX-F governance booleans', async () => {
  const rules = JSON.parse(await readFile(path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json'), 'utf8'));
  const candidates = JSON.parse(await readFile(path.join(REPO_ROOT, 'modules', 'anemia', 'candidates.json'), 'utf8'));
  const input = JSON.parse(await readFile(path.join(REPO_ROOT, 'examples', 'ida-toddler.json'), 'utf8'));
  const result = assessPediatricAnemia(input, rules, candidates);

  const allowedStatuses = new Set(['source-supported', 'quarantined', 'implementation-proposal', null]);
  assert.equal(result.provenance.ruleAudit.length, 91);
  for (const entry of result.provenance.ruleAudit) {
    assert.ok(Object.hasOwn(entry, 'sourcePassageId'));
    assert.ok(Object.hasOwn(entry, 'sourcePassageStatus'));
    assert.ok(allowedStatuses.has(entry.sourcePassageStatus), `${entry.ruleId}: unexpected sourcePassageStatus "${entry.sourcePassageStatus}"`);
    assert.equal(typeof entry.hasCredentialedClinicalApproval, 'boolean', `${entry.ruleId}: hasCredentialedClinicalApproval must be boolean`);
    assert.equal(typeof entry.isActive, 'boolean', `${entry.ruleId}: isActive must be boolean`);
    assert.equal(entry.hasCredentialedClinicalApproval, false, `${entry.ruleId}: no rule has credentialed clinical approval today`);
    assert.equal(entry.isActive, true, `${entry.ruleId}: no rule is retired today`);
  }

  const errors = validate(schema, result);
  assert.deepEqual(errors, [], `live assess() output should validate cleanly: ${JSON.stringify(errors)}`);
});

test('the schema REJECTS a ruleAudit entry with an unconstrained/invalid sourcePassageStatus string (the FIX-D gap this closes)', () => {
  const tampered = {
    meta: { knowledgeBaseVersion: '0.1.0', generatedAt: '2026-07-20T00:00:00.000Z', status: 'x' },
    classification: {},
    alerts: [],
    rankedDifferential: [],
    nextQuestions: [],
    limitations: [],
    provenance: {
      evaluatedRuleCount: 1,
      matchedRuleIds: [],
      unitsAssumed: [],
      ruleAudit: [{
        ruleId: 'FAKE-001',
        matched: false,
        sourcePassageId: 'FAKE#implementation-proposal',
        sourcePassageStatus: 'clinically-approved-by-magic',
        hasCredentialedClinicalApproval: false,
        isActive: true,
      }],
    },
  };
  const errors = validate(schema, tampered);
  assert.ok(errors.length > 0, 'an invalid sourcePassageStatus string must be rejected');
});

test('the schema REJECTS a ruleAudit entry missing sourcePassageId/sourcePassageStatus entirely (both are now required)', () => {
  const base = {
    meta: { knowledgeBaseVersion: '0.1.0', generatedAt: '2026-07-20T00:00:00.000Z', status: 'x' },
    classification: {},
    alerts: [],
    rankedDifferential: [],
    nextQuestions: [],
    limitations: [],
    provenance: { evaluatedRuleCount: 1, matchedRuleIds: [], unitsAssumed: [], ruleAudit: [{ ruleId: 'FAKE-001', matched: false }] },
  };
  const errors = validate(schema, base);
  assert.ok(errors.some((e) => e.path.endsWith('sourcePassageId')), `expected a sourcePassageId error, got ${JSON.stringify(errors)}`);
  assert.ok(errors.some((e) => e.path.endsWith('sourcePassageStatus')), `expected a sourcePassageStatus error, got ${JSON.stringify(errors)}`);
});
