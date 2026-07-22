// tools/review-record/lib/adjudication.mjs — Adjudication + release-authorization validators
// (P2-T4, PRD OQ-5/FR-5/FR-6). This is the "Adjudication" module boundary named (but not yet
// implemented) in this tool's own README module-boundary table.
//
// Two responsibilities, both computed ONLY from already-committed, on-disk/local-git facts — no
// network, no generative model, no state this tool itself writes:
//
// (1) AUTHORSHIP-UNION COMPUTATION — PRD OQ-5's binding resolution, restated verbatim in
//     `.claude/worknotes/evidence-foundry-e1-v1/contracts-design.md` §(c): the "author" of a
//     converter-produced pack is the UNION of (a) every human identity recorded in the pack's
//     `modules/<id>/authoring-decisions.yaml` decision records, and (b) the git author of record
//     of the commit that introduced the proposal pack. The converter tool is never an identity.
//
//     HONEST IMPLEMENTATION NOTE (surfaced, not silently resolved): as of this task,
//     `schemas/authoring-decisions.schema.json` (E0-owned, `additionalProperties: false`
//     throughout) carries NO in-band human-identity field on a decision record — every
//     `review.*` field is a bare `pending|approved|rejected` status enum with no name attached.
//     Git history is this repository's ONE actual mechanism for recording "who wrote this
//     decision record" today. Source (a) below therefore reads the git-committed authorship
//     history of the `authoring-decisions.yaml` FILE itself (every distinct author who has ever
//     committed to that path) — the closest honest reading of "identities... recorded in...
//     decision records" available given the current schema, not an invented schema field this
//     task does not own. Source (b) reads the git author of record of the commit that introduced
//     `modules/<id>/module.json` (the module package's own manifest — an unambiguous single
//     marker for "the proposal pack was introduced"). If a future schema revision adds a genuine
//     in-band authorship field, source (a) should be revisited to prefer it.
//
// (2) `evaluateReleaseAuthorization` — FR-5 (adjudicator/release-authorizer must not be in the
//     authorship union) and FR-6 (a `release-auth` record is valid only over a complete,
//     chain-valid, roster-verified, non-synthetic record set; E1 raises no ceiling — this stays
//     structurally non-qualifying for any record this tool can currently produce, since
//     `governance/reviewer-roster.yaml` ships synthetic-only pre-G1, FR-3).
//
// Zero network calls: the only subprocess this module ever spawns is a local, offline `git`
// invocation (read-only `rev-parse`/`log`) against the caller-supplied `rootDir`'s own working
// tree — never a remote fetch/clone/pull, never a URL.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { checkModuleChainLinkage } from './chain.mjs';
import { REVIEW_ROLES } from './store.mjs';

export const AUTHORSHIP_SOURCE_AUTHORING_DECISIONS = 'authoring-decisions';
export const AUTHORSHIP_SOURCE_GIT_COMMIT_AUTHOR = 'git-commit-author';

/** The two source kinds PRD OQ-5's authorship-union block always names, per the `contracts-design.md`
 * §(c) block shape (`{ authors: [...], sources: [...] }`) — always both present, regardless of
 * whether either source actually contributed a non-empty identity set for a given module (see this
 * file's header note on source (a)'s current structural emptiness for schema-valid files). */
export const AUTHORSHIP_SOURCES = Object.freeze([
  AUTHORSHIP_SOURCE_AUTHORING_DECISIONS,
  AUTHORSHIP_SOURCE_GIT_COMMIT_AUTHOR,
]);

// "The converter tool is never an identity" (PRD OQ-5): a defensive denylist excluding any git
// author name that LOOKS like a tool/bot/automation identity from ever entering the union, on top
// of the structural fact that a local git commit is always attributed to the committing human even
// when a tool generated the byte content. This can never produce a false EXCLUSION of a genuine
// human named e.g. "Bo Tran" is not matched (word-boundary match on the denylist terms only).
const NON_HUMAN_IDENTITY_RE = /\b(bot|automation|ci|converter|pipeline|noreply|no-reply)\b/i;

