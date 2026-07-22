---
type: progress
schema_version: 2
doc_type: progress
prd: clinical-review-workflow
feature_slug: clinical-review-workflow
prd_ref: docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
execution_model: sequential
phase: 2
title: "Clinical Review Workflow v1 — Phase 2: Sign Verb & Validate Performance"
status: pending
created: '2026-07-22'
updated: '2026-07-22'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 6
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
- codex-gpt-5.6-terra
model_usage:
  primary: sonnet
  external: [gpt-5.6-terra]
tasks:
- id: P2-T1
  description: "sign verb, TESTKEY-only synthetic path (FR-6, OQ-1). Add sign to cli.mjs\
    \ + new tools/review-record/lib/verbs/sign.mjs. On a synthetic: true record with\
    \ signature: null, call lib/signature.mjs's signRecordDryRun (ephemeral in-memory\
    \ Ed25519, TESTKEY- prefix, key discarded on return). OQ-1 resolved: TESTKEY-only;\
    \ no --keyfile seam in this feature."
  status: pending
  assigned_to: [general-purpose]
  dependencies: ["P1-GATE2 (Phase 1 complete)"]
  estimated_effort: "1.0 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tools/review-record/cli.mjs
  - tools/review-record/lib/verbs/sign.mjs
  acceptance_criteria: "sign --record rr-0001-clinical-1 on a synthetic fixture round-trips\
    \ against validate (chain-link + signature-verify pass); --help lists sign."
- id: P2-T2
  description: "sign fail-closed refusal + no-keyfile grep (FR-7/23, R1). sign refuses\
    \ synthetic: false records with a message naming both G1 (roster verification) and\
    \ G2 (offline key custody + ceremony, ADR-0005); refuses --keyfile/--key/--test-keys/env-var\
    \ key paths for any input. Static grep test proves zero key-reading code under\
    \ tools/review-record/."
  status: pending
  assigned_to: [general-purpose]
  dependencies: [P2-T1]
  estimated_effort: "1.0 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tools/review-record/lib/verbs/sign.mjs
  - tests/ef-review-record-cli.test.mjs
  acceptance_criteria: "sign on a synthetic: false fixture exits non-zero with a message\
    \ containing both G1 and G2; grep test finds zero fs.readFile/env-var key-path calls\
    \ in lib/verbs/sign.mjs."
- id: P2-T3
  description: "Incremental validate cache (FR-8, R9). New tools/review-record/lib/validate-cache.mjs;\
    \ validate --record <id>/--module reuses previously computed per-record results (schema\
    \ shape, roster resolution, signature verification, that record's chain-link check)\
    \ when its canonical content hash and its immediate predecessor's are both unchanged.\
    \ Module-wide checks (authorship-union, independence heuristic, release-authorization\
    \ evaluation) always re-run over the full set — never cache-eligible."
  status: pending
  assigned_to: [general-purpose]
  dependencies: [P1-T1, P2-T1]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tools/review-record/lib/validate-cache.mjs
  - tools/review-record/lib/verbs/validate.mjs
  acceptance_criteria: "Cache-warm validate --record reuses per-record results (asserted via\
    \ an instrumentation call-count hook, not wall-clock alone); module-wide checks re-run\
    \ on every invocation regardless of cache state."
- id: P2-T4
  description: "Fail-closed stale-cache + --history union + microbenchmark (FR-9/10, R5,\
    \ OQ-6). Cache keyed on canonical content hash: any key mismatch, unexplained mtime skew,\
    \ or parse failure triggers full recompute — never a stale pass. Dedicated adversarial\
    \ test seeds a stale cache with a bit-flip-tampered input and asserts full recompute +\
    \ validation error. validate --history results are never cached across invocations (OQ-6).\
    \ Author a repeatable microbenchmark script comparing cache-cold vs. cache-warm wall-time\
    \ on the committed 5-record cbc_suite_v1 set."
  status: pending
  assigned_to: [general-purpose]
  dependencies: [P2-T3]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tools/review-record/lib/validate-cache.mjs
  - tools/review-record/lib/verbs/validate.mjs
  - tools/review-record/lib/history.mjs
  - tests/ef-review-workflow.test.mjs
  acceptance_criteria: "Bit-flip stale-cache test triggers full recompute + error, not a pass;\
    \ a git-history mutation between two --history calls is caught on the second call;\
    \ microbenchmark script committed, shows cache-warm measurably faster across 3 repeated\
    \ runs."
