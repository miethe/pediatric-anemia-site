// tools/release-sign/lib/verify.mjs — `verify` verb (P3-T3, FR-13).
//
// Fail-closed verification of a signed (or dry-run-signed) release candidate against
// `releases/registry.json`, with a documented 5-class exit-code taxonomy (FR-13) plus 2 more classes
// (6/7) added by a P3 laundering fix (see `./errors.mjs`'s own header for the full table;
// `../README.md`'s "Exit codes" table is the human-readable mirror — keep both in sync). `verify` is
// the SOLE CI/agent-reachable surface of this tool — CI can never
// sign (ruling R3); this module never reads a private key, never imports `./sign.mjs`'s signing
// primitives, and performs zero writes of its own.
//
// Input shape: `--candidate <path>` is a JSON file carrying exactly the reporting-object shape
// `./sign.mjs#run` prints to stdout/returns — `{ packDir, manifestPath, preimageSha256, dryRun,
// signature: {algorithm, keyId, value}, signerPublicKey: {algorithm, format, value}, manifest:
// {moduleId, packVersion, ...} }`. This is deliberate: there is no persistent signing-key registry
// in E1 (`./sign.mjs`'s own README section explains why), so the self-contained candidate document
// — carrying the (non-secret) public key alongside the signature — is what lets a later, separate
// process verify a signature produced by a key nobody kept. `--registry <path>` is a JSON file
// shaped per `schemas/release-registry.schema.json`.
//
// Every check below re-reads bytes from disk via `./canonical-bytes.mjs` — the one place this tool
// computes a manifest's canonical signing preimage — never re-deriving or re-serializing anything
// itself (the same "never re-implement E0's canonicalization" contract `./manifest.mjs`/`./sign.mjs`
// already hold). Checks run in the exact order FR-13/this task's own acceptance criteria lists the
// 5 failure classes, PLUS two more (classes 6/7, below) added by a Codex second-opinion review fix;
// each raises a DISTINCT `ReleaseSignError` subclass so a non-zero exit always tells the caller
// exactly which class fired. No stdout is written until every check has passed — a thrown error
// therefore always means zero partial output, by construction, not by a try/catch discipline that
// could be gotten wrong.
//
// P3 laundering fix (Codex second-opinion review): classes (1)/(2)/(3)/(5) above all check the
// WRAPPER's own top-level fields (packDir/manifestPath/preimageSha256/signature/signerPublicKey)
// against fresh on-disk bytes — none of them ever independently inspected `candidate.manifest`, the
// NESTED, embedded manifest document that same wrapper carries. A crafted, genuinely-valid dry-run
// TESTKEY wrapper could therefore embed an arbitrary nested `manifest` — including a populated,
// non-TESTKEY- `signature` slot nothing else in this verb ever checked — and still verify cleanly.
// `checkWrapperManifestBinding` below closes that gap with two checks, both run BEFORE
// `checkDigestMismatch` (the one cryptographic check this verb performs): (6) the nested manifest
// must itself validate against `schemas/release-manifest.schema.json`, and (7) it must be
// cryptographically BOUND — via a canonical digest, not mere field inspection — to the exact
// document this wrapper's own already-verified top-level signature was produced alongside. See
// `./errors.mjs`'s own header for the full rationale and `NestedManifestInvalidError`/
// `WrapperManifestMismatchError`'s own docs for each check's precise scope.

