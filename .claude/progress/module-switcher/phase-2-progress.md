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
phase: 2
title: "Public API Surface"
status: "pending"
started: null
completed: null
commit_refs: []
pr_refs: []

overall_progress: 0
completion_estimate: "on-track"

total_tasks: 8
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
  - "Phase 1 (P1) complete: P1's fail-closed signing-status accessor and Registration Gap fix green (wave_plan: P2 depends_on [P1])."
  - "npm run check green (inherited from P1's Hard Entry Dependency — same recorded baseline SHA)."
exit_criteria:
  - "npm test + npm run validate green"
  - "openapi.yaml validates against actual server behavior"
  - "backward-compat regression proves byte-identical output for moduleId omitted vs. 'anemia' explicit"

tasks:
  - id: "P2-T1"
    description: "UnknownModuleError typed error class. New error class in src/modules/registry.js (co-located with isRegisteredModule), following the UnitRejectionError/RangeUnitMismatchError precedent (src/serverErrors.js:1-6): statusCode: 400, code: 'UNKNOWN_MODULE', details: [{ field: 'moduleId', providedValue, knownModuleIds: MODULE_IDS }] per PRD FR-2's exact shape. Extend src/serverErrors.js#shapeServerError to special-case it (import + instanceof branch alongside the existing three)."
    acceptance_criteria: "shapeServerError(new UnknownModuleError(...)) returns the exact FR-2 body shape; existing 3 error types' shaping unaffected"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P1"]
    estimated_effort: "0.4 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P2-T2"
    description: "server.mjs — moduleId dispatch, validation-first, non-servable handling. POST /api/v1/assess reads optional moduleId (string) from the request body. Before any module-scoped work (FR-14 — mirrors the literal-enumerated-map precedent at src/modules/registry.js:53-55): reject non-string values and unregistered values (via isRegisteredModule()) with UnknownModuleError. Absent moduleId => DEFAULT_MODULE_ID (byte-identical current behavior). Resolve rules/candidates from the already-loaded modulesById[resolvedModuleId] (server.mjs:123-124's startup map — no new file I/O) and call assess(input, resolvedModuleId, rules, candidates) directly, retiring the server-side assessPediatricAnemia call site (FR-3). Resolves decisions-block OQ-6: if resolvedModuleId is registered but failed to load at startup (server.mjs:104-121's non-fatal-for-non-default policy), return 503 with { error, code: 'MODULE_NOT_SERVABLE', details: [{ field: 'moduleId', providedValue, reason: 'startup-load-failed' }] } — never a silent fallback to anemia, never an unhandled 500. Deliberately retire the AC-5 guardrail comment at server.mjs:126-134 (replace with a comment stating the surface now exists and pointing at this plan)."
    acceptance_criteria: "4/4 MODULE_IDS reachable via POST /api/v1/assess; unknown moduleId -> 400 UNKNOWN_MODULE; non-string moduleId -> same 400, never a TypeError; non-servable registered module -> 503 MODULE_NOT_SERVABLE; X-Request-Id present on all new error responses"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2-T1"]
    estimated_effort: "1.0 pt"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "extended"

  - id: "P2-T3"
    description: "meta.moduleSigningStatus on assess + knowledge-base responses. Using P1-T3's deriveModuleSigningStatus, add meta.moduleSigningStatus to every assess() response (FR-4, additive to the existing meta object, src/engine.js:37-44) for the assessed module, and the same field to each entry of GET /api/v1/knowledge-base's existing unconditional modules summary (FR-5, server.mjs:135-161) — no change to what modules are returned, only the additive field."
    acceptance_criteria: "Every assess response and every modules entry carries moduleSigningStatus; value matches P1-T3's derivation exactly (no re-implementation)"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2-T2"]
    estimated_effort: "0.5 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P2-T4"
    description: "openapi.yaml + schemas/patient-input.schema.json updates. (a) Add optional moduleId (string) to the assess request body schema; (b) document the UNKNOWN_MODULE 400 and MODULE_NOT_SERVABLE 503 error variants against components.schemas.Error; (c) document the pre-existing-but-undocumented modules field (incl. moduleSigningStatus) on GET /api/v1/knowledge-base's response schema — closing the drift recon brief §4 identifies (FR-6). Public-contract change; standard review rigor applies (not the clinical-review-workflow gate — no rule/threshold/evidence content changes)."
    acceptance_criteria: "npm run validate passes; openapi.yaml accurately reflects actual request/response shapes for both endpoints"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2-T2", "P2-T3"]
    estimated_effort: "0.6 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P2-T5"
    description: "Backward-compatibility regression test. New test asserting assess() output for a fixed input is byte-identical with moduleId omitted vs. moduleId: 'anemia' explicit — both via the HTTP layer (server.mjs) and, if feasible, pre/post this phase's diff (Goal 3)."
    acceptance_criteria: "Zero diffs asserted; test would fail if the default-path behavior changed at all"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2-T2"]
    estimated_effort: "0.4 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P2-T6"
    description: "API integration test suite. Extend tests/server-error-contract.test.mjs (or a sibling file) covering: default (omitted moduleId), explicit valid for all 4 MODULE_IDS, unknown string, non-string (array/object/number), and the non-servable-module 503 path (synthetic/mocked). Assert X-Request-Id present on every case."
    acceptance_criteria: "All listed scenarios covered and green"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2-T2", "P2-T5"]
    estimated_effort: "0.3 pt"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P2-Review"
    description: "Codex read-only diff review. codex exec read-only diff review over P2's full diff, focused on the public-contract change (Risk 3) and FR-14's validate-before-touch ordering. Findings triaged by the phase owner before P2 is sealed."
    acceptance_criteria: "Review completed; any findings resolved or explicitly deferred with rationale"
    status: "pending"
    assigned_to: ["codex"]
    dependencies: ["P2-T1", "P2-T2", "P2-T3", "P2-T4", "P2-T5", "P2-T6"]
    estimated_effort: "—"
    priority: "high"
    assigned_model: "gpt-5.6-terra"
    model_effort: "medium"

  - id: "P2-Validate"
    description: "task-completion-validator sign-off gate for Phase 2. Confirms all Phase 2 quality gates met before P3 may begin (P3 depends_on: [P2] per wave_plan)."
    acceptance_criteria: "npm test + npm run validate green; moduleId validated via isRegisteredModule() before any module-scoped work, every new code path; non-servable-module path returns 503, never a silent anemia fallback or unhandled 500; backward-compat regression proves zero diffs for omitted vs. explicit-'anemia' moduleId; codex read-only diff review complete"
    status: "pending"
    assigned_to: ["task-completion-validator"]
    dependencies: ["P2-Review"]
    estimated_effort: "—"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "adaptive"

