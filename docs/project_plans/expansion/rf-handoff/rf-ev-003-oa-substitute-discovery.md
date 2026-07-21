---
title: "RF-EV-003 — Open-access rights-clear substitute discovery for AAP2026_IDA"
description: "Discovery synthesis for whether the 7 clinical claim areas anchored to the paywalled AAP 2026 IDA clinical report can be re-anchored to open-access, rights-clear sources. 69 candidates across 6 source-family legs, 56 adversarially verified, 20 surviving verdicts resolving to 17 distinct rights-clear documents. Headline: paywalled != licensed; buying AAP access does not solve the grounding gap."
status: complete
created: 2026-07-21
updated: 2026-07-21
owner: Nick Miethe
project: pediatric-cds-platform
rf_run_id: rf_run_20260721_rf_ev_003_pediatric_cds_identify
doc_type: research_synthesis
honesty_boundary: "SYNTHETIC RESEARCH OUTPUT. Not clinical validation, not credentialed clinical review, confers no release authority. It may identify candidate sources and DE-CLAIM existing ones; it may never authorise a threshold change. Every re-anchoring below requires clinical approver sign-off."
---

# RF-EV-003 — Discovery Synthesis: Can the 7 AAP-2026-anchored claim areas be re-anchored to open-access, rights-clear sources?

**Scope:** 69 candidates discovered across 6 source legs (WHO/PAHO, NICE/UK, national societies, OA journals, PMC/NIH, government public health). 56 adversarially verified; 20 verdicts returned `usable_as_substitute: true`, resolving to **17 distinct rights-clear documents**.

**Project constraint that decides almost everything here:** this codebase has a declared commercial track. Every `NonCommercial` licence is therefore a **hard block, not a caveat**, and every `ShareAlike` term additionally threatens copyleft propagation into `modules/<id>/*.json`.

---

## 1. Bottom line

| Target | Verdict | One-line reason |
|---|---|---|
| **T1** — CBC + ferritin as core diagnostic pair | **RE-ANCHORABLE** *(with authority downgrade)* | Public-domain CDC MMWR 1998 and CC BY sources state the pairing, but **none as a current guideline-grade pediatric recommendation**; CDC frames it as a *sequential* Hb-first / ferritin-second-line pathway, not a core pair. |
| **T2** — age/sex Hb, MCV, RDW reference intervals, 6 mo–<18 y, with numeric limits | **READABLE-BUT-NOT-CLEARED** | The one source that actually covers all three analytes across the full span with age *and* sex partitioning — CALIPER (AJCP 2020) — is **"All rights reserved."** The next-best (AJCP 2019 NHANES piecewise) is **CC BY-NC**. Rights-clear coverage is Hb-only and fragmentary. **No rights-clear age/sex-stratified RDW interval exists anywhere in 69 candidates.** |
| **T3** — serum ferritin cutoffs, children and adolescents/menstruating | **RE-ANCHORABLE** *(children); gap at menstruating adolescents* | Three independent CC BY 4.0 sources plus a public-domain federal source carry verified numerics for children. **No rights-clear menstruating-adolescent-specific threshold exists.** |
| **T4** — ferritin under inflammation, CRP co-measurement | **RE-ANCHORABLE** *(population scope only — scope mismatch is severe)* | BRINDA (CC BY 3.0) supplies CRP >5 mg/L / AGP >1 g/L and the raised <30 µg/L option, but it is an **explicitly population-prevalence method, not validated as an individual-patient adjustment.** The individual-patient rule exists only in WHO 2020 (CC BY-NC-SA). |
| **T5** — sTfR / log₁₀(ferritin) index interpretation | **NO SUBSTITUTE FOUND** | Structural, not bibliographic. WHO *deliberately declines* to publish a cutoff ("Apply cut-off values recommended by manufacturer of assay until an international reference standard is available"). BSH recommends **against** the assay entirely (2C). The only directly-matching paediatric paper (CCLM 2025) is closed with no licence located. sTfR immunoassays are not harmonised — any cutoff is assay-bound and non-portable. |
| **T6** — microcytic differentiation: ID vs thalassaemia trait vs anaemia of inflammation | **NO SUBSTITUTE FOUND** *(for the three-way claim as framed)* | The ID-vs-thalassaemia half is public domain (CDC 1998 RDW rule) but carries CDC's own instrument-specificity footnote **and is directly contradicted by two guideline bodies**. The anaemia-of-inflammation arm is not covered by any rights-clear source, at any age, in any leg. |
| **T7** — severity stratification of IDA by Hb | **READABLE-BUT-NOT-CLEARED** | Exactly one authoritative source exists — WHO 2024 Table 3 — and it is **CC BY-NC-SA 3.0 IGO (NC *and* SA)**. CDC MMWR 1998 contains **no severity table at all**. The society values found (IAP Hb 9 g/dL split; RCH <80/<60 g/L; CPS <80 g/L surveillance definition) are non-cleared *and mutually inconsistent*. |

