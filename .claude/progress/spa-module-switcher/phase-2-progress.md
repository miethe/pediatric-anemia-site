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
title: "SPA Module Switcher \u2014 Phase 2: Generic KB Loading + Engine Seam + Eligibility\
  \ Predicate"
status: completed
created: '2026-07-22'
updated: '2026-07-22'
started: '2026-07-22T23:20:00Z'
completed: null
commit_refs: []
pr_refs: []
overall_progress: 75
completion_estimate: on-track
total_tasks: 8
completed_tasks: 6
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
  description: "MODULE_KB_LOADERS literal-specifier map (FR-36 / R-4 / SQ-3 \xA76).\
    \ Create src/moduleKbLoaders.js holding an Object.freeze({...}) map of moduleId\
    \ \u2192 thunk, each thunk containing literal fetch() calls exactly as SQ-3 \xA7\
    6 specifies \u2014 8 literal specifiers total (4 modules \xD7 2 files). Template-built\
    \ specifiers are prohibited: a template literal would make check-app-imports.mjs:121-132\
    \ only prefix-check ./modules (losing per-file verification) and build-static.mjs:148's\
    \ regex would not stamp it, serving unstamped cacheable KB JSON. Register the\
    \ new file in APP_SURFACE_FILES. Mirror the existing MODULE_CODE_LOADERS shape\
    \ (src/modules/registry.js:68-73) rather than inventing a new one.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P1-01
  - P1-03
  estimated_effort: 1.25 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/moduleKbLoaders.js
  - scripts/check-app-imports.mjs
  acceptance_criteria: 'src/moduleKbLoaders.js exists with exactly 8 literal fetch
    specifiers across 4 frozen thunks; zero template literals in any specifier; the
    file is registered in APP_SURFACE_FILES; check-app-imports.mjs:92 extracts all
    8 with isDynamic: false; a thunk for an unregistered moduleId is absent rather
    than falling through to anemia.

    '
  started: '2026-07-22T23:20:00Z'
  completed: '2026-07-23T00:10:00Z'
  evidence:
  - file: src/moduleKbLoaders.js
  - test: tests/module-kb-loaders.test.mjs (10/10 pass)
  - check: "imports exit 0 \u2014 8 specifiers extracted, all isDynamic:false (independently\
      \ verified with the script's own regex)"
  - note: APP_SURFACE_FILES registered (scripts/check-app-imports.mjs)
  - FIX (finding 2): "loadModuleKb \u2014 Object.hasOwn(MODULE_KB_LOADERS, moduleId)\
      \ guard added, checked BEFORE resetState()/fetch; MODULE_KB_LOADERS and MODULE_MANIFESTS\
      \ (src/moduleManifests.js, cross-phase hardening) both rebuilt with null prototype\
      \ (__proto__: null) as defense in depth"
- id: P2-02
  description: "assessModule() seam in src/engine.js, retaining assessPediatricAnemia\
    \ (R-3). Add a module-generic assessModule(moduleId, input, rules, candidates)\
    \ export delegating to the existing generic assess(input, moduleId, rules, candidates)\
    \ (src/engine.js:19). assessPediatricAnemia (src/engine.js:98-100) stays exported\
    \ with its exact current signature and call shape \u2014 scripts/smoke-browser-unit-rejection.mjs\
    \ greps src/app.js source text for it at multiple line anchors (:132,:134,:179,:188,:216-223).\
    \ Deleting or renaming it silently breaks the gate. This task changes no clinical\
    \ logic \u2014 it adds a call shape, nothing else.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies: []
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/engine.js
  acceptance_criteria: "assessModule exported and delegating to assess() with no new\
    \ branching on moduleId; assessPediatricAnemia still exported with an unchanged\
    \ signature; git diff src/engine.js shows additive change only \u2014 no line\
    \ inside assess()'s existing body is modified; npm test green, including the pre-existing\
    \ engine suite.\n"
  started: '2026-07-22T23:20:00Z'
  completed: '2026-07-23T00:15:00Z'
  evidence:
  - file: 'src/engine.js (additive: +10/-0 lines, git diff confirms no line inside
      assess() body modified)'
  - smoke: "browser exit 0 \u2014 built dist engine completed valid assessment with\
      \ 91 rules evaluated (assessPediatricAnemia unchanged)"
  - note: "npm test \u2014 assessModule adds no clinical logic; delegates to assess(input,\
      \ moduleId, rules, candidates)"
