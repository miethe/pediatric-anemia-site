// tools/release-sign/lib/sign.mjs — `sign` verb (scaffolded P3-T1; implemented P3-T2).
//
// Will implement detached Ed25519 signing over the P3-T1 manifest digest (FR-12/FR-15, ruling
// R3): human-offline design (reads a key from an operator-supplied path outside the repo at
// ceremony time — gate G2, never exercised in this feature), plus a `--dry-run` mode (OQ-6:
// ephemeral in-memory keypair, `keyId` forced to a `TESTKEY-` prefix, private key discarded at
// process exit) that is the only path any automated check may invoke. `node:crypto`'s native
// Ed25519 support only — zero new crypto dependencies (decisions block Risk 6).
//
// This file is a structural stub only: `cli.mjs` already dispatches the `sign` verb to it so
// `--help` and the CLI's verb table are stable across P3-T1..T4, but no signing logic exists yet.

import { NotImplementedError } from './errors.mjs';

/**
 * @param {object} [_options]
 * @returns {Promise<never>}
 */
export async function run(_options = {}) {
  throw new NotImplementedError(
    'P3-T2',
    'Ed25519 detached signing over the manifest digest, human-offline design with an OQ-6 ' +
      '--dry-run ephemeral-key mode',
  );
}
