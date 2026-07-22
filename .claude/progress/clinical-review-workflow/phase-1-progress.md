---
type: progress
schema_version: 2
doc_type: progress
prd: clinical-review-workflow
feature_slug: clinical-review-workflow
prd_ref: docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
execution_model: batch-parallel
phase: 1
title: "Clinical Review Workflow v1 — Phase 1: Derived Status & Scaffold Ergonomics"
status: pending
created: '2026-07-22'
updated: '2026-07-22'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 7
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- Explore
- task-completion-validator
- codex-gpt-5.6-terra
model_usage:
  primary: sonnet
  external: [gpt-5.6-terra]
tasks:
- id: P1-T1
  description: "Extract shared derived-state library (FR-2, R2). Explore recons validate's\
    \ existing release-authorization evaluator; extract its logic into new tools/review-record/lib/derived-state.mjs\
    \ (exported computeDerivedReviewState); refactor lib/verbs/validate.mjs to import\
    \ and call it — no output-shape change to validate's existing behavior."
  status: pending
  assigned_to: [general-purpose, Explore]
  dependencies: []
  estimated_effort: "1.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tools/review-record/lib/derived-state.mjs
  - tools/review-record/lib/verbs/validate.mjs
  - tests/ef-review-workflow.test.mjs
  acceptance_criteria: "tests/ef-review-workflow.test.mjs and tests/ef-review-adjudication.test.mjs\
    \ pass unchanged; new grep test asserts lib/verbs/validate.mjs contains zero duplicated\
    \ derived-state logic."
- id: P1-T2
  description: "status verb + frozen --json shape (FR-1, OQ-2). Add status to cli.mjs\
    \ dispatch + new tools/review-record/lib/verbs/status.mjs, consuming P1-T1's library.\
    \ Frozen --json shape: { moduleId, subjectContentHash, records[], derivedState,\
    \ nextExpectedRole }. Human-readable default output names the next-expected role\
    \ or terminal state."
  status: pending
  assigned_to: [general-purpose]
  dependencies: [P1-T1]
  estimated_effort: "1.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tools/review-record/cli.mjs
  - tools/review-record/lib/verbs/status.mjs
  - tests/ef-review-workflow.test.mjs
  acceptance_criteria: "status --module cbc_suite_v1 --json output validates against a\
    \ committed JSON-shape fixture; human output names next-expected role/terminal state;\
    \ --help lists status."
- id: P1-T3
  description: "Scaffold ergonomics: auto-derived subject + real-identity write path\
    \ (FR-3/4/5, R7/R8). (a) --subject becomes optional on scaffold; when omitted, derive\
    \ via lib/subject.mjs's computeModuleContentHash (same function dry-run already uses).\
    \ (b) scaffold writes a schema-valid record (signature: null) for a synthetic: false\
    \ roster entry, exercised only against a new fixture roster — governance/reviewer-roster.yaml\
    \ itself is never read/written by this task's tests."
  status: pending
  assigned_to: [general-purpose]
  dependencies: []
  estimated_effort: "1.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tools/review-record/lib/verbs/scaffold.mjs
  - tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml
  - tests/ef-review-workflow.test.mjs
  acceptance_criteria: "scaffold without --subject on cbc_suite_v1 produces a byte-identical\
    \ subjectContentHash to dry-run's auto-derivation (R8 test); scaffold against the fixture\
    \ roster's one synthetic: false entry writes a file with signature: null; scaffold against\
    \ the real governance/reviewer-roster.yaml is behaviorally unchanged; a diff-check asserts\
    \ zero writes to governance/reviewer-roster.yaml by any test in this task."
- id: P1-T4
  description: "Drift guard + independence-unchanged tests (R2/R3/R7/R8, FR-24). Add a\
    \ drift test comparing status --json's derivedState to validate's evaluator result\
    \ on (a) the committed cbc_suite_v1 fixture, (b) a chain-broken adversarial fixture,\
    \ (c) a disputed adversarial fixture. Assert chain_isolation_v1 and nextChainLink\
    \ remain untouched. Grep-assert zero diff to ADR-0004's status field and to governance/reviewer-roster.yaml."
  status: pending
  assigned_to: [general-purpose]
  dependencies: [P1-T1, P1-T2, P1-T3]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - tests/ef-review-workflow.test.mjs
  - tests/fixtures/clinical-review-workflow/
  acceptance_criteria: "3/3 drift-comparison fixtures agree between status and validate;\
    \ chain_isolation_v1 stays green; ADR-status and roster-content grep checks pass."
