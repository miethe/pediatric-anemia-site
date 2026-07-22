// tools/release-sign/lib/registry.mjs — `register` verb (scaffolded P3-T1; implemented P3-T4).
//
// Will implement appending a release candidate to `releases/registry.json` (top-level
// `schemaVersion` + `entries[]`, validated against the P1-T5 registry schema): dry-run candidates
// carry the structural dry-run marker, real entries have `signature: null` pre-gate-G2, and any
// mutation or removal of an existing entry is rejected (append-only, git-tracked — FR-14, OQ-4).
//
// This file is a structural stub only: `cli.mjs` already dispatches the `register` verb to it so
// `--help` and the CLI's verb table are stable across P3-T1..T4, but no registry logic exists yet.

import { NotImplementedError } from './errors.mjs';

/**
 * @param {object} [_options]
 * @returns {Promise<never>}
 */
export async function run(_options = {}) {
  throw new NotImplementedError(
    'P3-T4',
    'append-only releases/registry.json seed + register verb (FR-14, OQ-4)',
  );
}
