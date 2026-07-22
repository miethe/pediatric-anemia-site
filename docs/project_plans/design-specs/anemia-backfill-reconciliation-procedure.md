---
schema_version: 2
doc_type: design_spec
title: "Anemia Backfill Reconciliation Procedure (DF-E1-M3)"
status: draft
maturity: idea
created: 2026-07-22
updated: 2026-07-22
feature_slug: multi-bundle-conversion-e1
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
problem_statement: "modules/anemia/ carries two independently-derived evidence-layer files tracing to the same upstream RF-EV-001 bundle, with no decided procedure for whether/how they are ever reconciled."
open_questions:
  - "Which of the three candidate reconciliation options (leave-parallel / generate-citations-from-assertions / deprecate-EP-3-pipeline-role) should a future pass pursue, and on what trigger?"
  - "If option (b) or (c) is ever selected, does the resulting migration require a knowledgeBaseVersion bump or clinical re-review, given the guardrail that evidence-layer changes are not themselves rule changes?"
  - "Who is the deciding party for this reconciliation choice — engineering judgment alone, or does it require the same clinical-review gate as a rule change, given that evidence.json's passages back all 91 live rules?"
explored_alternatives:
  - "Option (a) — leave-parallel: keep evidence.json (EP-3/EP-4) and evidence-assertions.json (bespoke evidence projection) permanently separate, each independently traceable to RF-EV-001, with no cross-reference between them. This is this pass's own OQ-1 resolution and the status quo as of P4-T3/this spec."
  - "Option (b) — generate-citations-from-assertions: a future pass derives evidence.json's passages[].provenance citations FROM evidence-assertions.json's assertions[] records, so the EP-3/EP-4 shape becomes a generated view over the projected data rather than an independently maintained one."
  - "Option (c) — deprecate-EP-3-pipeline-role: retire the EP-3/EP-4 pipeline's role for RF-EV-001-derived content going forward, letting evidence-assertions.json (or its successor) become the sole evidence-layer source for this bundle, with evidence.json's existing RF-EV-001-derived records either frozen as historical or migrated wholesale."
---

# Anemia Backfill Reconciliation Procedure (DF-E1-M3)

> **Status:** design spec, `maturity: idea`. This document **structures the choice** among three
> named candidate reconciliation options — it does **not** decide among them. Selecting one is
> explicitly out of scope here and deferred to a future pass, per Deferred Item `DF-E1-M3`.

## Problem / Context

`modules/anemia/` carries two evidence-layer files that both trace back to the same upstream
Research Foundry bundle, **`RF-EV-001`** (`rf_run_20260717_rf_ev_001_pediatric_cds_backfill`), but
were produced by two different pipelines at two different points in time:

| File | Pipeline | Shape |
|---|---|---|
| `modules/anemia/evidence.json` | EP-3/EP-4 (prior, hand-curated source-record pipeline; pre-dates this pass) | `{ knowledgeBaseVersion, reviewedThrough, sources: [ { id, priority, passages: [ { id, sourceLocator, exactPassage, evidenceGrade, applicability, provenance: { runId, sourceCardId, evidenceId }, ... } ] } ] }` |
| `modules/anemia/evidence-assertions.json` | This pass's bespoke evidence projection (see **Provenance** below) | `{ schemaVersion, moduleId, rfProvenance: { rfRunId, rfBundleId, fixturePath }, assertions: [ { assertionId, rfRunId, rfSourceCardId, rfEvidenceId, rfClaimId, passageId, locator, claimStatus, applicability, ... } ] }` |

**Provenance (binding, do not restate differently elsewhere):** `modules/anemia/evidence-assertions.json`
was **not** produced by a run of the committed `tools/rf-bundle-to-kb-pack/` converter's `propose`
verb. That converter is hardwired by design (FR-14 module scoping;
`tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40`) to `cbc_suite_v1`'s own drafting content and halts
at `inspect` with `DecisionsNotFoundError` for any module lacking an approved
`authoring-decisions.yaml` — which is every claim in `RF-EV-001`, per Deferred Item `DF-E1-M1`. The
file was instead produced by a one-off, ephemeral generator script, now preserved (not part of the
committed converter tooling) at `scripts/evidence/oneoff/gen-anemia-evidence-assertions.py`, which
reads the committed `tests/fixtures/rf-ev-001/` fixture mirror and projects the 35 "supported"-status
claims into the file, matching `modules/cbc_suite_v1/evidence-assertions.json`'s schema shape. This
spec, and any future reconciliation work referencing this file's origin, MUST describe it this way —
never as converter `propose` output — matching `modules/anemia/EVIDENCE-PROVENANCE-NOTE.md`'s own
framing and the Phase 7 conversion-provenance constraint binding this plan's documentation tasks.

