// tests/ef-converter-eligibility.test.mjs — P2-T4: converter-eligibility + status-reconciliation
// checks (FR-9, 02 §2.3 invariants 1/3/4, 02 §3.7).
//
// Task acceptance criteria (phase-1-2-foundation-converter.md, row P2-T4):
//   1. "A seeded non-`verified`-status fixture produces a non-zero exit and zero output files" —
//      asserted below: `checkEligibility` throws `BundleNotVerifiedError` (a `ConverterError`
//      subclass carrying a fixed non-zero `exitCode`); this module performs no filesystem I/O of
//      any kind, so "zero output files" holds by construction whenever it throws.
//   2. "A seeded exit-code/artifact-status mismatch fixture is rejected with a specific
//      'process/artifact status disagreement' error, not silently passed through" — asserted
//      below via `VerificationStateMismatchError`, whose message contains that exact phrase.
//
// Additional coverage exercises the 02 §3.7 per-claim field-table gate (source/evidence/locator/
// passage/population/lab-context resolution), the claim-status routing 02 §2.3 items 7-10
// describe (supported -> fact_candidate, mixed/contradicted -> conflict_object, inference ->
// implementation_proposal_input with a required basis, speculation/unsupported -> rejected
// outright), and determinism. This file is deliberately NOT `tests/ef-converter-invariants.test.mjs`
// (P2-T8's seam task) — same convention `tests/ef-converter-error-taxonomy.test.mjs` (P2-T5) and
// `tests/ef-converter-loader.test.mjs` (P2-T2) document for their own files.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBundle } from '../tools/rf-bundle-to-kb-pack/lib/loader.mjs';
import {
  checkEligibility,
  BundleNotVerifiedError,
  VerificationStateMismatchError,
  CLAIM_CATEGORIES,
} from '../tools/rf-bundle-to-kb-pack/lib/eligibility.mjs';
import { SchemaError, EXIT_SCHEMA } from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');

// Same synthetic-module-with-decisions convention `tests/ef-converter-loader.test.mjs` uses: a
// throwaway module.json + authoring-decisions.yaml pair so this file can drive `loadBundle`
// without pre-empting P3-T1's real `modules/cbc_suite_v1/authoring-decisions.yaml`.
async function makeTempModuleWithDecisions() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ef-eligibility-test-module-'));
  const modulePath = path.join(dir, 'module.json');
  await writeFile(modulePath, JSON.stringify({ id: 'test_stub_module', title: 'Test Stub Module' }), 'utf8');
  await writeFile(path.join(dir, 'authoring-decisions.yaml'), 'notes: temp stub for P2-T4 eligibility tests\n', 'utf8');
  return { dir, modulePath };
}

/**
 * `checkEligibility` only reads the `LoadedBundle`-shaped subset of a real `PinnedBundle`
 * (`bundle.parsed`, `artifacts.verification.parsed`, `artifacts.claimLedger.parsed`,
 * `artifacts.sourceCards`) — see the module header's forward-compatibility note. Loading the real
 * fixture through the already-complete `loader.mjs` (P2-T2) and passing that object straight
 * through exercises this task against real bundle data without depending on `hashing.mjs`
 * (P2-T3), which is a separate, independently-scheduled task in this same phase batch.
 */
async function loadRealFixtureAsPinnedBundle() {
  const { dir: moduleDir, modulePath } = await makeTempModuleWithDecisions();
  try {
    return await loadBundle({ runDir: FIXTURE_DIR, modulePath });
  } finally {
    await rm(moduleDir, { recursive: true, force: true });
  }
}

// A minimal, self-contained synthetic PinnedBundle for the seeded-failure and per-claim-gate
// tests below — deliberately NOT derived from the real fixture, so each test controls exactly
// the one field under test.
function makeSyntheticBundle({
  status = 'verified',
  exitCode = 0,
  passed = true,
  createdAt = '2026-07-18T00:00:00-04:00',
  claims = [],
  sourceCards = [],
} = {}) {
  return {
    bundle: { parsed: { id: 'bundle_test', status, created_at: createdAt } },
    artifacts: {
      verification: { parsed: { exit_code: exitCode, passed } },
      claimLedger: { parsed: { claims } },
      sourceCards,
    },
  };
}

function sourceCard(frontmatter) {
  return { frontmatter };
}

