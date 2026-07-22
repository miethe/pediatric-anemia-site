// tests/ef-batch-reg-exclusion.test.mjs — multi-bundle-conversion-e1 Phase 2, row P2-T6 (FR-4/
// FR-19, decisions block Risk 7 mitigation).
//
// Task acceptance criteria (phase-1-2-vendoring-batch-orchestration.md, row P2-T6):
//   "A test asserts the batch runner's literal bundle list contains exactly 4 entries, none
//   referencing reg-001/reg-004/REG-001/REG-004 in any form (path, run_id substring, or module
//   target)."
//
// Per FR-4/FR-19 (PRD `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md`
// section Functional Requirements): REG-001 (`rf_run_20260717_reg_001_pediatric_cds_map_the`) and
// REG-004 (`rf_run_20260717_reg_004_pediatric_cds_scope_the`) are regulatory/LEGAL-review `rf`
// runs, not CDS-module conversion targets (`rf-handoff/RESULTS.md` section 5: both
// `not_executed_owner_held`, legal-review-required). Neither may seed a fixture, a module, or any
// clinical evidence artifact, and no script this pass adds may ever read either run's `runs/`
// directory.
//
// This file is owned solely by P2-T6 — it does not modify `tests/ef-converter-batch.test.mjs`
// (P2-T3's own test file, which already asserts BATCH_PAIRS' shape/order for its own purposes) nor
// `tests/ef-batch-runner.test.mjs` (owned concurrently by P2-T5's partial-batch-failure test).
//
// Scope:
//   1. BATCH_PAIRS (P2-T3's named {fixture, module} list) itself — exactly 4 entries, no
//      REG-001/REG-004 reference in any field, in any form.
//   2. Live-code scan of the three scripts this pass adds/extends
//      (`scripts/evidence/generate-rf-fixture.mjs`, `tools/rf-bundle-to-kb-pack/lib/batch.mjs`,
//      `tools/rf-bundle-to-kb-pack/cli.mjs`), with comments stripped first, proving none of them
//      ever names REG-001/REG-004 or their run_ids as a live path/argument/identifier. (Comments
//      are stripped deliberately: `lib/batch.mjs`'s own header names "REG-001"/"REG-004" by
//      design, as documentation of the exclusion this test enforces — that is not a code
//      reference, and must not fail this test.)
//   3. Raw (unstripped) scan of the same three files for any `runs/reg-*`-style path literal — a
//      real path is never split across a comment boundary the stripping in (2) would affect, so
//      this check runs against the untouched source as an extra structural guard.
//   4. Sanity: no `tests/fixtures/rf-reg-*` directory was ever committed for either run.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BATCH_PAIRS } from '../tools/rf-bundle-to-kb-pack/lib/batch.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The three scripts this pass (multi-bundle-conversion-e1) adds or extends, per row P2-T6. */
const SCRIPTS_UNDER_TEST = Object.freeze([
  path.join(REPO_ROOT, 'scripts', 'evidence', 'generate-rf-fixture.mjs'),
  path.join(REPO_ROOT, 'tools', 'rf-bundle-to-kb-pack', 'lib', 'batch.mjs'),
  path.join(REPO_ROOT, 'tools', 'rf-bundle-to-kb-pack', 'cli.mjs'),
]);

// The real, documented run_ids for REG-001/REG-004 (docs/project_plans/expansion/rf-handoff/
// README.md section 2) — asserting the FULL run_id string never appears as live code is a
// stronger, more specific check than the bare "reg-001"/"reg-004" substring alone.
const REG_001_RUN_ID = 'rf_run_20260717_reg_001_pediatric_cds_map_the';
const REG_004_RUN_ID = 'rf_run_20260717_reg_004_pediatric_cds_scope_the';

/**
 * Matches "reg-001"/"reg_001"/"REG001"/"Reg-001" (and the "004" sibling) in any of the forms the
 * task's own acceptance criterion enumerates — path, run_id substring, or module target — without
 * false-positiving on unrelated English words like "region"/"registered" that merely start with
 * "reg" (those never have a "001"/"004" digit group glued on).
 */
const REG_001_PATTERN = /reg[-_]?001/i;
const REG_004_PATTERN = /reg[-_]?004/i;

