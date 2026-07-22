// tools/rf-bundle-to-kb-pack/lib/batch.mjs — `batch` verb library (multi-bundle-conversion-e1,
// Phase 2, row P2-T3, FR-5; decisions block Risk 7 mitigation).
//
//   batch [--rule-schema <schema path>] [--out-base <dir>]
//
// Runs `inspect -> verify -> propose`, in that fixed order, for each entry of the literal,
// hand-enumerated `BATCH_PAIRS` array below — NEVER a directory glob, an `fs.readdir` sweep over
// `runs/`, or any "process everything under a directory" pattern (R-7 mitigation, decisions block
// Risk 7 — this is the load-bearing property this file exists to guarantee). Every entry in
// `BATCH_PAIRS` is a hand-named `{ fixture, module }` pair; adding a bundle to this batch is a
// deliberate, reviewable source-code edit to this literal array, never an automatic side effect of
// dropping a new directory under `tests/fixtures/` or the upstream `rf` `runs/` tree. In
// particular, neither `REG-001` nor `REG-004` (the two registered non-eligible regression bundles)
// appears anywhere in this array, in any form.
//
// Fail-closed, halt-on-first-failure (mirrors this converter's existing "never continue past an
// error" posture — see `lib/verbs/propose.mjs`'s seam-invariant-8 guard and `lib/errors.mjs`'s
// taxonomy doc): the moment any pair's `inspect`/`verify`/`propose` stage throws, `runBatch` stops
// immediately — no subsequent pair in the array is even attempted — and the thrown
// `BatchBundleFailedError` names the failing pair (its index, fixture, module, and which of the
// three stages was running) explicitly, never a generic/unattributed failure. Already-succeeded
// pairs' own `build/kb-pack/<module_id>/<pack_version>/` output is left untouched — every pair
// writes only to its own `outDir`, so there is no shared mutable state between pairs a failure
// could corrupt (R-6 posture).
//
// CURRENT KNOWN STATE (as of this task, see phase-1-2-vendoring-batch-orchestration.md's Decisions
// Block Addendum A1 / Deferred Item DF-E1-M1): of the 4 named pairs, only `rf-cbc-002` ->
// `cbc_suite_v1` currently completes `propose` end to end. `rf-ev-001` (`modules/anemia`),
// `rf-kid-001` (`modules/kidney_suite_v1`), and `rf-gro-002` (`modules/growth_suite_v1`) each fail
// at the `inspect` stage's `loader.loadBundle()` step with `DecisionsNotFoundError` — those three
// modules have not yet recorded an `authoring-decisions.yaml`. This is a pre-existing, documented,
// non-regression gap (DF-E1-M1: per-module rule-authoring workflow, not yet run for those 3
// modules) — NOT something this task closes, and NOT to be "fixed" by authoring a decisions file
// here. Given the halt-on-first-failure contract above and `BATCH_PAIRS`' mandated order (`rf-ev-
// 001` first), running `node cli.mjs batch` with no overrides today halts at that first, named,
// expected failure. The machinery this file delivers — literal enumeration, the fixed per-pair
// pipeline, the fail-closed halt, per-pair output isolation, and run-to-run determinism — is fully
// exercisable (including the `cbc_suite_v1` success path and the halt-on-failure path) through
// `runBatch`'s pairs-parameterized signature, independent of when DF-E1-M1 is eventually closed;
// see `tests/ef-converter-batch.test.mjs`.
//
// Zero network calls, zero LLM/generative-model invocations, ever (FR-10, same posture as every
// other file in this tool) — this file imports only `node:fs/promises`, `node:path`, `node:url`,
// the three existing verb `run` functions, `PACK_VERSION` from `./verbs/propose.mjs`, and
// `./errors.mjs`; none of those import `node:http`, `node:https`, `node:dgram`, `fetch`, or any
// AI/model SDK.
//
// Verb-handler contract (same as every file in `./verbs/`, even though this file lives one level
// up): the exported `run(options)` either resolves to a numeric exit code or throws a
// `ConverterError` (or subclass) that `cli.mjs` forwards unaltered.

import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runInspect } from './verbs/inspect.mjs';
import { run as runVerify } from './verbs/verify.mjs';
import { run as runPropose, PACK_VERSION } from './verbs/propose.mjs';
import { ConverterError, EXIT_OK, EXIT_USAGE } from './errors.mjs';

// batch.mjs lives at tools/rf-bundle-to-kb-pack/lib/batch.mjs — 3 directories below the repository
// root. Resolved once so every `fixture`/`module` entry in `BATCH_PAIRS` below is repo-root-
// relative and independent of the CLI caller's own working directory (never `process.cwd()`).
const CONVERTER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(CONVERTER_ROOT, '..', '..');

/** Default `--rule-schema` this batch's `verify` stage validates any staged `rules.json` against. */
const DEFAULT_RULE_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'rule.schema.json');

