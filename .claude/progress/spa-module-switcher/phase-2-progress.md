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
phase: 2
title: "SPA Module Switcher — Phase 2: Generic KB Loading + Engine Seam + Eligibility Predicate"
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
- karen
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P2-01
  description: >
    MODULE_KB_LOADERS literal-specifier map (FR-36 / R-4 / SQ-3 §6). Create
    src/moduleKbLoaders.js holding an Object.freeze({...}) map of moduleId → thunk, each thunk
    containing literal fetch() calls exactly as SQ-3 §6 specifies — 8 literal specifiers total
    (4 modules × 2 files). Template-built specifiers are prohibited: a template literal would
    make check-app-imports.mjs:121-132 only prefix-check ./modules (losing per-file verification)
    and build-static.mjs:148's regex would not stamp it, serving unstamped cacheable KB JSON.
    Register the new file in APP_SURFACE_FILES. Mirror the existing MODULE_CODE_LOADERS shape
    (src/modules/registry.js:68-73) rather than inventing a new one.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P1-01, P1-03]
  estimated_effort: "1.25 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/moduleKbLoaders.js
  - scripts/check-app-imports.mjs
  acceptance_criteria: >
    src/moduleKbLoaders.js exists with exactly 8 literal fetch specifiers across 4 frozen thunks;
    zero template literals in any specifier; the file is registered in APP_SURFACE_FILES;
    check-app-imports.mjs:92 extracts all 8 with isDynamic: false; a thunk for an unregistered
    moduleId is absent rather than falling through to anemia.
- id: P2-02
  description: >
    assessModule() seam in src/engine.js, retaining assessPediatricAnemia (R-3). Add a
    module-generic assessModule(moduleId, input, rules, candidates) export delegating to the
    existing generic assess(input, moduleId, rules, candidates) (src/engine.js:19).
    assessPediatricAnemia (src/engine.js:98-100) stays exported with its exact current signature
    and call shape — scripts/smoke-browser-unit-rejection.mjs greps src/app.js source text for it
    at multiple line anchors (:132,:134,:179,:188,:216-223). Deleting or renaming it silently
    breaks the gate. This task changes no clinical logic — it adds a call shape, nothing else.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: []
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/engine.js
  acceptance_criteria: >
    assessModule exported and delegating to assess() with no new branching on moduleId;
    assessPediatricAnemia still exported with an unchanged signature; git diff src/engine.js
    shows additive change only — no line inside assess()'s existing body is modified; npm test
    green, including the pre-existing engine suite.
- id: P2-03
  description: >
    SEAM TASK — eligibility predicate module from imported READY_STATUS (D-1 / FR-4, FR-6).
    Create src/moduleEligibility.js exporting a single predicate (e.g. isModuleSelectable(moduleId))
    that reads moduleManifests[moduleId]?.status and compares it against READY_STATUS imported
    from src/kbVerify.js (:43). Never a hardcoded 'integrity-recorded' literal anywhere in the UI
    layer. The predicate is the sole gate on both (a) whether a row is activatable and (b) whether
    MODULE_KB_LOADERS and assess() are ever invoked (AC-2 propagation contract). Eligibility is
    decided from the manifest, before any assess() call — never by catching an engine throw (D-4).
    Register the file in APP_SURFACE_FILES. Owned jointly by the frontend and registry/seam
    engineers.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P1-01, P2-01]
  estimated_effort: "1.0 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/moduleEligibility.js
  acceptance_criteria: >
    Predicate imports READY_STATUS from src/kbVerify.js; grep for the literal
    'integrity-recorded' across src/app.js, src/moduleEligibility.js and index.html returns zero
    hits; a manifest whose status is absent or not in the closed enum returns false (ineligible →
    FR-17 refusal), never defaulting to eligible; the predicate has no try/catch and calls nothing
    from src/engine.js; file registered in APP_SURFACE_FILES.
- id: P2-04
  description: >
    Reset-before-fetch ordering contract (FR-18 precondition, SQ-3 §4.4). The KB loading path
    must reset rules to [] and candidates to {} before issuing any fetch, so a failed or slow load
    can never leave the previous module's KB in place. Implement the ordering in the loader call
    site (the function P3/P4 will call), not in the frozen map. Document the ordering as a
    comment citing SQ-3 §4.4 so a later refactor does not reorder it.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-01]
  estimated_effort: "0.5 pts"
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    A test (or an assertion exercised by P6-005) proves that after initiating a load for module X
    whose fetch rejects, rules is [] and candidates is {} — never module Y's prior values; the
    reset precedes the fetch call in source order.
