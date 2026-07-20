// json-schema-lite — a dependency-free validator for the JSON Schema 2020-12 subset this
// repository actually uses. The project ships with zero runtime dependencies (package.json has
// no `dependencies` block and there is no node_modules tree), so Ajv is not available and adding
// it would change the repo's supply-chain posture for the sake of two schema files. This module
// implements only the keywords the local-profile schemas use, and it FAILS CLOSED on any keyword
// it does not understand: an unrecognized keyword raises, rather than being silently skipped.
// Silently ignoring a constraint in a clinical applicability schema would be the exact class of
// bug these schemas exist to prevent.

const SUPPORTED_KEYWORDS = new Set([
  '$schema', '$id', '$defs', '$ref', '$comment', 'title', 'description', 'examples', 'default',
  'type', 'enum', 'const', 'required', 'properties', 'additionalProperties',
  'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'format', 'if', 'then', 'else',
  'allOf', 'anyOf', 'oneOf', 'not', 'contains', 'minContains',
]);

/**
 * Keywords that carry no constraint. Everything else sitting beside a `$ref` is a real
 * constraint and is applied to the same instance rather than discarded — see `validate`.
 *
 * `default` is included per the JSON Schema 2020-12 spec: it is a non-validating annotation
 * (a hint for a consumer that wants to apply a default value), not a constraint on the instance.
 * Treating it as a real keyword requiring bespoke handling would be wrong in the other
 * direction — it has no `data`-dependent behavior to implement. schemas/patient-input.schema.json
 * uses `default` on several optional booleans; before this it could not be validated by this
 * module at all once an instance supplied one of those keys, because the fail-closed unsupported-
 * keyword check does not distinguish a missing feature from a genuinely inert annotation.
 */
const ANNOTATION_KEYWORDS = new Set(['$schema', '$id', '$defs', '$comment', 'title', 'description', 'examples', 'default']);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function typeMatches(value, expected) {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  if (expected === 'integer') return actual === 'integer';
  return actual === expected;
}

function resolveRef(ref, rootSchema) {
  if (!ref.startsWith('#/')) throw new Error(`json-schema-lite: only local #/ refs are supported, got "${ref}"`);
  let node = rootSchema;
  for (const rawSegment of ref.slice(2).split('/')) {
    const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
    node = node?.[segment];
    if (node === undefined) throw new Error(`json-schema-lite: unresolvable ref "${ref}"`);
  }
  return node;
}

function assertKeywordsSupported(schema, at) {
  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(keyword)) {
      throw new Error(`json-schema-lite: unsupported keyword "${keyword}" at ${at} — refusing to validate silently`);
    }
  }
}

/**
 * Validate `data` against `schema`. Returns an array of `{ path, message }` errors; an empty
 * array means valid. Structural validity NEVER implies clinical validity or local applicability.
 */
