---
schema_version: '0.1'
type: research_report
report_id: report_20260718_research_report_for_rf_run_20260717
title: RF-KID-001 — Pediatric kidney/urinalysis evidence (CKiD U25 eGFR, hematuria/proteinuria/BP)
intent_id: intent_research_20260717_rf_kid_001_pediatric_cds_evidence
evidence_bundle_id: pending
created_at: '2026-07-18T16:15:11-04:00'
status: draft
audience: technical
sensitivity: personal
claim_policy: Every material claim maps to claim_ledger.yaml or is labeled inference/speculation.
verification_status: pending
---

## Governance banner

> UNVALIDATED research prototype. rf output a PROPOSAL, not a validated rule. No autonomous diagnosis/treatment/dosing/transfusion directives. No unsupported confidence %. Missingness never treated as normal. Every clinical threshold tied to an exact passage, or flagged a proposal.

## Executive summary

KDIGO 2024 defines CKD as abnormalities of kidney structure or function present for a minimum of 3 months with implications for health, applied to children and adults. [claim:clm_008]
KDIGO 2024 directs that GFR in children be estimated with equations validated in comparable populations, naming the CKiD U25 2021 creatinine equation (ages 1-25; uses age, sex, height) as a preferred example. [claim:clm_012]
Developed/internally validated on 2655 iohexol-mGFR observations from 928 CKiD participants; among 13 equations compared, only the two U25 age-dependent equations achieved non-significant bias and P30 accuracy >85% in both children (<18 y) and young adults (>=18 y); the equations contain no race coefficient. [claim:clm_057]
The guideline replaces the term 'prehypertension' with 'elevated blood pressure', aligning pediatric terminology with the 2017 AHA/ACC adult guideline. [claim:clm_031]
Proteinuria in children can be glomerular and/or tubular in origin and is temporally categorized as transient, orthostatic, or persistent. [claim:clm_045]
Hematuria is defined as an increased number of red blood cells in the urine and may be gross or microscopic. [claim:clm_047]
Hematuria in children can originate from the glomeruli or from other sites in the urinary tract. [claim:clm_048]
Asymptomatic isolated microscopic hematuria or mild proteinuria in an otherwise healthy child is less likely to be clinically significant. [claim:clm_049]

## Population-scoped thresholds table

### GFR / eGFR equations and staging

| Parameter | Population / age band | Threshold value | UCUM units | Assay / method dependence | Source + locator | Evidence |
|---|---|---|---|---|---|---|
| eGFRcr "low" screening flag | Children/adolescents >2 y | eGFRcr <90 (vs adult and 2012 pediatric cutoff of 60) | mL/min/{1.73_m2} | Creatinine-based; enzymatic IDMS-standardized preferred | src_20260718_rfkid001_03 — Practice Point 1.2.3.5 (p.S186) | [claim:clm_009] |
| Depressed GFR (referral / CKD G3+) | Children (chronicity ≥3 mo) | eGFR <60 for >3 months | mL/min/{1.73_m2} | Method-agnostic staging | src_20260718_rfkid001_07 — Referral / nephrology criteria | [claim:clm_006] |
| KDIGO GFR categories G1–G5 | Population-general staging (not the pediatric flag) | G1 ≥90, G2 60–89, G3a 45–59, G3b 30–44, G4 15–29, G5 <15 | mL/min/{1.73_m2} | Method-agnostic staging | src_20260718_rfkid001_03 — CGA nomenclature fig (p.S126) | [claim:clm_010] |
| KDIGO albuminuria categories | Population-general | A1 <30, A2 30–300, A3 >300 (urine ACR; mg/mmol equivalents given) | mg/g | Albumin-to-creatinine ratio | src_20260718_rfkid001_03 — CGA nomenclature fig (p.S126) | [claim:clm_011] |
| CKiD U25 equation form | Ages 1–25 y | eGFR = K×(height/SCr) or K×(1/cystatin C); 2 variants (sex-K, or sex-and-age-K) per biomarker | mL/min/{1.73_m2} | Creatinine (height in m) or cystatin C | src_20260718_rfkid001_00 — Abstract; Methods | [claim:clm_051] |
| U25 creatinine K (age-independent) | Ages 1–25 y | K = 41.8 (M), 37.6 (F) | 1 (dimensionless K; SCr in mg/dL, height in m) | Enzymatic IDMS-standardized SCr | src_20260718_rfkid001_00 — Results, K estimation | [claim:clm_052] |
| U25 creatinine K (age-dependent) | Ages 1–25 y (constant ≥18) | Rises monotonically age 1→18: M 35.7→50.8, F 33.1→41.4 | 1 (dimensionless K) | Enzymatic IDMS-standardized SCr | src_20260718_rfkid001_00 — Results, K estimation | [claim:clm_053] |
| U25 cystatin C K (age-independent) | Ages 1–25 y | K = 81.9 (M), 74.9 (F); eGFR = K×(1/cysC) | 1 (dimensionless K; cysC in mg/L) | IFCC-standardized cystatin C | src_20260718_rfkid001_00 — Results, K estimation | [claim:clm_054] |
| U25 cystatin C K (age-dependent) | Ages 1–25 y | Non-monotonic: M peaks age 15 (K 74.8→87.2), F peaks age 12 (K 76.5→79.9) | 1 (dimensionless K) | IFCC-standardized cystatin C | src_20260718_rfkid001_00 — Abstract; Results | [claim:clm_055] |
| Bedside Schwartz equation | Children | eGFR = 0.413×(height/Cr) | mL/min/{1.73_m2}; height in cm, Cr in mg/dL | Creatinine-based; height in cm (NOT meters) | src_20260718_rfkid001_11 — Methods, eq. 1 | [claim:clm_043] |