parallelization:
  batch_1: ["P2-T1"]
  batch_2: ["P2-T2"]
  batch_3: ["P2-T3", "P2-T5"]
  batch_4: ["P2-T4", "P2-T6"]
  batch_5: ["P2-Review"]
  batch_6: ["P2-Validate"]
  critical_path: ["P2-T1", "P2-T2", "P2-T3", "P2-T4", "P2-Review", "P2-Validate"]
  estimated_total_time: "2.5 pts (critical path)"

blockers: []

success_criteria: [
  { id: "SC-1", description: "npm test + npm run validate green", status: "pending" },
  { id: "SC-2", description: "moduleId validated via isRegisteredModule() before any module-scoped work, every new code path (P2-T2, FR-14)", status: "pending" },
  { id: "SC-3", description: "Non-servable-module path returns 503, never a silent anemia fallback or unhandled 500 (P2-T2)", status: "pending" },
  { id: "SC-4", description: "Backward-compat regression proves zero diffs for omitted vs. explicit-'anemia' moduleId (P2-T5)", status: "pending" },
  { id: "SC-5", description: "Codex read-only diff review complete (P2-Review)", status: "pending" },
  { id: "SC-6", description: "task-completion-validator sign-off (P2-Validate)", status: "pending" }
]

files_modified: [
  "src/serverErrors.js",
  "src/modules/registry.js",
  "server.mjs",
  "openapi.yaml",
  "schemas/patient-input.schema.json",
  "tests/server-error-contract.test.mjs"
]
---

# module-switcher - Phase 2: Public API Surface

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/module-switcher/phase-2-progress.md -t P2-T1 -s completed
```

---

## Objective

Expose `moduleId` as an optional, client-settable field on `POST /api/v1/assess` (additive, backward-compatible), validated-before-touch against the registry, with an honest 503 for registered-but-non-servable modules and a fail-closed `meta.moduleSigningStatus` flag on both the assess and knowledge-base responses. Freezes the public API contract that P3's SPA selector consumes.

---

## Implementation Notes

### Architectural Decisions

- `moduleId` validation happens strictly before any module-scoped work (FR-14) — no code path may reach `modulesById[moduleId]` lookups or engine calls with an unvalidated value.
- Non-servable registered modules return `503 MODULE_NOT_SERVABLE`, never a silent fallback to `anemia` and never an unhandled 500 (resolves decisions-block OQ-6).
- `meta.moduleSigningStatus` reuses P1-T3's `deriveModuleSigningStatus` verbatim — no second implementation on the server side.
- This is a public-contract change: standard review rigor (codex read-only diff review) applies, but it is explicitly **not** routed through the clinical-review-workflow gate — no rule/threshold/evidence content changes anywhere in this phase.

### Patterns and Best Practices

- `UnknownModuleError` (P2-T1) follows the existing `UnitRejectionError`/`RangeUnitMismatchError` precedent in `src/serverErrors.js` exactly — same shaping mechanism, no new error-handling pattern.
- `rules`/`candidates` resolution reuses the already-loaded `modulesById` startup map (`server.mjs:123-124`) — zero new file I/O per request.

### Known Gotchas

- The backward-compatibility regression (P2-T5) is not optional polish — it is the proof that this is truly additive. A byte-identical diff for omitted vs. explicit-`'anemia'` moduleId is required, not just "close enough."
- `openapi.yaml` currently under-documents the pre-existing `modules` field on `GET /api/v1/knowledge-base` (drift noted in recon brief §4) — P2-T4 closes that drift as part of this phase, not a separate cleanup.

### Development Setup

No new dependencies. Server-side plumbing plus `node:test` HTTP-layer integration tests against the existing harness.

---

## Completion Notes

_(Fill in when phase is complete: codex review findings + triage disposition, backward-compat regression result.)_
