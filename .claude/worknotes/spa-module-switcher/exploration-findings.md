# SPA Module Switcher — pre-SPIKE exploration findings (verified 2026-07-22)

> Seeded context for SPIKE legs. **Do not re-derive these facts.** Verify only if your leg
> depends on a detail stated here being wrong. All paths relative to repo root.

## Verdict from scoping: greenfield

No approved WP, PRD, or AC set exists for a module switcher. The expansion roadmap
(`docs/project_plans/expansion/01-platform-expansion-roadmap.md`) has **no** module-selection WP;
the only UI WPs are P3-WP7 (tri-state questionnaire, `:288`) and P1-WP7 (clinical-review portal,
concept only, `:165`). P0/E0/E1 PRDs all explicitly state the SPA is untouched.

## SPA shape

- Static SPA, **no bundler**. `index.html:583` → `src/app.js` (native ESM).
- `npm run build` = `scripts/build-static.mjs` — copies `['assets','src','data','examples','modules']`
  into `dist/` (`:14`) and rewrites relative `import`/`fetch` specifiers with a content-hash
  `?v=<stamp>` (`:126-155`). KB JSON is **not** inlined; fetched/imported at runtime.
- Build already verifies each module manifest before writing `dist/` (`:41-83`); non-default modules
  that fail verification **warn instead of exit** (`:76-79`).
- `dist/build-info.json` already carries per-module `manifest.status`, `approvedBy`, `validationRunId`
  (`build-static.mjs:184-192`).
- Styling: `styles.css` `:root` CSS vars (`:2-22` — `--brand`, `--warning-soft`, `--danger`, `--radius`).
  Existing banner pattern: `.safety-banner` (`index.html:41-43`, `role="alert"`), plus
  `.unit-assumption-notice` (`site-overrides.css:398-402`, `role="note"`).
- Tab panels: `#assessment` (`index.html:72`), `#algorithm` (`:429`), `#evidence` (`:548`),
  `#rules` (`:555`). Nav counts `#nav-rule-count`/`#nav-pattern-count` (`:66`) set at `app.js:564-565`.

## Anemia hardcode inventory (browser path)

| Site | What |
|---|---|
| `src/app.js:555-556` | `fetch('./modules/anemia/rules.json')`, `fetch('./modules/anemia/candidates.json')` |
| `src/app.js:1` | `import { assessPediatricAnemia } from './engine.js'` |
| `src/engine.js:99` | `assessPediatricAnemia = assess(input, 'anemia', ...)` |
| `src/facts.js:4` | `deriveFactsForModule(input, 'anemia')` |
| `src/evidence.js:9` | static `import '../modules/anemia/evidence.json' with { type: 'json' }` |
| `src/referenceRanges.js:16` | re-export from `../modules/anemia/ranges.js` |
| `src/serverErrors.js:7` | imports from `modules/anemia/facts.anemia.js` |
| `src/algorithmExplorer.js:290-303,393` | `anemiaWalkthrough()`, `facts.anemia.*` |
| `src/algorithmExplorer.js:583` | `fetch('./data/algorithm-explainers.json')` — anemia-specific, not module-scoped |
| `src/app.js:525`, `algorithmExplorer.js:616` | `fetch('./examples/${id}.json')` — `examples/` is anemia-only |
| `src/app.js:298` | renders `c.anemiaStatus` |
| `index.html:11,33,66,76,102-104,194,416,577` | anemia copy; `:66` hardcodes counts 91/26 |
| `scripts/sign-kb.mjs:58-73` | `loadKbJsonFiles()`/`loadKbSourceFiles()` hardcode `modules/anemia/…` **for every module** |
| `src/modules/registry.js:51` + `tests/module-registry.test.mjs:24` | `DEFAULT_MODULE_ID='anemia'` + tripwire test; `registry.js:38-50` comment says it must change when a selectable moduleId surface ships |

## Runtime is genuinely module-agnostic and browser-safe

