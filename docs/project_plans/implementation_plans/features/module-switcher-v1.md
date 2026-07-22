---
title: "Implementation Plan: Module Switcher — Public moduleId API Surface + SPA Module Selector"
schema_version: 2
doc_type: implementation_plan
status: draft
created: 2026-07-22
updated: 2026-07-22
feature_slug: "module-switcher"
feature_version: "v1"
prd_ref: docs/project_plans/PRDs/features/module-switcher-v1.md
plan_ref: null
scope: "Close the kidney/growth Registration Gap, expose moduleId as a client-settable POST /api/v1/assess body field and SPA selector across all 4 registered modules, and enforce a fail-closed, manifest-derived unsigned-proposal banner/API flag — zero clinical content changes."
effort_estimate: "13 pts"
architecture_summary: "src/units.js and src/evidence/registry.js gain kidney_suite_v1/growth_suite_v1 entries (P1); a new shared src/moduleSigningStatus.js accessor derives signing status fail-closed from module.json and is consumed identically by server.mjs (P2) and src/app.js (P3, same file, imported directly — SPA is browser-local); server.mjs resolves moduleId -> modulesById[moduleId] instead of hardcoding anemia (P2); src/app.js gains a module selector, moduleId-driven KB loading, and a persistent per-module banner (P3); docs/openapi/design-spec close out the surface (P4)."
related_documents:
  - .claude/worknotes/module-switcher/decisions-block.md
  - .claude/worknotes/module-switcher/recon-brief.md
  - docs/project_plans/design-specs/public-moduleid-api-surface.md
references:
  user_docs: []
  context:
    - .claude/worknotes/module-switcher/decisions-block.md
    - .claude/worknotes/module-switcher/recon-brief.md
  specs:
    - schemas/module-manifest.schema.json
    - schemas/patient-input.schema.json
  related_prds: []
spike_ref: null
adr_refs: []
deferred_items_spec_refs: []
findings_doc_ref: null
charter_ref: null
changelog_ref: null
changelog_required: true
test_plan_ref: null
plan_structure: unified
progress_init: auto
owner: nick
contributors: []
priority: high
risk_level: medium
category: "product-planning"
tags: [implementation, planning, phases, tasks, module-switcher, api, spa, def-6]
milestone: null
commit_refs: []
pr_refs: []
files_affected:
  - src/units.js
  - src/evidence/registry.js
  - src/moduleSigningStatus.js
  - src/modules/registry.js
  - src/serverErrors.js
  - src/engine.js
  - server.mjs
  - src/app.js
  - index.html
  - modules/kidney_suite_v1/units.js
  - modules/kidney_suite_v1/evidence.js
  - modules/kidney_suite_v1/index.js
  - modules/growth_suite_v1/units.js
  - modules/growth_suite_v1/evidence.js
  - modules/growth_suite_v1/index.js
  - openapi.yaml
  - schemas/patient-input.schema.json
  - scripts/check-app-imports.mjs
  - scripts/smoke-browser-unit-rejection.mjs
  - tests/module-registry.test.mjs
  - tests/server-error-contract.test.mjs
  - docs/architecture.md
  - docs/project_plans/design-specs/public-moduleid-api-surface.md
  - CHANGELOG.md
wave_plan:
  serialization_barriers:
    - src/modules/registry.js
    - openapi.yaml
  phases:
    - id: P1
      depends_on: []
      isolation: shared
      parallelizable: false
      provider: claude
      files_affected:
        - src/units.js
        - src/evidence/registry.js
        - src/moduleSigningStatus.js
        - src/modules/registry.js
        - modules/kidney_suite_v1/units.js
        - modules/kidney_suite_v1/evidence.js
        - modules/kidney_suite_v1/index.js
        - modules/growth_suite_v1/units.js
        - modules/growth_suite_v1/evidence.js
        - modules/growth_suite_v1/index.js
        - tests/module-registry.test.mjs
    - id: P2
      depends_on: [P1]
      isolation: shared
      provider: claude
      files_affected:
        - src/serverErrors.js
        - server.mjs
        - openapi.yaml
        - schemas/patient-input.schema.json
        - tests/server-error-contract.test.mjs
    - id: P3
      depends_on: [P2]
      isolation: shared
      provider: claude
      files_affected:
        - index.html
        - src/app.js
        - scripts/check-app-imports.mjs
        - scripts/smoke-browser-unit-rejection.mjs
    - id: P4
      depends_on: [P3]
      isolation: shared
      provider: claude
      files_affected:
        - openapi.yaml
        - docs/architecture.md
        - docs/project_plans/design-specs/public-moduleid-api-surface.md
        - CHANGELOG.md
  waves:
    - [P1]
    - [P2]
    - [P3]
    - [P4]
---

# Implementation Plan: Module Switcher — Public `moduleId` API Surface + SPA Module Selector

**Plan ID**: `IMPL-2026-07-22-module-switcher`
**Date**: 2026-07-22
**Author**: implementation-planner agent (sonnet), expanding an Opus-authored decisions block
**Human Brief**: `docs/project_plans/human-briefs/module-switcher.md`
**Related Documents**:
- **PRD**: `docs/project_plans/PRDs/features/module-switcher-v1.md`
- **Decisions Block**: `.claude/worknotes/module-switcher/decisions-block.md` (binding phase/agent/model structure)
- **Recon Brief**: `.claude/worknotes/module-switcher/recon-brief.md` (grounded file:line anchors — cited, not re-derived)
- **Design Spec**: `docs/project_plans/design-specs/public-moduleid-api-surface.md` (promoted by this PRD)

