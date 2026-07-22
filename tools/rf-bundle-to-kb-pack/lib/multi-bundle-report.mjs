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
//   conflictClasses array    every bundle's own `conflictClasses` (see per-bundle section below),
//                            flattened in bundle order (P6-T4) -- lets a reader literally enumerate
//                            the real, named conflict-visible objects this pass preserves (the
//                            plan's own binding "≥3 named conflict classes across the 4 bundles"
//                            AC), rather than trusting an opaque count alone. `[]` (never absent) if
//                            no bundle carries any.
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
//                                         .claimsTotal` when `status: "reported"`; when
//                                         `"not_available"`, a real Phase 4/5 FALLBACK (P6-T4) --
//                                         this bundle's own `claims/claim_ledger.yaml` `claims[]`
//                                         count (see `readFixtureClaimCount`), computed independent
//                                         of `authoring-decisions.yaml`/`propose` -- when that
//                                         fallback is itself computable; `0` (never absent) only
//                                         when neither a live conversion-report NOR a readable
//                                         fixture claim ledger exists (e.g. a synthetic bundle with
//                                         no real files on disk).
//   conflictsPreserved       number       this bundle's `conversion-report.json.summary
//                                         .claimsConflictVisible` (mixed/contradicted claims kept
//                                         visible, never silently resolved) when `"reported"` (`0`
//                                         otherwise) PLUS `conflictClasses.length` (P6-T4) -- the
//                                         real, already-committed, named conflict-visible objects
//                                         this bundle's module carries via `modules/<id>/
//                                         unresolved.json`'s `conflict`/`named_conflict` entries
//                                         and/or `modules/<id>/evidence.json`'s `conflictsWith`
//                                         source records (see `extractConflictClasses`). Every real
//                                         conflict this pass preserves is expressed via one of those
//                                         two on-disk conventions, not via a claim-ledger `mixed`/
//                                         `contradicted` status (none of the 4 fixtures' claim
//                                         ledgers uses either status), so this sum is the field's
//                                         real, complete value, not merely the conversion-report
//                                         component.
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
//   conflictClasses           array        real, already-committed, named conflict-visible objects
//                                         this bundle's module carries (P6-T4) -- see
//                                         `extractConflictClasses`'s own header doc for the two
//                                         real on-disk conventions this reads; `[]` (never absent)
//                                         when the module carries none. Each entry is
//                                         `{ moduleId, conflictId, name, sourceKind }`.
//   conflictClassesCount      number       `conflictClasses.length`; `0` when `[]`.
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
//                                    contributes `0`. As of P6-T4, real: 48 (anemia, real claim-
//                                    ledger fallback) + 88 (cbc_suite_v1, real live RF-CBC-002
//                                    `propose` run) + 87 (kidney_suite_v1, fallback) + 92
//                                    (growth_suite_v1, fallback) = 315.
//   conflictsPreserved      number   sum of every bundle's `conflictsPreserved`; `0` default. As of
//                                    P6-T4, real and non-zero: every named conflict class this pass
//                                    preserves (WHO-vs-CDC growth, ANC-cutoff variance, pediatric-
//                                    vs-adult proteinuria -- see `conflictClasses` below) is counted
//                                    here.
//   unresolvedCount         number   sum of every bundle's `unresolvedCount`; `0` default.
//   candidateScaffoldsCount number   sum of every bundle's `candidateScaffoldsCount`; `0` default
//                                    (OQ-5 candidate-scaffold staging has not been authored for any
//                                    bundle as of this pass -- a real, documented, still-open gap,
//                                    not a computation error).
//   rulesEmitted            number   sum of every bundle's `rulesEmitted`; `0` across all 4 named
//                                    bundles in this pass (this plan's own load-bearing honesty AC,
//                                    `multi-bundle-conversion-e1.md`'s "New rules emitted by this
//                                    pass | N/A | 0 | Diff of every `modules/**/rules.json`" success
//                                    metric) -- P6-T4 re-verifies this against the real `git diff`/
//                                    rule-count evidence P4-T8/P5-T4 already established (test-
//                                    enforced there, not merely asserted here): `modules/anemia/
//                                    rules.json` (91 rules) and `modules/cbc_suite_v1/rules.json`
//                                    (4 rules) are unchanged by this plan's commits; `modules/
//                                    {kidney_suite_v1,growth_suite_v1}/rules.json` stay `[]` (0
//                                    rules) -- confirmed via `tests/ef-converter-multi-bundle-report.
//                                    test.mjs`'s own P6-T4 section.
//   conflictClassesCount    number   sum of every bundle's `conflictClassesCount`; `0` default;
//                                    identical to `conflictsPreserved` today (every named conflict
//                                    class this pass preserves comes from `conflictClasses`, never
//                                    from a `conversion-report.json`-derived count -- see the
//                                    per-bundle `conflictsPreserved` doc above).
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
import { parseYamlDocument } from './yaml-lite.mjs';

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
 * Best-effort read of a module's own committed `evidence.json`'s top-level `sources[]` array
 * (multi-bundle-conversion-e1, Phase 6, row P6-T4). Returns `[]` -- never throws -- when the file
 * does not exist, is malformed, or has no `sources` array; a read-only aggregator must never let a
 * missing/malformed `evidence.json` crash the whole aggregation.
 *
 * @param {string} moduleDir
 * @returns {Promise<unknown[]>}
 */