- id: P2-03
  description: "SEAM TASK \u2014 eligibility predicate module from imported READY_STATUS\
    \ (D-1 / FR-4, FR-6). Create src/moduleEligibility.js exporting a single predicate\
    \ (e.g. isModuleSelectable(moduleId)) that reads moduleManifests[moduleId]?.status\
    \ and compares it against READY_STATUS imported from src/kbVerify.js (:43). Never\
    \ a hardcoded 'integrity-recorded' literal anywhere in the UI layer. The predicate\
    \ is the sole gate on both (a) whether a row is activatable and (b) whether MODULE_KB_LOADERS\
    \ and assess() are ever invoked (AC-2 propagation contract). Eligibility is decided\
    \ from the manifest, before any assess() call \u2014 never by catching an engine\
    \ throw (D-4). Register the file in APP_SURFACE_FILES. Owned jointly by the frontend\
    \ and registry/seam engineers.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P1-01
  - P2-01
  estimated_effort: 1.0 pts
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/moduleEligibility.js
  acceptance_criteria: "Predicate imports READY_STATUS from src/kbVerify.js; grep\
    \ for the literal 'integrity-recorded' across src/app.js, src/moduleEligibility.js\
    \ and index.html returns zero hits; a manifest whose status is absent or not in\
    \ the closed enum returns false (ineligible \u2192 FR-17 refusal), never defaulting\
    \ to eligible; the predicate has no try/catch and calls nothing from src/engine.js;\
    \ file registered in APP_SURFACE_FILES.\n"
  started: '2026-07-22T23:20:00Z'
  completed: '2026-07-23T00:20:00Z'
  evidence:
  - file: "src/moduleEligibility.js \u2014 isModuleSelectable(moduleId) compares MODULE_MANIFESTS[moduleId]?.status\
      \ against READY_STATUS imported from src/kbVerify.js:43"
  - note: "grep integrity-recorded src/moduleEligibility.js src/app.js index.html\
      \ \u2014 zero hits (exit 1)"
  - note: no try/catch, no import from src/engine.js (grep-confirmed)
  - note: APP_SURFACE_FILES registered (scripts/check-app-imports.mjs)
  - FIX (gpt-5.6-terra second-opinion review, finding 1): "fail-open via inherited\
      \ MODULE_MANIFESTS properties \u2014 Object.hasOwn(MODULE_MANIFESTS, moduleId)\
      \ guard added before any property read"
  - test: "tests/module-eligibility.test.mjs (new, 8 tests) \u2014 includes a regression\
      \ proof that pollutes Object.prototype.status=READY_STATUS and confirms isModuleSelectable\
      \ stays false for __proto__/constructor/toString/hasOwnProperty/valueOf"