### Proteinuria

| Parameter | Population / age band | Threshold value | UCUM units | Assay / method dependence | Source + locator | Evidence |
|---|---|---|---|---|---|---|
| Dipstick protein grades | All ages (dipstick) | trace=15, 1+=30, 2+=100, 3+=300, 4+≥1000; ≥1+ abnormal | mg/dL | Colorimetric dipstick | src_20260718_rfkid001_07 — Laboratory Testing / dipstick | [claim:clm_001] |
| Normal 24-h protein excretion | Children | <100 per day | mg/m2/d (mg/{m2}/d) | 24-hour quantitation | src_20260718_rfkid001_07 — 24-hour excretion para | [claim:clm_003] |
| Proteinuria definition + infant bands | Children >2 y; infants 6–24 mo; neonates/infants | >100 mg/m2/d or spot Up/c >0.2; up to 300 mg/m2/d neonates/infants; normal Up/c <0.5 for 6–24 mo | mg/m2/d; mg/mg | Spot protein-to-creatinine ratio | src_20260718_rfkid001_06 — PROTEINURIA / Definition | [claim:clm_028] |
| Transient / orthostatic (first-morning) | Children; 6–24 mo variant | First-morning Up/c ≤0.2 (≤0.5 at 6–24 mo) with normal UA | mg/mg | Spot first-morning P/C | src_20260718_rfkid001_07 — spot UPr/Cr para | [claim:clm_002] |
| Orthostatic proteinuria diagnosis | Adolescents | First-morning Up/c ≤0.2 with random Up/c >0.2 (or positive dipstick) | mg/mg | Paired first-morning vs random P/C | src_20260718_rfkid001_06 — PROTEINURIA / Classification | [claim:clm_030] |
| Nephrotic-range (per m2 / ratio) | Children | >1000 mg/m2/d or spot U p/c >2 | mg/m2/d; mg/mg | Spot P/C or 24-h | src_20260718_rfkid001_07 — Nephrotic syndrome para | [claim:clm_004] |
| Nephrotic-range (weight/ratio) | Children | >1000 mg/m2/d, or >50 mg/kg/d, or spot U p/c >2 | mg/m2/d; mg/kg/d; mg/mg | Spot P/C, 24-h, or weight-indexed | src_20260718_rfkid001_06 — PROTEINURIA / Definition | [claim:clm_029] |
| Proteinuria-detection cutoff | General (most-reported) | Spot P/C >20 (0.2 mg/mg) | mg/mmol | Spot P/C ratio | src_20260718_rfkid001_10 — Abstract, results 1 | [claim:clm_014] |
| Nephrotic-range confirmation | General | Spot P/C >350 (3.5 mg/mg) | mg/mmol | Spot P/C ratio | src_20260718_rfkid001_10 — Abstract, results 1 | [claim:clm_015] |
| ISSHP proteinuria (pregnancy) | Pregnant women at preeclampsia risk | P/C 30 (0.3 mg/mg) | mg/mmol | Spot P/C ratio | src_20260718_rfkid001_10 — Abstract, results 2 | [claim:clm_016] |
| High P/C predicting CKD progression | Children (nonglomerular vs glomerular) | >2 nonglomerular; >0.5 glomerular | mg/mg | Spot P/C ratio | src_20260718_rfkid001_07 — Introduction / CKD risk | [claim:clm_005] |

