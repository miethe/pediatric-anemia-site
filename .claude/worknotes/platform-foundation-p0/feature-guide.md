---
doc_type: feature_guide
feature_slug: platform-foundation-p0
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
spike_ref:
  - docs/project_plans/SPIKEs/spike-001-module-package-boundary.md
  - docs/project_plans/SPIKEs/spike-002-multi-module-loader.md
created: 2026-07-18
---

# Platform Foundation Refactor — Feature Guide

**Status**: Complete (P1–P7 all phases landed; V2 gate PASS; npm run check green).

---

## 1. What Was Built

The anemia-specific rules runtime (`src/facts.js`, `src/engine.js`, `src/referenceRanges.js`) has been extracted into a **module-agnostic platform** with `modules/anemia/` proving the new `modules/<id>/` package contract. The knowledge-base content (rules, candidates, evidence, reference-ranges JSON) was relocated from `data/` into `modules/anemia/` byte-identically — verified against the pre-refactor baseline (`805fb64`). A permanent golden-fixture equivalence harness (`tests/golden/*.json` + `tests/module-equivalence.test.mjs`) captures real input/output examples before refactoring and proves zero clinical behavior change: all 6 worked examples (anemia-inflammation, beta-thalassemia-trait, hemolysis-hs, ida-toddler, lead-capillary, marrow-red-flags) return identical `assess()` output before and after.

---

## 2. Architecture Overview

### Package Contract

**`modules/anemia/` file shape:**
- `rules.json` — rule DSL array (91 rules, `schemas/rule.schema.json`)
- `candidates.json` — differential-pattern catalog (26 patterns, `schemas/candidate.schema.json`)
- `evidence.json` — evidence source records (6 records)
- `reference-ranges.json` — CBC reference-interval bands (AAP + local overrides)
- `module.json` — unsigned manifest stub (P6; `id`, `title`, `schemaVersion`, `status: "unsigned-stub"`, `engineLabel`, `knowledgeBaseVersion`, `evidenceReviewedThrough`, `supportedAgeMonths`, null signing/approval fields)
- `index.js` — module hook descriptor; default-exports `{ id, manifest, deriveFacts, summarize, limitations }`
- `facts.anemia.js` — fact-derivation logic (moved verbatim from `src/facts.js`; imports the six generic primitives from `src/facts/core.js` and range helpers from `modules/anemia/ranges.js`)
- `ranges.js` — registers hb/mcv/rdw bands + the ferritin threshold rule and exports the `getEffectiveRanges` composition wrapper (imports `reference-ranges.json` via `with { type: 'json' }` — this JSON file is load-bearing for the first time)

### Three Registries

1. **`src/facts/registry.js`** — fact-derivation dispatch. Exports `deriveFacts(input, moduleId)` over an explicit `Map`; throws `Unknown module: <id>` for unregistered ids. `modules/anemia/facts.anemia.js` is the sole registered derivation function; generic primitives live in `src/facts/core.js` (exactly six: `finite`, `num`, `isTrue`, `statusIs`, `includes`, `countTrue`).

2. **`src/ranges/registry.js`** — reference-range primitives: `registerAnalyteBands`, `registerThresholdRule`, `getBuiltInAnalyteValue` (banded lookup), `getThreshold` (non-banded, e.g. ferritin). Tolerant lookups: unregistered `(moduleId, analyte)` returns `null`, never throws. `modules/anemia/ranges.js` performs the registrations and exports the legacy-shaped composition wrapper.

