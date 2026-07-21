---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry: Surveillance/Update/Registry Engine (DF-E2-01)"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-21
feature_slug: evidence-foundry-buildout
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
problem_statement: "No engine exists to detect new/changed source evidence for released modules, classify the materiality of any change, and route it through cadence-appropriate review — E0 produces zero surveillance, zero registry, and zero deployed release to surveil."
open_questions:
  - "Which named authorities and topics count as 'high-risk' for the monthly-search cadence floor (per-topic risk-tier assignment is not decided by ADR-7 or this spec — it is real E1/E2 design scope)."
  - "What concrete SLA (hours/days) does 'immediate run' resolve to for each of the six named trigger event types, and who is paged?"
  - "Does the registry live as file-backed sidecar data (consistent with this feature's file-backed KB) or does E2's scale require a service/database — no live deployment exists yet to force this decision."
  - "How does impact-graph traversal (scope item 5) stay consistent across multiple modules once cbc_suite_v1 grows beyond the E0 vertical slice, without duplicating per-rule trace data three ways?"
  - "What measured alert precision is 'good enough' to avoid the surveillance-overload failure mode ADR-7/02 §8.4 names, and how is it measured before any real deployment exists to generate false-positive data?"
explored_alternatives:
  - "Fixed uniform cadence + binary materiality (changed/unchanged) + automated-only withdrawal action — rejected in ADR-7: reproduces the 'surveillance overload' risk and collapses validation-depth proportionality; an automated-only withdrawal action conflicts with the CLAUDE.md 'no AI-published rule changes' guardrail extended to un-authoring."
  - "Risk-tiered cadence + five-class materiality taxonomy (editorial / evidence-only / non-material logic / material clinical logic / emergency withdrawal) + human-confirmed emergency-withdrawal lane — ADR-7's recommended default; adopted verbatim from 02 §7.4 item 6 rather than inventing a new scheme."
  - "Continuous/event-driven-only surveillance with a numeric materiality score — rejected in ADR-7: requires always-on feed infrastructure this program has no plan to operate, and a continuous score reintroduces the probability/likelihood framing CLAUDE.md's ranking-score guardrail already prohibits, extended here to materiality classification."
---

# Evidence Foundry: Surveillance/Update/Registry Engine (DF-E2-01)

## Problem / Context

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §7.4 (E2 — surveillance,
update, and registry) enumerates eleven required capabilities: storing surveillance query/cadence/
owner/review-by/trigger-class metadata per evidence assertion or rule; running monthly automated
searches for named authorities and high-risk topics with quarterly human review; triggering immediate
runs on retraction/correction/withdrawal/safety-notice/cutoff-or-formula-change/superseding-guideline
events; comparing new source editions against the active bundle; traversing the impact graph to
affected decisions/rules/tests/outputs/modules/releases; classifying changes into the five-class
materiality taxonomy; requiring validation depth proportional to that class; writing accepted status
to a shared catalog/registry; signing a new immutable KB rather than rewriting in place; monitoring
activation/abstention/missingness/overrides/alert-burden/incidents/version-adoption; and withdrawing
or rolling back when trigger criteria fire.

This feature (E0, the `evidence-foundry-buildout` plan) builds **none** of this. It ships the
deterministic `rf-bundle-to-kb-pack` converter and a 4-rule `cbc_suite_v1` vertical slice — no
scheduler, no source-diffing, no signed-release registry, and no live deployment exists for any of
these eleven capabilities to run against. The Deferred Items Triage Table in the parent plan
(`evidence-foundry-buildout-v1.md`, row `DF-E2-01`) categorizes this as **prereq**: the engine "needs
a signed, registered E1 release to surveil and re-run against," and that release/registry does not
exist before E1 (see `ADR-5`, `docs/adr/0005-kb-serialization-signing-key-custody.md`, this feature's
Phase 6 signing/registry ADR).

`docs/adr/0007-surveillance-cadence-materiality-classes.md` (ADR-7) is the design input this spec seeds
from: it ratifies (at `status: proposed`, not yet accepted) the *shape* of cadence, materiality
classification, and withdrawal-trigger handling before this engine is designed, specifically so this
spec has a concrete taxonomy rather than re-deriving one from `02 §7.4` independently. ADR-7 names
`DF-E2-01` explicitly as one of the three E2 items depending on its materiality-class taxonomy.

Two operational-risk rows in `02 §8.4` name the failure modes this engine exists to avoid:
"Surveillance overload" (monthly searches generating low-value review burden without risk-tier
cadence, source allowlists, dedupe, and materiality classification) and "Retraction response delay"
(an active unsafe rule remaining deployed without an immediate-trigger lane, withdrawal state, and
rollback SLA).

## Current State (what E0 actually ships)

