// tools/review-record/lib/roster.mjs — roster resolution (P2-T2, PRD OQ-1/FR-3).
//
// Reads `<rootDir>/governance/reviewer-roster.yaml` (or a `--root` fixture standing in for it in
// tests) and resolves a `reviewerId` against it: unknown identity fails closed
// (`UnknownReviewerError`); an identity whose `moduleScopes[]` does not include the target module
// also fails closed (`ReviewerNotInScopeError`). This module is deliberately narrow — it duplicates
// (rather than imports) the small `reviewerId -> roster entry` index shape
// `scripts/validate-kb.mjs`'s `buildReviewerRosterIndex`/`loadReviewerRosterIndex` already build for
// the whole-tree `npm run validate` cross-check (P1-T7, D-4 layer 3): importing that file here would
// pull in the entire rule-engine/evidence-validation module graph (`src/ruleEngine.js`,
// `src/modules/registry.js`, `src/evidence.js`, `scripts/lib/json-schema-lite.mjs`, ...) into a small
// authoring CLI whose own module boundary (this tool's README) names "roster" as depending on
// "store" alone. Both readers parse the exact same file with the exact same parser
// (`tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs`'s `parseYamlDocument`) and read the exact same
// `reviewers[].reviewerId`/`.moduleScopes`/`.synthetic` shape (`schemas/reviewer-roster.schema.json`,
// P1-T4) — if that shape ever changes, both readers change together, but they stay two small,
// independently-reasoned-about functions rather than one shared import across a module boundary this
// tool does not otherwise cross.
//
// This module never WRITES the roster — `governance/reviewer-roster.yaml` ships empty (FR-3) and no
// task or agent in this repository ever adds a `synthetic: false` ("real") entry to it (see that
// file's own header); the only entries this tool's later tasks (P2-T8) ever commit are clearly
// `synthetic: true` dry-run personas. Read-only, deterministic, no network.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { UnknownReviewerError, ReviewerNotInScopeError } from './errors.mjs';
import { parseYamlDocument } from '../../rf-bundle-to-kb-pack/lib/yaml-lite.mjs';

/**
 * @param {string} rootDir
 * @returns {string} absolute path to `governance/reviewer-roster.yaml` under `rootDir`
 */
export function rosterFilePathFor(rootDir) {
  return path.join(rootDir, 'governance', 'reviewer-roster.yaml');
}

/**
 * Builds a `reviewerId -> roster entry` `Map` from an already-parsed roster document. Pure —
 * mirrors `scripts/validate-kb.mjs`'s `buildReviewerRosterIndex` shape exactly (see this file's
 * header) without importing it. An entry whose `reviewerId` is not a string is skipped rather than
 * thrown on — shape-defect reporting for the roster file itself is
 * `schemas/reviewer-roster.schema.json`'s (and `scripts/validate-kb.mjs`'s) job, not this index
 * builder's.
 *
 * @param {*} rosterData a parsed `governance/reviewer-roster.yaml` document
 * @returns {Map<string, object>}
 */
export function buildRosterIndex(rosterData) {
  const index = new Map();
  const reviewers = Array.isArray(rosterData?.reviewers) ? rosterData.reviewers : [];
  for (const reviewer of reviewers) {
    if (typeof reviewer?.reviewerId === 'string') index.set(reviewer.reviewerId, reviewer);
  }
  return index;
}

/**
 * Reads and parses `<rootDir>/governance/reviewer-roster.yaml` into a `reviewerId -> entry` index.
 * An absent roster file degrades to an empty index (same "unresolvable" outcome as a present-but-
 * empty `reviewers: []` roster — FR-3's actual shipped state) rather than crashing; every
 * `reviewerId` lookup against an empty index fails closed via `resolveReviewer` below regardless of
 * which of those two causes produced the empty index.
 *
 * @param {string} rootDir
 * @returns {Promise<Map<string, object>>}
 */
export async function loadRosterIndex(rootDir) {
  let raw;
  try {
    raw = await readFile(rosterFilePathFor(rootDir), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return new Map();
    throw err;
  }
  return buildRosterIndex(parseYamlDocument(raw));
}

/**
 * Resolves `reviewerId` against an already-loaded roster index for a specific `moduleId`. Fails
 * closed on either an unknown identity (`UnknownReviewerError`) or a known identity outside the
 * requested module's authorized scope (`ReviewerNotInScopeError`) — both are FR-3 requirements
 * ("module-scope authorization"), not just plain identity lookup.
 *
 * @param {Map<string, object>} rosterIndex
 * @param {string} reviewerId
 * @param {string} moduleId
 * @returns {object} the resolved roster entry (includes `.synthetic`, `.moduleScopes`, etc.)
 */
export function resolveReviewer(rosterIndex, reviewerId, moduleId) {
  const entry = rosterIndex.get(reviewerId);
  if (!entry) throw new UnknownReviewerError(reviewerId);
  const scopes = Array.isArray(entry.moduleScopes) ? entry.moduleScopes : [];
  if (!scopes.includes(moduleId)) throw new ReviewerNotInScopeError(reviewerId, moduleId);
  return entry;
}
