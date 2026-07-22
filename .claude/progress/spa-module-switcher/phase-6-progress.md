---
type: progress
schema_version: 2
doc_type: progress
prd: spa-module-switcher
feature_slug: spa-module-switcher
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
phase_detail_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-6-7-gates-docs.md
execution_model: batch-parallel
phase: 6
title: "SPA Module Switcher — Phase 6: Gates & Test Harness (Verification Phase)"
status: pending
created: '2026-07-22'
updated: '2026-07-22'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 12
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
- id: P6-001
  description: >
    Module inventory & grouping test (AC-1). Assert all four registered modules render, grouped
    by selectability: the row set comes from listModules()/MODULE_IDS; display fields come from
    the frozen src/moduleManifests.js map; group membership is computed once by the FR-4
    predicate; the verbatim panel header "These modules are not peers. Read each row." is present.
    Include AC-1 resilience: a manifest missing an optional envelope field renders without
    undefined/empty-label artifacts; a module in MODULE_IDS absent from the manifest map appears
    in the not-selectable group with the FR-17 reason, never dropped.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-03, P5-06]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-registry.test.mjs
  acceptance_criteria: >
    Test passes; the module count assertion is derived from MODULE_IDS, not a hardcoded 4, so a
    fifth registered module fails the test rather than passing silently; both resilience cases
    asserted.
  verifies_ac: [AC-1]
- id: P6-002
  description: >
    tests/module-switcher-eligibility.test.mjs — predicate is imported, never a literal (AC-2).
    Assert READY_STATUS is imported from src/kbVerify.js into the eligibility path, and that the
    literal 'integrity-recorded' appears NOWHERE in src/app.js, src/moduleEligibility.js or
    index.html. Assert the comparison target is moduleManifests[id].status.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-03]
  estimated_effort: "0.25 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-eligibility.test.mjs
  acceptance_criteria: >
    Test passes; a seeded hardcoded 'integrity-recorded' literal in any of the three files makes
    it fail.
  verifies_ac: [AC-2]
- id: P6-003
  description: >
    Eligibility gating — only integrity-recorded reaches assess() (AC-2). Assert the predicate
    result is the sole gate on (a) row activatability and (b) whether MODULE_KB_LOADERS and
    assess() are ever invoked. Structurally block, do not catch: assert assess() is never called
    for an ineligible module (spy/call-count). Include the AC-2 resilience case: a manifest whose
    status is absent or not in the closed enum is treated as ineligible and routed to the FR-17
    refusal — never defaulted to eligible.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-03, P4-04]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-eligibility.test.mjs
  acceptance_criteria: >
    Test passes; assess() call count is 0 for each of the three unsigned-stub modules across
    selection, ?module= deep link, and form submit; absent/out-of-enum status → ineligible.
  verifies_ac: [AC-2]
- id: P6-004
  description: >
    tests/module-switcher-status-labels.test.mjs — doc-truth pin over the vocabulary (AC-3). The
    full doc-truth pin (P1-04 was the unit test; this is the surface pin). Assert: every
    closed-enum status maps to exactly one canonical sentence, byte-matching PRD §6.1.B-1; the
    panel header, the FR-13 honesty-boundary sentence and the FR-34 staleness disclosure are
    exported from src/moduleStatusVocabulary.js and referenced by identifier in src/app.js; no
    status text is written inline in index.html or src/app.js. Resilience case: a status value
    with no vocabulary entry fails the build. Pin the R-1 group headers here too.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P1-02, P3-04]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-status-labels.test.mjs
  acceptance_criteria: >
    Test passes; enum coverage derived from schemas/module-manifest.schema.json, not a
    hand-copied list; a seeded inline status string in index.html or src/app.js fails the test; a
    seeded enum value with no vocabulary entry fails the test.
  verifies_ac: [AC-3]
- id: P6-005
  description: >
    Four refusal-case tests (AC-4). One test per SQ-3 §4 case: (1) evidence registry has no entry
    → refusal named; (2) hooks not-implemented, detected before render, renderClassification never
    invoked; (3) manifest status ≠ READY_STATUS, verbatim enum status shown, not downgraded to a
    warning; (4) KB fetch 404, rules/candidates reset to []/{} BEFORE the fetch. Every case
    asserts the FR-19 invariants and asserts NONE routes through INPUT_REJECTION_CODES or renders
    "Check the entered units". Include the AC-4 resilience case (prior result cleared before the
    refusal renders; audit download disabled in the same tick) — the P4-06 seam re-asserted at
    gate level.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01, P4-02, P4-03, P4-04, P4-05, P4-06, P4-07]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-eligibility.test.mjs
  acceptance_criteria: >
    All four tests pass; each asserts the full invariant set; a spy confirms showInputRejection is
    never called on any of the four paths; no "undefined g/dL" or false Indeterminate appears in
    case 2.
  verifies_ac: [AC-4]
