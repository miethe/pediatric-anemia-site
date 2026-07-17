---
doc_type: estimation_sanity_check
feature_slug: platform-foundation-p0
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
created: 2026-07-17
---

# Estimation Sanity Check — platform-foundation-p0

Applies `.claude/skills/planning/references/estimation-heuristics.md` H1–H6 (+H7) bottom-up against
the 17-pt total locked in the decisions block (`.claude/worknotes/platform-foundation-p0/decisions-block.md`
§4). This file is the full H1–H6 worksheet; the implementation plan carries only a one-line pointer to
this file, per the planning task's separation requirement.

## H1 — Noun-Counting Rule

**N/A — no new CRUD-with-RBAC domain nouns.** This is a structural/architectural refactor (extracting
a module-package boundary out of existing anemia-specific code), not a feature that introduces new
database tables or CRUD-backed API resources. `modules/<id>/module.json` is a static manifest file, not
a table; `src/modules/registry.js`'s `MODULE_IDS` is a literal array, not a persisted entity. H1's floor
does not apply — 0 pts from this heuristic.

## H2 — Dual-Implementation Multiplier

**N/A — not applied.** Single runtime, no local/enterprise or SQLite/Postgres split in this codebase.
Confirmed in decisions block §4: "No dual-implementation multiplier (H2): single runtime, no enterprise
variant."

## H3 — Algorithmic Service Flag

**Flagged, budgeted defensively, not newly built.** `ruleEngine.js`'s candidate `merge`/`rank` logic
(`mergeCandidate()`, `LEVEL_RANK`/`ALERT_RANK`) is the one genuinely algorithmic surface in this
codebase — but it is explicitly **out of scope and unchanged** in P0 (confirmed module-agnostic by
schema inspection, SPIKE-001 RQ3). P3 ("Engine generalization") sits immediately adjacent to that
logic — extracting `assess()`'s orchestration and the `summarize`/`limitations` hooks around the merge
without touching the merge itself — and is priced at 3 pts (the H3 floor for a flagged surface) as a
defensive allocation against the drift risk of working next to algorithmic code, not because new
algorithmic logic is being authored. Decisions block confirms: "P3 ... riskiest single diff." No
separate H3 line item beyond P3's existing 3 pts.

## H4 — Bundle-vs-Sum Check

The PRD bundles 6 functional requirements (FR-1…FR-6) plus a mandatory verification/closeout phase —
≥3 capability areas, so a per-area independent estimate is required:

| Capability Area | Independent Estimate | Notes |
|---|---:|---|
| FR-1 — Harness + module package contract | 3 pts | Golden-fixture capture, `git mv` relocation, mechanical literal-path swap across 6 consumers (see plan §Sequencing note 1) |
| FR-2 — Fact-derivation registry | 3 pts | Densest source file (`facts.js`, 365 lines); explicit-Map registry + shim |
| FR-3 — Engine generalization | 3 pts | Adjacent to algorithmic merge/rank logic (H3); hook extraction is the highest-drift-risk diff |
| FR-4 — Reference-range registry | 2 pts | Self-contained; two related primitives (band table + threshold rule) |
| FR-5 — Multi-module scripts/server + load test | 3 pts | Four executable surfaces + two new test files; registry-file merge with P3's output (see plan §Sequencing note 2) |
| FR-6 — Module manifest stub | 1 pt | Small manifest + one drift check |
| P7 — Verification, docs & closeout | 2 pts | Full gate re-run, docs, 8 DOC-006 deferred-item specs, app-surface smoke check |
| **Σ** | **17 pts** | |

Plan total (17 pts) = Σ exactly — no top-down compression applied. This matches the decisions block's
own bottom-up total; the phase table is not back-solved to fit a rounded package price.

## H5 — Anchor Reference Comparison

**Anchor**: commit `240e314` ("Stamp built asset URLs with a content hash to prevent stale-cache
mismatches") — the only prior **structural/plumbing**-class commit in this repo's history (every other
recent commit is feature-additive: algorithm explorer, stage-grid paging, privacy banner). Per decisions
block §4, its actual cost was ~1 pt across 2 files (`scripts/build-static.mjs` + one consumer).

