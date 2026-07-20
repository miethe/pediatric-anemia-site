---
schema_version: 2
doc_type: design-spec
title: "EP1-T3 Migration Design: Tri-State Fact Model"
status: draft
phase: EP-1
spike_ref: docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md
---

# EP1-T3 Migration Design: Tri-State Fact Model

This record is a clinical-council-auditable proposal for EP1-T4 and EP1-T5. It does not approve a
clinical behavior change. The binding type is `Tri = 'true' | 'false' | 'unknown'`; there is no
fourth state, and `is-unknown`/`is-not-assessed` are synonymous operators
(`src/facts/tristate.js:4-10`, `src/ruleEngine.js:35-38`). Bare booleans remain accepted on the wire
through the schema-open `anyOf` (`schemas/patient-input.schema.json:114-123`).

The independently reproduced scope is **9 `countTrue()` sites and 49 of 91 rules**, using the
amended 60-field/25-occurrence census, not the superseded 33-rule/56-field/19-occurrence figures
(`phase-1-tristate-fact-model.md:23-39`). Fact-shape and rule-syntax changes must land atomically:
SPIKE-003 proved that a staged change silently removes real output without throwing
(`spike-003-tri-state-fact-model-migration.md:341-395`).

The ranking score remains an internal ordinal sort priority. Nothing in this design treats it as a
probability, diagnostic-performance measure, or calibrated likelihood (`src/engine.js:4-9`).

## Binding evaluation semantics

The following pseudocode names are explanatory. EP1-T4 may place them locally or in
`src/facts/tristate.js`, but the formulas are binding:

```js
triAny(values) = countPresent(values) > 0
  ? 'true'
  : allAssessed(values) ? 'false' : 'unknown';

triAll(values) = values.some((v) => toTri(v) === 'false')
  ? 'false'
  : allAssessed(values) ? 'true' : 'unknown';

triNone(values) = countPresent(values) > 0
  ? 'false'
  : allAssessed(values) ? 'true' : 'unknown';
```

`countPresent()` counts only `toTri(value) === 'true'`; `allAssessed()` rejects every unknown
(`src/facts/tristate.js:13-20,31-38`). Consequently, `'unknown'` never satisfies `is-present` and
never establishes an assessed-absent exclusion. No Tri string may be passed to `Boolean()`,
`.filter(Boolean)`, or legacy `countTrue()`: every non-empty Tri string is JavaScript-truthy.

## A. Aggregate mapping table — 9/9

