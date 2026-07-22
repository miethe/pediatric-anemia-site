// tests/rights-coverage.test.mjs — EPR1-T3 (FR-WP0-06, D7).
//
// tests/rights-validate-gates.test.mjs already proves gate (e) (`checkKbJsonFileCoverage`, landed
// by EPR1-T2) fails closed against synthetic in-memory contexts. This suite proves the same
// property one layer up, mirroring tests/rights-gate-failsclosed.test.mjs's method for gates (a)-(d):
// the real CLI entry point (`node scripts/validate-rights.mjs`, wired into `npm run validate`) exits
// non-zero when a REAL on-disk substrate copy (src/, modules/, schemas/, rights/, scripts/) has
// exactly one of the three EPR1-T3-specified breakages seeded into it, never merely that it passes
// on good input.
//
// The three seeded breakages (per the phase-r1 plan's EPR1-T3 row and its exit_criteria: "removing a
// record, adding a 5th covered file, or pointing a ledger entry at a deleted path each fail
// `npm run validate`"):
//   (a) delete one of the seeded rights records (RR-AAP2026_IDA-REFERENCE-RANGES) from
//       rights/rights-records.json, leaving the ledger entries that reference it dangling.
//   (b) add a 5th path to scripts/sign-kb.mjs's `KB_JSON_FILES` with no rights/rights-ledger.json
//       coverage at all.
//   (c) point an existing `kb_json_file_path` ledger entry at a path that is no longer a real
//       KB_JSON_FILES artifact (a "deleted path").
//
// Each fixture's assertion checks BOTH that the CLI exits non-zero AND that the failure message
// names the specific artifact or ledger entry at fault (never a generic "coverage failed") — the
// acceptance criterion is failure-message specificity, not merely a non-zero exit code.
//
// A fourth, D7-shaped test proves the other required direction: the unmodified substrate — where
// the reference-ranges.json rights record (and every other seeded record) sits at
// `overall_status: "UNKNOWN"` — still passes the CLI with exit 0. The gate this phase adds is
// coverage-shaped, never clearance-shaped; it must never fail on a legitimate clearance value.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, realpathSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Everything scripts/validate-rights.mjs's import graph and file reads can reach — identical set to
// tests/rights-gate-failsclosed.test.mjs, for the same reason: a fixture edit never has to be
// re-diagnosed against a partial tree.
const DIRS_TO_COPY = ['src', 'modules', 'schemas', 'rights', 'scripts'];

function makeSubstrateCopy() {
  // realpathSync matters on macOS: os.tmpdir() returns a /var/... path that is itself a symlink to
  // /private/var/...; Node's ESM loader resolves import.meta.url through the real path, while
  // spawnSync's argv[1] would otherwise keep the symlinked form, silently defeating
  // scripts/validate-rights.mjs's own `isMain` check and making the CLI block never run — a false
  // "pass" this suite exists to rule out, not merely tolerate (see rights-gate-failsclosed.test.mjs's
  // own regression test for the bug this guards against).
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'rights-coverage-')));
  for (const dirName of DIRS_TO_COPY) {
    cpSync(path.join(REPO_ROOT, dirName), path.join(dir, dirName), { recursive: true });
  }
  return dir;
}

function readJsonFixture(dir, ...segments) {
  return JSON.parse(readFileSync(path.join(dir, ...segments), 'utf8'));
}

