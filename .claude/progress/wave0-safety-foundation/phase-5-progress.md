---
type: progress
schema_version: 2
doc_type: progress
prd: wave0-safety-foundation
feature_slug: wave0-safety-foundation
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
execution_model: batch-parallel
phase: 5
title: 'EP-5: Manifest & Semantic Diff'
status: in_progress
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 7
completed_tasks: 6
in_progress_tasks: 1
blocked_tasks: 0
at_risk_tasks: 0
owners:
- backend-architect
contributors:
- code-reviewer
model_usage:
  primary: sonnet
  external:
  - gpt-5.6-sol (codex exec)
tasks:
- id: EP5-T1
  description: 'scripts/sign-kb.mjs (Branch A default per SPIKE-006): compute clinicalContentHash
    (SHA-256) over the canonicalized concatenation of modules/anemia/{rules,candidates,evidence,reference-ranges}.json;
    validationRunId from the equivalence-harness/CI run; supersedes chain per SPIKE-006''s
    recommendation. approvedBy[] ships empty per D-4.'
  status: completed
  assigned_to:
  - backend-architect
  dependencies:
  - Entry (EP-3+4 output available to hash)
  estimated_effort: 2.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: 2026-07-21T00:00Z
  completed: 2026-07-21T06:00Z
  evidence:
  - commit: 6a63a53
- id: EP5-T2
  description: 'schemas/kb-manifest.schema.json: formalize ARCH §6''s shape, superseding
    module.json''s current field-presence-only checks (DEF-5).'
  status: completed
  assigned_to:
  - backend-architect
  dependencies:
  - EP5-T1
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: 2026-07-21T00:00Z
  completed: 2026-07-21T06:00Z
  evidence:
  - commit: 6a63a53
- id: EP5-T3
  description: 'scripts/kb-diff.mjs — semantic diff classifier: implement SPIKE-005''s
    design (EP0-T3/T4) — classify rule-add/remove/threshold-change/evidence-change.
    Hardest implementation task in the phase (H3, genuinely algorithmic).'
  status: completed
  assigned_to:
  - backend-architect
  dependencies:
  - EP-0 (SPIKE-005 design)
  estimated_effort: 3.0 pts
  priority: critical
  assigned_model: sonnet
  model_effort: xhigh
  started: 2026-07-21T00:00Z
  completed: 2026-07-21T06:00Z
  evidence:
  - commit: 6a63a53
- id: EP5-T4
  description: 'Seeded adversarial diff pass (Risk 2 mitigation): cross-family adversarial
    review tasked explicitly with ''find a safety-relevant change this classifier
    misses'' against EP5-T3''s implementation.'
  status: completed
  assigned_to:
  - backend-architect
  dependencies:
  - EP5-T3
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: gpt-5.6-sol (codex exec)
  model_effort: xhigh
  started: 2026-07-21T00:00Z
  completed: 2026-07-21T06:00Z
  evidence:
  - commit: 6a63a53
- id: EP5-T5
  description: 'Flip server.mjs to required-and-verified manifest handling: flip today''s
    tolerant-of-absence handling (:26-31, catches ENOENT, continues with manifest:
    null) to required-and-verified. Behavior change to the startup fail-fast path,
    not an addition.'
  status: completed
  assigned_to:
  - backend-architect
  dependencies:
  - EP5-T1
  - EP5-T2
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: 2026-07-21T00:00Z
  completed: 2026-07-21T06:00Z
  evidence:
  - commit: 6a63a53
- id: EP5-T6
  description: 'AC-FAILCLOSED — implement + test all 5 ARCH §10 conditions: unit absent/incompatible;
    age outside supported range; KB signature/hash invalid; UI/engine version incompatible;
    evidence expired vs. evidenceReviewedThrough policy. target_surfaces server.mjs,
    src/units.js, src/ranges/registry.js, src/app.js.'
  status: in_progress
  assigned_to:
  - code-reviewer
  dependencies:
  - EP2-T4
  - EP5-T5
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: 2026-07-21T00:00Z
  completed: 2026-07-21T06:00Z
  evidence:
  - commit: 6a63a53
- id: EP5-T7
  description: 'FR-WP5-05 / AC-WP5-RESIL — consumers handle legitimately-empty manifest
    fields: supersedes: null valid on first release, approvedBy: [] valid per D-4
    — both legitimately empty; clinicalContentHash/validationRunId missing or status
    !== verified must fail closed.'
  status: completed
  assigned_to:
  - code-reviewer
  dependencies:
  - EP5-T5
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  started: 2026-07-21T00:00Z
  completed: 2026-07-21T06:00Z
  evidence:
  - commit: 6a63a53