| # | File:line / aggregate | Today's formula | Post-migration formula | Resulting value semantics | Tri-string truthiness hazard | Evidence-linked clinical rationale |
|---|---|---|---|---|---|---|
| 1 | `modules/anemia/facts.anemia.js:75` — `hemolysisMarkerCount` | `countTrue(Object.values(hemolysisMarkers))`; `hemolysis.pattern = count >= 2` at `:76` | **No EP-1 change:** retain the boolean-status count until the separate `statusIs()` migration defines an unknown-aware lab-status contract. | Still a number `0..3`; `hemolysis.pattern` remains a JS boolean. An unknown lab status still collapses with a non-matching status, which this record does **not** bless as clinically complete. | **No at this site today:** all three inputs are JS booleans returned by `statusIs()` at `:70-74`; no Tri string is consumed. | The current hemolysis rules rely on the existing two-of-three marker count (`rules.json:1241,1309,1345,1377,1469,1549`). Changing its missing-lab meaning would be a new clinical-semantic decision outside the booleanMap migration (SPIKE-003 Risks, `:597-603`). |
| 2 | **⚠ SUPERSEDED — see "Orchestrator adjudication → aggregate row 2" at the end of this file; the formula in this row was NOT the one implemented (it suppressed `TEC-001`/`IMF-DBA-001`). Landed form is the hybrid precedence in commit `188d717`.** `modules/anemia/facts.anemia.js:96` — `additionalCytopeniaCount` | `countTrue([leukopenia, neutropenia, thrombocytopenia])`; each input is `isTrue(localFlag) \|\| numericBelowLocalLimit` at `:87-94`; downstream `multilineageCytopenia`/`isolatedAnemia` collapse at `:97,199`. | Derive each cytopenia as `triAny([toTri(localFlag), numericComparisonTri])`; then `countPresent([leukopeniaTri, neutropeniaTri, thrombocytopeniaTri])`. Derive `cbc.multilineageCytopenia = triAll([anemiaPresentTri, triAny([leukopeniaTri, neutropeniaTri, thrombocytopeniaTri])])` and `cbc.isolatedAnemia = triAll([anemiaPresentTri, triNone([leukopeniaTri, neutropeniaTri, thrombocytopeniaTri])])`. | The count remains the number of **confirmed-present** additional cytopenias. `0` with an unknown lineage is not evidence of isolated anemia: `multilineageCytopenia` and `isolatedAnemia` are `'unknown'` unless their definitions can be resolved from assessed inputs. | **Yes.** All three inputs become Tri strings; `countTrue()`/`.filter(Boolean)` would count `'false'` and `'unknown'` as present. Use `countPresent()` only. | This prevents an unmeasured lineage from creating `isolatedAnemia`, while confirmed cytopenias still drive the existing alert/marrow rules (`rules.json:135,1716,1835,2192,2241`). No new numeric cutoff is introduced; the only numeric comparison remains against caller-supplied local limits (`facts.anemia.js:87-94`). |
| 3 | `modules/anemia/facts.anemia.js:99-106` — `instability` | `countTrue([respiratoryDistress, syncope, alteredMentalStatus, chestPain, heartFailureSigns, hemodynamicInstability]) > 0` | `triAny([toTri(respiratoryDistress), toTri(syncope), toTri(alteredMentalStatus), toTri(chestPain), toTri(heartFailureSigns), toTri(hemodynamicInstability)])` | `'true'` if any instability symptom is confirmed; `'false'` only if all six are assessed absent; otherwise `'unknown'`. | **Yes.** Six Tri strings replace raw booleans; legacy truthiness would count every `'false'`/`'unknown'`. | Only confirmed instability may emit `ALERT-001`; unknown must not fabricate an emergency alert (`rules.json:69`, evidence `BLOOD2022_PED_ANEMIA`). |
| 4 | `modules/anemia/facts.anemia.js:108-115` — `bleedingHistory` | `countTrue([giBloodLoss, heavyMenstrualBleeding, recurrentEpistaxis, frequentBloodDonation, otherBloodLoss, symptoms.activeMajorBleeding]) > 0` | `triAny([toTri(giBloodLoss), toTri(heavyMenstrualBleeding), toTri(recurrentEpistaxis), toTri(frequentBloodDonation), toTri(otherBloodLoss), activeMajorBleedingTri])` | `'true'` if any source is confirmed; `'false'` only if all six are assessed absent; otherwise `'unknown'`. | **Yes.** This includes the derived Tri `activeMajorBleeding`; no raw coercion is permitted. | Confirmed bleeding continues to support `LOSS-001/002`; unknown continues to prompt assessment through `Q-MICRO-005`/`Q-NORMO-HIGH-002` rather than being recorded as no bleeding (`rules.json:1148,1183,2725,2786`). |
| 5 | `modules/anemia/facts.anemia.js:117-127` — `ironRiskHistory` | `countTrue([excessCowMilk, cowMilkBefore12Months, lowIronDiet, vegetarianOrVegan, foodInsecurity, pica, prematurity, malabsorption, bleedingHistory]) > 0` | `triAny([toTri(excessCowMilk), toTri(cowMilkBefore12Months), toTri(lowIronDiet), toTri(vegetarianOrVegan), toTri(foodInsecurity), toTri(pica), toTri(prematurity), toTri(malabsorption), bleedingHistoryTri])` | `'true'` if any risk is confirmed; `'false'` only when all eight direct risks and the complete bleeding aggregate are assessed absent; otherwise `'unknown'`. | **Yes — highest-risk nested site.** `bleedingHistoryTri === 'unknown'` is truthy. The outer formula must use `countPresent()`/`allAssessed()` in the same atomic edit as the inner aggregate. | Iron-risk support is added only from confirmed risk data in `ID-002/005/006`; incomplete history supplies no positive support and cannot be mistaken for a positive risk (`rules.json:457,565,608`, evidence `AAP2026_IDA`). |
| 6 | `modules/anemia/facts.anemia.js:129-134` — `chronicInflammation` | `countTrue([inflammatoryBowelDisease, rheumatologicDisease, chronicInfection, otherInflammatoryDisease]) > 0` | `triAny([toTri(inflammatoryBowelDisease), toTri(rheumatologicDisease), toTri(chronicInfection), toTri(otherInflammatoryDisease)])` | `'true'` if any condition is confirmed; `'false'` only if all four are assessed absent; otherwise `'unknown'`. | **Yes.** Four Tri strings replace raw booleans. | Unknown inflammatory history must not add the existing inflammation support in `AINF-002/004`, nor should it be represented as confirmed absence (`rules.json:670,746`, evidence `AAP2026_IDA`/`BLOOD2022_PED_ANEMIA`). |
| 7 | `modules/anemia/facts.anemia.js:143-147` — `familyHemoglobinopathy` | `countTrue([familyThalassemia, familySickleCell, familyHemoglobinopathy]) > 0` | `triAny([toTri(familyThalassemia), toTri(familySickleCell), toTri(familyHemoglobinopathy)])` | `'true'` if any family history is confirmed; `'false'` only if all three are assessed absent; otherwise `'unknown'`. | **Yes.** Three Tri strings replace raw booleans. | Only confirmed family history supplies the globin-production clue in `THAL-001`; missing family history supplies no support (`rules.json:786`, evidence `AAP2026_IDA`). |
| 8 | `modules/anemia/facts.anemia.js:149-154` — `knownChronicHemolyticDisease` | `countTrue([knownSickleCellDisease, knownHereditarySpherocytosis, knownThalassemiaMajor, otherChronicHemolyticDisease]) > 0` | `triAny([toTri(knownSickleCellDisease), toTri(knownHereditarySpherocytosis), toTri(knownThalassemiaMajor), toTri(otherChronicHemolyticDisease)])` | `'true'` if any chronic hemolytic disorder is confirmed; `'false'` only if all four are assessed absent; otherwise `'unknown'`. | **Yes.** Four Tri strings replace raw booleans. | `PARVO-001` requires confirmed chronic hemolytic disease; an unknown history must not create that support (`rules.json:1795`, evidence `BLOOD2022_PED_ANEMIA`). |
| 9 | `modules/anemia/facts.anemia.js:191-197` — `congenitalMarrowFailureSignals` / `marrow.congenitalSignalCount` | Raw `countTrue([congenitalAnomalies, thumbOrRadiusAnomaly, shortStature, abnormalSkinPigmentation, microcephaly])`; downstream rules use `gte 1` (`rules.json:2192,2241`). | `countPresent([toTri(congenitalAnomalies), toTri(thumbOrRadiusAnomaly), toTri(shortStature), toTri(abnormalSkinPigmentation), toTri(microcephaly)])`, plus `marrow.congenitalSignalsFullyAssessed = allAssessed(values)`. | The count **excludes unknown/not-assessed fields** and remains the number of confirmed-present signals. A downstream consumer reading `0` must read it as “zero confirmed”; only `0` plus `congenitalSignalsFullyAssessed === true` means all five were assessed absent. Existing `gte 1` rules may match on one confirmed signal even if others are unknown; they may not use `0` to clear a differential. | **Yes.** Five Tri strings replace raw booleans; legacy truthiness would count every string. | The existing IMF rules require at least one confirmed signal, so `countPresent() >= 1` preserves their positive evidence without treating unasked phenotype fields as normal (`rules.json:2192,2241`, evidence `BLOOD2022_PED_ANEMIA`). |

### Nested aggregate-of-aggregates: `ironRiskHistory`

`ironRiskHistory` consumes `bleedingHistory` directly (`facts.anemia.js:117-127`), while
`bleedingHistory` itself consumes a derived `symptoms.activeMajorBleeding` fact
(`facts.anemia.js:108-115,313-320`). All three layers must migrate together:

1. raw bleeding inputs become Tri;
2. `activeMajorBleeding` becomes `toTri(symptoms.activeMajorBleeding)`;
3. `bleedingHistory` uses `triAny()`;
4. `ironRiskHistory` consumes the resulting Tri with `countPresent()`/`allAssessed()`.

Leaving either outer call on `countTrue()` or any intermediate test on `Boolean()` turns
`'unknown'` into a positive risk. That is silent over-counting, not conservative missingness.

### Raw congenital count decision

The `marrow.congenitalSignalCount` decision is intentionally asymmetric: the number counts
confirmed-present signals and excludes unknowns, while completeness is a separate fact. This keeps
the existing `gte 1` rule meaning and does not invent a threshold. A future consumer must inspect
both values before saying that congenital signals were absent. Whether an incomplete zero should
create a new clinician prompt is `NEEDS-CLINICAL-REVIEW` item NCR-4 below; this design does not
invent that rule.

### Explicitly out of scope: `hemolysisMarkerCount` and `statusIs()`

`hemolysisMarkerCount` is not omitted: it is row 1. Its inputs come from categorical lab statuses
through `statusIs()` (`facts.anemia.js:57-64,70-78`), not from the migrated booleanMap. `statusIs()`
currently maps both an unknown status and a known non-matching status to `false`
(`src/facts/core.js:4`). Fixing that requires a separate inventory of all status-derived facts and
their downstream rules. Folding it into EP1-T4 would pretend the clinical semantics had been
reviewed when they have not (SPIKE-003 Risks, `:597-603`).

## B. Rule migration table — 49/49

### Independent reproduction method and table key

