// tests/ef-converter-error-taxonomy.test.mjs — P2-T5: fail-closed error taxonomy
// (rf exit-code mapping, FR-11, 02 §5.2).
//
// Task acceptance criteria (phase-1-2-foundation-converter.md, row P2-T5):
//   1. "Each of the 8 exit codes has a distinct, named error path in the converter's error
//      module" — asserted below by walking `ERROR_CLASSES_BY_EXIT_CODE` and constructing one
//      instance per class.
//   2. "A test asserts exit 3 and exit 7 specifically do not get caught by the converter's
//      generic-error handler" — asserted below via `dispatchVerb` (`cli.mjs`'s ONLY generic-error
//      handler, extracted by P2-T5 specifically so it is directly testable without Phase 3's real
//      verb logic existing yet).
//
// This suite covers the error-taxonomy module in isolation. It is deliberately NOT
// `tests/ef-converter-invariants.test.mjs` — that flat, 15-invariant-numbered file is P2-T8's seam
// task and this repo's task table treats the two as separate, separately-owned artifacts.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXIT_OK,
  EXIT_USAGE,
  EXIT_SCHEMA,
  EXIT_GOVERNANCE,
  EXIT_UNSUPPORTED,
  EXIT_BUDGET,
  EXIT_ADAPTER,
  EXIT_HUMAN_REVIEW,
  EXIT_CODES,
  EXIT_CODE_NAMES,
  ERROR_CLASSES_BY_EXIT_CODE,
  isHaltingExitCode,
  ConverterError,
  UsageError,
  SchemaError,
  GovernanceError,
  UnsupportedError,
  BudgetError,
  AdapterError,
  HumanReviewError,
  NotImplementedError,
} from '../tools/rf-bundle-to-kb-pack/lib/errors.mjs';
import { dispatchVerb } from '../tools/rf-bundle-to-kb-pack/cli.mjs';

/** Runs `fn` with `process.stderr.write` swallowed, then restores it — keeps test output clean
 * for cases that intentionally trigger the CLI's stderr logging. */
function withSilencedStderr(fn) {
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;
  try {
    return fn();
  } finally {
    process.stderr.write = original;
  }
}

test('the 8 exit-code constants match the 02 §5.2 table verbatim', () => {
  assert.equal(EXIT_OK, 0);
  assert.equal(EXIT_USAGE, 1);
  assert.equal(EXIT_SCHEMA, 2);
  assert.equal(EXIT_GOVERNANCE, 3);
  assert.equal(EXIT_UNSUPPORTED, 4);
  assert.equal(EXIT_BUDGET, 5);
  assert.equal(EXIT_ADAPTER, 6);
  assert.equal(EXIT_HUMAN_REVIEW, 7);

  assert.deepEqual(EXIT_CODES, {
    OK: 0,
    USAGE: 1,
    SCHEMA: 2,
    GOVERNANCE: 3,
    UNSUPPORTED: 4,
    BUDGET: 5,
    ADAPTER: 6,
    HUMAN_REVIEW: 7,
  });
  assert.deepEqual(EXIT_CODE_NAMES, {
    0: 'OK',
    1: 'USAGE',
    2: 'SCHEMA',
    3: 'GOVERNANCE',
    4: 'UNSUPPORTED',
    5: 'BUDGET',
    6: 'ADAPTER',
    7: 'HUMAN_REVIEW',
  });
});

test('AC1: each of the 8 exit codes has a distinct, named error path', () => {
  const expectedByCode = {
    [EXIT_USAGE]: UsageError,
    [EXIT_SCHEMA]: SchemaError,
    [EXIT_GOVERNANCE]: GovernanceError,
    [EXIT_UNSUPPORTED]: UnsupportedError,
    [EXIT_BUDGET]: BudgetError,
    [EXIT_ADAPTER]: AdapterError,
    [EXIT_HUMAN_REVIEW]: HumanReviewError,
  };

  const codes = Object.keys(expectedByCode).map(Number);
  assert.equal(codes.length, 7, 'exit 0 (OK) has no error class — success is a numeric return, never a throw');

  for (const code of codes) {
    const ExpectedClass = expectedByCode[code];
    assert.equal(
      ERROR_CLASSES_BY_EXIT_CODE[code],
      ExpectedClass,
      `exit ${code}'s registry entry must be ${ExpectedClass.name}`,
    );

    const instance = new ExpectedClass('probe message');
    assert.ok(instance instanceof ConverterError, `${ExpectedClass.name} must extend ConverterError`);
    assert.equal(instance.exitCode, code, `${ExpectedClass.name} must carry the fixed exit code ${code}`);
    assert.equal(instance.name, ExpectedClass.name, 'error .name must match the concrete subclass, not "Error"');
  }

  // Uniqueness: no two of the 7 classes share an exit code (the registry itself is keyed by code,
  // so this also guards against a future edit silently overwriting one entry with another).
  const distinctCodes = new Set(Object.keys(ERROR_CLASSES_BY_EXIT_CODE).map(Number));
  assert.equal(distinctCodes.size, 7, 'all 7 non-OK exit codes must be distinct');
});

