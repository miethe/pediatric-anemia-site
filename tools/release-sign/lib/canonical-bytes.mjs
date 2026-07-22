// tools/release-sign/lib/canonical-bytes.mjs — the single place `tools/release-sign` reads the
// deterministic signing preimage for a release candidate (P3-T1, FR-12, decisions block Risk 6).
//
// This module NEVER re-implements JSON canonicalization or serialization. E0's
// `rf-bundle-to-kb-pack` `propose` verb (tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs,
// P5-T1/P5-T5) is the only code in this repository that builds and canonically serializes
// `release-manifest.unsigned.json` — deterministic field order (`buildReleaseManifest`'s own
// object-literal shape), no embedded timestamps in hashed content, sorted/derived hashes
// throughout, written to disk verbatim as `${JSON.stringify(manifest, null, 2)}\n`. ADR-0005
// (`docs/adr/0005-kb-serialization-signing-key-custody.md`) states this explicitly: "signing
// anything other than the exact canonical bytes already hashed for release-manifest.unsigned.json
// would silently reopen the non-deterministic-serialization risk."
//
// This module reads those bytes back off disk, Buffer-for-Buffer, and hashes them with
// `node:crypto` — zero re-parsing, re-stringification, or re-ordering of its own. That makes it
// structurally impossible for the "canonical bytes" this module reports to diverge from what
// `propose.mjs` actually wrote, rather than merely conventionally likely.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { UsageError } from './errors.mjs';

/** The filename E0's `propose` verb writes the unsigned release manifest as (P5-T1). */
export const RELEASE_MANIFEST_FILENAME = 'release-manifest.unsigned.json';

/**
 * @param {Buffer | Uint8Array} bytes
 * @returns {string} lowercase hex SHA-256 digest
 */
export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Reads `<packDir>/release-manifest.unsigned.json` verbatim — the exact bytes E0's `propose`
 * verb wrote, untouched — and returns them alongside their SHA-256 hex digest: the signing
 * preimage (FR-12) every later `register`/`sign`/`verify` verb in this tool operates on.
 *
 * Fails closed (`UsageError`) when the file does not exist: `tools/release-sign` never builds a
 * pack's `release-manifest.unsigned.json` itself (that is `rf-bundle-to-kb-pack propose`'s job,
 * called via `./manifest.mjs`, or already run by the caller ahead of time) — a missing manifest
 * means "run propose first," never "silently proceed with no preimage."
 *
 * @param {string} packDir a `build/kb-pack/<moduleId>/<packVersion>/` directory
 * @returns {Promise<{manifestPath: string, bytes: Buffer, sha256: string}>}
 */
export async function readCanonicalManifestBytes(packDir) {
  if (!packDir || typeof packDir !== 'string') {
    throw new UsageError('readCanonicalManifestBytes requires a pack directory path');
  }
  const manifestPath = path.join(packDir, RELEASE_MANIFEST_FILENAME);
  let bytes;
  try {
    bytes = await readFile(manifestPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new UsageError(
        `no ${RELEASE_MANIFEST_FILENAME} found at ${manifestPath} — run rf-bundle-to-kb-pack's ` +
          '"propose" verb first (directly, or via this tool\'s "manifest" verb with ' +
          '--run-dir/--module/--decisions/--out); tools/release-sign never authors this file itself.',
      );
    }
    throw err;
  }
  return { manifestPath, bytes, sha256: sha256Hex(bytes) };
}

/**
 * Fail-closed byte-identity comparison against a pinned golden-bytes regression fixture (P3-T1's
 * own acceptance criteria: "golden drift fails the phase, never silently re-baselines"). Throws
 * `GoldenDriftError` on any disagreement — imported lazily-by-caller, not here, to keep this
 * module's own import graph minimal (`errors.mjs` already exports it).
 *
 * @param {Buffer} actualBytes
 * @param {Buffer} goldenBytes
 * @param {string} label a human-readable identifier for the comparison, used in the error message
 * @param {new (label: string, expected: string, actual: string) => Error} GoldenDriftErrorClass
 */
export function assertGoldenBytesMatch(actualBytes, goldenBytes, label, GoldenDriftErrorClass) {
  const actualSha256 = sha256Hex(actualBytes);
  const expectedSha256 = sha256Hex(goldenBytes);
  if (!actualBytes.equals(goldenBytes)) {
    throw new GoldenDriftErrorClass(label, expectedSha256, actualSha256);
  }
}
