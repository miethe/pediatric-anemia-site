---
schema_name: ccdash_document
schema_version: 2
doc_type: human_brief
title: "Human Brief: Wave-0 Safety & Defensibility Foundation"
status: draft
audience: [humans]
feature_slug: wave0-safety-foundation
category: human-briefs
created: 2026-07-19
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
intent_ref: null
epic_ref: null
owner: nick
priority: critical
---

# Human Brief: Wave-0 Safety & Defensibility Foundation

## 1. Context Pointers

- **PRD**: `docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md` — goals, WP1–WP7 requirements, D-1..D-5 binding constraints, scope, ACs
- **Implementation Plan**: `docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md` — EP-0..EP-7 phase breakdown, wave plan, EP↔WP mapping, risk summary
- **Phase files**: `wave0-safety-foundation-v1/phase-{0-derisk-and-align, 1-tristate-fact-model, 2-units-and-ranges, 3-4-evidence-and-governance, 5-manifest-and-diff, 6-validation-corpus, 7-review-contract-and-docs}.md` — full task tables (EP0-T1…EP7-T7), quality gates
- **Decisions Block**: `.claude/worknotes/wave0-safety-foundation/decisions-block.md` — phase boundaries, risk hotspots, estimation anchors, model routing
- **SPIKE-003** (tri-state fact model migration): `docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md`
- **SPIKE-004** (UCUM unit handling & mismatch rejection): `docs/project_plans/SPIKEs/spike-004-ucum-unit-handling-mismatch-rejection.md`
- **SPIKE-005** (semantic diff classification): `docs/project_plans/SPIKEs/spike-005-semantic-diff-classification.md`
- **SPIKE-006** (KB signing key custody & browser-side verification): `docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md`
- **SPIKE charter index** (routing summary, not findings): `.claude/worknotes/wave0-safety-foundation/spike-charter-summary.md`
- **5 feeding design specs** (Phase 0 deferred items this phase promotes): `docs/project_plans/design-specs/{evidence-dual-source-unification, tri-state-fact-model, exact-passage-evidence-schema, signed-kb-manifest, module-manifest-json-schema}.md`
- **ARC clinical council handoff**: `docs/project_plans/expansion/03-arc-clinical-council-handoff.md`
- **`rf` handoff results**: `docs/project_plans/expansion/rf-handoff/RESULTS.md`
- **AOS asset inventory**: `.claude/worknotes/wave0-safety-foundation/aos-asset-inventory.md`

## 2. Estimation Sanity Check

**Plan total**: 68 pts, bottom-up, verified at the task level: **54 individual task estimates across 8 phases sum to exactly 68.0** — no rounding, no top-down compression detected.

### Bundle Decomposition (H4) — per-phase floor

| Phase | Pts | Tasks | H3 flag |
|---|---:|---:|---|
| EP-0 De-risk & align | 9 | 9 | — |
| EP-1 Tri-state fact model | 13 | 9 | **fires** (migration/inference across 56 fields, 9 aggregates, 33 rules) |
| EP-2 Units & range registry | 8 | 7 | — |
| EP-3 Evidence provenance | 10 | 6 | **fires** (`rf`-bundle→KB-pack converter = "transform") |
| EP-4 Rule governance | 5 | 4 | — |
| EP-5 Manifest & semantic diff | 10 | 7 | **fires** (`kb-diff.mjs` = "diff"/"classify") |
| EP-6 Adversarial validation corpus | 9 | 5 | — |
| EP-7 Review contract & docs | 4 | 7 | — |
| **Σ** | **68** | **54** | |

Recomputing each phase's own task table independently (not trusting the plan's stated phase-total line) reproduces the same 9/13/8/10/5/10/9/4 split exactly — verified phase-by-phase from the 8 phase files.

### H1 — Noun-counting (loosely applied to schema-governed shapes, not CRUD tables)

Six new/materially-reshaped schema surfaces: `triState` $def (EP-1), `reference-range.schema.json` (EP-2), `evidence.schema.json` (EP-3), `rule.schema.json` governance extension (EP-4), `kb-manifest.schema.json` (EP-5), `review-record.schema.json` (EP-7). At H1's ~2 pt/noun floor: 12 pt floor. The phases that own these schemas sum to 50 pts — comfortably above the floor, which is expected: each schema also carries a migration/codemod/test burden the bare floor doesn't price in.

### H2 — Dual-implementation multiplier

**Does not apply.** Single runtime, no local/enterprise split (confirmed explicitly in the decisions block).

### H3 — Algorithmic service flag

