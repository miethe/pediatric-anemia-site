// local-applicability — fail-closed evaluation of local laboratory reference-interval profiles
// and local terminology applicability profiles.
//
// THE GOVERNING PRINCIPLE
// A published pediatric reference interval is never site-applicable by default. Anemia cutoffs and
// CBC intervals vary by population, age band, sex, altitude, specimen type, analyzer/method, and
// units; a value that is normal on one analyzer can be flagged on another. Local applicability
// therefore cannot be inferred — it must be asserted by a named local laboratory authority and
// bound to an exact candidate version.
//
// Consequently every function here starts from "not applicable" and only moves to "applicable" if
// every dimension is positively asserted AND matches. Missing, conflicting, expired, superseded,
// unmapped, preliminary, stale, corrected, amended, and unknown states all produce a
// `fail_closed` decision carrying visible blockers. There is deliberately no code path that
// resolves an unknown to a default, and no function here returns a bare boolean — a caller cannot
// accidentally drop the blocker list.
//
// THREE INVARIANTS ADDED AFTER THE P3-V1 CLINICAL-INFORMATICS REVIEW
//
//  1. NO SECONDARY WILDCARDS. The `assertion` discriminator used to guard only one value per
//     container, so every other field in that container became a silent wildcard when null
//     (altitude bounds, age-band upper bound, interval sex, mapping unit/specimen). Every value
//     now routes through `readAsserted`/`readAssertedNumber`, and the schemas carry a conditional
//     pinning ALL sibling values non-null when a container says `asserted`.
//
//  2. NO UNPARSEABLE INPUT SILENTLY DISABLES A CHECK. An unparseable `options.now` used to yield
//     NaN, and NaN comparisons are false, which disabled expiry, not-yet-effective AND staleness
//     at once. Unparseable or non-numeric inputs now raise their own blocker; they never remove
//     one. Absent profile sections fail closed instead of throwing a TypeError.
//
//  3. ACTIVATION IS NOT SELF-DECLARABLE. `evaluateActivationGate` no longer trusts a
//     `signatureState: "bound"` string. There is no attachment verifier in this repository, so a
//     signature can never be verified here and the gate refuses unconditionally. §4 of the charter
//     is now true of the mechanism, not merely of the fixtures that happen to be checked in.
//
// SCOPE LIMIT: nothing in this module authorizes activation, release, or patient-affecting use.
// `evaluateActivationGate` exists only to prove that such authorization is refused.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Reserved token meaning "explicitly not known". It is a representable value on every dimension
 * so that unknown-ness survives serialization, and it is never coercible to a usable value.
 */
export const UNKNOWN_TOKEN = 'unknown';

export const BLOCKER = {
  STRUCTURALLY_INVALID: 'STRUCTURALLY_INVALID',
  PROFILE_SECTION_MISSING: 'PROFILE_SECTION_MISSING',
  UNKNOWN_DIMENSION: 'UNKNOWN_DIMENSION',
  DIMENSION_NOT_SUPPLIED: 'DIMENSION_NOT_SUPPLIED',
  UNKNOWN_TOKEN_NOT_COERCIBLE: 'UNKNOWN_TOKEN_NOT_COERCIBLE',
  REQUEST_DIMENSION_UNKNOWN: 'REQUEST_DIMENSION_UNKNOWN',
  NON_NUMERIC_VALUE: 'NON_NUMERIC_VALUE',
  EVALUATION_TIME_INVALID: 'EVALUATION_TIME_INVALID',

  PROFILE_NOT_ACTIVE: 'PROFILE_NOT_ACTIVE',
  PROFILE_EXPIRED: 'PROFILE_EXPIRED',
  PROFILE_NOT_YET_EFFECTIVE: 'PROFILE_NOT_YET_EFFECTIVE',
  PROFILE_SUPERSEDED_WITHOUT_SUCCESSOR: 'PROFILE_SUPERSEDED_WITHOUT_SUCCESSOR',
  PROFILE_STALE: 'PROFILE_STALE',
  REVIEW_CADENCE_UNKNOWN: 'REVIEW_CADENCE_UNKNOWN',
  CANDIDATE_BINDING_MISMATCH: 'CANDIDATE_BINDING_MISMATCH',

  POPULATION_MISMATCH: 'POPULATION_MISMATCH',
  AGE_BAND_MISMATCH: 'AGE_BAND_MISMATCH',
  SEX_MISMATCH: 'SEX_MISMATCH',
  SPECIMEN_MISMATCH: 'SPECIMEN_MISMATCH',
  ANALYZER_MISMATCH: 'ANALYZER_MISMATCH',
  METHOD_MISMATCH: 'METHOD_MISMATCH',
  ALTITUDE_MISMATCH: 'ALTITUDE_MISMATCH',
  UNIT_MISMATCH: 'UNIT_MISMATCH',

  // Corrected/gestational age (C2). Chronological age alone does not identify a pediatric
  // patient: a 4-week-old born at 27 weeks and one born at 40 weeks are not the same patient.
  CORRECTED_AGE_REQUIRED_NOT_SUPPLIED: 'CORRECTED_AGE_REQUIRED_NOT_SUPPLIED',
  GESTATIONAL_AGE_MISMATCH: 'GESTATIONAL_AGE_MISMATCH',

  // Age-band structure (C3). An age band that is unbounded, inverted, too wide, straddling a
  // declared physiologic boundary, overlapping a sibling, or leaving a gap cannot deliver the
  // right interval even when every other dimension matches.
  AGE_BAND_POLICY_UNKNOWN: 'AGE_BAND_POLICY_UNKNOWN',
  AGE_BAND_UNBOUNDED: 'AGE_BAND_UNBOUNDED',
  AGE_BAND_INVALID: 'AGE_BAND_INVALID',
  AGE_BAND_TOO_WIDE: 'AGE_BAND_TOO_WIDE',
  AGE_BAND_STRADDLES_BOUNDARY: 'AGE_BAND_STRADDLES_BOUNDARY',
  AGE_BAND_OVERLAP: 'AGE_BAND_OVERLAP',
  AGE_BAND_GAP: 'AGE_BAND_GAP',

  INTERVAL_MISSING: 'INTERVAL_MISSING',
  INTERVAL_CONFLICT: 'INTERVAL_CONFLICT',
  INTERVAL_BOUNDS_MISSING: 'INTERVAL_BOUNDS_MISSING',
  INTERVAL_BOUNDS_INVALID: 'INTERVAL_BOUNDS_INVALID',

  // Critical values (C11). An urgent alert must dominate routine interval logic, so a profile
  // that cannot supply the panic threshold for the analyte under evaluation fails closed.
  CRITICAL_VALUE_MISSING: 'CRITICAL_VALUE_MISSING',
  CRITICAL_VALUE_CONFLICT: 'CRITICAL_VALUE_CONFLICT',
  CRITICAL_VALUE_NOT_ASSERTED: 'CRITICAL_VALUE_NOT_ASSERTED',
  CRITICAL_VALUE_UNIT_MISMATCH: 'CRITICAL_VALUE_UNIT_MISMATCH',
  CRITICAL_VALUE_BOUNDS_MISSING: 'CRITICAL_VALUE_BOUNDS_MISSING',

  UNMAPPED_LOCAL_CODE: 'UNMAPPED_LOCAL_CODE',
  MAPPING_CONFLICT: 'MAPPING_CONFLICT',
  MAPPING_EQUIVALENCE_NOT_EXACT: 'MAPPING_EQUIVALENCE_NOT_EXACT',
  CODE_SYSTEM_VERSION_UNASSERTED: 'CODE_SYSTEM_VERSION_UNASSERTED',

  RESOURCE_TYPE_MISSING: 'RESOURCE_TYPE_MISSING',
  RESOURCE_TYPE_UNSUPPORTED: 'RESOURCE_TYPE_UNSUPPORTED',

  RESULT_STATUS_MISSING: 'RESULT_STATUS_MISSING',
  RESULT_STATUS_UNKNOWN: 'RESULT_STATUS_UNKNOWN',
  RESULT_STATUS_UNRECOGNIZED: 'RESULT_STATUS_UNRECOGNIZED',
  // The old single RESULT_STATUS_BLOCKED conflated five situations that demand three different
  // user actions. They are now distinct codes so a refusal message can tell a clinician whether
  // to wait, to re-order, or to discard what they are looking at.
  RESULT_STATUS_BLOCKING_STATE: 'RESULT_STATUS_BLOCKING_STATE',
  RESULT_STATUS_NOT_ACCEPTED_FOR_DECISION: 'RESULT_STATUS_NOT_ACCEPTED_FOR_DECISION',
  RESULT_RETRACTED_ENTERED_IN_ERROR: 'RESULT_RETRACTED_ENTERED_IN_ERROR',
  RESULT_CANCELLED_NEVER_PERFORMED: 'RESULT_CANCELLED_NEVER_PERFORMED',
  RESULT_NOT_YET_AVAILABLE: 'RESULT_NOT_YET_AVAILABLE',

  STATUS_LINEAGE_INCOMPLETE: 'STATUS_LINEAGE_INCOMPLETE',
  STATUS_LINEAGE_OUT_OF_ORDER: 'STATUS_LINEAGE_OUT_OF_ORDER',
  STATUS_NOT_IN_LINEAGE: 'STATUS_NOT_IN_LINEAGE',
  CORRECTION_UNRESOLVED: 'CORRECTION_UNRESOLVED',
  SUPERSEDING_REFERENCE_UNRESOLVABLE: 'SUPERSEDING_REFERENCE_UNRESOLVABLE',
  SUPERSEDING_REFERENCE_SELF: 'SUPERSEDING_REFERENCE_SELF',
  OBSERVATION_SUPERSEDED: 'OBSERVATION_SUPERSEDED',

  EFFECTIVE_TIME_MISSING: 'EFFECTIVE_TIME_MISSING',
  ISSUED_TIME_MISSING: 'ISSUED_TIME_MISSING',
  SPECIMEN_MISSING: 'SPECIMEN_MISSING',
  UNIT_MISSING: 'UNIT_MISSING',
  RESULT_STALE: 'RESULT_STALE',
  STALENESS_POLICY_UNKNOWN: 'STALENESS_POLICY_UNKNOWN',

  AUTHORITY_NOT_EXECUTED_OWNER_HELD: 'AUTHORITY_NOT_EXECUTED_OWNER_HELD',
  AUTHORITY_INCOMPLETE: 'AUTHORITY_INCOMPLETE',
  SIGNATURE_NOT_EXECUTED_OWNER_HELD: 'SIGNATURE_NOT_EXECUTED_OWNER_HELD',
  SIGNATURE_SELF_DECLARED_NOT_VERIFIED: 'SIGNATURE_SELF_DECLARED_NOT_VERIFIED',
  PROFILE_CLASS_NOT_SITE_ASSERTED: 'PROFILE_CLASS_NOT_SITE_ASSERTED',
  SYNTHETIC_PROFILE_CANNOT_ACTIVATE: 'SYNTHETIC_PROFILE_CANNOT_ACTIVATE',
  APPLICABILITY_NOT_ESTABLISHED: 'APPLICABILITY_NOT_ESTABLISHED',
  DERIVATION_NOT_LOCALLY_VERIFIED: 'DERIVATION_NOT_LOCALLY_VERIFIED',
};

