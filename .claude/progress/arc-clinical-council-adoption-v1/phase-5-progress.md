---
type: progress
schema_version: 2
doc_type: progress
prd: arc-clinical-council-adoption-v1
feature_slug: arc-clinical-council-adoption-v1
phase: 5
status: blocked
created: '2026-07-19'
updated: '2026-07-21'
prd_ref: docs/project_plans/expansion/00-expansion-plan.md
plan_ref: docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
commit_refs: []
pr_refs: []
execution_model: sequential
plan_structure: unified
owners:
- council-coordinator
contributors: []
tasks:
- id: P5-T1
  status: in_progress
  assigned_to:
  - python-backend-engineer
  dependencies: []
  description: Freeze one non-patient candidate, registered target, evidence manifest,
    council/role schemas, profiles, receipts, protocols, and AOS identifiers by digest.
    Immutable pilot input manifest plus clean data-boundary scan.
- id: P5-T2
  status: pending
  assigned_to:
  - python-backend-engineer
  dependencies:
  - P5-T1
  description: Execute independent SDK reviewer passes and separate adjudication through
    the trusted-writer path. Execution receipts bind every reviewer output and exclude
    stale artifacts.
- id: P5-T3
  status: pending
  assigned_to:
  - python-backend-engineer
  dependencies:
  - P5-T2
  description: Validate all base/custom outputs, provenance, trace, source contracts,
    dangerous-miss results, certification, and recommendation liveness. `arc validate`
    clean; scorecard is not a skeleton placeholder.
- id: P5-T4
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P5-T3
  description: Attach available credentialed clinical, laboratory, rights, legal,
    privacy, methods, safety, equity, and release decisions to the exact digest. Each
    unavailable gate remains explicitly owner-held or not executed.
- id: P5-V1
  status: pending
  assigned_to:
  - pediatric-clinical-adjudicator
  - correctness-reviewer
  - task-completion-validator
  dependencies:
  - P5-T4
  description: Run exact-tree clinical-safety and correctness/release review; rerun
    after every material edit. Explicit approval of the exact current ARC/AOS/project
    trees.
parallelization:
  batch_1:
  - P5-T1
  batch_2:
  - P5-T2
  batch_3:
  - P5-T3
  batch_4:
  - P5-T4
  batch_5:
  - P5-V1
total_tasks: 5
completed_tasks: 0
in_progress_tasks: 1
blocked_tasks: 0
progress: 0
---

# Phase 5 Progress — Qualifying pilot and certification

One immutable, non-patient, policy-clean candidate runs end to end. Target, evidence, reviewer,
receipt, profile, test, adjudication, human-decision, and certification identities must resolve to one
immutable candidate and a truthful execution state.

Runtime qualification may be true while credentialed review, clinical validation, certification,
release, or activation remains pending or blocked. The pilot qualifies the *runtime*; it does not
authorize clinical use. A skeleton scorecard is a failure, not a pass.