import { verify as cryptoVerify, createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { readCanonicalManifestBytes, sha256Hex } from './canonical-bytes.mjs';
import { TESTKEY_PREFIX } from './sign.mjs';
import { stableStringify } from './registry.mjs';
import { validate as validateSchema } from '../../../scripts/lib/json-schema-lite.mjs';
import {
  UsageError,
  CandidateByteDriftError,
  DigestMismatchError,
  UnknownKeyIdError,
  RegistryInconsistencyError,
  TestKeyOnRealCandidateError,
  NestedManifestInvalidError,
  WrapperManifestMismatchError,
} from './errors.mjs';

/** Cached at module load — this tool's own copy of the registry schema, resolved relative to this file. */
const REGISTRY_SCHEMA_PATH = new URL('../../../schemas/release-registry.schema.json', import.meta.url);
/** Cached at module load — this tool's own copy of the release-manifest schema (P3 laundering fix): the schema the NESTED `candidate.manifest` document must itself validate against, resolved relative to this file (mirrors `REGISTRY_SCHEMA_PATH` above). */
const RELEASE_MANIFEST_SCHEMA_PATH = new URL('../../../schemas/release-manifest.schema.json', import.meta.url);

/**
 * @param {string | boolean | undefined} rawPath
 * @param {string} flagName
 * @param {string} label
 * @returns {string}
 */
function requirePathOption(rawPath, flagName, label) {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    throw new UsageError(`verify requires --${flagName} <path to ${label}>`);
  }
  return rawPath;
}

/**
 * Reads and JSON-parses a file, failing closed (`UsageError`) on a missing file or malformed JSON
 * — both are "this invocation is wrong," never one of verify's 5 substantive failure classes.
 *
 * @param {string} filePath
 * @param {string} label used in error messages ("candidate" | "registry")
 * @returns {Promise<{raw: Buffer, parsed: object}>}
 */
async function readJsonFile(filePath, label) {
  let raw;
  try {
    raw = await readFile(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new UsageError(`verify: no ${label} file found at ${filePath}`);
    }
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch (err) {
    throw new UsageError(`verify: ${label} at ${filePath} is not valid JSON (${err.message})`);
  }
  return { raw, parsed };
}

/**
 * Structural shape contract this verb requires of a candidate document — deliberately a subset of
 * `./sign.mjs#run`'s full reporting-object shape (only the fields verify itself reads). A missing
 * field here is a malformed invocation (`UsageError`, exit 1), never one of the 5 substantive
 * failure classes below — those classes describe a STRUCTURALLY well-formed candidate that is
 * nonetheless untrustworthy.
 *
 * @param {object} candidate
 * @param {string} candidatePath
 */
function assertCandidateShape(candidate, candidatePath) {
  const fail = (detail) => {
    throw new UsageError(
      `verify: candidate at ${candidatePath} is missing or malformed: ${detail} — expected the ` +
        'exact reporting-object shape "sign" prints/returns (packDir, manifestPath, ' +
        'preimageSha256, signature{algorithm,keyId,value}, signerPublicKey{value}, ' +
        'manifest{moduleId,packVersion}).',
    );
  };
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    fail('top-level document must be a JSON object');
  }
  if (typeof candidate.packDir !== 'string' || candidate.packDir.length === 0) fail('"packDir"');
  if (typeof candidate.manifestPath !== 'string' || candidate.manifestPath.length === 0) fail('"manifestPath"');
  if (typeof candidate.preimageSha256 !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(candidate.preimageSha256)) {
    fail('"preimageSha256" (must be "sha256:<64 hex chars>")');
  }
  if (candidate.dryRun !== undefined && typeof candidate.dryRun !== 'boolean') fail('"dryRun" (must be boolean when present)');
  const sig = candidate.signature;
  if (typeof sig !== 'object' || sig === null) fail('"signature"');
  if (sig.algorithm !== 'ed25519') fail('"signature.algorithm" (must be "ed25519")');
  if (typeof sig.keyId !== 'string' || sig.keyId.length === 0) fail('"signature.keyId"');
  if (typeof sig.value !== 'string' || sig.value.length === 0) fail('"signature.value"');
  const spk = candidate.signerPublicKey;
  if (typeof spk !== 'object' || spk === null) fail('"signerPublicKey"');
  if (typeof spk.value !== 'string' || spk.value.length === 0) fail('"signerPublicKey.value"');
  const manifest = candidate.manifest;
  if (typeof manifest !== 'object' || manifest === null) fail('"manifest"');
  if (typeof manifest.moduleId !== 'string' || manifest.moduleId.length === 0) fail('"manifest.moduleId"');
  if (typeof manifest.packVersion !== 'string' || manifest.packVersion.length === 0) fail('"manifest.packVersion"');
}