**Blunt summary: 3 of 7 targets are cleanly re-anchorable (T1 degraded, T3, T4 mis-scoped), 2 are locked behind licences that exist but forbid our use (T2, T7), and 2 have no substitute at all (T5, T6).**

---

## 2. Coverage matrix

Rights-clear (verified) sources only. `●` = covers with verified numerics · `◐` = partial / caveated · `○` = qualitative only · blank = does not cover.

| Source (licence) | T1 | T2 | T3 | T4 | T5 | T6 | T7 |
|---|---|---|---|---|---|---|---|
| **CDC MMWR 1998;47(RR-3)** *(US public domain)* | ◐ | ◐ Hb+MCV, RDW single all-ages | ● ≤15 µg/L >6 mo | ○ | | ◐ 2-way only | |
| **Addo/Braat, Lancet Haematol 2024** (CC BY 4.0) | | ◐ **Hb only**, 6 mo–17 y, sex-split 12–17 y | | | | | |
| **Mei et al., J Nutr 2023** (CC BY 4.0) | | | ● 12–59 mo | ◐ CRP exclusion only | | | |
| **Hoq et al., Sci Rep 2020** (CC BY 4.0) | | | ● 2–18 y, age+sex | | | | |
| **Bijelić, JAMA Netw Open 2026** (CC BY) | | | ◐ 2 wk–<11 y **reference intervals ≠ cutoffs** | | | | |
| **BRINDA, AJCN 2017** (CC BY 3.0) | | | ◐ | ● **population scope** | | | |
| **Parkin/TARGet Kids, BMC Pediatr 2021** (CC BY 4.0) | | ◐ Hb+MCV, 2 wk–36 mo, **no RDW** | | | | | |
| **NCHS Data Brief 519** *(public domain)* | | ◐ Hb, 2–14 y+ — **restates WHO 2024** | | | | | |
| **Turgeon O'Brien, Anemia 2016** (CC BY, unversioned) | | | ◐ | ◐ per-patient variant | ◐ sTfR-FI >1.5, assay-bound | | |
| **sTfR/Roche Cobas, IJLH 2021** (CC BY 4.0) | | | | | ◐ RIs birth–12 mo, **no index** | | |
| **AlQarni, Front Med 2024** (CC BY) | | | | | | ◐ Mentzer, **poor performance** | |
| **Mahmood, Front Big Data 2025** (CC BY 4.0) | | | | | | ◐ adult, secondary restatements | |
| **NHS SCT Screening handbook** (OGL v3.0) | | | | | | ◐ **adult antenatal only** | |
| **NHLBI IDA topic page** *(public domain)* | ○ adult | | | | | | |
| **Leone, Hematol Rep 2026** (CC BY) | ○ | | | | ○ | | |
| **Jullien, BMC Pediatr 2021** (CC BY 4.0) | | ○ | ○ **secondary restatement** | | | | |
| **Abbam, Ghana 2024** (CC BY 4.0) | | ✗ *rights-clear but clinically unusable* | | | | | |

---

## 3. The verified-usable set

Only candidates that survived adversarial verification with an explicit, located licence permitting our reuse.

### Tier A — public domain, unrestricted commercial use

