#!/usr/bin/env node
// scripts/sign-kb.mjs
//
// EP5-T1 — computes, and by default writes, the SPIKE-006 Amendment 1 two-part manifest digest
// into modules/anemia/module.json: `clinicalContentHash` (SHA-256 over the four KB JSON files'
// parsed values plus raw-byte hashes of the two source files that still hardcode clinical
// thresholds) and `governanceHash` (SHA-256 over module.json's own governance fields). See
// docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md, "Amended design —
// required amendments 1-6 applied (2026-07-21)" for the normative spec this implements.
//
// Two modes:
//   default   — recomputes both digests and WRITES them into module.json, moving `status` to
//               "integrity-recorded". This is a release action, run at release time — not on
//               every build.
//   --check   — recomputes both digests and compares them against what module.json already has,
//               WITHOUT writing. Exits 1 on any mismatch or missing digest. This is the
//               CI/verification mode.
//
// `approvedBy` is deliberately NOT a flag anywhere in this file. Per D-4
// (tests/clinical-approvers-d4.test.mjs) and this task's own guardrail, a signature attesting to
// approvals that never happened is worse than none — there is no code path here that can write a
// non-empty approvedBy; the only literal ever assigned to it is `[]`.
//
// `validationRunId` is sourced ONLY from --validation-run-id or KB_VALIDATION_RUN_ID. If neither
// is supplied, it is written as `null` — never invented (Amendment 1). A manifest signed with a
// null validationRunId is honestly "integrity-recorded" at the content layer but not yet
// servable (src/kbVerify.js's AC-WP5-RESIL treats validationRunId as must-not-be-empty).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeClinicalContentHash, computeGovernanceHash, READY_STATUS } from '../src/kbVerify.js';
import { sha256Hex } from '../src/lib/digest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleDir = path.join(root, 'modules', 'anemia');
const modulePath = path.join(moduleDir, 'module.json');

// Amendment 1's exact file lists — see the SPIKE section cited above for why these six files and
// no others.
export const KB_JSON_FILES = ['rules.json', 'candidates.json', 'evidence.json', 'reference-ranges.json'];
export const KB_SOURCE_FILES = ['ranges.js', 'facts.anemia.js'];

export function parseArgs(argv) {
  const args = { check: false, validationRunId: undefined, supersedes: undefined };
  for (const arg of argv) {
    if (arg === '--check') { args.check = true; continue; }
    const runIdMatch = /^--validation-run-id=([\s\S]*)$/.exec(arg);
    if (runIdMatch) { args.validationRunId = runIdMatch[1]; continue; }
    const supersedesMatch = /^--supersedes=([\s\S]*)$/.exec(arg);
    if (supersedesMatch) { args.supersedes = JSON.parse(supersedesMatch[1]); continue; }
    throw new Error(`scripts/sign-kb.mjs: unrecognized argument "${arg}"`);
  }
  return args;
}

/** Reads the four KB JSON files and returns them shaped for computeClinicalContentHash's `files`. */
export async function loadKbJsonFiles() {
  const files = [];
  for (const filename of KB_JSON_FILES) {
    const content = JSON.parse(await readFile(path.join(moduleDir, filename), 'utf8'));
    files.push({ path: `modules/anemia/${filename}`, content });
  }
  return files;
}

/** Hashes the two source files' raw bytes, shaped for computeClinicalContentHash's `sourceFiles`. */
export async function loadKbSourceFiles() {
  const sourceFiles = [];
  for (const filename of KB_SOURCE_FILES) {
    const bytes = await readFile(path.join(moduleDir, filename));
    const hex = await sha256Hex(bytes);
    sourceFiles.push({ path: `modules/anemia/${filename}`, sha256: hex });
  }
  return sourceFiles;
}

async function runCheck(manifest, files, sourceFiles) {
  const clinicalContentHash = await computeClinicalContentHash({ files, sourceFiles });
  const governanceHash = await computeGovernanceHash({ moduleId: manifest.id, fields: manifest });

  const problems = [];
  if (manifest.clinicalContentHash !== clinicalContentHash) {
    problems.push(
      `clinicalContentHash mismatch: manifest has ${JSON.stringify(manifest.clinicalContentHash)}, `
        + `recomputed ${JSON.stringify(clinicalContentHash)}`,
    );
  }
  if (manifest.governanceHash !== governanceHash) {
    problems.push(
      `governanceHash mismatch: manifest has ${JSON.stringify(manifest.governanceHash)}, `
        + `recomputed ${JSON.stringify(governanceHash)}`,
    );
  }

  if (problems.length > 0) {
    console.error(`scripts/sign-kb.mjs --check: FAILED\n${problems.join('\n')}`);
    return false;
  }
  console.log('scripts/sign-kb.mjs --check: OK — clinicalContentHash and governanceHash match module.json.');
  return true;
}

async function runSign(manifest, files, sourceFiles, { validationRunId, supersedes }) {
  const clinicalContentHash = await computeClinicalContentHash({ files, sourceFiles });

  const updated = {
    id: manifest.id,
    title: manifest.title,
    schemaVersion: manifest.schemaVersion,
    status: READY_STATUS,
    knowledgeBaseVersion: manifest.knowledgeBaseVersion,
    evidenceReviewedThrough: manifest.evidenceReviewedThrough,
    engineLabel: manifest.engineLabel,
    supportedAgeMonths: manifest.supportedAgeMonths,
    clinicalContentHash,
    governanceHash: null, // computed below, once every other governance field is final
    approvedBy: [],
    validationRunId: validationRunId ?? null,
    supersedes: supersedes ?? null,
    releasedAt: manifest.releasedAt,
  };
  updated.governanceHash = await computeGovernanceHash({ moduleId: updated.id, fields: updated });

  await writeFile(modulePath, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(
    `scripts/sign-kb.mjs: wrote clinicalContentHash and governanceHash to `
      + `${path.relative(root, modulePath)} (status: ${updated.status}).`,
  );
  if (!updated.validationRunId) {
    console.warn(
      'scripts/sign-kb.mjs: validationRunId is null (no --validation-run-id / KB_VALIDATION_RUN_ID '
        + 'supplied). This manifest is integrity-recorded but NOT yet servable — '
        + 'src/kbVerify.js treats validationRunId as a must-not-be-empty field (AC-WP5-RESIL).',
    );
  }
  return updated;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const manifest = JSON.parse(await readFile(modulePath, 'utf8'));
  const files = await loadKbJsonFiles();
  const sourceFiles = await loadKbSourceFiles();

  if (args.check) {
    const ok = await runCheck(manifest, files, sourceFiles);
    if (!ok) process.exitCode = 1;
    return;
  }

  const validationRunId = args.validationRunId ?? process.env.KB_VALIDATION_RUN_ID ?? null;
  await runSign(manifest, files, sourceFiles, { validationRunId, supersedes: args.supersedes ?? null });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await main();
}
