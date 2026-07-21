---
title: "Findings: Wave 0 EP-6 Adversarial Validation Corpus"
schema_version: 2
doc_type: report
report_category: finding
status: completed
created: 2026-07-21
updated: 2026-07-21
feature_slug: wave0-safety-foundation
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-6-validation-corpus.md
owner: pediatric-cds-program-owner
tags: [wave0, ep6, dangerous-miss, adversarial-review, safety, findings]
---

# Findings — Wave 0 EP-6 Adversarial Validation Corpus

Findings from EP6-T5, the dangerous-miss adversarial review: *"what would this engine miss that
harms a child?"* The phase plan calls this the highest-stakes reasoning gate in the plan, on the
grounds that **no verifier exists downstream of it**.

## D-4 execution status — read this before anything else

**`not_executed_owner_held`.**

This review was performed by three independent AI reviewers (`fable`, three distinct adversarial
lenses), with every high-severity finding reproduced independently by the orchestrator against the
real engine. It is an **adversarial software review. It is not credentialed clinical sign-off, and
it does not satisfy the roadmap's V1 "dangerous-miss review by a clinical advisor" criterion.** It
partially *informs* that criterion. `clinicalApprovers[]` / `approvedBy[]` remain empty and must be
filled only by real named humans.

Nothing in this document establishes a clinical fact. Where a finding turns on clinical judgment it
is recorded as **a question for a credentialed pediatric hematologist**, never as a determination.

## Why nothing here was "fixed" in EP-6

The repository guardrail is explicit: **no AI-published rule changes.** Rule/KB edits require
independent clinical review, executable tests, and a signed release. Most findings below are
KB/rule-level or clinical-scope defects. Repairing them inside this phase would have been the exact
governance violation the program is built to prevent.

EP-6's acceptance criterion is *"a filed, owned follow-up for any newly-identified dangerous-miss
scenario."* That is what this register is. Where a finding could be pinned **without changing
clinical behavior**, an executable regression test was added so the current behavior cannot change
silently — following the repo's existing disclosed-gap precedent (DM-HEME-002).

## Method and honesty boundary

Three lenses ran independently and blind to each other: **A** falsely-reassuring clinical output,
**B** missingness / data-quality / fail-closed integrity, **C** structural and coverage absence.
Convergence across lenses is noted per finding — three independent lenses reaching the same defect
by different routes is the strongest signal in this document.

Every finding marked VERIFIED was reproduced by the orchestrator by executing the real engine, not
by reading code or trusting a reviewer's report. Reviewer claims that did not survive that check are
recorded in *Corrections* at the end.

Severity is the reviewers' own scale, adjudicated by the orchestrator.

---

## CRITICAL

