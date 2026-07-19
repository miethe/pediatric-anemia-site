---
type: context
schema_version: 2
doc_type: context
prd: "wave0-safety-foundation"
title: "Context: wave0-safety-foundation"
status: pending
created: 2026-07-19
feature_slug: wave0-safety-foundation
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
---

# Context: Wave-0 Safety & Defensibility Foundation

## Pointer Index

- **PRD**: `docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md` — Feature Brief, Goals, WP1-WP7 Requirements, D-1..D-5, Scope, ACs
- **Implementation Plan**: `docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md` — EP-0..EP-7 phase breakdown, wave plan, EP<->WP mapping
- **Phase files**: `docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-{0-derisk-and-align, 1-tristate-fact-model, 2-units-and-ranges, 3-4-evidence-and-governance, 5-manifest-and-diff, 6-validation-corpus, 7-review-contract-and-docs}.md`
- **Decisions Block**: `.claude/worknotes/wave0-safety-foundation/decisions-block.md` — Phase boundaries, agent routing, risk hotspots, estimation anchors, model routing
- **SPIKE charter index**: `.claude/worknotes/wave0-safety-foundation/spike-charter-summary.md`
- **SPIKEs**: `docs/project_plans/SPIKEs/spike-00{3,4,5,6}-*.md` (tri-state migration, UCUM units, semantic diff, KB signing)
- **AOS asset inventory**: `.claude/worknotes/wave0-safety-foundation/aos-asset-inventory.md` — what `rf`/ARC/IntentTree deliver today, verified against this program
- **Human Brief**: `docs/project_plans/human-briefs/wave0-safety-foundation.md` — estimation sanity check, risk narrative, orchestration notes
- **Hard Guardrails**: `CLAUDE.md` — no generative model in clinical decision path, no invented thresholds, no AI-published rule changes, no PHI

## Binding Arbitrations (D-1..D-5 and OQ Resolutions)

From the decisions block / PRD §6/§14, these are FINAL and do not reopen without explicit human direction:

- **D-1**: No new clinical claims. Only provenance metadata + honest missingness representation change. The one permitted exception (a rule whose behavior changes because tri-state exposed a latent missingness bug) requires individual review + approval under AC-D3 — never bulk auto-application.
- **D-2**: Evidence must be single-source before signing. DEF-1 resolution (EP0-T6) is an EP-0 prerequisite, not an EP-5 cleanup.
- **D-3**: Golden-output equivalence is a review gate, not a pass/fail gate. Every diff across all 6 golden examples is enumerated, classified (`expected-from-tri-state`/`unexpected`), and rationalized. A diff clearing a differential on `not-assessed` is an automatic no-go regardless of rationale offered.
- **D-4**: ARC output may never populate `clinicalApprovers[]`/`approvedBy[]`. Fields are structurally ready, ship empty, release state recorded `not_executed_owner_held`. This is the single most important honesty constraint in the phase — enforced by a dedicated structural test (EP4-T3), not documentation.
- **D-5**: Zero-runtime-dependency default. `package.json`'s `dependencies`/`devDependencies` stay absent unless exactly one is added with a written rationale recorded in the plan — never silently. EP-2 (units) and EP-6 (property/mutation) are the two places this must be actively decided.
- **OQ-1**: `booleanMap` becomes a per-module enumerated allow-list (56 known fields), not a global open shape. Resolved, adopted in FR-WP1-01.
- **OQ-2**: The `rf`-bundle -> KB-pack converter lives in this repo, registers as satisfying `EF-WP0`. Resolved, adopted in FR-WP3-03.
- **OQ-3**: Real cryptographic signing vs. hash+manifest-chain — SPIKE-006 decides (EP0-T5). Open until SPIKE-006 executes; charter leans toward hash+chain (Branch A).
- **OQ-4**: Mutation-score baseline — defined empirically in EP6-T3 from a real measurement run, not guessed in advance. Open by design until that measurement happens.
- **OQ-5**: Missing-unit policy — reject vs. `unitAssumed` flag. SPIKE-004 decides (EP0-T2). Must not silently convert either way.
- **OQ-6**: CI hardening moved from EP-6 to EP-0 (EP0-T9) — the gate must exist before the risky EP-1/EP-2/EP-5 migrations land, not after. Resolved; EP-0 gains ~1 pt, EP-6 loses ~1 pt, plan total unchanged (68).

## Hard Rules

**Enforced at every task prompt, reviewer gate, and phase exit:**

1. **No new or retuned clinical thresholds** — every rule/candidate/evidence value is migrated for provenance/governance metadata, never edited in clinical meaning, except D-1's individually-reviewed exception path. Any edit that changes a threshold's *value* (not its provenance) is out of scope, full stop.
2. **`not-assessed` can never satisfy a rule-out/differential-clearing branch** — the core safety invariant of EP-1, structurally tested (EP1-T6), not merely asserted.
3. **`clinicalApprovers[]`/`approvedBy[]` ship empty in every build this phase produces** — D-4, structurally tested (EP4-T3, reinforced by EP5-T1/T7), never populated from ARC council output or any non-owner-attested source.
4. **Integration ownership at the EP-1/EP-2 seam** — `modules/anemia/ranges.js:42` (`menstruating === true`) is owned by EP-1. EP-2 verifies only (EP2-T5); it never edits that line.
5. **Strict serial edge EP-3 -> EP-4 -> EP-5 -> EP-6** — each phase consumes the prior's minted output artifact (passage IDs, governance-wired rules, manifest-verified KB). Do not attempt to parallelize across this chain.
6. **Fail-closed, not fail-open** — unit mismatch (EP-2), unverifiable/expired/incompatible KB manifest (EP-5): the failure state is "no assessment produced," never stale or partial output, and never a silent conversion.
7. **`npm run check` green at every phase boundary** — test + validate + build + check:imports + smoke. This is the standing exit condition for every phase from EP-1 onward.
8. **Cross-plan fixture ownership** — this plan (EP6-T4) owns converting ARC's 10 `DM-CBC-001..DM-WORKFLOW-010` families into executable fixtures; `arc-clinical-council-adoption-v1.md`'s P4-T1 consumes them, never re-derives them.
9. **Do not trust IntentTree node status until EP0-T8 resyncs it** — the tracker is independently confirmed stale relative to real repo/`rf` state (verified this session via a live `itt tree graph` pull) as of this plan's authoring.
10. **H5 anchor correction (estimation)** — the decisions block cites P0's actual cost as "~40 pts" when P0's own closed-out plan/brief record 17 pts actual. This is a documentation defect in the decisions block, not a scope change; the corrected anchor comparison (68 vs. 17, ~4x, scope-justified) is recorded in the human brief §2 and should be reflected back into the decisions block if it is ever revised.
