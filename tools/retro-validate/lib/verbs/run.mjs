// tools/retro-validate/lib/verbs/run.mjs -- `run` verb (P4-T1 scaffold -> P4-T2 hardened
// boundary gate; full replay logic lands in P4-T3, FR-19, version-pinned deterministic replay):
//
//   run --corpus <dir> --candidate-digest <registry digest> --registry <path>
//
// ADR-0006 binding clause, hardened here (P4-T2): this verb calls the BOUNDARY module
// (`../boundary.mjs#checkFixtures`) FIRST, unconditionally, before any of its own logic --
// `check-fixtures` is the structural gate every other verb calls first, and it is never
// bypassable by a later verb. A corpus that is unchecked (no `--corpus` given) or failing (any
// FR-20 violation) causes this verb to refuse to start: a missing `--corpus` throws `UsageError`,
// and a failing corpus throws `BoundaryError` (fail-closed, non-zero exit, no partial output) --
// in both cases BEFORE the scaffold-only `NotImplementedError` below is ever reached. Once P4-T3
// lands, the real replay logic is appended after this same `checkFixtures` call; this call site
// does not move.
//
// Until P4-T3 lands the real replay logic, a corpus that PASSES the boundary check still throws
// `NotImplementedError` -- this verb performs no replay, no I/O beyond the boundary check, and
// writes no artifact.
//
// P4-T7 (FR-22, ADR-0006 audit clause): the FIRST statement of `run()` below unconditionally
// appends one entry to the access log (`../access-log.mjs#logAccessAttempt`) -- BEFORE even the
// boundary gate, so an unchecked/failing/scaffold-blocked invocation is audited exactly like a
// successful one. This does not move the boundary gate's own call-site (still the first REAL logic
// after the usage check) -- see `tests/ef-retro-boundary.test.mjs` for the call-order proof that
// remains true unchanged.

import { checkFixtures } from '../boundary.mjs';
import { logAccessAttempt } from '../access-log.mjs';
import { NotImplementedError, UsageError } from '../errors.mjs';

/**
 * @param {{ corpus?: string, actor?: string, purpose?: string, accessLogPath?: string }} options
 * @returns {Promise<never>}
 * @throws {UsageError} no `--corpus` given
 * @throws {import('../errors.mjs').BoundaryError} the corpus fails the FR-20 boundary (checked FIRST)
 * @throws {NotImplementedError} the corpus passed the boundary check, but replay itself is not yet built (lands in P4-T3)
 */
export async function run(options) {
  await logAccessAttempt('run', options);
  const corpusDir = options?.corpus;
  if (!corpusDir || typeof corpusDir !== 'string') {
    throw new UsageError('run requires --corpus <dir>');
  }
  // ADR-0006 binding clause: the boundary gate runs FIRST, unconditionally -- a failing or
  // unchecked corpus never reaches this verb's own logic (currently: the scaffold below).
  await checkFixtures(corpusDir);
  throw new NotImplementedError('run', 'P4-T3');
}
