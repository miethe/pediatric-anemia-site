---
title: "Implementation Plan: Platform Foundation Refactor (Phase 0)"
schema_version: 2
doc_type: implementation_plan
status: completed
created: 2026-07-17
updated: 2026-07-18
feature_slug: "platform-foundation-p0"
feature_version: "v1"
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
plan_ref: null
scope: "Extract a module-agnostic rules runtime and modules/<id>/ package boundary out of the anemia-specific engine/facts/range code, with zero clinical behavior change, proven by a permanent golden-output equivalence harness."
effort_estimate: "17 pts"
architecture_summary: "modules/anemia/ becomes the first registered module against a new modules/<id>/ package contract; src/facts.js, src/referenceRanges.js, and assessPediatricAnemia become 1-line shims over new src/facts/registry.js, src/ranges/registry.js, and src/engine.js's generalized assess(input, moduleId, rules, candidates); src/ruleEngine.js is untouched."
related_documents:
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  - .claude/worknotes/platform-foundation-p0/decisions-block.md
  - .claude/worknotes/platform-foundation-p0/estimation-sanity.md
references:
  user_docs: []
  context: []
  specs:
    - schemas/rule.schema.json
    - schemas/candidate.schema.json
  related_prds: []
spike_ref:
  - docs/project_plans/SPIKEs/spike-001-module-package-boundary.md
  - docs/project_plans/SPIKEs/spike-002-multi-module-loader.md
adr_refs: []
deferred_items_spec_refs:
  - docs/project_plans/design-specs/evidence-dual-source-unification.md
  - docs/project_plans/design-specs/tri-state-fact-model.md
  - docs/project_plans/design-specs/exact-passage-evidence-schema.md
  - docs/project_plans/design-specs/signed-kb-manifest.md
  - docs/project_plans/design-specs/module-manifest-json-schema.md
  - docs/project_plans/design-specs/public-moduleid-api-surface.md
  - docs/project_plans/design-specs/algorithm-explainers-examples-relocation.md
  - docs/project_plans/design-specs/headless-browser-runtime-smoke-check.md
findings_doc_ref: null
charter_ref: null
changelog_ref: null
changelog_required: false
test_plan_ref: null
plan_structure: unified
progress_init: auto
owner: nick
contributors: []
priority: P0
risk_level: medium
category: "product-planning"
tags: [implementation, refactor, platform, module-architecture, phase-0]
milestone: null
commit_refs:
  - b808b95  # P1 golden harness + relocation
  - 5f9bf62  # P2 facts registry
  - f26d63c  # P3 engine generalization
  - a01971d  # P4 ranges registry
  - d9cfd1e  # P5 scripts/server multi-module
  - 741f35f  # P6 manifest stub
