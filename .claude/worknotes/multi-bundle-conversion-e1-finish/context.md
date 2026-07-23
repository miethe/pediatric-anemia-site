---
type: context
schema_version: 2
doc_type: context
prd: "multi-bundle-conversion-e1-finish"
feature_slug: "multi-bundle-conversion-e1-finish"
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
title: "multi-bundle-conversion-e1-finish - Development Context"
status: "active"
created: "2026-07-23"
updated: "2026-07-23"

critical_notes_count: 0
implementation_decisions_count: 0
active_gotchas_count: 0
agent_contributors: []

agents: []

phase_status: [
  { phase: 1, label: "P0", status: "not_started" },
  { phase: 2, label: "P1", status: "not_started" },
  { phase: 3, label: "P2", status: "not_started" },
  { phase: 4, label: "P3", status: "not_started" },
  { phase: 5, label: "P4", status: "not_started" },
  { phase: 6, label: "P5", status: "not_started" }
]

blockers: []

decisions: []

integrations: []

gotchas: []

modified_files: []

findings_doc_ref: null

notes: "Progress tracking scaffolded pre-execution on 2026-07-23 — all 6 phase files (P0..P5) created at status: not_started, 0% complete. Zero tasks executed. P2 (module-generic drafting substrate) carries a hard safety-interlock dependency on P1 (fail-closed emission gate) completing first — encoded as depends_on: [\"P1\"] plus an explicit blocker entry in phase-2-progress.md, not merely a preference. See References below for the full pointer set."
---

# multi-bundle-conversion-e1-finish - Development Context

**Status**: Active Development (scaffolded, execution not yet started)
**Created**: 2026-07-23
**Last Updated**: 2026-07-23

> **Purpose**: Shared worknotes for all agents working the "Finish the Converter Pass" feature
> (code-enforced fail-closed emission gate, module-generic `propose`, 4-of-4 batch determinism, zero
> new clinical rules). Add brief observations, decisions, gotchas, and implementation notes that
> future agents should know.

---

## Quick Reference

**Agent Notes**: 0 notes from 0 agents (scaffolded, no execution has started)
**Critical Items**: 0
**Last Contribution**: none yet

### Pointers

