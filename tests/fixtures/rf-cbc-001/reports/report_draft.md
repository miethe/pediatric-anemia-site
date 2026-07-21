---
schema_version: '0.1'
type: research_report
report_id: report_20260718_research_report_for_rf_run_20260717
title: RF-CBC-001 — Pediatric neutropenia scope-exit / red-flag evidence base
intent_id: intent_research_20260717_rf_cbc_001_pediatric_cds_establish
evidence_bundle_id: pending
created_at: '2026-07-18T15:22:39-04:00'
status: draft
audience: technical
sensitivity: personal
claim_policy: Every material claim maps to claim_ledger.yaml or is labeled inference/speculation.
verification_status: pending
---

## Governance banner

> UNVALIDATED research prototype. rf output a PROPOSAL, not a validated rule. No autonomous diagnosis/treatment/dosing/transfusion directives. No unsupported confidence %. Missingness never treated as normal. Every clinical threshold tied to an exact passage, or flagged a proposal.

## Executive summary

No established consensus guidelines exist for the diagnosis and management of isolated, asymptomatic, incidentally discovered pediatric neutropenia. [claim:clm_063]
Isolated neutropenia in children is defined by an absolute neutrophil count below 1500/μL. [claim:clm_070]
Neutropenia is defined by age- and race-specific ANC cutoffs: <2500 x10^9/L in neonates/infants, <1500 x10^9/L in toddlers/older children/adults, and 1000-1500 x10^9/L lower limit in African American children. [claim:clm_018]
By ANC, neutropenia severity is graded mild (1000-1500 x10^9/L), moderate (500-999 x10^9/L), and severe (<500 x10^9/L). [claim:clm_019]
The clinical spectrum study classifies neutropenia by absolute neutrophil count into four severity bands: mild, moderate, severe, and very severe. [claim:clm_012]
Within the 180-patient cohort, moderate neutropenia was most common and very severe least common. [claim:clm_013]
Post-infectious causes dominated the etiology of pediatric neutropenia, with congenital cases a small minority. [claim:clm_016]
Most patients recovered a normal ANC by last follow-up, supporting a predominantly benign/transient course. [claim:clm_017]
Congenital neutropenia presented at a younger median age than post-infectious neutropenia (12 vs 47 months). [claim:clm_015]
Among 155 referred children, most presented with mild or moderate neutropenia at referral. [claim:clm_071]
At a median 12-month follow-up most children had resolved and few remained in higher-severity bands, indicating limited progression. [claim:clm_072]
Only a small minority of referred children required granulocyte colony-stimulating factor therapy. [claim:clm_073]
Duffy-null phenotype-associated neutropenia accounted for 77.7% of leukopenia/neutropenia referrals at a Detroit tertiary children's hospital. [claim:clm_039]
Among Yemeni pediatric referrals, Duffy-null phenotype-associated neutropenia prevalence was 96.6%. [claim:clm_040]
Among African American pediatric referrals, Duffy-null phenotype-associated neutropenia prevalence was 91%. [claim:clm_041]
Among non-Yemeni Middle Eastern pediatric referrals, Duffy-null phenotype-associated neutropenia prevalence was 52.9%. [claim:clm_042]
Black children had higher odds of persistent mild neutropenia, consistent with a benign ethnic neutropenia consideration. [claim:clm_074]
MDS/AML occurred in 4.4% of all SCNIR patients (77/1752) but in 11.3% of the 670 congenital-neutropenia patients, concentrating myeloid risk in the congenital etiology. [claim:clm_005]
No autoimmune/idiopathic-group patient (0 of 816) evolved to a myeloid malignancy, supporting a favorable myeloid prognosis for that etiology. [claim:clm_006]
Lymphoid malignancies developed in 1.5% (12/816) of autoimmune/idiopathic patients, at a median age of 46.9 years (adult-predominant, T-cell primary). [claim:clm_007]
Thirty of 187 SCN patients (16%) developed MDS/AML while no CyN patient did (p<0.0001); all 19 frame-shift ELANE mutations occurred in SCN. [claim:clm_053]

**Inference:** Four independent sources converge on ANC <0.5 x10^9/L (=<500/uL) as the severe-neutropenia boundary (SCN definition, the severe grading band, Kostmann/SCN, and the clinical SCN diagnostic cutoff), giving high confidence this is the module's severe-neutropenia red-flag threshold. [claim:clm_inf03]

## Population-scoped thresholds table

Population-scoped neutropenia thresholds with exact-passage locators, plus the analyzer-bound reference intervals available to anchor them.

