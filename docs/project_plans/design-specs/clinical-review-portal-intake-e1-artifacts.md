---
schema_version: 2
doc_type: design_spec
title: "Clinical Review Portal: Intake of This Pass's Conflict Objects, unresolved.json, and Candidate Scaffolds (DF-E1-M2)"
status: draft
maturity: idea
created: '2026-07-22'
updated: '2026-07-22'
feature_slug: "multi-bundle-conversion-e1"
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
adr_ref: docs/adr/0004-clinical-approval-identity-adjudication.md
problem_statement: "This pass produced named conflict objects, per-module unresolved.json enumerations, and a defined-but-not-yet-instantiated candidate-scaffold artifact type -- all of it evidence-adjacent output a future named human reviewer would need to triage, but neither a reviewer roster, a review-state model, nor a portal application exists yet (ADR-0004 status: proposed) to receive any of it."
open_questions: []
explored_alternatives: []
---

# Clinical Review Portal: Intake of This Pass's Conflict Objects, `unresolved.json`, and Candidate Scaffolds (DF-E1-M2)

## What this document is, and is not

This is an **idea-maturity sketch of a future intake surface**, not a portal design and not a
committed data contract. Per this task's own instruction and the Deferred Items Triage Table entry
it answers (`DF-E1-M2` in
`docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md`), this spec
stays at `maturity: idea` until two things land that do not exist today: **ADR-0004
(`docs/adr/0004-clinical-approval-identity-adjudication.md`, `status: proposed`) accepted**, and
**named credentialed reviewer roles**. Neither exists. Nothing here builds, schedules, or authorizes
a portal, a reviewer roster, or a review-state model.

`docs/project_plans/design-specs/clinical-review-portal-workflow.md` (`DF-E1-01`) already covers the
review-state machine (`proposed` -> `under-review` -> `disputed`/`approved`/`rejected`) and role
vocabulary (`primary-reviewer`, `secondary-reviewer`, `conflict-arbiter`) that a portal would use once
built, seeded from `schemas/review-record.schema.json`. **This spec does not re-derive that model.**
Its scope is narrower and complementary: given that review-state machine, what specifically would the
portal need to *read in* from this pass's actual, on-disk output — the concrete artifact types this
one batch conversion pass produced, not a generic "clinical evidence" abstraction? That is the gap
`DF-E1-M2` names and this document answers.

**No portal exists. No reviewer has seen any of this pass's output.** Every module this pass touched
or scaffolded (`modules/anemia/`, `modules/kidney_suite_v1/`, `modules/growth_suite_v1/`,
`modules/cbc_suite_v1/`) still carries `status: "unsigned-stub"`, `approvedBy: []`,
`clinicalContentHash: null`. Nothing in this document changes that.

## Problem / Context

`docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md` §5 names the gap directly, in
its own persona table: a "Secondary Persona: Future clinical reviewer (E1+, this feature's downstream
consumer, not its user)" who "will eventually review `unresolved.json`, conflict objects, and
candidate scaffolds this pass produces, once the clinical-review-portal (`DF-E1-01`, ADR-0004)
exists." This spec exists to make that "eventually" concrete: name the exact files, their exact
shapes as this pass actually produced them, and where they diverge from each other — because two of
the three artifact types below were produced by two independent, ad hoc scripts, not a single shared
generator, and already disagree with each other on field names.

FR-11/FR-12 of that same PRD (design doc `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md`
§2.3 invariant 8, §4.17) are the binding rules this pass's artifacts satisfy: every `mixed`/
`contradicted` claim must be preserved as an explicit, named, multi-source conflict object — never
averaged, never silently resolved to one source — and every eligible-but-unrouted claim must be
enumerated in the owning module's `unresolved.json` with its specific deferral reason. A clinical
review portal's intake surface is precisely the consumer these two requirements were written for: a
named human reviewer, not a converter or a downstream engine, is the only actor permitted to resolve
either kind of record.

## Artifact inventory: what this pass actually produced (the real intake surface)

