---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-1: Tri-State Fact Model"
status: draft
created: 2026-07-19
phase: EP-1
phase_title: "Tri-State Fact Model"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
feature_slug: wave0-safety-foundation
entry_criteria: "EP-0 closed (SPIKE-003 decisions recorded, DEF-2 promoted) AND EP-0.5 closed (activation witness for all 49 migration-table rules); npm run check green."
exit_criteria: "not-assessed provably cannot satisfy any rule-out branch; every one of the 49 migrated rules has an activation witness whose output is enumerated + rationalized per D-3 (not merely the 6 original golden fixtures); safety council-review passed before merge; npm run check green."
---

# Phase EP-1: Tri-State Fact Model (WP1)

**Maps to roadmap/PRD WP1.** **13 pts.** Parallel with EP-2 (disjoint files; one shared seam line).

**Dependencies**: EP-0 complete (SPIKE-003 decisions, DEF-2 promoted) **and EP-0.5 complete**
(activation-witness corpus — see the amendment note below).

> **AMENDMENT 2026-07-19 (post-EP-0).** Two corrections to this phase, both from SPIKE-003's empirical
> census and EP-0's coverage measurement:
>
> 1. **Scope is 49 rules, not 33.** SPIKE-003 RQ7a supersedes the charter figure: 49 of 91 rules
>    reference a boolean-collapse fact path (including derived `cbc.*`/`g6pd.*`/`hemoglobinAnalysis.*`
>    facts, not only the raw `history.*`/`symptoms.*`/`exam.*` namespace). The full 49-row migration
>    table is in SPIKE-003 § "RQ7(b) — Full 49-row migration table (durable copy)". The census also
>    corrected 56 → **60** boolean fields and 19 → **25** `=== true` occurrences.
> 2. **EP-0.5 is now a hard prerequisite.** Only **17 of the 49** rules being migrated currently have
>    any test witness — **32 migrate blind**, including 3 alerts and both `TEC-001` and `IRIDA-001`
>    (the two rules SPIKE-003 carved out of its GO verdict). "All 6 golden fixtures byte-identical" is
>    a statement about 17 of 49 rules, so it cannot serve as this phase's verification evidence.
>
> **Migration must land atomically.** SPIKE-003's prototype proved a *staged* rollout (fact-shape
> change before rule-syntax change) silently breaks a real fixture with **zero test failures**. Related
> hazard: a tri-state string fed to the old `countTrue()`/`Boolean()` coercion over-counts, since any
> non-empty string is JS-truthy.
>
> **Carve-outs from SPIKE-003's GO verdict**: `TEC-001`/`IRIDA-001` exclusion-gate tightening requires
> `council-review` plus companion question rules; the `statusIs()`/`hemolysisMarkerCount` latent
> missingness gap is explicitly **out of scope** and needs its own ticket.
**Assigned Subagent(s)**: `backend-architect` (design) → `general-purpose` (JS executor, migration);
`code-reviewer` (secondary). Design and execution are split deliberately: the 9 `countTrue` aggregates
need judgment; the 49-rule edit is mechanical once the mapping table exists.
**Entry criteria**: EP-0's SPIKE-003 output (49-row migration table, aggregate decisions, operator
semantics) available; **EP-0.5's activation-witness corpus in place**; `npm run check` green.
**Exit criteria**: dedicated invariant test passes (no rule-out branch satisfiable by `not-assessed`);
D-3's diff enumeration over the EP-0.5 witness corpus (all 49 migrated rules, not just the 6 original fixtures) shows zero unexplained diffs; safety `council-review` gate passed **before
merge**; `npm run check` green; golden outputs match the AC-D3 migration record exactly (no
undocumented diff).

## Integration Ownership (R-P3)

EP-1 ∥ EP-2 share one file: `modules/anemia/ranges.js:42` (`menstruating === true`).
**`integration_owner = EP-1`'s executor.** EP-2 must not edit this line — it only verifies correctness
after EP-1's migration lands (see EP-1-T7 here and EP-2-T5 in the EP-2 phase file).

## Task Table

