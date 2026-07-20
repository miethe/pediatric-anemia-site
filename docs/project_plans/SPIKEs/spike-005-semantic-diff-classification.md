---
schema_version: 2
doc_type: spike
title: "SPIKE-005: Semantic Diff Classification for KB Changes"
status: completed-with-required-amendments
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
status_note: "Findings recorded 2026-07-19 (EP0-T3). The council-review pass required by Method §5 and overall exit criterion (2) WAS performed 2026-07-19/20 (ARC run arc-run-2026-07-19-spike-005-rq2-decision-function) — OQ-7 is closed-with-caveats, not cleanly closed. VERDICT: the RQ2 decision function AS WRITTEN must NOT be implemented against. Pediatric council recommendation `rejected` for RQ2-as-written; scorecard `pause_and_validate`; 5 critical and 15 high findings accepted. The council constructed and EXECUTED a false negative entirely inside the classifier's declared JSON scope: softening ALERT-001's emergency-alert detail classifies as C10, tiers at `review`, fails no gate, produces no delta on any of the six fixtures, and cannot trigger the cross-check — both proposed checks report clean while a clinician-facing emergency explanation is rewritten. Also accepted: an undefined predicate (`sameNumericValue`) can route a rule-disabling edit into the fixed-cosmetic bucket; Family E is written against a `src/evidence.js` structure deleted in the SPIKE's own commit; `A5` and `D7` are wrongly fixed-cosmetic; the `review` tier enforces nothing. Exit criterion (2) is NOT MET — the pass happened and did not return a pass. Criterion (3) is independently confirmed MET. Nine required amendments (RA-1..RA-9) must land and the SPIKE must be re-reviewed before EP-5 implements against RQ2 — see the OQ-7 section. What SURVIVED and must not be traded away: fail-closed defaults, skeleton-before-leaf comparison, enum-grounded severity, and the mandatory blind-spot warning. The council is a SYNTHETIC ADVERSARIAL REVIEW; it is not clinical validation, not credentialed clinical review, and confers no release authority."
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

> **Post-council status (2026-07-19/20).** Criterion (3) is **met** — independently re-verified, and a
> candidate finding alleging otherwise was tested and rejected. Criterion (5) is **met in form** (ten
> modes named with strategies, backstop mandated) but weak in substance, because the backstop has no
> activation witness for any emergency or urgent alert. Criteria **(1), (2) and (4) are NOT met**:
> (1) three concrete unmapped-field counterexamples and a wrong class count; (2) the council-review
> pass was performed and did not return a pass; (4) `cosmeticOnly` and `contentHash` are undefined,
> the release gate and the `clean` predicate disagree, and the blind-spot inventory is incomplete.
> See the OQ-7 section for the full record.

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

---

## Critical cross-cutting findings (read first)

Four measured facts about the current KB invalidate the charter's implicit framing and drive every
decision below. All four were obtained by executing the real engine over the real KB, not by reading
descriptions.

**CCF-1 — The KB has almost no numeric thresholds; the thresholds live in code and in
`reference-ranges.json`.** Walking all 91 `when` trees yields **247 leaf conditions: 241 `eq`, 2
`gte`, 3 `missing`, 1 `lt`**. Zero uses of `in`/`not-in`/`includes`/`neq`/`gt`/`lte`/`exists`/
`truthy`/`falsy`. The *entire* numeric-value surface of `rules.json` is three leaves:
`marrow.congenitalSignalCount gte 1` (`modules/anemia/rules.json:2207`, `:2271` — `IMF-001` and
`IMF-DBA-001`) and `hemolysis.markerCount lt 2` (`:2768`, `Q-NORMO-HIGH-001`). Every clinically
load-bearing cutoff is elsewhere: `modules/anemia/facts.anemia.js:76` (`hemolysisMarkerCount >= 2`),
`:82-84` (blood lead `>= 3.5` / `>= 20` / `>= 45`), `:51-54` (sTfR index `> 2` / `< 1`), `:171-173`
(Hb `< 7` / `< 9` severity categories), `:26-28`/`:201-202` (age gating 6/12/72/216 months),
`modules/anemia/ranges.js:41-53` (ferritin 20/30 ng/mL), and `modules/anemia/reference-ranges.json`
(all Hb/MCV/RDW band limits). **RQ3's marquee problem — nested numeric-threshold detection — covers
3 of 247 leaves, while a JSON-only `kb-diff.mjs` is structurally blind to ~100% of the real threshold
surface.** This is the SPIKE's headline result and it reweights the design: the JSON-scope classifier
is necessary but is *not* where the safety lives.

**CCF-2 — The rules are a boolean fact-flag DSL, so the dangerous edits are polarity, combinator,
and output-payload edits, not value edits.** 30 rules have a bare-leaf `when`, 60 are `all`-rooted, 1
is `any`-rooted, and 5 contain a `not`. With 241/247 leaves being `eq <boolean|string>`, the highest-
leverage single-character edits are `true`→`false`, `all`→`any`, and inserting/removing a `not` —
each of which a leaf-multiset-comparing differ can be made to report as *no leaf change at all*
(see FN-1/FN-2 in RQ5).

**CCF-3 — The existing behavioral safety net covers 30 of 91 rules; 61 rules have no activation
witness, including 9 alert rules (4 `emergency`, 2 `urgent`).** Running `assessPediatricAnemia()`
over all six `examples/*.json` and unioning `provenance.matchedRuleIds` gives 30 distinct matched
rules. Never-fired alerts: `SCOPE-001`, `SCOPE-002`, `SCOPE-003`, `ALERT-001` (emergency,
`rules.json:69`), `ALERT-002` (emergency), `ALERT-003` (urgent), `ALERT-006` (emergency),
`ALERT-007` (emergency), `ALERT-008` (urgent). `tests/module-equivalence.test.mjs` therefore cannot
detect the deletion, suppression, or severity-downgrade of any of them — including
`ALERT-001`'s emergency "potentially unstable symptomatic anemia" flag. **Any behavioral backstop
built on today's 6-example corpus is a null check for two-thirds of the rule base.** Corpus coverage,
not comparison mechanics, is the load-bearing part of the RQ5b deliverable.

**CCF-4 — `schemas/*.json` are not enforced anywhere.** `grep -rn schema package.json tests/ scripts/`
returns nothing: `scripts/validate-kb.mjs` performs only id-uniqueness, `evaluateCondition()`-doesn't-
throw, evidence-reference, candidate-reference, and manifest-version-drift checks (`:28-72`). No
JSON-Schema validator (no `ajv`) exists in the repo. Consequences the classifier must own: a leaf may
legally-in-practice omit `op` (engine defaults to `eq`, `src/ruleEngine.js:21`) even though
`rule.schema.json:45` requires it; `additionalProperties: false` is unenforced, so an edit may add an
*unknown key* to a rule or output and nothing rejects it. A structural differ that trusts the schema
to have already rejected malformed input will under-report.

---

## Findings by research question

### RQ1 — Change-class taxonomy

Eight top-level families, 44 leaf classes. Every family is anchored to the field it covers in
`rule.schema.json` / `candidate.schema.json` / the three data files / `module.json`, so schema-field
coverage is exhaustive by construction (verified field-by-field in RQ1-coverage below). Valence
column: **B** = benign, **R** = needs-review, **D** = dangerous. Valences marked `→fn` are resolved
by the RQ2 decision function rather than being fixed.

#### Family A — Rule-set structure (`rules.json` array level)

| Class | Definition | Valence | Grounding |
|---|---|---|---|
| `A1 rule-add` | A new element in the `rules.json` array | **D** (no exception, per charter RQ2) | `rules.json` is a flat array of 91 |
| `A2 rule-remove` | An element disappears | **D** (no exception) | e.g. removing `ALERT-LEAD-CAPILLARY`, `rules.json:3001` |
| `A3 rule-id-change` | Same body, different `id` | **D** | `id` is user-visible (`alerts[].id`, `candidate.matchedRules[]`, `provenance.ruleAudit[].ruleId` — `ruleEngine.js:108,115,87`) and is the join key for P1-WP4 `requiredTestCaseIds` and for any approval record. Never cosmetic. |
| `A4 rule-reorder` | Array position changes, content identical | **R** | Merge order is push-order (`ruleEngine.js:87-91`), so `matchedRules`, `supportingFindings`, `cautions`, `nextSteps`, `evidence` array *order* in the output follows file order. Clinician reads the first next-step first. |
| `A5 rule-category-change` | `category` string changes | **B** | `category` is never read by `ruleEngine.js` or `engine.js`; grep-confirmed non-consumed. |
| `A6 rule-duplicate-id` | Two rules share an `id` | **D** | Both fire; `validate-kb.mjs:29` catches it — classifier must report it as a structural-integrity fault, not diff it as two edits. |
| `A7 unknown-key-add` | A key not in `rule.schema.json` appears on a rule/output | **R** | CCF-4: `additionalProperties:false` unenforced. Silent no-op today, but signals an authoring error or a half-landed feature. |

#### Family B — Condition logic (`when` tree)

| Class | Definition | Valence | Grounding |
|---|---|---|---|
| `B1 threshold-change` | Numeric `value` changes at a stable leaf address, `fact`+`op` unchanged | **D** | Only 3 sites exist (CCF-1): `rules.json:2207`, `:2271`, `:2768` |
| `B2 operator-change` | Leaf `op` changes, `fact`+`value` unchanged (`gte`→`gt`) | **D** | `ruleEngine.js:24-27`; boundary-only behavioral delta |
| `B3 boolean-value-flip` | `value` flips `true`↔`false` (or string enum changes) on an `eq`/`neq` leaf | **D** | The dominant edit shape — 241/247 leaves (CCF-2) |
| `B4 value-type-change` | `value` changes JSON type without changing its rendered text (`true`→`"true"`, `2`→`"2"`) | **D** | `eq` is `===` (`ruleEngine.js:22`) so `true` vs `"true"` never matches; but `gte` coerces (`5 >= "3"` is true) so the same edit is inert on numeric ops. Looks like a quoting/lint change in a text diff. |
| `B5 value-format-change` | Numeric literal reformat (`2`→`2.0`, `3.5`→`3.50`) | **B** | Identical after `JSON.parse`; must be classified benign or the tool cries wolf |
| `B6 value-set-change` | An element is added to/removed from an array `value` (`in`/`not-in`) | **D** | Zero instances today (CCF-1) but reachable via `rule.schema.json:49` |
| `B7 fact-repoint` | Leaf `fact` path changes, `op`/`value` unchanged | **D** | `getPath()` returns `undefined` for a bad path and every op silently evaluates false (`ruleEngine.js:11-16,24-27`) — no error is raised |
| `B8 leaf-add` | A new leaf appears in an existing combinator array | **D→fn** | Adding to `all` = narrowing (suppression); adding to `any` = broadening. Valence depends on combinator context × output type. |
| `B9 leaf-remove` | A leaf disappears from a combinator array | **D→fn** | Mirror of B8 |
| `B10 combinator-swap` | An `all` key becomes `any` (or vice versa), children identical | **D** | Leaf multiset is byte-identical; only one object key name changed |
| `B11 negation-change` | A `not` wrapper is added or removed at any depth | **D** | Total polarity inversion; 5 rules use `not` today (`TEC-001`, `IRIDA-001`, `Q-MICRO-003`, `Q-NORMO-LOW-001`, `Q-MACRO-002`) |
| `B12 subtree-move` | A leaf/subtree changes depth or parent without content change | **D→fn** | Moving a leaf from inside an `any` to the enclosing `all` converts "one of" to "required" |
| `B13 op-omission` | The `op` key is deleted from a leaf | **R** | Engine defaults to `eq` (`ruleEngine.js:21`); schema-invalid but unenforced (CCF-4) |
| `B14 empty-condition` | `when` becomes `{}` or `null` | **D** | `evaluateCondition` returns **true** for an empty object (`ruleEngine.js:40`) — the rule fires unconditionally on every patient |

