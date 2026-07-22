---
type: context
schema_version: 2
doc_type: context
prd: clinical-review-workflow
feature_slug: clinical-review-workflow
prd_ref: docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
title: "Clinical Review Workflow v1 (DF-E1-01) - Development Context"
status: active
created: '2026-07-22'
updated: '2026-07-22'
critical_notes_count: 1
implementation_decisions_count: 1
active_gotchas_count: 3
agent_contributors: [Opus orchestrator, implementation-planner]
agents:
- agent: Opus orchestrator
  note_count: 1
  last_contribution: '2026-07-22'
- agent: implementation-planner
  note_count: 1
  last_contribution: '2026-07-22'
---

# Clinical Review Workflow v1 (DF-E1-01) - Development Context

**Status**: Active Development
**Created**: 2026-07-22
**Last Updated**: 2026-07-22

> **Purpose**: Shared worknotes for all agents executing `clinical-review-workflow`. Read this
> before touching `tools/review-record/` under this feature. Full decision rationale (phase
> boundaries, risk hotspots, agent/model routing) lives in the **decisions block** —
> `.claude/worknotes/clinical-review-workflow/decisions-block.md` — this file does not
> duplicate it, only orients and points to it.

---

## Quick Reference

**Agent Notes**: 2 notes from 2 agents (Opus orchestrator, implementation-planner)
**Critical Items**: 1 (scope framing — see below)
**Last Contribution**: implementation-planner on 2026-07-22

**Progress tracking**: `.claude/progress/clinical-review-workflow/phase-{1..5}-progress.md`
**Decisions block (canonical rationale)**: `.claude/worknotes/clinical-review-workflow/decisions-block.md`

---

## Scope Framing — Read This First

**This feature is NOT a rebuild.** The file substrate — append-only git-signed review
records — is **already shipped** in `tools/review-record/` (5 verbs, 2 schemas, roster,
Ed25519 signing lib, dry-run fixtures) by `evidence-foundry-e1-v1` Phase 2. ADR-0004
(status: `proposed`, G0-gated) chose this approach for v1; a portal was explicitly declined
for now.

`clinical-review-workflow` v1 ships the **reviewer workflow layer on top of that substrate**:

1. `status` verb — derived review-state + per-module queue/turn-state (Phase 1).
2. Scaffold ergonomics — auto-derive `subjectContentHash`; scaffold writes a record file for
   the real-identity kind, still unsigned (Phase 1).
3. `sign` verb — gate-aware, fail-closed; only the dry-run/TESTKEY path is live (Phase 2).
4. `validate` performance — scoped/incremental validation, fail-closed caching (Phase 2).
5. Reviewer runbook — guided git workflow for non-engineer clinicians (Phase 3).
6. Render queue view — cross-record turn state in the existing static HTML render, no server,
   no auth, no `<script>` (Phase 3).
7. OQ-8 portal-promotion framework — friction metrics, threshold-as-proposal, decision-owner
   role, decision-record template; CONCEPT-ONLY mockups (Phase 4).
8. Tests + `npm run check` integration + docs (Phase 5).

**Do not**: recreate schemas, roster, or signing primitives that already exist under
`tools/review-record/lib/`; build portal code; or treat this feature's exit gates as clinical
sign-off of any kind.

---

## Hard Guardrails (carried verbatim from the implementation plan — binding on every task)

> - **No real-reviewer signing.** No task signs a `synthetic: false` record. `sign` refuses
>   fail-closed pre-**G1** (named credentialed reviewer roster) and pre-**G2** (signing
>   custodian + offline key ceremony, ADR-0005).
> - **No ADR-0004 acceptance.** No task edits any ADR's `status` field. ADR-0004 remains
>   `proposed` (**G0**) throughout this feature's lifetime.
> - **No `synthetic: false` roster entries.** `governance/reviewer-roster.yaml` ships 5
>   `synthetic: true` entries and 0 real entries before and after this feature. FR-4/FR-5's
>   real-identity write path is exercised only against a fixture roster, never the real one.
> - **No `clinicalApprovers[]`/`approvedBy[]` changes.** These stay schema-forced empty
>   (`maxItems: 0`); no task touches this posture.
> - **D-4 invariant untouched.** ARC/council/`rf`/any agent output remains structurally
>   ineligible to populate any reviewer or approver field. `scripts/verify-d4-built.mjs` is
>   not modified.
> - **Reviewer-2 structural independence untouched.** `nextChainLink`'s single-file-touch
>   semantics are not modified by any scaffold/status ergonomic change (FR-24).
> - **Zero new runtime dependencies, zero network, zero LLM inside `tools/review-record/`.**
>   Every verb this feature adds or extends is deterministic Node-builtin code; no task
>   introduces a dependency, an HTTP call, or a generative-model call anywhere under
>   `tools/review-record/`.

