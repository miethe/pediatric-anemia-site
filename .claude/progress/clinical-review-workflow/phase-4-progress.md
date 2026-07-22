---
type: progress
schema_version: 2
doc_type: progress
prd: clinical-review-workflow
feature_slug: clinical-review-workflow
prd_ref: docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
execution_model: batch-parallel
phase: 4
title: "Clinical Review Workflow v1 — Phase 4: Portal-Promotion Framework & Concept Assets"
status: pending
created: '2026-07-22'
updated: '2026-07-22'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 6
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- documentation-writer
- task-completion-validator
- karen
- codex-gpt-5.6-terra
model_usage:
  primary: opus
  external: [gpt-5.6-terra, sonnet]
tasks:
- id: P4-T1
  description: "OQ-8 portal-promotion framework text (FR-15/16, OQ-4). Draft the framework:\
    \ (a) friction-metric categories + committed markdown observation-log format at\
    \ .claude/worknotes/clinical-review-workflow/friction-observations.md (zero\
    \ network/telemetry restated explicitly); (b) an explicit first-cut promotion threshold,\
    \ stated as a proposal pending human ratification before it can trigger any action;\
    \ (c) the authorized human decision-owner role name (never an agent, never rf/ARC\
    \ output); (d) a decision-record template."
  status: pending
  assigned_to: ["general-purpose (opus judgment)"]
  dependencies: ["P1-GATE2 (Phase 1 complete)"]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: opus
  model_effort: adaptive
  target_surfaces:
  - .claude/worknotes/clinical-review-workflow/friction-observations.md
  acceptance_criteria: "Framework names all four elements; the log format is a committed\
    \ markdown file restating the zero-network/telemetry constraint verbatim; the\
    \ decision-owner is a role name, not a person; the framework text explicitly states\
    \ the threshold is a proposal pending human ratification."
- id: P4-T2
  description: "CONCEPT-ONLY watermarked portal mockups (FR-17, R6). Partially pre-delivered\
    \ during planning: docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png\
    \ (gpt-5.6 native image tool, 'CONCEPT ONLY — NOT COMMITTED' banner) is already\
    \ committed. Task = verify/attach it to the design spec, add the manifest entry, and\
    \ generate additional views only if the framework text needs them."
  status: pending
  assigned_to: ["codex gpt-5.6 image tool"]
  dependencies: []
  estimated_effort: "1.0 pts"
  priority: medium
  assigned_model: gpt-5.6-terra
  model_effort: medium
  target_surfaces:
  - docs/project_plans/design-specs/assets/
  acceptance_criteria: "Every image file under docs/project_plans/design-specs/assets/\
    \ produced by this task carries the watermark; a companion manifest entry per asset\
    \ records the watermark string (verified by a docs-truth grep test — pixel-OCR is out\
    \ of scope)."
- id: P4-T3
  description: "Integrate framework + mockups into design spec (FR-15/17). Update\
    \ docs/project_plans/design-specs/clinical-review-portal-workflow.md with P4-T1's\
    \ framework section and P4-T2's mockup references; confirm the portal section's\
    \ maturity field stays shaping — never promoted by this task."
  status: pending
  assigned_to: [documentation-writer]
  dependencies: [P4-T1, P4-T2]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - docs/project_plans/design-specs/clinical-review-portal-workflow.md
  acceptance_criteria: "Design spec's portal section contains the four framework elements\
    \ and links each mockup asset; a docs-truth test confirms maturity: shaping unchanged."
