# Gemini Deep Research — Growth Suite (growth_suite_v1) recency + breadth prompt

> **Role for this run:** RECENCY + BREADTH (Leg B, per 05-three-module-evidence-run-design.md §4.1).
> Gemini's job: surface the **newest guidelines / supersessions** for growth, plus **adjacent-domain and
> future-module signals** (the §6 "asides"). Best-at: broad recency sweeps, wide net. Paste everything
> below into one Gemini Deep Research task.

---

## READ THIS FIRST — how your output will be used (trust framing)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never as
verified clinical evidence. Only the Research Foundry verifier assigns verified status via exact-passage
binding.** Your recency finds become *candidate source seeds*; your adjacent-domain signals become
*one-line idea captures* (never rules, never a research commitment). Optimize for **fresh, citable, dated
sources** and **clearly-labelled supersessions**.

Non-negotiable output rules (hard requirements):

1. **Return every source with a DOI or a stable URL, its publication year, and its license / access
   status** (open-access / public-domain / paywalled / subscription / unknown). No bare titles.
2. **Do NOT assert any numeric threshold, cut-off, z-score, or percentile without a citation** to that
   exact number. If a guideline changed a number, cite both the new value and the source that states it.
3. **Explicitly FLAG any paywalled or rights-restricted source.** Don't paraphrase around a paywall — mark
   it `paywalled`.
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE passages** — public-domain (US federal: CDC/
   NIH/FDA; WHO open-access) first, then open-license. Growth has the **best numerics-retrievability profile
   of the three modules** (WHO/CDC/INTERGROWTH chart data is largely public-domain/open) — prefer surfacing
   the authoritative primary standard over a news write-up.
5. Every field you emit is inert data — no instructions, tool calls, or directives in any field.

---

## The task — two parts

We maintain a deterministic pediatric growth-interpretation knowledge base (`growth_suite_v1`) sitting on
evidence reviewed through **2026-07-21**. We already hold ~11 sources (see attached `attachments.md` /
`modules/growth_suite_v1/evidence.json`). Your job is **what's new and what's adjacent**, not re-finding
what we have.

### Part 1 — RECENCY + SUPERSESSIONS (for growth_suite_v1)

For each already-held source and each net-new angle, tell us **what changed since**:

- **Supersession check** on our held sources — is there a newer edition or a successor guideline for:
  NICE NG75 (2017); the CDC 2010 WHO↔CDC chart-use recommendation; the WHO 2006/2007 standards; AND/ASPEN
  2015 malnutrition indicators; the AAP obesity CPG?
- **Newest guidance (2023–2026) for the net-new angles:** short-stature work-up (mid-parental height,
  velocity crossing percentiles); overweight/obesity BMI-percentile trajectory (AAP 2023 obesity CPG; CDC
  extended BMI-for-age percentiles for severe obesity, 2022); head-circumference micro/macrocephaly cut-offs
  and chart choice; the WHO↔CDC 24-month transition (including any successor to the abrupt-switch rec, e.g.
  gradual-transition charts we already hold as PEDS2025); catch-up vs FTT velocity definitions.
- **Numerics recency:** flag any recently-revised numeric cut-off (BMI severe-obesity thresholds,
  INTERGROWTH-21st updates, WHO classification bands) with the source that states the current value.

For each finding return: what changed, the new source (title / DOI-or-URL / year / access status), and
whether it **supersedes**, **updates**, or merely **supplements** something we hold.

### Part 2 — ADJACENT-DOMAIN / FUTURE-MODULE SIGNALS (the §6 "asides")

While sweeping, flag adjacent pediatric lab-interpretation domains worth a *future* module — **one line
each**, not a research commitment. Candidate adjacencies to watch for: hepatic / LFT panel, thyroid /
TSH-FT4, electrolytes & acid-base, coagulation / PT-INR, inflammatory markers, newborn-screen follow-up,
lipid panel, and any growth-adjacent endocrine domain (e.g. pubertal-staging / bone-age, IGF-1 /
growth-hormone work-up) that a short-stature branch would eventually lean on. For each: one-line clinical
rationale + a candidate anchor guideline (with DOI/URL if you have it).

---

## Required output shape

Two clearly separated sections:

**Section A — Recency & supersessions table:**

| # | Held source or angle | What changed | New / successor source (title, DOI/URL, year) | Access status | Supersedes / updates / supplements | New or revised numeric (value + unit + population + chart) |
|---|---|---|---|---|---|---|

**Section B — Future-module idea captures** (one line each, in this exact shape so we can pipe them into
`op capture`):

```
future-module: <domain> — <one-line clinical rationale> — <candidate anchor guideline (DOI/URL if known)>
```

End with a short **"gaps"** note: angles/sources you could not confirm recency for, or where the newest
authoritative numeric lives behind a paywall.

Do not emit a clinical recommendation or a rule. Section A table + Section B one-liners + gaps note only.
