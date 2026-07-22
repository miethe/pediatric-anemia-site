// tools/review-record/lib/verbs/status.mjs — `status` verb (Clinical Review Workflow v1, Phase 1,
// P1-T2, FR-1/FR-2/FR-27/FR-28/FR-29, OQ-2).
//
// `status --module <id> [--root <dir>] [--json] [--history] [--unredacted]` computes derived
// review-chain state and the next-expected role from a module's committed `reviews/*.yaml` files —
// the same on-disk facts `validate`/`list` already read (schema shape, roster resolution, signature
// verification per record; independence/chain/authorship-union/release-authorization module-wide,
// via the ONE shared `computeDerivedReviewState`, P1-T1) — but projects them for a human/coordinator
// asking "whose turn is it, or are we done" rather than for a pass/fail gate.
//
// THIS FILE OWNS the derived-state MACHINE (state/nextExpectedRole) that P1-T1's
// `computeDerivedReviewState` deliberately left out (see that file's own header: it ships only
// `blockers`/`chainReport`, the fail-closed half of R2's design, and names this file as the owner of
// the lifecycle-position half). It does NOT duplicate `computeDerivedReviewState`'s own reasoning —
// every fail-closed finding (independence, chain, opt-in git-history, authorship-union/FR-5,
// release-authorization/FR-6) is read from that one shared function's `blockers`, never re-derived
// here. What THIS file adds on top is strictly turn-taking: given the module's role-by-role act
// history, which of the five ADR-0004 roles has not yet recorded an EFFECTIVE (non-superseded) act,
// and — once release-auth exists — whether the shared `blockers` result names that release-auth
// record's own FR-6 violation (`structurally-non-qualifying`, the correct non-defect terminus for
// any synthetic:true set — see `lib/verbs/dry-run.mjs`'s `isExpectedTerminalNonQualifyingViolations`,
// reused verbatim below rather than re-derived) or is clean (`acts-complete-unauthorized`, FR-29 —
// NEVER a release-readiness/approval claim: no signature-verification gate, no G4 authority, just
// "structurally complete, chain-valid, roster-verified").
//
// FAIL-CLOSED CONTRACT (FR-28/F8, risk R13): `status` never reports a next-role or terminal
// disposition over a record set `validate` would also reject. ANY violation this file's own
// per-record checks (schema shape, D-4 roster resolution, FR-10 signature verification) or the
// shared `computeDerivedReviewState` module-wide checks find — OTHER than the one narrowly-matched
// FR-6 "this entire set is synthetic:true" finding — collapses `derivedState` to the explicit
// `invalid` state, non-zero exit, rather than guessing a role or a terminus over untrustworthy input.
// A genuine tool-usage failure while computing this (malformed YAML, an unreadable git-history walk
// under --history, ...) is caught here too — `status` reports `invalid` rather than crashing
// uninformatively, which is exactly what FR-28 asks for beyond what `validate` itself does (validate
// is content to let a handful of these propagate as a bare non-`ValidationFailedError` UsageError;
// `status --json` must still emit a well-shaped body naming `invalid` either way).
//
// REDACTION BY DEFAULT (FR-27/F7, risk R3/R10): because this tool has no notion of who is running
// it, `status`'s DEFAULT human and `--json` output redact every already-committed record's
// `reviewerId`/`decision`/`rationale` UNTIL the record set reaches a terminal disposition
// (`structurally-non-qualifying` or `acts-complete-unauthorized`) — the one condition this
// identity-less tool CAN evaluate globally (the other lifting condition FR-27 names, "the viewing
// role's own act is already committed," requires knowing who is asking, which `status` structurally
// does not). `--unredacted` lifts this unconditionally and prints a visible warning naming the
// independence risk (for an adjudicator/release-authorizer who legitimately needs the full picture
// mid-chain, e.g. to review a `disputed` pair) — it never widens or narrows `blockers`/`derivedState`
// itself, only what of each record's content is shown.
//
// Structural review-record state only — never a clinical-validity, safety, or approval claim; see
// schemas/review-record.schema.json's own top-level description for that standing caveat every
// output of this tool carries.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate as validateAgainstSchema } from '../../../../scripts/lib/json-schema-lite.mjs';
import { REVIEW_ROLES, listModuleReviewRecords } from '../store.mjs';
import { loadRosterIndex, resolveReviewer } from '../roster.mjs';
import { checkAppendOnlyHistory } from '../history.mjs';
import { computeAuthorshipUnion, isAdjudicationRequired } from '../adjudication.mjs';
import { verifyRecordSignature } from '../signature.mjs';
import { computeDerivedReviewState } from '../derived-state.mjs';
import { isExpectedTerminalNonQualifyingViolations } from './dry-run.mjs';
import { computeModuleContentHash } from '../subject.mjs';
import { EXIT_OK, EXIT_USAGE, UsageError } from '../errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');

