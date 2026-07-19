---
type: progress
schema_version: 2
doc_type: progress
prd: "evidence-foundry-buildout"
feature_slug: "evidence-foundry-buildout"
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
execution_model: batch-parallel
phase: 2
title: "Evidence Foundry Buildout — Phase 2: Converter Core (EF-WP0)"
status: "planning"
started: null
completed: null
commit_refs: []
pr_refs: []

overall_progress: 0
completion_estimate: "on-track"

total_tasks: 10
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0

owners: ["backend-architect", "general-purpose"]
contributors: ["task-completion-validator", "karen"]

model_usage:
  primary: "sonnet"
  external: []

tasks:
  - id: "P2-T1"
    description: "Converter CLI scaffold + design (seam task owner, FR-6, 02 §4.1, 02 §4.5): design and scaffold tools/rf-bundle-to-kb-pack/ as a Node.js ESM CLI (pinned YAML parser + JSON Schema validator deps) with verb dispatch for inspect/verify and a propose stub. Define the internal module boundary (loader/hashing/eligibility/error-taxonomy/verb-handlers) and document it at tools/rf-bundle-to-kb-pack/README.md. Integration-owner design task (R-P3)."
    status: "pending"
    assigned_to: ["backend-architect"]
    dependencies: ["P1-GATE"]
    estimated_effort: "1.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "extended"

  - id: "P2-T2"
    description: "Read-only bundle loader + artifact resolution (FR-6, 02 §4.3): resolve evidence_bundle.yaml, claim_ledger.yaml, verification.yaml, sources/src_*.md, extractions/ext_*.yaml relative to evidence_bundle.yaml.artifacts, plus module.json and authoring-decisions.yaml (fail closed with a specific error when the latter is absent). Loader never writes to the run directory (seam invariant 6)."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2-T1"]
    estimated_effort: "1.0 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P2-T3"
    description: "Hash pinning ('Pin' phase, FR-7, 02 §4.6 Phase 1, seam invariant 5): SHA-256 every input artifact before any transformation step. Fail closed on a missing artifact, path escape outside the run directory, or a hash mismatch against evidence_bundle.yaml's recorded values."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2-T2"]
    estimated_effort: "1.0 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "extended"

  - id: "P2-T4"
    description: "Converter-eligibility + status-reconciliation checks (FR-9, 02 §2.3 invariants 1/3/4, 02 §3.7): reject any bundle whose status is not exactly 'verified'; reject any disagreement between the recorded process exit code and verification.yaml's exit_code/passed. Apply the 02 §3.7 converter-eligibility field table as pre-flight checks."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2-T2"]
    estimated_effort: "1.0 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "extended"

  - id: "P2-T5"
    description: "Fail-closed error taxonomy (rf exit-code mapping, FR-11, 02 §5.2): map converter-internal failure states onto the rf verify/rf council exit-code taxonomy (0 ok, 1 usage, 2 schema, 3 governance, 4 unsupported, 5 budget, 6 adapter, 7 human-review) — exits 3 and 7 must halt and surface distinctly, never treated as ordinary failures."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2-T1"]
    estimated_effort: "0.75 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P2-T6"
    description: "inspect verb (02 §4.5): inspect --run-dir <dir> --module <module.json path> runs the loader + hash-pinning + eligibility checks and prints a structured summary without emitting pack output. Zero network calls, zero LLM/generative-model invocations (FR-10)."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2-T3", "P2-T4", "P2-T5"]
    estimated_effort: "0.5 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P2-T7"
    description: "verify verb, structural pre-check (02 §4.5): verify --pack <dir> --rule-schema schemas/rule.schema.json validates a staged pack's structural shape (input-side pre-checks only this phase; pack-output-validation path left as an explicit stub for P5-T1 to complete once release-manifest.unsigned.json exists)."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["P2-T6"]
    estimated_effort: "0.5 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P2-T8"
    description: "15 seam-invariant test suite (seam task, FR-8, 02 §2.3, central Phase 2 risk hotspot): one executable test per invariant at tests/ef-converter-invariants.test.mjs. Invariants 1-6 and 13-15 covered by P2-T2..T7's own tests; this task adds coverage for invariants 7-12 (claim-eligibility routing, no confidence-to-probability translation, no absence-as-normal inference) using stub claim fixtures, plus a zero-network/zero-LLM assertion across inspect, verify, and the propose stub."
    status: "pending"
    assigned_to: ["general-purpose", "testing-specialist"]
    dependencies: ["P2-T5", "P2-T6", "P2-T7"]
    estimated_effort: "1.75 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "extended"

  - id: "P2-GATE1"
    description: "task-completion-validator gate: verify Phase 2 exit gate — 15/15 invariant tests pass; non-'verified' bundle refused; inspect/verify execute against the fixture."
    status: "pending"
    assigned_to: ["task-completion-validator"]
    dependencies: ["P2-T1", "P2-T2", "P2-T3", "P2-T4", "P2-T5", "P2-T6", "P2-T7", "P2-T8"]
    estimated_effort: "—"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P2-GATE2"
    description: "karen milestone review — converter core (decisions block §4, first of 3 named milestones): independently re-check the 15/15 invariant claim, the fail-closed exit-code taxonomy, and CLAUDE.md hard guardrails ('no generative model in the decision path,' 'no invented thresholds') against Phase 2's actual diff, not the plan's description of it. Any gap becomes a new task before Phase 3 opens."
    status: "pending"
    assigned_to: ["karen"]
    dependencies: ["P2-GATE1"]
    estimated_effort: "—"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "adaptive"