- id: P6-006
  description: >
    ?module= URL-state round-trip test (AC-5). Assert: ?module= is read on load and validated with
    isRegisteredModule(); absent → DEFAULT_MODULE_ID; selection writes it back via
    history.replaceState preserving the #tab hash; switchTab's replaceState (src/app.js:457)
    preserves the query string (R-7 — the specific regression this test exists for); unregistered
    or ineligible → explicit refusal naming the requested id, no silent substitution; and no
    localStorage/sessionStorage/cookie is read or written.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-05, P3-06, P4-07]
  estimated_effort: "0.25 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-eligibility.test.mjs
  acceptance_criteria: >
    Test passes; a tab switch with ?module=cbc_suite_v1 present leaves the query string intact;
    grep assertion for the three storage APIs across app-surface files returns zero hits.
  verifies_ac: [AC-5]
- id: P6-007
  description: >
    Module-scoped degradation & module-derived copy tests (AC-6, AC-7). AC-6: the active moduleId
    is the single input to the degradation decision for #algorithm (FR-25), #evidence (FR-26), the
    #rules empty state (FR-27) and the examples picker (FR-28); nav counts come from the loaded
    module's own rules/candidates and index.html:66's static 91/26 is neutralized (FR-29). AC-7:
    manifest.title drives document.title, <h1>, brand and footer; document.title must not carry
    anemia's KNOWLEDGE_BASE_VERSION under another module (F11); a missing manifest.title renders
    the moduleId verbatim, never a generic "Assessment".
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P5-01, P5-02, P5-03, P5-04, P5-05, P5-06]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-status-labels.test.mjs
  acceptance_criteria: >
    Both tests pass; each of the four surfaces is asserted under all three scaffold modules;
    index.html contains neither 91 nor 26 as a count fallback.
  verifies_ac: [AC-6, AC-7]
- id: P6-008
  description: >
    Negative-assertion test — no integrity, approval or release claim anywhere (AC-8,
    FR-31/FR-32/FR-33). Scan index.html, src/app.js, src/moduleStatusVocabulary.js, styles.css AND
    the built dist/ HTML for prohibited tokens: any sha256: fragment; hashes.recomputed; "integrity
    verified"; "content unmodified"; "approved" other than inside the negating FR-9 phrase;
    "clinically reviewed" other than inside a negating phrase; "released"; "validated" other than
    inside "not clinically validated"; and any success/green status class. Resilience: the
    assertion is on rendered output and source text, not on data availability.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-04, P5-06]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-status-labels.test.mjs
  acceptance_criteria: >
    Test passes over source AND dist/; a seeded sha256: fragment in any scanned file fails it; the
    negating-phrase carve-outs are exact, not substring-loose.
  verifies_ac: [AC-8]
- id: P6-009-smoke
  description: >
    EXTEND scripts/smoke-browser-unit-rejection.mjs — runtime smoke over every touched UI surface
    (AC-9, R-P4, R-3). Extend, do not rewrite. Retain :132, :134, :179, :188 and :216-223 by
    keeping assessPediatricAnemia exported with its anemia call shape (delivered in P2-02). Extend
    :179/:188 to also accept the module-generic assessModule(currentModuleId, input, rules,
    candidates) call. Add a sibling assertion block for the module-refusal UI mirroring the
    existing AGE_OUT_OF_SUPPORTED_RANGE block at :167-173. The smoke run must exercise: default
    load, module switch to an ineligible module, refusal render, and tab switch with ?module=
    present. Resilience: the dist/ scan for unstamped fetch specifiers must pass against the FR-36
    literal map. Capture smoke-run screenshots for default load and refusal state at ≥1440px.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-02, P4-01, P5-06]
  estimated_effort: "0.75 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - scripts/smoke-browser-unit-rejection.mjs
  acceptance_criteria: >
    npm run smoke:browser green; git diff scripts/smoke-browser-unit-rejection.mjs shows additive
    change only — no existing assertion at :132, :134, :179, :188 or :216-223 deleted or weakened;
    the four smoke scenarios all execute; the dist unstamped-fetch scan passes; screenshots
    captured.
  verifies_ac: [AC-9]