Per this task's binding provenance constraint (`karen` P6-GATE2 finding, recorded in
`.claude/findings/multi-bundle-conversion-e1-findings.md`): **only `RF-CBC-002` -> `cbc_suite_v1`
completed the committed converter's `inspect -> verify -> propose` pipeline end-to-end.** The other
three bundles (`RF-EV-001` -> `anemia`, `RF-KID-001` -> `kidney_suite_v1`, `RF-GRO-002` ->
`growth_suite_v1`) halt at `inspect` with `DecisionsNotFoundError`
(`tools/rf-bundle-to-kb-pack/lib/batch.mjs`) because no `authoring-decisions.yaml` exists for them
yet (Deferred Item `DF-E1-M1`). Their committed evidence-layer files were instead produced by bespoke,
mostly-uncommitted one-off generator scripts that mimic the converter's intended output shape — a
distinct, already-flagged gap
(`.claude/findings/multi-bundle-conversion-e1-findings.md`, "Unreproducible-provenance gap"). **A
future portal's intake layer must carry this distinction as first-class metadata, not lose it**: a
record's provenance (converter-derived vs. hand-derived-projection) changes how much a reviewer should
trust its shape and completeness, independent of the clinical content itself.

| Artifact type | Where it lives today | Which module(s) | Provenance | Instance count |
|---|---|---|---|---|
| Named conflict object | `modules/<id>/unresolved.json`, entries with `entryKind: "conflict"` (kidney) or `kind: "named_conflict"` (growth) | `kidney_suite_v1` (1), `growth_suite_v1` (1) | **Hand-derived** — produced by an uncommitted one-off script per module, not by `propose.mjs` (which never ran for these modules; `DecisionsNotFoundError` at `inspect`) | 2 total |
| Deferred/eligible-but-unrouted claim entry | `modules/<id>/unresolved.json`, entries with `entryKind: "claim"` (kidney) or `kind: "deferred_claim"` (growth) | `kidney_suite_v1` (65 claim entries as of this writing), `growth_suite_v1` (79 `supported`-status + 10 `inference`-status entries) | **Hand-derived**, same generators as above | ~154 total across the two modules |
| Candidate scaffold | `build/kb-pack/<module_id>/<pack_version>/candidate-scaffolds.json` (FR-10's designated staging path; never merged into any module's runtime `candidates.json`) | **None yet** — no bundle in this pass produced one | **N/A — artifact type is wired into the aggregate report shape (`multi-bundle-conversion-report.json`'s `candidateScaffolds`/`candidateScaffoldsCount` fields, `tools/rf-bundle-to-kb-pack/lib/multi-bundle-report.mjs`) but zero instances exist anywhere in the repo.** `candidateScaffoldsCount` reads `0` for every one of the 4 bundles in the committed `build/kb-pack/multi-bundle-conversion-report.json`. Its schema location is itself still an open PRD question (OQ-5: a new `schemas/candidate-scaffold.schema.json`, or a hand-written structural check only). | 0 |
| `cbc_suite_v1`'s in-evidence conflict annotations | `modules/cbc_suite_v1/evidence.json`, per-source `conflictsWith[]` arrays (e.g. `CALIPER2020_HEMATOLOGY_I`, `BJHAEM2010_SCNIR_LEUKEMIA_RISK`, `PEDS2020_ISOLATED_NEUTROPENIA_OUTCOMES` — 3 total, reflected as `conflictClasses` in the multi-bundle report) | `cbc_suite_v1` | **Converter-adjacent** — `RF-CBC-002` is the one bundle whose conversion pipeline ran end-to-end via the committed converter, but note this is a *different, simpler, inline* conflict-annotation shape (a string array on an evidence source record) than the `unresolved.json` named-conflict-object shape above; it is not the same artifact type and should not be conflated with it in any future portal schema. | 3 |

**A note on shape drift, itself intake-relevant.** The two hand-derived generators
(`kidney_suite_v1`, `growth_suite_v1`) did not share code and do not agree on field names for the same
concept: kidney's `unresolved.json` uses `entryKind: "claim" | "conflict"`,
`relatedConflictId`/`disposition`; growth's uses `kind: "deferred_claim" | "named_conflict"`,
`conflictRef` (no `disposition` field at all). Both are internally consistent and both satisfy
FR-11/FR-12's substantive requirement (every conflict and every unrouted claim is visibly enumerated
with its reason), but a portal ingesting both files today would need a per-module adapter, not a
single parser — or this drift needs to be normalized before or during ingestion. That normalization
decision is out of scope for this idea-maturity spec; it is recorded here so a future `committed`
revision does not rediscover it as a surprise.

