---
type: progress
schema_version: 2
doc_type: progress
prd: spa-module-switcher
feature_slug: spa-module-switcher
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
phase_detail_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-0-2-foundation.md
execution_model: batch-parallel
phase: 0
title: "SPA Module Switcher — Phase 0: Governance & Paperwork Prerequisites"
status: pending
created: '2026-07-22'
updated: '2026-07-22'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 5
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P0-01
  description: >
    Author ADR-0009 — module eligibility policy for clinician-facing surfaces. Create
    docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md with `status: proposed`
    (next free ADR number, SQ-4 §3). Record a binding, future-facing mapping from `module.json.status`
    (closed enum, schemas/module-manifest.schema.json:22) to UI affordance: only `integrity-recorded`
    is selectable/assessable; `unsigned-stub` is listed-but-inert with its status shown verbatim;
    `superseded`/`revoked` never appear as choosable. Record the constant binding: the predicate
    references `READY_STATUS` imported from src/kbVerify.js:43 — never a hardcoded
    `'integrity-recorded'` literal. Record the "never hide unservable state" precedent from
    server.mjs's GET /api/v1/knowledge-base. State this ADR governs every future module, not only
    the current four. Do NOT conflate with ADR-0001 (its trigger concerns rule-schema authoring, not
    UI selection — SQ-4 §3).
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: []
  estimated_effort: "1.25 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md
  acceptance_criteria: >
    File exists at the exact path with status: proposed; the status→affordance mapping covers all 4
    enum values; the READY_STATUS-import constraint is stated as binding; ADR-0001 is explicitly
    named as not tripped, with SQ-4 §3's reason; no G0 ratification is claimed or implied (OQ-4:
    proposed suffices, matching ADR-0004/0005/0006).
- id: P0-02
  description: >
    Record the FR-14/R-8 lifting authority inside ADR-0009. Add a dedicated ADR section stating that
    E1's FR-14/R-8 prohibition on a client-selectable moduleId surface is scope-bounded to E1 and
    conditioned on "ahead of any UI/API decision to support it"; that this PRD IS that decision; and
    that ADR-0009 + the PRD together are the recorded authority under which the prohibition is
    lifted. Cross-reference multi-bundle-conversion-e1.md:523 (R-4, the four-peers misread risk) and
    state how D-1's structural grouping answers it. This section is the citation P6-010 quotes
    verbatim when flipping the DEFAULT_MODULE_ID tripwire.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P0-01]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md
  acceptance_criteria: >
    ADR-0009 contains a section naming E1 FR-14 and R-8 by ID, the scope-bound reading, and the PRD
    path as the decision that lifts it; the section is self-contained enough to be cited verbatim in
    a test comment and a commit message (P6-010 depends on this).
- id: P0-03
  description: >
    Reconcile public-moduleid-api-surface.md — hybrid (c)/(d), NOT promotion (SQ-4 §1). Fix the stale
    fact (the doc's 2026-07-21 deferral re-confirmation asserts no second module directory exists;
    commit 263120b invalidated that). Add a new dated section titled exactly "Deferral
    re-confirmation (SQ-4, 2026-07-22)" stating: the promotion trigger's "second module registered"
    clause fired, but its "a client needs to choose via the HTTP API" clause has not — the browser
    switcher makes zero /api/ calls. Cross-reference the switcher PRD as the doc that answers its
    :93 open question: single-module-at-a-time, not a combined view (assess() is single-module by
    design; ranking is an ordinal sort priority per module). Frontmatter: updated → 2026-07-22;
    related_documents += the PRD path; maturity: shaping stays unchanged. Do NOT promote the doc.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P0-01]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - docs/project_plans/design-specs/public-moduleid-api-surface.md
  acceptance_criteria: >
    The stale "no second module directory" assertion is corrected; a section titled exactly
    "Deferral re-confirmation (SQ-4, 2026-07-22)" exists with both clauses' status; :93 is answered
    as single-module-at-a-time with the stated rationale; frontmatter updated is 2026-07-22 and
    related_documents includes the PRD; maturity is byte-unchanged; the doc's status/promotion state
    is unchanged.