**1. CDC, MMWR Recommendations and Reports 1998;47(RR-3), "Recommendations to Prevent and Control Iron Deficiency in the United States"**
- Licence: **US public domain**, verbatim from the official PDF back matter: *"All material in the MMWR Series is in the public domain and may be used and reprinted without permission; citation as to source, however, is appreciated."* No NC, no SA, no attribution requirement beyond courtesy.
- Access note: `cdc.gov` returns HTTP 403 to all automated clients. Retrieved and cross-verified two independent ways (Internet Archive Wayback HTML + the official PDF). **The public-domain grant appears only in the PDF, not the HTML conversion** — the PDF must be the archived locator of record.
- Verified numerics (Table 6, Hb g/dL): 1–<2 y 11.0 · 2–<5 y 11.1 · 5–<8 y 11.5 · 8–<12 y 11.9 · males 12–<15 y 12.5, 15–<18 y 13.3 · nonpregnant females 12–<15 y 11.8, 15–<18 y 12.0. Footnote: the 1–<2 y values "can be used for infants aged 6–12 months" — **an explicit extrapolation, not measured data.**
- Table 8: MCV microcytosis cutoffs <77 fL (1–2 y), <79 (3–5), <80 (6–11), <82 (12–15), <85 (>15). RDW >14.0% **with CDC's own footnote "The cutoff is instrument specific and may not apply in all laboratories."** Ferritin ≤15 µg/L for persons >6 months. Transferrin saturation <16%.
- **Three mandatory corrections before adoption** (caught in verification): (a) the race-based Hb/Hct adjustment (−0.4 g/dL children <5 y, −0.8 g/dL adults) is attributed in-source to the **Institute of Medicine, not CDC**, and the very next sentence states *"the recommendations in this report do not provide race-specific cutoff values for anemia"*; (b) the female Hgb 15–19 y band was omitted from the discovery transcription; (c) the "mild IDA >10.0 but <11.0 g/dL" language is a **description of prior study definitions, not a CDC severity recommendation** — using it as T7 would be a misreading.
- Age: **28 years.** CDC-affiliated authors publishing 2021–2026 have themselves put the iron-deficiency inflection at ~19.9–25.0 µg/L, i.e. CDC's own ≤15 µg/L is now contested by CDC.

**2. NCHS Data Brief No. 519 (2024)** — public domain (*"All material appearing in this report is in the public domain"*). Hb <11.0 (2–4 y), <11.5 (5–11), <12.0 (12–14 and females ≥15), <13.0 (males ≥15). **Provenance warning surfaced by verification: reference (8) is WHO 2024.** These are a US-public-domain *restatement* of CC BY-NC-SA WHO values converted g/L→g/dL. Citing NCHS to avoid citing WHO is rights-laundering; flag for counsel rather than rely on quietly.

**3. NHLBI Iron-Deficiency Anemia topic page** — verification **overturned** the discovery finding of "no grant located": NHLBI publishes a domain-wide public-domain statement (*"unless noted otherwise, information posted on the NHLBI website within the nhlbi.nih.gov domain is in the public domain"*). Non-copyright conditions apply: no product endorsement/advertising use, no logo reuse. Adult-framed with no pediatric thresholds — usable only as a qualitative T1 corroborator.

### Tier B — CC BY (commercial use permitted, attribution required)

**4. Addo OY, Mei Z, Braat S, et al., Lancet Haematol 2024;11(4):e253–e264** (PMC10983828) — **CC BY 4.0**, article-level grant verified verbatim. Hb 5th centiles: 104.4 g/L (90% CI 103.5–105.3) 6–23 mo · 110.2 (109.5–110.9) 24–59 mo · 114.4 (113.6–115.2) 5–11 y · 122.2 (121.3–123.1) female 12–17 y · 128.2 (126.4–130.0) male 12–17 y. **Haemoglobin only — zero MCV/RDW hits across the full text.**
  - **Do-not-substitute warning:** these are research-derived centiles; WHO did **not** adopt them. Braat male 12–17 y = 128.2 g/L vs WHO's adopted <120 g/L at 12–14 y. Labelling these "WHO cutoffs" would be a factual error.

**5. Mei Z, Addo OY, Jefferds MED, et al., J Nutr 2023** (PMC10472073) — **CC BY 4.0**. Table 2, verified verbatim: children 12–59 mo, Hb-derived SF threshold **21.2 µg/L (95% CI 18.5, 26.5)**, eZnPP-derived **18.7 µg/L (17.9, 19.7)**; nonpregnant women 15–49 y **24.8 (23.4, 26.9)** and **22.5 (21.7, 23.3)**. *Correction: the DOI circulated in discovery (…01.030) is wrong; correct is 10.1016/j.tjnut.2023.01.035, PMID 36803577.*

