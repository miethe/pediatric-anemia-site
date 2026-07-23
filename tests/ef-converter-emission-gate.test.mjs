// tests/ef-converter-emission-gate.test.mjs — P1-T5 (multi-bundle-conversion-e1-finish, Phase 1,
// FR-F6/FR-F7/FR-F8/FR-F11, R-2/OQ-1, OQ-3).
//
// Phase 1's own exit gate (decisions block §1, PRD Goal 2): "a decisions file with no
// approved_for_rule_draft decision cannot produce rules.json/rule-provenance.json, proven by
// file-absence assertion and a non-zero, named refusal reason in conversion-report.json — not by
// inspecting prose." This file is the negative-control proof, plus the P1-T4 cross-resolution
// negative proof, plus the P1-T8 non-fatal-refusal restructuring proof, all against the SAME
// scratch-fixture technique (a throwaway copy of the real, committed cbc_suite_v1 module package
// with authoring-decisions.yaml text-substituted) so every scenario below exercises the REAL
// propose.mjs code path, never a synthetic re-implementation of it.
//
// Sections:
//   1. Allowlist gate (P1-T2/T3): 5 distinct status values (3 real non-approving enum members +
//      1 real approving member as a sanity control + 1 never-before-seen invented string) all
//      refuse identically via the SAME resolveRuleEmissionGate() code path — the fail-closed-on-
//      unknown-value property a denylist enumeration cannot guarantee.
//   2. Cross-resolution (P1-T4): an invented clm_*/evas_* id throws UnresolvedClaimReferenceError
//      before mkdir(outDir) is ever called — zero partial output.
//   3. Non-fatal refusal (P1-T8): a zero-approved-decisions run returns EXIT_OK, still writes every
//      artifact FR-F8/FR-F11 name, and rules.json/rule-provenance.json are provably absent.
//   4. computeTraceabilityHash's empty-string substitution is deterministic across two independent
//      refused runs.
//   5. batch does not halt at a refused pair (P1-T8's second node:test, fixture-scoped).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, cp, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  run as runPropose,
  resolveRuleEmissionGate,
  resolveDecisionReferences,
  loadDeclaredBundleClaimIds,
} from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { computeTraceabilityHash } from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { RULE_PROPOSALS } from '../tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs';
import { runBatch } from '../tools/rf-bundle-to-kb-pack/lib/batch.mjs';
import {
  EXIT_OK,
  UnresolvedClaimReferenceError,
  RuleEmissionRefusedError,
  GovernanceError,
  SchemaError,
} from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';
import { parseYamlDocument } from '../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');
const REAL_MODULE_PATH = path.join(REAL_MODULE_DIR, 'module.json');
const REAL_DECISIONS_PATH = path.join(REAL_MODULE_DIR, 'authoring-decisions.yaml');

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
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

/**
 * Builds a throwaway scratch copy of the real, committed cbc_suite_v1 module package (module.json,
 * evidence.json, evidence-assertions.json copied byte-verbatim; authoring-decisions.yaml text-
 * substituted per `decisionsTransform`) so every scenario below exercises the REAL propose.mjs
 * code path against a module whose `id` stays `"cbc_suite_v1"` (satisfying the still-hard-coded
 * `MODULE_ID` gate this phase does not remove — that is Phase 2's job) while its decisions/claim-
 * reference content is deliberately varied. Never touches the real, committed
 * modules/cbc_suite_v1/ tree.
 *
 * @param {(raw: string) => string} [decisionsTransform] identity by default
 * @returns {Promise<string>} the scratch module directory's path
 */
