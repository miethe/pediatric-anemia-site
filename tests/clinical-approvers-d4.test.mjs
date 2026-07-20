// tests/clinical-approvers-d4.test.mjs — EP4-T3 / decision D-4 / AC-D4.
//
// WHY THIS FILE EXISTS, STATED BLUNTLY:
//
// `clinicalApprovers[]` is the field that would, if populated, assert that a named credentialed
// human clinician has approved a rule in this knowledge base. No such approval exists. This
// repository is an UNVALIDATED RESEARCH PROTOTYPE (see CLAUDE.md). The realistic failure mode is
// not malice — it is a future automated pass deciding that some machine-produced review "counts":
// an ARC council run, a `council-review` verdict, an `rf` verification bundle, a model's own
// sign-off, a "reviewed by the pipeline" string. Every one of those is a SYNTHETIC review. None is
// credentialed clinical approval. Writing any of them into `clinicalApprovers[]` would convert an
// honest "nobody has approved this" into a false claim of clinical sign-off, in the one field a
// downstream consumer would most reasonably trust.
//
// So this is a STRUCTURAL guarantee, not documentation. It fails the build.
//
// This test asserts three distinct things, because emptiness alone is not enough:
//   (1) STATE     — `clinicalApprovers` is `[]` on every rule shipped today.
//   (2) MECHANISM — nothing in the generation path can populate it: the codemod that writes the
//                   governance fields never assigns a non-empty value, and never reads any
//                   council/ARC/rf/review artifact that could supply one.
//   (3) NON-VACUITY — the check above actually catches a violation. A test that passes because it
//                   checks nothing is worse than no test, so the detector is run against a
//                   deliberately poisoned copy and must reject it.
//
// (1) alone would pass forever while someone wires up an approver source. (2) alone would pass on
// an empty rules file. (3) is what stops this file from rotting into a no-op.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json');
const BACKFILL_PATH = path.join(REPO_ROOT, 'scripts', 'evidence', 'backfill-rule-governance.mjs');

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

/**
 * The detector, factored out so the non-vacuity test can run it against poisoned input.
 * Returns the ids of every rule whose `clinicalApprovers` is anything other than an empty array.
 */
export function rulesWithClinicalApprovers(rules) {
  const offenders = [];
  for (const rule of rules) {
    const value = rule.clinicalApprovers;
    if (!Array.isArray(value)) {
      offenders.push(`${rule.id} (clinicalApprovers is ${value === undefined ? 'absent' : JSON.stringify(value)}, not an array)`);
      continue;
    }
    if (value.length > 0) {
      offenders.push(`${rule.id} (clinicalApprovers = ${JSON.stringify(value)})`);
    }
  }
  return offenders;
}

// --- (1) STATE ------------------------------------------------------------------------------

test('AC-D4: clinicalApprovers is [] on every rule, and the failure names the offending rule ids', async () => {
  const rules = await readJson(RULES_PATH);
  assert.ok(rules.length > 0, 'rules.json is empty — this test would be vacuous');

  const offenders = rulesWithClinicalApprovers(rules);
  assert.deepEqual(
    offenders,
    [],
    'D-4 VIOLATION — clinicalApprovers[] is populated on the following rule(s), asserting a '
      + 'credentialed clinical approval that does not exist. No synthetic review (ARC council, '
      + 'council-review, rf verification, or model self-attestation) may populate this field; only '
      + 'a real named human clinician\'s attestation can, and none has been recorded.\n  '
      + offenders.join('\n  '),
  );
});

test('AC-D4: every rule carries clinicalApprovers as an explicit empty array, not by omission', async () => {
  const rules = await readJson(RULES_PATH);
  const missing = rules.filter((r) => !Object.prototype.hasOwnProperty.call(r, 'clinicalApprovers')).map((r) => r.id);
  assert.deepEqual(
    missing,
    [],
    `D-4 VIOLATION — clinicalApprovers is ABSENT (not empty) on: ${missing.join(', ')}. `
      + 'Absence is not the same claim as "[] = nobody has approved this"; an absent field invites a '
      + 'consumer to treat approval status as unknown rather than as explicitly not-granted.',
  );
});

// --- (2) MECHANISM --------------------------------------------------------------------------

test('AC-D4: the governance codemod cannot populate clinicalApprovers', async () => {
  const source = await readFile(BACKFILL_PATH, 'utf8');

  // Strip line and block comments so prose about the field (which is expected and good) cannot
  // trip the checks below — we care only about executable code.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');

  assert.ok(
    code.includes('clinicalApprovers'),
    'the codemod no longer mentions clinicalApprovers in code at all — it must set it explicitly to [], '
      + 'because silently dropping the field would let the schema-required key go missing.',
  );

  // Every executable assignment of clinicalApprovers must be to a literal empty array.
  const assignments = [...code.matchAll(/clinicalApprovers\s*[:=]\s*([^,\n}]+)/g)].map((m) => m[1].trim());
  assert.ok(assignments.length > 0, 'expected at least one clinicalApprovers assignment in the codemod');
  const nonEmpty = assignments.filter((rhs) => !/^\[\s*\]$/.test(rhs));
  assert.deepEqual(
    nonEmpty,
    [],
    `D-4 VIOLATION — the codemod assigns clinicalApprovers to something other than a literal []: ${JSON.stringify(nonEmpty)}. `
      + 'The only legal generated value is the empty array.',
  );
});

test('AC-D4: the governance codemod reads no review/council artifact that could supply an approver', async () => {
  const code = (await readFile(BACKFILL_PATH, 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');

  // Sources of SYNTHETIC review output in this program. None of them is credentialed clinical
  // approval, so none of them may become an input to the field that claims one.
  const forbiddenSources = [
    'arc-run', 'arc_run', 'council', 'findings.yaml', 'scorecard', 'decision_record',
    'approvedBy', 'approved_by', 'reviewers', 'attestation',
  ];
  const hits = forbiddenSources.filter((needle) => code.includes(needle));
  assert.deepEqual(
    hits,
    [],
    `D-4 VIOLATION — the governance codemod references synthetic-review artifact(s) ${JSON.stringify(hits)}. `
      + 'Council/ARC/rf output is a synthetic adversarial review; it is explicitly NOT a valid source '
      + 'for clinicalApprovers[] and must not be wired into the generation path.',
  );
});

// --- (3) NON-VACUITY ------------------------------------------------------------------------

test('AC-D4: the detector actually rejects a populated clinicalApprovers (this test is not vacuous)', async () => {
  const rules = await readJson(RULES_PATH);
  assert.ok(rules.length >= 2, 'need at least two rules to build a meaningful poisoned fixture');

  // Poison a deep copy in each of the ways a well-meaning future automation might.
  const poisonedCases = [
    ['a named human', ['Dr. A. Clinician, MD']],
    ['an ARC council run', ['arc-run-2026-07-19-pediatric-clinical-council']],
    ['a model self-attestation', ['reviewed-by-model']],
    ['a non-array truthy value', 'approved'],
  ];

  for (const [label, poison] of poisonedCases) {
    const copy = JSON.parse(JSON.stringify(rules));
    copy[0].clinicalApprovers = poison;
    const offenders = rulesWithClinicalApprovers(copy);
    assert.ok(
      offenders.length === 1 && offenders[0].startsWith(copy[0].id),
      `the D-4 detector failed to reject clinicalApprovers populated with ${label} — `
        + 'this test would have been vacuous.',
    );
  }

  // And the clean copy must still pass, so the detector is not simply always-failing.
  assert.deepEqual(rulesWithClinicalApprovers(JSON.parse(JSON.stringify(rules))), []);
});
