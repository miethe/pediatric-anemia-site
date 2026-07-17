---
schema_version: 2
doc_type: progress
title: "Progress: platform-foundation-p0 Phase 3 — Engine Generalization"
status: pending
created: 2026-07-17
feature_slug: platform-foundation-p0
phase: 3
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
---

# Phase 3: Engine Generalization

**Overview**: Generalize `src/engine.js` to export `assess(input, moduleId, rules, candidates)` (4-arg). Move `classificationSummary`/`globalLimitations` into `modules/anemia/index.js` hooks; keep 4 boilerplate limitation strings as `CORE_LIMITATIONS` in engine. `assessPediatricAnemia` becomes a 1-line shim. Create `src/modules/registry.js` with `getModule(id)`/`listModules()` (P5 later extends this file additively with `MODULE_IDS`, `DEFAULT_MODULE_ID`, `MODULE_CODE_LOADERS`, `loadModuleCode()`, `isRegisteredModule()`). `src/ruleEngine.js` is read-only (confirmed module-agnostic by schema).

**Entry Criteria**: P2 fact registry green.

**Exit Criteria**: `npm run check` green; golden outputs identical; `src/ruleEngine.js` shows zero diff; `assessPediatricAnemia` is a shim.

## Task Tracking

| Task ID | Name | Assigned Subagent | Model/Effort | Status | Notes |
|---------|------|-------------------|--------------|--------|-------|
| P3-T1 | `src/modules/registry.js` (created here; extended in P5) | — | sonnet/extended | pending | Per SPIKE-001 RQ3 + Sequencing Note 2: `getModule(id)` returns `modules/anemia/index.js` default export; throw `'Unknown module: <id>'` if unregistered. `listModules()`. Explicit static import of `modules/anemia/index.js` — no dynamic import. P5-T1 extends this file additively with MODULE_IDS/MODULE_CODE_LOADERS exports; do not pre-empt P5. |
| P3-T2 | `modules/anemia/index.js` — hook descriptor | — | sonnet/extended | pending | Default export `{ id: 'anemia', manifest: { engineLabel, knowledgeBaseVersion, evidenceReviewedThrough }, deriveFacts, summarize, limitations }`. Per Sequencing Note 4: `manifest` fields hardcoded inline literal matching `src/evidence.js` consts exactly (P6 authors `module.json` to match, not the reverse). `summarize` = today's `classificationSummary()` moved verbatim; `limitations` = today's `globalLimitations()` minus 4 boilerplate strings (move to `CORE_LIMITATIONS` in engine). |
| P3-T3 | `src/engine.js` — `assess(input, moduleId, rules, candidates)` | — | sonnet/extended | pending | 4-arg signature. `CORE_LIMITATIONS` holds 4 boilerplate strings. Orchestrates `module.deriveFacts(input)` → `runRules(facts, rules, candidates)` → assembles `meta`/`classification`/`alerts`/`rankedDifferential`/`nextQuestions`/`interpretiveNotes`/`limitations`/`provenance` exactly as today. `assessPediatricAnemia(input, rules, catalog)` becomes 1-line shim: `return assess(input, 'anemia', rules, catalog)`. |
| P3-T4 | Confirm `src/ruleEngine.js` untouched | — | sonnet/extended | pending | Hard rule: `ruleEngine.js` is read-only (confirmed module-agnostic by schema inspection). Explicit verification: `git diff main -- src/ruleEngine.js` is empty at end of phase. |

## Exit Gate Checklist

- [ ] `npm run check` green + golden outputs byte-identical
- [ ] `src/ruleEngine.js` zero diff
- [ ] `assessPediatricAnemia` is a 1-line shim over `assess(input, 'anemia', rules, catalog)`
- [ ] `server.mjs`/`app.js`/`algorithmExplorer.js`/`engine.test.mjs` zero diff
- [ ] task-completion-validator sign-off

## Quick Reference

- **P3-T1**: general-purpose — "src/modules/registry.js (created here; extended in P5) — see plan §Phase 3, P3-T1 + Sequencing Note 2"
- **P3-T2**: general-purpose — "modules/anemia/index.js — hook descriptor — see plan §Phase 3, P3-T2 + Sequencing Note 4"
- **P3-T3**: general-purpose — "src/engine.js — assess(input, moduleId, rules, candidates) — see plan §Phase 3, P3-T3"
- **P3-T4**: general-purpose — "Confirm src/ruleEngine.js untouched — see plan §Phase 3, P3-T4"
