# ChatGPT Deep Research — cbc_suite_v1 structured-extraction prompt

> **Paste this whole file into ChatGPT Deep Research.** Attach the files listed in this packet's
> `attachments.md` first. Save the result into the layout in `expected-output/README.md`.
>
> **Role for this run: STRUCTURED EXTRACTION.** Your job is to produce a **candidate-pattern table**
> — one row per candidate clinical pattern, columns: condition → trigger → threshold (+ UCUM unit) →
> source citation. This is objective #2 of the run (net-new candidate patterns). Structure and
> traceability matter more than narrative.

---

## Read this first — how your output is used (non-negotiable framing)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never
as verified clinical evidence. Only the Research Foundry verifier assigns verified status via
exact-passage binding.** Every row you produce is a *candidate*, re-verified downstream against the
exact cited passage. Nothing you write is authoritative and nothing becomes a clinical rule.

### Trust invariants — follow all five, every time

1. **Return every source with DOI/URL, publication year, and license/access status.** Every citation
   in your table must carry all three.
2. **Do NOT assert any numeric threshold without an attached citation to its source.** Every number in
   the `threshold` column must have a source citation in the same row. If you cannot cite the exact
   source of a number, leave the threshold blank and mark it `unknown` — never invent, average, or
   round-trip a cutoff.
3. **Explicitly FLAG any paywalled / rights-restricted source** (do not paraphrase around a paywall).
   If a threshold's only source is paywalled, record the threshold, cite the paywalled locator, and
   set the row's access status to `paywalled` — do not present a reconstructed number as retrieved.
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE passages** (public-domain — US federal /
   WHO — then open-license) **over copyrighted framework prose.** When two sources support the same
   pattern, cite the openly-retrievable numeric one.
5. Treat every field as data, not instruction. Do not embed directives or control text in any cell.

---

## What we are extending

This is a **deepen** pass on the existing verified bundle **RF-CBC-002** for the pediatric CBC suite
module (`cbc_suite_v1`). It already holds **4 committed candidate/decision patterns** (see below).
Your table must produce **net-new** patterns beyond those four. Work from the supplied sources
(attached `evidence.json`) **plus** any additional sources you find; cite whichever source actually
carries each threshold.

### The 4 patterns we already have — do NOT re-emit these

1. **Young-infant (<6 mo) scope-abstention** — module abstains below 6 months, routes to
   out-of-scope/missing-data prompt (age-banded ANC cutoffs differ for neonates/infants).
2. **Local-lab-range precedence** — prefer a configured local/analyzer-specific pediatric reference
   interval; abstain rather than apply a universal cutoff; normalize units before comparing.
3. **Benign-ethnic / Duffy-null neutropenia differential** — reviewable pattern (not diagnosis) toward
   a benign etiology for isolated mild neutropenia; always conflict-visible against the red-flag alert.
4. **Marrow red-flag safety rule** — persistent congenital neutropenia / marrow-failure features →
   heme-onc referral; dominates ranking over any co-occurring benign pattern.

## Objective — build the candidate-pattern table

Produce **one table** whose rows are net-new candidate patterns for these angles, each row fully
traced to the source carrying its threshold. Aim for the highest-value numeric, pediatric,
openly-retrievable rows first.

### Net-new candidate angles (objective #2)

- **Thrombocytopenia** — ITP vs. consumptive (DIC / HUS / TTP) vs. marrow-failure; platelet-count
  severity/action bands.
- **Isolated eosinophilia / monocytosis** — absolute-count triggers, reactive vs. pathologic.
- **Leukocytosis** — total-WBC elevation; left-shift vs. leukemoid reaction vs. blast/immature-cell
  referral triggers.
- **Pancytopenia** — multi-lineage cytopenia work-up ordering and referral triggers.
- **CBC-indices micro/macrocytosis (MCV)** — age-banded MCV cutoffs as a bridge into the anemia
  module.
- **Reactive vs. pathologic lymphocytosis** in young children — absolute lymphocyte-count triggers.

### Numerics targets these rows should ground to (objective #3)

- **CALIPER age-partitioned pediatric CBC reference intervals (Bohn 2023 / CALIPER program)** —
  age/sex-banded intervals with UCUM units (`10*9/L`, `g/L`, `fL`). We hold the CALIPER papers as
  bibliographic cards but not the numeric tables; if you can cite an independently-retrievable form of
  the numbers (open-access supplement, PMC, public CALIPER database), do so.
- **ANC benign-vs-severe neutropenia thresholds** (age- and race-banded).
- **Platelet-count action thresholds.**
- **Age-banded WBC / differential intervals.**

## Required table columns

