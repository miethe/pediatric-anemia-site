---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1-finish"
feature_slug: "multi-bundle-conversion-e1-finish"
phase: 5
title: "Honesty Reconciliation, Docs, Findings Closure"
status: "not_started"
created: '2026-07-23'
updated: '2026-07-23'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish/phase-4-5-batch-determinism-docs.md
commit_refs: []
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 6
depends_on: ["P4"]
owners: ["ica-executor", "general-purpose"]
contributors: ["task-completion-validator", "karen"]
findings_doc_ref: null

tasks:
  - id: "P5-T1"
    status: "not_started"
    assigned_to: ["ica-executor"]
    model: "claude-haiku-4-5"
    model_effort: "low"
    provider: "ICA free-tier"
    estimated_effort: "0.25 pts"
    dependencies: ["P4-GATE"]
    must_stay_primary: false
    fr_refs: ["FR-F18"]
    description: "Verify FR-F18 (P1-T7 AC wording, prior plan) already resolved. Direct inspection confirms `phase-1-2-vendoring-batch-orchestration.md`'s row P1-T7 already states the real, scoped rights-leakage-gate coverage (fixed in commit 263120b, already merged). Verification-only pass: grep for any RESIDUAL 'greps every committed byte' overstated claim across docs/tools/scripts/README.md; fix any found; if none, record the finding as already-closed citing commit 263120b."
  - id: "P5-T2"
    status: "not_started"
    assigned_to: ["ica-executor"]
    model: "claude-haiku-4-5"
    model_effort: "low"
    provider: "ICA free-tier"
    estimated_effort: "0.5 pts"
    dependencies: ["P4-GATE"]
    must_stay_primary: false
    fr_refs: ["FR-F19"]
    description: "Resync prior plan's stale progress-tracking artifacts. Inspect .claude/progress/multi-bundle-conversion-e1/ for any per-phase file still reading in_progress/not_started for phases whose deliverables are committed. Mark accurate, or mark the tracker explicitly superseded by this plan's own .claude/progress/multi-bundle-conversion-e1-finish/ tracker — do not leave two contradictory trackers for the same converter surface."
  - id: "P5-T3"
    status: "not_started"
    assigned_to: ["ica-executor"]
    model: "claude-haiku-4-5"
    model_effort: "low"
    provider: "ICA free-tier"
    estimated_effort: "0.75 pts"
    dependencies: ["P4-GATE", "P4-T6"]
    must_stay_primary: false
    fr_refs: ["FR-F20"]
    description: "Update docs/architecture.md §2a module inventory table to reflect the converter's actual, current genericity: all 4 modules can now reach propose's emission gate; cbc_suite_v1 remains the sole rule-bearing module (SHA-256 byte-identical throughout); anemia/kidney_suite_v1/growth_suite_v1 each now have a non-approving authoring-decisions.yaml; document P4-T6's per-module semantic-diff closure-path result using the ACTUAL result, not a template placeholder. Cross-reference the FR-22/FR-F5 supersession (OQ-5) explicitly."
  - id: "P5-T4"
    status: "not_started"
    assigned_to: ["ica-executor"]
    model: "claude-haiku-4-5"
    model_effort: "low"
    provider: "ICA free-tier"
    estimated_effort: "0.5 pts"
    dependencies: ["P4-GATE"]
    must_stay_primary: false
    fr_refs: ["FR-F20"]
    description: "Update the converter runbook (tools/rf-bundle-to-kb-pack/README.md) documenting the new fail-closed allowlist gate (R-2), the module-generic drafting registry (OQ-2), and the runtime clm_*/evas_* cross-resolution guard (FR-F7) as part of propose's verb documentation. No claim of clinical validation or release-readiness anywhere."
  - id: "P5-T5"
    status: "not_started"
    assigned_to: ["ica-executor"]
    model: "claude-haiku-4-5"
    model_effort: "low"
    provider: "ICA free-tier"
    estimated_effort: "0.25 pts"
    dependencies: ["P4-GATE"]
    must_stay_primary: false
    fr_refs: ["FR-F21"]
    description: "CHANGELOG.md [Unreleased] entry describing: the code-enforced fail-closed allowlist gate; the module-generic converter; the 3 new non-approving decisions files; the 4-of-4 batch/determinism proof; the committed semantic-diff.json per non-cbc module; the explicit 'zero new clinical rules' outcome. Never described as a content release or a step toward one."
  - id: "P5-T6"
    status: "not_started"
    assigned_to: ["ica-executor"]
    model: "claude-haiku-4-5"
    model_effort: "low"
    provider: "ICA free-tier"
    estimated_effort: "0.25 pts"
    dependencies: ["P4-GATE"]
    must_stay_primary: false
    fr_refs: ["FR-F20", "OQ-6"]
    description: "Verify CLAUDE.md/check-gate final consistency (verification only, no new edit expected). Confirm tests/claudemd-check-gate.test.mjs is still green after all of P0-P4's changes; confirm no later phase introduced a further check-gate string change beyond P0-T8's one reorder."
  - id: "P5-T7"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "0.75 pts"
    dependencies: ["P4-GATE"]
    must_stay_primary: false
    fr_refs: ["FR-F22", "R-1"]
    description: "Create df-e1-m1-rule-authoring-workflow.md design spec (NEW file — R-1, does not exist today under this name, create rather than update). Author describing the deferred rule-authoring promotion workflow (how a decision's status gets promoted to approved_for_rule_draft). Cross-reference the differently-named prior artifact rule-authoring-workflow-per-module.md in related_documents — do not duplicate its content."
  - id: "P5-T8"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "0.75 pts"
    dependencies: ["P4-GATE", "P4-T6"]
    must_stay_primary: false
    fr_refs: ["FR-F22", "R-1"]
    description: "Create df-e1-m3-anemia-reconciliation.md design spec (NEW file — R-1). Describes the anemia evidence-layer reconciliation question between the EP-3/EP-4 pipeline's evidence.json and the converter's evidence-assertions.json/semantic-diff.json output, informed by P4-T4/T5/T6's actual empirical semantic-diff result for anemia (cite real added/removed/changed counts, not a placeholder). Cross-reference anemia-backfill-reconciliation-procedure.md."
  - id: "P5-T9"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "0.5 pts"
    dependencies: ["P4-GATE"]
    must_stay_primary: false
    fr_refs: ["FR-F22", "R-1"]
    description: "Create df-e1-m2-clinical-review-portal-intake.md design spec (NEW file — R-1) for the deferred clinical-review-portal intake of this pass's conflict objects / rule-proposals.json / unresolved.json / semantic-diff.json. Cross-reference clinical-review-portal-intake-e1-artifacts.md."
  - id: "P5-T10"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "0.5 pts"
    dependencies: ["P4-GATE"]
    must_stay_primary: false
    fr_refs: ["FR-F22", "R-1"]
    description: "Create df-ext-m1-legal-signoff-routing.md design spec (NEW file — R-1) for the deferred legal sign-off routing mechanism covering the 35 P0-backfilled sources' (and every pre-existing UNKNOWN-status source's) rights determinations. Cross-reference reg-001-004-legal-signoff-routing.md. Describes the ROUTING MECHANISM only — never the determination itself."
  - id: "P5-T11"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "1.0 pts"
    dependencies: ["P5-T1", "P5-T2", "P5-T3", "P5-T4", "P5-T5", "P5-T6", "P5-T7", "P5-T8", "P5-T9", "P5-T10"]
    must_stay_primary: false
    fr_refs: ["FR-F23"]
    description: "Author findings doc, closing prior findings #1/#3/#4. Create .claude/findings/multi-bundle-conversion-e1-finish-findings.md (lazy-created; set this plan's findings_doc_ref at this point if not already set by an earlier in-flight finding). Explicitly close out the prior pass's 3 tracked findings: #1 (shared-mutable-state test hazard, cross-ref P2-T5 fixing commit); #3 (unreproducible-provenance gap, cross-ref P4-T6's closure-path decision + fixing commits); #4 (P1-T7 AC overstatement, cross-ref commit 263120b). Record any NEW finding surfaced during this pass's own execution."
  - id: "P5-GATE"
    status: "not_started"
    assigned_to: ["task-completion-validator", "karen"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "—"
    dependencies: ["P5-T1", "P5-T2", "P5-T3", "P5-T4", "P5-T5", "P5-T6", "P5-T7", "P5-T8", "P5-T9", "P5-T10", "P5-T11"]
    must_stay_primary: false
    description: "End-of-feature review. Verify: all 4 design specs created (not updated); findings doc closes all 3 prior findings; CHANGELOG/README/architecture docs updated; CLAUDE.md/check-gate consistency holds; every hard guardrail in CLAUDE.md and every PRD §7 non-goal explicitly checked against this pass's actual diff, not assumed compliant. karen performs the final, whole-feature check that no artifact anywhere in this plan's total diff is described as clinically validated, approved, or release-ready, and that approvedBy[]/clinicalApprovers[] remain schema-forced empty on all 4 modules."

parallelization:
  batch_1: ["P5-T1", "P5-T2"]
  batch_2: ["P5-T3", "P5-T4", "P5-T5", "P5-T6", "P5-T7", "P5-T8", "P5-T9", "P5-T10"]
  batch_3: ["P5-T11"]
  batch_4: ["P5-GATE"]

total_tasks: 12
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
progress: 0
---

# multi-bundle-conversion-e1-finish - Phase 5: Honesty Reconciliation, Docs, Findings Closure

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

**Wave**: 6 of 6 (final phase). **Depends on**: Phase 4 complete (the code's actual, tested behavior
must be known before docs describing it are written).
**Assigned Subagent(s)**: `ica-executor` (`claude-haiku-4-5`, docs/runbook/CHANGELOG/tracker-resync —
mechanical, free-tier eligible); native Claude (`claude-sonnet-5`, design specs + findings doc —
architectural judgment content, not routed to haiku); `task-completion-validator` + `karen`
(end-of-feature review).

## Objective

Close the honesty ledger: resync/supersede the prior plan's stale tracker, update docs/runbook/
CHANGELOG, author 4 **newly-created** (not updated — R-1) deferred-item design specs, and author a
findings doc retiring the prior pass's three tracked findings (#1 test hazard, #3 unreproducible
provenance, #4 P1-T7 AC overstatement).

## Entry Criteria

- Phase 4 complete (the code's actual, tested behavior must be known before docs describing it are
  written — writing docs earlier is how the prior pass's own P6-T3 AC/reality mismatch happened).

## Exit Criteria (decisions block §1)

No doc claims more than the code does; a reviewer can trace every honesty claim to a test.

## Model / Provider Assignment

| Task | Model | Provider | MUST-stay-primary? |
|---|---|---|---|
| P5-T1..T6 | claude-haiku-4-5 | ICA free-tier | No — mechanical docs/runbook/CHANGELOG/tracker-resync |
| P5-T7..T11 | claude-sonnet-5 (native) | claude | No — architectural judgment content, not routed to haiku, but not flagged no-fallback by the plan's binding assignment section (P5 is not a listed MUST-stay-primary phase) |
| P5-GATE | claude-sonnet-5 (native) | claude | No — standard end-of-feature gate |

## Quality Gates

- [ ] All 4 Deferred Items rows have a NEWLY CREATED design spec (R-1); `deferred_items_spec_refs` frontmatter matches
- [ ] `findings_doc_ref` is populated (or explicitly stays `null` if no new in-flight finding occurred) and, if populated, `status: accepted`
- [ ] Prior findings #1, #3, #4 are explicitly retired with fixing-commit cross-references
- [ ] `CHANGELOG.md` `[Unreleased]` entry present; `docs/architecture.md` §2a updated; converter README updated
- [ ] `tests/claudemd-check-gate.test.mjs` green; no further check-gate string drift beyond P0-T8's one reorder
- [ ] `karen` end-of-feature review confirms zero overstated validation/approval claim anywhere in this plan's total diff

## Implementation Notes

### File-Disjointness (all of P5-T3 through P5-T11 can run concurrently once P5-T1/T2 close)

| Task | File(s) touched |
|---|---|
| P5-T3 | `docs/architecture.md` |
| P5-T4 | `tools/rf-bundle-to-kb-pack/README.md` |
| P5-T5 | `CHANGELOG.md` |
| P5-T6 | `CLAUDE.md` (verification only, no edit expected) |
| P5-T7 | `docs/project_plans/design-specs/df-e1-m1-rule-authoring-workflow.md` (new) |
| P5-T8 | `docs/project_plans/design-specs/df-e1-m3-anemia-reconciliation.md` (new) |
| P5-T9 | `docs/project_plans/design-specs/df-e1-m2-clinical-review-portal-intake.md` (new) |
| P5-T10 | `docs/project_plans/design-specs/df-ext-m1-legal-signoff-routing.md` (new) |
| P5-T11 | `.claude/findings/multi-bundle-conversion-e1-finish-findings.md` (new) |

All 9 file targets above are pairwise distinct — verified by direct enumeration, no intersection.
`P5-T11` is scheduled after the other 9 close since the findings doc cross-references their fixing
commits.

### Known Gotchas

- All 4 design specs are **created**, not updated (R-1 — none of these paths exists today under this
  name; cross-reference the differently-named prior artifacts, do not duplicate their content).
- `findings_doc_ref` starts `null` and is set at P5-T11 (lazy-creation rule) unless an earlier
  in-flight finding during P0-P4 already required creating the file sooner.

## Completion Notes

Not started — scaffolded pre-execution on 2026-07-23. All 12 tasks (P5-T1..T11, P5-GATE) at
`not_started`, 0% complete.
