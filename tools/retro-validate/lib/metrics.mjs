// tools/retro-validate/lib/metrics.mjs -- METRICS module (P4-T4, Evidence Foundry E1 Phase 4,
// FR-21, OQ-5, ADR-0006). Owns three things:
//
//   1. `computeAgreementMeasures(replayDocument)` -- the 5 OQ-5 SOFTWARE-AGREEMENT measures
//      (never sensitivity/specificity/clinical performance), computed purely from an already-
//      written `replay-output.json` document (`lib/replay.mjs#replayCorpus`'s own output shape).
//      Every measure compares the pinned engine build's per-case output against that same case's
//      OPTIONAL `referenceLabels` (`schemas/fixture-corpus.schema.json#/$defs/referenceLabels`) --
//      cases carrying no `referenceLabels` at all are excluded from every measure (there is
//      nothing to agree/disagree against), never silently coerced into a false "agreement".
//   2. `evaluateProtocolQualification(protocolDoc)` -- FR-24's human-only-thresholds banner logic.
//      Structurally returns `qualifying: false` on EVERY input, including a populated protocol
//      document -- Evidence Foundry E1 has no code path that renders any report
//      software-qualifying (see this function's own doc comment for why this is not merely a
//      current default but a structural guarantee).
//   3. `buildAgreementReportDocument(...)` / `buildRunProvenanceDocument(...)` -- assembles the two
//      artifacts `lib/verbs/report.mjs` writes: `agreement-report.json` (the determinism-compared
//      bytes -- carries NO timestamp anywhere in its shape) and its `run-provenance.json` sidecar
//      (FR-21's provenance: corpus id, harness version, candidate registry digest, run timestamp --
//      the ONE sanctioned timestamp location in this tool's entire output surface), plus the
//      `write*` helpers that serialize them with `lib/replay.mjs#canonicalStringify` (reused, not
//      reimplemented -- same sorted-key, timestamp-free posture `replay-output.json` already
//      established) and write them to disk.
//
// Only de-identified AGGREGATES ever appear in `agreement-report.json` -- no raw case `input`, no
// per-case output array, no caseId list. `lib/verbs/report.mjs` (P4-T4) is this module's only
// caller in this tool; the boundary gate (`../boundary.mjs#checkFixtures`, called first,
// unconditionally, since P4-T2) still runs before ANY of this file's logic is ever reached.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalStringify } from './replay.mjs';

// -------------------------------------------------------------------------------------------
// Banners (OQ-5 / FR-24 report-header contract). Exported as named constants (not inlined at each
// call site) so tests can grep/strip them exactly -- in particular, the ONE place the strings
// "sensitivity", "specificity", and "clinical performance" are permitted to appear anywhere in
// this tool's output is inside `SOFTWARE_AGREEMENT_NEGATION_BANNER` below (the explicit negation
// OQ-5 itself requires); every other file/field in this tool must never contain them.
// -------------------------------------------------------------------------------------------

export const UNVALIDATED_PROTOTYPE_BANNER = 'UNVALIDATED RESEARCH PROTOTYPE. This report, and '
  + 'every measure in it, describes deterministic software behavior only. It is not, and must '
  + 'never be read, cited, or represented as, a clinical validity, safety, or regulatory '
  + 'determination of any kind.';

export const SOFTWARE_AGREEMENT_NEGATION_BANNER = 'Every measure below is a SOFTWARE AGREEMENT '
  + 'measure: the pinned engine build\'s output compared against fixture reference labels '
  + 'authored for this synthetic/de-identified corpus. It is NOT clinical performance, NOT '
  + 'sensitivity, and NOT specificity, and must never be reported, cited, or represented as any '
  + 'of those.';

/** FR-24's exact required phrase, per OQ-5: '"non-qualifying — protocol not prespecified by
 * humans."' Present unconditionally on every report emitted in Evidence Foundry E1. */
export const NON_QUALIFYING_PROTOCOL_BANNER = 'NON-QUALIFYING — protocol not prespecified by '
  + 'humans (FR-24). No named human has authored and pinned a validation protocol with real '
  + 'thresholds for this run, so this report cannot be read as meeting, or contributing toward, '
  + 'any prespecified validation protocol, regardless of what the measures above show.';

/** Every one of the 5 OQ-5 measures carries this exact label -- the grep-tested requirement this
 * task's own acceptance criteria name ("every metric labeled software-agreement"). */
export const SOFTWARE_AGREEMENT_LABEL = 'software agreement';

function measure(description, fields) {
  return { label: SOFTWARE_AGREEMENT_LABEL, description, ...fields };
}

