// tests/ef-retro-protocol.test.mjs -- P4-T6 (Evidence Foundry E1 Phase 4, FR-24, ADR-0006).
//
// Proves this task's own acceptance criteria (phase-4-progress.md P4-T6 row):
//   1. `schemas/protocol.schema.json` exists, is a real JSON Schema document (loads and validates
//      cleanly with `scripts/lib/json-schema-lite.mjs`, which itself fails closed on any
//      unsupported keyword -- so a passing load already proves this schema uses no keyword the
//      repo's dependency-free validator cannot enforce), and carries slots for the dangerous-miss
//      rate, utility measures, and subgroup/analyzer/site strata.
//   2. Every threshold-bearing field in that schema is `const: null` -- an all-null-threshold
//      document validates; a document declaring ANY real threshold value does not, at every one of
//      the three threshold locations the schema names (top-level, per-utility-measure, per-stratum).
//   3. A seeded populated-threshold fixture is rejected FAIL-CLOSED (`ProtocolError`) by
//      `lib/protocol.mjs#assertProtocolShape` -- the structural gate `lib/verbs/report.mjs` (P4-T6
//      wiring) calls before ever computing or writing a report; see
//      `tests/ef-retro-metrics.test.mjs` for the report-verb-level integration proof (no
//      report/provenance written).
//   4. A protocol document missing its required human-authorship (`authoredBy`) is also rejected --
//      FR-24's "TBD-by-named-humans" is an authorship requirement, not merely a null-threshold one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadProtocolSchema,
  validateProtocolDocument,
  assertProtocolShape,
  PROTOCOL_SCHEMA_PATH,
} from '../tools/retro-validate/lib/protocol.mjs';
import { ProtocolError, UsageError } from '../tools/retro-validate/lib/errors.mjs';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'ef-retro', 'protocol');
const NULL_THRESHOLD_FIXTURE_PATH = path.join(FIXTURES_ROOT, 'null-threshold-protocol.json');
const POPULATED_THRESHOLD_FIXTURE_PATH = path.join(FIXTURES_ROOT, 'populated-threshold-protocol.json');

async function loadFixture(fixturePath) {
  return JSON.parse(await readFile(fixturePath, 'utf8'));
}

// -------------------------------------------------------------------------------------------
// Schema loads cleanly and names the required slots.
// -------------------------------------------------------------------------------------------

test('loadProtocolSchema: loads schemas/protocol.schema.json from the tool-local path (not shared schemas/)', async () => {
  assert.match(PROTOCOL_SCHEMA_PATH, /tools[/\\]retro-validate[/\\]schemas[/\\]protocol\.schema\.json$/);
  const schema = await loadProtocolSchema();
  assert.equal(schema.title, 'Retrospective Validation Prespecified Protocol — Human-Only Thresholds');
});

test('protocol.schema.json uses only json-schema-lite-supported keywords (a clean validate() call proves this -- unsupported keywords throw)', async () => {
  const schema = await loadProtocolSchema();
  // validate() throws synchronously (via assertKeywordsSupported) on any unsupported keyword
  // anywhere in the schema tree, including nested $defs -- calling it here at all is the proof.
  assert.doesNotThrow(() => validate(schema, { schemaVersion: 1 }));
});

test('protocol.schema.json names slots for dangerous-miss rate, utility measures, and subgroup/analyzer/site strata', async () => {
  const schema = await loadProtocolSchema();
  const thresholdsDef = schema.$defs.thresholds;
  assert.ok(Object.hasOwn(thresholdsDef.properties, 'dangerousMissRateThreshold'), 'missing dangerous-miss-rate threshold slot');
  assert.ok(Object.hasOwn(thresholdsDef.properties, 'utilityMeasures'), 'missing utility-measures slot');
  assert.ok(Object.hasOwn(thresholdsDef.properties, 'strata'), 'missing strata slot');

  const strataDef = schema.$defs.strata;
  assert.deepEqual(Object.keys(strataDef.properties).sort(), ['analyzer', 'site', 'subgroup']);
});

test('protocol.schema.json: every threshold-bearing leaf is const:null (no threshold field admits a real value)', async () => {
  const schema = await loadProtocolSchema();
  assert.equal(schema.$defs.thresholds.properties.dangerousMissRateThreshold.const, null);
  for (const key of Object.keys(schema.$defs.utilityMeasures.properties)) {
    assert.equal(schema.$defs.utilityMeasures.properties[key].const, null, `utilityMeasures.${key} must be const:null`);
  }
  assert.equal(schema.$defs.stratumThreshold.properties.dangerousMissRateThreshold.const, null);
});

// -------------------------------------------------------------------------------------------
// validateProtocolDocument / assertProtocolShape -- the null-threshold fixture is accepted.
// -------------------------------------------------------------------------------------------

test('validateProtocolDocument: the seeded all-null-threshold fixture validates cleanly (zero errors)', async () => {
  const doc = await loadFixture(NULL_THRESHOLD_FIXTURE_PATH);
  const errors = await validateProtocolDocument(doc);
  assert.deepEqual(errors, []);
});

