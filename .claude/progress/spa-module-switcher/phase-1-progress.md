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
phase: 1
title: "SPA Module Switcher — Phase 1: Manifest Surface + Status Vocabulary"
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
- id: P1-01
  description: >
    src/moduleManifests.js — four literal JSON imports, frozen map (D-2 / FR-12). Create
    src/moduleManifests.js holding exactly four literal import statements — `import anemia from
    '../modules/anemia/module.json' with { type: 'json' };` and the same for cbc_suite_v1,
    growth_suite_v1, kidney_suite_v1 — exported as a single Object.freeze({...}) moduleId-keyed
    map. The browser verifies nothing: verifyManifest() (src/kbVerify.js:203) is not called, no
    digest is recomputed, dist/build-info.json is not read. SQ-2 proved runtime verification is
    impossible in dist/ (clinicalContentHash computed over raw bytes vs. build-static.mjs
    rewriting every .js to append ?v=; measured 49a597cb… dev vs d154a20c… dist). Specifiers
    must be literal — a template-built specifier defeats both ?v= stamping and the per-file
    existence check.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: []
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/moduleManifests.js
  acceptance_criteria: >
    File exists; exactly 4 literal `import … with { type: 'json' }` statements, one per registered
    module id in MODULE_IDS; the exported map is frozen (Object.isFrozen true) and keyed by
    moduleId; zero references to verifyManifest, dist/build-info.json, hashes, or any digest API
    anywhere in the file; no template-literal specifier; the module has no side effects on import.
- id: P1-02
  description: >
    src/moduleStatusVocabulary.js — the single constant module (D-3 / FR-8, FR-13, FR-34, OQ-3).
    Create the ONLY place any clinician-facing status string exists: (a) the four canonical status
    sentences from PRD §6.1.B-1 verbatim (`integrity-recorded` reads "content hashes recorded
    only", never "verified"); (b) the panel header verbatim: "These modules are not peers. Read
    each row."; (c) the FR-13 honesty-boundary sentence verbatim; (d) the FR-34 evidence-staleness
    disclosure verbatim (reuse src/evidenceStalenessPolicy.js:11-14's string, do not retype); (e)
    the FR-10 subtitle "unsigned proposal · not clinically reviewed"; (f) the OQ-3 #rules empty
    state: "This module contains no rules. No assessment can be produced from it."; (g) the FR-9
    clause derived from approvedBy.length === 0 — never hardcoded. Prohibited: any hash reference,
    "integrity verified", "approved", "released", "verified", "preview", "beta", "coming soon",
    "temporarily unavailable", or any success/green severity token. There is NO green state.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: []
  estimated_effort: "1.25 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/moduleStatusVocabulary.js
  acceptance_criteria: >
    All four enum values have exactly one canonical sentence, byte-matching PRD §6.1.B-1;
    integrity-recorded says "recorded", never "verified"; panel header, honesty-boundary sentence,
    staleness disclosure, FR-10 subtitle and OQ-3 empty state all present verbatim; the FR-9 clause
    is computed from approvedBy.length === 0, proven by a test with a hypothetical non-empty
    approvedBy; the staleness string is asserted equal to src/evidenceStalenessPolicy.js:11-14; an
    unknown-status lookup returns a sentinel routing to refusal, never a friendlier default; grep
    of the file for the prohibited token list returns zero hits.
- id: P1-03
  description: >
    Register both new files in APP_SURFACE_FILES. Per PRD NFR / SQ-3 §6 "Required companion
    edit": add src/moduleManifests.js and src/moduleStatusVocabulary.js to APP_SURFACE_FILES in
    scripts/check-app-imports.mjs:48. Pass (a) does not walk the import graph transitively, so an
    unregistered new file goes entirely unchecked.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P1-01, P1-02]
  estimated_effort: "0.25 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - scripts/check-app-imports.mjs
  acceptance_criteria: >
    Both paths appear in APP_SURFACE_FILES; `npm run check:imports` exits 0; a deliberate
    temporary breakage (a bad specifier in src/moduleManifests.js) makes it exit non-zero —
    proving the files are actually covered, not merely listed.
- id: P1-04
  description: >
    Vocabulary unit test (tests/module-status-vocabulary.test.mjs). Assert every value of the
    closed enum has exactly one entry; an unknown status yields the refusal sentinel, never a
    fallback string; the FR-9 clause is derived (feed approvedBy: [] and a synthetic non-empty
    array, assert the output differs); the staleness disclosure equals
    src/evidenceStalenessPolicy.js's string exactly; the prohibited-token grep returns zero hits.
    Scope boundary: this is the UNIT test only — the full doc-truth pin across
    index.html/src/app.js/dist/ is P6-004, not this task.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P1-01, P1-02]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tests/module-status-vocabulary.test.mjs
  acceptance_criteria: >
    Test passes; enum coverage is derived from the schema file, not from a hand-copied list (so a
    future enum addition fails the test rather than passing silently); the derived-vs-hardcoded
    FR-9 assertion is present.
