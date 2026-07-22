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
phase: 5
title: "SPA Module Switcher — Phase 5: Module-Scoped Tab Degradation, Nav Counts & Page Copy"
status: pending
created: '2026-07-22'
updated: '2026-07-22'
started: null
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
contributors:
- task-completion-validator
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P5-01
  description: >
    #algorithm tab degrades explicitly for non-anemia modules (FR-25 / R-8). src/algorithmExplorer.js
    is anemia-shaped end to end (anemiaWalkthrough :290-303; facts.cbc.hb/facts.retic.* :257-366;
    fetch('./data/algorithm-explainers.json') :583) and will throw on stub facts. Hide or disable
    the #algorithm tab for non-anemia modules with an explicit "not available for this module"
    state sourced from the vocabulary constant. Do NOT generalize the explorer and do not touch its
    internals.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  - src/app.js
  acceptance_criteria: >
    Under a non-anemia module the #algorithm tab is hidden or disabled with explicit copy, and the
    explorer never executes; git diff src/algorithmExplorer.js shows no change to
    anemiaWalkthrough or any facts.* accessor; no throw reaches the console.
- id: P5-02
  description: >
    #evidence tab degrades for modules without a registered evidence loader (FR-26 / OQ-2). Every
    module has an evidence.json (cbc_suite_v1 20, growth_suite_v1 11, kidney_suite_v1 12 sources),
    but src/evidence/registry.js:39-50 registers loaders for anemia and cbc_suite_v1 only. Degrade
    the #evidence tab to an explicit "no evidence view for this module" state — NOT an empty
    source list, which would read as "this module cites nothing". A per-module evidence view is
    Deferred Item DF-SMS-02.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  - src/app.js
  acceptance_criteria: >
    Under growth_suite_v1/kidney_suite_v1 the tab shows the explicit unavailable state; the source
    list is never rendered empty-but-present; anemia's evidence view is byte-unchanged in behaviour.
- id: P5-03
  description: >
    #rules explicit empty state when rules.length === 0 (FR-27 / OQ-3). The #rules tab is already
    module-generic — it reads module-loaded rules/candidates. It needs only the empty-state
    wording, resolved in the parent plan and living in src/moduleStatusVocabulary.js (P1-02):
    "This module contains no rules. No assessment can be produced from it." Do not author
    alternative copy: "not yet loaded" implies a loading failure and "not yet available" implies a
    pipeline toward release that gates-registry.md:130-132 makes schema-impossible.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01, P1-02]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    A module with zero rules renders the exact vocabulary string, not a blank panel; the string is
    referenced by identifier, not inlined; no alternative phrasing appears anywhere.
- id: P5-04
  description: >
    examples picker emptied/disabled for non-anemia modules (FR-28). examples/ holds 6 anemia
    cases; the <option> list is hardcoded in index.html:101-108, loaded at src/app.js:525 and used
    by the explorer at :616. For non-anemia modules the picker must be emptied and disabled, never
    left offering anemia cases under another module's label. Per-module examples/ authoring is an
    explicit non-goal (PRD §7).
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  - src/app.js
  acceptance_criteria: >
    Under a non-anemia module the picker has zero options and is disabled; selecting a non-anemia
    module after loading an anemia example clears the loaded example rather than leaving it
    applied; no anemia case label is visible under another module.
- id: P5-05
  description: >
    Nav counts module-derived; neutralize the static 91/26 fallback (FR-29). #nav-rule-count /
    #nav-pattern-count are already set dynamically at src/app.js:563-564; only the hardcoded 91/26
    HTML fallback at index.html:66 lies — it renders anemia's counts before any module is loaded
    and under every module. Neutralize the static fallback (empty or a neutral placeholder that
    cannot be read as a count) and confirm the dynamic values are the loaded module's own.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01]
  estimated_effort: "0.5 pts"
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  acceptance_criteria: >
    index.html:66 no longer contains 91 or 26; counts under each module equal that module's own
    rules/candidates lengths; before load, no numeral is displayed that could be mistaken for a
    count.
- id: P5-06
  description: >
    Module-derived page copy (FR-30 / SQ-3 F10, F11). Derive module-identifying copy from
    manifest.title: document.title, the <h1>Evaluate pediatric anemia</h1>, brand and footer copy —
    index.html (:6,11,19,24,76,416,435,577). document.title must not carry anemia's
    KNOWLEDGE_BASE_VERSION under another module (F11). meta.status (src/engine.js:47) is a
    hardcoded literal and does NOT say unsigned-stub — do not repurpose it for the status chip
    (P3-04 owns that). R-P2 handling: if manifest.title is missing (schema-impossible; defence in
    depth) the surface renders the moduleId verbatim, never a generic "Assessment".
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01, P3-03]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  acceptance_criteria: >
    All 8 named index.html sites are module-derived; document.title under a non-anemia module
    contains neither "anemia" nor anemia's KNOWLEDGE_BASE_VERSION; a synthetic manifest with no
    title renders the moduleId, not a generic label; meta.status is unchanged and is not used as
    the status chip.
