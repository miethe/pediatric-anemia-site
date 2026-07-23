// scripts/evidence/lib/cbc-002-projection.mjs -- RF-CBC-002 -> modules/cbc_suite_v1/ projection
// (multi-bundle-conversion-e1, Phase 4, row P4-T5, FR-7/FR-8, decisions block Risk 2 -- "the plan's
// single riskiest cell").
//
// This module builds the NEW content this pass appends to the already-committed
// modules/cbc_suite_v1/evidence.json and evidence-assertions.json (RF-CBC-001-derived, E0 vertical
// slice), and the collision detection that must pass before either file is ever touched. It never
// writes to disk itself -- ../backfill-cbc-002-evidence.mjs (the thin CLI wrapper) owns the actual
// reads/writes so every function here stays a pure, independently-unit-testable transform over
// already-loaded data (mirrors this repo's existing scripts/evidence/backfill-*-governance.mjs
// split between pure builder functions and a thin I/O-owning `main()`).
//
// modules/cbc_suite_v1/rules.json and authoring-decisions.yaml are NEVER touched by anything in
// this file -- no approved decision exists for any RF-CBC-002 claim (FR-14's converter boundary:
// no clinical Boolean logic may be inferred from prose without a human-authored
// authoring-decisions.yaml record, which this bundle does not have).
//
// ---------------------------------------------------------------------------------------------
// Collision policy (FR-7/FR-8, `02 doc` section 4.7's stable-identity rule for Source/Assertion)
// ---------------------------------------------------------------------------------------------
//
// Four id kinds are collision-checked against the RF-CBC-001-derived content already committed:
// `sourceId`, `assertionId`, `rfSourceCardId`, `rfClaimId`. Three of them are already
// bundle-scoped BY CONSTRUCTION and are checked as plain string equality:
//
//   - `rfSourceCardId` embeds the fixture-run marker literally (e.g. "src_..._rfcbc001_01" vs
//     "src_..._rfcbc002_01") -- a real collision here means the identical card string was minted
//     twice, a genuine defect.
//   - `sourceId` / `assertionId` are hand-chosen, human-readable strings (this module's own
//     SOURCE_DEFS below) -- a real collision here means two records were mistakenly given the
//     same identity.
//
// `rfClaimId` is DIFFERENT: `rf` claim ids are NOT globally unique across runs -- every `rf`
// bundle numbers its own claims `clm_001`, `clm_002`, ... from a fresh per-bundle namespace. RF-
// CBC-001 and RF-CBC-002 independently reuse the same `clm_NNN` numbers for entirely different
// claims about entirely different papers. Comparing bare `rfClaimId` strings across the two
// bundles would report a false collision for most claim numbers the two bundles happen to share,
// even though nothing is actually wrong -- and would make it structurally impossible to ever
// append a second bundle's claims to an existing bundle's assertions file, defeating this task's
// own purpose. The stable identity for `rfClaimId` is therefore the PAIR `(rfRunId, rfClaimId)`,
// never the bare claim id alone -- this is also exactly what "provenance must stay separable by
// rfRunId" (this task's own instruction) requires: rfRunId is the disambiguator, not incidental
// metadata.
//
// A collision of ANY kind, of ANY id kind, aborts the WHOLE merge -- see
// ../backfill-cbc-002-evidence.mjs's `main()`: both merged documents are built and collision-
// checked fully in memory before either `writeFile` call, so a collision produces zero writes to
// EITHER file, never a partial write to one.

export const RF_RUN_ID = 'rf_run_20260717_rf_cbc_002_pediatric_cds_establish';
export const RF_BUNDLE_ID = 'bundle_20260718_intent_research_20260717_rf_cbc_002';
export const FIXTURE_PATH = 'tests/fixtures/rf-cbc-002/';

// Mechanically derived review horizons -- verified equal to every RF-CBC-001 record already
// committed in modules/cbc_suite_v1/{evidence.json,evidence-assertions.json} before this task ran
// (schemas/evidence.schema.json#source.reviewBy / evidence-assertions.schema.json#assertion.reviewBy:
// module.json.evidenceReviewedThrough (2026-07-21) plus module.json.evidence_policy.recent_window_days
// (1825 days) for sources; a fixed 1-year horizon for assertions). Never invented; reused verbatim
// so RF-CBC-002 records carry the identical, already-established convention.
export const SOURCE_REVIEW_BY = '2031-07-20';
export const ASSERTION_REVIEW_BY = '2027-07-21';
export const SENTINEL_REVIEW_DATE = '2026-07-21';

