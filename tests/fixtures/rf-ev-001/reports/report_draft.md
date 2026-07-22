---
schema_version: '0.1'
type: research_report
report_id: report_20260718_research_report_for_rf_run_20260717
title: 'RF-EV-001 — Pediatric anemia evidence: exact-passage backfill'
intent_id: intent_research_20260717_rf_ev_001_pediatric_cds_backfill
evidence_bundle_id: pending
created_at: '2026-07-18T14:39:01-04:00'
status: draft
audience: technical
sensitivity: personal
claim_policy: Every material claim maps to claim_ledger.yaml or is labeled inference/speculation.
verification_status: pending
---

## Governance banner

> UNVALIDATED research prototype. rf output a PROPOSAL, not a validated rule. No autonomous diagnosis/treatment/dosing/transfusion directives. No unsupported confidence %. Missingness never treated as normal. Every clinical threshold tied to an exact passage, or flagged a proposal.

## Executive summary

WHO 2024 documents that its haemoglobin anaemia cutoffs update and consolidate a traceable lineage of prior WHO guidance (1968-2005), giving transparent provenance for the thresholds. [claim:clm_006]
The Gallagher review's core framework classifies pediatric anemia first by MCV (microcytic/normocytic/macrocytic) then refines by reticulocyte count — the morphology-first, reticulocyte-response approach the KB relies on. [claim:clm_019]
AAP names the CBC (Hb, MCV, RDW) plus serum ferritin as the two core laboratory tests for identifying iron deficiency and IDA, with both performed together. [claim:clm_029]
G6PD deficiency should be diagnosed by measuring enzyme activity directly with a quantitative spectrophotometric assay, and a quantitative assay must follow any abnormal or borderline screening test. [claim:clm_007]
FDA states a CDS software function is excluded from the device definition under section 520(o)(1)(E) only if it meets all four listed non-device CDS criteria. [claim:clm_024]

## Population-scoped thresholds table

