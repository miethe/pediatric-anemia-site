---
schema_version: 2
doc_type: design_spec
title: "Clinical Review Workflow v1: DF-E1-04 Retrospective-Validation Harness Linkage (DF-CRW-03)"
status: draft
maturity: shaping
created: 2026-07-22
updated: 2026-07-22
feature_slug: clinical-review-workflow
prd_ref: docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
problem_statement: "This plan added a status/sign verb surface and a shared derived-state library on top of the same review-record substrate the already-shipped retrospective-validation harness (tools/retro-validate) bridges into via a scaffold-only adjudication path — the linkage between the two has been kept minimally compatible (one defensive fix) but never designed end to end, and remains fully gated on G1-G4 regardless of the harness's own build status."
open_questions:
  - "Should tools/retro-validate/lib/discordance.mjs's toAdjudicationScaffoldInput bridge be extended to also drive sign/status once a real reviewer exists, or is the current boundary — the harness stops at an unsigned scaffold record; a human takes over via the ordinary review-record CLI from there — the correct, permanent design (arguably yes, since sign is TESTKEY-only pre-G2 and the harness must never itself hold signing authority)?"
  - "Should status --json or the review-record schema distinguish a harness-originated adjudication record (subjectContentHash is structurally a discordance record's candidateDigest, a different hash concept than a module-content hash, and every such record must carry scaffold's --allow-historical-subject NOTICE) from an ordinary human-scaffolded record, so a reviewer or auditor reading status output is not left inferring the difference from the NOTICE text alone?"
  - "Once DF-E1-09 (real-data retrospective run, gate G3) ever produces harness-triggered adjudication records at volume, does this plan's FR-26 conditional-adjudication policy (adjudication required only when clinical-1/clinical-2 disagree) need revisiting for the harness-origination case, where 'disagreement' is engine-output-vs-clinical-ground-truth rather than reviewer-vs-reviewer?"
  - "Is a distinct discordance-record provenance marker (e.g. an explicit field on the adjudication-role review record noting it originated from a harness discordance bridge rather than a human's own read of the evidence) worth adding to schemas/review-record.schema.json, or does that conflate a harness-internal fact with the review-record's own minimal, role-focused shape?"
explored_alternatives:
  - "Treat this as fully covered by the existing CRW-F5(e) compatibility fix (tools/retro-validate/lib/discordance.mjs now sets allowHistoricalSubject: true unconditionally) and close this item with no spec. Rejected: that fix only keeps the bridge's EXISTING scaffold-only call from breaking against this plan's new default-hard-fail scaffold behavior — it does not address whether the bridge should evolve alongside the new status/sign/derived-state surface, which is the actual open design question this item names."
  - "Reopen and re-scope DF-E1-04 itself (the harness build) as still-deferred, since this plan's own triage-table trigger text names 'DF-E1-04 harness lands' as a promotion condition. Rejected as inaccurate: DF-E1-04 already landed in evidence-foundry-e1-v1's Phase 4 (tools/retro-validate, verbs check-fixtures/run/report) — see 'Current State' below. This spec instead names and tracks the narrower, still-open linkage question, and flags the stale trigger text as a documented finding rather than silently treating the harness as unbuilt."
---

# Clinical Review Workflow v1: DF-E1-04 Retrospective-Validation Harness Linkage (DF-CRW-03)

## Problem / Context

`clinical-review-workflow-v1` (this plan) built a `status` verb, a `sign` verb, an incremental
`validate` cache, and — foundationally — one shared `computeDerivedReviewState` result that both
`status` and `validate` now consume (P1-T1). All of this sits directly on top of
`tools/review-record`'s pre-existing `scaffold` verb and review-record store — the exact same verb
and store `tools/retro-validate/lib/discordance.mjs`'s `toAdjudicationScaffoldInput` (Evidence
Foundry E1, Phase 4, P4-T5, FR-23) already calls to bridge a harness-detected discordance
(engine output disagreeing with a labeled case's clinical ground truth) into an
`adjudication`-role review record. That bridge is real, shipped code, not a sketch — and this
plan's own P2-T1 fix cycle (finding **CRW-F5(e)**, Wave-2 codex gate BLOCKER 2) had to touch it: once
`scaffold`'s `--subject` comparison defaulted to hard-failing on an uncomputable module-content hash,
the bridge's own `subject` (a discordance record's `candidateDigest` — a structurally different hash
concept than a module-content hash) started failing, so the bridge was updated to pass
`allowHistoricalSubject: true` unconditionally, with a header comment explaining why.