**Complexity**: Medium (4 capability areas: registry plumbing, public API, SPA UI, docs)
**Total Estimated Effort**: 13 pts
**Provider**: claude (sonnet) for all build tasks; codex (gpt-5.6-terra) for P2/P3 read-only diff review gates per decisions block §2/§6. No UI-mockup or web-research model routing needed (vanilla-JS SPA, no new design surface beyond a `<select>` and a banner).

## Executive Summary

Four modules are registered (`anemia`, `cbc_suite_v1`, `kidney_suite_v1`, `growth_suite_v1`) but only `anemia` is reachable — the engine is already fully module-parameterized (`src/engine.js#assess(input, moduleId, rules, candidates)`), yet `server.mjs` hardcodes `anemia` and the SPA (`src/app.js`) hardcodes anemia's file paths with no selector. Worse, `kidney_suite_v1`/`growth_suite_v1` currently **throw** when assessed at all, because they were never registered in `src/units.js`/`src/evidence/registry.js` (the Registration Gap, PRD §2). This plan closes that gap first (P1), then reaches the engine from the outside via an additive, backward-compatible `moduleId` request field (P2) and an SPA selector (P3), with every module's manifest-derived signing status (today: none are signed) rendered as an unmissable, fail-closed banner and machine-readable API flag — never a hardcoded `moduleId !== 'anemia'` check. P4 closes out docs, the `openapi.yaml` contract, and design-spec promotion. Zero new clinical rules, thresholds, or evidence content anywhere in this diff.

## Implementation Strategy

### Architecture Sequence

Not a layered CRUD feature; sequence follows the call graph outward from the load-bearing safety artifact:

1. **Registration-gap + signing-status accessor** (P1) — the fail-closed status derivation is the safety artifact every later phase consumes, never re-derives; FR-0's registry plumbing is a hard prerequisite (`assess()` throws for 2 of 4 modules without it).
2. **Public API surface** (P2) — contract frozen before UI consumes it.
3. **SPA selector + banner** (P3) — consumes P2's frozen contract; browser-local, so it imports P1's shared accessor directly rather than calling the API.
4. **Docs, doc-truth, validation sweep** (P4) — describes what actually shipped.

### Parallel Work Opportunities

None taken. Decisions block §2/§5: P2 (`server.mjs`) and P3 (`src/app.js`) touch disjoint files and could parallelize on ownership grounds, but are sequenced serially anyway — P3 consumes P2's frozen contract, and this repo's parallel-PR schema-drift incident (project memory: a schema tightening and its fixtures merged 6h apart turned main red) argues against parallelizing adjacent contract-touching phases here. P1 is strictly first (hard dependency: FR-0). Within P2, `openapi.yaml` authoring and `server.mjs` implementation are same-owner-phase parallelizable slices, not separate waves.

### Critical Path

**Fix-gate green baseline → P1 → P2 → P3 → P4.** Fully serial by design (decisions block §5). No phase is off the critical path.

### R-P3 / R-P4 Applicability Note

**R-P3** (integration_owner + seam task for phases with ≥2 owner specialties and overlapping `files_affected` in the same wave): does not trigger — every phase uses a single owner specialty (`general-purpose` sonnet executor) and no two phases share a wave (fully serial). No `integration_owner` field is needed.

**R-P4** (UI-touching phases need a runtime-smoke task referencing every `target_surfaces` entry): this repo has no `*.tsx` files, but the rule's intent applies to P3's `index.html`/`src/app.js` UI changes. Applied in spirit: P3-T7 (browser smoke) and P4-T6 (full gate rerun) are the `verified_by` tasks for the FR-9 banner AC below.

### Phase Summary

| Phase | Title | Estimate | Target Subagent(s) | Model(s) | Provider | Profile | Notes |
|-------|-------|---------:|--------------------|----------|----------|---------|-------|
| P1 | Registration gap + status accessor + tripwire retirement | 4 pts | general-purpose | sonnet (extended on P1-T3) | claude | — | FR-0 blocking prerequisite; fail-closed signing-status accessor is the load-bearing safety artifact |
| P2 | Public API surface | 3 pts | general-purpose | sonnet | claude | — | Additive `moduleId` body field; codex read-only diff review gate |
| P3 | SPA module selector + unsigned banner | 4 pts | general-purpose | sonnet (extended on P3-T4) | claude | — | Largest phase; codex read-only diff review gate, banner fail-closed focus |
| P4 | Docs, doc-truth, validation sweep | 2 pts | general-purpose | haiku (docs) / sonnet (doc-truth tests + gate rerun) | claude | — | Full `npm run check` gate rerun; task-completion-validator + karen |
| **Total** | — | **13 pts** | — | — | — | — | — |

> Estimation rationale (H1–H6 heuristics, per-area sums, anchor comparison) lives in `docs/project_plans/human-briefs/module-switcher.md` §2. This plan carries per-phase task estimates only.

### Hard Entry Dependency — Green Baseline Required Before P1

`npm run check` is **RED on `main`** at `263120b` — 25 pre-existing failing subtests (of 2412), all E1 baseline/hash-pin drift (`tests/ef-anemia-backfill-integrity.test.mjs`, `tests/ef-p4-t8-honesty-ac.test.mjs`, cbc converter suites, rights gates, `notice-architecture-no-clearance`), **not** logic breakage and **not** caused by this feature (recon brief §6). Green-gate-before-commit is unfalsifiable against a red baseline.

