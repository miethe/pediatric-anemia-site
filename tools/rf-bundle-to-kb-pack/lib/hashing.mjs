// tools/rf-bundle-to-kb-pack/lib/hashing.mjs — SHA-256 hash pinning, the "Pin" phase
// (P2-T1 scaffold; implemented by P2-T3, FR-7, 02 §4.6 Phase 1, seam invariant 5).
//
// Module boundary (defined here, filled in by P2-T3):
//
//   pinArtifacts(loadedBundle) -> Promise<PinnedBundle>
//
// Contract P2-T3 must satisfy:
//   - SHA-256 every input artifact before any transformation step: `run_id`, bundle ID, bundle
//     bytes, claim-ledger bytes, and every referenced source-card's bytes (02 §2.3 item 5,
//     §4.6 Phase 1).
//   - Fail closed (throw a `SchemaError`/`UsageError`-family `ConverterError`, see
//     `lib/errors.mjs`) on: a missing artifact, a path-escape attempt outside the run directory
//     (e.g. a `../` component in an artifact path), or a hash mismatch against
//     `evidence_bundle.yaml`'s recorded values.
//   - Operates only on the `LoadedBundle` `loader.mjs` (P2-T2) returns — this module must not
//     re-resolve paths itself; that responsibility belongs to the loader.
//
// PinnedBundle shape is left for P2-T3 to define; downstream (eligibility.mjs, the `inspect` verb)
// should be able to read a flat map of artifact path -> sha256 hex digest at minimum.

import { NotImplementedError } from './errors.mjs';

/**
 * @param {object} _loadedBundle the value `loader.loadBundle()` (P2-T2) resolves to
 * @returns {Promise<object>} the loaded bundle plus a per-artifact SHA-256 hash map
 */
export async function pinArtifacts(_loadedBundle) {
  throw new NotImplementedError('P2-T3', 'lib/hashing.js#pinArtifacts');
}