#### Family C — Rule output payload

| Class | Definition | Valence | Grounding |
|---|---|---|---|
| `C1 output-type-change` | `output.type` changes between candidate/alert/question/note | **D** | Different branch in `runRules` (`ruleEngine.js:112-139`); e.g. an alert demoted to a note loses its severity channel entirely |
| `C2 candidate-target-change` | `output.candidateId` repoints | **D** | Same trigger, different destination pattern (`ruleEngine.js:70`) |
| `C3 level-change` | `output.level` moves within the `LEVEL_RANK` ladder | **D→fn** (downgrade always **D**) | `ruleEngine.js:1-7,84` |
| `C4 points-change` | `output.points` changes | **R** | Sort key 2 (`ruleEngine.js:145-146`); changes rank order, never membership |
| `C5 severity-change` | `output.severity` moves within `ALERT_RANK` | **D→fn** (downgrade always **D**) | `ruleEngine.js:9,152` |
| `C6 priority-change` | Question `output.priority` changes | **R** | `ruleEngine.js:156` sort order of the adaptive-question list |
| `C7 section-change` | Question `output.section` changes | **R** | Grouping label consumed by the UI |
| `C8 safety-string-remove` | A string is removed from `output.actions` / `nextSteps` / `cautions` / `support` | **D** | `ALERT-001.actions` includes "Do not use this calculator to delay stabilization"; removing it is a pure-text edit with clinical consequence |
| `C9 safety-string-add` | A string is added to those arrays | **R** | New clinical instruction requires review |
| `C10 display-text-change` | `title` / `detail` / `prompt` / `why` prose changes | **R→fn** | The channel FN-4 (template hardcoding) hides in |
| `C11 template-binding-change` | A `{{fact.path}}` placeholder is added, removed, or repointed inside any output string | **D** | `interpolate()` (`ruleEngine.js:55-62`); live at `rules.json:451-452,530,560,982`. Replacing `{{ferritin.threshold}}` with a literal `20` freezes an age-dependent cutoff (20 vs 30 — `ranges.js:41-53`) into prose. |
| `C12 output-evidence-change` | `output.evidence[]` array changes | **D** | See Family E |

#### Family D — Candidate catalog (`candidates.json`)

| Class | Definition | Valence | Grounding |
|---|---|---|---|
| `D1 candidate-add` | New key in the object | **R** | Inert unless a rule targets it |
| `D2 candidate-remove` | Key deleted | **D** | `validate-kb.mjs:39` catches it *if* a rule still points at it; if the pointing rule was deleted in the same change, it passes — and if it ever slips through, `mergeCandidate` fabricates `{id, label:id, summary:''}` (`ruleEngine.js:71`), silently emitting a pattern with no label and no summary |
| `D3 candidate-label-change` | `label` string edited | **D→fn** | **Not cosmetic**: `label.localeCompare` is the rank tiebreaker (`ruleEngine.js:147`). A typo fix can reorder the differential when level and score tie. |
| `D4 candidate-summary-change` | `summary` prose edited | **R→fn** | Rendered verbatim (`app.js:322`) |
| `D5 default-next-step-remove` | An entry removed from `defaultNextSteps` | **D** | Seeded into every instance of that pattern (`ruleEngine.js:79`); e.g. `inherited-marrow-failure`'s "Refer to pediatric hematology/genetics…" (`candidates.json:304+`) |
| `D6 default-next-step-add` | Entry added | **R** | |
| `D7 candidate-category-change` | `category` edited | **B** | Not read by the engine |
| `D8 candidate-evidence-change` | `evidence[]` changes | **D** | Family E |
| `D9 candidate-key-id-mismatch` | Object key ≠ `.id` | **D** | `validate-kb.mjs:45`; structural-integrity fault |

#### Family E — Evidence & provenance

| Class | Definition | Valence | Grounding |
|---|---|---|---|
| `E1 evidence-ref-add` / `E2 evidence-ref-remove` | An id is added/removed from a rule's or candidate's `evidence[]` | **D** | Removal strips the citation chip; the CLAUDE.md guardrail is "every clinical statement ties to a source" |
| `E3 evidence-repoint` | An id is swapped for another *existing* id | **D** | `validate-kb.mjs:37` passes (both resolve); nothing can verify the new source actually supports the claim |
| `E4 evidence-dangling-ref` | An id that resolves in neither registry | **D** | `validate-kb.mjs:37` catches; `citeChips` would silently drop it (`app.js:162`) |
| `E5 evidence-record-content-change` | A field inside `evidence.json`'s `sources[]` (title/journal/doi/url/`supports[]`) changes | **D** | **Behaviorally invisible**: `evidence.json` is read only by `validate-kb.mjs:23`; the engine and UI use the hardcoded `EVIDENCE` object in `src/evidence.js:8-106` |
| `E6 evidence-registry-membership-change` | A source is added to / removed from `src/evidence.js`'s `EVIDENCE` | **D** | Removal makes `citeChips` drop every chip for it with no error (`app.js:162`) and `evidenceFor()` filter it out (`evidence.js:109`) |
| `E7 evidence-dual-source-drift` | `evidence.json` and `src/evidence.js` disagree (id sets verified identical today: 6 = 6) | **D** | DEF-1; no check enforces set equality — only the two version *strings* are drift-checked (`validate-kb.mjs:63-72`) |

#### Family F — Reference data (`reference-ranges.json`)

| Class | Definition | Valence | Grounding |
|---|---|---|---|
| `F1 range-value-change` | A `hbLower`/`mcvLower`/`mcvUpper`/`rdwUpper` number changes | **D** | Highest-leverage numbers in the KB: `hbLower` decides `anemia.present`, the antecedent of most `all` trees |
| `F2 band-boundary-change` | `minMonths`/`maxMonthsExclusive` edited | **D** | A one-digit edit (e.g. `72`→`71`, `reference-ranges.json:29`) creates an **uncovered age gap**: `getBuiltInAnalyteValue` returns `null`, `getBuiltInRange` returns `null` (`ranges.js:71`), all four thresholds become `null`, and the engine silently stops classifying anemia for that age |
| `F3 band-add` / `F4 band-remove` | A band object is added/removed | **D** | Same gap/overlap mechanics |
| `F5 sex-field-transposition` | `female`/`male` sub-objects (or fields within them) swapped | **D** | Values all still present — a set-comparing differ sees no new/removed numbers at all |
| `F6 units-change` | `units.hb`/`mcv`/`rdw` label edited with values unchanged | **D** | Pure metadata; invalidates every number in the file yet has zero behavioral delta (`units` is never read) |
| `F7 range-source-change` | Top-level `source` (`"AAP2026_IDA"`) edited | **D** | Flows into `provenance.hbLower.source` in every assessment (`ranges.js:31,93`) — a provenance claim, not a label |
| `F8 range-scope-change` | `scope` string edited | **R** | Documentation-only |

#### Family G — Manifest & governance (`module.json`)

| Class | Definition | Valence | Grounding |
|---|---|---|---|
| `G1 version-bump` | `knowledgeBaseVersion` / `evidenceReviewedThrough` change | **R** | Must also match `src/evidence.js` (`validate-kb.mjs:63-72`) |
| `G2 version-omission` | Any Family A–F change lands with `knowledgeBaseVersion` **unchanged** | **D** | The release is labelled as an already-approved version. This class is defined on the *absence* of a diff — a differ that only enumerates hunks structurally cannot express it; it must be a cross-file invariant. |
| `G3 attestation-change` | `approvedBy[]`, `validationRunId`, `clinicalContentHash`, `status`, `releasedAt`, `supersedes` change | **D** | CLAUDE.md: "No AI-published rule changes"; SPIKE-001 notes `approvedBy` must be real named humans, never ARC output. Behaviorally inert, governance-critical. |
| `G4 manifest-declarative-change` | `supportedAgeMonths`, `title`, `engineLabel`, `schemaVersion` change | **R** | `supportedAgeMonths` is **declared but unenforced** — `facts.anemia.js:26-28` hardcodes 6/216. Editing it creates doc/behavior divergence with no behavioral delta. |
| `G5 metadata-only` | Only P1-WP4 fields (`changeRationale`, `owner`, `requiredTestCaseIds`) change | **B** (no exception, per charter RQ2) | |

#### Family H — Engine & derivation (JSON-blind by construction)

`kb-diff.mjs` diffs JSON files. Every class here is a **code** change and is invisible to it — the
family exists so that "the diff reported clean" can never be read as "nothing clinically changed."

| Class | Definition | Valence | Grounding |
|---|---|---|---|
| `H1 operator-semantics-change` | `evaluateLeaf`'s switch edited | **D** | `ruleEngine.js:18-37` |
| `H2 combinator-semantics-change` | `evaluateCondition`'s recursion or its empty-condition→`true` default edited | **D** | `ruleEngine.js:39-49` |
| `H3 fact-derivation-threshold-change` | A numeric cutoff inside `facts.anemia.js` edited | **D** | `:51-54`, `:76`, `:82-84`, `:171-173`, `:201-202` — **the real threshold surface (CCF-1)** |
| `H4 fact-path-rename` | A key in the derived-facts object renamed without updating `rules.json` | **D** | Every referencing leaf silently evaluates false (`ruleEngine.js:11-16`) *and* every `{{path}}` renders `"not supplied"` (`:59`) |
| `H5 range-registry-change` | `ranges.js` composition/threshold logic edited (e.g. ferritin 20/30, `ranges.js:41-53`) | **D** | |
| `H6 merge-semantics-change` | `mergeCandidate`'s max-level / sum-points / `unique()` behavior edited | **D** | `ruleEngine.js:68-97,51-53` |
| `H7 ranking-semantics-change` | The sort comparators edited | **D** | `ruleEngine.js:142-156` |
| `H8 presentation-layer-change` | `app.js` rendering (`citeChips` filter, candidate card fields, any future truncation) edited | **D→fn** | `app.js:160-165,314-334`; **not** covered by `npm run check` (SPIKE-001 cross-cutting finding: no browser JS is executed by the gate) |