I walked all 91 `when` trees in `modules/anemia/rules.json`, recursively expanding `all`/`any`/`not`,
and intersected their leaves with the 45 facts that trace to `isTrue()`/`countTrue()`/direct
`=== true`/the open `...history` passthrough. The result is exactly 49 unique rule IDs: **5 alerts,
3 notes, 34 candidates, and 7 questions**. Every ID, output type, and current leaf below was checked
against the live JSON; rule citations point to each rule's starting line.

“Golden impact” means **Y if at least one of the six published `examples/*.json` inputs currently
activates the rule in `tests/golden/*.json`**, not that a changed output is expected. There are 17 Y
rows, matching the phase amendment's 17/49 coverage statement (`phase-1-tristate-fact-model.md:31-34`).
Expected output diffs are treated separately in section D.

### Behavior-preserving rows — 47

| # | Rule ID (`rules.json` line) | Type | Boolean-collapse leaf(s) in `when` | Today's operator/value | Post-migration operator(s) | Golden impact | One-line clinical rationale |
|---|---|---|---|---|---|---|---|
| 1 | `ALERT-001` (`:69`) | alert | `symptoms.instability` | `eq true` | `is-present` | N | Only confirmed instability may emit the existing emergency alert; unknown supplies no alert evidence. |
| 2 | `ALERT-002` (`:91`) | alert | `symptoms.activeMajorBleeding` | `eq true` | `is-present` | N | Only confirmed active major bleeding may emit the existing emergency alert. |
| 3 | `ALERT-004` (`:135`) | alert | `cbc.multilineageCytopenia` | `eq true` | `is-present` | Y | The “anemia with another cytopenia” alert requires a confirmed additional lineage finding. |
| 4 | `ALERT-006` (`:178`) | alert | `cbc.thrombocytopenia`; `symptoms.renalSymptoms`; `symptoms.neurologicSymptoms` | each `eq true` inside `any` | each `is-present`; preserve `any` | N | Schistocytes require at least one confirmed current danger arm; unknown arms do not fire the alert. |
| 5 | `ALERT-009` (`:265`) | alert | `cbc.neutropenia`; `symptoms.fever` | each `eq true` inside `all` | each `is-present`; preserve `all` | Y | Both fever and neutropenia must be confirmed for the existing time-critical alert. |
| 6 | `NOTE-004` (`:356`) | note | `g6pd.testedDuringAcuteHemolysis`; `g6pd.testedSoonAfterTransfusion` | each `eq true` inside `any` | each `is-present`; preserve `any` | N | The assay-timing caution is shown only when one timing limitation is confirmed. |
| 7 | `NOTE-005` (`:391`) | note | `patient.recentTransfusion` | `eq true` | `is-present` | N | The transfusion interpretation caution requires confirmed recent transfusion. |
| 8 | `NOTE-006` (`:409`) | note | `patient.highAltitude` | `eq true` | `is-present` | N | The altitude-adjustment caution requires confirmed high-altitude context. |
| 9 | `ID-002` (`:457`) | candidate | `history.ironRiskHistory` | `eq true` | `is-present` | N | Only confirmed dietary, blood-loss, or malabsorption risk adds this IDA support. |
| 10 | `ID-005` (`:565`) | candidate | `history.ironRiskHistory` | `eq true` | `is-present` | N | Unknown risk history must not add support to the inflammation-confounded IDA pattern. |
| 11 | `ID-006` (`:608`) | candidate | `history.ironRiskHistory` | `eq true` | `is-present` | Y | The current microcytic/low-TSAT rule adds support only from confirmed iron-risk history. |
| 12 | `AINF-002` (`:670`) | candidate | `history.chronicInflammation` | `eq true` | `is-present` | Y | The inflammation candidate requires confirmed chronic inflammatory history. |
| 13 | `AINF-004` (`:746`) | candidate | `history.chronicInflammation` | `eq true` | `is-present` | Y | Unknown inflammatory history supplies no support for this normocytic production-limited pattern. |
| 14 | `THAL-001` (`:786`) | candidate | `cbc.rbcRelativelyHigh`; `history.familyHemoglobinopathy` | each `eq true` inside `any` | each `is-present`; preserve `any` | Y | At least one confirmed RBC/smear/family clue remains necessary; unknown adds no thalassemia support. |
| 15 | `THAL-002` (`:835`) | candidate | `cbc.rbcRelativelyHigh` | `eq true` inside `any` | `is-present`; preserve sibling smear leaf | Y | A relatively high RBC interpretation must be confirmed before it serves as the rule's clue. |
| 16 | `THAL-BETA-002` (`:903`) | candidate | `hemoglobinAnalysis.betaGlobinPositive` | `eq true` | `is-present` | N | Molecular positivity must be confirmed; an omitted test is not a positive result. |
| 17 | `THAL-ALPHA-001` (`:924`) | candidate | `hemoglobinAnalysis.hbBartNewbornScreen` | `eq true` | `is-present` | N | Hemoglobin Bart's must be reported present before adding the existing alpha-thalassemia support. |
| 18 | `THAL-ALPHA-002` (`:945`) | candidate | `hemoglobinAnalysis.alphaGlobinPositive` | `eq true` | `is-present` | N | Alpha-globin molecular positivity must be confirmed; unknown supplies no support. |
| 19 | `LEAD-002` (`:987`) | candidate | `history.leadExposureRisk`; `history.pica` | each `eq true` inside `any` | each `is-present`; preserve smear sibling | Y | Lead-risk or pica support is added only when confirmed; unknown is not a positive exposure clue. |
| 20 | `LOSS-001` (`:1148`) | candidate | `history.bleedingHistory` | `eq true` | `is-present` | N | The blood-loss candidate requires a confirmed bleeding source/history. |
| 21 | `LOSS-002` (`:1183`) | candidate | `history.bleedingHistory` | `eq true` | `is-present` | N | Unknown bleeding history must not add blood-loss support to iron deficiency anemia. |
| 22 | `LOSS-003` (`:1218`) | candidate | `symptoms.activeMajorBleeding` | `eq true` | `is-present` | N | Active bleeding support requires a confirmed present value. |
| 23 | `HEM-002` (`:1274`) | candidate | `symptoms.jaundiceOrDarkUrine` | `eq true` | `is-present` | Y | The hemolysis support is added only when jaundice or dark urine is confirmed. |
| 24 | `HS-002` (`:1409`) | candidate | `exam.splenomegaly`; `history.knownHereditarySpherocytosis` | each `eq true` inside `any` | each `is-present`; preserve `any` | Y | Spherocytes need a confirmed splenic/history clue for this additional support. |
| 25 | `G6PD-002` (`:1469`) | candidate | `history.oxidantTrigger` | `eq true` | `is-present` | N | Oxidant exposure must be confirmed before it supports the existing G6PD pattern. |
| 26 | `G6PD-003` (`:1505`) | candidate | `g6pd.testedDuringAcuteHemolysis`; `g6pd.testedSoonAfterTransfusion`; `history.oxidantTrigger` | each `eq true` in two `any` groups | each `is-present`; preserve grouping | N | Both a confirmed assay-limiting context and a confirmed smear/exposure clue remain required. |
| 27 | `SICKLE-001` (`:1597`) | candidate | `hemoglobinAnalysis.sicklingHemoglobinDetected`; `history.knownSickleCellDisease` | each `eq true` inside `any` | each `is-present`; preserve smear sibling | N | Known disease or sickling hemoglobin must be confirmed; unknown supplies no sickling support. |
| 28 | `MAL-001` (`:1632`) | candidate | `history.malariaRisk`; `symptoms.fever` | each `eq true` inside `all` | each `is-present`; preserve `all` | N | Both the travel/residence risk and fever branches must be confirmed for this rule. |
| 29 | `REN-001` (`:1676`) | candidate | `history.renalSignal` | `eq true` | `is-present` | N | Kidney disease/abnormal creatinine must produce a confirmed renal signal before adding support. |
| 31 | `PARVO-001` (`:1795`) | candidate | `history.knownChronicHemolyticDisease`; `history.recentViral` | each `eq true` inside `all` | each `is-present`; preserve `all` | N | Both chronic hemolytic disease and recent viral illness must be confirmed. |
| 32 | `MARROW-001` (`:1835`) | candidate | `cbc.multilineageCytopenia` | `eq true` | `is-present` | Y | Another lineage abnormality must be confirmed before adding marrow-failure support. |
| 33 | `MARROW-003` (`:1891`) | candidate | `exam.hepatomegaly`; `exam.splenomegaly`; `exam.lymphadenopathy`; `exam.petechiaeOrBruising` | each `eq true` inside `any` | each `is-present`; preserve `any` | Y | At least one exam finding must be confirmed; an unperformed exam supplies no support. |
| 34 | `COPPER-001` (`:2019`) | candidate | `cbc.neutropenia` | `eq true` | `is-present` | N | The existing copper-deficiency pattern requires confirmed neutropenia. |
| 35 | `MACRO-001` (`:2054`) | candidate | `history.thyroidSignal` | `eq true` | `is-present` | N | Thyroid disease/elevated TSH must produce a confirmed signal before adding support. |
| 36 | `MACRO-002` (`:2089`) | candidate | `history.liverSignal` | `eq true` | `is-present` | N | Liver disease/abnormal tests must produce a confirmed signal before adding support. |
| 37 | `MACRO-003` (`:2124`) | candidate | `history.medicationMacrocytosisRisk` | `eq true` | `is-present` | N | Medication-associated risk must be clinician-confirmed before adding support. |
| 38 | `IMF-001` (`:2192`) | candidate | `cbc.multilineageCytopenia` | `eq true` inside `any` | `is-present`; preserve congenital `gte 1` | N | The additional-cytopenia arm must be confirmed; the separate congenital count remains confirmed-present only. |
| 39 | `IMF-DBA-001` (`:2241`) | candidate | `cbc.isolatedAnemia` | `eq true` | `is-present`; preserve congenital `gte 1` | N | “Isolated” anemia requires assessed non-anemic lineages, not missing lineage data. |
| 40 | `IMF-FANCONI-001` (`:2291`) | candidate | `cbc.multilineageCytopenia`; `history.thumbOrRadiusAnomaly`; `history.abnormalSkinPigmentation`; `history.shortStature` | `eq true` for all/any leaves | each `is-present`; preserve structure | N | Another cytopenia and at least one confirmed phenotype signal remain necessary. |
| 41 | `MIX-002` (`:2385`) | candidate | `patient.recentTransfusion` | `eq true` | `is-present` | N | A transfusion-effect pattern requires confirmed recent transfusion. |
| 43 | `Q-MICRO-003` (`:2624`) | question | `hemoglobinAnalysis.hbBartNewbornScreen`; `alphaGlobinPositive`; `betaGlobinPositive` | each `eq true` under a negated `any` containing those leaves | each `is-present` under the same negated `any` | Y | If no positive globin result is confirmed—including when tests are unknown—the existing question remains open. |
| 44 | `Q-MICRO-004` (`:2678`) | question | `history.leadExposureRisk`; `history.pica` | each `eq true` inside `any` | each `is-present`; preserve smear sibling | Y | A confirmed risk/smear clue continues to prompt direct blood lead testing. |
| 45 | `Q-MICRO-005` (`:2725`) | question | `history.bleedingHistory` | `eq false` | `not: { is-present }` **[DEVIATION: preserves prompt-on-unknown]** | Y | The question must remain visible when bleeding is either confirmed absent or still unassessed. |
| 46 | `Q-NORMO-HIGH-002` (`:2786`) | question | `history.bleedingHistory` | `eq false` | `not: { is-present }` **[DEVIATION: preserves prompt-on-unknown]** | Y | Unknown bleeding history must continue to prompt the existing blood-loss question. |
| 47 | `Q-NORMO-LOW-001` (`:2819`) | question | `history.renalSignal`; `history.chronicInflammation`; `cbc.multilineageCytopenia` | each `eq true` under a negated `any` containing those leaves | each `is-present` under the same negated `any` | N | When none of the three branches is confirmed—including unknowns—the existing evaluation question stays open. |
| 48 | `Q-SMEAR-001` (`:2935`) | question | `cbc.multilineageCytopenia` | `eq true` inside `any` | `is-present`; preserve other arms | N | Confirmed multilineage cytopenia remains one reason to prompt experienced smear review. |
| 49 | `Q-CYT-001` (`:2982`) | question | `cbc.multilineageCytopenia` | `eq true` | `is-present` | Y | Urgent CBC/smear review is prompted only for confirmed additional cytopenia. |