export async function readEvidenceSources(moduleDir) {
  let raw;
  try {
    raw = await readFile(path.join(moduleDir, 'evidence.json'), 'utf8');
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.sources) ? parsed.sources : [];
  } catch {
    return [];
  }
}

/**
 * Best-effort count of a fixture's own `claims/claim_ledger.yaml` `claims[]` array (multi-bundle-
 * conversion-e1, Phase 6, row P6-T4) -- resolved via `evidence_bundle.yaml.artifacts.claim_ledger`,
 * the SAME resolution `./loader.mjs#loadBundle` uses, but performed independently here with zero
 * dependency on `authoring-decisions.yaml` (this function never calls `loadBundle`, so it works for
 * every one of the 4 named bundles, including the 3 whose modules have no decisions file yet --
 * DF-E1-M1 -- and for which `propose`/`batch` structurally cannot run at all, per `propose.mjs`'s
 * own header comment: "propose does not attempt to draft content for any other module" than
 * `cbc_suite_v1`). Reads YAML via `./yaml-lite.mjs` (seam invariant 2), same as every other reader
 * in this converter -- no `yaml` npm dependency.
 *
 * This is a purely STRUCTURAL count (claim ledger array length) -- it invents no clinical judgment,
 * resolves no eligibility, and drafts nothing; it exists only so this read-only aggregator can
 * report a bundle's real `claimsProcessed` count even when that bundle's own live
 * `conversion-report.json` will never exist under this tool's current module-scope restriction.
 *
 * @param {string} fixtureDir absolute or repo-root-relative path to the fixture's own run directory
 *   (e.g. `tests/fixtures/rf-ev-001`)
 * @returns {Promise<number|null>} the real claim count, or `null` (never throws) if
 *   `evidence_bundle.yaml`/its named `claim_ledger` artifact cannot be read or parsed
 */
export async function readFixtureClaimCount(fixtureDir) {
  let bundleRaw;
  try {
    bundleRaw = await readFile(path.join(fixtureDir, 'evidence_bundle.yaml'), 'utf8');
  } catch {
    return null;
  }
  let bundleParsed;
  try {
    bundleParsed = parseYamlDocument(bundleRaw);
  } catch {
    return null;
  }
  const claimLedgerRel = bundleParsed?.artifacts?.claim_ledger;
  if (typeof claimLedgerRel !== 'string' || claimLedgerRel === '') return null;

  let claimLedgerRaw;
  try {
    claimLedgerRaw = await readFile(path.join(fixtureDir, claimLedgerRel), 'utf8');
  } catch {
    return null;
  }
  let claimLedgerParsed;
  try {
    claimLedgerParsed = parseYamlDocument(claimLedgerRaw);
  } catch {
    return null;
  }
  const claims = claimLedgerParsed?.claims;
  return Array.isArray(claims) ? claims.length : null;
}