parallelization:
  batch_1:
  - EP5-T1
  - EP5-T3
  batch_2:
  - EP5-T2
  - EP5-T4
  batch_3:
  - EP5-T5
  batch_4:
  - EP5-T6
  - EP5-T7
  critical_path:
  - EP5-T1
  - EP5-T2
  - EP5-T5
  - EP5-T6
  estimated_total_time: 5.5 pts (critical path; Branch B signing contingency adds
    ~3 pts to EP5-T1 if SPIKE-006 recommends real cryptographic signing — re-baseline
    before proceeding, do not silently absorb)
blockers: []
success_criteria:
- id: SC-1
  description: clinicalContentHash reproducible on two clean runs against unchanged
    input (EP5-T1)
  status: pending
- id: SC-2
  description: approvedBy[] test-enforced empty at the manifest layer (EP5-T1, reinforcing
    EP4-T3)
  status: pending
- id: SC-3
  description: Semantic diff classifier flags 100% of SPIKE-005 seeded safety-relevant
    mutations as non-cosmetic (EP5-T3/T4)
  status: pending
- id: SC-4
  description: Server refuses to start/serve on missing/invalid/expired/incompatible
    manifest (EP5-T5)
  status: pending
- id: SC-5
  description: All 5 ARCH §10 fail-closed conditions have a passing automated test
    (EP5-T6)
  status: pending
- id: SC-6
  description: 'AC-WP5-RESIL: legitimately-empty fields never conflated with must-not-be-empty
    fields (EP5-T7)'
  status: pending
- id: SC-7
  description: SPIKE-006 signing branch (A or B) explicitly recorded, not assumed
  status: pending
- id: SC-8
  description: npm run check green
  status: pending
- id: SC-9
  description: task-completion-validator sign-off
  status: pending
files_modified:
- scripts/sign-kb.mjs
- schemas/kb-manifest.schema.json
- scripts/kb-diff.mjs
- server.mjs
- src/units.js
- src/ranges/registry.js
- src/app.js
- modules/anemia/module.json
progress: 85
updated: '2026-07-21'
---

# wave0-safety-foundation - Phase 5: Manifest & Semantic Diff

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/wave0-safety-foundation/phase-5-progress.md -t EP5-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Install a verifiable, signed KB manifest and a semantic diff classifier (WP5): the server refuses to start/serve on a missing/invalid/expired/incompatible manifest, and `kb-diff.mjs` correctly classifies a seeded change set without under-reporting a safety-relevant change. Depends on EP-3+EP-4 complete (this phase hashes/attests to their output).

---

## SPIKE-006 Contingency (do not silently absorb)

SPIKE-006 (EP0-T5) leans toward recommending deferral of real cryptographic signing in favor of `clinicalContentHash` + `supersedes` chain (**Branch A**, expected — EP5-T1's estimate above assumes this). If SPIKE-006 instead recommends real asymmetric signing (**Branch B**), EP5-T1 grows ~3 pts (phase total ~13, plan total 68 -> 71) — **re-baseline explicitly before EP-5 proceeds**, do not absorb the delta into other tasks' estimates.

---

## Implementation Notes

### Architectural Decisions

- EP5-T3 (semantic diff classifier) is the hardest implementation task in the phase (H3, genuinely algorithmic) — routed `xhigh` effort, and gets an independent cross-family adversarial pass (EP5-T4) rather than being self-certified.
- EP5-T6 has a **cross-phase** dependency on EP2-T4 (EP-2's fail-closed unit boundary) — do not schedule EP5-T6 until EP-2 confirms EP2-T4 landed.

### Patterns and Best Practices

- EP5-T1 and EP5-T3 have no mutual dependency and can dispatch in the same batch (signing and semantic-diff implementation are independent workstreams within this phase).

### Known Gotchas

- All 5 of ARCH §10's fail-closed conditions need a corresponding automated test (EP5-T6) — today zero of 5 do. Do not consider EP5-T5 (the server flip) sufficient on its own; EP5-T6 is a separate enumerated task.
- Watch for `supersedes: null` or `approvedBy: []` being treated as an error state by any consumer — both are legitimately empty on a first release (AC-WP5-RESIL); the failure mode to guard against is the opposite one (missing `clinicalContentHash`/`validationRunId` being tolerated instead of rejected).

### Development Setup

No new dependencies. Signing approach (hash+chain vs. real crypto) is SPIKE-006's decision, carried in as an input, not re-derived here.

---

## Completion Notes

_(Fill in when phase is complete: signing branch taken (A/B), hash reproducibility proof, adversarial diff pass result.)_
