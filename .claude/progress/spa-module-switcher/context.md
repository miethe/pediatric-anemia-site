---
type: context
schema_version: 2
doc_type: context
title: "Context: spa-module-switcher"
status: active
created: '2026-07-22'
feature_slug: spa-module-switcher
prd: spa-module-switcher
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
updated: '2026-07-22'
---

# Context: SPA Module Switcher

## Pointer Index

- **PRD** (FR-1..FR-36, AC-1..AC-10, R-1..R-8, OQ-1..OQ-4): `docs/project_plans/PRDs/features/spa-module-switcher-v1.md`
- **Implementation Plan** (parent, >800 lines → 3 phase-detail files): `docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md`
  - **Phase 0-2** (Governance, Truth Sources & Seams): `docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-0-2-foundation.md`
  - **Phase 3-5** (Selector UI, Fail-Closed Refusal & Degradation): `docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-3-5-ui.md`
  - **Phase 6-7** (Gates, Test Harness & Docs): `docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-6-7-gates-docs.md`
- **SPIKE-008**: `docs/project_plans/SPIKEs/spike-008-spa-module-switcher.md` — legs SQ-1 (module
  eligibility), SQ-2 (banner truth source), SQ-3 (failure surface, F1–F12), SQ-4 (prior-art
  reconciliation) — the evidence base every task cites; worknotes at
  `.claude/worknotes/spa-module-switcher/spike-leg-sq{1,2,3,4}-*.md`.
- **Decisions Block** (authoritative; D-1..D-5 settled, not reopened): `.claude/worknotes/spa-module-switcher/decisions-block.md`
- **ADR-0009** (authored in Phase 0, `status: proposed`): `docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md`
- **Design spec reconciled in Phase 0** (server-side, stays deferred): `docs/project_plans/design-specs/public-moduleid-api-surface.md`
- **Related PRD** (source of the FR-14/R-8 prohibition this feature lifts): `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md`
- **Findings doc** (lazy-created at P7-DOC-007): `.claude/findings/spa-module-switcher-findings.md`
- **Hard Guardrails**: `CLAUDE.md` — no generative model in the clinical decision path, no invented
  thresholds, no AI-published rule changes, no PHI in the public microsite, no autonomous
  diagnosis/treatment/dosing.

## Progress Tracking Index

One progress file per phase under `.claude/progress/spa-module-switcher/`:

| File | Phase | Title |
|---|---|---|
| `phase-0-progress.md` | P0 | Governance & Paperwork Prerequisites |
| `phase-1-progress.md` | P1 | Manifest Surface + Status Vocabulary |
| `phase-2-progress.md` | P2 | Generic KB Loading + Engine Seam + Eligibility Predicate |
| `phase-3-progress.md` | P3 | Selector UI + Status Banner + `?module=` URL State |
| `phase-4-progress.md` | P4 | Fail-Closed Refusal State + Capability Gating |
| `phase-5-progress.md` | P5 | Module-Scoped Tab Degradation, Nav Counts & Page Copy |
| `phase-6-progress.md` | P6 | Gates & Test Harness (Verification Phase) |
| `phase-7-progress.md` | P7 | Documentation Finalization |

## Phase Dependency Graph & Critical Path

```
P0 ─┐
    ├─→ P2 ─→ P3 ─→ P4 ─┬─→ P6 ─→ P7 ─→ FEATURE-KAREN
P1 ─┘               │    │
                     └────┴─→ P5 ─┘  (P5 hangs off P2 and P4; merges before P6)
```

- **Critical path**: `P0 → P1 → P2 → P3 → P4 → P6 → P7` = 3 + (absorbed) + 5 + 6 + 5 + 5 + 3 =
  **27 of 34 pts** (P0's 3 pts absorbed by P1's concurrent 3 pts in wave 1, but P0 remains a hard
  predecessor of P2).
- **P5 hangs off P2 (loading seam) and P4 (settled state machine)**, and merges before P6 opens —
  it carries 4 pts of scheduling float against the P4→P6 critical path (not concurrent execution;
  P3/P4/P5 share `src/app.js`/`index.html` serialization barriers, so P5 runs in its own wave after
  P4, never in parallel with P3/P4 despite being dependency-legal in isolation).
- **Wave plan**: `[[P0, P1], [P2], [P3], [P4], [P5], [P6], [P7]]`.

## Reviewer Gate Schedule (Tier 3)

