// tools/retro-validate/lib/discordance.mjs -- DISCORDANCE / ADJUDICATION-READY RECORD MODEL
// (P4-T5, Evidence Foundry E1 Phase 4, FR-23, PRD OQ-5). Part of the "Metrics" module boundary
// named in this tool's own README (`lib/metrics.mjs`, plus the discordance/adjudication model,
// plus the human-only protocol schema, P4-T6) -- a separate file because it has its own tool-local
// schema (`schemas/discordance-record.schema.json`) and its own cross-tool import (below), not
// because it is a different module boundary.
//
// Three responsibilities:
//
//   1. `computeDiscordanceRecords(replayDocument)` -- pure function, no I/O. Walks an
//      already-replayed `replay-output.json` document (`lib/replay.mjs#replayCorpus`'s own shape,
//      the exact same input `lib/metrics.mjs#computeAgreementMeasures` consumes) and emits ONE
//      discordance record per (labeled case, disagreement dimension) where the engine's own output
//      disagrees with that case's `referenceLabels`. Four dimensions, mirroring
//      `lib/metrics.mjs`'s own 5 OQ-5 measures minus the two aggregate-only ones
//      (case-level-exact-agreement and per-candidate-pattern are BOTH already covered, per-case,
//      by `candidate-pattern-mismatch` below -- they are aggregations of the same underlying
//      per-case fact, not a distinct disagreement class):
//        - `candidate-pattern-mismatch`  -- rankedDifferential ids (as a set) != referenceLabels.candidatePatternIds
//        - `safety-flag-mismatch`        -- alert ids (as a set) != referenceLabels.safetyFlagIds
//        - `missing-data-prompt-mismatch`-- nextQuestions ids (as a set) != referenceLabels.missingDataPromptIds
//        - `dangerous-miss-discordance`  -- `../metrics.mjs#isDangerousMissDiscordant(case)` is true
//      A single case can emit MULTIPLE discordance records (one per dimension that disagrees) --
//      this is a deliberate design choice over a single combined-dimensions record: FR-23 names
//      "disagreement class" (singular) as a per-record field, and Workstream A's adjudication
//      workflow reviews one class of disagreement at a time (ADR-0004's per-role review-record
//      shape is itself one-record-per-review-act, the same granularity principle).
//      Unlabeled cases (no `referenceLabels` at all) never emit a discordance record -- there is
//      nothing to disagree against, the same exclusion `lib/metrics.mjs#isLabeled` already applies.
//
//   2. `validateDiscordanceRecord(record)` -- validates one record against
//      `schemas/discordance-record.schema.json` via the repo's existing dependency-free validator
//      (`scripts/lib/json-schema-lite.mjs`, reused -- not reimplemented, same posture
//      `lib/boundary.mjs`/`lib/replay.mjs` already establish for this tool). Every record
//      `computeDiscordanceRecords` emits is schema-valid by construction; this export exists so a
//      caller (or a seeded missing-field fixture in a test) can independently prove that, or reject
//      a hand-built/malformed record.
//
//   3. `toAdjudicationScaffoldInput(record, humanInput)` -- the FR-23 "structurally consumable by
//      Workstream A" bridge: maps a discordance record's own fields onto the exact options shape
//      `tools/review-record/lib/verbs/scaffold.mjs#run` (P1-T2's canonical `adjudication`-role
//      scaffold input) accepts -- `record.candidateDigest` (already `sha256:<64 hex>`-shaped, the
//      SAME shape `tools/review-record`'s own `subjectContentHash`/`--subject` requires) becomes
//      `subject`; `record.moduleId` becomes `module`; `role` is always `'adjudication'`; a
//      deterministic `rationale` is composed from the record's own case ref / disagreement class /
//      output-vs-reference-label content (never invented prose). A discordance record is
//      "adjudication-ready", NOT an adjudication decision: `reviewerId`/`decision` -- the actual
//      human adjudicator's identity and verdict -- are NEVER derivable from a discordance record
//      alone (nothing in this tool has adjudicator authority) and MUST be supplied by the caller in
//      `humanInput`; this function throws if either is missing rather than defaulting one.
//
// PRD OQ-5 adjudicator-≠-author reuse (FR-23's own binding clause: "the adjudicator-≠-author check
// reuses the PRD OQ-5 authorship-union definition (shared helper, not re-implemented)"):
// `checkAdjudicatorNotAuthor` below calls `computeAuthorshipUnion`/`rosterEntryInAuthorshipUnion`
// IMPORTED from `tools/review-record/lib/adjudication.mjs` (P2-T4's own PRD OQ-5 implementation) --
// this file contains no git-log parsing, no authorship-source-kind constants, no name-heuristic
// logic of its own. Cross-tool imports already have a precedent in this repository
// (`tools/review-record/lib/store.mjs` imports `tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs`) --
// this is the same pattern, not a new one.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../../../scripts/lib/json-schema-lite.mjs';
import { isDangerousMissDiscordant } from './metrics.mjs';
import {
  computeAuthorshipUnion,
  rosterEntryInAuthorshipUnion,
} from '../../review-record/lib/adjudication.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to this tool's own tool-local discordance-record schema (P4-T5, FR-23). */
export const DISCORDANCE_RECORD_SCHEMA_PATH = path.join(MODULE_DIR, '..', 'schemas', 'discordance-record.schema.json');