### Why rows 45/46 deliberately prompt on unknown

A literal `eq false -> is-absent` rewrite would be a functional regression. Today, omitted bleeding
inputs collapse to boolean `false`, so `Q-MICRO-005` and `Q-NORMO-HIGH-002` ask the clinician to
assess blood loss (`rules.json:2725-2752,2786-2818`). After migration the same omission becomes
`'unknown'`; strict `is-absent` would no longer match and the question would disappear exactly when
the information is missing. `not:{is-present}` matches both `'false'` and `'unknown'`, preserving
the data-collection prompt. This does not let unknown establish presence or clear a differential:
the matched output is a `question`, not candidate support or an exclusion.

### Council-review carve-outs — 2, not bundled with the 47 rows

| # | Rule ID (`rules.json` line) | Type | Boolean-collapse leaf(s) in `when` | Today's operator/value | Proposed post-migration operator(s) | Golden impact | One-line clinical rationale |
|---|---|---|---|---|---|---|---|
| 30 | `TEC-001` (`:1716`) | candidate | `cbc.isolatedAnemia`; `history.recentViral`; negated `exam.splenomegaly`/`hepatomegaly`/`lymphadenopathy` | positives `eq true`; `not(any(exam eq true, smear.blasts eq true))` | positives `is-present`; replace the three exam negations with three strict `is-absent` leaves in `all`; retain `not:{smear.blasts eq true}` until smear assessment has a representable state | N | This diagnosis-of-exclusion candidate must not use an unperformed exam as confirmed absence (`TEC-001` caution, `rules.json:1716`; witness limitation `tests/witness/corpus/NOTES.md:569-603`). |
| 42 | `IRIDA-001` (`:2407`) | candidate | `history.priorAdequateIronTrialNoResponse`; `history.adherenceVerified`; negated `history.ongoingBloodLossKnown` | positives `eq true`; `not:{eq true}` for ongoing loss | positives `is-present`; strict `history.ongoingBloodLossKnown is-absent` | N | The rule's own caution requires common nonresponse causes to be excluded; unknown ongoing loss is not confirmed absence (`rules.json:2407`). |

