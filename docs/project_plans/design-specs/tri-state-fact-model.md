---
doc_type: design_spec
title: "Tri-State Fact Model"
status: draft
maturity: committed
created: 2026-07-18
updated: 2026-07-19
feature_slug: platform-foundation-p0
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
spike_ref: docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md
---

# Tri-State Fact Model (DEF-2)

> **Promotion note (2026-07-19).** Promoted `shaping` → `committed`. SPIKE-003 (`docs/project_plans/
> SPIKEs/spike-003-tri-state-fact-model-migration.md`) performed the fact-by-fact/rule-by-rule audit
> this spec always deferred, validated the type-shape direction below end-to-end against a real
> prototype and all 6 golden fixtures, and returned a **Go** verdict (two named exceptions, see
> below). This is a **reduce, not merge**: DEF-2 keeps owning the type-shape direction; SPIKE-003
> owns the audit. Do not restate SPIKE-003's migration table, census, or per-RQ findings here —
> follow the pointers.
>
> **Corrected scope (SPIKE-003 Census; charter figures elsewhere in this program are superseded):**
> **60** load-bearing boolean fields, not 56 (SPIKE-003 found 4 additional `history.*` paths
> referenced only by rules, via an open `...history` passthrough spread — see SPIKE-003 Census and
> RQ4); **49 of 91 rules** affected, not 33 (SPIKE-003 Census, "Correction — 49 of 91 rules..."); **25
> `=== true` occurrences across 20 lines** in `facts.anemia.js`, not 19 (SPIKE-003 Census).
>
> **Two exceptions carved out of the Go verdict** (SPIKE-003 Go/no-go): (1) `TEC-001`/`IRIDA-001`'s
> exclusion-gate tightening (RQ1, RQ7b) is a deliberate, safety-motivated behavior change that needs
> `council-review` sign-off plus two companion `question`-type rules (currently a gap) before it
> merges — split into its own reviewed sub-change, not bundled with the other 47 behavior-preserving
> rules. (2) The `statusIs()`/`hemolysisMarkerCount` latent missingness gap (SPIKE-003 RQ2, Risks) is
> a near-identical "missingness collapses to normal" defect in lab-status-enum-derived facts — out of
> this spec's and SPIKE-003's scope (booleanMap facts only) and needs its own follow-up ticket.

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

Two complementary pieces. Originally sketched at a `shaping` level; both are now validated and
committed per SPIKE-003 (see the paragraph below the sketch):

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

