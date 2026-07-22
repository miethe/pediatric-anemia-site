// tools/rf-bundle-to-kb-pack/lib/multi-bundle-report.mjs -- `multi-bundle-conversion-report.json`
// aggregation (multi-bundle-conversion-e1, Phase 2, row P2-T4; FR-5; R-P2 binding acceptance
// criterion).
//
// Aggregates each of the 4 named `BATCH_PAIRS` (./batch.mjs) pairs' own per-bundle
// `conversion-report.json` (propose.mjs, P5-T2 of the evidence-foundry-buildout-v1 plan) -- plus,
// where present, that bundle's committed `unresolved.json` (Phase 5 of THIS plan,
// `docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/
// phase-5-6-7-projection-determinism-docs.md` row P5-T1/P5-T3) and staged
// `candidate-scaffolds.json` (same phase, OQ-5) -- into one top-level, read-only
// `multi-bundle-conversion-report.json`, staged under `build/kb-pack/` (gitignored, `.gitignore`
// P1-T7, same root every `BATCH_PAIRS` entry's own `outDir` already nests under).
//
// This module is READ-ONLY: it never runs `inspect`/`verify`/`propose` itself (that is
// `./batch.mjs`'s job, P2-T3) -- it only reads whatever `build/kb-pack/`/`modules/<id>/` output
// already exists for each of the 4 named pairs and fills every gap with an explicit, documented
// default. It may be run at any time, independent of whether `./batch.mjs`'s own halt-on-first-
// failure batch run (R-6/R-7) has completed, partially completed, or never run at all for a given
// pair -- every one of the 4 named pairs always gets exactly one section in the emitted report,
// never a silently-omitted bundle.
//
// =================================================================================================
// SCHEMA (R-P2 binding AC: every field below has a defined, non-omittable "0/empty"
// representation -- a consumer reading this report for a bundle that produced zero conflicts, zero
// unresolved claims, zero candidate scaffolds, or zero emitted rules sees an explicit `0`/`[]` in
// that field, NEVER an absent key).
// =================================================================================================
//
// Top-level document (`buildMultiBundleConversionReport`'s return value):
//
//   schemaVersion   string   fixed "1.0" -- never absent.
//   reportKind      string   fixed "multi-bundle-conversion-report" -- never absent.
//   bundlesTotal    number   `bundles.length` -- always 4 for the canonical `BATCH_PAIRS` (this
//                            field is NEVER omitted even if a caller passes a different-length
//                            `bundles` array, e.g. a test's synthetic single-bundle list).
//   bundles         array    one entry per input bundle, in input order -- NEVER omits an entry for
//                            a bundle that failed, halted, or was never attempted; see "Per-bundle
//                            section" below. Empty array `[]` (never absent) if `bundles` is empty.
//   aggregate       object   see "Aggregate section" below -- always present, every numeric field
//                            defaulting to `0` when every contributing bundle contributes `0`
//                            (e.g. all 4 bundles `not_available` -> every aggregate count is `0`,
//                            not a missing key).
//
// Per-bundle section (one entry of `bundles[]`):
//
//   pairIndex               number        this bundle's index in `BATCH_PAIRS` (or the caller-
//                                         supplied bundle list) -- never absent.
//   fixture                 string        e.g. "tests/fixtures/rf-ev-001" -- never absent.
//   module                  string        e.g. "modules/anemia" -- never absent.
//   moduleId                string        e.g. "anemia" -- never absent.
//   status                  string        "reported" (this bundle's own `conversion-report.json`
//                                         was found and read) or "not_available" (it was not --
//                                         e.g. `propose` has never run for this bundle, or the
//                                         real batch halted before reaching it; DF-E1-M1 for
//                                         `rf-ev-001`/`rf-kid-001`/`rf-gro-002` today). Never
//                                         absent, never a bare boolean -- a reader must not have to
//                                         infer "no data" from a missing counts object.
//   statusReason             string|null  a human-readable reason when `status` is
//                                         `"not_available"` (e.g. naming the missing
//                                         `conversion-report.json` path); `null` (never an absent
//                                         key) when `status` is `"reported"`.
//   claimsProcessed          number       this bundle's `conversion-report.json.summary
//                                         .claimsTotal` when `status: "reported"`; `0` (never
//                                         absent) when `"not_available"`.
//   conflictsPreserved       number       this bundle's `conversion-report.json.summary
//                                         .claimsConflictVisible` (mixed/contradicted claims kept
//                                         visible, never silently resolved) when `"reported"`; `0`
//                                         when `"not_available"`.
//   unresolved               array        this bundle's committed `modules/<id>/unresolved.json`
//                                         array (Phase 5, P5-T1/P5-T3 of this plan) when it exists;
//                                         `[]` (never absent, never `null`) when it does not yet
//                                         exist (every bundle, as of Phase 2) or is itself an empty
//                                         array on disk (R-P2's own literal AC: a bundle producing
//                                         zero unresolved claims still emits `"unresolved": []`).
//   unresolvedCount           number       `unresolved.length` -- always derivable from `unresolved`
//                                         itself, carried separately only so a consumer never has
//                                         to compute a length to get the count (`0` when `[]`).
//   candidateScaffolds        array        this bundle's staged `build/kb-pack/<moduleId>/
//                                         <PACK_VERSION>/candidate-scaffolds.json` array (Phase 5,
//                                         OQ-5) when it exists; `[]` when it does not (every bundle,
//                                         as of Phase 2) or is itself empty on disk.
//   candidateScaffoldsCount   number       `candidateScaffolds.length`; `0` when `[]`.
//   rulesEmitted              number       count of NEW rule entries this E1 pass's `propose` run
//                                         adds to `modules/<moduleId>/rules.json` FOR THIS
//                                         BUNDLE's claims specifically -- NOT the module's total
//                                         rule count (`modules/cbc_suite_v1/rules.json` already
//                                         carries 4 pre-existing, E0-era rules that must stay
//                                         byte-unchanged; `modules/anemia/rules.json` carries 91).
//                                         Per FR-9/FR-22 (this plan's central honesty framing,
//                                         `.claude/worknotes/multi-bundle-conversion-e1/
//                                         decisions-block.md`): `propose` never emits a rule entry
//                                         for a claim lacking an approved `authoring-decisions.yaml`
//                                         record, and no claim from any of the 4 named E1 bundles has
//                                         one yet (DF-E1-M1) -- so this field is `0` for every
//                                         bundle as of this task, BY DESIGN, not merely by current
//                                         incompleteness. It is an explicit, caller-suppliable
//                                         parameter (never silently hardcoded past this function's
//                                         boundary) so Phase 6's P6-T4 ("finalize...as single
//                                         source of truth") can pass a real, `git diff`-verified
//                                         count once Phase 4/5 land real module content, without a
//                                         schema change -- defaulting to `0` here is this task's own
//                                         documented, structurally-true value, not a stand-in for a
//                                         computation this task skipped.
//
// Aggregate section (`bundles[].*` summed, never independently computed):
//
//   bundlesReported         number   count of `bundles[]` with `status: "reported"`; `0` if none.
//   bundlesNotAvailable     number   count of `bundles[]` with `status: "not_available"`; `0` if
//                                    every bundle reported (`bundlesReported + bundlesNotAvailable
//                                    === bundlesTotal` always -- a strict partition, proven by
//                                    this module's own test suite).
//   claimsProcessed         number   sum of every bundle's `claimsProcessed`; `0` if every bundle
//                                    contributes `0`.
//   conflictsPreserved      number   sum of every bundle's `conflictsPreserved`; `0` default.
//   unresolvedCount         number   sum of every bundle's `unresolvedCount`; `0` default.
//   candidateScaffoldsCount number   sum of every bundle's `candidateScaffoldsCount`; `0` default.
//   rulesEmitted            number   sum of every bundle's `rulesEmitted`; expected `0` across all
//                                    4 named bundles in this pass (this plan's own load-bearing
//                                    honesty AC, `multi-bundle-conversion-e1.md`'s "New rules
//                                    emitted by this pass | N/A | 0 | Diff of every
//                                    `modules/**/rules.json`" success metric) -- P6-T4 re-verifies
//                                    this against real Phase 4/5 output; this task only guarantees
//                                    the field is always present and numerically correct given its
//                                    inputs, never that Phase 4/5 have run yet.
//
// No dedicated JSON Schema file backs this document (same "checked structurally, not schema-
// validated" posture `propose.mjs`'s own header documents for `pack-provenance.json`/
// `conversion-report.json` -- this plan's binding OQ-7 ruling names no new schema file for this
// report either); `tests/ef-converter-multi-bundle-report.test.mjs` is the executable proof of the
// shape above.
//
// Zero network calls, zero LLM/generative-model invocations, ever (FR-10, same posture as every
// other file in this converter) -- this file imports only `node:fs/promises`, `node:path`, and
// `./batch.mjs`'s already-vetted, side-effect-free constants/helpers.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BATCH_PAIRS, DEFAULT_OUT_BASE_DIR, resolveModuleId } from './batch.mjs';
import { PACK_VERSION } from './verbs/propose.mjs';
import { EXIT_OK } from './errors.mjs';