- id: P1-T5
  description: "Adjudication conditional-completeness reconciliation (FR-26, R2/R7, F2) —\
    \ governance-sensitive. Update computeDerivedReviewState (P1-T1) and\
    \ evaluateReleaseAuthorization (lib/adjudication.mjs) so a release-auth record's\
    \ completeness check requires the adjudication role IFF the resolved clinical-1 and\
    \ clinical-2 decision fields disagree; on documented agreement, the four remaining roles\
    \ (clinical-1, clinical-2, lab, release-auth) are sufficient. Encodes ADR-0004 decision\
    \ item 5 into code — does NOT touch ADR-0004's status field (stays proposed, G0). Flagged\
    \ for the P1 validator gate + codex per-wave review as a governance-sensitive behavior\
    \ change."
  status: pending
  assigned_to: [general-purpose]
  dependencies: [P1-T1]
  estimated_effort: "1.0 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  governance_sensitive: true
  target_surfaces:
  - tools/review-record/lib/adjudication.mjs
  - tools/review-record/lib/derived-state.mjs
  - tests/ef-review-adjudication.test.mjs
  acceptance_criteria: "Fixtures on BOTH paths: an agree-path five-record set MINUS\
    \ adjudication evaluates as complete (no missing-role blocker); a disagree-path set\
    \ MINUS adjudication reports the adjudication-missing blocker; the committed cbc_suite_v1\
    \ dry-run fixture's existing terminal behavior is unchanged; a grep test confirms\
    \ ADR-0004 status is untouched."
- id: P1-GATE1
  description: "task-completion-validator gate: verify Phase 1 exit gate — status\
    \ --json matches validate's derived semantics on the committed cbc_suite_v1 set + 2\
    \ adversarial fixtures; zero new runtime dependencies; explicitly re-check FR-26's\
    \ governance-sensitive adjudication change against ADR-0004 decision item 5 on both\
    \ agree/disagree paths; npm run check green."
  status: pending
  assigned_to: [task-completion-validator]
  dependencies: [P1-T1, P1-T2, P1-T3, P1-T4, P1-T5]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: P1-GATE2
  description: "codex gpt-5.6-terra read-only second-opinion diff review of the full P1\
    \ changeset against decisions block R2/R3/R7/R8 and PRD FR-1..5/FR-24 — no write\
    \ access; flags any fail-closed gap or drift risk missed by the automated suite."
  status: pending
  assigned_to: ["codex (read-only)"]
  dependencies: [P1-GATE1]
  estimated_effort: "—"
  priority: high
  assigned_model: gpt-5.6-terra
  model_effort: high
  acceptance_criteria: "Review recorded; any flagged gap becomes a task before Phase 2 opens."

parallelization:
  batch_1: [P1-T1, P1-T3]
  batch_2: [P1-T2, P1-T5]
  batch_3: [P1-T4]
  batch_4: [P1-GATE1]
  batch_5: [P1-GATE2]
  critical_path: [P1-T1, P1-T2, P1-T4, P1-GATE1, P1-GATE2]
  estimated_total_time: "~2 engineer-days"

blockers: []

success_criteria:
- id: SC-1
  description: "status --json matches validate's derived semantics on cbc_suite_v1 + 2 adversarial fixtures"
  status: pending
- id: SC-2
  description: "Zero new runtime dependencies introduced"
  status: pending
- id: SC-3
  description: "npm run check green"
  status: pending
- id: SC-4
  description: "Reviewer-2 structural independence (chain_isolation_v1, nextChainLink) unchanged"
  status: pending

