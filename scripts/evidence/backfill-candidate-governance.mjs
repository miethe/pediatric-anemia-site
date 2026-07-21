#!/usr/bin/env node
// backfill-candidate-governance.mjs — FIX-C (reviewer re-review, EP3-T4).
//
// EP3-T4's acceptance criterion is explicit: "every rule.evidence[]/candidate.evidence[]
// reference must resolve to a passage-level record or an explicit implementation-proposal flag."
// scripts/evidence/backfill-rule-governance.mjs gave rules a `sourcePassageId`; this script gives
// modules/anemia/candidates.json's 26 diagnostic patterns the same treatment, using the identical
// fail-safe binder design (D-EP3-6):
//
//   1. primarySourceId = candidate.evidence[0] ("the candidate's first cited source").
//   2. REVIEWED_CANDIDATE_PASSAGE_MAP (below) is consulted, keyed by candidate id. It is the ONLY
//      source of a source-supported binding this script is permitted to mint, and it is empty
//      today — exactly the same posture, and validated by the exact same shared attestation
//      validator, as scripts/evidence/backfill-rule-governance.mjs's REVIEWED_RULE_PASSAGE_MAP.
//   3. Every candidate for which REVIEWED_CANDIDATE_PASSAGE_MAP has no entry falls back to
//      `${primarySourceId}#implementation-proposal`. That is every one of the 26 candidates as of
//      this writing.
//
// This script never invents a source-supported binding by keyword/substring matching, ARC/
// council-review output, or any other mechanical process — the guardrail the rule-side reviewer
// finding (finding 1, HIGH) established applies identically here.
//
// Usage:
//   node scripts/evidence/backfill-candidate-governance.mjs             writes candidates.json
//   node scripts/evidence/backfill-candidate-governance.mjs --check     regenerates in memory;
//                                                                        exits 1 with a diff
//                                                                        summary if candidates.json
//                                                                        on disk differs; writes
//                                                                        nothing.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { passagesFor, isBindableAsSourceSupported } from '../../src/evidence.js';
import { validateAttestationEntries } from './lib/attested-passage-map.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CANDIDATES_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'candidates.json');

const GOVERNED_KEY_ORDER = ['id', 'label', 'category', 'summary', 'defaultNextSteps', 'evidence', 'sourcePassageId'];

// The ONLY permitted source of a source-supported `sourcePassageId` binding for a candidate.
// SHIPS EMPTY — same posture, and the same validation, as
// scripts/evidence/backfill-rule-governance.mjs's REVIEWED_RULE_PASSAGE_ATTESTATIONS. An entry
// may be added ONLY from an independently reviewed, human-attested mapping (a named clinical
// reviewer confirming the passage's prose supports this candidate's complete diagnostic pattern
// definition) — never derived mechanically.
const REVIEWED_CANDIDATE_PASSAGE_ATTESTATIONS = [
  // Each entry: { candidateId, passageId, attestedBy, credential, attestedOn, attestationRef }.
  // Empty pending independent clinical review (see the block comment above).
];

validateAttestationEntries(
  REVIEWED_CANDIDATE_PASSAGE_ATTESTATIONS,
  'candidateId',
  { passagesFor, isBindableAsSourceSupported },
  'REVIEWED_CANDIDATE_PASSAGE_ATTESTATIONS',
);

const REVIEWED_CANDIDATE_PASSAGE_MAP = new Map(
  REVIEWED_CANDIDATE_PASSAGE_ATTESTATIONS.map((entry) => [entry.candidateId, entry.passageId]),
);

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

/** Returns { sourcePassageId, reason } — mirrors backfill-rule-governance.mjs's binder. */
function computeSourcePassageId(candidateId, candidate) {
  const primarySourceId = candidate.evidence[0];
  const fallback = `${primarySourceId}#implementation-proposal`;

  const reviewedPassageId = REVIEWED_CANDIDATE_PASSAGE_MAP.get(candidateId);
  if (reviewedPassageId === undefined) {
    return {
      sourcePassageId: fallback,
      reason: 'fallback: no entry in REVIEWED_CANDIDATE_PASSAGE_MAP — no independently reviewed, human-attested candidate->passage mapping exists (D-EP3-6 default)',
    };
  }

  const bindablePassages = passagesFor(primarySourceId).filter(isBindableAsSourceSupported);
  const reviewedPassage = bindablePassages.find((passage) => passage.id === reviewedPassageId);
  if (!reviewedPassage) {
    return {
      sourcePassageId: fallback,
      reason: `fallback: REVIEWED_CANDIDATE_PASSAGE_MAP names "${reviewedPassageId}", but it is not (or is no longer) a bindable source-supported passage for "${primarySourceId}" — falling back per D-EP3-6`,
    };
  }

  return {
    sourcePassageId: reviewedPassageId,
    reason: 'source-supported: independently reviewed, human-attested mapping (REVIEWED_CANDIDATE_PASSAGE_MAP)',
  };
}

