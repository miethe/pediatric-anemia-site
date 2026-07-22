---
schema_version: 2
doc_type: spike
title: "SPIKE-008: SPA Module Switcher — eligibility, banner truth source, and the non-anemia failure surface"
status: completed
created: 2026-07-22
completed: 2026-07-22
feature_slug: spa-module-switcher
research_questions:
  - "SQ-1 — Which of the four registered modules may be presented as selectable in a clinician-facing switcher, and how are non-peer modules presented without implying a maturity ladder toward clinical release?"
  - "SQ-2 — Where does the status banner's truth come from, and what can a browser honestly claim to have verified about a module's knowledge base?"
  - "SQ-3 — What concretely happens today when the SPA is driven with moduleId != 'anemia', end to end through assess() and the render path, and which repo gates break when the call shape changes?"
  - "SQ-4 — How does this feature reconcile with the stale public-moduleid-api-surface design spec, ADR-0001, the E1 FR-14/R-8 prohibition, and the governance gate registry?"
complexity: L
estimated_research_time: "6h (4 parallel legs)"
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: null
related_documents:
  - .claude/worknotes/spa-module-switcher/exploration-findings.md
  - .claude/worknotes/spa-module-switcher/spike-leg-sq1-module-eligibility.md
  - .claude/worknotes/spa-module-switcher/spike-leg-sq2-banner-truth-source.md
  - .claude/worknotes/spa-module-switcher/spike-leg-sq3-failure-surface.md
  - .claude/worknotes/spa-module-switcher/spike-leg-sq4-prior-art-reconciliation.md
  - .claude/worknotes/spa-module-switcher/decisions-block.md
  - docs/project_plans/SPIKEs/spike-002-multi-module-loader.md
  - docs/project_plans/design-specs/public-moduleid-api-surface.md
  - docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
---

# SPIKE-008: SPA Module Switcher

> **Research record only.** This document reports what four parallel investigation legs found and
> what design decisions those findings force. It **authorizes nothing**: no module status changes, no
> gate is cleared, no clinical review or sign-off is implied or recorded, and no module becomes
> clinically releasable as a consequence of anything written here. Every module's
> `module.json.status` and `approvedBy[]` are exactly what they were before this SPIKE ran. The
> feature this SPIKE informs is a **presentation-layer honesty surface** — it makes the platform's
> existing non-parity perceivable to a reader; it does not change it.

Greenfield: no approved WP, PRD, or AC set for a module switcher exists. The expansion roadmap
(`docs/project_plans/expansion/01-platform-expansion-roadmap.md`) has no module-selection work
package; its only UI WPs are P3-WP7 (tri-state questionnaire, `:288`) and P1-WP7 (clinical-review
portal, concept only, `:165`). The P0/E0/E1 PRDs all state the SPA is untouched.

Depends on: P0's module-package architecture (SPIKE-001, SPIKE-002) and E1's multi-bundle conversion
(commit `263120b`), which registered the three non-anemia modules this SPIKE is about.

---

## Purpose

Commit `263120b` registered `cbc_suite_v1`, `growth_suite_v1`, and `kidney_suite_v1` alongside
`anemia`. The runtime became multi-module; the browser did not. `src/app.js` still fetches
`./modules/anemia/rules.json` and `./modules/anemia/candidates.json` (`src/app.js:555-556`) and calls
`assessPediatricAnemia` (`src/app.js:1`, `src/engine.js:99`), so three registered modules ship inside
`dist/` while being invisible and unreachable from the clinician-facing surface.

The proposed feature is a browser module switcher. Before committing to it, four things were unknown
and all four were load-bearing:

1. Whether any module other than `anemia` may honestly be offered as selectable at all (SQ-1).
2. What a status banner could truthfully assert, given that verification happens in Node at build
   time and the browser has no equivalent capability (SQ-2).
3. What actually happens today if the engine is driven with a non-anemia `moduleId` — the pre-SPIKE
   scoping had a guess, and the guess was wrong (SQ-3).
4. Whether the E1 `FR-14`/`R-8` prohibition on a client-selectable `moduleId` surface forbids this
   feature outright, and what governance paperwork it requires (SQ-4).

The single highest-value output is **§ Verified Corrections** — five beliefs the pre-SPIKE scoping
held that execution disproved. Two of them describe live defects in the current build.

---

## SQ-1 — Module eligibility & non-peer presentation

**Leg report:** `.claude/worknotes/spa-module-switcher/spike-leg-sq1-module-eligibility.md`

### Question

Which of the four registered modules may be presented as selectable, and how must the other three be
presented so that a clinician cannot read them as "temporarily unavailable" or as steps on a ladder
toward clinical release?

### Method

Read every module's `module.json` and `index.js` hook implementations; read the closed status enum in
`schemas/module-manifest.schema.json`; cross-read `docs/governance/gates-registry.md` G4 and
`docs/architecture.md` §2a's module inventory; executed `assess()` against each module's real
`rules.json`/`candidates.json` to establish what each module actually produces; enumerated four
candidate presentation options and tested each against the schema and governance constraints.

### Findings

**The four modules are not peers, and the schema already says which are servable.**

| Module | `module.json.status` | rules | Renderable today |
|---|---|---|---|
| `anemia` | `integrity-recorded` | 91 | Yes — the only one |
| `cbc_suite_v1` | `unsigned-stub` | 4 (1 candidate) | Runs, but see below |
| `growth_suite_v1` | `unsigned-stub` | 0 (`[]`) | No — every hook returns `notYetImplemented: true` (`modules/growth_suite_v1/index.js:35-39`) |
| `kidney_suite_v1` | `unsigned-stub` | 0 (`{}`) | No — same (`modules/kidney_suite_v1/index.js:30-34`) |

`schemas/module-manifest.schema.json:22` defines a **closed** status enum —
`["unsigned-stub", "integrity-recorded", "superseded", "revoked"]` — and `:23` states that
`integrity-recorded` "is the only status the server/build/browser will serve." `src/kbVerify.js:43`
encodes the same fact as `READY_STATUS = 'integrity-recorded'`. `docs/architecture.md:37-38` states
verbatim that module statuses "are **not** uniform — read each row rather than assuming parity across
modules."

