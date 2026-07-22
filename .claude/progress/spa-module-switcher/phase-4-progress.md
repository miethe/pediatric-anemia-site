---
type: progress
schema_version: 2
doc_type: progress
prd: spa-module-switcher
feature_slug: spa-module-switcher
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
phase_detail_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-3-5-ui.md
execution_model: batch-parallel
phase: 4
title: "SPA Module Switcher — Phase 4: Fail-Closed Refusal State + Capability Gating"
status: pending
created: '2026-07-22'
updated: '2026-07-22'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 9
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
- karen
integration_owner: phase-owner
seam_tasks: [P4-06]
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P4-01
  description: >
    showModuleRefusal(moduleId, reason) — the distinct third state (FR-14, FR-19). Implement a
    refusal path in src/app.js independent of showInputRejection (:686-699). May reuse that
    function's skeleton (invariant sequence) but must be its own function with its own heading and
    DOM branch — never routed through INPUT_REJECTION_CODES. Enforces shared invariants in a
    defined order: clear currentAudit → hide #results → show #results-placeholder →
    refreshAuditView() → disable submit → render the reason. Module selector must remain
    interactive. FR-15..FR-18 each supply a distinct reason string, sourced from
    src/moduleStatusVocabulary.js.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-04]
  estimated_effort: "1.25 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    showModuleRefusal exists and is not showInputRejection; no refusal reason code is added to
    INPUT_REJECTION_CODES; after any refusal, currentAudit === null, #results is hidden,
    #results-placeholder is shown, the audit download control is disabled, submit is disabled, and
    the selector is still operable; the heading is never "Check the entered units".
- id: P4-02
  description: >
    Refusal Case 1 — evidence registry has no entry for the module (FR-15 / SQ-3 §4.1).
    src/evidence/registry.js:52-62 (accessorsFor) throws unknown module "<id>" for every rule in
    ruleAudit; REGISTRY holds only anemia and cbc_suite_v1. Today this lands in showFatalError as a
    generic "Application error". Route it instead to showModuleRefusal with "No assessment
    produced — evidence not available for module X"; disable submit; keep the module selector
    usable.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    A module whose id is absent from src/evidence/registry.js's REGISTRY produces the refusal, not
    "Application error" and not "Check the entered units"; the reason names the module; submit
    disabled; selector usable.
- id: P4-03
  description: >
    Refusal Case 2 — hooks report not-implemented, detected before render (FR-16 / SQ-3 §4.2,
    F5–F7). Detection is preferential at selection time from the module descriptor (a
    renderable/assessable capability read), fallback on summarize() returning
    notYetImplemented === true or status === 'not_yet_implemented'. Refusal copy substitutes the
    module title. renderClassification must not run at all — its guards are === null while stub
    fields are undefined, so it renders "undefined g/dL", "undefined fL" (F6) and
    humanize(undefined) → 'Indeterminate' (F7), reading as "anemia status was evaluated and is
    indeterminate" when it was never evaluated. Detection before render is the entire point.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01, P2-03]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    A module whose hooks return the not-implemented shape triggers refusal with
    renderClassification never invoked (spy/call-count or absence of its output nodes); no
    "undefined" string and no Indeterminate classification appears anywhere in the DOM; detection
    happens at selection time, before assess().
- id: P4-04
  description: >
    Refusal Case 3 — manifest status is not READY_STATUS (FR-17 / SQ-3 §4.3). Refuse to load the
    module and state the actual status verbatim from the closed enum plus its canonical
    vocabulary sentence. Must not downgrade to a warning: build-static.mjs:76-79 already
    warns-instead-of-exits for non-default modules, so the browser is the ONLY enforcement point.
    Normally unreachable through the UI (P2-03's predicate makes ineligible rows inert) and is
    reached only via a hand-edited ?module= — defence in depth.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01, P2-03]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    An ineligible ?module= value produces the refusal with the verbatim enum status shown; no
    warning-level or dismissible treatment; assess() is never called (spy).
