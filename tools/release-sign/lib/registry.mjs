// tools/release-sign/lib/registry.mjs — `register` verb (P3-T4, FR-14/OQ-4).
//
// Appends a release candidate to the append-only `releases/registry.json` (top-level
// `schemaVersion` + `entries[]`, validated against `schemas/release-registry.schema.json`,
// P1-T5). Every entry binds EXACTLY the OQ-4 field list — `version`, `moduleId`, `packDigest`,
// `manifestDigest`, `signature`, `signedAt`, `supersedes`, `withdrawalState`, `withdrawnAt`,
// `withdrawalReason` — and `signature`/`signedAt`/`supersedes`/`withdrawnAt`/`withdrawalReason`
// are ALWAYS `null` under this schema version, `withdrawalState` ALWAYS `"none"`: E1 registers no
// signed release and never sets a withdrawal state (see the schema's own top-level description
// for why the registry never bears a real signature — that lives on the release-manifest's own
// `signature` slot, schemas/release-manifest.schema.json, once gate G2 clears; the registry is an
// integrity record ABOUT a candidate, never the candidate's own signature bearer).
//
// `--candidate <path>` accepts either shape this tool itself already produces:
//   (a) `./manifest.mjs`'s bare reporting object (`schemaVersion`, `packDir`, `manifestFile`,
//       `manifestPath`, `preimageSha256`, `preimageByteLength`) — a fully unsigned, pre-G2 real
//       candidate. No `dryRun`, no `signature`.
//   (b) `./sign.mjs`'s full reporting object (adds `dryRun`, `signature`, `signerPublicKey`,
//       `manifest`) — normally a `--dry-run --out-candidate` output (OQ-6 ephemeral TESTKEY-
//       signature), the same self-contained document `verify --candidate` (P3-T3) consumes.
// Either way, `register` NEVER trusts the candidate document's own claims about identity or
// digest: it re-derives `packDir`, re-reads `<packDir>/release-manifest.unsigned.json` fresh (via
// `./canonical-bytes.mjs#readCanonicalManifestBytes` — never re-derived), and independently
// recomputes `manifestDigest` and `packDigest` (`./pack-digest.mjs`) from those FRESH bytes —
// mirroring `./verify.mjs`'s own "never trust, always re-read" posture. `moduleId`/`version` come
// from the FRESH manifest read, not from a candidate document's own (possibly signed, possibly
// stale) `manifest` sub-object.
//
// A non-dry-run candidate carrying a populated `signature` is rejected outright
// (`RegisterRealCandidateSignedError`) — E1 has no gate-G2 signing-custodian authority to attest
// to a real signature, so `register` refuses to build an entry from one rather than silently
// discarding it and registering `signature: null` anyway (belt-and-suspenders alongside
// `schemas/release-manifest.schema.json`'s own forced-empty enforcement and `verify`'s
// `TestKeyOnRealCandidateError`). A dry-run candidate's own `dryRun`/`TESTKEY-` marker is carried
// into `register`'s OWN stdout reporting object (`dryRun: true`) purely as an audit trail — the
// PERSISTED registry entry itself has no such field (not in the OQ-4 list; `additionalProperties:
// false` on `$defs/registryEntry` would reject it), by design.
//
// Append-only enforcement is TWO layers, the same "one canonical invariant, two independent
// enforcement points" shape `tools/review-record`'s OQ-2 hash-chain design uses for its own
// append-only guarantee — concretely different here because a flat, single-document registry (one
// file, many entries) has no per-record file path to protect, unlike that tool's one-file-per-
// record store:
//   (1) `run` below (this file): every invocation re-reads the CURRENT `--registry` document,
//       builds the NEXT document as "current entries, verbatim, plus exactly one new entry," and
//       asserts that relationship holds (`assertRegisterAppendsExactlyOne`) before writing —
//       in-process, on every call.
//   (2) `checkRegistryHistoryAppendOnly` (this file, exported for tests / a future `npm run
//       validate` wiring, P3-T6): walks EVERY git-committed revision of a registry file and
//       asserts each one is entry-prefix-compatible with its predecessor — the layer that would
//       catch a hand-edited, directly-committed mutation that never went through `register` at
//       all (layer (1) alone cannot see a mutation to history that predates the file `register`
//       is about to overwrite).
// Both layers reduce to the same primitive, `assertEntriesPrefixPreserving` — one canonical
// comparison, not two independently-maintained ones.

