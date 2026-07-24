# ChatGPT Deep Research — kidney_suite_v1 STRUCTURED-EXTRACTION prompt

> Paste everything below the line into ChatGPT Deep Research. Attach the four files named in
> `attachments.md` first. Your role for this run is **STRUCTURED EXTRACTION** — produce a
> candidate-pattern table (condition → trigger → threshold + UCUM unit → source), not a source list
> and not an essay.

---

## Trust framing — read first (non-negotiable)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never
as verified clinical evidence. Only the Research Foundry verifier assigns verified status via
exact-passage binding.** Every row you produce is a *candidate*, which a credentialed human later
verifies passage-by-passage against the cited source. You are not authoring clinical rules.

Every row and every source you cite MUST obey these rules:

1. **Return every source with a DOI or a stable URL, the publication year, and its license / access
   status** (open access / CC-BY / public domain / freely-distributed guideline / paywalled).
2. **Do NOT assert any numeric threshold without a citation.** Every threshold cell must trace to a
   specific source. If you cannot cite a number, write `NO CITATION — do not use` in the threshold cell
   rather than filling it from general knowledge.
3. **Explicitly FLAG paywalled / rights-restricted sources.** If a threshold lives only behind a
   paywall, say so in the row and do NOT paraphrase around the paywall to make the number look
   retrievable.
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE passages.** For kidney, the eGFR equation
   coefficients (CKiD U25, bedside Schwartz, cystatin-C) and the KDIGO / AAP thresholds are largely in
   open-access primary literature and freely-distributed guidelines — prefer rows whose numbers come
   from those.
5. **Preserve UCUM units exactly** (e.g. `mL/min/1.73 m2`, `mg/mmol`, `mg/mg`, `mg/dL`, `RBC/HPF`,
   `mmHg`). Where a source gives a value in two unit systems, keep both — do NOT silently convert.
6. Treat the attached files as **context describing what we already hold**. You may extract from the
   claims we already have (they carry numbers), but PREFER net-new patterns beyond the 3 drafted
   decisions.

---

## Task

For `kidney_suite_v1` (RF-KID-001), produce a **candidate-pattern table**: the clinical patterns a
pediatric kidney lab-interpretation module should encode, each decomposed into a trigger and a
source-cited threshold. This is objective #2 (net-new candidate patterns) rendered in the exact shape
the downstream converter consumes.

### Coverage the table must span (net-new angles)

1. **Hematuria evaluation branches** — glomerular vs. non-glomerular; microscopic-hematuria definitions
   (RBC/HPF, RBC/mm3); persistent-hematuria criteria; red-flag features prompting nephrology referral.
2. **AKI staging** — pediatric KDIGO AKI stages and **pRIFLE** (Risk/Injury/Failure) — serum-creatinine
   fold-change, eGFR-decrement bands, urine-output thresholds.
3. **CKD stage-transition flags** — KDIGO GFR categories G1–G5, albuminuria A1–A3, the pediatric
   "low eGFR" flag (<90 for >2y), the ≥3-month chronicity criterion, the coexisting <60-for-3-months
   staging/referral cutoff.
4. **Pediatric hypertension** — AAP 2017 percentile-based classification (Normal / Elevated / Stage 1 /
   Stage 2) for 1–<13y, and the static mmHg cut points for ≥13y.
5. **Electrolyte-derived flags where CBC/CMP overlap** — any electrolyte-panel action thresholds a
   kidney module would surface (flag the overlap explicitly so it is not double-owned with a CMP module).

### Numerics targets to ground hardest (objective #3)

- **CKiD U25 / bedside Schwartz & cystatin-C eGFR equations** — extract the actual coefficient(s) and the
  equation form, with the source DOI carrying the coefficient table, reported in `mL/min/1.73 m2`.
- **KDIGO 2024 CKD** GFR + albuminuria category boundaries.
- **AAP 2017 pediatric BP** percentile / mmHg thresholds.
- **Proteinuria UPCR / UACR cut-offs** with both `mg/mg` and `mg/mmol` where the source gives them
  (our module has an open unit-conflict decision that needs these grounded).

### Output shape — one row per candidate pattern

