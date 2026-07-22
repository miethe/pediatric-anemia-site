---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1"
feature_slug: "multi-bundle-conversion-e1"
phase: 3
title: "Greenfield Module Scaffolds (kidney, growth)"
status: "not_started"
created: '2026-07-21'
updated: '2026-07-21'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-3-4-scaffolds-and-backfill.md
commit_refs: []
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 1
depends_on: []
integration_owner: "module-engineer"
seam_tasks: ["P3-T3"]
owners: ["module-engineer"]
contributors: []

tasks:
  - id: "P3-T1"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "1.5 pts"
    dependencies: []
    description: "modules/kidney_suite_v1/ package scaffold (FR-13): module.json mirroring cbc_suite_v1's unsigned-stub shape (id: kidney_suite_v1, status: unsigned-stub, approvedBy: [], clinicalContentHash: null, validationRunId: null, supersedes: null, releasedAt: null, plus 02 §3.2 envelope fields); index.js exporting deriveFacts/summarize/limitations returning a clearly-labeled \"not yet implemented for this module\" posture — no delegation to anemia's fact derivation; schema-valid empty rules.json ([]) and candidates.json; empty-but-valid evidence.json ({\"sources\": []}); reference-ranges.json scaffold."
  - id: "P3-T2"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "1.5 pts"
    dependencies: []
    description: "modules/growth_suite_v1/ package scaffold (FR-13): identical structure to P3-T1, for id: growth_suite_v1 (RF-GRO-002). Same 'not yet implemented' labeling requirement in index.js's hook descriptor and limitations() output; same empty-but-valid rules.json/candidates.json/evidence.json/reference-ranges.json."
  - id: "P3-T3"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "1.0 pts"
    dependencies: ["P3-T1", "P3-T2"]
    description: "SEAM TASK (R-P3, integration owner: module engineer). Dual registry wiring (FR-14): register both new modules in src/modules/registry.js (literal REGISTRY map entries; MODULE_IDS stays derived, never hand-duplicated) and src/facts/registry.js (literal, enumerated MODULE_CODE_LOADERS entries, never a template-string specifier, never delegating to anemia's/cbc_suite_v1's fact module). DEFAULT_MODULE_ID stays 'anemia'; no new client-selectable moduleId surface (R-8 mitigation); update the existing tripwire comment to note 4 registered modules."
  - id: "P3-T4"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P3-T3"]
    description: "scripts/validate-kb.mjs empty-rules.json regression check (FR-15): confirm/harden that a module whose rules.json is a valid empty array [] validates as valid, not an error — an expected, legitimate E1 state, not a validator regression. Add a dedicated test."
  - id: "P3-T5"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P3-T1", "P3-T2"]
    description: "R-4 mitigation: 'not yet implemented' honesty spot-check — a human-verifiable check (documented, not only test-enforced) that reading kidney_suite_v1/index.js and growth_suite_v1/index.js directly makes the 'no real clinical logic here' posture obvious without inference. Record this explicitly in the phase progress note for karen's P3-GATE2 review."
  - id: "P3-GATE1"
    status: "not_started"
    assigned_to: ["task-completion-validator"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P3-T1", "P3-T2", "P3-T3", "P3-T4", "P3-T5"]
    description: "Reviewer gate: verify exit criteria — both modules load/validate/register; npm run check green with 4 modules registered; no rule/candidate implies diagnosis; empty-rules regression test passes."
  - id: "P3-GATE2"
    status: "not_started"
    assigned_to: ["karen"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P3-GATE1"]
    description: "karen mid-milestone review (Tier-3 reviewer gate, 1st of 3 named milestones). Independently re-check against the actual diff: both new modules genuinely carry zero clinical logic; approvedBy: [] and null clinicalContentHash on both; the 'not yet implemented' labeling is unambiguous on direct read; DEFAULT_MODULE_ID tripwire comment update is present and accurate. Runs before Phase 5 opens."

parallelization:
  batch_1: ["P3-T1", "P3-T2"]
  batch_2: ["P3-T3"]
  batch_3: ["P3-T4", "P3-T5"]
  batch_4: ["P3-GATE1"]
  batch_5: ["P3-GATE2"]

total_tasks: 7
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
progress: 0
---

# Phase 3 Progress — Greenfield Module Scaffolds (kidney, growth)

**Wave**: 1 of 5 (parallel to Phase 1 -> Phase 2). **Depends on**: none — disjoint files vs.
Phase 1/2, confirmed against both phases' `files_affected`.
**Assigned Subagent(s)**: module engineer (general-purpose, sonnet); Explore
(`modules/cbc_suite_v1/` as the scaffold exemplar); task-completion-validator gate; **karen
mid-milestone review** (1st of 3 named Tier-3 gates).
**Integration Owner** (R-P3): module engineer — owns both scaffolds and the single seam task
(P3-T3, dual registry wiring).
**Module IDs** (OQ-4): `kidney_suite_v1` (RF-KID-001), `growth_suite_v1` (RF-GRO-002).

## Objective

Scaffold two new, greenfield, unsigned-stub module packages (`kidney_suite_v1`, `growth_suite_v1`)
with empty-but-valid `rules.json`/`candidates.json`/`evidence.json`, wire both into the shared
module/facts registries without changing the client-selectable default, and prove — by direct read,
not only test — that neither module carries any real clinical logic yet.

## Entry Criteria

- None (wave 1, runs in parallel with Phase 1 -> Phase 2).

## Exit Criteria (decisions block §1)

- Both modules load, validate (`npm run validate`), and register without a clinical claim.
- `approvedBy: []`, null hashes.

## Reviewer Gate

- **P3-GATE1** — `task-completion-validator`.
- **P3-GATE2** — `karen` mid-milestone review (must pass before Phase 5 opens).

## Quality Gates

*Validated at P3-GATE1 (task-completion-validator):*
- [ ] `npm run check` green with 4 modules registered (`anemia`, `cbc_suite_v1`, `kidney_suite_v1`, `growth_suite_v1`)
- [ ] Both new modules validate with empty `rules.json`/`candidates.json` — confirmed non-error state
- [ ] `DEFAULT_MODULE_ID` stays `'anemia'`; tripwire comment updated with 4-module rationale

*Validated at P3-GATE2 (`karen` mid-milestone review):*
- [ ] Zero clinical logic in either new module, confirmed by direct read, not assumption
- [ ] `karen` sign-off recorded

## Implementation Notes

### Known Gotchas

- Kidney and growth have no sibling fact-derivation module to delegate to (unlike `cbc_suite_v1`'s
  OQ-1 delegation to `anemia`) — `index.js` must return an explicit "not yet implemented" posture,
  never invented clinical fact derivation.
- `MODULE_IDS` and `MODULE_CODE_LOADERS` must stay literal/derived, never hand-duplicated or
  template-string specifiers.
- This pass adds no new client-selectable `moduleId` surface (no UI/API change) — `DEFAULT_MODULE_ID`
  remains `'anemia'`.

## Completion Notes

_Not started. Fill in when phase work begins._
