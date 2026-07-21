// tests/rights-standalone-degradation.test.mjs — EPR1-T5 (FR-WP1-05, "Should").
//
// Per the phase-r1 plan's EPR1-T5 row: "the gate must be independently exercisable against a
// fixture directory containing only the reference-ranges.json record, so this phase can ship if
// EP-R0's substrate stalls." Acceptance criterion: "The gate's unit tests pass against a minimal
// fixture directory holding one rights record and one ledger entry, with no release-context.json
// and no vendored-schema amendment layer present."
//
// tests/rights-validate-gates.test.mjs and tests/rights-coverage.test.mjs already prove gate (e)
// (`checkKbJsonFileCoverage`, landed by EPR1-T2) passes/fails-closed against the FULL substrate
// (via `loadRightsContext`, which unconditionally reads rights/release-context.json plus
// schemas/rights/rights_record.schema.json and rights_failure.schema.json — EP-R0's amendment
// layer) and against synthetic in-memory contexts. This suite proves a DIFFERENT, narrower
// property those do not: `checkKbJsonFileCoverage` itself has no structural dependency on that
// wider substrate at all. Its own signature only ever reads `context.kbJsonFileArtifacts`,
// `context.rightsLedger`, and `context.rightsRecords` (see scripts/validate-rights.mjs) — never
// `releaseContext`, `rightsRecordSchema`, or `rightsFailureSchema` — so it is exercised here
// against a real ON-DISK fixture directory built by hand (not through `loadRightsContext`) that
// holds ONLY `rights/rights-records.json` (one record) and `rights/rights-ledger.json` (one
// entry), with `rights/release-context.json` and the entire `schemas/rights/` amendment layer
// deliberately absent. If a later edit ever made this gate implicitly reach for either, this
// suite's fixture would surface that as a thrown/undefined-read error rather than a silent pass.
//
// FR-WP1-05 is a "Should", not a "Must": this is the degradation PATH being proven exercisable,
// not a new gate wired into `npm run validate` (package.json/GATES composition are untouched by
// this task — see the EP-R0 file-ownership barrier in EXECUTION-BRIEF.md).

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkKbJsonFileCoverage } from '../scripts/validate-rights.mjs';

// A single, minimal, standalone rights record for modules/anemia/reference-ranges.json — a
// trimmed stand-in for the real RR-AAP2026_IDA-REFERENCE-RANGES record (rights/rights-records.json),
// carrying only the fields this fixture's assertions or a human reader actually need. It is never
// asserted schema-valid here (no schemas/rights/ is even present in this fixture — that is the
// point), and it sits at overall_status "UNKNOWN" exactly like the real seeded record, per D7: a
// clearance value is irrelevant to this coverage gate.
const MINIMAL_RIGHTS_RECORD = {
  schema_version: '1.0.0',
  rights_record_id: 'RR-STANDALONE-FIXTURE-REFERENCE-RANGES',
  source_id: 'AAP2026_IDA',
  record_scope: 'source_component',
  component_scope: ['modules/anemia/reference-ranges.json'],
  overall_status: 'UNKNOWN',
};

const MINIMAL_LEDGER_ENTRY = {
  clinical_identifier_type: 'kb_json_file_path',
  clinical_identifier: 'modules/anemia/reference-ranges.json',
  rights_record_id: 'RR-STANDALONE-FIXTURE-REFERENCE-RANGES',
};

/**
 * Builds a fresh, minimal on-disk fixture directory holding ONLY `rights/rights-records.json`
 * (one record) and `rights/rights-ledger.json` (one entry) — never `rights/release-context.json`,
 * `rights/rights-failures.json`, or any `schemas/rights/*` amendment-layer file. Returns the
 * fixture root; callers are responsible for `rmSync(dir, { recursive: true, force: true })`.
 */
