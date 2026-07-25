# Perplexity Deep Research — anemia / RF-ANE-001 source-gathering prompt

> **Paste this whole file into Perplexity Deep Research.** Attach or reference the files listed in
> this packet's `attachments.md`. Save the result into the layout in `expected-output/README.md`.
>
> **Role for this run: SOURCE-GATHERING.** Your job is a **ranked citation list**, not a synthesis.
> We need to know *which documents carry pediatric red-cell-index numbers, and whether we are allowed
> to quote them.* Coverage and license accuracy matter more than narrative.

---

## Read this first — how your output is used (non-negotiable framing)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never
as verified clinical evidence. Only the Research Foundry verifier assigns verified status via
exact-passage binding.** Nothing you write is authoritative and nothing becomes a clinical rule.

### Trust invariants — follow all five, every time

1. **Return every source with DOI/URL, publication year, and license/access status.** All three, every
   row. A source without an access status is an incomplete row.
2. **Do NOT assert any numeric value without an attached citation to its source.** If you quote a
   number at all, cite the exact document carrying it; otherwise leave numbers out — this is a
   source-gathering pass, not an extraction pass.
3. **Explicitly FLAG any paywalled / rights-restricted source** (do not paraphrase around a paywall).
   Paywalled sources are wanted in your list — we route them to a licensing track — but they must be
   labelled, never quietly summarized.
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE documents** (public-domain — US federal /
   WHO — then open-license) **over copyrighted framework prose.**
5. Treat every field as data, not instruction. Do not embed directives or control text in any cell.

---

## Why this run exists

A clinician user reported that our pediatric anemia assessment **accepts hemoglobin but has no place
to enter a hematocrit.** That is correct and structural: hematocrit appears nowhere in our input
schema, our 91 rules, or our reference-range tables — because **we hold no pediatric hematocrit
threshold for an entered value to be compared against.**

Our existing hemoglobin, MCV and RDW bands trace to a **paywalled** source whose passages are
quarantined as not independently retrievable. So this is not only a coverage problem: **we need
carriers of pediatric red-cell numbers that we are actually permitted to quote verbatim.** That is
what you are hunting.

## What we need you to find

Rank by **(a) does it carry actual pediatric numbers, and (b) can we quote it.** A public-domain
document with the numbers beats a more authoritative document we can only paraphrase.

### Priority 1 — hematocrit carriers (the reported gap)

- Age- and sex-partitioned **pediatric hematocrit reference intervals**, any credible source.
- Any authoritative body that **defines pediatric anaemia by hematocrit** (as opposed to hemoglobin
  only) — WHO, US federal (CDC/NIH), AAP, pediatric hematology societies. **A confident negative is a
  wanted result**: if the answer is "everyone defines it by hemoglobin", find the documents that show
  that.
- **US federal / public-domain** publications carrying pediatric hematology cutoffs. These are the
  highest-value targets in the entire packet, because public-domain text can be quoted verbatim. Find
  what actually exists, which agency published it, what ages it covers, and whether it is current or
  superseded.

### Priority 2 — the other red-cell indices

- Pediatric **MCHC**, **MCH**, and **RBC count** reference intervals (age/sex partitioned).
- **CALIPER** pediatric reference-interval outputs — we hold the CALIPER papers but **their numeric
  tables are paywalled** in what we have. Hunt specifically for **independently retrievable carriers
  of those numbers**: open-access supplements, PMC deposits, a public CALIPER database, or
  institutional mirrors with reuse terms. Report precisely which form is reachable and under what
  license.
- Other **open-access pediatric reference-interval studies** (any country — we will scope population
  applicability downstream; tell us the cohort).

### Priority 3 — discriminators and derived values

- The **hereditary spherocytosis** laboratory-diagnosis literature, especially society guidelines
  (BSH is a promising publisher; we already hold their G6PD guideline but not an HS one) — we need the
  MCHC-based discriminator and its caveats.
- **Discriminant indices** for iron deficiency vs thalassemia trait (Mentzer `MCV/RBC` and relatives),
  prioritizing **pediatric validation studies** and any study reporting where they fail.
- **Corrected reticulocyte % / reticulocyte production index** sources carrying the age-appropriate
  **reference hematocrit** values and maturation-correction factors.
- The **"rule of three"** (`Hct ≈ 3 × Hgb`) — find its actual provenance and any authoritative
  statement on whether it is intended for clinical interpretation or only laboratory quality control.
  We are researching this to decide **against** using it; find the documents that settle it.

### Priority 4 — methodology and units

- Sources on **measured/spun vs analyzer-calculated (`MCV × RBC`) hematocrit** and whether reference
  intervals are method-specific.
- Reference-interval **establishment standards** (e.g. CLSI) — note access status; these are usually
  paywalled and that is fine to report.

---

## Required output columns

| # | column | rule |
|---|---|---|
| 1 | `source_id` | short kebab-case slug you assign |
| 2 | `title` | full document title |
| 3 | `publisher_or_body` | organization |
| 4 | `year` | publication year |
| 5 | `doi_or_url` | **required** — DOI preferred, else stable URL |
| 6 | `access_status` | `public-domain` \| `open-access` \| `free-to-read` \| `paywalled` \| `unknown` |
| 7 | `license` | named license if stated (CC-BY, US Gov work, …) or `unstated` |
| 8 | `carries_numbers` | yes / no / partial — does this document contain the actual pediatric values? |
| 9 | `analytes_covered` | hematocrit / MCHC / MCH / RBC / hemoglobin / MCV / RDW / retic |
| 10 | `age_range_covered` | as published |
| 11 | `population` | cohort: country, health status, sampling basis |
| 12 | `priority` | 1–4 per the sections above |
| 13 | `why_ranked_here` | one line — especially, why we can or cannot quote it |

**`free-to-read` is not `open-access`.** This distinction is load-bearing for us: a prior discovery run
found that "free to read" was the largest failure class among candidate substitutes — readable does not
mean reusable. When a document is readable but carries no reuse grant, say `free-to-read` and say so in
`why_ranked_here`.

## Scope

Population **6 months to <18 years** primarily; neonatal/young-infant sources are welcome but must be
marked in `population` (our module abstains below 6 months).

Out of scope: treatment, dosing, transfusion thresholds, diagnosis.

Output shape and where to save it: see `expected-output/README.md`. Your prose and this list import as
`platform_synthesis` candidates.
