---
title: "Phase 1 SPIKE Charter Summary — Wave-0 Safety Foundation"
doc_type: worknote
created: 2026-07-19
scope: "Index of SPIKE-003..006 charters authored for Phase 1. Not the findings — charters only."
---

# Phase 1 SPIKE Charter Summary

Four charters authored in `docs/project_plans/SPIKEs/` (status: `draft`), matching spike-001/002
house style. None have been executed — this table is a routing index, not a findings summary.

| SPIKE | Title | Blocks which WP | Complexity | Timebox | Recommendation |
|---|---|---|---|---|---|
| SPIKE-003 | Tri-State Fact Model Migration | P1-WP1 (direct, hard); P1-WP6 (hard, roadmap `:228`) | L | 6h | **Reduce, do not merge into DEF-2.** DEF-2 already settles the type shape (`Tri` enum, `src/facts/tristate.js`) and rule-engine contract direction; it explicitly does not do the field/rule audit, `countTrue` re-expression, or golden-fixture proof. That audit is the hard, safety-relevant part and is genuinely absent from DEF-2 — run the SPIKE, then use its output to promote DEF-2 from `shaping` to committed. |
| SPIKE-004 | UCUM Unit Handling and Mismatch Rejection | P1-WP2 (direct, hard) | L | 5h | **Run as scoped.** No existing design spec covers units at all (greenfield) — the dependency-vs-hand-roll decision (repo has zero runtime dependencies today) and the reject-boundary placement are real one-way-door decisions that need a dedicated pass before WP2 coding starts. |
| SPIKE-005 | Semantic Diff Classification for KB Changes | P1-WP5 (direct, hard — `kb-diff.mjs` named explicitly; also an explicit V2 go criterion) | XL | 8h | **Run as scoped — hardest of the four.** No design spec owns this problem; DEF-4/DEF-5 are downstream consumers, not prior art. Central risk is false-negative under-reporting (a safety-relevant change misclassified as cosmetic); the charter requires a behavioral dangerous-miss backstop independent of the structural classifier as a non-negotiable minimum deliverable. |
| SPIKE-006 | KB Signing Key Custody and Browser-Side Verification | P1-WP5 (direct, hard — manifest/signing half; also an explicit V2 no-go criterion) | M | 4h | **Run, and expect it to recommend deferring cryptographic signing.** DEF-4 literally names this SPIKE's questions as its own central open question, so this is not new scope, it's DEF-4's blocking dependency. Given the project is an unvalidated research prototype, single-maintainer, statically deployed to GitHub Pages, a full signature apparatus defends a weaker threat model than it appears to (author-holds-key ≠ proof of independent review). The charter's RQ6 forces an explicit go/no-go and leans toward: ship `clinicalContentHash` + the `supersedes` manifest chain now (auditable, tamper-evident-in-git-history), defer real cryptographic signing until a second reviewer/contributor exists or a real validation gate is passed. |

## Cross-SPIKE coupling worth flagging

- **SPIKE-003 ↔ SPIKE-005 ↔ SPIKE-006** all touch `modules/anemia/rules.json`/`module.json` — if
  sequenced, SPIKE-003's rule migration should land (or at least have its migration table final)
  before SPIKE-005's diff-classifier is validated against real "before/after" rule pairs, since a
  tri-state migration is itself the kind of large, structural rules.json change the classifier needs
  to handle correctly.
- **SPIKE-006's RQ3 (hashing scope) has a hard dependency on DEF-1** (evidence dual-source
  unification): hashing `modules/anemia/evidence.json` while `src/evidence.js` remains a
  hand-synced, independently-editable mirror defeats the hash's integrity guarantee. SPIKE-006's
  charter flags this explicitly rather than assuming DEF-1 is already resolved.
- **SPIKE-004 is the most independent** of the four — no dependency on or from the other three,
  can run fully in parallel (matches roadmap `:228`, "P1-WP2 are the long poles and can
  parallelize").

## Full charter paths

- `docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md`
- `docs/project_plans/SPIKEs/spike-004-ucum-unit-handling-mismatch-rejection.md`
- `docs/project_plans/SPIKEs/spike-005-semantic-diff-classification.md`
- `docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md`