/** FR-29: the terminal all-real state. Never a label implying the release is ready, approved, or
 * authorized, or any synonym — see this file's header and PRD FR-29 for why the naming itself is a
 * risk mitigation. */
export const ACTS_COMPLETE_UNAUTHORIZED = 'acts-complete-unauthorized';

/** The two derived-state labels FR-27 treats as "no longer independence-sensitive" — redaction
 * lifts automatically once either is reached, per FR-27's second lifting condition. */
const TERMINAL_STATES = new Set(['structurally-non-qualifying', ACTS_COMPLETE_UNAUTHORIZED]);

/** FR-27 default-redaction placeholder. A single, greppable, self-describing marker string — never
 * `null`/`undefined` (which would be indistinguishable from "field genuinely absent on the record"). */
export const REDACTED_MARKER = '[REDACTED — independence-preserving default, FR-27; see --unredacted]';

const UNREDACTED_WARNING =
  'WARNING: --unredacted lifts FR-27 independence-preserving redaction — a not-yet-independently-' +
  "reviewed sibling record's reviewerId/decision/rationale are now visible. This flag exists for an " +
  'adjudicator or release-authorizer who legitimately needs the full picture (e.g. reviewing a ' +
  "disputed pair); using it elsewhere risks biasing a pending, not-yet-committed independent review " +
  'act (ADR-0004 decision item 4).\n';

/**
 * FR-12 (Clinical Review Workflow v1, Phase 3, P3-T2): the shared explanatory sentence naming the
 * `structurally-non-qualifying` derived state as the correct, by-design terminus for any
 * `synthetic: true` record set — never a defect (substrate FR-6, `lib/verbs/dry-run.mjs`'s own
 * `isExpectedTerminalNonQualifyingViolations`). Exported as a named constant so `validate`
 * (`lib/verbs/validate.mjs`) and `render` (`lib/render.mjs`) can reuse this EXACT wording — each
 * keeps its own verbatim, documented mirror rather than importing this one directly, because
 * importing FROM this file would either invert `lib/render.mjs`'s layering (a foundational `lib/*`
 * module depending on a `lib/verbs/*` verb handler) or reach back through `lib/verbs/dry-run.mjs`
 * (which this file already imports, and which itself imports `lib/verbs/validate.mjs`) into a
 * circular module dependency. Any wording drift between the copies is itself a finding, not a
 * routine edit.
 */
export const STRUCTURALLY_NON_QUALIFYING_TERMINUS_NOTE = 'This is the correct, by-design terminus ' +
  'for a fully synthetic:true record set (FR-6) -- not a defect.';

async function loadSchema() {
  return JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
}

/**
 * Splits a module's full (seq-ordered) committed record list into "effective" per-role acts — the
 * latest record for a role that no OTHER record's `supersedes` names, per FR-26's "effective act"
 * convention (a corrected/superseded record no longer represents that role's current position in
 * the turn-taking sequence, even though it stays on disk forever, append-only). A role with zero
 * effective records has simply not acted yet (the common case for every role beyond whatever the
 * chain has reached so far).
 *
 * @param {{ reviewId: string, seq: number, role: string, record: object }[]} allRecords
 * @returns {Map<string, { reviewId: string, seq: number, role: string, record: object }>}
 */
export function computeEffectiveRecordsByRole(allRecords) {
  const superseded = new Set();
  for (const entry of allRecords) {
    if (typeof entry.record?.supersedes === 'string') superseded.add(entry.record.supersedes);
  }
  const effectiveByRole = new Map();
  for (const entry of allRecords) {
    if (superseded.has(entry.reviewId)) continue;
    const existing = effectiveByRole.get(entry.role);
    if (!existing || entry.seq > existing.seq) effectiveByRole.set(entry.role, entry);
  }
  return effectiveByRole;
}

