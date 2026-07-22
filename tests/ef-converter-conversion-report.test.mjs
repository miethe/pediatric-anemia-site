// tests/ef-converter-conversion-report.test.mjs — P5-T2 (evidence-foundry-buildout Phase 5, FR-19,
// decisions block Phase 5 exit gate).
//
// Task acceptance criteria (phase-3-5-projection-slice-manifest.md, row P5-T2):
//   "Report is non-empty, structured JSON; every claim P3-T4 excluded from rule evidence appears in
//    the report with a named reason; a test asserts the report's exclusion count matches the
//    routing logic's actual reject count."
//
// This suite covers `buildConversionReport` (the pure builder, propose.mjs) in isolation against
// both synthetic stub routing reports and the real RF-CBC-001 fixture's actual routing report, plus
// a real `propose` run proving `conversion-report.json` is actually emitted, non-empty, and its
// exclusion count matches `../claim-routing.mjs`'s own `routingReport.rejected.length` exactly (no
// claim silently dropped between routing and reporting).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PACK_VERSION,
  buildConversionReport,
  run as runPropose,
} from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { loadBundle } from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import { pinArtifacts } from '../tools/rf-bundle-to-kb-pack/lib/hashing.mjs';
import { routeClaims } from '../tools/rf-bundle-to-kb-pack/lib/claim-routing.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');
const REAL_MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');

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

function makeStubRoutingReport() {
  return routeClaims(
    [
      { claim_id: 'clm_stub_supported_ok', status: 'supported' },
      { claim_id: 'clm_stub_supported_no_passage', status: 'supported' },
      { claim_id: 'clm_stub_mixed', status: 'mixed' },
      { claim_id: 'clm_stub_contradicted', status: 'contradicted' },
      {
        claim_id: 'clm_stub_inference_ok',
        status: 'inference',
        inference_basis: { from_claims: ['clm_stub_supported_ok'] },
      },
      { claim_id: 'clm_stub_inference_no_basis', status: 'inference' },
      { claim_id: 'clm_stub_speculation', status: 'speculation' },
      { claim_id: 'clm_stub_unsupported', status: 'unsupported' },
      { claim_id: 'clm_stub_weird', status: 'not_a_real_status' },
    ],
    [{ rfClaimId: 'clm_stub_supported_ok' }],
  );
}

// =================================================================================================
// buildConversionReport — pure function, exact shape
// =================================================================================================

test('P5-T2: buildConversionReport emits exactly the documented top-level shape', () => {
  const routingReport = makeStubRoutingReport();
  const report = buildConversionReport({
    moduleId: 'cbc_suite_v1',
    packVersion: '0.1.0-proposal',
    routingReport,
  });

  assert.deepEqual(Object.keys(report).sort(), [
    'exclusions', 'moduleId', 'packVersion', 'schemaVersion', 'summary',
  ]);
  assert.equal(report.moduleId, 'cbc_suite_v1');
  assert.equal(report.packVersion, '0.1.0-proposal');
  assert.deepEqual(Object.keys(report.summary).sort(), [
    'candidatesExcluded', 'claimsConflictVisible', 'claimsEligibleForRuleEvidence',
    'claimsExcluded', 'claimsTotal', 'sourcesExcluded',
  ]);
  assert.deepEqual(Object.keys(report.exclusions).sort(), ['candidates', 'claims', 'sources']);
});

