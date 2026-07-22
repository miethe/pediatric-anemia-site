---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry: Production Monitoring & Telemetry (DF-E2-02)"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-22
feature_slug: evidence-foundry-buildout
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
problem_statement: "No production deployment, monitoring surface, or telemetry pipeline exists to observe activation, abstention, missingness, overrides, alert burden, incidents, and version adoption for a released module — E0/E1 produce no deployed release for any of these seven signals to be collected against."
open_questions:
  - "What counts as 'unnecessary PHI' for each of the seven monitored signals (activation, abstention, missingness, overrides, alert burden, incidents, version adoption) — is there a signal that cannot be collected in aggregate/de-identified form without losing the information it exists to surface?"
  - "How does monitoring distinguish a software incident (engine bug, malformed fact, schema mismatch) from a clinical incident (a rule fired correctly but the underlying guidance was wrong) — per 02 §9.3's explicit acceptance-checklist requirement — when both can present as 'the tool gave a bad output'?"
  - "Does 'incidents' here mean the same incident-response process the human-factors/live-release validation gates require, or a separate lightweight telemetry-only incident log that feeds that process?"
  - "Does alert-burden monitoring correlate against ADR-7's materiality class of the change that produced the currently-active release (ADR-7's own stated rationale for sequencing DF-E2-02 after the materiality taxonomy), and if so, what is the data model linking a monitoring event to a specific signed release/materiality class?"
  - "Where does this telemetry pipeline run — is it part of the same deployment that serves `server.mjs`, or a separate downstream service — given no live deployment exists yet to make this a live infrastructure decision rather than a design one?"
  - "What is the retention/audit policy for collected telemetry, and does it fall under the same validation-data-boundary/de-identification/retention/audit ADR (ADR-6) that governs retrospective validation data, or does it need its own policy?"
explored_alternatives:
  - "Full-fidelity per-decision logging (every assessment's inputs, rule firings, and output persisted verbatim) — not evaluated in depth here; almost certainly fails the '02 §9.3 excludes unnecessary PHI' acceptance gate outright for a system whose stated guardrail is 'no PHI in the public microsite,' since per-decision logging of clinical input facts is itself a PHI-adjacent surface even server-side. Flagged as the alternative this spec's eventual design must explicitly reject or bound, not a viable default."
  - "Aggregate-only counters per signal (activation rate, abstention rate, missingness rate, override rate, alert volume, incident count, version-adoption percentage) with no per-decision trace — closer to what 02 §7.4 item 10's seven named signals actually require; keeps the monitoring surface PHI-free by construction (counts, not content) at the cost of losing per-case debuggability when an incident needs root-causing back to a specific rule/version pairing rather than just a rate change."
  - "No dedicated monitoring surface; rely on ad hoc log inspection and manual incident reports until real usage volume justifies building one — rejected as the default for the same reason DF-E2-01/DF-E2-03 are deferred rather than skipped: 02 §9.3's live-release acceptance checklist makes 'production monitoring excludes unnecessary PHI and distinguishes software from clinical incidents' a named gate, not an optional nice-to-have, for any live clinical use — but building it before a live deployment exists (this feature ships none) would be speculative infrastructure with no real signal to validate against."
---

# Evidence Foundry: Production Monitoring & Telemetry (DF-E2-02)

## Problem / Context

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §7.4 (E2 — surveillance,
update, and registry) item 10 requires the platform to "monitor activation, abstention, missingness,
overrides, alert burden, incidents, and version adoption without unnecessary PHI." §9.3 ("Live-release
acceptance") repeats this as a named, non-optional gate: "Production monitoring excludes unnecessary
PHI and distinguishes software from clinical incidents."

This feature (E0, the `evidence-foundry-buildout` plan) ships **no live deployment** — it ships the
deterministic `rf-bundle-to-kb-pack` converter and a 4-rule `cbc_suite_v1` vertical slice, both
unsigned (`status: "unsigned-stub"` on every module manifest, per CLAUDE.md's guardrail that nothing
here is clinically released). The Deferred Items Triage Table
(`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`, row
`DF-E2-02`) categorizes this as **prereq**: "Production monitoring needs a live deployment; E0/E1
produce no deployed release to monitor." There is nothing running anywhere that the seven named
signals could be collected against yet.

`docs/adr/0007-surveillance-cadence-materiality-classes.md` (ADR-7) is the design input this spec
seeds from. ADR-7 names `DF-E2-02` explicitly and gives the specific reason monitoring design should
wait on (and reference) its materiality taxonomy: the seven signals "are meaningful only when
correlated against the materiality class of the change that produced the currently-active release
(e.g., distinguishing incident spikes following a 'material clinical logic' change from noise
following an 'editorial' one)." ADR-7 stays `proposed`, so this correlation is a design intent, not a
ratified mechanism.

## Current State (what E0 actually ships)