**6. Hoq M, et al., Sci Rep 2020;10:18233** (PMC7589482) — **CC BY 4.0**. Ages 2–18 y, age- and sex-stratified. Functional limit: *"iron deficiency anemia starts to occur when ferritin levels reach 10 µg/L."* Per-year 2.5th-percentile tables exist (Tables 2/3, female/male) but **were not transcribed** — must be re-extracted row-by-row before ingestion. Does **not** cover 6–24 months. Provenance correction: Victorian **primary-care (POLAR/GP)** pathology data, not hospital EHR.
  - **Trap flagged and confirmed:** the only CRP figure (≥10 mg/L) is a **methods exclusion criterion**, not a clinical rule. Converting it into a T4 co-measurement rule would be a fabrication.

**7. Bijelić V, et al., JAMA Netw Open 2026** (PMC13179555) — **CC BY**. Full age×sex ferritin reference and "optimal" intervals, 2 wk to <11 y, verified cell-by-cell (e.g. males 18–20 mo lower limit optimal 6.0 | reference 5.1 ng/mL; 9 to <10 y 17.9 | 17.3).
  - **Semantic trap:** these are distribution-based **reference intervals**, and the authors argue explicitly that the 2.5th-percentile lower limit **underdiagnoses** iron deficiency. Wiring them in as ID cutoffs inverts the paper's own conclusion. Reference intervals and decision limits must remain distinct fact types in the KB.

**8. Namaste SM, et al. (BRINDA), AJCN 2017;106(Suppl 1)** (PMC5490647) — **CC BY 3.0**. Verified verbatim: inflammation defined as **CRP >5 mg/L, AGP >1 g/L, or both**; four explored approaches including raising the ferritin cutoff to **<30 µg/L**; conclusion favours internal regression correction.
  - **Scope constraint (severe):** this is a **population prevalence-estimation** method requiring a survey-level internal reference. It is *not* validated as an individual-patient diagnostic adjustment. Any T4 rule derived from it must be scoped `population` or marked an implementation proposal.
  - *Correction:* the effect size is **7–25 and 2–8 absolute median percentage POINTS**, not percent.

**9. Parkin PC, et al., BMC Pediatr 2021;21:241** (PMC8132375) — **CC BY 4.0 + CC0 for data**. Sex-stratified Hb (g/L) and MCV (fL), 2 wk–36 mo, verified table-by-table. **No RDW. Stops at 3 years.** Authors' own warning, verified: iron-deficient children were *not* excluded, so these are population reference intervals and **should not be used as anaemia decision limits.**

**10. Turgeon O'Brien H, et al., Anemia 2016** (PMC4921626) — **CC BY (version not stated on record — residual diligence item)**. SF <15 µg/L without inflammation / **<50 µg/L with CRP >5 mg/L**; sTfR >1.95 mg/L; **sTfR-FI >1.5** (sTfR ÷ log₁₀ ferritin). Verification found the locator misstated (these are Methods §2.3 + Table 3, not Table 1) and that the source contradicts itself on the CRP boundary (≤5/>5 in Abstract vs <5/≥5 in table footnotes). n≈149–154, single Nunavik Inuit preschool cohort, ~25% CRP-elevated, cutoff bound to the Dade Behring nephelometer. **Assay- and population-bound; not a portable rule.**

**11. Uijterschout L / Sandberg S, et al., Int J Lab Hematol 2021** (PMC8246861) — **CC BY 4.0**. sTfR RIs: 2.4–9.5 mg/L at birth, 2.9–8.4 at 48–96 h, 2.6–5.7 at 4 mo, 3.0–6.3 at 12 mo. **Roche Cobas-specific. Stops at 12 months. Provides no sTfR/log-ferritin index.**

**12. AlQarni AM, et al., Front Med 2024** (PMC11317290) — **CC BY**. Mentzer index MCV/RBC, <13 thal trait / ≥13 IDA, children ≤16 y, n=434. **Reports poor performance: IDA 61% sensitivity / 36% specificity; α-thal 34%/58%.** Verification found the paper self-contradicts (36% vs 38% specificity) and that discovery reported only the flattering PPV/NPV cells — the omitted counterparts are **PPV 8% for β-thal trait and NPV 20% for IDA**. Its IDA reference standard (ferritin ≤4.63 ng/mL) is anomalous.

