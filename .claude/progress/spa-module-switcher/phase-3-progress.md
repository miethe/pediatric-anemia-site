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
phase: 3
title: "SPA Module Switcher — Phase 3: Selector UI + Status Banner + ?module= URL State"
status: pending
created: '2026-07-22'
updated: '2026-07-22'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 8
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
integration_owner: phase-owner
seam_tasks: [P4-06]
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P3-01
  description: >
    index.html selector markup — persistent rail, two labelled structural groups (FR-1, FR-2 /
    R-1). Add the module-selector container as a persistent rail rendering all four registered
    modules from listModules()/MODULE_IDS — no registered module is hidden — in two labelled
    structural groups: selectable, and not-selectable-with-reason. Panel header rendered verbatim
    from the vocabulary constant: "These modules are not peers. Read each row." Grouping is what
    stops "disabled" reading as "temporarily unavailable" (SQ-1 §5) — structural, not a footnote.
    index.html supplies only the static container and header; rows are rendered by P3-03.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-03]
  estimated_effort: "1.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  acceptance_criteria: >
    Container present; header text comes from src/moduleStatusVocabulary.js by identifier, not
    written inline in index.html; two group elements exist with distinct labels; markup contains
    zero module names, statuses or counts hardcoded (all injected at render).
- id: P3-02
  description: >
    styles.css — group + inert-row treatment using existing :root tokens only (FR-11). Style the
    rail, the two group headers, and the inert-row treatment reusing existing :root tokens and
    the established .safety-banner / .tab-nav visual language. There is no green / success /
    approved visual state — integrity-recorded uses the SAME severity treatment as the scaffolds
    (D-3, FR-11). Ineligible rows must be distinguishable by more than colour or hatching: the
    reason text is part of the row. Introduce no new colour token that reads as "good".
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-01]
  estimated_effort: "1.0 pts"
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - styles.css
  acceptance_criteria: >
    No new token is added whose name or value reads as success/green/approved; the
    integrity-recorded row and the unsigned-stub rows share the same severity treatment class; the
    inert state is conveyed by text + disabled semantics, never by colour alone; mobile at 375px
    width does not clip the rail (AC-1 visual evidence requirement).
- id: P3-03
  description: >
    src/app.js — render module rows from the frozen manifest map (FR-3 / R-P2). Render each row
    from src/moduleManifests.js: manifest.title, manifest.engineLabel verbatim, the module's own
    rule/candidate counts, and its status chip (manifest.status verbatim, FR-7). Scaffold rows
    additionally show the module's own limitations() notice text. No new prose is invented for any
    module's capability. Group membership computed ONCE by the P2-03 predicate. R-P2 handling: a
    module.json missing an optional envelope field renders required fields only, never
    undefined/empty-label; a MODULE_IDS entry absent from the manifest map renders in the
    not-selectable group with the FR-17 refusal reason, never silently dropped.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-01, P2-03]
  estimated_effort: "1.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    All 4 rows render with title, verbatim engineLabel, per-module counts and verbatim status
    chip; scaffold rows show their own limitations() text; a synthetic manifest missing an
    optional field renders without undefined/empty-label artifacts; a synthetic MODULE_IDS entry
    absent from the manifest map appears in the not-selectable group; grep confirms no capability
    prose was authored for any module.
- id: P3-04
  description: >
    Status banner render — verbatim status, derived approvedBy clause, honesty boundary,
    staleness disclosure (FR-7, FR-9, FR-13, FR-34). Render the active module's status banner from
    src/moduleStatusVocabulary.js by identifier — no status text written inline. Carries: the
    verbatim enum status chip; the universal FR-9 clause for EVERY module including anemia,
    derived from approvedBy.length === 0; the FR-13 honesty-boundary sentence IN THE PANEL, not a
    tooltip; the FR-34 non-enforcement disclosure adjacent to evidenceReviewedThrough, not in a
    tooltip. The FR-10 subtitle renders only where status === 'unsigned-stub'. Prohibited
    (FR-31/FR-32): any hash, "integrity verified", "content unmodified", approval badge, checkmark,
    or "verified"/"approved"/"released" wording.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-01, P1-02]
  estimated_effort: "1.25 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  - index.html
  acceptance_criteria: >
    Banner renders correctly for all 4 statuses; every string is referenced by identifier from the
    vocabulary module; the FR-9 clause appears on the anemia banner too; the honesty-boundary
    sentence and staleness disclosure are in the panel/adjacent to the date, not in title=/tooltip
    attributes; the FR-10 subtitle appears only under unsigned-stub; grep of rendered output and
    source for hash/approval/release tokens returns zero hits.
