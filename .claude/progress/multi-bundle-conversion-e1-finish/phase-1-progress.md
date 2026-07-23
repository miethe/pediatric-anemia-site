---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1-finish"
feature_slug: "multi-bundle-conversion-e1-finish"
phase: 1
title: "Fail-Closed Emission Gate Becomes Code (MUST-stay-primary)"
status: "not_started"
created: '2026-07-23'
updated: '2026-07-23'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish/phase-0-1-gate-recovery-emission-gate.md
commit_refs: []
pr_refs: []
execution_model: sequential
plan_structure: independent
wave: 2
depends_on: ["P0"]
owners: ["general-purpose"]
contributors: ["gpt-5.6-terra-review", "task-completion-validator", "karen"]
findings_doc_ref: null

tasks:
  - id: "P1-T1"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "extended"
    provider: "claude"
    estimated_effort: "0.5 pts"
    dependencies: []
    must_stay_primary: true
    fr_refs: ["FR-F6", "R-2", "OQ-1"]
    description: "Add drafted_pending_human_approval to schemas/authoring-decisions.schema.json's decision.status enum (approved_for_rule_draft | rejected | withdrawn | drafted_pending_human_approval). Confirm no existing consumer breaks — cbc_suite_v1/authoring-decisions.yaml's 4 existing approved_for_rule_draft decisions must still validate unchanged."
  - id: "P1-T2"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "extended"
    provider: "claude"
    estimated_effort: "1.5 pts"
    dependencies: ["P1-T1"]
    must_stay_primary: true
    fr_refs: ["FR-F6", "R-2"]
    description: "THE single most load-bearing implementation detail in this plan. Make propose.mjs read pinned.decisions.parsed.decisions[] and branch on status === 'approved_for_rule_draft' as the ONLY permitting condition — coded as a positive ALLOWLIST membership check, never an enumerated denylist (an `if (status === 'rejected' || status === 'withdrawn') throw` shape is explicitly WRONG and must not appear anywhere in the diff). Add RuleEmissionRefusedError extends GovernanceError (tools/rf-bundle-to-kb-pack/lib/errors.mjs, exit 3 GOVERNANCE) naming the specific refusal reason in conversion-report.json."
  - id: "P1-T3"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "extended"
    provider: "claude"
    estimated_effort: "1.0 pts"
    dependencies: ["P1-T2"]
    must_stay_primary: true
    fr_refs: ["FR-F6", "R-P3"]
    description: "Seam task (R-P3): make scripts/evidence/govern-staged-rules.mjs's writeStagedRulesAndProvenance() (currently unconditional) refuse to write rules.json/rule-provenance.json unless at least one resolved, cross-validated decision carries status: approved_for_rule_draft. Must prove cbc_suite_v1's existing 4 approved decisions still permit its existing emission path unchanged — the one already-committed, already-verified rule content in this repo depends on this exact function continuing to fire for it."
  - id: "P1-T4"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "extended"
    provider: "claude"
    estimated_effort: "1.5 pts"
    dependencies: ["P1-T1"]
    must_stay_primary: true
    fr_refs: ["FR-F7", "OQ-3"]
    description: "Runtime clm_*/evas_* cross-resolution (resolved to Phase 1, a fabrication guard shipping with the other guards). Add a runtime resolver invoked by propose that cross-checks every decision's rf_claim_ids[] against the bundle's claims/claim_ledger.yaml and every exact_assertion_ids[] against the module's evidence-assertions.json. An unresolved id throws UnresolvedClaimReferenceError extends SchemaError (exit 2 SCHEMA) BEFORE any output is written."
  - id: "P1-T5"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "1.0 pts"
    dependencies: ["P1-T2", "P1-T3", "P1-T4", "P1-T8"]
    must_stay_primary: true
    fr_refs: ["FR-F8"]
    description: "Negative-control test (tests/ef-converter-emission-gate.test.mjs): a decisions file where every decision is non-approving (or cites an unresolvable id) MUST NOT result in rules.json/rule-provenance.json appearing anywhere in propose's output tree, and MUST result in a named, non-zero refusal captured in conversion-report.json. Assert file absence via fs.access throwing ENOENT, not merely 'empty array'. Only meaningfully testable once P1-T8 lands — without it, conversion-report.json is never written on a refusal (propose crashes first)."
  - id: "P1-T6"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "0.75 pts"
    dependencies: ["P1-T2", "P1-T3", "P1-T4", "P1-T8"]
    must_stay_primary: true
    fr_refs: ["FR-F24"]
    description: "Repo-level invariant test (tests/ef-rule-emission-invariant.test.mjs): (a) modules/{kidney_suite_v1,growth_suite_v1}/rules.json stay []; (b) modules/anemia/rules.json's 91 hand-authored, pre-existing rules stay byte-identical to a pinned baseline hash (never touched by this pass — predate the converter, not 'traceable to converter output'); (c) none of anemia/kidney_suite_v1/growth_suite_v1 has a rule-provenance.json. Must stay green through P2/P3/P4 — re-verified at each phase's GATE."
  - id: "P1-T8"
    status: "not_started"
    assigned_to: ["general-purpose"]
    model: "claude-sonnet-5"
    model_effort: "extended"
    provider: "claude"
    estimated_effort: "1.5 pts"
    dependencies: ["P1-T2", "P1-T3", "P1-T4"]
    must_stay_primary: true
    fr_refs: ["FR-F6", "FR-F8", "FR-F11"]
    description: "PLANNING-GATE BLOCKING-FINDING FIX. Make a governance refusal a caught, non-fatal signal in propose.mjs's emission ordering — not an exception escaping run(). Today, P1-T3's conditional writeStagedRulesAndProvenance() is followed by an UNCONDITIONAL readFile(rulesPath)/readFile(ruleProvenancePath) (~line 634) that throws ENOENT on a refused module, crashing before conversion-report.json/semantic-diff.json are ever written (making FR-F8/FR-F11 unreachable) and halting `batch` at BATCH_PAIRS[0] (rf-ev-001 -> modules/anemia, itself a refused module) before cbc_suite_v1's own pair is ever attempted. Fix: capture the refusal as a value before the read is attempted; on refusal, rulesRaw/ruleProvenanceRaw are each the deterministic empty string '' for computeTraceabilityHash (never a file read); semantic-diff.json's headRules is [] directly (never JSON.parse(rulesRaw)) — the branch belongs in propose.mjs, the caller; release-manifest.unsigned.json, conversion-report.json (named refusal reason), and semantic-diff.json are ALL still written; run() returns EXIT_OK (0) on refusal, never throws. Explicitly distinct from UnresolvedClaimReferenceError (P1-T4), which stays a hard crash (exit 2 SCHEMA) — a fabricated claim id is a defect, not a refusal."
  - id: "P1-T7"
    status: "not_started"
    assigned_to: ["gpt-5.6-terra"]
    model: "gpt-5.6-terra"
    model_effort: "medium"
    provider: "codex"
    estimated_effort: "0.5 pts"
    dependencies: ["P1-T1", "P1-T2", "P1-T3", "P1-T4", "P1-T5", "P1-T6", "P1-T8"]
    must_stay_primary: false
    fr_refs: ["Risk-1"]
    description: "Adversarial read-only diff review (flags only, never approves, never auto-applied) hunting for: (1) any denylist-shaped branch masquerading as the allowlist gate; (2) any code path reaching writeStagedRulesAndProvenance() without passing through the new status check; (3) any error path swallowing RuleEmissionRefusedError/UnresolvedClaimReferenceError before it reaches the CLI's top-level catch; (4) P1-T8's non-fatal-refusal restructuring accidentally also swallowing UnresolvedClaimReferenceError (which must stay a hard crash). Intentionally routed off-primary by plan design (per project memory: per-wave codex diff reviews have caught real fail-closed gaps validators approved in this repo before); findings are adjudicated by native Claude at P1-GATE, never auto-applied — this task itself is NOT must_stay_primary."
  - id: "P1-GATE"
    status: "not_started"
    assigned_to: ["task-completion-validator", "karen"]
    model: "claude-sonnet-5"
    model_effort: "adaptive"
    provider: "claude"
    estimated_effort: "—"
    dependencies: ["P1-T1", "P1-T2", "P1-T3", "P1-T4", "P1-T5", "P1-T6", "P1-T7", "P1-T8"]
    must_stay_primary: true
    description: "Safety-critical milestone reviewer gate. Verify: gate is code-enforced (P1-T2/T3), not documentation; cross-resolution ships (P1-T4); a governance refusal is caught and non-fatal, never crashing propose or halting batch (P1-T8); negative control (P1-T5) and invariant (P1-T6) tests pass; P1-T7's adversarial findings are all adjudicated; cbc_suite_v1's existing 4-rule emission path is provably unaffected. `karen` specifically checks that no artifact anywhere in this phase's diff is described as 'validated,' 'approved,' or 'release-ready.'"

