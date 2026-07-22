---
type: progress
schema_version: 2
doc_type: progress
prd: "module-switcher"
feature_slug: "module-switcher"
prd_ref: docs/project_plans/PRDs/features/module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/module-switcher-v1.md
created: "2026-07-22"
updated: "2026-07-22"
execution_model: batch-parallel
phase: 3
title: "SPA Module Selector + Unsigned Banner"
status: "pending"
started: null
completed: null
commit_refs: []
pr_refs: []

overall_progress: 0
completion_estimate: "on-track"

total_tasks: 9
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0

owners: ["general-purpose"]
contributors: ["task-completion-validator", "codex"]

model_usage:
  primary: "sonnet"
  external: ["gpt-5.6-terra"]

entry_criteria:
  - "Phase 2 (P2) complete: P2's frozen API contract green (wave_plan: P3 depends_on [P2]). SPA is browser-local and does not call the API, but consumes the same src/moduleSigningStatus.js accessor P2 uses server-side."
exit_criteria:
  - "npm run build + npm run smoke:browser + npm run check:imports green"
  - "banner shown for every non-signed module (today: all 4)"
  - "no new network calls"
  - "empty-state renders honestly for zero-rule modules"

tasks:
  - id: "P3-T1"
    description: "index.html — selector control + banner container. Add a native, keyboard-operable <select> module selector (populated at runtime by src/app.js, not hardcoded options — FR-12) near the existing KB-status card (index.html:29-34). Add a persistent per-module banner container adjacent to the existing .safety-banner (index.html:41-43), role=\"alert\" (matching the existing pattern), plus an empty-state message container for FR-10. Neither the selector's options nor the banner's copy is hardcoded module-id logic — both are populated/toggled by app.js from bundled module.json data."
    acceptance_criteria: "Selector and banner containers present in markup, empty/hidden by default, wired by P3-T2/T3/T4"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2"]
    estimated_effort: "0.6 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P3-T2"
    description: "src/app.js — moduleId state + literal per-module fetch map. Add selectedModuleId state, default 'anemia' (FR-11 — session-only, no localStorage/cookie/URL-param persistence). Replace the hardcoded fetch literals at the single KB-load seam (app.js:553-564) with a literal enumerated lookup keyed by MODULE_IDS (a small object/switch mapping each known id to its two literal fetch-path strings) — not a template string (`./modules/${moduleId}/rules.json`), so scripts/check-app-imports.mjs's existing static specifier parser resolves every path unmodified (resolves PRD §12 OQ-1-tech / decisions-block Risk 3 in favor of option (a): enumerate literals over extending the checker script)."
    acceptance_criteria: "Fetching each of the 4 modules' rules.json/candidates.json succeeds via the literal map; npm run check:imports passes with zero script changes"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P3-T1"]
    estimated_effort: "0.8 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P3-T3"
    description: "src/app.js — selector wiring + assess() call-site switch. Wire the selector's change event to: re-fetch the newly selected module's rules/candidates via P3-T2's map, update selectedModuleId, and re-render. Switch every assessment call site (form submit, 'load example,' algorithm-explorer use-case) from assessPediatricAnemia(input, rules, candidates) to assess(input, selectedModuleId, rules, candidates) (mirrors PRD FR-3's server-side retirement — imports assess from ./engine.js directly)."
    acceptance_criteria: "Selecting a module and submitting the form assesses against that module's rules/candidates, not anemia's; switching back to anemia still works"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P3-T2"]
    estimated_effort: "0.5 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P3-T4"
    description: "FR-9 — unsigned-proposal banner, fail-closed (see AC P3-FR9 below — structured AC: target_surfaces, propagation_contract, resilience, verified_by). src/app.js imports deriveModuleSigningStatus directly from ./moduleSigningStatus.js (same file P1-T3 authored — single source of truth, no browser-side re-derivation) and calls it against the currently-selected module's bundled module.json. Banner shown whenever the result is not 'clinically-signed' — true for all 4 modules today, including anemia (deliberate consequence of Risk 2 / R-1, not a bug). No code path special-cases moduleId === 'anemia' (FR-12). Uniform banner copy across all modules for v1 (OQ-M3); selector also surfaces manifest.status next to each module's title (OQ-M2)."
    acceptance_criteria: "See AC P3-FR9 (target_surfaces: index.html banner container, app.js#initialize, selector change handler, app.js#renderResult; propagation_contract: module.json{status,approvedBy} -> deriveModuleSigningStatus -> banner-visibility boolean; resilience: missing/unknown status or non-array/empty approvedBy -> 'unsigned-proposal' -> banner shown, no suppression path; verified_by: P3-T7, P4-T6)"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P3-T3"]
    estimated_effort: "1.0 pt"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "extended"

  - id: "P3-T5"
    description: "FR-10 — empty-state for zero-rule modules. On an assessment run against a module where rules.length === 0 && Object.keys(candidates).length === 0 (today: kidney_suite_v1, growth_suite_v1), render an explicit 'this module carries zero clinical rules yet' message at the result-render seam (renderResult, app.js:383) — distinct from, and in addition to, the FR-9 banner. Never a blank or misleadingly-successful-looking result."
    acceptance_criteria: "Selecting kidney or growth and running an assessment shows the empty-state message, not a blank/empty-looking result panel"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P3-T3"]
    estimated_effort: "0.4 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P3-T6"
    description: "check-app-imports.mjs compatibility confirmation. Run npm run check:imports against P3-T2's literal-map approach; if it resolves cleanly (expected, per P3-T2's design choice), record confirmation only — do not extend the script (Risk 3's option (b) is the fallback, not the default). If it does not resolve cleanly, extend scripts/check-app-imports.mjs to loop MODULE_IDS for specifier resolution as the documented fallback."
    acceptance_criteria: "npm run check:imports green; if the script needed extension, the extension is documented in the task's completion note"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P3-T2"]
    estimated_effort: "0.3 pt"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P3-T7"
    description: "npm run smoke:browser — module selection coverage. Extend scripts/smoke-browser-unit-rejection.mjs (or the smoke harness it's part of) to cover: selecting each non-default module, confirming the FR-9 banner renders, confirming the FR-10 empty-state renders for kidney/growth, and confirming no unexpected network request fires (Risk 4 — browser-local, no new origin). Record the actual dist/ size delta (per decisions-block Risk 4 / PRD NFR-Performance) in this task's completion note."
    acceptance_criteria: "Smoke suite passes covering all 4 modules; size delta recorded"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P3-T4", "P3-T5", "P3-T6"]
    estimated_effort: "0.4 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P3-Review"
    description: "Codex read-only diff review. codex exec read-only diff review over P3's full diff, focused specifically on FR-9's fail-closed property (no hardcoded moduleId branch, unknown/missing status still shows the banner) per decisions-block §2/§6."
    acceptance_criteria: "Review completed; any findings resolved or explicitly deferred with rationale"
    status: "pending"
    assigned_to: ["codex"]
    dependencies: ["P3-T1", "P3-T2", "P3-T3", "P3-T4", "P3-T5", "P3-T6", "P3-T7"]
    estimated_effort: "—"
    priority: "high"
    assigned_model: "gpt-5.6-terra"
    model_effort: "medium"

  - id: "P3-Validate"
    description: "task-completion-validator sign-off gate for Phase 3. Confirms all Phase 3 quality gates met before P4 may begin (P4 depends_on: [P3] per wave_plan)."
    acceptance_criteria: "npm run build + npm run smoke:browser + npm run check:imports green; AC P3-FR9 verified (fail-closed, no hardcoded moduleId branch); empty-state renders for kidney/growth (FR-10); no new network calls (Risk 4); dist/ size delta recorded; codex read-only diff review complete"
    status: "pending"
    assigned_to: ["task-completion-validator"]
    dependencies: ["P3-Review"]
    estimated_effort: "—"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "adaptive"

