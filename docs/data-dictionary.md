# Data Dictionary

## General conventions

- Numeric laboratory values use the units shown; production integration should use UCUM.
- `null` or missing means unknown, not normal.
- Local laboratory interpretation takes precedence for assay-dependent tests.
- Boolean history fields mean “clinician has assessed and selected present”; false in the prototype can also mean not selected, so production should support explicit present/absent/unknown tri-state values.

## Core fields

| JSON path | Type/unit | Required for | Notes |
|---|---|---|---|
| `patient.ageMonths` | number, months | built-in range and age-specific differential | Built-in ranges only 6–<216 months |
| `patient.sexAtBirth` | enum | AAP fallback ranges | `unspecified` requires local ranges |
| `patient.menstruating` | boolean | ferritin threshold and blood-loss questions | AAP threshold becomes 30 ng/mL |
| `patient.recentTransfusion` | boolean | interpretation limitation | Affects indices and specialized assays |
| `patient.highAltitude` | boolean | interpretation limitation | Prototype applies no altitude correction |
| `cbc.hemoglobin` | g/dL | anemia classification | Compare with local/fallback lower limit |
| `cbc.mcv` | fL | morphology | Compare with local/fallback limits |
| `cbc.rdw` | % | pattern support | Optional |
| `cbc.rbc` | 10^12/L | thalassemia pattern | Prefer local interpretation |
| `cbc.wbc`, `anc`, `platelets` | 10^9/L | safety/marrow branch | Need local lower limits or explicit flags |
| `reticulocytes.response` | enum | production vs loss/destruction | Clinician/lab-context interpretation |

## Iron and inflammation

| JSON path | Type/unit | Interpretation |
|---|---|---|
| `labs.ferritin` | ng/mL | Compared with AAP threshold |
| `labs.crpStatus` | normal/elevated/unknown | Identifies ferritin confounding |
| `labs.tsatStatus` | low/normal/high/unknown | Local interpretation |
| `labs.tibcStatus` | low/normal/high/unknown | Local interpretation |
| `labs.ironStatus` | low/normal/high/unknown | Local interpretation; not used alone to diagnose ID |
| `labs.stfrFerritinIndex` | number | >2 supports ID; <1 supports inflammation in AAP report |

## Hemolysis and globin testing

| JSON path | Allowed values | Purpose |
|---|---|---|
| `labs.indirectBilirubinStatus` | normal/high/unknown | hemolysis marker |
| `labs.ldhStatus` | normal/high/unknown | hemolysis marker |
| `labs.haptoglobinStatus` | normal/low/unknown | hemolysis marker |
| `labs.datStatus` | positive/negative/unknown | immune vs nonimmune pathway |
| `labs.hbA2Status` | elevated/normal/unknown | beta-thalassemia pattern |
| `labs.hbBartNewbornScreen` | boolean | alpha-thalassemia pattern |
| `labs.alphaGlobinTestingPositive` | boolean | molecular confirmation flag |
| `labs.betaGlobinTestingPositive` | boolean | molecular confirmation flag |
| `labs.sicklingHemoglobinDetected` | boolean | sickling hemoglobinopathy pathway |
| `labs.g6pdStatus` | deficient/normal/unknown | G6PD pathway |
| `labs.g6pdTestDuringAcuteHemolysis` | boolean | false-normal caution |
| `labs.g6pdTestSoonAfterTransfusion` | boolean | false-normal caution |

## Lead

| JSON path | Type/unit | Rule |
|---|---|---|
| `labs.bloodLeadLevel` | µg/dL | ≥3.5 enters CDC pathway; 20–44 urgent; ≥45 emergency tier |
| `labs.leadSpecimen` | capillary/venous/unknown | Elevated capillary requires venous confirmation |

## Nutrient, renal, endocrine, and liver status

The prototype uses local categorical interpretation for B12, folate, copper, creatinine/eGFR, TSH, and liver tests. A production build should ingest quantitative values with units, assay-specific ranges, specimen date/time, and abnormal flags, while preserving the local interpretation.

## Smear enumeration

- `target-cells`
- `spherocytes`
- `schistocytes`
- `bite-or-blister-cells`
- `sickle-cells`
- `basophilic-stippling`
- `hypersegmented-neutrophils`
- `blasts`
- `teardrops`
- `nucleated-rbc`
- `elliptocytes`

Production should capture reviewer identity, review status, and a distinction between analyzer flag and manual confirmation.

## History domains

The schema supports dietary iron risk, cow-milk intake, pica, prematurity, malabsorption, menstrual/GI/nasal/donation/other blood loss, chronic inflammatory/renal/liver/thyroid disease, recent viral illness, malaria risk, family/known hemoglobinopathy, chronic hemolytic disease, oxidant exposure, medication-associated macrocytosis, lead risk, congenital anomalies, growth/limb/pigmentation findings, and prior iron-response information.

Production should change booleans to tri-state values and record `askedAt`, `source` (patient/parent/EHR/clinician), and optional structured detail.