### Hematuria and hypercalciuria

| Parameter | Population / age band | Threshold value | UCUM units | Assay / method dependence | Source + locator | Evidence |
|---|---|---|---|---|---|---|
| Microscopic hematuria | Children (≥2–3 occasions) | >5 RBC/mm3 uncentrifuged or >5 RBC/HPF centrifuged (literature range 1–10 RBC/HPF) | /mm3 uncentrifuged; /[HPF] centrifuged (non-UCUM) | Centrifuged vs uncentrifuged; HPF vs mm3 | src_20260718_rfkid001_06 — HEMATURIA / Definitions | [claim:clm_025] |
| Persistent hematuria | Children | >5 RBC/HPF for >4–6 weeks, absent exercise/menses/trauma | /[HPF] (non-UCUM); wk | Centrifuged microscopy | src_20260718_rfkid001_06 — HEMATURIA / Classification | [claim:clm_026] |
| Hypercalciuria | Children >2 y; infants <6 mo; 6–12 mo | Ca/Cr >0.2 (>2 y); <0.8 (<6 mo); <0.6 (6–12 mo) | mg/mg | Spot calcium-to-creatinine ratio | src_20260718_rfkid001_06 — HEMATURIA / Nonglomerular | [claim:clm_027] |

### Blood pressure

| Parameter | Population / age band | Threshold value | UCUM units | Assay / method dependence | Source + locator | Evidence |
|---|---|---|---|---|---|---|
| BP categories (percentile-based) | Children 1 to <13 y | Normal <90th pct; Elevated ≥90th–<95th (or 120/80); Stage 1 ≥95th–<95th+12 (or 130/80–139/89); Stage 2 ≥95th+12 (or ≥140/90); "whichever is lower" | %ile; mm[Hg] | Auscultatory, normal-weight normative basis | src_20260718_rfkid001_02 — Table 3, Aged 1–13 y | [claim:clm_032] |
| BP categories (static cut points) | Adolescents ≥13 y | Normal <120/<80; Elevated 120/<80–129/<80; Stage 1 130/80–139/89; Stage 2 ≥140/90 | mm[Hg] | Adult-style static thresholds | src_20260718_rfkid001_02 — Table 3, Aged ≥13 y | [claim:clm_033] |
| HTN diagnosis | Children/adolescents | Auscultatory-confirmed BP ≥95th percentile at 3 different visits (grade C) | %ile | Auscultatory confirmation | src_20260718_rfkid001_02 — Table 1, KAS 3 | [claim:clm_034] |
| Left ventricular hypertrophy | Children/adolescents >8 y; and by BSA | LV mass >51 g/m2.7 (both sexes, >8 y); >115 g/BSA boys, >95 g/BSA girls | g/m2.7; g/{BSA} | Echocardiographic LV mass | src_20260718_rfkid001_02 — Table 1, KAS 15-2 | [claim:clm_035] |

## Scope-exit / referral-triggers

### Referral / escalation triggers (within-scope, not diagnoses)

