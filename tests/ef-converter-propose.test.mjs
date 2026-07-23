// tests/ef-converter-propose.test.mjs — P3-T7 (evidence-foundry-buildout Phase 3, `02 §4.5`,
// `02 §4.6` phases 4-9).
//
// Task acceptance criteria (phase-3-5-projection-slice-manifest.md, row P3-T7):
//   1. "`propose` run against the fixture succeeds and every emitted file validates against its
//      schema" — proven below by running the real `propose` verb against the real, committed
//      `tests/fixtures/rf-cbc-001` fixture and the real, committed `modules/cbc_suite_v1/` module
//      package, then schema-validating every emitted file that has a dedicated schema
//      (`rules.json`, `rule-provenance.json`, `evidence.json`, `evidence-assertions.json`,
//      `candidates.json`, per-entry). `pack-provenance.json` and `rule-proposals.json` have no
//      dedicated schema — this plan's binding OQ-7 ruling names exactly 4 new schema files (none
//      of them these two) — so those two files are instead checked structurally.
//   2. "the conflict-visibility test fails if a `mixed` claim is ever the sole basis for a
//      generated rule" — proven both (a) directly against `assertNoSoleConflictedBasis` with a
//      synthetic stub `mixed`/`contradicted` claim (no real bundle involved at all, matching this
//      AC's own "stub" wording) and (b) as a real, non-vacuous check against the actual
//      `RULE_PROPOSALS` content and the real fixture's routing report.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONVERTER_NAME,
  CONVERTER_VERSION,
  ConflictedSoleBasisError,
  PACK_VERSION,
  assertNoSoleConflictedBasis,
  buildPackProvenance,
  resolveRuleEmissionGate,
  run as runPropose,
} from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { loadBundle } from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import { pinArtifacts } from '../tools/rf-bundle-to-kb-pack/lib/hashing.mjs';
import { checkEligibility } from '../tools/rf-bundle-to-kb-pack/lib/eligibility.mjs';
import { routeClaims } from '../tools/rf-bundle-to-kb-pack/lib/claim-routing.mjs';
import { RULE_PROPOSAL_REGISTRY, RULE_PROPOSALS } from '../tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs';
import {
  GovernanceError,
  RuleEmissionRefusedError,
  UsageError,
  EXIT_OK,
  EXIT_GOVERNANCE,
} from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const CONVERTER_ROOT = path.join(REPO_ROOT, 'tools', 'rf-bundle-to-kb-pack');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');
const REAL_MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

async function loadSchema(name) {
  return loadJson(path.join(REPO_ROOT, 'schemas', name));
}

async function withCapturedStdout(fn) {
  const chunks = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    return true;
  };
  try {
    const result = await fn();
    return { result, output: chunks.join('') };
  } finally {
    process.stdout.write = original;
  }
}

// =================================================================================================
// 1. propose run against the real fixture assembles a schema-valid full staged pack
// =================================================================================================

