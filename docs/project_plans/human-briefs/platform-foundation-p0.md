---
schema_name: ccdash_document
schema_version: 2
doc_type: human_brief
title: "Human Brief: Platform Foundation P0"
status: draft
created: 2026-07-17
audience: [humans]
feature_slug: platform-foundation-p0
category: human-briefs
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
owner: nick
priority: P0
intent_ref: null
epic_ref: null
---

# Human Brief: Platform Foundation P0

## 1. Context Pointers

- **PRD**: `docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md` — feature goals, requirements, scope, acceptance criteria
- **Implementation Plan**: `docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md` — 7-phase task breakdown, sequencing notes, risk mitigation
- **SPIKE-001**: `docs/project_plans/SPIKEs/spike-001-module-package-boundary.md` — design decisions on module layout, registry contracts
- **SPIKE-002**: `docs/project_plans/SPIKEs/spike-002-multi-module-loader.md` — design decisions on script/server module iteration
- **Decisions Block**: `.claude/worknotes/platform-foundation-p0/decisions-block.md` — phase boundaries, agent routing, open-question resolutions

## 2. Estimation Sanity Check

**Total Estimate**: 17 points (bottom-up, no compression)

### Bottom-Up Per-Area Sums

| Capability Area | Points | Notes |
|---|---:|---|
| FR-1 — Harness + module package contract | 3 | Golden-fixture capture, git mv relocation, mechanical literal-path swap across 6 consumers |
| FR-2 — Fact-derivation registry | 3 | Densest source file (facts.js, 365 lines); explicit-Map registry + shim |
| FR-3 — Engine generalization | 3 | Adjacent to algorithmic merge/rank logic (H3 flagged); hook extraction is highest-drift-risk diff |
| FR-4 — Reference-range registry | 2 | Self-contained; two related primitives (band table + threshold rule) |
| FR-5 — Multi-module scripts/server + load test | 3 | Four executable surfaces + two new test files; registry-file merge with P3's output |
| FR-6 — Module manifest stub | 1 | Small manifest + one drift check |
| P7 — Verification, docs & closeout | 2 | Full gate re-run, docs, 8 DOC-006 deferred-item specs, app-surface smoke check |
| **Total** | **17 pts** | Plan total = Σ exactly — no top-down compression |

### H5 Anchor Reference Comparison

**Anchor**: commit `240e314` (content-hash stamping for static build) — ~1 pt across 2 files.

**This plan**: ~20 files across 7 phases; introduces 3 new registry layers, 1 new package convention, 4 shim files, 2 new tests (1 golden-fixture regression harness, 1 structural test).

**Delta**: 17× anchor's point cost for ~10× the file footprint — delta is large but justified: anchor was one repeated mechanical edit; this plan designs and builds three new abstraction layers plus a standing regression net (qualitatively different work, not just "more of the same edit"). Flag for karen milestone review at P4 to sanity-check independently.

## 3. Wave & Orchestration Notes

**Critical Path**: P1 → P2 → P3 → P5 → P7 (13 pts)

**Parallelizable Slice**: P4 ∥ P5 after P3 (disjoint file ownership: `src/ranges/*` vs. `scripts/*` + `server.mjs`; both gate on same golden-output harness).