Nothing in this repository today runs continuously or serves live clinical traffic. `server.mjs`
exposes `GET /health`, `GET /api/v1/knowledge-base`, and `POST /api/v1/assess` for local/mirror use;
there is no telemetry emission, no metrics endpoint, no aggregation store, and no incident-logging
path anywhere in the codebase. The browser-local clinician SPA sends no patient data anywhere by
design (CLAUDE.md: "No PHI in the public microsite... The browser assessment sends no patient data
anywhere"), which is itself a constraint any future monitoring design must not silently violate by
adding telemetry that ships facts off-device. No signed release, registry (`DF-E2-01`, deferred), or
surveillance engine exists for a monitored release to be an entry in.

## E1 State (Phase 5, 2026-07-22)

`evidence-foundry-e1-v1` shipped no deployment surface at all — no change to `server.mjs`'s
three existing endpoints, no metrics/telemetry emission path, and no live deployment anywhere. It
did land the review-workflow, signing/registry, and retrospective-harness *machinery* this program
would eventually need a monitored release to exercise, but every one of those artifacts stays
schema-forced inert (empty roster, `signature: null` pre-G2, zero real registry entries) and none of
it constitutes a "deployed release" in this spec's sense. This spec's promotion trigger — "First E1
release activated" — is therefore unmet by construction: there is still nothing running anywhere for
any of the seven named signals (activation, abstention, missingness, overrides, alert burden,
incidents, version adoption) to be collected against, and this spec stays `maturity: shaping`.

## Design Sketch

At a `shaping`-level (direction known, not yet a committed implementation plan):

1. **Seven named signals, aggregate-first.** Per `02 §7.4` item 10, collect: activation rate (how
   often each rule/candidate fires), abstention rate (missingness-driven non-answers, per the
   tri-state fact model), missingness rate (which input facts arrive `unknown` vs. present), override
   rate (clinician disagreement/dismissal signals, if a UI ever records them), alert burden (volume
   of safety flags surfaced per assessment), incident count, and version-adoption percentage (share
   of traffic on the currently-active signed release vs. prior ones). Default to aggregate counters,
   not per-decision traces, per the explored-alternatives rejection of full-fidelity logging above.
2. **PHI exclusion by construction.** Because the only viable default (aggregate counters) never
   stores per-patient facts, "excludes unnecessary PHI" becomes largely a property of the chosen data
   model rather than a redaction step bolted on afterward — matching CLAUDE.md's "no PHI in the public
   microsite" guardrail's spirit even for the server-side monitoring surface, which sees no patient
   data to begin with under E0's current architecture.
3. **Incident classification: software vs. clinical.** `02 §9.3`'s gate requires distinguishing the
   two. Design direction: a software incident is one traceable to an engine/schema/data defect
   (exception, malformed fact, schema-validation failure, non-deterministic output) detectable by
   automated checks already in this feature's scope (`npm run check`'s existing test/validate/build
   surfaces, extended); a clinical incident is a correctly-executing rule whose underlying evidence or
   threshold is later found wrong — that classification cannot be automated and routes to the same
   human clinical-review process CLAUDE.md's "independent clinical review" guardrail already requires
   for authoring, applied here to review of an in-production concern.
4. **Materiality-correlated alert burden.** Per ADR-7's own stated rationale, alert-burden and
   incident signals should carry a reference to the materiality class (ADR-7's five-class taxonomy)
   of the release version active when the signal was recorded, so a spike can be attributed to "the
   change was material clinical logic" vs. "the change was editorial, this is noise." This is a data
   *shape* recommendation, not an implementation — it depends on `DF-E2-01`'s registry existing to
   look up a release's materiality class from a version identifier.
5. **Version adoption.** Requires `DF-E2-01`'s signed-release registry (and `ADR-5`'s signing
   decision, accepted) to exist first — version adoption is meaningless without a registry of
   versions to adopt between.
6. **Deployment surface (open, not decided here).** Whether this pipeline runs inside the same
   process as `server.mjs`, a sidecar, or a wholly separate downstream service is explicitly left
   open (see `open_questions`) — no live deployment exists yet to make this a real infrastructure
   choice rather than a speculative one.

## Promotion Trigger

Per the parent plan's Deferred Items Triage Table: "First E1 release activated." This spec cannot
become a committed implementation plan until an E1 signed release is live somewhere to actually
monitor — E0 and E1-as-planned-here produce no deployed release, so building this pipeline earlier
would have no real traffic to validate the design against.

## Open Questions

See frontmatter `open_questions`. In summary: what "unnecessary PHI" resolves to per signal; how
software-vs-clinical incident classification is operationalized rather than just named as a
requirement; whether "incidents" here is the same incident-response process live-release validation
already requires or a separate feed into it; whether alert-burden/incident signals carry a
materiality-class reference per ADR-7's rationale and what that data model looks like; where this
pipeline is deployed; and whether telemetry retention/audit falls under ADR-6's validation-data-
boundary policy or needs its own.

## References

- ADR: `docs/adr/0007-surveillance-cadence-materiality-classes.md` — names `DF-E2-02` explicitly and
  supplies the materiality-class taxonomy this spec's alert-burden/incident correlation design intent
  depends on.
- ADR: `docs/adr/0006-validation-data-boundary-deidentification.md` — the validation-data-boundary/
  de-identification/retention/audit ADR whose scope may extend to telemetry retention (open question,
  not decided here).
- Design spec: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §7.4 item 10
  (the seven named monitoring signals), §8.4 ("PHI leakage into research" risk row, the closest named
  risk to this spec's PHI-exclusion concern), §9.3 ("Production monitoring excludes unnecessary PHI
  and distinguishes software from clinical incidents" — the live-release acceptance gate this spec
  exists to satisfy).
- CLAUDE.md hard guardrails: "No PHI in the public microsite... The browser assessment sends no
  patient data anywhere"; "No AI-published rule changes... independent clinical review" (extended here
  to clinical-incident classification, which cannot be automated).
- Deferred items: parent plan (`evidence-foundry-buildout-v1.md`) Deferred Items Triage Table, row
  `DF-E2-02`.
- Related deferred-item specs: `docs/project_plans/design-specs/surveillance-update-registry-engine.md`
  (`DF-E2-01`, the signed-release registry this spec's version-adoption signal and materiality-class
  correlation depend on), `docs/project_plans/design-specs/withdraw-rollback-machinery.md` (`DF-E2-03`,
  the withdrawal path that consumes incident signals this spec's design would surface).
