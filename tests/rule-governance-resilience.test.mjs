// tests/rule-governance-resilience.test.mjs — EP4-T4 / AC-WP4-RESIL.
//
// Asserts the asymmetry in src/governance.js: hard-required governance fields fail loudly when
// absent, while `retireDate: null` / `clinicalApprovers: []` / `requiredTestCaseIds: []` are normal
// values that must never be misread as "expired", "approved", or "exempt from testing".

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HARD_REQUIRED_FIELDS,
  missingRequiredGovernanceFields,
  isActive,
  clinicalApprovalStatus,
  hasCredentialedClinicalApproval,
  testLinkageStatus,
  governanceSummary,
} from '../src/governance.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json');

const loadRules = async () => JSON.parse(await readFile(RULES_PATH, 'utf8'));

// --- hard-required fields: absence is a failure, not a default -------------------------------

test('AC-WP4-RESIL: every shipped rule carries all hard-required governance fields', async () => {
  const rules = await loadRules();
  const offenders = rules
    .map((rule) => [rule.id, missingRequiredGovernanceFields(rule)])
    .filter(([, missing]) => missing.length > 0);
  assert.deepEqual(offenders, [], `rules missing hard-required governance fields: ${JSON.stringify(offenders)}`);
});

test('AC-WP4-RESIL: a missing hard-required field is reported, and governanceSummary throws rather than defaulting', async () => {
  const [rule] = await loadRules();
  for (const field of HARD_REQUIRED_FIELDS) {
    const broken = { ...rule, [field]: undefined };
    assert.deepEqual(missingRequiredGovernanceFields(broken), [field]);
    assert.throws(() => governanceSummary(broken), new RegExp(field),
      `governanceSummary must throw when ${field} is absent — a silent default would hide a governance defect`);
  }
  // null is treated the same as absent for these fields
  assert.deepEqual(missingRequiredGovernanceFields({ ...rule, owner: null }), ['owner']);
});

// --- retireDate: null means ACTIVE -----------------------------------------------------------

test('AC-WP4-RESIL: retireDate null means active, never unknown or expired', async () => {
  const rules = await loadRules();
  assert.ok(rules.every((r) => r.retireDate === null), 'fixture assumption: all shipped rules are active');
  assert.ok(rules.every((r) => isActive(r)), 'a null retireDate must read as ACTIVE');

  assert.equal(isActive({ retireDate: '2999-01-01' }), true, 'a future retireDate is still active');
  assert.equal(isActive({ retireDate: '2000-01-01' }), false, 'a past retireDate is retired');
  assert.equal(isActive({ retireDate: 'not-a-date' }), false,
    'an unparseable retireDate must FAIL CLOSED (treated as retired), not keep firing a rule whose lifecycle is unknown');
});

// --- clinicalApprovers: [] is NEVER "approved" -----------------------------------------------

test('AC-D4/AC-WP4-RESIL: empty clinicalApprovers reads as no-credentialed-approval, never as approved', async () => {
  const rules = await loadRules();
  for (const rule of rules) {
    assert.equal(clinicalApprovalStatus(rule), 'no-credentialed-approval', `${rule.id}`);
    assert.equal(hasCredentialedClinicalApproval(rule), false, `${rule.id}`);
  }
  // absent / malformed must also read as not-approved, never as approved-by-default
  assert.equal(clinicalApprovalStatus({}), 'no-credentialed-approval');
  assert.equal(clinicalApprovalStatus({ clinicalApprovers: null }), 'no-credentialed-approval');
  assert.equal(clinicalApprovalStatus({ clinicalApprovers: 'approved' }), 'no-credentialed-approval',
    'a non-array truthy value must not be read as approval');
});

test('AC-WP4-RESIL: clinicalApprovalStatus returns a string, so `if (approved)` cannot silently pass on []', async () => {
  const [rule] = await loadRules();
  const status = clinicalApprovalStatus(rule);
  assert.equal(typeof status, 'string');
  // The guard against the classic bug: a truthy status string forces callers to compare explicitly
  // rather than rely on falsiness, and hasCredentialedClinicalApproval is the only boolean surface.
  assert.ok(status.length > 0);
  assert.equal(hasCredentialedClinicalApproval(rule), false);
});

// --- requiredTestCaseIds: [] is NEVER "exempt from testing" ----------------------------------

test('AC-WP4-RESIL: empty requiredTestCaseIds reads as no-test-linkage, never as exempt', async () => {
  const rules = await loadRules();
  for (const rule of rules) {
    assert.equal(testLinkageStatus(rule), rule.requiredTestCaseIds.length > 0 ? 'linked' : 'no-test-linkage', `${rule.id}`);
  }
  assert.equal(testLinkageStatus({}), 'no-test-linkage');
  assert.equal(testLinkageStatus({ requiredTestCaseIds: [] }), 'no-test-linkage');
  assert.equal(testLinkageStatus({ requiredTestCaseIds: ['tests/witness/corpus/x.json'] }), 'linked');
});

test('AC-WP4-RESIL: no API exposes an "exempt from testing" state', async () => {
  const source = await readFile(path.join(REPO_ROOT, 'src', 'governance.js'), 'utf8');
  const code = source.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.ok(!/export\s+function\s+\w*[Ee]xempt/.test(code),
    'governance.js must not expose an exemption predicate — no such state exists');
});

// --- the composed summary --------------------------------------------------------------------

test('AC-WP4-RESIL: governanceSummary is honest on every shipped rule', async () => {
  const rules = await loadRules();
  for (const rule of rules) {
    const summary = governanceSummary(rule);
    assert.equal(summary.active, true, `${rule.id}`);
    assert.equal(summary.clinicalApproval, 'no-credentialed-approval', `${rule.id}`);
    assert.ok(summary.sourcePassageId, `${rule.id}: sourcePassageId must be present and non-empty`);
    assert.ok(['safety-critical', 'diagnostic', 'informational'].includes(summary.safetyClass), `${rule.id}`);
  }
});
