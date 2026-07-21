// tests/server-manifest-failclosed.test.mjs — EP5-T5 / EP5-T7 (SPIKE-006 RQ4 + Amendment 4,
// AC-WP5-RESIL).
//
// Drives server.mjs's exported startup-decision function, `verifyModuleManifest`, directly
// against in-memory manifests/content — never mutating the real modules/anemia/module.json on
// disk. Covers:
//   EP5-T5  server.mjs (and, by the same src/kbVerify.js#verifyManifest call, scripts/
//           build-static.mjs) refuses on a missing/schema-invalid/tampered/incompatible/expired
//           manifest — the ENOENT-tolerant path is gone.
//   EP5-T7  AC-WP5-RESIL: `supersedes: null` and `approvedBy: []` are legitimately-empty and must
//           SERVE normally, never conflated with the must-not-be-empty fields
//           (clinicalContentHash/governanceHash/validationRunId/status) that must fail closed.
//   Amendment 4: the evidence-staleness expiry mechanism is proven working in BOTH the
//   policy-unset state (not enforced, loudly disclosed — this repo's actual, honest current
//   state) and a policy-set state (enforced, fails closed), via src/kbVerify.js#verifyManifest
//   directly (server.mjs's wrapper always injects the real, currently-null
//   src/evidenceStalenessPolicy.js value, so the set-policy states are exercised at the
//   kbVerify.js layer, which is exactly where the mechanism lives).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyModuleManifest } from '../server.mjs';
import { verifyManifest, computeGovernanceHash } from '../src/kbVerify.js';
import { loadKbJsonFiles, loadKbSourceFiles } from '../scripts/sign-kb.mjs';
import { EVIDENCE_STALENESS_POLICY } from '../src/evidenceStalenessPolicy.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE_JSON_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'module.json');
const MODULE_ID = 'anemia';

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

// Real, on-disk KB content — read fresh each time and never written back to. Every "poisoned"
// test below mutates only an in-memory clone of the manifest (or, for the tamper test, an
// in-memory clone of the loaded file content), never these files on disk.
async function realManifestAndContent() {
  const manifest = await readJson(MODULE_JSON_PATH);
  const files = await loadKbJsonFiles();
  const sourceFiles = await loadKbSourceFiles();
  return { manifest, files, sourceFiles };
}

// --- EP5-T7 / AC-WP5-RESIL: legitimately-empty fields serve normally --------------------------

test('AC-WP5-RESIL: the real signed manifest SERVES normally, with supersedes: null and approvedBy: [] (legitimately empty, not an error)', async () => {
  const { manifest, files, sourceFiles } = await realManifestAndContent();
  assert.equal(manifest.supersedes, null, 'fixture assumption: first release has no predecessor');
  assert.deepEqual(manifest.approvedBy, [], 'fixture assumption: D-4 — no approvals recorded yet');

  const verdict = await verifyModuleManifest({ moduleId: MODULE_ID, manifest, files, sourceFiles });
  assert.equal(verdict.servable, true, JSON.stringify(verdict.reasons));
  assert.deepEqual(verdict.reasons, []);
  assert.deepEqual(verdict.legitimatelyEmpty.approvedBy, []);
  assert.equal(verdict.legitimatelyEmpty.supersedes, null);
});

// --- EP5-T5: missing manifest ------------------------------------------------------------------

test('missing manifest (null) refuses to serve', async () => {
  const { files, sourceFiles } = await realManifestAndContent();
  const verdict = await verifyModuleManifest({ moduleId: MODULE_ID, manifest: null, files, sourceFiles });
  assert.equal(verdict.servable, false);
  assert.ok(verdict.reasons[0].includes('missing or is not an object'), JSON.stringify(verdict.reasons));
});

// --- EP5-T5: schema-invalid manifest -------------------------------------------------------------

test('schema-invalid manifest (unrecognized property, additionalProperties: false) refuses to serve', async () => {
  const { manifest, files, sourceFiles } = await realManifestAndContent();
  const poisoned = { ...manifest, notARealManifestField: 'this is not a legal manifest key' };
  const verdict = await verifyModuleManifest({ moduleId: MODULE_ID, manifest: poisoned, files, sourceFiles });
  assert.equal(verdict.servable, false);
  assert.ok(verdict.reasons.some((r) => r.includes('schema-invalid')), JSON.stringify(verdict.reasons));
  // Isolates the schema failure: hashes are unaffected by an extraneous key outside
  // GOVERNANCE_FIELD_KEYS, so this is specifically proving the schema wiring, not a hash mismatch.
  assert.equal(verdict.hashes.clinicalContentHash.matches, true);
  assert.equal(verdict.hashes.governanceHash.matches, true);
});

// --- EP5-T5: tampered clinicalContentHash (content changed underneath) -------------------------

test('tampered clinicalContentHash — KB content differs from what the stored digest attests to — refuses to serve', async () => {
  const { manifest, files, sourceFiles } = await realManifestAndContent();
  const tamperedFiles = files.map((file, index) => (
    index === 0 ? { ...file, content: { ...file.content, _tamperedForTest: true } } : file
  ));
  const verdict = await verifyModuleManifest({ moduleId: MODULE_ID, manifest, files: tamperedFiles, sourceFiles });
  assert.equal(verdict.servable, false);
  assert.equal(verdict.hashes.clinicalContentHash.matches, false);
  assert.ok(verdict.reasons.some((r) => r.includes('does not match the recomputed digest')), JSON.stringify(verdict.reasons));
});

// --- EP5-T5: status "unsigned-stub" -------------------------------------------------------------