| Parameter | Population / age band | Threshold value | UCUM units | Assay / method dependence | Source + locator | Evidence |
|-----------|----------------------|-----------------|------------|---------------------------|------------------|----------|
| Haemoglobin anaemia cutoff | Children — four WHO bands, 6 mo to 14 y | Age/population-specific cutoffs (Table 2) | g/L | Population/age-band dependent | src_20260718_rfev001_01 — Executive summary, p.xi, Table 2 | [claim:clm_001] |
| Haemoglobin anaemia cutoff | Children 6-23 mo | 2024 revision modified only this band's cutoff | g/L | Single-band revision, not a universal pediatric threshold | src_20260718_rfev001_01 — Exec summary, p.xi, Normative statement 1.a | [claim:clm_002] |
| Haemoglobin (elevation adjustment) | Any individual residing at elevation | Increment table + quadratic equation | g/L | Altitude-dependent physiologic modifier | src_20260718_rfev001_01 — Exec summary, p.xii-xiii, Normative statement 2.a.1 + Table 4 | [claim:clm_004] |
| Normal Hb / MCV / RDW reference intervals | 6-24 mo through 12-<18 y, by sex | Age- and sex-specific intervals (Table 1) | g/dL; fL; % | Analyzer / reference-population dependent | src_20260718_rfev001_00 — Table 1 (ref 42) | [claim:clm_030] |
| MCV normocytic band | Pediatric (age-varying) | 80-100 fL | fL | Analyzer-dependent, age-varying; only verbatim MCV range in source | src_20260718_rfev001_02 — Section 'Normocytic anemia', first sentence | [claim:clm_020] |
| Microcytic-anemia signature | Pediatric | Reduced MCV + elevated RDW, most consistent with IDA | fL; % | Thalassemia trait and chronic inflammation also microcytic (Table 3) | src_20260718_rfev001_00 — CBC paragraph; Table 3 | [claim:clm_034] |
| Serum ferritin ID cutoff | Young / school-aged children; adolescents and all menstruating individuals | ≤20 ng/mL; ≤30 ng/mL respectively | ng/mL | Acute-phase reactant; invalid when CRP elevated | src_20260718_rfev001_00 — Diagnosis > Iron Studies | [claim:clm_031] |
| sTfR-ferritin index (sTfR / log10 ferritin) | Pediatric, inflammation-robust discriminator | >2 iron deficiency; <1 anemia of chronic inflammation | {ratio} | Inflammation-robust substitute for ferritin | src_20260718_rfev001_00 — Diagnosis > Iron Studies; Table 4 (sTfR1) | [claim:clm_033] |
| Severe IDA classification | Confirmed IDA | Hb <7 g/dL | g/dL | Severity class only, NOT a transfusion trigger | src_20260718_rfev001_00 — Treatment of Severe or Refractory IDA > Severe IDA | [claim:clm_035] |
| Blood Lead Reference Value (BLRV) | Children | ≥3.5 µg/dL triggers recommended-action pathway | ug/dL | Venous confirmation required before action | src_20260718_rfev001_03 — 'Initial screening blood lead level' | [claim:clm_014] |
| Confirmatory venous-sample timelines | Children, by initial capillary BLL | ≥3.5-9: 3 mo; 10-19: 1 mo; 20-44: 2 wk; ≥45: 48 h | ug/dL; time | Capillary → venous confirmation schedule | src_20260718_rfev001_03 — Table 1 | [claim:clm_016] |
| BLL 3.5-19 → iron workup | Children | Test for and treat iron deficiency per AAP | ug/dL | Cross-pathway (lead → iron) coupling | src_20260718_rfev001_03 — 'BLL is 3.5-19 micrograms per deciliter' | [claim:clm_017] |
| G6PD variant classification | All ages | Class I/II <10%, III 10-60%, IV 100%, V >100% residual | % of normal | Residual-activity based | src_20260718_rfev001_05 — Page 3, Table I | [claim:clm_011] |
| G6PD activity reference values | Adults only | Reference values at 30 °C and 37 °C | U/g{Hb} | Temperature-dependent; explicitly adult | src_20260718_rfev001_05 — Page 6, 'Normal values' | [claim:clm_012] |
| G6PD activity (neonatal deviation) | Newborns, infants, 29-32 wk premature | Newborn mean ~150% of adult mean; higher still in premature | % of adult mean | Age/gestation-dependent; deviates from adult range | src_20260718_rfev001_05 — Page 6, 'Normal values' | [claim:clm_013] |

## Scope-exit / referral-triggers

- **Speculation:** Scope-exit trigger (proposal): confirmed severe IDA (Hb <7 g/dL) accompanied by hemodynamic instability, poor intake, heart failure, or uncontrolled blood loss is an acute-care referral event -- but Hb <7 g/dL ALONE is a severity classification, not a transfusion directive, since AAP notes some such children are minimally symptomatic. [claim:clm_spec02]
- CDC defines escalating action tiers at 20-44 µg/dL (history/physical, environmental investigation, PEHSU/Poison Control contact) and ≥45 µg/dL (highest tier: detailed neuro exam, possible hospital admission, toxicologist consult for chelation). [claim:clm_018]
- **Speculation:** Scope-exit / referral triggers (proposal): a confirmed venous BLL >=45 ug/dL is a highest-tier event (possible hospital admission, medical-toxicology consult, detailed neuro exam), and 20-44 ug/dL triggers PEHSU/Poison Control contact plus environmental investigation; both are urgency escalations the CDS should surface, not silently store. [claim:clm_spec03]
- **Speculation:** Referral trigger (proposal): a marrow-replacement smear pattern -- pancytopenia with relative reticulocytopenia, teardrop RBCs, giant platelets, and immature leukocytes/blasts -- should escalate to hematology/oncology and exit isolated-nutritional-anemia logic. [claim:clm_spec05]
- **Speculation:** Scope boundary (proposal): WHO 2024 provides NO haemoglobin anaemia cutoff below 6 months of age, so infants <6 months and neonates fall outside the WHO age-banded cutoff logic and require a separate neonatal pathway rather than extrapolation of the 6-23 mo <105 g/L value downward. [claim:clm_spec04]
- **Inference:** Lead and iron pathways are coupled: CDC routes a confirmed BLL of 3.5-19 ug/dL to AAP iron-deficiency testing/treatment, so an elevated confirmed BLL in that band should co-trigger the AAP CBC (Hb/MCV/RDW) + serum-ferritin iron workup in the anemia CDS. [claim:clm_inf08]

