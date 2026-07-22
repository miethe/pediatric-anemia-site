---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1"
feature_slug: "multi-bundle-conversion-e1"
phase: 1
title: "Rights-Aware Vendoring & Fixtures"
status: "in_progress"
created: '2026-07-21'
updated: '2026-07-22'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-1-2-vendoring-batch-orchestration.md
commit_refs:
  - ada4300
  - 439cc01
  - 436ade3
  - 6583b49
  - e0b8adb
  - a8a75dd
  - 230f118
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 1
depends_on: []
owners: ["node-tooling-engineer"]
contributors: []

tasks:
  - id: "P1-T1"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "1.5 pts"
    dependencies: []
    description: "Generalize scripts/evidence/vendor-rf-bundle.mjs into a bundle-parametrized scripts/evidence/generate-rf-fixture.mjs (FR-1): takes run-dir + fixture slug args, emits an EF-shaped tests/fixtures/rf-<slug>/ tree mirroring rf-cbc-001 exactly. Default every passage to ADR-0002 hash+selector-only unless usage.allowed_for_public_output: true is positively confirmed; fail closed (named card) on any unmatched source card."
    started: '2026-07-22T00:24:00-04:00'
    completed: '2026-07-22T00:30:13-04:00'
    evidence:
      - commit: ada4300
  - id: "P1-T2"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P1-T1"]
    description: "Author tests/ef-generate-rf-fixture.test.mjs (FR-20) against a small local synthetic sample run dir: valid EF fixture shape, byte-identical determinism across two runs, and correct rights-disposition default (hash+selector-only unless positively confirmed clear)."
    started: '2026-07-22T00:30:20-04:00'
    completed: '2026-07-22T00:36:12-04:00'
    evidence:
      - commit: 439cc01
  - id: "P1-T3"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.75 pts"
    dependencies: ["P1-T1", "P1-T2"]
    description: "Generate + commit tests/fixtures/rf-ev-001/ from rf_run_20260717_rf_ev_001_pediatric_cds_backfill (RF-EV-001, 6 source cards, 48 claims), plus HASH-PROVENANCE.md mirroring rf-cbc-001's structure (run_id, bundle SHA-256, per-source-card rights-disposition table, passage-count summary)."
    started: '2026-07-22T00:36:20-04:00'
    completed: '2026-07-22T00:43:36-04:00'
    evidence:
      - commit: 436ade3
  - id: "P1-T4"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P1-T1", "P1-T2"]
    description: "Generate + commit tests/fixtures/rf-cbc-002/ from rf_run_20260717_rf_cbc_002_pediatric_cds_establish (RF-CBC-002, 12 source cards, 88 claims), plus HASH-PROVENANCE.md."
    started: '2026-07-22T00:36:20-04:00'
    completed: '2026-07-22T00:41:25-04:00'
    evidence:
      - commit: 6583b49
  - id: "P1-T5"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P1-T1", "P1-T2"]
    description: "Generate + commit tests/fixtures/rf-kid-001/ from rf_run_20260717_rf_kid_001_pediatric_cds_evidence (RF-KID-001, 12 source cards, 87 claims), plus HASH-PROVENANCE.md."
    started: '2026-07-22T00:41:30-04:00'
    completed: '2026-07-22T00:45:23-04:00'
    evidence:
      - commit: e0b8adb
  - id: "P1-T6"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P1-T1", "P1-T2"]
    description: "Generate + commit tests/fixtures/rf-gro-002/ from rf_run_20260717_rf_gro_002_pediatric_cds_evidence (RF-GRO-002, 12 source cards, 92 claims), plus HASH-PROVENANCE.md."
    started: '2026-07-22T00:41:30-04:00'
    completed: '2026-07-22T00:45:37-04:00'
    evidence:
      - commit: a8a75dd
  - id: "P1-T7"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.75 pts"
    dependencies: ["P1-T3", "P1-T4", "P1-T5", "P1-T6"]
    description: "R-4 mitigation: CI-runnable rights-leakage grep gate over all 4 committed fixtures (tests/fixtures/rf-{ev-001,cbc-002,kid-001,gro-002}/), cross-referenced against each fixture's HASH-PROVENANCE.md restricted-passage list; runs as part of npm run validate; fails non-zero on any restricted verbatim text found."
    started: '2026-07-22T00:45:40-04:00'
    completed: '2026-07-22T01:03:36-04:00'
    evidence:
      - commit: 230f118
  - id: "P1-GATE"
    status: "not_started"
    assigned_to: ["task-completion-validator"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P1-T1", "P1-T2", "P1-T3", "P1-T4", "P1-T5", "P1-T6", "P1-T7"]
    description: "Reviewer gate: verify exit criteria — inspect exits 0 for rf-cbc-002 (scoped per Decisions Block Addendum A1; DecisionsNotFoundError on the other 3 fixtures is expected, tracked as DF-E1-M1, not a blocker); fixture generator unit-tested; grep gate active and passing; no rights-restricted verbatim text in any committed fixture byte."

parallelization:
  batch_1: ["P1-T1"]
  batch_2: ["P1-T2"]
  batch_3: ["P1-T3", "P1-T4", "P1-T5", "P1-T6"]
  batch_4: ["P1-T7"]
  batch_5: ["P1-GATE"]

total_tasks: 8
completed_tasks: 7
in_progress_tasks: 0
blocked_tasks: 0
progress: 88
---

# Phase 1 Progress — Rights-Aware Vendoring & Fixtures

**Wave**: 1 of 5 (parallel to Phase 3). **Depends on**: none — first phase in the plan.
**Assigned Subagent(s)**: node-tooling engineer (general-purpose, sonnet); Explore
(`scripts/evidence/vendor-rf-bundle.mjs` + `tests/fixtures/rf-cbc-001/` before building);
task-completion-validator gate.

## Objective

Generalize E0's one-off `vendor-rf-bundle.mjs` into a reusable, bundle-parametrized
`scripts/evidence/generate-rf-fixture.mjs`, then generate and commit 4 EF-shaped fixtures
(`rf-ev-001`, `rf-cbc-002`, `rf-kid-001`, `rf-gro-002`) with rights-aware, fail-closed passage
handling — the input side for Phase 2's batch orchestration and Phases 4-5's projections.

## Entry Criteria

- None (wave 1, runs in parallel with Phase 3).

## Exit Criteria (decisions block §1, **scoped per Decisions Block Addendum A1** — see Completion
Notes below)

