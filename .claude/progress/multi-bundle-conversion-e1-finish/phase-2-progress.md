---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1-finish"
feature_slug: "multi-bundle-conversion-e1-finish"
phase: 2
title: "Module-Generic Drafting Substrate (MUST-stay-primary)"
status: "not_started"
created: '2026-07-23'
updated: '2026-07-23'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish/phase-2-3-genericity-decisions-authoring.md
commit_refs: []
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 3
depends_on: ["P1"]
owners: ["general-purpose"]
contributors: ["task-completion-validator"]
findings_doc_ref: null

# SAFETY INTERLOCK (non-negotiable, encoded as a hard depends_on edge, not a preference):
# This phase MUST NOT begin until Phase 1 (the fail-closed emission gate becoming code) is complete
# and green. Removing the hard-coded MODULE_ID identity check (this phase) before the intentional
# status === 'approved_for_rule_draft' gate exists (Phase 1) would arm AI-draftable rule emission
# across anemia/kidney_suite_v1/growth_suite_v1 with nothing but an inert documentation field
# standing in the way. See parent plan wave_plan.phases[id: P2].depends_on: [P1], and the parent
# plan's "P1 and P2 explicitly do NOT parallelize" statement (Parallel Work Opportunities section).
blockers:
  - id: "SAFETY-INTERLOCK-P1-P2"
    title: "Phase 2 is blocked on Phase 1 completion — hard safety interlock, not a preference"
    severity: "critical"
    blocking: ["P2-T1", "P2-T2", "P2-T3", "P2-T4", "P2-T5", "P2-T6", "P2-T7", "P2-GATE"]
    resolution: "Do not start any P2 task until P1-GATE has recorded a passing task-completion-validator + karen verdict. Both phases also physically collide on tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs, so even absent the safety rationale they could not run concurrently."
    created: "2026-07-23"

