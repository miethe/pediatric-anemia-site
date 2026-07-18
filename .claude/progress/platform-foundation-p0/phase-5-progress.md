---
schema_version: 2
doc_type: progress
title: 'Progress: platform-foundation-p0 Phase 5 — Multi-Module Scripts/Server + Load
  Test'
status: completed
created: 2026-07-17
feature_slug: platform-foundation-p0
phase: 5
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
updated: '2026-07-18'
---

# Phase 5: Multi-Module Scripts/Server + Load Test

**Overview**: Extend `src/modules/registry.js` **additively** with SPIKE-002 API (`MODULE_IDS`, `DEFAULT_MODULE_ID`, `MODULE_CODE_LOADERS`, `loadModuleCode()`, `isRegisteredModule()`) — do not remove/restructure P3-T1's `getModule`/`listModules` exports. Rewrite `scripts/validate-kb.mjs`, `scripts/build-static.mjs`, `scripts/smoke-test.mjs`, `server.mjs` to iterate registered modules (logic change, not literal-path swap — that was P1-T3). No public `moduleId` field on API (binding OQ-2). Create two new tests. May run parallel to P4 (disjoint file ownership after P3).

**Entry Criteria**: P3 `assess(input, moduleId, ...)` signature green (soft prerequisite per SPIKE-002 OQ-002).

**Exit Criteria**: `npm run check` (incl. two new test files) green; built asset byte-compare passes; no `moduleId` field added to public request/response shapes (AC-5).

## Task Tracking

| Task ID | Name | Assigned Subagent | Model/Effort | Status | Notes |
|---------|------|-------------------|--------------|--------|-------|
| P5-T1 | Extend `src/modules/registry.js` | — | sonnet/adaptive | pending | Per SPIKE-002 Q1 + Sequencing Note 2: add `MODULE_IDS = Object.freeze(['anemia'])`, `DEFAULT_MODULE_ID = 'anemia'`, `MODULE_CODE_LOADERS` (literal enumerated `import()` map), `loadModuleCode(moduleId)`, `isRegisteredModule(moduleId)` — **additive** to P3-T1's `getModule`/`listModules`; do not remove/restructure. |
| P5-T2 | `scripts/validate-kb.mjs` — module iteration | — | sonnet/adaptive | pending | Wrap validation body in `validateModule(moduleId, root)`; loop `MODULE_IDS`; aggregate errors with `${moduleId}/` prefix. Read JSON directly (drop `src/evidence.js` import — collapses one instance of evidence dual-source). Add `module.json` shape check: `id` field matches directory (field-presence only; full drift check is P6-T2). |
| P5-T3 | `scripts/build-static.mjs` — module-aware build | — | sonnet/adaptive | pending | Per SPIKE-002 Q3: `directories` += `'modules'` (copied wholesale); `stampTargets` += `...(await collectFiles(path.join(dist, 'modules')))`; digest logic unchanged. `buildInfo.json` loops `MODULE_IDS`, reads each module's JSON, adds additive `modules: {anemia: {...}}` map; top-level fields unchanged. Confirm existing `fetch()` stamping regex covers `./modules/anemia/...` literals from P1-T3. |
| P5-T4 | `server.mjs` — module-aware startup + no public surface change | — | sonnet/adaptive | pending | Per SPIKE-002 Q4 + Sequencing Note 6: replace hard-coded reads with startup loop over `MODULE_IDS` building `modulesById` (`{rules, candidates, evidenceSources, manifest}` per id); fail-fast on missing/parse errors. `GET /api/v1/knowledge-base` gains additive `modules: {...}` key (always present, not conditional). `POST /api/v1/assess` calls `assess(input, 'anemia', rules, candidates)` — **no new request field, query param, meta.moduleId echo, or 400 unknown-module path**. |
| P5-T5 | `scripts/smoke-test.mjs` — internal consistency loop | — | sonnet/adaptive | pending | Keep existing assertions (HTTP 200 + regex matches) unscoped — anti-regression backbone. Add `for (const moduleId of MODULE_IDS)` loop asserting **internal** registry/module-data consistency (rule/candidate counts match module JSON) — **not** HTTP-level `?moduleId=` check. For P0 executes once (`anemia` only), proves plumbing. |
| P5-T6 | `tests/module-registry.test.mjs` (new; extended in P6) | — | sonnet/adaptive | pending | Per SPIKE-002 Q5 + Sequencing Note 5: assert (1) registry completeness (`MODULE_IDS` non-empty/unique, includes `DEFAULT_MODULE_ID = 'anemia'`), (3) per-module KB files parse without throwing, (4) `await loadModuleCode('anemia')` resolves + exports `deriveFacts`, (5) existing `engine.test.mjs` assertions unmodified. **Do not add assertion (2) (manifest shape)** — `module.json` doesn't exist until P6; P6-T3 extends with that assertion. |

## Exit Gate Checklist

- [ ] `npm run check` (incl. `tests/module-registry.test.mjs`) green + golden outputs byte-identical
- [ ] Built asset byte-compare: served KB bytes unchanged; stamp is deterministic; stamp varies when content varies
- [ ] `openapi.yaml` zero diff; no `moduleId` field on any request/response shape (AC-5)
- [ ] `scripts/smoke-test.mjs`'s pre-existing legacy assertions pass unmodified
- [ ] task-completion-validator sign-off

## Quick Reference

- **P5-T1**: general-purpose — "Extend src/modules/registry.js — see plan §Phase 5, P5-T1 + Sequencing Note 2"
- **P5-T2**: general-purpose — "scripts/validate-kb.mjs — module iteration — see plan §Phase 5, P5-T2 + Sequencing Note 6"
- **P5-T3**: general-purpose — "scripts/build-static.mjs — module-aware build — see plan §Phase 5, P5-T3"
- **P5-T4**: general-purpose — "server.mjs — module-aware startup + no public surface change — see plan §Phase 5, P5-T4 + Sequencing Note 6"
- **P5-T5**: general-purpose — "scripts/smoke-test.mjs — internal consistency loop — see plan §Phase 5, P5-T5"
- **P5-T6**: general-purpose — "tests/module-registry.test.mjs (new; extended in P6) — see plan §Phase 5, P5-T6 + Sequencing Note 5"