test('P3-T7: propose run against the real fixture + real cbc_suite_v1 module succeeds and emits all 7 files', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-propose-test-out-'));
  try {
    const { result: exitCode, output } = await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR,
        module: REAL_MODULE_PATH,
        decisions: REAL_DECISIONS_PATH,
        out: outDir,
      }),
    );

    assert.equal(exitCode, EXIT_OK);
    assert.ok(output.trim().length > 0, 'propose must print a non-empty summary');
    const summary = JSON.parse(output);
    assert.equal(summary.verb, 'propose');
    assert.equal(summary.moduleId, 'cbc_suite_v1');
    // claim-routing.mjs's rejection count is a LATER, stricter classification than
    // eligibility.mjs's (a "supported" claim eligibility already deemed a fact_candidate is still
    // routing-rejected unless evidence-assertions.json actually resolves an exact passage for it
    // -- and this module's evidence-assertions.json only carries the 19 assertions the 4 slice
    // rules actually cite, not all 74 supported claims in the fixture).
    assert.equal(summary.routing.eligibleForRuleEvidence, 27);
    assert.equal(summary.routing.conflictObjects, 0, 'the real fixture has 0 mixed/contradicted claims');
    assert.equal(summary.routing.rejected, 60);

    // ---- pack-provenance.json (no dedicated schema — checked structurally) ----
    const packProvenance = await loadJson(path.join(outDir, 'pack-provenance.json'));
    assert.equal(packProvenance.moduleId, 'cbc_suite_v1');
    assert.equal(packProvenance.packVersion, PACK_VERSION);
    assert.deepEqual(packProvenance.converter, { name: CONVERTER_NAME, version: CONVERTER_VERSION });
    assert.equal(packProvenance.rfBundleId, 'bundle_20260718_intent_research_20260717_rf_cbc_001');
    assert.equal(packProvenance.rfRunId, 'rf_run_20260717_rf_cbc_001_pediatric_cds_establish');
    assert.equal(packProvenance.rfIntentId, 'intent_research_20260717_rf_cbc_001_pediatric_cds_establish');
    assert.equal(packProvenance.upstreamVerification.bundleStatus, 'verified');
    assert.equal(typeof packProvenance.upstreamVerification.bundleSha256, 'string');
    assert.equal(packProvenance.upstreamVerification.bundleSha256.length, 64);
    assert.ok(Array.isArray(packProvenance.upstreamArtifacts) && packProvenance.upstreamArtifacts.length > 0);
    assert.ok(
      packProvenance.upstreamArtifacts.every((a) => typeof a.sha256 === 'string' && a.sha256.length === 64),
    );
    assert.equal(
      packProvenance.upstreamCounts.matches,
      true,
      `recorded vs. recalculated counts must agree: ${JSON.stringify(packProvenance.upstreamCounts)}`,
    );
    assert.equal(packProvenance.upstreamCounts.recalculated.claims_total, 87);
    assert.equal(packProvenance.dataClassification, 'personal');
    assert.equal(packProvenance.rfWritebackApproved, true);
    assert.ok(packProvenance.rfLineage && typeof packProvenance.rfLineage === 'object');

    // ---- evidence.json (byte-verbatim copy; validated against schemas/evidence.schema.json) ----
    const evidenceSchema = await loadSchema('evidence.schema.json');
    const evidenceDoc = await loadJson(path.join(outDir, 'evidence.json'));
    assert.deepEqual(validate(evidenceSchema, evidenceDoc), []);
    const committedEvidenceRaw = await readFile(path.join(REAL_MODULE_DIR, 'evidence.json'), 'utf8');
    const stagedEvidenceRaw = await readFile(path.join(outDir, 'evidence.json'), 'utf8');
    assert.equal(stagedEvidenceRaw, committedEvidenceRaw, 'evidence.json must be a byte-verbatim copy');

    // ---- evidence-assertions.json (validated against schemas/evidence-assertions.schema.json) ----
    const assertionsSchema = await loadSchema('evidence-assertions.schema.json');
    const assertionsDoc = await loadJson(path.join(outDir, 'evidence-assertions.json'));
    assert.deepEqual(validate(assertionsSchema, assertionsDoc), []);
    const committedAssertionsRaw = await readFile(
      path.join(REAL_MODULE_DIR, 'evidence-assertions.json'), 'utf8',
    );
    const stagedAssertionsRaw = await readFile(path.join(outDir, 'evidence-assertions.json'), 'utf8');
    assert.equal(
      stagedAssertionsRaw, committedAssertionsRaw,
      'evidence-assertions.json must be a byte-verbatim copy',
    );

    // ---- candidates.json (each entry validated against schemas/candidate.schema.json) ----
    const candidateSchema = await loadSchema('candidate.schema.json');
    const candidatesDoc = await loadJson(path.join(outDir, 'candidates.json'));
    const candidateIds = Object.keys(candidatesDoc);
    assert.ok(candidateIds.length > 0, 'the staged pack must draft at least 1 candidate');
    for (const [id, candidate] of Object.entries(candidatesDoc)) {
      assert.equal(candidate.id, id, `candidate key/id mismatch for "${id}"`);
      assert.deepEqual(validate(candidateSchema, candidate), []);
      assert.match(candidate.label, /pattern/i, `candidate "${id}" label must say "pattern," never a diagnosis`);
    }

    // ---- rule-proposals.json (no dedicated schema — checked structurally) ----
    const ruleProposalsDoc = await loadJson(path.join(outDir, 'rule-proposals.json'));
    assert.equal(ruleProposalsDoc.proposals.length, 4);
    for (const proposal of ruleProposalsDoc.proposals) {
      assert.ok(proposal.decisionId, `${proposal.id} must be joined to an authoring decision`);
    }

    // ---- rules.json (each rule validated against schemas/rule.schema.json) ----
    const ruleSchema = await loadSchema('rule.schema.json');
    const rulesDoc = await loadJson(path.join(outDir, 'rules.json'));
    assert.equal(rulesDoc.length, 4);
    for (const rule of rulesDoc) {
      assert.deepEqual(validate(ruleSchema, rule), [], `${rule.id} must validate against rule.schema.json`);
    }

    // ---- rule-provenance.json (validated against schemas/rule-provenance.schema.json) ----
    const ruleProvenanceSchema = await loadSchema('rule-provenance.schema.json');
    const ruleProvenanceDoc = await loadJson(path.join(outDir, 'rule-provenance.json'));
    assert.deepEqual(validate(ruleProvenanceSchema, ruleProvenanceDoc), []);
    assert.equal(ruleProvenanceDoc.entries.length, 4);
    const ruleIds = new Set(rulesDoc.map((r) => r.id));
    const provenanceRuleIds = new Set(ruleProvenanceDoc.entries.map((e) => e.ruleId));
    assert.deepEqual(provenanceRuleIds, ruleIds, 'rules.json and rule-provenance.json must join bijectively by id');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// P1-T3 (multi-bundle-conversion-e1-finish, Phase 1, seam task): cbc_suite_v1's real, existing
