// tests/ef-converter-claim-routing.test.mjs — P3-T4 (evidence-foundry-buildout Phase 3, FR-13,
// `02 §4.11`).
//
// This task's binding acceptance criteria, verbatim:
//   "A mixed-status stub claim run through this routing produces a conflict-visible object, never
//    a rule proposal; a speculation-status stub claim produces zero rule-evidence output; an
//    authoring-decisions.yaml record missing basis.reasoning fails schema validation (R-P2
//    analog)" — the third clause is covered by tests/authoring-decisions-schema.test.mjs; this
// file covers the first two clauses plus the full 02 §4.11 routing table (supported/contradicted/
// inference/unsupported/unrecognized), using the same "stub claim" convention
// tests/ef-converter-eligibility.test.mjs (P2-T4) already established for synthetic claim ledger
// entries that never touch the real fixture on disk.

import test from 'node:test';
import assert from 'node:assert/strict';

import { routeClaim, routeClaims, BASIS_KIND } from '../tools/rf-bundle-to-kb-pack/lib/claim-routing.mjs';

test('supported claim WITH a resolved exact passage routes to source_supported_fact, eligible as sole positive basis', () => {
  const routed = routeClaim({ claim_id: 'clm_stub_supported', status: 'supported' }, { hasResolvedExactPassage: true });
  assert.deepEqual(routed, {
    claimId: 'clm_stub_supported',
    status: 'supported',
    basisKind: BASIS_KIND.SOURCE_SUPPORTED_FACT,
    ruleEvidenceEligible: true,
    eligibleAsSolePositiveBasis: true,
    isConflictVisible: false,
    reasons: [],
  });
});

test('supported claim WITHOUT a resolved exact passage is rejected outright — never eligible until the passage resolves', () => {
  const routed = routeClaim({ claim_id: 'clm_stub_supported_no_passage', status: 'supported' }, { hasResolvedExactPassage: false });
  assert.equal(routed.basisKind, BASIS_KIND.NONE);
  assert.equal(routed.ruleEvidenceEligible, false);
  assert.equal(routed.eligibleAsSolePositiveBasis, false);
  assert.ok(routed.reasons.some((r) => r.includes('no resolved exact passage')));
});

test('AC: a mixed-status stub claim routes to a conflict-visible object, never eligible as a one-sided rule\'s sole basis', () => {
  const routed = routeClaim({ claim_id: 'clm_stub_mixed', status: 'mixed' }, { hasResolvedExactPassage: true });
  assert.equal(routed.basisKind, BASIS_KIND.CONFLICTING_SOURCE_FACTS);
  assert.equal(routed.isConflictVisible, true, 'mixed claims must always be conflict-visible');
  assert.equal(routed.eligibleAsSolePositiveBasis, false, 'mixed claims must never be the sole positive basis for a rule — never a one-sided rule');
  // ruleEvidenceEligible is true (it CAN appear, but only as a conflict-visible object) —
  // eligibleAsSolePositiveBasis: false is the field a rule-drafting caller (P3-T5/P3-T7) must gate
  // on before ever emitting a one-sided rule proposal.
  assert.equal(routed.ruleEvidenceEligible, true);
});

test('mixed-status claim routes identically regardless of exact-passage resolution (conflict-visible constraint does not depend on it)', () => {
  const withPassage = routeClaim({ claim_id: 'clm_stub_mixed', status: 'mixed' }, { hasResolvedExactPassage: true });
  const withoutPassage = routeClaim({ claim_id: 'clm_stub_mixed', status: 'mixed' }, { hasResolvedExactPassage: false });
  assert.deepEqual(withPassage, withoutPassage);
});

test('contradicted claim routes to contradicted_source_fact, never eligible as sole positive basis', () => {
  const routed = routeClaim({ claim_id: 'clm_stub_contradicted', status: 'contradicted' }, { hasResolvedExactPassage: true });
  assert.equal(routed.basisKind, BASIS_KIND.CONTRADICTED_SOURCE_FACT);
  assert.equal(routed.isConflictVisible, true);
  assert.equal(routed.eligibleAsSolePositiveBasis, false, 'contradicted claims must never be the sole positive basis for a rule');
  assert.equal(routed.ruleEvidenceEligible, true, 'contradicted is not banned from rule evidence outright, unlike speculation/unsupported');
});