| Parameter | Population / age band | Threshold value | UCUM units | Assay / method dependence | Source + locator | Evidence |
|-----------|-----------------------|-----------------|------------|---------------------------|------------------|----------|
| ANC — severe chronic neutropenia (SCN) definition | any age, persisting >3 months | <0.5 | 10*9/L | disease definition (registry), not an analyzer reference interval | src_20260718_rfcbc001_08 — Abstract, opening sentence | [claim:clm_001] |
| ANC — SCNIR enrollment criterion | registry (pediatric + adult) | <0.5 on ≥3 occasions over ≥3 months | 10*9/L | registry operational criterion | src_20260718_rfcbc001_08 — Methods > Enrollment criteria > Neutropenia | [claim:clm_002] |
| ANC — cyclic neutropenia enrollment criterion | registry | nadir <0.2, rising usually >1.0, ~3-week intervals, 2 cycles | 10*9/L | registry operational criterion | src_20260718_rfcbc001_08 — Methods > Enrollment criteria (cyclic) | [claim:clm_003] |
| ANC — congenital neutropenia definition | beyond age 0.25–1.0 years | <0.5 | 10*9/L | registry operational criterion | src_20260718_rfcbc001_08 — Methods > Enrollment criteria (congenital) | [claim:clm_004] |
| ANC — neutropenia cutoff (age/race-partitioned) | neonates/infants; toddlers/older children/adults; African American children | <2500; <1500; 1000–1500 lower limit | 10*9/L (as rendered in source) | narrative review | src_20260718_rfcbc001_09 — §1 Introduction, neutropenia-definition paragraph | [claim:clm_018] |
| ANC — severity grading | toddler / older child / adult | mild 1000–1500; moderate 500–999; severe <500 | 10*9/L (as rendered in source) | narrative review | src_20260718_rfcbc001_09 — §1 Introduction, severity-classification paragraph | [claim:clm_019] |
| ANC — cyclic neutropenia pattern | pediatric | nadir <200 for 3–5 days, ~21-day periodicity, recover ~2000 | 10*9/L (as rendered in source) | narrative review | src_20260718_rfcbc001_09 — §2.1 Cyclic Neutropenia | [claim:clm_020] |
| ANC — severe congenital neutropenia (Kostmann) | congenital | <500 with promyelocyte-stage maturation arrest | 10*9/L (as rendered in source) | narrative review | src_20260718_rfcbc001_09 — §2.3 Kostmann / SCN | [claim:clm_021] |
| ANC — SCN clinical diagnosis | congenital | persistently <0.5 with marrow maturation arrest | 10*9/L | clinical diagnostic definition | src_20260718_rfcbc001_04 — Introduction, para 1 | [claim:clm_033] |
| ANC — cyclic neutropenia definition | ELANE cohort | <0.2 with infections recurring ~21-day intervals | 10*9/L | disease definition (ELANE cohort) | src_20260718_rfcbc001_03 — Introduction, para 1 | [claim:clm_050] |
| ANC — SCN definition | ELANE cohort | <0.5 without regular cyclic fluctuation, marrow maturation arrest | 10*9/L | disease definition (ELANE cohort) | src_20260718_rfcbc001_03 — Introduction + Methods | [claim:clm_051] |
| ANC — cyclic neutropenia diagnostic pattern | SCNIR | serial ~2.0 down to <0.2 at ~21-day intervals | 10*9/L | registry diagnostic criterion | src_20260718_rfcbc001_03 — Methods, SCNIR patients | [claim:clm_052] |
| ANC — isolated neutropenia definition | children | <1500 | /uL | referral-cohort definition | src_20260718_rfcbc001_05 — Abstract, Background | [claim:clm_070] |
| ANC — congenital neutropenia on admission | congenital subgroup (n=12) | median 200 | /mm3 | referral-cohort observation | src_20260718_rfcbc001_06 — Results, congenital subgroup | [claim:clm_014] |
| Hemoglobin reference interval | age- + sex-partitioned, birth–<21 y (sex split 14–<21 y) | age/sex-partitioned intervals | g/L | Beckman Coulter DxH 900 | src_20260718_rfcbc001_10 — Table 1, HGB row | [claim:clm_030] |
| Platelet count reference interval | age-partitioned, infancy→adolescence | age-partitioned intervals | 10*9/L | Beckman Coulter DxH 900 | src_20260718_rfcbc001_10 — Table 1, PLT row | [claim:clm_031] |
| White blood cell count reference interval | age-partitioned, early childhood | age-partitioned intervals | 10*9/L | Beckman Coulter DxH 900 | src_20260718_rfcbc001_10 — Table 1, WBC row | [claim:clm_032] |

