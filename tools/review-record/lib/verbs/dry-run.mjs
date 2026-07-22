// tools/review-record/lib/verbs/dry-run.mjs — `dry-run` verb, real implementation (P2-T8, FR-11,
// ruling R4).
//
// Executes ONE full end-to-end synthetic dry-run of the ADR-0004 five-role review-record workflow:
// scaffold -> sign (TESTKEY-, P2-T5) -> chain-validate, in role order (`clinical-1`, `clinical-2`,
// `lab`, `adjudication`, `release-auth`), over one `subjectContentHash` shared by all five records.
// Every persona this verb resolves is a `synthetic: true`, clearly-labeled, NON-CREDENTIALED roster
// entry (`governance/reviewer-roster.yaml`'s P2-T8-added entries) — see this file's
// `DRY_RUN_PERSONAS` table below. This verb is the ONLY code path in this tool that composes
// `lib/verbs/scaffold.mjs`'s `buildDraftRecord` + `lib/signature.mjs`'s `signRecordDryRun` +
// `lib/store.mjs`'s `writeNewReviewRecordFile` directly — `scaffold` itself deliberately never
// writes a `synthetic: true` draft to disk (it owns no signing capability, see its own header);
// `dry-run` is that composition, exactly as `scaffold.mjs`'s header already names.
//
// STRUCTURAL NON-QUALIFYING TERMINAL STATE (FR-6, expected, not a bug): once all five records are
// written, `lib/verbs/validate.mjs`'s module-wide `evaluateReleaseAuthorization` check ALWAYS
// rejects a `release-auth` record over an all-`synthetic:true` set — "a release-auth record is
// valid only over a complete, chain-valid, roster-verified, NON-synthetic record set" (FR-6, D-4).
// This verb runs `validate` after every role's write (the "chain-validate ... in sequence" this
// task's own description names) and, after the FINAL (`release-auth`) write, expects EXACTLY that
// one FR-6 violation and no other — `isExpectedTerminalNonQualifyingViolations` below is the narrow,
// explicit check that draws the line between "the expected, structural, by-design non-qualifying
// outcome" and "a genuine defect this dry-run should fail closed on instead of silently accepting."
// Any other violation at any step — an unexpected schema/roster/chain/independence/authorship-union
// finding — propagates as a thrown `ValidationFailedError`, exactly like every other consumer of
// `validate` in this tool.
//
// APPEND-ONLY, NEVER RE-RUN: `dry-run` refuses (fails closed, `UsageError`) to run over a module
// that already has ANY committed review record — this store is append-only (OQ-2) and a dry-run is
// a one-time act per module, not an idempotent operation; running it twice would either silently no-
// op (dishonest — the second "run" would not actually redo anything) or attempt to overwrite
// existing history (exactly what this whole tool exists to prevent).
//
// Structural review-record content only -- not a clinical-validity, safety, or approval claim; see
// schemas/review-record.schema.json's own top-level description for the standing caveat every
// output of this tool carries.

import { REVIEW_ROLES, buildReviewId, listModuleReviewRecords, writeNewReviewRecordFile } from '../store.mjs';
import { nextChainLink } from '../chain.mjs';
import { loadRosterIndex, resolveReviewer } from '../roster.mjs';
import { buildDraftRecord } from './scaffold.mjs';
import { run as runValidate } from './validate.mjs';
import { signRecordDryRun } from '../signature.mjs';
import { computeModuleContentHash } from '../subject.mjs';
import { EXIT_OK, UsageError, ValidationFailedError } from '../errors.mjs';

/** Default target module for this task's own dry-run (P2-T8's binding scope: cbc_suite_v1). */
export const DEFAULT_DRY_RUN_MODULE_ID = 'cbc_suite_v1';

const SUBJECT_HASH_RE = /^sha256:[0-9a-f]{64}$/;

/**
 * The five synthetic, non-credentialed dry-run personas this verb resolves against
 * `governance/reviewer-roster.yaml` — one per ADR-0004 role, in `REVIEW_ROLES` order. Every
 * `rationale` explicitly states "SYNTHETIC"/"NOT A CREDENTIALED REVIEWER" (or the equivalent) and
 * that the record confers no clinical-validity, safety, or approval status — FR-28's honesty
 * posture, restated on the one artifact type most likely to be mistaken for a real review act (see
 * this program's own risk table). `clinical-1`'s and `clinical-2`'s rationale text is deliberately
 * NOT boilerplate-identical (both proven distinct, and independently proven clean of any >=20-char
 * shared substring, by `tests/ef-review-dryrun.test.mjs` via `lib/independence.mjs`'s own
 * `checkReviewerIndependence` heuristic) -- reusing one shared sentence verbatim across both would
 * itself trip the FR-4 textual-overlap heuristic, which cannot distinguish "shared boilerplate
 * framing" from "reviewer-2 read reviewer-1's content."
 */