async function makeScratchModuleDir(decisionsTransform = (raw) => raw) {
  const moduleDir = await mkdtemp(path.join(os.tmpdir(), 'ef-emission-gate-scratch-'));
  await cp(REAL_MODULE_PATH, path.join(moduleDir, 'module.json'));
  await cp(path.join(REAL_MODULE_DIR, 'evidence.json'), path.join(moduleDir, 'evidence.json'));
  await cp(
    path.join(REAL_MODULE_DIR, 'evidence-assertions.json'),
    path.join(moduleDir, 'evidence-assertions.json'),
  );
  const realDecisionsRaw = await readFile(REAL_DECISIONS_PATH, 'utf8');
  await writeFile(
    path.join(moduleDir, 'authoring-decisions.yaml'),
    decisionsTransform(realDecisionsRaw),
    'utf8',
  );
  return moduleDir;
}

function replaceAllStatuses(raw, newStatus) {
  return raw.replaceAll('status: approved_for_rule_draft', `status: ${newStatus}`);
}

// =================================================================================================
// 1. Allowlist gate (P1-T2/T3): unit-level proof against resolveRuleEmissionGate() directly
// =================================================================================================

test('P1-T2: resolveRuleEmissionGate permits ONLY when every decision a rule proposal cites carries status "approved_for_rule_draft" (real cbc_suite_v1 decisions/proposals, sanity control)', async () => {
  const raw = await readFile(REAL_DECISIONS_PATH, 'utf8');
  const decisions = parseYamlDocument(raw).decisions;
  const gate = resolveRuleEmissionGate(decisions, RULE_PROPOSALS);
  assert.equal(gate.permitted, true);
  assert.equal(gate.referencedDecisionIds.length, 4);
  assert.equal(gate.approvedDecisionIds.length, 4);
  assert.deepEqual(gate.refusedDecisions, []);
});

// Every one of these 5 distinct status strings must refuse via the SAME code path
// (resolveRuleEmissionGate's single `status === 'approved_for_rule_draft'` branch) — 3 are real,
// schema-legal, non-approving enum members; the 4th is a status this schema has never seen before
// at all. A denylist enumeration of the 3 known values could never guarantee the 4th also refuses;
// this allowlist does, by construction.
const NON_APPROVING_STATUSES = [
  'rejected',
  'withdrawn',
  'drafted_pending_human_approval',
  'totally_invented_never_before_seen_status_xyz',
];

