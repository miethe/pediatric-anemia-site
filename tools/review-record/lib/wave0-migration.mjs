// tools/review-record/lib/wave0-migration.mjs -- P1-T3 (Evidence Foundry E1 Phase 1, FR-2).
//
// Pure, import-safe mapping function proving the ruling in
// .claude/worknotes/evidence-foundry-e1-v1/contracts-design.md §(a): the wave0 EP7-T1 5-state
// review-record shape (schemas/review-record.schema.json as it existed before P1-T2 replaced it at
// the same path -- see git history at commit 268ea99, and the frozen reference copy at
// tests/fixtures/ef-review-record-migration/wave0-schema-reference.json) maps onto the canonical
// ADR-0004 five-role model P1-T2 landed. This module has NO side effects, performs NO filesystem or
// network access, and is safe to import from a test, a future tools/review-record/cli.mjs migration
// verb, or anywhere else -- node:crypto only, no other dependency.
//
// R5 reshape (contracts-design.md §a.1): wave0 modeled ONE mutable-until-terminal record per change
// proposal; the canonical model is ONE immutable file per review ACT (one per role). This module's
// job is exactly that reshape -- given one wave0-shaped record (in any of its 5 workflowState
// values), emit zero or more canonical review-record objects, one per decided reviewer, chained via
// previousRecordHash and sharing one subjectContentHash (contracts-design.md §a.2).
//
// D-4 (no synthetic/automated source may ever occupy a reviewer or approver position) is enforced
// HERE as a fail-closed guarantee, independent of whatever the wave0 schema may or may not have
// already prevented upstream (defense in depth, mirroring the three-layer guarantee this schema's
// own description names for the canonical model): any wave0 reviewer entry whose reviewerType !==
// "human" or attestedHuman !== true causes mapWave0RecordToCanonical to throw a Wave0MigrationError
// rather than silently emit an invalid, or worse a schema-valid-but-dishonest, canonical record.
// Silently dropping a poisoned identity would look, from the caller's perspective, indistinguishable
// from a seat nobody has decided on yet -- exactly the ambiguity a fail-closed system must not create.
//
// Every canonical record this module emits is marked `synthetic: true` with a `TESTKEY-` signature
// (mirroring the convention P1-T2's own committed fixtures already use under
// tests/fixtures/ef-review-records/) -- a migrated wave0 record is never asserted here to be a real,
// gate-cleared clinical review act. Nothing this module produces is, or may be read as, a
// clinical-validity, safety, or release-readiness claim.

import { createHash } from 'node:crypto';

/** wave0 workflowState values this module accepts as migration input (EP7-T1's closed 5-value enum). */
export const WAVE0_STATES = Object.freeze(['proposed', 'under-review', 'disputed', 'approved', 'rejected']);

/**
 * wave0 `reviewers[].role` -> canonical `role`, per contracts-design.md §a.3 item 5d: "Rough
 * correspondence only, not 1:1 semantics." ADR-0004's `lab` and `release-auth` roles have no wave0
 * analog at all -- this module never emits either from a migrated wave0 record.
 */
const WAVE0_ROLE_TO_CANONICAL_ROLE = Object.freeze({
  'primary-reviewer': 'clinical-1',
  'secondary-reviewer': 'clinical-2',
  'conflict-arbiter': 'adjudication',
});

/**
 * wave0 `reviewers[].decision` values that represent an actual decided act. `pending` (legitimate
 * during `under-review`) and `abstain` (contracts-design.md §a.3 item 5e: "DROPPED... no ADR-0004
 * role or E1 FR names abstention") never produce a canonical file -- there is no decided act to
 * migrate yet, which is the CORRECT mapping outcome for those two values, not a failure.
 */
const DECIDED_WAVE0_DECISIONS = new Set(['approve', 'reject', 'request-changes']);

/**
 * Fail-closed migration error. Thrown -- never returned, never silently swallowed -- whenever a
 * wave0 record cannot be honestly represented as a canonical review-record.
 */
export class Wave0MigrationError extends Error {
  constructor(message, { reviewerId } = {}) {
    super(message);
    this.name = 'Wave0MigrationError';
    if (reviewerId !== undefined) this.reviewerId = reviewerId;
  }
}

function assertHumanIdentity(reviewer) {
  if (reviewer.reviewerType !== 'human' || reviewer.attestedHuman !== true) {
    throw new Wave0MigrationError(
      'D-4 violation: wave0 reviewer entry does not carry reviewerType:"human" + attestedHuman:true '
        + `(reviewerId=${JSON.stringify(reviewer.reviewerId)}, reviewerType=${JSON.stringify(reviewer.reviewerType)}, `
        + `attestedHuman=${JSON.stringify(reviewer.attestedHuman)}) -- refusing to map this reviewer into a `
        + 'canonical review-record. This is a hard, fail-closed refusal, not a silent drop: dropping a poisoned '
        + 'identity would be indistinguishable, to a caller, from a seat nobody has decided on yet.',
      { reviewerId: reviewer.reviewerId },
    );
  }
}

// Deterministic key-order JSON serialization used only for this module's own internal hashing. Not
// a general-purpose canonicalizer and never asserted to match any future ADR-0005 canonicalization
// spec -- P2-T3's own hash-chain validator is the authoritative implementation of that.
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function sha256Hex(input) {
  return `sha256:${createHash('sha256').update(input).digest('hex')}`;
}

