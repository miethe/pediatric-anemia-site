---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-6: Adversarial Validation Corpus"
status: draft
created: 2026-07-19
phase: EP-6
phase_title: "Adversarial Validation Corpus"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
feature_slug: wave0-safety-foundation
entry_criteria: "EP-5 closed (manifest verifies, fail-closed paths tested) AND EP-0.5 closed (baseline activation-witness corpus exists)."
exit_criteria: "4 suites green; mutation-score baseline defined and met; 10 DM families executable; npm run check green."
---

# Phase EP-6: Adversarial Validation Corpus (WP6)

**Maps to roadmap/PRD WP6.** **9 pts** (10 original decisions-block anchor − 1 pt moved to EP-0 for CI
hardening per **OQ-6**, resolved — see the main plan's EP↔WP mapping section).

> **AMENDMENT 2026-07-19 (post-EP-0): re-scoped from "build a corpus" to "make the corpus
> adversarial."** This phase was written assuming it starts from the 6-fixture baseline. EP-0 found
> that baseline gives an activation witness to only **30 of 91 rules** (61 never fire, including six
> ALERTs), which made corpus-building a blocker for EP-1 and EP-5 — not a finale. The foundational
> witness work therefore moved into the new **EP-0.5**, which this phase now builds on.
>
> This phase's remaining scope: the adversarial layer — ARC's 10 DM-* families, property/boundary
> suites, mutation scoring, and **SPIKE-005's seeded-mutation corpus M01–M57** (52 rows from EP0-T3
> plus M53–M57 from EP0-T4's cross-family adversarial pass, including the verified double-blind M57).
> Note SPIKE-005 marks M38/M39/M48–M52 as deliberately **blind** rows whose assertion is inverted: the
> structural classifier is *expected* to report clean and the behavioral probe must fail instead.
>
> **Estimate to be revisited at EP-5 close** now that the foundational work has moved out.

**Dependencies**: EP-5 complete (validates the corpus against a manifest-verified KB, per the
decisions block's P5↔P6 boundary rationale: running these suites against an unverified KB would leave
the fail-closed paths untested).
**Assigned Subagent(s)**: `general-purpose` (suite authoring); adversarial reviewer (cross-family,
`fable`) for the dangerous-miss gate.
**Entry criteria**: `npm run check` green with EP-5's manifest/fail-closed work in place.
**Exit criteria**: `property.test.mjs`, `boundary.test.mjs`, `mutation.test.mjs`,
`dangerous-miss.test.mjs` all green; mutation-score baseline defined from a real measurement run (OQ-4)
and met; all 10 ARC-named dangerous-miss families pass as executable fixtures; the dangerous-miss
adversarial review (highest-stakes gate in the whole plan) passes.

## Cross-Plan Dependency (Risk 5)

`arc-clinical-council-adoption-v1.md` **P4-T1** converts the same `DM-CBC-001..DM-WORKFLOW-010`
families into non-patient synthetic scenario specs. **This phase (EP6-T4) owns the executable-fixture
conversion** — EP-6 is where the fixtures must actually run against the real engine. The ARC Adoption
plan's P4-T1 consumes EP6-T4's fixtures rather than re-deriving them; both plans record this edge in
`related_documents`.

## D-5 Reminder

Both `property.test.mjs` (EP6-T1) and `mutation.test.mjs`/`mutation-run.mjs` (EP6-T3) are the two
places in this plan (alongside EP-2's units work) tempted to add the repo's first external dependency
(e.g. `fast-check`, Stryker). Default per D-5: **hand-roll against `node:test` with seeded deterministic
generators and a closed unit table.** Any dependency requires a written rationale, never silent.

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EP6-T1 | `tests/property.test.mjs` | Per FR-WP6-01: hand-rolled seeded deterministic generators against `node:test` (D-5) exercising fact-derivation and rule invariants, including FR-WP1-05's narrowing invariant (cross-checked against EP1-T6). | Generators are seeded (reproducible failures on a fixed seed); no `fast-check`-class dependency added without a D-5 rationale recorded in this plan. | 2.0 pts | general-purpose | sonnet | high | EP-5 |
| EP6-T2 | `tests/boundary.test.mjs` | Per FR-WP6-02: boundary-value cases at every numeric threshold in `modules/anemia/rules.json` (e.g., ferritin exactly at 20/30 ng/mL). | Every threshold-bearing rule has an at-boundary and one-unit-past-boundary case; covers EP-2's fail-closed unit boundary alongside clinical thresholds. | 1.5 pts | general-purpose | sonnet | high | EP-5 |
| EP6-T3 | `tests/mutation.test.mjs` + `scripts/mutation-run.mjs` | Per FR-WP6-03: hand-rolled mutation runner (D-5). Mutation-score baseline is defined empirically in this task (OQ-4) — measured over rules and facts, not guessed in advance. | Baseline is recorded from a real measurement run, not asserted; subsequent runs gate on ≥ baseline; the runner is bespoke `node:test` tooling, not a Stryker-class dependency, unless D-5's rationale is recorded. | 2.5 pts | general-purpose | sonnet | high | EP-5 |
| EP6-T4 | `tests/dangerous-miss.test.mjs` — encode 10 ARC DM-* families | Per FR-WP6-04 and Risk 5: encode ARC's 10 named families (`DM-CBC-001..DM-WORKFLOW-010`) as executable fixtures against the real engine. This phase owns the conversion (see Cross-Plan Dependency above); `arc-clinical-council-adoption-v1.md` P4-T1 consumes these fixtures rather than re-deriving them. | All 10 families have an executable fixture with expected alert/abstention and a passing test; each fixture's expected behavior is traceable to the ARC hazard family it encodes. | 2.0 pts | general-purpose | sonnet | medium | EP6-T2, EP-5 |
| EP6-T5 | **Dangerous-miss adversarial review** | Highest-stakes reasoning gate in the whole plan: "what would this engine miss that harms a child?" Independent adversarial review of EP6-T4's fixtures plus the full rule/candidate set for gaps the 10 named families don't cover. Premium model unambiguously justified — no verifier downstream if this misses something. | Review produces either a "no gap found, here is what I probed" statement or a filed, owned follow-up for any newly-identified dangerous-miss scenario; this is the gate the roadmap's V1 "dangerous-miss review by a clinical advisor" criterion partially informs but does **not** satisfy — recorded as `not_executed_owner_held` per D-4 (ARC/adversarial review is not a credentialed clinical sign-off). | 1.0 pt | general-purpose | fable | max | EP6-T4 |

**Phase total: 9 pts.**

## Phase EP-6 Quality Gates

> **AMENDMENT 2026-07-21 (at EP-6 close): EP6-T4 was a gap-fill, and the "all 10 families" gate is
> met as 8/10 executable + 2/10 honestly uncontrolled.**
>
> **On ownership (Risk 5 was inverted).** This plan states EP-6 owns converting the ten
> `DM-CBC-001..DM-WORKFLOW-010` families into executable fixtures, with
> `arc-clinical-council-adoption-v1.md` P4-T1 consuming them. In fact P4-T1 had already done the
> conversion: `tests/dangerous-miss-scenarios.test.mjs` already executes the real engine. Re-deriving
> would have duplicated ~30KB of verified work and created two competing sources of truth for the same
> hazards, so EP6-T4 was re-scoped to the residual gaps (see the commit and the findings register).
>
> **On the 10/10 gate.** Eight families are behaviorally executable against the real engine. **DM-EQUITY-009
> and DM-WORKFLOW-010 carry `controlBinding: no_control_exists`** and are structurally asserted as
> unexecuted. This is deliberate and is the safety-correct outcome: neither family has an engine to test
> — they would require a subgroup/equity evaluator and an alert-lifecycle state machine, and
> `assessPediatricAnemia` is a stateless pure function with neither. Fabricating a control to reach a
> cosmetic 10/10 would hide two unmitigated patient-safety hazards behind a passing test. The gate is
> therefore recorded as **met-with-recorded-exception**, not silently ticked.
>
> **On EP6-T5.** The review is **not** a none-found result: 19 findings, 5 critical, in
> `.claude/findings/wave0-ep6-validation-corpus-findings.md`. None were fixed — they are KB/rule-level
> defects and the repo forbids AI-published rule changes. Recorded per D-4 as `not_executed_owner_held`.

- [ ] All 4 new test files (`property`, `boundary`, `mutation`, `dangerous-miss`) green
- [ ] Mutation-score baseline defined from a real measurement run and met (EP6-T3, OQ-4)
- [ ] All 10 ARC-named dangerous-miss families pass as executable fixtures (EP6-T4)
- [ ] **Dangerous-miss adversarial review complete; result honestly recorded as
      `not_executed_owner_held` for the credentialed-sign-off half of the V1 gate** (EP6-T5)
- [ ] Zero new dependencies, or exactly one recorded per D-5 (EP6-T1, EP6-T3)
- [ ] `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../wave0-safety-foundation-v1.md)