## Scope-exit / referral-triggers

Each trigger below removes a case from the module's benign-interpretation path and refers it; proposal-tagged items encode implementation boundaries synthesized from the cited evidence, not source-stated directives.

- **Inference:** Myeloid-malignancy (MDS/AML) risk concentrates in congenital neutropenia (11.3% of SCNIR congenital patients; 16% in a second SCNIR cohort) and was never observed in autoimmune/idiopathic neutropenia (0 of 816), so a persistent congenital pattern (ANC <0.5 x10^9/L beyond infancy) is a hematology/oncology referral trigger whereas the autoimmune/idiopathic pattern carries a favorable myeloid prognosis. [claim:clm_inf04]
- **Inference:** Cyclic neutropenia is defined by a temporal pattern (nadir <0.2 x10^9/L at ~21-day periodicity), not a single value, so a single low ANC cannot distinguish cyclic from severe chronic neutropenia and the module cannot classify etiology from one measurement; serial counts (repeat CBC 2-3x/week over 6 weeks) are required to differentiate. [claim:clm_inf06]
- **Speculation:** SCOPE-EXIT (proposal): fever accompanying severe neutropenia (ANC <0.5 x10^9/L) should be treated as an out-of-scope emergency red-flag that the module refers rather than interprets, because infection risk rises as ANC falls and severe neutropenia with fever is framed as a medical emergency. [claim:clm_spec01]
- **Speculation:** SCOPE-EXIT (proposal): a history of recurrent/frequent/serious infection, a family history of blood disorders, or a progressively worsening ANC should each be a referral trigger that removes a case from the benign-interpretation path, per the top clinician-weighted follow-up factors. [claim:clm_spec02]
- **Speculation:** SCOPE BOUNDARY (proposal): the module must not interpret a single isolated low ANC as established neutropenia — it should propose a confirmatory/serial CBC (repeat at 2-4 weeks; refer only after a declining ANC is confirmed) rather than issue a standalone interpretation. [claim:clm_spec03]
- **Speculation:** SCOPE BOUNDARY (proposal): persistent ANC <0.5 x10^9/L beyond infancy and/or a bone-marrow maturation-arrest pattern (Kostmann / severe congenital neutropenia) is a specialist-referral flag warranting ELANE/genetic workup, and is a finding the module refers rather than interprets. [claim:clm_spec04]
- **Speculation:** SCOPE BOUNDARY (proposal): the module must issue no diagnosis, treatment, or dosing output — G-CSF outcome and dose figures (e.g., MDS/AML hazard plateaus and per-doubling dose-response) are prognostic context only and must remain non-executable prognostic background, never a directive. [claim:clm_spec05]

The evidence underpinning these triggers:

The three factors most driving ongoing follow-up were history of recurrent/severe infections (98%), family history of blood disorders (98%), and more severe/progressively worsening neutropenia (97%). [claim:clm_067]
Infection severity/frequency is inversely correlated with ANC and directly with neutropenia duration, and risk is higher when neutropenia results from reduced marrow production rather than peripheral destruction. [claim:clm_024]
Proposed diagnostic workflow: repeat CBC in 2-4 weeks (no further workup if resolved), and if neutropenia persists repeat CBC 2-3 times per week for 6 weeks to differentiate cyclic from severe chronic neutropenia. [claim:clm_022]
Half of providers did not request additional CBCs before consultation, and most (51%) suggested referring mild neutropenia only after confirming a declining ANC rather than on a single value. [claim:clm_066]
More than 24 genes are implicated in congenital neutropenia syndromes, with ~60% of published cases attributed to ELANE, and the authors recommend ELANE testing in all unexplained/idiopathic congenital cases. [claim:clm_023]
The authors propose that wider Duffy typing in neutropenia WITHOUT recurrent/frequent/serious infections could reduce unnecessary consultations and investigations — framing absence of such infection as the discriminator between benign and pathologic neutropenia. [claim:clm_043]

**Inference:** Duffy-null / benign-ethnic neutropenia is the dominant benign etiology of pediatric neutropenia referrals (77.7% overall, up to 96.6% in Yemeni and 91% in African American referrals), and absence of recurrent/frequent/serious infection discriminates benign from pathologic, so mild neutropenia in an ancestrally-relevant child without infection history has high pretest probability of being benign and does not by itself warrant escalation. [claim:clm_inf05]

## Conflicts & method-dependence

