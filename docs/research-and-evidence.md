# Research and Evidence Report

**Review date:** 2026-07-15  
**Priority window:** 2021-01-01 through 2026-07-15  
**Clinical scope:** diagnostic support for pediatric anemia, with hard-coded CBC fallback intervals only for 6 months to <18 years.

## Executive summary

The evidence supports a transparent sequence: establish age-appropriate anemia, screen for time-critical findings, classify red-cell morphology, determine whether the marrow response is appropriate, and then apply morphology-specific discriminators. The 2026 AAP report provides the strongest current thresholds for pediatric iron deficiency, ferritin interpretation, age/sex CBC intervals, and differentiation from thalassemia and anemia of inflammation. [AAP2026_IDA]

A recent peer-reviewed pediatric review supports the broader morphology-plus-reticulocyte framework and the differential for hemolysis, blood loss, renal/inflammatory suppression, marrow failure, nutritional macrocytosis, congenital anemia, and infection. [BLOOD2022_PED_ANEMIA]

WHO’s 2024 guideline reinforces that hemoglobin cutoffs require current, population-appropriate governance and transparent provenance rather than one universal pediatric number. [WHO2024_HB] The CDC’s 2025 guidance supplies the blood-lead reference value and venous-confirmation/action pathways. [CDC2025_LEAD]

This prototype encodes only deterministic outputs. It deliberately avoids diagnostic probabilities because the source evidence does not provide a validated probability model for the full pediatric anemia differential. It also keeps diagnosis support separate from treatment, transfusion, and drug dosing.

## Evidence-search strategy

### Source hierarchy

1. Current professional-society clinical practice guidelines and clinical reports.
2. WHO/CDC/FDA and other authoritative public-health or regulatory guidance.
3. Systematic reviews, consensus statements, and major peer-reviewed narrative reviews published in the priority window.
4. Older foundational guidance only when no recent replacement was identified and the claim remains methodologically relevant.

### Inclusion criteria

- Pediatric or age-stratified evidence.
- Diagnostic thresholds, branching logic, confirmatory tests, urgent warning signs, or CDS/regulatory design requirements.
- Peer-reviewed journal, society guideline, government guidance, or standards document.
- English language for this prototype review.

### Exclusion criteria

- Consumer-facing summaries as rule sources.
- Opaque machine-learning classifiers without a clinically reviewable decision basis.
- Adult-only thresholds applied to children without age-specific support.
- Treatment recommendations not needed for the diagnostic aide.
- Single-case reports used as general decision rules.

### Recency policy

The review prioritized 2021–2026. The 2020 British Society for Haematology G6PD laboratory guideline is retained as an explicitly labeled foundational exception because the timing-related false-negative issue is important and no newer replacement was identified in this focused review. [BSH2020_G6PD]

## Reproducible deep-research prompt

```text
Act as a multidisciplinary evidence-synthesis team consisting of pediatric
hematologists, general pediatricians, laboratory medicine specialists,
clinical informaticists, human-factors engineers, medical-device regulatory
specialists, and biostatisticians.

Goal: produce an implementable, deterministic clinical decision-support
knowledge base for evaluation of pediatric anemia by licensed clinicians.
The system must not autonomously diagnose or prescribe and must expose every
input, rule, limitation, and citation so the clinician can independently
review the basis of each output.

Date policy:
- Search from 2021-01-01 through the current date first.
- Include older evidence only when no current replacement exists; label why.
- Check for superseded, retracted, or withdrawn guidance.

Required authoritative sources:
- AAP, ASH, WHO, CDC, FDA, NICE/BSH where relevant, peer-reviewed systematic
  reviews and major pediatric hematology reviews.
- Include the 2026 AAP Pediatrics clinical report on prevention, screening,
  diagnosis, and treatment of iron deficiency/iron deficiency anemia.

For every clinical rule, return:
1. unique rule ID;
2. clinical purpose;
3. exact inputs and units;
4. age/sex/gestational applicability;
5. Boolean branching condition;
6. output phrased as a diagnostic pattern, not a guaranteed diagnosis;
7. urgent exceptions and exclusion conditions;
8. recommended confirmatory question/test;
9. exact source citation, publication date, DOI/URL, and supporting passage;
10. evidence grade/strength if supplied by the source;
11. conflicts with other guidelines;
12. implementation notes clearly separated from evidence.

Build the diagnostic sequence from:
- confirmation of anemia using local age-appropriate ranges;
- safety/urgency screen;
- MCV morphology;
- reticulocyte response;
- other cell lines and smear;
- microcytic, normocytic-high-retic, normocytic-low-retic, and macrocytic
  pathways;
- neonatal/young-infant exceptions;
- confirmatory testing and specialist referral triggers.

Cover at minimum:
iron deficiency, anemia of inflammation, alpha/beta thalassemia, sickling
hemoglobinopathies, blood loss, immune and nonimmune hemolysis, G6PD
deficiency, hereditary spherocytosis, microangiopathy, lead, B12/folate/copper,
renal/endocrine/liver causes, transient erythroblastopenia, parvovirus aplastic
crisis, malignancy/infiltration, aplastic anemia, Diamond-Blackfan anemia,
Fanconi anemia, infection/travel, medication/toxin causes, and mixed anemia.

Deliver:
- evidence table;
- conflicts/gaps table;
- adaptive questionnaire ordered by diagnostic information gain;
- deterministic decision tree;
- machine-readable rule JSON;
- test cases including dangerous misses and missing-data cases;
- validation protocol;
- FDA CDS/SaMD, IEC 62304, ISO 14971, privacy/HIPAA, cybersecurity, and human-
  factors roadmap.

Do not invent a cutoff. When the source does not support a universal number,
require the reporting laboratory's interpretation. Clearly mark proposed
implementation decisions as proposals rather than evidence-based clinical
facts.
```