- **Inference:** Consolidated red-flag / pediatric-nephrology referral triggers (each a within-scope escalation, not a diagnosis): eGFR <60 mL/min/1.73 m2 for >3 months (clm_006); nephrotic-range spot U p/c >2 mg/mg (clm_004, clm_029); co-occurring hematuria AND proteinuria (clm_050); confirmed HTN >=95th percentile at 3 visits (clm_034); persistent hematuria >5 RBC/HPF for >4-6 weeks (clm_026); and active sediment, hypocomplementemia, or hypertension accompanying proteinuria (clm_007). [claim:clm_inf10]
- Orthostatic proteinuria is the most common type in children (especially adolescent males) and is benign; referral and biopsy are reserved for red-flag features such as active sediment, hematuria, hypertension, hypocomplementemia, or depressed GFR. [claim:clm_007]
- Persistent proteinuria may indicate serious underlying kidney pathology and warrants further evaluation. [claim:clm_046]
- The co-occurrence of both hematuria and proteinuria requires further workup and careful monitoring. [claim:clm_050]
- BP should be measured annually in children and adolescents >=3 y of age, and at every health care encounter for those with obesity, BP-raising medications, renal disease, aortic arch obstruction/coarctation, or diabetes (both grade C, moderate). [claim:clm_037]

### Scope exits (module implementation boundaries)

- **Speculation:** SCOPE EXIT (implementation boundary) — dialysis / kidney failure (KDIGO G5 / on renal replacement therapy): the module must NOT compute or interpret eGFR or urinalysis thresholds for children on dialysis, because eGFR equations assume residual filtering function and are not validated in kidney failure. [claim:clm_spec01]
- **Speculation:** SCOPE EXIT (implementation boundary) — kidney transplant recipients: the module must NOT apply CKiD U25 screening thresholds unmodified to pediatric transplant recipients, because eGFR equations overestimate GFR above 100 mL/min/1.73 m2 and behave differently with adult-donor kidneys in these cohorts. [claim:clm_spec02]
- **Speculation:** SCOPE EXIT (implementation boundary) — acute kidney injury (AKI): the module must NOT interpret creatinine or eGFR as CKD/GFR staging in AKI, because CKD and its thresholds require abnormalities present for a minimum of 3 months (clm_008) and eGFR equations assume steady-state creatinine that AKI violates. [claim:clm_spec03]
- **Inference:** GAP / missingness: there is no located source-supported creatinine or cystatin-C eGFR interpretation for infants under 1 year (or by gestational/postnatal age) — CKiD U25 is validated only for ages 1-25 y (clm_012, clm_051, clm_057); the module must return 'no validated eGFR threshold' for <1 y rather than extrapolate. [claim:clm_inf07]
- **Speculation:** PROPOSAL — equation-selection default for the CDS: prefer CKiD U25-combined (creatinine + cystatin C) to screen for low GFR when cystatin C is available, fall back to U25-creatinine (requires height in meters) when only creatinine is available, and gate both on the >2 y, ages 1-25 validity window with the <90 mL/min/1.73 m2 screening flag. [claim:clm_spec04]

## Conflicts & method-dependence

### Threshold conflicts (population / units)

**Inference:** KDIGO 2024's pediatric eGFRcr <90 mL/min/1.73 m2 'low' flag (children >2 y) and the <60 mL/min/1.73 m2 'depressed GFR' referral/CKD-staging threshold are two distinct cutoffs that must coexist in the module, not be reconciled: <90 is a screening flag, <60 (for >3 months) is the CKD G3+/referral threshold. [claim:clm_inf01]
**Inference:** Nephrotic-range proteinuria has a source conflict in spot-ratio units: pediatric sources define it at spot U p/c >2 mg/mg (clm_004, clm_029) while the general/adult narrative review states >350 mg/mmol = 3.5 mg/mg (clm_015); since 2 mg/mg approximately equals 226 mg/mmol, the pediatric cutoff is materially LOWER than 350 mg/mmol — preserve as an unresolved population/units conflict, do not average. [claim:clm_inf02]
**Inference:** The proteinuria-detection spot cutoff converges across sources at U p/c >0.2 mg/mg (= 20 mg/mmol) for children >2 y (clm_002, clm_014, clm_028), but is age-band-relaxed to <0.5 mg/mg normal for infants 6-24 months and up to 300 mg/m2/day for neonates/infants (clm_002, clm_028) — the module must branch the proteinuria threshold on age band. [claim:clm_inf03]