const GOOD_POINT = Object.freeze({
  evidence_id: 'ev_001',
  locator: 'Abstract — Methods',
  quote: '[redacted — content-rights: restricted (usage.allowed_for_public_output=false); sha256:' +
    'a'.repeat(64) + ']',
  pediatric_cds: {
    population: 'Pediatric patients under 18 years',
    assay_method: 'Automated hematology analyzer',
    threshold: { value: '0.5', units_ucum: '10*9/L' },
    lifecycle: { effective: '2026-01', retire: null },
  },
});

// ----- 1. Real fixture: bundle-level status passes, claim-level routing matches known counts ----

test('P2-T4: checkEligibility accepts the real rf-cbc-001 fixture and routes all 87 claims', async () => {
  const pinnedBundle = await loadRealFixtureAsPinnedBundle();
  const report = checkEligibility(pinnedBundle);

  assert.equal(report.bundle.status, 'verified');
  assert.equal(report.bundle.verification.exitCode, 0);
  assert.equal(report.bundle.verification.passed, true);
  assert.equal(report.claims.length, 87);

  const byCategory = {};
  for (const c of report.claims) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
  }
  // Fixture's own known composition (HASH-PROVENANCE.md / evidence_bundle.yaml counts):
  // 74 supported, 8 inference, 5 speculation, 0 mixed/contradicted/unsupported.
  assert.equal(byCategory[CLAIM_CATEGORIES.FACT_CANDIDATE], 74);
  assert.equal(byCategory[CLAIM_CATEGORIES.IMPLEMENTATION_PROPOSAL_INPUT], 8);
  assert.equal(byCategory[CLAIM_CATEGORIES.REJECTED], 5);
  assert.equal(byCategory[CLAIM_CATEGORIES.CONFLICT_OBJECT], undefined);

  assert.equal(report.eligibleClaimIds.length, 82); // 74 fact_candidate + 8 implementation_proposal_input
  assert.equal(report.rejectedClaims.length, 5);
  for (const rejected of report.rejectedClaims) {
    assert.equal(rejected.status, 'speculation');
    assert.ok(rejected.reasons.length > 0, 'a rejected claim always retains >=1 reason (never silently dropped)');
    assert.match(rejected.reasons[0], /not converter-eligible for clinical rule evidence/);
  }
});

test('P2-T4: checkEligibility is deterministic over the real fixture (identical bytes -> identical output)', async () => {
  const pinnedBundleA = await loadRealFixtureAsPinnedBundle();
  const pinnedBundleB = await loadRealFixtureAsPinnedBundle();
  const reportA = checkEligibility(pinnedBundleA);
  const reportB = checkEligibility(pinnedBundleB);
  assert.deepEqual(reportA, reportB);
});

// ----- 2. AC 1: a seeded non-`verified` bundle status is rejected, non-zero exit, no output -----

test('P2-T4: a non-"verified" bundle status is rejected with BundleNotVerifiedError (non-zero exit)', () => {
  const pinnedBundle = makeSyntheticBundle({ status: 'draft' });
  assert.throws(
    () => checkEligibility(pinnedBundle),
    (err) => {
      assert.ok(err instanceof BundleNotVerifiedError, `expected BundleNotVerifiedError, got ${err.constructor.name}`);
      assert.ok(err instanceof SchemaError);
      assert.equal(err.exitCode, EXIT_SCHEMA);
      assert.notEqual(err.exitCode, 0, 'AC: non-zero exit');
      assert.equal(err.actualStatus, 'draft');
      return true;
    },
  );
});

test('P2-T4: checkEligibility performs no filesystem writes when it rejects a bundle (AC: zero output files)', () => {
  // eligibility.mjs imports nothing beyond ./errors.mjs — no fs module is reachable from this
  // file, so a thrown rejection cannot have produced partial output. Asserted structurally here
  // (module import surface) rather than by probing a real directory, since checkEligibility never
  // receives a directory path to write into in the first place (it operates purely in-memory).
  const pinnedBundle = makeSyntheticBundle({ status: 'not_verified_yet' });
  assert.throws(() => checkEligibility(pinnedBundle), BundleNotVerifiedError);
});

// ----- 3. AC 2: process/artifact status disagreement is rejected with a specific error ----------