## Key evidence translated into rules

### Confirming anemia and morphology

The prototype first uses local laboratory lower/upper limits. When these are absent, it uses the AAP 2026 table for hemoglobin, MCV, and RDW only from 6 months to <18 years and only when sex assigned at birth is available for the sex-stratified interval. [AAP2026_IDA]

The fallback intervals encoded in `src/referenceRanges.js` are:

| Age | Female Hb lower | Male Hb lower | Female MCV range | Male MCV range | Female RDW upper | Male RDW upper |
|---|---:|---:|---:|---:|---:|---:|
| 6 to <24 months | 11.0 | 11.0 | 73.3–83.2 | 71.1–82.2 | 15.4 | 15.9 |
| 2 to <6 years | 11.0 | 11.0 | 75.2–85.0 | 74.1–84.3 | 14.5 | 14.7 |
| 6 to <12 years | 11.2 | 11.3 | 78.3–87.7 | 77.8–86.5 | 13.9 | 13.7 |
| 12 to <18 years | 11.4 | 12.4 | 80.5–91.8 | 80.4–90.1 | 14.6 | 13.7 |

Units are g/dL for hemoglobin, fL for MCV, and percent for RDW. [AAP2026_IDA]

The system refuses to infer a neonatal threshold because early-infant hemoglobin changes rapidly and requires postnatal age, gestational age, birth events, and local neonatal reference data. That refusal is an **implementation safety decision**, supported by the general need for age-specific interpretation rather than a claim that no neonatal algorithm can be built. [WHO2024_HB; BLOOD2022_PED_ANEMIA]

### Iron deficiency

The AAP 2026 report recommends ferritin thresholds of ≤20 ng/mL for young and school-aged children and ≤30 ng/mL for adolescents and all menstruating patients. A low ferritin supports iron deficiency; a normal/high ferritin is less reliable during inflammation because ferritin is an acute-phase reactant. [AAP2026_IDA]

The app therefore implements:

```text
ferritin threshold = 30 if menstruating
                  or age 12 to <18 years
                  else 20 for age 6 months to <12 years
```

- Anemia + ferritin at/below threshold → “iron deficiency anemia pattern meets a research-defined criterion.”
- No anemia + ferritin at/below threshold → “iron deficiency without anemia pattern.”
- Elevated CRP + non-low ferritin → iron deficiency remains not excluded.
- sTfR/log10(ferritin) >2 supports iron deficiency; <1 supports anemia of inflammation without absolute iron deficiency; 1–2 is not treated as decisive. [AAP2026_IDA]

The system does not automatically prescribe iron or infer adherence. A prior adequate trial and nonresponse are clinician-entered facts; rare iron-handling disorders are only raised after common causes are addressed.

### Thalassemia and other globin disorders

Microcytosis with non-low ferritin, a relatively high RBC count, target cells, family/newborn-screen evidence, or age-appropriate hemoglobin analysis supports a thalassemia pathway but does not establish genotype. Elevated HbA2 after infancy supports beta-thalassemia trait; iron deficiency can lower HbA2 and complicate exclusion. Hb Bart’s on the newborn screen supports alpha thalassemia, while routine electrophoresis may be non-diagnostic outside the newborn period and alpha-globin testing may be required. [AAP2026_IDA]

The app does not use the Mentzer index as a diagnostic rule. Published indices can assist pattern recognition, but their performance varies across populations and analyzers; using a hard binary threshold as a diagnosis would be overconfident. This is an implementation choice favoring direct biochemical and hemoglobin-analysis evidence.

### Anemia of inflammation

The implemented strong pattern requires anemia, elevated CRP, non-low ferritin, low transferrin saturation, and low/normal TIBC, or an sTfR/ferritin index <1 in an inflammatory context. [AAP2026_IDA] A normocytic, low-reticulocyte anemia in chronic inflammatory disease is retained as a weaker pattern because it is less specific. [BLOOD2022_PED_ANEMIA]

### Lead

A blood lead level ≥3.5 µg/dL enters the CDC lead pathway. Elevated capillary results require venous confirmation on a level-dependent timeline; 20–44 µg/dL and ≥45 µg/dL trigger progressively urgent alerts. Lead is not treated as the sole cause of anemia, and coexisting iron deficiency remains a required consideration. [CDC2025_LEAD]

