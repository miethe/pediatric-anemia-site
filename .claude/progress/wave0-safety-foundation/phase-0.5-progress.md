---
type: progress
schema_version: 2
doc_type: progress
prd: wave0-safety-foundation
feature_slug: wave0-safety-foundation
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
phase_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-0.5-activation-witness-corpus.md
execution_model: batch-parallel
plan_structure: independent
phase: 0.5
title: 'EP-0.5: Activation-Witness Corpus'
status: completed
started: 2026-07-19T00:00Z
completed: 2026-07-19T00:00Z
commit_refs:
- 7aa89cc
- 526281a
- 7bf2bc6
- b84a598
pr_refs: []
overall_progress: 100
completion_estimate: on-track
total_tasks: 6
completed_tasks: 6
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors: []
model_usage:
  primary: sonnet
  external:
  - fable
  - gpt-5.6-sol (codex exec)
  - haiku
tasks:
- id: EP05-T1
  description: 'Build the coverage instrument: scripts/rule-coverage.mjs with --json
    and --min ratchet; establish the witness-corpus harness under tests/witness/.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies: []
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: medium
  started: 2026-07-19T00:00Z
  completed: 2026-07-20T02:23Z
  verified_by:
  - EP05-T5
  evidence:
  - commit: b84a598
- id: EP05-T2
  description: Author minimal witness fixtures for the blind non-alert rules (candidate/note/question)
    so every reachable rule appears in some fixture's matchedRuleIds.
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP05-T1
  estimated_effort: 3.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: 2026-07-19T00:00Z
  completed: 2026-07-20T02:23Z
  verified_by:
  - EP05-T5
  evidence:
  - commit: b84a598
- id: EP05-T3
  description: Witness the 6 uncovered ALERT rules (ALERT-001/-002/-003/-006/-007/-008)
    plus SCOPE-001/-002/-003, asserting severity and output type, not merely firing.
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP05-T1
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: 2026-07-19T00:00Z
  completed: 2026-07-20T02:23Z
  verified_by:
  - EP05-T5
  evidence:
  - commit: b84a598
- id: EP05-T4
  description: 'Close the M57 class: pin the modules/anemia/ranges.js ferritin-threshold
    decision branches, verified by executing the mutation and observing failure.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP05-T1
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: fable
  model_effort: xhigh
  started: 2026-07-19T00:00Z
  completed: 2026-07-20T02:23Z
  verified_by:
  - EP05-T5
  evidence:
  - commit: b84a598
- id: EP05-T5
  description: Adversarial clinical-coherence review of every fixture authored in
    T2-T4 (coherence only, explicitly NOT clinical validation).
  status: completed
  assigned_to:
  - code-reviewer
  dependencies:
  - EP05-T2
  - EP05-T3
  - EP05-T4
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: gpt-5.6-sol (codex exec)
  model_effort: high
  started: 2026-07-19T00:00Z
  completed: 2026-07-20T02:23Z
  verified_by:
  - EP05-T5-CONFIRM
  evidence:
  - commit: b84a598
- id: EP05-T6
  description: Wire the rule-coverage --min ratchet into npm run check and the CI
    verify job, pinned at the achieved level.
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP05-T5
  estimated_effort: 0.5 pts
  priority: medium
  assigned_model: haiku
  model_effort: low
  started: 2026-07-19T00:00Z
  completed: 2026-07-20T02:23Z
  verified_by:
  - EP05-T6-negative-test
  evidence:
  - commit: b84a598
parallelization:
  batch_1:
  - EP05-T1
  batch_2:
  - EP05-T2
  - EP05-T3
  - EP05-T4
  batch_3:
  - EP05-T5
  batch_4:
  - EP05-T6
success_criteria:
- id: SC-1
  description: scripts/rule-coverage.mjs exists, is negative-tested, and reports the
    baseline correctly
  status: completed
- id: SC-2
  description: Every reachable rule in modules/anemia/rules.json has an activation
    witness; any unreachable rule is documented with rationale
  status: completed