export const DISCORDANCE_RECORD_SCHEMA_VERSION = 1;

/** The four FR-23 disagreement classes -- see this file's header for why case-level-exact-
 * agreement / per-candidate-pattern (OQ-5's own aggregate measures) are not separate classes here. */
export const DISAGREEMENT_CLASSES = Object.freeze([
  'candidate-pattern-mismatch',
  'safety-flag-mismatch',
  'missing-data-prompt-mismatch',
  'dangerous-miss-discordance',
]);

let cachedSchema;

/**
 * Loads and parses `schemas/discordance-record.schema.json` once per process (cached thereafter --
 * same lazy-cache pattern `lib/corpus.mjs#loadFixtureCorpusSchema` already establishes).
 * @returns {Promise<object>} the parsed JSON Schema document
 */
export async function loadDiscordanceRecordSchema() {
  if (!cachedSchema) {
    const raw = await readFile(DISCORDANCE_RECORD_SCHEMA_PATH, 'utf8');
    cachedSchema = JSON.parse(raw);
  }
  return cachedSchema;
}

/**
 * Validates one discordance record against `schemas/discordance-record.schema.json`.
 * @param {unknown} record
 * @returns {Promise<{ path: string, message: string }[]>} empty array = valid
 */
export async function validateDiscordanceRecord(record) {
  const schema = await loadDiscordanceRecordSchema();
  return validate(schema, record);
}

// -------------------------------------------------------------------------------------------
// computeDiscordanceRecords -- pure, no I/O.
// -------------------------------------------------------------------------------------------

function idSet(ids) {
  return new Set(Array.isArray(ids) ? ids : []);
}

