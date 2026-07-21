---
type: progress
schema_version: 2
doc_type: progress
prd: evidence-foundry-buildout
feature_slug: evidence-foundry-buildout
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
execution_model: batch-parallel
phase: 4
title: 'Evidence Foundry Buildout — Phase 4: Vertical Slice + Test Corpus'
status: pending
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 10
completed_tasks: 1
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
- testing-specialist
contributors:
- task-completion-validator
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P4-T1
  description: 'Migrate rule (a): young-infant/age-under-6-months scope-abstention
    (FR-16a): commit the P3-T7 staged proposal''s abstention rule into modules/cbc_suite_v1/rules.json,
    evidence.json, evidence-assertions.json, rule-provenance.json (module.json status
    stays ''unsigned-stub''). Verify every numeric/age-boundary literal resolves to
    an exact passage, not an invented threshold.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P3-GATE
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P4-T2
  description: 'Migrate rule (b): local-lab-range-precedence-over-universal-threshold
    (FR-16b): commit the local-range-precedence rule matching authoring-decisions.yaml''s
    dec_cbc_local_range_precedence-class record. Verify the rule fails closed (abstains)
    rather than applying a universal threshold when no compatible local profile exists.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P4-T1
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P4-T3
  description: 'Migrate rule (c): iron-deficiency-anemia candidate pattern (FR-16c):
    commit the iron-deficiency candidate-pattern rule and its candidates.json entry
    (P3-T5), preserving ''pattern,'' not diagnostic-certainty, wording.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P4-T1
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P4-T4
  description: 'Migrate rule (d): marrow-red-flag safety rule (FR-16d): commit the
    marrow-red-flag safety alert rule (output.type: ''alert'', severity per 02 §4.6
    phase 7''s fact/type/unit/missingness resolution requirement). Safety-critical
    slice rule the Phase 4 exit gate and dangerous-miss testing key off — verify its
    evidence resolves to 02 §5.4''s ''multilineage cytopenia and marrow failure/infiltration''
    hazard specifically.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P4-T1
  estimated_effort: 1.0 pts
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
- id: P4-T5
  description: 'Test corpus — rule (a) (FR-17): ef-cbc_suite_v1-positive/negative/boundary/missingness.test.mjs
    each gain >=1 case for rule (a): positive (activates below 6 months), negative
    (does not activate at 6+ months), boundary (exactly 6 months, >= vs > correctness),
    missingness (age absent -> question/abstention, never ''not young infant'').'
  status: pending
  assigned_to:
  - testing-specialist
  dependencies:
  - P4-T1
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P4-T6
  description: 'Test corpus — rule (b) (FR-17): positive/negative/boundary/missingness
    cases for the local-range-precedence rule — boundary covers local-profile-present-vs-absent
    (not a numeric edge); missingness proves an absent local profile abstains rather
    than defaulting to a universal threshold.'
  status: pending
  assigned_to:
  - testing-specialist
  dependencies:
  - P4-T2
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P4-T7
  description: 'Test corpus — rule (c) (FR-17): positive/negative/boundary (ferritin
    threshold edge)/missingness (ferritin absent) cases for the iron-deficiency candidate
    pattern.'
  status: pending
  assigned_to:
  - testing-specialist
  dependencies:
  - P4-T3
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P4-T8
  description: 'Test corpus — rule (d) + dangerous-miss (FR-17, 02 §5.4): positive/negative/boundary/missingness
    cases for the marrow-red-flag rule, plus >=1 dangerous-miss case at tests/ef-cbc_suite_v1-dangerous-miss.test.mjs
    proving the safety alert activates and dominates ranking even when a co-occurring
    benign high-scoring candidate (e.g. mild-anemia iron-deficiency match) is present
    in the same input.'
  status: pending
  assigned_to:
  - testing-specialist
  dependencies:
  - P4-T4
  - P4-T3
  estimated_effort: 1.5 pts
  priority: critical
  assigned_model: sonnet
  model_effort: extended
- id: P4-T9
  description: 'Engine integration run (seam task, FR-17, R-P3): run the full npm
    test suite against the committed modules/cbc_suite_v1/ package end to end through
    src/ruleEngine.js/src/engine.js''s assess(input, ''cbc_suite_v1'', rules, candidates)
    path, reconciling P4-T1..T4''s committed rules against P4-T5..T8''s generated
    tests. Confirm P1-T3''s registry wiring (delegated deriveFacts) produces correct
    facts for every generated test''s input.'
  status: completed
  assigned_to:
  - general-purpose
  - testing-specialist
  dependencies:
  - P4-T5
  - P4-T6
  - P4-T7
  - P4-T8
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  evidence:
  - npm test: '1034/1034 pass (incl. all 5 ef-cbc_suite_v1-*.test.mjs, 22 cases);
      npm run validate: cbc_suite_v1 module (4 rules, 1 candidate, 8 evidence records,
      19 evidence-assertions, 4 authoring-decisions, 4 rule-provenance entries) validates
      with zero schema errors'