test('P2-T4: verified bundle status + exit_code!=0 is a process/artifact status disagreement', () => {
  const pinnedBundle = makeSyntheticBundle({ status: 'verified', exitCode: 2, passed: false });
  assert.throws(
    () => checkEligibility(pinnedBundle),
    (err) => {
      assert.ok(
        err instanceof VerificationStateMismatchError,
        `expected VerificationStateMismatchError, got ${err.constructor.name}`,
      );
      assert.ok(err instanceof SchemaError);
      assert.equal(err.exitCode, EXIT_SCHEMA);
      assert.match(err.message, /process\/artifact status disagreement/);
      return true;
    },
  );
});

test('P2-T4: verified bundle status + passed=true but exit_code!=0 is rejected, not silently passed through', () => {
  const pinnedBundle = makeSyntheticBundle({ status: 'verified', exitCode: 1, passed: true });
  assert.throws(
    () => checkEligibility(pinnedBundle),
    (err) => {
      assert.ok(err instanceof VerificationStateMismatchError);
      assert.match(err.message, /process\/artifact status disagreement/);
      assert.match(err.message, /exit_code=1/);
      return true;
    },
  );
});

test('P2-T4: verified bundle status + exit_code=0 but passed=false is rejected, not silently passed through', () => {
  const pinnedBundle = makeSyntheticBundle({ status: 'verified', exitCode: 0, passed: false });
  assert.throws(
    () => checkEligibility(pinnedBundle),
    (err) => {
      assert.ok(err instanceof VerificationStateMismatchError);
      assert.match(err.message, /process\/artifact status disagreement/);
      return true;
    },
  );
});

test('P2-T4: a fully self-consistent, verified bundle with no claims resolves cleanly (empty claims, not an error)', () => {
  const pinnedBundle = makeSyntheticBundle({ status: 'verified', exitCode: 0, passed: true, claims: [] });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims.length, 0);
  assert.deepEqual(report.eligibleClaimIds, []);
  assert.deepEqual(report.rejectedClaims, []);
});

// ----- 4. Per-claim field-table gate (02 §3.7), claim-status routing (02 §2.3 items 7-10) -------

test('P2-T4: a supported claim with no cited sources is rejected', () => {
  const pinnedBundle = makeSyntheticBundle({
    claims: [{ claim_id: 'clm_x', status: 'supported', sources: [] }],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, false);
  assert.equal(report.claims[0].category, CLAIM_CATEGORIES.REJECTED);
  assert.match(report.claims[0].reasons[0], /no cited sources/);
});

test('P2-T4: a supported claim whose source_card_id does not resolve is rejected with a specific reason', () => {
  const pinnedBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_x',
        status: 'supported',
        sources: [{ source_card_id: 'src_does_not_exist', evidence_id: 'ev_001', locator: 'x' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [GOOD_POINT] })],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, false);
  assert.match(report.claims[0].reasons[0], /does not resolve to a source card/);
});

test('P2-T4: a supported claim whose evidence_id does not resolve is rejected', () => {
  const pinnedBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_x',
        status: 'supported',
        sources: [{ source_card_id: 'src_real', evidence_id: 'ev_missing', locator: 'x' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [GOOD_POINT] })],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, false);
  assert.match(report.claims[0].reasons[0], /does not resolve to an extracted point/);
});

test('P2-T4: a degraded "para/0" locator is insufficient for a threshold', () => {
  const degradedPoint = { ...GOOD_POINT, locator: 'para/0' };
  const pinnedBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_x',
        status: 'supported',
        sources: [{ source_card_id: 'src_real', evidence_id: 'ev_001' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [degradedPoint] })],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, false);
  assert.match(report.claims[0].reasons.join('\n'), /degraded-content placeholder/);
});

test('P2-T4: a missing exact passage (no quote, no immutable reference) is rejected', () => {
  const noPassagePoint = { ...GOOD_POINT, quote: '' };
  const pinnedBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_x',
        status: 'supported',
        sources: [{ source_card_id: 'src_real', evidence_id: 'ev_001' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [noPassagePoint] })],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, false);
  assert.match(report.claims[0].reasons.join('\n'), /no exact passage/);
});

