---
type: progress
schema_version: 2
doc_type: progress
prd: clinical-review-workflow
feature_slug: clinical-review-workflow
prd_ref: docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
execution_model: batch-parallel
phase: 3
title: "Clinical Review Workflow v1 \u2014 Phase 3: Render Queue View & Reviewer Runbook"
status: completed
created: '2026-07-22'
updated: '2026-07-22'
started: 2026-07-22T16:25Z
completed: 2026-07-22T17:52Z
commit_refs: []
pr_refs: []
overall_progress: 100
completion_estimate: on-track
total_tasks: 6
completed_tasks: 6
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
- documentation-writer
contributors:
- task-completion-validator
- codex-gpt-5.6-terra
model_usage:
  primary: sonnet
  external:
  - haiku
  - gpt-5.6-terra
tasks:
- id: P3-T1
  description: 'Render queue/turn-state section (FR-11). Add a queue/turn-state section
    to lib/render.mjs''s static HTML output: the five roles in order, each with its
    existing committed-record link, plus a NEXT or TERMINAL marker sourced from P1-T1''s
    derived-state library. No <script>, no <a href> (existing constraint unchanged);
    semantic HTML headings for screen-reader navigation of the five roles.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T1 (external, Phase 1)
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tools/review-record/lib/render.mjs
  - tests/fixtures/ef-review-render/golden/
  - tests/ef-review-render.test.mjs
  - tests/ef-review-render-smoke.test.mjs
  acceptance_criteria: Render golden under tests/fixtures/ef-review-render/golden/
    updated to include the queue section; grep test confirms zero <script and zero
    <a href in the new section; tests/ef-review-render-smoke.test.mjs continues to
    pass via the real CLI entry point.
  started: 2026-07-22T16:30Z
  completed: 2026-07-22T16:55Z
  evidence:
  - commit: 9add168
  verified_by:
  - P3-GATE1
- id: P3-T2
  description: "Terminal-state messaging fix (FR-12). On the structurally-non-qualifying\
    \ derived state, validate, status, and render each emit an explicit sentence naming\
    \ this as the correct, by-design terminus for any synthetic: true set \u2014 not\
    \ a defect."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T2 (external, Phase 1)
  - P3-T1
  estimated_effort: 0.5 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tools/review-record/lib/verbs/validate.mjs
  - tools/review-record/lib/verbs/status.mjs
  - tools/review-record/lib/render.mjs
  acceptance_criteria: A shared-string test asserts the exact sentence (or agreed
    canonical substring) appears in validate's CLI output, status's human companion
    text, and render's HTML output on the committed cbc_suite_v1 synthetic set.
  started: 2026-07-22T16:56Z
  completed: 2026-07-22T17:15Z
  evidence:
  - commit: 43c018d
  verified_by:
  - P3-GATE1
- id: P3-T3
  description: "Author docs/governance/reviewer-runbook.md (FR-13, OQ-3, OQ-7). Guided\
    \ git walkthrough of the five-role sequence against the committed cbc_suite_v1\
    \ dry-run fixture; corrections via supersedes (never in-place edits); what structurally\
    \ non-qualifying means. Two labeled tracks: exercise (synthetic personas) \u2014\
    \ sign is visible only on this track \u2014 and post-G1 real reviewer (ends at\
    \ scaffold-writes-the-file; real reviewers never run sign). Linked from README\
    \ and architecture \xA711."
  status: completed
  assigned_to:
  - documentation-writer
  - general-purpose
  dependencies: []
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: haiku -> sonnet
  model_effort: adaptive
  target_surfaces:
  - docs/governance/reviewer-runbook.md
  acceptance_criteria: Runbook covers all five roles end-to-end; both labeled tracks
    present; docs-truth test asserts required section headers exist and that sign
    appears only under the exercise track.
  started: 2026-07-22T16:30Z
  completed: 2026-07-22T16:54Z
  evidence:
  - commit: b9cbfad
  - ica-draft: haiku routing CRW-P3-T3-runbook-draft, 2 draft bugs caught in-session
  verified_by:
  - P3-GATE1
