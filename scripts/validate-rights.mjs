// scripts/validate-rights.mjs — EPR0-T5 (FR-WP0-06, FR-WP0-07, D7).
//
// The rights-substrate coverage/consistency validator. Ships >=4 deterministic gates over the
// rights/ tree (rights/release-context.json, rights/rights-records.json, rights/rights-failures.json,
// rights/rights-ledger.json — EPR0-T1) plus the vendored+amended schemas (schemas/rights/*.schema.json
// — EPR0-T2/T3) and the 6 triage-only records seeded by EPR0-T4.
//
// MODULE CONTRACT (R-P3, binding on every later phase that touches this file):
//   - One pure exported function per gate: `(context) => { errors: string[] }`. `context` is the
//     loaded-substrate bag built by `loadRightsContext` below — never mutated by a gate.
//   - Every gate is registered as a `{ id, description, run }` entry in the single exported `GATES`
//     array, in the order it was added. A later phase (EP-R1/EP-R2/EP-R3) adds a gate by appending
//     a new entry to `GATES` plus its own `export function checkX(context) {...}` above it — never
//     by editing an existing gate's body, renaming a gate `id`, or changing the `(context) =>
//     { errors }` signature. A needed shape change is an escalation to the plan owner, not a local
//     edit (see the phase-r0-rights-substrate.md "Integration Ownership" section).
//   - `loadRightsContext` MAY be extended (new fields added to the returned bag) by a later phase
//     that needs new inputs for its gate — that is normal growth, not a contract change, as long as
//     the fields this file's own four gates already read stay present and unrenamed.
//
// D7 — every gate here is COVERAGE- or CONSISTENCY-shaped, never a clearance gate. No gate reads
// `overall_status` (or any rights-authority field) and fails BECAUSE of which legitimate value is
// present — a record sitting at `overall_status: "UNKNOWN"` (the seeded state of all 6 EPR0-T4
// records) passes every gate in this file, and so does one sitting at `"PROHIBITED"`. What a gate
// may fail on is a STRUCTURAL defect: a missing cross-link, a dangling reference, a value that is
// not even a member of the schema's own closed vocabulary, or a requested use that falls outside the
// declared release-context.json scope.
//
// FR-WP0-07 / determinism: no gate, and no code path reachable from the CLI entry point below, may
// read the system clock's current instant directly or construct a `Date` with zero arguments. The
// only date input is `--as-of` (or
// the `RIGHTS_VALIDATE_AS_OF` env var), threaded through `context.asOf` for the day a later phase
// adds a genuinely date-sensitive gate (e.g. permission/contract expiry). None of the four gates
// shipped in this task are themselves date-sensitive; `resolveAsOf` exists now so the CLI contract
// does not change shape out from under EP-R1..EP-R3 once one of them needs it.
//
// The four gates:
//   (a) checkMissingAssessmentCoverage    — bidirectional clinical-identifier <-> rights_record
//                                            coverage via rights/rights-ledger.json.
//   (b) checkBlockingStatusEnumMembership — the fields that govern release-blocking behaviour
//                                            (rights_record.overall_status/.review.review_status,
//                                            rights_failure.release_gate/.status) are each drawn
//                                            from their schema's own closed enum. MEMBERSHIP only —
//                                            never which member.
//   (c) checkOpenFailurePresence          — every OPEN rights_failure (the unresolved, and
//                                            therefore currently-material, class of finding) is
//                                            bidirectionally cross-linked with the rights_record
//                                            that names it, so it stays visible rather than going
//                                            quietly untracked.
//   (d) checkReleaseContextContainment    — a reusable use/territory/channel/commercial
//                                            set-containment primitive against release-context.json.
//                                            WP0 seeds no content_reuse_assessment (that is EP-R2's
//                                            job), so the CLI wraps it as a self-containment proof
//                                            over release-context.json's own declared scope; EP-R2's
//                                            gate calls the same exported primitive against a real
//                                            requested-use record instead of writing a second one.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_IDS } from '../src/modules/registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

// --- --as-of / date plumbing (FR-WP0-07) ----------------------------------------------------------

/**
 * Resolves the validator's `asOf` instant from `--as-of=<ISO 8601>` / `--as-of <ISO 8601>` (either
 * form accepted, matching this repo's other CLI flags — see scripts/rule-coverage.mjs's `--min`),
 * falling back to the `RIGHTS_VALIDATE_AS_OF` env var, and finally `null` when neither is supplied.
 * Every `Date` constructed here takes an explicit argument — the current-instant, zero-argument
 * constructor form is never used — so two runs against unchanged input at different wall-clock
 * times produce byte-identical output whenever neither flag nor env var is set, and identical
 * output whenever the SAME `--as-of` value is passed to both runs.
 */