These two rows are **proposals requiring `council-review`**, not instructions for the mechanical
EP1-T5 bulk edit. They are real behavior changes even though today's targeted witnesses explicitly
supply the negative findings (`tests/witness/corpus/transient-erythroblastopenia-childhood.json:9`,
`tests/witness/corpus/iron-refractory-anemia-irida.json:5`). They also require two companion
`question` rules:

- one question for missing TEC exclusion assessment (exam and the currently unrepresentable
  “smear reviewed/no blasts” state);
- one question for unknown ongoing blood loss before IRIDA consideration.

The companion rules' exact gates, wording, evidence, and priority are not invented here; they are
NCR-1/NCR-2 and must be approved with the carve-outs.

### Discrepancies found against SPIKE-003 RQ7(b)

Independent comparison found **no missing/extra rule IDs and no incorrect current source leaf** in
the durable 49-row list. It did find three design-record discrepancies:

1. RQ7(b) row 30 says the three TEC exam leaves become `not:is-present`, but the SPIKE's binding RQ1,
   RQ7 deviation, Recommended design, and Go/no-go text require strict `is-absent`. The durable row
   would preserve exclusion-by-omission instead of applying the stated carve-out.
2. RQ7(b) row 42 says IRIDA's ongoing-loss leaf becomes `not:is-present`, but the binding carve-out
   requires strict `is-absent`.
3. RQ7(b) omits the required golden-fixture-impact column entirely. This record supplies it from a
   live six-example run (17 Y, 32 N).

Adjacent SPIKE prose also says the 49 rows contain 30 candidates; the independently reproduced
count is 34 candidates (the row labels themselves are correct). This prose arithmetic error is not
counted as a fourth RQ7(b)-table discrepancy.

## C. `=== true` / `isTrue()` call-site inventory

### `isTrue()` definition and all 10 call sites

| File:line | Current expression | Post-migration form |
|---|---|---|
| `src/facts/core.js:3` | `isTrue = (value) => value === true` | Remove the derived-fact collapse helper after its callers migrate. Use `toTri(value)` for a Tri fact; retain explicit boolean comparisons only at a documented compatibility boundary. |
| `modules/anemia/facts.anemia.js:87` | `isTrue(localFlags.leukopenia)` OR numeric comparison | `triAny([toTri(localFlags.leukopenia), leukopeniaNumericTri])` |
| `modules/anemia/facts.anemia.js:89` | `isTrue(localFlags.neutropenia)` OR numeric comparison | `triAny([toTri(localFlags.neutropenia), neutropeniaNumericTri])` |
| `modules/anemia/facts.anemia.js:91` | `isTrue(localFlags.thrombocytopenia)` OR numeric comparison | `triAny([toTri(localFlags.thrombocytopenia), thrombocytopeniaNumericTri])` |
| `modules/anemia/facts.anemia.js:95` | `isTrue(localFlags.thrombocytosis)` | `toTri(localFlags.thrombocytosis)` |
| `modules/anemia/facts.anemia.js:178` | `isTrue(labs.hbBartNewbornScreen)` | `toTri(labs.hbBartNewbornScreen)` |
| `modules/anemia/facts.anemia.js:179` | `isTrue(labs.alphaGlobinTestingPositive)` | `toTri(labs.alphaGlobinTestingPositive)` |
| `modules/anemia/facts.anemia.js:180` | `isTrue(labs.betaGlobinTestingPositive)` | `toTri(labs.betaGlobinTestingPositive)` |
| `modules/anemia/facts.anemia.js:181` | `isTrue(labs.sicklingHemoglobinDetected)` | `toTri(labs.sicklingHemoglobinDetected)` |
| `modules/anemia/facts.anemia.js:187` | `isTrue(labs.g6pdTestDuringAcuteHemolysis)` | `toTri(labs.g6pdTestDuringAcuteHemolysis)` |
| `modules/anemia/facts.anemia.js:188` | `isTrue(labs.g6pdTestSoonAfterTransfusion)` | `toTri(labs.g6pdTestSoonAfterTransfusion)` |

For each numeric cytopenia arm, `numericComparisonTri` is `'unknown'` unless both the count and the
caller-supplied local lower limit are available; otherwise it is `'true'`/`'false'` from the
existing comparison. This introduces no cutoff (`facts.anemia.js:87-94`).

### All 25 direct `=== true` occurrences in `facts.anemia.js`

