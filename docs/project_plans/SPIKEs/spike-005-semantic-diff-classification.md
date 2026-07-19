---
schema_version: 2
doc_type: spike
title: "SPIKE-005: Semantic Diff Classification for KB Changes"
status: draft
created: 2026-07-19
feature_slug: wave0-safety-foundation
research_questions:
  - "What are the change classes for a KB diff (rule-add, rule-remove, threshold-change, evidence-change, candidate-change, metadata-only, operator-semantics-change, ...)?"
  - "Which classes are safety-relevant and force clinical re-review vs. which are cosmetic?"
  - "How is a threshold change detected structurally when the rule when tree is nested?"
  - "How does the diff report get consumed by the review workflow, and what is its output contract?"
  - "What is the false-negative risk of a safety-relevant change misclassifying as cosmetic, and how do we test for it?"
complexity: XL
estimated_research_time: "8h"
related_documents:
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  - docs/project_plans/design-specs/signed-kb-manifest.md
  - docs/project_plans/design-specs/module-manifest-json-schema.md
  - .claude/worknotes/wave0-safety-foundation/repo-current-state.md
---

# SPIKE-005: Semantic Diff Classification for KB Changes

Gates **Phase 1** (P1-WP5, roadmap `docs/project_plans/expansion/01-platform-expansion-
roadmap.md:162`, `scripts/kb-diff.mjs`). **No P0 deferred-item design spec directly owns this
problem** — the closest adjacent specs are `signed-kb-manifest.md` (DEF-4, whose `supersedes` field
sketches an "auditable release chain" but does not design the diff classifier itself) and
`module-manifest-json-schema.md` (DEF-5, schema formalization only). This SPIKE is the primary
design authority for `kb-diff.mjs`; treat DEF-4/DEF-5 as consumers of this SPIKE's output, not
prior art to defer to. **This is the hardest of the four Phase 1 SPIKEs** — its central risk is
under-reporting, not over-reporting; treat every exit criterion below as adversarial by default.

## Problem statement

