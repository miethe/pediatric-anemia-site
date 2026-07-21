// tests/ef-converter-manifest.test.mjs — P5-T5 (evidence-foundry-buildout Phase 5, FR-20).
//
// Task acceptance criteria (phase-3-5-projection-slice-manifest.md, row P5-T5):
//   "Add tests/ef-converter-determinism.test.mjs and tests/ef-converter-manifest.test.mjs (the
//    latter covering P5-T1/T2's schema + exclusion-reason ACs)."
//
// P5-T1's own dedicated suite (tests/ef-converter-release-manifest.test.mjs +
// tests/release-manifest-schema.test.mjs) and P5-T2's own dedicated suite
// (tests/ef-converter-conversion-report.test.mjs) already prove their builder functions and
// schema-validator wiring in isolation. This file is the ONE integration point that exercises both
// of those P5-T1/P5-T2 acceptance criteria TOGETHER, against a single real `propose` run, the way a
// real consumer (`scripts/validate-kb.mjs`, a human reviewing a staged pack) would actually read
// them side by side:
//
//   1. Schema AC (P5-T1): `release-manifest.unsigned.json`, from a real `propose` run, validates
//      cleanly against `schemas/release-manifest.schema.json` — and a manifest missing a required
//      field is rejected (R-P2 analog: the validator handles the missing-field case, it does not
//      silently pass).
//   2. Exclusion-reason AC (P5-T2): `conversion-report.json`, from that SAME real `propose` run,
//      enumerates every claim `../claim-routing.mjs`'s `routeClaims()` excluded from rule evidence,
//      each with a specific, non-empty reason — and the report's own exclusion count matches the
//      routing logic's actual reject count exactly (no claim silently dropped between routing and
//      reporting).
//   3. Cross-check: the manifest and the conversion report, emitted by the SAME run, describe the
//      SAME module/pack identity (moduleId, packVersion) — the two audit artifacts never disagree
//      about which pack they document.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { validateKbPackReleaseManifests } from '../scripts/validate-kb.mjs';
import { run as runPropose } from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { loadBundle } from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import { pinArtifacts } from '../tools/rf-bundle-to-kb-pack/lib/hashing.mjs';
import { routeClaims } from '../tools/rf-bundle-to-kb-pack/lib/claim-routing.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');
const RELEASE_MANIFEST_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-manifest.schema.json');

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
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

// A single real propose run, shared read-only across every test below — mirrors this file's own
// "one run, read side by side" integration framing rather than re-running propose per assertion.
async function runProposeOnce() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-manifest-integration-'));
  await withCapturedStdout(() =>
    runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir }),
  );
  return outDir;
}

// =================================================================================================
// 1. Schema AC (P5-T1): a real run's release-manifest.unsigned.json validates cleanly.
// =================================================================================================