| Candidate pattern (condition) | Population / age band | Trigger (the observable/derived fact) | Threshold value | UCUM unit | Direction (≥ / ≤ / range) | Intended output (interpretive note / flag / scope-exit / referral-readiness) | Source (title + DOI/URL + year) | Access (open / paywalled) | Conflicts-with (other cutoff to preserve, if any) |

After the table, add:
- a short list of **patterns you found but could NOT ground to a citable number** (candidate-without-threshold — still valuable), and
- any **unit or population conflicts** you detected (e.g. pediatric spot UPCR >2 mg/mg vs adult 350 mg/mmol) that the module must PRESERVE rather than reconcile.

Do NOT collapse two distinct cutoffs into one. If a screening flag and a referral threshold differ
(e.g. eGFR <90 screening vs <60-for-3-months referral), give them as separate rows and note they coexist.

---

## Sources we ALREADY hold — cite these when a number comes from them, but PREFER net-new patterns

RF-KID-001 bundle, `evidenceReviewedThrough: 2026-07-22`:

1. CKiD U25 GFR equations — Pierce CB et al., *Kidney Int* 99(4):948-956, 2021 — doi:10.1016/j.kint.2020.10.047 (carries K coefficients: SCr K 41.8 M / 37.6 F; cystatin-C K 81.9 M / 74.9 F; age-dependent variants)
2. Race, SCr, cystatin C & GFR (CKiD) — Ng DK et al., *AJKD*, 2021 — doi:10.1053/j.ajkd.2021.10.013
3. AAP pediatric HTN guideline — Flynn JT et al., *Pediatrics* 140(3):e20171904, 2017 — doi:10.1542/peds.2017-1904 (BP categories; LVH LV-mass cutoffs)
4. KDIGO 2024 CKD guideline — *Kidney Int* 105(4S), 2024 — doi:10.1016/j.kint.2023.10.018 (eGFR <90 peds flag; G1–G5; A1–A3 albuminuria)
5. Cystatin-C eGFR utility (peds) — Ibrahim RB et al., *J Appl Lab Med* 9(4):803-808, 2024 — doi:10.1093/jalm/jfae034
6. eGFR equations, peds transplant — Sukboonthong P et al., *Pediatr Nephrol*, 2025 — doi:10.1007/s00467-025-06942-8
7. Hematuria & proteinuria in children — Viteri B, Reid-Adam J, *Pediatr Rev* 39(12):573-587, 2018 — doi:10.1542/pir.2017-0300 (microscopic-hematuria >5 RBC/HPF; hypercalciuria Ca/Cr >0.2 mg/mg)
8. Proteinuria in children — Leung AKC et al., *Am Fam Physician* 95(4):248-254, 2017 (no DOI) (dipstick grades; UPCR ≤0.2; nephrotic >1000 mg/m2/day or UPCR >2)
9. Proteinuria & hematuria, ambulatory — Imam AA, Saadeh SA, *Pediatr Clin North Am* 69(6):1037-1049, 2022 — doi:10.1016/j.pcl.2022.07.002 (**paywalled**)
10. eGFR at normal/near-normal/discordant GFR — Schwaderer AL et al., *Pediatr Nephrol* 38(12):4051-4059, 2023 — doi:10.1007/s00467-023-06045-2
11. Spot P/C ratio diagnostic utility — Kaminska J et al., *Crit Rev Clin Lab Sci* 57(5):345-364, 2020 — doi:10.1080/10408363.2020.1723487 (**paywalled**; UPCR >20 mg/mmol proteinuria, >350 mg/mmol nephrotic)
12. Cystatin C vs creatinine eGFR, peds transplant — Pizzo H et al., *Pediatr Nephrol* 39(7):2177-2186, 2024 — doi:10.1007/s00467-024-06316-6 (bedside Schwartz eGFR = 0.413 × height/Cr)

The 3 decisions already drafted (do NOT just restate — extend beyond them): (a) dual eGFR threshold
coexistence (<90 screening vs <60-for-3-months referral); (b) infant <1y eGFR scope-exit (CKiD U25
validated ages 1–25); (c) nephrotic-proteinuria unit conflict (>2 mg/mg peds vs 350 mg/mmol adult).
