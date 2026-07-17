---
schema_version: 2
doc_type: progress
title: "Progress: platform-foundation-p0 Phase 2 — Fact-Derivation Registry"
status: pending
created: 2026-07-17
feature_slug: platform-foundation-p0
phase: 2
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
---

# Phase 2: Fact-Derivation Registry

**Overview**: Split `src/facts.js` into `src/facts/core.js` (six generic primitives), `modules/anemia/facts.anemia.js` (anemia domain logic), and `src/facts/registry.js` (explicit dispatch). `src/facts.js` becomes a shim so existing callers (app, algorithmExplorer, engine.test) require zero edits.

**Entry Criteria**: P1 complete; `modules/anemia/` KB JSON in place.

**Exit Criteria**: `npm run check` green; golden outputs identical; `src/facts.js` is a shim; no new "core" primitives invented beyond the six SPIKE-001 identifies.

## Task Tracking

| Task ID | Name | Assigned Subagent | Model/Effort | Status | Notes |
|---------|------|-------------------|--------------|--------|-------|
| P2-T1 | `src/facts/core.js` — generic primitives | — | sonnet/extended | pending | Export six reusable, stateless primitives: `finite`, `num`, `isTrue`, `statusIs`, `includes`, `countTrue`. No imports, pure functions. Identical behavior to today's inline versions. |
| P2-T2 | `modules/anemia/facts.anemia.js` — moved domain logic | — | sonnet/extended | pending | Move `deriveFacts()` body verbatim (CBC/ferritin/retic/hemolysis/lead/smear/marrow derivation) into module file. Import six primitives from `../../src/facts/core.js`. Per Sequencing Note 3: import range helpers from `../../src/referenceRanges.js` unchanged (P4-T3 rewires this). Keep single-arg signature `deriveFacts(rawInput)`. |
| P2-T3 | `src/facts/registry.js` — explicit dispatch | — | sonnet/extended | pending | `const REGISTRY = new Map([['anemia', deriveAnemiaFacts]])`; `export function deriveFacts(input, moduleId)` looks up and calls registered function; throw `'Unknown module: ' + moduleId` if unregistered. Explicit static import only — no `import()`, no directory scanning. |
| P2-T4 | `src/facts.js` becomes a shim | — | sonnet/extended | pending | Re-export `deriveFacts` bound to `moduleId = 'anemia'`. Thin single-arg wrapper function (registry's `deriveFacts(input, moduleId)` is 2-arg; existing callers expect 1-arg). No edits to `app.js`/`algorithmExplorer.js`/`engine.test.mjs` needed. |

## Exit Gate Checklist

- [ ] `npm run check` green + golden outputs byte-identical
- [ ] `src/facts.js` is a shim; `app.js`, `algorithmExplorer.js`, `tests/engine.test.mjs` show zero diff
- [ ] `src/facts/core.js` contains exactly the 6 primitives, no more
- [ ] task-completion-validator sign-off

## Quick Reference

- **P2-T1**: general-purpose — "src/facts/core.js — generic primitives — see plan §Phase 2, P2-T1"
- **P2-T2**: general-purpose — "modules/anemia/facts.anemia.js — moved domain logic — see plan §Phase 2, P2-T2 + Sequencing Note 3"
- **P2-T3**: general-purpose — "src/facts/registry.js — explicit dispatch — see plan §Phase 2, P2-T3"
- **P2-T4**: general-purpose — "src/facts.js becomes a shim — see plan §Phase 2, P2-T4"
