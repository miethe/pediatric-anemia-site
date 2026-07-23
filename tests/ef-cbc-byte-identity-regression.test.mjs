// tests/ef-cbc-byte-identity-regression.test.mjs — P2-T4 (multi-bundle-conversion-e1-finish,
// Phase 2), phase-2-3-genericity-decisions-authoring.md row P2-T4.
//
// Runs `propose` for `cbc_suite_v1` post-P2-T3/P2-T7 and SHA-256-compares every one of the 9
// emitted files this plan's P2-T1 manifest tracks against that committed baseline. Per this plan's
// own NFR, a `cbc_suite_v1` output drift is a clinical-content change, not a build break -- this
// test fails loudly (never silently skips) if the manifest fixture is missing.
//
// ONE DOCUMENTED, STRUCTURALLY-NECESSARY EXCEPTION (not a loophole -- see
// tests/fixtures/p2-t1-cbc-release-manifest-baseline.json.txt's own header for the full rationale):
// `release-manifest.unsigned.json`'s `converter.configSha256` field is, BY DESIGN
// (computeConverterConfigSha256, tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs), a SHA-256 over
// every `.mjs` source file this converter ships -- it MUST change whenever this converter's own
// source changes, and P2-T3/P2-T7 do change it (rule-candidate-drafts.mjs, propose.mjs). This is
// the converter's own technical-integrity hash correctly detecting a real code change; it is the
// "build break" side of this plan's own "clinical content change, not a build break" distinction,
// not the clinical-content side. Every OTHER byte of `release-manifest.unsigned.json`, and the
// OTHER 8 files in full, stay whole-file byte-identical.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { capturePropose } from '../scripts/lib/p2-t1-manifest.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'p2-t1-cbc-propose-manifest.json.txt');
const RELEASE_MANIFEST_BASELINE_PATH = path.join(
  REPO_ROOT,
  'tests',
  'fixtures',
  'p2-t1-cbc-release-manifest-baseline.json.txt',
);

const VOLATILE_EXCEPTION_FILENAME = 'release-manifest.unsigned.json';

test('P2-T4: the P2-T1 manifest fixture exists and is loadable (fails loudly, never silently skips)', async () => {
  // A missing fixture must throw, not be quietly tolerated -- this is a dedicated assertion of
  // that property, independent of the main test below (which would also throw on ENOENT, but not
  // with a message naming this task's own binding requirement).
  let raw;
  try {
    raw = await readFile(MANIFEST_PATH, 'utf8');
  } catch (err) {
    assert.fail(
      `P2-T1 manifest fixture is missing at ${MANIFEST_PATH} -- the byte-identity regression ` +
        `anchor for this entire plan cannot be verified without it (${err.message})`,
    );
  }
  const manifest = JSON.parse(raw);
  assert.equal(manifest.files.length, 9, 'P2-T1 manifest must contain exactly 9 file-hash entries');
});

test('P2-T4: cbc_suite_v1 propose output, post-P2-T3/P2-T7, is SHA-256 byte-identical to the P2-T1 manifest for all 9 files (release-manifest.unsigned.json exempting only its own converter.configSha256 field)', async () => {
  const manifestRaw = await readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const manifestByName = new Map(manifest.files.map((f) => [f.filename, f]));

  const liveFiles = await capturePropose();
  assert.equal(liveFiles.length, 9, 'a live propose run must still emit exactly the 9 manifest-tracked files');

  const mismatches = [];
  for (const live of liveFiles) {
    const expected = manifestByName.get(live.filename);
    if (!expected) {
      mismatches.push({ filename: live.filename, reason: 'file not present in P2-T1 manifest at all' });
      continue;
    }
    if (live.filename === VOLATILE_EXCEPTION_FILENAME) {
      continue; // handled by the dedicated structural test below
    }
    if (live.sha256 !== expected.sha256) {
      mismatches.push({
        filename: live.filename,
        reason: 'SHA-256 mismatch -- a clinical-content change, not a build break',
        manifestSha256: expected.sha256,
        liveSha256: live.sha256,
      });
    }
  }

  assert.deepEqual(
    mismatches,
    [],
    `cbc_suite_v1 propose output must stay byte-identical to the P2-T1 manifest; mismatches: ${JSON.stringify(mismatches, null, 2)}`,
  );
});

test('P2-T4: release-manifest.unsigned.json stays byte-identical in every field except its own documented converter.configSha256 exception', async () => {
  const baselineRaw = await readFile(RELEASE_MANIFEST_BASELINE_PATH, 'utf8');
  const baseline = JSON.parse(baselineRaw);

  const liveFiles = await capturePropose();
  const liveEntry = liveFiles.find((f) => f.filename === VOLATILE_EXCEPTION_FILENAME);
  assert.ok(liveEntry, 'release-manifest.unsigned.json must be emitted by a live propose run');

  // Re-run to get the raw content itself (capturePropose() only returns hashes) -- a second
  // independent run, same fixture inputs, so this is still a fresh, non-cached derivation.
  const { mkdtemp, rm } = await import('node:fs/promises');
  const os = await import('node:os');
  const { run: runPropose } = await import('../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs');
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-p2-t4-release-manifest-'));
  let liveRaw;
  try {
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try {
      await runPropose({
        runDir: path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001'),
        module: path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json'),
        decisions: path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml'),
        out: outDir,
      });
    } finally {
      process.stdout.write = original;
    }
    liveRaw = await readFile(path.join(outDir, VOLATILE_EXCEPTION_FILENAME), 'utf8');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const live = JSON.parse(liveRaw);
  const pre = baseline.preRefactorReleaseManifest;

  // Every non-volatile field must match the pre-refactor baseline exactly.
  assert.equal(live.schemaVersion, pre.schemaVersion);
  assert.equal(live.moduleId, pre.moduleId);
  assert.equal(live.packVersion, pre.packVersion);
  assert.deepEqual(live.rfInputs, pre.rfInputs, 'rfInputs[] must be unaffected by the genericity refactor');
  assert.equal(live.converter.name, pre.converter.name);
  assert.equal(live.converter.version, pre.converter.version);
  assert.equal(live.testCorpusHash, pre.testCorpusHash, 'testCorpusHash must be unaffected');
  assert.equal(live.traceabilityHash, pre.traceabilityHash, 'traceabilityHash must be unaffected');

  // The one documented exception: converter.configSha256 legitimately, visibly differs -- proving
  // computeConverterConfigSha256 is genuinely detecting the P2-T3/P2-T7 source-code change, not
  // silently ignoring it. This is asserted explicitly (never a silent "don't check this field").
  assert.notEqual(
    live.converter.configSha256,
    pre.converter.configSha256,
    'converter.configSha256 is expected to differ after the P2-T3/P2-T7 source-code genericity ' +
      'refactor (it hashes every .mjs file under this converter\'s own root) -- if this assertion ' +
      'ever fails, either the refactor did not actually change converter source (unexpected) or ' +
      'computeConverterConfigSha256 itself stopped detecting real code changes (a regression in the ' +
      'hash function, not a success)',
  );
  assert.match(live.converter.configSha256, /^sha256:[0-9a-f]{64}$/, 'configSha256 must still be a well-formed sha256 digest');
});
