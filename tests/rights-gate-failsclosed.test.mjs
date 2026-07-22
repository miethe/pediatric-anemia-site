// tests/rights-gate-failsclosed.test.mjs — EPR0-T6 (FR-WP0-09, D7).
//
// tests/rights-validate-gates.test.mjs (EPR0-T5) already proves each gate function fails closed
// against a synthetic in-memory context. This suite proves the same property one layer up, at the
// boundary EPR0-T6 actually wires: the real CLI entry point (`node scripts/validate-rights.mjs`,
// now composed into `npm run validate`) exits non-zero when a REAL substrate on disk has exactly
// one precondition broken — never merely that it passes on good input.
//
// Method: each test copies the real, on-disk substrate (src/, modules/, schemas/, rights/,
// scripts/) into an isolated temp directory, corrupts exactly one file to break exactly one gate's
// precondition, then spawns `node scripts/validate-rights.mjs` as a fresh child process against
// that copy and asserts a non-zero exit code plus a stderr message naming the broken gate. The real
// repo tree is never mutated. Each of the 4 EPR0-T5 gates gets its own distinct failing fixture, per
// this task's acceptance criteria.
//
// D7 control: a final test asserts the unmodified copy — every seeded record still sitting at
// `overall_status: "UNKNOWN"` — passes the CLI with exit 0. A gate suite that fails everything
// would trivially "pass" the other tests in this file; this test rules that out.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, realpathSync, rmSync, readFileSync, writeFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Everything scripts/validate-rights.mjs's import graph and file reads can reach. Copied wholesale
// (not hand-picked file-by-file) so a fixture edit never has to be re-diagnosed against a partial
// tree — only the module registry's disjoint chain (src/, modules/) plus the substrate itself
// (rights/, schemas/) and the script (scripts/) are needed; no package manifest or lockfile is
// required because the project ships zero runtime dependencies.
const DIRS_TO_COPY = ['src', 'modules', 'schemas', 'rights', 'scripts', 'tools'];

function makeSubstrateCopy() {
  // realpathSync matters on macOS: os.tmpdir() returns a /var/... path that is itself a symlink
  // to /private/var/...; Node's ESM loader resolves import.meta.url through the real path, while
  // spawnSync's argv[1] would otherwise keep the symlinked form. Left unresolved, the two strings
  // scripts/validate-rights.mjs's own `isMain` check compares would silently mismatch, the CLI
  // block would never run, and the child process would exit 0 having done nothing at all — a
  // false "pass" this suite exists to rule out, not merely tolerate.
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'rights-gate-failsclosed-')));
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
    assertions(result);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- control: unmodified substrate passes -----------------------------------------------------------

test('control: an unmutated copy of the seeded substrate passes the CLI with exit 0', () => {
  withSubstrateCopy(null, (result) => {
    assert.equal(result.status, 0, `expected exit 0 on the unmodified substrate; stderr:\n${result.stderr}`);
    // EPR1-T2 appended a 5th gate (kb-json-file-coverage); EPR3-T4 appends a 6th
    // (evidence-item-locator-capture); EPR4-T4 appends a 9th (rights-decision-ledger-coverage) per
    // this file's own module contract — the literal here tracks GATES.length, not a fixed constant;
    // each later phase that appends its own gate bumps it in turn.
    assert.match(result.stdout, /validate-rights: 9 gate\(s\) passed/);
  });
});

