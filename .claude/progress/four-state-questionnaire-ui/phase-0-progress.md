---
type: progress
schema_version: 2
doc_type: progress
prd: four-state-questionnaire-ui
feature_slug: four-state-questionnaire-ui
prd_ref: docs/project_plans/PRDs/features/four-state-questionnaire-ui-v1.md
plan_ref: docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1.md
phase_detail_ref: docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1/phase-0-1-baseline-and-pure-module.md
execution_model: batch-parallel
phase: P0
title: 'Four-State Questionnaire UI — Phase P0: Baseline & Guard'
status: not_started
created: '2026-07-23'
updated: '2026-07-23'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 4
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
- codex
model_usage:
  primary: sonnet-5[1m]
  external:
  - gpt-5.6-terra
tasks:
- id: P0-01
  description: >
    Re-verify the 8-failure gate baseline. Run `npm run build && npm test` at the start of this
    phase (per the build-before-test trap) and diff the resulting failure list against the 8
    recorded in `.claude/worknotes/four-state-questionnaire-ui/gate-baseline.md` (test IDs 336,
    789, 814, 2132, 2133, 2138 — six byte-identity/baseline pins — and 2363, 2364 — two D1
    rights-governance checks). Record the actual observed count and IDs in the phase progress
    note. If the observed set differs from the recorded 8 (more, fewer, or different IDs), stop
    and escalate — do not silently adopt a new baseline; the drift is main-branch state this
    feature does not own fixing, but this plan's own exit gate depends on knowing the correct
    starting point.
  status: not_started
  assigned_to:
  - general-purpose
  provider: ica
  dependencies: []
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  files_affected: []
  acceptance_criteria: >
    `npm run build && npm test` executed in that order; the observed failure list is recorded in
    the phase progress note; if it matches the recorded 8 exactly, proceed; if not, escalation is
    recorded and P0-GATE does not pass silently.
