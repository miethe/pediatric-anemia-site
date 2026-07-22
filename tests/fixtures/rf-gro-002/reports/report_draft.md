---
schema_version: '0.1'
type: research_report
report_id: report_20260718_research_report_for_rf_run_20260717
title: "RF-GRO-002 — Pediatric growth-faltering / nutrition evidence (WHO/CDC z-scores)"
intent_id: intent_research_20260717_rf_gro_002_pediatric_cds_evidence
evidence_bundle_id: pending
created_at: '2026-07-18T16:39:01-04:00'
status: draft
audience: technical
sensitivity: personal
claim_policy: Every material claim maps to claim_ledger.yaml or is labeled inference/speculation.
verification_status: pending
---

# RF-GRO-002 — Pediatric growth-faltering / nutrition evidence (WHO/CDC z-scores)

## Governance banner

> UNVALIDATED research prototype. rf output a PROPOSAL, not a validated rule. No autonomous diagnosis/treatment/dosing/transfusion directives. No unsupported confidence %. Missingness never treated as normal. Every clinical threshold tied to an exact passage, or flagged a proposal.

## Executive summary

> Evidence dossier for a pediatric-CDS threshold converter — every row and bullet below a source-located proposal, not a validated clinical rule, each bound to its governing growth standard.

**Inference:** The evidence supports two categorically distinct faltering axes that must not be collapsed — a STATIC severity cutoff at z < −2 (WHO and applied-ESPGHAN undernutrition) versus a DYNAMIC longitudinal deceleration trigger at a ≥1.0 z-score fall. [claim:clm_inf02]
**Inference:** The ≥1.0 z-score-fall trigger is convergent in magnitude across three independent standards but they disagree on the anthropometric base (weight-for-age vs weight-for-height), leaving the indicator an unresolved conflict. [claim:clm_inf01]
**Inference:** Every numeric z-score/percentile threshold here is growth-standard-dependent and non-transferable, so chart identity must be bound to each threshold. [claim:clm_inf03]
**Inference:** The 24-month boundary is a triple discontinuity (chart source, measurement method, and indicator), so a flat z-score-drop rule applied across it over-identifies faltering. [claim:clm_inf04]
**Inference:** The consensus indicator set is itself an adaptive staged-testing logic gated by the number of available data points. [claim:clm_inf05]
**Inference:** A distinct preterm/VLBW branch on INTERGROWTH-21st is supported, and no located term WHO/CDC cutoff is validated for preterm infants, so applying term cutoffs to preterm populations is an explicit GAP. [claim:clm_inf09]
**Inference:** For predicting 2-year cognitive impairment in preterm infants no single anthropometric cut point is simultaneously sensitive and specific. [claim:clm_inf10]
**Speculation:** The converter must not conflate the ASPEN diagnosis/documentation indicators with the WHO/CDC percentile SCREENING cutoffs — using one intent as the other is a scope-exit error the converter should block. [claim:clm_spec01]

## Population-scoped thresholds

> Each row a source-located threshold carrying its governing chart/standard — values framed as CDS proposals, never validated rules or dosing directives.