parallelization:
  batch_1: ["P1-T1"]
  batch_2: ["P1-T2"]
  batch_3: ["P1-T3"]
  batch_4: ["P1-T4"]
  batch_5: ["P1-T8"]
  batch_6: ["P1-T5", "P1-T6"]
  batch_7: ["P1-T7"]
  batch_8: ["P1-GATE"]

total_tasks: 9
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
progress: 0
---

# multi-bundle-conversion-e1-finish - Phase 1: Fail-Closed Emission Gate Becomes Code (MUST-stay-primary)

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

**Wave**: 2 of 6. **Depends on**: Phase 0 complete (`npm run check` green).
**Assigned Subagent(s)**: native Claude only (`claude-sonnet-5`, `extended` effort, **no fallback chain
by design** — if primary is unavailable this phase blocks, it does not downgrade to ICA or codex);
`gpt-5.6-terra` for the mandatory adversarial read-only diff review (flags only, never approves);
`task-completion-validator` + `karen` (safety-critical milestone review).

## Objective

Make FR-9's fail-closed property real, in code, before genericity lands: `propose.mjs` reads and
branches on `pinned.decisions.parsed[].status` at runtime; a decisions file with no
`approved_for_rule_draft` decision cannot produce `rules.json`/`rule-provenance.json`, proven by a
negative-control test and a repo-level invariant, not by prose.

