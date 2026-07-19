// json-schema-lite — the validator's own fail-closed posture.
//
// This module's stated contract is that it FAILS CLOSED on any keyword it does not understand.
// The P3-V1 clinical-informatics review found one place where it did the opposite: keywords
// sitting beside a `$ref` were silently discarded. Nothing was lost at the time, but the next
// constraint written next to a `$ref` would have vanished with no signal — in the module whose
// entire job is to make sure a clinical applicability constraint is never quietly ignored.
//
// A validator with no tests of its own is a single point of failure for every schema that
// depends on it, so its own guarantees are asserted here rather than assumed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../scripts/lib/json-schema-lite.mjs';

test('P3-V1 F16 regression: a constraint beside a $ref is applied, not discarded', () => {
  const schema = {
    $defs: { name: { type: 'string' } },
    type: 'object',
    properties: {
      // `minLength` sits beside the `$ref`. Under the old early-return it was dropped entirely.
      label: { $ref: '#/$defs/name', minLength: 10 },
    },
  };

  assert.deepEqual(validate(schema, { label: 'a sufficiently long label' }), [], 'a conforming value must pass');

  const errors = validate(schema, { label: 'short' });
  assert.equal(errors.length, 1, 'the sibling constraint must be enforced, not skipped');
  assert.match(errors[0].message, /minLength/);
  assert.equal(errors[0].path, '$.label');
});

test('P3-V1 F16 regression: the referenced schema is still applied alongside its siblings', () => {
  const schema = {
    $defs: { name: { type: 'string' } },
    type: 'object',
    properties: { label: { $ref: '#/$defs/name', minLength: 3 } },
  };
  // Violates the $ref target (type), not the sibling.
  const errors = validate(schema, { label: 42 });
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /expected type string/);
});

test('P3-V1 F16 regression: annotations beside a $ref are not treated as constraints', () => {
  const schema = {
    $defs: { name: { type: 'string' } },
    type: 'object',
    properties: { label: { $ref: '#/$defs/name', description: 'a description is not a constraint' } },
  };
  assert.deepEqual(validate(schema, { label: 'anything' }), []);
});

test('an unsupported keyword raises rather than being silently skipped', () => {
  // The module's core promise. If this ever stops throwing, every schema in the repository
  // quietly loses whatever constraint the unknown keyword expressed.
  assert.throws(
    () => validate({ type: 'string', multipleOf: 3 }, 'x'),
    /unsupported keyword "multipleOf"/,
    'an unrecognized keyword must refuse to validate rather than ignore the constraint',
  );
});

test('an unsupported keyword beside a $ref also raises', () => {
  // The sibling-merge path must not become a new way to smuggle an unhandled keyword past the
  // fail-closed check.
  assert.throws(
    () => validate({ $defs: { s: { type: 'string' } }, $ref: '#/$defs/s', multipleOf: 3 }, 'x'),
    /unsupported keyword "multipleOf"/,
  );
});

test('`contains` enforces required membership in a value set', () => {
  // Used by the terminology schema so that "blockingStates must include preliminary, registered,
  // unknown, entered-in-error, and cancelled" is a constraint rather than prose.
  const schema = {
    type: 'array',
    allOf: [{ contains: { const: 'preliminary' } }, { contains: { const: 'cancelled' } }],
  };

  assert.deepEqual(validate(schema, ['preliminary', 'cancelled', 'final']), []);

  const errors = validate(schema, ['preliminary', 'final']);
  assert.equal(errors.length, 1, 'the missing required member must be reported');
  assert.match(errors[0].message, /must contain at least 1 item/);
});

test('`minContains` is honoured', () => {
  const schema = { type: 'array', contains: { type: 'integer' }, minContains: 2 };
  assert.deepEqual(validate(schema, [1, 2, 'x']), []);
  assert.equal(validate(schema, [1, 'x']).length, 1);
});

test('an unresolvable $ref raises rather than silently passing', () => {
  assert.throws(() => validate({ $ref: '#/$defs/missing' }, 'x'), /unresolvable ref/);
});