- id: P3-T4
  description: Honesty-language pass (FR-14, R4). Review every user-visible surface
    this phase touches (runbook, render's new section, README pointer) for language
    implying clinical validity, real sign-off, or a non-synthetic roster; confirm
    each carries or links one hop to the boundary statement.
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P3-T1
  - P3-T3
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - docs/governance/reviewer-runbook.md
  - tools/review-record/lib/render.mjs
  - tools/review-record/README.md
  acceptance_criteria: Docs-truth test asserts docs/governance/reviewer-runbook.md,
    the render's queue-section HTML, and tools/review-record/README.md each contain
    at least one of 'unvalidated research prototype' / 'roster is synthetic-only'
    / 'no clinical sign-off exists' (or agreed equivalent).
  started: 2026-07-22T16:56Z
  completed: 2026-07-22T17:12Z
  evidence:
  - commit: 6cc8288,3ad3568
  - finding: CRW-F10
  verified_by:
  - P3-GATE1
- id: P3-GATE1
  description: "task-completion-validator gate: verify Phase 3 exit gate \u2014 render\
    \ stays <script>-free/static; runbook covers all 5 roles end-to-end against the\
    \ dry-run fixture; npm run check green."
  status: completed
  assigned_to:
  - task-completion-validator
  dependencies:
  - P3-T1
  - P3-T2
  - P3-T3
  - P3-T4
  estimated_effort: "\u2014"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: All exit-gate criteria pass; recorded in phase progress note.
  started: 2026-07-22T17:15Z
  completed: 2026-07-22T17:22Z
  evidence:
  - workflow: wf_3b501ec4-5a1 validator approved 0 fixes, npm run check green 2391/2391
  verified_by:
  - P3-GATE2
- id: P3-GATE2
  description: "codex gpt-5.6-terra read-only second-opinion diff review of the full\
    \ P3 changeset against R4/R6 and FR-11..14 \u2014 checks the render section stays\
    \ script-free/static and the runbook's two-track split does not leak sign into\
    \ the post-G1 track."
  status: completed
  assigned_to:
  - codex (read-only)
  dependencies:
  - P3-GATE1
  estimated_effort: "\u2014"
  priority: high
  assigned_model: gpt-5.6-terra
  model_effort: high
  acceptance_criteria: Review recorded; any flagged gap becomes a task before Phase
    5 opens.
  started: 2026-07-22T17:25Z
  completed: 2026-07-22T17:50Z
  evidence:
  - codex: gpt-5.6-terra FAIL(1 MAJOR,1 MINOR runbook accuracy)->fix f1f92f4->re-pass
      both CLOSED
  verified_by:
  - P3-GATE2
parallelization:
  batch_1:
  - P3-T1
  - P3-T3
  batch_2:
  - P3-T2
  - P3-T4
  batch_3:
  - P3-GATE1
  batch_4:
  - P3-GATE2
  critical_path:
  - P3-T1
  - P3-T4
  - P3-GATE1
  - P3-GATE2
  estimated_total_time: ~2 engineer-days
blockers: []
success_criteria:
- id: SC-1
  description: Render queue section stays <script>-free and <a href>-free (static
    HTML constraint)
  status: completed
- id: SC-2
  description: Reviewer runbook covers all five roles end-to-end against the dry-run
    fixture
  status: completed
- id: SC-3
  description: sign appears only in the runbook's exercise track, never the post-G1
    track
  status: completed
- id: SC-4
  description: npm run check green
  status: completed
files_modified:
- tools/review-record/lib/render.mjs
- tools/review-record/lib/verbs/render.mjs
- tools/review-record/lib/verbs/validate.mjs
- tools/review-record/lib/verbs/status.mjs
- docs/governance/reviewer-runbook.md
- tools/review-record/README.md
- tests/fixtures/ef-review-render/golden/
- tests/ef-review-render.test.mjs
- tests/ef-review-render-smoke.test.mjs
notes: "Wave 3 (per the computed wave split \u2014 depends only on Phase 1, but shares\
  \ lib/verbs/validate.mjs with Phase 2, so is scheduled one wave later to avoid a\
  \ concurrent-write collision; this is a scheduling fact, not a P2 scope dependency).\
  \ Render \u2225 runbook fully parallel within the phase; runbook draft goes haiku\
  \ (ICA-eligible free-tier draft) \u2192 sonnet honesty/structure pass in-session."
progress: 100
---

# clinical-review-workflow — Phase 3: Render Queue View & Reviewer Runbook

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/clinical-review-workflow/phase-3-progress.md -t P3-T1 -s in_progress
```

---

## Objective

Add a queue/turn-state section to the existing static render (the repo's only UI surface —
no React/`*.tsx` exists) and author `docs/governance/reviewer-runbook.md`, a guided git
walkthrough for non-engineer clinicians across the two labeled tracks (exercise vs. post-G1
real reviewer). See PRD FR-11..14 and decisions block §3 risks R4/R6.

**Duration**: ~2 engineer-days · **Dependencies**: Phase 1 (scheduled wave 3 due to a
`validate.mjs` file-write collision with Phase 2 — not a P2 scope dependency) · **Exit gate**:
render stays `<script>`-free/static; runbook covers all 5 roles end-to-end against the dry-run
fixture; `npm run check` green.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Status | Dependencies |
|---------|------|-----------------------|---------------|--------|---------------|
| P3-T1 | Render queue/turn-state section | general-purpose | sonnet/adaptive | pending | P1-T1 (external) |
| P3-T2 | Terminal-state messaging fix | general-purpose | sonnet/adaptive | pending | P1-T2 (external), P3-T1 |
| P3-T3 | Author `docs/governance/reviewer-runbook.md` | documentation-writer (draft) → general-purpose (structure pass) | haiku→sonnet/adaptive | pending | none |
| P3-T4 | Honesty-language pass | general-purpose | sonnet/adaptive | pending | P3-T1, P3-T3 |
| P3-GATE1 | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | pending | P3-T1..T4 |
| P3-GATE2 | codex `gpt-5.6-terra` read-only second-opinion | codex (read-only) | gpt-5.6-terra/high | pending | P3-GATE1 |

---

## Orchestration Quick Reference

### Batch 1 (parallel — after Phase 1 complete)

```
Task("general-purpose", "P3-T1: Render queue/turn-state section (FR-11). Add a
queue/turn-state section to lib/render.mjs's static HTML output: the five roles in order,
each with its existing committed-record link, plus a NEXT or TERMINAL marker sourced from
Phase 1's derived-state library. No <script>, no <a href>; semantic HTML headings for
screen-reader navigation. Update the render golden fixture. See plan §Phase 3, P3-T1.")

Task("documentation-writer", "P3-T3: Author docs/governance/reviewer-runbook.md draft
(FR-13, OQ-3, OQ-7). Guided git walkthrough of the five-role review sequence against the
committed cbc_suite_v1 dry-run fixture; corrections via supersedes, never in-place edits;
explain 'structurally non-qualifying'. Two labeled tracks: 'exercise (synthetic personas)'
(sign visible only here) and 'post-G1 real reviewer' (ends at scaffold; real reviewers never
run sign). See plan §Phase 3, P3-T3.")
```

### Batch 2 (after P3-T1 / P3-T3)

```
Task("general-purpose", "P3-T2: Terminal-state messaging fix (FR-12). On the
structurally-non-qualifying derived state, validate, status, and render must each emit an
explicit sentence naming this as the correct, by-design terminus for a synthetic:true set —
not a defect. Shared-string test across all three surfaces. See plan §Phase 3, P3-T2.")

Task("general-purpose", "P3-T4: Honesty-language pass (FR-14, R4). Review runbook, render's
new queue section, and README pointer for language implying clinical validity, real sign-off,
or a non-synthetic roster. Confirm each carries or links one hop to the boundary statement
('unvalidated research prototype' / 'roster is synthetic-only' / 'no clinical sign-off
exists'). See plan §Phase 3, P3-T4.")
```

### Gates

```
Task("task-completion-validator", "P3-GATE1: Verify Phase 3 exit gate for
clinical-review-workflow — render stays <script>-free/static; runbook covers all 5 roles
end-to-end against the dry-run fixture; npm run check green.")
```

codex `gpt-5.6-terra` read-only second-opinion (invoke via the `codex` skill, read-only diff
mode, after P3-GATE1 passes):

```
codex exec --read-only "Diff-review the full Phase 3 changeset for clinical-review-workflow
against R4/R6 and FR-11..14. Check the render section stays script-free/static and the
runbook's two-track split does not leak sign into the post-G1 track."
```

---

## Implementation Notes

### Architectural Decisions

Render's queue section sources its `NEXT`/`TERMINAL` markers from Phase 1's
`lib/derived-state.mjs` — no independent state computation in `render.mjs`.

### Known Gotchas

- `lib/verbs/validate.mjs` is also written by Phase 2 (P2-T3/T4) — this phase is scheduled a
  wave later specifically to avoid a concurrent write, not because it depends on Phase 2's
  output.
- The runbook's `sign` mention must be scoped strictly to the exercise track — a docs-truth
  test enforces this; do not let `sign` leak into the post-G1 real-reviewer track description.
- Render stays static: no `<script>`, no `<a href>` — this constraint predates this feature
  and is not renegotiable here.

---

## Completion Notes

Summary of phase completion (fill in when phase is complete):

- What was built
- Key learnings
- Unexpected challenges
- Recommendations for Phase 5 hardening sweep
