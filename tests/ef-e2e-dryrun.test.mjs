// tests/ef-e2e-dryrun.test.mjs — P5-T1 (Evidence Foundry E1 Phase 5, R-P3 seam task).
//
// Task acceptance criteria (docs/project_plans/implementation_plans/infrastructure/
// evidence-foundry-e1-v1/phase-5-integration-docs.md, row P5-T1):
//   1. The P2-T8 five-role review cycle validates chain-green over the cbc_suite_v1 proposal.
//   2. `tools/release-sign manifest` + dry-run `sign` + `register` produce a TESTKEY-marked
//      dry-run candidate whose preimage matches E0's own canonical bytes, registered as an inert
//      cbc_suite_v1 release-registry entry.
//   3. `tools/retro-validate run` replays the promoted dangerous-miss corpus (P4-T8) pinned to a
//      dry-run registry digest and emits a deterministic software-agreement report.
//   4. Four inert-state assertions, individually named below: (a) synthetic marks present
//      everywhere; (b) zero approver fields anywhere; (c) zero real signatures anywhere;
//      (d) zero release-ready transitions anywhere.
//   5. The discordance→adjudication handoff (P4-T5 ↔ P2 scaffold) round-trips.
//
// This is THE R-P3 seam task for Phase 5 (per the parent plan's own R-P3 rule): general-purpose is
// integration owner, proving P2's review-record workflow, P3's release-sign chain, and P4's
// retro-validate harness compose correctly end to end, over the SAME module (cbc_suite_v1),
// without any task claiming to clear, advance, or partially satisfy gates G0–G4. Every artifact
// this test touches is synthetic/dry-run-marked; nothing here is, or may be read as, a clinical-
// validity, safety, or release-authorization claim.
//
// -----------------------------------------------------------------------------------------------
// A DELIBERATE, DOCUMENTED NON-EQUIVALENCE: hop 2's registry `packDigest` vs hop 3's registry
// `packDigest` are NOT, and cannot be, the same number.
// -----------------------------------------------------------------------------------------------
//
// `tools/release-sign`'s `register` computes `packDigest` as a SHA-256 over every file's
// (relative-path + raw content) under a staged kb-pack directory, streamed through one running
// hash (`tools/release-sign/lib/pack-digest.mjs`). `tools/retro-validate`'s own candidate
// resolution computes `packDigest` as a SHA-256 over a small JSON object binding the SHA-256 of
// `rules.json`'s bytes and `candidates.json`'s bytes (`tools/retro-validate/lib/replay.mjs`'s own
// internal `computePackDigest`) — a *different* hash construction over *different* input framing.
// `tools/retro-validate/README.md`'s own "Version-pinned replay" section says this outright: "This
// is a dry-run, E1-only digest algorithm … it makes no claim to match whatever production kb-pack
// hashing Phase 3/5 eventually ships." Forcing these two independently-scoped, tool-owned digests
// to collide is not merely undone work — it would require inverting SHA-256 (a preimage attack),
// which is not something any task in this repository does or should attempt.
//
// This test therefore proves the seam at the level the codebase's own design actually supports:
// hop 2 registers a real, freshly-produced TESTKEY dry-run candidate for `cbc_suite_v1` into a
// `schemas/release-registry.schema.json`-shaped registry (release-sign's own convention); hop 3
// replays the P4-T8-promoted corpus pinned against the P4-T8 task's own already-established
// `cbc_suite_v1` dry-run registry fixture (retro-validate's own convention, `tests/fixtures/
// ef-retro/registries/e0-dangerous-miss-cbc-suite-v1/`) — both are `signature: null`, pre-G2,
// non-`withdrawn` entries for the SAME module, validating against the SAME shared schema, and both
// are asserted below to be exactly that. What is proven equal is the MODULE identity and the
// INERT-POSTURE shape every hop shares; what is never claimed is byte-identical cross-tool digests
// — a claim nothing else in this repository makes either.

import test from 'node:test';
import assert from 'node:assert/strict';
import { verify as cryptoVerify, createPublicKey } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate as validateAgainstSchema } from '../scripts/lib/json-schema-lite.mjs';