- id: P2-GATE1
  description: "task-completion-validator gate: verify Phase 2 exit gate — sign round-trips\
    \ against validate on the synthetic path and refuses fail-closed on the real path;\
    \ incremental validate wall-time is measurably reduced; stale-cache test proves\
    \ fail-closed; npm run check green."
  status: pending
  assigned_to: [task-completion-validator]
  dependencies: [P2-T1, P2-T2, P2-T3, P2-T4]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: P2-GATE2
  description: "codex gpt-5.6-terra read-only second-opinion diff review of the full P2\
    \ changeset against R1/R5/R9 and FR-6..10/23 — specifically hunts fail-closed gaps in\
    \ the sign-refusal and cache-staleness paths."
  status: pending
  assigned_to: ["codex (read-only)"]
  dependencies: [P2-GATE1]
  estimated_effort: "—"
  priority: high
  assigned_model: gpt-5.6-terra
  model_effort: high
  acceptance_criteria: "Review recorded; any flagged gap becomes a task before Phase 5 opens."

parallelization:
  batch_1: [P2-T1]
  batch_2: [P2-T2, P2-T3]
  batch_3: [P2-T4]
  batch_4: [P2-GATE1]
  batch_5: [P2-GATE2]
  critical_path: [P2-T1, P2-T3, P2-T4, P2-GATE1, P2-GATE2]
  estimated_total_time: "~2 engineer-days"

blockers: []

success_criteria:
- id: SC-1
  description: "sign round-trips against validate on the synthetic (TESTKEY) path"
  status: pending
- id: SC-2
  description: "sign refuses fail-closed on any synthetic: false record, naming G1 and G2"
  status: pending
- id: SC-3
  description: "Incremental validate wall-time measurably reduced vs. cache-cold"
  status: pending
- id: SC-4
  description: "Stale-cache adversarial (bit-flip) test proves fail-closed recompute"
  status: pending
- id: SC-5
  description: "npm run check green"
  status: pending

files_modified:
- tools/review-record/cli.mjs
- tools/review-record/lib/verbs/sign.mjs
- tools/review-record/lib/validate-cache.mjs
- tools/review-record/lib/verbs/validate.mjs
- tools/review-record/lib/history.mjs
- tests/ef-review-record-cli.test.mjs
- tests/ef-review-workflow.test.mjs

notes: "Wave 2 (parallel to Phase 4, both gated on Phase 1 only). Stays in-session — no ICA\
  \ offload for this phase (decisions block: fail-closed crypto-adjacent logic is taste/risk\
  \ work, single owner). P2 and P3 both write lib/verbs/validate.mjs — P3 is scheduled one\
  \ wave later (wave 3) specifically to avoid a concurrent write collision; this is a\
  \ mechanical scheduling fact, not a scope dependency (P3 does not depend on P2)."
---