- id: P0-04
  description: >
    Zero-status-change verification (negative check), PRD FR-35 / decisions block §1 exit gate ("no
    status flipped anywhere"). Assert P0 changed no module manifest and signed nothing. Run
    `git diff --name-only` scoped to modules/ and confirm it is empty; confirm every
    modules/*/module.json still carries its pre-P0 status, approvedBy: [] and clinicalContentHash.
    Record the four observed statuses in the phase progress note as the baseline P6-001/P6-004
    assert against (anemia: integrity-recorded; cbc_suite_v1, growth_suite_v1, kidney_suite_v1:
    unsigned-stub). This is a check, not an edit.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P0-01, P0-03]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - modules/
  acceptance_criteria: >
    `git diff --name-only -- modules/` is empty after P0; the four statuses are recorded in the
    phase progress note; no sign-kb or signing script was invoked during the phase.
- id: P0-GATE
  description: >
    task-completion-validator gate. Verify the Phase 0 exit gate (decisions block §1): ADR-0009
    exists at the exact path with status: proposed; the design-spec dated re-confirmation section
    is present with the corrected fact; no status was flipped anywhere. Reject if the ADR claims
    ratification, if public-moduleid-api-surface.md was promoted rather than re-confirmed, or if
    any modules/** file changed.
  status: pending
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P0-01, P0-02, P0-03, P0-04]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
parallelization:
  batch_1: [P0-01]
  batch_2: [P0-02, P0-03]
  batch_3: [P0-04]
  batch_4: [P0-GATE]
  critical_path: [P0-01, P0-03, P0-04, P0-GATE]
  estimated_total_time: "~0.5–1 engineer-day"
blockers: []
success_criteria:
- id: SC-1
  description: "docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md exists, status: proposed, covering all 4 enum values"
  status: pending
- id: SC-2
  description: "The FR-14/R-8 lifting authority is recorded in a verbatim-quotable ADR section (P6-010 depends on it)"
  status: pending
- id: SC-3
  description: "public-moduleid-api-surface.md carries the dated 'Deferral re-confirmation (SQ-4, 2026-07-22)' section; maturity unchanged; not promoted"
  status: pending
- id: SC-4
  description: ":93 answered as single-module-at-a-time, with rationale"
  status: pending
- id: SC-5
  description: "Zero module manifest status changes; git diff --name-only -- modules/ empty; nothing signed"
  status: pending
- id: SC-6
  description: "ADR-0001 explicitly named as not tripped (SQ-4 §3) — no conflation with rule-schema authoring"
  status: pending
files_modified:
- docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md
- docs/project_plans/design-specs/public-moduleid-api-surface.md
notes: >
  Wave 1 (parallel with Phase 1) — first phase, no dependencies, but **must land first** in
  practice: it records the authority lifting E1's FR-14/R-8 prohibition on a client-selectable
  moduleId surface, and P6-010's DEFAULT_MODULE_ID tripwire decision cites this phase's ADR-0009
  section verbatim. Governance ordering is binding (PRD §9) — shipping the UI before this paperwork
  inverts the order this repository exists to protect. Provider must be pinned `claude` on every
  task: `task_class: documentation` otherwise resolves to free-tier Haiku regardless of the
  requested model (decisions block §6 routing finding) — these are governance artifacts requiring
  architectural judgment, not mechanical edits.
---

# spa-module-switcher — Phase 0: Governance & Paperwork Prerequisites

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-0-progress.md -t P0-01 -s completed
```

---

## Objective

Record, before any UI ships, the recorded authority under which E1's FR-14/R-8 prohibition on a
client-selectable `moduleId` surface is lifted — an ADR (`ADR-0009`) mapping `module.json.status` to
UI affordance, plus a corrected/reconciled `public-moduleid-api-surface.md`. Changes no module status
and signs nothing (verified by a negative check).

**Duration**: ~0.5–1 engineer-day · **Dependencies**: None (wave 1, parallel with Phase 1) ·
**Exit gate**: ADR-0009 exists at `status: proposed`; the design-spec dated re-confirmation section
is present with the corrected fact; no status was flipped anywhere.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P0-01 | Author ADR-0009 — module eligibility policy | general-purpose (documentation writer¹) | sonnet/adaptive | claude | pending | none |
| P0-02 | Record FR-14/R-8 lifting authority in ADR-0009 | general-purpose | sonnet/adaptive | claude | pending | P0-01 |
| P0-03 | Reconcile public-moduleid-api-surface.md | general-purpose | sonnet/adaptive | claude | pending | P0-01 |
| P0-04 | Zero-status-change verification (negative check) | general-purpose | sonnet/adaptive | claude | pending | P0-01, P0-03 |
| P0-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | pending | P0-01..P0-04 |

¹ **Agent-name substitution**: `documentation-writer` is not registered in this project; dispatched as
`general-purpose` with the role descriptor retained (see parent plan Phase Summary footnote ¹).

---

## Orchestration Quick Reference

### Batch 1 (no dependencies)

```
Task("general-purpose", "P0-01: Author ADR-0009 — module eligibility policy for clinician-facing
surfaces. Create docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md,
status: proposed. Map module.json.status (closed enum) to UI affordance: only
integrity-recorded selectable; unsigned-stub listed-but-inert; superseded/revoked never
choosable. Bind the predicate to READY_STATUS (src/kbVerify.js:43), never a hardcoded literal.
Explicitly name ADR-0001 as not tripped (SQ-4 §3). See plan §Phase 0, P0-01.")
```

### Batch 2 (after P0-01)

```
Task("general-purpose", "P0-02: Record the FR-14/R-8 lifting authority inside ADR-0009. Add a
section stating E1's FR-14/R-8 prohibition is scope-bounded to E1 and conditioned on 'ahead of
any UI/API decision to support it'; this PRD IS that decision. Cross-reference
multi-bundle-conversion-e1.md:523 (R-4). Must be verbatim-quotable — P6-010 cites it in a test
comment and commit message. See plan §Phase 0, P0-02.")

Task("general-purpose", "P0-03: Reconcile public-moduleid-api-surface.md — hybrid (c)/(d), NOT
promotion (SQ-4 §1). Fix the stale 'no second module directory' claim (commit 263120b
invalidated it). Add dated section 'Deferral re-confirmation (SQ-4, 2026-07-22)': the
second-module-registered clause fired, the HTTP-API-choice clause has not. Answer :93 as
single-module-at-a-time. maturity: shaping stays unchanged. Do NOT promote. See plan §Phase 0,
P0-03.")
```

### Batch 3 (after P0-01, P0-03)

```
Task("general-purpose", "P0-04: Zero-status-change verification (negative check, FR-35). Run
git diff --name-only -- modules/ and confirm empty; confirm every modules/*/module.json
unchanged (status, approvedBy: [], clinicalContentHash). Record the four observed statuses as
the P6-001/P6-004 baseline (anemia: integrity-recorded; cbc/growth/kidney: unsigned-stub). See
plan §Phase 0, P0-04.")
```

### Gate (after all tasks complete)

```
Task("task-completion-validator", "P0-GATE: Verify Phase 0 exit gate for spa-module-switcher —
ADR-0009 exists at status: proposed; design-spec re-confirmation section present with corrected
fact; zero module status changes anywhere. Reject if ADR claims ratification, if the design spec
was promoted rather than re-confirmed, or if any modules/** file changed.")
```

---

## Quality Gates

- [ ] `docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md` exists, `status: proposed`, covering all 4 enum values
- [ ] The FR-14/R-8 lifting authority is recorded in a verbatim-quotable ADR section (P6-010 depends on it)
- [ ] `public-moduleid-api-surface.md` carries the dated "Deferral re-confirmation (SQ-4, 2026-07-22)" section; the stale second-module-directory claim is corrected; `maturity` unchanged; **not promoted**
- [ ] `:93` answered as single-module-at-a-time, with rationale
- [ ] **Zero** module manifest status changes; `git diff --name-only -- modules/` empty; nothing signed
- [ ] ADR-0001 explicitly named as **not** tripped (SQ-4 §3) — no conflation with rule-schema authoring

---

## Implementation Notes

### Architectural Decisions

- ADR-0009 is a binding, **future-facing** mapping — it governs every future module, not only the
  current four (kidney/growth/cbc scaffolds included).
- `OQ-4` resolution: `status: proposed` suffices to merge, matching ADR-0004/0005/0006 — no G0
  ratification is claimed or required for this phase.

### Known Gotchas

- **Provider pin is load-bearing**: `task_class: documentation` resolves to free-tier Haiku
  regardless of the requested model unless `provider: claude` is pinned explicitly on every task
  (decisions block §6 routing finding).
- Do not conflate ADR-0009 with ADR-0001 — different triggers (UI selection vs. rule-schema authoring).
- This phase performs **zero** edits under `modules/` — P0-04 is a read-only verification, not a fix.

### Development Setup

Node ≥ 20. No code changes in this phase — docs/ADR only. Gate before Phase 2 opens (jointly with
Phase 1): `task-completion-validator` sign-off on this phase's `P0-GATE`.

---

## Completion Notes

Fill in when Phase 0 is complete: what was authored, key learnings, unexpected challenges,
recommendations for Phase 2 (which depends on both Phase 0 and Phase 1).
