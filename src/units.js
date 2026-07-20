/**
 * Generic, module-agnostic analyte-unit registry.
 *
 * Modules register their closed unit vocabulary here. This is intentionally not a general
 * UCUM parser: the supported input surface is the registered analyte set only.
 */

const analyteUnitRegistry = new Map();
const registeredUnitModules = new Set();
const preparedInputs = new WeakMap();

function key(moduleId, analyte) {
  return `${moduleId}::${analyte}`;
}

export function normalizeUnit(unit) {
  return String(unit).replaceAll(/[µμ]/g, 'u');
}

/** Explicitly mark a module as loaded, including modules with zero unit-bearing fields. */
export function registerUnitModule(moduleId) {
  registeredUnitModules.add(moduleId);
}

export function registerAnalyteUnit(moduleId, analyte, spec) {
  if (!registeredUnitModules.has(moduleId)) {
    throw new Error(`Unit module must be registered before its analytes: ${moduleId}`);
  }
  analyteUnitRegistry.set(key(moduleId, analyte), spec);
}

export function getAnalyteUnit(moduleId, analyte) {
  return analyteUnitRegistry.get(key(moduleId, analyte)) ?? null;
}

function getAtPath(input, field) {
  return field.split('.').reduce((value, segment) => value?.[segment], input);
}

function setAtPath(input, field, value) {
  const segments = field.split('.');
  const target = segments.slice(0, -1).reduce((parent, segment) => parent?.[segment], input);
  if (target) target[segments.at(-1)] = value;
}

export function classifyUnit(spec, providedUnit) {
  // A unit is a string or it is not a unit. Coercing here would let a schema-invalid
  // wrapper (e.g. `["g/dL"]`) stringify into an accepted spelling and bypass rejection —
  // `patient-input.schema.json` is documentation-only, so nothing else catches it.
  if (typeof providedUnit !== 'string') {
    return { accepted: false, reason: 'unrecognized' };
  }

  const normalizedProvided = normalizeUnit(providedUnit);
  const canonical = normalizeUnit(spec.canonical);
  if ((spec.confusables ?? []).some((entry) => entry.unit === '*' || normalizeUnit(entry.unit) === normalizedProvided)) {
    return { accepted: false, reason: 'incompatible' };
  }
  if ([spec.canonical, ...(spec.synonyms ?? [])].some((unit) => normalizeUnit(unit) === normalizedProvided)) {
    return { accepted: true, normalizedUnit: canonical };
  }
  return { accepted: false, reason: 'unrecognized' };
}

/**
 * Validate units for registered analyte measurements supplied in a module input.
 *
 * A missing sibling unit is an explicit, auditable assumption of the closed canonical unit.
 * A supplied unit is never converted: it is accepted as a registered notation or rejected.
 */
export function validateUnits(moduleId, input) {
  const errors = [];
  const fields = [];

  if (!registeredUnitModules.has(moduleId)) {
    return {
      ok: false,
      errors: [{ moduleId, reason: 'unregistered-module' }],
      fields,
    };
  }

  for (const [registryKey, spec] of analyteUnitRegistry) {
    if (!registryKey.startsWith(`${moduleId}::`)) continue;

    const analyte = registryKey.slice(moduleId.length + 2);
    const registeredFields = [spec.field ?? analyte, ...(spec.referenceFields ?? [])];

    for (const field of registeredFields) {
      const segments = field.split('.');
      const measurementField = segments.at(-1);
      const unitField = `${measurementField}Unit`;
      const container = getAtPath(input, segments.slice(0, -1).join('.'));

      if (!Object.hasOwn(container ?? {}, measurementField)) continue;
      const measurement = container[measurementField];
      if (measurement === null || measurement === undefined) continue;

      if (!Object.hasOwn(container, unitField)) {
        fields.push({ field, canonicalUnit: spec.canonical, unitAssumed: true });
        continue;
      }

      const providedUnit = container[unitField];
      const classification = classifyUnit(spec, providedUnit);
      if (classification.accepted) {
        fields.push({
          field,
          canonicalUnit: spec.canonical,
          normalizedUnit: classification.normalizedUnit,
          unitAssumed: false,
        });
        continue;
      }

      errors.push({
        field,
        providedUnit: unitForError(providedUnit),
        expectedUnit: spec.canonical,
        reason: classification.reason,
      });
    }
  }

  return { ok: errors.length === 0, errors, fields };
}

function unitForError(unit) {
  return unit === null || unit === undefined ? null : String(unit);
}

function applyRegisteredUnitNormalization(input, fields) {
  for (const field of fields) {
    if (!field.unitAssumed) setAtPath(input, `${field.field}Unit`, field.normalizedUnit);
  }
  return input;
}

/** Apply accepted notation normalization without changing any numeric value. */
export function normalizeRegisteredUnits(input, fields) {
  const normalizedInput = structuredClone(input ?? {});
  applyRegisteredUnitNormalization(normalizedInput, fields);
  return normalizedInput;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

/**
 * Create the one snapshot used by both unit validation and clinical derivation.
 *
 * `structuredClone` materializes accessor-backed inputs before any validation read. Accepted
 * unit synonyms are then normalized on that clone, and the resulting graph is frozen so no
 * validation-to-derivation mutation can reopen a time-of-check/time-of-use gap.
 */
export function prepareUnitValidatedInput(moduleId, rawInput) {
  const existing = rawInput && typeof rawInput === 'object' ? preparedInputs.get(rawInput) : null;
  if (existing?.moduleId === moduleId) return existing;

  const cloned = structuredClone(rawInput ?? {});
  const snapshot = cloned !== null && typeof cloned === 'object' ? cloned : {};
  const unitValidation = validateUnits(moduleId, snapshot);
  if (!unitValidation.ok) throw new UnitRejectionError(unitValidation.errors);

  applyRegisteredUnitNormalization(snapshot, unitValidation.fields);
  deepFreeze(snapshot);
  // Freeze the validation metadata too, not just the input. An in-process caller that could
  // flip `fields[i].unitAssumed` on the cached record would suppress the assumption from
  // `provenance.unitsAssumed` while the unit stayed absent — a silent assumption behind a
  // clinical result, which is exactly what OQ-5's disclosure requirement forbids.
  const prepared = deepFreeze({ moduleId, input: snapshot, unitValidation });
  preparedInputs.set(snapshot, prepared);
  return prepared;
}

/** Wrap a module's public fact derivation export in the generic snapshot boundary. */
export function createUnitValidatedDeriver(moduleId, deriveFromSnapshot) {
  return function deriveUnitValidatedFacts(rawInput = {}) {
    const { input } = prepareUnitValidatedInput(moduleId, rawInput);
    return deriveFromSnapshot(input);
  };
}

export class UnitRejectionError extends Error {
  constructor(details) {
    super('Unit mismatch or unrecognized unit in patient input.');
    this.name = 'UnitRejectionError';
    this.code = 'UNIT_REJECTED';
    this.statusCode = 400;
    this.details = details.map((detail) => ({
      ...detail,
      ...(Object.hasOwn(detail, 'providedUnit')
        ? { providedUnit: unitForError(detail.providedUnit) }
        : {}),
      ...(Object.hasOwn(detail, 'expectedUnit')
        ? { expectedUnit: unitForError(detail.expectedUnit) }
        : {}),
    }));
  }
}
