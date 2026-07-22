// tools/release-sign/lib/sign.mjs — `sign` verb (P3-T2, FR-12/FR-15, ruling R3, OQ-6).
//
// Detached Ed25519 signature over the P3-T1 manifest digest (the exact bytes
// `readCanonicalManifestBytes` reads back from `<packDir>/release-manifest.unsigned.json` — never
// re-derived or re-serialized here; see `./canonical-bytes.mjs`'s own header for that boundary).
// `node:crypto`'s native Ed25519 support only — zero new crypto dependencies (decisions block
// Risk 6), the same posture `./canonical-bytes.mjs`/`./manifest.mjs` already hold.
//
// TWO structurally distinct paths, deliberately never allowed to blur into one another:
//
//   1. `--dry-run` — the ONLY path any automated check (test, CI job, or agent) may ever invoke.
//      Generates a fresh Ed25519 keypair in memory (`node:crypto#generateKeyPairSync`), signs with
//      it, and forces the resulting `signature.keyId` to carry the structural `TESTKEY-` prefix
//      (OQ-6) — not merely validated, but PREPENDED unconditionally by `forceTestKeyId` below, so a
//      caller cannot opt out by supplying a `--key-id` that happens to omit it. Neither half of the
//      generated keypair is ever written to disk, logged, returned to the caller, or reachable
//      after `signDryRun` returns — `privateKey` lives only as a local binding in that function's
//      own stack frame and is discarded (GC-eligible) the instant the call completes, which is
//      always well before process exit.
//
//   2. real (no `--dry-run`) — designed for HUMAN OFFLINE execution at gate G2's signing ceremony
//      (docs/governance/signing-ceremony-runbook.md, P3-T7), reading an operator-supplied Ed25519
//      private-key PEM from a path OUTSIDE this repository tree, with a `--key-id` the human
//      signing custodian assigns deliberately (never defaulted, never allowed to carry the
//      `TESTKEY-` marker). This path is never exercised by any automated check in evidence-foundry-
//      e1 (G2 has not happened) — it exists so the tool is ready for that ceremony without a future
//      task having to invent the mechanism under time pressure, and every guard below (key-path-
//      outside-repo, keyId-not-TESTKEY-, keyId-required, key-required) is itself proven by this
//      module's own tests using ONLY failure cases, never a completed real signature — mirroring
//      this tool's own documented posture that "no automated check invokes sign outside dry-run."
//
// CRITICAL, and easy to miss: this module can structurally PRODUCE a real (non-dry-run) signed
// candidate document, but `schemas/release-manifest.schema.json` (P1-T5) has NO branch that admits
// a populated `signature` on anything other than a `dryRun: true` candidate — real-mode output is
// therefore, BY DESIGN, schema-invalid under E1 and will fail `npm run validate` if ever written
// into a real pack directory. That is not a bug this task should "fix": raising the schema's
// ceiling to admit a real signature is a future, separately gated act (post-G2), and this task's
// own acceptance criteria is explicit that no code here may bypass or weaken that forced-empty
// slot. See `tests/ef-release-sign-verify.test.mjs` for the test that proves this directly (a
// dry-run signed candidate validates cleanly; a real-mode structural candidate does not).
//
// No verb in this CLI generates and persists a key pair to disk (there is no `genkey`/`keygen`
// verb at all) — "no key-generation verb writes anything to the tree" therefore holds trivially by
// this tool's own verb table (`manifest | register | sign | verify`, cli.mjs), not merely by
// convention.

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as cryptoSign,
} from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCanonicalManifestBytes } from './canonical-bytes.mjs';
import { UsageError } from './errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** ADR-0005's recommended, and this tool's only supported, signing algorithm. */
export const ED25519_ALGORITHM = 'ed25519';

/**
 * OQ-6's structural dry-run test-key marker. Exported so `verify` (P3-T3) and `register` (P3-T4)
 * check against this ONE literal rather than each re-typing `'TESTKEY-'` independently — the same
 * "one canonical primitive, many consumers" pattern `tools/review-record/lib/chain.mjs`'s own
 * header describes for `stableStringify`/`canonicalRecordHash`.
 */
export const TESTKEY_PREFIX = 'TESTKEY-';