for (const status of NON_APPROVING_STATUSES) {
  test(`P1-T2: resolveRuleEmissionGate refuses when every referenced decision carries status "${status}" (allowlist fail-closed-on-unknown-value property)`, async () => {
    const raw = await readFile(REAL_DECISIONS_PATH, 'utf8');
    const decisions = parseYamlDocument(replaceAllStatuses(raw, status)).decisions;
    for (const decision of decisions) assert.equal(decision.status, status);

    const gate = resolveRuleEmissionGate(decisions, RULE_PROPOSALS);
    assert.equal(gate.permitted, false, `status="${status}" must refuse emission`);
    assert.equal(gate.referencedDecisionIds.length, 4);
    assert.equal(gate.approvedDecisionIds.length, 0);
    assert.equal(gate.refusedDecisions.length, 4);
    for (const refused of gate.refusedDecisions) {
      assert.equal(refused.status, status);
    }

    // Same SAME code path proof, one level up: constructing RuleEmissionRefusedError from this
    // exact gate result names the specific decision ids and status — never a bare boolean.
    const refusal = new RuleEmissionRefusedError(gate);
    assert.ok(refusal instanceof GovernanceError);
    assert.equal(refusal.exitCode, 3);
    assert.match(refusal.message, new RegExp(status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}

test('P1-T2: resolveRuleEmissionGate refuses when a referenced decision_id is entirely absent from the decisions array (missing reference treated as non-approving, never silently permitted)', () => {
  const gate = resolveRuleEmissionGate([], RULE_PROPOSALS);
  assert.equal(gate.permitted, false);
  assert.equal(gate.referencedDecisionIds.length, 4);
  assert.equal(gate.approvedDecisionIds.length, 0);
  assert.equal(gate.refusedDecisions.length, 4);
  for (const refused of gate.refusedDecisions) assert.equal(refused.status, null);
});

// =================================================================================================
// 2. Cross-resolution (P1-T4): an invented clm_*/evas_* id throws before any output is written
// =================================================================================================

test('P1-T4: resolveDecisionReferences throws UnresolvedClaimReferenceError naming an invented clm_* id (unit-level, no I/O)', () => {
  const decisions = [
    {
      decision_id: 'dec_test_invented_claim',
      basis: { rf_claim_ids: ['clm_real_one', 'clm_99999'], exact_assertion_ids: ['evas_real_one'] },
    },
  ];
  assert.throws(
    () => resolveDecisionReferences(decisions, {
      claimIds: new Set(['clm_real_one']),
      assertionIds: new Set(['evas_real_one']),
    }),
    (err) => {
      assert.ok(err instanceof UnresolvedClaimReferenceError);
      assert.ok(err instanceof SchemaError);
      assert.equal(err.exitCode, 2);
      assert.equal(err.kind, 'clm');
      assert.equal(err.id, 'clm_99999');
      assert.equal(err.decisionId, 'dec_test_invented_claim');
      return true;
    },
  );
});

test('P1-T4: resolveDecisionReferences throws UnresolvedClaimReferenceError naming an invented evas_* id (unit-level, no I/O)', () => {
  const decisions = [
    {
      decision_id: 'dec_test_invented_assertion',
      basis: { rf_claim_ids: ['clm_real_one'], exact_assertion_ids: ['evas_invented_99999'] },
    },
  ];
  assert.throws(
    () => resolveDecisionReferences(decisions, {
      claimIds: new Set(['clm_real_one']),
      assertionIds: new Set(['evas_real_one']),
    }),
    (err) => {
      assert.ok(err instanceof UnresolvedClaimReferenceError);
      assert.equal(err.exitCode, 2);
      assert.equal(err.kind, 'evas');
      assert.equal(err.id, 'evas_invented_99999');
      return true;
    },
  );
});

test('P1-T4: resolveDecisionReferences with claimIds=null skips the rf_claim_ids half but still checks exact_assertion_ids', () => {
  const decisions = [
    {
      decision_id: 'dec_test_null_claim_universe',
      basis: { rf_claim_ids: ['clm_anything_at_all'], exact_assertion_ids: ['evas_invented_99999'] },
    },
  ];
  assert.throws(
    () => resolveDecisionReferences(decisions, { claimIds: null, assertionIds: new Set(['evas_real_one']) }),
    (err) => {
      assert.ok(err instanceof UnresolvedClaimReferenceError);
      assert.equal(err.kind, 'evas');
      return true;
    },
  );
  assert.doesNotThrow(() => resolveDecisionReferences(decisions, {
    claimIds: null,
    assertionIds: new Set(['evas_invented_99999']),
  }));
});

test('P1-T4: propose run against a real fixture with an invented clm_* id throws UnresolvedClaimReferenceError BEFORE mkdir(outDir) — zero partial output written', async () => {
  const moduleDir = await makeScratchModuleDir((raw) => raw.replace('- clm_inf07\n', '- clm_99999_invented\n'));
  const outDir = path.join(await mkdtemp(path.join(os.tmpdir(), 'ef-emission-gate-out-')), 'nonexistent-subdir');
  try {
    await assert.rejects(
      () => runPropose({
        runDir: FIXTURE_DIR,
        module: path.join(moduleDir, 'module.json'),
        decisions: path.join(moduleDir, 'authoring-decisions.yaml'),
        out: outDir,
      }),
      (err) => {
        assert.ok(err instanceof UnresolvedClaimReferenceError);
        assert.equal(err.exitCode, 2);
        assert.equal(err.kind, 'clm');
        assert.equal(err.id, 'clm_99999_invented');
        assert.match(err.message, /dec_cbc_local_range_precedence_001/);
        return true;
      },
    );
    // outDir's own parent was created by mkdtemp, but outDir itself (propose's --out target) must
    // never have been created at all — proves the throw happened before mkdir(outDir, ...).
    await assert.rejects(() => access(outDir), (err) => {
      assert.equal(err.code, 'ENOENT');
      return true;
    });
  } finally {
    await rm(path.dirname(outDir), { recursive: true, force: true });
    await rm(moduleDir, { recursive: true, force: true });
  }
});

test('P1-T4: propose run against a real fixture with an invented evas_* id throws UnresolvedClaimReferenceError BEFORE mkdir(outDir) — zero partial output written', async () => {
  const moduleDir = await makeScratchModuleDir((raw) =>
    raw.replace('- evas_cbc_analyzer_specificity_001\n', '- evas_invented_99999\n'));
  const outDir = path.join(await mkdtemp(path.join(os.tmpdir(), 'ef-emission-gate-out-')), 'nonexistent-subdir');
  try {
    await assert.rejects(
      () => runPropose({
        runDir: FIXTURE_DIR,
        module: path.join(moduleDir, 'module.json'),
        decisions: path.join(moduleDir, 'authoring-decisions.yaml'),
        out: outDir,
      }),
      (err) => {
        assert.ok(err instanceof UnresolvedClaimReferenceError);
        assert.equal(err.exitCode, 2);
        assert.equal(err.kind, 'evas');
        assert.equal(err.id, 'evas_invented_99999');
        return true;
      },
    );
    await assert.rejects(() => access(outDir), (err) => {
      assert.equal(err.code, 'ENOENT');
      return true;
    });
  } finally {
    await rm(path.dirname(outDir), { recursive: true, force: true });
    await rm(moduleDir, { recursive: true, force: true });
  }
});

test('P1-T4 regression: propose run against the real, unmodified cbc_suite_v1 module + rf-cbc-001 fixture resolves every clm_*/evas_* reference cleanly (no throw)', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-emission-gate-regression-'));
  try {
    const { result: exitCode } = await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR,
        module: REAL_MODULE_PATH,
        decisions: REAL_DECISIONS_PATH,
        out: outDir,
      }),
    );
    assert.equal(exitCode, EXIT_OK);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// 2b. Adversarial-review follow-up (post-P1 hardening): the bundle-mismatch path must NEVER skip
//     the rf_claim_ids[] fabrication check. `FIXTURE_DIR` above is rf-cbc-001 — the bundle
//     modules/cbc_suite_v1/authoring-decisions.yaml itself declares as its provenance
//     (rfProvenance.rfBundleId). `FIXTURE_DIR_002` below is rf-cbc-002 — the DIFFERENT bundle
//     `lib/batch.mjs`'s own BATCH_PAIRS actually pairs cbc_suite_v1 with at runtime. A propose run
//     against FIXTURE_DIR_002 exercises exactly the mismatch branch this hardening fixes.
// =================================================================================================

const FIXTURE_DIR_002 = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-002');

test('bundle-mismatch hardening: a decisions file declaring rf-cbc-001 provenance that cites a fabricated clm_* id throws UnresolvedClaimReferenceError even when the RUN loads the different rf-cbc-002 bundle (the fabrication guard is never skipped on a mismatch)', async () => {
  const moduleDir = await makeScratchModuleDir((raw) => raw.replace('- clm_inf07\n', '- clm_99999_invented\n'));
  const outDir = path.join(await mkdtemp(path.join(os.tmpdir(), 'ef-emission-gate-mismatch-out-')), 'nonexistent-subdir');
  try {
    await assert.rejects(
      () => runPropose({
        // The RUN loads rf-cbc-002 — NOT the rf-cbc-001 bundle this decisions file's own
        // rfProvenance.rfBundleId declares. Pre-fix, this mismatch set `claimIds: null` and
        // silently skipped the rf_claim_ids[] check entirely, letting the fabricated id through.
        runDir: FIXTURE_DIR_002,
        module: path.join(moduleDir, 'module.json'),
        decisions: path.join(moduleDir, 'authoring-decisions.yaml'),
        out: outDir,
      }),
      (err) => {
        assert.ok(err instanceof UnresolvedClaimReferenceError);
        assert.ok(err instanceof SchemaError);
        assert.equal(err.exitCode, 2);
        assert.equal(err.kind, 'clm');
        assert.equal(err.id, 'clm_99999_invented');
        assert.match(err.message, /dec_cbc_local_range_precedence_001/);
        return true;
      },
    );
    // Zero partial output — the throw happens before mkdir(outDir, ...), same contract as the
    // matched-bundle case above.
    await assert.rejects(() => access(outDir), (err) => {
      assert.equal(err.code, 'ENOENT');
      return true;
    });
  } finally {
    await rm(path.dirname(outDir), { recursive: true, force: true });
    await rm(moduleDir, { recursive: true, force: true });
  }
});

test('bundle-mismatch hardening: cbc_suite_v1\'s REAL rf-cbc-001 claim ids still resolve cleanly (no false rejection) when the run projects the different rf-cbc-002 bundle', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-emission-gate-mismatch-regression-'));
  try {
    const { result: exitCode } = await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR_002,
        module: REAL_MODULE_PATH,
        decisions: REAL_DECISIONS_PATH,
        out: outDir,
      }),
    );
    // Real (unmodified) authoring-decisions.yaml cites only real rf-cbc-001 claim ids; those must
    // resolve against the DECLARED bundle's own claim ledger even though this run loaded rf-cbc-002
    // — no throw, and rules.json/rule-provenance.json ARE emitted (the emission gate itself still
    // permits, exactly as it does in the ef-converter-batch.test.mjs BATCH_PAIRS run of this same
    // pairing).
    assert.equal(exitCode, EXIT_OK);
    await access(path.join(outDir, 'rules.json'));
    await access(path.join(outDir, 'rule-provenance.json'));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// 2b-containment (second adversarial-review follow-up): the declared-bundle loader must not let a
// decisions file's rfProvenance.fixturePath escape the repository tree — otherwise a `../`/absolute
// path could redirect the fabrication check at an out-of-tree, attacker-supplied claim_ledger that
// "resolves" a fabricated id. This is defense-in-depth (a committed authoring-decisions.yaml already
// requires clinical review to change), but it must fail closed regardless.
for (const escapePath of ['../../../../../../tmp/evil-bundle', '/tmp/evil-bundle']) {
  test(`declared-bundle loader rejects an out-of-tree rfProvenance.fixturePath (${escapePath}) with a fail-closed SchemaError, never a trusted read`, async () => {
    await assert.rejects(
      () => loadDeclaredBundleClaimIds(
        { rfProvenance: { rfBundleId: 'whatever', fixturePath: escapePath } },
        REPO_ROOT,
      ),
      (err) => {
        assert.ok(err instanceof SchemaError, 'must be a fail-closed SchemaError');
        assert.match(err.message, /escapes the repository tree/);
        return true;
      },
    );
  });
}

// =================================================================================================
// 3. Non-fatal refusal (P1-T8): FR-F6/FR-F8/FR-F11 — a governance refusal is a CAUGHT, non-fatal
//    signal. run() returns EXIT_OK; every non-rule artifact still gets written; rules.json/
//    rule-provenance.json are provably absent (fs.access ENOENT, this is FR-F8's literal wording).
// =================================================================================================

test('P1-T5/T8: a decisions file where every decision is drafted_pending_human_approval MUST NOT produce rules.json/rule-provenance.json, and MUST result in a named, non-zero refusal in conversion-report.json', async () => {
  const moduleDir = await makeScratchModuleDir((raw) => replaceAllStatuses(raw, 'drafted_pending_human_approval'));
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-emission-gate-refused-'));
  try {
    const { result: exitCode, output } = await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR,
        module: path.join(moduleDir, 'module.json'),
        decisions: path.join(moduleDir, 'authoring-decisions.yaml'),
        out: outDir,
      }),
    );

    // run() returns EXIT_OK on a governance refusal — it does not throw (P1-T8).
    assert.equal(exitCode, EXIT_OK);
    const summary = JSON.parse(output);
    assert.equal(summary.ruleEmission.permitted, false);
    assert.ok(summary.ruleEmission.refusalReason, 'stdout summary must name a non-empty refusal reason');

    // FR-F8's literal wording: file-absence via fs.access ENOENT, never merely "an empty array".
    await assert.rejects(() => access(path.join(outDir, 'rules.json')), { code: 'ENOENT' });
    await assert.rejects(() => access(path.join(outDir, 'rule-provenance.json')), { code: 'ENOENT' });

    // Every OTHER artifact this run's own contract names must still exist.
    for (const filename of [
      'pack-provenance.json',
      'evidence.json',
      'evidence-assertions.json',
      'candidates.json',
      'rule-proposals.json',
      'release-manifest.unsigned.json',
      'conversion-report.json',
      'semantic-diff.json',
    ]) {
      await access(path.join(outDir, filename)); // throws (fails the test) if missing
    }

    const conversionReport = await loadJson(path.join(outDir, 'conversion-report.json'));
    assert.equal(conversionReport.ruleEmission.permitted, false);
    assert.ok(
      typeof conversionReport.ruleEmission.refusalReason === 'string'
        && conversionReport.ruleEmission.refusalReason.length > 0,
      'conversion-report.json must carry a named, non-empty refusal reason',
    );
    assert.equal(conversionReport.ruleEmission.approvedDecisionIds.length, 0);
    assert.equal(conversionReport.ruleEmission.refusedDecisions.length, 4);
    for (const refused of conversionReport.ruleEmission.refusedDecisions) {
      assert.equal(refused.status, 'drafted_pending_human_approval');
    }

    // semantic-diff.json: headRules must be [] (never JSON.parse('') of an unwritten rules.json).
    const semanticDiff = await loadJson(path.join(outDir, 'semantic-diff.json'));
    assert.equal(semanticDiff.head.ruleCount, 0);
    assert.deepEqual(semanticDiff.added, []);
    assert.deepEqual(semanticDiff.changed, []);

    // release-manifest.unsigned.json is still emitted, with a well-formed traceabilityHash.
    const releaseManifest = await loadJson(path.join(outDir, 'release-manifest.unsigned.json'));
    assert.match(releaseManifest.traceabilityHash, /^sha256:[0-9a-f]{64}$/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
    await rm(moduleDir, { recursive: true, force: true });
  }
});