/**
 * Severity orders PRESENTATION ONLY. Every blocker is equally fail-closed and none may be
 * ignored, suppressed, or auto-dismissed. Severity exists because a flat unordered list made
 * PROFILE_STALE and CORRECTION_UNRESOLVED read as peers, and they are not: one means the profile
 * is overdue for review, the other means a superseding value exists and the number in hand is
 * wrong. The dangerous one must surface first.
 *
 * - `critical` — a wrong, superseded, or retracted VALUE could reach a clinician.
 * - `high`     — the profile or result is not trustworthy, but no specific wrong number follows.
 * - `moderate` — a required input is absent or unknown, so nothing can be judged at all.
 */
export const SEVERITY = { CRITICAL: 'critical', HIGH: 'high', MODERATE: 'moderate' };

const SEVERITY_RANK = { critical: 0, high: 1, moderate: 2 };

const BLOCKER_SEVERITY = {
  // critical — a wrong / superseded / retracted value could reach a clinician
  [BLOCKER.STRUCTURALLY_INVALID]: SEVERITY.CRITICAL,
  [BLOCKER.PROFILE_SECTION_MISSING]: SEVERITY.CRITICAL,
  [BLOCKER.EVALUATION_TIME_INVALID]: SEVERITY.CRITICAL,
  [BLOCKER.POPULATION_MISMATCH]: SEVERITY.CRITICAL,
  [BLOCKER.AGE_BAND_MISMATCH]: SEVERITY.CRITICAL,
  [BLOCKER.SEX_MISMATCH]: SEVERITY.CRITICAL,
  [BLOCKER.SPECIMEN_MISMATCH]: SEVERITY.CRITICAL,
  [BLOCKER.ANALYZER_MISMATCH]: SEVERITY.CRITICAL,
  [BLOCKER.METHOD_MISMATCH]: SEVERITY.CRITICAL,
  [BLOCKER.ALTITUDE_MISMATCH]: SEVERITY.CRITICAL,
  [BLOCKER.UNIT_MISMATCH]: SEVERITY.CRITICAL,
  [BLOCKER.CORRECTED_AGE_REQUIRED_NOT_SUPPLIED]: SEVERITY.CRITICAL,
  [BLOCKER.GESTATIONAL_AGE_MISMATCH]: SEVERITY.CRITICAL,
  [BLOCKER.AGE_BAND_UNBOUNDED]: SEVERITY.CRITICAL,
  [BLOCKER.AGE_BAND_INVALID]: SEVERITY.CRITICAL,
  [BLOCKER.AGE_BAND_TOO_WIDE]: SEVERITY.CRITICAL,
  [BLOCKER.AGE_BAND_STRADDLES_BOUNDARY]: SEVERITY.CRITICAL,
  [BLOCKER.AGE_BAND_OVERLAP]: SEVERITY.CRITICAL,
  [BLOCKER.AGE_BAND_GAP]: SEVERITY.CRITICAL,
  [BLOCKER.INTERVAL_MISSING]: SEVERITY.CRITICAL,
  [BLOCKER.INTERVAL_CONFLICT]: SEVERITY.CRITICAL,
  [BLOCKER.INTERVAL_BOUNDS_MISSING]: SEVERITY.CRITICAL,
  [BLOCKER.INTERVAL_BOUNDS_INVALID]: SEVERITY.CRITICAL,
  [BLOCKER.CRITICAL_VALUE_MISSING]: SEVERITY.CRITICAL,
  [BLOCKER.CRITICAL_VALUE_CONFLICT]: SEVERITY.CRITICAL,
  [BLOCKER.CRITICAL_VALUE_NOT_ASSERTED]: SEVERITY.CRITICAL,
  [BLOCKER.CRITICAL_VALUE_UNIT_MISMATCH]: SEVERITY.CRITICAL,
  [BLOCKER.CRITICAL_VALUE_BOUNDS_MISSING]: SEVERITY.CRITICAL,
  [BLOCKER.UNMAPPED_LOCAL_CODE]: SEVERITY.CRITICAL,
  [BLOCKER.MAPPING_CONFLICT]: SEVERITY.CRITICAL,
  [BLOCKER.MAPPING_EQUIVALENCE_NOT_EXACT]: SEVERITY.CRITICAL,
  [BLOCKER.RESULT_RETRACTED_ENTERED_IN_ERROR]: SEVERITY.CRITICAL,
  [BLOCKER.STATUS_LINEAGE_INCOMPLETE]: SEVERITY.CRITICAL,
  [BLOCKER.STATUS_LINEAGE_OUT_OF_ORDER]: SEVERITY.CRITICAL,
  [BLOCKER.STATUS_NOT_IN_LINEAGE]: SEVERITY.CRITICAL,
  [BLOCKER.CORRECTION_UNRESOLVED]: SEVERITY.CRITICAL,
  [BLOCKER.SUPERSEDING_REFERENCE_UNRESOLVABLE]: SEVERITY.CRITICAL,
  [BLOCKER.SUPERSEDING_REFERENCE_SELF]: SEVERITY.CRITICAL,
  [BLOCKER.OBSERVATION_SUPERSEDED]: SEVERITY.CRITICAL,
  [BLOCKER.CANDIDATE_BINDING_MISMATCH]: SEVERITY.CRITICAL,
  [BLOCKER.DERIVATION_NOT_LOCALLY_VERIFIED]: SEVERITY.CRITICAL,
  [BLOCKER.SYNTHETIC_PROFILE_CANNOT_ACTIVATE]: SEVERITY.CRITICAL,
  [BLOCKER.PROFILE_CLASS_NOT_SITE_ASSERTED]: SEVERITY.CRITICAL,
  [BLOCKER.SIGNATURE_SELF_DECLARED_NOT_VERIFIED]: SEVERITY.CRITICAL,

  // high — the profile or result is not trustworthy
  [BLOCKER.PROFILE_NOT_ACTIVE]: SEVERITY.HIGH,
  [BLOCKER.PROFILE_EXPIRED]: SEVERITY.HIGH,
  [BLOCKER.PROFILE_NOT_YET_EFFECTIVE]: SEVERITY.HIGH,
  [BLOCKER.PROFILE_SUPERSEDED_WITHOUT_SUCCESSOR]: SEVERITY.HIGH,
  [BLOCKER.PROFILE_STALE]: SEVERITY.HIGH,
  [BLOCKER.REVIEW_CADENCE_UNKNOWN]: SEVERITY.HIGH,
  [BLOCKER.AGE_BAND_POLICY_UNKNOWN]: SEVERITY.HIGH,
  [BLOCKER.CODE_SYSTEM_VERSION_UNASSERTED]: SEVERITY.HIGH,
  [BLOCKER.RESOURCE_TYPE_MISSING]: SEVERITY.HIGH,
  [BLOCKER.RESOURCE_TYPE_UNSUPPORTED]: SEVERITY.HIGH,
  [BLOCKER.RESULT_STATUS_BLOCKING_STATE]: SEVERITY.HIGH,
  [BLOCKER.RESULT_STATUS_NOT_ACCEPTED_FOR_DECISION]: SEVERITY.HIGH,
  [BLOCKER.RESULT_CANCELLED_NEVER_PERFORMED]: SEVERITY.HIGH,
  [BLOCKER.RESULT_STALE]: SEVERITY.HIGH,
  [BLOCKER.STALENESS_POLICY_UNKNOWN]: SEVERITY.HIGH,
  [BLOCKER.AUTHORITY_NOT_EXECUTED_OWNER_HELD]: SEVERITY.HIGH,
  [BLOCKER.AUTHORITY_INCOMPLETE]: SEVERITY.HIGH,
  [BLOCKER.SIGNATURE_NOT_EXECUTED_OWNER_HELD]: SEVERITY.HIGH,
  [BLOCKER.APPLICABILITY_NOT_ESTABLISHED]: SEVERITY.HIGH,

  // moderate — a required input is absent or unknown
  [BLOCKER.UNKNOWN_DIMENSION]: SEVERITY.MODERATE,
  [BLOCKER.DIMENSION_NOT_SUPPLIED]: SEVERITY.MODERATE,
  [BLOCKER.UNKNOWN_TOKEN_NOT_COERCIBLE]: SEVERITY.MODERATE,
  [BLOCKER.REQUEST_DIMENSION_UNKNOWN]: SEVERITY.MODERATE,
  [BLOCKER.NON_NUMERIC_VALUE]: SEVERITY.MODERATE,
  [BLOCKER.RESULT_STATUS_MISSING]: SEVERITY.MODERATE,
  [BLOCKER.RESULT_STATUS_UNKNOWN]: SEVERITY.MODERATE,
  [BLOCKER.RESULT_STATUS_UNRECOGNIZED]: SEVERITY.MODERATE,
  [BLOCKER.RESULT_NOT_YET_AVAILABLE]: SEVERITY.MODERATE,
  [BLOCKER.EFFECTIVE_TIME_MISSING]: SEVERITY.MODERATE,
  [BLOCKER.ISSUED_TIME_MISSING]: SEVERITY.MODERATE,
  [BLOCKER.SPECIMEN_MISSING]: SEVERITY.MODERATE,
  [BLOCKER.UNIT_MISSING]: SEVERITY.MODERATE,
};