parallelization:
  batch_1: ["P2-T1"]
  batch_2: ["P2-T2", "P2-T5"]
  batch_3: ["P2-T3", "P2-T4"]
  batch_4: ["P2-T6"]
  batch_5: ["P2-T7"]
  batch_6: ["P2-T8"]
  batch_7: ["P2-GATE1"]
  batch_8: ["P2-GATE2"]
  critical_path: ["P2-T1", "P2-T2", "P2-T3", "P2-T6", "P2-T7", "P2-T8", "P2-GATE1", "P2-GATE2"]
  estimated_total_time: "6.25 pts critical path; 8.0 pts total phase"

blockers: []

success_criteria: [
  { id: "SC-1", description: "All 15 seam invariants (02 §2.3) have >=1 passing named test", status: "pending" },
  { id: "SC-2", description: "A seeded non-'verified' bundle produces a non-zero exit and zero output files", status: "pending" },
  { id: "SC-3", description: "Zero network calls and zero generative-model calls occur in any verb (test-enforced)", status: "pending" },
  { id: "SC-4", description: "runs/<RUN>/ is never mutated by any verb (test-enforced)", status: "pending" },
  { id: "SC-5", description: "karen milestone sign-off recorded", status: "pending" }
]

files_modified: [
  "tools/rf-bundle-to-kb-pack/**",
  "tests/ef-converter-invariants.test.mjs"
]
---

# evidence-foundry-buildout - Phase 2: Converter Core (EF-WP0)

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Update progress via CLI:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/evidence-foundry-buildout/phase-2-progress.md -t TASK-X -s completed
```

---

## Objective

Builds `tools/rf-bundle-to-kb-pack/`'s converter core: CLI scaffold, hash pinning, eligibility checks,
`inspect`/`verify` verbs, and the 15 seam-invariant tests that gate everything downstream. Depends on
Phase 1 complete. Duration ~4-5 engineer-days. This is the first of the plan's 3 named `karen`
milestones (decisions block §4).

**Integration Owner**: backend-architect — owns the Phase 2 design (P2-T1) and signs off that every
build task's output satisfies the seam-invariant contract the design specifies.
**Seam Task** (R-P3): P2-T8 — the 15-invariant executable test suite is the explicit join point proving
P2-T1's design and P2-T2..T7's builds agree.
**Exit gate** (decisions block §3): 15 seam invariants (`02 §2.3`) each covered by >=1 executable test;
converter refuses a non-`verified` bundle.

---

## Implementation Notes

### Architectural Decisions

- Provider is `claude` for all tasks — offline deterministic build tooling, no UI, no image
  generation, no web research (decisions block §8).
- P2-T5's exit-code taxonomy must never let governance (3) or human-review (7) fall through the
  converter's generic error handler.

### Known Gotchas

- P2-T2's loader must fail closed with a *specific* "decisions file not found" error when
  `authoring-decisions.yaml` is absent (it doesn't exist until P3-T1) — not a generic crash.
- P2-T8 must prove 15/15 invariants individually (a test-name-to-invariant-number cross-check in the
  file header), not "most."
- This is a High-risk hotspot per the plan's Risk Mitigation table (seam-invariant regression) —
  fail-closed defaults are load-bearing, not a nice-to-have.

### Development Setup

Phase 6 (Pre-E1 ADRs) opens in parallel once P2-GATE1 lands — no file overlap with Phases 3-5.

---

## Completion Notes

Fill in when Phase 2 is complete: what was built, key learnings, unexpected challenges, recommendations
for Phase 3, and the `karen` sign-off summary.
