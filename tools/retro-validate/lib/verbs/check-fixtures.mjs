// tools/retro-validate/lib/verbs/check-fixtures.mjs -- `check-fixtures` verb (P4-T1, FR-20;
// access-logged as of P4-T2 -> P4-T7).
//
//   check-fixtures --corpus <dir> [--actor <id>] [--purpose <text>]
//
// Runs the BOUNDARY module (`../boundary.mjs`) against `<dir>/corpus.json` and prints a summary.
// Emits no artifact besides the stdout summary -- this verb, like `inspect` in
// `tools/rf-bundle-to-kb-pack`, is read-only observation. On any FR-20 violation it throws a
// `BoundaryError` (fail-closed, non-zero exit, no partial output) -- it does not catch or soften
// that failure itself; `cli.mjs`'s `dispatchVerb` forwards the exit code verbatim.
//
// P4-T7 (FR-22, ADR-0006 audit clause): the FIRST statement of `run()` below unconditionally
// appends one entry to the access log (`../access-log.mjs#logAccessAttempt`) -- every invocation of
// this verb is audited, including ones that go on to fail the `--corpus` usage check or the
// boundary check. This is a side, corpus-level-only audit channel, distinct from this verb's own
// stdout summary/BoundaryError output.

import { checkFixtures } from '../boundary.mjs';
import { logAccessAttempt } from '../access-log.mjs';
import { UsageError, EXIT_OK } from '../errors.mjs';

/**
 * @param {{ corpus?: string, actor?: string, purpose?: string, accessLogPath?: string }} options
 * @returns {Promise<number>} process exit code (EXIT_OK on success)
 */
export async function run(options) {
  await logAccessAttempt('check-fixtures', options);
  const corpusDir = options?.corpus;
  if (!corpusDir || typeof corpusDir !== 'string') {
    throw new UsageError('check-fixtures requires --corpus <dir>');
  }
  const summary = await checkFixtures(corpusDir);
  process.stdout.write(`${JSON.stringify({ ok: true, ...summary }, null, 2)}\n`);
  return EXIT_OK;
}
