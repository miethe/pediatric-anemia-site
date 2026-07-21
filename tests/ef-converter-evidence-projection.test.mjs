// tests/ef-converter-evidence-projection.test.mjs — P3-T2: evidence.json enrichment (FR-12 first
// half, 02 §4.9).
//
// Task acceptance criteria (phase-3-5-projection-slice-manifest.md, row P3-T2):
//   1. "modules/cbc_suite_v1/evidence.json has >=1 source per slice-rule-supporting claim" —
//      asserted below by resolving every basis.rf_claim_ids entry across all four
//      modules/cbc_suite_v1/authoring-decisions.yaml records (walking one level of
//      inference_basis.from_claims for `status: inference` claims, since those carry no direct
//      `sources[]` of their own) to a real rf_source_card_id, then confirming that card is
//      present as a `sources[].rfSourceCardId` in evidence.json.
//   2. "every field the 02 §4.9 table marks required is present" — asserted via
//      `scripts/validate-kb.mjs`'s own schema + cross-record validator (the authoritative check;
//      this file also spot-checks a handful of the new 02 §4.9 fields directly).
//   3. "no journal value is synthesized from title/publisher (test-checked against the fixture's
//      actual bytes)" — asserted below: every `sources[].journal` value in
//      modules/cbc_suite_v1/evidence.json must equal, byte-for-byte, either the `source.version`
//      or the `source.publisher` field of the real fixture source card it was projected from
//      (`rfSourceCardId`) — never a value built by concatenating/slicing `title`.
//
// This file is deliberately NOT tests/ef-converter-invariants.test.mjs (P2-T8's seam task) — same
// convention tests/ef-converter-loader.test.mjs/tests/ef-converter-eligibility.test.mjs document
// for their own files.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseYamlDocument, parseYamlFrontmatter } from '../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';
import { validateEvidenceDocument } from '../scripts/validate-kb.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const MODULE_DIR = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function loadEvidence() {
  return readJson(path.join(MODULE_DIR, 'evidence.json'));
}

async function loadDecisions() {
  const text = await readFile(path.join(MODULE_DIR, 'authoring-decisions.yaml'), 'utf8');
  return parseYamlDocument(text);
}

async function loadClaimLedger() {
  const text = await readFile(path.join(FIXTURE_DIR, 'claims', 'claim_ledger.yaml'), 'utf8');
  const doc = parseYamlDocument(text);
  return new Map(doc.claims.map((claim) => [claim.claim_id, claim]));
}

async function loadSourceCard(sourceCardId) {
  const text = await readFile(path.join(FIXTURE_DIR, 'sources', `${sourceCardId}.md`), 'utf8');
  return parseYamlFrontmatter(text).frontmatter;
}

// Resolves a claim id to the set of real rf_source_card_id values that ground it: direct
// `sources[].source_card_id` for a `status: supported` (or otherwise directly-sourced) claim, or
// one level of `inference_basis.from_claims` -> direct sources for a `status: inference` claim
// (matching 02 §4.11's routing: an inference claim itself carries no `sources[]`).
function resolveClaimToSourceCardIds(claimId, claimsById) {
  const claim = claimsById.get(claimId);
  assert.ok(claim, `claim_ledger.yaml must contain a real claim for cited id "${claimId}"`);

  const direct = (claim.sources ?? []).map((s) => s.source_card_id);
  if (direct.length > 0) return new Set(direct);

  // Inference claim: walk one level of from_claims (each of which, in this fixture, is itself
  // directly sourced — 02 §4.11's basis.kind=implementation_proposal derivation edges).
  const fromClaims = claim.inference_basis?.from_claims ?? [];
  assert.ok(
    fromClaims.length > 0,
    `claim "${claimId}" has status "${claim.status}" but empty sources[] AND empty inference_basis.from_claims — nothing grounds it`,
  );
  const resolved = new Set();
  for (const parentId of fromClaims) {
    const parent = claimsById.get(parentId);
    assert.ok(parent, `inference_basis.from_claims cites unknown claim "${parentId}" (parent of "${claimId}")`);
    for (const s of parent.sources ?? []) resolved.add(s.source_card_id);
  }
  assert.ok(resolved.size > 0, `claim "${claimId}"'s inference_basis.from_claims resolved to zero real sources`);
  return resolved;
}

test('P3-T2: modules/cbc_suite_v1/evidence.json validates against schemas/evidence.schema.json with zero errors', async () => {
  const evidenceData = await loadEvidence();
  const evidenceSchema = await readJson(path.join(REPO_ROOT, 'schemas', 'evidence.schema.json'));
  const { errors } = validateEvidenceDocument(evidenceData, 'cbc_suite_v1', evidenceSchema);
  assert.deepEqual(errors, []);
});

