// scripts/capture-p4-t1-snapshot.mjs — one-time capture of the Phase 4 pre-merge baseline
// (multi-bundle-conversion-e1, P4-T1).
//
// Run BEFORE any `propose` run in Phase 4 (RF-EV-001 -> modules/anemia/, RF-CBC-002 ->
// modules/cbc_suite_v1/). Writes the committed fixture at tests/fixtures/p4-t1-pre-merge-
// snapshot.json.txt that this phase's seam tasks (P4-T4, P4-T7) load and compare the post-merge
// state against — see scripts/lib/p4-t1-snapshot.mjs for what gets hashed and why.
//
// Output filename is deliberately `.json.txt`, not `.json`: scripts/evidence/
// backfill-rule-governance.mjs sweeps every `*.json` under tests/fixtures/ (via
// scripts/rule-coverage.mjs computeCoverage, fixtureDirs: ['tests/witness', 'tests/fixtures'])
// and runs each through assessPediatricAnemia() to regenerate rules' requiredTestCaseIds
// coverage. This snapshot fixture is not a patient-intake payload, so a plain-`.json` name here
// made that regeneration diverge from the committed modules/anemia/rules.json
// (tests/rule-governance.test.mjs's `--check` subtest failed) — the exact mitigation
// tests/fixtures/rf-cbc-001/passage-hash-ledger.json.txt and tests/fixtures/invalid-rule/'s
// seeded-invalid fixture already apply for the same reason. Content is still plain JSON —
// tests/p4-t1-pre-merge-snapshot.test.mjs loads it with readFile + JSON.parse.
//
// This script is NOT part of `npm run check` and is not meant to be re-run casually: the
// committed fixture IS the frozen baseline. Only re-run it (deliberately, with review) if the
// baseline itself needs to be re-established from a clean pre-Phase-4 checkout.
//
// Usage:
//   node scripts/capture-p4-t1-snapshot.mjs [outputPath]

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSnapshot, WHOLE_FILE_TARGETS, RECORD_TARGETS } from './lib/p4-t1-snapshot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.resolve(
  process.argv[2] ?? path.join(root, 'tests/fixtures/p4-t1-pre-merge-snapshot.json.txt'),
);

const snapshot = await computeSnapshot(root);

const fixture = {
  $schema: 'p4-t1-pre-merge-snapshot@1',
  taskId: 'P4-T1',
  planPath:
    'docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-3-4-scaffolds-and-backfill.md',
  purpose:
    'Baseline byte-identity / record-identity snapshot captured BEFORE any propose run in ' +
    'Phase 4 (multi-bundle-conversion-e1). Backs the decisions-block Risk 1 (modules/anemia/ ' +
    'additive-only RF-EV-001 backfill) and Risk 2 (modules/cbc_suite_v1/ collision-safe ' +
    'RF-CBC-002 merge) byte-identity proofs consumed by P4-T4 and P4-T7. Regenerate only via ' +
    'scripts/capture-p4-t1-snapshot.mjs, only from a clean pre-Phase-4 checkout, only with ' +
    'review — this fixture IS the frozen baseline, not a live derivation.',
  capturedAt: new Date().toISOString(),
  wholeFileInvariants: WHOLE_FILE_TARGETS,
  recordInvariants: RECORD_TARGETS.map((t) => ({
    relPath: t.relPath,
    arrayField: t.arrayField,
    idField: t.idField,
  })),
  files: snapshot.files,
  records: snapshot.records,
};

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(fixture, null, 2)}\n`);

console.log(`Wrote P4-T1 pre-merge snapshot to ${path.relative(root, outPath) || outPath}`);
console.log(`  whole-file targets: ${WHOLE_FILE_TARGETS.length}`);
for (const target of RECORD_TARGETS) {
  const count = snapshot.records[target.relPath].recordCount;
  console.log(`  record targets: ${target.relPath} (${count} record(s) keyed by "${target.idField}")`);
}