// -------------------------------------------------------------------------------------------
// Set-comparison helpers -- pure, no I/O.
// -------------------------------------------------------------------------------------------

function idSet(ids) {
  return new Set(Array.isArray(ids) ? ids : []);
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function intersectionCount(referenceIds, engineIdSet) {
  const refIds = Array.isArray(referenceIds) ? referenceIds : [];
  let count = 0;
  for (const id of refIds) {
    if (engineIdSet.has(id)) count += 1;
  }
  return count;
}

/**
 * A "labeled" case is one whose corpus author supplied `referenceLabels` at all
 * (`schemas/fixture-corpus.schema.json#/$defs/referenceLabels` is entirely optional at the schema
 * level). Cases with no `referenceLabels` carry no reference to agree/disagree against and are
 * excluded from every one of the 5 measures below -- never silently coerced into an "agreement".
 * @param {object} replayCase one element of `replayDocument.cases` (see `lib/replay.mjs#replayCorpus`)
 * @returns {boolean}
 */
function isLabeled(replayCase) {
  return replayCase.referenceLabels !== null && replayCase.referenceLabels !== undefined;
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

// -------------------------------------------------------------------------------------------
// Measure 1: case-level exact-agreement rate.
// -------------------------------------------------------------------------------------------

function computeCaseLevelExactAgreement(labeledCases) {
  let agreeCount = 0;
  for (const replayCase of labeledCases) {
    const ref = replayCase.referenceLabels;
    const candidatesAgree = setsEqual(idSet(ref.candidatePatternIds), idSet(engineCandidateIds(replayCase)));
    const alertsAgree = setsEqual(idSet(ref.safetyFlagIds), idSet(engineAlertIds(replayCase)));
    const promptsAgree = setsEqual(idSet(ref.missingDataPromptIds), idSet(engineQuestionIds(replayCase)));
    if (candidatesAgree && alertsAgree && promptsAgree) agreeCount += 1;
  }
  const labeledCaseCount = labeledCases.length;
  return measure(
    'Software agreement: fraction of labeled corpus cases where the engine\'s ranked-differential '
      + 'candidate-pattern ids, alert ids, and missing-data-prompt ids EXACTLY match (as sets) the '
      + 'case\'s own reference labels. Unlabeled cases (no referenceLabels supplied) are excluded '
      + 'from both the numerator and the denominator.',
    {
      agreeCount,
      labeledCaseCount,
      rate: labeledCaseCount > 0 ? agreeCount / labeledCaseCount : null,
    },
  );
}

// -------------------------------------------------------------------------------------------
// Measure 2: per-candidate-pattern agreement/disagreement counts.
// -------------------------------------------------------------------------------------------

function computePerCandidatePatternAgreement(labeledCases) {
  const patternIds = new Set();
  for (const replayCase of labeledCases) {
    for (const id of replayCase.referenceLabels.candidatePatternIds ?? []) patternIds.add(id);
    for (const id of engineCandidateIds(replayCase)) patternIds.add(id);
  }

  const byPatternId = {};
  for (const patternId of [...patternIds].sort()) {
    let agree = 0;
    let disagree = 0;
    for (const replayCase of labeledCases) {
      const refHas = idSet(replayCase.referenceLabels.candidatePatternIds).has(patternId);
      const engineHas = idSet(engineCandidateIds(replayCase)).has(patternId);
      if (refHas === engineHas) agree += 1;
      else disagree += 1;
    }
    byPatternId[patternId] = { agree, disagree };
  }

  return measure(
    'Software agreement: per-candidate-pattern-id agreement/disagreement counts across labeled '
      + 'corpus cases. A case "agrees" for a given pattern id when the engine\'s presence/absence '
      + 'of that id in rankedDifferential matches the case\'s own referenceLabels.candidatePatternIds '
      + 'presence/absence (both directions count as agreement -- a pattern correctly absent from '
      + 'both is an agreement, not a non-event).',
    { byPatternId, labeledCaseCount: labeledCases.length, patternIdCount: patternIds.size },
  );
}

// -------------------------------------------------------------------------------------------
// Measure 3: dangerous-miss discordance count.
// -------------------------------------------------------------------------------------------

/**
 * A labeled case is a "dangerous-miss discordance" when its reference explicitly marks
 * `dangerousMissExpected: true` and the engine's own alert output does not corroborate it: if the
 * case names specific `safetyFlagIds`, discordant means NONE of them appear among the engine's
 * alert ids; if the case names no specific ids at all, discordant falls back to "the engine
 * emitted zero alerts for this case" (there is no more specific claim to check against). This is a
 * software-agreement measure against this corpus's own fixture reference labels -- never a
 * clinical dangerous-miss rate (OQ-5).
 * @param {object} replayCase
 * @returns {boolean}
 */
export function isDangerousMissDiscordant(replayCase) {
  const ref = replayCase.referenceLabels;
  if (!ref?.dangerousMissExpected) return false;
  const refFlagIds = ref.safetyFlagIds ?? [];
  const engineIds = idSet(engineAlertIds(replayCase));
  if (refFlagIds.length > 0) {
    return !refFlagIds.some((id) => engineIds.has(id));
  }
  return engineIds.size === 0;
}

function computeDangerousMissDiscordance(labeledCases) {
  const dangerousMissExpectedCases = labeledCases.filter((c) => c.referenceLabels.dangerousMissExpected === true);
  const discordantCount = dangerousMissExpectedCases.filter(isDangerousMissDiscordant).length;
  return measure(
    'Software agreement: count of labeled cases where the reference marks '
      + 'dangerousMissExpected:true and the engine\'s own alert output does not corroborate the '
      + 'named (or, absent named ids, any) safety flag for that case. A software-agreement '
      + 'discordance measure against this corpus\'s own fixture reference labels -- NOT a clinical '
      + 'dangerous-miss rate.',
    {
      discordantCount,
      dangerousMissExpectedCount: dangerousMissExpectedCases.length,
    },
  );
}

// -------------------------------------------------------------------------------------------
// Measure 4: safety-flag agreement coverage.
// -------------------------------------------------------------------------------------------

function computeSafetyFlagAgreementCoverage(labeledCases) {
  let matchedCount = 0;
  let referencedCount = 0;
  for (const replayCase of labeledCases) {
    const refFlagIds = replayCase.referenceLabels.safetyFlagIds ?? [];
    const engineIds = idSet(engineAlertIds(replayCase));
    referencedCount += refFlagIds.length;
    matchedCount += intersectionCount(refFlagIds, engineIds);
  }
  return measure(
    'Software agreement: of every reference safetyFlagId named across the labeled corpus, the '
      + 'fraction that also appears among the engine\'s own alert ids for that same case.',
    {
      matchedCount,
      referencedCount,
      rate: referencedCount > 0 ? matchedCount / referencedCount : null,
    },
  );
}

// -------------------------------------------------------------------------------------------
// Measure 5: missing-data-prompt agreement rate.
// -------------------------------------------------------------------------------------------

function computeMissingDataPromptAgreementRate(labeledCases) {
  let matchedCount = 0;
  let referencedCount = 0;
  for (const replayCase of labeledCases) {
    const refPromptIds = replayCase.referenceLabels.missingDataPromptIds ?? [];
    const engineIds = idSet(engineQuestionIds(replayCase));
    referencedCount += refPromptIds.length;
    matchedCount += intersectionCount(refPromptIds, engineIds);
  }
  return measure(
    'Software agreement: of every reference missingDataPromptId named across the labeled corpus, '
      + 'the fraction that also appears among the engine\'s own nextQuestions ids for that same '
      + 'case.',
    {
      matchedCount,
      referencedCount,
      rate: referencedCount > 0 ? matchedCount / referencedCount : null,
    },
  );
}

// -------------------------------------------------------------------------------------------
// Top-level: computeAgreementMeasures -- the 5 OQ-5 measures + case coverage.
// -------------------------------------------------------------------------------------------

/**
 * Computes the exactly-5 OQ-5 software-agreement measures from an already-replayed
 * `replay-output.json` document (`lib/replay.mjs#replayCorpus`'s shape). Pure, no I/O.
 * @param {{ cases: object[] }} replayDocument
 * @returns {{ caseCoverage: object, caseLevelExactAgreementRate: object, perCandidatePatternAgreement: object, dangerousMissDiscordanceCount: object, safetyFlagAgreementCoverage: object, missingDataPromptAgreementRate: object }}
 */
export function computeAgreementMeasures(replayDocument) {
  const allCases = replayDocument.cases ?? [];
  const labeledCases = allCases.filter(isLabeled);

  return {
    caseCoverage: {
      totalCaseCount: allCases.length,
      labeledCaseCount: labeledCases.length,
      unlabeledCaseCount: allCases.length - labeledCases.length,
    },
    caseLevelExactAgreementRate: computeCaseLevelExactAgreement(labeledCases),
    perCandidatePatternAgreement: computePerCandidatePatternAgreement(labeledCases),
    dangerousMissDiscordanceCount: computeDangerousMissDiscordance(labeledCases),
    safetyFlagAgreementCoverage: computeSafetyFlagAgreementCoverage(labeledCases),
    missingDataPromptAgreementRate: computeMissingDataPromptAgreementRate(labeledCases),
  };
}

// -------------------------------------------------------------------------------------------
// Protocol qualification (FR-24). See this file's header for why `qualifying` is structurally
// always `false` in Evidence Foundry E1.
// -------------------------------------------------------------------------------------------

/** The one metadata key a protocol document may carry without counting as "populated" -- a bare
 * shape-version integer is not a clinical threshold. Everything else in a protocol document
 * (however P4-T6's `protocol.schema.json` eventually shapes it) is scanned for a non-null leaf. */
const PROTOCOL_METADATA_KEYS = Object.freeze(['schemaVersion']);

/**
 * Recursively finds every non-null leaf value in `protocolDoc`, returning their dotted paths.
 * Generic by construction (no dependency on P4-T6's not-yet-authored `protocol.schema.json` field
 * names) -- ANY non-null leaf outside the metadata allowlist counts as "populated", because FR-24
 * requires every threshold field be null/TBD-by-named-humans, whatever P4-T6 eventually names them.
 * @param {unknown} protocolDoc
 * @returns {string[]} sorted, dotted field paths that carry a non-null value
 */
export function findPopulatedProtocolFields(protocolDoc) {
  const populated = [];
  function walk(value, pathParts) {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, [...pathParts, String(index)]));
      return;
    }
    if (typeof value === 'object') {
      for (const [key, nested] of Object.entries(value)) {
        if (pathParts.length === 0 && PROTOCOL_METADATA_KEYS.includes(key)) continue;
        walk(nested, [...pathParts, key]);
      }
      return;
    }
    populated.push(pathParts.join('.'));
  }
  walk(protocolDoc, []);
  return populated.sort();
}

