// scripts/evidence/lib/attested-passage-map.mjs — shared validator for the ONLY two tables in
// this codebase permitted to mint a source-supported sourcePassageId binding:
// scripts/evidence/backfill-rule-governance.mjs's REVIEWED_RULE_PASSAGE_ATTESTATIONS and
// scripts/evidence/backfill-candidate-governance.mjs's REVIEWED_CANDIDATE_PASSAGE_ATTESTATIONS.
//
// Reviewer re-review (finding A): map membership alone used to mint a source-supported binding —
// an entry was just `ruleId -> passageId`, with no record of WHO reviewed it, WHAT credential
// they held, WHEN, or where that review is attested outside this file. That is documentation-only
// attestation: nothing stopped an entry from being added by anything (or anyone) with write
// access to this file, including a model. This module makes every entry a structured attestation
// record — `{ <idField>, passageId, attestedBy, credential, attestedOn, attestationRef }` — and
// FAILS LOUDLY, naming the offending entry, when any of the following holds:
//
//   1. any required field is missing, not a string, or empty.
//   2. `attestedBy` matches AUTOMATED_IDENTIFIER_PATTERN — i.e. it looks like a model, agent,
//      council, or pipeline identifier rather than a named human reviewer.
//   3. `passageId` does not resolve to a passage that is currently `isBindableAsSourceSupported`
//      (unknown id, wrong source, or a passage the EP3-T5 fidelity audit has since quarantined).
//
// Both maps ship EMPTY. This validator runs at module load time in both backfill scripts (a
// synchronous throw during import crashes the script with a non-zero exit and a readable stack),
// so a malformed entry can never silently produce a source-supported claim — the script simply
// will not run at all until the entry is fixed or removed.
export const AUTOMATED_IDENTIFIER_PATTERN = /(claude|gpt|gemini|arc|council|rf|agent|model|bot|pipeline|automat)/i;

const REQUIRED_ATTESTATION_FIELDS = ['passageId', 'attestedBy', 'credential', 'attestedOn', 'attestationRef'];

/**
 * Validates a list of attestation entries. Throws one aggregated Error naming every offending
 * entry (by its `idField` value, or its index when even that is missing/malformed) if any entry
 * fails any check. Returns nothing on success — callers proceed to build their id -> passageId
 * map only after this has not thrown.
 *
 * @param {Array<object>} entries
 * @param {string} idField — e.g. "ruleId" or "candidateId": the entity-id key each entry carries.
 * @param {object} deps
 * @param {(sourceId: string) => Array<object>} deps.passagesFor
 * @param {(passage: object) => boolean} deps.isBindableAsSourceSupported
 * @param {string} [mapLabel] — for the aggregated error message.
 */
export function validateAttestationEntries(entries, idField, { passagesFor, isBindableAsSourceSupported }, mapLabel = idField) {
  const problems = [];

  entries.forEach((entry, index) => {
    const rawEntityId = entry?.[idField];
    const hasEntityId = typeof rawEntityId === 'string' && rawEntityId.length > 0;
    const label = hasEntityId ? rawEntityId : `<entry #${index}, missing "${idField}">`;

    if (!hasEntityId) {
      problems.push(`${label}: missing/empty required field "${idField}"`);
    }

    for (const field of REQUIRED_ATTESTATION_FIELDS) {
      const value = entry?.[field];
      if (typeof value !== 'string' || value.length === 0) {
        problems.push(`${label}: missing/empty required attestation field "${field}"`);
      }
    }

    const attestedBy = entry?.attestedBy;
    if (typeof attestedBy === 'string' && attestedBy.length > 0 && AUTOMATED_IDENTIFIER_PATTERN.test(attestedBy)) {
      problems.push(
        `${label}: attestedBy "${attestedBy}" matches the automated-identifier pattern — attestation must name a `
        + 'human clinical reviewer, never a model, agent, council, or pipeline identifier',
      );
    }

    const passageId = entry?.passageId;
    if (typeof passageId === 'string' && passageId.length > 0) {
      const sourceId = passageId.split('#')[0];
      const bindable = passagesFor(sourceId).filter(isBindableAsSourceSupported);
      if (!bindable.some((passage) => passage.id === passageId)) {
        problems.push(
          `${label}: passageId "${passageId}" is not a bindable source-supported passage (unknown id, wrong `
          + 'source, or quarantined by the EP3-T5 fidelity audit) — isBindableAsSourceSupported must pass',
        );
      }
    }
  });

  if (problems.length > 0) {
    throw new Error(
      `${mapLabel} failed attestation validation — ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`,
    );
  }
}