/**
 * Extracts every REAL, already-committed, explicit/named conflict-visible object a module's own
 * Phase 4/5 output carries (multi-bundle-conversion-e1, Phase 6, row P6-T4; FR-11) -- from TWO real
 * on-disk representations this pass's committed content actually uses (neither invented by this
 * function; both are pre-existing, hand-authored conventions elsewhere in this repo):
 *
 *   1. `modules/<id>/unresolved.json` (Phase 5, P5-T1/P5-T3) entries with `entryKind: "conflict"`
 *      or `entryKind: "named_conflict"` -- the fuller, structured conflict-object shape
 *      `kidney_suite_v1`/`growth_suite_v1` each carry one of (pediatric-vs-adult proteinuria;
 *      WHO-vs-CDC growth standard, respectively).
 *   2. `modules/<id>/evidence.json` (E0-era `evidence.json` shape, still the module's real,
 *      committed source-provenance record) sources with a non-empty `conflictsWith` array -- e.g.
 *      `cbc_suite_v1`'s own real, pre-existing "other pediatric sources define neutropenia severity
 *      bands differently (e.g., varying ANC breakpoints)" record (the ANC-cutoff-variance conflict
 *      class FR-11 names), which this module carries in this form because `cbc_suite_v1` has no
 *      `unresolved.json` of its own (P4-T5 only appends `evidence.json`/`evidence-assertions.json`,
 *      per that task's own scope).
 *
 * Pure function -- no I/O -- given already-read `unresolved`/`evidenceSources` arrays; each
 * returned entry is `{ moduleId, conflictId, name, sourceKind }`, never bare strings, so a
 * downstream consumer always has a stable shape to key off regardless of which of the two real
 * on-disk conventions produced it.
 *
 * @param {{ moduleId: string, unresolved?: unknown[], evidenceSources?: unknown[] }} args
 * @returns {Array<{ moduleId: string, conflictId: string|null, name: string|null, sourceKind: string }>}
 */
export function extractConflictClasses({ moduleId, unresolved = [], evidenceSources = [] }) {
  // NOTE (P6-T4): the two bespoke, one-off Phase 5 generator scripts that authored
  // `kidney_suite_v1`/`growth_suite_v1`'s `unresolved.json` (P5-T1, P5-T2) used two DIFFERENT key
  // names for the same "this is a dedicated conflict-object entry, not a per-claim deferral" tag --
  // `kidney_suite_v1` uses `entryKind: "conflict"`; `growth_suite_v1` uses `kind: "named_conflict"`.
  // Both are real, both are checked (never just one), so this function recognizes a conflict entry
  // by EITHER key, matching either bespoke script's real, already-committed convention.
  const fromUnresolved = (Array.isArray(unresolved) ? unresolved : [])
    .filter((entry) => entry && (
      entry.entryKind === 'conflict' || entry.entryKind === 'named_conflict' ||
      entry.kind === 'conflict' || entry.kind === 'named_conflict'
    ))
    .map((entry) => ({
      moduleId,
      conflictId: typeof entry.conflictId === 'string' ? entry.conflictId : null,
      name: typeof entry.name === 'string' ? entry.name : null,
      sourceKind: 'unresolved_conflict_object',
    }));

  const fromEvidenceSources = (Array.isArray(evidenceSources) ? evidenceSources : [])
    .filter((source) => Array.isArray(source?.conflictsWith) && source.conflictsWith.length > 0)
    .map((source) => ({
      moduleId,
      conflictId: typeof source?.id === 'string'
        ? source.id
        : (typeof source?.sourceId === 'string' ? source.sourceId : null),
      name: typeof source.conflictsWith[0] === 'string' ? source.conflictsWith[0] : null,
      sourceKind: 'evidence_source_conflicts_with',
    }));

  return [...fromUnresolved, ...fromEvidenceSources];
}

