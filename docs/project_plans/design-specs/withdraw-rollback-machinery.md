---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry: Withdraw/Rollback Machinery (DF-E2-03)"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-21
feature_slug: evidence-foundry-buildout
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
problem_statement: "No mechanism exists to withdraw an active KB release or roll a client back to a prior signed version when a retraction, safety notice, or emergency-withdrawal-class change fires, because no signed release or registry exists yet for a withdrawal state to attach to."
open_questions:
  - "Who holds authority to confirm an emergency withdrawal at E1/E2 (a named clinical role per ADR-4, an on-call rotation, both), and what is the confirmation medium (signed commit, portal action, issue-tracker approval)?"
  - "What is the rollback SLA (hours/days) from trigger detection to an active client rejecting the withdrawn KB, and how is that SLA measured before any live deployment exists to generate real incident data?"
  - "Does 'rollback' mean the runtime falls back to the immediately-prior signed release, or to the last release that itself has no open withdrawal flag (which could skip more than one version if two releases are withdrawn in sequence)?"
  - "How does a runtime client discover a withdrawal out-of-band (denylist poll, registry check on load, push notification) given the deterministic/offline converter-and-runtime guardrail — is a withdrawal check itself required to stay offline-safe (fail closed with no assessment) if the client cannot reach the registry?"
  - "Does the rollback drill (02 §7.4 E2 go gate: 'Rollback drill passes and active clients reject expired/withdrawn KBs as policy requires') get authored as an executable test against the flat registry ADR-5 recommends, or does it require live-deployment infrastructure this program has no plan to operate before E1?"
explored_alternatives:
  - "No dedicated withdrawal state — treat a bad release the same as any other supersession (new version simply replaces old) — rejected implicitly by ADR-7: this collapses the 'emergency withdrawal' materiality class into ordinary supersession and reproduces the 'Retraction response delay' risk (02 §8.4) because nothing signals to an already-deployed client that the version it holds is now unsafe, not merely outdated."
  - "Human-confirmed emergency withdrawal, gated on automated detection, recorded as a distinct registry entry/state (ADR-7's recommended default, extended here) — automated detection triggers the immediate-run lane and materiality classification, but the withdrawal action itself requires a human sign-off step, matching the CLAUDE.md 'no AI-published rule changes' guardrail extended symmetrically to un-authoring a release."
  - "Fully automated withdrawal (detection and action both automatic, no human confirmation) — rejected in ADR-7 (option 1, 'automated-only withdrawal trigger and action'): converts a KB release state without a human sign-off step, the same category of concern the CLAUDE.md guardrail addresses for authoring, extended here to withdrawal."
---

# Withdraw/Rollback Machinery (DF-E2-03)

## Problem / Context

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §7.4 (E2 — surveillance,
update, and registry) lists withdraw/rollback as scope item 11: "Withdraw/rollback when trigger
criteria fire." The E2 go gate (§7.4) requires: "Rollback drill passes and active clients reject
expired/withdrawn KBs as policy requires." §5.7's release state machine names `withdrawn` as one of
three terminal states a release can reach (`superseded | withdrawn | expired`), and §5.6's release
gate table lists "Rollback" as one of the release-readiness rows: "Prior signed release is available
and rollback drill/criteria are documented." `02 §8.4`'s operational-risk table names the failure mode
directly: "Retraction response delay — Active unsafe rule remains deployed," with the stated control
being "Immediate trigger lane, withdrawal state, runtime denylist/registry check, rollback SLA."

This feature (E0, `evidence-foundry-buildout`) builds none of this. It ships the deterministic
`rf-bundle-to-kb-pack` converter and a 4-rule `cbc_suite_v1` vertical slice at proposal status
only — no signed release exists, no registry exists, and therefore no withdrawal state or rollback
target can exist yet. The Deferred Items Triage Table in the parent plan
(`evidence-foundry-buildout-v1.md`, row `DF-E2-03`) categorizes this as **prereq**: "Withdraw/rollback
machinery needs a registry of signed releases to roll back between; none exists before E1" (trigger:
"E1 signed release registry exists").

