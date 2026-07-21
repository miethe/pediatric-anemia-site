---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry Buildout: Upstream `rf` validators — pediatric extraction-completeness + exact-passage hard-gate"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-21
feature_slug: "evidence-foundry-buildout"
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
problem_statement: "The rf pediatric extraction schema and its exact-passage eligibility check are not enforced upstream in the research-foundry repository, so a converter-ineligible claim (missing pediatric_cds fields, or a threshold assertion lacking an exact passage/selector) can pass rf verify and only fail downstream, late, in this repo's converter."
open_questions: []
explored_alternatives: []
---

# DF-E1-03: Upstream `rf` validators — pediatric extraction-completeness + exact-passage hard-gate

**IMPORTANT — implementation target is out of repository.** This design spec documents a
*requirement this repository has of its upstream `rf` dependency*. It is not, and will never become,
an implementation task inside `pediatric-anemia-site`. The actual validator code, if built, lives in
the `research-foundry` repository (`agentic_meta_dev`'s sibling project). Routing this requirement
upstream is handled by the consolidated RFUP note authored under P7-T13:
`.claude/worknotes/evidence-foundry-buildout/rfup-external-routing-note.md`. This spec exists so the
requirement is not lost, not so that anyone opens a PR against this repository to satisfy it.

## Problem / Context

Section 3.6/3.7 of `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` defines a
`pediatric_cds` evidence-card extension block (`source_status`, `study`, `applicability`,
`laboratory`, `implementable_statement`, `diagnostic_accuracy`, `safety`, `conflict`, `lifecycle`) and
a companion "Fields required before a claim is converter-eligible" table (§3.7). Section 3.7's rule for
`implementable_statement.assertion_kind: threshold` claims is unambiguous: the claim MUST resolve to an
exact passage or locator/selector, or it is ineligible for rule drafting.

Today, `rf`'s core evidence-card schemas use `additionalProperties: true` (§3.6), which is exactly why
E0 was able to carry the `pediatric_cds` block at all without a schema change — but it also means `rf`
itself does nothing to check that block is present, complete, or internally consistent. `rf verify`
validates claims and source cards against `rf`'s own generic schema and warns on missing locators; it
does not hard-gate on the pediatric-specific completeness rules this repo actually needs. The Phase 6
capability ledger and gap register (`02` §6.1–§6.2) name this explicitly:

- Capability ledger, "Pediatric extraction extension" row: reuse/build = **Extend**, owner = `rf`,
  effort = M, deliverable = "Validated applicability/lab/threshold/lifecycle fields."
- Capability ledger, "Exact-passage eligibility check" row: reuse/build = **Extend**, owner = `rf`,
  effort = M, deliverable = "Threshold claims fail without passage/selector."
- Gap register: "Generic extraction schema" — missing pediatric population/assay/threshold/lifecycle
  fields; mitigation = "Add extension schema/validator"; blocks converter eligibility unless the
  extension is supplied by the run author instead.
- Gap register: "Exact passage not universally hard-gated" — `rf` validates claims/source cards and
  warns on locators, but generic cards may lack sufficient clinical passage precision; mitigation =
  "Add clinical eligibility check in converter **and** upstream validator." Blocks release-ready
  rules; does not block a research-only bundle.

The PRD (`docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md`, Deferred Items /
research-needs table) names this pair explicitly: **"Upstream `rf` validators (pediatric
extraction-completeness validator, exact-passage hard-gate)"**, effort **M**, citing `02` §6.1's
"Pediatric extraction extension" and "Exact-passage eligibility check" rows.

## Current State (what E0 actually does instead)

This buildout (E0) does not wait on the upstream fix. Per the decisions block and the converter design
(`02` §4.10, §4.11), the *downstream* half of the mitigation is built in this repository:

- `tools/rf-bundle-to-kb-pack/` enforces converter-eligibility itself, at conversion time, against the
  read-only `rf` bundle it consumes — it is the second half of the gap register's stated two-part
  mitigation ("clinical eligibility check in converter **and** upstream validator"). Only the converter
  half exists; the upstream half does not.
- A claim missing its `pediatric_cds` block, or a threshold claim missing an exact passage/selector,
  fails the converter's own eligibility check (traced to the rule-provenance sidecar and
  authoring-decision record for the affected rule) rather than being caught earlier at `rf verify`
  time in the `research-foundry` repository.
- Practically, this means: a malformed or incomplete pediatric extraction can still pass `rf verify`
  clean today, land in a bundle marked verified, and only be rejected once someone runs it through this
  repo's converter — later in the pipeline than the gap register's own two-part design intends.

This is an accepted, explicit gap for E0 (single hand-seeded run, `RF-CBC-001`, human-curated before
conversion) but is not acceptable at E1 scale, where multiple modules and less-curated runs increase
the chance an incomplete or imprecise pediatric card reaches conversion before anyone notices.

## Design Sketch (what upstream `rf` would need to add — not built here)

At a shaping level, the upstream change would add, inside the `research-foundry` repository:

- A formal JSON Schema (or schema extension) for the `pediatric_cds` block matching the shape in `02`
  §3.6, replacing today's `additionalProperties: true` permissiveness for this specific extension
  namespace, with required-field and type enforcement equivalent to what the converter currently
  checks post hoc.
- An `rf verify` exit-code path (or a new dedicated `rf`-level check) that hard-gates
  `implementable_statement.assertion_kind: threshold` claims lacking an exact passage/locator/selector
  — mirroring `02` §5.2's exit-code routing pattern so the failure surfaces as a standard `rf verify`
  non-zero exit rather than only being visible downstream.
- Because this is squarely an `rf`-project change, it is filed as one of the seven RFUP
  (Research-Foundry-Upstream) enhancements tracked under IntentTree work-area `RFUP`
  (`node_01KXRTYKKW9ECTF9MCBQ8JV1EB`) and `docs/project_plans/expansion/rf-handoff/README.md` §6 — see
  the consolidated routing note for the full list and routing mechanism
  (`.claude/worknotes/evidence-foundry-buildout/rfup-external-routing-note.md`, P7-T13). This spec does
  not duplicate that routing detail; it only documents the requirement's shape and rationale from this
  repository's side of the seam.

This repository's own converter-side check (`tools/rf-bundle-to-kb-pack/`) is **not** deferred and is
**not** part of this spec — it already exists as of Phase 2/3 of this plan. This spec covers only the
upstream half of the two-part mitigation the gap register calls for.

## Promotion Trigger

Per the deferred-items triage table (`docs/project_plans/implementation_plans/infrastructure/
evidence-foundry-buildout-v1.md`, DF-E1-03 row): **"RFUP routing yields an accepted upstream change."**
That is, this item is promoted out of "deferred" only once the `research-foundry` project accepts and
ships the pediatric-extraction-completeness validator and the exact-passage hard-gate as `rf`-side
changes — an event tracked in the `research-foundry` repository and its own CHANGELOG, not in this
repository's task tracker.

## Open Questions

None currently blocking — this item's only dependency is the RFUP routing itself completing
successfully upstream; there is no open design question on this repository's side of the seam. Any
future open question about the validator's exact schema shape belongs to the upstream `rf` project's
own design process, not this spec.