This seam was named but explicitly left unresolved by this plan's **OQ-1** resolution (see
[`docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md`](../implementation_plans/infrastructure/multi-bundle-conversion-e1.md)
"Decisions & OQ Resolutions"): the two files are documented as parallel provenance views at the
point of creation (P4-T3's seam note,
[`modules/anemia/EVIDENCE-PROVENANCE-NOTE.md`](../../../modules/anemia/EVIDENCE-PROVENANCE-NOTE.md)),
but the actual reconciliation *procedure* — whether the two views should ever be merged, one
generated from the other, or one pipeline's role deprecated — was deferred to this spec (Deferred
Item `DF-E1-M3`) as **research**-category, not yet a design decision.

The originating PRD open question is
[`docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md`](../PRDs/infrastructure/multi-bundle-conversion-e1.md)
§12 **OQ-1**, which names three candidate options verbatim (reproduced and expanded below) without
resolving among them.

## Why this matters

- `modules/anemia/rules.json`'s 91 hand-authored rules cite `evidence.json`'s `sources[].id` /
  `passages[].id` exclusively. Any reconciliation option that touches `evidence.json`'s existing
  records touches the citation surface every live rule depends on — this is not a low-stakes
  refactor.
- `evidence-assertions.json` is additive-only as landed by this pass: it does not modify
  `evidence.json` or `rules.json`, and carries zero rule-authoring weight of its own (no claim in
  `RF-EV-001` has an approved `authoring-decisions.yaml` record; `DF-E1-M1` governs that separately).
- Leaving the seam undocumented (rather than merely unresolved) was the actual defect P4-T3 fixed.
  This spec exists so the *procedure* question — not just the seam's existence — has a durable,
  structured home instead of being re-discovered and re-litigated by a future reader.

## The three candidate options (PRD §12 OQ-1, verbatim intent, expanded)

This section is deliberately structured as three parallel option write-ups, not a recommendation.
**No option is marked preferred, faster, or default in this document.**

### Option (a) — leave-parallel (this pass's status quo)

**What it is:** `evidence.json` and `evidence-assertions.json` remain two independently
maintained, independently traceable views of `RF-EV-001`, forever. Neither is generated from the
other; neither is deprecated. A reader tracing "what does rule X cite" reads `rules.json` →
`evidence.json` exactly as today; a reader tracing "what did the evidence-projection pipeline
extract from `RF-EV-001`" reads `evidence-assertions.json`. This is the option this pass's OQ-1
resolution and `EVIDENCE-PROVENANCE-NOTE.md` already describe as the binding state *as of this
pass* — but "as of this pass" is not the same as "permanently decided procedure," which is why this
spec still lists it as a live candidate rather than closing the question.

**What would need to be true for this to be the final answer:**
- The two views never need to be cross-queried in a single operation (e.g., a future clinical
  review workflow never needs "show me every source, from either pipeline, backing a given
  patient-facing claim" as one merged result).
- The maintenance cost of two independently-evolving shapes for the same upstream bundle stays low
  (i.e., `RF-EV-001` is not revised/re-verified in a way that would require updating both files in
  lockstep).
- No downstream consumer (e.g., a future `clinical-review-portal-intake-e1-artifacts.md` surface,
  `DF-E1-M2`) needs a single unified evidence-provenance API across modules.

**Open risk if chosen by default (i.e., by never revisiting this spec):** silent drift — the two
files could diverge in ways a reader has no way to detect, since neither cross-references the
other today (per `EVIDENCE-PROVENANCE-NOTE.md`'s "read-only-independent" framing).

### Option (b) — generate-citations-from-assertions

**What it is:** A future pass builds tooling that derives `evidence.json`'s
`passages[].provenance` citation fields (`runId`, `sourceCardId`, `evidenceId`) **from**
`evidence-assertions.json`'s `assertions[]` records, rather than maintaining them as independently
hand-curated EP-3/EP-4 content. `evidence.json`'s shape (and the 91 rules' citations into it) would
be preserved, but its *origin* would shift from "hand-curated" to "generated from the projected
assertions."

**What this would require (not designed here, only scoped):**
- A deterministic mapping from `evidence-assertions.json`'s `assertionId`/`passageId`/`locator`
  shape to `evidence.json`'s `sources[].passages[].id`/`sourceLocator`/`exactPassage` shape —
  the two schemas are not identical today (see the shape comparison table above), so this is a
  non-trivial transform, not a rename.
- A decision on whether generation is one-time (a migration) or continuous (every future
  `evidence-assertions.json` update regenerates `evidence.json`'s citations) — these have very
  different operational implications and are not the same option in practice.
- Regression-proofing against the 91 existing rules: every current `evidence.json` passage ID that
  a rule cites must survive the transform unchanged, or the migration itself becomes a rule-citation
  change requiring the same clinical-review rigor as any other evidence-layer edit.

**Open risk:** this option assumes `evidence-assertions.json`'s 35 "supported"-status claims are a
superset (or at least a safe substitute) for everything `evidence.json` currently cites — that
assumption is unverified and would need to be an explicit pre-check before implementation, not an
implicit assumption baked into the migration tooling.

### Option (c) — deprecate-EP-3-pipeline-role

**What it is:** The EP-3/EP-4 pipeline's role for `RF-EV-001`-derived content is retired going
forward. `evidence-assertions.json` (or a successor evidence-projection artifact) becomes the sole
active evidence-layer source for this bundle. `evidence.json`'s existing `RF-EV-001`-derived
records are either (c1) frozen in place as a historical snapshot no longer updated by any pipeline,
or (c2) migrated wholesale into whatever `evidence.json`'s new shape becomes under this option —
these are meaningfully different sub-options this spec does not further resolve.

**What this would require (not designed here, only scoped):**
- A decision on what "deprecate the pipeline's role" means operationally: does `evidence.json`
  still exist as a file (frozen) or does the module's rule-citation surface itself migrate to
  point at `evidence-assertions.json`-shaped records? The latter is a much larger change touching
  `src/ruleEngine.js`'s evidence-lookup path and every one of the 91 rules' citations.
  This is likely the highest-blast-radius of the three options and would need its own
  Feature-Contract-or-larger scoping pass, not a direct implementation from this spec.
- Explicit confirmation that no other module (`cbc_suite_v1`, or a future module) also depends on
  the EP-3/EP-4 pipeline shape in a way that would be disrupted by deprecating it for `anemia`
  specifically.

**Open risk:** deprecating a pipeline's *role* without a hard cutover decision (frozen vs.
migrated) leaves `evidence.json` in an ambiguous state that could itself become a new,
undocumented seam — the same failure mode `DF-E1-M3` exists to prevent.

## What this spec does not decide

Per the deferred-item's binding scope (this plan's Deferred Items Triage Table, `DF-E1-M3`,
category `research`), this document explicitly does **not**:

