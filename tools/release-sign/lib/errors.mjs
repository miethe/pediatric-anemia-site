// tools/release-sign/lib/errors.mjs — fail-closed error taxonomy (P3-T1 scaffold; P3-T3 extends
// with `verify`'s own documented 5-class exit-code table, FR-13).
//
// P3-T1 scope was a minimal, importable error contract so the `manifest` verb and the
// `register`/`sign`/`verify` verb stubs shared one error identity model — deliberately NOT
// `tools/rf-bundle-to-kb-pack/lib/errors.mjs`'s full 02 §5.2 8-code taxonomy, since
// `tools/release-sign` is a downstream, later-stage tool with its own, narrower concerns (a
// manifest/registry/signature problem, not an `rf`-bundle-eligibility problem).
//
// P3-T3 scope: `verify` is the sole CI/agent-reachable surface of this tool (ruling R3 — CI can
// never sign) and must be fail-closed with a documented, distinctly-coded exit-code table (FR-13):
// any byte drift, digest mismatch, unknown `keyId`, registry inconsistency, or `TESTKEY-` identity
// on a non-dry-run candidate → a DISTINCT non-zero exit, never a blended/generic one. Codes 2-6
// below are that table, in the exact order FR-13/the task's own acceptance criteria lists the 5
// classes. See `tools/release-sign/README.md`'s "Exit codes" table for the full, human-readable
// version of this same taxonomy — keep both in sync.
//
// P3-T4 scope: `register` (FR-14/OQ-4) gets no NEW numeric exit code — every one of its own
// failure modes (malformed candidate, byte drift against a fresh packDir read, a real
// (non-dry-run) candidate carrying a populated signature, a registry document that is already
// schema-invalid, a duplicate moduleId/version entry, or an append-only violation) is a distinctly
// NAMED error class below, but all of them map to `EXIT_USAGE` (1) — mirrors this file's own
// documented exit-code table, which lists `register` only under code 1, never among 2-6 (those
// are `verify`-only per FR-13's own enumeration).
//
//   0 OK
//   1 USAGE                  — malformed invocation (covers every non-verify failure mode,
//                              including every `register` (P3-T4) failure mode below, plus
//                              verify's own structurally-malformed-input cases: missing/unreadable
//                              --candidate or --registry path, unparseable JSON, a candidate
//                              document missing a field this tool's own shape contract requires).
//   2 BYTE_DRIFT              — verify class (1): the candidate's recorded preimage digest disagrees
//                              with a fresh re-read of its own canonical manifest bytes off disk.
//   3 DIGEST_MISMATCH         — verify class (2): the embedded signature does not cryptographically
//                              verify against those same fresh canonical bytes.
//   4 UNKNOWN_KEYID           — verify class (3): the signature's `keyId` is not a identity this
//                              tool recognizes in E1 (a dry-run `keyId` lacking the `TESTKEY-`
//                              marker, or ANY non-dry-run `keyId` — E1 has no signing-custodian key
//                              roster; gate G2 has not happened, so verify cannot vouch for a real
//                              signer identity yet, by design).
//   5 REGISTRY_INCONSISTENCY  — verify class (4): the registry document itself is schema-invalid,
//                              carries no entry for this candidate's moduleId/packVersion, carries
//                              more than one, or that entry's `manifestDigest` disagrees with the
//                              candidate's own canonical digest.
//   6 TESTKEY_ON_REAL         — verify class (5): a non-dry-run candidate's `keyId` carries the
//                              `TESTKEY-` marker — the release-path test-key leak P3-T5's no-keys
//                              sweep also guards against, caught here a second time, structurally,
//                              at verification time.
//
// Every thrown error a verb handler wants the CLI to surface distinctly MUST be (or extend) a
// `ReleaseSignError` subclass below, carrying its own fixed `exitCode`. `cli.mjs`'s top-level
// catch forwards `err.exitCode` verbatim — it never remaps a `ReleaseSignError`'s code.

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_BYTE_DRIFT = 2;
export const EXIT_DIGEST_MISMATCH = 3;
export const EXIT_UNKNOWN_KEYID = 4;
export const EXIT_REGISTRY_INCONSISTENCY = 5;
export const EXIT_TESTKEY_ON_REAL = 6;

