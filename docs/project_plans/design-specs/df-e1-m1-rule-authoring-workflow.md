---
schema_version: 2
doc_type: design_spec
title: "DF-E1-M1: Rule-Authoring Promotion Workflow (drafted_pending_human_approval -> approved_for_rule_draft)"
status: draft
maturity: shaping
created: '2026-07-23'
updated: '2026-07-23'
feature_slug: "multi-bundle-conversion-e1-finish"
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
related_documents:
  - docs/project_plans/design-specs/rule-authoring-workflow-per-module.md
  - docs/adr/0001-canonical-authoring-model-rule-schema-v2.md
  - docs/adr/0004-clinical-approval-identity-adjudication.md
  - docs/project_plans/design-specs/df-e1-m2-clinical-review-portal-intake.md
problem_statement: "This pass authored non-approving authoring-decisions.yaml scaffolds (status: drafted_pending_human_approval) for anemia/kidney_suite_v1/growth_suite_v1, but no promotion mechanism exists anywhere in this repository for moving any decision -- in any of the 4 modules -- from that drafted status to approved_for_rule_draft, the only status the converter's propose verb treats as rule-draft-eligible."
open_questions:
  - "Who is the credentialed human authorized to promote a decision's status, and how is that identity recorded on the promoted record itself (ties into ADR-0004's still-open adjudication-identity model)?"
  - "Is promotion a per-decision act (one dec_* record at a time) or a per-file act (a batch promotion of a whole module's scaffold), given that a module's scaffold was authored as one file with 4 records?"
  - "Does promotion require the same 4-role review sequencing (evidence_methodologist/clinician_1/clinician_2/laboratory_medicine) already named in the schema's review.* block, or can a subset act for a scaffold-stage promotion?"
  - "What tooling (a CLI verb, a portal action per DF-E1-M2, a manual YAML edit reviewed via PR) performs the promotion, and does it need its own regression test analogous to this pass's fail-closed emission gate?"
explored_alternatives: []
---

# DF-E1-M1: Rule-Authoring Promotion Workflow (`drafted_pending_human_approval` -> `approved_for_rule_draft`)

## What this document is, and is not

This is an **idea-to-shaping-maturity sketch of a deferred promotion workflow**. It does not build,
schedule, or authorize any promotion tooling, and it does not promote any decision itself. Per this
feature's own binding scope boundary (PRD FR-F5, decisions-block §0), this pass deliberately
**stopped short** of building this workflow: it authored non-approving scaffolds only, for exactly
the reason this document exists to describe honestly — the promotion step is a separate, deferred,
human-gated piece of work this pass does not perform and enables no agent to perform.