| Document | Path |
|---|---|
| Implementation Plan (parent) | `docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md` |
| Phase 0-1 detail | `docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish/phase-0-1-gate-recovery-emission-gate.md` |
| Phase 2-3 detail | `docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish/phase-2-3-genericity-decisions-authoring.md` |
| Phase 4-5 detail | `docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish/phase-4-5-batch-determinism-docs.md` |
| PRD | `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md` |
| Decisions Block (binding, §0 premise correction + §7a R-1/R-2/R-3) | `.claude/worknotes/multi-bundle-conversion-e1-finish/decisions-block.md` |
| SPIKE-009 (evidence base — every phase boundary traces here) | `docs/project_plans/SPIKEs/spike-009-converter-module-genericity.md` |
| Prior PRD (direct predecessor, FR-9/FR-22 lineage) | `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md` |
| Prior implementation plan (binding house style + task-ID convention) | `docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md` |
| Prior findings doc (findings #1/#3/#4 this pass retires) | `.claude/findings/multi-bundle-conversion-e1-findings.md` |
| New findings doc (lazy-created; set at P5-T11 unless an earlier in-flight finding occurs) | `.claude/findings/multi-bundle-conversion-e1-finish-findings.md` |
| ADR-0001 (canonical authoring model, rule schema v2) | `docs/adr/0001-canonical-authoring-model-rule-schema-v2.md` |
| ADR-0002 (exact passage storage, licensing) | `docs/adr/0002-exact-passage-storage-licensing.md` |
| ADR-0004 (clinical approval identity adjudication) | `docs/adr/0004-clinical-approval-identity-adjudication.md` |
| Prior plan's progress tracker (STALE — resynced/superseded by P5-T2) | `.claude/progress/multi-bundle-conversion-e1/` |
| This feature's progress tracker | `.claude/progress/multi-bundle-conversion-e1-finish/` |
| Feature guide (created post-Phase-5, per Wrap-Up) | `.claude/worknotes/multi-bundle-conversion-e1-finish/feature-guide.md` |

### Wave Order (from plan `wave_plan.waves` — fully serial, 41.0 pts total)

Every wave is exactly one phase; there is **no parallel-phase execution** in this plan (unlike the
prior E1 pass) — P0 → P1 → P2 → P3 → P4 → P5, strictly serial, because each phase's output is a
prerequisite for the next phase being meaningfully testable (decisions-file content must actually
drive behavior before authoring it makes sense; docs can only describe tested, known behavior).

**Amended post-planning-gate review** (2 BLOCKING findings closed): P1 grew from 6.75 to 8.25 pts
(+1.5, new task P1-T8) and P2 grew from 6.5 to 7.5 pts (+1.0, new task P2-T7). Total: 38.5 → 41.0 pts.

| Wave | Phase | Estimate | Notes |
|------|-------|---------:|-------|
| W1 | P0 — Gate recovery | 4.75 pts | Data/fixture-only; zero converter code touched; 2 file-disjoint parallel batches inside the phase |
| W2 | P1 — Fail-closed emission gate becomes code (**MUST-stay-primary**) | 8.25 pts | No fallback chain by design — blocks rather than downgrades if primary unavailable. Includes P1-T8: a governance refusal must be a caught, non-fatal signal, never an exception escaping `propose.mjs`'s `run()` |
| W3 | P2 — Module-generic drafting substrate (**MUST-stay-primary**) | 7.5 pts | **HARD SAFETY INTERLOCK on P1** — `cbc_suite_v1` byte-identity anchor is the hard exit gate. Includes P2-T7: `writeDraftPack()`/`CANDIDATES` genericized by `moduleId`, not just the gate's own `RULE_PROPOSALS` consumption |
| W4 | P3 — Author 3× non-approving decisions files (**MUST-stay-primary, zero delegation**) | 8.5 pts | Opus sign-off pass (P3-T7) is mandatory before the phase closes; P3-T1's scope-lock AC now checks substance (moduleId, cross-module-leak), not only file-set existence |
| W5 | P4 — 4-of-4 batch + determinism + semantic-diff (R-3) | 6.0 pts | Semantic-diff extension (P4-T4/T5) and adjudication of the diff result (P4-T6) are all MUST-stay-primary — P4-T1..T3 are the only off-primary tasks in this phase |
| W6 | P5 — Honesty reconciliation, docs, findings closure | 6.0 pts | 4 design specs are **created**, not updated (R-1) |

**Critical path**: P0 → P1 → P2 → P3 → P4 → P5, fully serial, 41.0 of 41.0 pts on the critical path —
there is no phase with schedule slack in this plan.

---

## THE Safety Interlock — P1 must land before P2 begins (non-negotiable)

Binding per decisions block §0/§7a and the parent plan's `wave_plan.phases[P2].depends_on: [P1]`
frontmatter edge (a hard dependency, not merely stated in prose). Removing the accidental protection
(the hard-coded `MODULE_ID` string check, Phase 2) before installing the intentional one (Phase 1's
live `status === 'approved_for_rule_draft'` allowlist branch) would arm AI-draftable rule emission
across `anemia`/`kidney_suite_v1`/`growth_suite_v1` with nothing but an inert documentation field
standing in the way. P1 and P2 also physically collide on
`tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs` (a `wave_plan.serialization_barriers` entry), so even
absent the safety rationale they could not run concurrently. Encoded in
`.claude/progress/multi-bundle-conversion-e1-finish/phase-2-progress.md` as both `depends_on: ["P1"]`
and an explicit `blockers` entry (`SAFETY-INTERLOCK-P1-P2`) — do not clear that blocker until `P1-GATE`
has recorded a passing `task-completion-validator` + `karen` verdict.

---

## MUST-stay-primary tasks (no ICA/codex fallback — safety-critical, marked per-task in progress files)

Per the parent plan's binding "Model, Provider & Profile Assignment" section:

- **Every task in Phase 1** (P1-T1..T8, P1-GATE) — the fail-closed emission gate itself. P1-T8 (added
  post-planning-gate review) makes a governance refusal a caught, non-fatal signal in `propose.mjs`.
- **Every task in Phase 2** (P2-T1..T7, P2-GATE) — the module-generic drafting substrate; the
  `cbc_suite_v1` byte-identity regression anchor. P2-T7 (added post-planning-gate review) genericizes
  `writeDraftPack()`/`CANDIDATES` by `moduleId`.
- **Every authorship task in Phase 3** (P3-T1..T5, P3-T7, P3-GATE) — authoring the 3 non-approving
  decisions files; P3-T7 escalates to `claude-opus-4-8` for the mandatory verdict pass.
- **P4-T4/T5 and P4-T6** (semantic-diff extension work and adjudication of its result) — MUST-stay-
  primary even though P4-T1..T3 route to `codex-executor`, per the plan's explicit rule that
  judgment-bearing content and adjudication work are never delegated (this was previously
  mis-flagged as a plan-internal discrepancy in this file — see below, now reconciled).

**Deliberately NOT marked MUST-stay-primary** (adversarial second-opinion review — flags only, never
approves, never authors, intentionally routed off-primary by plan design): P1-T7, P3-T6 (both
`gpt-5.6-terra`). Do not reassign these to native Claude, and do not treat their findings as
auto-applied — they are adjudicated by the phase's own native-Claude gate.

Every task in P0 and most of P5 route off-primary (ICA free-tier / codex) by design — mechanical,
spec-bounded, non-adjudicating work. See each phase's own progress file "Model / Provider Assignment"
table for the full per-task breakdown.

---

## Reconciled Plan-Internal Discrepancy (RESOLVED post-planning-gate review — no longer open)

Phase 4's Phase Summary / Model-Provider-Assignment prose previously read "codex-executor for
P4-T1..T5; native Claude only for P4-T6 adjudication," which did not match the Phase 4-5 detail
file's own per-task table, which assigns **P4-T4 and P4-T5** to `native`/`claude-sonnet-5` directly
(not `codex-executor`). **Resolution: the per-task detail-file table was correct.** The parent plan's
prose (Phase Summary table, "Model, Provider & Profile Assignment" section) and `phase-4-progress.md`
(including its `must_stay_primary` flags for P4-T4/T5, previously incorrectly `false`) have all been
corrected to match it — P4-T4/T5 are `native`/`claude-sonnet-5`, MUST-stay-primary (judgment-bearing
semantic-diff-extension content work, not mechanical harness code), alongside P4-T6's adjudication;
only P4-T1..T3 route to `codex-executor`. No further action needed before dispatching P4-T4/T5.

---

## Implementation Decisions

None logged yet — decisions block §7a rulings R-1/R-2/R-3 and OQ-1..OQ-6 (PRD §12) are binding per the
parent plan's "Decisions & OQ Resolutions" section and are not re-logged here as open questions. Add
phase-specific decisions here as they are made during execution.

---

## Gotchas & Observations

None yet — execution has not started. Add entries here as phases run.

---

## Integration Notes

None yet. When P4-T6 adjudicates the actual semantic-diff result for each of the 3 non-cbc modules,
record the real closure-path decision here (converter-derived-going-forward vs. bespoke-stays-
authoritative), not just what the plan anticipates.

---

## Performance Notes

None yet.

---

## Agent Handoff Notes

None yet — first agent to pick up Phase 0 should start with the file-disjoint batch (a)/(b) tasks
(P0-T1..T3 and P0-T4/T6/T7 can all start immediately, no interdependency); P0-T8/P0-T9 run after both
batches merge. Do not touch any file under `tools/rf-bundle-to-kb-pack/**` in Phase 0 — it is
data/fixture-only.

---

## References

**Related Files**:
- Progress tracking: `.claude/progress/multi-bundle-conversion-e1-finish/phase-{0..5}-progress.md`
- Implementation plan: `docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md`
- PRD: `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md`
- Decisions block: `.claude/worknotes/multi-bundle-conversion-e1-finish/decisions-block.md`
- Prior feature (direct predecessor, stale tracker resynced by P5-T2): `.claude/progress/multi-bundle-conversion-e1/`
