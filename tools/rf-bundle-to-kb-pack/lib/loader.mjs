// tools/rf-bundle-to-kb-pack/lib/loader.mjs — read-only rf-bundle loader + artifact resolution
// (P2-T2, FR-6, 02 §4.3).
//
//   loadBundle({ runDir, modulePath }) -> Promise<LoadedBundle>
//
// Contract this file satisfies (see the module boundary table in ./../README.md):
//   - Resolves every artifact path (`evidence_bundle.yaml`, `claims/claim_ledger.yaml`,
//     `reviews/verification.yaml`, `sources/src_*.md`, `extractions/ext_*.yaml`, and the
//     single-file artifacts `research_brief`/`swarm_plan`/`report`/`ccdash_event`) relative to
//     `evidence_bundle.yaml.artifacts` — never a hard-coded relative-path assumption (02 §4.3's
//     closing line).
//   - Also resolves `modules/<module_id>/module.json` (envelope) and
//     `modules/<module_id>/authoring-decisions.yaml`, both relative to the `--module` path the
//     caller supplies (the module directory is `path.dirname(modulePath)`).
//   - `authoring-decisions.yaml` legitimately does not exist until P3-T1 lands. Its absence fails
//     closed with a specific `DecisionsNotFoundError` naming the missing path, never a generic
//     stack trace.
//   - Never writes to `runDir` under any circumstance (seam invariant 6, 02 §2.3 item 6) — this
//     module only calls `fs.stat`/`fs.readFile`/`fs.readdir`, never a write/rename/unlink.
//   - Reads YAML from disk via `./yaml-lite.mjs` (seam invariant 2) — no `yaml` npm dependency
//     (see README "Design decisions"); JSON artifacts (`module.json`) use `JSON.parse`.
//   - Rejects a path-escape attempt: any artifact path that, once resolved against `runDir`,
//     would fall outside it (e.g. a `../` component) is rejected before any read is attempted.
//
// LoadedBundle shape: enough for hashing.mjs (P2-T3) to hash every raw artifact buffer, and for
// eligibility.mjs (P2-T4) to read parsed bundle/verification/claim-ledger/source-card content,
// without either module re-reading the filesystem itself.
//
//   {
//     runDir, modulePath, moduleDir, moduleId,
//     module:     { path, raw: Buffer, parsed },              // module.json
//     decisions:  { path, raw: Buffer, parsed },                // authoring-decisions.yaml
//     bundle:     { path, raw: Buffer, parsed },                 // evidence_bundle.yaml
//     runId, bundleId,                                            // convenience accessors
//     artifacts: {
//       researchBrief: { path, raw: Buffer },                      // markdown, unparsed
//       swarmPlan:     { path, raw: Buffer, parsed },
//       claimLedger:   { path, raw: Buffer, parsed },
//       report:        { path, raw: Buffer },                      // markdown, unparsed
//       verification:  { path, raw: Buffer, parsed },
//       ccdashEvent:   { path, raw: Buffer, parsed },
//       sourceCards:     [ { path, raw: Buffer, frontmatter, body }, ... ],   // sorted by filename
//       extractionCards: [ { path, raw: Buffer, parsed }, ... ],             // sorted by filename
//     },
//   }

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { SchemaError, UsageError } from './errors.mjs';
import { parseYamlDocument, parseYamlFrontmatter, YamlParseError } from './yaml-lite.mjs';

/** A required artifact (file or directory) is missing at its resolved path. Exit 1 (usage). */
export class MissingArtifactError extends UsageError {
  constructor(label, resolvedPath) {
    super(`missing required artifact "${label}" — expected at ${resolvedPath}`);
    this.label = label;
    this.resolvedPath = resolvedPath;
  }
}

/**
 * `modules/<module_id>/authoring-decisions.yaml` is absent. This is expected until P3-T1 lands —
 * but the loader must still fail closed with this specific, named error rather than a generic
 * crash (P2-T2 acceptance criterion).
 */
export class DecisionsNotFoundError extends UsageError {
  constructor(resolvedPath) {
    super(
      `authoring-decisions.yaml not found at ${resolvedPath} — this module has not yet recorded ` +
        'its authoring decisions. The converter refuses to proceed without an explicit decisions ' +
        'file rather than treating its absence as "no decisions needed."',
    );
    this.resolvedPath = resolvedPath;
  }
}

