---
type: progress
schema_version: 2
doc_type: progress
prd: four-state-questionnaire-ui
feature_slug: four-state-questionnaire-ui
prd_ref: docs/project_plans/PRDs/features/four-state-questionnaire-ui-v1.md
plan_ref: docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1.md
phase_detail_ref: docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1/phase-3-markup-conversion.md
execution_model: batch-parallel
phase: 3
title: "Four-State Questionnaire UI — Phase 3: Markup Conversion"
status: not_started
created: '2026-07-23'
updated: '2026-07-23'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: not-started
total_tasks: 9
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
- gpt-5.6-terra
model_usage:
  primary: sonnet-5[1m]
  external: [ica, codex]
tasks:
- id: P3-00
  description: >
    Phase-entry precondition — OQ-1/OQ-2 resolved by a named human. Not an executable task — a
    gate. Confirm a named human has recorded the final 4-option ordering (OQ-1) and exact wording
    (OQ-2, honoring the honesty caveat: copy must not imply the choice changes inference — PRD §3
    "honesty caveat") before P3-01 begins. Record who decided and where (e.g. an addendum to
    decisions-block.md, or a note in this plan's progress file). OQ-5 (the cross-family review's
    F-2 provenance-honesty finding) is also a precondition for this phase, resolved alongside
    OQ-1/OQ-2 — a named human must choose among the three PRD §12 options (version stamp /
    separate capture envelope / drop the claim) before any P3 markup edit lands.
  status: not_started
  assigned_to: []
  provider: null
  dependencies: []
  estimated_effort: "—"
  priority: critical
  assigned_model: null
  model_effort: null
  target_surfaces: []
  acceptance_criteria: >
    A named human + a recorded decision exist for both OQ-1 and OQ-2 before any markup edit
    starts; the recorded wording is checked against the honesty caveat (no phrase implying "this
    changes the assessment"); OQ-5's resolution is likewise recorded before P3-01 begins.
- id: P3-01
  description: >
    .quad-select CSS component (styles.css). Add a small CSS rule for the new <select> fields
    sized to sit inside the existing .check-grid 3-column layout (styles.css:88-89) without
    breaking its density — a <select> is naturally more compact than the radio-group alternative
    rejected in the SPIKE (leg C §5), so this should be a minimal addition, not a new grid system.
    Verify at the two existing responsive breakpoints (styles.css:207, :214) that a <select> does
    not overflow at 2-column or 1-column collapse.
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P3-00]
  estimated_effort: "0.25 pts"
  priority: medium
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces:
  - styles.css
  acceptance_criteria: >
    New CSS class exists; .check-grid 3/2/1-column behavior is preserved at all three breakpoints
    (source-inspected, not rendered — see Verification Honesty); no other .check-grid/.field-grid
    rule is modified.
- id: P3-02
  description: >
    Hand-edit symptoms (14) + exam (5) fields — batch 1 (19 fields). Convert each of the 19
    symptomNames/examNames checkbox fields (src/app.js:112-115, :131) from
    <label><input name="X" type="checkbox"> Text</label> to a 4-option <select name="X"> using
    the OQ-1/OQ-2-resolved ordering and wording (P3-00), with the not-assessed option's value=""
    (matching P1-01's control-value convention) as the default selected option. Apply uniformly —
    no per-field special-casing (leg C §1 confirms none exists in current markup). Do not touch
    the 8 immediateSafetyNames fields' markup differently from the other 11 symptom fields — the
    safety-exclusion behavior (P2-05) is JS-side only; the markup conversion is identical for all
    14 symptom fields.
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P3-01]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces:
  - index.html
  acceptance_criteria: >
    All 19 fields converted; each <select> has exactly the 4 options from OQ-1/OQ-2 in the
    resolved order; value="" is the default-selected not-assessed option; no field varies the
    option set (FR-2).
- id: P3-03
  description: >
    Hand-edit history (40) fields — batch 2. Convert all 40 historyNames checkbox fields
    (src/app.js:118-129) the same way as P3-02, same option set, same ordering, same default.
    This is the largest single batch (40 of 59 fields) — mechanical and diff-reviewable, one
    commit hunk per field group is acceptable but the diff should show a uniform, repeated
    pattern with no field-specific deviation.
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P3-01]
  estimated_effort: "1.25 pts"
  priority: high
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces:
  - index.html
  acceptance_criteria: >
    All 40 fields converted; identical option structure to P3-02's 19; no field-specific
    deviation in the diff.
