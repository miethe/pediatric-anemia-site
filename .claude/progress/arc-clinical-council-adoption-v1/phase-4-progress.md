---
type: progress
schema_version: 2
doc_type: progress
prd: arc-clinical-council-adoption-v1
feature_slug: arc-clinical-council-adoption-v1
phase: 4
status: in_progress
created: '2026-07-19'
updated: '2026-07-20'
prd_ref: docs/project_plans/expansion/00-expansion-plan.md
plan_ref: docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
commit_refs:
- 7a73cb6
- 347384c
- 37ab945
pr_refs: []
execution_model: batch-parallel
plan_structure: unified
owners:
- safety-test-engineer
contributors: []
tasks:
- id: P4-T1
  status: completed
  assigned_to:
  - python-backend-engineer
  dependencies: []
  description: 'Convert DM-CBC-001 through DM-WORKFLOW-010 into non-patient synthetic
    scenario specifications: ten versioned fixtures with expected alert/abstention,
    trace, owner, and rollback signal.'
  started: 2026-07-19T00:00Z
  completed: 2026-07-19T00:50Z
  evidence:
  - artifact: schemas/dangerous-miss-scenario.schema.json
  - test: tests/dangerous-miss-scenarios.test.mjs 46 subtests
  - test: npm run check 185/185 passed
  - commit: 7a73cb6
  verified_by:
  - P4-V1
- id: P4-T2
  status: completed
  assigned_to:
  - python-backend-engineer
  dependencies:
  - P4-T1
  description: Bind every dangerous-miss family to rules/controls, required tests,
    candidate version, evidence, and release gate. Hazard-to-control matrix with no
    unowned gap.
  started: 2026-07-19T01:00Z
  completed: 2026-07-19T01:45Z
  evidence:
  - artifact: docs/safety/hazard-control-matrix.json
  - artifact: schemas/hazard-control-matrix.schema.json
  - test: npm run check 209/209 passed
  - commit: 7a73cb6
  verified_by:
  - P4-V1
- id: P4-T3
  status: completed
  assigned_to:
  - general-purpose
  dependencies: []
  description: 'Freeze V3 intended use, dataset/reference standard, endpoints, uncertainty,
    subgroup, analysis, and adjudication artifacts. Only approved protocol-bound results
    can satisfy V3. OQ-4 is owner-held: ship the contract, never invent the dataset
    or intended use.'
  started: 2026-07-19T00:00Z
  completed: 2026-07-19T00:30Z
  evidence:
  - artifact: docs/clinical/v3-diagnostic-accuracy-contract.md
  - artifact: docs/clinical/schemas/v3-protocol-result.schema.json
  - test: npm run check 139/139 passed
  - commit: 7a73cb6
  verified_by:
  - P4-V1
- id: P4-T4
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P4-T3
  description: Add V4 silent-mode and V5 human-factors protocol-through-adjudication
    contracts, including alert lifecycle, override, downtime, handoff, recovery, and
    equity. Build state cannot satisfy study state.
  started: 2026-07-19T00:30Z
  completed: 2026-07-19T01:20Z
  evidence:
  - artifact: docs/clinical/v4-v5-safety-human-factors-contract.md
  - artifact: docs/clinical/schemas/v4-v5-safety-human-factors-result.schema.json
  - test: 8 fail-closed guards verified by rejection
  - commit: 7a73cb6
  verified_by:
  - P4-V1
- id: P4-V1
  status: in_progress
  assigned_to:
  - pediatric-safety-human-factors-reviewer
  - diagnostic-accuracy-methods-reviewer
  - task-completion-validator
  dependencies:
  - P4-T2
  - P4-T4
  description: Execute synthetic suites and obtain the eight specialty lenses plus
    methods, safety, human-factors, and equity review. Authored scenarios and executed
    results are reported separately.
  started: 2026-07-19T02:00Z
  completed: 2026-07-19T04:30Z
  evidence:
  - test: PED npm run check 305/305 pass 0 fail (validator-executed)
  - test: ARC pytest 1076 passed 6 skipped 426 subtests
  - test: arc validate . clean
  - review: safety-human-factors PASS on current tree
  - review: diagnostic-accuracy-methods PASS cycle 3
  - review: equity-patient-family PASS
  - review: task-completion-validator 3/3 discrimination proofs reproduced
  - commit: 7a73cb6
  verified_by:
  - task-completion-validator
parallelization:
  batch_1:
  - P4-T1
  - P4-T3
  batch_2:
  - P4-T2
  - P4-T4
  batch_3:
  - P4-V1
total_tasks: 5
completed_tasks: 4
in_progress_tasks: 1
blocked_tasks: 0
progress: 80
---

# Phase 4 Progress — Executable dangerous-miss and V3-V5 dependencies

Dangerous misses and study gates become executable dependencies, not prose. Each hazard and V3-V5
protocol maps from exact input/version through expected behavior, execution receipt, result,
adjudication, owner decision, and release state.

Missing protocol, execution, result, uncertainty, adjudication, or owner approval remains
`not_executed`/pending and blocks the applicable release state. Authored scenario specifications and
executed results are separate records — authoring ten fixtures is not executing them.

Owner-held (OQ-4): intended use, candidate, dataset, reference standard, endpoints, and analysis plan
that bind V3. Owner-held (OQ-6): the authoritative approval/adjudication system. The repository ships
contracts and explicit null-carrying gaps only.
