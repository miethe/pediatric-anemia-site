---
schema_version: 2
doc_type: design_spec
title: "Clinical Review Workflow v1: Real-Reviewer Onboarding (G1) (DF-CRW-02)"
status: draft
maturity: shaping
created: 2026-07-22
updated: 2026-07-22
feature_slug: clinical-review-workflow
prd_ref: docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
problem_statement: "Gate G1 (named credentialed reviewer roster) is an owner-blocked human act with zero software support for the owner's own side of the process — recruiting and out-of-band verifying a real clinician, then committing a governance/reviewer-roster.yaml entry — while the reviewer-facing half of the workflow (scaffold/sign/status once a real entry exists) is already built and fixture-tested."
open_questions:
  - "Should a companion 'G1 onboarding checklist' doc (program-owner-facing: recruit, verify credential out-of-band, assign moduleScopes, populate verificationRef, commit) be authored alongside the reviewer-facing docs/governance/reviewer-runbook.md, which starts only after G1 has already cleared for a given individual?"
  - "Should any administrative tooling exist to reduce hand-authoring-YAML risk when a human does add a real governance/reviewer-roster.yaml entry (e.g. a schema-validating `roster add` helper), or is direct, reviewable hand-editing (the same posture ADR-0004 recommends for review records generally) sufficient and preferable for a five-to-a-dozen-entry roster?"
  - "How are moduleScopes assigned and revisited as this program adds modules beyond cbc_suite_v1 (DF-CRW's N/A-3 row) — per-reviewer static scope at onboarding time, or a periodic re-scoping review?"
  - "Does a real reviewer's onboarding record (the out-of-band credential verification itself) need its own durable, auditable artifact beyond the roster entry's verificationRef string — e.g. a dated attestation file — or is a populated verificationRef pointing to an external credential-registry record sufficient?"
explored_alternatives:
  - "No dedicated onboarding design work — treat G1 as pure process with no software-side documentation gap. Rejected: the reviewer-facing runbook is explicit that its own 'Post-G1 real-reviewer track' starts only after G1 has cleared for an individual ('nothing in this section can be done yet ... describes what a real, credentialed clinician will do once gate G1 has cleared for them') — it does not, and by its own framing should not, describe the owner's verification/onboarding act itself, leaving that half genuinely undocumented today."
  - "Build a `roster add` CLI verb now, ahead of any real onboarding — rejected for v1: no task in clinical-review-workflow-v1 or its predecessor is authorized to write a synthetic:false roster entry (Hard Guardrail), so a write-capable roster tool would have no legitimate real-entry caller to exercise it against until a human is actually ready to onboard someone, at which point a hand-reviewed YAML edit is at least as auditable as a CLI write and requires no new code."
---

# Clinical Review Workflow v1: Real-Reviewer Onboarding (G1) (DF-CRW-02)

## Problem / Context

`governance/reviewer-roster.yaml` ships today with exactly five entries, every one
`synthetic: true` and scoped only to `cbc_suite_v1` — clearly-labeled dry-run personas
("SYNTHETIC — NOT A CREDENTIALED REVIEWER") added by `evidence-foundry-e1-v1`'s P2-T8. Zero
`synthetic: false` (real) entries exist, and none of this feature's tasks (`clinical-review-workflow-v1`)
is authorized to add one — that is this plan's own Hard Guardrail, restated verbatim: "No
`synthetic: false` roster entries ... FR-4/FR-5's real-identity write path is exercised only against a
fixture roster, never the real one."

This plan built the *reviewer-facing* half of what changes once a real entry exists: `scaffold`
without `--draft` writes a finished (unsigned) record directly for a resolved real `reviewerId`
(P1-T3(b), tested only against the fixture roster
`tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml`), and
`docs/governance/reviewer-runbook.md`'s "Post-G1 real-reviewer track" documents exactly that
workflow for a human reviewer once G1 has cleared *for them*. What has no software support, and
no dedicated documentation, is the **other** half of onboarding: the program owner's own act of
recruiting a credentialed clinician, verifying their credential out-of-band, and committing the
resulting roster entry — the act that actually clears G1 in the first place.

## Current State (what already exists)

- **Gate definition**: `docs/governance/gates-registry.md`'s G1 row is the canonical, binding
  description — owner-role ("a named clinical-governance/credentialing role ... per ADR-0004's
  minimum-roles table"), entry criteria (a `governance/reviewer-roster.yaml` entry with
  `synthetic: false`, a populated `credentialRef`, an assigned `moduleScopes[]`, and a populated
  `verificationRef` recording the verification act itself), and the schema-forced-inert mechanism
  (`schemas/reviewer-roster.schema.json` requires `verificationRef` whenever `synthetic: false`, a
  structural requirement no task can skip).
- **Reviewer-facing workflow, already built and documented**: `docs/governance/reviewer-runbook.md`
  §"Post-G1 real-reviewer track" — `scaffold` (no `--draft`) writes the finished record directly;
  the reviewer's own `git commit` (not `scaffold` itself, which never invokes `git`) is the
  attributable act; signing stays a separate, later, G2-gated act performed by a distinct signing
  custodian (`docs/adr/0005-kb-serialization-signing-key-custody.md`), never the reviewer.
