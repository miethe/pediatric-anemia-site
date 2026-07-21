---
type: progress
schema_version: 2
doc_type: progress
prd: evidence-foundry-buildout
feature_slug: evidence-foundry-buildout
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
execution_model: batch-parallel
phase: 7
title: 'Evidence Foundry Buildout — Phase 7: Docs & Deferral Closure'
status: pending
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 18
completed_tasks: 3
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- documentation-writer
contributors:
- task-completion-validator
- karen
model_usage:
  primary: sonnet
  external:
  - haiku
tasks:
- id: P7-T1
  description: 'CHANGELOG [Unreleased] entry (FR-24, .claude/specs/changelog-spec.md):
    add an entry describing the new tools/rf-bundle-to-kb-pack/ converter and the
    cbc_suite_v1 module scaffold. Plan frontmatter''s changelog_ref set to CHANGELOG.md.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P5-GATE2
  - P6-GATE
  estimated_effort: 0.3 pts
  priority: medium
  assigned_model: haiku
  model_effort: adaptive
- id: P7-T2
  description: 'docs/architecture.md Converter subsection (FR-25): document the rf-bundle-to-kb-pack
    seam (input contract, verb sequence, output staging under build/kb-pack/, the
    module-package-vs-staging distinction from OQ-1/OQ-3), pointing to 02 §4 rather
    than restating it.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P5-GATE2
  estimated_effort: 0.6 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P7-T3
  description: 'Design spec — DF-E1-01 clinical review portal/workflow: author docs/project_plans/design-specs/clinical-review-portal-workflow.md
    per deferred-items-and-findings.md''s required frontmatter (maturity: shaping,
    prd_ref set to this feature''s PRD, open_questions: [], explored_alternatives:
    [] seeded from ADR-4''s options). Append path to deferred_items_spec_refs.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P6-GATE
  estimated_effort: 0.12 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
- id: P7-T4
  description: 'Design spec — DF-E1-02 full CBC 12-angle research operation: author
    docs/project_plans/design-specs/cbc-12-angle-research-operation.md, maturity:
    shaping, seeded from ADR-8''s recommendation. Append path to deferred_items_spec_refs.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P6-GATE
  estimated_effort: 0.12 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
- id: P7-T5
  description: 'Design spec — DF-E1-03 upstream rf validators: author docs/project_plans/design-specs/upstream-rf-validators-pediatric.md,
    maturity: shaping, noting this item''s implementation target is the research-foundry
    repository, not this one — routed via RFUP (see P7-T13). Append path to deferred_items_spec_refs.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P6-GATE
  estimated_effort: 0.12 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
- id: P7-T6
  description: 'Design spec — DF-E1-04 retrospective validation harness: author docs/project_plans/design-specs/retrospective-validation-harness.md,
    maturity: shaping (still needs a data-source SPIKE per PRD §12 — mark open_questions
    accordingly), seeded from ADR-4 and ADR-6. Append path to deferred_items_spec_refs.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P6-GATE
  estimated_effort: 0.12 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
- id: P7-T7
  description: 'Design spec — DF-E1-05 FHIR/terminology emitters: author docs/project_plans/design-specs/fhir-terminology-emitters.md,
    maturity: shaping, seeded from ADR-3''s terminology-ownership recommendation.
    Append path to deferred_items_spec_refs.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P6-GATE
  estimated_effort: 0.12 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
- id: P7-T8
  description: 'Design spec — DF-E1-06 signed release + key custody: author docs/project_plans/design-specs/signed-release-key-custody.md,
    maturity: shaping, seeded from ADR-5. Append path to deferred_items_spec_refs.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P6-GATE
  estimated_effort: 0.12 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
- id: P7-T9
  description: 'Design spec — DF-E1-07 property/mutation/semantic-diff CI expansion:
    author docs/project_plans/design-specs/property-mutation-semantic-diff-ci.md,
    maturity: shaping, explicitly scoping ''expansion'' against what P2-T8/P5-T3/P5-T5
    already ship in E0 so the spec doesn''t re-propose E0-delivered work. Append path
    to deferred_items_spec_refs.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P5-GATE2
  estimated_effort: 0.12 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
- id: P7-T10
  description: 'Design spec — DF-E2-01 surveillance/update/registry engine: author
    docs/project_plans/design-specs/surveillance-update-registry-engine.md, maturity:
    shaping, seeded from ADR-7. Append path to deferred_items_spec_refs.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P6-GATE
  estimated_effort: 0.12 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
- id: P7-T11
  description: 'Design spec — DF-E2-02 production monitoring: author docs/project_plans/design-specs/production-monitoring-telemetry.md,
    maturity: shaping. Append path to deferred_items_spec_refs.'
  status: completed
  assigned_to:
  - documentation-writer
  dependencies:
  - P6-GATE
  estimated_effort: 0.12 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
  evidence:
  - Authored docs/project_plans/design-specs/production-monitoring-telemetry.md (DF-E2-02, maturity: shaping,
      seeded from ADR-7); appended path to deferred_items_spec_refs in evidence-foundry-buildout-v1.md