**`cbc_suite_v1` runs, and that is the problem, not the solution.**
`modules/cbc_suite_v1/index.js:25,34-38` delegates `deriveFacts`/`assertInScope`/`summarize`/
`limitations` to the **anemia** module. Executed: `assess(input, 'cbc_suite_v1', …)` returns a
classification of shape `{anemiaStatus, hemoglobin, morphology, mcv, rdw, reticulocyteResponse, …}`
under `meta.engine = "Pediatric CBC Suite Deterministic CDSS"`. No output field discloses the
delegation — `limitations()` is anemia's, `meta` carries only the CBC label. A clinician would read
"CBC Suite" as broader than anemia; it is strictly narrower (4 rules vs 91) and computed by anemia.
This is precisely the misread `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md:523`
(R-4) warns about.

**Four options evaluated:**

| | Shape | Verdict |
|---|---|---|
| (a) `integrity-recorded` only | 1 row, others invisible | Defensible, no rule violated — but forfeits the feature's only present-day value and leaves `docs/architecture.md:38-39`'s non-parity invisible |
| (b) All listed, non-ready demoted | 4 rows, 3 inert | Acceptable **if** vocabulary is schema-literal; soft words ("preview", "beta") imply a transition `docs/governance/gates-registry.md:130` makes schema-impossible |
| (c) All selectable, banner-only | 4 rows, all runnable | **Unacceptable** — violates `schemas/module-manifest.schema.json:23` and `src/kbVerify.js:43`; realizes R-4; re-triggers the false unit-rejection screen (see SQ-3) |
| (d) Tiered labelled groups | (b) plus explicit group headers | **Best** — non-parity becomes structural rather than a per-row footnote a clinician can skim past |

