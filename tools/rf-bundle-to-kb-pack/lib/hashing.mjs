// tools/rf-bundle-to-kb-pack/lib/hashing.mjs — SHA-256 hash pinning, the "Pin" phase
// (P2-T3, FR-7, 02 §4.6 Phase 1, seam invariant 5).
//
//   pinArtifacts(loadedBundle) -> Promise<PinnedBundle>
//
// Contract this file satisfies (see the module boundary table in ./../README.md):
//   - SHA-256 every input artifact before any transformation step: `run_id`, bundle ID, bundle
//     bytes, claim-ledger bytes, and every referenced source-card's bytes (02 §2.3 item 5,
//     §4.6 Phase 1) — plus, for completeness, every other artifact the loader resolved
//     (`module.json`, `authoring-decisions.yaml`, `research_brief.md`, `swarm_plan.yaml`,
//     `report_draft.md`, `verification.yaml`, `ccdash_event.yaml`, extraction cards), so
//     downstream (`eligibility.mjs`, the `inspect` verb) can read a flat hash for any artifact,
//     not just the invariant-5-named subset.
//   - Fail closed on:
//       * a missing artifact — the file the loader resolved a moment ago no longer exists at pin
//         time (`MissingArtifactError`, reused from `loader.mjs` — same error identity as a
//         loader-time miss, since from a caller's perspective both mean "the artifact this run
//         claimed to have is not there");
//       * changed bytes — 02 §4.6 Phase 1 lists "changed bytes" as its own failure condition,
//         distinct from "bundle not verified" (P2-T4's job). This module re-reads each artifact's
//         bytes fresh from disk at pin time and compares them, byte-for-byte, against the bytes
//         `loader.mjs` already read into `LoadedBundle`. A mismatch means the artifact was
//         mutated in the window between load and pin — a moving target this converter refuses to
//         hash silently (`HashMismatchError`);
//       * a path-escape attempt — NOT re-checked here. Per this module's boundary (below and the
//         README's module-boundary table), path resolution belongs to `loader.mjs` alone; this
//         module operates only on paths the loader already validated as in-bounds. See
//         `tests/ef-converter-hashing.test.mjs`'s path-escape test, which exercises the full
//         loader -> hashing pipeline and asserts the loader's `PathEscapeError` surfaces before
//         `pinArtifacts` is ever reached.
//   - Operates only on the `LoadedBundle` `loader.mjs` (P2-T2) returns — this module must not
//     re-resolve artifact *paths* itself (that responsibility belongs to the loader); it re-reads
//     bytes at the loader's already-resolved, already-in-bounds paths purely to detect drift.
//   - Never writes to `runDir` (seam invariant 6) — this module only calls `fs.readFile`, never a
//     write/rename/unlink.
//
// PinnedBundle shape: the `LoadedBundle` structure with a `sha256` (hex digest) property added to
// every artifact entry (`module`, `decisions`, `bundle`, and each key under `artifacts`), plus a
// top-level `hashes` map for convenient flat lookup (e.g. by the `inspect` verb's summary
// printer) without walking the nested structure.
//
//   {
//     ...loadedBundle fields (runDir, modulePath, moduleDir, moduleId, runId, bundleId),
//     module:    { path, raw, parsed, sha256 },
//     decisions: { path, raw, parsed, sha256 },
//     bundle:    { path, raw, parsed, sha256 },
//     artifacts: {
//       researchBrief: { path, raw, sha256 },
//       swarmPlan:     { path, raw, parsed, sha256 },
//       claimLedger:   { path, raw, parsed, sha256 },
//       report:        { path, raw, sha256 },
//       verification:  { path, raw, parsed, sha256 },
//       ccdashEvent:   { path, raw, parsed, sha256 },
//       sourceCards:     [ { path, raw, frontmatter, body, sha256 }, ... ],   // same order as loader
//       extractionCards: [ { path, raw, parsed, sha256 }, ... ],
//     },
//     hashes: {
//       module: 'sha256hex', decisions: 'sha256hex', bundle: 'sha256hex',
//       researchBrief: 'sha256hex', swarmPlan: 'sha256hex', claimLedger: 'sha256hex',
//       report: 'sha256hex', verification: 'sha256hex', ccdashEvent: 'sha256hex',
//       sourceCards: { '<filename>': 'sha256hex', ... },
//       extractionCards: { '<filename>': 'sha256hex', ... },
//     },
//   }

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { UsageError } from './errors.mjs';
import { MissingArtifactError } from './loader.mjs';

