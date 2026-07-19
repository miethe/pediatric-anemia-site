---
type: progress
schema_version: 2
doc_type: progress
prd: "evidence-foundry-buildout"
feature_slug: "evidence-foundry-buildout"
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
execution_model: batch-parallel
phase: 6
title: "Evidence Foundry Buildout — Phase 6: Pre-E1 ADRs"
status: "planning"
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

owners: ["documentation-writer"]
contributors: ["task-completion-validator"]

model_usage:
  primary: "sonnet"
  external: []

tasks:
  - id: "P6-T1"
    description: "ADR-1: canonical CDS authoring model / rule-schema v2 migration (02 §8.5 item 1, 02 §8.1): draft docs/adr/0001-canonical-authoring-model-rule-schema-v2.md, status: proposed. >=2 options (extend v1 in place vs. sidecar-only vs. deliberate v2 migration) with a stated recommended default. Names DF-E1-07 explicitly."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["P2-GATE1"]
    estimated_effort: "0.6 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P6-T2"
    description: "ADR-2: exact-passage storage, licensing, reviewer access (02 §8.5 item 2, 02 §8.1): draft docs/adr/0002-exact-passage-storage-licensing.md. Directly informed by P1-T6's OQ-2 fixture rights disposition and P3-T3's rights-restricted fallback behavior. Names DF-E1-05."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["P2-GATE1"]
    estimated_effort: "0.6 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P6-T3"
    description: "ADR-3: terminology and local-lab-profile ownership (02 §8.5 item 3, 02 §8.1): draft docs/adr/0003-terminology-local-lab-profile-ownership.md. Addresses both LOINC/UCUM/SNOMED mapping ownership and local-range-profile-vs-claim questions. Names DF-E1-05."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["P2-GATE1"]
    estimated_effort: "0.6 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P6-T4"
    description: "ADR-4: clinical approval identity, signature, and adjudication workflow (02 §8.5 item 4, 02 §5.3): draft docs/adr/0004-clinical-approval-identity-adjudication.md. Options per 02 §8.1 (git-signed files vs. portal vs. issue tracker); notes E0 shipped zero clinical review UI. Names DF-E1-01 and DF-E1-04."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["P2-GATE1"]
    estimated_effort: "0.6 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P6-T5"
    description: "ADR-5: KB canonical serialization, signing algorithm, key custody, registry (02 §8.5 item 5, 02 §4.18): draft docs/adr/0005-kb-serialization-signing-key-custody.md, informed by P5-T5's determinism-proof work. Names DF-E1-06 and DF-E2-01."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["P2-GATE1"]
    estimated_effort: "0.6 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P6-T6"
    description: "ADR-6: validation data boundary, de-identification, retention, and audit (02 §8.5 item 6, 02 §8.4): draft docs/adr/0006-validation-data-boundary-deidentification.md. Explicitly restates the CLAUDE.md 'No PHI in the public microsite' guardrail as a binding constraint. Names DF-E1-04."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["P2-GATE1"]
    estimated_effort: "0.6 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P6-T7"
    description: "ADR-7: surveillance cadence, materiality classes, emergency withdrawal (02 §8.5 item 7, 02 §7.4): draft docs/adr/0007-surveillance-cadence-materiality-classes.md. Names DF-E2-01, DF-E2-02, and DF-E2-03 (all depend on this ADR's materiality-class taxonomy)."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["P2-GATE1"]
    estimated_effort: "0.6 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P6-T8"
    description: "ADR-8: Path-B workflow hardening vs. native adapter installation (02 §8.5 item 8, 02 §6.2): draft docs/adr/0008-pathb-hardening-vs-native-adapter.md. Reconciles 02 §3.4's discovery-lane table with the real gap register (hard-coded RF/repo/TMP/stamp paths; 0/6 adapters installed) into a concrete recommendation with stated migration cost per option. Names DF-E1-02."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["P2-GATE1"]
    estimated_effort: "0.8 pts"
    priority: "medium"
    assigned_model: "sonnet"
    model_effort: "adaptive"

  - id: "P6-GATE"
    description: "task-completion-validator gate: verify Phase 6 exit gate — all 8 ADRs exist at status: proposed; each names its E1/E2 unblock target; zero marked accepted."
    status: "pending"
    assigned_to: ["task-completion-validator"]
    dependencies: ["P6-T1", "P6-T2", "P6-T3", "P6-T4", "P6-T5", "P6-T6", "P6-T7", "P6-T8"]
    estimated_effort: "—"
    priority: "critical"
    assigned_model: "sonnet"
    model_effort: "adaptive"