// 4-decision approved_for_rule_draft emission path is BYTE-IDENTICAL to its pre-Phase-1 output.
// These two SHA-256 digests were captured from a clean checkout BEFORE any Phase 1 code change
// landed (schemas/authoring-decisions.schema.json, propose.mjs, govern-staged-rules.mjs,
// errors.mjs) — a real regression pin, not merely a re-assertion of the current behavior.
// =================================================================================================

const PRE_PHASE1_RULES_JSON_SHA256 =
  '8aa53eed1014d1ee0ac3aef1998e2c54e8dba80285201d49b2c261e8165f68a9';
const PRE_PHASE1_RULE_PROVENANCE_JSON_SHA256 =
  '0d5e249a2cefda3537f56212a023e08dcae0f4263fa74f36b0701fa60ee69125';

test('P1-T3 (seam task): cbc_suite_v1\'s real 4-approved-decision propose run emits rules.json/rule-provenance.json byte-identical to the pre-Phase-1 baseline', async () => {
  const { createHash } = await import('node:crypto');
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-propose-test-p1-seam-'));
  try {
    const exitCode = await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR,
        module: REAL_MODULE_PATH,
        decisions: REAL_DECISIONS_PATH,
        out: outDir,
      }),
    ).then(({ result }) => result);
    assert.equal(exitCode, EXIT_OK);

    const rulesRaw = await readFile(path.join(outDir, 'rules.json'), 'utf8');
    const ruleProvenanceRaw = await readFile(path.join(outDir, 'rule-provenance.json'), 'utf8');
    assert.equal(
      createHash('sha256').update(rulesRaw).digest('hex'),
      PRE_PHASE1_RULES_JSON_SHA256,
      'rules.json must be byte-identical (by SHA-256) to the pre-Phase-1 baseline -- the live ' +
        'allowlist gate must not alter cbc_suite_v1\'s existing approved emission',
    );
    assert.equal(
      createHash('sha256').update(ruleProvenanceRaw).digest('hex'),
      PRE_PHASE1_RULE_PROVENANCE_JSON_SHA256,
      'rule-provenance.json must be byte-identical (by SHA-256) to the pre-Phase-1 baseline',
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// multi-bundle-conversion-e1-finish, Phase 2 (P2-T3/P2-T6, FR-F10): the module-identity
// `UsageError` propose.mjs used to throw for any non-"cbc_suite_v1" module id is REMOVED entirely
// -- the two tests below replace the single pre-Phase-2 test that asserted it, per this task's own
// binding instruction ("the old 'throws UsageError for non-cbc module' assertion is now WRONG and
// must be updated to assert governance-refusal instead"). Verified real behavior, not an assumed
// shape: a bare synthetic module missing its own required projection files still fails closed with
// a genuinely different, honest UsageError (unrelated to module identity); a module with real
// projections but zero hand-authored rule content reaches Phase 1's emission gate cleanly and is
// refused there, never via a module-identity check that no longer exists.
// =================================================================================================

test('P2-T6: propose still fails closed (UsageError) if a non-cbc module is missing its own required evidence.json -- unrelated to the removed module-identity check', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-propose-test-fail-'));
  const tempModuleDir = await mkdtemp(path.join(os.tmpdir(), 'ef-propose-test-wrongmodule-'));
  try {
    const wrongModulePath = path.join(tempModuleDir, 'module.json');
    await writeFile(wrongModulePath, JSON.stringify({ id: 'some_other_module', title: 'Wrong Module' }), 'utf8');
    await writeFile(
      path.join(tempModuleDir, 'authoring-decisions.yaml'),
      'notes: temp stub for P2-T6 wrong-module test\n',
      'utf8',
    );

    // Note: propose no longer refuses on module identity at all (P2-T3) -- it proceeds straight
    // to reading modules/<id>/evidence.json (readModuleProjectionFile), which this bare scratch
    // module dir never provisioned. This is still a genuine, named, fail-closed UsageError; it is
    // simply a DIFFERENT one than the removed module-identity check used to produce.
    await assert.rejects(
      () => runPropose({
        runDir: FIXTURE_DIR,
        module: wrongModulePath,
        decisions: path.join(tempModuleDir, 'authoring-decisions.yaml'),
        out: outDir,
      }),
      (err) => {
        assert.ok(err instanceof UsageError);
        assert.match(err.message, /evidence\.json to already exist/);
        return true;
      },
    );

    const outDirEntries = await readdir(outDir);
    assert.deepEqual(outDirEntries, [], 'nothing may be written to --out before the required projection files are read');
  } finally {
    await rm(outDir, { recursive: true, force: true });
    await rm(tempModuleDir, { recursive: true, force: true });
  }
});