- id: P0-02
  description: >
    Author the FR-9 neutrality guard test (`tests/tristate-neutrality-guard.test.mjs`). Per PRD
    FR-9 / decisions block §2 / SPIKE-010 §"Empirical evidence": write a new test that (a)
    programmatically derives the set of `triAny`/`triAll`/`triNone`/`allAssessed`-derived
    aggregate fact names from `modules/anemia/facts.anemia.js` (source-scan for
    `const <name> = tri(Any|All|None)(` and `const <name> = allAssessed(` assignments — the
    derivation sites cluster at `facts.anemia.js:149-392`, e.g. `multilineageCytopenia`(:149),
    `isolatedAnemia`(:150), `instability`(:152), `bleedingHistory`(:162),
    `ironRiskHistory`(:171), `chronicInflammation`(:183), `familyHemoglobinopathy`(:203),
    `knownChronicHemolyticDisease`(:209), `congenitalSignalsFullyAssessed`(:261),
    `jaundiceOrDarkUrine`(:379), `neurologicSymptoms`(:381), `renalSymptoms`(:385),
    `fatigueOrPallor`(:386), `petechiaeOrBruising`(:392) — derive this list from source, do not
    hardcode it, so a future rename or addition is picked up automatically rather than silently
    missed); (b) walks every rule condition (recursively through `all`/`any`/`not` combinators,
    `src/ruleEngine.js`'s own condition shape) in all four modules' `rules.json`
    (`modules/anemia/rules.json`, `modules/cbc_suite_v1/rules.json`,
    `modules/growth_suite_v1/rules.json`, `modules/kidney_suite_v1/rules.json` — scoped to all
    four per PRD AC-4, not anemia-only, so the guard covers future modules too); (c) asserts zero
    conditions reference one of the derived aggregate-fact paths with `op: "is-absent"`,
    `"is-unknown"`, or `"is-not-assessed"` (`src/ruleEngine.js:45-48`'s three operator branches).
    Scope precision, do not over-assert: `modules/cbc_suite_v1/rules.json:38-41`
    (`CBC-NEUT-LOCALRANGE-001`) already has a live `is-unknown` condition against
    `cbc.neutropenia` — this is not one of the 14 derived aggregates (it is a raw
    local-range-derived scalar), so the guard must not flag it; a blanket "no `is-unknown`
    anywhere" assertion would be wrong and would fail on day one. Include a comment naming this
    as the known, intentionally-excluded exception.
  status: not_started
  assigned_to:
  - general-purpose
  provider: ica
  dependencies: []
  estimated_effort: "1.5 pts"
  priority: critical
  assigned_model: sonnet-5[1m]
  model_effort: extended
  files_affected:
  - tests/tristate-neutrality-guard.test.mjs
  acceptance_criteria: >
    Test passes today against the live rule corpus; the aggregate-fact-name list is derived from
    `facts.anemia.js` source text, not hand-copied (proven by a test-of-the-test: temporarily
    rename one derivation site and confirm the derived set changes); a deliberately seeded
    `is-absent` condition against one of the derived aggregates in a scratch copy of `rules.json`
    makes the test fail; `CBC-NEUT-LOCALRANGE-001`'s existing `is-unknown` on `cbc.neutropenia`
    does not trip the test.
- id: P0-GATE
  description: >
    `task-completion-validator` gate. Verify the Phase 0 exit gate: the guard test exists, passes,
    derives its fact list from source (not hardcoded), and does not false-positive on
    `CBC-NEUT-LOCALRANGE-001`; the gate-baseline re-verification (P0-01) is recorded and matches
    (or an escalation is recorded if not). Reject if the guard test hardcodes the 14-name list,
    if it flags the cbc_suite_v1 exception, or if the baseline was not re-run before test
    authoring.
  status: not_started
  assigned_to:
  - task-completion-validator
  provider: claude
  dependencies:
  - P0-01
  - P0-02
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  files_affected: []
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: P0-REVIEW
  description: >
    Cross-family adversarial diff review. `codex`/`gpt-5.6-terra` reviews the P0 diff read-only
    for fail-closed gaps — specifically whether the guard test's derivation logic could silently
    degrade to an empty set (which would make the test vacuously pass) or whether the
    cbc_suite_v1 exclusion is scoped narrowly enough to not also swallow a genuine future
    violation.
  status: not_started
  assigned_to:
  - gpt-5.6-terra
  provider: codex
  dependencies:
  - P0-02
  estimated_effort: "—"
  priority: medium
  assigned_model: codex
  model_effort: medium
  files_affected: []
  acceptance_criteria: "Review recorded; any finding either fixed in-phase or logged for P1 pickup."
parallelization:
  batch_1:
  - P0-01
  - P0-02
  batch_2:
  - P0-GATE
  - P0-REVIEW
  critical_path:
  - P0-02
  - P0-GATE
  estimated_total_time: "~0.25–0.5 engineer-day"
blockers: []
success_criteria:
- id: SC-1
  description: "`npm run build && npm test` run in that order; observed failures match the recorded 8-failure baseline (or drift is escalated, not silently absorbed)"
  status: not_started
- id: SC-2
  description: "`tests/tristate-neutrality-guard.test.mjs` exists and passes"
  status: not_started
- id: SC-3
  description: "The 14-aggregate-fact-name list is derived from `modules/anemia/facts.anemia.js` source, never hardcoded"
  status: not_started
- id: SC-4
  description: "The guard scans all four modules' `rules.json`, not anemia-only"
  status: not_started
- id: SC-5
  description: "`CBC-NEUT-LOCALRANGE-001`'s pre-existing `is-unknown` on `cbc.neutropenia` does not trip the guard"
  status: not_started
- id: SC-6
  description: "Gate criterion: `npm run check` shows exactly the 8 recorded baseline failures and no others"
  status: not_started
files_modified:
- tests/tristate-neutrality-guard.test.mjs
progress: 0
updated: '2026-07-23'
---

# four-state-questionnaire-ui — Phase P0: Baseline & Guard

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/four-state-questionnaire-ui/phase-0-progress.md -t P0-01 -s completed
```

---

## Objective

Re-verify the recorded 8-failure gate baseline against the live tree, then author the FR-9
neutrality guard test (`tests/tristate-neutrality-guard.test.mjs`) that converts a future silent
clinical-behavior change — a rule authored against `is-absent`/`is-unknown`/`is-not-assessed` on
one of the 14 `triAny`/`triAll`/`triNone`-derived aggregates in `modules/anemia/facts.anemia.js` —
into a loud, authoring-time test failure instead of a silent one. This is R3 (High) and the single
highest-value deliverable identified across all four SPIKE-010 legs.

**Duration**: ~0.25–0.5 engineer-day · **Dependencies**: None — first phase · **Exit gate**
(decisions block §6): FR-9 neutrality guard test green; baseline recorded.

**Why this phase is first, and why it is not negotiable**: the guard must exist *before* the
payload-omission behavior it guards against ships (P1+). Writing it in P1 or later, after
`buildInput()` already omits unanswered fields, would mean the omission behavior ran unguarded
for however long P1 took.

---

## ⚠ Build-before-test trap (gate-baseline.md)

Any executor running `npm test` before `npm run build` in this worktree will see **10** failures,
not the recorded **8** — two extra (test IDs 2029, 2125 in the baseline doc's numbering) are
`dist/`-dependent artifacts of `dist/` not existing yet in a fresh worktree. **Always run
`npm run build && npm test`**, exactly as `npm run check` does. Do not "fix" the two extra
failures — they are not real; they disappear once `dist/` exists.

## Gate Criterion — binding, do not soften

> `npm run check` (= `npm run build && npm test && npm run validate && npm run coverage:rules &&
> npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke`) shows
> **exactly** these 8 failures and no others — test IDs 336, 789, 814, 2132, 2133, 2138, 2363,
> 2364 (six byte-identity/baseline pins, two D1 rights-governance checks). A run showing more,
> fewer, or different failures is a FAIL for this work package.

---

## Entry Criteria

- None — this is the first phase of the plan. No prior phase gate to check.

## Exit Criteria

- `tests/tristate-neutrality-guard.test.mjs` exists and passes against the live rule corpus.
- The 14-aggregate-fact-name list is derived from `modules/anemia/facts.anemia.js` source, never hardcoded.
- The guard scans all four modules' `rules.json`, not anemia-only.
- `CBC-NEUT-LOCALRANGE-001`'s pre-existing `is-unknown` on `cbc.neutropenia` does not trip the guard.
- The gate-baseline re-verification (P0-01) is recorded, matching the 8-failure baseline (or an escalation is recorded).
- `task-completion-validator` (P0-GATE) has passed.
- **Gate criterion**: `npm run check` shows exactly the 8 recorded baseline failures and no others.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P0-01 | Re-verify the 8-failure gate baseline | general-purpose | sonnet-5[1m]/adaptive | ica | not_started | none |
| P0-02 | Author the FR-9 neutrality guard test | general-purpose | sonnet-5[1m]/extended | ica | not_started | none |
| P0-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | not_started | P0-01, P0-02 |
| P0-REVIEW | Cross-family adversarial diff review | gpt-5.6-terra | codex/medium | codex | not_started | P0-02 |

---

## Orchestration Quick Reference

**Absolute worktree root (use this — never the parent checkout):**
`/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui`

### Batch 1 (no dependencies — may run in parallel)

```
Task("general-purpose", "ABSOLUTE WORKING DIRECTORY:
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui
— do NOT resolve 'repo root' to the parent checkout. P0-01: Re-verify the 8-failure gate baseline.
Run `npm run build && npm test` in that order (bare `npm test` in a fresh worktree falsely reports
10 failures because dist/ is unbuilt — do not 'fix' the 2 extra). Diff the observed failure list
against .claude/worknotes/four-state-questionnaire-ui/gate-baseline.md's 8 recorded IDs (336, 789,
814, 2132, 2133, 2138, 2363, 2364). If the observed set differs, STOP and escalate — do not adopt a
new baseline silently. Record the observed list in this progress file. See
docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1/phase-0-1-baseline-and-pure-module.md,
Phase 0, P0-01.")

Task("general-purpose", "ABSOLUTE WORKING DIRECTORY:
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui
— do NOT resolve 'repo root' to the parent checkout. P0-02: Author
tests/tristate-neutrality-guard.test.mjs (FR-9). Programmatically derive the 14
triAny/triAll/triNone/allAssessed-derived aggregate fact names from
modules/anemia/facts.anemia.js source (do NOT hardcode the list — source-scan for
`const <name> = tri(Any|All|None)(` / `const <name> = allAssessed(`). Walk every rule condition
(all/any/not combinators) in all FOUR modules' rules.json (anemia, cbc_suite_v1, growth_suite_v1,
kidney_suite_v1). Assert zero conditions reference a derived aggregate with
op: is-absent/is-unknown/is-not-assessed. Do NOT flag modules/cbc_suite_v1/rules.json:38-41
(CBC-NEUT-LOCALRANGE-001) — its is-unknown on cbc.neutropenia is a raw local-range scalar, not one
of the 14 aggregates; comment this as the known, intentionally-excluded exception. See
docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1/phase-0-1-baseline-and-pure-module.md,
Phase 0, P0-02.")
```

### Batch 2 (after P0-01, P0-02)

```
Task("task-completion-validator", "ABSOLUTE WORKING DIRECTORY:
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui.
P0-GATE: Verify Phase 0 exit gate for four-state-questionnaire-ui — the guard test exists, passes,
derives its fact list from source (not hardcoded), and does not false-positive on
CBC-NEUT-LOCALRANGE-001; the gate-baseline re-verification (P0-01) is recorded and matches (or an
escalation is recorded). Reject if the guard test hardcodes the 14-name list, flags the
cbc_suite_v1 exception, or the baseline was not re-run before test authoring.")

Task("gemini-orchestrator (codex/gpt-5.6-terra)", "ABSOLUTE WORKING DIRECTORY:
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui.
P0-REVIEW: Cross-family adversarial diff review (read-only, effort=medium) of the P0 diff.
Specifically check whether the guard test's derivation logic could silently degrade to an empty
set (vacuous pass) or whether the cbc_suite_v1 exclusion is scoped narrowly enough to not swallow
a genuine future violation.")
```

---

## Quality Gates

- [ ] `npm run build && npm test` run in that order; observed failures match the recorded 8-failure baseline (or drift is escalated, not silently absorbed)
- [ ] `tests/tristate-neutrality-guard.test.mjs` exists and passes
- [ ] The 14-aggregate-fact-name list is derived from `modules/anemia/facts.anemia.js` source, never hardcoded
- [ ] The guard scans all four modules' `rules.json`, not anemia-only
- [ ] `CBC-NEUT-LOCALRANGE-001`'s pre-existing `is-unknown` on `cbc.neutropenia` does not trip the guard
- [ ] **Gate criterion**: `npm run check` shows exactly the 8 recorded baseline failures and no others

---

## Implementation Notes

### Known Gotchas

- **Build-before-test trap**: bare `npm test` in a fresh worktree reports 10 failures, not 8 — the
  two extras (2029, 2125 in the baseline doc's numbering) are `dist/`-dependent and disappear once
  `dist/` exists. Always `npm run build && npm test`.
- **Do not hardcode the aggregate-fact-name list.** The whole point of P0-02 is that a future
  rename/addition to `facts.anemia.js` is picked up automatically.
- **Do not over-assert.** `CBC-NEUT-LOCALRANGE-001`'s `is-unknown` on `cbc.neutropenia` is a raw
  local-range scalar, not one of the 14 derived aggregates — a blanket "no `is-unknown` anywhere"
  assertion fails on day one.
- **Absolute worktree paths only** in any prompt-embedded shell command —
  `/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui`
  (project memory: `workflow-agents-resolve-repo-root-to-main-checkout`).
- Per project memory, `execute-plan` silently skips review when reviewer agents are unregistered —
  probe before launching P0-GATE/P0-REVIEW.

### Development Setup

Node ≥ 20. No `src/app.js`, `src/ruleEngine.js`, or `modules/**` edits in this phase — test-authoring
only.

---

## Completion Notes

_(Fill in when phase is complete: observed baseline failure list from P0-01, confirmation the guard
test derives its fact list from source, and the P0-GATE/P0-REVIEW verdicts.)_
