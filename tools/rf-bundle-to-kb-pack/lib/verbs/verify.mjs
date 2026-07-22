// tools/rf-bundle-to-kb-pack/lib/verbs/verify.mjs — `verify` verb, structural pre-check
// (P2-T7, 02 §4.5).
//
//   verify --pack <dir> --rule-schema <schema path>
//
// Contract this file satisfies (see the module boundary table in ../../README.md):
//   - Phase 2 scope is explicitly "input-side pre-checks only" (this task's own AC): no `propose`
//     verb exists yet (Phase 3) to draft a real `build/kb-pack/<module_id>/<pack_version>/`
//     directory, so `verify` validates the STRUCTURAL SHAPE of whatever is currently staged at
//     `--pack` rather than a real end-to-end release pack.
//   - Concretely: IF `<pack>/rules.json` exists (the 02 §4.4 output layout's name for a module's
//     drafted rule array — the exact shape `modules/anemia/rules.json` and
//     `modules/cbc_suite_v1/rules.json` already use today), every entry is validated against the
//     parsed `--rule-schema` document using the same dependency-free validator
//     (`scripts/lib/json-schema-lite.mjs`) `scripts/validate-kb.mjs` already runs per-module (P1-T5)
//     — reused here per the README's "no yaml/JSON-Schema npm dependency" design decision, not
//     reimplemented. `verify` does not care whether `rules.json` was drafted by `propose` or
//     written by hand/by a test — this phase's own tests construct a synthetic `--pack` directory
//     the same way `tests/rule-schema-seeded-invalid.test.mjs` builds a synthetic module tree for
//     `validateModule`.
//   - `rules.json` being ABSENT is not itself a structural defect this phase: Phase 2 has no
//     drafting step, so a legitimately-not-yet-built pack directory has no `rules.json` yet.
//     `verify` reports `rulesJson.present === false` and still exits 0 (a vacuous pass — the same
//     convention `modules/cbc_suite_v1`'s empty, schema-valid `rules.json` already uses elsewhere
//     in this repo).
//   - A `rules.json` that IS present but violates `--rule-schema` (e.g. an
//     `additionalProperties: false` violation, this task's "seeded-malformed" fixture case) is a
//     real structural defect: `verify` exits non-zero (`RulesJsonValidationError`, a `SchemaError`,
//     exit 2) naming every violating rule's `id`/index and the specific schema violation — never a
//     silent pass-through.
//   - `release-manifest.unsigned.json` — the file `02 §4.4` places at the same pack root — now
//     gets full content validation too (P5-T1, closing this file's former stub, `schemas/
//     release-manifest.schema.json`). If the file is absent, `verify` records `present: false`
//     and still exits 0 (vacuous pass — same convention as the `rules.json`-absent case above: a
//     legitimately-not-yet-`propose`d pack has no manifest yet). If it IS present, it is parsed and
//     validated against `schemas/release-manifest.schema.json` using the same dependency-free
//     validator as `rules.json` above; a schema violation is a real structural defect
//     (`ReleaseManifestValidationError`, a `SchemaError`, exit 2) — never a silent pass-through.
//   - Zero network calls, zero LLM/generative-model invocations (same posture as every verb in this
//     tool) — this file imports only `node:fs/promises`, `node:path`, `node:url`, the pure
//     `scripts/lib/json-schema-lite.mjs#validate` function, and `../errors.mjs`.
//
// Verb-handler contract: see `lib/verbs/inspect.mjs`'s header comment (same contract applies here).

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate as validateAgainstSchema } from '../../../../scripts/lib/json-schema-lite.mjs';
import { EXIT_OK, SchemaError, UsageError } from '../errors.mjs';

// verify.mjs lives at tools/rf-bundle-to-kb-pack/lib/verbs/verify.mjs -- 4 directories below the
// repository root. Used only to resolve schemas/release-manifest.schema.json, the same repo-root-
// relative pattern this file's own `../../../../scripts/lib/json-schema-lite.mjs` import already
// establishes (P5-T1).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const RELEASE_MANIFEST_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-manifest.schema.json');

/**
 * `--pack <dir>` does not exist (or is not a directory). Exit 1 (usage) — a CLI-argument mistake,
 * the same class as `loader.mjs`'s missing `--run-dir`, not a schema-content problem.
 */
