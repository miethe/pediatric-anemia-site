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
// `packDigest` are NOT, and cannot be, the same number — but hop 3 threads hop 2's ACTUAL registry
// artifact forward anyway, and hop 4 documents, rather than papers over, the one seam it cannot
// literally cross.
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
// This test therefore proves the seam at the level the codebase's own design actually supports —
// and threads what genuinely CAN be threaded, rather than stopping at "the digests differ" as an
// excuse to run two unrelated registries side by side:
//
//   HOP 2 → HOP 3: hop 3 does NOT read a wholly disconnected registry fixture. It reads hop 2's
//   OWN `registryPath` document (the exact file `tools/release-sign`'s `register` verb just wrote
//   hop 2's TESTKEY dry-run candidate into), asserts hop 2's entry is still there byte-for-byte
//   unmodified (append-only, non-destructive), and then EXTENDS that same document in place with a
//   second, `cbc_suite_v1`-scoped entry that uses retro-validate's OWN `packDigest` convention (the
//   already-established P4-T8 `e0-dangerous-miss-cbc-suite-v1` fixture's digest and pinned
//   candidate content — reused, not re-derived, per this tool's own DRY convention). One shared
//   registry FILE, two tool-owned digest conventions, both scoped to the same module, both
//   `signature: null` / non-`withdrawn` — that is the real, literal composition this design
//   supports; a single numeric `packDigest` shared across tools is not.
//
//   HOP 3 → HOP 4: hop 3's own promoted corpus (`e0-dangerous-miss-cbc-suite-v1`) is DELIBERATELY
//   concordant by design — it exists to prove the marrow-red-flag safety alert correctly fires and
//   is not suppressed by a co-occurring benign-differential match, not to exercise a disagreement.
//   `computeDiscordanceRecords` over hop 3's own real replay document therefore returns `[]` — this
//   test asserts that fact explicitly below, rather than silently swapping corpora. There is
//   structurally nothing for hop 4 to adjudicate FROM hop 3. Hop 4 instead drives
//   `tools/retro-validate`'s REAL `run` verb (the identical `runRetroRun` hop 3 calls, not the
//   lower-level `resolveCandidate`/`replayCorpus` library internals) over this repo's one corpus
//   fixture engineered to contain actual discordances (`metrics-corpus`, the same fixture
//   `tests/ef-retro-discordance.test.mjs`'s own INTEGRATION test already bridges to
//   `tools/review-record`), so the discordance→adjudication mechanism is proven through the real
//   verb boundary/gate/on-disk-artifact path end to end — composing the MECHANISM, not a borrowed,
//   unrelated corpus pretending to be hop 3's own output.

import test from 'node:test';
import assert from 'node:assert/strict';
import { verify as cryptoVerify, createPublicKey } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
import { loadCorpusDocument } from '../tools/retro-validate/lib/corpus.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE_ID = 'cbc_suite_v1';

const REVIEW_RECORD_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');
const REGISTRY_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-registry.schema.json');
const RF_FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', MODULE_ID, 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', MODULE_ID, 'authoring-decisions.yaml');

// P4-T8's own already-established, already-tested dry-run registry fixture for exactly this
// promoted corpus — see this file's header. Hop 3 no longer replays against this file directly;
// it copies this fixture's ALREADY-VERIFIED pinned candidate content (reused, not re-derived) into
// a sibling directory next to hop 2's OWN registryPath, then extends hop 2's document in place with
// an entry naming this same digest — so hop 3 pins against retro-validate's own digest convention
// while literally composing over hop 2's own registry artifact, not a disconnected file.
const RETRO_DRY_RUN_REGISTRY_PATH = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'ef-retro', 'registries', 'e0-dangerous-miss-cbc-suite-v1', 'registry.json',
);
const RETRO_DRY_RUN_DIGEST = 'sha256:f1a885677a377bd31cf91ab4f55be096599a6812a27a234ef07a52dbda975975';
const RETRO_FIXTURE_CANDIDATE_VERSION = '0.1.0-2026-07-21-fixture';
const RETRO_DRY_RUN_CANDIDATE_CONTENT_DIR = path.join(
  path.dirname(RETRO_DRY_RUN_REGISTRY_PATH), 'candidates', MODULE_ID, RETRO_FIXTURE_CANDIDATE_VERSION,
);
// The version label + placeholder manifestDigest for the SECOND entry hop 3 appends to hop 2's own
// registry document (see this file's header) — the `-dryrun` suffix is this entry's own inert-state
// mark (inert-state check (a) below asserts it), distinct from hop 2's release-sign-native entry so
// the two never collide on (moduleId, version).
const HOP3_COMPOSED_ENTRY_VERSION = 'p5t1-hop3-retro-native-dryrun';
const HOP3_COMPOSED_ENTRY_MANIFEST_DIGEST = `sha256:${'0'.repeat(64)}`;

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