test('P5-T2: buildConversionReport is non-empty and enumerates every rejected claim with a named reason (stub)', () => {
  const routingReport = makeStubRoutingReport();
  const report = buildConversionReport({
    moduleId: 'cbc_suite_v1',
    packVersion: PACK_VERSION,
    routingReport,
  });

  // AC: "Report is non-empty, structured JSON"
  assert.ok(report.exclusions.claims.length > 0, 'the report must not be vacuously empty for this stub fixture');

  // AC: "every claim P3-T4 excluded from rule evidence appears in the report with a named reason"
  const expectedExcludedIds = [
    'clm_stub_supported_no_passage', // supported, no resolved passage
    'clm_stub_inference_no_basis', // inference, missing inference_basis
    'clm_stub_speculation', // speculation — hard floor
    'clm_stub_unsupported', // unsupported — hard floor
    'clm_stub_weird', // unrecognized status — fail closed
  ].sort();
  assert.deepEqual(
    report.exclusions.claims.map((c) => c.itemId).sort(),
    expectedExcludedIds,
  );
  for (const excluded of report.exclusions.claims) {
    assert.equal(excluded.itemType, 'claim');
    assert.ok(Array.isArray(excluded.reasons) && excluded.reasons.length > 0, `${excluded.itemId} must carry >=1 named reason`);
    assert.ok(excluded.reasons.every((r) => typeof r === 'string' && r.length > 0));
  }

  // Never dropped: mixed/contradicted/eligible claims are NOT exclusions (they route to
  // ruleEvidenceEligible: true, per claim-routing.mjs) — confirm the boundary is exact, not fuzzy.
  const excludedIds = new Set(report.exclusions.claims.map((c) => c.itemId));
  assert.ok(!excludedIds.has('clm_stub_mixed'), 'a mixed claim is conflict-visible, not excluded');
  assert.ok(!excludedIds.has('clm_stub_contradicted'), 'a contradicted claim is conflict-visible, not excluded');
  assert.ok(!excludedIds.has('clm_stub_supported_ok'), 'an eligible supported claim must never appear as an exclusion');
});

// AC: "a test asserts the report's exclusion count matches the routing logic's actual reject count"
test('P5-T2 AC: buildConversionReport.summary.claimsExcluded === routingReport.rejected.length exactly (stub)', () => {
  const routingReport = makeStubRoutingReport();
  const report = buildConversionReport({ moduleId: 'cbc_suite_v1', packVersion: PACK_VERSION, routingReport });
  assert.equal(report.summary.claimsExcluded, routingReport.rejected.length);
  assert.equal(report.exclusions.claims.length, routingReport.rejected.length);
});

test('P5-T2: buildConversionReport.summary counts every routing bucket without double-counting or dropping a claim', () => {
  const routingReport = makeStubRoutingReport();
  const report = buildConversionReport({ moduleId: 'cbc_suite_v1', packVersion: PACK_VERSION, routingReport });
  assert.equal(report.summary.claimsTotal, routingReport.routed.length);
  assert.equal(
    report.summary.claimsEligibleForRuleEvidence + report.summary.claimsExcluded,
    report.summary.claimsTotal,
    'eligible + excluded must reconstruct the total claim count (ruleEvidenceEligible is a strict partition)',
  );
  assert.equal(report.summary.claimsConflictVisible, routingReport.conflictObjects.length);
});

test('P5-T2: buildConversionReport output is sorted deterministically by itemId, independent of input claim order', () => {
  const forward = routeClaims(
    [
      { claim_id: 'clm_zzz_speculation', status: 'speculation' },
      { claim_id: 'clm_aaa_speculation', status: 'speculation' },
    ],
  );
  const backward = routeClaims(
    [
      { claim_id: 'clm_aaa_speculation', status: 'speculation' },
      { claim_id: 'clm_zzz_speculation', status: 'speculation' },
    ],
  );
  const reportForward = buildConversionReport({ moduleId: 'm', packVersion: 'v', routingReport: forward });
  const reportBackward = buildConversionReport({ moduleId: 'm', packVersion: 'v', routingReport: backward });
  assert.deepEqual(reportForward.exclusions.claims.map((c) => c.itemId), ['clm_aaa_speculation', 'clm_zzz_speculation']);
  assert.deepEqual(reportForward, reportBackward, 'sort order must be independent of input claim order (determinism)');
});

test('P5-T2: buildConversionReport is a pure function (no I/O, deterministic given identical inputs)', () => {
  const routingReport = makeStubRoutingReport();
  const a = buildConversionReport({ moduleId: 'cbc_suite_v1', packVersion: PACK_VERSION, routingReport });
  const b = buildConversionReport({ moduleId: 'cbc_suite_v1', packVersion: PACK_VERSION, routingReport });
  assert.deepEqual(a, b);
});

test('P5-T2: buildConversionReport carries sources/candidates exclusion arrays (empty for this module, FR-19 shape)', () => {
  const routingReport = makeStubRoutingReport();
  const report = buildConversionReport({ moduleId: 'cbc_suite_v1', packVersion: PACK_VERSION, routingReport });
  assert.deepEqual(report.exclusions.sources, []);
  assert.deepEqual(report.exclusions.candidates, []);
  assert.equal(report.summary.sourcesExcluded, 0);
  assert.equal(report.summary.candidatesExcluded, 0);
});

