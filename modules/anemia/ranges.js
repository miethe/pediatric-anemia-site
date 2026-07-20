/**
 * Anemia module reference ranges.
 *
 * Registers the AAP2026_IDA built-in CBC bands (hb/mcv/rdw) and the ferritin threshold rule
 * with the generic registry (`src/ranges/registry.js`), then exposes a composition wrapper
 * that reproduces the pre-registry `getEffectiveRanges()`/`getBuiltInRange()` output shapes
 * verbatim. `reference-ranges.json` — previously unused, dead data — is now load-bearing: it
 * is the single source of truth these bands are unpacked from.
 *
 * Source: AAP Clinical Report, Pediatrics 2026;158(1):e2026077414, Table 1.
 * Local laboratory reference intervals always take precedence.
 */

import rangeData from './reference-ranges.json' with { type: 'json' };
import unitData from './units.json' with { type: 'json' };
import {
  registerAnalyteBands,
  registerThresholdRule,
  getBuiltInAnalyteValue,
  getThreshold,
} from '../../src/ranges/registry.js';
import { toTri } from '../../src/facts/tristate.js';
import { classifyUnit, UnitRejectionError } from '../../src/units.js';

const MODULE_ID = 'anemia';

export const REFERENCE_RANGE_SOURCE = rangeData.source;

function getUnitSpec(analyte) {
  return unitData.find((spec) => spec.analyte === analyte);
}

function unpackBands(analyte, sexFields) {
  return rangeData.ranges.map((entry) => ({
    minMonths: entry.minMonths,
    maxMonthsExclusive: entry.maxMonthsExclusive,
    label: entry.label,
    unit: entry.units[analyte],
    source: REFERENCE_RANGE_SOURCE,
    female: Object.fromEntries(sexFields.map((field) => [field, entry.female[field]])),
    male: Object.fromEntries(sexFields.map((field) => [field, entry.male[field]])),
  }));
}

registerAnalyteBands(
  MODULE_ID,
  'hb',
  unpackBands('hb', ['hbLower']),
  getUnitSpec('hemoglobin'),
);
registerAnalyteBands(
  MODULE_ID,
  'mcv',
  unpackBands('mcv', ['mcvLower', 'mcvUpper']),
  getUnitSpec('mcv'),
);
registerAnalyteBands(MODULE_ID, 'rdw', unpackBands('rdw', ['rdwUpper']), getUnitSpec('rdw'));

function ferritinThresholdRule({ ageMonths, menstruating } = {}) {
  if (toTri(menstruating) === 'true') {
    return { value: 30, source: 'AAP2026_IDA', rationale: 'all menstruating patients' };
  }
  if (!Number.isFinite(ageMonths)) return null;
  if (ageMonths >= 144 && ageMonths < 216) {
    return { value: 30, source: 'AAP2026_IDA', rationale: 'adolescent age band' };
  }
  if (ageMonths >= 6 && ageMonths < 144) {
    return { value: 20, source: 'AAP2026_IDA', rationale: 'young or school-aged child' };
  }
  return null;
}

registerThresholdRule(MODULE_ID, 'ferritin', {
  unit: 'ng/mL',
  unitSpec: getUnitSpec('ferritin'),
  get: ferritinThresholdRule,
});

export function getFerritinThreshold(ageMonths, menstruating, requestUnit) {
  return getThreshold(MODULE_ID, 'ferritin', { ageMonths, menstruating }, requestUnit);
}

/**
 * Legacy combined built-in lookup: composes the three per-analyte band lookups back into
 * today's single-object shape ({hbLower, mcvLower, mcvUpper, rdwUpper, ageBand, source,
 * isFallback}). All three analytes share the same age-band partitioning and source, so
 * ageBand/source/isFallback are taken from any one of them.
 */
export function getBuiltInRange(ageMonths, sexAtBirth, requestUnits = {}) {
  const hb = getBuiltInAnalyteValue(MODULE_ID, 'hb', ageMonths, sexAtBirth, requestUnits.hb);
  const mcv = getBuiltInAnalyteValue(MODULE_ID, 'mcv', ageMonths, sexAtBirth, requestUnits.mcv);
  const rdw = getBuiltInAnalyteValue(MODULE_ID, 'rdw', ageMonths, sexAtBirth, requestUnits.rdw);
  if (!hb || !mcv || !rdw) return null;

  return {
    hbLower: hb.hbLower,
    mcvLower: mcv.mcvLower,
    mcvUpper: mcv.mcvUpper,
    rdwUpper: rdw.rdwUpper,
    ageBand: hb.ageBand,
    source: hb.source,
    isFallback: true,
  };
}

/**
 * Local-range key (e.g. `hbLower`) -> the analyte unit spec governing it, derived from each
 * spec's `referenceFields`. A local limit is expressed in the same unit as its measurement.
 */
const localRangeUnitSpecs = new Map(
  unitData.flatMap((spec) => (spec.referenceFields ?? []).map(
    (field) => [field.split('.').at(-1), spec],
  )),
);

function assertLocalRangeUnit(key, providedUnit) {
  if (providedUnit === undefined) return;
  const spec = localRangeUnitSpecs.get(key);
  if (!spec) return;
  const classification = classifyUnit(spec, providedUnit);
  if (classification.accepted) return;
  throw new UnitRejectionError([{
    field: `cbc.localRanges.${key}`,
    providedUnit: typeof providedUnit === 'string' ? providedUnit : String(providedUnit),
    expectedUnit: spec.canonical,
    reason: classification.reason,
  }]);
}

export function getEffectiveRanges(input) {
  const measurementUnit = (container, measurementField) => (
    Object.hasOwn(container ?? {}, measurementField)
      && container[measurementField] !== null
      && container[measurementField] !== undefined
      ? container[`${measurementField}Unit`]
      : undefined
  );
  const cbc = input?.cbc;
  const builtIn = getBuiltInRange(input?.patient?.ageMonths, input?.patient?.sexAtBirth, {
    hb: measurementUnit(cbc, 'hemoglobin'),
    mcv: measurementUnit(cbc, 'mcv'),
    rdw: measurementUnit(cbc, 'rdw'),
  });
  const local = cbc?.localRanges ?? {};

  const pick = (key) => {
    const raw = local[key];
    const value = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    // `assess()` already validates local-range units at the snapshot boundary, but this helper
    // is exported and callable directly — a local limit is a clinical threshold with override
    // precedence, so it must fail closed here too rather than rely on an outer caller.
    if (Number.isFinite(value)) assertLocalRangeUnit(key, local[`${key}Unit`]);
    if (Number.isFinite(value)) return { value, source: 'LOCAL_LAB', isFallback: false };
    if (builtIn && Number.isFinite(builtIn[key])) {
      return { value: builtIn[key], source: builtIn.source, isFallback: true };
    }
    return { value: null, source: null, isFallback: null };
  };

  const hbLower = pick('hbLower');
  const mcvLower = pick('mcvLower');
  const mcvUpper = pick('mcvUpper');
  const rdwUpper = pick('rdwUpper');

  return {
    hbLower: hbLower.value,
    mcvLower: mcvLower.value,
    mcvUpper: mcvUpper.value,
    rdwUpper: rdwUpper.value,
    provenance: {
      hbLower,
      mcvLower,
      mcvUpper,
      rdwUpper,
      builtInAgeBand: builtIn?.ageBand ?? null,
    },
  };
}

export const BUILT_IN_RANGES = Object.freeze(rangeData.ranges);