/** Frozen lookup table (name -> numeric code). */
export const EXIT_CODES = Object.freeze({
  OK: EXIT_OK,
  USAGE: EXIT_USAGE,
  BYTE_DRIFT: EXIT_BYTE_DRIFT,
  DIGEST_MISMATCH: EXIT_DIGEST_MISMATCH,
  UNKNOWN_KEYID: EXIT_UNKNOWN_KEYID,
  REGISTRY_INCONSISTENCY: EXIT_REGISTRY_INCONSISTENCY,
  TESTKEY_ON_REAL: EXIT_TESTKEY_ON_REAL,
});

/**
 * Base class for every release-sign-raised, taxonomy-mapped failure. `exitCode` is fixed at
 * construction by the subclass and MUST NOT be mutated or reassigned by a catch site — mirrors
 * `tools/rf-bundle-to-kb-pack/lib/errors.mjs`'s `ConverterError` hardening (P2-T5 precedent):
 * every module in this repo runs as native ESM (always strict mode), so an attempted
 * `err.exitCode = <other code>` throws a TypeError instead of silently diluting a distinctly-coded
 * failure into something a generic handler would treat as ordinary.
 */
export class ReleaseSignError extends Error {
  constructor(message, exitCode, options) {
    super(message, options);
    this.name = new.target.name;
    Object.defineProperty(this, 'exitCode', {
      value: exitCode,
      writable: false,
      enumerable: true,
      configurable: false,
    });
  }
}

/** Exit 1 — usage/not-found/malformed-input. Correct the invocation; do not retry blindly. */
export class UsageError extends ReleaseSignError {
  constructor(message, options) {
    super(message, EXIT_USAGE, options);
  }
}

/**
 * The signing preimage this tool computed for a pack disagrees, byte-for-byte, with a pinned
 * golden-bytes regression fixture (P3-T1's own acceptance criteria: "golden drift fails the
 * phase, never silently re-baselines"). Never caught and silently re-baselined by any test or
 * script in this tree — a golden-bytes fixture is updated only by a deliberate, reviewed commit
 * that replaces the fixture file itself, never by code that "fixes" a failing comparison at
 * runtime.
 */
export class GoldenDriftError extends UsageError {
  constructor(label, expectedSha256, actualSha256) {
    super(
      `golden-bytes drift detected for "${label}": expected sha256:${expectedSha256}, got ` +
        `sha256:${actualSha256}. This pins E0's P5-T5 canonical serialization of the ` +
        'cbc_suite_v1 pack — a mismatch means either the pinned fixture is stale (update it via ' +
        'a deliberate, reviewed commit, never silently) or E0\'s converter output actually ' +
        'changed underneath this tool (investigate before touching the fixture).',
    );
    this.label = label;
    this.expectedSha256 = expectedSha256;
    this.actualSha256 = actualSha256;
  }
}

/**
 * Scaffold-only marker for a verb this phase defines in `cli.mjs`'s dispatch table but does not
 * yet implement. No verb currently throws this — `manifest` (P3-T1), `sign` (P3-T2), `verify`
 * (P3-T3), and `register` (P3-T4) are all implemented — but the class stays exported (and
 * covered by its own test) as the documented pattern any future scaffolded-but-unimplemented verb
 * in this tool should reuse, mirroring `tools/rf-bundle-to-kb-pack/lib/errors.mjs`'s
 * `NotImplementedError` (P2-T1 precedent). Maps to EXIT_USAGE: from the caller's perspective an
 * unimplemented verb is "this CLI usage is not available yet."
 */
export class NotImplementedError extends UsageError {
  constructor(taskId, detail) {
    super(
      `not yet implemented — scaffolded in P3-T1; completed in ${taskId}.${detail ? ` (${detail})` : ''}`,
    );
    this.taskId = taskId;
  }
}

/**
 * `verify` class (1): the candidate document's own recorded `preimageSha256` disagrees with a
 * FRESH re-read (via `./canonical-bytes.mjs#readCanonicalManifestBytes` — never re-derived) of its
 * `packDir`'s current `release-manifest.unsigned.json` bytes. Distinct from `GoldenDriftError`
 * (P3-T1's own regression-fixture pin, always EXIT_USAGE) — this is a verify-time check against
 * whatever the CANDIDATE ITSELF claims, not against a pinned repo fixture.
 */
