#!/usr/bin/env node
// scripts/evidence/backfill-cbc-002-evidence.mjs -- CLI entry point for P4-T5
// (multi-bundle-conversion-e1, Phase 4, FR-7/FR-8, decisions block Risk 2).
//
// Projects tests/fixtures/rf-cbc-002/ into modules/cbc_suite_v1/evidence.json and
// evidence-assertions.json, APPENDING to (never recreating) the RF-CBC-001-derived content
// already committed there. All of the actual data-shaping and collision-detection logic lives in
// ./lib/cbc-002-projection.mjs (pure, independently unit-tested); this file only owns disk I/O and
// the no-partial-write ordering:
//
//   1. Read both existing committed files.
//   2. Load the RF-CBC-002 fixture (claim ledger + all 12 source cards).
//   3. Build the new sources/assertions and the two fully-merged documents IN MEMORY.
//   4. Run collision detection against the merged inputs.
//   5. Only if zero collisions were found: write BOTH files. If any collision was found, throw
//      `CollisionError` -- neither `writeFile` call is ever reached, so a collision produces
//      exactly zero writes to either file, never a partial write to one.
//
// modules/cbc_suite_v1/rules.json and authoring-decisions.yaml are never read or written by this
// script.
//
// Usage:
//   node scripts/evidence/backfill-cbc-002-evidence.mjs             writes both files
//   node scripts/evidence/backfill-cbc-002-evidence.mjs --check     builds in memory, reports
//                                                                    counts and collisions (if
//                                                                    any), writes nothing

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseYamlDocument, parseYamlFrontmatter } from '../../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';
import {
  buildNewSources,
  buildNewAssertions,
  detectCollisions,
  mergeEvidenceDocument,
  mergeAssertionsDocument,
  CollisionError,
} from './lib/cbc-002-projection.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-002');
const EVIDENCE_PATH = path.join(MODULE_DIR, 'evidence.json');
const ASSERTIONS_PATH = path.join(MODULE_DIR, 'evidence-assertions.json');

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

/** Loads the RF-CBC-002 fixture's claim ledger and all 12 source-card frontmatters -- read-only,
 * never writes to the fixture directory (matches this converter family's existing "never mutate
 * runs/<run_id>/" posture). */
async function loadFixture() {
  const claimLedgerRaw = await readFile(path.join(FIXTURE_DIR, 'claims', 'claim_ledger.yaml'), 'utf8');
  const claimLedger = parseYamlDocument(claimLedgerRaw);

  const sourcesDir = path.join(FIXTURE_DIR, 'sources');
  const sourceFiles = (await readdir(sourcesDir)).filter((f) => f.startsWith('src_') && f.endsWith('.md')).sort();
  const sourceCards = [];
  for (const filename of sourceFiles) {
    const filePath = path.join(sourcesDir, filename);
    const raw = await readFile(filePath, 'utf8');
    const { frontmatter } = parseYamlFrontmatter(raw);
    sourceCards.push({ path: filePath, frontmatter });
  }

  return { claims: claimLedger.claims, sourceCards };
}

function parseArgs(argv) {
  const out = { check: false };
  for (const arg of argv) {
    if (arg === '--check') out.check = true;
    else if (arg === '--write') out.check = false;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

export async function run({ check = false } = {}) {
  const existingEvidence = await loadJson(EVIDENCE_PATH);
  const existingAssertionsDoc = await loadJson(ASSERTIONS_PATH);

  const loaded = await loadFixture();
  const newSources = buildNewSources(loaded);
  const newAssertions = buildNewAssertions(loaded);

  const collisions = detectCollisions(
    { existingSources: existingEvidence.sources, existingAssertions: existingAssertionsDoc.assertions },
    { newSources, newAssertions },
  );

  if (collisions.length > 0) {
    // Fail CLOSED for the whole batch -- thrown before either merged document is even built for
    // writing, let alone written. No partial write: neither modules/cbc_suite_v1/evidence.json
    // nor evidence-assertions.json is touched.
    throw new CollisionError(collisions);
  }

  const mergedEvidence = mergeEvidenceDocument(existingEvidence, newSources);
  const mergedAssertionsDoc = mergeAssertionsDocument(existingAssertionsDoc, newAssertions);

  const summary = {
    newSourcesCount: newSources.length,
    newAssertionsCount: newAssertions.length,
    mergedSourcesCount: mergedEvidence.sources.length,
    mergedAssertionsCount: mergedAssertionsDoc.assertions.length,
  };

  if (check) {
    return { check: true, wrote: false, ...summary };
  }

  // Both writes happen only after collision detection AND both documents built successfully
  // above -- if anything before this point throws, this line is never reached and neither file
  // is touched.
  await writeFile(EVIDENCE_PATH, `${JSON.stringify(mergedEvidence, null, 2)}\n`, 'utf8');
  await writeFile(ASSERTIONS_PATH, `${JSON.stringify(mergedAssertionsDoc, null, 2)}\n`, 'utf8');

  return { check: false, wrote: true, ...summary };
}

async function main() {
  const { check } = parseArgs(process.argv.slice(2));
  const result = await run({ check });
  console.log(JSON.stringify({
    verb: 'backfill-cbc-002-evidence',
    ...result,
    evidencePath: path.relative(REPO_ROOT, EVIDENCE_PATH),
    assertionsPath: path.relative(REPO_ROOT, ASSERTIONS_PATH),
  }, null, 2));
}

const isMain = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? '');
if (isMain) {
  main().catch((error) => {
    console.error(`backfill-cbc-002-evidence: ${error.message}`);
    process.exit(1);
  });
}