- id: P3-04
  description: >
    FR-11 registry↔markup parity test (tests/questionnaire-registry-parity.test.mjs). Author a
    new test asserting, in both directions, that the field-name set extracted from index.html's
    new <select name="..."> markup exactly equals
    symptomNames ∪ historyNames ∪ examNames (src/app.js:111-131) — precedent:
    tests/module-switcher-eligibility.test.mjs:29-34's raw-text-read pattern (readFileSync +
    regex, no DOM parse). Fail if any registry name is missing from markup, or if any markup
    <select> name is absent from the registry (catches a stray/renamed field either direction).
    This closes the latent hand-sync drift risk that exists today between the name arrays and
    hand-authored markup, independent of this feature (leg C §2/§7).
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P3-02, P3-03]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces:
  - tests/questionnaire-registry-parity.test.mjs
  acceptance_criteria: >
    Test passes after P3-02/P3-03 land; a deliberately removed or renamed field-name in either the
    registry or the markup (test-of-the-test) makes it fail in the correct direction.
- id: P3-05
  description: >
    Seam task — markup↔registry↔serialization contract end-to-end (FR-11, integration_owner).
    Owned by the Phase 2 sonnet/claude executor (integration_owner), not this phase's ica
    executor. Extends P3-04's name-set parity with the piece it does not cover: that the literal
    <option value="..."> strings used in the new markup are exactly the four control values
    fieldState.js (P1-01) expects ('', 'unknown', 'true', 'false') — i.e., the seam from markup,
    through the registry, through to what buildInput()/setSimpleField() actually read and write.
    This is a real set-equality/string-equality check over extracted text (like P3-04), not a DOM
    execution — it cannot prove a browser reads the selected option correctly, only that the
    vocabulary used in markup and the vocabulary fieldState.js expects are the same four literal
    strings, so a copy-paste typo (e.g. "unkown") in one of the 59 fields fails loudly instead of
    silently defaulting a control to not-assessed.
  status: not_started
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-02, P3-03, P3-04]
  estimated_effort: "0.25 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tests/questionnaire-registry-parity.test.mjs
  acceptance_criteria: >
    Test (or an addition to P3-04's file) passes; a seeded option-value typo in one field's
    markup makes it fail and names the specific field; the check is explicitly labeled
    text-extraction-based, not DOM-executed.
- id: P3-06
  description: >
    Human task — visual layout check recorded. Per §8 Verification Honesty (Cannot Be Proven —
    rendering/layout): a named person visually confirms the 59 new <select> fields render
    correctly inside the .check-grid 3-column layout at representative viewport widths (desktop,
    the styles.css:207 2-column breakpoint, the :214 1-column breakpoint), with no overflow,
    wrapping regression, or visual density break versus the prior checkbox layout. Record the
    name and date in the phase progress note. This is the P3 slice of the PRD §11
    Human-verification acceptance checklist (item 1 of 4) — the remaining three (keyboard
    operation, safety-reviewed runtime behavior, form.reset()) are Phase 4's, since they need
    Phase 2's rewritten JS live alongside Phase 3's markup.
  status: not_started
  assigned_to: []
  provider: null
  dependencies: [P3-02, P3-03, P3-01]
  estimated_effort: "—"
  priority: high
  assigned_model: null
  model_effort: null
  target_surfaces: []
  acceptance_criteria: >
    A named person + date recorded confirming the visual check at all three breakpoints;
    explicitly not claimed as an automated result.
- id: P3-GATE
  description: >
    task-completion-validator gate. Verify the Phase 3 exit gate (decisions block §6): FR-11
    parity test green (P3-04); the seam test (P3-05) green; the human visual pass recorded
    (P3-06). Reject if any field's option set deviates from the OQ-1/OQ-2-resolved standard, if
    the parity test was written to pass by construction rather than by genuinely deriving both
    sides from source, or if P3-06 is missing a named signer.
  status: not_started
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P3-01, P3-02, P3-03, P3-04, P3-05, P3-06]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces: []
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: P3-REVIEW
  description: >
    Cross-family adversarial diff review. codex/gpt-5.6-terra reviews the P3 diff read-only for
    the 59-field mechanical-edit failure mode this phase is most exposed to: a copy-paste
    field-name/option-value mismatch that P3-04/P3-05's tests might not catch if the test itself
    was authored against the same wrong assumption as the markup. Spot-checks a sample of fields
    against the registry directly, independent of the new tests' own logic.
  status: not_started
  assigned_to: [gpt-5.6-terra]
  provider: codex
  dependencies: [P3-02, P3-03, P3-04, P3-05]
  estimated_effort: "—"
  priority: high
  assigned_model: gpt-5.6-terra
  model_effort: medium
  target_surfaces: []
  acceptance_criteria: "Review recorded; any finding either fixed in-phase or logged for P4 pickup."