test('P1-T8: a refused run\'s conversion-report.json exclusions/summary (routingReport-derived fields) are UNAFFECTED by the emission-gate refusal', async () => {
  const moduleDir = await makeScratchModuleDir((raw) => replaceAllStatuses(raw, 'rejected'));
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-emission-gate-refused-routing-'));
  try {
    await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR,
        module: path.join(moduleDir, 'module.json'),
        decisions: path.join(moduleDir, 'authoring-decisions.yaml'),
        out: outDir,
      }),
    );
    const conversionReport = await loadJson(path.join(outDir, 'conversion-report.json'));
    // Same routing summary the real (approved) run produces — the emission gate is orthogonal to
    // claim-routing eligibility.
    assert.equal(conversionReport.summary.claimsTotal, 87);
    assert.equal(conversionReport.summary.claimsExcluded, 60);
  } finally {
    await rm(outDir, { recursive: true, force: true });
    await rm(moduleDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// 4. computeTraceabilityHash's empty-string substitution is deterministic across 2 independent
//    refused runs (P1-T8's own AC)
// =================================================================================================

test('P1-T8: two independent refused propose runs against byte-identical inputs produce an identical release-manifest.unsigned.json traceabilityHash', async () => {
  const moduleDirA = await makeScratchModuleDir((raw) => replaceAllStatuses(raw, 'withdrawn'));
  const moduleDirB = await makeScratchModuleDir((raw) => replaceAllStatuses(raw, 'withdrawn'));
  const outDirA = await mkdtemp(path.join(os.tmpdir(), 'ef-emission-gate-determinism-a-'));
  const outDirB = await mkdtemp(path.join(os.tmpdir(), 'ef-emission-gate-determinism-b-'));
  try {
    await withCapturedStdout(() => runPropose({
      runDir: FIXTURE_DIR,
      module: path.join(moduleDirA, 'module.json'),
      decisions: path.join(moduleDirA, 'authoring-decisions.yaml'),
      out: outDirA,
    }));
    await withCapturedStdout(() => runPropose({
      runDir: FIXTURE_DIR,
      module: path.join(moduleDirB, 'module.json'),
      decisions: path.join(moduleDirB, 'authoring-decisions.yaml'),
      out: outDirB,
    }));

    const manifestA = await loadJson(path.join(outDirA, 'release-manifest.unsigned.json'));
    const manifestB = await loadJson(path.join(outDirB, 'release-manifest.unsigned.json'));
    assert.equal(manifestA.traceabilityHash, manifestB.traceabilityHash);

    // Unit-level cross-check: computeTraceabilityHash itself, called directly with the SAME
    // empty-string placeholders this run substitutes, is deterministic (pure function).
    const decisionsRaw = await readFile(path.join(moduleDirA, 'authoring-decisions.yaml'), 'utf8');
    const evidenceAssertionsRaw = await readFile(
      path.join(moduleDirA, 'evidence-assertions.json'), 'utf8',
    );
    const h1 = computeTraceabilityHash({ decisionsRaw, evidenceAssertionsRaw, ruleProvenanceRaw: '', rulesRaw: '' });
    const h2 = computeTraceabilityHash({ decisionsRaw, evidenceAssertionsRaw, ruleProvenanceRaw: '', rulesRaw: '' });
    assert.equal(h1, h2);
  } finally {
    await rm(outDirA, { recursive: true, force: true });
    await rm(outDirB, { recursive: true, force: true });
    await rm(moduleDirA, { recursive: true, force: true });
    await rm(moduleDirB, { recursive: true, force: true });
  }
});

// =================================================================================================
// 5. batch does not halt at a refused pair (P1-T8's second node:test, fixture-scoped)
// =================================================================================================

test('P1-T8: runBatch does NOT halt when the first pair in its list is governance-refused — it proceeds to and completes the second pair', async () => {
  const refusedModuleDir = await makeScratchModuleDir((raw) => replaceAllStatuses(raw, 'rejected'));
  const outBaseDir = await mkdtemp(path.join(os.tmpdir(), 'ef-emission-gate-batch-out-'));
  try {
    const results = await runBatch({
      pairs: [
        { fixture: FIXTURE_DIR, module: refusedModuleDir },
        { fixture: FIXTURE_DIR, module: REAL_MODULE_DIR },
      ],
      outBaseDir,
    });

    // If refusal were still a thrown ConverterError (pre-P1-T8 behavior), runBatch would throw
    // BatchBundleFailedError at pairIndex 0 and this line would never be reached with 2 results.
    assert.equal(results.length, 2, 'batch must complete BOTH pairs — a refusal is no longer a halt');
    assert.equal(results[0].status, 'succeeded');
    assert.equal(results[0].moduleId, 'cbc_suite_v1');
    assert.equal(results[1].status, 'succeeded');
    assert.equal(results[1].moduleId, 'cbc_suite_v1');
  } finally {
    await rm(outBaseDir, { recursive: true, force: true });
    await rm(refusedModuleDir, { recursive: true, force: true });
  }
});
