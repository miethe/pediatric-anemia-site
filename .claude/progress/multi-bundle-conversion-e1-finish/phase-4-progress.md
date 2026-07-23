---
type: progress
schema_version: 2
doc_type: progress
prd: multi-bundle-conversion-e1-finish
feature_slug: multi-bundle-conversion-e1-finish
phase: 4
title: 4-of-4 Batch + Determinism + Semantic-Diff (R-3)
status: completed
created: '2026-07-23'
updated: '2026-07-23'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish/phase-4-5-batch-determinism-docs.md
commit_refs:
- 24be3f2
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 5
depends_on:
- P3
owners:
- codex-executor
- general-purpose
contributors:
- task-completion-validator
findings_doc_ref: null
tasks:
- id: P4-T1
  status: completed
  assigned_to:
  - codex-executor
  model: gpt-5.6-terra
  model_effort: medium
  provider: codex
  estimated_effort: 1.0 pts
  dependencies:
  - P3-GATE
  must_stay_primary: false
  fr_refs:
  - FR-F14
  description: "Verify batch completes 4/4 BATCH_PAIRS live. batch.mjs's BATCH_PAIRS\
    \ array already lists all 4 named pairs (rf-ev-001->anemia, rf-cbc-002->cbc_suite_v1,\
    \ rf-kid-001->kidney_suite_v1, rf-gro-002->growth_suite_v1, committed by the prior\
    \ E1 pass) \u2014 previously only pair 1 succeeded. Run `node cli.mjs batch` live\
    \ and confirm all 4 pairs complete inspect -> verify -> propose ('completes' means\
    \ reaches a clean, named terminal state \u2014 the 3 non-cbc pairs are refused\
    \ at the governance gate for rule content but still emit their evidence-layer\
    \ artifacts per FR-F11's scope). Escalates to gpt-5.6-sol on the two-failure rule."
  started: '2026-07-23T16:10:00Z'
  completed: '2026-07-23T16:55:00Z'
  evidence:
  - test: batch 4/4 exit0; determinism 4-module; semantic-diff committed 0/0/0; cbc
      byte-identity green
- id: P4-T2
  status: completed
  assigned_to:
  - codex-executor
  model: gpt-5.6-terra
  model_effort: medium
  provider: codex
  estimated_effort: 0.75 pts
  dependencies:
  - P4-T1
  must_stay_primary: false
  fr_refs:
  - FR-F14
  - R-P2
  description: "multi-bundle-conversion-report.json \u2014 real 4-module aggregate.\
    \ Verify/extend multi-bundle-report.mjs's aggregate step now reports real counts\
    \ for all 4 bundles (bundlesReported: 4, bundlesNotAvailable: 0) instead of the\
    \ prior pass's bundlesReported: 0/bundlesNotAvailable: 4. Every per-bundle field\
    \ (claims processed, conflicts, unresolved, rules emitted) has an explicit 0/[]\
    \ representation, never a missing key."
  started: '2026-07-23T16:10:00Z'
  completed: '2026-07-23T16:55:00Z'
  evidence:
  - test: batch 4/4 exit0; determinism 4-module; semantic-diff committed 0/0/0; cbc
      byte-identity green
- id: P4-T3
  status: completed
  assigned_to:
  - codex-executor
  model: gpt-5.6-terra
  model_effort: medium
  provider: codex
  estimated_effort: 1.0 pts
  dependencies:
  - P4-T1
  must_stay_primary: false
  fr_refs:
  - FR-F15
  description: Triple-run determinism proof, all 4 bundles. Extend tests/ef-multi-bundle-determinism.test.mjs
    to run batch 3 independent times against byte-identical fixture inputs and SHA-256-diff
    every emitted file, for all 4 bundles independently AND the aggregate multi-bundle-conversion-report.json.
    Test must fail loudly if any of the 4 modules is silently skipped from the comparison.
  started: '2026-07-23T16:10:00Z'
  completed: '2026-07-23T16:55:00Z'
  evidence:
  - test: batch 4/4 exit0; determinism 4-module; semantic-diff committed 0/0/0; cbc
      byte-identity green
- id: P4-T4
  status: completed
  assigned_to:
  - general-purpose
  model: claude-sonnet-5
  model_effort: extended
  provider: claude
  estimated_effort: 2.0 pts
  dependencies:
  - P4-T1
  must_stay_primary: true
  fr_refs:
  - R-3
  - FR-F16
  description: "Extend lib/semantic-diff.mjs with an evidence-projection diff mode\
    \ \u2014 new capability, not reuse (today it only supports rule-id-level comparison).\
    \ Add diffEvidenceAssertions(): a pure, deterministic, sorted-output function\
    \ performing an added/removed/changed comparison, keyed by assertionId, between\
    \ two evidence-assertions.json documents. Wire propose's emission for anemia/kidney_suite_v1/growth_suite_v1\
    \ to write semantic-diff.json into its --out tree, comparing its own freshly-produced\
    \ evidence-assertions.json against that module's currently-committed one."
  started: '2026-07-23T16:10:00Z'
  completed: '2026-07-23T16:55:00Z'
  evidence:
  - test: batch 4/4 exit0; determinism 4-module; semantic-diff committed 0/0/0; cbc
      byte-identity green