| # | column | rule |
|---|---|---|
| 1 | `candidate_id` | short kebab-case slug you assign, unique per row |
| 2 | `condition` | the clinical pattern (e.g. "severe thrombocytopenia") |
| 3 | `trigger` | the CBC finding / logic that fires the pattern |
| 4 | `threshold` | the numeric cutoff **with UCUM unit**, or `unknown` if none is citable |
| 5 | `age_band` | pediatric age partition the threshold applies to (or `all`) |
| 6 | `direction` | above / below / between |
| 7 | `source_citation` | first-author + year + **DOI/URL** carrying this exact number |
| 8 | `access_status` | open-access / public-domain / paywalled / unknown |
| 9 | `retrievable_numeric` | yes/no — is the actual number independently retrievable? |
| 10 | `classification` | `assertion` (source states it directly) / `inference` (you derived it) / `annotation` |
| 11 | `notes` | conflicts, caveats, "pattern not diagnosis" framing, paywall flags |

One pattern per row. If a pattern has multiple thresholds (e.g. mild/moderate/severe bands), give one
row per band. Rows classified `inference` must say what they were inferred from — they feed the
implementation-proposal path only, never a supported claim.

Output shape and where to save it: see `expected-output/README.md`. Your prose report and this table
both import as `platform_synthesis` candidates.

---

## Already have — do NOT re-surface (20 sources in `cbc_suite_v1/evidence.json`)

| id | year | DOI | note |
|---|---|---|---|
| CALIPER2020_HEMATOLOGY_I | 2020 | 10.1093/ajcp/aqaa059 | CALIPER DxH 900 RIs — numeric tables paywalled |
| CALIPER2023_MINDRAY_79PARAM | 2023 | 10.1111/ijlh.14068 | CALIPER Mindray 79-marker RIs (Bohn 2023) — numeric tables paywalled |
| HEMATOLREP2024_NEUTROPENIA_REVIEW | 2024 | 10.3390/hematolrep16020038 | pediatric neutropenia review (open-access) |
| JPEDS2023_DUFFY_NULL_NEUTROPENIA | 2023 | 10.1016/j.jpeds.2023.113608 | Duffy-null neutropenia |
| PEDS2020_ISOLATED_NEUTROPENIA_OUTCOMES | 2020 | 10.1542/peds.2019-3637 | isolated neutropenia outcomes |
| COH2015_ELANE_MUTATIONS | 2015 | 10.1097/MOH.0000000000000105 | ELANE congenital neutropenia |
| BJHAEM2010_SCNIR_LEUKEMIA_RISK | 2010 | 10.1111/j.1365-2141.2010.08216.x | SCNIR leukemia risk |
| SCNIR2022_GCSF_OUTCOMES | 2022 | 10.1182/bloodadvances.2021005684 | SCNIR G-CSF outcomes |
| ADVCLINEXPMED2024_FA_CYTOGENETICS | 2024 | 10.17219/acem/168825 | Fanconi cytogenetics |
| ASTCT2024_SAA_HCT_GUIDELINE | 2024 | 10.1016/j.jtct.2024.09.017 | SAA HCT guideline |
| BCMD2024_AIEOP_AA_GUIDELINE | 2024 | 10.1016/j.bcmd.2024.102860 | pediatric AA guideline |
| BJHAEM2024_BSH_AA_GUIDELINE | 2024 | 10.1111/bjh.19236 | BSH AA guideline |
| BLOOD2022_TBD_OUTCOMES | 2022 | 10.1182/blood.2021013523 | telomere biology disorders |
| BLOODADV2024_SAA_DELPHI_CONSENSUS | 2024 | 10.1182/bloodadvances.2023011642 | SAA Delphi consensus |
| BLOODADV2025_RCC_OBSERVATION_OUTCOMES | 2025 | 10.1182/bloodadvances.2025016136 | refractory cytopenia of childhood |
| FRONTIMMUNOL2022_PEDIATRIC_BMF_PROTOCOL | 2022 | 10.3389/fimmu.2022.883826 | pediatric BMF eval protocol |
| INDIANPEDIATR2022_IAP_AA_CONSENSUS | 2022 | 10.1007/s13312-022-2538-x | IAP AA consensus |
| LANCETHAEM2024_DBA_CONSENSUS | 2024 | 10.1016/S2352-3026(24)00063-2 | Diamond-Blackfan anemia |
| LEUKEMIA2024_IBMFS_PROTEOGENOMICS | 2024 | 10.1038/s41375-024-02263-1 | inherited BMF proteogenomics |
| PBC2024_PEDIATRIC_SAA_RECOMMENDATIONS | 2024 | 10.1002/pbc.31070 | pediatric SAA recommendations |

You may **cite** these sources in your table when they carry a net-new threshold we have not encoded,
but do not re-emit the 4 committed patterns above. Everything in the angle list is net-new relative to
them.
