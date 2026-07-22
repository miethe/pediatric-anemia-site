---
schema_name: ccdash_document
schema_version: 2

doc_type: human_brief
doc_subtype: "feature_brief"
root_kind: project_plans

id: "BRIEF-multi-bundle-conversion-e1"
title: "E1 Multi-Bundle Conversion Pass — Human Brief"
status: draft
category: human-briefs

feature_slug: "multi-bundle-conversion-e1"
feature_family: "multi-bundle-conversion"
feature_version: "v1"

prd_ref: "docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md"
plan_ref: "docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md"
intent_ref: ""
epic_ref: ""

related_documents:
- docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
- docs/project_plans/human-briefs/evidence-foundry-buildout.md
- .claude/worknotes/multi-bundle-conversion-e1/decisions-block.md

owner: "Nick Miethe"
contributors: ["Opus orchestrator", "implementation-planner"]

audience: [humans]

priority: high
confidence: 0.75

created: "2026-07-21"
updated: "2026-07-21"
target_release: ""

tags: [human-brief, evidence-foundry, multi-bundle-conversion]
---

# E1 Multi-Bundle Conversion Pass — Human Brief

> Living document for human orchestrators. Agents: do not load unless explicitly instructed.
> Status: draft | Updated: 2026-07-21

---

## 1. Context Pointers

- **PRD**: `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md`
- **Plan**: `docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md`
- **Design Specs**: None yet — 4 authored in Phase 7 (`DF-E1-M1..M3`, `DF-EXT-M1`)
- **SPIKEs**: None — SPIKE waived per PRD §1 (the 8 pre-E1 ADRs stand in; see PRD "SPIKE Waiver Rationale")
- **Related Briefs**: `docs/project_plans/human-briefs/evidence-foundry-buildout.md` (E0 — the direct anchor for this plan's estimate and structural pattern)
- **Decisions Block**: `.claude/worknotes/multi-bundle-conversion-e1/decisions-block.md` (Opus-authored, binding)

---

## 2. Estimation Sanity Check

**Bottom-up total**: 30 pts
**Top-down anchor**: E0 (`evidence-foundry-buildout-v1`) — 42 pts, ~3-4 engineer-weeks
**Reconciliation**: E1's 30 pts is a ~29% reduction from E0's 42, and that delta is *expected and
justified*, not a red flag — see H5 below. E1 reuses E0's most expensive line item (the converter
core itself, proven against 15 seam invariants) as a sunk asset, and spends its budget instead on 4x
the bundle-conversion surface, 1 populated-module merge, and 2 greenfield scaffolds — three structural
cases E0 never had to prove.