**13. Mahmood et al., Front Big Data 2025** (PMC12358405) — CC BY 4.0. Adult, single-centre Iraqi cohort. Its Mentzer/Srivastava/Ehsani rows are **secondary restatements of 1970s–90s primary sources and are directionally inverted** relative to the canonical literature (it prints ">13 suggests BTT"; Mentzer 1973 is the opposite). **Do not anchor any rule to it.**

**14. Abbam G, et al., Ghana 2024** (PMC11101252) — CC BY 4.0, verified numerics. **Rights-clear and clinically unusable:** Hb lower limits 8.9–9.8 g/dL are the 2.5th percentile of a high-anaemia-burden population, and the RDW-CV interval (7.3–10.0%) is analyser-idiosyncratic (100% out-of-range against the instrument vendor's own child RIs).

**15. Leone et al., Hematol Rep 2026** (PMC12821433) — CC BY. Narrative review; **no pediatric diagnostic thresholds**. Qualitative T1 (CBC + ferritin + iron indices) and qualitative T5 (sTfR:ferritin ratio) only.

**16. Jullien S, BMC Pediatr 2021** (PMC8424788) — CC BY 4.0. All thresholds are **attributed restatements** of WHO/USPSTF/AAP/CDC/UK-NSC. Usable as a rights-clear citation trail, **not** as an encodable source.

### Tier C — Open Government Licence

**17. NHS Sickle Cell & Thalassaemia Screening Programme handbook — Antenatal screening (GOV.UK)** — **OGL v3.0**, document-level grant, **no NC, no SA, no territorial restriction**, commercial use permitted with Crown copyright attribution. MCV normal range 77–95 fL; MCH 27–32 pg; MCH <27 pg → measure HbA₂; β-thal carrier HbA₂ 3.5–8%. **Antenatal adult-female population.** Verified to contain **no discriminant formula or index**. Transplanting these ranges into a 6 mo–<18 y cohort would be unsupported extrapolation. *(Canonical URL: `/sickle-cell-and-thalassaemia-screening-handbook/antenatal-screening`; updated 11 July 2025.)*

---

## 4. Rejected candidates and why — the instructive failures

### 4a. The "free to read ≠ rights cleared" set (largest failure class)

| Source | Status | Why rejected |
|---|---|---|
| **CALIPER Hematology Reference Standards, AJCP 2020** (PMC7403759) | Full text free in PMC | **"© American Society for Clinical Pathology, 2020. All rights reserved."** This is the *single best clinical fit for T2* in all 69 candidates — birth to <21 y, age- and sex-partitioned Hb/MCV/RDW — and it is the one that is explicitly rights-reserved. Verification independently corroborated via the NCBI OA service returning `idIsNotOpenAccess`. **Also analyser-specific (Beckman Coulter DxH 900), and Beckman Coulter funded the study and supplied the instruments.** |
| **BSH Good Practice Paper, Br J Haematol 2022;196:523** (bjh.17900) | Retrieved only via live Chrome; curl 403, WebFetch 402 | Wiley **"Free Access" = free-to-read only.** Crossref returns one licence entry pointing at Wiley VOR terms; Europe PMC `isOpenAccess=N, license=None`. This is the **closest UK analogue to the AAP report** and explicitly covers children. Best single follow-up action in this whole report: **request a reuse grant from BSH/Wiley for this DOI.** |
| **NICE CKS "Anaemia – iron deficiency"** | **Zero content retrieved** (403 ×4) | The trap most likely to catch a future session. Third-party content (Clarity Informatics/Agilio), **explicitly excluded from the NICE UK Open Content Licence**, UK-geo-restricted, personal/educational use only, and *"data scraping and data mining of CKS is not permitted."* **No CKS number may be cited from memory.** |
| **RCH Melbourne Anaemia + Iron deficiency CPGs** | Fully readable | Site Terms cl. 5.2 grants only *"a revocable licence to download, copy and print… for your personal use"* and expressly prohibits reproduce/republish/distribute and *"create derive works from"* — an explicit prohibition on exactly what a CDS knowledge base does. Verification also caught a discovery error: the page **does** carry "Last updated November 2023"; the claimed 2026 date was the site-wide footer copyright roll and the alleged "no review date governance gap" does not exist. |
| **Canadian Paediatric Society, "Iron requirements in the first 2 years"** | Fully readable | Permission-on-application; CPS *"reserves the right to withhold or to charge."* Verification correction: the statement is **not** of unknown currency — posted 2019-11-20, **reaffirmed 2025-03-26**. Contains no ferritin cutoff and no Hb/MCV/RDW intervals. |
| **IAP Standard Treatment Guidelines 2022** | Free PDF | Bare `© Indian Academy of Pediatrics`, no grant anywhere in 8 pages. Its Hb table is captioned as **the WHO definition** — using IAP inherits WHO's provenance rather than escaping it. |
| **Mei et al., Lancet Haematol 2021** (PMC8948503) | Full author manuscript readable | **No licence grant of any kind.** NIH-public-access deposit under the generic PMC copyright notice; Europe PMC `fullTextXML` returns 0 bytes, confirming it sits outside the OA subset. **The trap:** the page *does* contain the phrase "public domain" — referring to the **NHANES dataset**, not the article. CDC authorship raises a 17 USC 105 argument that is nowhere asserted. |
| **NIH ODS Iron fact sheet** | Fully readable | No rights statement located; the ODS policies page 404s. Federal authorship implies public domain but that is an **inference, not a grant**. Also conflicts numerically with what the rules currently encode. |

### 4b. Licences that exist and forbid our use

| Source | Licence | Blocking term |
|---|---|---|
| **WHO 2024 haemoglobin guideline** (T2-Hb, T7) | CC BY-NC-SA 3.0 IGO | **NC** blocks the commercial track; **SA** would force any adapted rule content under an equivalent CC licence. Commercial requests route to who.int/copyright. |
| **WHO 2020 ferritin guideline** (T3, T4 — the *only* individual-patient CRP rule found) | CC BY-NC-SA 3.0 IGO | Same double constraint. |
| **AJCP 2019 NHANES piecewise regression** (PMC6306047) — the only source pairing age- *and* sex-specific Hb + MCV + RDW for children | **CC BY-NC 4.0** | NC. Licence names an explicit clearance route: `journals.permissions@oup.com`. |
| **Ann Lab Med 2018 (Korea)** | CC BY-NC | NC; also starts at 3 y and does not partition RDW within childhood at all. |
| **EHA/HemaSphere 2024 (Iolascon)** | **CC BY-NC-ND 4.0** | NC *and* ND. **ND is the harder block** — encoding prose into rules is definitionally an adaptation. |
| **StatPearls IDA** | CC BY-NC-ND 4.0 | NC + ND. Verification additionally found NCBI serves it flagged **"(Archived)… provided for historical reference only and the information may be out of date."** |
| **Blood Red Cells & Iron 2026 (US children 5–14 y)** — would close the single biggest T3 age gap | CC BY-NC-ND 4.0 (Crossref VOR) | NC + ND, and full text was never retrieved (403 at ASH and ScienceDirect). Trade-press figures were correctly **not** recorded. |
| **NICE NG203** | NICE UK Open Content Licence | Grants commercial use but **UK-territory only**; clause 6 forbids amending the wording or structure of published recommendations (= what rule encoding does); and NICE separately excludes **AI purposes** from the licence entirely, in the UK and internationally. |

### 4c. Overclaims caught by adversarial verification — carry these forward

1. **WHO 2007 §3.4 misquote (meaning-reversing).** Discovery rendered it as RDW failing to distinguish iron deficiency *"[from thalassaemia]"* via a bracketed insertion. The actual text says RDW fails to distinguish iron deficiency anaemia from **the anaemia of inflammatory disorders**. The bracket manufactured the referent, and the altered quote was then promoted to a program-level "T6 not supported" signal. **Strike that finding.**
2. **CDC 1998 race adjustment misattributed to CDC.** It is the **Institute of Medicine's** recommendation, and CDC explicitly declines to issue race-specific cutoffs. Encoding it as a CDC rule would create a rule the source refuses to make.
3. **Maldives MoH 2024 national guideline** — no licence statement anywhere in 33 pages, and it reproduces a Nelson Textbook of Pediatrics indicator table with no per-table attribution or permission. A ministry document carrying unresolved third-party rights **cannot launder them downstream.** Its Hb table also reproduces pre-2024 WHO values in a document dated 30 Jan 2024.
4. **Statistics Canada Appendix Table B** — StatCan's Open Licence *does* permit commercial use, but its own text defines "Information" as material StatCan owns or licenses and states *"Intellectual property rights that third parties may have in the Information shall remain their property."* The table's footnote sources it to **WHO/UNICEF/UNU 2001**. Also formally marked Archived Content, and its criteria are superseded twice over.
5. **Summarizer-extracted numerics are not retrieval.** On AJCP 2019, a WebFetch summariser returned internally inconsistent values (identical numbers for haemoglobin and RDW in the same age band). Caught only by re-parsing raw HTML. **For a pediatric CDS knowledge base, treat any summariser-produced clinical number as a lead to verify, never as a retrieval.**
6. **Reference number `WHO/UCN/NCD/2024` does not exist** in the 2024 haemoglobin guideline (zero grep hits). The document is identified by ISBN only. Citing that number in the KB would be unverifiable.
7. **WHO publishes haemoglobin in g/L, not g/dL.** A units error here is a factor-of-ten clinical error. This must be owned by the EP-2 units/range registry, not converted inline at ingest.

---

## 5. Unresolved gaps — stated plainly

**Gap 1 — T2: no rights-clear age- and sex-stratified RDW reference interval exists. Anywhere.**
Not in WHO, PAHO, NICE, CDC, any national society, or any CC BY journal source among 69 candidates. CDC 1998 gives one all-ages `>14.0%` with its own instrument-specificity disclaimer. The two sources that do have proper pediatric RDW partitions are CC BY-NC (AJCP 2019) or all-rights-reserved (CALIPER).
**To close:** a negotiated commercial licence from OUP/ASCP (`journals.permissions@oup.com` for AJCP 2019; OUP permissions for CALIPER) — **or** accept that RDW rules cannot carry a reference interval and re-express them against a locally-configured lab range. This is a **purchase or a product decision**, not a research task.

**Gap 2 — T2: MCV coverage for ages 3–18 y is rights-clear only as a one-sided 1998 microcytosis cutoff.** Parkin (CC BY) stops at 36 months. There is no two-sided, sex-partitioned, rights-clear pediatric MCV interval spanning school age and adolescence.
**To close:** same licence negotiation as Gap 1, or a primary reference-interval study.

**Gap 3 — T3: no rights-clear ferritin threshold specific to menstruating adolescents.** The only statements located are the **ASH public-comment draft** (≤30 ng/mL) — which forbids its own use and citation in terms — and WHO 2020 (NC-SA, and which gives adolescents 10–<20 y a flat <15 µg/L with no menstruation stratification).
**Danger:** WHO Rec 1.3's ">150 µg/L in menstruating women" is an **iron-OVERLOAD** threshold. The T3 wording actively invites misreading it as a deficiency cutoff.
**To close:** wait for the final ASH IDA-diagnosis guideline (expected in a Blood/ASH journal, **likely CC BY-NC-ND — a constraint, not a clearance**), or commission/locate a primary study.

**Gap 4 — T3: ages 5–14 y are uncovered by any rights-clear physiologically-derived threshold.** Mei 2023 covers 12–59 mo; the 2026 Blood RCI paper covering exactly 5–14 y is CC BY-NC-ND and was never retrieved.

**Gap 5 — T4: no rights-clear *individual-patient* inflammation-adjusted ferritin rule.** BRINDA is population-scope by design. WHO 2020's rule is the individual-patient one and is NC-SA — and even it is written as a **setting-level** condition ("in areas of widespread infection or inflammation"), not a per-patient conditional. WHO's regression equation is printed **without its β coefficients** and is therefore not executable as published. BSH 2022 goes further and **rejects** inflammation-corrected ferritin outright: *"we do not consider the evidence base robust enough to apply a 'corrected' assessment of iron status in current practice."*
**To close:** a legal determination on WHO NC-SA terms (or a paid WHO permission), **plus** a clinical decision on whether an individual-patient CRP rule is defensible at all given BSH's position.

**Gap 6 — T5: sTfR / log₁₀(ferritin) index has no substitute and the reason is scientific, not bibliographic.** sTfR immunoassays are not harmonised; results differ across measurement procedures by up to ~2.5×; the WHO/NIBSC 07/202 reference material never had a formal commutability study. WHO explicitly refuses a cutoff. BSH recommends **against** the assay (2C) and lists it among tests "not currently recommended." The only paper directly matching the target (CCLM 2025, children and adolescents) is closed with no licence located, as are both its predecessors.
**To close:** nothing purchasable fixes this. **Recommendation: retire the sTfR rules, or gate them behind an explicit assay declaration and mark them implementation proposals.**

**Gap 7 — T6: no rights-clear source covers three-way microcytic differentiation including anaemia of inflammation.** Worse, two guideline bodies actively contradict the encodable half: **BSH 2023** — *"such formulae are not likely to be reliable in children… and their use is not recommended"* — and **WHO 2007** — RDW-based discrimination of ID from anaemia of inflammation *"has not been supported by subsequent studies."* The one rights-clear pediatric Mentzer study reports 36% specificity for IDA.
**To close:** this is a **clinical claim-validity problem before it is a sourcing problem.** Escalate to the clinical approvers: if any Mentzer-style discriminant is currently encoded, guideline-body evidence contraindicates it in children regardless of which source is chosen.

**Gap 8 — T7: severity stratification exists in exactly one place and it is NC-SA.** WHO 2024 Table 3 is the sole authority. Its own normative statement 1.b says the severity methodology was **not changed due to insufficient evidence** — the mild/moderate/severe bands still trace to 1989 WHO arithmetic (80%/60% of cutoff), not to new evidence. CDC 1998 has no severity table.
**To close:** a purchased/negotiated WHO permission, **or drop severity stratification from the KB.**

---

## 6. Recommendation

**Partially re-anchor — and buy access to nothing from AAP.**

Buying AAP access does **not** solve this problem. The AAP 2026 report is paywalled, but paywalled ≠ licensed: purchasing a copy would let a human read it and would still not grant the right to encode its thresholds into a shipped commercial CDS knowledge base. The rules are ungrounded today because there is no licence, and a subscription does not create one. If AAP is wanted as the anchor, the required action is a **negotiated reuse permission from AAP**, which is a business action of the same kind as the WHO and OUP negotiations named above — and it is not obviously the cheapest of the three.

**Do this:**

1. **Re-anchor now, to rights-clear sources, for T3 and T4 (scope-corrected) and T1 (authority-downgraded).** Mei 2023 (CC BY 4.0) and Hoq 2020 (CC BY 4.0) for pediatric ferritin; BRINDA (CC BY 3.0) for inflammation, **re-scoped to population-level or explicitly marked an implementation proposal**; CDC MMWR 1998 (public domain) as the dated federal spine for the diagnostic pathway. **This is a clinical re-decision, not a citation find-and-replace** — Mei's 21.2 µg/L differs materially from the AAP ≤20 ng/mL currently encoded, and CDC's ≤15 µg/L differs from both. Every changed threshold needs clinical approver sign-off with an `effective` date and an explicit "1998-vintage" or "research-derived, not adopted guidance" provenance flag.

2. **Re-anchor T2-haemoglobin to Addo/Braat 2024 (CC BY 4.0)** — the cleanest grant found in the entire corpus — with an explicit KB note that these are **research-derived 5th centiles, not WHO's normative cutoffs**, and with unit handling owned by the EP-2 registry (g/L, not g/dL).

3. **Open exactly two licence conversations, in this order** — both are cheaper than any further research:
   - **BSH/Wiley for `10.1111/bjh.17900`** — the closest existing analogue to the AAP report, already free-to-read, single society, explicitly applicable to children. Highest value per unit of effort.
   - **OUP permissions for AJCP 2019 (CC BY-NC) and/or CALIPER (AJCP 2020)** — the only route to age- *and* sex-stratified pediatric Hb + MCV + RDW in one place. OUP names the contact in the licence itself.
   - *(WHO commercial permission via who.int/copyright is a third option, needed only if T7 severity strata are to be retained.)*

4. **Do not attempt to re-anchor T5, T6, or T7 from open sources. Escalate them as claim-retirement candidates.**
   - **T5** — retire or assay-gate. No portable cutoff exists and none is coming until sTfR is harmonised.
   - **T6** — escalate as a clinical-validity question, not a sourcing question. Two guideline bodies contradict discriminant-index use in children.
   - **T7** — either purchase WHO permission or drop severity stratification. Note that even the purchased version rests on 1989 expert opinion by WHO's own admission.

5. **Until the above lands, the 32 affected rules should be marked ungrounded with an explicit provenance status rather than silently re-pointed.** The honest state of the KB today is that a third of its rules cite a source it has no right to encode, and roughly half the underlying claim areas have no rights-clear replacement. That should be visible in the artifact, not resolved by optimism.