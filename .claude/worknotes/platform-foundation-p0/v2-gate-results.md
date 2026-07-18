---
title: "V2 Technical Gate Results — Platform Foundation Refactor (Phase 0)"
doc_type: worknote
feature_slug: "platform-foundation-p0"
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
created: 2026-07-18
phase: P7 (P7-T1, P7-T2)
baseline_commit: 805fb64
---

# V2 Technical Gate Results

Full re-run of the P7-T1 V2 technical gate, plus the P7-T2 permanent runtime app-surface smoke
check (`scripts/check-app-imports.mjs`). All checks below were run against the current worktree
state on top of commit `741f35f` (P6 complete), compared where noted against `805fb64` — the
pre-refactor `main` baseline when the KB still lived at `data/*.json`.

**Overall result: PASS. No anomalies found. Zero failures across all gate items.**

## AC-1 … AC-6 (PRD §11)

| AC | Description | Result | Evidence |
|----|--------------|:------:|----------|
| AC-1 | Golden output equivalence holds at every phase boundary (6 examples) | **PASS** | `node --test tests/module-equivalence.test.mjs` — 6/6 subtests pass (`anemia-inflammation`, `beta-thalassemia-trait`, `hemolysis-hs`, `ida-toddler`, `lead-capillary`, `marrow-red-flags`), all `assert.deepEqual` against `tests/golden/*.json` |
| AC-2 | `npm run check` is green at every phase boundary | **PASS** | `npm run check` (test+validate+build+smoke) exit 0; 20/20 subtests pass across `tests/*.test.mjs` |
| AC-3 | Relocated KB JSON content byte-identical to pre-move state | **PASS** | `diff <(git show 805fb64:data/<f>.json) modules/anemia/<f>.json` empty (exit 0) for `rules.json`, `candidates.json`, `evidence.json`, `reference-ranges.json` — verified against the **original** pre-refactor baseline, not an intermediate commit |
| AC-4 | Module-load test proves the registry is real, not documentation | **PASS** | `node --test tests/module-registry.test.mjs` — 4/4 assertions pass: (1) registry completeness, (2) manifest shape (`module.json` parses, `manifest.id === 'anemia'`), (3) per-module KB files parse, (4) `loadModuleCode('anemia')` resolves and exports `deriveFacts` |
| AC-5 | Public API surface unchanged | **PASS** | `diff <(git show 805fb64:openapi.yaml) openapi.yaml` empty (exit 0); `scripts/smoke-test.mjs` legacy assertions pass unmodified as part of `npm run check`; no `moduleId` field present in request/response shapes |
| AC-6 | Build output payload bytes unchanged; cache-busting still fires on real change | **PASS** | `dist/modules/anemia/{rules,candidates,evidence,reference-ranges,module}.json` byte-identical to source; repeated unperturbed rebuilds reproduce the identical stamp (`?v=bcd4e39efd08`, determinism); a source-content perturbation in an isolated `/tmp` copy changed the stamp to `?v=a2961c6783ec` (stamp is a true function of content) |

## P7-T1 — Gate Item Detail

| # | Check | Result | Evidence |
|---|-------|:------:|----------|
| 1 | `npm run check` end-to-end (test, validate, build, smoke) | **PASS** | All 4 steps exit 0; `test`: 20/20 pass; `validate`: "Validated modules: anemia (91 rules, 26 candidates, 6 evidence records)"; `build`: static site built, stamp `?v=bcd4e39efd08` applied to index.html and 4 modules; `smoke`: "Smoke test passed: KB 0.1.0-2026-07-15; 2 differential pattern(s) returned." |
| 2 | `node --test tests/module-equivalence.test.mjs` (individually) | **PASS** | 6/6 subtests pass in isolation |
| 3 | `node --test tests/module-registry.test.mjs` (individually) | **PASS** | 4/4 subtests pass in isolation |
| 4 | Empty content diff, `modules/anemia/rules.json` vs. `805fb64:data/rules.json` | **PASS** | `diff` exit 0, no output |
| 5 | Empty content diff, `modules/anemia/candidates.json` vs. `805fb64:data/candidates.json` | **PASS** | `diff` exit 0, no output |
| 6 | Empty content diff, `modules/anemia/evidence.json` vs. `805fb64:data/evidence.json` | **PASS** | `diff` exit 0, no output |
| 7 | Empty content diff, `modules/anemia/reference-ranges.json` vs. `805fb64:data/reference-ranges.json` | **PASS** | `diff` exit 0, no output |
| 8 | `dist/modules/anemia/*.json` byte-identical to source | **PASS** | `rules.json`, `candidates.json`, `evidence.json`, `reference-ranges.json`, `module.json` all identical (`diff` exit 0) |
| 9 | `./modules` fetch literals in `dist/src/app.js` carry the `?v=` stamp | **PASS** | `fetch('./modules/anemia/rules.json?v=bcd4e39efd08')`, `fetch('./modules/anemia/candidates.json?v=bcd4e39efd08')` present in `dist/src/app.js` |
| 10 | `openapi.yaml` zero diff vs. `805fb64` | **PASS** | `diff` exit 0, no output |