import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readCanonicalManifestBytes } from './canonical-bytes.mjs';
import { computePackDigest } from './pack-digest.mjs';
import { validate as validateSchema } from '../../../scripts/lib/json-schema-lite.mjs';
import {
  UsageError,
  RegisterByteDriftError,
  RegisterRealCandidateSignedError,
  RegistrySchemaInvalidError,
  RegistryDuplicateEntryError,
  RegistryAppendOnlyViolationError,
} from './errors.mjs';

/** Cached path — this tool's own copy of the registry schema, resolved relative to this file (mirrors `./verify.mjs`). */
const REGISTRY_SCHEMA_PATH = new URL('../../../schemas/release-registry.schema.json', import.meta.url);

async function loadRegistrySchema() {
  return JSON.parse(await readFile(REGISTRY_SCHEMA_PATH, 'utf8'));
}

/**
 * @param {string | boolean | undefined} rawPath
 * @param {string} flagName
 * @param {string} label
 * @returns {string}
 */
function requirePathOption(rawPath, flagName, label) {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    throw new UsageError(`register requires --${flagName} <path to ${label}>`);
  }
  return rawPath;
}

/**
 * Reads and JSON-parses a file, failing closed (`UsageError`) on a missing file or malformed
 * JSON — mirrors `./verify.mjs`'s own `readJsonFile` byte-for-byte (kept as an independent copy
 * rather than a cross-module import, same "small, self-contained per-verb helper" convention
 * `cli.mjs#parseFlags`'s own header already documents for this tool).
 *
 * @param {string} filePath
 * @param {string} label used in error messages ("candidate" | "registry")
 * @returns {Promise<object>} the parsed JSON document
 */
async function readJsonFile(filePath, label) {
  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new UsageError(`register: no ${label} file found at ${filePath}`);
    }
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new UsageError(`register: ${label} at ${filePath} is not valid JSON (${err.message})`);
  }
}

/**
 * Structural shape contract `register` requires of `--candidate` — deliberately permissive about
 * WHICH of the two producing shapes (`manifest`'s bare object or `sign`'s full reporting object)
 * was passed; both carry `packDir` and `preimageSha256`, the only two fields this verb reads
 * directly off the candidate document (everything else it independently re-derives from disk).
 *
 * @param {object} candidate
 * @param {string} candidatePath
 */
function assertCandidateShape(candidate, candidatePath) {
  const fail = (detail) => {
    throw new UsageError(
      `register: candidate at ${candidatePath} is missing or malformed: ${detail} — expected ` +
        'either "manifest" verb\'s bare reporting object (packDir, preimageSha256, ...) or ' +
        '"sign" verb\'s full reporting object (adds dryRun, signature, signerPublicKey, manifest).',
    );
  };
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    fail('top-level document must be a JSON object');
  }
  if (typeof candidate.packDir !== 'string' || candidate.packDir.length === 0) fail('"packDir"');
  if (typeof candidate.preimageSha256 !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(candidate.preimageSha256)) {
    fail('"preimageSha256" (must be "sha256:<64 hex chars>")');
  }
  if (candidate.dryRun !== undefined && typeof candidate.dryRun !== 'boolean') {
    fail('"dryRun" (must be boolean when present)');
  }
  if (candidate.signature !== undefined && candidate.signature !== null) {
    const sig = candidate.signature;
    if (typeof sig !== 'object' || Array.isArray(sig)) fail('"signature" (must be an object or null/absent)');
    if (typeof sig.algorithm !== 'string' || typeof sig.keyId !== 'string' || typeof sig.value !== 'string') {
      fail('"signature" (present but not shaped {algorithm, keyId, value})');
    }
  }
}

/**
 * FR-15/FR-16's own extension into the registration flow (see this file's own header): a non-
 * dry-run candidate carrying a populated signature is refused outright, never silently registered
 * with its signature discarded.
 *
 * @param {object} candidate
 * @param {string} candidatePath
 */