test('P5-T5/P5-T1: a real propose run\'s release-manifest.unsigned.json validates cleanly against schemas/release-manifest.schema.json', async () => {
  const outDir = await runProposeOnce();
  try {
    const schema = await loadJson(RELEASE_MANIFEST_SCHEMA_PATH);
    const manifest = await loadJson(path.join(outDir, 'release-manifest.unsigned.json'));
    const errors = validate(schema, manifest);
    assert.deepEqual(errors, [], `real manifest must validate cleanly: ${JSON.stringify(errors)}`);

    // R-P2 analog: no signature/release fields leak onto this unsigned E0 manifest.
    assert.equal(manifest.signature, undefined, 'the E0 manifest must never carry a signature block');
    assert.equal(manifest.approvedBy, undefined, 'the E0 manifest must never claim an approver before real clinical review');
    assert.equal(manifest.releasedAt, undefined, 'the E0 manifest must never claim a release timestamp');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// 2. Schema AC, negative case (P5-T1, R-P2 analog): a manifest missing a required field is
//    rejected — proven here via the actual scripts/validate-kb.mjs entrypoint the whole KB build
//    relies on (validateKbPackReleaseManifests), not merely the raw schema validator in isolation.
// =================================================================================================

test('P5-T5/P5-T1: validateKbPackReleaseManifests rejects a release-manifest.unsigned.json missing a required field', async () => {
  // A throwaway root with its own schemas/ + build/kb-pack/ (validateKbPackReleaseManifests
  // resolves both relative to the rootDir it is given, mirroring
  // tests/release-manifest-schema.test.mjs's own seeded-bad-fixture pattern).
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-manifest-integration-invalid-'));
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    const schemaRaw = await readFile(RELEASE_MANIFEST_SCHEMA_PATH, 'utf8');
    await writeFile(path.join(tempRoot, 'schemas', 'release-manifest.schema.json'), schemaRaw, 'utf8');

    const packDir = path.join(tempRoot, 'build', 'kb-pack', 'cbc_suite_v1', '0.1.0-proposal');
    await mkdir(packDir, { recursive: true });
    // Schema-legal in every way except the missing `converter.configSha256` (a required field).
    const invalidManifest = {
      schemaVersion: '1.0',
      moduleId: 'cbc_suite_v1',
      packVersion: '0.1.0-proposal',
      rfInputs: [{
        runId: 'rf_run_test',
        bundleSha256: `sha256:${'a'.repeat(64)}`,
        claimLedgerSha256: `sha256:${'b'.repeat(64)}`,
        verificationExitCode: 0,
      }],
      converter: { name: 'rf-bundle-to-kb-pack', version: '0.1.0' }, // configSha256 omitted
      testCorpusHash: `sha256:${'c'.repeat(64)}`,
      traceabilityHash: `sha256:${'d'.repeat(64)}`,
    };
    await writeFile(
      path.join(packDir, 'release-manifest.unsigned.json'),
      JSON.stringify(invalidManifest, null, 2),
      'utf8',
    );

    const results = await validateKbPackReleaseManifests(tempRoot);
    assert.equal(results.length, 1, 'exactly one release-manifest.unsigned.json was seeded');
    assert.ok(
      results[0].errors.length > 0,
      'a manifest missing a required field must be reported with at least one specific error, never silently accepted',
    );
    assert.match(results[0].errors.join(' '), /configSha256|required/i);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// =================================================================================================
// 3. Exclusion-reason AC (P5-T2): every rejected claim appears in conversion-report.json with a
//    specific, non-empty reason, and the count matches the routing logic's own reject count.
// =================================================================================================

test('P5-T5/P5-T2: a real propose run\'s conversion-report.json enumerates every routing-rejected claim with a specific reason', async () => {
  const outDir = await runProposeOnce();
  try {
    // Independently recompute the routing report the same way propose.mjs itself does, so this
    // assertion is not merely "the report agrees with itself."
    const loaded = await loadBundle({ runDir: FIXTURE_DIR, modulePath: REAL_MODULE_PATH });
    const pinned = await pinArtifacts(loaded);
    const evidenceAssertionsDoc = await loadJson(path.join(REAL_MODULE_DIR, 'evidence-assertions.json'));
    const routingReport = routeClaims(
      pinned.artifacts.claimLedger.parsed.claims,
      evidenceAssertionsDoc.assertions,
    );

    const conversionReport = await loadJson(path.join(outDir, 'conversion-report.json'));

    assert.ok(conversionReport.exclusions, 'conversion-report.json must have an exclusions object');
    assert.ok(Array.isArray(conversionReport.exclusions.claims), 'exclusions.claims must be an array');
    assert.equal(
      conversionReport.exclusions.claims.length,
      routingReport.rejected.length,
      'conversion-report.json exclusion count must match claim-routing.mjs\'s own reject count exactly',
    );
    assert.equal(conversionReport.summary.claimsExcluded, routingReport.rejected.length);
    assert.ok(routingReport.rejected.length > 0, 'the real fixture must actually have rejected claims for this to be a non-vacuous proof');

    const reportedIds = new Set(conversionReport.exclusions.claims.map((entry) => entry.itemId));
    for (const rejected of routingReport.rejected) {
      assert.ok(
        reportedIds.has(rejected.claimId),
        `rejected claim ${rejected.claimId} must appear in conversion-report.json's exclusions.claims`,
      );
    }

    // Every entry names a specific, non-empty reason — never a bare pass/fail with no rationale.
    for (const entry of conversionReport.exclusions.claims) {
      assert.equal(entry.itemType, 'claim');
      assert.ok(Array.isArray(entry.reasons) && entry.reasons.length > 0, `${entry.itemId} must carry at least one specific exclusion reason`);
      for (const reason of entry.reasons) {
        assert.equal(typeof reason, 'string');
        assert.ok(reason.length > 0, `${entry.itemId}'s reason must not be an empty string`);
      }
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// 4. Cross-check: the manifest and the conversion report from the SAME run agree on pack identity.
// =================================================================================================

test('P5-T5: release-manifest.unsigned.json and conversion-report.json from the same run agree on moduleId/packVersion', async () => {
  const outDir = await runProposeOnce();
  try {
    const manifest = await loadJson(path.join(outDir, 'release-manifest.unsigned.json'));
    const conversionReport = await loadJson(path.join(outDir, 'conversion-report.json'));
    assert.equal(manifest.moduleId, conversionReport.moduleId);
    assert.equal(manifest.packVersion, conversionReport.packVersion);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