This document is **not** the same file as
`docs/project_plans/design-specs/rule-authoring-workflow-per-module.md` (Deferred Item `DF-E1-M1`
from the prior `multi-bundle-conversion-e1` pass), which is a broader idea-maturity sketch of the
*entire* per-module rule-authoring workflow — candidate surfacing, draft authoring, review
sequencing, and landing a new decision record from scratch. That document already names the
promotion-status gap (its "Approval-state honesty gap" section, and Open Question "Schema honesty
gap") as one open question among several; **this document is a narrower, focused expansion of
exactly that one open question**, informed by this pass's actual empirical result: 12 new
non-approving decision records now exist on disk (4 each for `anemia`/`kidney_suite_v1`/
`growth_suite_v1`), so the promotion gap is no longer hypothetical — it blocks 12 concrete records,
plus `cbc_suite_v1`'s own un-promotable posture for any future `RF-CBC-002`-sourced decision. This
document does not duplicate the prior spec's broader authoring-workflow content; read that document
for candidate surfacing / draft authoring / landing, and this one for the promotion step
specifically.

## Problem / Context

As of this pass (`multi-bundle-conversion-e1-finish`, Phase 3, task P3-T2), every one of the 4
registered modules has a committed `authoring-decisions.yaml`:

| Module | Decision count | `status` value | `review.*` state |
|---|---:|---|---|
| `anemia` | 4 | `drafted_pending_human_approval` | all 4 roles `pending` |
| `kidney_suite_v1` | 4 | `drafted_pending_human_approval` | all 4 roles `pending` |
| `growth_suite_v1` | 4 | `drafted_pending_human_approval` | all 4 roles `pending` |
| `cbc_suite_v1` | 4 | `approved_for_rule_draft` (pre-existing, prior pass) | all 4 roles `pending` |

`tools/rf-bundle-to-kb-pack/`'s `propose` verb treats `status: approved_for_rule_draft` as the sole
rule-draft-eligible state — it is the reason `cbc_suite_v1` (and only `cbc_suite_v1`) still emits 4
rules this pass, while the other three modules' `propose` runs refuse rule/candidate drafting with a
named governance reason and emit only their evidence-layer artifacts (per
`docs/architecture.md` §2a, "Converter-vs-bespoke-projection distinction," updated this pass).

**The gap this document names:** nothing anywhere in this repository — no CLI verb, no portal
action, no documented manual procedure — describes how a `drafted_pending_human_approval` decision
record would ever legitimately become `approved_for_rule_draft`. The schema
(`schemas/authoring-decisions.schema.json`) defines the enum values but says nothing about the
transition between them. `cbc_suite_v1`'s own 4 pre-existing `approved_for_rule_draft` records were
authored directly at that status by a prior pass's task (P3-T1 of `evidence-foundry-buildout`) — they
were never promoted from a lesser status, so even that one precedent does not demonstrate a
promotion workflow, only a one-time direct-authorship path this pass's own FR-F5 explicitly forbids
repeating (no task in this pass may set any decision's `status` to `approved_for_rule_draft`).

This is precisely the gap `rule-authoring-workflow-per-module.md`'s own "Approval-state honesty gap"
section flagged as unresolved and its Open Questions section asked about directly — this pass's
empirical result (12 real non-approving records now existing) is what makes the question concrete
enough to warrant its own focused document rather than remaining one bullet among several.

## Why this is deliberately deferred, not built this pass

CLAUDE.md's hard guardrail — "No AI-published rule changes. Rule/KB edits require independent
clinical review + executable tests + signed release" — applies with full force to the promotion
step itself, not only to the eventual rule draft it would unlock. A promotion mechanism that could
be invoked by an agent, or by a human without named credentialed review, would functionally
reproduce the exact failure mode this pass's FR-F5 was scoped to avoid: a record whose `status`
claims readiness for rule drafting without the review that status is supposed to represent having
actually happened. This pass's own binding scope (decisions-block §0) explicitly excludes building
this workflow — it authors non-approving scaffolds and stops there, by design, not by omission.

## Design sketch (shaping-level, non-binding)

None of the below is committed. It sketches the shape a promotion mechanism could take, building on
`rule-authoring-workflow-per-module.md`'s broader authoring-workflow sketch and constrained by what
this pass's actual scaffolds already establish as real, on-disk starting state.

1. **Promotion as a distinct, auditable act, never an in-place field edit.** A `status` change from
   `drafted_pending_human_approval` to `approved_for_rule_draft` should itself be a reviewable,
   traceable event — e.g., a signed commit from a named human reviewer, or a portal action (per
   `df-e1-m2-clinical-review-portal-intake.md`) that writes a promotion record distinct from the
   decision record itself — never a silent YAML edit indistinguishable from any other file change.
2. **Named reviewer identity, not merely a role label.** The schema's `review.*` block already names
   4 roles (`evidence_methodologist`, `clinician_1`, `clinician_2`, `laboratory_medicine`); promotion
   presumably requires each to transition from `pending` to some completed state, with an actual
   named, credentialed identity behind each transition — the same open question
   `docs/adr/0004-clinical-approval-identity-adjudication.md` (`status: proposed`) already raises at
   the ADR level. This document does not resolve that ADR; it only notes that promotion cannot be
   designed independently of it.
3. **Per-decision granularity, not per-file.** Given each module's scaffold batches 4 decisions in
   one file, a plausible design promotes decisions individually (so a reviewer can approve decision
   1 while decision 2 remains under revision) — but this is explicitly an open question above, not
   decided here, since a per-file batch-promotion model is also structurally possible given today's
   schema shape.
4. **A regression gate analogous to this pass's own fail-closed emission gate.** This pass's Phase 1
   built a code-enforced fail-closed allowlist gate refusing rule drafting for any non-`approved_for_
   rule_draft` decision. A promotion mechanism should be held to the same standard: a test asserting
   that no code path other than the (not-yet-built) promotion mechanism can ever write
   `approved_for_rule_draft` into any module's `authoring-decisions.yaml` — mirroring
   `tests/rights-negative-invariant.test.mjs`'s "MAY ONLY SHRINK" allowlist-contract pattern for a
   different gate in this same repository.
5. **Interaction with `DF-E1-M3` (anemia reconciliation) and `DF-E1-M2` (portal intake).** A promoted
   decision for `anemia` specifically would need to resolve which evidence-layer file
   (`evidence.json` vs. `evidence-assertions.json`) its `basis.exact_assertion_ids` cites against,
   given anemia's still-unresolved dual-pipeline question
   (`docs/project_plans/design-specs/df-e1-m3-anemia-reconciliation.md`). And any promotion event is
   exactly the kind of artifact a future clinical-review portal (`df-e1-m2-clinical-review-portal-
   intake.md`) would need to ingest and display, not merely record silently on disk.

## What this document does not decide

- Does not select a promotion mechanism (CLI verb vs. portal action vs. reviewed manual edit).
- Does not name the credentialed human reviewer(s) who would perform any promotion.
- Does not design the regression test's exact shape, only that one is needed.
- Does not promote any of this pass's 12 non-approving decision records, and authorizes no agent to
  do so.

## Promotion trigger

Per this feature's own Deferred Items Triage Table (entry for the rule-authoring-promotion gap) and
mirroring `rule-authoring-workflow-per-module.md`'s own trigger: promote this spec toward
`maturity: ready` only once `ADR-0001` (canonical authoring model / rule-schema v2) and `ADR-0004`
(clinical-approval identity adjudication) are both accepted, and a named credentialed clinician has
committed to holding at least one of the 4 `review.*` roles in practice. Until then this stays at
`maturity: shaping` — a step further than the sibling spec's `idea` because this pass's actual
scaffolds give it concrete, real records to design against, but still short of `ready` because none
of the prerequisite ADRs has landed.

## Cross-references

- `docs/project_plans/design-specs/rule-authoring-workflow-per-module.md` — the broader, prior-pass
  authoring-workflow sketch this document narrows and expands on (promotion step only); not
  duplicated here.
- `docs/adr/0001-canonical-authoring-model-rule-schema-v2.md` (`status: proposed`) — settles the
  decision-record schema boundary this promotion mechanism would operate within.
- `docs/adr/0004-clinical-approval-identity-adjudication.md` (`status: proposed`) — the reviewer-
  identity model this promotion mechanism depends on.
- `docs/project_plans/design-specs/df-e1-m2-clinical-review-portal-intake.md` — a plausible future
  home for the promotion action itself, per this document's design sketch item 1.
- `docs/architecture.md` §2a (this pass's own module-inventory update) — records the current,
  pre-promotion state of all 4 modules' `authoring-decisions.yaml` files.
- `modules/{anemia,kidney_suite_v1,growth_suite_v1}/authoring-decisions.yaml` — the 12 real,
  non-approving records this document is written against.
- `modules/cbc_suite_v1/authoring-decisions.yaml` — the one module whose 4 records are already
  `approved_for_rule_draft`, authored directly at that status by a prior pass (not via any promotion
  mechanism, since none exists).