| # | File:line | Current expression | Post-migration form |
|---|---|---|---|
| 1 | `modules/anemia/facts.anemia.js:136` | `history.chronicKidneyDisease === true` | `statusIs(labs.creatinineStatus, 'high') ? 'true' : toTri(history.chronicKidneyDisease)`; record the remaining unknown-status collapse under NCR-3. |
| 2 | `modules/anemia/facts.anemia.js:137` | `history.liverDisease === true` | `statusIs(labs.liverTestsStatus, 'abnormal') ? 'true' : toTri(history.liverDisease)`; record the remaining unknown-status collapse under NCR-3. |
| 3 | `modules/anemia/facts.anemia.js:138` | `history.thyroidDisease === true` | `statusIs(labs.tshStatus, 'high') ? 'true' : toTri(history.thyroidDisease)`; record the remaining unknown-status collapse under NCR-3. |
| 4 | `modules/anemia/facts.anemia.js:200` | `history.recentViralIllness === true` | `toTri(history.recentViralIllness)` |
| 5 | `modules/anemia/facts.anemia.js:209` | `patient.menstruating === true` | `toTri(patient.menstruating)` |
| 6 | `modules/anemia/facts.anemia.js:210` | `patient.recentTransfusion === true` | `toTri(patient.recentTransfusion)` |
| 7 | `modules/anemia/facts.anemia.js:211` | `patient.highAltitude === true` | `toTri(patient.highAltitude)` |
| 8 | `modules/anemia/facts.anemia.js:315` | `symptoms.activeMajorBleeding === true` | `toTri(symptoms.activeMajorBleeding)` |
| 9 | `modules/anemia/facts.anemia.js:316` | `symptoms.jaundice === true` | first input to `triAny([toTri(symptoms.jaundice), toTri(symptoms.darkUrine)])` |
| 10 | `modules/anemia/facts.anemia.js:316` | `symptoms.darkUrine === true` | second input to the same `triAny()` |
| 11 | `modules/anemia/facts.anemia.js:317` | `symptoms.fever === true` | `toTri(symptoms.fever)` |
| 12 | `modules/anemia/facts.anemia.js:318` | `symptoms.alteredMentalStatus === true` | first input to `triAny([toTri(symptoms.alteredMentalStatus), toTri(symptoms.neurologicSymptoms)])` |
| 13 | `modules/anemia/facts.anemia.js:318` | `symptoms.neurologicSymptoms === true` | second input to the same `triAny()` |
| 14 | `modules/anemia/facts.anemia.js:319` | `symptoms.oliguria === true` | first input to `triAny([toTri(symptoms.oliguria), toTri(symptoms.renalSymptoms)])` |
| 15 | `modules/anemia/facts.anemia.js:319` | `symptoms.renalSymptoms === true` | second input to the same `triAny()` |
| 16 | `modules/anemia/facts.anemia.js:320` | `symptoms.fatigue === true` | first input to `triAny([toTri(symptoms.fatigue), toTri(symptoms.pallor)])` |
| 17 | `modules/anemia/facts.anemia.js:320` | `symptoms.pallor === true` | second input to the same `triAny()` |
| 18 | `modules/anemia/facts.anemia.js:323` | `exam.splenomegaly === true` | `toTri(exam.splenomegaly)` |
| 19 | `modules/anemia/facts.anemia.js:324` | `exam.hepatomegaly === true` | `toTri(exam.hepatomegaly)` |
| 20 | `modules/anemia/facts.anemia.js:325` | `exam.lymphadenopathy === true` | `toTri(exam.lymphadenopathy)` |
| 21 | `modules/anemia/facts.anemia.js:326` | `exam.petechiae === true` | first input to `triAny([toTri(exam.petechiae), toTri(exam.unexplainedBruising)])` |
| 22 | `modules/anemia/facts.anemia.js:326` | `exam.unexplainedBruising === true` | second input to the same `triAny()` |
| 23 | `modules/anemia/facts.anemia.js:339` | `history.oxidantMedicationOrFavaExposure === true` | `toTri(history.oxidantMedicationOrFavaExposure)` |
| 24 | `modules/anemia/facts.anemia.js:340` | `history.malariaTravelOrResidence === true` | `toTri(history.malariaTravelOrResidence)` |
| 25 | `modules/anemia/facts.anemia.js:341` | `history.macrocytosisAssociatedMedication === true` | `toTri(history.macrocytosisAssociatedMedication)` |

The hybrid renal/liver/thyroid formulas above are a bounded EP-1 translation, not a claim that
unknown lab statuses have been solved. They preserve a confirmed positive status, preserve the
history Tri when the status is not positive, and expose the remaining `statusIs()` ambiguity for
the separate review rather than silently expanding this phase.

### Other production `=== true` occurrences and their disposition

| File:line | Current expression | Post-migration form / disposition |
|---|---|---|
| `modules/anemia/ranges.js:42` | `menstruating === true` | `toTri(menstruating) === 'true'`. This line is the EP-1-owned shared seam; it must accept both bare boolean and Tri-string input without changing the 30 ng/mL branch or its rationale (`phase-1-tristate-fact-model.md:54-58`; `tests/witness/branch-seam.test.mjs:49-69`). |
| `src/algorithmExplorer.js:308` | `facts.morphology.rdwHigh === true` (and `=== false`) | **Unchanged.** `rdwHigh` is already `true`, `false`, or `null`, not one of the migrated booleanMap-derived facts; the fallback displays “not classifiable” (`facts.anemia.js:42`, SPIKE UI check `:269-276`). |
| `src/facts/tristate.js:8` | `value === true` | **Unchanged normalization boundary.** It maps a wire-compatible bare boolean to the Tri string `'true'`; it does not consume a Tri value via truthiness. |
| `src/ruleEngine.js:35` | `actual === 'true' \|\| actual === true` | **Unchanged compatibility boundary.** It explicitly recognizes Tri `'true'` and a legacy bare boolean; `'unknown'` does not match. |

### Raw `history` passthrough and non-`=== true` collapse seams

The open `history: { ...history }` spread (`facts.anemia.js:328-342`) would otherwise leak bare
booleans into rules even after the aggregate migration. EP1-T4 must explicitly normalize these ten
direct rule-consumed passthrough facts with `toTri(history.<field>)` after the spread:

| Fact paths requiring explicit override |
|---|
| `history.pica`; `history.leadExposureRisk` |
| `history.knownHereditarySpherocytosis`; `history.knownSickleCellDisease` |
| `history.thumbOrRadiusAnomaly`; `history.abnormalSkinPigmentation`; `history.shortStature` |
| `history.priorAdequateIronTrialNoResponse`; `history.adherenceVerified`; `history.ongoingBloodLossKnown` |

The four paths absent from the source-body census—`adherenceVerified`, `leadExposureRisk`,
`ongoingBloodLossKnown`, and `priorAdequateIronTrialNoResponse`—are live rule inputs
(`rules.json:987,2407`) and must not remain raw merely because they arrive through the spread.

`cbc.rbcRelativelyHigh` is another affected fact without an `=== true` source expression
(`facts.anemia.js:175`). Re-express it as `'true'` for `high-for-age`, `'false'` for a known
non-high interpretation, and `'unknown'` for missing/`unknown`; no new RBC cutoff is introduced.

### Non-aggregate Tri truthiness hazards discovered

| File:line | Hazard | Required post-migration form |
|---|---|---|
| `tests/witness/alerts.test.mjs:194-198` | `.filter(Boolean).length` over three facts would count `'true'`, `'false'`, and `'unknown'` equally. | `countPresent([facts.cbc.thrombocytopenia, facts.symptoms.renalSymptoms, facts.symptoms.neurologicSymptoms])`, or an explicit `value === 'true'` filter. |
| `src/app.js:448` | `Boolean(val)` marks wire strings `"false"` and `"unknown"` as checked when loading an example/input. | For clinical checkbox fields, `element.checked = toTri(val) === 'true'`; keep non-clinical UI booleans separate. |
| `src/app.js:485` | `Boolean(input.symptoms?.[name])` treats `"unknown"` as an immediate safety flag. | `toTri(input.symptoms?.[name]) === 'true'`. Unknown must remain unselected and must not be reported as a present red flag. |
| `modules/anemia/index.js:29` | `if (facts.patient.recentTransfusion)` would treat `'false'` and `'unknown'` as true and append a transfusion limitation. | `if (facts.patient.recentTransfusion === 'true')`. |
| `modules/anemia/index.js:34` | `if (facts.patient.highAltitude)` would treat `'false'` and `'unknown'` as true and append an altitude limitation. | `if (facts.patient.highAltitude === 'true')`. |
| `src/ruleEngine.js:33` | Generic `truthy` would match every Tri string. No current anemia rule uses `truthy`/`falsy`, but the operator remains available. | KB validation must reject `truthy`/`falsy` for registered Tri fact paths; migrated rules use the explicit four operators. |

