// tools/release-sign/lib/errors.mjs — fail-closed error taxonomy scaffold (P3-T1, FR-12).
//
// P3-T1 scope: define a minimal, importable error contract so the `manifest` verb (this task)
// and the `register`/`sign`/`verify` verb stubs (P3-T2..T4, not yet implemented) share one error
// identity model. This is deliberately NOT `tools/rf-bundle-to-kb-pack/lib/errors.mjs`'s full
// 02 §5.2 8-code taxonomy — `tools/release-sign` is a downstream, later-stage tool with its own,
// narrower concerns (a manifest/registry/signature problem, not an `rf`-bundle-eligibility
// problem), and P3-T3 owns defining verify's own documented 5-class fail-closed exit-code table
// (FR-13) on top of this scaffold. Do not widen this file's taxonomy ahead of that task.
//
//   0 OK · 1 USAGE (covers every failure mode this task's own scope produces)
//
// Every thrown error a verb handler wants the CLI to surface distinctly MUST be (or extend) a
// `ReleaseSignError` subclass below, carrying its own fixed `exitCode`. `cli.mjs`'s top-level
// catch forwards `err.exitCode` verbatim — it never remaps a `ReleaseSignError`'s code.

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;

/** Frozen lookup table (name -> numeric code), extended by later tasks as new codes are added. */
export const EXIT_CODES = Object.freeze({
  OK: EXIT_OK,
  USAGE: EXIT_USAGE,
});

/**
 * Base class for every release-sign-raised, taxonomy-mapped failure. `exitCode` is fixed at
 * construction by the subclass and MUST NOT be mutated or reassigned by a catch site — mirrors
 * `tools/rf-bundle-to-kb-pack/lib/errors.mjs`'s `ConverterError` hardening (P2-T5 precedent):
 * every module in this repo runs as native ESM (always strict mode), so an attempted
 * `err.exitCode = <other code>` throws a TypeError instead of silently diluting a distinctly-coded
 * failure into something a generic handler would treat as ordinary.
 */
export class ReleaseSignError extends Error {
  constructor(message, exitCode, options) {
    super(message, options);
    this.name = new.target.name;
    Object.defineProperty(this, 'exitCode', {
      value: exitCode,
      writable: false,
      enumerable: true,
      configurable: false,
    });
  }
}

/** Exit 1 — usage/not-found/malformed-input. Correct the invocation; do not retry blindly. */
export class UsageError extends ReleaseSignError {
  constructor(message, options) {
    super(message, EXIT_USAGE, options);
  }
}

/**
 * The signing preimage this tool computed for a pack disagrees, byte-for-byte, with a pinned
 * golden-bytes regression fixture (P3-T1's own acceptance criteria: "golden drift fails the
 * phase, never silently re-baselines"). Never caught and silently re-baselined by any test or
 * script in this tree — a golden-bytes fixture is updated only by a deliberate, reviewed commit
 * that replaces the fixture file itself, never by code that "fixes" a failing comparison at
 * runtime.
 */
export class GoldenDriftError extends UsageError {
  constructor(label, expectedSha256, actualSha256) {
    super(
      `golden-bytes drift detected for "${label}": expected sha256:${expectedSha256}, got ` +
        `sha256:${actualSha256}. This pins E0's P5-T5 canonical serialization of the ` +
        'cbc_suite_v1 pack — a mismatch means either the pinned fixture is stale (update it via ' +
        'a deliberate, reviewed commit, never silently) or E0\'s converter output actually ' +
        'changed underneath this tool (investigate before touching the fixture).',
    );
    this.label = label;
    this.expectedSha256 = expectedSha256;
    this.actualSha256 = actualSha256;
  }
}

/**
 * Scaffold-only marker for a verb this phase defines in `cli.mjs`'s dispatch table but does not
 * yet implement (P3-T2/T3/T4). Maps to EXIT_USAGE: from the caller's perspective an unimplemented
 * verb is "this CLI usage is not available yet" — mirrors
 * `tools/rf-bundle-to-kb-pack/lib/errors.mjs`'s `NotImplementedError` (P2-T1 precedent).
 */
export class NotImplementedError extends UsageError {
  constructor(taskId, detail) {
    super(
      `not yet implemented — scaffolded in P3-T1; completed in ${taskId}.${detail ? ` (${detail})` : ''}`,
    );
    this.taskId = taskId;
  }
}
