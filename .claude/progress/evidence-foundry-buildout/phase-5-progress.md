---
type: progress
schema_version: 2
doc_type: progress
prd: "evidence-foundry-buildout"
feature_slug: "evidence-foundry-buildout"
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
execution_model: batch-parallel
phase: 5
title: "Evidence Foundry Buildout — Phase 5: Manifest & Traceability"
status: "planning"
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

tasks:
  - id: "P5-T1"
    description: "release-manifest.unsigned.json + schema (FR-18, 02 §4.18 minus signature block): emit build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-manifest.unsigned.json binding rfInputs[].{runId, bundleSha256, claimLedgerSha256, verificationExitCode}, converter.{name, version, configSha256}, testCorpusHash, traceabilityHash. Author schemas/release-manifest.schema.json, wire it into scripts/validate-kb.mjs as existence-gated, and complete P2-T7's verify verb pack-output-validation stub."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P4-GATE"]
    estimated_effort: "1.25 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P5-T2"
    description: "conversion-report.json (FR-19): enumerate every excluded or rejected claim, source, or candidate item with its specific exclusion reason — every speculation/unsupported claim P3-T4's routing rejected must appear here with its specific reason, not be silently dropped."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P5-T1"]
    estimated_effort: "1.0 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P5-T3"
    description: "semantic-diff.json (OQ-4): rule-id-level added/removed/changed comparison between the staged cbc_suite_v1 proposal and modules/anemia/rules.json — no impact-graph traversal. Sorted, deterministic output; expected result is exactly 4 added, 0 removed, 0 changed."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P5-T1"]
    estimated_effort: "0.75 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P5-T4"
    description: "Traceability index (02 §4.16): build the source -> passage -> claim -> decision -> rule -> test -> output index for the 4 slice rules and prove both required bidirectional queries work — (1) given a rendered output, show rule/decision/claims/passages/sources/review-date; (2) given a source, list claims/rules/tests/outputs potentially affected."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P5-T1"]
    estimated_effort: "1.0 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P5-T5"
    description: "Determinism double-run proof (FR-20, 02 §2.3 invariant 13, High risk hotspot): run propose twice against byte-identical inputs on the same converter version and assert SHA-256 equality across every emitted artifact. Add tests/ef-converter-determinism.test.mjs and tests/ef-converter-manifest.test.mjs. No timestamps embedded in hashed content; sorted serialization throughout."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P5-T2", "P5-T3", "P5-T4"]
    estimated_effort: "1.0 pts"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "extended"

  - id: "P5-GATE1"
    description: "task-completion-validator gate: verify Phase 5 exit gate — manifest hash reproducible; conversion report enumerates every exclusion."
    status: "pending"
    assigned_to: ["task-completion-validator"]
    dependencies: ["P5-T1", "P5-T2", "P5-T3", "P5-T4", "P5-T5"]
    estimated_effort: "—"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P5-GATE2"
    description: "karen milestone review — E0 functionally complete (decisions block §4): independently re-verify the full E0 acceptance checklist (02 §9.1) against the actual repository state — determinism, zero dangling trace edges, strict schema validation, zero invented thresholds, no artifact described as clinically validated or release-ready. Sign-off recorded item-by-item against 02 §9.1's checklist, not just this plan's exit gate."
    status: "pending"
    assigned_to: ["karen"]
    dependencies: ["P5-GATE1"]
    estimated_effort: "—"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "adaptive"

parallelization:
  batch_1: ["P5-T1"]
  batch_2: ["P5-T2", "P5-T3", "P5-T4"]
  batch_3: ["P5-T5"]
  batch_4: ["P5-GATE1"]
  batch_5: ["P5-GATE2"]
  critical_path: ["P5-T1", "P5-T2", "P5-T5", "P5-GATE1", "P5-GATE2"]
  estimated_total_time: "3.25 pts critical path; 5.0 pts total phase"

blockers: []

success_criteria: [
  { id: "SC-1", description: "Manifest content-hash is reproducible across two clean runs (SHA-256 equality demonstrated)", status: "pending" },
  { id: "SC-2", description: "Conversion report enumerates every exclusion with a specific reason", status: "pending" },
  { id: "SC-3", description: "Semantic diff reports exactly the 4 expected added rule IDs, deterministically", status: "pending" },
  { id: "SC-4", description: "Both 02 §4.16 bidirectional traceability queries succeed with zero dangling edges", status: "pending" },
  { id: "SC-5", description: "karen E0-complete sign-off recorded", status: "pending" }
]

files_modified: [
  "tools/rf-bundle-to-kb-pack/**",
  "schemas/release-manifest.schema.json",
  "scripts/validate-kb.mjs",
  "tests/ef-converter-determinism.test.mjs",
  "tests/ef-converter-manifest.test.mjs"
]
---

# evidence-foundry-buildout - Phase 5: Manifest & Traceability

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Update progress via CLI:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/evidence-foundry-buildout/phase-5-progress.md -t TASK-X -s completed
```

---

## Objective

Unsigned manifest, conversion report, minimal semantic diff, and the determinism double-run proof.
Depends on Phase 4 complete. Duration ~3 engineer-days. This is the plan's second `karen` milestone —
"E0 functionally complete."

**Exit gate** (decisions block §3): manifest content-hash reproducible across two runs; conversion
report enumerates every exclusion with reason.

---

## Implementation Notes

### Architectural Decisions

- **OQ-4** (semantic-diff minimal scope): rule-id-level added/removed/changed detection only,
  comparing the `cbc_suite_v1` proposal against `modules/anemia/rules.json` — no impact-graph
  traversal. A trivially correct "4 added, 0 removed, 0 changed" result is expected and acceptable for
  E0; a materially interesting diff is E1's job.
- `schemas/release-manifest.schema.json` is gated on `build/kb-pack/` existing (gitignored/ephemeral
  per P1-T7) — the check runs only when the directory is present.

### Known Gotchas

- Determinism drift is a High-risk hotspot (plan Risk Mitigation table): no timestamps in hashed
  content, sorted serialization throughout, pinned Node >=20.
- P5-GATE2's `karen` review checks the actual repository state against `02 §9.1`'s checklist
  item-by-item — not this plan's own exit-gate description of it.

---

## Completion Notes

Fill in when Phase 5 is complete: what was built, key learnings, unexpected challenges, recommendations
for Phase 7 (Phase 6 runs independently, in parallel, and does not depend on Phase 5's output).