test('exitCode is a non-writable own property — a catch site cannot dilute it', () => {
  const err = new GovernanceError('policy violation');
  const descriptor = Object.getOwnPropertyDescriptor(err, 'exitCode');
  assert.equal(descriptor.writable, false);
  assert.equal(descriptor.configurable, false);
  assert.equal(descriptor.enumerable, true);

  // ESM modules always run in strict mode, so reassignment throws rather than silently no-op-ing.
  assert.throws(() => {
    err.exitCode = EXIT_USAGE;
  }, TypeError);
  assert.equal(err.exitCode, EXIT_GOVERNANCE, 'the attempted mutation above must not have taken effect');
});

test('isHaltingExitCode is true for GOVERNANCE (3) and HUMAN_REVIEW (7) only', () => {
  const haltingCodes = [EXIT_OK, EXIT_USAGE, EXIT_SCHEMA, EXIT_GOVERNANCE, EXIT_UNSUPPORTED, EXIT_BUDGET, EXIT_ADAPTER, EXIT_HUMAN_REVIEW]
    .filter(isHaltingExitCode);
  assert.deepEqual(haltingCodes.sort((a, b) => a - b), [EXIT_GOVERNANCE, EXIT_HUMAN_REVIEW]);
});

test('AC2: dispatchVerb forwards GOVERNANCE (3) verbatim, never through the generic fallback', async () => {
  const handler = async () => {
    throw new GovernanceError('policy violation requires governance owner routing');
  };
  const code = await withSilencedStderr(() => dispatchVerb(handler, {}));
  assert.equal(code, EXIT_GOVERNANCE);
  assert.notEqual(code, EXIT_USAGE, 'GOVERNANCE must never be remapped to the generic USAGE fallback');
});

test('AC2: dispatchVerb forwards HUMAN_REVIEW (7) verbatim, never through the generic fallback', async () => {
  const handler = async () => {
    throw new HumanReviewError('pause and route to a human/council gate — not a technical failure');
  };
  const code = await withSilencedStderr(() => dispatchVerb(handler, {}));
  assert.equal(code, EXIT_HUMAN_REVIEW);
  assert.notEqual(code, EXIT_USAGE, 'HUMAN_REVIEW must never be remapped to the generic USAGE fallback');
});

test('dispatchVerb forwards every ConverterError subclass\'s own fixed exit code', async () => {
  for (const [codeStr, ErrorClass] of Object.entries(ERROR_CLASSES_BY_EXIT_CODE)) {
    const code = Number(codeStr);
    const handler = async () => {
      throw new ErrorClass(`probe for ${ErrorClass.name}`);
    };
    // eslint-disable-next-line no-await-in-loop
    const result = await withSilencedStderr(() => dispatchVerb(handler, {}));
    assert.equal(result, code, `${ErrorClass.name} must forward exit ${code} through dispatchVerb`);
  }
});

test('dispatchVerb routes only non-ConverterError throws to the generic EXIT_USAGE fallback', async () => {
  const handler = async () => {
    throw new Error('an unclassified programmer error, not a taxonomy-mapped failure state');
  };
  const code = await withSilencedStderr(() => dispatchVerb(handler, {}));
  assert.equal(code, EXIT_USAGE);
  assert.equal(isHaltingExitCode(code), false);
});

test('dispatchVerb resolves EXIT_OK when a handler resolves without a numeric code', async () => {
  const handler = async () => undefined;
  const code = await dispatchVerb(handler, {});
  assert.equal(code, EXIT_OK);
});

test('dispatchVerb forwards a handler\'s own numeric resolution verbatim', async () => {
  const handler = async () => 0;
  const code = await dispatchVerb(handler, {});
  assert.equal(code, EXIT_OK);
});

test('NotImplementedError is a scaffold-only UsageError, never a halting GOVERNANCE/HUMAN_REVIEW state', () => {
  const err = new NotImplementedError('P2-T6', 'lib/verbs/inspect.js#run');
  assert.ok(err instanceof UsageError);
  assert.ok(err instanceof ConverterError);
  assert.equal(err.exitCode, EXIT_USAGE);
  assert.equal(isHaltingExitCode(err.exitCode), false);
  assert.equal(err.taskId, 'P2-T6');
});
