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
phase: 4
title: "Docs, Doc-Truth, Validation Sweep"
status: "pending"
started: null
completed: null
commit_refs: []
pr_refs: []

overall_progress: 0
completion_estimate: "on-track"

total_tasks: 7
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0

owners: ["general-purpose"]
contributors: ["task-completion-validator", "karen"]

model_usage:
  primary: "sonnet"
  external: []
  docs: "haiku"

entry_criteria:
  - "Phase 3 (P3) complete and green (wave_plan: P4 depends_on [P3])."
exit_criteria:
  - "Full npm run check green (on the recorded green baseline, per Hard Entry Dependency from P1)"
  - "design-spec promoted"
  - "both deferred items have design-spec paths"
  - "karen end-of-feature review passed"

tasks:
  - id: "P4-T1"
    description: "openapi.yaml final consistency pass. Re-verify openapi.yaml against P2/P3's actual shipped behavior end-to-end (info.version bump if this repo's convention requires one for an additive public-contract change — confirm against prior minor-version bumps in git history before deciding)."
    acceptance_criteria: "npm run validate green; no drift between documented and actual shapes"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P3"]
    estimated_effort: "0.2 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P4-T2"
    description: "docs/architecture.md module-status table touch-up. Update the module-status table/surface (recon brief §7, docs/architecture.md:41-46) to reflect the now-client-selectable moduleId surface and all 4 modules' current signing status — must not affirm any clearance (tests/notice-architecture-no-clearance.test.mjs stays green; no wording implies clinical sign-off exists)."
    acceptance_criteria: "Table accurate; doc-truth test green"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P4-T1"]
    estimated_effort: "0.3 pt"
    priority: "high"
    assigned_model: "haiku"
    model_effort: "adaptive"

  - id: "P4-T3"
    description: "Design-spec promotion verification. docs/project_plans/design-specs/public-moduleid-api-surface.md already carries maturity: promoted and prd_ref set to this PRD (pre-existing state at plan-authoring time) — verify its 'Design Sketch' section is updated to match what actually shipped (body field, UNKNOWN_MODULE/MODULE_NOT_SERVABLE codes, single-select-only) rather than the pre-implementation sketch; correct any drift."
    acceptance_criteria: "Design-spec content matches shipped behavior; maturity/prd_ref/status fields consistent"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P4-T1"]
    estimated_effort: "0.2 pt"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P4-T4"
    description: "DOC-006 — author 2 deferred-item design specs. One task per row in the Deferred Items Triage Table: docs/project_plans/design-specs/multi-module-assessment-view.md (DEF-SW-1, maturity: idea — needs UX design first) and docs/project_plans/design-specs/module-signing-status-schema-field.md (DEF-SW-2, maturity: shaping — dependency-blocked on the clinical-review-workflow program). Both set prd_ref to this feature's PRD; append both paths to this plan's deferred_items_spec_refs."
    acceptance_criteria: "Both specs authored; deferred_items_spec_refs frontmatter populated with both paths"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P4-T1"]
    estimated_effort: "0.5 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P4-T5"
    description: "CHANGELOG entry. Add an [Unreleased] entry per .claude/specs/changelog-spec.md categorization: client-selectable moduleId on POST /api/v1/assess, SPA module selector, unsigned-proposal banner/API flag. User-facing (new API surface + new UI control) — changelog_required: true."
    acceptance_criteria: "Entry present under [Unreleased]; changelog_ref frontmatter set to CHANGELOG.md"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P4-T1"]
    estimated_effort: "0.2 pt"
    priority: "medium"
    assigned_model: "haiku"
    model_effort: "adaptive"

  - id: "P4-T6"
    description: "Full npm run check gate rerun. Full end-to-end rerun on the feature branch against the recorded green baseline: npm test && npm run validate && npm run coverage:rules && npm run build && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke. This is the plan's holistic go/no-go and the second verified_by reference for AC P3-FR9."
    acceptance_criteria: "All 8 gate steps pass; zero new failures beyond the pre-existing (and unrelated) baseline-drift set, which must not have grown"
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P4-T2", "P4-T3", "P4-T4", "P4-T5"]
    estimated_effort: "0.4 pt"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P4-T7"
    description: "task-completion-validator + karen end-of-feature review. Final per-phase task-completion-validator sign-off, plus a whole-feature karen review: confirms zero clinical JSON diffs across the entire feature (git diff --name-only scoped to modules/*/rules.json, candidates.json, evidence.json content — must be empty), confirms approvedBy[]/clinicalApprovers[] stayed empty everywhere, confirms the FR-9 fail-closed property held across P1->P3, confirms both deferred items have specs."
    acceptance_criteria: "karen review passed; findings (if any) resolved or explicitly deferred with rationale"
    status: "pending"
    assigned_to: ["task-completion-validator", "karen"]
    dependencies: ["P4-T6"]
    estimated_effort: "0.2 pt"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "adaptive"

