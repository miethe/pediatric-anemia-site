// tests/ef-conflict-objects.test.mjs — multi-bundle-conversion-e1 Phase 5, row P5-T3
// (R-P2 AC; FR-11/FR-12; OQ-5).
//
// Task acceptance criteria (phase-5-6-7-projection-determinism-docs.md, row P5-T3):
//   1. "A trace query over both named conflict classes (proteinuria, WHO-vs-CDC growth) resolves
//      to a named conflict object with all contributing sources, for both modules." — see section
//      1 below. `modules/kidney_suite_v1/unresolved.json` and `modules/growth_suite_v1/
//      unresolved.json` were authored (P5-T1/P5-T2) with two DIFFERENT conflict-entry shapes
//      (`entryKind: "conflict"` + `contributingSources[]` objects for kidney;
//      `kind: "named_conflict"` + `contributingSourceIds[]` strings for growth) — the trace query
//      below normalizes over both so a consumer never has to know which module authored which
//      shape, and proves that ANY contributing claim id resolves to the SAME named object (exactly
//      the guarantee kidney's own `unresolved.json` "reason" field states in prose).
//   2. "A consumer reading `unresolved.json` for a module with zero unresolved claims sees an
//      explicit `[]`, never a missing file or a missing key." — see section 2. Neither committed
//      module currently has zero unresolved claims (kidney: 83 entries, growth: 90), so this is
//      proven two ways: (a) a synthetic zero-entry fixture, read by this converter's own shared
//      `readOptionalJsonArray` consumer (`tools/rf-bundle-to-kb-pack/lib/multi-bundle-report.mjs`),
//      resolves to a real, present, top-level `[]` — not a wrapped key, not an absent file; and
//      (b) both REAL committed modules' `unresolved.json` files are independently confirmed present
//      (never missing) and top-level-array-shaped right now, so the same reader will emit an
//      explicit `[]` the moment either module's count reaches zero.
//   3. "Per OQ-5, the hand-written `candidate-scaffolds.json` structural check (fields present:
//      `scaffoldId`, `supportingClaimIds[]`, `moduleId`, `rationale`) rejects a malformed
//      scaffold." — see section 3. OQ-5 is resolved as a HAND-WRITTEN structural assertion, not a
//      new JSON Schema file (no `schemas/candidate-scaffold.schema.json` exists or is created here).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readOptionalJsonArray } from '../tools/rf-bundle-to-kb-pack/lib/multi-bundle-report.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIDNEY_UNRESOLVED_PATH = path.join(REPO_ROOT, 'modules', 'kidney_suite_v1', 'unresolved.json');
const GROWTH_UNRESOLVED_PATH = path.join(REPO_ROOT, 'modules', 'growth_suite_v1', 'unresolved.json');

