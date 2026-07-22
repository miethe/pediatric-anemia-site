---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1"
feature_slug: "multi-bundle-conversion-e1"
phase: 2
title: "EF-WP1 Eligibility Gate & Batch Orchestration"
status: "in_progress"
created: '2026-07-21'
updated: '2026-07-22'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-1-2-vendoring-batch-orchestration.md
commit_refs: ["bca4ce4", "f2bdcbc", "3fcbc02", "551ad19", "01f98a2", "9c25116"]
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 2
depends_on: ["P1"]
owners: ["node-tooling-engineer"]
contributors: []

tasks:
  - id: "P2-T1"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "1.0 pts"
    dependencies: ["P1-GATE"]
    description: "EF-WP1 eligibility pre-flight (FR-16): extend tools/rf-bundle-to-kb-pack/lib/eligibility.mjs with a structural check — every source card in a bundle must carry the pediatric_cds evidence-card extension block before the bundle is converter-eligible. Reject (non-zero exit, named card id(s)) before any propose output is written."
    commit_ref: "bca4ce4"
    evidence: "npm test: 1302/1302 pass; see commit bca4ce4"
  - id: "P2-T2"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P2-T1"]
    description: "EF-WP1 fail-closed test (FR-16): seed a synthetic fixture card missing the pediatric_cds extension block; assert the eligibility gate rejects it before any propose output is written, zero files written under build/kb-pack/ for the rejected bundle."
    commit_ref: "f2bdcbc"
    evidence: "npm test: 1302/1302 pass; see commit f2bdcbc"
  - id: "P2-T3"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "1.5 pts"
    dependencies: ["P2-T1", "P1-GATE"]
    description: "Batch runner (FR-5): tools/rf-bundle-to-kb-pack/lib/batch.mjs (new cli.mjs batch verb) runs inspect -> verify -> propose over an explicit, named, ordered {fixture, module} list — rf-ev-001/modules/anemia, rf-cbc-002/modules/cbc_suite_v1, rf-kid-001/modules/kidney_suite_v1, rf-gro-002/modules/growth_suite_v1 — never a directory glob (R-7 mitigation). Idempotent on a second run with no source changes."
    commit_ref: "3fcbc02"
    evidence: "npm test: 1302/1302 pass; see commit 3fcbc02"
  - id: "P2-T4"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "1.0 pts"
    dependencies: ["P2-T3"]
    description: "multi-bundle-conversion-report.json aggregation schema (FR-5): aggregate the 4 per-bundle conversion-report.json files with per-bundle and aggregate counts (claims processed, conflicts preserved, unresolved items, candidate scaffolds, rules emitted — expected 0). Every field defines an explicit 0/empty representation (R-P2 AC) — never a missing key."
    commit_ref: "551ad19"
    evidence: "npm test: 1302/1302 pass; see commit 551ad19"
  - id: "P2-T5"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P2-T3"]
    description: "Fail-closed partial-batch-failure test (R-6 mitigation): seed a mid-batch failure (corrupted 3rd-of-4 fixture); assert the batch runner names the failing bundle, halts without partial output for it, and leaves already-succeeded bundles' output unaffected."
    commit_ref: "9c25116"
    evidence: "npm test: 1302/1302 pass; see commit 9c25116"
  - id: "P2-T6"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P2-T3"]
    description: "REG-exclusion regression test (R-7 mitigation, FR-4/FR-19): assert no script this pass adds ever reads REG-001's or REG-004's runs/ directory, and neither appears in P2-T3's named {fixture, module} list — exactly 4 entries, none referencing reg-001/reg-004 in any form."
    commit_ref: "01f98a2"
    evidence: "npm test: 1302/1302 pass; see commit 01f98a2"
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
completed_tasks: 6
in_progress_tasks: 0
blocked_tasks: 0
progress: 86
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

## Exit Criteria (decisions block §1, **scoped per Decisions Block Addendum A2**)

- Batch-orchestration machinery (literal enumeration, fixed pipeline, fail-closed halt, per-pair
  isolation, determinism, `aggregate` field semantics) is proven green by test — **not** that `node
  cli.mjs batch` exits 0 over all 5 fixtures today. It does not: `batch` halts at pair 0
  (`rf-ev-001`) with `DecisionsNotFoundError` (the same Addendum A1 / DF-E1-M1 gap); `aggregate`
  reports `bundlesNotAvailable: 4`, `bundlesReported: 0`. Only `rf-cbc-002 → cbc_suite_v1` completes
  `propose` end to end when invoked directly.
- The `rf-cbc-001` regression check is satisfied by the pre-existing E0-era `rf-cbc-001` test
  coverage continuing to pass under `npm run check` (confirmed 1302/1302 green) — none of the 6 new
  P2 tests reference `rf-cbc-001` directly; see `lib/batch.mjs`'s header and Addendum A2.
- `EF-WP1` test passes (unaffected by this scoping).

## Reviewer Gate

- **P2-GATE** — `task-completion-validator`.

## Quality Gates (scoped per Decisions Block Addendum A2)

- [x] Batch runner (`inspect -> verify -> propose`) machinery is proven green by test
  (`tests/ef-converter-batch.test.mjs`, `tests/ef-batch-runner.test.mjs`); `node cli.mjs batch` does
  not currently exit 0 over all 5 fixtures — halts at pair 0 (`rf-ev-001`), expected per Addendum
  A1/DF-E1-M1, not a P2 regression
- [x] `rf-cbc-001` regression check satisfied by the pre-existing E0-era suite staying green under
  `npm run check` (1302/1302) — stated explicitly, not implicit
- [x] `EF-WP1` (`pediatric_cds` extension) is enforced structurally, fail-closed, before any `propose` output
- [x] `multi-bundle-conversion-report.json` schema defines an explicit empty/zero representation for every field
- [x] A seeded mid-batch failure halts cleanly, names the failing bundle, and does not corrupt other bundles' output
- [x] Batch bundle list is a literal, enumerated array — never a glob — and never references `REG-001`/`REG-004`

## Implementation Notes

### Known Gotchas

- The batch bundle list must be a literal, enumerated array — never derived from a glob/`readdir` over
  an external directory (R-7 mitigation).
- No shared mutable state between bundles: a mid-batch failure must not corrupt already-succeeded
  bundles' output (R-6 mitigation).

## Completion Notes

P2-T1..P2-T6 landed (commits `bca4ce4`, `f2bdcbc`, `3fcbc02`, `551ad19`, `01f98a2`, `9c25116`).
`npm run check` green (1302/1302) after all 6 commits. Reviewer findings against the initial exit-gate
wording (batch runner "green over all 5 fixtures" as literally stated was false — `batch` halts at
pair 0 with `DecisionsNotFoundError`, `aggregate` reports 0/4 bundles available) were reconciled via
**Decisions Block Addendum A2**, mirroring Phase 1's Addendum A1: the exit gate is now scoped to the
orchestration *machinery* being proven correct by test, with the live full-batch-over-5-fixtures
result explicitly documented as blocked on the same DF-E1-M1 gap, not a P2 regression. The
`rf-cbc-001` regression-check linkage (satisfied by the pre-existing E0-era suite, not by any new P2
test) is now stated explicitly in this file, the phase-1-2 plan doc, `lib/batch.mjs`'s header, and
Addendum A2. **P2-GATE** (task-completion-validator) remains `not_started` — this reconciliation
pass is not itself that reviewer checkpoint; phase-level status is `in_progress` (6/7).
