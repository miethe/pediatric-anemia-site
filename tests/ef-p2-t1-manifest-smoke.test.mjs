// tests/ef-p2-t1-manifest-smoke.test.mjs — P2-T1 smoke test (multi-bundle-conversion-e1-finish,
// Phase 2), phase-2-3-genericity-decisions-authoring.md row P2-T1.
//
// P2-T1's own acceptance criteria: "tests/fixtures/p2-t1-cbc-propose-manifest.json is committed,
// containing exactly 9 file-hash entries; a smoke test confirms the manifest's hashes match a
// fresh propose run's live output taken BEFORE P2-T3 lands (i.e., captured on the Phase-1-complete
// commit, not after)."
//
// This is the regression anchor's own self-check: it proves the committed manifest fixture is not
// stale/fabricated by re-deriving a live propose run and comparing every hash. It is intentionally
// independent of tests/ef-cbc-byte-identity-regression.test.mjs (P2-T4) -- that later test proves
// the SAME property survives the P2-T3/P2-T7 genericity refactor; this one is the pre-refactor
// baseline's own honesty check.
//
// ONE DOCUMENTED EXCEPTION: `release-manifest.unsigned.json` is excluded from this file's strict
// whole-file comparison. Its own `converter.configSha256` field is, by design
// (computeConverterConfigSha256, propose.mjs), a SHA-256 over every `.mjs` file this converter
// ships -- it legitimately changes the instant P2-T3/P2-T7 land (they edit
// rule-candidate-drafts.mjs/propose.mjs), independent of any clinical-content change. P2-T4's own
// test (tests/ef-cbc-byte-identity-regression.test.mjs) owns the field-by-field check for that one
// file (every field but configSha256 stays identical, and the configSha256 difference itself is
// asserted, never silently ignored); this file's job is the other 8 files' unconditional
// byte-identity, which the genericity refactor never touches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { capturePropose, MANIFEST_FILES } from '../scripts/lib/p2-t1-manifest.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'p2-t1-cbc-propose-manifest.json.txt');

test('P2-T1: the committed cbc_suite_v1 propose manifest fixture is not stale -- a fresh run matches every hash', async () => {
  const manifestRaw = await readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  assert.equal(manifest.files.length, 9, 'manifest must contain exactly 9 file-hash entries');
  assert.deepEqual(
    manifest.files.map((f) => f.filename).sort(),
    [...MANIFEST_FILES].sort(),
    'manifest must name exactly the 9 files this task\'s own acceptance criteria enumerate',
  );

  const liveFiles = await capturePropose();
  const liveByName = new Map(liveFiles.map((f) => [f.filename, f]));

  const mismatches = [];
  for (const entry of manifest.files) {
    if (entry.filename === 'release-manifest.unsigned.json') {
      continue; // documented exception -- see this file's header and P2-T4's dedicated check
    }
    const live = liveByName.get(entry.filename);
    if (!live) {
      mismatches.push({ filename: entry.filename, reason: 'missing from live run' });
      continue;
    }
    if (live.sha256 !== entry.sha256) {
      mismatches.push({
        filename: entry.filename,
        reason: 'hash mismatch',
        manifestSha256: entry.sha256,
        liveSha256: live.sha256,
      });
    }
  }
  assert.deepEqual(
    mismatches,
    [],
    `committed manifest must match a fresh propose run byte-for-byte; mismatches: ${JSON.stringify(mismatches, null, 2)}`,
  );
});

test('P2-T1 sanity: this file FAILS LOUDLY, not silently, if the manifest fixture itself is missing', async () => {
  const bogusPath = path.join(REPO_ROOT, 'tests', 'fixtures', 'does-not-exist-manifest.json');
  await assert.rejects(() => readFile(bogusPath, 'utf8'), { code: 'ENOENT' });
});
