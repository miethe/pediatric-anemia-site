---
type: progress
schema_version: 2
doc_type: progress
prd: clinical-review-workflow
feature_slug: clinical-review-workflow
prd_ref: docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
execution_model: batch-parallel
phase: 5
title: "Clinical Review Workflow v1 \u2014 Phase 5: Hardening, Docs & Deferred Items"
status: in_progress
created: '2026-07-22'
updated: '2026-07-22'
started: 2026-07-22T17:55Z
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 7
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
- documentation-writer
contributors:
- task-completion-validator
- karen
- codex-gpt-5.6-terra
model_usage:
  primary: sonnet
  external:
  - haiku
  - gpt-5.6-terra
tasks:
- id: P5-T1
  description: "Full adversarial + fail-closed test sweep (FR-28, F8). Extend tests/ef-review-workflow.test.mjs\
    \ (or a sibling directly under tests/) with adversarial fixture classes driven\
    \ through status, sign, and validate so every verb/path fails closed identically:\
    \ (i) transposed-character subjectContentHash, (ii) out-of-order review-act sequence,\
    \ (iii) supersedes-based correction, and \u2014 enumerated per F8 \u2014 (iv)\
    \ malformed YAML, (v) roster resolution failure, (vi) signature tampering, and\
    \ (vii) append-only git-history failure (with --history active). Each of (iv)-(vii)\
    \ is a NAMED negative fixture asserting status emits derivedState: \"invalid\"\
    \ + non-zero exit wherever validate rejects (FR-28). Also drive the frozen scaffold\
    \ --draft -> sign --draft -> validate command flow end-to-end (F9) through the\
    \ real CLI."
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - Phases 2, 3, 4 complete (P2-GATE2, P3-GATE2, P4-GATE3)
  estimated_effort: 1.0 pts
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tests/ef-review-workflow.test.mjs
  - tests/fixtures/clinical-review-workflow/
  acceptance_criteria: 7/7 adversarial/fail-closed classes produce the expected non-zero
    fail-closed result on status, sign, and validate; the four F8 classes each yield
    status's invalid state; zero fixture causes a silent pass.
