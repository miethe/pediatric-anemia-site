// tools/rf-bundle-to-kb-pack/lib/verbs/inspect.mjs — `inspect` verb
// (P2-T1 scaffold; implemented by P2-T6, 02 §4.5).
//
// Contract P2-T6 must satisfy:
//   - `inspect --run-dir <dir> --module <module.json path>` runs loader.loadBundle (P2-T2) ->
//     hashing.pinArtifacts (P2-T3) -> eligibility.checkEligibility (P2-T4), in that order, and
//     prints a structured, non-empty summary (artifact list, hashes, eligibility pass/fail per
//     claim) to stdout. It MUST NOT emit any pack output (that is `propose`'s job, Phase 3).
//   - Zero network calls, zero LLM/generative-model invocations (FR-10) — a test asserts this.
//   - Resolves to a process exit code per `lib/errors.mjs`'s taxonomy (EXIT_OK on a clean
//     inspection of a `verified` bundle; a `ConverterError` subclass's own code otherwise).
//
// Verb-handler contract (applies to every file in this directory): an async `run(options)`
// function that either resolves to a numeric exit code (see `lib/errors.mjs`'s `EXIT_*`
// constants) or throws a `ConverterError` (or subclass) — `cli.mjs` forwards a thrown
// `ConverterError`'s `exitCode` untouched.

import { NotImplementedError } from '../errors.mjs';

/**
 * @param {{ runDir?: string, module?: string }} _options parsed CLI flags for this verb
 * @returns {Promise<number>} process exit code
 */
export async function run(_options) {
  throw new NotImplementedError('P2-T6', 'lib/verbs/inspect.js#run');
}