function makeMinimalFixture({ ledgerEntries = [MINIMAL_LEDGER_ENTRY] } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'rights-standalone-'));
  const rightsDir = path.join(dir, 'rights');
  mkdirSync(rightsDir, { recursive: true });
  writeFileSync(
    path.join(rightsDir, 'rights-records.json'),
    `${JSON.stringify({ records: [MINIMAL_RIGHTS_RECORD] }, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    path.join(rightsDir, 'rights-ledger.json'),
    `${JSON.stringify({ entries: ledgerEntries }, null, 2)}\n`,
    'utf8',
  );
  return dir;
}

/**
 * Reads a minimal fixture's two on-disk files back into the plain `{ kbJsonFileArtifacts,
 * rightsLedger, rightsRecords }` shape `checkKbJsonFileCoverage` requires — deliberately NOT
 * `loadRightsContext` (scripts/validate-rights.mjs), which unconditionally also reads
 * rights/release-context.json and both schemas/rights/*.schema.json files and would throw ENOENT
 * against this fixture. `kbJsonFileArtifacts` is supplied by the caller rather than derived from
 * `scripts/sign-kb.mjs`'s `KB_JSON_FILES` x `MODULE_IDS` — the degradation scenario this task
 * covers is precisely the one where that fuller enumeration path may not be trustworthy/available
 * either; the gate itself only ever needs the artifact-path list, however it was obtained.
 */
function loadMinimalContext(dir, { kbJsonFileArtifacts = ['modules/anemia/reference-ranges.json'] } = {}) {
  const rightsRecords = JSON.parse(readFileSync(path.join(dir, 'rights', 'rights-records.json'), 'utf8'));
  const rightsLedger = JSON.parse(readFileSync(path.join(dir, 'rights', 'rights-ledger.json'), 'utf8'));
  return { kbJsonFileArtifacts, rightsLedger, rightsRecords };
}

test('standalone fixture setup: contains only rights-records.json + rights-ledger.json — no release-context.json, no schemas/rights/ amendment layer', () => {
  const dir = makeMinimalFixture();
  try {
    assert.ok(existsSync(path.join(dir, 'rights', 'rights-records.json')));
    assert.ok(existsSync(path.join(dir, 'rights', 'rights-ledger.json')));
    assert.ok(!existsSync(path.join(dir, 'rights', 'release-context.json')), 'fixture must NOT contain rights/release-context.json');
    assert.ok(!existsSync(path.join(dir, 'rights', 'rights-failures.json')), 'fixture must NOT contain rights/rights-failures.json');
    assert.ok(!existsSync(path.join(dir, 'schemas')), 'fixture must NOT contain any schemas/ directory (no vendored-schema amendment layer)');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('standalone: checkKbJsonFileCoverage passes against the minimal fixture (one record, one ledger entry, one covered artifact)', () => {
  const dir = makeMinimalFixture();
  try {
    const context = loadMinimalContext(dir);
    const { errors } = checkKbJsonFileCoverage(context);
    assert.deepEqual(errors, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('standalone: checkKbJsonFileCoverage still FAILS CLOSED within the minimal fixture — an artifact with no ledger entry', () => {
  // Same minimal fixture shape (still no release-context.json, still no schemas/rights/), but the
  // artifact list now names a path the fixture's single ledger entry does not cover — proving the
  // degradation mode is genuinely a working gate, not merely "reachable without crashing."
  const dir = makeMinimalFixture({ ledgerEntries: [] });
  try {
    const context = loadMinimalContext(dir);
    const { errors } = checkKbJsonFileCoverage(context);
    assert.ok(
      errors.some((e) => e.includes('KB_JSON_FILES artifact "modules/anemia/reference-ranges.json" has no rights/rights-ledger.json entry')),
      errors.join('\n'),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('standalone: checkKbJsonFileCoverage still FAILS CLOSED within the minimal fixture — a dangling ledger entry (rights record removed)', () => {
  const dir = makeMinimalFixture({
    ledgerEntries: [{ ...MINIMAL_LEDGER_ENTRY, rights_record_id: 'RR-DOES-NOT-EXIST-IN-THIS-FIXTURE' }],
  });
  try {
    const context = loadMinimalContext(dir);
    const { errors } = checkKbJsonFileCoverage(context);
    assert.ok(errors.some((e) => e.includes('references unknown rights_record_id "RR-DOES-NOT-EXIST-IN-THIS-FIXTURE"')), errors.join('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('standalone: D7 — the minimal fixture record sits at overall_status "UNKNOWN" and still passes (coverage-shaped, never clearance-shaped)', () => {
  const dir = makeMinimalFixture();
  try {
    const records = JSON.parse(readFileSync(path.join(dir, 'rights', 'rights-records.json'), 'utf8'));
    assert.equal(records.records[0].overall_status, 'UNKNOWN', 'fixture assumption');
    const context = loadMinimalContext(dir);
    assert.deepEqual(checkKbJsonFileCoverage(context).errors, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