| Gate ID | Where | Reviewer | Trigger |
|---|---|---|---|
| `P0-GATE` .. `P7-GATE` | every phase exit | `task-completion-validator` | Phase exit gate criteria met and recorded in the phase progress note |
| `P2-KAREN` | end of P2 | `karen` | **Milestone 1** — the seams (literal specifiers, `assessModule`, eligibility predicate) are the load-bearing foundation of every later phase |
| `P4-KAREN` | end of P4 | `karen` | **Milestone 2** — the fail-closed refusal state is the safety-critical slice; verifies no path reaches `assess()` for an ineligible module and no refusal reuses `showInputRejection` |
| `P6-KAREN` | end of P6 | `karen` | **Milestone 3** — verification phase; verifies the smoke gate was extended, not rewritten, and that the `DEFAULT_MODULE_ID` tripwire was flipped deliberately |
| `FEATURE-KAREN` | end of P7 | `karen` | **End of feature** — verifies no artifact in the delivered feature is described as validated, verified, reviewed, approved or released |

`task-completion-validator` gates are per-phase exit criteria (`P0-GATE`..`P7-GATE`). `karen` runs
at 4 named milestones only (P2, P4, P6, and feature-end at P7) — not at every phase.

## Integration Ownership & Seam Tasks (rule R-P3)

- **P3 and P4 both write `src/app.js` and `index.html`** — two owner specialties (UI engineering
  and fail-closed state logic) over an overlapping `files_affected` set.
- **`integration_owner: phase-owner`** is declared on **both P3 and P4** (the decisions block named
  `frontend-developer`; not registered in this project — see the agent-name substitution note
  below).
- **Seam task: `P4-06`** — selecting an ineligible module must swap the banner **and** clear
  results atomically; no observable interleaving where the previous module's result is visible
  beneath the new module's banner, and no tick where the audit JSON stays downloadable after the
  banner has changed. Lives in `phase-4-progress.md` (the phase that owns the refusal state), but
  is jointly a P3/P4 concern per the `integration_owner` declaration on both phases.
- **P5 also writes `src/app.js`/`index.html`** but runs in its own wave after P4 (serialization
  barrier), so it needs no second integration owner — it inherits a settled state machine.