function assertNoRealSignature(candidate, candidatePath) {
  const dryRun = candidate.dryRun === true;
  const hasSignature = candidate.signature !== undefined && candidate.signature !== null;
  if (hasSignature && !dryRun) {
    throw new RegisterRealCandidateSignedError(candidatePath);
  }
}

async function loadValidRegistry(registryPath) {
  const parsed = await readJsonFile(registryPath, 'registry');
  const schema = await loadRegistrySchema();
  const errors = validateSchema(schema, parsed);
  if (errors.length > 0) {
    throw new RegistrySchemaInvalidError(registryPath, errors);
  }
  return parsed;
}

/**
 * Deterministic, sorted-key JSON serialization of any JSON-compatible value — used ONLY for
 * structural equality comparison of registry entries below (never written to disk, never hashed
 * into a digest field). Kept as an independent, self-contained copy rather than importing
 * `tools/review-record/lib/chain.mjs#stableStringify` — that tool owns a disjoint file set in
 * this same wave-2 batch and this tool must not take a cross-tool dependency on code that could
 * still be changing under a sibling task (same "independent copy, not a cross-tool import"
 * convention `cli.mjs#parseFlags`'s own header already documents).
 *
 * @param {*} value
 * @returns {string}
 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

/**
 * The ONE comparison both append-only enforcement layers (see this file's own header) reduce to:
 * every entry present in `oldEntries` must be present, unchanged, at the SAME index in
 * `newEntries` — `newEntries` may be longer (append is legal), never shorter, never reordered,
 * never mutated. Structural (key-order-independent) equality via `stableStringify`, not raw
 * `JSON.stringify` equality — a registry entry that survived a mutation/rewrite tool that happened
 * to reorder its keys is still, correctly, "unchanged" under this check.
 *
 * @param {object[]} oldEntries
 * @param {object[]} newEntries
 * @param {string} contextLabel prefixed onto any violation message (identifies WHICH layer/step
 *   raised it — `register`'s own in-process check vs. a specific git-history transition).
 */
export function assertEntriesPrefixPreserving(oldEntries, newEntries, contextLabel) {
  if (!Array.isArray(oldEntries) || !Array.isArray(newEntries)) {
    throw new RegistryAppendOnlyViolationError(`${contextLabel}: entries must be an array on both sides`);
  }
  if (newEntries.length < oldEntries.length) {
    throw new RegistryAppendOnlyViolationError(
      `${contextLabel}: entries array shrank from ${oldEntries.length} to ${newEntries.length} — an ` +
        'entry was removed.',
    );
  }
  for (let i = 0; i < oldEntries.length; i += 1) {
    if (stableStringify(oldEntries[i]) !== stableStringify(newEntries[i])) {
      throw new RegistryAppendOnlyViolationError(
        `${contextLabel}: entry at index ${i} was mutated or reordered.`,
      );
    }
  }
}

/**
 * Layer (1), see this file's own header: `register` must append EXACTLY ONE new entry per
 * invocation (never zero, never more than one), on top of every existing entry left byte-for-byte
 * (structurally) unchanged, with `schemaVersion` itself unchanged.
 *
 * @param {{schemaVersion: number, entries: object[]}} currentDoc the document read from
 *   `--registry` moments ago
 * @param {{schemaVersion: number, entries: object[]}} nextDoc the document `register` is about to
 *   write
 */
export function assertRegisterAppendsExactlyOne(currentDoc, nextDoc) {
  if (currentDoc.schemaVersion !== nextDoc.schemaVersion) {
    throw new RegistryAppendOnlyViolationError(
      `register: schemaVersion changed from ${currentDoc.schemaVersion} to ${nextDoc.schemaVersion} ` +
        '— a single register call must never change the registry document\'s own schemaVersion.',
    );
  }
  if (nextDoc.entries.length !== currentDoc.entries.length + 1) {
    throw new RegistryAppendOnlyViolationError(
      `register: expected exactly one new entry to be appended (had ${currentDoc.entries.length}, ` +
        `would produce ${nextDoc.entries.length}).`,
    );
  }
  assertEntriesPrefixPreserving(currentDoc.entries, nextDoc.entries, 'register (in-process, layer 1)');
}

