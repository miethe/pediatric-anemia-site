---
title: "Clinical Review Workflow v1 (DF-E1-01) — Implementation Plan"
schema_version: 2
doc_type: implementation_plan
status: draft
created: '2026-07-22'
updated: '2026-07-22'
feature_slug: clinical-review-workflow
feature_version: v1
prd_ref: docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md
plan_ref: null
scope: >
  Ship the v1 reviewer workflow layer (status/sign verbs, scaffold ergonomics, incremental
  validate, render queue view, runbook, OQ-8 portal-promotion framework) on top of the
  already-shipped tools/review-record/ file substrate — no portal, no real signing, no roster
  or gate changes.
effort_estimate: '19 pts'
architecture_summary: >
  Two new CLI verbs (status, sign) + one shared derived-state library + one incremental-validate
  cache, layered on tools/review-record/'s existing store/chain/roster/signature/subject/render
  libs. No new schemas, no new module packages, no new services.
related_documents:
  - docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md
  - docs/adr/0004-clinical-approval-identity-adjudication.md
  - docs/adr/0005-kb-serialization-signing-key-custody.md
  - docs/project_plans/design-specs/clinical-review-portal-workflow.md
  - docs/governance/gates-registry.md
  - tools/review-record/README.md
  - .claude/worknotes/clinical-review-workflow/decisions-block.md
  - .claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md
references:
  user_docs:
    - docs/governance/reviewer-runbook.md
  context: []
  specs:
    - schemas/review-record.schema.json
    - schemas/reviewer-roster.schema.json
  related_prds:
    - docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
spike_ref: null
adr_refs:
  - docs/adr/0004-clinical-approval-identity-adjudication.md
  - docs/adr/0005-kb-serialization-signing-key-custody.md
deferred_items_spec_refs: []
findings_doc_ref: null
charter_ref: null
changelog_ref: null
test_plan_ref: null
plan_structure: unified
progress_init: auto
owner: nick
contributors:
  - Opus orchestrator
  - implementation-planner