test('P2-T6: propose for a non-cbc module WITH real committed projections but ZERO hand-authored rule content reaches Phase 1\'s emission gate, computes and captures a real RuleEmissionRefusedError-shaped refusal, and writes every pre-gate file under the correct module identity -- never a UsageError for module identity (that check no longer exists)', async () => {
  // VERIFIED REAL BEHAVIOR (not an assumed shape): kidney_suite_v1 has no generated engine test
  // corpus yet (tests/ef-kidney_suite_v1-*.test.mjs -- a separate, pre-existing, Phase 4/5
  // requirement this plan does not touch), so a full propose run for it still throws a UsageError
  // overall today -- but that throw happens LATE (computeTestCorpusHash, building
  // release-manifest.unsigned.json), strictly AFTER the module-generic emission gate has already
  // been computed and AFTER pack-provenance.json/evidence.json/evidence-assertions.json/
  // rule-proposals.json/candidates.json have already been written to --out under kidney_suite_v1's
  // own correct identity. This test verifies exactly that real sequence: the removed
  // module-identity check blocks nothing; the emission gate reaches a genuine, captured
  // RuleEmissionRefusedError-shaped refusal (not thrown, folded into conversion-report.json in a
  // real run -- observable here via the already-written rule-proposals.json's correct, empty,
  // kidney-scoped content); and the EVENTUAL throw is the orthogonal, unrelated test-corpus
  // UsageError, never a module-identity message.
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-propose-test-kidney-gate-'));
  const tempModuleDir = await mkdtemp(path.join(os.tmpdir(), 'ef-propose-test-kidney-module-'));
  try {
    // A synthetic kidney_suite_v1 module directory carrying REAL, committed evidence.json/
    // evidence-assertions.json (so propose's readModuleProjectionFile calls succeed) plus a stub
    // authoring-decisions.yaml with zero decisions -- kidney_suite_v1 has no authoring-decisions.yaml
    // committed yet (that is Phase 3's job), so this scratch dir is what "runs propose against
    // kidney_suite_v1 today" actually requires; it is not a substitute for Phase 3's real content.
    const kidneyModuleDir = path.join(REPO_ROOT, 'modules', 'kidney_suite_v1');
    const wrongModulePath = path.join(tempModuleDir, 'module.json');
    const kidneyModuleDoc = JSON.parse(await readFile(path.join(kidneyModuleDir, 'module.json'), 'utf8'));
    await writeFile(wrongModulePath, JSON.stringify(kidneyModuleDoc), 'utf8');
    // Declares rfProvenance.rfBundleId matching FIXTURE_DIR's own real bundle id, so
    // `bundleMatchesDecisionsProvenance` is true and propose reuses the already-pinned claim
    // ledger rather than requiring a separate declared-bundle resolution (irrelevant to this
    // test's own subject -- decisions: [] means there is nothing to cross-resolve either way).
    await writeFile(
      path.join(tempModuleDir, 'authoring-decisions.yaml'),
      'schemaVersion: "1.0"\n'
        + 'moduleId: kidney_suite_v1\n'
        + 'rfProvenance:\n'
        + '  rfBundleId: bundle_20260718_intent_research_20260717_rf_cbc_001\n'
        + '  fixturePath: tests/fixtures/rf-cbc-001/\n'
        + 'decisions: []\n',
      'utf8',
    );
    await writeFile(
      path.join(tempModuleDir, 'evidence.json'),
      await readFile(path.join(kidneyModuleDir, 'evidence.json'), 'utf8'),
      'utf8',
    );
    await writeFile(
      path.join(tempModuleDir, 'evidence-assertions.json'),
      await readFile(path.join(kidneyModuleDir, 'evidence-assertions.json'), 'utf8'),
      'utf8',
    );

    await assert.rejects(
      () => withCapturedStdout(() =>
        runPropose({
          runDir: FIXTURE_DIR, // reuses the real, already-verified rf-cbc-001 bundle -- the
          // pipeline does not require the fixture's own topic to match the module id; it only
          // needs a verified, loadable bundle, which this fixture already is.
          module: wrongModulePath,
          decisions: path.join(tempModuleDir, 'authoring-decisions.yaml'),
          out: outDir,
        }),
      ),
      (err) => {
        assert.ok(err instanceof UsageError);
        // The ONE assertion this whole rewritten test exists to make: this message is about the
        // orthogonal, unrelated test-corpus requirement -- NEVER about module identity (the old,
        // now-removed check's message named MODULE_ID/"cbc_suite_v1" and "some_other_module").
        assert.match(err.message, /generated test-corpus file matching tests\/ef-kidney_suite_v1-/);
        assert.doesNotMatch(err.message, /cbc_suite_v1/);
        return true;
      },
    );

    // Everything propose writes BEFORE that later, unrelated throw is already on disk, under the
    // CORRECT (kidney_suite_v1) identity -- proving the emission gate and writeDraftPack()
    // genericity both ran cleanly for this module before the orthogonal blocker was hit.
    const packProvenance = await loadJson(path.join(outDir, 'pack-provenance.json'));
    assert.equal(packProvenance.moduleId, 'kidney_suite_v1');

    const ruleProposalsDoc = await loadJson(path.join(outDir, 'rule-proposals.json'));
    assert.equal(ruleProposalsDoc.moduleId, 'kidney_suite_v1', 'never cbc_suite_v1');
    assert.deepEqual(ruleProposalsDoc.proposals, [], 'kidney_suite_v1 has zero hand-authored proposals');
    assert.equal(ruleProposalsDoc.rfProvenance, null, 'never cbc\'s own RF_PROVENANCE');

    const candidatesDoc = await loadJson(path.join(outDir, 'candidates.json'));
    assert.deepEqual(candidatesDoc, {}, 'kidney_suite_v1 has zero hand-authored candidates');

    // rules.json/rule-provenance.json are NEVER written -- zero referenced decisions means the
    // emission gate's own `permitted` is false, so writeStagedRulesAndProvenance() never runs.
    await assert.rejects(() => readFile(path.join(outDir, 'rules.json'), 'utf8'), { code: 'ENOENT' });
    await assert.rejects(() => readFile(path.join(outDir, 'rule-provenance.json'), 'utf8'), { code: 'ENOENT' });

    // The later-stage files this throw pre-empts are correctly absent (not partially written).
    await assert.rejects(() => readFile(path.join(outDir, 'release-manifest.unsigned.json'), 'utf8'), { code: 'ENOENT' });
    await assert.rejects(() => readFile(path.join(outDir, 'conversion-report.json'), 'utf8'), { code: 'ENOENT' });
  } finally {
    await rm(outDir, { recursive: true, force: true });
    await rm(tempModuleDir, { recursive: true, force: true });
  }
});

