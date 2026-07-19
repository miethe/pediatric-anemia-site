---
title: "Repo Current-State Brief — Phase 1 (Wave-0 Safety & Defensibility Foundation)"
doc_type: worknote
created: 2026-07-19
scope: "Factual current-state survey grounding Phase 1 implementation planning. Not a plan."
sources_read:
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md (lines 150-231)
  - commit ff4b519 (Platform foundation P0)
  - docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
  - .claude/worknotes/platform-foundation-p0/*.md
---

# Repo Current-State Brief — Phase 1 (Wave-0 Safety & Defensibility Foundation)

Node `v20.19.3`. Working tree clean except this worknotes dir and unrelated ARC-council
planning docs (`docs/project_plans/expansion/03-arc-clinical-council-handoff.md`,
`docs/project_plans/expansion/rf-handoff/RESULTS.md`, `docs/project_plans/implementation_plans/enhancements/`).

## A. What Phase 0 actually delivered

Commit `ff4b519` ("Platform foundation P0: modules/<id>/ package contract, squash of 7-phase
execution") is a **pure structural refactor with zero clinical-content change**, proven by a
permanent golden-fixture equivalence harness. It did **not** touch any of the roadmap's Phase 1
safety concerns (tri-state, units, exact-passage evidence, signed manifest, expanded test corpus)
— those are explicitly deferred (see Deferred Items below).

**The module package contract, as it exists today** (`docs/architecture.md:28-34`,
`modules/anemia/`):

- Each module is a directory `modules/<id>/` holding `rules.json`, `candidates.json`,
  `evidence.json`, `reference-ranges.json`, `module.json` (unsigned-stub manifest), `index.js`
  (hook descriptor), plus module-specific support code (`facts.anemia.js`, `ranges.js`).
- `index.js` hook descriptor shape (`modules/anemia/index.js:45-55`): `{ id, manifest:
  {engineLabel, knowledgeBaseVersion, evidenceReviewedThrough}, deriveFacts, summarize,
  limitations }`.
- Three dispatch registries: `src/facts/registry.js` (fact derivation by moduleId, a literal
  `Map`), `src/ranges/registry.js` (analyte bands + threshold rules, keyed `moduleId::analyte`),
  `src/modules/registry.js` (`getModule`/`listModules` synchronous hook access, plus
  `MODULE_IDS`/`DEFAULT_MODULE_ID`/`MODULE_CODE_LOADERS`/`loadModuleCode`/`isRegisteredModule` for
  enumeration/async loading — additive Phase-5 half of the same file).
- Shim strategy for zero-caller-edit compatibility: `src/facts.js` (6 lines), `src/referenceRanges.js`,
  and `assessPediatricAnemia()` in `src/engine.js` are thin wrappers bound to `moduleId: 'anemia'`.
- `modules/anemia/module.json` is an **unsigned stub**: `status: "unsigned-stub"`,
  `clinicalContentHash: null`, `approvedBy: []`, `validationRunId: null`, `supersedes: null`,
  `releasedAt: null` — Phase 1 (P1-WP5) fills these fields; no shape migration needed.
- **Only one module is registered today (`anemia`)** — every registry is a 1-entry Map/array. No
  second module exists to stress-test the abstraction yet.
- No public `moduleId` surface exists on the API (`server.mjs`, `openapi.yaml` unchanged from
  pre-refactor baseline) — this was a binding P0 decision (OQ-2), explicitly deferred to "Phase 1+."

**V2 gate result**: PASS, zero anomalies
(`.claude/worknotes/platform-foundation-p0/v2-gate-results.md:19`). All AC-1..AC-6 verified:
golden-output equivalence (6/6), `npm run check` green, byte-identical KB relocation, real
module-registry load test, unchanged public API surface (`openapi.yaml` empty diff), stable build
hashing.

**8 deferred items (DEF-1..DEF-8)**, each with a design-spec at
`docs/project_plans/design-specs/*.md` (maturity: `shaping` or `idea`; see §E below) — directly
feed Phase 1 WPs:

| DEF | Spec file | maturity | Feeds Phase 1 WP |
|---|---|---|---|
| DEF-1 | evidence-dual-source-unification.md | idea | WP3/WP5 (`src/evidence.js` vs. `modules/anemia/evidence.json` drift) |
| DEF-2 | tri-state-fact-model.md | shaping | **WP1** directly |
| DEF-3 | exact-passage-evidence-schema.md | idea | **WP3** directly |
| DEF-4 | signed-kb-manifest.md | idea | **WP5** directly |
| DEF-5 | module-manifest-json-schema.md | idea | WP4/WP5 (no formal `module.json` schema exists yet — field-presence checks only) |
| DEF-6 | public-moduleid-api-surface.md | shaping | Not Phase 1 scope (still deferred) |
| DEF-7 | algorithm-explainers-examples-relocation.md | shaping | Not Phase 1 scope |
| DEF-8 | headless-browser-runtime-smoke-check.md | shaping | Not Phase 1 scope |

No `plan-completion.md` content exists (file present but empty at
`.claude/worknotes/platform-foundation-p0/plan-completion.md`) — closeout record lives instead in
`v2-gate-results.md`, `decisions-block.md`, `estimation-sanity.md`, `feature-guide.md`.

## B. Current code surface Phase 1 must modify

**`src/facts.js`** (6 lines) — pure shim: `deriveFacts(input) { return deriveFactsForModule(input,
'anemia'); }` (`src/facts.js:1-5`). No boolean logic lives here anymore; all of it moved to
`modules/anemia/facts.anemia.js` in P0.

**`modules/anemia/facts.anemia.js`** (357 lines, 13KB) — the dense derivation file tri-state
must migrate. Key patterns:
- `countTrue()` calls: **9** (`grep -c "countTrue("` = 9), e.g. `facts.anemia.js:75`
  (`hemolysisMarkerCount = countTrue(Object.values(hemolysisMarkers))`), `:96`
  (`additionalCytopeniaCount = countTrue([leukopenia, neutropenia, thrombocytopenia])`), `:99-106`
  (`instability`), `:108-115` (`bleedingHistory`), `:117-127` (`ironRiskHistory`), `:129-134`
  (`chronicInflammation`), `:143-147` (`familyHemoglobinopathy`), `:149-154`
  (`knownChronicHemolyticDisease`), `:191-197` (`congenitalMarrowFailureSignals`, note: this one is
  *not* boolean-collapsed — it returns the raw count, not `> 0`).
- `=== true` boolean-collapse checks: **23** total in `src/`+`modules/` (grep count), of which
  **19** are in `facts.anemia.js` itself (lines 136-138, 200, 209-211, 315-320, 323-326, 339-341),
  1 in `src/facts/core.js:3` (`isTrue` helper definition), 1 in `modules/anemia/ranges.js:42`
  (`menstruating === true`), 1 in `src/algorithmExplorer.js:308` (UI display logic, not the
  engine — out of engine scope but consumes `facts.morphology.rdwHigh` tri-state-shaped booleans).
- `src/facts/core.js` (10 lines) defines the primitives migration must touch: `finite`, `num`,
  `isTrue = (value) => value === true` (line 3 — the literal `=== true` collapse point),
  `statusIs`, `includes`, `countTrue = (values) => values.filter(Boolean).length` (line 7-9).
- **Distinct `history.*`/`symptoms.*`/`exam.*` field paths read** in `facts.anemia.js`: **56**
  distinct fields (grep `-oE "history\.[a-zA-Z]+|symptoms\.[a-zA-Z]+|exam\.[a-zA-Z]+"` | sort -u).
  Every one of these currently collapses `undefined`/`false`/never-touched into a single falsy
  branch — this is the exact WP1 problem statement.

**`src/ruleEngine.js`** (160 lines) — operator set implemented today, all in `evaluateLeaf()`
(`src/ruleEngine.js:18-37`), 13 operators total: `eq` (default), `neq`, `gt`, `gte`, `lt`, `lte`,
`in`, `not-in`, `includes`, `exists`, `missing`, `truthy`, `falsy`. Combinators `all`/`any`/`not`
handled separately in `evaluateCondition()` (`:39-49`). A new operator (`is-present`/`is-absent`/
`is-unknown`/`is-not-assessed` per WP1) is added as a new `case` in the `switch` at
`src/ruleEngine.js:21-36`; the `default` branch throws `Unknown rule operator` (`:35`), so any
unrecognized op is a hard failure today (a useful existing fail-closed behavior to preserve, not a
gap). The rest of `ruleEngine.js` (`mergeCandidate`, `runRules`, ranking sort) is untouched by P0
per plan (`platform-foundation-p0-v1.md` frontmatter: "`src/ruleEngine.js` untouched") and should
still not need touching for the new operators beyond the switch statement.

**`src/engine.js`** (38 lines) — `assess(input, moduleId, rules, candidates)` signature
(`src/engine.js:11`), 4-arg per OQ-6 (KB JSON is always caller-loaded; no `fs` in browser). Output
shape (`:17-37`): `{ meta: {engine, knowledgeBaseVersion, evidenceReviewedThrough, generatedAt,
intendedUser, status}, classification, alerts, rankedDifferential, nextQuestions,
interpretiveNotes, limitations, provenance: {evaluatedRuleCount, matchedRuleIds, ruleAudit} }`.
`assessPediatricAnemia(input, rules, catalog)` (`:40-42`) is the legacy 3-arg shim calling
`assess(input, 'anemia', rules, catalog)`. Phase 1's manifest/fail-closed work will likely need to
thread manifest-verification status into `meta` or throw before reaching this function.

**`src/ranges/registry.js`** (57 lines) — two independent primitives (module-agnostic, keyed
`` `${moduleId}::${analyte}` ``): `registerAnalyteBands`/`getBuiltInAnalyteValue` (age/sex-banded
values) and `registerThresholdRule`/`getThreshold` (arbitrary non-banded lookup, e.g. ferritin's
menstruating-gated cutoff). An unregistered pair returns `null`, never throws (`:12-13` doc
comment) — this tolerant-null behavior is what P1-WP2's "fail-closed unit-mismatch rejection" must
change for the unit-check path specifically (today there is **no unit representation at all** —
values are bare numbers; `patient-input.schema.json` `description` fields like `"g/dL"` are JSON
Schema doc-strings only, never validated or compared). `modules/anemia/ranges.js` (118 lines) is
the module-specific registration + composition wrapper reproducing the pre-registry
`getEffectiveRanges()`/`getBuiltInRange()` shapes verbatim, sourced from `reference-ranges.json`
via `import ... with { type: 'json' }`.

**`src/evidence.js` and `modules/anemia/evidence.json`** — **DEF-1 unresolved duplication**: two
independently-maintained copies of the same 6 evidence records. IDs: `AAP2026_IDA`, `WHO2024_HB`,
`BLOOD2022_PED_ANEMIA`, `CDC2025_LEAD`, `FDA2026_CDS`, `BSH2020_G6PD`
(`src/evidence.js:9-106`, `modules/anemia/evidence.json:6-99`). `supports[]` today is an array of
**plain claim-summary strings** (e.g. `"Ferritin thresholds of ≤20 ng/mL in young/school-aged
children and ≤30 ng/mL in adolescents..."`, `src/evidence.js:23`) — no locator, no exact passage,
no per-claim grade. This is exactly what P1-WP3 must extend into locatable passages
(`sourceLocator`, `exactPassage`, `evidenceGrade`, `applicability`, `reviewDate`, `supersedes`,
`surveillanceQuery`, `status`). Only **5 of the 6** evidence IDs are actually referenced by any
rule's `evidence[]` array today (`BSH2020_G6PD` — the G6PD guideline — is registered but unused by
any rule's `when`/`output.evidence`; `FDA2026_CDS` is also unreferenced by rules, used only for
product/regulatory framing) — worth confirming during backfill whether unreferenced evidence still
needs exact-passage treatment.

**`modules/anemia/rules.json`** — **91 rules** (confirmed via
`JSON.parse(...).length`). Distinct top-level keys across all 91 rules: exactly **5** —
`id`, `category`, `evidence`, `when`, `output`. No `version`/`effectiveDate`/`retireDate`/`owner`/
`clinicalApprovers`/`safetyClass`/`requiredTestCaseIds`/`changeRationale`/`sourcePassageId` exist
anywhere yet — WP4 is a pure additive extension, not a migration of existing fields. **33 of 91
rules** (`node` grep over `when` conditions) reference a `history.*`/`symptoms.*`/`exam.*` fact
path directly in their `when` condition — these are the rules a tri-state fact-shape change could
alter matching behavior for if not done carefully (101 distinct fact paths total referenced across
all rule conditions).

**`modules/anemia/candidates.json`** — object (not array) keyed by candidate id, **26 keys**.
Each candidate: `{id, label, category, summary, defaultNextSteps: [...], evidence: [...]}` (matches
`schemas/candidate.schema.json` required fields exactly).

**`modules/anemia/module.json`** — see P0 section above; unsigned-stub shape already anticipates
WP5's field names (`clinicalContentHash`, `approvedBy`, `validationRunId`, `supersedes`), just
null/empty today. `schemaVersion: 1` present but no formal JSON Schema validates this file (DEF-5).

**`server.mjs`** (187 lines) — routes: `GET /health` (`:134-139`), `GET /api/v1/knowledge-base`
(`:142-151`, includes new P0 `modules` per-module breakdown), `POST /api/v1/assess` (`:153-160`),
plus static-file serving with a CSP header set (`:81-87`) and a path-traversal guard
(`safePath`, `:98-104`). **The fail-closed KB-verification hook has no home yet**: module loading
happens in `loadModuleData()` (`:19-38`), called at startup in the `for (const moduleId of
MODULE_IDS)` loop (`:41-48`) — this already fails fast (`process.exit(1)`) on missing/unparseable
JSON, but there is **zero signature/hash verification, zero `evidenceReviewedThrough` expiry
check, and zero engine-compatibility check** against `module.json`'s (currently null)
`clinicalContentHash`/`validationRunId` fields. `module.json` itself is read tolerantly — its
absence is caught and ignored (`:26-31`, `if (error.code !== 'ENOENT') throw error`) — Phase 1 must
change this from "manifest optional" to "manifest required + verified, reject unverifiable/expired
KB" per ARCH §10.

## C. Schemas

`schemas/` contains exactly 4 files today — **no `evidence.schema.json`, no
`kb-manifest.schema.json`, no `reference-range.schema.json`, no `review-record.schema.json` yet**
(all net-new for Phase 1 per the roadmap table).

| File | `$id` | Required (top) |
|---|---|---|
| `patient-input.schema.json` | `https://example.org/pediatric-anemia/schemas/patient-input.schema.json` | none required at top level (all optional sub-objects), `additionalProperties: false` |
| `rule.schema.json` | `https://example.org/pediatric-anemia/schemas/rule.schema.json` | `["id","category","when","evidence","output"]` |
| `candidate.schema.json` | `https://example.org/pediatric-anemia/schemas/candidate.schema.json` | `["id","label","category","summary","defaultNextSteps","evidence"]` |
| `assessment-output.schema.json` | `https://example.org/pediatric-anemia/schemas/assessment-output.schema.json` | `["meta","classification","alerts","rankedDifferential","nextQuestions","limitations","provenance"]` |

`rule.schema.json` is `additionalProperties: false` at the top level
(`schemas/rule.schema.json:7`) — **any new WP4 field (`version`, `effectiveDate`, etc.) must be
explicitly added to `properties` or every rule will fail schema validation the moment one is
added**; this is a hard coupling point, not optional cleanup.

The `booleanMap` `$def` in `patient-input.schema.json` (`:114-117`), quoted verbatim:

```json
"booleanMap": {
  "type": "object",
  "additionalProperties": { "type": "boolean" }
}
```

Used by `symptoms`, `history`, `exam` top-level properties (`:64-66`, all `{"$ref":
"#/$defs/booleanMap"}`). This is the exact `$def` WP1 replaces with a `triState` `$def` (roadmap:
`booleanMap`→`triState`). Because it's `additionalProperties`-typed (no enumerated field list),
**every currently-unnamed field name under `history`/`symptoms`/`exam` is implicitly valid** — the
tri-state replacement needs to decide whether to keep this open-ended shape (each field becomes
`{"state": "present"|"absent"|"unknown"|"not-assessed"}`) or enumerate the known 56 fields
explicitly, which affects both migration size and rule-authoring safety.

No JSON Schema exists for `evidence.json`/`EVIDENCE` records at all today — WP3 is authoring a new
file from scratch, not extending one.

## D. Test + tooling surface

**`tests/`** — 4 items:
- `tests/engine.test.mjs` (4664 bytes) — **10** `test()` blocks, **30** `assert.*` calls.
- `tests/module-equivalence.test.mjs` (1922 bytes) — 1 `test()` wrapped in a `for` loop over the 6
  `examples/*.json` files (so it registers 6 named subtests at runtime, not 1 static test) — the
  permanent golden-fixture equivalence harness from P0 (`tests/module-equivalence.test.mjs:1-9`
  docstring: "permanent addition to `npm test`, not a scaffolding step").
- `tests/module-registry.test.mjs` (3101 bytes) — 4 `test()` blocks, 8 `assert.*` calls (registry
  completeness, manifest shape, per-module KB parse, `loadModuleCode` resolution).
- `tests/golden/` — 6 committed fixture files (`anemia-inflammation.json`,
  `beta-thalassemia-trait.json`, `hemolysis-hs.json`, `ida-toddler.json`, `lead-capillary.json`,
  `marrow-red-flags.json`), captured pre-refactor by `scripts/capture-golden.mjs` and re-asserted
  by `module-equivalence.test.mjs`.

Total: `npm test` currently runs **20 discrete `node --test` subtests** across the 3 files (per
actual `npm run check` output: `# tests 20`, `# pass 20`).

**No `property.test.mjs`, `boundary.test.mjs`, `mutation.test.mjs`, or `dangerous-miss.test.mjs`
exist yet** — all 4 are net-new for P1-WP6.

**`scripts/`** — 5 files:
- `build-static.mjs` — builds `dist/` static bundle, copies module directories, applies a
  content-hash asset-URL stamp for cache-busting.
- `capture-golden.mjs` — captures `assessPediatricAnemia()` output for every `examples/*.json`
  into `tests/golden/<example>.json` (permanent, run manually when intentional output changes).
- `check-app-imports.mjs` — P0-added permanent runtime app-surface smoke check: (a) static
  import/`fetch()` specifier resolution in `src/app.js`/`src/algorithmExplorer.js` under both dev
  and `dist/` layouts, (b) dynamic module-graph load under Node.
- `smoke-test.mjs` — spawns `server.mjs` as a child process, hits `/health`, `/api/v1/knowledge-base`,
  `/api/v1/assess` over real HTTP.
- `validate-kb.mjs` — validates rule/candidate/evidence referential integrity per module + a
  version-drift check across `module.json`/`evidence.json`/`src/evidence.js`.

**No `sign-kb.mjs`, `kb-diff.mjs`, or `mutation-run.mjs` exist yet** — all 3 are net-new for
P1-WP5/WP6.

**`package.json`** scripts (verbatim, `package.json:7-15`):
```
"start": "node server.mjs"
"build": "node scripts/build-static.mjs"
"test": "node --test tests/*.test.mjs"
"validate": "node scripts/validate-kb.mjs"
"smoke": "node scripts/smoke-test.mjs"
"check": "npm test && npm run validate && npm run build && npm run check:imports && npm run smoke"
"check:imports": "node scripts/check-app-imports.mjs"
```
Confirmed: `npm run check` = test → validate → build → check:imports → smoke, in that order.
`engines.node: ">=20"`.

**`examples/`** — exactly 6 files (the "6 worked examples"): `anemia-inflammation.json`,
`beta-thalassemia-trait.json`, `hemolysis-hs.json`, `ida-toddler.json`, `lead-capillary.json`,
`marrow-red-flags.json`. `marrow-red-flags.json` is the closest existing thing to a
"dangerous-miss" case (roadmap names marrow failure/hemolysis/severe cytopenia as the dangerous-
miss set for WP6) but there is no dedicated dangerous-miss *test suite* — only this one example
consumed by the equivalence harness, not a targeted safety-regression test.

**CI**: exactly one workflow, `.github/workflows/deploy-pages.yml`. It runs `npm test`, `npm run
validate`, `npm run build`, `npm run smoke` — **it does not run `npm run check:imports`** (added in
P0, not yet added to CI) and gates the GitHub Pages deploy on those 4 steps passing. No PR-trigger
CI job exists (only `push: branches: [main]` and `workflow_dispatch`), so there is no automated
gate on branches/PRs today — only on `main` push and manual dispatch.

**No property-based/fuzz/mutation-testing dependency exists.** `package.json` has **no
`dependencies` or `devDependencies` field at all** — confirmed by reading the full file (7 fields:
name, version, private, type, description, scripts, engines) — and there is no `package-lock.json`
and no third-party packages in `node_modules/` (only the two local generated dirs). This is a
real constraint for P1-WP6: property/mutation testing (e.g., `fast-check`, Stryker) would be the
**first external dependency this repo has ever taken on**, in tension with the project's current
zero-runtime-dependency posture — Phase 1 planning should treat "add a devDependency" as a decision
point, not an assumption, or plan to hand-roll generators/mutators against `node:test` directly.

## E. Docs that Phase 1 touches or must stay consistent with

**`docs/architecture.md`** section headings (`grep -n "^#"`):
```
# Production Architecture
## 1. Design goals
## 2. Prototype architecture
## 2a. Module package architecture (Phase 0)
## 3. Recommended production deployment
### Components
## 4. Data boundaries
### Recommended default
### Browser-only mode
### Server mode
## 5. API contract
## 6. Knowledge-base release manifest
## 7. Rule-authoring model
## 8. FHIR integration proposal
## 9. Security controls
## 10. Availability and failure modes
```

- **§6 (`:103-122`, Knowledge-base release manifest)** — the normative shape P1-WP5 implements:
  `{knowledgeBaseVersion, clinicalContentHash: "sha256:...", engineCompatibility: ">=1.0.0
  <2.0.0", evidenceReviewedThrough, approvedBy: [{role, approvalId}] (hematologist/pediatrician/
  lab-medicine triplet), validationRunId, supersedes, releasedAt}`. Today's `module.json` already
  has this exact field set but all signing/hash/approval fields are null — WP5 is "fill and
  enforce," not "invent the shape."
- **§7 (`:124-146`, Rule-authoring model)** — documents today's DSL exactly as implemented in
  `ruleEngine.js` (all/any/not, eq/numeric/exists/missing, 4 output types, evidence IDs + fixed
  text) then lists "Production additions" verbatim matching P1-WP4's field list: JSON Schema
  validation (partially done — `rule.schema.json` exists but lacks these fields), typed facts
  registry with units, exact source passage/section locator per rule (WP3), effective/retirement
  dates (WP4), supersession links, rule owner + clinical approvers (WP4), safety classification
  (WP4), required test-case IDs (WP4), change rationale + impact analysis (WP4). Also warns:
  "Avoid executable code inside clinical rules" — still true, `ruleEngine.js` has no `eval`/`new
  Function` anywhere.
- **§8 (`:148-165`, FHIR integration proposal)** — mostly a future-state FHIR resource mapping
  (Patient/Observation/Condition/MedicationStatement/DiagnosticReport → CDS Hooks card or
  `GuidanceResponse`), but its last line is the operative WP2 spec: "FHIR mapping requires local
  code-system governance (LOINC/SNOMED CT/UCUM) and should **reject unit mismatches rather than
  silently convert** ambiguous values" (`:165`). No unit representation of any kind exists in code
  today (see §B ranges/registry note) — this is greenfield, not a refactor of existing unit logic.
- **§10 (`:178-188`, Availability and failure modes)** — the fail-closed contract: must fail closed
  when reference units are absent/incompatible, age is outside supported range with no local
  limits, KB package signature/hash is invalid, UI/engine versions are incompatible, or evidence
  version is expired under governance policy — displaying "no assessment produced," never
  stale/partial output. **None of these 5 conditions has a corresponding check in code today**
  (server.mjs tolerates a missing manifest; there is no version-compatibility check; no expiry
  check against `evidenceReviewedThrough`; age-out-of-range currently just sets
  `scope.supportedAge: false` and narrows limitations text, `facts.anemia.js:26,214` — it does not
  refuse to assess). WP5's "server rejects unverifiable/expired KB" is the direct implementation of
  this section.

**Planning-doc inventory** (`docs/project_plans/`):
- `SPIKEs/` — **only 2 files exist**: `spike-001-module-package-boundary.md`,
  `spike-002-multi-module-loader.md` (both P0 inputs). **SPIKE-003 (tri-state migration),
  SPIKE-004 (FHIR/UCUM unit-mismatch rejection), SPIKE-005 (semantic-diff classification), and
  SPIKE-006 (KB signing key custody) — all four Phase-1-named SPIKEs — do not exist yet.** They
  must be authored before/during Phase 1 per the roadmap's own "Research required" list
  (roadmap `:219`).
- `PRDs/` — only `PRDs/refactors/platform-foundation-p0-v1.md` exists. No Phase 1/wave0 PRD yet.
- `design-specs/` — 8 files, all P0 deferred-item specs (see §A table); none is a Phase 1 PRD or
  plan, but several (`tri-state-fact-model.md` maturity `shaping`, `exact-passage-evidence-
  schema.md` maturity `idea`, `signed-kb-manifest.md` maturity `idea`) are direct shaping input for
  WP1/WP3/WP5 and should be read before planning those WPs in depth.
- `human-briefs/` — only `platform-foundation-p0.md` exists. No Phase 1 human brief yet.
- `implementation_plans/` — `refactors/platform-foundation-p0-v1.md` (completed, P0) and
  `enhancements/arc-clinical-council-adoption-v1.md` (unrelated — ARC council adoption, not
  clinical Phase 1 work; currently untracked in git status).

**Stale claims that will need updating once Phase 1 ships** (all currently accurate — these are
"will become stale," not "already wrong"):
- `CLAUDE.md:43` — "`modules/anemia/rules.json` (91 rules), `modules/anemia/candidates.json` (26
  patterns)" — rule count is stable under Phase 1 (additive metadata, not new rules) but WP4 adds
  fields per rule; worth a one-line CLAUDE.md addendum noting the new metadata fields exist.
- `README.md:92-93` — "91 deterministic rules" / "26 diagnostic patterns" — counts stay correct,
  but README's directory tree (`README.md:117-119`) still shows a **stale `data/` directory**
  (`data/rules.json`, `data/candidates.json`) that P0 already relocated to `modules/anemia/` —
  this is **already stale today**, not a future Phase 1 concern, and Phase 1 should fix it in
  passing since it's directly adjacent to the KB files it's editing.
- `README.md:84-86` — the pipeline diagram also still says `data/rules.json` / `data/candidates.json`
  — same pre-existing staleness from P0, not caused by Phase 1 but sitting in a file Phase 1 will
  likely touch (KB versioning/manifest surfaced via `/api/v1/knowledge-base`).
- `docs/clinical-algorithm.md:3,294` — "This document describes the deterministic reasoning encoded
  in `data/rules.json`" — same pre-existing stale path reference.
- `README.md:96` — "10 automated engine tests" — already understates the true count (20 subtests
  across 3 files post-P0); Phase 1 adding 4 new test files (property/boundary/mutation/dangerous-
  miss) makes this claim badly stale and worth correcting alongside the new suites.
- `docs/project_plans/expansion/01-platform-expansion-roadmap.md` and `02-evidence-foundry-on-
  research-foundry.md` both still reference `data/rules.json`/`data/evidence.json` paths in several
  places (pre-P0 vocabulary) — these are planning docs, lower priority to fix, but any Phase 1 doc
  edit referencing them should use the current `modules/anemia/*` paths.

## F. Gate check

**`npm run check`: PASS.** Node `v20.19.3`.

Tail of output:
```
> pediatric-anemia-cdss@0.3.1 validate
> node scripts/validate-kb.mjs
Validated modules: anemia (91 rules, 26 candidates, 6 evidence records).

> pediatric-anemia-cdss@0.3.1 build
> node scripts/build-static.mjs
Static site built at /Users/miethe/dev/homelab/development/pediatric-anemia-site/dist
91 rules · 26 patterns · 6 evidence records
Asset stamp ?v=bcd4e39efd08 applied to index.html and 4 module(s)

> pediatric-anemia-cdss@0.3.1 check:imports
> node scripts/check-app-imports.mjs
== check-app-imports: (a) static import/fetch specifier resolution ==
OK: all static import/fetch specifiers in src/app.js, src/algorithmExplorer.js resolve under both dev and dist/ layouts.
== check-app-imports: (b) dynamic module-graph load under Node ==
OK: src/engine.js loaded
OK: src/facts.js loaded
OK: src/modules/registry.js loaded
OK: modules/anemia/index.js loaded
OK: modules/anemia/ranges.js loaded
check-app-imports: all checks passed.

> pediatric-anemia-cdss@0.3.1 smoke
> node scripts/smoke-test.mjs
Smoke test passed: KB 0.1.0-2026-07-15; 2 differential pattern(s) returned.
```
(`npm test` portion, preceding this tail, reported `# tests 20 / # pass 20 / # fail 0`.) No fixes
applied — repo left exactly as found.

## G. Sizing signals (per Phase 1 WP)

| WP | Rough file-touch count | Nasty coupling observed |
|---|---|---|
| **P1-WP1** (tri-state) | ~6 direct: `schemas/patient-input.schema.json`, `src/ruleEngine.js`, `src/facts/core.js`, `modules/anemia/facts.anemia.js`, `modules/anemia/rules.json`, plus `src/algorithmExplorer.js` (UI consumer) if boolean display logic needs updating | **56 distinct `history.*`/`symptoms.*`/`exam.*` fields** read via `=== true`/`countTrue` in one 357-line file; **33 of 91 rules** reference these fact paths directly in `when` conditions (101 distinct fact paths total) — every one of those 33 rules' matching semantics must be re-verified against the golden fixtures after the tri-state switch, since "not-assessed" must never satisfy an "absent" branch (a behavior change from today's implicit `undefined === true → false` collapse, which currently treats not-assessed and absent identically). 9 `countTrue()` call sites each aggregate 2-9 fields — every constituent field of every one of those 9 aggregates needs a tri-state-aware rewrite of the aggregation logic (`> 0` on a boolean count vs. "any present" vs. "any not-assessed" are now three different questions). |
| **P1-WP2** (ranges/units) | ~4: `src/ranges/registry.js`, new `src/units.js`, `modules/anemia/ranges.js` (probably needs a unit tag per band), new `schemas/reference-range.schema.json` | **Zero existing unit representation to build on** — greenfield, not refactor. `patient-input.schema.json`'s unit hints (`"description": "g/dL"`, `:23-29`) are unenforced JSON Schema doc-strings today; every one of the ~10 numeric lab fields (hemoglobin, mcv, rdw, rbc, wbc, anc, platelets, ferritin, stfrFerritinIndex, bloodLeadLevel) needs an explicit unit before "reject unit mismatch" has anything to check against. |
| **P1-WP3** (exact-passage evidence) | ~4: `src/evidence.js`, `modules/anemia/evidence.json`, new `schemas/evidence.schema.json`, `scripts/validate-kb.mjs` (referential-integrity check needs extending) | The **DEF-1 dual-source problem is still live** — `src/evidence.js` and `modules/anemia/evidence.json` are two hand-synced copies of the same 6 records; WP3 should not extend both independently without also resolving DEF-1, or the passage/locator work doubles and drifts immediately. 6 evidence records × their `supports[]` arrays (avg ~4-7 claim strings each, `src/evidence.js:20-28,38-42,54-59,69-74,84-88,98-101`) = roughly 30 individual claim strings that each need a locator + exact passage — this is a content/research task (RF-EV-001), not just a schema change. |
| **P1-WP4** (rule metadata) | ~2 direct: `schemas/rule.schema.json`, `modules/anemia/rules.json` | `rule.schema.json` is `additionalProperties: false` at the top level (`:7`) — **every one of the 91 rules must gain the new fields simultaneously**, or validation breaks for the ones that don't; this is an all-or-nothing schema change against a 91-entry array, not an incremental one. No existing `version`/`owner`/etc. fields to migrate from — pure additive, which caps risk somewhat. |
| **P1-WP5** (signed manifest) | ~5: new `scripts/sign-kb.mjs`, new `scripts/kb-diff.mjs`, `server.mjs`, new `schemas/kb-manifest.schema.json`, `modules/anemia/module.json` (fields already present, just need real values) | `server.mjs`'s current manifest handling is **tolerant-of-absence** (`:26-31`, catches `ENOENT` and continues with `manifest: null`) — WP5 must flip this to **required-and-verified**, which is a behavior change to the server's startup fail-fast path, not just an addition. Depends on WP3 (evidence hash inputs) and WP4 (rule hash inputs) per the roadmap's own sequencing note (`:228`), so it cannot start first despite being conceptually central. |
| **P1-WP6** (test corpus) | ~5 new files: `tests/property.test.mjs`, `tests/boundary.test.mjs`, `tests/mutation.test.mjs`, `tests/dangerous-miss.test.mjs`, new `scripts/mutation-run.mjs` | **No mutation/property-testing dependency exists in this zero-dependency repo** (`package.json` has no `dependencies`/`devDependencies` at all, no lockfile) — first external devDependency decision point for the whole project, or a hand-rolled-generator approach against bare `node:test`. Dangerous-miss set (marrow failure, hemolysis, severe cytopenia) has exactly **one** existing example (`examples/marrow-red-flags.json`) to build from; hemolysis (`hemolysis-hs.json`) and severe-cytopenia cases need new authored fixtures, not just repurposed existing ones. |
| **P1-WP7** (review-portal concept) | ~2: new `docs/` design doc, new `schemas/review-record.schema.json` | Paper-design only per roadmap ("concept + data contract only, not the full app," `:164`) — lowest code-coupling WP; can run in parallel with everything else and has no dependency on the other 6. |

Overall cross-cutting observation: **WP1 and WP6 are coupled** (roadmap already notes "P1-WP6
depends on WP1," `:228`) because the dangerous-miss/property suites need to assert against the
*new* tri-state fact shape, not the old boolean one — writing WP6 tests before WP1 lands would
mean rewriting them immediately after. **WP3 and WP5 are coupled** through the unresolved DEF-1
dual evidence source: extending `evidence.json` for exact-passage without collapsing
`src/evidence.js` first means WP5's manifest hash would need to hash two files that can drift from
each other, defeating the "clinicalContentHash" concept's integrity guarantee.