- id: P6-010
  description: >
    Import verification for new surfaces + deliberate DEFAULT_MODULE_ID tripwire decision (AC-10,
    R-6). Two halves. (a) Confirm src/moduleManifests.js, src/moduleStatusVocabulary.js,
    src/moduleKbLoaders.js and src/moduleEligibility.js are all in APP_SURFACE_FILES, and that all
    8 MODULE_KB_LOADERS specifiers resolve in both dev and dist layouts and are ?v=-stamped. (b)
    DELIBERATELY decide tests/module-registry.test.mjs:24's DEFAULT_MODULE_ID === 'anemia'
    tripwire — this feature fires it. Decision: DEFAULT_MODULE_ID stays 'anemia' (it is now the
    initial selection, not the only one; no module status changed). Update the test comment AND
    the registry comment citing E1 FR-14/R-8 and ADR-0009 explicitly. The commit message must cite
    both as well. This is a governance decision, not a mechanical edit.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P1-03, P2-01, P2-03, P2-05, P0-02]
  estimated_effort: "0.5 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - scripts/check-app-imports.mjs
  - tests/module-registry.test.mjs
  - src/modules/registry.js
  acceptance_criteria: >
    npm run check:imports exits 0 with all four new files covered and 8 specifiers verified
    dev+dist; tests/module-registry.test.mjs passes with an updated comment citing E1 FR-14/R-8
    and ADR-0009 by ID; src/modules/registry.js:38-50's comment updated to record that the trigger
    fired and how it was decided; the commit message cites both.
  verifies_ac: [AC-10]
- id: P6-GATE
  description: >
    task-completion-validator gate. Verify the Phase 6 exit gate: FULL npm run check green (all 8
    sub-gates). Confirm every PRD §11 verified_by ID (P6-001..P6-010, P6-009-smoke) exists and
    passes, and that AC-1..AC-10's visual_evidence_required screenshots were captured. Reject if
    smoke-browser-unit-rejection.mjs was rewritten rather than extended, or if any pre-existing
    assertion was weakened to make a new one pass.
  status: pending
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P6-001, P6-002, P6-003, P6-004, P6-005, P6-006, P6-007, P6-008, P6-009-smoke, P6-010]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: P6-KAREN
  description: >
    karen milestone review (Milestone 3). Independent review of the verification phase. Verify:
    (1) the smoke gate was EXTENDED, not rewritten — diff-check that all five original assertion
    sites survive intact; (2) the DEFAULT_MODULE_ID tripwire was flipped deliberately, with E1
    FR-14/R-8 and ADR-0009 cited in the test comment, the registry comment AND the commit message
    (R-6); (3) no test was made to pass by weakening a prior assertion; (4) the negative-assertion
    test's carve-outs are exact rather than substring-loose, so a bare "approved" cannot slip
    through.
  status: pending
  assigned_to: [karen]
  provider: claude
  dependencies: [P6-GATE]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  acceptance_criteria: >
    Milestone review recorded; findings fixed in-phase or logged to
    .claude/findings/spa-module-switcher-findings.md.
parallelization:
  batch_1: [P6-001, P6-002, P6-004, P6-006, P6-008]
  batch_2: [P6-003, P6-005, P6-007, P6-009-smoke, P6-010]
  batch_3: [P6-GATE]
  batch_4: [P6-KAREN]
  critical_path: [P6-005, P6-009-smoke, P6-GATE, P6-KAREN]
  estimated_total_time: "~2 engineer-days"
blockers:
- id: BLOCKER-PHASE-DEP
  title: "Phase 6 cannot open until Phase 4 (P4-GATE, P4-KAREN) AND Phase 5 (P5-GATE) exit gates all pass"
  severity: high
  blocking: [P6-005, P6-009-smoke]
  resolution: >
    Wait for .claude/progress/spa-module-switcher/phase-4-progress.md P4-GATE + P4-KAREN and
    .claude/progress/spa-module-switcher/phase-5-progress.md P5-GATE to all complete.
  created: '2026-07-22'
success_criteria:
- id: SC-1
  description: "Full npm run check green (test, validate, coverage:rules, build, verify:d4, check:imports, smoke:browser, smoke)"
  status: pending
- id: SC-2
  description: "Every PRD §11 verified_by ID exists and passes: P6-001..P6-010, P6-009-smoke"
  status: pending
