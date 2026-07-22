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
title: "Clinical Review Workflow v1 \u2014 Phase 2: Sign Verb & Validate Performance"
status: completed
created: '2026-07-22'
updated: '2026-07-22'
started: 2026-07-22T13:20Z
completed: 2026-07-22T16:25Z
commit_refs: []
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
contributors:
- task-completion-validator
- codex-gpt-5.6-terra
model_usage:
  primary: sonnet
  external:
  - gpt-5.6-terra
tasks:
- id: P2-T1
  description: 'sign verb on a staged draft, TESTKEY-only synthetic path (FR-6/FR-25,
    OQ-1, F1). Add sign to cli.mjs + new tools/review-record/lib/verbs/sign.mjs. Frozen
    command signature: sign --draft <path> --module <id> --root <dir>. sign reads
    ONLY a staged draft written by scaffold --draft to <root>/.review-drafts/<moduleId>/<review_id>.draft.yaml
    (outside reviews/, gitignored); on a synthetic: true draft with signature: null
    it calls lib/signature.mjs''s signRecordDryRun (ephemeral in-memory Ed25519, TESTKEY-
    prefix, key discarded on return), then performs the record''s FIRST and ONLY committed
    write through lib/store.mjs''s writeNewReviewRecordFile append-only path. sign
    NEVER opens or rewrites a path already inside reviews/. OQ-1 resolved: TESTKEY-only;
    no --keyfile seam; no sign --record over a committed file. Requires scaffold --draft
    (P1-T3''s signature) to emit the staging path.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P1-GATE2 (Phase 1 complete)
  estimated_effort: 1.0 pts
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tools/review-record/cli.mjs
  - tools/review-record/lib/verbs/sign.mjs
  - tools/review-record/lib/verbs/scaffold.mjs
  - tests/ef-review-workflow.test.mjs
  acceptance_criteria: Full flow scaffold --draft -> sign --draft <path> on a synthetic
    fixture writes exactly one new reviews/*.yaml and round-trips against validate
    (chain-link + signature-verify pass); a dedicated test asserts NO pre-existing
    reviews/*.yaml path's bytes/mtime change across a sign call (F1); --help lists
    sign with the exact signature above.
  started: 2026-07-22T13:21Z
  completed: 2026-07-22T13:55Z
  evidence:
  - commit: c06544a
  - finding: CRW-F5,CRW-F6
  verified_by:
  - P2-GATE1
- id: P2-T2
  description: 'sign fail-closed refusal + no-keyfile grep (FR-7/23, R1). sign refuses
    a synthetic: false draft with a message naming both G1 (roster verification) and
    G2 (offline key custody + ceremony, ADR-0005); refuses --keyfile/--key/--test-keys/env-var
    key paths AND a --record pointing at a committed file (FR-25) for any input. Static
    grep test proves zero key-reading code under tools/review-record/.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P2-T1
  estimated_effort: 1.0 pts
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tools/review-record/lib/verbs/sign.mjs
  - tests/ef-review-record-cli.test.mjs
  acceptance_criteria: 'sign --draft <path> on a synthetic: false draft exits non-zero
    with a message containing both G1 and G2; a sign --record <id> over a committed
    file is rejected; grep test finds zero fs.readFile/env-var key-path calls in lib/verbs/sign.mjs.'
  started: 2026-07-22T13:56Z
  completed: 2026-07-22T14:15Z
  evidence:
  - commit: 95722f2
  verified_by:
  - P2-GATE1
- id: P2-T3
  description: "Incremental validate composite-keyed persistent cache (FR-8, R9, F3).\
    \ New tools/review-record/lib/validate-cache.mjs; validate --record <id>/--module\
    \ reuses previously computed per-record results (schema shape, roster resolution,\
    \ signature verification, that record's chain-link check) only when EVERY component\
    \ of the composite key matches \u2014 record content hash, complete predecessor-set\
    \ content hashes, roster file hash, review-record schema hash, validator-policy\
    \ version, history-mode flag (not the record+immediate-predecessor pair alone\
    \ \u2014 F3). Cache is a PERSISTENT store OUTSIDE the repo tree (OS temp/XDG cache\
    \ dir, atomic write-then-rename), keyed by {root, moduleId}, so warmth survives\
    \ across separate CLI processes. Module-wide checks (authorship-union, independence\
    \ heuristic, release-authorization evaluation) always re-run \u2014 never cache-eligible.\
    \ Frozen signature (unchanged): validate --module <id> [--root <dir>] [--record\
    \ <review_id>] [--history]."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T1
  - P2-T1
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tools/review-record/lib/validate-cache.mjs
  - tools/review-record/lib/verbs/validate.mjs
  acceptance_criteria: A second node process reuses per-record results written by
    a first process (cross-process warmth, asserted via a call-count/marker hook,
    not wall-clock alone); changing any ONE key component (roster, schema, validator-policy
    version, record, predecessor) forces recompute; module-wide checks re-run on every
    invocation.
  started: 2026-07-22T13:56Z
  completed: 2026-07-22T14:28Z
  evidence:
  - commit: 40b72c0
  - finding: CRW-F7
  verified_by:
  - P2-GATE1
- id: P2-T4
  description: "Fail-closed composite-key invalidation + --history union + cross-process\
    \ microbenchmark (FR-9/10, R5, OQ-6, F3). Any single key-component miss, read\
    \ uncertainty, or unreadable/corrupt cache file triggers full recompute \u2014\
    \ never a stale pass. Five dedicated fresh-process adversarial tests, one per\
    \ key component, seed a stale cache and assert invalidation independently: (1)\
    \ roster change, (2) schema change, (3) record-content change, (4) predecessor-content\
    \ change, (5) history-mode-flag change. validate --history results are never cached\
    \ across invocations (OQ-6). Author a repeatable microbenchmark script comparing\
    \ cache-cold vs. cache-warm wall-time across two separate node invocations sharing\
    \ the persistent cache dir on the committed 5-record cbc_suite_v1 set."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P2-T3
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tools/review-record/lib/validate-cache.mjs
  - tools/review-record/lib/verbs/validate.mjs
  - tools/review-record/lib/history.mjs
  - tests/ef-review-workflow.test.mjs
  acceptance_criteria: 5/5 fresh-process invalidation tests recompute rather than
    stale-pass; a git-history mutation between two --history calls is caught on the
    second call; microbenchmark script committed, shows cross-process cache-warm measurably
    faster across 3 repeated runs.
  started: 2026-07-22T14:29Z
  completed: 2026-07-22T14:48Z
  evidence:
  - commit: 6fa6813
  - finding: CRW-F8
  verified_by:
  - P2-GATE1
- id: P2-GATE1
  description: "task-completion-validator gate: verify Phase 2 exit gate \u2014 sign\
    \ consumes a staged draft (never an existing reviews/ file, F1), round-trips against\
    \ validate on the synthetic path and refuses fail-closed on the real path; incremental\
    \ validate wall-time is measurably reduced across two separate processes sharing\
    \ the persistent cache; the 5 composite-key fresh-process invalidation tests pass\
    \ fail-closed; npm run check green."
  status: completed
  assigned_to:
  - task-completion-validator
  dependencies:
  - P2-T1
  - P2-T2
  - P2-T3
  - P2-T4
  estimated_effort: "\u2014"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: All exit-gate criteria pass; recorded in phase progress note.
  started: 2026-07-22T14:48Z
  completed: 2026-07-22T14:59Z
  evidence:
  - workflow: wf_14b7b3a0-d0d validator approved 0 fixes
  verified_by:
  - P2-GATE2
- id: P2-GATE2
  description: "codex gpt-5.6-terra read-only second-opinion diff review of the full\
    \ P2 changeset against R1/R5/R9 and FR-6..10/23/FR-25 \u2014 specifically hunts\
    \ fail-closed gaps in the sign staged-draft lifecycle (no existing-record rewrite,\
    \ F1) and the composite-key cache-staleness paths (per-component invalidation,\
    \ F3)."
  status: completed
  assigned_to:
  - codex (read-only)
  dependencies:
  - P2-GATE1
  estimated_effort: "\u2014"
  priority: high
  assigned_model: gpt-5.6-terra
  model_effort: high
  acceptance_criteria: Review recorded; any flagged gap becomes a task before Phase
    5 opens.
  started: 2026-07-22T15:00Z
  completed: 2026-07-22T16:20Z
  evidence:
  - codex: gpt-5.6-terra FAIL(3 BLOCKER,1 MAJOR)->fixes 2b8674e,05ae17a,9ba97ce,2b123d4,a0675ea,e20de0a->re-pass
      B2/B3/M4 CLOSED, B1 committed-symlink closed; residual lstat-race adjudicated
      out-of-threat-model (same-user), documented
  verified_by:
  - P2-GATE2
parallelization:
  batch_1:
  - P2-T1
  batch_2:
  - P2-T2
  - P2-T3
  batch_3:
  - P2-T4
  batch_4:
  - P2-GATE1
  batch_5:
  - P2-GATE2
  critical_path:
  - P2-T1
  - P2-T3
  - P2-T4
  - P2-GATE1
  - P2-GATE2
  estimated_total_time: ~2 engineer-days
blockers: []
success_criteria:
- id: SC-1
  description: sign consumes only a staged draft (never rewrites an existing reviews/
    file, F1) and round-trips against validate on the synthetic (TESTKEY) path
  status: completed
- id: SC-2
  description: 'sign refuses fail-closed on any synthetic: false draft or --record
    over a committed file, naming G1 and G2'
  status: completed
- id: SC-3
  description: Incremental validate wall-time measurably reduced across two separate
    processes sharing the persistent composite-keyed cache
  status: completed
- id: SC-4
  description: 5/5 composite-key fresh-process invalidation tests prove fail-closed
    recompute (F3)
  status: completed
- id: SC-5
  description: npm run check green
  status: completed
files_modified:
- tools/review-record/cli.mjs
- tools/review-record/lib/verbs/sign.mjs
- tools/review-record/lib/verbs/scaffold.mjs
- tools/review-record/lib/validate-cache.mjs
- tools/review-record/lib/verbs/validate.mjs
- tools/review-record/lib/history.mjs
- tests/ef-review-record-cli.test.mjs
- tests/ef-review-workflow.test.mjs
notes: "Wave 2 (parallel to Phase 4, both gated on Phase 1 only). Stays in-session\
  \ \u2014 no ICA offload for this phase (decisions block: fail-closed crypto-adjacent\
  \ logic is taste/risk work, single owner). P2 and P3 both write lib/verbs/validate.mjs\
  \ \u2014 P3 is scheduled one wave later (wave 3) specifically to avoid a concurrent\
  \ write collision; this is a mechanical scheduling fact, not a scope dependency\
  \ (P3 does not depend on P2). Revision 1: sign now operates on a staged .review-drafts/\
  \ file (FR-25, F1), never an existing reviews/ record, and the validate cache is\
  \ a cross-process PERSISTENT composite-keyed store (F3), not an in-process content-hash-pair\
  \ cache."
progress: 100
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

Ship a gate-aware `sign` verb that operates only on a staged `scaffold --draft` file
(TESTKEY-only synthetic path, hard fail-closed refusal on any real-identity `synthetic: false`
draft or any `--record` over a committed file, pre-G1/G2) plus an incremental fail-closed
`validate` cache that is now a cross-process composite-keyed persistent store. See PRD
FR-6..10/23/25 and decisions block §3 risks R1/R5/R9.

**Duration**: ~2 engineer-days · **Dependencies**: Phase 1 complete · **Exit gate**: `sign`
consumes a staged draft (never an existing `reviews/` file, F1), round-trips against `validate`
on the synthetic path and refuses fail-closed on the real path; incremental `validate`
wall-time is measurably reduced across two separate processes sharing the persistent cache;
the 5 composite-key fresh-process invalidation tests pass fail-closed; `npm run check` green.

**Hard guardrail reminder (this phase is the highest-risk phase for it)**: no task signs a
`synthetic: false` record; `sign` refuses fail-closed pre-G1/pre-G2; zero new runtime
dependencies, zero network, zero LLM inside `tools/review-record/`.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Status | Dependencies |
|---------|------|-----------------------|---------------|--------|---------------|
| P2-T1 | `sign` verb on a staged draft, TESTKEY-only synthetic path | general-purpose | sonnet/extended | pending | Phase 1 complete |
| P2-T2 | `sign` fail-closed refusal + no-keyfile grep | general-purpose | sonnet/extended | pending | P2-T1 |
| P2-T3 | Incremental `validate` composite-keyed persistent cache | general-purpose | sonnet/extended | pending | P1-T1, P2-T1 |
| P2-T4 | Fail-closed composite-key invalidation + `--history` union + cross-process microbenchmark | general-purpose | sonnet/extended | pending | P2-T3 |
| P2-GATE1 | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | pending | P2-T1..T4 |
| P2-GATE2 | codex `gpt-5.6-terra` read-only second-opinion | codex (read-only) | gpt-5.6-terra/high | pending | P2-GATE1 |

---

## Orchestration Quick Reference

### Batch 1 (after Phase 1 complete)

```
Task("general-purpose", "P2-T1: sign verb on a staged draft, TESTKEY-only synthetic path
(FR-6/FR-25, OQ-1, F1). Add sign to cli.mjs + new lib/verbs/sign.mjs. Frozen signature: sign
--draft <path> --module <id> --root <dir>. sign reads ONLY a staged draft written by scaffold
--draft to <root>/.review-drafts/<moduleId>/<review_id>.draft.yaml (never an existing
reviews/ file); on a synthetic:true draft with signature:null, call lib/signature.mjs's
signRecordDryRun (ephemeral in-memory Ed25519, TESTKEY- prefix, key discarded on return), then
perform the record's FIRST and ONLY committed write via lib/store.mjs. No --keyfile seam. AC:
scaffold --draft -> sign --draft round-trips against validate; a dedicated test proves NO
pre-existing reviews/*.yaml changes across a sign call (F1); --help lists sign with the exact
signature. See plan §Phase 2, P2-T1.")
```

### Batch 2 (after P2-T1)

```
Task("general-purpose", "P2-T2: sign fail-closed refusal + no-keyfile grep (FR-7/23, R1).
sign must refuse a synthetic:false draft with a message naming BOTH 'G1' and 'G2'; refuse
--keyfile/--key/--test-keys/env-var key paths AND a --record pointing at a committed file
(FR-25) for any input. Add a static grep test proving zero key-reading code exists in
lib/verbs/sign.mjs. See plan §Phase 2, P2-T2.")

Task("general-purpose", "P2-T3: Incremental validate composite-keyed persistent cache (FR-8,
R9, F3). New lib/validate-cache.mjs; validate --record/--module reuses per-record results only
when EVERY component of the composite key matches (record content hash, complete
predecessor-set hashes, roster file hash, schema hash, validator-policy version,
history-mode flag — not just the record+predecessor pair, F3). Cache is a PERSISTENT store
OUTSIDE the repo tree (OS temp/XDG cache dir, atomic write-then-rename) keyed by {root,
moduleId} so warmth survives across separate CLI processes. Module-wide checks always re-run
— never cache-eligible. See plan §Phase 2, P2-T3.")
```

### Batch 3 (after P2-T3)

```
Task("general-purpose", "P2-T4: Fail-closed composite-key invalidation + --history union +
cross-process microbenchmark (FR-9/10, R5, OQ-6, F3). Any single key-component miss, read
uncertainty, or unreadable/corrupt cache file triggers full recompute, never a stale pass. Add
5 dedicated fresh-process adversarial tests, one per key component (roster, schema,
record-content, predecessor-content, history-mode-flag). validate --history must NEVER use
the cache (always fresh git-log walk). Author a repeatable microbenchmark script (cache-cold
vs. cache-warm) across two separate node invocations sharing the persistent cache dir on the
committed 5-record cbc_suite_v1 set. See plan §Phase 2, P2-T4.")
```

### Gates

```
Task("task-completion-validator", "P2-GATE1: Verify Phase 2 exit gate for
clinical-review-workflow — sign consumes a staged draft (never an existing reviews/ file, F1),
round-trips against validate on the synthetic path and refuses fail-closed on the real path;
incremental validate wall-time measurably reduced across two separate processes sharing the
persistent cache; the 5 composite-key fresh-process invalidation tests pass fail-closed; npm
run check green.")
```

codex `gpt-5.6-terra` read-only second-opinion (invoke via the `codex` skill, read-only diff
mode, after P2-GATE1 passes — this phase is where fail-closed gap catches matter most, per
prior-session memory that codex second-opinion review found real gaps validators approved):

```
codex exec --read-only "Diff-review the full Phase 2 changeset for clinical-review-workflow
against R1/R5/R9 and FR-6..10/23/FR-25. Specifically hunt fail-closed gaps in the sign
staged-draft lifecycle (no existing-record rewrite, F1) and the composite-key cache-staleness
paths (per-component invalidation, F3)."
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
- `sign` must never open, read, or rewrite a path already inside `reviews/` — it operates
  exclusively on the `.review-drafts/` staging area (Revision 1, F1); this is a stricter
  invariant than the earlier `--record` framing and is worth a dedicated bytes/mtime test on
  every pre-existing committed file.
- The composite-key cache (Revision 1, F3) invalidates on ANY of 6 components, not just
  record+predecessor content hash — the 5 fresh-process adversarial tests must each seed a
  real mismatch on a distinct key component, not merely assert "cache invalidated" — a shallow
  test here is exactly the fail-open risk (R5) this phase exists to prevent.
- The cache is now a cross-process PERSISTENT store outside the repo tree — warmth must be
  provable across two separate `node` invocations, not just within one process.
- `--history` must never read from the incremental cache — always re-run the git-log walk
  (OQ-6).

---

## Completion Notes

Summary of phase completion (fill in when phase is complete):

- What was built
- Key learnings
- Unexpected challenges
- Recommendations for Phase 5 hardening sweep
