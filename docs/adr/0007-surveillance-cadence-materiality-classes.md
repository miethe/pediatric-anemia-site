# ADR-7: surveillance cadence, materiality classes, and emergency withdrawal

**Status**: proposed | **Date**: 2026-07-21 | **Author**: documentation-writer (evidence-foundry-buildout, Phase 6)

## Problem

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §7.4 (E2 — surveillance,
update, and registry) enumerates eleven required capabilities without ratifying *how* three of them
should work: (2) cadence — "run monthly automated searches for named authorities and high-risk topics;
perform quarterly human review"; (6) materiality — "classify changes as editorial, evidence-only,
non-material logic, material clinical logic, or emergency withdrawal"; and (3)/(9)/(11) — immediate
triggers ("retraction, correction, withdrawal, safety notice, cutoff/formula change, or superseding
guideline"), signing a new immutable KB rather than rewriting in place, and withdraw/rollback when
trigger criteria fire. `02 §8.5` item 7 lists exactly this bundle — "surveillance cadence, materiality
classes, and emergency withdrawal" — as one of the eight decisions E1 cannot proceed without. Two
operational-risk rows in `02 §8.4` name the failure modes directly: "Surveillance overload" (monthly
searches generate low-value review burden without risk-tier cadence, source allowlists, dedupe, and
materiality classification) and "Retraction response delay" (an active unsafe rule remains deployed
without an immediate trigger lane, withdrawal state, and rollback SLA).

This feature (E0) builds none of the surveillance engine itself — no scheduler, no registry, no
notification path exists yet (`DF-E2-01`, deferred). It also builds no signed release for surveillance
to run against (`ADR-5`, this phase, `DF-E1-06`/`DF-E2-01`). This ADR exists purely to ratify the
*shape* of cadence, materiality, and withdrawal-trigger handling before that E1/E2 engine is designed,
so `DF-E2-01`/`DF-E2-02`/`DF-E2-03`'s design specs (Phase 7) have a concrete taxonomy to seed from
rather than re-deriving one from `02 §7.4` independently three times.

## Decision

**Recommended default: adopt `02 §7.4` item 6's five-class materiality taxonomy verbatim (editorial,
evidence-only, non-material logic, material clinical logic, emergency withdrawal); pair it with a
risk-tiered surveillance cadence (monthly automated search as the floor for named authorities and
high-risk topics, quarterly human review, per `02 §7.4` item 2) plus an immediate trigger lane for the
six named event types in `02 §7.4` item 3; and require emergency withdrawal to be a human-confirmed
action gated on automated detection, never a fully automated release step.** This ADR does not accept
this recommendation — it stays `proposed`; E1/E2 planning must ratify or revise it.

### Considered Alternatives

1. **Fixed uniform cadence, binary materiality (changed/unchanged), automated-only withdrawal trigger
   and action**
   - Pros: simplest to schedule and implement — one calendar job, one boolean flag per evidence
     record/rule, no per-topic risk classification to design up front.
   - Cons: directly reproduces the "Surveillance overload" risk `02 §8.4` already names — uniform
     monthly review across a growing rule set generates low-value review burden with no dedupe or
     risk-tier filter; binary materiality cannot express the distinction `02 §7.4` item 7 depends on
     ("validation depth proportional to change class; material logic repeats clinical review") —
     everything gets the same validation depth, which is either wasteful (re-reviewing editorial
     fixes at full clinical depth) or dangerous (treating material clinical logic like an editorial
     tweak); an automated-only withdrawal *action* (not just detection) converts a KB release without
     a human sign-off step, which is the same category of concern CLAUDE.md's "No AI-published rule
     changes" guardrail addresses for authoring — the guardrail's intent extends naturally to
     un-authoring (withdrawal) a release.
   - Decision: rejected — collapses two risks this feature is explicitly designed to avoid.