// contentRights is identical across all 12 RF-CBC-002 source cards (verified against
// tests/fixtures/rf-cbc-002/HASH-PROVENANCE.md section 1 and every source card's own `usage`
// block) -- one shared constant rather than 12 copies of the same object.
const CONTENT_RIGHTS = Object.freeze({
  allowedForPublicOutput: false,
  allowedForWorkOutput: true,
  allowedForPersonalMeatywiki: true,
  citationRequired: true,
  quoteLimitNotes: 'Short excerpts only.',
});

// Hand-authored, reviewable sourceId + surveillance-query mapping (`02` doc section 4.7's
// stable-identity rule for Source), one entry per RF-CBC-002 source card, in fixture-file order.
// `priority` is mechanically "primary-current" for every entry: every RF-CBC-002 source's
// `published_at` (2022-02 through 2025-08) falls inside module.json's own 1825-day
// (evidence_policy.recent_window_days) recency window measured from evidenceReviewedThrough
// (2026-07-21 - 1825d = 2021-07-23) -- unlike RF-CBC-001, whose 2 oldest sources (2015, 2010) fell
// outside it. `surveillanceQuery` is a standing search-string only (schemas/evidence.schema.json's
// own description: "search-string authoring, not a clinical claim"), never a clinical fact.
export const SOURCE_DEFS = Object.freeze([
  {
    card: 'src_20260718_rfcbc002_00',
    id: 'BLOODADV2024_SAA_DELPHI_CONSENSUS',
    priority: 'primary-current',
    surveillanceQuery: 'modified Delphi consensus severe aplastic anemia diagnostic/response criteria update after 2024',
  },
  {
    card: 'src_20260718_rfcbc002_01',
    id: 'BJHAEM2024_BSH_AA_GUIDELINE',
    priority: 'primary-current',
    surveillanceQuery: 'British Society for Haematology adult aplastic anaemia guideline update after 2024',
  },
  {
    card: 'src_20260718_rfcbc002_02',
    id: 'BLOODADV2025_RCC_OBSERVATION_OUTCOMES',
    priority: 'primary-current',
    surveillanceQuery: 'refractory cytopenia of childhood long-term observation-only outcomes update after 2025',
  },
  {
    card: 'src_20260718_rfcbc002_03',
    id: 'BCMD2024_AIEOP_AA_GUIDELINE',
    priority: 'primary-current',
    surveillanceQuery: 'AIEOP pediatric acquired aplastic anemia guideline update after 2024',
  },
  {
    card: 'src_20260718_rfcbc002_04',
    id: 'PBC2024_PEDIATRIC_SAA_RECOMMENDATIONS',
    priority: 'primary-current',
    surveillanceQuery: 'pediatric severe aplastic anemia evidence-based treatment recommendations update after 2024',
  },
  {
    card: 'src_20260718_rfcbc002_05',
    id: 'LANCETHAEM2024_DBA_CONSENSUS',
    priority: 'primary-current',
    surveillanceQuery: 'Diamond-Blackfan anaemia international consensus statement update after 2024',
  },
  {
    card: 'src_20260718_rfcbc002_06',
    id: 'ASTCT2024_SAA_HCT_GUIDELINE',
    priority: 'primary-current',
    surveillanceQuery: 'ASTCT allogeneic HCT for severe aplastic anemia guideline update after 2024',
  },
  {
    card: 'src_20260718_rfcbc002_07',
    id: 'BLOOD2022_TBD_OUTCOMES',
    priority: 'primary-current',
    surveillanceQuery: 'telomere biology disorders disease progression and outcomes update after 2022',
  },
  {
    card: 'src_20260718_rfcbc002_08',
    id: 'FRONTIMMUNOL2022_PEDIATRIC_BMF_PROTOCOL',
    priority: 'primary-current',
    surveillanceQuery: 'protocolized pediatric bone marrow failure diagnostic evaluation update after 2022',
  },
  {
    card: 'src_20260718_rfcbc002_09',
    id: 'ADVCLINEXPMED2024_FA_CYTOGENETICS',
    priority: 'primary-current',
    surveillanceQuery: 'Fanconi anemia cytogenetic (MMC chromosome-breakage) diagnostic cohort update after 2024',
  },
  {
    card: 'src_20260718_rfcbc002_10',
    id: 'LEUKEMIA2024_IBMFS_PROTEOGENOMICS',
    priority: 'primary-current',
    surveillanceQuery: 'inherited bone marrow failure syndrome proteogenomic diagnostic update after 2024',
  },
  {
    card: 'src_20260718_rfcbc002_11',
    id: 'INDIANPEDIATR2022_IAP_AA_CONSENSUS',
    priority: 'primary-current',
    surveillanceQuery: 'Indian Academy of Pediatrics acquired aplastic anemia consensus update after 2022',
  },
]);

