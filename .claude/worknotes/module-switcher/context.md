---
type: context
schema_version: 2
doc_type: context
prd: "module-switcher"
feature_slug: "module-switcher"
title: "module-switcher - Development Context"
status: "active"
created: "2026-07-22"
updated: "2026-07-22"

critical_notes_count: 4
implementation_decisions_count: 3
active_gotchas_count: 3
agent_contributors: ["artifact-tracker"]

agents:
  - agent: "artifact-tracker"
    note_count: 1
    last_contribution: "2026-07-22"

phase_status:
  - { phase: 1, status: "pending" }
  - { phase: 2, status: "pending" }
  - { phase: 3, status: "pending" }
  - { phase: 4, status: "pending" }

blockers:
  - id: "BLOCKER-1"
    title: "Red baseline on main blocks P1 start"
    description: "npm run check is RED on main at 263120b — 25 pre-existing failing subtests (of 2412), all E1 baseline/hash-pin drift (tests/ef-anemia-backfill-integrity.test.mjs, tests/ef-p4-t8-honesty-ac.test.mjs, cbc converter suites, rights gates, notice-architecture-no-clearance), NOT logic breakage and NOT caused by this feature. Green-gate-before-commit is unfalsifiable against a red baseline, so execution cannot start until a green baseline SHA is recorded. Candidate fix-gate branches exist (fix/d4-dist-order et al.); this feature depends on one landing on main first, or on the phase owner branching from a locally-verified green commit and recording that SHA."
    blocking: ["phase-1"]
    depends_on: ["fix-gate landing on main OR a locally-verified green commit"]
    severity: "high"

decisions:
  - id: "DECISION-1"
    question: "Where does moduleId-driven signing status get derived — once, or independently per consumer (server + SPA)?"
    decision: "Exactly once, in src/moduleSigningStatus.js#deriveModuleSigningStatus(manifest), authored in P1. server.mjs (P2) and src/app.js (P3) both import it directly — never re-implement the logic."
    rationale: "A second independently-maintained derivation is the failure mode the plan is explicitly designed to avoid (decisions-block Risk 2): it would silently rot the day module #5 lands or the status enum grows, and could invert the safety default."
    tradeoffs: "P3 (browser SPA) importing straight from the same module file (rather than calling an API) works only because the SPA is fully browser-local and already bundles all module.json data at build time — this pattern would not generalize to a server-rendered or multi-origin SPA."
    location: "src/moduleSigningStatus.js"
    phase: 1
  - id: "DECISION-2"
    question: "Should this feature parallelize P2 (server.mjs) and P3 (app.js) since they touch disjoint files?"
    decision: "No — fully serial: P1 -> P2 -> P3 -> P4, no exceptions."
    rationale: "P3 consumes P2's frozen API contract, and this repo has direct project-memory precedent for parallel-PR schema drift: a schema tightening and its non-conforming fixtures merged 6 hours apart and turned main's check gate red (25/2412 failing). Serializing adjacent contract-touching phases avoids repeating that failure mode."
    tradeoffs: "Slower wall-clock time than parallel P2/P3 execution, accepted deliberately."
    location: "docs/project_plans/implementation_plans/features/module-switcher-v1.md (wave_plan.waves)"
    phase: 2
  - id: "DECISION-3"
    question: "Should DEF-SW-1 (multi-module assessment) or DEF-SW-2 (dedicated signing-status schema field) be built now?"
    decision: "Both deferred — single-select-only moduleId for v1 (DEF-SW-1); status derived from existing module.json fields rather than a new schema field (DEF-SW-2)."
    rationale: "DEF-SW-1 needs its own UX design pass before a combined cross-module view makes sense. DEF-SW-2 would add a schema field ahead of the clinical-review-workflow program's own design for 'clinically signed for display,' risking two independently-evolving definitions of the same concept."
    tradeoffs: "Both get a P4-T4 design-spec authoring task (DOC-006) so the Open Questions are not silently dropped — see the Deferred Items Triage Table in the plan."
    location: "docs/project_plans/implementation_plans/features/module-switcher-v1.md (Deferred Items Triage Table)"
    phase: 4