function isLikelyNonHumanIdentity(name) {
  return typeof name === 'string' && NON_HUMAN_IDENTITY_RE.test(name);
}

/**
 * @param {string} name
 * @param {string} email
 * @returns {string} `"Name <email>"`, or whichever half is present if only one is non-empty, or
 *   `""` if both are empty.
 */
function formatIdentity(name, email) {
  const n = typeof name === 'string' ? name.trim() : '';
  const e = typeof email === 'string' ? email.trim() : '';
  if (n && e) return `${n} <${e}>`;
  return n || e || '';
}

/**
 * Resolves `rootDir`'s git top-level and its `--show-prefix` (rootDir's own path relative to that
 * top-level) in one shot. `--show-prefix` — rather than manually diffing `rootDir` against
 * `--show-toplevel` with `path.relative` — sidesteps a real symlink-resolution mismatch (e.g. macOS
 * `/var/folders/...` vs `/private/var/folders/...` for a tmp dir): git computes both values itself
 * from the same working directory, so they are always mutually consistent.
 *
 * @param {string} rootDir
 * @returns {{ toplevel: string, prefix: string } | null} `null` if `rootDir` is not inside a git
 *   working tree (e.g. a plain tmp dir with no `git init`) — the caller treats this as "no git
 *   history available," never as a crash.
 */
