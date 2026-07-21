---
doc_type: design_spec
title: "Single-Source Rule Re-Anchoring"
status: draft
maturity: idea
created: 2026-07-21
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
---

# Single-Source Rule Re-Anchoring (DEF-R3)

## Problem / Context

The rights-governance-spec review findings (§3, corrected-blocking-picture accounting) record that
**44 of this project's 91 rules rest on a single source** — one *Blood* review article
(`BLOOD2022_PED_ANEMIA` in `modules/anemia/evidence.json`) — rather than on primary studies. This
is a real, pre-existing coverage gap in the knowledge base, not something the rights-aware-
evidence-capture feature introduces or fixes: EP-R0–EP-R5 ship the taxonomy and provenance
substrate that makes this fact *visible and countable* (via `rights/rights-records.json`'s
`RR-BLOOD2022_PED_ANEMIA` entry and the KB's own `sourcePassageId` linkage), not a re-synthesis of
the underlying clinical content.

Open question OQ-3 (decisions block §6) names the strategic question directly: re-anchoring those
44 rules onto primary studies would strengthen the facts-only axis and remove a single-source
dependency (spec §21.3's compilation-similarity concern), but at real re-synthesis cost — new
literature search, new evidence extraction, new passage capture, and re-review of every affected
rule. This feature makes **no** product-strategy decision about whether that cost is worth paying;
it only records that the dependency exists and is now machine-visible.

## Current State (what this feature actually shipped)

- `modules/anemia/evidence.json`'s `BLOOD2022_PED_ANEMIA` source entry and its passages are the
  single anchor for the 44 affected rules — unchanged by this feature.
- `rights/rights-records.json` seeds `RR-BLOOD2022_PED_ANEMIA` (one rights record for the *Blood*
  source) at `overall_status: UNKNOWN`, `review.review_status: agent_triage_only` — this feature's
  taxonomy makes the source-level rights position for this single point of failure explicit and
  gated, but does not touch which rules cite it or how many.
- No re-synthesis, re-anchoring, or new-source-discovery work is in scope for or performed by
  EP-R0–EP-R5. The count "44" is transcribed from the review findings, not recomputed here.

## Design Sketch

At an idea-stage level, a re-anchoring pass would need to:

1. **Confirm the current count.** A mechanical script over `modules/anemia/rules.json` /
   `sourcePassageId` linkage, cross-referenced against `modules/anemia/evidence.json#sources[]`,
   would recompute how many rules currently resolve their sole passage to `BLOOD2022_PED_ANEMIA` —
   a useful first step regardless of whether re-anchoring proceeds, since the 44 figure will drift
   as the KB changes.
2. **Prioritize by rule criticality.** `safetyClass` (`safety-critical` / `diagnostic` /
   `informational`, `docs/architecture.md` §7) is a natural sort key — a single-source dependency on
   a safety-critical rule is a higher-priority re-synthesis target than one on an informational
   note.
3. **Run new evidence discovery per prioritized rule** — this is Research Foundry (`rf`) territory,
   not a mechanical repo edit: a real literature search for primary studies supporting each
   threshold/pattern currently anchored only to the *Blood* review, following this project's
   existing evidence-capture taxonomy (`evidence_item_type`, `rights_component_class`, structured
   locators) rather than inventing a parallel capture path.
4. **Re-review affected rules** once new source-supported passages exist, following whatever
   clinical-review process this codebase's guardrails already require (independent clinical review
   + executable tests + signed release, per CLAUDE.md's hard guardrails) — re-anchoring a rule's
   evidence base is a content change, not a mechanical refactor, and should not bypass that review.
5. **Track partial completion.** Not every one of the 44 needs to move at once; a per-rule or
   per-cluster tracking mechanism (a coverage table, or an extension of the existing rule-coverage
   gate) would let this be incremental rather than all-or-nothing.

None of this is committed — the central open question (is the re-synthesis cost worth paying, and
on what timeline) is a product-strategy call this feature explicitly defers to OQ-3.

## Promotion Trigger

A product-strategy decision (OQ-3, decisions block §6) that the re-synthesis cost is worth paying.

## Open Questions

- Does re-anchoring proceed rule-by-rule, or does it wait for a broader evidence-refresh pass that
  might supersede *Blood* entirely for some threshold families?
- Is `rf` (Research Foundry) the intended discovery mechanism for the replacement primary studies,
  and if so, at what `depth`/`sensitivity` tier given this is clinical content?
- Does §21.3's compilation-similarity concern apply narrowly to the 44 rules, or more broadly to any
  future single-source anchor this project creates going forward — should a coverage gate flag new
  single-source dependencies as they're introduced, independent of whether these 44 are ever fixed?
- How does this interact with DEF-R5 (near-verbatim span re-authoring) — do any of the 44 rules'
  passages also appear on that allowlist, making them a shared re-capture seam?