# clinical-review-workflow — Phase 2: Sign Verb & Validate Performance

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/clinical-review-workflow/phase-2-progress.md -t P2-T1 -s in_progress
```

---

## Objective

Ship a gate-aware `sign` verb (TESTKEY-only synthetic path, hard fail-closed refusal on any
real-identity `synthetic: false` record pre-G1/G2) plus an incremental fail-closed `validate`
cache. See PRD FR-6..10/23 and decisions block §3 risks R1/R5/R9.

**Duration**: ~2 engineer-days · **Dependencies**: Phase 1 complete · **Exit gate**: `sign`
round-trips against `validate` on the synthetic path and refuses fail-closed on the real path;
incremental `validate` wall-time is measurably reduced; stale-cache test proves fail-closed;
`npm run check` green.

**Hard guardrail reminder (this phase is the highest-risk phase for it)**: no task signs a
`synthetic: false` record; `sign` refuses fail-closed pre-G1/pre-G2; zero new runtime
dependencies, zero network, zero LLM inside `tools/review-record/`.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Status | Dependencies |
|---------|------|-----------------------|---------------|--------|---------------|
| P2-T1 | `sign` verb, TESTKEY-only synthetic path | general-purpose | sonnet/extended | pending | Phase 1 complete |
| P2-T2 | `sign` fail-closed refusal + no-keyfile grep | general-purpose | sonnet/extended | pending | P2-T1 |
| P2-T3 | Incremental `validate` cache | general-purpose | sonnet/extended | pending | P1-T1, P2-T1 |
| P2-T4 | Fail-closed stale-cache + `--history` union + microbenchmark | general-purpose | sonnet/extended | pending | P2-T3 |
| P2-GATE1 | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | pending | P2-T1..T4 |
| P2-GATE2 | codex `gpt-5.6-terra` read-only second-opinion | codex (read-only) | gpt-5.6-terra/high | pending | P2-GATE1 |

---

## Orchestration Quick Reference

### Batch 1 (after Phase 1 complete)

```
Task("general-purpose", "P2-T1: sign verb, TESTKEY-only synthetic path (FR-6, OQ-1). Add
sign to cli.mjs + new lib/verbs/sign.mjs. On a synthetic:true record with signature:null,
call lib/signature.mjs's signRecordDryRun (ephemeral in-memory Ed25519, TESTKEY- prefix, key
discarded on return). No --keyfile seam. AC: sign round-trips against validate on a synthetic
fixture; --help lists sign. See plan §Phase 2, P2-T1.")
```

### Batch 2 (after P2-T1)

```
Task("general-purpose", "P2-T2: sign fail-closed refusal + no-keyfile grep (FR-7/23, R1).
sign must refuse synthetic:false records with a message naming BOTH 'G1' and 'G2'; refuse
--keyfile/--key/--test-keys/env-var key paths for any input. Add a static grep test proving
zero key-reading code exists in lib/verbs/sign.mjs. See plan §Phase 2, P2-T2.")

Task("general-purpose", "P2-T3: Incremental validate cache (FR-8, R9). New
lib/validate-cache.mjs; validate --record/--module reuses per-record results (schema shape,
roster resolution, signature verification, chain-link check) when the record's canonical
content hash and its predecessor's are unchanged. Module-wide checks (authorship-union,
independence heuristic, release-authorization) always re-run — never cache-eligible. See plan
§Phase 2, P2-T3.")
```

### Batch 3 (after P2-T3)

```
Task("general-purpose", "P2-T4: Fail-closed stale-cache + --history union + microbenchmark
(FR-9/10, R5, OQ-6). Cache keyed on canonical content hash — any mismatch/mtime skew/parse
failure triggers full recompute, never a stale pass. Add a bit-flip-tampered adversarial test.
validate --history must NEVER use the cache (always fresh git-log walk). Author a repeatable
microbenchmark script (cache-cold vs. cache-warm) on the committed 5-record cbc_suite_v1 set.
See plan §Phase 2, P2-T4.")
```

### Gates

```
Task("task-completion-validator", "P2-GATE1: Verify Phase 2 exit gate for
clinical-review-workflow — sign round-trips against validate on the synthetic path and
refuses fail-closed on the real path; incremental validate wall-time measurably reduced;
stale-cache test proves fail-closed; npm run check green.")
```

codex `gpt-5.6-terra` read-only second-opinion (invoke via the `codex` skill, read-only diff
mode, after P2-GATE1 passes — this phase is where fail-closed gap catches matter most, per
prior-session memory that codex second-opinion review found real gaps validators approved):

```
codex exec --read-only "Diff-review the full Phase 2 changeset for clinical-review-workflow
against R1/R5/R9 and FR-6..10/23. Specifically hunt fail-closed gaps in the sign-refusal path
and the cache-staleness path."
```

---

## Implementation Notes

### Architectural Decisions

`sign` is TESTKEY-only (OQ-1) — no `--keyfile` seam ships in this feature; real signing stays
structurally impossible until G1 (named credentialed roster) and G2 (signing custodian +
offline key ceremony, ADR-0005) both clear.

### Known Gotchas

- P2 and P3 both touch `lib/verbs/validate.mjs` — this is why P3 is scheduled a wave later
  (wave 3), not because P3 depends on P2's work.
- The stale-cache test must seed an actual bit-flip-tampered input, not merely assert "cache
  invalidated" — a shallow test here is exactly the fail-open risk (R5) this phase exists to
  prevent.
- `--history` must never read from the incremental cache — always re-run the git-log walk
  (OQ-6).

---

## Completion Notes

Summary of phase completion (fill in when phase is complete):

- What was built
- Key learnings
- Unexpected challenges
- Recommendations for Phase 5 hardening sweep
