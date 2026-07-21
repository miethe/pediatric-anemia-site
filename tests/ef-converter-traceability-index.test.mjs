// tests/ef-converter-traceability-index.test.mjs — P5-T4 (evidence-foundry-buildout Phase 5,
// `02 §4.16`).
//
// Task acceptance criteria (phase-3-5-projection-slice-manifest.md, row P5-T4):
//   "Both bidirectional queries succeed with zero dangling edges for all 4 slice rules; index is a
//   committed, inspectable artifact (not a runtime-only in-memory structure)."
//
// This suite proves, against the REAL committed `modules/cbc_suite_v1/` content (never synthetic
// stubs — the whole point is that the index resolves real cross-references):
//   1. `modules/cbc_suite_v1/traceability-index.json` exists, is committed, and is byte-identical
//      to what `generateTraceabilityIndex()` produces right now (regeneration is deterministic and
//      the committed copy is not stale — mirrors `scripts/evidence/backfill-rule-governance.mjs`'s
//      own `--check` proof style).
//   2. Query (1) `queryTraceabilityByOutput` succeeds for all 4 slice rules' rendered-output ids
//      (ruleId for alert/note outputs, candidateId for the one candidate-type rule) with a
//      non-empty decisionId/claims/passages/sources/reviewBy on every result — zero dangling edges.
//   3. Query (2) `queryTraceabilityBySource` succeeds for every one of `evidence.json`'s 8 sources
//      with non-empty claims/rules/tests/outputs on every result — zero dangling edges — AND the
//      union of every source's `ruleIds` covers all 4 slice rules (every rule is reachable from at
//      least one source; no rule is an orphan the reverse query could never find).
//   4. Both query functions fail closed (a named `TraceabilityNotFoundError`, never an empty/
//      undefined result) for an unknown output/source id.
//   5. `buildTraceabilityIndex` is a pure, deterministic function: building twice from the same
//      inputs yields byte-identical JSON.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TraceabilityNotFoundError,
  buildTraceabilityIndex,
  generateTraceabilityIndex,
  expandClaimIdToLeafClaims,
  loadTraceabilityIndexInputs,
  queryTraceabilityByOutput,
  queryTraceabilityBySource,
} from '../tools/rf-bundle-to-kb-pack/lib/traceability-index.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');
const COMMITTED_INDEX_PATH = path.join(MODULE_DIR, 'traceability-index.json');

const SLICE_RULE_IDS = [
  'CBC-NEUT-YOUNGINF-001',
  'CBC-NEUT-LOCALRANGE-001',
  'CBC-MARROW-REDFLAG-001',
  'CBC-NEUT-BENIGNDIFF-001',
];

// The one candidate-type slice rule renders under its `output.candidateId`, not its rule id (see
// modules/cbc_suite_v1/rules.json / tests/ef-cbc_suite_v1-positive.test.mjs).
const RENDERED_OUTPUT_IDS = [
  'CBC-NEUT-YOUNGINF-001',
  'CBC-NEUT-LOCALRANGE-001',
  'CBC-MARROW-REDFLAG-001',
  'benign-ethnic-neutropenia-differential-pattern',
];

let cachedIndex;
async function loadCommittedIndex() {
  if (!cachedIndex) {
    cachedIndex = JSON.parse(await readFile(COMMITTED_INDEX_PATH, 'utf8'));
  }
  return cachedIndex;
}

// ---- (1) committed artifact is current, not stale -----------------------------------------------

test('P5-T4: modules/cbc_suite_v1/traceability-index.json exists and matches a fresh regeneration', async () => {
  const committedRaw = await readFile(COMMITTED_INDEX_PATH, 'utf8');
  const regenerated = await generateTraceabilityIndex({ moduleDir: MODULE_DIR, repoRoot: REPO_ROOT });
  const regeneratedRaw = `${JSON.stringify(regenerated, null, 2)}\n`;
  assert.equal(
    committedRaw,
    regeneratedRaw,
    'committed traceability-index.json is stale — rerun scripts/evidence/build-cbc-traceability-index.mjs',
  );
});