export function resolveAsOf(argv = [], env = {}) {
  let raw;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--as-of=')) {
      raw = arg.slice('--as-of='.length);
      break;
    }
    if (arg === '--as-of') {
      raw = argv[i + 1];
      break;
    }
  }
  if (raw === undefined) raw = env.RIGHTS_VALIDATE_AS_OF;
  if (raw === undefined || raw === '') return null;

  const asOf = new Date(raw);
  if (Number.isNaN(asOf.getTime())) {
    throw new Error(`--as-of value "${raw}" is not a valid ISO 8601 date/time`);
  }
  return asOf;
}

// --- context loading -------------------------------------------------------------------------------

/**
 * Loads every input the four gates in this file read, plus `asOf` (FR-WP0-07). Pure with respect to
 * the filesystem snapshot it is called against — same files on disk, same `argv`/`env`, same result.
 * `clinicalIdentifiers` enumerates every KB identifier that currently requires rights coverage;
 * EPR0-T4 seeds only `evidence_source_id` entries (one per modules/<id>/evidence.json source), and
 * rights/rights-ledger.json's own description records that a later phase may add other identifier
 * types without changing this shape — `{ type, id }` already accommodates that.
 */
export async function loadRightsContext(rootDir = root, { argv = [], env = {} } = {}) {
  const [releaseContext, rightsRecords, rightsFailures, rightsLedger, rightsRecordSchema, rightsFailureSchema] = await Promise.all([
    readJson(path.join(rootDir, 'rights', 'release-context.json')),
    readJson(path.join(rootDir, 'rights', 'rights-records.json')),
    readJson(path.join(rootDir, 'rights', 'rights-failures.json')),
    readJson(path.join(rootDir, 'rights', 'rights-ledger.json')),
    readJson(path.join(rootDir, 'schemas', 'rights', 'rights_record.schema.json')),
    readJson(path.join(rootDir, 'schemas', 'rights', 'rights_failure.schema.json')),
  ]);

  const clinicalIdentifiers = [];
  for (const moduleId of MODULE_IDS) {
    const evidenceData = await readJson(path.join(rootDir, 'modules', moduleId, 'evidence.json'));
    for (const source of evidenceData.sources ?? []) {
      if (source?.id) clinicalIdentifiers.push({ type: 'evidence_source_id', id: source.id });
    }
  }

  return {
    releaseContext,
    rightsRecords,
    rightsFailures,
    rightsLedger,
    rightsRecordSchema,
    rightsFailureSchema,
    clinicalIdentifiers,
    asOf: resolveAsOf(argv, env),
  };
}

// --- gate (a): bidirectional missing-assessment coverage --------------------------------------------

/**
 * Proves rights/rights-ledger.json is a complete, non-dangling join between the clinical
 * identifiers that currently need rights coverage and the rights_record entries that assess them,
 * in BOTH directions:
 *   1. forward  — every known clinical identifier has a ledger entry, and that entry's
 *                 rights_record_id resolves to a real record (an unassessed source is a coverage
 *                 gap, never silently invisible).
 *   2. reverse  — every ledger entry's clinical_identifier resolves to a currently-known clinical
 *                 identifier (a stale/renamed reference is caught, not silently tolerated).
 *   3. orphan   — every seeded rights_record is reachable from a known clinical identifier via the
 *                 ledger (a record for something no longer cited is stale, not merely undiscovered).
 * D7: this gate never inspects `overall_status`/`review.review_status` — only that the join exists
 * and resolves. A record sitting at `overall_status: "UNKNOWN"` passes exactly like any other.
 */