test('P3-T2: every basis.rf_claim_ids entry in authoring-decisions.yaml resolves to >=1 evidence.json source', async () => {
  const [evidenceData, decisions, claimsById] = await Promise.all([
    loadEvidence(),
    loadDecisions(),
    loadClaimLedger(),
  ]);

  const projectedSourceCardIds = new Set();
  for (const source of evidenceData.sources ?? []) {
    if (source.rfSourceCardId) projectedSourceCardIds.add(source.rfSourceCardId);
    for (const dup of source.duplicateRfSourceCardIds ?? []) projectedSourceCardIds.add(dup);
  }
  assert.ok(projectedSourceCardIds.size > 0, 'evidence.json must project at least one source card');

  assert.equal(decisions.decisions.length, 4, 'expected exactly 4 authoring-decisions.yaml records (one per slice rule)');

  for (const decision of decisions.decisions) {
    const claimIds = decision.basis?.rf_claim_ids ?? [];
    assert.ok(claimIds.length > 0, `${decision.decision_id}: basis.rf_claim_ids must be non-empty`);

    for (const claimId of claimIds) {
      const sourceCardIds = resolveClaimToSourceCardIds(claimId, claimsById);
      const grounded = [...sourceCardIds].some((id) => projectedSourceCardIds.has(id));
      assert.ok(
        grounded,
        `${decision.decision_id}'s cited claim "${claimId}" resolves to source card(s) `
          + `[${[...sourceCardIds].join(', ')}], none of which is projected into `
          + 'modules/cbc_suite_v1/evidence.json sources[].rfSourceCardId',
      );
    }
  }
});

test('P3-T2: no evidence.json journal value is synthesized from title/publisher — each equals a real fixture byte-string (source.version or source.publisher)', async () => {
  const evidenceData = await loadEvidence();
  assert.ok(evidenceData.sources.length > 0);

  for (const source of evidenceData.sources) {
    assert.ok(source.rfSourceCardId, `${source.id}: missing rfSourceCardId — cannot verify journal against fixture bytes`);
    const card = await loadSourceCard(source.rfSourceCardId);

    // Never merely a copy of (or built from) the title.
    assert.notEqual(source.journal, source.title, `${source.id}: journal must not equal title`);
    assert.ok(!source.journal.includes(source.title), `${source.id}: journal must not embed the full title`);

    // Must equal, verbatim, either the fixture's own citation-shaped `version` string or its
    // `publisher` string — i.e. copied real bytes, never assembled from title fragments.
    const version = card.source?.version ?? null;
    const publisher = card.source?.publisher ?? null;
    const matchesRealFixtureField = source.journal === version || source.journal === publisher;
    assert.ok(
      matchesRealFixtureField,
      `${source.id}: journal "${source.journal}" must equal fixture source.version ("${version}") `
        + `or source.publisher ("${publisher}") from ${source.rfSourceCardId}.md`,
    );
  }
});

test('P3-T2: 02 §4.9 required-when-applicable fields are present (priority, authors, doi/url, limitations, contentRights, recencyNote when outside the five-year window)', async () => {
  const evidenceData = await loadEvidence();
  const modulePolicy = (await readJson(path.join(MODULE_DIR, 'module.json'))).evidence_policy;
  const recentWindowDays = modulePolicy.recent_window_days;
  const reviewedThrough = new Date(`${evidenceData.reviewedThrough}T00:00:00Z`);

  for (const source of evidenceData.sources) {
    assert.ok(typeof source.priority === 'string' && source.priority.length > 0, `${source.id}: priority required`);
    assert.ok(Array.isArray(source.authors) && source.authors.length > 0, `${source.id}: authors required`);
    assert.ok(source.doi || source.url, `${source.id}: at least one of doi/url required`);
    assert.ok(Array.isArray(source.limitations), `${source.id}: limitations must be an array (never hidden)`);
    assert.ok(source.contentRights && typeof source.contentRights === 'object', `${source.id}: contentRights required`);
    assert.ok(source.reviewBy, `${source.id}: reviewBy required (pediatric lifecycle field)`);
    assert.ok(source.surveillanceQuery, `${source.id}: surveillanceQuery required (pediatric lifecycle field)`);
    assert.ok(source.supersessionStatus, `${source.id}: supersessionStatus required (pediatric lifecycle field)`);

    const publicationYear = Number.parseInt(String(source.publicationDate ?? source.year), 10);
    const publicationDate = new Date(Date.UTC(publicationYear, 0, 1));
    const ageDays = (reviewedThrough - publicationDate) / (1000 * 60 * 60 * 24);
    if (ageDays > recentWindowDays) {
      assert.ok(
        typeof source.recencyNote === 'string' && source.recencyNote.length > 0,
        `${source.id}: outside the five-year (${recentWindowDays}-day) window per module evidence_policy — recencyNote is required`,
      );
    }
  }
});