gotchas:
  - id: "GOTCHA-1"
    title: "Anemia is also unsigned — do not special-case moduleId === 'anemia' anywhere"
    description: "Anemia's module.json has status: 'integrity-recorded' but approvedBy: [] — under the fail-closed rule (status === 'integrity-recorded' AND approvedBy.length > 0), anemia itself resolves to 'unsigned-proposal', same as the other 3 modules. This is deliberate (Risk 2 / R-1), not a bug. No code path in P1-P3 may branch on moduleId === 'anemia' to suppress or alter the banner/flag."
    solution: "P1-T3's fixture-driven unit tests explicitly assert anemia's own manifest returns 'unsigned-proposal'. FR-12 (PRD) forbids any hardcoded moduleId branch in the banner logic."
    location: "src/moduleSigningStatus.js; modules/anemia/module.json"
    severity: "high"
    affects: ["P1-T3", "P2-T3", "P3-T4"]
  - id: "GOTCHA-2"
    title: "Unknown/future status enum values must default to unsigned, never signed"
    description: "The module.json status enum will grow over time (e.g. a hypothetical 'release-ready'). deriveModuleSigningStatus must treat any value other than the exact recognized 'clinically-signed' path as 'unsigned-proposal' by default — never let an unrecognized enum value silently pass as signed."
    solution: "P1-T3's unit tests include an unknown-enum-value fixture (e.g. 'release-ready') asserting it still returns 'unsigned-proposal'."
    location: "src/moduleSigningStatus.js"
    severity: "high"
    affects: ["P1-T3"]
  - id: "GOTCHA-3"
    title: "kidney_suite_v1 / growth_suite_v1 are structurally empty — this is expected, not a bug"
    description: "Both modules ship literal empty rules.json ([]) and candidates.json ({}). A throw-free empty assess() result is correct behavior for P1-T4's regression test, and a blank-looking SPA result panel for these modules is a UX bug that FR-10's empty-state message must prevent — but the underlying empty content itself is not something this feature adds rules to fix."
    solution: "P1-T4 asserts the honest empty-rules shape (rules: [], candidates: {}) rather than treating it as a failure. P3-T5 renders an explicit 'zero clinical rules yet' message distinct from the FR-9 banner."
    location: "modules/kidney_suite_v1/rules.json; modules/growth_suite_v1/rules.json"
    severity: "medium"
    affects: ["P1-T4", "P3-T5"]

modified_files: []

updated: "2026-07-22"
notes: "This context file summarizes the two binding source docs for executors of this plan — read those directly for full detail; do not re-derive facts from the codebase that recon-brief.md already grounded."
---

# module-switcher - Development Context

**Status**: Active Development
**Created**: 2026-07-22
**Last Updated**: 2026-07-22

> **Purpose**: Shared worknotes for all agents executing the module-switcher plan (`docs/project_plans/implementation_plans/features/module-switcher-v1.md`, phases P1-P4). Read this before starting any task — it summarizes the two binding source documents, the hard guardrails every phase restates, and the entry dependency that gates P1.

---

## Quick Reference

**Binding source docs**: `.claude/worknotes/module-switcher/decisions-block.md` (binding phase/agent/model structure — Opus planning scaffold) and `.claude/worknotes/module-switcher/recon-brief.md` (grounded file:line codebase facts — consumed by the implementation-planner, **do not re-derive**).

**Hard entry dependency**: `npm run check` is RED on `main` — P1 cannot start until a green baseline SHA is recorded. See Blockers below.

**Guardrails**: restated in every phase of the plan — see "Hard Guardrails" section below.

---

## The Two Binding Source Documents

### `decisions-block.md` (schema_version 1, doc_type: decisions_block)

Opus-authored planning scaffold that the implementation-planner agent expanded into the full plan. It is binding on:
- **Phase boundaries** (§1): the 4-phase structure (P1 registration gap + accessor, P2 API surface, P3 SPA selector + banner, P4 docs/validation) and each phase's success criteria / exit gate.
- **Agent routing** (§2): `general-purpose` (sonnet) executors per phase; `codex gpt-5.6-terra` read-only diff review on P2 and P3; `task-completion-validator` + `karen` end-of-feature gates. Specialist roster (`python-backend-engineer`, `ui-engineer-enhanced`, etc.) is **not registered** in this environment — do not route to them.
- **Risk hotspots** (§3): 5 named risks (red baseline, banner keying, public API rigor, SPA bundling, structurally-empty scaffold modules) with mitigations — see Gotchas below for the executor-relevant ones.
- **Model routing** (§6): per-phase model assignments, including the explicit note that ICA offload requires `bypassPermissions` so gates actually run — never offload the karen/validator gates themselves.

The PRD (`docs/project_plans/PRDs/features/module-switcher-v1.md`) wins on product intent; the decisions-block wins on phase/agent/model structure, per the plan's own precedence note.

### `recon-brief.md` (Explore agent, 2026-07-22, code state = `263120b`)

Factual codebase brief consumed by the implementation-planner — **do not re-derive these facts**; cite file:line anchors from here instead. Covers:
- §1: module registry state (4 registered modules, `MODULE_IDS`, `DEFAULT_MODULE_ID`, per-module `module.json` status table — anemia `integrity-recorded`/others `unsigned-stub`, all `approvedBy: []`).
- §2: `server.mjs` current behavior (hardcoded anemia dispatch, existing `{error, code?, details?}` error envelope, servability fail-closed startup policy).
- §3: `src/app.js` current behavior (fully browser-local, hardcoded anemia fetch paths at the single KB-load seam, no moduleId state today).
- §4: `openapi.yaml` current gaps (no moduleId parameter, undocumented `modules` field drift).
- §5: exact test files a moduleId surface must touch.
- §6: **why `npm run check` is RED on main** — 25 pre-existing failing subtests, all E1 baseline/hash-pin drift + rights gates, unrelated to this feature.
- §7: the "unsigned proposal" conventions (`module.json.status` closed enum, `approvedBy`/`clinicalApprovers` schema-forced `[]`, D-4 runtime guard, `notice-architecture-no-clearance` doc-truth test).

