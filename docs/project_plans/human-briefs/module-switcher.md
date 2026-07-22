---
schema_name: ccdash_document
schema_version: 2

doc_type: human_brief
doc_subtype: "feature_brief"
root_kind: project_plans

id: "BRIEF-module-switcher"
title: "Module Switcher — Human Brief"
status: draft
category: human-briefs

feature_slug: "module-switcher"
feature_family: "module-switcher"
feature_version: "v1"

prd_ref: docs/project_plans/PRDs/features/module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/module-switcher-v1.md
intent_ref: null
epic_ref: null

related_documents:
  - .claude/worknotes/module-switcher/decisions-block.md
  - .claude/worknotes/module-switcher/recon-brief.md
  - docs/project_plans/design-specs/public-moduleid-api-surface.md

owner: nick
contributors: []

audience: [humans]

priority: high
confidence: 0.75

created: "2026-07-22"
updated: "2026-07-22"
target_release: ""

tags: [human-brief, module-switcher, def-6]
---

# Module Switcher — Human Brief

> Living document for human orchestrators. Agents: do not load unless explicitly instructed.
> Status: draft | Updated: 2026-07-22

---

## 1. Context Pointers

- **PRD**: `docs/project_plans/PRDs/features/module-switcher-v1.md`
- **Plan**: `docs/project_plans/implementation_plans/features/module-switcher-v1.md`
- **Design Spec**: `docs/project_plans/design-specs/public-moduleid-api-surface.md` (promoted by this PRD)
- **Decisions Block**: `.claude/worknotes/module-switcher/decisions-block.md` (Opus phase/agent/model structure)
- **Recon Brief**: `.claude/worknotes/module-switcher/recon-brief.md` (grounded file:line anchors)
- **SPIKEs**: None

---

## 2. Estimation Sanity Check

**Bottom-up total**: 13 pts
**Top-down anchor**: `platform-foundation-p0` (17 pts, 7 phases) — closest comparable feature: same repo, same registry/engine/SPA surfaces, similar "small structural change with heavy test/doc discipline" shape.
**Reconciliation**: This plan is a smaller slice of the same architecture platform-foundation-p0 built — it *reaches* the already-built module-parameterized engine rather than building a new abstraction layer, so a lower point cost than the anchor is expected and justified (see H5 below), not merely optimistic rounding.

### H1 — Noun-Counting Rule
No new CRUD-with-RBAC domain nouns are introduced. This feature adds one new pure function module (`src/moduleSigningStatus.js`), two new module-scoped accessor file pairs (kidney/growth units.js + evidence.js, mirroring an existing pattern), and one new request field — not a new table or first-class entity. H1's ~2 pt/noun floor does not apply structurally; the closest analog is "4 capability areas" under H4 below.

### H2 — Dual-Implementation Multiplier
Not applicable. This repo has a single runtime (no local/enterprise split, no SQLAlchemy dual-dialect layer). No multiplier applied.

### H3 — Algorithmic Service Flag
Not applicable. No new service description contains `dependency`, `resolution`, `graph`, `conflict detection`, `cycle`, `solver`, `inference`, `ranking`, `scheduling`, `merge`, `diff`, or `transform`. The fail-closed signing-status derivation (P1-T3) is a pure boolean-logic function, not an algorithmic surface — it is nonetheless budgeted at 1.25 pts with `extended` effort because it is the load-bearing safety artifact (Risk 2), not because it is algorithmically complex.

### H4 — Bundle-vs-Sum Check

This PRD packages 4 capability areas under one slug; the plan total must be ≥ the sum below.