/**
 * FR-24 / OQ-5: evaluates whether a report may be treated as meeting a prespecified validation
 * protocol. Structurally returns `qualifying: false` on EVERY call -- absent protocol, a protocol
 * with every threshold null (the only shape P4-T6's schema will ever accept), AND (defensively) a
 * protocol that somehow carries a populated field despite that schema. This is not "the current
 * default happens to be false" -- there is no branch in this function that ever assigns `true` to
 * `qualifying`. Evidence Foundry E1 has no path, human or automated, to a software-declared
 * "qualifying" report; only a human-authored, human-pinned protocol plus a human verdict (an
 * external act, never a task in this plan) could ever change that, and that act happens entirely
 * outside this tool.
 * @param {unknown} [protocolDoc] optional, already-parsed `--protocol <path>` document
 * @returns {{ qualifying: false, protocolSupplied: boolean, populatedFields: string[], reason: string }}
 */
export function evaluateProtocolQualification(protocolDoc) {
  if (protocolDoc === undefined || protocolDoc === null) {
    return {
      qualifying: false,
      protocolSupplied: false,
      populatedFields: [],
      reason: 'no prespecified protocol document was supplied to `report` (--protocol); FR-24 '
        + 'requires a named-human-authored protocol with real thresholds before any report could '
        + 'even be considered against one, and none was given.',
    };
  }
  const populatedFields = findPopulatedProtocolFields(protocolDoc);
  if (populatedFields.length > 0) {
    return {
      qualifying: false,
      protocolSupplied: true,
      populatedFields,
      reason: `the supplied protocol document declares ${populatedFields.length} non-null field(s) `
        + `(${populatedFields.join(', ')}) -- FR-24 requires every threshold field stay `
        + 'null/TBD-by-named-humans; a software-populated or otherwise non-null threshold can '
        + 'never be honored, so this report remains non-qualifying regardless.',
    };
  }
  return {
    qualifying: false,
    protocolSupplied: true,
    populatedFields: [],
    reason: 'the supplied protocol document\'s thresholds are all null -- TBD-by-named-humans '
      + '(FR-24), the only shape a protocol may take in Evidence Foundry E1. A null-threshold '
      + 'protocol still does not make a report qualifying: qualification requires a human verdict '
      + 'against real, human-pinned thresholds, an external act this tool never performs.',
  };
}

