// tools/release-sign/lib/verify.mjs — `verify` verb (P3-T3, FR-13).
//
// Fail-closed verification of a signed (or dry-run-signed) release candidate against
// `releases/registry.json`, with a documented 5-class exit-code taxonomy (see `./errors.mjs`'s own
// header for the full table; `../README.md`'s "Exit codes" table is the human-readable mirror —
// keep both in sync). `verify` is the SOLE CI/agent-reachable surface of this tool — CI can never
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
// 5 failure classes; each raises a DISTINCT `ReleaseSignError` subclass so a non-zero exit always
// tells the caller exactly which of the 5 classes fired. No stdout is written until every check has
// passed — a thrown error therefore always means zero partial output, by construction, not by a
// try/catch discipline that could be gotten wrong.

import { verify as cryptoVerify, createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { readCanonicalManifestBytes } from './canonical-bytes.mjs';
import { TESTKEY_PREFIX } from './sign.mjs';
import { validate as validateSchema } from '../../../scripts/lib/json-schema-lite.mjs';
import {
  UsageError,
  CandidateByteDriftError,
  DigestMismatchError,
  UnknownKeyIdError,
  RegistryInconsistencyError,
  TestKeyOnRealCandidateError,
} from './errors.mjs';

/** Cached at module load — this tool's own copy of the registry schema, resolved relative to this file. */
const REGISTRY_SCHEMA_PATH = new URL('../../../schemas/release-registry.schema.json', import.meta.url);

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
 *   (any of the 5 documented classes, or a plain UsageError) means zero stdout output, always.
 */
export async function run(options = {}) {
  const candidatePath = requirePathOption(options.candidate, 'candidate', 'a signed candidate document');
  const registryPath = requirePathOption(options.registry, 'registry', 'releases/registry.json');

  const { parsed: candidate } = await readJsonFile(candidatePath, 'candidate');
  assertCandidateShape(candidate, candidatePath);

  const { parsed: registry } = await readJsonFile(registryPath, 'registry');

  // FR-13's 5 classes, checked in the exact order the task's own acceptance criteria lists them.
  const fresh = await checkByteDrift(candidate); // (1) byte drift vs canonical bytes
  checkDigestMismatch(candidate, fresh.bytes); // (2) digest mismatch vs manifest
  checkKeyIdentity(candidate); // (3) unknown keyId / (5) TESTKEY- on non-dry-run
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