export class PackNotFoundError extends UsageError {
  constructor(resolvedPath) {
    super(`--pack directory not found at ${resolvedPath}`);
    this.resolvedPath = resolvedPath;
  }
}

/** `--rule-schema <path>` does not exist. Exit 1 (usage). */
export class RuleSchemaNotFoundError extends UsageError {
  constructor(resolvedPath) {
    super(`--rule-schema file not found at ${resolvedPath}`);
    this.resolvedPath = resolvedPath;
  }
}

/**
 * `--rule-schema <path>` exists but is not valid JSON. Exit 2 (schema) — the schema this converter
 * is meant to validate against is itself broken, distinct from a missing-file usage mistake.
 */
export class RuleSchemaParseError extends SchemaError {
  constructor(resolvedPath, cause) {
    super(`--rule-schema at ${resolvedPath} is not valid JSON: ${cause.message}`, { cause });
    this.resolvedPath = resolvedPath;
  }
}

/** `<pack>/release-manifest.unsigned.json` exists but is not valid JSON. Exit 2 (schema). */
export class ReleaseManifestParseError extends SchemaError {
  constructor(resolvedPath, cause) {
    super(`${resolvedPath} is not valid JSON: ${cause.message}`, { cause });
    this.resolvedPath = resolvedPath;
  }
}

/**
 * `<pack>/release-manifest.unsigned.json` fails `schemas/release-manifest.schema.json` validation
 * (P5-T1, closing this file's former stub). Exit 2 (schema) — names every violation, never a
 * silent pass.
 */
export class ReleaseManifestValidationError extends SchemaError {
  constructor(resolvedPath, violations) {
    const detail = violations.map((v) => `${v.path} ${v.message}`).join('; ');
    super(`${resolvedPath} fails release-manifest.schema.json validation: ${detail}`);
    this.resolvedPath = resolvedPath;
    this.violations = violations;
  }
}

/** `<pack>/rules.json` exists but is not valid JSON. Exit 2 (schema). */
export class RulesJsonParseError extends SchemaError {
  constructor(resolvedPath, cause) {
    super(`${resolvedPath} is not valid JSON: ${cause.message}`, { cause });
    this.resolvedPath = resolvedPath;
  }
}

/** `<pack>/rules.json` parses but is not a JSON array of rule objects. Exit 2 (schema). */
export class RulesJsonShapeError extends SchemaError {
  constructor(resolvedPath) {
    super(`${resolvedPath} exists but is not a JSON array of rule objects`);
    this.resolvedPath = resolvedPath;
  }
}

/**
 * One or more entries in `<pack>/rules.json` fail `--rule-schema` validation. Exit 2 (schema) —
 * this task's "seeded-malformed" fixture case: `verify` exits non-zero, naming every violation.
 */
export class RulesJsonValidationError extends SchemaError {
  constructor(resolvedPath, violations) {
    const detail = violations
      .map((v) => `rule ${v.ruleId ?? '(no id)'} [index ${v.index}]: ${v.path} ${v.message}`)
      .join('; ');
    super(`${resolvedPath} has ${violations.length} rule(s) failing --rule-schema validation: ${detail}`);
    this.resolvedPath = resolvedPath;
    this.violations = violations;
  }
}