/**
 * The turn-taking half of this file's state machine (see this file's header) — computed ONLY from
 * which roles have an effective act on record and, for the disagree/adjudication branch, the ONE
 * shared `isAdjudicationRequired` predicate (`lib/adjudication.mjs`, FR-26/P1-T5 — reused verbatim
 * here rather than re-derived, so this file and `evaluateReleaseAuthorization` can never drift on
 * what "adjudication is required" means). This function never consults `blockers`/
 * `evaluateReleaseAuthorization` itself — it answers "whose turn is it" for the happy path only; the
 * caller (`run` below) is the one place that layers the shared derived-state result's `blockers` on
 * top to decide whether a computed "release-auth exists" position is actually
 * `acts-complete-unauthorized`, `structurally-non-qualifying`, or `invalid`.
 *
 * @param {Map<string, object>} effectiveByRole
 * @param {{ reviewId: string, seq: number, role: string, record: object }[]} allRecords the full
 *   module record set, passed through to `isAdjudicationRequired` unmodified (that function does
 *   its own effective-record resolution internally — see its own header)
 * @returns {{ derivedState: string|null, nextExpectedRole: string|null }} `derivedState` is one of
 *   `not-started`/`in-progress`/`disputed` for every pre-release-auth position; `null` once a
 *   release-auth act exists (the caller resolves the actual terminal label from `blockers`).
 */
export function computeTurnState(effectiveByRole, allRecords) {
  if (effectiveByRole.size === 0) {
    return { derivedState: 'not-started', nextExpectedRole: REVIEW_ROLES[0] };
  }
  const clinical1 = effectiveByRole.get('clinical-1');
  if (!clinical1) return { derivedState: 'in-progress', nextExpectedRole: 'clinical-1' };
  const clinical2 = effectiveByRole.get('clinical-2');
  if (!clinical2) return { derivedState: 'in-progress', nextExpectedRole: 'clinical-2' };
  const lab = effectiveByRole.get('lab');
  if (!lab) return { derivedState: 'in-progress', nextExpectedRole: 'lab' };

  const adjudication = effectiveByRole.get('adjudication');
  if (isAdjudicationRequired(allRecords) && !adjudication) {
    return { derivedState: 'disputed', nextExpectedRole: 'adjudication' };
  }

  const releaseAuth = effectiveByRole.get('release-auth');
  if (!releaseAuth) return { derivedState: 'in-progress', nextExpectedRole: 'release-auth' };

  // A release-auth act exists — this is a terminal position. Which terminal label applies is a
  // question for `blockers` (the ONE shared derived-state result), not for this function.
  return { derivedState: null, nextExpectedRole: null };
}

/**
 * Runs every check this verb needs to decide `invalid` vs. a trustworthy derived state: per-record
 * schema shape + D-4 roster resolution + FR-10 signature verification (mirrors `validate`'s own
 * per-record loop — status has no `--record` narrowing, so this always runs over the full module
 * set), plus the ONE shared `computeDerivedReviewState` module-wide result (P1-T1) for independence/
 * chain/authorship-union/release-authorization. Throws on a genuine tool-usage failure (malformed
 * YAML, an unreadable `--history` git walk, ...) exactly as `listModuleReviewRecords`/
 * `checkAppendOnlyHistory` already do — the caller (`run` below) is responsible for turning that into
 * an explicit `invalid` result rather than letting it crash uninformatively (FR-28).
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @param {{ history: boolean }} opts
 * @returns {Promise<{
 *   allRecords: object[], allViolations: string[],
 *   chainLinkageByReviewId: Map<string, object>, effectiveByRole: Map<string, object>,
 * }>}
 */
async function assessModule(rootDir, moduleId, { history }) {
  const allRecords = await listModuleReviewRecords(rootDir, moduleId);

  const schema = await loadSchema();
  const rosterIndex = await loadRosterIndex(rootDir);

  const perRecordViolations = [];
  const rosterVerifiedByReviewId = new Map();
  const resolvedRosterEntryByReviewId = new Map();
  for (const entry of allRecords) {
    for (const schemaError of validateAgainstSchema(schema, entry.record)) {
      perRecordViolations.push(`${entry.reviewId}: schema ${schemaError.path}: ${schemaError.message}`);
    }

    const reviewerId = entry.record?.reviewerId;
    if (typeof reviewerId === 'string') {
      try {
        const resolved = resolveReviewer(rosterIndex, reviewerId, moduleId);
        rosterVerifiedByReviewId.set(entry.reviewId, true);
        resolvedRosterEntryByReviewId.set(entry.reviewId, resolved);
      } catch (err) {
        rosterVerifiedByReviewId.set(entry.reviewId, false);
        perRecordViolations.push(`${entry.reviewId}: ${err.message}`);
      }
    } else {
      rosterVerifiedByReviewId.set(entry.reviewId, false);
    }

    const sigResult = verifyRecordSignature(entry.record);
    if (!sigResult.ok) perRecordViolations.push(`${entry.reviewId}: signature: ${sigResult.reason}`);
  }

  const authorship = computeAuthorshipUnion(rootDir, moduleId);
  const historyReport = history === true ? checkAppendOnlyHistory(rootDir, moduleId) : null;

  const derived = computeDerivedReviewState(allRecords, rosterVerifiedByReviewId, {
    resolvedRosterEntryByReviewId,
    authorship,
    historyReport,
    moduleId,
  });

  const allViolations = [...perRecordViolations, ...derived.blockers];
  const chainLinkageByReviewId = new Map(derived.chainReport.map((entry) => [entry.reviewId, entry]));
  const effectiveByRole = computeEffectiveRecordsByRole(allRecords);

  return { allRecords, allViolations, chainLinkageByReviewId, effectiveByRole };
}

