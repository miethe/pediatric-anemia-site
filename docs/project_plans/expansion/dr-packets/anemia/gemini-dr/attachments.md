# Attachments manifest — Gemini Deep Research / anemia RF-ANE-001 (recency + breadth)

Attach these **exact repo files** before pasting `prompt.md`. Paths are repo-relative. For a recency
pass the essential context is *what we currently encode and how old it is* — so you can tell us what
has moved since.

| # | Attach this file | Why |
|---|---|---|
| 1 | `modules/anemia/evidence.json` | The 6 held sources **with their years** — your recency baseline. |
| 2 | `modules/anemia/reference-ranges.json` | What we currently encode, and the `AAP2026_IDA` source it traces to. |
| 3 | `docs/project_plans/expansion/06-anemia-red-cell-indices-evidence-run.md` | Run design; **read §1.2** so your asides do not duplicate the six known gaps. |

If the UI cannot read JSON, the inlined excerpt below is sufficient.

---

## Recency baseline — what we hold and when

**Module:** `anemia` · status `integrity-recorded` · 91 rules · 26 candidates ·
`knowledgeBaseVersion: 0.1.0-2026-07-15` · `reviewedThrough: **2026-07-15**`.

| id | year | organization | what it grounds for us |
|---|---|---|---|
| `AAP2026_IDA` | 2026 | American Academy of Pediatrics | Our age/sex **hemoglobin lower limits, MCV bands and RDW upper bands**. **Paywalled**; its passages are quarantined as not independently retrievable. |
| `WHO2024_HB` | 2024 | World Health Organization | Haemoglobin cutoffs defining anaemia. **Your R1 baseline — what has moved since this?** |
| `BLOOD2022_PED_ANEMIA` | 2022 | American Society of Hematology | Pediatric anemia overview. |
| `CDC2025_LEAD` | 2025 | US CDC | Blood-lead action levels (public domain). |
| `FDA2026_CDS` | 2026 | US FDA | CDS Software guidance (regulatory). |
| `BSH2020_G6PD` | 2020 | British Society for Haematology | G6PD laboratory diagnosis. **Oldest clinical source we hold — flag if superseded.** |

**Anything published after 2026-07-15 is unreviewed by us.** That is your primary hunting window,
though earlier material that supersedes what we hold is equally wanted.

## What we do NOT hold (so you know what "new" would mean)

No hematocrit, MCHC, MCH, or RBC-count reference interval at **any** age. No hematocrit-based anaemia
definition. No discriminant index. The reticulocyte correction requiring an age-appropriate reference
hematocrit is marked **"not executed"** in our own code.

## Division of labor — do not duplicate the other packets

| Packet | Owns | You should NOT |
|---|---|---|
| **perplexity** | The ranked source hunt, license/access triage | Re-run a general source sweep |
| **chatgpt-dr** | The extraction tables — interval values, discriminator thresholds, the definition question | Re-extract interval tables |
| **gemini-dr (you)** | **What changed, what is contested, what to avoid encoding, and adjacent-domain asides** | — |

If your recency work surfaces a strong numeric source the others would want, **name it in `notes`**
rather than extracting it yourself.

## The two results we most want from you

1. **A current, cited answer on whether any body has moved toward hematocrit-based pediatric anaemia
   definitions.** If the answer is no, that is a complete and useful finding — it tells us the honest
   product answer to the user's feedback is "hematocrit is a valid *input* to seek, but hemoglobin
   remains the *definitional* analyte", and we can say that with a citation.
2. **A deprecation list (R4).** We are about to spend effort grounding red-cell indices; knowing which
   ones current sources say *not* to rely on in children saves that effort and prevents encoding a
   contested cutoff into a clinical tool.