- id: SC-3
  description: "smoke-browser-unit-rejection.mjs extended, not rewritten; all five original assertion sites intact (R-3)"
  status: pending
- id: SC-4
  description: "assess() call count is 0 for all three unsigned-stub modules across every entry path"
  status: pending
- id: SC-5
  description: "Doc-truth test pins the vocabulary, panel header, honesty boundary, staleness disclosure and group headers"
  status: pending
- id: SC-6
  description: "Negative-assertion test covers source and built dist/; carve-outs exact, not substring-loose"
  status: pending
- id: SC-7
  description: "All four new app-surface files in APP_SURFACE_FILES; all 8 specifiers verified dev+dist and ?v=-stamped"
  status: pending
- id: SC-8
  description: "DEFAULT_MODULE_ID tripwire decided deliberately, citing E1 FR-14/R-8 + ADR-0009 in test comment, registry comment and commit"
  status: pending
- id: SC-9
  description: "AC-1/AC-3/AC-4/AC-6/AC-7/AC-8/AC-9 screenshots captured at ≥1440px (and 375px for AC-1)"
  status: pending
- id: SC-10
  description: "karen Milestone 3 review recorded"
  status: pending
files_modified:
- tests/module-switcher-status-labels.test.mjs
- tests/module-switcher-eligibility.test.mjs
- tests/module-registry.test.mjs
- scripts/smoke-browser-unit-rejection.mjs
- scripts/check-app-imports.mjs
notes: >
  Wave 6 — depends on Phase 4 (both gates) AND Phase 5. This phase owns EVERY `verified_by` ID in
  PRD §11 — task IDs use the PRD's own P6-001..P6-010 / P6-009-smoke numbering verbatim so the
  ACs' verified_by references resolve. **The R-3 constraint, binding on the whole phase**:
  scripts/smoke-browser-unit-rejection.mjs greps src/app.js source text at :132,:134,:179,:188,
  :216-223 — extend, never rewrite. `npm run check` is authoritative and copied verbatim from
  package.json's scripts.check: `npm test && npm run validate && npm run coverage:rules && npm
  run build && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run
  smoke`. Effort is `extended` on every implementer task — gate surgery on a source-grepping
  smoke test.
---

# spa-module-switcher — Phase 6: Gates & Test Harness (Verification Phase)

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-6-progress.md -t P6-001 -s completed
```

---

## Objective

Own every `verified_by` ID in PRD §11: ten tests/checks (`P6-001`..`P6-010`) plus one extended
runtime smoke (`P6-009-smoke`) proving the whole feature's AC-1..AC-10. This is Milestone 3 of 3
named `karen` reviews, and the phase where `npm run check` must go fully green.

**Duration**: ~2 engineer-days · **Dependencies**: Phase 4 and Phase 5 complete (wave 6) ·
**Assigned Subagent(s)**: `task-completion-validator` **drives** the phase; frontend engineer
implements; **`karen` milestone review** at exit · **Effort**: `extended` — gate surgery on a
source-grepping smoke test · **Exit gate**: full `npm run check` green.

### The R-3 constraint, stated once, binding on the whole phase

`scripts/smoke-browser-unit-rejection.mjs` **greps `src/app.js` source text**. Breaking assertions:
`:132` (`import { assessPediatricAnemia } from './engine.js'`), `:134` (same against
`algorithmExplorer.js`), `:179`/`:188` (`assessPediatricAnemia(input, rules, candidates)` call
shape), `:216-223` (dist import + classification assertion). **Extend, never rewrite.**

---

## Task Tracking

