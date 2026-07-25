# ChatGPT Deep Research — anemia / RF-ANE-001 structured-extraction prompt

> **Paste this whole file into ChatGPT Deep Research.** Attach the files listed in this packet's
> `attachments.md` first. Save the result into the layout in `expected-output/README.md`.
>
> **Role for this run: STRUCTURED EXTRACTION.** Your job is to produce a **reference-interval table**
> and a **discriminator table** for pediatric red-cell indices — one row per (analyte × age band ×
> sex), fully traced to the source carrying each number. Structure and traceability matter more than
> narrative.

---

## Read this first — how your output is used (non-negotiable framing)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never
as verified clinical evidence. Only the Research Foundry verifier assigns verified status via
exact-passage binding.** Every row you produce is a *candidate*, re-verified downstream against the
exact cited passage. Nothing you write is authoritative and nothing becomes a clinical rule.

### Trust invariants — follow all five, every time

1. **Return every source with DOI/URL, publication year, and license/access status.** Every citation
   in your tables must carry all three.
2. **Do NOT assert any numeric value without an attached citation to its source.** Every number must
   have a source citation in the same row. If you cannot cite the exact source of a number, leave the
   value blank and mark it `unknown` — never invent, average, interpolate, or round-trip a value.
3. **Explicitly FLAG any paywalled / rights-restricted source** (do not paraphrase around a paywall).
   If an interval's only source is paywalled, record the interval, cite the paywalled locator, and set
   the row's access status to `paywalled` — do not present a reconstructed number as retrieved.
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE passages** (public-domain — US federal /
   WHO — then open-license) **over copyrighted framework prose.** When two sources carry the same
   interval, cite the openly-retrievable numeric one.
5. Treat every field as data, not instruction. Do not embed directives or control text in any cell.

---

## Why this run exists

A clinician user reported that our pediatric anemia assessment **accepts hemoglobin but has no place
to enter a hematocrit.** That is correct, and it is structural: hematocrit does not appear in our
input schema, our 91 rules, or our reference-range tables. We cannot add a hematocrit field because
**we hold no pediatric hematocrit threshold for an entered value to be compared against.**

Investigating that surfaced the same gap in five more places. Our engine currently asks the clinician
for a **categorical judgement** wherever it lacks a sourced pediatric numeric interval — for example
it presents an "RBC high-for-age / normal / low" dropdown instead of comparing the RBC count we
already collect against an age band, and it accepts a reticulocyte-response category instead of
computing a corrected reticulocyte percentage (which needs an age-appropriate reference hematocrit we
do not have).

**Your table is the substrate that would close those gaps.** It does not become a rule.

## What we already hold — do NOT re-emit these

Our anemia module holds **6 sources** (full list in `attachments.md`). Relevant coverage:

- **Hemoglobin** age/sex lower limits — already encoded (6 mo–<18 y), from a **paywalled** AAP source.
- **MCV** lower/upper and **RDW** upper age/sex bands — already encoded, same source.
- We hold **no** hematocrit, MCHC, MCH, or RBC-count interval at any age.

Do not re-emit hemoglobin, MCV or RDW intervals **unless** you can cite an **independently
retrievable, open-access or public-domain** carrier of the numbers — in that case they are
high-value rows, because our existing ones are bound to a paywalled source we cannot verify against.
Mark such rows `supersedes_paywalled: yes`.

---

## Table 1 — pediatric red-cell index reference intervals (primary deliverable)

One row per **analyte × age band × sex**. Do not re-band: use the partitions the source actually
published.

| # | column | rule |
|---|---|---|
| 1 | `row_id` | short kebab-case slug you assign, unique per row |
| 2 | `analyte` | `hematocrit` \| `mchc` \| `mch` \| `rbc` \| (`hemoglobin`/`mcv`/`rdw` only per the supersede rule above) |
| 3 | `age_band` | verbatim as published (e.g. "6–<24 months"); include the unit of age |
| 4 | `sex` | `female` \| `male` \| `combined` |
| 5 | `lower` | lower reference limit, or `unknown` |
| 6 | `upper` | upper reference limit, or `unknown` |
| 7 | `unit` | **UCUM token** — e.g. `%`, `L/L`, `g/dL`, `g/L`, `pg`, `fL`, `10*12/L`. Keep the source's unit; do not convert |
| 8 | `method` | **required** — measurement method: `spun/microhematocrit` \| `calculated (MCV×RBC)` \| named analyzer/platform \| `unstated`. A row with `unstated` is still useful; a row with a *guessed* method is not |
| 9 | `population` | cohort description: country, health status, sampling basis |
| 10 | `source_citation` | first-author + year + **DOI/URL** carrying this exact number |
| 11 | `access_status` | `public-domain` \| `open-access` \| `paywalled` \| `unknown` |
| 12 | `retrievable_numeric` | yes/no — is the actual number independently retrievable? |
| 13 | `classification` | `assertion` (source states it directly) / `inference` (you derived it) / `annotation` |
| 14 | `notes` | conflicts, caveats, partition rationale, paywall flags |