// -------------------------------------------------------------------------------------------
// Report/provenance document assembly + writers.
// -------------------------------------------------------------------------------------------

export const AGREEMENT_REPORT_SCHEMA_VERSION = 1;
export const RUN_PROVENANCE_SCHEMA_VERSION = 1;
export const AGREEMENT_REPORT_FILENAME = 'agreement-report.json';
export const RUN_PROVENANCE_FILENAME = 'run-provenance.json';

/**
 * Assembles the full `agreement-report.json` document -- header banners (unvalidated-prototype,
 * software-agreement negation, FR-24 non-qualifying-protocol) + exactly the 5 OQ-5 measures.
 * Carries NO timestamp anywhere in its shape (`run-provenance.json`, built separately, is the sole
 * sanctioned timestamp location) -- this is what makes the document safe to determinism-compare
 * byte-for-byte across two `report` invocations over identical inputs.
 * @param {{ replayDocument: object, protocolDoc?: unknown }} args
 * @returns {object}
 */
export function buildAgreementReportDocument({ replayDocument, protocolDoc }) {
  const measures = computeAgreementMeasures(replayDocument);
  const qualification = evaluateProtocolQualification(protocolDoc);

  return {
    schemaVersion: AGREEMENT_REPORT_SCHEMA_VERSION,
    reportKind: 'software-agreement-report',
    corpusId: replayDocument.corpusId,
    candidate: {
      moduleId: replayDocument.candidate.moduleId,
      version: replayDocument.candidate.version,
      packDigest: replayDocument.candidate.packDigest,
    },
    caseCoverage: measures.caseCoverage,
    banners: {
      unvalidatedPrototype: UNVALIDATED_PROTOTYPE_BANNER,
      softwareAgreementNegation: SOFTWARE_AGREEMENT_NEGATION_BANNER,
      nonQualifyingProtocol: {
        text: NON_QUALIFYING_PROTOCOL_BANNER,
        qualifying: qualification.qualifying,
        protocolSupplied: qualification.protocolSupplied,
        populatedFields: qualification.populatedFields,
        reason: qualification.reason,
      },
    },
    softwareAgreementMeasures: {
      caseLevelExactAgreementRate: measures.caseLevelExactAgreementRate,
      perCandidatePatternAgreement: measures.perCandidatePatternAgreement,
      dangerousMissDiscordanceCount: measures.dangerousMissDiscordanceCount,
      safetyFlagAgreementCoverage: measures.safetyFlagAgreementCoverage,
      missingDataPromptAgreementRate: measures.missingDataPromptAgreementRate,
    },
  };
}

