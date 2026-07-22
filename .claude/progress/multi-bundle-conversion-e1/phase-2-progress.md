---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1"
feature_slug: "multi-bundle-conversion-e1"
phase: 2
title: "EF-WP1 Eligibility Gate & Batch Orchestration"
status: "not_started"
created: '2026-07-21'
updated: '2026-07-21'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-1-2-vendoring-batch-orchestration.md
commit_refs: []
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 2
depends_on: ["P1"]
owners: ["node-tooling-engineer"]
contributors: []

tasks:
  - id: "P2-T1"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "1.0 pts"
    dependencies: ["P1-GATE"]
    description: "EF-WP1 eligibility pre-flight (FR-16): extend tools/rf-bundle-to-kb-pack/lib/eligibility.mjs with a structural check — every source card in a bundle must carry the pediatric_cds evidence-card extension block before the bundle is converter-eligible. Reject (non-zero exit, named card id(s)) before any propose output is written."
  - id: "P2-T2"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P2-T1"]
    description: "EF-WP1 fail-closed test (FR-16): seed a synthetic fixture card missing the pediatric_cds extension block; assert the eligibility gate rejects it before any propose output is written, zero files written under build/kb-pack/ for the rejected bundle."
  - id: "P2-T3"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "1.5 pts"
    dependencies: ["P2-T1", "P1-GATE"]
    description: "Batch runner (FR-5): tools/rf-bundle-to-kb-pack/lib/batch.mjs (new cli.mjs batch verb) runs inspect -> verify -> propose over an explicit, named, ordered {fixture, module} list — rf-ev-001/modules/anemia, rf-cbc-002/modules/cbc_suite_v1, rf-kid-001/modules/kidney_suite_v1, rf-gro-002/modules/growth_suite_v1 — never a directory glob (R-7 mitigation). Idempotent on a second run with no source changes."
  - id: "P2-T4"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "1.0 pts"
    dependencies: ["P2-T3"]
    description: "multi-bundle-conversion-report.json aggregation schema (FR-5): aggregate the 4 per-bundle conversion-report.json files with per-bundle and aggregate counts (claims processed, conflicts preserved, unresolved items, candidate scaffolds, rules emitted — expected 0). Every field defines an explicit 0/empty representation (R-P2 AC) — never a missing key."
  - id: "P2-T5"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P2-T3"]
    description: "Fail-closed partial-batch-failure test (R-6 mitigation): seed a mid-batch failure (corrupted 3rd-of-4 fixture); assert the batch runner names the failing bundle, halts without partial output for it, and leaves already-succeeded bundles' output unaffected."
  - id: "P2-T6"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P2-T3"]
    description: "REG-exclusion regression test (R-7 mitigation, FR-4/FR-19): assert no script this pass adds ever reads REG-001's or REG-004's runs/ directory, and neither appears in P2-T3's named {fixture, module} list — exactly 4 entries, none referencing reg-001/reg-004 in any form."
  - id: "P2-GATE"
    status: "not_started"
    assigned_to: ["task-completion-validator"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P2-T1", "P2-T2", "P2-T3", "P2-T4", "P2-T5", "P2-T6"]
    description: "Reviewer gate: verify exit criteria — batch runner green over all 5 fixtures (4 new + rf-cbc-001 regression); EF-WP1 fail-closed test passes; partial-failure and REG-exclusion tests pass."

parallelization:
  batch_1: ["P2-T1"]
  batch_2: ["P2-T2", "P2-T3"]
  batch_3: ["P2-T4", "P2-T5", "P2-T6"]
  batch_4: ["P2-GATE"]

total_tasks: 7
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
progress: 0
---

# Phase 2 Progress — EF-WP1 Eligibility Gate & Batch Orchestration

**Wave**: 2 of 5. **Depends on**: Phase 1 complete.
**Assigned Subagent(s)**: node-tooling engineer (general-purpose, sonnet); task-completion-validator gate.

## Objective

Add a structural `EF-WP1` eligibility pre-flight and a named-list batch runner (`inspect -> verify ->
propose`) over the E0-proven converter — the drive side that Phases 4 and 5 depend on, built once
Phase 1's fixtures exist.

## Entry Criteria

- Phase 1 complete (`P1-GATE` passed) — all 4 fixtures committed and `inspect`-clean.

## Exit Criteria (decisions block §1)

- Batch runner green over the 5 fixtures (4 new + `rf-cbc-001` regression).
- `EF-WP1` test passes.

## Reviewer Gate

- **P2-GATE** — `task-completion-validator`.

## Quality Gates

- [ ] Batch runner (`inspect -> verify -> propose`) is green over all 4 new fixtures without regressing `rf-cbc-001`
- [ ] `EF-WP1` (`pediatric_cds` extension) is enforced structurally, fail-closed, before any `propose` output
- [ ] `multi-bundle-conversion-report.json` schema defines an explicit empty/zero representation for every field
- [ ] A seeded mid-batch failure halts cleanly, names the failing bundle, and does not corrupt other bundles' output
- [ ] Batch bundle list is a literal, enumerated array — never a glob — and never references `REG-001`/`REG-004`

## Implementation Notes

### Known Gotchas

- The batch bundle list must be a literal, enumerated array — never derived from a glob/`readdir` over
  an external directory (R-7 mitigation).
- No shared mutable state between bundles: a mid-batch failure must not corrupt already-succeeded
  bundles' output (R-6 mitigation).

## Completion Notes

_Not started. Fill in when phase work begins._