- id: P7-T12
  description: 'Design spec — DF-E2-03 withdraw/rollback machinery: author docs/project_plans/design-specs/withdraw-rollback-machinery.md,
    maturity: shaping, seeded from ADR-5/ADR-7. Append path to deferred_items_spec_refs.'
  status: completed
  assigned_to:
  - documentation-writer
  dependencies:
  - P6-GATE
  estimated_effort: 0.12 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
  evidence:
  - action: 'Authored docs/project_plans/design-specs/withdraw-rollback-machinery.md
      (DF-E2-03, maturity: shaping, seeded jointly from ADR-5 and ADR-7); appended
      path to deferred_items_spec_refs in evidence-foundry-buildout-v1.md'
- id: P7-T13
  description: 'RFUP consolidated external-routing note (DF-EXT-01): author .claude/worknotes/evidence-foundry-buildout/rfup-external-routing-note.md
    listing all 7 RFUP enhancements (rf-handoff/README.md §6, IntentTree work-area
    RFUP, node node_01KXRTYKKW9ECTF9MCBQ8JV1EB) and stating each is routed via op
    story into the agentic_meta_dev/research-foundry repos, never implemented here.
    Not appended to deferred_items_spec_refs.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P6-GATE
  estimated_effort: 0.2 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
- id: P7-T14
  description: 'Findings doc — N/A unless populated: if findings_doc_ref is null (expected),
    record ''N/A — no findings captured'' in the phase progress note and leave frontmatter
    null. If populated during execution, finalize per deferred-items-and-findings.md
    §2 Step 4 (status -> accepted, promoted_to set to this plan''s path).'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P7-T3
  - P7-T4
  - P7-T5
  - P7-T6
  - P7-T7
  - P7-T8
  - P7-T9
  - P7-T10
  - P7-T11
  - P7-T12
  - P7-T13
  estimated_effort: 0.05 pts
  priority: low
  assigned_model: haiku
  model_effort: adaptive
- id: P7-T15
  description: 'Update plan frontmatter: set status: completed, populate commit_refs,
    confirm files_affected matches the actual diff, set updated to the close-out date,
    confirm deferred_items_spec_refs lists all 10 spec paths from P7-T3..T12 (not
    P7-T13''s note).'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P7-T1
  - P7-T2
  - P7-T14
  estimated_effort: 0.15 pts
  priority: medium
  assigned_model: haiku
  model_effort: adaptive
- id: P7-T16
  description: 'Full gate re-run + guardrail/non-goal cross-check: re-run npm run
    check end to end against the final diff; independently re-verify every CLAUDE.md
    hard guardrail and every PRD §7 non-goal (02 §6.4, restated verbatim) against
    the actual committed state. Produces the written guardrail/non-goal checklist
    karen (P7-GATE2) reviews.'
  status: completed
  assigned_to:
  - documentation-writer
  dependencies:
  - P7-T15
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  evidence:
  - Ran npm run check end-to-end (exit 0): 1100/1100 tests pass, validate/coverage/build/verify:d4/check:imports/smoke:browser/smoke
      all green
  - Authored .claude/worknotes/evidence-foundry-buildout/guardrail-nongoal-checklist-phase-7.md: all
      6 CLAUDE.md hard guardrails and all 7 PRD Section 7 non-goals (02 Section 6.4)
      independently re-verified MET against the actual diff at HEAD
- id: P7-GATE1
  description: 'task-completion-validator gate: verify Phase 7 exit gate — deferred-items
    triage table fully mapped to spec stubs 1:1; npm run check green.'
  status: pending
  assigned_to:
  - task-completion-validator
  dependencies:
  - P7-T1
  - P7-T2
  - P7-T3
  - P7-T4
  - P7-T5
  - P7-T6
  - P7-T7
  - P7-T8
  - P7-T9
  - P7-T10
  - P7-T11
  - P7-T12
  - P7-T13
  - P7-T14
  - P7-T15
  - P7-T16
  estimated_effort: —
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
- id: P7-GATE2
  description: 'karen milestone review — feature end (decisions block §4, final of
    3 named milestones): independently check every hard guardrail and non-goal from
    P7-T16''s checklist against the real diff; confirm nothing produced by this feature
    is described anywhere as clinically validated or release-ready (02 §9.1 final
    checklist item); confirm the deferred-items triage table''s 11 rows are fully
    closed. Plan status may only advance to completed after this passes.'
  status: pending
  assigned_to:
  - karen
  dependencies:
  - P7-GATE1
  estimated_effort: —
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
parallelization:
  batch_1:
  - P7-T1
  - P7-T2
  - P7-T3
  - P7-T4
  - P7-T5
  - P7-T6
  - P7-T7
  - P7-T8
  - P7-T9
  - P7-T10
  - P7-T11
  - P7-T12
  - P7-T13
  batch_2:
  - P7-T14
  batch_3:
  - P7-T15
  batch_4:
  - P7-T16
  batch_5:
  - P7-GATE1
  batch_6:
  - P7-GATE2
  critical_path:
  - P7-T13
  - P7-T14
  - P7-T15
  - P7-T16
  - P7-GATE1
  - P7-GATE2
  estimated_total_time: 0.9 pts critical path (13 tasks parallelizable in batch_1);
    3.0 pts total phase
