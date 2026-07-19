---
type: progress
schema_version: 2
doc_type: progress
prd: "wave0-safety-foundation"
feature_slug: "wave0-safety-foundation"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
execution_model: sequential
phase: 1
title: "EP-1: Tri-State Fact Model"
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

owners: ["backend-architect", "general-purpose"]
contributors: ["code-reviewer"]

model_usage:
  primary: "sonnet"
  external: []

tasks:
  - id: "EP1-T1"
    description: "Replace patient-input.schema.json's booleanMap $def (:114-117) with a triState $def. The 56 known history.*/symptoms.*/exam.* fields become an explicit per-module enumerated allow-list, each valued present/absent/unknown/not-assessed."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["EP-0 (SPIKE-003 RQ4)"]
    estimated_effort: "1.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP1-T2"
    description: "Add 4 tri-state rule-engine operators (is-present/is-absent/is-unknown/is-not-assessed) as new case branches in src/ruleEngine.js's evaluateLeaf() switch (:21-36). The existing 'Unknown rule operator' throw (:35) stays unweakened."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["EP-0 (SPIKE-003 RQ7)"]
    estimated_effort: "1.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP1-T3"
    description: "Author the 33-rule + 9-aggregate migration design: finalize the reviewed old-count -> (present-count, not-assessed-count) mapping for all 9 countTrue() aggregates and the rule-by-rule migration table for all 33 of 91 rules referencing a tri-state fact path. Highest-consequence clinical-semantic judgment call in the phase."
    status: "pending"
    assigned_to: ["backend-architect"]
    dependencies: ["EP1-T1", "EP1-T2"]
    estimated_effort: "2.5 pts"
    priority: "critical"
    assigned_model: "opus"
    model_effort: "xhigh"
  - id: "EP1-T4"
    description: "Migrate fact-derivation logic to tri-state: the 19 === true checks in facts.anemia.js, the definitional collapse in src/facts/core.js:3, and all 9 countTrue() sites, per EP1-T3's mapping."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["EP1-T3"]
    estimated_effort: "2.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP1-T5"
    description: "Migrate the 33 affected rules (101 distinct fact paths) from implicit falsy checks to explicit tri-state operators, applying EP1-T3's migration table row-for-row. The remaining 58 rules require no edit."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["EP1-T3", "EP1-T4"]
    estimated_effort: "2.0 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP1-T6"
    description: "Safety invariant test — no rule-out on not-assessed: dedicated node:test asserts swapping any referenced field to not-assessed cannot fire a clearing/rule-out branch, for every rule tagged as clearing. D-3's structural backstop."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["EP1-T5"]
    estimated_effort: "1.0 pt"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "high"
  - id: "EP1-T7"
    description: "Seam task (owner) — verify modules/anemia/ranges.js:42 (menstruating === true) post-migration for AC-SEAM. integration_owner = EP-1; EP-2 must not edit this line."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["EP1-T4"]
    estimated_effort: "0.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"
  - id: "EP1-T8"
    description: "Verify src/algorithmExplorer.js:308 UI consumer degrades safely against a tri-state value (verification only, out of engine scope; DEF-8 territory if verification finds a break)."
    status: "pending"
    assigned_to: ["general-purpose"]
    dependencies: ["EP1-T5"]
    estimated_effort: "0.5 pts"
    priority: "high"
    assigned_model: "sonnet"
    model_effort: "adaptive"
  - id: "EP1-T9"
    description: "Golden-diff enumeration + clinical rationale (FR-WP1-06, AC-D3): every difference across all 6 golden examples classified expected-from-tri-state/unexpected, every expected diff carrying a written clinical rationale. Any diff clearing a differential on not-assessed is an automatic no-go."
    status: "pending"
    assigned_to: ["backend-architect"]
    dependencies: ["EP1-T6", "EP1-T7"]
    estimated_effort: "1.0 pt"
    priority: "critical"
    assigned_model: "opus"
    model_effort: "high"