export function checkMissingAssessmentCoverage(context) {
  const { clinicalIdentifiers, rightsLedger, rightsRecords } = context;
  const errors = [];

  const recordsById = new Map((rightsRecords.records ?? []).map((record) => [record.rights_record_id, record]));
  const ledgerEntries = rightsLedger.entries ?? [];
  const identifierKey = (type, id) => `${type}:${id}`;
  const ledgerByIdentifier = new Map(ledgerEntries.map((entry) => [identifierKey(entry.clinical_identifier_type, entry.clinical_identifier), entry]));
  const knownIdentifierKeys = new Set(clinicalIdentifiers.map(({ type, id }) => identifierKey(type, id)));

  for (const { type, id } of clinicalIdentifiers) {
    const key = identifierKey(type, id);
    const entry = ledgerByIdentifier.get(key);
    if (!entry) {
      errors.push(`missing-assessment-coverage: clinical identifier ${key} has no rights/rights-ledger.json entry`);
      continue;
    }
    if (!recordsById.has(entry.rights_record_id)) {
      errors.push(`missing-assessment-coverage: rights/rights-ledger.json entry for ${key} references unknown rights_record_id "${entry.rights_record_id}"`);
    }
  }

  for (const entry of ledgerEntries) {
    const key = identifierKey(entry.clinical_identifier_type, entry.clinical_identifier);
    if (!knownIdentifierKeys.has(key)) {
      errors.push(`missing-assessment-coverage: rights/rights-ledger.json entry "${key}" does not resolve to any known clinical identifier`);
    }
  }

  const reachableRecordIds = new Set(
    ledgerEntries
      .filter((entry) => knownIdentifierKeys.has(identifierKey(entry.clinical_identifier_type, entry.clinical_identifier)))
      .map((entry) => entry.rights_record_id),
  );
  for (const record of rightsRecords.records ?? []) {
    if (!reachableRecordIds.has(record.rights_record_id)) {
      errors.push(`missing-assessment-coverage: rights/rights-records.json record "${record.rights_record_id}" is not reachable from any known clinical identifier via rights/rights-ledger.json`);
    }
  }

  return { errors };
}

// --- gate (b): blocking-status enum membership -------------------------------------------------------

/**
 * MEMBERSHIP only, never a value-judgement (D7). Draws the closed vocabulary straight off the live
 * vendored+amended schemas (schemas/rights/rights_record.schema.json,
 * schemas/rights/rights_failure.schema.json — EPR0-T2/T3) rather than a second, hand-duplicated
 * constant that could silently drift from them. Checks that the fields which GOVERN
 * release-blocking behaviour — `rights_record.overall_status`, `rights_record.review.review_status`,
 * `rights_failure.release_gate`, `rights_failure.status` — are each drawn from that closed set.
 *
 * This gate does not care WHICH member is present: `"UNKNOWN"` and `"PROHIBITED"` are equally valid
 * members of `overall_status` and both pass. It exists to catch structural drift (a typo, a stale
 * hand-edit, a value that predates a schema amendment) that full JSON-Schema validation would also
 * catch if it were run over rights/ — this gate is a second, independent, narrowly-scoped proof of
 * the same closed-vocabulary property, kept intentionally cheap to read at a glance.
 */
export function checkBlockingStatusEnumMembership(context) {
  const { rightsRecords, rightsFailures, rightsRecordSchema, rightsFailureSchema } = context;
  const errors = [];

  const overallStatusEnum = rightsRecordSchema?.properties?.overall_status?.enum;
  const reviewStatusEnum = rightsRecordSchema?.properties?.review?.properties?.review_status?.enum;
  const releaseGateEnum = rightsFailureSchema?.properties?.release_gate?.enum;
  const failureStatusEnum = rightsFailureSchema?.properties?.status?.enum;

  if (!Array.isArray(overallStatusEnum) || !Array.isArray(reviewStatusEnum) || !Array.isArray(releaseGateEnum) || !Array.isArray(failureStatusEnum)) {
    errors.push('blocking-status-enum-membership: could not resolve one or more blocking-status enums from the vendored schemas — refusing to validate silently');
    return { errors };
  }

  const overallStatusSet = new Set(overallStatusEnum);
  const reviewStatusSet = new Set(reviewStatusEnum);
  const releaseGateSet = new Set(releaseGateEnum);
  const failureStatusSet = new Set(failureStatusEnum);

  for (const record of rightsRecords.records ?? []) {
    if (!overallStatusSet.has(record.overall_status)) {
      errors.push(`blocking-status-enum-membership: rights_record "${record.rights_record_id}" overall_status "${record.overall_status}" is not a member of the schema's closed enum`);
    }
    const reviewStatus = record.review?.review_status;
    if (reviewStatus !== undefined && !reviewStatusSet.has(reviewStatus)) {
      errors.push(`blocking-status-enum-membership: rights_record "${record.rights_record_id}" review.review_status "${reviewStatus}" is not a member of the schema's closed enum`);
    }
  }

  for (const failure of rightsFailures.failures ?? []) {
    if (!releaseGateSet.has(failure.release_gate)) {
      errors.push(`blocking-status-enum-membership: rights_failure "${failure.rights_failure_id}" release_gate "${failure.release_gate}" is not a member of the schema's closed enum`);
    }
    if (!failureStatusSet.has(failure.status)) {
      errors.push(`blocking-status-enum-membership: rights_failure "${failure.rights_failure_id}" status "${failure.status}" is not a member of the schema's closed enum`);
    }
  }

  return { errors };
}