| Parameter | Population / age band | Threshold value | UCUM units | Assay / method dependence | Source + locator | Evidence |
|-----------|----------------------|-----------------|------------|---------------------------|------------------|----------|
| Weight-for-age deceleration (faltering trigger) | Infants/young children, excl. first 2 wk of life | drop ≥1 over ≥1 month | {z_score} | Cooke expert-opinion consensus | rfgro002_05 · Intro after Box 2 | [claim:clm_001] |
| Weight-for-age z decrease (faltering predictor) | Children, unless compensatory (LGA at birth) | decrease ≥1 predicts likely faltering | {z_score} | WHO <2y / CDC 2–20y charts | rfgro002_10 · Diagnosis | [claim:clm_035] |
| Growth faltering (ESPGHAN, applied) | Very preterm, birth→discharge | WFA z fall ≥1.0 | {SD} | INTERGROWTH-21st | rfgro002_03 · Methods, at-discharge | [claim:clm_052] |
| Faltering growth (UK NICE) | Infants/children on WHO-UK charts | centile-space falls graded by birthweight; alt ≥1.0 WFA z fall (2021); 1 space = 0.67 z | {z_score} | WHO-UK charts | rfgro002_05 · Box 1, NICE 2017 | [claim:clm_004] |
| Large z-score change (study definition) | Children 1.5–5y (transition study) | <−1 (drop) or >+1 (rise) | {z_score} | WHO↔CDC charts | rfgro002_04 · Abstract Methods | [claim:clm_060] |
| WHO undernutrition (underweight/stunting/wasting) | Children | z < −2 | {z_score} | WHO Child Growth Standards | rfgro002_05 · Box 1, WHO defs | [claim:clm_003] |
| Undernutrition (ESPGHAN, applied) | Very preterm at discharge | WFA or LFA z < −2 | {SD} | INTERGROWTH-21st | rfgro002_03 · Methods, at-discharge | [claim:clm_053] |
| Gomez / Waterlow (legacy static) | Children | Gomez <75% median WFA; Waterlow <80% median WFL | % | median-of-reference | rfgro002_05 · Box 1 | [claim:clm_008] |
| Growth-faltering diagnosis (weight/WFL/BMI) | Children | persistently <5th percentile, or drop ≥2 percentile lines | {percentile} | WHO <2y / CDC 2–20y | rfgro002_10 · Diagnosis | [claim:clm_034] |
| Chart-source rule (US) | <24 mo vs 2–19y | WHO charts <24 mo; CDC charts 2–19y (transition at 24 mo) | mo | CDC / WHO | rfgro002_00 · Recommendations | [claim:clm_046] |
| Screening cutoffs on WHO charts | <24 months | 2.3rd/97.7th percentiles (±2 SD; labeled 2nd/98th) | {percentile} | WHO charts | rfgro002_00 · Recommendations | [claim:clm_047] |
| Low weight-for-age flag rate | 6–23 months | CDC 5th flags 7–11%; WHO 2.3rd flags <3% | % | CDC ref vs WHO std | rfgro002_00 · Selection of Percentiles | [claim:clm_050] |
| Percentile mis-application error | All-healthy WHO reference pop | 5th/95th on WHO charts mislabels 10% | % | WHO charts | rfgro002_00 · Selection of Percentiles | [claim:clm_051] |
| Weight z cut point (cognitive-risk) | Extremely preterm @36 wk PMA | z ≤ −1.79 (specificity 82%) | {z_score} | INTERGROWTH-21st | rfgro002_08 · Results/Discussion | [claim:clm_015] |
| Length z cut point (cognitive-risk) | Extremely preterm @36 wk PMA | z < −1 (sensitivity 80%) | {z_score} | INTERGROWTH-21st | rfgro002_08 · Abstract Results | [claim:clm_016] |
| Head-circumference z decline | birth→36 wk PMA | decline ≥2.43 (specificity 86%) | {z_score} | INTERGROWTH-21st | rfgro002_08 · Abstract Results | [claim:clm_017] |
| Weight z decline cut point | birth→36 wk PMA | decline ≥1.06 (sens 40%, spec 67%; ns) | {z_score} | INTERGROWTH-21st | rfgro002_08 · Results | [claim:clm_018] |
| Standard growth-failure definition | @36 wk PMA | weight z < −1.28 (<10th pct); 32% flagged; sens 40/26% | {z_score} | INTERGROWTH-21st | rfgro002_08 · Results baseline | [claim:clm_019] |
| Standard growth-faltering definition | birth→36 wk PMA | weight z decline >1.2 (sens 34%) | {z_score} | INTERGROWTH-21st | rfgro002_08 · Methods/Results | [claim:clm_020] |
| Cognitive-impairment outcome (Bayley BSID-III) | @2y corrected GA | mild <85 (35%); moderate <70 (13%) | {score} | BSID-III cognitive composite | rfgro002_08 · Methods/Results | [claim:clm_021] |
| Cohort prevalence (not a decision threshold) | 402 very preterm at discharge | GF 45.3%; UN 33.1% | % | INTERGROWTH-21st | rfgro002_03 · Results | [claim:clm_057] |
| Small for gestational age | At birth | birth-weight centile <3rd | {percentile} | reference chart | rfgro002_03 · Methods, at-birth | [claim:clm_055] |
| Growth restriction at birth | At birth | BW <3rd centile or <−2 SD, or ≥3 of 5 criteria | {SD} | reference chart | rfgro002_03 · Methods, at-birth | [claim:clm_056] |
| BMI-for-age +1 SD (adult-overweight anchor) | @19 years | 25.4 (boys) / 25.0 (girls) | kg/m2 | WHO 2007 reference | rfgro002_06 · Abstract Findings | [claim:clm_040] |
| BMI-for-age +2 SD (adult-obesity anchor) | @19 years | 29.7 (both sexes) | kg/m2 | WHO 2007 reference | rfgro002_06 · Abstract Findings | [claim:clm_041] |
| BMI-for-age standard↔reference join | @5 years | centile differences 0.0–0.1, never >0.2 | kg/m2 | WHO 0–5y std ↔ 5–19y ref | rfgro002_06 · Results | [claim:clm_042] |
| Weight-for-age chart extent | 5–19y range | WFA charts extend only to 10 years | a | WHO 2007 reference | rfgro002_06 · Discussion | [claim:clm_043] |
| Abrupt-switch mean z change | 1.5→2 years | abrupt BMIz −0.59 / WTz −0.35 vs gradual −0.09 / −0.01 | {z_score} | WHO→CDC abrupt vs gradual | rfgro002_04 · Abstract Results | [claim:clm_062] |
| Large-drop proportion | 1.5→2 years (n=7429) | abrupt 28.3% / 6.0% vs gradual 11.6% / 0.85% | % | WHO→CDC abrupt vs gradual | rfgro002_04 · Abstract Results | [claim:clm_063] |
| Catch-up energy/protein requirement | Infants targeting 10 g/kg/d gain | protein 2.82; energy 126 (PE ratio 8.9%) | g/(kg.d); kcal/(kg.d) | theoretical requirement | rfgro002_05 · Table 1 | [claim:clm_005] |
| Catch-up weight-gain velocity | Children 65–80 cm; WFA −1→0 in 20 d | males 4.1; females 4.4 | g/(kg.d) | Golden 2009 (adjusted) | rfgro002_05 · Table 3 | [claim:clm_006] |
| Reference nutrient intake (micronutrients) | Age 1–3 years | vit A 400; vit D 10; zinc 5; iron 6.9 | ug/d; mg/d | British Nutrition Foundation RNI | rfgro002_05 · Table 2 | [claim:clm_007] |
| Weight-for-length indicator window | Birth–2 years | WFL is the applied standard | a | WHO Child Growth Standards | rfgro002_01 · Download labels | [claim:clm_023] |
| Weight-for-height indicator window | 2–5 years | WFH is the applied standard | a | WHO Child Growth Standards | rfgro002_01 · Download labels | [claim:clm_024] |
| Combined WFL/WFH window | Birth–5 years | joins length-based and height-based segments | a | WHO Child Growth Standards | rfgro002_01 · Download labels | [claim:clm_025] |
| Length vs height indicator selection | <24 mo vs ≥24 mo | recumbent length <24 mo; standing height ≥24 mo | mo | WHO Anthro PC v3.2.2 §3.2 | rfgro002_02 · §3.2 | [claim:clm_073] |
| Length/height computational boundary | age in days | ≤730 d = length-for-age; ≥731 d = height-for-age | d | WHO Anthro PC v3.2.2 §3.3 | rfgro002_02 · §3.3 | [claim:clm_074] |
| Length↔height position offset | Position not matching age rule | subtract 0.7 from length→height; add 0.7 height→length | cm | WHO Anthro PC v3.2.2 §3.3 | rfgro002_02 · §3.3 | [claim:clm_075] |
| Unknown age/type fallback | Neither age nor type known | <87 treated as length; ≥87 as height (mean of medians at 24 mo) | cm | WHO Anthro PC v3.2.2 §3.3 | rfgro002_02 · §3.3 | [claim:clm_077] |
| Implausible-value exclusion bounds | <24 mo vs ≥24 mo | length NA outside 45–110; height NA outside 65–120 | cm | WHO Anthro PC v3.2.2 | rfgro002_02 · data-quality | [claim:clm_078] |