This spec is seeded jointly from two Phase 6 ADRs, per the parent plan's explicit instruction:

- `docs/adr/0005-kb-serialization-signing-key-custody.md` (ADR-5) recommends the flat, append-only,
  git-tracked signed-release registry this withdrawal/rollback machinery needs *something to roll
  back between* — ADR-5 names `DF-E2-01` and `DF-E2-03` (via ADR-7's cross-reference) as depending on
  its registry-shape recommendation.
- `docs/adr/0007-surveillance-cadence-materiality-classes.md` (ADR-7) ratifies "emergency withdrawal"
  as the fifth materiality class and requires it to be "a human-confirmed action gated on automated
  detection, never a fully automated release step." ADR-7 names `DF-E2-03` explicitly: "withdrawal is
  itself the fifth materiality class this ADR ratifies... and rollback needs the registry (ADR-5) plus
  this ADR's human-confirmed trigger-handling design to know when and how a rollback is initiated."

## Current State (what E0 actually ships)

- No signed release exists anywhere in this repository — `build/kb-pack/cbc_suite_v1/0.1.0-proposal/
  release-manifest.unsigned.json` (P5-T1) is the only manifest artifact, and its `status` field, like
  `modules/anemia/module.json`'s existing precedent, is the literal `"unsigned-stub"` — never
  `active`, `superseded`, `withdrawn`, or `expired` (§5.7's state machine has no state this feature's
  output legitimately occupies except the pre-`signed` proposal states).
- No registry file exists (`ADR-5`'s recommended `releases/registry.json` or equivalent is not
  created by this feature — it is ADR-5's own unimplemented recommendation).
- No withdrawal detection, denylist, or rollback code path exists in `src/engine.js`, `server.mjs`, or
  anywhere else in the runtime. Nothing polls for retraction/correction/withdrawal/safety-notice/
  cutoff-or-formula-change/superseding-guideline events (§7.4 item 3's six named trigger types).
- `ADR-5` and `ADR-7` are both `status: proposed`, not `accepted` — this spec's design sketch below is
  therefore itself provisional pending both ADRs' ratification, exactly as the triage table's
  promotion trigger states.

## Design Sketch

At a `shaping`-level (direction known from the two seeding ADRs, not yet a committed implementation
plan):

1. **Withdrawal state on the registry entry.** Each signed-release registry entry (ADR-5's flat,
   append-only file) gains a `withdrawalState` field distinct from ordinary `supersedes` chaining —
   matching §5.7's state machine, which treats `withdrawn` as a terminal state reachable from `active`,
   separate from the ordinary `active -> superseded` supersession path. A withdrawn entry is never
   deleted or rewritten in place (§7.4 item 9: "Sign new immutable KB; never rewrite the active version
   in place" — the same immutability discipline extends to marking a past release withdrawn).
2. **Trigger classification feeds this machinery, but does not execute it.** ADR-7's five-class
   materiality taxonomy and immediate-trigger lane (retraction, correction, withdrawal, safety notice,
   cutoff/formula change, superseding guideline) classify a detected change as `emergency withdrawal`
   — that classification is `DF-E2-01`'s (surveillance engine) job. This spec's machinery is what
   happens *after* that classification resolves to "emergency withdrawal": recording the withdrawal
   state against the registry entry and initiating rollback, not detecting or classifying the trigger
   itself.
3. **Human-confirmed withdrawal action.** Per ADR-7's ratified default, automated detection may
   surface a candidate emergency-withdrawal event, but the registry write that actually marks a
   release `withdrawn` requires an explicit human-confirmed action — never a fully automated release-
   lifecycle change. This mirrors the CLAUDE.md "No AI-published rule changes" guardrail applied
   symmetrically to un-authoring (withdrawing) a release, per ADR-7's rationale.
4. **Rollback target selection.** When a client-active release is withdrawn, the rollback target is
   the nearest prior signed release without an open withdrawal flag of its own (see frontmatter open
   question on whether this can skip more than one version). §5.6's release gate table requires "Prior
   signed release is available and rollback drill/criteria are documented" as a precondition of any
   release being considered rollback-safe in the first place — this spec's machinery cannot originate
   that precondition; it consumes it.
5. **Runtime rejection of withdrawn/expired KBs.** Per §7.4's E2 go gate ("active clients reject
   expired/withdrawn KBs as policy requires") and `02 §4.18`'s hard runtime rule (restated in ADR-5:
   "the assessment runtime verifies signature, content hash, engine compatibility, and expiry before
   loading; any failure produces 'no assessment produced'"), a load-time check against the registry's
   withdrawal/expiry state is an extension of that same verification step, not a new independent
   mechanism — failing closed (no assessment produced) is the only acceptable failure mode, consistent
   with this feature's deterministic/offline guardrail (see frontmatter open question on how an
   offline client discovers a withdrawal at all).
6. **Rollback drill as an executable test.** The E2 go gate's "rollback drill passes" criterion should
   be exercisable as a deterministic test once the registry (ADR-5) exists: seed a registry fixture
   with an `active` release, a prior signed release, and a simulated withdrawal event; assert the
   runtime's load-time check rejects the withdrawn release and falls back to (or refuses to silently
   substitute) the prior one per whatever policy this spec's open questions resolve.

None of this is implemented by E0 or committed by this spec; `ADR-5` and `ADR-7` both remain
`proposed`, and E1/E2 planning must ratify or revise them before any of the above becomes an
implementation task.

## Promotion Trigger

Per the parent plan's Deferred Items Triage Table: "E1 signed release registry exists." This
machinery cannot be designed past `shaping` until `ADR-5`'s signed-release registry is accepted and a
first real release exists to register, withdraw, and roll back against — before that, there is nothing
concrete to attach a withdrawal state or rollback target to.

## Open Questions

See frontmatter `open_questions`. In summary: who holds withdrawal-confirmation authority and via what
medium; the concrete rollback SLA and how it is measured pre-deployment; whether rollback can skip
more than one withdrawn version; how an offline-first runtime discovers a withdrawal without violating
the deterministic/offline converter-and-runtime guardrail; and whether the E2 go-gate rollback drill
can be authored as a deterministic test against a registry fixture before any live deployment exists.

## References

- ADR: `docs/adr/0007-surveillance-cadence-materiality-classes.md` — ratifies "emergency withdrawal" as
  the fifth materiality class and requires human-confirmed withdrawal action; names `DF-E2-03`
  explicitly as depending on both its taxonomy and `ADR-5`'s registry.
- ADR: `docs/adr/0005-kb-serialization-signing-key-custody.md` — the signed-release registry this
  machinery's withdrawal state and rollback target attach to; names `DF-E2-03` (via `DF-E2-01`'s
  shared dependency) as blocked on its registry recommendation.
- Design spec: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §5.6 (release
  gate table, "Rollback" row), §5.7 (release state machine, `withdrawn` terminal state), §7.4 (E2 scope
  item 11, E2 go gate rollback-drill criterion), §8.4 ("Retraction response delay" risk row).
- Deferred items: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`
  Deferred Items Triage Table, row `DF-E2-03`.
- CLAUDE.md hard guardrails: "No AI-published rule changes... signed release" (extended here to
  withdrawal, per ADR-7's rationale); the deterministic/offline converter-and-runtime constraint
  (governs how a client can safely discover and act on a withdrawal without a network call).
- Related deferred-item specs: `docs/project_plans/design-specs/surveillance-update-registry-engine.md`
  (`DF-E2-01`, detects and classifies the trigger this machinery acts on),
  `docs/project_plans/design-specs/production-monitoring-telemetry.md` (`DF-E2-02`, monitors the
  incidents a withdrawal responds to), `docs/project_plans/design-specs/signed-release-key-custody.md`
  (`DF-E1-06`, the signing/registry substrate this spec's withdrawal state is recorded against).