parallelization:
  batch_1: ["P3-T1"]
  batch_2: ["P3-T2"]
  batch_3: ["P3-T3", "P3-T6"]
  batch_4: ["P3-T4", "P3-T5"]
  batch_5: ["P3-T7"]
  batch_6: ["P3-Review"]
  batch_7: ["P3-Validate"]
  critical_path: ["P3-T1", "P3-T2", "P3-T3", "P3-T4", "P3-T7", "P3-Review", "P3-Validate"]
  estimated_total_time: "3.3 pts (critical path)"

blockers: []

success_criteria: [
  { id: "SC-1", description: "npm run build + npm run smoke:browser + npm run check:imports green", status: "pending" },
  { id: "SC-2", description: "AC P3-FR9 verified: fail-closed, no hardcoded moduleId branch (P3-T4)", status: "pending" },
  { id: "SC-3", description: "Empty-state renders for kidney/growth (FR-10, P3-T5); no new network calls (Risk 4, P3-T7)", status: "pending" },
  { id: "SC-4", description: "dist/ size delta recorded (P3-T7)", status: "pending" },
  { id: "SC-5", description: "Codex read-only diff review complete (P3-Review)", status: "pending" },
  { id: "SC-6", description: "task-completion-validator sign-off (P3-Validate)", status: "pending" }
]