## Staged testing (data-availability-gated indicators)

The consensus statement defines a standardized indicator set to diagnose/document undernutrition in the pediatric population aged 1 month to 18 years. [claim:clm_028]
The indicator set is intended to diagnose and document undernutrition across the pediatric population ages 1 month to 18 years. [claim:clm_011]
With a single data point, the recommended indicators are z-scores for weight-for-height/length, BMI-for-age, or length/height-for-age, or mid-upper arm circumference. [claim:clm_029]
For a single available data point, the recommended pediatric undernutrition indicators are z-scores for weight-for-height/length, BMI-for-age, length/height-for-age, or MUAC. [claim:clm_009]
With 2+ data points the indicators add weight gain velocity (age <2 years), weight loss (age 2–20 years), deceleration in weight-for-length/height z-score, and inadequate nutrient intake. [claim:clm_030]
When 2 or more data points are available, indicators additionally include weight-gain velocity (age <2 years), weight loss (age 2–20 years), deceleration in weight-for-length/height z-score, and inadequate nutrient intake. [claim:clm_010]
With multiple data points, the indicators are intended for use across acute, ambulatory/outpatient, and residential care settings. [claim:clm_031]
The indicators are intended for use across multiple care settings — acute, ambulatory/outpatient, and residential care. [claim:clm_012]
Clinicians should use as many available data points as possible to identify and document malnutrition. [claim:clm_033]
Clinicians are directed to use as many data points as are available when identifying and documenting malnutrition. [claim:clm_014]
Growth is generally monitored weekly for infants one to six months of age and every other week for infants six to 12 months of age. [claim:clm_038]
**Inference:** Monitoring cadence is itself age-staged, so the rate at which serial data points accrue — and therefore when the multi-datapoint longitudinal indicators become computable — is age-dependent, not uniform. [claim:clm_inf06]

