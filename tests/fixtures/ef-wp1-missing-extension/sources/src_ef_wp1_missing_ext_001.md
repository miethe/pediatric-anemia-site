---
schema_version: '0.1'
type: source_card
source_card_id: src_ef_wp1_missing_ext_001
created_at: '2026-07-21T00:00:00-04:00'
created_by_agent: synthetic-test-fixture
sensitivity: personal
source:
  title: "Synthetic source (EF-WP1 test fixture) — SEEDED DEFECT: missing pediatric_cds extension"
  source_type: paper
  published_at: "2026-01"
trust: {source_rank: primary, reliability_notes: "Synthetic test fixture; not a real source. Deliberately seeded WITHOUT a pediatric_cds extension block on its extracted point (EF-WP1 fail-closed test, P2-T2)."}
usage: {allowed_for_public_output: false, allowed_for_work_output: true, allowed_for_personal_meatywiki: true, citation_required: true}
extracted_points:
- evidence_id: ev_001
  locator: "Section 1"
  summary: "Synthetic evidence point deliberately seeded WITHOUT a pediatric_cds extension block."
  quote: "A real, non-redacted synthetic passage of text used only by this test fixture."
  supports_potential_claims: []
---
Synthetic source card body — SEEDED DEFECT: this card's only extracted point carries no
`pediatric_cds` extension block at all. `tests/ef-wp1-eligibility.test.mjs` asserts that the
EF-WP1 structural pre-flight gate (`tools/rf-bundle-to-kb-pack/lib/eligibility.mjs`,
`checkPediatricCdsExtensionPresence`) rejects the bundle containing this card, naming this card's
`source_card_id` (`src_ef_wp1_missing_ext_001`) exactly, before any `propose` output is ever
written to disk.
