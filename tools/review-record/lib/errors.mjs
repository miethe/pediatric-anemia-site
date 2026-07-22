// tools/review-record/lib/errors.mjs — fail-closed error taxonomy for the review-record CLI
// (P2-T1, OQ-1, FR-7). Mirrors the shape of tools/rf-bundle-to-kb-pack/lib/errors.mjs (this repo's
// established E0 precedent for a small tool CLI's error handling), scaled to what this tool
// actually needs today rather than pre-inventing a full 8-state taxonomy nothing here requires yet.
//
// Every thrown error a verb handler wants `cli.mjs` to map to a specific process exit code MUST be
// (or extend) `CliError`, carrying its own fixed `exitCode`. `cli.mjs`'s dispatcher forwards
// `err.exitCode` verbatim for any `CliError`; a non-`CliError` throw (a genuine bug) falls back to
// `EXIT_USAGE` (1) — there is no richer taxonomy to pick from yet.
//
// Later tasks in this phase (P2-T3 chain / P2-T4 adjudication / P2-T5 signature) may add further
// named `CliError` subclasses for `validate`'s eventual fail-closed failure classes without
// changing this module's shape — only by adding new subclasses here, never by repurposing
// `EXIT_USAGE` for a distinct failure meaning.

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;

/**
 * Base class for every review-record-CLI-raised, exit-code-mapped failure. `exitCode` is fixed at
 * construction and non-writable — a catch site cannot dilute a specific code into a different one
 * by later mutating it (same hardening `tools/rf-bundle-to-kb-pack/lib/errors.mjs`'s
 * `ConverterError` applies, P2-T5 of that tool).
 */
export class CliError extends Error {
  constructor(message, exitCode = EXIT_USAGE, options) {
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

/** Exit 1 — usage error: bad flags, missing required option, malformed on-disk store layout. */
export class UsageError extends CliError {
  constructor(message, options) {
    super(message, EXIT_USAGE, options);
  }
}

/**
 * Marks a verb this scaffold task (P2-T1) defines dispatch for but does not yet implement. Maps to
 * `EXIT_USAGE`: from the caller's perspective an unimplemented verb is "this CLI usage is not
 * available yet," not a judgment about any record's content. `render` and `dry-run` are expected to
 * throw this until P2-T6/P2-T8 land; `scaffold` and `validate` throw it until P2-T2 (roster-checked
 * scaffolding) and P2-T3/P2-T4/P2-T5 (chain / adjudication / signature validation, added
 * incrementally) land the real logic each owns.
 */
export class NotImplementedError extends UsageError {
  constructor(verb, owningTasks) {
    super(
      `verb "${verb}" is not yet implemented — cli.mjs dispatch scaffolded in P2-T1; real logic ` +
        `lands in ${owningTasks}.`,
    );
    this.verb = verb;
    this.owningTasks = owningTasks;
  }
}
