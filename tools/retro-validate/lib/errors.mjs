// tools/retro-validate/lib/errors.mjs -- fail-closed error taxonomy for the retrospective
// validation harness (P4-T1 scaffold, Evidence Foundry E1 Phase 4, FR-19/FR-20, ADR-0006).
//
// A small, closed taxonomy -- this tool has none of `rf`'s governance/budget/adapter states, so it
// does not borrow the 8-code taxonomy `tools/rf-bundle-to-kb-pack/lib/errors.mjs` defines for that
// different problem. Three states only:
//
//   0 OK      -- success (no thrown error; `dispatchVerb` in cli.mjs returns this by default)
//   1 USAGE   -- bad CLI invocation, unreadable/unparsable input, or an as-yet-unbuilt verb
//   2 BOUNDARY -- the FR-20 structural de-identification boundary rejected the corpus: an
//                identifier-bearing case, a case missing its `provenance` marker, or a corpus
//                missing `sourceAttestation`. This is the ONE code every other verb (`run`,
//                `report`, hardened in P4-T2) refuses to proceed past -- never remapped to a
//                generic failure, never silently downgraded to a partial/soft warning.
//
// `RetroValidateError` (and its two subclasses below) is the ONLY sanctioned way a verb handler
// signals a taxonomy-mapped failure to `cli.mjs`'s `dispatchVerb` -- which forwards `exitCode`
// verbatim, exactly like `tools/rf-bundle-to-kb-pack/lib/errors.mjs`'s own contract. Any other
// thrown value (a genuine bug) falls back to EXIT_USAGE there, never invented as a 4th code.

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_BOUNDARY = 2;

export class RetroValidateError extends Error {
  constructor(message, exitCode) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
  }
}

/** Bad CLI invocation, unreadable/unparsable corpus file, or an unbuilt verb. */
export class UsageError extends RetroValidateError {
  constructor(message) {
    super(message, EXIT_USAGE);
  }
}

/**
 * The FR-20 structural de-identification boundary rejected a corpus (identifier-bearing case,
 * missing `provenance` marker, or missing corpus-level `sourceAttestation`). Thrown by
 * `lib/boundary.mjs#checkFixtures` -- see that file for the fail-closed, no-partial-output
 * contract this class exists to carry (ADR-0006's binding boundary clause).
 */
export class BoundaryError extends RetroValidateError {
  constructor(message) {
    super(message, EXIT_BOUNDARY);
  }
}

/**
 * Marks a verb defined in `cli.mjs`'s dispatch table but not yet built. Scaffold-only, exactly
 * like `tools/rf-bundle-to-kb-pack`'s own `NotImplementedError` precedent -- not part of the
 * permanent taxonomy, and should disappear from a verb as its owning task lands real logic
 * (`run` -> P4-T3, `report` -> P4-T4).
 */
export class NotImplementedError extends UsageError {
  constructor(verb, ownerTask) {
    super(`verb "${verb}" is scaffolded but not yet implemented (lands in ${ownerTask})`);
  }
}