- id: P4-GATE1
  description: "task-completion-validator gate: verify Phase 4 exit gate — framework names\
    \ metric + threshold + owner + template; mockups labeled CONCEPT-ONLY; no portal code;\
    \ npm run check green."
  status: pending
  assigned_to: [task-completion-validator]
  dependencies: [P4-T1, P4-T2, P4-T3]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: P4-GATE2
  description: "karen milestone review (Tier 3, per decisions block §2). Independently\
    \ re-check against the actual diff: (1) the framework names a metric format, threshold,\
    \ owner-role, and decision-record template — not a vaguer restatement; (2) the\
    \ owner-role is never a person and never an agent/rf/ARC role; (3) every mockup asset\
    \ visibly carries the CONCEPT-ONLY watermark and the design spec's portal section is\
    \ still maturity: shaping; (4) zero portal code exists anywhere in the diff."
  status: pending
  assigned_to: [karen]
  dependencies: [P4-GATE1]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "karen sign-off recorded; any gap becomes a task before this gate\
    \ reopens."
- id: P4-GATE3
  description: "codex gpt-5.6-terra read-only second-opinion diff review of the full P4\
    \ changeset against R6 and FR-15..17 — checks for any language that reads as a portal\
    \ commitment rather than an informing artifact."
  status: pending
  assigned_to: ["codex (read-only)"]
  dependencies: [P4-GATE2]
  estimated_effort: "—"
  priority: high
  assigned_model: gpt-5.6-terra
  model_effort: high
  acceptance_criteria: "Review recorded; any flagged gap becomes a task before Phase 5 opens."

parallelization:
  batch_1: [P4-T1, P4-T2]
  batch_2: [P4-T3]
  batch_3: [P4-GATE1]
  batch_4: [P4-GATE2]
  batch_5: [P4-GATE3]
  critical_path: [P4-T1, P4-T3, P4-GATE1, P4-GATE2, P4-GATE3]
  estimated_total_time: "~1.5 engineer-days"

blockers: []

success_criteria:
- id: SC-1
  description: "Framework names metric format, threshold-as-proposal, owner-role, decision-record template"
  status: pending
- id: SC-2
  description: "Owner-role is a role name only — never a person, never an agent/rf/ARC role"
  status: pending
- id: SC-3
  description: "Every mockup asset carries the CONCEPT-ONLY watermark; design spec portal section stays maturity: shaping"
  status: pending
- id: SC-4
  description: "Zero portal code anywhere in the diff"
  status: pending
- id: SC-5
  description: "npm run check green"
  status: pending

files_modified:
- .claude/worknotes/clinical-review-workflow/friction-observations.md
- docs/project_plans/design-specs/assets/
- docs/project_plans/design-specs/clinical-review-portal-workflow.md

notes: "Wave 2 (parallel to Phase 2, both gated on Phase 1 only). Tier 3 milestone: this\
  \ phase carries the feature's only mid-feature karen gate — do not seal P4-GATE1 as\
  \ sufficient on its own. Hard guardrail: no task in this phase writes a single line of\
  \ portal code; the mockups are CONCEPT-ONLY informing artifacts, not a build commitment."
---

