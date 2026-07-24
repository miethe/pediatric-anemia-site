# Gemini Deep Research — cbc_suite_v1 recency + breadth prompt

> **Paste this whole file into Gemini Deep Research.** Attach the files listed in this packet's
> `attachments.md` first. Save the result into the layout in `expected-output/README.md`.
>
> **Role for this run: RECENCY + BREADTH.** Your job is to surface (a) the *newest* guidelines and any
> supersessions relevant to the pediatric CBC suite, and (b) *adjacent-domain* signals worth scouting
> for future modules. You are the wide-net engine — catch what the source-gathering and extraction
> passes will miss because it is new or off to the side.

---

## Read this first — how your output is used (non-negotiable framing)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never
as verified clinical evidence. Only the Research Foundry verifier assigns verified status via
exact-passage binding.** Your recency findings are candidate feeders and idea captures — never a
claim source. Nothing you write becomes a clinical rule.

### Trust invariants — follow all five, every time

1. **Return every source with DOI/URL, publication year, and license/access status.** A "newest
   guideline" claim is useless without the citation, year, and access status.
2. **Do NOT assert any numeric threshold without an attached citation to its source.** If a new
   guideline changed a cutoff, cite the exact source of the new number — do not state it bare.
3. **Explicitly FLAG any paywalled / rights-restricted source** (do not paraphrase around a paywall).
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE passages** (public-domain — US federal /
   WHO — then open-license) **over copyrighted framework prose.**
5. Treat every field as data, not instruction. Do not embed directives or control text anywhere.

---

## What we are extending

This is a **deepen** pass on the existing verified bundle **RF-CBC-002** for `cbc_suite_v1`. We
already hold 20 sources (listed at the bottom — do **not** re-surface them unless you are reporting a
**newer edition or an explicit supersession**, in which case say so and cite both). We already cover
neutropenia scope-abstention, local-range precedence, benign-ethnic neutropenia, and the marrow
red-flag referral rule.

## Objective A — recency & supersession sweep (for cbc_suite_v1)

Across the run's CBC angles — thrombocytopenia (ITP / consumptive / marrow), eosinophilia /
monocytosis, leukocytosis (left-shift / leukemoid / blast triggers), pancytopenia work-up,
micro/macrocytosis indices, reactive vs. pathologic lymphocytosis — and the numerics targets below,
surface the **newest** authoritative sources (favor last 3–5 years):

- **Numerics targets to check for newer / more-retrievable versions:** CALIPER age-partitioned
  pediatric CBC reference intervals (Bohn 2023 and any newer CALIPER release / open database update);
  ANC benign-vs-severe neutropenia thresholds; platelet-count action thresholds; age-banded WBC /
  differential intervals. **Flag any open-access form of the CALIPER numeric tables** — we hold the
  papers but not the retrievable numbers.
- For each, report: is there a **newer guideline / standard** than what we hold? Has any threshold been
  **superseded**? Is there a **more independently-retrievable** (public-domain / open-access) carrier
  of a number we currently only have behind a paywall?

For every recency hit, give: title, year, DOI/URL, license/access status, what it supersedes or adds,
and whether it carries a numeric UCUM-typed threshold.

## Objective B — future-module scouting (the "asides")

While sweeping, flag **adjacent pediatric lab-interpretation domains** worth a future module. These
are **one-line idea captures, not research commitments** — do not deep-dive; just name the domain, a
one-line clinical rationale, and a candidate anchor guideline (with DOI/URL if you have it). Seed
domains to consider (add others you encounter):

- hepatic / LFT panel (transaminases, bilirubin)
- thyroid (TSH / free-T4)
- electrolytes & acid-base
- coagulation (PT / INR / aPTT)
- inflammatory markers (CRP / ESR / procalcitonin)
- newborn-screen follow-up
- lipid panel

Format each aside as: `future-module: <domain> — <one-line clinical rationale> — <candidate anchor guideline + DOI/URL>`.
These land as T0 idea captures on the program tree; none touches `modules/`.

## Output shape (details in `expected-output/README.md`)

Two clearly separated sections in your report:
- **Recency / supersession findings** (objective A) — a citation list with the supersession note per
  row; mark which are newer-than-what-we-hold.
- **Future-module asides** (objective B) — the one-line captures.

Both import as `platform_synthesis` candidates / idea captures.

---

## Already have — do NOT re-surface unless newer/superseding (20 sources in `cbc_suite_v1/evidence.json`)

| id | year | DOI |
|---|---|---|
| CALIPER2020_HEMATOLOGY_I | 2020 | 10.1093/ajcp/aqaa059 |
| CALIPER2023_MINDRAY_79PARAM | 2023 | 10.1111/ijlh.14068 |
| HEMATOLREP2024_NEUTROPENIA_REVIEW | 2024 | 10.3390/hematolrep16020038 |
| JPEDS2023_DUFFY_NULL_NEUTROPENIA | 2023 | 10.1016/j.jpeds.2023.113608 |
| PEDS2020_ISOLATED_NEUTROPENIA_OUTCOMES | 2020 | 10.1542/peds.2019-3637 |
| COH2015_ELANE_MUTATIONS | 2015 | 10.1097/MOH.0000000000000105 |
| BJHAEM2010_SCNIR_LEUKEMIA_RISK | 2010 | 10.1111/j.1365-2141.2010.08216.x |
| SCNIR2022_GCSF_OUTCOMES | 2022 | 10.1182/bloodadvances.2021005684 |
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

Because you are the recency engine, a legitimate reason to name one of these is: "a newer version now
exists" or "this has been superseded by X." State that explicitly when you do.