test('inference claim WITH populated inference_basis.from_claims routes to implementation_proposal, eligible as sole basis', () => {
  const routed = routeClaim(
    { claim_id: 'clm_stub_inference', status: 'inference', inference_basis: { from_claims: ['clm_a', 'clm_b'] } },
    { hasResolvedExactPassage: false },
  );
  assert.deepEqual(routed, {
    claimId: 'clm_stub_inference',
    status: 'inference',
    basisKind: BASIS_KIND.IMPLEMENTATION_PROPOSAL,
    ruleEvidenceEligible: true,
    eligibleAsSolePositiveBasis: true,
    isConflictVisible: false,
    reasons: [],
  });
});

test('inference claim with EMPTY inference_basis.from_claims is rejected — a valid, populated basis is required', () => {
  const routed = routeClaim({ claim_id: 'clm_stub_inference_empty', status: 'inference', inference_basis: { from_claims: [] } });
  assert.equal(routed.basisKind, BASIS_KIND.NONE);
  assert.equal(routed.ruleEvidenceEligible, false);
  assert.ok(routed.reasons.some((r) => r.includes('inference_basis.from_claims')));
});

test('inference claim with NO inference_basis at all is rejected the same way (missing, not just empty)', () => {
  const routed = routeClaim({ claim_id: 'clm_stub_inference_missing', status: 'inference' });
  assert.equal(routed.basisKind, BASIS_KIND.NONE);
  assert.equal(routed.ruleEvidenceEligible, false);
  assert.ok(routed.reasons.some((r) => r.includes('inference_basis.from_claims')));
});

test('AC: a speculation-status stub claim produces zero rule-evidence output', () => {
  const routed = routeClaim({ claim_id: 'clm_stub_speculation', status: 'speculation' }, { hasResolvedExactPassage: true });
  assert.equal(routed.basisKind, BASIS_KIND.NONE);
  assert.equal(routed.ruleEvidenceEligible, false, 'speculation claims must never be emitted as rule evidence at all');
  assert.equal(routed.eligibleAsSolePositiveBasis, false);
  assert.equal(routed.isConflictVisible, false);
  assert.ok(routed.reasons.some((r) => r.includes('never emitted as rule evidence')));
});

test('an unsupported-status stub claim produces zero rule-evidence output, the same hard floor as speculation', () => {
  const routed = routeClaim({ claim_id: 'clm_stub_unsupported', status: 'unsupported' }, { hasResolvedExactPassage: true });
  assert.equal(routed.basisKind, BASIS_KIND.NONE);
  assert.equal(routed.ruleEvidenceEligible, false);
  assert.ok(routed.reasons.some((r) => r.includes('never emitted as rule evidence')));
});

test('speculation/unsupported rejection is unconditional — a resolved exact passage does not rescue it', () => {
  const withPassage = routeClaim({ claim_id: 'clm_x', status: 'speculation' }, { hasResolvedExactPassage: true });
  const withoutPassage = routeClaim({ claim_id: 'clm_x', status: 'speculation' }, { hasResolvedExactPassage: false });
  assert.deepEqual(withPassage, withoutPassage);
});

test('an unrecognized/missing claim status fails closed rather than being silently admitted', () => {
  const routed = routeClaim({ claim_id: 'clm_stub_weird', status: 'not_a_real_status' });
  assert.equal(routed.basisKind, BASIS_KIND.NONE);
  assert.equal(routed.ruleEvidenceEligible, false);
  assert.ok(routed.reasons.some((r) => r.includes('unrecognized claim status')));

  const noStatus = routeClaim({ claim_id: 'clm_stub_no_status' });
  assert.equal(noStatus.ruleEvidenceEligible, false);
  assert.ok(noStatus.reasons.some((r) => r.includes('unrecognized claim status')));
});

test('routing is a pure, deterministic function — same claim + same options routes identically every time (02 §2.3 invariant 13)', () => {
  const claim = { claim_id: 'clm_stub_determinism', status: 'supported' };
  const first = routeClaim(claim, { hasResolvedExactPassage: true });
  const second = routeClaim(claim, { hasResolvedExactPassage: true });
  assert.deepEqual(first, second);
});

// --- routeClaims() — whole-ledger routing against a resolved evidence-assertions.json array ---

