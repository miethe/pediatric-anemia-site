---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-7: Review Contract & Docs"
status: completed
created: 2026-07-19
updated: 2026-07-21
phase: EP-7
phase_title: "Review Contract & Docs"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
feature_slug: wave0-safety-foundation
entry_criteria: "EP-0 closed (design work can start); doc-truth-up tasks wait on EP-6 sealing."
exit_criteria: "Review-record schema emits approvedBy[] shape; all stale doc claims corrected; all 3 deferred items have a design-spec path; karen end-of-feature review passed."
changelog_ref: CHANGELOG.md
findings_doc_ref: .claude/findings/wave0-ep7-review-contract-and-docs-findings.md
files_affected:
  - schemas/review-record.schema.json
  - schemas/examples/review-record.example.json
  - tests/review-record-schema.test.mjs
  - docs/project_plans/design-specs/review-portal-design.md
  - docs/project_plans/design-specs/public-moduleid-api-surface.md
  - docs/project_plans/design-specs/algorithm-explainers-examples-relocation.md
  - docs/project_plans/design-specs/headless-browser-runtime-smoke-check.md
  - docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
  - docs/architecture.md
  - docs/clinical-algorithm.md
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  - README.md
  - CLAUDE.md
  - CHANGELOG.md
commit_refs: []  # populated in the follow-up closeout commit
---

# Phase EP-7: Review Contract & Docs (WP7)

**Maps to roadmap/PRD WP7.** **4 pts.** Formally depends only on EP-0 (paper design has no code
dependency) but is **scheduled last** in the wave list — the doc-truth-up half needs EP-6's shipped
state to describe accurately, so this phase starts early and seals last, matching the decisions
block's "P7 ∥ everything" note.

