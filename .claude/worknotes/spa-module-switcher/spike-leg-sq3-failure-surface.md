---
schema_version: 2
doc_type: report
report_category: investigations
title: "SPIKE leg SQ-3: concrete failure surface when moduleId != anemia"
status: draft
created: 2026-07-22
feature_slug: spa-module-switcher
---

# SQ-3 — Failure surface when `moduleId ≠ 'anemia'`

All paths absolute-rooted at `/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/module-switcher-spa/`. Failures below were **executed**, not inferred (probe script over `src/engine.js#assess` with each module's real `rules.json`/`candidates.json`).

## 1. Assessment path — enumerated failures

**Correction to seeded context:** growth/kidney do **not** first fail at the evidence registry (`engine.js:83`). They fail ~60 lines earlier, at `engine.js:23`.

| # | Site | Module(s) | Actual failure mode |
|---|---|---|---|
| F1 | `src/units.js:75-81` → thrown at `:167`, called from `src/engine.js:23` | growth, kidney | `validateUnits` finds no `registeredUnitModules` entry (no `modules/growth_suite_v1/units.js` or `kidney_suite_v1/units.js` exists — only anemia + cbc have one) → returns `{ok:false, errors:[{moduleId, reason:'unregistered-module'}]}` → **`UnitRejectionError`, `code:'UNIT_REJECTED'`**. Verified by execution. |
| F2 | `src/app.js:20` + `:630`/`:534` | growth, kidney | `UNIT_REJECTED` ∈ `INPUT_REJECTION_CODES`, so F1 is caught and routed to `showInputRejection()` → the clinician sees heading **"Check the entered units"** (`app.js:693`) for a module that simply doesn't exist as a unit domain. **This is the single worst failure**: an unimplemented module masquerades as a clinician data-entry error. |
| F3 | `src/app.js:683` `formatRejectionDetail` | growth, kidney | The F1 detail is `{moduleId, reason}` — no `field`/`providedUnit`/`expectedUnit`. `escapeHtml(undefined)` → `''`, so it renders literally `<li><strong></strong>: entered "", expected </li>`. Empty-field garbage row. |
| F4 | `src/evidence/registry.js:52-62` via `engine.js:84,88` | growth, kidney (unreachable today behind F1; becomes live the moment units are registered) | `accessorsFor` **throws** `unknown module "growth_suite_v1"` for every rule in `ruleAudit`. `REGISTRY` (`:39-50`) holds only `anemia` + `cbc_suite_v1`. Not in `INPUT_REJECTION_CODES` → `showFatalError` (`app.js:668`) → "Application error". |
| F5 | `src/engine.js:49` `module.summarize(facts)` | growth, kidney | Returns `{notYetImplemented, notice}` (`modules/growth_suite_v1/index.js:46-51`) / `{status:'not_yet_implemented', message}` (`modules/kidney_suite_v1/index.js:37-42`) — **not** the anemia classification shape. Wrong-shaped data, no throw. |
| F6 | `src/app.js:269-274` | growth, kidney | Guards are `=== null`, but stub fields are `undefined`. Renders **`"undefined g/dL"`**, `"undefined fL"`, `"undefined–undefined fL"`. Clinically dangerous nonsense on a metric tile. |
| F7 | `src/app.js:298` | growth, kidney | `humanize(c.anemiaStatus)` where `c.anemiaStatus` is `undefined` → `'Indeterminate'` (`app.js:181`). Reads as "anemia status was evaluated and is indeterminate". It was never evaluated. |
| F8 | `src/app.js:275-283` | cbc, growth, kidney | `sourceLabels` and `classificationEvidence` are hardcoded anemia source IDs (`AAP2026_IDA`, `WHO2024_HB`). |
| F9 | `src/app.js:168-173` `citeChips` | **cbc** (the "working" module) | Filters on `EVIDENCE[id]`, which is anemia's 6 ids only (`src/evidence.js:9,22`). All 7 cbc rule evidence ids (`HEMATOLREP2024_NEUTROPENIA_REVIEW`, `CALIPER2020_HEMATOLOGY_I`, `CALIPER2023_MINDRAY_79PARAM`, `SCNIR2022_GCSF_OUTCOMES`, `COH2015_ELANE_MUTATIONS`, `JPEDS2023_DUFFY_NULL_NEUTROPENIA`, `PEDS2020_ISOLATED_NEUTROPENIA_OUTCOMES`) resolve to nothing → **citations silently vanish** from alerts, notes, candidates. Verified: 0/7 present. This is a guardrail breach ("every clinical statement ties to a source"). |
| F10 | `src/engine.js:47` | all | `meta.status` is the hardcoded literal `'Research prototype—not clinically validated'`, rendered at `app.js:290`. It does **not** say `unsigned-stub`. cbc/growth/kidney render identically to the `integrity-recorded` module. |
| F11 | `src/app.js:665` | all | `document.title` uses anemia's `KNOWLEDGE_BASE_VERSION` (`src/evidence.js:11`) regardless of module. |
| F12 | `src/app.js:94-166` `buildInput()` | growth, kidney | Emits the anemia CBC/labs shape. Growth (anthropometry) and kidney (creatinine/eGFR/BP) have no input surface at all. |

cbc_suite_v1 **runs and renders** (verified: engine label `Pediatric CBC Suite Deterministic CDSS`, valid anemia-shaped classification) because `modules/cbc_suite_v1/index.js:35-38` delegates all four hooks to anemia. Its output is anemia's classification wearing a CBC label — the exact misread `multi-bundle-conversion-e1.md:523` (R-4) warns about.

## 2. Render path — candidate object shapes

`c.anemiaStatus` has **no generic equivalent**. `summarize()` output is a per-module free-form object; only anemia defines `anemiaStatus`/`morphology`/`reticulocyteResponse`/`thresholdSource`/`ageBand` (`modules/anemia/index.js:4-20`).

`candidates.json` *entries* however **are uniform** across anemia and cbc — measured key set is identical: `id, label, category, summary, defaultNextSteps, evidence, sourcePassageId`. growth/kidney are `{}` (empty object). So `renderCandidates` (`app.js:322-343`), `renderAlerts`, `renderQuestions`, `renderNotes`, `renderLimitations` are already module-agnostic and need **no change**. Only `renderClassification` (`app.js:267-307`) is anemia-shaped, and it is the whole of the problem.

## 3. Adjacent surfaces

| Surface | Verdict |
|---|---|
| `src/algorithmExplorer.js` — `anemiaWalkthrough` (`:290-303`), `facts.anemia.*`/`facts.cbc.*`/`facts.retic.*` (`:257-366`), `fetch('./data/algorithm-explainers.json')` (`:583`) | **Out of scope**; must **gracefully degrade** — hide/disable the `#algorithm` tab for non-anemia modules with an explicit "not available for this module" state. It will throw on `facts.cbc.hb` for stub facts. |
| `examples/*.json` (6 anemia cases) + loader `app.js:525`, explorer `:616`; `<option>` list `index.html:101-108` | **Module-scoped.** For non-anemia modules the picker must be emptied/disabled, not left offering anemia cases. |
| `src/evidence.js:9` + `#evidence` tab (`index.html:548`, `app.js:404-416`) | **Module-scoped.** Every module has an `evidence.json` with `{knowledgeBaseVersion, reviewedThrough, sources}` (cbc 20, growth 11, kidney 12 sources) — so a per-module evidence view is feasible, but requires new per-module loaders registered in `src/evidence/registry.js:39-50` for growth/kidney. Until then, degrade to "no evidence view for this module". |
| `#rules` tab (`index.html:555`, `app.js:429-441`) | **Module-scoped and already generic** — it reads module-loaded `rules`/`candidates`. Only needs the empty-state wording for `rules.length === 0` (growth/kidney). |
| `src/referenceRanges.js:10-16`, `src/serverErrors.js:7` | **Out of scope.** Neither is imported by `src/app.js`; `referenceRanges.js` exists only for `tests/engine.test.mjs` (`:7`), `serverErrors.js` is server-only. |
| `#nav-rule-count`/`#nav-pattern-count` (`index.html:66`, set at `app.js:563-564`) | **Module-scoped** — already dynamic; only the hardcoded `91`/`26` HTML fallback needs neutralizing. |
| `index.html` copy: `:6,11,19,24,76,416,435,577` | **Module-scoped.** Title, brand, `<h1>Evaluate pediatric anemia</h1>`, footer must become module-derived (`module.json.title`). |

## 4. Fail-closed contract (per `docs/architecture.md:390`)

Shared invariants for **all four** cases: `currentAudit = null`; `$('#results').hidden = true`; `$('#results-placeholder').hidden = false`; `refreshAuditView()` — i.e. reuse the `showInputRejection` skeleton (`app.js:686-699`) but **as a distinct third state**, not the unit-rejection one. Must NOT happen: prior module's result left on screen; the audit JSON still downloadable; the assessment form left submittable; any fallback to `anemia`.

1. **Evidence registry throws (`evidence/registry.js:55`)** — "No assessment produced — evidence not available for module *X*"; disable submit; keep the module selector usable so the clinician can switch back.
2. **Hooks return `notYetImplemented`** — must be detected **before** render, not after. Preferred: gate on the module descriptor at selection time (a `renderable`/`assessable` capability flag), showing "*Growth Suite* is a package scaffold — no clinical logic is implemented. No assessment can be produced." Fall back on `summarize()` returning `notYetImplemented === true` / `status === 'not_yet_implemented'`. Must NOT render `renderClassification` at all (F6/F7).
3. **Manifest fails verification** (`src/kbVerify.js:203` `verifyManifest`, `READY_STATUS='integrity-recorded'` at `:43`) — refuse to load the module; state the actual status verbatim from the closed enum (`schemas/module-manifest.schema.json:22`). Must NOT downgrade to a warning: `build-static.mjs:76-79` already warns-instead-of-exits for non-default modules, so the browser is the *only* enforcement point.
4. **Module fetch 404** — mirror `app.js:558-560`'s existing message but scoped: "Unable to load module *X*'s knowledge base." Must NOT leave `rules`/`candidates` holding the previous module's data — reset both to `[]`/`{}` **before** the fetch.

Additionally: any status text must carry the `maxAgeDays: null` "**not enforced**" disclosure (`architecture.md:385-388`) — `dist/build-info.json` already exposes `evidenceStalenessPolicy` per module (`build-static.mjs:188-192`).

## 5. State & URL

**Nothing reads query params, `localStorage`, `sessionStorage`, or `document.cookie` anywhere in the repo** (verified by grep across `.js`/`.mjs`/`.html`, excluding `dist/`). The only URL state is `window.location.hash` for tab routing (`app.js:456-457,662,664`).

Recommendation: `?module=<id>` **yes** — it is deep-linkable, shareable, and validatable against `isRegisteredModule()` (`src/modules/registry.js:75`) with a fail-closed fallback. A module id is not PHI, and nothing else on the page would join it. `localStorage` **no**: it introduces a persisted client state the SPA has never had, and a stale persisted id silently changing the module on next visit is a fail-closed hazard. Note `switchTab` already calls ``history.replaceState(null,'',`#${tab}`)`` (`app.js:457`) — that call **drops the query string** unless rewritten to preserve it. That is a concrete required edit.

## 6. Gate breakage

### `scripts/smoke-browser-unit-rejection.mjs`

Breaking assertions (each greps `src/app.js` source text):

- `:132` `assert.match(appSource, /import\s+\{\s*assessPediatricAnemia\s*\}\s+from\s+['"]\.\/engine\.js['"]/)` — breaks if app.js switches to `import { assess }`.
- `:134` same assertion against `src/algorithmExplorer.js`.
- `:179` `assert.match(loadExampleBody, /assessPediatricAnemia\(input, rules, candidates\)/)`
- `:188` `assert.match(submitBody, /assessPediatricAnemia\(input, rules, candidates\)/)`
- `:216-223` imports `assessPediatricAnemia` from `dist/src/engine.js` and asserts `classification.anemiaStatus === 'present'`.

**Lowest-friction path:** keep `assessPediatricAnemia` exported (`engine.js:98-100`) and keep the anemia call shape, adding a *sibling* module-generic call — then extend, don't rewrite, `:179`/`:188` to accept `assessModule(currentModuleId, input, rules, candidates)`. Also add a new assertion block for the module-refusal UI (mirroring `:167-173`) so the third fail-closed state is pinned the same way `AGE_OUT_OF_SUPPORTED_RANGE` is. `:139-153`'s dist scan for unstamped fetches will pass with the pattern below.

### `scripts/check-app-imports.mjs` + the literal-specifier constraint

Do **not** use ``fetch(`./modules/${moduleId}/rules.json`)``: `:121-132` would only prefix-check `./modules`, losing per-file verification, and `build-static.mjs:148`'s regex ``(fetch\(\s*(['"`]))(\.\.?\/[^'"`?]+\.json)(\2)`` would not stamp it — serving unstamped KB JSON, exactly the stale-rules hazard `build-static.mjs:100-106` exists to prevent.

**Concrete pattern** — a literal-keyed map of thunks holding *literal* `fetch()` calls, mirroring `MODULE_CODE_LOADERS` (`src/modules/registry.js:68-73`):

```js
const MODULE_KB_LOADERS = Object.freeze({
  anemia: () => Promise.all([fetch('./modules/anemia/rules.json'), fetch('./modules/anemia/candidates.json')]),
  cbc_suite_v1: () => Promise.all([fetch('./modules/cbc_suite_v1/rules.json'), fetch('./modules/cbc_suite_v1/candidates.json')]),
  growth_suite_v1: () => Promise.all([fetch('./modules/growth_suite_v1/rules.json'), fetch('./modules/growth_suite_v1/candidates.json')]),
  kidney_suite_v1: () => Promise.all([fetch('./modules/kidney_suite_v1/rules.json'), fetch('./modules/kidney_suite_v1/candidates.json')]),
});
```

**Verified against all three regexes** (executed):
- `check-app-imports.mjs:92` extracts all 8 specifiers with `isDynamic: false` → each gets full `checkFetchSpecifier` dev+dist existence verification (`:137-144`). `dist/modules/{anemia,cbc_suite_v1,growth_suite_v1,kidney_suite_v1}/` all exist (build copies `modules` wholesale, `build-static.mjs:14`).
- `build-static.mjs:148` stamps all 8 → `./modules/anemia/rules.json?v=<stamp>`.
- `smoke-browser…:149-153` `doesNotMatch` passes on the stamped output (the `?` breaks its ``[^'"`?]+`` class).

**Required companion edit:** if this map lives in a new file rather than `src/app.js`, add that path to `APP_SURFACE_FILES` (`check-app-imports.mjs:48`) — pass (a) does not walk the import graph transitively (`:46-47`), so a new file would otherwise be unchecked.

### Other gates
- `scripts/verify-d4-built.mjs` iterates `MODULE_IDS` and already requires `dist/modules/<id>/rules.json` — unaffected.
- `tests/module-registry.test.mjs:24` asserts `DEFAULT_MODULE_ID === 'anemia'`. `src/modules/registry.js:38-50` states verbatim that a shipping "client-selectable moduleId surface (a UI control…)" is "the real trigger for turning this into a selection decision" — **this SPIKE's feature fires that tripwire**; the comment and test both need a deliberate decision, not a mechanical edit.
- Latent defect (seeded, confirmed relevant): `scripts/sign-kb.mjs:58-73` hardcodes `modules/anemia/…` for every module, so all four `clinicalContentHash` values are computed over anemia's files. Surfacing per-module integrity status in the switcher makes this **user-visible as a false attestation** — must be fixed before any per-module status chip ships.
