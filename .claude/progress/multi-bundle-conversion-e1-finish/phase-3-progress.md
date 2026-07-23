---
type: progress
schema_version: 2
doc_type: progress
prd: multi-bundle-conversion-e1-finish
feature_slug: multi-bundle-conversion-e1-finish
phase: 3
title: "Author 3\xD7 Non-Approving Decisions Files (MUST-stay-primary, zero delegation\
  \ of authorship)"
status: completed
created: '2026-07-23'
updated: '2026-07-23'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish/phase-2-3-genericity-decisions-authoring.md
commit_refs: []
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 4
depends_on:
- P2
owners:
- general-purpose
- claude-opus-4-8
contributors:
- gpt-5.6-terra-review
- task-completion-validator
- karen
findings_doc_ref: null
tasks:
- id: P3-T1
  status: completed
  assigned_to:
  - general-purpose
  model: claude-sonnet-5
  model_effort: adaptive
  provider: claude
  estimated_effort: 0.5 pts
  dependencies:
  - P2-GATE
  must_stay_primary: true
  fr_refs:
  - FR-F11
  description: "Lock propose's output scope for the 3 non-cbc modules (planning-gate\
    \ BLOCKING-finding fix \u2014 substance, not existence). Author a positive-allowlist\
    \ test (tests/ef-propose-output-scope-lock.test.mjs) asserting a propose run for\
    \ anemia/kidney_suite_v1/growth_suite_v1 writes ONLY: pack-provenance.json, evidence.json,\
    \ evidence-assertions.json, candidates.json, unresolved.json, conversion-report.json,\
    \ semantic-diff.json (Phase 4), and an inert, empty rule-proposals.json \u2014\
    \ both candidates.json and rule-proposals.json are ALWAYS present and empty (never\
    \ omitted, per FR-F11's binding resolution) \u2014 and NEVER rules.json/rule-provenance.json.\
    \ Belt-and-suspenders on top of Phase 1/2's gate; a bounded, exhaustive file-inventory\
    \ assertion, not merely the absence of two files. SUBSTANCE check (a bounded file-set\
    \ check alone would pass even with another module's content copied in verbatim,\
    \ exactly the P2-T7 regression scenario): for each of the 3 modules, rule-proposals.json's\
    \ wrapper moduleId field equals the target module's own id (never cbc_suite_v1's)\
    \ and proposals.length === 0; candidates.json is the bare empty object {} (Object.keys(doc).length\
    \ === 0, matching the already-committed modules/kidney_suite_v1/candidates.json\
    \ and modules/growth_suite_v1/candidates.json convention). A cross-module-leak\
    \ negative-control test greps rule-proposals.json/candidates.json for each of\
    \ the 3 modules and asserts ZERO occurrence of any dec_cbc_* decision id (e.g.\
    \ dec_cbc_young_infant_scope_abstention_001), any CBC-NEUT-*/CBC-MARROW-REDFLAG-*\
    \ rule-proposal id, the candidate id benign-ethnic-neutropenia-differential-pattern,\
    \ or cbc_suite_v1's own RF_PROVENANCE (rf_run_20260717_rf_cbc_001_pediatric_cds_establish\
    \ / bundle_20260718_intent_research_20260717_rf_cbc_001) \u2014 this is the test\
    \ that would have caught a P2-T3-only (no P2-T7) genericity regression."
  started: '2026-07-23T15:00:00Z'
  completed: '2026-07-23T15:30:00Z'
  evidence:
  - test: scope-lock pass; cross-resolution clean; validate-kb 0
- id: P3-T2
  status: completed
  assigned_to:
  - general-purpose
  model: claude-sonnet-5
  model_effort: extended
  provider: claude
  estimated_effort: 2.0 pts
  dependencies:
  - P2-GATE
  - P2-T2
  must_stay_primary: true
  fr_refs:
  - FR-F5
  - FR-F12
  description: "Author modules/anemia/authoring-decisions.yaml (NEW file). moduleId:\
    \ anemia; rfProvenance from rf-ev-001's real run_id/bundle_id/fixture path; >=2\
    \ decision records binding real clm_* ids from tests/fixtures/rf-ev-001/claims/claim_ledger.yaml\
    \ and real evas_anemia_* ids from modules/anemia/evidence-assertions.json. Every\
    \ decision's status is drafted_pending_human_approval (never approved_for_rule_draft);\
    \ every review.* role is pending. basis.reasoning paraphrases ONLY the cited claim's\
    \ own text \u2014 no invented threshold, no clinical judgment beyond what the\
    \ claim supports."
  started: '2026-07-23T15:00:00Z'
  completed: '2026-07-23T15:30:00Z'
  evidence:
  - test: scope-lock pass; cross-resolution clean; validate-kb 0