## Scope-exit / referral triggers

Each bullet flags clinician assessment only — never autonomous diagnosis, dosing, transfusion, or treatment.

- The consensus statement defines diagnostic/documentation indicators, not nutritional-risk screening criteria, and screening is explicitly out of scope. [claim:clm_013]
- The statement is a diagnosis/documentation tool, not a nutritional-risk screening tool, and deriving screening criteria is explicitly out of scope. [claim:clm_032]
- NG75 frames the weight-centile-fall values as thresholds for concern about faltering growth, i.e. triggers for further assessment, not diagnoses. [claim:clm_065]
- For an infant whose birthweight was below the 9th centile, a fall across 1 or more weight centile spaces is a threshold for concern. [claim:clm_066]
- For an infant whose birthweight was between the 9th and 91st centiles, a fall across 2 or more weight centile spaces is a threshold for concern. [claim:clm_067]
- For an infant whose birthweight was above the 91st centile, a fall across 3 or more weight centile spaces is a threshold for concern. [claim:clm_068]
- A current weight below the 2nd centile for age is a threshold for concern regardless of birthweight. [claim:clm_069]
- NG75 defines a 'centile space' as the space between adjacent centile lines on the UK-WHO growth charts, the unit the centile-fall thresholds are measured in. [claim:clm_070]
- In children older than 2 years, a BMI below the 0.4th centile suggests probable undernutrition that needs assessment and intervention. [claim:clm_071]
- A length or height centile more than 2 centile spaces below the mid-parental centile is below the parentally predicted range and suggests undernutrition or a primary growth disorder. [claim:clm_072]
- ESPGHAN flags infants whose weight or length z-score drops exceed 2 SD as requiring attention and tailored nutritional support. [claim:clm_054]
- Close monitoring continues until the child reaches a z-score of −2 to −1 without additional dietary supplementation (recovery target). [claim:clm_037]
- **Speculation:** A consolidated scope-exit/referral trigger set is proposed — current weight below the 2nd centile regardless of birthweight; BMI below the 0.4th centile in children >2 years; length/height more than 2 centile spaces below the mid-parental centile; and any weight or length z-score drop exceeding 2 SD — each flagging clinician assessment, never diagnosis, dosing, or treatment. [claim:clm_spec02]
- **Speculation:** The evidence supports a de-escalation/exit boundary for the faltering pathway — continue close monitoring until weight-for-age z-score reaches −2 to −1 without additional dietary supplementation — proposed as the CDS monitoring-stop criterion, not a treatment directive. [claim:clm_spec03]