test('D7 control: every seeded record sits at overall_status "UNKNOWN" and the CLI still exits 0', () => {
  const dir = makeSubstrateCopy();
  try {
    const records = readJsonFixture(dir, 'rights', 'rights-records.json');
    assert.ok(records.records.length > 0, 'expected at least one seeded record to assert D7 against');
    assert.ok(
      records.records.every((record) => record.overall_status === 'UNKNOWN'),
      'D7 control fixture assumption broken: not every seeded record is at overall_status UNKNOWN',
    );
    const result = runValidateRightsCli(dir);
    assert.equal(result.status, 0, `an UNKNOWN overall_status must never fail the gate; stderr:\n${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- regression: CLI entry guard must not fail open under a symlinked checkout path -----------------
//
// EPR0-T6 review fix: the CLI entry guard (`isMain` in scripts/validate-rights.mjs) used to compare
// a non-realpath'd `process.argv[1]` against a realpath'd `import.meta.url`. Node's ESM loader
// resolves `import.meta.url` through the filesystem's real path, but `process.argv[1]` is left
// exactly as the caller passed it — so when the script is invoked through a symlinked path, the two
// strings silently disagree, `isMain` comes back false, the CLI block never runs, and the process
// exits 0 having validated nothing (the opposite of this suite's D7 fail-closed posture). This test
// does not rely on the host OS's own tmpdir symlinking (e.g. macOS's `/var` -> `/private/var`); it
// builds a real substrate copy, corrupts one gate's precondition (reusing gate (a)'s fixture), points
// an explicit symlink at that copy, and spawns the CLI through the symlinked path — asserting the
// corrupted fixture still produces a non-zero exit rather than a silent, unvalidated exit 0.
test('regression: CLI entry guard fails closed when invoked through a symlinked path', () => {
  const realDir = makeSubstrateCopy();
  const symlinkDir = path.join(tmpdir(), `rights-gate-symlink-${process.pid}-${Date.now()}`);
  try {
    const ledger = readJsonFixture(realDir, 'rights', 'rights-ledger.json');
    const before = ledger.entries.length;
    ledger.entries = ledger.entries.filter((entry) => entry.clinical_identifier !== 'WHO2024_HB');
    assert.equal(ledger.entries.length, before - 1, 'fixture setup: expected exactly one WHO2024_HB ledger entry to remove');
    writeJsonFixture(realDir, ['rights', 'rights-ledger.json'], ledger);

    symlinkSync(realDir, symlinkDir, 'dir');

    const result = spawnSync(process.execPath, [path.join(symlinkDir, 'scripts', 'validate-rights.mjs')], {
      cwd: symlinkDir,
      encoding: 'utf8',
    });

    assert.notEqual(
      result.status,
      0,
      'expected the CLI, invoked through a symlinked path, to still fail closed on a broken '
      + `precondition rather than silently exiting 0 having skipped validation entirely; `
      + `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    assert.match(result.stderr, /\[missing-assessment-coverage]/);
    assert.match(result.stderr, /WHO2024_HB/);
  } finally {
    unlinkSync(symlinkDir);
    rmSync(realDir, { recursive: true, force: true });
  }
});

// --- gate (a): missing-assessment-coverage ------------------------------------------------------------

test('gate (a) missing-assessment-coverage: FAILS CLOSED via the CLI when a ledger entry is deleted', () => {
  withSubstrateCopy(
    (dir) => {
      const ledger = readJsonFixture(dir, 'rights', 'rights-ledger.json');
      const before = ledger.entries.length;
      ledger.entries = ledger.entries.filter((entry) => entry.clinical_identifier !== 'WHO2024_HB');
      assert.equal(ledger.entries.length, before - 1, 'fixture setup: expected exactly one WHO2024_HB ledger entry to remove');
      writeJsonFixture(dir, ['rights', 'rights-ledger.json'], ledger);
    },
    (result) => {
      assert.notEqual(result.status, 0, 'expected a non-zero exit when a covered clinical identifier loses its ledger entry');
      assert.match(result.stderr, /\[missing-assessment-coverage]/);
      assert.match(result.stderr, /WHO2024_HB/);
      assert.match(result.stderr, /no rights\/rights-ledger\.json entry/);
    },
  );
});

// --- gate (b): blocking-status-enum-membership --------------------------------------------------------

test('gate (b) blocking-status-enum-membership: FAILS CLOSED via the CLI on a non-enum overall_status', () => {
  withSubstrateCopy(
    (dir) => {
      const records = readJsonFixture(dir, 'rights', 'rights-records.json');
      const target = records.records.find((record) => record.rights_record_id === 'RR-WHO2024_HB');
      assert.ok(target, 'fixture setup: expected RR-WHO2024_HB to exist in the seeded records');
      target.overall_status = 'BOGUS_NOT_AN_ENUM_MEMBER';
      writeJsonFixture(dir, ['rights', 'rights-records.json'], records);
    },
    (result) => {
      assert.notEqual(result.status, 0, 'expected a non-zero exit when overall_status is not a schema enum member');
      assert.match(result.stderr, /\[blocking-status-enum-membership]/);
      assert.match(result.stderr, /BOGUS_NOT_AN_ENUM_MEMBER/);
      assert.match(result.stderr, /is not a member of the schema's closed enum/);
    },
  );
});

// --- gate (c): open-failure-presence ------------------------------------------------------------------

test('gate (c) open-failure-presence: FAILS CLOSED via the CLI when a cross-link is severed', () => {
  withSubstrateCopy(
    (dir) => {
      const records = readJsonFixture(dir, 'rights', 'rights-records.json');
      const target = records.records.find((record) => record.rights_record_id === 'RR-AAP2026_IDA');
      assert.ok(target, 'fixture setup: expected RR-AAP2026_IDA to exist in the seeded records');
      const before = target.rights_failure_ids.length;
      target.rights_failure_ids = target.rights_failure_ids.filter((id) => id !== 'RF-REG-002-CONTENT-RIGHTS-001');
      assert.equal(target.rights_failure_ids.length, before - 1, 'fixture setup: expected exactly one cross-link to remove');
      writeJsonFixture(dir, ['rights', 'rights-records.json'], records);
    },
    (result) => {
      assert.notEqual(result.status, 0, 'expected a non-zero exit when an open failure loses its back-reference');
      assert.match(result.stderr, /\[open-failure-presence]/);
      assert.match(result.stderr, /RF-REG-002-CONTENT-RIGHTS-001/);
      assert.match(result.stderr, /is not cross-linked back from rights_record "RR-AAP2026_IDA"/);
    },
  );
});

// --- gate (d): release-context-containment --------------------------------------------------------

test('gate (d) release-context-containment: FAILS CLOSED via the CLI when release-context.json is unusable', () => {
  withSubstrateCopy(
    (dir) => {
      // Valid JSON (so loadRightsContext's readJson does not throw before the gate runs), but not
      // an object — exercises checkReleaseContextContainment's `!releaseContext` fail-closed branch
      // rather than crashing the CLI with a JSON.parse error, which would test file-I/O robustness
      // rather than the gate itself.
      writeFileSync(path.join(dir, 'rights', 'release-context.json'), 'null\n', 'utf8');
    },
    (result) => {
      assert.notEqual(result.status, 0, 'expected a non-zero exit when release-context.json parses to a non-object');
      assert.match(result.stderr, /\[release-context-containment]/);
      assert.match(result.stderr, /no release-context\.json provided/);
    },
  );
});
