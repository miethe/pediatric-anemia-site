/**
 * EP2-T6 — R-P2 resilience: consumers handle absent/unset unit metadata.
 *
 * Verification only; no source file is edited or monkeypatched. Three properties, each
 * independently checked:
 *
 *  1. An unregistered (moduleId, analyte) pair still returns `null` from both
 *     `getBuiltInAnalyteValue` and `getThreshold` — with or without a requestUnit argument —
 *     and never throws. This is today's tolerant lookup contract (registry.js's own doc
 *     comment) and must survive the unit-check addition byte-for-byte.
 *  2. A registered band or threshold whose unit tag is absent fails
 *     `schemas/reference-range.schema.json` validation — a legacy-shape record encountered
 *     mid-migration is not silently accepted as valid.
 *  3. A patient input that omits a `<field>Unit` sibling is accepted (never rejected) with
 *     `unitAssumed: true` recorded per field — the assumption is observable via
 *     `validateUnits()`'s own return value, not silently absorbed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

import { getBuiltInAnalyteValue, getThreshold } from '../src/ranges/registry.js';
import { validateUnits } from '../src/units.js';
import { validate } from '../scripts/lib/json-schema-lite.mjs';
import unitData from '../modules/anemia/units.json' with { type: 'json' };
import '../src/engine.js'; // side effect: registers modules/anemia's units + ranges

const schema = JSON.parse(
  await readFile(new URL('../schemas/reference-range.schema.json', import.meta.url), 'utf8'),
);
const rangeData = JSON.parse(
  await readFile(new URL('../modules/anemia/reference-ranges.json', import.meta.url), 'utf8'),
);

function refSchema(defName) {
  return { $defs: schema.$defs, $ref: `#/$defs/${defName}` };
}

// --- 1. Unregistered analyte pair stays tolerant: null, never a throw --------------------

test('an unregistered analyte returns null from getBuiltInAnalyteValue regardless of unit metadata', () => {
  assert.doesNotThrow(() => {
    assert.equal(getBuiltInAnalyteValue('anemia', 'unregistered-analyte', 120, 'female'), null);
  });
  assert.doesNotThrow(() => {
    assert.equal(getBuiltInAnalyteValue('anemia', 'unregistered-analyte', 120, 'female', 'g/L'), null);
  });
  assert.doesNotThrow(() => {
    assert.equal(getBuiltInAnalyteValue('anemia', 'unregistered-analyte', 120, 'female', undefined), null);
  });
});

test('an unregistered analyte returns null from getThreshold regardless of unit metadata', () => {
  assert.doesNotThrow(() => {
    assert.equal(getThreshold('anemia', 'unregistered-analyte', { ageMonths: 120 }), null);
  });
  assert.doesNotThrow(() => {
    assert.equal(getThreshold('anemia', 'unregistered-analyte', { ageMonths: 120 }, 'ng/L'), null);
  });
  assert.doesNotThrow(() => {
    assert.equal(getThreshold('anemia', 'unregistered-analyte', { ageMonths: 120 }, undefined), null);
  });
});

test('an unregistered module id also stays tolerant for both lookups', () => {
  assert.doesNotThrow(() => {
    assert.equal(getBuiltInAnalyteValue('unregistered-module', 'hb', 120, 'female', 'g/dL'), null);
  });
  assert.doesNotThrow(() => {
    assert.equal(getThreshold('unregistered-module', 'ferritin', { ageMonths: 120 }, 'ng/mL'), null);
  });
});

// --- 2. Registered band/threshold missing its unit tag fails schema validation -----------

test('the real built-in reference-ranges.json validates cleanly (baseline: the schema is not simply broken)', () => {
  assert.deepEqual(validate(refSchema('builtInReferenceRanges'), rangeData), []);
});

test('a legacy-shape band with its unit tag stripped fails builtInBand validation, not silently accepted', () => {
  const legacyBand = { ...rangeData.ranges[0] };
  delete legacyBand.units;
  assert.deepEqual(validate(refSchema('builtInBand'), rangeData.ranges[0]), [], 'sanity: the real band is valid');
  assert.ok(validate(refSchema('builtInBand'), legacyBand).length > 0, 'a band without units must fail validation');
});

test('a legacy-shape reference-range document with the top-level unit map stripped fails validation', () => {
  const legacyDocument = { ...rangeData };
  delete legacyDocument.units;
  assert.ok(
    validate(refSchema('builtInReferenceRanges'), legacyDocument).length > 0,
    'a reference-range document without its top-level units map must fail validation',
  );
});

test('a threshold record missing its unit tag fails builtInThreshold validation', () => {
  const ferritinRegisteredUnit = unitData.find((spec) => spec.analyte === 'ferritin').canonical;
  const thresholdWithUnit = {
    unit: ferritinRegisteredUnit,
    value: 20,
    source: 'AAP2026_IDA',
    rationale: 'young or school-aged child',
  };
  const thresholdWithoutUnit = { ...thresholdWithUnit };
  delete thresholdWithoutUnit.unit;

  assert.deepEqual(validate(refSchema('builtInThreshold'), thresholdWithUnit), [], 'sanity: the tagged record is valid');
  assert.ok(
    validate(refSchema('builtInThreshold'), thresholdWithoutUnit).length > 0,
    'a threshold record without a unit tag must fail validation — missingness is never treated as normal',
  );
});

// --- 3. Omitted unit sibling: accepted, and the assumption is recorded, not silent -------

test('only supplied analytes with no <field>Unit sibling are accepted with unitAssumed: true', () => {
  const input = { cbc: { hemoglobin: 11 }, labs: { ferritin: 12 } };
  const result = validateUnits('anemia', input);

  assert.equal(result.ok, true, 'an omitted unit must never be rejected');
  assert.deepEqual(
    result.fields.map((field) => field.field),
    ['cbc.hemoglobin', 'labs.ferritin'],
    'absent measurements must not produce noisy assumed-unit records',
  );
  for (const field of result.fields) {
    assert.equal(field.unitAssumed, true, `${field.field} must record unitAssumed: true, not silently pass through`);
    assert.equal(typeof field.canonicalUnit, 'string');
    assert.ok(field.canonicalUnit.length > 0);
  }
});

test('a mix of declared and omitted units records unitAssumed independently per field', () => {
  const result = validateUnits('anemia', {
    cbc: { hemoglobin: 11, hemoglobinUnit: 'g/dL' },
    labs: { ferritin: 12 },
  });

  assert.equal(result.ok, true);
  const hemoglobinField = result.fields.find((field) => field.field === 'cbc.hemoglobin');
  const ferritinField = result.fields.find((field) => field.field === 'labs.ferritin');
  assert.equal(hemoglobinField.unitAssumed, false, 'a declared canonical unit must not be recorded as assumed');
  assert.equal(ferritinField.unitAssumed, true, 'an omitted unit must be recorded as assumed');
});

test('validateUnits fails closed in a fresh process when the requested module was never registered', () => {
  const unitsUrl = new URL('../src/units.js', import.meta.url).href;
  const script = `
    const { validateUnits } = await import(${JSON.stringify(unitsUrl)});
    process.stdout.write(JSON.stringify(validateUnits('anemia', {
      cbc: { hemoglobin: 110, hemoglobinUnit: 'g/L' }
    })));
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    encoding: 'utf8',
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    ok: false,
    errors: [{ moduleId: 'anemia', reason: 'unregistered-module' }],
    fields: [],
  });
});

test('direct anemia fact-module import registers units before deriving any facts', () => {
  const factsUrl = new URL('../modules/anemia/facts.anemia.js', import.meta.url).href;
  const script = `
    const { deriveFacts } = await import(${JSON.stringify(factsUrl)});
    try {
      deriveFacts({ labs: { bloodLeadLevel: 0.2, bloodLeadLevelUnit: 'µmol/L' } });
      process.stdout.write(JSON.stringify({ rejected: false }));
    } catch (error) {
      process.stdout.write(JSON.stringify({
        rejected: error.code === 'UNIT_REJECTED',
        field: error.details?.[0]?.field
      }));
    }
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    encoding: 'utf8',
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    rejected: true,
    field: 'labs.bloodLeadLevel',
  });
});
