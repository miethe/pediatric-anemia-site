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
phase: 1
title: "Registration Gap + Status Accessor + Tripwire Retirement"
status: "pending"
started: null
completed: null
commit_refs: []
pr_refs: []

overall_progress: 0
completion_estimate: "on-track"

total_tasks: 6
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0

owners: ["general-purpose"]
contributors: ["task-completion-validator"]

model_usage:
  primary: "sonnet"
  external: []

# Serial dependency structure (plan §"Critical Path"):
# Hard Entry Dependency (baseline) -> P1 -> P2 -> P3 -> P4, fully serial by design.
entry_criteria:
  - "HARD ENTRY DEPENDENCY (blocking, not yet satisfied): green baseline SHA recorded; npm run check green on baseline. npm run check is RED on main at 263120b (25 pre-existing failing subtests of 2412 — E1 baseline/hash-pin drift, rights gates, notice-architecture-no-clearance; NOT logic breakage, NOT caused by this feature). Execution starts only from a green baseline SHA recorded in the plan's commit_refs / this phase's entry criteria before any P1 task lands a commit. This feature must NOT fix the drifted hash pins itself (fix-gate's scope) — escalate if unmet."
  - "No other phase-level prerequisite; P1 is the first phase in the wave plan (depends_on: [])."
exit_criteria:
  - "npm run check green"
  - "assess() returns a non-throwing, well-formed result for all 4 MODULE_IDS given minimal/empty patient input"
  - "signing-status accessor (src/moduleSigningStatus.js) unit-tested fail-closed against valid, missing, and malformed manifest fixtures"

