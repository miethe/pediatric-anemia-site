// src/kbVerify.js — two-part manifest digest verifier.
//
// Implements SPIKE-006 Amendment 1's normative design
// (docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md, "Amended design —
// required amendments 1-6 applied (2026-07-21)"). Shared by scripts/sign-kb.mjs (Node, computes
// and writes the digests at release time) and, once EP5-T5 wires it in, server.mjs (Node,
// verifies at startup) and src/app.js (browser, via the static build — see
// scripts/check-app-imports.mjs and build-static.mjs's copied directory list, which is why this
// file and both its src/lib/ dependencies avoid any Node-only import).
//
// This module does no file I/O of its own. Every caller loads its own KB content — Node via
// node:fs, a browser via fetch() — and hands it in as plain data. That is what keeps this file
// runtime-agnostic instead of forking into a Node version and a browser version that could drift.
//
// AC-WP5-RESIL is the single most important behavioral property of this file: a missing/invalid
// `clinicalContentHash`, `governanceHash`, or `validationRunId`, or a `status` other than
// "integrity-recorded", must fail closed (not servable). A first release's `supersedes: null`
// and D-4's `approvedBy: []` are LEGITIMATELY empty and must never be conflated with those
// must-not-be-empty fields — `verifyManifest`'s return shape keeps the two categories in
// separate, non-overlapping keys (`mustNotBeEmpty` vs `legitimatelyEmpty`) so a caller cannot
// accidentally read one as the other.

import { canonicalize } from './lib/jcs.mjs';
import { sha256HexOfUtf8String } from './lib/digest.mjs';

export const CLINICAL_CONTENT_HASH_DOMAIN = 'pediatric-cds-clinical-content-v1';
export const GOVERNANCE_HASH_DOMAIN = 'pediatric-cds-governance-v1';

// Exactly Amendment 1's `governanceHash` field list. `clinicalContentHash`/`governanceHash`
// themselves are excluded to avoid self-reference; `id`/`title`/`schemaVersion`/`engineLabel`/
// `releasedAt` are excluded per the amendment's own exclusion list.
export const GOVERNANCE_FIELD_KEYS = Object.freeze([
  'status',
  'knowledgeBaseVersion',
  'evidenceReviewedThrough',
  'approvedBy',
  'validationRunId',
  'supersedes',
  'supportedAgeMonths',
]);

// SPIKE-006 RQ4's status enum. Only this value is servable.
export const READY_STATUS = 'integrity-recorded';

// EP5-T5 — manifest schemaVersion values this runtime knows how to verify. A manifest whose
// schemaVersion is not in this list is "incompatible" (docs/architecture.md §10's "UI and engine
// versions are incompatible" fail-closed condition, applied to the manifest shape itself) and
// must refuse to serve/build even if every hash matches — a matching digest says nothing about
// whether this code understands the shape it just verified.
export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze([1]);

/**
 * `clinicalContentHash` — SHA-256 over the JCS-canonicalized structure from Amendment 1: the
 * parsed JSON *values* of the four KB files, plus raw-byte SHA-256 hex digests of the two source
 * files that still hardcode clinical thresholds (`ranges.js`, `facts.anemia.js`).
 *
 * @param {{files: Array<{path: string, content: unknown}>, sourceFiles: Array<{path: string, sha256: string}>}} input
 * @returns {Promise<string>} `sha256:<hex>`
 */
export async function computeClinicalContentHash({ files, sourceFiles }) {
  const preimage = {
    domain: CLINICAL_CONTENT_HASH_DOMAIN,
    files: files.map(({ path, content }) => ({ path, content })),
    sourceFiles: sourceFiles.map(({ path, sha256 }) => ({ path, sha256 })),
  };
  const hex = await sha256HexOfUtf8String(canonicalize(preimage));
  return `sha256:${hex}`;
}

/**
 * `governanceHash` — SHA-256 over the JCS-canonicalized structure from Amendment 1's sibling
 * decision: `moduleId` plus exactly `GOVERNANCE_FIELD_KEYS` pulled off `fields`. A key that is
 * genuinely absent from `fields` (not merely explicit `null`) makes `canonicalize` throw —
 * deliberate: absence and an explicit `null` are different governance claims, and this repo's
 * existing validators (scripts/validate-kb.mjs) treat silent absence as a defect, never a
 * default.
 *
 * @param {{moduleId: string, fields: Record<string, unknown>}} input
 * @returns {Promise<string>} `sha256:<hex>`
 */