blockers: []
success_criteria:
- id: SC-1
  description: CHANGELOG [Unreleased] entry present
  status: pending
- id: SC-2
  description: docs/architecture.md Converter subsection present
  status: pending
- id: SC-3
  description: All 10 deferred-item design specs authored; deferred_items_spec_refs
    frontmatter populated with exactly 10 paths
  status: pending
- id: SC-4
  description: RFUP consolidated routing note authored (not counted in deferred_items_spec_refs)
  status: pending
- id: SC-5
  description: Findings doc finalized or explicitly N/A
  status: pending
- id: SC-6
  description: Plan frontmatter lifecycle fields complete
  status: pending
- id: SC-7
  description: npm run check green at feature end
  status: pending
- id: SC-8
  description: karen feature-end sign-off recorded
  status: pending
files_modified:
- CHANGELOG.md
- docs/architecture.md
- docs/project_plans/design-specs/*.md
- .claude/worknotes/evidence-foundry-buildout/rfup-external-routing-note.md
progress: 16
updated: '2026-07-21'
---

# evidence-foundry-buildout - Phase 7: Docs & Deferral Closure

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Update progress via CLI:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/evidence-foundry-buildout/phase-7-progress.md -t TASK-X -s completed
```

---

## Objective

Feature-end phase: CHANGELOG, `docs/architecture.md`, and one design-spec stub per deferred item.
Depends on Phase 5 AND Phase 6 both complete. Duration ~1.5 engineer-days. This is the plan's third
and final `karen` milestone — "feature end."

**Assigned Subagent(s)**: documentation-writer (haiku for CHANGELOG/pointer tasks, sonnet for
design-spec-stub tasks); task-completion-validator gate; karen milestone review.
**Exit gate** (decisions block §3): deferred-items triage table is fully mapped to spec stubs,
one-to-one; `npm run check` green.

---

## Implementation Notes

### Architectural Decisions

- 11 deferred-items triage rows: 10 (`DF-E1-01..07`, `DF-E2-01..03`) each get exactly one design-spec
  task (P7-T3..T12); the 11th (`DF-EXT-01`, 7 RFUP items) gets one consolidated routing note (P7-T13),
  not 7 design specs, and is **not** appended to `deferred_items_spec_refs`.
- `findings_doc_ref` stays `null` unless a real in-flight finding occurred during execution (lazy
  creation rule) — P7-T14 records an explicit "N/A" rather than leaving this silently ambiguous.
- Model routing within this phase is mixed: CHANGELOG/pointer tasks (P7-T1, P7-T14, P7-T15) route to
  haiku; design-spec-stub and guardrail-verification tasks route to sonnet (decisions block §8 —
  "carry architectural judgment; do not route to haiku").

### Known Gotchas

- P7-T15's `deferred_items_spec_refs` count must be exactly 10 (P7-T3..T12), never 11 — P7-T13's RFUP
  note is explicitly excluded.
- P7-GATE2's `karen` review is the final guardrail check for the whole feature: confirm nothing
  produced anywhere is described as clinically validated or release-ready. Plan `status` may only
  advance to `completed` after this passes.

### Wrap-Up (post-Phase-7)

Triggered automatically after Phase 7 is sealed: delegate to `documentation-writer` (haiku) to create
`.claude/worknotes/evidence-foundry-buildout/feature-guide.md` (What Was Built / Architecture Overview /
How to Test / Test Coverage Summary / Known Limitations, ≤200 lines). Commit the feature guide before
opening the PR. PR title should name the converter and module scaffold specifically (e.g., "Add
rf-bundle-to-kb-pack converter + cbc_suite_v1 vertical slice (E0)").

---

## Findings

Findings were captured during Phases 1 and 3 of execution and documented in `.claude/findings/evidence-foundry-buildout-findings.md`. Per P7-T14 finalization (deferred-items-and-findings.md §2 Step 4), the findings document has been updated:
- Status set to `accepted`
- `promoted_to` set to `/docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`
- All load-bearing findings either include corresponding design-specs or are explicitly marked as already-resolved/deferred-to-named-task (no new design-spec rows warranted)

---

## Completion Notes

Fill in when Phase 7 is complete: what was built, key learnings, unexpected challenges, and the
`karen` feature-end sign-off summary.