// --- gate (c): open-critical-failure presence check ---------------------------------------------------

/**
 * "Open" (`status: "open"`) is this gate's definition of "critical": an unresolved rights_failure is,
 * by construction, the class of finding that currently matters for release-readiness visibility,
 * regardless of which `severity` enum member it separately carries. This is a PRESENCE check — is
 * the failure actually wired into the rights_record that is supposed to carry it? — never a
 * judgement about whether it SHOULD block anything (D7): resolving it, downgrading it, or leaving it
 * open are all outcomes this gate does not adjudicate.
 *
 * Bidirectional: an open failure whose `rights_record_id` does not resolve, or resolves to a record
 * whose `rights_failure_ids` does not name it back, fails — and so does a rights_record that names a
 * `rights_failure_id` with no corresponding entry in rights/rights-failures.json.
 */
export function checkOpenFailurePresence(context) {
  const { rightsFailures, rightsRecords } = context;
  const errors = [];

  const recordsById = new Map((rightsRecords.records ?? []).map((record) => [record.rights_record_id, record]));
  const failuresById = new Map((rightsFailures.failures ?? []).map((failure) => [failure.rights_failure_id, failure]));

  for (const failure of rightsFailures.failures ?? []) {
    if (failure.status !== 'open') continue;
    if (failure.rights_record_id === null || failure.rights_record_id === undefined) continue;

    const record = recordsById.get(failure.rights_record_id);
    if (!record) {
      errors.push(`open-failure-presence: open rights_failure "${failure.rights_failure_id}" references unknown rights_record_id "${failure.rights_record_id}"`);
    } else if (!(record.rights_failure_ids ?? []).includes(failure.rights_failure_id)) {
      errors.push(`open-failure-presence: open rights_failure "${failure.rights_failure_id}" is not cross-linked back from rights_record "${record.rights_record_id}".rights_failure_ids`);
    }
  }

  for (const record of rightsRecords.records ?? []) {
    for (const failureId of record.rights_failure_ids ?? []) {
      if (!failuresById.has(failureId)) {
        errors.push(`open-failure-presence: rights_record "${record.rights_record_id}" references unknown rights_failure_id "${failureId}"`);
      }
    }
  }

  return { errors };
}

// --- gate (d): use/territory/channel set-containment against release-context.json -----------------

/**
 * Reusable containment primitive: is `requestedUse` fully CONTAINED by what `releaseContext`
 * currently declares permitted? `requestedUse` shape: `{ requested_use_id?, commercial?,
 * intended_uses?: string[], jurisdictions?: string[], channels?: string[] }` — every field optional;
 * an omitted field asks for nothing on that axis and trivially passes it.
 *
 * This is the general-purpose function later phases call with a REAL requested-use record (e.g. a
 * content_reuse_assessment, EP-R2+) — WP0 seeds none, so the CLI-registered gate below instead
 * checks release-context.json's own declared scope against itself (see `runReleaseContextContainmentGate`).
 * Exported standalone (not only wrapped in `GATES`) precisely so a later phase imports and calls it
 * directly against its own data shape rather than re-deriving containment logic a second time.
 */
export function checkReleaseContextContainment(releaseContext, requestedUse) {
  const errors = [];
  const label = requestedUse?.requested_use_id ?? '<unnamed requested use>';

  if (!releaseContext || typeof releaseContext !== 'object') {
    errors.push('release-context-containment: no release-context.json provided to check containment against');
    return { errors };
  }

  if (requestedUse?.commercial === true && releaseContext.commercial !== true) {
    errors.push(`release-context-containment: requested use "${label}" asks for commercial:true, which release-context.json (commercial:${releaseContext.commercial}) does not grant`);
  }

  const permittedUses = new Set(releaseContext.intended_uses?.permitted ?? []);
  for (const use of requestedUse?.intended_uses ?? []) {
    if (!permittedUses.has(use)) {
      errors.push(`release-context-containment: requested use "${label}" asks for intended use "${use}", which is not in release-context.json's permitted set`);
    }
  }

  const permittedJurisdictions = new Set(releaseContext.territory?.permitted_jurisdictions ?? []);
  for (const jurisdiction of requestedUse?.jurisdictions ?? []) {
    if (!permittedJurisdictions.has(jurisdiction)) {
      errors.push(`release-context-containment: requested use "${label}" asks for jurisdiction "${jurisdiction}", which is not in release-context.json's permitted set`);
    }
  }

  const permittedChannels = new Set(releaseContext.channel?.permitted_channels ?? []);
  for (const channel of requestedUse?.channels ?? []) {
    if (!permittedChannels.has(channel)) {
      errors.push(`release-context-containment: requested use "${label}" asks for channel "${channel}", which is not in release-context.json's permitted set`);
    }
  }

  return { errors };
}