export class CandidateByteDriftError extends ReleaseSignError {
  constructor(recordedSha256, actualSha256, manifestPath) {
    super(
      `verify: byte drift detected — candidate's recorded preimageSha256 (${recordedSha256}) ` +
        `disagrees with a fresh re-read of ${manifestPath} (sha256:${actualSha256}). The pack's ` +
        'canonical manifest bytes have changed since this candidate was signed, or the candidate ' +
        'was hand-edited; either way, this is fail-closed and produces no partial output.',
      EXIT_BYTE_DRIFT,
    );
    this.recordedSha256 = recordedSha256;
    this.actualSha256 = actualSha256;
    this.manifestPath = manifestPath;
  }
}

/** `verify` class (2): the embedded signature does not cryptographically verify. */
export class DigestMismatchError extends ReleaseSignError {
  constructor(detail) {
    super(
      `verify: digest mismatch — the candidate's signature does not cryptographically verify ` +
        `against its own canonical manifest bytes${detail ? ` (${detail})` : ''}.`,
      EXIT_DIGEST_MISMATCH,
    );
  }
}

/**
 * `verify` class (3): the signature's `keyId` is not an identity this tool recognizes in E1 — a
 * dry-run `keyId` lacking the `TESTKEY-` marker, or ANY non-dry-run `keyId` at all (E1 has no
 * signing-custodian key roster; gate G2 has not happened, so `verify` cannot vouch for a real
 * signer identity yet — this is a deliberate, load-bearing design choice, not a gap to "fix").
 */
export class UnknownKeyIdError extends ReleaseSignError {
  constructor(detail) {
    super(`verify: unknown keyId — ${detail}`, EXIT_UNKNOWN_KEYID);
  }
}

/**
 * `verify` class (4): the registry document is schema-invalid, carries no entry (or more than
 * one) for this candidate's moduleId/packVersion, or that entry's `manifestDigest` disagrees with
 * the candidate's own canonical digest.
 */
export class RegistryInconsistencyError extends ReleaseSignError {
  constructor(detail) {
    super(`verify: registry inconsistency — ${detail}`, EXIT_REGISTRY_INCONSISTENCY);
  }
}

/**
 * `verify` class (5): a non-dry-run candidate's `keyId` carries the `TESTKEY-` marker — the
 * release-path test-key leak P3-T5's no-keys sweep also guards against, caught here a second time,
 * structurally, at verification time.
 */
export class TestKeyOnRealCandidateError extends ReleaseSignError {
  constructor(keyId) {
    super(
      `verify: TESTKEY- identity on a non-dry-run candidate — keyId "${keyId}" carries the ` +
        'ephemeral dry-run test-key marker (OQ-6) but this candidate is not marked dryRun: true. ' +
        'A real signing-ceremony (gate G2) identity must never be labeled as one; this is the ' +
        "release-path test-key leak P3-T5's own no-keys sweep also guards against.",
      EXIT_TESTKEY_ON_REAL,
    );
    this.keyId = keyId;
  }
}

// =================================================================================================
// `register` (P3-T4, FR-14/OQ-4) — every one of the classes below maps to EXIT_USAGE (see this
// file's own header note above); they are distinctly NAMED, not distinctly CODED, because
// `register` is not part of FR-13's 5-class taxonomy (that taxonomy belongs to `verify` alone).
// =================================================================================================

/**
 * `register`'s own byte-drift check: the candidate document's recorded `preimageSha256` disagrees
 * with a FRESH re-read (via `./canonical-bytes.mjs#readCanonicalManifestBytes` — never re-derived)
 * of its `packDir`'s current `release-manifest.unsigned.json` bytes. Deliberately a DISTINCT class
 * from `verify`'s own `CandidateByteDriftError` — that class hardcodes `EXIT_BYTE_DRIFT` (2), a
 * code this file's own documented exit-code table reserves for `verify` alone; `register`'s
 * equivalent check is the same *idea* (never trust a candidate's own claim, always re-read) but
 * must never smuggle a `verify`-coded exit out of a different verb.
 */
export class RegisterByteDriftError extends UsageError {
  constructor(recordedSha256, actualSha256, manifestPath) {
    super(
      `register: byte drift detected — candidate's recorded preimageSha256 (${recordedSha256}) ` +
        `disagrees with a fresh re-read of ${manifestPath} (sha256:${actualSha256}). The pack's ` +
        'canonical manifest bytes have changed since this candidate was built, or the candidate ' +
        'was hand-edited; register refuses to append an entry it cannot independently verify.',
    );
    this.recordedSha256 = recordedSha256;
    this.actualSha256 = actualSha256;
    this.manifestPath = manifestPath;
  }
}

