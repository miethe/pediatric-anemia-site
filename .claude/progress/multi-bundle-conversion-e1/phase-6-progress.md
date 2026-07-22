---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1"
feature_slug: "multi-bundle-conversion-e1"
phase: 6
title: "REG Hold, Determinism & Validation Gate"
status: "not_started"
created: '2026-07-21'
updated: '2026-07-21'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-5-6-7-projection-determinism-docs.md
commit_refs: []
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 4
depends_on: ["P4", "P5"]
owners: ["validation-engineer"]
contributors: []

tasks:
  - id: "P6-T1"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: []
    description: "REG-001/REG-004 rights-posture HOLD record (FR-4/FR-19): author docs/legal/reg-001-reg-004-hold.md documenting both REG-001 (rf_run_20260717_reg_001_pediatric_cds_map_the) and REG-004 (rf_run_20260717_reg_004_pediatric_cds_scope_the) remain status: not_executed_owner_held (rf-handoff/RESULTS.md §5), are legal-review memos — not CDS-module evidence — and are excluded from every fixture/converter/clinical-drafting pathway until legal sign-off lands. Cross-references rf-handoff/RESULTS.md §5 explicitly. (Can start any time after Phase 2; sequenced here per decisions block boundary.)"
  - id: "P6-T2"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P6-T1", "P4-GATE", "P5-GATE"]
    description: "REG-exclusion final regression sweep (FR-4/FR-19): repository-wide check (not only Phase 2's batch-list test) confirming no fixture, module content, or converter artifact anywhere in the repository — including everything landed by Phases 1-5 — references REG-001/REG-004's run IDs, source-card IDs, or runs/ paths."
  - id: "P6-T3"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "1.25 pts"
    dependencies: ["P4-GATE", "P5-GATE"]
    description: "Multi-bundle determinism double-run suite (FR-17, decisions block Risk 5): run the full P2-T3 batch (all 4 clinical bundles) twice against byte-identical fixture inputs and the same converter version; assert byte-identical output (SHA-256 equality) across every emitted file, independently per bundle, and for the aggregate multi-bundle-conversion-report.json. Canonical sort/serialize everywhere; stable iteration order confirmed."
  - id: "P6-T4"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.75 pts"
    dependencies: ["P6-T3"]
    description: "Finalize multi-bundle-conversion-report.json as single source of truth (FR-5, Observability NFR): confirm the aggregate report (P2-T4's schema) is populated with real post-Phase-4/5 data — per-bundle and aggregate counts including rules emitted (expected 0 across all 4 bundles, matching P4-T8/P5-T4 diff evidence). >=3 named conflict classes across the 4 bundles (WHO-vs-CDC growth, ANC-cutoff variance, proteinuria). Every field's empty/missing representation (R-P2) re-verified against real, final data."
  - id: "P6-GATE1"
    status: "not_started"
    assigned_to: ["task-completion-validator"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P6-T1", "P6-T2", "P6-T3", "P6-T4"]
    description: "Reviewer gate: verify exit criteria — full npm run check green; determinism suite green (all 4 bundles, SHA-256 equality); REG exclusion confirmed repo-wide; conversion report finalized with 0-rules evidence."
  - id: "P6-GATE2"
    status: "not_started"
    assigned_to: ["karen"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P6-GATE1"]
    description: "karen milestone review (Tier-3 reviewer gate, 2nd of 3 named milestones) — REG hold, determinism & honesty. Independently re-check against the actual diff: the REG hold record's completeness and cross-reference accuracy; the determinism suite's real SHA-256 equality (not merely 'test passed'); CLAUDE.md hard guardrails ('no AI-published rule changes,' 'no invented thresholds,' 'missingness never treated as normal') against Phases 4-6's actual output. Runs before Phase 7 opens."

parallelization:
  batch_1: ["P6-T1", "P6-T3"]
  batch_2: ["P6-T2", "P6-T4"]
  batch_3: ["P6-GATE1"]
  batch_4: ["P6-GATE2"]

total_tasks: 6
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
progress: 0
---

# Phase 6 Progress — REG Hold, Determinism & Validation Gate

**Wave**: 4 of 5. **Depends on**: Phase 4 complete AND Phase 5 complete.
**Assigned Subagent(s)**: validation engineer (general-purpose, sonnet); task-completion-validator
gate; **karen milestone review** (2nd of 3 named Tier-3 gates).

## Objective

Record `REG-001`/`REG-004`'s standalone rights-posture HOLD record, sweep the full repository for any
REG leakage, prove multi-bundle determinism by double-run SHA-256 equality, and finalize
`multi-bundle-conversion-report.json` as the single aggregate surface demonstrating the "0 rules across
all 4 bundles" claim by diff, not prose. The multi-bundle conversion report closes here.

## Entry Criteria

- Phase 4 complete (`P4-GATE` passed).
- Phase 5 complete (`P5-GATE` passed).

## Exit Criteria (decisions block §1)

- Full `npm run check` green.
- Determinism suite green.
- `karen` mid/near-end review.

## Reviewer Gate

- **P6-GATE1** — `task-completion-validator`.
- **P6-GATE2** — `karen` milestone review (must pass before Phase 7 opens).

## Quality Gates

*Validated at P6-GATE1 (task-completion-validator):*
- [ ] Full `npm run check` green
- [ ] Determinism suite green — SHA-256 byte-identity across two full-batch runs, all 4 bundles
- [ ] Zero references to `REG-001`/`REG-004` anywhere in `tests/fixtures/**`, `modules/**`, `build/kb-pack/**` (repo-wide)
- [ ] `multi-bundle-conversion-report.json` finalized, real data, 0-rules confirmed

*Validated at P6-GATE2 (`karen` milestone review):*
- [ ] `karen` sign-off recorded

## Completion Notes

_Not started. Fill in when phase work begins._