export function validate(schema, data, options = {}) {
  const rootSchema = options.rootSchema ?? schema;
  const at = options.path ?? '$';
  const errors = [];

  if (typeof schema === 'boolean') {
    if (!schema) errors.push({ path: at, message: 'schema `false` — no value is valid here' });
    return errors;
  }
  assertKeywordsSupported(schema, at);

  // `$ref` no longer swallows its siblings. JSON Schema 2020-12 applies keywords adjacent to
  // `$ref` alongside the referenced schema, and the previous early `return` discarded them
  // silently — in a module whose stated posture is that it fails closed on anything it does not
  // understand. Nothing was lost at the time, but the next constraint written next to a `$ref`
  // would have vanished without a signal, which is precisely the class of bug these schemas
  // exist to prevent.
  if (schema.$ref) {
    errors.push(...validate(resolveRef(schema.$ref, rootSchema), data, { rootSchema, path: at }));
    const siblings = { ...schema };
    delete siblings.$ref;
    const constraining = Object.keys(siblings).filter((keyword) => !ANNOTATION_KEYWORDS.has(keyword));
    if (constraining.length > 0) {
      errors.push(...validate(siblings, data, { rootSchema, path: at }));
    }
    return errors;
  }

  if (schema.type !== undefined) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expectedTypes.some((expected) => typeMatches(data, expected))) {
      errors.push({ path: at, message: `expected type ${expectedTypes.join('|')}, got ${typeOf(data)}` });
      return errors; // further keyword checks would be noise once the type is wrong
    }
  }

  if (schema.enum !== undefined && !schema.enum.some((candidate) => deepEqual(candidate, data))) {
    errors.push({ path: at, message: `value ${JSON.stringify(data)} is not one of ${JSON.stringify(schema.enum)}` });
  }
  if (schema.const !== undefined && !deepEqual(schema.const, data)) {
    errors.push({ path: at, message: `value ${JSON.stringify(data)} must equal const ${JSON.stringify(schema.const)}` });
  }

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({ path: at, message: `string shorter than minLength ${schema.minLength}` });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({ path: at, message: `string longer than maxLength ${schema.maxLength}` });
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(data)) {
      errors.push({ path: at, message: `string does not match pattern ${schema.pattern}` });
    }
    if (schema.format === 'date' && !DATE_RE.test(data)) {
      errors.push({ path: at, message: 'string is not a valid `date` (YYYY-MM-DD)' });
    }
    if (schema.format === 'date-time' && !DATE_TIME_RE.test(data)) {
      errors.push({ path: at, message: 'string is not a valid `date-time` (RFC 3339)' });
    }
  }

  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({ path: at, message: `value below minimum ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({ path: at, message: `value above maximum ${schema.maximum}` });
    }
    // JSON Schema draft 2020-12 semantics only: exclusiveMinimum/exclusiveMaximum are numbers
    // (the bound itself), not the legacy draft-4 boolean modifier on `minimum`/`maximum`. A
    // schema author who writes `exclusiveMinimum: true` here gets a `typeof data === 'number'`
    // comparison against `true` (coerced to 1), which is deliberately not special-cased --
    // draft-4 boolean-form support is out of scope and no schema in this repository uses it.
    if (schema.exclusiveMinimum !== undefined && data <= schema.exclusiveMinimum) {
      errors.push({ path: at, message: `value must be strictly greater than exclusiveMinimum ${schema.exclusiveMinimum}` });
    }
    if (schema.exclusiveMaximum !== undefined && data >= schema.exclusiveMaximum) {
      errors.push({ path: at, message: `value must be strictly less than exclusiveMaximum ${schema.exclusiveMaximum}` });
    }
  }

  if (typeOf(data) === 'object') {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(data, key)) errors.push({ path: `${at}.${key}`, message: 'required property is missing' });
    }
    const properties = schema.properties ?? {};
    for (const [key, value] of Object.entries(data)) {
      if (Object.hasOwn(properties, key)) {
        errors.push(...validate(properties[key], value, { rootSchema, path: `${at}.${key}` }));
      } else if (schema.additionalProperties === false) {
        errors.push({ path: `${at}.${key}`, message: 'additional property is not permitted' });
      } else if (typeof schema.additionalProperties === 'object') {
        errors.push(...validate(schema.additionalProperties, value, { rootSchema, path: `${at}.${key}` }));
      }
    }
  }

  if (typeOf(data) === 'array') {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({ path: at, message: `array shorter than minItems ${schema.minItems}` });
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push({ path: at, message: `array longer than maxItems ${schema.maxItems}` });
    }
    if (schema.uniqueItems === true) {
      const seen = new Set(data.map((item) => JSON.stringify(item)));
      if (seen.size !== data.length) errors.push({ path: at, message: 'array items must be unique' });
    }
    if (schema.items !== undefined) {
      data.forEach((item, index) => {
        errors.push(...validate(schema.items, item, { rootSchema, path: `${at}[${index}]` }));
      });
    }
    // `contains` lets a schema require that a value set includes a specific member — used to
    // enforce that a site's blockingStates actually contain the states the prose says they must.
    if (schema.contains !== undefined) {
      const minContains = schema.minContains ?? 1;
      const matched = data.filter((item) => validate(schema.contains, item, { rootSchema, path: at }).length === 0).length;
      if (matched < minContains) {
        errors.push({
          path: at,
          message: `array must contain at least ${minContains} item(s) matching ${JSON.stringify(schema.contains)}, found ${matched}`,
        });
      }
    }
  }

  for (const subSchema of schema.allOf ?? []) {
    errors.push(...validate(subSchema, data, { rootSchema, path: at }));
  }
  if (schema.anyOf !== undefined && !schema.anyOf.some((sub) => validate(sub, data, { rootSchema, path: at }).length === 0)) {
    errors.push({ path: at, message: 'value does not match any subschema in anyOf' });
  }
  if (schema.oneOf !== undefined) {
    const matched = schema.oneOf.filter((sub) => validate(sub, data, { rootSchema, path: at }).length === 0).length;
    if (matched !== 1) errors.push({ path: at, message: `value matched ${matched} oneOf subschemas, expected exactly 1` });
  }
  if (schema.not !== undefined && validate(schema.not, data, { rootSchema, path: at }).length === 0) {
    errors.push({ path: at, message: 'value must not match the `not` subschema' });
  }

  if (schema.if !== undefined) {
    const conditionHolds = validate(schema.if, data, { rootSchema, path: at }).length === 0;
    const branch = conditionHolds ? schema.then : schema.else;
    if (branch !== undefined) errors.push(...validate(branch, data, { rootSchema, path: at }));
  }

  return errors;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeOf(a) !== typeOf(b)) return false;
  if (typeOf(a) === 'array') return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  if (typeOf(a) === 'object') {
    const aKeys = Object.keys(a);
    return aKeys.length === Object.keys(b).length && aKeys.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}