parallelization:
  batch_1: ["P6-T1", "P6-T2", "P6-T3", "P6-T4", "P6-T5", "P6-T6", "P6-T7", "P6-T8"]
  batch_2: ["P6-GATE"]
  critical_path: ["P6-T8", "P6-GATE"]
  estimated_total_time: "0.8 pts critical path (all 8 ADRs parallelizable); 5.0 pts total phase"

blockers: []

success_criteria: [
  { id: "SC-1", description: "8 ADRs exist under docs/adr/, each at status: proposed", status: "pending" },
  { id: "SC-2", description: "Each ADR names its decision, >=2 options, a recommended default, and the specific deferred-item ID(s) it unblocks", status: "pending" },
  { id: "SC-3", description: "Zero ADRs are marked accepted", status: "pending" }
]

files_modified: [
  "docs/adr/0001-canonical-authoring-model-rule-schema-v2.md",
  "docs/adr/0002-exact-passage-storage-licensing.md",
  "docs/adr/0003-terminology-local-lab-profile-ownership.md",
  "docs/adr/0004-clinical-approval-identity-adjudication.md",
  "docs/adr/0005-kb-serialization-signing-key-custody.md",
  "docs/adr/0006-validation-data-boundary-deidentification.md",
  "docs/adr/0007-surveillance-cadence-materiality-classes.md",
  "docs/adr/0008-pathb-hardening-vs-native-adapter.md"
]
---

# evidence-foundry-buildout - Phase 6: Pre-E1 ADRs

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Update progress via CLI:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/evidence-foundry-buildout/phase-6-progress.md -t TASK-X -s completed
```

---

## Objective

Parallel lane, docs-only: drafts the 8 pre-E1 ADRs the design spec (`02 §8.5`) requires before E1 can
be planned. Opens as soon as Phase 2 (`P2-GATE1`) lands and is independent of Phases 3-5 — no file
overlap (`docs/adr/**` vs. `tools/rf-bundle-to-kb-pack/**` / `modules/cbc_suite_v1/**`). Must close
before Phase 7 opens. Duration ~2 engineer-days, but has the full P3+P4+P5 duration (21 pts) of slack
since it is off the critical path.

**Assigned Subagent**: documentation-writer (sonnet — "ADRs carry architectural judgment; do not route
to haiku," per decisions block §4). Use the `create-adr` skill if its template fits (no ADR convention
exists yet — `docs/adr/` is created by this phase).
**Exit gate** (decisions block §3): 8 ADRs exist, each names its decision, options, and the E1 item(s)
it unblocks; none marked `accepted`.

---

## Implementation Notes

### Architectural Decisions

- All 8 ADRs are independent Markdown files under `docs/adr/` — batch_1 is maximally parallel (no
  intra-phase dependencies beyond the shared `P2-GATE1` prerequisite).
- None of the 8 ADRs may be marked `accepted` in this plan — every one stays `status: proposed`.
- ADR-8 (Path-B hardening vs. native adapter) is the architecturally densest of the eight — it must
  reconcile the discovery-lane table with the real gap register, not just restate the summary row.

### Known Gotchas

- Each ADR must name the specific deferred-item ID(s) (`DF-E1-*`/`DF-E2-*`) it unblocks — a generic
  "future work" reference does not satisfy the acceptance criteria.
- ADR-5 must explicitly reference P5-T5's canonical-serialization implementation as the substrate the
  signing decision builds on — do not treat serialization and signing as independent topics.

---

## Completion Notes

Fill in when Phase 6 is complete: what was built, key learnings, unexpected challenges, recommendations
for Phase 7 (which consumes these 8 ADRs to seed 8 of the 10 deferred-item design specs).