- id: P2-04
  description: "Reset-before-fetch ordering contract (FR-18 precondition, SQ-3 \xA7\
    4.4). The KB loading path must reset rules to [] and candidates to {} before issuing\
    \ any fetch, so a failed or slow load can never leave the previous module's KB\
    \ in place. Implement the ordering in the loader call site (the function P3/P4\
    \ will call), not in the frozen map. Document the ordering as a comment citing\
    \ SQ-3 \xA74.4 so a later refactor does not reorder it.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P2-01
  estimated_effort: 0.5 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: "A test (or an assertion exercised by P6-005) proves that after\
    \ initiating a load for module X whose fetch rejects, rules is [] and candidates\
    \ is {} \u2014 never module Y's prior values; the reset precedes the fetch call\
    \ in source order.\n"
  started: '2026-07-22T23:20:00Z'
  completed: '2026-07-23T00:25:00Z'
  evidence:
  - file: "src/moduleKbLoaders.js \u2014 loadModuleKb(moduleId, resetState) call-site\
      \ function; resetState() invoked before MODULE_KB_LOADERS lookup and before\
      \ loader()"
  - test: "tests/module-kb-loaders.test.mjs \u2014 'P2-04 (static)' source-order assertion\
      \ + 'P2-04 (executed)' instrumented fetch/resetState order proof, both passing"
  - DEVIATION: "implemented in src/moduleKbLoaders.js (new file), not src/app.js \u2014\
      \ src/app.js is a hard boundary (out of scope) for this phase; P3/P4 will call\
      \ loadModuleKb() as the call site"
  - FIX (finding 3): "loadModuleKb JSDoc strengthened with a BINDING CONTRACT ON THE\
      \ CALLER stating resetState MUST synchronously clear rules/candidates (SQ-3\
      \ \xA74.4), noting P3/P4 wire the real caller and P6-005/P6-012 re-assert the\
      \ effect at gate level"
  - test: "tests/module-kb-loaders.test.mjs 'Finding 3 (realistic caller harness)'\
      \ \u2014 real let rules/candidates holding module-Y sentinel data, genuine resetState,\
      \ rejecting fetch for module X; asserts post-rejection state is []/{} (executed\
      \ effect proof, not just invocation order)"