/** Default `build/kb-pack/` root (gitignored, `.gitignore` P1-T7) every pair's `outDir` nests under.
 * Exported (multi-bundle-conversion-e1 Phase 2, row P2-T4) so `../multi-bundle-report.mjs`'s
 * read-only aggregator resolves each named pair's `outDir` identically to this file's own `runBatch`
 * -- one canonical `outDir` convention, never two independently-maintained copies of the same path
 * math. */
export const DEFAULT_OUT_BASE_DIR = path.join(REPO_ROOT, 'build', 'kb-pack');

/**
 * The batch's ONLY bundle enumeration (R-7 mitigation, decisions block Risk 7): an explicit,
 * named, ordered, hand-written literal array of exactly 4 `{ fixture, module }` pairs — repo-root-
 * relative paths, resolved against `REPO_ROOT` (never `process.cwd()`, never a glob, never
 * `fs.readdir` over any directory). `runBatch` processes this array (or an explicitly-supplied
 * override — see its own `pairs` parameter, used by this file's own tests and by future sibling
 * tasks to exercise scenarios this literal array cannot, e.g. a seeded failure) in this exact
 * order; reordering, adding, or removing an entry is a deliberate, reviewable edit to this source
 * file, never a runtime side effect of a directory listing.
 *
 * Frozen two levels deep (the outer array and every entry object) so neither this module nor a
 * caller can mutate the canonical list in place.
 *
 * @type {ReadonlyArray<{ fixture: string, module: string }>}
 */
export const BATCH_PAIRS = Object.freeze([
  Object.freeze({ fixture: 'tests/fixtures/rf-ev-001', module: 'modules/anemia' }),
  Object.freeze({ fixture: 'tests/fixtures/rf-cbc-002', module: 'modules/cbc_suite_v1' }),
  Object.freeze({ fixture: 'tests/fixtures/rf-kid-001', module: 'modules/kidney_suite_v1' }),
  Object.freeze({ fixture: 'tests/fixtures/rf-gro-002', module: 'modules/growth_suite_v1' }),
]);

/**
 * `runBatch` halted while processing one named pair. Preserves the ORIGINAL failure's exit code
 * verbatim (never remaps GOVERNANCE(3)/HUMAN_REVIEW(7) into something a generic handler would
 * treat as ordinary — `lib/errors.mjs`'s "MUST NOT be mutated" invariant applies transitively
 * here) while naming the pair index, fixture, module, and stage the failure occurred in — the
 * "names the failing bundle explicitly" property the batch runner's contract requires.
 */
export class BatchBundleFailedError extends ConverterError {
  constructor({ pairIndex, fixture, module, moduleId, stage, cause }) {
    const exitCode = cause instanceof ConverterError ? cause.exitCode : EXIT_USAGE;
    super(
      `batch halted at pair ${pairIndex} (fixture "${fixture}", module "${module}", ` +
        `moduleId "${moduleId}") during "${stage}": ${cause?.name ?? 'Error'}: ` +
        `${cause?.message ?? String(cause)}. No subsequent pair was attempted; every ` +
        'already-succeeded pair\'s own output is untouched.',
      exitCode,
      { cause },
    );
    this.pairIndex = pairIndex;
    this.fixture = fixture;
    this.module = module;
    this.moduleId = moduleId;
    this.stage = stage;
  }
}

/**
 * Best-effort read of `<moduleDir>/module.json`'s own `"id"` field, used only to name each pair's
 * `outDir` (`build/kb-pack/<module_id>/<pack_version>/`) the same way the rest of this converter
 * already does. Never throws: if `module.json` is missing/malformed, this falls back to the module
 * directory's own basename (still a reasonable directory name) and lets the `inspect` stage below
 * raise the real, specific, named error for that condition — this function's only job is picking a
 * directory name, not validating the module package.
 *
 * @param {string} moduleDir
 * @returns {Promise<string>}
 *
 * Exported (multi-bundle-conversion-e1 Phase 2, row P2-T4) so `../multi-bundle-report.mjs`'s
 * read-only aggregator resolves each named pair's `moduleId` identically to this file's own
 * `runBatch` — one canonical resolution, never a second, drifting copy.
 */