Fires on exactly the three places the task brief called out, and each clears the ≥3 pt standalone floor at the **task** level, not just the phase level:
- **EP-1** (migration semantics): EP1-T3 (migration-table design) alone is 2.5 pts; EP1-T4+T5 (applying it) add another 4.5 pts.
- **EP-3** (converter transform): EP3-T2 (`rf`-bundle→KB-pack converter) is 3.0 pts standalone.
- **EP-5** (semantic diff): EP5-T3 (`kb-diff.mjs` classifier) is 3.0 pts standalone.

All three were also SPIKE'd first (SPIKE-003/-005 respectively; the converter inherits SPIKE-003's migration-table output) — satisfying H3's "SPIKE first if you can't enumerate ≥5 scenarios" bar.

### H5 — Anchor reference (correction required)

**The decisions block's own anchor citation is factually wrong, and the plan never corrected it.** The decisions block states: *"P0 (Platform foundation refactor) was L with 7 WPs delivered across 7 phases... A ~1.7× multiple over P0 is the basis for 68. If P0's actual was materially different from ~40, re-anchor during expansion and justify."*

P0's actual, per its own closed-out implementation plan (`docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md`, `status: completed`, `effort_estimate: "17 pts"`) and its own human brief's bottom-up Estimation Sanity Check ("Total Estimate: 17 points, bottom-up, no compression"), was **17 pts — not ~40**. That is a 2.35× error in the assumed baseline the decisions block's 1.7× multiplier was built on. Applying 1.7× to the *correct* anchor gives ~29 pts, not 68. The decisions block's own stated contingency ("if materially different, re-anchor and justify") was triggered and never actioned anywhere in the PRD or plan.

This does **not** mean 68 is wrong — it means the *reasoning given for it* is wrong, and the real justification has to rest on scope, not arithmetic. P0 was a zero-behavior-change extraction (3 shim layers, 0 new schemas, 0 semantic changes, 2 new test files); this plan is the opposite in kind — 4 SPIKEs, 6 new/extended schemas, a from-scratch adversarial test corpus the decisions block itself calls "first-of-kind in this repo — no prior art to copy" (EP-6), a semantic migration across 56 fact fields/9 aggregates/33 rules carrying an explicit differential-clearing safety invariant, and content backfill across 91 rules/6 evidence sources. A ~4× multiple over the *corrected* 17-pt anchor is defensible on that basis — P0's own brief accepted a 17× blowout over *its* anchor (a 1-pt commit) on identical grounds ("qualitatively different work, not just more of the same edit"). But it needs to be argued on scope, not asserted via a wrong number.

**Action**: correct the decisions block's H5 anchor citation (17 pts, not ~40) before this plan is treated as fully reconciled; the correction changes the *narrative*, not the *total*.

### H6 — Hidden plumbing budget