### EP6T5-001 — Raw WBC / ANC / platelet counts are never interpreted; pancytopenia and febrile neutropenia return zero alerts
**Converged: all three lenses (A#1, B-2, F-C1).** VERIFIED.

`cbc.wbc`, `cbc.anc`, `cbc.platelets` have **0 references across all 91 rules**. `reference-ranges.json`
carries built-in bands for `hb`/`mcv`/`rdw` only, so `cytopeniaTri()` (`modules/anemia/facts.anemia.js:36-44`)
returns `'unknown'` unless the caller supplies `cbc.localRanges.*Lower` or ticks `cbc.localFlags.*`.

Reproduced — 4-year-old, Hb 9.5, WBC 1.1, ANC 0.18, platelets 14, fever:

```
raw counts only        -> alerts: []                              differential: []
same + localFlags set  -> alerts: [emergency ALERT-009, urgent ALERT-004]
```

`ALERT-009` is febrile neutropenia — an emergency. Suppressed also: ALERT-004, the thrombocytopenia
arm of ALERT-006 (TMA), MARROW-001, Q-CYT-001, Q-SMEAR-001.

Aggravating: the shipped SPA puts WBC/ANC/platelets in the primary CBC grid (`index.html:130-132`)
while the enabling local limits and flags sit in a **collapsed `<details>`** (`index.html:146-162`);
**no question rule ever asks for them**; and the only limitation naming those analytes is the
units-assumed line, which implies they *were* used.

Also: `docs/safety/hazard-control-matrix.json` `DM-CBC-001` claims `control_bound` **and**
`reachable_in_shipped_product`. Both hold only under an undocumented precondition the deployed
product neither supplies nor requests. **The hazard matrix overstates this family's real coverage.**

**Owner action.** At minimum emit a limitation/question when a count is supplied with no resolvable
bound — nothing should silently swallow a submitted count. Correct `DM-CBC-001`'s `productIntegration`
claim.
**Clinical question.** May a pediatric anemia CDS accept WBC/ANC/platelet counts it holds no
reference interval for, or must it carry age-banded built-in bounds, or fail closed?

---

### EP6T5-002 — The SPA cannot express `unknown`; every unticked checkbox is submitted as confirmed-absent
**Lens B-1.** VERIFIED (code path).

`src/app.js:48` — `checked()` returns `Boolean(element.checked)`, i.e. **`false` for every box the
clinician never touched**, applied across all history, symptom and exam fields plus `cbc.localFlags`.
`toTri(false) === 'false'` = *asserted absent*. `schemas/patient-input.schema.json:131` still defines
`booleanMap` as bare booleans: **the EP-1 tri-state migration reached facts and the DSL but never
reached the input surface.**

Consequence for the pancytopenia case above: the engine does not merely fail to flag it, it
**affirmatively derives `isolatedAnemia: "true"` and `multilineageCytopenia: "false"`** for a child
with WBC 2.0 / ANC 0.3 / platelets 18.

This is the most important finding in the review. The project's central invariant — *missingness is
never treated as normal* — is enforced in the fact layer and the rule DSL, proven by EP-1's tests,
and then **defeated at the browser input boundary**, which is the primary clinical path. A guardrail
that holds everywhere except where users actually enter data is not holding.

**Owner action.** The SPA must emit `'unknown'` for untouched tri-state fields; `booleanMap` must be
replaced by the tri-state definition with `unknown` as the default. Until then no browser-path output
should be read as an assessment of anything the clinician did not explicitly tick.

---

### EP6T5-003 — A malformed local range is accepted as the anemia threshold: Hb 5.0 g/dL returns "anemiaStatus: absent" + "No anemia by the supplied threshold"
**Lens B-3.** VERIFIED.

`modules/anemia/ranges.js:146-158` — `pick()` does `Number(raw)` and checks only `Number.isFinite()`.
`Number([]) === 0`; `Number(true) === 1`. No positivity or plausibility check.

Reproduced, 4-year-old, **Hb 5.0 g/dL** (a transfusion-threshold emergency):

```
localRanges.hbLower = []     -> anemiaStatus: absent | hbLower: 0 | alerts: [] | notes: [NOTE-001]
localRanges.hbLower = true   -> anemiaStatus: absent | hbLower: 1 | alerts: [] | notes: [NOTE-001]
localRanges.hbLower = "abc"  -> anemiaStatus: present| hbLower: 11| alerts: [ALERT-003]   (correct fallback)
```

NOTE-001 is *"No anemia by the supplied threshold."* A single malformed field converts a severe-anemia
emergency into an explicit reassurance, and suppresses ALERT-003 (which is gated on `anemia.present`).
Reachable through the unvalidated API (EP6T5-006).

**Owner action.** Reject any `localRanges.*` that is not a JSON number, and reject non-positive
limits, fail-closed in the `UnitRejectionError` shape.

---

### EP6T5-004 — The severe-anemia alert is suppressed when `sexAtBirth` or `ageMonths` is absent
**Lens A#2.** VERIFIED.

```
Hb 3.0, age 60mo, sex omitted   -> anemiaStatus: indeterminate | alerts: [important SCOPE-003]
Hb 3.0, age 60mo, sex supplied  -> anemiaStatus: present       | alerts: [urgent ALERT-003]
```

`ALERT-003` keys on `anemia.severeIdaHbCategory`, which requires `anemiaStatus === 'present'`, which
requires a resolved `hbLower`, which requires **both** an age band and a sex key. A hemoglobin of
3.0 g/dL is critical on its face and needs no demographic to say so. The most severe numeric red flag
in the tool degrades to an `important`-severity completeness notice. `sexAtBirth` is optional in both
the SPA select and the schema.

**Owner action.** Decouple the absolute-value red flag from range resolution.
**Clinical question.** What absolute hemoglobin value should alert irrespective of age/sex, and
should it be age-banded?

---

### EP6T5-005 — Classic acute-leukemia presentation returns a completely empty assessment
**Lens A#3.** VERIFIED.

5-year-old, Hb 7.5, WBC 45, platelets 30, hepatosplenomegaly + lymphadenopathy + bruising + petechiae:

```
-> alerts: []   differential: []
+ reticulocytes low -> alerts: []   differential: [marrow-failure-infiltration]
```

MARROW-001/003 hard-require `retic.low`; MARROW-002 requires blasts already on the smear. Reticulocytes
are separately ordered and routinely pending when the CBC is first read. Combined with EP6T5-001
(WBC 45 / platelets 30 invisible), the malignancy pathway is unreachable from a first-pass CBC plus
physical exam — and **even with retic low there is still no alert**.

**Owner action.** Provide a reticulocyte-independent path into `marrow-failure-infiltration`.
**Clinical question.** Should hepatosplenomegaly/lymphadenopathy/petechiae with anemia raise an
alert, not merely a candidate? What is the trigger set?

---

## HIGH

### EP6T5-006 — `POST /api/v1/assess` performs no schema validation; Hb 62 or 90 (g/L, unlabelled) returns "no anemia"
**Converged: A#5, B-4, B-8.** VERIFIED.

```
Hb 62, no unit -> anemiaStatus: absent | notes: [NOTE-001 "No anemia by the supplied threshold"]
Hb 90, no unit -> anemiaStatus: absent | notes: [NOTE-001]
Hb 62 + hemoglobinUnit "g/L" -> UnitRejectionError   (correct)
```

`server.mjs:228-233` passes the body straight to `assessPediatricAnemia` after an is-it-an-object
check. `schemas/patient-input.schema.json:23` bounds hemoglobin to `maximum: 30` but is never
enforced — `src/units.js:47-52` even comments that the schema is documentation-only.

**The failure mode is inverted relative to safety: the careful caller who declares `g/L` is protected;
the careless one who omits the unit is not.** g/L is the single most-cited confusable in the KB's own
`units.json` (10x scale). Every hazard in EP6T5-003/-007/-008 is a documented schema violation the
schema would have caught.

**Owner action.** Enforce `patient-input.schema.json` at the API boundary; add per-analyte physiologic
plausibility gating at fact derivation so direct `assess()` callers are covered too.

---

### EP6T5-007 — `not(... is-present)` treats *unassessed* as *assessed-and-absent*
**Lens A#4.** VERIFIED.

3-year-old, Hb 6.5, retic low, recent viral illness, **exam simply not documented**:

```
exam not assessed      -> differential: [transient-erythroblastopenia]   (benign, sole entry)
exam splenomegaly:true -> differential: [marrow-failure-infiltration]
```

TEC-001's exclusion is `not(any(exam.splenomegaly is-present, exam.hepatomegaly is-present,
exam.lymphadenopathy is-present, smear.blasts eq true))`. `is-present` is false for `'unknown'`, so an
**unperformed exam satisfies the "no organomegaly" exclusion.** No question prompts the exam, and the
output does not disclose that the exclusion rested on unassessed data — the limitations block is
generic boilerplate (verified: the only match for "exam" is the word *examination* in a standing
disclaimer).

Same construct in **IRIDA-001, Q-MICRO-003, Q-MICRO-005, Q-NORMO-HIGH-002, Q-NORMO-LOW-001**.

This is the same class as EP6T5-002 at a different layer, and it lands on the single distinction that
matters most: benign TEC versus leukemia in a 3-year-old with Hb 6.5.

**Owner action.** An exclusion over a tri-state fact must require explicit `is-absent`, or must attach
a limitation naming the unassessed fields it relied on. Audit all six rules.

---

### EP6T5-008 — Malformed input makes the engine *more* confident: out-of-enum retic and string `smear` delete the compensating safety questions
**Lens B-5, B-6.** VERIFIED.

```
retic "unknown"   -> questions: [Q-004]     (missing-retic prompt present)
retic "decreased" -> questions: []          (out-of-enum; prompt GONE)
retic 0.5         -> questions: []          (numeric in wrong field; prompt GONE)