/** Extracts the SHA-256 hex digest from a redacted-quote string of the form
 * `[redacted -- content-rights: restricted (...); sha256:<hex>]` (the rights-restricted fallback
 * every RF-CBC-002 passage uses per tests/fixtures/rf-cbc-002/HASH-PROVENANCE.md section 1).
 * Fails closed (throws) rather than returning null on an unrecognized shape -- a passage whose
 * hash cannot be extracted must never silently produce an assertion with a wrong/missing hash. */
export function sha256FromRedactedQuote(quote) {
  const match = typeof quote === 'string' ? quote.match(/sha256:([0-9a-f]{64})/) : null;
  if (!match) {
    throw new Error(`sha256FromRedactedQuote: could not extract a sha256 hex digest from ${JSON.stringify(quote)}`);
  }
  return match[1];
}

/**
 * Builds the 12 NEW modules/cbc_suite_v1/evidence.json `sources[]` records this pass appends,
 * from the already-parsed RF-CBC-002 source-card frontmatters and claim ledger. Pure function --
 * no I/O -- directly unit-testable.
 *
 * @param {{ sourceCards: Array<{ path: string, frontmatter: object }>, claims: Array<object> }} loaded
 * @returns {Array<object>} 12 source records, in SOURCE_DEFS order (deterministic, never
 *   dependent on directory-listing or claim-ledger iteration order)
 */