Dedicated resilience/plumbing tasks (R-P2 "consumer handles absence" ACs, R-P3 seam tasks, R-P4 runtime smoke, EP-0's CI hardening: EP1-T7/T8, EP2-T5/T6/T7, EP3-T6, EP4-T4, EP5-T6/T7, EP0-T9) sum to **~6.0 pts, ≈8.8% of the 68-pt total** — below H6's 15–20% guidance. Combined with the plan's own H4 note ("treat 68 as the floor, not the target — phases 1, 3, 5, 6 are the ones that historically inflate"), this reads as the plan being light on plumbing margin, not padded. Treat 68 as a credible floor with realistic risk skewed toward overrun.

### Verdict

**Bottom-up total = 68 pts, in exact agreement with the stated total.** H1–H4 all check out cleanly at the task level; nothing here disagrees with 68, so there is nothing to override. The one real defect found is **H5's anchor narrative** (wrong assumed P0 actual: ~40 cited vs. 17 real), which needs correcting in prose but does not change the number. H6's thin margin (8.8% vs. 15–20% norm) is the one signal that 68 should be read as a floor rather than a target.

## 3. Wave & Orchestration Notes

**Critical path**: EP-0 → EP-1 → EP-3 → EP-4 → EP-5 → EP-6 (EP-2 rejoins before EP-3, on the same convergence gate as EP-1; EP-7 floats).

**Parallel opportunities**:
- **EP-1 ∥ EP-2** — disjoint file ownership (`ruleEngine.js`/`facts.anemia.js`/`patient-input.schema.json` vs. `units.js`/`ranges/registry.js`/`reference-range.schema.json`), with exactly one shared seam line: `modules/anemia/ranges.js:42` (`menstruating === true`). `integration_owner = EP-1`'s executor — EP-1-T7 owns and writes the seam verification; EP-2-T5 is consumer-side only and must not edit that line. Both phases converge on one safety `council-review` gate before EP-3 starts.
- **EP-0's `rf` runs (RF-EV-002, REG-002) ∥ everything** — launched in EP-0 (EP0-T8) with zero code dependency; RF-EV-002 (CALIPER/Bohn 2023 pediatric CBC intervals) enriches EP-2's partition shape (non-blocking — AAP-fallback ranges already exist), REG-002 (content-rights/licensing) gates EP-3's verbatim-quote-vs-paraphrase posture. Neither run blocks any code phase from starting.
- **EP-7 ∥ everything** — formally depends only on EP-0 (the review-record contract has no code dependency and can start immediately); scheduled to *seal* last because its doc-truth-up half needs EP-6's shipped state to describe accurately.

**Strictly serial**: EP-3 → EP-4 → EP-5 → EP-6 — each phase consumes the prior's minted output artifact (EP-4's `sourcePassageId` references passage IDs EP-3 mints; EP-5 hashes/attests to EP-3+EP-4's output; EP-6 proves the corpus against a manifest-verified KB, so running it earlier would leave the fail-closed paths untested).

**Cross-feature coupling**: `arc-clinical-council-adoption-v1.md` P4-T1 converts the same `DM-CBC-001..DM-WORKFLOW-010` families into synthetic scenario specs. **This plan owns the executable-fixture conversion** (EP6-T4) because EP-6 is where the fixtures must actually run against the real engine; the ARC Adoption plan's P4-T1 consumes EP-6's fixtures rather than re-deriving them. Both plans record the edge in `related_documents`.

## 4. Open Questions Ledger

| ID | Question | Status | Resolution |
|---|---|---|---|
| OQ-1 | Does `booleanMap`'s open shape survive as `triState`, or do the 56 fields become an enumerated allow-list? | **Resolved** | Enumerate per-module via the module package (adopted in FR-WP1-01) |
| OQ-2 | Does the `rf`-bundle → KB-pack converter live in this repo or `research-foundry`? | **Resolved** | Build it here; registers as satisfying `EF-WP0` (adopted in FR-WP3-03) |
| OQ-3 | Real cryptographic KB signing, or hash + manifest chain with signing deferred? | **Open** — pending SPIKE-006 execution (EP-0-T5) | Charter leans toward hash+chain (Branch A, expected); formal decision lands in EP-0 |
| OQ-4 | Mutation-score baseline — value, and measured over rules, facts, or both? | **Open** — by design, deferred to measurement | Defined empirically in EP6-T3 from a real run, not guessed in advance |
| OQ-5 | Missing-unit policy — reject, or accept with `unitAssumed` flag? | **Open** — pending SPIKE-004 execution (EP-0-T2) | Must not silently convert either way |
| OQ-6 | Should CI hardening move earlier than WP6? | **Resolved** | Moved to EP-0 (EP0-T9); EP-0 gains ~1 pt, EP-6 loses ~1 pt, plan total unchanged at 68 |

## 5. Deferred Items Rationale

Carried forward from Phase 0 (`platform-foundation-p0`), not new to this plan — each gets a DOC-006 spec-refresh task in EP-7 (EP7-T3) rather than being silently dropped:

- **DEF-6 — public `moduleId` API surface**: still deferred because no second module registers in this phase; nothing consumes it yet. Promote at Phase 2 CBC-suite kickoff.
- **DEF-7 — algorithm-explainer/examples relocation**: still deferred as a UI/static-asset concern, not KB/safety content; no work package in this phase touches it. Promote when a second module's examples would collide.
- **DEF-8 — headless-browser runtime smoke check**: still deferred because EP-1/EP-2 reuse the Phase-0 shim/registry strategy that made this acceptable. Promote if EP-1/EP-2 substantively edit `src/app.js`/`algorithmExplorer.js` beyond today's shim boundary — EP7-T3 must confirm this held before closing the item out again.

## 6. Risk Narrative

The two that would actually hurt a patient if missed:

**Silent clinical behavior change from the tri-state migration (EP-1).** 56 boolean fact fields, 9 `countTrue()` aggregates, and 33 of 91 rules all change meaning in the same migration. "2 of 5 present" and "2 present, 3 not-assessed" are clinically different statements today's boolean collapse cannot distinguish — a careless migration doesn't just add noise, it can let `not-assessed` satisfy a rule-out branch and clear a differential that should have stayed open. The mitigation chain is real but has to hold end-to-end: SPIKE-003 decides aggregate semantics *before* any code moves, a written 33-rule migration table precedes the codemod, D-3's enumerate-and-rationalize gate has to catch *every* golden diff (not just the ones someone thought to check), a dedicated invariant test asserts no rule-out branch is satisfiable by `not-assessed`, and a safety `council-review` gate sits before merge. Any one weak link — an unrationalized diff, an aggregate re-expression nobody re-derived carefully — reopens the exact gap this phase exists to close.

**A semantic diff that under-reports a safety-relevant change (EP-5).** This is a false-negative risk with direct clinical consequence: a threshold buried in a nested `all`/`any` tree that moves from 20 to 30 ng/mL, classified "cosmetic" by `kb-diff.mjs`, ships without re-review. The diff tool becomes the thing that *certifies* a change is safe — its blind spots become the platform's blind spots for every future release. SPIKE-005 (`fable`, the hardest reasoning task in the phase) is tasked explicitly with hunting the under-reporting mode before EP-5 implements against its design, and a cross-family (`gpt-5.6-sol`) adversarial pass is tasked with "find a safety-relevant change this classifier misses" — but the seeded-mutation corpus this depends on is only as good as SPIKE-005's enumeration. If the taxonomy misses a change class, EP-5's classifier inherits that blind spot silently.

**The other six, in brief**: evidence dual-source drift defeating manifest integrity if DEF-1 isn't genuinely resolved before EP-3 (not just before EP-5); overclaiming clinical approval by treating ARC's synthetic, non-qualifying review as a credentialed sign-off (D-4 — the single most important honesty constraint in the phase, and the reason EP4-T3 is a structural test, not documentation); duplicated dangerous-miss conversion work against the ARC Adoption plan if the cross-plan edge isn't honored in practice, not just on paper; an atomic, all-or-nothing 91-rule schema migration under `additionalProperties: false` with no incremental path; the first external build-time dependency in a zero-dependency repo (EP-2 units, EP-6 property/mutation) tempting a silent default instead of a recorded rationale; and a stale IntentTree tracker that could cause an executor to redo already-merged work or re-launch already-completed `rf` runs if EP0-T8's resync isn't trusted as the actual starting state.

## 7. What to Watch For

- **Golden diffs that nobody can explain.** D-3's gate only works if every diff across all 6 examples is individually classified and rationalized. A diff that gets waved through with "looks fine" instead of a written clinical rationale is the gate silently failing while appearing to pass.
- **A mutation score set low enough to be decorative.** OQ-4 is deliberately deferred to a real measurement in EP-6, not guessed in advance — that's correct. But a baseline defined *after* seeing how low the real number lands, and rationalized down to match, defeats the point as surely as guessing one in advance would.
- **`clinicalApprovers[]` quietly acquiring a value.** This field must ship `[]` on all 91 rules in every build this phase produces (D-4, EP4-T3's structural test). Watch specifically for it being populated from ARC council output, from a well-meaning "the reviewer role matches" shortcut, or from any source that isn't a real, named, credentialed human attestation.
- **Scope creep into new or retuned thresholds (D-1).** This phase's only permitted clinical-behavior change is the narrow, individually-reviewed exception where tri-state exposes a genuine latent missingness bug (AC-D3). Any edit that changes a clinical threshold's *value* — as opposed to its provenance metadata — is out of scope regardless of how well-intentioned, and belongs to a future phase, not a "while we're in here" fix.

## 8. Expected Success Behaviors

Human-verifiable, no clinical-performance claims:

- [ ] Submitting a patient input with a field marked `not-assessed` never causes a rule-out/differential-clearing branch to fire for that field, across all 91 rules — verifiable by running the dedicated invariant test and by hand-checking a few examples in the browser SPA.
- [ ] Submitting a lab value in the wrong unit (e.g., ferritin in the wrong unit string) is rejected with a visible error, both via the API and in the browser SPA — never silently converted.
- [ ] `scripts/validate-kb.mjs` reports 91/91 rules with a resolvable exact-passage evidence record or an explicit `implementation-proposal` flag — no rule stands on an unlabeled claim.
- [ ] The server refuses to start or serve when the KB manifest is missing, invalid, expired, or incompatible — visible as a startup failure or an explicit "no assessment produced" response, never a stale or partial result.
- [ ] Re-running `scripts/sign-kb.mjs` against unchanged KB content reproduces the identical `clinicalContentHash` on a second clean run.
- [ ] `npm run check` is green at every phase boundary, including the 4 new suites (`property`, `boundary`, `mutation`, `dangerous-miss`) and CI now gating on pull-request events, not only `main` push.
- [ ] Inspecting any rule or the manifest in a build this phase produces shows `clinicalApprovers[]`/`approvedBy[]` as empty arrays — never populated — and the closeout record honestly states the clinical-sign-off half of the V1 gate as `not_executed_owner_held`, not implied closed.
- [ ] All 3 carried-forward deferred items (DEF-6, DEF-7, DEF-8) have a current design-spec path, and the CHANGELOG has an `[Unreleased]` entry describing the tri-state input shape and fail-closed unit rejection in plain terms.

## 9. Running Log

*(Append-only during execution; entries added as phases complete.)*
