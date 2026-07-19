---
schema_version: 2
doc_type: spike
title: "SPIKE-003: Tri-State Fact Model Migration"
status: completed
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

---

## Census (re-verified — method: fresh `grep`/AST walk over the worktree, not the charter's
cached numbers)

All commands and raw output are preserved under `/Users/miethe/.claude/jobs/fc2ff3fd/tmp/`
(throwaway scratch, not committed; includes `field-refs.txt`, `migration-table-raw.txt`,
`run-output-final.txt`, and the `proto/` prototype tree used for RQ2/RQ3/RQ7 below).

**56 explicit fact fields — confirmed exact match to the charter.** `grep -oE
"(history|symptoms|exam)\.[a-zA-Z]+" modules/anemia/facts.anemia.js | sort -u` returns exactly 56
paths: 36 `history.*`, 15 `symptoms.*`, 5 `exam.*`.

**Correction — the true load-bearing field count is 60, not 56.** `modules/anemia/facts.anemia.js`
`history: { ...history, bleedingHistory, ... }` (`:363-377` in the pre-edit file, spread on `:364`)
spreads **every** key the client sent under `input.history` straight into the output, unchanged —
this is a raw passthrough, not something `deriveFacts()`'s body ever names explicitly. `symptoms`
and `exam` have no equivalent spread (`:348-356`, `:357-362` are closed object literals) — this
asymmetry is real, not a grep artifact. Cross-referencing `modules/anemia/rules.json`'s `when`
conditions turns up **4 more `history.*` paths that are referenced directly by rules and never
appear anywhere in `facts.anemia.js`'s source**: `history.adherenceVerified`, `history
.leadExposureRisk`, `history.ongoingBloodLossKnown`, `history.priorAdequateIronTrialNoResponse`
(consumed by `IRIDA-001` ×3 and `LEAD-002`/`Q-MICRO-004` ×1). A grep over `facts.anemia.js` alone
— the charter's own stated method — cannot find these; they only surface by also grepping
`rules.json`. **This means "enumerate the known 56 fields" (RQ4) is already wrong today** — the
schema would need at least 60, and the open-ended `history` spread means a new rule can introduce
a 61st tomorrow with zero corresponding `facts.anemia.js` change and zero test failure. This is the
single most consequential finding of the census — see RQ4.

**`isTrue()` call sites: 10, not conflated with `countTrue()`.** The charter's line list
(`facts.anemia.js:75, 96, 99-106, 108-115, 117-127, 129-134, 143-147, 149-154, 191-197`) is
actually the **`countTrue()`** site list (confirmed exact match below) — the charter's problem
statement runs the two functions together ("Both collapse ... 9 call sites"). `isTrue()` itself is
called at 10 distinct sites: `:87` (`leukopenia`), `:89` (`neutropenia`), `:91`
(`thrombocytopenia`), `:95` (`thrombocytosis`), `:178-181` (`hemoglobinAnalysis.*` ×4), `:187-188`
(`g6pd.tested*` ×2).

**`countTrue()` call sites: 9 — confirmed exact match to the charter's line numbers**
(`:75, 96, 99-106, 108-115, 117-127, 129-134, 143-147, 149-154, 191-197`). Full inventory (old
formula, constituent count, scope status) is in RQ2.

**Correction — `=== true` direct-comparison collapses: 25 occurrences / 20 lines in
`facts.anemia.js`, not repo-current-state.md's claimed 19; 28 total in `src/` + `modules/`, not
23.** `grep -o "=== true" modules/anemia/facts.anemia.js | wc -l` → 25 (`grep -c`, which counts
matching *lines* not occurrences, gives 20 — five lines each pack two comparisons via `||`:
`:316, 318, 319, 320, 326`). Across `src/` + `modules/`: `facts.anemia.js` 20 lines/25 occurrences,
`src/algorithmExplorer.js` 1, `src/facts/core.js` 1 (this is `isTrue`'s own definition line, not a
call site — real external occurrences are 27), `modules/anemia/ranges.js` 1. This third collapse
pattern (distinct from `isTrue()`/`countTrue()`) covers 17 distinct output facts: `history
.renalSignal`/`liverSignal`/`thyroidSignal` (hybrid — `=== true` OR'd with a `statusIs()` lab
check, `:136-138`), `history.recentViral`, `patient.menstruating`/`recentTransfusion`
/`highAltitude`, `symptoms.activeMajorBleeding`/`jaundiceOrDarkUrine`/`fever`
/`neurologicSymptoms`/`renalSymptoms`/`fatigueOrPallor`, `exam.splenomegaly`/`hepatomegaly`
/`lymphadenopathy`/`petechiaeOrBruising`, `history.oxidantTrigger`/`malariaRisk`
/`medicationMacrocytosisRisk`.

**UI compat check (scope item, `src/algorithmExplorer.js`): confirmed safe, and it is the *only*
such check.** `algorithmExplorer.js:308` is the sole place the UI reads a boolean fact with a
ternary that already degrades safely against tri-state (`facts.morphology.rdwHigh === true ? …
: … === false ? … : 'not classifiable'`) — this fact is already tri-shaped today (`rdwHigh` is
`true | false | null`, RQ1's "computed-indeterminate" case, not a raw booleanMap collapse). A
broader grep (`facts\.(history|symptoms|exam|cbc|g6pd|hemoglobinAnalysis)\.`) over the 631-line
file found no other direct boolean-fact render — the UI only displays numeric CBC values and the
`additionalCytopeniaCount`/`rdwHigh` summaries. **No UI code change is required for P1-WP1.**

**Correction — 49 of 91 rules reference a boolean-collapse fact path, not 33.** Total unique fact
paths referenced across all 91 rules' `when` conditions: **101 — this matches the charter exactly**
(verified via a Python AST walk of `modules/anemia/rules.json`, script in
`/Users/miethe/.claude/jobs/fc2ff3fd/tmp/migration-table-raw.txt`'s header). Of those 101, 45 trace
back to an `isTrue()`/`countTrue()`/`=== true`/raw-passthrough collapse point (42 strict +
3 hybrid `renalSignal`/`liverSignal`/`thyroidSignal`, which OR a boolean collapse with an
already-safe `statusIs()` check) — **49 rules reference at least one of them.** I could not
reconstruct a definition that lands on exactly 33: restricting to rules whose *every* hit is in the
raw `history.*`/`symptoms.*`/`exam.*` namespace (excluding derived `cbc.*`/`g6pd.*`
/`hemoglobinAnalysis.*`/`patient.*` facts that trace to the same collapse) gives 25, not 33 either.
**Recommend the charter's "33" be treated as superseded by this SPIKE's 49** — every rule in the
49-row table below is affected because the *wire type* of its referenced fact changes from JS
boolean to a tri-state string, regardless of whether the charter's narrower count included it.

---

## Findings by research question

### RQ1 — Default state semantics: narrow or suppress?

**Decision: neither answer is uniform — the correct rule is indexed by (rule output type × branch
role), not a single global policy.** Built as a decision table against `evaluateCondition()`'s
existing `all`/`any`/`not` structure (`src/ruleEngine.js:39-49`, unchanged by this migration) and
verified against real rules, not reasoned in the abstract:

| Rule output type | Branch role (today's syntax) | `not-assessed` behavior | Rationale |
|---|---|---|---|
| `candidate` | rule-in (`eq:true` / new `is-present`) | Does **not** satisfy → this rule doesn't fire, candidate gets none of its points/support. | Unchanged from today (undefined already `!== true`). No fabricated support from missing data. |
| `candidate` | ordinary rule-out / scoring input (`not:{eq:true}` used as one of several `all` conditions, e.g. `AINF-002`) | Does **not** satisfy the positive form → same net effect as today (`not{eq:true}` on undefined was already `true`, i.e. "not-assessed passes the exclusion" — preserved via the new `not:{op:'is-present'}`, proven equivalent below). | **Narrows, does not suppress**: the candidate can still surface via other evidence; missingness never removes it from `rankedDifferential`. |
| `candidate` | **exclusion gate for a differential-of-exclusion pattern** (a rare/serious alternative diagnosis whose whole rationale is "we didn't find X, Y, Z") — 2 concrete cases found: `TEC-001`'s `not:{any:[exam.splenomegaly, exam.hepatomegaly, exam.lymphadenopathy, smear.blasts]}` and `IRIDA-001`'s `not:{history.ongoingBloodLossKnown eq:true}` | **Recommend tightening to strict `is-absent` per constituent** (require confirmed-absent, not merely not-present) — a deliberate behavior change from today. | Today, an unexamined abdomen (`exam.splenomegaly` never assessed) lets `TEC-001` (transient erythroblastopenia, a benign diagnosis of exclusion) surface exactly as if organomegaly were *confirmed* absent — a textbook "missingness treated as normal" case CLAUDE.md's guardrail exists to prevent, since the excluded alternatives (marrow infiltration/malignancy) are the dangerous misses. Same logic for `IRIDA-001` (rare, already flagged `cautions: "...only after common causes...are excluded"`). **This is a real behavior change, not preservation** — routes through `council-review` per the Method step 5 / RQ3 exit criterion, and needs a companion `question`-type rule prompting for the missing exam/history finding (gap noted in Risks — no such question rule exists today for either case). |
| `question` | gate that prompts when data is absent/unknown (`eq:false` today, e.g. `Q-MICRO-005`, `Q-NORMO-HIGH-002`) | **`not-assessed` should satisfy the gate** (keep prompting) — migrate to `not:{op:'is-present'}`, not strict `is-absent`. | The entire purpose of a question rule is to close missingness. A naive `eq:false → is-absent` translation would **silently stop prompting** for the truly-unknown case — the opposite of intended. Confirmed as a live risk, not hypothetical: these are exactly the two rules in the 91 that use non-negated `eq:false` on an in-scope fact. |
| `alert` (safety) | rule-in only — no alert in the current 91 rules uses a rule-out branch | Does not satisfy → alert doesn't fire. | Already safe by construction (alerts never "prove safety" from missing data); the gap is that missingness on a safety-relevant symptom gets no dedicated question-prompt today in every case — flagged in Risks, not fixed here. |

**Matches roadmap `:177`** ("not-assessed can never satisfy a rule-out branch") for the two
starred exclusion-gate cases; for the other 47 rules, the roadmap phrase is honored in spirit
(missingness never manufactures a *false negative* that removes an active candidate) while
preserving today's actual, already-shipped behavior for ordinary multi-factor scoring conditions.

### RQ2 — countTrue() re-expression under three states

**Decision, per aggregate** (all 9 `countTrue()` sites; old formula `values.filter(Boolean).length`
crossed against `values.filter(v => toTri(v)==='true').length` — `countPresent()` in the
prototype's `src/facts/tristate.js`):

| Aggregate (line) | Constituents | Old formula | New formula | Changes matching? |
|---|---|---|---|---|
| `additionalCytopeniaCount` (`:96`) | 3 (`leukopenia`,`neutropenia`,`thrombocytopenia`, each already a hybrid `isTrue(flag) \|\| numeric-threshold`) | `countTrue([...]) ` (raw count, then `> 0` at `:97`) | `countPresent([...])`; `> 0` collapse unchanged in *type* but now legitimately 0-with-full-data vs 0-with-gaps are distinguishable via a new `cbc.*Tri` field per constituent | **Y** — the numeric branch is already null-safe, so only the pure-flag branch (`localFlags.*` unset) changes from "counts as absent" to "counts as unknown". Prototyped as `neutropeniaTri` — see RQ3 evidence. |
| `instability` (`:99-106`) | 6 raw `symptoms.*` | `countTrue([...]) > 0` | `triAggregate([...])`: `'true'` if `countPresent>0`; `'false'` only if **every** constituent is assessed and none present; else `'unknown'` | **Y** — today, "none of 6 symptoms reported" and "none of 6 symptoms ever asked" both collapse to the literal boolean `false`. This is the exact `ALERT-001` gating fact — see RQ1's `alert` row (safe by construction, since `is-present` still won't fire on `'unknown'`), but the derived fact itself is now honest. |
| `bleedingHistory` (`:108-115`) | 6 (5 `history.*` + `symptoms.activeMajorBleeding`) | same `>0` collapse | same `triAggregate()` | **Y** — drives `LOSS-001`/`LOSS-002` (rule-in, unaffected) and `Q-MICRO-005`/`Q-NORMO-HIGH-002` (rule-out/question gate — RQ1's dedicated row). |
| `ironRiskHistory` (`:117-127`) | 9 (8 `history.*` **+ `bleedingHistory` itself, nested**) | `countTrue([...]) > 0` | `triAggregate([...])` **but the nested `bleedingHistory` input must be `countPresent`/`===  'true'`-aware, never raw `Boolean()`-coerced** | **Y, and this is a concrete migration hazard, not just a formula swap**: if `bleedingHistoryTri` (a non-empty string like `'unknown'`) is fed into the *old* `countTrue()`/`.filter(Boolean)` unchanged, JS truthiness makes `'unknown'` count as **present** (any non-empty string is truthy) — silently corrupting `ironRiskHistory` in the wrong direction (over-counting risk, not under-counting). Not exercised by the prototype run (I converted `bleedingHistory`'s sibling `instability` and `bleedingHistory` in isolation, not nested), but caught by re-reading the source with tri-state substitution in mind. **Flag as a must-fix migration-checklist item for whoever implements P1-WP1**: every nested aggregate-of-aggregate needs its inner call site swapped from `countTrue`/`Boolean()` to `countPresent`/`=== 'true'` in the same commit, or the fixture diff will silently pass while the actual risk score is wrong. |
| `chronicInflammation` (`:129-134`) | 4 raw `history.*` | `>0` collapse | `triAggregate()` | **Y** — same pattern as `instability`. |
| `familyHemoglobinopathy` (`:143-147`) | 3 raw `history.*` | `>0` collapse | `triAggregate()` | **Y** |
| `knownChronicHemolyticDisease` (`:149-154`) | 4 raw `history.*` | `>0` collapse | `triAggregate()` | **Y** |
| `congenitalMarrowFailureSignals` / `marrow.congenitalSignalCount` (`:191-197`) | 5 raw `history.*` | **raw count**, not `>0`-collapsed — consumed via `gte 1` in `IMF-001`/`IMF-DBA-001` | **Decision: stays a raw present-count, unchanged in shape** (`countPresent([...])`, which behaves identically to today's `countTrue()` for this specific call site since both already exclude falsy/undefined the same way) — **explicitly excludes not-assessed fields**, same as today. A new companion fact `marrow.congenitalSignalsFullyAssessed` (`allAssessed([...])`) is added so a future question-prompt can distinguish "0 of 5 confirmed, but 3 never asked" from "0 of 5, all 5 confirmed absent" — **prototyped, but consumed by zero rules today; flagged as P1-WP1 follow-up scope, not required for the `gte 1` rules to keep working.** | **N for `IMF-001`/`IMF-DBA-001`'s existing `gte 1` check** — no rule change needed there; **Y is a new capability**, not a behavior change. |
| `hemolysisMarkerCount` (`:75`) | 3 (`bilirubinHigh`, `ldhHigh`, `haptoglobinLow`) — all `statusIs()`-derived from `labs.*Status` **enum** fields, not raw booleanMap | `>0.5`-style (`>= 2`) collapse at `hemolysis.pattern` | **Out of this SPIKE's scope** | N/A — flagged, not solved: `statusIs()` has the *same structural defect* (`'unknown'`/`'normal'` both collapse to `false`), but the charter's scope is explicitly booleanMap-sourced facts (36+15+5+4 fields), not lab-status-enum-sourced ones. This is a real, near-identical missingness gap the charter doesn't cover — recommend a P1-WP1 follow-up ticket, not silently treating it as solved by this SPIKE. |

**9 sites total, matching the census exactly: 5 straightforward raw-booleanMap `>0` aggregates, 1
hybrid (`additionalCytopeniaCount`), 1 nested-aggregate hazard (`ironRiskHistory`), 1 raw-count
special case (`congenitalMarrowFailureSignals`, explicitly answered per its own exit-criterion
ask), 1 explicitly out-of-scope (`hemolysisMarkerCount`).**

### RQ3 — Golden-fixture survival + approval path

**Prototype result (real code, not reasoning): all 6 golden fixtures survive an *atomic* migration
byte-identically (modulo `generatedAt`); a *partial/staged* migration silently breaks one.**

Method: copied `modules/anemia/facts.anemia.js`, `src/ruleEngine.js`, `modules/anemia/rules.json`,
`modules/anemia/ranges.js` + deps into `/Users/miethe/.claude/jobs/fc2ff3fd/tmp/proto/` (untouched
originals imported directly from the real worktree paths for the "before" side of every diff — no
repo file was ever modified). Added `src/facts/tristate.js` (`toTri`/`countPresent`/`anyUnknown`
/`allAssessed`), 4 new `evaluateLeaf()` cases (`is-present`/`is-absent`/`is-unknown`
/`is-not-assessed`, the last two as aliases — see RQ7), and tri-state twins for 7 representative
facts spanning every collapse pattern found in the census (`symptoms.instabilityTri`,
`history.bleedingHistoryTri`, `cbc.neutropeniaTri`, `exam.splenomegalyTri`, `history.pica`,
`history.adherenceVerified`, `marrow.congenitalSignalsFullyAssessed`), run against all 6
`examples/*.json` and a deliberately-stripped `ida-toddler.json` variant. Driver:
`/Users/miethe/.claude/jobs/fc2ff3fd/tmp/proto/run.mjs`; full output in
`/Users/miethe/.claude/jobs/fc2ff3fd/tmp/run-output-final.txt`.

Findings:

1. **The 6 golden fixtures are already sparse.** Each `examples/*.json` populates only 4-11 of the
   60 boolean fields (`anemia-inflammation.json` 7, `beta-thalassemia-trait.json` 4,
   `hemolysis-hs.json` 7, `ida-toddler.json` 9, `lead-capillary.json` 5, `marrow-red-flags.json` 11)
   — confirmed by running the prototype's tri-state instrumentation against the *unmodified*
   example JSON: `symptoms.instabilityTri`, `history.bleedingHistoryTri`,
   `history.adherenceVerified` all came back `'unknown'` on every single one of the 6 fixtures. This
   means the migration's visible effect (facts that used to be `false` becoming `'unknown'`) shows
   up on today's real regression fixtures immediately, not just in a hypothetical future case —
   raising the stakes on getting RQ1's narrow-vs-suppress table right before P1-WP1 lands.
2. **A staged rollout (fact shape changes before the referencing rules do) breaks a real
   fixture, silently.** First prototype pass converted `history.pica`'s wire *type* (raw JS boolean
   → tri-state string) while leaving `LEAD-002`/`Q-MICRO-004`'s `eq:true` syntax untouched. Result:
   `ida-toddler.json`'s ranked differential lost the `lead-exposure-associated-anemia` candidate and
   its confirmatory question entirely — `'true' === true` is `false` in JS, so the old literal
   silently stopped matching, with **zero error, zero warning, zero test failure** (the rule engine
   fails open on a non-matching leaf, by design — `default: throw` only fires on an unrecognized
   *operator name*, not a type mismatch on the value). This is concrete proof that **fact-shape and
   rule-operator migration must land as one atomic change** — not incrementally, not fact-file-then-
   rule-file — for exactly the reason RQ7's exit criterion demands a complete table, not a sample.
3. **After patching `LEAD-002`/`Q-MICRO-004` to the new `is-present` operator in the same commit**
   (the atomic case), re-running all 6 examples: `any original-rule-matching diff across all 6
   full-data examples: false` — ranked differential, matched-rule-id set, and alert/question output
   are byte-identical to the unmodified engine for every fixture.
4. **Narrow-not-suppress confirmed empirically on the stripped-field case**: deleting `symptoms`
   entirely and 5 of 6 `history` bleeding fields from `ida-toddler.json` produced `BEFORE candidates:
   ['iron-deficiency-anemia']` / `AFTER candidates: ['iron-deficiency-anemia']` — identical. The
   already-supported candidate was never suppressed by the added missingness, and no new false
   candidate appeared. No crash.
5. **`not:{op:'is-present'}` is proven equivalent to today's `not:{eq:true}` on an unknown/undefined
   value** — exercised directly against `evaluateCondition()`: `not:{is-present}` on tri `'unknown'`
   → `true`; old `!(undefined === true)` → `true`. Match. This is the concrete proof behind RQ1's
   "ordinary rule-out" row and behind `IRIDA-001`'s negated branch needing a *deliberate* deviation
   (RQ1) rather than being a behavior-preserving no-op like the other 46 rules.

**Approval path** (RQ3's second half): per the charter's Method step 5, any rule where this SPIKE
recommends a **behavior change** (the `TEC-001`/`IRIDA-001` exclusion-gate tightening, RQ1) must go
through `council-review` (the safety council, roadmap AOS wiring `:230`) before
`scripts/capture-golden.mjs` is re-run to accept new baselines for those two fixtures'
outputs — this SPIKE does **not** self-approve that change; it only identifies and scopes it. The
other 47 rules are behavior-preserving by the proof above and do not need a new golden baseline,
only the mechanical `eq:true`/`not:{eq:true}` → `is-present`/`not:{is-present}` rewrite.

### RQ4 — booleanMap: stay open or enumerate 56 fields?

**Decision: stay open (`additionalProperties`), do not enumerate — with an explicit mitigation,
per the exit criterion's own bar ("stay open with no mitigation is not acceptable").**

Rationale, directly from the census correction above: enumerating "the 56 known fields" would be
**wrong on day one** — it would omit the 4 fields (`history.adherenceVerified`,
`history.leadExposureRisk`, `history.ongoingBloodLossKnown`, `history.priorAdequateIronTrialNoResponse`)
that 3 real rules already depend on, breaking schema validation for any client that currently sends
them (all 3 rules are exercised by no golden fixture today, so this gap is currently silent and
would only surface as a production regression). More fundamentally, the `history: { ...history,
... }` spread (`facts.anemia.js:364`) is an intentional open extension point — `symptoms`/`exam`
are closed (whitelisted) by contrast, an asymmetry this SPIKE surfaces but does not recommend
closing (closing the `history` spread is a real behavior change to what rule authors can already do
without a `facts.anemia.js` edit, out of this SPIKE's scope).

**Mitigation** (the exit criterion's required alternative to "stay open with nothing"):
`scripts/validate-kb.mjs` gains a new check — every `fact` path referenced in any `when` condition
across `modules/anemia/rules.json` whose root segment is `history`/`symptoms`/`exam` must resolve
to either (a) a field explicitly read in `modules/anemia/facts.anemia.js`'s body (grep-detectable,
same technique used for this census), or (b) a field on a maintained allow-list of intentional
open-passthrough fields (seeded with the 4 found above). This closes today's silent-typo risk
(a rule author misspelling `history.pica` as `history.picca` gets a hard validate-kb failure instead
of a rule that silently never fires) without freezing the schema's genuinely-open shape. Concretely
new scope for P1-WP4/WP6, not implemented in this SPIKE (design decision only, per Method step 4).

### RQ5 — Wire-compat for plain-boolean callers

**Decision: non-breaking. Accept bare JSON booleans (auto-upgraded) alongside the new tri-state
string literal; no schema-version bump, no `openapi.yaml` structural change.**

Concrete file-by-file impact, verified (not asserted) by reading each:

- **`examples/*.json` (6 files)**: **zero changes needed.** `grep -c '"[a-zA-Z]*": (true|false)'`
  confirms every example already only ever sends bare `true`/`false` (never an object wrapper,
  never an explicit `null`) — 4 to 11 occurrences per file (see RQ3). Any field not sent is already
  omitted, which is exactly what "not-assessed" means going forward.
- **`tests/engine.test.mjs`** (101 lines): no direct construction of `history`/`symptoms`/`exam`
  payloads found (`grep` for those prefixes plus `true`/`false` returns nothing) — it tests
  `getBuiltInRange`/range logic, not booleanMap facts. **Zero changes needed.**
- **`scripts/smoke-test.mjs`** (99 lines): loads `examples/ida-toddler.json` verbatim and posts it
  to `/api/v1/assess`, asserting only on `rankedDifferential`/`provenance.matchedRuleIds` shape —
  no boolean-field-specific assertions. **Zero changes needed** (inherits example-file compat above).
- **`openapi.yaml`**: the `POST /api/v1/assess` request body is `$ref: './schemas/patient-input
  .schema.json'` (`openapi.yaml:57`) — it does not duplicate the `booleanMap` shape inline, so
  updating the schema file's `$defs` is sufficient; **no independent `openapi.yaml` edit is
  required** beyond what WP1 already touches.
- **`server.mjs`'s public contract**: unaffected at the transport level (still JSON over HTTP);
  the only change is what the request-body schema *accepts* for `symptoms`/`history`/`exam` values,
  which is additive (booleans still validate) not subtractive.

**Wire representation decision** (needed to make "auto-upgrade" concrete): the tri-state type is a
**string enum `'true' | 'false' | 'unknown'`** — identical at the wire layer and the internal facts
layer (no separate `{state: 'present'|'absent'}` object wrapper), matching DEF-2's already-settled
sketch exactly and avoiding a second vocabulary. `schemas/patient-input.schema.json`'s `booleanMap`
`$def` becomes `additionalProperties: { "anyOf": [{"type":"boolean"}, {"type":"string","enum":
["true","false","unknown"]}] }`. **Implementation detail surfaced only by building the prototype**:
`toTri()` must explicitly pass through an already-tri-shaped string (`if (value === 'true' || value
=== 'false' || value === 'unknown') return value;`) before falling through to the `undefined`/
`null` default — the prototype's first draft omitted this and would have silently mapped a
forward-compatible client's `"true"` string to `'unknown'`. Flagged as a concrete P1-WP1
implementation checklist item, not just a design note.

### RQ6 — SPIKE-003 vs. DEF-2: reduce or merge?

**Decision: confirms the charter's own pre-recorded recommendation — reduce, do not merge.** Having
now done the audit, the case is stronger than it looked at charter-authoring time: DEF-2's
type-shape sketch (`Tri = 'true'|'false'|'unknown'`) is exactly what this SPIKE's prototype
implemented and validated end-to-end (RQ3's empirical proof), so re-deriving it would have been
pure duplication. But every substantive finding in this document — the corrected 60-field/49-rule
census, the nested-aggregate hazard (`ironRiskHistory`), the atomic-migration proof, the
`TEC-001`/`IRIDA-001` exclusion-gate tightening, the `history`-spread open-passthrough discovery,
the `hemolysisMarkerCount` out-of-scope flag — is new research DEF-2 explicitly declined to do
("did **not** do a fact-by-fact audit... to classify as not-asked vs. computed-indeterminate").
**Action**: promote DEF-2's frontmatter `maturity: shaping` → `committed`, with this SPIKE's
Findings section as the promotion evidence. (Not performed here — this SPIKE's write access is
scoped to this file only; recorded as a P1-WP1 kickoff action item.)

### RQ7 — New operators + 33/49-rule migration table

**(a) Operator semantics** — 4 `case` branches added to `evaluateLeaf()`'s `switch`
(`src/ruleEngine.js:21-36`), prototyped and tested at
`/Users/miethe/.claude/jobs/fc2ff3fd/tmp/proto/src/ruleEngine.js`:

```js
case 'is-present': return actual === 'true';
case 'is-absent': return actual === 'false';
case 'is-unknown':
case 'is-not-assessed': return actual === 'unknown';
```

**Naming reconciliation (a decision, not an oversight)**: the charter's exit criterion names 4
operators (`is-present`/`is-absent`/`is-unknown`/`is-not-assessed`) but DEF-2's already-settled type
has only 3 states. Rather than inventing a 4th state to justify a 4th distinct operator, `is-unknown`
and `is-not-assessed` are implemented as **synonyms resolving to the same `state === 'unknown'`
check** — both spellings are accepted at the rule-authoring layer (a rule author can use whichever
reads better for a given rule's intent — "we don't know" vs. "this was never assessed" — with zero
semantic difference), while the machine-checked type stays 3-valued. The existing fail-closed
`default: throw new Error('Unknown rule operator: ...')` (`:35`, now shifted a few lines) is
preserved unchanged for any op name not in this list — verified in the prototype (unrecognized ops
still throw; not a silent no-match).

**(b) Migration table — complete for all 49 identified rules (supersedes the charter's "33").**
Full per-rule output (rule id, output type, every in-scope leaf's current condition → recommended
new condition) generated from `modules/anemia/rules.json` and preserved verbatim at
`/Users/miethe/.claude/jobs/fc2ff3fd/tmp/migration-table-raw.txt`. Default translation for every
leaf: `{fact, op:'eq', value:true}` → `{fact, op:'is-present'}`; `{not:{fact, op:'eq', value:true}}`
→ `{not:{fact, op:'is-present'}}` — both proven behavior-preserving in RQ3. Deviations from the
default (flagged individually, both requiring `council-review` per RQ3):

| Rule ID | Output type | Deviation from default translation | Narrows or suppresses under `unknown`? |
|---|---|---|---|
| `Q-MICRO-005` | question | `{fact:'history.bleedingHistory', op:'eq', value:false}` → `{not:{fact:'history.bleedingHistoryTri', op:'is-present'}}` (**not** strict `is-absent`) | Narrows in the safe direction — keeps prompting on `unknown`, preserving today's behavior exactly (see RQ1's `question` row). |
| `Q-NORMO-HIGH-002` | question | Same pattern, same fact | Same as above. |
| `TEC-001` | candidate | `not:{any:[exam.splenomegaly, exam.hepatomegaly, exam.lymphadenopathy, smear.blasts]}` → tightened to `all:[splenomegaly is-absent, hepatomegaly is-absent, lymphadenopathy is-absent]` (`smear.blasts` stays `not:{is-present}` — smear findings are opt-in reported, not a booleanMap field, out of this SPIKE's fact scope) | **Suppresses** (deliberately) — TEC no longer surfaces on an unexamined abdomen; requires confirmed-absent organomegaly/lymphadenopathy. **Behavior change, routes to `council-review`; needs a companion `question` rule (gap, not built here).** |
| `IRIDA-001` | candidate | `not:{fact:'history.ongoingBloodLossKnown', op:'eq', value:true}` → tightened to `{fact:'history.ongoingBloodLossKnown', op:'is-absent'}` | **Suppresses** (deliberately) for the same reason as `TEC-001` — a rare, already-cautioned diagnosis should require confirmed-absent ongoing blood loss, not merely "not confirmed present." **Behavior change, routes to `council-review`.** |

All other 45 rules use only the default, behavior-preserving translation (full per-leaf listing in
the scratch file cited above) — spanning every output type (`alert` ×5, `note` ×3, `candidate` ×30,
`question` ×7).

**If the 6h timebox had expired before this table was complete**: it did not — the table above is
the full 49-row set, not a partial one. No `SPIKE-003b` follow-up is needed for the table itself.
Follow-up work items that *are* real (see Implications): the companion question-rules for
`TEC-001`/`IRIDA-001`'s tightened gates, the `history`-spread allow-list mitigation (RQ4), and the
`hemolysisMarkerCount`/`statusIs()` out-of-scope flag (RQ2).

---

## Recommended design

1. **Type**: `Tri = 'true' | 'false' | 'unknown'` string enum, identical at the wire and internal
   facts layer (RQ5) — `src/facts/tristate.js` exports `toTri(value)`, `countPresent(values)`,
   `anyUnknown(values)`, `allAssessed(values)`. `toTri()` must pass through already-tri-shaped
   strings, not just coerce raw booleans (RQ5 implementation note).
2. **Rule engine**: 4 new `evaluateLeaf()` cases — `is-present`/`is-absent`/`is-unknown`
   /`is-not-assessed` (last two are synonyms) — additive to the existing `switch`, fail-closed
   default preserved (RQ7a).
3. **Fact derivation**: every `isTrue()` (10 sites), `countTrue()` (9 sites, 8 in-scope + 1
   `hemolysisMarkerCount` flagged out-of-scope), and `=== true` (25 occurrences/17 distinct facts)
   collapse point in `modules/anemia/facts.anemia.js` is rewritten to produce a `Tri` value instead
   of a JS boolean, using `triAggregate()` for the 5 straightforward `>0`-collapse aggregates, the
   hybrid pattern for `additionalCytopeniaCount`'s numeric/flag mix, and — critically —
   `countPresent()`/`=== 'true'` (never `countTrue()`/`Boolean()`) for `ironRiskHistory`'s nested
   consumption of `bleedingHistory` (RQ2's flagged hazard).
4. **Rules**: all 49 rows of the migration table (RQ7b) land in the **same commit** as the fact
   changes — RQ3's prototype proved a staged rollout silently breaks matching with zero test
   failure.
5. **Schema**: `booleanMap` stays `additionalProperties`-open, gains an `anyOf` accepting both bare
   booleans and the tri-state string literal (RQ5), plus a `validate-kb.mjs` open-passthrough
   allow-list check (RQ4) seeded with the 4 hidden fields this census found.
6. **Golden fixtures**: 47 of 49 affected rules require no new baseline (behavior-preserving,
   proven in RQ3). `TEC-001`/`IRIDA-001`'s tightening is a real output change on any fixture that
   exercises them — route through `council-review` before `scripts/capture-golden.mjs` re-baselines.

---

## Alternatives considered

- **Object wrapper `{ known: boolean, value: boolean | null }`** (DEF-2's alternate sketch).
  Rejected: the string-enum form is what the prototype actually implements and validates, requires
  no change to `getPath()`'s dot-path traversal (`src/ruleEngine.js:11-16`), and keeps the wire and
  internal representations identical (RQ5) rather than needing a serialize/deserialize step.
- **A uniform "unknown never satisfies a rule-out branch" policy applied mechanically to all 49
  rules** (the charter's own RQ1 phrasing, read literally). Rejected after building the migration
  table: this would silently break `Q-MICRO-005`/`Q-NORMO-HIGH-002`'s intentional
  prompt-on-unknown behavior — a real functional regression the RQ1 decision table above avoids by
  indexing on rule output type, not just branch polarity.
- **Enumerating the 56-field `booleanMap` now** (RQ4's literal exit-criterion default). Rejected:
  provably incomplete on day one (misses the 4 hidden `history.*` passthrough fields 3 live rules
  depend on) — the open-with-allow-list mitigation is the only option that doesn't ship a known bug.
- **Closing the `history` object's `...history` spread** (making `history` as closed/whitelisted as
  `symptoms`/`exam`). Considered but deferred: it would fix the open-passthrough asymmetry at the
  root, but it's an independent behavior change (removes a capability rule authors currently rely
  on for 4 fields) outside this SPIKE's charter scope — flagged as a candidate for a future
  consistency pass, not adopted here.
- **A four-state Tri type** (adding a distinct `'not-assessed'` state alongside `'unknown'` to
  literally match all 4 named RQ7 operators). Rejected: no concrete rule or fact in the audited 91
  needs to distinguish "raw field never sent" from "computed-indeterminate from present-but-
  borderline data" as two different *rule-matchable* states today — DEF-2 flags this distinction as
  a real conceptual one, but operationalizing it as a 4th enum value with no consumer would be
  speculative scope, not something this SPIKE's evidence supports.

---

## Risks & open questions

- **Nested-aggregate hazard (RQ2, `ironRiskHistory`)**: any future aggregate-of-aggregates in this
  or a future module must be migrated with its inner call sites, in the same review — a partial
  patch that swaps the outer aggregate's formula but leaves an inner `countTrue()`/`Boolean()` call
  against a tri-state string will silently over-count (`'unknown'` is JS-truthy). Recommend a
  dedicated `scripts/validate-kb.mjs` or lint check flagging any `countTrue`/`Boolean()` call whose
  argument list includes a fact path that is itself a `Tri`-typed derived fact — not built in this
  SPIKE (design-only per Method step 4).
- **`statusIs()`-derived facts have the same structural defect, explicitly out of scope**
  (RQ2/RQ4): `hemolysisMarkerCount`/`hemolysis.pattern` and every other `statusIs(labs.X, 'high')`-
  style fact collapses `'unknown'` and `'normal'` lab statuses identically, for the same
  "missingness treated as normal" reason CLAUDE.md's guardrail flags for booleanMap facts. Not
  fixed here because the charter's scope is explicitly the 56(+4)-field booleanMap surface — but
  it's a near-identical latent gap. Recommend a P1-WP1 or P1-WP2 follow-up ticket, not silent
  acceptance.
- **`TEC-001`/`IRIDA-001` tightening needs companion question rules** (RQ1/RQ7b): suppressing these
  candidates on unassessed exam/history findings without also prompting the clinician to go assess
  them would net-negative the user experience (candidate silently vanishes with no explanation).
  Concrete, named follow-up: two new `question`-type rules gating on the same tightened facts,
  authored alongside the `TEC-001`/`IRIDA-001` rule edits and passed through the same
  `council-review` pass.
- **DEF-3 interaction, flagged not designed** (per charter scope): DEF-2's own open question — do
  tri-state facts need their own evidence/rationale trace, distinct from candidate-level evidence
  citations — is unresolved. `exact-passage-evidence-schema.md` (DEF-3) is about *rule* citations,
  not fact *provenance*; whether "this fact is `'unknown'` because the client never sent it" vs.
  "…because the value was present but a computed comparison couldn't resolve it" ever needs its own
  citable trace is a P1-WP3 planning input, not answered here.
- **`history`-spread asymmetry is a design smell, not just a census artifact**: `symptoms`/`exam`
  are closed whitelists; `history` alone is open via `...history`. No functional bug results today
  (the 4 hidden fields work correctly, just invisibly), but it means any future rule author can grow
  the `history` boolean-field surface without touching `facts.anemia.js` at all — the
  `validate-kb.mjs` allow-list (RQ4) mitigates the silent-typo risk but does not close the
  asymmetry itself.
- **`countPresent`/`toTri`/`allAssessed` naming is prototype naming, not committed**: production
  implementation should confirm final names against DEF-2's committed maturity promotion (RQ6)
  before P1-WP1 code review, in case DEF-2's promotion process surfaces a different preferred
  vocabulary.

---

## Implications per work package

- **P1-WP1 (tri-state fact model)** — direct, hard block, now unblocked: adopt the `Tri` type
  (Recommended design §1), the 4 new `evaluateLeaf()` operators (§2), the corrected 60-field/49-rule
  scope (not 56/33), the `triAggregate()`/nested-aggregate-hazard-aware rewrite of all 9
  `countTrue()` sites (RQ2), the full 49-row migration table (RQ7b) landing atomically with the
  fact-derivation changes (RQ3's proof), and the `validate-kb.mjs` open-passthrough allow-list
  (RQ4). The `TEC-001`/`IRIDA-001` tightening and its 2 companion question rules should be split
  into their own reviewed sub-PR gated by `council-review`, separate from the other 47
  behavior-preserving rules, so the safety-relevant change gets isolated scrutiny rather than being
  buried in a 49-rule bulk diff.
- **P1-WP6 (expanded test corpus)** — now genuinely unblocked (was a hard block per the roadmap):
  property/dangerous-miss suites can be authored against the `Tri` shape directly, using this
  SPIKE's RQ1 decision table as the source of truth for which branch types must/must not be
  satisfiable by `'unknown'`. The `TEC-001`/`ironRiskHistory`-nesting/`statusIs()` risks above are
  good candidates for the dangerous-miss suite's first fixtures, since they're concrete, already-
  identified gaps rather than hypothetical ones.
- **P1-WP4 (rule metadata)** — the `validate-kb.mjs` allow-list check (RQ4) and the migration
  table's per-rule edits (RQ7b) both touch `modules/anemia/rules.json` in the same phase; recommend
  sequencing WP1's rule edits first (they change `when` semantics) and WP4's metadata additions
  second, in the same PR or immediately after, to avoid a second uncoordinated pass — matching the
  charter's original soft-dependency note.
- **P1-WP3 (exact-passage evidence)** — inherits one open question, not a design: whether
  tri-state fact values need their own provenance/rationale trace distinct from rule-level evidence
  citations (Risks, DEF-3 interaction). Recommend WP3 planning explicitly accept or defer this
  rather than discovering it mid-implementation.
- **DEF-2 (`tri-state-fact-model.md`)** — promote `maturity: shaping` → `committed` using this
  SPIKE as the audit evidence (RQ6); this SPIKE does not perform that edit (file-scope restricted to
  this document).

---

## Go/no-go: can P1-WP1/EP-1 start coding directly from this SPIKE?

**Go, with two named exceptions carved out for a separate reviewed sub-change.**

All 7 RQs have a recorded decision with rationale, not an assertion (above). The census is
re-verified with `file:line` citations and corrects the charter's numbers where they were wrong
(60 fields not 56, 49 rules not 33, 25/20 `=== true` occurrences not 19, 10 `isTrue()` sites
distinct from 9 `countTrue()` sites). The migration table (RQ7b) is **complete, not partial** — all
49 rows, not a sample — so the 6h timebox's pivot clause is not invoked. The type shape, operator
semantics, and 8 of 9 aggregate formulas are proven end-to-end against real code and all 6 golden
fixtures (RQ3), including a concretely-identified failure mode (staged rollout) and its fix
(atomic rollout). Two genuine open items remain and should be split out rather than gating the rest
of P1-WP1:

1. **`TEC-001`/`IRIDA-001`'s exclusion-gate tightening** is a deliberate, safety-motivated behavior
   change this SPIKE identified but did not get clinical sign-off for — it must go through
   `council-review` before merging, separately from the other 47 rules, and needs its 2 companion
   question rules authored (currently a gap).
2. **The `hemolysisMarkerCount`/`statusIs()` missingness gap** (RQ2/RQ4) is a near-identical,
   real defect this SPIKE found but did not fix (out of charter scope) — needs its own follow-up
   ticket so it doesn't get silently treated as "covered by SPIKE-003."

Everything else — the type, the operators, the schema shape, the wire-compat decision, the 45
behavior-preserving rule edits, the nested-aggregate-hazard checklist item — is ready for direct
implementation without a second design pass.

---

## RQ7(b) — Full 49-row migration table (durable copy)

**Provenance note (added by the EP-0 orchestrator at phase sign-off).** The reviewer gate found this
table — the SPIKE's own stated exit artifact ("the table, not a sample, is the exit artifact") — was
referenced only by a pointer to a machine-local agent scratch path, i.e. it did not exist anywhere a
future session, machine, or agent could reach. It is reproduced here in full so P1-WP1 can implement
against it. Every one of the 49 rule IDs below was validated to exist in `modules/anemia/rules.json`
(91 rules) at the time of writing.

Reading the last column: each entry is a boolean-collapse leaf in the rule's `when` condition, in the
form `factPath[currentOperator:value]->postMigrationOperator`. `is-present` is the tri-state operator
that replaces a bare `=== true` / `eq: true` equality check, and — per RQ1 — an `unknown` value must
NOT satisfy it.

| # | Rule ID | Output type | Boolean-collapse leaf → post-migration operator |
|---|---|---|---|
| 1 | `ALERT-001` | alert | `symptoms.instability[eq:True]->is-present` |
| 2 | `ALERT-002` | alert | `symptoms.activeMajorBleeding[eq:True]->is-present` |
| 3 | `ALERT-004` | alert | `cbc.multilineageCytopenia[eq:True]->is-present` |
| 4 | `ALERT-006` | alert | `cbc.thrombocytopenia[eq:True]->is-present`<br>`symptoms.renalSymptoms[eq:True]->is-present`<br>`symptoms.neurologicSymptoms[eq:True]->is-present` |
| 5 | `ALERT-009` | alert | `cbc.neutropenia[eq:True]->is-present`<br>`symptoms.fever[eq:True]->is-present` |
| 6 | `NOTE-004` | note | `g6pd.testedDuringAcuteHemolysis[eq:True]->is-present`<br>`g6pd.testedSoonAfterTransfusion[eq:True]->is-present` |
| 7 | `NOTE-005` | note | `patient.recentTransfusion[eq:True]->is-present` |
| 8 | `NOTE-006` | note | `patient.highAltitude[eq:True]->is-present` |
| 9 | `ID-002` | candidate | `history.ironRiskHistory[eq:True]->is-present` |
| 10 | `ID-005` | candidate | `history.ironRiskHistory[eq:True]->is-present` |
| 11 | `ID-006` | candidate | `history.ironRiskHistory[eq:True]->is-present` |
| 12 | `AINF-002` | candidate | `history.chronicInflammation[eq:True]->is-present` |
| 13 | `AINF-004` | candidate | `history.chronicInflammation[eq:True]->is-present` |
| 14 | `THAL-001` | candidate | `cbc.rbcRelativelyHigh[eq:True]->is-present`<br>`history.familyHemoglobinopathy[eq:True]->is-present` |
| 15 | `THAL-002` | candidate | `cbc.rbcRelativelyHigh[eq:True]->is-present` |
| 16 | `THAL-BETA-002` | candidate | `hemoglobinAnalysis.betaGlobinPositive[eq:True]->is-present` |
| 17 | `THAL-ALPHA-001` | candidate | `hemoglobinAnalysis.hbBartNewbornScreen[eq:True]->is-present` |
| 18 | `THAL-ALPHA-002` | candidate | `hemoglobinAnalysis.alphaGlobinPositive[eq:True]->is-present` |
| 19 | `LEAD-002` | candidate | `history.leadExposureRisk[eq:True]->is-present`<br>`history.pica[eq:True]->is-present` |
| 20 | `LOSS-001` | candidate | `history.bleedingHistory[eq:True]->is-present` |
| 21 | `LOSS-002` | candidate | `history.bleedingHistory[eq:True]->is-present` |
| 22 | `LOSS-003` | candidate | `symptoms.activeMajorBleeding[eq:True]->is-present` |
| 23 | `HEM-002` | candidate | `symptoms.jaundiceOrDarkUrine[eq:True]->is-present` |
| 24 | `HS-002` | candidate | `exam.splenomegaly[eq:True]->is-present`<br>`history.knownHereditarySpherocytosis[eq:True]->is-present` |
| 25 | `G6PD-002` | candidate | `history.oxidantTrigger[eq:True]->is-present` |
| 26 | `G6PD-003` | candidate | `g6pd.testedDuringAcuteHemolysis[eq:True]->is-present`<br>`g6pd.testedSoonAfterTransfusion[eq:True]->is-present`<br>`history.oxidantTrigger[eq:True]->is-present` |
| 27 | `SICKLE-001` | candidate | `hemoglobinAnalysis.sicklingHemoglobinDetected[eq:True]->is-present`<br>`history.knownSickleCellDisease[eq:True]->is-present` |
| 28 | `MAL-001` | candidate | `history.malariaRisk[eq:True]->is-present`<br>`symptoms.fever[eq:True]->is-present` |
| 29 | `REN-001` | candidate | `history.renalSignal[eq:True]->is-present` |
| 30 | `TEC-001` | candidate | `cbc.isolatedAnemia[eq:True]->is-present`<br>`history.recentViral[eq:True]->is-present`<br>`exam.splenomegaly[eq:True(negated)]->not:is-present`<br>`exam.hepatomegaly[eq:True(negated)]->not:is-present`<br>`exam.lymphadenopathy[eq:True(negated)]->not:is-present` |
| 31 | `PARVO-001` | candidate | `history.knownChronicHemolyticDisease[eq:True]->is-present`<br>`history.recentViral[eq:True]->is-present` |
| 32 | `MARROW-001` | candidate | `cbc.multilineageCytopenia[eq:True]->is-present` |
| 33 | `MARROW-003` | candidate | `exam.hepatomegaly[eq:True]->is-present`<br>`exam.splenomegaly[eq:True]->is-present`<br>`exam.lymphadenopathy[eq:True]->is-present`<br>`exam.petechiaeOrBruising[eq:True]->is-present` |
| 34 | `COPPER-001` | candidate | `cbc.neutropenia[eq:True]->is-present` |
| 35 | `MACRO-001` | candidate | `history.thyroidSignal[eq:True]->is-present` |
| 36 | `MACRO-002` | candidate | `history.liverSignal[eq:True]->is-present` |
| 37 | `MACRO-003` | candidate | `history.medicationMacrocytosisRisk[eq:True]->is-present` |
| 38 | `IMF-001` | candidate | `cbc.multilineageCytopenia[eq:True]->is-present` |
| 39 | `IMF-DBA-001` | candidate | `cbc.isolatedAnemia[eq:True]->is-present` |
| 40 | `IMF-FANCONI-001` | candidate | `cbc.multilineageCytopenia[eq:True]->is-present`<br>`history.thumbOrRadiusAnomaly[eq:True]->is-present`<br>`history.abnormalSkinPigmentation[eq:True]->is-present`<br>`history.shortStature[eq:True]->is-present` |
| 41 | `MIX-002` | candidate | `patient.recentTransfusion[eq:True]->is-present` |
| 42 | `IRIDA-001` | candidate | `history.priorAdequateIronTrialNoResponse[eq:True]->is-present`<br>`history.adherenceVerified[eq:True]->is-present`<br>`history.ongoingBloodLossKnown[eq:True(negated)]->not:is-present` |
| 43 | `Q-MICRO-003` | question | `hemoglobinAnalysis.hbBartNewbornScreen[eq:True(negated)]->not:is-present`<br>`hemoglobinAnalysis.alphaGlobinPositive[eq:True(negated)]->not:is-present`<br>`hemoglobinAnalysis.betaGlobinPositive[eq:True(negated)]->not:is-present` |
| 44 | `Q-MICRO-004` | question | `history.leadExposureRisk[eq:True]->is-present`<br>`history.pica[eq:True]->is-present` |
| 45 | `Q-MICRO-005` | question | `history.bleedingHistory[eq:False]->not:is-present  [DEVIATION: preserves prompt-on-unknown]` |
| 46 | `Q-NORMO-HIGH-002` | question | `history.bleedingHistory[eq:False]->not:is-present  [DEVIATION: preserves prompt-on-unknown]` |
| 47 | `Q-NORMO-LOW-001` | question | `history.renalSignal[eq:True(negated)]->not:is-present`<br>`history.chronicInflammation[eq:True(negated)]->not:is-present`<br>`cbc.multilineageCytopenia[eq:True(negated)]->not:is-present` |
| 48 | `Q-SMEAR-001` | question | `cbc.multilineageCytopenia[eq:True]->is-present` |
| 49 | `Q-CYT-001` | question | `cbc.multilineageCytopenia[eq:True]->is-present` |
**Scope reminder (RQ7a).** These 49 rules are those referencing at least one of the 45 fact paths that
trace to an `isTrue()`/`countTrue()`/`=== true`/raw-passthrough collapse point, including derived
`cbc.*`/`g6pd.*`/`hemoglobinAnalysis.*` facts — not only the raw `history.*`/`symptoms.*`/`exam.*`
namespace. The charter's "33" is superseded; see the correction note above. An independent
re-derivation by the orchestrator bracketed this figure between 25 (narrowest reading: rules whose
every hit is a raw namespace path) and 88 (broadest: all rules touching any boolean-valued derived
fact), with 33 being the count of rules referencing at least one raw `history.*`/`symptoms.*`/`exam.*`
path. 49 sits inside that bracket; it was not independently reproduced row-for-row.