**Dependencies**: EP-0 complete (can start the review-record contract design immediately); doc-truth-up
tasks (EP7-T4, EP7-T5, EP7-T6, EP7-T7) wait until EP-6 seals.
**Assigned Subagent(s)**: `documentation-writer` (contract design, doc updates); `artifact-tracker`
(closeout).
**Entry criteria**: EP-0 done for the contract-design tasks; EP-6 sealed for the doc-truth-up tasks.
**Exit criteria**: `schemas/review-record.schema.json` round-trips a hand-authored example through all 4
workflow states; all deferred items have a design-spec path; all stale path/count references corrected;
`karen` end-of-feature review passed.

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EP7-T1 | `schemas/review-record.schema.json` | Per FR-WP7-01: data contract only (not the app) for change-proposal → dual-review → conflict-resolution → approval, emitting the `approvedBy[]` shape EP-5's manifest consumes. | Schema round-trips a hand-authored example record through all 4 workflow states. | 1.0 pt | documentation-writer | sonnet | high | EP-0 |
| EP7-T2 | Review-portal design doc | Per FR-WP7-02, FR-WP7-03: describe workflow states (proposed/under-review/disputed/approved/rejected) and role vocabulary in `docs/`. Cross-reference ARC's council seat taxonomy as a role-vocabulary input only — **not** an approval source (D-4 applies here too). | Doc exists, cross-references ARC's seat taxonomy, and contains an explicit non-goal statement that ARC review output is not an eligible source for `approvedBy[]` — not merely an omission. | 1.0 pt | documentation-writer | sonnet | high | EP7-T1 |
| EP7-T3 | DOC-006 — author design specs for DEF-6, DEF-7, DEF-8 | One task per row in the main plan's Deferred Items Triage Table (all 3 carried forward from Phase 0, none new). For each: refresh `docs/project_plans/design-specs/{public-moduleid-api-surface,algorithm-explainers-examples-relocation,headless-browser-runtime-smoke-check}.md` — confirm each is still correctly deferred given what this phase actually shipped (e.g., DEF-8's rationale depends on whether EP-1/EP-2 stayed inside the Phase-0 shim boundary). | All 3 specs refreshed with `prd_ref` set to this plan's parent PRD; `deferred_items_spec_refs` frontmatter populated with all 3 paths. | 0.5 pts | documentation-writer | sonnet | adaptive | EP-6 |
| EP7-T4 | Fix stale `data/*.json` path references | Correct pre-Phase-0 path references still present in `README.md` (directory tree `:117-119`, pipeline diagram `:84-86`), `docs/clinical-algorithm.md` (`:3,294`, "described in `data/rules.json`"), and `docs/project_plans/expansion/01-platform-expansion-roadmap.md` (Phase 1 WP table, `:158` "`data/rules.json` migration", `:160-161` "`data/*/evidence.json`"/"`data/*/rules.json`") to the current `modules/anemia/*.json` paths. | Zero remaining `data/rules.json`/`data/candidates.json`/`data/evidence.json` references in the 3 named files; roadmap doc's WP1/WP3/WP4 file-path columns read `modules/anemia/*`. | 0.5 pts | documentation-writer | haiku | adaptive | EP-6 |
| EP7-T5 | Correct stale test-count claim + governance/manifest doc updates | `README.md:96` claims "10 automated engine tests" — already stale pre-this-phase (post-Phase-0 count is 20 `node --test` subtests across 3 files) and now badly stale once EP-6 adds 4 new suites. Update the count to reflect the shipped total. Also update `docs/architecture.md` §6/§7/§10 and `CLAUDE.md`'s hard-guardrails/architecture-orientation block (≤3-line pointer convention) to reflect tri-state facts, fail-closed units, exact-passage evidence, governed rule metadata, and the verified manifest. | README's test-count claim matches the actual `npm test` output; `docs/architecture.md` and `CLAUDE.md` reflect the shipped substrate without restating detail (pointer-only in CLAUDE.md). | 0.5 pts | documentation-writer | haiku | adaptive | EP-6 |
| EP7-T6 | CHANGELOG `[Unreleased]` entry | Per `changelog_required: true`: add an entry categorizing this phase's user-facing/behavioral changes (tri-state input shape, fail-closed unit rejection, honest `not-assessed` representation) per `.claude/specs/changelog-spec.md`. | Entry exists under `[Unreleased]` with correct categorization; `changelog_ref` frontmatter set to `CHANGELOG.md`. | 0.25 pts | documentation-writer | haiku | adaptive | EP-6 |
| EP7-T7 | Plan frontmatter finalization & findings closeout | Set plan `status: completed`, populate `commit_refs`/`files_affected`/`updated`; if `findings_doc_ref` was populated during execution, finalize it (`draft` → `accepted`); otherwise record "N/A — no findings captured." | Frontmatter lifecycle fields complete; findings doc finalized or explicitly N/A. | 0.25 pts | artifact-tracker | haiku | adaptive | EP7-T3, EP7-T4, EP7-T5, EP7-T6 |

**Phase total: 4 pts.**

## Phase EP-7 Quality Gates

- [ ] Review-record schema round-trips all 4 workflow states (EP7-T1)
- [ ] Design doc contains an explicit D-4 non-goal statement (EP7-T2)
- [ ] All 3 deferred items (DEF-6, DEF-7, DEF-8) have a current design-spec path;
      `deferred_items_spec_refs` populated (EP7-T3)
- [ ] Zero stale `data/*.json` references remain in README, clinical-algorithm.md, or the roadmap doc
      (EP7-T4)
- [ ] Test-count and architecture docs match shipped state (EP7-T5)
- [ ] CHANGELOG `[Unreleased]` entry present (EP7-T6)
- [ ] Plan frontmatter complete; findings doc finalized or N/A (EP7-T7)
- [ ] **`karen` end-of-feature review passed** — confirms no clinical-threshold edits crept into any
      phase, confirms D-1..D-5 held across the whole diff, confirms the V1 clinical-sign-off half is
      honestly recorded `not_executed_owner_held`, never implied closed
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../wave0-safety-foundation-v1.md)
