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
    // P2-T5 hardening: `exitCode` is a non-writable own property, not a plain assignment. Every
    // module in this repo runs as native ESM (always strict mode), so a catch site that attempts
    // `err.exitCode = <other code>` throws a TypeError instead of silently diluting a
    // GOVERNANCE/HUMAN_REVIEW code into something the generic handler would treat as ordinary.
    // This turns the "MUST NOT be mutated" rule above from a comment into an enforced invariant.
    Object.defineProperty(this, 'exitCode', {
      value: exitCode,
      writable: false,
      enumerable: true,
      configurable: false,
    });
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
 * P2-T5: registry proving each non-OK exit code (02 §5.2) has exactly one, distinctly-named
 * `ConverterError` subclass — this is the "distinct, named error path" this task's acceptance
 * criteria requires, expressed as data a test can walk rather than asserted only in prose. Exit 0
 * has no entry: success is a numeric verb-handler return, never a thrown error (see cli.mjs).
 */
export const ERROR_CLASSES_BY_EXIT_CODE = Object.freeze({
  [EXIT_USAGE]: UsageError,
  [EXIT_SCHEMA]: SchemaError,
  [EXIT_GOVERNANCE]: GovernanceError,
  [EXIT_UNSUPPORTED]: UnsupportedError,
  [EXIT_BUDGET]: BudgetError,
  [EXIT_ADAPTER]: AdapterError,
  [EXIT_HUMAN_REVIEW]: HumanReviewError,
});

/**
 * The two exit codes that 02 §5.2 requires to "halt and surface distinctly" rather than ever be
 * treated as an ordinary/retryable failure. Exported so call sites (and this task's tests) have a
 * single canonical check instead of each re-deriving `code === 3 || code === 7`.
 *
 * @param {number} exitCode
 * @returns {boolean}
 */
export function isHaltingExitCode(exitCode) {
  return exitCode === EXIT_GOVERNANCE || exitCode === EXIT_HUMAN_REVIEW;
}

/**
 * Exit 3 — GOVERNANCE. The live, code-enforced fail-closed emission gate (multi-bundle-conversion-
 * e1-finish, Phase 1, FR-F6, R-2/OQ-1) refuses to emit `rules.json`/`rule-provenance.json` for this
 * `propose` run: at least one `authoring-decisions.yaml` decision referenced by a drafted rule/
 * candidate proposal does not carry `status: "approved_for_rule_draft"` — the ONLY permitting value
 * (an allowlist check, never a denylist of the other enum members). This is a GOVERNANCE refusal,
 * not a content defect: the referenced decision(s) resolve fine, they simply have not (yet, or
 * ever) been approved for rule drafting. Per Phase 1's P1-T8 restructuring, `propose.mjs`'s `run()`
 * catches this condition as a value BEFORE it would otherwise throw and folds it into
 * `conversion-report.json` as a caught, non-fatal signal — `run()` still returns `EXIT_OK` on this
 * path. This class exists (a) so the refusal has one canonical, named, taxonomy-mapped shape whose
 * `.message`/`.refusedDecisions` feed that report, and (b) so a future call site that DOES need to
 * halt on this condition (none exists yet in this build) has a ready-made GOVERNANCE-mapped error
 * to throw, consistent with 02 §5.2's "Block; never override in the converter" posture for exit 3.
 */
export class RuleEmissionRefusedError extends GovernanceError {
  constructor({ refusedDecisions, referencedDecisionIds }) {
    const detail = refusedDecisions.length === 0
      ? 'no decision in authoring-decisions.yaml is referenced by any drafted rule/candidate proposal'
      : refusedDecisions
          .map(({ decisionId, status }) => `${decisionId} (status=${JSON.stringify(status ?? null)})`)
          .join(', ');
    super(
      `rule/rule-provenance emission refused: ${refusedDecisions.length} of ` +
        `${referencedDecisionIds.length} decision(s) referenced by drafted rule proposals did not ` +
        `carry status "approved_for_rule_draft" -- ${detail}. The emission gate is coded as an ` +
        'allowlist (status === "approved_for_rule_draft" is the ONLY permitting condition) -- ' +
        '"rejected", "withdrawn", "drafted_pending_human_approval", and any unrecognized future ' +
        'status value all refuse identically via this same branch. rules.json/rule-provenance.json ' +
        'are not written for this run.',
    );
    this.refusedDecisions = refusedDecisions;
    this.referencedDecisionIds = referencedDecisionIds;
  }
}

/**
 * Exit 2 — SCHEMA. A decision's `basis.rf_claim_ids[]` or `basis.exact_assertion_ids[]` entry does
 * not resolve to a real id in the bundle's own `claims/claim_ledger.yaml` or the module's own
 * `evidence-assertions.json`, respectively (multi-bundle-conversion-e1-finish, Phase 1, P1-T4,
 * FR-F7, OQ-3). `schemas/authoring-decisions.schema.json` documents that it "cannot verify that
 * cross-file resolution itself" — this class is the runtime extension that DOES verify it. Unlike
 * `RuleEmissionRefusedError` above, this is a genuine content/fabrication defect, never a caught,
 * non-fatal signal: `propose.mjs` throws this BEFORE any output (including `mkdir(outDir)`) is
 * written, and it is never swallowed or downgraded by the P1-T8 non-fatal-refusal restructuring.
 */
export class UnresolvedClaimReferenceError extends SchemaError {
  constructor({ kind, id, decisionId }) {
    super(
      `authoring-decisions.yaml decision "${decisionId}" cites ${kind === 'clm' ? 'claim' : 'evidence-assertion'} ` +
        `id "${id}", which does not resolve to a real id in ${
          kind === 'clm' ? 'the bundle\'s claims/claim_ledger.yaml' : 'this module\'s evidence-assertions.json'
        } -- this schema documents that it "cannot verify that cross-file resolution itself"; this ` +
        'runtime check does. No output has been written for this run.',
    );
    this.kind = kind;
    this.id = id;
    this.decisionId = decisionId;
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
