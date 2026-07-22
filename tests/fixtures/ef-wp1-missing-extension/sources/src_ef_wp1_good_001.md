---
schema_version: '0.1'
type: source_card
source_card_id: src_ef_wp1_good_001
created_at: '2026-07-21T00:00:00-04:00'
created_by_agent: synthetic-test-fixture
sensitivity: personal
source:
  title: "Synthetic source (EF-WP1 test fixture) — fully carded, control case"
  source_type: paper
  published_at: "2026-01"
trust: {source_rank: primary, reliability_notes: "Synthetic test fixture; not a real source."}
usage: {allowed_for_public_output: false, allowed_for_work_output: true, allowed_for_personal_meatywiki: true, citation_required: true}
extracted_points:
- evidence_id: ev_001
  locator: "Section 1"
  summary: "Synthetic evidence point with a fully-populated pediatric_cds extension block."
  quote: "A real, non-redacted synthetic passage of text used only by this test fixture."
  supports_potential_claims: []
  pediatric_cds:
    population: "Pediatric patients under 18 years (synthetic test population)"
    assay_method: "Automated hematology analyzer (synthetic)"
    threshold: {value: "0.5", units_ucum: "10*9/L"}
    lifecycle: {effective: "2026-01", retire: null}
    classification: source_supported_fact
---
Synthetic source card body — control case, carries the required `pediatric_cds` extension on its
one extracted point. Used by tests/ef-wp1-eligibility.test.mjs as the "good" card alongside the
deliberately-seeded "bad" card (src_ef_wp1_missing_ext_001.md) in the same fixture tree.