parallelization:
  batch_1: ["EP1-T1", "EP1-T2"]
  batch_2: ["EP1-T3"]
  batch_3: ["EP1-T4"]
  batch_4: ["EP1-T5", "EP1-T7"]
  batch_5: ["EP1-T6", "EP1-T8"]
  batch_6: ["EP1-T9"]
  critical_path: ["EP1-T1", "EP1-T3", "EP1-T4", "EP1-T5", "EP1-T6", "EP1-T9"]
  estimated_total_time: "10.5 pts (critical path)"

blockers: []

success_criteria: [
  { id: "SC-1", description: "All 4 new operators pass unit tests against all 4 tri-state values (EP1-T2)", status: "pending" },
  { id: "SC-2", description: "33-rule + 9-aggregate migration table complete and applied (EP1-T3/T4/T5)", status: "pending" },
  { id: "SC-3", description: "Safety invariant test green: no rule-out branch satisfiable by not-assessed (EP1-T6)", status: "pending" },
  { id: "SC-4", description: "AC-SEAM passes: ranges.js:42 correct for all 4 states (EP1-T7)", status: "pending" },
  { id: "SC-5", description: "AC-D3: zero unexplained golden diffs, every expected diff rationalized (EP1-T9)", status: "pending" },
  { id: "SC-6", description: "Safety council-review gate passed before merge", status: "pending" },
  { id: "SC-7", description: "npm run check green", status: "pending" },
  { id: "SC-8", description: "task-completion-validator sign-off", status: "pending" }
]

files_modified: [
  "schemas/patient-input.schema.json",
  "src/ruleEngine.js",
  "modules/anemia/facts.anemia.js",
  "src/facts/core.js",
  "modules/anemia/rules.json",
  "modules/anemia/ranges.js",
  "src/algorithmExplorer.js",
  "tests/module-equivalence.test.mjs",
  "tests/golden/*.json"
]
---

# wave0-safety-foundation - Phase 1: Tri-State Fact Model

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/wave0-safety-foundation/phase-1-progress.md -t EP1-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Install the tri-state fact model (WP1): make missingness representable and safety-enforced so a `not-assessed` fact can never satisfy a rule-out/differential-clearing branch, across 56 fact fields, 9 aggregates, and 33 of 91 rules. Runs parallel with EP-2 (disjoint files, one shared seam line).

---

## Implementation Notes

### Architectural Decisions

- **Integration ownership (R-P3)**: EP-1 owns `modules/anemia/ranges.js:42`. EP-2 verifies (EP2-T5) but never edits this line. EP1-T7 is the owner-side seam task and must land before EP-2 is considered complete.
- EP1-T3 (migration-table design) is deliberately routed to `opus` and stays on primary Claude — this is the highest-consequence clinical-semantic judgment call in the phase, not delegable to a cheaper model.
- EP1-T9's golden-diff classification is also `opus` — every diff is a clinical judgment under D-3, and any diff that clears a differential on `not-assessed` is an automatic no-go regardless of rationale offered.

### Patterns and Best Practices

- EP1-T1 and EP1-T2 have no mutual dependency (both gate only on EP-0's SPIKE-003 sub-questions) and can dispatch together.
- Do not batch EP1-T4/EP1-T5 as independent — EP1-T5 explicitly depends on both EP1-T3 (table) and EP1-T4 (fact-derivation landed) per the phase file.

### Known Gotchas

- `congenitalMarrowFailureSignals` is the one `countTrue()` aggregate that returns a raw count, not a `>0` collapse — EP1-T3 must record an explicit decision on whether its count now excludes or includes not-assessed fields; do not let this default silently.
- The safety `council-review` gate (SC-6) is a hard pre-merge gate, not a suggestion — it reviews EP1-T9's migration record specifically.

### Development Setup

No new dependencies. This phase is pure schema/engine/content migration against the existing `node:test` harness.

---

## Completion Notes

_(Fill in when phase is complete: migration-table link, invariant-test result, council-review verdict + reviewer.)_
