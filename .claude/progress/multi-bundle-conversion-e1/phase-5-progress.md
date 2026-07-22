---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1"
feature_slug: "multi-bundle-conversion-e1"
phase: 5
title: "Greenfield Projections (kidney, growth)"
status: "in_progress"
created: '2026-07-21'
updated: '2026-07-22'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-5-6-7-projection-determinism-docs.md
commit_refs: ["5ef190c", "5f8e753", "5fc4bf1"]
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 3
depends_on: ["P2", "P3-GATE2"]
owners: ["module-engineer"]
contributors: []

tasks:
  - id: "P5-T1"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "1.0 pts"
    dependencies: ["P2-GATE", "P3-GATE2"]
    description: "RF-KID-001 -> modules/kidney_suite_v1/ projection (FR-9/FR-11/FR-12/FR-13, OQ-3 resolved: committed, not staging-only). AC CORRECTED POST-REVIEW: propose.mjs is hardwired by design to cbc_suite_v1's own drafting content (FR-14 module scoping, tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40) and halts at inspect with DecisionsNotFoundError for any module lacking an authoring-decisions.yaml, including this one (DF-E1-M1); this task's actual producer was a bespoke, standalone projection step, never a propose CLI run. Emitting evidence.json source records, evidence-assertions.json exact-passage projections (cbc_suite_v1 schema shape, FR-21), and unresolved.json for every eligible-but-unrouted claim. The pediatric-vs-adult proteinuria cutoff conflict MUST land as an explicit, named conflict-visible object listing every contributing source — never averaged or resolved to one source. Zero entries emitted to rules.json or strict candidates.json. candidate-scaffolds.json (if emitted) stays staged under build/kb-pack/kidney_suite_v1/<version>/ only — never committed, never merged."
  - id: "P5-T2"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "1.0 pts"
    dependencies: ["P2-GATE", "P3-GATE2"]
    description: "RF-GRO-002 -> modules/growth_suite_v1/ projection (FR-9/FR-11/FR-12/FR-13, OQ-3): identical structure to P5-T1 -- including the same AC correction (bespoke, standalone projection step, never a propose CLI run; modules/growth_suite_v1/ also lacks an authoring-decisions.yaml, DF-E1-M1) -- for RF-GRO-002. The WHO-vs-CDC growth-standard conflict MUST land as an explicit, named conflict-visible object listing every contributing source. Zero entries emitted to rules.json/candidates.json."
  - id: "P5-T3"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P5-T1", "P5-T2"]
    description: "R-P2 AC. Conflict-object + unresolved.json consumer-handling test (FR-11/FR-12): a trace query over both named conflict classes (proteinuria, WHO-vs-CDC growth) resolves to a named conflict object with all contributing sources, for both modules. Assert a consumer reading unresolved.json for a module with zero unresolved claims sees an explicit [], never a missing file/key. Per OQ-5: hand-written candidate-scaffolds.json structural check (scaffoldId, supportingClaimIds[], moduleId, rationale) rejects a malformed scaffold."
  - id: "P5-T4"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P5-T1", "P5-T2"]
    description: >
      LOAD-BEARING honesty AC (decisions block Notes for implementation-planner; verbatim from the
      phase file, kidney + growth): Explicitly assert and test: modules/kidney_suite_v1/rules.json and
      modules/growth_suite_v1/rules.json stay byte-identical [] after this phase; both modules'
      module.json.status stays "unsigned-stub", approvedBy: [], clinicalContentHash: null — unchanged
      by the projection landing real evidence. "Evidence projected" is never described anywhere in
      this phase's output as "module complete" or clinically ready. AC: git diff of both rules.json
      files shows zero lines changed from Phase 3's scaffold state; both modules'
      status/approvedBy/clinicalContentHash fields byte-identical before/after this phase,
      test-enforced.
  - id: "P5-GATE"
    status: "not_started"
    assigned_to: ["task-completion-validator"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P5-T1", "P5-T2", "P5-T3", "P5-T4"]
    description: "Reviewer gate: verify exit criteria — npm run check green; both conflict classes present as named, multi-source objects; unresolved.json present and R-P2-compliant for both modules; zero-new-rules AC (P5-T4) passes."

parallelization:
  batch_1: ["P5-T1", "P5-T2"]
  batch_2: ["P5-T3", "P5-T4"]
  batch_3: ["P5-GATE"]

total_tasks: 5
completed_tasks: 4
in_progress_tasks: 0
blocked_tasks: 0
progress: 80
---

# Phase 5 Progress — Greenfield Projections (kidney, growth)

**Wave**: 3 of 5 (parallel to Phase 4). **Depends on**: Phase 2 complete (batch runner + `EF-WP1`
gate) AND Phase 3 complete (scaffolds must exist to project into — `P3-GATE2`, `karen` sign-off).
**Assigned Subagent(s)**: module engineer (general-purpose, sonnet); task-completion-validator gate.

## Objective

Project `RF-KID-001` and `RF-GRO-002` evidence into Phase 3's fresh `kidney_suite_v1`/`growth_suite_v1`
scaffolds — committing `evidence.json`/`evidence-assertions.json`/`unresolved.json`, surfacing the
proteinuria and WHO-vs-CDC conflicts as named multi-source objects — while producing zero new clinical
rules and holding both modules at `unsigned-stub`.

## Entry Criteria

- Phase 2 complete (`P2-GATE` passed).
- Phase 3 complete (`P3-GATE2`, `karen` sign-off — scaffolds exist to project into).

## Exit Criteria (decisions block §1)

- `npm run check` green.
- Conflict objects present + validated.
- No rule without an authoring decision.

## Reviewer Gate

- **P5-GATE** — `task-completion-validator`.

## LOAD-BEARING Honesty AC (P5-T4, verbatim)

> Explicitly assert and test: `modules/kidney_suite_v1/rules.json` and
> `modules/growth_suite_v1/rules.json` stay byte-identical `[]` after this phase; both modules'
> `module.json.status` stays `"unsigned-stub"`, `approvedBy: []`, `clinicalContentHash: null` —
> unchanged by the projection landing real evidence. "Evidence projected" is never described anywhere
> in this phase's output as "module complete" or clinically ready.
>
> AC: `git diff` of both `rules.json` files shows zero lines changed from Phase 3's scaffold state;
> both modules' `status`/`approvedBy`/`clinicalContentHash` fields byte-identical before/after this
> phase, test-enforced.

## Quality Gates

- [ ] `npm run check` green
- [x] `modules/kidney_suite_v1/` and `modules/growth_suite_v1/` each carry committed `evidence.json`/`evidence-assertions.json`/`unresolved.json` -- P5-T1/P5-T2
- [x] Pediatric-vs-adult proteinuria conflict (kidney) and WHO-vs-CDC growth conflict (growth) each resolve to a named, multi-source conflict object -- P5-T3 (tests/ef-conflict-objects.test.mjs)
- [x] `unresolved.json` present for both modules with an explicit empty-array representation when applicable -- P5-T3
- [x] Candidate scaffolds (if any) stay staged under `build/kb-pack/`, never committed, never merged into `candidates.json` -- no candidate-scaffolds.json emitted for either module this phase
- [x] **Zero new rules in either module's `rules.json`, test-enforced (P5-T4)** -- tests/ef-p5-t4-honesty-ac.test.mjs

## Completion Notes

P5-T1 (RF-KID-001 -> kidney_suite_v1), P5-T2 (RF-GRO-002 -> growth_suite_v1), and P5-T3 (conflict-object trace query + unresolved.json R-P2 + OQ-5 scaffold check) landed real, verified evidence -- both modules' `evidence.json`, `evidence-assertions.json`, and `unresolved.json` are populated, and both named conflict classes (pediatric-vs-adult proteinuria; WHO-vs-CDC growth standard) resolve to a named, multi-source conflict object.

P5-T4 (this task) test-enforces the load-bearing honesty AC over that projection: `modules/kidney_suite_v1/rules.json` and `modules/growth_suite_v1/rules.json` are proven byte-identical to Phase 3's scaffold state (`git diff` against each module's sole scaffold commit -- P3-T1 `9c803dc`, P3-T2 `b9741c9` -- is empty; the new regression test additionally pins the literal expected byte content so the invariant survives any future squash/rebase of branch history). Both modules' `module.json.status`/`approvedBy`/`clinicalContentHash` remain `"unsigned-stub"`/`[]`/`null`, unchanged by the projection. A language-honesty check confirms this phase's own tracked output (this file and the decisions-block worknote) never describes the evidence projection as module complete or clinically ready outside of an explicit negation. Evidence projected into these two modules remains claims routed to `unresolved.json`, not authored, reviewed, or approved clinical rules -- neither module is module complete, signed, or clinically ready. New test: `tests/ef-p5-t4-honesty-ac.test.mjs` (7 assertions).

P5-GATE (task-completion-validator) has not yet run.