### Concrete example: the two currently-known conflict objects

- **`kidney-proteinuria-nephrotic-cutoff-pediatric-vs-adult-001`**
  (`modules/kidney_suite_v1/unresolved.json`, `entryKind: "conflict"`): two pediatric-scoped sources
  (`PROTEINURIA_CHILDREN_EVALUATION_AFP_2017`, `HEMATURIA_PROTEINURIA_CHILDREN_REVIEW_2018`) give a
  nephrotic-range spot urine protein/creatinine cutoff of >2 mg/mg; one general/adult-scoped
  narrative-review source (`SPOT_PC_RATIO_DIAGNOSTIC_UTILITY_REVIEW_2020`) gives >350 mg/mmol
  (3.5 mg/mg, materially higher after unit conversion). `resolution: "unresolved_by_design"` — the
  record states explicitly that selecting one cutoff (or an age/context-dependent branch between
  them) is a clinical rule-authoring decision requiring an approved
  `modules/kidney_suite_v1/authoring-decisions.yaml` and independent clinical review, neither of which
  exists.
- **`conflict_who_vs_cdc_growth_standard`** (`modules/growth_suite_v1/unresolved.json`,
  `kind: "named_conflict"`): the WHO Child Growth Standards (prescriptive, birth–<24 months) and the
  CDC 2000 Growth Reference (descriptive, 2–19 years) use different percentile conventions (WHO
  ±2 SD/2.3rd–97.7th vs. CDC 5th–95th) that flag materially different fractions of the same healthy
  population if the wrong convention is applied to the wrong chart, plus an independent, separately-
  evidenced chart-transition artifact at the WHO→CDC 24-month switch point. `resolutionPolicy:
  "never_averaged_or_resolved_to_one_source"`.

Both records exist today purely as durable, governance-visible artifacts on disk — neither has been
seen by a reviewer, and neither can be, until a review surface exists to receive them.

## Design sketch: what a future portal's intake layer would need to do with each artifact type

This section describes the intake behavior a `committed`-maturity revision of this spec would need to
specify precisely — sketched here at the level ADR-0004's own "shaping" framing uses, not decided.

1. **Ingest by artifact type, not by file.** A portal reading `modules/<id>/unresolved.json` needs to
   branch on `entryKind`/`kind` (conflict vs. claim; the field name itself differs by module today —
   see the shape-drift note above) rather than assume a single row shape for the whole file.
2. **Surface provenance as a first-class column, not a footnote.** Every ingested record should carry
   whether its owning module's evidence layer is converter-derived (`cbc_suite_v1` only, this pass) or
   a hand-derived projection (`anemia`, `kidney_suite_v1`, `growth_suite_v1`) pending `DF-E1-M1`. A
   reviewer triaging a hand-derived record is trusting a bespoke, largely-uncommitted script's output
   shape; a reviewer triaging converter-derived output is trusting the same deterministic pipeline
   `tests/ef-multi-bundle-determinism.test.mjs` proves byte-identical across runs. These are different
   trust postures and a portal should not present them identically.
3. **Route named conflict objects to the review-state machine's `disputed`-adjacent path, never
   `approved` directly.** `DF-E1-01`'s workflow has no state named "conflict" — a named conflict object
   is not itself a review record, it is an *input* that should seed a `changeProposal` whose resolution
   (selecting one cutoff, defining a branch, or leaving both visible in the shipped output) is the
   actual thing reviewers vote on. `resolutionPolicy: "never_averaged_or_resolved_to_one_source"`
   (growth) / `resolution: "unresolved_by_design"` (kidney) should map to a required
   `changeProposal.rationale` field explaining why a resolution was chosen, if one ever is.
4. **Route `unresolved.json` claim entries as a triage queue, not a review queue.** Most entries
   (`disposition: "deferred_no_authoring_decisions"` / `reason: "... modules/<id>/authoring-decisions.yaml
   does not exist ..."`) are blocked on `DF-E1-M1`, not on clinical judgment — a portal should not
   present 154 individual claim rows to a clinical reviewer as if each needs a clinical decision today.
   The correct intake action for the bulk of them is "blocked pending per-module rule-authoring
   workflow," a distinct, non-clinical status a portal's queue view should filter on.