- id: P3-05
  description: >
    ?module=<id> URL state — read, validate, write (FR-20, FR-21, FR-22). On load, read ?module=
    and validate with isRegisteredModule() (src/modules/registry.js:75). Absent → DEFAULT_MODULE_ID.
    Selecting a module writes ?module=<id> via history.replaceState, preserving the current #tab
    hash. A value that is unregistered or ineligible produces an explicit refusal naming the
    requested id (implemented in P4-07), never a silent substitution and never a silent fallback
    to anemia. No localStorage/sessionStorage/cookie read or written (FR-24).
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-03, P2-03]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    ?module=cbc_suite_v1 on load selects that row (inert) and does not fall back to anemia; absent
    param → DEFAULT_MODULE_ID; selection writes the param while the #tab hash survives; grep for
    localStorage/sessionStorage/document.cookie across app-surface files returns zero hits.
- id: P3-06
  description: >
    Fix switchTab's history.replaceState to preserve the query string (FR-23 / R-7). src/app.js:457
    currently drops the query string via `history.replaceState(null, '', \`#${tab}\`)`, silently
    discarding ?module=. Rewrite it to preserve window.location.search while updating only the
    hash. Deliberately its own task because R-7's likelihood is High and it is trivially missed
    inside a larger UI change.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-05]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    After selecting a non-default module and switching tabs, window.location.search still
    contains ?module=<id>; the hash still routes tabs exactly as before (existing hash-routing
    behaviour unchanged); P6-006 asserts the round-trip.
- id: P3-07
  description: >
    FR-37 — programmatic inertness + reason-in-accessible-name (a11y, role="alert", keyboard nav).
    THIS IS NOW FR-37, not NFR prose: the karen gate found the inertness mechanism had no
    requirement and no AC pointing at it. Status banner uses the existing role="alert" pattern
    (.safety-banner, index.html:41-43); the module list is fully keyboard-navigable and focus is
    not trappable inside an inert row; ineligible rows are programmatically disabled (a real
    disabled/aria-disabled + non-activatable state, not merely dimmed) so assistive technology
    reports them unavailable; each ineligible row's reason text is part of its accessible name,
    never colour/opacity/hatching alone. Add a code comment recording that `disabled` is a
    PRESENTATION guarantee, NOT the security boundary — a devtools user can delete it; the gate
    that survives that is the FR-6 predicate inside the handlers (AC-11 / P6-012).
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-01, P3-03, P3-04]
  estimated_effort: "1.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  - src/app.js
  verifies_ac: [AC-1]
  acceptance_criteria: >
    Banner carries role="alert"; every row is keyboard-reachable and ineligible rows are announced
    as disabled; each ineligible row's accessible name includes its reason text; no colour-only
    state conveyance; focus order is linear through the rail; a code comment records that
    `disabled` is not the gate and names AC-11.
- id: P3-GATE
  description: >
    task-completion-validator gate. Verify the Phase 3 exit gate: banner renders all 4 statuses;
    role="alert" present; keyboard-navigable. Reject if any status string is inline in
    index.html/src/app.js, if CBC Suite renders as selectable (mockup divergence), if a
    green/approved state exists, or if switchTab still drops the query string.
  status: pending
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P3-01, P3-02, P3-03, P3-04, P3-05, P3-06, P3-07]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
parallelization:
  batch_1: [P3-01]
  batch_2: [P3-02, P3-03]
  batch_3: [P3-04, P3-05]
  batch_4: [P3-06, P3-07]
  batch_5: [P3-GATE]
  critical_path: [P3-01, P3-03, P3-04, P3-05, P3-06, P3-GATE]
  estimated_total_time: "~2.5–3 engineer-days (8 pts)"
blockers:
- id: BLOCKER-PHASE-DEP
  title: "Phase 3 cannot open until Phase 2 exit gates (P2-GATE, P2-KAREN) both pass"
  severity: high
  blocking: [P3-01]
  resolution: >
    Wait for .claude/progress/spa-module-switcher/phase-2-progress.md P2-GATE and P2-KAREN to both
    complete.
  created: '2026-07-22'
success_criteria:
- id: SC-1
  description: "All 4 modules render in two labelled structural groups under the verbatim panel header"
  status: pending
- id: SC-2
  description: "CBC Suite renders inert, superseding both mockups (D-1 / FR-4)"
  status: pending
- id: SC-3
  description: "Banner renders correctly for all 4 enum statuses; every string referenced by identifier from src/moduleStatusVocabulary.js"
  status: pending
- id: SC-4
  description: "FR-9 approvedBy clause renders on every module including anemia"
  status: pending
- id: SC-5
  description: "Honesty-boundary sentence and staleness disclosure are in-panel/adjacent, never tooltips"
  status: pending
- id: SC-6
  description: "Zero hash / 'integrity verified' / approval-badge / green-state surfaces (FR-31, FR-32, FR-11)"
  status: pending
