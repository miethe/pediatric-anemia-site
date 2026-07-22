# Module-Switcher Recon Brief (Explore agent, 2026-07-22)

Factual codebase brief for DEF-6 planning. Code state = `263120b` (#22 E1 multi-bundle conversion). Consumed by implementation-planner; do not re-derive these facts.

## 1. Module registry & module packages

**`src/modules/registry.js`** (86 lines)
- Registered modules, `REGISTRY` Map at `registry.js:6-11`: `anemia`, `cbc_suite_v1`, `kidney_suite_v1`, `growth_suite_v1` (4 total).
- `getModule(id)` `:13-19` — sync, returns hook-descriptor; throws `Unknown module: <id>`.
- `listModules()` `:21-23`; `MODULE_IDS` `:37` = `Object.freeze([...REGISTRY.keys()])` (derived, not hand-maintained).
- `DEFAULT_MODULE_ID` `:51` = `'anemia'`; comment `:39-50` says "Revisit … the day a client-selectable moduleId surface actually ships" — must be updated by this feature.
- `MODULE_CODE_LOADERS` `:68-73` — enumerated `import()` map. `cbc_suite_v1` loader points at `../../modules/anemia/facts.anemia.js` (OQ-1 delegation, intentional); kidney/growth point at their own `index.js`.
- `isRegisteredModule(moduleId)` `:75-77`; `loadModuleCode(moduleId)` `:79-85` (async, throws on unknown).

**Per-module metadata** lives in `modules/<id>/module.json` (not registry.js). Display name = `title`. Registry hook descriptor (`index.js` default export): `id`, thin `manifest` (`engineLabel`, `knowledgeBaseVersion`, `evidenceReviewedThrough`), hooks `deriveFacts`/`assertInScope?`/`summarize`/`limitations`.

Module status table:

| Module | module.json status | rules.json | candidates.json | evidence.json | signing fields |
|---|---|---|---|---|---|
| `anemia` | `integrity-recorded` | 91 rules | 26 patterns | 6 records | hashes populated; `approvedBy:[]`; `validationRunId:"local-dev:unattested"` |
| `cbc_suite_v1` | `unsigned-stub` | drafted (7.6k) | present (1.5k) | 98k | all null/empty; extra converter files (`evidence-assertions.json`, `rule-provenance.json`, `traceability-index.json`, `authoring-decisions.yaml`, `reviews/`) |
| `kidney_suite_v1` | `unsigned-stub` | `[]` (empty) | `{}` (empty) | 56k | all null/empty; `evidence-assertions.json`, `unresolved.json` |
| `growth_suite_v1` | `unsigned-stub` | `[]` (empty) | `{}` (empty) | 51k | all null/empty; `evidence-assertions.json`, `unresolved.json` |

Manifest schema forces `approvedBy` and rule-level `clinicalApprovers` to `[]` (`maxItems:0`) — `docs/architecture.md:242,281`.

## 2. `server.mjs`

- **POST `/api/v1/assess`** `:247-254`: `readJsonBody` (`:200-221`; 413 > 1MB, 400 invalid JSON); non-array-object root check → `sendJson(response, 400, { error: 'Body must be a patient-input JSON object.' })` `:249-251`; then `assessPediatricAnemia(input, rules, candidates)` `:252`. `rules`/`candidates` resolved ONCE at startup `:123-124` from `modulesById.anemia` — but **`modulesById` already loads EVERY registered module at startup**, so per-request module resolution is a lookup away.
- **`assessPediatricAnemia`** (`src/engine.js:98-100`) = thin wrapper over core `assess(input, moduleId, rules, candidates)` (`engine.js:19`) which calls `getModule(moduleId)`, `prepareUnitValidatedInput`, `module.deriveFacts`, optional `module.assertInScope`, `runRules`. **The module-parameterized engine entry already exists.**
- **GET `/api/v1/knowledge-base`** `:236-245`: returns KB version fields + `modules: modulesSummary` (`:135-161`) — per-module `ruleCount`, `diagnosticPatternCount`, `evidenceRecordCount`, `manifest.{status,knowledgeBaseVersion,evidenceReviewedThrough,validationRunId,approvedBy,supersedes}`, `evidenceStalenessPolicy`. Already discloses `unsigned-stub`/`approvedBy:[]` verbatim.
- **AC-5 guardrail comment** `:126-134` ("no moduleId request surface exists, AC-5") — must be deliberately retired by this feature.
- **Servability fail-closed policy** `:104-121`: only `DEFAULT_MODULE_ID` non-servable is fatal at startup; other modules disclosed, not fatal.
- **4xx contract**: `sendJson(response, status, { error, [code], [details] }, requestId)`; central shaper `src/serverErrors.js#shapeServerError` (used in catch `:271-273`): `status = error.statusCode || (ENOENT?404:400)`; `code` + `details` for `UnitRejectionError`/`RangeUnitMismatchError`/`AgeOutOfSupportedRangeError` (`serverErrors.js:10-23`). 405 non-GET/HEAD `:256-258`; `X-Request-Id` on every response `:183-190`. `openapi.yaml` `components.schemas.Error`: required `error`, optional `code`, `details[]` `{field, providedUnit, expectedUnit, reason}`.

## 3. `src/app.js` (browser SPA)

- **Fully browser-local; never calls the API.** `initialize()` `app.js:553-562` fetches static `./modules/anemia/rules.json` + `./modules/anemia/candidates.json`, assesses in-browser via `assessPediatricAnemia` from `./engine.js` (`app.js:1`, used `:576,:625`). Other fetches: `./examples/${selected}.json` (`:525`).
- Structure: `buildInput` `:94`; render fns `renderClassification` `:267`, `renderAlerts`, `renderCandidates`, `renderQuestions`, `renderNotes`, `renderLimitations`, `renderResult` `:383`, `renderEvidence` `:404`, `renderRules` `:429`; `switchTab` `:443`; audit view. `initialize()` wires form, tabs, workflow steps, example loader, audit copy/download.
- **Banner machinery is static markup in `index.html`, not app.js**: "Research Prototype" title (`index.html:11`), masthead `:33`, global `<div class="safety-banner" role="alert">` "Not clinically validated." (`:41-43`), footer `:577`. No per-module dynamic banner exists.
- **Selector seam**: `initialize()` `:553-564` is the single KB-load point. Needs: UI control in index.html, moduleId-parameterized fetch paths, switch `assessPediatricAnemia` → `assess(input, moduleId, rules, candidates)`; no moduleId state exists today.
- **Build** (`scripts/build-static.mjs`): copies `modules/` wholesale into `dist/` (`:14,84-86`) — all 4 modules already ship in the bundle; content-stamps JS/JSON specifiers and `fetch('…json')` calls with `?v=<hash>` (`:107-153`); `dist/build-info.json` has per-module breakdown (`readModuleBuildInfo` `:168-198`); fail-closed only for `DEFAULT_MODULE_ID` (`:66-77`).

## 4. `openapi.yaml`

- Assess request: `$ref: './schemas/patient-input.schema.json'` (`:57`); 200: `$ref: './schemas/assessment-output.schema.json'` (`:102`). Errors: 400, 413 → `#/components/schemas/Error` (`:103-132`). No 405 documented, no moduleId parameter. `info.version: 0.1.0`.

## 5. Tests a moduleId surface must touch

- `tests/module-registry.test.mjs` — **explicit tripwire** `:20-24` `assert.equal(DEFAULT_MODULE_ID, 'anemia')`; assertion 1 "must be updated/deleted the day a second module registers".
- `tests/module-manifest-schema.test.mjs`, `tests/module-equivalence.test.mjs`, `tests/server-error-contract.test.mjs`, `tests/assessment-output-schema.test.mjs`, `tests/claudemd-check-gate.test.mjs` (only if `scripts.check` changes), `schemas/patient-input.schema.json` + `openapi.yaml` if moduleId added to body schema.
- Server suites: `tests/server-error-contract.test.mjs`, `tests/server-manifest-failclosed.test.mjs`, `tests/arch-s10-failclosed.test.mjs`, `tests/empty-rules-regression.test.mjs`.
- `npm run smoke:browser` = `scripts/smoke-browser-unit-rejection.mjs`; `npm run check:imports` = `scripts/check-app-imports.mjs` (static specifier resolution for app.js/algorithmExplorer.js/evidence.js against dev + dist layouts, plus dynamic import of the non-DOM graph).
- `npm run verify:d4` = `scripts/verify-d4-built.mjs` — post-build gate: every `dist/modules/<id>/rules.json` rule has `clinicalApprovers: []`; tolerates zero-rule scaffolds (kidney/growth); `DEFAULT_MODULE_ID` empty = vacuity error.

## 6. Why `npm run check` is RED on main (pre-existing)

- `npm test`: **25 failing subtests / 2387 pass** at `263120b`. Signature = pinned-baseline/snapshot drift + rights gates from the E1 merges, NOT logic breakage. Examples: `tests/ef-anemia-backfill-integrity.test.mjs:76` (evidence.json sha drift), `tests/ef-p4-t8-honesty-ac.test.mjs:134` (module.json drift), cbc converter suites, kidney/growth `validateModule()`, rights gates (`rights-validate-gates`, `rights-negative-invariant`, `rights-standing-invariants`), `notice-architecture-no-clearance`, `ef-release-no-keys.test.mjs`. Related branches exist: `fix/d4-dist-order`, `worktree-multi-bundle-conversion-e1`, `worktree-evidence-foundry-e1`. Independent of module-switcher work; fix-gate is a separate prerequisite.

## 7. "Unsigned proposal" conventions

- `module.json.status` closed enum (`docs/architecture.md:221`): `unsigned-stub` → `integrity-recorded` → `superseded`/`release-ready`. Non-anemia = `unsigned-stub`; anemia = `integrity-recorded`.
- `approvedBy`/`clinicalApprovers` schema-forced `[]` (`docs/architecture.md:242,281,34`); runtime D-4 guard `assertNoClaimedClinicalApproval` (`src/engine.js:16`, `src/ruleEngine.js`); build gate `scripts/verify-d4-built.mjs`.
- Canonical module-status doc surface: `docs/architecture.md:41-46`.
- "Proposal" language: converter output is an ungoverned proposal until signed (`docs/architecture.md:99,121,125,135`; ADR 0004/0005). Passage provenance statuses: `source-supported`/`quarantined`/`implementation-proposal`/`null` (`src/engine.js:60-65`).
- `tests/notice-architecture-no-clearance.test.mjs` enforces docs never affirm a clearance.