parallelization:
  batch_1: [P3-00]
  batch_2: [P3-01]
  batch_3: [P3-02, P3-03]
  batch_4: [P3-04, P3-06]
  batch_5: [P3-05]
  batch_6: [P3-GATE, P3-REVIEW]
  critical_path: [P3-00, P3-01, P3-02, P3-03, P3-04, P3-05, P3-GATE]
  estimated_total_time: "not stated in phase detail file — 3 pts total"
blockers:
- id: BLOCKER-P3-00
  description: "P3-01..P3-06 cannot begin until OQ-1 (option ordering), OQ-2 (wording), and OQ-5 (provenance-honesty decision) are resolved by a named human — no agent task in this plan resolves them."
  status: open
success_criteria:
- id: SC-1
  description: "OQ-1/OQ-2 resolved by a named human before any markup edit (P3-00)"
  status: pending
- id: SC-2
  description: "All 59 booleanMap fields (14 symptoms + 40 history + 5 exam) converted to the 4-option <select>"
  status: pending
- id: SC-3
  description: "Every field has the identical 4-option set, identical default (value=\"\", not-assessed)"
  status: pending
- id: SC-4
  description: ".check-grid 3/2/1-column density preserved at all three breakpoints (source-inspected)"
  status: pending
- id: SC-5
  description: "FR-11 registry↔markup parity test green, both directions"
  status: pending
- id: SC-6
  description: "Markup↔registry↔serialization seam test (P3-05) green — option-value vocabulary matches fieldState.js exactly"
  status: pending
- id: SC-7
  description: "Human visual pass recorded with a named signer and date"
  status: pending
- id: SC-8
  description: "Gate criterion: npm run check shows exactly the 8 recorded baseline failures and no others"
  status: pending
files_modified:
- styles.css
- index.html
- tests/questionnaire-registry-parity.test.mjs
notes: >
  integration_owner for P3-05 is the Phase 2 executor (sonnet, claude, primary), not this phase's
  sonnet-5[1m]/ica executor — P2 and P3 share ownership of src/app.js/index.html's
  markup↔registry↔serialization contract. OQ-1/OQ-2/OQ-5 are a blocking phase-entry precondition,
  not a task in this phase's table — clinical-usability calls reserved for a human, not an agent's
  invented default. Why hand-edit, not a generator (decisions block §4): this repo's SPA is
  deliberately zero-dependency/no-build-step; scripts/build-static.mjs only copies and stamps,
  never generates markup. Every prompt-embedded shell command dispatched to an executor must use
  the absolute worktree path
  (/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui).
---