tasks:
  - id: "P1-T1"
    description: "Register kidney/growth in src/units.js. Create modules/kidney_suite_v1/units.js and modules/growth_suite_v1/units.js, each calling only registerUnitModule(MODULE_ID) (zero registerAnalyteUnit calls — both modules ship rules.json: [], no unit-bearing fields yet). Add import './units.js'; as the first line of each module's index.js (mirrors modules/cbc_suite_v1/index.js:26 / modules/anemia/index.js:2 side-effect-import pattern)."
    acceptance_criteria: "registeredUnitModules (via prepareUnitValidatedInput) accepts kidney_suite_v1/growth_suite_v1 without throwing UnitRejectionError(reason:'unregistered-module') for empty input"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["Green baseline SHA recorded"]
    estimated_effort: "0.75 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P1-T2"
    description: "Register kidney/growth in src/evidence/registry.js. Create modules/kidney_suite_v1/evidence.js and modules/growth_suite_v1/evidence.js, mirroring modules/cbc_suite_v1/evidence.js's exact shape: passageById, passagesFor over each module's own evidence.json (12+ source records already present), and sourceRightsPositionById reusing src/evidence.js#sourceRightsPosition's label logic (never a second implementation). Add both as new entries to the REGISTRY Map in src/evidence/registry.js, alongside the existing anemia/cbc_suite_v1 entries — never replacing them."
    acceptance_criteria: "src/evidence/registry.js#accessorsFor('kidney_suite_v1') and ('growth_suite_v1') resolve without throwing; each module's own evidence data is returned, never anemia's or cbc's"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P1-T1"]
    estimated_effort: "1.0 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P1-T3"
    description: "Shared fail-closed signing-status accessor. New src/moduleSigningStatus.js: export function deriveModuleSigningStatus(manifest) returning 'clinically-signed' only if manifest?.status === 'integrity-recorded' AND Array.isArray(manifest?.approvedBy) AND manifest.approvedBy.length > 0; any deviation (missing manifest, missing/unknown status enum value, non-array or empty approvedBy) returns 'unsigned-proposal' — pure, non-throwing function per PRD FR-9's exact rule and decisions-block Risk 2. Single source of truth consumed identically by P2 (server) and P3 (SPA, same file, imported directly — no re-derivation). Mirrors src/governance.js#hasCredentialedClinicalApproval/clinicalApprovalStatus (empty array is a real non-approved state, never branched on truthiness alone). This is the load-bearing safety artifact every later phase consumes, never re-derives."
    acceptance_criteria: "Unit tests cover: all 4 current manifests (all -> 'unsigned-proposal', incl. anemia despite status:'integrity-recorded' because approvedBy is empty); a synthetic fully-signed fixture (-> 'clinically-signed'); missing manifest (undefined/null); missing status; unknown status enum value (e.g. 'release-ready'); non-array approvedBy; empty approvedBy — all non-signed paths return 'unsigned-proposal', none throw"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P1-T1"]
    estimated_effort: "1.25 pt"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "extended"

  - id: "P1-T4"
    description: "Registration-gap regression test. Extend tests/module-registry.test.mjs (or a new tests/module-registration-gap.test.mjs) asserting assess() (via src/engine.js#assess(input, moduleId, rules, candidates)) returns a non-throwing, well-formed result for all 4 MODULE_IDS given a minimal/empty patient input — including the honest empty-rules result shape for kidney_suite_v1/growth_suite_v1 (rules: [], candidates: {}), per PRD §11 Functional Acceptance FR-0 and Goal 1's success criteria."
    acceptance_criteria: "Test fails today (throws for kidney/growth) before P1-T1/T2 land; passes after; asserts 4/4, not just the 2 already-working modules"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P1-T1", "P1-T2"]
    estimated_effort: "0.75 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P1-T5"
    description: "Retire the two tripwire comments (FR-13). Correct src/modules/registry.js:39-50 and tests/module-registry.test.mjs:20-26's 'Deliberate tripwire ... revisit the day a client-selectable moduleId surface actually ships' comments: this feature IS that trigger. Keep the literal assertion DEFAULT_MODULE_ID === 'anemia' (FR-11 — default stays anemia by product decision, not by absence of a selector) but rewrite the surrounding comment to state a client-facing surface now exists (P2/P3 of this plan) and that DEFAULT_MODULE_ID staying 'anemia' is a deliberate product decision, not an assumed constant."
    acceptance_criteria: "Both comments no longer claim 'no client-facing surface exists'; the literal assertion is unchanged; npm run check green"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P1-T4"]
    estimated_effort: "0.25 pt"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P1-Validate"
    description: "task-completion-validator sign-off gate for Phase 1. Confirms all Phase 1 quality gates met before P2 may begin (P2 depends_on: [P1] per wave_plan)."
    acceptance_criteria: "npm test green on new/extended suites; no clinical JSON touched; assess() non-throwing for all 4 MODULE_IDS given minimal input; src/moduleSigningStatus.js unit-tested fail-closed (valid, missing, malformed fixtures); tripwire comments corrected with literal DEFAULT_MODULE_ID === 'anemia' assertion unchanged"
    status: "pending"
    assigned_to: ["task-completion-validator"]
    dependencies: ["P1-T1", "P1-T2", "P1-T3", "P1-T4", "P1-T5"]
    estimated_effort: "—"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "adaptive"

parallelization:
  batch_1: ["P1-T1"]
  batch_2: ["P1-T2", "P1-T3"]
  batch_3: ["P1-T4"]
  batch_4: ["P1-T5"]
  batch_5: ["P1-Validate"]
  critical_path: ["P1-T1", "P1-T2", "P1-T4", "P1-T5", "P1-Validate"]
  estimated_total_time: "2.75 pts (critical path; P1-T3 runs parallel to P1-T2 off the critical path)"

blockers: []

