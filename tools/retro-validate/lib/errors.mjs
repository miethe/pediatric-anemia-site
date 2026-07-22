// tools/retro-validate/lib/errors.mjs -- fail-closed error taxonomy for the retrospective
// validation harness (P4-T1 scaffold, Evidence Foundry E1 Phase 4, FR-19/FR-20, ADR-0006).
//
// A small, closed taxonomy -- this tool has none of `rf`'s governance/budget/adapter states, so it
// does not borrow the 8-code taxonomy `tools/rf-bundle-to-kb-pack/lib/errors.mjs` defines for that
// different problem. Two EXIT codes only:
//
//   0 OK      -- success (no thrown error; `dispatchVerb` in cli.mjs returns this by default)
//   1 USAGE   -- bad CLI invocation, unreadable/unparsable input, an as-yet-unbuilt verb, or (as of
//                P4-T3) a `RegistryError` -- see below. Deliberately NOT a distinct numeric exit
//                code: a registry/candidate-resolution failure is a bad-invocation-shaped problem
//                (an inconsistent --candidate-digest/--registry pairing, drifted pinned content),
//                not a NEW structural gate the way FR-20's boundary is -- `RegistryError` gets its
//                own CLASS (for class-identifiable error messages/tests), not its own EXIT code.
//   2 BOUNDARY -- the FR-20 structural de-identification boundary rejected the corpus: an
//                identifier-bearing case, a case missing its `provenance` marker, or a corpus
//                missing `sourceAttestation`. This is the ONE code every other verb (`run`,
//                `report`, hardened in P4-T2) refuses to proceed past -- never remapped to a
//                generic failure, never silently downgraded to a partial/soft warning.
//
// `RetroValidateError` (and its subclasses below) is the ONLY sanctioned way a verb handler
// signals a taxonomy-mapped failure to `cli.mjs`'s `dispatchVerb` -- which forwards `exitCode`
// verbatim, exactly like `tools/rf-bundle-to-kb-pack/lib/errors.mjs`'s own contract. Any other
// thrown value (a genuine bug) falls back to EXIT_USAGE there, never invented as a new code.

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
 * (`run` -> P4-T3, landed; `report` -> P4-T4).
 */
export class NotImplementedError extends UsageError {
  constructor(verb, ownerTask) {
    super(`verb "${verb}" is scaffolded but not yet implemented (lands in ${ownerTask})`);
  }
}

/**
 * `run`'s FR-19 candidate-resolution failure class (P4-T3, `lib/replay.mjs#resolveCandidate`):
 * the `--registry` document fails `schemas/release-registry.schema.json`; no entry's `packDigest`
 * matches `--candidate-digest` (an "unpinned candidate" -- the exact "never current tree" case);
 * the matching entry's `moduleId` is not a registered module; the entry's pinned candidate
 * directory (`<registry dir>/candidates/<moduleId>/<version>/{rules,candidates}.json`) is missing;
 * or the pinned candidate content's own recomputed digest disagrees with the registry entry's
 * `packDigest` (drift). Every one of these is fail-closed: `run` writes zero output for any of
 * them (see `lib/verbs/run.mjs` -- replay-output is only ever written after the FULL replay
 * document is built, never incrementally). Maps to `EXIT_USAGE` (see this file's header for why
 * this is a distinct CLASS, not a distinct exit code) -- but is never a `NotImplementedError`, so
 * a test can tell "resolution refused" apart from "not built yet" by class alone.
 */
export class RegistryError extends UsageError {
  constructor(message) {
    super(message);
  }
}

/**
 * FR-24's structural prespecified-protocol shape gate (P4-T6, `lib/protocol.mjs#assertProtocolShape`):
 * thrown when a `--protocol` document fails `schemas/protocol.schema.json` -- in particular, when
 * it declares any non-null value where the schema requires `const: null` (a populated-threshold
 * document), or omits a required human-authorship/threshold-slot field. Maps to `EXIT_USAGE` (same
 * non-taxonomy-bloat rationale `RegistryError` above documents: a rejected protocol document is a
 * bad-document-shape problem, not a NEW structural exit code the way FR-20's corpus boundary is)
 * but gets its own CLASS so a test -- or a future caller -- can tell "protocol shape rejected"
 * apart from any other `UsageError` by class alone.
 */
export class ProtocolError extends UsageError {
  constructor(message) {
    super(message);
  }
}
