---
type: progress
schema_version: 2
doc_type: progress
prd: four-state-questionnaire-ui
feature_slug: four-state-questionnaire-ui
prd_ref: docs/project_plans/PRDs/features/four-state-questionnaire-ui-v1.md
plan_ref: docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1.md
phase_detail_ref: docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1/phase-0-1-baseline-and-pure-module.md
execution_model: batch-parallel
phase: 1
title: "Four-State Questionnaire UI — Phase 1: Pure Logic Extraction"
status: not_started
created: '2026-07-23'
updated: '2026-07-23'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: not-started
total_tasks: 5
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
- id: P1-01
  description: >
    src/facts/fieldState.js — pure four-state ↔ three-wire-value mapping (FR-7). Create
    src/facts/fieldState.js mirroring the existing pattern in src/facts/tristate.js:1-38 (a small,
    zero-DOM, zero-import module of pure functions with JSDoc). Export a pair of pure functions
    with no document/form/RadioNodeList reference anywhere in the file: (1) a function mapping a
    <select> control's raw string value to what should be serialized onto the wire — the four
    control values are '' (the default, unselected/"not-assessed" option), 'unknown', 'true',
    'false'; the wire mapping is '' → undefined (meaning: omit the key from
    symptoms/history/exam — FR-4), 'unknown' → 'unknown', 'true' → 'true', 'false' → 'false'; (2)
    the inverse function mapping a stored/serialized wire value (which may be undefined/absent, a
    bare boolean, or one of the three tri-state strings — the same input shape toTri() already
    accepts, src/facts/tristate.js:6-11) back to the control value that should be selected on
    repopulation — undefined/absent → '', 'unknown'/false-collapsing-cases handled distinctly
    (this is the round-trip fix, FR-5): 'false'/false → 'false', 'unknown' → 'unknown',
    'true'/true → 'true', anything unrecognized → '' (fail-safe: an unrecognized value must never
    silently resolve to 'true'/Present). Naming is illustrative in FR-7
    (stateFromControlValue/controlValueFromState) — implementer may choose exact names, but the
    four-way mapping and the fail-safe-to-not-assessed default on unrecognized input are binding.
    Do not reference toTri() from tristate.js internally if it would collapse 'false'/'unknown' —
    the whole point of this module is to preserve the distinction toTri() doesn't need to (it's an
    engine-facing helper); a fresh, independent mapping is required, not a wrapper around toTri().
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P0-GATE]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces:
  - src/facts/fieldState.js
  acceptance_criteria: >
    File exists at src/facts/fieldState.js; zero references to document/form/RadioNodeList/window
    anywhere in the file (grep-verified); the four control-value ↔ wire-value pairs round-trip
    correctly in both directions; an unrecognized control value or wire value resolves to the
    not-assessed/omit case, never to Present; the module has no side effects on import.
- id: P1-02
  description: >
    tests/field-state.test.mjs — direct node --test coverage. Author a new test file importing
    src/facts/fieldState.js directly (mirroring tests/tristate-operators.test.mjs's pattern of
    importing src/facts/tristate.js directly, no shim, no DOM). Cover: all 4 control-value →
    wire-value mappings; all round-trip cases for the inverse function including undefined, a bare
    true/false boolean, and each of the 3 tri-state strings; the fail-safe behavior for an
    unrecognized input on both functions; and an explicit case proving 'false' and 'unknown' map
    to two different control values on repopulation (this is the round-trip defect fix, AC-3 — the
    test that would have caught the original setSimpleField:1466 bug).
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P1-01]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces:
  - tests/field-state.test.mjs
  acceptance_criteria: >
    Test passes; executes the real module functions (no DOM shim, no mock); explicitly asserts
    'false' ≠ 'unknown' on the control-value side, closing the historical collapse.