## Conflicts & method-dependence

- **Inference:** WHO's 6-23 mo anaemia cutoff of <105 g/L (=<10.5 g/dL) sits BELOW the AAP Table 1 normal-Hb lower bound of 11.0 g/dL for age 6-24 mo, so a Hb of 10.5-11.0 g/dL reads 'below AAP normal interval' yet 'not anaemic' by WHO -- two different constructs (WHO 5th-percentile anaemia cutoff vs AAP reference interval) that must be preserved, not conflated or averaged. [claim:clm_inf01]
- **Inference:** AAP 2026 ferritin ID thresholds (<=20 ng/mL young/school-aged children; <=30 ng/mL adolescents and all menstruating individuals) are markedly higher than the WHO <12/<15 ng/mL provenance cited within the same AAP source, an unresolved cross-standard ferritin conflict the CDS must carry as two named provenances rather than reconcile. [claim:clm_inf02]
- **Inference:** The AAP ferritin ID cutoffs (<=20 / <=30 ng/mL) are uninterpretable when CRP is elevated because serum ferritin is an acute-phase reactant; in that setting the sTfR-ferritin index (>2 = iron deficiency; <1 = anaemia of chronic inflammation) should replace ferritin as the ID discriminator. [claim:clm_inf03]
- **Inference:** Inflammation logic must be applied asymmetrically across analytes: WHO directs that haemoglobin NOT be adjusted for infection/inflammation, whereas AAP treats serum ferritin as inflammation-confounded -- so the CDS should inflammation-gate iron-store markers (ferritin) but leave the Hb anaemia cutoff unadjusted. [claim:clm_inf04]
- WHO explicitly recommends that haemoglobin NOT be adjusted for infection/inflammation -- a contextual caveat distinguishing haemoglobin interpretation from inflammation-adjusted iron markers. [claim:clm_005]
- Ferritin is an acute-phase reactant; an elevated CRP in an ill or inflamed child means SF cannot be treated as a reliable ID marker, while CRP is unnecessary in a clinically well child. [claim:clm_032]
- **Inference:** The BSH adult G6PD reference values (8.7+/-1.7 iu/g Hb at 30 C; 12.1+/-2.09 iu/g Hb at 37 C uncorrected) cannot be applied to neonates and infants, whose activity runs ~150% of the adult mean and is higher still in 29-32-week premature infants; NO numeric pediatric/neonatal G6PD reference value is located in any of the six sources (GAP). [claim:clm_inf05]
- **Inference:** A normal quantitative G6PD assay drawn during or soon after a haemolytic episode can be false-normal (young red cells/reticulocytes carry higher activity), so the CDS must not exclude G6PD deficiency on such a result and should flag re-assay at least 2-3 months after the episode resolves when suspicion persists. [claim:clm_inf06]
- Because reticulocytes and young red cells have much higher G6PD activity than mature cells, an assay run during or soon after a hemolytic episode can give a false-normal result. [claim:clm_008]
- When G6PD deficiency is still suspected and no other cause of hemolysis is found, the assay should be repeated at least 2-3 months after the hemolytic episode resolves so a deficiency is not missed. [claim:clm_009]
- In a recently transfused patient a G6PD deficiency may be masked, so molecular analysis should be considered when a precise diagnosis is needed. [claim:clm_010]
- **Inference:** Only the normocytic MCV band 80-100 fL is source-supported (Gallagher 2022); the microcytic (<80 fL) and macrocytic (>100 fL) bounds are inferred complements NOT stated verbatim and must be flagged as GAPS, and even the 80-100 fL anchor is analyzer-dependent and age-varying in children rather than a fixed pediatric cutoff. [claim:clm_inf07]
- WHO states physiological, environmental, and genetic factors and lifecycle variation must be considered when defining haemoglobin cutoffs -- supporting contextual, non-universal interpretation. [claim:clm_003]
- A capillary screening result at or above the BLRV must be confirmed with a venous sample before further action. [claim:clm_015]
- Reticulocyte count direction (elevated vs low relative to anemia severity) distinguishes an adequate erythropoietic response to blood loss/hemolysis from inadequate marrow production. [claim:clm_021]
- Peripheral smear morphology (spherocytes, elliptocytes, schistocytes/helmet cells) points to specific hemolytic mechanisms — supporting the KB's smear-interpretation use of this source. [claim:clm_022]
- Multilineage cytopenia — pancytopenia with relative reticulocytopenia, teardrop RBCs, giant platelets, and immature leukocytes — signals marrow replacement, backing the KB's multi-lineage-cytopenia escalation. [claim:clm_023]
- Criterion 4 requires the software be intended to enable the health care professional to independently review the basis for the recommendations so the HCP does not rely primarily on them. [claim:clm_025]
- A software function that provides a specific preventive, diagnostic, or treatment output or directive fails Criterion 3, making specificity of the output a decisive regulatory factor. [claim:clm_026]
- FDA recommends the software/labeling state the intended use, and does not consider software intended for a critical, time-sensitive task or decision to meet Criterion 4 because the HCP lacks time for independent review. [claim:clm_027]
- FDA weighs both the level of software automation and the time-critical nature of the HCP's decision making (automation bias) when deciding whether a function permits independent review. [claim:clm_028]
- **Speculation:** Implementation boundary: under FDA Criteria 3-4 the pediatric anemia CDS must present non-specific, independently-reviewable recommendations with a stated intended use and must NOT emit a specific preventive/diagnostic/treatment directive or serve a critical/time-sensitive decision, or it risks meeting the device definition -- so every located threshold ships as a reviewable proposal, not an auto-directive. [claim:clm_spec01]