/**
 * Layer (2), see this file's own header: walks EVERY git-committed revision of `registryRelPath`
 * (oldest to newest) and asserts each one is entry-prefix-compatible with its immediate
 * predecessor. Exported standalone (not called by `run` below) — a future `npm run validate` wire-
 * in (P3-T6, structural-only per this plan's own scope note) or a dedicated test invokes this
 * directly against `releases/registry.json`'s real git history; `register` itself only ever
 * enforces layer (1) at write time (a not-yet-committed working-tree write has no git history of
 * its own yet to walk).
 *
 * Uses `git log`/`git show` only (via `node:child_process#execFileSync`) — read-only, offline, no
 * network call, and no mutation of git state of any kind.
 *
 * @param {string} repoRoot repository root `git` should be invoked from (the `cwd` for both
 *   subcommands below)
 * @param {string} registryRelPath path to the registry file, RELATIVE to `repoRoot` (e.g.
 *   `"releases/registry.json"`) — matches how `git log`/`git show` address a tracked path.
 * @returns {{ revisions: number }} the number of committed revisions walked (0 means the file has
 *   no committed history yet — not itself a violation; there is nothing to compare).
 */
export function checkRegistryHistoryAppendOnly(repoRoot, registryRelPath) {
  let logOutput;
  try {
    logOutput = execFileSync(
      'git',
      ['log', '--format=%H', '--follow', '--', registryRelPath],
      { cwd: repoRoot, encoding: 'utf8' },
    );
  } catch (err) {
    // A repository with literally zero commits yet (no HEAD at all) makes `git log` itself fail —
    // distinct from "this repo has commits, but none touch this path" (which succeeds with empty
    // output). Both mean "nothing to compare yet," not a tooling failure: fail-closed here would
    // wrongly reject the legitimate first `register` call ever made against a brand-new repo.
    const stderr = typeof err.stderr === 'string' ? err.stderr : String(err.stderr ?? err.message ?? '');
    if (/does not have any commits yet/.test(stderr) || /unknown revision or path not in the working tree/.test(stderr)) {
      return { revisions: 0 };
    }
    throw new UsageError(`register: "git log" failed for ${registryRelPath}: ${err.message}`);
  }
  const hashes = logOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse(); // git log lists newest-first; walk oldest-first so "predecessor -> successor" reads naturally.

  let previous = null;
  for (const hash of hashes) {
    let raw;
    try {
      raw = execFileSync('git', ['show', `${hash}:${registryRelPath}`], { cwd: repoRoot, encoding: 'utf8' });
    } catch (err) {
      throw new UsageError(`register: "git show ${hash}:${registryRelPath}" failed: ${err.message}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new UsageError(
        `register: commit ${hash} of ${registryRelPath} is not valid JSON (${err.message}) — cannot ` +
          'walk append-only history over a non-JSON committed revision.',
      );
    }
    if (previous !== null) {
      if (previous.schemaVersion !== parsed.schemaVersion) {
        throw new RegistryAppendOnlyViolationError(
          `git history (commit ${hash}): schemaVersion changed from ${previous.schemaVersion} to ` +
            `${parsed.schemaVersion} between two committed revisions of ${registryRelPath}.`,
        );
      }
      assertEntriesPrefixPreserving(
        previous.entries ?? [],
        parsed.entries ?? [],
        `git history (commit ${hash})`,
      );
    }
    previous = parsed;
  }
  return { revisions: hashes.length };
}

/**
 * @param {object} [options]
 * @param {string} [options.candidate] path to a JSON file carrying either `manifest`'s bare
 *   reporting object or `sign`'s full reporting object (dry-run or, in principle, real — a real
 *   one is rejected fail-closed by `assertNoRealSignature` above).
 * @param {string} [options.registry] path to an EXISTING `schemas/release-registry.schema.json`-
 *   shaped registry document (`releases/registry.json`'s own seed, or a fixture standing in for
 *   it) — `register` never creates this file itself; seeding it is this task's own one-time,
 *   separately-committed act, not a side effect of a CLI call.
 * @returns {Promise<{schemaVersion: string, registryPath: string, candidatePath: string,
 *   dryRun: boolean, entry: object, entryIndex: number, totalEntries: number}>} printed to stdout
 *   ONLY after the new registry document has been written successfully.
 */
export async function run(options = {}) {
  const candidatePath = requirePathOption(options.candidate, 'candidate', 'a manifest/sign reporting-object JSON file');
  const registryPath = requirePathOption(options.registry, 'registry', 'an existing releases/registry.json-shaped file');

  const candidate = await readJsonFile(candidatePath, 'candidate');
  assertCandidateShape(candidate, candidatePath);
  assertNoRealSignature(candidate, candidatePath);

  // Never trust the candidate document's own claims — re-read the pack's canonical manifest bytes
  // fresh, exactly as `./verify.mjs` does for its own class-(1) byte-drift check.
  const fresh = await readCanonicalManifestBytes(candidate.packDir);
  const freshManifestDigest = `sha256:${fresh.sha256}`;
  if (freshManifestDigest !== candidate.preimageSha256) {
    throw new RegisterByteDriftError(candidate.preimageSha256, fresh.sha256, fresh.manifestPath);
  }

  let manifestJson;
  try {
    manifestJson = JSON.parse(fresh.bytes.toString('utf8'));
  } catch (err) {
    throw new UsageError(`register: ${fresh.manifestPath} is not valid JSON (${err.message})`);
  }
  if (typeof manifestJson.moduleId !== 'string' || manifestJson.moduleId.length === 0) {
    throw new UsageError(`register: ${fresh.manifestPath} is missing a non-empty "moduleId"`);
  }
  if (typeof manifestJson.packVersion !== 'string' || manifestJson.packVersion.length === 0) {
    throw new UsageError(`register: ${fresh.manifestPath} is missing a non-empty "packVersion"`);
  }

  const packDigest = await computePackDigest(candidate.packDir);

  const currentRegistry = await loadValidRegistry(registryPath);

  const duplicate = (currentRegistry.entries ?? []).some(
    (entry) => entry.moduleId === manifestJson.moduleId && entry.version === manifestJson.packVersion,
  );
  if (duplicate) {
    throw new RegistryDuplicateEntryError(manifestJson.moduleId, manifestJson.packVersion, registryPath);
  }

  // Exactly the OQ-4 field list, nothing more — `signature`/`signedAt`/`supersedes`/`withdrawnAt`/
  // `withdrawalReason` are ALWAYS null under this schema version, `withdrawalState` ALWAYS
  // "none," regardless of whether the candidate was dry-run signed or fully unsigned (see this
  // file's own header — the registry never bears a real signature, and E1 sets no withdrawal
  // state, full stop).
  const newEntry = {
    version: manifestJson.packVersion,
    moduleId: manifestJson.moduleId,
    packDigest: `sha256:${packDigest.sha256}`,
    manifestDigest: freshManifestDigest,
    signature: null,
    signedAt: null,
    supersedes: null,
    withdrawalState: 'none',
    withdrawnAt: null,
    withdrawalReason: null,
  };

  const nextRegistry = {
    schemaVersion: currentRegistry.schemaVersion,
    entries: [...(currentRegistry.entries ?? []), newEntry],
  };

  // Defense in depth: the freshly-built document must itself still validate (should always hold,
  // by construction, given `currentRegistry` already validated and `newEntry` matches the OQ-4
  // shape exactly — this proves it structurally rather than by inspection alone).
  const schema = await loadRegistrySchema();
  const schemaErrors = validateSchema(schema, nextRegistry);
  if (schemaErrors.length > 0) {
    throw new RegistrySchemaInvalidError(`${registryPath} (post-append, not yet written)`, schemaErrors);
  }

  // Append-only layer (1) — see this file's own header.
  assertRegisterAppendsExactlyOne(currentRegistry, nextRegistry);

  await writeFile(registryPath, `${JSON.stringify(nextRegistry, null, 2)}\n`, 'utf8');

  const result = {
    schemaVersion: '1.0',
    registryPath: path.resolve(registryPath),
    candidatePath: path.resolve(candidatePath),
    dryRun: candidate.dryRun === true,
    entry: newEntry,
    entryIndex: nextRegistry.entries.length - 1,
    totalEntries: nextRegistry.entries.length,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}