function idArray(ids) {
  return Array.isArray(ids) ? [...ids].sort() : [];
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function engineCandidateIds(replayCase) {
  return (replayCase.output?.rankedDifferential ?? []).map((c) => c.id);
}

function engineAlertIds(replayCase) {
  return (replayCase.output?.alerts ?? []).map((a) => a.id);
}

function engineQuestionIds(replayCase) {
  return (replayCase.output?.nextQuestions ?? []).map((q) => q.id);
}

function isLabeled(replayCase) {
  return replayCase.referenceLabels !== null && replayCase.referenceLabels !== undefined;
}

/** Deterministic, non-random discordance id -- see the schema's own `discordanceId` field doc. */
function buildDiscordanceId({ corpusId, caseRef, disagreementClass }) {
  return `${corpusId}__${caseRef}__${disagreementClass}`;
}

function idSetDocument(engineIds, referenceIds) {
  return {
    engineOutputSet: {
      candidatePatternIds: idArray(engineIds.candidatePatternIds),
      safetyFlagIds: idArray(engineIds.safetyFlagIds),
      missingDataPromptIds: idArray(engineIds.missingDataPromptIds),
    },
    referenceLabelSet: {
      candidatePatternIds: idArray(referenceIds.candidatePatternIds),
      safetyFlagIds: idArray(referenceIds.safetyFlagIds),
      missingDataPromptIds: idArray(referenceIds.missingDataPromptIds),
    },
  };
}

/**
 * Computes every FR-23 discordance record for an already-replayed `replay-output.json` document.
 * Pure -- no I/O, no schema validation performed here (see `validateDiscordanceRecord` for that,
 * kept separate so a caller can validate a hand-built or seeded-bad record too).
 * @param {{ corpusId: string, candidate: { moduleId: string, packDigest: string }, cases: object[] }} replayDocument
 * @returns {object[]} zero or more discordance records, one per (labeled case, disagreeing
 *   dimension), in stable (caseId ascending, then DISAGREEMENT_CLASSES order) order.
 */
export function computeDiscordanceRecords(replayDocument) {
  const { corpusId, candidate } = replayDocument;
  const allCases = replayDocument.cases ?? [];
  const records = [];

  for (const replayCase of allCases) {
    if (!isLabeled(replayCase)) continue;
    const ref = replayCase.referenceLabels;

    const engineIds = {
      candidatePatternIds: engineCandidateIds(replayCase),
      safetyFlagIds: engineAlertIds(replayCase),
      missingDataPromptIds: engineQuestionIds(replayCase),
    };
    const referenceIds = {
      candidatePatternIds: ref.candidatePatternIds ?? [],
      safetyFlagIds: ref.safetyFlagIds ?? [],
      missingDataPromptIds: ref.missingDataPromptIds ?? [],
    };

    const dimensionMismatches = [
      ['candidate-pattern-mismatch', !setsEqual(idSet(referenceIds.candidatePatternIds), idSet(engineIds.candidatePatternIds))],
      ['safety-flag-mismatch', !setsEqual(idSet(referenceIds.safetyFlagIds), idSet(engineIds.safetyFlagIds))],
      ['missing-data-prompt-mismatch', !setsEqual(idSet(referenceIds.missingDataPromptIds), idSet(engineIds.missingDataPromptIds))],
      // Reuses `../metrics.mjs#isDangerousMissDiscordant` verbatim -- this file does not
      // re-implement the named-flag-vs-fallback dangerous-miss rule.
      ['dangerous-miss-discordance', isDangerousMissDiscordant(replayCase)],
    ];

    for (const [disagreementClass, mismatched] of dimensionMismatches) {
      if (!mismatched) continue;
      records.push({
        schemaVersion: DISCORDANCE_RECORD_SCHEMA_VERSION,
        discordanceId: buildDiscordanceId({ corpusId, caseRef: replayCase.caseId, disagreementClass }),
        corpusId,
        moduleId: candidate.moduleId,
        caseRef: replayCase.caseId,
        candidateDigest: candidate.packDigest,
        disagreementClass,
        ...idSetDocument(engineIds, referenceIds),
      });
    }
  }

  return records;
}

// -------------------------------------------------------------------------------------------
// Adjudicator-≠-author reuse (PRD OQ-5, FR-23's own binding clause) -- imports only, no
// reimplementation. See this file's header for the full contract.
// -------------------------------------------------------------------------------------------

/**
 * Whether `rosterEntry` (a `tools/review-record/lib/roster.mjs`-resolved reviewer) may serve as
 * adjudicator for `moduleId`'s discordance records, per PRD OQ-5's authorship-union rule: the
 * adjudicator must NOT be in the union of (a) every human identity recorded in the module's
 * `authoring-decisions.yaml` git history and (b) the git author of the commit that introduced the
 * module's manifest. Computed EXCLUSIVELY via `tools/review-record/lib/adjudication.mjs`'s own
 * exported helpers -- `computeAuthorshipUnion`/`rosterEntryInAuthorshipUnion` -- this function adds
 * no independent authorship logic of its own.
 * @param {{ rootDir: string, moduleId: string, rosterEntry: { name?: string } }} args
 * @returns {{ eligible: boolean, authorshipUnion: ReturnType<typeof computeAuthorshipUnion>, reason: string }}
 */
export function checkAdjudicatorNotAuthor({ rootDir, moduleId, rosterEntry }) {
  const authorshipUnion = computeAuthorshipUnion(rootDir, moduleId);
  const inUnion = rosterEntryInAuthorshipUnion(rosterEntry, authorshipUnion);
  if (inUnion) {
    return {
      eligible: false,
      authorshipUnion,
      reason: `reviewer "${rosterEntry?.name}" matches an identity in module "${moduleId}"'s PRD `
        + 'OQ-5 authorship union -- an adjudicator must not be the sole original author of the '
        + 'change under review (ADR-0004, FR-5/FR-23).',
    };
  }
  return {
    eligible: true,
    authorshipUnion,
    reason: authorshipUnion.incomplete
      ? 'no matching identity found in the authorship union, but the union itself is INCOMPLETE '
        + '(see authorshipUnion.notes) -- this is a permissive result only in the narrow sense that '
        + 'no exclusion was found; it is not a positive proof of eligibility.'
      : 'no matching identity found in the (complete) PRD OQ-5 authorship union.',
  };
}

// -------------------------------------------------------------------------------------------
// toAdjudicationScaffoldInput -- FR-23's "structurally consumable by Workstream A" bridge.
// -------------------------------------------------------------------------------------------

/**
 * Composes a deterministic, non-invented rationale string from a discordance record's own content
 * -- never free prose about clinical meaning, purely a structural restatement of what disagreed.
 * @param {object} record a discordance record (`computeDiscordanceRecords`'s own shape)
 * @returns {string}
 */
export function buildDiscordanceRationale(record) {
  return `Adjudication-ready discordance record ${record.discordanceId}: harness engine output `
    + `disagreed with the fixture reference label for case "${record.caseRef}" (corpus `
    + `"${record.corpusId}", candidate digest "${record.candidateDigest}") in dimension `
    + `"${record.disagreementClass}". engineOutputSet=${JSON.stringify(record.engineOutputSet)}, `
    + `referenceLabelSet=${JSON.stringify(record.referenceLabelSet)}. This is a SOFTWARE-AGREEMENT `
    + 'discordance against this corpus\'s own fixture reference labels -- NOT a clinical-validity, '
    + 'safety, or diagnostic-performance claim (OQ-5); the actual adjudication decision below is a '
    + 'human act this record does not perform.';
}

/**
 * Maps a discordance record onto the exact options shape
 * `tools/review-record/lib/verbs/scaffold.mjs#run` accepts for `--role adjudication` (P1-T2's
 * canonical adjudication-role scaffold input) -- `record.candidateDigest` (already
 * `sha256:<64 hex>`-shaped) becomes `subject`, `record.moduleId` becomes `module`, `role` is always
 * `'adjudication'`. A discordance record is adjudication-READY, not an adjudication decision:
 * `reviewerId`/`decision` are the human adjudicator's own identity/verdict and are NEVER derived
 * from the record itself -- `humanInput` MUST supply both, or this function throws (fails closed
 * rather than fabricating either).
 * CRW-F5 revision (clinical-review-workflow-v1 Wave-2 codex gate, BLOCKER 2 -- see
 * .claude/findings/clinical-review-workflow-findings.md's CRW-F5 entry for the full history): the
 * returned options always carry `allowHistoricalSubject: true`, explicitly. `scaffold`'s F5 check
 * now hard-fails BY DEFAULT whenever an explicitly-supplied `--subject` cannot be verified against
 * the target module's own recomputed content hash -- which this bridge's `subject` (a discordance
 * record's own `candidateDigest`, a structurally different hash concept than a module-content hash,
 * see this function's own header above) never can be, by design. This is the loud, explicit escape
 * hatch CRW-F5's own residual-risk note already anticipated for this exact bridge, not a weakening
 * of `scaffold`'s check: every `scaffold` invocation built from this function's output prints a
 * `NOTICE (--allow-historical-subject): ...` line confirming the comparison was intentionally
 * skipped, rather than silently proceeding.
 * @param {object} record a discordance record (`computeDiscordanceRecords`'s own shape)
 * @param {{ reviewerId: string, decision: string, rationale?: string, reviewedAt?: string, supersedes?: string, root?: string }} humanInput
 * @returns {{ module: string, role: 'adjudication', subject: string, reviewerId: string, decision: string, rationale: string, allowHistoricalSubject: true, reviewedAt?: string, supersedes?: string, root?: string }}
 */
export function toAdjudicationScaffoldInput(record, humanInput = {}) {
  if (!record || typeof record !== 'object') {
    throw new TypeError('toAdjudicationScaffoldInput requires a discordance record');
  }
  if (typeof humanInput.reviewerId !== 'string' || humanInput.reviewerId.length === 0) {
    throw new TypeError(
      'toAdjudicationScaffoldInput requires humanInput.reviewerId -- a discordance record names no '
        + 'adjudicator of its own (that is a human act, never derived from harness output).',
    );
  }
  if (typeof humanInput.decision !== 'string' || humanInput.decision.length === 0) {
    throw new TypeError(
      'toAdjudicationScaffoldInput requires humanInput.decision -- a discordance record documents a '
        + 'disagreement, it does not adjudicate one.',
    );
  }

  const options = {
    module: record.moduleId,
    role: 'adjudication',
    subject: record.candidateDigest,
    reviewerId: humanInput.reviewerId,
    decision: humanInput.decision,
    rationale: humanInput.rationale ?? buildDiscordanceRationale(record),
    // CRW-F5 revision (BLOCKER 2, see this function's own header above) -- loud, explicit opt-out,
    // never a silent one.
    allowHistoricalSubject: true,
  };
  if (humanInput.reviewedAt !== undefined) options.reviewedAt = humanInput.reviewedAt;
  if (humanInput.supersedes !== undefined) options.supersedes = humanInput.supersedes;
  if (humanInput.root !== undefined) options.root = humanInput.root;
  return options;
}
