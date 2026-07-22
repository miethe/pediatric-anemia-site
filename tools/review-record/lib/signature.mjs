// tools/review-record/lib/signature.mjs — Ed25519 record-signature binding, dry-run only
// (P2-T5, FR-10/OQ-2/OQ-6).
//
// Implements the ONE `signature` mechanism `schemas/review-record.schema.json`'s own top-level
// description and `allOf` already name: a detached Ed25519 signature over the "canonicalized record
// bytes minus the signature object" (the same ADR-0005 mechanism `tools/release-sign` uses for
// release-manifest signing, applied here to a review-record document instead), binding `reviewerId`
// to `subjectContentHash` (and every other field of the record) by construction -- any change to any
// field other than `signature` itself invalidates the signature.
//
// E1 signing exists ONLY in synthetic dry-run mode (OQ-6, decisions block Risk 1, FR-15 "no agent/CI
// keys ever"):
//   - `signRecordDryRun` generates a FRESH Ed25519 keypair in memory
//     (`node:crypto#generateKeyPairSync`) on every call, never reads one from a file or a CLI flag
//     (there is no `--test-keys` flag anywhere in this tool, deliberately), and never writes either
//     half of the keypair to disk. The private key is used exactly once, in this function's own
//     stack frame, to produce `value`, and is not retained anywhere this function returns --
//     GC-eligible the instant the call completes.
//   - It refuses (`UsageError`, fails closed) to sign anything but a `synthetic: true` record with no
//     signature already attached -- "writable only onto synthetic:true records" is enforced HERE, at
//     the point of signing, not left to a caller's discipline. A `synthetic: false` (real) record's
//     signature slot stays schema-forced `null` until gates G1/G2 clear
//     (`schemas/review-record.schema.json`'s own `allOf`); this module must never be the mechanism
//     that bypasses that ceiling.
//   - `keyId` is FORCED to carry the structural `TESTKEY-` prefix (OQ-6) -- not merely validated,
//     but constructed with the prefix unconditionally, so no caller can produce a dry-run signature
//     whose `keyId` lacks it.
//
// Self-certifying `keyId` (the design choice this module makes, and the reason it needs no separate
// "public key" field or persistent test-key registry): `schemas/review-record.schema.json`'s
// `signature` object has EXACTLY three fields (`algorithm`, `keyId`, `value`,
// `additionalProperties: false`) -- there is no fourth slot to carry the ephemeral signer's public
// key alongside the signature, and OQ-6 explicitly rules out any persistent key material ("nothing
// for CI or an agent to hold"). So this module encodes the ephemeral public key's raw Ed25519
// x-coordinate -- the exact bytes a JWK `x` field carries, base64url-encoded, 43 characters for a
// 32-byte Ed25519 public key -- directly INTO `keyId`, immediately after the required `TESTKEY-`
// prefix: `TESTKEY-<43-char base64url x-coordinate>`. This makes `keyId` itself the one artifact a
// later, wholly separate process (a fresh `validate` invocation, possibly days later, with no shared
// memory and no key registry to consult) needs to cryptographically verify the signature -- using
// ONLY what the committed record file itself carries. `verifyRecordSignature` below is the sole
// reader of this encoding.
//
// This is honest, not a workaround: the public half of an Ed25519 keypair is non-secret by
// definition (that is the entire point of a public key), so folding it into the identity label that
// already exists (`keyId`) loses nothing a dedicated field would have provided, while adding zero new
// schema surface to a schema whose signature slot is otherwise deliberately minimal and forced-empty
// on every real record.

import {
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto';

import { stableStringify } from './chain.mjs';
import { UsageError } from './errors.mjs';

/** The single legal `signature.algorithm` value (ADR-0005; matches `tools/release-sign`'s own pin). */
export const ED25519_ALGORITHM = 'ed25519';

/** JWK `crv` value for Ed25519 keys, per RFC 8037. */
const ED25519_JWK_CRV = 'Ed25519';

/**
 * OQ-6's structural dry-run test-key marker. Every populated `signature.keyId` this module ever
 * produces or accepts carries this prefix -- the same literal `tools/release-sign/lib/sign.mjs`'s
 * `TESTKEY_PREFIX` uses for the sibling release-manifest-signing tool (independent constant, same
 * value, deliberately not imported cross-tool -- these are two different tools with two different
 * signature-object shapes, see this file's header).
 */
export const TESTKEY_PREFIX = 'TESTKEY-';

/**
 * The exact deterministic signing preimage (FR-10/OQ-2: "canonicalized record bytes minus the
 * signature object") -- `lib/chain.mjs`'s ONE canonical `stableStringify` serialization, applied to
 * the record with its `signature` key entirely OMITTED (not set to `null`; genuinely absent from the
 * object serialized), so the bytes signed never depend on the very value being computed. Reused
 * identically by both `signRecordDryRun` (to produce `value`) and `verifyRecordSignature` (to
 * recompute what SHOULD have been signed) -- one preimage definition, two consumers, exactly the
 * pattern `lib/chain.mjs`'s own header documents for `canonicalRecordHash`.
 *
 * @param {object} record a parsed review-record document (with or without a `signature` key already
 *   present -- either way, it is excluded from the returned bytes)
 * @returns {Buffer}
 */
export function signingPreimageBytes(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new UsageError('signingPreimageBytes requires a parsed review-record object');
  }
  const { signature: _signature, ...withoutSignature } = record;
  return Buffer.from(stableStringify(withoutSignature), 'utf8');
}

