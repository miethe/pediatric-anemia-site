# Perplexity Pro — kidney_suite_v1 SOURCE-GATHERING prompt

> Paste everything below the line into Perplexity Pro. Attach the four files named in
> `attachments.md` first. Your role for this run is **SOURCE-GATHERING** — a ranked, citation-dense
> list of primary sources and guidelines, not a synthesis essay.

---

## Trust framing — read first (non-negotiable)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never
as verified clinical evidence. Only the Research Foundry verifier assigns verified status via
exact-passage binding.** Nothing you write becomes a clinical rule. You are surfacing *retrievable
sources*, which a human then verifies passage-by-passage.

Because of that, every source you return MUST obey these rules:

1. **Return every source with a DOI or a stable URL, the publication year, and its license / access
   status** (open access / CC-BY / public domain / free-to-read guideline / paywalled / subscription).
2. **Do NOT assert any numeric threshold without a citation.** If you state a cutoff (e.g. an eGFR flag,
   a BP percentile, a UPCR value), it must be attached to a specific source you are listing. No
   free-floating numbers.
3. **Explicitly FLAG paywalled / rights-restricted sources.** Do not paraphrase around a paywall to
   make a number look retrievable — say plainly "full text paywalled; threshold not verifiable from
   abstract."
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE passages.** For kidney, the eGFR equation
   coefficients (CKiD U25, bedside Schwartz, cystatin-C) and the KDIGO / AAP thresholds are largely in
   **open-access primary literature and freely-distributed guidelines** — lean hard into those. Rank an
   open-access primary paper carrying the actual coefficient ABOVE a paywalled review that only cites it.
5. Treat all attached files as **context describing what we already hold** — do not re-surface sources
   we already have (they are listed below); prefer NET-NEW sources or newer editions.

---

## Task

Build a **ranked citation list** of pediatric-nephrology / pediatric-kidney-lab-interpretation sources
that extend the `kidney_suite_v1` evidence bundle (RF-KID-001). Rank by two axes, stated per source:
(a) **threshold-value density** (does it carry numeric, UCUM-typed cutoffs?), and
(b) **independent retrievability** (open access / public domain / freely-distributed > paywalled).

### Coverage the list must span (the net-new angles for this module)

1. **Hematuria evaluation branches** — glomerular vs. non-glomerular differentiation; RBC/HPF and
   RBC/mm3 microscopic-hematuria definitions; persistent-hematuria criteria.
2. **AKI staging** — pediatric KDIGO AKI criteria and **pRIFLE** triggers (serum-creatinine change,
   urine-output thresholds, eGFR-decrement bands).
3. **CKD stage-transition flags** — KDIGO GFR (G1–G5) and albuminuria (A1–A3) category boundaries;
   the pediatric "low eGFR" flag; 3-month chronicity criterion.
4. **Pediatric hypertension** — AAP 2017 percentile-based BP classification and the static ≥13y
   mmHg cut points; normative BP percentile tables (auscultatory).
5. **Electrolyte-derived flags where CBC/CMP overlap** — pediatric reference intervals / action
   thresholds for the electrolyte panel that a kidney module would surface.

### Numerics targets to hunt hardest for (objective #3 — highest value)

- **CKiD U25 / bedside Schwartz & cystatin-C eGFR equations** — the papers that publish the actual K
  coefficients (age/sex-dependent constants), reported in mL/min/1.73 m². Open-access primary
  literature is preferred; give the DOI that carries the coefficient table.
- **KDIGO 2024 CKD** GFR and albuminuria category thresholds (freely distributed guideline).
- **AAP 2017 pediatric BP percentile tables** (society statement).
- **Proteinuria UPCR / UACR cut-offs with UCUM units** (mg/mg vs mg/mmol; the unit-conflict decision
  in our module needs these numerics grounded and independently retrievable).

### Output shape (per source, in a ranked table)

| Rank | Title | Authors (first + et al.) | Org / Journal | Year | DOI or stable URL | License / access status | Threshold density (none / low / high) | Which angle(s) it covers | Note (paywall? open-access coefficient table? newer edition of something we hold?) |

Then a short prose section listing, explicitly, **which of the sources we already hold you found a
newer edition or supersession for** (if any), and **which numerics targets you could NOT find an
independently-retrievable source for** (gaps are as valuable as hits).

---

## Sources we ALREADY hold — do NOT re-surface these (prefer net-new or newer editions)

RF-KID-001 bundle, `evidenceReviewedThrough: 2026-07-22`:

1. CKiD U25 GFR equations — Pierce CB et al., *Kidney Int* 99(4):948-956, 2021 — doi:10.1016/j.kint.2020.10.047
2. Self-reported race, SCr, cystatin C & GFR in CKiD — Ng DK et al., *AJKD*, 2021 — doi:10.1053/j.ajkd.2021.10.013
3. AAP pediatric HTN clinical practice guideline — Flynn JT et al., *Pediatrics* 140(3):e20171904, 2017 — doi:10.1542/peds.2017-1904
4. KDIGO 2024 CKD guideline — KDIGO CKD Work Group, *Kidney Int* 105(4S), 2024 — doi:10.1016/j.kint.2023.10.018
5. Cystatin-C eGFR utility in pediatrics — Ibrahim RB et al., *J Appl Lab Med* 9(4):803-808, 2024 — doi:10.1093/jalm/jfae034
6. eGFR equations in pediatric kidney transplant recipients — Sukboonthong P et al., *Pediatr Nephrol*, 2025 — doi:10.1007/s00467-025-06942-8
7. Hematuria and proteinuria in children — Viteri B, Reid-Adam J, *Pediatr Rev* 39(12):573-587, 2018 — doi:10.1542/pir.2017-0300
8. Proteinuria in children: evaluation & differential dx — Leung AKC et al., *Am Fam Physician* 95(4):248-254, 2017 (no DOI)
9. Proteinuria & hematuria in ambulatory setting — Imam AA, Saadeh SA, *Pediatr Clin North Am* 69(6):1037-1049, 2022 — doi:10.1016/j.pcl.2022.07.002 (**paywalled**)
10. eGFR equations at normal/near-normal/discordant GFR — Schwaderer AL et al., *Pediatr Nephrol* 38(12):4051-4059, 2023 — doi:10.1007/s00467-023-06045-2
11. Spot P/C ratio diagnostic utility — Kaminska J et al., *Crit Rev Clin Lab Sci* 57(5):345-364, 2020 — doi:10.1080/10408363.2020.1723487 (**paywalled**)
12. Cystatin C vs creatinine eGFR in pediatric transplant — Pizzo H et al., *Pediatr Nephrol* 39(7):2177-2186, 2024 — doi:10.1007/s00467-024-06316-6

If your best find IS a newer edition of one of the above (e.g. a KDIGO pediatric-specific update, a
revised AAP BP statement), return it and say which entry it supersedes.