| Task ID | Name | AC | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|----|-----------------------|--------------|----------|--------|---------------|
| P6-001 | Module inventory & grouping test | AC-1 | general-purpose (frontend engineer¹) | sonnet/extended | claude | pending | P3-03, P5-06 |
| P6-002 | Eligibility predicate imported, never literal | AC-2 | general-purpose | sonnet/extended | claude | pending | P2-03 |
| P6-003 | Eligibility gating — only integrity-recorded reaches `assess()` | AC-2 | general-purpose | sonnet/extended | claude | pending | P2-03, P4-04 |
| P6-004 | Status-labels doc-truth pin | AC-3 | general-purpose | sonnet/extended | claude | pending | P1-02, P3-04 |
| P6-005 | Four refusal-case tests | AC-4 | general-purpose | sonnet/extended | claude | pending | P4-01..P4-07 |
| P6-006 | `?module=` URL-state round-trip test | AC-5 | general-purpose | sonnet/extended | claude | pending | P3-05, P3-06, P4-07 |
| P6-007 | Module-scoped degradation + module-derived copy tests | AC-6, AC-7 | general-purpose | sonnet/extended | claude | pending | P5-01..P5-06 |
| P6-008 | Negative-assertion test (no integrity/approval/release claim) | AC-8 | general-purpose | sonnet/extended | claude | pending | P3-04, P5-06 |
| P6-009-smoke | **Extend** `smoke-browser-unit-rejection.mjs` | AC-9 | general-purpose | sonnet/extended | claude | pending | P2-02, P4-01, P5-06 |
| P6-010 | Import verification + deliberate `DEFAULT_MODULE_ID` tripwire | AC-10 | general-purpose | sonnet/extended | claude | pending | P1-03, P2-01, P2-03, P2-05, P0-02 |
| P6-GATE | `task-completion-validator` gate | — | task-completion-validator | sonnet/adaptive | claude | pending | P6-001..P6-010 |
| P6-KAREN | **`karen` milestone review (Milestone 3)** | — | karen | sonnet/extended | claude | pending | P6-GATE |

¹ **Agent-name substitution**: `frontend-developer` is not registered in this project; dispatched
as `general-purpose` with the role descriptor retained.

---

## Orchestration Quick Reference

### Batch 1 (after Phase 4 + Phase 5 gates)

```
Task("general-purpose", "P6-001: Module inventory & grouping test (AC-1). Row set from
listModules()/MODULE_IDS (derived, not hardcoded 4); display fields from frozen
src/moduleManifests.js; group membership from FR-4 predicate; verbatim panel header present.
Resilience: missing optional field → no undefined; MODULE_IDS entry absent from manifest map →
not-selectable group with FR-17 reason. See plan §Phase 6, P6-001.")

Task("general-purpose", "P6-002: tests/module-switcher-eligibility.test.mjs — predicate
imported, never literal (AC-2). Assert READY_STATUS imported from src/kbVerify.js; zero
'integrity-recorded' literal hits across src/app.js, src/moduleEligibility.js, index.html. See
plan §Phase 6, P6-002.")

Task("general-purpose", "P6-004: tests/module-switcher-status-labels.test.mjs — doc-truth pin
(AC-3). Every closed-enum status → exactly one canonical sentence byte-matching PRD §6.1.B-1; no
inline status text; missing vocabulary entry fails the build. Pin R-1 group headers too. See
plan §Phase 6, P6-004.")

Task("general-purpose", "P6-006: ?module= URL-state round-trip test (AC-5). Read/validate on
load; write-back preserves #tab hash; switchTab's replaceState preserves query string (R-7);
unregistered/ineligible → explicit refusal; zero storage-API hits. See plan §Phase 6, P6-006.")

Task("general-purpose", "P6-008: Negative-assertion test — no integrity/approval/release claim
anywhere (AC-8). Scan source AND built dist/ HTML for prohibited tokens with exact
negating-phrase carve-outs. See plan §Phase 6, P6-008.")
```

### Batch 2 (after batch 1 dependencies / P4/P5 case work)

```
Task("general-purpose", "P6-003: Eligibility gating — only integrity-recorded reaches assess()
(AC-2). assess() call count 0 for all 3 unsigned-stub modules across selection/deep-link/submit;
absent/out-of-enum status → ineligible, never eligible-by-default. See plan §Phase 6, P6-003.")

Task("general-purpose", "P6-005: Four refusal-case tests (AC-4). One test per SQ-3 §4 case;
each asserts full FR-19 invariant set; spy confirms showInputRejection never called; re-assert
the P4-06 seam (prior result cleared before refusal, audit disabled same tick). See plan §Phase
6, P6-005.")

Task("general-purpose", "P6-007: Module-scoped degradation + module-derived copy tests (AC-6,
AC-7). All 4 degradation surfaces asserted under all 3 scaffolds; document.title never carries
anemia's KNOWLEDGE_BASE_VERSION under another module. See plan §Phase 6, P6-007.")

Task("general-purpose", "P6-009-smoke: EXTEND scripts/smoke-browser-unit-rejection.mjs (AC-9,
R-P4, R-3). Retain :132,:134,:179,:188,:216-223 verbatim. Extend :179/:188 for assessModule call
shape. Add sibling refusal-UI assertion block mirroring AGE_OUT_OF_SUPPORTED_RANGE. Exercise
default load, ineligible switch, refusal render, tab switch with ?module=. Capture screenshots.
git diff must be additive-only. See plan §Phase 6, P6-009-smoke.")

Task("general-purpose", "P6-010: Import verification + DELIBERATE DEFAULT_MODULE_ID tripwire
decision (AC-10, R-6). Confirm 4 new files in APP_SURFACE_FILES, 8 specifiers dev+dist ?v=
verified. Decide DEFAULT_MODULE_ID stays 'anemia' — cite E1 FR-14/R-8 and ADR-0009 in the test
comment, the registry comment, AND the commit message. This is a governance decision, not a
mechanical pass-the-assertion edit. See plan §Phase 6, P6-010.")
```