The other production `Boolean()`/`.filter(Boolean)` sites found by the census consume DOM state,
range-provenance strings, or output text/evidence arrays rather than Tri facts
(`facts.anemia.js:217`, `algorithmExplorer.js:25`, `ruleEngine.js:56-62`, `src/evidence.js:27`).

## D. Expected-diff prediction

### Published examples and golden outputs

For the **47 behavior-preserving rows plus the aggregate/fact-shape migration**, the prediction is
no CDS-output diff in any of the six published examples, after normalizing `meta.generatedAt`.
“No diff” covers classification, alerts, ranked candidates and ordinal rank, questions, notes,
limitations, `matchedRuleIds`, and every `ruleAudit.matched` value. The current activation surface
is:

| Input fixture | Currently activated affected rules | Predicted CDS-output diff |
|---|---|---|
| `examples/anemia-inflammation.json` | `AINF-002`, `AINF-004` | None; both positive Tri leaves remain confirmed present. |
| `examples/beta-thalassemia-trait.json` | `THAL-001`, `THAL-002`, `Q-MICRO-005` | None; family/RBC support stays present and the unknown bleeding question stays visible. |
| `examples/hemolysis-hs.json` | `HEM-002`, `HS-002`, `Q-NORMO-HIGH-002` | None; positive symptom/exam/history leaves remain present and the bleeding question remains visible. |
| `examples/ida-toddler.json` | `ID-006`, `LEAD-002`, `Q-MICRO-004`, `Q-MICRO-005` | None; confirmed risk/pica leaves stay present and the unknown bleeding prompt is preserved. |
| `examples/lead-capillary.json` | `Q-MICRO-003`, `Q-MICRO-005` | None; unknown globin/bleeding data continue to prompt questions. |
| `examples/marrow-red-flags.json` | `ALERT-004`, `ALERT-009`, `MARROW-001`, `MARROW-003`, `Q-CYT-001` | None; all alert/candidate/question inputs remain confirmed present. |

The two carve-outs also predict no diff in these six because neither `TEC-001` nor `IRIDA-001`
activates in a published example. A staged migration is explicitly expected to break
`ida-toddler.json` by making old `eq true` fail against `'true'`; that is a rollout defect, not an
acceptable expected diff (SPIKE-003 RQ3, `:366-379`).

The no-diff prediction also requires the two non-rule limitation consumers at
`modules/anemia/index.js:29,34` to use `=== 'true'`. If they remain as truthiness checks, every
published example's explicit `recentTransfusion: false` and `highAltitude: false` becomes a
non-empty `'false'` string, and every golden output incorrectly gains both limitation messages.
That would be a predictable implementation defect, not an acceptable migration diff.

### `tests/witness/**`

All **48 witness JSON inputs** (24 corpus, 9 alert, 15 branch/seam) are predicted to retain the same
CDS output and matched-rule set under the atomic design. The most failure-sensitive cases are:

| Fixture(s) | Why sensitive | Predicted CDS-output diff |
|---|---|---|
| `tests/witness/corpus/transient-erythroblastopenia-childhood.json` | Targets `TEC-001`; all three exam exclusions are explicitly `false` (`:9`). | None under the strict carve-out: each becomes `is-absent`, so `TEC-001` remains matched. The absent-vs-unreviewed smear gap remains NCR-1. |
| `tests/witness/corpus/iron-refractory-anemia-irida.json` | Targets `IRIDA-001`; `ongoingBloodLossKnown` is explicitly `false` (`:5`). | None under the strict carve-out: `is-absent` matches and `IRIDA-001` remains active. |
| `tests/witness/corpus/*` fixtures currently activating `Q-MICRO-005`, `Q-NORMO-HIGH-002`, `Q-MICRO-003`, or `Q-NORMO-LOW-001` | These questions intentionally match when their investigated facts are unknown. | None; the negated `is-present` forms preserve the prompts. |
| `tests/witness/alerts/tma-schistocytes-*.json` | Exercise each Tri-migrated `ALERT-006` arm in isolation. | None in alerts/matched rules; only the one confirmed arm satisfies `is-present`. |
| `tests/witness/alerts/unstable-major-bleeding-severe-anemia.json` | Exercises `ALERT-001`, `ALERT-002`, and `LOSS-003`. | None; confirmed symptom values normalize to `'true'` and still match `is-present`. |
| `tests/witness/branches/ferritin-menstruating-under-adolescent-band.json` | Pins the shared `ranges.js:42` seam, threshold 30, rationale, and low-ferritin result (`branch-seam.test.mjs:49-69`). | None; `toTri(menstruating) === 'true'` must preserve all three assertions. |
| All other witness JSON files | They either exercise only behavior-preserving positive/negated mappings or no affected rule. | None. |

There **are** expected fact-level/test-expectation diffs in
`tests/witness/alerts.test.mjs:106-207`, even though CDS outputs remain stable:

| Fixture | Expected derived Tri facts after migration |
|---|---|
| `tma-schistocytes-thrombocytopenia.json` | `cbc.thrombocytopenia = 'true'`; unreported renal/neurologic arms = `'unknown'`. |
| `tma-schistocytes-renal-symptoms.json` | `cbc.thrombocytopenia = 'unknown'` (no local flag/lower limit); `renalSymptoms = 'true'`; `neurologicSymptoms = 'unknown'`. |
| `tma-schistocytes-neurologic-symptoms.json` | `cbc.thrombocytopenia = 'unknown'`; `renalSymptoms = 'unknown'`; `neurologicSymptoms = 'true'`. |

The direct assertions must change from booleans to these strings, and the isolation count must use
`countPresent()` rather than `.filter(Boolean)`. Treating these expected fact-shape diffs as CDS
output changes would be inaccurate; treating them as no test change would also be inaccurate.

The two not-yet-authored companion question rules are excluded from the no-diff prediction. Their
exact activation surface cannot be predicted until NCR-1/NCR-2 are clinically approved. Any later
implementation that adds them must append a fixture-by-fixture diff prediction before changing a
golden baseline.

## E. Open questions and `NEEDS-CLINICAL-REVIEW`

There are **4 `NEEDS-CLINICAL-REVIEW` items**:

1. **NCR-1 — TEC exclusion and companion question (`council-review`).** Approve or reject the three
   strict exam `is-absent` gates, specify the companion question's gate/wording/evidence/priority,
   and resolve how “smear reviewed with no blasts” can be represented. Today `smear: []` cannot
   distinguish reviewed-negative from unassessed (`tests/witness/corpus/NOTES.md:569-603`). Until
   approved, do not merge row 30 with the 47 mechanical rows.