**RQ1 schema-field coverage check** (charter: "an unmapped field is a taxonomy gap"). `rule.schema.json`:
`id`→A3; `category`→A5; `when`→B1–B14; `evidence`→E1–E4; `output.type`→C1; `candidateId`→C2;
`level`→C3; `points`→C4; `support`→C8/C9; `cautions`→C8/C9; `nextSteps`→C8/C9; `severity`→C5;
`title`/`detail`→C10/C11; `actions`→C8/C9; `priority`→C6; `section`→C7; `prompt`/`why`→C10/C11;
`output.evidence`→C12; condition `fact`→B7; `op`→B2/B13; `value`→B1/B3/B4/B5/B6; `all`/`any`→B8–B10;
`not`→B11. `candidate.schema.json`: `id`→D9; `label`→D3; `category`→D7; `summary`→D4;
`defaultNextSteps`→D5/D6; `evidence`→D8. Plus the unschema'd files: `evidence.json`→E5/E7;
`reference-ranges.json`→F1–F8; `module.json`→G1–G4. **No unmapped field. No "uncategorized" bucket** —
anything that fails to match a class is reported as `A7 unknown-key-add` or as a hard
`unclassifiable` error that fails the run (never a silent pass; see RQ4).

### RQ2 — Safety-relevance decision function

Fixed verdicts (no exception, per the charter): `A1`, `A2`, `A3`, `A6`, `B1`–`B4`, `B6`, `B7`, `B10`,
`B11`, `B14`, `C1`, `C2`, `C8`, `C11`, `C12`, `D2`, `D5`, `D9`, `E1`–`E7`, `F1`–`F7`, `G2`, `G3`,
`H1`–`H7` are **safety-relevant**. `A5`, `B5`, `D7`, `G5` are **cosmetic**. Everything else routes
through the function.

```
classify(change) -> {class, safetyRelevant, tier}

// tier: 'block' (release gate fails until clinical re-review recorded)
//       'review' (must appear in the reviewer packet; release may proceed with sign-off)
//       'note'  (recorded in the report, no gate)

function safetyRelevance(change) {
  const c = change.class;

  // 1. Fixed-dangerous set — no context lookup, no exception.
  if (FIXED_DANGEROUS.has(c)) return { safetyRelevant: true, tier: 'block' };

  // 2. Fixed-cosmetic set — no exception.
  if (FIXED_COSMETIC.has(c)) return { safetyRelevant: false, tier: 'note' };

  // 3. Severity/level monotonicity: any move DOWN the ranked ladders is a
  //    suppression and blocks; any move UP is reviewable.
  //    LEVEL_RANK / ALERT_RANK are taken from src/ruleEngine.js:1-9 — the severity
  //    signal already present in the data, not a new invented vocabulary.
  if (c === 'C3 level-change')
    return rank(LEVEL_RANK, after) < rank(LEVEL_RANK, before)
      ? { safetyRelevant: true, tier: 'block' }
      : { safetyRelevant: true, tier: 'review' };
  if (c === 'C5 severity-change')
    return rank(ALERT_RANK, after) < rank(ALERT_RANK, before)
      ? { safetyRelevant: true, tier: 'block' }
      : { safetyRelevant: true, tier: 'review' };

  // 4. Condition-shape edits: valence = (monotonicity direction) x (output valence).
  //    Direction is computed from the combinator ancestry of the edit site, NOT
  //    from the edit alone: adding a leaf under `all` narrows; under `any` broadens;
  //    under an odd number of enclosing `not`s, both invert.
  if (c === 'B8 leaf-add' || c === 'B9 leaf-remove' || c === 'B12 subtree-move') {
    const dir = monotonicity(change.path, change.kind); // 'narrow' | 'broaden' | 'unknown'
    if (dir === 'unknown') return { safetyRelevant: true, tier: 'block' }; // fail closed
    const suppresses = (dir === 'narrow');
    // Narrowing an alert/high-level candidate REMOVES a warning => block.
    if (suppresses && outputIsProtective(change.rule)) return { safetyRelevant: true, tier: 'block' };
    return { safetyRelevant: true, tier: 'review' };
  }

  // 5. Protective-output text edits. A string edit is cosmetic only if the
  //    string it touches is not on a protective output and contains no template.
  if (c === 'C9' || c === 'C10' || c === 'D4' || c === 'D6') {
    if (containsTemplate(before) !== containsTemplate(after)) return { safetyRelevant: true, tier: 'block' }; // C11 escalation
    if (outputIsProtective(change.rule)) return { safetyRelevant: true, tier: 'review' };
    return { safetyRelevant: true, tier: 'review' }; // still never 'note' — see below
  }

  // 6. Ordering/weighting edits.
  if (c === 'A4 rule-reorder' || c === 'C4 points-change' || c === 'C6 priority-change'
      || c === 'C7 section-change' || c === 'D3 candidate-label-change')
    return { safetyRelevant: true, tier: 'review' };

  // 7. Everything else, including A7 unknown-key-add and any class the walker
  //    could not resolve: fail closed.
  return { safetyRelevant: true, tier: 'block' };
}

// A rule's output is "protective" when losing it loses a warning.
function outputIsProtective(rule) {
  const o = rule.output;
  return o.type === 'alert'                                   // all 13 alert rules
      || (o.type === 'candidate' && LEVEL_RANK[o.level] >= 4)  // meets-defined-pattern | strongly-supported
      || (o.type === 'candidate' && (o.cautions ?? []).length > 0);
}
```

Two deliberate design commitments in the above, both against the grain of a conventional differ:

1. **No path returns `cosmetic` except the four fixed-cosmetic classes.** Prose edits land at
   `review`, never `note`. Justification: FN-4 (template hardcoding) and C8 (safety-string removal)
   both present as prose edits, and the cost of a reviewer reading one extra sentence is negligible
   against the cost of a silent instruction removal. The charter asked for a decision function, not a
   minimal-noise function.
2. **Unknown fails closed at `block`.** An unresolvable class is treated as maximally dangerous.
   `uncategorized` as a silent-pass bucket is exactly the failure this SPIKE exists to prevent.

### RQ3 — Structural detection inside the nested `when` tree

Leaf identity uses a **dual address**: a positional path *and* a content key, and a `threshold-change`
is only asserted when exactly one of them is stable. Rationale: a positional path alone mis-reports
array reordering as N changes; a content key alone cannot distinguish "the same leaf moved" from "a
different leaf with equal content."

```
walk(node, path, negations) -> [ {addr, key, leaf} ]
  if node.all: for i,child in node.all: walk(child, path + '.all[' + i + ']', negations)
  if node.any: for i,child in node.any: walk(child, path + '.any[' + i + ']', negations)
  if node.not: walk(node.not, path + '.not', negations + 1)
  else emit { addr: path,
              key:  hash(sortedAncestorCombinators(path) + leaf.fact + leaf.op),
              polarity: negations % 2,
              leaf }

diffWhen(beforeTree, afterTree, rule):
  B = walk(beforeTree, '$', 0);  A = walk(afterTree, '$', 0)

  // Step 0 — combinator skeleton first, BEFORE any leaf matching.
  // This is what catches B10/B11: the leaf sets can be identical.
  skelB = combinatorSkeleton(beforeTree)   // e.g. all(leaf,leaf,leaf,any(leaf,leaf))
  skelA = combinatorSkeleton(afterTree)
  if skelB.shape == skelA.shape and skelB.keys != skelA.keys:
      emit B10 combinator-swap  (per differing node, with its address)
  if negationParityChanged(B, A, byKey):
      emit B11 negation-change
  if isEmpty(afterTree) and not isEmpty(beforeTree):
      emit B14 empty-condition        // fires on every patient — ruleEngine.js:40

  // Step 1 — match leaves by (addr AND key)  => same slot, same fact/op
  for each pair matched on (addr, key):
      if leaf.value differs:
          if sameNumericValue(before, after)      emit B5 value-format-change
          else if typeof differs                   emit B4 value-type-change
          else if typeof value == 'number'         emit B1 threshold-change
          else if typeof value == 'boolean'        emit B3 boolean-value-flip
          else if Array.isArray(value)             emit B6 value-set-change
          else                                     emit B3 (enum/string change)

  // Step 2 — match remaining leaves by key alone (same fact+op, moved)
  for each pair matched on key with addr differing:
      emit B12 subtree-move (+ recurse into value comparison as Step 1)

  // Step 3 — match remaining leaves by addr alone (same slot, different fact or op)
  for each pair matched on addr:
      if fact differs and op same      emit B7 fact-repoint
      if op differs and fact same      emit B2 operator-change
      if both differ                   emit B9 + B8 (remove/add pair, tier=block)

  // Step 4 — residue
  unmatched in B -> B9 leaf-remove ; unmatched in A -> B8 leaf-add
  for each: dir = monotonicity(addr) computed from the combinator ancestry in
            the addr string and the negation parity  (all=narrow, any=broaden,
            inverted once per enclosing `not`)

  // Step 5 — rule-level pairing.  Rules are matched by `id` FIRST.  Any rule
  // present in exactly one side is then re-matched against the other side's
  // orphans by structural hash of {when, output}; a match there is reported as
  // A3 rule-id-change (tier=block), NOT as remove+add and NOT as cosmetic.
```

**Hand-simulation 1 — `IMF-001` (`rules.json:2192`).** `walk` yields five leaves:
`$.all[0]` (`anemia.present eq true`), `$.all[1]` (`retic.low eq true`), `$.all[2]`
(`marrow.congenitalSignalCount gte 1`), `$.all[3].any[0]` (`morphology.macrocytic eq true`),
`$.all[3].any[1]` (`cbc.multilineageCytopenia eq true`) — the last two three levels deep.
Editing `value: 1`→`2` at `$.all[2]`: skeletons identical (Step 0 silent), Step 1 matches on
(`$.all[2]`, `hash(all|marrow.congenitalSignalCount|gte)`), `typeof value === 'number'` →
**`B1 threshold-change`, tier=block**, reported as `{ruleId:'IMF-001', path:'$.all[2]',
before:1, after:2}` — not opaque text churn. Editing `gte`→`gt` at the same address: Step 1 finds no
key match (op is in the key), Step 3 matches on `addr` with `fact` equal → **`B2 operator-change`**.

**Hand-simulation 2 — `Q-NORMO-HIGH-001` (`rules.json:2753`).** Leaves `$.all[0]`, `$.all[1]`,
`$.all[2]` (`hemolysis.markerCount lt 2`). Editing `2`→`3` → Step 1 → **`B1 threshold-change`**.
Reordering `$.all[1]` and `$.all[2]` with no content edit: Step 1 fails (addresses moved), Step 2
matches both by key → **`B12 subtree-move`** with `monotonicity = 'none'` under an `all` (order-
independent) → tier downgraded to `review`, and the differ reports **2 moves, not 2 removals + 2
adds**. Swapping the enclosing `all` for `any` with the same three children: Step 0 fires
**`B10 combinator-swap`, tier=block**, before Step 1 has a chance to report "no changes."

### RQ4 — Output contract and consumption