- id: P1-GATE
  description: >
    task-completion-validator gate. Verify the Phase 1 exit gate: npm run check:imports green with
    both files registered; vocabulary unit test passes. Reject if any status string exists outside
    src/moduleStatusVocabulary.js, if integrity-recorded reads "verified", if the FR-9 clause is
    hardcoded, or if either new file imports anything with a side effect.
  status: pending
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P1-01, P1-02, P1-03, P1-04]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
parallelization:
  batch_1: [P1-01, P1-02]
  batch_2: [P1-03, P1-04]
  batch_3: [P1-GATE]
  critical_path: [P1-01, P1-02, P1-04, P1-GATE]
  estimated_total_time: "~0.5–1 engineer-day"
blockers: []
success_criteria:
- id: SC-1
  description: "src/moduleManifests.js: 4 literal `with { type: 'json' }` imports, frozen map, zero verification references"
  status: pending
- id: SC-2
  description: "src/moduleStatusVocabulary.js holds every clinician-facing status string; no string is written anywhere else"
  status: pending
- id: SC-3
  description: "integrity-recorded reads 'content hashes recorded only' — never 'verified' (PRD source-variance note)"
  status: pending
- id: SC-4
  description: "FR-9 approvedBy clause is derived from approvedBy.length === 0, proven by test"
  status: pending
- id: SC-5
  description: "Staleness disclosure is byte-equal to src/evidenceStalenessPolicy.js:11-14's string"
  status: pending
- id: SC-6
  description: "Prohibited-token grep (hash / verified / approved / released / preview / beta / coming soon) returns zero hits"
  status: pending
- id: SC-7
  description: "Both files registered in APP_SURFACE_FILES; coverage proven by a deliberate temporary breakage; npm run check:imports exits 0"
  status: pending
files_modified:
- src/moduleManifests.js
- src/moduleStatusVocabulary.js
- scripts/check-app-imports.mjs
- tests/module-status-vocabulary.test.mjs
notes: >
  Wave 1 (parallel with Phase 0) — no dependencies. Binding constraint for the whole phase: neither
  file introduces behavior. P1 produces two frozen, side-effect-free data modules and nothing else.
  No DOM access, no fetch, no assess(). Phase 2 (P2-01, P2-03) consumes both files directly — do not
  let their shapes drift once Phase 2 opens.
---

