---
doc_type: design_spec
title: "Review-Portal Design: Change-Proposal to Dual-Review to Approval Workflow"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-21
feature_slug: wave0-safety-foundation
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
---

# Review-Portal Design: Change-Proposal to Dual-Review to Approval Workflow (EP7-T2)

## What this document is, and is not

This is a **paper design for a data contract**, per FR-WP7-02/FR-WP7-03. It describes the workflow
states and role vocabulary that `schemas/review-record.schema.json` (shipped by EP7-T1) structurally
encodes, so a future implementer has a single narrative reference instead of reverse-engineering the
schema's `allOf`/`if`/`then` blocks.

**No review-portal application exists.** There is no server, no API, no database, no UI, no
authentication system, and no workflow engine anywhere in this repository that produces or consumes
`review-record.schema.json` records. Nothing in this phase (EP-7) builds one. Building the portal is
explicitly out of scope here and is not scheduled by any current wave.

**No clinical sign-off exists anywhere in this repository.** `modules/anemia/module.json`'s
`approvedBy[]` and every rule's `clinicalApprovers[]` in `modules/anemia/rules.json` remain
schema-forced empty (`maxItems: 0`) as of this writing. This document does not change that. Nothing
here constitutes, authorizes, or brings the project closer to a credentialed clinical review having
occurred — it only describes the shape a *future*, separately-gated, human-run review process would
produce if one is ever stood up.

The schema is the source of truth. Where this document's prose and
`schemas/review-record.schema.json` disagree, **the schema wins** — treat any such disagreement as a
defect in this document to be corrected in a later revision, not license to reinterpret the schema.
One known tension worth flagging rather than silently resolving: `docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-7-review-contract-and-docs.md`'s
exit criteria describe EP7-T1 as round-tripping "all 4 workflow states," while both the schema's
`workflowState` enum and this same phase document's own EP7-T2 task row list five values —
`proposed`, `under-review`, `disputed`, `approved`, `rejected`. This document follows the schema (and
the five-item list in the EP7-T2 task row) and does not attempt to make the "4" figure true.

---

## NON-GOAL (D-4): ARC council review output is never an eligible `approvedBy[]` source