2. **NCR-2 — IRIDA exclusion and companion question (`council-review`).** Approve or reject strict
   `ongoingBloodLossKnown is-absent` and specify the companion question. The repo supplies the
   current rule caution but no signed clinical approval for the tightened behavior
   (`rules.json:2407`; SPIKE Go/no-go `:661-683`). Until approved, do not merge row 42 with the
   mechanical rows.
3. **NCR-3 — `statusIs()`/`hemolysisMarkerCount` missingness.** Decide, in a separate scoped record,
   how unknown categorical lab statuses propagate through hemolysis and the renal/liver/thyroid
   hybrid facts. This record preserves current status behavior and explicitly does not call an
   unknown status normal (`src/facts/core.js:4`; SPIKE Risks `:597-603`).
4. **NCR-4 — incomplete congenital-signal prompting.** `congenitalSignalCount` is resolved as a
   confirmed-present count paired with `congenitalSignalsFullyAssessed`, but the repo contains no
   approved question rule for `count === 0 && !fullyAssessed`. Decide whether such a prompt should
   exist and, if so, its scope, wording, priority, and evidence. Do not infer it from the count.

Non-clinical follow-ups that do not change this count:

- DEF-3/P1-WP3 still owns whether Tri facts need fact-level provenance distinct from rule evidence
  (`tri-state-fact-model.md:162-168`).
- KB validation should forbid `truthy`/`falsy` on registered Tri paths and flag `countTrue()` or
  `Boolean()` over Tri values.
- The browser input loader must normalize Tri strings explicitly at `src/app.js:448,485`; otherwise
  schema-valid wire values can be mis-rendered before assessment.

## Mechanical handoff constraints

- EP1-T4 applies section A and section C atomically, including inner and outer aggregate sites.
- EP1-T5 applies the 47 behavior-preserving rows exactly. Rows 30/42 are a separately reviewed
  sub-change and cannot be treated as mechanical completion evidence.
- No golden baseline is recaptured for the 47-row change because no CDS-output diff is predicted.
  Any observed diff is unexpected and blocks completion until explained.
- The later diff record must separately report public CDS output, `ruleAudit`, and fact-level test
  expectation changes; “tests pass” is not a substitute for enumerating them.
- Human clinical council review is required before any behavior-changing rule or companion question
  is accepted. This draft is not clinical sign-off.

---

## Orchestrator adjudication (EP-1 phase owner, 2026-07-20)

This record is **accepted as the binding implementation contract for EP1-T4/EP1-T5**, with one
correction that changes what "carve-out" means mechanically. It remains a proposal, not clinical
sign-off (CLAUDE.md: no AI-published rule changes).

### Correction — the carve-out defers the *tightening*, not the whole row

Sections B and "Mechanical handoff constraints" instruct EP1-T5 to apply 47 rows and leave rows 30
(`TEC-001`) and 42 (`IRIDA-001`) untouched. **Applied literally, that ships a silent regression.**

`src/ruleEngine.js`'s `eq` is strict identity (`actual === expected`). After EP1-T4 makes
`cbc.isolatedAnemia`, `history.recentViral`, `history.priorAdequateIronTrialNoResponse`,
`history.adherenceVerified` and the `exam.*` fields Tri-valued, a surviving `{op: eq, value: true}`
leaf compares `'true' === true` and is **permanently false**. `TEC-001` and `IRIDA-001` would stop
matching entirely, with no test failure — precisely the staged-rollout hazard SPIKE-003 RQ3 proved
(`spike-003…:36-39, 548-550`). A rule that silently never fires is a worse safety outcome than
either the current or the tightened behavior.

The carve-out is therefore split into two stages:

| Stage | Scope | Where it lands |
|---|---|---|
| **1 — behavior-preserving (this phase, EP1-T5)** | Positive leaves `{eq true}` → `is-present`. Negations stay wrapped as `not:{… is-present}`. | The mechanical bulk edit, alongside the other 47 rows. **All 49 rows migrate.** |
| **2 — tightening (deferred, NCR-1/NCR-2)** | `not:{… is-present}` → strict `is-absent` on the three `TEC-001` exam leaves and `IRIDA-001`'s `ongoingBloodLossKnown`, plus the 2 companion question rules. | A separate `council-review`-gated sub-change. **Not in EP-1.** |

Stage 1 is exactly behavior-preserving: today `not:{eq true}` matches when the field is `false` or
absent; after migration `not:{is-present}` matches when the field is `'false'` or `'unknown'` — the
same input populations, because `toTri()` maps absent → `'unknown'`. No differential is cleared on
evidence that was not already clearing it today.

### Correction — aggregate row 2 uses hybrid flag/numeric precedence

Aggregate row 2's table formula, `triAny([toTri(localFlag), numericComparisonTri])`, was not the
landed form. Applied literally, an absent **optional** `cbc.localFlags` override becomes `'unknown'`;
that would force the aggregate to `'unknown'` even when the numeric comparison resolves, suppressing
`TEC-001` and `IMF-DBA-001`.

The landed form is the hybrid precedence SPIKE-003 Recommended design §3 called for, implemented in
`modules/anemia/facts.anemia.js:20-28` and applied to the three lineage facts at
`modules/anemia/facts.anemia.js:113-127`: an
explicit-present flag wins; otherwise a resolvable numeric comparison (both the value and its
`localRanges.*Lower` bound are present) is itself an assessment; otherwise an explicit-absent flag
wins; otherwise the fact is `'unknown'`. No local bound is defaulted. This is the row-2 correction
landed in commit `188d717`; it supersedes the table formula above.

### Consequently, "Discrepancies found against SPIKE-003 RQ7(b)" items 1 and 2 are withdrawn

They are not table errors. RQ7(b)'s `not:is-present` encodes the **Stage 1** state and is correct
for the mechanical pass; the SPIKE's RQ1/Go-no-go prose encodes the **Stage 2** target. Both are
right at their own stage. Discrepancy 3 (the missing golden-impact column) stands, and the
candidate-count arithmetic note (30 vs. the reproduced 34) stands.

### Accepted as written

- All 9 aggregate formulas, including `triAny`/`triAll`/`triNone` as binding semantics.
- The `ironRiskHistory` → `bleedingHistory` → `activeMajorBleeding` nested migration, atomically.
- `marrow.congenitalSignalCount` = confirmed-present count, paired with the new
  `marrow.congenitalSignalsFullyAssessed` completeness fact. This satisfies EP1-T3's named
  acceptance criterion (an explicit stated decision for the one raw-count aggregate).
- Rows 45/46's deliberate prompt-on-unknown deviation.
- `hemolysisMarkerCount` / `statusIs()` remaining out of scope (NCR-3), consistent with SPIKE-003.

### Open items carried out of EP-1

NCR-1, NCR-2 (Stage 2 above), NCR-3, and NCR-4 all require named human clinical reviewers and leave
this phase unresolved. They must be filed before EP-1 is called done; none may be closed by agent
output.