- **P2-03** is also a named seam task (the join point between Phase 1's manifest surface and Phase
  2's own engine seam), owned jointly by the frontend and registry/seam engineer roles — but does
  **not** carry a top-level `integration_owner` declaration (Phase 2 has a single implementer
  track, not two competing specialties over the same files).

## Binding Arbitrations (OQ Resolutions)

From the parent implementation plan's "Decisions & OQ Resolutions" section — **FINAL, do not
reopen without a new decisions-block entry**:

- **OQ-1 — Selector form factor.** Resolved: **persistent sidebar rail** (mockup variant A). An
  interstitial one-time gate (variant C) leaves no in-session reminder of which module is active.
  Both mockups render CBC Suite as *selectable*; that is **superseded by D-1/FR-4** — CBC Suite is
  `unsigned-stub` and ships inert.
- **OQ-2 — `#evidence` tab.** Resolved: **degrade** (FR-26). `src/evidence/registry.js:39-50` holds
  loaders for `anemia` and `cbc_suite_v1` only. A per-module evidence view is Deferred Item
  **DF-SMS-02**.
- **OQ-3 — `#rules` empty-state copy.** Resolved: the string lands in
  `src/moduleStatusVocabulary.js` (P1-02) and is pinned by P6-004: `This module contains no rules.
  No assessment can be produced from it.` Never "not yet loaded" (implies a loading failure), never
  "not yet available" (implies a pipeline toward release that `gates-registry.md:130-132` makes
  schema-impossible).
- **OQ-4 — ADR-0009 ratification.** Resolved: **`status: proposed` suffices to merge**, matching
  ADR-0004/0005/0006. No G0–G4 gate blocks shipping the switcher — it flips no status, signs
  nothing, touches no reviewer roster.

## Hard Rules

**Enforced at every task prompt, reviewer gate, and phase exit:**

1. **No module status change, nothing signed** (FR-35, D-5 non-goal). This feature changes zero
   `module.json.status` values and invokes no signing script. Verified once at `P0-04` (baseline
   capture) and re-verified at `FEATURE-KAREN` against the full feature diff.
2. **Eligibility is a single `READY_STATUS` comparison, decided before any `assess()` call** (D-1,
   D-4, FR-4, FR-6). Never a hardcoded `'integrity-recorded'` literal in the UI layer; never
   inferred by catching an engine throw.
3. **`assessPediatricAnemia` (`src/engine.js:98-100`) stays exported with its exact signature and
   call shape** (R-3). `scripts/smoke-browser-unit-rejection.mjs` greps `src/app.js` source text
   for it at multiple line anchors — **extend the smoke script, never rewrite it** (binding on the
   whole of Phase 6).
4. **All `MODULE_KB_LOADERS` fetch specifiers are literal, never template-built** (FR-36, R-4) — a
   template literal defeats both `?v=` cache-busting and per-file import verification, serving
   stale KB JSON.
5. **No green/success/approved visual state anywhere** (D-3, FR-11, FR-31, FR-32). `integrity-recorded`
   carries the *same* severity treatment as the `unsigned-stub` scaffolds. Zero hash, "integrity
   verified", "content unmodified", approval badge, or "verified"/"approved"/"released" wording in
   any clinician-facing surface.
6. **No maturity-ladder vocabulary** ("preview", "beta", "coming soon", "temporarily unavailable")
   anywhere in refusal or status copy — `gates-registry.md:130-132` makes
   `unsigned-stub → release-ready` schema-impossible, so any such word is a false implication.
7. **Refusal is a distinct third state, never a reuse of `showInputRejection`** (FR-14, D-4). The
   dangerous current failure mode — `UnitRejectionError` rendering "Check the entered units" for an
   unimplemented module — must be structurally unreachable through the eligibility gate, with the
   refusal state built anyway as defence in depth.
8. **No generalization of `src/algorithmExplorer.js`** (R-8, explicit non-goal). Phase 5 degrades
   the `#algorithm` tab only; any change to `anemiaWalkthrough` or the `facts.*` accessors is held
   as Deferred Item **DF-SMS-03**.
9. **No `localStorage`/`sessionStorage`/cookie persistence of the selected module** (FR-24, D-5). A
   stale persisted module id silently switching modules on next visit is a fail-closed hazard.
10. **Provider must be pinned `claude` explicitly on every task in Phase 0 and Phase 7** — `task_class:
    documentation` otherwise resolves to free-tier Haiku regardless of the requested model
    (decisions block §6 routing finding), even though both phases require architectural/governance
    judgment, not mechanical edits.

## Agent-Name Substitutions (footnote 1, preserve verbatim — do not "fix")

The decisions block names `documentation-writer`, `frontend-developer`, `backend-architect`,
`ui-engineer-enhanced` and `ui-designer` as specialist roles. **None of these agents is registered
in this project.** Per the house convention already used in `multi-bundle-conversion-e1`, every
implementer role is dispatched as **`general-purpose`** with the role descriptor retained (in task
descriptions and Quick Reference blocks) purely for routing intent — it is not a real agent name.
Phase orchestration is **`phase-owner`**, and every `integration_owner` field in this feature's
progress files reads **`phase-owner`** (the decisions block said `frontend-developer`). Reviewer
gates use the two genuinely registered reviewer agents: **`task-completion-validator`** and
**`karen`**. Do not invent or substitute phantom specialist agent names when executing this plan's
tasks — this substitution is deliberate, documented, and load-bearing for correct dispatch.

## Model, Provider & Profile Assignment

- **Model**: `sonnet` for P0–P6; `haiku` for P7 (mechanical doc edits — but see Hard Rule #10).
- **Effort**: `adaptive` by default; **`extended`** on P4 (fail-closed logic is the safety-critical
  slice) and P6 (gate surgery on a source-grepping smoke test).
- **Provider**: `claude` for **all 34 pts** — no external-model tasks. The design mockups
  (`docs/dev/designs/mockups/spa-module-switcher/`) were generated out-of-band via Codex's native
  image tool (`gpt-5.6-terra`, operator override) and are **non-binding** (PRD §14) — no phase
  re-generates them.
- **Effort vocabulary is claude-only here**: `adaptive` | `extended` — story points never appear in
  the Effort column (that is what `estimated_effort` carries instead).

## Deferred Items (feed DOC-006 in Phase 7)

| Item ID | Category | Target Spec Path |
|---|---|---|
| DF-SMS-01 | prereq | `docs/project_plans/design-specs/sign-kb-per-module-content-hashing.md` |
| DF-SMS-02 | design | `docs/project_plans/design-specs/per-module-evidence-view.md` |
| DF-SMS-03 | design | `docs/project_plans/design-specs/algorithm-explorer-module-generalization.md` |
| DF-SMS-04 | policy | `docs/project_plans/design-specs/public-moduleid-api-surface.md` (update existing) |
| DF-SMS-05 | tech-debt | Finding, not a spec — `.claude/findings/spa-module-switcher-findings.md` |

`DF-SMS-01` and `DF-SMS-05` are **already known findings**, recorded regardless of any
execution-time discovery, at `DOC-007`.

## Wrap-Up (after `FEATURE-KAREN` passes)

Delegate to a documentation writer (`general-purpose`, sonnet) to create
`.claude/worknotes/spa-module-switcher/feature-guide.md` (standard template, ≤200 lines). Its
**Known Limitations** section must state plainly that one module is selectable, three are inert,
and the browser verifies nothing. Commit it before opening the PR; the PR title should name the
honesty outcome, not just the control.
