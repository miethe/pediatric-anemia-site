# SPIKE Leg D — Empirical probe: does omitting unanswered fields change engine output?

> ## ⚠ CORRECTION (2026-07-23, after cross-family review) — read before trusting this leg
>
> **This document originally mislabeled its input source and overstated its coverage.** Corrected by
> an independent `gpt-5.6-terra` review and verified directly:
>
> 1. **`tests/golden/*.json` are OUTPUTS, not inputs.** Their top-level keys are `meta`,
>    `classification`, `alerts`, `rankedDifferential`, `nextQuestions`, `interpretiveNotes`,
>    `limitations`, `provenance` — they contain no `symptoms`/`history`/`exam` at all.
>    `tests/module-equivalence.test.mjs:28-34` reads **inputs from `examples/`** and compares the
>    result against `tests/golden/`. Wherever this leg says "golden fixture," read "example input."
> 2. **Coverage was 1 field, not 6 fixtures.** Across all six `examples/*.json` there is exactly
>    **ONE** explicit `false` in `symptoms`/`history`/`exam` (`examples/anemia-inflammation.json`).
>    The other five contain zero, so the omission transform was a **no-op** on them — they did not
>    exercise the scenario at all. "All 6 identical" was therefore near-vacuous as evidence.
>
> **What survives the correction:** the *structural* argument in "Why it does not reach final output"
> below — all 28 rule conditions over these aggregates use `is-present`, which cannot distinguish
> `'false'` from `'unknown'`. That argument is derived from the rule corpus, not from fixture
> coverage, and it is what actually supports the conclusion. The per-fixture table below does **not**.
>
> **Consequence for the plan:** the "golden identity" gate as originally written runs the existing
> unmodified test and therefore never submits an omitted-key payload — it cannot detect the change it
> is meant to guard. An **executed transform test** over input fixtures (explicit-`false` vs omitted,
> for every booleanMap field and every all-negative aggregate group) is required instead.

**Method.** Throwaway script (outside the repo) imported `assessPediatricAnemia` from `src/engine.js`
and `deriveFacts` from `src/facts.js` (moduleId `anemia`). For each of the 6 example inputs, every key
inside `symptoms` / `history` / `exam` whose value was `false` / `'false'` was **deleted entirely**
(simulating a UI that omits unanswered fields instead of sending `false`). Original vs variant outputs
were deep-diffed. All other sections (`patient`, `cbc`, `labs`, `smear`) were left untouched. No repo
file was modified.

**Baseline sanity.** `node --test tests/module-equivalence.test.mjs` → `# tests 6 / # pass 6 / # fail 0`.

## Per-fixture result

| Fixture | `false` keys removed | `assess()` output |
|---|---|---|
| anemia-inflammation | 1 (`history.heavyMenstrualBleeding`) | **IDENTICAL** |
| beta-thalassemia-trait | 0 | IDENTICAL |
| hemolysis-hs | 0 | IDENTICAL |
| ida-toddler | 0 | IDENTICAL |
| lead-capillary | 0 | IDENTICAL |
| marrow-red-flags | 0 | IDENTICAL |

All 14 triAny/triAll/triNone-derived aggregate facts were unchanged original→variant on all 6
fixtures.

> **Fixture-coverage gap (incidental finding, worth recording):** 5 of 6 goldens contain **zero**
> explicit `false` values anywhere in `symptoms`/`history`/`exam` — the corpus is already authored
> "true-or-absent" and therefore barely exercises the explicit-negative scenario at all.

## Synthetic case — the flip mechanism is real

Because the goldens under-exercise the scenario, a synthetic variant of `ida-toddler.json` set all
6 bleeding-related fields (`history.giBloodLoss`, `heavyMenstrualBleeding`, `recurrentEpistaxis`,
`frequentBloodDonation`, `otherBloodLoss`, `symptoms.activeMajorBleeding`) explicitly `false`, then
applied the omission transform:

```
history.bleedingHistory: "false" -> "unknown"
Final assess() output: IDENTICAL
```

The aggregate **does** flip. `triAny` (`modules/anemia/facts.anemia.js:21-24`) returns a definite
`'false'` only when `allAssessed(values)` holds; once one member becomes `undefined` → `'unknown'`,
it reverts to `'unknown'`. The mechanism is real and reaches the facts object — it simply does not
surface further.

## Why it does not reach final output

Every rule condition touching those 14 aggregate facts was enumerated: **28 conditions** across
`AINF-002/004`, `ALERT-001/004/006`, `HEM-002`, `ID-002/005/006`, `IMF-001/DBA-001/FANCONI-001`,
`LOSS-001/002`, `MARROW-001/003`, `PARVO-001`, `Q-CYT-001`, `MICRO-005`, `NORMO-*`, `SMEAR-001`,
`TEC-001`, `THAL-001`.

- **All 28 use `op: "is-present"`.** Zero use `is-absent`, `is-unknown`, or `is-not-assessed`; zero
  compare against `'false'`/`'unknown'`.
- `ruleEngine.js:45-48` — `is-present` tests only `toTri(actual) === 'true'`, so `'false'` and
  `'unknown'` are **indistinguishable to every consumer** in the anemia corpus.
- `marrow.congenitalSignalCount` (the one numeric fact consumed, via `gte 1` in `IMF-001` /
  `IMF-DBA-001`) is built with `countPresent()`, which counts only explicit `'true'`.
- `congenitalSignalsFullyAssessed` (`facts.anemia.js:261`) is referenced by **zero rules** — it is
  dead output today.

## Verdict

**No.** Omitting unanswered questionnaire fields does not change the engine's rule-derived output
(candidates, alerts, questions, notes, ranks) for any golden fixture, and the same holds structurally
across the anemia corpus. The only visible change is at the intermediate aggregate-fact layer, and it
never surfaces because the corpus is `is-present`-only.

## The neutrality precondition (load-bearing — must be pinned by a test)

This neutrality is **conditional, not inherent**. It holds *because* no rule distinguishes `'false'`
from `'unknown'`. It ends the moment any rule author writes an `is-absent`, `is-unknown`, or
`is-not-assessed` condition against one of these aggregates — at which point omitting unanswered
fields becomes a genuine clinical behavior change.

A regression test must therefore assert the precondition itself (no `is-absent` / `is-unknown` /
`is-not-assessed` consumer of the triAny/triAll/triNone-derived aggregates), so the assumption fails
loudly at authoring time rather than silently changing patient-facing output later.
