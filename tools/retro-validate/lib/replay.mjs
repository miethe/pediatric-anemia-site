// tools/retro-validate/lib/replay.mjs -- REPLAY module (P4-T3, Evidence Foundry E1 Phase 4,
// FR-19, ADR-0006). Owns two things:
//
//   1. `resolveCandidate({ registryPath, candidateDigest })` -- version-pinned candidate
//      resolution. Never "current tree": there is no code path in this file (or anywhere else in
//      this tool) that reads `modules/<id>/rules.json`/`candidates.json` off the live repository
//      tree. The ONLY candidate content this module will ever replay against is pinned content
//      resolved via a registry entry whose `packDigest` matches the caller's `--candidate-digest`
//      -- see "Candidate resolution" below for the full contract.
//   2. `replayCorpus({ corpusDoc, candidate })` + `writeReplayOutput(...)` -- deterministic replay
//      of every corpus case through `src/engine.js#assess()` using the resolved candidate's pinned
//      `rules`/`candidates`, with canonical (sorted-key) serialization, sorted case order, and no
//      timestamps in the written bytes (`meta.generatedAt` is stripped -- see `stripNonDeterministic`).
//
// `lib/verbs/run.mjs` (P4-T3) is this module's only caller in this tool -- the boundary gate
// (`../boundary.mjs#checkFixtures`, called first, unconditionally, since P4-T2) still runs before
// ANY of this file's logic; nothing here re-implements or bypasses that gate.
//
// -----------------------------------------------------------------------------------------------
// Candidate resolution -- the "dry-run registry fixture in E1" contract
// -----------------------------------------------------------------------------------------------
//
// `schemas/release-registry.schema.json` (P1-T5) is a shared, already-wired schema this file
// reads (read-only) to validate `--registry <path>`'s shape -- reused, not copied, and this is the
// ONLY P1-T5 artifact P4-T3 consumes (per this phase's own dependency note: P4-T3 does not wait on
// Phase 3, because `releases/registry.json` itself does not exist yet -- P3-T4 is the future task
// that ships the real seed file and its `register` writer). Execution here always pins against a
// dry-run registry FIXTURE (`tests/fixtures/ef-retro/registries/<name>/registry.json`), never a
// real release.
//
// A `$defs/registryEntry` is `additionalProperties: false` over EXACTLY the OQ-4 field list --
// there is no field on a registry entry that can point at "where the candidate content lives".
// This file therefore defines its own tool-local, E1-only CONVENTION for candidate-content
// location, entirely decoupled from the registry schema itself:
//
//   <dirname(registryPath)>/candidates/<entry.moduleId>/<entry.version>/rules.json
//   <dirname(registryPath)>/candidates/<entry.moduleId>/<entry.version>/candidates.json
//
// i.e. a registry fixture directory pairs its `registry.json` with a sibling `candidates/` tree
// holding the exact two parameters `src/engine.js#assess(input, moduleId, rules, candidates)`
// takes as its `rules`/`candidates` arguments, pinned per (moduleId, version). This module never
// falls back to reading `modules/<moduleId>/rules.json` off the live tree if that pinned directory
// is missing -- see `resolveCandidate`'s `ENOENT` branch below, which throws `RegistryError`
// rather than substituting live content. "Current tree" execution is therefore not merely
// discouraged, it is a code path that does not exist in this file (grep-tested in
// `tests/ef-retro-determinism.test.mjs`: no import of, or path literal naming, `modules/` appears
// anywhere in this file).
//
// The registry entry's `packDigest` (already schema-required to be `sha256:<64 hex>`) is this
// tool's OWN definition of "SHA-256 of the canonicalized kb-pack contents" (the release-registry
// schema's own field description) -- `computePackDigest` below: SHA-256 over a small, fixed-shape
// canonical JSON object binding the SHA-256 of each pinned file's RAW bytes, read back off disk
// verbatim and never re-parsed/re-serialized before hashing (same posture
// `tools/release-sign/lib/canonical-bytes.mjs` documents for its own signing preimage). This is
// self-consistent by construction: the same algorithm computes the digest recorded in a fixture at
// authoring time and the digest recomputed at replay time, so `resolveCandidate` independently
// RE-VERIFIES that the pinned candidate directory's content actually hashes to what the registry
// entry claims -- a `--candidate-digest` that matches a registry entry whose OWN pinned content has
// drifted still fails closed (see the `recomputedDigest !== entry.packDigest` check).
//
// This is a dry-run, E1-only algorithm choice -- it makes no claim to match whatever real
// production kb-pack hashing `tools/rf-bundle-to-kb-pack`/`tools/release-sign` eventually use for a
// signed release (that is out of scope; P4-T3's job is proving the PINNING mechanism fails closed
// on mismatch/drift, not reproducing a specific production hash algorithm ahead of Phase 3/5).

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../../../scripts/lib/json-schema-lite.mjs';
import { assess } from '../../../src/engine.js';
import { isRegisteredModule } from '../../../src/modules/registry.js';
import { RegistryError, UsageError } from './errors.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..');

