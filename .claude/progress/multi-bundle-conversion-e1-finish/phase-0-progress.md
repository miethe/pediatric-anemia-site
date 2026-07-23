---
type: progress
schema_version: 2
doc_type: progress
prd: multi-bundle-conversion-e1-finish
feature_slug: multi-bundle-conversion-e1-finish
phase: 0
title: Gate Recovery — Green npm run check Honestly
status: at_risk
created: '2026-07-23'
updated: '2026-07-23'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish/phase-0-1-gate-recovery-emission-gate.md
commit_refs: []
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 1
depends_on: []
owners:
- ica-executor
- codex-executor
contributors:
- task-completion-validator
findings_doc_ref: null
tasks:
- id: P0-T1
  status: completed
  assigned_to:
  - ica-executor
  model: claude-haiku-4-5
  model_effort: low
  provider: ICA free-tier
  estimated_effort: 0.75 pts
  dependencies: []
  must_stay_primary: false
  fr_refs:
  - FR-F1
  description: 'Backfill cbc_suite_v1''s 12 RF-CBC-002 sources'' rights fields — extend
    scripts/evidence/lib/cbc-002-projection.mjs''s buildNewSources() to emit the EPR0-T4
    honest-`unknown` triage block (license/access_basis/terms/terms_snapshot: "unknown";
    evidence_item_type, judgment_basis: "unassessed", judgment_basis_attestation:
    null, rights_component_class, structured_locator, typed not_captured on passages)
    on each of the 12 SOURCE_DEFS entries. Asserts nothing beyond the schema''s own
    unknown/unassessed vocabulary.'
  started: '2026-07-23T12:37:00Z'
  completed: '2026-07-23T12:55:00Z'
  evidence:
  - test: tests/ef-cbc-002-backfill.test.mjs 17/17 pass; validate-kb zero errors
- id: P0-T2
  status: completed
  assigned_to:
  - ica-executor
  model: claude-haiku-4-5
  model_effort: low
  provider: ICA free-tier
  estimated_effort: 0.5 pts
  dependencies: []
  must_stay_primary: false
  fr_refs:
  - FR-F1
  description: Backfill kidney_suite_v1's 12 sources' rights fields — hand-author
    the equivalent honest-`unknown` rights block directly into each of the 12 sources
    in modules/kidney_suite_v1/evidence.json (no dedicated builder script exists for
    this module; same field set/values as P0-T1).
  started: '2026-07-23T12:37:00Z'
  completed: '2026-07-23T12:50:00Z'
  evidence:
  - test: node scripts/validate-kb.mjs zero errors
- id: P0-T3
  status: completed
  assigned_to:
  - ica-executor
  model: claude-haiku-4-5
  model_effort: low
  provider: ICA free-tier
  estimated_effort: 0.5 pts
  dependencies: []
  must_stay_primary: false
  fr_refs:
  - FR-F1
  description: Backfill growth_suite_v1's 11 sources' rights fields — same treatment
    as P0-T2, applied to the 11 sources in modules/growth_suite_v1/evidence.json.
  started: '2026-07-23T12:37:00Z'
  completed: '2026-07-23T12:50:00Z'
  evidence:
  - test: node scripts/validate-kb.mjs zero errors
- id: P0-T4
  status: completed
  assigned_to:
  - ica-executor
  model: claude-haiku-4-5
  model_effort: low
  provider: ICA free-tier
  estimated_effort: 1.0 pts
  dependencies: []
  must_stay_primary: false
  fr_refs:
  - FR-F2
  description: 'Mint 35 triage-only rights/rights-records.json entries (RR-<sourceId>)
    mirroring RR-AAP2026_IDA verbatim: access.basis "unknown", access.automated_retrieval_allowed
    "unknown", access.model_training_allowed "not_assessed", copyright.status "unknown",
    overall_status "UNKNOWN", review.assessed_by_agent "multi-bundle-conversion-e1-finish-p0"
    (a marker distinct from the prior pass''s own markers), review.human_reviewer
    null, review.counsel_reviewer null, review.review_status "agent_triage_only".'
  started: '2026-07-23T12:37:00Z'
  completed: '2026-07-23T12:50:00Z'
  evidence:
  - test: node scripts/validate-kb.mjs zero errors
- id: P0-T5
  status: completed
  assigned_to:
  - ica-executor
  model: claude-haiku-4-5
  model_effort: low
  provider: ICA free-tier
  estimated_effort: 0.5 pts
  dependencies:
  - P0-T4
  must_stay_primary: false
  fr_refs:
  - FR-F2
  description: Mint 35 matching rights/rights-ledger.json join entries linking each
    of the 35 new ids to its P0-T4 rights_record_id, mirroring the existing 14 cbc_suite_v1-backfill
    entries' shape.
  started: '2026-07-23T12:37:00Z'
  completed: '2026-07-23T12:50:00Z'
  evidence:
  - test: node scripts/validate-kb.mjs zero errors