**Vocabulary.** The originally requested phrase "unsigned proposal · not clinically reviewed" is
rejected as a status token: "unsigned proposal" is not in the closed enum
(`schemas/module-manifest.schema.json:22`), so it invents a fifth token and reads as a stage in a
pipeline `docs/governance/gates-registry.md:130-132` forbids. The enum value must render verbatim; the
second clause must be derived from `approvedBy.length === 0` (schema-pinned `maxItems: 0`,
and `schemas/module-manifest.schema.json:5` — "Structural validity here never implies clinical
validity, safety, or that a named human clinician reviewed anything"), not hardcoded.

There is **no green state**: `integrity-recorded` reads "content hashes verified **only**", and the
sentence that follows it is identical to the scaffolds'. The word *only* is load-bearing.

`.claude/worknotes/spa-module-switcher/exploration-findings.md:104` confirms **no test asserts the
exact banner or disclaimer strings today** — wording is convention-enforced by docs alone, so a
switcher adding status text has no existing harness to conform to and must create one.

### Conclusion

**Option (d).** `status === 'integrity-recorded'` is the sole selectability predicate, evaluated in
the UI layer **before** any `assess()` call — never by catching an engine throw. The predicate must
reference `READY_STATUS` imported from `src/kbVerify.js:43`, not a hardcoded literal. Today that
yields one selectable module and three inert rows. That is the honest state of the platform, and
making it perceivable is the deliverable. Rows source from `dist/build-info.json`
(`scripts/build-static.mjs:184-192`, already carrying per-module `status`/`approvedBy`/
`validationRunId`) or the manifests directly (see SQ-2). Growth/kidney rows should state their own
`engineLabel` — which already reads "… (not yet implemented)" — plus their `limitations()` notice
text; both are existing repo strings, so no new clinical prose is invented.

---

## SQ-2 — Banner truth source & browser honesty boundary

**Leg report:** `.claude/worknotes/spa-module-switcher/spike-leg-sq2-banner-truth-source.md`

### Question

Where should a per-module status banner read its facts from, and what — precisely — can a browser
claim to have verified about a module's knowledge base?

### Method

Enumerated three candidate truth sources and tested each against four constraints: dev (no `dist/`),
built `dist/`, the build's `?v=` content-hash stamping, and `npm run check:imports`. Read
`src/kbVerify.js` line by line to enumerate what `verifyManifest()` checks and which inputs a browser
can supply. Computed and compared actual SHA-256 digests of `modules/anemia/ranges.js` dev vs `dist/`.

### Findings

| | (a) fetch `module.json` + run `verifyManifest()` in-browser | (b) fetch `dist/build-info.json` | (c) static JSON import |
|---|---|---|---|
| Dev (no `dist/`) | Runs, but verdict structurally incomplete | **Fails** — no `build-info.json` at repo root (untracked; `.gitignore:2` = `dist/`) | **Works** — precedent shipped: `modules/anemia/facts.anemia.js:5` imports `./module.json`; `src/evidence.js:9` imports `evidence.json` |
| Built `dist/` | **Fails — decisive** (below) | Works | Works |
| `?v=` stamping | Breaks it | JSON untouched (`scripts/build-static.mjs:140` skips non-`.js`); `build-info.json` written post-stamp (`:213`) | Survives — specifier stamped at `:144`, JSON MIME unaffected; `rules.json` bytes verified identical dev↔dist |
| `check:imports` | Literal-only, 4 fetches | **Fails** — `checkFetchSpecifier` resolves `./build-info.json` against `repoRoot` (`scripts/check-app-imports.mjs:137-141`) → missing in dev → exit 1 | Passes, **if** the new file is added to `APP_SURFACE_FILES` (`:48`); pass (a) is explicitly non-transitive (`:46-47`) |
| Cost | 24 fetches + 6 WebCrypto digests + JCS canonicalization on load | 1 fetch | 4 JSON files in the static graph; anemia's already there |

**In-browser `verifyManifest()` is impossible in `dist/`.** `clinicalContentHash` is computed over the
raw bytes of `ranges.js` and `facts.anemia.js` (`src/kbVerify.js:60-68`, `scripts/sign-kb.mjs:68-76`),
but `scripts/build-static.mjs:139-153` rewrites **every** `.js` file to append `?v=`. Executed and
verified: `modules/anemia/ranges.js` digests to `49a597cb…`, `dist/modules/anemia/ranges.js` to
`d154a20c…`. The digest can never match in a built site.

**Two inputs the browser cannot supply to `verifyManifest()`:**

- `schemaErrors` — the file's own doc comment (`src/kbVerify.js:185-188`) states it does not validate;
  the validator is `scripts/lib/json-schema-lite.mjs`, deliberately unreachable from a browser build.
  Node callers compute it (`server.mjs:37-39`, `scripts/build-static.mjs:53`). A browser passing the
  default `[]` (`src/kbVerify.js:207`) is asserting "no schema errors" **without having looked** — a
  silent false negative.
- `sourceFiles` raw bytes — impossible in `dist/` per above.

`governanceHash` **is** browser-computable (`src/kbVerify.js:217` uses only `moduleId` plus manifest
fields) — but a manifest that lies about itself self-consistently still hashes correctly. It proves
internal consistency, not content authenticity.

**Evidence staleness.** Showing `evidenceReviewedThrough` makes the banner a consumer of the expiry
verdict, which `src/evidenceStalenessPolicy.js:11-14` requires to "disclose that non-enforcement
loudly." `docs/architecture.md:385-390` records that expiry is "Disclosed but not yet enforced",
`maxAgeDays` is `null`, and `null` must never read as "checked and passed."
`src/kbVerify.js:132-141` already returns the disclosure string and
`scripts/build-static.mjs:188-192` already carries it into `build-info.json` as
`evidenceStalenessPolicy.{maxAgeDays: null, enforced: false, disclosure}`.

(Incidental drift found while reading manifests: `kidney_suite_v1`'s `module.json` declares
`0.0.0-2026-07-22` while its `evidence.json` declares `0.1.0-2026-07-22`.)

### Conclusion

**Option (c): static JSON import.** A new `src/moduleManifests.js` holding four literal
`import m from '../modules/<id>/module.json' with { type: 'json' }` lines, exported as a frozen
moduleId-keyed map, registered in `APP_SURFACE_FILES` (`scripts/check-app-imports.mjs:48`) and
`DYNAMIC_IMPORT_TARGETS` (`:50-59`). Flow: build-time-literal static import → already-parsed object →
**no verification step** → render `status`, `approvedBy.length === 0`, `validationRunId`,
`evidenceReviewedThrough` plus the fixed non-enforcement disclosure.

The honesty boundary must appear in the UI itself, not a tooltip:

> Status shown is read from this module's published manifest. The browser has not verified it — no
> content digest was recomputed, no schema was validated, and no check confirms the loaded rules are
> the rules that were signed. `integrity-recorded` records a content digest only; it is not clinical
> review, validation, or approval — `approvedBy` is empty for every module. Evidence-staleness expiry
> is not enforced; "reviewed through" is a declared date, not a checked one.

**Hard prohibition:** the UI must not surface any hash, `hashes.recomputed`, or the phrases "integrity
verified" / "content unmodified" — see the `sign-kb.mjs` correction below.

---

## SQ-3 — Failure surface when `moduleId != 'anemia'`

**Leg report:** `.claude/worknotes/spa-module-switcher/spike-leg-sq3-failure-surface.md`

### Question

What concretely happens today, end to end, when the engine and render path are driven with a
non-anemia module — and which repo gates break when the engine call shape changes?

### Method

Executed, not inferred: a probe script driving `src/engine.js#assess` with each module's real
`rules.json`/`candidates.json`, then tracing each resulting value through `src/app.js`'s render
functions. Grepped `src/app.js`, `src/algorithmExplorer.js`, `src/evidence.js` for state and URL
handling. Ran each candidate fetch pattern against all three of the repo's specifier regexes
(`scripts/check-app-imports.mjs:92`, `scripts/build-static.mjs:148`,
`scripts/smoke-browser-unit-rejection.mjs:149-153`).

### Findings — twelve enumerated failures

| # | Site | Module(s) | Failure |
|---|---|---|---|
| F1 | `src/units.js:75-81`, thrown at `:167`, called from `src/engine.js:23` | growth, kidney | No `registeredUnitModules` entry (no `modules/growth_suite_v1/units.js` or `kidney_suite_v1/units.js` exists) → `{ok:false, errors:[{moduleId, reason:'unregistered-module'}]}` → `UnitRejectionError`, `code:'UNIT_REJECTED'` |
| F2 | `src/app.js:20` + `:534`/`:630` | growth, kidney | `UNIT_REJECTED` ∈ `INPUT_REJECTION_CODES` → routed to `showInputRejection()` → clinician sees heading **"Check the entered units"** (`src/app.js:693`). **The single worst failure**: an unimplemented module masquerades as a clinician data-entry error |
| F3 | `src/app.js:683` `formatRejectionDetail` | growth, kidney | Detail is `{moduleId, reason}` — no `field`/`providedUnit`/`expectedUnit`; `escapeHtml(undefined)` → `''`, rendering literally `<li><strong></strong>: entered "", expected </li>` |
| F4 | `src/evidence/registry.js:52-62` via `src/engine.js:84,88` | growth, kidney (unreachable behind F1 today) | `accessorsFor` throws `unknown module "growth_suite_v1"`; `REGISTRY` (`:39-50`) holds only `anemia` + `cbc_suite_v1`. Not an input-rejection code → `showFatalError` (`src/app.js:668`) → "Application error" |
| F5 | `src/engine.js:49` `module.summarize(facts)` | growth, kidney | Returns `{notYetImplemented, notice}` (`modules/growth_suite_v1/index.js:46-51`) / `{status:'not_yet_implemented', message}` (`modules/kidney_suite_v1/index.js:37-42`) — wrong shape, no throw |
| F6 | `src/app.js:269-274` | growth, kidney | Guards test `=== null`, but stub fields are `undefined` → renders **"undefined g/dL"**, "undefined fL", "undefined–undefined fL" on metric tiles |
| F7 | `src/app.js:298` | growth, kidney | `humanize(c.anemiaStatus)` with `undefined` → `'Indeterminate'` (`src/app.js:181`) — reads as "anemia status was evaluated and is indeterminate." It was never evaluated |
| F8 | `src/app.js:275-283` | cbc, growth, kidney | `sourceLabels`/`classificationEvidence` are hardcoded anemia source IDs (`AAP2026_IDA`, `WHO2024_HB`) |
| F9 | `src/app.js:168-173` `citeChips` | **cbc** — the "working" module | Filters on `EVIDENCE[id]`, anemia's 6 ids only (`src/evidence.js:9,22`). All 7 cbc rule evidence ids resolve to nothing → **citations silently vanish**. Verified 0/7 present |
| F10 | `src/engine.js:47` | all | `meta.status` is the hardcoded literal `'Research prototype—not clinically validated'`, rendered at `src/app.js:290` — never says `unsigned-stub`; stubs render identically to the `integrity-recorded` module |
| F11 | `src/app.js:665` | all | `document.title` uses anemia's `KNOWLEDGE_BASE_VERSION` (`src/evidence.js:11`) regardless of module |
| F12 | `src/app.js:94-166` `buildInput()` | growth, kidney | Emits the anemia CBC/labs shape; growth (anthropometry) and kidney (creatinine/eGFR/BP) have no input surface at all |

The seven vanishing cbc evidence IDs (F9) are `HEMATOLREP2024_NEUTROPENIA_REVIEW`,
`CALIPER2020_HEMATOLOGY_I`, `CALIPER2023_MINDRAY_79PARAM`, `SCNIR2022_GCSF_OUTCOMES`,
`COH2015_ELANE_MUTATIONS`, `JPEDS2023_DUFFY_NULL_NEUTROPENIA`,
`PEDS2020_ISOLATED_NEUTROPENIA_OUTCOMES`. Losing them breaches the CLAUDE.md guardrail "every
clinical statement ties to a source."

**Render path.** `c.anemiaStatus` has no generic equivalent — only anemia defines
`anemiaStatus`/`morphology`/`reticulocyteResponse`/`thresholdSource`/`ageBand`
(`modules/anemia/index.js:4-20`). But `candidates.json` *entries* are uniform across anemia and cbc
(measured identical key set: `id, label, category, summary, defaultNextSteps, evidence,
sourcePassageId`), so `renderCandidates` (`src/app.js:322-343`), `renderAlerts`, `renderQuestions`,
`renderNotes`, `renderLimitations` are already module-agnostic and need no change. Only
`renderClassification` (`src/app.js:267-307`) is anemia-shaped — and it is the whole of the problem.

**State & URL.** Nothing in the repo reads query params, `localStorage`, `sessionStorage`, or
`document.cookie` (verified by grep across `.js`/`.mjs`/`.html`, excluding `dist/`). The only URL
state is `window.location.hash` for tab routing (`src/app.js:456-457,662,664`). `switchTab` calls
``history.replaceState(null,'',`#${tab}`)`` at `:457`, which **drops the query string** unless
rewritten — a concrete required edit if `?module=<id>` ships.

**Gate breakage.** `scripts/smoke-browser-unit-rejection.mjs` greps `src/app.js` source *text*:
`:132` asserts the exact line `import { assessPediatricAnemia } from './engine.js'`; `:134` the same
against `src/algorithmExplorer.js`; `:179`/`:188` assert `assessPediatricAnemia(input, rules,
candidates)` inside `loadExampleBody`/`submitBody`; `:216-223` imports from `dist/src/engine.js` and
asserts `classification.anemiaStatus === 'present'`. Any change to the engine call shape breaks it.

The template-literal fetch ``fetch(`./modules/${moduleId}/rules.json`)`` is **not viable**:
`scripts/check-app-imports.mjs:121-132` would only prefix-check `./modules`, losing per-file
verification, and `scripts/build-static.mjs:148`'s regex would not stamp it — serving unstamped KB
JSON, exactly the stale-rules hazard `scripts/build-static.mjs:100-106` exists to prevent. The
verified-viable pattern is a literal-keyed map of thunks holding literal `fetch()` calls, mirroring
`MODULE_CODE_LOADERS` (`src/modules/registry.js:68-73`); executed against all three regexes, all 8
specifiers extract with `isDynamic: false`, all 8 stamp, and the smoke test's `doesNotMatch` passes on
the stamped output.

### Conclusion

The refusal state must be a **distinct third state** alongside success and input-rejection — never a
reuse of `showInputRejection`. Shared invariants for every refusal: `currentAudit = null`;
`#results` hidden; `#results-placeholder` shown; `refreshAuditView()`; submit disabled; module
selector stays usable. Must not happen: prior module's result left on screen, audit JSON still
downloadable, or any silent fallback to `anemia`. Four refusal cases are specified in the leg report
§4 (evidence-registry throw, `notYetImplemented` hooks, manifest fails verification, module fetch
404). Note that `scripts/build-static.mjs:76-79` warns-instead-of-exits for non-default modules, so
the browser is the only enforcement point for the third case.

Gate strategy is **extend, don't rewrite**: retain the `assessPediatricAnemia` export
(`src/engine.js:98-100`) and its call shape, add a sibling module-generic call, and extend
`:179`/`:188` rather than replacing them.

---

## SQ-4 — Prior-art reconciliation & governance paperwork

**Leg report:** `.claude/worknotes/spa-module-switcher/spike-leg-sq4-prior-art-reconciliation.md`

### Question

How does this feature reconcile with `public-moduleid-api-surface.md`, ADR-0001, the E1 FR-14/R-8
prohibition, and the gates registry — and what paperwork must exist before it ships?

### Method

Read `docs/project_plans/design-specs/public-moduleid-api-surface.md` in full and classified its
scope by quotation; grepped `src/app.js`/`src/algorithmExplorer.js`/`src/evidence.js` for `/api/`
calls; read ADR-0001's trigger clause and `docs/project_plans/design-specs/cbc-suite-full-authoring.md`
OQ-7; read `docs/governance/gates-registry.md` G0–G4 against this feature's change set.

### Findings

**`public-moduleid-api-surface.md` is a server-API spec, not a browser-UX spec.** Its Problem/Context
and Design Sketch are entirely about `POST /api/v1/assess` and `GET /api/v1/knowledge-base` — "the
natural shape is additive to the existing `POST /api/v1/assess` contract" (`:58`), "Accept an optional
`moduleId` field in the request body" (`:61`). The SPA appears exactly once, as a downstream
consequence, never designed: the SPA "would need a module-selection UI element wired to the new
parameter — currently entirely absent" (`:72-73`, also stated at `:77-79`). Its `:93` leaves
"single-module-at-a-time vs. combined view" an open question, and its `:99-134` 2026-07-21 deferral
re-confirmation is now **factually stale** — it asserts "No second module directory exists under
`modules/`", invalidated by commit `263120b`.

**Its promotion trigger half-fired.** The "second module registered" clause has fired; the other
clause — a client needing to choose *via the HTTP API* — has **not**, because the browser switcher
never calls the HTTP API. Verified: `src/app.js` makes zero `/api/` fetches; every fetch is relative
(`./modules/…`, `./examples/…`, `./data/…`). So the server-side `moduleId` param stays deferred, for a
*corrected* reason. `server.mjs`'s `// no moduleId request surface exists, AC-5` comment remains
accurate and stays.

**Answer to `:93`, which binds the PRD: single-module-at-a-time, not a combined view.**
`src/engine.js:19` `assess(input, moduleId, rules, candidates)` is single-module by design; the
ranking score is an internal ordinal sort priority per module (CLAUDE.md), so merging two modules'
candidate lists into one view would misrepresent relative priority across incompatible scales; and 2
of 4 modules are `notYetImplemented` stubs, so a combined view would render broken content beside the
one real module.

**ADR-0001 is not tripped.** Its trigger ("before multi-module E1 scale") concerns rule-schema
*authoring* (`docs/adr/0001-*.md:81,86,142`; open reading at
`docs/project_plans/design-specs/cbc-suite-full-authoring.md:16,100`), not UI selection. A switcher
authors no rules and touches no schema.

**A new ADR is warranted:** `docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md`,
`status: proposed`. It records a binding, future-facing mapping from `module.json.status` to UI
affordance: only `integrity-recorded` is selectable/assessable; all others are listed but disabled
with their real status shown verbatim, never hidden or implied-ready; `superseded`/`revoked` never
appear as choosable. Shipping `proposed` suffices — same pattern as ADR-0004/0005/0006, all
`status: proposed` and G0-ungated (`docs/governance/gates-registry.md:57-59`).

**Gates.** None of G0–G4 gate *shipping* the switcher: it flips no module status, signs nothing,
touches no reviewer roster or release record. The relevant discipline is G4's standing principle
applied to a new surface — `docs/governance/gates-registry.md:130-132` forbids "any claim that a
knowledge-base module is clinically released", and makes `unsigned-stub`/`review-pending` →
`release-ready` schema-impossible. The switcher's labels must read `manifest.status` verbatim and must
never render anything resembling an approval badge. No step needs human sign-off before this feature
ships; the entire risk is about not *implying* one exists.

**Doc/test consequences identified:** `docs/architecture.md` §2a (client-facing selection control as
a read-only consumer of `listModules()`/`MODULE_IDS`), §6 (browser now surfaces `manifest.status`
directly), §10 (new fail-closed entry); new `tests/module-switcher-status-labels.test.mjs` and
`tests/module-switcher-eligibility.test.mjs`; a deliberate update to `tests/module-registry.test.mjs:24`'s
`DEFAULT_MODULE_ID` tripwire; and a CLAUDE.md orientation update, since its diagram and KB bullet
still describe only `modules/anemia/rules.json` / 91 rules.

### Conclusion

Reconcile, do not promote. Fix the stale fact in `public-moduleid-api-surface.md`, add a dated
"Deferral re-confirmation (SQ-4, 2026-07-22)" section in the doc's own convention, bump `updated` to
`2026-07-22`, leave `maturity: shaping`, and add the new switcher PRD to `related_documents` as the
doc that answers `:93`. Author ADR-0009 as `proposed`. Record explicitly that this feature *is* the
UI decision FR-14/R-8 were waiting on.

---

## Verified Corrections

Five beliefs the pre-SPIKE scoping held that execution disproved. These are the highest-value output
of this SPIKE; each is stated with the citation that establishes it.

### VC-1 — Growth/kidney do **not** fail at the evidence registry; they fail ~60 lines earlier, in unit validation

**Pre-SPIKE belief** (`.claude/worknotes/spa-module-switcher/exploration-findings.md:74-75`):
`src/evidence/registry.js:39-58` registers only `anemia` + `cbc_suite_v1` and throws on an unknown id,
so `assess()` fails at `src/engine.js:83` before any render.

**Verified by execution:** the throw at `src/engine.js:83` is **unreachable** — it sits inside the
`ruleAudit` map, and both growth and kidney have `rules.length === 0`, so the map never runs. The
actual fail-closed point is **`src/units.js:167`** (`validateUnits` check at `src/units.js:75-81`),
called from `src/engine.js:23`: neither module appears in `registeredUnitModules` (no
`modules/growth_suite_v1/units.js` or `modules/kidney_suite_v1/units.js` exists), so `validateUnits`
returns `{ok:false, errors:[{moduleId, reason:'unregistered-module'}]}` and
`prepareUnitValidatedInput` throws `UnitRejectionError` with `code:'UNIT_REJECTED'`.

*(Leg SQ-1 traced the same throw path through `src/units.js:160` → `:190`; leg SQ-3's probe pinned the
throw site at `:167`. The legs agree on the mechanism and the file; only the line anchor differs, and
`:167` is the executed one. Both disagree with the pre-SPIKE belief in the same way.)*

**Why it matters:** the evidence-registry throw is a *fatal error* path; the unit throw is an
*input-rejection* path. They route to entirely different UI states. Designing the switcher's
fail-closed behavior against the wrong one would have produced a refusal state that never fires.

### VC-2 — The current failure renders a false statement to the clinician

`UNIT_REJECTED` is in `src/app.js:20`'s `INPUT_REJECTION_CODES`, so VC-1's throw is caught and routed
to `showInputRejection()`, which prints the heading **"Check the entered units"** (`src/app.js:693`)
plus "Unit mismatch or unrecognized unit in patient input."

A clinician selecting Growth would be told their **units are wrong** when the truth is that the module
has no clinical logic at all. This is a live `docs/architecture.md:391` violation: that line requires
a clear "no assessment produced" / refusal-to-start state, and a state *is* produced — but
misattributed to the user's data entry.

It compounds at `src/app.js:683`: the rejection detail is `{moduleId, reason}` with no
`field`/`providedUnit`/`expectedUnit`, so `escapeHtml(undefined)` yields `''` and the UI renders the
literal garbage row `<li><strong></strong>: entered "", expected </li>`.

**Design consequence:** eligibility must be gated on `manifest.status` in the UI layer, *before*
`assess()` is called — never by catching an engine throw. Catching produces a refusal, but a
misattributed one, which is worse than silence.

### VC-3 — `cbc_suite_v1` runs to completion, returns **anemia's** classification shape, and silently drops all 7 of its evidence IDs

Pre-SPIKE, `cbc_suite_v1` was recorded as "partially renderable." Executed, it is worse than that:
it runs to completion. `modules/cbc_suite_v1/index.js:25,34-38` delegates `deriveFacts`,
`assertInScope`, `summarize`, and `limitations` to the anemia module, so `assess()` returns
`classification = {anemiaStatus, hemoglobin, morphology, mcv, rdw, reticulocyteResponse, …}` under
`meta.engine = "Pediatric CBC Suite Deterministic CDSS"`. Nothing in the output discloses the
delegation.

Worse, and previously unrecorded anywhere: **all 7 of its rule evidence IDs resolve to nothing.**
`src/app.js:168-173`'s `citeChips` filters against `EVIDENCE[id]`, which holds anemia's 6 IDs only
(`src/evidence.js:9,22`). Verified 0/7 present. Citations silently vanish from alerts, notes, and
candidates — a direct breach of the CLAUDE.md guardrail "every clinical statement ties to a source."

**Design consequence:** `cbc_suite_v1` must be non-selectable. Independent of the delegation, its
`status: unsigned-stub` already disqualifies it under `schemas/module-manifest.schema.json:23`.
Selectable-with-disclosure would require inventing UI-only prose describing a runtime relationship no
code path emits — the same failure mode as inventing a threshold.

### VC-4 — In-browser `verifyManifest()` is impossible in `dist/`, so the banner can verify nothing

Pre-SPIKE, `src/kbVerify.js` being browser-capable (WebCrypto via `src/lib/digest.mjs`, `schemaErrors`
taken as caller input) was read as evidence that the browser could verify a module before displaying
its status.

**Verified:** it cannot, in a built site. `clinicalContentHash` is computed over the raw bytes of
`ranges.js` and `facts.anemia.js` (`src/kbVerify.js:60-68`, `scripts/sign-kb.mjs:68-76`), while
`scripts/build-static.mjs:139-153` rewrites every `.js` file to append `?v=`. Measured:
`modules/anemia/ranges.js` = `49a597cb…` vs `dist/modules/anemia/ranges.js` = `d154a20c…`. The digest
can never match. Separately, the browser cannot supply `schemaErrors` — the validator
(`scripts/lib/json-schema-lite.mjs`) is deliberately unreachable from a browser build, and passing the
default `[]` (`src/kbVerify.js:207`) asserts "no schema errors" without having looked.

**Design consequence:** the banner reads declared manifest fields and says so. The honesty-boundary
sentence in SQ-2's conclusion is a pinned constant, not decoration.

### VC-5 — E1's FR-14/R-8 prohibition is scope-bounded to E1, and *this feature is the decision it was waiting on*

Not present in the pre-SPIKE scoping at all, and binding:
`docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md:367` (**FR-14**) states "this
pass adds no client-selectable `moduleId` surface", and `:527` (**R-8**) "forbids any new
client-selectable surface, **ahead of any UI/API decision to support it**."

That is a sequencing constraint, not a permanent ban — and `src/modules/registry.js:44-50` names the
exact trigger in the code itself: "the day a client-selectable moduleId surface actually ships."
`tests/module-registry.test.mjs:24` is the tripwire asserting `DEFAULT_MODULE_ID === 'anemia'`.

**Design consequence:** this feature *is* that UI decision, but it must say so explicitly and flip the
tripwire deliberately — the governance paperwork (ADR-0009 + the design-spec reconciliation) must land
**before** the UI, because shipping the surface first inverts the order this repo exists to protect.
The commit and the test comment must both cite FR-14/R-8 and ADR-0009.

### Also confirmed: the `sign-kb.mjs` anemia hardcode is real, and currently masked

`scripts/sign-kb.mjs:36` hardcodes `moduleDir = modules/anemia`; `loadKbJsonFiles()` (`:58-65`) and
`loadKbSourceFiles()` (`:68-76`) take **no module argument** and emit literal `modules/anemia/<f>`
paths. `scripts/build-static.mjs:54-55` calls both inside the `for (const moduleId of MODULE_IDS)`
loop (`:44`); `server.mjs:81-82` does the same. Every module's `clinicalContentHash` is therefore
recomputed from **anemia's** six files. `governanceHash` is unaffected (`src/kbVerify.js:217` passes
the real `moduleId`).