---

## Hard Guardrails (restated in every phase of the plan)

Per the plan's "Column conventions" note, **every phase's task table carries this constraint line verbatim**: *"No clinical JSON edits; approvedBy[]/clinicalApprovers[] stay empty; no invented thresholds."*

Concretely, for every task in P1-P4:

1. **No clinical JSON edits.** This is pure platform plumbing + UI (registry registration, API surface, SPA selector, docs) — zero new clinical rules, thresholds, or evidence content anywhere in the diff. `modules/*/rules.json`, `candidates.json`, `evidence.json` *content* must show zero diffs across the entire feature (P4-T7's karen check enforces this with a scoped `git diff --name-only`).
2. **`approvedBy[]` / `clinicalApprovers[]` stay empty everywhere.** Schema-forced to `maxItems: 0` already (`docs/architecture.md:242,281`); this feature must not attempt to populate them, and must not write any UI/doc copy that could be read as affirming clinical sign-off.
3. **No invented thresholds.** No new numeric cutoffs, ranges, or clinical claims — this feature only exposes existing module data through new surfaces.
4. **Fail-closed banner via a single source of truth.** `src/moduleSigningStatus.js#deriveModuleSigningStatus` (authored in P1-T3) is the *only* place signing status is derived. `server.mjs` (P2) and `src/app.js` (P3) both import it directly — neither may re-implement or approximate the logic. Any missing/malformed/unrecognized manifest state must resolve to `'unsigned-proposal'`, never silently to `'clinically-signed'`. No code path may hardcode `moduleId === 'anemia'` as a signing-status shortcut (see Gotcha-1 below — anemia is unsigned too).
5. **Ranking/status language stays honest.** No wording anywhere in this feature's docs or UI may imply a clinical clearance exists (`tests/notice-architecture-no-clearance.test.mjs` is the doc-truth backstop, touched in P4-T2).

---

## The Red-Baseline Entry Dependency

**`npm run check` is RED on `main` at `263120b`** — 25 pre-existing failing subtests of 2412, all E1 baseline/hash-pin drift (`tests/ef-anemia-backfill-integrity.test.mjs`, `tests/ef-p4-t8-honesty-ac.test.mjs`, cbc converter suites) plus rights gates and `notice-architecture-no-clearance`. This is **not logic breakage** and **not caused by this feature** — it is unrelated drift from the recent E1 multi-bundle merge.

- Execution **starts only from a green baseline SHA**, recorded before any P1 task lands a commit.
- Candidate fix-gate branches exist (`fix/d4-dist-order` et al.) — this feature depends on one of them landing on `main` first, or on the phase owner branching from a locally-verified green commit and recording that SHA.
- **This feature must not fix the drifted hash pins itself** — that is the fix-gate's scope, not module-switcher's. If P1's entry criteria cannot be met, escalate rather than absorb the fix into this plan.
- See `.claude/progress/module-switcher/phase-1-progress.md`'s `entry_criteria` for the literal restatement of this dependency.

---

## Gotchas & Observations

See the `gotchas` array in this file's frontmatter for the 3 structured entries (anemia-is-also-unsigned, unknown-enum-defaults-to-unsigned, empty-scaffold-modules-are-expected). Summarized:

1. **Anemia is unsigned too** — no `moduleId === 'anemia'` special-casing anywhere in banner/flag logic.
2. **Unknown status enum values default to unsigned** — the enum will grow; unrecognized values must never be treated as signed.
3. **kidney_suite_v1 / growth_suite_v1 are structurally empty by design** — an honest empty-state (FR-10), not a fix to the empty content, is this feature's job.

---

## Integration Notes

### 2026-07-22 - artifact-tracker - P1 accessor -> P2 server -> P3 SPA

**From**: `src/moduleSigningStatus.js#deriveModuleSigningStatus` (authored P1-T3)
**To**: `server.mjs` (`meta.moduleSigningStatus`, P2-T3) and `src/app.js` (banner, P3-T4)
**Method**: Direct function import — both consumers call the same function, no API round-trip for the SPA (browser-local, bundles module.json data at build time).
**Notes**: This is the single most important integration seam in the plan (AC P3-FR9's `propagation_contract`). Do not let P2 or P3 approximate the derivation independently, even temporarily.

---

## References

**Related Files**:
- `.claude/progress/module-switcher/phase-1-progress.md` through `phase-4-progress.md`
- `docs/project_plans/implementation_plans/features/module-switcher-v1.md` (the full plan)
- `docs/project_plans/PRDs/features/module-switcher-v1.md` (PRD — product intent)
- `docs/project_plans/design-specs/public-moduleid-api-surface.md` (design spec, promoted by this PRD)
- `.claude/worknotes/module-switcher/decisions-block.md`
- `.claude/worknotes/module-switcher/recon-brief.md`