// multi-bundle-report.mjs lives at tools/rf-bundle-to-kb-pack/lib/multi-bundle-report.mjs -- the
// same depth as ./batch.mjs -- so REPO_ROOT is resolved identically here (never `process.cwd()`),
// keeping every `{ fixture, module }` pair's `moduleDir` repo-root-relative and independent of the
// caller's own working directory, exactly like `./batch.mjs`'s own `REPO_ROOT` constant.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Filename this module writes/reads its aggregate document as, under `--out-base` (default
 * `build/kb-pack/`). */
export const MULTI_BUNDLE_REPORT_FILENAME = 'multi-bundle-conversion-report.json';

/**
 * Best-effort read of `<outDir>/conversion-report.json` (propose.mjs's own P5-T2 output). Returns
 * `null` -- never throws -- on `ENOENT` (the bundle's `propose` stage has not written a pack for
 * this `outDir` yet; an expected, not exceptional, state for a read-only aggregator that may run at
 * any point in this batch's lifecycle) or on malformed JSON (defensive: a half-written/corrupt file
 * must not crash the whole aggregation -- it is reported as `not_available` with a specific reason,
 * same as a missing file, rather than aborting every other bundle's reporting).
 *
 * @param {string} outDir
 * @returns {Promise<{ report: object } | { report: null, reason: string }>}
 */