- id: P0-T6
  status: blocked
  assigned_to:
  - codex-executor
  model: gpt-5.6-luna
  model_effort: low
  provider: codex
  estimated_effort: 0.25 pts
  dependencies: []
  must_stay_primary: false
  fr_refs:
  - FR-F3
  description: Regenerate the stale tests/fixtures/p4-t1-pre-merge-snapshot.json.txt
    via scripts/lib/p4-t1-snapshot.mjs's computeSnapshot() (or scripts/capture-p4-t1-snapshot.mjs)
    against current HEAD — the committed fixture's recorded SHA-256 for modules/anemia/evidence.json
    no longer matches the real, legitimate, committed file (the fixture is stale,
    not the file).
- id: P0-T7
  status: completed
  assigned_to:
  - codex-executor
  model: gpt-5.6-luna
  model_effort: low
  provider: codex
  estimated_effort: 0.25 pts
  dependencies: []
  must_stay_primary: false
  fr_refs:
  - FR-F3
  description: Fix notice-architecture-no-clearance.test.mjs false positive — reword
    docs/architecture.md's line 75 ("...flagged for legal review rather than cleared
    as clinical evidence") to use a recognized negation marker directly adjacent to
    "cleared", rather than widening the test's marker list (a doc-wording fix is lower-risk
    than a regex change to a rights-honesty gate).
  started: '2026-07-23T12:37:00Z'
  completed: '2026-07-23T12:50:00Z'
  evidence:
  - test: node scripts/validate-kb.mjs zero errors
- id: P0-T8
  status: completed
  assigned_to:
  - codex-executor
  model: gpt-5.6-luna
  model_effort: low
  provider: codex
  estimated_effort: 0.5 pts
  dependencies:
  - P0-T6
  - P0-T7
  must_stay_primary: false
  fr_refs:
  - FR-F3
  - FR-F20
  - OQ-6
  description: 'Reorder package.json''s scripts.check to run `npm run build` before
    `npm test` (fixes tests/module-registry.test.mjs''s dist/-dependent assertions
    failing from a genuinely clean/fresh clone) — new composition: build && test &&
    validate && coverage:rules && verify:d4 && check:imports && smoke:browser && smoke.
    Update CLAUDE.md''s copied check-gate string in the SAME commit per tests/claudemd-check-gate.test.mjs''s
    doc-truth requirement.'
  started: '2026-07-23T12:56:00Z'
  completed: '2026-07-23T13:10:00Z'
  evidence:
  - test: tests/claudemd-check-gate.test.mjs pass; scripts.check reordered build-before-test
- id: P0-T9
  status: completed
  assigned_to:
  - general-purpose
  model: claude-sonnet-5
  model_effort: adaptive
  provider: claude
  estimated_effort: 0.5 pts
  dependencies:
  - P0-T1
  - P0-T2
  - P0-T3
  - P0-T4
  - P0-T5
  - P0-T6
  - P0-T7
  must_stay_primary: false
  fr_refs:
  - FR-F4
  description: 'Negative-control test: assert every one of the 35 records/fields this
    phase touches (P0-T1..T5) carries only the schema''s own unknown/unassessed/null
    closed-vocabulary values — zero field asserts a specific license status, access
    basis, or judgment-basis determination. Assert review.assessed_by_agent uniquely
    names this feature on all 35 rights-records.json entries; test asserts it examined
    exactly 35 records.'
  started: '2026-07-23T12:56:00Z'
  completed: '2026-07-23T13:05:00Z'
  evidence:
  - test: tests/ef-p0-rights-triage-negative-control.test.mjs 6/6 pass
- id: P0-GATE
  status: not_started
  assigned_to:
  - task-completion-validator
  model: claude-sonnet-5
  model_effort: adaptive
  provider: claude
  estimated_effort: —
  dependencies:
  - P0-T1
  - P0-T2
  - P0-T3
  - P0-T4
  - P0-T5
  - P0-T6
  - P0-T7
  - P0-T8
  - P0-T9
  must_stay_primary: false
  description: 'Reviewer gate: verify Phase 0 exit gate — npm run check exits 0 from
    a clean tree (per P0-T8''s reordering); zero field moved off the honest-unknown/unassessed
    vocabulary (P0-T9); all 4 SPIKE-009 Leg B root causes closed.'
parallelization:
  batch_1:
  - P0-T1
  - P0-T2
  - P0-T3
  - P0-T4
  - P0-T6
  - P0-T7
  batch_2:
  - P0-T5
  - P0-T8
  batch_3:
  - P0-T9
  batch_4:
  - P0-GATE
