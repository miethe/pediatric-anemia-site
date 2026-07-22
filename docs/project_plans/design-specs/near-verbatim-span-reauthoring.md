---
doc_type: design_spec
title: "Near-Verbatim Span Re-Authoring"
status: draft
maturity: idea
created: 2026-07-21
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
---

# Near-Verbatim Span Re-Authoring (DEF-R5)

## Problem / Context

`docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md` (the independent EP3-T5 passage-fidelity
audit) found that despite `passageFidelity: "paraphrase"`, several `evidence.json` passages share
8–13 contiguous words with restricted source text — a near-verbatim span, not a true paraphrase.
Eleven pre-existing spans are enumerated: `FDA2026_CDS#ev_002`–`#ev_005`; `BSH2020_G6PD#ev_003`,
`#ev_005`, `#ev_007`; and shorter ~7-word spans in `AAP2026_IDA#ev_005`, `CDC2025_LEAD#ev_001`,
`#ev_003`, `BSH2020_G6PD#ev_002`.

No task in the rights-aware-evidence-capture feature re-words these passages — re-authoring source
text with independent syntax and word order is a content-editing task requiring the same care as
any other clinical-content change, not a mechanical schema migration EP-R0–EP-R5 can absorb.
Instead, EP-R3's `tests/rights-negative-invariant.test.mjs` (D1's negative-invariant test) treats
these 11 spans as a **frozen, no-regression allowlist** — the test does not fail on day one because
these spans already exist, but it *does* assert every allowlisted span still resolves to a live,
identifiable passage, so a future re-authoring must actively remove an entry from the list rather
than let it go stale. `rights/rights-failures.json`'s `RF-EP3T5-F01-NEAR-VERBATIM-001` cross-links
this same audit finding into the rights substrate, forcing every affected passage to fall back to
the implementation-proposal sentinel (never bound as source-supported grounding) while it stays
open.

## Current State (what this feature actually shipped)

- `rights/rights-failures.json`'s `RF-EP3T5-F01-NEAR-VERBATIM-001` names the finding, its four
  affected source IDs (`FDA2026_CDS`, `BSH2020_G6PD`, `AAP2026_IDA`, `CDC2025_LEAD`), and its
  `product_impact`: "Affected passages fall back to the implementation-proposal sentinel and must
  not bind as source-supported grounding for any rule while this finding is open." `status: open`.
- Each of the four affected sources' `rights_record` in `rights/rights-records.json` carries this
  `rights_failure_id` in its `rights_failure_ids` array — bidirectionally cross-linked, verified by
  `scripts/validate-rights.mjs`'s `open-failure-presence` gate.
- No re-authoring of any of the 11 spans has been performed by this feature. The passage text in
  `modules/anemia/evidence.json` is unchanged.
- EP-R3's negative-invariant test (`tests/rights-negative-invariant.test.mjs`, per the plan's
  AC-WP3-NEGATIVE) is the mechanism that allowlists these 11 spans as no-regression rather than
  clean-slate — it had not yet landed as of this design-spec's authoring (EP-R3 is a later phase in
  the same plan); this spec documents the allowlist's intended shape and promotion path regardless
  of exact landing order.

## Design Sketch

At an idea-stage level, closing this out would mean:

1. **Re-author each of the 11 spans** with independent syntax and word order, preserving the
   necessary facts/numbers the audit confirms are load-bearing (e.g. FDA `#ev_004`'s 13-word shared
   span) without reproducing source phrasing — the audit's own remediation guidance
   ("Rewrite these passages with independent syntax and word order; retain necessary facts/numbers
   without reproducing source phrasing") is the working brief.
2. **Re-run the fidelity audit (or an equivalent mechanical check)** per re-authored passage to
   confirm the span no longer shares a disqualifying contiguous run with the source text.
3. **Remove the entry from the negative-invariant test's allowlist** once re-verified — the test
   should shrink, never merely stay static; a re-authored span left on the allowlist would be silent
   stale debt of exactly the kind this design spec exists to prevent.
4. **Close (or narrow) `RF-EP3T5-F01-NEAR-VERBATIM-001`** as spans clear, updating its affected-
   source list and eventually its `status` once every span tied to a given source is resolved —
   this is a `rights/` write, so it follows the same D6 discipline as any other rights-record
   update (no agent-authored `CLEARED_*`/clearance; re-verification of *fidelity*, not rights
   clearance, is what closes this specific finding, though the source's separate rights record may
   remain `UNKNOWN` independently).
5. **The natural home for this work is the EP-R3 re-capture seam** — re-wording touches the exact
   passages EP-R3's numerics re-capture and taxonomy work already handles, so doing both in one pass
   avoids touching the same evidence records twice.

None of this is committed. Re-authoring 11 spans without introducing new fidelity problems (e.g.
inadvertently strengthening/weakening claimed modality, per the audit's separate MEDIUM findings on
`CDC2025_LEAD#ev_002` and `WHO2024_HB#ev_003`) needs the same clinical-content care as any other
evidence-capture task.

## Promotion Trigger

Either (a) a re-authoring pass is scheduled at the EP-R3 re-capture seam, or (b) the negative-
invariant test's allowlist is observed to be non-shrinking across two consecutive phases, which
promotes this from "known debt" to "accumulating debt" per the plan's Deferred Items Triage Table.
DEF-R5 closes when the allowlist is empty.

## Open Questions

- Does re-authoring happen span-by-span as each is touched for unrelated reasons, or as one
  dedicated pass across all 11?
- Do the ~7-word spans (`AAP2026_IDA#ev_005`, `CDC2025_LEAD#ev_001`/`#ev_003`,
  `BSH2020_G6PD#ev_002`) need the same remediation urgency as the 8–13-word spans, or is there a
  length/materiality threshold below which a shared span is not actually fidelity-disqualifying?
- Who verifies a re-authored passage is a genuine paraphrase and not just a synonym-substituted
  near-verbatim span in a different disguise — a human review step, or can a mechanical
  longest-shared-span check (the kind the EP3-T5 audit itself used) do this reliably at scale?
- Does closing `RF-EP3T5-F01-NEAR-VERBATIM-001` for a source also require that source's
  `rights_record.overall_status` to move off `UNKNOWN`, or are fidelity resolution and rights
  clearance (DEF-R1) genuinely independent tracks that happen to share affected sources?