success_criteria: [
  { id: "SC-1", description: "npm test green on new/extended suites; no clinical JSON touched (P1-T1..T4)", status: "pending" },
  { id: "SC-2", description: "assess() non-throwing for all 4 MODULE_IDS given minimal input (P1-T4)", status: "pending" },
  { id: "SC-3", description: "src/moduleSigningStatus.js unit-tested fail-closed against valid, missing, and malformed manifest fixtures (P1-T3)", status: "pending" },
  { id: "SC-4", description: "Tripwire comments corrected; literal DEFAULT_MODULE_ID === 'anemia' assertion unchanged (P1-T5)", status: "pending" },
  { id: "SC-5", description: "task-completion-validator sign-off (P1-Validate)", status: "pending" }
]

files_modified: [
  "src/units.js",
  "src/evidence/registry.js",
  "src/moduleSigningStatus.js",
  "src/modules/registry.js",
  "modules/kidney_suite_v1/units.js",
  "modules/kidney_suite_v1/evidence.js",
  "modules/kidney_suite_v1/index.js",
  "modules/growth_suite_v1/units.js",
  "modules/growth_suite_v1/evidence.js",
  "modules/growth_suite_v1/index.js",
  "tests/module-registry.test.mjs"
]
---

# module-switcher - Phase 1: Registration Gap + Status Accessor + Tripwire Retirement

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/module-switcher/phase-1-progress.md -t P1-T1 -s completed
```

---

## Objective

Close the kidney/growth Registration Gap (assess() currently throws for 2 of 4 registered modules) and land the shared fail-closed signing-status accessor (src/moduleSigningStatus.js) that P2 (server) and P3 (SPA) will consume identically. FR-0 is a hard blocking prerequisite for the entire feature — no phase after P1 can proceed until all 4 MODULE_IDS assess without throwing.

**Hard Entry Dependency (blocking)**: `npm run check` is RED on `main` at `263120b` (25 pre-existing failing subtests of 2412 — E1 baseline/hash-pin drift, rights gates, `notice-architecture-no-clearance`; not logic breakage, not caused by this feature). Execution starts only from a green baseline SHA, recorded before any P1 task lands a commit. This feature must NOT fix the drifted hash pins itself — that is the fix-gate's scope; escalate if P1's entry criteria cannot be met.

---

## Implementation Notes

### Architectural Decisions

- The signing-status accessor (P1-T3) is deliberately a single, pure, non-throwing function — never re-derived or re-implemented in P2 (server.mjs) or P3 (app.js). Both later phases import it directly.
- `DEFAULT_MODULE_ID === 'anemia'` stays a literal, unchanged assertion (FR-11) — only the surrounding tripwire comment (P1-T5) is corrected to reflect that a client-facing moduleId surface now exists.
- Zero clinical JSON edits in this phase (or any phase): `approvedBy[]`/`clinicalApprovers[]` stay empty everywhere; no invented thresholds.

### Patterns and Best Practices

- P1-T1/P1-T2 mirror the existing `modules/cbc_suite_v1/` registration pattern exactly (units.js side-effect import, evidence.js accessor shape) — no new pattern invented.
- P1-T3 mirrors `src/governance.js#hasCredentialedClinicalApproval`/`clinicalApprovalStatus`'s existing "empty array is a real non-approved state" pattern.

### Known Gotchas

- `kidney_suite_v1` and `growth_suite_v1` ship literally empty `rules.json` ([]) and `candidates.json` ({}) — P1-T4's regression test must assert the *honest* empty-rules result shape, not treat a throw-free empty result as a bug.
- Anemia's `approvedBy` is also `[]` today — P1-T3's fixture tests must confirm anemia itself returns `'unsigned-proposal'`, not `'clinically-signed'` (Risk 2 / R-1: this is a deliberate consequence of the fail-closed design, not a bug).
- Unknown/future `status` enum values (e.g. a hypothetical `'release-ready'`) must default to `'unsigned-proposal'`, never be treated as signed by omission.

### Development Setup

No new dependencies. Registry/engine plumbing plus new `node:test` unit suites against the existing harness.

---

## Completion Notes

_(Fill in when phase is complete: baseline SHA used, unit-test results for the 7 fixture cases in P1-T3, task-completion-validator verdict.)_
