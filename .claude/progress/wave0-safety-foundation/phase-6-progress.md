---
type: progress
schema_version: 2
doc_type: progress
prd: wave0-safety-foundation
feature_slug: wave0-safety-foundation
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
execution_model: batch-parallel
phase: 6
title: 'EP-6: Adversarial Validation Corpus'
status: completed
started: '2026-07-21T14:00:00Z'
completed: '2026-07-21T17:30:00Z'
commit_refs: []
pr_refs: []
overall_progress: 100
completion_estimate: on-track
total_tasks: 5
completed_tasks: 5
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- adversarial reviewer (cross-family, fable)
model_usage:
  primary: sonnet
  external:
  - fable
tasks:
- id: EP6-T1
  description: 'tests/property.test.mjs: hand-rolled seeded deterministic generators
    against node:test (D-5) exercising fact-derivation and rule invariants, including
    FR-WP1-05''s narrowing invariant (cross-checked against EP1-T6).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP-5
  estimated_effort: 2.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T14:05:00Z'
  completed: '2026-07-21T14:35:00Z'
  evidence:
  - test: tests/property.test.mjs
  - note: 8/8 pass, 89-of-91 rules activated, verified across 4 seeds
  - review: task-completion-validator PASS-WITH-FINDINGS
  verified_by:
  - EP6-REVIEW-GATE
- id: EP6-T2
  description: 'tests/boundary.test.mjs: boundary-value cases at every numeric threshold
    in modules/anemia/rules.json (e.g., ferritin exactly at 20/30 ng/mL).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP-5
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T14:05:00Z'
  completed: '2026-07-21T15:10:00Z'
  evidence:
  - test: tests/boundary.test.mjs
  - note: 66/66 pass; +4 threshold-pinning tests closing the 3 surviving ferritin
      mutants
  - review: task-completion-validator PASS-WITH-FINDINGS
  verified_by:
  - EP6-REVIEW-GATE
- id: EP6-T3
  description: "tests/mutation.test.mjs + scripts/mutation-run.mjs: hand-rolled mutation\
    \ runner (D-5). Mutation-score baseline defined empirically in this task (OQ-4)\
    \ \u2014 measured over rules and facts, not guessed in advance."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP-5
  estimated_effort: 2.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T14:05:00Z'
  completed: '2026-07-21T15:20:00Z'
  evidence:
  - test: tests/mutation.test.mjs
  - note: OQ-4 baseline measured 457/457=1.0 after victim-set integration; 0 excluded;
      controls pass
  - review: task-completion-validator PASS-WITH-FINDINGS
  verified_by:
  - EP6-REVIEW-GATE
- id: EP6-T4
  description: "tests/dangerous-miss.test.mjs \u2014 encode ARC's 10 named families\
    \ (DM-CBC-001..DM-WORKFLOW-010) as executable fixtures against the real engine.\
    \ This phase owns the conversion; arc-clinical-council-adoption-v1.md P4-T1 consumes\
    \ these fixtures rather than re-deriving them."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP6-T2
  - EP-5
  estimated_effort: 2.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: medium
  started: '2026-07-21T15:30:00Z'
  completed: '2026-07-21T15:55:00Z'
  evidence:
  - test: tests/hazard-control-matrix.test.mjs
  - note: gap-fill not re-derivation; DM-HEME-002 regression pinned in testMarkers;
      zero-production-callers check made recursive + server.mjs
  - review: task-completion-validator PASS-WITH-FINDINGS
  verified_by:
  - EP6-REVIEW-GATE
- id: EP6-T5
  description: 'Dangerous-miss adversarial review: ''what would this engine miss that
    harms a child?'' Independent adversarial review of EP6-T4''s fixtures plus the
    full rule/candidate set for gaps the 10 named families don''t cover. Highest-stakes
    reasoning gate in the whole plan.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP6-T4
  estimated_effort: 1.0 pt
  priority: critical
  assigned_model: fable
  model_effort: max
  started: '2026-07-21T16:00:00Z'
  completed: '2026-07-21T17:00:00Z'
  evidence:
  - report: .claude/findings/wave0-ep6-validation-corpus-findings.md
  - test: tests/dangerous-miss-ep6.test.mjs
  - note: 19 findings (5 critical) from 3 blind fable lenses; D-4 not_executed_owner_held;
      none fixed per no-AI-rule-changes guardrail
  - review: task-completion-validator PASS-WITH-FINDINGS
  verified_by:
  - EP6-REVIEW-GATE
parallelization:
  batch_1:
  - EP6-T1
  - EP6-T2
  - EP6-T3
  batch_2:
  - EP6-T4
  batch_3:
  - EP6-T5
  critical_path:
  - EP6-T2
  - EP6-T4
  - EP6-T5
  estimated_total_time: 4.5 pts (critical path)