- id: P4-05
  description: >
    Refusal Case 4 — module KB fetch fails / 404 (FR-18 / SQ-3 §4.4). Mirror src/app.js:558-560's
    existing message but module-scoped: "Unable to load module X's knowledge base." rules and
    candidates must be reset to []/{} BEFORE the fetch (P2-04's ordering contract), never left
    holding the previous module's data.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01, P2-04]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    A simulated 404 on a module's rules.json produces the refusal naming that module; after the
    failure rules is [] and candidates is {}; the previous module's rules are provably not in
    memory or on screen.
- id: P4-06
  description: >
    SEAM TASK (R-P3) — banner ↔ refusal atomicity across the P3/P4 boundary. P3 owns the
    banner/selection state; P4 owns the refusal state; both write src/app.js and index.html. This
    task proves they do not race. Selecting an ineligible module must swap the banner AND clear
    results atomically: no observable interleaving where the previous module's result is displayed
    beneath the new module's banner, and no tick where the audit JSON remains downloadable after
    the banner has changed. Per AC-4's resilience clause: if triggered while a previous result is
    displayed, the prior result is cleared BEFORE the refusal renders, and the audit download
    control is disabled in the SAME tick. Order the state transition explicitly and comment it as
    load-bearing.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01, P3-04]
  estimated_effort: "0.75 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    A test drives: assess under anemia → results visible and audit downloadable → select an
    ineligible module. Assertions: at no point after the banner updates is #results visible;
    currentAudit is null before the refusal DOM is written; the audit download control is disabled
    in the same tick as the banner swap; the prior module's candidate/alert nodes are absent from
    the DOM.
- id: P4-07
  description: >
    Unregistered ?module= id — explicit refusal naming the requested id (FR-21). A ?module= value
    failing isRegisteredModule() (src/modules/registry.js:75) produces an explicit refusal NAMING
    THE REQUESTED ID, never a silent substitution and never a silent fallback to anemia. Distinct
    from Case 3 (registered-but-ineligible); needs its own reason string.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01, P3-05]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    ?module=not_a_module renders a refusal quoting not_a_module; the active module does not become
    anemia; no assessment is produced; the selector remains usable so the clinician can pick a
    real module.
- id: P4-GATE
  description: >
    task-completion-validator gate. Verify the Phase 4 exit gate: each of the 4 refusal cases has
    a test; no path reaches assess() for an ineligible module. Reject if any refusal routes through
    showInputRejection or INPUT_REJECTION_CODES, if any refusal leaves a downloadable audit, or if
    renderClassification can run for a not-implemented module.
  status: pending
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P4-01, P4-02, P4-03, P4-04, P4-05, P4-06, P4-07]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: P4-KAREN
  description: >
    karen milestone review (Milestone 2). Independent review of the safety-critical slice. Verify:
    (1) refusal is genuinely a third state — trace every refusal path and confirm none reaches
    showInputRejection; (2) NO code path reaches assess() for a module failing the P2-03 predicate;
    (3) the "Check the entered units" heading is unreachable for a module-level failure; (4) after
    every refusal the audit JSON is not downloadable and no prior result survives; (5) nothing in
    the refusal copy implies "coming soon", "preview"/"beta", or "temporarily unavailable" —
    gates-registry.md:130-132 makes unsigned-stub → release-ready schema-impossible, so any such
    word is a false implication.
  status: pending
  assigned_to: [karen]
  provider: claude
  dependencies: [P4-GATE]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  acceptance_criteria: >
    Milestone review recorded; findings fixed in-phase or logged to
    .claude/findings/spa-module-switcher-findings.md.
