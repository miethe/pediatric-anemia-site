// tools/release-sign/lib/verify.mjs — `verify` verb (scaffolded P3-T1; implemented P3-T3).
//
// Will implement fail-closed verification of a signed/dry-run candidate against
// `releases/registry.json`, with a documented exit-code taxonomy (FR-13): 0 ok, distinct
// non-zero codes for each of 5 failure classes — (1) byte drift vs canonical bytes, (2) digest
// mismatch vs manifest, (3) unknown `keyId`, (4) registry inconsistency, (5) `TESTKEY-` identity
// on a non-dry-run candidate. Non-zero exit produces no partial output. `verify` is the sole
// CI/agent-reachable surface of this tool — CI can never sign (ruling R3).
//
// This file is a structural stub only: `cli.mjs` already dispatches the `verify` verb to it so
// `--help` and the CLI's verb table are stable across P3-T1..T4, but no verification logic
// exists yet.

import { NotImplementedError } from './errors.mjs';

/**
 * @param {object} [_options]
 * @returns {Promise<never>}
 */
export async function run(_options = {}) {
  throw new NotImplementedError(
    'P3-T3',
    'fail-closed exit-code taxonomy over 5 documented failure classes (FR-13)',
  );
}