**Anchor surface**: 1 mechanical technique (regex-based content-hash stamping) applied across 2 files,
no new abstraction layer, no new package boundary, no permanent regression harness.

**This plan's surface**: ~20 files touched across 7 phases; introduces 3 new abstraction layers
(`src/facts/registry.js`, `src/ranges/registry.js`, `src/modules/registry.js`), 1 new package convention
(`modules/<id>/`), 4 shim files, 1 permanent golden-fixture regression harness (`tests/golden/*.json` +
`tests/module-equivalence.test.mjs`), and 1 new structural test (`tests/module-registry.test.mjs`).

**Estimate delta vs. anchor**: ~17× the anchor's point cost for ~10× the file footprint — delta is
large (>>30%) but directionally justified, not linear-scaling noise: the anchor was one repeated
mechanical edit; this plan designs and builds three new abstraction layers plus a standing regression
net, which is qualitatively different work, not just "more of the same edit." No closer analog exists in
this repo's history (first true package-boundary refactor).

**Delta justification**: accept the divergence — H5's ±30% check is best applied to same-class work
(anchor is not same-class: it's a single mechanical technique, this plan is a multi-layer architectural
extraction). Flag for the karen milestone review at P4 to sanity-check independently rather than treat
the delta as self-evidently fine.

## H6 — Hidden Plumbing Budget

Decisions block §4 already states plumbing is embedded rather than broken out as a separate line:
"H6 hidden plumbing (~15%) is embedded in P1 (harness) and P5 (test wiring) rather than a separate line
item." Quantified: P1's `scripts/capture-golden.mjs` + fixture-harness scaffolding is ~1 pt of P1's 3-pt
budget; P5's two new test loops (`smoke-test.mjs` internal-consistency loop + `tests/module-registry.
test.mjs` scaffolding) is ~0.75 pt of P5's 3-pt budget. Combined ≈ 1.75 pts / 17 ≈ **10.3%** — slightly
under the 15–20% guidance band. This is a minor under-budget flag, not a blocking one: the decisions
block made this call explicitly (Opus-approved anchor reasoning per phase), and P1/P5's own anchors
already account for harness/test-wiring cost inside their 3-pt figures rather than omitting it. Noted
for the karen P4 milestone review to confirm P5's remaining budget after P1/P3 land is still adequate.

## H7 — Huge-File Touch Multiplier

`wc -l` on every file in scope (`src/facts.js` 365, `src/engine.js` 78, `src/referenceRanges.js` 106,
`src/ruleEngine.js` 159 [unchanged], `src/evidence.js` 110, `src/app.js` 632, `src/algorithmExplorer.js`
631, `server.mjs` 132, `scripts/validate-kb.mjs` 35, `scripts/build-static.mjs` 93, `scripts/smoke-test.
mjs` 69, `data/rules.json` 3022, `data/candidates.json` 344, `data/evidence.json` 100, `data/
reference-ranges.json` 79). **No source file exceeds 2K lines.** `data/rules.json` (3022 lines) is the
only file >2K lines in scope, but it is touched by a pure `git mv` relocation (P1) with an enforced
**empty content diff** — no line-level editing, no grep/sed navigation, no repeated-read churn — so
H7's rationale (context blows from repeated navigation of a giant file) does not apply. **H7 not
triggered; no 2× multiplier applied; no High-Friction Surfaces note required.**

## Summary

**Bottom-up total**: 17 pts (H4 table sums exactly to the phase table).
**Top-down intuition**: ~10–12 pts (a naive "just move some files around" read, which the decisions
block explicitly warns against trusting: "Bottom-up (17) > roadmap 'effort L' intuition mapped naively;
trust bottom-up").
**Locked estimate**: **17 pts** — bottom-up, no compression. Matches decisions block §4 and PRD
frontmatter `estimated_points: 17` exactly.