# clinical-review-workflow — Phase 4: Portal-Promotion Framework & Concept Assets

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/clinical-review-workflow/phase-4-progress.md -t P4-T1 -s in_progress
```

---

## Objective

Resolve OQ-8: draft the portal-promotion decision framework (friction-metric log format,
promotion threshold stated as a human-ratification proposal, named decision-owner role,
decision-record template) and attach CONCEPT-ONLY watermarked mockups to the existing design
spec — informing a future decision, not committing to build the portal. See PRD FR-15..17 and
decisions block §3 risk R6.

**Duration**: ~1.5 engineer-days · **Dependencies**: Phase 1 complete (wave 2, parallel to
Phase 2) · **Exit gate**: framework names metric + threshold + owner + template; mockups
labeled CONCEPT-ONLY; no portal code; `npm run check` green + **karen** (Tier 3 milestone).

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Status | Dependencies |
|---------|------|-----------------------|---------------|--------|---------------|
| P4-T1 | OQ-8 portal-promotion framework text | general-purpose (opus judgment) | opus/adaptive | pending | Phase 1 complete |
| P4-T2 | CONCEPT-ONLY watermarked portal mockups | codex gpt-5.6 image tool | gpt-5.6-terra/medium | pending | none |
| P4-T3 | Integrate framework + mockups into design spec | documentation-writer | sonnet/adaptive | pending | P4-T1, P4-T2 |
| P4-GATE1 | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | pending | P4-T1..T3 |
| P4-GATE2 | **karen** milestone review (Tier 3) | karen | sonnet/adaptive | pending | P4-GATE1 |
| P4-GATE3 | codex `gpt-5.6-terra` read-only second-opinion | codex (read-only) | gpt-5.6-terra/high | pending | P4-GATE2 |

---

## Orchestration Quick Reference

### Batch 1 (parallel — after Phase 1 complete)

```
Task("general-purpose", "P4-T1: OQ-8 portal-promotion framework text (FR-15/16, OQ-4) —
apply opus-level judgment. Draft: (a) friction-metric categories + a committed markdown
observation-log format at .claude/worknotes/clinical-review-workflow/friction-observations.md,
explicitly restating zero network/telemetry; (b) an explicit first-cut promotion threshold,
STATED AS A PROPOSAL pending human ratification — it must not read as self-triggering; (c) the
authorized human decision-owner as a ROLE NAME only, never an agent, never rf/ARC output; (d) a
decision-record template. See plan §Phase 4, P4-T1.")
```

P4-T2 (CONCEPT-ONLY watermarked mockups) runs on the codex `gpt-5.6-terra` native image lane,
not a `Task()` subagent call — invoke via the `codex` skill:

```
codex exec "Verify docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png
carries the 'CONCEPT ONLY — NOT COMMITTED' watermark banner; attach it to the design spec and
add a manifest entry recording the watermark string. Generate additional views on the same
gpt-5.6 image lane only if P4-T1's framework text needs them. See plan §Phase 4, P4-T2."
```

### Batch 2 (after P4-T1, P4-T2)

```
Task("documentation-writer", "P4-T3: Integrate framework + mockups into design spec
(FR-15/17). Update docs/project_plans/design-specs/clinical-review-portal-workflow.md with
P4-T1's framework section and P4-T2's mockup references. The portal section's maturity field
MUST stay 'shaping' — this task never promotes it. See plan §Phase 4, P4-T3.")
```

### Gates

```
Task("task-completion-validator", "P4-GATE1: Verify Phase 4 exit gate for
clinical-review-workflow — framework names metric + threshold + owner + template; mockups
labeled CONCEPT-ONLY; no portal code; npm run check green.")

Task("karen", "P4-GATE2: Tier 3 milestone review of clinical-review-workflow Phase 4.
Independently re-check the actual diff: (1) framework names metric format, threshold, owner
role, decision-record template — not vague restatement; (2) owner-role is never a person/
agent/rf/ARC role; (3) every mockup visibly carries CONCEPT-ONLY watermark, portal section
stays maturity: shaping; (4) zero portal code anywhere in the diff. Runs only after
P4-GATE1 passes.")
```

codex `gpt-5.6-terra` read-only second-opinion (invoke via the `codex` skill, read-only diff
mode, after P4-GATE2 passes):

```
codex exec --read-only "Diff-review the full Phase 4 changeset for clinical-review-workflow
against R6 and FR-15..17. Check for any language that reads as a portal commitment rather than
an informing artifact."
```

---

## Implementation Notes

### Architectural Decisions

The promotion threshold in P4-T1 must be framed as a *proposal pending human ratification* —
it is not permitted to describe itself as self-triggering. The decision-owner is always a role
name (e.g. "product owner"), never an agent identity and never `rf`/ARC output — this mirrors
the D-4 invariant that agent output is structurally ineligible to populate reviewer/approver
fields.

### Known Gotchas

- P4-T2's mockup is largely pre-delivered from planning; do not regenerate it wholesale —
  verify the watermark and manifest entry first.
- `maturity: shaping` on the portal design-spec section is a hard invariant this phase must
  not touch — karen's gate specifically re-checks it.

---

## Completion Notes

Summary of phase completion (fill in when phase is complete):

- What was built
- Key learnings
- Unexpected challenges
- Recommendations for Phase 5 hardening sweep