- **Real-identity code path, fixture-tested only**: P1-T3(b) proves `scaffold` builds a schema-valid
  `signature: null` record for a `synthetic: false` roster entry — exclusively against the fixture
  roster named above; a diff-check in that same task asserts zero writes to the real
  `governance/reviewer-roster.yaml` by any test.
- **Owner-side onboarding process itself**: undocumented in any single place. The runbook's own
  opening line for this track is explicit that it is describing the far side of a gate this
  repository cannot clear: "Nothing in this section can be done yet ... describes what a *real*,
  credentialed clinician will do once gate **G1** has cleared for them — something that has not
  happened for anyone in this codebase today." No companion document walks the *owner* through
  recruiting a reviewer, performing out-of-band credential verification, deciding `moduleScopes`,
  and authoring the roster entry itself.

## Design Sketch (non-committal — the "direction" this shaping-stage spec has, pending a human onboarding pass)

At a minimum, closing this gap needs:

- **An owner-facing onboarding checklist**, structurally distinct from the reviewer-facing runbook
  (the runbook itself should not be widened to cover both audiences — it already carries two
  labeled tracks for two different reviewer-side scenarios and a third, owner-side audience would
  blur that separation). At minimum: how to recruit a reviewer per role (mirroring ADR-0004's
  minimum-roles table — pediatric hematologist/subspecialist, second qualified pediatric clinician,
  laboratory medicine/pathology, a named non-author adjudicator, authorized clinical/quality-release
  roles); what "out-of-band" credential verification concretely means and what `verificationRef`
  should point to; how to pick `moduleScopes[]`; and the exact YAML shape to hand-author
  (`reviewerId`, `name`, `credentialRef`, `moduleScopes[]`, `synthetic: false`, `verificationRef`)
  against `schemas/reviewer-roster.schema.json`.
- **A decision on tooling** — whether a schema-validating helper (e.g. `roster add`, previewing the
  entry and validating it before a human commits) is worth building once a first real onboarding is
  imminent, or whether direct, human-reviewed YAML authoring (the same posture ADR-0004 recommends
  for review records themselves — plain, git-tracked files, no bespoke write surface) is preferable
  for a roster this small. This spec takes no position yet; see "Explored Alternatives" above for
  why building the tool pre-emptively, before any concrete onboarding, was not adopted for v1.
- **A durability decision** for the verification act itself — whether `verificationRef` pointing to
  an external credential-registry record is sufficient evidence of the out-of-band act, or whether
  this program wants its own dated, committed attestation artifact per onboarded reviewer (mirroring
  the append-only, git-signed posture this program already uses for review records).

None of the above is implementable today: it is entirely a human governance process design (who
recruits, how credentials are verified, what "sufficient evidence" means for `verificationRef`) with,
at most, a thin documentation or optional-tooling layer on top — there is no code path this spec
could commit to building before a human decision-owner has actually thought through the checklist
above.

## Promotion Trigger

Per this plan's Deferred Items Triage Table: **the owner names a credentialed reviewer and records a
`verificationRef` (G1 clears)**. That is the same act this spec is scoped to make more legible and
supportable, not a separate downstream trigger — the first real G1 clearance is simultaneously the
event that would surface whether this spec's open questions (checklist doc, optional tooling,
attestation durability) actually mattered in practice, and the earliest point a `committed`-maturity
revision of this spec could responsibly be written. No task, tool, or agent in this repository may
perform that act or move this spec past `maturity: shaping` on its own authority.

## Non-Goals

- This spec does not add, and no task under this plan may add, any `synthetic: false` entry to
  `governance/reviewer-roster.yaml` — that stays a strictly human, out-of-band act (Hard Guardrail).
- This spec does not build a `roster add` CLI verb, an onboarding-checklist document, or any other
  artifact named in "Design Sketch" above — it names the gap and the shape of a future answer; it
  does not resolve either open question.
- Nothing in this spec constitutes, or substitutes for, the actual out-of-band credential
  verification G1 requires — a document about the process is not the process.

## References

- `docs/governance/gates-registry.md` — G1 ("Named credentialed reviewer roster"), the canonical,
  binding gate definition this spec's whole subject sits underneath; also G2 ("Signing custodian +
  offline key ceremony"), the distinct, later gate a real reviewer's signature still does not clear.
- `docs/governance/reviewer-runbook.md` §"Post-G1 real-reviewer track" — the reviewer-facing half of
  the workflow this spec's owner-facing gap complements, not duplicates.
- `docs/adr/0004-clinical-approval-identity-adjudication.md` — the minimum-roles table (clinical
  content review 1/2, laboratory review, adjudication, release authorization) an onboarding checklist
  would walk per-role; `status: proposed` (G0 uncleared) throughout this feature's lifetime.
- `governance/reviewer-roster.yaml`, `schemas/reviewer-roster.schema.json` — the roster's current
  (five synthetic, zero real) state and the schema-forced `verificationRef` requirement.
- `tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml` — the fixture roster the
  real-identity `scaffold` write path (P1-T3(b)) is exercised against; never the real roster.
- `docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md` — this
  plan's Hard Guardrails ("No `synthetic: false` roster entries") and Deferred Items Triage Table,
  row `DF-CRW-02`.
