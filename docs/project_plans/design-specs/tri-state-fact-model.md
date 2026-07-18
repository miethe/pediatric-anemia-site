---
doc_type: design_spec
title: "Tri-State Fact Model"
status: draft
maturity: shaping
created: 2026-07-18
feature_slug: platform-foundation-p0
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
---

# Tri-State Fact Model (DEF-2)

## Problem / Context

`deriveFacts()` (today `modules/anemia/facts.anemia.js`, invoked via `src/facts/registry.js` /
`src/facts.js`) currently derives facts as a mix of `true`, `false`, and `null` — but the `null`
case is overloaded. `null` is used both for "genuinely unknown/not asked" (a question should be
prompted) and, in some derivations, as the fallthrough of a boolean expression that could not be
evaluated because an upstream input was missing. The rule engine (`src/ruleEngine.js`) and the
question-prompting logic in `src/engine.js` currently treat facts as effectively boolean-ish with
`null` meaning "missing," but there is no single, explicit, engine-enforced three-state contract
(`true` / `false` / `unknown`) that every fact and every rule condition is required to honor.

The Deferred Items Triage Table categorizes this as **backlog**, with the reason: formalizing a
tri-state fact model **changes fact semantics** — it is not a structural relocation, it is a
behavior-affecting redesign of how facts are represented and evaluated. Platform Foundation P0's
mandate was explicitly a **zero-clinical-behavior-change** refactor (proven by the byte-identical
golden-fixture equivalence harness in `tests/golden/` + `tests/module-equivalence.test.mjs`); any
change to fact semantics — even one that only clarifies existing behavior — falls outside that
mandate and risks invalidating the equivalence proof for reasons unrelated to the module-boundary
work P0 was chartered to do.

## Current State (what P0 actually shipped)

P0 did not touch fact *semantics* at all — it only relocated fact-derivation code:

- `src/facts.js` is now a 1-line shim: `deriveFacts(input)` calls `deriveFactsForModule(input,
  'anemia')` from the new `src/facts/registry.js`.
- `src/facts/registry.js` is a `Map`-based dispatcher (`REGISTRY.get(moduleId)`) that routes to
  `modules/anemia/facts.anemia.js`'s `deriveFacts`, unchanged in logic — it was moved, not
  rewritten.
- `modules/anemia/facts.anemia.js` still derives facts with the same ad hoc `true`/`false`/`null`
  patterns as before the refactor, e.g. `const ferritinLow = ferritin !== null && ferritinThreshold
  ? ferritin < ferritinThreshold.value : null;` and `const ferritinNotLow = ferritinLow === false;`
  — `null` here means "cannot determine," and downstream code must know to treat `null` as distinct
  from `false`, on a fact-by-fact basis, with no shared helper or type enforcing the distinction.
- `tests/golden/*.json` + `tests/module-equivalence.test.mjs` now permanently pin today's exact
  fact/output values (including today's `null` placements) as the equivalence baseline for every
  future phase — which is precisely why this redesign cannot happen inside a phase that must prove
  byte-identical output.

## Design Sketch

Two complementary pieces, sketched at a shaping level (not yet a committed design):

1. **Explicit tri-state type.** Introduce a shared sentinel/type — e.g. a `Tri = 'true' | 'false' |
   'unknown'` string enum, or a small `{ known: boolean, value: boolean | null }` wrapper — and a
   helper module (candidate location: `src/facts/tristate.js`) that every fact derivation in
   `modules/*/facts.*.js` uses instead of raw `null`. This removes the current ambiguity where
   `null` can mean either "not yet asked" or "computed as indeterminate from present-but-borderline
   inputs."
2. **Rule-engine contract update.** `src/ruleEngine.js`'s `evaluateCondition()` currently treats
   missing/`null` facts as effectively falsy-with-a-question-prompt side channel. A tri-state model
   would make that contract explicit and typed, likely surfacing "unknown" facts as a distinct,
   engine-level condition outcome (not merely "false") so rule authors can distinguish "this
   pattern is ruled out" from "we don't know yet" in the DSL itself, without relying on
   presence/absence conventions.

Migration would need a fact-by-fact audit of every `null` in every module's fact derivation to
classify it as "not asked" vs. "computed indeterminate," which is itself the reason this is
`backlog` and not yet `shaping`-committed — the audit hasn't been done.

## Promotion Trigger

Phase 1 roadmap kickoff (per the Deferred Items Triage Table) — i.e., the first phase of the
broader multi-module expansion roadmap (`docs/project_plans/expansion/01-platform-expansion-
roadmap.md`), once the platform is no longer bound by P0's zero-behavior-change constraint and a
new golden-fixture baseline can be established under a deliberate, reviewed behavior change.

## Open Questions

- Does the tri-state model live only in fact-derivation output, or does it also need to be
  threaded through `data/algorithm-explainers.json` and any UI code that renders fact state?
- Is the audit of existing `null` usages done per-module (anemia only, at first) or does it need a
  cross-module taxonomy up front, given a second module (CBC/cytopenia suite) is the next planned
  consumer?
- Should "unknown" facts change candidate ranking/output at all, or purely change question-
  prompting behavior — this is a clinical-safety-adjacent question (missingness must never be
  treated as normal, per CLAUDE.md) that needs explicit design review, not just an engineering
  decision.
- How does this interact with DEF-3 (exact-passage evidence schema) — do tri-state facts need
  their own evidence/rationale trace distinct from candidate-level evidence citations?
- Does the golden-fixture harness need a parallel "tri-state baseline" fixture set once this ships,
  or does the existing harness get superseded entirely for the affected modules?
