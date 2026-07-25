# Attachments manifest — Perplexity Deep Research / anemia RF-ANE-001 (source-gathering)

Attach or reference these **exact repo files** before pasting `prompt.md`. Paths are repo-relative.
For a source-gathering pass the essential attachment is the held-source list (so you do not re-surface
what we have) plus the range table (so you can see which numbers are missing).

| # | Attach this file | Why |
|---|---|---|
| 1 | `modules/anemia/evidence.json` | The 6 sources we already hold — the "do not re-surface" boundary. |
| 2 | `modules/anemia/reference-ranges.json` | The gap made concrete: only `hbLower`/`mcvLower`/`mcvUpper`/`rdwUpper` exist, at any age. |
| 3 | `docs/project_plans/expansion/06-anemia-red-cell-indices-evidence-run.md` | Run design; **read §7** for the license ranking your `priority` column must follow. |

If the UI cannot read JSON, the inlined excerpt below is sufficient.

---

## Already have — do NOT re-surface (6 sources in `modules/anemia/evidence.json`)

**Module:** `anemia` · status `integrity-recorded` · 91 rules · 26 candidates ·
`reviewedThrough: 2026-07-15` · extends bundle **RF-EV-001**.

| id | year | organization | access reality |
|---|---|---|---|
| `AAP2026_IDA` | 2026 | American Academy of Pediatrics | **Paywalled.** All 7 of its passages are quarantined `source-not-independently-retrievable`. Our Hgb/MCV/RDW bands trace here — this is precisely the dependency we are trying to reduce. |
| `WHO2024_HB` | 2024 | World Health Organization | Haemoglobin cutoffs to define anaemia. Hemoglobin-centric. |
| `BLOOD2022_PED_ANEMIA` | 2022 | American Society of Hematology | Anemia in the pediatric patient. |
| `CDC2025_LEAD` | 2025 | US CDC | Blood-lead action levels (public domain). |
| `FDA2026_CDS` | 2026 | US FDA | CDS Software guidance (regulatory, not clinical). |
| `BSH2020_G6PD` | 2020 | British Society for Haematology | G6PD laboratory diagnosis. |

You may **cite** these when one carries something we have not encoded, but do not spend the run
re-finding them.

## What is missing from our knowledge base entirely

No hematocrit, MCHC, MCH, or RBC-count reference interval exists at **any** age. There is no
hematocrit-based anaemia definition. There is no discriminant index of any kind. The reticulocyte
correction that needs an age-appropriate reference hematocrit is documented in our own code as
**"not executed"**.

## The two access facts that shape your ranking

1. **Our numbers problem is a rights problem, not only a coverage problem.** Of the passages we can
   bind today, all are numerics-light paraphrases — the threshold-bearing passages were quarantined
   during rights-avoidance paraphrasing. So a source we can quote verbatim is worth more to us than a
   more prestigious source we can only summarize.
2. **"Free to read" ≠ licensed.** A prior discovery run over 69 candidate substitutes found
   free-to-read was the **largest failure class**, and that buying paywalled access would not create a
   reuse grant. Please separate `free-to-read` from `open-access` in your `access_status` column and
   explain the basis in `why_ranked_here`.

## Highest-value single find

An **independently retrievable, public-domain or open-access** document carrying **age- and
sex-partitioned pediatric hematocrit reference intervals with the measurement method stated**. That is
the artifact the reported user gap ultimately blocks on. If you find only one thing, find that.
