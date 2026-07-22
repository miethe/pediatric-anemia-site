---
type: report
schema_version: 2
doc_type: report
report_category: plan-completion
title: "Plan Completion — Rights-Aware Evidence Capture & Taxonomy"
feature_slug: rights-aware-evidence-capture
feature_version: v1
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
status: completed
created: 2026-07-22
updated: 2026-07-22
tier: 3
---

# Plan Completion Report — Rights-Aware Evidence Capture & Taxonomy

**Verdict: complete and reviewer-approved.** All 6 phases / 39 tasks executed; `npm run check`
green (**1624/1624 tests, exit 0**) on the tree integrated with current `main`; `karen` (Tier-3
feature gate) returned **APPROVED** with no over-claiming found.

## Per-wave summary

Executed via `.claude/workflows/execute-plan.js` (run `wf_93cc31a0-04b`), then integrated with a
concurrently-advancing `main`. Phases were serialized (one phase per wave, tasks strictly serial
within a phase) because every phase is `isolation: shared` — parallel phases would have raced the
git index in one working tree.

| Wave | Phase | Tasks | Outcome |
|---|---|---|---|
| 1 | EP-R0 Rights Substrate | 6 | `rights/` tree, 5 vendored+amended schemas, `validate-rights.mjs` (4 gates), all `package.json` wiring |
| 2 | EP-R5 Spec & Doc Truth | 7 | §15/§3.7/§16.2/§3.2 + Appendix B, citation hygiene, `CLAUDE.md` gate fix, NOTICE.md, 5 deferred-item specs |
| 3 | EP-R1 Derived-Fact Coverage | 5 | reference-ranges rights record + bidirectional `KB_JSON_FILES` coverage gate (seam owner) |
| 4 | EP-R2 Source Rights Metadata | 6 | `$defs/source` licence/access/terms, 6 sources backfilled, source→ledger gate (seam consumer), browser smoke |
| 5 | EP-R3 Evidence Taxonomy | 9 | negative invariant (lands first), 3 axis fields, structured locators, 41 passages, numerics re-capture, `derived_synthesis` |
| 6 | EP-R4 Clean-Room Workflow | 6 | workflow doc, deterministic brief generator, contamination guard, ledger plumbing (empty), clinician-minutes brief |

## Reviewer verdict

- **In-run reviewer gates** ran as `general-purpose` substitutes (see Deviations).
- **Feature-level Tier-3 gate — `karen`: APPROVED.** Independently reproduced green on `validate`,
  `verify:d4`, and the rights suite; verified all six central claims against shipped data and
  schemas (not summaries). Its one blocker — integrate the moved `main` before merge — was resolved
  (see below). Nuance it recorded, not a defect: `content_reuse_assessment.decision.status` retains a
  writable `CLEARED_*` enum, but this is a declared/bounded amendment in `schemas/rights/VENDORING.md`
  with zero instances seeded; a future phase seeding those records must extend the D6 lock.

## Governance state at completion (the point of the plan)

- **Zero clearances, zero attestations, zero grounded rules.** 15 rights records, **all
  `overall_status: UNKNOWN`**; `rights_decisions: 0`; no populated `human_reviewer`/`counsel_reviewer`/
  `clinical_reviewer`/`approvedBy[]`/`clinicalApprovers[]` anywhere. `verify:d4` confirms
  `clinicalApprovers[]` empty on all **95 built rules across 2 modules**, checked after the build.
- **Structural, not merely unset:** authoritative `derived_synthesis` and `CLEARED_*` statuses are
  schema-unrepresentable (`not`/`const: null` locks), not just absent.
- **Coverage-gates-only (D7):** a record at `UNKNOWN` passes `npm run validate`; every new gate is
  coverage/consistency-shaped.

## Total wall-clock

- Execution run (`wf_93cc31a0-04b`): ~7h, 49 agents, 0 errors, ~7M subagent tokens.
- Integration + fixes + reviewer gate: same session, single-day.

## Deviations from the plan as written

1. **Reviewer substitution.** The plan's named reviewers (`task-completion-validator`, `karen`) were
   not registered agent types in the execution session, so the workflow's in-run gates ran as
   `general-purpose` with the same edit-less prompt + `VERDICT_SCHEMA` (`verdict.reviewer_type` still
   reported the intended reviewer). The **feature-level `karen` gate ran for real** once the agent was
   deployed from SkillMeat. A memory was written so future sessions have both reviewers registered.
2. **Serialization.** The plan's wave pairing (EP-R0∥EP-R5, EP-R1∥EP-R2) was serialized to 6
   single-phase waves because all phases share one working tree (`isolation: shared`); the
   `integration_owner` mechanism prevents content conflicts but not a git-index race. All declared
   dependencies (incl. `EPR2-T5 ← EPR1-T2`, `EPR5-T7 ← EP-R0`) were honoured by ordering.
3. **Cross-feature composition (user-directed).** `main` merged the Evidence Foundry Buildout
   (`cbc_suite_v1`, #17) during the run. EP-R2/EP-R3 made source+passage rights fields required on
   *every* module; `cbc_suite_v1` predated them. Per the user's decision, `cbc_suite_v1` was brought
   to rights compliance with **triage-only** values (8 sources, 8 sentinel passages, 8 `UNKNOWN`
   rights records, ledger joins) — zero clearances, D6/D7 preserved.
4. **Integration resilience fix.** `validateModule`'s source→rights-record gate now skips when the
   `rights/` tree is absent under `rootDir` (synthetic test roots), still fires fully in the real
   repo — restoring 3 evidence-foundry seeded-bad-fixture tests. Two rights sandbox tests gained
   `'tools'` in their dir-copy list (validate-kb now imports `tools/…/yaml-lite.mjs`).

## No Mode-D escalations

No phase touched auth/payments/production-migrations/deletion. The rights/clearance surfaces were
handled as plumbing + fails-closed tests + never the value, exactly as the plan required.

## Deferred items (carried forward, not done here)

DEF-R1..DEF-R5 each have a design-spec stub under `docs/project_plans/design-specs/` and are recorded
in the plan's `deferred_items_spec_refs`. Residual gap **R-1** (prohibited-excerpt detection is not
deterministic) is recorded **open** in `docs/architecture.md` §7. The two binding bottlenecks — a
credentialed clinician and a named rights owner — remain unfilled and are **not engineering tasks**.

## What this feature did NOT do (honesty boundary)

It made the rights position **measured, not improved**: unblocked zero sources, wrote zero clearances,
created zero attestations, grounded zero of 91 rules. See the feature guide's Known Limitations.
