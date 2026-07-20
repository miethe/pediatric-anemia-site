# `tests/witness/corpus/` — fixture notes (EP05-T2)

Per-fixture record of which rules each input witnesses, the one-sentence clinical picture, and —
for every **threshold-bearing value** (a number an actual rule condition compares against a KB or
code-literal cutoff) — the existing KB threshold it was chosen against and which side of it the
value sits on. This is the evidence trail for the "no new clinical claims, no new or retuned
thresholds" gate and the input to the T5 clinical-plausibility review.

**Not every number below is threshold-bearing.** Many CBC values (RBC, WBC, ANC, platelets, RDW,
and several Hb/MCV values used only for internal coherence) are ordinary observational values
chosen so a fixture reads as a complete, physiologically sensible patient — not against a cutoff
any rule reads. Where a number IS threshold-bearing, this file says which threshold and which side
of it; where it is not, that is stated explicitly rather than left to imply a cutoff that does not
exist.

None of these fixtures are published (see `tests/witness/README.md`); they exist only to make the
52 candidate/note/question rules enumerated in EP05-T2 fire, asserted by `tests/witness/corpus.test.mjs`
via `result.provenance.matchedRuleIds`. The 9 `ALERT-*`/`SCOPE-*` rules are a parallel task's scope
(`tests/witness/alerts/`) and are not targeted here; where a fixture below incidentally also fires
an alert rule (e.g. `ALERT-004`, `ALERT-006`, `ALERT-009`), that is a true, expected side effect of
a clinically coherent picture, not something authored or asserted by this corpus.

Reference tables used throughout (all pre-existing, none introduced here):
- `modules/anemia/reference-ranges.json` — AAP2026_IDA hb/mcv/rdw bands by age (months) and sex.
- `modules/anemia/ranges.js` `ferritinThresholdRule()` — ferritin threshold: 30 ng/mL if
  `menstruating === true`, else 30 ng/mL for ages 144–<216 months, else 20 ng/mL for ages 6–<144
  months.
- `modules/anemia/facts.anemia.js` — fixed literals: `severeIdaHbCategory` = hb < 7; `stfrIndexHigh`
  = sTfR/log10(ferritin) index > 2; `stfrIndexLow` = index < 1; `hemolysisPattern` = ≥2 of
  {indirect bilirubin high, LDH high, haptoglobin low}; `ageCompatibleWithTec` = 6–<72 months;
  `ageCompatibleWithDba` = <12 months; `lead20to44`/`lead45Plus` (not used by this corpus — owned
  by the alert task).

---

## `microcytic-no-ferritin-iron-risk.json`

**Witnesses:** `ID-002`, `Q-MICRO-001`, `Q-004`.

**Clinical picture:** A 30-month-old girl with excessive cow's-milk intake presents with
microcytic, high-RDW anemia; no ferritin has been sent yet.

**Thresholds used:**
- `patient.ageMonths: 30`, `sexAtBirth: "female"` → selects the "2 to <6 years" band
  (`reference-ranges.json`): `hbLower 11`, `mcvLower 75.2`, `rdwUpper 14.5`.
- `cbc.hemoglobin: 8` — below `hbLower` 11 → `anemia.present`.
- `cbc.mcv: 68` — below `mcvLower` 75.2 → `morphology.microcytic`.
- `cbc.rdw: 16` — above `rdwUpper` 14.5 → `morphology.rdwHigh`.
- `history.excessCowMilk: true` — one of the boolean inputs `facts.anemia.js` counts into
  `ironRiskHistory` (no numeric threshold; existence of the flag is the condition).
- No `labs.ferritin` supplied → `ferritin.available === false`, satisfying both `ID-002` and
  `Q-MICRO-001`'s `ferritin.available: false` leaf directly.
- No `reticulocytes` object supplied → `retic.response` defaults to `"unknown"` → `retic.unknown`,
  satisfying `Q-004` (`anemia.present` + `retic.unknown`).

---

## `microcytic-alpha-thalassemia-nonlow-ferritin.json`

**Witnesses:** `Q-MICRO-002`, `THAL-ALPHA-001`, `THAL-ALPHA-002`.