parallelization:
  batch_1: [P4-01]
  batch_2: [P4-02, P4-03, P4-04, P4-05]
  batch_3: [P4-06, P4-07]
  batch_4: [P4-GATE]
  batch_5: [P4-KAREN]
  critical_path: [P4-01, P4-03, P4-06, P4-GATE, P4-KAREN]
  estimated_total_time: "~2 engineer-days"
blockers:
- id: BLOCKER-PHASE-DEP
  title: "Phase 4 cannot open until Phase 3 exit gate (P3-GATE) passes"
  severity: high
  blocking: [P4-01]
  resolution: >
    Wait for .claude/progress/spa-module-switcher/phase-3-progress.md P3-GATE to complete.
  created: '2026-07-22'
success_criteria:
- id: SC-1
  description: "Refusal is a distinct third state; showInputRejection untouched and never reused for module-level failures"
  status: pending
- id: SC-2
  description: "All 4 SQ-3 §4 refusal cases implemented and individually tested"
  status: pending
- id: SC-3
  description: "renderClassification provably never runs for a not-implemented module (no 'undefined g/dL', no false Indeterminate)"
  status: pending
- id: SC-4
  description: "assess() unreachable for any module failing the READY_STATUS predicate"
  status: pending
- id: SC-5
  description: "Every refusal enforces the FR-19 invariants; audit never downloadable post-refusal; no silent fallback to anemia"
  status: pending
- id: SC-6
  description: "Seam task P4-06 proves banner ↔ refusal atomicity with no observable interleaving"
  status: pending
- id: SC-7
  description: "Unregistered ?module= names the requested id explicitly"
  status: pending
- id: SC-8
  description: "Zero maturity-ladder vocabulary ('preview', 'beta', 'coming soon', 'temporarily unavailable') in any refusal copy"
  status: pending
- id: SC-9
  description: "karen Milestone 2 review recorded"
  status: pending
- id: SC-10
  description: "Screenshot of the refusal state at ≥1440px showing no results panel, no downloadable audit, no 'Check the entered units' heading (AC-4)"
  status: pending
files_modified:
- src/app.js
notes: >
  Wave 4 — depends on Phase 3 complete. **Safety-critical slice** — effort is `extended` on every
  implementer task, not `adaptive`. **`integration_owner: phase-owner`** shared with Phase 3; **seam
  task P4-06** lives in this phase's tracking file. SQ-3 proved the current failure mode is actively
  dangerous: growth/kidney fail at src/units.js:167, throw UnitRejectionError, which is in
  INPUT_REJECTION_CODES, so src/app.js:693 renders "Check the entered units" — an unimplemented
  module masquerading as a clinician data-entry error (a live docs/architecture.md:391 violation).
  The P2-03 eligibility gate makes this unreachable through the UI; this refusal state is built
  anyway as defence in depth. **Shared invariants for every refusal** (D-4/SQ-3 §4/FR-19):
  currentAudit = null; #results hidden; #results-placeholder shown; refreshAuditView() called;
  submit disabled; module selector stays usable.
---