// --- Workstream A (P2): review-record chain -----------------------------------------------------
import { REVIEW_ROLES, listModuleReviewRecords } from '../tools/review-record/lib/store.mjs';
import { checkModuleChainLinkage } from '../tools/review-record/lib/chain.mjs';
import { checkReviewerIndependence } from '../tools/review-record/lib/independence.mjs';
import { verifyRecordSignature } from '../tools/review-record/lib/signature.mjs';
import { loadRosterIndex, resolveReviewer } from '../tools/review-record/lib/roster.mjs';
import { run as runReviewValidate } from '../tools/review-record/lib/verbs/validate.mjs';
import { isExpectedTerminalNonQualifyingViolations } from '../tools/review-record/lib/verbs/dry-run.mjs';
import { run as runScaffold } from '../tools/review-record/lib/verbs/scaffold.mjs';
import { ValidationFailedError, EXIT_OK as REVIEW_EXIT_OK } from '../tools/review-record/lib/errors.mjs';

// --- Workstream B (P3): release-sign chain -------------------------------------------------------
import { run as runManifest } from '../tools/release-sign/lib/manifest.mjs';
import { run as runSign } from '../tools/release-sign/lib/sign.mjs';
import { run as runRegister } from '../tools/release-sign/lib/registry.mjs';
import { run as runVerify } from '../tools/release-sign/lib/verify.mjs';
import { readCanonicalManifestBytes, sha256Hex } from '../tools/release-sign/lib/canonical-bytes.mjs';
import { run as runPropose } from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';

// --- Workstream C (P4): retro-validate harness ----------------------------------------------------
import { checkFixtures } from '../tools/retro-validate/lib/boundary.mjs';
import { defaultOutputDir } from '../tools/retro-validate/lib/replay.mjs';
import { run as runRetroRun } from '../tools/retro-validate/lib/verbs/run.mjs';
import { run as runRetroReport } from '../tools/retro-validate/lib/verbs/report.mjs';
import {
  ADAPTER_CORPUS_DIR,
  ADAPTER_CORPUS_ID,
} from '../tools/retro-validate/lib/adapters/e0-dangerous-miss-cbc-suite.mjs';
import { computeDiscordanceRecords, toAdjudicationScaffoldInput } from '../tools/retro-validate/lib/discordance.mjs';
import { resolveCandidate, replayCorpus } from '../tools/retro-validate/lib/replay.mjs';
import { loadCorpusDocument } from '../tools/retro-validate/lib/corpus.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE_ID = 'cbc_suite_v1';

const REVIEW_RECORD_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');
const REGISTRY_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-registry.schema.json');
const RF_FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', MODULE_ID, 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', MODULE_ID, 'authoring-decisions.yaml');

// P4-T8's own already-established, already-tested dry-run registry fixture for exactly this
// promoted corpus — see this file's header for why hop 3 pins against retro-validate's own
// registry convention rather than an artificially-forced cross-tool digest.
const RETRO_DRY_RUN_REGISTRY_PATH = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'ef-retro', 'registries', 'e0-dangerous-miss-cbc-suite-v1', 'registry.json',
);
const RETRO_DRY_RUN_DIGEST = 'sha256:f1a885677a377bd31cf91ab4f55be096599a6812a27a234ef07a52dbda975975';

// The already-established P4-T5 discordance→adjudication scaffold-bridge fixture set — reused, not
// re-derived, per this repo's own DRY convention for tool-local test fixtures (this hop proves the
// MECHANISM composes, independent of which corpus produced the discordant replay).
const RETRO_FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-retro');
const METRICS_CORPUS_DIR = path.join(RETRO_FIXTURES_ROOT, 'metrics-corpus');
const VALID_REGISTRY_PATH = path.join(RETRO_FIXTURES_ROOT, 'registries', 'valid', 'registry.json');
const VALID_DIGEST = 'sha256:ef1adfb4d4e2640812f9d1de363c68c979c9c159b60ede121376e1befbe7212c';
const SCAFFOLD_BRIDGE_FIXTURES_ROOT = path.join(RETRO_FIXTURES_ROOT, 'discordance-adjudication-scaffold');

