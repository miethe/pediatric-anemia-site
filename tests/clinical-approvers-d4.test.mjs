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
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODULE_IDS } from '../src/modules/registry.js';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json');
const BACKFILL_PATH = path.join(REPO_ROOT, 'scripts', 'evidence', 'backfill-rule-governance.mjs');

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const exists = async (p) => access(p).then(() => true, () => false);

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

// --- (1b) STATE, ACROSS EVERY MODULE AND EVERY PRODUCED ARTIFACT ------------------------------
//
// Added per reviewer-gate finding 4 (2026-07-21). The original version of this file read exactly
// one source file, so the guarantee was defeatable by a second module, or by a build/runtime
// transform that populated `clinicalApprovers` on the way to `dist/` while the tracked source JSON
// stayed clean. Both holes are closed below.

test('AC-D4: clinicalApprovers is [] in EVERY registered module, not just anemia', async () => {
  assert.ok(MODULE_IDS.length > 0, 'no registered modules — this test would be vacuous');
  for (const moduleId of MODULE_IDS) {
    const rulesPath = path.join(REPO_ROOT, 'modules', moduleId, 'rules.json');
    assert.ok(await exists(rulesPath), `${moduleId}: rules.json not found at ${rulesPath}`);
    const offenders = rulesWithClinicalApprovers(await readJson(rulesPath));
    assert.deepEqual(offenders, [], `D-4 VIOLATION in module '${moduleId}':\n  ${offenders.join('\n  ')}`);
  }
});

// NOTE — there is deliberately NO built-artifact case in this file (removed 2026-07-21).
// `npm test` runs BEFORE `npm run build`, so any dist/ present here is from a PREVIOUS build. An
// in-test dist check therefore validates a stale artifact: it passed in a worktree whose dist/ had
// just been rebuilt, and failed on a clean checkout carrying a pre-EP-4 dist/ — order-dependent in
// both directions, which makes it worse than no check.
//
// The authoritative built-artifact gate is `scripts/verify-d4-built.mjs`, run by `npm run verify:d4`
// AFTER `npm run build` in the check chain, where the artifact is guaranteed current. It fails
// closed on a missing or poisoned build. The test below asserts that ordering, which is the part
// this file can honestly verify.

test('AC-D4: the schema itself forbids a populated clinicalApprovers (maxItems: 0)', async () => {
  const schema = await readJson(path.join(REPO_ROOT, 'schemas', 'rule.schema.json'));
  assert.equal(schema.properties.clinicalApprovers.maxItems, 0,
    'rule.schema.json must pin clinicalApprovers to maxItems: 0 so a populated list is a hard schema '
    + 'violation, not merely a test failure. Raising this is how the project would first claim '
    + 'clinical sign-off — it must never be done to make a build pass.');

  const [rule] = await readJson(RULES_PATH);
  const poisoned = { ...rule, clinicalApprovers: ['Dr. A. Clinician, MD'] };
  const errors = validate(schema, poisoned);
  assert.ok(errors.length > 0,
    'the schema accepted a populated clinicalApprovers — maxItems: 0 is not being enforced by the validator');
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

// --- (4) RUNTIME + BUILD-ORDER ENFORCEMENT ---------------------------------------------------
//
// Added per reviewer-gate finding 4, SECOND pass (2026-07-21). The file-level checks above were
// still defeatable three ways, all three demonstrated by the reviewer:
//   (a) an in-memory transform populating clinicalApprovers on the rules array passed to the engine,
//       after every file check had already passed;
//   (b) `npm run check` runs tests BEFORE the build, so a transform in build-static.mjs could
//       populate dist/ after the only D-4 test had run (and the dist case skips when dist/ is absent);
//   (c) a module registered in REGISTRY but omitted from the hand-maintained MODULE_IDS literal.
// Each is now closed structurally, and each closure is asserted here.

test('AC-D4: the ENGINE refuses to evaluate rules that claim clinical approval (runtime bypass closed)', async () => {
  const { assess } = await import('../src/engine.js');
  const rules = await readJson(RULES_PATH);
  const candidates = await readJson(path.join(REPO_ROOT, 'modules', 'anemia', 'candidates.json'));
  const input = { patient: { ageMonths: 24, sex: 'female' }, cbc: { hemoglobin: 9.5, hemoglobinUnit: 'g/dL' } };

  // Baseline: the clean KB evaluates fine, so the assertion below is not passing for the wrong reason.
  assert.doesNotThrow(() => assess(input, 'anemia', rules, candidates));

  // The reviewer's exact bypass: an in-memory transform, never touching any file on disk.
  const poisoned = rules.map((rule) => ({ ...rule, clinicalApprovers: ['arc-run-synthetic-review'] }));
  assert.throws(() => assess(input, 'anemia', poisoned, candidates), /D-4 VIOLATION/,
    'the engine must refuse to evaluate rules claiming clinical approval — a static file check alone '
    + 'is defeatable by any in-memory transform');

  // A single poisoned rule among 90 clean ones must also be caught.
  const oneBad = rules.map((rule, i) => (i === 0 ? { ...rule, clinicalApprovers: ['Dr. X'] } : rule));
  assert.throws(() => assess(input, 'anemia', oneBad, candidates), /D-4 VIOLATION/);
});

test('AC-D4: the post-build gate exists and is wired AFTER the build in npm run check', async () => {
  const pkg = await readJson(path.join(REPO_ROOT, 'package.json'));
  const check = pkg.scripts.check;
  assert.ok(pkg.scripts['verify:d4'], 'package.json must define a verify:d4 script');
  assert.ok(check.includes('verify:d4'), 'npm run check must run the post-build D-4 gate');
  assert.ok(check.indexOf('npm run build') < check.indexOf('verify:d4'),
    'verify:d4 must run AFTER npm run build, or a build-time transform slips past it');
  assert.ok(await exists(path.join(REPO_ROOT, 'scripts', 'verify-d4-built.mjs')));
});

test('AC-D4: MODULE_IDS is derived from the registry, so a module cannot hide from D-4', async () => {
  const registrySource = await readFile(path.join(REPO_ROOT, 'src', 'modules', 'registry.js'), 'utf8');
  assert.ok(/MODULE_IDS\s*=\s*Object\.freeze\(\[\.\.\.REGISTRY\.keys\(\)\]\)/.test(registrySource),
    'MODULE_IDS must be derived from REGISTRY.keys(), not restated as a literal — a hand-maintained '
    + 'list can omit a registered module and hide it from every MODULE_IDS-driven safety gate');
  const { listModules } = await import('../src/modules/registry.js');
  assert.equal(MODULE_IDS.length, listModules().length, 'MODULE_IDS and REGISTRY have diverged');
});