Currently masked, not benign: all three non-anemia manifests carry `clinicalContentHash: null`, so
`src/kbVerify.js:240` short-circuits on "missing" and the wrong-recompute branch at `:242` is never
reached; and `scripts/sign-kb.mjs:37` can only ever *write* to anemia. The defect activates the moment
a second module is signed. Note `sign-kb --check` is not part of `npm run check` at all
(`package.json` `scripts.check`).

`dist/build-info.json` (`scripts/build-static.mjs:180-187`) exposes `status`, `kbVersion`,
`evidenceReviewedThrough`, `validationRunId`, `approvedBy`, `supersedes` — and **no hashes** — so
today's surface does not leak the defect. Fixing `sign-kb.mjs` is therefore **out of scope** for the
switcher and a **prerequisite for any future integrity-hash UI**.

---

## Decisions Reached

Summarized here for the research record. **Canonical text, rationale, and implementation constraints
live in `.claude/worknotes/spa-module-switcher/decisions-block.md`** — that file is authoritative; this
section is a pointer, not a restatement.

| ID | Decision | Anchored by |
|---|---|---|
| **D-1** | Selectability predicate is `status === 'integrity-recorded'`, evaluated in the UI **before** `assess()`, referencing `READY_STATUS` (`src/kbVerify.js:43`) rather than a literal. Today: 1 selectable, 3 listed-and-inert. | SQ-1; `schemas/module-manifest.schema.json:22-23`; VC-2, VC-3 |
| **D-2** | Banner truth source is a static JSON import of each `module.json` via a new `src/moduleManifests.js`; the browser verifies nothing and says so in-UI. No hash, `hashes.recomputed`, "integrity verified", or "content unmodified" may be surfaced. | SQ-2; VC-4; `sign-kb.mjs` finding |
| **D-3** | Status vocabulary is the closed enum rendered **verbatim**, plus a universal `approvedBy.length === 0` clause on every module including anemia. "unsigned proposal · not clinically reviewed" survives only as the human-readable subtitle where `status === 'unsigned-stub'`. There is no green state. All strings live in one exported constant module pinned by a new doc-truth test. | SQ-1 §4; `docs/governance/gates-registry.md:130-132`; `docs/architecture.md:385-390` |
| **D-4** | Fail-closed refusal is a **distinct third state** decided before `assess()`, never a reuse of `showInputRejection`. Built as defence-in-depth even though D-1 makes it unreachable through the UI. Shared invariants and the four refusal cases per SQ-3 §4. | SQ-3; VC-1, VC-2; `docs/architecture.md:390-391` |
| **D-5** | No `server.mjs` / `openapi.yaml` change. The SPA is fully browser-local (zero `/api/` calls verified); `server.mjs`'s `// no moduleId request surface exists, AC-5` comment stays accurate and stays put. | SQ-4 §2 |