smear ["schistocytes"] -> differential: [microangiopathic-hemolysis]  Qs incl. Q-SMEAR-001 absent
smear "schistocytes"   -> differential: []                            Q-SMEAR-001 absent
smear []               -> differential: []                            Q-SMEAR-001 PRESENT
```

`reticKnown = !['', 'unknown'].includes(response)` — anything else counts as *known*, so the
"reticulocyte response is missing" limitation and question both vanish while `reticHigh`/`reticLow`
stay false. `smear.provided = smearValues.length > 0` — a **string** has `.length`, so a scalar
`smear` sets `provided: true` while `includes()` matches nothing, losing the MAHA candidate **and**
Q-SMEAR-001.

Both are realistic integration errors, and in both the result is strictly worse than omitting the
field: the malformed value removes the safety net that absence would have triggered.

**Owner action.** Treat out-of-enum retic as `unknown`; require `Array.isArray(smear)`.

---

### EP6T5-009 — Retired rules still fire and are indistinguishable in output; `isActive()` ignores `effectiveDate`
**Lens B-7.** Reviewer-verified by execution against a cloned KB; not re-run by the orchestrator.

`src/ruleEngine.js:155-193` — `runRules()` evaluates every rule with **no lifecycle filter**.
`src/governance.js:51-61` — `isActive()` inspects only `retireDate`, so a future-dated rule reports
`isActive: true`. With `ALERT-004.retireDate = 2020-01-01`, the alert still fired, no limitation
mentioned retirement, and the only disclosure (`provenance.ruleAudit[].isActive: false`) lives in an
array **no user surface renders** (`src/app.js` references neither `isActive` nor `ruleAudit`).

A rule retired *because it was found wrong* keeps producing alerts that look identical to governed ones.

**Owner action.** Decide explicitly whether `runRules` skips inactive rules or must disclose them;
`isActive()` must consider `effectiveDate <= asOf`; non-active influence needs a top-level limitation.

---

### EP6T5-010 — No temporal dimension exists, and no limitation discloses it (hazard family absent from the ARC 10)
**Lens F-C2.** VERIFIED (zero disclosure confirmed).

The input schema has **no** field for collection time, prior values, rate of change, or symptom
duration. `CORE_LIMITATIONS` (`src/engine.js:7-12`) and `limitations()` (`modules/anemia/index.js:22-42`)
contain **no statement that this is single-snapshot reasoning** — grep for trend/serial/snapshot/prior
across both returns 0.

A Hb of 9.5 that fell from 13.0 in 48 hours and a stable chronic 9.5 are the same input and produce
identical output. The defect is not that the engine cannot see trend — it is that it **never says so**.
No rule could close this; it is an input-contract gap. `DM-RESULT-007` is result-identity provenance,
not trajectory, and is in any case repository-only.

**Owner action.** Add an unconditional single-snapshot `CORE_LIMITATIONS` entry; open a hazard row
(e.g. `DM-TREND-011`) with an honest `no_control_exists` binding — an unnamed family cannot be
regression-tested.

---

## MEDIUM

### EP6T5-011 — `rule-coverage --require-all` is rule-granular and blind to 6 never-exercised condition branches
**Lens F-C8.** Reviewer-instrumented over all 91 rules × 54 fixtures.

Never-true branches: `NOTE-004.all[1].any[1]` and `G6PD-003.all[1].any[1]`
(`g6pd.testedSoonAfterTransfusion`), `SICKLE-001.any[0]`
(`hemoglobinAnalysis.sicklingHemoglobinDetected`), `TEC-001.all[6].not.any[1]` and
`MARROW-003.all[2].any[0]` (`exam.hepatomegaly`), `IRIDA-001.all[4].not`
(`history.ongoingBloodLossKnown`).

These are **not dead** — all four fact paths are derived and collectable in the shipped UI. They are
*unwitnessed*. `scripts/rule-coverage.mjs --require-all --min=91` reports 91/91 and gates `npm run check`,
which reads as full coverage. A refactor breaking any of these disjuncts passes silently — the same
blind-spot class EP-0 built this instrument to eliminate, reproduced one level down the tree.
`SICKLE-001` reaches its candidate only via its other arm, so the hemoglobin-analysis arm has never
executed true.

**Owner action.** Extend `rule-coverage.mjs` to branch granularity, or add six witness fixtures.

---

### EP6T5-012 — Collected-but-inert inputs: teardrops, nucleated RBCs, elliptocytes, thrombocytosis
**Converged: A#7, F-C3.** VERIFIED (0 rule references for all three smear fields).

All four are offered in the shipped UI, parsed, and derived into facts — and referenced by **no rule**.
Output is byte-identical to not supplying them. A clinician who ticks "teardrop cells" + "nucleated
RBCs" and sees an unchanged empty differential may reasonably read that as *considered and
unremarkable*. The engine cannot distinguish "you did not tell me" from "you told me and it does not
matter." Note the pairing with the absent membrane-disorder patterns: `elliptocytes` is inert *and*
there is no hereditary-elliptocytosis candidate, so the gap is invisible from either side alone.

Also derived-and-unused: `cbc.thrombocytosis`, `cbc.additionalCytopeniaCount`, `cbc.rbc`, `lead.value`,
`symptoms.fatigueOrPallor`, `anemia.moderateIdaHbCategory`, `anemia.mildIdaHbCategory`.

**Owner action.** Add a machine check that every schema field is either referenced by ≥1 rule or
listed in an explicit `collectedButNotEvaluated` registry the output surfaces. Until then, remove or
label the controls.

---

### EP6T5-013 — No fallback candidate: an empty differential is reachable from the commonest possible input
**Converged: A#9, F-C4.** VERIFIED.

All 26 candidates require a lab or history discriminator; none is entered by morphology + severity
alone. Microcytic-only, normocytic+retic-low-only, macrocytic-only, and **Hb 4.0 with nothing else**
all yield an empty `rankedDifferential`. The SPA renders this as *"No urgent rule triggered"* /
*"No diagnostic pattern rule matched yet"* (`src/app.js:318,339`).

The empty-differential shape is identical whether the engine excluded everything or never had enough
data to enter any pattern — the same shape as the disclosed DM-HEME-002 case, but broader in cause.
The most common real-world input (a CBC before confirmatory labs return) is precisely the shape that
produces "nothing found."

**Owner action.** Render the empty state as a non-reassuring gap notice naming *why* nothing matched
and which single input would unlock the differential.
**Clinical question.** Should the catalog include an explicit "undifferentiated anemia — insufficient
data" candidate so the differential is never empty while an anemia is present?

---

### EP6T5-014 — Authoritative citation chips are rendered for rules grounded only in `#implementation-proposal`
**Lens B-10.**