- id: SC-7
  description: "?module= round-trips and survives a tab switch (src/app.js:457 fixed)"
  status: pending
- id: SC-8
  description: "No localStorage/sessionStorage/cookie read or written"
  status: pending
- id: SC-9
  description: "FR-37: role=\"alert\", keyboard-navigable, ineligible rows programmatically disabled with the reason in the accessible name, plus a comment recording that disabled is presentation and not the gate (AC-11)"
  status: pending
- id: SC-10
  description: "AC-1 screenshots (≥1440px AND 375px, both groups, all four rows) captured and reviewed BY A PERSON at P6-011 — no task here automates capture (D-6 / PRD §11a)"
  status: pending
files_modified:
- index.html
- styles.css
- src/app.js
notes: >
  Wave 3 — depends on Phase 2 complete (both P2-GATE and P2-KAREN). **`integration_owner:
  phase-owner`** — declared jointly on this phase and Phase 4 because both write src/app.js and
  index.html (rule R-P3). The seam task proving they do not race is **P4-06** (in Phase 4's
  tracking file, not this one). Form factor (OQ-1, resolved): persistent sidebar rail (mockup
  variant A) — an interstitial one-time picker leaves no in-session reminder of which module is
  active. Design mockups are non-binding (PRD §14) — two known divergences must not be copied: CBC
  Suite rendered selectable (superseded by D-1/FR-4), and the unsigned-stub subtitle applied as a
  general device (FR-10 restricts it).
---

