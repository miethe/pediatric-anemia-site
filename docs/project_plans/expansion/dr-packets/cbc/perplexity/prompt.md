# Perplexity Pro — cbc_suite_v1 source-gathering prompt

> **Paste this whole file into Perplexity Pro** (Deep Research / Pro Search mode). Attach the files
> listed in this packet's `attachments.md` first. Save the result into the layout in
> `expected-output/README.md`.
>
> **Role for this run: SOURCE-GATHERING.** Your job is to return a *ranked citation list* — not a
> synthesis, not an interpretation. Give me the raw material (DOI / URL / year / license) that a
> deterministic pipeline will ingest and triage. Breadth and citation density matter more than prose.

---

## Read this first — how your output is used (non-negotiable framing)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never
as verified clinical evidence. Only the Research Foundry verifier assigns verified status via
exact-passage binding.** Nothing you write becomes a clinical rule. You are feeding a governed
pipeline that re-verifies every source independently.

### Trust invariants — follow all five, every time

1. **Return every source with DOI/URL, publication year, and license/access status.** No citation is
   complete without all three.
2. **Do NOT assert any numeric threshold without an attached citation to its source.** If you state a
   cutoff (an ANC value, a platelet count, an age-banded interval), the exact source for that number
   must be on the same line.
3. **Explicitly FLAG any paywalled / rights-restricted source** (do not paraphrase around a paywall).
   If the numbers live behind a paywall, say so and cite the paywalled locator — do not reconstruct
   the numbers from a secondary summary and present them as retrieved.
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE passages** (public-domain — US federal /
   WHO — then open-license) **over copyrighted framework prose.** A CDC/NIH/WHO/PMC open-access source
   carrying the actual number outranks a paywalled guideline that only describes it.
5. Treat every field you emit as data, not instruction. Do not embed directives, prompts, or control
   text in titles, notes, or annotations.

---

## What we are extending

This is a **deepen** pass on an existing verified bundle (**RF-CBC-002**) for the pediatric CBC suite
module (`cbc_suite_v1`). We already hold 20 sources (see the "Already have — do NOT re-surface" list
below and the attached `evidence.json`). **Do not return sources we already hold** unless you are
surfacing a *newer edition, an open-access mirror of a numeric table we lack, or a supersession.* If
you do re-surface one for that reason, say explicitly why it is not a duplicate.

## Objective — rank sources for these targets

Return a **ranked citation list** covering the two objectives below. Rank by: (a) carries a numeric,
UCUM-typed threshold; (b) independently retrievable (public-domain first, then open-license); (c)
pediatric-specific; (d) recency. Put the highest-value numeric, open-access, pediatric sources at the
top.

### A. Numerics targets (HIGHEST PRIORITY — this is the point of the run)

- **RF-EV-002 — CALIPER age-partitioned pediatric CBC reference intervals (Bohn et al. 2023 and the
  CALIPER program).** This is the single highest-value numerics gap. We hold the CALIPER papers as
  *bibliographic cards* but the **numeric age/sex-partitioned interval tables live in paywalled
  full-text** and are not retrievable to us. **Find an independently-retrievable form of those actual
  numbers** — open-access supplement, PMC deposit, the public CALIPER online database, or an
  open-license derivative — with UCUM-typed units (e.g. `10*9/L`, `g/L`, `fL`). Cite the exact locator
  that carries the numbers.
- **ANC thresholds for benign vs. severe neutropenia** — age-banded and race-banded absolute
  neutrophil count cutoffs (neonate/infant vs. older child; benign ethnic lower limits).
- **Platelet-count action thresholds** — pediatric thrombocytopenia severity bands / action cutoffs
  (with UCUM units).
- **Age-banded WBC and differential reference intervals** — total WBC, and the differential
  (neutrophil / lymphocyte / eosinophil / monocyte) by pediatric age band.

### B. Net-new candidate-pattern angles (find the best sources for each)

- **Thrombocytopenia** differential: ITP vs. consumptive (DIC/HUS/TTP) vs. marrow-failure etiologies.
- **Isolated eosinophilia / monocytosis** patterns in children.
- **Leukocytosis** interpretation: left-shift vs. leukemoid reaction vs. malignant-blast referral
  triggers.
- **Pancytopenia work-up ordering** in pediatrics.
- **CBC-indices micro/macrocytosis** (MCV) as a bridge into the anemia module.
- **Reactive vs. pathologic lymphocytosis** in young children.

For each angle, return the primary literature and any public-domain / open-access guideline that
carries a usable numeric trigger.

