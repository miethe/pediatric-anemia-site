# Attachments manifest — Gemini Deep Research / cbc_suite_v1 (recency + breadth)

Attach these **exact repo files** to the Gemini Deep Research session before pasting `prompt.md`.
Paths are repo-relative (from the repository root). They fix your baseline: what we hold (so "newer"
means newer than these) and the run's angles (so your breadth sweep stays on-target).

| # | Attach this file | Why |
|---|---|---|
| 1 | `modules/cbc_suite_v1/evidence.json` | The 20 held sources and their years — your "newer than this?" baseline. |
| 2 | `modules/cbc_suite_v1/candidates.json` | The 1 committed candidate. |
| 3 | `modules/cbc_suite_v1/authoring-decisions.yaml` | The 4 committed decisions (current coverage). |
| 4 | `docs/project_plans/expansion/05-three-module-evidence-run-design.md` | Run design; **read §3.1** (CBC angles/numerics) and **§6** (future-module scouting seed domains). |

If the UI cannot read JSON/YAML, the inlined excerpt below carries the baseline you need.

---

## Current coverage / already-have sources (inlined excerpt)

**Module:** `cbc_suite_v1` · status `unsigned-stub` · extends bundle **RF-CBC-002** ·
`reviewedThrough: 2026-07-21`.

**Current coverage (the 4 committed decisions):** young-infant (<6 mo) scope-abstention;
local-lab-range precedence; benign-ethnic / Duffy-null neutropenia differential; marrow red-flag →
heme-onc referral.

**The 20 sources already held — a "newer/superseding" hit against any of these is exactly what this
role wants; name it and cite both old and new:**

| id | year | organization | DOI |
|---|---|---|---|
| CALIPER2020_HEMATOLOGY_I | 2020 | Am. J. Clinical Pathology (OUP) | 10.1093/ajcp/aqaa059 |
| CALIPER2023_MINDRAY_79PARAM | 2023 | Int. J. Laboratory Hematology (Wiley) | 10.1111/ijlh.14068 |
| COH2015_ELANE_MUTATIONS | 2015 | Current Opinion in Hematology | 10.1097/MOH.0000000000000105 |
| BJHAEM2010_SCNIR_LEUKEMIA_RISK | 2010 | Br. J. Haematology (Wiley) | 10.1111/j.1365-2141.2010.08216.x |
| PEDS2020_ISOLATED_NEUTROPENIA_OUTCOMES | 2020 | Pediatrics (AAP) | 10.1542/peds.2019-3637 |
| SCNIR2022_GCSF_OUTCOMES | 2022 | Blood Advances (ASH) | 10.1182/bloodadvances.2021005684 |
| HEMATOLREP2024_NEUTROPENIA_REVIEW | 2024 | Hematology Reports (MDPI, open-access) | 10.3390/hematolrep16020038 |
| JPEDS2023_DUFFY_NULL_NEUTROPENIA | 2023 | J. Pediatrics (Elsevier) | 10.1016/j.jpeds.2023.113608 |
| ADVCLINEXPMED2024_FA_CYTOGENETICS | 2024 | Adv. Clin. Exp. Medicine | 10.17219/acem/168825 |
| ASTCT2024_SAA_HCT_GUIDELINE | 2024 | Transplantation & Cellular Therapy | 10.1016/j.jtct.2024.09.017 |
| BCMD2024_AIEOP_AA_GUIDELINE | 2024 | Blood Cells, Molecules & Diseases (Elsevier) | 10.1016/j.bcmd.2024.102860 |
| BJHAEM2024_BSH_AA_GUIDELINE | 2024 | Br. J. Haematology (BSH) | 10.1111/bjh.19236 |
| BLOOD2022_TBD_OUTCOMES | 2022 | Blood (ASH) | 10.1182/blood.2021013523 |
| BLOODADV2024_SAA_DELPHI_CONSENSUS | 2024 | Blood Advances (ASH) | 10.1182/bloodadvances.2023011642 |
| BLOODADV2025_RCC_OBSERVATION_OUTCOMES | 2025 | Blood Advances (ASH) | 10.1182/bloodadvances.2025016136 |
| FRONTIMMUNOL2022_PEDIATRIC_BMF_PROTOCOL | 2022 | Frontiers in Immunology (open-access) | 10.3389/fimmu.2022.883826 |
| INDIANPEDIATR2022_IAP_AA_CONSENSUS | 2022 | Indian Pediatrics (IAP) | 10.1007/s13312-022-2538-x |
| LANCETHAEM2024_DBA_CONSENSUS | 2024 | Lancet Haematology (Elsevier) | 10.1016/S2352-3026(24)00063-2 |
| LEUKEMIA2024_IBMFS_PROTEOGENOMICS | 2024 | Leukemia (Nature Portfolio) | 10.1038/s41375-024-02263-1 |
| PBC2024_PEDIATRIC_SAA_RECOMMENDATIONS | 2024 | Pediatric Blood & Cancer (Wiley) | 10.1002/pbc.31070 |

**Recency target of highest value:** any newer CALIPER release or **open-access carrier** of the
age/sex-partitioned pediatric CBC interval numbers (we hold the 2020/2023 papers but not the
retrievable numeric tables — the flagged **RF-EV-002** gap).

**Future-module scouting seed domains (§6):** hepatic/LFT, thyroid (TSH/FT4), electrolytes &
acid-base, coagulation (PT/INR), inflammatory markers (CRP/ESR/procalcitonin), newborn-screen
follow-up, lipid panel. One-line captures only — no deep dive, nothing touches `modules/`.