### eGFR method dependence (creatinine vs cystatin C)

**Inference:** The CKiD U25 K constants (creatinine 41.8 M / 37.6 F; cystatin C 81.9 M / 74.9 F, plus the age-dependent tables) are valid ONLY for IDMS-standardized enzymatic serum creatinine (mg/dL) and IFCC-standardized cystatin C (mg/L) with height in METERS; applying them to Jaffe/non-standardized assays, differently calibrated cystatin C, or height in cm invalidates the estimate. [claim:clm_inf04]
**Inference:** Creatinine-only, cystatin-C-only, and combined U25 eGFR are not interchangeable: a creatinine-vs-cystatin discordance of >=15 mL/min/1.73 m2 is clinically meaningful (clm_058) and its direction dictates which formula is closest to measured GFR (clm_060); cystatin-C and combined forms consistently outperform creatinine-only across cohorts (clm_021, clm_039, clm_065, clm_068, clm_071) — the CDS must record which method produced any eGFR value. [claim:clm_inf05]
**Inference:** Pediatric eGFR equations are least reliable exactly at the normal/near-normal range the <90 screening flag targets: all six equations disagreed with iohexol GFR in >1/3 of participants (clm_062) and multiple equations overestimated GFR above 100 mL/min/1.73 m2 (clm_042), so an eGFR near 90 should be treated by the module as imprecise rather than a hard cutoff. [claim:clm_inf06]
In 29 children with mild CKD, 22 had creatinine- vs cystatin-C-based eGFR that differed by at least 15 mL/min/1.73 m2, establishing that threshold as the study's definition of clinically meaningful discordance. [claim:clm_058]
The CKiD U25 equation most accurately identified children with an eGFR below 90 mL/min/1.73 m2, the threshold this study used to flag low/near-normal GFR. [claim:clm_059]
The direction of discordance dictated which equation best matched measured GFR: when creatinine-eGFR exceeded cystatin-C-eGFR by at least 15 mL/min the U25 creatinine formula was closest to 4-point iohexol GFR, and when cystatin-C-eGFR was higher the U25-combined was closest. [claim:clm_060]
The authors recommend the CKiD U25-combined (creatinine + cystatin-C) formula to screen children for a low GFR, and either U25-combined or FAS-combined for tracking eGFR change longitudinally. [claim:clm_061]
All six equations disagreed with 4-point measured iohexol GFR in more than one-third of participants, showing pediatric eGFR formulas remain unreliable at the normal/near-normal range and need refinement. [claim:clm_062]

### Hematuria and blood-pressure method scoping

**Inference:** Microscopic-hematuria thresholds are method-dependent and heterogeneous: the working definition is >5 RBC/HPF (centrifuged) or >5 RBC/mm3 (uncentrifuged) on 2-3 occasions, but the literature range is 1-10 RBC/HPF (clm_025) and persistence requires >4-6 weeks (clm_026); the module must record centrifuged-vs-uncentrifuged and HPF-vs-mm3 method with any hematuria threshold and cannot assume a single universal cutoff. [claim:clm_inf08]
**Inference:** Blood-pressure interpretation is jointly age-band- and method-scoped: 1-<13 y uses percentile-based categories with a static-mmHg 'whichever is lower' bound (clm_032) while >=13 y uses static adult cut points (clm_033), and the normative percentiles derive from auscultatory measurements in normal-weight (BMI <85th pct) children only (clm_036) — so oscillometric/ABPM readings and children with obesity fall outside the normative basis and must be flagged as method/population-out-of-scope. [claim:clm_inf09]
New normative BP tables are based on normal-weight children only; the 50th/90th/95th percentiles were derived by quantile regression on normal-weight children (BMI <85th percentile). [claim:clm_036]