# spa-module-switcher — Phase 3: Selector UI + Status Banner + `?module=` URL State

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-3-progress.md -t P3-01 -s completed
```

---

## Objective

Build the persistent-rail selector UI, the per-module status banner, and `?module=` URL state —
the presentation layer over Phase 2's seams. Renders all four modules in two labelled structural
groups, with every clinician-facing string sourced from `src/moduleStatusVocabulary.js` by
identifier, never written inline.

**Duration**: ~2–2.5 engineer-days · **Dependencies**: Phase 2 complete (wave 3) ·
**`integration_owner`**: `phase-owner` (shared with Phase 4 — both write `src/app.js` and
`index.html`) · **Exit gate**: banner renders all 4 statuses; a11y `role="alert"`;
keyboard-navigable.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P3-01 | `index.html` selector markup — persistent rail, two groups | general-purpose (UI engineer¹) | sonnet/adaptive | claude | pending | P2-03 |
| P3-02 | `styles.css` — group + inert-row treatment | general-purpose (UI designer¹ + UI engineer¹) | sonnet/adaptive | claude | pending | P3-01 |
| P3-03 | `src/app.js` — render module rows from frozen manifest map | general-purpose (UI engineer¹) | sonnet/adaptive | claude | pending | P3-01, P2-03 |
| P3-04 | Status banner render | general-purpose | sonnet/adaptive | claude | pending | P3-01, P1-02 |
| P3-05 | `?module=<id>` URL state — read, validate, write | general-purpose | sonnet/adaptive | claude | pending | P3-03, P2-03 |
| P3-06 | Fix `switchTab`'s `history.replaceState` (R-7) | general-purpose | sonnet/adaptive | claude | pending | P3-05 |
| P3-07 | Accessibility — `role="alert"`, keyboard nav | general-purpose | sonnet/adaptive | claude | pending | P3-01, P3-03, P3-04 |
| P3-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | pending | P3-01..P3-07 |

¹ **Agent-name substitution**: `ui-engineer-enhanced`/`ui-designer` are not registered in this
project; dispatched as `general-purpose` with the role descriptor retained.

---

## Orchestration Quick Reference

### Batch 1 (after Phase 2 gates)

```
Task("general-purpose", "P3-01: index.html selector markup — persistent rail, two labelled
structural groups (FR-1/FR-2/R-1). Render all four registered modules from
listModules()/MODULE_IDS in two groups: selectable, and not-selectable-with-reason. Verbatim
panel header from the vocabulary constant. index.html supplies only the static container/header
— rows render in P3-03. See plan §Phase 3, P3-01.")
```

### Batch 2 (after P3-01)

```
Task("general-purpose", "P3-02: styles.css group + inert-row treatment using existing :root
tokens only (FR-11). No green/success/approved visual state anywhere —
integrity-recorded shares the same severity class as the scaffolds. Ineligible rows
distinguishable by text, not colour alone. No clipping at 375px. See plan §Phase 3, P3-02.")

Task("general-purpose", "P3-03: src/app.js — render module rows from src/moduleManifests.js
(FR-3/R-P2). manifest.title, engineLabel verbatim, per-module counts, status chip verbatim;
scaffold rows show limitations() text. No new capability prose invented. R-P2 resilience:
missing optional field renders required-only, no undefined; MODULE_IDS entry absent from
manifest map renders not-selectable with FR-17 reason. See plan §Phase 3, P3-03.")
```

### Batch 3 (after P3-01/P3-03)

```
Task("general-purpose", "P3-04: Status banner render (FR-7/FR-9/FR-13/FR-34). Every string by
identifier from src/moduleStatusVocabulary.js. FR-9 clause on EVERY module including anemia.
Honesty-boundary sentence in the panel, not a tooltip. Staleness disclosure adjacent to the
date. FR-10 subtitle only under unsigned-stub. Zero hash/approval/release wording. See plan
§Phase 3, P3-04.")

Task("general-purpose", "P3-05: ?module=<id> URL state — read/validate/write (FR-20/21/22). Read
on load, validate with isRegisteredModule(); absent → DEFAULT_MODULE_ID. Write via
history.replaceState preserving #tab hash. Unregistered/ineligible → explicit refusal (P4-07
implements the render). No localStorage/sessionStorage/cookie. See plan §Phase 3, P3-05.")
```

### Batch 4 (after P3-05/P3-01/P3-03/P3-04)

```
Task("general-purpose", "P3-06: Fix switchTab's history.replaceState to preserve the query
string (FR-23/R-7). src/app.js:457 currently drops ?module= on tab switch. Rewrite to preserve
window.location.search while updating only the hash. See plan §Phase 3, P3-06.")

Task("general-purpose", "P3-07: Accessibility — role=\"alert\", keyboard nav, programmatic
disabling. Banner carries role=\"alert\"; module list fully keyboard-navigable; ineligible rows
programmatically disabled with reason in the accessible name, not colour-only. No focus traps.
See plan §Phase 3, P3-07.")
```

### Gate (after all tasks complete)

```
Task("task-completion-validator", "P3-GATE: Verify Phase 3 exit gate for spa-module-switcher —
banner renders all 4 statuses; role=\"alert\" present; keyboard-navigable. Reject if any status
string is inline, if CBC Suite renders selectable, if a green/approved state exists, or if
switchTab still drops the query string.")
```

---

## Quality Gates

- [ ] All 4 modules render in two labelled structural groups under the verbatim panel header
- [ ] CBC Suite renders **inert**, superseding both mockups (D-1 / FR-4)
- [ ] Banner renders correctly for all 4 enum statuses; every string referenced by identifier from `src/moduleStatusVocabulary.js`
- [ ] FR-9 approvedBy clause renders on **every** module including `anemia`
- [ ] Honesty-boundary sentence and staleness disclosure are in-panel/adjacent, never tooltips
- [ ] Zero hash / "integrity verified" / approval-badge / green-state surfaces (FR-31, FR-32, FR-11)
- [ ] `?module=` round-trips and survives a tab switch (`src/app.js:457` fixed)
- [ ] No `localStorage`/`sessionStorage`/cookie read or written
- [ ] **FR-37**: `role="alert"`, keyboard-navigable, ineligible rows programmatically disabled with the reason in the accessible name, plus a code comment recording that `disabled` is presentation and not the gate (AC-11)
- [ ] AC-1 screenshots (≥1440px **and** 375px, both groups, all four rows) captured and reviewed **by a person** at **P6-011** — no task here automates capture (D-6 / PRD §11a)

---

## Implementation Notes

### Architectural Decisions

- **`integration_owner: phase-owner`** carries both this phase's banner/selection state and Phase
  4's refusal state, so no one hands off a half-built state machine. The seam task proving the two
  halves don't race is **P4-06**.
- Form factor (OQ-1): persistent sidebar rail (mockup variant A), not an interstitial one-time gate.

### Known Gotchas

- Design mockups (`docs/dev/designs/mockups/spa-module-switcher/`) are exploratory only —
  **non-binding**. Two divergences must NOT be copied: CBC Suite rendered selectable (superseded
  by D-1/FR-4 — it ships inert), and the `unsigned proposal · not clinically reviewed` subtitle
  applied broadly (FR-10 restricts it to `unsigned-stub` only).
- P3-06 exists as its own task specifically because R-7's likelihood is **High** and is trivially
  missed inside a larger UI change — do not fold it into P3-05.
- P3 and Phase 4 both write `src/app.js`/`index.html` — coordinate through the shared
  `integration_owner`, not by racing edits.

### Development Setup

Node ≥ 20. Gate before Phase 4 opens: `task-completion-validator` sign-off on this phase's
`P3-GATE`.

---

## Completion Notes

Fill in when Phase 3 is complete: what was built, key learnings, unexpected challenges,
recommendations for Phase 4 (fail-closed refusal, built on this phase's selection surface).
