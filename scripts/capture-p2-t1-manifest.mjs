// scripts/capture-p2-t1-manifest.mjs — one-time capture of the pre-Phase-2 `cbc_suite_v1`
// `propose` byte-identity baseline (multi-bundle-conversion-e1-finish, P2-T1).
//
// Run BEFORE any Phase 2 code change (module-generic registry refactor). Writes the committed
// fixture at tests/fixtures/p2-t1-cbc-propose-manifest.json.txt that this phase's byte-identity
// regression tests (P2-T4, and this task's own smoke test) load and compare fresh `propose` runs
// against — this is the regression anchor for the entire multi-bundle-conversion-e1-finish plan
// (a `cbc_suite_v1` output drift is a clinical-content change, not a build break).
//
// Captures exactly the 9 files this task's own acceptance criteria enumerate — NOT the 10th file
// (`semantic-diff.json`) `propose` also emits; that file is deliberately out of this manifest's
// scope per this task's own binding file list.
//
// Output filename is deliberately `.json.txt`, not `.json`: scripts/evidence/
// backfill-rule-governance.mjs sweeps every `*.json` under tests/fixtures/ (via
// scripts/rule-coverage.mjs computeCoverage, fixtureDirs: ['tests/witness', 'tests/fixtures']) and
// runs each through assessPediatricAnemia() to regenerate rules' requiredTestCaseIds coverage. This
// manifest fixture is not a patient-intake payload, so a plain-`.json` name here perturbed that
// regeneration and diverged from the committed modules/anemia/rules.json (tests/rule-governance.
// test.mjs's `--check` subtest failed) — the exact mitigation tests/fixtures/p4-t1-pre-merge-
// snapshot.json.txt and tests/fixtures/rf-cbc-001/passage-hash-ledger.json.txt already apply for
// the same reason. Content is still plain JSON — readers use readFile + JSON.parse.
//
// This script is NOT part of `npm run check` and is not meant to be re-run casually: the
// committed fixture IS the frozen baseline. Only re-run it (deliberately, with review) from a
// clean, pre-Phase-2 checkout if the baseline itself must be re-established.
//
// Reusable capture logic lives in scripts/lib/p2-t1-manifest.mjs (mirrors scripts/lib/
// p4-t1-snapshot.mjs's own split) so tests/ef-p2-t1-manifest-smoke.test.mjs can import it without
// triggering this file's own write-to-disk side effect.
//
// Usage:
//   node scripts/capture-p2-t1-manifest.mjs [outputPath]

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { capturePropose, REPO_ROOT } from './lib/p2-t1-manifest.mjs';

const outPath = path.resolve(
  process.argv[2] ?? path.join(REPO_ROOT, 'tests/fixtures/p2-t1-cbc-propose-manifest.json.txt'),
);

const files = await capturePropose();
if (files.length !== 9) {
  throw new Error(`expected exactly 9 file-hash entries, got ${files.length}`);
}

const fixture = {
  $schema: 'p2-t1-cbc-propose-manifest@1',
  taskId: 'P2-T1',
  planPath:
    'docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish/' +
    'phase-2-3-genericity-decisions-authoring.md',
  purpose:
    'Pre-Phase-2 SHA-256 byte-identity baseline for cbc_suite_v1\'s `propose` output, captured ' +
    'against the current, post-Phase-1, pre-Phase-2 code (commit a8762c4) BEFORE the ' +
    'RULE_PROPOSAL_REGISTRY/CANDIDATE_REGISTRY genericity refactor (P2-T3/P2-T7). ' +
    'tests/ef-cbc-byte-identity-regression.test.mjs (P2-T4) re-runs propose after that refactor ' +
    'lands and asserts every one of these 9 files still matches, byte-for-byte -- a drift here is ' +
    'a clinical-content change, not a build break. Regenerate only from a clean pre-Phase-2 ' +
    'checkout, only with review -- this fixture IS the frozen baseline, not a live derivation.',
  moduleId: 'cbc_suite_v1',
  fixtureRunDir: 'tests/fixtures/rf-cbc-001',
  modulePath: 'modules/cbc_suite_v1/module.json',
  decisionsPath: 'modules/cbc_suite_v1/authoring-decisions.yaml',
  files,
};

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(fixture, null, 2)}\n`);

console.log(`Wrote P2-T1 cbc_suite_v1 propose manifest to ${path.relative(REPO_ROOT, outPath) || outPath}`);
for (const { filename, sha256 } of files) {
  console.log(`  ${filename}: sha256:${sha256}`);
}