| Capability Area | Independent Estimate | Notes |
|-----------------|----------------------:|-------|
| Registry plumbing (FR-0 Registration Gap + signing-status accessor) | 4 pts | 2 new module accessor-file pairs (mirrored pattern, low risk) + 1 new safety-critical pure function (extended effort) + regression test + doc-truth fix |
| Public API surface (moduleId body field, error contract, contract docs) | 3 pts | Additive field, one new typed error class, one non-servable-module resolution (OQ-6), openapi/schema updates, backward-compat regression |
| SPA UI (selector + banner + empty-state) | 4 pts | Largest: vanilla-JS UI with no framework, safety-copy banner logic (extended effort), literal-fetch-map refactor to satisfy the static import checker, browser smoke coverage |
| Docs/doc-truth/validation sweep | 2 pts | Mechanical but gate-heavy: full 8-step `npm run check` rerun, 2 deferred-item specs, architecture doc touch-up under a no-clearance doc-truth test |
| **Σ** | **13 pts** | Plan total = Σ exactly — no top-down compression |

### H5 — Anchor Reference Comparison

**Anchor**: `platform-foundation-p0-v1` (`docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md`)
**Anchor actual cost**: 17 pts over 7 phases (completed).
**Anchor surface**: ~20 files touched, 3 new registry layers built from scratch (`facts/registry.js`, `ranges/registry.js`, `modules/registry.js`), 4 shim files, 2 new permanent test files (golden-equivalence harness + module-registry structural test).
**This plan surface**: ~24 files touched, 0 new registry layers built from scratch (all 3 already exist — this plan only adds entries/consumers), 1 new pure-function module, 1 new typed error class, 1 new SPA selector + banner.
**Estimate delta vs. anchor**: 13 pts vs. 17 pts = −24%, within the ±30% band without needing separate justification, but worth stating explicitly: this plan's lower cost is structurally sound because it *consumes* three registries platform-foundation-p0 built (`src/modules/registry.js`, and by extension the module-package contract) rather than building new ones — the delta is explained by architecture reuse, not by underestimating a comparable-shape feature.
**Delta justification**: The anchor built the abstraction layer this feature reaches through. Reaching through an existing, already-tested layer is legitimately cheaper than building it. If a future reviewer finds this plan under-delivers relative to 13 pts, the first hypothesis should be scope creep into a 5th capability area, not a miscounted H4 sum.

### H6 — Hidden Plumbing Budget

Explicit ~15–20% plumbing line is folded into each capability area's estimate rather than broken out separately (per the heuristic's stated preference for "estimating it once at the plan level"): P2's `openapi.yaml`/schema updates (0.6 pt of P2's 3 pt) and P4's entire scope (2 pts, ~15% of the 13 pt total) *are* the plumbing budget for this plan — CHANGELOG, doc-truth, design-spec promotion, contract docs. No additional line item needed; P4 already serves this role structurally.

### H7 — Huge-File Touch Multiplier

`wc -l` at planning time: `src/app.js` (701 lines), `index.html` (585 lines), `docs/architecture.md` (489 lines), `server.mjs` (286 lines), `openapi.yaml` (132 lines). **None exceed 2,000 lines** — no High-Friction Surfaces flag, no 2× multiplier applied anywhere in this plan.