/**
 * Detached Ed25519 signature (base64-encoded) over `data`, using `node:crypto`'s native Ed25519
 * support. Node's own `crypto.sign` contract for Ed25519/Ed448 keys requires the `algorithm`
 * argument to be `null` (no separate digest algorithm is selected or configurable for these curves
 * — the curve's own internal hashing is used) — this function pins that call shape in ONE place so
 * `signDryRun`/`signReal` below (and this module's own regression tests) exercise the identical
 * primitive rather than each re-deriving the `crypto.sign(null, ...)` invocation.
 *
 * @param {Buffer} data the exact bytes being signed — the manifest's canonical signing preimage,
 *   read back verbatim by `./canonical-bytes.mjs#readCanonicalManifestBytes`, never re-serialized.
 * @param {import('node:crypto').KeyObject} privateKey an Ed25519 private `KeyObject`
 * @returns {string} base64-encoded detached signature value (matches
 *   `schemas/release-manifest.schema.json`'s `$defs/dryRunSignature.value` description: "Base64/hex
 *   detached-signature bytes...").
 */
export function signEd25519(data, privateKey) {
  return cryptoSign(null, data, privateKey).toString('base64');
}

/**
 * Forces a dry-run `keyId` to carry the `TESTKEY-` prefix (OQ-6). This is a structural FORCE, not
 * merely a validation-and-reject: whatever the caller supplies (or omits) via `--key-id`, the
 * returned value always carries the marker — a caller cannot construct a dry-run signature whose
 * `keyId` lacks it, closing off the exact "release-path test-key leak in reverse" mistake (a
 * dry-run candidate silently looking like a real one) that P3-T5's own no-keys suite guards
 * against from the other direction (a `TESTKEY-` leaking onto a REAL candidate).
 *
 * @param {string | boolean | undefined} candidateKeyId raw `--key-id` CLI value (a bare `--key-id`
 *   flag with no value parses as boolean `true` under this tool's flag parser — treated the same as
 *   "no hint supplied").
 * @returns {string}
 */
export function forceTestKeyId(candidateKeyId) {
  const base = typeof candidateKeyId === 'string' && candidateKeyId.length > 0
    ? candidateKeyId
    : `ephemeral-${randomBytes(4).toString('hex')}`;
  return base.startsWith(TESTKEY_PREFIX) ? base : `${TESTKEY_PREFIX}${base}`;
}

/**
 * @param {object} options
 * @returns {string}
 */
function resolvePackDir(options) {
  const packDir = typeof options.candidate === 'string'
    ? options.candidate
    : (typeof options.pack === 'string' ? options.pack : undefined);
  if (!packDir) {
    throw new UsageError(
      'sign requires --candidate <pack dir already carrying release-manifest.unsigned.json — the ' +
        'same directory you would pass to the "manifest" verb\'s --pack> (a --pack alias is also ' +
        'accepted, for symmetry with that verb; this tool never builds a manifest itself — run ' +
        '"manifest" first).',
    );
  }
  return packDir;
}

/**
 * The `--dry-run` signing path (OQ-6) — the ONLY path any automated check may invoke. See this
 * file's own header for the full custody/discard guarantee.
 *
 * @param {object} ctx
 * @param {string} ctx.packDir
 * @param {string} ctx.manifestPath
 * @param {Buffer} ctx.bytes the unsigned manifest's exact bytes (the signing preimage)
 * @param {string} ctx.sha256 hex digest of `bytes`
 * @param {string | boolean | undefined} ctx.keyIdHint raw `--key-id` CLI value, if any
 * @param {string | undefined} ctx.out optional `--out` path to also persist the signed candidate to
 * @param {string | undefined} ctx.outPublicKey optional `--out-public-key` path to also persist the
 *   ephemeral signer's public key PEM to
 * @returns {Promise<object>} see `finalizeSignedCandidate`
 */
async function signDryRun({ packDir, manifestPath, bytes, sha256, keyIdHint, out, outPublicKey }) {
  // Fresh, in-memory-only Ed25519 keypair. `privateKey` is used exactly once, immediately below,
  // and then falls out of scope — never assigned to any field this function returns, never
  // written to disk, never logged. Only the PUBLIC half (non-secret by definition) is exported and
  // carried into the result, so a later `verify` invocation — a separate process, with no shared
  // memory and no key registry to consult for an ephemeral test key — can still cryptographically
  // check this signature using the same self-contained candidate document `sign` just produced.
  const { publicKey, privateKey } = generateKeyPairSync(ED25519_ALGORITHM);
  const keyId = forceTestKeyId(keyIdHint);
  const value = signEd25519(bytes, privateKey);
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

  return finalizeSignedCandidate({
    packDir, manifestPath, bytes, sha256, dryRun: true, keyId, value, publicKeyPem, out, outPublicKey,
  });
}

/**
 * The real (non-dry-run) signing path — human-offline design (gate G2), never exercised by any
 * automated check in evidence-foundry-e1. See this file's own header for why every guard below is
 * proven by tests using ONLY failure cases, never a completed real signature.
 *
 * @param {object} ctx
 * @param {string} ctx.packDir
 * @param {string} ctx.manifestPath
 * @param {Buffer} ctx.bytes
 * @param {string} ctx.sha256
 * @param {string | boolean | undefined} ctx.keyPath raw `--key` CLI value
 * @param {string | boolean | undefined} ctx.keyId raw `--key-id` CLI value
 * @param {string | undefined} ctx.out
 * @param {string | undefined} ctx.outPublicKey
 * @returns {Promise<object>}
 */
