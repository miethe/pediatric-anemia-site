// scripts/rights/lib/rights-decision-ledger-gate.mjs — EPR4-T4 (FR-WP4-04, decisions-block D4/D6/D7).
//
// THE RIGHTS-DECISION LEDGER (rights/rights-ledger.json#rights_decisions): the shape a future rights
// owner fills in, joined BIDIRECTIONALLY to (1) a rights_record_id in rights/rights-records.json and
// (2) a passage id (an "evidence item" in the sense scripts/rights/build-decision-brief.mjs's --item
// flag already uses) in some module's evidence.json. It ships EMPTY (D6) — no agent may ever write a
// live entry, only the shape and the gate that will check one.
//
// Scope note on "evidence item": a `derived_synthesis` item carries no rights_record of its own
// (scripts/rights/build-decision-brief.mjs's buildSynthesisItemBrief: "derived_synthesis items carry
// no rights_record of their own ... resolve the rights position of each attributed input above
// instead" — RF handoff §9.5, decisions-block D3/D6). A rights DECISION is therefore always about a
// passage (the thing that actually joins to a rights_record via rights/rights-ledger.json's existing
// evidence_source_id entries), never a synthesis id directly. This is a deliberate scope decision,
// not an omission.
//
// REUSE, NOT DUPLICATION (FR-WP4-04's explicit acceptance criterion): this file adds NO second
// attestation-structure validator. Every rights-decision entry names the SAME five fields
// scripts/evidence/lib/attested-passage-map.mjs's `REQUIRED_ATTESTATION_FIELDS` already governs
// (`passageId`, `attestedBy`, `credential`, `attestedOn`, `attestationRef`), plus its own `rights_
// decision_id` idField — deliberately shaped so `validateAttestationEntries` (the SAME exported
// primitive `validateBindingsAgainstLedger` is itself built on, the RG-9 seam) can validate a
// rights-decision entry's structure UNMODIFIED, with no bespoke re-implementation of the credential
// closed-list check, the attestationRef canonical-path check, or the calendar-date check. Ships
// empty, so this call is a no-op against the committed ledger today; it is exercised by this file's
// own unit tests via fixtures, and EPR4-T5 (FR-WP4-05/06) is the task that fixture-exercises the
// full positive-check surface (closed credential list / canonical attestationRef / calendar date)
// in depth — this gate proves only that the SAME reused machinery is wired in, not a parallel one.
//
// The ONE piece `validateAttestationEntries` cannot check — because passage-attestations.json has
// no concept of a rights_record — is the second join direction: does `rights_record_id` resolve to a
// real `rights/rights-records.json` record? `checkRightsRecordJoin` below is that second, NEW half —
// a plain Map-lookup coverage check, structurally identical in KIND to the join-existence gates
// already in scripts/validate-rights.mjs (checkMissingAssessmentCoverage, checkOpenFailurePresence,
// checkKbJsonFileCoverage) — none of which anyone would call "a second ledger-validation
// implementation" of attested-passage-map.mjs, and neither is this.
//
// D7: reads no rights-authority field (`overall_status`, `review.review_status`, `clearance_status`,
// `release_gate`) — only that `rights_record_id` resolves to *a* record, never what that record
// concludes. D2: reads no evidence-item taxonomy axis field either (`evidence_item_type` etc.), so
// this file does not need the split tests/rights-axis-separation.test.mjs's barrier probe otherwise
// requires — it is homed in its own module anyway, mirroring gates (f)/(g)/(h)'s established pattern.

import { isBindableAsSourceSupported } from '../../../src/evidence.js';
import { validateAttestationEntries } from '../../evidence/lib/attested-passage-map.mjs';

/**
 * Builds a `passagesFor(sourceId) -> passage[]` lookup from `context.evidencePassages`
 * (`{ moduleId, sourceId, passage }[]`, already assembled by `loadRightsContext` for every module) —
 * the same shape `attested-passage-map.mjs`'s callers already build from their own per-module
 * `passageIndex` Maps, just aggregated across every module rather than one.
 */
function buildPassagesFor(evidencePassages) {
  const bySource = new Map();
  for (const entry of evidencePassages ?? []) {
    if (!entry?.sourceId) continue;
    if (!bySource.has(entry.sourceId)) bySource.set(entry.sourceId, []);
    bySource.get(entry.sourceId).push(entry.passage);
  }
  return (sourceId) => bySource.get(sourceId) ?? [];
}

/**
 * Reuses `validateAttestationEntries` — unmodified, same import, same required-field set — against
 * `rights/rights-ledger.json#rights_decisions`. Catches the single aggregated throw and folds it
 * into this gate's `{ errors }` shape rather than letting it propagate, mirroring exactly how
 * `validateBindingsAgainstLedger` itself wraps the same call (attested-passage-map.mjs lines ~261-272).
 */
function checkRightsDecisionEntryShape(entries, passagesFor) {
  try {
    validateAttestationEntries(
      entries,
      'rights_decision_id',
      { passagesFor, isBindableAsSourceSupported },
      'rights/rights-ledger.json#rights_decisions',
    );
    return [];
  } catch (error) {
    return [`rights-decision-ledger-coverage: ${error.message}`];
  }
}

/**
 * The NEW half `validateAttestationEntries` cannot provide: does `rights_record_id` resolve to a
 * real `rights/rights-records.json` record? Two failure modes, matching FR-WP4-04's own acceptance
 * text verbatim: (1) a well-typed but non-existent `rights_record_id` — "an entry pointing at a
 * non-existent record ... fails"; (2) a missing/empty/wrong-type `rights_record_id` — "a [ledger]
 * record with a malformed back-reference fails".
 */
function checkRightsRecordJoin(entries, recordsById) {
  const errors = [];
  entries.forEach((entry, index) => {
    const label = typeof entry?.rights_decision_id === 'string' && entry.rights_decision_id.length > 0
      ? entry.rights_decision_id
      : `<entry #${index}, missing "rights_decision_id">`;
    const rightsRecordId = entry?.rights_record_id;
    if (typeof rightsRecordId !== 'string' || rightsRecordId.length === 0) {
      errors.push(
        `rights-decision-ledger-coverage: ${label}: missing/empty required field "rights_record_id" `
        + '(malformed back-reference — every rights-decision entry must name the rights_record it decides)',
      );
      return;
    }
    if (!recordsById.has(rightsRecordId)) {
      errors.push(
        `rights-decision-ledger-coverage: ${label}: rights_record_id "${rightsRecordId}" does not resolve `
        + 'to any known rights/rights-records.json record',
      );
    }
  });
  return errors;
}

/**
 * The registered gate. `context` is `scripts/validate-rights.mjs`'s `loadRightsContext` bag — reads
 * `rightsLedger.rights_decisions` (new, additive field; empty today), `rightsRecords`, and
 * `evidencePassages` (all already present in the context; no context-loader change needed).
 */
export function checkRightsDecisionLedgerCoverage(context) {
  const { rightsLedger, rightsRecords, evidencePassages } = context;
  const entries = Array.isArray(rightsLedger?.rights_decisions) ? rightsLedger.rights_decisions : [];
  const recordsById = new Map((rightsRecords?.records ?? []).map((record) => [record.rights_record_id, record]));
  const passagesFor = buildPassagesFor(evidencePassages);

  const errors = [
    ...checkRightsDecisionEntryShape(entries, passagesFor),
    ...checkRightsRecordJoin(entries, recordsById),
  ];
  return { errors };
}