test('P2-T6 (pure-function complement): the emission gate itself refuses via a genuine RuleEmissionRefusedError-shaped result for any module whose RULE_PROPOSAL_REGISTRY entry is empty -- proven directly, independent of the test-corpus requirement above', () => {
  for (const moduleId of ['kidney_suite_v1', 'growth_suite_v1', 'anemia']) {
    const ruleProposals = RULE_PROPOSAL_REGISTRY[moduleId] ?? [];
    assert.deepEqual(ruleProposals, [], `${moduleId} must have zero hand-authored proposals in this pass`);

    // Even a decisions[] array with one fully-approved decision cannot make the gate permit
    // emission, because ZERO proposals reference ANY decisionId -- the gate's own
    // `referencedDecisionIds.length > 0` requirement is never met.
    const decisions = [{ decision_id: 'some_decision', status: 'approved_for_rule_draft' }];
    const gate = resolveRuleEmissionGate(decisions, ruleProposals);
    assert.equal(gate.permitted, false);
    assert.deepEqual(gate.referencedDecisionIds, []);
    assert.deepEqual(gate.refusedDecisions, []);

    // This is a REAL, named RuleEmissionRefusedError -- never a UsageError -- exactly what a real
    // propose run's conversion-report.json.ruleEmission.refusalReason is built from.
    const refusal = new RuleEmissionRefusedError(gate);
    assert.ok(refusal instanceof RuleEmissionRefusedError);
    assert.ok(refusal instanceof GovernanceError);
    assert.ok(!(refusal instanceof UsageError));
    assert.match(refusal.message, /rule\/rule-provenance emission refused/);
  }

  // Sanity: cbc_suite_v1's own registry entry is non-empty and CAN reach `permitted: true` when
  // its decisions are approved -- proving the gate genuinely discriminates by module content, not
  // a blanket "always refuse for a non-hardcoded module" rule.
  const cbcProposals = RULE_PROPOSAL_REGISTRY.cbc_suite_v1;
  assert.ok(cbcProposals.length > 0);
  const cbcDecisions = [...new Set(cbcProposals.map((p) => p.decisionId))].map((decisionId) => ({
    decision_id: decisionId,
    status: 'approved_for_rule_draft',
  }));
  const cbcGate = resolveRuleEmissionGate(cbcDecisions, cbcProposals);
  assert.equal(cbcGate.permitted, true);
});