/**
 * Builds the frozen `status --json` shape (unredacted; the caller applies `applyRedaction`). Never
 * throws — a computation failure is handled entirely by the caller (`run`), which substitutes an
 * explicit `invalid` result instead of calling this function.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @param {{ history: boolean }} opts
 * @returns {Promise<{
 *   moduleId: string, subjectContentHash: string|null, records: object[],
 *   derivedState: string, nextExpectedRole: string|null, blockers: string[],
 * }>}
 */
async function computeStatusResult(rootDir, moduleId, opts) {
  const { allRecords, allViolations, chainLinkageByReviewId, effectiveByRole } =
    await assessModule(rootDir, moduleId, opts);

  let derivedState;
  let nextExpectedRole;
  if (allViolations.length === 0) {
    const turn = computeTurnState(effectiveByRole, allRecords);
    if (turn.derivedState !== null) {
      derivedState = turn.derivedState;
      nextExpectedRole = turn.nextExpectedRole;
    } else {
      // release-auth exists and the ONE shared derived-state result found zero blockers: a
      // complete, chain-valid, roster-verified, non-synthetic set — FR-29's non-authorizing label.
      derivedState = ACTS_COMPLETE_UNAUTHORIZED;
      nextExpectedRole = null;
    }
  } else if (isExpectedTerminalNonQualifyingViolations(allViolations)) {
    // The ONE narrowly-matched, by-design, non-defect finding `dry-run` already recognizes (FR-6) —
    // reused verbatim rather than re-derived, so this file and `dry-run.mjs` can never drift on what
    // "the expected synthetic terminus" looks like.
    derivedState = 'structurally-non-qualifying';
    nextExpectedRole = null;
  } else {
    // Any other violation set — malformed shape, roster failure, chain break, signature tamper, an
    // append-only git-history failure, or a release-authorization defect that is NOT the single
    // expected synthetic finding — fails closed. Never guesses a role or a terminus over this input
    // (FR-28/F8, risk R13).
    derivedState = 'invalid';
    nextExpectedRole = null;
  }

  let subjectContentHash = null;
  if (allRecords.length > 0) {
    subjectContentHash = allRecords[allRecords.length - 1].record?.subjectContentHash ?? null;
  } else {
    try {
      subjectContentHash = await computeModuleContentHash(rootDir, moduleId);
    } catch {
      // No module content on disk yet (or an empty module dir) — not itself a review-record defect;
      // `not-started` with an unknown subject is a legitimate state, not a reason to fail closed.
      subjectContentHash = null;
    }
  }

  const records = allRecords.map((entry) => ({
    role: entry.role,
    review_id: entry.reviewId,
    reviewerId: entry.record?.reviewerId ?? null,
    decision: entry.record?.decision ?? null,
    rationale: entry.record?.rationale ?? null,
    synthetic: typeof entry.record?.synthetic === 'boolean' ? entry.record.synthetic : null,
    supersedes: entry.record?.supersedes ?? null,
    chainLinkage: chainLinkageByReviewId.get(entry.reviewId) ?? null,
  }));

  return { moduleId, subjectContentHash, records, derivedState, nextExpectedRole, blockers: allViolations };
}

/**
 * FR-27: applies (or lifts) independence-preserving redaction to an already-built status result.
 * Redaction is the DEFAULT — lifted only by an explicit `--unredacted` or once the record set has
 * reached a terminal disposition (the one lifting condition this identity-less tool can evaluate
 * globally; see this file's header). Never mutates `blockers`/`derivedState`/`nextExpectedRole` —
 * redaction is strictly a projection over `records[]`.
 *
 * @param {object} result `computeStatusResult`'s return shape (or the `invalid`-fallback equivalent)
 * @param {boolean} unredacted
 * @returns {object} the same shape, with `records[]` redacted unless lifted
 */
export function applyRedaction(result, unredacted) {
  if (unredacted === true || TERMINAL_STATES.has(result.derivedState)) {
    return result;
  }
  return {
    ...result,
    records: result.records.map((record) => ({
      ...record,
      reviewerId: REDACTED_MARKER,
      decision: REDACTED_MARKER,
      rationale: REDACTED_MARKER,
    })),
  };
}