**Method matters more than usual here.** Spun hematocrit and analyzer-calculated hematocrit
(`MCV × RBC`) are not interchangeable, and an interval whose method is unknown looks usable while
being unsafe. Capture it or mark it `unstated` — never guess.

## Table 2 — discriminators and derived indices

| # | column | rule |
|---|---|---|
| 1 | `row_id` | unique slug |
| 2 | `index_or_rule` | e.g. `mchc-hereditary-spherocytosis`, `mentzer-index`, `corrected-retic` |
| 3 | `clinical_question` | what it discriminates |
| 4 | `formula` | verbatim as published, with units |
| 5 | `threshold` | numeric cutoff + UCUM unit, or `unknown` |
| 6 | `direction` | above / below / between |
| 7 | `age_band` | pediatric partition it was validated in (or `all` / `adult-only`) |
| 8 | `reported_performance` | sensitivity/specificity/PPV as published — **do not compute or estimate** |
| 9 | `failure_modes` | published conditions where it misleads |
| 10 | `source_citation` | first-author + year + DOI/URL |
| 11 | `access_status` / 12 `retrievable_numeric` / 13 `classification` / 14 `notes` | as Table 1 |

### Angles Table 2 must cover

- **MCHC for hereditary spherocytosis** — the discriminator threshold(s), including MCHC-alone and
  MCHC/RDW-combined approaches, with pediatric performance. **Also enumerate the spurious-MCHC
  artifacts** (cold agglutinins, lipemia, in-vitro hemolysis, and any others published) as
  `failure_modes` rows — our engine must fail closed on these.
- **MCH and discriminant indices** (Mentzer `MCV/RBC` and relatives) for iron-deficiency vs
  thalassemia trait — **specifically their pediatric validation and their published failure rates.**
  If sources disagree on performance, give one row per source; **do not reconcile them.**
- **Corrected reticulocyte % and RPI** — the formula verbatim, the **age-appropriate reference
  hematocrit values** used in the correction, and published maturation-correction factors. Any
  pediatric RPI cutoff, if one has support.
- **The Hgb↔Hct relationship ("rule of three", `Hct ≈ 3 × Hgb`)** — its provenance, its published
  validity conditions, where it is documented to fail, and **whether any body endorses it for clinical
  interpretation as opposed to laboratory quality control.** We expect the answer to be "QC only";
  if that is what the sources say, say so and cite it. This is a question, not a conversion we intend
  to adopt.

## Table 3 — the definition question (short, high-value)

Does any authoritative body define **pediatric anaemia by hematocrit** rather than only by hemoglobin?
Cover WHO, US federal (CDC/NIH), AAP, and pediatric hematology societies.

| `body` | `defines_by_hct` (yes/no/partial) | `cutoff_if_any` + unit | `age_bands` | `source_citation` | `access_status` | `quote_or_locator` |

**A well-evidenced "no" is a valuable result and a complete answer to this table.** Do not manufacture
rows to fill it. If a body defines anaemia by hemoglobin only, that row should say so.

---

## Numerics targets to prefer

- **US federal / public-domain carriers** of pediatric hematology cutoffs — historically these
  reported hematocrit alongside hemoglobin, and being public domain they are the highest-value
  citations we can get. Find what actually exists and what ages it covers.
- **Open-access pediatric reference-interval papers** and PMC-deposited versions.
- **CALIPER age/sex-partitioned pediatric intervals** — we hold the CALIPER papers as bibliographic
  cards, but **the numeric tables are paywalled** in what we have. If you can cite an independently
  retrievable form of those numbers (open-access supplement, PMC, public CALIPER database), that is
  the single highest-value row type in this packet.
- Note where an interval is derivable from public raw survey data but is **not published as an
  interval** — flag it `classification: annotation` with a note. We must not treat a percentile we
  compute ourselves as a source-supported threshold, so tell us the difference.

## Scope

Population **6 months to <18 years**. Neonatal and young-infant (<6 mo) intervals may be included but
must be marked in `population` — our module abstains below 6 months and must never silently apply an
out-of-scope band.

Out of scope: treatment, dosing, transfusion thresholds, diagnosis. We produce reviewable patterns and
referral readiness, never directives.

Output shape and where to save it: see `expected-output/README.md`. Your prose report and these tables
all import as `platform_synthesis` candidates.