Additional non-goals recorded in the decisions block §7: no `scripts/sign-kb.mjs` per-module fix; no
`src/algorithmExplorer.js` generalization (degrade only); no per-module `examples/` authoring; no rule
authoring for `growth_suite_v1`/`kidney_suite_v1`; **no status change to any module manifest** —
nothing here flips `unsigned-stub` to anything; no `localStorage` persistence (a stale persisted
module id is a fail-closed hazard).

---

## Residual Unknowns

Open at the close of this SPIKE. None blocks planning; each needs an answer during it.

- **RU-1 — Selector form factor.** Persistent sidebar rail (mockup variant A) vs. interstitial card
  picker (variant C). Recommendation: A, because C's one-time gate leaves no in-session reminder of
  which module is active. **Both existing mockups render CBC as selectable — superseded by D-1**; the
  implemented UI must show it inert, and the mockups must not be treated as spec.
- **RU-2 — `#evidence` tab behavior for non-anemia modules.** Every module has an `evidence.json` with
  `{knowledgeBaseVersion, reviewedThrough, sources}` (cbc 20, growth 11, kidney 12 sources), so a
  per-module evidence view is feasible — but growth and kidney have no loaders in
  `src/evidence/registry.js:39-50`. Recommend degrading to "no evidence view for this module" and
  deferring the per-module view to a design spec.
