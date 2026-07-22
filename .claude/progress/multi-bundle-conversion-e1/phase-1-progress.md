---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1"
feature_slug: "multi-bundle-conversion-e1"
phase: 1
title: "Rights-Aware Vendoring & Fixtures"
status: "not_started"
created: '2026-07-21'
updated: '2026-07-21'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-1-2-vendoring-batch-orchestration.md
commit_refs: []
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 1
depends_on: []
owners: ["node-tooling-engineer"]
contributors: []

tasks:
  - id: "P1-T1"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "1.5 pts"
    dependencies: []
    description: "Generalize scripts/evidence/vendor-rf-bundle.mjs into a bundle-parametrized scripts/evidence/generate-rf-fixture.mjs (FR-1): takes run-dir + fixture slug args, emits an EF-shaped tests/fixtures/rf-<slug>/ tree mirroring rf-cbc-001 exactly. Default every passage to ADR-0002 hash+selector-only unless usage.allowed_for_public_output: true is positively confirmed; fail closed (named card) on any unmatched source card."
  - id: "P1-T2"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P1-T1"]
    description: "Author tests/ef-generate-rf-fixture.test.mjs (FR-20) against a small local synthetic sample run dir: valid EF fixture shape, byte-identical determinism across two runs, and correct rights-disposition default (hash+selector-only unless positively confirmed clear)."
  - id: "P1-T3"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.75 pts"
    dependencies: ["P1-T1", "P1-T2"]
    description: "Generate + commit tests/fixtures/rf-ev-001/ from rf_run_20260717_rf_ev_001_pediatric_cds_backfill (RF-EV-001, 6 source cards, 48 claims), plus HASH-PROVENANCE.md mirroring rf-cbc-001's structure (run_id, bundle SHA-256, per-source-card rights-disposition table, passage-count summary)."
  - id: "P1-T4"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P1-T1", "P1-T2"]
    description: "Generate + commit tests/fixtures/rf-cbc-002/ from rf_run_20260717_rf_cbc_002_pediatric_cds_establish (RF-CBC-002, 12 source cards, 88 claims), plus HASH-PROVENANCE.md."
  - id: "P1-T5"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P1-T1", "P1-T2"]
    description: "Generate + commit tests/fixtures/rf-kid-001/ from rf_run_20260717_rf_kid_001_pediatric_cds_evidence (RF-KID-001, 12 source cards, 87 claims), plus HASH-PROVENANCE.md."
  - id: "P1-T6"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P1-T1", "P1-T2"]
    description: "Generate + commit tests/fixtures/rf-gro-002/ from rf_run_20260717_rf_gro_002_pediatric_cds_evidence (RF-GRO-002, 12 source cards, 92 claims), plus HASH-PROVENANCE.md."
  - id: "P1-T7"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.75 pts"
    dependencies: ["P1-T3", "P1-T4", "P1-T5", "P1-T6"]
    description: "R-4 mitigation: CI-runnable rights-leakage grep gate over all 4 committed fixtures (tests/fixtures/rf-{ev-001,cbc-002,kid-001,gro-002}/), cross-referenced against each fixture's HASH-PROVENANCE.md restricted-passage list; runs as part of npm run validate; fails non-zero on any restricted verbatim text found."
  - id: "P1-GATE"
    status: "not_started"
    assigned_to: ["task-completion-validator"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P1-T1", "P1-T2", "P1-T3", "P1-T4", "P1-T5", "P1-T6", "P1-T7"]
    description: "Reviewer gate: verify exit criteria — inspect exits 0 for all 4 fixtures; fixture generator unit-tested; grep gate active and passing; no rights-restricted verbatim text in any committed fixture byte."

parallelization:
  batch_1: ["P1-T1"]
  batch_2: ["P1-T2"]
  batch_3: ["P1-T3", "P1-T4", "P1-T5", "P1-T6"]
  batch_4: ["P1-T7"]
  batch_5: ["P1-GATE"]

total_tasks: 8
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
progress: 0
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

## Exit Criteria (decisions block §1)

- `node tools/rf-bundle-to-kb-pack/cli.mjs inspect` exits 0 for all 4 fixtures.
- Vendor generator is unit-tested and deterministic.

## Reviewer Gate

- **P1-GATE** — `task-completion-validator`.

## Quality Gates

- [ ] `node tools/rf-bundle-to-kb-pack/cli.mjs inspect` exits 0 against all 4 new fixtures
- [ ] Fixture generator (`scripts/evidence/generate-rf-fixture.mjs`) is unit-tested and deterministic
- [ ] All 4 `HASH-PROVENANCE.md` files exist and mirror `rf-cbc-001`'s structure
- [ ] Rights-leakage grep gate is active in `npm run check`/`npm run validate` and passes
- [ ] Zero network calls during fixture generation (test-enforced)

## Implementation Notes

### Known Gotchas

- Absence of a source's `usage` block is never read as permission — default to hash+selector-only.
- Never hard-code a single bundle (the legacy script's `DEFAULT_BUNDLE` constant) — the generator must
  take run-dir + slug as arguments.
- Fail closed (non-zero exit, named card/id) on any unmatched source card or unrecognized YAML
  construct — never silently skip.

## Completion Notes

_Not started. Fill in when phase work begins._
