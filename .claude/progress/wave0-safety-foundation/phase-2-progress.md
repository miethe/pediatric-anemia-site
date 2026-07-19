---
type: progress
schema_version: 2
doc_type: progress
prd: "wave0-safety-foundation"
feature_slug: "wave0-safety-foundation"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
execution_model: sequential
phase: 2
title: "EP-2: Units & Range Registry"
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

owners: ["backend-architect"]
contributors: ["code-reviewer"]

model_usage:
  primary: "sonnet"
  external: []

tasks:
  - id: "EP2-T1"
    description: "src/units.js — closed UCUM unit table (D-5): new, hand-rolled (no dependency by default) closed unit table covering the ~10 numeric lab fields (hemoglobin, mcv, rdw, rbc, wbc, anc, platelets, ferritin, stfrFerritinIndex, bloodLeadLevel)."
    status: "pending"
    assigned_to: ["backend-architect"]
    dependencies: ["EP-0 (SPIKE-004)"]
    estimated_effort: "2.0 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP2-T2"
    description: "schemas/reference-range.schema.json: new schema formalizing band/threshold shape with an explicit unit tag per band/threshold."
    status: "pending"
    assigned_to: ["backend-architect"]
    dependencies: ["EP2-T1"]
    estimated_effort: "1.0 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP2-T3"
    description: "Formalize unit-checked range lookup: extend src/ranges/registry.js + modules/anemia/ranges.js to validate the request unit against the registered band/threshold unit before lookup, preserving today's AAP-fallback + local-override precedence and tolerant-null behavior for unregistered pairs."
    status: "pending"
    assigned_to: ["backend-architect"]
    dependencies: ["EP2-T1", "EP2-T2"]
    estimated_effort: "2.0 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP2-T4"
    description: "Fail-closed unit-mismatch rejection at API + browser boundary, per SPIKE-004's missing-unit policy (OQ-5 — reject vs. accept-with-unitAssumed flag). Applied consistently; never silent either way."
    status: "pending"
    assigned_to: ["backend-architect"]
    dependencies: ["EP2-T3"]
    estimated_effort: "1.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP2-T5"
    description: "Seam task (consumer) — verify modules/anemia/ranges.js:42 composes with unit checks after EP-1 lands. Verification only — no edit to line 42."
    status: "pending"
    assigned_to: ["code-reviewer"]
    dependencies: ["EP1-T7", "EP2-T4"]
    estimated_effort: "0.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"
  - id: "EP2-T6"
    description: "R-P2 resilience — consumers handle absent/unset unit metadata: a legacy-shape range record encountered mid-migration (unit tag absent) must not throw."
    status: "pending"
    assigned_to: ["code-reviewer"]
    dependencies: ["EP2-T2", "EP2-T3"]
    estimated_effort: "0.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"
  - id: "EP2-T7"
    description: "Runtime smoke (R-P4) — browser SPA surfaces unit-rejection errors: exercise the rejection path end to end in browser-only mode; target_surfaces src/app.js, src/algorithmExplorer.js."
    status: "pending"
    assigned_to: ["code-reviewer"]
    dependencies: ["EP2-T4"]
    estimated_effort: "0.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

parallelization:
  batch_1: ["EP2-T1"]
  batch_2: ["EP2-T2"]
  batch_3: ["EP2-T3"]
  batch_4: ["EP2-T4", "EP2-T6"]
  batch_5: ["EP2-T5", "EP2-T7"]
  critical_path: ["EP2-T1", "EP2-T2", "EP2-T3", "EP2-T4", "EP2-T5"]
  estimated_total_time: "7.0 pts (critical path)"

blockers: []

success_criteria: [
  { id: "SC-1", description: "src/units.js enforces units on all ~10 numeric lab fields (EP2-T1)", status: "pending" },
  { id: "SC-2", description: "Registered-band unit mismatch rejects; unregistered pair returns null, never throws (EP2-T3/T4)", status: "pending" },
  { id: "SC-3", description: "AC-SEAM consumer-side verification passes (EP2-T5)", status: "pending" },
  { id: "SC-4", description: "R-P2 resilience: absent unit metadata never silently accepted on a registered band (EP2-T6)", status: "pending" },
  { id: "SC-5", description: "R-P4 runtime smoke: browser SPA surfaces the rejection, doesn't crash or silently convert (EP2-T7)", status: "pending" },
  { id: "SC-6", description: "Zero new dependencies, or exactly one recorded per D-5", status: "pending" },
  { id: "SC-7", description: "npm run check green", status: "pending" },
  { id: "SC-8", description: "task-completion-validator sign-off", status: "pending" }
]

files_modified: [
  "src/units.js",
  "schemas/reference-range.schema.json",
  "src/ranges/registry.js",
  "modules/anemia/ranges.js",
  "src/app.js",
  "src/algorithmExplorer.js"
]
---

# wave0-safety-foundation - Phase 2: Units & Range Registry

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/wave0-safety-foundation/phase-2-progress.md -t EP2-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Install a fail-closed unit/range service (WP2): enforce units on all numeric lab fields, reject unit mismatches rather than silently converting, and preserve today's AAP-fallback + local-override precedence. Runs parallel with EP-1 (disjoint files, one shared seam line owned by EP-1).

---

## Implementation Notes

### Architectural Decisions

- **Integration ownership (R-P3), consumer side**: `modules/anemia/ranges.js:42` is owned by EP-1. EP2-T5 verifies only — do not edit that line from this phase, even if it would be convenient mid-task.
- SPIKE-004's missing-unit policy (OQ-5: reject vs. `unitAssumed` flag) is a decided input, not a re-litigated decision within this phase — EP2-T4 applies it, does not re-derive it.

### Patterns and Best Practices

- This is a greenfield phase (no refactor risk) — EP2-T1 through EP2-T4 form a strict linear chain (unit table -> schema -> lookup -> rejection wiring); do not attempt to parallelize across them.
- EP2-T5 has a **cross-phase** dependency on EP1-T7 (EP-1's seam task) — do not schedule EP2-T5 until EP-1 confirms EP1-T7 has landed.

### Known Gotchas

- D-5 (zero-runtime-dependency default) is live here: EP2-T1 must record either "zero new dependencies" or exactly one dependency with a written rationale — never a silent default to a UCUM library.
- Watch for EP2-T4's fail-closed boundary being wired at only one of the two required surfaces (API and browser) — SC-2/EP2-T4's AC requires both.

### Development Setup

No new dev dependencies expected by default (D-5); if SPIKE-004 recommended one, its rationale must be recorded in EP2-T1's completion notes.

---

## Completion Notes

_(Fill in when phase is complete: unit table coverage, D-5 rationale if a dependency was added, missing-unit policy applied.)_