export function buildNewSources({ sourceCards, claims }) {
  const cardsByCardId = new Map(
    sourceCards.map((card) => [card.frontmatter.source_card_id, card.frontmatter]),
  );

  return SOURCE_DEFS.map((def) => {
    const frontmatter = cardsByCardId.get(def.card);
    if (!frontmatter) {
      throw new Error(`buildNewSources: no source card loaded for "${def.card}" (SOURCE_DEFS entry "${def.id}")`);
    }
    const { source, trust, usage } = frontmatter;

    const supportingClaims = claims
      .filter((claim) => claim.status === 'supported' && claim.sources?.[0]?.source_card_id === def.card)
      .sort((a, b) => a.claim_id.localeCompare(b.claim_id));
    if (supportingClaims.length === 0) {
      throw new Error(`buildNewSources: "${def.card}" (${def.id}) has zero supported claims citing it`);
    }

    const supports = supportingClaims.map((claim) => `${claim.text.trim()} (${claim.claim_id}).`);

    const sentinelPassage = {
      id: `${def.id}#implementation-proposal`,
      sourceId: def.id,
      status: 'implementation-proposal',
      sourceLocator: {
        raw: 'Implementation-proposal sentinel: no located passage recorded in modules/cbc_suite_v1/evidence.json '
          + 'for this source. Exact-passage traceability for cbc_suite_v1\'s slice rules is recorded separately '
          + 'in modules/cbc_suite_v1/evidence-assertions.json (02 doc section 4.10, evidence-foundry-buildout '
          + 'P3-T3) rather than duplicated into this nested array; this sentinel exists only so a downstream '
          + 'consumer of this file\'s passages[] resolves to something explicit rather than nothing.',
        page: null,
        section: null,
        table: null,
        figure: null,
      },
      exactPassage: '',
      passageFidelity: 'paraphrase',
      evidence_item_type: 'bibliographic_metadata',
      judgment_basis: 'unassessed',
      judgment_basis_attestation: null,
      rights_component_class: 'bibliographic_metadata',
      structured_locator: {
        source: def.id,
        edition_or_version: null,
        section: null,
        table: null,
        row: null,
        column: null,
        assay_or_method: null,
        population_or_scope: null,
        retrieved_at: null,
        unresolved_components: [],
      },
      not_captured: [],
      reviewFlags: [],
      reviewFindingIds: [],
      evidenceGrade: null,
      applicability: { age: null, sex: null, assay: null },
      reviewDate: SENTINEL_REVIEW_DATE,
      supersedes: null,
      surveillanceQuery: def.surveillanceQuery,
      provenance: {
        runId: RF_RUN_ID,
        sourceCardId: def.card,
        evidenceId: 'implementation-proposal',
      },
    };

    const yearMatch = /^(\d{4})/.exec(source.published_at ?? '');
    if (!yearMatch) {
      throw new Error(`buildNewSources: "${def.card}" has an unparsable source.published_at "${source.published_at}"`);
    }

    return {
      id: def.id,
      rfSourceCardId: def.card,
      priority: def.priority,
      year: Number(yearMatch[1]),
      publicationDate: source.published_at,
      title: source.title,
      authors: source.authors,
      organization: source.publisher,
      journal: source.version ?? source.publisher,
      ...(source.locator?.doi ? { doi: source.locator.doi } : {}),
      url: source.locator?.url,
      limitations: trust.known_limitations ?? [],
      conflictsWith: trust.conflicts_with ?? [],
      contentRights: { ...CONTENT_RIGHTS, quoteLimitNotes: usage.quote_limit_notes ?? CONTENT_RIGHTS.quoteLimitNotes },
      license: {
        status: 'unknown',
        rights_holder: null,
        license_url: null,
        noncommercial_only: null,
        no_derivatives: null,
        government_basis: {
          government_work: null,
          government_funded: null,
        },
      },
      access_basis: 'unknown',
      terms: {
        incorporation_into_other_products: 'unknown',
        adaptation: 'unknown',
        commercial_use: 'unknown',
        redistribution: 'unknown',
        sublicensing: 'unknown',
      },
      terms_snapshot: {
        status: 'unknown',
        locator: null,
        sha256: null,
        retrieved_at: null,
      },
      supports,
      reviewBy: SOURCE_REVIEW_BY,
      surveillanceQuery: def.surveillanceQuery,
      supersessionStatus: 'not_superseded',
      passages: [sentinelPassage],
    };
  });
}

/**
 * Builds the 75 NEW modules/cbc_suite_v1/evidence-assertions.json `assertions[]` records -- one
 * per RF-CBC-002 "supported"-status claim (matches `evidence_bundle.yaml.counts.claims_supported`
 * exactly; every supported claim cites exactly one source card + evidence_id, per the fixture's
 * own claim_ledger.yaml shape). Pure function -- no I/O -- directly unit-testable.
 *
 * assertionId is minted as `evas_cbc002_clm_<NNN>` -- deliberately DIFFERENT from RF-CBC-001's
 * thematic `evas_cbc_<theme>_<NNN>` naming, both to avoid any risk of string collision and so the
 * bundle a given assertionId came from is legible on sight without a lookup.
 *
 * @param {{ sourceCards: Array<{ frontmatter: object }>, claims: Array<object> }} loaded
 * @returns {Array<object>} 75 assertion records, sorted by assertionId ascending (deterministic,
 *   never dependent on claim-ledger iteration order)
 */