/**
 * A non-dry-run candidate document (`dryRun` absent or `false`) carries a populated `signature`.
 * E1 has no gate-G2 signing-custodian authority — `register` refuses to append ANY entry built
 * from such a candidate, rather than silently discarding the signature and registering
 * `signature: null` anyway. This is `register`'s own defense-in-depth extension of FR-15/FR-16
 * into the registration flow, alongside (not a replacement for) `schemas/release-manifest.schema.
 * json`'s own forced-empty enforcement and `verify`'s `TestKeyOnRealCandidateError` check.
 */
export class RegisterRealCandidateSignedError extends UsageError {
  constructor(candidatePath) {
    super(
      `register: candidate at ${candidatePath} is not marked dryRun: true but carries a populated ` +
        'signature — E1 has no gate-G2 signing-custodian authority (docs/governance/signing-' +
        'ceremony-runbook.md) to attest to a real signature, so register refuses to append an ' +
        'entry for it. Only a dry-run (TESTKEY-) signed candidate, or a fully unsigned pre-G2 ' +
        'candidate, may ever be registered in E1; the appended entry\'s own signature is always ' +
        '`null` either way (OQ-4) — see schemas/release-registry.schema.json\'s top-level description.',
    );
    this.candidatePath = candidatePath;
  }
}

/** The registry document at `--registry` is already schema-invalid before `register` even tries to append to it. */
export class RegistrySchemaInvalidError extends UsageError {
  constructor(registryPath, schemaErrors) {
    super(
      `register: registry at ${registryPath} does not validate against schemas/release-registry.` +
        `schema.json: ${JSON.stringify(schemaErrors)} — refusing to append to an already-invalid ` +
        'registry document.',
    );
    this.registryPath = registryPath;
    this.schemaErrors = schemaErrors;
  }
}

/**
 * The registry already carries an entry for this exact `moduleId`/`version` pair. Append-only
 * means "never mutate or remove," not "append unlimited duplicates" — `verify`'s own
 * `checkRegistryConsistency` (P3-T3) requires EXACTLY ONE entry per moduleId/version, an invariant
 * `register` itself must never let regress.
 */
export class RegistryDuplicateEntryError extends UsageError {
  constructor(moduleId, version, registryPath) {
    super(
      `register: an entry for moduleId="${moduleId}" version="${version}" already exists in ` +
        `${registryPath} — an append-only registry never carries more than one entry per module/` +
        'version pair (this is what would let "verify" no longer find a unique match). Registering ' +
        'a genuinely new release requires a new packVersion.',
    );
    this.moduleId = moduleId;
    this.version = version;
    this.registryPath = registryPath;
  }
}

/**
 * FR-14/OQ-4's own append-only invariant, violated: the NEXT registry document `register` was
 * about to write (or, for `checkRegistryHistoryAppendOnly`'s git-history walk, some later
 * committed revision) does not agree with the PRIOR document on every previously-existing entry,
 * in order — either an existing entry's content changed, an existing entry was removed/reordered,
 * `schemaVersion` itself changed, or the entries array shrank. Raised by BOTH of this tool's two
 * append-only enforcement layers (mirrors `tools/review-record`'s OQ-2 two-layer design for the
 * same invariant over a different storage shape — see `./registry.mjs`'s own header for why a
 * flat, single-document registry needs a different concrete mechanism than that tool's
 * one-file-per-record `previousRecordHash` chain, while enforcing the identical policy):
 *   (1) `register`'s own in-process check, run on every invocation, comparing the registry
 *       document it is about to overwrite against the one it read moments before;
 *   (2) `checkRegistryHistoryAppendOnly`'s git-history walk, comparing every COMMITTED revision of
 *       `releases/registry.json` against its immediate predecessor — the layer that would catch a
 *       hand-edited, directly-committed mutation that never went through `register` at all.
 */
export class RegistryAppendOnlyViolationError extends UsageError {
  constructor(detail) {
    super(`registry append-only violation: ${detail}`);
    this.detail = detail;
  }
}