export const DRY_RUN_PERSONAS = Object.freeze({
  'clinical-1': {
    reviewerId: 'dryrun-cbc-suite-clinical-1',
    rationale:
      'SYNTHETIC PERSONA -- NOT A CREDENTIALED REVIEWER. This is a workflow-mechanics exercise of ' +
      'the review-record chain (task P2-T8, FR-11); no clinician evaluated cbc_suite_v1 clinical ' +
      'content here, and this approve decision is a structural marker only, never a clinical-' +
      'validity or safety claim.',
  },
  'clinical-2': {
    reviewerId: 'dryrun-cbc-suite-clinical-2',
    rationale:
      "DRY-RUN TEST IDENTITY, NON-CREDENTIALED. Composed without reading the sibling clinical " +
      "record's content, per FR-4's structural independence guarantee; like it, this record only " +
      'exercises workflow mechanics (P2-T8) and makes no clinical assessment of the cbc_suite_v1 ' +
      'proposal.',
  },
  lab: {
    reviewerId: 'dryrun-cbc-suite-lab',
    rationale:
      'NON-CREDENTIALED SYNTHETIC PERSONA (laboratory-medicine role). Exercises the ADR-0004 ' +
      "chain's lab review act structurally only (FR-11 dry-run, task P2-T8); no assay, reference-" +
      'range, or specimen-handling content was actually evaluated by a credentialed laboratory-' +
      'medicine reviewer.',
  },
  adjudication: {
    reviewerId: 'dryrun-cbc-suite-adjudication',
    rationale:
      "SYNTHETIC ADJUDICATOR PERSONA -- NOT CREDENTIALED. Exercises PRD OQ-5's adjudicator-not-in-" +
      'authorship-union check (FR-5) and the chain\'s adjudication act (P2-T8); this persona is not, ' +
      'and does not claim to be, a member of the cbc_suite_v1 authorship union, and no genuine ' +
      'adjudicative judgment about proposal content occurred.',
  },
  'release-auth': {
    reviewerId: 'dryrun-cbc-suite-release-auth',
    rationale:
      'SYNTHETIC RELEASE-AUTHORIZATION PERSONA -- NOT CREDENTIALED. Exercises the terminal role of ' +
      'the ADR-0004 chain only (FR-11 dry-run, P2-T8) and is STRUCTURALLY NON-QUALIFYING for release ' +
      'authorization by design (FR-6): this entire five-record set is synthetic:true, so this record ' +
      "can never advance modules/cbc_suite_v1/module.json's status past unsigned-stub or populate " +
      'approvedBy[]/clinicalApprovers[].',
  },
});

/** Fixed decision recorded for every dry-run role — the demonstrative full-chain "reaches an
 * outcome" happy path this verb exists to exercise (FR-11); not a claim any of the five decisions
 * reflects real clinical or adjudicative judgment (see each persona's own rationale above). */
const DRY_RUN_DECISION = 'approve';

/**
 * @param {string|undefined} baseIso an RFC 3339 base timestamp (defaults to "now")
 * @param {number} roleIndex 0-based position in `REVIEW_ROLES`
 * @returns {string} `baseIso` offset by `roleIndex` minutes -- reflects five DISTINCT review acts
 *   executed in sequence within one dry-run invocation, never five identical timestamps.
 */
export function computeDryRunReviewedAt(baseIso, roleIndex) {
  const base = typeof baseIso === 'string' && baseIso.length > 0 ? new Date(baseIso) : new Date();
  if (Number.isNaN(base.getTime())) {
    throw new UsageError(`--reviewed-at "${baseIso}" is not a valid date-time`);
  }
  return new Date(base.getTime() + roleIndex * 60_000).toISOString();
}

/**
 * The one and only violation shape this verb ever treats as the expected, structural, by-design
 * terminal state (FR-6) rather than a dry-run failure -- see this file's header. Deliberately
 * narrow: any OTHER violation (wrong count, different wording, an additional unrelated finding)
 * fails this check, so a genuine defect elsewhere in the chain cannot hide behind this allowance.
 *
 * @param {string[]} violations `ValidationFailedError#violations`
 * @returns {boolean}
 */
export function isExpectedTerminalNonQualifyingViolations(violations) {
  if (!Array.isArray(violations) || violations.length !== 1) return false;
  const [only] = violations;
  return (
    only.includes('release-authorization is not valid')
    && only.includes('synthetic:true')
    && only.includes('(FR-6, D-4)')
  );
}