async function readJson(p) {
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

test('P5-T1 E2E dry-run: the synthetic chain — P2 review → P3 release-sign → P4 retro-validate — composes over cbc_suite_v1, all synthetic/dry-run-marked, zero release-ready transitions', async (t) => {
  const tmpDirs = [];
  async function mkTmp(prefix) {
    const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
  }

  // Artifacts gathered across hops, asserted together at the end (the four named inert-state checks).
  const collectedArtifacts = {};

  try {
    // ===========================================================================================
    // HOP 1 — the P2-T8 five-role review cycle validates chain-green over the cbc_suite_v1 proposal
    // ===========================================================================================
    await t.test('hop 1: the real, committed cbc_suite_v1 review chain is schema-valid, roster-resolved, chain-linked, signature-verified, independence-clean, and reaches exactly the expected FR-6 terminal state ("chain-green")', async () => {
      const schema = await readJson(REVIEW_RECORD_SCHEMA_PATH);
      const records = await listModuleReviewRecords(REPO_ROOT, MODULE_ID);
      assert.equal(records.length, 5, 'expected all 5 ADR-0004 role records');
      assert.deepEqual(records.map((r) => r.role), REVIEW_ROLES, 'expected role order');

      const rosterIndex = await loadRosterIndex(REPO_ROOT);
      for (const entry of records) {
        const errors = validateAgainstSchema(schema, entry.record);
        assert.deepEqual(errors, [], `${entry.reviewId}: ${JSON.stringify(errors)}`);
        assert.equal(entry.record.synthetic, true, `${entry.reviewId} must be synthetic:true`);

        const rosterEntry = resolveReviewer(rosterIndex, entry.record.reviewerId, MODULE_ID);
        assert.equal(rosterEntry.synthetic, true, `${entry.reviewId}'s roster entry must be synthetic:true`);

        const sigResult = verifyRecordSignature(entry.record);
        assert.equal(sigResult.ok, true, `${entry.reviewId} signature must verify: ${sigResult.reason}`);
        assert.match(entry.record.signature.keyId, /^TESTKEY-/);
      }

      const chainReport = checkModuleChainLinkage(records);
      assert.ok(chainReport.every((link) => link.ok), `expected a clean chain: ${JSON.stringify(chainReport)}`);

      const c1 = records.find((r) => r.role === 'clinical-1').record;
      const c2 = records.find((r) => r.role === 'clinical-2').record;
      assert.deepEqual(checkReviewerIndependence(c1, c2), []);

      // "chain-green": tools/review-record validate over the complete committed set rejects with
      // EXACTLY the one expected, structural, by-design FR-6 non-qualifying finding — a synthetic
      // set can never satisfy release authorization — never any OTHER validation failure.
      await assert.rejects(
        () => runReviewValidate({ module: MODULE_ID, root: REPO_ROOT }),
        (err) => {
          assert.ok(err instanceof ValidationFailedError);
          assert.equal(
            isExpectedTerminalNonQualifyingViolations(err.violations),
            true,
            `expected exactly the FR-6 synthetic-set violation, got: ${JSON.stringify(err.violations)}`,
          );
          return true;
        },
      );

      collectedArtifacts.hop1Records = records;
    });

    // ===========================================================================================
    // HOP 2 — manifest + dry-run sign + register: a TESTKEY dry-run candidate whose preimage
    // matches E0's own canonical bytes, registered as an inert cbc_suite_v1 registry entry
    // ===========================================================================================
    const packDir = await mkTmp('ef-e2e-p5t1-pack-');
    const directProposeDir = await mkTmp('ef-e2e-p5t1-direct-propose-');
    const candidatePath = path.join(await mkTmp('ef-e2e-p5t1-candidate-'), 'release-candidate.dryrun.json');
    const registryPath = path.join(await mkTmp('ef-e2e-p5t1-registry-'), 'registry.json');
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [] }, null, 2)}\n`, 'utf8');

    let manifestResult;
    let signResult;
    let registerResult;

    await t.test('hop 2a: manifest — the release-candidate signing preimage is byte-identical to a direct, independent E0 rf-bundle-to-kb-pack propose run (E0 canonical bytes)', async () => {
      manifestResult = await withCapturedStdout(() =>
        runManifest({ runDir: RF_FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: packDir }),
      );

      // Independent E0 run, never re-using manifest's own delegated build.
      await withCapturedStdout(() =>
        runPropose({ runDir: RF_FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: directProposeDir }),
      );
      const { sha256: directSha256, bytes: directBytes } = await readCanonicalManifestBytes(directProposeDir);

      assert.equal(manifestResult.preimageSha256, `sha256:${directSha256}`, 'manifest\'s preimage must equal E0\'s own independently-produced canonical bytes digest');

      // Byte-for-byte, not just digest equality.
      const { bytes: packBytes } = await readCanonicalManifestBytes(packDir);
      assert.ok(packBytes.equals(directBytes), 'manifest\'s delegated build must be byte-identical to a direct propose run');
    });

    await t.test('hop 2b: sign --dry-run — a structurally + cryptographically correct TESTKEY-forced signature over that exact preimage', async () => {
      signResult = await withCapturedStdout(() =>
        runSign({ candidate: packDir, dryRun: true, keyId: 'ef-p5t1-e2e-dryrun', outCandidate: candidatePath }),
      );

      assert.equal(signResult.dryRun, true);
      assert.match(signResult.signature.keyId, /^TESTKEY-/);
      assert.equal(signResult.preimageSha256, manifestResult.preimageSha256, 'sign must never re-derive or diverge from manifest\'s own preimage');

      const { bytes } = await readCanonicalManifestBytes(packDir);
      const publicKeyObj = createPublicKey(signResult.signerPublicKey.value);
      const ok = cryptoVerify(null, bytes, publicKeyObj, Buffer.from(signResult.signature.value, 'base64'));
      assert.equal(ok, true, 'the dry-run signature must cryptographically verify over the exact manifest preimage bytes');
    });

    await t.test('hop 2c: register — appends an inert (signature: null, non-withdrawn) cbc_suite_v1 entry; verify confirms the dry-run candidate end to end', async () => {
      registerResult = await withCapturedStdout(() => runRegister({ candidate: candidatePath, registry: registryPath }));

      assert.equal(registerResult.entry.moduleId, MODULE_ID);
      assert.equal(registerResult.entry.manifestDigest, manifestResult.preimageSha256);
      assert.match(registerResult.entry.packDigest, /^sha256:[0-9a-f]{64}$/);
      // The registered entry itself carries NO real signature, ever — see registry.mjs's own
      // "never trusts the candidate document" contract (README, "register verb usage").
      assert.equal(registerResult.entry.signature, null);
      assert.equal(registerResult.entry.signedAt, null);
      assert.equal(registerResult.entry.withdrawalState, 'none');
      assert.equal(registerResult.entry.withdrawnAt, null);

      const registryDoc = await readJson(registryPath);
      const schema = await readJson(REGISTRY_SCHEMA_PATH);
      assert.deepEqual(validateAgainstSchema(schema, registryDoc), []);

      // verify closes the loop: the dry-run candidate, checked against the registry it was just
      // registered into, is internally consistent end to end (release-sign's own CI-reachable
      // surface, ruling R3 — CI can never sign, only verify).
      const verifyResult = await withCapturedStdout(() => runVerify({ candidate: candidatePath, registry: registryPath }));
      assert.equal(verifyResult.verified, true);
      assert.equal(verifyResult.dryRun, true);
      assert.match(verifyResult.keyId, /^TESTKEY-/);

      collectedArtifacts.hop2 = { manifestResult, signResult, registerResult, registryDoc };
    });

    // ===========================================================================================
    // HOP 3 — retro-validate run replays the P4-T8-promoted corpus pinned to a dry-run registry
    // digest and emits a deterministic software-agreement report
    // ===========================================================================================
    let replayOutputDir;
    let reportRun1;
    let reportRun2;

    await t.test('hop 3: retro-validate run+report replays the promoted dangerous-miss corpus pinned to a cbc_suite_v1 dry-run registry digest, emitting a deterministic software-agreement report', async () => {
      // Sanity: the pinning registry is itself a schema-valid, inert (signature: null, non-
      // withdrawn), cbc_suite_v1-scoped dry-run entry — same shape/schema as hop 2's own registry.
      const retroRegistryDoc = await readJson(RETRO_DRY_RUN_REGISTRY_PATH);
      const registrySchema = await readJson(REGISTRY_SCHEMA_PATH);
      assert.deepEqual(validateAgainstSchema(registrySchema, retroRegistryDoc), []);
      const retroEntry = retroRegistryDoc.entries.find((e) => e.packDigest === RETRO_DRY_RUN_DIGEST);
      assert.ok(retroEntry, 'expected the pinning digest to resolve to a real registry entry');
      assert.equal(retroEntry.moduleId, MODULE_ID);
      assert.equal(retroEntry.signature, null);
      assert.equal(retroEntry.withdrawalState, 'none');

      await checkFixtures(ADAPTER_CORPUS_DIR); // FR-20 boundary — every verb calls this first

      await withCapturedStdout(() =>
        runRetroRun({ corpus: ADAPTER_CORPUS_DIR, candidateDigest: RETRO_DRY_RUN_DIGEST, registry: RETRO_DRY_RUN_REGISTRY_PATH }),
      );
      replayOutputDir = defaultOutputDir({ corpusId: ADAPTER_CORPUS_ID, candidateDigest: RETRO_DRY_RUN_DIGEST });
      const replayDocument = await readJson(path.join(replayOutputDir, 'replay-output.json'));
      assert.equal(replayDocument.corpusId, ADAPTER_CORPUS_ID);
      assert.equal(replayDocument.candidate.moduleId, MODULE_ID);
      assert.equal(replayDocument.candidate.packDigest, RETRO_DRY_RUN_DIGEST);

      await withCapturedStdout(() => runRetroReport({ corpus: ADAPTER_CORPUS_DIR, run: replayOutputDir }));
      reportRun1 = await readJson(path.join(replayOutputDir, 'agreement-report.json'));

      assert.equal(reportRun1.reportKind, 'software-agreement-report');
      assert.equal(reportRun1.candidate.moduleId, MODULE_ID);
      assert.equal(reportRun1.candidate.packDigest, RETRO_DRY_RUN_DIGEST);
      assert.match(reportRun1.banners.softwareAgreementNegation, /SOFTWARE AGREEMENT/);
      assert.equal(reportRun1.banners.nonQualifyingProtocol.qualifying, false);
      for (const measure of Object.values(reportRun1.softwareAgreementMeasures)) {
        assert.equal(measure.label, 'software agreement');
      }
      // "sensitivity"/"specificity"/"clinical performance" are permitted in EXACTLY ONE place —
      // the explicit negation banner itself (lib/metrics.mjs's own header contract) — and nowhere
      // else in the document.
      const { softwareAgreementNegation, ...otherBanners } = reportRun1.banners;
      const reportTextMinusNegationBanner = JSON.stringify({ ...reportRun1, banners: otherBanners }).toLowerCase();
      for (const forbidden of ['sensitivity', 'specificity', 'clinical performance']) {
        assert.ok(
          !reportTextMinusNegationBanner.includes(forbidden),
          `agreement-report.json must never use the forbidden clinical-performance term "${forbidden}" outside its own negation banner`,
        );
      }

      // Deterministic: a second report invocation over the same replay output is byte-identical.
      await withCapturedStdout(() => runRetroReport({ corpus: ADAPTER_CORPUS_DIR, run: replayOutputDir }));
      reportRun2 = await readJson(path.join(replayOutputDir, 'agreement-report.json'));
      assert.deepEqual(reportRun1, reportRun2, 'two report runs over identical inputs must be byte-identical (determinism)');

      const provenance = await readJson(path.join(replayOutputDir, 'run-provenance.json'));
      assert.equal(provenance.corpusId, ADAPTER_CORPUS_ID);
      assert.equal(provenance.candidateRegistryDigest, RETRO_DRY_RUN_DIGEST);

      collectedArtifacts.hop3 = { replayDocument, reportRun1, provenance, retroEntry };
    });

    // ===========================================================================================
    // HOP 4 — the discordance→adjudication handoff (P4-T5 ↔ P2 scaffold) round-trips
    // ===========================================================================================
    await t.test('hop 4: the discordance→adjudication handoff round-trips through the REAL tools/review-record scaffold --role adjudication verb', async () => {
      const { parsed: metricsCorpusDoc } = await loadCorpusDocument(METRICS_CORPUS_DIR);
      const candidate = await resolveCandidate({ registryPath: VALID_REGISTRY_PATH, candidateDigest: VALID_DIGEST });
      const replayDocument = replayCorpus({ corpusDoc: metricsCorpusDoc, candidate });

      const discordanceRecords = computeDiscordanceRecords(replayDocument);
      assert.ok(discordanceRecords.length > 0, 'sanity: expected at least one discordance record to round-trip');

      for (const record of discordanceRecords) {
        const scaffoldOptions = toAdjudicationScaffoldInput(record, {
          reviewerId: 'synthetic-discordance-adjudicator',
          decision: 'request-changes',
          reviewedAt: '2026-07-22T00:00:00Z',
          root: SCAFFOLD_BRIDGE_FIXTURES_ROOT,
        });
        assert.equal(scaffoldOptions.role, 'adjudication');
        assert.match(scaffoldOptions.subject, /^sha256:[0-9a-f]{64}$/);

        const code = await withCapturedStdout(() => runScaffold(scaffoldOptions));
        assert.equal(code, REVIEW_EXIT_OK, `scaffold rejected discordance record ${record.discordanceId}`);
      }

      collectedArtifacts.hop4DiscordanceRecords = discordanceRecords;
    });

    // ===========================================================================================
    // The four inert-state assertions, individually named (checked across every hop's artifacts).
    // ===========================================================================================

    await t.test('inert-state (a): synthetic/dry-run marks are present on every hop\'s own artifact', () => {
      for (const entry of collectedArtifacts.hop1Records) {
        assert.equal(entry.record.synthetic, true, `${entry.reviewId} must be synthetic:true`);
      }
      assert.equal(collectedArtifacts.hop2.signResult.dryRun, true);
      assert.match(collectedArtifacts.hop2.signResult.signature.keyId, /^TESTKEY-/);
      assert.equal(collectedArtifacts.hop3.replayDocument.cases.every((c) => c.provenance === 'synthetic'), true);
    });

    await t.test('inert-state (b): zero approver fields exist anywhere across all three hops\' artifacts', async () => {
      const schema = await readJson(REVIEW_RECORD_SCHEMA_PATH);
      assert.equal('approvedBy' in schema.properties, false);
      assert.equal('clinicalApprovers' in schema.properties, false);
      for (const entry of collectedArtifacts.hop1Records) {
        assert.equal('approvedBy' in entry.record, false);
        assert.equal('clinicalApprovers' in entry.record, false);
      }
      const hop2Text = JSON.stringify(collectedArtifacts.hop2.registerResult) + JSON.stringify(collectedArtifacts.hop2.registryDoc);
      assert.doesNotMatch(hop2Text, /"approvedBy"|"clinicalApprovers"/);
      const hop3Text = JSON.stringify(collectedArtifacts.hop3.reportRun1);
      assert.doesNotMatch(hop3Text, /"approvedBy"|"clinicalApprovers"/);

      const realModuleManifest = await readJson(REAL_MODULE_PATH);
      assert.deepEqual(realModuleManifest.approvedBy, [], 'the real committed module.json must still carry an empty approvedBy[] (schema-forced ceiling, untouched by this test)');
    });

    await t.test('inert-state (c): zero real (non-dry-run) signatures exist anywhere', () => {
      for (const entry of collectedArtifacts.hop1Records) {
        assert.match(entry.record.signature.keyId, /^TESTKEY-/, `${entry.reviewId} must carry a TESTKEY- signature only`);
      }
      assert.equal(collectedArtifacts.hop2.registerResult.entry.signature, null, 'the persisted registry entry must never carry a real signature');
      assert.equal(collectedArtifacts.hop3.retroEntry.signature, null, 'the hop 3 pinning registry entry must never carry a real signature');
    });

    await t.test('inert-state (d): zero release-ready transitions occur anywhere', async () => {
      const realModuleManifest = await readJson(REAL_MODULE_PATH);
      assert.equal(realModuleManifest.status, 'unsigned-stub', 'the real committed module.json status must remain unsigned-stub — untouched by this dry-run chain');

      const scanForReleaseReady = (label, doc) => {
        const text = JSON.stringify(doc);
        assert.doesNotMatch(text, /release-ready/i, `${label} must never carry a "release-ready" state`);
      };
      scanForReleaseReady('hop2 registerResult', collectedArtifacts.hop2.registerResult);
      scanForReleaseReady('hop2 registryDoc', collectedArtifacts.hop2.registryDoc);
      scanForReleaseReady('hop3 agreement-report.json', collectedArtifacts.hop3.reportRun1);
      scanForReleaseReady('hop1 records', collectedArtifacts.hop1Records.map((r) => r.record));
    });
  } finally {
    for (const dir of tmpDirs) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});