/**
 * FR-13 class (1): the candidate's own recorded `preimageSha256` must agree with a FRESH re-read
 * of its `packDir`'s current canonical manifest bytes — never a re-derivation, always the same
 * `readCanonicalManifestBytes` primitive `./manifest.mjs`/`./sign.mjs` already use.
 *
 * @param {object} candidate
 * @returns {Promise<{manifestPath: string, bytes: Buffer, sha256: string}>} the fresh read, reused
 *   by the digest-mismatch check below (never re-read a second time).
 */
async function checkByteDrift(candidate) {
  const fresh = await readCanonicalManifestBytes(candidate.packDir);
  const freshDigest = `sha256:${fresh.sha256}`;
  if (freshDigest !== candidate.preimageSha256) {
    throw new CandidateByteDriftError(candidate.preimageSha256, fresh.sha256, fresh.manifestPath);
  }
  return fresh;
}

/**
 * FR-13 class (2): the embedded detached Ed25519 signature must cryptographically verify against
 * the FRESH canonical bytes `checkByteDrift` already confirmed match the candidate's own claim.
 *
 * @param {object} candidate
 * @param {Buffer} freshBytes
 */
function checkDigestMismatch(candidate, freshBytes) {
  let publicKeyObj;
  try {
    publicKeyObj = createPublicKey(candidate.signerPublicKey.value);
  } catch (err) {
    throw new DigestMismatchError(`signerPublicKey could not be parsed as a public-key PEM: ${err.message}`);
  }
  if (publicKeyObj.asymmetricKeyType !== 'ed25519') {
    throw new DigestMismatchError(`signerPublicKey is a "${publicKeyObj.asymmetricKeyType ?? 'unknown'}" key, not ed25519`);
  }
  let signatureBuffer;
  try {
    signatureBuffer = Buffer.from(candidate.signature.value, 'base64');
  } catch (err) {
    throw new DigestMismatchError(`signature.value could not be decoded as base64: ${err.message}`);
  }
  let ok = false;
  try {
    ok = cryptoVerify(null, freshBytes, publicKeyObj, signatureBuffer);
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new DigestMismatchError('cryptographic verification returned false');
  }
}

/**
 * FR-13 classes (6)/(7) [P3 laundering fix, Codex second-opinion review] — see this file's own
 * module header and `./errors.mjs`'s header for the full rationale. Runs strictly BEFORE
 * `checkDigestMismatch` (the one cryptographic check this verb ever performs), so a structurally
 * invalid or unbound nested manifest is refused before any signature math runs.
 *
 * @param {object} candidate
 * @param {Buffer} freshBytes the SAME fresh canonical bytes `checkByteDrift` already re-read off
 *   disk and confirmed agree with `candidate.preimageSha256` — never re-read a second time here.
 */
async function checkWrapperManifestBinding(candidate, freshBytes) {
  // (6) Structural: the nested manifest must itself validate against
  // schemas/release-manifest.schema.json — the exact check this verb never performed before this
  // fix. Closes the crafted case a Codex second-opinion review found: a genuinely valid, TESTKEY--
  // marked WRAPPER (whose own top-level signature verifies cleanly against fresh bytes) can embed a
  // `manifest` field carrying an arbitrary, never-independently-checked document — including a
  // populated, non-TESTKEY- `signature` slot that nothing else in this verb ever inspects (that slot
  // is schema-forced empty unless `dryRun: true` AND `keyId` carries the `TESTKEY-` marker — see
  // schemas/release-manifest.schema.json's own `allOf`/`$defs/dryRunSignature`).
  const manifestSchemaJson = await readFile(RELEASE_MANIFEST_SCHEMA_PATH, 'utf8');
  const manifestSchema = JSON.parse(manifestSchemaJson);
  const schemaErrors = validateSchema(manifestSchema, candidate.manifest);
  if (schemaErrors.length > 0) {
    throw new NestedManifestInvalidError(JSON.stringify(schemaErrors));
  }

  // (7) Cryptographic binding: a nested manifest that is individually schema-valid is still not
  // enough on its own — it must be EXACTLY the document this wrapper's own already-verified
  // top-level `signature` was produced alongside. Reconstruct it, byte-for-byte, from the SAME fresh
  // bytes `checkByteDrift` just re-read off disk (never a second, independent read) merged with this
  // wrapper's own `dryRun`/`signature` — exactly the shape `./sign.mjs#finalizeSignedCandidate`
  // builds — then compare canonical (sorted-key) digests. Any disagreement — a swapped moduleId, a
  // different testCorpusHash, a nested signature that does not match the wrapper's own top-level
  // signature field-for-field, anything at all — means `candidate.manifest` was swapped, hand-
  // edited, or never produced by this exact signing operation.
  const freshUnsignedManifest = JSON.parse(freshBytes.toString('utf8'));
  const expectedNestedManifest = candidate.dryRun === true
    ? { ...freshUnsignedManifest, dryRun: true, signature: candidate.signature }
    : { ...freshUnsignedManifest, signature: candidate.signature };
  const expectedDigest = sha256Hex(Buffer.from(stableStringify(expectedNestedManifest), 'utf8'));
  const actualDigest = sha256Hex(Buffer.from(stableStringify(candidate.manifest), 'utf8'));
  if (expectedDigest !== actualDigest) {
    throw new WrapperManifestMismatchError(expectedDigest, actualDigest);
  }
}