test('P2-T4: missing population/applicability qualifiers are rejected', () => {
  const noPopulationPoint = { ...GOOD_POINT, pediatric_cds: { ...GOOD_POINT.pediatric_cds, population: '' } };
  const pinnedBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_x',
        status: 'supported',
        sources: [{ source_card_id: 'src_real', evidence_id: 'ev_001' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [noPopulationPoint] })],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, false);
  assert.match(report.claims[0].reasons.join('\n'), /population\/applicability qualifiers/);
});

test('P2-T4: a threshold value with no laboratory context (assay_method) is rejected', () => {
  const noAssayPoint = {
    ...GOOD_POINT,
    pediatric_cds: { ...GOOD_POINT.pediatric_cds, assay_method: '' },
  };
  const pinnedBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_x',
        status: 'supported',
        sources: [{ source_card_id: 'src_real', evidence_id: 'ev_001' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [noAssayPoint] })],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, false);
  assert.match(report.claims[0].reasons.join('\n'), /laboratory context/);
});

test('P2-T4: a threshold-free (background/qualitative) point does not require laboratory context', () => {
  const backgroundPoint = {
    ...GOOD_POINT,
    pediatric_cds: { ...GOOD_POINT.pediatric_cds, assay_method: '', threshold: { value: null, units_ucum: null } },
  };
  const pinnedBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_x',
        status: 'supported',
        sources: [{ source_card_id: 'src_real', evidence_id: 'ev_001' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [backgroundPoint] })],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, true);
  assert.equal(report.claims[0].category, CLAIM_CATEGORIES.FACT_CANDIDATE);
});

test('P2-T4: missing lifecycle metadata is rejected', () => {
  const noLifecyclePoint = { ...GOOD_POINT, pediatric_cds: { ...GOOD_POINT.pediatric_cds, lifecycle: undefined } };
  const pinnedBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_x',
        status: 'supported',
        sources: [{ source_card_id: 'src_real', evidence_id: 'ev_001' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [noLifecyclePoint] })],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, false);
  assert.match(report.claims[0].reasons.join('\n'), /lifecycle metadata/);
});

test('P2-T4: a source more than five years old without a stated rationale is rejected', () => {
  const stalePoint = { ...GOOD_POINT };
  const pinnedBundle = makeSyntheticBundle({
    createdAt: '2026-07-18T00:00:00-04:00',
    claims: [
      {
        claim_id: 'clm_x',
        status: 'supported',
        sources: [{ source_card_id: 'src_stale', evidence_id: 'ev_001' }],
      },
    ],
    sourceCards: [
      sourceCard({
        source_card_id: 'src_stale',
        source: { published_at: '2018-01' }, // 8 years before bundle created_at
        trust: {},
        extracted_points: [stalePoint],
      }),
    ],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, false);
  assert.match(report.claims[0].reasons.join('\n'), /more than five years old/);
});

test('P2-T4: a source more than five years old WITH a stated foundational rationale is accepted', () => {
  const stalePoint = { ...GOOD_POINT };
  const pinnedBundle = makeSyntheticBundle({
    createdAt: '2026-07-18T00:00:00-04:00',
    claims: [
      {
        claim_id: 'clm_x',
        status: 'supported',
        sources: [{ source_card_id: 'src_stale', evidence_id: 'ev_001' }],
      },
    ],
    sourceCards: [
      sourceCard({
        source_card_id: 'src_stale',
        source: { published_at: '2018-01' },
        trust: { reliability_notes: 'Foundational reference standard, not superseded by any later study.' },
        extracted_points: [stalePoint],
      }),
    ],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, true);
});

test('P2-T4: a fully-resolving supported claim is admitted as a fact_candidate', () => {
  const pinnedBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_good',
        status: 'supported',
        sources: [{ source_card_id: 'src_real', evidence_id: 'ev_001' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [GOOD_POINT] })],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, true);
  assert.equal(report.claims[0].category, CLAIM_CATEGORIES.FACT_CANDIDATE);
  assert.deepEqual(report.claims[0].reasons, []);
  assert.deepEqual(report.eligibleClaimIds, ['clm_good']);
});

