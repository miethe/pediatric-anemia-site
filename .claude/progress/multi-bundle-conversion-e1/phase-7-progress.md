---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1"
feature_slug: "multi-bundle-conversion-e1"
phase: 7
title: "Docs & Deferred-Items Design Specs"
status: "in_progress"
created: '2026-07-21'
updated: '2026-07-23'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-5-6-7-projection-determinism-docs.md
commit_refs: ["263120b"]
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 5
depends_on: ["P6"]
owners: ["documentation-writer"]
contributors: []

tasks:
  - id: "P7-T1"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P6-GATE2"]
    description: "DOC-006a. Design spec: rule-authoring workflow per module. Author docs/project_plans/design-specs/rule-authoring-workflow-per-module.md (maturity: idea — needs ADR-0001 accepted first) for Deferred Item DF-E1-M1, prd_ref set to this feature's PRD. Append path to plan's deferred_items_spec_refs frontmatter. CONSTRAINT (added post-Phase-6 review): only rf-cbc-002 -> cbc_suite_v1 completed the converter's inspect->verify->propose pipeline end to end (FR-14 module scoping, tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40); anemia/kidney_suite_v1/growth_suite_v1's evidence artifacts were produced by bespoke, uncommitted projection scripts, not the converter (DF-E1-M1). This doc MUST describe only rf-cbc-002 -> cbc_suite_v1 as an end-to-end converter conversion, and the other 3 as bespoke evidence projections pending DF-E1-M1."
    evidence:
      - commit: "263120b"
  - id: "P7-T2"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P6-GATE2"]
    description: "DOC-006b. Design spec: clinical-review-portal intake of E1 artifacts. Author docs/project_plans/design-specs/clinical-review-portal-intake-e1-artifacts.md (maturity: idea — needs ADR-0004 accepted first) for Deferred Item DF-E1-M2, describing how a future portal would surface this pass's conflict objects, unresolved.json, and candidate scaffolds. Append path to deferred_items_spec_refs. CONSTRAINT (added post-Phase-6 review): only rf-cbc-002 -> cbc_suite_v1 completed the converter's inspect->verify->propose pipeline end to end (FR-14 module scoping, tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40); anemia/kidney_suite_v1/growth_suite_v1's evidence artifacts were produced by bespoke, uncommitted projection scripts, not the converter (DF-E1-M1). This doc MUST describe only rf-cbc-002 -> cbc_suite_v1 as an end-to-end converter conversion, and the other 3 as bespoke evidence projections pending DF-E1-M1."
    evidence:
      - commit: "263120b"
  - id: "P7-T3"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P6-GATE2"]
    description: "DOC-006c. Design spec: REG-001/REG-004 legal sign-off routing. Author docs/project_plans/design-specs/reg-001-004-legal-signoff-routing.md (maturity: idea, category: policy-flavored) for Deferred Item DF-EXT-M1, cross-referencing P6-T1's HOLD record and rf-handoff/RESULTS.md §5. States explicitly this is an owner/legal-team action, not an engineering task. Append path to deferred_items_spec_refs. CONSTRAINT (added post-Phase-6 review): only rf-cbc-002 -> cbc_suite_v1 completed the converter's inspect->verify->propose pipeline end to end (FR-14 module scoping, tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40); anemia/kidney_suite_v1/growth_suite_v1's evidence artifacts were produced by bespoke, uncommitted projection scripts, not the converter (DF-E1-M1). This doc MUST describe only rf-cbc-002 -> cbc_suite_v1 as an end-to-end converter conversion, and the other 3 as bespoke evidence projections pending DF-E1-M1."
    evidence:
      - commit: "263120b"
  - id: "P7-T4"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.75 pts"
    dependencies: ["P6-GATE2", "P4-T3"]
    description: "DOC-006d. Design spec: anemia backfill reconciliation procedure. Author docs/project_plans/design-specs/anemia-backfill-reconciliation-procedure.md (maturity: idea) for Deferred Item DF-E1-M3, expanding P4-T3's in-repo seam note into the 3 candidate reconciliation options the PRD names (leave-parallel / generate-citations-from-assertions / deprecate-EP-3-pipeline-role) without deciding among them. Append path to deferred_items_spec_refs; update P4-T3's note with a forward link. CONSTRAINT (added post-Phase-6 review): only rf-cbc-002 -> cbc_suite_v1 completed the converter's inspect->verify->propose pipeline end to end (FR-14 module scoping, tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40); anemia/kidney_suite_v1/growth_suite_v1's evidence artifacts were produced by bespoke, uncommitted projection scripts, not the converter (DF-E1-M1). This doc MUST describe only rf-cbc-002 -> cbc_suite_v1 as an end-to-end converter conversion, and the other 3 as bespoke evidence projections pending DF-E1-M1."
    evidence:
      - commit: "263120b"
  - id: "P7-T5"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.25 pts"
    dependencies: ["P6-GATE2"]
    description: "CHANGELOG [Unreleased] entry (FR-23, changelog_required: true): add an entry describing the batch pass, the 2 new module scaffolds, and the explicit 'zero new rules produced' outcome — never described as a content release or a step toward one. Follow .claude/specs/changelog-spec.md categorization. Set changelog_ref: CHANGELOG.md in plan frontmatter. CONSTRAINT (added post-Phase-6 review): only rf-cbc-002 -> cbc_suite_v1 completed the converter's inspect->verify->propose pipeline end to end (FR-14 module scoping, tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40); anemia/kidney_suite_v1/growth_suite_v1's evidence artifacts were produced by bespoke, uncommitted projection scripts, not the converter (DF-E1-M1). This doc MUST describe only rf-cbc-002 -> cbc_suite_v1 as an end-to-end converter conversion, and the other 3 as bespoke evidence projections pending DF-E1-M1."
    evidence:
      - commit: "263120b"
  - id: "P7-T6"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P6-GATE2"]
    description: "docs/architecture.md module inventory update (FR-23): update §2a's module inventory to list all 4 modules (anemia, cbc_suite_v1, kidney_suite_v1, growth_suite_v1) and note the REG-001/REG-004 HOLD-record convention as the pattern for any future legal-review-flagged bundle. CONSTRAINT (added post-Phase-6 review): only rf-cbc-002 -> cbc_suite_v1 completed the converter's inspect->verify->propose pipeline end to end (FR-14 module scoping, tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40); anemia/kidney_suite_v1/growth_suite_v1's evidence artifacts were produced by bespoke, uncommitted projection scripts, not the converter (DF-E1-M1). This doc MUST describe only rf-cbc-002 -> cbc_suite_v1 as an end-to-end converter conversion, and the other 3 as bespoke evidence projections pending DF-E1-M1."
    evidence:
      - commit: "263120b"
  - id: "P7-T7"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P6-GATE2"]
    description: "rf-handoff/RESULTS.md §7 + IntentTree EF-WP1 status update: update docs/project_plans/expansion/rf-handoff/RESULTS.md §7 to reflect EF-WP1 as implemented (was 'not started' as of 2026-07-19) and this pass's 4-bundle conversion outcome; note the IntentTree tree (tree_01KXQ7WC1HQE2GKZSCNDVXA9G7) status for the corresponding node(s) is known-stale per this repo's CLAUDE.md caveat and should be verified against this commit, not assumed current."
    evidence:
      - commit: "263120b"
  - id: "P7-T8"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P7-T1", "P7-T2", "P7-T3", "P7-T4", "P7-T5", "P7-T6", "P7-T7"]
    description: "Human brief close-out + plan frontmatter finalization: update docs/project_plans/human-briefs/multi-bundle-conversion-e1.md §9 Running Log with a closing entry; set this plan's frontmatter status: completed (only after karen sign-off at P7-GATE2), populate commit_refs, pr_refs, finalize files_affected against the actual diff, set changelog_ref. CONSTRAINT (added post-Phase-6 review): only rf-cbc-002 -> cbc_suite_v1 completed the converter's inspect->verify->propose pipeline end to end (FR-14 module scoping, tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40); anemia/kidney_suite_v1/growth_suite_v1's evidence artifacts were produced by bespoke, uncommitted projection scripts, not the converter (DF-E1-M1). This doc MUST describe only rf-cbc-002 -> cbc_suite_v1 as an end-to-end converter conversion, and the other 3 as bespoke evidence projections pending DF-E1-M1."
    evidence:
      - commit: "263120b"
  - id: "P7-GATE1"
    status: "not_started"
    assigned_to: ["task-completion-validator"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P7-T1", "P7-T2", "P7-T3", "P7-T4", "P7-T5", "P7-T6", "P7-T7", "P7-T8"]
    description: "Reviewer gate: verify exit criteria — all 4 design specs exist and are linked in deferred_items_spec_refs; CHANGELOG entry present; architecture/RESULTS.md docs updated; plan frontmatter finalized; every design spec/CHANGELOG entry/architecture.md/human brief this phase produced describes only rf-cbc-002 -> cbc_suite_v1 as an end-to-end converter conversion and the other 3 bundles' evidence artifacts as bespoke evidence projections pending DF-E1-M1."
  - id: "P7-GATE2"
    status: "not_started"
    assigned_to: ["karen"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P7-GATE1"]
    description: "karen end-of-feature review (Tier-3 reviewer gate, final of 3 named milestones). Independently re-check against the full feature diff (Phases 1-7): every CLAUDE.md hard guardrail and every PRD §7 non-goal explicitly checked, not assumed compliant; the 'zero new rules' outcome and both greenfield modules' 'not yet implemented' labeling independently spot-checked by reading the emitted content, not only the test suite; all 4 deferred-item design specs exist and are correctly cross-referenced; REG-001/REG-004 never touched by any converter artifact anywhere in the final diff. This is the feature's final gate — nothing merges without it."

parallelization:
  batch_1: ["P7-T1", "P7-T2", "P7-T3", "P7-T4", "P7-T5", "P7-T6", "P7-T7"]
  batch_2: ["P7-T8"]
  batch_3: ["P7-GATE1"]
  batch_4: ["P7-GATE2"]

total_tasks: 10
completed_tasks: 8
in_progress_tasks: 0
blocked_tasks: 0
progress: 80
---

# Phase 7 Progress — Docs & Deferred-Items Design Specs

**Wave**: 5 of 5 (final phase). **Depends on**: Phase 6 complete.
**Assigned Subagent(s)**: documentation writer (general-purpose, sonnet); task-completion-validator
gate; **karen end-of-feature review** (final of 3 named Tier-3 gates).

## Objective

Author one design-spec authoring task (DOC-006 style) per row of the parent plan's Deferred Items
Triage Table, close the CHANGELOG/architecture/RESULTS.md/human-brief loop, and pass the feature's
final `karen` end-of-feature review before the plan is considered complete.

## Entry Criteria

- Phase 6 complete (`P6-GATE2`, `karen` sign-off).

## Exit Criteria

- All 4 deferred-item design specs authored and linked in `deferred_items_spec_refs`.
- `findings_doc_ref` is either `null` (no findings) or finalized at `status: accepted`.
- `karen` end-of-feature review passed — feature is not considered complete until this gate passes.

## Reviewer Gate

- **P7-GATE1** — `task-completion-validator`.
- **P7-GATE2** — `karen` end-of-feature review (feature's final gate; nothing merges without it).

## Deferred Items Closed This Phase

| Item ID | Category | Task | Target Spec Path |
|---------|----------|------|-------------------|
| DF-E1-M1 | design | P7-T1 | `docs/project_plans/design-specs/rule-authoring-workflow-per-module.md` |
| DF-E1-M2 | prereq | P7-T2 | `docs/project_plans/design-specs/clinical-review-portal-intake-e1-artifacts.md` |
| DF-EXT-M1 | policy | P7-T3 | `docs/project_plans/design-specs/reg-001-004-legal-signoff-routing.md` |
| DF-E1-M3 | research | P7-T4 | `docs/project_plans/design-specs/anemia-backfill-reconciliation-procedure.md` |

## Quality Gates

*Validated at P7-GATE1 (task-completion-validator):*
- [ ] All 4 deferred-item design specs exist; `deferred_items_spec_refs` frontmatter populated with all 4 paths
- [ ] `CHANGELOG.md` `[Unreleased]` entry present, correctly categorized
- [ ] `docs/architecture.md` and `rf-handoff/RESULTS.md` §7 updated
- [ ] Plan frontmatter finalized (`commit_refs`, `pr_refs`, `files_affected`, `changelog_ref`)
- [ ] Every design spec, the CHANGELOG entry, `architecture.md`, and the human brief describe only `rf-cbc-002` -> `cbc_suite_v1` as an end-to-end converter conversion, and `anemia`/`kidney_suite_v1`/`growth_suite_v1`'s evidence artifacts as bespoke evidence projections pending DF-E1-M1

*Validated at P7-GATE2 (`karen` end-of-feature review):*
- [ ] Every CLAUDE.md hard guardrail and PRD §7 non-goal explicitly checked against the actual diff
- [ ] "Zero new rules" outcome and "not yet implemented" labeling independently spot-checked by direct read
- [ ] `karen` sign-off recorded — feature considered complete only after this gate

## Completion Notes

**Resync, 2026-07-23 (`multi-bundle-conversion-e1-finish`, task P5-T2a).** This tracker's frontmatter
(`status: not_started`, `completed_tasks: 0`) was stale against the committed repository state.
Direct verification confirms P7-T1..P7-T8 all landed, all in the squash-merge commit `263120b`
(PR #22): all 4 deferred-item design specs exist on disk and are linked in the plan's
`deferred_items_spec_refs` frontmatter (`docs/project_plans/design-specs/rule-authoring-workflow-per-module.md`,
`clinical-review-portal-intake-e1-artifacts.md`, `reg-001-004-legal-signoff-routing.md`,
`anemia-backfill-reconciliation-procedure.md`); `CHANGELOG.md` carries the
"Multi-Bundle Conversion (E1)" `[Unreleased]` entry; `docs/architecture.md` §2a lists all 4
modules; `docs/project_plans/expansion/rf-handoff/RESULTS.md` §7 was updated (explicitly stating
EF-WP0/EF-WP1 as "partial — 1 of 4 bundles", not implemented-for-all-4); the human brief's §9
Running Log carries a P7-T8 closing entry; and the plan document's own frontmatter reads
`status: completed`. Task statuses above are corrected to `completed` (evidence: commit `263120b`)
accordingly.

**Not corrected, left accurate**: `P7-GATE1` (`task-completion-validator`) and `P7-GATE2` (`karen`
end-of-feature review) both remain `status: not_started` in this file — no formal gate-run record
for either exists anywhere in this repo's history, matching the same pattern already documented in
Phases 1, 2, 4, 5, and 6's own trackers. This tracker does not assert those two reviewer gates ran;
whatever review actually preceded the PR #22 merge is not reconstructable from this tracker alone.

### Superseded by `multi-bundle-conversion-e1-finish` (2026-07-23)

Noted so this tracker is not read as contradicting
`.claude/progress/multi-bundle-conversion-e1-finish/`: this phase's docs/design-spec/CHANGELOG
deliverables are the direct predecessors that findings-doc §"Phase 6/7 Findings" and the successor
plan (`docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md`) continue —
notably the successor plan authors its *own*, differently-named design specs
(`docs/project_plans/design-specs/df-e1-m1-rule-authoring-workflow.md`,
`df-e1-m3-anemia-reconciliation.md`) rather than re-opening these 4. Zero new clinical rules were
emitted in either plan; this repo remains an unvalidated research prototype.