/**
 * FR-13 classes (3) and (5): `keyId` identity classification. E1 has no signing-custodian key
 * roster (gate G2 has not happened), so the ONLY identity `verify` can ever recognize as "known" is
 * a dry-run candidate's structurally `TESTKEY-`-prefixed `keyId` (OQ-6). This is a deliberate,
 * load-bearing design choice — it means `verify` structurally can never certify a non-dry-run
 * candidate as verified in E1, which is the correct, honest posture (no signature confers clinical
 * standing before gate G2; see ADR-0005).
 *
 * @param {object} candidate
 */
function checkKeyIdentity(candidate) {
  const keyId = candidate.signature.keyId;
  const isTestKey = keyId.startsWith(TESTKEY_PREFIX);
  const dryRun = candidate.dryRun === true;

  if (!dryRun && isTestKey) {
    throw new TestKeyOnRealCandidateError(keyId);
  }
  if (dryRun && !isTestKey) {
    throw new UnknownKeyIdError(
      `dry-run candidate's keyId "${keyId}" does not carry the "${TESTKEY_PREFIX}" marker (OQ-6) — ` +
        'not a recognized identity under this tool\'s E1 dry-run posture.',
    );
  }
  if (!dryRun && !isTestKey) {
    throw new UnknownKeyIdError(
      `keyId "${keyId}" is not a recognized identity — E1 has no signing-custodian key roster ` +
        '(gate G2 has not happened, docs/governance/signing-ceremony-runbook.md), so verify cannot ' +
        'vouch for any non-dry-run signer identity yet. This is by design, not a gap: only a ' +
        'dry-run, TESTKEY--marked candidate can ever verify successfully in E1.',
    );
  }
  // Reaches here only when dryRun && isTestKey — the sole combination E1's verify can recognize.
}

/**
 * FR-13 class (4): the registry document must itself be schema-valid, must carry EXACTLY ONE entry
 * for this candidate's moduleId/packVersion, and that entry's `manifestDigest` must agree with the
 * candidate's own canonical preimage digest.
 *
 * @param {object} registry
 * @param {string} registryPath
 * @param {object} candidate
 */