- id: P2-05
  description: >
    8-specifier dev+dist verification and ?v= stamping proof. Run npm run check:imports and
    confirm all 8 MODULE_KB_LOADERS specifiers receive per-file existence verification in both
    dev and dist layouts. Then run npm run build and confirm build-static.mjs:148 stamped all 8 to
    ?v=<stamp>, and that smoke-browser-unit-rejection.mjs:149-153's dist unstamped-fetch scan
    still passes. Also confirm scripts/verify-d4-built.mjs (iterates MODULE_IDS, requires
    dist/modules/<id>/rules.json) is unaffected.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-01]
  estimated_effort: "0.75 pts"
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - dist/modules/**
  acceptance_criteria: >
    check:imports exits 0 and its output shows 8 non-dynamic specifiers verified; post-build, all
    8 appear ?v=-stamped in dist/; the dist unstamped-fetch scan passes; npm run verify:d4 green.
- id: P2-06
  description: >
    Negative test — no template-literal fetch specifier may re-enter (R-4 regression guard).
    Add a test asserting that no file listed in APP_SURFACE_FILES contains a template-literal
    fetch specifier matching fetch(`…${. The test must state, in a comment, why (unstamped KB
    JSON is the stale-rules hazard build-static.mjs:100-106 exists to prevent) so the next reader
    does not delete it as redundant.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-01]
  estimated_effort: "0.5 pts"
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tests/
  acceptance_criteria: >
    Test passes today; a deliberately seeded fetch(`./modules/${id}/rules.json`) in an
    app-surface file makes it fail; the comment names build-static.mjs:148 and the stale-rules
    hazard.
- id: P2-GATE
  description: >
    task-completion-validator gate. Verify the Phase 2 exit gate: check:imports per-file
    verification passes for all 8 specifiers; ?v= stamping verified in dist/; assessPediatricAnemia
    still exported with an unchanged call shape; the eligibility predicate imports READY_STATUS
    and contains no literal. Reject if any specifier is template-built, if assessPediatricAnemia
    was renamed/removed, or if the predicate can return eligible for an absent/unknown status.
  status: pending
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P2-01, P2-02, P2-03, P2-04, P2-05, P2-06]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: P2-KAREN
  description: >
    karen milestone review (Milestone 1). Independent milestone review of the seam foundation.
    Verify: (1) the literal-specifier pattern is genuinely literal in all 8 places, not
    "literal-ish"; (2) the eligibility predicate is the sole gate — no second, divergent
    eligibility check exists anywhere; (3) assessModule added no clinical logic and no moduleId
    branching; (4) nothing in P0–P2 changed any module's status, signed anything, or described
    any artifact as validated, verified, reviewed, approved or released.
  status: pending
  assigned_to: [karen]
  provider: claude
  dependencies: [P2-GATE]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: >
    Milestone review recorded; any finding either fixed in-phase or logged to
    .claude/findings/spa-module-switcher-findings.md with findings_doc_ref set.
parallelization:
  batch_1: [P2-01, P2-02]
  batch_2: [P2-03, P2-04]
  batch_3: [P2-05, P2-06]
  batch_4: [P2-GATE]
  batch_5: [P2-KAREN]
  critical_path: [P2-01, P2-03, P2-GATE, P2-KAREN]
  estimated_total_time: "~1.5–2 engineer-days"
blockers:
- id: BLOCKER-PHASE-DEP
  title: "Phase 2 cannot open until Phase 0 AND Phase 1 exit gates (P0-GATE, P1-GATE) both pass"
  severity: high
  blocking: [P2-01, P2-03]
  resolution: >
    Wait for .claude/progress/spa-module-switcher/phase-0-progress.md P0-GATE and
    .claude/progress/spa-module-switcher/phase-1-progress.md P1-GATE to both complete.
  created: '2026-07-22'
success_criteria:
- id: SC-1
  description: "All 8 MODULE_KB_LOADERS specifiers are literal; check-app-imports.mjs:92 reports them isDynamic: false"
  status: pending
- id: SC-2
  description: "All 8 resolve in both dev and dist/ layouts; all 8 are ?v=-stamped post-build"
  status: pending
- id: SC-3
  description: "smoke-browser-unit-rejection.mjs:149-153 dist unstamped-fetch scan passes; npm run verify:d4 green"
  status: pending
- id: SC-4
  description: "assessPediatricAnemia (src/engine.js:98-100) still exported, signature and call shape unchanged (R-3)"
  status: pending
- id: SC-5
  description: "assessModule is additive — no line of assess()'s existing body modified"
  status: pending
- id: SC-6
  description: "Eligibility predicate imports READY_STATUS from src/kbVerify.js:43; zero 'integrity-recorded' literals in the UI layer"
  status: pending
- id: SC-7
  description: "Absent or out-of-enum status → ineligible, never eligible-by-default"
  status: pending
- id: SC-8
  description: "rules/candidates reset to []/{} before any fetch (SQ-3 §4.4)"
  status: pending
- id: SC-9
  description: "R-4 regression test present and proven to fail on a seeded template-literal specifier"
  status: pending
- id: SC-10
  description: "karen Milestone 1 review recorded"
  status: pending
files_modified:
- src/moduleKbLoaders.js
- src/moduleEligibility.js
- src/engine.js
- src/app.js
- scripts/check-app-imports.mjs
- tests/
notes: >
  Wave 2 — depends on both Phase 0 and Phase 1. This is the load-bearing foundation of every later
  phase (why it earns a karen milestone review): if the specifier pattern is wrong, ?v= stamping
  silently stops and stale KB JSON is served to a clinician (R-4); if the eligibility predicate
  takes a literal instead of the imported READY_STATUS, the client silently diverges from the
  build and server on what "servable" means. **Critical path**: P0∥P1 → P2 → P3 → P4 → P6 → P7.
  P5 also depends on this phase (hangs off P2) in addition to Phase 4.
---

# spa-module-switcher — Phase 2: Generic KB Loading + Engine Seam + Eligibility Predicate

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-2-progress.md -t P2-01 -s completed
```

---

## Objective

Wire the browser to the already module-agnostic engine and KB layer: a literal-specifier
`MODULE_KB_LOADERS` map, a module-generic `assessModule()` seam (retaining `assessPediatricAnemia`
byte-for-byte), and the single `READY_STATUS`-driven eligibility predicate every later phase gates
on. This is Milestone 1 of 3 named `karen` reviews.

**Duration**: ~1.5–2 engineer-days · **Dependencies**: Phase 0 **and** Phase 1 complete (wave 2) ·
**Exit gate**: `check:imports` per-file verification passes for all 8 `MODULE_KB_LOADERS`
specifiers; `?v=` stamping verified in `dist/`; then a `karen` Milestone 1 review.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P2-01 | `MODULE_KB_LOADERS` literal-specifier map | general-purpose (frontend engineer¹) | sonnet/adaptive | claude | pending | P1-01, P1-03 |
| P2-02 | `assessModule()` seam, retaining `assessPediatricAnemia` | general-purpose | sonnet/adaptive | claude | pending | none |
| P2-03 | **Seam task** — eligibility predicate from imported `READY_STATUS` | general-purpose (registry/seam engineer + frontend engineer¹) | sonnet/adaptive | claude | pending | P1-01, P2-01 |
| P2-04 | Reset-before-fetch ordering contract | general-purpose | sonnet/adaptive | claude | pending | P2-01 |
| P2-05 | 8-specifier dev+dist verification and `?v=` stamping proof | general-purpose | sonnet/adaptive | claude | pending | P2-01 |
| P2-06 | Negative test — no template-literal fetch specifier | general-purpose | sonnet/adaptive | claude | pending | P2-01 |
| P2-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | pending | P2-01..P2-06 |
| P2-KAREN | **`karen` milestone review (Milestone 1)** | karen | sonnet/adaptive | claude | pending | P2-GATE |

¹ **Agent-name substitution**: `frontend-developer`/`backend-architect` are not registered in this
project; dispatched as `general-purpose` with the role descriptor retained.

---

## Orchestration Quick Reference

### Batch 1 (after Phase 0 + Phase 1 gates)

```
Task("general-purpose", "P2-01: MODULE_KB_LOADERS literal-specifier map (FR-36/R-4/SQ-3 §6).
Create src/moduleKbLoaders.js — Object.freeze({...}) map of moduleId → thunk, 8 literal fetch()
specifiers total, mirroring MODULE_CODE_LOADERS shape (src/modules/registry.js:68-73). No
template-literal specifiers anywhere. Register in APP_SURFACE_FILES. See plan §Phase 2, P2-01.")

Task("general-purpose", "P2-02: assessModule() seam in src/engine.js (R-3). Add
assessModule(moduleId, input, rules, candidates) delegating to assess(). Retain
assessPediatricAnemia (src/engine.js:98-100) with its exact current signature and call shape —
smoke-browser-unit-rejection.mjs greps src/app.js source text for it. Additive change only, no
line of assess()'s existing body modified. See plan §Phase 2, P2-02.")
```

### Batch 2 (after P2-01)

```
Task("general-purpose", "P2-03: SEAM TASK — eligibility predicate module (D-1/FR-4/FR-6). Create
src/moduleEligibility.js exporting isModuleSelectable(moduleId) reading
moduleManifests[moduleId]?.status vs. READY_STATUS imported from src/kbVerify.js:43 — never a
hardcoded literal. Sole gate on row activation and MODULE_KB_LOADERS/assess() invocation.
Decided from the manifest before any assess() call, never by catching a throw (D-4). No
try/catch. Register in APP_SURFACE_FILES. See plan §Phase 2, P2-03.")

Task("general-purpose", "P2-04: Reset-before-fetch ordering contract (SQ-3 §4.4). Reset rules to
[] and candidates to {} before any fetch in the loader call site, so a failed/slow load never
leaves the previous module's KB in place. Comment the ordering as load-bearing. See plan §Phase
2, P2-04.")
```

### Batch 3 (after P2-01)

```
Task("general-purpose", "P2-05: 8-specifier dev+dist verification and ?v= stamping proof. Run
npm run check:imports (confirm all 8 verified, isDynamic: false) then npm run build (confirm all
8 ?v=-stamped); confirm the dist unstamped-fetch scan and verify-d4-built still pass. See plan
§Phase 2, P2-05.")

Task("general-purpose", "P2-06: Negative test — no template-literal fetch specifier may re-enter
(R-4 regression guard). Assert no APP_SURFACE_FILES entry contains fetch(`…${. Comment names
build-static.mjs:148 and the stale-rules hazard. See plan §Phase 2, P2-06.")
```

### Gate + Milestone (after all tasks complete)

```
Task("task-completion-validator", "P2-GATE: Verify Phase 2 exit gate for spa-module-switcher —
check:imports per-file verification passes for all 8 specifiers; ?v= stamping verified in dist/;
assessPediatricAnemia unchanged; eligibility predicate imports READY_STATUS with no literal.
Reject on any template-built specifier, renamed/removed assessPediatricAnemia, or a predicate
defaulting to eligible.")

Task("karen", "P2-KAREN: Milestone 1 review of the seam foundation for spa-module-switcher.
Verify: (1) literal-specifier pattern genuinely literal in all 8 places; (2) eligibility predicate
is the sole gate, no divergent second check; (3) assessModule added no clinical logic/branching;
(4) nothing in P0–P2 changed a module status, signed anything, or claimed validation/approval.")
```

---

## Quality Gates

- [ ] All 8 `MODULE_KB_LOADERS` specifiers are literal; `check-app-imports.mjs:92` reports them `isDynamic: false`
- [ ] All 8 resolve in **both** dev and `dist/` layouts; all 8 are `?v=`-stamped post-build
- [ ] `smoke-browser-unit-rejection.mjs:149-153` dist unstamped-fetch scan passes; `npm run verify:d4` green
- [ ] `assessPediatricAnemia` (`src/engine.js:98-100`) still exported, signature and call shape unchanged (R-3)
- [ ] `assessModule` is additive — no line of `assess()`'s existing body modified
- [ ] Eligibility predicate imports `READY_STATUS` from `src/kbVerify.js:43`; zero `'integrity-recorded'` literals in the UI layer
- [ ] Absent or out-of-enum `status` → ineligible, never eligible-by-default
- [ ] `rules`/`candidates` reset to `[]`/`{}` **before** any fetch (SQ-3 §4.4)
- [ ] R-4 regression test present and proven to fail on a seeded template-literal specifier
- [ ] `karen` Milestone 1 review recorded

---

## Implementation Notes

### Architectural Decisions

- `src/moduleKbLoaders.js` mirrors `MODULE_CODE_LOADERS`'s existing shape — no new pattern invented.
- The eligibility predicate is deliberately **not** a try/catch around `assess()` — D-4 requires
  eligibility be decided from the manifest, before any engine call, to avoid a misattributed refusal.

### Known Gotchas

- **Why this phase gets `karen`**: P2 is the load-bearing foundation of every later phase. A wrong
  specifier pattern silently breaks `?v=` stamping (stale KB served); a predicate that takes a
  literal instead of the imported `READY_STATUS` diverges silently from build/server truth.
- Do not let `assessModule` grow moduleId-specific branching — it is a pure delegation to `assess()`.
- P2-03 is jointly owned (frontend + registry/seam engineer) — it is the seam between Phase 1's
  manifest surface and Phase 2's own engine seam.

### Development Setup

Node ≥ 20. Gate before Phase 3 opens: `npm run check:imports` green + `task-completion-validator`
sign-off (`P2-GATE`) + `karen` Milestone 1 sign-off (`P2-KAREN`) — **both** required, not just the
validator gate.

---

## Completion Notes

Fill in when Phase 2 is complete: what was built, key learnings, unexpected challenges,
recommendations for Phase 3 (selector UI) and Phase 5 (which also depends on this phase).