/**
 * Deterministic `subjectContentHash` for one wave0 record's migrated output set. Ties every
 * canonical role-file produced from the SAME wave0 record together -- a.2's "identical value across
 * the set" requirement -- derived only from the fields that identify the underlying proposal
 * (`proposalId`, `targetArtifacts`), never from anything reviewer-decision-specific, so every
 * migrated role-file for one proposal carries the same value regardless of which reviewer produced it.
 *
 * @param {object} wave0Record
 * @returns {string} `sha256:<64 hex>`
 */
export function computeSubjectContentHash(wave0Record) {
  const cp = wave0Record.changeProposal ?? {};
  return sha256Hex(stableStringify({
    proposalId: cp.proposalId ?? null,
    targetArtifacts: cp.targetArtifacts ?? [],
  }));
}

function slugifyModuleId(proposalId) {
  const slug = String(proposalId ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `ef_migrated_${slug || 'unknown'}`;
}

function buildCanonicalRecord({ moduleId, seq, role, subjectContentHash, previousRecordHash, reviewerId, decision, rationale, reviewedAt }) {
  const review_id = `rr-${String(seq).padStart(4, '0')}-${role}`;
  return {
    schemaVersion: 1,
    review_id,
    role,
    moduleId,
    subjectContentHash,
    previousRecordHash,
    supersedes: null,
    reviewerId,
    decision,
    rationale,
    reviewedAt,
    synthetic: true,
    signature: {
      algorithm: 'ed25519',
      keyId: `TESTKEY-ef-e1-p1t3-migration-${review_id}`,
      value: Buffer.from(`fake-migration-signature-${review_id}`).toString('base64'),
    },
  };
}

/**
 * Maps ONE wave0-shaped review record (any of the 5 `workflowState` values, `WAVE0_STATES`) onto
 * zero or more canonical review-record objects (schemas/review-record.schema.json, P1-T2), per
 * contracts-design.md §(a). Pure function: no filesystem/network access, does not mutate its input.
 *
 * Returns `[]` when the wave0 record legitimately has no decided review act yet (`proposed`, or
 * `under-review` while every reviewer is still `decision: "pending"`) -- per contracts-design.md
 * §a.3 item 4, "no file means no act yet" is the CORRECT canonical mapping for those states, not a
 * failure this function should report.
 *
 * Throws `Wave0MigrationError` (fail closed) if ANY decided reviewer fails the D-4 human-identity
 * check -- see `assertHumanIdentity` above. The check runs BEFORE any output for that reviewer is
 * constructed, and before later reviewers in the array are even considered, so a poisoned entry can
 * never be shadowed by a legitimate one that happens to appear after it.
 *
 * @param {object} wave0Record - a full wave0 EP7-T1-shaped review record.
 * @param {object} [options]
 * @param {string} [options.moduleId] - canonical `moduleId` for the mapped output (defaults to a
 *   deterministic slug derived from `wave0Record.changeProposal.proposalId`).
 * @returns {object[]} zero or more canonical review-record objects, expected to validate against
 *   schemas/review-record.schema.json.
 */
export function mapWave0RecordToCanonical(wave0Record, options = {}) {
  if (!wave0Record || typeof wave0Record !== 'object') {
    throw new Wave0MigrationError('mapWave0RecordToCanonical requires a wave0 record object');
  }
  if (!WAVE0_STATES.includes(wave0Record.workflowState)) {
    throw new Wave0MigrationError(`unrecognized wave0 workflowState: ${JSON.stringify(wave0Record.workflowState)}`);
  }

  const moduleId = options.moduleId ?? slugifyModuleId(wave0Record.changeProposal?.proposalId);
  const subjectContentHash = computeSubjectContentHash(wave0Record);

  const outputs = [];
  let previousRecordHash = null;
  let seq = 1;

  const reviewers = Array.isArray(wave0Record.reviewers) ? wave0Record.reviewers : [];
  for (const reviewer of reviewers) {
    if (!DECIDED_WAVE0_DECISIONS.has(reviewer.decision)) {
      // "pending" (under-review, no decision yet) and "abstain" (dropped from the canonical enum,
      // contracts-design.md §a.3 item 5e) never produce a canonical file.
      continue;
    }

    // D-4 fail-closed check BEFORE any output is constructed for this reviewer -- see module header.
    assertHumanIdentity(reviewer);

    const role = WAVE0_ROLE_TO_CANONICAL_ROLE[reviewer.role];
    if (!role) {
      throw new Wave0MigrationError(
        `wave0 reviewer role ${JSON.stringify(reviewer.role)} has no canonical mapping `
          + '(contracts-design.md §a.3 item 5d)',
        { reviewerId: reviewer.reviewerId },
      );
    }

    const record = buildCanonicalRecord({
      moduleId,
      seq,
      role,
      subjectContentHash,
      previousRecordHash,
      reviewerId: reviewer.reviewerId,
      decision: reviewer.decision,
      rationale: reviewer.comment && reviewer.comment.length > 0
        ? reviewer.comment
        : 'Migrated from a wave0 EP7-T1 record with no reviewer comment on file.',
      reviewedAt: reviewer.decidedAt,
    });

    outputs.push(record);
    previousRecordHash = sha256Hex(stableStringify({ ...record, signature: null }));
    seq += 1;
  }

  return outputs;
}