/**
 * Assembles the `run-provenance.json` sidecar -- FR-21's provenance (corpus id, harness version,
 * candidate registry digest, run timestamp), the ONE place in this tool's output a timestamp is
 * ever written. `harnessVersion`/`candidateRegistryDigest` are read off the ALREADY-WRITTEN
 * `replay-output.json` document (never re-derived), so this sidecar always describes the exact
 * harness build + pinned candidate that actually produced the replay a report was built from.
 * @param {{ replayDocument: object, timestamp?: string }} args
 * @returns {object}
 */
export function buildRunProvenanceDocument({ replayDocument, timestamp }) {
  return {
    schemaVersion: RUN_PROVENANCE_SCHEMA_VERSION,
    corpusId: replayDocument.corpusId,
    harnessVersion: replayDocument.harnessVersion,
    candidateRegistryDigest: replayDocument.candidate.packDigest,
    runTimestamp: timestamp ?? new Date().toISOString(),
  };
}

/**
 * Writes `document` as canonical bytes to `<outputDir>/agreement-report.json`. Same
 * canonicalize-then-stringify posture `lib/replay.mjs#writeReplayOutput` already established --
 * reused via `canonicalStringify`, not reimplemented.
 * @param {{ outputDir: string, document: object }} args
 * @returns {Promise<{ outputPath: string, bytes: string }>}
 */
export async function writeAgreementReport({ outputDir, document }) {
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, AGREEMENT_REPORT_FILENAME);
  const bytes = canonicalStringify(document);
  await writeFile(outputPath, bytes, 'utf8');
  return { outputPath, bytes };
}

/**
 * Writes `document` as canonical bytes to `<outputDir>/run-provenance.json`. Canonical
 * serialization is used here too (sorted keys, fixed indent) purely for on-disk consistency with
 * `agreement-report.json` -- this sidecar is NEVER part of any determinism byte-comparison (it
 * carries the one sanctioned timestamp, which differs run to run by design).
 * @param {{ outputDir: string, document: object }} args
 * @returns {Promise<{ outputPath: string, bytes: string }>}
 */
export async function writeRunProvenance({ outputDir, document }) {
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, RUN_PROVENANCE_FILENAME);
  const bytes = canonicalStringify(document);
  await writeFile(outputPath, bytes, 'utf8');
  return { outputPath, bytes };
}