function resolveGitContext(rootDir) {
  try {
    const toplevel = execFileSync('git', ['-C', rootDir, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const prefix = execFileSync('git', ['-C', rootDir, 'rev-parse', '--show-prefix'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return { toplevel, prefix };
  } catch {
    return null;
  }
}

/**
 * Runs `git log` over exactly one path inside `gitToplevel`, returning the distinct
 * `{ name, email, identity }` authors found, in first-seen order.
 *
 * @param {string} gitToplevel absolute path to the git working tree root
 * @param {string} relPath path relative to `gitToplevel` (POSIX separators)
 * @param {'all'|'introducing'} mode `'all'` — every commit that ever touched the path (source a);
 *   `'introducing'` — only the earliest commit that ADDED the path (`--diff-filter=A --reverse`,
 *   source b)
 * @returns {{ name: string, email: string, identity: string }[]}
 */
function gitAuthorsForPath(gitToplevel, relPath, mode) {
  const args = ['-C', gitToplevel, 'log', '--format=%an%x1f%ae'];
  if (mode === 'introducing') args.push('--diff-filter=A', '--reverse');
  else args.push('--follow');
  args.push('--', relPath);

  let out;
  try {
    out = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return [];
  }

  const lines = out.split('\n').filter((line) => line.length > 0);
  const seen = new Map();
  for (const line of lines) {
    const [name, email] = line.split('\x1f');
    const identity = formatIdentity(name, email);
    if (!identity) continue;
    if (!seen.has(identity)) {
      seen.set(identity, { name: (name || '').trim(), email: (email || '').trim(), identity });
    }
    if (mode === 'introducing') break; // --reverse means the first line IS the earliest commit.
  }
  return [...seen.values()];
}

/** @param {string} moduleId @returns {string} POSIX-relative path (no rootDir prefix) */
export function authoringDecisionsRelPath(moduleId) {
  return path.posix.join('modules', moduleId, 'authoring-decisions.yaml');
}

/** @param {string} moduleId @returns {string} POSIX-relative path (no rootDir prefix) */
export function moduleManifestRelPath(moduleId) {
  return path.posix.join('modules', moduleId, 'module.json');
}

/**
 * PRD OQ-5's binding authorship-union computation (see this file's header for the full definition
 * and the honest source-(a) implementation note). Synchronous — every underlying operation
 * (`execFileSync`) already is.
 *
 * @param {string} rootDir repo root (or a `--root` fixture/tmp git working tree standing in for it)
 * @param {string} moduleId
 * @returns {{ authors: string[], sources: string[], incomplete: boolean, notes: string[] }}
 *   `authors` — deduped, sorted `"Name <email>"` identity strings (converter/bot-shaped names
 *   excluded). `sources` — always both `AUTHORSHIP_SOURCES` kinds (see that constant's own doc).
 *   `incomplete: true` — source (b) (the proposal-introducing commit) could not be determined;
 *   downstream FR-5/FR-6 checks must fail closed rather than treat this as "nobody authored it."
 */
export function computeAuthorshipUnion(rootDir, moduleId) {
  const notes = [];
  const gitContext = resolveGitContext(rootDir);
  if (!gitContext) {
    return {
      authors: [],
      sources: [...AUTHORSHIP_SOURCES],
      incomplete: true,
      notes: [
        `rootDir "${rootDir}" is not inside a git working tree — the authorship union cannot be ` +
          'computed (fail closed rather than treated as an empty-but-known union).',
      ],
    };
  }

  const decisionsRelPath = path.posix.join(gitContext.prefix, authoringDecisionsRelPath(moduleId));
  const manifestRelPath = path.posix.join(gitContext.prefix, moduleManifestRelPath(moduleId));

  const decisionsAuthors = gitAuthorsForPath(gitContext.toplevel, decisionsRelPath, 'all');
  const introducingAuthors = gitAuthorsForPath(gitContext.toplevel, manifestRelPath, 'introducing');

  if (decisionsAuthors.length === 0) {
    notes.push(
      `no git-committed history found for "${decisionsRelPath}" — either authoring-decisions.yaml ` +
        'does not exist for this module yet (existence-gated, mirrors ' +
        'schemas/authoring-decisions.schema.json\'s own posture), or it has never been committed. ' +
        'Source (a) contributes zero identities in that case — this is not itself an error (see this ' +
        'file\'s header for why source (a) is git-history-derived rather than an in-band field today).',
    );
  }

  let incomplete = false;
  if (introducingAuthors.length === 0) {
    incomplete = true;
    notes.push(
      `no commit was found that introduced "${manifestRelPath}" — source (b) (the git author of the ` +
        'proposal-introducing commit) could not be determined. The authorship union is INCOMPLETE; ' +
        'any adjudication/release-authorization check consuming it must fail closed.',
    );
  }

  const merged = new Map();
  for (const author of [...decisionsAuthors, ...introducingAuthors]) {
    if (isLikelyNonHumanIdentity(author.name)) {
      notes.push(
        `identity "${author.identity}" excluded from the authorship union — its name matches this ` +
          'module\'s non-human/converter/automation denylist (PRD OQ-5: "the converter is never an ' +
          'identity").',
      );
      continue;
    }
    merged.set(author.identity, author);
  }

  return {
    authors: [...merged.keys()].sort(),
    sources: [...AUTHORSHIP_SOURCES],
    incomplete,
    notes,
  };
}

/**
 * Whether a resolved `governance/reviewer-roster.yaml` entry's identity is present in an
 * authorship-union block. Name-based heuristic: the roster carries a `name` field but no email, so
 * this cannot do exact `"Name <email>"` identity matching against a git author string — it compares
 * the roster entry's `name` (trimmed, case-insensitive) against the name-portion of each union
 * author string. This is a SUPPLEMENTARY heuristic layer, the same class of caveat
 * `lib/independence.mjs`'s own header names for its FR-4 heuristic: a clean result here is "no
 * matching name found," not a comprehensive cryptographic proof of non-identity.
 *
 * @param {{ name?: string }} rosterEntry
 * @param {{ authors: string[] }} authorshipBlock
 * @returns {boolean}
 */
export function rosterEntryInAuthorshipUnion(rosterEntry, authorshipBlock) {
  const entryName = typeof rosterEntry?.name === 'string' ? rosterEntry.name.trim().toLowerCase() : '';
  if (!entryName) return false;
  const authors = Array.isArray(authorshipBlock?.authors) ? authorshipBlock.authors : [];
  return authors.some((identity) => {
    const namePart = identity.split('<')[0].trim().toLowerCase();
    return namePart.length > 0 && namePart === entryName;
  });
}

/**
 * FR-6 / OQ-2: a `release-auth` record is valid only over a COMPLETE (all five roles present for
 * its `subjectContentHash`), CHAIN-VALID (no broken hash-chain link anywhere in the module's
 * committed sequence — a hash chain's integrity is a whole-module property, not scoped to one
 * subject), ROSTER-VERIFIED (every related record's `reviewerId` resolved), NON-SYNTHETIC (every
 * related record carries `synthetic === false`) record set. Since `governance/reviewer-roster.yaml`
 * ships synthetic-only pre-G1 (FR-3), the non-synthetic condition is structurally unmet for any
 * record this tool can currently produce — by design (FR-6: "E1 raises no ceiling"). Returns
 * violation strings (empty = this `release-auth` record qualifies); never throws — the caller
 * (`validate.mjs`) decides how to surface the result.
 *
 * @param {{ reviewId: string, seq: number, role: string, record: object }[]} allModuleRecords every
 *   committed record for the module, in ascending `seq` order (`store.mjs`'s `listModuleReviewRecords`
 *   shape) — the FULL module set, not narrowed by any `--record` flag.
 * @param {{ reviewId: string, record: object }} releaseAuthEntry the `release-auth` record itself
 * @param {Map<string, boolean>} rosterVerifiedByReviewId `reviewId -> whether its reviewerId
 *   resolved against the roster` (computed once, module-wide, by the caller)
 * @returns {string[]}
 */
export function evaluateReleaseAuthorization(allModuleRecords, releaseAuthEntry, rosterVerifiedByReviewId) {
  const violations = [];
  const subject = releaseAuthEntry.record?.subjectContentHash;

  const relatedRecords = allModuleRecords.filter((entry) => entry.record?.subjectContentHash === subject);
  const rolesPresent = new Set(relatedRecords.map((entry) => entry.role));
  const missingRoles = REVIEW_ROLES.filter((role) => !rolesPresent.has(role));
  if (missingRoles.length > 0) {
    violations.push(
      `${releaseAuthEntry.reviewId}: release-authorization is not valid — incomplete record set for ` +
        `subjectContentHash "${subject}" (missing role(s): ${missingRoles.join(', ')}).`,
    );
  }

  const chainReport = checkModuleChainLinkage(allModuleRecords);
  const brokenLinks = chainReport.filter((entry) => !entry.ok);
  if (brokenLinks.length > 0) {
    violations.push(
      `${releaseAuthEntry.reviewId}: release-authorization is not valid — module review-record chain ` +
        `is broken (${brokenLinks.map((entry) => entry.reviewId).join(', ')}).`,
    );
  }

  const unverified = relatedRecords.filter((entry) => rosterVerifiedByReviewId.get(entry.reviewId) !== true);
  if (unverified.length > 0) {
    violations.push(
      `${releaseAuthEntry.reviewId}: release-authorization is not valid — reviewerId not roster-verified ` +
        `for record(s): ${unverified.map((entry) => entry.reviewId).join(', ')}.`,
    );
  }

  const synthetic = relatedRecords.filter((entry) => entry.record?.synthetic !== false);
  if (synthetic.length > 0) {
    violations.push(
      `${releaseAuthEntry.reviewId}: release-authorization is not valid — record(s) ` +
        `${synthetic.map((entry) => entry.reviewId).join(', ')} are synthetic:true (or missing a boolean ` +
        '`synthetic` field); a synthetic record can never satisfy release-authorization validity ' +
        '(FR-6, D-4) regardless of its decision or signature.',
    );
  }

  return violations;
}