/** The shared, already-wired P1-T5 schema this module validates `--registry <path>` against. */
export const RELEASE_REGISTRY_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-registry.schema.json');

/** Filenames a pinned candidate-content directory must contain (see this file's header). */
export const CANDIDATE_RULES_FILENAME = 'rules.json';
export const CANDIDATE_CATALOG_FILENAME = 'candidates.json';

/** The `run` verb's own output artifact filename (see `writeReplayOutput`). */
export const REPLAY_OUTPUT_FILENAME = 'replay-output.json';

/**
 * Bump only when this module's OWN replay/serialization logic changes in a way that could change
 * emitted bytes for identical (corpus, candidate) inputs -- never on a whim, never derived from
 * wall-clock time. Recorded on every `replay-output.json` (`schemaVersion`-adjacent, not a
 * substitute for it) so a reader of that one file alone knows which harness build produced it.
 */
export const REPLAY_HARNESS_VERSION = '0.1.0';

let cachedRegistrySchema;

async function loadReleaseRegistrySchema() {
  if (!cachedRegistrySchema) {
    const raw = await readFile(RELEASE_REGISTRY_SCHEMA_PATH, 'utf8');
    cachedRegistrySchema = JSON.parse(raw);
  }
  return cachedRegistrySchema;
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** See this file's header, "Candidate resolution" -- the E1 tool-local candidate-content convention. */
function candidateContentDir(registryPath, moduleId, version) {
  return path.join(path.dirname(registryPath), 'candidates', moduleId, version);
}

/** See this file's header -- this tool's own, self-consistent "kb-pack contents digest" definition. */
function computePackDigest({ rulesBytes, candidatesBytes }) {
  const combined = JSON.stringify({
    rules: sha256Hex(rulesBytes),
    candidates: sha256Hex(candidatesBytes),
  });
  return `sha256:${sha256Hex(Buffer.from(combined, 'utf8'))}`;
}

async function readJsonFile(filePath, onMissing) {
  let bytes;
  try {
    bytes = await readFile(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw onMissing();
    }
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch (err) {
    throw new RegistryError(`"${filePath}" is not valid JSON: ${err.message}`);
  }
  return { bytes, parsed };
}

/**
 * Resolves a version-pinned candidate build (FR-19): validates `--registry <path>` against
 * `schemas/release-registry.schema.json`, finds the EXACTLY ONE entry whose `packDigest` equals
 * `--candidate-digest`, resolves its pinned candidate-content directory (see this file's header
 * convention), and independently re-verifies that pinned content's own recomputed digest agrees
 * with the registry entry -- fail-closed (throws `RegistryError`) on every disagreement class:
 * missing/unparsable registry, schema violation, no matching entry (an unpinned/unregistered
 * digest -- the "never current tree" case), an ambiguous match, an unregistered `moduleId`, a
 * missing pinned-content directory, or drifted pinned content.
 *
 * @param {{ registryPath?: string, candidateDigest?: string }} options
 * @returns {Promise<{ moduleId: string, version: string, packDigest: string, rules: unknown, candidates: unknown }>}
 * @throws {UsageError} `registryPath`/`candidateDigest` not supplied, or `--registry` unreadable/unparsable
 * @throws {RegistryError} any candidate-resolution failure (see above)
 */
export async function resolveCandidate({ registryPath, candidateDigest } = {}) {
  if (!registryPath || typeof registryPath !== 'string') {
    throw new UsageError('resolveCandidate requires --registry <path>');
  }
  if (!candidateDigest || typeof candidateDigest !== 'string') {
    throw new UsageError('resolveCandidate requires --candidate-digest <sha256:...>');
  }

  let registryRaw;
  try {
    registryRaw = await readFile(registryPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new UsageError(`no registry document found at "${registryPath}"`);
    }
    throw err;
  }
  let registryDoc;
  try {
    registryDoc = JSON.parse(registryRaw);
  } catch (err) {
    throw new UsageError(`"${registryPath}" is not valid JSON: ${err.message}`);
  }

  const schema = await loadReleaseRegistrySchema();
  const schemaErrors = validate(schema, registryDoc);
  if (schemaErrors.length > 0) {
    const detail = schemaErrors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
    throw new RegistryError(
      `registry document "${registryPath}" fails schemas/release-registry.schema.json `
        + `(${schemaErrors.length} violation(s)):\n${detail}`,
    );
  }

  const matches = registryDoc.entries.filter((entry) => entry.packDigest === candidateDigest);
  if (matches.length === 0) {
    throw new RegistryError(
      `candidate digest "${candidateDigest}" matches no entry in registry "${registryPath}" -- `
        + 'refusing to replay against an unpinned/unregistered candidate (this tool never falls '
        + 'back to "current tree" execution).',
    );
  }
  if (matches.length > 1) {
    throw new RegistryError(
      `candidate digest "${candidateDigest}" matches ${matches.length} entries in registry `
        + `"${registryPath}" -- ambiguous candidate resolution, refusing to guess.`,
    );
  }
  const entry = matches[0];

  if (!isRegisteredModule(entry.moduleId)) {
    throw new RegistryError(
      `registry entry for candidate digest "${candidateDigest}" names moduleId "${entry.moduleId}", `
        + 'which is not registered in src/modules/registry.js -- refusing to replay against an '
        + 'unresolvable module.',
    );
  }

  const contentDir = candidateContentDir(registryPath, entry.moduleId, entry.version);
  const rulesPath = path.join(contentDir, CANDIDATE_RULES_FILENAME);
  const candidatesPath = path.join(contentDir, CANDIDATE_CATALOG_FILENAME);

  const { bytes: rulesBytes, parsed: rules } = await readJsonFile(rulesPath, () => new RegistryError(
    `registry entry "${entry.moduleId}"@"${entry.version}" resolved, but no pinned candidate `
      + `content found at "${rulesPath}" -- a registered digest with no matching pinned-content `
      + `directory cannot be replayed (this tool never falls back to reading modules/${entry.moduleId}/`
      + `${CANDIDATE_RULES_FILENAME} off the live tree).`,
  ));
  const { bytes: candidatesBytes, parsed: candidates } = await readJsonFile(candidatesPath, () => new RegistryError(
    `registry entry "${entry.moduleId}"@"${entry.version}" resolved, but no pinned candidate `
      + `catalog found at "${candidatesPath}".`,
  ));

  const recomputedDigest = computePackDigest({ rulesBytes, candidatesBytes });
  if (recomputedDigest !== entry.packDigest) {
    throw new RegistryError(
      `pinned candidate content at "${contentDir}" does not hash to its own registry entry's `
        + `packDigest (registered "${entry.packDigest}", recomputed "${recomputedDigest}") -- `
        + 'fail-closed: the pinned candidate content has drifted from what the registry attests to.',
    );
  }

  return {
    moduleId: entry.moduleId,
    version: entry.version,
    packDigest: entry.packDigest,
    rules,
    candidates,
  };
}

/**
 * Recursively sorts every plain object's keys (arrays keep their existing element order -- e.g.
 * `rankedDifferential`'s rank order is meaningful and must not be disturbed). Pure, no I/O.
 * @param {unknown} value
 * @returns {unknown}
 */
export function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(value[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Canonical, deterministic JSON bytes for a replay artifact -- sorted keys (via `canonicalize`),
 * fixed 2-space indent, trailing newline. Matches the `${JSON.stringify(x, null, 2)}\n` convention
 * `tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs` already uses for its own written artifacts.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalStringify(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

/**
 * `src/engine.js#assess()` stamps `meta.generatedAt` with `new Date().toISOString()` on every
 * call -- the ONE non-deterministic field it produces. FR-19 requires "no timestamps in hashed
 * bytes", so this strips exactly that key (and only that key) before a case's output is embedded
 * in the replay document. `run-provenance.json` (P4-T4) is the sole sanctioned timestamp location,
 * outside these determinism-compared bytes -- this file never re-introduces one.
 * @param {ReturnType<typeof assess>} assessResult
 */
function stripNonDeterministic(assessResult) {
  const { meta, ...rest } = assessResult;
  const { generatedAt, ...metaRest } = meta ?? {};
  return { ...rest, meta: metaRest };
}

/**
 * Replays every corpus case through the resolved candidate's pinned `rules`/`candidates` via
 * `src/engine.js#assess()`. Deterministic: cases are sorted by `caseId` (ascending, ordinal string
 * comparison) BEFORE replay regardless of their declared order in `corpus.json`, and each case's
 * engine output has its one non-deterministic field stripped (`stripNonDeterministic`). Nothing in
 * this function performs I/O beyond the pure `assess()` call -- writing the result is
 * `writeReplayOutput`'s job.
 * @param {{ corpusDoc: { corpusId: string, schemaVersion: number, cases: object[] }, candidate: Awaited<ReturnType<typeof resolveCandidate>> }} args
 * @returns {{ schemaVersion: 1, harnessVersion: string, corpusId: string, corpusSchemaVersion: number, candidate: { moduleId: string, version: string, packDigest: string }, caseCount: number, cases: object[] }}
 */
export function replayCorpus({ corpusDoc, candidate }) {
  const sortedCases = [...corpusDoc.cases].sort((a, b) => {
    if (a.caseId < b.caseId) return -1;
    if (a.caseId > b.caseId) return 1;
    return 0;
  });

  const cases = sortedCases.map((corpusCase) => {
    const output = assess(corpusCase.input, candidate.moduleId, candidate.rules, candidate.candidates);
    return {
      caseId: corpusCase.caseId,
      provenance: corpusCase.provenance,
      tags: corpusCase.tags ?? [],
      referenceLabels: corpusCase.referenceLabels ?? null,
      output: stripNonDeterministic(output),
    };
  });

  return {
    schemaVersion: 1,
    harnessVersion: REPLAY_HARNESS_VERSION,
    corpusId: corpusDoc.corpusId,
    corpusSchemaVersion: corpusDoc.schemaVersion,
    candidate: {
      moduleId: candidate.moduleId,
      version: candidate.version,
      packDigest: candidate.packDigest,
    },
    caseCount: cases.length,
    cases,
  };
}

function digestSlug(candidateDigest) {
  return candidateDigest.replace(/^sha256:/, 'sha256-');
}

/**
 * `run`'s deterministic, convention-derived output directory -- NOT a CLI flag (this task's own
 * signature is exactly `run --corpus <dir> --candidate-digest <digest> --registry <path>`, no
 * `--out`). Two invocations with an identical `(corpusId, candidateDigest)` pair always resolve to
 * the exact same path, which is what makes the double-run byte-identity proof meaningful: the
 * second run overwrites the same file the first run wrote, and the bytes must match exactly.
 * @param {{ corpusId: string, candidateDigest: string }} args
 * @returns {string}
 */
export function defaultOutputDir({ corpusId, candidateDigest }) {
  return path.join(REPO_ROOT, 'build', 'retro-runs', corpusId, digestSlug(candidateDigest));
}

/**
 * Writes `replayCorpus`'s output document as canonical bytes to `<outputDir>/replay-output.json`,
 * creating `outputDir` if needed. Called only after `replayCorpus` has fully resolved (see
 * `lib/verbs/run.mjs`) -- there is no intermediate/incremental write, so a `run` invocation that
 * fails partway through resolution or replay leaves zero output on disk.
 * @param {{ outputDir: string, document: ReturnType<typeof replayCorpus> }} args
 * @returns {Promise<{ outputPath: string, bytes: string }>}
 */
export async function writeReplayOutput({ outputDir, document }) {
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, REPLAY_OUTPUT_FILENAME);
  const bytes = canonicalStringify(document);
  await writeFile(outputPath, bytes, 'utf8');
  return { outputPath, bytes };
}