> **This project's Agent Review Council (ARC) — including any `arc validate` pass, any full council
> run, any dissent record, scorecard, or the completed `runs/2026-07-19-pediatric-expansion-arc-readiness/`
> readiness-audit bundle referenced in `docs/project_plans/expansion/03-arc-clinical-council-handoff.md`
> — is NOT, and can never become, an eligible source for a review record's `approvedBy[]` field, for
> any `reviewers[]` entry, or for `conflictResolution.resolvedBy`. This holds regardless of review
> quality, thoroughness, seat count, unanimity, or how the output is packaged or described.
> `approvedBy[]` and its sibling fields (`schemas/module-manifest.schema.json`'s `approvedBy`,
> `schemas/rule.schema.json`'s `clinicalApprovers`) may only ever be populated with the names of real,
> named, individually credentialed human clinicians who satisfy `reviewerType: "human"` and
> `attestedHuman: true`. There is no synthetic-review pathway — present or future — that satisfies
> D-4. An ARC run may be cited as advisory narrative context (e.g., in `changeProposal.rationale`,
> `history[].note`, or `conflictResolution.notes`), never as a reviewer, an approver, or a conflict
> resolver.**

This affirmative statement exists because D-4 ("ARC output may never populate
`clinicalApprovers[]`/`approvedBy[]`") is the single most important acceptance criterion in this wave
(`docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md` AC-D4) and because ARC's own
handoff describes a "repository-ready," "readiness-audit complete" pediatric clinical council that is
genuinely useful for hazard-finding — exactly the kind of high-quality synthetic output someone could
be tempted to treat as sign-off. It is not sign-off. `03-arc-clinical-council-handoff.md` states this
itself: "Repository-ready means the review infrastructure ... is implemented and validated. It does
**not** mean this pediatric CDS is clinically validated or releasable," and its delivery-state table
records "Credentialed review" as `not_executed_owner_held`.

The schema backs this prose with structure, not just convention: every `reviewers[]` entry is pinned
to `reviewerType: {"const": "human"}` and `attestedHuman: {"const": true}` (see
`schemas/review-record.schema.json`'s `$defs.humanReviewer`), and `conflictResolution.resolvedBy`
carries the identical pinned shape. There is no enum value, field, or object shape in the schema that
an ARC run, an `rf`/`council-review` bundle, an automated linter, or a model's self-review could
occupy.

---

## Workflow states

`schemas/review-record.schema.json`'s `$defs.workflowState` is a closed five-value enum:

| State | Meaning |
|---|---|
| `proposed` | A change proposal has been authored (`changeProposal` populated). No review has started. |
| `under-review` | Dual review is in progress: two or more named human reviewers are assigned. |
| `disputed` | The assigned reviewers' decisions diverged; a `conflictResolution` is open and unresolved. |
| `approved` | Terminal. At least two qualifying human reviewers recorded `decision: "approve"`; `approvedBy[]` is populated 1:1 with their names. |
| `rejected` | Terminal. The proposal did not reach approval; `approvedBy[]` stays empty. |

### Per-state field requirements (from the schema's `allOf`/`if`/`then` blocks)

| State | `reviewers[]` | `approvedBy[]` | `conflictResolution` |
|---|---|---|---|
| `proposed` | `maxItems: 0` (must be empty) | `maxItems: 0` | must be `null` |
| `under-review` | `minItems: 2` | `maxItems: 0` | must be `null` |
| `disputed` | `minItems: 2` | `maxItems: 0` | object; requires `triggeredAt` + `reason`; `resolvedBy` may still be `null` while the dispute is open |
| `approved` | `minItems: 2`; must `contain` at least 2 entries with `reviewerType: "human"` and `decision: "approve"` | `minItems: 2` | `null`, **or** an object — and if an object, `resolvedBy`/`resolution`/`resolvedAt` are all required and non-null |
| `rejected` | `minItems: 2` | `maxItems: 0` | same as `approved`: `null`, or a fully-resolved object |

### Legal transitions

| From | To | What must be true for the transition |
|---|---|---|
| *(none — record creation)* | `proposed` | `changeProposal` authored; `history[0].state` is `proposed`, actor typically a system actor (e.g. `system:proposal-intake`) or the proposal's human author. |
| `proposed` | `under-review` | Two or more named human reviewers are assigned to `reviewers[]` (their `decision` may start `pending`). |
| `under-review` | `approved` | At least two assigned reviewers record `decision: "approve"` with no divergence needing escalation; `approvedBy[]` is populated with exactly those reviewers' names; `conflictResolution` stays `null`. |
| `under-review` | `rejected` | The proposal does not reach qualifying approval (a reviewer records `decision: "reject"`, or the process otherwise concludes reject) with no dispute needing escalation; `approvedBy[]` stays `[]`. |
| `under-review` | `disputed` | Two assigned reviewers' decisions diverge (e.g., one `approve`, one `reject`/`request-changes`); `conflictResolution` opens with `triggeredAt` + `reason`; `resolvedBy` stays `null` until resolved. |
| `disputed` | `approved` | The conflict is resolved by a named human (`conflictResolution.resolvedBy`/`resolution`/`resolvedAt` all filled) and at least two qualifying `reviewers[]` entries record `decision: "approve"` — see the worked example below, where a third human reviewer is added with `role: "conflict-arbiter"`. |
| `disputed` | `rejected` | The conflict is resolved by a named human, but the outcome is reject rather than approve; `approvedBy[]` stays `[]`. |
| `approved` / `rejected` | *(none)* | **Terminal by process convention.** A new change to the same artifact starts a new `changeProposal`/review record (new `proposalId`/`id`) rather than reopening this one. **This terminality is a documented process rule, not a schema-structural one** — `schemas/review-record.schema.json` has no state-machine/transition-history validator (it notes elsewhere that this repo's zero-dependency validator has no `$data` support), so nothing prevents a record from being re-edited after reaching a terminal state except the review process itself. |

**A note on `conflictResolution.resolution`'s three enum values** (`escalated-to-additional-review`,
`returned-to-authors`, `resolved-by-arbiter`): the schema does not tie a specific resolution value to
a specific terminal `workflowState`. This document's reading — offered as interpretation, not schema
fact — is that `resolved-by-arbiter` is the value expected when a *single* record proceeds from
`disputed` straight to `approved`/`rejected` (a named human, often filling a `conflict-arbiter`
`reviewers[]` seat, adjudicates within this record). `escalated-to-additional-review` and
`returned-to-authors` more plausibly describe closing out *this* record's dispute by routing the
underlying change into a **new** proposal/review record rather than continuing this one — but nothing
in the schema enforces that reading, and an implementer is free to use any of the three values with
either terminal state as long as the structural requirements above hold.

### Worked example

`schemas/examples/review-record.example.json` (RR-2026-001) walks the canonical dispute-and-resolve
path: `proposed` -> `under-review` (primary reviewer REV-001, secondary REV-002 assigned) ->
`disputed` (REV-001 approves, REV-002 requests changes on the same passage mapping) -> `approved`
(a third human reviewer, REV-003, is added to `reviewers[]` with `role: "conflict-arbiter"` and
`decision: "approve"`; `conflictResolution.resolvedBy` is REV-003; `approvedBy[]` ends up
`["Dr. A. Ibarra", "Dr. C. Whitfield"]` — REV-001 and REV-003, the two qualifying `approve` decisions;
REV-002's dissent remains on record in `reviewers[]` for audit but does not block approval).

---

## Role vocabulary

### Reviewer roles (`$defs.reviewerRole`, closed enum)

| Role | Purpose |
|---|---|
| `primary-reviewer` | First assigned reviewer in the dual-review step. |
| `secondary-reviewer` | Second assigned reviewer in the dual-review step; a divergence between primary and secondary is what triggers `disputed`. |
| `conflict-arbiter` | A reviewer added specifically to adjudicate a dispute (as in the worked example). Not required to be a third, distinct person from every case — a record could in principle be resolved without ever adding a `conflict-arbiter`-role entry, so long as the structural per-state requirements above are met — but it is the intended, documented role for that purpose. |

Every `reviewers[]` entry — regardless of role — is a `$defs.humanReviewer` object requiring
`reviewerId`, `name`, `credential` (professional credential/license, e.g. `MD`, `DO`, `RN, CPNP`,
`PharmD`), `reviewerType: "human"` (pinned), `role`, `decision`
(`pending`/`approve`/`reject`/`request-changes`/`abstain`), `attestedHuman: true` (pinned), and
`decidedAt` (nullable while `pending`).

### The "approver" role is derived, not a distinct field

There is no separate `approverRole` enum. An `approvedBy[]` entry is simply the `name` of any
`reviewers[]` entry that is (a) `reviewerType: "human"`, (b) `attestedHuman: true`, and (c)
`decision: "approve"` — copied verbatim once the record reaches `approved`. Any of the three
`reviewerRole` values (`primary-reviewer`, `secondary-reviewer`, `conflict-arbiter`) can contribute an
`approve` decision that lands in `approvedBy[]`; the role field records *why* that person was
reviewing, not whether their approval counts.

### Conflict resolver

`conflictResolution.resolvedBy` is a fourth, inline human-identity shape (not a named `reviewerRole`
value): `name`, `credential`, `reviewerType: "human"` (pinned), `attestedHuman: true` (pinned). It is
`null` while a dispute is open and must be a fully populated human identity once the record reaches
`approved`/`rejected` with a non-null `conflictResolution`. In practice the person who resolves a
conflict is often also entered into `reviewers[]` with `role: "conflict-arbiter"` (as in the worked
example), but the schema does not require that duplication — `resolvedBy` and a `conflict-arbiter`
`reviewers[]` entry are independent fields that happen to typically name the same person.

---

## Cross-reference: ARC's council seat taxonomy (role-vocabulary input only)

`docs/project_plans/expansion/03-arc-clinical-council-handoff.md` documents
`pediatric-anemia-clinical-review-council@0.1.0`, an 8-voting-seat + 2-non-voting-seat synthetic
review council (full authority-boundary table in that document; summarized here for reference only):

**Voting seats:** Pediatric Hematology; Pediatric Laboratory Medicine; General Pediatrics; Clinical
Informatics and Interoperability; Diagnostic-Accuracy Methods; Prediction and Implementation
Evaluation; Patient Safety and Human Factors; Equity and Patient-Family Impact.

**Non-voting seats:** Evidence Quality Input; Pediatric Clinical Adjudicator and Validation Planner.

The relevance of this taxonomy to this document is narrow and strictly one-directional: it is useful
**vocabulary** for the kind of specialty/credential a real human `primary-reviewer`, `secondary-reviewer`,
or `conflict-arbiter` might reasonably hold for a given `changeProposal.targetArtifacts` entry — e.g.,
a proposed change to a hematology-specific candidate pattern is the kind of thing the "Pediatric
Hematology" domain names, so a future portal implementation might use that domain list to suggest
which human specialty should be recruited as reviewer. That is the entire scope of the cross-reference.

**It is not, and must never become, a source of seats, occupants, or votes for `reviewers[]`,
`approvedBy[]`, or `conflictResolution.resolvedBy`.** ARC's seats are agentic/synthetic council
positions occupied by model-driven reviewers; `schemas/review-record.schema.json` structurally
excludes any such occupant (see the NON-GOAL section above and D-4). Naming a domain that overlaps
with an ARC seat's label (e.g., "Pediatric Hematology") never implies that ARC's occupant of that seat
counts as a `reviewers[]` entry sharing that domain — the review record's reviewer must independently
satisfy `reviewerType: "human"` and `attestedHuman: true` regardless of any naming overlap.

---

## Summary of what would still need to be built (not built here)

For completeness, and to keep this document honest about scope: a real review portal would need, at
minimum, an authenticated application (identity-verified human reviewers), a persistence layer for
review records, an API or UI surface to create/transition records, and a process binding
`approvedBy[]` output to the sibling `approvedBy[]`/`clinicalApprovers[]` fields in
`schemas/module-manifest.schema.json`/`schemas/rule.schema.json` (itself "a separate, deliberate,
reviewable act" per `schemas/review-record.schema.json`'s own top-level description). None of that
exists. This document describes only the data contract those hypothetical components would need to
agree on.
