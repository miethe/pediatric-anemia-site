---
type: progress
schema_version: 2
doc_type: progress
prd: wave0-safety-foundation
feature_slug: wave0-safety-foundation
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
execution_model: batch-parallel
phase: 6
title: 'EP-6: Adversarial Validation Corpus'
status: pending
started: '2026-07-21T14:00:00Z'
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 5
completed_tasks: 4
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- adversarial reviewer (cross-family, fable)
model_usage:
  primary: sonnet
  external:
  - fable
tasks:
- id: EP6-T1
  description: 'tests/property.test.mjs: hand-rolled seeded deterministic generators
    against node:test (D-5) exercising fact-derivation and rule invariants, including
    FR-WP1-05''s narrowing invariant (cross-checked against EP1-T6).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP-5
  estimated_effort: 2.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T14:05:00Z'
  completed: '2026-07-21T14:35:00Z'
  evidence:
  - test: tests/property.test.mjs
  - note: 8/8 pass, 89-of-91 rules activated, verified across 4 seeds
- id: EP6-T2
  description: 'tests/boundary.test.mjs: boundary-value cases at every numeric threshold
    in modules/anemia/rules.json (e.g., ferritin exactly at 20/30 ng/mL).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP-5
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T14:05:00Z'
  completed: '2026-07-21T15:10:00Z'
  evidence:
  - test: tests/boundary.test.mjs
  - note: 66/66 pass; +4 threshold-pinning tests closing the 3 surviving ferritin
      mutants
- id: EP6-T3
  description: 'tests/mutation.test.mjs + scripts/mutation-run.mjs: hand-rolled mutation
    runner (D-5). Mutation-score baseline defined empirically in this task (OQ-4)
    — measured over rules and facts, not guessed in advance.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP-5
  estimated_effort: 2.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T14:05:00Z'
  completed: '2026-07-21T15:20:00Z'
  evidence:
  - test: tests/mutation.test.mjs
  - note: OQ-4 baseline measured 457/457=1.0 after victim-set integration; 0 excluded;
      controls pass
- id: EP6-T4
  description: tests/dangerous-miss.test.mjs — encode ARC's 10 named families (DM-CBC-001..DM-WORKFLOW-010)
    as executable fixtures against the real engine. This phase owns the conversion;
    arc-clinical-council-adoption-v1.md P4-T1 consumes these fixtures rather than
    re-deriving them.
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP6-T2
  - EP-5
  estimated_effort: 2.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: medium
  started: '2026-07-21T15:30:00Z'
  completed: '2026-07-21T15:55:00Z'
  evidence:
  - test: tests/hazard-control-matrix.test.mjs
  - note: gap-fill not re-derivation; DM-HEME-002 regression pinned in testMarkers;
      zero-production-callers check made recursive + server.mjs
- id: EP6-T5
  description: 'Dangerous-miss adversarial review: ''what would this engine miss that
    harms a child?'' Independent adversarial review of EP6-T4''s fixtures plus the
    full rule/candidate set for gaps the 10 named families don''t cover. Highest-stakes
    reasoning gate in the whole plan.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - EP6-T4
  estimated_effort: 1.0 pt
  priority: critical
  assigned_model: fable
  model_effort: max
parallelization:
  batch_1:
  - EP6-T1
  - EP6-T2
  - EP6-T3
  batch_2:
  - EP6-T4
  batch_3:
  - EP6-T5
  critical_path:
  - EP6-T2
  - EP6-T4
  - EP6-T5
  estimated_total_time: 4.5 pts (critical path)
blockers: []
success_criteria:
- id: SC-1
  description: All 4 new test files (property, boundary, mutation, dangerous-miss)
    green
  status: pending
- id: SC-2
  description: Mutation-score baseline defined from a real measurement run and met
    (EP6-T3, OQ-4)
  status: pending
- id: SC-3
  description: All 10 ARC-named dangerous-miss families pass as executable fixtures
    (EP6-T4)
  status: pending
- id: SC-4
  description: Dangerous-miss adversarial review complete; result honestly recorded
    as not_executed_owner_held for the credentialed-sign-off half of the V1 gate (EP6-T5)
  status: pending
- id: SC-5
  description: Zero new dependencies, or exactly one recorded per D-5 (EP6-T1, EP6-T3)
  status: pending
- id: SC-6
  description: npm run check green
  status: pending
- id: SC-7
  description: task-completion-validator sign-off
  status: pending
files_modified:
- tests/property.test.mjs
- tests/boundary.test.mjs
- tests/mutation.test.mjs
- scripts/mutation-run.mjs
- tests/dangerous-miss.test.mjs
updated: '2026-07-21'
progress: 80
---

# wave0-safety-foundation - Phase 6: Adversarial Validation Corpus

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/wave0-safety-foundation/phase-6-progress.md -t EP6-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Prove the whole substrate against a manifest-verified KB (WP6): property, boundary, mutation, and dangerous-miss suites where today only 20 example-driven subtests exist, with the 10 ARC-named dangerous-miss families converted into this repo's own executable fixtures. Depends on EP-5 complete — running these suites against an unverified KB would leave the fail-closed paths untested.

---

## Cross-Plan Dependency (Risk 5)

`arc-clinical-council-adoption-v1.md` P4-T1 converts the same `DM-CBC-001..DM-WORKFLOW-010` families into non-patient synthetic scenario specs. **This phase (EP6-T4) owns the executable-fixture conversion** — EP-6 is where the fixtures must actually run against the real engine. The ARC Adoption plan's P4-T1 consumes EP6-T4's fixtures rather than re-deriving them; both plans record this edge in `related_documents`.

---

## Implementation Notes

### Architectural Decisions

- EP6-T1, EP6-T2, EP6-T3 have no mutual dependency (all three gate only on EP-5 completing) and dispatch as one batch — the only ordering constraint is that EP6-T4 needs EP6-T2 (boundary suite) landed first.
- EP6-T5 (dangerous-miss adversarial review) is routed `fable` at `max` effort — the second and last of the plan's exactly-two `fable` uses. It does not close the roadmap's "dangerous-miss review by a clinical advisor signs off" V1 criterion; that half stays `not_executed_owner_held` per D-4 — ARC/adversarial review is not a credentialed clinical sign-off.

### Patterns and Best Practices

- D-5 reminder: `property.test.mjs` (EP6-T1) and `mutation.test.mjs`/`mutation-run.mjs` (EP6-T3) are both tempting places to reach for a dependency (`fast-check`, Stryker). Default is hand-rolled against `node:test` with seeded deterministic generators; any dependency needs a written rationale, never a silent default.

### Known Gotchas

- OQ-4's mutation-score baseline must come from a real measurement run in EP6-T3, not be guessed or backfitted to whatever number the first run happens to produce — watch for a baseline being quietly set low enough to be decorative.
- EP6-T5's output must be an explicit "no gap found, here is what I probed" statement or a filed, owned follow-up — silence is not an acceptable result.

### Development Setup

No new dependencies expected (D-5). All 4 suites are first-of-kind in this repo — no prior art to copy from an existing test file.

---

## Completion Notes

_(Fill in when phase is complete: mutation-score baseline value + measurement method, dangerous-miss review findings or explicit none-found statement.)_