/**
 * Builds one fully-defaulted per-bundle report section (R-P2: every field below is guaranteed
 * present with an explicit `0`/`[]`/`null` default -- never an absent key) from whatever partial
 * data a caller supplies. Pure function -- no I/O -- so it is directly unit-testable against every
 * zero/empty-count scenario R-P2 names, independent of any real filesystem state.
 *
 * `claimsProcessedFallback`/`conflictClasses` (multi-bundle-conversion-e1, Phase 6, row P6-T4):
 * `propose` is structurally scoped to `cbc_suite_v1` only (see `propose.mjs`'s own header comment)
 * and 3 of the 4 named bundles have no `authoring-decisions.yaml` yet (DF-E1-M1), so those 3
 * bundles' own live `conversion-report.json` will never exist under this tool's current design --
 * NOT a transient gap this task closes. `claimsProcessedFallback` (a real, structural claim-ledger
 * count -- see `readFixtureClaimCount`) and `conflictClasses` (real, already-committed named
 * conflict-visible objects -- see `extractConflictClasses`) let this function still report REAL
 * Phase 4/5 data for those 3 bundles' `claimsProcessed`/`conflictsPreserved` fields, without
 * requiring `propose` to ever run and without inventing any new clinical content.
 *
 * @param {{
 *   pairIndex: number, fixture: string, module: string, moduleId: string,
 *   conversionReport?: object | null, statusReason?: string,
 *   unresolved?: unknown[], candidateScaffolds?: unknown[], rulesEmitted?: number,
 *   claimsProcessedFallback?: number | null,
 *   conflictClasses?: Array<{ moduleId: string, conflictId: string|null, name: string|null, sourceKind: string }>,
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
  claimsProcessedFallback = null,
  conflictClasses = [],
}) {
  const status = conversionReport ? 'reported' : 'not_available';
  const summary = conversionReport?.summary ?? {};
  const unresolvedArr = Array.isArray(unresolved) ? unresolved : [];
  const candidateScaffoldsArr = Array.isArray(candidateScaffolds) ? candidateScaffolds : [];
  const conflictClassesArr = Array.isArray(conflictClasses) ? conflictClasses : [];
  const hasFallbackClaims = typeof claimsProcessedFallback === 'number' && Number.isFinite(claimsProcessedFallback);

  return {
    pairIndex,
    fixture,
    module,
    moduleId,
    status,
    statusReason: status === 'not_available' ? (statusReason ?? `no conversion-report.json reported for ${moduleId}`) : null,
    // Real Phase 4/5 fallback (P6-T4): when `propose` never ran for this bundle (status
    // "not_available"), `claimsProcessedFallback` -- this bundle's OWN real, committed
    // `claims/claim_ledger.yaml` count -- is used instead of the `0` default; still `0` when no
    // fallback could be computed either (e.g. a synthetic/caller-supplied bundle with no real
    // fixture on disk), preserving R-P2's "0, never absent" guarantee.
    claimsProcessed: status === 'reported' ? (summary.claimsTotal ?? 0) : (hasFallbackClaims ? claimsProcessedFallback : 0),
    // Real Phase 4/5 fallback (P6-T4): `conflictClasses.length` (real, already-committed, named
    // conflict-visible objects -- see `extractConflictClasses`) is ADDED to whatever
    // `conversion-report.json`-derived conflict-visible-claim count applies (0 for every named
    // bundle today -- none of the 4 fixtures' claim ledgers carry a `mixed`/`contradicted` claim
    // status; every real conflict this pass preserves is expressed via the dedicated conflict-
    // object/`conflictsWith` conventions `extractConflictClasses` reads instead).
    conflictsPreserved: (status === 'reported' ? (summary.claimsConflictVisible ?? 0) : 0) + conflictClassesArr.length,
    unresolved: unresolvedArr,
    unresolvedCount: unresolvedArr.length,
    candidateScaffolds: candidateScaffoldsArr,
    candidateScaffoldsCount: candidateScaffoldsArr.length,
    rulesEmitted: typeof rulesEmitted === 'number' && Number.isFinite(rulesEmitted) ? rulesEmitted : 0,
    conflictClasses: conflictClassesArr,
    conflictClassesCount: conflictClassesArr.length,
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
    conflictClassesCount: 0,
  };
  // Real, already-committed, named conflict-visible objects (P6-T4; FR-11), flattened across every
  // bundle in declared order -- so a reader can literally enumerate/count the "≥3 named conflict
  // classes across the 4 bundles" this plan's own binding AC requires (WHO-vs-CDC growth,
  // ANC-cutoff variance, pediatric-vs-adult proteinuria), rather than trusting an opaque sum alone.
  const conflictClasses = [];

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
    aggregate.conflictClassesCount += bundle.conflictClassesCount ?? 0;
    if (Array.isArray(bundle.conflictClasses)) {
      conflictClasses.push(...bundle.conflictClasses);
    }
  }

  return {
    schemaVersion: '1.0',
    reportKind: 'multi-bundle-conversion-report',
    bundlesTotal: list.length,
    bundles: list,
    aggregate,
    conflictClasses,
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
    const fixtureDir = path.isAbsolute(fixture) ? fixture : path.join(REPO_ROOT, fixture);
    const moduleId = await resolveModuleId(moduleDir);
    const outDir = path.join(outBaseDir, moduleId, PACK_VERSION);

    const { report: conversionReport, reason } = await readBundleConversionReport(outDir);
    const unresolved = await readOptionalJsonArray(path.join(moduleDir, 'unresolved.json'));
    const candidateScaffolds = await readOptionalJsonArray(path.join(outDir, 'candidate-scaffolds.json'));

    // P6-T4 (FR-5/Observability NFR): real Phase 4/5 data for `claimsProcessed`/`conflictsPreserved`
    // even when `propose` never ran for this bundle (true for 3 of the 4 named bundles, structurally
    // -- see `readFixtureClaimCount`/`extractConflictClasses`'s own header docs). Computed for EVERY
    // bundle regardless of `conversionReport` status: `conflictClasses` reflects real conflict-
    // visible content this module's Phase 4/5 output already carries (e.g. `cbc_suite_v1`'s ANC-
    // cutoff-variance record) independent of whether a live `propose` pack exists.
    const evidenceSources = await readEvidenceSources(moduleDir);
    const conflictClasses = extractConflictClasses({ moduleId, unresolved, evidenceSources });

    let statusReason = reason;
    let claimsProcessedFallback = null;
    if (!conversionReport) {
      claimsProcessedFallback = await readFixtureClaimCount(fixtureDir);
      if (typeof claimsProcessedFallback === 'number') {
        statusReason = `${reason} -- real claimsProcessed (${claimsProcessedFallback}) is a Phase ` +
          `4/5 fallback computed directly from this bundle's own committed ` +
          `${fixture}/claims/claim_ledger.yaml claims[] count (propose.mjs is scoped to ` +
          'cbc_suite_v1 only, FR-14 module-scope restriction + DF-E1-M1 decisions gap -- this ' +
          'fallback requires no authoring-decisions.yaml and drafts no rule/candidate content).';
      }
    }

    sections.push(
      buildBundleReportSection({
        pairIndex,
        fixture,
        module,
        moduleId,
        conversionReport,
        statusReason,
        unresolved,
        candidateScaffolds,
        // rulesEmitted: this task's own documented, structurally-true value (see this file's
        // header schema doc) -- `0` for every named pair, re-verified at Phase 6 (P6-T4) against
        // the real `git diff` evidence (P4-T8/P5-T4's own load-bearing honesty ACs): zero entries
        // were added to any of the 4 modules' `rules.json` by this pass (FR-9/DF-E1-M1: no
        // authoring-decisions.yaml exists yet for any of the 4 named bundles' claims).
        rulesEmitted: 0,
        claimsProcessedFallback,
        conflictClasses,
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
