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
import {
  registerAnalyteBands,
  registerThresholdRule,
  getBuiltInAnalyteValue,
  getThreshold,
} from '../../src/ranges/registry.js';
import { toTri } from '../../src/facts/tristate.js';

const MODULE_ID = 'anemia';

export const REFERENCE_RANGE_SOURCE = rangeData.source;

function unpackBands(sexFields) {
  return rangeData.ranges.map((entry) => ({
    minMonths: entry.minMonths,
    maxMonthsExclusive: entry.maxMonthsExclusive,
    label: entry.label,
    source: REFERENCE_RANGE_SOURCE,
    female: Object.fromEntries(sexFields.map((field) => [field, entry.female[field]])),
    male: Object.fromEntries(sexFields.map((field) => [field, entry.male[field]])),
  }));
}

registerAnalyteBands(MODULE_ID, 'hb', unpackBands(['hbLower']));
registerAnalyteBands(MODULE_ID, 'mcv', unpackBands(['mcvLower', 'mcvUpper']));
registerAnalyteBands(MODULE_ID, 'rdw', unpackBands(['rdwUpper']));

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

registerThresholdRule(MODULE_ID, 'ferritin', ferritinThresholdRule);

export function getFerritinThreshold(ageMonths, menstruating) {
  return getThreshold(MODULE_ID, 'ferritin', { ageMonths, menstruating });
}

/**
 * Legacy combined built-in lookup: composes the three per-analyte band lookups back into
 * today's single-object shape ({hbLower, mcvLower, mcvUpper, rdwUpper, ageBand, source,
 * isFallback}). All three analytes share the same age-band partitioning and source, so
 * ageBand/source/isFallback are taken from any one of them.
 */
export function getBuiltInRange(ageMonths, sexAtBirth) {
  const hb = getBuiltInAnalyteValue(MODULE_ID, 'hb', ageMonths, sexAtBirth);
  const mcv = getBuiltInAnalyteValue(MODULE_ID, 'mcv', ageMonths, sexAtBirth);
  const rdw = getBuiltInAnalyteValue(MODULE_ID, 'rdw', ageMonths, sexAtBirth);
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

export function getEffectiveRanges(input) {
  const builtIn = getBuiltInRange(input?.patient?.ageMonths, input?.patient?.sexAtBirth);
  const local = input?.cbc?.localRanges ?? {};

  const pick = (key) => {
    const raw = local[key];
    const value = raw === '' || raw === null || raw === undefined ? null : Number(raw);
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