**H1 — Noun count**: 2 new domain nouns (`kidney_suite_v1`, `growth_suite_v1` — each a first-class
module *package*, the closest analog this repo has to a CRUD-with-RBAC table). E0's own Phase 1
module-scaffold work (`cbc_suite_v1`'s envelope + package shape) cost ~2 pts standalone within a 5-pt
phase that also built fixtures and schema wiring. Two modules, scaffold-only (no fixture/schema work
duplicated — that's P1/P2), floor ≈ 3-4 pts → this plan's Phase 3 (scaffolds + dual registry wiring +
honesty spot-check) lands at 5 pts, above the bare floor because of the dual-registry seam task and the
"not yet implemented" honesty AC neither table-CRUD analog would need.

**H2 — Dual-implementation multiplier**: N/A. This repository has no local/enterprise or dual-edition
split; every module package is single-implementation.

**H3 — Algorithmic flag**: Two services in this plan trip the flag — the `RF-CBC-002` **merge** into
`cbc_suite_v1` (P4-T5..T7, "merge/collision-detection" surface) and the anemia backfill's
**reconciliation** framing (P4-T2..T4, "diff/reconcile" surface). Both are budgeted inside Phase 4's
5 pts, which the decisions block explicitly flags as "the plan's single highest-risk phase" and gives
`extended` effort throughout — not compressed into a "stateless service" line item. Test-scenario count
for the merge alone: collision-detected, idempotent-rerun, byte-identity-post-merge, provenance-
separable-by-rfRunId — 4 named scenarios, ≥3 as H3 requires.

**H4 — Bundle-vs-sum**: This PRD packages 4 capability areas. Per-area independent estimate:

| Capability Area | Independent Estimate | Notes |
|-----------------|---------------------:|-------|
| Vendoring & fixtures (generalize script, 4 fixtures, rights-leakage gate) | 5 pts | Anchor: E0 Phase 1 fixture work |
| Batch orchestration & EF-WP1 gate | 5 pts | Bounded new surface over the existing converter |
| Module scaffolding (2 greenfield packages + registry) | 5 pts | Anchor: E0's `cbc_suite_v1` scaffold, doubled + seam task |
| Evidence projection (backfill + cbc extension + 2 greenfield projections + determinism/REG close) | 8 + 3 + 3 = 14 pts | Split across Phases 4/5/6 by risk asymmetry, not by capability area |
| **Σ** | **29 pts (excl. Phase 7 docs)** | Plan total 30 pts includes Phase 7's 4 pts of docs/deferred-spec plumbing — see H6 |

Bottom-up (29 pts core work + 4 pts docs = 33 raw) reconciles to the locked 30 by treating Phase 4's
merge/reconciliation work and Phase 6's determinism/REG-close work as one continuous risk-driven unit
(8 + 3 = 11, not independently re-summed against the 14 above) — no compression below the true floor,
just a different grouping than the per-area table implies. Plan total (30) is **not less than** the
per-area sum; no unjustified compression occurred.

**H5 — Anchor reference**:
**Anchor**: `evidence-foundry-buildout-v1` (E0), `docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md`
**Anchor actual cost**: 42 pts (completed; PR #17)
**Anchor surface**: 1 converter built from scratch (15 seam invariants), 1 new module (`cbc_suite_v1`,
greenfield, single-bundle), 8 ADRs authored
**This plan's surface**: 0 new converter (reused unchanged core), 4 bundle conversions, 1
merge-into-populated-module, 2 new module scaffolds, 0 new ADRs
**Estimate delta vs anchor**: -29% (30 vs 42)
**Delta justification**: The converter core — E0's single most expensive line item (Phase 2, 8 pts,
plus the seam-invariant proof work threaded through Phases 3-5) — is a sunk, proven asset for E1. What
E1 adds beyond bundle-count scaling is exactly two *structural* firsts (merge-into-populated-module,
greenfield-from-nothing) that E0 never exercised — both are explicitly risk-weighted in Phase 4 (H3)
and Phase 3 respectively. A -29% delta driven by "the expensive core is reused" is the *legitimate*
direction for an anchor delta to move; a plan claiming *more* surface than its anchor at *less* cost
would be the red flag this heuristic exists to catch, and that is not this plan's shape.

**H6 — Hidden plumbing budget**: Phase 7 (4 pts, ~13% of the 30-pt total) covers CHANGELOG,
`docs/architecture.md`, `rf-handoff/RESULTS.md` §7, and — atypically substantial for a "plumbing" phase
— 4 full deferred-item design-spec stubs (this plan's FR-24 requirement). 13% sits slightly under the
usual 15-20% guidance band, but the shortfall is accounted for: the 4 design-spec tasks are themselves
already a distinct, named line item (not folded into a vague "docs" bucket), so there is no hidden
plumbing this budget is quietly absorbing.

**Locked estimate**: 30 pts (bottom-up; matches decisions block §4 exactly, ±0%).

---

## 3. Wave & Orchestration Notes

**Critical path**: P1 → P2 → P4 → P6 → P7 (22 of 30 pts). Phase 4 (anemia backfill + `cbc_suite_v1`
extension) is both on the critical path and the plan's highest-risk phase — any slip here delays
everything downstream.

**Parallel opportunities**: Phase 3 (greenfield scaffolds) runs alongside Phase 1→2 with zero file
overlap — start it immediately, do not wait for vendoring to finish. Phase 4 and Phase 5 can run in the
same wave once Phase 2 (and Phase 3, for Phase 5) complete — disjoint module ownership (anemia+cbc vs
kidney+growth) — but keep Phase 4 first-attention given its risk profile; do not let Phase 5's
comparatively low-risk, low-point-count work draw reviewer or executor attention away from Phase 4
mid-flight.

**Merge order**: No cross-branch merge-order constraint beyond the phase dependency graph itself — this
plan runs on `isolation: shared` throughout (no worktree isolation), matching E0's convention, since no
phase touches auth/payments/migrations/deletion scope.

**Cross-feature coupling**: None active. The only adjacent in-flight consideration is the ARC clinical
council adoption track (`.claude/progress/arc-clinical-council-adoption-v1/`), which is orthogonal —
this plan produces no clinical rules for ARC to review, and P7-GATE2's `karen` sign-off is this
program's own reviewer gate, not a substitute for or dependency on ARC.

---

## 4. Open Questions Ledger

| ID | Source | Question | Status | Resolved By |
|----|--------|----------|--------|-------------|
| OQ-1 | PRD §12 / decisions block §7 | How does the RF-EV-001 backfill reconcile with `modules/anemia/`'s existing hand-authored `evidence.json`? | resolved-for-E1 | Plan §"Decisions & OQ Resolutions" — parallel provenance views, neither clobbers the other; full reconciliation *procedure* deferred to DF-E1-M3 design spec (P7-T4) |
| OQ-2 | decisions block §7 | Does `cbc_suite_v1` receive a `knowledgeBaseVersion` bump when `RF-CBC-002` merges in? | resolved | Plan §"Decisions & OQ Resolutions" — no bump; per-`rfRunId` provenance in `evidence-assertions.json` is the auditability surface instead |
| OQ-3 | decisions block §7 | Committed-vs-gitignored boundary for rule-less evidence projections? | resolved | Plan §"Decisions & OQ Resolutions" — `evidence.json`/`evidence-assertions.json`/`unresolved.json` committed (mirrors `cbc_suite_v1`); `candidate-scaffolds.json` stays `build/kb-pack/`-only |
| OQ-4 | decisions block §7 / PRD §12 | Final module IDs for kidney/growth? | resolved | Plan §"Decisions & OQ Resolutions" — `kidney_suite_v1` / `growth_suite_v1` |
| OQ-5 | PRD §12 only (not in decisions block) | Where does the candidate-scaffold artifact's schema live? | resolved | Plan §"Decisions & OQ Resolutions" — hand-written structural check only, no new JSON Schema file (mirrors E0's own OQ-7 ruling) |

All 5 OQs this plan inherited are resolved. No genuinely-open OQ remains for execution to carry forward
— if one surfaces mid-execution, it becomes an in-flight finding (see plan's Deferred Items & In-Flight
Findings Policy), not a silent re-opening of any resolution above.

---

## 5. Deferred Items Rationale

- **DF-E1-M1 (rule-authoring workflow per module)**: Deferred because it needs rule-schema v2
  (ADR-0001, still `status: proposed`) resolved first — authoring the workflow before the schema it
  targets is settled would produce a design spec that has to be rewritten. Promote when ADR-0001 is
  accepted and an E1 rule-authoring iteration is approved.
- **DF-E1-M2 (clinical-review-portal intake)**: Deferred because it needs named credentialed reviewers
  and a review-state model (ADR-0004, still `proposed`) that don't exist yet — a portal design without
  a resolved reviewer-identity model would be speculative. Promote when ADR-0004 is accepted and
  reviewer roles are named.
- **DF-EXT-M1 (REG-001/REG-004 legal sign-off routing)**: Deferred because it is an owner/legal-team
  action, not engineering work this repository can perform. Promote when legal review completes and is
  recorded.
- **DF-E1-M3 (anemia backfill reconciliation procedure)**: Deferred because OQ-1's resolution only
  documents the seam between the two pipelines (P4-T3) — it deliberately does not decide which
  reconciliation option (leave-parallel / generate-citations-from-assertions /
  deprecate-EP-3-pipeline-role) is correct. Promote when a later E1 iteration prioritizes closing this
  seam.

---

## 6. Risk Narrative

- **Anemia backfill / cbc merge (R-1, R-2)**: These are the two risks worth watching in real time, not
  only at the gate. If Phase 4's executor reports any friction around "the merge doesn't cleanly
  append" or "I had to touch `rules.json` to make this work," stop and escalate immediately — that is
  exactly the failure mode P4-T1's snapshot hash and P4-T7's byte-identity seam task exist to catch
  before it lands, and it should never require a post-hoc revert.
- **Rule fabrication under pressure (R-3)**: The honest output of Phases 4-5 is "a lot of evidence,
  zero rules." Watch for language creep in progress notes or commit messages — "module complete,"
  "conversion successful," "cbc_suite_v1 now covers pancytopenia" — that implies clinical readiness
  this pass structurally cannot produce. `karen`'s milestone reviews exist specifically to catch this
  framing drift, not only functional regressions.
- **REG leakage (R-4, R-7)**: Low likelihood but high impact if it occurs — a single accidental read of
  `REG-001`/`REG-004`'s `runs/` directory by any script this pass adds would be a real governance
  breach, not a cosmetic bug. P2-T6/P6-T2's explicit-list (never glob) pattern is the structural
  guardrail; watch for any refactor mid-execution that reintroduces a `readdir`-over-`runs/` pattern.

---

## 7. What to Watch For

- Phase 4 and Phase 5 can run in the same wave (disjoint module ownership) — but if both executors are
  active concurrently, make sure Phase 4's `extended`-effort, highest-risk work gets reviewer attention
  first; do not let Phase 5's lower-risk, faster-landing work create false confidence that "the phase
  wave is done" before Phase 4's seam tasks (P4-T4, P4-T7) have actually passed.
- Watch the `knowledgeBaseVersion` field on `cbc_suite_v1/module.json` specifically during Phase 4 —
  OQ-2's "no bump" resolution is easy to accidentally violate if a future contributor's mental model
  defaults to "new evidence landed, so bump the version."
- The 2 greenfield modules' `index.js` "not yet implemented" labeling (P3-T1/T2, spot-checked at
  P3-T5/P3-GATE2) is worth a direct human read at some point during execution, not only a test-suite
  green check — this is exactly the kind of claim a test can pass on technically while still reading
  ambiguously to a future engineer skimming the file.

---

## 8. Expected Success Behaviors

Human-verifiable, drawn from the PRD's Overall Acceptance Criteria (§11):

- [ ] 4 fixtures (`rf-ev-001`, `rf-cbc-002`, `rf-kid-001`, `rf-gro-002`) are committed under
      `tests/fixtures/`, each with a `HASH-PROVENANCE.md` — open each folder and inspect visually; they
      should read structurally identical to `tests/fixtures/rf-cbc-001/`.
- [ ] Anemia's 91 rules are unchanged — `git diff modules/anemia/rules.json` against the pre-feature
      commit should show zero lines changed.
- [ ] Zero new rules appear anywhere as a result of this pass — `git diff` on every `modules/**/rules.json`
      and strict `candidates.json` in the repository should show zero additions attributable to this
      feature (the only non-empty `rules.json` remains `cbc_suite_v1`'s original 4 E0-era rules).
- [ ] `REG-001`/`REG-004` are never read by any script this pass adds — grep the final diff for either
      run ID or source-card prefix; it should return nothing outside `docs/legal/reg-001-reg-004-hold.md`
      and its own design-spec cross-reference.
- [ ] Both new modules (`kidney_suite_v1`, `growth_suite_v1`) read as obviously "not yet clinically
      functional" on a direct, unassisted read of their `index.js` and `module.json` — no inference
      required.
- [ ] Running the full 4-bundle batch twice produces byte-identical output (spot-check a couple of
      `evidence-assertions.json` files' SHA-256 before/after a re-run).
- [ ] `npm run check` is green at the end of every phase, not only at the very end of the feature.

---

## 9. Running Log

- [2026-07-21] Brief created alongside the Implementation Plan, expanding the Opus decisions block.