- id: P3-T3
  status: completed
  assigned_to:
  - general-purpose
  model: claude-sonnet-5
  model_effort: extended
  provider: claude
  estimated_effort: 2.0 pts
  dependencies:
  - P2-GATE
  - P2-T2
  must_stay_primary: true
  fr_refs:
  - FR-F5
  - FR-F12
  description: "Author modules/kidney_suite_v1/authoring-decisions.yaml (NEW file)\
    \ \u2014 same pattern as P3-T2, binding to tests/fixtures/rf-kid-001/claims/claim_ledger.yaml\
    \ and modules/kidney_suite_v1/evidence-assertions.json (73 real assertions, confirmed\
    \ by P2-T2). Same non-approving/pending discipline as P3-T2."
  started: '2026-07-23T15:00:00Z'
  completed: '2026-07-23T15:30:00Z'
  evidence:
  - test: scope-lock pass; cross-resolution clean; validate-kb 0
- id: P3-T4
  status: completed
  assigned_to:
  - general-purpose
  model: claude-sonnet-5
  model_effort: extended
  provider: claude
  estimated_effort: 2.0 pts
  dependencies:
  - P2-GATE
  - P2-T2
  must_stay_primary: true
  fr_refs:
  - FR-F5
  - FR-F12
  description: "Author modules/growth_suite_v1/authoring-decisions.yaml (NEW file)\
    \ \u2014 same pattern as P3-T2, binding to tests/fixtures/rf-gro-002/claims/claim_ledger.yaml\
    \ and modules/growth_suite_v1/evidence-assertions.json (79 real assertions, confirmed\
    \ by P2-T2). Same non-approving/pending discipline as P3-T2."
  started: '2026-07-23T15:00:00Z'
  completed: '2026-07-23T15:30:00Z'
  evidence:
  - test: scope-lock pass; cross-resolution clean; validate-kb 0
- id: P3-T5
  status: completed
  assigned_to:
  - general-purpose
  model: claude-sonnet-5
  model_effort: adaptive
  provider: claude
  estimated_effort: 0.75 pts
  dependencies:
  - P3-T2
  - P3-T3
  - P3-T4
  must_stay_primary: true
  fr_refs:
  - FR-F13
  description: "Schema-validate + cross-resolve all 3 new files, reusing Phase 1's\
    \ runtime resolver (P1-T4's clm_*/evas_* cross-resolution) as the validation mechanism\
    \ \u2014 not a bespoke one-off check, per FR-F13's explicit instruction. Every\
    \ cited clm_*/evas_* id in all 3 files must resolve against that module's real\
    \ fixtures (zero UnresolvedClaimReferenceError); the SAME resolver code path is\
    \ used here as in Phase 1."
  started: '2026-07-23T15:00:00Z'
  completed: '2026-07-23T15:30:00Z'
  evidence:
  - test: scope-lock pass; cross-resolution clean; validate-kb 0
- id: P3-T6
  status: completed
  assigned_to:
  - gpt-5.6-terra
  model: gpt-5.6-terra
  model_effort: medium
  provider: codex
  estimated_effort: 0.5 pts
  dependencies:
  - P3-T2
  - P3-T3
  - P3-T4
  must_stay_primary: false
  fr_refs:
  - Risk-5
  description: "Adversarial review hunting for invented thresholds across all 3 new\
    \ decisions files: any numeric value in reasoning/basis not traceable to the cited\
    \ claim's own text; any clinical_effect.intended_output/conflicts.representation\
    \ label implying more clinical judgment than the cited claims support; any accidental\
    \ approved_for_rule_draft or non-pending review.* value. Flags only \u2014 adjudicated\
    \ by the Opus verdict pass (P3-T7), never auto-applied. Intentionally routed off-primary\
    \ by plan design \u2014 this task itself is NOT must_stay_primary."
  started: '2026-07-23T15:30:00Z'
  completed: '2026-07-23T15:45:00Z'
  evidence:
  - codex: gpt-5.6-terra high-effort CLEAN all 3 files; every threshold traces to
      cited claim
- id: P3-T7
  status: completed
  assigned_to:
  - general-purpose
  model: claude-opus-4-8
  model_effort: xhigh
  provider: claude
  estimated_effort: 0.75 pts
  dependencies:
  - P3-T5
  - P3-T6
  must_stay_primary: true
  fr_refs:
  - FR-F5
  description: "Mandatory, non-delegable Opus verdict pass confirming, across all\
    \ 3 new files: zero invented thresholds; zero approved_for_rule_draft anywhere;\
    \ all review.* fields pending; zero approvedBy[]/clinicalApprovers[] population\
    \ anywhere in this phase's diff; P3-T6's adversarial findings are all resolved.\
    \ This pass closes the phase \u2014 not optional, not delegated to sonnet."
  started: '2026-07-23T15:45:00Z'
  completed: '2026-07-23T15:55:00Z'
  evidence:
  - verdict: Opus APPROVED; independent spot-checks (anemia/kidney/growth) validate
      zero invented thresholds
