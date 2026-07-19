---
type: progress
schema_version: 2
doc_type: progress
prd: "wave0-safety-foundation"
feature_slug: "wave0-safety-foundation"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
execution_model: batch-parallel
phase: 7
title: "EP-7: Review Contract & Docs"
status: "planning"
started: null
completed: null
commit_refs: []
pr_refs: []

overall_progress: 0
completion_estimate: "on-track"

total_tasks: 7
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0

owners: ["documentation-writer"]
contributors: ["artifact-tracker"]

model_usage:
  primary: "sonnet"
  external: []

tasks:
  - id: "EP7-T1"
    description: "schemas/review-record.schema.json: data contract only (not the app) for change-proposal -> dual-review -> conflict-resolution -> approval, emitting the approvedBy[] shape EP-5's manifest consumes."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["EP-0"]
    estimated_effort: "1.0 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP7-T2"
    description: "Review-portal design doc: describe workflow states (proposed/under-review/disputed/approved/rejected) and role vocabulary. Cross-reference ARC's council seat taxonomy as a role-vocabulary input only — not an approval source (D-4 applies here too)."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["EP7-T1"]
    estimated_effort: "1.0 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP7-T3"
    description: "DOC-006 — author design specs for DEF-6, DEF-7, DEF-8: refresh docs/project_plans/design-specs/{public-moduleid-api-surface,algorithm-explainers-examples-relocation,headless-browser-runtime-smoke-check}.md, confirming each is still correctly deferred given what this phase actually shipped."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["EP-6"]
    estimated_effort: "0.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"
  - id: "EP7-T4"
    description: "Fix stale data/*.json path references in README.md, docs/clinical-algorithm.md, and docs/project_plans/expansion/01-platform-expansion-roadmap.md to the current modules/anemia/*.json paths."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["EP-6"]
    estimated_effort: "0.5 pts"
    priority: "high"
    assigned_model: "haiku"
    model_effort: "adaptive"
  - id: "EP7-T5"
    description: "Correct stale test-count claim (README.md:96) + update docs/architecture.md §6/§7/§10 and CLAUDE.md's hard-guardrails/architecture-orientation block to reflect tri-state facts, fail-closed units, exact-passage evidence, governed rule metadata, and the verified manifest."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["EP-6"]
    estimated_effort: "0.5 pts"
    priority: "high"
    assigned_model: "haiku"
    model_effort: "adaptive"
  - id: "EP7-T6"
    description: "CHANGELOG [Unreleased] entry categorizing this phase's user-facing/behavioral changes (tri-state input shape, fail-closed unit rejection, honest not-assessed representation)."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["EP-6"]
    estimated_effort: "0.25 pts"
    priority: "high"
    assigned_model: "haiku"
    model_effort: "adaptive"
  - id: "EP7-T7"
    description: "Plan frontmatter finalization & findings closeout: set plan status: completed, populate commit_refs/files_affected/updated; finalize findings doc (draft -> accepted) or record N/A."
    status: "pending"
    assigned_to: ["artifact-tracker"]
    dependencies: ["EP7-T3", "EP7-T4", "EP7-T5", "EP7-T6"]
    estimated_effort: "0.25 pts"
    priority: "high"
    assigned_model: "haiku"
    model_effort: "adaptive"

parallelization:
  batch_1: ["EP7-T1"]
  batch_2: ["EP7-T2"]
  batch_3: ["EP7-T3", "EP7-T4", "EP7-T5", "EP7-T6"]
  batch_4: ["EP7-T7"]
  critical_path: ["EP7-T3", "EP7-T7"]
  estimated_total_time: "0.75 pts (doc-truth-up critical path once EP-6 seals; EP7-T1/T2 contract track runs independently, starting at EP-0)"

blockers: []

success_criteria: [
  { id: "SC-1", description: "Review-record schema round-trips all 4 workflow states (EP7-T1)", status: "pending" },
  { id: "SC-2", description: "Design doc contains an explicit D-4 non-goal statement (EP7-T2)", status: "pending" },
  { id: "SC-3", description: "All 3 deferred items (DEF-6, DEF-7, DEF-8) have a current design-spec path; deferred_items_spec_refs populated (EP7-T3)", status: "pending" },
  { id: "SC-4", description: "Zero stale data/*.json references remain in README, clinical-algorithm.md, or the roadmap doc (EP7-T4)", status: "pending" },
  { id: "SC-5", description: "Test-count and architecture docs match shipped state (EP7-T5)", status: "pending" },
  { id: "SC-6", description: "CHANGELOG [Unreleased] entry present (EP7-T6)", status: "pending" },
  { id: "SC-7", description: "Plan frontmatter complete; findings doc finalized or N/A (EP7-T7)", status: "pending" },
  { id: "SC-8", description: "karen end-of-feature review passed", status: "pending" },
  { id: "SC-9", description: "task-completion-validator sign-off", status: "pending" }
]

files_modified: [
  "schemas/review-record.schema.json",
  "docs/project_plans/design-specs/public-moduleid-api-surface.md",
  "docs/project_plans/design-specs/algorithm-explainers-examples-relocation.md",
  "docs/project_plans/design-specs/headless-browser-runtime-smoke-check.md",
  "README.md",
  "docs/clinical-algorithm.md",
  "docs/project_plans/expansion/01-platform-expansion-roadmap.md",
  "docs/architecture.md",
  "CLAUDE.md",
  "CHANGELOG.md"
]
---

# wave0-safety-foundation - Phase 7: Review Contract & Docs

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/wave0-safety-foundation/phase-7-progress.md -t EP7-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Design the clinical-review portal's data contract (not the app) and true up all documentation to shipped state (WP7). Formally depends only on EP-0 (the review-record contract has no code dependency and can start immediately) but the doc-truth-up half is scheduled to seal last, since it needs EP-6's shipped state to describe accurately.

---

## Implementation Notes

### Architectural Decisions

- Two independent tracks in this phase: the **contract-design track** (EP7-T1 -> EP7-T2, starts at EP-0) and the **doc-truth-up track** (EP7-T3/T4/T5/T6, all gated on EP-6 sealing, mutually parallel with each other). EP7-T7 (closeout) needs all four doc-truth-up tasks done, not the contract track.
- D-4 applies to EP7-T2 as much as to EP-4/EP-5: the design doc must contain an **explicit non-goal statement** that ARC review output is not an eligible source for `approvedBy[]` — an omission is not sufficient, per the phase file.

### Patterns and Best Practices

- EP7-T3/T4/T5/T6 are all independent of each other (each depends only on EP-6) and should dispatch as one batch once EP-6 seals — do not serialize them.
- EP7-T4/T5/T6/T7 are routed `haiku` (mechanical, token-heavy, near-zero judgment) — do not escalate to a premium model for pure path-reference fixes or CHANGELOG entries.

### Known Gotchas

- Do not start the doc-truth-up tasks (EP7-T3..T6) before EP-6 seals — their whole point is to describe the *shipped* state, and running them early risks re-touching docs mid-flight (the reason this phase is scheduled to seal last despite its formal EP-0-only dependency).
- EP7-T3 must confirm DEF-8's rationale still holds (i.e., that EP-1/EP-2 stayed inside the Phase-0 shim boundary) rather than mechanically re-stamping the same three deferred-item specs without re-checking them against what actually shipped.

### Development Setup

No new dependencies. Pure documentation and schema-contract authoring against existing conventions.

---

## Completion Notes

_(Fill in when phase is complete: karen review verdict, final deferred_items_spec_refs paths, plan status transition to completed.)_