Today, `modules/anemia/rules.json` has exactly 5 top-level keys per rule — `id`, `category`,
`evidence`, `when`, `output` (repo-current-state.md §B) — and no diffing tool exists at all
(`scripts/` has 5 files, none named `kb-diff.mjs`, repo-current-state.md §D). A `when` condition is
an arbitrary-depth tree of `all`/`any`/`not` combinators over leaf conditions (`src/ruleEngine.js:
39-49`, `evaluateCondition()`). Confirmed by direct inspection of `modules/anemia/rules.json`: rule
`IMF-001`'s `when` nests a numeric leaf (`{"fact": "marrow.congenitalSignalCount", "op": "gte",
"value": 1}`) three `all`/`any` levels deep; rule `Q-NORMO-HIGH-001` similarly nests `{"fact":
"hemolysis.markerCount", "op": "lt", "value": 2}` inside an `all` array — a naive top-level or
line-based diff of `rules.json` would show these as opaque JSON text churn, not "threshold N
changed to threshold M inside branch X." `rule.schema.json`'s `condition` `$def` (`:22-54`) formally
defines the leaf shape (`fact`, `op` ∈ 13 enumerated operators, `value`), which is the structural
target a real diff must walk, not the raw JSON text.

## Scope

**In scope**: change-class taxonomy across `rules.json`, `candidates.json`, `evidence.json`,
`reference-ranges.json`, `module.json`; structural (AST-aware, not text-diff) detection of nested
threshold changes; the diff report's consumption contract by whatever review workflow P1-WP7
(review-portal concept) eventually implements; false-negative risk analysis and test design.

**Out of scope**: building the review-portal UI itself (P1-WP7's concern, paper-design only per
roadmap `:164`); the actual signing mechanism (SPIKE-006's concern) — this SPIKE produces the diff
*report*, SPIKE-006/DEF-4 decide what gates a release on it.

## Research questions & exit criteria

### RQ1 — Change-class taxonomy
**Exit criterion**: an exhaustive, named enum of change classes with a one-line definition and a
concrete example drawn from the actual rule/candidate/evidence files, at minimum: `rule-add`,
`rule-remove`, `threshold-change` (a numeric `value` changes inside an existing leaf), `operator-
change` (a leaf's `op` changes, e.g. `gte`→`gt` — same fact, different comparison, which silently
shifts a boundary case), `candidate-target-change` (a rule's `output.candidateId` changes — same
condition, different destination), `level/points-change` (`output.level` or `output.points` changes
— same match, different rank contribution), `evidence-change` (a rule's or candidate's `evidence[]`
array changes — citation added/removed/swapped), `candidate-content-change` (`candidates.json`
`summary`/`defaultNextSteps` text changes), `metadata-only` (once P1-WP4 fields like
`changeRationale`/`owner` exist, a change touching only those), `operator-semantics-change` (the
*engine's* interpretation of an existing operator changes — e.g. `ruleEngine.js`'s `evaluateLeaf()`
switch, `:21-36`, is edited — this is a code change, not a KB-content change, and must be classified
separately since `kb-diff.mjs` diffing JSON files cannot see it). The taxonomy must be exhaustive
enough that every possible git diff hunk across the 5 KB files classifies into exactly one class —
"uncategorized" is not an acceptable residual bucket.

### RQ2 — Safety-relevant vs. cosmetic
**Exit criterion**: for every class in RQ1's taxonomy, a binding safety-relevance verdict
(`safety-relevant` → forces clinical re-review before release; `cosmetic` → does not) with an
explicit rule for **ambiguous** cases, since some classes are relevance-dependent on *which* rule
changed, not the class alone (e.g. a `candidate-content-change` to `defaultNextSteps` text on a
"meets-defined-pattern" marrow-failure candidate is plausibly safety-relevant even though the class
looks cosmetic on its face). The exit artifact must therefore be a decision **function**, not a
static per-class table alone — e.g. `class × output.level × output.severity → verdict` — grounded in
the existing `LEVEL_RANK`/`ALERT_RANK` enums (`src/ruleEngine.js:1-9`) as the severity signal already
present in the data. State explicitly: `rule-add`, `rule-remove`, `threshold-change`, `operator-
change`, and `operator-semantics-change` are safety-relevant by default with no exception; `metadata-
only` is cosmetic by default with no exception; the rest are conditional per the decision function.

### RQ3 — Structural detection of nested threshold changes
**Exit criterion**: a concrete algorithm (pseudocode, not prose) that walks the `when` tree of a
rule's before/after versions using the same recursive shape `evaluateCondition()` already uses
(`all`/`any`/`not`/leaf), assigns each leaf a stable structural address (e.g. a path like
`all[2].any[1]` or a content-addressed key derived from `fact`+position, since array reordering
without content change must not falsely register as N changes), and reports a `threshold-change`
only when a leaf's `value` differs at the *same* address with the same `fact`/`op`, vs. a `rule-
remove`+`rule-add` pair when the leaf's `fact` or tree position changes enough that no stable
address match exists. Validate the algorithm against the two concrete nested examples already
confirmed in the codebase — `IMF-001`'s 3-level-deep `marrow.congenitalSignalCount gte 1` leaf and
`Q-NORMO-HIGH-001`'s `hemolysis.markerCount lt 2` leaf — by hand-simulating a threshold edit to each
and confirming the algorithm reports `threshold-change`, not opaque text churn.

### RQ4 — Consumption contract
**Exit criterion**: a concrete output schema for the diff report (e.g. `{moduleId, fromVersion,
toVersion, changes: [{class, safetyRelevant, ruleId|candidateId|sourceId, path, before, after,
rationale?}], summary: {safetyRelevantCount, cosmeticCount}}`), plus an explicit statement of who/
what consumes it: does `scripts/kb-diff.mjs` run as a pre-release gate inside `npm run check` (would
need a "compare to last release" concept `package.json` doesn't have today, repo-current-state.md
§D), a standalone script invoked manually before signing (SPIKE-006/DEF-4's release step), or both?
Must also state how the report interacts with P1-WP4's new `requiredTestCaseIds`/`changeRationale`
fields (roadmap `:161`) — e.g. does a `safety-relevant` change require a non-null `changeRationale`
on the affected rule before the diff tool will report `clean`, closing the loop between "what
changed" and "why."

### RQ5 — False-negative risk and test design
This is the SPIKE's central risk: a change that **is** safety-relevant but classifies as cosmetic.
**Exit criterion**: (a) a named list of concrete failure-mode scenarios where the RQ1/RQ2 taxonomy
could under-report — at minimum: a threshold change disguised as simultaneous `rule-remove` +
`rule-add` (same clinical intent, different rule `id`, defeating RQ3's stable-address matching); an
`operator-semantics-change` inside `ruleEngine.js` that no JSON-level diff can see at all (flagged
in RQ1, but *testing* for it requires a different mechanism — e.g. a fixed corpus of leaf
evaluations run before/after any `ruleEngine.js` change, not a JSON diff); a `candidate-content-
change` to `defaultNextSteps` that quietly removes a safety-critical next-step string without
changing `level`/`points`; a multi-hunk change where each individual hunk classifies as cosmetic but
the *combination* changes clinical meaning (e.g. a threshold loosened in one rule while a
compensating alert is silently removed in another). (b) For each scenario, a concrete detection or
test strategy — e.g. a `tests/dangerous-miss.test.mjs`-style corpus (P1-WP6) that asserts specific
dangerous-miss example inputs (`examples/marrow-red-flags.json`, `hemolysis-hs.json`) still produce
the same alert/candidate set after any KB change, as a *behavioral* backstop independent of the
structural diff classifier — since RQ5's premise is that the classifier itself can be wrong, the
exit criterion requires a check that does not depend on the classifier being right.

## Method

1. Confirm the current rule/candidate/evidence file shapes directly (already done above via live
   `node` inspection of `modules/anemia/rules.json`) rather than trusting a stale description.
2. Draft the RQ1 taxonomy against the actual field set in `rule.schema.json`'s `$defs` (`:22-111`)
   and `candidate.schema.json`, so every schema-defined field maps to a class — an unmapped field is
   a taxonomy gap.
3. Hand-simulate RQ3's algorithm against the two real nested examples found above; do not design in
   the abstract.
4. For RQ5, treat this as an adversarial exercise: attempt to construct at least 3 concrete "beats
   the classifier" inputs against the RQ1/RQ2 design before declaring it sufficient — if none can be
   constructed in the time available, that absence-of-counterexample is itself weaker evidence than
   a design that names its own limits, so document attempted-and-failed adversarial cases explicitly.
5. Route the RQ2 safety-relevance decision function through `council-review` before treating it as
   final — this is a clinical-safety-adjacent classification, not a pure engineering choice, per
   roadmap AOS wiring (`:230`).

## Overall SPIKE exit criteria

Closed when: (1) RQ1's taxonomy covers every field in `rule.schema.json`/`candidate.schema.json`
with no unmapped field; (2) RQ2's decision function is recorded and has passed a `council-review`
pass; (3) RQ3's algorithm is validated against the two real nested examples; (4) RQ4's output schema
is concrete enough to implement `scripts/kb-diff.mjs` directly from it; (5) RQ5 names at least 3
concrete false-negative scenarios and a test strategy for each, including at least one behavioral
(not structural-diff-dependent) backstop.

## Timebox

**Timebox: 8 hours** (longest of the four Phase 1 SPIKEs, per its "hardest" designation). If the
timebox expires before RQ5's adversarial pass is complete: ship RQ1–RQ4 as final, ship RQ5 with
whatever failure-mode scenarios were found plus an explicit list of *un-adversarially-tested*
classes, and treat the behavioral dangerous-miss backstop (RQ5b) as the mandatory minimum
deliverable even if the full scenario list is incomplete — a classifier with no behavioral backstop
is not an acceptable partial result, since it has no safety net if RQ1/RQ2/RQ3 are wrong.

## Decision impact

| P1 work package | Blocking? | Default/fallback if this SPIKE is skipped |
|---|---|---|
| P1-WP5 (signed KB manifest + semantic diff) | **Direct, hard block** — `kb-diff.mjs` is named explicitly in WP5's file list (roadmap `:162`) | Cannot start the diff-tool half of WP5; the manifest/signing half (SPIKE-006) could proceed independently but "semantic diff produces a correct change report" is an explicit V2 go criterion (roadmap `:224`) — skipping this SPIKE means that go criterion cannot be met. |
| P1-WP7 (review-portal concept) | Soft — the review-portal's data contract will want to consume this SPIKE's RQ4 output schema | If skipped, WP7's design would need to invent its own change-classification concept independently, risking a mismatch with whatever WP5 eventually ships. |

**If skipped**: the fallback is releasing KB changes with only human review and no structural
diff — given CLAUDE.md's "No AI-published rule changes... independent clinical review" guardrail
already requires human review regardless, skipping this SPIKE downgrades the diff tool from "catches
what a human reviewer might miss in a 91-rule nested JSON tree" to "nothing," which is a real safety
regression against the roadmap's stated V2 go criterion, not a cosmetic scope cut.

## Citations

- `docs/project_plans/expansion/01-platform-expansion-roadmap.md:162, 224, 228`
- `docs/project_plans/design-specs/signed-kb-manifest.md` (DEF-4, `supersedes` chain concept)
- `docs/project_plans/design-specs/module-manifest-json-schema.md` (DEF-5, schema formalization dependency)
- `.claude/worknotes/wave0-safety-foundation/repo-current-state.md` §B, §C, §G (P1-WP5 row)
- `src/ruleEngine.js:1-49`, `schemas/rule.schema.json:22-111`, `modules/anemia/rules.json` (live inspection: `IMF-001`, `IMF-DBA-001`, `Q-NORMO-HIGH-001`)