Nothing in this repository today detects, classifies, or routes evidence changes. `modules/anemia/`
and `modules/cbc_suite_v1/` are static, hand/converter-authored JSON packages with no update
mechanism; there is no cadence store, no registry of signed releases (nothing is signed — every module
manifest's `status` is the literal string `"unsigned-stub"`, per CLAUDE.md's guardrail that nothing
produced by this feature is clinically released), and no monitoring surface. `rf` (Research Foundry)
already has a catalog (`GET $RF_API_URL/api/catalog/search`) that can answer "does a verified claim
already exist," but nothing polls it on a cadence, diffs new editions against an active bundle, or
classifies the result.

## Design Sketch

At a `shaping`-level (direction known, not yet a committed implementation plan):

1. **Cadence + registry store.** Extend the signed-release registry ADR-5 recommends (once accepted)
   with per-evidence-assertion/rule fields matching `02 §7.4` item 1: surveillance query, cadence,
   owner, review-by date, and trigger class. File-backed to match this feature's existing convention
   (`modules/<id>/evidence-assertions.json`, `rule-provenance.json`) unless the open question above
   about service/database scale is resolved otherwise.
2. **Scheduled + triggered detection.** A monthly automated-search job against named authorities/
   high-risk topics (risk-tier assignment: open question) with quarterly human review, per `02 §7.4`
   item 2, running through the same `rf` catalog/search seam this feature's converter already reads
   from — not a new discovery mechanism. An immediate-run lane fires on the six named event types
   (`02 §7.4` item 3) outside the scheduled clock.
3. **Diff + impact-graph traversal.** New source editions/passages/claims are compared against the
   active bundle (`02 §7.4` item 4); the impact graph traces affected decisions, rules, tests,
   outputs, modules, and releases (`02 §7.4` item 5) — this is a read over the rule-provenance/
   evidence-assertion trace data this feature's converter already emits per rule, extended to a
   cross-module graph.
4. **Materiality classification.** Every detected change is classified into ADR-7's five-class
   taxonomy adopted verbatim from `02 §7.4` item 6 (editorial, evidence-only, non-material logic,
   material clinical logic, emergency withdrawal) — a small enumerable class set, deliberately not a
   continuous score, consistent with CLAUDE.md's guardrail against probability/likelihood framing for
   the rule-ranking score, extended here per ADR-7's rationale.
5. **Validation depth by class.** `02 §7.4` item 7: validation depth (which review/test gates must
   re-run) is a lookup by materiality class rather than an ad hoc judgment call; material clinical
   logic repeats clinical review and applicable validation, matching CLAUDE.md's "independent clinical
   review + executable tests + signed release" guardrail.
6. **Signed immutable release + registry write.** `02 §7.4` items 8-9: accepted evidence/run status is
   written to a shared catalog/registry, and a new KB is signed and released immutably — never
   rewriting the active version in place. This depends directly on `ADR-5`'s signing/key-custody
   decision being accepted first.
7. **Monitoring + withdrawal (adjacent, not this engine's scope).** Item 10 (activation/abstention/
   missingness/overrides/alert-burden/incidents/version-adoption monitoring) and item 11 (withdraw/
   rollback) are deliberately out of this spec's scope — they are `DF-E2-02` (production monitoring)
   and `DF-E2-03` (withdraw/rollback machinery) respectively, each with its own Phase 7 design-spec
   stub, though item 11's trigger classification shares this engine's materiality taxonomy.

## Promotion Trigger

Per the parent plan's Deferred Items Triage Table: "E1 signed release + registry exist." This engine
cannot be exercised end-to-end until `ADR-5`'s signing/key-custody decision is accepted and a first
real E1 release exists to surveil and re-run against — before that, this spec stays at `shaping`, not
a committed implementation plan.

## Open Questions

See frontmatter `open_questions`. In summary: per-topic risk-tier assignment for the monthly-search
cadence floor; the concrete SLA and paging path for each immediate-trigger event type; whether the
registry stays file-backed or needs a service/database at E2 scale; how impact-graph traversal stays
consistent once `cbc_suite_v1` grows past the E0 vertical slice into the full CBC suite; and what
"measured alert precision" threshold avoids the surveillance-overload failure mode before any live
deployment exists to generate real false-positive data against.

## References

- ADR: `docs/adr/0007-surveillance-cadence-materiality-classes.md` — ratifies the cadence/materiality/
  withdrawal-trigger taxonomy this spec seeds from; names `DF-E2-01` explicitly as a blocked item.
- ADR: `docs/adr/0005-kb-serialization-signing-key-custody.md` — the signed-release registry this
  engine's cadence/materiality logic depends on existing first.
- Design spec: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §7.4 (E2
  scope items 1-11, E2 go gate), §8.4 ("Surveillance overload", "Retraction response delay" risk rows).
- Deferred items: parent plan (`evidence-foundry-buildout-v1.md`) Deferred Items Triage Table, row
  `DF-E2-01`.
- Related deferred-item specs: `docs/project_plans/design-specs/production-monitoring-telemetry.md`
  (`DF-E2-02`), `docs/project_plans/design-specs/withdraw-rollback-machinery.md` (`DF-E2-03`).