- id: SC-3
  description: All 6 previously-uncovered ALERT rules fire, with severity and output
    type asserted
  status: completed
- id: SC-4
  description: The M57 mutation now fails the suite, verified by execution
  status: completed
- id: SC-5
  description: No new or retuned clinical thresholds introduced by any fixture
  status: completed
- id: SC-6
  description: Coverage ratchet wired into npm run check and CI
  status: completed
- id: SC-7
  description: npm run check green; reviewer sign-off recorded
  status: completed
progress: 100
updated: '2026-07-19'
---

# Phase EP-0.5 Progress — Activation-Witness Corpus

## Orchestration decisions (recorded at phase start)

### D1 — Coverage target is the full rule base, not the lost 49-row table

The phase plan's exit criterion names "the 49 rules in SPIKE-003's migration table." That table was
preserved only at a machine-local scratch path (`/Users/miethe/.claude/jobs/fc2ff3fd/tmp/migration-table-raw.txt`),
which no longer exists — the exact failure mode the EP-0 reviewer flagged (§4.2 of the AAR).

Re-deriving "49" from the SPIKE's prose is ambiguous: a naive derivation over boolean-valued fact
paths yields 88, not 49, because it cannot distinguish input-side collapse fields from derived
booleans. Rather than reconstruct a contested number, this phase targets **every reachable rule in
`modules/anemia/rules.json` (91)** — a strict superset of any reading of the 49. The migration set
becomes a non-issue by construction, and the artifact this time is a committed script, not a scratch file.

### D2 — Witness fixtures live in `tests/witness/`, never in `examples/`

`examples/*.json` is a **published surface**: `scripts/build-static.mjs` copies it into `dist/`, and
`src/app.js:496` fetches it for the clinician-facing example picker. Adding ~25 synthetic witness
patients to `examples/` would ship them to the microsite as if they were curated worked examples.
Witness fixtures are test-only inputs and live under `tests/witness/`.

### D3 — Routing

`delegation-router` resolved T2/T3/T6 as ICA-offload-eligible (`ica-executor`, free/shared pool).
Offload was **declined** for this phase: EP-0.5 is the project's safety substrate, the fixtures encode
clinical-input judgment, and correctness dominates cost here. The cross-family lens is spent where it
has the most value instead — T5's adversarial coherence review on `gpt-5.6-sol` via `codex exec`.
T5's own chain resolution (`gemma-4-26b-a4b-it`) was overridden by the plan-specified model.

## Review record

Two adversarial coherence-review rounds ran on `gpt-5.6-sol` via `codex exec`, each split into
bounded reading legs (the EP-0 AAR recorded a `sol` failure on an oversized prompt).

| Round | Scope | Verdict | Outcome |
|---|---|---|---|
| 1 | corpus (leg A) + alerts/branches (leg B) | CHANGES-REQUIRED (both legs), 11 must-fix | All adjudicated; fixes in `7bf2bc6` |
| 2 | confirmation of round-1 fixes + the new ratchet | CHANGES-REQUIRED, 6 findings | All adjudicated; fixes in the round-2 commit |

Round 2 found that the round-1 fix was itself incomplete: `ALERT-006` has **three** `any` arms, not
the two the fix isolated, so `symptoms.neurologicSymptoms` was still unwitnessed while the notes
claimed one-per-arm coverage. Verified by execution — deleting that arm leaves
`npm run coverage:rules` reporting a passing 91/91, because the rule still fires off the other arms.
Only the new per-arm test catches it.

**Sign-off is coherence review only.** Neither round is clinical validation, clinical sign-off, or
credentialed review, and no output of this phase may be represented as such. `clinicalApprovers[]`
and `approvedBy[]` remain unset and require named humans.

## Task Log

All 6 tasks completed. Commits: `7aa89cc` (T1), `526281a` (T2/T3/T4 + test-glob fix),
`7bf2bc6` (T5 round-1 fixes), `b84a598` (T6 ratchet), plus the round-2 review fixes.

Coverage: **30/91 → 91/91**. Test suite: 145 → 207 executing tests.