## Conflicts & method-dependence

- The review's abstract states the consensus threshold as a drop of weight-for-HEIGHT of 1 z-score, conflicting with the weight-for-age framing used in the body text. [claim:clm_002]
- **Inference:** The ≥1.0 z-score-fall trigger is corroborated across Cooke expert opinion, UK NICE 2021, and applied ESPGHAN preterm criteria, but they disagree on the anthropometric base (weight-for-age vs weight-for-height), so the magnitude is convergent while the indicator remains an unresolved conflict. [claim:clm_inf01]
- **Inference:** UK NICE NG75 makes the faltering threshold a function of birthweight centile band, an explicit regression-to-the-mean adjustment absent from the flat ≥1.0 z-score-fall rules, so the two threshold designs are structurally different, not interchangeable. [claim:clm_inf07]
- **Inference:** Applying NICE's own 1 centile space = 0.67 z-score conversion, a 2-space fall equals ~1.34 z and a 3-space fall ~2.01 z, so NICE's 2- and 3-space triggers are more conservative than the flat ≥1.0 z-score-fall trigger and thresholds stated in the two units are not equal. [claim:clm_inf08]
- Using Fenton growth curves instead of INTERGROWTH-21st, standard growth failure occurred in 57% of the same infants (vs 32% by INTERGROWTH-21st) and Fenton-based faltering was not associated with cognitive-impairment risk, establishing growth-standard dependence. [claim:clm_022]
- All growth z-scores and centiles in the preterm study are computed against INTERGROWTH-21st prescriptive standards, making every threshold reference-chart dependent. [claim:clm_058]
- For children younger than two years, measurements are adjusted for gestational age and plotted on WHO growth charts, whereas CDC growth charts are used for ages two to 20 years. [claim:clm_036]
- WHO charts are growth STANDARDS (how healthy children should grow under optimal conditions) whereas CDC charts are a growth REFERENCE (how certain children grew at a place and time). [claim:clm_048]
- CDC recommends switching from the WHO Growth Standards to the CDC 2000 Growth Reference at age 2 years, the transition point the gradual-charts study addresses. [claim:clm_059]
- The gradual charts transition between WHO and CDC using a weighted average applied across ages 2 to 5 years. [claim:clm_061]
- The authors conclude the gradual-transition charts may reduce overidentification of slow weight gain and may be useful in clinical care and research. [claim:clm_064]

## Standards, provenance & computational rules