tasks:
  - id: "P2-T1"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "0.5 pts"
    dependencies: ["P1-GATE"]
    must_stay_primary: true
    fr_refs: ["FR-F9"]
    description: "MUST run before any other task in this phase. Capture a pre-change SHA-256 manifest of cbc_suite_v1's propose output (all 9 emitted files: pack-provenance.json, evidence.json, evidence-assertions.json, candidates.json, rule-proposals.json, rules.json, rule-provenance.json, release-manifest.unsigned.json, conversion-report.json) against the current, post-Phase-1, pre-Phase-2 code. Commit as tests/fixtures/p2-t1-cbc-propose-manifest.json — the hard prerequisite for P2-T4 and this plan's Risk 2/R-2 mitigation."
  - id: "P2-T2"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "0.5 pts"
    dependencies: ["P1-GATE"]
    must_stay_primary: true
    fr_refs: ["Risk-4", "R-7"]
    description: "Front-loaded spike-let: write a node:test check parsing all 3 non-cbc modules' evidence-assertions.json, asserting each assertion record has the same required-field shape (assertionId, rfClaimId, rfSourceCardId, exactPassageSha256) as anemia's, and that at least one real, resolvable evas_* id exists per module suitable for Phase 3's authoring to bind against. If any module is shape-deficient, output a named list of specific deficiencies (never a silent pass)."
  - id: "P2-T3"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "extended"
    provider: "claude"
    estimated_effort: "2.5 pts"
    dependencies: ["P2-T1"]
    must_stay_primary: true
    fr_refs: ["FR-F10", "OQ-2"]
    description: "Replace rule-candidate-drafts.mjs's single-scalar MODULE_ID = 'cbc_suite_v1' + RULE_PROPOSALS with a moduleId-keyed registry (RULE_PROPOSAL_REGISTRY = { cbc_suite_v1: RULE_PROPOSALS }, defaulting to [] for any unregistered module id). propose.mjs selects RULE_PROPOSAL_REGISTRY[pinned.moduleId] ?? [] instead of throwing UsageError on a moduleId mismatch (the propose.mjs:568-575 throw site is removed entirely). The selected array is then filtered through Phase 1's approved_for_rule_draft allowlist gate before writeStagedRulesAndProvenance() is ever called — genericity and the fail-closed gate compose, they do not duplicate each other's job."
  - id: "P2-T4"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "0.75 pts"
    dependencies: ["P2-T1", "P2-T3", "P2-T7"]
    must_stay_primary: true
    fr_refs: ["FR-F10", "Risk-2"]
    description: "cbc_suite_v1 byte-identity regression test (tests/ef-cbc-byte-identity-regression.test.mjs) — the hard exit gate for this entire feature. Run propose for cbc_suite_v1 post-P2-T3/P2-T7 and SHA-256-compare every one of the 9 emitted files against P2-T1's committed manifest. Any single-byte drift is a hard failure (a clinical content change, not a build break). Test must FAIL LOUDLY if the manifest fixture itself is missing. Must run after P2-T7 (not just P2-T3) so this proof also covers the genericized writeDraftPack()/CANDIDATES path."
  - id: "P2-T5"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "0.75 pts"
    dependencies: ["P2-T3", "P2-T7"]
    must_stay_primary: true
    fr_refs: ["FR-F17"]
    description: "Fix shared-mutable-state test hazard (re-sequenced here from the PRD's rough P5 mapping since this phase already has both files open for the registry-shape update, per parent plan's FR coverage matrix note). Rewrite tests/ef-converter-rule-candidate-drafting.test.mjs and tests/ef-converter-rule-provenance-projection.test.mjs to use mkdtemp scratch directories instead of the real, shared build/kb-pack/cbc_suite_v1/0.1.0-proposal directory both currently write into. Depends on P2-T7 (not just P2-T3) since P2-T7 also edits tests/ef-converter-rule-candidate-drafting.test.mjs's direct writeDraftPack() coverage."
  - id: "P2-T6"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "1.5 pts"
    dependencies: ["P2-T3", "P2-T5", "P2-T7"]
    must_stay_primary: true
    fr_refs: ["FR-F24"]
    description: "Update existing propose/batch test suites for the new registry shape: tests/ef-converter-rule-candidate-drafting.test.mjs, tests/ef-converter-rule-provenance-projection.test.mjs, tests/ef-converter-propose.test.mjs, tests/ef-converter-batch.test.mjs, tests/ef-batch-runner.test.mjs currently assert a UsageError for any non-cbc_suite_v1 module — now WRONG (the identity throw is removed); update to assert the module reaches Phase 1's governance-refusal gate instead. Re-verify Phase 1's invariant test (P1-T6) and negative-control test (P1-T5) both stay green post-P2-T3/P2-T7 (FR-F24's 'stays green through P2' requirement)."
  - id: "P2-T7"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "1.0 pts"
    dependencies: ["P2-T3"]
    must_stay_primary: true
    fr_refs: ["FR-F10", "FR-F11"]
    description: "PLANNING-GATE BLOCKING-FINDING FIX. Genericize writeDraftPack()/CANDIDATES by moduleId, mirroring P2-T3's RULE_PROPOSAL_REGISTRY pattern exactly. writeDraftPack() (rule-candidate-drafts.mjs:344-360) takes only { outDir } and unconditionally serializes cbc's own RULE_PROPOSALS and CANDIDATES regardless of target module — P2-T3 only genericizes the gate's consumption of MODULE_ID/RULE_PROPOSALS, never writeDraftPack/CANDIDATES, so a post-P2-T3 propose run for e.g. kidney_suite_v1 would write cbc's proposals/candidate under kidney_suite_v1's identity. Introduce CANDIDATE_REGISTRY = { cbc_suite_v1: CANDIDATES }, defaulting to {} for any unregistered module (matching the already-committed modules/kidney_suite_v1/candidates.json and modules/growth_suite_v1/candidates.json, both already {} today). writeDraftPack({ outDir, moduleId }) selects RULE_PROPOSAL_REGISTRY[moduleId] ?? [] and CANDIDATE_REGISTRY[moduleId] ?? {}. Must land before P2-T4/T5/T6 (all touch the same test-file surface)."
  - id: "P2-GATE"
    status: "not_started"
    assigned_to: ["task-completion-validator"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "—"
    dependencies: ["P2-T1", "P2-T2", "P2-T3", "P2-T4", "P2-T5", "P2-T6", "P2-T7"]
    must_stay_primary: true
    description: "Verify: cbc_suite_v1 byte-identity holds (P2-T4); all 3 non-cbc modules reach the emission gate, not UsageError; FR-F24's invariant test (P1-T6) is re-confirmed green; the shared-mutable-state hazard is closed (P2-T5); writeDraftPack()/CANDIDATES are module-generic with a cross-module-leak negative control passing (P2-T7); the adversarial review from Phase 1 has no unresolved finding that this phase's changes reopen."

parallelization:
  batch_1: ["P2-T1", "P2-T2"]
  batch_2: ["P2-T3"]
  batch_3: ["P2-T7"]
  batch_4: ["P2-T4", "P2-T5"]
  batch_5: ["P2-T6"]
  batch_6: ["P2-GATE"]

total_tasks: 8
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
progress: 0
---

# multi-bundle-conversion-e1-finish - Phase 2: Module-Generic Drafting Substrate (MUST-stay-primary)

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

**Wave**: 3 of 6. **Depends on**: Phase 1 complete and green — **SAFETY INTERLOCK, not a scheduling
preference** (see `blockers` in frontmatter).
**Assigned Subagent(s)**: native Claude only (`claude-sonnet-5`, `extended` effort for the registry
replacement, `adaptive` elsewhere); `task-completion-validator` gate.

## Objective

Replace the hard-coded `MODULE_ID = 'cbc_suite_v1'` single-module identity with a per-module drafting
registry, so all 4 modules reach `propose`'s (now code-enforced, Phase 1) emission gate — refused by
the *gate*, not by the mechanical module-identity check — while `cbc_suite_v1`'s existing output stays
SHA-256 byte-identical throughout.

## Entry Criteria — HARD SAFETY INTERLOCK

**Phase 1 must be complete and green before any task in this phase begins.** This is enforced as a
hard `depends_on` edge in the parent plan's `wave_plan` frontmatter (`P2.depends_on: [P1]`), not merely
stated in prose. P1 and P2 also physically collide on
`tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs`, so even absent the safety rationale they could not
run concurrently. Removing the accidental protection (the `MODULE_ID` string check) before installing
the intentional one (Phase 1's live `status === 'approved_for_rule_draft'` branch) would arm
AI-draftable rule emission across three clinical modules with nothing but an inert documentation field
standing in the way.

## Exit Criteria (decisions block §1, PRD Goal 3/FR-F9-F10)

All 3 previously-bespoke modules reach the (now code-enforced) emission gate instead of a `UsageError`,
refused by the *gate*, not by the mechanical module-identity check; `cbc_suite_v1`'s `propose` output
is SHA-256 byte-identical, file-by-file, to its pre-change manifest — the regression anchor for this
entire plan.

## Model / Provider Assignment — MUST-stay-primary phase

| Task | Model | Provider | MUST-stay-primary? |
|---|---|---|---|
| P2-T1..T7, P2-GATE | claude-sonnet-5 (native) | claude | **Yes — every task in this phase, per the parent plan's binding Model/Provider Assignment section** |

## Quality Gates

- [ ] `cbc_suite_v1`'s `propose` output is SHA-256 byte-identical, file-by-file, to the P2-T1 manifest
- [ ] `anemia`/`kidney_suite_v1`/`growth_suite_v1` reach the (Phase 1) emission gate instead of the module-identity `UsageError`
- [ ] FR-F24's repo-level invariant test (P1-T6) re-verified green post-genericity refactor
- [ ] Shared-mutable-state test hazard closed (FR-F17, this phase, not P5)
- [ ] `writeDraftPack()`/`CANDIDATES` are genericized by `moduleId` (P2-T7) — a cross-module-leak negative-control test proves no non-cbc module's `rule-proposals.json`/`candidates.json` contains `cbc_suite_v1`'s own decision ids, candidate identity, or provenance
- [ ] Zero task in this phase populated `approvedBy[]`/`clinicalApprovers[]` on any module

## Implementation Notes

### Known Gotchas

- P2-T1 (the pre-change manifest) must run and be committed BEFORE P2-T3 lands — without it the
  byte-identity exit gate for this entire feature is unverifiable.
- Per OQ-2's resolution: the per-module registry stays vestigial/empty for 3 of 4 modules — the real
  gating signal is 100% decisions-file-driven (Phase 1's gate), not the registry itself. Do not author
  rule-body content for `anemia`/`kidney_suite_v1`/`growth_suite_v1` in this phase.
- P2-T2's kidney/growth shape-parity spike-let must complete before Phase 3's authoring estimates are
  trusted (decisions block Risk 4/R-7).
- **P2-T7 (added post-planning-gate review, closes a BLOCKING finding)**: P2-T3 only genericizes the
  gate's *consumption* of `MODULE_ID`/`RULE_PROPOSALS` — it does NOT touch `writeDraftPack()`/
  `CANDIDATES`. Without P2-T7, a post-P2 `propose` run for any non-`cbc_suite_v1` module would write
  `cbc_suite_v1`'s own proposal/candidate content under the wrong module's identity. P2-T7 must land
  before P2-T4/T5/T6 (all three touch the same test-file surface it also touches).

## Completion Notes

Not started — scaffolded pre-execution on 2026-07-23; amended post-planning-gate review to add
P2-T7 (closes a BLOCKING finding: `writeDraftPack()`/`CANDIDATES` were never genericized by
`moduleId` alongside `RULE_PROPOSALS`). All 8 tasks (P2-T1..T7, P2-GATE) at `not_started`, 0%
complete. Phase 2 total re-costed from 6.5 pts to 7.5 pts (+1.0, P2-T7). **Do not begin any task
until P1-GATE has recorded a passing verdict.**