```jsonc
{
  "schemaVersion": 1,
  "moduleId": "anemia",
  "from": { "ref": "v0.3.1", "knowledgeBaseVersion": "0.1.0-2026-07-15", "contentHash": "sha256:…" },
  "to":   { "ref": "HEAD",   "knowledgeBaseVersion": "0.1.0-2026-07-15", "contentHash": "sha256:…" },
  "scope": {
    "filesDiffed": ["modules/anemia/rules.json", "candidates.json", "evidence.json",
                    "reference-ranges.json", "module.json"],
    "filesNotDiffed": ["src/ruleEngine.js", "modules/anemia/facts.anemia.js",
                       "modules/anemia/ranges.js", "src/evidence.js", "src/app.js"],
    "blindSpotWarning": "Family H (engine/derivation) changes are outside this tool's scope. A clean
                         report here does NOT mean behavior is unchanged. See behavior-probe report."
  },
  "changes": [
    { "class": "B1 threshold-change", "family": "B", "safetyRelevant": true, "tier": "block",
      "file": "modules/anemia/rules.json", "ruleId": "IMF-001",
      "path": "$.when.all[2].value", "leafAddr": "$.all[2]",
      "fact": "marrow.congenitalSignalCount", "op": "gte",
      "before": 1, "after": 2,
      "monotonicity": "narrow",
      "outputProtective": true,
      "changeRationale": null,
      "requiredTestCaseIds": ["CASE-IMF-001-BOUNDARY"],
      "rationale": "Numeric leaf value changed at a stable address; narrows a strongly-supported
                    marrow-failure candidate." }
  ],
  "invariants": [
    { "id": "G2 version-omission", "passed": false,
      "detail": "3 safety-relevant content changes with knowledgeBaseVersion unchanged." },
    { "id": "E7 evidence-dual-source-drift", "passed": true },
    { "id": "F2 band-coverage-continuity", "passed": true },
    { "id": "unclassifiable-residue", "passed": true, "count": 0 }
  ],
  "summary": { "block": 1, "review": 4, "note": 2, "unclassifiable": 0,
               "cosmeticOnly": false, "clean": false }
}
```

Design points, each answering a charter sub-question explicitly:

- **`invariants[]` is a first-class sibling of `changes[]`.** Three of the most dangerous classes
  (`G2`, `E7`, `F2`) are properties of the *whole* after-state, not of any single hunk. A report shape
  with only a `changes[]` array structurally cannot express them — this is a shape decision, not a
  detail.
- **`scope.filesNotDiffed` + `blindSpotWarning` are mandatory fields, always populated.** Given CCF-1,
  a report that omits them is actively misleading: it invites reading "clean" as "safe" precisely
  where the real thresholds live.
- **Who runs it.** Both, with different strictness. (a) `npm run check` gains
  `kb-diff --base=<last released tag> --mode=advisory`, printing the report and failing **only** on
  `unclassifiable > 0` — `package.json` has no "last release" concept today, so the base ref comes
  from `module.json`'s `supersedes`/`releasedAt` once DEF-4 populates them, and from an explicit
  `--base` argument until then. (b) `npm run check:release` (new) runs
  `kb-diff --mode=gate` **and** the behavior probe (RQ5b), and fails on any `tier: 'block'` that
  lacks a recorded clinical approval. This keeps the everyday gate fast and non-blocking while making
  the release gate strict.
- **Loop closure with P1-WP4.** A change is `clean` only when every `tier: 'block'` and
  `tier: 'review'` entry has a non-null `changeRationale` on the affected rule *and* the rule's
  `requiredTestCaseIds` all resolve to cases present in the behavioral corpus. "What changed" and
  "why, and which test proves it" are joined in one artifact.
- **P1-WP7 (review portal)** consumes `changes[]` grouped by `tier`, renders `before`/`after` at
  `path`, and renders the paired behavior-probe delta for the same rule id side-by-side. The two
  reports join on `ruleId` / `candidateId`.

### RQ5 — False-negative (under-reporting) modes

Adversarial premise: assume the classifier ships and is wrong. Each mode below is an edit that a
plausible, competently-built structural differ reports as no-change, cosmetic, or low-tier, while
clinical behavior changes.

**FN-1 (top) — Combinator swap with an identical leaf multiset.** `ALERT-009`'s `when`
(`rules.json:265`) is `all[cbc.neutropenia eq true, symptoms.fever eq true]`. Change `all`→`any`:
every leaf is byte-identical, every `fact`/`op`/`value` is byte-identical, the leaf count is
identical, the tree depth is identical. A differ built the obvious way — flatten to a leaf set,
compare — reports **zero changes**. Behaviorally the emergency febrile-neutropenia alert now fires on
fever alone, on every febrile child in the system. The inverse (`any`→`all` on the single `any`-rooted
rule, or on any of the 60 `all`-rooted rules' inner `any` nodes, e.g. `IMF-001`'s `$.all[3].any`)
*suppresses*. **Detection**: RQ3 Step 0 compares the combinator skeleton before leaf matching, and
treats a key-name difference at a structurally identical node as `B10`, tier=block. **Test**: seeded
mutations M03, M04, M08.

**FN-2 (top) — Negation-parity flip via a wrapper.** Wrapping `ALERT-004`'s bare-leaf `when`
(`rules.json:135`, `cbc.multilineageCytopenia eq true`) in `{"not": {...}}` adds one key. A differ
that walks into `not` transparently (the natural implementation — `evaluateCondition` itself does
`if (condition.not) return !evaluateCondition(...)`, `ruleEngine.js:47`, i.e. the recursion structure
invites treating `not` as pass-through) sees the same leaf at nearly the same address and reports a
`subtree-move` or nothing. Behaviorally the urgent multi-lineage-cytopenia alert now fires on
*everyone except* the patients it was written for. The same flip applied by *removing* a `not` from
one of the five rules that use one (`TEC-001` `rules.json:1716`, `IRIDA-001`, `Q-MICRO-003`,
`Q-NORMO-LOW-001`, `Q-MACRO-002`) is equally invisible. **Detection**: `walk()` carries a `negations`
counter into every emitted leaf and RQ3 Step 0 compares parity per content key. **Test**: M08, M02.

**FN-3 (top) — The whole Family H blind spot: threshold edits where the thresholds actually are.**
Per CCF-1, `rules.json` holds 3 numeric leaves; `facts.anemia.js` holds the lead reference value
(`:82`, `bll >= 3.5`), the hemolysis marker count (`:76`, `>= 2`), the sTfR index (`:51`, `> 2`), the
severe-anemia Hb category (`:171`, `< 7`), and the age gates (`:26-28`, `:201-202`), while
`ranges.js:41-53` holds the ferritin 20/30 cutoffs and `reference-ranges.json` holds every Hb/MCV/RDW
limit. A `kb-diff.mjs` that diffs module JSON reports **clean** for all of them. Worse, it reports
clean *confidently*: a green diff on the file set a reviewer thinks of as "the knowledge base"
actively suppresses scrutiny of the change that matters. The most acute variant is **H4
fact-path-rename**: renaming a derived-facts key (say `hemolysis.markerCount`) in `facts.anemia.js`
alone leaves every referencing rule syntactically valid, `validate-kb.mjs` green (it only checks that
`evaluateCondition` doesn't *throw*, `:31-35`, and `getPath` never throws — `ruleEngine.js:11-16`),
and every affected leaf silently evaluating **false** forever, plus every `{{hemolysis.markerCount}}`
in prose rendering the literal string `"not supplied"` (`ruleEngine.js:59`). Nothing in
`npm run check` fails. **Detection**: only the behavioral probe (RQ5b) run across a code-and-data
snapshot pair — never the JSON differ. This is the single strongest argument for the RQ5b deliverable
being non-negotiable. **Test**: M48–M52.

**FN-4 — Template hardcoding disguised as a prose edit.** `rules.json:452` reads
`"Ferritin {{ferritin.value}} ng/mL is at or below the AAP threshold of {{ferritin.threshold}} ng/mL."`
Replacing `{{ferritin.threshold}}` with the literal `20` classifies as a display-text change in any
taxonomy that treats strings as strings. The rendered output is *identical* for every child under 12
years and silently wrong (states 20 where the applied cutoff was 30) for every adolescent and every
menstruating patient (`ranges.js:41-53`). A behavioral probe catches it only if the corpus contains an
adolescent/menstruating ferritin case — the current 6 examples do not. **Detection**: `C11
template-binding-change` is a dedicated class detected by extracting the `{{…}}` placeholder multiset
from before/after strings and comparing it independently of the surrounding prose; any change to that
multiset is tier=block. **Test**: M20 + a corpus case that exercises the adolescent ferritin band.

**FN-5 — Rank displacement via an edit to a field nobody thinks is behavioral.** The final tiebreak in
the differential sort is `a.label.localeCompare(b.label)` (`ruleEngine.js:147`). A copy-edit to a
`candidates.json` `label` (Family D3) reorders the ranked differential whenever two patterns tie on
level and score. The same displacement arises from `A4 rule-reorder` (push-order determines
`supportingFindings`/`nextSteps` ordering, `ruleEngine.js:88-90`) and from `C4 points-change`. The
charter's framing — "a candidate reorder that drops a pattern below a display cutoff" — needs a
correction: **there is no display cutoff today.** `renderCandidates` (`app.js:314-334`) renders every
candidate with no `slice`. The real harm is (a) rank #1 displacement, since #1 is what a hurried
clinician reads, and (b) the fact that a truncation *could* be introduced later in `app.js` — an `H8`
change that `npm run check` cannot see at all, because the gate never executes browser JS. **Test**:
M13, M14, M32.

**FN-6 — Evidence repointing that both registries accept.** Changing a rule's `evidence` from
`["AAP2026_IDA"]` to `["BLOOD2022_PED_ANEMIA"]` passes `validate-kb.mjs:37` (both ids resolve) and
changes only one string. No automated check can verify that the new source's `supports[]` actually
covers the rule's claim. The dual-source variant is worse: editing `src/evidence.js` alone (removing a
source, or changing a `url`/`doi`) is outside any `modules/**` diff scope, and `citeChips` silently
drops chips for unresolvable ids (`app.js:162`) while `evidenceFor()` filters them out
(`evidence.js:109`) — the citation just disappears with no error. Symmetrically, editing
`evidence.json`'s `supports[]` (E5) has **zero** behavioral effect because the engine never reads that
file (`validate-kb.mjs:23` is its only reader). **Detection**: `E7` set-equality invariant across the
two registries; `E3` always tier=block with a mandatory human attestation that the new source supports
the claim. **Test**: M17, M37, M38, M39.

**FN-7 — Compensating multi-hunk change (each hunk individually low-tier).** Loosen `IMF-001`'s
`marrow.congenitalSignalCount gte 1`→`gte 2` (one `B1`) while adding a `leaf-remove` to a related
alert's `all` (one `B9`, which in isolation *broadens* and would be tiered `review`). Per-hunk
classification is correct in both cases and the combination silently narrows the marrow-failure
pathway. No per-hunk classifier can see this. **Detection**: this is definitionally out of reach of
the structural tool and is exactly what the behavioral probe's whole-output fingerprint catches —
the probe compares end states, not edits. **Test**: M52 (a paired mutation).