- id: P5-T2
  description: "CLI/render smoke + npm run check wiring + determinism/zero-dep gates\
    \ (FR-20/21/22, R-P4, F10). This repo has no *.tsx; the render target surface\
    \ is the static HTML render emits. Extend tests/ef-review-render-smoke.test.mjs\
    \ to spawn the real cli.mjs render entry point over P3-T1's queue-section output\
    \ and assert NEXT/TERMINAL markers appear. F10: npm test is node --test tests/*.test.mjs\
    \ tests/witness/*.test.mjs \u2014 two flat, NON-recursive globs; every new test\
    \ file this feature adds MUST live directly under tests/ or tests/witness/ (no\
    \ new nested test subdirectory), and this task does NOT change package.json's\
    \ scripts.test. Add a guard test that asserts each new test file's path matches\
    \ one of those two globs. Add determinism tests (status --json byte-stable; sign's\
    \ non-signature fields byte-stable). Extend zero-new-deps and zero-network grep\
    \ tests to cover every new lib/*.mjs file."
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P5-T1
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tests/ef-review-render-smoke.test.mjs
  - tests/ef-review-record-cli.test.mjs
  - package.json
  acceptance_criteria: Smoke test asserts NEXT/TERMINAL marker text in the real rendered
    HTML; a discovery-guard test confirms every new test file matches tests/*.test.mjs
    or tests/witness/*.test.mjs (F10) and scripts.test is unchanged; status --json
    byte-diff across two invocations on unchanged input is empty; sign's non-signature
    fields are byte-stable across invocations; zero-new-deps grep test is green with
    no package.json dependency additions.
- id: P5-T3
  description: "docs/architecture.md \xA711 + README update (FR-18/19). Update docs/architecture.md\
    \ \xA711 (Review workflow, Evidence Foundry E1) to document the new verbs (status,\
    \ sign), the derived-state model, the runbook link, and the honesty boundary.\
    \ Update tools/review-record/README.md naming both new verbs, the incremental\
    \ validate path, the derived-state library, and linking the runbook and the portal-promotion\
    \ framework."
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P3-T3 (external, Phase 3)
  - P4-T3 (external, Phase 4)
  estimated_effort: 0.5 pts
  priority: medium
  assigned_model: haiku
  model_effort: adaptive
  target_surfaces:
  - docs/architecture.md
  - tools/review-record/README.md
  acceptance_criteria: "Docs-truth test asserts docs/architecture.md \xA711 names\
    \ both status and sign, links docs/governance/reviewer-runbook.md, and restates\
    \ the honesty boundary; tools/review-record/README.md names both verbs, the incremental\
    \ path, and links the runbook + friction-observations.md."
- id: P5-T4
  description: '(DOC-006) Deferred-items design-spec stubs. Per the Deferred Items
    Triage Table: (a) confirm docs/project_plans/design-specs/clinical-review-portal-workflow.md
    (already updated by P4-T3) as DF-CRW-01''s spec path; (b) author docs/project_plans/design-specs/real-reviewer-onboarding-g1.md
    (maturity: shaping, prd_ref set to this feature''s PRD, cross-referencing gates-registry.md
    G1 and the runbook''s post-G1 track) for DF-CRW-02; (c) author docs/project_plans/design-specs/df-e1-04-retrospective-validation-linkage.md
    (maturity: shaping) for DF-CRW-03, cross-referencing ADR-0004''s unblocks field.
    Append all three paths to this plan''s deferred_items_spec_refs frontmatter.'
  status: pending
  assigned_to:
  - documentation-writer
  dependencies:
  - P4-T3 (external, Phase 4)
  estimated_effort: 0.5 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - docs/project_plans/design-specs/
  acceptance_criteria: Three spec paths exist (1 confirmed existing + 2 newly authored),
    each with correct maturity/prd_ref; deferred_items_spec_refs has 3 entries.
- id: P5-GATE1
  description: "task-completion-validator gate: verify Phase 5 exit gate \u2014 npm\
    \ run check green; full adversarial sweep passes; deferred-items table fully covered."
  status: pending
  assigned_to:
  - task-completion-validator
  dependencies:
  - P5-T1
  - P5-T2
  - P5-T3
  - P5-T4
  estimated_effort: "\u2014"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: All exit-gate criteria pass; recorded in phase progress note.
- id: P5-GATE2
  description: 'karen feature-end review. Independently re-check against the actual
    full-feature diff (not the plan''s description): every Hard Guardrail holds byte-for-byte;
    all 29 PRD FRs (incl. FR-25..29 from Revision 1) have a passing test or docs-truth
    check; the FR-26 adjudication policy change is confirmed on both agree/disagree
    paths without ADR-0004 status mutation; the three deferred-item design-specs exist
    with correct maturity; npm run check green end-to-end. Feature may not be marked
    status: completed without this sign-off.'
  status: pending
  assigned_to:
  - karen
  dependencies:
  - P5-GATE1
  estimated_effort: "\u2014"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: 'karen sign-off recorded; feature may not be marked status:
    completed without it.'
- id: P5-GATE3
  description: "codex gpt-5.6-terra read-only second-opinion diff review. Full-feature\
    \ read-only diff review across all five phases \u2014 final fail-closed-gap sweep\
    \ before the feature guide/PR wrap-up."
  status: pending
  assigned_to:
  - codex (read-only)
  dependencies:
  - P5-GATE2
  estimated_effort: "\u2014"
  priority: high
  assigned_model: gpt-5.6-terra
  model_effort: high
  acceptance_criteria: Review recorded; any flagged gap becomes a task before the
    PR opens.
parallelization:
  batch_1:
  - P5-T1
  - P5-T3
  - P5-T4
  batch_2:
  - P5-T2
  batch_3:
  - P5-GATE1
  batch_4:
  - P5-GATE2
  batch_5:
  - P5-GATE3
  critical_path:
  - P5-T1
  - P5-T2
  - P5-GATE1
  - P5-GATE2
  - P5-GATE3
  estimated_total_time: ~2 engineer-days
blockers: []
success_criteria:
- id: SC-1
  description: npm run check green end-to-end
  status: pending
- id: SC-2
  description: 'Full 7-class adversarial + fail-closed sweep (FR-28/F8: transposed
    hash, out-of-order, supersedes, malformed YAML, roster failure, signature tampering,
    history failure) passes on status/sign/validate'
  status: pending
- id: SC-3
  description: All 29 PRD FRs (incl. FR-25..29 from Revision 1) have a passing test
    or docs-truth check
  status: pending
- id: SC-4
  description: "Deferred-items triage table fully covered \u2014 3 spec paths + 3\
    \ N/A rows with rationale"
  status: pending
- id: SC-5
  description: "docs/architecture.md \xA711 and tools/review-record/README.md updated"
  status: pending
- id: SC-6
  description: Every Hard Guardrail holds byte-for-byte (no ADR-0004 status edit,
    no real roster entries, D-4 untouched)
  status: pending
files_modified:
- tests/ef-review-workflow.test.mjs
- tests/fixtures/clinical-review-workflow/
- tests/ef-review-render-smoke.test.mjs
- tests/ef-review-record-cli.test.mjs
- package.json
- docs/architecture.md
- tools/review-record/README.md
- docs/project_plans/design-specs/real-reviewer-onboarding-g1.md
- docs/project_plans/design-specs/df-e1-04-retrospective-validation-linkage.md
- docs/project_plans/design-specs/clinical-review-portal-workflow.md
notes: "Wave 4, final \u2014 depends on Phases 2, 3, and 4 all completing. This phase\
  \ seals the feature: Phase 5 cannot close until all six deferred-items triage rows\
  \ are resolved (3 spec paths populated, 3 explicitly N/A with rationale) and, if\
  \ findings_doc_ref is non-null, that doc is status: accepted. Wrap-up (feature guide\
  \ + PR) is triggered automatically after P5-GATE2 (karen feature-end) passes \u2014\
  \ see plan's Wrap-Up section."
---

# clinical-review-workflow — Phase 5: Hardening, Docs & Deferred Items

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/clinical-review-workflow/phase-5-progress.md -t P5-T1 -s in_progress
```

---

## Objective

Full adversarial test sweep, `npm run check` wiring + determinism/zero-dep gates, docs
finalization (`docs/architecture.md` §11, README), and the three-item deferred-items
design-spec triage (DOC-006) that seals the feature. See PRD FR-18..22 and the Deferred Items
Triage Table (plan §"Deferred Items & In-Flight Findings Policy").

**Duration**: ~2 engineer-days · **Dependencies**: Phases 2, 3, 4 (wave 4, final) · **Exit
gate**: `npm run check` green; full adversarial sweep passes; deferred-items triage table
fully covered; `docs/architecture.md` §11 and `tools/review-record/README.md` updated.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Status | Dependencies |
|---------|------|-----------------------|---------------|--------|---------------|
| P5-T1 | Full adversarial + fail-closed test sweep (FR-28, F8) | general-purpose | sonnet/adaptive | pending | Phases 2, 3, 4 complete |
| P5-T2 | CLI/render smoke + `npm run check` wiring + determinism/zero-dep gates (F10) | general-purpose | sonnet/adaptive | pending | P5-T1 |
| P5-T3 | `docs/architecture.md` §11 + README update | documentation-writer | haiku/adaptive | pending | P3-T3 (external), P4-T3 (external) |
| P5-T4 (DOC-006) | Deferred-items design-spec stubs | documentation-writer | sonnet/adaptive | pending | P4-T3 (external) |
| P5-GATE1 | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | pending | P5-T1..T4 |
| P5-GATE2 | **karen** feature-end review | karen | sonnet/adaptive | pending | P5-GATE1 |
| P5-GATE3 | codex `gpt-5.6-terra` read-only second-opinion | codex (read-only) | gpt-5.6-terra/high | pending | P5-GATE2 |

---

## Orchestration Quick Reference

### Batch 1 (parallel — after Phases 2, 3, 4 all complete)

```
Task("general-purpose", "P5-T1: Full adversarial + fail-closed test sweep (FR-28, F8). Extend
tests/ef-review-workflow.test.mjs with adversarial fixture classes driven through status,
sign, AND validate so every verb/path fails closed identically: (i) transposed-character
subjectContentHash, (ii) out-of-order review-act sequence, (iii) supersedes-based correction,
and per F8 — (iv) malformed YAML, (v) roster resolution failure, (vi) signature tampering,
(vii) append-only git-history failure (--history active). Each of (iv)-(vii) must assert
status emits derivedState: \"invalid\" + non-zero exit wherever validate rejects (FR-28). Also
drive the frozen scaffold --draft -> sign --draft -> validate flow end-to-end (F9) through the
real CLI. See plan §Phase 5, P5-T1.")

Task("documentation-writer", "P5-T3: docs/architecture.md §11 + README update (FR-18/19).
Update architecture.md §11 (Review workflow, Evidence Foundry E1) documenting status/sign,
the derived-state model, the runbook link, and the honesty boundary. Update
tools/review-record/README.md naming both new verbs, the incremental validate path, the
derived-state library, and linking the runbook + friction-observations.md. See plan §Phase 5,
P5-T3.")

Task("documentation-writer", "P5-T4 (DOC-006): Deferred-items design-spec stubs. Author
docs/project_plans/design-specs/real-reviewer-onboarding-g1.md (maturity: shaping, prd_ref =
this feature's PRD, cross-ref gates-registry.md G1) and
docs/project_plans/design-specs/df-e1-04-retrospective-validation-linkage.md (maturity:
shaping, cross-ref ADR-0004 unblocks). Confirm clinical-review-portal-workflow.md as the third
(already updated) path. Append all 3 paths to deferred_items_spec_refs frontmatter. See plan
§Phase 5, P5-T4.")
```

### Batch 2 (after P5-T1)

```
Task("general-purpose", "P5-T2: CLI/render smoke + npm run check wiring + determinism/
zero-dep gates (FR-20/21/22, R-P4, F10). Extend tests/ef-review-render-smoke.test.mjs to spawn
the real cli.mjs render entry point and assert NEXT/TERMINAL markers in the emitted HTML. F10:
npm test is node --test tests/*.test.mjs tests/witness/*.test.mjs — two flat, NON-recursive
globs; every new test file MUST live directly under tests/ or tests/witness/ (no new nested
subdirectory); do NOT change package.json's scripts.test. Add a guard test asserting every new
test file's path matches one of those two globs. Add determinism tests (status --json and
sign's non-signature fields byte-stable across invocations). Extend zero-new-deps/zero-network
grep tests to cover every new lib/*.mjs file. See plan §Phase 5, P5-T2.")
```

### Gates

```
Task("task-completion-validator", "P5-GATE1: Verify Phase 5 exit gate for
clinical-review-workflow — npm run check green; full adversarial sweep passes;
deferred-items triage table fully covered.")

Task("karen", "P5-GATE2: Feature-end review of clinical-review-workflow. Independently
re-check against the actual FULL-FEATURE diff (not the plan's description): every Hard
Guardrail holds byte-for-byte (no ADR-0004 status edit, zero real roster entries,
clinicalApprovers[]/approvedBy[] untouched, D-4 untouched, zero new runtime deps/network/LLM
in tools/review-record/); all 29 PRD FRs (incl. FR-25..29 from Revision 1) have a passing test
or docs-truth check; P1-T5's FR-26 adjudication policy change is confirmed on BOTH
agree/disagree paths without any ADR-0004 status mutation; the three deferred-item
design-specs exist with correct maturity; npm run check green end-to-end. The feature may not
be marked status: completed without this sign-off.")
```

codex `gpt-5.6-terra` read-only second-opinion (invoke via the `codex` skill, read-only diff
mode, after P5-GATE2 passes — final fail-closed-gap sweep before PR):

```
codex exec --read-only "Full-feature read-only diff review of clinical-review-workflow across
all five phases. Final fail-closed-gap sweep before the feature guide/PR wrap-up."
```

### Wrap-up (after P5-GATE2 karen passes)

```
Task("documentation-writer", "Create .claude/worknotes/clinical-review-workflow/feature-guide.md
(What Was Built / Architecture Overview / How to Test / Test Coverage Summary / Known
Limitations, <=200 lines) per the plan's Wrap-Up section, then commit it. No CHANGELOG entry
per the OQ-5 decision (internal tooling).")
```

---

## Implementation Notes

### Architectural Decisions

Phase 5 is a pure hardening/docs/closeout phase — no new verb surface. The
adversarial-fixture-class sweep (P5-T1) is what proves the whole feature's fail-closed posture
holds under the same attack classes the underlying substrate already defends against.

### Known Gotchas

- Phase 5 cannot be sealed until the Deferred Items Triage Table's six rows are all resolved
  (3 spec paths + 3 explicit N/A rows) — this is a hard exit-gate condition, not optional
  polish.
- If any Phase 1–5 execution surfaces a plan/reality mismatch,
  `.claude/findings/clinical-review-workflow-findings.md` is created on the first real finding
  and `findings_doc_ref` is set in the plan frontmatter — Phase 5 cannot seal while that doc is
  non-null and not `status: accepted`.
- karen's feature-end gate (P5-GATE2) is the binding sign-off for `status: completed` — no
  task or gate before it may claim that status on this feature's own tracking.
- Revision 1 expanded P5-T1's adversarial sweep from 3 to 7 fixture classes (the 4 new ones —
  malformed YAML, roster failure, signature tampering, history failure — map to F8's `status`
  `invalid`-state requirement) and constrained P5-T2's test-file placement to two flat globs
  (F10) — do not add a nested test subdirectory or touch `package.json`'s `scripts.test`.

---

## Completion Notes

Summary of phase completion (fill in when phase is complete):

- What was built
- Key learnings
- Unexpected challenges
- Recommendations / handoff to PR + feature-guide wrap-up