# spa-module-switcher — Phase 1: Manifest Surface + Status Vocabulary

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-1-progress.md -t P1-01 -s completed
```

---

## Objective

Ship two frozen, side-effect-free data modules — `src/moduleManifests.js` (four literal JSON
imports keyed by moduleId) and `src/moduleStatusVocabulary.js` (the single constant module holding
every clinician-facing status string, disclosure and empty-state copy) — and register both in the
import-verification gate. No behavior, no DOM access, no `fetch`, no `assess()`.

**Duration**: ~0.5–1 engineer-day · **Dependencies**: None (wave 1, parallel with Phase 0) ·
**Exit gate**: `npm run check:imports` green with both new files registered; a unit test over the
vocabulary map passes.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P1-01 | `src/moduleManifests.js` — four literal JSON imports, frozen map | general-purpose (frontend engineer¹) | sonnet/adaptive | claude | pending | none |
| P1-02 | `src/moduleStatusVocabulary.js` — the single constant module | general-purpose | sonnet/adaptive | claude | pending | none |
| P1-03 | Register both new files in `APP_SURFACE_FILES` | general-purpose | sonnet/adaptive | claude | pending | P1-01, P1-02 |
| P1-04 | Vocabulary unit test | general-purpose | sonnet/adaptive | claude | pending | P1-01, P1-02 |
| P1-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | pending | P1-01..P1-04 |

¹ **Agent-name substitution**: `frontend-developer` is not registered in this project; dispatched as
`general-purpose` with the role descriptor retained.

---

## Orchestration Quick Reference

### Batch 1 (no dependencies)

```
Task("general-purpose", "P1-01: src/moduleManifests.js — four literal JSON imports, frozen map
(D-2/FR-12). Exactly 4 literal `import x from '../modules/<id>/module.json' with { type: 'json'
}` statements, one per MODULE_IDS entry, exported as Object.freeze({...}) keyed by moduleId. The
browser verifies nothing — no verifyManifest(), no digest recompute, no dist/build-info.json
read. No template-literal specifiers. See plan §Phase 1, P1-01.")

Task("general-purpose", "P1-02: src/moduleStatusVocabulary.js — the single constant module
(D-3/FR-8/FR-13/FR-34/OQ-3). Author the four canonical status sentences verbatim from PRD
§6.1.B-1 (integrity-recorded reads 'recorded', never 'verified'), the panel header, the FR-13
honesty-boundary sentence, the FR-34 staleness disclosure (reuse
src/evidenceStalenessPolicy.js's string, do not retype), the FR-10 subtitle, and the OQ-3 #rules
empty-state string. FR-9 clause derived from approvedBy.length === 0, never hardcoded. Zero
prohibited tokens (hash/verified/approved/released/preview/beta/coming soon). See plan §Phase 1,
P1-02.")
```

### Batch 2 (after P1-01, P1-02)

```
Task("general-purpose", "P1-03: Register src/moduleManifests.js and
src/moduleStatusVocabulary.js in APP_SURFACE_FILES (scripts/check-app-imports.mjs:48). Prove
coverage with a deliberate temporary bad-specifier breakage that makes check:imports exit
non-zero, then revert it. See plan §Phase 1, P1-03.")

Task("general-purpose", "P1-04: Vocabulary unit test
(tests/module-status-vocabulary.test.mjs). Assert enum coverage derived from
schemas/module-manifest.schema.json (not hand-copied); unknown status → refusal sentinel; FR-9
clause is derived (test with synthetic non-empty approvedBy); staleness string byte-equal to
src/evidenceStalenessPolicy.js; prohibited-token grep zero hits. Unit-test scope only — P6-004
owns the full doc-truth pin. See plan §Phase 1, P1-04.")
```

### Gate (after all tasks complete)

```
Task("task-completion-validator", "P1-GATE: Verify Phase 1 exit gate for spa-module-switcher —
npm run check:imports green with both files registered; vocabulary unit test passes. Reject if
any status string exists outside src/moduleStatusVocabulary.js, if integrity-recorded reads
'verified', if FR-9 is hardcoded, or if either new file has an import-time side effect.")
```

---

## Quality Gates

- [ ] `src/moduleManifests.js`: 4 literal `with { type: 'json' }` imports, frozen map, zero verification references
- [ ] `src/moduleStatusVocabulary.js` holds **every** clinician-facing status string; no string is written anywhere else
- [ ] `integrity-recorded` reads "content hashes **recorded** only" — never "verified" (PRD source-variance note)
- [ ] FR-9 approvedBy clause is **derived** from `approvedBy.length === 0`, proven by test
- [ ] Staleness disclosure is byte-equal to `src/evidenceStalenessPolicy.js:11-14`'s string
- [ ] Prohibited-token grep (hash / verified / approved / released / preview / beta / coming soon) returns zero hits
- [ ] Both files registered in `APP_SURFACE_FILES` (`scripts/check-app-imports.mjs:48`); coverage proven by a deliberate temporary breakage
- [ ] `npm run check:imports` exits 0

---

## Implementation Notes

### Architectural Decisions

- `src/moduleManifests.js` and `src/moduleStatusVocabulary.js` are the two "truth sources" this
  plan's sequence names before any "seam" (Phase 2) or "presentation" (Phase 3) work begins.
- SQ-2 proved runtime manifest verification is impossible in `dist/` — this phase deliberately
  ships **zero** verification logic, not a stopgap.

### Known Gotchas

- P1-02 is the single highest-leverage file in the whole feature — every later phase (P3 banner,
  P4 refusal copy, P5 degradation copy, P6 doc-truth tests) references it by identifier. Get the
  four canonical sentences byte-exact on the first pass.
- `integrity-recorded`'s sentence must read "recorded", not "verified" — this is a deliberate
  correction of a source-variance note (SQ-1 §4 vs. decisions-block D-3); D-3 is authoritative.
- Do not let P1-04 duplicate P6-004's scope — P1-04 is the **unit** test only.

### Development Setup

Node ≥ 20. Gate before Phase 2 opens (jointly with Phase 0): `npm run check:imports` green +
`task-completion-validator` sign-off on this phase's `P1-GATE`.

---

## Completion Notes

Fill in when Phase 1 is complete: what was built, key learnings, unexpected challenges,
recommendations for Phase 2 (which consumes both files directly).
