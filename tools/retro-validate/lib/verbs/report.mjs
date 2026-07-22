// tools/retro-validate/lib/verbs/report.mjs -- `report` verb SCAFFOLD ONLY (P4-T1). Real
// implementation lands in P4-T4 (FR-21/OQ-5, software-agreement metrics + provenance sidecar):
//
//   report --corpus <dir> --run <replay output dir> --protocol <protocol.schema.json-shaped doc>
//
// P4-T4 will call the BOUNDARY module (`../boundary.mjs#checkFixtures`) FIRST (same refusal
// contract as `run`), then emit `agreement-report.json` (exactly the 5 OQ-5 software-agreement
// measures, header carrying the unvalidated-prototype banner + non-clinical-performance negation
// + the FR-24 non-qualifying-protocol banner when the P4-T6 protocol is unpopulated) plus a
// `run-provenance.json` sidecar (the sole timestamp location). Until then this verb only throws,
// so `cli.mjs` has a stable handler to dispatch to.

import { NotImplementedError } from '../errors.mjs';

/**
 * @param {object} _options
 * @returns {Promise<never>}
 * @throws {NotImplementedError} always, until P4-T4 lands
 */
export async function run(_options) {
  throw new NotImplementedError('report', 'P4-T4');
}