- id: P4-GATE
  description: 'task-completion-validator gate: verify Phase 4 exit gate — slice rules
    pass engine tests; dangerous-miss case covers the marrow-red-flag-vs-benign-candidate
    hazard; every numeric resolves to an exact passage.'
  status: pending
  assigned_to:
  - task-completion-validator
  dependencies:
  - P4-T1
  - P4-T2
  - P4-T3
  - P4-T4
  - P4-T5
  - P4-T6
  - P4-T7
  - P4-T8
  - P4-T9
  estimated_effort: —
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
parallelization:
  batch_1:
  - P4-T1
  batch_2:
  - P4-T2
  - P4-T3
  - P4-T4
  - P4-T5
  batch_3:
  - P4-T6
  - P4-T7
  - P4-T8
  batch_4:
  - P4-T9
  batch_5:
  - P4-GATE
  critical_path:
  - P4-T1
  - P4-T4
  - P4-T8
  - P4-T9
  - P4-GATE
  estimated_total_time: 4.25 pts critical path; 8.0 pts total phase
blockers: []
success_criteria:
- id: SC-1
  description: Exactly the 4 named rules are migrated — no additional rules
  status: pending
- id: SC-2
  description: Each rule has a complete positive/negative/boundary(where numeric)/missingness
    test set
  status: pending
- id: SC-3
  description: The marrow-red-flag rule has >=1 passing dangerous-miss test proving
    alert dominance over a co-occurring benign candidate
  status: pending
- id: SC-4
  description: modules/cbc_suite_v1/rules.json validates against schemas/rule.schema.json
    with zero errors
  status: pending
- id: SC-5
  description: Zero invented thresholds — every numeric literal resolves to an evidence-assertions.json
    entry
  status: pending
files_modified:
- modules/cbc_suite_v1/rules.json
- modules/cbc_suite_v1/candidates.json
- modules/cbc_suite_v1/evidence.json
- modules/cbc_suite_v1/evidence-assertions.json
- modules/cbc_suite_v1/rule-provenance.json
- tests/ef-cbc_suite_v1-positive.test.mjs
- tests/ef-cbc_suite_v1-negative.test.mjs
- tests/ef-cbc_suite_v1-boundary.test.mjs
- tests/ef-cbc_suite_v1-missingness.test.mjs
- tests/ef-cbc_suite_v1-dangerous-miss.test.mjs
progress: 10
updated: '2026-07-21'
---

# evidence-foundry-buildout - Phase 4: Vertical Slice + Test Corpus

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Update progress via CLI:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/evidence-foundry-buildout/phase-4-progress.md -t TASK-X -s completed
```

---

## Objective

The 4 named rules land in `modules/cbc_suite_v1/`, with a full positive/negative/boundary/missingness/
dangerous-miss test corpus. Depends on Phase 3 complete. Duration ~4-5 engineer-days.

**Integration Owner**: general-purpose executor — owns `modules/cbc_suite_v1/rules.json` and adjudicates
between the migrated-rule tasks (P4-T1..T4) and the generated-test tasks (P4-T5..T8).
**Seam Task** (R-P3): P4-T9 — full engine-test run proving the two specialties' outputs agree.
**Exit gate** (decisions block §3): slice rules pass engine tests; the dangerous-miss set covers the
slice-relevant hazard; no invented thresholds — every value resolves to an exact passage.

---

## Implementation Notes

### Architectural Decisions

- Exactly 4 rules migrate in this phase: (a) young-infant scope-abstention, (b) local-lab-range
  precedence, (c) iron-deficiency-anemia candidate pattern, (d) marrow-red-flag safety alert. No
  additional rules.
- `module.json`'s `status` stays `"unsigned-stub"` throughout — this phase is a migration, not a
  release.

### Known Gotchas

- P4-T4/P4-T8 (the marrow-red-flag rule and its dangerous-miss test) are the safety-critical hotspot
  of this phase and the plan overall — the guardrail-breach risk in the plan's Risk Mitigation table
  keys directly off this rule. `output.severity` must be `"emergency"` or `"urgent"` per the resolved
  evidence, never a generic default.
- The dangerous-miss test (P4-T8) must construct an input matching both rule (c) and rule (d)
  simultaneously and assert the alert is present and ranked/surfaced above the candidate, not
  suppressed by it.
- P4-T2's missingness case must specifically assert no universal-threshold fallback occurs when the
  local profile is absent.

---

## Completion Notes

Fill in when Phase 4 is complete: what was built, key learnings, unexpected challenges, recommendations
for Phase 5.