**Clinical picture:** A 3-year-old boy with a family history of alpha-thalassemia, an abnormal
newborn screen (Hb Bart's), and confirmatory alpha-globin molecular testing now positive, being
worked up for microcytic anemia with a ferritin that is not low and no CRP sent yet.

**Thresholds used:**
- `patient.ageMonths: 36`, `sexAtBirth: "male"` → "2 to <6 years" band: `hbLower 11`,
  `mcvLower 74.1`.
- `cbc.hemoglobin: 9` (< 11) → anemia present. `cbc.mcv: 68` (< 74.1) → microcytic.
- `labs.ferritin: 25` — ferritin threshold for age 36 months (6–<144 band) is **20** ng/mL
  (`getFerritinThreshold`); 25 > 20 → `ferritin.notLow`.
- No `labs.crpStatus` supplied → `ferritin.crpKnown === false`, satisfying `Q-MICRO-002`
  (`microcytic` + `ferritin.notLow` + `crpKnown === false`).
- `labs.hbBartNewbornScreen: true` — direct boolean match for `THAL-ALPHA-001`.
- `labs.alphaGlobinTestingPositive: true` — direct boolean match for `THAL-ALPHA-002`.

---

## `iron-deficiency-without-anemia.json`

**Witnesses:** `ID-004`, `NOTE-001`.

**Clinical picture:** An 8-year-old girl with a normal hemoglobin but a low ferritin found on
screening — iron deficiency without anemia.

**Thresholds used:**
- `patient.ageMonths: 96`, `sexAtBirth: "female"` → "6 to <12 years" band: `hbLower 11.2`.
- `cbc.hemoglobin: 12` — at/above 11.2 → `anemia.absent` (satisfies `NOTE-001` directly, and the
  `anemia.absent` leaf of `ID-004`).
- `labs.ferritin: 8` — ferritin threshold for age 96 months is 20 ng/mL; 8 ≤ 20 → `ferritin.low`
  (satisfies `ID-004`'s second leaf).

---

## `blood-loss-adolescent.json`

**Witnesses:** `LOSS-001`, `LOSS-002`, `LOSS-003`.

**Clinical picture:** A 14-year-old girl (non-menstruating; loss is gastrointestinal) with an
acute-on-chronic GI bleed: active bleeding now, a compensatory high reticulocyte response, and a
low ferritin reflecting chronically depleted iron stores.

**Thresholds used:**
- `patient.ageMonths: 168`, `sexAtBirth: "female"`, `menstruating: false` → "12 to <18 years" band:
  `hbLower 11.4`. Ferritin threshold for this age/menstrual status (not menstruating, age
  144–<216) is **30** ng/mL (`ranges.js` "adolescent age band" branch).
- `cbc.hemoglobin: 7.5` — below 11.4 → anemia present.
- `reticulocytes.response: "high"` → `retic.high`.
- `history.giBloodLoss: true` → counted into `bleedingHistory` (boolean flag, no threshold).
- `symptoms.activeMajorBleeding: true` → direct match for `LOSS-003`'s condition, and also counted
  into `bleedingHistory`.
- `labs.ferritin: 10` — 10 ≤ 30 → `ferritin.low`, satisfying `LOSS-002`.
- (Incidentally also fires `ALERT-002`/`ALERT-003`, owned by the parallel alert-witness task —
  expected side effect of active bleeding + hb < 7 is not present here since hb is 7.5, so
  `ALERT-003` does not fire; `ALERT-002` is a true side effect of `activeMajorBleeding`.)

---

## `administrative-interpretation-caveats.json`

**Witnesses:** `MIX-002`, `NOTE-005`, `NOTE-006`.

**Clinical picture:** A well 5-year-old girl with a normal CBC who happens to have had a recent
transfusion and lives at high altitude — two independent interpretation caveats, neither of which
implies a diagnosis.

**Thresholds used:** None numeric — all three rules are direct boolean matches:
`patient.recentTransfusion: true` (→ `MIX-002` and `NOTE-005`), `patient.highAltitude: true`
(→ `NOTE-006`). `cbc.hemoglobin: 12`/`mcv: 80` are ordinary in-range values (within the "2 to <6
years" band's `hbLower 11`/`mcvLower 75.2`/`mcvUpper 85`) included only so the patient is a
complete, unremarkable well-child record rather than a bare flag pair.

---

## `g6pd-oxidant-hemolysis-tested-during-acute-episode.json`

**Witnesses:** `G6PD-002`, `G6PD-003`, `NOTE-004`.

**Clinical picture:** A 5-year-old boy with an oxidant-drug/fava exposure develops acute hemolysis
with bite/blister cells on smear; a G6PD assay sent during the acute episode returns "normal,"
which is potentially falsely reassuring given the timing (reticulocytosis/acute hemolysis can mask
true deficiency).

**Thresholds used:** All boolean/categorical, no numeric cutoffs.
- `labs.indirectBilirubinStatus: "high"`, `labs.ldhStatus: "high"` — 2 of the 3 hemolysis markers
  `facts.anemia.js` counts → `hemolysisMarkerCount: 2` ≥ 2 → `hemolysis.pattern`.
- `smear: ["bite-or-blister-cells"]` → `smear.biteOrBlisterCells`.
- `history.oxidantMedicationOrFavaExposure: true` → `history.oxidantTrigger`.
  → satisfies `G6PD-002` (`hemolysis.pattern` + `biteOrBlisterCells` + `oxidantTrigger`).
- `labs.g6pdStatus: "normal"` → `g6pd.normal`.
- `labs.g6pdTestDuringAcuteHemolysis: true` → `g6pd.testedDuringAcuteHemolysis`.
  → satisfies `G6PD-003` and `NOTE-004` (`g6pd.normal` + `testedDuringAcuteHemolysis`, plus the
  bite/blister-cells clue already present for `G6PD-003`'s second `any` clause).

---

## `g6pd-deficient-hemolysis-retic-pending.json`

**Witnesses:** `G6PD-001`, `HEM-003`.

**Clinical picture:** A 4-year-old boy with a quantitative G6PD assay reported deficient and
biochemical hemolysis markers, evaluated before a reticulocyte count has resulted.

**Thresholds used:**
- `labs.g6pdStatus: "deficient"` → direct match for `G6PD-001`.
- `labs.indirectBilirubinStatus: "high"`, `labs.ldhStatus: "high"` → `hemolysisMarkerCount: 2` ≥ 2
  → `hemolysis.pattern`.
- No `reticulocytes` object → `retic.unknown`.
  → satisfies `HEM-003` (`anemia.present` + `hemolysis.pattern` + `retic.unknown`).
- `cbc.hemoglobin: 8` at age 48 months, "2 to <6 years" band `hbLower 11` → anemia present.

---

## `autoimmune-hemolytic-anemia.json`

**Witnesses:** `AIHA-001`.

**Clinical picture:** A 5-year-old girl with jaundice, a high reticulocyte response, a full
hemolysis panel, and a positive direct antiglobulin test — autoimmune hemolytic anemia.

**Thresholds used:**
- `labs.indirectBilirubinStatus/ldhStatus: "high"`, `labs.haptoglobinStatus: "low"` → 3 of 3
  markers → `hemolysis.pattern`.
- `labs.datStatus: "positive"` → `hemolysis.datPositive`.
  → satisfies `AIHA-001` (`hemolysis.pattern` + `datPositive`), both direct boolean/categorical
  matches, no numeric threshold.

---

## `possible-hemolysis-malaria-incomplete-workup.json`

**Witnesses:** `Q-NORMO-HIGH-001`, `MAL-001`.

**Clinical picture:** A 7-year-old boy with fever and a malaria-endemic travel history presents
with normocytic anemia and a high reticulocyte response; no hemolysis labs have been sent yet.

**Thresholds used:**
- `patient.ageMonths: 84`, `sexAtBirth: "male"` → "6 to <12 years" band: `hbLower 11.3`,
  `mcvLower 77.8`, `mcvUpper 86.5`.
- `cbc.hemoglobin: 9` (< 11.3) → anemia present. `cbc.mcv: 82` (within 77.8–86.5) → normocytic.
- `reticulocytes.response: "high"` → `retic.high`.
- No hemolysis labs supplied → `hemolysisMarkerCount: 0` < 2 → satisfies `Q-NORMO-HIGH-001`
  (`normocytic` + `retic.high` + `hemolysis.markerCount < 2`).
- `history.malariaTravelOrResidence: true` → `history.malariaRisk`. `symptoms.fever: true`.
  → satisfies `MAL-001` (`malariaRisk` + `fever` + `anemia.present`, the `any` clause's second
  disjunct since no hemolysis pattern is established yet).

---

## `microangiopathic-hemolysis-tma.json`

**Witnesses:** `TMA-001`.

**Clinical picture:** A 5-year-old girl with schistocytes on smear, thrombocytopenia, and a high
reticulocyte response — a microangiopathic hemolysis pattern.

**Thresholds used:**
- `smear: ["schistocytes"]` → `smear.schistocytes`.
- `reticulocytes.response: "high"` → `retic.high`, satisfying `TMA-001`'s `any` clause
  (`hemolysis.pattern OR retic.high`).
- `cbc.localFlags.thrombocytopenia: true` — direct boolean flag path in `facts.anemia.js`
  (`isTrue(localFlags.thrombocytopenia)`), included for clinical coherence (classic TMA triad)
  though not required by `TMA-001` itself; also incidentally satisfies the parallel alert task's
  `ALERT-006` (schistocytes + thrombocytopenia), a true and expected side effect.

---

## `sickle-cell-parvovirus-aplastic-crisis.json`

**Witnesses:** `SICKLE-001`, `PARVO-001`.

**Clinical picture:** An 8-year-old boy with known sickle cell disease and a recent viral illness
presents with severe reticulocytopenic anemia and sickle cells on smear — a classic parvovirus
B19-triggered transient aplastic crisis.

**Thresholds used:**
- `history.knownSickleCellDisease: true` — direct match for `SICKLE-001`'s `any` clause, and one of
  the four flags `facts.anemia.js` counts into `knownChronicHemolyticDisease`.
- `smear: ["sickle-cells"]` → `smear.sickleCells`, a second independent match for `SICKLE-001`.
- `reticulocytes.response: "low"` → `retic.low` (aplastic crisis — the marrow has stopped
  responding, unlike this patient's usual chronic hemolytic compensation).
- `history.recentViralIllness: true` → `history.recentViral`.
  → satisfies `PARVO-001` (`anemia.present` + `retic.low` + `knownChronicHemolyticDisease` +
  `recentViral`).
- `patient.ageMonths: 96` was deliberately chosen **outside** `ageCompatibleWithTec`'s 6–<72 month
  band (`facts.anemia.js`) so `TEC-001` does not also fire here: `TEC-001`'s condition does not
  exclude known chronic hemolytic disease, so a patient inside that age band who also met
  `TEC-001`'s other leaves would make it fire for the wrong reason (this is not idiopathic TEC —
  it is parvovirus-induced aplastic crisis in a child with known SCD). Age 96 months makes
  `ageCompatibleWithTec` false regardless, avoiding that false-positive overlap.
- `cbc.mcv: 82` at "6 to <12 years" male band (`mcvLower 77.8`, `mcvUpper 86.5`) → normocytic,
  consistent with acute marrow shutdown rather than a chronic microcytic/macrocytic process.

---

## `transient-erythroblastopenia-childhood.json`

**Witnesses:** `TEC-001`, `Q-NORMO-LOW-001`.

**Clinical picture:** A previously healthy 30-month-old girl develops isolated normocytic,
reticulocytopenic anemia two weeks after a viral illness, with no organomegaly, lymphadenopathy,
or blasts — transient erythroblastopenia of childhood.

**Thresholds used:**
- `patient.ageMonths: 30` — within `ageCompatibleWithTec`'s 6–<72 month band (`facts.anemia.js`).
- `sexAtBirth: "female"` → "2 to <6 years" band: `hbLower 11`, `mcvLower 75.2`, `mcvUpper 85`.
- `cbc.hemoglobin: 9` (< 11) → anemia present. `cbc.mcv: 80` (within 75.2–85) → normocytic.
- `reticulocytes.response: "low"` → `retic.low`.
- No `localFlags`/abnormal WBC/ANC/platelet values supplied → `additionalCytopeniaCount: 0` →
  `cbc.isolatedAnemia` true. (This particular leaf is still satisfied by omission rather than a
  genuine "other lineages checked and normal" input, the same pattern fixed explicitly for
  `diamond-blackfan-infant.json` above; it was left as-is here because the fix requested for this
  fixture was scoped to the exam/organomegaly exclusion below, not this leaf — see the "KNOWN
  LIMITATION" section for the general point.)
- `history.recentViralIllness: true` → `history.recentViral`.
- `exam.splenomegaly: false`, `exam.hepatomegaly: false`, `exam.lymphadenopathy: false` — **set
  explicitly (EP05-T5 fix)**. These were previously omitted, and the `not(any(splenomegaly,
  hepatomegaly, lymphadenopathy, blasts))` clause is satisfied identically whether they are `false`
  or absent (an `=== true` check fails either way). Setting them explicitly documents that this
  fixture is meant to represent a child in whom organomegaly/lymphadenopathy were sought and not
  found — but, per the "KNOWN LIMITATION" section below, this does **not** make the test actually
  distinguish "examined and normal" from "not examined" in today's fact model. `smear: []`
  similarly cannot express "smear reviewed, no blasts seen" versus "no smear done at all" — there
  is no field for that distinction today.
  → satisfies `TEC-001` in full, and also `Q-NORMO-LOW-001` (`normocytic` + `retic.low` +
  `not(any(renalSignal, chronicInflammation, multilineageCytopenia))` — none of those three are
  present here either).

---

## `renal-anemia.json`

**Witnesses:** `REN-001`.

**Clinical picture:** A 10-year-old girl with known chronic kidney disease presents with
normocytic, hypoproliferative (reticulocytopenic) anemia — anemia of chronic kidney disease.

**Thresholds used:**
- `patient.ageMonths: 120`, `sexAtBirth: "female"` → "6 to <12 years" band: `hbLower 11.2`,
  `mcvLower 78.3`, `mcvUpper 87.7`.
- `cbc.hemoglobin: 9` (< 11.2) → anemia present. `cbc.mcv: 82` (within band) → normocytic.
- `reticulocytes.response: "low"` → `retic.low`.
- `history.chronicKidneyDisease: true` → direct boolean match feeding `history.renalSignal`.

---

## `fanconi-anemia-phenotype.json`

**Witnesses:** `IMF-FANCONI-001`.

**Clinical picture:** A 5-year-old boy with anemia, thrombocytopenia, abnormal skin pigmentation,
and short stature — physical and hematologic findings compatible with Fanconi anemia.

**Thresholds used:**
- `cbc.hemoglobin: 8` at "2 to <6 years" band (`hbLower 11`) → anemia present.
- `cbc.localFlags.thrombocytopenia: true` → `additionalCytopeniaCount ≥ 1` with anemia present →
  `cbc.multilineageCytopenia`.
- `history.abnormalSkinPigmentation: true`, `history.shortStature: true` — direct boolean matches
  for `IMF-FANCONI-001`'s `any` clause (only one is required; both included for a fuller phenotype).

---

## `copper-deficiency-anemia.json`

**Witnesses:** `COPPER-001`.

**Clinical picture:** A 4-year-old girl with anemia, neutropenia, and a low serum copper — copper
deficiency.

**Thresholds used:**
- `cbc.hemoglobin: 8` at "2 to <6 years" band (`hbLower 11`) → anemia present.
- `cbc.localFlags.neutropenia: true` → `cbc.neutropenia` directly (boolean flag path).
- `labs.copperStatus: "low"` → `nutrition.copperLow`.

---

## `diamond-blackfan-infant.json`

**Witnesses:** `IMF-001`, `IMF-DBA-001`.

**Clinical picture:** An 8-month-old girl with isolated macrocytic, reticulocytopenic anemia and a
thumb anomaly — a Diamond-Blackfan-anemia-compatible pattern.

**Thresholds used:**
- `patient.ageMonths: 8` — ≥6 and <216 (supported age), and <12 → `marrow.ageCompatibleWithDba`
  (`facts.anemia.js`).
- `sexAtBirth: "female"` → "6 to <24 months" band: `hbLower 11`, `mcvUpper 83.2`.
- `cbc.hemoglobin: 8` (< 11) → anemia present. `cbc.mcv: 90` (> 83.2) → macrocytic.
- `reticulocytes.response: "low"` → `retic.low`.
- `cbc.wbc: 8`, `cbc.anc: 3`, `cbc.platelets: 300` with `cbc.localRanges: { wbcLower: 4.0,
  ancLower: 1.5, plateletsLower: 150 }` — **added in EP05-T5**. Previously this fixture supplied no
  WBC/ANC/platelet values at all, so `cbc.isolatedAnemia` (`additionalCytopeniaCount === 0`) was
  true only because `leukopenia`/`neutropenia`/`thrombocytopenia` all short-circuit `false` in
  `facts.anemia.js` when their `localRanges` lower bound is absent — the fixture never actually
  exercised the "other lineages are normal" derivation, it just supplied nothing for it to derive
  from. An adversarial review correctly identified this as "missingness treated as normal." The
  values now supplied are each above their paired local lower bound (8 > 4.0, 3 > 1.5, 300 > 150),
  so `leukopenia`/`neutropenia`/`thrombocytopenia` are now genuinely computed and found `false`,
  and `cbc.isolatedAnemia` is a real derivation, not an artifact of absent input. **The three
  `localRanges` values (`wbcLower: 4.0`, `ancLower: 1.5`, `plateletsLower: 150`) are synthetic
  local-laboratory test inputs, not KB-derived thresholds** — this project's KB does not define
  WBC/ANC/platelet reference bounds anywhere; these three numbers are reused verbatim from
  `examples/marrow-red-flags.json` (an example fixture, not a KB source) rather than invented, to
  avoid adding yet another arbitrary number to the corpus.
- `history.thumbOrRadiusAnomaly: true` → one of the five flags `facts.anemia.js` counts into
  `marrow.congenitalSignalCount` (≥1 satisfies both rules' `gte 1` leaf).
  → satisfies `IMF-001` (anemia + retic.low + congenitalSignalCount≥1 + macrocytic) and
  `IMF-DBA-001` (adds ageCompatibleWithDba + isolatedAnemia, both true here).

---

## `macrocytosis-from-reticulocytosis.json`

**Witnesses:** `MACRO-004`, `Q-MACRO-002`, `Q-SMEAR-001`.

**Clinical picture:** A 10-year-old boy recovering from an unspecified process shows macrocytosis
driven by a high reticulocyte response rather than a nutrient deficiency; no smear has been
reviewed yet.

**Thresholds used:**
- `patient.ageMonths: 120`, `sexAtBirth: "male"` → "6 to <12 years" band: `hbLower 11.3`,
  `mcvUpper 86.5`.
- `cbc.hemoglobin: 9` (< 11.3) → anemia present. `cbc.mcv: 95` (> 86.5) → macrocytic.
- `reticulocytes.response: "high"` → `retic.high`, satisfying `MACRO-004` (`macrocytic` +
  `retic.high`) directly.
- No `labs.b12Status`/`folateStatus` supplied → both `nutrition.b12Low`/`folateLow` are `false` →
  satisfies `Q-MACRO-002`'s `not(any(b12Low, folateLow))`.
- `smear: []` → `smear.provided === false`, and with `anemia.present` + (`retic.high` or
  `macrocytic`, both true) → satisfies `Q-SMEAR-001`.

---

## `macrocytic-b12-thyroid-pernicious.json`

**Label softened in EP05-T5:** the clinical picture below previously described this as
"pernicious-anemia-pattern B12 deficiency." The fixture supplies a low B12 status and coexisting
autoimmune thyroid disease, but no pernicious-anemia-specific finding (no anti-intrinsic-factor or
anti-parietal-cell antibody status, no documented atrophic gastritis) — nothing in this input is
specific to pernicious anemia as opposed to any other cause of B12 deficiency. The label below now
describes only what the fixture supports. The filename was left as-is (unlike the rename above,
this fix was scoped to the label, not the identifier).

**Witnesses:** `MEG-001`, `MEG-002`, `MACRO-001`, `Q-MACRO-001`.

**Clinical picture:** A 14-year-old girl with autoimmune (Hashimoto) thyroid disease and B12
deficiency of unspecified cause (no pernicious-anemia-specific finding, such as intrinsic-factor or
parietal-cell antibody status, is supplied) — thyroid autoimmunity is a recognized comorbidity of
autoimmune B12 deficiency, but this fixture does not assert pernicious anemia specifically —
presents with macrocytic anemia, hypersegmented neutrophils on smear, and a reticulocyte count not
yet drawn.

**Thresholds used:**
- `patient.ageMonths: 168`, `sexAtBirth: "female"` → "12 to <18 years" band: `hbLower 11.4`,
  `mcvUpper 91.8`.
- `cbc.hemoglobin: 9` (< 11.4) → anemia present. `cbc.mcv: 98` (> 91.8) → macrocytic.
- `labs.b12Status: "low"` → `nutrition.b12Low` → satisfies `MEG-001` (anemia + macrocytic +
  b12Low).
- `smear: ["hypersegmented-neutrophils"]` → `smear.hypersegmentedNeutrophils` → satisfies
  `MEG-002` (macrocytic + hypersegmented, same underlying B12-deficiency mechanism, not an
  independent cause).
- `history.thyroidDisease: true` → `history.thyroidSignal` → satisfies `MACRO-001` (anemia +
  macrocytic + thyroidSignal; the rule's own wording is "coexists with," not "is caused by," so
  recording a comorbid autoimmune condition alongside the true B12 cause is honest, not a new
  claim).
- No `reticulocytes` object → `retic.unknown` → satisfies `Q-MACRO-001` (macrocytic +
  retic.unknown).

---

## `macrocytic-liver-disease-medication.json`

**Witnesses:** `MACRO-002`, `MACRO-003`.

**Clinical picture:** A 12.5-year-old girl with autoimmune hepatitis (chronic liver disease) on
azathioprine (a medication with recognized macrocytosis association) presents with macrocytic
anemia.

**Thresholds used:**
- `patient.ageMonths: 150`, `sexAtBirth: "female"` → "12 to <18 years" band: `hbLower 11.4`,
  `mcvUpper 91.8`.
- `cbc.hemoglobin: 9` (< 11.4) → anemia present. `cbc.mcv: 95` (> 91.8) → macrocytic.
- `history.liverDisease: true` → `history.liverSignal` → satisfies `MACRO-002`.
- `history.macrocytosisAssociatedMedication: true` → `history.medicationMacrocytosisRisk` →
  satisfies `MACRO-003`.
- `reticulocytes.response: "low"` supplied to keep this fixture's macrocytosis attributable to
  the liver/medication picture rather than reticulocytosis (avoids re-triggering `MACRO-004`,
  already witnessed elsewhere).

---

## `mixed-iron-folate-deficiency.json`

**Renamed in EP05-T5** (from `mixed-iron-b12-deficiency.json`): the fixture supplies
`labs.folateStatus: "low"`, never a B12 value — the original name claimed B12 deficiency the input
never asserted. `tests/witness/corpus.test.mjs`'s `FIXTURE_TARGETS` key and `fixture()` call were
updated to match; content is unchanged.

**Witnesses:** `MIX-001`.

**Clinical picture:** A 10-year-old boy with combined iron and folate deficiency, whose MCV is
deceptively normal because the two deficiencies' opposite effects on red-cell size offset each
other.

**Thresholds used:**
- `patient.ageMonths: 120`, `sexAtBirth: "male"` → "6 to <12 years" band: `hbLower 11.3`,
  `mcvLower 77.8`, `mcvUpper 86.5`.
- `cbc.hemoglobin: 9` (< 11.3) → anemia present. `cbc.mcv: 82` (within band, deliberately
  normocytic per the rule's own clinical point).
- `labs.ferritin: 8` — ferritin threshold at 120 months is 20 ng/mL; 8 ≤ 20 → `ferritin.low`.
- `labs.folateStatus: "low"` → `nutrition.folateLow`.
  → satisfies `MIX-001` (anemia + ferritin.low + (b12Low OR folateLow)).

---

## `iron-refractory-anemia-irida.json`

**Witnesses:** `ID-003`, `IRIDA-001`.

**Clinical picture:** An 8-year-old girl with persistent microcytic anemia despite a
clinician-verified adequate oral iron trial with confirmed adherence and no known ongoing blood
loss; an sTfR/log10(ferritin) index remains elevated, consistent with ongoing iron-restricted
erythropoiesis unresponsive to oral therapy (an IRIDA-compatible pattern).

**Thresholds used:**
- `patient.ageMonths: 96`, `sexAtBirth: "female"` → "6 to <12 years" band: `hbLower 11.2`,
  `mcvLower 78.3`.
- `cbc.hemoglobin: 9` (< 11.2) → anemia present. `cbc.mcv: 70` (< 78.3) → microcytic.
- `labs.stfrFerritinIndex: 2.5` — the fixed `> 2` cutoff in `facts.anemia.js` for
  `stfrIndexHigh` → satisfies `ID-003`.
- `history.priorAdequateIronTrialNoResponse: true`, `history.adherenceVerified: true` — direct
  pass-through boolean history fields, no threshold.
- `history.ongoingBloodLossKnown: false` — **set explicitly (EP05-T5 fix)**. This field was
  previously omitted, and the `not(history.ongoingBloodLossKnown === true)` clause is satisfied
  identically whether the field is `false` or simply absent (both fail the `=== true` check). An
  adversarial review correctly flagged that leaving it absent let the fixture's narrative
  ("no known ongoing blood loss") claim something the input never actually asserted — the clinician
  never recorded a negative, the field was just never asked. Setting it to `false` here is honest
  documentation of what this fixture is meant to represent, but see the "KNOWN LIMITATION" section
  below: it does **not** close the underlying gap, because today's boolean fact model cannot
  distinguish "assessed and negative" from "never assessed" in the first place.
  → satisfies `IRIDA-001` in full.

---

## `sideroblastic-iron-loading-microcytosis.json`

**Witnesses:** `SID-001`, `SID-002`.

**Clinical picture:** An 8-year-old boy with microcytic anemia, a high serum iron, and basophilic
stippling on smear — an iron-loading/sideroblastic-pattern microcytosis.

**Thresholds used:**
- `patient.ageMonths: 96`, `sexAtBirth: "male"` → "6 to <12 years" band: `mcvLower 77.8`.
- `cbc.hemoglobin: 9`, `cbc.mcv: 70` (< 77.8) → microcytic.
- `labs.ironStatus: "high"` → `iron.ironHigh` (categorical, no numeric threshold — the KB records
  iron status as a locally interpreted category) → satisfies `SID-002` (microcytic + ironHigh)
  directly.
- `smear: ["basophilic-stippling"]` → `smear.basophilicStippling` → adds the third leaf for
  `SID-001` (microcytic + (ironHigh OR ferritinHigh) + basophilicStippling).

---

## `microcytic-beta-thalassemia-inflammation-confounded.json`

**Witnesses:** `ID-005`, `THAL-BETA-002`.

**Clinical picture:** An 8-year-old girl with a low-iron diet and an intercurrent inflammatory
illness (elevated CRP) presents with microcytic anemia and a ferritin that is not low —
inflammation-confounded, not reassuring against iron deficiency — and is separately found on
molecular testing to carry a beta-thalassemia mutation.

**Thresholds used:**
- `patient.ageMonths: 96`, `sexAtBirth: "female"` → "6 to <12 years" band: `mcvLower 78.3`.
- `cbc.hemoglobin: 9`, `cbc.mcv: 70` (< 78.3) → microcytic, anemia present.
- `labs.ferritin: 25` — ferritin threshold at 96 months is 20 ng/mL; 25 > 20 → `ferritin.notLow`.
- `labs.crpStatus: "elevated"` → `ferritin.crpElevated` → `ferritin.notLow && crpElevated` =
  `ferritin.potentiallyInflammationConfounded`.
- `history.lowIronDiet: true` → one of the flags counted into `history.ironRiskHistory`.
  → satisfies `ID-005` (anemia + microcytic + potentiallyInflammationConfounded + ironRiskHistory).
- `labs.betaGlobinTestingPositive: true` → direct match for `THAL-BETA-002`.

---

## `minimal-intake-no-data.json`

**Witnesses:** `Q-001`, `Q-002`, `Q-003`, `Q-005`.

**Clinical picture:** No clinical picture — this fixture is deliberately `{}`, representing the
very first state of the adaptive questionnaire before any data has been entered. It exists purely
to witness the four "ask for the most basic missing input" questions; there is nothing to review
for clinical coherence because no clinical claim is made.

**Thresholds used:** None — every rule here fires on a `missing` check (`patient.ageMonths`,
`cbc.hb`, `thresholds.hbLower`, and `morphology.indeterminate`, the last because `mcv`/range limits
are also absent), not a numeric comparison. `deriveFacts()` and `getEffectiveRanges()` both
null-guard on absent input (see `modules/anemia/facts.anemia.js`, `modules/anemia/ranges.js`), so
this input does not throw.

---

## KNOWN LIMITATION — exclusion conditions cannot be witnessed as assessed-negative

Several rules in this KB use a `not(...)` exclusion — e.g. `IRIDA-001`'s
`not(history.ongoingBloodLossKnown === true)`, `TEC-001`'s
`not(any(exam.splenomegaly, exam.hepatomegaly, exam.lymphadenopathy, smear.blasts))`. **In today's
fact model, an explicit `false` and a field that was simply never supplied are behaviourally
IDENTICAL**, because every one of these leaves is an `=== true` equality check: both `false` and
`undefined`/absent fail it, so the exclusion is satisfied either way.

This means that, no matter how these fixtures are authored, none of them can actually distinguish
"a clinician asked and confirmed no ongoing blood loss" from "no one ever asked about blood loss,"
or "the spleen and liver were examined and found normal" from "no exam was documented," or
"a smear was reviewed and no blasts were seen" from "no smear was ever done." For `smear`
specifically there is not even a partial workaround: `smear: []` (no findings supplied) and a
hypothetical "smear reviewed, nothing abnormal" are the exact same value — there is no field in
this input schema that can express "assessed, negative" for the smear at all.

**EP05-T5 set the affected fields to explicit `false` anyway** (`history.ongoingBloodLossKnown:
false` in `iron-refractory-anemia-irida.json`; `exam.splenomegaly`/`hepatomegaly`/`lymphadenopathy:
false` in `transient-erythroblastopenia-childhood.json`). This is worth doing as **honest fixture
documentation** — it records what the fixture author intended the clinical picture to represent —
but it must not be read as closing the gap: it does not, and cannot, with the current boolean
(two-state) fact model. **Do not claim, in any future review or documentation pass, that these
fixtures "prove" the exclusion was clinically assessed and found negative** — they prove only that
the rule's condition evaluates to the same result it always would have.

This is a direct, concrete input to **EP-1's tri-state fact model migration**
(present-true / present-false / not-assessed, rather than today's true/absent-as-false). SPIKE-003
already flagged `TEC-001` and `IRIDA-001` by name for exactly this reason — this task's fixtures are
additional, first-hand confirmation of that finding, not a new discovery, and this section exists
so the next reader of this corpus does not have to rediscover it. Any migration design for EP-1
should treat "exclusion-by-omission" rules as a named category to re-validate once a genuine
not-assessed state exists, since a rule firing today on `not(x === true)` may need to become
`not(x === true) AND assessed(x)` (or an equivalent tri-state formulation) to keep meaning what its
`support`/`cautions` text says it means.

---

## UNREACHABLE

None. All 52 targeted rules (36 candidate, 4 note, 12 question) were witnessed using only
thresholds and fact paths already present in `modules/anemia/rules.json`,
`modules/anemia/facts.anemia.js`, and `modules/anemia/reference-ranges.json`. No rule in this
task's scope required an invented cutoff or proved logically unsatisfiable.

---

## Fixture-count rationale

24 fixtures witness the 52 targeted rules (an average of ~2.2 rules per fixture), short of the
task's "roughly 10–18" aim. The gap is deliberate, not an oversight: several rule groups could not
be coherently combined further without stacking unrelated etiologies onto one synthetic patient
(e.g., `REN-001`'s chronic-kidney-disease anemia and `COPPER-001`'s copper-deficiency anemia are
both normocytic/production-limited but have no natural shared clinical narrative; forcing them
into one patient would read as coverage-padding to an adversarial reviewer, which the phase's own
instructions treat as a more serious defect than an extra fixture file). Every multi-witness
fixture above documents why its combined rules belong to the same patient; every single-witness
fixture was left alone specifically because no coherent combination was found.
