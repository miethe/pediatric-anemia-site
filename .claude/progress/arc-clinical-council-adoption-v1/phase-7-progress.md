---
type: progress
schema_version: 2
doc_type: progress
prd: "arc-clinical-council-adoption-v1"
feature_slug: "arc-clinical-council-adoption-v1"
phase: 7
status: pending
created: 2026-07-19
updated: 2026-07-19
prd_ref: docs/project_plans/expansion/00-expansion-plan.md
plan_ref: docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
commit_refs: []
pr_refs: []
execution_model: batch-sequential
plan_structure: unified
owners: ["integration-owner"]
contributors: []

tasks:
  - id: "P7-T1"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: []
    description: "Wire the appropriate council gate into each product phase and Evidence Foundry promotion boundary. Trigger/input/output/owner matrix covers P1-P6 without duplicate authority."
  - id: "P7-T2"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P7-T1"]
    description: "Update the handoff, operator contract, trackers, ADRs, source/rights refresh schedule, rollback/runbook, and accepted-finding owners. One maintained entry point, no stale invocation guidance."
  - id: "P7-T3"
    status: "pending"
    assigned_to: ["python-backend-engineer"]
    dependencies: ["P7-T2"]
    description: "Run affected-repository suites, artifact validation, package/build gates, exact-tree reviewers, and final state reconciliation. Every committed claim has command, artifact, tree, or owner evidence."
  - id: "P7-V1"
    status: "pending"
    assigned_to: ["task-completion-validator", "release-certification-reviewer"]
    dependencies: ["P7-T3"]
    description: "Obtain technical closeout and separate owner release disposition. Implementation completion and release authorization remain separate records."

parallelization:
  batch_1: ["P7-T1"]
  batch_2: ["P7-T2"]
  batch_3: ["P7-T3"]
  batch_4: ["P7-V1"]
---

# Phase 7 Progress — Program integration and closeout

Adoption is operable and state-truthful. One agent entry point routes every material review to the
pinned council workflow and records the resulting work, evidence, and state in authoritative trackers.

Unavailable owner systems, providers, data partners, or reviewers remain explicit blockers and never
prevent safe repository-only progress. Technical closeout and owner release disposition are two
separate records; the second is not ours to grant.