# spa-module-switcher — Phase 4: Fail-Closed Refusal State + Capability Gating

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-4-progress.md -t P4-01 -s completed
```

---

## Objective

Build the third fail-closed state — distinct from success and input-rejection — covering all four
SQ-3 §4 refusal cases, and prove (seam task P4-06) that the banner (Phase 3) and refusal (this
phase) transitions are atomic. This is Milestone 2 of 3 named `karen` reviews and the
**safety-critical slice** of the whole feature.

**Duration**: ~2 engineer-days · **Dependencies**: Phase 3 complete (wave 4) ·
**`integration_owner`**: `phase-owner` (shared with Phase 3) · **Seam task**: `P4-06` ·
**Effort**: `extended` on every implementer task · **Exit gate**: each of the 4 refusal cases has a
test; no path reaches `assess()` for an ineligible module.

### Why refusal is a *third* state and not a reuse

SQ-3 proved the current failure mode is actively dangerous. Growth/kidney fail at
`src/units.js:167` (not the evidence registry), throw `UnitRejectionError`
(`code: 'UNIT_REJECTED'`), which is in `src/app.js:20 INPUT_REJECTION_CODES`, so `src/app.js:693`
renders the heading **"Check the entered units"**. An unimplemented module masquerades as a
clinician data-entry error — a live `docs/architecture.md:391` violation. The P2-03 eligibility
gate makes this unreachable through the UI; the refusal state is built anyway as **defence in
depth**, as a distinct third state, and **never** as a reuse of `showInputRejection`.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P4-01 | `showModuleRefusal(moduleId, reason)` — the distinct third state | general-purpose (frontend engineer¹) | sonnet/extended | claude | pending | P3-04 |
| P4-02 | Refusal Case 1 — evidence registry has no entry | general-purpose | sonnet/extended | claude | pending | P4-01 |
| P4-03 | Refusal Case 2 — hooks not-implemented, detected before render | general-purpose | sonnet/extended | claude | pending | P4-01, P2-03 |
| P4-04 | Refusal Case 3 — manifest status ≠ READY_STATUS | general-purpose | sonnet/extended | claude | pending | P4-01, P2-03 |
| P4-05 | Refusal Case 4 — module KB fetch fails / 404 | general-purpose | sonnet/extended | claude | pending | P4-01, P2-04 |
| P4-06 | **SEAM TASK (R-P3)** — banner ↔ refusal atomicity | general-purpose | sonnet/extended | claude | pending | P4-01, P3-04 |
| P4-07 | Unregistered `?module=` id — explicit refusal | general-purpose | sonnet/extended | claude | pending | P4-01, P3-05 |
| P4-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | pending | P4-01..P4-07 |
| P4-KAREN | **`karen` milestone review (Milestone 2)** | karen | sonnet/extended | claude | pending | P4-GATE |

¹ **Agent-name substitution**: `frontend-developer` is not registered in this project; dispatched
as `general-purpose` with the role descriptor retained.

---

## Orchestration Quick Reference

### Batch 1 (after Phase 3 gate)

```
Task("general-purpose", "P4-01: showModuleRefusal(moduleId, reason) — the distinct third state
(FR-14/FR-19). Independent function from showInputRejection, own heading, own DOM branch, never
via INPUT_REJECTION_CODES. Enforce invariants in order: clear currentAudit → hide #results → show
#results-placeholder → refreshAuditView() → disable submit → render reason. Selector stays
interactive. See plan §Phase 4, P4-01.")
```

### Batch 2 (after P4-01)

```
Task("general-purpose", "P4-02: Refusal Case 1 — evidence registry has no entry for the module
(FR-15/SQ-3 §4.1). src/evidence/registry.js throws unknown module for growth/kidney. Route to
showModuleRefusal: 'No assessment produced — evidence not available for module X'. See plan
§Phase 4, P4-02.")

Task("general-purpose", "P4-03: Refusal Case 2 — hooks not-implemented, detected BEFORE render
(FR-16/SQ-3 §4.2, F5-F7). Detect at selection time from module descriptor / summarize()
notYetImplemented. renderClassification must NEVER run — prevents 'undefined g/dL' and false
Indeterminate. See plan §Phase 4, P4-03.")

Task("general-purpose", "P4-04: Refusal Case 3 — manifest status ≠ READY_STATUS (FR-17/SQ-3
§4.3). State the actual status verbatim. Never downgrade to a warning — browser is the only
enforcement point. Defence-in-depth for a hand-edited ?module=. See plan §Phase 4, P4-04.")

Task("general-purpose", "P4-05: Refusal Case 4 — module KB fetch fails/404 (FR-18/SQ-3 §4.4).
Module-scoped 'Unable to load module X's knowledge base.' rules/candidates reset to []/{} BEFORE
the fetch (P2-04 ordering). See plan §Phase 4, P4-05.")
```

### Batch 3 (after P4-01 + P3/case dependencies)

```
Task("general-purpose", "P4-06: SEAM TASK (R-P3) — banner ↔ refusal atomicity across the P3/P4
boundary. Prove no observable interleaving where a prior result is visible beneath the new
banner, and no tick where the audit stays downloadable after the banner changes. Order the state
transition explicitly, comment it as load-bearing. See plan §Phase 4, P4-06.")

Task("general-purpose", "P4-07: Unregistered ?module= id — explicit refusal naming the requested
id (FR-21). Distinct from Case 3. Never fall back to anemia silently. See plan §Phase 4, P4-07.")
```

### Gate + Milestone (after all tasks complete)

```
Task("task-completion-validator", "P4-GATE: Verify Phase 4 exit gate for spa-module-switcher —
each of the 4 refusal cases has a test; no path reaches assess() for an ineligible module. Reject
if any refusal routes through showInputRejection/INPUT_REJECTION_CODES, leaves a downloadable
audit, or if renderClassification can run for a not-implemented module.")

Task("karen", "P4-KAREN: Milestone 2 review of the safety-critical refusal slice for
spa-module-switcher. Verify: (1) refusal is genuinely a third state, none reaches
showInputRejection; (2) NO path reaches assess() for a module failing the eligibility predicate;
(3) 'Check the entered units' is unreachable for module-level failure; (4) audit never
downloadable and no prior result survives after refusal; (5) zero maturity-ladder vocabulary
('coming soon'/'preview'/'beta'/'temporarily unavailable') in refusal copy.")
```

---

## Quality Gates

- [ ] Refusal is a distinct third state; `showInputRejection` untouched and never reused for module-level failures
- [ ] All 4 SQ-3 §4 refusal cases implemented **and** individually tested
- [ ] `renderClassification` provably never runs for a not-implemented module (no `"undefined g/dL"`, no false `Indeterminate`)
- [ ] `assess()` unreachable for any module failing the `READY_STATUS` predicate
- [ ] Every refusal enforces the FR-19 invariants; audit never downloadable post-refusal; no silent fallback to `anemia`
- [ ] Seam task P4-06 proves banner ↔ refusal atomicity with no observable interleaving
- [ ] Unregistered `?module=` names the requested id explicitly
- [ ] Zero maturity-ladder vocabulary ("preview", "beta", "coming soon", "temporarily unavailable") in any refusal copy
- [ ] `karen` Milestone 2 review recorded
- [ ] Screenshot of the refusal state at ≥1440px showing no results panel, no downloadable audit, no "Check the entered units" heading (AC-4)

---

## Implementation Notes

### Architectural Decisions

- `showModuleRefusal` may share `showInputRejection`'s *skeleton* (the invariant sequence) but is
  its own function with its own DOM branch — never routed through `INPUT_REJECTION_CODES`.
- Detection for Case 2 is **preferential at selection time** from the module descriptor, with a
  hook-return fallback — never a post-render correction.

### Known Gotchas

- This is the **safety-critical slice** — every implementer task carries `extended`, not
  `adaptive`, effort.
- P4-06 (the seam task) is the join point between Phase 3's banner state and this phase's refusal
  state — both write `src/app.js`/`index.html`, so ordering/atomicity is the entire point of the
  task, not an afterthought.
- Do not let Case 2's detection run `renderClassification` even once during development/debugging
  — its `=== null` guards vs. `undefined` stub fields is the exact F6/F7 hazard this phase exists
  to close.

### Development Setup

Node ≥ 20. Gate before Phase 5/6 open: `task-completion-validator` sign-off (`P4-GATE`) + `karen`
Milestone 2 sign-off (`P4-KAREN`) — **both** required.

---

## Completion Notes

Fill in when Phase 4 is complete: what was built, key learnings, unexpected challenges,
recommendations for Phase 5 (module-scoped degradation, built on this phase's settled state
machine) and Phase 6 (verification).