**P6 Timing**: May slot anywhere after P1 formally; scheduled after P5 to keep version-metadata churn out of earlier diffs (no true path-critical dependency except on P1's package contract location).

**Waves by Execution Order**:
1. P1 (3 pts) — harness + contract baseline
2. P2 (3 pts) — fact registry (serial after P1)
3. P3 (3 pts) — engine generalization (serial after P2)
4. P4 (2 pts) ∥ P5 (3 pts) after P3 — disjoint files, both gate on golden outputs
5. P6 (1 pt) — manifest stub (after P5 for metadata isolation)
6. P7 (2 pts) — verification + docs + closeout

## 4. Open Questions Ledger

All OQ resolutions are **binding** (do not reopen):

| OQ ID | Question | Resolution | Status |
|-------|----------|-----------|--------|
| OQ-1 | How do consumers discover registered modules? | Static registry at `src/modules/registry.js` — literal `MODULE_IDS`/`DEFAULT_MODULE_ID` + explicit `MODULE_CODE_LOADERS` map. No directory-scan, no dynamic-import-by-variable. | ✓ Resolved |
| OQ-2 | Does the public REST API expose `moduleId` in P0? | No. SPIKE-001 and SPIKE-002 conflicted; Opus arbitration resolved in favor of SPIKE-001's no-surface-change position (zero-behavior-change guardrail wins). Scripts/server iterate modules internally; public shapes untouched until Phase 1. | ✓ Resolved |
| OQ-3 | On-the-fly regeneration vs. committed golden fixtures for equivalence gate? | Committed fixtures at `tests/golden/*.json`, captured pre-refactor in P1; permanent `tests/module-equivalence.test.mjs` — harness is a lasting regression net, not P0-only tooling. | ✓ Resolved |
| OQ-4 | Do `examples/` and `data/algorithm-explainers.json` move into `modules/anemia/`? | No — both stay top-level in P0; relocation deferred (not KB content, not in WP1 scope). | ✓ Resolved |
| OQ-6 | What is the actual `assess()` signature? | `assess(input, moduleId, rules, candidates)` 4-arg, superseding roadmap's literal 2-arg sketch (KB JSON always caller-loaded; browser has no fs). `assessPediatricAnemia` and `src/facts.js`/`src/referenceRanges.js` become 1-line re-export shims. | ✓ Resolved |
| OQ-7 | Evidence dual-source unification (`src/evidence.js` vs. `data/evidence.json`)? | P0 mitigates with drift check (P6-T2); real unification deferred to Phase 1 signed-manifest work. Needs a DOC-006 deferred-item row. | ✓ Resolved |

## 5. Deferred Items Rationale

Eight items explicitly deferred from P0 to Phase 1+; each gets a design-spec authoring task (DOC-006 row) in P7:

| Item | Category | Why Deferred | Where It Lands |
|---|---|---|---|
| Evidence dual-source unification | dependency-blocked | Needs signed/loaded-manifest mechanism that doesn't exist yet; P0 only adds drift check. | Phase 1 signed-manifest work |
| Tri-state fact model | backlog | Changes fact semantics; excluded from zero-behavior-change refactor. | Phase 1 design spec |
| Exact-passage evidence schema/locators | backlog | Requires new evidence content shape work, out of scope for pure structural refactor. | Phase 1-WP3 |
| Signed KB manifest | dependency-blocked | P0 ships explicit unsigned stub so Phase 1 fills fields without shape migration. | Phase 1 manifest-signing track |
| Formal `module-manifest.schema.json` | scope-cut | P0 uses field-presence checks only; no formal schema authored in P0. | Phase 1, or sooner if P0 executor judges field-presence insufficient |
| Public `moduleId` API surface | scope-cut | Explicitly excluded per zero-behavior-change guardrail and OQ-2 (Opus arbitration). | Phase 1+, when second module needs client-selectable targeting |
| `data/algorithm-explainers.json` and `examples/` relocation | scope-cut | Not KB content; moving now risks colliding with undesigned per-module UI-content convention. | Phase 2 (CBC suite) when second module's UI content would otherwise collide |
| Real headless-browser/runtime smoke check | research-needed | Shim strategy makes this acceptable for P0; no browser-execution test framework exists today. | Whichever phase (likely Phase 2 CBC client wiring) next substantively edits `app.js`/`algorithmExplorer.js` |

## 6. Risk Narrative

**Risk 1: Silent clinical-output drift** (High Impact, Medium Likelihood)
- **Scenario**: Subtle re-ordering of rule evaluation, fact derivation, or candidate merge changes ranked output without failing existing tests, invalidating the zero-behavior-change claim.
- **Mitigation**: P1 builds golden-output equivalence harness before any move; every phase's exit gate re-runs it; six-example byte-compare (modulo `generatedAt`) is the go/no-go per roadmap V2 gate.

**Risk 2: Content-hash cache-busting breakage** (Medium Impact, Medium Likelihood)
- **Scenario**: Restructuring KB file locations (commit 240e314 precedent: stamp built asset URLs with content hashes) can silently change hash inputs or break stamping, causing stale-cache mismatches for deployed users.
- **Mitigation**: SPIKE-002 governs design; P5 exit gate byte-compares served assets and confirms stamping still varies when content varies. One-time stamp-value change at relocation commit is expected, not regression.

**Risk 3: Clinical scope creep disguised as refactor** (High Impact, Low Likelihood)
- **Scenario**: "While we're in here" edits to KB JSON or thresholds would violate no-AI-published-rule-changes guardrail and invalidate equivalence claim.
- **Mitigation**: Hard rule in every task: KB JSON relocated, never edited (content diff must be empty). Reviewer gates run `diff <(git show main:...)` checks on all 4 relocated files at P1-T2 relocation commit.

**Risk 4: API surface drift on server generalization** (Medium Impact, Low Likelihood)
- **Scenario**: Introducing internal module iteration risks accidentally leaking a `moduleId` field or breaking mirror-API contract even though none is intended (OQ-2 binding).
- **Mitigation**: Default module = anemia; existing request/response shapes explicitly unchanged; legacy smoke-test assertions run unmodified as anti-regression backbone; `openapi.yaml` touched only if future phase approves surface change outside this PRD scope.

## 7. What to Watch For

**Shim Breakage Invisible to `npm run check`**
- `npm run check` never executes browser JS; a broken import path in `src/app.js` or `src/algorithmExplorer.js` is invisible to the gate.
- **Mitigation**: P7-T2 adds a static-resolution smoke check parsing every `import`/`fetch` specifier and resolving paths against disk.
- **Action**: Do not rely on `npm run check` to catch browser-side shim errors; the P7-T2 check is mandatory.

**Cache-Hash One-Time Change Is Expected**
- The `?v=<hash>` cache-busting value **will change once** at the P1 relocation commit (when KB files move into `modules/anemia/`).
- This is not a regression; it is structurally unavoidable when directories feeding the hash change.
- **Action**: Confirm with stakeholders beforehand that a one-time cache invalidation is expected and acceptable at the relocation commit.

**Golden-Fixture Baseline Must Exist Pre-Move**
- P1-T1 captures golden fixtures from unmodified `main` before ANY code moves.
- If the baseline is captured post-move, the equivalence gate is measuring "moved → moved again" instead of "unchanged → moved," defeating its purpose.
- **Action**: P1-T1 is the first task executed in this entire refactor; no other P1 task can run before P1-T1 completes and is committed.

**Sequencing Note 1 Dependencies Matter**
- P1-T3 must follow P1-T2 (relocation) because it swaps the hard-coded read-paths that were broken by the move.
- If the path-swap is not done in P1, `npm run check` will be red at the P1 boundary (broken reads), invalidating the phase-boundary gate requirement.
- **Action**: Do not batch P1-T2 and P1-T3 independently; execute P1-T3 immediately after P1-T2 completes.

## 8. Expected Success Behaviors

From PRD ACs (human-verifiable phrasing):

- **AC-1**: A test file (`tests/module-equivalence.test.mjs`) exists and passes, comparing live output for all 6 worked examples (`examples/anemia-inflammation.json`, etc.) against committed golden fixtures. Output is byte-identical modulo `meta.generatedAt`.

- **AC-2**: The `npm run check` command (test + validate + build + smoke) exits with code 0 at every phase boundary (end of P1, P2, P3, P4, P5, P6, P7).

- **AC-3**: Each of the 4 relocated KB JSON files (`modules/anemia/rules.json`, etc.) has zero content-line changes from its pre-move counterpart (`git show main:data/rules.json`, etc.) — confirmed by `diff` reporting no output or `git diff` showing only a rename (no edits).

- **AC-4**: A module-registry test (`tests/module-registry.test.mjs`) exists and passes, asserting: `MODULE_IDS` is non-empty and unique; `modules/anemia/module.json` exists, parses, and has `id: 'anemia'`; all per-module KB JSON files parse; `await loadModuleCode('anemia')` resolves and exports a `deriveFacts` function.

- **AC-5**: The `openapi.yaml` file shows zero diff from `main`; existing `GET /api/v1/knowledge-base` and `POST /api/v1/assess` request/response shapes are unchanged in any smoke-test run; no `moduleId` field, query param, or response echo added anywhere.

- **AC-6**: Built static assets (`dist/src/`, `dist/modules/`, `dist/data/`, `dist/examples/`) contain byte-identical file content pre/post refactor (paths change, bytes do not); the `?v=<hash>` cache-busting value is a deterministic function of content (re-building against unchanged source reproduces the same hash).

## 9. Running Log

*(Append-only during execution; entries added as phases complete.)*

- *[2026-07-17 18:47] Platform Foundation P0 progress tracking initialized. P1–P7 phase-progress files and context.md created. Ready for execution.*