- **RU-3 — Empty-state copy for the `#rules` tab** when `rules.length === 0`
  (`index.html:555`, `src/app.js:429-441`). The tab is already generic; only the wording is unfixed.
- **RU-4 — ADR-0009 ratification timing.** SQ-4 concludes `status: proposed` suffices at merge,
  matching ADR-0004/0005/0006 (`docs/governance/gates-registry.md:57-59`). To be confirmed in the PRD.
- **RU-5 — `cbc_suite_v1` evidence-ID resolution gap (VC-3 / SQ-3 F9).** Unreachable while CBC is
  inert under D-1, but a live bug the moment CBC ever becomes selectable. Recorded as a finding, not
  fixed here.
- **RU-6 — `kidney_suite_v1` version drift.** `module.json` declares `0.0.0-2026-07-22` while its
  `evidence.json` declares `0.1.0-2026-07-22`. Surfaced incidentally by SQ-2; owner and fix path
  undetermined.
- **RU-7 — Whether the `tests/module-registry.test.mjs:24` tripwire flips or is rewritten.** VC-5
  establishes the trigger has fired; `src/modules/registry.js:38-50`'s comment and the test both need
  a deliberate decision, not a mechanical edit.

---

## Citations

**Schema & governance**
- `schemas/module-manifest.schema.json:5,22,23` — closed status enum; `integrity-recorded` is the only
  servable status; structural validity never implies clinical validity or human review