async function signReal({ packDir, manifestPath, bytes, sha256, keyPath, keyId, out, outPublicKey }) {
  if (typeof keyPath !== 'string' || keyPath.length === 0) {
    throw new UsageError(
      'real (non-dry-run) signing requires --key <path to an operator-supplied Ed25519 private-key ' +
        'PEM, OUTSIDE this repository tree> — this path is designed for human execution at gate ' +
        "G2's offline signing ceremony (docs/governance/signing-ceremony-runbook.md, P3-T7) and is " +
        'never exercised by any automated check in this feature; pass --dry-run for every ' +
        'automated/CI/agent path instead.',
    );
  }
  if (typeof keyId !== 'string' || keyId.length === 0) {
    throw new UsageError(
      'real (non-dry-run) signing requires --key-id <the signing custodian\'s assigned key ' +
        'identity> — there is no default; the identity must be supplied deliberately by the human ' +
        'running the ceremony.',
    );
  }
  if (keyId.startsWith(TESTKEY_PREFIX)) {
    throw new UsageError(
      `real (non-dry-run) signing rejects a --key-id carrying the "${TESTKEY_PREFIX}" prefix — ` +
        'that marker is reserved for --dry-run\'s ephemeral test keys (OQ-6); a real signing-' +
        'ceremony identity must never be labeled as one. This is the release-path test-key leak ' +
        "P3-T5's own no-keys sweep also guards against, enforced here a second time, structurally, " +
        'at the point of signing itself.',
    );
  }
  const resolvedKeyPath = path.resolve(keyPath);
  if (resolvedKeyPath === REPO_ROOT || resolvedKeyPath.startsWith(`${REPO_ROOT}${path.sep}`)) {
    throw new UsageError(
      `real (non-dry-run) signing rejects a --key path inside this repository tree ` +
        `(${resolvedKeyPath}) — gate G2's offline custody model requires the signing key to live ` +
        "outside the repo at ceremony time (docs/governance/signing-ceremony-runbook.md, P3-T7); " +
        'reading a key from inside the tree this tool operates on would make key custody ' +
        "indistinguishable from checked-in key material, which this project never permits (P3-T5's " +
        'no-keys sweep).',
    );
  }

  let pem;
  try {
    pem = await readFile(resolvedKeyPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new UsageError(`no signing key found at ${resolvedKeyPath}`);
    }
    throw err;
  }

  let privateKey;
  try {
    privateKey = createPrivateKey({ key: pem, format: 'pem' });
  } catch (err) {
    throw new UsageError(
      `--key at ${resolvedKeyPath} could not be parsed as a private-key PEM: ${err.message}`,
    );
  }
  if (privateKey.asymmetricKeyType !== ED25519_ALGORITHM) {
    throw new UsageError(
      `--key at ${resolvedKeyPath} is a "${privateKey.asymmetricKeyType ?? 'unknown'}" key — only ` +
        'Ed25519 keys are supported (ADR-0005; decisions block Risk 6: zero new crypto dependencies).',
    );
  }

  const value = signEd25519(bytes, privateKey);
  const publicKeyPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
  return finalizeSignedCandidate({
    packDir, manifestPath, bytes, sha256, dryRun: false, keyId, value, publicKeyPem, out, outPublicKey,
  });
}

/**
 * Shared tail for both signing paths: builds the schema-shaped `signature` object, merges it (plus
 * `dryRun` when true) onto the already-parsed unsigned manifest content to produce the
 * schema-conformant signed document, optionally persists that document to `--out` (NEVER back onto
 * the original `release-manifest.unsigned.json` path — see the guard below), and prints/returns
 * this tool's own reporting object (which, like `./manifest.mjs`'s `candidate` object, is
 * deliberately NOT itself required to satisfy `schemas/release-manifest.schema.json` — its nested
 * `manifest` field is the artifact that schema validates).
 *
 * @returns {Promise<{schemaVersion: string, packDir: string, manifestPath: string,
 *   preimageSha256: string, dryRun: boolean, signature: {algorithm: string, keyId: string, value: string},
 *   signerPublicKey: {algorithm: string, format: string, value: string}, manifest: object,
 *   outPath?: string, outPublicKeyPath?: string}>}
 */