/**
 * Dry-run-only Ed25519 signing (OQ-6). Generates a fresh, ephemeral, in-memory-only keypair,
 * signs `signingPreimageBytes(record)` with the private half, and returns a NEW record object
 * (the input is never mutated) whose `signature` is the resulting `{algorithm, keyId, value}` --
 * see this file's header for the full custody guarantee and the self-certifying-`keyId` design.
 *
 * Fails closed (`UsageError`) rather than signing when:
 *   - `record.synthetic` is not `true` -- "writable only onto synthetic:true records" (OQ-6); a
 *     `synthetic: false` record must never leave this function carrying a populated signature.
 *   - `record.signature` is already populated -- a review record is immutable once fully composed;
 *     signing happens exactly once, before the record is finalized, never as a re-sign/mutation of an
 *     already-signed value.
 *
 * @param {object} record a fully-shaped draft review-record document (e.g.
 *   `lib/verbs/scaffold.mjs`'s `buildDraftRecord` output) with `synthetic: true` and
 *   `signature: null`
 * @returns {object} a new record object, identical to `record` except `signature` is now populated
 */
export function signRecordDryRun(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new UsageError('signRecordDryRun requires a parsed review-record object');
  }
  if (record.synthetic !== true) {
    throw new UsageError(
      `signRecordDryRun refuses to sign moduleId="${record.moduleId ?? '?'}" ` +
        `review_id="${record.review_id ?? '?'}" -- dry-run TESTKEY- signing (OQ-6) is writable ONLY ` +
        'onto synthetic:true records; a synthetic:false (real) record\'s signature slot stays ' +
        'schema-forced null until gates G1/G2 clear, and this function must never be the mechanism ' +
        'that bypasses that ceiling.',
    );
  }
  if (record.signature !== null && record.signature !== undefined) {
    throw new UsageError(
      `signRecordDryRun refuses to re-sign review_id="${record.review_id ?? '?'}" -- it already ` +
        'carries a populated signature; a review-record document is immutable once composed, so ' +
        'signing happens exactly once, before the record is finalized, never as a mutation of an ' +
        'already-signed value.',
    );
  }

  // Fresh, in-memory-only Ed25519 keypair -- generated fresh on every call, never read from a file
  // or CLI flag (no --test-keys flag anywhere in this tool), never written to disk. `privateKey` is
  // used exactly once, immediately below, and then falls out of scope with this function's own stack
  // frame -- nothing this function returns carries it.
  const { publicKey, privateKey } = generateKeyPairSync(ED25519_ALGORITHM);
  const preimage = signingPreimageBytes(record);
  const value = cryptoSign(null, preimage, privateKey).toString('base64');

  // Self-certifying keyId -- see this file's header for why the public key is embedded here rather
  // than in a dedicated field. `format: 'jwk'` on an Ed25519 KeyObject yields `{kty:'OKP',
  // crv:'Ed25519', x:<base64url>}` per RFC 8037/RFC 8037's JOSE mapping -- `x` is exactly the raw
  // 32-byte public key, base64url-encoded, no padding.
  const { x: rawPublicKeyB64Url } = publicKey.export({ format: 'jwk' });
  const keyId = `${TESTKEY_PREFIX}${rawPublicKeyB64Url}`;

  return { ...record, signature: { algorithm: ED25519_ALGORITHM, keyId, value } };
}