- id: P5-GATE
  description: >
    task-completion-validator gate. Verify the Phase 5 exit gate: no tab renders anemia data under
    a non-anemia module label. Walk #evidence, #rules, #algorithm and the examples picker under
    each of the three scaffolds. Reject if src/algorithmExplorer.js was generalized rather than
    degraded (R-8), if the examples picker still offers anemia cases, or if index.html:66 still
    carries 91/26.
  status: pending
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P5-01, P5-02, P5-03, P5-04, P5-05, P5-06]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
parallelization:
  batch_1: [P5-01, P5-02, P5-03, P5-04, P5-05]
  batch_2: [P5-06]
  batch_3: [P5-GATE]
  critical_path: [P5-06, P5-GATE]
  estimated_total_time: "~1.5 engineer-days"
blockers:
- id: BLOCKER-PHASE-DEP
  title: "Phase 5 cannot open until Phase 4 exit gates (P4-GATE, P4-KAREN) both pass"
  severity: medium
  blocking: [P5-01, P5-02, P5-03, P5-04, P5-05, P5-06]
  resolution: >
    Wait for .claude/progress/spa-module-switcher/phase-4-progress.md P4-GATE and P4-KAREN to both
    complete. Also depends on Phase 2 (loading seam), already satisfied by that phase's own gates.
  created: '2026-07-22'
success_criteria:
- id: SC-1
  description: "#algorithm hidden/disabled with explicit copy for non-anemia modules; explorer never executes; no generalization (R-8)"
  status: pending
- id: SC-2
  description: "#evidence shows an explicit unavailable state for growth/kidney — never an empty-but-present source list"
  status: pending
- id: SC-3
  description: "#rules renders the exact OQ-3 vocabulary string for zero-rule modules"
  status: pending
- id: SC-4
  description: "Examples picker emptied and disabled for non-anemia modules; no anemia case visible under another label"
  status: pending
- id: SC-5
  description: "Nav counts module-derived; index.html:66's static 91/26 neutralized"
  status: pending
- id: SC-6
  description: "Page copy module-derived at all 8 index.html sites; document.title free of anemia's version under other modules"
  status: pending
- id: SC-7
  description: "Missing manifest.title renders the moduleId, never a generic 'Assessment'"
  status: pending
- id: SC-8
  description: "Screenshots of #algorithm, #evidence and #rules under a non-anemia module at ≥1440px (AC-6), plus header/footer (AC-7)"
  status: pending
files_modified:
- index.html
- src/app.js
notes: >
  Wave 5 — depends on Phase 2 (loading seam, already satisfied) AND Phase 4 (settled state
  machine); its own wave because it shares src/app.js/index.html serialization barriers with
  P3/P4 but runs after P4 rather than in parallel. **Hard boundary (R-8)**: this phase degrades; it
  does NOT generalize. Any change to anemiaWalkthrough or the facts.anemia.*/facts.cbc.*/
  facts.retic.* accessors is out of scope and is held as Deferred Item DF-SMS-03. Per the critical
  path (P0→P1→P2→P3→P4→P6→P7), P5 carries float (4 pts) against the P4→P6 critical path and merges
  before Phase 6 opens.
---

# spa-module-switcher — Phase 5: Module-Scoped Tab Degradation, Nav Counts & Page Copy

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-5-progress.md -t P5-01 -s completed
```

---

## Objective

Degrade every remaining anemia-shaped surface (`#algorithm`, `#evidence`, `#rules` empty state,
examples picker, nav counts, page copy) for non-anemia modules — explicitly, never silently, and
without generalizing `src/algorithmExplorer.js` (an explicit non-goal, R-8).

**Duration**: ~1.5 engineer-days · **Dependencies**: Phase 2 (loading seam) and Phase 4 (settled
state machine); own wave — shares `src/app.js`/`index.html` serialization barriers with P3/P4 ·
**Exit gate**: no tab renders anemia data under a non-anemia module label.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P5-01 | `#algorithm` tab degrades explicitly | general-purpose (frontend engineer¹) | sonnet/adaptive | claude | pending | P4-01 |
| P5-02 | `#evidence` tab degrades for modules without a loader | general-purpose | sonnet/adaptive | claude | pending | P4-01 |
| P5-03 | `#rules` explicit empty state (`rules.length === 0`) | general-purpose | sonnet/adaptive | claude | pending | P4-01, P1-02 |
| P5-04 | `examples` picker emptied/disabled | general-purpose | sonnet/adaptive | claude | pending | P4-01 |
| P5-05 | Nav counts module-derived; neutralize static `91`/`26` | general-purpose | sonnet/adaptive | claude | pending | P4-01 |
| P5-06 | Module-derived page copy | general-purpose | sonnet/adaptive | claude | pending | P4-01, P3-03 |
| P5-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | pending | P5-01..P5-06 |