- Recommend or rank the three options.
- Estimate effort, assign a subagent, or propose an implementation-plan phase breakdown for any
  option — that is a future pass's planning work, triggered per the section below.
- Decide whether reconciliation is even worth doing before the trigger condition below occurs.

## Trigger for promotion (per Deferred Items Triage Table)

Per the parent plan's Deferred Items Triage Table (`DF-E1-M3` row): **"Reconciliation procedure
prioritized in a later E1 iteration."** Until a later E1 (or successor) planning pass explicitly
prioritizes this reconciliation work, option (a) — leave-parallel — remains the *operative* state
by default (it is what this pass already implemented and documented in
`EVIDENCE-PROVENANCE-NOTE.md`), without that default being read as this spec's decision. When a
future pass does pick this up, it should:

1. Re-read this spec and `EVIDENCE-PROVENANCE-NOTE.md` in full before proposing a direction.
2. Confirm whether the trigger condition (reconciliation prioritized) has actually occurred, rather
   than assuming it because this spec exists.
3. Decide among (a)/(b)/(c) (or a hybrid) explicitly, with a written rationale — the same standard
   this plan's own OQ-1/OQ-2/OQ-3 resolutions were held to
   (`docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md`,
   "Decisions & OQ Resolutions").
4. If the decision touches any of the 91 live rules' citations (options (b) or (c)), route the
   change through this repository's ordinary rule/KB-edit guardrail: independent clinical review +
   executable tests + signed release (`CLAUDE.md` hard guardrails) — an evidence-layer reconciliation
   is not exempt from that gate merely because it originates as a "documentation/tooling" change.

## References

- Deferred Item `DF-E1-M3`: parent plan's Deferred Items Triage Table,
  [`docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md`](../implementation_plans/infrastructure/multi-bundle-conversion-e1.md)
- OQ-1 (source question, verbatim options a/b/c):
  [`docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md`](../PRDs/infrastructure/multi-bundle-conversion-e1.md)
  §12 "Assumptions & Open Questions"
- OQ-1 resolution (this pass's binding scope boundary):
  [`docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md`](../implementation_plans/infrastructure/multi-bundle-conversion-e1.md)
  "Decisions & OQ Resolutions"
- Seam note this spec expands on (P4-T3):
  [`modules/anemia/EVIDENCE-PROVENANCE-NOTE.md`](../../../modules/anemia/EVIDENCE-PROVENANCE-NOTE.md)
- `evidence-assertions.json` real producer (one-off script, not the converter):
  `scripts/evidence/oneoff/gen-anemia-evidence-assertions.py`
- Phase 7 conversion-provenance constraint (binding on this doc):
  `docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-5-6-7-projection-determinism-docs.md`,
  Phase 7 Overview