parallelization:
  batch_1: ["P4-T1"]
  batch_2: ["P4-T2", "P4-T3", "P4-T4", "P4-T5"]
  batch_3: ["P4-T6"]
  batch_4: ["P4-T7"]
  critical_path: ["P4-T1", "P4-T4", "P4-T6", "P4-T7"]
  estimated_total_time: "1.3 pts (critical path; P4-T4 is the longest batch_2 slice at 0.5 pt)"

blockers: []

success_criteria: [
  { id: "SC-1", description: "Full npm run check green (8-step gate, recorded baseline) (P4-T6)", status: "pending" },
  { id: "SC-2", description: "docs/architecture.md touch-up affirms no clearance (tests/notice-architecture-no-clearance.test.mjs green) (P4-T2)", status: "pending" },
  { id: "SC-3", description: "Design-spec promoted and content-accurate (P4-T3)", status: "pending" },
  { id: "SC-4", description: "Both deferred items have design-spec paths in deferred_items_spec_refs (P4-T4)", status: "pending" },
  { id: "SC-5", description: "CHANGELOG [Unreleased] entry present (P4-T5)", status: "pending" },
  { id: "SC-6", description: "Zero clinical JSON diffs anywhere in the feature (scoped git diff --name-only check) (P4-T7)", status: "pending" },
  { id: "SC-7", description: "karen end-of-feature review passed (P4-T7)", status: "pending" },
  { id: "SC-8", description: "task-completion-validator sign-off (P4-T7)", status: "pending" },
  { id: "SC-9", description: "Plan frontmatter lifecycle fields complete (status: completed, commit_refs, updated)", status: "pending" }
]

files_modified: [
  "openapi.yaml",
  "docs/architecture.md",
  "docs/project_plans/design-specs/public-moduleid-api-surface.md",
  "docs/project_plans/design-specs/multi-module-assessment-view.md",
  "docs/project_plans/design-specs/module-signing-status-schema-field.md",
  "CHANGELOG.md"
]
---

# module-switcher - Phase 4: Docs, Doc-Truth, Validation Sweep

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/module-switcher/phase-4-progress.md -t P4-T1 -s completed
```

---

## Objective

Close out the feature: bring `openapi.yaml` and `docs/architecture.md` into agreement with what actually shipped in P1–P3, promote the design spec, author both deferred-item design specs, record the CHANGELOG entry, rerun the full 8-step `npm run check` gate, and pass a whole-feature `karen` review confirming zero clinical-content drift across the entire diff.

**Wrap-up note (post-P4, not a P4 task in this progress file)**: per the plan's "Wrap-Up: Feature Guide & PR" section, a feature guide (`.claude/worknotes/module-switcher/feature-guide.md`) and PR are created automatically after all P4 quality gates pass — tracked separately, not as a P4-T task.

---

## Implementation Notes

### Architectural Decisions

- `docs/architecture.md`'s touch-up must never imply clinical sign-off exists — `tests/notice-architecture-no-clearance.test.mjs` is the doc-truth backstop and must stay green through P4-T2.
- Both deferred items (DEF-SW-1: multi-module/array-valued moduleId, out of scope per PRD §7; DEF-SW-2: dedicated "clinically signed" manifest field, dependency-blocked on the clinical-review-workflow program) must have a design-spec path recorded before P4 is sealed — no PRD Open Question is left silently unresolved.
- `P4-T6`'s full gate rerun is the plan's holistic go/no-go — it must show zero *new* failures beyond the pre-existing, unrelated baseline-drift set (25 subtests at `263120b`), and that set must not have grown.

### Patterns and Best Practices

- P4-T2 and P4-T5 route to `haiku` (mechanical doc/changelog edits); P4-T1, P4-T3, P4-T4, P4-T6, P4-T7 stay on `sonnet` (doc-truth precision, design-spec authoring, gate rerun, and the karen/validator gates).
- `karen`'s scope is explicitly the whole feature (P1–P4), not just P4 — it re-confirms invariants that held in every earlier phase's quality gates.

### Known Gotchas

- Do not let `P4-T6`'s gate rerun quietly tolerate a *larger* set of pre-existing failures than the 25 recorded at the Hard Entry Dependency baseline — that would mask a real regression as "pre-existing."
- `karen`'s zero-clinical-JSON-diff check is scoped specifically to `modules/*/rules.json`, `candidates.json`, `evidence.json` *content* — module registration plumbing (P1's new `units.js`/`evidence.js`/`index.js` files) is expected and not a violation; only the clinical JSON content itself must be untouched.

### Development Setup

No new dependencies. Documentation edits plus a full rerun of the existing `npm run check` composite gate.

---

## Completion Notes

_(Fill in when phase is complete: final gate-rerun result, karen verdict, feature-guide path, PR link.)_