- The WHO weight-for-length/height standard is published in both z-score and percentile form, provided separately for girls and boys. [claim:clm_026]
- WHO distributes the standard in multiple derived formats (charts, full tables, simplified field tables, and expanded national-health-card tables), each split by sex and z-score vs percentile. [claim:clm_027]
- Negative z-scores represent lower growth percentiles, with lower negative values signifying more severe malnutrition (directional convention, not a numeric cutoff). [claim:clm_039]
- The WHO 2007 height-for-age and BMI-for-age charts extend to 19 years, the WHO-defined upper limit of adolescence, giving a reference for the 5–19y age group. [claim:clm_044]
- The WHO 2007 reference curves were constructed with the Box-Cox power exponential (BCPE) method with cubic-spline smoothing, the same approach used for the 0–5y WHO Child Growth Standards. [claim:clm_045]
- The WHO growth-standard reference population was fully breastfed: 100% breastfed for 12 months and predominantly breastfed for at least 4 months. [claim:clm_049]
- The 0.7 cm length-height offset was derived empirically from MGRS children aged 18–30 months who had both length and height measured. [claim:clm_076]
- The published length/height standard provides length-for-age birth to 2 years and height-for-age 2 to 5 years, plus a combined length/height-for-age birth to 5 years, as z-score and percentile charts and tables for boys and girls. [claim:clm_079]

## Open questions

- Which term WHO/CDC anthropometric threshold, if any, is validated for preterm/VLBW infants rather than only INTERGROWTH-21st?
- Should the converter resolve the weight-for-age vs weight-for-height base for the 1.0 z-score-fall trigger, or preserve both as parallel candidates?
- Across the 24-month triple discontinuity, what transition logic (abrupt vs gradual weighted-average charts) should the CDS adopt to avoid over-identification?
- For preterm cognitive-risk prediction, how should the sensitivity-maximizing (length z < −1) and specificity-maximizing (weight z ≤ −1.79, HC decline ≥2.43) cut points be combined?
- What operating cadence makes the multi-datapoint longitudinal indicators computable beyond the 1–12 month infant windows already located?

## Sources

- src_20260718_rfgro002_05: An Update on the Diagnosis and Management of Faltering Growth and Catch-Up Growth in Young Children
- src_20260718_rfgro002_11: Consensus Statement of the Academy of Nutrition and Dietetics/American Society for Parenteral and Enteral Nutrition: Indicators Recommended for the Identification and Documentation of Pediatric Malnutrition (Undernutrition)
- src_20260718_rfgro002_08: Risk Assessment of Cognitive Impairment at 2 Years of Age in Infants Born Extremely Preterm Using the INTERGROWTH-21st Growth Standards
- src_20260718_rfgro002_01: WHO Child Growth Standards: Weight-for-length/height
- src_20260718_rfgro002_07: Consensus statement of the Academy of Nutrition and Dietetics/American Society for Parenteral and Enteral Nutrition: indicators recommended for the identification and documentation of pediatric malnutrition (undernutrition)
- src_20260718_rfgro002_10: Growth Faltering and Failure to Thrive in Children
- src_20260718_rfgro002_06: Development of a WHO growth reference for school-aged children and adolescents
- src_20260718_rfgro002_00: Use of World Health Organization and CDC Growth Charts for Children Aged 0-59 Months in the United States
- src_20260718_rfgro002_03: Risk Factors for Postnatal Growth Faltering and Undernutrition at Discharge in Very Preterm Infants: A Retrospective Study Applying the ESPGHAN Consensus Definitions
- src_20260718_rfgro002_04: Creation and Evaluation of New Growth Charts With a Gradual Transition From WHO to CDC Values
- src_20260718_rfgro002_09: Faltering growth: recognition and management of faltering growth in children (NICE guideline NG75)
- src_20260718_rfgro002_02: WHO Child Growth Standards: Length/height-for-age
