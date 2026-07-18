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

const analyteBandsRegistry = new Map();
const thresholdRuleRegistry = new Map();

function key(moduleId, analyte) {
  return `${moduleId}::${analyte}`;
}

export function registerAnalyteBands(moduleId, analyte, bands) {
  analyteBandsRegistry.set(key(moduleId, analyte), bands);
}

export function registerThresholdRule(moduleId, analyte, rule) {
  thresholdRuleRegistry.set(key(moduleId, analyte), rule);
}

export function getBuiltInAnalyteValue(moduleId, analyte, ageMonths, sexAtBirth) {
  if (!Number.isFinite(ageMonths) || !['female', 'male'].includes(sexAtBirth)) {
    return null;
  }

  const bands = analyteBandsRegistry.get(key(moduleId, analyte));
  if (!bands) return null;

  const band = bands.find(
    (entry) => ageMonths >= entry.minMonths && ageMonths < entry.maxMonthsExclusive,
  );
  if (!band) return null;

  return {
    ...band[sexAtBirth],
    ageBand: band.label,
    source: band.source,
    isFallback: true,
  };
}

export function getThreshold(moduleId, analyte, context) {
  const rule = thresholdRuleRegistry.get(key(moduleId, analyte));
  if (!rule) return null;
  return rule(context);
}