pr_refs: []
files_affected:
  - src/facts.js
  - src/facts/core.js
  - src/facts/registry.js
  - src/engine.js
  - src/referenceRanges.js
  - src/ranges/registry.js
  - src/evidence.js
  - src/ruleEngine.js
  - src/modules/registry.js
  - src/app.js
  - server.mjs
  - scripts/validate-kb.mjs
  - scripts/build-static.mjs
  - scripts/smoke-test.mjs
  - scripts/capture-golden.mjs
  - modules/anemia/module.json
  - modules/anemia/index.js
  - modules/anemia/facts.anemia.js
  - modules/anemia/ranges.js
  - modules/anemia/rules.json
  - modules/anemia/candidates.json
  - modules/anemia/evidence.json
  - modules/anemia/reference-ranges.json
  - tests/golden/*.json
  - tests/module-equivalence.test.mjs
  - tests/module-registry.test.mjs
  - scripts/check-app-imports.mjs
  - modules/anemia/README.md
  - package.json
  - docs/project_plans/design-specs/*.md
  - docs/architecture.md
  - CLAUDE.md
wave_plan:
  serialization_barriers:
    - src/modules/registry.js
  phases:
    - id: P1
      depends_on: []
      isolation: shared
      parallelizable: false
      provider: claude
      files_affected:
        - modules/anemia/rules.json
        - modules/anemia/candidates.json
        - modules/anemia/evidence.json
        - modules/anemia/reference-ranges.json
        - tests/golden/*.json
        - tests/module-equivalence.test.mjs
        - scripts/capture-golden.mjs
        - server.mjs
        - scripts/validate-kb.mjs
        - scripts/build-static.mjs
        - scripts/smoke-test.mjs
        - src/app.js
        - tests/engine.test.mjs
    - id: P2
      depends_on: [P1]
      isolation: shared
      provider: claude
      files_affected:
        - src/facts/core.js
        - src/facts/registry.js
        - modules/anemia/facts.anemia.js
        - src/facts.js
    - id: P3
      depends_on: [P2]
      isolation: shared
      provider: claude
      files_affected:
        - src/modules/registry.js
        - modules/anemia/index.js
        - src/engine.js
    - id: P4
      depends_on: [P3]
      isolation: shared
      parallelizable: true
      provider: claude
      files_affected:
        - src/ranges/registry.js
        - modules/anemia/ranges.js
        - src/referenceRanges.js
        - modules/anemia/facts.anemia.js
    - id: P5
      depends_on: [P3]
      isolation: shared
      parallelizable: true
      provider: claude
      files_affected:
        - src/modules/registry.js
        - scripts/validate-kb.mjs
        - scripts/build-static.mjs
        - scripts/smoke-test.mjs
        - server.mjs
        - tests/module-registry.test.mjs
    - id: P6
      depends_on: [P5]
      isolation: shared
      provider: claude
      files_affected:
        - modules/anemia/module.json
        - scripts/validate-kb.mjs
        - tests/module-registry.test.mjs
    - id: P7
      depends_on: [P4, P6]
      isolation: shared
      provider: claude
      files_affected:
        - docs/architecture.md
        - CLAUDE.md
        - docs/project_plans/design-specs/*.md
  waves:
    - [P1]
    - [P2]
    - [P3]
    - [P4, P5]
    - [P6]
    - [P7]
---

# Implementation Plan: Platform Foundation Refactor (Phase 0)

**Plan ID**: `IMPL-2026-07-17-platform-foundation-p0`
**Date**: 2026-07-17
**Author**: implementation-planner agent (sonnet), expanding an Opus-authored decisions block
**Human Brief**: N/A — not created; this plan and `.claude/worknotes/platform-foundation-p0/estimation-sanity.md` are the full record
**Related Documents**:
- **PRD**: `docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md`
- **Decisions Block**: `.claude/worknotes/platform-foundation-p0/decisions-block.md` (binding phase boundaries, risk hotspots, model routing)
- **SPIKEs**: `docs/project_plans/SPIKEs/spike-001-module-package-boundary.md`, `docs/project_plans/SPIKEs/spike-002-multi-module-loader.md`

**Complexity**: Large (structural, cross-cutting, zero-behavior-change refactor)
**Total Estimated Effort**: 17 pts
**Provider**: claude for all tasks (no external model routing needed — no UI design, no web research in this phase; decisions block §6).

## Executive Summary

Extract the anemia-specific rules runtime (`src/facts.js`, `src/engine.js`, `src/referenceRanges.js`)
into a module-agnostic platform, with `modules/anemia/` proving the new `modules/<id>/` package contract
against real content. A permanent golden-fixture equivalence harness (`tests/golden/*.json` +
`tests/module-equivalence.test.mjs`), captured **before any code moves** (P1), is the safety net every
subsequent phase's exit gate re-runs. Seven phases land serially on the critical path
(P1→P2→P3→P5→P7), with P4 (range registry) running in parallel with P5 (scripts/server generalization)
after P3 lands, and P6 (manifest stub) slotting after P5. Success is entirely equivalence-based: byte-
identical `assess()` output for all 6 worked examples and a green `npm run check` at every phase
boundary — no clinical content is added, removed, or edited.

## Implementation Strategy

### Architecture Sequence

This is not a layered CRUD feature; the sequence follows the call-graph layers the refactor touches,
outward from the safety net:

1. **Equivalence harness + package contract** (P1) — must exist before anything moves.
2. **Fact-derivation layer** (P2) — `deriveFacts` split.
3. **Engine orchestration layer** (P3) — `assess()` generalization; depends on P2's fact registry.
4. **Reference-range layer** (P4) — parallel with P5; depends on P3's module registry (`getModule`).
5. **Multi-module script/server layer** (P5) — parallel with P4; depends on P3's `assess()` signature (soft prerequisite per SPIKE-002 OQ-002).
6. **Manifest layer** (P6) — depends on P5 landing first to avoid version-metadata churn colliding with the script/server diff.
7. **Verification & docs** (P7) — full V2 gate re-run, architecture docs, deferred-items design specs.

### Parallel Work Opportunities

**P4 ∥ P5** after P3: file ownership is disjoint (`src/ranges/*` + `modules/anemia/ranges.js` vs.
`scripts/*` + `server.mjs` + `tests/module-registry.test.mjs`). Both gate independently on the same
golden-output harness. `src/modules/registry.js` is a **serialization barrier** — P3 creates it (engine-
facing `getModule`/`listModules` API) and P5 *extends* it (enumeration/loader API) — see Sequencing Note
2 below; because P5 only starts after P3 completes, this is not a same-wave collision.

### Critical Path

**P1 → P2 → P3 → P5 → P7.** P4 and P6 are off the critical path (P4 feeds P7 directly; P6 sits between
P5 and P7 but is only 1 pt) — neither determines the overall timeline as long as they start promptly
after their dependency lands.

### Sequencing Notes (binding — carry into every phase's task prompts)

These resolve real gaps between the two SPIKEs' independently-authored designs and the decisions
block's phase ordering. They are not scope changes; they are execution-order clarifications a phase
executor needs so a literal reading of one SPIKE doesn't break another phase. See also **Inconsistencies
& Conflicts Found** at the end of this document.

1. **P1 must update the 6 hard-coded KB-JSON read-paths, not just relocate the files.** `git mv`-ing
   `data/{rules,candidates,evidence,reference-ranges}.json` into `modules/anemia/` breaks every current
   consumer unless their literal paths change in the same phase: `server.mjs` (2 reads),
   `scripts/validate-kb.mjs` (2 reads), `scripts/build-static.mjs` (3 reads), `tests/engine.test.mjs` (2
   reads), `src/app.js` (2 `fetch()` calls), `scripts/smoke-test.mjs` (1 path-check string). P1-T3 does
   this as a **mechanical literal-path swap only** (`data/x.json` → `modules/anemia/x.json`) — no
   registry/iteration logic. P5 later *replaces* these literals with `MODULE_IDS`-driven iteration; P1's
   swap is what keeps `npm run check` green in the interim, satisfying AC-2's "green at every phase
   boundary."
2. **`src/modules/registry.js` is authored in P3, then extended (not replaced) in P5.** SPIKE-001 RQ3
   specifies `getModule(id)`/`listModules()` (returns the full module hook object, statically imports
   `modules/anemia/index.js`, consumed synchronously by `engine.js`'s `assess()`). SPIKE-002 Q1
   specifies `MODULE_IDS`/`DEFAULT_MODULE_ID`/`MODULE_CODE_LOADERS`/`loadModuleCode()`/
   `isRegisteredModule()` (enumeration + async code-loader, consumed by scripts/server/tests). Both
   target the same file path. P3-T1 creates the file with SPIKE-001's API only (it's the immediate
   dependency for P3's `assess()`); P5-T1 adds SPIKE-002's exports **additively** to the same file. A
   phase executor working from FR-5 alone must not overwrite P3's `getModule`/`listModules` exports.
3. **`modules/anemia/facts.anemia.js` imports `src/referenceRanges.js` (unchanged) until P4, not
   `src/ranges/registry.js`.** SPIKE-001 RQ2's target file tree shows the final end-state import
   (`../../src/ranges/registry.js`), but that file doesn't exist until P4, which runs *after* P2 (facts
   split) on the critical path. P2-T2 moves `deriveFacts`'s body into `facts.anemia.js` importing from
   `../../src/referenceRanges.js` exactly as `src/facts.js` does today (no functional change yet); P4-T3
   is the task that rewires this one import line to `../../modules/anemia/ranges.js`'s composition
   wrapper, once it exists, and re-verifies golden equivalence.
4. **`modules/anemia/index.js`'s `manifest` literal precedes `module.json`, not the reverse.** SPIKE-001
   RQ3 describes `index.js`'s inline `manifest` object as "mirroring, not fetching, `module.json`" — but
   `module.json` is a P6 deliverable, landing after P3. P3-T2 hardcodes the manifest literal's three
   fields (`engineLabel`, `knowledgeBaseVersion`, `evidenceReviewedThrough`) to match today's
   `src/evidence.js` exported consts directly; P6-T1 authors `module.json` to match those same values,
   and P6-T2's drift check cross-verifies all three sources (`evidence.js` consts, `index.js` manifest
   literal, `module.json`) stay byte-consistent.
5. **`tests/module-registry.test.mjs`'s manifest-shape assertion is added in P6, not P5.** SPIKE-002 Q5
   lists 5 assertions as if authored together in WP5, but assertion 2 (manifest-shape: `module.json`
   exists/parses/`manifest.id === id`) has a hard dependency on `module.json`, which doesn't exist until
   P6. P5-T6 creates the test file with assertions 1, 3, 4, 5 only (registry completeness, per-module KB
   file parseability, code-loader resolution, existing-test-untouched anchor); P6-T3 extends the same
   file with assertion 2.
6. **`GET /api/v1/knowledge-base` / `POST /api/v1/assess` carry no `moduleId` request surface.**
   SPIKE-002 Q4 designed an optional `?moduleId=` query param, a request-body `moduleId` field, a `400`
   error path for unknown ids, and a `meta.moduleId` echo in the response. The PRD's binding OQ-2
   resolution (Opus arbitration, overriding SPIKE-002) forbids all of this in P0 — see **Inconsistency
   #3** below. P5-T4/T5 implement only the additive, unconditional `modules: {...}` discovery key in the
   unscoped `GET /api/v1/knowledge-base` response (which is not a `moduleId` request-surface — it's
   always-present metadata) and internal `MODULE_IDS` iteration; no query param, body field, or `meta.
   moduleId` echo is added anywhere.

### Phase Summary

| Phase | Title | Estimate | Target Subagent(s) | Model(s) | Effort | Notes |
|-------|-------|---------:|--------------------|----------|--------|-------|
| P1 | Equivalence harness + module package contract | 3 pts | general-purpose executor; task-completion-validator gate | sonnet | adaptive | Golden-fixture capture + `git mv` relocation + literal-path swap (Sequencing Note 1) |
| P2 | Fact-derivation registry | 3 pts | general-purpose executor; task-completion-validator gate | sonnet | extended | Densest source file; drift risk justifies extended thinking |
| P3 | Engine generalization | 3 pts | general-purpose executor; task-completion-validator gate | sonnet | extended | Riskiest single diff (adjacent to algorithmic merge/rank — H3) |
| P4 | Reference-range registry | 2 pts | general-purpose executor; task-completion-validator gate; **karen milestone review** | sonnet | adaptive | Self-contained; may run parallel to P5 |
| P5 | Multi-module scripts/server + load test | 3 pts | general-purpose executor; task-completion-validator gate | sonnet | adaptive | Parallel to P4; extends P3's registry file (Sequencing Note 2) |
| P6 | Module manifest stub | 1 pt | general-purpose executor; task-completion-validator gate | sonnet | adaptive | Small; scheduled after P5 to keep metadata churn isolated |
| P7 | Verification, docs & closeout | 2 pts | documentation-writer role; task-completion-validator; **karen milestone review** | haiku (docs) / sonnet (gate re-run) | adaptive | Full V2 gate re-run, docs, 8 DOC-006 deferred-item specs |
| **Total** | — | **17 pts** | — | — | — | — |

**Critical path**: P1 → P2 → P3 → P5 → P7. **Parallelizable**: P4 ∥ P5 after P3 (disjoint files). P6 may
slot anywhere after P1 per its formal dependency, but is scheduled after P5 to keep version-metadata
churn out of earlier diffs (decisions block §1/§5).

> Estimation rationale (H1–H6 heuristics, per-area sums, anchor comparison) lives in
> `.claude/worknotes/platform-foundation-p0/estimation-sanity.md` — see **Estimation Sanity Check**
> pointer below. This plan carries per-phase task estimates only.

## Deferred Items & In-Flight Findings Policy

### Deferred Items

Every row below is out of scope for this PRD/plan by explicit design (PRD §14) and gets a design-spec
authoring task in P7 (DOC-006 rows, one per item) rather than a silent omission.

#### Deferred Items Triage Table

| Item ID | Category | Reason Deferred | Trigger for Promotion | Target Spec Path |
|---------|----------|------------------|------------------------|-------------------|
| DEF-1 | dependency-blocked | Evidence dual-source (`src/evidence.js` vs. `modules/anemia/evidence.json`) unification needs a signed/loaded-manifest mechanism that doesn't exist yet; P0 only adds a drift check (P6-T2). | Phase 1 signed-manifest work | `docs/project_plans/design-specs/evidence-dual-source-unification.md` |
| DEF-2 | backlog | Tri-state fact model changes fact semantics — excluded from a zero-behavior-change refactor. | Phase 1 roadmap kickoff | `docs/project_plans/design-specs/tri-state-fact-model.md` |
| DEF-3 | backlog | Exact-passage evidence schema/locators require new evidence content shape work, out of scope for a pure structural refactor. | Phase 1-WP3 | `docs/project_plans/design-specs/exact-passage-evidence-schema.md` |
| DEF-4 | dependency-blocked | Signed KB manifest — P0 ships an explicit unsigned stub (`status: "unsigned-stub"`, null hash/approval fields) so Phase 1 fills fields without a shape migration. | Phase 1 manifest-signing track | `docs/project_plans/design-specs/signed-kb-manifest.md` |
| DEF-5 | scope-cut | Formal `schemas/module-manifest.schema.json` — P0's module-load test uses field-presence checks only (SPIKE-002 OQ-003); no formal schema authored in P0. | Phase 1, or sooner if P0-WP6 executor judges field-presence insufficient | `docs/project_plans/design-specs/module-manifest-json-schema.md` |
| DEF-6 | scope-cut | Public `moduleId` API surface (query param / body field) explicitly excluded per the zero-behavior-change guardrail and binding OQ-2 (Sequencing Note 6). | Phase 1+, when a second module needs client-selectable targeting | `docs/project_plans/design-specs/public-moduleid-api-surface.md` |
| DEF-7 | scope-cut | `data/algorithm-explainers.json` and `examples/` relocation into `modules/anemia/` — not KB content; moving now risks colliding with an undesigned per-module UI-content convention. | Phase 2 (CBC suite), when a second module's UI content would otherwise collide | `docs/project_plans/design-specs/algorithm-explainers-examples-relocation.md` |
| DEF-8 | research-needed | Real headless-browser/runtime smoke check for `src/app.js`/`src/algorithmExplorer.js` — the shim strategy makes this acceptable for P0; no browser-execution test framework exists in this repo today. | Whichever phase (likely Phase 2 CBC client wiring) next substantively edits `app.js`/`algorithmExplorer.js` | `docs/project_plans/design-specs/headless-browser-runtime-smoke-check.md` |

### In-Flight Findings

Lazy-creation rule applies: `.claude/findings/platform-foundation-p0-findings.md` is **not** pre-created.
Create it only on the first real plan/reality mismatch discovered during execution; on creation, set
`findings_doc_ref` in this plan's frontmatter, append to `related_documents`, and — if load-bearing — add
a DOC-006 row in P7 and append the resulting spec path to `deferred_items_spec_refs`.

### Quality Gate

P7 cannot be sealed until: all 8 deferred items have a design-spec path in `deferred_items_spec_refs`
(DOC-006 rows P7-T6…T13); and, if `findings_doc_ref` is populated, the findings doc is finalized
(`draft` → `accepted`).

## Phase Breakdown

**Column conventions**: `Estimate` is points. `Model` values are `sonnet`/`haiku` (claude only, this
plan). `Effort` is `adaptive` | `extended` (claude vocabulary only — never a point value). Every phase's
**exit gate includes `npm run check` green + golden-output equivalence per `tests/golden/`**, in addition
to the phase-specific criteria listed.

---

### Phase 1: Equivalence Harness + Module Package Contract

**Dependencies**: None (first phase)
**Assigned Subagent(s)**: general-purpose (sonnet) executor; task-completion-validator gate
**Entry criteria**: `main` branch, `npm run check` green baseline confirmed.
**Exit criteria**: `npm run check` green; `tests/golden/*.json` committed and matched by
`tests/module-equivalence.test.mjs`; `git diff` on all 4 relocated KB JSON files is empty (content, not
path); anemia loads correctly from `modules/anemia/`.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|----------------------|----------|--------------|-------|--------|--------------|
| P1-T1 | Capture golden fixtures (pre-move) | On the unmodified `main` state, write `scripts/capture-golden.mjs` per SPIKE-001 RQ5 step 1 / SPIKE-002 Q6 step 1: run today's `assessPediatricAnemia(input, rules, candidates)` for each `examples/*.json`, scrub `meta.generatedAt` (pattern from `tests/engine.test.mjs:99`), write to `tests/golden/<example>.json`. Commit the script (permanent, for future *governed* regeneration). **Naming**: use `tests/golden/` + `tests/module-equivalence.test.mjs` per PRD FR-1 (resolves the SPIKE-001 vs. SPIKE-002 filename divergence — SPIKE-002's `tests/fixtures/golden/` + `golden-equivalence.test.mjs` naming is superseded). | 6 golden fixture files committed, one per example; script re-runnable and idempotent against unchanged source | 0.75 | general-purpose | sonnet | adaptive | None |
| P1-T2 | Define `modules/<id>/` contract + relocate anemia KB JSON | `git mv data/{rules,candidates,evidence,reference-ranges}.json` → `modules/anemia/{rules,candidates,evidence,reference-ranges}.json` per SPIKE-001 "Recommended layout." `data/algorithm-explainers.json` and `examples/` stay at `data/`/top-level (OQ-4, binding — not KB content, not in this task's scope). Document the `modules/<id>/` contract shape (file list) in a code comment or short note at `modules/anemia/` root. | `diff <(git show main:data/rules.json) modules/anemia/rules.json` (and same for `candidates.json`, `evidence.json`, `reference-ranges.json`) reports zero differences; `git mv` history shows rename, not delete+add | 0.75 | general-purpose | sonnet | adaptive | None |
| P1-T3 | Mechanical literal-path swap (hard rule: relocate, never edit KB content) | Per Sequencing Note 1: update the 6 hard-coded consumer read-paths from `data/x.json` to `modules/anemia/x.json` — **literal string swap only**, no iteration/registry logic (that is P5's job): `server.mjs` (2 `readFile` calls), `scripts/validate-kb.mjs` (2 `readFile` calls), `scripts/build-static.mjs` (3 `readFile` calls), `tests/engine.test.mjs` (2 `readFile` calls), `src/app.js` (2 `fetch()` calls, line ~519–520 — this is the one edit to `app.js` permitted at this phase; it is a pure path-literal change, not new logic), `scripts/smoke-test.mjs` (1 path-check string, line ~35). **Hard rule, every relocation task**: KB JSON content is never edited — only paths and import/read statements change. | `npm run check` passes with the new paths; no KB JSON file's byte content differs from `main` | 1.0 | general-purpose | sonnet | adaptive | P1-T2 |
| P1-T4 | Add permanent `tests/module-equivalence.test.mjs` | Per SPIKE-001 RQ5 step 2: for each of the 6 examples, call `assessPediatricAnemia(input, rules, candidates)` (still the pre-P3 function — `assess()` doesn't exist until P3), scrub `generatedAt`, `assert.deepEqual` against `tests/golden/<example>.json`. Auto-discovered by the existing `node --test tests/*.test.mjs` glob — no `package.json` change. | Test passes against the fixtures from P1-T1; test file is a permanent addition to `npm test`, not removed after P0 | 0.5 | general-purpose | sonnet | adaptive | P1-T1, P1-T3 |

**Phase 1 Quality Gates:**
- [ ] `npm run check` green (test + validate + build + smoke)
- [ ] `tests/golden/*.json` committed; `tests/module-equivalence.test.mjs` passing
- [ ] Empty content diff on all 4 relocated KB JSON files (`git diff` / `diff <(git show main:...)`)
- [ ] `data/algorithm-explainers.json` and `examples/` unmoved
- [ ] task-completion-validator sign-off

---

### Phase 2: Fact-Derivation Registry

**Dependencies**: P1 complete
**Assigned Subagent(s)**: general-purpose (sonnet) executor; task-completion-validator gate
**Entry criteria**: P1's harness green; `modules/anemia/` KB JSON in place.
**Exit criteria**: `npm run check` green; golden outputs identical; `src/facts.js` is a shim; no new
"core" primitives invented beyond the six SPIKE-001 identifies.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|----------------------|----------|--------------|-------|--------|--------------|
| P2-T1 | `src/facts/core.js` — generic primitives | Per SPIKE-001 RQ2: export the six genuinely reusable, stateless primitives from today's `src/facts.js` — `finite`, `num`, `isTrue`, `statusIs`, `includes`, `countTrue`. **Do not invent a broader "core" shape** — SPIKE-001 explicitly flags this as scope creep against the zero-behavior-change mandate. | Six named exports, zero imports, pure functions; identical behavior to today's inline versions | 0.5 | general-purpose | sonnet | extended | P1 |
| P2-T2 | `modules/anemia/facts.anemia.js` — moved domain logic | Move today's `deriveFacts()` body verbatim (CBC/ferritin/retic/hemolysis/lead/smear/marrow derivation) into `modules/anemia/facts.anemia.js`, importing the six primitives from `../../src/facts/core.js`. **Per Sequencing Note 3**: import range helpers from `../../src/referenceRanges.js` unchanged (not `src/ranges/registry.js`, which doesn't exist until P4) — this file's range import is rewired in P4-T3. Keep the single-arg signature `deriveFacts(rawInput)`. | Function body is byte-for-byte the same logic as today's `deriveFacts`, only file location and the two import lines differ; golden equivalence holds | 1.0 | general-purpose | sonnet | extended | P2-T1 |
| P2-T3 | `src/facts/registry.js` — explicit dispatch | Per SPIKE-001 RQ2 snippet: `const REGISTRY = new Map([['anemia', deriveAnemiaFacts]])`; `export function deriveFacts(input, moduleId)` looks up and calls the registered function, `throw new Error('Unknown module: ' + moduleId)` if unregistered. Explicit static import only — no `import()`, no directory scanning. | Registry throws the exact `Unknown module: <id>` message for an unregistered id; resolves correctly for `'anemia'` | 1.0 | general-purpose | sonnet | extended | P2-T2 |
| P2-T4 | `src/facts.js` becomes a shim | `src/facts.js` re-exports `deriveFacts` bound to `moduleId = 'anemia'` — note this is a **thin single-arg wrapper function**, not a literal zero-logic re-export, because the registry's `deriveFacts(input, moduleId)` is 2-arg while every current caller (`src/app.js`, `src/algorithmExplorer.js`, `tests/engine.test.mjs`) calls `deriveFacts(input)` with one arg. No edit needed to those three call sites. | `import { deriveFacts } from './facts.js'` behaves identically to today for all existing callers; zero edits to `app.js`/`algorithmExplorer.js`/`engine.test.mjs` | 0.5 | general-purpose | sonnet | extended | P2-T3 |

**Phase 2 Quality Gates:**
- [ ] `npm run check` green + golden outputs byte-identical
- [ ] `src/facts.js` is a shim; `app.js`, `algorithmExplorer.js`, `tests/engine.test.mjs` show zero diff
- [ ] `src/facts/core.js` contains exactly the 6 primitives, no more
- [ ] task-completion-validator sign-off

---

### Phase 3: Engine Generalization

**Dependencies**: P2 complete
**Assigned Subagent(s)**: general-purpose (sonnet) executor; task-completion-validator gate
**Entry criteria**: P2's fact registry green.
**Exit criteria**: `npm run check` green; golden outputs identical; `src/ruleEngine.js` shows zero diff;
`assessPediatricAnemia` is a shim.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|----------------------|----------|--------------|-------|--------|--------------|
| P3-T1 | `src/modules/registry.js` (created here; extended in P5) | Per SPIKE-001 RQ3 and **Sequencing Note 2**: `getModule(id)` (returns `modules/anemia/index.js`'s default export, throws `Unknown module: <id>` if unregistered) and `listModules()`. Explicit static import of `modules/anemia/index.js` — no dynamic import. This is the file P5-T1 later extends additively; do not pre-empt P5's `MODULE_IDS`/`MODULE_CODE_LOADERS` exports here. | `getModule('anemia')` resolves the module descriptor from P3-T2; unregistered id throws the exact error string | 0.5 | general-purpose | sonnet | extended | P2 |
| P3-T2 | `modules/anemia/index.js` — hook descriptor | Per SPIKE-001 RQ3 hook contract: default export `{ id: 'anemia', manifest: { engineLabel, knowledgeBaseVersion, evidenceReviewedThrough }, deriveFacts, summarize, limitations }`. **Per Sequencing Note 4**: `manifest`'s three fields are a hardcoded inline literal here, matching `src/evidence.js`'s current exported consts exactly — `module.json` (P6) is authored later to match these, not the reverse. `summarize` = today's `classificationSummary()` moved verbatim; `limitations` = today's `globalLimitations()` **minus** the 4 module-agnostic boilerplate strings (those move to `CORE_LIMITATIONS` in `engine.js`, P3-T3). | Hook object shape matches SPIKE-001's contract exactly; `summarize`/`limitations` produce identical output to today's functions given the same facts | 1.0 | general-purpose | sonnet | extended | P3-T1 |
| P3-T3 | `src/engine.js` — `assess(input, moduleId, rules, candidates)` | Per SPIKE-001 RQ3 snippet: 4-arg signature (not the roadmap's literal 2-arg sketch — KB JSON is always caller-loaded, per the cross-cutting browser-`fs` finding). `CORE_LIMITATIONS` holds the 4 boilerplate strings in today's order. Orchestrates `module.deriveFacts(input)` → `runRules(facts, rules, candidates)` → assembles `meta`/`classification`/`alerts`/`rankedDifferential`/`nextQuestions`/`interpretiveNotes`/`limitations`/`provenance` exactly as today. `assessPediatricAnemia(input, rules, catalog)` becomes a 1-line shim: `return assess(input, 'anemia', rules, catalog)`. | `server.mjs`, `src/app.js`, `src/algorithmExplorer.js`, `tests/engine.test.mjs` require zero edits (shim absorbs the signature change); golden equivalence holds | 1.25 | general-purpose | sonnet | extended | P3-T2 |
| P3-T4 | Confirm `src/ruleEngine.js` untouched | Hard rule per decisions block: `ruleEngine.js` is read-only in this refactor (confirmed module-agnostic by schema inspection — `schemas/rule.schema.json`/`schemas/candidate.schema.json` contain zero anemia-specific literals). Explicit verification step: `git diff main -- src/ruleEngine.js` is empty at the end of this phase. | Zero diff on `src/ruleEngine.js` | 0.25 | general-purpose | sonnet | extended | P3-T3 |

**Phase 3 Quality Gates:**
- [ ] `npm run check` green + golden outputs byte-identical
- [ ] `src/ruleEngine.js` zero diff
- [ ] `assessPediatricAnemia` is a 1-line shim over `assess(input, 'anemia', rules, catalog)`
- [ ] `server.mjs`/`app.js`/`algorithmExplorer.js`/`engine.test.mjs` zero diff
- [ ] task-completion-validator sign-off

---

### Phase 4: Reference-Range Registry

**Dependencies**: P3 complete (may run parallel with P5)
**Assigned Subagent(s)**: general-purpose (sonnet) executor; task-completion-validator gate; **karen milestone review** (decisions block §2 — mid-program checkpoint)
**Entry criteria**: P3's `getModule`/engine generalization green.
**Exit criteria**: `npm run check` green; golden outputs identical; `src/referenceRanges.js` is a shim;
karen milestone review passed.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|----------------------|----------|--------------|-------|--------|--------------|
| P4-T1 | `src/ranges/registry.js` — generic primitives | Per SPIKE-001 RQ4 snippet: `registerAnalyteBands(moduleId, analyte, bands)`, `registerThresholdRule(moduleId, analyte, rule)`, `getBuiltInAnalyteValue(moduleId, analyte, ageMonths, sexAtBirth)` (4-tuple keyed band lookup), `getThreshold(moduleId, analyte, context)` (separate, non-banded primitive — ferritin's flat `menstruating`-gated cutoff cannot be squeezed into the band shape without distorting its selection logic; keep the two primitives distinct). | Band lookup and threshold lookup are independently testable; unregistered `(moduleId, analyte)` returns `null`, never throws (matches today's tolerant lookup behavior) | 0.75 | general-purpose | sonnet | adaptive | P3 |
| P4-T2 | `modules/anemia/ranges.js` — registration + composition wrapper | Register `hb`/`mcv`/`rdw` bands (unpacked from `modules/anemia/reference-ranges.json`) and the ferritin threshold rule (today's `getFerritinThreshold` body, unchanged) via `registerAnalyteBands('anemia', ...)`/`registerThresholdRule('anemia', 'ferritin', ...)`. Export a **composition wrapper** (not the generic registry directly) reproducing today's `getEffectiveRanges()` shape verbatim — `{hbLower, mcvLower, mcvUpper, rdwUpper, provenance}` — via the same local-override-then-AAP-fallback `pick()` logic, including the `provenance` field shape. `data/reference-ranges.json` (now `modules/anemia/reference-ranges.json`) goes from dead data to load-bearing for the first time — call this out explicitly in the PR description, not just the diff. | `getEffectiveRanges(input)` output byte-identical to today's for every example's input shape; `provenance` field unchanged | 0.75 | general-purpose | sonnet | adaptive | P4-T1 |
| P4-T3 | `src/referenceRanges.js` shim + facts.anemia.js rewire | `src/referenceRanges.js` becomes a shim re-exporting `getBuiltInRange`/`getEffectiveRanges`/`getFerritinThreshold`/`REFERENCE_RANGE_SOURCE`/`BUILT_IN_RANGES` bound to `'anemia'` (so `tests/engine.test.mjs`'s `import { getBuiltInRange } from '../src/referenceRanges.js'` needs no edit). **Per Sequencing Note 3**: update `modules/anemia/facts.anemia.js`'s range import from `../../src/referenceRanges.js` to `../../modules/anemia/ranges.js`'s composition wrapper — the one deferred edit from P2-T2. Re-run golden equivalence after this rewire specifically (it's the one call-site change in this phase that touches the fact-derivation path). | `tests/engine.test.mjs` zero diff; golden equivalence holds after the facts.anemia.js import rewire | 0.5 | general-purpose | sonnet | adaptive | P4-T2 |

**Phase 4 Quality Gates:**
- [ ] `npm run check` green + golden outputs byte-identical
- [ ] `src/referenceRanges.js` is a shim; `tests/engine.test.mjs` zero diff
- [ ] `modules/anemia/facts.anemia.js` imports the ranges composition wrapper, not the old shim path
- [ ] **karen milestone review**: phase-boundary sanity check on the H5 anchor delta (per estimation-sanity.md) and on parallel-phase (P4∥P5) file-ownership discipline
- [ ] task-completion-validator sign-off

---

### Phase 5: Multi-Module Scripts/Server + Load Test

**Dependencies**: P3 complete (may run parallel with P4)
**Assigned Subagent(s)**: general-purpose (sonnet) executor; task-completion-validator gate
**Entry criteria**: P3's `assess(input, moduleId, ...)` signature green (soft prerequisite per SPIKE-002
OQ-002 — `server.mjs`'s `POST /api/v1/assess` generalization needs a genuinely module-generic engine
call, not a bolted-on param).
**Exit criteria**: `npm run check` (incl. the two new test files) green; built asset byte-compare passes;
no `moduleId` field added to any public request/response shape (AC-5).

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|----------------------|----------|--------------|-------|--------|--------------|
| P5-T1 | Extend `src/modules/registry.js` | Per SPIKE-002 Q1 and **Sequencing Note 2**: add `MODULE_IDS = Object.freeze(['anemia'])`, `DEFAULT_MODULE_ID = 'anemia'`, `MODULE_CODE_LOADERS` (literal enumerated `import()` map to `modules/anemia/facts.anemia.js` — never a template-string/variable-built specifier), `loadModuleCode(moduleId)`, `isRegisteredModule(moduleId)` — **additive** to P3-T1's existing `getModule`/`listModules` exports; do not remove or restructure them. | Both APIs coexist in the same file; `getModule('anemia')` (P3 consumer) and `loadModuleCode('anemia')` (new) both resolve correctly | 0.5 | general-purpose | sonnet | adaptive | P3 |
| P5-T2 | `scripts/validate-kb.mjs` — module iteration | Per SPIKE-002 Q2: wrap the existing validation body in `validateModule(moduleId, root)`, loop `MODULE_IDS`, aggregate errors with an `${moduleId}/` prefix. Read `modules/<id>/{rules,candidates,evidence}.json` directly (JSON only) — **drop the `src/evidence.js` import** (collapses one instance of the evidence dual-source problem per SPIKE-002 Q2, flagged as DEF-1). Add a `module.json` shape check: `id` field matches the directory name (field-presence only in P5 — the full drift check against `evidence.js` consts is P6-T2). | `Validated modules: anemia (91 rules, 26 candidates, 6 evidence records).`-style aggregate output; non-zero exit if any module has errors | 0.5 | general-purpose | sonnet | adaptive | P5-T1 |
| P5-T3 | `scripts/build-static.mjs` — module-aware build | Per SPIKE-002 Q3: `directories` array gains `'modules'` (copied wholesale via existing recursive `cp()`, same as `src/`/`examples/` today); `stampTargets` gains `...(await collectFiles(path.join(dist, 'modules')))` — digest logic (`createHash('sha256')` over sorted file bytes) is unchanged, only the directory list feeding it grows. `buildInfo.json` loops `MODULE_IDS`, reading each `modules/<id>/{rules,candidates,evidence,module}.json`, and adds an additive `modules: {anemia: {...}}` breakdown while top-level fields keep echoing `DEFAULT_MODULE_ID`'s numbers unchanged. Confirm (do not re-derive) that the existing `fetch('./…json')` stamping regex already covers the `./modules/anemia/...` literals P1-T3 introduced into `app.js` — no regex change needed. | `dist/modules/` exists post-build, stamped; `buildInfo.json` has both the unchanged flat top-level fields and the new `modules` map; a subsequent edit to any file under `dist/modules` still changes the stamp | 0.5 | general-purpose | sonnet | adaptive | P5-T1 |
| P5-T4 | `server.mjs` — module-aware startup + no public surface change | Per SPIKE-002 Q4, **overridden by Sequencing Note 6**: replace the two hard-coded reads with a startup loop over `MODULE_IDS` building `modulesById` (`{rules, candidates, evidenceSources, manifest}` per id), **fail-fast** (process exits with an error) if any registered module's JSON is missing or fails to parse. `GET /api/v1/knowledge-base`'s unscoped response gains an additive `modules: {anemia: {...}}` key — always present, not conditional on any request param. `POST /api/v1/assess` continues to call `assess(input, 'anemia', rules, candidates)` internally with **no new request field, no query param, no `meta.moduleId` echo, no `400` unknown-module path** (none of these exist because no client-facing moduleId surface exists in P0). | `openapi.yaml` has zero diff; existing request/response shapes byte-identical to pre-refactor for the default (only) path; a malformed/missing module's JSON crashes server startup, never serves silently | 0.75 | general-purpose | sonnet | adaptive | P5-T1, P5-T3 |
| P5-T5 | `scripts/smoke-test.mjs` — internal consistency loop | Keep every existing assertion (HTTP 200 + regex matches on served files) exactly as-is and unscoped — the anti-regression backbone for the default-module path. Add a `for (const moduleId of MODULE_IDS)` loop that asserts **internal** registry/module-data consistency (e.g., `modulesById`'s per-module rule/candidate counts match the module's own JSON files) — **not** an HTTP-level `?moduleId=` check, since that surface doesn't exist per Sequencing Note 6. For P0 this loop body executes once (`anemia` only), proving the plumbing now. | Existing smoke assertions pass unmodified; new loop passes for `anemia` and would generalize correctly if a second module were registered | 0.5 | general-purpose | sonnet | adaptive | P5-T4 |
| P5-T6 | `tests/module-registry.test.mjs` (new; extended in P6) | Per SPIKE-002 Q5 and **Sequencing Note 5**: assert (1) registry completeness (`MODULE_IDS` non-empty, unique, includes `DEFAULT_MODULE_ID`; `DEFAULT_MODULE_ID === 'anemia'` — a deliberate tripwire, delete/update the day a second module registers); (3) per-module KB files (`rules.json`, `candidates.json`, `evidence.json`, `reference-ranges.json`) exist and `JSON.parse` without throwing; (4) `await loadModuleCode('anemia')` resolves and the result exports a `deriveFacts` function; (5) `tests/engine.test.mjs`'s existing assertions keep running unmodified. **Do not add assertion (2) (manifest shape) here** — `module.json` doesn't exist until P6; P6-T3 extends this file with that assertion. Auto-discovered by the existing `node --test` glob. | 4 of 5 SPIKE-002 Q5 assertions pass; assertion 2 explicitly deferred with a code comment pointing to P6 | 0.25 | general-purpose | sonnet | adaptive | P5-T1 |

**Phase 5 Quality Gates:**
- [ ] `npm run check` (incl. `tests/module-registry.test.mjs`) green + golden outputs byte-identical
- [ ] Built asset byte-compare: served KB bytes unchanged; stamp is a deterministic function of content; stamp still varies when content varies
- [ ] `openapi.yaml` zero diff; no `moduleId` field on any request/response shape (AC-5)
- [ ] `scripts/smoke-test.mjs`'s pre-existing legacy assertions pass unmodified
- [ ] task-completion-validator sign-off

---

### Phase 6: Module Manifest Stub

**Dependencies**: P5 complete (scheduled after P5 to isolate version-metadata churn; formal hard dependency is P1 only)
**Assigned Subagent(s)**: general-purpose (sonnet) executor; task-completion-validator gate
**Entry criteria**: P3's manifest literal (`modules/anemia/index.js`) and P5's `validate-kb.mjs`/
`module-registry.test.mjs` scaffolding in place.
**Exit criteria**: `npm run check` green; golden outputs identical; three-way version-const consistency
(`evidence.js`, `index.js` manifest literal, `module.json`) verified.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|----------------------|----------|--------------|-------|--------|--------------|
| P6-T1 | `modules/anemia/module.json` | Per SPIKE-001 RQ1 shape: `{id: "anemia", title: "Pediatric Anemia", schemaVersion: 1, status: "unsigned-stub", knowledgeBaseVersion, evidenceReviewedThrough, engineLabel: "Pediatric Anemia Deterministic CDSS", supportedAgeMonths: {min: 6, max: 216}, clinicalContentHash: null, approvedBy: [], validationRunId: null, supersedes: null, releasedAt: null}`. Per Sequencing Note 4: `knowledgeBaseVersion`/`evidenceReviewedThrough`/`engineLabel` must byte-match both `src/evidence.js`'s exported consts and P3-T2's `modules/anemia/index.js` manifest literal. `src/evidence.js` keeps its two version consts unchanged (browser synchronous-access requirement) — this is a mitigation of the evidence dual-source problem (DEF-1), not a unification. | `module.json` parses; all three value sources agree byte-for-byte | 0.4 | general-purpose | sonnet | adaptive | P5 |
| P6-T2 | `validate-kb.mjs` drift check | Add a check asserting `module.json`'s `knowledgeBaseVersion`/`evidenceReviewedThrough` byte-match `src/evidence.js`'s exported `KNOWLEDGE_BASE_VERSION`/`REVIEWED_THROUGH` consts (SPIKE-001 OQ-3 / SPIKE-002 OQ-001). Non-zero exit on mismatch. | Drift check fails loudly if the two sources diverge; passes today | 0.35 | general-purpose | sonnet | adaptive | P6-T1 |
| P6-T3 | Extend `tests/module-registry.test.mjs` with manifest-shape assertion | Per SPIKE-002 Q5 assertion 2 and Sequencing Note 5: for every id in `MODULE_IDS`, `modules/<id>/module.json` exists, parses, and `manifest.id === id`. Field-presence checks only — no formal schema yet (DEF-5). | All 5 SPIKE-002 Q5 assertions now present and passing in `tests/module-registry.test.mjs` | 0.25 | general-purpose | sonnet | adaptive | P6-T1 |

**Phase 6 Quality Gates:**
- [ ] `npm run check` green + golden outputs byte-identical
- [ ] `module.json`/`evidence.js`/`index.js` manifest three-way consistency verified by the new drift check
- [ ] `tests/module-registry.test.mjs` complete (all 5 SPIKE-002 Q5 assertions present)
- [ ] task-completion-validator sign-off

---

### Phase 7: Verification, Docs & Closeout

**Dependencies**: P4 and P6 complete
**Assigned Subagent(s)**: documentation-writer role (haiku for doc tasks, sonnet for the gate re-run and spec authoring); task-completion-validator; **karen milestone review**
**Entry criteria**: All prior phases green independently.
**Exit criteria**: Full V2 technical gate passes; docs reflect the module architecture; all 8 deferred
items have a design-spec path; karen milestone review passed.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|----------------------|----------|--------------|-------|--------|--------------|
| P7-T1 | Full V2 technical gate re-run | `npm run check` green end-to-end; `tests/module-equivalence.test.mjs` + `tests/module-registry.test.mjs` green; re-confirm empty content diff on all 4 relocated KB JSON files (`diff <(git show main:data/<file>) modules/anemia/<file>`, one last time against the original pre-refactor `main`, not an intermediate commit); built-asset byte-compare per P5's criteria. This is the roadmap's V2 go/no-go (PRD §11 AC-1 through AC-6), run once, holistically, across the whole diff. | All of AC-1…AC-6 verified and recorded (pass/fail per AC) | 0.4 | general-purpose | sonnet | adaptive | P4, P6 |
| P7-T2 | Runtime app-surface smoke check (R-P4) | Per decisions block OQ-6 / SPIKE-001's cross-cutting finding: `npm run check` never executes browser JS, so shim breakage in `src/app.js`/`src/algorithmExplorer.js` is invisible to the gate. **Not** a headless-browser test (explicitly out of scope, DEF-8) — instead, a lightweight static-resolution script: parse every `import ... from '...'`/`fetch('...')` specifier in `src/app.js` and `src/algorithmExplorer.js`, resolve each relative path against both `src/` (dev) and `dist/` (built), and assert the target file exists on disk. Catches exactly the "broken import path invisible to `npm run check`" risk this refactor's shim strategy is designed to avoid. | Script exits non-zero on any unresolvable import/fetch specifier; passes today for both `app.js`'s new `modules/anemia/...` fetch literals (from P1-T3) and every shim import path | 0.3 | general-purpose | sonnet | adaptive | P7-T1 |
| P7-T3 | `docs/architecture.md` update | Add a module-package architecture subsection (near §2 "Prototype architecture") documenting the `modules/<id>/` contract, the three new registries (`src/facts/registry.js`, `src/ranges/registry.js`, `src/modules/registry.js`), and the shim strategy (`src/facts.js`, `src/referenceRanges.js`, `assessPediatricAnemia` are re-export/wrapper shims). Cross-reference §6 (KB release manifest) for how `module.json` relates to the eventual signed manifest. | New subsection present; existing §1–§10 content otherwise unchanged in substance (structural refactor, not a rewrite) | 0.2 | documentation-writer | haiku | adaptive | P7-T1 |
| P7-T4 | `CLAUDE.md` architecture-orientation update | Update the "Architecture orientation" pipeline diagram and file paths (`data/rules.json` → `modules/anemia/rules.json`, etc.) per the project's ≤3-line-pointer convention; point to `docs/architecture.md`'s new subsection for detail rather than restating it. | CLAUDE.md's architecture block reflects `modules/anemia/` paths; no content duplication beyond a pointer | 0.15 | documentation-writer | haiku | adaptive | P7-T3 |
| P7-T5 | CHANGELOG — N/A, documented | Per PRD §15: "CHANGELOG (internal-only, no user-facing entry expected)." This is a structural refactor with zero clinical/user-facing behavior change (that is the entire point, verified by P7-T1). Per this plan's `changelog_required: false`, skip DOC-001; record the rationale here rather than silently omitting it. | Frontmatter `changelog_required: false` matches this task's explicit N/A rationale | 0.05 | documentation-writer | haiku | adaptive | P7-T1 |
| P7-T6…T13 | DOC-006 — Author 8 deferred-item design specs | One task per row in the **Deferred Items Triage Table** above (DEF-1…DEF-8). For each: author `docs/project_plans/design-specs/<item-slug>.md` with `maturity: shaping` (or `idea` if a SPIKE is still needed — true for DEF-1, DEF-3, DEF-4, DEF-5), `prd_ref` set to this plan's parent PRD, and append the resulting path to this plan's `deferred_items_spec_refs`. | All 8 specs authored; `deferred_items_spec_refs` frontmatter populated with all 8 paths | 0.7 (≈0.09 each) | documentation-writer | sonnet | adaptive | P7-T1 |
| P7-T14 | Findings doc — N/A unless populated | If `findings_doc_ref` is null (expected, absent an in-flight finding), record "N/A — no findings captured" and leave frontmatter null. If populated during execution, finalize per the Quality Gate policy above. | Explicit N/A recorded, or findings doc finalized | 0.05 | documentation-writer | haiku | adaptive | P7-T6…T13 |
| P7-T15 | Update plan frontmatter | Set `status: completed`, populate `commit_refs`, confirm `files_affected` matches the actual diff, set `updated` to close-out date. | Frontmatter lifecycle fields complete | 0.15 | documentation-writer | haiku | adaptive | P7-T14 |

**Phase 7 Quality Gates:**
- [ ] Full V2 gate (AC-1…AC-6) verified and recorded
- [ ] Runtime app-surface smoke check passes (R-P4)
- [ ] `docs/architecture.md` + `CLAUDE.md` updated
- [ ] CHANGELOG N/A rationale recorded (`changelog_required: false`)
- [ ] All 8 deferred items have a design-spec path in `deferred_items_spec_refs`
- [ ] Findings doc finalized or N/A
- [ ] **karen milestone review**: final architecture/scope-creep sanity pass — confirms no KB content edits crept in anywhere across all 7 phases, confirms OQ-2's no-moduleId-surface decision held
- [ ] task-completion-validator sign-off
- [ ] Plan frontmatter lifecycle fields complete

---

## Wrap-Up: Feature Guide & PR

**Triggered**: Automatically after P7 is sealed (all P7 quality gates pass).

### Step 1 — Feature Guide

Delegate to `documentation-writer` (haiku) to create `.claude/worknotes/platform-foundation-p0/feature-guide.md` (frontmatter: `doc_type: feature_guide`, `feature_slug: platform-foundation-p0`, `prd_ref`/`plan_ref` set, `spike_ref` both SPIKEs, `created` = close-out date). Required sections (≤200 lines total): What Was Built; Architecture Overview (the `modules/<id>/` contract, the 3 registries, the shim strategy); How to Test (`npm run check`; `node --test tests/module-equivalence.test.mjs tests/module-registry.test.mjs`); Test Coverage Summary; Known Limitations (point to the 8 deferred-item specs). Commit before opening the PR.

### Step 2 — Open PR

This repo's git workflow (`CLAUDE.md`): branch off `main`, `npm run check` green, commit per phase, PR to
the parent branch, end commit messages with the Co-Authored-By trailer.

```bash
gh pr create \
  --title "Platform foundation: modules/<id>/ package contract (Phase 0)" \
  --body "$(cat <<'EOF'
## Summary
- Extracts the anemia-specific rules runtime into a module-agnostic platform; modules/anemia/ is the first registered module.
- Zero clinical behavior change: permanent golden-fixture equivalence harness (tests/golden/ + tests/module-equivalence.test.mjs) proves byte-identical assess() output for all 6 examples across every phase.
- No public API surface change (AC-5); KB JSON content relocated, never edited (AC-3).

## Feature Guide
.claude/worknotes/platform-foundation-p0/feature-guide.md

## Test plan
- [ ] npm run check green
- [ ] tests/module-equivalence.test.mjs + tests/module-registry.test.mjs pass
- [ ] Runtime app-surface smoke check (P7-T2) passes
- [ ] Manual smoke: npm start, load index.html, run one assessment

🤖 Generated with Claude Code
EOF
)"
```

## Model, Provider & Effort Assignment

All tasks use `claude` (`sonnet` for implementation/gate work, `haiku` for mechanical docs, per the
decisions block §6 model routing table). Effort is `adaptive` throughout except **P2 and P3**, which use
`extended` — both sit on the densest/riskiest diffs (facts derivation split; engine hook extraction
adjacent to the algorithmic merge/rank logic, H3). No external models (Gemini/Codex) are needed — no UI
design, no web research in this phase (decisions block §6).

## Risk Mitigation

Carried forward from the decisions block §3, with per-phase monitoring hooks added:

| Risk | Impact | Likelihood | Mitigation | Monitored At |
|------|:------:|:----------:|-------------|---------------|
| **Silent clinical-output drift** — a subtle re-ordering of rule evaluation, fact derivation, or candidate merge changes ranked output without failing any *pre-existing* test. | High | Medium | P1 builds the golden-output equivalence harness before any move; every phase's exit gate re-runs `tests/module-equivalence.test.mjs`; the 6-example byte-compare (modulo `generatedAt`) is the go/no-go. | Every phase's exit gate (P1–P7); explicitly re-verified holistically at P7-T1 |
| **Content-hash cache-busting breakage** — restructuring what feeds the static bundle can silently change hash inputs or break stamping, causing stale-cache mismatches (the `98f7ce5`/`240e314` failure class). | Medium | Medium | SPIKE-002 governs the design (`directories` += `'modules'`; stamping walks `dist/modules`); exit gate byte-compares served asset payloads and confirms stamping still varies when content varies. One-time stamp-*value* change at the P1 relocation commit is expected, not a regression. | P5's exit gate specifically (build-static.mjs changes); re-confirmed at P7-T1 |
| **Clinical scope creep disguised as refactor** — "while we're in here" edits to KB JSON content or thresholds would violate the no-AI-published-rule-changes guardrail. | High (low likelihood) | Low | Hard rule in every relocation task: KB JSON may be relocated, never edited (empty content diff enforced); reviewer/validator gate runs the `diff <(git show main:...)` check. | P1-T2 (relocation commit); task-completion-validator every phase; karen at P4 and P7 |
| **API surface drift on `server.mjs` generalization** — introducing module iteration risks leaking a `moduleId` field or altering the mirror-API contract / `openapi.yaml` sync. | Medium | Low | Default module = `anemia`; existing request/response shapes explicitly unchanged (binding OQ-2, Sequencing Note 6); `smoke-test.mjs`'s legacy-shape assertions run unmodified; `openapi.yaml` untouched. | P5's exit gate (server.mjs changes, AC-5); karen at P7 |

## Estimation Sanity Check

Full H1–H6 (+H7) bottom-up worksheet, per-area sum table, and anchor comparison live in
**`.claude/worknotes/platform-foundation-p0/estimation-sanity.md`** (kept separate per this plan's
authoring instructions; will be folded into the human brief). Headline: bottom-up total = 17 pts,
matches the decisions block and PRD frontmatter exactly, no top-down compression applied.

## Inconsistencies & Conflicts Found (not silently resolved — flagged for human confirmation)

1. **P1/FR-1 vs. FR-5's "only permitted edit" framing.** FR-1 (P1) says KB JSON is relocated with an
   empty content diff, but is silent on the 6 hard-coded consumer read-paths that would otherwise break
   immediately. FR-5 (P5) states "`src/app.js` fetch literals move from `./data/{rules,candidates}.json`
   to `./modules/anemia/{rules,candidates}.json` — **the only permitted edit** to `src/app.js`/
   `src/algorithmExplorer.js` in this refactor" — implying that edit happens at P5, not P1. But AC-2 and
   PRD Goal 3 require `npm run check` green **at every phase boundary**, including P1's, which is
   impossible if `server.mjs`/`validate-kb.mjs`/`build-static.mjs`/`app.js`/`tests/engine.test.mjs`/
   `smoke-test.mjs` still point at the now-deleted `data/*.json` paths right after P1's `git mv`. This
   plan resolves it (Sequencing Note 1 / P1-T3) by having P1 do the mechanical literal-path swap across
   all 6 consumers, and reads FR-5's "only permitted edit" claim as referring to the *logic* edit (moving
   from a hard-coded literal to `MODULE_IDS`-driven iteration), not the literal string value itself,
   which P1 must already touch. **Recommend confirming this reading is intended**, since a literal
   reading of FR-5 would leave P1 red.
2. **Two independently-designed `src/modules/registry.js` APIs collide on one file path.** SPIKE-001 RQ3
   specifies `getModule(id)`/`listModules()` (sync, hook-object accessor, engine-facing). SPIKE-002 Q1
   specifies `MODULE_IDS`/`DEFAULT_MODULE_ID`/`MODULE_CODE_LOADERS`/`loadModuleCode()`/
   `isRegisteredModule()` (enumeration + async loader, script/server/test-facing) for the *same file*.
   The PRD's FR-5 text lists only SPIKE-002's exports, and FR-3's text doesn't mention where `getModule`
   comes from at all — read literally, an executor building FR-5 exactly as written would author a file
   that doesn't satisfy what FR-3/SPIKE-001's `engine.js` needs. This plan resolves it (Sequencing Note
   2) by merging both APIs into one file, authored incrementally (P3 creates the SPIKE-001 half, P5
   extends it with the SPIKE-002 half). **Recommend confirming the merge is the intended reading**, not
   two separate files or a SPIKE-002-only file that breaks P3.
3. **SPIKE-002 Q4's `moduleId` API design is fully superseded by binding OQ-2, but the PRD keeps SPIKE-002
   as a "spec reference" without flagging which parts no longer apply.** SPIKE-002 Q4 recommends an
   optional `?moduleId=` query param, a `400` error path, and a `meta.moduleId` echo — all explicitly
   forbidden by the PRD's AC-5 and binding OQ-2 (Opus arbitration overriding SPIKE-002 in favor of
   SPIKE-001's no-surface-change position). This is *already resolved* in the PRD/decisions block (not a
   new conflict I'm introducing), but SPIKE-002's document text itself was never corrected to reflect the
   override, so a phase executor citing SPIKE-002 Q4 directly (rather than the PRD) would build the wrong
   thing. Flagged here so it's explicit rather than assumed-obvious; P5-T4/T5 and Sequencing Note 6 carry
   the corrected (PRD-binding) design into the task table.
4. **`modules/anemia/facts.anemia.js`'s range import and `modules/anemia/index.js`'s manifest literal
   both reference P4/P6 deliverables that don't exist at P2/P3 execution time.** Neither the PRD nor the
   decisions block calls out that SPIKE-001's target file tree describes the *end state* (post-P4/P6),
   not what P2/P3 must produce standalone. Resolved via Sequencing Notes 3 and 4 (interim states that get
   rewired once the dependency lands, with golden-equivalence re-verification at the rewire point). No
   scope or estimate change results — this is a within-phase sequencing detail, not a new task — but
   flagging since it's the kind of gap that causes a mid-phase context-blow if an executor tries to
   import a file that doesn't exist yet.
5. **`tests/module-registry.test.mjs`'s 5 SPIKE-002 Q5 assertions can't all land in P5** — assertion 2
   (manifest shape) depends on `module.json`, a P6 deliverable, but SPIKE-002 describes all 5 as if
   authored together in WP5. Resolved via Sequencing Note 5 (P5 ships 4/5, P6 adds the 5th to the same
   file). Same category as #4 — a sequencing gap, not a scope conflict, but worth confirming the split is
   acceptable rather than requiring `module.json` to be pulled forward into P5.

None of the above required a scope, estimate, or phase-boundary change from the decisions block — all 17
points and all 7 phase boundaries are preserved exactly as specified. They are execution-order and
file-ownership clarifications that a literal, unsequenced reading of the two SPIKEs would not have
surfaced.