priority: high
risk_level: high
category: infrastructure
tags: [implementation-plan, clinical-review, evidence-foundry, df-e1-01, workflow]
milestone: null
commit_refs: []
pr_refs: []
files_affected:
  - tools/review-record/cli.mjs
  - tools/review-record/lib/derived-state.mjs
  - tools/review-record/lib/adjudication.mjs
  - tools/review-record/lib/validate-cache.mjs
  - tools/review-record/lib/verbs/status.mjs
  - tools/review-record/lib/verbs/sign.mjs
  - tools/review-record/lib/verbs/scaffold.mjs
  - tools/review-record/lib/verbs/validate.mjs
  - tools/review-record/lib/render.mjs
  - tools/review-record/README.md
  - docs/governance/reviewer-runbook.md
  - docs/architecture.md
  - docs/project_plans/design-specs/clinical-review-portal-workflow.md
  - docs/project_plans/design-specs/assets/**
  - tests/**
  - package.json
wave_plan:
  serialization_barriers: []
  phases:
    - id: P1
      depends_on: []
      isolation: shared
      parallelizable: true
      model: sonnet
      effort: adaptive
      files_affected:
        - tools/review-record/lib/derived-state.mjs
        - tools/review-record/lib/adjudication.mjs
        - tools/review-record/lib/verbs/status.mjs
        - tools/review-record/lib/verbs/scaffold.mjs
        - tools/review-record/lib/verbs/validate.mjs
        - tools/review-record/cli.mjs
    - id: P2
      depends_on: [P1]
      isolation: shared
      model: sonnet
      effort: extended
      files_affected:
        - tools/review-record/lib/verbs/sign.mjs
        - tools/review-record/lib/validate-cache.mjs
        - tools/review-record/lib/verbs/validate.mjs
        - tools/review-record/lib/history.mjs
        - tools/review-record/cli.mjs
    - id: P3
      depends_on: [P1]
      isolation: shared
      files_affected:
        - tools/review-record/lib/render.mjs
        - tools/review-record/lib/verbs/render.mjs
        - tools/review-record/lib/verbs/validate.mjs
        - tools/review-record/lib/verbs/status.mjs
        - docs/governance/reviewer-runbook.md
        - tools/review-record/README.md
    - id: P4
      depends_on: [P1]
      isolation: shared
      files_affected:
        - docs/project_plans/design-specs/clinical-review-portal-workflow.md
        - docs/project_plans/design-specs/assets/**
        - .claude/worknotes/clinical-review-workflow/friction-observations.md
    - id: P5
      depends_on: [P2, P3, P4]
      isolation: shared
      files_affected:
        - tests/**
        - docs/architecture.md
        - tools/review-record/README.md
        - package.json
        - docs/project_plans/design-specs/*.md
  waves:
    - [P1]
    - [P2, P4]
    - [P3]
    - [P5]
---

# Implementation Plan: Clinical Review Workflow v1 (DF-E1-01)

**Plan ID**: `IMPL-2026-07-22-CLINICAL-REVIEW-WORKFLOW`
**Date**: 2026-07-22
**Author**: implementation-planner (sonnet), expanding the Opus decisions block
**Human Brief**: `docs/project_plans/human-briefs/clinical-review-workflow.md` (holds this plan's
Estimation Sanity Check in its §2, migrated from this file — not duplicated in-line here)
**Related Documents**:
- **PRD**: `docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md`
- **Decisions block**: `.claude/worknotes/clinical-review-workflow/decisions-block.md` (phase
  boundaries, risk hotspots, agent/model routing — this plan expands it; does not override it)
- **ADRs**: `docs/adr/0004-clinical-approval-identity-adjudication.md` (status `proposed`, G0-gated),
  `docs/adr/0005-kb-serialization-signing-key-custody.md`
- **Substrate**: `tools/review-record/README.md`, `schemas/review-record.schema.json`,
  `schemas/reviewer-roster.schema.json` — shipped by `evidence-foundry-e1-v1` Phase 2; **not
  rebuilt here**.

**Complexity**: Large (Tier 3, 19 pts, 5 phases)
**Total Estimated Effort**: 19 pts (P1=5, P2=4, P3=4, P4=3, P5=3 — per decisions block §4, held)
**Target Timeline**: ~2 execution weeks (wave-gated, see Wave Plan below)

> **OQ-5 decision, recorded here per plan convention**: `changelog_required` is **not set** in this
> plan's frontmatter (left absent, not `false`). This feature is internal tooling (a local CLI +
> docs) with no user-facing product change to the anemia microsite; Documentation Finalization work
> is folded into Phase 5 and does not include a CHANGELOG `[Unreleased]` entry.

---

## Hard Guardrails (carried verbatim — binding on every task below)

> - **No real-reviewer signing.** No task signs a `synthetic: false` record. `sign` refuses fail-
>   closed pre-**G1** (named credentialed reviewer roster) and pre-**G2** (signing custodian +
>   offline key ceremony, ADR-0005).
> - **No ADR-0004 acceptance.** No task edits any ADR's `status` field. ADR-0004 remains `proposed`
>   (**G0**) throughout this feature's lifetime.
> - **No `synthetic: false` roster entries.** `governance/reviewer-roster.yaml` ships 5 `synthetic:
>   true` entries and 0 real entries before and after this feature. FR-4/FR-5's real-identity write
>   path is exercised only against a fixture roster, never the real one.
> - **No `clinicalApprovers[]`/`approvedBy[]` changes.** These stay schema-forced empty
>   (`maxItems: 0`); no task touches this posture.
> - **D-4 invariant untouched.** ARC/council/`rf`/any agent output remains structurally ineligible
>   to populate any reviewer or approver field. `scripts/verify-d4-built.mjs` is not modified.
> - **Reviewer-2 structural independence untouched.** `nextChainLink`'s single-file-touch semantics
>   are not modified by any scaffold/status ergonomic change (FR-24).
> - **Zero new runtime dependencies, zero network, zero LLM inside `tools/review-record/`.** Every
>   verb this feature adds or extends is deterministic Node-builtin code; no task introduces a
>   dependency, an HTTP call, or a generative-model call anywhere under `tools/review-record/`.

**Status: unvalidated research prototype.** Every check this plan's tasks add proves *software
behavior* only (schema shape, verb output stability, cache correctness, fail-closed refusal) —
never clinical validity, safety, diagnostic performance, or regulatory status.

---

## Executive Summary

This plan expands the Opus decisions block into five phases that ship the reviewer *workflow*
layer on top of the already-shipped `tools/review-record/` file substrate: a derived `status` verb
and shared derived-state library (P1), a gate-aware `sign` verb plus incremental fail-closed
`validate` caching (P2), a render queue view and non-engineer reviewer runbook (P3, parallel to
P2), the OQ-8 portal-promotion decision framework plus concept-only mockups (P4, parallel to P2/
P3), and a hardening/docs/deferred-items pass that seals the feature (P5). No phase clears a
human gate, adds a real roster entry, or ships portal code.

## Implementation Strategy

### Architecture Sequence

This is a CLI + docs feature, not a layered web-app slice. The applicable sequence is:
1. **Shared derived-state library** — single source of truth for review-chain state (P1).
2. **Verb surface** — `status`, `sign`, ergonomic `scaffold` (P1, P2).
3. **Performance substrate** — incremental `validate` cache (P2).
4. **Presentation surface** — static HTML render queue view (P3, the repo's *only* UI surface —
   no React/`*.tsx` exists in this codebase; per R-P4 the smoke task targets that render surface).
5. **Human-facing docs** — reviewer runbook, portal-promotion framework (P3, P4).
6. **Hardening & documentation finalization** — adversarial sweep, `npm run check` wiring,
   architecture/README updates, deferred-items design-spec stubs (P5).

### Parallel Work Opportunities

Per decisions block §5: **P3 and P4 depend only on P1's shared library, not on P2**, so both may
run alongside P2 once P1 lands. The Wave Plan (frontmatter `wave_plan`) computes this mechanically
and surfaces one refinement the decisions block's simplified dependency map does not encode: **P2
and P3 both write `tools/review-record/lib/verbs/validate.mjs`** (P2 for incremental caching, P3 for
FR-12's terminal-state message) — a shared-file collision per the two-pass wave algorithm
(`references/wave-plan-guidance.md`). P4 has no file overlap with either. The computed waves are
`[P1] → [P2, P4] → [P3] → [P5]`: P2 and P4 run concurrently; P3 is pushed one wave later to avoid a
concurrent write to `validate.mjs`. This does **not** change the dependency map in decisions block
§5 (P2, P3, P4 still each depend only on P1; P5 still depends on all three) — it is a mechanical
execution-scheduling refinement, not a scope change.

### Critical Path

P1 (shared derived-state lib) → P2 (sign + incremental validate consume it) → P5 (hardening). P3
and P4 hang off the critical path's P1 endpoint and must both complete before P5 opens, but do not
themselves gate P2.

### Phase Summary

| Phase | Title | Estimate | Target Subagent(s) | Model(s) | Provider | Profile | Notes |
|-------|-------|----------|---------------------|---------:|----------|---------|-------|
| 1 | Derived status & scaffold ergonomics | 5 pts (T1 1.0 / T2 1.5 / T3 1.0 / T4 0.5 / T5 1.0) | general-purpose (Node/CLI), Explore (recon) | sonnet | claude | — | R2/R3/R7/R8 mitigations; bounded ≤2–3-file waves ICA-offload-eligible (gates re-run in-session), EXCEPT P1-T5 (FR-26 governance-sensitive `lib/adjudication.mjs` change) which stays in-session |
| 2 | Sign verb & validate performance | 4 pts | general-purpose (single owner, crypto-adjacent) | sonnet | claude | — | In-session only — no ICA offload (fail-closed crypto-adjacent = taste/risk work) |
| 3 | Render queue view & reviewer runbook | 4 pts | general-purpose (render), documentation-writer (runbook draft → honesty pass) | haiku + sonnet | claude / ica | free-tier (haiku draft) | Render ∥ runbook fully parallel within the phase |
| 4 | Portal-promotion framework & concept assets | 3 pts | opus (framework judgment), codex gpt-5.6 native image tool (mockups), documentation-writer (spec edit) | opus / gpt-5.6-terra / sonnet | claude / codex | — | Tier 3 milestone — **karen** gate |
| 5 | Hardening, docs & deferred items | 3 pts | general-purpose (tests), documentation-writer (docs) | sonnet + haiku | claude | — | Feature-end **karen** gate; DOC-006 ×3 (2 new specs + 1 confirmed existing) |
| **Total** | — | **19 pts** | — | — | — | — | Holds decisions block §4's anchor exactly |

**Model column conventions**: as in `.claude/skills/planning/references/multi-model-guidance.md` —
claude models take `adaptive`/`extended` only; codex takes its own vocabulary (image gen + review both run on the codex lane per user directive);
never story points in `Effort`.

> Estimation rationale (H1–H6) is drafted at the end of this file inside an HTML comment for later
> migration into the Human Brief's §2 — this plan retains per-task points only.

---

## Deferred Items & In-Flight Findings Policy

### Deferred Items Triage Table

Carries decisions block §8's three items exactly (PRD §13 lists three additional pure-gate rows —
real signing/G2, ADR-0004 ratification/G0, non-CBC modules — which are marked **N/A** below: they
are human-gate states already tracked in `docs/governance/gates-registry.md` / the ADR's own
`status` field, not design questions this plan's DOC-006 authors a spec for).

| Item ID | Category | Reason Deferred | Trigger for Promotion | Target Spec Path |
|---------|----------|------------------|------------------------|-------------------|
| DF-CRW-01 | policy | Portal application (auth/hosting/second trust boundary) deferred; OQ-8 framework (P4) informs, does not commit to, building it | P4 framework's threshold clears + named decision-owner ratifies | `docs/project_plans/design-specs/clinical-review-portal-workflow.md` *(existing, updated by P4-T3 — confirmed, not newly authored)* |
| DF-CRW-02 | dependency-blocked | Real-reviewer onboarding (G1) — populating `governance/reviewer-roster.yaml` with `synthetic: false` entries is an owner-blocked human act | Owner names a credentialed reviewer + records `verificationRef` (G1) | `docs/project_plans/design-specs/real-reviewer-onboarding-g1.md` *(new, P5-T4)* |
| DF-CRW-03 | dependency-blocked | DF-E1-04 retrospective-validation harness linkage — needs this feature's reviewer-identity model **plus** a data-source SPIKE (G3) and G4 release-authorization, neither of which exist | G1/G2/G3/G4 all clear + DF-E1-04 harness lands | `docs/project_plans/design-specs/df-e1-04-retrospective-validation-linkage.md` *(new, P5-T4)* |
| N/A-1 | policy | Real signing (G2) — pure gate state, no design question | G2 clears | N/A — tracked in `docs/governance/gates-registry.md` G2 |
| N/A-2 | policy | ADR-0004 ratification (G0) — pure gate state | G0 clears | N/A — tracked in ADR-0004's own `status` field |
| N/A-3 | backlog | Non-CBC modules — workflow is module-agnostic already; adapting is a future incremental scope decision, not a blocked/researched item | A second module needs review workflow | N/A — no open design question today |

`deferred_items_spec_refs` frontmatter is populated during P5-T4 with the three real paths above
(1 existing confirmed + 2 newly authored).

### In-Flight Findings

Not pre-created (per policy). If Phase 1–5 execution surfaces a plan/reality mismatch (e.g., the
`validate` incremental-cache split in FR-8 misses a check that was previously module-wide), the
executing agent creates `.claude/findings/clinical-review-workflow-findings.md` on the **first**
real finding, sets this plan's `findings_doc_ref`, and — if load-bearing — adds a fourth DOC-006 row
in Phase 5.

### Quality Gate

Phase 5 cannot be sealed until all six triage rows above are resolved (3 spec paths populated, 3
explicitly `N/A` with rationale — already true in the table above) and, if `findings_doc_ref` is
non-null, that doc is `status: accepted`.

---

## Phase Breakdown

**Column conventions** (every task table below): `Estimate` = story points, never `Effort`.
`Model` values: `sonnet` \| `haiku` \| `opus` \| `gpt-5.6-terra`. `Effort`
(claude): `adaptive` \| `extended` only; (codex `gpt-5.6-terra`, incl. its native image tool):
`low`\|`medium`\|`high`\|`xhigh`. Gate rows (`task-completion-validator`, `karen`, codex
second-opinion) carry `Estimate: —` — reviewer checkpoints, never pointed build work.

**Every phase requires `npm run check` green before its `task-completion-validator` gate.** No
exceptions; no task may claim phase completion with a red gate.

---

### Phase 1: Derived status & scaffold ergonomics

**Duration**: ~2 engineer-days · **Dependencies**: None (wave 1) · **Assigned Subagent(s)**:
general-purpose (sonnet, Node/CLI), Explore (read-only substrate recon feeding P1-T1)
**Exit gate**: `status` and `validate` both consume the one `computeDerivedReviewState` result on the
committed `cbc_suite_v1` set + 2 adversarial fixtures (F6); FR-26 adjudication policy passes on both
agree/disagree fixtures; `status` redacts by default (F7) and returns `invalid` fail-closed (F8);
zero new runtime dependencies; `npm run check` green.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|---------:|--------------|-------|--------|---------------|
| P1-T1 | Structured shared derived-state result (FR-2/FR-6, R2, F6) | Explore recons `validate`'s release-authorization path; define ONE structured pure function in new `tools/review-record/lib/derived-state.mjs` — `computeDerivedReviewState(allModuleRecords, rosterVerifiedByReviewId, opts) -> { state, nextExpectedRole, eligibility, blockers: string[] }` (machine-readable `blockers`). Refactor `lib/verbs/validate.mjs` to consume it and MAP its `blockers`/`eligibility` onto validate's existing violation-string output (no output-shape change to `validate`); make `evaluateReleaseAuthorization` this function's release-auth sub-check whose `violations[]` map 1:1 onto `blockers[]`, not a parallel path status merely "agrees with" (F6). | `tests/ef-review-workflow.test.mjs` and `tests/ef-review-adjudication.test.mjs` pass unchanged; a matrix test drives `computeDerivedReviewState` over every `state` × representative `blockers[]` combination; grep test asserts `lib/verbs/validate.mjs` and `lib/verbs/status.mjs` contain zero duplicated derived-state logic (both import the one function). target_surfaces: `tools/review-record/lib/derived-state.mjs`, `tools/review-record/lib/verbs/validate.mjs`, `tools/review-record/lib/adjudication.mjs`, `tests/ef-review-workflow.test.mjs`. | 1.0 | general-purpose, Explore | sonnet | adaptive | None |
| P1-T2 | `status` verb + frozen `--json` shape, redacted + fail-closed (FR-1/OQ-2/FR-27/FR-28/FR-29, F4/F7/F8) | Add `status` to `cli.mjs` dispatch + new `tools/review-record/lib/verbs/status.mjs`, consuming P1-T1's function. **Frozen command signature**: `status --module <id> [--root <dir>] [--history] [--unredacted]`. **Frozen `--json` shape**: `{ moduleId, subjectContentHash, records: [{role, review_id, reviewerId, decision, synthetic, supersedes, chainLinkage}], derivedState: "not-started"\|"in-progress"\|"disputed"\|"structurally-non-qualifying"\|"acts-complete-unauthorized"\|"invalid", nextExpectedRole, blockers: string[] }`. F4: the terminal all-real state is `acts-complete-unauthorized` — never any `release-ready`-like label. F7: `reviewerId`/`decision`/`rationale` of an independence-sensitive sibling are REDACTED by default; `--unredacted` lifts it and prints a warning banner. F8: `status` exits non-zero with `derivedState: "invalid"` whenever `validate` would reject the same input (malformed YAML, roster failure, chain break, signature tamper, and — with `--history` — append-only history failure); default runs no history check (parity with `validate`). | `status --module cbc_suite_v1 --json` validates against a committed JSON-shape fixture; the enum contains `acts-complete-unauthorized` and `invalid` and NO `release-ready`-like value; a sentinel-content test proves clinical-1's `reviewerId`/`decision`/`rationale` cannot appear in default (redacted) output; a malformed/tampered fixture yields `derivedState: "invalid"` + non-zero exit; `--help` lists `status` with the exact signature above. target_surfaces: `tools/review-record/cli.mjs`, `tools/review-record/lib/verbs/status.mjs`, `tests/ef-review-workflow.test.mjs`. | 1.5 | general-purpose | sonnet | adaptive | P1-T1 |
| P1-T3 | Scaffold ergonomics: auto-derived subject + subject-hash comparison + real-identity write path (FR-3/4/5, R7/R8, F5) | **Frozen command signature**: `scaffold --module <id> --role <role> --reviewer-id <id> --decision <d> --rationale <text> [--subject <hash>] [--reviewed-at <iso>] [--supersedes <review_id>] [--allow-historical-subject] [--draft] [--root <dir>]`. (a) `--subject` becomes optional; when omitted, derive via `lib/subject.mjs`'s `computeModuleContentHash` (same function `dry-run` uses). **F5**: when `--subject` IS supplied, `scaffold` recomputes `computeModuleContentHash(module)` and hard-fails (`UsageError`) on mismatch by default — the `sha256:<64 hex>` pattern check alone cannot catch a transposed-but-pattern-valid wrong hash; `--allow-historical-subject` suppresses ONLY that comparison (never the pattern check). (b) `scaffold` builds a schema-valid record (`signature: null`) for a `synthetic: false` roster entry, exercised **only** against a new fixture roster `tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml`. | `scaffold` without `--subject` on `cbc_suite_v1` produces a byte-identical `subjectContentHash` to `dry-run`'s auto-derivation (R8 test); a transposed-but-pattern-valid `--subject` hard-fails without `--allow-historical-subject` and succeeds with it (F5 test, both directions); `scaffold` against the fixture roster's one `synthetic: false` entry produces a record with `signature: null`; a diff-check asserts zero writes to `governance/reviewer-roster.yaml` by any test in this task. target_surfaces: `tools/review-record/lib/verbs/scaffold.mjs`, `tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml`, `tests/ef-review-workflow.test.mjs`. | 1.0 | general-purpose | sonnet | adaptive | None |
| P1-T4 | Drift guard + independence-unchanged tests (R2/R3/R7/R8, FR-24, F6) | Add a drift test asserting `status --json`'s `derivedState`/`blockers` and `validate`'s violation-string mapping are BOTH derived from the single `computeDerivedReviewState` result (not two independently-shaped outputs compared for equality — F6) on (a) the committed `cbc_suite_v1` fixture, (b) a chain-broken adversarial fixture, (c) a disputed adversarial fixture. Assert the `chain_isolation_v1` independence fixture and `nextChainLink` remain untouched — no new code path in `scaffold`/`status` reads a sibling record's parsed content. Grep-assert zero diff to `docs/adr/0004-clinical-approval-identity-adjudication.md`'s `status` field and to `governance/reviewer-roster.yaml`. | 3/3 drift fixtures show `status` and `validate` sharing one derived-state result; `chain_isolation_v1` stays green; ADR-status and roster-content grep checks pass. target_surfaces: `tests/ef-review-workflow.test.mjs`, `tests/fixtures/clinical-review-workflow/`. | 0.5 | general-purpose | sonnet | adaptive | P1-T1, P1-T2, P1-T3 |
| P1-T5 | Adjudication conditional-completeness reconciliation (FR-26, R2/R7, F2) — **governance-sensitive** | Update `computeDerivedReviewState` (P1-T1) and `evaluateReleaseAuthorization` (`lib/adjudication.mjs`) so a `release-auth` record's completeness check requires the `adjudication` role **IFF** the resolved `clinical-1` and `clinical-2` `decision` fields disagree; on documented agreement, the four remaining roles (`clinical-1`, `clinical-2`, `lab`, `release-auth`) are sufficient. This encodes ADR-0004 decision item 5 into code — it does NOT touch ADR-0004's `status` field (stays `proposed`, G0). Write a short policy note in this plan's "Adjudication policy note" callout below the table. **Flagged for the P1 validator gate + codex per-wave review as a governance-sensitive behavior change.** | Fixtures on BOTH paths: an agree-path five-record set MINUS `adjudication` evaluates as complete (no missing-role blocker); a disagree-path set MINUS `adjudication` reports the `adjudication`-missing blocker; the committed `cbc_suite_v1` dry-run fixture's existing terminal behavior is unchanged; a grep test confirms ADR-0004 `status` is untouched. target_surfaces: `tools/review-record/lib/adjudication.mjs`, `tools/review-record/lib/derived-state.mjs`, `tests/ef-review-adjudication.test.mjs`. | 1.0 | general-purpose | sonnet | extended | P1-T1 |
| P1-GATE1 | `task-completion-validator` gate | Verify Phase 1 exit gate (see above); `npm run check` green; explicitly re-check FR-26's governance-sensitive adjudication change against ADR-0004 decision item 5 on both agree/disagree paths. | All exit-gate criteria pass; recorded in phase progress note. | — | task-completion-validator | sonnet | adaptive | P1-T1..T5 |
| P1-GATE2 | codex `gpt-5.6-terra` read-only second-opinion diff review | Read-only diff review of the full P1 changeset against decisions block R2/R3/R7/R8 and PRD FR-1..6/FR-24/FR-26..29 — no write access; specifically scrutinizes the FR-26 adjudication-policy change and the FR-27 redaction default for fail-closed/independence gaps missed by the automated suite. | Review recorded; any flagged gap becomes a task before Phase 2 opens. | — | codex (read-only) | gpt-5.6-terra | high | P1-GATE1 |

> **Adjudication policy note (FR-26, P1-T5) — governance-sensitive.** The substrate's shipped
> `evaluateReleaseAuthorization` (`lib/adjudication.mjs`) requires ALL five roles — including
> `adjudication` — present for every release-authorization record, unconditionally. ADR-0004
> decision item 5 says adjudication is produced "only when reviewer 1 and reviewer 2 disagree."
> P1-T5 reconciles the two by making the `adjudication` role a **conditional** completeness
> requirement: required IFF the resolved `clinical-1`/`clinical-2` decisions disagree; on documented
> agreement, the four remaining roles suffice. This single role-completeness policy lives in the
> shared `computeDerivedReviewState` result (P1-T1) so `status` and `validate` cannot diverge on it
> (the earlier draft's "adjudication skipped on agreement" status path would otherwise have failed
> `validate` as incomplete — the F2 blocker). This is a behavior change to a governance-sensitive
> file: it is fixture-tested on both paths, re-checked at P1-GATE1, and diff-reviewed at P1-GATE2.
> It does **not** ratify ADR-0004 — the ADR's `status` stays `proposed` (G0 uncleared).

---

### Phase 2: Sign verb & validate performance

**Duration**: ~2 engineer-days · **Dependencies**: Phase 1 · **Assigned Subagent(s)**:
general-purpose (sonnet, single owner — crypto-adjacent work stays in-session, no ICA offload)
**Exit gate**: `sign` consumes a staged draft (never an existing `reviews/` file, F1), round-trips
against `validate` on the synthetic path and refuses fail-closed on the real path; incremental
`validate` wall-time is measurably reduced **across two separate processes** sharing the persistent
cache; the 5 composite-key fresh-process invalidation tests pass fail-closed; `npm run check` green.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|---------:|--------------|-------|--------|---------------|
| P2-T1 | `sign` verb on a staged draft, TESTKEY-only synthetic path (FR-6/FR-25, OQ-1, F1) | Add `sign` to `cli.mjs` + new `tools/review-record/lib/verbs/sign.mjs`. **Frozen command signature**: `sign --draft <path> --module <id> --root <dir>`. `sign` reads ONLY a staged draft written by `scaffold --draft` to `<root>/.review-drafts/<moduleId>/<review_id>.draft.yaml` (outside `reviews/`, gitignored); on a `synthetic: true` draft with `signature: null` it calls `lib/signature.mjs`'s `signRecordDryRun` (ephemeral in-memory Ed25519, `TESTKEY-` prefix, key discarded on return), then performs the record's FIRST and ONLY committed write through the existing `lib/store.mjs` `writeNewReviewRecordFile` append-only path. `sign` NEVER opens or rewrites a path already inside `reviews/`. OQ-1 resolved: TESTKEY-only; no `--keyfile` seam; no `sign --record` over a committed file. Requires `scaffold --draft` (P1-T3's signature) to emit the staging path. | Full flow `scaffold --draft` → `sign --draft <path>` on a synthetic fixture writes exactly one new `reviews/*.yaml` and round-trips against `validate` (chain-link + signature-verify pass); a dedicated test asserts NO pre-existing `reviews/*.yaml` path's bytes/mtime change across a `sign` call (F1); `--help` lists `sign` with the exact signature above. target_surfaces: `tools/review-record/cli.mjs`, `tools/review-record/lib/verbs/sign.mjs`, `tools/review-record/lib/verbs/scaffold.mjs`, `tests/ef-review-workflow.test.mjs`. | 1.0 | general-purpose | sonnet | extended | Phase 1 complete |
| P2-T2 | `sign` fail-closed refusal + no-keyfile grep (FR-7/23, R1) | `sign` refuses a `synthetic: false` draft with a message naming both "G1" (roster verification) and "G2" (offline key custody + ceremony, ADR-0005); refuses `--keyfile`/`--key`/`--test-keys`/env-var key paths AND a `--record` pointing at a committed file (FR-25) for **any** input. Static grep test (analogous to the existing zero-network pattern) proves zero key-reading code under `tools/review-record/`. | `sign --draft <path>` on a `synthetic: false` draft exits non-zero with a message containing both "G1" and "G2"; a `sign --record <id>` over a committed file is rejected; grep test finds zero `fs.readFile`/env-var key-path calls in `lib/verbs/sign.mjs`. target_surfaces: `tools/review-record/lib/verbs/sign.mjs`, `tests/ef-review-record-cli.test.mjs`. | 1.0 | general-purpose | sonnet | extended | P2-T1 |
| P2-T3 | Incremental `validate` composite-keyed persistent cache (FR-8, R9, F3) | New `tools/review-record/lib/validate-cache.mjs`; `validate --record <id>`/`--module` reuses previously computed per-record results (schema shape, roster resolution, signature verification, that record's chain-link check) only when EVERY component of the composite key matches — `{record content hash, complete predecessor-set content hashes, roster file hash, review-record schema hash, validator-policy version, history-mode flag}` (not the record+immediate-predecessor pair alone — F3). Cache is a PERSISTENT store OUTSIDE the repo tree (OS temp/XDG cache dir, atomic write-then-rename), keyed by `{root, moduleId}`, so warmth survives across separate CLI processes. Module-wide checks (authorship-union, independence heuristic, release-authorization evaluation) always re-run — never cache-eligible. **Frozen signature** (unchanged): `validate --module <id> [--root <dir>] [--record <review_id>] [--history]`. | A second `node` process reuses per-record results written by a first process (cross-process warmth, asserted via a call-count/marker hook, not wall-clock alone); changing any ONE key component (roster, schema, validator-policy version, record, predecessor) forces recompute; module-wide checks re-run on every invocation. target_surfaces: `tools/review-record/lib/validate-cache.mjs`, `tools/review-record/lib/verbs/validate.mjs`. | 1.0 | general-purpose | sonnet | extended | P1-T1, P2-T1 |
| P2-T4 | Fail-closed composite-key invalidation + `--history` union + cross-process microbenchmark (FR-9/10, R5, OQ-6, F3) | Any single key-component miss, read uncertainty, or unreadable/corrupt cache file triggers full recompute — never a stale pass. **Five dedicated fresh-process adversarial tests**, one per key component, seed a stale cache and assert invalidation independently: (1) roster change, (2) schema change, (3) record-content change, (4) predecessor-content change, (5) history-mode-flag change. `validate --history` results are never cached across invocations (OQ-6 fail-closed union) — every `--history` call re-runs the git-log walk. Author a repeatable microbenchmark script under `tests/` comparing cache-cold vs. cache-warm wall-time **across two separate `node` invocations** sharing the persistent cache dir on the committed 5-record `cbc_suite_v1` set. | 5/5 fresh-process invalidation tests recompute rather than stale-pass; a git-history mutation between two `--history` calls is caught on the second call; microbenchmark script committed, shows cross-process cache-warm measurably faster across 3 repeated runs. target_surfaces: `tools/review-record/lib/validate-cache.mjs`, `tools/review-record/lib/verbs/validate.mjs`, `tools/review-record/lib/history.mjs`, `tests/ef-review-workflow.test.mjs`. | 1.0 | general-purpose | sonnet | extended | P2-T3 |
| P2-GATE1 | `task-completion-validator` gate | Verify Phase 2 exit gate; `npm run check` green. | All exit-gate criteria pass; recorded in phase progress note. | — | task-completion-validator | sonnet | adaptive | P2-T1..T4 |
| P2-GATE2 | codex `gpt-5.6-terra` read-only second-opinion diff review | Read-only diff review of the full P2 changeset against R1/R5/R9 and FR-6..10/23/FR-25 — specifically hunts fail-closed gaps in the sign staged-draft lifecycle (no existing-record rewrite, F1) and the composite-key cache-staleness paths (per-component invalidation, F3) (memory: catches fail-closed gaps other reviews miss). | Review recorded; any flagged gap becomes a task before Phase 5 opens. | — | codex (read-only) | gpt-5.6-terra | high | P2-GATE1 |

---

### Phase 3: Render queue view & reviewer runbook

**Duration**: ~2 engineer-days · **Dependencies**: Phase 1 (wave 3 per the computed wave split —
see Parallel Work Opportunities) · **Assigned Subagent(s)**: general-purpose (sonnet, render) ∥
documentation-writer (haiku draft → sonnet honesty pass, runbook)
**Exit gate**: render stays `<script>`-free/static; runbook covers all 5 roles end-to-end against
the dry-run fixture; `npm run check` green.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|---------:|--------------|-------|--------|---------------|
| P3-T1 | Render queue/turn-state section (FR-11) | Add a queue/turn-state section to `lib/render.mjs`'s static HTML output: the five roles in order, each with its existing committed-record link, plus a `NEXT` or `TERMINAL` marker sourced from P1-T1's derived-state library. No `<script>`, no `<a href>` (existing constraint unchanged); semantic HTML headings for screen-reader navigation of the five roles. | Render golden under `tests/fixtures/ef-review-render/golden/` updated to include the queue section; grep test confirms zero `<script` and zero `<a href` in the new section; `tests/ef-review-render-smoke.test.mjs` continues to pass via the real CLI entry point. target_surfaces: `tools/review-record/lib/render.mjs`, `tests/fixtures/ef-review-render/golden/`, `tests/ef-review-render.test.mjs`, `tests/ef-review-render-smoke.test.mjs`. | 1.5 | general-purpose | sonnet | adaptive | P1-T1 |
| P3-T2 | Terminal-state messaging fix (FR-12) | On the `structurally-non-qualifying` derived state, `validate`, `status`, and `render` each emit an explicit sentence naming this as the correct, by-design terminus for any `synthetic: true` set — not a defect (substrate FR-6). | A shared-string test asserts the exact sentence (or agreed canonical substring) appears in `validate`'s CLI output, `status`'s human companion text, and `render`'s HTML output on the committed `cbc_suite_v1` synthetic set. target_surfaces: `tools/review-record/lib/verbs/validate.mjs`, `tools/review-record/lib/verbs/status.mjs`, `tools/review-record/lib/render.mjs`. | 0.5 | general-purpose | sonnet | adaptive | P1-T2, P3-T1 |
| P3-T3 | Author `docs/governance/reviewer-runbook.md` (FR-13, OQ-3, OQ-7) | Guided git walkthrough of the five-role sequence against the committed `cbc_suite_v1` dry-run fixture; corrections via `supersedes` (never in-place edits); what "structurally non-qualifying" means. Per OQ-7, two clearly-labeled tracks: **"exercise (synthetic personas)"** (the `sign` verb is visible on this track only) and **"post-G1 real reviewer"** (ends at scaffold-writes-the-file; commit-attribution is the reviewer's attributable act; the G2 custodian signs the release manifest separately per ADR-0005 — real reviewers never run `sign`). Linked from `tools/review-record/README.md` and `docs/architecture.md` §11. | Runbook covers all five roles end-to-end; both labeled tracks present; docs-truth test asserts required section headers exist and that `sign` appears only under the exercise track. target_surfaces: `docs/governance/reviewer-runbook.md`. | 1.5 | documentation-writer (draft) → general-purpose (structure pass) | haiku → sonnet | adaptive | None |
| P3-T4 | Honesty-language pass (FR-14, R4) | Review every user-visible surface this phase touches (runbook, render's new section, README pointer) for language implying clinical validity, real sign-off, or a non-synthetic roster; confirm each carries or links one hop to the boundary statement. | Docs-truth test asserts `docs/governance/reviewer-runbook.md`, the render's queue-section HTML, and `tools/review-record/README.md` each contain at least one of "unvalidated research prototype" / "roster is synthetic-only" / "no clinical sign-off exists" (or agreed equivalent). target_surfaces: `docs/governance/reviewer-runbook.md`, `tools/review-record/lib/render.mjs`, `tools/review-record/README.md`. | 0.5 | general-purpose | sonnet | adaptive | P3-T1, P3-T3 |
| P3-GATE1 | `task-completion-validator` gate | Verify Phase 3 exit gate; `npm run check` green. | All exit-gate criteria pass; recorded in phase progress note. | — | task-completion-validator | sonnet | adaptive | P3-T1..T4 |
| P3-GATE2 | codex `gpt-5.6-terra` read-only second-opinion diff review | Read-only diff review of the full P3 changeset against R4/R6 and FR-11..14 — checks the render section stays script-free/static and the runbook's two-track split does not leak `sign` into the post-G1 track. | Review recorded; any flagged gap becomes a task before Phase 5 opens. | — | codex (read-only) | gpt-5.6-terra | high | P3-GATE1 |

---

### Phase 4: Portal-promotion framework & concept assets

**Duration**: ~1.5 engineer-days · **Dependencies**: Phase 1 (wave 2, parallel to Phase 2) ·
**Assigned Subagent(s)**: opus (orchestrator judgment, threshold+owner framing), codex gpt-5.6
native image tool (mockups), documentation-writer (spec edit, sonnet)
**Exit gate**: framework names metric + threshold + owner + template; mockups labeled
CONCEPT-ONLY; no portal code; `npm run check` green + **karen** (Tier 3 milestone).

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|---------:|--------------|-------|--------|---------------|
| P4-T1 | OQ-8 portal-promotion framework text (FR-15/16, OQ-4) | Draft the framework: (a) friction-metric categories + committed markdown observation-log format at `.claude/worknotes/clinical-review-workflow/friction-observations.md` (OQ-4; zero network/telemetry restated explicitly); (b) an explicit first-cut promotion threshold, stated as a proposal pending human ratification before it can trigger any action; (c) the authorized human decision-owner **role** name (never an agent, never `rf`/ARC output); (d) a decision-record template. | Framework names all four elements; the log format is a committed markdown file restating the zero-network/telemetry constraint verbatim; the decision-owner is a role name, not a person; the framework text explicitly states the threshold is a proposal pending human ratification. target_surfaces: `.claude/worknotes/clinical-review-workflow/friction-observations.md`. | 1.0 | general-purpose (opus judgment) | opus | adaptive | Phase 1 complete |
| P4-T2 | CONCEPT-ONLY watermarked portal mockups (FR-17, R6) | **Partially pre-delivered during planning**: `docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png` (gpt-5.6 native image tool, "CONCEPT ONLY — NOT COMMITTED" banner) is already committed. Task = verify/attach it to the design spec, add the manifest entry, and generate additional views only if the framework text needs them (same codex gpt-5.6 image lane). | Every image file under `docs/project_plans/design-specs/assets/` produced by this task carries the watermark; a companion manifest entry per asset records the watermark string (verified by a docs-truth grep test, since pixel-OCR is out of scope). target_surfaces: `docs/project_plans/design-specs/assets/`. | 1.0 | codex gpt-5.6 image tool | gpt-5.6-terra | medium | None |
| P4-T3 | Integrate framework + mockups into design spec (FR-15/17) | Update `docs/project_plans/design-specs/clinical-review-portal-workflow.md` with P4-T1's framework section and P4-T2's mockup references; confirm the portal section's `maturity` field stays `shaping` — never promoted by this task. | Design spec's portal section contains the four framework elements and links each mockup asset; a docs-truth test confirms `maturity: shaping` unchanged. target_surfaces: `docs/project_plans/design-specs/clinical-review-portal-workflow.md`. | 1.0 | documentation-writer | sonnet | adaptive | P4-T1, P4-T2 |
| P4-GATE1 | `task-completion-validator` gate | Verify Phase 4 exit gate; `npm run check` green. | All exit-gate criteria pass; recorded in phase progress note. | — | task-completion-validator | sonnet | adaptive | P4-T1..T3 |
| P4-GATE2 | `karen` milestone review (Tier 3, per decisions block §2) | Independently re-check against the actual diff: (1) the framework names a metric format, threshold, owner-role, and decision-record template — not a vaguer restatement; (2) the owner-role is never a person and never an agent/`rf`/ARC role; (3) every mockup asset visibly carries the CONCEPT-ONLY watermark and the design spec's portal section is still `maturity: shaping`; (4) zero portal code exists anywhere in the diff. Runs only after P4-GATE1 passes. | karen sign-off recorded; any gap becomes a task before this gate reopens. | — | karen | sonnet | adaptive | P4-GATE1 |
| P4-GATE3 | codex `gpt-5.6-terra` read-only second-opinion diff review | Read-only diff review of the full P4 changeset against R6 and FR-15..17 — checks for any language that reads as a portal commitment rather than an informing artifact. | Review recorded; any flagged gap becomes a task before Phase 5 opens. | — | codex (read-only) | gpt-5.6-terra | high | P4-GATE2 |

---

### Phase 5: Hardening, docs & deferred items

**Duration**: ~2 engineer-days · **Dependencies**: Phases 2, 3, 4 (wave 4, final) ·
**Assigned Subagent(s)**: general-purpose (sonnet, tests) ∥ documentation-writer (haiku, docs);
**karen** gate (feature end)
**Exit gate**: `npm run check` green; full adversarial sweep passes; deferred-items triage table
fully covered (§ above); `docs/architecture.md` §11 and `tools/review-record/README.md` updated.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|---------:|--------------|-------|--------|---------------|
| P5-T1 | Full adversarial + fail-closed test sweep (FR-28, F8) | Extend `tests/ef-review-workflow.test.mjs` (or a sibling directly under `tests/`) with adversarial fixture classes driven through `status`, `sign`, and `validate` so every verb/path fails closed identically: (i) transposed-character `subjectContentHash`, (ii) out-of-order review-act sequence, (iii) `supersedes`-based correction, and — **enumerated per F8** — (iv) malformed YAML, (v) roster resolution failure, (vi) signature tampering, and (vii) append-only git-history failure (with `--history` active). Each of (iv)–(vii) is a NAMED negative fixture asserting `status` emits `derivedState: "invalid"` + non-zero exit wherever `validate` rejects (FR-28). Also drive the frozen `scaffold --draft`→`sign --draft`→`validate` command flow end-to-end (F9) through the real CLI. | 7/7 adversarial/fail-closed classes produce the expected non-zero fail-closed result on `status`, `sign`, and `validate`; the four F8 classes each yield `status`'s `invalid` state; zero fixture causes a silent pass. target_surfaces: `tests/ef-review-workflow.test.mjs`, `tests/fixtures/clinical-review-workflow/`. | 1.0 | general-purpose | sonnet | adaptive | Phases 2, 3, 4 complete |
| P5-T2 | CLI/render smoke + `npm run check` wiring + determinism/zero-dep gates (FR-20/21/22, R-P4, F10) | **R-P4 smoke task** — this repo has no `*.tsx`; the render target surface is the static HTML `render` emits (`build/review-render/index.html` via `tools/review-record/lib/verbs/render.mjs`). Extend `tests/ef-review-render-smoke.test.mjs` to spawn the real `cli.mjs render` entry point over P3-T1's queue-section output and assert the `NEXT`/`TERMINAL` markers appear in the emitted HTML. **F10**: `npm test` is `node --test tests/*.test.mjs tests/witness/*.test.mjs` — two flat, NON-recursive globs; every new test file this feature adds MUST live directly under `tests/` or `tests/witness/` (no new nested test subdirectory), and this task does NOT change `package.json`'s `scripts.test`. Add a guard test that asserts each new test file's path matches one of those two globs (so a file that would silently never run in `npm test` fails the suite instead). Add determinism tests: `status --json` bytes are stable across two invocations on unchanged input (no wall-clock bytes); `sign`'s non-signature output fields are stable across invocations. Extend the existing zero-new-deps and zero-network grep tests to cover every new `lib/*.mjs` file this plan adds. | Smoke test asserts `NEXT`/`TERMINAL` marker text in the real rendered HTML; a discovery-guard test confirms every new test file matches `tests/*.test.mjs` or `tests/witness/*.test.mjs` (F10) and `scripts.test` is unchanged; `status --json` byte-diff across two invocations on unchanged input is empty; `sign`'s non-signature fields are byte-stable across invocations; the zero-new-deps grep test is green with no `package.json` dependency additions. target_surfaces: `tests/ef-review-render-smoke.test.mjs`, `tests/ef-review-record-cli.test.mjs`, `package.json`. | 1.0 | general-purpose | sonnet | adaptive | P5-T1 |
| P5-T3 | `docs/architecture.md` §11 + README update (FR-18/19) | Update `docs/architecture.md` §11 ("Review workflow, Evidence Foundry E1") to document the new verbs (`status`, `sign`), the derived-state model, the runbook link, and the honesty boundary. Update `tools/review-record/README.md` naming both new verbs, the incremental `validate` path, the derived-state library, and linking the runbook and the portal-promotion framework. | Docs-truth test asserts `docs/architecture.md` §11 names both `status` and `sign`, links `docs/governance/reviewer-runbook.md`, and restates the honesty boundary; `tools/review-record/README.md` names both verbs, the incremental path, and links the runbook + `friction-observations.md`. target_surfaces: `docs/architecture.md`, `tools/review-record/README.md`. | 0.5 | documentation-writer | haiku | adaptive | P3-T3, P4-T3 |
| P5-T4 (DOC-006) | Deferred-items design-spec stubs | Per the Deferred Items Triage Table above: (a) confirm `docs/project_plans/design-specs/clinical-review-portal-workflow.md` (already updated by P4-T3) as DF-CRW-01's spec path; (b) author `docs/project_plans/design-specs/real-reviewer-onboarding-g1.md` (`maturity: shaping`, `prd_ref` set to this feature's PRD, cross-referencing `docs/governance/gates-registry.md` G1 and the runbook's post-G1 track) for DF-CRW-02; (c) author `docs/project_plans/design-specs/df-e1-04-retrospective-validation-linkage.md` (`maturity: shaping`) for DF-CRW-03, cross-referencing ADR-0004's `unblocks` field. Append all three paths to this plan's `deferred_items_spec_refs` frontmatter. | Three spec paths exist (1 confirmed existing + 2 newly authored), each with correct `maturity`/`prd_ref`; `deferred_items_spec_refs` has 3 entries. target_surfaces: `docs/project_plans/design-specs/`. | 0.5 | documentation-writer | sonnet | adaptive | P4-T3 |
| P5-GATE1 | `task-completion-validator` gate | Verify Phase 5 exit gate; `npm run check` green; deferred-items table fully covered. | All exit-gate criteria pass; recorded in phase progress note. | — | task-completion-validator | sonnet | adaptive | P5-T1..T4 |
| P5-GATE2 | `karen` feature-end review | Independently re-check against the actual full-feature diff (not the plan's description): every Hard Guardrail above holds byte-for-byte; all 29 PRD FRs (incl. FR-25..29 from Revision 1) have a passing test or docs-truth check; the FR-26 adjudication policy change is confirmed on both agree/disagree paths without ADR-0004 `status` mutation; the three deferred-item design-specs exist with correct maturity; `npm run check` green end-to-end. | karen sign-off recorded; feature may not be marked `status: completed` without it. | — | karen | sonnet | adaptive | P5-GATE1 |
| P5-GATE3 | codex `gpt-5.6-terra` read-only second-opinion diff review | Full-feature read-only diff review across all five phases — final fail-closed-gap sweep before the feature guide/PR wrap-up. | Review recorded; any flagged gap becomes a task before the PR opens. | — | codex (read-only) | gpt-5.6-terra | high | P5-GATE2 |

---

## Open Questions — Resolutions (OQ-1..OQ-8)

Binding for phase executors; do not reopen without a new decisions-block entry. OQ-1..6 are the
decisions block's; OQ-7/8 were surfaced by the PRD's authoring pass and are carried through here.

| OQ | Resolution | Landed in |
|----|------------|-----------|
| OQ-1 | `sign`'s key source is TESTKEY-only, ephemeral in memory; no `--keyfile` seam ships. `sign` operates on a staged draft (FR-25), never an existing `reviews/` record (F1). | P2-T1 |
| OQ-2 | `status --json` shape frozen: `{ moduleId, subjectContentHash, records[], derivedState, nextExpectedRole, blockers[] }`; `derivedState` includes `acts-complete-unauthorized` (F4) and `invalid` (F8), never a `release-ready`-like label; sibling identity/decision redacted by default (F7). Full shape in P1-T2. | P1-T2 |
| OQ-3 | Runbook lives at `docs/governance/reviewer-runbook.md`; linked from README + architecture §11. | P3-T3, P5-T3 |
| OQ-4 | Friction-metric log is a committed markdown file at `.claude/worknotes/clinical-review-workflow/friction-observations.md`; zero network/telemetry restated in the framework text itself. | P4-T1 |
| OQ-5 | `changelog_required` left unset (internal tooling) — see the pointer note under Executive Summary. | Plan frontmatter |
| OQ-6 | `validate --history` is a fail-closed union with the incremental cache: `--history` results are never cached across invocations. | P2-T4 |
| OQ-7 | Runbook carries two labeled tracks (exercise / post-G1 real reviewer); `sign` visible only on the exercise track. | P3-T3 |
| OQ-8 | Portal-promotion framework ships (metric format, threshold-as-proposal, owner-role, decision-record template); this plan does not commit to building a portal. | P4-T1..T3 |

---

## Risk Mitigation (carried from decisions block §3, expanded)

| ID | Risk | Sev | Mitigation | Landed in |
|----|------|-----|------------|-----------|
| R1 | `sign` creates a path to real signatures pre-G1/G2 | High | Schema keeps forcing `signature: null` on `synthetic: false`; explicit refusal; negative tests are ACs; no keyfile path anywhere; `verify-d4-built.mjs` untouched | P2-T2 |
| R2 | `status` drifts from `validate`'s derived-state logic | High | ONE structured `computeDerivedReviewState` result `{state, nextExpectedRole, eligibility, blockers[]}` (F6); both verbs derive from it; matrix + drift test | P1-T1, P1-T4 |
| R3 | Ergonomic changes weaken reviewer-2 structural independence | High | `nextChainLink` untouched; independence fixture stays green; explicit AC on every scaffold change | P1-T3, P1-T4 |
| R4 | Runbook/docs language implies clinical validity or real sign-off | Med | Mandatory honesty pass; one-hop boundary statement on every user-visible surface | P3-T4 |
| R5 | Validate caching introduces stale-pass (fail-open) | Med | Composite key {record, predecessor-set, roster, schema, validator-policy version, history-mode}; any single-component miss/uncertainty recomputes; persistent non-repo cache; 5 fresh-process invalidation tests (F3) | P2-T4 |
| R6 | Portal mockups read as a commitment | Low | CONCEPT-ONLY watermark on every asset; design spec stays `maturity: shaping`; no portal code | P4-T2, P4-T3, P4-GATE2 |
| R7 | Plan tasks accidentally "accept" ADR-0004 or add roster entries | High | Explicit non-goal in every phase; no task edits ADR `status` or real roster entries; grep checks | P1-T4, all gates |
| R8 | `subjectContentHash` auto-derivation drifts from `dry-run`'s convention | Med | Both callers use `computeModuleContentHash` verbatim; equality test | P1-T3, P1-T4 |
| R9 | Incremental validate skips a check that only ran module-wide before | Med | Explicit per-record vs. module-wide split; module-wide checks always run on any change | P2-T3, P2-T4 |
| R10 | `sign` opens/rewrites an existing committed record, breaking append-only | High | Staged-draft lifecycle (FR-25/F1): `sign` reads only a draft outside `reviews/`, writes once via `writeNewReviewRecordFile`; test asserts no existing record path's bytes/mtime change | P2-T1, P2-T2 |
| R11 | A derived-state label reads as release authorization pre-gate | High | `acts-complete-unauthorized` naming (FR-29/F4); no `release-ready`-like label; naming grep + real-roster-fixture negative test | P1-T1, P1-T2 |
| R12 | `status`/render leaks a sibling reviewer's vote, defeating independence | High | Redaction-by-default (FR-27/F7); `--unredacted` for adjudicator/release-auth only, with warning banner; sentinel-content tests | P1-T2, P3-T1 |
| R13 | `status` reports a next-role/terminal disposition over an invalid record set | High | `status` fail-closed `invalid` state (FR-28/F8) for every class `validate` rejects; named negative fixtures (P5-T1) | P1-T2, P5-T1 |

---

## Wave Plan Summary

Waves (from frontmatter `wave_plan`, computed by the standard two-pass algorithm):

```
Wave 1: [P1]
Wave 2: [P2, P4]   — both depend only on P1; no file-write overlap
Wave 3: [P3]       — depends only on P1, but shares tools/review-record/lib/verbs/validate.mjs
                      with P2, so is pushed one wave later by the barrier-intersection check
Wave 4: [P5]        — depends on P2, P3, P4
```

## Quality Gates & Git Protocol

- **Every phase requires `npm run check` green before its `task-completion-validator` gate** —
  `npm test && npm run validate && npm run coverage:rules && npm run build && npm run verify:d4 &&
  npm run check:imports && npm run smoke:browser && npm run smoke` (verbatim from `package.json`
  `scripts.check`, per root `CLAUDE.md`).
- **Git workflow**: worktree → commit-per-phase → PR to the parent branch, per
  `agentic_meta_dev/.claude/skills/dev-execution/git-worktree-pr-protocol.md`. Branch off `main`;
  one commit per sealed phase; PR opened after Phase 5's `karen` gate and feature guide are
  committed (Wrap-Up below); push before any deploy step (none applies to this feature — no
  runtime deployment surface).
- Commit messages end with the `Co-Authored-By` trailer per project convention.

## Wrap-Up: Feature Guide & PR

Triggered automatically after Phase 5 seals (all gates pass, including `karen` feature-end).
Delegate to `documentation-writer` (haiku) to create
`.claude/worknotes/clinical-review-workflow/feature-guide.md` (What Was Built / Architecture
Overview / How to Test / Test Coverage Summary / Known Limitations, ≤200 lines), commit it, then
open the PR per the standard template (`gh pr create`) with the Summary bullets drawn from this
plan's Executive Summary — no CHANGELOG entry per the OQ-5 decision recorded above.

---

## Revision History

- **Revision 1 (2026-07-22): applied 10 adversarial-review findings.** P2-T1/T2 respecified onto the
  staged-draft `sign` lifecycle (FR-25, F1); new **P1-T5** encodes the FR-26 conditional-adjudication
  policy into `lib/adjudication.mjs`/`derived-state.mjs` as a governance-sensitive change with an
  agree/disagree fixture pair and a policy-note callout (F2, ADR-0004 stays `proposed`); P2-T3/T4
  widened to a persistent composite-keyed fail-closed cache with 5 fresh-process invalidation tests
  (F3); the terminal state renamed `acts-complete-unauthorized` in P1-T1/T2 (F4); P1-T3 gained the
  `--subject`↔content-hash comparison + `--allow-historical-subject` (F5); P1-T1/T4 grounded on one
  structured `computeDerivedReviewState` result (F6); P1-T2/P3-T1 added independence-preserving
  redaction (F7); P1-T2 + P5-T1 added the `status` `invalid` fail-closed contract with named negative
  fixtures (F8); frozen CLI signatures threaded through P1-T2/T3 and P2-T1/T3 (F9); P5-T2 constrained
  new tests to the non-recursive `tests/*.test.mjs` / `tests/witness/*.test.mjs` globs with a
  discovery-guard test (F10). Phase point totals unchanged (P1=5 rebalanced across five tasks; total
  19 pts).

---

**Progress Tracking**: `.claude/progress/clinical-review-workflow/` (created at execution start).

**Implementation Plan Version**: 1.1
**Last Updated**: 2026-07-22