files_modified: [
  "index.html",
  "src/app.js",
  "scripts/check-app-imports.mjs",
  "scripts/smoke-browser-unit-rejection.mjs"
]
---

# module-switcher - Phase 3: SPA Module Selector + Unsigned Banner

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/module-switcher/phase-3-progress.md -t P3-T1 -s completed
```

---

## Objective

Add a browser-local module selector to the SPA (`index.html` + `src/app.js`), wire it to all 4 registered modules via a literal enumerated fetch map, and render a persistent, fail-closed, manifest-driven unsigned-proposal banner (FR-9) plus an honest empty-state for zero-rule modules (FR-10). Largest phase in the plan; SPA is browser-local and never calls the API — it consumes P1's `src/moduleSigningStatus.js` accessor directly, the same file P2 uses server-side.

---

## Implementation Notes

### Architectural Decisions

- **AC P3-FR9 (structured AC)**:
  - `target_surfaces`: `index.html` (new banner container adjacent to `.safety-banner`, `index.html:41-43`); `src/app.js#initialize` (KB-load seam, `app.js:553-564` — banner state initialized on first load); `src/app.js` selector `change` handler (P3-T3 — banner re-evaluated on every module switch); `src/app.js#renderResult` (`app.js:383` — banner visibility re-asserted alongside the FR-10 empty-state on every assessment run).
  - `propagation_contract`: `modules/<id>/module.json` (`status`, `approvedBy`) -> `src/moduleSigningStatus.js#deriveModuleSigningStatus(manifest)` (single function, imported identically by `server.mjs` for `meta.moduleSigningStatus` in P2 and by `src/app.js` for the banner in P3 — never two independent derivations) -> banner-visibility boolean (`signingStatus !== 'clinically-signed'`).
  - `resilience`: missing `module.json`, missing/unknown `status` enum value, non-array or empty `approvedBy` => `deriveModuleSigningStatus` returns `'unsigned-proposal'` => banner **shown**. No code path can suppress the banner by omission.
  - `visual_evidence_required`: false (banner reuses the existing `.safety-banner` visual pattern).
  - `verified_by`: P3-T7 (browser smoke, all 4 modules), P4-T6 (full gate rerun).
- `selectedModuleId` is session-only state — no `localStorage`/cookie/URL-param persistence (FR-11).
- P3-T2's literal enumerated fetch map (not a template string) is a deliberate design choice so `scripts/check-app-imports.mjs`'s existing static specifier parser needs zero changes (resolves decisions-block Risk 3 in favor of option (a)).

### Patterns and Best Practices

- No code path may special-case `moduleId === 'anemia'` anywhere in the banner logic (FR-12) — anemia is `'unsigned-proposal'` today just like the other 3 modules, and that must stay true structurally, not by convention.
- Uniform banner copy across all modules for v1 (OQ-M3 resolution) — the FR-10 empty-state message, not the banner, carries the "zero rules yet" distinction.

### Known Gotchas

- Do not extend `scripts/check-app-imports.mjs` unless P3-T6 proves it's actually necessary — the literal-map design in P3-T2 is expected to resolve cleanly without script changes.
- The build already copies `modules/` wholesale into `dist/` — no new bundling step is needed, but P3-T7 must record the actual size delta, not assume zero impact.
- `kidney_suite_v1`/`growth_suite_v1` are structurally empty (`rules.json: []`, `candidates.json: {}`) — a blank-looking result panel here is a bug (FR-10), not acceptable "clean" behavior.

### Development Setup

No new dependencies. Vanilla-JS SPA changes plus `npm run build` / `npm run smoke:browser` / `npm run check:imports` against the existing harness.

---

## Completion Notes

_(Fill in when phase is complete: codex review findings + triage disposition, dist/ size delta, smoke suite results across all 4 modules.)_