/**
 * @param {{
 *   module?: string, subject?: string, root?: string, reviewedAt?: string,
 * }} options
 * @returns {Promise<number>}
 */
export async function run(options = {}) {
  const moduleId = typeof options.module === 'string' && options.module.length > 0
    ? options.module
    : DEFAULT_DRY_RUN_MODULE_ID;
  const rootDir = typeof options.root === 'string' && options.root.length > 0 ? options.root : process.cwd();

  let subjectContentHash = options.subject;
  if (typeof subjectContentHash === 'string' && subjectContentHash.length > 0) {
    if (!SUBJECT_HASH_RE.test(subjectContentHash)) {
      throw new UsageError(`--subject "${subjectContentHash}" must match sha256:<64 hex>`);
    }
  } else {
    subjectContentHash = await computeModuleContentHash(rootDir, moduleId);
  }

  const existing = await listModuleReviewRecords(rootDir, moduleId);
  if (existing.length > 0) {
    throw new UsageError(
      `dry-run refuses to run over module "${moduleId}" -- it already has ${existing.length} ` +
        'committed review record(s) at modules/' + moduleId + '/reviews/. This store is append-only ' +
        '(OQ-2) and a dry-run is a one-time act, never a re-run: it never overwrites, supersedes, or ' +
        'silently no-ops over existing history. Use a different --module, or --root, if you intend a ' +
        'fresh dry-run pass.',
    );
  }

  const rosterIndex = await loadRosterIndex(rootDir);
  const written = [];

  for (let i = 0; i < REVIEW_ROLES.length; i += 1) {
    const role = REVIEW_ROLES[i];
    const persona = DRY_RUN_PERSONAS[role];
    const rosterEntry = resolveReviewer(rosterIndex, persona.reviewerId, moduleId);
    if (rosterEntry.synthetic !== true) {
      // Structural guard, not merely a convention: dry-run signing (lib/signature.mjs) itself
      // refuses to sign a non-synthetic record, so this would fail a few lines below regardless --
      // this check exists to fail with a clearer, dry-run-specific message first.
      throw new UsageError(
        `dry-run refuses to resolve reviewerId "${persona.reviewerId}" for role "${role}" -- its ` +
          'governance/reviewer-roster.yaml entry is synthetic:false. E1 dry-run signing is writable ' +
          'only onto synthetic:true records (OQ-6); this verb must never sign a real reviewer identity.',
      );
    }

    const { seq, previousRecordHash } = await nextChainLink(rootDir, moduleId);
    const reviewId = buildReviewId(seq, role);
    const reviewedAt = computeDryRunReviewedAt(options.reviewedAt, i);

    const draft = buildDraftRecord({
      moduleId,
      role,
      reviewId,
      subjectContentHash,
      previousRecordHash,
      supersedes: null,
      reviewerId: persona.reviewerId,
      decision: DRY_RUN_DECISION,
      rationale: persona.rationale,
      reviewedAt,
      synthetic: true,
    });
    const signed = signRecordDryRun(draft);
    const filePath = await writeNewReviewRecordFile(rootDir, moduleId, reviewId, signed);
    written.push({ role, reviewId, filePath, reviewerId: persona.reviewerId });

    // "chain-validate ... in sequence": after every write, re-run the module-wide validate pass
    // over everything committed SO FAR. Clean through the first four roles; the fifth (release-
    // auth) write always trips the one expected, structural FR-6 non-qualifying finding -- see
    // this file's header and isExpectedTerminalNonQualifyingViolations above.
    try {
      await runValidate({ module: moduleId, root: rootDir });
    } catch (err) {
      const isExpectedTerminal = role === 'release-auth'
        && err instanceof ValidationFailedError
        && isExpectedTerminalNonQualifyingViolations(err.violations);
      if (!isExpectedTerminal) throw err;
    }
  }

  process.stdout.write(
    `dry-run complete for module "${moduleId}" -- ${written.length} synthetic review record(s) ` +
      `written, chain-linked, TESTKEY--signed, and validated in sequence:\n` +
      written.map((w) => `  - ${w.role}: ${w.reviewId} (reviewerId "${w.reviewerId}")\n`).join('') +
      `subjectContentHash: ${subjectContentHash}\n\n` +
      'TERMINAL STATE (expected, structural, FR-6): the committed release-auth record is ' +
      'STRUCTURALLY NON-QUALIFYING for release authorization -- every record in this set is ' +
      'synthetic:true, and a release-auth record is valid only over a complete, chain-valid, ' +
      'roster-verified, NON-synthetic record set. This dry-run populates zero approver/' +
      'clinicalApprovers fields anywhere (schema-forced) and confers no clinical-validity, safety, ' +
      'or release-readiness status. Structural review-record content only.\n',
  );
  return EXIT_OK;
}