**FN-8 — Reference-band coverage gap.** `reference-ranges.json:29` `maxMonthsExclusive: 72` → `71`.
One digit. A differ classifies it `F2 band-boundary-change` — *if* it has that class; a differ that
treats `reference-ranges.json` as a generic data file emits "numeric value changed" and tiers it with
the same weight as a label typo. Behaviorally, a 71.5-month-old now falls through every band:
`getBuiltInAnalyteValue` returns `null`, `getBuiltInRange` returns `null` (`ranges.js:71`),
`getEffectiveRanges` returns four `null` thresholds (`:95`), `anemia.present` cannot be derived, and
the engine stops classifying anemia for that patient entirely — silently, with no alert and no error.
**Detection**: an `invariants[]` continuity check (bands partition `[6, 216)` with no gap and no
overlap) plus corpus cases at every band boundary. **Test**: M41.

**FN-9 — Type-only value change.** `{"fact":"anemia.present","op":"eq","value":true}` →
`"value":"true"`. In a rendered text diff this looks like a quoting normalization; a differ that
compares `String(before) !== String(after)` sees no change at all. `eq` is `===` (`ruleEngine.js:22`),
so the leaf becomes permanently false and the rule never fires again. The mirror case is inert: on
`gte`/`lt`, JS coerces the string, so the identical edit changes nothing — which is why a naive
"value changed" classifier that skips type comparison will get one of the two wrong. **Detection**:
`B4 value-type-change`, compared on `typeof` before value. **Test**: M23, M24.

**FN-10 — Version-omission (a dangerous change defined by the absence of a diff).** Any Family A–F
change shipped with `module.json`'s `knowledgeBaseVersion` untouched produces a deployed artifact that
labels itself as the previously approved version — `meta.knowledgeBaseVersion` in every assessment
(`engine.js:20`) and `src/evidence.js:1` both keep asserting the old version. A hunk-enumerating
differ has nothing to report because the dangerous property is what *didn't* change. **Detection**:
`invariants[]`, not `changes[]`. **Test**: M45.

**Adversarial cases attempted that the design does catch** (recorded per charter Method §4, since an
absence of counterexamples is weaker evidence than a design that names its limits): (i) renaming a
rule `id` while keeping the body — caught by RQ3 Step 5's structural-hash re-pairing, reported as
`A3`, tier=block; (ii) deleting a candidate whose only referencing rule is deleted in the same commit
— caught as `D2`+`A2`, both tier=block, though note `validate-kb.mjs` alone would pass it; (iii)
reordering `candidates.json` object keys — genuinely inert (`mergeCandidate` looks up by key,
`ruleEngine.js:70`), correctly `note`; (iv) reformatting `2` as `2.0` — correctly `B5`, benign.
**Cases the design does NOT catch and does not claim to**: FN-7's compensating pair (structural tool
cannot, by construction); any Family H change (out of scope by construction); and the semantic
question in FN-6 of whether a cited source actually supports a claim (requires a human).

---

## Recommended design

### Part 1 — `scripts/kb-diff.mjs` (structural classifier)

Implement RQ1's 44-class taxonomy, RQ2's decision function, RQ3's dual-address tree walk, and RQ4's
report schema. Non-negotiable implementation properties:

1. **Combinator skeleton comparison runs before leaf matching** (defeats FN-1/FN-2).
2. **Negation parity is carried on every emitted leaf**, never flattened away.
3. **`invariants[]` exists** and covers at minimum `G2 version-omission`, `E7 dual-source drift`,
   `F2 band continuity`, and `unclassifiable-residue == 0`.
4. **Fail closed**: unknown class ⇒ `tier: 'block'`. There is no cosmetic residual bucket.
5. **`scope.filesNotDiffed` and `blindSpotWarning` are always emitted**, so no reader can mistake a
   clean structural report for a clean behavioral one.
6. It **never reads the behavior probe's output**, and the probe never reads its output.

### Part 2 — `scripts/kb-behavior-probe.mjs` + `tests/dangerous-miss.test.mjs` (MANDATORY MINIMUM)

Per the charter's timebox clause, this is the non-negotiable deliverable: *a classifier with no
behavioral backstop is not an acceptable partial result.* Contract, precise enough to build from:

**Inputs.** `--base <path-to-snapshot>` (a full working-tree snapshot of the released revision:
`modules/**` *and* `src/**` — this is what makes Family H visible), `--head <path>` (defaults to the
working tree), `--corpus tests/corpus/`, `--waivers tests/corpus/expected-deltas.json`.

**Execution.** For each corpus case, load the base tree's engine in a **separate child process**
(imports resolved against the snapshot dir) and the head tree's engine in this process; run
`assess(case.input, 'anemia', rules, candidates)` on each side. Base and head each use their *own*
`rules.json`, `candidates.json`, `reference-ranges.json`, `facts.anemia.js`, `ranges.js`,
`ruleEngine.js`, `engine.js`. Scrub `meta.generatedAt` (existing pattern:
`tests/module-equivalence.test.mjs:24-26`). Determinism is already structurally guaranteed (stable
sort, insertion-ordered `Map`; SPIKE-001 RQ5 §3).

**Fingerprint** (per case) — order-sensitive where order is clinically meaningful, set-compared
otherwise:

```
{ alerts:        [ {id, severity, title, detail, actions[], evidence[]} ],  // ORDERED (rank of attention)
  differential:  [ {rank, id, level, score, label, summary,
                    supportingFindings[], cautions[], nextSteps[], evidence[], matchedRules[]} ], // ORDERED
  questions:     [ {id, priority, section, prompt, why, evidence[]} ],      // ORDERED
  notes:         SET of {id, title, detail, evidence[]},
  classification, limitations[],
  activation:    { ruleId -> boolean }   // ALL 91 entries, from provenance.ruleAudit
}
```

`activation` is the most sensitive channel: it is the only one that registers a change to a rule whose
output never reaches the top of the report.

**Delta ladder** (the pass/fail semantics — this, not the fingerprint, is the safety contract):

| Class | Trigger | Gate |
|---|---|---|
| **D1 SUPPRESSION** | an alert present at base absent at head; alert `severity` decreased in `ALERT_RANK`; a candidate present at base absent at head; candidate `level` decreased in `LEVEL_RANK`; any string removed from `actions`/`nextSteps`/`cautions`/`supportingFindings`; any evidence id removed; `activation[r]` true→false for any `r` | **FAIL** unless a matching, explicitly enumerated waiver exists |
| **D2 EMERGENCE** | new alert; new candidate; severity/level increase; `activation[r]` false→true; rank-#1 identity change | **FAIL** unless waived (a new emergency alert is as reviewable as a lost one) |
| **D3 REORDER** | identical id sets, different order in any ordered channel | **FAIL** unless waived |
| **D4 TEXT** | identical ids/levels/ranks/order, changed rendered strings | **FAIL** unless waived — FN-4 lives here, so it can never be auto-passed |
| **D5 NONE** | fingerprints identical | pass |

**Waivers.** `expected-deltas.json` maps `caseId → [ {deltaClass, path, before, after,
changeRationale, approvedBy} ]`. A waiver is valid only if `approvedBy` is a non-empty list of named
humans (CLAUDE.md: no AI-published rule changes; SPIKE-001's `approvedBy` caveat) and it matches the
observed delta exactly — a waiver for `D4` never absorbs an observed `D1`.

**Coverage gate** (`--coverage`, and it fails the build). For every rule in `rules.json` there must
exist at least one corpus case where `activation[ruleId] === true` (an **activation witness**) and one
where it is `false` (a **negative witness**). Rules with neither may be listed in
`tests/corpus/unreachable.json` with a written justification and a named reviewer. **Today 61 of 91
rules have no activation witness (CCF-3), including 4 emergency and 2 urgent alerts** — closing that
gap is the bulk of the EP-5 corpus work and is a hard precondition for the probe meaning anything.
Boundary coverage is additionally required: for each of the ~15 numeric cutoffs enumerated in CCF-1, a
case at the cutoff, one just below, and one just above (this is what makes `B2 operator-change` and
`H3` boundary edits detectable at all). Target size: **≥ 91 activation cases + ~45 boundary cases**,
versus 6 today.

**Independence (the load-bearing property).** The probe imports nothing from `kb-diff.mjs`, reads no
classification, and its verdict is a pure function of engine outputs over the corpus. It runs on the
same base/head pair. `npm run check:release` requires **both** to pass, plus a **cross-check**: if
`kb-diff` reports `summary.cosmeticOnly === true` while the probe reports any D1/D2/D3, that is a
**classifier defect** — hard fail, and it must be logged as a taxonomy bug with the mutation added to
the seeded corpus. That cross-check is the mechanism that converts a structural false negative from a
silent pass into a loud, attributable failure. It is the single most important line in this design.

### Part 3 — supporting invariants to add to `scripts/validate-kb.mjs`

Cheap, and each closes a hole found above: JSON-Schema validation of `rules.json`/`candidates.json`
against `schemas/*.json` (CCF-4 — nothing validates them today); `evidence.json` ↔ `src/evidence.js`
id-set equality (E7); reference-band continuity over `[6, 216)` (F2/FN-8); every `{{path}}` in every
output string resolves against the derived-facts shape produced for at least one corpus case
(H4/FN-3); and no rule has an empty `when` (B14).

---

## Alternatives considered

- **Text/line diff with a JSON-aware pretty-printer.** Rejected: `rules.json` is 3,022 lines for 91
  rules; a single-leaf edit is indistinguishable from reformatting, and nested threshold edits present
  exactly as the "opaque JSON text churn" the charter's problem statement names.
- **Generic structural JSON differ (`jsondiffpatch`/JSON Patch) with a per-path severity table.**
  Rejected as the primary mechanism: JSON Patch expresses FN-1's `all`→`any` as
  `{op:'move'}`/`{remove,add}` on an object key, losing the fact that the leaf set was preserved and
  the semantics inverted; it has no concept of negation parity, monotonicity direction, or
  combinator ancestry. Retained as a *fallback* renderer for the `before`/`after` payload inside each
  already-classified change entry.
- **Behavioral diff only (drop the structural classifier).** Tempting given CCF-1 and FN-3, and it is
  strictly the more trustworthy of the two. Rejected because the probe reports *that* behavior changed
  on the corpus, not *which edit* caused it or *why* — reviewers need the edit-level attribution, and
  the probe is blind to anything the corpus does not exercise. The two are complementary and the
  cross-check between them is the actual safety property.
- **Semantic equivalence checking via SAT/SMT over the `when` trees** (prove before ≡ after). Attractive
  because the DSL is nearly pure boolean (CCF-2) and would decide FN-1/FN-2/FN-9 exactly. Rejected for
  EP-5: numeric leaves and `getPath` over an untyped fact object make the encoding partial, it adds a
  solver dependency to a repo with zero runtime dependencies, and it still says nothing about Families
  C–H. Recorded as the strongest future upgrade path for `B*` classification specifically.
- **Reusing `tests/module-equivalence.test.mjs` as the behavioral backstop.** Rejected: it is a
  *tripwire*, not a classifier — any KB change fails it, so the standard remedy is to regenerate the
  golden fixtures (`scripts/capture-golden.mjs`), which erases the signal. It also covers 30/91 rules
  (CCF-3). The probe must grade deltas by safety valence and must not have a one-command "make it
  green" escape hatch; hence the explicit, human-attributed waiver file.
- **Treating prose edits as cosmetic to reduce reviewer noise.** Rejected: FN-4 and `C8` both present
  as prose edits. Reviewer noise is the price of the guarantee.

---

## Risks & open questions

- **OQ-1 (largest)**: the behavioral probe's value is bounded almost entirely by corpus coverage, and
  building ≥91 activation witnesses requires *clinically plausible* synthetic patients, not fact-vector
  fuzzing. Fuzzed inputs would satisfy the coverage gate while producing physiologically impossible
  patients whose "expected" outputs no clinician can sanity-check. Recommend EP-5 build the corpus by
  deriving each case from the rule's own `when` tree (solve for a satisfying fact assignment, then hand-
  write a plausible patient producing those facts) and mark every case with a `plausibility:
  reviewed|synthetic-unreviewed` flag so a later clinical review can prioritize.