**Bottom-up total**: 13 pts
**Top-down intuition**: "Medium, ~12 pts" (matches decisions-block §4's original 12 pt estimate before this plan's H4 per-area sum locked at 13)
**Locked estimate**: 13 pts (bottom-up sum; matches decisions-block §4's stated total exactly — no compression, no inflation)

---

## 3. Wave & Orchestration Notes

**Critical path**: Fix-gate green baseline → P1 → P2 → P3 → P4. Fully serial — every phase is on the critical path; there is no parallelizable slice at the phase level.

**Parallel opportunities**: None taken at the phase level, by deliberate design (decisions-block §2/§5): P2 (`server.mjs`) and P3 (`src/app.js`) touch disjoint files and could in principle parallelize, but this repo has a documented parallel-PR schema-drift incident (project memory: a schema tightening and its non-conforming fixtures merged 6 hours apart turned `main`'s check gate red, 25/2412 failing) — the decisions block explicitly argues against parallelizing adjacent contract-touching phases here, and this plan follows that. Within P2, `openapi.yaml` authoring and `server.mjs` implementation are same-owner-phase parallelizable slices (not separate waves). Within P3, banner CSS/markup and selector wiring are similarly same-owner-phase slices.

**Merge order**: P1 → P2 → P3 → P4, one PR per phase (or a single PR if the whole feature lands as one branch — either is acceptable per this repo's git workflow; commit per phase either way).

**Cross-feature coupling**: **Hard, blocking dependency on the fix-gate branch** (candidates: `fix/d4-dist-order` et al.) landing on `main` first, or on a locally-verified green commit being recorded as the baseline SHA before P1 starts. No other in-flight feature couples to this one. The `clinical-review-workflow` program (commits `e8fd5dd`/`28c9633`) is a soft future coupling for DEF-SW-2 (see §5) but not a blocker.

**Reviewer-probe caveat (decisions-block §2, binding)**: Session reality — the specialist agent roster (`python-backend-engineer`, `ui-engineer-enhanced`, etc.) is **not registered** in this environment. Route execution through a `phase-owner`-style dispatch to `general-purpose` (sonnet) executors, as this plan does. **Before starting any wave, probe that `task-completion-validator` and `karen` actually resolve** — a known failure mode in this program is an unregistered reviewer causing `execute-plan` to silently skip review inside a `parallel()` call, dropping a phase to a null review with no visible error (project memory: `execute-plan-workflow-reviewer-agents-unregistered`). If either fails to resolve, escalate before proceeding rather than letting a phase "pass" with zero review.

---

## 4. Open Questions Ledger

| ID | Source | Question | Status | Resolved By |
|----|--------|----------|--------|-------------|
| Spec-Q1 | Design spec | Body field vs. query param vs. path segment for `moduleId`? | resolved | PRD §12 — request body field (FR-1); no routing infra exists for a path segment |
| Spec-Q2 | Design spec | Does `GET /api/v1/knowledge-base` need module-scoping/filtering? | resolved | PRD §12 — no filter param; endpoint already returns all modules unconditionally |
| Spec-Q3 | Design spec | Single-select vs. array/multi-module `moduleId`? | resolved | PRD §12 — single-select only for v1; multi-module deferred (DEF-SW-1) |
| Spec-Q4 | Design spec | Exact error contract for unknown `moduleId`? | resolved | PRD FR-2 — `400`, `code: 'UNKNOWN_MODULE'`, `details: [{field, providedValue, knownModuleIds}]` |
| Spec-Q5 | Design spec | Does exposing `moduleId` require `openapi.yaml` updates + equivalent review rigor? | resolved | PRD §12 — yes to both; standard rigor, not the clinical-review-workflow gate |
| OQ-1 | Decisions block §7 | Body field on assess? | resolved | Same as Spec-Q1 |
| OQ-2 | Decisions block §7 | Does KB endpoint need scoping? | resolved | Same as Spec-Q2 |
| OQ-3 | Decisions block §7 | Array `moduleId` / multi-module view? | resolved (out of scope) | PRD §7 — deferred, DEF-SW-1 (plan §Deferred Items) |
| OQ-4 | Decisions block §7 | Exact error envelope/code for unknown moduleId? | resolved | Same as Spec-Q4 |
| OQ-5 | Decisions block §7 | Where do module display names come from? | resolved | PRD FR-7 — `module.json.title`, already present on all 4 manifests |
| OQ-6 | Decisions block §7 | Non-servable-module assess behavior (400 vs 503)? | resolved | Plan P2-T2 — `503`, `code: 'MODULE_NOT_SERVABLE'`, never a silent anemia fallback |
| OQ-M1 | PRD §12 | Should signing status get a dedicated `module.json` schema field instead of being derived? | **open — deferred** | Plan DEF-SW-2 / P4-T4 design-spec (`module-signing-status-schema-field.md`); trigger = clinical-review-workflow program's next planning pass |
| OQ-M2 | PRD §12 (was decisions-block OQ-5) | Should the selector also surface `manifest.status` next to the title? | resolved | Plan P3-T4 — yes, adopted (cheap, reinforces fail-closed signal) |
| OQ-M3 | PRD §12 | Should banner copy/weight differ between substantial-but-unsigned and fully-inert-scaffold modules? | resolved | Plan P3-T4 — uniform banner text for v1 (PRD's own recommendation adopted); FR-10's empty-state carries the "zero rules yet" distinction instead |
| OQ-1-tech | PRD §12 / decisions-block Risk 3 | Literal fetch-specifier enumeration vs. extending `check-app-imports.mjs`? | resolved | Plan P3-T2 — literal enumeration chosen as the primary approach; P3-T6 documents the fallback if it doesn't resolve cleanly |

**All PRD/decisions-block Open Questions are resolved except OQ-M1**, which is intentionally deferred (see §5) rather than left ambiguous.

---

## 5. Deferred Items Rationale

- **Multi-module / array-valued `moduleId` assessment view (DEF-SW-1)**: Deferred because it needs its own UX design pass (how does a clinician read a combined 4-module result?) and has no identified consumer need today — single-select is the simplest, least-hardcoded v1 design and matches the design spec's own resolved OQ-3. Promote when a concrete integrator/clinician use case emerges, or when a 5th module makes single-select navigation unwieldy.
- **Dedicated `module.json` signing-status schema field (DEF-SW-2 / OQ-M1)**: Deferred because this feature derives signing status from existing `status`/`approvedBy` fields (no schema change) to avoid a speculative field ahead of the clinical-review-workflow program's own design for what "clinically signed" ultimately means at the manifest level. Deriving now, in one clearly-named module (`src/moduleSigningStatus.js`), keeps a future swap to a first-class field a single-file change rather than a multi-call-site migration. Promote when the clinical-review-workflow program (commits `e8fd5dd`/`28c9633`) reaches a planning pass that decides whether to supersede this derivation.

---

## 6. Risk Narrative

**Risk 1: `npm run check` is RED on `main`** (High severity, certain likelihood)
- 25 pre-existing failing subtests (of 2412) at `263120b` — E1 baseline/hash-pin drift, not logic breakage, not caused by this feature. Green-gate-before-commit is meaningless against a red baseline.
- Watch for: an executor absorbing the fix-gate's scope into this feature "since we're touching the same test suite" — explicitly forbidden. This plan's Hard Entry Dependency section blocks P1 from starting without a recorded green baseline SHA.

**Risk 2: Banner keying and fail-closed semantics** (High severity — drives P1's existence)
- A trustworthy `module.json.status` enum exists, but executors will be tempted to hardcode `moduleId !== 'anemia'` to gate the banner — which silently rots the day a 5th module lands and inverts the safety default (a "signed" module could show no banner, or worse, an unsigned module could be silently exempted). The enum will also grow (e.g. `release-ready`); unknown values must not be treated as signed.
- Watch for: anemia is ALSO not clinically signed today (`approvedBy: []`) — the banner logic keys on signing state, not module identity, so anemia correctly gets the new per-module banner too, alongside its existing general `.safety-banner`. This is a deliberate consequence (R-1 in the PRD risk table), not a bug — do not "fix" it by excluding anemia.

**Risk 3: Public API contract change rigor** (Medium severity)
- `openapi.yaml` and the assess contract are public surfaces; "non-clinical" does not mean "unreviewed." The repo treats contract changes as review-worthy even without clinical content.
- Mitigation: additive-only, backward-compatible design (absent `moduleId` ⇒ byte-identical current behavior for anemia); P2's codex read-only diff review gate; the P2-T5 backward-compat regression test pins the contract.

**Risk 4: SPA bundling of all 4 modules, browser-local, no PHI egress** (Medium severity)
- The SPA is fully browser-local; the selector must never introduce a network fetch or third-party asset. Bundling 4 modules grows the bundle; build/smoke behavior may shift.
- Mitigation: static bundling of all registered modules at build time (already happens today, unconditionally — this feature only changes what the SPA *reads*, not what ships); P3-T7's smoke coverage asserts no new network requests; size delta recorded in the P3 completion note.

**Risk 5: Scaffold modules (kidney/growth) are structurally incomplete** (Medium severity, confirmed)
- Both ship literally empty `rules.json` (`[]`) and `candidates.json` (`{}`). An empty module rendering a blank/misleading assessment view would be a genuine honesty failure, not just a UX gap.
- Mitigation: P1-T4 verifies each registered module loads and assesses in tests; P3-T5's SPA empty-state ("this proposal module contains no rules yet") is rendered rather than a blank result — never fabricating content.

---

## 7. What to Watch For

- **Reviewer-probe caveat**: verify `task-completion-validator` and `karen` resolve before starting any wave (see §3) — this program's own recon brief flags a known silent-skip failure mode.
- **AC-5 comment retirement is deliberate, not a bug**: `server.mjs:126-134`'s guardrail comment explicitly says "no moduleId request surface exists, AC-5" — P2-T2 retiring it is the entire point of this feature, not scope creep.
- **`assessPediatricAnemia` is not deleted, only its server-side call site retired**: PRD FR-3's note — the wrapper may stay for other call sites (e.g. any lingering test that calls it directly); only `server.mjs`'s hardcoded call is retired.
- **Literal-map vs. template-string fetch paths**: if an executor reaches for `` `./modules/${moduleId}/rules.json` `` in P3-T2, `check-app-imports.mjs`'s static parser will silently fail to resolve it — this is exactly the mechanical trap PRD Risk R-3 names. The plan resolves it in favor of a literal enumerated map; do not "simplify" back to a template string mid-execution.
- **Anemia gets the new banner too**: do not treat this as a regression to fix by excluding anemia from FR-9's logic (see Risk 2 above).

---

## 8. Expected Success Behaviors

From PRD §11 Overall Acceptance Criteria (human-verifiable phrasing):

- [ ] Selecting any of the 4 modules in the SPA and running an assessment produces a result scoped to that module (facts/rules/candidates/evidence) — not silently anemia's — for `anemia` and `cbc_suite_v1`; a clear "zero rules yet" empty-state (not a blank panel) for `kidney_suite_v1`/`growth_suite_v1`.
- [ ] Switching modules in the SPA always shows the unsigned-proposal banner (today: for all 4, including anemia) — confirm it is NOT possible to make the banner disappear by selecting a different module, short of a real future clinical sign-off.
- [ ] `POST /api/v1/assess` with `{"moduleId": "cbc_suite_v1", ...}` returns `200` with `meta.moduleSigningStatus` present; an unrecognized `moduleId` returns a clean `400 UNKNOWN_MODULE` (never an opaque 500 or silent anemia fallback); a request omitting `moduleId` entirely behaves byte-identically to today.
- [ ] `GET /api/v1/knowledge-base`'s `modules` field (already returned today) now also carries `moduleSigningStatus` per module, and `openapi.yaml` documents it — no more undocumented-field drift.
- [ ] `git diff --name-only` against `modules/*/rules.json`, `modules/*/candidates.json`, `modules/*/evidence.json` content is empty across the entire feature branch — zero clinical content changed.
- [ ] `npm run check` (full 8-step gate) passes on the feature branch against the recorded green baseline SHA.
- [ ] The module selector and banner are keyboard-operable and screen-reader-announced (manual spot-check against the existing `.safety-banner` precedent).

---

## 9. Running Log

- [2026-07-22] Human Brief created alongside the implementation plan.
