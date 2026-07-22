// tests/ef-reg-exclusion.test.mjs — multi-bundle-conversion-e1 Phase 6, row P6-T2 (FR-4/FR-19
// final regression sweep).
//
// Task acceptance criteria (phase-5-6-7-projection-determinism-docs.md, row P6-T2):
//   "Repo-wide grep/test confirms zero references to either REG run ID or its source-card
//   prefixes in `tests/fixtures/**`, `modules/**`, or `build/kb-pack/**`."
//
// Per FR-4/FR-19 and `docs/legal/reg-001-reg-004-hold.md` (row P6-T1's HOLD record): `REG-001`
// (`rf_run_20260717_reg_001_pediatric_cds_map_the`) and `REG-004`
// (`rf_run_20260717_reg_004_pediatric_cds_scope_the`) are regulatory/LEGAL-review `rf` runs —
// legal-review memos, not CDS-module evidence — and remain `status: not_executed_owner_held`
// (`rf-handoff/RESULTS.md` §5). Neither may seed a fixture, a module, or any converter artifact
// until a qualified legal reviewer signs off (`docs/legal/reg-001-reg-004-hold.md` §4).
//
// This file is DELIBERATELY BROADER than `tests/ef-batch-reg-exclusion.test.mjs` (P2-T6), which
// only inspects the batch runner's own `BATCH_PAIRS` list and the 3 converter scripts P2 touched.
// This test instead walks every file, repository-wide, under the 3 trees the P6-T2 acceptance
// criterion names — `tests/fixtures/**`, `modules/**`, `build/kb-pack/**` — including everything
// landed across Phases 1 through 5 (all 4 vendored clinical fixtures, all 4 module packages, and
// any staged converter output), so a REG-001/REG-004 reference introduced by ANY later task, in
// ANY file, under those trees would be caught here even if `ef-batch-reg-exclusion.test.mjs`
// itself were never touched again.
//
// -------------------------------------------------------------------------------------------
// What counts as a violation (two tiers, deliberately different strictness):
// -------------------------------------------------------------------------------------------
//
// TIER 1 — zero tolerance, no carve-out, every file, every byte, both path and content:
//   1a. Either run's full `run_id` string (`rf_run_20260717_reg_00{1,4}_pediatric_cds_*`).
//   1b. Either run's IntentTree node id (`rf-handoff/README.md` §2's run registry —
//       `node_01KXRTYJWWGM2YJMARF942MTBA` for REG-001, `node_01KXRTYK9Q263P1514888SAFBZ` for
//       REG-004) — a second, independent identifier for the same two runs.
//   1c. A `runs/reg-*`-style path literal (the on-node/mirror directory layout
//       `runs/<run_id>/sources/*.md` that source cards for these runs would live under, per
//       `rf-handoff/RESULTS.md` §4's own citation of that path shape for REG-004).
//   1d. The bare `reg-001`/`reg-004` name appearing in a file or directory PATH itself (a fixture
//       directory literally named after either run would be a structural violation regardless of
//       content — this generalizes P2-T6's own "no tests/fixtures/rf-reg-*" sanity check).
//
// TIER 2 — the bare `reg-001`/`reg-004` name in file CONTENT, checked only in the file's LIVE
// (non-documentation) content, per file type:
//   - `.md` files in these 3 trees are exclusively human-authored provenance/decision prose
//     (e.g. `HASH-PROVENANCE.md`) — exempt entirely, same as `ef-batch-reg-exclusion.test.mjs`
//     deliberately does not flag `lib/batch.mjs`'s own header comment for documenting the very
//     exclusion it enforces. A REG-001/REG-004 mention explaining *why a fixture was NOT built
//     from that run* (e.g. "RF-CBC-001 was chosen over REG-001/REG-004...") is the intended,
//     honest kind of reference this record is FOR, not a violation of it. Tier 1 above still
//     applies in full to `.md` files, so a real leaked run_id/node_id/runs-path would still fail.
//   - `.yaml`/`.yml`/`.js`/`.mjs` files: comments are stripped before the bare-name scan (`#` to
//     end-of-line for YAML; `//` and `/* */` for JS, mirroring P2-T6's own `stripComments`) —
//     documentation-only mentions inside a comment (e.g.
//     `modules/cbc_suite_v1/authoring-decisions.yaml`'s header, "OQ-2 resolution (RF-CBC-001, not
//     REG-001/REG-004)") are permitted; a bare name appearing in LIVE data (e.g. an actual
//     `rf_claim_ids` entry) is not.
//   - Every other file type (`.json`, `.txt`, and anything unrecognized) is data-only in these
//     trees (evidence/candidates/rules/ledger JSON, JSON-shaped `.txt` snapshots) — scanned in
//     full, no carve-out, since JSON supports no comments and a bare-name match there can only be
//     live data.
//
// `build/kb-pack/` is listed in `.gitignore` (converter output is generated, never committed —
// see that file's own comment) but the P6-T2 acceptance criterion names it explicitly, so this
// test still scans whatever exists there on disk at test time — if the directory does not exist
// (a fresh checkout before any converter run), that is trivially zero references, not a skip.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The 3 trees the P6-T2 acceptance criterion names, repository-wide, recursively. */
const SCAN_ROOTS = Object.freeze([
  path.join(REPO_ROOT, 'tests', 'fixtures'),
  path.join(REPO_ROOT, 'modules'),
  path.join(REPO_ROOT, 'build', 'kb-pack'),
]);