- id: P4-T5
  status: completed
  assigned_to:
  - general-purpose
  model: claude-sonnet-5
  model_effort: adaptive
  provider: claude
  estimated_effort: 0.5 pts
  dependencies:
  - P4-T4
  must_stay_primary: true
  fr_refs:
  - R-3
  - FR-F16
  description: "Commit semantic-diff.json for anemia/kidney_suite_v1/growth_suite_v1\
    \ \u2014 must produce AND commit, per this plan's binding instructions. Copy the\
    \ resulting semantic-diff.json from build/kb-pack/<id>/.../semantic-diff.json\
    \ (gitignored) into modules/<id>/semantic-diff.json. The converter's freshly-produced\
    \ evidence.json/evidence-assertions.json for these 3 modules stays in build/ only\
    \ and is NEVER copied over the committed modules/<id>/evidence.json/evidence-assertions.json\
    \ \u2014 regardless of whether P4-T4's diff is empty or non-empty."
  started: '2026-07-23T16:10:00Z'
  completed: '2026-07-23T16:55:00Z'
  evidence:
  - test: batch 4/4 exit0; determinism 4-module; semantic-diff committed 0/0/0; cbc
      byte-identity green
- id: P4-T6
  status: completed
  assigned_to:
  - general-purpose
  model: claude-sonnet-5
  model_effort: adaptive
  provider: claude
  estimated_effort: 0.75 pts
  dependencies:
  - P4-T5
  must_stay_primary: true
  fr_refs:
  - FR-F16
  - R-P3
  description: 'ADJUDICATION (seam task, MUST-stay-primary even though P4-T1..T5 route
    off-primary). Read P4-T4/T5''s actual, empirical semantic-diff result for each
    of the 3 modules and document the closure path per-module: if a module''s diff
    is empty, propose (committed, tested code) is documented as the regenerator of
    record going forward (closing finding #3); if non-empty, the committed bespoke
    evidence stays authoritative unchanged (R-3''s fail-closed default) and the divergence
    is recorded as a new, named finding. Requires reading actual output, not assuming
    an outcome.'
  started: '2026-07-23T16:10:00Z'
  completed: '2026-07-23T16:55:00Z'
  evidence:
  - test: batch 4/4 exit0; determinism 4-module; semantic-diff committed 0/0/0; cbc
      byte-identity green
- id: P4-GATE
  status: completed
  assigned_to:
  - task-completion-validator
  model: claude-sonnet-5
  model_effort: adaptive
  provider: claude
  estimated_effort: "\u2014"
  dependencies:
  - P4-T1
  - P4-T2
  - P4-T3
  - P4-T4
  - P4-T5
  - P4-T6
  must_stay_primary: false
  description: 'Verify: batch 4/4 (P4-T1); aggregate report real (P4-T2); triple-run
    determinism holds for all 4 modules (P4-T3); semantic-diff.json committed for
    3 modules (P4-T5) with committed bespoke evidence provably untouched; FR-F16 closure
    path documented per actual diff result (P4-T6); FR-F24''s invariant test (P1-T6)
    re-confirmed green.'
  started: '2026-07-23T16:55:00Z'
  completed: '2026-07-23T17:00:00Z'
  evidence:
  - review: task-completion-validator APPROVED commit 24be3f2
parallelization:
  batch_1:
  - P4-T1
  batch_2:
  - P4-T2
  - P4-T3
  batch_3:
  - P4-T4
  batch_4:
  - P4-T5
  batch_5:
  - P4-T6
  batch_6:
  - P4-GATE
total_tasks: 7
completed_tasks: 7
in_progress_tasks: 0
blocked_tasks: 0
progress: 100
---

# multi-bundle-conversion-e1-finish - Phase 4: 4-of-4 Batch + Determinism + Semantic-Diff (R-3)

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

**Wave**: 5 of 6. **Depends on**: Phase 3 complete (all 3 non-cbc modules have their non-approving
decisions files).
**Assigned Subagent(s)**: `codex-executor` (`gpt-5.6-terra`, determinism/report harness, P4-T1..T3 —
escalates to `gpt-5.6-sol` on the two-failure rule); native Claude (`claude-sonnet-5`) for P4-T4/T5
(semantic-diff extension work, MUST-stay-primary) and P4-T6 (adjudication of the diff result,
MUST-stay-primary); `task-completion-validator` gate.

## Objective

Prove 4-of-4 batch conversion with reproducible determinism; produce and commit a `semantic-diff.json`
per non-`cbc` module documenting how converter output compares to already-committed bespoke evidence
projections — never overwriting committed evidence, per R-3.

## Entry Criteria

- Phase 3 complete (all 3 non-cbc modules have their non-approving decisions files).

## Exit Criteria (decisions block §1, PRD Goal 4/FR-F14-F16)

Reproducibility claim is true for 4/4; 3 independent `batch` runs produce SHA-256-identical bytes for
all 4 modules; `semantic-diff.json` is produced AND committed for the 3 non-cbc modules — R-3 binding:
it is NEVER used to overwrite committed bespoke evidence in this pass, regardless of the diff's content.

## Model / Provider Assignment

| Task | Model | Provider | MUST-stay-primary? |
|---|---|---|---|
| P4-T1, P4-T2, P4-T3 | gpt-5.6-terra | codex | No — mechanical determinism/report harness work |
| P4-T4, P4-T5 | claude-sonnet-5 (native) | claude | **Yes — judgment-bearing content/architecture work (a new evidence-projection diff capability, and committing its output), not mechanical harness code; reconciled per the parent plan's corrected Model/Provider & Profile Assignment section** |
| P4-T6 | claude-sonnet-5 (native) | claude | **Yes — adjudication is always MUST-stay-primary, even in an otherwise off-primary phase (parent plan's explicit binding rule)** |
| P4-GATE | claude-sonnet-5 (native) | claude | No — standard phase gate |

**Reconciled discrepancy (previously carried forward unresolved in this file; fixed post-planning-gate
review)**: the parent plan's Phase Summary table and its "Model, Provider & Profile Assignment"
section previously read "codex-executor for P4-T1..T5; native Claude only for P4-T6 adjudication,"
which contradicted this phase's own per-task table (P4-T4/P4-T5 were always `native`/`claude-sonnet-5`
directly, not `codex-executor`). **The per-task detail-file table was correct** — the parent plan's
prose has been corrected to match it, not the other way around. `must_stay_primary` is now `true` for
P4-T4/T5 above, consistent with that correction (previously incorrectly `false`).

## Quality Gates

- [ ] `batch` completes `inspect → verify → propose` for all 4 named pairs; 0 rules for 3 of 4 modules, 4 rules (unchanged) for `cbc_suite_v1`
- [ ] 3 independent `batch` runs produce byte-identical output across all 4 modules and the aggregate report
- [ ] `semantic-diff.json` committed for `anemia`/`kidney_suite_v1`/`growth_suite_v1`, regardless of diff result
- [ ] Committed bespoke `evidence.json`/`evidence-assertions.json` for the 3 non-cbc modules is provably untouched by this phase (R-3)
- [ ] FR-F16's closure path is documented per-module, conditional on the actual empirical diff result
- [ ] FR-F24's invariant test re-confirmed green

## Implementation Notes

### Known Gotchas

- P4-T6's closure-path decision must be conditional on the REAL diff result — it must not be asserted
  before P4-T4/T5 actually run.
- The committed bespoke `evidence.json`/`evidence-assertions.json` for the 3 non-cbc modules is NEVER
  overwritten in this pass, regardless of whether the diff is empty or non-empty (R-3, binding).

## Completion Notes

**Completed, 2026-07-23** — committed at `24be3f2` ("P4: 4-of-4 batch + determinism + committed
semantic-diff (R-3); testCorpusHash fail-closed for refused modules"). All 7 tasks (P4-T1..T6,
P4-GATE) landed and are recorded `status: completed` above: `batch` completes `inspect → verify →
propose` for all 4 named pairs; the aggregate `multi-bundle-conversion-report.json` reports real
counts for all 4 bundles; a triple-run determinism proof holds SHA-256-identical output across all
4 modules and the aggregate report; `lib/semantic-diff.mjs` gained a new `diffEvidenceAssertions()`
evidence-projection diff mode; `semantic-diff.json` is committed for `anemia`/`kidney_suite_v1`/
`growth_suite_v1` (each 0 added/0 removed/0 changed against the already-committed bespoke evidence,
per P4-T6's per-module empirical read); the committed bespoke `evidence.json`/`evidence-assertions.json`
for those 3 modules stayed provably untouched (R-3); `P4-GATE` (`task-completion-validator`)
approved the phase against commit `24be3f2`. This closes the prior scaffolded (pre-execution)
0%-complete state this note previously described — that state is now stale and superseded by the
above. Reconciliation note retained for the historical record: pre-execution, this phase's
model-routing was amended post-planning-gate review (the per-task table was always correct —
P4-T4/T5 are native `claude-sonnet-5`, MUST-stay-primary — the parent plan's prose was corrected to
match; no task count or point total changed). **Zero new clinical rules were emitted by this
phase** (0 rules for the 3 non-cbc modules; `cbc_suite_v1`'s rule count unchanged) — this repo
remains an unvalidated research prototype; nothing here constitutes clinical review, approval, or
release-readiness.
