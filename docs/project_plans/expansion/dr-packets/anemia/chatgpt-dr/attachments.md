# Attachments manifest — ChatGPT Deep Research / anemia RF-ANE-001 (structured extraction)

Attach these **exact repo files** to the ChatGPT Deep Research session before pasting `prompt.md`.
Paths are repo-relative (from the repository root). `evidence.json` is our held source set;
`reference-ranges.json` is the concrete shape of the gap; `patient-input.schema.json` shows exactly
what the engine can and cannot receive today.

| # | Attach this file | Why |
|---|---|---|
| 1 | `modules/anemia/reference-ranges.json` | **The gap, made concrete.** Bands carry `hbLower`/`mcvLower`/`mcvUpper`/`rdwUpper` only — no hematocrit, MCHC, MCH or RBC interval at any age. Your Table 1 fills these columns. |
| 2 | `modules/anemia/evidence.json` | The 6 held sources — the "already covered" boundary and the paywall problem. |
| 3 | `schemas/patient-input.schema.json` | What the engine accepts. Note `cbc` is `additionalProperties: false` and has no `hematocrit`; note `rbc` **is** collected but has no reference band. |
| 4 | `modules/anemia/candidates.json` | The 26 reviewable patterns, incl. `hereditary-spherocytosis` — the pattern your MCHC discriminator rows serve. |
| 5 | `docs/project_plans/expansion/06-anemia-red-cell-indices-evidence-run.md` | Run design; **read §1.2 (the six gaps) and §4 (angles)** for what your rows must ground. |

If the UI cannot read JSON, the inlined excerpts below are enough to keep your tables net-new.

---

## Current coverage / already-have sources (inlined excerpt)

**Module:** `anemia` · status `integrity-recorded` · **91 rules · 26 candidates** ·
`knowledgeBaseVersion: 0.1.0-2026-07-15` · `reviewedThrough: 2026-07-15` · extends bundle **RF-EV-001**.

### The 6 sources already held

| id | year | organization | note |
|---|---|---|---|
| `AAP2026_IDA` | 2026 | American Academy of Pediatrics | Iron-deficiency anemia prevention/screening/diagnosis/treatment. **Paywalled — all 7 of its passages are quarantined `source-not-independently-retrievable`.** Our hemoglobin, MCV and RDW bands trace here. |
| `WHO2024_HB` | 2024 | World Health Organization | Haemoglobin cutoffs to define anaemia. Hemoglobin-centric — **your Table 3 should establish whether it addresses hematocrit at all.** |
| `BLOOD2022_PED_ANEMIA` | 2022 | American Society of Hematology | Anemia in the pediatric patient. |
| `CDC2025_LEAD` | 2025 | US CDC | Blood-lead action levels (public domain). |
| `FDA2026_CDS` | 2026 | US FDA | Clinical Decision Support Software guidance (regulatory, not clinical). |
| `BSH2020_G6PD` | 2020 | British Society for Haematology | G6PD laboratory diagnosis. **BSH is a promising publisher for the hereditary-spherocytosis guideline your MCHC rows need** — we do not hold it. |

### What is already encoded — do not re-emit unless openly retrievable

Age/sex bands (6–<24 mo, 2–<6 y, 6–<12 y, and older) currently carry **only**:
`hbLower` (g/dL) · `mcvLower` / `mcvUpper` (fL) · `rdwUpper` (%).

**Nothing else.** There is no `hctLower`/`hctUpper`, no `mchc*`, no `mch*`, and no `rbcLower`/`rbcUpper`
at any age. Per `prompt.md`, hemoglobin/MCV/RDW rows are worth emitting **only** when you can cite an
independently retrievable open-access or public-domain carrier of the numbers — mark those
`supersedes_paywalled: yes`, because our current bands rest on a source we cannot verify against.

### The specific engine consequences your rows unblock

| Our current behaviour | Why | Your rows that fix it |
|---|---|---|
| No hematocrit input at all; hemoglobin is a **required** field, so a crit-first report cannot be assessed | No pediatric Hct threshold exists in the KB | Table 1 `hematocrit` rows + Table 3 |
| MCHC never computed | Needs a hematocrit denominator | Table 1 `hematocrit` + `mchc` rows; Table 2 HS discriminator |
| RBC count collected numerically, but the engine asks the clinician for a **"high-for-age / normal / low" dropdown** instead of comparing it | No age/sex RBC band in the KB | Table 1 `rbc` rows |
| Reticulocyte response taken as a **clinician category**; corrected retic % and RPI explicitly *not executed* | Needs an age-appropriate reference hematocrit + maturation factors | Table 2 corrected-retic rows |
| No MCH; no discriminant index of any kind | Never encoded | Table 1 `mch` rows; Table 2 index rows |

**Highest-value single result in this packet:** an independently retrievable, public-domain or
open-access carrier of **age- and sex-partitioned pediatric hematocrit intervals with their
measurement method stated**. That one row type is what the user's feedback ultimately blocks on.
