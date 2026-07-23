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
phase: 0
title: "Four-State Questionnaire UI — Phase 0: Baseline & Guard"
status: not_started
created: '2026-07-23'
updated: '2026-07-23'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: not-started
total_tasks: 4
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
- gpt-5.6-terra
model_usage:
  primary: sonnet-5[1m]
  external: [ica, codex]
tasks:
- id: P0-01
  description: >
    Re-verify the 8-failure gate baseline. Run `npm run build && npm test` at the start of this
    phase (per the build-before-test trap) and diff the resulting failure list against the 8
    recorded in `.claude/worknotes/four-state-questionnaire-ui/gate-baseline.md` (test IDs 336,
    789, 814, 2132, 2133, 2138, 2363, 2364 — six byte-identity/baseline pins, two D1
    rights-governance checks). Record the actual observed count and IDs in the phase progress
    note. If the observed set differs from the recorded 8 (more, fewer, or different IDs), stop
    and escalate — do not silently adopt a new baseline; the drift is main-branch state this
    feature does not own fixing, but this plan's own exit gate depends on knowing the correct
    starting point.
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: []
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces: []
  acceptance_criteria: >
    `npm run build && npm test` executed in that order; the observed failure list is recorded in
    the phase progress note; if it matches the recorded 8 exactly, proceed; if not, escalation is
    recorded and P0-GATE does not pass silently.
