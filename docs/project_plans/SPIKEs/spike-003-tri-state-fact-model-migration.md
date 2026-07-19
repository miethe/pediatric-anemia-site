---
schema_version: 2
doc_type: spike
title: "SPIKE-003: Tri-State Fact Model Migration"
status: draft
created: 2026-07-19
feature_slug: wave0-safety-foundation
research_questions:
  - "What is the default state for a field the clinician never touched (not-assessed), and does that state narrow the differential or suppress candidates?"
  - "How do the 9 countTrue() aggregates in facts.anemia.js re-express when a count can include unknowns?"
  - "Do all 6 golden example outputs survive migration, and what is the approval path if they legitimately change?"
  - "Does booleanMap's open-ended additionalProperties shape stay open or become an enumerated list of the 56 known fields?"
  - "What is the wire-compat story for existing callers sending plain booleans?"
  - "Can SPIKE-003 be reduced in scope or merged into the existing DEF-2 design spec?"
  - "What is the decision on the 4 new rule operators and the migration table for the 33/91 rules referencing boolean fact paths?"
complexity: L
estimated_research_time: "6h"
related_documents:
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  - docs/project_plans/design-specs/tri-state-fact-model.md
  - docs/project_plans/design-specs/exact-passage-evidence-schema.md
  - .claude/worknotes/wave0-safety-foundation/repo-current-state.md
---

# SPIKE-003: Tri-State Fact Model Migration

Gates **Phase 1** (P1-WP1, roadmap `docs/project_plans/expansion/01-platform-expansion-roadmap.md:158`).
**P1-WP6 depends on this SPIKE's outcome** (roadmap `:228`, "P1-WP6 depends on WP1") — the
dangerous-miss/property/boundary suites must assert against the *post-migration* fact shape, not
the current boolean one. Companion design spec: `docs/project_plans/design-specs/tri-state-fact-
model.md` (DEF-2, maturity `shaping`).

## Problem statement

`modules/anemia/facts.anemia.js` derives every `history.*`/`symptoms.*`/`exam.*` fact through
`isTrue = (value) => value === true` (`src/facts/core.js:3`) or `countTrue = (values) =>
values.filter(Boolean).length` (`src/facts/core.js:7-9`, 9 call sites: `facts.anemia.js:75, 96,
99-106, 108-115, 117-127, 129-134, 143-147, 149-154, 191-197`). Both collapse `undefined` (never
asked), `false` (asserted absent), and any other falsy value into a single branch. `schemas/
patient-input.schema.json`'s `booleanMap` `$def` (`:114-117`, referenced by `symptoms`/`history`/
`exam` at `:64-66`) is `additionalProperties: { "type": "boolean" }` — no tri-state exists in the
wire contract today. 56 distinct fact paths and 33 of 91 rules (101 distinct fact-path references
total) are affected (repo-current-state.md §B, §G P1-WP1 row).

## What DEF-2 already settles vs. leaves open

