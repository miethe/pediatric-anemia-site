---
type: context
schema_version: 2
doc_type: context
prd: "evidence-foundry-e1"
feature_slug: "evidence-foundry-e1"
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md
title: "evidence-foundry-e1 - Development Context"
status: "active"
created: "2026-07-21"
updated: "2026-07-21"

critical_notes_count: 0
implementation_decisions_count: 0
active_gotchas_count: 0
agent_contributors: []

agents: []

phase_status: [
  { phase: 1, status: "not_started" },
  { phase: 2, status: "not_started" },
  { phase: 3, status: "not_started" },
  { phase: 4, status: "not_started" },
  { phase: 5, status: "not_started" }
]

blockers: []

decisions: []

integrations: []

gotchas: []

modified_files: []

notes: "Progress tracking scaffolded pre-execution on 2026-07-21 — all 5 phase files created at status: not_started, 0% complete. G0-G4 are external human gates tracked as blocked-external states in Phase 5 (P5-T5), never as tasks. See References below for the full pointer set."
---

# evidence-foundry-e1 - Development Context

**Status**: Active Development (scaffolded, execution not yet started)
**Created**: 2026-07-21
**Last Updated**: 2026-07-21

> **Purpose**: Shared worknotes for all agents working the Evidence Foundry E1 feature (review
> workflow, signed preclinical release, retrospective validation). Add brief observations, decisions,
> gotchas, and implementation notes that future agents should know.

---

## Quick Reference

**Agent Notes**: 0 notes from 0 agents (scaffolded, no execution has started)
**Critical Items**: 0
**Last Contribution**: none yet

### Pointers