async function checkRegistryConsistency(registry, registryPath, candidate) {
  const schemaJson = await readFile(REGISTRY_SCHEMA_PATH, 'utf8');
  const schema = JSON.parse(schemaJson);
  const schemaErrors = validateSchema(schema, registry);
  if (schemaErrors.length > 0) {
    throw new RegistryInconsistencyError(
      `registry at ${registryPath} does not validate against schemas/release-registry.schema.json: ` +
        JSON.stringify(schemaErrors),
    );
  }

  const { moduleId, packVersion } = candidate.manifest;
  const entries = registry.entries ?? [];
  const matches = entries.filter((entry) => entry.moduleId === moduleId && entry.version === packVersion);

  if (matches.length === 0) {
    throw new RegistryInconsistencyError(
      `no entry found in ${registryPath} for moduleId="${moduleId}" version="${packVersion}" — ` +
        'register the candidate first (tools/release-sign register, FR-14/P3-T4).',
    );
  }
  if (matches.length > 1) {
    throw new RegistryInconsistencyError(
      `${matches.length} entries found in ${registryPath} for moduleId="${moduleId}" ` +
        `version="${packVersion}" — an append-only registry must never carry more than one entry ` +
        'per module/version.',
    );
  }
  const [entry] = matches;
  if (entry.manifestDigest !== candidate.preimageSha256) {
    throw new RegistryInconsistencyError(
      `registry entry's manifestDigest (${entry.manifestDigest}) disagrees with the candidate's ` +
        `own canonical preimage digest (${candidate.preimageSha256}) for moduleId="${moduleId}" ` +
        `version="${packVersion}".`,
    );
  }
}

/**
 * @param {object} [options]
 * @param {string} [options.candidate] path to a JSON file carrying `./sign.mjs#run`'s reporting-
 *   object shape (signature + signerPublicKey + manifest, alongside packDir/manifestPath/
 *   preimageSha256/dryRun).
 * @param {string} [options.registry] path to a `schemas/release-registry.schema.json`-shaped
 *   registry document.
 * @returns {Promise<{schemaVersion: string, candidatePath: string, registryPath: string,
 *   moduleId: string, packVersion: string, preimageSha256: string, dryRun: boolean, keyId: string,
 *   verified: true}>} printed to stdout ONLY once every check below has passed — a thrown error
 *   (any of the 7 documented classes, or a plain UsageError) means zero stdout output, always.
 */
export async function run(options = {}) {
  const candidatePath = requirePathOption(options.candidate, 'candidate', 'a signed candidate document');
  const registryPath = requirePathOption(options.registry, 'registry', 'releases/registry.json');

  const { parsed: candidate } = await readJsonFile(candidatePath, 'candidate');
  assertCandidateShape(candidate, candidatePath);

  const { parsed: registry } = await readJsonFile(registryPath, 'registry');

  // FR-13's 5 classes, PLUS classes (6)/(7) [P3 laundering fix] — see this file's own module header.
  // Execution order is NOT the numeric class order; it is chosen so that (a) classes (6)/(7) always
  // run BEFORE `checkDigestMismatch`, the one cryptographic check this verb performs (this fix's
  // own acceptance criteria), and (b) `checkKeyIdentity` — pure classification of the WRAPPER's own
  // top-level `signature.keyId`/`dryRun`, never touching `candidate.manifest` — runs BEFORE (6)/(7).
  // (b) matters structurally, not just cosmetically: classes (6)/(7) force `candidate.manifest` to
  // be BOUND to the wrapper's own top-level `dryRun`/`signature` (byte-for-byte, by digest) before
  // they ever pass — so once binding holds, the nested manifest's OWN schema (which independently
  // requires the identical TESTKEY-when-dryRun-true invariant `checkKeyIdentity` also enforces)
  // would ALWAYS have already rejected any wrapper whose top-level `keyId`/`dryRun` combination
  // classes (3)/(5) exist to catch — running `checkKeyIdentity` first keeps that classification
  // independently, distinctly reachable (its own documented exit code) rather than silently
  // subsumed by class (6)'s schema check.
  const fresh = await checkByteDrift(candidate); // (1) byte drift vs canonical bytes
  checkKeyIdentity(candidate); // (3) unknown keyId / (5) TESTKEY- on non-dry-run
  await checkWrapperManifestBinding(candidate, fresh.bytes); // (6)/(7) nested-manifest laundering guard
  checkDigestMismatch(candidate, fresh.bytes); // (2) digest mismatch vs manifest
  await checkRegistryConsistency(registry, registryPath, candidate); // (4) registry inconsistency

  const result = {
    schemaVersion: '1.0',
    candidatePath,
    registryPath,
    moduleId: candidate.manifest.moduleId,
    packVersion: candidate.manifest.packVersion,
    preimageSha256: candidate.preimageSha256,
    dryRun: candidate.dryRun === true,
    keyId: candidate.signature.keyId,
    verified: true,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