That fix is compatibility-preserving only. Nobody has asked, let alone answered, whether the
harness's adjudication bridge should evolve to use this plan's *new* surface — `sign`, `status`,
or the shared derived-state model — or whether `status`'s reporting should distinguish a
harness-originated adjudication record from an ordinary human-scaffolded one. This spec exists to
name that linkage question and its current shape, at `maturity: shaping`, without committing to an
answer.

## Current State — DF-E1-04 (the harness) already landed; this item is narrower than its own trigger text

`docs/project_plans/design-specs/retrospective-validation-harness.md` (the seed spec for `DF-E1-04`)
records, as of Phase 4 of `evidence-foundry-e1-v1` (dated the same day this plan was authored): "the
`evidence-foundry-e1-v1` plan's Phase 4 built the harness machinery for real, as
`tools/retro-validate` (`cli.mjs` verbs `check-fixtures`/`run`/`report`)." `tools/retro-validate/README.md`
confirms the discordance/adjudication bridge itself (`lib/discordance.mjs`, P4-T5, FR-23) is
"**landed**," proven by a real integration test invoking `tools/review-record`'s `scaffold` verb
directly.

This plan's own Deferred Items Triage Table names `DF-CRW-03`'s promotion trigger as **"G1/G2/G3/G4
all clear + DF-E1-04 harness lands."** Read literally, half of that trigger is already satisfied —
the harness has landed. That trigger text was accurate at the time this plan's decisions block was
first drafted (before `evidence-foundry-e1-v1`'s own Phase 4 shipped) and is now stale; it is flagged
as a documented finding in this feature's findings log (`.claude/findings/clinical-review-workflow-findings.md`,
per this spec's authoring task) rather than silently corrected without a trace. The trigger's other
half — **G1/G2/G3/G4 all clearing** — remains the real, unmet blocker: G1 (named credentialed
roster) and G2 (signing custodian) are unmet per this plan's own Hard Guardrails; G3 (data-source
SPIKE verdict + data-partner DUA) and G4 (release authorizer) are unmet per
`docs/governance/gates-registry.md`. DF-E1-09 (real-data retrospective run, the harness's own
still-deferred sibling item, gated on G3) is a separate, narrower blocker than the general-purpose
linkage question this spec tracks — see `retrospective-validation-harness.md`'s own "E1 State"
section for that item's detail, which this spec does not restate.

## Seeded From

