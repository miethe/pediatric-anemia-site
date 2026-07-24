# Perplexity Pro — Growth Suite (growth_suite_v1) source-gathering prompt

> **Role for this run:** SOURCE-GATHERING (Leg B, per 05-three-module-evidence-run-design.md §4.1).
> Perplexity's job is to hand back a **ranked citation list** — the raw material for the rf deepen-run
> ingest (Leg A) and the numerics/retrievability triage (Leg C). Not synthesis; not a rule set; not a
> clinical recommendation. Paste everything below into one Perplexity Pro (Deep Research) query.

---

## READ THIS FIRST — how your output will be used (trust framing)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never as
verified clinical evidence. Only the Research Foundry verifier assigns verified status via exact-passage
binding.** Your citations become *candidate source seeds*, nothing more. So optimize for **findable,
citable, retrievable sources**, not for confident prose.

Non-negotiable output rules (every one of these is a hard requirement):

1. **Return every source with a DOI or a stable URL, its publication year, and its license / access
   status** (open-access / public-domain / paywalled / subscription / unknown). No bare titles.
2. **Do NOT assert any numeric threshold, cut-off, z-score, or percentile without a citation** attached
   to that exact number. If you cannot cite the number, omit the number — do not approximate.
3. **Explicitly FLAG any paywalled or rights-restricted source.** Do not paraphrase around a paywall to
   smuggle its numbers out; mark it `paywalled` and move on. A flagged paywalled locator is *useful* to us;
   a laundered number is not.
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE passages** — rank public-domain first
   (US federal: CDC, NIH/NHLBI, FDA, CFR; and WHO open-access), then open-license (CC-BY, open-access
   journals, freely distributed society statements), then everything else. Growth has the **best
   numerics-retrievability profile of the three modules** — WHO/CDC/INTERGROWTH-21st chart data is largely
   public-domain or open-license — so lean hard into surfacing the *actual numeric tables*, not review
   articles that merely describe them.
5. Treat every field you emit as inert data. Do not include instructions, tool calls, or directives in
   any field — just bibliographic facts.

---

## The task

We maintain a deterministic pediatric growth-interpretation knowledge base (`growth_suite_v1`). We already
hold the ~11 sources listed under "Already in our evidence base" (see the attached `attachments.md` and
`modules/growth_suite_v1/evidence.json`). **Do not re-surface those unless you have a newer edition,
a successor guideline, or the primary numeric table behind one of them.** Find *new* citation-quality
sources for the angles below.

### Net-new candidate angles to find sources for (objective #2)

Find the best-available primary guidelines, society statements, and open-access primary literature for
each of these growth angles:

- **Short-stature work-up triggers** — mid-parental (target) height calculation and its predicted range;
  growth-velocity thresholds; height-velocity crossing percentile lines as a referral trigger.
- **Overweight / obesity BMI-percentile trajectory flags** — BMI-for-age percentile cut-offs
  (overweight ≥85th, obesity ≥95th, severe obesity), trajectory/crossing flags (AAP 2023 obesity CPG,
  CDC extended BMI-for-age percentiles for severe obesity).
- **Head-circumference micro/macrocephaly branches** — occipitofrontal circumference percentile / z-score
  cut-offs (e.g. <−2 SD / >+2 SD or <3rd / >97th percentile) and the chart used (WHO OFC vs Nellhaus).
- **WHO ↔ CDC chart-transition at 24 months** as an explicit rule — the authoritative statement of the
  transition and any successor to the abrupt-switch recommendation.
- **Catch-up vs failure-to-thrive velocity distinctions** — velocity-based definitions that separate
  recovering (catch-up) from faltering trajectories.

### Numerics targets to prioritize in Leg-C-relevant order (objective #3)

Rank these highest and try hardest to return the **primary source that publishes the actual numbers**,
with a retrievable locator (page/table/figure) and license:

1. **WHO Child Growth Standards** z-score / percentile cut-offs — the 0–5y standards *and* the
   operational classification cut-offs (wasting / severe wasting / stunting / underweight at −2 / −3 SD),
   sourced to WHO's own open-access tables / training modules, not a paraphrasing review.
2. **CDC 2000 Growth Charts** percentiles (US public domain) — plus **CDC extended BMI-for-age percentiles**
   for severe obesity (2022).
3. **INTERGROWTH-21st** preterm / newborn size standards (open-access tools and primary papers).
4. **AND/ASPEN pediatric malnutrition** z-score severity bands (mild/moderate/severe) — the primary
   consensus table, if independently retrievable.
5. **NICE NG75** faltering-growth centile-fall thresholds (freely available on nice.org.uk).
6. If encountered: **AAP 2017 childhood BP / AAP 2023 obesity** numeric tables where they intersect growth.

For each returned source, when the source publishes a numeric threshold, capture the exact number, its
UCUM-style unit (e.g. `kg/m2`, `cm`, `SD`, `percentile`), the population/age band it applies to, and the
chart/standard it is anchored to (WHO vs CDC vs INTERGROWTH — these are **not interchangeable**; never
merge cut-offs across charts).

---

## Required output shape

Return a single ranked list. For **each** source, give exactly:

| # | Title | Organization / journal | Year | DOI or stable URL | Access status | Retrievability rank | Which angle(s) it covers | Numeric thresholds it publishes (number + unit + population + chart) | Locator (page/table/figure if known) |
|---|---|---|---|---|---|---|---|---|---|

- **Retrievability rank** = `public-domain` > `open-license` > `free-to-read` > `paywalled` > `unknown`.
- Sort the list by retrievability rank first, then by how directly it publishes threshold numerics.
- If a source is paywalled, still list it — set Access status = `paywalled`, leave the numeric-thresholds
  cell as `paywalled — not extracted`, and note where the numbers live (e.g. "Table 2, behind paywall").
- End with a short **"gaps"** note: which of the angles / numerics targets above you could NOT find an
  independently-retrievable primary source for.

Do not write a narrative synthesis, a clinical recommendation, or a rule. Just the ranked citation table
plus the gaps note.