/**
 * The bytes hashing re-read from disk for a given artifact do not match the bytes `loader.mjs`
 * already captured in `LoadedBundle` for that same artifact — the artifact changed underneath the
 * converter between load and pin. 02 §4.6 Phase 1 names this "changed bytes" as its own failure
 * condition. Exit 1 (usage): the caller must re-run against a stable, unmodified run directory —
 * this is not a schema problem with the artifact's content, it is an integrity problem with the
 * bytes themselves.
 */
export class HashMismatchError extends UsageError {
  constructor(label, resolvedPath) {
    super(
      `content of "${label}" at ${resolvedPath} changed after it was loaded — the bytes hashed at ` +
        'pin time do not match the bytes read at load time. Refusing to pin a moving target.',
    );
    this.label = label;
    this.resolvedPath = resolvedPath;
  }
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Re-reads `entry.path` fresh from disk, fails closed if it is gone or has changed since the
 * loader read it, and returns a new entry object (never mutates `entry`) with a `sha256` field
 * added.
 *
 * @param {string} label descriptive artifact name, for error messages
 * @param {{ path: string, raw: Buffer }} entry a `LoadedBundle` artifact entry
 * @returns {Promise<object>} `entry` plus `sha256`
 */
async function pinEntry(label, entry) {
  if (!entry || typeof entry.path !== 'string' || !Buffer.isBuffer(entry.raw)) {
    throw new UsageError(`pinArtifacts: malformed loaded-artifact entry for "${label}"`);
  }

  let freshRaw;
  try {
    freshRaw = await readFile(entry.path);
  } catch (err) {
    if (err.code === 'ENOENT') throw new MissingArtifactError(label, entry.path);
    throw err;
  }

  if (!freshRaw.equals(entry.raw)) {
    throw new HashMismatchError(label, entry.path);
  }

  return { ...entry, sha256: sha256Hex(freshRaw) };
}

// The single-file artifact keys under `LoadedBundle.artifacts` (matches loader.mjs's
// SINGLE_FILE_ARTIFACTS list) — pinned in this fixed order for deterministic `hashes` map
// construction (seam invariant 13).
const SINGLE_FILE_ARTIFACT_KEYS = [
  'researchBrief',
  'swarmPlan',
  'claimLedger',
  'report',
  'verification',
  'ccdashEvent',
];

/**
 * @param {object} loadedBundle the value `loader.loadBundle()` (P2-T2) resolves to
 * @returns {Promise<object>} the loaded bundle plus a per-artifact SHA-256 hash map
 */
export async function pinArtifacts(loadedBundle) {
  if (!loadedBundle || typeof loadedBundle !== 'object') {
    throw new UsageError('pinArtifacts requires a loaded bundle (see loader.mjs#loadBundle)');
  }
  const { module, decisions, bundle, artifacts } = loadedBundle;
  if (!module || !decisions || !bundle || !artifacts) {
    throw new UsageError(
      'pinArtifacts requires a fully-resolved LoadedBundle (missing module/decisions/bundle/artifacts)',
    );
  }

  const pinnedModule = await pinEntry('module', module);
  const pinnedDecisions = await pinEntry('authoring-decisions', decisions);
  const pinnedBundle = await pinEntry('evidence_bundle', bundle);

  const pinnedSingleFiles = {};
  for (const key of SINGLE_FILE_ARTIFACT_KEYS) {
    const entry = artifacts[key];
    if (!entry) throw new UsageError(`pinArtifacts: LoadedBundle is missing artifact "${key}"`);
    pinnedSingleFiles[key] = await pinEntry(key, entry);
  }

  const pinnedSourceCards = [];
  for (const card of artifacts.sourceCards ?? []) {
    pinnedSourceCards.push(await pinEntry(`source card ${path.basename(card.path)}`, card));
  }

  const pinnedExtractionCards = [];
  for (const card of artifacts.extractionCards ?? []) {
    pinnedExtractionCards.push(await pinEntry(`extraction card ${path.basename(card.path)}`, card));
  }

  const hashes = {
    module: pinnedModule.sha256,
    decisions: pinnedDecisions.sha256,
    bundle: pinnedBundle.sha256,
    ...Object.fromEntries(SINGLE_FILE_ARTIFACT_KEYS.map((key) => [key, pinnedSingleFiles[key].sha256])),
    sourceCards: Object.fromEntries(pinnedSourceCards.map((card) => [path.basename(card.path), card.sha256])),
    extractionCards: Object.fromEntries(
      pinnedExtractionCards.map((card) => [path.basename(card.path), card.sha256]),
    ),
  };

  return {
    ...loadedBundle,
    module: pinnedModule,
    decisions: pinnedDecisions,
    bundle: pinnedBundle,
    artifacts: {
      ...artifacts,
      ...pinnedSingleFiles,
      sourceCards: pinnedSourceCards,
      extractionCards: pinnedExtractionCards,
    },
    hashes,
  };
}