- **OQ-2**: no base-ref concept exists. `package.json` has no release tag notion and `module.json`'s
  `supersedes`/`releasedAt` are `null` (`modules/anemia/module.json:13-14`). EP-5 must take `--base` as
  an explicit argument; the automatic path unblocks only when DEF-4/SPIKE-006 populate those fields.
- **OQ-3**: `monotonicity()` is only sound for pure conjunctive/disjunctive nesting with tracked
  negation parity. For mixed trees it can return `unknown`; the design fails closed to `block` there,
  which will over-report on legitimate restructurings. Accepted deliberately — measure the false-
  positive rate on real EP-5 changes before softening anything.
- **OQ-4**: `src/app.js` and `src/algorithmExplorer.js` (Family H8) are executed by no test in
  `npm run check` (SPIKE-001 cross-cutting finding). A change to `citeChips`'s silent-drop filter
  (`app.js:162`) or the introduction of any candidate-list truncation would be invisible to both tools
  designed here. Out of scope for EP-5, but it is a real hole and should be named in the P1-WP7 review-
  portal design rather than quietly inherited.
- **OQ-5**: `evidence.json`'s content is behaviorally inert (E5) yet is the artifact a reviewer would
  most naturally treat as "the evidence." Until DEF-1 unifies the two registries, the diff report must
  label `evidence.json` changes as `provenance-only, no runtime effect` — otherwise the report itself
  becomes a source of false confidence.
- **OQ-6**: the probe's base-side child process executes code from the base snapshot. If the base
  snapshot is attacker- or accident-controlled, this is arbitrary code execution inside the release
  gate. Constrain the base to a git-object-derived snapshot of a signed tag once SPIKE-006 lands.
- **OQ-7** — **RESOLVED-WITH-CAVEATS 2026-07-19/20.** The charter-mandated `council-review` pass
  (Method §5) on RQ2's decision function has now been **performed**. It did **not** return a pass:
  the verdict is that RQ2 as written must not be implemented against. Overall exit criterion (2) is
  therefore **still not met**, for a different reason than before — the pass happened and failed,
  rather than never happening. Full record, verdict, required amendments and new open questions:
  see [the OQ-7 section below](#oq-7--council-review-pass-performed-2026-07-1920-closed-with-caveats).
- **Risk**: the taxonomy will drift out of date as the DSL grows (a second module will introduce
  operators unused today — CCF-1 shows 9 of 13 operators have zero instances). Mitigation: the
  `unclassifiable-residue == 0` invariant makes drift a loud build failure rather than a silent gap.

---

## Implications per work package

- **P1-WP5 (`scripts/kb-diff.mjs` + signed manifest)** — implement Parts 1–3 above. Sequencing
  correction for the implementation plan: **build Part 2 (the behavior probe + corpus) first.** It is
  the mandatory minimum per the charter's timebox clause, it is independent of the classifier, and it
  is the only thing that covers Family H — which CCF-1 shows is where the actual thresholds live. A
  plan that ships the classifier first and the probe "if there's time" inverts the safety argument.
- **EP-5-T4 (seeded-mutation validation)** — consume the 52-mutation corpus below. Acceptance: for
  each mutation, `kb-diff` reports the expected class and tier, **and** the probe reports the expected
  delta class, **and** the cross-check does not fire. Mutations marked `kb-diff: BLIND` must be proven
  blind (the classifier reports clean) *and* proven caught by the probe or a Part 3 invariant — those
  rows are the direct test of FN-3.
- **P1-WP4 (`changeRationale` / `requiredTestCaseIds`)** — `requiredTestCaseIds` must reference ids in
  `tests/corpus/`, and the natural default is "the rule's own activation witness." The coverage gate
  and WP4 are the same mechanism viewed from two ends; design them together.
- **P1-WP6 (dangerous-miss tests)** — is the corpus of Part 2, not a separate artifact. Merge the two
  line items.
- **P1-WP7 (review portal)** — consume RQ4's schema; render the structural change and the behavioral
  delta for the same `ruleId` side by side. A portal that shows only the structural diff reproduces
  FN-3 at the UI layer.
- **DEF-4 / SPIKE-006 (signed manifest)** — `clinicalContentHash` should cover the union of
  `modules/<id>/*.json` **and** the Family H code files (`facts.*.js`, `ranges.js`, `ruleEngine.js`),
  or a signed release will attest to content whose behavior is defined by unsigned code.
- **`scripts/validate-kb.mjs`** — gains the five Part 3 invariants; JSON-Schema enforcement (CCF-4) is
  worth landing on its own regardless of the diff tool's fate.

---

## Seeded-mutation corpus for EP-5-T4

52 mutations. `Δ` = expected behavioral delta class from the probe's ladder (D1 suppression / D2
emergence / D3 reorder / D4 text / D5 none). "BLIND" in the class column means the structural
classifier is *expected* to report nothing — those rows test FN-3 and must be caught by the probe or
by `validate-kb.mjs`. `Δ` values marked `†` require a corpus case that does not exist today.

| # | Mutation | File / site | Expected class · tier | Expected Δ |
|---|---|---|---|---|
| M01 | `ALERT-001.output.severity` `emergency`→`urgent` | `rules.json:69` | C5 severity-change (downgrade) · block | D1† |
| M02 | `ALERT-001.when.value` `true`→`false` | `rules.json:69` | B3 boolean-value-flip · block | D1†+D2† |
| M03 | `ALERT-009.when` `all`→`any` | `rules.json:265` | B10 combinator-swap · block | D2 |
| M04 | `IMF-001.when` top-level `all`→`any` | `rules.json:2192` | B10 · block | D2† |
| M05 | `IMF-001` leaf `gte 1`→`gte 2` | `rules.json:2207` | B1 threshold-change · block | D1† |
| M06 | `Q-NORMO-HIGH-001` leaf `lt 2`→`lt 3` | `rules.json:2768` | B1 · block | D2† |
| M07 | `IMF-DBA-001` leaf `gte`→`gt` | `rules.json:2271` | B2 operator-change · block | D1† (boundary case only) |
| M08 | Wrap `ALERT-004.when` in `{"not": …}` | `rules.json:135` | B11 negation-change · block | D1+D2 |
| M09 | Add leaf `{"fact":"symptoms.fever","op":"eq","value":true}` to `ALERT-004`'s condition (converting it to an `all`) | `rules.json:135` | B8 leaf-add, narrow, protective · block | D1 |
| M10 | Delete rule `ALERT-LEAD-CAPILLARY` | `rules.json:3001` | A2 rule-remove · block | D1 |
| M11 | Duplicate `ALERT-001`'s `id` on a second rule | `rules.json` | A6 duplicate-id · block (+`validate-kb` error) | D2† |
| M12 | Rename `IMF-001`→`IMF-001A`, body unchanged | `rules.json:2192` | A3 rule-id-change · block (**not** remove+add, **not** cosmetic) | D4† (`matchedRules`/`activation` keys) |
| M13 | Move `ALERT-009` to the end of the array | `rules.json` | A4 rule-reorder · review | D3 |
| M14 | `IMF-001.output.points` `95`→`150` | `rules.json:2192` | C4 points-change · review | D3† |
| M15 | `IMF-001.output.level` `strongly-supported`→`possible` | `rules.json:2192` | C3 level-change (downgrade) · block | D1† |
| M16 | Repoint a candidate rule's `candidateId` `iron-deficiency-anemia`→`anemia-of-inflammation` | `rules.json` | C2 candidate-target-change · block | D1+D2 |
| M17 | Rule `evidence` `["AAP2026_IDA"]`→`["WHO2024_HB"]` | `rules.json` | E3 evidence-repoint · block | D4 |
| M18 | Rule `evidence`→`["AAP2026_IDA_TYPO"]` | `rules.json` | E4 dangling-ref · block (+`validate-kb` error) | D4 |
| M19 | Remove `"Do not use this calculator to delay stabilization…"` from `ALERT-001.output.actions` | `rules.json:69` | C8 safety-string-remove · block | D1† |
| M20 | Replace `{{ferritin.threshold}}` with the literal `20` | `rules.json:452` | C11 template-binding-change · block | D4† (adolescent case only) |
| M21 | Rewrite `{"op":"eq","value":true}` as `{"op":"in","value":[true]}` | `rules.json` | B2+B6 · block | D5 (over-report guard — classifier must not claim equivalence) |
| M22 | Delete the `op` key from an `eq` leaf | `rules.json` | B13 op-omission · review (+ schema violation once CCF-4 fixed) | D5 |
| M23 | Leaf `value` `true`→`"true"` | `rules.json` | B4 value-type-change · block | D1 |
| M24 | Leaf `value` `2`→`2.0` | `rules.json:2768` | B5 value-format-change · note | D5 (false-positive guard) |
| M25 | `Q-002` leaf `op` `missing`→`falsy` | `rules.json:2477` | B2 · block | D2† (`hb: 0` case) |
| M26 | `Q-NORMO-HIGH-001.output.priority` `10`→`90` | `rules.json:2753` | C6 priority-change · review | D3 |
| M27 | A note rule's `output.type` `note`→`alert` (+`severity: informational`) | `rules.json` | C1 output-type-change · block | D2 |
| M28 | `IMF-001.when` → `{}` | `rules.json:2192` | B14 empty-condition · block | D2 (fires on every case) |
| M29 | Add unknown key `"weight": 3` to a rule's `output` | `rules.json` | A7 unknown-key-add · block (fail-closed) | D5 |
| M30 | `inherited-marrow-failure.defaultNextSteps` — remove "Refer to pediatric hematology/genetics…" | `candidates.json:304` | D5 default-next-step-remove · block | D1† (**no current example reaches this candidate** — CCF-3) |
| M31 | `marrow-failure-infiltration.summary` gains a reassurance clause | `candidates.json:254` | D4 candidate-summary-change · review | D4 |
| M32 | `beta-thalassemia-pattern.label` → a string sorting before `thalassemia-pattern`'s | `candidates.json:60` | D3 candidate-label-change · review (**not** cosmetic — `ruleEngine.js:147`) | D3 (on a level+score tie) |
| M33 | Remove an id from a candidate's `evidence[]` | `candidates.json` | D8 · block | D4 |
| M34 | Add a candidate no rule references | `candidates.json` | D1 candidate-add · review | D5 |
| M35 | Delete `thalassemia-pattern` while a rule still targets it | `candidates.json:44` | D2 candidate-remove · block (+`validate-kb` error) | D1 (fabricated `{label:id, summary:''}`, `ruleEngine.js:71`) |
| M36 | Set a candidate's object key out of sync with its `.id` | `candidates.json` | D9 key-id-mismatch · block (+`validate-kb` error) | D1 |
| M37 | Remove the ferritin-threshold line from `AAP2026_IDA.supports[]` | `evidence.json` | E5 evidence-record-content-change · block | D5 (provenance-only — must be labelled as such) |
| M38 | Change `CDC2025_LEAD.url` in the JS registry only | `src/evidence.js:68` | **BLIND** (E6, outside `modules/**`) | D5 (UI-visible only) |
| M39 | Delete `BSH2020_G6PD` from `src/evidence.js` only | `src/evidence.js:90` | **BLIND** → caught by the E7 set-equality invariant | D5 (chips silently vanish, `app.js:162`) |
| M40 | `hbLower` `11`→`10.5` in the 6-<24mo female band | `reference-ranges.json:15` | F1 range-value-change · block | D1† |
| M41 | `maxMonthsExclusive` `72`→`71` | `reference-ranges.json:29` | F2 band-boundary-change + continuity invariant · block | D1† (71.5mo: total classification loss) |
| M42 | Swap the `female`/`male` sub-objects in one band | `reference-ranges.json:12-27` | F5 sex-field-transposition · block | D1†+D2† |
| M43 | `units.hb` `"g/dL"`→`"g/L"`, values unchanged | `reference-ranges.json:3` | F6 units-change · block | D5 |
| M44 | Top-level `source` `"AAP2026_IDA"`→`"LOCAL_LAB"` | `reference-ranges.json:2` | F7 range-source-change · block | D4 (`provenance.*.source`) |
| M45 | Land M05 with `knowledgeBaseVersion` unchanged | `module.json` | G2 version-omission · block (**invariant**, not a hunk) | inherits M05 |
| M46 | `approvedBy: []`→`["ARC clinical council"]` | `module.json:12` | G3 attestation-change · block (CLAUDE.md: named humans only) | D5 |
| M47 | `supportedAgeMonths.max` `216`→`240` | `module.json:9` | G4 manifest-declarative-change · review | D5 (unenforced — `facts.anemia.js:26-28`) |
| M48 | `evaluateLeaf`'s `gte` case `>=`→`>` | `src/ruleEngine.js:25` | **BLIND** (H1) | D1† (boundary case) |
| M49 | `hemolysisMarkerCount >= 2`→`>= 3` | `facts.anemia.js:76` | **BLIND** (H3) | D1 (`hemolysis-hs.json`) |
| M50 | `bll >= 3.5`→`> 3.5` | `facts.anemia.js:82` | **BLIND** (H3) | D1† (exactly-3.5 case; the current example uses 8.2) |
| M51 | Rename derived fact `hemolysis.markerCount`, `rules.json` untouched | `facts.anemia.js:298` | **BLIND** (H4) — caught by the template/fact-path invariant | D1 (leaf silently false + `"not supplied"` prose) |
| M52 | Paired: M05 **and** remove a leaf from a related alert's `all` | `rules.json` (2 hunks) | B1 · block **and** B9 · review — neither hunk alone reveals it | D1 (probe-only; FN-7) |