test('assertProtocolShape: does not throw for the seeded all-null-threshold fixture', async () => {
  const doc = await loadFixture(NULL_THRESHOLD_FIXTURE_PATH);
  await assert.doesNotReject(() => assertProtocolShape(doc));
});

// -------------------------------------------------------------------------------------------
// A seeded populated-threshold fixture is rejected fail-closed.
// -------------------------------------------------------------------------------------------

test('validateProtocolDocument: the seeded populated-threshold fixture fails validation at dangerousMissRateThreshold', async () => {
  const doc = await loadFixture(POPULATED_THRESHOLD_FIXTURE_PATH);
  const errors = await validateProtocolDocument(doc);
  assert.ok(errors.length > 0, 'a populated-threshold document must fail validation');
  assert.ok(
    errors.some((e) => e.path.includes('dangerousMissRateThreshold') && /const/.test(e.message)),
    `expected a const-violation error naming dangerousMissRateThreshold, got: ${JSON.stringify(errors)}`,
  );
});

test('assertProtocolShape: throws ProtocolError (a UsageError, EXIT_USAGE) for the seeded populated-threshold fixture', async () => {
  const doc = await loadFixture(POPULATED_THRESHOLD_FIXTURE_PATH);
  await assert.rejects(
    () => assertProtocolShape(doc, { describe: 'the populated-threshold fixture' }),
    (err) => {
      assert.ok(err instanceof ProtocolError);
      assert.ok(err instanceof UsageError, 'ProtocolError must be a UsageError subclass -- no new exit code');
      assert.match(err.message, /populated-threshold fixture/);
      assert.match(err.message, /dangerousMissRateThreshold/);
      assert.match(err.message, /const: null/);
      assert.match(err.message, /fail-closed/);
      return true;
    },
  );
});

// -------------------------------------------------------------------------------------------
// Every one of the three threshold slots independently rejects a populated value -- not just the
// top-level one the seeded fixture happens to populate.
// -------------------------------------------------------------------------------------------

function validProtocolBase() {
  return {
    schemaVersion: 1,
    protocolId: 'inline-fixture',
    authoredBy: [{ name: 'SYNTHETIC-FIXTURE placeholder', role: 'SYNTHETIC-FIXTURE placeholder' }],
    thresholds: {
      dangerousMissRateThreshold: null,
      utilityMeasures: {
        sensitivityThreshold: null,
        specificityThreshold: null,
        positivePredictiveValueThreshold: null,
        negativePredictiveValueThreshold: null,
      },
      strata: { subgroup: [], analyzer: [], site: [] },
    },
  };
}

test('a populated utilityMeasures.sensitivityThreshold is rejected', async () => {
  const doc = validProtocolBase();
  doc.thresholds.utilityMeasures.sensitivityThreshold = 0.9;
  const errors = await validateProtocolDocument(doc);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.path.includes('sensitivityThreshold')));
});

test('a populated per-stratum dangerousMissRateThreshold (subgroup axis) is rejected', async () => {
  const doc = validProtocolBase();
  doc.thresholds.strata.subgroup.push({ stratumName: 'age 6-24mo', dangerousMissRateThreshold: 0.03 });
  const errors = await validateProtocolDocument(doc);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.path.includes('strata.subgroup') && e.path.includes('dangerousMissRateThreshold')));
});

test('a populated per-stratum dangerousMissRateThreshold (analyzer axis) is rejected', async () => {
  const doc = validProtocolBase();
  doc.thresholds.strata.analyzer.push({ stratumName: 'Sysmex XN-1000', dangerousMissRateThreshold: 0.01 });
  const errors = await validateProtocolDocument(doc);
  assert.ok(errors.length > 0);
});

test('a populated per-stratum dangerousMissRateThreshold (site axis) is rejected', async () => {
  const doc = validProtocolBase();
  doc.thresholds.strata.site.push({ stratumName: 'site-b', dangerousMissRateThreshold: 0.05 });
  const errors = await validateProtocolDocument(doc);
  assert.ok(errors.length > 0);
});

// -------------------------------------------------------------------------------------------
// FR-24 authorship requirement: a protocol with no named human owner also fails, independent of
// its thresholds.
// -------------------------------------------------------------------------------------------

test('a protocol document with an empty authoredBy array fails validation (named-human authorship is required)', async () => {
  const doc = validProtocolBase();
  doc.authoredBy = [];
  const errors = await validateProtocolDocument(doc);
  assert.ok(errors.length > 0);
});

test('a protocol document missing authoredBy entirely fails validation', async () => {
  const doc = validProtocolBase();
  delete doc.authoredBy;
  const errors = await validateProtocolDocument(doc);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.path.endsWith('authoredBy') && /required/.test(e.message)));
});

// -------------------------------------------------------------------------------------------
// Closed shape: an unrecognized top-level or nested key is rejected (additionalProperties:false),
// same posture fixture-corpus.schema.json already establishes.
// -------------------------------------------------------------------------------------------

test('an unrecognized top-level field is rejected (additionalProperties:false)', async () => {
  const doc = validProtocolBase();
  doc.someOtherField = 'not permitted';
  const errors = await validateProtocolDocument(doc);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.path.includes('someOtherField')));
});