blockers: []
success_criteria:
- id: SC-1
  description: All 4 new test files (property, boundary, mutation, dangerous-miss)
    green
  status: met
- id: SC-2
  description: Mutation-score baseline defined from a real measurement run and met
    (EP6-T3, OQ-4)
  status: met
- id: SC-3
  description: All 10 ARC-named dangerous-miss families pass as executable fixtures
    (EP6-T4)
  status: met-with-recorded-exception
  disposition: "8 of 10 families are behaviorally executable against the real engine.\
    \ DM-EQUITY-009 and DM-WORKFLOW-010 are honestly recorded no_control_exists \u2014\
    \ no engine exists for either family (they would require a subgroup/equity evaluator\
    \ and an alert-lifecycle state machine, neither of which exists in this stateless\
    \ codebase). Fabricating a control to reach a cosmetic 10/10 would hide two unmitigated\
    \ patient-safety hazards behind a passing test. See .claude/findings/wave0-ep6-validation-corpus-findings.md\
    \ and the EP-6 amendment in the phase plan Quality Gates section."
- id: SC-4
  description: Dangerous-miss adversarial review complete; result honestly recorded
    as not_executed_owner_held for the credentialed-sign-off half of the V1 gate (EP6-T5)
  status: met
- id: SC-5
  description: Zero new dependencies, or exactly one recorded per D-5 (EP6-T1, EP6-T3)
  status: met
- id: SC-6
  description: npm run check green
  status: met
- id: SC-7
  description: task-completion-validator sign-off
  status: met
files_modified:
- tests/property.test.mjs
- tests/boundary.test.mjs
- tests/mutation.test.mjs
- tests/mutation-baseline.json
- scripts/mutation-run.mjs
- tests/dangerous-miss-ep6.test.mjs
- tests/hazard-control-matrix.test.mjs
- docs/safety/hazard-control-matrix.json
- .claude/findings/wave0-ep6-validation-corpus-findings.md
- package.json
updated: '2026-07-21'
progress: 100
---

# wave0-safety-foundation - Phase 6: Adversarial Validation Corpus

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/wave0-safety-foundation/phase-6-progress.md -t EP6-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Prove the whole substrate against a manifest-verified KB (WP6): property, boundary, mutation, and dangerous-miss suites where today only 20 example-driven subtests exist, with the 10 ARC-named dangerous-miss families converted into this repo's own executable fixtures. Depends on EP-5 complete — running these suites against an unverified KB would leave the fail-closed paths untested.

---

## Cross-Plan Dependency (Risk 5)

`arc-clinical-council-adoption-v1.md` P4-T1 converts the same `DM-CBC-001..DM-WORKFLOW-010` families into non-patient synthetic scenario specs. **This phase (EP6-T4) owns the executable-fixture conversion** — EP-6 is where the fixtures must actually run against the real engine. The ARC Adoption plan's P4-T1 consumes EP6-T4's fixtures rather than re-deriving them; both plans record this edge in `related_documents`.

---

## Implementation Notes

### Architectural Decisions

- EP6-T1, EP6-T2, EP6-T3 have no mutual dependency (all three gate only on EP-5 completing) and dispatch as one batch — the only ordering constraint is that EP6-T4 needs EP6-T2 (boundary suite) landed first.
- EP6-T5 (dangerous-miss adversarial review) is routed `fable` at `max` effort — the second and last of the plan's exactly-two `fable` uses. It does not close the roadmap's "dangerous-miss review by a clinical advisor signs off" V1 criterion; that half stays `not_executed_owner_held` per D-4 — ARC/adversarial review is not a credentialed clinical sign-off.

### Patterns and Best Practices

- D-5 reminder: `property.test.mjs` (EP6-T1) and `mutation.test.mjs`/`mutation-run.mjs` (EP6-T3) are both tempting places to reach for a dependency (`fast-check`, Stryker). Default is hand-rolled against `node:test` with seeded deterministic generators; any dependency needs a written rationale, never a silent default.

### Known Gotchas

- OQ-4's mutation-score baseline must come from a real measurement run in EP6-T3, not be guessed or backfitted to whatever number the first run happens to produce — watch for a baseline being quietly set low enough to be decorative.
- EP6-T5's output must be an explicit "no gap found, here is what I probed" statement or a filed, owned follow-up — silence is not an acceptable result.

### Development Setup

No new dependencies expected (D-5). All 4 suites are first-of-kind in this repo — no prior art to copy from an existing test file.

---

## Completion Notes

### Mutation-score baseline (EP6-T3, OQ-4) — measured, not asserted

**Baseline: 457/457 viable mutants killed → score 1.0**, 0 excluded as non-viable. Recorded in
`tests/mutation-baseline.json`; `tests/mutation.test.mjs` gates on `score >= baseline`.