// Same suppression contract as `withCapturedStdout`, but the suppressed text is retained and
// returned rather than discarded — needed for hop 4's `scaffold` call, whose "DRAFT ONLY — NOT
// WRITTEN TO DISK" branch (see `tools/review-record/lib/verbs/scaffold.mjs`) prints the fully-shaped
// draft record as its ONLY artifact (a synthetic roster persona's draft is never written to disk,
// by design — see that file's header). The inert-state sweep below needs that printed text to
// inspect, not just the verb's bare exit code.
async function withCapturedStdoutText(fn) {
  const original = process.stdout.write.bind(process.stdout);
  let captured = '';
  process.stdout.write = (chunk) => {
    captured += chunk;
    return true;
  };
  try {
    const result = await fn();
    return { result, output: captured };
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

    await t.test('hop 3: retro-validate run+report extends hop 2\'s OWN registry document with a retro-validate-scoped cbc_suite_v1 entry, then replays the promoted dangerous-miss corpus pinned to it, emitting a deterministic software-agreement report', async () => {
      // Hop 2's registry document, unmodified so far: exactly the one release-sign entry hop 2c
      // registered. Composition starts from hop 2's REAL output, not a copy of it.
      const registryDocBeforeHop3 = await readJson(registryPath);
      assert.equal(registryDocBeforeHop3.entries.length, 1, 'sanity: only hop 2\'s own entry exists in this registry so far');
      assert.deepEqual(registryDocBeforeHop3.entries[0], registerResult.entry, 'hop 2\'s registered entry must still be exactly what hop 2 produced, byte-for-byte, before hop 3 extends it');

      // The pinned candidate content hop 3's new entry attests to — copied verbatim from the
      // already-established, already-tested P4-T8 dry-run fixture (reused, not re-derived; see
      // this file's header and the RETRO_DRY_RUN_REGISTRY_PATH constant's own comment above).
      const hop3CandidateContentDir = path.join(path.dirname(registryPath), 'candidates', MODULE_ID, HOP3_COMPOSED_ENTRY_VERSION);
      await mkdir(hop3CandidateContentDir, { recursive: true });
      await copyFile(path.join(RETRO_DRY_RUN_CANDIDATE_CONTENT_DIR, 'rules.json'), path.join(hop3CandidateContentDir, 'rules.json'));
      await copyFile(path.join(RETRO_DRY_RUN_CANDIDATE_CONTENT_DIR, 'candidates.json'), path.join(hop3CandidateContentDir, 'candidates.json'));

      // Extend hop 2's OWN registry document IN PLACE — the SAME file `tools/release-sign`'s
      // `register` verb wrote hop 2's candidate into — with a second, retro-validate-scoped entry
      // for the SAME module. This is the literal composition this design supports (see this file's
      // header): one shared registry document, two independently-scoped, tool-owned `packDigest`
      // conventions, both `cbc_suite_v1`, both `signature: null`, both non-`withdrawn`.
      const hop3Entry = {
        version: HOP3_COMPOSED_ENTRY_VERSION,
        moduleId: MODULE_ID,
        packDigest: RETRO_DRY_RUN_DIGEST,
        manifestDigest: HOP3_COMPOSED_ENTRY_MANIFEST_DIGEST,
        signature: null,
        signedAt: null,
        supersedes: null,
        withdrawalState: 'none',
        withdrawnAt: null,
        withdrawalReason: null,
      };
      const registrySchema = await readJson(REGISTRY_SCHEMA_PATH);
      const composedRegistryDocBeforeRun = { ...registryDocBeforeHop3, entries: [...registryDocBeforeHop3.entries, hop3Entry] };
      assert.deepEqual(validateAgainstSchema(registrySchema, composedRegistryDocBeforeRun), []);
      await writeFile(registryPath, `${JSON.stringify(composedRegistryDocBeforeRun, null, 2)}\n`, 'utf8');

      await checkFixtures(ADAPTER_CORPUS_DIR); // FR-20 boundary — every verb calls this first

      await withCapturedStdout(() =>
        // registry: registryPath — hop 2's OWN registry document, now extended in place with
        // hop3Entry above. `resolveCandidate` (inside `run`) independently re-verifies
        // hop3CandidateContentDir's bytes hash to RETRO_DRY_RUN_DIGEST before this can succeed — a
        // wrong/drifted copy fails closed here, exactly like P4-T3's own drift proof.
        runRetroRun({ corpus: ADAPTER_CORPUS_DIR, candidateDigest: RETRO_DRY_RUN_DIGEST, registry: registryPath }),
      );
      replayOutputDir = defaultOutputDir({ corpusId: ADAPTER_CORPUS_ID, candidateDigest: RETRO_DRY_RUN_DIGEST });
      const replayDocument = await readJson(path.join(replayOutputDir, 'replay-output.json'));
      assert.equal(replayDocument.corpusId, ADAPTER_CORPUS_ID);
      assert.equal(replayDocument.candidate.moduleId, MODULE_ID);
      assert.equal(replayDocument.candidate.packDigest, RETRO_DRY_RUN_DIGEST);

      const reportPath = path.join(replayOutputDir, 'agreement-report.json');
      await withCapturedStdout(() => runRetroReport({ corpus: ADAPTER_CORPUS_DIR, run: replayOutputDir }));
      const reportBytes1 = await readFile(reportPath);
      reportRun1 = JSON.parse(reportBytes1.toString('utf8'));

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
      // Primary assertion is RAW FILE BYTES (Buffer equality on the exact written content); the
      // parsed-object deepEqual is kept only as a secondary, human-readable diagnostic.
      await withCapturedStdout(() => runRetroReport({ corpus: ADAPTER_CORPUS_DIR, run: replayOutputDir }));
      const reportBytes2 = await readFile(reportPath);
      reportRun2 = JSON.parse(reportBytes2.toString('utf8'));
      assert.ok(
        reportBytes1.equals(reportBytes2),
        'two report runs over identical inputs must be byte-identical (determinism) — compared as raw file bytes',
      );
      assert.deepEqual(reportRun1, reportRun2, 'secondary diagnostic: parsed-object comparison must also agree (subsumed by the byte-equality assertion above)');

      const provenance = await readJson(path.join(replayOutputDir, 'run-provenance.json'));
      assert.equal(provenance.corpusId, ADAPTER_CORPUS_ID);
      assert.equal(provenance.candidateRegistryDigest, RETRO_DRY_RUN_DIGEST);

      const composedRegistryDoc = await readJson(registryPath);
      assert.equal(composedRegistryDoc.entries.length, 2, 'the registry now carries both hop 2\'s release-sign entry AND hop 3\'s retro-validate entry, over the SAME document');
      assert.deepEqual(composedRegistryDoc.entries[0], registerResult.entry, 'hop 2\'s original entry must remain byte-for-byte unmodified (append-only)');

      collectedArtifacts.hop3 = { replayDocument, reportRun1, provenance, retroEntry: hop3Entry, composedRegistryDoc };
    });

    // ===========================================================================================
    // HOP 4 — the discordance→adjudication handoff (P4-T5 ↔ P2 scaffold) round-trips
    // ===========================================================================================
    await t.test('hop 4: the discordance→adjudication handoff round-trips through the REAL tools/retro-validate `run` verb and the REAL tools/review-record `scaffold --role adjudication` verb', async () => {
      // Hop 3's own promoted corpus is deliberately concordant (see this file's header) — proven
      // here, not assumed: computeDiscordanceRecords over hop 3's OWN real replay document yields
      // zero records, so there is genuinely nothing for hop 4 to consume FROM hop 3.
      assert.deepEqual(
        computeDiscordanceRecords(collectedArtifacts.hop3.replayDocument), [],
        'sanity: hop 3\'s own e0-dangerous-miss-cbc-suite-v1 replay must be concordant (documented in this file\'s header) — this is why hop 4 cannot thread hop 3\'s discordance output forward',
      );

      // The only corpus fixture in this repository engineered to contain actual discordances
      // (reused, not re-derived — the same fixture tests/ef-retro-discordance.test.mjs's own
      // INTEGRATION test already bridges to tools/review-record). Replayed via the REAL
      // `tools/retro-validate run` verb (`runRetroRun`, the identical verb hop 3 above calls) —
      // never the lower-level `resolveCandidate`/`replayCorpus` library internals directly — so
      // this hop exercises the real boundary-gate + on-disk-artifact path end to end, exactly like
      // hop 3 does.
      const { parsed: metricsCorpusDoc } = await loadCorpusDocument(METRICS_CORPUS_DIR);
      await checkFixtures(METRICS_CORPUS_DIR); // FR-20 boundary — every verb calls this first
      await withCapturedStdout(() =>
        runRetroRun({ corpus: METRICS_CORPUS_DIR, candidateDigest: VALID_DIGEST, registry: VALID_REGISTRY_PATH }),
      );
      const metricsOutputDir = defaultOutputDir({ corpusId: metricsCorpusDoc.corpusId, candidateDigest: VALID_DIGEST });
      const replayDocument = await readJson(path.join(metricsOutputDir, 'replay-output.json'));
      assert.equal(replayDocument.corpusId, metricsCorpusDoc.corpusId);

      const discordanceRecords = computeDiscordanceRecords(replayDocument);
      assert.ok(discordanceRecords.length > 0, 'sanity: expected at least one discordance record to round-trip');

      const scaffoldDrafts = [];
      for (const record of discordanceRecords) {
        const scaffoldOptions = toAdjudicationScaffoldInput(record, {
          reviewerId: 'synthetic-discordance-adjudicator',
          decision: 'request-changes',
          reviewedAt: '2026-07-22T00:00:00Z',
          root: SCAFFOLD_BRIDGE_FIXTURES_ROOT,
        });
        assert.equal(scaffoldOptions.role, 'adjudication');
        assert.match(scaffoldOptions.subject, /^sha256:[0-9a-f]{64}$/);

        // Captured (not discarded): the synthetic roster persona's draft is a "DRAFT ONLY — NOT
        // WRITTEN TO DISK" print-to-stdout artifact (see tools/review-record/lib/verbs/
        // scaffold.mjs's own header) — this IS hop 4's real output, and the inert-state sweep below
        // needs its actual text, not just a bare exit code.
        const { result: code, output: scaffoldOutput } = await withCapturedStdoutText(() => runScaffold(scaffoldOptions));
        assert.equal(code, REVIEW_EXIT_OK, `scaffold rejected discordance record ${record.discordanceId}`);
        assert.match(scaffoldOutput, /DRAFT ONLY — NOT WRITTEN TO DISK/, 'the drafted adjudication record must never be silently written to disk pre-G1');
        scaffoldDrafts.push(scaffoldOutput);
      }

      collectedArtifacts.hop4 = { replayDocument, discordanceRecords, scaffoldDrafts };
    });

    // ===========================================================================================
    // The four inert-state assertions, individually named — each is a FULL sweep across every
    // artifact every hop produced (hop 1's five review records; hop 2's manifest/sign/register
    // results; hop 3's replay/report/provenance AND the final two-entry composed registry document
    // hop 3 wrote back to hop 2's own registryPath; hop 4's metrics-corpus replay, discordance
    // records, and captured scaffold-draft text) — never cherry-picked fields.
    // ===========================================================================================

    // Everything JSON-shaped from every hop, combined into one tree a single recursive walk can
    // cover. `hop3.composedRegistryDoc` alone carries BOTH hop 2's and hop 3's registry entries
    // (see hop 3 above), so it is not duplicated separately under a `hop2` registry key.
    const ALL_HOP_JSON_ARTIFACTS = {
      hop1Records: collectedArtifacts.hop1Records.map((r) => r.record),
      hop2: {
        manifestResult: collectedArtifacts.hop2.manifestResult,
        signResult: collectedArtifacts.hop2.signResult,
        registerResult: collectedArtifacts.hop2.registerResult,
      },
      hop3: {
        replayDocument: collectedArtifacts.hop3.replayDocument,
        reportRun1: collectedArtifacts.hop3.reportRun1,
        provenance: collectedArtifacts.hop3.provenance,
        composedRegistryDoc: collectedArtifacts.hop3.composedRegistryDoc,
      },
      hop4: {
        replayDocument: collectedArtifacts.hop4.replayDocument,
        discordanceRecords: collectedArtifacts.hop4.discordanceRecords,
      },
    };
    // Hop 4's scaffold drafts are captured YAML-shaped stdout text (never written to disk — see
    // hop 4 above), not JSON — appended as raw text so the (b)/(d) text-scan checks below cover
    // them too, alongside every JSON-shaped artifact from every hop.
    const ALL_HOP_TEXT = `${JSON.stringify(ALL_HOP_JSON_ARTIFACTS)}\n${collectedArtifacts.hop4.scaffoldDrafts.join('\n')}`;

    /** Recursively visits every own key of every plain object/array under `value`. */
    function walkJson(value, visit, pathPrefix = '$') {
      if (Array.isArray(value)) {
        value.forEach((item, i) => walkJson(item, visit, `${pathPrefix}[${i}]`));
        return;
      }
      if (value && typeof value === 'object') {
        for (const [key, val] of Object.entries(value)) {
          visit(key, val, `${pathPrefix}.${key}`);
          walkJson(val, visit, `${pathPrefix}.${key}`);
        }
      }
    }

    await t.test('inert-state (a): synthetic/dry-run marks are present on every hop\'s own artifact, hop 4 included', () => {
      for (const entry of collectedArtifacts.hop1Records) {
        assert.equal(entry.record.synthetic, true, `${entry.reviewId} must be synthetic:true`);
      }
      assert.equal(collectedArtifacts.hop2.signResult.dryRun, true);
      assert.match(collectedArtifacts.hop2.signResult.signature.keyId, /^TESTKEY-/);
      assert.equal(collectedArtifacts.hop3.replayDocument.cases.every((c) => c.provenance === 'synthetic'), true);
      assert.match(collectedArtifacts.hop3.retroEntry.version, /dryrun/, 'hop 3\'s composed registry entry must carry its own inert-state mark in its version label');
      assert.equal(collectedArtifacts.hop4.replayDocument.cases.every((c) => c.provenance === 'synthetic'), true, 'hop 4\'s metrics-corpus replay must be entirely synthetic-provenance');
      assert.ok(collectedArtifacts.hop4.scaffoldDrafts.length > 0, 'sanity: expected at least one hop 4 scaffold draft to inspect');
      for (const draft of collectedArtifacts.hop4.scaffoldDrafts) {
        assert.match(draft, /synthetic: true/, 'every hop 4 scaffold draft must carry synthetic: true');
      }
    });

    await t.test('inert-state (b): zero approver fields exist anywhere across every hop\'s artifacts, hop 4 included', async () => {
      const schema = await readJson(REVIEW_RECORD_SCHEMA_PATH);
      assert.equal('approvedBy' in schema.properties, false);
      assert.equal('clinicalApprovers' in schema.properties, false);

      assert.doesNotMatch(ALL_HOP_TEXT, /\b(approvedBy|clinicalApprovers)\b\s*:/, 'no artifact from any hop, hop 4 included, may carry an approvedBy/clinicalApprovers field');

      const realModuleManifest = await readJson(REAL_MODULE_PATH);
      assert.deepEqual(realModuleManifest.approvedBy, [], 'the real committed module.json must still carry an empty approvedBy[] (schema-forced ceiling, untouched by this test)');
    });

    await t.test('inert-state (c): zero real (non-dry-run) signatures exist anywhere, recursively, hop 4 included', () => {
      let signatureFieldsChecked = 0;
      walkJson(ALL_HOP_JSON_ARTIFACTS, (key, val, nodePath) => {
        if (key === 'signature' && val !== null) {
          signatureFieldsChecked += 1;
          assert.equal(typeof val, 'object', `${nodePath} must be null or a signature object, got ${typeof val}`);
          assert.match(val.keyId ?? '', /^TESTKEY-/, `${nodePath}.keyId must be TESTKEY-prefixed`);
        }
        if (key === 'keyId' && typeof val === 'string') {
          signatureFieldsChecked += 1;
          assert.match(val, /^TESTKEY-/, `${nodePath} must be TESTKEY-prefixed`);
        }
      });
      assert.ok(signatureFieldsChecked > 0, 'sanity: expected at least one signature/keyId field to have been visited by the recursive walk');
      assert.equal(collectedArtifacts.hop2.registerResult.entry.signature, null, 'the persisted release-sign registry entry must never carry a real signature');
      assert.equal(collectedArtifacts.hop3.retroEntry.signature, null, 'the hop 3 composed registry entry must never carry a real signature');
      for (const draft of collectedArtifacts.hop4.scaffoldDrafts) {
        assert.match(draft, /signature: null/, 'every hop 4 scaffold draft must carry signature: null (pre-G1 has no signing capability -- see tools/review-record/lib/verbs/scaffold.mjs\'s own header)');
      }
    });

    await t.test('inert-state (d): zero release-ready transitions occur anywhere, recursively, hop 4 included', async () => {
      const realModuleManifest = await readJson(REAL_MODULE_PATH);
      assert.equal(realModuleManifest.status, 'unsigned-stub', 'the real committed module.json status must remain unsigned-stub — untouched by this dry-run chain');
      assert.doesNotMatch(ALL_HOP_TEXT, /release-ready/i, 'no artifact from any hop, hop 4 included, may ever carry a "release-ready" state');
    });
  } finally {
    for (const dir of tmpDirs) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});