> **⚠ The figures in the rows below are the SUPERSEDED charter numbers.** The AMENDMENT above is
> authoritative: **49 rules** (not 33), **60** boolean fields (not 56), **25** `=== true` occurrences
> (not 19). EP1-T1's "enumerated allow-list" lean was also superseded by SPIKE-003 RQ4 (schema stays
> open + `anyOf`, with a fail-closed allow-list in `validate-kb.mjs`), and the 4th `not-assessed`
> enum state was rejected — `is-unknown`/`is-not-assessed` ship as synonym operators over a 3-value
> `Tri`. As-built detail: `ep1-migration-design.md` and `ep1-migration-record.md`.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EP1-T1 | Replace `booleanMap` with `triState` schema | Per FR-WP1-01: replace `patient-input.schema.json`'s `booleanMap` $def (`:114-117`) with a `triState` $def. Per SPIKE-003 RQ4/OQ-1's lean, the 56 known `history.*`/`symptoms.*`/`exam.*` fields become an explicit per-module enumerated allow-list (not global open `additionalProperties`), each valued `present`/`absent`/`unknown`/`not-assessed`. | Schema rejects an unrecognized field name — today's silent typo-reads-as-absent becomes a validation failure. | 1.5 pts | general-purpose | sonnet | high | EP-0 (SPIKE-003 RQ4) |
| EP1-T2 | Add 4 tri-state rule-engine operators | Per FR-WP1-02: add `is-present`/`is-absent`/`is-unknown`/`is-not-assessed` as new `case` branches in `src/ruleEngine.js`'s `evaluateLeaf()` switch (`:21-36`), per SPIKE-003 RQ7's semantics. The existing `Unknown rule operator` throw (`:35`) stays unweakened. | Unit tests exercise all 4 operators against all 4 states; an unrecognized operator string still throws. | 1.5 pts | general-purpose | sonnet | high | EP-0 (SPIKE-003 RQ7) |
| EP1-T3 | Author the 33-rule + 9-aggregate migration design | Finalize (from SPIKE-003's prototype output) the reviewed old-count → (present-count, not-assessed-count) mapping for all 9 `countTrue()` aggregates (`facts.anemia.js:75, 96, 99-106, 108-115, 117-127, 129-134, 143-147, 149-154, 191-197`) and the rule-by-rule `{rule id, old op/value, new op(s), golden-fixture impact Y/N}` table for all 33 of 91 rules referencing a tri-state fact path. This is the highest-consequence clinical-semantic judgment call in the phase — stays on primary Claude. | Migration table has one row per affected rule (33/33) and one row per aggregate (9/9); `congenitalMarrowFailureSignals` (the one aggregate that returns a raw count, not a `>0` collapse) has an explicit stated decision on whether its count now excludes or includes not-assessed fields. | 2.5 pts | backend-architect | opus | xhigh | EP1-T1, EP1-T2 |
| EP1-T4 | Migrate fact-derivation logic to tri-state | Per FR-WP1-03: migrate the 19 `=== true` checks in `facts.anemia.js`, the definitional collapse in `src/facts/core.js:3`, and all 9 `countTrue()` sites to tri-state-aware logic per EP1-T3's mapping, distinguishing "N present / M not-assessed" from today's single boolean count. | Every one of the 9 aggregates implements its EP1-T3-decided formula; `npm run check` green; no aggregate silently reverts to a `>0`-only collapse. | 2.5 pts | general-purpose | sonnet | high | EP1-T3 |
| EP1-T5 | Migrate the 33 affected rules | Per FR-WP1-04: migrate the 33 of 91 rules whose `when` referenced a tri-state fact path (101 distinct paths) from implicit falsy checks to explicit tri-state operators, applying EP1-T3's migration table row-for-row. The remaining 58 rules require no edit. | All 33 rules updated per the table; the other 58 rules show zero diff; `modules/anemia/rules.json` still validates against the (unextended-until-EP-4) `rule.schema.json`. | 2.0 pts | general-purpose | sonnet | high | EP1-T3, EP1-T4 |
| EP1-T6 | Safety invariant test — no rule-out on `not-assessed` | Per FR-WP1-05: a dedicated `node:test` asserts that swapping any referenced field to `not-assessed` cannot fire a clearing/rule-out branch, for every rule tagged as clearing. This is D-3's structural backstop, not merely a golden-fixture check. | Test fails if any clearing branch is satisfiable by `not-assessed` for any of the 33 migrated rules; passes today post-migration. | 1.0 pt | general-purpose | sonnet | high | EP1-T5 |
| EP1-T7 | Seam task (owner) — verify `ranges.js:42` post-migration (FR-WP1-07) | Per **AC-SEAM** (target_surfaces: `modules/anemia/ranges.js:42`): after EP1-T4/T5 land, independently verify ferritin-threshold lookups resolve correctly for `menstruating` present/absent/unknown/not-assessed. EP-1 owns this line; EP-2 must not edit it (integration_owner = EP-1). | Seam test passes for all 4 `menstruating` states before EP-2 is considered complete; `ranges.js:42` shows the intended tri-state-aware read, not a leftover `=== true` collapse. | 0.5 pts | general-purpose | sonnet | adaptive | EP1-T4 |
| EP1-T8 | Verify `algorithmExplorer.js:308` UI consumer degrades safely | `src/algorithmExplorer.js:308` is a UI-only display-logic consumer of tri-state-shaped booleans — out of engine scope. Verify (do not edit) that today's `=== true` display check still degrades safely against a tri-state value; a full UI redesign is explicitly not this task's deliverable (DEF-8 territory if it turns out otherwise). | A written confirmation (code comment or task note) that no display-logic change is required, or a minimal compatibility shim if verification finds a break — scoped to compatibility only. | 0.5 pts | general-purpose | sonnet | adaptive | EP1-T5 |
| EP1-T9 | Golden-diff enumeration + clinical rationale (FR-WP1-06, AC-D3) | Per D-3/**AC-D3** (target_surfaces: all 6 `tests/golden/*.json` fixtures + `tests/module-equivalence.test.mjs`): every difference between the pre-EP1 golden fixture and the post-EP1 output, across all 6 examples, is recorded in a migration record, classified `expected-from-tri-state` or `unexpected`, with every expected diff carrying a written clinical rationale. Any diff that clears a differential branch on `not-assessed` is an automatic no-go regardless of rationale offered. | Migration record covers all 6 examples with zero unexplained diffs; no expected diff clears a differential on `not-assessed` (cross-checked against EP1-T6's invariant test); record is the artifact the safety `council-review` gate reviews. | 1.0 pt | backend-architect | opus | high | EP1-T6, EP1-T7 |

**Phase total: 13 pts.**

## Phase EP-1 Quality Gates

- [ ] All 4 new operators pass unit tests against all 4 tri-state values (EP1-T2)
- [ ] 33-rule + 9-aggregate migration table complete and applied (EP1-T3/T4/T5)
- [ ] Safety invariant test green: no rule-out branch satisfiable by `not-assessed` (EP1-T6)
- [ ] AC-SEAM passes: `ranges.js:42` correct for all 4 states (EP1-T7)
- [ ] AC-D3: zero unexplained golden diffs, every expected diff rationalized (EP1-T9)
- [ ] **Safety `council-review` gate passed before merge** (decisions-block P1 exit criterion — reviews
      EP1-T9's migration record)
- [ ] `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../wave0-safety-foundation-v1.md)