test('P3-T7: propose requires --run-dir, --module, --decisions, and --out (usage error, not a stack trace)', async () => {
  await assert.rejects(() => runPropose({}), (err) => {
    assert.ok(err instanceof UsageError);
    assert.equal(err.exitCode, 1);
    return true;
  });
  await assert.rejects(() => runPropose({ runDir: FIXTURE_DIR }), UsageError);
  await assert.rejects(() => runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH }), UsageError);
  await assert.rejects(
    () => runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH }),
    UsageError,
  );
});

test('P3-T7: propose rejects a --decisions path that does not match the module\'s own authoring-decisions.yaml', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-propose-test-decisions-mismatch-'));
  try {
    await assert.rejects(
      () => runPropose({
        runDir: FIXTURE_DIR,
        module: REAL_MODULE_PATH,
        decisions: path.join(REPO_ROOT, 'modules', 'anemia', 'evidence.json'), // any wrong path
        out: outDir,
      }),
      UsageError,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('P3-T7: propose makes zero outbound network calls (http.request/https.request/fetch never invoked)', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-propose-test-network-'));
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalFetch = globalThis.fetch;
  let httpCalls = 0;
  let httpsCalls = 0;
  let fetchCalls = 0;

  http.request = (...args) => {
    httpCalls += 1;
    return originalHttpRequest.apply(http, args);
  };
  https.request = (...args) => {
    httpsCalls += 1;
    return originalHttpsRequest.apply(https, args);
  };
  if (typeof originalFetch === 'function') {
    globalThis.fetch = (...args) => {
      fetchCalls += 1;
      return originalFetch.apply(globalThis, args);
    };
  }

  try {
    await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR,
        module: REAL_MODULE_PATH,
        decisions: REAL_DECISIONS_PATH,
        out: outDir,
      }),
    );
  } finally {
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    if (typeof originalFetch === 'function') globalThis.fetch = originalFetch;
    await rm(outDir, { recursive: true, force: true });
  }

  assert.equal(httpCalls, 0, 'propose must never call http.request');
  assert.equal(httpsCalls, 0, 'propose must never call https.request');
  assert.equal(fetchCalls, 0, 'propose must never call fetch');
});