# four-state-questionnaire-ui — Phase 3: Markup Conversion

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/four-state-questionnaire-ui/phase-3-progress.md -t P3-01 -s completed
```

---

## Objective

Hand-edit all 59 booleanMap fields in `index.html` from two-state checkboxes to 4-option
`<select>` controls (present/absent/unknown/not-assessed), add the supporting CSS, and gate the
result with a registry↔markup parity test plus the markup↔registry↔serialization seam test. Blocked
at entry on a named human resolving OQ-1 (ordering), OQ-2 (wording), and OQ-5 (provenance-honesty
decision) — no agent task in this plan resolves them.

**Dependencies**: Phase 2 complete, **and** OQ-1/OQ-2/OQ-5 resolved by a named human (P3-00) ·
**Entry criteria**: `src/app.js`'s rewired read/write path (Phase 2) exists and is tested; OQ-1,
OQ-2, and OQ-5 have a recorded human decision ·
**Exit gate** (decisions block §6): FR-11 parity test green (P3-04); the seam test (P3-05) green;
the human visual pass recorded (P3-06).

**Why hand-edit, not a generator** (decisions block §4): this repo's SPA is deliberately
zero-dependency/no-build-step; `scripts/build-static.mjs` only copies and stamps, never generates
markup. The FR-11 parity test (P3-04) is the accepted mitigation for the copy-paste risk 59
hand-edits carry.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P3-00 | **Phase-entry precondition** — OQ-1/OQ-2/OQ-5 resolved by a named human | — (human) | — | — | not-started | none |
| P3-01 | `.quad-select` CSS component | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | P3-00 |
| P3-02 | Hand-edit symptoms (14) + exam (5) — batch 1 (19 fields) | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | P3-01 |
| P3-03 | Hand-edit history (40) fields — batch 2 | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | P3-01 |
| P3-04 | FR-11 registry↔markup parity test | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | P3-02, P3-03 |
| P3-05 | **Seam task** — markup↔registry↔serialization (integration_owner: P2 executor) | general-purpose | sonnet/adaptive | claude | not-started | P3-02, P3-03, P3-04 |
| P3-06 | **Human task** — visual layout check recorded | — (human) | — | — | not-started | P3-02, P3-03, P3-01 |
| P3-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | not-started | P3-01..P3-06 |
| P3-REVIEW | Cross-family adversarial diff review | gpt-5.6-terra | gpt-5.6-terra/medium | codex | not-started | P3-02, P3-03, P3-04, P3-05 |

---

## Orchestration Quick Reference

**WORKING ROOT (absolute; do NOT use the parent checkout):**
`/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui`

### Batch 0 (human gate — before any Task() call in this phase)

P3-00 is not dispatched via `Task()`. Confirm a named human has recorded OQ-1 (4-option ordering),
OQ-2 (exact wording, honoring the honesty caveat), and OQ-5 (which of the three PRD §12 provenance
options was chosen) — e.g. as an addendum to `.claude/worknotes/four-state-questionnaire-ui/decisions-block.md`
— before proceeding to Batch 1.

### Batch 1 (after P3-00)

```
Task("general-purpose", "WORKING ROOT (absolute — do NOT use the parent checkout):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P3-01: Add a .quad-select CSS class to styles.css sized to sit inside the existing .check-grid
3-column layout (:88-89) without breaking its density. Verify at the styles.css:207 (2-column) and
:214 (1-column) breakpoints that a <select> does not overflow. Minimal addition only — no new grid
system, no other .check-grid/.field-grid rule modified. See plan §Phase 3, P3-01
(phase-3-markup-conversion.md).")
```

### Batch 2 (after P3-01)

```
Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P3-02: Convert the 19 symptomNames/examNames checkbox fields (src/app.js:112-115, :131) in
index.html to 4-option <select name=\"X\"> controls using the OQ-1/OQ-2-resolved ordering/wording
recorded at P3-00, value=\"\" as the default not-assessed option. Apply uniformly — no per-field
special-casing, including the 8 immediateSafetyNames fields (markup is identical; the safety
exclusion is JS-side only). See plan §Phase 3, P3-02.")

Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P3-03: Convert all 40 historyNames checkbox fields (src/app.js:118-129) in index.html the same
way as P3-02 — identical option set, ordering, and default. Largest single batch; diff must show
a uniform, repeated pattern with no field-specific deviation. See plan §Phase 3, P3-03.")
```

### Batch 3 (after P3-02, P3-03)

```
Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P3-04: Author tests/questionnaire-registry-parity.test.mjs asserting, in both directions, that
the <select name=\"...\"> field-name set extracted from index.html exactly equals
symptomNames ∪ historyNames ∪ examNames (src/app.js:111-131) — raw-text-read pattern
(readFileSync + regex, no DOM parse), precedent tests/module-switcher-eligibility.test.mjs:29-34.
Fail in the correct direction if a name is missing from either side. See plan §Phase 3, P3-04.")
```

### Batch 4 (after P3-02, P3-03, P3-04)

```
Task("general-purpose", "WORKING ROOT (absolute — this task is integration_owner: the Phase 2
executor, sonnet/claude primary, not the ica delegate used for P3-01..P3-04):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P3-05: Extend P3-04's parity test (or add a sibling) asserting the literal <option value=\"...\">
strings in the new markup are exactly the four control values fieldState.js expects ('', 'unknown',
'true', 'false'). Text-extraction-based, not DOM-executed. A seeded option-value typo (e.g.
'unkown') in one field must fail and name that field. See plan §Phase 3, P3-05.")
```

### Batch 5 (human, after P3-01, P3-02, P3-03)

P3-06 is a human task, not dispatched via `Task()`. A named person visually confirms the 59 new
`<select>` fields at desktop, the `styles.css:207` 2-column breakpoint, and the `:214` 1-column
breakpoint, with no overflow/wrapping/density regression. Record the name and date in this
progress file's Completion Notes.

### Batch 6 (after P3-01..P3-06)

```
Task("task-completion-validator", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P3-GATE: Verify Phase 3 exit gate for four-state-questionnaire-ui — FR-11 parity test green
(P3-04), seam test green (P3-05), human visual pass recorded (P3-06). Reject if any field's
option set deviates from the OQ-1/OQ-2-resolved standard, if the parity test was written to pass
by construction, or if P3-06 lacks a named signer.")

Task("gpt-5.6-terra", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P3-REVIEW: Cross-family adversarial diff review (medium effort) of the P3 diff, read-only. Spot-
check a sample of the 59 converted fields directly against the registry, independent of P3-04/
P3-05's own test logic, for a copy-paste field-name/option-value mismatch the tests might share
the same wrong assumption with.")
```

---

## Quality Gates

- [ ] OQ-1/OQ-2 resolved by a named human before any markup edit (P3-00)
- [ ] All 59 booleanMap fields (14 symptoms + 40 history + 5 exam) converted to the 4-option `<select>`
- [ ] Every field has the identical 4-option set, identical default (`value=""`, not-assessed)
- [ ] `.check-grid` 3/2/1-column density preserved at all three breakpoints (source-inspected)
- [ ] FR-11 registry↔markup parity test green, both directions
- [ ] Markup↔registry↔serialization seam test (P3-05) green — option-value vocabulary matches `fieldState.js` exactly
- [ ] Human visual pass recorded with a named signer and date
- [ ] **Gate criterion**: `npm run check` (= `npm run build && npm test && npm run validate && npm run coverage:rules && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke`) shows **exactly** the 8 recorded baseline failures (test IDs 336, 789, 814, 2132, 2133, 2138, 2363, 2364) and **no others**.

**⚠ Build-before-test trap.** Bare `npm test` in a fresh worktree falsely reports **10** failures
(two extra `dist/`-dependent artifacts). Always `npm run build && npm test`, exactly as `npm run
check` does.

---

## Implementation Notes

### Architectural Decisions

- `<select>` is naturally more compact than the radio-group alternative rejected in the SPIKE (leg
  C §5) — the CSS addition should be minimal, not a new grid system.
- No generator is introduced (decisions block §4): 59 hand-edits, mitigated by the FR-11 parity
  test, keep the clinical-review surface in human-readable `index.html`.

### Known Gotchas

- OQ-1/OQ-2/OQ-5 are clinical-usability/honesty calls reserved for a named human — **no agent in
  this plan may invent a default** for option ordering, wording, or the provenance-honesty
  disposition.
- The 8 `immediateSafetyNames` fields get **identical** markup to the other 11 symptom fields —
  the safety-exclusion behavior (P2-05) is JS-side only; do not special-case their markup.
- P3-05's seam test is owned by the Phase 2 (`sonnet`/`claude`) executor, not this phase's `ica`
  delegate — P2 and P3 share ownership of the markup↔registry↔serialization contract.

### Development Setup

Node ≥ 20. Gate before Phase 4 opens: `task-completion-validator` sign-off on `P3-GATE`.

---

## Completion Notes

Fill in when Phase 3 is complete: the P3-00 human decision record (who/where), the P3-06 named
visual-check signer and date, and any finding from `P3-REVIEW` fixed in-phase or logged for
Phase 4 pickup.