¹ **Agent-name substitution**: `frontend-developer` is not registered in this project; dispatched
as `general-purpose` with the role descriptor retained.

---

## Orchestration Quick Reference

### Batch 1 (after Phase 4 gates)

```
Task("general-purpose", "P5-01: #algorithm tab degrades explicitly for non-anemia modules
(FR-25/R-8). src/algorithmExplorer.js is anemia-shaped and will throw on stub facts. Hide/disable
the tab with explicit 'not available for this module' copy from the vocabulary constant. Do NOT
touch anemiaWalkthrough or facts.* accessors. See plan §Phase 5, P5-01.")

Task("general-purpose", "P5-02: #evidence tab degrades for modules without a registered loader
(FR-26/OQ-2). growth/kidney have evidence.json but no loader in
src/evidence/registry.js:39-50. Show explicit 'no evidence view for this module' — never an
empty-but-present source list. See plan §Phase 5, P5-02.")

Task("general-purpose", "P5-03: #rules explicit empty state (FR-27/OQ-3). Render the exact
vocabulary string 'This module contains no rules. No assessment can be produced from it.' by
identifier, no alternative phrasing. See plan §Phase 5, P5-03.")

Task("general-purpose", "P5-04: examples picker emptied/disabled for non-anemia modules
(FR-28). Zero options, disabled; clear any loaded anemia example on module switch. See plan
§Phase 5, P5-04.")

Task("general-purpose", "P5-05: Nav counts module-derived; neutralize static 91/26 fallback
(FR-29). index.html:66's hardcoded fallback must go; counts already dynamic at :563-564. See
plan §Phase 5, P5-05.")
```

### Batch 2 (after P5-01..P5-05, and P3-03)

```
Task("general-purpose", "P5-06: Module-derived page copy (FR-30/SQ-3 F10/F11). Derive
document.title, <h1>, brand and footer copy from manifest.title at all 8 named index.html
sites. document.title must not carry anemia's KNOWLEDGE_BASE_VERSION under another module.
Missing manifest.title renders the moduleId verbatim, never a generic 'Assessment'. Do not
repurpose meta.status for the status chip. See plan §Phase 5, P5-06.")
```

### Gate (after all tasks complete)

```
Task("task-completion-validator", "P5-GATE: Verify Phase 5 exit gate for spa-module-switcher —
no tab renders anemia data under a non-anemia module label. Walk #evidence, #rules, #algorithm
and the examples picker under each scaffold. Reject if algorithmExplorer.js was generalized
rather than degraded, if the examples picker still offers anemia cases, or if index.html:66
still carries 91/26.")
```

---

## Quality Gates

- [ ] `#algorithm` hidden/disabled with explicit copy for non-anemia modules; explorer never executes; **no generalization** (R-8)
- [ ] `#evidence` shows an explicit unavailable state for growth/kidney — never an empty-but-present source list
- [ ] `#rules` renders the exact OQ-3 vocabulary string for zero-rule modules
- [ ] Examples picker emptied and disabled for non-anemia modules; no anemia case visible under another label
- [ ] Nav counts module-derived; `index.html:66`'s static `91`/`26` neutralized
- [ ] Page copy module-derived at all 8 `index.html` sites; `document.title` free of anemia's version under other modules
- [ ] Missing `manifest.title` renders the moduleId, never a generic "Assessment"
- [ ] Screenshots of `#algorithm`, `#evidence` and `#rules` under a non-anemia module at ≥1440px (AC-6), plus header/footer (AC-7)

---

## Implementation Notes

### Architectural Decisions

- Every task in this phase **degrades**; none generalizes. `src/algorithmExplorer.js`'s internals
  (`anemiaWalkthrough`, `facts.*` accessors) are explicitly out of scope (R-8) — held as Deferred
  Item **DF-SMS-03**.
- `src/evidence/registry.js` growth/kidney loader gap is degraded here, not fixed — a per-module
  evidence view is Deferred Item **DF-SMS-02**.

### Known Gotchas

- `meta.status` (`src/engine.js:47`) is a hardcoded literal `'Research prototype—not clinically
  validated'` and does **not** say `unsigned-stub` — do not repurpose it for the status chip; that
  is Phase 3's (`P3-04`) job.
- `git diff src/algorithmExplorer.js` must show **zero** changes — P5-01 touches only the tab
  visibility/copy in `index.html`/`src/app.js`, never the explorer file itself.
- P5-06 is the largest task in this phase (1.0 pts) because it touches 8 distinct `index.html`
  sites — verify each individually, not just the `<h1>`.

### Development Setup

Node ≥ 20. Gate before Phase 6 opens (jointly with Phase 4): `task-completion-validator`
sign-off on this phase's `P5-GATE`.

---

## Completion Notes

Fill in when Phase 5 is complete: what was built, key learnings, unexpected challenges,
recommendations for Phase 6 (gates & test harness, the verification phase).
