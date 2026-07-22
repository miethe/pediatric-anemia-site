// tools/retro-validate/lib/verbs/check-fixtures.mjs -- `check-fixtures` verb (P4-T1, FR-20).
//
//   check-fixtures --corpus <dir>
//
// Runs the BOUNDARY module (`../boundary.mjs`) against `<dir>/corpus.json` and prints a summary.
// Emits no artifact besides the stdout summary -- this verb, like `inspect` in
// `tools/rf-bundle-to-kb-pack`, is read-only observation. On any FR-20 violation it throws a
// `BoundaryError` (fail-closed, non-zero exit, no partial output) -- it does not catch or soften
// that failure itself; `cli.mjs`'s `dispatchVerb` forwards the exit code verbatim.

import { checkFixtures } from '../boundary.mjs';
import { UsageError, EXIT_OK } from '../errors.mjs';

/**
 * @param {{ corpus?: string }} options
 * @returns {Promise<number>} process exit code (EXIT_OK on success)
 */
export async function run(options) {
  const corpusDir = options?.corpus;
  if (!corpusDir || typeof corpusDir !== 'string') {
    throw new UsageError('check-fixtures requires --corpus <dir>');
  }
  const summary = await checkFixtures(corpusDir);
  process.stdout.write(`${JSON.stringify({ ok: true, ...summary }, null, 2)}\n`);
  return EXIT_OK;
}