Mutations M38, M39, M48–M52 are the FN-3/FN-7 tests: the classifier is *expected* to report clean, so
EP-5-T4's assertion for those rows is inverted — the probe (or a Part 3 invariant) must fail while
`kb-diff` passes, and the cross-check must classify the pair correctly rather than treating the clean
structural report as an all-clear.

---

## Adversarial second lens (EP0-T4)

**Authoring model**: `gpt-5.6-terra`, reasoning effort `xhigh`, via `codex exec` (read-only sandbox).
An initial `gpt-5.6-sol` run at the same effort was attempted first and **failed** — it exited after
~400s without writing output; the fallback run succeeded. Raw transcript retained at
`/Users/miethe/.claude/jobs/fc2ff3fd/tmp/ep0-t4-codex.md`.

**Mandate**: "find a safety-relevant change this classifier misses." Silence was explicitly ruled out
as an acceptable output. The reviewer was given the independently verified corpus-coverage fact
(30/91 rules with an activation witness; 61 never firing, including `ALERT-001/-002/-003/-006/-007/-008`)
and was told `kb-behavior-probe.mjs` does not exist — it is a design in this document only.

**Result: five concrete gaps found (M53–M57), none of them a restatement of FN-1…FN-10.**

### (a) Taxonomy gaps — 2 found

1. **`G5 metadata-only` is mis-tiered for safety test bindings.** G5 classifies `requiredTestCaseIds`
   as cosmetic → `note`, yet the release loop depends on those bindings to prove an affected rule was
   tested. Deleting the sole binding for an emergency rule leaves it without its designated regression
   witness, and an empty array vacuously satisfies "all IDs resolve."
2. **`src/engine.js` output projection has no Family-H class.** H1–H8 do not cover it (H8 is scoped to
   `app.js`), and `src/engine.js` is on the not-diffed list. Filtering emergency alerts in the output
   projection changes both the API and browser result without touching rule evaluation, fact
   derivation, ranges, merging, or ranking — so no change record and no tiered review is triggered.

### (b) Probe corpus blindness — confirmed by execution

The reviewer ran the six fixtures with an in-memory mutation of `ALERT-001.output.type` from `alert`
to `note` and observed **all six fingerprints unchanged**. For a child with
`symptoms.respiratoryDistress: true`, that edit removes the emergency channel and the "do not delay
stabilization" instruction, leaving only a note.

### (c) Seeded-corpus gap

No row among M01–M52 tests **B7 fact-repoint** — a `rules.json` leaf repointed to a *different but
valid* fact. M51 is an H4 code-side rename and M16 changes a candidate destination; neither covers it.
B7 is block-tier precisely because a wrong-but-valid path fails evaluation silently.

### (d) Double-blind "both green, patient harmed" — VERIFIED IN THIS REPO

Deleting the `menstruating === true` early branch in `modules/anemia/ranges.js:41-43` drops a
menstruating patient under 144 months from the 30 ng/mL ferritin threshold to 20 ng/mL.

- The **structural classifier is blind**: `ranges.js` is outside the JSON diff scope (H5).
- The **behavioral probe is also blind**: the only menstruating fixture (`anemia-inflammation.json`)
  is 168 months old, so it still resolves to 30 via the *adolescent* branch. The other five fixtures
  set `menstruating: false`.

**Orchestrator verification (executed, not asserted).** The mutation was applied to a working copy and
the engine re-run:

- **0 of 6 golden fixtures changed.** Both proposed checks report clean.
- For a menstruating 120-month patient with ferritin 25 (otherwise modeled on `ida-toddler.json`),
  matched rules changed from `[NOTE-003, ID-001, ID-006, LEAD-002, Q-MICRO-004, Q-MICRO-005]` to
  `[ID-006, LEAD-002, Q-MICRO-003, Q-MICRO-004, Q-MICRO-005]`.

**Correction to the reviewer's stated consequence**: it claimed the iron-deficiency pattern
"disappears." It does not — the `iron-deficiency-anemia` label survives via `ID-006`. What is actually
lost is `ID-001` (the confirmatory meets-defined-pattern rule) and `NOTE-003`, replaced by the
`Q-MICRO-003` data-request prompt. The finding stands and is still safety-relevant — a confirmed
pattern is silently downgraded to a provisional one for a supported input class — but the mechanism is
an evidential downgrade, not a pattern deletion.

### New seeded-corpus rows for EP-5-T4

| # | Mutation | File / site | Expected class · tier | Expected Δ |
|---|---|---|---|---|
| M53 | Remove `ALERT-001.requiredTestCaseIds: ["CASE-ALERT-001-INSTABILITY"]` | `rules.json`, rule `ALERT-001` (proposed P1-WP4 field) | new `protective-test-binding-remove` · **block** (currently G5 · note) | D5 |
| M54 | Filter `ruleOutput.alerts` to omit `severity === "emergency"` | `src/engine.js:27` | new `H9 engine-output-projection-change` · **block** | D1 (`marrow-red-flags` loses `ALERT-009`) |
| M55 | `ALERT-001.output.type` `alert` → `note` | `rules.json:79` | C1 output-type-change · **block** | D1†; the current six fixtures incorrectly produce D5 |
| M56 | `ALERT-007.when.fact` `lead.level45Plus` → `lead.level20to44` | `rules.json:225` | B7 fact-repoint · **block** | D1† at ≥45 µg/dL; D2† at 20–44 |
| M57 | Remove the all-menstruating-patients 30 ng/mL branch | `modules/anemia/ranges.js:41-43` | **BLIND** (H5); must be a release-blocking code diff | D1† for a <144-month menstruating, ferritin 20–30 case |

**Most severe: M57.** It is the only one that leaves *both* proposed checks green while patient-facing
output changes for a supported input class — the exact failure mode Part 2's backstop exists to prevent.

### Implication for EP-5 sequencing

M55 and M57 are both blind for the same root cause: **the probe can only witness what its corpus
exercises, and the corpus is silent for 61 of 91 rules.** Building the behavioral backstop before
widening the corpus would ship a safety net with a two-thirds hole. EP-5-T4's corpus work should be
treated as a prerequisite of the probe, not a companion to it.

---

## OQ-7 — council-review pass: performed 2026-07-19/20; **closed with caveats**

### Honesty boundary — read before anything else in this section

This was a **synthetic adversarial review**. It satisfies the charter's *process* requirement for a
`council-review` pass on RQ2 (Method §5, overall exit criterion (2)). It is **not** clinical
validation, **not** credentialed clinical review, **not** local-laboratory approval, and **not**
release authorization. Nothing in it may be used to populate `clinicalApprovers[]`, `approvedBy[]`,
`module.json` attestation fields, or any waiver's `approvedBy` list — those require named,
credentialed, independent humans, and ARC cannot mint one. Certification state remains `pending`;
`clinical_release_status` remains `blocked`; every accepted finding routes to a named human owner
role and none is closed by the run.

### Run record

| Field | Value |
|---|---|
| ARC run | `arc-run-2026-07-19-spike-005-rq2-decision-function` |
| Artifact bundle | `agentic-research/runs/2026-07-19-spike-005-rq2-decision-function/` (13 artifacts + 10 reviewer files) |
| Council | `pediatric-anemia-clinical-review-council@0.1.0` |
| RunSpec | `examples/arc-runspecs/spike-005-rq2-decision-function.runspec.yaml` |
| Target digest | `a2eeaa079b4d6698fc22fe1e94eeec48ecdc4969aad59cb408965a9e02d960b1` — this SPIKE **pre-amendment**, at commit `e69d307`, clean tree |
| Evidence manifest | `pediatric-anemia-evidence-sources@0.1.0` @ `f4c33c8…b711f6`, metadata only |
| Validation | `arc validate` exit `0` |
| Scorecard recommendation | `pause_and_validate` |
| Pediatric council recommendation | **`rejected`** — for RQ2's decision function *as written* |
| Findings | 5 critical · 15 high · 9 medium · 2 low · 3 info — 28 accepted, 2 rejected, 1 disputed, 3 watchlist |