5. **Candidate scaffolds have no instance to design an intake path against yet.** Any portal-side
   ingestion logic for `candidate-scaffolds.json` is speculative until (a) `DF-E1-M1` produces at least
   one, and (b) OQ-5 (schema location) resolves. This spec records the artifact type's existence and
   its designated staging path (`build/kb-pack/<module_id>/<pack_version>/candidate-scaffolds.json`,
   never a module's runtime `candidates.json`) so a future revision has the reference, but does not
   design its intake shape from zero instances.

## Cross-references

- `docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md` — Deferred
  Items Triage Table row `DF-E1-M2` (this spec's target path is named there); row P7-T2 in
  `phase-5-6-7-projection-determinism-docs.md` (this spec's own task).
- `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md` §5 (persona table, the
  "Future clinical reviewer" framing this spec answers); FR-9/FR-10/FR-11/FR-12 (the rules governing
  what these artifacts contain and how); OQ-5 (candidate-scaffold schema location, still open).
- `docs/project_plans/design-specs/clinical-review-portal-workflow.md` (`DF-E1-01`) — the review-state
  machine and role vocabulary this spec's intake layer would feed into; this spec does not duplicate
  it.
- `docs/adr/0004-clinical-approval-identity-adjudication.md` — `status: proposed`; this spec's
  prerequisite per its own `maturity: idea` gate.
- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §2.3 invariant 8, §4.17
  (conflict representation rules), §5.1/§5.3 (gate architecture; `G5` independent clinical + lab
  review is where this intake surface would ultimately sit).
- `.claude/findings/multi-bundle-conversion-e1-findings.md` — the unreproducible-provenance finding
  this spec's provenance-distinction requirement is grounded in; the P6-T3 AC/reality mismatch finding
  establishing that only `RF-CBC-002` -> `cbc_suite_v1` completed the converter pipeline end-to-end.
- `modules/kidney_suite_v1/unresolved.json`, `modules/growth_suite_v1/unresolved.json`,
  `build/kb-pack/multi-bundle-conversion-report.json` — the concrete artifact instances this spec
  describes.

## Open questions

Recorded here in prose (frontmatter `open_questions` intentionally left empty at this `idea` stage,
per this feature's Phase 7 task instruction):

- Does the portal normalize `kidney_suite_v1`'s and `growth_suite_v1`'s divergent `unresolved.json`
  field names (`entryKind`/`disposition`/`relatedConflictId` vs. `kind`/`conflictRef`) at ingestion
  time, or does `DF-E1-M1`'s eventual per-module rule-authoring workflow standardize the generator
  output first, making portal-side normalization unnecessary? Whichever is decided first should settle
  this.
- Once `DF-E1-M1` closes and a real `propose.mjs` run produces converter-derived
  `kidney_suite_v1`/`growth_suite_v1` evidence layers, do the existing hand-derived `unresolved.json`
  files get regenerated/replaced wholesale, or reconciled claim-by-claim against the new converter
  output? A portal that has already ingested the hand-derived version needs a defined answer before
  that day arrives.
- Where a named conflict object's resolution ultimately lands as a shipped-output decision (e.g.
  "present both cutoffs to the clinician, never resolve") versus a decision that revises the rule
  content directly — does the portal's `changeProposal` shape need a distinct outcome type for
  "preserve as visible conflict, no rule change" versus "author a rule that picks or branches on one
  cutoff"? `DF-E1-01`'s review-record schema does not currently distinguish these.
- Is `candidate-scaffolds.json`'s eventual schema (OQ-5, still open in the parent PRD) portal-intake
  aware from the start (e.g. carrying a `provenance` field mirroring this spec's provenance-distinction
  requirement), or does the portal need its own adapter layer regardless of how that schema lands?

## Promotion trigger

Per this feature's own Phase 7 task instruction and `DF-E1-M2`'s Deferred Items Triage Table entry:
promote this spec toward `maturity: committed` only after ADR-0004 is accepted and reviewer roles are
named — the same trigger `DF-E1-01`'s own spec names for building the portal itself. Do not design a
concrete intake schema ahead of that acceptance; doing so would risk re-litigating ADR-0004's still-
open process/data-model question from inside an artifact-intake spec that has no standing to decide
it.
