# Gemini Deep Research — kidney_suite_v1 RECENCY + BREADTH prompt

> Paste everything below the line into Gemini Deep Research. Attach the four files named in
> `attachments.md` first. Your role for this run is **RECENCY + BREADTH** — surface the newest
> guidelines / supersessions and adjacent-domain / future-module signals. You are the wide net, not
> the deep extractor.

---

## Trust framing — read first (non-negotiable)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never
as verified clinical evidence. Only the Research Foundry verifier assigns verified status via
exact-passage binding.** You are flagging what is new and what is adjacent; a human verifies every
source. You are not authoring clinical rules.

Every source you surface MUST obey these rules:

1. **Return every source with a DOI or a stable URL, the publication year, and its license / access
   status** (open access / CC-BY / public domain / freely-distributed guideline / paywalled).
2. **Do NOT assert any numeric threshold without a citation.** If you note that a new guideline changed
   a cutoff, cite the guideline and give the version/edition; never state a number without its source.
3. **Explicitly FLAG paywalled / rights-restricted sources.** Do not paraphrase around a paywall.
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE passages.** For kidney, eGFR coefficients
   (CKiD U25, bedside Schwartz, cystatin-C) and KDIGO / AAP thresholds are largely in open-access
   primary literature and freely-distributed guidelines — favor recency finds that are also retrievable.
5. Treat the attached files as **context describing what we already hold**. Your value is what's
   NEWER, what SUPERSEDED something we hold, and what's ADJACENT — not re-listing what we already have.

---

## Task — three deliverables

### A. Recency / supersession sweep (primary)

For `kidney_suite_v1` (RF-KID-001, `evidenceReviewedThrough: 2026-07-22`), find the **newest**
guidelines, society statements, and reference-interval/equation papers that would change or extend the
module. Specifically check for a supersession of anything we hold:

- Any **KDIGO pediatric-specific CKD update** newer than KDIGO 2024, or a dedicated pediatric CKD
  guideline.
- Any **revised AAP pediatric BP** statement or new normative BP percentile tables newer than 2017.
- Any newer / externally-validated **CKiD U25 or cystatin-C eGFR** equation work (new coefficients,
  external validation, an IDMS/IFCC re-standardization).
- Newer **pediatric AKI** (KDIGO AKI / pRIFLE / pROCK) or **hematuria/proteinuria** guidance.

For each: title, authors, org/journal, year, DOI/stable URL, license/access, and **which held source it
supersedes or extends** (or "net-new, supersedes nothing we hold").

### B. Net-new angle breadth (secondary)

Cast wide across the module's net-new angles and surface the best recent, retrievable source per angle:
hematuria (glomerular vs non-glomerular), pediatric AKI staging (KDIGO/pRIFLE), CKD stage-transition
flags, pediatric hypertension percentile classification, electrolyte-derived flags where CBC/CMP overlap.
Note the numerics targets (CKiD U25 / Schwartz / cystatin-C coefficients; KDIGO 2024 GFR+albuminuria
categories; AAP 2017 BP tables; UPCR/UACR cut-offs in mg/mg and mg/mmol).

### C. Future-module / adjacent-domain scouting (the "asides")

While sweeping, flag **adjacent pediatric lab-interpretation domains** that could become future modules
— each as a ONE-LINE idea, not a research commitment. Candidates named in the run design: hepatic / LFT
panel, thyroid / TSH-FT4, electrolytes & acid-base, coagulation / PT-INR, inflammatory markers,
newborn-screen follow-up, lipid panel. Format each as:
`future-module: <domain> — <one-line clinical rationale> — <candidate anchor guideline>`.
These are idea captures only; they touch no rule and no module.

### Output shape

1. A **recency/supersession table**: | Title | Authors | Org/Journal | Year | DOI/URL | License/access | Supersedes/extends (which held source, or net-new) | Threshold density |
2. A **breadth table** (best recent retrievable source per net-new angle), same columns.
3. A bulleted **future-module asides** list (one line each, in the `future-module:` format above).
4. A short note on **what you could NOT find newer than what we hold** (a clean "no supersession" answer is a valuable result).

---

## Sources we ALREADY hold — find what's NEWER/ADJACENT, do NOT re-list these

RF-KID-001 bundle, `evidenceReviewedThrough: 2026-07-22`:

1. CKiD U25 GFR equations — Pierce CB et al., *Kidney Int* 99(4):948-956, 2021 — doi:10.1016/j.kint.2020.10.047
2. Race, SCr, cystatin C & GFR (CKiD) — Ng DK et al., *AJKD*, 2021 — doi:10.1053/j.ajkd.2021.10.013
3. AAP pediatric HTN guideline — Flynn JT et al., *Pediatrics* 140(3):e20171904, 2017 — doi:10.1542/peds.2017-1904
4. KDIGO 2024 CKD guideline — *Kidney Int* 105(4S), 2024 — doi:10.1016/j.kint.2023.10.018
5. Cystatin-C eGFR utility (peds) — Ibrahim RB et al., *J Appl Lab Med* 9(4):803-808, 2024 — doi:10.1093/jalm/jfae034
6. eGFR equations, peds transplant — Sukboonthong P et al., *Pediatr Nephrol*, 2025 — doi:10.1007/s00467-025-06942-8
7. Hematuria & proteinuria in children — Viteri B, Reid-Adam J, *Pediatr Rev* 39(12):573-587, 2018 — doi:10.1542/pir.2017-0300
8. Proteinuria in children — Leung AKC et al., *Am Fam Physician* 95(4):248-254, 2017 (no DOI)
9. Proteinuria & hematuria, ambulatory — Imam AA, Saadeh SA, *Pediatr Clin North Am* 69(6):1037-1049, 2022 — doi:10.1016/j.pcl.2022.07.002 (**paywalled**)
10. eGFR at normal/near-normal/discordant GFR — Schwaderer AL et al., *Pediatr Nephrol* 38(12):4051-4059, 2023 — doi:10.1007/s00467-023-06045-2
11. Spot P/C ratio diagnostic utility — Kaminska J et al., *Crit Rev Clin Lab Sci* 57(5):345-364, 2020 — doi:10.1080/10408363.2020.1723487 (**paywalled**)
12. Cystatin C vs creatinine eGFR, peds transplant — Pizzo H et al., *Pediatr Nephrol* 39(7):2177-2186, 2024 — doi:10.1007/s00467-024-06316-6

The newest source we currently hold is 2025 (Sukboonthong). Anything you find dated 2025–2026 that
changes an eGFR coefficient, a KDIGO/AAP threshold, or a staging definition is high-value.