async function loadUnresolved(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function makeScratchDir(label) {
  return mkdtemp(path.join(os.tmpdir(), `ef-conflict-objects-test-${label}-`));
}

// =================================================================================================
// 1. Trace query over both named conflict classes -- normalizes kidney's and growth's differing
//    conflict-entry shapes, proves every contributing claim id resolves to the SAME named object.
// =================================================================================================

/**
 * True when `entry` is a named, conflict-visible object in either of the two shapes this repo's
 * two projected modules actually committed:
 *   - kidney_suite_v1: `{ entryKind: "conflict", conflictId, name, contributingClaimIds,
 *     contributingSources: [{ sourceId, claimId, ... }] }`
 *   - growth_suite_v1: `{ kind: "named_conflict", conflictId, name, contributingClaimIds,
 *     contributingSourceIds: ["<sourceId>", ...] }`
 * A real trace-query consumer must not need to know in advance which shape a given module uses.
 */
function isNamedConflictEntry(entry) {
  return Boolean(entry) && (entry.entryKind === 'conflict' || entry.kind === 'named_conflict');
}

/** Normalizes either committed conflict-entry shape's contributing-source list to a plain array of source id strings. */
function contributingSourceIdsOf(conflictEntry) {
  if (Array.isArray(conflictEntry.contributingSources)) {
    return conflictEntry.contributingSources.map((s) => s.sourceId);
  }
  if (Array.isArray(conflictEntry.contributingSourceIds)) {
    return conflictEntry.contributingSourceIds;
  }
  return [];
}

/**
 * The trace query itself: given a module's `unresolved.json` entries and a claim id (the
 * conflict's own primary `claimId`, or any one of its `contributingClaimIds`), returns the single
 * named conflict object that claim id resolves to, or `null` if no conflict-visible entry
 * references it. This is the FR-11/FR-12 contract under test -- a consumer querying by ANY
 * contributing claim id must resolve to the same named, multi-source object, never a single
 * winning source and never nothing.
 */
function traceQueryConflictByClaimId(entries, claimId) {
  const hit = entries.find(
    (entry) =>
      isNamedConflictEntry(entry) &&
      (entry.claimId === claimId ||
        (Array.isArray(entry.contributingClaimIds) && entry.contributingClaimIds.includes(claimId))),
  );
  return hit ?? null;
}

test('P5-T3 trace query: kidney_suite_v1 pediatric-vs-adult proteinuria conflict resolves to one named, multi-source object regardless of which contributing claim id is queried', async () => {
  const entries = await loadUnresolved(KIDNEY_UNRESOLVED_PATH);

  // Per the fixture's own committed "reason" prose: querying by clm_inf02 (the conflict's primary
  // inference claim) or any of clm_004/clm_029/clm_015 (its contributing source claims) must all
  // resolve to the same named conflict object.
  const queryClaimIds = ['clm_inf02', 'clm_004', 'clm_029', 'clm_015'];
  const results = queryClaimIds.map((claimId) => traceQueryConflictByClaimId(entries, claimId));

  for (const [index, result] of results.entries()) {
    assert.ok(result, `trace query for claim id "${queryClaimIds[index]}" must resolve to a named conflict object, never null/undefined`);
  }

  const conflictIds = new Set(results.map((r) => r.conflictId));
  assert.equal(conflictIds.size, 1, 'every contributing claim id must resolve to the SAME conflictId, not different objects');
  assert.equal([...conflictIds][0], 'kidney-proteinuria-nephrotic-cutoff-pediatric-vs-adult-001');

  const conflict = results[0];
  assert.equal(typeof conflict.name, 'string');
  assert.ok(conflict.name.length > 0, 'conflict object must carry a human-readable name');

  const sourceIds = contributingSourceIdsOf(conflict);
  assert.ok(Array.isArray(sourceIds));
  assert.ok(sourceIds.length >= 2, 'a "conflict" by definition must list more than one contributing source');
  assert.deepEqual(
    new Set(sourceIds),
    new Set([
      'PROTEINURIA_CHILDREN_EVALUATION_AFP_2017',
      'HEMATURIA_PROTEINURIA_CHILDREN_REVIEW_2018',
      'SPOT_PC_RATIO_DIAGNOSTIC_UTILITY_REVIEW_2020',
    ]),
    'the proteinuria conflict must list all 3 contributing sources, never a subset or a single winner',
  );

  // Never silently resolved -- resolution must stay explicit and unresolved-by-design.
  assert.equal(conflict.resolution, 'unresolved_by_design');
});

test('P5-T3 trace query: growth_suite_v1 WHO-vs-CDC growth-standard conflict resolves to one named, multi-source object regardless of which contributing claim id is queried', async () => {
  const entries = await loadUnresolved(GROWTH_UNRESOLVED_PATH);

  // A sample spanning the conflict's two independently-cited sub-issues (WHO/CDC percentile
  // convention divergence, and the abrupt-vs-gradual 24-month chart-transition artifact) plus the
  // one inference claim (clm_inf04) -- every one of them must resolve to the same named object.
  const queryClaimIds = ['clm_036', 'clm_046', 'clm_050', 'clm_059', 'clm_063', 'clm_inf04'];
  const results = queryClaimIds.map((claimId) => traceQueryConflictByClaimId(entries, claimId));

  for (const [index, result] of results.entries()) {
    assert.ok(result, `trace query for claim id "${queryClaimIds[index]}" must resolve to a named conflict object, never null/undefined`);
  }

  const conflictIds = new Set(results.map((r) => r.conflictId));
  assert.equal(conflictIds.size, 1, 'every contributing claim id must resolve to the SAME conflictId, not different objects');
  assert.equal([...conflictIds][0], 'conflict_who_vs_cdc_growth_standard');

  const conflict = results[0];
  assert.equal(typeof conflict.name, 'string');
  assert.ok(conflict.name.length > 0, 'conflict object must carry a human-readable name');

  const sourceIds = contributingSourceIdsOf(conflict);
  assert.ok(Array.isArray(sourceIds));
  assert.ok(sourceIds.length >= 2, 'a "conflict" by definition must list more than one contributing source');
  assert.deepEqual(
    new Set(sourceIds),
    new Set([
      'CDC2010_WHO_CDC_CHART_USE_REC',
      'WHO2006_WFL_WFH_STANDARD',
      'AFP2023_GROWTH_FALTERING_REVIEW',
      'PEDS2025_GRADUAL_TRANSITION_CHART',
    ]),
    'the WHO-vs-CDC conflict must list all 4 contributing sources, never a subset or a single winner',
  );

  // Never silently resolved -- growth's own resolutionPolicy states this explicitly.
  assert.equal(conflict.resolutionPolicy, 'never_averaged_or_resolved_to_one_source');
});

test('P5-T3: an unknown claim id resolves to no conflict object (fail-open to null, never a fabricated match)', async () => {
  const kidneyEntries = await loadUnresolved(KIDNEY_UNRESOLVED_PATH);
  const growthEntries = await loadUnresolved(GROWTH_UNRESOLVED_PATH);
  assert.equal(traceQueryConflictByClaimId(kidneyEntries, 'clm_does_not_exist'), null);
  assert.equal(traceQueryConflictByClaimId(growthEntries, 'clm_does_not_exist'), null);
});

// =================================================================================================
// 2. R-P2: a consumer reading unresolved.json for a module with zero unresolved claims sees an
//    explicit [] -- never a missing file, never a missing key.
// =================================================================================================

test('R-P2: both committed modules\' unresolved.json files are present (never missing) and top-level-array-shaped, right now', async () => {
  for (const filePath of [KIDNEY_UNRESOLVED_PATH, GROWTH_UNRESOLVED_PATH]) {
    // A genuinely missing file throws ENOENT on stat(); this must not throw -- the artifact exists.
    const stats = await stat(filePath);
    assert.ok(stats.isFile(), `${filePath} must exist as a committed file, never be absent`);

    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    assert.ok(
      Array.isArray(parsed),
      `${filePath} must be a top-level JSON array -- never an object wrapping the list under some key (e.g. { unresolved: [...] })`,
    );
    // Neither module currently has zero unresolved claims (this documents present real state); the
    // moment either does, this same top-level-array shape is exactly what must render as `[]`.
    assert.ok(parsed.length > 0, `${filePath} currently has unresolved entries (documents present state, not an R-P2 zero-count claim)`);
  }
});

test('R-P2: a module with zero unresolved claims emits an explicit, present, top-level [] -- never a missing file and never a missing key', async () => {
  const scratchDir = await makeScratchDir('zero-unresolved');
  try {
    const filePath = path.join(scratchDir, 'unresolved.json');
    // The explicit-empty artifact a module with zero unresolved claims must commit.
    await writeFile(filePath, '[]\n', 'utf8');

    // (a) the file itself is present -- never missing.
    const stats = await stat(filePath);
    assert.ok(stats.isFile());

    // (b) its raw JSON is a top-level array literal, not an object with a possibly-absent key.
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    assert.ok(Array.isArray(parsed), 'a zero-unresolved-claims module must still commit a top-level array, never wrap it under a key');
    assert.deepEqual(parsed, []);

    // (c) this converter's own shared consumer (used by multi-bundle-report.mjs to build the
    // aggregate report) resolves it to a real [] -- an explicit empty array, not null/undefined.
    const consumed = await readOptionalJsonArray(filePath);
    assert.ok(Array.isArray(consumed));
    assert.deepEqual(consumed, []);
    assert.equal(consumed.length, 0);
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
});

test('R-P2 contrast: a genuinely absent unresolved.json is a DIFFERENT case from an explicit zero-entry file, though both readOptionalJsonArray fallbacks land on []', async () => {
  const scratchDir = await makeScratchDir('missing-unresolved');
  try {
    const missingPath = path.join(scratchDir, 'unresolved.json'); // never written

    await assert.rejects(() => stat(missingPath), /ENOENT/, 'a not-yet-authored unresolved.json must genuinely be absent from disk in this scenario');

    // readOptionalJsonArray's ENOENT-tolerant fallback (documented for not-yet-projected bundles,
    // e.g. anemia/cbc_suite_v1 as of this phase) also resolves to [] -- but R-P2's own AC is about
    // what a module with zero unresolved claims COMMITS (an explicit, present, on-disk []), not
    // about this reader's leniency toward bundles that have not run propose at all yet.
    const consumed = await readOptionalJsonArray(missingPath);
    assert.ok(Array.isArray(consumed));
    assert.deepEqual(consumed, []);
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// 3. OQ-5: hand-written candidate-scaffold structural check (no schemas/candidate-scaffold.schema.json)
// =================================================================================================

/**
 * OQ-5 (resolved: a HAND-WRITTEN structural assertion, deliberately NOT a JSON Schema file) --
 * mirrors this repo's other hand-rolled structural validators (e.g. `eligibility.mjs`'s claim-shape
 * checks) rather than adding `schemas/candidate-scaffold.schema.json`. A valid candidate scaffold
 * (FR-10) must carry all 4 of: `scaffoldId` (non-empty string), `supportingClaimIds` (non-empty
 * array of strings), `moduleId` (non-empty string), `rationale` (non-empty string).
 *
 * @returns {{ valid: boolean, errors: string[] }}
 */
function checkCandidateScaffoldStructure(scaffold) {
  const errors = [];

  if (scaffold === null || typeof scaffold !== 'object' || Array.isArray(scaffold)) {
    return { valid: false, errors: ['candidate scaffold must be a plain object'] };
  }

  if (typeof scaffold.scaffoldId !== 'string' || scaffold.scaffoldId.length === 0) {
    errors.push('scaffoldId must be a non-empty string');
  }
  if (!Array.isArray(scaffold.supportingClaimIds) || scaffold.supportingClaimIds.length === 0) {
    errors.push('supportingClaimIds must be a non-empty array');
  } else if (!scaffold.supportingClaimIds.every((id) => typeof id === 'string' && id.length > 0)) {
    errors.push('every supportingClaimIds entry must be a non-empty string');
  }
  if (typeof scaffold.moduleId !== 'string' || scaffold.moduleId.length === 0) {
    errors.push('moduleId must be a non-empty string');
  }
  if (typeof scaffold.rationale !== 'string' || scaffold.rationale.length === 0) {
    errors.push('rationale must be a non-empty string');
  }

  return { valid: errors.length === 0, errors };
}

test('OQ-5: hand-written candidate-scaffold structural check accepts a well-formed scaffold', () => {
  const wellFormed = {
    scaffoldId: 'kidney_suite_v1-scaffold-001',
    supportingClaimIds: ['clm_004', 'clm_029'],
    moduleId: 'kidney_suite_v1',
    rationale: 'Both claims independently state the same pediatric nephrotic-range cutoff; staged for future rule authoring only.',
  };
  const result = checkCandidateScaffoldStructure(wellFormed);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('OQ-5: hand-written candidate-scaffold structural check rejects a malformed scaffold (missing rationale, empty supportingClaimIds, wrong types)', () => {
  const malformed = {
    scaffoldId: 'growth_suite_v1-scaffold-001',
    supportingClaimIds: [], // empty -- no actual supporting claims
    moduleId: 42, // wrong type -- must be a string
    // rationale is entirely absent
  };
  const result = checkCandidateScaffoldStructure(malformed);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0, 'a malformed scaffold must produce at least one structural error');
  assert.ok(result.errors.some((e) => e.includes('supportingClaimIds')));
  assert.ok(result.errors.some((e) => e.includes('moduleId')));
  assert.ok(result.errors.some((e) => e.includes('rationale')));
});

test('OQ-5: hand-written candidate-scaffold structural check rejects entirely missing fields and non-object input', () => {
  assert.equal(checkCandidateScaffoldStructure({}).valid, false);
  assert.equal(checkCandidateScaffoldStructure(null).valid, false);
  assert.equal(checkCandidateScaffoldStructure([]).valid, false);
  assert.equal(checkCandidateScaffoldStructure('not-an-object').valid, false);
  assert.equal(checkCandidateScaffoldStructure(undefined).valid, false);
});