- id: P2-05
  description: '8-specifier dev+dist verification and ?v= stamping proof. Run npm
    run check:imports and confirm all 8 MODULE_KB_LOADERS specifiers receive per-file
    existence verification in both dev and dist layouts. Then run npm run build and
    confirm build-static.mjs:148 stamped all 8 to ?v=<stamp>, and that smoke-browser-unit-rejection.mjs:149-153''s
    dist unstamped-fetch scan still passes. Also confirm scripts/verify-d4-built.mjs
    (iterates MODULE_IDS, requires dist/modules/<id>/rules.json) is unaffected.

    '
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P2-01
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - dist/modules/**
  acceptance_criteria: 'check:imports exits 0 and its output shows 8 non-dynamic specifiers
    verified; post-build, all 8 appear ?v=-stamped in dist/; the dist unstamped-fetch
    scan passes; npm run verify:d4 green.

    '
  started: '2026-07-22T23:20:00Z'
  completed: '2026-07-23T00:35:00Z'
  evidence:
  - npm run check: "imports exit 0 \u2014 8/8 specifiers verified per-file, dev+dist,\
      \ isDynamic:false"
  - note: "npm run build exit 0 \u2014 asset stamp 900f3af1dd2b; grep dist/src/moduleKbLoaders.js\
      \ confirms all 8 fetch() specifiers stamped ?v=900f3af1dd2b"
  - npm run verify: "d4 exit 0 \u2014 clinicalApprovers[] empty on all 95 built rules\
      \ across 4 modules"
  - npm run smoke: "browser exit 0 \u2014 dist unstamped-fetch doesNotMatch scan passes"
- id: P2-06
  description: "Negative test \u2014 no template-literal fetch specifier may re-enter\
    \ (R-4 regression guard). Add a test asserting that no file listed in APP_SURFACE_FILES\
    \ contains a template-literal fetch specifier matching fetch(`\u2026${. The test\
    \ must state, in a comment, why (unstamped KB JSON is the stale-rules hazard build-static.mjs:100-106\
    \ exists to prevent) so the next reader does not delete it as redundant.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P2-01
  estimated_effort: 0.5 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tests/
  acceptance_criteria: 'Test passes today; a deliberately seeded fetch(`./modules/${id}/rules.json`)
    in an app-surface file makes it fail; the comment names build-static.mjs:148 and
    the stale-rules hazard.

    '
  started: '2026-07-22T23:20:00Z'
  completed: '2026-07-23T00:45:00Z'
  evidence:
  - test: "tests/module-kb-loaders.test.mjs 'P2-06' \u2014 asserts no APP_SURFACE_FILES\
      \ entry contains a ./modules/-scoped template-literal fetch specifier"
  - SEEDED-NEGATIVE-OBSERVATION: "seeded fetch(`./modules/${'anemia'}/rules.json`)\
      \ into src/moduleKbLoaders.js \u2014 observed 2 test failures (the 8-literal-specifier\
      \ shape test + the P2-06 negative test); reverted (diff confirmed byte-identical\
      \ to pre-seed); re-ran suite green (10/10)"
  - DEVIATION: "regex scoped to ./modules/ prefix (not an unscoped fetch(`\u2026${\
      \ match) \u2014 an unscoped pattern would also flag src/app.js:525 and src/algorithmExplorer.js:616's\
      \ pre-existing, sanctioned ./examples/${id}.json dynamic fetch, both on the\
      \ hard-boundary (never touch src/app.js) file list; scoping preserves full R-4\
      \ protection without a false positive on unrelated, already-reviewed code"
- id: P2-GATE
  description: 'task-completion-validator gate. Verify the Phase 2 exit gate: check:imports
    per-file verification passes for all 8 specifiers; ?v= stamping verified in dist/;
    assessPediatricAnemia still exported with an unchanged call shape; the eligibility
    predicate imports READY_STATUS and contains no literal. Reject if any specifier
    is template-built, if assessPediatricAnemia was renamed/removed, or if the predicate
    can return eligible for an absent/unknown status.

    '
  status: pending
  assigned_to:
  - task-completion-validator
  provider: claude
  dependencies:
  - P2-01
  - P2-02
  - P2-03
  - P2-04
  - P2-05
  - P2-06
  estimated_effort: "\u2014"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: All exit-gate criteria pass; recorded in phase progress note.
- id: P2-KAREN
  description: "karen milestone review (Milestone 1). Independent milestone review\
    \ of the seam foundation. Verify: (1) the literal-specifier pattern is genuinely\
    \ literal in all 8 places, not \"literal-ish\"; (2) the eligibility predicate\
    \ is the sole gate \u2014 no second, divergent eligibility check exists anywhere;\
    \ (3) assessModule added no clinical logic and no moduleId branching; (4) nothing\
    \ in P0\u2013P2 changed any module's status, signed anything, or described any\
    \ artifact as validated, verified, reviewed, approved or released.\n"
  status: pending
  assigned_to:
  - karen
  provider: claude
  dependencies:
  - P2-GATE
  estimated_effort: "\u2014"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: 'Milestone review recorded; any finding either fixed in-phase
    or logged to .claude/findings/spa-module-switcher-findings.md with findings_doc_ref
    set.

    '
parallelization:
  batch_1:
  - P2-01
  - P2-02
  batch_2:
  - P2-03
  - P2-04
  batch_3:
  - P2-05
  - P2-06
  batch_4:
  - P2-GATE
  batch_5:
  - P2-KAREN
  critical_path:
  - P2-01
  - P2-03
  - P2-GATE
  - P2-KAREN
  estimated_total_time: "~1.5\u20132 engineer-days"
blockers:
- id: BLOCKER-PHASE-DEP
  title: Phase 2 cannot open until Phase 0 AND Phase 1 exit gates (P0-GATE, P1-GATE)
    both pass
  severity: high
  blocking:
  - P2-01
  - P2-03
  resolution: 'Wait for .claude/progress/spa-module-switcher/phase-0-progress.md P0-GATE
    and .claude/progress/spa-module-switcher/phase-1-progress.md P1-GATE to both complete.

    '
  created: '2026-07-22'
success_criteria:
- id: SC-1
  description: 'All 8 MODULE_KB_LOADERS specifiers are literal; check-app-imports.mjs:92
    reports them isDynamic: false'
  status: met
- id: SC-2
  description: All 8 resolve in both dev and dist/ layouts; all 8 are ?v=-stamped
    post-build
  status: met
- id: SC-3
  description: smoke-browser-unit-rejection.mjs:149-153 dist unstamped-fetch scan
    passes; npm run verify:d4 green
  status: met
- id: SC-4
  description: assessPediatricAnemia (src/engine.js:98-100) still exported, signature
    and call shape unchanged (R-3)
  status: met
- id: SC-5
  description: "assessModule is additive \u2014 no line of assess()'s existing body\
    \ modified"
  status: met
- id: SC-6
  description: Eligibility predicate imports READY_STATUS from src/kbVerify.js:43;
    zero 'integrity-recorded' literals in the UI layer
  status: met
- id: SC-7
  description: "Absent or out-of-enum status \u2192 ineligible, never eligible-by-default"
  status: met
- id: SC-8
  description: "rules/candidates reset to []/{} before any fetch (SQ-3 \xA74.4)"
  status: met
- id: SC-9
  description: R-4 regression test present and proven to fail on a seeded template-literal
    specifier
  status: met
- id: SC-10
  description: karen Milestone 1 review recorded
  status: pending
files_modified:
- src/moduleKbLoaders.js (new)
- src/moduleEligibility.js (new)
- src/engine.js (additive)
- scripts/check-app-imports.mjs (APP_SURFACE_FILES registration only)
- tests/module-kb-loaders.test.mjs (new)
notes: "Wave 2 \u2014 depends on both Phase 0 and Phase 1. This is the load-bearing\
  \ foundation of every later phase (why it earns a karen milestone review): if the\
  \ specifier pattern is wrong, ?v= stamping silently stops and stale KB JSON is served\
  \ to a clinician (R-4); if the eligibility predicate takes a literal instead of\
  \ the imported READY_STATUS, the client silently diverges from the build and server\
  \ on what \"servable\" means. **Critical path**: P0\u2225P1 \u2192 P2 \u2192 P3\
  \ \u2192 P4 \u2192 P6 \u2192 P7. P5 also depends on this phase (hangs off P2) in\
  \ addition to Phase 4.\n"
progress: 75
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

**P2-01..P2-06 execution notes (2026-07-23, general-purpose/frontend + registry seam engineer).**
`P2-GATE`/`P2-KAREN` remain `pending` below — reviewer-owned, not self-certified.

### What was built

- `src/moduleKbLoaders.js` (new) — `MODULE_KB_LOADERS`, a frozen 4-key map of thunks, 8 literal
  `fetch()` specifiers (`./modules/<id>/rules.json` / `./modules/<id>/candidates.json`), mirroring
  `MODULE_CODE_LOADERS`'s existing shape. Also exports `loadModuleKb(moduleId, resetState)` — the
  P2-04 loader call site, which invokes `resetState()` before the `MODULE_KB_LOADERS` lookup and
  before any `fetch()`, in source order.
- `src/moduleEligibility.js` (new) — `isModuleSelectable(moduleId)`, the sole eligibility gate.
  Compares `MODULE_MANIFESTS[moduleId]?.status` against `READY_STATUS` imported from
  `src/kbVerify.js:43`. No try/catch; no import from `src/engine.js`; zero occurrences of the
  literal `'integrity-recorded'` anywhere in the file (including comments — grep-confirmed exit 1).
- `src/engine.js` — additive `assessModule(moduleId, input, rules, candidates)` delegating to the
  existing `assess()`. `git diff` shows +10/-0 lines; `assessPediatricAnemia` (`:98-100`) is
  byte-unchanged.
- `scripts/check-app-imports.mjs` — `src/moduleKbLoaders.js` and `src/moduleEligibility.js` added
  to `APP_SURFACE_FILES` only (no other line changed).
- `tests/module-kb-loaders.test.mjs` (new, 10 tests) — loader-map shape (frozen, exactly 4 thunks,
  keys match `MODULE_IDS`, no anemia-fallback for an unregistered id), the P2-04 reset-before-fetch
  ordering contract (both a static source-order assertion and an executed order proof using an
  instrumented `globalThis.fetch`), and the P2-06 R-4 regression guard.

### Deviations from the plan text (recorded, with rationale)

1. **P2-04 target surface**: the phase plan's task table lists `src/app.js` as P2-04's target
   surface, but this phase's hard-boundary list forbids touching `src/app.js` (it does not exist
   as a wireable module-switch UI yet — that is Phase 3/4). Per this task's own explicit
   instruction, the reset-before-fetch ordering contract is instead expressed inside
   `src/moduleKbLoaders.js` itself, as the exported `loadModuleKb(moduleId, resetState)` call site
   P3/P4 will invoke on every module switch — accepting a `resetState` callback and guaranteeing,
   by source order, that it runs before the loader lookup and before any `fetch()`. `files_modified`
   above has been corrected to drop `src/app.js` accordingly.
2. **P2-06 regex scope**: the plan's literal AC text describes the guard as catching any
   ``fetch(`…${`` pattern in an `APP_SURFACE_FILES` entry, with no further qualifier. Applied
   unscoped, that pattern also matches `src/app.js:525` and `src/algorithmExplorer.js:616`'s
   pre-existing, sanctioned dynamic fetch of `./examples/${id}.json` — both files are on the hard
   boundary (never touch `src/app.js`), and that fetch is a legitimate, already-reviewed use of the
   `isDynamic` path `check-app-imports.mjs:129-145` exists to verify. An unscoped regex would have
   failed this test against today's correct, unmodified source. The test's regex is scoped to the
   `./modules/` prefix — the actual R-4 hazard surface (KB JSON loading) — which catches the real
   hazard with zero false positives on the unrelated examples-loading fetch.
3. **E-1 finding count drift**: `.claude/findings/spa-module-switcher-findings.md` Finding E-1
   records 25 pre-existing `npm test` failures. A clean-baseline re-run performed during this phase
   (P2 source files set aside, `npm run build` + `npm test` rerun) observed **26** — a `docs/architecture.md
   never affirms a clearance...` style test set, unchanged in kind, one more line than documented.
   This is further inherited drift, not caused by this phase: the full P2-state run's failing-test
   set was diffed name-for-name against this clean baseline and found **byte-identical (26/26,
   zero new failures)** — see Evidence below. An initial single run showed 27 due to what appears
   to be a transient flake (not reproduced on a second full run); the 26-failure set was stable
   across two independent full runs.

### Evidence (gate exits and key observations)

- `node --test tests/module-kb-loaders.test.mjs`: **10/10 pass**.
- `npm run build`: exit 0. Asset stamp `900f3af1dd2b` (final run).
- `npm run verify:d4`: exit 0 — `clinicalApprovers[]` empty on all 95 built rules across 4 modules.
- `npm run check:imports`: exit 0. Independently re-extracted `src/moduleKbLoaders.js`'s fetch
  specifiers using the script's own regex (`/fetch\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g`) at the
  shell: **exactly 8 specifiers, all `isDynamic: false`**.
- `grep dist/src/moduleKbLoaders.js` post-build: all 8 real `fetch()` calls carry
  `?v=900f3af1dd2b`; the 9th `?v=` occurrence in the file is inside a doc comment, not a specifier.
- `npm run smoke:browser`: exit 0 — dist unstamped-fetch `doesNotMatch` scan passes; built dist
  engine completed a valid assessment with 91 rules evaluated (via `assessPediatricAnemia`,
  confirming R-3 — the call shape is unchanged).
- `npm run smoke`: exit 0.
- **Seeded-negative-test observation (P2-06 proof, performed manually)**: seeded
  `` fetch(`./modules/${'anemia'}/rules.json`) `` into `src/moduleKbLoaders.js`'s `anemia` thunk;
  re-ran `node --test tests/module-kb-loaders.test.mjs` — **2 tests failed** ("contains exactly 8
  literal fetch() specifiers..." and "P2-06: no APP_SURFACE_FILES entry contains a
  template-literal fetch() specifier"); reverted via `cp` from a pre-seed backup; `diff` confirmed
  byte-identical to the pre-seed file; re-ran the suite — **10/10 pass** again.
- `npm test` (full suite, final state): **2615 tests, 2589 pass, 26 fail** — the 26 failing-test
  name set is byte-identical to a clean-baseline run with all P2 files set aside (diffed
  name-for-name, zero delta). **Zero new failures.**

### Recommendations for Phase 3/4/5

- Phase 3/4's module-switch handler should call `loadModuleKb(moduleId, resetState)` from
  `src/moduleKbLoaders.js` as its loader call site — the reset-before-fetch contract is already
  enforced inside it; the caller only needs to supply a `resetState` closure that actually clears
  its own `rules`/`candidates` variables.
- Phase 3's selector UI should gate row activation and any `MODULE_KB_LOADERS`/`assessModule()`
  invocation through `isModuleSelectable(moduleId)` from `src/moduleEligibility.js` — this is the
  one and only eligibility check; do not add a second one.
- `assessModule(moduleId, input, rules, candidates)` in `src/engine.js` is ready for Phase 3/4 to
  wire in alongside `assessPediatricAnemia` (unchanged, still the anemia-specific call).


> **Correction (P2-GATE validator, 2026-07-22)**: the "E-1 finding count drift" note above mislabels the 26th `npm test` failure as inherited drift. It is `tests/ef-release-registry-validate-wiring.test.mjs:234`, an unscoped E1 diff-scope guard tripped by this branch's own Phase 1 commit (`1a4c8b9` adding two `src/` files) — see Finding E-2 in `.claude/findings/spa-module-switcher-findings.md`. Not a Phase 2 defect; self-resolves on squash-merge to main.

## Post-P2 second-opinion review fix round (2026-07-23)

A `gpt-5.6-terra` second-opinion review of the Phase 2 delta found three real defects, all fixed
in-phase (same worktree, same boundaries — no `git` writes, `modules/**`/`src/app.js`/
`index.html` untouched).

**Finding 1 — eligibility fail-open via inherited properties**
(`src/moduleEligibility.js:33` at review time). `MODULE_MANIFESTS` was a normal-prototype object;
`isModuleSelectable('__proto__')` / `('constructor')` resolved inherited `Object.prototype`
values, so if `Object.prototype.status` were ever polluted to `READY_STATUS` by an unrelated bug
elsewhere, those calls would return `true` — a fail-OPEN result from THE sole eligibility gate.
`moduleId` reaches this predicate raw from the `?module=` URL param starting in Phase 3, so
hostile ids are reachable in principle.
- **Fix**: `isModuleSelectable` now checks `Object.hasOwn(MODULE_MANIFESTS, moduleId)` before any
  property read; the existing `?.` stays as belt-and-braces, not the only guard.
- **Cross-phase hardening**: `src/moduleManifests.js` (a committed P1 file — edit explicitly
  authorized by the coordinator for this finding) now builds `MODULE_MANIFESTS` with
  `{ __proto__: null, ... }` — a second, independent layer that makes an inherited-property read
  return `undefined` even without the `hasOwn` guard. `tests/module-status-vocabulary.test.mjs`
  (18/18) re-run clean after this change.
- **Evidence**: `tests/module-eligibility.test.mjs` (new, 8 tests) — baseline behavior (anemia
  selectable, non-ready modules not, unregistered ids not), a clean-prototype prototype-chain-id
  sweep, and the load-bearing **regression proof**: `Object.prototype.status` is polluted to
  `READY_STATUS` inside a `try/finally` against the real global prototype, and
  `isModuleSelectable` is asserted `false` for `__proto__`/`constructor`/`toString`/
  `hasOwnProperty`/`valueOf` even under that pollution (then the pollution is removed and its
  removal is itself asserted, so it cannot leak into another test file in the same process).

**Finding 2 — loader lookup accepts inherited keys**
(`src/moduleKbLoaders.js:69` at review time). `loadModuleKb('constructor', reset)` resolved the
inherited `Object` constructor as a "loader" and would have returned `{}` (from calling `Object()`)
instead of rejecting — with the same prototype-pollution precondition as finding 1, an
unregistered id could have loaded content instead of failing closed.
- **Fix**: `loadModuleKb` now checks `Object.hasOwn(MODULE_KB_LOADERS, moduleId)` and throws a
  clear `Unknown module: <id>` error **before** `resetState()` runs or any fetch is issued — so a
  bogus/hostile switch attempt never triggers a real module's reset side effect either. This
  changed the P2-04 executed-order test's expectation: `resetState()` must now NOT run for an
  unregistered moduleId (previously it ran-then-threw; validation now precedes the side effect
  entirely — the more conservative, correct behavior).
- Also hardened with a null prototype (`{ __proto__: null, ... }`), same defense-in-depth pattern
  as finding 1.
- **Evidence**: `tests/module-kb-loaders.test.mjs` — a static source-order assertion
  (`Object.hasOwn` precedes `resetState()` precedes `loader()`), an executed sweep over
  `__proto__`/`constructor`/`toString`/`hasOwnProperty`/`valueOf` confirming rejection with zero
  `resetState()` calls, and a **regression proof**: `Object.prototype.constructor` is polluted
  with a stand-in callable "loader" (tracked via a call counter) inside `try/finally`, and
  `loadModuleKb('constructor', ...)` is asserted to reject with the polluted function never
  invoked.

**Finding 3 — reset-before-fetch proved invocation order, not effect**
(`src/moduleKbLoaders.js:62` + its P2-04 test at review time). A caller passing `() => {}` as
`resetState` satisfied every existing assertion while still violating the actual SQ-3 §4.4 safety
property (rules/candidates genuinely cleared).
- **Fix (a)**: `loadModuleKb`'s JSDoc now states a **BINDING CONTRACT ON THE CALLER** — `resetState`
  MUST synchronously set `rules` to `[]` and `candidates` to `{}` (SQ-3 §4.4) — and explicitly
  distinguishes what this function CAN guarantee (ordering) from what it CANNOT (the reset's
  actual effect), noting P3/P4 wire the real caller and P6-005/P6-012 re-assert the effect at gate
  level against that real wiring.
- **Fix (b)**: `tests/module-kb-loaders.test.mjs` gained a **realistic caller harness** test — real
  `let rules`/`let candidates` variables seeded with module-Y sentinel data, a genuine clearing
  `resetState`, and a rejecting `fetch` for the newly selected module X — asserting the caller's
  OWN post-rejection state is `[]`/`{}`. A companion "no-op reset counter-example" test documents
  the honest contract boundary: a caller-authored no-op `resetState` still leaves stale data in
  place, and that is a caller bug this function's ordering guarantee cannot prevent — made visible
  by an explicit assertion rather than left implicit in a comment.

### Gate re-run after the fix round

- `node --test tests/module-kb-loaders.test.mjs tests/module-eligibility.test.mjs`: **23/23 pass**
  (15 in the loaders file, up from 10; 8 new in the eligibility file).
- `node --test tests/module-status-vocabulary.test.mjs`: **18/18 pass** (re-run after the P1
  `moduleManifests.js` null-prototype edit).
- `npm run build`: exit 0. Asset stamp `324667d7510d` (post-fix build).
- `npm run check:imports`: exit 0.
- `npm run verify:d4`: exit 0.
- `npm run smoke:browser`: exit 0 — 91-rule anemia assessment via `assessPediatricAnemia` still
  correct.
- `npm run smoke`: exit 0.
- All 8 `dist/src/moduleKbLoaders.js` fetch specifiers confirmed `?v=324667d7510d`-stamped
  (grep-verified).
- Manual end-to-end confirmation (`node -e`, ad hoc): `isModuleSelectable('anemia') === true`,
  `isModuleSelectable('__proto__') === false`, `isModuleSelectable('constructor') === false`;
  `loadModuleKb('constructor', ...)` rejects with `Unknown module: constructor` and never calls
  the supplied reset callback.
- `npm test` (full suite): **2628 tests, 2602 pass, 26 fail** — the failing-test-name set is
  byte-identical to the pre-fix-round 26-failure baseline (25 inherited `Finding E-1` failures +
  the 1 `Finding E-2` diff-scope guard tripped by this branch's own Phase 1 commit). **Zero new
  failures from this fix round.**