/**
 * The `GATES`-registered wrapper for gate (d). WP0 has no content_reuse_assessment (or any other
 * requested-use-shaped record) to check yet, so this checks release-context.json's own declared
 * scope against itself — a trivially-satisfiable identity check by construction, but one that: (1)
 * still fails closed if release-context.json is missing/malformed (the `!releaseContext` branch
 * above), and (2) exercises the exact `checkReleaseContextContainment` primitive that EP-R2's gate
 * will call with a REAL requested-use record instead of writing a second containment
 * implementation. Kept as its own named function (rather than an inline arrow in `GATES`) so it is
 * independently unit-testable.
 */
export function runReleaseContextContainmentGate(context) {
  const { releaseContext } = context;
  const selfRequest = {
    requested_use_id: releaseContext?.release_context_id ?? 'release-context-self-check',
    commercial: releaseContext?.commercial === true,
    intended_uses: releaseContext?.intended_uses?.permitted ?? [],
    jurisdictions: releaseContext?.territory?.permitted_jurisdictions ?? [],
    channels: releaseContext?.channel?.permitted_channels ?? [],
  };
  return checkReleaseContextContainment(releaseContext, selfRequest);
}

// --- the single exported gate list -------------------------------------------------------------------

export const GATES = [
  {
    id: 'missing-assessment-coverage',
    description: 'Bidirectional coverage between clinical identifiers and rights_record entries via rights/rights-ledger.json.',
    run: checkMissingAssessmentCoverage,
  },
  {
    id: 'blocking-status-enum-membership',
    description: 'overall_status/review_status/release_gate/status values are members of their schema\'s closed enum (membership only, never a value-judgement).',
    run: checkBlockingStatusEnumMembership,
  },
  {
    id: 'open-failure-presence',
    description: 'Every open rights_failure is bidirectionally cross-linked with its owning rights_record.',
    run: checkOpenFailurePresence,
  },
  {
    id: 'release-context-containment',
    description: 'use/territory/channel/commercial set-containment against rights/release-context.json.',
    run: runReleaseContextContainmentGate,
  },
  // EP-R1 / EP-R2 / EP-R3: append your gate here as a new `{ id, description, run }` entry, with
  // its own `export function checkX(context) {...}` defined above (per this file's module
  // contract, in the header comment). Do not rename, reorder-and-renumber, or edit the body or
  // signature of an existing entry — that is an escalation to the plan owner, not a local edit.
];

/**
 * Runs every gate in `gates` (defaults to the full `GATES` list) against `context` and returns the
 * concatenated `{ errors }`. Fails closed on a malformed gate result rather than silently treating
 * `undefined`/non-array `errors` as "no errors" — the same posture scripts/lib/json-schema-lite.mjs
 * takes toward unsupported keywords.
 */
export function runAllGates(context, gates = GATES) {
  const errors = [];
  for (const gate of gates) {
    const result = gate.run(context);
    if (!result || !Array.isArray(result.errors)) {
      throw new Error(`validate-rights: gate "${gate.id}" did not return { errors: string[] } — refusing to treat a malformed gate result as "passed"`);
    }
    errors.push(...result.errors.map((message) => `[${gate.id}] ${message}`));
  }
  return { errors };
}

// --- thin CLI ------------------------------------------------------------------------------------

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const argv = process.argv.slice(2);
    const context = await loadRightsContext(root, { argv, env: process.env });
    const { errors } = runAllGates(context);

    if (errors.length) {
      console.error(errors.join('\n'));
      process.exitCode = 1;
    } else {
      const recordCount = context.rightsRecords.records?.length ?? 0;
      const failureCount = context.rightsFailures.failures?.length ?? 0;
      console.log(
        `validate-rights: ${GATES.length} gate(s) passed `
        + `(${context.clinicalIdentifiers.length} clinical identifier(s), ${recordCount} rights record(s), ${failureCount} rights failure(s)`
        + `${context.asOf ? `, as-of ${context.asOf.toISOString()}` : ''}).`,
      );
    }
  } catch (error) {
    console.error(`validate-rights: ${error.message}`);
    process.exitCode = 1;
  }
}