`src/app.js:168-173` renders `citeChips(item.evidence)` — journal title + DOI link — on alerts,
candidates, notes and questions. Measured: passage-status distribution across all 91 rules is
`{ 'implementation-proposal': 91 }`, `hasCredentialedClinicalApproval: false` for all.
`provenance.ruleAudit[].sourcePassageStatus` has **zero user-visible consumers**.

That 0/91 rules are grounded is already known. The new part is that at the point of use the output
carries an authoritative citation the rule's own passage pointer does not support, and the field that
would disclose this is never displayed.

**Owner action.** Render `sourcePassageStatus` beside every citation chip, or suppress the chip when
status is not source-supported.

---

### EP6T5-015 — Hazard families and differential patterns absent by construction (map of absence)
**Lens F-C5, F-C6.** For clinical scoping — **no claim that any of these should be added.**

Hazard families not named in the ARC 10: longitudinal/trend blindness (EP6T5-010); pre-analytic
specimen artifact (clotted sample, EDTA pseudothrombocytopenia, cold agglutinin); transfusion-therapy
hazards; drug/toxin-induced cytopenia; follow-up/safety-netting failure (no time-bound recheck is ever
emitted — `recheck: 0`, `repeat in: 0`); comorbidity interaction (celiac/IBD/HIV/TB all 0 hits);
pregnancy in an adolescent (`pregnan: 0`, no input field); splenic sequestration/hypersplenism
(`hypersplen: 0`, `sequestration: 0`); puberty/Tanner vs chromosomal sex.