export async function readBundleConversionReport(outDir) {
  const reportPath = path.join(outDir, 'conversion-report.json');
  let raw;
  try {
    raw = await readFile(reportPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { report: null, reason: `no conversion-report.json at ${reportPath}` };
    }
    return { report: null, reason: `could not read ${reportPath}: ${err.message}` };
  }
  try {
    return { report: JSON.parse(raw) };
  } catch (err) {
    return { report: null, reason: `${reportPath} is not valid JSON: ${err.message}` };
  }
}

/**
 * Best-effort read of a JSON file expected to contain a top-level array (`unresolved.json`'s or
 * `candidate-scaffolds.json`'s documented shape, both Phase 5 artifacts of this plan). Returns `[]`
 * -- never `null`, never throws -- when the file does not exist yet (every bundle, as of this
 * Phase 2 task) or is malformed; a read-only aggregator must never let an as-yet-unauthored Phase 5
 * artifact crash Phase 2's own reporting.
 *
 * @param {string} filePath
 * @returns {Promise<unknown[]>}
 */
export async function readOptionalJsonArray(filePath) {
  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Builds one fully-defaulted per-bundle report section (R-P2: every field below is guaranteed
 * present with an explicit `0`/`[]`/`null` default -- never an absent key) from whatever partial
 * data a caller supplies. Pure function -- no I/O -- so it is directly unit-testable against every
 * zero/empty-count scenario R-P2 names, independent of any real filesystem state.
 *
 * @param {{
 *   pairIndex: number, fixture: string, module: string, moduleId: string,
 *   conversionReport?: object | null, statusReason?: string,
 *   unresolved?: unknown[], candidateScaffolds?: unknown[], rulesEmitted?: number,
 * }} args
 * @returns {object} one `bundles[]` entry, per this file's own header schema doc
 */
export function buildBundleReportSection({
  pairIndex,
  fixture,
  module,
  moduleId,
  conversionReport = null,
  statusReason = null,
  unresolved = [],
  candidateScaffolds = [],
  rulesEmitted = 0,
}) {
  const status = conversionReport ? 'reported' : 'not_available';
  const summary = conversionReport?.summary ?? {};
  const unresolvedArr = Array.isArray(unresolved) ? unresolved : [];
  const candidateScaffoldsArr = Array.isArray(candidateScaffolds) ? candidateScaffolds : [];

  return {
    pairIndex,
    fixture,
    module,
    moduleId,
    status,
    statusReason: status === 'not_available' ? (statusReason ?? `no conversion-report.json reported for ${moduleId}`) : null,
    claimsProcessed: status === 'reported' ? (summary.claimsTotal ?? 0) : 0,
    conflictsPreserved: status === 'reported' ? (summary.claimsConflictVisible ?? 0) : 0,
    unresolved: unresolvedArr,
    unresolvedCount: unresolvedArr.length,
    candidateScaffolds: candidateScaffoldsArr,
    candidateScaffoldsCount: candidateScaffoldsArr.length,
    rulesEmitted: typeof rulesEmitted === 'number' && Number.isFinite(rulesEmitted) ? rulesEmitted : 0,
  };
}

/**
 * Assembles the full `multi-bundle-conversion-report.json` document (R-P2, this task's own AC) from
 * an array of already-built per-bundle sections (see `buildBundleReportSection` above). Pure
 * function -- no I/O -- deterministic given identical inputs, matching this converter's other
 * `build*`-prefixed pure builders (`propose.mjs`'s `buildConversionReport`/`buildPackProvenance`).
 *
 * @param {{ bundles: ReadonlyArray<object> }} args
 * @returns {object} the full top-level document, per this file's own header schema doc
 */
export function buildMultiBundleConversionReport({ bundles }) {
  const list = Array.isArray(bundles) ? bundles : [];

  const aggregate = {
    bundlesReported: 0,
    bundlesNotAvailable: 0,
    claimsProcessed: 0,
    conflictsPreserved: 0,
    unresolvedCount: 0,
    candidateScaffoldsCount: 0,
    rulesEmitted: 0,
  };

  for (const bundle of list) {
    if (bundle.status === 'reported') {
      aggregate.bundlesReported += 1;
    } else {
      aggregate.bundlesNotAvailable += 1;
    }
    aggregate.claimsProcessed += bundle.claimsProcessed ?? 0;
    aggregate.conflictsPreserved += bundle.conflictsPreserved ?? 0;
    aggregate.unresolvedCount += bundle.unresolvedCount ?? 0;
    aggregate.candidateScaffoldsCount += bundle.candidateScaffoldsCount ?? 0;
    aggregate.rulesEmitted += bundle.rulesEmitted ?? 0;
  }

  return {
    schemaVersion: '1.0',
    reportKind: 'multi-bundle-conversion-report',
    bundlesTotal: list.length,
    bundles: list,
    aggregate,
  };
}

/**
 * Read-only aggregation over the canonical `BATCH_PAIRS` (or a caller-supplied override, mirroring
 * `runBatch`'s own `pairs` parameter convention, `./batch.mjs`) -- for each named pair, in order,
 * resolves the same `outDir` `runBatch` would have written to (`resolveModuleId` + `PACK_VERSION`,
 * both imported from `./batch.mjs`/`./verbs/propose.mjs`, never re-derived independently), reads
 * whatever is already on disk, and returns one fully-defaulted section per pair (R-P2: never omits
 * a pair, regardless of whether that pair's `propose` stage ever ran).
 *
 * This function drives NO execution of its own -- it never calls `runInspect`/`runVerify`/
 * `runPropose` -- so it may be called at any point in `./batch.mjs`'s own halt-on-first-failure
 * lifecycle (before any pair has run, after a partial halt, or after a full success) and always
 * returns exactly `pairs.length` sections.
 *
 * @param {{ pairs?: ReadonlyArray<{ fixture: string, module: string }>, outBaseDir?: string }} [options]
 * @returns {Promise<Array<object>>} one `bundles[]` entry per pair, in pair order
 */
export async function collectBundleReportSections(options = {}) {
  const { pairs = BATCH_PAIRS, outBaseDir = DEFAULT_OUT_BASE_DIR } = options;

  const sections = [];
  for (let pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
    const { fixture, module } = pairs[pairIndex];
    const moduleDir = path.isAbsolute(module) ? module : path.join(REPO_ROOT, module);
    const moduleId = await resolveModuleId(moduleDir);
    const outDir = path.join(outBaseDir, moduleId, PACK_VERSION);

    const { report: conversionReport, reason } = await readBundleConversionReport(outDir);
    const unresolved = await readOptionalJsonArray(path.join(moduleDir, 'unresolved.json'));
    const candidateScaffolds = await readOptionalJsonArray(path.join(outDir, 'candidate-scaffolds.json'));

    sections.push(
      buildBundleReportSection({
        pairIndex,
        fixture,
        module,
        moduleId,
        conversionReport,
        statusReason: reason,
        unresolved,
        candidateScaffolds,
        // rulesEmitted: this task's own documented, structurally-true value (see this file's
        // header schema doc) -- `0` for every named pair as of Phase 2 (FR-9/DF-E1-M1: no
        // authoring-decisions.yaml exists yet for any of the 4 named bundles' claims). Phase 6's
        // P6-T4 upgrades this to a real per-bundle `git diff`-verified count once Phase 4/5 land.
        rulesEmitted: 0,
      }),
    );
  }
  return sections;
}

/**
 * `aggregate` CLI verb (`cli.mjs`'s `aggregate` verb, multi-bundle-conversion-e1 Phase 2, P2-T4):
 * reads whatever `build/kb-pack/`/`modules/<id>/` output already exists for each of the 4 named
 * `BATCH_PAIRS`, builds the full aggregate document, writes it to
 * `<outBaseDir>/multi-bundle-conversion-report.json`, prints a summary, and returns `EXIT_OK`. This
 * verb NEVER fails closed on a bundle being `not_available` -- that is an expected, documented
 * state (DF-E1-M1) for a read-only reporting step, not a converter error; a Phase 2 run of this verb
 * against a completely fresh `build/kb-pack/` legitimately reports all 4 bundles `not_available`
 * with every count at its defined `0`/`[]` default (R-P2's own binding property, exercised for
 * real, not only in a synthetic test).
 *
 * @param {{ outBase?: string }} [options]
 * @returns {Promise<number>}
 */
export async function run(options) {
  const outBaseDir = typeof options?.outBase === 'string' && options.outBase !== ''
    ? path.resolve(options.outBase)
    : DEFAULT_OUT_BASE_DIR;

  const bundles = await collectBundleReportSections({ outBaseDir });
  const report = buildMultiBundleConversionReport({ bundles });

  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir(outBaseDir, { recursive: true });
  const reportPath = path.join(outBaseDir, MULTI_BUNDLE_REPORT_FILENAME);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `${JSON.stringify(
      {
        verb: 'aggregate',
        reportPath,
        bundlesTotal: report.bundlesTotal,
        aggregate: report.aggregate,
      },
      null,
      2,
    )}\n`,
  );

  return EXIT_OK;
}