Migration needed a fact-by-fact audit of every `null` in the anemia module's fact derivation to
classify it as "not asked" vs. "computed indeterminate" — this spec always deferred that audit
rather than attempting it. **SPIKE-003 has now performed it** (anemia module only, per its scope)
and validated this section's type-shape sketch end-to-end against a real prototype: the **string
enum `Tri = 'true' | 'false' | 'unknown'`**, identical at the wire and internal facts layer, is the
form SPIKE-003 implemented and recommends (SPIKE-003 "Recommended design" §1, "Alternatives
considered"). SPIKE-003 rejected this section's alternate `{known, value}` wrapper sketch — not a
conflict with this spec's direction, since both forms were offered here as open alternatives and
SPIKE-003's job was exactly to settle between them; see SPIKE-003 "Alternatives considered" for the
rationale (no change to `getPath()`'s dot-path traversal, single wire/internal vocabulary). The rule-
engine contract update is similarly settled: 4 new `evaluateLeaf()` cases (`is-present`/`is-absent`/
`is-unknown`/`is-not-assessed`, the last two synonyms for the same 3-valued check) — see SPIKE-003
RQ7(a) for exact semantics and the fail-closed default's preservation.

A cross-module taxonomy is explicitly not attempted yet — SPIKE-003 scoped itself to the anemia
module only, since no second module exists (SPIKE-003 "Out of scope"); this spec's audit-by-module
approach (open question, formerly) is therefore the adopted approach until a second module exists to
generalize against.

## Promotion Trigger

**Fired 2026-07-19.** Phase 1 roadmap kickoff (per the Deferred Items Triage Table) — i.e., the
first phase of the broader multi-module expansion roadmap (`docs/project_plans/expansion/01-
platform-expansion-roadmap.md`) — is the trigger this spec named, and SPIKE-003 (run at that
kickoff, gating P1-WP1/P1-WP6) is the audit + reviewed-behavior-change record that satisfies it: the
platform is no longer bound by P0's zero-behavior-change constraint, and SPIKE-003 RQ3 established
the golden-fixture baseline path (47 of 49 affected rules behavior-preserving with no new baseline
needed; 2 rules — `TEC-001`/`IRIDA-001` — require a `council-review`-gated new baseline before
`scripts/capture-golden.mjs` re-runs). This promotion (`shaping` → `committed`) is that trigger firing.

## Migration audit (pointer, not restated)

The complete per-rule migration table (all 49 affected rules: default translation + the 2 deliberate
deviations) lives in SPIKE-003 RQ7(b) — see `docs/project_plans/SPIKEs/spike-003-tri-state-fact-
model-migration.md`, section "RQ7 — New operators + 33/49-rule migration table". Do not duplicate it
here; consume it directly from the SPIKE when implementing P1-WP1.

## Closed questions (resolved by SPIKE-003)

These were posed as open in this spec's `shaping` draft. Each now has a recorded decision — the
audit, not this spec, is the source of the decision; follow the pointer for full rationale.

- **UI/data-file threading.** Does the tri-state model need to thread through `src/
  algorithmExplorer.js` or other UI code that renders fact state? **Decided: no code change
  required.** SPIKE-003's UI compat check found exactly one boolean-fact render site
  (`algorithmExplorer.js:308`) and confirmed it already degrades safely against a tri-state value
  (it was already effectively tri-shaped). See SPIKE-003 Census, "UI compat check" and Scope
  ("Out of scope" / UI item).
- **Per-module vs. cross-module audit.** Is the `null`-usage audit done per-module (anemia only) or
  does it need a cross-module taxonomy up front? **Decided: per-module, anemia only, for now** — no
  second module exists yet to generalize against; a cross-module taxonomy is explicitly deferred
  until one does. See SPIKE-003 "Scope" ("Out of scope").
- **Ranking vs. question-prompting under "unknown."** Should "unknown" facts change candidate
  ranking/output at all, or purely change question-prompting behavior? **Decided: neither answer is
  uniform** — the correct behavior is indexed by (rule output type × branch role), not one global
  policy; ordinary rule-out/scoring conditions narrow (missingness never suppresses an active
  candidate), question gates keep prompting on unknown, and two named exclusion-gate rules
  (`TEC-001`, `IRIDA-001`) are deliberately tightened to suppress on unassessed data — a genuine,
  safety-motivated behavior change routed through `council-review` (see the promotion note above).
  Full decision table: SPIKE-003 RQ1.
- **Golden-fixture harness fate.** Does the golden-fixture harness need a parallel "tri-state
  baseline" fixture set, or does it get superseded for affected modules? **Decided: neither** — the
  existing `tests/golden/*.json` harness stays, unchanged in mechanism. 47 of 49 affected rules
  reproduce byte-identical output under an atomic migration (proven against a real prototype, all 6
  fixtures); only `TEC-001`/`IRIDA-001`'s deliberately tightened output requires a new,
  `council-review`-gated baseline via `scripts/capture-golden.mjs`. See SPIKE-003 RQ3.

## Open questions (still open — SPIKE-003 flagged, did not resolve)

- **DEF-3 interaction.** Do tri-state facts need their own evidence/rationale trace, distinct from
  candidate-level evidence citations in `exact-passage-evidence-schema.md` (DEF-3)? SPIKE-003
  explicitly scoped this out ("fact-level provenance is a DEF-3/P1-WP3 concern... flag the
  interaction point... but do not attempt to design it here") and left it as a named P1-WP3 planning
  input rather than a decision. See SPIKE-003 "DEF-3 interaction" note and "Risks & open questions."
  This question stays open in this spec until P1-WP3 planning addresses it.
