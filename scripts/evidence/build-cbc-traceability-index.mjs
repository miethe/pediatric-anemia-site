#!/usr/bin/env node
// build-cbc-traceability-index.mjs — P5-T4 (evidence-foundry-buildout Phase 5, `02 §4.16`).
//
// Regenerates the committed, inspectable `modules/cbc_suite_v1/traceability-index.json` from
// `tools/rf-bundle-to-kb-pack/lib/traceability-index.mjs`'s pure builder — mirroring
// `scripts/evidence/backfill-rule-governance.mjs`'s `--check`-mode, deterministic, re-runnable
// codemod convention. Lives here (outside `tools/rf-bundle-to-kb-pack/`) for the same reason
// `scripts/evidence/govern-staged-rules.mjs` does: it WRITES a committed artifact directly, which
// is a build/governance step, not part of the converter's own `inspect`/`verify`/`propose` verb
// surface (the converter itself only ever writes into the gitignored `build/kb-pack/` staging
// tree).
//
// Usage:
//   node scripts/evidence/build-cbc-traceability-index.mjs           # writes the file
//   node scripts/evidence/build-cbc-traceability-index.mjs --check   # exit 1 if it would change

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateTraceabilityIndex } from '../../tools/rf-bundle-to-kb-pack/lib/traceability-index.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');
const OUTPUT_PATH = path.join(MODULE_DIR, 'traceability-index.json');

async function main() {
  const check = process.argv.includes('--check');

  const index = await generateTraceabilityIndex({ moduleDir: MODULE_DIR, repoRoot: REPO_ROOT });
  const nextSerialised = `${JSON.stringify(index, null, 2)}\n`;

  if (check) {
    let current;
    try {
      current = await readFile(OUTPUT_PATH, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.error(`build-cbc-traceability-index --check: ${path.relative(REPO_ROOT, OUTPUT_PATH)} does not exist yet.`);
        process.exit(1);
        return;
      }
      throw err;
    }
    if (current === nextSerialised) {
      console.log(
        `build-cbc-traceability-index --check: ${path.relative(REPO_ROOT, OUTPUT_PATH)} matches ` +
          `regenerated output (${Object.keys(index.rules).length} rules, ${Object.keys(index.sources).length} sources).`,
      );
      return;
    }
    console.error(`build-cbc-traceability-index --check: ${path.relative(REPO_ROOT, OUTPUT_PATH)} differs from regenerated output.`);
    process.exit(1);
    return;
  }

  await writeFile(OUTPUT_PATH, nextSerialised, 'utf8');
  console.log(
    `Wrote ${path.relative(REPO_ROOT, OUTPUT_PATH)}: ${Object.keys(index.rules).length} rules, ` +
      `${Object.keys(index.sources).length} sources.`,
  );
}

main().catch((error) => {
  console.error(`build-cbc-traceability-index: ${error.stack ?? error.message}`);
  process.exit(1);
});