export async function computeGovernanceHash({ moduleId, fields }) {
  const selectedFields = {};
  for (const key of GOVERNANCE_FIELD_KEYS) selectedFields[key] = fields[key];
  const preimage = { domain: GOVERNANCE_HASH_DOMAIN, moduleId, fields: selectedFields };
  const hex = await sha256HexOfUtf8String(canonicalize(preimage));
  return `sha256:${hex}`;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function closedVerdict(reasons) {
  return {
    servable: false,
    status: null,
    reasons,
    hashes: null,
    mustNotBeEmpty: null,
    legitimatelyEmpty: null,
    schemaVersion: null,
    expiry: null,
  };
}

function isFiniteDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

const MILLIS_PER_DAY = 86_400_000;

/**
 * SPIKE-006 Amendment 4 — evidence-staleness expiry (docs/architecture.md §10's fifth fail-closed
 * condition). `policy` is a src/evidenceStalenessPolicy.js-shaped object.
 *
 * `policy.maxAgeDays === null` (the current, honest state — no human governance decision has been
 * made) means the check is NOT enforced. This function still returns a full verdict describing
 * that non-enforcement (`enforced: false` + a human-readable `reason`) rather than a bare boolean,
 * so a caller can disclose it loudly instead of a missing policy silently reading as "checked and
 * passed." `maxAgeDays` is never invented here — only read from `policy`.
 *
 * When `maxAgeDays` is set, this fails CLOSED: an unparseable `evidenceReviewedThrough` is treated
 * as expired (the staleness anchor is missing/invalid, so "not stale" cannot be established) —
 * never as "not enforced".
 *
 * @param {{evidenceReviewedThrough: unknown, policy: {maxAgeDays: number|null}, now?: Date}} input
 */
export function checkEvidenceExpiry({ evidenceReviewedThrough, policy, now = new Date() }) {
  const maxAgeDays = policy?.maxAgeDays ?? null;
  const reviewedThrough = evidenceReviewedThrough ?? null;

  if (maxAgeDays === null) {
    return {
      enforced: false,
      expired: false,
      reason: 'evidenceStalenessPolicy.maxAgeDays is null — no governance decision has set an '
        + 'evidence-staleness window (SPIKE-006 Amendment 4); the expiry check is NOT enforced.',
      maxAgeDays: null,
      evidenceReviewedThrough: reviewedThrough,
      ageDays: null,
    };
  }

  const reviewedThroughDate = new Date(reviewedThrough);
  if (!isFiniteDate(reviewedThroughDate)) {
    return {
      enforced: true,
      expired: true,
      reason: `evidenceReviewedThrough (${JSON.stringify(reviewedThrough)}) is missing or unparseable `
        + `while an evidence-staleness policy of maxAgeDays=${maxAgeDays} is set — failing closed.`,
      maxAgeDays,
      evidenceReviewedThrough: reviewedThrough,
      ageDays: null,
    };
  }

  const ageDays = (now.getTime() - reviewedThroughDate.getTime()) / MILLIS_PER_DAY;
  const expired = ageDays > maxAgeDays;
  return {
    enforced: true,
    expired,
    reason: expired
      ? `evidenceReviewedThrough (${reviewedThrough}) is ${ageDays.toFixed(1)} day(s) old, exceeding `
        + `the governance policy's maxAgeDays (${maxAgeDays}).`
      : `evidenceReviewedThrough (${reviewedThrough}) is ${ageDays.toFixed(1)} day(s) old, within the `
        + `governance policy's maxAgeDays (${maxAgeDays}).`,
    maxAgeDays,
    evidenceReviewedThrough: reviewedThrough,
    ageDays,
  };
}

/**
 * Recomputes both digests from the supplied KB content and compares them against `manifest`'s
 * stored values, returning a structured verdict rather than throwing on a normal verification
 * failure (missing field, hash mismatch) — the caller decides what "not servable" means for its
 * own surface (server.mjs refuses to start; the browser path would show a "no assessment
 * produced" state, per docs/architecture.md §10). Fails closed (`servable: false`) if anything
 * throws unexpectedly, so a bug in this function can never be mistaken for a passing
 * verification.
 *
 * Three optional inputs, each opt-in via presence (a caller that omits one gets today's original
 * behavior for it — this keeps every existing caller/test of this function unchanged):
 *   - `schemaErrors` — json-schema-lite-shaped `{path, message}[]` errors the CALLER already
 *     computed against schemas/module-manifest.schema.json. This function does not run schema
 *     validation itself (the schema validator lives under scripts/lib, which is not reachable
 *     from a browser build — see src/lib/jcs.mjs's header for why src/ code stays free of
 *     scripts/ imports); it only folds already-computed errors into the servability verdict.
 *   - `supportedSchemaVersions` — array of schemaVersion integers this runtime understands
 *     (SUPPORTED_SCHEMA_VERSIONS above). A manifest whose schemaVersion is not in this list is
 *     incompatible and refuses, independent of whether its hashes match.
 *   - `evidenceStalenessPolicy` — a src/evidenceStalenessPolicy.js-shaped `{maxAgeDays}` object.
 *     See `checkEvidenceExpiry` above: `maxAgeDays: null` means not enforced (and is disclosed as
 *     such in the returned `expiry` field, never silently treated as "checked and passed").
 *
 * @param {{
 *   manifest: object, moduleId: string, files: Array, sourceFiles: Array,
 *   schemaErrors?: Array<{path: string, message: string}>,
 *   supportedSchemaVersions?: number[],
 *   evidenceStalenessPolicy?: {maxAgeDays: number|null},
 *   now?: Date,
 * }} input
 */
export async function verifyManifest({
  manifest, moduleId, files, sourceFiles,
  schemaErrors = [],
  supportedSchemaVersions,
  evidenceStalenessPolicy,
  now = new Date(),
}) {
  try {
    if (!manifest || typeof manifest !== 'object') {
      return closedVerdict(['manifest is missing or is not an object']);
    }

    const recomputedClinicalContentHash = await computeClinicalContentHash({ files, sourceFiles });
    const recomputedGovernanceHash = await computeGovernanceHash({ moduleId, fields: manifest });

    const hashes = {
      clinicalContentHash: {
        stored: manifest.clinicalContentHash ?? null,
        recomputed: recomputedClinicalContentHash,
        matches: manifest.clinicalContentHash === recomputedClinicalContentHash,
      },
      governanceHash: {
        stored: manifest.governanceHash ?? null,
        recomputed: recomputedGovernanceHash,
        matches: manifest.governanceHash === recomputedGovernanceHash,
      },
    };

    const reasons = [];

    // --- Schema structural validity (caller-supplied — see doc comment above) -----------------
    for (const schemaError of schemaErrors) {
      reasons.push(`manifest is schema-invalid at ${schemaError.path}: ${schemaError.message}`);
    }

    // --- MUST-NOT-BE-EMPTY fields (AC-WP5-RESIL) --------------------------------------------
    if (!isNonEmptyString(manifest.clinicalContentHash)) {
      reasons.push('clinicalContentHash is missing — must-not-be-empty field');
    } else if (!hashes.clinicalContentHash.matches) {
      reasons.push('clinicalContentHash does not match the recomputed digest of the supplied KB content');
    }

    if (!isNonEmptyString(manifest.governanceHash)) {
      reasons.push('governanceHash is missing — must-not-be-empty field');
    } else if (!hashes.governanceHash.matches) {
      reasons.push('governanceHash does not match the recomputed digest of the supplied governance fields');
    }

    if (!isNonEmptyString(manifest.validationRunId)) {
      reasons.push('validationRunId is missing — must-not-be-empty field (Amendment 1: never invent one)');
    }

    if (manifest.status !== READY_STATUS) {
      reasons.push(`status is "${manifest.status ?? null}", must be "${READY_STATUS}" to serve`);
    }

    // --- Schema-version compatibility (opt-in — see doc comment above) ------------------------
    let schemaVersion = null;
    if (supportedSchemaVersions !== undefined) {
      const supported = supportedSchemaVersions.includes(manifest.schemaVersion);
      schemaVersion = { value: manifest.schemaVersion ?? null, supported, supportedVersions: supportedSchemaVersions };
      if (!supported) {
        reasons.push(
          `schemaVersion ${JSON.stringify(manifest.schemaVersion ?? null)} is not supported by this runtime `
            + `(supported: ${JSON.stringify(supportedSchemaVersions)})`,
        );
      }
    }

    // --- Evidence-staleness expiry (opt-in — see doc comment above / Amendment 4) -------------
    const expiry = evidenceStalenessPolicy !== undefined
      ? checkEvidenceExpiry({ evidenceReviewedThrough: manifest.evidenceReviewedThrough, policy: evidenceStalenessPolicy, now })
      : null;
    if (expiry?.expired) {
      reasons.push(`evidence is expired: ${expiry.reason}`);
    }

    const mustNotBeEmpty = {
      clinicalContentHash: isNonEmptyString(manifest.clinicalContentHash) && hashes.clinicalContentHash.matches,
      governanceHash: isNonEmptyString(manifest.governanceHash) && hashes.governanceHash.matches,
      validationRunId: isNonEmptyString(manifest.validationRunId),
      status: manifest.status === READY_STATUS,
    };

    // --- LEGITIMATELY-EMPTY fields — recorded, never treated as a failure ---------------------
    const legitimatelyEmpty = {
      approvedBy: Array.isArray(manifest.approvedBy) ? manifest.approvedBy : null,
      supersedes: manifest.supersedes ?? null,
    };

    return {
      servable: reasons.length === 0,
      status: manifest.status ?? null,
      reasons,
      hashes,
      mustNotBeEmpty,
      legitimatelyEmpty,
      schemaVersion,
      expiry,
    };
  } catch (error) {
    return closedVerdict([`verification threw unexpectedly: ${error && error.message ? error.message : String(error)}`]);
  }
}