// =================================================================================================
// 2. Seam invariant 8 — a mixed/contradicted claim never grounds a one-sided rule (stub + real)
// =================================================================================================

function makeRoutedFixture() {
  return routeClaims([
    { claim_id: 'clm_stub_mixed', status: 'mixed', sources: [] },
    { claim_id: 'clm_stub_contradicted', status: 'contradicted', sources: [] },
    { claim_id: 'clm_stub_speculation', status: 'speculation', sources: [] },
    { claim_id: 'clm_stub_supported', status: 'supported', sources: [] },
    {
      claim_id: 'clm_stub_inference',
      status: 'inference',
      inference_basis: { from_claims: ['clm_stub_supported'] },
    },
  ], [
    // Only clm_stub_supported has a resolved exact passage (an evidence-assertions.json entry
    // naming it) — this is what makes it eligible as a rule's sole positive basis.
    { rfClaimId: 'clm_stub_supported' },
  ]);
}

test('P3-T7 (stub): assertNoSoleConflictedBasis throws when a rule proposal\'s ONLY cited claim is mixed', () => {
  const routingReport = makeRoutedFixture();
  const stubProposal = { id: 'STUB-MIXED-001', rfClaimIds: ['clm_stub_mixed'] };
  assert.throws(
    () => assertNoSoleConflictedBasis([stubProposal], routingReport),
    (err) => {
      assert.ok(err instanceof ConflictedSoleBasisError);
      assert.ok(err instanceof GovernanceError);
      assert.equal(err.exitCode, EXIT_GOVERNANCE);
      assert.equal(err.proposalId, 'STUB-MIXED-001');
      return true;
    },
  );
});

test('P3-T7 (stub): assertNoSoleConflictedBasis throws when a rule proposal\'s ONLY cited claim is contradicted', () => {
  const routingReport = makeRoutedFixture();
  const stubProposal = { id: 'STUB-CONTRADICTED-001', rfClaimIds: ['clm_stub_contradicted'] };
  assert.throws(
    () => assertNoSoleConflictedBasis([stubProposal], routingReport),
    ConflictedSoleBasisError,
  );
});

test('P3-T7 (stub): assertNoSoleConflictedBasis throws when a rule proposal cites ONLY mixed+contradicted claims combined (still no sole basis)', () => {
  const routingReport = makeRoutedFixture();
  const stubProposal = {
    id: 'STUB-COMBINED-001',
    rfClaimIds: ['clm_stub_mixed', 'clm_stub_contradicted', 'clm_stub_speculation'],
  };
  assert.throws(
    () => assertNoSoleConflictedBasis([stubProposal], routingReport),
    ConflictedSoleBasisError,
  );
});