function writeJsonFixture(dir, segments, data) {
  writeFileSync(path.join(dir, ...segments), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function runValidateRightsCli(dir) {
  return spawnSync(process.execPath, [path.join(dir, 'scripts', 'validate-rights.mjs')], {
    cwd: dir,
    encoding: 'utf8',
  });
}

function withSubstrateCopy(mutate, assertions) {
  const dir = makeSubstrateCopy();
  try {
    if (mutate) mutate(dir);
    const result = runValidateRightsCli(dir);
    assertions(result, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- D7 control: the unmodified substrate, every record at overall_status UNKNOWN, still passes ----

test('D7 control: the unmutated substrate — every seeded record at overall_status "UNKNOWN" — passes the CLI with exit 0', () => {
  withSubstrateCopy(null, (result, dir) => {
    const records = readJsonFixture(dir, 'rights', 'rights-records.json');
    const target = records.records.find((record) => record.rights_record_id === 'RR-AAP2026_IDA-REFERENCE-RANGES');
    assert.ok(target, 'fixture assumption: expected the reference-ranges.json component-scoped record to exist');
    assert.equal(target.overall_status, 'UNKNOWN', 'fixture assumption: the reference-ranges.json record must sit at overall_status UNKNOWN for this control to be meaningful');
    assert.ok(
      records.records.every((record) => record.overall_status === 'UNKNOWN'),
      'D7 control fixture assumption broken: not every seeded record is at overall_status UNKNOWN',
    );
    assert.equal(result.status, 0, `an UNKNOWN overall_status must never fail the kb-json-file-coverage gate; stderr:\n${result.stderr}`);
    // Each phase that appends a gate bumps this literal, which tracks GATES.length (EPR3-T4 → 6,
    // EPR3-T6 → 7, EPR3-T8 → 8, EPR4-T4 → 9).
    assert.match(result.stdout, /validate-rights: 9 gate\(s\) passed/);
  });
});

// --- breakage (a): delete a rights record --------------------------------------------------------

test('breakage (a): FAILS CLOSED via the CLI when a rights record backing a KB_JSON_FILES artifact is deleted', () => {
  withSubstrateCopy(
    (dir) => {
      const records = readJsonFixture(dir, 'rights', 'rights-records.json');
      const before = records.records.length;
      records.records = records.records.filter((record) => record.rights_record_id !== 'RR-AAP2026_IDA-REFERENCE-RANGES');
      assert.equal(records.records.length, before - 1, 'fixture setup: expected exactly one record to remove');
      writeJsonFixture(dir, ['rights', 'rights-records.json'], records);
    },
    (result) => {
      assert.notEqual(result.status, 0, 'expected a non-zero exit when a rights record backing a KB_JSON_FILES artifact is deleted');
      assert.match(result.stderr, /\[kb-json-file-coverage]/);
      // The failure message names the specific artifact left uncovered by the deletion (its only
      // record was RR-AAP2026_IDA-REFERENCE-RANGES, a 1:1 join) AND the dangling ledger entry's
      // now-unknown rights_record_id — both name the specific artifact/entry at fault, never a
      // generic "coverage failed".
      assert.match(result.stderr, /KB_JSON_FILES artifact "modules\/anemia\/reference-ranges\.json" has no rights\/rights-ledger\.json entry/);
      assert.match(result.stderr, /references unknown rights_record_id "RR-AAP2026_IDA-REFERENCE-RANGES"/);
    },
  );
});

// --- breakage (b): add a 5th KB_JSON_FILES path with no coverage ----------------------------------

test('breakage (b): FAILS CLOSED via the CLI when a 5th KB_JSON_FILES path is added with no rights coverage', () => {
  withSubstrateCopy(
    (dir) => {
      const signKbPath = path.join(dir, 'scripts', 'sign-kb.mjs');
      const source = readFileSync(signKbPath, 'utf8');
      const marker = "export const KB_JSON_FILES = ['rules.json', 'candidates.json', 'evidence.json', 'reference-ranges.json'];";
      assert.ok(source.includes(marker), 'fixture setup: expected the exact KB_JSON_FILES literal in scripts/sign-kb.mjs — update this fixture if that literal changes');
      const mutated = source.replace(
        marker,
        "export const KB_JSON_FILES = ['rules.json', 'candidates.json', 'evidence.json', 'reference-ranges.json', 'a-fifth-file.json'];",
      );
      writeFileSync(signKbPath, mutated, 'utf8');
    },
    (result) => {
      assert.notEqual(result.status, 0, 'expected a non-zero exit when a 5th KB_JSON_FILES artifact has no rights/rights-ledger.json coverage');
      assert.match(result.stderr, /\[kb-json-file-coverage]/);
      assert.match(result.stderr, /KB_JSON_FILES artifact "modules\/anemia\/a-fifth-file\.json" has no rights\/rights-ledger\.json entry/);
    },
  );
});

// --- breakage (c): point a ledger entry at a deleted (no-longer-covered) path ---------------------

test('breakage (c): FAILS CLOSED via the CLI when a kb_json_file_path ledger entry points at a path that is not a KB_JSON_FILES artifact', () => {
  withSubstrateCopy(
    (dir) => {
      const ledger = readJsonFixture(dir, 'rights', 'rights-ledger.json');
      const target = ledger.entries.find(
        (entry) => entry.clinical_identifier_type === 'kb_json_file_path' && entry.clinical_identifier === 'modules/anemia/reference-ranges.json',
      );
      assert.ok(target, 'fixture setup: expected a kb_json_file_path ledger entry for modules/anemia/reference-ranges.json');
      target.clinical_identifier = 'modules/anemia/deleted-artifact.json';
      writeJsonFixture(dir, ['rights', 'rights-ledger.json'], ledger);
    },
    (result) => {
      assert.notEqual(result.status, 0, 'expected a non-zero exit when a ledger entry points at a path no longer covered by KB_JSON_FILES');
      assert.match(result.stderr, /\[kb-json-file-coverage]/);
      // Bidirectional: reference-ranges.json now has zero resolving ledger entries (forward), and the
      // repointed entry names a path that is not a current KB_JSON_FILES artifact (reverse).
      assert.match(result.stderr, /KB_JSON_FILES artifact "modules\/anemia\/reference-ranges\.json" has no rights\/rights-ledger\.json entry/);
      assert.match(result.stderr, /kb_json_file_path entry "modules\/anemia\/deleted-artifact\.json" does not resolve to any current KB_JSON_FILES artifact/);
    },
  );
});