async function finalizeSignedCandidate({
  packDir, manifestPath, bytes, sha256, dryRun, keyId, value, publicKeyPem, out, outPublicKey,
}) {
  const unsignedManifest = JSON.parse(bytes.toString('utf8'));
  const signature = { algorithm: ED25519_ALGORITHM, keyId, value };

  // Schema-conformant merged document. Validates cleanly against
  // schemas/release-manifest.schema.json's dryRunSignature branch when dryRun is true — the ONLY
  // branch under which that schema ever admits a populated `signature`. When dryRun is false, this
  // document deliberately does NOT validate under E1's schema (see this file's own header) — that
  // is the schema's forced-empty guarantee working as designed, not a defect this function may
  // "fix" by, say, omitting the signature or forcing dryRun to true.
  const signedManifest = dryRun
    ? { ...unsignedManifest, dryRun: true, signature }
    : { ...unsignedManifest, signature };

  // The signer's PUBLIC key (non-secret by definition) travels with this tool's own reporting
  // object so a LATER, separate-process `verify` invocation can still cryptographically check the
  // signature — there is no persistent signing-key registry in E1, and for a dry-run/TESTKEY
  // candidate there never will be (the private half is discarded on purpose). This field is a
  // sibling of `manifest`, never merged into it, so `schemas/release-manifest.schema.json`'s
  // `additionalProperties: false` on the signature/manifest shape is never at risk of a field this
  // tool wants to add later breaking it.
  const signerPublicKey = { algorithm: ED25519_ALGORITHM, format: 'spki-pem', value: publicKeyPem };

  const result = {
    schemaVersion: '1.0',
    packDir,
    manifestPath,
    preimageSha256: `sha256:${sha256}`,
    dryRun,
    signature,
    signerPublicKey,
    manifest: signedManifest,
  };

  if (out) {
    const resolvedOut = path.resolve(out);
    if (resolvedOut === path.resolve(manifestPath)) {
      throw new UsageError(
        `--out must not point at the unsigned source manifest itself (${manifestPath}) — ` +
          'tools/release-sign never overwrites release-manifest.unsigned.json in place; write the ' +
          'signed candidate to a distinct path.',
      );
    }
    // Only the schema-conformant `signedManifest` is written here — never the public key, and
    // never `result`'s own wrapper fields — so a file written to `--out` is, on its own, exactly
    // what `schemas/release-manifest.schema.json` describes, nothing more.
    await writeFile(resolvedOut, `${JSON.stringify(signedManifest, null, 2)}\n`, 'utf8');
    result.outPath = resolvedOut;
  }

  if (outPublicKey) {
    const resolvedOutPublicKey = path.resolve(outPublicKey);
    await writeFile(resolvedOutPublicKey, publicKeyPem, 'utf8');
    result.outPublicKeyPath = resolvedOutPublicKey;
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

/**
 * @param {object} [options]
 * @param {string} [options.candidate] pack dir carrying `release-manifest.unsigned.json` (alias:
 *   `pack`).
 * @param {string} [options.pack] alias for `candidate`.
 * @param {boolean} [options.dryRun] OQ-6 dry-run mode — the only mode any automated check may
 *   invoke.
 * @param {string} [options.key] real-mode only: path (outside the repo) to an Ed25519 private-key
 *   PEM.
 * @param {string} [options.keyId] dry-run: optional label, `TESTKEY-`-forced regardless. Real mode:
 *   REQUIRED custodian-assigned identity, must not carry `TESTKEY-`.
 * @param {string} [options.out] optional path to also persist the signed candidate document to.
 * @param {string} [options.outPublicKey] optional path to also persist the signer's public key
 *   (SPKI PEM) to — public keys are non-secret; this is purely a convenience for a later, separate
 *   `verify` invocation, never required for `sign` itself to succeed.
 * @returns {Promise<object>}
 */
export async function run(options = {}) {
  const packDir = resolvePackDir(options);
  const { manifestPath, bytes, sha256 } = await readCanonicalManifestBytes(packDir);
  const isDryRun = options.dryRun === true;

  if (isDryRun) {
    if (typeof options.key === 'string' && options.key.length > 0) {
      throw new UsageError(
        '--dry-run cannot be combined with --key — dry-run signing always uses a freshly generated, ' +
          'in-memory-only ephemeral keypair (OQ-6); accepting an operator-supplied key here would ' +
          'blur the human-offline real-signing (gate G2) and automated-dry-run postures this tool ' +
          'keeps structurally separate.',
      );
    }
    return signDryRun({
      packDir, manifestPath, bytes, sha256,
      keyIdHint: options.keyId, out: options.out, outPublicKey: options.outPublicKey,
    });
  }

  return signReal({
    packDir,
    manifestPath,
    bytes,
    sha256,
    keyPath: options.key,
    keyId: options.keyId,
    out: options.out,
    outPublicKey: options.outPublicKey,
  });
}