files_modified:
- tools/review-record/lib/derived-state.mjs
- tools/review-record/lib/verbs/status.mjs
- tools/review-record/lib/verbs/scaffold.mjs
- tools/review-record/lib/verbs/validate.mjs
- tools/review-record/lib/adjudication.mjs
- tools/review-record/cli.mjs
- tests/ef-review-workflow.test.mjs
- tests/ef-review-adjudication.test.mjs
- tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml
- tests/fixtures/clinical-review-workflow/

notes: "Wave 1 (no dependencies) — opens the critical path. Hard guardrails apply\
  \ verbatim (see .claude/worknotes/clinical-review-workflow/context.md). P1-T1's derived-state\
  \ library is the single source of truth P2/P3 both consume — do not fork the logic.\
  \ Revision 1 added P1-T5 (FR-26 adjudication conditional-completeness reconciliation) —\
  \ governance-sensitive: touches lib/adjudication.mjs's completeness policy without ratifying\
  \ ADR-0004; flagged for both P1-GATE1 and P1-GATE2 review."
---

# clinical-review-workflow — Phase 1: Derived Status & Scaffold Ergonomics

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/clinical-review-workflow/phase-1-progress.md -t P1-T1 -s in_progress
```

---

## Objective

Ship a derived `status` verb (backed by a new shared `lib/derived-state.mjs`) plus scaffold
ergonomics (auto-derived `subjectContentHash`, real-identity write path against a fixture
roster only) — the foundation Phase 2 (sign/validate-cache), Phase 3 (render/runbook), and
Phase 4 (portal-promotion framework) all build on. No portal, no real signing, no roster
changes. **Revision 1** adds P1-T5: a governance-sensitive reconciliation of `lib/adjudication.mjs`'s
completeness policy against ADR-0004 decision item 5 (adjudication required only on
clinical-1/clinical-2 disagreement). See PRD FR-1..5/FR-24/FR-26 and decisions block §3 risks
R2/R3/R7/R8.

**Duration**: ~2 engineer-days · **Dependencies**: None (wave 1) · **Exit gate**:
`status --json` matches `validate`'s derived semantics on the committed `cbc_suite_v1` set +
2 adversarial fixtures; FR-26 adjudication policy passes on both agree/disagree fixtures; zero
new runtime dependencies; `npm run check` green.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Status | Dependencies |
|---------|------|-----------------------|---------------|--------|---------------|
| P1-T1 | Extract shared derived-state library | general-purpose, Explore | sonnet/adaptive | pending | none |
| P1-T2 | `status` verb + frozen `--json` shape | general-purpose | sonnet/adaptive | pending | P1-T1 |
| P1-T3 | Scaffold ergonomics (auto-subject + real-identity write path) | general-purpose | sonnet/adaptive | pending | none |
| P1-T4 | Drift guard + independence-unchanged tests | general-purpose | sonnet/adaptive | pending | P1-T1, P1-T2, P1-T3 |
| P1-T5 | Adjudication conditional-completeness reconciliation (FR-26, governance-sensitive) | general-purpose | sonnet/extended | pending | P1-T1 |
| P1-GATE1 | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | pending | P1-T1..T5 |
| P1-GATE2 | codex `gpt-5.6-terra` read-only second-opinion | codex (read-only) | gpt-5.6-terra/high | pending | P1-GATE1 |

---

## Orchestration Quick Reference

### Batch 1 (parallel — no dependencies)

```
Task("general-purpose", "P1-T1: Extract shared derived-state library (FR-2, R2). Explore
recons validate's existing release-authorization evaluator; extract into new
tools/review-record/lib/derived-state.mjs (exported computeDerivedReviewState); refactor
lib/verbs/validate.mjs to import and call it, zero output-shape change. AC: existing tests
pass unchanged; grep test asserts zero duplicated derived-state logic in validate.mjs. See
plan §Phase 1, P1-T1.")

Task("general-purpose", "P1-T3: Scaffold ergonomics (FR-3/4/5, R7/R8). Make --subject
optional on scaffold (auto-derive via lib/subject.mjs computeModuleContentHash, same as
dry-run); make scaffold write a schema-valid signature:null record for a synthetic:false
roster entry, tested ONLY against a new fixture roster
tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml — never read/write the
real governance/reviewer-roster.yaml. See plan §Phase 1, P1-T3.")
```

### Batch 2 (after P1-T1)

```
Task("general-purpose", "P1-T2: status verb + frozen --json shape (FR-1, OQ-2). Add status
to cli.mjs dispatch + new lib/verbs/status.mjs consuming P1-T1's derived-state library.
Freeze --json shape: { moduleId, subjectContentHash, records[], derivedState,
nextExpectedRole }. Human output names next-expected role/terminal state. See plan §Phase 1,
P1-T2.")

Task("general-purpose", "P1-T5: Adjudication conditional-completeness reconciliation (FR-26,
R2/R7, F2) — GOVERNANCE-SENSITIVE. Update computeDerivedReviewState (P1-T1) and
evaluateReleaseAuthorization (lib/adjudication.mjs) so a release-auth record's completeness
check requires the adjudication role IFF clinical-1 and clinical-2 decisions disagree; on
agreement, the four remaining roles suffice. Encodes ADR-0004 decision item 5 into code —
does NOT edit ADR-0004's status field (stays proposed, G0). Fixture-test BOTH the agree path
(adjudication-optional) and disagree path (adjudication-required). This task is explicitly
flagged for extra scrutiny at P1-GATE1 and the codex P1-GATE2 review. See plan §Phase 1,
P1-T5.")
```

### Batch 3 (after P1-T1, P1-T2, P1-T3)

```
Task("general-purpose", "P1-T4: Drift guard + independence-unchanged tests (R2/R3/R7/R8,
FR-24). Add drift test comparing status --json's derivedState to validate's evaluator on
3 fixture classes (committed, chain-broken, disputed). Assert chain_isolation_v1 and
nextChainLink untouched. Grep-assert zero diff to ADR-0004 status and reviewer-roster.yaml.
See plan §Phase 1, P1-T4.")
```

### Gates (after all tasks complete)

```
Task("task-completion-validator", "P1-GATE1: Verify Phase 1 exit gate for
clinical-review-workflow — status --json matches validate's derived semantics on
cbc_suite_v1 + 2 adversarial fixtures; zero new runtime deps; explicitly re-check P1-T5's
FR-26 governance-sensitive adjudication change against ADR-0004 decision item 5 on both
agree/disagree paths; npm run check green.")
```

codex `gpt-5.6-terra` read-only second-opinion (not a `Task()` subagent call — invoke via the
`codex` skill, read-only diff mode, after P1-GATE1 passes):

```
codex exec --read-only "Diff-review the full Phase 1 changeset for clinical-review-workflow
against decisions block R2/R3/R7/R8 and PRD FR-1..5/FR-24/FR-26..29. Flag any fail-closed gap
or drift risk the automated suite missed. Specifically scrutinize P1-T5's FR-26
adjudication-policy change (governance-sensitive) for fail-closed gaps."
```

### Status updates

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/clinical-review-workflow/phase-1-progress.md -t P1-T1 -s completed
```

---

## Implementation Notes

### Architectural Decisions

`lib/derived-state.mjs` is the single source of truth for review-chain state — `status` and
`validate` both call it; no duplicated logic (R2). This is the seam Phase 2's `sign` and
incremental `validate` cache, and Phase 3's render queue section, all consume.

### Known Gotchas

- `--subject` auto-derivation MUST byte-match `dry-run`'s existing `computeModuleContentHash`
  call (R8) — do not reimplement.
- The real-identity write-path test in P1-T3 is fixture-roster-only; a stray test pointed at
  the real `governance/reviewer-roster.yaml` is a hard guardrail violation.
- `nextChainLink`'s single-file-touch semantics (reviewer-2 structural independence, FR-24)
  must not be touched by any scaffold/status change.
- P1-T5 (Revision 1 addition) touches `lib/adjudication.mjs`'s completeness policy — a
  governance-sensitive file. It encodes ADR-0004 decision item 5 (adjudication required only
  on clinical-1/clinical-2 disagreement) but must NOT edit ADR-0004's own `status` field; both
  the agree-path and disagree-path fixtures are required, not just one.

---

## Completion Notes

Summary of phase completion (fill in when phase is complete):

- What was built
- Key learnings
- Unexpected challenges
- Recommendations for Phase 2/3/4