/** An artifact path from `evidence_bundle.yaml.artifacts` resolves outside `runDir`. Exit 1. */
export class PathEscapeError extends UsageError {
  constructor(label, relPath, runDir) {
    super(`artifact "${label}" path "${relPath}" resolves outside the run directory (${runDir})`);
    this.label = label;
    this.relPath = relPath;
    this.runDir = runDir;
  }
}

/** A required artifact exists but fails to parse as JSON/YAML. Exit 2 (schema). */
export class BundleParseError extends SchemaError {
  constructor(label, resolvedPath, cause) {
    super(`failed to parse "${label}" at ${resolvedPath}: ${cause.message}`, { cause });
    this.label = label;
    this.resolvedPath = resolvedPath;
  }
}

/** `evidence_bundle.yaml` has no (or a malformed) `artifacts` map. Exit 2 (schema). */
export class BundleShapeError extends SchemaError {
  constructor(message, resolvedPath) {
    super(`${message} (${resolvedPath})`);
    this.resolvedPath = resolvedPath;
  }
}

// The single-file artifact keys P2-T2 resolves, and whether each is YAML (parsed) or plain text
// (markdown, kept raw only). Matches `evidence_bundle.yaml.artifacts`' keys in the P1-T6 fixture.
const SINGLE_FILE_ARTIFACTS = [
  { key: 'research_brief', prop: 'researchBrief', yaml: false },
  { key: 'swarm_plan', prop: 'swarmPlan', yaml: true },
  { key: 'claim_ledger', prop: 'claimLedger', yaml: true },
  { key: 'report', prop: 'report', yaml: false },
  { key: 'verification', prop: 'verification', yaml: true },
  { key: 'ccdash_event', prop: 'ccdashEvent', yaml: true },
];

/**
 * Resolves `relPath` against `runDir`, rejecting any result that would escape it.
 *
 * @param {string} runDir absolute, already-resolved run directory
 * @param {string} label the `artifacts` key or a descriptive name, for error messages
 * @param {string} relPath the path as recorded in `evidence_bundle.yaml.artifacts`
 * @returns {string} the resolved, in-bounds absolute path
 */
function resolveInBounds(runDir, label, relPath) {
  const resolved = path.resolve(runDir, relPath);
  const relative = path.relative(runDir, resolved);
  if (relative === '' ) return resolved; // relPath === '.' — not expected, but not an escape either
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new PathEscapeError(label, relPath, runDir);
  }
  return resolved;
}

