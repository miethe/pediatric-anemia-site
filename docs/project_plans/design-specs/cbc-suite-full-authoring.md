---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry E1: Full CBC Suite Ontology, Typed Facts, Local Profile Contract, Rule Authoring (DF-E1-08)"
status: draft
maturity: shaping
created: 2026-07-22
updated: 2026-07-22
feature_slug: evidence-foundry-e1
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md
adr_refs:
  - docs/adr/0001-canonical-authoring-model-rule-schema-v2.md
problem_statement: "The CBC Suite's remaining modules need a full ontology, typed-fact model, local-profile contract, and rule-authoring workstream beyond the single hand-seeded cbc_suite_v1 vertical slice E0 shipped, but this is a sibling L-effort workstream this plan (evidence-foundry-e1-v1) never scoped to build, and whether it even trips ADR-0001's rule-schema-v2 migration trigger is an open, undecided reading (PRD OQ-7)."
open_questions:
  - "OQ-7 (evidence-foundry-e1-v1 PRD §12, status TBD (G0/orchestrator)): does full CBC Suite authoring under this item constitute ADR-0001's 'before multi-module E1 scale' rule-schema-v2 migration trigger, thereby re-triggering DF-E1-07 (property/mutation/semantic-diff CI expansion)? Neither evidence-foundry-e1-v1 nor this stub decides that reading — it is named here, unresolved, so a future plan does not have to rediscover it."
  - "Does this workstream author against the current rule.schema.json (v1 canonical authoring model) or wait for ADR-0001 to move to accepted and a v2 schema to land first — and if it waits, does that block CBC Suite module growth for the duration of the v2 migration?"
  - "What is the actual scope boundary between this item (ontology/typed facts/local profile contract/rule authoring) and DF-E1-02 (12-angle live research operation) — does this item consume DF-E1-02's discovery-lane output, or can rule authoring proceed against already-verified rf bundles independent of whether Path-B hardening lands first?"
explored_alternatives: []
---

# Full CBC Suite Ontology, Typed Facts, Local Profile Contract, Rule Authoring (DF-E1-08)

**Deferred-items triage row**: `DF-E1-08` (category `design`) in
`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md`'s Deferred Items
Triage Table, and the parallel row in
`docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md` §7's Deferred Items table
("Full CBC Suite ontology, typed facts, local profile contract, rule authoring (§7.3 item 7)").
**Promotion trigger**: own plan approved + the `OQ-7` rule-schema-v2 trigger reading decided.
**Effort class**: L (sibling workstream, per the PRD's own "may trip ADR-0001 v2 trigger" framing).

This is a **new stub authored under `evidence-foundry-e1-v1` P5-T9**, not a promoted or
partially-built spec. Nothing in this document commits to an implementation; it exists so the item
is not lost between plans, matching the same discipline the other `DF-E1-*` deferred-item specs
already follow.

## Problem / Context

`evidence-foundry-e1-v1`'s own scope statement is explicit that it builds only the clinical-
governance triad — review workflow (ADR-0004), signed preclinical release (ADR-0005), and
retrospective validation harness (ADR-0006) — "every human act modeled as an external gate, never a
task." It does not touch module content. E0 (`evidence-foundry-buildout-v1`) shipped exactly one
hand-seeded module, `modules/cbc_suite_v1/`, converted from one pre-verified `rf` bundle
(`RF-CBC-001`), with 4 rules — a vertical slice proving the deterministic converter tail, not the
start of a general CBC Suite authoring capability. The full CBC Suite, as scoped by
`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md`'s 12-angle research
operation (see `cbc-12-angle-research-operation.md`, `DF-E1-02`), still needs:

- A typed-fact ontology beyond the anemia module's existing tri-state fact model
  (`docs/project_plans/design-specs/tri-state-fact-model.md`) that generalizes to the remaining CBC
  angles (leukocyte, platelet, and combined-cytopenia patterns; see angles 6–8 in `DF-E1-02`'s
  problem statement).
- A local-profile contract for the CBC Suite analogous to what
  `docs/clinical/local-profile-charter-contract.md` and `schemas/terminology-profile.schema.json`
  already provide for terminology/reference-range ownership on the anemia side — extended, not
  reinvented, for the additional analytes and reference intervals the CBC Suite needs.
- A rule-authoring workstream that consumes converter-eligible `rf` bundles (per `DF-E1-02`'s
  discovery lane and `DF-E1-03`'s upstream validator, once each lands) and produces additional
  `modules/cbc_suite_v1/rules.json` (or new sibling module) content through the same
  `tools/rf-bundle-to-kb-pack/` converter tail, under the same human-review gates this plan (E1)
  built the machinery for.

Because this item is named as possibly tripping `ADR-0001`'s rule-schema-v2 migration trigger — the
same ADR that `DF-E1-07` (property/mutation/semantic-diff CI expansion) names under "Unblocks" —
its scope and this repository's schema-authoring posture are coupled in a way that is not yet
resolved. That coupling is the entire content of `OQ-7`, and is why this stub cannot commit to a
design sketch beyond naming the coupling.

## Current State

Nothing beyond E0's single-module `cbc_suite_v1` vertical slice exists. No typed-fact ontology
beyond the anemia module's tri-state model has been authored for CBC-Suite-wide use. No CBC-Suite-
specific local-profile contract exists (the existing `docs/clinical/local-profile-charter-contract.md`
/ `schemas/terminology-profile.schema.json` machinery is owned by a separate feature,
`arc-clinical-council-adoption-v1`, and is referenced here only as the closest analog). No rule-
authoring workstream beyond the E0 converter's single hand-seeded run has been scoped, staffed, or
planned. `ADR-0001` remains `status: proposed`, not `accepted`.

## Design Sketch

Not authored at this maturity. This item is `own plan approved`-gated: a future plan, sized and
scoped independently (the PRD's own "sibling L workstream" framing), is the artifact that would
carry a real design sketch. Attempting one here, before `OQ-7`'s reading is decided and before
`DF-E1-02`'s discovery-lane ADR (`ADR-0008`) and `DF-E1-03`'s upstream validator dependency have
their own trajectories clearer, would risk committing to a schema-authoring shape `ADR-0001`'s
eventual v2 migration could invalidate.

## Promotion Trigger

Per the Deferred Items Triage Table (both the `evidence-foundry-e1-v1` plan and PRD, `DF-E1-08`
row): **own plan approved + the `OQ-7` rule-schema-v2 trigger reading decided.** Both halves are
independent preconditions — a plan could in principle be approved before `OQ-7` is decided, but this
item does not promote out of `shaping` until both are true, because the schema-version question
`OQ-7` names directly shapes what "own plan" would need to scope.

## Open Questions

See frontmatter `open_questions`. Restated for readability:

1. Does full CBC Suite authoring under this item constitute `ADR-0001`'s "before multi-module E1
   scale" rule-schema-v2 migration trigger, thereby re-triggering `DF-E1-07`? This is `OQ-7` from
   the `evidence-foundry-e1-v1` PRD, carried here unresolved — the orchestrator ruling it calls for
   has not been made by either plan.
2. Does this workstream author against the current `schemas/rule.schema.json` (v1) or wait for
   `ADR-0001` to reach `accepted` and a v2 schema to land first?
3. What is the actual scope boundary between this item and `DF-E1-02` (12-angle live research
   operation) — does rule authoring here depend on `DF-E1-02`'s discovery lane landing first, or can
   it proceed against already-verified `rf` bundles independently?