## P7-T2 — `scripts/check-app-imports.mjs` (new, permanent)

New permanent script at `scripts/check-app-imports.mjs`. Two passes:

- **(a) Static specifier resolution** — parses every `import ... from '...'` and `fetch('...')`
  specifier in `src/app.js` and `src/algorithmExplorer.js`, resolves each relative path against
  both the src-rooted dev layout and the built `dist/` layout (stripping any `?v=` stamp),
  exits non-zero on any unresolvable target. `import` specifiers resolve relative to the
  importing file's own directory (ES module semantics); `fetch()` specifiers resolve relative to
  the document base URI (index.html lives at the repo/dist root, confirmed via
  `<script type="module" src="./src/app.js">`), not the module's own location. Template-literal
  fetches with an interpolation (e.g. `` `./examples/${selected}.json` ``) are resolved by their
  static directory prefix.
- **(b) Dynamic module-graph load** — `await import()`s the non-DOM module graph under live Node:
  `src/engine.js`, `src/facts.js`, `src/modules/registry.js`, `modules/anemia/index.js`,
  `modules/anemia/ranges.js`. This exercises the `with { type: 'json' }` import-attribute path
  (`modules/anemia/ranges.js` imports `reference-ranges.json` this way) that the browser shim
  strategy depends on.

| Run | Result | Evidence |
|-----|:------:|----------|
| Real tree, current worktree state | **PASS** | Exit 0; "OK: all static import/fetch specifiers ... resolve under both dev and dist/ layouts"; all 5 dynamic-load targets report "OK: ... loaded" |
| `/tmp` breakage proof 1 — static fetch specifier (`fetch('./modules/anemia/rules.json')` → `rules-NONEXISTENT.json`) in an isolated `/tmp` copy | **DETECTED** | Exit 1; 2 FAIL lines (dev layout + dist layout unresolvable); real tree untouched |
| `/tmp` breakage proof 2 — dynamic import graph (`src/modules/registry.js`'s import of `modules/anemia/index.js` → `index-NONEXISTENT.js`) in an isolated `/tmp` copy | **DETECTED** | Exit 1; `ERR_MODULE_NOT_FOUND` surfaced for both `src/engine.js` and `src/modules/registry.js` load attempts; real tree untouched |

Both breakage tests were performed on a disposable copy at `/tmp/pfp0-check-a1` (never the real
tree — confirmed via `git status --short` on the real worktree showing no modification to any
tracked file, only the new `scripts/check-app-imports.mjs` and this worknotes file as untracked
additions). The disposable copy was reverted to baseline between the two breakage tests.

### Browser JSON-import-attribute note (per task instructions)

`modules/anemia/ranges.js` imports `reference-ranges.json` via `with { type: 'json' }`, a browser
feature requiring Chrome/Edge 123+, Safari 17.2+, or Firefox 138+. Check (b) above exercises this
import path under Node (which already supports import attributes in the Node 20.19.3 runtime used
here) and proves the module graph loads end-to-end, including this line. **This is not equivalent
to proving the feature works in a real browser** — actual browser-runtime execution (a headless
browser or manual smoke test) remains explicitly out of scope for P0, per **DEF-8**
(`docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md` Deferred Items
Triage Table: "Real headless-browser/runtime smoke check for `src/app.js`/`src/algorithmExplorer.js`
— the shim strategy makes this acceptable for P0; no browser-execution test framework exists in
this repo today."). A design spec for closing this gap is deferred to the phase that next
substantively edits `app.js`/`algorithmExplorer.js` (likely the Phase 2 CBC client wiring).

## Anomalies

None found. All AC-1…AC-6 items pass; all P7-T1 gate-item checks pass; `scripts/check-app-imports.mjs`
passes cleanly on the real tree and correctly detects both classes of injected breakage
(static-specifier and dynamic-import-graph) in an isolated `/tmp` copy without touching the real
worktree.