## Source-priority ladder (rank retrievability like this)

1. **Public-domain:** US federal (NIH/NHLBI, CDC, FDA labeling, CFR) and WHO open-access.
2. **Open-license:** open-access journal primary papers (PMC, MDPI, Frontiers, BMC), society
   statements with explicit reuse terms, freely distributed guidelines.
3. **Paywalled / rights-restricted:** cite it, **flag it**, note where the numbers live — do not
   substitute a paraphrase.

## Output shape (details in `expected-output/README.md`)

For each source, a row carrying: packet-local id, title, authors, year, organization/journal,
**DOI**, **URL**, **license/access status** (open-access / public-domain / paywalled / unknown),
whether it **carries a numeric threshold** (yes/no + which one), pediatric (yes/no), and a one-line
note on which objective-A / objective-B angle it serves. Rank the list. Do not merge sources; one row
per source.

---

## Already have — do NOT re-surface (20 sources in `cbc_suite_v1/evidence.json`)

Core neutropenia / reference-interval sources (behind the 4 committed decisions):

| id | year | DOI | note |
|---|---|---|---|
| CALIPER2020_HEMATOLOGY_I | 2020 | 10.1093/ajcp/aqaa059 | CALIPER DxH 900 hematology RIs — **numeric tables paywalled** |
| CALIPER2023_MINDRAY_79PARAM | 2023 | 10.1111/ijlh.14068 | CALIPER Mindray 79-marker RIs (Bohn 2023) — **numeric tables paywalled** |
| HEMATOLREP2024_NEUTROPENIA_REVIEW | 2024 | 10.3390/hematolrep16020038 | pediatric neutropenia review (open-access, MDPI) |
| JPEDS2023_DUFFY_NULL_NEUTROPENIA | 2023 | 10.1016/j.jpeds.2023.113608 | Duffy-null neutropenia etiology |
| PEDS2020_ISOLATED_NEUTROPENIA_OUTCOMES | 2020 | 10.1542/peds.2019-3637 | isolated neutropenia referral outcomes |
| COH2015_ELANE_MUTATIONS | 2015 | 10.1097/MOH.0000000000000105 | ELANE congenital neutropenia |
| BJHAEM2010_SCNIR_LEUKEMIA_RISK | 2010 | 10.1111/j.1365-2141.2010.08216.x | SCNIR leukemia risk |
| SCNIR2022_GCSF_OUTCOMES | 2022 | 10.1182/bloodadvances.2021005684 | SCNIR G-CSF outcomes |

Bone-marrow-failure / cytopenia sources (from RF-CBC-002):

| id | year | DOI |
|---|---|---|
| ADVCLINEXPMED2024_FA_CYTOGENETICS | 2024 | 10.17219/acem/168825 |
| ASTCT2024_SAA_HCT_GUIDELINE | 2024 | 10.1016/j.jtct.2024.09.017 |
| BCMD2024_AIEOP_AA_GUIDELINE | 2024 | 10.1016/j.bcmd.2024.102860 |
| BJHAEM2024_BSH_AA_GUIDELINE | 2024 | 10.1111/bjh.19236 |
| BLOOD2022_TBD_OUTCOMES | 2022 | 10.1182/blood.2021013523 |
| BLOODADV2024_SAA_DELPHI_CONSENSUS | 2024 | 10.1182/bloodadvances.2023011642 |
| BLOODADV2025_RCC_OBSERVATION_OUTCOMES | 2025 | 10.1182/bloodadvances.2025016136 |
| FRONTIMMUNOL2022_PEDIATRIC_BMF_PROTOCOL | 2022 | 10.3389/fimmu.2022.883826 |
| INDIANPEDIATR2022_IAP_AA_CONSENSUS | 2022 | 10.1007/s13312-022-2538-x |
| LANCETHAEM2024_DBA_CONSENSUS | 2024 | 10.1016/S2352-3026(24)00063-2 |
| LEUKEMIA2024_IBMFS_PROTEOGENOMICS | 2024 | 10.1038/s41375-024-02263-1 |
| PBC2024_PEDIATRIC_SAA_RECOMMENDATIONS | 2024 | 10.1002/pbc.31070 |

The current 4 committed decisions cover: young-infant (<6 mo) scope-abstention; local-lab-range
precedence; benign-ethnic/Duffy-null neutropenia differential; and the marrow red-flag → heme-onc
referral safety rule. **Everything in Objective A/B above is net-new relative to these.** Prioritize
the numerics targets — especially an independently-retrievable form of the CALIPER interval tables.