function assertNoRegReference(haystack, label) {
  assert.ok(!REG_001_PATTERN.test(haystack), `${label} must never reference REG-001 in any form`);
  assert.ok(!REG_004_PATTERN.test(haystack), `${label} must never reference REG-004 in any form`);
  assert.ok(!haystack.includes(REG_001_RUN_ID), `${label} must never embed REG-001's run_id`);
  assert.ok(!haystack.includes(REG_004_RUN_ID), `${label} must never embed REG-004's run_id`);
}

/**
 * Strips `//` line comments and block comments from a `.mjs` source string, leaving only
 * executable/live code (import specifiers, string/array literals, identifiers). This deliberately
 * does NOT flag prose: `lib/batch.mjs`'s own header comment names "REG-001"/"REG-004" explicitly
 * and by design, as documentation of the very exclusion this test enforces (see that file's own
 * header prose). What this task's acceptance criterion guards against is a REG-001/REG-004
 * reference appearing as a live path, argument, run_id, or module target code could act on — not a
 * human-readable comment that documents the excluded names. A naive whole-file string scan would
 * perpetually fail against `batch.mjs`'s own legitimate documentation, which is why this
 * comment-stripped scan is used for the "any form, anywhere in source" check instead of a raw
 * `readFile` scan.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, '');
}

// =================================================================================================
// 1. BATCH_PAIRS (P2-T3's named {fixture, module} list): exactly 4 entries, no REG-001/REG-004.
// =================================================================================================

test('P2-T6: BATCH_PAIRS contains exactly 4 entries', () => {
  assert.ok(Array.isArray(BATCH_PAIRS));
  assert.equal(BATCH_PAIRS.length, 4);
});

test('P2-T6: no BATCH_PAIRS entry (fixture or module) references REG-001/REG-004 in any form', () => {
  for (const pair of BATCH_PAIRS) {
    assertNoRegReference(pair.fixture, `BATCH_PAIRS fixture "${pair.fixture}"`);
    assertNoRegReference(pair.module, `BATCH_PAIRS module "${pair.module}"`);
  }
});

test('P2-T6: BATCH_PAIRS serialized as a whole never references REG-001/REG-004 in any form', () => {
  // Belt-and-suspenders over the per-field check above: serializes the entire literal array (keys
  // and values) and scans it as one string, so a future entry that hides a REG reference in an
  // unexpected key is still caught.
  const serialized = JSON.stringify(BATCH_PAIRS);
  assertNoRegReference(serialized, 'BATCH_PAIRS (serialized)');
});

// =================================================================================================
// 2. Live-code scan (comments stripped): none of the 3 scripts this pass adds/extends ever names
//    REG-001/REG-004, or their run_ids, as executable code (never a documentation-only mention).
// =================================================================================================

for (const scriptPath of SCRIPTS_UNDER_TEST) {
  const relPath = path.relative(REPO_ROOT, scriptPath);

  test(`P2-T6: ${relPath}'s live code (comments excluded) never references REG-001/REG-004 (name or run_id)`, async () => {
    const source = await readFile(scriptPath, 'utf8');
    const liveCode = stripComments(source);
    assertNoRegReference(liveCode, `${relPath} (live code)`);
  });

  test(`P2-T6: ${relPath} never references a REG-* "runs/" directory path anywhere in its source`, async () => {
    const source = await readFile(scriptPath, 'utf8');
    // Catches any "runs/reg-..." / "runs/reg_..." style path literal regardless of separator or
    // case. Run against the RAW (unstripped) source: a real path literal is never split across a
    // comment boundary the stripping above would affect, so there is no risk of this hiding a real
    // reference, and it additionally proves no such path exists even in a stray comment.
    assert.ok(
      !/runs[\\/]reg[-_]?0?0?[14]/i.test(source),
      `${relPath} must never reference a runs/reg-* directory path`,
    );
  });
}

// =================================================================================================
// 3. Sanity: no committed fixture directory exists for either REG-001 or REG-004 — confirms
//    neither run was ever vendored into a fixture in the first place.
// =================================================================================================

test('P2-T6: no tests/fixtures/rf-reg-* directory exists for REG-001 or REG-004', async () => {
  const fixturesDir = path.join(REPO_ROOT, 'tests', 'fixtures');
  const entries = await readdir(fixturesDir, { withFileTypes: true });
  const regFixtures = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => REG_001_PATTERN.test(name) || REG_004_PATTERN.test(name));
  assert.deepEqual(regFixtures, []);
});