### Assay / calibration dependence

KDIGO 2024 flags creatinine-assay dependence in children: labs must QC the lowest end of the expected range, and enzymatic (not Jaffe) creatinine assays are preferred because non-creatinine chromogens contribute more in children and neonatal samples are frequently icteric/hemolyzed. [claim:clm_013]
The K constants are assay-specific: serum creatinine was assayed enzymatically on an Advia 2400 (Siemens) and IDMS-standardized, and cystatin C nephelometrically (Siemens) and calibrated to IFCC standards; using differently calibrated assays can invalidate the constants. [claim:clm_056]
Plasma creatinine was measured by an enzymatic method and cystatin C by a particle-enhanced immunoturbidimetric assay, applied throughout the study — a documented assay-method dependence for any derived threshold. [claim:clm_023]
CysC was measured by turbidimetric assay (Gentian AS) standardized to IFCC reference material; for the pre-IFCC CKiD Cr-CysC equation the Gentian CysC value was divided by 1.17. [claim:clm_044]
Measured GFR was obtained by plasma iohexol disappearance and BSA-standardized with the Haycock formula; serum creatinine (mg/dL) and cystatin C (mg/L) were centrally measured with IFCC-calibrated methods. [claim:clm_072]
The P/C ratio cutoff should be established per laboratory because it depends on the patient population and the laboratory methodologies. [claim:clm_017]
A high degree of correlation was observed between spot P/C ratio values and protein concentration in 24-hour urine collections, supporting P/C as a substitute for 24-h collection. [claim:clm_018]

### Comparative eGFR performance evidence (by cohort)

ROC analysis identified eGFR-equation agreement thresholds vs the CKiD 2012 reference of <70 mL/min/1.73 m2 for Schwartz-Lyon, U25, and FAS-height, and <60 mL/min/1.73 m2 for Bedside Schwartz, beyond which bias increased. [claim:clm_019]
Among plasma-creatinine-only equations, Schwartz-Lyon had the highest agreement with the CKiD 2012 reference (ICC 0.913, CCC 0.911, TDI 14.0 mL/min/1.73 m2, P30 99.2%). [claim:clm_020]
The U25 combined PCr-CystC equation showed excellent agreement with the CKiD 2012 combined reference (ICC 0.993, CCC 0.990, TDI 3.9 mL/min/1.73 m2, P30 100%), and is preferred where cystatin C is feasible. [claim:clm_021]
The plasma-creatinine-only U25 equation achieved ICC 0.922, CCC 0.882, TDI 20.0 mL/min/1.73 m2, and P30 93.3% against the CKiD 2012 combined reference. [claim:clm_022]
The study cohort comprised 120 eGFR measurements from 23 pediatric kidney transplant recipients (mean age 14.2 +/- 3.4 years) who received adult-donor kidneys (donor mean age 31.7 +/- 10.0 years). [claim:clm_024]
In 45 pediatric kidney transplant recipients aged 1-18, median measured (iohexol) GFR was 93.3 mL/min/1.73 m2, with 57.8% >=90, 33.3% between 60-89, and 8.9% between 30-59. [claim:clm_038]
Among the whole cohort, the U25-CysC equation had the highest accuracy, with 88.9% of estimates within 30% (P30) and 37.8% within 10% (P10) of measured GFR. [claim:clm_039]
The Gentian CysC equation had the smallest mean bias in the whole cohort at 0.1 mL/min/1.73 m2 (IQR -16.6 to 12.9). [claim:clm_040]
The CAPA equation misclassified K/DOQI CKD stage the least — 24.4% of the whole cohort and 33.3% of the histological-change subgroup — versus roughly 40-50% for most equations. [claim:clm_041]
Bland-Altman analysis showed Bedside Schwartz, Gentian CysC, CAPA, and U25-CysC tended to overestimate GFR in patients with GFR above 100 mL/min/1.73 m2. [claim:clm_042]
In this pediatric/young-adult cohort the average measured GFR (mGFR by Tc-99m DTPA) was 84.1 mL/min/1.73 m2. [claim:clm_063]
Non-race-corrected creatinine equations overestimated eGFR in all groups; CKiD U25-creatinine had the lowest bias at 22.59 mL/min/1.73 m2. [claim:clm_064]
CKiD U25-CysC and Schwartz CysC gave the best correlation, P30, and lowest bias; CKiD U25-CysC = correlation 0.6281, P30 80.7%, bias 3.72 mL/min/1.73 m2, and Schwartz CysC = 0.6372, 77.2%, -4.68 mL/min/1.73 m2. [claim:clm_065]
mGFR was measured by intravenous Tc-99m DTPA tracer and retrospectively compared with equation-based eGFR in 57 patients aged 6 months to 22 years of different races/ethnicities. [claim:clm_066]
The authors conclude that both CKiD U25-CysC and Schwartz CysC estimate mGFR well, with CKiD U25-CysC having the overall best performance in this cohort. [claim:clm_067]
In internal validation, the U25 creatinine-only eGFR significantly underestimated measured GFR in self-reported Black participants (bias -3.37 mL/min/1.73 m2), whereas the cystatin C-only U25 eGFR showed no significant bias across race groups. [claim:clm_068]
In unadjusted models, self-reported Black race was associated with 12.8% higher measured GFR after adjusting for serum creatinine. [claim:clm_069]
Adjusting for cystatin C, self-reported Black race was associated with 3.5% lower measured GFR overall, an effect that attenuated and became non-significant in older age groups. [claim:clm_070]
The average of the creatinine-based and cystatin C-based U25 equations yielded unbiased GFR estimates and had the highest proportions within 30% and within 10% of mGFR and the lowest RMSE among the three U25 forms. [claim:clm_071]
The analytic cohort comprised 190 self-reported Black participants (473 person-visits) and 675 non-Black participants (1,897 person-visits), median age 9 years; median SCr was 1.2 mg/dL in both groups while median cystatin C and mGFR differed by group. [claim:clm_073]