function buildGovernedCandidates(candidates) {
  const governed = {};
  const mappingRows = [];
  for (const [candidateId, candidate] of Object.entries(candidates)) {
    const { sourcePassageId, reason } = computeSourcePassageId(candidateId, candidate);
    const governedCandidate = {};
    for (const key of GOVERNED_KEY_ORDER) {
      governedCandidate[key] = key === 'sourcePassageId' ? sourcePassageId : candidate[key];
    }
    governed[candidateId] = governedCandidate;
    mappingRows.push({
      candidateId,
      primarySourceId: candidate.evidence[0],
      sourcePassageId,
      status: sourcePassageId.endsWith('#implementation-proposal') ? 'implementation-proposal' : 'source-supported',
      reason,
    });
  }
  return { governed, mappingRows };
}

function serializeCandidates(candidates) {
  return JSON.stringify(candidates, null, 2) + '\n';
}

function firstDiffLines(a, b, contextLines = 3, maxHunks = 5) {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const diffs = [];
  const max = Math.max(aLines.length, bLines.length);
  let i = 0;
  while (i < max && diffs.length < maxHunks) {
    if (aLines[i] === bLines[i]) { i += 1; continue; }
    let j = i;
    while (j < max && aLines[j] !== bLines[j]) j += 1;
    const start = Math.max(0, i - contextLines);
    const end = Math.min(max, j + contextLines);
    const chunk = [];
    for (let k = start; k < end; k += 1) {
      const a1 = aLines[k];
      const b1 = bLines[k];
      if (a1 === b1) chunk.push(`  ${k + 1}: ${a1 ?? ''}`);
      else {
        if (a1 !== undefined) chunk.push(`- ${k + 1}: ${a1}`);
        if (b1 !== undefined) chunk.push(`+ ${k + 1}: ${b1}`);
      }
    }
    diffs.push(chunk.join('\n'));
    i = j;
  }
  return diffs.join('\n---\n');
}

function parseArgs(argv) {
  const out = { check: false };
  for (const arg of argv) {
    if (arg === '--check') out.check = true;
    else if (arg === '--write') out.check = false;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

async function main() {
  const { check } = parseArgs(process.argv.slice(2));
  const candidates = await loadJson(CANDIDATES_PATH);
  const { governed, mappingRows } = buildGovernedCandidates(candidates);
  const nextSerialised = serializeCandidates(governed);

  if (check) {
    const current = await readFile(CANDIDATES_PATH, 'utf8');
    if (current === nextSerialised) {
      console.log(`backfill-candidate-governance --check: modules/anemia/candidates.json matches regenerated output (${mappingRows.length} candidates).`);
      return;
    }
    const diff = firstDiffLines(current, nextSerialised);
    console.error('backfill-candidate-governance --check: modules/anemia/candidates.json differs from regenerated output.');
    console.error(diff ? `First differing hunks:\n${diff}` : '(no line-level diff produced; check byte lengths)');
    process.exit(1);
  }

  await writeFile(CANDIDATES_PATH, nextSerialised, 'utf8');

  const supportedCount = mappingRows.filter((row) => row.status === 'source-supported').length;
  console.log(
    `Wrote ${path.relative(REPO_ROOT, CANDIDATES_PATH)}: ${mappingRows.length} candidates governed. `
    + `sourcePassageId split: ${supportedCount} source-supported / ${mappingRows.length - supportedCount} implementation-proposal.`,
  );
}

main().catch((error) => {
  console.error(`backfill-candidate-governance: ${error.stack ?? error.message}`);
  process.exit(1);
});