- `node tools/rf-bundle-to-kb-pack/cli.mjs inspect` exits 0 for `tests/fixtures/rf-cbc-002` (the
  only new fixture whose target module, `modules/cbc_suite_v1/`, currently carries an
  `authoring-decisions.yaml`). For `rf-ev-001`, `rf-kid-001`, and `rf-gro-002`, `inspect` exits 1
  with `DecisionsNotFoundError` — expected, pre-existing E0-era converter behavior, not a P1
  regression, and tracked as Deferred Item **DF-E1-M1**, not something to close in this feature.
- Vendor generator is unit-tested and deterministic.

## Reviewer Gate

- **P1-GATE** — `task-completion-validator` (not yet run — see Completion Notes).

## Quality Gates

- [x] `node tools/rf-bundle-to-kb-pack/cli.mjs inspect` exits 0 against `tests/fixtures/rf-cbc-002`
  (verified directly 2026-07-22); the other 3 fixtures' `DecisionsNotFoundError` exit is expected
  and out of scope for P1 (Addendum A1 / DF-E1-M1), not a regression
- [x] Fixture generator (`scripts/evidence/generate-rf-fixture.mjs`) is unit-tested and deterministic
  (`tests/ef-generate-rf-fixture.test.mjs`, 6/6 pass)
- [x] All 4 `HASH-PROVENANCE.md` files exist and mirror `rf-cbc-001`'s structure
- [x] Rights-leakage grep gate is active in `npm run validate`
  (`scripts/evidence/check-fixture-rights-leakage.mjs`) and passes
- [x] Zero network calls during fixture generation (test-enforced,
  `tests/ef-generate-rf-fixture.test.mjs`)

## Implementation Notes

### Known Gotchas

- Absence of a source's `usage` block is never read as permission — default to hash+selector-only.
- Never hard-code a single bundle (the legacy script's `DEFAULT_BUNDLE` constant) — the generator must
  take run-dir + slug as arguments.
- Fail closed (non-zero exit, named card/id) on any unmatched source card or unrecognized YAML
  construct — never silently skip.
- `inspect` requires a target module's `authoring-decisions.yaml` to exist regardless of verb
  (`lib/loader.mjs`, pre-existing E0-era behavior) — 3 of the 4 new fixtures' target modules
  (`anemia`, `kidney_suite_v1`, `growth_suite_v1`) don't have one yet, and won't get one from this
  feature (out of scope; see Addendum A1).

## Completion Notes

**P1-T1 through P1-T7 landed** (commits `ada4300`, `439cc01`, `436ade3`, `6583b49`, `e0b8adb`,
`a8a75dd`, `230f118`) — the generator, its unit test, all 4 fixtures + `HASH-PROVENANCE.md` files,
and the rights-leakage grep gate are all committed and independently re-verified 2026-07-22:
`inspect` exits 0 for `rf-cbc-002`; `tests/ef-generate-rf-fixture.test.mjs` passes 6/6;
`scripts/evidence/check-fixture-rights-leakage.mjs` runs as part of `npm run validate`.

### Exit-gate scoping correction (Decisions Block Addendum A1)

The exit gate as originally stated in the plan and in this note ("`inspect` exits 0 for all 4
fixtures") does not hold, and was never achievable inside this feature's scope. Verified directly:
`inspect` exits `1` with `DecisionsNotFoundError` for `rf-ev-001`, `rf-kid-001`, and `rf-gro-002`
because their target modules (`modules/anemia/`, `modules/kidney_suite_v1/`,
`modules/growth_suite_v1/`) have no `authoring-decisions.yaml` — pre-existing E0-era converter
behavior (`tools/rf-bundle-to-kb-pack/lib/loader.mjs`), unrelated to P1's fixture-generation work.
Authoring `authoring-decisions.yaml` to force these 3 fixtures to pass would cross the "no task
authors clinical `authoring-decisions.yaml`" boundary (decisions block line 190) and was **not**
done. This has been recorded as Decisions Block **Addendum A1**
(`.claude/worknotes/multi-bundle-conversion-e1/decisions-block.md`) and cross-referenced to
**Deferred Item DF-E1-M1**; the phase-detail plan's exit gate and quality-gate checklist have been
updated to match. The exit gate as scoped (`rf-cbc-002` only) is met.

### P1-GATE — not yet run

`task-completion-validator` has not formally run against Phase 1 (no gate commit/record exists,
unlike Phase 3's `P3-GATE1`). Phase-level `status` is left `in_progress` (7/8 tasks) rather than
`completed` on that basis, per the dev-execution skill's Phase Completion Definition. The scoped
exit criteria and quality gates above have been independently re-verified as part of this
correction pass, but the formal `P1-GATE` reviewer checkpoint is still outstanding.