test('P5-T4: committed index carries all 4 slice rules and no others', async () => {
  const index = await loadCommittedIndex();
  assert.deepEqual(Object.keys(index.rules).sort(), [...SLICE_RULE_IDS].sort());
});

// ---- (2) query 1: given a rendered output, show rule/decision/claims/passages/sources/reviewBy --

test('P5-T4: queryTraceabilityByOutput resolves every rendered output id with zero dangling edges', async () => {
  const index = await loadCommittedIndex();
  for (const outputId of RENDERED_OUTPUT_IDS) {
    const result = queryTraceabilityByOutput(index, outputId);
    assert.ok(SLICE_RULE_IDS.includes(result.ruleId), `${outputId}: ruleId must be one of the 4 slice rules`);
    assert.ok(typeof result.decisionId === 'string' && result.decisionId.length > 0, `${outputId}: decisionId must be non-empty`);
    assert.ok(Array.isArray(result.leafClaimIds) && result.leafClaimIds.length > 0, `${outputId}: leafClaimIds must be non-empty`);
    assert.ok(Array.isArray(result.passages) && result.passages.length > 0, `${outputId}: passages must be non-empty`);
    assert.ok(Array.isArray(result.sourceIds) && result.sourceIds.length > 0, `${outputId}: sourceIds must be non-empty`);
    assert.ok(typeof result.reviewBy === 'string' && result.reviewBy.length > 0, `${outputId}: reviewBy must be non-empty`);
    for (const passage of result.passages) {
      assert.ok(passage.sourceId, `${outputId}: every passage must resolve a sourceId`);
      assert.match(passage.exactPassageSha256, /^sha256:[0-9a-f]{64}$/, `${outputId}: passage sha256 must be well-formed`);
    }
  }
});

test('P5-T4: queryTraceabilityByOutput resolves a rule id even for the candidate-rendered rule', async () => {
  const index = await loadCommittedIndex();
  const byRuleId = queryTraceabilityByOutput(index, 'CBC-NEUT-BENIGNDIFF-001');
  assert.equal(byRuleId.ruleId, 'CBC-NEUT-BENIGNDIFF-001');
  assert.equal(byRuleId.outputId, 'benign-ethnic-neutropenia-differential-pattern');
});

test('P5-T4: queryTraceabilityByOutput fails closed (named error, not empty result) for an unknown output', async () => {
  const index = await loadCommittedIndex();
  assert.throws(
    () => queryTraceabilityByOutput(index, 'NOT-A-REAL-OUTPUT-ID'),
    (err) => err instanceof TraceabilityNotFoundError && err.kind === 'output',
  );
});

// ---- (3) query 2: given a source, list claims/rules/tests/outputs potentially affected ----------

test('P5-T4: queryTraceabilityBySource resolves every evidence.json source with zero dangling edges', async () => {
  const index = await loadCommittedIndex();
  const evidenceDoc = JSON.parse(await readFile(path.join(MODULE_DIR, 'evidence.json'), 'utf8'));
  const sourceIds = evidenceDoc.sources.map((source) => source.id);
  assert.ok(sourceIds.length > 0, 'sanity: evidence.json must declare at least one source');

  const ruleIdsSeen = new Set();
  for (const sourceId of sourceIds) {
    const result = queryTraceabilityBySource(index, sourceId);
    assert.ok(Array.isArray(result.claimIds) && result.claimIds.length > 0, `${sourceId}: claimIds must be non-empty`);
    assert.ok(Array.isArray(result.ruleIds) && result.ruleIds.length > 0, `${sourceId}: ruleIds must be non-empty`);
    assert.ok(Array.isArray(result.testRefs) && result.testRefs.length > 0, `${sourceId}: testRefs must be non-empty`);
    assert.ok(Array.isArray(result.outputIds) && result.outputIds.length > 0, `${sourceId}: outputIds must be non-empty`);
    for (const ruleId of result.ruleIds) {
      assert.ok(SLICE_RULE_IDS.includes(ruleId), `${sourceId}: ruleIds must only name real slice rules`);
      ruleIdsSeen.add(ruleId);
    }
    for (const testRef of result.testRefs) {
      assert.ok(testRef.file && testRef.testName, `${sourceId}: every testRef must name a file and testName`);
    }
  }

  // Completeness: every slice rule must be reachable from at least one source — otherwise this
  // reverse query could never discover that rule from any source correction, a dangling edge in
  // the opposite direction from an unresolved forward edge.
  assert.deepEqual([...ruleIdsSeen].sort(), [...SLICE_RULE_IDS].sort());
});

