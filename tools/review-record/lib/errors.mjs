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

// -------------------------------------------------------------------------------------------
// P2-T2 additions (roster resolution, reviewer-2 independence, append-only write guard, first
// increment of `validate`). All still exit 1 (`UsageError`) — this tool has one fail-closed exit
// code, not a richer per-class taxonomy (see this file's header note).
// -------------------------------------------------------------------------------------------

/** `scaffold --reviewer-id <id>` (or a `validate`d record's `reviewerId`) does not resolve to any
 * entry in the loaded `governance/reviewer-roster.yaml` index (FR-3: unknown identity fails closed). */
export class UnknownReviewerError extends UsageError {
  constructor(reviewerId) {
    super(
      `reviewerId "${reviewerId}" does not resolve to any entry in governance/reviewer-roster.yaml ` +
        '(FR-3 — unknown identity fails closed; this is never a partially-trusted state).',
    );
    this.reviewerId = reviewerId;
  }
}

/** The resolved roster entry exists but its `moduleScopes[]` does not include the target module —
 * FR-3's "module-scope authorization" half of roster resolution, not just identity resolution. */
export class ReviewerNotInScopeError extends UsageError {
  constructor(reviewerId, moduleId) {
    super(
      `reviewerId "${reviewerId}" resolves in governance/reviewer-roster.yaml but its moduleScopes[] ` +
        `does not include "${moduleId}" — this reviewer is not authorized to review this module.`,
    );
    this.reviewerId = reviewerId;
    this.moduleId = moduleId;
  }
}

/** OQ-2 append-only guard: `scaffold`'s write path never overwrites an existing review-record file
 * — a path collision is always a caller bug (or a genuine attempt to mutate history), never silently
 * resolved by picking a different name or clobbering the existing file. */
export class RecordAlreadyExistsError extends UsageError {
  constructor(filePath) {
    super(
      `review-record file already exists at "${filePath}" — this store is append-only; a correction ` +
        'must be a new record with `supersedes` set, never an overwrite of an existing path.',
    );
    this.filePath = filePath;
  }
}

/** `validate`'s first increment (P2-T2: schema shape + D-4 roster resolution + the FR-4 reviewer-2
 * textual-independence heuristic). Carries every collected violation, not just the first — a caller
 * inspecting `.violations` sees the full picture in one pass, matching this repo's error-array
 * convention elsewhere (e.g. `scripts/validate-kb.mjs`). Chain (P2-T3), authorship-union/adjudicator
 * (P2-T4), and signature (P2-T5) checks are NOT yet part of this error's `violations` — see
 * `lib/verbs/validate.mjs`'s own header for exactly which dimensions this task added. */
export class ValidationFailedError extends UsageError {
  constructor(violations) {
    super(`validate found ${violations.length} violation(s):\n${violations.map((v) => `  - ${v}`).join('\n')}`);
    this.violations = violations;
  }
}