DEF-2 (`tri-state-fact-model.md`, maturity `shaping`) already commits to:
- The problem framing: `null` today is overloaded ("not asked" vs. "computed indeterminate from
  present-but-borderline inputs") — settled, do not re-litigate.
- A design sketch: a `Tri = 'true' | 'false' | 'unknown'` enum or `{known, value}` wrapper, in a
  new `src/facts/tristate.js` helper — settled as the *shape direction*, not yet the wire schema.
- A rule-engine contract change: `evaluateCondition()` should surface "unknown" as a distinct
  condition outcome, not folded into falsy — settled direction.
- It explicitly did **not** do "a fact-by-fact audit of every `null` ... to classify as not-asked
  vs. computed-indeterminate" (DEF-2 body, penultimate paragraph) — this audit is exactly this
  SPIKE's job, not a restatement of DEF-2.

DEF-2 leaves open (verbatim from its Open Questions): whether unknown facts change ranking or only
question-prompting (flagged clinical-safety-adjacent, needs explicit review); whether the audit is
per-module or needs a cross-module taxonomy; interaction with DEF-3 (exact-passage evidence); and
whether the golden-fixture harness needs a parallel tri-state baseline. This SPIKE resolves all
four for the anemia module specifically (RQ1, RQ3, and the note below on DEF-3 interaction).

**DEF-3 interaction (exact-passage-evidence-schema.md, DEF-3):** DEF-2's own open question asks
whether tri-state facts need their own evidence/rationale trace distinct from candidate-level
evidence citations. **Out of scope for this SPIKE**: fact-level provenance is a DEF-3/P1-WP3
concern (passage-level evidence is about *rule* citations, not fact *values*). Flag the interaction
point in the SPIKE output so P1-WP3 planning sees it, but do not attempt to design it here.

## Scope

**In scope**: the anemia module's 56 fact fields, the 9 `countTrue()` aggregates, the 33 rules
referencing boolean fact paths in `when`, the `booleanMap`→tri-state schema shape, wire-compat, and
the 4 new rule operators.

**Out of scope**: a second module's fact taxonomy (no second module exists yet, repo-current-state.md
§A); fact-level evidence provenance (DEF-3, above); UI rendering changes in `src/algorithmExplorer.js`
beyond confirming today's `=== true` display check (`:308`) still degrades safely against a
tri-state value (a full UI redesign is not this SPIKE's deliverable, only a compatibility check).

## Research questions & exit criteria

### RQ1 — Default state semantics: narrow or suppress?
Is the default state for an untouched field `not-assessed`, and does a candidate-clearing rule
requiring `is-absent` (never satisfied by `not-assessed`) **narrow** the differential (keep the
candidate active, possibly at lower rank, with a next-question prompt) or fully **suppress** it
(remove it from `rankedDifferential` until assessed)?
**Exit criterion**: a decision table (state × rule-branch-type → engine behavior) covering at least
"rule-out" branches (today implicit via `falsy`/`eq:false`) and "rule-in" branches (today `truthy`/
`eq:true`), explicitly stating that `not-assessed` never satisfies a rule-out branch (matches
roadmap `:177`, "not-assessed can never satisfy a rule out branch") — written as pseudocode against
`evaluateCondition()`'s existing structure (`src/ruleEngine.js:39-49`).

### RQ2 — countTrue() re-expression under three states
For each of the 9 aggregates (`facts.anemia.js:75, 96, 99-106, 108-115, 117-127, 129-134, 143-147,
149-154, 191-197`), is "2 of 5 present" a different fact than "2 present, 3 not-assessed"?
**Exit criterion**: per-aggregate decision recorded in a table with columns `{aggregate name, old
formula, new formula, changes rule-matching? Y/N}` — e.g. does `instability` (`:99-106`, currently
`countTrue([...]) > 0`) become `countPresent(...) > 0` plus a separate `anyNotAssessed` signal that
question-prompting (not candidate ranking) consumes? `congenitalMarrowFailureSignals` (`:191-197`)
is flagged specially: it is the one aggregate that already returns the raw count (not a `> 0`
collapse) and is consumed as a threshold (`marrow.congenitalSignalCount gte 1`, confirmed in
`modules/anemia/rules.json` rules `IMF-001`/`IMF-DBA-001`) — the exit table must state explicitly
whether this count now excludes or includes not-assessed fields.

### RQ3 — Golden-fixture survival + approval path
Do all 6 `tests/golden/*.json` fixtures produce byte-identical output (modulo `generatedAt`) after
migration; if any output legitimately changes, what closes the change?
**Exit criterion**: a pass/fail table for all 6 fixtures under a prototype migration (see Method),
plus — for any fixture whose output changes — a filled `docs/project_plans/design-specs/tri-state-
fact-model.md`-linked review record routed through **`council-review`** (the safety council named
in roadmap AOS wiring, `:230`) before `scripts/capture-golden.mjs` is re-run to accept a new
baseline. A changed golden output with no such record is a hard fail, not a "note and move on."

### RQ4 — booleanMap: stay open or enumerate 56 fields?
**Exit criterion**: an explicit decision + rationale. If closed: the full enumerated list of the 56
field names (extractable via the same grep the current-state brief used:
`history\.[a-zA-Z]+|symptoms\.[a-zA-Z]+|exam\.[a-zA-Z]+` over `facts.anemia.js`) written into
`schemas/patient-input.schema.json`'s replacement `$def`. If open: the specific mitigation adopted
in place of schema-level enumeration (e.g. a `scripts/validate-kb.mjs` cross-check that every field
referenced in any rule's `when` exists in a maintained field registry) — "stay open with no
mitigation" is not an acceptable exit state, since it reproduces today's silent-typo risk at a new
layer.

### RQ5 — Wire-compat for plain-boolean callers
**Exit criterion**: a decision on whether `POST /api/v1/assess` accepts a shorthand (bare `true`/
`false` auto-upgrades to `{state:"present"}`/`{state:"absent"}`) alongside the new `{state:...}`
object shape, or whether this is a breaking change requiring a schema-version bump and `openapi.yaml`
update. Must name every existing caller that would be affected: `examples/*.json` (6 files),
`tests/engine.test.mjs`, `scripts/smoke-test.mjs`, and any external integration implied by
`server.mjs`'s public `POST /api/v1/assess` contract — with a concrete list of which files this
SPIKE's prototype needed to touch to prove the decision, not just an assertion.

### RQ6 — SPIKE-003 vs. DEF-2: reduce or merge?
**Exit criterion**: an explicit written recommendation (see Recommendation section below) — this
question closes as soon as that recommendation is recorded and DEF-2's frontmatter `maturity` field
is updated accordingly (`shaping` → `committed` or left `shaping` with a note).

### RQ7 — New operators + 33-rule migration table
**Exit criterion**: (a) precise semantics for `is-present`/`is-absent`/`is-unknown`/`is-not-assessed`
as new `case` branches in `evaluateLeaf()`'s `switch` (`src/ruleEngine.js:21-36`), preserving the
existing fail-closed `default: throw new Error('Unknown rule operator: ...')` behavior (`:35`) for
anything still unrecognized; (b) a complete migration table — one row per affected rule, of the 33
identified in repo-current-state.md `:155-158` — mapping `{rule id, old op/value pair(s), new
op(s), golden-fixture impact Y/N}`. The table, not a sample, is the exit artifact; a partial table
is only acceptable under the timebox pivot below.

## Method

1. Re-run the grep census from repo-current-state.md (field paths, `countTrue` sites, `=== true`
   sites, affected rules) to get a *current* baseline — do not trust the brief's counts as final if
   any rule/fact code has drifted since 2026-07-19.
2. Build a small, throwaway prototype (not committed as production code) implementing the tri-state
   type + 4 new operators against a **copy** of `facts.anemia.js` and `rules.json` on a scratch
   branch/worktree, to produce real pass/fail data for RQ2/RQ3/RQ7 rather than reasoning in the
   abstract.
3. Run the prototype against all 6 `tests/golden/*.json` inputs; diff scrubbed output.
4. For RQ1/RQ4/RQ5, these are design decisions, not code experiments — resolve via structured
   comparison against ARCH §7's production-additions list and CLAUDE.md's "missingness is never
   treated as normal" guardrail, then record the decision, not a debate transcript.
5. Route the RQ1 (ranking-vs-question-only) and RQ3 (any changed golden output) decisions through
   `council-review` before treating either as final, per roadmap AOS wiring (`:230`).

## Overall SPIKE exit criteria

This SPIKE is closed when: (1) RQ1–RQ7 each have a recorded decision/artifact per their exit
criteria above; (2) the 33-rule migration table is complete (or explicitly partial per the pivot
below, with a named follow-up); (3) the RQ6 reduce/merge recommendation is recorded and DEF-2's
status reflects it; (4) a go/no-go statement exists for whether P1-WP1 can start coding directly
from this SPIKE's output or needs a second design pass.

## Timebox

**Timebox: 6 hours.** If the timebox expires before the full 33-rule migration table (RQ7) is
complete: ship RQ1, RQ2, RQ4, RQ5, RQ6 decisions plus whatever fraction of the migration table is
done, and open a narrowly-scoped follow-up (`SPIKE-003b` or a P1-WP1 sub-task) covering only the
remaining rule-by-rule mapping — do not let an incomplete rule table block the other six decisions
from being consumed by P1-WP1 planning.

## Decision impact

| P1 work package | Blocking? | Default/fallback if this SPIKE is skipped |
|---|---|---|
| P1-WP1 (tri-state fact model) | **Direct, hard block** | Cannot start — WP1's entire scope is this SPIKE's decisions. |
| P1-WP6 (expanded test corpus) | **Hard block** (roadmap `:228`) | Property/dangerous-miss suites would be authored against the old boolean shape and need a full rewrite the moment WP1 lands — skipping this SPIKE means WP6 work is likely wasted. |
| P1-WP4 (rule metadata) | Soft — no direct dependency, but the 33-rule migration table overlaps rule-file edits WP4 also makes | If skipped, WP4 risks a second uncoordinated pass over the same 33 rules. |

**If this SPIKE is skipped entirely**: the fallback is *not* neutral — it means shipping Phase 1
without resolving the missingness/differential-clearing ambiguity CLAUDE.md's hard guardrails flag
("Missingness is never treated as normal"). Recommend treating "skip" as effectively "Phase 1
cannot claim V1/V2 go criteria," not a viable option.

## Recommendation

**Reduce, do not fully merge.** DEF-2 already settles the type-shape direction and helper-module
location; re-deriving those in this SPIKE would be duplicate work. But DEF-2 explicitly does not
attempt the field-by-field/rule-by-rule audit, the countTrue re-expression, the golden-fixture
survival proof, or the operator semantics — that is substantive, distinct research this SPIKE alone
produces. Recommend: (1) treat DEF-2's design sketch as a fixed input, not a re-litigated question;
(2) this SPIKE's output (the migration table, aggregate decisions, and operator semantics) becomes
the artifact that promotes DEF-2 from `maturity: shaping` to a committed design — update DEF-2's
frontmatter and body once this SPIKE closes, rather than keeping two documents that drift; (3) do
not skip this SPIKE on the theory that DEF-2 already covers it — it does not cover the audit, which
is the hard, safety-relevant part.

## Citations

- `docs/project_plans/expansion/01-platform-expansion-roadmap.md:150-231`
- `docs/project_plans/design-specs/tri-state-fact-model.md` (DEF-2)
- `docs/project_plans/design-specs/exact-passage-evidence-schema.md` (DEF-3, interaction note only)
- `.claude/worknotes/wave0-safety-foundation/repo-current-state.md` §B, §G (P1-WP1 row), §F
- `docs/architecture.md` §7, §10
- `src/facts/core.js`, `src/ruleEngine.js`, `modules/anemia/facts.anemia.js`, `schemas/patient-input.schema.json`