// =================================================================================================
// Real fixture: buildConversionReport against the actual RF-CBC-001 routing report
// =================================================================================================

test('P5-T2: buildConversionReport against the real fixture\'s routing report enumerates all 60 excluded claims, each with a reason', async () => {
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

  const report = buildConversionReport({
    moduleId: pinned.moduleId,
    packVersion: PACK_VERSION,
    routingReport,
  });

  assert.equal(report.summary.claimsTotal, 87);
  assert.equal(report.summary.claimsEligibleForRuleEvidence, 27);
  assert.equal(report.summary.claimsConflictVisible, 0, 'the real fixture has 0 mixed/contradicted claims');
  assert.equal(report.summary.claimsExcluded, 60);
  assert.equal(report.exclusions.claims.length, 60, 'exclusion count must match routingReport.rejected.length exactly');

  // Never silently dropped: every rejected claim from the routing report must be present, by id.
  const reportedIds = new Set(report.exclusions.claims.map((c) => c.itemId));
  for (const rejected of routingReport.rejected) {
    assert.ok(reportedIds.has(rejected.claimId), `rejected claim ${rejected.claimId} must appear in the conversion report`);
  }
  for (const excluded of report.exclusions.claims) {
    assert.ok(excluded.reasons.length > 0, `${excluded.itemId} must carry a specific reason, not a bare pass/fail marker`);
  }

  // The 5 real speculation-status claims must appear, each with the speculation-specific reason.
  const speculationEntries = report.exclusions.claims.filter((c) => c.status === 'speculation');
  assert.equal(speculationEntries.length, 5, 'the real fixture has exactly 5 speculation-status claims (all excluded)');
  for (const entry of speculationEntries) {
    assert.ok(
      entry.reasons.some((r) => r.includes('never emitted as rule evidence')),
      `${entry.itemId} must carry the speculation-specific exclusion reason, not a generic one`,
    );
  }
});

// =================================================================================================
// Integration: a real propose run actually emits conversion-report.json, non-empty, matching the
// same run's own printed routing.rejected count
// =================================================================================================

test('P5-T2: a real propose run emits conversion-report.json whose exclusion count matches the run\'s own routing.rejected summary', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-conversion-report-test-'));
  try {
    const { result: exitCode, output } = await (async () => {
      const original = process.stdout.write.bind(process.stdout);
      const chunks = [];
      process.stdout.write = (chunk) => {
        chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
        return true;
      };
      try {
        const result = await runPropose({
          runDir: FIXTURE_DIR,
          module: REAL_MODULE_PATH,
          decisions: REAL_DECISIONS_PATH,
          out: outDir,
        });
        return { result, output: chunks.join('') };
      } finally {
        process.stdout.write = original;
      }
    })();

    assert.equal(exitCode, 0);
    const summary = JSON.parse(output);
    assert.equal(summary.packOutput.conversionReportPath, path.join(outDir, 'conversion-report.json'));

    const report = await loadJson(path.join(outDir, 'conversion-report.json'));
    assert.ok(Object.keys(report).length > 0, 'conversion-report.json must be non-empty structured JSON');
    assert.equal(report.summary.claimsExcluded, summary.routing.rejected, 'must match this run\'s own routing.rejected count');
    assert.equal(report.exclusions.claims.length, summary.routing.rejected);
    assert.equal(report.moduleId, summary.moduleId);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('P5-T2: conversion-report.json is byte-identical across two clean propose runs against the same fixture', async () => {
  const outDirA = await mkdtemp(path.join(os.tmpdir(), 'ef-conversion-report-determinism-a-'));
  const outDirB = await mkdtemp(path.join(os.tmpdir(), 'ef-conversion-report-determinism-b-'));
  try {
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDirA }),
    );
    await withCapturedStdout(() =>
      runPropose({ runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDirB }),
    );

    const rawA = await readFile(path.join(outDirA, 'conversion-report.json'), 'utf8');
    const rawB = await readFile(path.join(outDirB, 'conversion-report.json'), 'utf8');
    assert.equal(rawA, rawB, 'conversion-report.json must be byte-identical across two clean runs');
  } finally {
    await rm(outDirA, { recursive: true, force: true });
    await rm(outDirB, { recursive: true, force: true });
  }
});