Differential patterns with no candidate: hereditary elliptocytosis/stomatocytosis; pyruvate-kinase
deficiency; HbC/HbE/unstable variants; **acquired aplastic anemia, myelodysplasia and leukemia as
named patterns** (all absorbed into the single `marrow-failure-infiltration` catch-all); PNH; HLH;
cold-agglutinin/PCH/drug-induced immune hemolysis; congenital dyserythropoietic anemia; pulmonary
hemosiderosis; endocrine beyond thyroid; nutritional beyond iron/B12/folate/copper;
infection-associated as named patterns.

Also (A#8): a known sickle-cell patient with splenomegaly and Hb 4.5 returns
`sickling-hemoglobinopathy` — naming the chronic diagnosis the clinician already knew — and is silent
on acute sequestration.

**Clinical questions.** Per family: in scope at v1, deferred, or explicitly out of scope? And
specifically: is one `marrow-failure-infiltration` candidate an acceptable representation of aplastic
anemia + MDS + leukemia + solid-tumor infiltration? Where a family is out of scope, that exclusion
must be *stated in `limitations`*, not left implicit.

---

### EP6T5-016 — Ranking has no term for clinical consequence
**Lens A#10.** VERIFIED.

`ruleEngine.js:195-202` sorts by `LEVEL_RANK` → `score` → label. Both encode *evidential strength of
pattern match*, with no term for danger, so a confidently-matched benign pattern always outranks a
less-confidently-matched dangerous one. Reproduced: iron-deficiency `[meets-defined-pattern/110]`
ranks above `marrow-failure-infiltration [supported/75]` in a child with documented lymphadenopathy
**and** splenomegaly — with no alert at all.

The sort behaves as specified. Whether the specification is safe is the question.

**Clinical question.** Should a "cannot-miss" candidate be pinned, badged, or surfaced above
pattern-match strength regardless of level/score? If no, the "ordinal priority, not probability"
disclaimer needs far more prominence than a mid-list limitation.

**Cleared, and worth recording:** there is **no truncation anywhere** — no `slice`/`splice`/length cap
on `rankedDifferential`, `alerts`, `nextQuestions` or `interpretiveNotes`, in the engine, the SPA, or
the server. **No dangerous candidate can be dropped off the list by a cap.** This is about order only.

---

## LOW

### EP6T5-017 — `supportedAgeMonths.max: 216` is exclusive in code but reads inclusive, including in its own refusal message
**Lens F-C7.** VERIFIED. Age 215 accepted; age 216 refused with *"outside this module's supported age
range (6-216 months)"* — a message that states 216 is inside the range while refusing it.
**Owner action.** Rename to `maxExclusive`, or render as `[6, 216)` / `6–215`.

### EP6T5-018 — Contradictory inputs are silently resolved
**Lens B-11.** `menstruating === true` short-circuits before any age or sex check
(`modules/anemia/ranges.js:59-71`), so `menstruating: true` at `ageMonths: 12` with
`sexAtBirth: 'male'` selects the ferritin-30 threshold instead of the age-band 20, flipping
`ferritin.low` to true. A `localFlags` cytopenia flag likewise overrides a contradicting count. Direction
here is over-calling (safer), but the pattern is undisclosed.
**Clinical question.** Should mutually inconsistent inputs be a fail-closed rejection, or an alert?

### EP6T5-019 — NOTE-003 fires on an HbA2 that was never measured
**Lens B-12.** `hbA2Elevated` is a plain boolean, false when unmeasured, and NOTE-003 matches
`eq false` — so the note appears for patients who never had an HbA2. Safe-leaning (it warns rather
than reassures) but asserts a result that does not exist. Reviewer notes this is the only `eq false`
leaf in the KB landing on an unknown-collapsing boolean.
**Owner action.** Re-key on a tri-state `hbA2` fact.

---

## What was probed and found clean

Recorded because a negative result is only evidence if it is auditable.

- **All 26 candidates are reachable.** All 54 fixtures run through the engine; union of
  `rankedDifferential[].id` = **26/26, zero dead candidates, zero fixture errors.**
- **No orphan candidate references** — every `output.candidateId` across the 55 differential rules
  resolves in `candidates.json`; the degraded-fallback path is never taken.
- **No undefined fact references** — all 101 distinct `fact` paths resolve against the 165 leaf paths
  `deriveFacts` produces; 0 typo'd permanently-false leaves.
- **91/91 rule activation coverage confirmed live** (13 alert / 55 candidate / 17 question / 6 note).
- **No output truncation anywhere** (see EP6T5-016).
- **Age-scope refusal is correct and fail-safe at both ends** — 3mo/5mo and 217mo/240mo throw
  `AgeOutOfSupportedRangeError` before any rule evaluation; a *null* age is correctly treated as
  missingness, not out-of-range. Boundary read from `module.json`, not hardcoded.
- **Declared wrong units fail closed** — `hemoglobinUnit: 'g/L'` and `localRanges.hbLowerUnit: 'g/L'`
  both throw; non-string units rejected. Only the *omitted*-unit path is unsafe (EP6T5-006).
- **TOCTOU between validation and derivation is closed** — input cloned, validated, normalized, then
  deep-frozen; the memo keys off the frozen snapshot.
- **Non-numeric local ranges fall back correctly** (`hbLower: "abc"` → built-in 11, alert intact).
- **Missing/`unspecified` `sexAtBirth` fails closed** rather than defaulting to a band.
- **`is-present` genuinely fails safe** — `toTri('unknown') !== 'true'`; all 78 `is-present` leaves are
  the correct direction.
- **Blasts pathway is robust** — `smear: ["blasts"]` reliably fires urgent ALERT-005 plus
  `marrow-failure-infiltration [meets-defined-pattern/150]` at rank 1; no suppressing variation found.
- **Severe lead, instability, and active major bleeding** all fire unconditionally, independent of age,
  sex, or range resolution — no suppression path found.
- **Alert severity ordering** (emergency > urgent > important > informational) verified correct.
- **D-4 approval guard sits at the lowest exported entry point** (`runRules`, not just `assess`) and
  demands an explicit empty `clinicalApprovers: []` — a direct `runRules` caller cannot bypass it.
- **Quarantined evidence does not reach output** — 22 quarantined passages exist; no rule points at one.
- **Recent transfusion is disclosed** in both a note and a limitation.
- **`interpolate()` renders missing facts as "not supplied"**, never blank or zero.
- **Empty input** returns no candidates, no false alerts, and the four highest-priority questions.

---

## Corrections and calibration

Recorded because a review that never corrects itself is not a review.

1. **Orchestrator self-correction.** Checking whether EP6T5-007's output discloses its reliance on
   unassessed exam data, an initial regex appeared to confirm disclosure. It was matching the word
   *examination* inside a standing boilerplate disclaimer. There is no such disclosure. The engine was
   nearly credited with a safeguard it does not have.

2. **Lens A partially corrected on DM-HEME-002.** `parvovirus-aplastic-crisis` *does* surface as
   `strongly-supported/95` when retic-low + known sickle-cell + recent viral illness are all supplied.
   The disclosed DM-HEME-002 silent case is therefore a **narrower input variant**, not "aplastic
   crisis in general."

3. **Lens C self-cleared three false positives** before reporting: `hemolysis.bilirubinHigh`/`ldhHigh`/
   `haptoglobinLow` and `cbc.leukopenia` appear in no rule `when` but are correctly aggregated into
   `hemolysis.markerCount` / `additionalCytopeniaCount`, which rules do consume; `patient.menstruating`
   is live via the ferritin threshold. Traced through derivation rather than reported on a grep miss.

4. **EP6T5-009 is reviewer-verified but not orchestrator-re-run** (it requires mutating a cloned KB).
   Flagged at a lower confidence than the findings marked VERIFIED.

5. **Convergence is the strongest signal here.** EP6T5-001 was found independently by all three
   lenses via three different routes (clinical presentation, missingness semantics, structural
   census). EP6T5-006 and EP6T5-012/-013 each converged across two.

---

## Disposition

| ID | Severity | Category | Disposition |
|---|---|---|---|
| EP6T5-001 | critical | defect + KB gap + matrix overstatement | filed — owner |
| EP6T5-002 | critical | defect (input boundary) | filed — owner |
| EP6T5-003 | critical | defect | filed — owner |
| EP6T5-004 | critical | defect | filed — owner |
| EP6T5-005 | critical | defect + KB gap | filed — owner |
| EP6T5-006 | high | defect | filed — owner |
| EP6T5-007 | high | defect (DSL semantics) | filed — owner |
| EP6T5-008 | high | defect | filed — owner |
| EP6T5-009 | high | defect (governance) | filed — owner |
| EP6T5-010 | high | absent hazard family + non-disclosure | filed — owner |
| EP6T5-011 | medium | safety-gate granularity | filed — owner |
| EP6T5-012 | medium | defect (inert input surface) | filed — owner |
| EP6T5-013 | medium | KB gap + rendering | filed — owner |
| EP6T5-014 | medium | defect (disclosure) | filed — owner |
| EP6T5-015 | medium | scope map | filed — clinical scoping |
| EP6T5-016 | medium | clinical-judgment question | filed — clinical |
| EP6T5-017 | low | scope-honesty defect | filed — owner |
| EP6T5-018 | low | defect + clinical question | filed — owner |
| EP6T5-019 | low | defect (minor) | filed — owner |

**None fixed in EP-6.** All require either clinical review or a behavior change outside this phase's
mandate. Executable regression tests pinning the current behavior of the reproducible findings are
added in `tests/dangerous-miss-ep6.test.mjs` so none can change silently — those tests assert **what
the engine does today, including where that is wrong**, and are labelled as disclosed-gap pins, not
as approval.

## Standing caveat

This is an unvalidated research prototype. Automated checks prove software behavior, never clinical
validity, safety, diagnostic performance, or regulatory status. This review is not credentialed
clinical sign-off and does not satisfy the V1 dangerous-miss gate.