async function statOrNull(resolvedPath) {
  try {
    return await stat(resolvedPath);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Validates already-parsed `rules.json` content against the parsed rule schema. Pure function —
 * no I/O — so it is directly unit-testable, matching `inspect.mjs`'s `buildSummary` convention.
 *
 * @param {string} rulesJsonPath resolved path, used only in thrown errors' messages
 * @param {unknown} rulesJsonParsed the parsed JSON content, or `undefined` if the file is absent
 * @param {object} ruleSchema the parsed `--rule-schema` document
 * @returns {{
 *   present: boolean,
 *   count: number,
 *   errors: Array<{ ruleId: string|null, index: number, path: string, message: string }>,
 * }}
 */
export function checkRulesJsonShape(rulesJsonPath, rulesJsonParsed, ruleSchema) {
  if (rulesJsonParsed === undefined) {
    return { present: false, count: 0, errors: [] };
  }
  if (!Array.isArray(rulesJsonParsed)) {
    throw new RulesJsonShapeError(rulesJsonPath);
  }

  const errors = [];
  rulesJsonParsed.forEach((rule, index) => {
    for (const { path: errPath, message } of validateAgainstSchema(ruleSchema, rule)) {
      errors.push({ ruleId: rule?.id ?? null, index, path: errPath, message });
    }
  });
  return { present: true, count: rulesJsonParsed.length, errors };
}

/**
 * @param {{ pack?: string, ruleSchema?: string }} options parsed CLI flags for this verb
 * @returns {Promise<number>} process exit code
 */
export async function run(options) {
  const packInput = options?.pack;
  const ruleSchemaInput = options?.ruleSchema;

  if (typeof packInput !== 'string' || packInput === '') {
    throw new UsageError('verify requires a non-empty --pack <dir>');
  }
  if (typeof ruleSchemaInput !== 'string' || ruleSchemaInput === '') {
    throw new UsageError('verify requires a non-empty --rule-schema <schema path>');
  }

  const packDir = path.resolve(packInput);
  const packInfo = await statOrNull(packDir);
  if (!packInfo || !packInfo.isDirectory()) {
    throw new PackNotFoundError(packDir);
  }

  const ruleSchemaPath = path.resolve(ruleSchemaInput);
  const ruleSchemaInfo = await statOrNull(ruleSchemaPath);
  if (!ruleSchemaInfo || !ruleSchemaInfo.isFile()) {
    throw new RuleSchemaNotFoundError(ruleSchemaPath);
  }
  let ruleSchema;
  try {
    ruleSchema = JSON.parse(await readFile(ruleSchemaPath, 'utf8'));
  } catch (err) {
    throw new RuleSchemaParseError(ruleSchemaPath, err);
  }

  // ----- Input-side pre-check this phase actually performs: rules.json structural validation ----
  const rulesJsonPath = path.join(packDir, 'rules.json');
  const rulesJsonInfo = await statOrNull(rulesJsonPath);
  let rulesJsonParsed;
  if (rulesJsonInfo && rulesJsonInfo.isFile()) {
    try {
      rulesJsonParsed = JSON.parse(await readFile(rulesJsonPath, 'utf8'));
    } catch (err) {
      throw new RulesJsonParseError(rulesJsonPath, err);
    }
  }
  const rulesJsonReport = checkRulesJsonShape(rulesJsonPath, rulesJsonParsed, ruleSchema);
  if (rulesJsonReport.errors.length > 0) {
    throw new RulesJsonValidationError(rulesJsonPath, rulesJsonReport.errors);
  }

  // ----- release-manifest.unsigned.json content validation (P5-T1, closing this file's own -------
  // former stub) --------------------------------------------------------------------------------
  const releaseManifestPath = path.join(packDir, 'release-manifest.unsigned.json');
  const releaseManifestInfo = await statOrNull(releaseManifestPath);
  let releaseManifestValidated = false;
  if (releaseManifestInfo && releaseManifestInfo.isFile()) {
    let releaseManifestParsed;
    try {
      releaseManifestParsed = JSON.parse(await readFile(releaseManifestPath, 'utf8'));
    } catch (err) {
      throw new ReleaseManifestParseError(releaseManifestPath, err);
    }
    const releaseManifestSchema = JSON.parse(await readFile(RELEASE_MANIFEST_SCHEMA_PATH, 'utf8'));
    const releaseManifestViolations = validateAgainstSchema(releaseManifestSchema, releaseManifestParsed);
    if (releaseManifestViolations.length > 0) {
      throw new ReleaseManifestValidationError(releaseManifestPath, releaseManifestViolations);
    }
    releaseManifestValidated = true;
  }

  const summary = {
    verb: 'verify',
    pack: packDir,
    ruleSchema: ruleSchemaPath,
    rulesJson: {
      present: rulesJsonReport.present,
      count: rulesJsonReport.count,
      valid: rulesJsonReport.errors.length === 0,
    },
    releaseManifest: {
      present: Boolean(releaseManifestInfo && releaseManifestInfo.isFile()),
      validated: releaseManifestValidated,
    },
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return EXIT_OK;
}