**Measurement method.** `scripts/mutation-run.mjs` is bespoke `node:test` tooling (D-5: no Stryker, no
dependencies). It enumerates mutation operators deterministically over `modules/anemia/rules.json`
(operator flips, numeric perturbation, condition deletion, `all`↔`any`, output drops, severity changes)
and `facts.anemia.js` / `ranges.js` (boundary perturbation, comparison flips). Each mutant is applied to
a **throwaway sandbox under `os.tmpdir()` — never the working tree** — and a targeted 10-file victim
suite runs there as a real subprocess; a mutant is killed iff that command exits non-zero.

**Why the number moved.** The first real run measured **431/457 (0.9431) with 26 survivors**. Every
survivor was a *derived* numeric boundary in `facts.anemia.js`/`ranges.js`. That was an artifact of
concurrency: EP6-T1 and EP6-T3 were authored in parallel and blind to each other, so the victim set
predated `tests/boundary.test.mjs` — the suite purpose-built to pin exactly those boundaries. Adding
`boundary.test.mjs` and `property.test.mjs` to the victim set → **454/457**.

The 3 that still survived were the ferritin 20/30 ng/mL thresholds — the exact example the phase plan
names for FR-WP6-02. Root cause was a test-design trap: the Group 3 ferritin cases read their expected
value at runtime from the source under test, so a mutated threshold mutates the expectation with it,
leaving the case structurally blind to the *value* while still verifying the *comparison*. Runtime KB
reads are correct for reference-range **data** and wrong for the clinical value that is itself the claim
under test. Group 6 threshold-value pinning (with `AAP2026_IDA` citations) closed it → **457/457**.
Verified independently of the runner's own controls by injecting a live 20→21 defect into `ranges.js`
and confirming `PIN-FERRITIN-YOUNG-SCHOOL` catches it.

**Honesty boundary (recorded in the generator, so it survives re-measurement).** A score of 1.0 means
every mutant *this runner's finite, hand-enumerated operator set* generates is killed by the victim
suite. It is **not** evidence of clinical validity, KB correctness, or diagnostic performance, and
defect classes outside `operatorInventory` are unmeasured by construction. Anti-vacuity is enforced by a
lethal control (must be killed), an inert control (must be classified non-viable), and a
sandbox-fidelity self-check that fails loudly if the *pristine* sandbox fails a victim test — the one
failure mode that would otherwise report a false 100%.

### Dangerous-miss adversarial review (EP6-T5) — findings found, none fixed

**Not a none-found result. 19 findings, 5 critical.** Full register:
`.claude/findings/wave0-ep6-validation-corpus-findings.md` (EP6T5-001 … EP6T5-019).

Method: three independent adversarial lenses (`fable`), blind to each other — falsely-reassuring
clinical output, missingness/fail-closed integrity, structural and coverage absence. Every
high-severity finding was reproduced by the orchestrator against the real engine before being recorded.

Critical: raw WBC/ANC/platelet counts are inert (0 rule references, no built-in bands) so pancytopenia
with fever returns zero alerts — found independently by all three lenses; the SPA submits every
untouched checkbox as confirmed-absent, defeating the tri-state invariant at the input boundary; a
malformed local range coerces to 0 so Hb 5.0 g/dL reports "no anemia"; the severe-anemia alert is
suppressed when `sexAtBirth` is absent; a classic acute-leukemia presentation returns an empty
assessment.

**Nothing was fixed.** These are KB/rule-level defects and the repository guardrail forbids
AI-published rule changes — they require independent clinical review, executable tests, and a signed
release. EP-6's criterion is a *filed, owned follow-up*, which the register provides, with the clinical
questions stated explicitly rather than answered. `tests/dangerous-miss-ep6.test.mjs` adds 23
disclosed-gap pins asserting current behavior **including where it is wrong**, each with a non-vacuity
control, so none can drift silently.

**D-4: `not_executed_owner_held`.** This is an adversarial software review, not credentialed clinical
sign-off. It informs the roadmap's V1 "dangerous-miss review by a clinical advisor" criterion; it does
not satisfy it. `clinicalApprovers[]` / `approvedBy[]` remain empty.

### Reviewer gate (SC-7)

Independent `task-completion-validator` pass: **PASS-WITH-FINDINGS**. Both required fixes applied —
success-criteria dispositions and completion notes recorded here, and the EP6-T4 re-scope amended into
the phase plan's Quality Gates section so it is visible in the plan itself rather than only in commit
messages. The reviewer independently confirmed the mutation harness is genuine (real subprocesses,
honest empty exclusion list), the 8/10 DM resolution is sound on the merits, and the disclosed-gap pin
framing cannot be mistaken for approval.