- `src/modules/registry.js` — pure ESM, no `fs`/`path`/`require`. `getModule(id)` (`:13-19`),
  `listModules()` (`:21`), `MODULE_IDS` (`:37`), `DEFAULT_MODULE_ID` (`:51`),
  `isRegisteredModule(id)` (`:74`), `async loadModuleCode(id)` via literal-specifier `import()` map (`:66-72`).
- Sibling registries, all moduleId-keyed and browser-safe: `src/facts/registry.js`,
  `src/ranges/registry.js`, `src/units.js:21-83`, `src/evidence/registry.js:39-49`.
- `src/engine.js:19` `assess(input, moduleId, rules, candidates)` is already generic.
- `src/kbVerify.js` is browser-capable — uses `src/lib/digest.mjs` (WebCrypto `crypto.subtle`) and
  takes `schemaErrors` as caller input so it needn't import `scripts/lib`. `verifyManifest()` at `:203`,
  `READY_STATUS = 'integrity-recorded'` at `:43`.
- **All four modules' fact code is already in the browser graph** via static imports in
  `src/facts/registry.js:1-3`. Loadability is NOT the blocker.
- **Hard constraint**: import/fetch specifiers must stay **literal** — never template-built —
  both for build-time `?v=` stamping and the stated path-injection guard
  (`registry.js:66-68`, `facts/registry.js:9-11`).

## The four modules are NOT peers

| Module | `module.json.status` | rules | Renderable? |
|---|---|---|---|
| `anemia` | `integrity-recorded` | 91 | Yes — the only real one |
| `cbc_suite_v1` | `unsigned-stub` | 4 (1 candidate) | Partially — `index.js:25,34-38` **delegates deriveFacts/assertInScope/summarize/limitations to the anemia module**; has 5 ed25519-signed `reviews/rr-000*.yaml`, all `synthetic: true`, explicitly non-qualifying |
| `growth_suite_v1` | `unsigned-stub` | 0 (`[]`) | **No** — every hook returns `notYetImplemented: true` (`index.js:35-39`) |
| `kidney_suite_v1` | `unsigned-stub` | 0 (`{}`) | **No** — same (`index.js:30-34`) |

- `src/evidence/registry.js:39-58` registers only `anemia` + `cbc_suite_v1` and **throws** on unknown id
  → `assess()` fails at `engine.js:83` for growth/kidney before any render.
- `docs/architecture.md:36-46` module inventory table, verbatim at `:37-38`: statuses
  "are **not** uniform — read each row rather than assuming parity across modules."
- `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md:523` (R-4) names the exact risk:
  a scaffold "could be misread by a future contributor as 'kidney/growth assessment works.'"

## Governance / status vocabulary (schema-enforced)

- `schemas/module-manifest.schema.json:22` — **closed** status enum:
  `["unsigned-stub", "integrity-recorded", "superseded", "revoked"]`. `:23` — `integrity-recorded` is
  the only status server/build/browser will serve. `:5` — "Structural validity here never implies
  clinical validity, safety, or that a named human clinician reviewed anything."
- `approvedBy` is `maxItems: 0`; rule-level `clinicalApprovers` throws (`src/ruleEngine.js:127-138`).
- Manifest fields: `id, title, schemaVersion, status, knowledgeBaseVersion, evidenceReviewedThrough,
  engineLabel, supportedAgeMonths, clinicalContentHash, governanceHash, approvedBy, validationRunId,
  supersedes, releasedAt` + optional envelope (`module_topic, intended_hcp_users, patient_population,
  intended_output, explicit_exclusions, jurisdictions, integration_targets, evidence_policy`).
- `docs/governance/gates-registry.md:130-132` (G4): `unsigned-stub`/`review-pending` → `release-ready`
  is schema-impossible; forbids "any claim that a knowledge-base module is clinically released."
- `docs/architecture.md:368-390` (§10) fail-closed list. `:385-390`: evidence-staleness expiry is
  **"Disclosed but not yet enforced"**, `maxAgeDays` is `null`, and *every consumer of the expiry
  verdict must disclose "not enforced" loudly*; `null` must never read as "checked and passed".
  `:391` — a failed system shows "no assessment produced"/refusal-to-start, never stale or partial advice.
