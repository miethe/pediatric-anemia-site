/**
 * Generic, module-agnostic reference-range registry.
 *
 * Two independent primitives (per SPIKE-001 RQ4):
 *  - Banded analyte values (`registerAnalyteBands` / `getBuiltInAnalyteValue`): a value that
 *    varies by age (and sex) band, e.g. hemoglobin lower limit by age/sex.
 *  - Threshold rules (`registerThresholdRule` / `getThreshold`): an arbitrary, non-banded
 *    lookup function, e.g. ferritin's flat menstruating-gated cutoff. This is kept distinct
 *    from the band shape on purpose — squeezing ferritin's selection logic into age/sex bands
 *    would distort it.
 *
 * An unregistered (moduleId, analyte) pair returns `null` from either lookup — it never
 * throws — matching the tolerant lookup behavior of the pre-registry code.
 */

import { classifyUnit } from '../units.js';

const analyteBandsRegistry = new Map();
const thresholdRuleRegistry = new Map();

function key(moduleId, analyte) {
  return `${moduleId}::${analyte}`;
}

export function registerAnalyteBands(moduleId, analyte, bands, unitSpec) {
  analyteBandsRegistry.set(key(moduleId, analyte), { bands, unitSpec });
}

export function registerThresholdRule(moduleId, analyte, rule) {
  thresholdRuleRegistry.set(key(moduleId, analyte), rule);
}

export class RangeUnitMismatchError extends Error {
  constructor(analyte, providedUnit, expectedUnit, reason = 'incompatible') {
    super(
      reason === 'missing_reference_unit'
        ? `Reference unit missing for ${analyte}.`
        : reason === 'invalid_reference_unit'
          ? `Reference unit is not recognized for ${analyte}.`
        : `Unit mismatch for ${analyte}: expected ${expectedUnit}.`,
    );
    this.name = 'RangeUnitMismatchError';
    this.code = 'UNIT_REJECTED';
    this.statusCode = 400;
    this.details = [{
      field: analyte,
      providedUnit: providedUnit === null || providedUnit === undefined
        ? null
        : String(providedUnit),
      expectedUnit: expectedUnit === null || expectedUnit === undefined
        ? null
        : String(expectedUnit),
      reason,
    }];
  }
}

function assertRequestUnit(analyte, providedUnit, expectedUnit, unitSpec) {
  if (typeof expectedUnit !== 'string' || expectedUnit.trim() === '') {
    throw new RangeUnitMismatchError(
      analyte,
      providedUnit,
      expectedUnit,
      'missing_reference_unit',
    );
  }

  if (!unitSpec || !classifyUnit(unitSpec, expectedUnit).accepted) {
    throw new RangeUnitMismatchError(
      analyte,
      providedUnit,
      expectedUnit,
      'invalid_reference_unit',
    );
  }

  if (providedUnit === undefined || providedUnit === null || providedUnit === '') return;

  const classification = classifyUnit(unitSpec, providedUnit);
  if (classification.accepted) return;

  throw new RangeUnitMismatchError(
    analyte,
    providedUnit,
    expectedUnit,
    classification.reason,
  );
}

export function getBuiltInAnalyteValue(moduleId, analyte, ageMonths, sexAtBirth, requestUnit) {
  if (!Number.isFinite(ageMonths) || !['female', 'male'].includes(sexAtBirth)) {
    return null;
  }

  const registration = analyteBandsRegistry.get(key(moduleId, analyte));
  if (!registration) return null;

  const band = registration.bands.find(
    (entry) => ageMonths >= entry.minMonths && ageMonths < entry.maxMonthsExclusive,
  );
  if (!band) return null;
  assertRequestUnit(analyte, requestUnit, band.unit, registration.unitSpec);

  return {
    ...band[sexAtBirth],
    ageBand: band.label,
    source: band.source,
    isFallback: true,
  };
}

export function getThreshold(moduleId, analyte, context, requestUnit) {
  const rule = thresholdRuleRegistry.get(key(moduleId, analyte));
  if (!rule) return null;
  assertRequestUnit(analyte, requestUnit, rule.unit, rule.unitSpec);
  return rule.get(context);
}