**Status: unvalidated research prototype.** Every check this plan's tasks add proves *software
behavior* only (schema shape, verb output stability, cache correctness, fail-closed refusal) —
never clinical validity, safety, diagnostic performance, or regulatory status.

---

## Key File Paths

| Path | What it is |
|------|------------|
| `tools/review-record/cli.mjs` | CLI verb dispatch — `scaffold \| validate \| list \| render \| dry-run` + this feature's new `status`, `sign` |
| `tools/review-record/lib/derived-state.mjs` | New (Phase 1) — single source of truth for review-chain derived state, shared by `status` and `validate` |
| `tools/review-record/lib/verbs/status.mjs` | New (Phase 1) — `status` verb |
| `tools/review-record/lib/verbs/sign.mjs` | New (Phase 2) — `sign` verb, TESTKEY-only |
| `tools/review-record/lib/validate-cache.mjs` | New (Phase 2) — incremental fail-closed `validate` cache |
| `tools/review-record/lib/verbs/scaffold.mjs` | Existing, extended (Phase 1) — auto-derived subject + real-identity write path |
| `tools/review-record/lib/verbs/validate.mjs` | Existing, extended (Phase 1/2/3 — shared-file collision between P2/P3, see wave plan) |
| `tools/review-record/lib/render.mjs` | Existing, extended (Phase 3) — adds queue/turn-state section, stays `<script>`-free/static |
| `tools/review-record/lib/history.mjs` | Existing, extended (Phase 2) — `--history` fail-closed union with cache |
| `tools/review-record/README.md` | Existing, updated (Phase 3/5) |
| `docs/governance/reviewer-runbook.md` | New (Phase 3) — non-engineer five-role git walkthrough, two tracks (exercise / post-G1) |
| `docs/governance/gates-registry.md` | Existing — G0/G1/G2 gate states referenced throughout |
| `docs/architecture.md` §11 | Existing, updated (Phase 5) — "Review workflow, Evidence Foundry E1" |
| `docs/project_plans/design-specs/clinical-review-portal-workflow.md` | Existing, updated (Phase 4) — OQ-8 framework + mockup refs, `maturity: shaping` unchanged |
| `docs/project_plans/design-specs/assets/` | Existing — CONCEPT-ONLY watermarked portal mockups (Phase 4) |
| `.claude/worknotes/clinical-review-workflow/friction-observations.md` | New (Phase 4) — committed markdown friction-metric log format |
| `docs/adr/0004-clinical-approval-identity-adjudication.md` | Existing — `status: proposed`, G0-gated, never edited by this feature |
| `docs/adr/0005-kb-serialization-signing-key-custody.md` | Existing — signing custody/ceremony reference for `sign`'s refusal messages |
| `governance/reviewer-roster.yaml` | Existing — 5 `synthetic: true` entries; never written by this feature's tests |
| `schemas/review-record.schema.json` / `schemas/reviewer-roster.schema.json` | Existing — no schema changes in this feature |
| `.claude/progress/clinical-review-workflow/phase-{1..5}-progress.md` | Task-level tracking (this feature) |
| `.claude/worknotes/clinical-review-workflow/decisions-block.md` | **Canonical** phase boundaries, risk hotspots (R1-R9), agent/model routing — expands, does not override |

---

## Implementation Decisions

> Key architectural and technical decisions made during development. The full decision record
> is the decisions block; this section only flags decisions load-bearing enough that an
> executor should not miss them without opening that file.

### 2026-07-22 - Opus orchestrator / implementation-planner - Workflow layer, not a rebuild

**Decision**: `clinical-review-workflow` v1 builds two new CLI verbs (`status`, `sign`), one
shared derived-state library, one incremental-validate cache, one render section, one runbook,
and one portal-promotion framework — entirely on top of the already-shipped
`tools/review-record/` file substrate. No new schemas, no new module-package concept, no new
signing primitive.