- `docs/governance/gates-registry.md:57-59,130-132` — ADRs ship `proposed`; `unsigned-stub` →
  `release-ready` is schema-impossible; no claim of clinical release
- `docs/architecture.md:37-38,368-390,385-390,391` — modules are not peers, read each row; fail-closed
  list; evidence-staleness disclosed-but-not-enforced; refusal-to-start requirement
- `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md:367,523,527` — FR-14, R-4, R-8
- `docs/adr/0001-*.md:81,86,142`; `docs/project_plans/design-specs/cbc-suite-full-authoring.md:16,100`
- `docs/project_plans/design-specs/public-moduleid-api-surface.md:58,61,72-73,77-79,93,99-134`
- `docs/project_plans/SPIKEs/spike-002-multi-module-loader.md:121,184`

**Runtime**
- `src/engine.js:19,23,47,49,83,84,88,98-100` — generic `assess`; unit-validation call site; hardcoded
  `meta.status`; `summarize`; `ruleAudit`; retained `assessPediatricAnemia`
- `src/units.js:75-81,167` — `validateUnits`; `UnitRejectionError` throw site
- `src/kbVerify.js:43,60-68,132-141,185-188,203,207,217,234-279` — `READY_STATUS`; content-hash inputs;
  expiry disclosure; "does not validate" doc comment; `verifyManifest`; default `schemaErrors`;
  `governanceHash`; check sequence