- id: P1-03
  description: >
    isPresent/isAssessed predicates in fieldState.js (F-1, FR-16). Per cross-family review F-1
    (.claude/findings/four-state-questionnaire-ui-cross-family-review.md): add two pure, zero-DOM
    predicate exports to src/facts/fieldState.js alongside P1-01's mapping functions —
    isPresent(wireValue) (true iff the stored/serialized value resolves to 'true') and
    isAssessed(wireValue) (true iff the value is anything other than absent/undefined — i.e., the
    field was actively touched, whether Present, Absent, or explicitly Unknown). These give P2's
    rewired src/app.js consumers (anyChecked/updateWorkflowState/updateCaseUi) a booleanMap-aware
    replacement for checked()'s plain-boolean read, which returns false for every <select>-backed
    field once converted. Naming is illustrative; the two-predicate coverage (present vs.
    assessed-at-all) and zero-DOM constraint are binding. Extend tests/field-state.test.mjs (or add
    a sibling file) with direct node --test coverage of both predicates over all four wire-value
    shapes (undefined, bare true/false, each of the 3 tri-state strings).
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P1-01]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces:
  - src/facts/fieldState.js
  - tests/field-state.test.mjs
  acceptance_criteria: >
    Both predicates exist in src/facts/fieldState.js, zero-DOM (grep-verified, same as P1-01);
    direct node --test coverage exists and passes for both predicates across all input shapes;
    isPresent/isAssessed are independently testable pure functions, not inlined into any
    src/app.js call site (that delegation is P2-07's job).
- id: P1-GATE
  description: >
    task-completion-validator gate. Verify the Phase 1 exit gate: src/facts/fieldState.js exists,
    is zero-DOM, and is directly tested by tests/field-state.test.mjs (including the P1-03
    predicates); src/app.js has not been touched in this phase (P2's job, not P1's). Reject if any
    DOM reference exists in the new module, if the test uses a shim instead of a direct import, if
    isPresent/isAssessed are missing or untested, or if src/app.js shows any diff.
  status: not_started
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P1-01, P1-02, P1-03]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces: []
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: P1-REVIEW
  description: >
    Cross-family adversarial diff review. codex/gpt-5.6-terra reviews the P1 diff read-only,
    specifically checking the fail-safe-to-not-assessed behavior on unrecognized input in both
    directions (a gap here would let a malformed payload silently read as Present), confirming
    zero DOM coupling, and confirming isPresent/isAssessed (P1-03) correctly distinguish all four
    wire-value cases.
  status: not_started
  assigned_to: [gpt-5.6-terra]
  provider: codex
  dependencies: [P1-01, P1-03]
  estimated_effort: "—"
  priority: high
  assigned_model: gpt-5.6-terra
  model_effort: low
  target_surfaces: []
  acceptance_criteria: "Review recorded; any finding either fixed in-phase or logged for P2 pickup."
parallelization:
  batch_1: [P1-01]
  batch_2: [P1-02, P1-03]
  batch_3: [P1-GATE, P1-REVIEW]
  critical_path: [P1-01, P1-02, P1-GATE]
  estimated_total_time: "~0.25–0.5 engineer-day"
blockers: []
success_criteria:
- id: SC-1
  description: "src/facts/fieldState.js exists, zero-DOM (grep-verified: no document/form/RadioNodeList/window)"
  status: pending
- id: SC-2
  description: "tests/field-state.test.mjs imports the module directly and passes"
  status: pending
- id: SC-3
  description: "Round-trip test explicitly proves 'false' and 'unknown' resolve to distinct control values (AC-3 precondition)"
  status: pending
- id: SC-4
  description: "Unrecognized input on either function fails safe to not-assessed/omit, never to Present"
  status: pending
- id: SC-5
  description: "isPresent/isAssessed predicates exist (P1-03, F-1) and are directly tested across all four wire-value shapes"
  status: pending
- id: SC-6
  description: "src/app.js unmodified in this phase (P2's scope, not P1's)"
  status: pending
- id: SC-7
  description: "Gate criterion: npm run check shows exactly the 8 recorded baseline failures and no others"
  status: pending