## Entry Criteria

- Phase 0 complete (`npm run check` green).

## Exit Criteria (decisions block §1, PRD Goal 2/FR-F6-F9/FR-F24) — HARD SAFETY INTERLOCK

A decisions file with no `approved_for_rule_draft` decision cannot produce
`rules.json`/`rule-provenance.json`, proven by file-absence assertion and a non-zero, named refusal
reason in `conversion-report.json`. **This must land, tested, and green before Phase 2 begins** — a
hard, non-negotiable ordering, not a scheduling convenience. Removing the accidental protection (the
hard-coded `MODULE_ID` check, Phase 2) before installing the intentional one (this phase's live
`status` branch) would arm AI-draftable rule emission across `anemia`/`kidney_suite_v1`/
`growth_suite_v1` with nothing but an inert documentation field standing in the way.

## Model / Provider Assignment — MUST-stay-primary phase

| Task | Model | Provider | MUST-stay-primary? |
|---|---|---|---|
| P1-T1..T6, P1-T8, P1-GATE | claude-sonnet-5 (native) | claude | **Yes — no fallback chain by design; if primary unavailable, phase blocks, never downgrades to ICA/codex** |
| P1-T7 | gpt-5.6-terra | codex | No — intentionally routed off-primary for adversarial review only; flags, never approves, never authors |

Every build/gate task in this phase is MUST-stay-primary per this plan's binding instructions. P1-T7
is the sole, deliberate exception (adversarial second-opinion review) and must never be treated as an
authorship or adjudication task.

## Quality Gates

- [ ] `propose.mjs` reads and branches on `pinned.decisions.parsed[].status` at runtime — grep-confirmed, not merely asserted
- [ ] The gate is coded as an allowlist (`status === 'approved_for_rule_draft'`); a test proves a 5th, unrecognized status value also refuses emission (the property a denylist cannot guarantee)
- [ ] `writeStagedRulesAndProvenance()` is conditional; `cbc_suite_v1`'s existing 4-rule emission is unaffected (P1-T3 seam task)
- [ ] Runtime `clm_*`/`evas_*` cross-resolution ships in this phase, not deferred (P1-T4)
- [ ] A governance refusal is a caught, non-fatal signal in `propose.mjs` — `conversion-report.json`/`semantic-diff.json`/evidence-layer artifacts still written, `run()` returns `EXIT_OK`, `batch` does not halt at a refused pair (P1-T8)
- [ ] Negative-control test (P1-T5) and repo-level invariant test (P1-T6) both pass
- [ ] P1-T7's adversarial review findings are all adjudicated before this gate closes
- [ ] `karen` confirms no artifact in this phase's diff overstates validation/approval status

## Implementation Notes

### Known Gotchas

- `tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs` is a serialization barrier (parent plan
  frontmatter `wave_plan.serialization_barriers`) — P1-T2/T3/T4/T8 all touch it; treat as sequential
  despite the dependency table only listing `P1-T1` for `P1-T4`.
- An allowlist fails closed on an unrecognized future status value; a denylist fails open — this
  property must be test-proven, not merely asserted (P1-T2's own AC).
- `P1-T7`'s adversarial review is off-primary by design; do not reassign it to native Claude, and do
  not treat its findings as auto-applied — P1-GATE adjudicates them.
- **P1-T8 (added post-planning-gate review, closes a BLOCKING finding)**: without it, `propose`
  crashes (uncaught `ENOENT`) the moment P1-T3's conditional write skips a refused module, so P1-T5's
  own negative-control test cannot pass and `batch` halts at `BATCH_PAIRS[0]` before ever reaching
  `cbc_suite_v1`. Do not treat `RuleEmissionRefusedError`/governance-refusal handling as the same
  thing as `UnresolvedClaimReferenceError` (P1-T4) — the latter must stay a hard crash.

## Completion Notes

Not started — scaffolded pre-execution on 2026-07-23; amended post-planning-gate review to add
P1-T8 (closes a BLOCKING finding: a governance refusal must be a caught, non-fatal signal, not an
exception escaping `propose.mjs`'s `run()`). All 9 tasks (P1-T1..T8, P1-GATE) at `not_started`, 0%
complete. Phase 1 total re-costed from 6.75 pts to 8.25 pts (+1.5, P1-T8).
