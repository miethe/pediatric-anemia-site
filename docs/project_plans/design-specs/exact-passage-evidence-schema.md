---
doc_type: design_spec
title: "Exact-Passage Evidence Schema / Locators"
status: draft
maturity: idea
created: 2026-07-18
feature_slug: platform-foundation-p0
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
---

# Exact-Passage Evidence Schema / Locators (DEF-3)

## Problem / Context

Every evidence record in `modules/anemia/evidence.json` (and its `src/evidence.js` counterpart,
see DEF-1) cites a source at the **document level** — `id`, `priority`, `year`, `title`,
`organization`, `journal`, `doi`, `url` — plus a free-text `supports` array of prose statements
(e.g. `"Ferritin thresholds of ≤20 ng/mL in young/school-aged children and ≤30 ng/mL in
adolescents and all menstruating patients"`). There is no structured pointer from a `supports`
statement, or from an individual rule's cited evidence, down to the **exact passage** (page,
table, paragraph, or quoted span) in the source document that substantiates it. A reviewer
verifying a rule's clinical grounding today must manually search the cited paper/guideline to find
the supporting passage.

`docs/architecture.md` §7 ("production-hardening additions") names exact-passage locators as one
of several planned hardening features (alongside typed facts and effective/retire dates), but none
of that has been implemented. The Deferred Items Triage Table categorizes this as **backlog**:
adding exact-passage locators requires designing a new evidence *content shape* (a schema/data
model addition), which is out of scope for Platform Foundation P0 — a **pure structural refactor**
whose contract was to relocate and register existing code/data paths without changing what the
data means or contains.

## Current State (what P0 actually shipped)

No locator concept exists anywhere in the shipped code:

- `modules/anemia/evidence.json` schema is `{ knowledgeBaseVersion, reviewedThrough, sources:
  [{ id, priority, year, title, organization, journal, doi, url, supports: [string, ...] }] }` —
  `supports` entries are unstructured prose, not `{ passage, page, section }`-shaped locators.
- `schemas/` (`assessment-output.schema.json`, `candidate.schema.json`, `patient-input.schema.json`,
  `rule.schema.json`) has no `evidence.schema.json` at all — evidence records are validated only
  implicitly, by `scripts/validate-kb.mjs` checking that every `rule.evidence[]` / `candidate.
  evidence[]` ID referenced actually exists in `evidenceIds` (a `Set` built from `evidenceData.
  sources.map(s => s.id)`). There is no per-statement or per-passage validation, because no such
  structure exists to validate.
- Rules (`modules/anemia/rules.json`) cite evidence only by source `id` (e.g. `"evidence":
  ["AAP2026_IDA"]`) — a whole-document reference, not a passage-level one. A rule's clinical
  rationale beyond the source ID/title is not machine-traceable at all today.

## Design Sketch

At an idea-stage level (a SPIKE, not a committed design, is still needed):

1. **New `passages[]` array per source**, each entry shaped roughly like `{ id, locator: { page?,
   table?, section? }, quote: string, supports: string[] }` — `quote` holds the verbatim (or
   near-verbatim, respecting fair-use/citation norms) text, `locator` gives a human-navigable
   pointer into the source document, and `supports` links the passage to the specific claim(s) it
   substantiates (replacing today's flat `supports: string[]` prose list on the source record).
2. **Rule/candidate references upgrade** from source-level (`"evidence": ["AAP2026_IDA"]`) to
   passage-level (`"evidence": [{ source: "AAP2026_IDA", passage: "AAP2026_IDA-p3-ferritin-
   threshold" }]` or similar) — a breaking schema change to `rule.schema.json` and `candidate.
   schema.json` that would ripple through every one of the 91 rules and 26 candidates, which is
   exactly why this needs a dedicated phase/WP rather than a P0 side-task.
3. **`schemas/evidence.schema.json`** (new file) formalizing the source/passage shape, validated by
   an extended `scripts/validate-kb.mjs` pass analogous to today's evidence-ID-existence check.

None of the above is committed; the SPIKE needs to determine whether passage-level quoting is
feasible under source licensing (AAP/WHO copyright), whether locators are structured (page/table
numbers) or free-text, and how big the 91-rule/26-candidate migration actually is before this
becomes a scoped work package.

## Promotion Trigger

Phase 1-WP3 (per the Deferred Items Triage Table).

## Open Questions

- Is verbatim quoting of AAP/WHO/other guideline text permissible under fair use for a research
  prototype, or must passages be paraphrased with a locator only (page/table/section) and no
  direct quote?
- Does passage-level evidence apply retroactively to all 91 existing rules and 26 candidates in
  one migration, or incrementally as rules are touched for other reasons?
- Does this schema change interact with DEF-1 (evidence dual-source unification) — should the
  passage schema be designed once, in the unified source, rather than twice (once in `src/
  evidence.js`, once in `modules/anemia/evidence.json`)?
- Who signs off on passage-locator accuracy — is this part of the existing "independent clinical
  review" gate in CLAUDE.md's hard guardrails, or a new review step?
- Does the SPIKE for this fold into or run separately from the DEF-2 tri-state fact model SPIKE,
  given both are "backlog" items gated on the Phase 1 roadmap kickoff?