- id: P0-02
  description: >
    Author the FR-9 neutrality guard test (`tests/tristate-neutrality-guard.test.mjs`), broadened
    per cross-family review F-3 to every discriminating operator. Per PRD FR-9 / decisions block
    §2 / SPIKE-010 "Empirical evidence", as corrected by F-3 in
    `.claude/findings/four-state-questionnaire-ui-cross-family-review.md`: write a new test that
    (a) programmatically derives the set of `triAny`/`triAll`/`triNone`/`allAssessed`-derived
    aggregate fact names from `modules/anemia/facts.anemia.js` (source-scan for `const <name> =
    tri(Any|All|None)(` and `const <name> = allAssessed(` assignments — the derivation sites
    cluster at `facts.anemia.js:149-392`, e.g. `multilineageCytopenia`(:149),
    `isolatedAnemia`(:150), `instability`(:152), `bleedingHistory`(:162), `ironRiskHistory`(:171),
    `chronicInflammation`(:183), `familyHemoglobinopathy`(:203),
    `knownChronicHemolyticDisease`(:209), `congenitalSignalsFullyAssessed`(:261),
    `jaundiceOrDarkUrine`(:379), `neurologicSymptoms`(:381), `renalSymptoms`(:385),
    `fatigueOrPallor`(:386), `petechiaeOrBruising`(:392) — derive this list from source, do not
    hardcode it, so a future rename or addition is picked up automatically rather than silently
    missed); (b) walks every rule condition (recursively through `all`/`any`/`not` combinators,
    `src/ruleEngine.js`'s own condition shape) in all four modules' `rules.json`
    (`modules/anemia/rules.json`, `modules/cbc_suite_v1/rules.json`,
    `modules/growth_suite_v1/rules.json`, `modules/kidney_suite_v1/rules.json` — scoped to all four
    per PRD AC-4, not anemia-only, so the guard covers future modules too); (c) asserts zero
    conditions reference one of the derived aggregate-fact paths with any operator that can
    discriminate `'false'` from `'unknown'` — not only `op: "is-absent"`, `"is-unknown"`,
    `"is-not-assessed"` (`src/ruleEngine.js:45-48`), but also `"is-present"` (the fourth `is-*`
    spelling), `"eq"`/`"neq"`, `"missing"`/`"exists"`, and `"truthy"`/`"falsy"`
    (`src/ruleEngine.js:27-48`'s full operator dispatch) — the three-`is-*`-only scope in the
    original task description was itself a gap F-3 found. Scope precision, do not over-assert:
    `modules/cbc_suite_v1/rules.json:38-41` (`CBC-NEUT-LOCALRANGE-001`) already has a live
    `is-unknown` condition against `cbc.neutropenia` — this is not one of the 14 derived
    aggregates (it is a raw local-range-derived scalar), so the guard must not flag it; a blanket
    "no discriminating operator anywhere" assertion would be wrong and would fail on day one.
    Include a comment naming this as the known, intentionally-excluded exception. If any
    pre-existing condition already uses `eq`/`missing`/`exists` against one of the 14 aggregates
    (the corpus has 164 `eq`, 3 `missing`, 1 `exists` uses overall — verify none target these 14
    specifically), that is a genuine, currently-undetected neutrality gap this broadened guard is
    designed to surface, not a false positive to suppress — escalate it rather than carving out a
    silent exception.
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: []
  estimated_effort: "2.0 pts"
  priority: critical
  assigned_model: sonnet-5[1m]
  model_effort: extended
  target_surfaces:
  - tests/tristate-neutrality-guard.test.mjs
  acceptance_criteria: >
    Test passes today against the live rule corpus; the aggregate-fact-name list is derived from
    `facts.anemia.js` source text, not hand-copied (proven by a test-of-the-test: temporarily
    rename one derivation site and confirm the derived set changes); a deliberately seeded
    condition using any of the broadened operator set against one of the derived aggregates in a
    scratch copy of `rules.json` makes the test fail; `CBC-NEUT-LOCALRANGE-001`'s existing
    `is-unknown` on `cbc.neutropenia` does not trip the test.
- id: P0-GATE
  description: >
    task-completion-validator gate. Verify the Phase 0 exit gate: the guard test exists, passes,
    derives its fact list from source (not hardcoded), covers the full broadened operator set
    (F-3), and does not false-positive on `CBC-NEUT-LOCALRANGE-001`; the gate-baseline
    re-verification (P0-01) is recorded and matches (or an escalation is recorded if not). Reject
    if the guard test hardcodes the 14-name list, checks only the original three `is-*` spellings
    instead of the full broadened set, flags the cbc_suite_v1 exception, or if the baseline was
    not re-run before test authoring.
  status: not_started
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P0-01, P0-02]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces: []
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: P0-REVIEW
  description: >
    Cross-family adversarial diff review. `codex`/`gpt-5.6-terra` reviews the P0 diff read-only for
    fail-closed gaps — specifically whether the guard test's derivation logic could silently
    degrade to an empty set (which would make the test vacuously pass), whether the broadened
    operator set (F-3) is actually complete against `src/ruleEngine.js:27-48`'s full dispatch, or
    whether the cbc_suite_v1 exclusion is scoped narrowly enough to not also swallow a genuine
    future violation.
  status: not_started
  assigned_to: [gpt-5.6-terra]
  provider: codex
  dependencies: [P0-02]
  estimated_effort: "—"
  priority: high
  assigned_model: gpt-5.6-terra
  model_effort: medium
  target_surfaces: []
  acceptance_criteria: "Review recorded; any finding either fixed in-phase or logged for P1 pickup."
parallelization:
  batch_1: [P0-01, P0-02]
  batch_2: [P0-GATE, P0-REVIEW]
  critical_path: [P0-02, P0-GATE]
  estimated_total_time: "~0.25–0.5 engineer-day"
blockers: []
success_criteria:
- id: SC-1
  description: "npm run build && npm test observed failures match the recorded 8-failure baseline, or drift is escalated (not silently absorbed)"
  status: pending
- id: SC-2
  description: "tests/tristate-neutrality-guard.test.mjs exists and passes"
  status: pending
- id: SC-3
  description: "The 14-aggregate-fact-name list is derived from modules/anemia/facts.anemia.js source, never hardcoded"
  status: pending
- id: SC-4
  description: "The guard scans all four modules' rules.json, not anemia-only"
  status: pending
- id: SC-5
  description: "The guard checks the full broadened discriminating-operator set (F-3) — eq/neq, missing/exists, truthy/falsy, and all four is-* spellings"
  status: pending
- id: SC-6
  description: "CBC-NEUT-LOCALRANGE-001's pre-existing is-unknown on cbc.neutropenia does not trip the guard"
  status: pending
- id: SC-7
  description: "Gate criterion: npm run check shows exactly the 8 recorded baseline failures and no others"
  status: pending
files_modified:
- tests/tristate-neutrality-guard.test.mjs
notes: >
  First phase, no dependencies — but must land first in practice: the neutrality guard (R3, High
  severity, decisions block §6) must exist before P1's pure module and P2's payload-omission
  behavior ship, converting a future silent clinical-behavior change into a loud authoring-time
  test failure instead of a silent one. Every prompt-embedded shell command dispatched to an
  executor must use the absolute worktree path
  (/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui)
  — workflow agents otherwise resolve "repo root" to the main checkout (project memory:
  workflow-agents-resolve-repo-root-to-main-checkout). No task in this phase touches
  src/ruleEngine.js, src/facts/tristate.js, modules/*/rules.json, or
  modules/anemia/facts.anemia.js (PRD FR-14, hard constraint) — P0-02 only reads them.
---

# four-state-questionnaire-ui — Phase 0: Baseline & Guard

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/four-state-questionnaire-ui/phase-0-progress.md -t P0-01 -s completed
```

---

## Objective

Re-verify the pre-existing 8-failure gate baseline against the live tree, then author the FR-9
neutrality guard test (`tests/tristate-neutrality-guard.test.mjs`) — broadened per cross-family
review F-3 to every operator that can discriminate `'false'` from `'unknown'` — **before** any
behavior change in this feature ships. This is R3 (High severity) and the single highest-value
deliverable identified across all four SPIKE legs.

**Duration**: ~0.25–0.5 engineer-day · **Dependencies**: None — first phase ·
**Entry criteria**: None (this is the first phase of the plan) ·
**Exit gate** (decisions block §6): FR-9 neutrality guard test green; baseline recorded.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P0-01 | Re-verify the 8-failure gate baseline | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | none |
| P0-02 | Author the FR-9 neutrality guard test | general-purpose | sonnet-5[1m]/extended | ica | not-started | none |
| P0-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | not-started | P0-01, P0-02 |
| P0-REVIEW | Cross-family adversarial diff review | gpt-5.6-terra | gpt-5.6-terra/medium | codex | not-started | P0-02 |

---

## Orchestration Quick Reference

**WORKING ROOT (absolute; do NOT use the parent checkout):**
`/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui`

### Batch 1 (no dependencies)

```
Task("general-purpose", "WORKING ROOT (absolute — do NOT use the parent checkout):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P0-01: Re-verify the 8-failure gate baseline. Run `npm run build && npm test` (in that order —
build-before-test trap) and diff the resulting failure list against the 8 recorded in
.claude/worknotes/four-state-questionnaire-ui/gate-baseline.md (test IDs 336, 789, 814, 2132,
2133, 2138, 2363, 2364). Record the observed count and IDs in this phase's progress note. If it
differs from the recorded 8, stop and escalate — do not silently adopt a new baseline. See plan
§Phase 0, P0-01 (phase-0-1-baseline-and-pure-module.md).")

Task("general-purpose", "WORKING ROOT (absolute — do NOT use the parent checkout):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P0-02: Author tests/tristate-neutrality-guard.test.mjs (FR-9, broadened per cross-family review
F-3). Derive the 14 triAny/triAll/triNone/allAssessed aggregate-fact names from
modules/anemia/facts.anemia.js source (do not hardcode). Walk every rule condition in all four
modules' rules.json and assert zero conditions reference a derived aggregate with any
discriminating operator — eq/neq, missing/exists, truthy/falsy, and all four is-* spellings
(is-absent/is-unknown/is-not-assessed/is-present), not only the original three is-* spellings.
Do NOT flag modules/cbc_suite_v1/rules.json:38-41 (CBC-NEUT-LOCALRANGE-001)'s existing is-unknown
on cbc.neutropenia — it targets a raw scalar, not one of the 14 aggregates. If a genuine violation
against one of the 14 aggregates is found in the live corpus, escalate it, do not suppress it. See
plan §Phase 0, P0-02.")
```

### Batch 2 (after P0-01, P0-02)

```
Task("task-completion-validator", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P0-GATE: Verify the Phase 0 exit gate for four-state-questionnaire-ui — the guard test exists,
passes, derives its fact list from source (not hardcoded), covers the full broadened operator set
(F-3), and does not false-positive on CBC-NEUT-LOCALRANGE-001; the gate-baseline re-verification
(P0-01) is recorded and matches. Reject if the guard test hardcodes the 14-name list, checks only
the original three is-* spellings, flags the cbc_suite_v1 exception, or if the baseline was not
re-run before test authoring.")

Task("gpt-5.6-terra", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P0-REVIEW: Cross-family adversarial diff review (medium effort) of the P0 diff, read-only.
Specifically check whether the guard test's derivation logic could silently degrade to an empty
set (vacuous pass), whether the broadened operator set (F-3) is actually complete against
src/ruleEngine.js:27-48's full dispatch, and whether the cbc_suite_v1 exclusion is scoped narrowly
enough not to swallow a genuine future violation.")
```

---

## Quality Gates

- [ ] `npm run build && npm test` run in that order; observed failures match the recorded 8-failure baseline (or drift is escalated, not silently absorbed)
- [ ] `tests/tristate-neutrality-guard.test.mjs` exists and passes
- [ ] The 14-aggregate-fact-name list is derived from `modules/anemia/facts.anemia.js` source, never hardcoded
- [ ] The guard scans all four modules' `rules.json`, not anemia-only
- [ ] **The guard checks the full broadened discriminating-operator set (F-3)** — `eq`/`neq`, `missing`/`exists`, `truthy`/`falsy`, and all four `is-*` spellings — not only the three `is-absent`/`is-unknown`/`is-not-assessed` spellings originally scoped
- [ ] `CBC-NEUT-LOCALRANGE-001`'s pre-existing `is-unknown` on `cbc.neutropenia` does not trip the guard
- [ ] **Gate criterion**: `npm run check` (= `npm run build && npm test && npm run validate && npm run coverage:rules && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke`) shows **exactly** the 8 recorded baseline failures (test IDs 336, 789, 814, 2132, 2133, 2138, 2363, 2364) and **no others**. A run showing more, fewer, or different failures is a FAIL for this work package.

**⚠ Build-before-test trap (gate-baseline.md).** Running bare `npm test` in a **fresh worktree**
reports **10** failures, not 8 — two extra (test IDs 2029, 2125 in the baseline doc's numbering)
are `dist/`-dependent artifacts of `dist/` not existing yet. Always run `npm run build` before
`npm test`, exactly as `npm run check` does. Do not "fix" the two extra failures — they are not
real; they disappear once `dist/` exists. P0-01 re-verifies this baseline against the live tree
before any other work begins.

---

## Implementation Notes

### Architectural Decisions

- The neutrality precondition is the single highest-value deliverable identified across all four
  SPIKE legs — it converts a future silent clinical-behavior change (a rule authored against any
  discriminating operator on one of the 14 derived aggregate facts) into a loud, authoring-time
  test failure instead of a silent one.
- **P0 before P1 is deliberate** (decisions block §6): the guard must exist *before* the
  payload-omission behavior it guards against ships.

### Known Gotchas

- Do not hardcode the 14 aggregate-fact names — derive them from `facts.anemia.js` source so a
  future rename or addition is picked up automatically.
- `CBC-NEUT-LOCALRANGE-001`'s existing `is-unknown` on `cbc.neutropenia` is a known,
  intentionally-excluded exception (a raw local-range-derived scalar, not one of the 14
  aggregates) — do not let the guard flag it, but do not silently carve out any other exception
  found during authoring; escalate genuine gaps instead.
- No task in this phase touches `src/ruleEngine.js`, `src/facts/tristate.js`, `modules/*/rules.json`,
  or `modules/anemia/facts.anemia.js` (PRD FR-14 hard constraint) — P0-02 only reads them.

### Development Setup

Node ≥ 20. Gate before Phase 1 opens: `task-completion-validator` sign-off on this phase's
`P0-GATE`.

---

## Completion Notes

Fill in when Phase 0 is complete: the observed gate-baseline re-verification result (P0-01), key
learnings from authoring the broadened neutrality guard, and any escalated finding for Phase 1
pickup.