### Reticulocyte response and hemolysis

The broad pediatric framework uses reticulocyte response to divide high-loss/destruction from inadequate production. [BLOOD2022_PED_ANEMIA] Because reticulocyte reference intervals and interpretation vary by age, anemia severity, assay, and laboratory, the prototype asks the clinician to classify the response as low, inappropriately normal, appropriate, high, or unknown rather than hard-coding a universal count.

A general hemolysis pattern requires at least two of indirect bilirubin high, LDH high, and haptoglobin low; this is an implementation decision intended to avoid overreacting to one nonspecific marker. Etiology-specific patterns then use DAT, smear, exposure, family, newborn-screen, and specialized test results. [BLOOD2022_PED_ANEMIA]

A normal G6PD assay during acute hemolysis/reticulocytosis or soon after transfusion is flagged as potentially falsely reassuring; repeat quantitative testing at baseline is suggested when suspicion persists. [BSH2020_G6PD]

### Production failure and marrow red flags

Low/inappropriately normal reticulocytes direct the algorithm toward renal/inflammatory suppression, transient erythroblastopenia, parvovirus aplastic crisis in chronic hemolytic disease, nutrient deficiency, or marrow failure/infiltration. Additional cytopenias, blasts, organomegaly, lymphadenopathy, petechiae, or unexplained bruising trigger urgent specialist evaluation. [BLOOD2022_PED_ANEMIA]

The tool identifies inherited marrow-failure **pathways**, not syndromic diagnoses. Early-onset macrocytic reticulocytopenic anemia, congenital anomalies, limb/radius findings, skin pigmentation, short stature, and progressive cytopenias trigger hematology/genetics review for Diamond-Blackfan, Fanconi, and related disorders. [BLOOD2022_PED_ANEMIA]

## Evidence gaps and conflicts

| Topic | Gap/conflict | Prototype handling |
|---|---|---|
| Hemoglobin cutoff governance | WHO and laboratory/clinical sources may use different population, altitude, and physiologic adjustments. | Local interval wins; built-in AAP values are labeled fallbacks. No altitude correction is calculated. |
| Neonates and young infants | Rapidly changing values and gestational/birth-specific causes make a static general-pediatric cutoff unsafe. | No built-in classification below 6 months; explicit neonatal pathway alert. |
| Reticulocyte response | No single universal pediatric threshold fits every age, assay, and anemia severity. | Clinician supplies local interpretation. |
| Ferritin during inflammation | Normal/high ferritin does not exclude iron deficiency. | CRP and full iron pattern are required; low ferritin remains decisive. |
| Thalassemia indices | Screening indices have population-dependent accuracy. | No Mentzer-based diagnosis; direct evidence is prioritized. |
| Rare congenital anemia | Evidence is disease-specific and confirmatory testing is specialized. | Pattern recognition and referral only. |
| Treatment/transfusion | Thresholds depend on diagnosis, symptoms, trajectory, comorbidity, and setting. | Excluded from the diagnostic engine. Hb <7 is presented only as the AAP severe-IDA category plus an urgent assessment flag, not as a transfusion command. |
| FDA CDS status | Regulatory classification depends on intended use and implementation, not disclaimers alone. | Independent-review design targets are documented; no claim of exemption is made. |

## Evidence registry

### [AAP2026_IDA]

American Academy of Pediatrics. *Prevention, Screening, Diagnosis, and Treatment of Iron Deficiency and Iron Deficiency Anemia in Infants, Children, and Adolescents: Clinical Report.* Pediatrics. 2026;158(1):e2026077414. doi:10.1542/peds.2026-077414. Published 2026-06-22.  
https://publications.aap.org/pediatrics/article/158/1/e2026077414/207901/Prevention-Screening-Diagnosis-and-Treatment-of

### [WHO2024_HB]

World Health Organization. *Guideline on haemoglobin cutoffs to define anaemia in individuals and populations.* 2024. ISBN 978-92-4-008854-2.  
https://www.who.int/publications/i/item/9789240088542

### [BLOOD2022_PED_ANEMIA]

*Anemia in the pediatric patient.* Blood. 2022;140(6):571–593. doi:10.1182/blood.2021013018. PMCID: PMC9373018.  
https://doi.org/10.1182/blood.2021013018

### [CDC2025_LEAD]

US Centers for Disease Control and Prevention. *Recommended Actions Based on Blood Lead Level.* Updated 2025-08-21.  
https://www.cdc.gov/lead-prevention/hcp/clinical-guidance/index.html

### [FDA2026_CDS]

US Food and Drug Administration. *Clinical Decision Support Software: Guidance for Industry and Food and Drug Administration Staff.* Final guidance. January 2026.  
https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software

### [BSH2020_G6PD]

British Society for Haematology. *Laboratory diagnosis of G6PD deficiency: A British Society for Haematology Guideline.* British Journal of Haematology. 2020;189(1):24–38. Retained as a foundational exception to the five-year priority window.