- id: P3-GATE
  status: completed
  assigned_to:
  - task-completion-validator
  - karen
  model: claude-sonnet-5
  model_effort: adaptive
  provider: claude
  estimated_effort: "\u2014"
  dependencies:
  - P3-T1
  - P3-T2
  - P3-T3
  - P3-T4
  - P3-T5
  - P3-T6
  - P3-T7
  must_stay_primary: true
  description: 'Mid-feature milestone review. Verify: all 3 files exist, are new (not
    edits), schema-valid, cross-resolved; FR-F11''s scope lock (P3-T1) holds; Opus
    verdict (P3-T7) recorded approval; karen independently re-checks (spot, not exhaustive)
    that no numeric threshold in any file is untraceable to a cited claim.'
  started: '2026-07-23T15:55:00Z'
  completed: '2026-07-23T16:05:00Z'
  evidence:
  - review: task-completion-validator APPROVED
  - review: karen APPROVED; 7 thresholds re-verified verbatim
parallelization:
  batch_1:
  - P3-T1
  - P3-T2
  - P3-T3
  - P3-T4
  batch_2:
  - P3-T5
  - P3-T6
  batch_3:
  - P3-T7
  batch_4:
  - P3-GATE
total_tasks: 8
completed_tasks: 8
in_progress_tasks: 0
blocked_tasks: 0
progress: 100
---

# multi-bundle-conversion-e1-finish - Phase 3: Author 3× Non-Approving Decisions Files (MUST-stay-primary, zero delegation of authorship)

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

**Wave**: 4 of 6. **Depends on**: Phase 2 complete and green (decisions-file content must actually drive
behavior before authoring these files is meaningfully testable).
**Assigned Subagent(s)**: native Claude (`claude-sonnet-5`, draft) → `claude-opus-4-8` (mandatory
verdict pass, `xhigh` effort) — **zero delegation of any kind for authorship**; `gpt-5.6-terra`
adversarial review (flags only); `task-completion-validator` + `karen` (mid-feature milestone review).

## Objective

Author non-approving, schema-valid, cross-resolved `authoring-decisions.yaml` files for `anemia`,
`kidney_suite_v1`, and `growth_suite_v1` — a scoped, narrow, explicitly documented supersession of
prior PRD FR-22. Every decision stays `drafted_pending_human_approval`; human clinical approval remains
an explicit, separate, out-of-scope act this phase does not perform and enables no agent to perform.

## Entry Criteria

- Phase 2 complete and green — decisions-file content must actually drive behavior before authoring
  these files is meaningfully testable; authoring them against a converter that ignores them would
  produce unfalsifiable artifacts, the exact failure mode this feature exists to correct.

## Exit Criteria (decisions block §1, PRD Goal — FR-F11/F12/F13)

Files are schema-valid and ID-resolvable; negative-control asserting no file contains
`approved_for_rule_draft`; zero numeric threshold appears that is not traceable to a cited claim.

## Model / Provider Assignment — MUST-stay-primary phase, zero delegation of authorship

| Task | Model | Provider | MUST-stay-primary? |
|---|---|---|---|
| P3-T1..T5, P3-T7, P3-GATE | claude-sonnet-5 → claude-opus-4-8 (native) | claude | **Yes — every authorship task in this phase, per the parent plan's binding Model/Provider Assignment section; zero delegation of authorship of any kind** |
| P3-T6 | gpt-5.6-terra | codex | No — intentionally routed off-primary for adversarial review only; flags, never approves, never authors |

## Quality Gates

- [ ] `modules/{anemia,kidney_suite_v1,growth_suite_v1}/authoring-decisions.yaml` are all NEW files (git-confirmed), schema-valid, cross-resolved
- [ ] Every decision in all 3 files carries `status: drafted_pending_human_approval`; zero `approved_for_rule_draft` anywhere (negative-control test-asserted)
- [ ] All four `review.*` roles are `pending` in every decision, in every file
- [ ] Zero numeric threshold in any file is untraceable to a cited `clm_*` claim's own text (adversarially reviewed AND Opus-verdicted, not merely test-checked)
- [ ] Zero task in this phase populated `approvedBy[]`/`clinicalApprovers[]`
- [ ] FR-F11's output-scope lock (P3-T1) passes for all 3 modules — SUBSTANCE (correct `moduleId`, empty `candidates.json`, zero cross-module-leak), not merely file-set existence
- [ ] `rule-proposals.json`/`candidates.json` are always present and empty for all 3 modules (never omitted) — FR-F11's binding resolution

## Implementation Notes

### Known Gotchas

- ~85% of this phase's effort is clinical/evidentiary judgment (per SPIKE-009) — the highest scope-creep
  risk in the plan. Every decision must trace to a cited `clm_*`; every numeric threshold must trace to
  that claim's own text.
- **No task in this phase may set any decision's `status` to `approved_for_rule_draft`** or populate
  `approvedBy[]`/`clinicalApprovers[]` — this is the central, non-negotiable boundary this PRD exists
  to preserve.
- P3-T7 (Opus verdict) is mandatory and non-delegable — the phase does not close without an explicit
  Opus approval recorded.

## Completion Notes

Not started — scaffolded pre-execution on 2026-07-23. All 8 tasks (P3-T1..T7, P3-GATE) at
`not_started`, 0% complete.