### Verdict

**RQ2's decision function as currently written must not be implemented against.** That is not a
verdict on the whole SPIKE: the council actively tried to break the RQ3 structural algorithm and
could not, and it recorded the design's sound properties explicitly so remediation cannot trade them
away. The path forward is targeted revision plus a re-run, not abandonment.

**The constructed false negative (ARC-001, critical, executed).** Softening
`ALERT-001.output.detail` — an `emergency`-severity alert for potentially unstable symptomatic
anemia — classifies as `C10 display-text-change`, routes through RQ2 rule 5 to `tier: 'review'`, and
therefore does not fail the release gate, which fires only on `tier: 'block'` (`:598-600`). The
behavioral probe is simultaneously blind: executed, **all six committed fixtures produce identical
fingerprints**, because `ALERT-001` has no activation witness. The cross-check cannot fire, because
its precondition is `summary.cosmeticOnly === true` (`:813-817`) and a review-tier entry falsifies
it. Executed for a 36-month-old with hemoglobin 6.5 and respiratory distress, the emergency alert's
clinician-facing explanation is replaced while both proposed checks report clean. **This is strictly
more severe than M57**, which needed a code edit outside the classifier's scope; this one needs none.

The other four critical findings show the same shape from different directions: `sameNumericValue`
is undefined and sits at the head of the branch deciding cosmetic-versus-block, where under the
natural cross-type implementation `true → 1` emits `B5 · note` while permanently disabling any of
the 241 `eq`-with-boolean leaves (ARC-002); Family E — seven classes plus an invariant plus FN-6 plus
mutations M38/M39 — is written against a `src/evidence.js` structure **deleted in commit `2d1e5cd`,
the same commit that added this SPIKE** (ARC-003); the cross-check is armed almost never (ARC-004);
and the menstruating subgroup is doubly blind while the corpus has no activation witness for any
emergency or urgent alert (ARC-005).

### What survived, and must be preserved by any revision

Recorded as ARC-028 so the remediation below cannot be read as licence to weaken the design:

1. **Rule 7's unconditional fail-closed to `block`** for any unresolved class. This removes the
   silent-pass residual bucket that is the usual root cause of this failure mode.
2. **Skeleton-before-leaf comparison** (RQ3 Step 0). It genuinely defeats the `all`/`any` swap and
   negation-parity attacks, which are invisible to leaf-multiset comparison.
3. **Enum-grounded severity** — using the existing `LEVEL_RANK`/`ALERT_RANK` rather than a new
   vocabulary, so the tiering cannot drift from the ranking the engine applies.
4. **The mandatory `scope.filesNotDiffed` + `blindSpotWarning`.** The best human-factors decision in
   the design. The finding against it is that the inventory is incomplete, not that it is wrong.

Also upheld: **RQ3's algorithm and both hand-simulations** (exit criterion (3) met; a candidate
finding alleging inconsistency was tested and **rejected**, ARC-029), and **`F6 units-change`'s
grounding and `block` tiering** (a candidate finding by analogy with the `A5`/`D7` failures was
tested and **rejected**, ARC-030).

### RA-1 … RA-9 — required amendments before EP-5 implements against RQ2

| ID | Amendment | Closes |
|---|---|---|
| **RA-1** | Add a **protective-output text class tiered `block`** covering any change to `title`, `detail`, `actions`, `cautions`, `nextSteps` or `support` on a rule whose output is protective — regardless of edit shape, including in-place edits of array elements. | ARC-001, ARC-010 |
| **RA-2** | **Define `sameNumericValue` normatively** and invert RQ3 Step 1 so the `typeof` comparison runs **before** the numeric comparison. Add seeded mutations `true→1`, `false→0`, `2→"2"`, `2→2.0`. | ARC-002, ARC-031 |
| **RA-3** | Give **`tier: 'review'` a real gate**, or fold it into `block`. Minimum viable repair: make `check:release` fail on `summary.clean === false`, activating the already-written `changeRationale` predicate (`:601-604`), which today no command consumes. | ARC-006 |
| **RA-4** | **Define `cosmeticOnly`**, including for an empty changeset, and **re-quantify the cross-check per `ruleId`** rather than per changeset: fail when `kb-diff` reported no block-tier change for a rule while the probe reports `D1`/`D2`/`D3`/**`D4`** for that same rule. The join key already exists (`:605-607`). | ARC-004 |
| **RA-5** | Remove **`A5`** and **`D7`** from `FIXED_COSMETIC` and restate the cosmetic test as *"not on any clinician-facing or API surface"* — `rule.category` is rendered and searched at `src/app.js:406,412`, and candidate `category` is spread onto the assess API response (`src/ruleEngine.js:71-81`) and asserted in `tests/golden/ida-toddler.json:29`, so editing it **fails `npm test` today**. | ARC-007, ARC-008 |
| **RA-6** | **Normalize the class-id representation.** Rule 5 tests bare ids (`'C9'`) while rules 3/4/6 test full ids (`'C3 level-change'`) and RQ4 emits the full form. Under a literal reading rule 5 never fires and its `containsTemplate` C11 escalation never executes. State which form is normative. | ARC-011 |
| **RA-7** | **Rewrite Family E against HEAD.** `src/evidence.js` is a 28-line loader over `modules/anemia/evidence.json`; `scripts/validate-kb.mjs:59-68` is a comment recording the drift check's removal. Re-valence `E5` as behaviorally live (it reaches `GET /api/v1/knowledge-base` and the SPA citation chips); retire `E6`/`E7` or redefine `E7` against the **three-way** version drift that does exist across `module.json`, `modules/anemia/index.js` and `evidence.json`; replace M38 and M39. | ARC-003, ARC-020 |
| **RA-8** | **Propagate the second lens's own findings** into the normative text: remove `G5` from `FIXED_COSMETIC`, add `protective-test-binding-remove` at `block`, add `H9 engine-output-projection-change`, and make an empty `requiredTestCaseIds` array **fail** the resolve check rather than satisfy it vacuously. Correct the class count from **44 to 70**. | ARC-012, ARC-021 |
| **RA-9** | **Extend `outputIsProtective()`** to `question` outputs (all 17 — the missing-data prompts) and to any candidate rule that is the sole contributor to its `candidateId`; wrap it so a throw is treated as `block`. It currently excludes **47 of 91 rules**. The *tier calibration itself* is referred to a credentialed reviewer — see OQ-12. | ARC-009 |

Corpus and scope amendments that gate the **probe** rather than the classifier: build the corpus
**before** the probe with per-subgroup coverage (ARC-005, ARC-017); add a mutation row for each of
the **19 unmutated classes** (ARC-015); state that the seeded corpus has no denominator and cannot
support a rate claim (ARC-016); regenerate `filesNotDiffed` from the import graph — it omits
`src/engine.js`, `modules/anemia/index.js`, `src/ranges/registry.js`, `src/facts/core.js` and
`src/algorithmExplorer.js` (ARC-013); scope-rename the `unclassifiable-residue` invariant, which
under rule 7 can never increment and passes most strongly for the most dangerous change class
(ARC-014); and name the local-range override and site-profile subsystem in `blindSpotWarning`
(ARC-019).

### New open questions raised by the council

- **OQ-8** — `tier: 'review'` has no defined enforcement, and the `clean` predicate that would supply
  one is consumed by no command. Deciding *what `review` means operationally* is a governance choice
  this SPIKE never made. RA-3 proposes the minimum repair; the broader question — whether a
  three-tier model is worth keeping at all once `review` is enforced — is open.
- **OQ-9** — The cross-check is quantified over **changesets**, so one unrelated review-tier edit
  anywhere in a commit disarms it. RA-4 proposes per-`ruleId` re-quantification, but that has not
  been designed against the report shape and may interact badly with `invariants[]`, which are
  whole-after-state properties with no rule id.
- **OQ-10** — Recording a clinical approval is itself a `G3 attestation-change`, which is
  fixed-dangerous and `block`. The release gate is therefore **circular**: every release that records
  approvals emits a block-tier change requiring an approval that does not yet exist. A change-level
  approval record distinct from `G3` must be defined (ARC-026).
- **OQ-11** — No class or invariant covers a cited source being **retracted or superseded upstream**
  with no local diff. The KB already carries the vocabulary (`year`, `recencyNote`,
  `priority: "primary-current"`, `reviewedThrough`) and `scripts/lib/local-applicability.mjs` already
  implements exactly this check for *local laboratory profiles*. Whether it can be automated within
  the microsite's no-third-party posture was **not substantiated**; it may have to be a scheduled
  human or `rf` task (ARC-018).
- **OQ-12** — **Referred to a named credentialed pediatric hematology reviewer, with the safety and
  human-factors owner.** The Pediatric Hematology seat **abstained** rather than guess on: (a) the
  tier for narrowing edits on `question`-type outputs versus candidate-level downgrades, and (b) the
  tier for *broadening* edits on emergency alerts, where a missed escalation trades against alert
  fatigue. The abstention was preserved and not overridden by the adjudicator. ARC cannot resolve it.
- **OQ-13** — RQ4's `contentHash` computation is unspecified, and `scripts/build-static.mjs:35-49`
  already digests the module tree byte-wise. If `contentHash` is computed the same way, a
  fixed-cosmetic reformat will produce `cosmeticOnly: true` alongside a changed `contentHash`, and
  reviewers must be told that is expected. Bears on `clinicalContentHash` in the DEF-4/SPIKE-006 work
  (ARC-033).
- **OQ-14** — The site-laboratory profile subsystem (`scripts/lib/local-applicability.mjs`,
  `schemas/reference-range.schema.json`) landed **one commit after** this SPIKE and is outside its
  five-file scope. Whether it enters the diffed scope must be decided **before** it becomes a runtime
  path, not after (ARC-019). Note this also makes CCF-4's "no JSON-Schema validator exists in the
  repo" stale — a homegrown one now does; the narrower "no `ajv`" claim still holds.

### Preserved dissent

**ARC-031 (open).** The informatics seat holds ARC-002 at **critical** on the strength of the
241-of-247 exposed surface under the natural implementation of `sameNumericValue`. The
diagnostic-accuracy seat holds that severity cannot attach to a consequence of an implementation the
document never specifies, and would record the certain part — an undefined predicate at a
note-versus-block branch — at **high**. Both agree the defect is real and blocking. The adjudicator
recorded critical/medium-confidence, the position that fails safe, **without erasing the objection**.
It closes by specification (RA-2), not by argument.

### Status

**OQ-7 is closed with caveats.** The process gate is satisfied — the pass was performed, the run
validates, and the artifacts are durable. The substantive outcome is a **rejection of RQ2 as
written**, so **overall exit criterion (2) remains NOT MET**. Do not record this SPIKE as fully
closed, and do not let EP-5 implement `scripts/kb-diff.mjs` against RQ2 until RA-1…RA-9 land and the
amended digest is re-reviewed. An approval attached to an older digest is stale.