- `src/governance.js` exposes rule-level honest predicates (`isActive`,
  `hasCredentialedClinicalApproval`, `clinicalApprovalStatus`, `governanceSummary`), already wired
  into `assess()` output at `engine.js:83-89`.
- `src/app.js:290` renders `result.meta.status` — but that is a **hardcoded string** in
  `engine.js:47` (`'Research prototype—not clinically validated'`), not manifest-derived.
  This is the natural insertion point for manifest-derived status.
- **No test asserts the exact banner/disclaimer strings today.** Wording is convention-enforced by
  docs only. A switcher adding status text has no existing harness to conform to.

## Gates that will bite

- `npm run smoke:browser` = `scripts/smoke-browser-unit-rejection.mjs` — **greps `src/app.js` source
  text**. Asserts the exact import line `import { assessPediatricAnemia } from './engine.js'` (`:132-134`),
  that `submitBody`/`loadExampleBody` call `assessPediatricAnemia(input, rules, candidates)` (`:179,188`),
  and `showInputRejection` internals (`:158-176`). Any change to the engine call shape breaks it.
- `npm run check:imports` = `scripts/check-app-imports.mjs` — resolves every specifier in
  `APP_SURFACE_FILES = ['src/app.js','src/algorithmExplorer.js','src/evidence.js']` (`:56`) against
  both dev and `dist/` layouts. **Template-literal fetches are only prefix-checked** (`:120-133`) —
  a `./modules/${moduleId}/rules.json` fetch would pass but lose per-file verification.
- `npm run verify:d4` = `scripts/verify-d4-built.mjs` — iterates `MODULE_IDS`, requires
  `dist/modules/<id>/rules.json` to exist, asserts empty `clinicalApprovers`. Fails closed.
- Full gate: `npm run check` (see CLAUDE.md; `package.json scripts.check` is authoritative and
  `tests/claudemd-check-gate.test.mjs` fails on drift).
- Tests to satisfy/extend: `tests/module-registry.test.mjs` (`:24` DEFAULT_MODULE_ID tripwire;
  `:50` requires `loadModuleCode` to export `deriveFacts`), `tests/module-manifest-schema.test.mjs`,
  `tests/clinical-approvers-d4.test.mjs`, `tests/evidence-registry.test.mjs`,
  `tests/module-equivalence.test.mjs`, `tests/range-unit-registry.test.mjs`.

## Stale prior art needing reconciliation

- `docs/project_plans/design-specs/public-moduleid-api-surface.md` — `status: draft`,
  `maturity: shaping`, DEF-6. `:77-79` says the SPA "would need a module-selection UI element wired
  to the new parameter — currently entirely absent". `:93` leaves "single-module-at-a-time vs.
  combined view" an **open question**. `:99-134` is a 2026-07-21 deferral re-confirmation that is now
  **factually stale** — it asserts "No second module directory exists under `modules/`", invalidated
  by commit `263120b`. Its own promotion trigger ("a second module registered") has fired.
- `docs/project_plans/SPIKEs/spike-002-multi-module-loader.md:121,184` — P0 deliberately shipped no
  client-side switcher; `:184` flags the later phase adding "client-side module selection … behind a
  real UI control" as an explicit unclaimed marker.
- `server.mjs` still carries the `// no moduleId request surface exists, AC-5` guardrail comment —
  there is **no server-side selection API** to switch against yet.
- ADR-0001 (`docs/adr/0001-*.md:81,86,142`) — rule-schema v2 was triggered "before multi-module E1
  scale"; whether E1 tripped it is an open question (`docs/project_plans/design-specs/cbc-suite-full-authoring.md:16,100`).
  All ADRs are `status: proposed` (G0-ungated, `gates-registry.md:57-59`).

## Known latent defect surfaced by this work

`scripts/sign-kb.mjs:58-73` hardcodes `modules/anemia/…` in `loadKbJsonFiles()`/`loadKbSourceFiles()`,
and `build-static.mjs:53-54` calls them **per-module with no module id**. Every module's
`clinicalContentHash` is therefore verified against **anemia's** files. A switcher that surfaces
per-module integrity status makes this defect user-visible.