2. **Risk-tiered cadence + five-class materiality taxonomy (verbatim `02 §7.4` item 6) +
   human-confirmed emergency-withdrawal lane (recommended default)**
   - Pros: matches the design spec verbatim (`02 §7.4` items 2, 3, 6, 7, 9, 11) rather than inventing a
     new scheme; directly implements `02 §8.4`'s own stated mitigation for surveillance overload
     ("risk-tier cadence, source allowlists, dedupe, materiality classification, measured alert
     precision"); the five discrete classes are a small, enumerable, reviewable set — validation depth
     can be looked up by class rather than computed from a continuous score, keeping the escalation
     path deterministic; the immediate-trigger lane (retraction, correction, withdrawal, safety notice,
     cutoff/formula change, superseding guideline) can fire outside the monthly/quarterly clock while
     still routing to a human-confirmed withdrawal step, satisfying both the "Retraction response
     delay" mitigation and the no-autonomous-release-change guardrail.
   - Cons: more upfront design work than the fixed/binary option — per-topic risk-tier assignment
     (which named authorities and topics count as "high-risk," e.g. iron-deficiency thresholds vs.
     marrow red-flag safety rules) is not decided by this ADR and becomes real E1/E2 design scope; the
     scheme is only fully implementable once a signed-release registry exists to run cadence and
     trigger checks against (`ADR-5`'s recommendation, `DF-E2-01`), so this ADR necessarily stays
     `proposed` pending that registry, not implementable standalone today.
   - Decision: **recommended** — implements the spec's own named mitigation for the exact risk it is
     meant to close, at the cost of deferred (not avoided) per-topic risk-tier design work.

3. **Continuous/event-driven-only surveillance with a continuous numeric materiality score (no
   scheduled cadence, always-on feed polling, materiality as a threshold on a score rather than a
   discrete class)**
   - Pros: theoretically lowest latency to detect a retraction or safety notice; sidesteps the
     "which cadence bucket" design question entirely by treating everything as event-driven.
   - Cons: requires always-on infrastructure and reliable third-party feeds/webhooks this repository
     has no plan to operate — E2 itself is explicitly deferred and no live deployment exists yet
     (`02 §8.5`'s own scoping note; `DF-E2-02` production-monitoring's own triage-table reason:
     "needs a live deployment; E0/E1 produce no deployed release to monitor"); a continuous numeric
     materiality score reintroduces exactly the "probability/likelihood" framing CLAUDE.md's hard
     guardrail prohibits for the rule-ranking score ("the ranking score is an internal ordinal sort
     priority — not a probability... or performance metric") — the same non-probability discipline
     should extend to materiality classification, which is why a small enumerable class set (not a
     score) is the right shape regardless of cadence model.
   - Decision: rejected for E1/E2 — infrastructure this program has no plan to operate, and a scoring
     model that would need its own guardrail exception.

## Rationale

- Cadence, materiality, and withdrawal are ratified together in one ADR because `02 §7.4` items 2, 3,
  6, 7, 9, and 11 are one coherent lifecycle, not three independent design questions: cadence
  determines *when* a change is detected; materiality determines *how seriously* it is treated once
  detected; the immediate-trigger lane and human-confirmed withdrawal determine *what happens* when
  materiality resolves to "emergency withdrawal." Splitting these into separate ADRs would risk an
  inconsistent seam between detection cadence and the class that gates validation depth.
- The five-class taxonomy is adopted verbatim from `02 §7.4` item 6 rather than invented, because the
  design spec already enumerates it and this ADR's job is to ratify the spec's own scheme, not propose
  an alternative absent a concrete reason to diverge (none of the three alternatives above found one).
- Emergency withdrawal is deliberately kept a *human-confirmed* action gated on automated detection,
  never a fully automated release-lifecycle change — this is the same discipline CLAUDE.md's "No
  AI-published rule changes" guardrail already requires for authoring a new rule, applied symmetrically
  to retiring one. Automating detection (fast) while requiring a human act on withdrawal (safe) is the
  option that satisfies both the "Retraction response delay" risk mitigation and this guardrail at once.
- This ADR is downstream of `ADR-5`'s signed-release-registry recommendation: surveillance has nothing
  to compare new source editions against, and withdrawal has no registry entry to mark withdrawn,
  until a registry exists. The two ADRs compose — `ADR-5` seeds the registry shape, this ADR seeds the
  cadence/materiality/trigger logic that runs against it.

## Consequences

### Positive
- E1/E2 planning can proceed directly to designing the surveillance/registry engine (`DF-E2-01`)
  against a ratified cadence-and-materiality scheme, rather than re-deriving one from `02 §7.4`
  independently.
- Validation depth becomes a lookup by materiality class (`02 §7.4` item 7) instead of an ad hoc
  judgment call per detected change, making the review burden proportional and auditable.
- The human-confirmed emergency-withdrawal design keeps the "no AI-published rule changes" guardrail
  intact into the withdrawal path, closing a gap this feature would otherwise leave open for E1/E2.

### Negative
- Per-topic risk-tier assignment (which authorities/topics are "high-risk" for the monthly-search
  floor) is not decided here — it is real, unstarted E1/E2 design and implementation scope.
- The scheme cannot be exercised end-to-end until `ADR-5`'s signed-release registry is accepted and
  implemented; this ADR's recommendation is a design input, not a working system.
- A five-class taxonomy requires downstream tooling (the surveillance engine, monitoring dashboards) to
  agree on class semantics consistently; a class-definition drift between the engine and any reviewer
  UI would reintroduce ambiguity this ADR is meant to remove.

### Neutral
- Choosing risk-tiered cadence over fixed cadence is reversible before `DF-E2-01` implementation
  begins — no surveillance engine exists yet to migrate off a different scheme.

## Implementation

Not applicable at `proposed` status — no immediate actions are authorized by this ADR. Acceptance (a
future E1/E2 planning decision, not part of this feature) would trigger `DF-E2-01`/`DF-E2-02`/
`DF-E2-03` design-and-implementation planning against the ratified taxonomy.

## Deferred Items Unblocked

This ADR is the design input the deferred-items triage table
(`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md` § Deferred
Items & In-Flight Findings Policy) names explicitly — all three E2 items depend on this ADR's
materiality-class taxonomy:

- **DF-E2-01** — Surveillance/update/registry engine: the engine that runs cadence checks, classifies
  detected changes, and routes emergency triggers needs this ADR's ratified cadence-and-materiality
  scheme to have anything concrete to implement against (triage table: "needs a signed, registered E1
  release to surveil and re-run against" — this ADR supplies the *logic* that runs once that release
  and registry, `ADR-5`, exist). Seeds `docs/project_plans/design-specs/surveillance-update-registry-engine.md`
  (`P7-T10`).
- **DF-E2-02** — Production monitoring: `02 §7.4` item 10 requires monitoring "activation, abstention,
  missingness, overrides, alert burden, incidents, and version adoption" — those signals are meaningful
  only when correlated against the materiality class of the change that produced the currently-active
  release (e.g., distinguishing incident spikes following a "material clinical logic" change from noise
  following an "editorial" one), so production monitoring's design depends on this ADR's taxonomy
  existing first. Seeds `docs/project_plans/design-specs/production-monitoring-telemetry.md` (`P7-T11`).
- **DF-E2-03** — Withdraw/rollback machinery: withdrawal is itself the fifth materiality class this ADR
  ratifies ("emergency withdrawal"), and rollback needs the registry (`ADR-5`) plus this ADR's
  human-confirmed trigger-handling design to know when and how a rollback is initiated (triage table:
  "needs a registry of signed releases to roll back between; none exists before E1" — this ADR supplies
  the trigger-classification half of that gap). Seeds
  `docs/project_plans/design-specs/withdraw-rollback-machinery.md` (`P7-T12`, seeded from `ADR-5`/`ADR-7`
  jointly).

## References

- Design spec: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §7.4 (E2 scope
  items 1-11, E2 go gate), §8.4 ("Surveillance overload", "Retraction response delay" risk rows), §8.5
  item 7.
- Related ADR: `docs/adr/0005-kb-serialization-signing-key-custody.md` (signed-release registry this
  ADR's cadence/materiality logic runs against).
- Deferred items: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`
  Deferred Items Triage Table, rows DF-E2-01, DF-E2-02, DF-E2-03.
- CLAUDE.md hard guardrails: "No AI-published rule changes... signed release" (extended here to
  withdrawal); "the ranking score is an internal ordinal sort priority — not a probability... or
  performance metric" (extended here to materiality classification).

## Metadata

- **Author**: documentation-writer (evidence-foundry-buildout Phase 6, task P6-T7)
- **Reviewers**: pending (this ADR is `proposed`, not reviewed/accepted)
- **Epic/Story**: `evidence-foundry-buildout` Phase 6 (Pre-E1 ADRs)
- **Affected Components**: none in this repository today (no surveillance engine, registry, or
  monitoring exists yet); future `DF-E2-01`/`DF-E2-02`/`DF-E2-03` implementation
- **Risk Level**: Medium (governance-critical for E2, but zero surveillance/withdrawal automation
  exists yet, so the cost of revising this ADR before acceptance is low)