**Rationale**: `evidence-foundry-e1-v1` Phase 2 already built the substrate (5 verbs, 2
schemas, roster, Ed25519 lib, dry-run fixtures) and explicitly deferred these workflow-layer
items as "friction observations" (see
`.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md`). This plan pays that deferred
follow-on cost.

**Location**: `docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md` §"Scope framing"

**Impact**: Any task that starts re-deriving schema shape, roster format, or the signing
primitive from scratch is out of scope — check the decisions block / substrate README first.

---

## Gotchas & Observations

### 2026-07-22 - implementation-planner - `validate.mjs` shared-write collision (P2 vs P3)

**What**: Both Phase 2 (`P2-T3`/`P2-T4`, incremental cache) and Phase 3 (`P3-T1`/`P3-T2`,
render + terminal-state messaging) write `tools/review-record/lib/verbs/validate.mjs`.

**Why**: Phase 2 adds cache-consult logic; Phase 3 adds the FR-12 terminal-state message.
Both are legitimate, non-overlapping edits to the same file.

**Solution**: The computed wave plan pushes Phase 3 to wave 3 (after Phase 2's wave 2) purely
to avoid a concurrent-write collision. This is a scheduling fact, **not** a scope dependency —
Phase 3 still depends only on Phase 1 per the decisions block's dependency map.

**Affects**: Phase 2, Phase 3.

### 2026-07-22 - implementation-planner - `sign` is TESTKEY-only; no `--keyfile` seam

**What**: OQ-1 resolved `sign`'s key source as TESTKEY-only, ephemeral in-memory Ed25519 — no
`--keyfile`/`--key`/`--test-keys`/env-var seam ships in this feature at all, for any input.

**Why**: Any keyfile-reading code path under `tools/review-record/` would be a structural
regression against the "no real signing pre-G1/G2" hard guardrail — even an unused seam
reads as machinery pointed at a future real-signing capability.

**Solution**: Phase 2's `sign` fail-closed refusal task (`P2-T2`) includes a static grep test
proving zero key-reading code exists anywhere under `tools/review-record/`.

**Affects**: Phase 2.

### 2026-07-22 - implementation-planner - Codex second-opinion catches real fail-closed gaps

**What**: Every phase carries a read-only `codex gpt-5.6-terra` second-opinion diff-review
gate after `task-completion-validator` (and after `karen` on Phases 4/5) passes.

**Why**: Per prior-session memory (`codex-second-opinion-catches-real-gaps`), this pattern has
previously found real fail-closed gaps that automated validators approved — Phase 2 (sign
refusal, cache staleness) is the highest-risk phase for this to matter.

**Solution**: Do not skip the codex gate rows even when `task-completion-validator`/`karen`
pass cleanly; any flagged gap becomes a task before the next phase opens.

**Affects**: All five phases.

---

## Agent Handoff Notes

### 2026-07-22 - Opus orchestrator / implementation-planner → Phase 1 executor

**Completed**: PRD + implementation plan authored and committed; tracking artifacts
(this context file, 5 phase progress files) scaffolded.

**Next**: Open Phase 1 (`P1-T1`/`P1-T3` batch — no dependencies). See
`.claude/progress/clinical-review-workflow/phase-1-progress.md`'s Orchestration Quick
Reference for ready-to-copy `Task()` commands.

**Watch Out For**: `docs/project_plans/human-briefs/clinical-review-workflow.md` does not
exist yet — scaffold it on first execution wave per the creation heuristic; the plan's H1-H6
Estimation Sanity Check is drafted inside an HTML comment at the end of the implementation
plan for migration into that brief's §2, not duplicated here.

---

## References

**Related Files**:
- Progress tracking: `.claude/progress/clinical-review-workflow/phase-{1..5}-progress.md`
- Implementation plan: `docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md`
- PRD: `docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md`
- Decisions block (canonical): `.claude/worknotes/clinical-review-workflow/decisions-block.md`
- Substrate README: `tools/review-record/README.md`
- ADRs: `docs/adr/0004-clinical-approval-identity-adjudication.md`,
  `docs/adr/0005-kb-serialization-signing-key-custody.md`
- Design spec: `docs/project_plans/design-specs/clinical-review-portal-workflow.md`
- Gates registry: `docs/governance/gates-registry.md`