/**
 * Human-readable companion to `--json` — names the next-expected role or the terminal state
 * explicitly (this task's own AC), and never renders a `blockers`-bearing (`invalid`) result as if
 * it had a trustworthy next-role/terminus.
 *
 * @param {object} result (already redaction-projected)
 * @param {boolean} unredacted
 * @returns {string}
 */
export function renderHumanOutput(result, unredacted) {
  const lines = [
    'Structural review-record state only -- not a clinical-validity, safety, or approval claim.',
    '',
    `Module: ${result.moduleId}`,
    `subjectContentHash: ${result.subjectContentHash ?? '(unknown -- no module content found on disk yet)'}`,
    `derivedState: ${result.derivedState}`,
  ];

  if (result.derivedState === 'invalid') {
    lines.push(
      'INVALID -- this record set fails one or more fail-closed checks validate would also reject on ' +
        '(FR-28); no next-expected role or terminal disposition can be reported over untrustworthy ' +
        'input. See blockers below.',
    );
  } else if (result.nextExpectedRole) {
    lines.push(`Next expected role: ${result.nextExpectedRole}`);
  } else {
    lines.push(`Terminal state reached (${result.derivedState}) -- no further role is expected.`);
    if (result.derivedState === 'structurally-non-qualifying') {
      lines.push(STRUCTURALLY_NON_QUALIFYING_TERMINUS_NOTE);
    }
    if (result.derivedState === ACTS_COMPLETE_UNAUTHORIZED) {
      lines.push(
        'This names ONLY that all required roles are structurally complete, chain-valid, and roster-' +
          'verified (FR-29) -- it is NOT a release-authorization, approval, or clinical-validity ' +
          'signal; a real cryptographic reviewer signature and G4 release authority both remain absent.',
      );
    }
  }

  if (result.blockers.length > 0) {
    lines.push('', 'blockers:');
    for (const blocker of result.blockers) lines.push(`  - ${blocker}`);
  }

  lines.push('', 'records:');
  if (result.records.length === 0) {
    lines.push('  (none -- no reviews/*.yaml committed yet for this module)');
  }
  for (const record of result.records) {
    const linkage = record.chainLinkage
      ? (record.chainLinkage.ok ? 'ok' : `BROKEN -- ${record.chainLinkage.reason}`)
      : 'unknown';
    lines.push(
      `  ${record.review_id} (${record.role}): reviewerId=${record.reviewerId} ` +
        `decision=${record.decision} synthetic=${record.synthetic} supersedes=${record.supersedes ?? 'null'} ` +
        `chainLinkage=${linkage}`,
    );
  }

  if (!unredacted && !TERMINAL_STATES.has(result.derivedState)) {
    lines.push(
      '',
      'NOTE: reviewerId/decision/rationale above are redacted by default while independence still ' +
        'matters (FR-27); pass --unredacted to lift (adjudicator/release-authorizer use only).',
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * @param {{ module?: string, root?: string, json?: boolean, history?: boolean, unredacted?: boolean }} options
 * @returns {Promise<number>}
 */
export async function run(options = {}) {
  const moduleId = options.module;
  if (typeof moduleId !== 'string' || moduleId.length === 0) {
    throw new UsageError('status requires --module <module_id>');
  }
  const rootDir = typeof options.root === 'string' && options.root.length > 0 ? options.root : process.cwd();
  const wantJson = options.json === true;
  const wantHistory = options.history === true;
  const wantUnredacted = options.unredacted === true;

  let result;
  try {
    result = await computeStatusResult(rootDir, moduleId, { history: wantHistory });
  } catch (err) {
    // Any genuine tool-usage failure while assessing the module (malformed YAML, an unreadable
    // --history git walk, ...) is itself proof this record set cannot be trusted -- fail closed with
    // an explicit `invalid` result rather than crashing uninformatively (FR-28/F8).
    result = {
      moduleId,
      subjectContentHash: null,
      records: [],
      derivedState: 'invalid',
      nextExpectedRole: null,
      blockers: [`status could not assess module "${moduleId}" -- ${err.message}`],
    };
  }

  const projected = applyRedaction(result, wantUnredacted);

  if (wantUnredacted === true) {
    process.stderr.write(UNREDACTED_WARNING);
  }

  if (wantJson) {
    process.stdout.write(`${JSON.stringify(projected, null, 2)}\n`);
  } else {
    process.stdout.write(renderHumanOutput(projected, wantUnredacted));
  }

  return projected.derivedState === 'invalid' ? EXIT_USAGE : EXIT_OK;
}