| Document | Path |
|---|---|
| Implementation Plan (parent) | `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md` |
| Phase 1 detail | `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-1-contracts-gates.md` |
| Phases 2-4 detail | `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-2-4-workstreams.md` |
| Phase 5 detail | `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-5-integration-docs.md` |
| PRD | `docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md` |
| Decisions Block (binding, R1-R6) | `.claude/worknotes/evidence-foundry-e1-v1/decisions-block.md` |
| Planning Brief | `.claude/worknotes/evidence-foundry-e1-v1/planning-brief.md` |
| ADR-0004 (review workflow) | `docs/adr/0004-clinical-approval-identity-adjudication.md` |
| ADR-0005 (signing/key custody) | `docs/adr/0005-kb-serialization-signing-key-custody.md` |
| ADR-0006 (validation data boundary) | `docs/adr/0006-validation-data-boundary-deidentification.md` |
| SPIKE-006 (signing custody, NO-GO precedent) | `docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md` |
| Design spec (source of `02 §N.N` citations) | `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` |
| Human Brief (not yet authored — load-bearing pointer) | `docs/project_plans/human-briefs/evidence-foundry-e1.md` |
| Contracts design worknote (created by P1-T1) | `.claude/worknotes/evidence-foundry-e1-v1/contracts-design.md` |
| Dry-run friction note (created by P2-T8) | `.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md` |
| Feature guide (created post-Phase-5) | `.claude/worknotes/evidence-foundry-e1-v1/feature-guide.md` |
| E0 precedent (completed, PR #17) | `.claude/progress/evidence-foundry-buildout/` |

### Wave Order (from plan `wave_plan.waves`)

Provider is `claude`/`sonnet` for every task except Phase 5's CHANGELOG/frontmatter mechanics
(`haiku`, P5-T4/P5-T10). 34 pts total across 5 phases (plan frontmatter `effort_estimate`; Phase 4's
own task table sums to 9.0 pts against a stated 8 pts in the plan's Phase Summary — flagged in
`phase-4-progress.md`, not silently reconciled). Critical path: **P1 → max(P2,P3,P4) → P5** = 18 of 34
pts serialized; P2/P3/P4 are each ~8 pts and co-critical — any one slipping delays P5.

| Wave | Phase(s) | Notes |
|------|----------|-------|
| W1 | [1] | Contracts & Gates — no dependencies, first phase; 1st `karen` milestone at close (contract sanity, hard prerequisite for W2) |
| W2 | [2, 3, 4] | **Parallel wave.** Review workflow (`tools/review-record/`) ∥ Signed release (`tools/release-sign/` + `releases/`) ∥ Retrospective harness (`tools/retro-validate/`). File ownership fully disjoint; each phase gates independently via its own `task-completion-validator` |
| W3 | [5] | Integration, honesty audit, docs — requires ALL of P2/P3/P4 complete; final `karen` feature-end review; plan `status` may only advance after this passes |

**Parallel-wave note**: Phases 2, 3, and 4 are not sequential in execution even though they are
numbered sequentially in the plan — they open together immediately after Phase 1's `karen` milestone
(P1-GATE2) and each closes on its own gate. A lagging workstream never blocks review of the other two;
only Phase 5 waits on all three.

---

## Gates G0–G4 (external human actions — never tasks)

Binding per PRD §6.0 + decisions block §5 (rulings R2/R4). Full detail lives in the Phase 1 gates
registry deliverable (`docs/governance/gates-registry.md`, authored by P1-T6) and is tracked as
externally-blocked owner-action states in `.claude/progress/evidence-foundry-e1/phase-5-progress.md`
(P5-T5), mirroring the arc-clinical-council-adoption-v1 P5 "owner-blocked" precedent.

| Gate | Name | Owner | Entry Criteria (summary) | What It Unblocks |
|------|------|-------|---------------------------|-------------------|
| G0 | ADR ratification | human | ADR-0004/0005/0006 accepted (currently `proposed`) | Any downstream design assumption treated as settled |
| G1 | Named credentialed reviewer roster | human | Real (non-synthetic) entries added to `governance/reviewer-roster.yaml` with out-of-band `verificationRef` | Non-synthetic review records; release-authorization chains involving real reviewers |
| G2 | Signing custodian + offline key ceremony | human | Custodian named, **distinct authority from the release author** (A2 reconciliation); ceremony run per `docs/governance/signing-ceremony-runbook.md` | Any real (non-dry-run) `sign` invocation; populated signature slots on real candidates |
| G3 | Data-source SPIKE verdict + data-partner DUA | human | SPIKE-007 run (charter authored, not run, in this plan) + DUA executed | Any real-data retrospective validation run (DF-E1-09) |
| G4 | Release authorizer | human | Named authority approves a specific release candidate | `unsigned-stub → release-ready` transition (schema-impossible pre-G1/G4 regardless) |

No task in this plan claims to clear, advance, or partially satisfy any gate. No task's exit criteria
depend on a gate being cleared. Every gated behavior ships schema-forced inert (`approvedBy[]`/
`clinicalApprovers[]` `maxItems: 0`; signature slots const-null pre-G2; roster synthetic-only pre-G1;
real-data harness input structurally rejected pre-G3).

---

## Implementation Decisions

None logged yet — decisions block §11 rulings R1-R6 and the plan's own OQ-1..OQ-6 / PRD OQ-1/OQ-5/OQ-6
resolutions are binding per the parent plan's "Decisions & OQ Resolutions" section and are not
re-logged here as open questions. Add phase-specific decisions here as they are made during execution
(with `phase`, `location`, and `rationale` populated per the schema).

---

## Gotchas & Observations

None yet — execution has not started. Add entries here as phases run.

---

## Integration Notes

None yet. When Phase 5's P5-T1 cross-workstream dry-run runs, record the actual
review→release→retrospective handoff shape here (not just what the plan specifies).

---

## Performance Notes

None yet.

---

## Agent Handoff Notes

None yet — first agent to pick up Phase 1 should start with P1-T1 (contracts design note), the hard
blocker for every other Phase 1 task and, transitively, for Phases 2-4.

---

## References

**Related Files**:
- Progress tracking: `.claude/progress/evidence-foundry-e1/phase-{1..5}-progress.md`
- Implementation plan: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md`
- PRD: `docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md`
- Decisions block: `.claude/worknotes/evidence-foundry-e1-v1/decisions-block.md`
- Planning brief: `.claude/worknotes/evidence-foundry-e1-v1/planning-brief.md`
