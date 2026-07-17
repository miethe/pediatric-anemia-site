---
schema_version: 2
doc_type: progress
title: "Context: platform-foundation-p0"
status: pending
created: 2026-07-17
feature_slug: platform-foundation-p0
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
---

# Context: Platform Foundation P0

## Pointer Index

- **PRD**: `docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md` — Feature Brief, Goals, Requirements, Scope, ACs
- **Implementation Plan**: `docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md` — 7-phase task breakdown, sequencing notes, risk mitigation
- **SPIKE-001**: `docs/project_plans/SPIKEs/spike-001-module-package-boundary.md` — Module-package layout, fact registry, engine signature, range registry, equivalence strategy
- **SPIKE-002**: `docs/project_plans/SPIKEs/spike-002-multi-module-loader.md` — Script/server module iteration, cache-busting preservation, API surface, module-load test
- **Decisions Block**: `.claude/worknotes/platform-foundation-p0/decisions-block.md` — Phase boundaries, agent routing, risk hotspots, estimation anchors, model routing, open-question resolutions
- **Estimation Sanity Check**: `.claude/worknotes/platform-foundation-p0/estimation-sanity.md` — Bottom-up H1–H6 worksheet, per-area sum, anchor comparison
- **Hard Guardrails**: `CLAUDE.md` — No generative model in clinical decision path, no invented thresholds, no AI-published rule changes, no PHI in public microsite

## Binding Arbitrations (OQ Resolutions)

From decisions block §7, these are FINAL and do not reopen:

- **OQ-1**: Module discovery is static registry (`src/modules/registry.js`) with literal `MODULE_IDS`/`DEFAULT_MODULE_ID` + explicit `MODULE_CODE_LOADERS` map. No directory-scan, no dynamic-import-by-variable.
- **OQ-2**: NO public `moduleId` on the API in P0. SPIKE-001's no-surface-change position wins (zero-behavior-change guardrail). Scripts/server iterate modules internally; public request/response shapes and `openapi.yaml` untouched until Phase 1.
- **OQ-3**: Golden fixtures committed at `tests/golden/*.json`, captured pre-refactor in P1; permanent `tests/module-equivalence.test.mjs` auto-picked by `npm test` — harness is a lasting regression net, not P0-only tooling.
- **OQ-4**: `examples/` and `data/algorithm-explainers.json` stay top-level in P0; relocation deferred (not KB content, not in WP1 scope).
- **OQ-6**: `assess(input, moduleId, rules, candidates)` 4-arg signature (KB JSON always caller-loaded; browser has no fs). `assessPediatricAnemia` and `src/facts.js`/`src/referenceRanges.js` become 1-line re-export shims.
- **OQ-7**: `src/evidence.js` vs `data/evidence.json` / `module.json` duplication — P0 mitigates with validate-kb drift check; real unification deferred to Phase 1 signed manifest.

## Hard Rules

**Enforced at every task prompt, reviewer gate, and phase exit:**

1. **KB JSON relocated, never edited** — empty content diff on all 4 relocated files (`data/*.json` → `modules/anemia/*.json`); measured with `diff <(git show main:data/<file>) modules/anemia/<file>` at P1-T2 relocation commit and re-confirmed at P7-T1.

2. **Shim strategy for existing callers** — `src/facts.js`, `src/referenceRanges.js`, `assessPediatricAnemia` become thin re-export/wrapper shims so `src/app.js`, `src/algorithmExplorer.js`, `tests/engine.test.mjs` require zero edits (existing import/call sites keep working unchanged). This keeps the browser's unbundled ES-module loading path intact.

3. **Public API surface unchanged** — no `moduleId` request field, query param, or response echo added to `GET /api/v1/knowledge-base` or `POST /api/v1/assess`; `openapi.yaml` untouched in P0 (OQ-2 binding); `scripts/smoke-test.mjs` legacy assertions run unmodified as the anti-regression backbone.

4. **Equivalence gate at every phase boundary** — `npm run check` green (test + validate + build + smoke) + golden outputs byte-identical (modulo `meta.generatedAt`) for all 6 `examples/`, starting from P1 forward. This is the go/no-go for every phase; a phase cannot be sealed on a red gate.

5. **No new clinical content or threshold edits** — per CLAUDE.md hard guardrail (no AI-published rule changes). This is a structural refactor only; all KB JSON moves are content-preserving relocations.
