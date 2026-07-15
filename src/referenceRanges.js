/**
 * Built-in fallback CBC reference intervals.
 * Source: AAP Clinical Report, Pediatrics 2026;158(1):e2026077414, Table 1.
 * Local laboratory reference intervals always take precedence.
 */

export const REFERENCE_RANGE_SOURCE = 'AAP2026_IDA';

const RANGES = [
  {
    minMonths: 6,
    maxMonthsExclusive: 24,
    label: '6 to <24 months',
    female: { hbLower: 11.0, mcvLower: 73.3, mcvUpper: 83.2, rdwUpper: 15.4 },
    male: { hbLower: 11.0, mcvLower: 71.1, mcvUpper: 82.2, rdwUpper: 15.9 },
  },
  {
    minMonths: 24,
    maxMonthsExclusive: 72,
    label: '2 to <6 years',
    female: { hbLower: 11.0, mcvLower: 75.2, mcvUpper: 85.0, rdwUpper: 14.5 },
    male: { hbLower: 11.0, mcvLower: 74.1, mcvUpper: 84.3, rdwUpper: 14.7 },
  },
  {
    minMonths: 72,
    maxMonthsExclusive: 144,
    label: '6 to <12 years',
    female: { hbLower: 11.2, mcvLower: 78.3, mcvUpper: 87.7, rdwUpper: 13.9 },
    male: { hbLower: 11.3, mcvLower: 77.8, mcvUpper: 86.5, rdwUpper: 13.7 },
  },
  {
    minMonths: 144,
    maxMonthsExclusive: 216,
    label: '12 to <18 years',
    female: { hbLower: 11.4, mcvLower: 80.5, mcvUpper: 91.8, rdwUpper: 14.6 },
    male: { hbLower: 12.4, mcvLower: 80.4, mcvUpper: 90.1, rdwUpper: 13.7 },
  },
];

export function getBuiltInRange(ageMonths, sexAtBirth) {
  if (!Number.isFinite(ageMonths) || !['female', 'male'].includes(sexAtBirth)) {
    return null;
  }

  const band = RANGES.find(
    (entry) => ageMonths >= entry.minMonths && ageMonths < entry.maxMonthsExclusive,
  );
  if (!band) return null;

  return {
    ...band[sexAtBirth],
    ageBand: band.label,
    source: REFERENCE_RANGE_SOURCE,
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

export function getFerritinThreshold(ageMonths, menstruating) {
  if (menstruating === true) {
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

export const BUILT_IN_RANGES = Object.freeze(RANGES);