test('routeClaims() derives hasResolvedExactPassage per claim from evidence-assertions.json rfClaimId membership', () => {
  const claims = [
    { claim_id: 'clm_with_passage', status: 'supported' },
    { claim_id: 'clm_without_passage', status: 'supported' },
  ];
  const assertions = [{ assertionId: 'evas_test_001', rfClaimId: 'clm_with_passage' }];

  const report = routeClaims(claims, assertions);
  assert.equal(report.routed.length, 2);

  const withPassage = report.routed.find((r) => r.claimId === 'clm_with_passage');
  const withoutPassage = report.routed.find((r) => r.claimId === 'clm_without_passage');
  assert.equal(withPassage.ruleEvidenceEligible, true);
  assert.equal(withoutPassage.ruleEvidenceEligible, false);
});

test('routeClaims() partitions a mixed claim ledger into eligibleForRuleEvidence / conflictObjects / rejected without dropping any claim', () => {
  const claims = [
    { claim_id: 'clm_supported', status: 'supported' },
    { claim_id: 'clm_mixed', status: 'mixed' },
    { claim_id: 'clm_contradicted', status: 'contradicted' },
    { claim_id: 'clm_inference', status: 'inference', inference_basis: { from_claims: ['clm_supported'] } },
    { claim_id: 'clm_speculation', status: 'speculation' },
    { claim_id: 'clm_unsupported', status: 'unsupported' },
  ];
  const assertions = [
    { assertionId: 'evas_a', rfClaimId: 'clm_supported' },
    { assertionId: 'evas_b', rfClaimId: 'clm_mixed' },
    { assertionId: 'evas_c', rfClaimId: 'clm_contradicted' },
  ];

  const report = routeClaims(claims, assertions);
  assert.equal(report.routed.length, 6, 'every input claim must be retained in the routed list, rejected or not');

  assert.deepEqual(
    report.eligibleForRuleEvidence.map((r) => r.claimId).sort(),
    ['clm_contradicted', 'clm_inference', 'clm_mixed', 'clm_supported'].sort(),
  );
  assert.deepEqual(
    report.conflictObjects.map((r) => r.claimId).sort(),
    ['clm_contradicted', 'clm_mixed'].sort(),
  );
  assert.deepEqual(
    report.rejected.map((r) => r.claimId).sort(),
    ['clm_speculation', 'clm_unsupported'].sort(),
  );

  // Every conflict object must be non-sole-basis eligible (the whole point of this routing table).
  for (const conflictObject of report.conflictObjects) {
    assert.equal(conflictObject.eligibleAsSolePositiveBasis, false);
  }
  // Every rejected claim retains its reason — never silently dropped.
  for (const rejected of report.rejected) {
    assert.ok(rejected.reasons.length > 0, `${rejected.claimId}: rejected claim must retain >=1 reason`);
  }
});

test('routeClaims() with no assertions defaults every supported claim to rejected, without crashing', () => {
  const claims = [{ claim_id: 'clm_stub', status: 'supported' }];
  const report = routeClaims(claims);
  assert.equal(report.routed.length, 1);
  assert.equal(report.eligibleForRuleEvidence.length, 0);
  assert.equal(report.rejected.length, 1);
});

test('routeClaims() against the real RF-CBC-001 fixture claim ledger + committed evidence-assertions.json produces a non-empty, well-formed report', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { parseYamlDocument } = await import('../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs');

  const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const claimLedgerRaw = await readFile(
    path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001', 'claims', 'claim_ledger.yaml'), 'utf8',
  );
  const claimLedger = parseYamlDocument(claimLedgerRaw);
  const assertionsDoc = JSON.parse(
    await readFile(path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'evidence-assertions.json'), 'utf8'),
  );

  const report = routeClaims(claimLedger.claims, assertionsDoc.assertions);

  assert.equal(report.routed.length, claimLedger.claims.length, 'every real claim must route, none dropped');
  assert.ok(report.rejected.length > 0, 'the real fixture has >=1 speculation/unsupported/unresolved-passage claim');
  for (const rejected of report.rejected) {
    assert.ok(rejected.reasons.length > 0);
  }
  // The 4 slice-rule decisions' basis.rf_claim_ids are all "inference"-kind stub-adjacent claims
  // (dec_cbc_*'s reasoning cites clm_inf0x inference claims among others) — confirm at least one
  // real inference claim in this fixture routes to implementation_proposal.
  assert.ok(
    report.routed.some((r) => r.status === 'inference' && r.basisKind === BASIS_KIND.IMPLEMENTATION_PROPOSAL),
    'expected >=1 real inference claim to route to implementation_proposal',
  );
});