**Inference:** The severe-neutropenia boundary is numerically identical across sources despite divergent unit rendering: source 09 states severe as ANC <500 (rendered x10^9/L) while sources 08/03 state SCN/Kostmann as ANC <0.5 x10^9/L, and 500 cells/uL equals 0.5 x10^9/L, so the CDS converter must normalize unit conventions before any threshold comparison. [claim:clm_inf01]
**Inference:** Neonates/infants carry a higher neutropenia cutoff (ANC <2500, source 09) than toddlers/older children (ANC <1500), so applying the older-child 1500 cutoff to a neonate would under-flag; age-partitioned ANC cutoffs are required and adult cutoffs must not be reused for young children. [claim:clm_inf02]
**Inference:** Pediatric hematology reference intervals are analyzer-specific — derived variously on the Beckman Coulter DxH 900 (CALIPER) and the Mindray BC-6800Plus — so ANC/neutrophil reference intervals cannot be ported across analyzers without local verification, and the module must record the assay platform alongside any interval-based cutoff. [claim:clm_inf07]
**Inference:** GAP: none of the loaded reference-interval sources provides a located age-partitioned NEUTROPHIL/ANC reference interval — the only CALIPER DxH 900 rows located are hemoglobin, platelet, and WBC — so the module's numeric ANC cutoffs rest on disease-definition thresholds (sources 08/09), not on a primary age-partitioned ANC reference interval. [claim:clm_inf08]

Reference-standard cohorts and methods, each bound to its analyzer and derivation guideline:

The study establishes a database of pediatric reference standards for 47 hematologic parameters calculated per CLSI guidelines on the Beckman Coulter DxH 900. [claim:clm_011]
Reference standards were derived from 566 healthy children and adolescents spanning birth to under 21 years. [claim:clm_008]
CALIPER hematology reference standards were derived from 566 healthy children and adolescents spanning birth to under 21 years. [claim:clm_025]
All 47 hematologic parameters were measured on the Beckman Coulter DxH 900, making the reference standards analyzer/method-specific. [claim:clm_026]
Age-specific reference-interval differences were statistically significant for 39 of the 47 hematologic parameters examined, confirming pediatric intervals cannot rely on adult cutoffs. [claim:clm_009]
Significant age-specific differences were observed for 39 of the 47 hematologic parameters, motivating age-partitioned reference intervals. [claim:clm_027]
Sex-specific reference-interval differences were observed for eight hematologic parameters, occurring primarily during and after puberty. [claim:clm_010]
Sex-specific differences were observed for eight hematologic parameters, primarily during and after puberty. [claim:clm_028]
Reference standards were computed per CLSI guidelines, and the study concludes pediatric-specific (not adult) reference standards are needed for hematology interpretation. [claim:clm_029]
The study enrolled 687 healthy children and adolescents spanning 30 days to 18 years of age to derive pediatric hematology reference intervals. [claim:clm_057]
Age- and sex-specific reference intervals were established following the CLSI EP28-A3c guideline. [claim:clm_058]
Age partitioning of reference intervals was required for 52 of the 79 hematology parameters, with changes concentrated in infancy and puberty. [claim:clm_059]
Sex partitioning was required for 11 erythrocyte parameters, including RBC, hemoglobin, hematocrit, MCV, and MCHC. [claim:clm_060]
A few parameters had undetectable levels in the healthy cohort, specifically nucleated RBC count and immature granulocyte count. [claim:clm_061]
Whole blood was assayed for 79 hematology parameters on the Mindray BC-6800Plus system, making the derived intervals analyzer-specific. [claim:clm_062]
The study derived pediatric chemistry reference intervals from a large single-institution US outpatient dataset of children under 19 years over a two-year window. [claim:clm_044]
RefineR-derived reference intervals aligned with CALIPER in 86 of 88 age- and gender-specific analyte groups. [claim:clm_045]
CLSI EP28-A3c-derived reference intervals aligned with CALIPER in 79 of 88 groups, fewer than the RefineR approach (RefineR superior). [claim:clm_046]
Discrepancies with CALIPER were concentrated in ALT, AST, ALP, and BUN and were attributed to preanalytical and physiological variables (sample type, BMI, hydration status). [claim:clm_047]
The authors conclude CALIPER is a validated external reference-interval source for US pediatric outpatient populations and that RefineR is the more practical/accurate derivation method for this setting. [claim:clm_048]
The study motivation is that accurate pediatric reference intervals are hard to establish because of age-related physiological variation, small sample sizes, and preanalytical variability. [claim:clm_049]

Prognostic and terminology context, recorded as non-executable background for referral-weighting and never as directives:

Severe chronic neutropenia (SCN) is defined as blood neutrophils below 0.5 x 10^9/L persisting for more than 3 months. [claim:clm_001]
After 10 years on G-CSF the estimated annual hazard of MDS/AML reached a stable plateau of 2.3%/year (95% CI 1.7–2.9%). [claim:clm_034]
The estimated annual hazard of death from sepsis on long-term G-CSF was stable at 0.81%/year (95% CI 0.56–1.16%). [claim:clm_035]
After 15 years on G-CSF the cumulative incidence was 10% for sepsis death and 22% for MDS/AML. [claim:clm_036]
Patients failing to reach the cohort-median ANC of 2.188 ×10^9/L despite G-CSF at or above the median dose of 8 μg/kg/day were the high-risk subgroup for both sepsis death and MDS/AML. [claim:clm_037]
The relative hazard of MDS/AML increased 1.24-fold per doubling of the month-6 G-CSF dose (P=0.003). [claim:clm_038]
After 20 years on G-CSF, 100% of G214R (8/8) and 100% of C151Y (4/4) SCN patients experienced a severe event, versus 0% for P139L/IVS4+5 G>A and 10% for S126L. [claim:clm_054]
The estimated 20-year cumulative incidence of a severe event was 46% (95% CI 35-55%) in SCN versus 7% (95% CI 0-17%) in CyN. [claim:clm_055]
The SCNIR cohort comprised 307 patients carrying 104 distinct ELANE mutations followed longitudinally up to 27 years; sequencing was concluded useful for predicting outcomes. [claim:clm_056]
Most commonly ordered diagnostic tests for this population were CBC (98%), peripheral smear (75%), antineutrophil antibody (29%), and immunoglobulins (24%). [claim:clm_064]
Providers were more likely to order antineutrophil antibody testing in toddlers and ANA panels in adolescents, both statistically significant. [claim:clm_065]
70% of respondents had diagnosed 'benign ethnic neutropenia,' and 75% supported renaming it to 'typical neutrophil count with Fy(a-/b-) status' confirmed by red-cell phenotyping. [claim:clm_068]
This study operationally categorized isolated neutropenia into four ANC severity bands: mild, moderate, severe, and very severe. [claim:clm_069]

## Open questions / gaps

- Where is a primary age-partitioned neutrophil/ANC reference interval that the module could bind its cutoffs to, given that only hemoglobin, platelet, and WBC CALIPER DxH 900 rows were located? [claim:clm_inf08]
- Which analyzer will the deploying laboratory use, so that interval-based cutoffs are matched to the correct platform (DxH 900 vs Mindray BC-6800Plus) rather than ported across analyzers? [claim:clm_inf07]
- How should the converter normalize the divergent x10^9/L vs cells/uL unit renderings before any numeric threshold comparison, to avoid a 1000-fold error? [claim:clm_inf01]

## Sources

- src_20260718_rfcbc001_08: Outcomes for patients with severe chronic neutropenia treated with granulocyte colony-stimulating factor
- src_20260718_rfcbc001_01: CALIPER Hematology Reference Standards (I): Improving Laboratory Test Interpretation in Children (Beckman Coulter DxH 900)
- src_20260718_rfcbc001_06: Clinical spectrum of pediatric neutropenia: mostly benign, but not to be overlooked
- src_20260718_rfcbc001_09: Neutropenia in Childhood—A Narrative Review and Practical Diagnostic Approach
- src_20260718_rfcbc001_10: CALIPER Hematology Reference Standards (I)
- src_20260718_rfcbc001_04: Stable Long-Term Risk of Leukaemia in Patients with Severe Congenital Neutropenia Maintained on G-CSF Therapy
- src_20260718_rfcbc001_11: Duffy-Null Phenotype-Associated Neutropenia is the Most Common Etiology for Leukopenia/Neutropenia Referrals to a Tertiary Children's Hospital
- src_20260718_rfcbc001_00: Validating CALIPER pediatric reference intervals in a U.S. population using retrospective outpatient data and RefineR
- src_20260718_rfcbc001_03: The diversity of mutations and clinical outcomes for ELANE-associated neutropenia
- src_20260718_rfcbc001_02: Comprehensive pediatric reference intervals for 79 hematology markers in the CALIPER cohort of healthy children and adolescents using the Mindray BC-6800Plus system
- src_20260718_rfcbc001_07: Diagnosis and management of isolated neutropenia: A survey of pediatric hematologist oncologists
- src_20260718_rfcbc001_05: Outcomes of Isolated Neutropenia Referred to Pediatric Hematology-Oncology Clinic