- Execution **starts only from a green baseline SHA**, recorded in this plan's `commit_refs` / P1's entry criteria before any P1 task lands a commit.
- Candidate fix-gate branches exist (`fix/d4-dist-order` et al.) — this feature depends on one of them landing on `main` first, or on the phase owner branching from a locally-verified green commit and recording that SHA.
- **This feature must not fix the drifted hash pins itself** — that is the fix-gate's scope, not module-switcher's. If P1's entry criteria cannot be met, escalate rather than absorb the fix into this plan.

## Deferred Items & In-Flight Findings Policy

### Deferred Items

#### Deferred Items Triage Table

| Item ID | Category | Reason Deferred | Trigger for Promotion | Target Spec Path |
|---------|----------|------------------|------------------------|-------------------|
| DEF-SW-1 | scope-cut | Multi-module / array-valued `moduleId` and a combined cross-module assessment view — PRD §7 explicitly out of scope (design-spec OQ-3, resolved single-select-only for v1). Single-select is the simplest, least-hardcoded design; a combined view needs its own UX design pass. | A concrete integrator/clinician use case for cross-module assessment emerges, or a 5th module makes single-select navigation unwieldy. | `docs/project_plans/design-specs/multi-module-assessment-view.md` |
| DEF-SW-2 | dependency-blocked | PRD OQ-M1: a dedicated `module.json` field for "clinically signed for display" (distinct from content-integrity `status` and the D-4 `approvedBy` array) would avoid a second independently-maintained "is this signed" computation diverging from whatever the clinical-review-workflow program eventually builds. This plan derives signing status from existing fields (FR-9) rather than adding a schema field now, to avoid a speculative schema change ahead of that program's design. | The clinical-review-workflow program (commits `e8fd5dd`/`28c9633`) reaches a planning pass where it decides whether to supersede this feature's `src/moduleSigningStatus.js` derivation with a first-class manifest field. | `docs/project_plans/design-specs/module-signing-status-schema-field.md` |

Both rows get a DOC-006 design-spec authoring task in P4 (P4-T4). No PRD Open Question is left silently unresolved — see the Human Brief §4 OQ Ledger for the full resolution record, including OQ-6 (non-servable-module 4xx behavior, resolved in P2-T2) and OQ-M2/OQ-M3 (resolved directly in P3, not deferred).

### In-Flight Findings

Lazy-creation rule applies: `.claude/findings/module-switcher-findings.md` is **not** pre-created. Create it only on the first real plan/reality mismatch discovered during execution; on creation, set `findings_doc_ref` in this plan's frontmatter, append to `related_documents`, and — if load-bearing — add a DOC-006 row in P4 and append the resulting spec path to `deferred_items_spec_refs`.

### Quality Gate

