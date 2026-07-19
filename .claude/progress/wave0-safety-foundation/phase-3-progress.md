---
type: progress
schema_version: 2
doc_type: progress
prd: "wave0-safety-foundation"
feature_slug: "wave0-safety-foundation"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
execution_model: sequential
phase: 3
title: "EP-3: Evidence Provenance (Exact-Passage Evidence Records)"
status: "planning"
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
contributors: ["documentation-writer"]

model_usage:
  primary: "sonnet"
  external: ["gpt-5.6-terra (codex exec)"]

tasks:
  - id: "EP3-T1"
    description: "schemas/evidence.schema.json: new schema formalizing passage-level records — sourceLocator {page/section/table/figure}, exactPassage, evidenceGrade, applicability {age/sex/assay}, reviewDate, supersedes, surveillanceQuery, status (source-supported/implementation-proposal)."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["Entry (DEF-1 resolved via EP0-T6)"]
    estimated_effort: "1.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP3-T2"
    description: "rf-bundle -> KB-pack converter (OQ-2 resolved: lives in this repo, registers as satisfying EF-WP0): new, deterministic, re-runnable converter consuming the verified RF-EV-001 bundle (48 claims: 35 supported/8 inferred/5 speculation)."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["EP3-T1"]
    estimated_effort: "3.0 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP3-T3"
    description: "Backfill passage records for all 6 evidence sources (AC-WP3-ENUM): run EP3-T2's converter against RF-EV-001 to mint a passage-level record per source. REG-002 (launched EP0-T8) gates verbatim-quote vs. paraphrase-only wording — paraphrase-only until REG-002 clears."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["EP3-T2"]
    estimated_effort: "3.0 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "medium"
  - id: "EP3-T4"
    description: "Extend scripts/validate-kb.mjs so every rule.evidence[]/candidate.evidence[] reference resolves to a passage-level record or an explicit implementation-proposal flag."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["EP3-T1", "EP3-T3"]
    estimated_effort: "1.0 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP3-T5"
    description: "Passage-fidelity audit (cross-family lens): independent audit of EP3-T3's backfilled passages against the source RF-EV-001 bundle claims — proven pattern on this exact corpus."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["EP3-T3"]
    estimated_effort: "1.0 pt"
    priority: "high"
    assigned_model: "gpt-5.6-terra (codex exec)"
    model_effort: "high"
  - id: "EP3-T6"
    description: "R-P2 resilience — consumers handle absent evidence fields (AC-WP3-RESIL): target_surfaces src/engine.js, src/app.js, src/algorithmExplorer.js, scripts/validate-kb.mjs. A legacy-shape record encountered mid-migration must not throw."
    status: "pending"
    assigned_to: ["documentation-writer"]
    dependencies: ["EP3-T1", "EP3-T4"]
    estimated_effort: "0.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"

parallelization:
  batch_1: ["EP3-T1"]
  batch_2: ["EP3-T2"]
  batch_3: ["EP3-T3"]
  batch_4: ["EP3-T4", "EP3-T5"]
  batch_5: ["EP3-T6"]
  critical_path: ["EP3-T1", "EP3-T2", "EP3-T3", "EP3-T4", "EP3-T6"]
  estimated_total_time: "9.0 pts (critical path)"

blockers: []

success_criteria: [
  { id: "SC-1", description: "91/91 rules resolve sourcePassageId to a passage record or explicit implementation-proposal flag (EP3-T4, cross-checked by EP4-T2)", status: "pending" },
  { id: "SC-2", description: "Passage-fidelity audit clears with zero unresolved discrepancies (EP3-T5)", status: "pending" },
  { id: "SC-3", description: "AC-WP3-RESIL: absent evidence fields degrade to 'locator pending,' never a crash (EP3-T6)", status: "pending" },
  { id: "SC-4", description: "npm run check green", status: "pending" },
  { id: "SC-5", description: "task-completion-validator sign-off", status: "pending" }
]

files_modified: [
  "schemas/evidence.schema.json",
  "src/evidence.js",
  "modules/anemia/evidence.json",
  "scripts/validate-kb.mjs",
  "src/engine.js",
  "src/app.js",
  "src/algorithmExplorer.js"
]
---

# wave0-safety-foundation - Phase 3: Evidence Provenance

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/wave0-safety-foundation/phase-3-progress.md -t EP3-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Install exact-passage evidence provenance (WP3): every one of the 91 anemia rules must resolve to an exact evidence passage or an honest `implementation-proposal` flag. Content-shaped, not engine-shaped — consumes the already-verified RF-EV-001 bundle rather than refactoring code. **This phase is grouped with EP-4 in the plan's phase file** (`phase-3-4-evidence-and-governance.md`) via a strict serial edge (EP-4's `sourcePassageId` references passage IDs EP-3 mints) but tracked here as its own progress file per the 8-phase (EP-0..EP-7) execution structure.

**Phase-level entry criteria**: EP-1 and EP-2 both complete and converged; DEF-1 already resolved (EP0-T6, D-2) — this phase does not redo that work, it extends the now-single evidence source.

---

## Implementation Notes

### Architectural Decisions

- The converter (EP3-T2) is the **only** path that mints passage records — no hand-authored passage may bypass it (re-running against unchanged input must reproduce byte-identical output).
- REG-002 (launched EP0-T8, not yet cleared as of phase entry) gates EP3-T3's verbatim-quote-vs-paraphrase wording, not its shape — proceed paraphrase-only until REG-002 clears.

### Patterns and Best Practices

- EP3-T5 (passage-fidelity audit) mirrors a proven pattern: a prior `gpt-5.6` cross-model audit already caught 3 passage-fidelity gaps in the `rf` bundles on this exact corpus. Do not skip it as redundant with EP3-T3.

### Known Gotchas

- EP3-T4's `validate-kb.mjs` extension will only report 91/91 resolved once EP-4 wires `sourcePassageId` — do not expect full 91/91 coverage as an EP-3 exit signal in isolation; EP-3's own exit gate is passage records existing and resolvable, not the rule-level wiring (that's EP-4's job).
- `FDA2026_CDS` has 0 citing rules — this is expected and non-blocking, not a gap to chase.

### Development Setup

No new dependencies. Converter runs offline against a locally-available `rf` bundle (RF-EV-001).

---

## Completion Notes

_(Fill in when phase is complete: converter re-run proof, passage-fidelity audit result, REG-002 status at time of ship.)_