/**
 * Fail-closed verification of one already-parsed review record's `signature` field. Never throws --
 * every failure mode (usage-shaped or cryptographic) is reported as a structured `{ok:false, reason}`
 * so callers (`lib/verbs/validate.mjs`) can collect it alongside every other violation kind (schema,
 * roster, chain, ...) in one pass, matching this tool's established "collect every violation, not
 * just the first" convention.
 *
 * Verification order (each a distinct, honestly-worded reason string):
 *   1. `signature: null` on a `synthetic: true` record -- REJECTED: the schema requires a populated
 *      TESTKEY- signature on every synthetic:true record; a null signature there is itself a
 *      violation, not "nothing to check."
 *   2. `signature: null` on a `synthetic: false` record -- ACCEPTED (`ok: true`): this is exactly the
 *      forced-empty ceiling this program requires pre-G1/G2; there is nothing to cryptographically
 *      verify, and that is correct, not a gap.
 *   3. A populated `signature` on a `synthetic: false` record -- REJECTED, unconditionally, before
 *      any cryptographic check runs: a real record can never legitimately carry a populated
 *      signature in E1 (schema's own `allOf` already forces this at the schema layer; this is a
 *      second, independent enforcement at the tool layer).
 *   4. Shape checks on a populated signature (`algorithm === "ed25519"`, `keyId` starts with
 *      `TESTKEY-`, `value` a non-empty string) -- REJECTED on any mismatch.
 *   5. The embedded public key (`keyId`'s suffix) must parse as a valid Ed25519 JWK x-coordinate, and
 *      `value` must decode as base64 -- REJECTED (a distinct, honestly-worded reason) if either
 *      parse fails.
 *   6. Cryptographic verification of `value` against `signingPreimageBytes(record)` using the
 *      recovered public key -- REJECTED ("tamper detected") on any mismatch: a bit flipped anywhere
 *      in the record (including `reviewerId`, `decision`, `rationale`, `subjectContentHash`, ...)
 *      after signing changes the preimage and breaks this check.
 *
 * @param {object} record a parsed review-record document
 * @returns {{ok: boolean, reason: string|null}}
 */
export function verifyRecordSignature(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, reason: 'record is not an object' };
  }

  const sig = record.signature;

  if (sig === null || sig === undefined) {
    if (record.synthetic === true) {
      return {
        ok: false,
        reason: 'synthetic:true record carries no signature -- schemas/review-record.schema.json ' +
          'requires a populated TESTKEY- signature on every synthetic:true record.',
      };
    }
    // synthetic:false (real) record with signature: null is exactly the forced-empty ceiling this
    // program requires pre-G1/G2 -- nothing to cryptographically verify, and that absence is
    // correct, not a gap.
    return { ok: true, reason: null };
  }

  if (record.synthetic !== true) {
    return {
      ok: false,
      reason: 'a populated signature on a synthetic:false record can never be valid in E1 -- real ' +
        'record signature slots stay schema-forced null until gates G1/G2 clear ' +
        '(schemas/review-record.schema.json\'s own allOf); a populated value here is itself the ' +
        'violation, independent of whether it would otherwise cryptographically verify.',
    };
  }

  if (typeof sig !== 'object' || sig === null || Array.isArray(sig)) {
    return { ok: false, reason: 'signature must be an object or null' };
  }
  if (sig.algorithm !== ED25519_ALGORITHM) {
    return {
      ok: false,
      reason: `unsupported signature.algorithm "${sig.algorithm}" -- only "${ED25519_ALGORITHM}" is ` +
        'ever valid (ADR-0005).',
    };
  }
  if (typeof sig.keyId !== 'string' || !sig.keyId.startsWith(TESTKEY_PREFIX)) {
    return {
      ok: false,
      reason: `signature.keyId "${sig.keyId}" does not carry the required "${TESTKEY_PREFIX}" ` +
        'prefix -- E1 signing exists only in synthetic dry-run mode (OQ-6); every populated ' +
        'signature this repository can produce must carry that structural marker.',
    };
  }
  if (typeof sig.value !== 'string' || sig.value.length === 0) {
    return { ok: false, reason: 'signature.value must be a non-empty string' };
  }

  const rawPublicKeyB64Url = sig.keyId.slice(TESTKEY_PREFIX.length);
  let publicKeyObj;
  try {
    publicKeyObj = createPublicKey({
      key: { kty: 'OKP', crv: ED25519_JWK_CRV, x: rawPublicKeyB64Url },
      format: 'jwk',
    });
  } catch (err) {
    return {
      ok: false,
      reason: `signature.keyId's embedded public-key material could not be parsed as an Ed25519 ` +
        `JWK x-coordinate: ${err.message}`,
    };
  }

  let signatureBuffer;
  try {
    signatureBuffer = Buffer.from(sig.value, 'base64');
  } catch (err) {
    return { ok: false, reason: `signature.value could not be decoded as base64: ${err.message}` };
  }
  if (signatureBuffer.length === 0) {
    return { ok: false, reason: 'signature.value decoded to zero bytes' };
  }

  const preimage = signingPreimageBytes(record);
  let verified = false;
  try {
    verified = cryptoVerify(null, preimage, publicKeyObj, signatureBuffer);
  } catch {
    verified = false;
  }
  if (!verified) {
    return {
      ok: false,
      reason: 'cryptographic verification failed -- the signature does not match the record\'s own ' +
        'canonicalized bytes (record minus the signature object); this is a tamper finding, not a ' +
        'usage error.',
    };
  }
  return { ok: true, reason: null };
}