export function buildNewAssertions({ sourceCards, claims }) {
  const cardsByCardId = new Map(
    sourceCards.map((card) => [card.frontmatter.source_card_id, card.frontmatter]),
  );
  const sourceIdByCard = new Map(SOURCE_DEFS.map((def) => [def.card, def.id]));

  const supportedClaims = claims.filter((claim) => claim.status === 'supported');

  const assertions = supportedClaims.map((claim) => {
    const claimSource = claim.sources?.[0];
    if (!claimSource) {
      throw new Error(`buildNewAssertions: supported claim "${claim.claim_id}" has no sources[0] entry`);
    }
    const { source_card_id: cardId, evidence_id: evidenceId, locator } = claimSource;

    const sourceId = sourceIdByCard.get(cardId);
    if (!sourceId) {
      throw new Error(`buildNewAssertions: claim "${claim.claim_id}" cites unknown source card "${cardId}"`);
    }
    const frontmatter = cardsByCardId.get(cardId);
    const point = frontmatter?.extracted_points?.find((p) => p.evidence_id === evidenceId);
    if (!point) {
      throw new Error(`buildNewAssertions: no extracted_points entry for "${cardId}"#"${evidenceId}" (claim "${claim.claim_id}")`);
    }

    const sha256Hex = sha256FromRedactedQuote(point.quote);
    const numberMatch = /^clm_(\d+)$/.exec(claim.claim_id);
    if (!numberMatch) {
      throw new Error(`buildNewAssertions: claim id "${claim.claim_id}" does not match "clm_<digits>"`);
    }
    const assertionId = `evas_cbc002_clm_${numberMatch[1].padStart(3, '0')}`;

    return {
      assertionId,
      rfRunId: RF_RUN_ID,
      rfSourceCardId: cardId,
      sourceId,
      rfEvidenceId: evidenceId,
      rfClaimId: claim.claim_id,
      passageId: `psg_${sha256Hex}`,
      locator: {
        raw: locator,
        page: null,
        section: locator,
        table: null,
        paragraph: null,
      },
      exactPassage: null,
      exactPassageSha256: `sha256:${sha256Hex}`,
      displayPolicy: 'hash_and_selector_only',
      claimStatus: 'supported',
      applicability: {
        ageRange: point.pediatric_cds?.population ?? null,
        sex: null,
      },
      laboratory: {
        analyzer: null,
        assayMethod: point.pediatric_cds?.assay_method ?? null,
      },
      reviewBy: ASSERTION_REVIEW_BY,
    };
  });

  assertions.sort((a, b) => a.assertionId.localeCompare(b.assertionId));
  return assertions;
}

/**
 * Collision-checks the new (RF-CBC-002-derived) sources/assertions against the existing (RF-CBC-
 * 001-derived) content already committed. See this file's header comment for the full rationale,
 * in particular why `rfClaimId` is checked as the pair `(rfRunId, rfClaimId)` rather than as a
 * bare string. Pure function -- no I/O -- directly unit-testable against a synthetic seeded
 * collision, independent of any real fixture or committed file.
 *
 * @param {{ existingSources: Array<object>, existingAssertions: Array<object> }} existing
 * @param {{ newSources: Array<object>, newAssertions: Array<object> }} incoming
 * @returns {Array<{ kind: string, value: string, detail: string }>} empty when there is no
 *   collision of any kind
 */
export function detectCollisions({ existingSources, existingAssertions }, { newSources, newAssertions }) {
  const collisions = [];

  const existingSourceIds = new Set(existingSources.map((s) => s.id));
  const existingSourceCardIds = new Set([
    ...existingSources.flatMap((s) => [s.rfSourceCardId, ...(s.duplicateRfSourceCardIds ?? [])].filter(Boolean)),
    ...existingAssertions.map((a) => a.rfSourceCardId).filter(Boolean),
  ]);
  const existingAssertionIds = new Set(existingAssertions.map((a) => a.assertionId));
  const existingRunClaimPairs = new Set(existingAssertions.map((a) => `${a.rfRunId} ${a.rfClaimId}`));

  for (const source of newSources) {
    if (existingSourceIds.has(source.id)) {
      collisions.push({ kind: 'sourceId', value: source.id, detail: 'modules/cbc_suite_v1/evidence.json already has a source with this id' });
    }
    if (existingSourceCardIds.has(source.rfSourceCardId)) {
      collisions.push({ kind: 'rfSourceCardId', value: source.rfSourceCardId, detail: 'this rfSourceCardId is already cited by existing committed content' });
    }
  }

  const seenNewAssertionIds = new Set();
  for (const assertion of newAssertions) {
    if (existingAssertionIds.has(assertion.assertionId) || seenNewAssertionIds.has(assertion.assertionId)) {
      collisions.push({ kind: 'assertionId', value: assertion.assertionId, detail: 'modules/cbc_suite_v1/evidence-assertions.json already has (or this batch duplicates) an assertion with this id' });
    }
    seenNewAssertionIds.add(assertion.assertionId);

    if (existingSourceCardIds.has(assertion.rfSourceCardId)) {
      collisions.push({ kind: 'rfSourceCardId', value: assertion.rfSourceCardId, detail: 'this rfSourceCardId is already cited by existing committed content' });
    }

    const pair = `${assertion.rfRunId} ${assertion.rfClaimId}`;
    if (existingRunClaimPairs.has(pair)) {
      collisions.push({
        kind: 'rfClaimId',
        value: assertion.rfClaimId,
        detail: `(rfRunId "${assertion.rfRunId}", rfClaimId "${assertion.rfClaimId}") already exists in existing committed content`,
      });
    }
  }

  return collisions;
}