P4 cannot be sealed until: both deferred items have a design-spec path in `deferred_items_spec_refs` (P4-T4's two rows); and, if `findings_doc_ref` is populated, the findings doc is finalized (`draft` → `accepted`).

## Phase Breakdown

**Column conventions**: `Estimate` is points. `Model` is `sonnet`/`haiku` (claude only — no external model routing on this plan except the two codex review gates, which are called out as review rows, not build tasks). `Effort` is `adaptive` | `extended` (claude vocabulary only).

**Constraint line — every phase, no exceptions**: *No clinical JSON edits; approvedBy[]/clinicalApprovers[] stay empty; no invented thresholds.*

---

### Phase 1: Registration Gap + Status Accessor + Tripwire Retirement

**Dependencies**: Green baseline SHA recorded (see Hard Entry Dependency above)
**Assigned Subagent(s)**: general-purpose (sonnet) executor; task-completion-validator gate
**Entry criteria**: `npm run check` green on the recorded baseline SHA.
**Exit criteria**: `npm run check` green; `assess()` returns a non-throwing, well-formed result for all 4 `MODULE_IDS` given minimal/empty patient input; signing-status accessor unit-tested fail-closed against valid, missing, and malformed manifest fixtures.

*No clinical JSON edits; approvedBy[]/clinicalApprovers[] stay empty; no invented thresholds.*

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|----------------------|----------|--------------|-------|--------|--------------|
| P1-T1 | Register kidney/growth in `src/units.js` | Create `modules/kidney_suite_v1/units.js` and `modules/growth_suite_v1/units.js`, each calling only `registerUnitModule(MODULE_ID)` (zero `registerAnalyteUnit` calls — both modules ship `rules.json: []`, no unit-bearing fields yet; mirrors `src/units.js`'s own documented "modules with zero unit-bearing fields" path). Add `import './units.js';` as the first line of each module's `index.js` (mirrors `modules/cbc_suite_v1/index.js:26`/`modules/anemia/index.js:2`'s side-effect-import pattern — units.js has no other entry point). | `registeredUnitModules` (via `prepareUnitValidatedInput`) accepts `kidney_suite_v1`/`growth_suite_v1` without throwing `UnitRejectionError(reason:'unregistered-module')` for empty input | 0.75 pt | general-purpose | sonnet | adaptive | Green baseline |
| P1-T2 | Register kidney/growth in `src/evidence/registry.js` | Create `modules/kidney_suite_v1/evidence.js` and `modules/growth_suite_v1/evidence.js`, mirroring `modules/cbc_suite_v1/evidence.js`'s exact shape: `passageById`, `passagesFor` over each module's own `evidence.json` (12+ source records already present, per recon brief §1), and `sourceRightsPositionById` reusing `src/evidence.js#sourceRightsPosition`'s label logic (never a second implementation). Add both as new entries to the `REGISTRY` Map in `src/evidence/registry.js`, alongside the existing `anemia`/`cbc_suite_v1` entries — never replacing them. | `src/evidence/registry.js#accessorsFor('kidney_suite_v1')` and `('growth_suite_v1')` resolve without throwing; each module's own evidence data is returned, never anemia's or cbc's | 1.0 pt | general-purpose | sonnet | adaptive | P1-T1 |
| P1-T3 | Shared fail-closed signing-status accessor | New `src/moduleSigningStatus.js`: `export function deriveModuleSigningStatus(manifest)` returning `'clinically-signed'` **only if** `manifest?.status === 'integrity-recorded' AND Array.isArray(manifest?.approvedBy) AND manifest.approvedBy.length > 0`; **any** deviation (missing manifest, missing/unknown `status` enum value, non-array or empty `approvedBy`) returns `'unsigned-proposal'` — pure, non-throwing function per PRD FR-9's exact rule and decisions-block Risk 2. Single source of truth consumed identically by P2 (server) and P3 (SPA, same file, imported directly — no re-derivation). Mirrors the existing rule-level pattern in `src/governance.js#hasCredentialedClinicalApproval`/`clinicalApprovalStatus` (empty array is a real non-approved state, never branched on truthiness alone). | Unit tests cover: all 4 current manifests (all → `'unsigned-proposal'`, incl. anemia despite `status:'integrity-recorded'` because `approvedBy` is empty); a synthetic fully-signed fixture (→ `'clinically-signed'`); missing manifest (`undefined`/`null`); missing `status`; unknown `status` enum value (e.g. `'release-ready'`); non-array `approvedBy`; empty `approvedBy` — all non-signed paths return `'unsigned-proposal'`, none throw | 1.25 pt | general-purpose | sonnet | **extended** | P1-T1 |
| P1-T4 | Registration-gap regression test | Extend `tests/module-registry.test.mjs` (or a new `tests/module-registration-gap.test.mjs`) asserting `assess()` (via `src/engine.js#assess(input, moduleId, rules, candidates)`, driven with each module's own loaded `rules`/`candidates`) returns a non-throwing, well-formed result for all 4 `MODULE_IDS` given a minimal/empty patient input — including the honest empty-rules result shape for `kidney_suite_v1`/`growth_suite_v1` (`rules: []`, `candidates: {}`), per PRD §11 Functional Acceptance FR-0 and Goal 1's success criteria. | Test fails today (throws for kidney/growth) before P1-T1/T2 land; passes after; asserts 4/4, not just the 2 already-working modules | 0.75 pt | general-purpose | sonnet | adaptive | P1-T1, P1-T2 |
| P1-T5 | Retire the two tripwire comments (FR-13) | Correct `src/modules/registry.js:39-50` and `tests/module-registry.test.mjs:20-26`'s "Deliberate tripwire ... revisit the day a client-selectable moduleId surface actually ships" comments: this feature *is* that trigger. **Keep the literal assertion** `DEFAULT_MODULE_ID === 'anemia'` (FR-11 — default stays anemia by product decision, not by absence of a selector) but rewrite the surrounding comment to state a client-facing surface now exists (P2/P3 of this plan) and that `DEFAULT_MODULE_ID` staying `'anemia'` is a deliberate product decision, not an assumed constant. | Both comments no longer claim "no client-facing surface exists"; the literal assertion is unchanged; `npm run check` green | 0.25 pt | general-purpose | sonnet | adaptive | P1-T4 |

**Phase 1 Quality Gates:**
- [ ] `npm test` green on new/extended suites; no clinical JSON touched
- [ ] `assess()` non-throwing for all 4 `MODULE_IDS` given minimal input
- [ ] `src/moduleSigningStatus.js` unit-tested fail-closed (valid, missing, malformed fixtures)
- [ ] Tripwire comments corrected; literal `DEFAULT_MODULE_ID === 'anemia'` assertion unchanged
- [ ] task-completion-validator sign-off

---

### Phase 2: Public API Surface

**Dependencies**: P1 complete
**Assigned Subagent(s)**: general-purpose (sonnet) executor; task-completion-validator gate; **codex gpt-5.6-terra read-only diff review** (public contract change — project-memory gate)
**Entry criteria**: P1's accessor and Registration Gap fix green.
**Exit criteria**: `npm test` + `npm run validate` green; `openapi.yaml` validates against actual server behavior; backward-compat regression proves byte-identical output for `moduleId` omitted vs. `'anemia'` explicit.

*No clinical JSON edits; approvedBy[]/clinicalApprovers[] stay empty; no invented thresholds.*

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|----------------------|----------|--------------|-------|--------|--------------|
| P2-T1 | `UnknownModuleError` typed error class | New error class in `src/modules/registry.js` (co-located with `isRegisteredModule`), following the `UnitRejectionError`/`RangeUnitMismatchError` precedent (`src/serverErrors.js:1-6`): `statusCode: 400`, `code: 'UNKNOWN_MODULE'`, `details: [{ field: 'moduleId', providedValue, knownModuleIds: MODULE_IDS }]` per PRD FR-2's exact shape. Extend `src/serverErrors.js#shapeServerError` to special-case it (import + `instanceof` branch alongside the existing three). | `shapeServerError(new UnknownModuleError(...))` returns the exact FR-2 body shape; existing 3 error types' shaping unaffected | 0.4 pt | general-purpose | sonnet | adaptive | P1 |
| P2-T2 | `server.mjs` — moduleId dispatch, validation-first, non-servable handling | `POST /api/v1/assess` reads optional `moduleId` (string) from the request body. **Before any module-scoped work** (FR-14 — mirrors the literal-enumerated-map precedent at `src/modules/registry.js:53-55`): reject non-string values and unregistered values (via `isRegisteredModule()`) with `UnknownModuleError`. Absent `moduleId` ⇒ `DEFAULT_MODULE_ID` (byte-identical current behavior). Resolve `rules`/`candidates` from the already-loaded `modulesById[resolvedModuleId]` (`server.mjs:123-124`'s startup map — no new file I/O) and call `assess(input, resolvedModuleId, rules, candidates)` directly, **retiring the server-side `assessPediatricAnemia` call site** (FR-3). **Resolves decisions-block OQ-6**: if `resolvedModuleId` is registered but failed to load at startup (`server.mjs:104-121`'s non-fatal-for-non-default policy), return `503` with `{ error, code: 'MODULE_NOT_SERVABLE', details: [{ field: 'moduleId', providedValue, reason: 'startup-load-failed' }] }` — never a silent fallback to anemia, never an unhandled 500. Deliberately retire the AC-5 guardrail comment at `server.mjs:126-134` (replace with a comment stating the surface now exists and pointing at this plan). | 4/4 `MODULE_IDS` reachable via `POST /api/v1/assess`; unknown moduleId → 400 `UNKNOWN_MODULE`; non-string moduleId → same 400, never a `TypeError`; non-servable registered module → 503 `MODULE_NOT_SERVABLE`; `X-Request-Id` present on all new error responses | 1.0 pt | general-purpose | sonnet | **extended** | P2-T1 |
| P2-T3 | `meta.moduleSigningStatus` on assess + knowledge-base responses | Using P1-T3's `deriveModuleSigningStatus`, add `meta.moduleSigningStatus` to every `assess()` response (FR-4, additive to the existing `meta` object, `src/engine.js:37-44`) for the *assessed* module, and the same field to each entry of `GET /api/v1/knowledge-base`'s existing unconditional `modules` summary (FR-5, `server.mjs:135-161`) — no change to *what* modules are returned, only the additive field. | Every assess response and every `modules` entry carries `moduleSigningStatus`; value matches P1-T3's derivation exactly (no re-implementation) | 0.5 pt | general-purpose | sonnet | adaptive | P2-T2 |
| P2-T4 | `openapi.yaml` + `schemas/patient-input.schema.json` updates | (a) Add optional `moduleId` (string) to the assess request body schema; (b) document the `UNKNOWN_MODULE` 400 and `MODULE_NOT_SERVABLE` 503 error variants against `components.schemas.Error`; (c) document the pre-existing-but-undocumented `modules` field (incl. `moduleSigningStatus`) on `GET /api/v1/knowledge-base`'s response schema — closing the drift recon brief §4 identifies (FR-6). This is a public-contract change; standard review rigor applies (not the clinical-review-workflow gate — no rule/threshold/evidence content changes). | `npm run validate` passes; `openapi.yaml` accurately reflects actual request/response shapes for both endpoints | 0.6 pt | general-purpose | sonnet | adaptive | P2-T2, P2-T3 |
| P2-T5 | Backward-compatibility regression test | New test asserting `assess()` output for a fixed input is byte-identical with `moduleId` omitted vs. `moduleId: 'anemia'` explicit — both via the HTTP layer (`server.mjs`) and, if feasible, pre/post this phase's diff (Goal 3). | Zero diffs asserted; test would fail if the default-path behavior changed at all | 0.4 pt | general-purpose | sonnet | adaptive | P2-T2 |
| P2-T6 | API integration test suite | Extend `tests/server-error-contract.test.mjs` (or a sibling file) covering: default (omitted moduleId), explicit valid for all 4 `MODULE_IDS`, unknown string, non-string (array/object/number), and the non-servable-module 503 path (synthetic/mocked). Assert `X-Request-Id` present on every case. | All listed scenarios covered and green | 0.3 pt | general-purpose | sonnet | adaptive | P2-T2, P2-T5 |
| P2-Review | Codex read-only diff review | `codex exec` read-only diff review over P2's full diff, focused on the public-contract change (Risk 3) and FR-14's validate-before-touch ordering. Findings triaged by the phase owner before P2 is sealed. | Review completed; any findings resolved or explicitly deferred with rationale | — | codex | gpt-5.6-terra | medium | P2-T1…T6 |

**Phase 2 Quality Gates:**
- [ ] `npm test` + `npm run validate` green
- [ ] `moduleId` validated via `isRegisteredModule()` before any module-scoped work, every new code path
- [ ] Non-servable-module path returns 503, never a silent anemia fallback or unhandled 500
- [ ] Backward-compat regression proves zero diffs for omitted vs. explicit-`'anemia'` moduleId
- [ ] Codex read-only diff review complete
- [ ] task-completion-validator sign-off

---

### Phase 3: SPA Module Selector + Unsigned Banner

**Dependencies**: P2 complete
**Assigned Subagent(s)**: general-purpose (sonnet) executor; task-completion-validator gate; **codex gpt-5.6-terra read-only diff review** (banner fail-closed check is the review focus)
**Entry criteria**: P2's frozen API contract green (SPA is browser-local and does not call the API, but consumes the same `src/moduleSigningStatus.js` accessor P2 uses server-side).
**Exit criteria**: `npm run build` + `npm run smoke:browser` + `npm run check:imports` green; banner shown for every non-signed module (today: all 4); no new network calls; empty-state renders honestly for zero-rule modules.

*No clinical JSON edits; approvedBy[]/clinicalApprovers[] stay empty; no invented thresholds.*

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|----------------------|----------|--------------|-------|--------|--------------|
| P3-T1 | `index.html` — selector control + banner container | Add a native, keyboard-operable `<select>` module selector (populated at runtime by `src/app.js`, not hardcoded options — FR-12) near the existing KB-status card (`index.html:29-34`). Add a persistent per-module banner container adjacent to the existing `.safety-banner` (`index.html:41-43`), `role="alert"` (matching the existing pattern), plus an empty-state message container for FR-10. Neither the selector's options nor the banner's copy is hardcoded module-id logic — both are populated/toggled by app.js from bundled `module.json` data. | Selector and banner containers present in markup, empty/hidden by default, wired by P3-T2/T3/T4 | 0.6 pt | general-purpose | sonnet | adaptive | P2 |
| P3-T2 | `src/app.js` — moduleId state + literal per-module fetch map | Add `selectedModuleId` state, default `'anemia'` (FR-11 — session-only, no `localStorage`/cookie/URL-param persistence). Replace the hardcoded fetch literals at the single KB-load seam (`app.js:553-564`) with a **literal enumerated lookup keyed by `MODULE_IDS`** (a small object/switch mapping each known id to its two literal fetch-path strings) — **not** a template string (`` `./modules/${moduleId}/rules.json` ``), so `scripts/check-app-imports.mjs`'s existing static specifier parser resolves every path unmodified (resolves PRD §12 OQ-1-tech / decisions-block Risk 3 in favor of option (a): enumerate literals over extending the checker script). | Fetching each of the 4 modules' `rules.json`/`candidates.json` succeeds via the literal map; `npm run check:imports` passes with zero script changes | 0.8 pt | general-purpose | sonnet | adaptive | P3-T1 |
| P3-T3 | `src/app.js` — selector wiring + `assess()` call-site switch | Wire the selector's `change` event to: re-fetch the newly selected module's `rules`/`candidates` via P3-T2's map, update `selectedModuleId`, and re-render. Switch every assessment call site (form submit, "load example," algorithm-explorer use-case) from `assessPediatricAnemia(input, rules, candidates)` to `assess(input, selectedModuleId, rules, candidates)` (mirrors PRD FR-3's server-side retirement — imports `assess` from `./engine.js` directly). | Selecting a module and submitting the form assesses against that module's rules/candidates, not anemia's; switching back to anemia still works | 0.5 pt | general-purpose | sonnet | adaptive | P3-T2 |
| P3-T4 | FR-9 — unsigned-proposal banner, fail-closed | See **AC P3-FR9** below (structured AC — target_surfaces, propagation_contract, resilience, verified_by). Implementation: `src/app.js` imports `deriveModuleSigningStatus` directly from `./moduleSigningStatus.js` (same file P1-T3 authored — single source of truth, no browser-side re-derivation) and calls it against the currently-selected module's bundled `module.json` (fetched alongside `rules.json`/`candidates.json` via P3-T2's literal map, or read from the already-fetched KB metadata if cheaper — implementer's choice, output must be identical). Banner shown whenever the result is **not** `'clinically-signed'` — true for all 4 modules today, including `anemia` (deliberate consequence of Risk 2 / R-1, not a bug: anemia's `approvedBy` is `[]` too). No code path special-cases `moduleId === 'anemia'` (FR-12). Adopts PRD OQ-M3's recommendation: uniform banner copy across all modules for v1 (the FR-10 empty-state message, not the banner, carries the "zero rules yet" distinction) — avoids reintroducing module-specific logic the FR-9 fail-closed design forbids. Adopts OQ-M2's recommendation: selector also surfaces `manifest.status` (e.g. "unsigned-stub") next to each module's title — cheap, reinforces the fail-closed signal. | See AC P3-FR9 | 1.0 pt | general-purpose | sonnet | **extended** | P3-T3 |
| P3-T5 | FR-10 — empty-state for zero-rule modules | On an assessment run against a module where `rules.length === 0 && Object.keys(candidates).length === 0` (today: `kidney_suite_v1`, `growth_suite_v1`), render an explicit "this module carries zero clinical rules yet" message at the result-render seam (`renderResult`, `app.js:383`) — distinct from, and in addition to, the FR-9 banner. Never a blank or misleadingly-successful-looking result. | Selecting kidney or growth and running an assessment shows the empty-state message, not a blank/empty-looking result panel | 0.4 pt | general-purpose | sonnet | adaptive | P3-T3 |
| P3-T6 | `check-app-imports.mjs` compatibility confirmation | Run `npm run check:imports` against P3-T2's literal-map approach; if it resolves cleanly (expected, per P3-T2's design choice), record confirmation only — **do not** extend the script (Risk 3's option (b) is the fallback, not the default). If it does not resolve cleanly, extend `scripts/check-app-imports.mjs` to loop `MODULE_IDS` for specifier resolution as the documented fallback. | `npm run check:imports` green; if the script needed extension, the extension is documented in the task's completion note | 0.3 pt | general-purpose | sonnet | adaptive | P3-T2 |
| P3-T7 | `npm run smoke:browser` — module selection coverage | Extend `scripts/smoke-browser-unit-rejection.mjs` (or the smoke harness it's part of) to cover: selecting each non-default module, confirming the FR-9 banner renders, confirming the FR-10 empty-state renders for kidney/growth, and confirming no unexpected network request fires (Risk 4 — browser-local, no new origin). Record the actual `dist/` size delta (per decisions-block Risk 4 / PRD NFR-Performance) in this task's completion note. | Smoke suite passes covering all 4 modules; size delta recorded | 0.4 pt | general-purpose | sonnet | adaptive | P3-T4, P3-T5, P3-T6 |
| P3-Review | Codex read-only diff review | `codex exec` read-only diff review over P3's full diff, focused specifically on FR-9's fail-closed property (no hardcoded moduleId branch, unknown/missing status still shows the banner) per decisions-block §2/§6. | Review completed; any findings resolved or explicitly deferred with rationale | — | codex | gpt-5.6-terra | medium | P3-T1…T7 |

**AC P3-FR9: Unsigned-proposal banner is fail-closed and manifest-driven**
- target_surfaces:
    - index.html (new banner container adjacent to `.safety-banner`, `index.html:41-43`)
    - src/app.js#initialize (KB-load seam, `app.js:553-564` — banner state initialized on first load)
    - src/app.js (selector `change` handler, P3-T3 — banner re-evaluated on every module switch)
    - src/app.js#renderResult (`app.js:383` — banner visibility re-asserted alongside the FR-10 empty-state on every assessment run)
- propagation_contract: `modules/<id>/module.json` (`status`, `approvedBy`) → `src/moduleSigningStatus.js#deriveModuleSigningStatus(manifest)` (single function, imported identically by `server.mjs` for `meta.moduleSigningStatus` in P2 and by `src/app.js` for the banner in P3 — never two independent derivations) → banner-visibility boolean (`signingStatus !== 'clinically-signed'`).
- resilience: missing `module.json`, missing/unknown `status` enum value, non-array or empty `approvedBy` ⇒ `deriveModuleSigningStatus` returns `'unsigned-proposal'` ⇒ banner **shown**. No code path can suppress the banner by omission — the function's default branch is "show it," proven by P1-T3's fixture-driven unit tests (missing manifest, missing status, malformed `approvedBy`, unknown enum value).
- visual_evidence_required: false (no new visual design system; banner reuses the existing `.safety-banner` visual pattern per `index.html:41-43`).
- verified_by: [P3-T7 (browser smoke, all 4 modules), P4-T6 (full gate rerun)]

**Phase 3 Quality Gates:**
- [ ] `npm run build` + `npm run smoke:browser` + `npm run check:imports` green
- [ ] AC P3-FR9 verified (fail-closed, no hardcoded moduleId branch)
- [ ] Empty-state renders for kidney/growth (FR-10); no new network calls (Risk 4)
- [ ] `dist/` size delta recorded
- [ ] Codex read-only diff review complete
- [ ] task-completion-validator sign-off

---

### Phase 4: Docs, Doc-Truth, Validation Sweep

**Dependencies**: P3 complete
**Assigned Subagent(s)**: general-purpose (haiku for docs, sonnet for doc-truth test edits and the full gate rerun); task-completion-validator; **karen end-of-feature review**
**Entry criteria**: P3 green.
**Exit criteria**: Full `npm run check` green (on the recorded green baseline, per Hard Entry Dependency); design-spec promoted; both deferred items have design-spec paths; karen end-of-feature review passed.

*No clinical JSON edits; approvedBy[]/clinicalApprovers[] stay empty; no invented thresholds.*

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|----------------------|----------|--------------|-------|--------|--------------|
| P4-T1 | `openapi.yaml` final consistency pass | Re-verify `openapi.yaml` against P2/P3's actual shipped behavior end-to-end (`info.version` bump if this repo's convention requires one for an additive public-contract change — confirm against prior minor-version bumps in git history before deciding). | `npm run validate` green; no drift between documented and actual shapes | 0.2 pt | general-purpose | sonnet | adaptive | P3 |
| P4-T2 | `docs/architecture.md` module-status table touch-up | Update the module-status table/surface (recon brief §7, `docs/architecture.md:41-46`) to reflect the now-client-selectable `moduleId` surface and all 4 modules' current signing status — **must not affirm any clearance** (`tests/notice-architecture-no-clearance.test.mjs` stays green; no wording implies clinical sign-off exists). | Table accurate; doc-truth test green | 0.3 pt | general-purpose | haiku | adaptive | P4-T1 |
| P4-T3 | Design-spec promotion verification | `docs/project_plans/design-specs/public-moduleid-api-surface.md` already carries `maturity: promoted` and `prd_ref` set to this PRD (pre-existing state at plan-authoring time) — verify its "Design Sketch" section is updated to match what actually shipped (body field, `UNKNOWN_MODULE`/`MODULE_NOT_SERVABLE` codes, single-select-only) rather than the pre-implementation sketch; correct any drift. | Design-spec content matches shipped behavior; `maturity`/`prd_ref`/`status` fields consistent | 0.2 pt | general-purpose | sonnet | adaptive | P4-T1 |
| P4-T4 | DOC-006 — author 2 deferred-item design specs | One task per row in the Deferred Items Triage Table above: `docs/project_plans/design-specs/multi-module-assessment-view.md` (DEF-SW-1, `maturity: idea` — needs UX design first) and `docs/project_plans/design-specs/module-signing-status-schema-field.md` (DEF-SW-2, `maturity: shaping` — dependency-blocked on the clinical-review-workflow program). Both set `prd_ref` to this feature's PRD; append both paths to this plan's `deferred_items_spec_refs`. | Both specs authored; `deferred_items_spec_refs` frontmatter populated with both paths | 0.5 pt | general-purpose | sonnet | adaptive | P4-T1 |
| P4-T5 | CHANGELOG entry | Add an `[Unreleased]` entry per `.claude/specs/changelog-spec.md` categorization: client-selectable `moduleId` on `POST /api/v1/assess`, SPA module selector, unsigned-proposal banner/API flag. User-facing (new API surface + new UI control) — `changelog_required: true`. | Entry present under `[Unreleased]`; `changelog_ref` frontmatter set to `CHANGELOG.md` | 0.2 pt | general-purpose | haiku | adaptive | P4-T1 |
| P4-T6 | Full `npm run check` gate rerun | Full end-to-end rerun on the feature branch against the recorded green baseline: `npm test && npm run validate && npm run coverage:rules && npm run build && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke`. This is the plan's holistic go/no-go and the second `verified_by` reference for AC P3-FR9. | All 8 gate steps pass; zero new failures beyond the pre-existing (and unrelated) baseline-drift set, which must not have grown | 0.4 pt | general-purpose | sonnet | adaptive | P4-T2, P4-T3, P4-T4, P4-T5 |
| P4-T7 | task-completion-validator + karen end-of-feature review | Final per-phase task-completion-validator sign-off, plus a whole-feature **karen** review: confirms zero clinical JSON diffs across the entire feature (`git diff --name-only` scoped to `modules/*/rules.json`, `candidates.json`, `evidence.json` content — must be empty), confirms `approvedBy[]`/`clinicalApprovers[]` stayed empty everywhere, confirms the FR-9 fail-closed property held across P1→P3, confirms both deferred items have specs. | karen review passed; findings (if any) resolved or explicitly deferred with rationale | 0.2 pt | task-completion-validator, karen | sonnet | adaptive | P4-T6 |

**Phase 4 Quality Gates:**
- [ ] Full `npm run check` green (8-step gate, recorded baseline)
- [ ] `docs/architecture.md` touch-up affirms no clearance (`tests/notice-architecture-no-clearance.test.mjs` green)
- [ ] Design-spec promoted and content-accurate
- [ ] Both deferred items have design-spec paths in `deferred_items_spec_refs`
- [ ] CHANGELOG `[Unreleased]` entry present
- [ ] Zero clinical JSON diffs anywhere in the feature (scoped `git diff --name-only` check)
- [ ] karen end-of-feature review passed
- [ ] task-completion-validator sign-off
- [ ] Plan frontmatter lifecycle fields complete (`status: completed`, `commit_refs`, `updated`)

---

## Wrap-Up: Feature Guide & PR

**Triggered**: Automatically after P4 is sealed (all P4 quality gates pass).

### Step 1 — Feature Guide

Delegate to a `general-purpose` (haiku) executor to create `.claude/worknotes/module-switcher/feature-guide.md` (frontmatter: `doc_type: feature_guide`, `feature_slug: module-switcher`, `prd_ref`/`plan_ref` set, `created` = close-out date). Required sections (≤200 lines total): What Was Built; Architecture Overview (Registration Gap fix, `src/moduleSigningStatus.js` single-source derivation, `moduleId` request field, SPA selector/banner); How to Test (`npm run check`; `curl -X POST .../api/v1/assess -d '{"moduleId":"cbc_suite_v1",...}'`; selecting each module in the SPA); Test Coverage Summary; Known Limitations (point to both DOC-006 specs). Commit before opening the PR.

### Step 2 — Open PR

```bash
gh pr create \
  --title "Module switcher: public moduleId API surface + SPA selector (DEF-6)" \
  --body "$(cat <<'EOF'
## Summary
- Closes the kidney/growth Registration Gap (units + evidence accessors, zero clinical content)
- Adds optional moduleId to POST /api/v1/assess (additive, backward-compatible) + fail-closed moduleSigningStatus flag
- Adds an SPA module selector + persistent unsigned-proposal banner, driven entirely by module.json manifest state

## Feature Guide
.claude/worknotes/module-switcher/feature-guide.md

## Test plan
- [ ] npm run check green
- [ ] All 4 modules reachable via API and SPA
- [ ] Banner fail-closed against missing/malformed manifest fixtures

🤖 Generated with Claude Code
EOF
)"
```

Derive PR summary bullets from this plan's Executive Summary and the P4-T5 CHANGELOG entry.

---

## Risk Mitigation

Full risk register (5 risks, mitigations, severity/likelihood) lives in the Human Brief §6 (`docs/project_plans/human-briefs/module-switcher.md`) — sourced from decisions-block §3. Summary: Risk 1 (red baseline) is handled by this plan's Hard Entry Dependency section; Risk 2 (banner keying) is handled by P1-T3's fail-closed accessor + AC P3-FR9; Risk 3 (public API rigor) is handled by P2's codex review gate; Risk 4 (SPA bundling/no PHI egress) is handled by P3-T7's smoke coverage; Risk 5 (structurally-empty scaffold modules) is handled by P1-T4's regression test + P3-T5's empty-state.

---

**Progress Tracking:**

See `.claude/progress/module-switcher/all-phases-progress.md`

---

**Implementation Plan Version**: 1.0
**Last Updated**: 2026-07-22