files_modified:
- src/facts/fieldState.js
- tests/field-state.test.mjs
notes: >
  Dependencies: Phase 0 complete (the guard must exist first; P1 does not itself change behavior,
  but ordering per decisions block §6 is strict: P0 before P1). P1's pure module (including
  P1-03's isPresent/isAssessed predicates) must exist and be tested before P2 rewires src/app.js
  to call it — P2's rewritten call sites all delegate their state-mapping decision to this module
  (FR-8, FR-16) rather than inlining it, mirroring how setSimpleField:1466 already delegates to
  toTri() today. Writing P2 first would repeat the mistake the tristate.js extraction was created
  specifically to avoid (SPIKE-010 leg B §3). Every prompt-embedded shell command dispatched to an
  executor must use the absolute worktree path
  (/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui).
---

# four-state-questionnaire-ui — Phase 1: Pure Logic Extraction

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/four-state-questionnaire-ui/phase-1-progress.md -t P1-01 -s completed
```

---

## Objective

Extract a DOM-free `src/facts/fieldState.js` module holding the pure four-clinician-state ↔
three-wire-value mapping (mirroring `src/facts/tristate.js`), plus the `isPresent`/`isAssessed`
predicates F-1 requires for P2's workflow/depth/safety-count consumers. No behavior change yet —
`src/app.js` is not touched until Phase 2.

**Duration**: ~0.25–0.5 engineer-day · **Dependencies**: Phase 0 complete (`P0-GATE` passed) ·
**Entry criteria**: `tests/tristate-neutrality-guard.test.mjs` exists and passes (Phase 0 exit
gate) ·
**Exit gate** (decisions block §6): new module tested; `src/app.js` **not yet rewired** (that is
Phase 2).

### Ordering constraint (binding — do not reorder)

P1's pure module (including P1-03's `isPresent`/`isAssessed` predicates) must exist and be tested
before Phase 2 rewires `src/app.js` to call it. Phase 2's five originally-scoped rewritten call
sites (`checked`, `buildInput`, `setSimpleField`, `populateFromInput`, the safety-exclusion
listener), plus — per cross-family review F-1 — `anyChecked()`, `updateWorkflowState()`, and
`updateCaseUi()`'s booleanMap call sites (P2-07), all delegate their state-mapping decisions to
this module (FR-8, FR-16) — writing Phase 2 first would mean inlining the mapping logic directly
into DOM-coupled functions, repeating the mistake `tristate.js` was extracted specifically to
avoid (leg B §3).

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P1-01 | `src/facts/fieldState.js` — pure four-state ↔ three-wire-value mapping | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | P0-GATE |
| P1-02 | `tests/field-state.test.mjs` — direct `node --test` coverage | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | P1-01 |
| P1-03 | `isPresent`/`isAssessed` predicates (F-1) | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | P1-01 |
| P1-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | not-started | P1-01, P1-02, P1-03 |
| P1-REVIEW | Cross-family adversarial diff review | gpt-5.6-terra | gpt-5.6-terra/low | codex | not-started | P1-01, P1-03 |

---

## Orchestration Quick Reference

**WORKING ROOT (absolute; do NOT use the parent checkout):**
`/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui`

### Batch 1 (after P0-GATE)

```
Task("general-purpose", "WORKING ROOT (absolute — do NOT use the parent checkout):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P1-01: Create src/facts/fieldState.js mirroring src/facts/tristate.js:1-38 (zero-DOM, zero-import,
pure functions with JSDoc). Export (1) a control-value-to-wire-value mapping: '' -> undefined
(omit key, FR-4), 'unknown' -> 'unknown', 'true' -> 'true', 'false' -> 'false'; and (2) the
inverse wire-value-to-control-value mapping: undefined/absent -> '', 'false'/false -> 'false',
'unknown' -> 'unknown', 'true'/true -> 'true', anything unrecognized -> '' (fail-safe, never
Present). Do not wrap toTri() internally — a fresh, independent mapping is required. See plan
§Phase 1, P1-01 (phase-0-1-baseline-and-pure-module.md).")
```

### Batch 2 (after P1-01)

```
Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P1-02: Author tests/field-state.test.mjs importing src/facts/fieldState.js directly (no shim, no
DOM — mirror tests/tristate-operators.test.mjs's pattern). Cover all 4 control-value ->
wire-value mappings, all inverse round-trip cases (undefined, bare true/false, each of the 3
tri-state strings), the fail-safe behavior on unrecognized input in both directions, and an
explicit case proving 'false' and 'unknown' map to two DIFFERENT control values (AC-3, the
round-trip defect fix). See plan §Phase 1, P1-02.")

Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P1-03: Add isPresent(wireValue) and isAssessed(wireValue) pure predicate exports to
src/facts/fieldState.js (F-1, FR-16) — isPresent true iff resolves to 'true'; isAssessed true iff
not absent/undefined. Zero-DOM, same constraint as P1-01. Extend tests/field-state.test.mjs (or a
sibling file) with direct node --test coverage of both predicates over all four wire-value shapes.
These will back P2-07's anyPresent()/isFieldAssessed() replacements for checked()/anyChecked() on
booleanMap fields. See plan §Phase 1, P1-03.")
```

### Batch 3 (after P1-01, P1-02, P1-03)

```
Task("task-completion-validator", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P1-GATE: Verify Phase 1 exit gate for four-state-questionnaire-ui — src/facts/fieldState.js
exists, zero-DOM, directly tested by tests/field-state.test.mjs including the P1-03 predicates;
src/app.js has NOT been touched this phase. Reject if any DOM reference exists in the new module,
the test uses a shim instead of a direct import, isPresent/isAssessed are missing or untested, or
src/app.js shows any diff.")

Task("gpt-5.6-terra", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P1-REVIEW: Cross-family adversarial diff review (low effort) of the P1 diff, read-only. Check the
fail-safe-to-not-assessed behavior on unrecognized input in both directions, confirm zero DOM
coupling, and confirm isPresent/isAssessed correctly distinguish all four wire-value cases.")
```

---

## Quality Gates

- [ ] `src/facts/fieldState.js` exists, zero-DOM (grep-verified: no `document`/`form`/`RadioNodeList`/`window`)
- [ ] `tests/field-state.test.mjs` imports the module directly and passes
- [ ] Round-trip test explicitly proves `'false'` and `'unknown'` resolve to distinct control values (AC-3 precondition)
- [ ] Unrecognized input on either function fails safe to not-assessed/omit, never to Present
- [ ] **`isPresent`/`isAssessed` predicates exist (P1-03, F-1) and are directly tested across all four wire-value shapes**
- [ ] `src/app.js` unmodified in this phase (Phase 2's scope, not Phase 1's)
- [ ] **Gate criterion**: `npm run check` (= `npm run build && npm test && npm run validate && npm run coverage:rules && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke`) shows **exactly** the 8 recorded baseline failures (test IDs 336, 789, 814, 2132, 2133, 2138, 2363, 2364) and **no others**.

**⚠ Build-before-test trap.** Bare `npm test` in a fresh worktree falsely reports **10** failures
(two extra `dist/`-dependent artifacts). Always `npm run build && npm test`, exactly as `npm run
check` does.

---

## Implementation Notes

### Architectural Decisions

- `src/facts/fieldState.js` is one of the two "truth sources" this plan's sequence names before
  any "seam" (Phase 2) or "presentation" (Phase 3) work begins.
- SQ-2 proved runtime manifest/DOM verification is impossible outside a browser — this phase
  deliberately ships **zero** DOM logic.

### Known Gotchas

- P1-02/P1-03 are the highest-leverage tests in the early phases — every later phase (P2's
  rewrite, P2-06/P2-07's source-shape pins) references this module's exports by identifier.
- `integrity-recorded`-style collapsing bugs come from reusing `toTri()` where the four-way
  distinction must be preserved — do not shortcut P1-01 by wrapping `toTri()`.
- Do not let P1-02 duplicate Phase 2's scope — this is unit coverage of the pure module only.

### Development Setup

Node ≥ 20. Gate before Phase 2 opens: `task-completion-validator` sign-off on this phase's
`P1-GATE`.

---

## Completion Notes

Fill in when Phase 1 is complete: what was built, key learnings, unexpected challenges,
recommendations for Phase 2 (which consumes both `fieldState.js` exports directly).