total_tasks: 10
completed_tasks: 8
in_progress_tasks: 0
blocked_tasks: 1
progress: 80
---

# multi-bundle-conversion-e1-finish - Phase 0: Gate Recovery — Green npm run check Honestly

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

**Wave**: 1 of 6 (fully serial plan). **Depends on**: none — first phase in this plan.
**Assigned Subagent(s)**: `ica-executor` (rights-field plumbing, `claude-haiku-4-5`, ICA free-tier —
requires `bypassPermissions` per project memory, `acceptEdits` alone leaves gates unverified);
`codex-executor` (fixture regen, regex fix, build-order fix, `gpt-5.6-luna`); `task-completion-validator`
gate.

## Objective

Recover a genuinely green `npm run check` from a clean tree, honestly — 35 sources across
`cbc_suite_v1`/`kidney_suite_v1`/`growth_suite_v1` backfilled with the schema's own honest-`unknown`
rights vocabulary (mirroring the already-committed `RR-AAP2026_IDA` precedent), plus 3 mechanical
residual-failure fixes. Zero converter code (`tools/rf-bundle-to-kb-pack/**`) is touched in this phase.

## Entry Criteria

- None — first phase in the plan.

## Exit Criteria (decisions block §1)

- `npm run check` exits 0 from a clean tree.
- Zero field minted by this phase moved off the schema's own `overall_status: "UNKNOWN"` /
  `judgment_basis: "unassessed"` honest-triage vocabulary.

## Model / Provider Assignment

| Task | Model | Provider | MUST-stay-primary? |
|---|---|---|---|
| P0-T1..T5 | claude-haiku-4-5 | ICA free-tier | No — mechanical, spec-bounded, non-adjudicating |
| P0-T6..T8 | gpt-5.6-luna | codex | No — mechanical, spec-bounded, non-adjudicating |
| P0-T9 | claude-sonnet-5 | claude (native) | No — regular native task, not flagged no-fallback in the plan |
| P0-GATE | claude-sonnet-5 | claude (native) | No — standard phase gate, not an adjudication task |

No task in Phase 0 is marked MUST-stay-primary by the parent plan; this phase is explicitly the
off-primary, mechanical-work phase (per project memory: ICA delegates need `bypassPermissions` to
actually execute, not just `acceptEdits`, or gates go unverified).

## Quality Gates

- [ ] `npm run check` exits 0 from a clean tree (reordered composition: `build` before `test`)
- [ ] 35/35 new rights records carry `overall_status: "UNKNOWN"` and `review.review_status: "agent_triage_only"` — zero exceptions, proven by P0-T9's negative-control test
- [ ] `tests/ef-cbc-002-backfill.test.mjs`, `tests/ef-anemia-backfill-integrity.test.mjs` (+ 3 siblings), `tests/notice-architecture-no-clearance.test.mjs` all pass
- [ ] `tests/claudemd-check-gate.test.mjs` passes — `CLAUDE.md` and `package.json` agree byte-for-byte on the check-gate composition
- [ ] Zero converter code (`tools/rf-bundle-to-kb-pack/**`) touched in this phase — data/fixture-only

## Implementation Notes

### File-Disjointness (per project memory — wave-plan batches have collided before, CRW batch_2)

| Batch | Tasks | Files touched |
|---|---|---|
| (a) Evidence projections | P0-T1, P0-T2, P0-T3 | `scripts/evidence/lib/cbc-002-projection.mjs`, `modules/kidney_suite_v1/evidence.json`, `modules/growth_suite_v1/evidence.json` |
| (b) Rights ledger/records + fixtures + regex | P0-T4, P0-T5, P0-T6, P0-T7 | `rights/rights-records.json`, `rights/rights-ledger.json`, `tests/fixtures/p4-t1-pre-merge-snapshot.json.txt`, `docs/architecture.md` |

Set (a) ∩ Set (b) = ∅ — confirmed by direct enumeration. P0-T8/P0-T9 run after both batches merge.

### Known Gotchas

- Absence of a source's rights fields is never read as clearance — every new value is `unknown`/
  `unassessed`/`null`, never a specific license/basis/judgment determination.
- `review.assessed_by_agent` on every P0-T4 record must be a marker string distinct from any
  pre-existing marker in `rights-records.json` (uniqueness is test-asserted).
- The `dist/`-dependent test failures are a genuine ordering defect (`build` after `test` in
  `scripts.check`), not merely a local-worktree artifact from a developer having already run `npm run
  build` — P0-T8 must reproduce against a truly clean/fresh clone.

## Completion Notes

Not started — scaffolded pre-execution on 2026-07-23. All 10 tasks (P0-T1..T9, P0-GATE) at
`not_started`, 0% complete.