// --- the committed ledger -------------------------------------------------------------------
//
// Reviewer gate, third pass (2026-07-21): the attestation records previously lived as constants
// inside the two backfill scripts, which made the gate GENERATOR-SIDE ONLY. A direct hand-edit of
// modules/anemia/rules.json pointing a rule at a clean source-supported passage passed
// `npm run validate` with exit 0. The ledger now lives in a committed data file that
// scripts/validate-kb.mjs also reads, so the DATA is checked rather than only the code path that
// usually produces it.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LEDGER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'evidence-packs', 'passage-attestations.json',
);

export function loadAttestationLedger() {
  const raw = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
  const rules = Array.isArray(raw.rules) ? raw.rules : null;
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : null;
  if (!rules || !candidates) {
    throw new Error(`${LEDGER_PATH}: attestation ledger must define array "rules" and array "candidates"`);
  }
  return { rules, candidates };
}

/**
 * The validator-side gate. Given the entities actually present in the committed KB, reject any
 * that claim source-supported grounding without a matching ledger attestation, and reject any
 * whose bound passage belongs to a source the entity does not itself cite.
 *
 * This is deliberately independent of how the data was produced. It is the check that makes a
 * hand-edit as hard as a generated change.
 *
 * @returns {string[]} error strings; empty when every binding is legitimate.
 */
export function validateBindingsAgainstLedger({
  moduleId, entities, idField, attestations: rawAttestations, passageIndex, isBindableAsSourceSupported,
}) {
  let attestations = rawAttestations;
  const errors = [];

  // The committed ledger's own SHAPE must be validated here, not only in the generators (reviewer
  // gate, fourth pass). Previously this function matched ids and passage ids directly, so a ledger
  // entry of `{ruleId, passageId}` with no attester at all — or one attested by an automated
  // identifier like "GPT-5 review agent" — authorized a source-supported binding. Checking equality
  // against an unvalidated record is not an attestation gate.
  try {
    validateAttestationEntries(
      attestations, idField,
      { passagesFor: (sourceId) => [...passageIndex.values()].filter((p) => p.sourceId === sourceId), isBindableAsSourceSupported },
      `evidence-packs/passage-attestations.json#${idField === 'ruleId' ? 'rules' : 'candidates'}`,
    );
  } catch (error) {
    errors.push(`${moduleId}: attestation ledger is invalid — ${error.message}`);
    // A malformed ledger authorizes NOTHING: fall through with an empty attestation set so every
    // source-supported binding below is rejected for lack of a (valid) attestation.
    attestations = [];
  }

  const attestedFor = new Map(attestations.map((entry) => [entry[idField], entry.passageId]));

  for (const entity of entities) {
    const pointer = entity?.sourcePassageId;
    if (pointer == null) continue;
    const passage = passageIndex.get(pointer);
    if (!passage) continue; // "does not resolve" is reported by the caller's own check

    // (1) cross-source binding: the passage must belong to a source this entity actually cites.
    // FAILS CLOSED on an absent/empty `evidence` array (reviewer gate, fourth pass): the previous
    // `cited.length > 0` guard meant an entity citing NOTHING could be grounded by any passage at
    // all — the check silently skipped exactly the case with the least provenance.
    const cited = Array.isArray(entity.evidence) ? entity.evidence : [];
    if (cited.length === 0) {
      errors.push(
        `${moduleId}/${entity.id}: has sourcePassageId "${pointer}" but cites no evidence sources at `
        + 'all, so no passage can legitimately ground it.',
      );
    } else if (passage.sourceId && !cited.includes(passage.sourceId)) {
      errors.push(
        `${moduleId}/${entity.id}: sourcePassageId "${pointer}" belongs to source "${passage.sourceId}", `
        + `which this entity does not cite (evidence: ${JSON.stringify(cited)}). A rule may only be `
        + 'grounded by a passage from a source it actually cites.',
      );
    }

    // (2) a source-supported binding requires a human attestation in the committed ledger.
    if (passage.status !== 'implementation-proposal' && isBindableAsSourceSupported(passage)) {
      const attested = attestedFor.get(entity.id);
      if (attested !== pointer) {
        errors.push(
          `${moduleId}/${entity.id}: sourcePassageId "${pointer}" claims SOURCE-SUPPORTED grounding with `
          + 'no matching attestation in evidence-packs/passage-attestations.json. A source-supported '
          + 'binding requires a named human clinical attestation; the ledger is currently empty, so no '
          + 'such binding is legitimate today. Fall back to the source\'s implementation-proposal sentinel.',
        );
      }
    }
  }
  return errors;
}
