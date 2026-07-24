# Attachments manifest — Perplexity Pro / cbc_suite_v1 (source-gathering)

Attach these **exact repo files** to the Perplexity session before pasting `prompt.md`. Paths are
repo-relative (from the repository root). They tell the provider what we already hold so it does not
re-surface it, and give it the brief it is working to.

| # | Attach this file | Why |
|---|---|---|
| 1 | `modules/cbc_suite_v1/evidence.json` | The 20 sources we already hold — the "do not re-surface" set (unless newer/superseding/open-access-numeric). |
| 2 | `modules/cbc_suite_v1/candidates.json` | The 1 committed candidate pattern already emitted. |
| 3 | `modules/cbc_suite_v1/authoring-decisions.yaml` | The 4 committed decisions and their evidentiary basis — the current coverage boundary. |
| 4 | `docs/project_plans/expansion/05-three-module-evidence-run-design.md` | The run design; **read §3.1** for the CBC brief (net-new angles + numerics targets). |

If the provider UI limits attachments or cannot read JSON/YAML, the inlined excerpt below is
self-sufficient for the source-gathering task.

---

## Current coverage / already-have sources (inlined excerpt)

**Module:** `cbc_suite_v1` (pediatric CBC suite) · status `unsigned-stub` · extends bundle
**RF-CBC-002** · `reviewedThrough: 2026-07-21`.

**The 4 committed decisions (current coverage — everything in the prompt is net-new relative to these):**
1. Young-infant (<6 mo) scope-abstention.
2. Local-lab-range precedence over universal thresholds (with unit normalization).
3. Benign-ethnic / Duffy-null neutropenia differential pattern (pattern, not diagnosis).
4. Marrow red-flag safety rule → heme-onc referral (dominates ranking).

**The 20 sources already held — do NOT re-surface (unless newer edition / supersession / an
open-access carrier of a numeric table we lack):**

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

**Key retrievability gap to attack (highest value):** the CALIPER papers (`CALIPER2020_HEMATOLOGY_I`,
`CALIPER2023_MINDRAY_79PARAM`) are held as bibliographic cards, but their **numeric age/sex-partitioned
interval tables are paywalled and not retrievable to us**. Finding an independently-retrievable form of
those numbers (open-access supplement, PMC, the public CALIPER online database, an open-license
derivative) is the single most valuable source-gathering outcome (this is the flagged **RF-EV-002**
gap).
