import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { assessPediatricAnemia } from '../src/engine.js';
import { deriveFacts as deriveFactsShim } from '../src/facts.js';
import { getModule, loadModuleCode } from '../src/modules/registry.js';
import { prepareUnitValidatedInput, registerUnitModule, validateUnits } from '../src/units.js';
import { getBuiltInAnalyteValue, getThreshold } from '../src/ranges/registry.js';
import { validate } from '../scripts/lib/json-schema-lite.mjs';
import unitData from '../modules/anemia/units.json' with { type: 'json' };

const rules = JSON.parse(await readFile(new URL('../modules/anemia/rules.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(await readFile(new URL('../modules/anemia/candidates.json', import.meta.url), 'utf8'));

function inputWithUnit(spec, unit) {
  const [group, field] = spec.field.split('.');
  return { [group]: { [field]: 1, [`${field}Unit`]: unit } };
}

for (const spec of unitData) {
  const rejectsEverySuppliedUnit = spec.confusables.some((entry) => entry.unit === '*');

  if (rejectsEverySuppliedUnit) {
    test(`${spec.field}: even its dimensionless canonical label is rejected when supplied`, () => {
      const result = validateUnits('anemia', inputWithUnit(spec, spec.canonical));
      assert.equal(result.ok, false);
      assert.deepEqual(result.errors, [{
        field: spec.field,
        providedUnit: spec.canonical,
        expectedUnit: spec.canonical,
        reason: 'incompatible',
      }]);
    });
  } else {
    test(`${spec.field}: canonical unit is accepted`, () => {
      const result = validateUnits('anemia', inputWithUnit(spec, spec.canonical));
      assert.equal(result.ok, true);
      assert.deepEqual(result.errors, []);
      assert.equal(result.fields.find((field) => field.field === spec.field).unitAssumed, false);
    });
  }

  for (const synonym of spec.synonyms) {
    test(`${spec.field}: synonym ${synonym} is normalized and accepted`, () => {
      const result = validateUnits('anemia', inputWithUnit(spec, synonym));
      assert.equal(result.ok, true);
      assert.equal(result.fields.find((field) => field.field === spec.field).normalizedUnit, spec.canonical.replaceAll(/[µμ]/g, 'u'));
    });
  }

  for (const confusable of spec.confusables) {
    test(`${spec.field}: confusable ${confusable.unit} is rejected as incompatible`, () => {
      const providedUnit = confusable.unit === '*' ? 'g/dL' : confusable.unit;
      const result = validateUnits('anemia', inputWithUnit(spec, providedUnit));
      assert.equal(result.ok, false);
      assert.deepEqual(result.errors, [{
        field: spec.field,
        providedUnit,
        expectedUnit: spec.canonical,
        reason: 'incompatible',
      }]);
    });
  }

  test(`${spec.field}: unknown unit is rejected`, () => {
    const result = validateUnits('anemia', inputWithUnit(spec, 'not-a-unit'));
    assert.equal(result.ok, false);
    const reason = spec.confusables.some((entry) => entry.unit === '*') ? 'incompatible' : 'unrecognized';
    assert.deepEqual(result.errors, [{
      field: spec.field,
      providedUnit: 'not-a-unit',
      expectedUnit: spec.canonical,
      reason,
    }]);
  });
}

test('missing units are assumed only for analytes whose measurements were supplied', () => {
  const result = validateUnits('anemia', {
    cbc: { hemoglobin: 11, mcv: null },
    labs: { ferritin: 12 },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.fields.map((field) => field.field), ['cbc.hemoglobin', 'labs.ferritin']);
  assert.ok(result.fields.every((field) => field.unitAssumed));
});

test('omitted local-range units are assumed and disclosed through assessment provenance', () => {
  const input = {
    patient: { ageMonths: 120, sexAtBirth: 'female' },
    cbc: { hemoglobin: 11.5, localRanges: { hbLower: 110 } },
  };
  const result = assessPediatricAnemia(input, rules, candidates);

  assert.equal(result.classification.anemiaStatus, 'present');
  assert.equal(result.classification.hemoglobin, 11.5);
  assert.equal(result.classification.hemoglobinLowerLimit, 110);
  assert.equal(result.classification.thresholdSource, 'LOCAL_LAB');
  assert.ok(result.provenance.unitsAssumed.includes('cbc.localRanges.hbLower'));
  assert.ok(result.limitations.some((limitation) => limitation.includes('cbc.localRanges.hbLower')));
  assert.deepEqual(input.cbc.localRanges, { hbLower: 110 }, 'no local-range number or label is added to caller input');
});

test('declared local-range units use the analyte closed table: synonyms normalize and confusables reject', () => {
  const accepted = prepareUnitValidatedInput('anemia', {
    patient: { ageMonths: 120, sexAtBirth: 'female' },
    cbc: {
      hemoglobin: 11.5,
      hemoglobinUnit: 'g/dL',
      localRanges: { hbLower: 12, hbLowerUnit: 'g/dl' },
    },
  });
  assert.equal(accepted.input.cbc.localRanges.hbLower, 12);
  assert.equal(accepted.input.cbc.localRanges.hbLowerUnit, 'g/dL');
  assert.equal(
    accepted.unitValidation.fields.find((field) => field.field === 'cbc.localRanges.hbLower').unitAssumed,
    false,
  );

  assert.throws(
    () => assessPediatricAnemia({
      patient: { ageMonths: 120, sexAtBirth: 'female' },
      cbc: {
        hemoglobin: 11.5,
        hemoglobinUnit: 'g/dL',
        localRanges: { hbLower: 110, hbLowerUnit: 'g/L' },
      },
    }, rules, candidates),
    (error) => error.code === 'UNIT_REJECTED'
      && error.details.some((detail) => detail.field === 'cbc.localRanges.hbLower'
        && detail.providedUnit === 'g/L'
        && detail.expectedUnit === 'g/dL'
        && detail.reason === 'incompatible'),
  );
});

test('every registered local-range field accepts only its analyte vocabulary', () => {
  for (const spec of unitData) {
    for (const field of spec.referenceFields ?? []) {
      const segments = field.split('.');
      const localField = segments.at(-1);
      const canonical = validateUnits('anemia', {
        cbc: { localRanges: { [localField]: 1, [`${localField}Unit`]: spec.canonical } },
      });
      assert.equal(canonical.ok, true, `${field} should accept ${spec.canonical}`);

      const unknown = validateUnits('anemia', {
        cbc: { localRanges: { [localField]: 1, [`${localField}Unit`]: 'not-a-unit' } },
      });
      assert.equal(unknown.ok, false, `${field} must reject an unrecognized label`);
      assert.equal(unknown.errors[0].field, field);
    }
  }
});

test('local-range unit siblings are admitted by the patient schema', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/patient-input.schema.json', import.meta.url), 'utf8'));
  const localRanges = {
    hbLower: 12, hbLowerUnit: 'g/dL',
    mcvLower: 77, mcvLowerUnit: 'fL',
    mcvUpper: 95, mcvUpperUnit: 'fL',
    rdwUpper: 14, rdwUpperUnit: '%',
    wbcLower: 4, wbcLowerUnit: '10^9/L',
    ancLower: 1.5, ancLowerUnit: '10^9/L',
    plateletsLower: 150, plateletsLowerUnit: '10^9/L',
  };
  assert.deepEqual(validate(schema, { cbc: { localRanges } }), []);
});

test('a supplied unit on the dimensionless sTfR/ferritin index rejects the assessment', () => {
  assert.throws(
    () => assessPediatricAnemia({
      labs: { stfrFerritinIndex: 2, stfrFerritinIndexUnit: '1' },
    }, rules, candidates),
    (error) => error.code === 'UNIT_REJECTED'
      && error.details.some((detail) => detail.field === 'labs.stfrFerritinIndex'
        && detail.providedUnit === '1'
        && detail.reason === 'incompatible'),
  );
});

test('micro-sign variants normalize to the blood-lead canonical unit', () => {
  const result = validateUnits('anemia', { labs: { bloodLeadLevel: 2, bloodLeadLevelUnit: 'μg/dL' } });
  assert.equal(result.ok, true);
  assert.equal(result.fields.find((field) => field.field === 'labs.bloodLeadLevel').normalizedUnit, 'ug/dL');
});

test('non-string providedUnit details are serialized as string-or-null', () => {
  assert.throws(
    () => assessPediatricAnemia({
      labs: { stfrFerritinIndex: 2, stfrFerritinIndexUnit: 0 },
    }, rules, candidates),
    (error) => error.code === 'UNIT_REJECTED'
      && error.details[0].providedUnit === '0'
      && typeof error.details[0].providedUnit === 'string',
  );
});

test('accessor-backed measurements are materialized once before validation and derivation', () => {
  let mismatchReads = 0;
  const mismatchLabs = { bloodLeadLevelUnit: 'µmol/L' };
  Object.defineProperty(mismatchLabs, 'bloodLeadLevel', {
    enumerable: true,
    get() {
      mismatchReads += 1;
      return mismatchReads === 1 ? null : 45;
    },
  });
  const mismatchResult = assessPediatricAnemia({ labs: mismatchLabs }, rules, candidates);
  assert.equal(mismatchReads, 1);
  assert.ok(!mismatchResult.alerts.some((alert) => alert.id === 'ALERT-007'));
  assert.ok(!mismatchResult.provenance.unitsAssumed.includes('labs.bloodLeadLevel'));

  let rejectingReads = 0;
  const rejectingLabs = { bloodLeadLevelUnit: 'µmol/L' };
  Object.defineProperty(rejectingLabs, 'bloodLeadLevel', {
    enumerable: true,
    get() {
      rejectingReads += 1;
      return rejectingReads === 1 ? 45 : null;
    },
  });
  assert.throws(
    () => deriveFactsShim({ labs: rejectingLabs }),
    (error) => error.code === 'UNIT_REJECTED'
      && error.details[0].field === 'labs.bloodLeadLevel',
  );
  assert.equal(rejectingReads, 1);

  let assumedReads = 0;
  const assumedLabs = {};
  Object.defineProperty(assumedLabs, 'bloodLeadLevel', {
    enumerable: true,
    get() {
      assumedReads += 1;
      return assumedReads === 1 ? 45 : null;
    },
  });
  const assumedResult = assessPediatricAnemia({ labs: assumedLabs }, rules, candidates);
  assert.equal(assumedReads, 1);
  assert.ok(assumedResult.alerts.some((alert) => alert.id === 'ALERT-007'));
  assert.ok(assumedResult.provenance.unitsAssumed.includes('labs.bloodLeadLevel'));

  const prepared = prepareUnitValidatedInput('anemia', { labs: { bloodLeadLevel: 4 } });
  assert.ok(Object.isFrozen(prepared.input));
  assert.ok(Object.isFrozen(prepared.input.labs));
});

test('orphan unit siblings are uniformly ignored when their measurement is absent or null', () => {
  const result = assessPediatricAnemia({
    patient: { ageMonths: 120, sexAtBirth: 'female' },
    cbc: {
      hemoglobin: null,
      hemoglobinUnit: 'g/L',
      mcv: null,
      mcvUnit: 'not-a-unit',
      localRanges: { hbLower: null, hbLowerUnit: 'g/L' },
    },
    labs: {
      ferritin: null,
      ferritinUnit: 'ng/L',
      bloodLeadLevelUnit: 'µmol/L',
    },
  }, rules, candidates);

  assert.equal(result.classification.anemiaStatus, 'indeterminate');
  assert.deepEqual(result.provenance.unitsAssumed, []);
});

test('a registered module with zero analytes is loaded and validates without conflation', () => {
  const moduleId = 'test-registered-zero-analytes';
  registerUnitModule(moduleId);
  assert.deepEqual(validateUnits(moduleId, { anything: { value: 1, valueUnit: 'wrong' } }), {
    ok: true,
    errors: [],
    fields: [],
  });
});

test('all public anemia fact-derivation paths reject a declared blood-lead mismatch', async () => {
  const input = { labs: { bloodLeadLevel: 0.2, bloodLeadLevelUnit: 'µmol/L' } };
  const rejectsBloodLeadMismatch = (error) => error.code === 'UNIT_REJECTED'
    && error.statusCode === 400
    && error.details.some((detail) => detail.field === 'labs.bloodLeadLevel'
      && detail.providedUnit === 'µmol/L'
      && detail.expectedUnit === 'ug/dL');

  assert.throws(() => deriveFactsShim(input), rejectsBloodLeadMismatch);
  assert.throws(() => getModule('anemia').deriveFacts(input), rejectsBloodLeadMismatch);

  const loadedModule = await loadModuleCode('anemia');
  assert.throws(() => loadedModule.deriveFacts(input), rejectsBloodLeadMismatch);
});

test('assessment output records supplied measurements with assumed units in provenance and limitations', () => {
  const result = assessPediatricAnemia({
    patient: { ageMonths: 120, sexAtBirth: 'female' },
    cbc: { hemoglobin: 11 },
    labs: { ferritin: 12 },
  }, rules, candidates);

  assert.deepEqual(result.provenance.unitsAssumed, ['cbc.hemoglobin', 'labs.ferritin']);
  assert.ok(result.limitations.some((limitation) => limitation.includes('cbc.hemoglobin')
    && limitation.includes('labs.ferritin')));
  assert.ok(!result.provenance.unitsAssumed.includes('cbc.mcv'));
});

test('the shared engine normalizes accepted notation and rejects declared mismatches before fact derivation', () => {
  const normalized = assessPediatricAnemia({
    patient: { ageMonths: 120, sexAtBirth: 'female' },
    cbc: { hemoglobin: 11, hemoglobinUnit: 'g/dl', mcv: 80, mcvUnit: 'fl' },
  }, rules, candidates);
  assert.equal(normalized.classification.anemiaStatus, 'present');
  assert.throws(
    () => assessPediatricAnemia({ cbc: { hemoglobin: 110, hemoglobinUnit: 'g/L' } }, rules, candidates),
    (error) => error.code === 'UNIT_REJECTED' && error.statusCode === 400 && error.details[0].field === 'cbc.hemoglobin',
  );
});

test('registered range lookup rejects a mismatched request unit', () => {
  assert.throws(
    () => getBuiltInAnalyteValue('anemia', 'hb', 120, 'female', 'g/L'),
    (error) => error.code === 'UNIT_REJECTED' && error.details[0].expectedUnit === 'g/dL',
  );
  assert.throws(
    () => getThreshold('anemia', 'ferritin', { ageMonths: 120 }, 'ng/L'),
    (error) => error.code === 'UNIT_REJECTED' && error.details[0].expectedUnit === 'ng/mL',
  );
});

test('unregistered range lookup remains tolerant and returns null', () => {
  assert.equal(getBuiltInAnalyteValue('anemia', 'unregistered', 120, 'female', 'g/L'), null);
  assert.equal(getThreshold('anemia', 'unregistered', { ageMonths: 120 }, 'ng/L'), null);
});

test('fallback range bands and thresholds require explicit unit tags', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/reference-range.schema.json', import.meta.url), 'utf8'));
  const rangeData = JSON.parse(await readFile(new URL('../modules/anemia/reference-ranges.json', import.meta.url), 'utf8'));
  const thresholdSchema = { $defs: schema.$defs, $ref: '#/$defs/builtInThreshold' };
  assert.deepEqual(validate(schema, rangeData), []);
  assert.ok(validate(schema, {
    ...rangeData,
    ranges: [{ ...rangeData.ranges[0], units: { mcv: 'fL', rdw: '%' } }],
  }).length > 0);
  assert.ok(validate(schema, {
    ...rangeData,
    ranges: [{ ...rangeData.ranges[0], units: { ...rangeData.ranges[0].units, hb: ' ' } }],
  }).length > 0);
  assert.ok(validate(thresholdSchema, {
    value: 20,
    source: 'AAP2026_IDA',
    rationale: 'young or school-aged child',
  }).length > 0);
});

test('the reference-range schema still directly validates a local profile document', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/reference-range.schema.json', import.meta.url), 'utf8'));
  const localProfile = JSON.parse(await readFile(
    new URL('../tests/fixtures/local-profile/SYNTHETIC-reference-interval-profile.json', import.meta.url),
    'utf8',
  ));
  assert.deepEqual(validate(schema, localProfile), []);
});

const examplesDir = new URL('../examples/', import.meta.url);
const exampleFiles = (await readdir(examplesDir)).filter((name) => name.endsWith('.json')).sort();

function scrub(result) {
  return { ...result, meta: { ...result.meta, generatedAt: 'x' } };
}

for (const filename of exampleFiles) {
  const name = filename.replace(/\.json$/, '');
  test(`unit migration: ${name} matches its provenance-aware golden output`, async () => {
    const input = JSON.parse(await readFile(new URL(filename, examplesDir), 'utf8'));
    const golden = JSON.parse(await readFile(new URL(`../tests/golden/${name}.json`, import.meta.url), 'utf8'));
    assert.deepEqual(scrub(assessPediatricAnemia(input, rules, candidates)), golden);
  });
}