- **ADR-0004** (`docs/adr/0004-clinical-approval-identity-adjudication.md`), frontmatter `unblocks: ["DF-E1-01", "DF-E1-04"]`.
  This field names ADR-0004's ratification (gate **G0**) as a shared prerequisite unblocking both the
  clinical review portal item (`DF-E1-01`, this plan's own `DF-CRW-01`) and the retrospective-
  validation harness item (`DF-E1-04`) — because both depend on the reviewer/adjudicator
  identity-and-signature model ADR-0004 defines: the harness's own seed spec names this directly
  ("Reviewer/adjudicator identity and signature model — resolved (as `proposed`, not `accepted`) by
  `docs/adr/0004-clinical-approval-identity-adjudication.md`"). ADR-0004 remains `status: proposed`
  throughout this feature's lifetime (Hard Guardrail: "No task edits any ADR's `status` field") —
  `unblocks` names a *dependency direction*, not a completed unblock. This plan's own P1-T5 encoded
  ADR-0004 decision item 5 (conditional adjudication) into code without touching that `status` field,
  the same posture this spec's linkage question inherits.
- `tools/retro-validate/lib/discordance.mjs` — the as-built bridge this spec's open questions are
  about; see its own module header for the full three-responsibility description
  (`computeDiscordanceRecords`, `validateDiscordanceRecord`, `toAdjudicationScaffoldInput`).
- This plan's `lib/derived-state.mjs` (P1-T1) — the shared `computeDerivedReviewState` result whose
  interaction with a harness-originated `adjudication` record (open question 2 above) is this spec's
  most concrete unresolved design question.

## Design Sketch (non-committal)

None of the following is committed; each names a shape the eventual linkage design might take,
contingent on the open questions above:

- **Bridge stays scaffold-only (status quo), by design.** The harness composes an
  `adjudication`-ready `scaffold` input and stops; a human reviewer/adjudicator picks the resulting
  unsigned draft up through the ordinary `docs/governance/reviewer-runbook.md` workflow (`sign`,
  `status`) exactly as if they had scaffolded it by hand. This is arguably correct permanently, not
  merely today: `sign` is TESTKEY-only pre-G2 and structurally must never be reachable from
  unattended harness code (that would be an automated act populating a reviewer-signed record, the
  same class of guardrail violation D-4 exists to prevent). Extending the bridge to also *call*
  `sign` would need its own, separate review against that guardrail — this spec does not propose
  doing so.
- **`status --json` gains a provenance hint.** Rather than a schema change, `status`'s existing
  `records[]` output could surface whichever fact already distinguishes a harness-originated record
  (e.g. `supersedes` shape, or a `sha256:`-vs-`sha256:<candidateDigest-shaped>` distinction) without
  a new schema field — a lower-risk option than "Provenance marker on the schema" below, deferred to
  a future spec revision if the underlying need is confirmed.
- **Provenance marker on the review-record schema.** A more explicit but heavier option: add a
  narrowly-scoped, optional field to an `adjudication`-role record noting harness origination. Not
  explored further here — this spec takes no position on whether the value justifies extending
  `schemas/review-record.schema.json`, a schema every other verb (`validate`, `render`, `status`)
  would need to stay compatible with.

## Promotion Trigger

Per this plan's Deferred Items Triage Table, restated with the correction "Current State" above
makes explicit: **G1, G2, G3, and G4 all clearing** is the operative remaining blocker (none have);
**"DF-E1-04 harness lands"** is already satisfied and no longer gates anything for this item. Even
once all four gates clear, clearing them does not by itself answer this spec's open questions — it
only removes the reason those questions have stayed theoretical. A `committed`-maturity revision of
this spec is appropriate once either (a) a real reviewer/adjudicator has actually worked a
harness-originated discordance record end to end (surfacing whether the current scaffold-only
boundary is workable in practice), or (b) DF-E1-09's real-data retrospective run is itself
implementation-planned, whichever comes first. No task, tool, or agent in this repository may
advance this spec past `maturity: shaping` on its own authority.

## Non-Goals

- This spec does not modify `tools/retro-validate/lib/discordance.mjs`, `schemas/review-record.schema.json`,
  or any `tools/review-record/` verb — it names open questions, it does not resolve them.
- This spec does not reopen or re-scope `DF-E1-04` itself (the harness build), which is complete; nor
  does it resolve `DF-E1-09` (real-data retrospective run), which stays tracked at
  `retrospective-validation-harness.md` and remains gated on G3 (SPIKE-007) independently of anything
  in this spec.
- Nothing here constitutes clinical validation, retrospective validation, or a signal that any
  gate has cleared — this program remains an unvalidated research prototype.

## References

- `docs/adr/0004-clinical-approval-identity-adjudication.md` — `unblocks: ["DF-E1-01", "DF-E1-04"]`;
  `status: proposed` (G0 uncleared).
- `docs/governance/gates-registry.md` — gates G1 (roster), G2 (signing custodian), G3 (data-source
  SPIKE + DUA), G4 (release authorizer); all four unmet as of this spec.
- `docs/project_plans/design-specs/retrospective-validation-harness.md` (`DF-E1-04`/`DF-E1-09`) — the
  harness's own seed spec, its "E1 State (Phase 5, 2026-07-22)" section recording DF-E1-04 as landed
  and DF-E1-09 as the still-deferred, G3-gated sibling item this spec does not duplicate.
- `tools/retro-validate/README.md`, `tools/retro-validate/lib/discordance.mjs` — the as-built
  discordance/adjudication bridge this spec's linkage questions are about.
- `docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md` — this
  plan's Deferred Items Triage Table, row `DF-CRW-03`; P1-T1 (`lib/derived-state.mjs`); the P2-T1 fix
  cycle finding `CRW-F5(e)` (the compatibility fix this spec's "Problem / Context" describes).
- `.claude/findings/clinical-review-workflow-findings.md` — carries the stale-trigger-text finding
  this spec's "Current State" section names, plus `CRW-F5(e)`'s own compatibility-fix record.