export async function resolveModuleId(moduleDir) {
  const fallback = path.basename(moduleDir);
  try {
    const raw = await readFile(path.join(moduleDir, 'module.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === 'string' && parsed.id !== '' ? parsed.id : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Runs `inspect -> verify -> propose`, in that fixed order, for each `{ fixture, module }` pair in
 * `pairs` (default `BATCH_PAIRS`), halting immediately on the first pair whose any stage throws
 * (see `BatchBundleFailedError` above) — no subsequent pair is attempted. Every pair writes only
 * to its own `<outBaseDir>/<moduleId>/<PACK_VERSION>/` directory (no shared mutable state between
 * pairs); `verify` runs against that same directory, created empty just beforehand so a pair whose
 * `propose` has not run yet still gets `verify`'s well-defined "legitimately-not-yet-built pack"
 * vacuous pass (see `lib/verbs/verify.mjs`) rather than a spurious `PackNotFoundError`.
 *
 * Pure orchestration over the 3 existing verb `run` functions — no bundle-specific logic of its
 * own, no filesystem writes beyond `mkdir(outDir, { recursive: true })` (idempotent) and whatever
 * `propose` itself writes. Deterministic: given the same `pairs` and unchanged source bytes, two
 * calls produce byte-identical `propose` output for every pair that reaches it (R-5 idempotency
 * evidence — `tests/ef-converter-batch.test.mjs` runs this twice and diffs the emitted files).
 *
 * @param {{
 *   pairs?: ReadonlyArray<{ fixture: string, module: string }>,
 *   ruleSchemaPath?: string,
 *   outBaseDir?: string,
 * }} [options]
 * @returns {Promise<ReadonlyArray<{
 *   pairIndex: number, fixture: string, module: string, moduleId: string, outDir: string,
 *   status: 'succeeded',
 * }>>} one record per pair that succeeded, in array order — if `runBatch` throws, this return
 *   value is never produced; the thrown `BatchBundleFailedError` is the only outcome for the
 *   failing pair (and every pair after it, which is never attempted at all).
 */
export async function runBatch(options = {}) {
  const {
    pairs = BATCH_PAIRS,
    ruleSchemaPath = DEFAULT_RULE_SCHEMA_PATH,
    outBaseDir = DEFAULT_OUT_BASE_DIR,
  } = options;

  const results = [];

  for (let pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
    const { fixture, module } = pairs[pairIndex];
    const runDir = path.isAbsolute(fixture) ? fixture : path.join(REPO_ROOT, fixture);
    const moduleDir = path.isAbsolute(module) ? module : path.join(REPO_ROOT, module);
    const modulePath = path.join(moduleDir, 'module.json');
    const decisionsPath = path.join(moduleDir, 'authoring-decisions.yaml');

    const moduleId = await resolveModuleId(moduleDir);
    const outDir = path.join(outBaseDir, moduleId, PACK_VERSION);

    let stage = 'inspect';
    try {
      await runInspect({ runDir, module: modulePath });

      stage = 'verify';
      // Create (idempotently) the pack directory `verify` will look at before `propose` has ever
      // run for this pair — matches `verify.mjs`'s own documented "legitimately-not-yet-built pack
      // directory has no rules.json yet" vacuous-pass convention rather than tripping its
      // `PackNotFoundError` (which only guards against the directory not existing at all).
      await mkdir(outDir, { recursive: true });
      await runVerify({ pack: outDir, ruleSchema: ruleSchemaPath });

      stage = 'propose';
      await runPropose({ runDir, module: modulePath, decisions: decisionsPath, out: outDir });
    } catch (err) {
      throw new BatchBundleFailedError({ pairIndex, fixture, module, moduleId, stage, cause: err });
    }

    results.push(Object.freeze({ pairIndex, fixture, module, moduleId, outDir, status: 'succeeded' }));
  }

  return Object.freeze(results);
}

/**
 * `batch` CLI verb (`cli.mjs`'s `batch` verb). Always runs the canonical `BATCH_PAIRS` array (this
 * verb never accepts a caller-supplied pairs override — that would reintroduce exactly the
 * "process an arbitrary list" surface R-7 mitigates against; use `runBatch({ pairs })` directly,
 * not this CLI verb, for a test's own synthetic pair list). `--rule-schema`/`--out-base` are the
 * only two supported overrides, both defaulting to this converter's normal on-disk conventions.
 *
 * @param {{ ruleSchema?: string, outBase?: string }} [options] parsed CLI flags for this verb
 * @returns {Promise<number>} process exit code
 */
export async function run(options) {
  const ruleSchemaPath = typeof options?.ruleSchema === 'string' && options.ruleSchema !== ''
    ? path.resolve(options.ruleSchema)
    : DEFAULT_RULE_SCHEMA_PATH;
  const outBaseDir = typeof options?.outBase === 'string' && options.outBase !== ''
    ? path.resolve(options.outBase)
    : DEFAULT_OUT_BASE_DIR;

  const results = await runBatch({ pairs: BATCH_PAIRS, ruleSchemaPath, outBaseDir });

  const summary = {
    verb: 'batch',
    pairsTotal: BATCH_PAIRS.length,
    pairsSucceeded: results.length,
    pairs: results.map(({ pairIndex, fixture, module, moduleId, outDir, status }) => ({
      pairIndex,
      fixture,
      module,
      moduleId,
      outDir,
      status,
    })),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  return EXIT_OK;
}