## Open questions

- What validated creatinine or cystatin-C eGFR interpretation, if any, exists for infants under 1 year (or by gestational/postnatal age)?
- What transplant-specific recalibration would be required before CKiD U25 screening thresholds could be applied in-scope to pediatric transplant recipients?
- Which dialysis/kidney-failure-specific source would confirm the eGFR/urinalysis scope-exit boundary before activation?
- How should oscillometric/ABPM BP readings be reconciled with normative tables derived from auscultatory, normal-weight children?

## Sources

- src_20260718_rfkid001_07: Proteinuria in Children: Evaluation and Differential Diagnosis
- src_20260718_rfkid001_03: KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease
- src_20260718_rfkid001_10: Diagnostic utility of protein to creatinine ratio (P/C ratio) in spot urine sample within routine clinical practice
- src_20260718_rfkid001_05: Comparison of different equations for estimating the glomerular filtration rate in pediatric kidney transplant recipients
- src_20260718_rfkid001_06: Hematuria and Proteinuria in Children
- src_20260718_rfkid001_02: Clinical Practice Guideline for Screening and Management of High Blood Pressure in Children and Adolescents
- src_20260718_rfkid001_11: Comparison of estimated GFR using cystatin C versus creatinine in pediatric kidney transplant recipients
- src_20260718_rfkid001_08: Evaluation of Proteinuria and Hematuria in Ambulatory Setting
- src_20260718_rfkid001_00: Age- and sex-dependent clinical equations to estimate glomerular filtration rates in children and young adults with chronic kidney disease
- src_20260718_rfkid001_09: Application of GFR estimating equations to children with normal, near-normal, or discordant GFR
- src_20260718_rfkid001_04: Utility of Cystatin C-based Equation for the Estimation of Glomerular Filtration Rate in a Pediatric Population
- src_20260718_rfkid001_01: Self-reported Race, Serum Creatinine, Cystatin C, and GFR in Children and Young Adults With Pediatric Kidney Diseases: A Report From the Chronic Kidney Disease in Children (CKiD) Study