## Open questions

- What is the numeric neonatal/infant G6PD activity reference range, given that no source among the six locates one and adult values are explicitly inapplicable below term?
- What are the verbatim pediatric microcytic (<80 fL) and macrocytic (>100 fL) MCV cutoffs, since only the normocytic 80-100 fL band is stated in Gallagher 2022?
- How should the CDS reconcile the AAP ferritin ID thresholds (<=20 / <=30 ng/mL) with the divergent WHO <12/<15 ng/mL provenance carried in the same source?
- What neonatal haemoglobin anaemia pathway applies below 6 months of age, where WHO 2024 provides no cutoff?

## Sources

- src_20260718_rfev001_00: Prevention, Screening, Diagnosis, and Treatment of Iron Deficiency and Iron Deficiency Anemia in Infants, Children, and Adolescents: Clinical Report
- src_20260718_rfev001_01: Guideline on haemoglobin cutoffs to define anaemia in individuals and populations
- src_20260718_rfev001_02: Anemia in the pediatric patient
- src_20260718_rfev001_03: Recommended Actions Based on Blood Lead Level
- src_20260718_rfev001_04: Clinical Decision Support Software: Guidance for Industry and Food and Drug Administration Staff
- src_20260718_rfev001_05: Laboratory diagnosis of G6PD deficiency. A British Society for Haematology Guideline
