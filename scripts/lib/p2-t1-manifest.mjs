// scripts/lib/p2-t1-manifest.mjs — reusable capture logic backing scripts/capture-p2-t1-manifest.mjs
// and tests/ef-p2-t1-manifest-smoke.test.mjs (multi-bundle-conversion-e1-finish, P2-T1).
//
// Split out from the CLI script (mirrors scripts/lib/p4-t1-snapshot.mjs's own split from
// scripts/capture-p4-t1-snapshot.mjs) so importing this module for its functions never has the
// side effect of re-writing the committed fixture -- a plain script file run only for its
// top-level effects is not safe to `import` from a test.

import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runPropose } from '../../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
export const MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
export const DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');

// The exact 9 files P2-T1's own acceptance criteria name -- order here is the manifest's own
// entry order, for readable diffs; the byte-identity comparison itself does not depend on it.
export const MANIFEST_FILES = [
  'pack-provenance.json',
  'evidence.json',
  'evidence-assertions.json',
  'candidates.json',
  'rule-proposals.json',
  'rules.json',
  'rule-provenance.json',
  'release-manifest.unsigned.json',
  'conversion-report.json',
];

export function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function withCapturedStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = original;
  }
}

/**
 * Runs `propose` for cbc_suite_v1 against the real, committed rf-cbc-001 fixture into a scratch
 * mkdtemp directory, and returns SHA-256 hashes for exactly the 9 files this fixture's manifest
 * tracks. Pure I/O, no side effect on any committed file.
 *
 * @returns {Promise<Array<{ filename: string, sha256: string, sizeBytes: number }>>}
 */
export async function capturePropose() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-p2-t1-manifest-'));
  try {
    const exitCode = await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR,
        module: MODULE_PATH,
        decisions: DECISIONS_PATH,
        out: outDir,
      }),
    );
    if (exitCode !== 0) {
      throw new Error(`propose exited ${exitCode}, expected 0 -- cannot capture a manifest from a failed run`);
    }

    const files = [];
    for (const filename of MANIFEST_FILES) {
      const raw = await readFile(path.join(outDir, filename), 'utf8');
      files.push({ filename, sha256: sha256Hex(raw), sizeBytes: Buffer.byteLength(raw, 'utf8') });
    }
    return files;
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}