/**
 * Raised by ../backfill-cbc-002-evidence.mjs when `detectCollisions` reports one or more
 * collisions. Names every collision explicitly (never a bare "collision detected") and is thrown
 * BEFORE either output file is written -- see that script's `main()` for the write ordering that
 * makes this a true no-partial-write guarantee.
 */
export class CollisionError extends Error {
  constructor(collisions) {
    const lines = collisions.map((c) => `  - ${c.kind} "${c.value}": ${c.detail}`);
    super(
      `RF-CBC-002 -> modules/cbc_suite_v1/ merge aborted: ${collisions.length} id collision(s) against the `
      + `existing (RF-CBC-001-derived) content -- NO file was written:\n${lines.join('\n')}`,
    );
    this.name = 'CollisionError';
    this.collisions = collisions;
  }
}

/**
 * Appends `newSources` after `existingSources`, verbatim-preserving the existing array's own
 * content and order (this pass "appends, never recreates" the existing file) and sorting only the
 * NEW slice deterministically by its own stable `id` -- never by claim-ledger iteration order,
 * directory-listing order, or any other incidental order (FR-7/FR-8's "keyed on stable IDs, never
 * array position").
 *
 * @returns {Array<object>}
 */
export function mergeSources(existingSources, newSources) {
  const sortedNew = [...newSources].sort((a, b) => a.id.localeCompare(b.id));
  return [...existingSources, ...sortedNew];
}

/** Same contract as `mergeSources`, for the assertions array. */
export function mergeAssertionsList(existingAssertions, newAssertions) {
  const sortedNew = [...newAssertions].sort((a, b) => a.assertionId.localeCompare(b.assertionId));
  return [...existingAssertions, ...sortedNew];
}

/**
 * Builds the full merged evidence-assertions.json document. `rfProvenance` (the document-level,
 * schema-required, singular field) stays BYTE-IDENTICAL to the existing document's own value --
 * it continues to describe RF-CBC-001, the bundle this file originally committed with, and is
 * never overwritten to describe RF-CBC-002 instead (that would silently misattribute every
 * existing RF-CBC-001 assertion's already-established provenance). The new run's own provenance is
 * instead recorded in the new, additive, OPTIONAL `additionalRfProvenance[]` array (schemas/
 * evidence-assertions.schema.json, extended this task) -- so provenance stays separable by rfRunId
 * (this task's own instruction) without disturbing the existing single-object shape every other
 * module (kidney_suite_v1, and anemia's own upcoming P4-T2 backfill) still relies on unmodified.
 *
 * @param {object} existingDoc the full existing evidence-assertions.json object
 * @param {Array<object>} newAssertions
 * @returns {object}
 */
export function mergeAssertionsDocument(existingDoc, newAssertions) {
  const existingAdditional = Array.isArray(existingDoc.additionalRfProvenance) ? existingDoc.additionalRfProvenance : [];
  const alreadyRecorded = existingAdditional.some((p) => p.rfRunId === RF_RUN_ID);

  return {
    ...existingDoc,
    additionalRfProvenance: alreadyRecorded
      ? existingAdditional
      : [
        ...existingAdditional,
        { rfRunId: RF_RUN_ID, rfBundleId: RF_BUNDLE_ID, fixturePath: FIXTURE_PATH },
      ],
    assertions: mergeAssertionsList(existingDoc.assertions, newAssertions),
  };
}

/**
 * Builds the full merged evidence.json document -- every top-level field except `sources` stays
 * byte-identical to the existing document (OQ-2: `knowledgeBaseVersion` is never bumped by this
 * pass).
 *
 * @param {object} existingDoc
 * @param {Array<object>} newSources
 * @returns {object}
 */
export function mergeEvidenceDocument(existingDoc, newSources) {
  return {
    ...existingDoc,
    sources: mergeSources(existingDoc.sources, newSources),
  };
}
