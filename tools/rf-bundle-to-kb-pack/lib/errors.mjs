// tools/rf-bundle-to-kb-pack/lib/errors.mjs — fail-closed error taxonomy (P2-T1 scaffold; hardened
// by P2-T5, FR-11, 02 §5.2).
//
// This module defines the converter's ONLY sanctioned mapping from an internal failure state onto
// the `rf verify`/`rf council` exit-code taxonomy (02 §5.2):
//
//   0 OK · 1 USAGE · 2 SCHEMA · 3 GOVERNANCE · 4 UNSUPPORTED · 5 BUDGET · 6 ADAPTER · 7 HUMAN_REVIEW
//
// Every thrown error a verb handler wants the CLI to surface distinctly MUST be (or extend) a
// `ConverterError` subclass below, carrying its own fixed `exitCode`. `cli.mjs`'s top-level catch
// forwards `err.exitCode` verbatim — it never remaps a `ConverterError`'s code, and in particular
// it must never let GOVERNANCE (3) or HUMAN_REVIEW (7) fall through to a generic handler (02 §5.2:
// "Block; never override in converter" / "Block until concern resolved and recorded").
//
// P2-T1 scope: define the 8 constants and one named class per exit code so P2-T2..T7 have a
// stable, importable contract to throw against. P2-T5 (`Fail-closed error taxonomy`) owns:
//   - proving each of the 8 codes has a distinct, *tested* path (its own AC),
//   - any additional named subclasses a real failure mode needs beyond this scaffold,
//   - the assertion that 3 and 7 specifically never reach a generic catch-all.
// Do not weaken or renumber the constants below without revisiting 02 §5.2 — the numbering is the
// stable machine contract `rf` itself already uses.

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_SCHEMA = 2;
export const EXIT_GOVERNANCE = 3;
export const EXIT_UNSUPPORTED = 4;
export const EXIT_BUDGET = 5;
export const EXIT_ADAPTER = 6;
export const EXIT_HUMAN_REVIEW = 7;

/** Frozen lookup table mirroring 02 §5.2's exit-code table (name -> numeric code). */
export const EXIT_CODES = Object.freeze({
  OK: EXIT_OK,
  USAGE: EXIT_USAGE,
  SCHEMA: EXIT_SCHEMA,
  GOVERNANCE: EXIT_GOVERNANCE,
  UNSUPPORTED: EXIT_UNSUPPORTED,
  BUDGET: EXIT_BUDGET,
  ADAPTER: EXIT_ADAPTER,
  HUMAN_REVIEW: EXIT_HUMAN_REVIEW,
});

/** Frozen lookup table mirroring 02 §5.2's exit-code table (numeric code -> name), for logging. */
export const EXIT_CODE_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(EXIT_CODES).map(([name, code]) => [code, name])),
);

/**
 * Base class for every converter-raised, taxonomy-mapped failure. `exitCode` is fixed at
 * construction by the subclass and MUST NOT be mutated or reassigned by a catch site — `cli.mjs`
 * relies on this invariant to forward GOVERNANCE/HUMAN_REVIEW without dilution.
 */
export class ConverterError extends Error {
  constructor(message, exitCode, options) {
    super(message, options);
    this.name = new.target.name;
    this.exitCode = exitCode;
  }
}

/** Exit 1 — usage/not found (`pipeline_error`). Correct the run/artifact reference; do not retry blindly. */
export class UsageError extends ConverterError {
  constructor(message, options) {
    super(message, EXIT_USAGE, options);
  }
}

/** Exit 2 — schema failure (`evidence_schema_failed`). Repair the upstream artifact; re-verify. */
export class SchemaError extends ConverterError {
  constructor(message, options) {
    super(message, EXIT_SCHEMA, options);
  }
}

/**
 * Exit 3 — GOVERNANCE (`governance_review_required`). Block; never override in the converter.
 * Per 02 §5.2 this must halt and surface distinctly — no catch site may treat it as an ordinary
 * failure or continue past it.
 */
export class GovernanceError extends ConverterError {
  constructor(message, options) {
    super(message, EXIT_GOVERNANCE, options);
  }
}

/** Exit 4 — UNSUPPORTED (`unsupported_claims`). Hard block for material clinical content. */
export class UnsupportedError extends ConverterError {
  constructor(message, options) {
    super(message, EXIT_UNSUPPORTED, options);
  }
}

/** Exit 5 — budget (`research_budget_paused`). Block until run completes adequately. */
export class BudgetError extends ConverterError {
  constructor(message, options) {
    super(message, EXIT_BUDGET, options);
  }
}

/** Exit 6 — adapter (`discovery_adapter_failed`). Block completeness gate unless documented. */
export class AdapterError extends ConverterError {
  constructor(message, options) {
    super(message, EXIT_ADAPTER, options);
  }
}

/**
 * Exit 7 — HUMAN_REVIEW (`human_review_pending`). Not a technical failure: pause and route to a
 * human/council gate. Per 02 §5.2 this must halt and surface distinctly, exactly like GOVERNANCE.
 */
export class HumanReviewError extends ConverterError {
  constructor(message, options) {
    super(message, EXIT_HUMAN_REVIEW, options);
  }
}

/**
 * Scaffold-only marker for a module boundary this phase defines but does not yet implement
 * (P2-T2..T7, or the P3 `propose` verb). Maps to EXIT_USAGE: from the caller's perspective an
 * unimplemented code path is "this CLI usage is not available yet," the closest fit among the 02
 * §5.2 states — it is not a converter-internal judgment about bundle content, so it must not reuse
 * GOVERNANCE/UNSUPPORTED/HUMAN_REVIEW's clinical-content semantics. P2-T5 may reclassify this
 * fallback if a real failure mode later needs its own subclass.
 */
export class NotImplementedError extends UsageError {
  constructor(taskId, detail) {
    super(
      `not yet implemented — scaffolded in P2-T1; completed in ${taskId}.${detail ? ` (${detail})` : ''}`,
    );
    this.taskId = taskId;
  }
}