/** Severity for a blocker code. Unmapped codes fail closed as `critical`, never as ignorable. */
export function severityOf(code) {
  return BLOCKER_SEVERITY[code] ?? SEVERITY.CRITICAL;
}

const schemaCache = new Map();

async function loadSchema(filename) {
  if (!schemaCache.has(filename)) {
    schemaCache.set(filename, JSON.parse(await readFile(path.join(repoRoot, 'schemas', filename), 'utf8')));
  }
  return schemaCache.get(filename);
}

export async function loadReferenceIntervalSchema() {
  return loadSchema('reference-range.schema.json');
}

export async function loadTerminologyProfileSchema() {
  return loadSchema('terminology-profile.schema.json');
}

function decision(rawBlockers) {
  // Exact duplicates (same code, same field, same message) arise when one shared policy is read
  // once per band. Collapsing byte-identical entries is not filtering — no distinct refusal is
  // ever merged, because the message carries the specific band or field it came from.
  const seen = new Set();
  const blockers = rawBlockers.filter((blocker) => {
    const key = `${blocker.code} ${blocker.field} ${blocker.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Stable severity ordering: the most dangerous blocker is first, ties keep detection order so
  // the result stays deterministic. Nothing is dropped or collapsed — ordering is not filtering.
  const ordered = blockers
    .map((blocker, index) => ({ blocker, index }))
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.blocker.severity] - SEVERITY_RANK[b.blocker.severity];
      return bySeverity !== 0 ? bySeverity : a.index - b.index;
    })
    .map((entry) => entry.blocker);

  return {
    // Two states only. There is no "warning" state: a warning is something a caller can ignore,
    // and every condition this module detects is one that must stop the evaluation.
    decision: ordered.length === 0 ? 'applicable' : 'fail_closed',
    applicable: ordered.length === 0,
    blockers: ordered,
    // Callers must be able to surface every blocker to a human. Blockers are never collapsed to
    // a count or a single "first error".
    visible: true,
    highestSeverity: ordered.length === 0 ? null : ordered[0].severity,
  };
}

function block(blockers, code, field, message) {
  blockers.push({ code, field, message, severity: severityOf(code) });
}

/**
 * Guard a required profile section. Absent sections used to throw a TypeError, which is not a
 * fail-closed decision — it is a crash the caller may catch and misread as "no objections".
 */
function requireSection(container, key, fieldPath, blockers) {
  const section = container?.[key];
  if (section === null || section === undefined || typeof section !== 'object') {
    block(
      blockers,
      BLOCKER.PROFILE_SECTION_MISSING,
      fieldPath,
      `required profile section "${key}" is absent or not an object; the profile cannot be evaluated`,
    );
    return undefined;
  }
  return section;
}

/**
 * Read a value that must be positively asserted. Returns `undefined` (never a default) and
 * records a blocker when the dimension is unknown, unsupplied, null, or carries the reserved
 * `"unknown"` token. This is the single choke point that makes unknown-value coercion impossible:
 * callers cannot obtain a value without going through it.
 *
 * EVERY value field must go through here, not only the first one in its container. The review
 * found that secondary fields (analyzer.method, altitude bounds, ageBand.high, interval.sex,
 * mapping.unitCode) bypassed it and became wildcards whenever they were null.
 */
function readAsserted(node, valueKey, fieldPath, blockers) {
  if (node === null || node === undefined) {
    block(blockers, BLOCKER.DIMENSION_NOT_SUPPLIED, fieldPath, 'dimension object is absent');
    return undefined;
  }
  if (node.assertion === UNKNOWN_TOKEN) {
    block(blockers, BLOCKER.UNKNOWN_DIMENSION, fieldPath, 'dimension is explicitly unknown and cannot be defaulted');
    return undefined;
  }
  if (node.assertion !== 'asserted') {
    block(blockers, BLOCKER.DIMENSION_NOT_SUPPLIED, fieldPath, `dimension assertion is "${node.assertion}", not "asserted"`);
    return undefined;
  }
  const value = node[valueKey];
  if (value === null || value === undefined) {
    block(blockers, BLOCKER.DIMENSION_NOT_SUPPLIED, `${fieldPath}.${valueKey}`, `dimension is marked asserted but ${valueKey} is null`);
    return undefined;
  }
  if (typeof value === 'string' && value.trim().toLowerCase() === UNKNOWN_TOKEN) {
    block(
      blockers,
      BLOCKER.UNKNOWN_TOKEN_NOT_COERCIBLE,
      fieldPath,
      'value is the reserved "unknown" token; it is never coerced into a usable value',
    );
    return undefined;
  }
  return value;
}

/** `readAsserted` plus a hard numeric check: a numeric dimension is never read from a string. */
function readAssertedNumber(node, valueKey, fieldPath, blockers) {
  const value = readAsserted(node, valueKey, fieldPath, blockers);
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    block(
      blockers,
      BLOCKER.NON_NUMERIC_VALUE,
      `${fieldPath}.${valueKey}`,
      `expected a finite number, got ${JSON.stringify(value)}; a non-numeric bound silently disables every comparison against it`,
    );
    return undefined;
  }
  return value;
}

/** Reject request-side unknowns with the same rigour as profile-side unknowns. */
function readRequestValue(value, fieldPath, blockers) {
  if (value === null || value === undefined) {
    block(blockers, BLOCKER.REQUEST_DIMENSION_UNKNOWN, fieldPath, 'request dimension is absent; it is not assumed');
    return undefined;
  }
  if (typeof value === 'string' && value.trim().toLowerCase() === UNKNOWN_TOKEN) {
    block(blockers, BLOCKER.UNKNOWN_TOKEN_NOT_COERCIBLE, fieldPath, 'request dimension is the reserved "unknown" token');
    return undefined;
  }
  return value;
}

/**
 * Request-side numeric read. `"12"` is not 12: JavaScript's `*` would coerce it and the age band
 * would appear to match, so a string is refused rather than parsed.
 */
function readRequestNumber(value, fieldPath, blockers) {
  const raw = readRequestValue(value, fieldPath, blockers);
  if (raw === undefined) return undefined;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    block(
      blockers,
      BLOCKER.NON_NUMERIC_VALUE,
      fieldPath,
      `expected a finite number, got ${JSON.stringify(raw)}; strings are never coerced and NaN comparisons would silently pass`,
    );
    return undefined;
  }
  return raw;
}

const DAYS_PER = { days: 1, months: 30.4375, years: 365.25 };

function toDays(value, unit) {
  const factor = DAYS_PER[unit];
  if (factor === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value * factor;
}

function parseDate(value) {
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Resolve the evaluation instant. An unparseable `now` used to become NaN, and because every
 * NaN comparison is false it disabled expiry, not-yet-effective AND staleness in one step — the
 * single most dangerous line in the module. It now fails closed and returns `undefined`, and
 * every check that needs it says so explicitly rather than quietly passing.
 */
function resolveNow(now, blockers) {
  const raw = now ?? new Date();
  const ms = raw instanceof Date ? raw.getTime() : Date.parse(raw);
  if (typeof ms !== 'number' || Number.isNaN(ms)) {
    block(
      blockers,
      BLOCKER.EVALUATION_TIME_INVALID,
      'options.now',
      `evaluation time ${JSON.stringify(now)} is not parseable; expiry, effective-window and staleness cannot be judged, so all three fail closed`,
    );
    return undefined;
  }
  return ms;
}

// ---------------------------------------------------------------------------
// Age bands
// ---------------------------------------------------------------------------

/**
 * Resolve an age band to `[lowDays, highDays)` — lower bound inclusive, upper bound exclusive.
 *
 * An asserted band must be fully bounded. `high: null` used to become `Infinity`, which made
 * `{unit:"years", low:0, high:null}` match every child: one band spanning birth, the two-week
 * mark, and the physiologic nadir at roughly 6–9 weeks, which is the steepest part of the
 * pediatric hemoglobin curve. There is no interval that is correct across that span.
 */
function resolveAgeBand(band, fieldPath, blockers) {
  const unit = readAsserted(band, 'unit', fieldPath, blockers);
  if (unit === undefined) return undefined;
  if (DAYS_PER[unit] === undefined) {
    block(blockers, BLOCKER.AGE_BAND_INVALID, `${fieldPath}.unit`, `age band unit "${unit}" is not one of days/months/years`);
    return undefined;
  }

  if (band.high === null || band.high === undefined) {
    block(
      blockers,
      BLOCKER.AGE_BAND_UNBOUNDED,
      `${fieldPath}.high`,
      'age band has no upper bound; an unbounded band matches every child and cannot carry a single correct interval',
    );
    return undefined;
  }

  const low = readAssertedNumber(band, 'low', fieldPath, blockers);
  const high = readAssertedNumber(band, 'high', fieldPath, blockers);
  if (low === undefined || high === undefined) return undefined;

  const lowDays = toDays(low, unit);
  const highDays = toDays(high, unit);
  if (lowDays === undefined || highDays === undefined) {
    block(blockers, BLOCKER.AGE_BAND_INVALID, fieldPath, 'age band bounds are not resolvable to days');
    return undefined;
  }
  if (!(lowDays < highDays)) {
    block(
      blockers,
      BLOCKER.AGE_BAND_INVALID,
      fieldPath,
      `age band low ${low} ${unit} is not below high ${high} ${unit}; the band is empty or inverted`,
    );
    return undefined;
  }
  return { lowDays, highDays, unit, low, high };
}

function bandContains(band, ageDays) {
  return ageDays >= band.lowDays && ageDays < band.highDays;
}

/**
 * Enforce the site's declared age-band policy on one band: maximum width, and the physiologic
 * boundaries no band may straddle. WHICH boundaries and WHAT maximum width are clinical inputs
 * the laboratory director must specify (charter §2.2a); this function only enforces whatever the
 * profile asserts, and fails closed when the policy itself is unknown.
 */
function checkAgeBandPolicy(policy, band, fieldPath, blockers) {
  if (band === undefined) return;

  const maxWidthDays = readAssertedNumber(policy, 'maxBandWidthDays', 'profile.ageBandPolicy', blockers);
  if (maxWidthDays !== undefined && band.highDays - band.lowDays > maxWidthDays) {
    block(
      blockers,
      BLOCKER.AGE_BAND_TOO_WIDE,
      fieldPath,
      `age band spans ${(band.highDays - band.lowDays).toFixed(1)} days, exceeding the asserted maximum of ${maxWidthDays} days`,
    );
  }

  const boundaries = readAsserted(policy, 'mandatoryBoundaries', 'profile.ageBandPolicy', blockers);
  if (!Array.isArray(boundaries)) {
    if (boundaries !== undefined) {
      block(blockers, BLOCKER.AGE_BAND_POLICY_UNKNOWN, 'profile.ageBandPolicy.mandatoryBoundaries', 'mandatory boundaries are not an array');
    }
    return;
  }
  for (const boundary of boundaries) {
    const boundaryDays = toDays(boundary?.value, boundary?.unit);
    if (boundaryDays === undefined) {
      block(
        blockers,
        BLOCKER.AGE_BAND_POLICY_UNKNOWN,
        'profile.ageBandPolicy.mandatoryBoundaries[]',
        `boundary ${JSON.stringify(boundary)} is not resolvable to days`,
      );
      continue;
    }
    if (boundaryDays > band.lowDays && boundaryDays < band.highDays) {
      block(
        blockers,
        BLOCKER.AGE_BAND_STRADDLES_BOUNDARY,
        fieldPath,
        `age band ${band.low}-${band.high} ${band.unit} straddles the asserted mandatory boundary at ${boundary.value} ${boundary.unit}; a single interval cannot be correct on both sides of it`,
      );
    }
  }
}

/**
 * Require that a set of bands partitions the profile's applicability band exactly: no gaps, no
 * overlaps, and the same outer bounds. A gap means an age with no interval; an overlap means an
 * age with two, and the review found nothing that required either to be absent.
 */
function checkBandPartition(bands, profileBand, fieldPath, blockers) {
  if (bands.length === 0 || profileBand === undefined) return;
  const sorted = [...bands].sort((a, b) => a.lowDays - b.lowDays);

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (current.lowDays < previous.highDays) {
      block(
        blockers,
        BLOCKER.AGE_BAND_OVERLAP,
        fieldPath,
        `age bands ${previous.low}-${previous.high} ${previous.unit} and ${current.low}-${current.high} ${current.unit} overlap; an age in the overlap has two candidate intervals`,
      );
    } else if (current.lowDays > previous.highDays) {
      block(
        blockers,
        BLOCKER.AGE_BAND_GAP,
        fieldPath,
        `age bands ${previous.low}-${previous.high} ${previous.unit} and ${current.low}-${current.high} ${current.unit} leave a gap; an age in the gap has no interval`,
      );
    }
  }

  if (sorted[0].lowDays > profileBand.lowDays) {
    block(
      blockers,
      BLOCKER.AGE_BAND_GAP,
      fieldPath,
      `age bands start at ${sorted[0].low} ${sorted[0].unit} but the profile asserts applicability from ${profileBand.low} ${profileBand.unit}`,
    );
  }
  const last = sorted[sorted.length - 1];
  if (last.highDays < profileBand.highDays) {
    block(
      blockers,
      BLOCKER.AGE_BAND_GAP,
      fieldPath,
      `age bands end at ${last.high} ${last.unit} but the profile asserts applicability to ${profileBand.high} ${profileBand.unit}`,
    );
  }
}

/** Lifecycle checks shared by both profile kinds. */
function checkLifecycle(lifecycle, nowMs, blockers, label) {
  if (lifecycle.reviewState === 'superseded') {
    if (!lifecycle.supersededBy) {
      block(
        blockers,
        BLOCKER.PROFILE_SUPERSEDED_WITHOUT_SUCCESSOR,
        `${label}.lifecycle.supersededBy`,
        'profile is superseded but names no successor; the authority chain is dangling',
      );
    } else {
      block(
        blockers,
        BLOCKER.PROFILE_NOT_ACTIVE,
        `${label}.lifecycle.reviewState`,
        `profile is superseded by ${lifecycle.supersededBy.profileId}@${lifecycle.supersededBy.profileVersion}`,
      );
    }
  } else if (lifecycle.reviewState === 'expired') {
    block(blockers, BLOCKER.PROFILE_EXPIRED, `${label}.lifecycle.reviewState`, 'profile review state is expired');
  } else if (lifecycle.reviewState !== 'active') {
    block(
      blockers,
      BLOCKER.PROFILE_NOT_ACTIVE,
      `${label}.lifecycle.reviewState`,
      `profile review state is "${lifecycle.reviewState}"; only "active" is eligible`,
    );
  }

  const start = parseDate(lifecycle.effectiveStart);
  if (start === undefined) {
    block(blockers, BLOCKER.DIMENSION_NOT_SUPPLIED, `${label}.lifecycle.effectiveStart`, 'effective start is absent');
  } else if (nowMs !== undefined && nowMs < start) {
    block(blockers, BLOCKER.PROFILE_NOT_YET_EFFECTIVE, `${label}.lifecycle.effectiveStart`, 'profile is not yet effective');
  }

  const end = parseDate(lifecycle.effectiveEnd);
  if (end !== undefined && nowMs !== undefined && nowMs > end) {
    block(blockers, BLOCKER.PROFILE_EXPIRED, `${label}.lifecycle.effectiveEnd`, 'profile effective period has ended');
  }

  // Staleness is checked independently of effectiveEnd: a profile with no scheduled end is not
  // thereby perpetual. An unreviewed profile is stale even while nominally "active".
  const lastReviewed = parseDate(lifecycle.lastReviewedOn);
  if (lifecycle.reviewIntervalDays === null || lifecycle.reviewIntervalDays === undefined) {
    block(
      blockers,
      BLOCKER.REVIEW_CADENCE_UNKNOWN,
      `${label}.lifecycle.reviewIntervalDays`,
      'review cadence is unknown; staleness cannot be established, so the profile fails closed',
    );
  } else if (lastReviewed === undefined) {
    block(blockers, BLOCKER.DIMENSION_NOT_SUPPLIED, `${label}.lifecycle.lastReviewedOn`, 'last review date is absent');
  } else if (nowMs !== undefined && nowMs - lastReviewed > lifecycle.reviewIntervalDays * 86_400_000) {
    block(
      blockers,
      BLOCKER.PROFILE_STALE,
      `${label}.lifecycle.lastReviewedOn`,
      `profile last reviewed ${lifecycle.lastReviewedOn}, exceeding its ${lifecycle.reviewIntervalDays}-day review interval`,
    );
  }
}

function checkCandidateBinding(boundCandidate, requestCandidate, blockers, label) {
  const digest = readAsserted(boundCandidate, 'candidateDigest', `${label}.boundCandidate`, blockers);
  if (digest === undefined) return;
  const requested = readRequestValue(requestCandidate?.candidateDigest, 'request.candidate.candidateDigest', blockers);
  if (requested === undefined) return;
  if (digest !== requested) {
    block(
      blockers,
      BLOCKER.CANDIDATE_BINDING_MISMATCH,
      `${label}.boundCandidate.candidateDigest`,
      `profile is bound to ${digest} but evaluation requested ${requested}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Reference interval profile
// ---------------------------------------------------------------------------

export async function validateReferenceIntervalProfile(profile) {
  const errors = validate(await loadReferenceIntervalSchema(), profile);
  return {
    ok: errors.length === 0,
    errors,
    // Restated at every boundary because it is the single most dangerous inference a caller
    // could make from a green structural check.
    note: 'structural validity does not imply clinical validity or local applicability',
  };
}

/**
 * Decide whether `profile` may supply a reference interval for `request`.
 * Returns a Decision; never a bare boolean, never a fallback interval.
 */
export function evaluateReferenceIntervalApplicability(profile, request, options = {}) {
  const blockers = [];
  const label = 'profile';
  const nowMs = resolveNow(options.now, blockers);

  if (profile === null || typeof profile !== 'object') {
    block(blockers, BLOCKER.STRUCTURALLY_INVALID, label, 'profile is absent or not an object');
    return decision(blockers);
  }
  if (request === null || typeof request !== 'object') {
    block(blockers, BLOCKER.STRUCTURALLY_INVALID, 'request', 'request is absent or not an object');
    return decision(blockers);
  }

  const lifecycle = requireSection(profile, 'lifecycle', `${label}.lifecycle`, blockers);
  if (lifecycle !== undefined) checkLifecycle(lifecycle, nowMs, blockers, label);
  checkCandidateBinding(profile.boundCandidate, request.candidate, blockers, label);

  const applicability = requireSection(profile, 'applicability', `${label}.applicability`, blockers);
  const ageBandPolicy = requireSection(profile, 'ageBandPolicy', `${label}.ageBandPolicy`, blockers);
  if (applicability === undefined || ageBandPolicy === undefined) return decision(blockers);

  const populationId = readAsserted(applicability.population, 'populationId', `${label}.applicability.population`, blockers);
  const requestPopulation = readRequestValue(request.populationId, 'request.populationId', blockers);
  if (populationId !== undefined && requestPopulation !== undefined && populationId !== requestPopulation) {
    block(
      blockers,
      BLOCKER.POPULATION_MISMATCH,
      `${label}.applicability.population.populationId`,
      `profile asserts population "${populationId}" but the request is for "${requestPopulation}"`,
    );
  }

  // Age band. Intervals for a neonate and a school-age child are not interchangeable, so an age
  // outside the asserted band is a mismatch, not an extrapolation.
  // The profile-level band is the OUTER ENVELOPE of applicability. The width and boundary policy
  // deliberately does NOT apply to it: it exists to be partitioned by the interval bands, and
  // those are what the policy constrains. Applying the policy here would forbid a profile from
  // covering any range wider than one band.
  const profileBand = resolveAgeBand(applicability.ageBand, `${label}.applicability.ageBand`, blockers);

  const requestAge = readRequestNumber(request.ageValue, 'request.ageValue', blockers);
  const requestAgeUnit = readRequestValue(request.ageUnit, 'request.ageUnit', blockers);
  let requestAgeDays;
  if (requestAge !== undefined && requestAgeUnit !== undefined) {
    requestAgeDays = toDays(requestAge, requestAgeUnit);
    if (requestAgeDays === undefined) {
      block(blockers, BLOCKER.AGE_BAND_MISMATCH, 'request.ageUnit', `request age unit "${requestAgeUnit}" is not one of days/months/years`);
    } else if (profileBand !== undefined && !bandContains(profileBand, requestAgeDays)) {
      block(
        blockers,
        BLOCKER.AGE_BAND_MISMATCH,
        `${label}.applicability.ageBand`,
        `request age ${requestAge} ${requestAgeUnit} falls outside the asserted band`,
      );
    }
  }

  checkGestationalAge(applicability.gestationalAge, request, blockers, label);

  const profileSex = readAsserted(applicability.sex, 'value', `${label}.applicability.sex`, blockers);
  const requestSex = readRequestValue(request.sex, 'request.sex', blockers);
  if (profileSex !== undefined && requestSex !== undefined && profileSex !== 'any' && profileSex !== requestSex) {
    block(blockers, BLOCKER.SEX_MISMATCH, `${label}.applicability.sex.value`, `profile asserts sex "${profileSex}", request is "${requestSex}"`);
  }

  const specimenCode = readAsserted(applicability.specimen, 'code', `${label}.applicability.specimen`, blockers);
  const requestSpecimen = readRequestValue(request.specimen?.code, 'request.specimen.code', blockers);
  if (specimenCode !== undefined && requestSpecimen !== undefined && specimenCode !== requestSpecimen) {
    block(
      blockers,
      BLOCKER.SPECIMEN_MISMATCH,
      `${label}.applicability.specimen.code`,
      `profile asserts specimen "${specimenCode}" but the request specimen is "${requestSpecimen}"`,
    );
  }

  // Analyzer and method are checked separately because they fail independently: the same
  // analyzer running a different method yields different intervals. BOTH now go through
  // readAsserted — previously `method` was read straight off the object, so a null method was
  // compared as a value instead of being refused as an unasserted dimension.
  const analyzerModel = readAsserted(applicability.analyzer, 'model', `${label}.applicability.analyzer`, blockers);
  const analyzerMethod = readAsserted(applicability.analyzer, 'method', `${label}.applicability.analyzer`, blockers);
  const requestModel = readRequestValue(request.analyzer?.model, 'request.analyzer.model', blockers);
  const requestMethod = readRequestValue(request.analyzer?.method, 'request.analyzer.method', blockers);
  if (analyzerModel !== undefined && requestModel !== undefined && analyzerModel !== requestModel) {
    block(
      blockers,
      BLOCKER.ANALYZER_MISMATCH,
      `${label}.applicability.analyzer.model`,
      `profile asserts analyzer "${analyzerModel}" but the request reports "${requestModel}"`,
    );
  }
  if (analyzerMethod !== undefined && requestMethod !== undefined && analyzerMethod !== requestMethod) {
    block(
      blockers,
      BLOCKER.METHOD_MISMATCH,
      `${label}.applicability.analyzer.method`,
      `profile asserts method "${analyzerMethod}" but the request reports "${requestMethod}"`,
    );
  }

  // Altitude shifts hemoglobin intervals, so it is a first-class dimension rather than a note.
  // Both bounds are read as asserted numbers: `?? -Infinity` / `?? Infinity` used to make a
  // null-bounded altitude match everything, which is exactly "sea level is assumed" by another
  // route.
  const altitudeLow = readAssertedNumber(applicability.altitude, 'metersLow', `${label}.applicability.altitude`, blockers);
  const altitudeHigh = readAssertedNumber(applicability.altitude, 'metersHigh', `${label}.applicability.altitude`, blockers);
  const requestAltitude = readRequestNumber(request.altitudeMeters, 'request.altitudeMeters', blockers);
  if (altitudeLow !== undefined && altitudeHigh !== undefined && requestAltitude !== undefined) {
    if (requestAltitude < altitudeLow || requestAltitude > altitudeHigh) {
      block(
        blockers,
        BLOCKER.ALTITUDE_MISMATCH,
        `${label}.applicability.altitude`,
        `request altitude ${requestAltitude} m falls outside the asserted ${altitudeLow}-${altitudeHigh} m range`,
      );
    }
  }

  // The unit system is profile-wide; the unit CODE belongs to the analyte (C1). A CBC reports
  // hemoglobin in g/dL, hematocrit in %, MCV in fL, RBC in 10*12/L, platelets in 10*9/L and
  // reticulocytes in %, so a single profile-level unit code made a CBC inexpressible: any real
  // profile covered exactly one analyte or self-blocked on every other.
  readAsserted(profile.unitSystem, 'system', `${label}.unitSystem`, blockers);

  evaluateIntervals({
    profile,
    request,
    requestSex,
    requestAgeDays,
    profileBand,
    ageBandPolicy,
    blockers,
    label,
  });

  if (profile.provenance?.derivation === 'transferred_unverified') {
    block(
      blockers,
      BLOCKER.DERIVATION_NOT_LOCALLY_VERIFIED,
      `${label}.provenance.derivation`,
      'intervals were transferred from another source without local verification',
    );
  }

  return decision(blockers);
}

/**
 * Corrected / gestational age (C2). For pediatric anemia this is the largest single dimension the
 * chronological-age model cannot express: a 4-week-old born at 27 weeks and one born at 40 weeks
 * are not the same patient, because anemia of prematurity has a different nadir, depth and
 * timing. WHEN corrected age is required, and over WHICH gestational ages a profile applies, are
 * owner-held clinical inputs (charter §2.2b). This function enforces the profile's own assertion
 * and fails closed when a required corrected age is not supplied.
 */
function checkGestationalAge(gestationalAge, request, blockers, label) {
  const fieldPath = `${label}.applicability.gestationalAge`;
  const required = readAsserted(gestationalAge, 'correctedAgeRequired', fieldPath, blockers);
  if (required === undefined) return;

  const low = readAssertedNumber(gestationalAge, 'gestationalAgeWeeksLow', fieldPath, blockers);
  const high = readAssertedNumber(gestationalAge, 'gestationalAgeWeeksHigh', fieldPath, blockers);

  if (required !== true) {
    // A deliberate assertion that this profile does not depend on gestational age. It is an
    // assertion, not an omission: `not_supplied` would have failed closed above.
    return;
  }

  const supplied = request.gestationalAgeAtBirthWeeks;
  if (supplied === null || supplied === undefined) {
    block(
      blockers,
      BLOCKER.CORRECTED_AGE_REQUIRED_NOT_SUPPLIED,
      'request.gestationalAgeAtBirthWeeks',
      'the profile asserts that corrected age is required, but the request supplies no gestational age at birth; chronological age alone cannot identify the patient',
    );
    return;
  }
  const weeks = readRequestNumber(supplied, 'request.gestationalAgeAtBirthWeeks', blockers);
  if (weeks === undefined || low === undefined || high === undefined) return;
  if (weeks < low || weeks > high) {
    block(
      blockers,
      BLOCKER.GESTATIONAL_AGE_MISMATCH,
      fieldPath,
      `request gestational age at birth ${weeks} weeks falls outside the asserted ${low}-${high} week applicability range`,
    );
  }
}

/**
 * Interval and critical-value selection for the requested analyte.
 *
 * Absence is a blocker, not a cue to fall back to a published interval. Every interval's OWN age
 * band and sex are now matched — previously only the profile-level band was checked, so a
 * 0-to-14-day interval could be delivered for a twelve-month-old with zero blockers.
 */
function evaluateIntervals({ profile, request, requestSex, requestAgeDays, profileBand, ageBandPolicy, blockers, label }) {
  const requestAnalyteCode = readRequestValue(request.analyteCode?.code, 'request.analyteCode.code', blockers);
  const requestUnit = readRequestValue(request.unitCode, 'request.unitCode', blockers);
  if (requestAnalyteCode === undefined) return;

  const intervals = Array.isArray(profile.intervals) ? profile.intervals : [];
  const forAnalyte = intervals.filter(
    (interval) => interval?.assertion === 'asserted' && interval?.analyteCode?.assertion === 'asserted' && interval.analyteCode.code === requestAnalyteCode,
  );

  if (forAnalyte.length === 0) {
    block(
      blockers,
      BLOCKER.INTERVAL_MISSING,
      `${label}.intervals`,
      `no asserted interval for analyte code "${requestAnalyteCode}"; this profile does not cover it`,
    );
    return;
  }

  // Every interval for the analyte must agree on its unit. This catches an internally
  // inconsistent profile even when the inconsistent band is not the one the request selects.
  const analyteUnits = new Set(forAnalyte.map((interval) => interval.unitCode));
  if (analyteUnits.size > 1) {
    block(
      blockers,
      BLOCKER.UNIT_MISMATCH,
      `${label}.intervals[].unitCode`,
      `intervals for "${requestAnalyteCode}" declare conflicting units [${[...analyteUnits].join(', ')}]; units are never auto-converted`,
    );
  }

  const analyteUnit = forAnalyte[0].unitCode;
  if (analyteUnit === null || analyteUnit === undefined) {
    block(blockers, BLOCKER.DIMENSION_NOT_SUPPLIED, `${label}.intervals[].unitCode`, `interval for "${requestAnalyteCode}" declares no unit code`);
  } else if (requestUnit !== undefined && analyteUnit !== requestUnit) {
    block(
      blockers,
      BLOCKER.UNIT_MISMATCH,
      `${label}.intervals[].unitCode`,
      `the interval for "${requestAnalyteCode}" is in "${analyteUnit}" but the request reports "${requestUnit}"; units are never auto-converted`,
    );
  }

  // Age-band structure for this analyte: bounded, well-formed, within policy, and partitioning
  // the profile's applicability band without gaps or overlaps.
  const resolvedBands = [];
  for (const [index, interval] of forAnalyte.entries()) {
    const fieldPath = `${label}.intervals[${index}].ageBand`;
    const band = resolveAgeBand(interval.ageBand, fieldPath, blockers);
    checkAgeBandPolicy(ageBandPolicy, band, fieldPath, blockers);
    if (band !== undefined) resolvedBands.push({ band, interval });

    if (interval.low === null || interval.low === undefined || interval.high === null || interval.high === undefined) {
      block(
        blockers,
        BLOCKER.INTERVAL_BOUNDS_MISSING,
        `${label}.intervals[${index}]`,
        `interval for "${interval.analyte}" has no lower and/or upper bound; an interval with no bounds cannot classify any value`,
      );
    } else if (typeof interval.low !== 'number' || typeof interval.high !== 'number' || !Number.isFinite(interval.low) || !Number.isFinite(interval.high)) {
      block(blockers, BLOCKER.NON_NUMERIC_VALUE, `${label}.intervals[${index}]`, `interval bounds must be finite numbers`);
    } else if (interval.low >= interval.high) {
      block(
        blockers,
        BLOCKER.INTERVAL_BOUNDS_INVALID,
        `${label}.intervals[${index}]`,
        `interval for "${interval.analyte}" has low ${interval.low} >= high ${interval.high}; the interval is empty or inverted`,
      );
    }

    if (interval.sex === null || interval.sex === undefined) {
      block(
        blockers,
        BLOCKER.DIMENSION_NOT_SUPPLIED,
        `${label}.intervals[${index}].sex`,
        'interval sex is null; a null sex is not a wildcard. "any" must be a deliberate assertion that the interval does not vary by sex in this band.',
      );
    }
  }

  const sexApplicable = resolvedBands.filter(
    ({ interval }) => interval.sex === 'any' || requestSex === undefined || interval.sex === requestSex,
  );
  checkBandPartition(sexApplicable.map((entry) => entry.band), profileBand, `${label}.intervals[].ageBand`, blockers);

  if (requestAgeDays === undefined) return;

  const ageMatched = resolvedBands.filter(({ band }) => bandContains(band, requestAgeDays));
  if (ageMatched.length === 0) {
    block(
      blockers,
      BLOCKER.AGE_BAND_MISMATCH,
      `${label}.intervals[].ageBand`,
      `no interval for "${requestAnalyteCode}" covers the request age; an interval band is matched on its own bounds, never on the profile-level band alone`,
    );
    return;
  }

  const matches = ageMatched.filter(({ interval }) => interval.sex === 'any' || requestSex === undefined || interval.sex === requestSex);
  if (matches.length === 0) {
    block(
      blockers,
      BLOCKER.SEX_MISMATCH,
      `${label}.intervals[].sex`,
      `intervals for "${requestAnalyteCode}" at the request age are sex-specific and none matches the request sex "${requestSex}"`,
    );
    return;
  }

  const distinct = new Set(matches.map(({ interval }) => JSON.stringify([interval.low, interval.high, interval.unitCode])));
  if (distinct.size > 1) {
    block(
      blockers,
      BLOCKER.INTERVAL_CONFLICT,
      `${label}.intervals`,
      `${matches.length} asserted intervals for "${requestAnalyteCode}" disagree; a conflict is never resolved by picking one`,
    );
  }

  evaluateCriticalValues({ profile, requestAnalyteCode, requestAgeDays, analyteUnit, ageBandPolicy, blockers, label });
}

/**
 * Critical values (C11). The schema has required `criticalValues[]` since P3 landed, and grep
 * confirmed zero references to it in either implementation: the panic threshold was modelled and
 * never consulted. An urgent alert must dominate routine interval logic, so a profile that
 * cannot supply an asserted, unit-consistent, unambiguous critical value covering the request age
 * fails closed rather than quietly returning only the reference interval.
 */
function evaluateCriticalValues({ profile, requestAnalyteCode, requestAgeDays, analyteUnit, ageBandPolicy, blockers, label }) {
  const criticalValues = Array.isArray(profile.criticalValues) ? profile.criticalValues : [];
  const forAnalyte = criticalValues.filter((entry) => entry?.analyteCode?.code === requestAnalyteCode);

  if (forAnalyte.length === 0) {
    block(
      blockers,
      BLOCKER.CRITICAL_VALUE_MISSING,
      `${label}.criticalValues`,
      `no critical-value threshold for analyte "${requestAnalyteCode}"; an empty or absent entry asserts that none is supplied, never that none exists, so the panic threshold is unknown and the profile fails closed`,
    );
    return;
  }

  const covering = [];
  for (const [index, entry] of forAnalyte.entries()) {
    const fieldPath = `${label}.criticalValues[${index}]`;
    if (entry.assertion !== 'asserted') {
      block(
        blockers,
        BLOCKER.CRITICAL_VALUE_NOT_ASSERTED,
        `${fieldPath}.assertion`,
        `critical value for "${requestAnalyteCode}" is not asserted (assertion is "${entry.assertion}")`,
      );
      continue;
    }
    const band = resolveAgeBand(entry.ageBand, `${fieldPath}.ageBand`, blockers);
    checkAgeBandPolicy(ageBandPolicy, band, `${fieldPath}.ageBand`, blockers);
    if (band === undefined || !bandContains(band, requestAgeDays)) continue;

    if (analyteUnit !== undefined && entry.unitCode !== analyteUnit) {
      block(
        blockers,
        BLOCKER.CRITICAL_VALUE_UNIT_MISMATCH,
        `${fieldPath}.unitCode`,
        `critical value for "${requestAnalyteCode}" is in "${entry.unitCode}" but its reference interval is in "${analyteUnit}"; a panic threshold compared in the wrong unit is a factor-of-ten error on an urgent alert`,
      );
    }
    if ((entry.criticalLow === null || entry.criticalLow === undefined) && (entry.criticalHigh === null || entry.criticalHigh === undefined)) {
      block(
        blockers,
        BLOCKER.CRITICAL_VALUE_BOUNDS_MISSING,
        fieldPath,
        `critical value for "${requestAnalyteCode}" declares neither a critical low nor a critical high; it can never fire`,
      );
    }
    covering.push(entry);
  }

  if (covering.length === 0) {
    block(
      blockers,
      BLOCKER.CRITICAL_VALUE_MISSING,
      `${label}.criticalValues`,
      `no asserted critical-value threshold for "${requestAnalyteCode}" covers the request age; the panic threshold at this age is unknown`,
    );
    return;
  }

  const distinct = new Set(covering.map((entry) => JSON.stringify([entry.criticalLow, entry.criticalHigh, entry.unitCode])));
  if (distinct.size > 1) {
    block(
      blockers,
      BLOCKER.CRITICAL_VALUE_CONFLICT,
      `${label}.criticalValues`,
      `${covering.length} asserted critical values for "${requestAnalyteCode}" at the request age disagree; a panic threshold conflict is never resolved by picking one`,
    );
  }
}

// ---------------------------------------------------------------------------
// Terminology profile
// ---------------------------------------------------------------------------

export async function validateTerminologyProfile(profile) {
  const errors = validate(await loadTerminologyProfileSchema(), profile);
  return {
    ok: errors.length === 0,
    errors,
    note: 'structural validity does not imply clinical validity or local applicability',
  };
}

/**
 * Position of each state in the Observation lifecycle, used only to detect an out-of-order
 * lineage. `unknown` is deliberately absent: it has no defined position, so a lineage containing
 * it cannot be proven ordered and fails closed.
 */
const OBSERVATION_STATUS_RANK = {
  registered: 0,
  preliminary: 1,
  final: 2,
  amended: 3,
  corrected: 3,
  cancelled: 4,
  'entered-in-error': 5,
};

const REVISION_STATES = new Set(['corrected', 'amended']);

/**
 * Decide whether `observation` is interpretable under `profile`.
 * `observation.statusLineage` must prove that no correction or amendment was dropped in transit;
 * an incomplete or absent lineage is a hard failure, never a warning.
 */
export function evaluateTerminologyApplicability(profile, observation, options = {}) {
  const blockers = [];
  const label = 'terminologyProfile';
  const nowMs = resolveNow(options.now, blockers);

  if (profile === null || typeof profile !== 'object') {
    block(blockers, BLOCKER.STRUCTURALLY_INVALID, label, 'profile is absent or not an object');
    return decision(blockers);
  }
  if (observation === null || typeof observation !== 'object') {
    block(blockers, BLOCKER.STRUCTURALLY_INVALID, 'observation', 'observation is absent or not an object');
    return decision(blockers);
  }

  const lifecycle = requireSection(profile, 'lifecycle', `${label}.lifecycle`, blockers);
  if (lifecycle !== undefined) checkLifecycle(lifecycle, nowMs, blockers, label);
  checkCandidateBinding(profile.boundCandidate, observation.candidate, blockers, label);

  const policy = requireSection(profile, 'resultStatusPolicy', `${label}.resultStatusPolicy`, blockers);
  const requirements = requireSection(profile, 'observationRequirements', `${label}.observationRequirements`, blockers);
  if (policy === undefined || requirements === undefined) return decision(blockers);

  checkResultStatus(policy, observation, blockers);
  checkStatusLineage(observation, blockers);
  checkObservationRequirements(requirements, observation, nowMs, blockers, label);
  checkLocalMapping(profile, observation, blockers, label);

  return decision(blockers);
}

/**
 * Result status. The value set is bound to a resource type (F7): `partial` and `appended` are
 * DiagnosticReport statuses, not Observation statuses, and permitting `appended` in
 * `acceptedForDecision` allowed a site to accept a status its observations cannot legally carry.
 *
 * The single RESULT_STATUS_BLOCKED code is split, because the five situations it covered demand
 * three different actions from a human: wait for the result (`registered`), re-order it
 * (`cancelled`), or discard what is on screen (`entered-in-error`).
 */
function checkResultStatus(policy, observation, blockers) {
  const expectedResourceType = policy.resourceType;
  const actualResourceType = observation.resourceType;
  if (actualResourceType === null || actualResourceType === undefined) {
    block(
      blockers,
      BLOCKER.RESOURCE_TYPE_MISSING,
      'observation.resourceType',
      'observation declares no resource type; a status value set is only meaningful bound to one, and Observation.status and DiagnosticReport.status are different value sets',
    );
  } else if (expectedResourceType !== undefined && actualResourceType !== expectedResourceType) {
    block(
      blockers,
      BLOCKER.RESOURCE_TYPE_UNSUPPORTED,
      'observation.resourceType',
      `this profile binds its status value set to "${expectedResourceType}" but the resource is a "${actualResourceType}"`,
    );
  }

  const status = observation.status;
  const recognized = Array.isArray(policy.recognizedStates) ? policy.recognizedStates : [];
  const accepted = Array.isArray(policy.acceptedForDecision) ? policy.acceptedForDecision : [];
  const blocking = Array.isArray(policy.blockingStates) ? policy.blockingStates : [];

  if (status === null || status === undefined) {
    block(blockers, BLOCKER.RESULT_STATUS_MISSING, 'observation.status', 'observation carries no result status');
    return;
  }
  if (status === UNKNOWN_TOKEN) {
    block(blockers, BLOCKER.RESULT_STATUS_UNKNOWN, 'observation.status', 'result status is explicitly unknown; it is not assumed final');
    return;
  }
  if (!recognized.includes(status)) {
    block(
      blockers,
      BLOCKER.RESULT_STATUS_UNRECOGNIZED,
      'observation.status',
      `status "${status}" is not recognized by this profile and cannot be interpreted`,
    );
    return;
  }

  // `entered-in-error` is a RETRACTION, not merely a non-decision-grade status. The value must
  // not be displayed or retained for interpretation at all — a materially different obligation
  // from "do not base a decision on it", and one a shared blocker code could not express.
  if (status === 'entered-in-error') {
    block(
      blockers,
      BLOCKER.RESULT_RETRACTED_ENTERED_IN_ERROR,
      'observation.status',
      'this result is RETRACTED (entered-in-error). It must not be displayed, retained, or interpreted; it is not a result that merely failed to qualify for decision use.',
    );
    return;
  }
  if (status === 'cancelled') {
    block(
      blockers,
      BLOCKER.RESULT_CANCELLED_NEVER_PERFORMED,
      'observation.status',
      'this observation was cancelled and never performed; there is no value to interpret and a replacement must be ordered',
    );
    return;
  }
  if (status === 'registered') {
    block(
      blockers,
      BLOCKER.RESULT_NOT_YET_AVAILABLE,
      'observation.status',
      'this observation is registered but no result has been reported yet; the correct action is to wait, not to re-order or to discard',
    );
    return;
  }
  if (blocking.includes(status)) {
    block(
      blockers,
      BLOCKER.RESULT_STATUS_BLOCKING_STATE,
      'observation.status',
      `status "${status}" is a blocking state declared by this profile; a ${status} result is not a final result`,
    );
    return;
  }
  if (!accepted.includes(status)) {
    block(
      blockers,
      BLOCKER.RESULT_STATUS_NOT_ACCEPTED_FOR_DECISION,
      'observation.status',
      `status "${status}" is recognized and not blocking, but this profile does not accept it for decision use`,
    );
  }
}

/**
 * Status lineage: the dropped-correction check.
 *
 * A `final` result that was later corrected or amended is the dangerous case: the value on hand
 * looks authoritative while a superseding value exists. We therefore require positive proof of a
 * complete lineage rather than accepting silence as "nothing was corrected".
 *
 * The direction of the superseding-reference requirement is now correct. Previously the code
 * demanded a superseding observation whenever a revision appeared in the lineage — including for
 * a result whose OWN status is `corrected` and which IS the latest version, where by definition
 * no superseding observation exists. The requirement belongs on the result that is NOT the
 * revision. A `null` reference is also treated as unresolvable; the old `=== undefined` test let
 * an explicit `null` through, which is the exact value the base fixture carried.
 */
function checkStatusLineage(observation, blockers) {
  const lineage = observation.statusLineage;
  if (!lineage || lineage.complete !== true) {
    block(
      blockers,
      BLOCKER.STATUS_LINEAGE_INCOMPLETE,
      'observation.statusLineage.complete',
      'status lineage is absent or incomplete; a dropped correction or amendment cannot be ruled out',
    );
    return;
  }

  const states = Array.isArray(lineage.states) ? lineage.states : [];
  if (states.length === 0) {
    block(blockers, BLOCKER.STATUS_LINEAGE_INCOMPLETE, 'observation.statusLineage.states', 'status lineage records no states at all');
    return;
  }

  const status = observation.status;

  // The current status must actually appear in the lineage it claims to be the end of.
  if (status !== null && status !== undefined && status !== UNKNOWN_TOKEN && !states.includes(status)) {
    block(
      blockers,
      BLOCKER.STATUS_NOT_IN_LINEAGE,
      'observation.statusLineage.states',
      `current status "${status}" does not appear in the lineage [${states.join(' → ')}]; the lineage does not describe this observation`,
    );
  }

  // The lineage must be ordered. An unordered lineage cannot establish which state is current,
  // which is the only thing it exists to prove.
  for (let i = 1; i < states.length; i += 1) {
    const previousRank = OBSERVATION_STATUS_RANK[states[i - 1]];
    const currentRank = OBSERVATION_STATUS_RANK[states[i]];
    if (previousRank === undefined || currentRank === undefined) {
      block(
        blockers,
        BLOCKER.STATUS_LINEAGE_OUT_OF_ORDER,
        'observation.statusLineage.states',
        `lineage state "${previousRank === undefined ? states[i - 1] : states[i]}" has no defined position in the Observation lifecycle, so the lineage cannot be proven ordered`,
      );
      return;
    }
    if (currentRank < previousRank) {
      block(
        blockers,
        BLOCKER.STATUS_LINEAGE_OUT_OF_ORDER,
        'observation.statusLineage.states',
        `lineage [${states.join(' → ')}] moves backwards from "${states[i - 1]}" to "${states[i]}"; the current state cannot be established from an unordered lineage`,
      );
      return;
    }
  }

  const hasRevision = states.some((state) => REVISION_STATES.has(state));
  const isRevision = REVISION_STATES.has(status);
  const rawRef = lineage.supersedingObservationRef;
  const refResolvable = typeof rawRef === 'string' && rawRef.trim().length > 0;

  if (refResolvable && observation.id !== undefined && observation.id !== null && rawRef === observation.id) {
    block(
      blockers,
      BLOCKER.SUPERSEDING_REFERENCE_SELF,
      'observation.statusLineage.supersedingObservationRef',
      'the superseding observation reference points at this same observation; a self-reference resolves nothing and hides whatever actually superseded it',
    );
    return;
  }

  if (hasRevision && !isRevision) {
    block(
      blockers,
      BLOCKER.CORRECTION_UNRESOLVED,
      'observation.statusLineage.states',
      `lineage records a corrected/amended revision but the current status is "${status}"; the revision was lost in transit and the value in hand reads authoritative while a superseding value exists`,
    );
    if (!refResolvable) {
      block(
        blockers,
        BLOCKER.SUPERSEDING_REFERENCE_UNRESOLVABLE,
        'observation.statusLineage.supersedingObservationRef',
        `a correction/amendment is recorded but the superseding observation reference is ${JSON.stringify(rawRef)}; an absent or null reference is unresolvable, not "no correction"`,
      );
    }
    return;
  }

  if (isRevision && refResolvable) {
    // This observation is itself a revision AND something supersedes it: it is not the latest
    // version, so the value in hand is stale in the most dangerous way.
    block(
      blockers,
      BLOCKER.OBSERVATION_SUPERSEDED,
      'observation.statusLineage.supersedingObservationRef',
      `this ${status} observation is itself superseded by ${rawRef}; it is not the latest version and must not be interpreted`,
    );
  }
}

function checkObservationRequirements(requirements, observation, nowMs, blockers, label) {
  if (requirements.requireEffectiveTime && !observation.effectiveDateTime) {
    block(blockers, BLOCKER.EFFECTIVE_TIME_MISSING, 'observation.effectiveDateTime', 'effective time is required and absent');
  }
  if (requirements.requireIssuedTime && !observation.issuedDateTime) {
    block(blockers, BLOCKER.ISSUED_TIME_MISSING, 'observation.issuedDateTime', 'issued time is required and absent');
  }
  if (requirements.requireSpecimen && !observation.specimenCode) {
    block(blockers, BLOCKER.SPECIMEN_MISSING, 'observation.specimenCode', 'specimen is required and absent');
  }
  if (requirements.requireUnit && !observation.unitCode) {
    block(blockers, BLOCKER.UNIT_MISSING, 'observation.unitCode', 'unit is required and absent');
  }

  if (requirements.maxResultAgeDays === null || requirements.maxResultAgeDays === undefined) {
    block(
      blockers,
      BLOCKER.STALENESS_POLICY_UNKNOWN,
      `${label}.observationRequirements.maxResultAgeDays`,
      'staleness policy is unknown; result age cannot be judged, so the observation fails closed',
    );
    return;
  }
  const effective = parseDate(observation.effectiveDateTime);
  if (effective !== undefined && nowMs !== undefined && nowMs - effective > requirements.maxResultAgeDays * 86_400_000) {
    block(
      blockers,
      BLOCKER.RESULT_STALE,
      'observation.effectiveDateTime',
      `result is older than the ${requirements.maxResultAgeDays}-day staleness limit`,
    );
  }
}

function checkLocalMapping(profile, observation, blockers, label) {
  const allMappings = Array.isArray(profile.localMappings) ? profile.localMappings : [];
  // `.find` resolved a conflict by first-match: two mappings for the same local code with
  // different standard codes, units, or equivalences silently produced whichever was declared
  // first. Collect ALL candidates and refuse when they disagree.
  const candidates = allMappings.filter(
    (entry) => entry?.localCode === observation.localCode && entry?.localSystem === observation.localSystem,
  );

  if (candidates.length === 0) {
    block(
      blockers,
      BLOCKER.UNMAPPED_LOCAL_CODE,
      `${label}.localMappings`,
      `local code "${observation.localCode}" in system "${observation.localSystem}" has no mapping; it is not interpretable`,
    );
    return;
  }

  if (candidates.length > 1) {
    const distinct = new Set(
      candidates.map((entry) => JSON.stringify([entry.standardCode, entry.standardSystem, entry.standardSystemVersion, entry.unitCode, entry.specimenCode, entry.equivalence])),
    );
    if (distinct.size > 1) {
      block(
        blockers,
        BLOCKER.MAPPING_CONFLICT,
        `${label}.localMappings`,
        `${candidates.length} mappings for local code "${observation.localCode}" disagree on standard code, unit, specimen or equivalence; a mapping conflict is never resolved by declaration order`,
      );
      return;
    }
  }

  const mapping = candidates[0];

  if (mapping.assertion !== 'asserted') {
    block(
      blockers,
      mapping.assertion === UNKNOWN_TOKEN ? BLOCKER.UNKNOWN_DIMENSION : BLOCKER.DIMENSION_NOT_SUPPLIED,
      `${label}.localMappings[].assertion`,
      `mapping for "${observation.localCode}" is not asserted`,
    );
  }
  if (mapping.equivalence !== 'equivalent') {
    block(
      blockers,
      BLOCKER.MAPPING_EQUIVALENCE_NOT_EXACT,
      `${label}.localMappings[].equivalence`,
      `mapping equivalence is "${mapping.equivalence}"; only "equivalent" supports decision use`,
    );
  }
  if (mapping.mappingVersion === null || mapping.mappingAuthority === null) {
    block(
      blockers,
      BLOCKER.DIMENSION_NOT_SUPPLIED,
      `${label}.localMappings[].mappingVersion`,
      'mapping lacks its own version or a named authority',
    );
  }

  // Unit and specimen were truthiness-guarded on BOTH sides, so a null mapping unit compared
  // against nothing and passed. The mapping must declare them, and they must match.
  if (mapping.unitCode === null || mapping.unitCode === undefined) {
    block(blockers, BLOCKER.DIMENSION_NOT_SUPPLIED, `${label}.localMappings[].unitCode`, `mapping for "${observation.localCode}" declares no unit code; a null unit is not a wildcard`);
  } else if (observation.unitCode && observation.unitCode !== mapping.unitCode) {
    block(
      blockers,
      BLOCKER.UNIT_MISMATCH,
      `${label}.localMappings[].unitCode`,
      `observation unit "${observation.unitCode}" differs from the mapped unit "${mapping.unitCode}"; units are never auto-converted`,
    );
  }
  if (mapping.specimenCode === null || mapping.specimenCode === undefined) {
    block(blockers, BLOCKER.DIMENSION_NOT_SUPPLIED, `${label}.localMappings[].specimenCode`, `mapping for "${observation.localCode}" declares no specimen code; a null specimen is not a wildcard`);
  } else if (observation.specimenCode && observation.specimenCode !== mapping.specimenCode) {
    block(
      blockers,
      BLOCKER.SPECIMEN_MISMATCH,
      `${label}.localMappings[].specimenCode`,
      `observation specimen "${observation.specimenCode}" differs from the mapped specimen "${mapping.specimenCode}"`,
    );
  }

  // The standard code system must be one this profile asserts, at the exact version.
  const binding = (Array.isArray(profile.codeSystems) ? profile.codeSystems : []).find(
    (entry) => entry.system === mapping.standardSystem && entry.version === mapping.standardSystemVersion,
  );
  if (!binding || binding.assertion !== 'asserted') {
    block(
      blockers,
      BLOCKER.CODE_SYSTEM_VERSION_UNASSERTED,
      `${label}.codeSystems`,
      `code system "${mapping.standardSystem}" version "${mapping.standardSystemVersion}" is not asserted by this profile`,
    );
  }
}

// ---------------------------------------------------------------------------
// Activation gate
// ---------------------------------------------------------------------------

/**
 * Every identity field that must be present before `authority.assertion: "asserted"` means
 * anything. All are OWNER-HELD under OQ-3.
 */
const AUTHORITY_IDENTITY_FIELDS = {
  LocalReferenceIntervalProfile: [
    'institutionName',
    'laboratoryDirectorName',
    'laboratoryDirectorCredential',
    'assertionStatement',
    'assertedOn',
  ],
  LocalTerminologyProfile: ['institutionName', 'informaticsOwnerName', 'informaticsOwnerCredential', 'assertionStatement', 'assertedOn'],
};

/**
 * Evaluate whether a profile could gate anything. This function exists to REFUSE.
 *
 * WHY THE SIGNATURE CHECK IS UNCONDITIONAL. There is no attachment verifier in this repository:
 * the authenticated-attachment primitive is P2's, and nothing here can resolve, verify, or revoke
 * one. A `signatureState: "bound"` string is therefore a SELF-DECLARATION, and reading it as
 * proof of signature was the defect that let four field edits promote a synthetic fixture to
 * `{decision: 'applicable', blockers: []}`. The gate now refuses every profile whose signature is
 * not a verified attachment resolved by a verifier it was handed — and since no such verifier
 * exists on this side, `bound` is unreachable here by construction.
 *
 * `options.attachmentVerifier` exists only so the seam is explicit and testable. It is never
 * populated by any caller in this repository, and supplying one does NOT constitute authorization
 * to activate: it only changes which blocker is emitted.
 *
 * Nothing this function returns authorizes activation, release, or patient-affecting use.
 */
export function evaluateActivationGate(profile, applicabilityDecision, options = {}) {
  const blockers = [];

  if (profile === null || typeof profile !== 'object') {
    block(blockers, BLOCKER.STRUCTURALLY_INVALID, 'profile', 'profile is absent or not an object; nothing can be gated');
    return decision(blockers);
  }

  // --- profile class ---------------------------------------------------------
  if (profile.profileClass === 'synthetic_example') {
    block(
      blockers,
      BLOCKER.SYNTHETIC_PROFILE_CANNOT_ACTIVATE,
      'profile.profileClass',
      'profile is a synthetic example and can never satisfy an activation gate',
    );
  } else if (profile.profileClass !== 'site_asserted') {
    block(
      blockers,
      BLOCKER.PROFILE_CLASS_NOT_SITE_ASSERTED,
      'profile.profileClass',
      `profile class is ${JSON.stringify(profile.profileClass)}; only "site_asserted" is eligible and an absent or unrecognized class is never treated as one`,
    );
  }
  if (profile.syntheticDeclaration !== undefined && profile.profileClass !== 'synthetic_example') {
    block(
      blockers,
      BLOCKER.SYNTHETIC_PROFILE_CANNOT_ACTIVATE,
      'profile.syntheticDeclaration',
      'profile carries a syntheticDeclaration while claiming not to be synthetic; the contradiction is resolved against the more permissive reading',
    );
  }

  // --- authority -------------------------------------------------------------
  const authority = profile.authority;
  if (authority?.assertion !== 'asserted') {
    block(
      blockers,
      BLOCKER.AUTHORITY_NOT_EXECUTED_OWNER_HELD,
      'profile.authority.assertion',
      'no named local laboratory authority has asserted this profile (owner-held; plan OQ-3)',
    );
  } else {
    // `asserted` with every sibling still null was accepted. An assertion by nobody is not an
    // assertion.
    const requiredFields = AUTHORITY_IDENTITY_FIELDS[profile.kind] ?? [];
    const missing = requiredFields.filter((field) => authority[field] === null || authority[field] === undefined || authority[field] === '');
    if (requiredFields.length === 0) {
      block(
        blockers,
        BLOCKER.AUTHORITY_INCOMPLETE,
        'profile.kind',
        `profile kind ${JSON.stringify(profile.kind)} has no known authority contract; its authority cannot be checked and is therefore not accepted`,
      );
    } else if (missing.length > 0) {
      block(
        blockers,
        BLOCKER.AUTHORITY_INCOMPLETE,
        'profile.authority',
        `authority claims "asserted" but ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} absent; an assertion with no named accountable individual is not an assertion`,
      );
    }
  }

  // --- attestation -----------------------------------------------------------
  const verifier = typeof options.attachmentVerifier === 'function' ? options.attachmentVerifier : undefined;
  const signatureState = profile.attestation?.signatureState;

  if (verifier === undefined) {
    if (signatureState === 'bound') {
      block(
        blockers,
        BLOCKER.SIGNATURE_SELF_DECLARED_NOT_VERIFIED,
        'profile.attestation.signatureState',
        'profile declares signatureState "bound", but a self-declared string is not a signature. No attachment verifier exists on this side — the authenticated-attachment primitive is P2\'s — so a bound signature is unverifiable here and is refused.',
      );
    }
    block(
      blockers,
      BLOCKER.SIGNATURE_NOT_EXECUTED_OWNER_HELD,
      'profile.attestation.signatureState',
      'profile is unsigned as far as this system can establish; the authenticated attachment is bound to the P2 attachment contract and is not_executed_owner_held',
    );
  } else {
    const verified = verifier(profile.attestation) === true;
    if (!verified) {
      block(
        blockers,
        BLOCKER.SIGNATURE_NOT_EXECUTED_OWNER_HELD,
        'profile.attestation',
        'the supplied attachment verifier did not resolve this attestation to a verified authenticated attachment',
      );
    }
  }

  // --- applicability ---------------------------------------------------------
  if (!applicabilityDecision || applicabilityDecision.applicable !== true) {
    block(
      blockers,
      BLOCKER.APPLICABILITY_NOT_ESTABLISHED,
      'applicabilityDecision',
      'local applicability was not established; it is never inferred',
    );
  }

  return decision(blockers);
}