// The real, documented run_ids for REG-001/REG-004 (docs/project_plans/expansion/rf-handoff/
// README.md §2), and their IntentTree node ids (same table) — a second, independent identifier
// for the same two runs, worth checking on its own since a future artifact could reference the
// node id without ever spelling out the run_id.
const REG_001_RUN_ID = 'rf_run_20260717_reg_001_pediatric_cds_map_the';
const REG_004_RUN_ID = 'rf_run_20260717_reg_004_pediatric_cds_scope_the';
const REG_001_NODE_ID = 'node_01KXRTYJWWGM2YJMARF942MTBA';
const REG_004_NODE_ID = 'node_01KXRTYK9Q263P1514888SAFBZ';

/**
 * Matches "reg-001"/"reg_001"/"REG001"/"Reg-001" (and the "004" sibling) in any of the forms the
 * HOLD record and P2-T6's own acceptance criterion enumerate — path, run_id substring, or module
 * target — without false-positiving on unrelated English words like "region"/"registered" that
 * merely start with "reg" (those never have a "001"/"004" digit group glued on).
 */
const REG_001_PATTERN = /reg[-_]?001/i;
const REG_004_PATTERN = /reg[-_]?004/i;

/**
 * Matches a `runs/reg-*`-style path literal in any separator/case form — the on-node/mirror
 * source-card directory layout (`runs/<run_id>/sources/*.md`) that either REG run's source cards
 * would live under, per `rf-handoff/RESULTS.md` §4's own citation of that path shape.
 */
const REG_RUNS_PATH_PATTERN = /runs[\\/]reg[-_]?0?0?[14]/i;

/** File extensions treated as pure human-authored provenance/decision prose — Tier 2 exempt. */
const PROSE_EXTENSIONS = new Set(['.md']);

/** File extensions whose comments are stripped before the Tier 2 bare-name scan. */
const COMMENT_STYLE_BY_EXTENSION = new Map([
  ['.yaml', 'hash'],
  ['.yml', 'hash'],
  ['.js', 'slash'],
  ['.mjs', 'slash'],
]);

/**
 * Recursively lists every regular file under `root`, depth-first, following no symlinks (plain
 * directory recursion only — none of the 3 scanned trees contain symlinked content). Returns an
 * empty array (not an error) if `root` does not exist, since `build/kb-pack/` is gitignored and
 * legitimately absent on a fresh checkout before any converter run — that is trivially zero
 * references, not a test-infrastructure failure.
 */
async function listFilesRecursive(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

/** Tier 1: zero-tolerance checks applied to every file, unconditionally, full raw content/path. */
function assertNoHardRegReference(haystack, label) {
  assert.ok(!haystack.includes(REG_001_RUN_ID), `${label} must never embed REG-001's run_id`);
  assert.ok(!haystack.includes(REG_004_RUN_ID), `${label} must never embed REG-004's run_id`);
  assert.ok(!haystack.includes(REG_001_NODE_ID), `${label} must never embed REG-001's IntentTree node id`);
  assert.ok(!haystack.includes(REG_004_NODE_ID), `${label} must never embed REG-004's IntentTree node id`);
  assert.ok(!REG_RUNS_PATH_PATTERN.test(haystack), `${label} must never reference a runs/reg-* path`);
}

/** Tier 2: bare-name check, applied only to a file's LIVE (non-documentation) content. */
function assertNoBareRegNameInLiveContent(haystack, label) {
  assert.ok(!REG_001_PATTERN.test(haystack), `${label} must never reference REG-001 in live (non-documentation) content`);
  assert.ok(!REG_004_PATTERN.test(haystack), `${label} must never reference REG-004 in live (non-documentation) content`);
}

/**
 * Strips `//` line comments and `/* *\/` block comments from a JS-family source string, leaving
 * only executable/live code. Mirrors `ef-batch-reg-exclusion.test.mjs`'s own `stripComments`.
 */
function stripSlashComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, '');
}

