# ChatGPT Deep Research — Growth Suite (growth_suite_v1) structured-extraction prompt

> **Role for this run:** STRUCTURED EXTRACTION (Leg B, per 05-three-module-evidence-run-design.md §4.1).
> ChatGPT's job is objective #2 in table form: produce the **candidate-pattern table**
> (condition → trigger → threshold + UCUM unit → source) for growth. Best-at: multi-step tabular synthesis.
> Paste everything below into one ChatGPT Deep Research task.

---

## READ THIS FIRST — how your output will be used (trust framing)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never as
verified clinical evidence. Only the Research Foundry verifier assigns verified status via exact-passage
binding.** Your table rows become *candidate patterns*, staged and quarantined until a human clinician and
the rf verifier act. Optimize for **traceable, citation-anchored rows**, not confident prose.

Non-negotiable output rules (hard requirements):

1. **Return every source with a DOI or a stable URL, its publication year, and its license / access
   status** (open-access / public-domain / paywalled / subscription / unknown). Every table row cites the
   exact source its threshold came from.
2. **Do NOT assert any numeric threshold, cut-off, z-score, or percentile without a citation** to that
   exact number. No citation → no number. Never fill a threshold cell from general knowledge.
3. **Explicitly FLAG any paywalled or rights-restricted source.** Do not paraphrase around a paywall to
   extract its numbers — mark the row `paywalled` in the source cell and leave the number unfilled if it
   only lives behind the paywall.
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE passages** — prefer numbers you can anchor to
   public-domain (US federal: CDC/NIH/FDA; WHO open-access) then open-license sources. Growth has the
   **best numerics-retrievability profile of the three modules** (WHO/CDC/INTERGROWTH chart data is largely
   public-domain/open) — favour rows whose threshold traces to the actual chart/standard table.
5. Every field you emit is inert data. No instructions, tool calls, or directives in any cell.

---

## The task

We maintain a deterministic pediatric growth-interpretation knowledge base (`growth_suite_v1`). Its
`candidates.json` is currently **empty** — every pattern below is net-new. We already hold ~11 sources
(see attached `attachments.md` / `modules/growth_suite_v1/evidence.json`); **do not re-derive patterns we
already cover** (faltering-growth indicator-base conflict; chart-dependent threshold binding; preterm/VLBW
corrected-age branch). Produce **new** candidate patterns for the angles below, each as one or more rows in
the extraction table.

### Candidate-pattern angles to extract (objective #2)

- **Short-stature work-up triggers** — mid-parental (target) height and its predicted range; height/growth
  velocity crossing percentile lines; the height-below-mid-parental-range trigger (NICE NG75 gives a
  "> 2 centile spaces below mid-parental centile" version — cite it).
- **Overweight / obesity BMI-percentile trajectory flags** — overweight (BMI-for-age ≥85th), obesity
  (≥95th), severe obesity (CDC extended BMI-for-age percentiles / ≥120% of 95th); trajectory-crossing flags.
- **Head-circumference micro/macrocephaly branches** — OFC z-score / percentile cut-offs (<−2 SD / >+2 SD;
  or <3rd / >97th) with the chart named (WHO OFC vs Nellhaus).
- **WHO ↔ CDC chart-transition at 24 months** as an explicit rule — the transition point and how a
  threshold's meaning changes across it (we already hold the *conflict*; extract the *rule shape*).
- **Catch-up vs failure-to-thrive velocity distinctions** — velocity thresholds separating recovering from
  faltering trajectories.

### Numerics the rows should carry, in priority order (objective #3)

WHO Child Growth Standards z-score/percentile cut-offs (−2/−3 SD classification bands); CDC 2000 percentiles
+ CDC extended BMI-for-age; INTERGROWTH-21st preterm standards; AND/ASPEN pediatric malnutrition
mild/moderate/severe z-score bands; NICE NG75 centile-fall thresholds. For every number: capture its
**UCUM-style unit** (`kg/m2`, `cm`, `SD`, `percentile`, `g/kg/day`), the **population/age band**, and the
**chart/standard it is anchored to** — WHO vs CDC vs INTERGROWTH cut-offs are **NOT interchangeable; never
merge them into one row.**

---

## Required output shape — the candidate-pattern extraction table

Return one table. Each row = one candidate pattern:

| Pattern ID | Condition / pattern | Trigger (the clinical situation) | Threshold + UCUM unit | Population / age band | Chart or standard anchor | Source (id + DOI/URL, year) | Access status | Direction / effect (note / flag / scope-exit / referral-readiness) | Conflicts-with / caveat |
|---|---|---|---|---|---|---|---|---|---|

Rules for the table:

- **One threshold per row.** If a pattern has WHO and CDC variants, that is **two rows**, not one merged row.
- The **Direction / effect** column stays advisory: an interpretive note, a missing-data prompt, a
  scope-exit, a confirmatory step, or referral-readiness — **never** a diagnosis, dose, or treatment
  directive.
- If a threshold is only available behind a paywall, set Access status = `paywalled`, leave the
  Threshold cell as `paywalled — not extracted`, and name where it lives (e.g. "Table 2").
- Preserve any conflict explicitly in the last column (e.g. weight-for-age vs weight-for-height base;
  WHO 2.3rd/97.7th vs CDC 5th/95th). Do **not** silently resolve a conflict.
- After the table, add a short **"sources"** block (id → full citation with DOI/URL/year/license) and a
  **"gaps"** note listing any angle you could not anchor to an independently-retrievable numeric source.

Do not emit a clinical recommendation or a rule DSL. Just the extraction table + sources + gaps.