test('status "unsigned-stub" (never signed) refuses to serve', async () => {
  const { manifest, files, sourceFiles } = await realManifestAndContent();
  const poisoned = {
    ...manifest,
    status: 'unsigned-stub',
    clinicalContentHash: null,
    governanceHash: null,
    validationRunId: null,
  };
  const verdict = await verifyModuleManifest({ moduleId: MODULE_ID, manifest: poisoned, files, sourceFiles });
  assert.equal(verdict.servable, false);
  assert.ok(verdict.reasons.some((r) => r.includes('status')), JSON.stringify(verdict.reasons));
});

// --- EP5-T5: unsupported schemaVersion (incompatible) -------------------------------------------

test('unsupported schemaVersion refuses to serve even though every hash still matches', async () => {
  const { manifest, files, sourceFiles } = await realManifestAndContent();
  const poisoned = { ...manifest, schemaVersion: 999 };
  const verdict = await verifyModuleManifest({ moduleId: MODULE_ID, manifest: poisoned, files, sourceFiles });
  assert.equal(verdict.servable, false);
  // schemaVersion is excluded from GOVERNANCE_FIELD_KEYS (Amendment 1) — isolates this failure
  // to the schemaVersion-compatibility check, not a hash mismatch caused by the mutation.
  assert.equal(verdict.hashes.clinicalContentHash.matches, true);
  assert.equal(verdict.hashes.governanceHash.matches, true);
  assert.equal(verdict.schemaVersion.supported, false);
  assert.ok(verdict.reasons.some((r) => r.includes('schemaVersion')), JSON.stringify(verdict.reasons));
});

// --- EP5-T5 / EP5-T7: missing validationRunId (must-not-be-empty, not legitimately-empty) --------

test('missing validationRunId refuses to serve (AC-WP5-RESIL: must-not-be-empty, never conflated with legitimately-empty supersedes/approvedBy)', async () => {
  const { manifest, files, sourceFiles } = await realManifestAndContent();
  const broken = { ...manifest, validationRunId: null };
  // Recompute governanceHash so the ONLY failure this test proves is the missing validationRunId
  // itself, not an incidental hash mismatch from mutating a field governanceHash also covers.
  broken.governanceHash = await computeGovernanceHash({ moduleId: MODULE_ID, fields: broken });

  const verdict = await verifyModuleManifest({ moduleId: MODULE_ID, manifest: broken, files, sourceFiles });
  assert.equal(verdict.servable, false);
  assert.ok(verdict.reasons.some((r) => r.includes('validationRunId')), JSON.stringify(verdict.reasons));
  // supersedes/approvedBy remain legitimately empty and are not themselves treated as a failure.
  assert.deepEqual(verdict.legitimatelyEmpty.approvedBy, []);
  assert.equal(verdict.legitimatelyEmpty.supersedes, null);
});

// --- Amendment 4: evidence-staleness expiry — mechanism proven in BOTH policy states ------------

test('evidenceStalenessPolicy.maxAgeDays is null today — no governance decision has been made (this repo\'s actual, honest state)', () => {
  assert.equal(EVIDENCE_STALENESS_POLICY.maxAgeDays, null);
});

test('expiry policy UNSET (maxAgeDays: null): serves, and non-enforcement is disclosed loudly, never silently', async () => {
  const { manifest, files, sourceFiles } = await realManifestAndContent();
  // Goes through server.mjs's real wrapper, which injects the REAL (currently null) policy —
  // proving the actual startup path discloses non-enforcement, not just the mechanism in isolation.
  const verdict = await verifyModuleManifest({ moduleId: MODULE_ID, manifest, files, sourceFiles });
  assert.equal(verdict.servable, true, JSON.stringify(verdict.reasons));
  assert.ok(verdict.expiry, 'verdict must carry an expiry disclosure even when unenforced');
  assert.equal(verdict.expiry.enforced, false);
  assert.equal(verdict.expiry.expired, false);
  assert.match(verdict.expiry.reason, /no governance decision/i);
});

test('expiry policy SET and evidenceReviewedThrough OLDER than the window: refuses to serve (fails closed)', async () => {
  const { manifest, files, sourceFiles } = await realManifestAndContent();
  assert.equal(manifest.evidenceReviewedThrough, '2026-07-15');
  const verdict = await verifyManifest({
    manifest,
    moduleId: MODULE_ID,
    files,
    sourceFiles,
    evidenceStalenessPolicy: { maxAgeDays: 5 },
    now: new Date('2026-07-25T00:00:00Z'), // 10 days after evidenceReviewedThrough
  });
  assert.equal(verdict.servable, false);
  assert.equal(verdict.expiry.enforced, true);
  assert.equal(verdict.expiry.expired, true);
  assert.ok(verdict.reasons.some((r) => r.includes('evidence is expired')), JSON.stringify(verdict.reasons));
});

test('expiry policy SET and evidenceReviewedThrough WITHIN the window: serves normally', async () => {
  const { manifest, files, sourceFiles } = await realManifestAndContent();
  assert.equal(manifest.evidenceReviewedThrough, '2026-07-15');
  const verdict = await verifyManifest({
    manifest,
    moduleId: MODULE_ID,
    files,
    sourceFiles,
    evidenceStalenessPolicy: { maxAgeDays: 60 },
    now: new Date('2026-07-25T00:00:00Z'), // 10 days after evidenceReviewedThrough, well within 60
  });
  assert.equal(verdict.servable, true, JSON.stringify(verdict.reasons));
  assert.equal(verdict.expiry.enforced, true);
  assert.equal(verdict.expiry.expired, false);
});