3. **`src/modules/registry.js`** — module registry (static + enumeration API). Core exports: `getModule(id)` (returns module hook object, synchronous, used by `src/engine.js`'s `assess()`), `listModules()` (returns all hooks). Phase 5 adds: `MODULE_IDS`, `DEFAULT_MODULE_ID`, `loadModuleCode(moduleId)` (async), `isRegisteredModule(moduleId)` for scripts/server/tests.

### Shim Strategy

Three thin shims maintain the public API surface unchanged:
- `src/facts.js` — 1-arg `deriveFacts(input)` wrapper delegating to the facts registry with `moduleId = 'anemia'`.
- `src/referenceRanges.js` — pure re-export shim over `modules/anemia/ranges.js` (`getBuiltInRange`, `getEffectiveRanges`, `getFerritinThreshold`, `REFERENCE_RANGE_SOURCE`, `BUILT_IN_RANGES`).
- `assessPediatricAnemia()` — calls `assess(input, 'anemia', rules, candidates)` from the generalized engine; signature unchanged.

Existing consumers (`src/app.js`, `server.mjs`, tests) see no change in import paths or function calls.

---

## 3. How to Test

```bash
npm run check
```

This runs five sequential checks (all must pass):
1. `npm test` — `node --test tests/*.test.mjs` (20 tests total; see § 4)
2. `npm run validate` — per-module KB structural/reference checks + manifest drift check; outputs "Validated modules: anemia (91 rules, 26 candidates, 6 evidence records)"
3. `npm run build` — builds the static site, copying and content-stamping `dist/modules/`
4. `npm run check:imports` — `scripts/check-app-imports.mjs` (static specifier resolution against src and dist + dynamic module-graph load under Node)
5. `npm run smoke` — legacy smoke-test assertions plus a per-module internal-consistency loop

### Module-Specific Tests

```bash
node --test tests/module-equivalence.test.mjs
node --test tests/module-registry.test.mjs
```

- `module-equivalence.test.mjs` (6 subtests) — compares `assess()` output (post-refactor) against golden fixtures (`tests/golden/*.json`), proving zero behavioral change.
- `module-registry.test.mjs` (4 subtests) — verifies registry completeness, manifest shape, KB file parseability, and code-loader resolution.

---

## 4. Test Coverage Summary

**20 total tests** across `tests/*.test.mjs`:

- **`tests/engine.test.mjs`** — 10 tests on `src/engine.js` (rules, edge cases, merge/ranking logic)
- **`tests/module-equivalence.test.mjs`** — 6 tests comparing post-refactor `assess()` output to golden fixtures (6 real input/output pairs captured pre-refactor):
  - `anemia-inflammation` (moderate microcytic anemia + inflammation)
  - `beta-thalassemia-trait` (heterozygous carrier)
  - `hemolysis-hs` (hemolytic anemia, hereditary spherocytes)
  - `ida-toddler` (iron-deficiency anemia, age 2–3)
  - `lead-capillary` (capillary-collection artifact + lead exposure)
  - `marrow-red-flags` (hypoproliferative pattern + bone-marrow pathology signals)
- **`tests/module-registry.test.mjs`** — 4 tests:
  1. Registry completeness (anemia module registered, `getModule('anemia')` returns hook)
  2. Manifest shape (`module.json` parses, `manifest.id === 'anemia'`, fields present)
  3. Per-module KB file parseability (rules, candidates, evidence, reference-ranges all valid JSON)
  4. Code-loader resolution (`loadModuleCode('anemia')` async-imports `facts.anemia.js`, exports `deriveFacts`)

**Additional validation layers:**
- `scripts/validate-kb.mjs` — per-module rule/candidate/evidence reference integrity checks + `module.json` vs `src/evidence.js` version drift check (non-zero exit on mismatch)
- `scripts/check-app-imports.mjs` (new, permanent) — static import-specifier resolution + dynamic module-graph load (exercises `with { type: 'json' }` import-attribute path in Node; proves the browser shim strategy loads end-to-end)

---

## 5. Known Limitations

Eight design specifications are deferred from P0 to future phases; see `docs/project_plans/design-specs/`:

1. **`evidence-dual-source-unification.md`** — Unify `evidence.json` source records with inline evidence tags in rules/candidates (multi-source evidence consolidation)
2. **`tri-state-fact-model.md`** — Model facts as {present, absent, unknown} instead of boolean
3. **`exact-passage-evidence-schema.md`** — Link evidence to exact passages (section + paragraph locators) for traceability
4. **`signed-kb-manifest.md`** — Cryptographic signing of KB releases for integrity verification
5. **`module-manifest-json-schema.md`** — Formalize `module.json` schema (version, review dates, audit metadata)
6. **`public-moduleid-api-surface.md`** — Expose `moduleId` in REST API request/response (`?moduleId=` query, response echo); blocked in P0 by PRD OQ-2 resolution (no public module selection surface yet)
7. **`algorithm-explainers-examples-relocation.md`** — Move `data/algorithm-explainers.json` and `examples/` into the module package (deferred DEF-7)
8. **`headless-browser-runtime-smoke-check.md`** — Real browser-runtime smoke test for `src/app.js`/`src/algorithmExplorer.js` (deferred DEF-8; import-attributes work in Node 20.19.3 but actual browser execution remains unverified)

**Browser JSON-import-attribute caveat**: `modules/anemia/ranges.js` uses `with { type: 'json' }` (Chrome/Edge 123+, Safari 17.2+, Firefox 138+). Requires evergreen-browser baseline; not tested on older browser versions.

**No clinical validity claimed.** This is an **unvalidated research prototype**. Automated checks prove software behavior, never clinical validity, safety, diagnostic performance, or regulatory status. Every refactored component preserves the prior behavior byte-for-byte; no clinical rule or threshold has been changed, added, or removed. Validation gates (content → technical → retrospective → silent-mode → human-factors → interventional) remain a future phase.

---

## References

- **PRD**: `docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md`
- **Implementation Plan**: `docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md`
- **V2 Gate Results**: `.claude/worknotes/platform-foundation-p0/v2-gate-results.md`
- **Architecture**: `docs/architecture.md` (§2a, Module package architecture; §7, Production hardening roadmap)