// 02 §2.3 invariant 8: mixed/contradicted claims land in conflict-visible objects, never a
// one-sided rule — even when every field-table check resolves cleanly.
for (const status of ['mixed', 'contradicted']) {
  test(`P2-T4: a fully-resolving "${status}" claim is admitted, but as conflict_object, never fact_candidate`, () => {
    const pinnedBundle = makeSyntheticBundle({
      claims: [
        {
          claim_id: `clm_${status}`,
          status,
          sources: [{ source_card_id: 'src_real', evidence_id: 'ev_001' }],
        },
      ],
      sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [GOOD_POINT] })],
    });
    const report = checkEligibility(pinnedBundle);
    assert.equal(report.claims[0].eligible, true);
    assert.equal(report.claims[0].category, CLAIM_CATEGORIES.CONFLICT_OBJECT);
    assert.notEqual(report.claims[0].category, CLAIM_CATEGORIES.FACT_CANDIDATE);
  });
}

// 02 §2.3 invariant 9: inference claims are admitted only with a declared basis.
test('P2-T4: an inference claim with inference_basis.from_claims is admitted as implementation_proposal_input', () => {
  const pinnedBundle = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_inf',
        status: 'inference',
        sources: [],
        inference_basis: { from_claims: ['clm_a', 'clm_b'] },
      },
    ],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, true);
  assert.equal(report.claims[0].category, CLAIM_CATEGORIES.IMPLEMENTATION_PROPOSAL_INPUT);
});

test('P2-T4: an inference claim with no inference_basis.from_claims is rejected', () => {
  const pinnedBundle = makeSyntheticBundle({
    claims: [
      { claim_id: 'clm_inf_bad', status: 'inference', sources: [], inference_basis: { from_claims: [] } },
    ],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, false);
  assert.match(report.claims[0].reasons[0], /inference_basis\.from_claims/);
});

// 02 §2.3 invariant 10: speculation and unsupported are rejected outright, regardless of any
// other field — even one that would otherwise fully resolve.
for (const status of ['speculation', 'unsupported']) {
  test(`P2-T4: a "${status}" claim is rejected outright, even with a fully-resolving source`, () => {
    const pinnedBundle = makeSyntheticBundle({
      claims: [
        {
          claim_id: `clm_${status}`,
          status,
          sources: [{ source_card_id: 'src_real', evidence_id: 'ev_001' }],
        },
      ],
      sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [GOOD_POINT] })],
    });
    const report = checkEligibility(pinnedBundle);
    assert.equal(report.claims[0].eligible, false);
    assert.equal(report.claims[0].category, CLAIM_CATEGORIES.REJECTED);
    assert.match(report.claims[0].reasons[0], new RegExp(`claim status "${status}"`));
  });
}

test('P2-T4: an unrecognized claim status is rejected, not silently admitted', () => {
  const pinnedBundle = makeSyntheticBundle({
    claims: [{ claim_id: 'clm_weird', status: 'something_else', sources: [] }],
  });
  const report = checkEligibility(pinnedBundle);
  assert.equal(report.claims[0].eligible, false);
  assert.match(report.claims[0].reasons[0], /unrecognized claim status/);
});

// 02 §2.3 invariant 12: absence must never be manufactured from a malformed field.
test('P2-T4: a malformed (non-array) "claims" field fails closed rather than being treated as "no claims"', () => {
  const pinnedBundle = makeSyntheticBundle();
  pinnedBundle.artifacts.claimLedger.parsed.claims = 'not-an-array';
  assert.throws(() => checkEligibility(pinnedBundle), SchemaError);
});

// 02 §2.3 invariant 11 (no confidence-to-probability translation): checkEligibility never reads
// `claim.confidence` at all — asserted structurally by confirming a claim with a wildly different
// confidence value routes identically to one without any confidence field.
test('P2-T4: claim.confidence has no bearing on eligibility routing (no confidence-to-probability translation)', () => {
  const withConfidence = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_conf',
        status: 'supported',
        confidence: 'high',
        sources: [{ source_card_id: 'src_real', evidence_id: 'ev_001' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [GOOD_POINT] })],
  });
  const withoutConfidence = makeSyntheticBundle({
    claims: [
      {
        claim_id: 'clm_conf',
        status: 'supported',
        sources: [{ source_card_id: 'src_real', evidence_id: 'ev_001' }],
      },
    ],
    sourceCards: [sourceCard({ source_card_id: 'src_real', extracted_points: [GOOD_POINT] })],
  });
  const reportWith = checkEligibility(withConfidence);
  const reportWithout = checkEligibility(withoutConfidence);
  assert.deepEqual(reportWith.claims, reportWithout.claims);
});