test('P3-T7 (stub): assertNoSoleConflictedBasis does NOT throw when a mixed claim is combined with a real supported anchor', () => {
  const routingReport = makeRoutedFixture();
  const stubProposal = {
    id: 'STUB-ANCHORED-001',
    rfClaimIds: ['clm_stub_mixed', 'clm_stub_supported'],
  };
  assert.doesNotThrow(() => assertNoSoleConflictedBasis([stubProposal], routingReport));
});

test('P3-T7 (stub): assertNoSoleConflictedBasis does NOT throw for a proposal solely grounded by an inference claim with a populated basis', () => {
  const routingReport = makeRoutedFixture();
  const stubProposal = { id: 'STUB-INFERENCE-001', rfClaimIds: ['clm_stub_inference'] };
  assert.doesNotThrow(() => assertNoSoleConflictedBasis([stubProposal], routingReport));
});

test('P3-T7: assertNoSoleConflictedBasis does NOT throw for the real RULE_PROPOSALS against the real fixture\'s routing report', async () => {
  const loaded = await loadBundle({ runDir: FIXTURE_DIR, modulePath: REAL_MODULE_PATH });
  const pinned = await pinArtifacts(loaded);
  const evidenceAssertionsDoc = await loadJson(path.join(REAL_MODULE_DIR, 'evidence-assertions.json'));
  // rfRunId-scoped (multi-bundle-conversion-e1, P4-T5): matches propose.mjs's own now-corrected
  // call site -- modules/cbc_suite_v1/evidence-assertions.json holds RF-CBC-001 + RF-CBC-002
  // assertions sharing one clm_NNN namespace, so this RF-CBC-001-fixture-driven routing must be
  // scoped to RF-CBC-001's own rfRunId, never left to match any bundle's assertions.
  const routingReport = routeClaims(
    pinned.artifacts.claimLedger.parsed.claims,
    evidenceAssertionsDoc.assertions,
    { rfRunId: pinned.runId },
  );
  assert.doesNotThrow(() => assertNoSoleConflictedBasis(RULE_PROPOSALS, routingReport));
});

// =================================================================================================
// 3. buildPackProvenance is a pure function of its pinned-bundle/eligibility inputs (no I/O)
// =================================================================================================

test('P3-T7: buildPackProvenance is a pure function of its inputs (no I/O, deterministic given identical inputs)', async () => {
  const loaded = await loadBundle({ runDir: FIXTURE_DIR, modulePath: REAL_MODULE_PATH });
  const pinned = await pinArtifacts(loaded);
  const eligibility = checkEligibility(pinned);
  const a = buildPackProvenance(pinned, eligibility);
  const b = buildPackProvenance(pinned, eligibility);
  assert.deepEqual(a, b);
});

// =================================================================================================
// 4. Structural: no forbidden network/AI-SDK import in this file (same convention as every other
//    verb test file in this suite)
// =================================================================================================

async function collectConverterSourceFiles(dir) {
  const { readdir } = await import('node:fs/promises');
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectConverterSourceFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(full);
    }
  }
  return files;
}

const FORBIDDEN_IMPORT_PATTERNS = [
  /^\s*import\b[^;]*from\s+['"](?:node:)?http['"]/m,
  /^\s*import\b[^;]*from\s+['"](?:node:)?https['"]/m,
  /^\s*import\b[^;]*from\s+['"](?:node:)?dgram['"]/m,
  /^\s*import\b[^;]*from\s+['"]@anthropic-ai\/[^'"]*['"]/m,
  /^\s*import\b[^;]*from\s+['"]openai['"]/m,
  /(?<!\/\/[^\n]*)\bfetch\s*\(/,
];

test('P3-T7: no file under tools/rf-bundle-to-kb-pack/ imports a network or AI/model-SDK module (structural)', async () => {
  const files = await collectConverterSourceFiles(CONVERTER_ROOT);
  assert.ok(files.length > 0, 'sanity: the converter source tree must not be empty');

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      assert.ok(
        !pattern.test(source),
        `${path.relative(REPO_ROOT, file)} matches forbidden pattern ${pattern} (network/AI-SDK import)`,
      );
    }
  }
});