/**
 * Strips `#`-to-end-of-line comments from a YAML source string, one line at a time. This is a
 * deliberate simplification (a literal `#` inside a quoted YAML string would also be truncated)
 * documented here rather than hidden: no fixture/module YAML in this repository's 3 scanned trees
 * uses a literal `#` character inside a data value, so this simplification does not currently
 * mask anything, and it is far simpler than a full YAML-string-aware comment stripper for a test
 * whose job is to be a strict, auditable guard rather than a YAML parser.
 */
function stripHashComments(source) {
  return source
    .split('\n')
    .map((line) => {
      const hashIndex = line.indexOf('#');
      return hashIndex === -1 ? line : line.slice(0, hashIndex);
    })
    .join('\n');
}

/** Returns the LIVE (documentation-stripped) content to run the Tier 2 bare-name check against. */
function liveContentForTier2(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  if (PROSE_EXTENSIONS.has(ext)) return ''; // pure prose file — Tier 2 exempt entirely.
  const commentStyle = COMMENT_STYLE_BY_EXTENSION.get(ext);
  if (commentStyle === 'hash') return stripHashComments(content);
  if (commentStyle === 'slash') return stripSlashComments(content);
  return content; // JSON/txt/unrecognized — data-only channel, scan in full.
}

// =================================================================================================
// Repo-wide sweep: every file under tests/fixtures/**, modules/**, build/kb-pack/**, both its path
// and its content, checked against every form of REG-001/REG-004 reference above.
// =================================================================================================

for (const scanRoot of SCAN_ROOTS) {
  const relRoot = path.relative(REPO_ROOT, scanRoot);

  test(`P6-T2: ${relRoot} contains zero REG-001/REG-004 references (paths + content, repo-wide sweep)`, async () => {
    const files = await listFilesRecursive(scanRoot);

    // A tree that legitimately doesn't exist yet (build/kb-pack/ before any converter run) still
    // satisfies "zero references" — assert that explicitly rather than silently no-op'ing so a
    // missing tests/fixtures/ or modules/ tree (which should always exist) is still noticed.
    if (relRoot !== path.join('build', 'kb-pack')) {
      assert.ok(files.length > 0, `expected ${relRoot} to contain files to scan`);
    }

    for (const filePath of files) {
      const relFile = path.relative(REPO_ROOT, filePath);

      // Tier 1 (path form): the file's own path must never embed a run_id/node_id/runs-path, and
      // must never be literally named after either run (fixture/module dir named "rf-reg-001" etc).
      assertNoHardRegReference(relFile, `path "${relFile}"`);
      assert.ok(!REG_001_PATTERN.test(relFile), `path "${relFile}" must never be named after REG-001`);
      assert.ok(!REG_004_PATTERN.test(relFile), `path "${relFile}" must never be named after REG-004`);

      const content = await readFile(filePath, 'utf8');

      // Tier 1 (content form): run_id/node_id/runs-path — zero tolerance, full raw content.
      assertNoHardRegReference(content, `${relFile} (content)`);

      // Tier 2: bare "reg-001"/"reg-004" name, checked only in live (non-documentation) content.
      const liveContent = liveContentForTier2(filePath, content);
      assertNoBareRegNameInLiveContent(liveContent, `${relFile} (live content)`);
    }
  });
}

// =================================================================================================
// Sanity: no committed fixture directory exists for either REG-001 or REG-004 (belt-and-suspenders
// over the path-scan above, and consistent with P2-T6's own equivalent check).
// =================================================================================================

test('P6-T2: no tests/fixtures/rf-reg-* (or reg-001/reg-004 named) directory exists anywhere in the repo', async () => {
  for (const scanRoot of SCAN_ROOTS) {
    let entries;
    try {
      entries = await readdir(scanRoot, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      throw err;
    }
    const regDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => REG_001_PATTERN.test(name) || REG_004_PATTERN.test(name));
    assert.deepEqual(regDirs, [], `${path.relative(REPO_ROOT, scanRoot)} must contain no REG-named directory`);
  }
});