async function statOrNull(resolvedPath) {
  try {
    return await stat(resolvedPath);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function readRequiredFile(label, resolvedPath) {
  const info = await statOrNull(resolvedPath);
  if (!info || !info.isFile()) throw new MissingArtifactError(label, resolvedPath);
  return readFile(resolvedPath);
}

function parseYamlOrThrow(label, resolvedPath, raw) {
  try {
    return parseYamlDocument(raw.toString('utf8'));
  } catch (err) {
    if (err instanceof YamlParseError) throw new BundleParseError(label, resolvedPath, err);
    throw err;
  }
}

async function loadSingleFileArtifacts(runDir, artifactsMap) {
  const out = {};
  for (const { key, prop, yaml } of SINGLE_FILE_ARTIFACTS) {
    const relPath = artifactsMap[key];
    if (typeof relPath !== 'string' || relPath === '') {
      throw new BundleShapeError(`evidence_bundle.yaml.artifacts is missing a "${key}" entry`, runDir);
    }
    const resolvedPath = resolveInBounds(runDir, key, relPath);
    const raw = await readRequiredFile(key, resolvedPath);
    out[prop] = yaml
      ? { path: resolvedPath, raw, parsed: parseYamlOrThrow(key, resolvedPath, raw) }
      : { path: resolvedPath, raw };
  }
  return out;
}

async function loadCardDirectory({ runDir, artifactsMap, key, label, prefix, suffix, parseCard }) {
  const relPath = artifactsMap[key];
  if (typeof relPath !== 'string' || relPath === '') {
    throw new BundleShapeError(`evidence_bundle.yaml.artifacts is missing a "${key}" entry`, runDir);
  }
  const resolvedDir = resolveInBounds(runDir, key, relPath);
  const info = await statOrNull(resolvedDir);
  if (!info || !info.isDirectory()) throw new MissingArtifactError(label, resolvedDir);

  const entries = (await readdir(resolvedDir))
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .sort(); // codepoint order — deterministic, and matches the fixture's zero-padded numbering

  const cards = [];
  for (const name of entries) {
    const cardPath = path.join(resolvedDir, name);
    const raw = await readFile(cardPath);
    cards.push(parseCard(cardPath, raw));
  }
  return cards;
}

/**
 * @param {{ runDir: string, modulePath: string }} options
 * @returns {Promise<object>} the resolved, read-only bundle representation
 */
export async function loadBundle(options) {
  const { runDir: runDirInput, modulePath: modulePathInput } = options ?? {};
  if (typeof runDirInput !== 'string' || runDirInput === '') {
    throw new UsageError('loadBundle requires a non-empty "runDir" option');
  }
  if (typeof modulePathInput !== 'string' || modulePathInput === '') {
    throw new UsageError('loadBundle requires a non-empty "modulePath" option');
  }

  const runDir = path.resolve(runDirInput);
  const runDirInfo = await statOrNull(runDir);
  if (!runDirInfo || !runDirInfo.isDirectory()) {
    throw new MissingArtifactError('run-dir', runDir);
  }

  const modulePath = path.resolve(modulePathInput);
  const moduleRaw = await readRequiredFile('module', modulePath);
  let moduleParsed;
  try {
    moduleParsed = JSON.parse(moduleRaw.toString('utf8'));
  } catch (err) {
    throw new BundleParseError('module', modulePath, err);
  }
  const moduleId = moduleParsed?.id;
  if (typeof moduleId !== 'string' || moduleId === '') {
    throw new BundleShapeError('module.json is missing a string "id" field', modulePath);
  }

  const moduleDir = path.dirname(modulePath);
  const decisionsPath = path.join(moduleDir, 'authoring-decisions.yaml');
  const decisionsInfo = await statOrNull(decisionsPath);
  if (!decisionsInfo || !decisionsInfo.isFile()) {
    throw new DecisionsNotFoundError(decisionsPath);
  }
  const decisionsRaw = await readFile(decisionsPath);
  const decisionsParsed = parseYamlOrThrow('authoring-decisions', decisionsPath, decisionsRaw);

  const bundlePath = path.join(runDir, 'evidence_bundle.yaml');
  const bundleRaw = await readRequiredFile('evidence_bundle', bundlePath);
  const bundleParsed = parseYamlOrThrow('evidence_bundle', bundlePath, bundleRaw);

  const artifactsMap = bundleParsed?.artifacts;
  if (artifactsMap === null || typeof artifactsMap !== 'object' || Array.isArray(artifactsMap)) {
    throw new BundleShapeError('evidence_bundle.yaml is missing an "artifacts" map', bundlePath);
  }

  const singleFileArtifacts = await loadSingleFileArtifacts(runDir, artifactsMap);

  const sourceCards = await loadCardDirectory({
    runDir,
    artifactsMap,
    key: 'source_cards_dir',
    label: 'source_cards_dir',
    prefix: 'src_',
    suffix: '.md',
    parseCard: (cardPath, raw) => {
      try {
        const { frontmatter, body } = parseYamlFrontmatter(raw.toString('utf8'));
        return { path: cardPath, raw, frontmatter, body };
      } catch (err) {
        if (err instanceof YamlParseError) {
          throw new BundleParseError(`source card ${path.basename(cardPath)}`, cardPath, err);
        }
        throw err;
      }
    },
  });

  const extractionCards = await loadCardDirectory({
    runDir,
    artifactsMap,
    key: 'extraction_cards_dir',
    label: 'extraction_cards_dir',
    prefix: 'ext_',
    suffix: '.yaml',
    parseCard: (cardPath, raw) => ({
      path: cardPath,
      raw,
      parsed: parseYamlOrThrow(`extraction card ${path.basename(cardPath)}`, cardPath, raw),
    }),
  });

  return {
    runDir,
    modulePath,
    moduleDir,
    moduleId,
    module: { path: modulePath, raw: moduleRaw, parsed: moduleParsed },
    decisions: { path: decisionsPath, raw: decisionsRaw, parsed: decisionsParsed },
    bundle: { path: bundlePath, raw: bundleRaw, parsed: bundleParsed },
    runId: bundleParsed.run_id ?? null,
    bundleId: bundleParsed.id ?? null,
    artifacts: {
      ...singleFileArtifacts,
      sourceCards,
      extractionCards,
    },
  };
}
