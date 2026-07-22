// tools/retro-validate/lib/verbs/run.mjs -- `run` verb SCAFFOLD ONLY (P4-T1). Real implementation
// lands in P4-T3 (FR-19, version-pinned deterministic replay):
//
//   run --corpus <dir> --candidate-digest <registry digest> --registry <path>
//
// P4-T3 will call the BOUNDARY module (`../boundary.mjs#checkFixtures`) FIRST and refuse to start
// on an unchecked or failing corpus (ADR-0006 binding clause, hardened by P4-T2), then replay
// every corpus case through the engine build the pinned registry digest identifies -- never
// "current tree" -- emitting canonically-serialized, byte-identical-across-runs metric artifacts.
// Until then this verb only throws, so `cli.mjs` has a stable handler to dispatch to.

import { NotImplementedError } from '../errors.mjs';

/**
 * @param {object} _options
 * @returns {Promise<never>}
 * @throws {NotImplementedError} always, until P4-T3 lands
 */
export async function run(_options) {
  throw new NotImplementedError('run', 'P4-T3');
}