- `src/evidence/registry.js:39-50,52-62` — registry membership; `accessorsFor` throw
- `src/evidence.js:9,11,22` — anemia's 6 evidence records; `KNOWLEDGE_BASE_VERSION`
- `src/modules/registry.js:13-19,21,37,38-50,44-50,51,66-73,74-75` — `getModule`, `listModules`,
  `MODULE_IDS`, the selectable-surface comment, `DEFAULT_MODULE_ID`, `MODULE_CODE_LOADERS`,
  `isRegisteredModule`
- `src/evidenceStalenessPolicy.js:11-14` — every caller must disclose non-enforcement loudly
- `src/app.js:1,20,94-166,168-173,181,267-307,269-274,275-283,290,298,322-343,404-441,456-457,525,534,
  555-556,558-560,630,662,664,665,668,683,686-699,691-693` — engine import; rejection codes;
  `buildInput`; `citeChips`; `humanize`; `renderClassification`; hardcoded source labels; `meta.status`
  render; `renderCandidates`; tab renderers; hash routing and `history.replaceState`; example loader;
  KB fetches; fatal/rejection paths
- `modules/anemia/index.js:4-20`; `modules/anemia/facts.anemia.js:5`
- `modules/cbc_suite_v1/index.js:25,34-38` — delegation to anemia
- `modules/growth_suite_v1/index.js:35-39,46-51`; `modules/kidney_suite_v1/index.js:30-34,37-42`
- `index.html:6,11,19,24,41-43,66,72,76,101-108,194,416,429,435,548,555,577,583`;
  `styles.css:2-22`; `site-overrides.css:398-402`

**Build & gates**
- `scripts/build-static.mjs:14,41-83,44,53,54-55,76-79,100-106,126-155,139-153,140,144,148,180-187,
  184-192,188-192,213` — copy set; per-module manifest verification; warn-not-exit; `?v=` stamping;
  `build-info.json` contents
- `scripts/sign-kb.mjs:36,37,58-65,58-73,68-76` — anemia hardcode in `loadKbJsonFiles`/`loadKbSourceFiles`
- `scripts/check-app-imports.mjs:46-47,48,50-59,56,92,120-133,121-132,137-141,137-144` —
  `APP_SURFACE_FILES`, non-transitive pass (a), specifier extraction, prefix-only template check
- `scripts/smoke-browser-unit-rejection.mjs:132,134,139-153,149-153,158-176,167-173,179,188,216-223`
- `scripts/verify-d4-built.mjs`; `server.mjs:37-39,81-82,127`
- `tests/module-registry.test.mjs:24,50`; `tests/claudemd-check-gate.test.mjs`;
  `tests/module-manifest-schema.test.mjs`; `tests/clinical-approvers-d4.test.mjs`;
  `tests/evidence-registry.test.mjs`; `tests/module-equivalence.test.mjs`;
  `tests/range-unit-registry.test.mjs`

**Leg reports (primary evidence for this SPIKE)**
- `.claude/worknotes/spa-module-switcher/exploration-findings.md` (esp. `:104` — no banner-string test exists)
- `.claude/worknotes/spa-module-switcher/spike-leg-sq1-module-eligibility.md`
- `.claude/worknotes/spa-module-switcher/spike-leg-sq2-banner-truth-source.md`
- `.claude/worknotes/spa-module-switcher/spike-leg-sq3-failure-surface.md`
- `.claude/worknotes/spa-module-switcher/spike-leg-sq4-prior-art-reconciliation.md`
- `.claude/worknotes/spa-module-switcher/decisions-block.md` — **canonical for D-1…D-5**

---

## Errata (added 2026-07-22, post-`karen` planning gate)

This SPIKE is a recorded research result and is preserved as written. Three citation errors were
found during the `karen` gate on the downstream planning bundle. They are corrected in the PRD,
implementation plan and progress artifacts; they are listed here rather than silently edited above,
so the record stays honest about what the research pass actually produced.

| Cited here as | Correct | Subject |
|---|---|---|
| `src/modules/registry.js:74` | `:75` | `isRegisteredModule` |
| `src/modules/registry.js:38-50` | `:39-50` | client-selectable-moduleId tripwire comment |
| `scripts/build-static.mjs:76-79` | `:73-77` | warn-instead-of-exit for non-default modules |

Two substantive corrections were also made downstream, neither of which invalidates a finding above:

1. **Two distinct tripwires were conflated.** `tests/module-registry.test.mjs:20-24` says it must be
   updated "the day a **second module registers**" — four are registered, so **that trigger already
   fired at commit `263120b` and was never actioned; that test comment is stale today.** The
   "client-selectable moduleId surface ships" trigger is a separate comment at
   `src/modules/registry.js:39-50`. Only the second is fired by this feature.
2. **The verification ceiling was not established by this SPIKE.** No leg checked whether the repo can
   execute DOM tests. It cannot — `package.json` declares no `dependencies` and no `devDependencies`,
   and `scripts/smoke-browser-unit-rejection.mjs:4-15` states the no-browser-automation posture
   explicitly. See decisions-block **D-6**. Any reading of this SPIKE that assumes behavioral browser
   tests are available is wrong.