### Gate + Milestone (after all tasks complete)

```
Task("task-completion-validator", "P6-GATE: Verify Phase 6 exit gate for spa-module-switcher —
FULL npm run check green (all 8 sub-gates). Confirm every PRD §11 verified_by ID exists and
passes; confirm AC screenshots captured. Reject if the smoke script was rewritten rather than
extended, or if any pre-existing assertion was weakened.")

Task("karen", "P6-KAREN: Milestone 3 review of the verification phase for
spa-module-switcher. Verify: (1) smoke gate extended not rewritten — diff-check all five
original sites intact; (2) DEFAULT_MODULE_ID tripwire flipped deliberately with E1 FR-14/R-8 +
ADR-0009 cited in test comment, registry comment, and commit; (3) no test passed by weakening a
prior assertion; (4) negative-assertion carve-outs exact, not substring-loose.")
```

---

## Quality Gates

- [ ] Full `npm run check` green (test, validate, coverage:rules, build, verify:d4, check:imports, smoke:browser, smoke)
- [ ] Every PRD §11 `verified_by` ID exists and passes: `P6-001`..`P6-010`, `P6-009-smoke`
- [ ] `smoke-browser-unit-rejection.mjs` **extended, not rewritten**; all five original assertion sites intact (R-3)
- [ ] `assess()` call count is 0 for all three `unsigned-stub` modules across every entry path
- [ ] Doc-truth test pins the vocabulary, panel header, honesty boundary, staleness disclosure and group headers
- [ ] Negative-assertion test covers source **and** built `dist/`; carve-outs exact, not substring-loose
- [ ] All four new app-surface files in `APP_SURFACE_FILES`; all 8 specifiers verified dev+dist and `?v=`-stamped
- [ ] `DEFAULT_MODULE_ID` tripwire decided deliberately, citing E1 FR-14/R-8 + ADR-0009 in test comment, registry comment and commit
- [ ] AC-1/AC-3/AC-4/AC-6/AC-7/AC-8/AC-9 screenshots captured at ≥1440px (and 375px for AC-1)
- [ ] `karen` Milestone 3 review recorded

---

## Implementation Notes

### Architectural Decisions

- This phase's task IDs are pinned to the PRD's own numbering (`P6-001`..`P6-010`,
  `P6-009-smoke`) so every `verified_by` reference in PRD §11 resolves without translation.
- `P6-010`'s `DEFAULT_MODULE_ID` decision is a **governance decision**, not a mechanical edit — it
  must cite ADR-0009 (Phase 0) and E1 FR-14/R-8 in three separate places (test comment, registry
  comment, commit message).

### Known Gotchas

- **R-3 is the single highest-likelihood risk in the whole plan** — a refactor of
  `smoke-browser-unit-rejection.mjs` that "simplifies" or rewrites it silently deletes the SPA's
  only regression guard. `P6-009-smoke`'s diff must be additive-only.
- Do not let `P6-010`'s tripwire decision become a rubber-stamp — `karen`'s Milestone 3 review
  exists specifically because "it is easy to just make the assertion pass" (R-6).
- The negative-assertion test (`P6-008`) needs **exact** negating-phrase carve-outs — a
  substring-loose match would let a bare "approved" slip through inside unrelated prose.

### Development Setup

Node ≥ 20. Gate before Phase 7 opens: `task-completion-validator` sign-off (`P6-GATE`) + `karen`
Milestone 3 sign-off (`P6-KAREN`) — **both** required.

---

## Completion Notes

Fill in when Phase 6 is complete: what was built, key learnings, unexpected challenges,
recommendations for Phase 7 (documentation finalization).