test('P5-T4: queryTraceabilityBySource fails closed (named error, not empty result) for an unknown source', async () => {
  const index = await loadCommittedIndex();
  assert.throws(
    () => queryTraceabilityBySource(index, 'NOT-A-REAL-SOURCE-ID'),
    (err) => err instanceof TraceabilityNotFoundError && err.kind === 'source',
  );
});

// ---- (4) claim expansion: inference claims resolve to their supported parent claims -------------

test('P5-T4: expandClaimIdToLeafClaims resolves a supported claim to itself', () => {
  const claimsById = new Map([['clm_x', { claim_id: 'clm_x', status: 'supported' }]]);
  assert.deepEqual(expandClaimIdToLeafClaims('clm_x', claimsById), ['clm_x']);
});

test('P5-T4: expandClaimIdToLeafClaims resolves an inference claim to its sorted, deduped parents', () => {
  const claimsById = new Map([
    ['clm_inf', { claim_id: 'clm_inf', status: 'inference', inference_basis: { from_claims: ['clm_b', 'clm_a'] } }],
    ['clm_a', { claim_id: 'clm_a', status: 'supported' }],
    ['clm_b', { claim_id: 'clm_b', status: 'supported' }],
  ]);
  assert.deepEqual(expandClaimIdToLeafClaims('clm_inf', claimsById), ['clm_a', 'clm_b']);
});

test('P5-T4: expandClaimIdToLeafClaims returns nothing for an unknown claim id (never invents one)', () => {
  assert.deepEqual(expandClaimIdToLeafClaims('clm_does_not_exist', new Map()), []);
});

test('P5-T4: expandClaimIdToLeafClaims does not infinite-loop on a cyclic from_claims graph', () => {
  const claimsById = new Map([
    ['clm_a', { claim_id: 'clm_a', status: 'inference', inference_basis: { from_claims: ['clm_b'] } }],
    ['clm_b', { claim_id: 'clm_b', status: 'inference', inference_basis: { from_claims: ['clm_a'] } }],
  ]);
  assert.deepEqual(expandClaimIdToLeafClaims('clm_a', claimsById), []);
});

// ---- (5) buildTraceabilityIndex is pure and deterministic ---------------------------------------

test('P5-T4: buildTraceabilityIndex produces byte-identical output across two calls with the same inputs', async () => {
  const inputs = await loadTraceabilityIndexInputs({ moduleDir: MODULE_DIR, repoRoot: REPO_ROOT });
  const a = buildTraceabilityIndex(inputs);
  const b = buildTraceabilityIndex(inputs);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('P5-T4: loadTraceabilityIndexInputs locates claim_ledger.yaml via rule-provenance.json\'s own fixturePath', async () => {
  const inputs = await loadTraceabilityIndexInputs({ moduleDir: MODULE_DIR, repoRoot: REPO_ROOT });
  assert.ok(inputs.claimsById instanceof Map);
  assert.ok(inputs.claimsById.size > 0);
  assert.ok(inputs.claimsById.has('clm_018'), 'a known RF-CBC-001 claim id must resolve');
});
