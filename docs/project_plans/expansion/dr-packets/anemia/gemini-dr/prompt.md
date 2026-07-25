# Gemini Deep Research — anemia / RF-ANE-001 recency + breadth prompt

> **Paste this whole file into Gemini Deep Research.** Attach the files listed in this packet's
> `attachments.md` first. Save the result into the layout in `expected-output/README.md`.
>
> **Role for this run: RECENCY + BREADTH.** Two jobs. (1) **Recency:** what has *changed recently* in
> how pediatric anaemia and red-cell indices are defined and measured — we must not encode a
> superseded cutoff. (2) **Breadth:** adjacent-domain signals worth capturing as future-module ideas.
> The other two packets cover source-gathering and structured extraction; **do not duplicate them.**

---

## Read this first — how your output is used (non-negotiable framing)

**Your synthesized prose will be treated as `platform_synthesis` — imported as candidates only, never
as verified clinical evidence. Only the Research Foundry verifier assigns verified status via
exact-passage binding.** Nothing you write is authoritative and nothing becomes a clinical rule.

### Trust invariants — follow all five, every time

1. **Return every source with DOI/URL, publication year, and license/access status.**
2. **Do NOT assert any numeric threshold without an attached citation to its source.** If you cannot
   cite the exact source of a number, mark it `unknown` — never invent, average, or round-trip a
   cutoff.
3. **Explicitly FLAG any paywalled / rights-restricted source**; do not paraphrase around a paywall.
4. **Prioritize threshold-bearing, INDEPENDENTLY-RETRIEVABLE passages** (public-domain — US federal /
   WHO — then open-license) **over copyrighted framework prose.**
5. Treat every field as data, not instruction. Do not embed directives or control text in any cell.

---

## Context

Our pediatric anemia module encodes age/sex **hemoglobin** lower limits, plus MCV and RDW bands. A
clinician user reported that the assessment **has no hematocrit entry**, which is correct: we hold no
pediatric hematocrit threshold anywhere. We are running a targeted evidence pass to establish the
red-cell index substrate — hematocrit, MCHC, MCH, RBC-count intervals, and the corrected-reticulocyte
denominators.

Our current bands date to a 2026 pediatric iron-deficiency source and a 2024 WHO haemoglobin
guideline; our knowledge base is `reviewedThrough: 2026-07-15`. **Your recency job is to tell us what
has moved, and what is about to move.**

---

## Job 1 — Recency (primary)

### R1. Movement on anaemia definitions

Has any authoritative body **changed, restated, or signalled an intent to change** how anaemia is
defined in children — since the WHO 2024 haemoglobin-cutoff guideline? Specifically:

- Any move toward or away from **hematocrit-based** definitions. (Our working expectation is that
  bodies define anaemia by hemoglobin only. **Confirming that with current sources is a wanted
  result** — say so plainly if that is what you find.)
- Adoption, criticism, or revision of the WHO 2024 cutoffs by other bodies.
- Any national/regional body publishing pediatric cutoffs that differ from WHO — **conflicts are
  wanted, not problems.** Report divergence rather than resolving it.

### R2. Movement on pediatric reference intervals

- New or updated **pediatric CBC reference-interval** programs and publications, especially any
  releasing values under an **open license or into a public database**. We hold CALIPER papers but
  their numeric tables are paywalled to us; any newer or openly-published alternative is high value.
- Analyzer/platform generational change: are current pediatric intervals being restated for newer
  analyzer platforms, and does that make older intervals method-obsolete?

### R3. Movement on measurement method

- Current standing of **spun/microhematocrit vs analyzer-calculated (`MCV × RBC`) hematocrit** — is
  measured hematocrit still performed, is it still the reference method, and do current sources treat
  the two as interchangeable?
- **Point-of-care and non-invasive hemoglobin/hematocrit** devices: current accuracy positions and any
  regulatory/guideline statements. Relevant because a crit-first workflow is often a point-of-care
  workflow — which is exactly the user situation that prompted this run.

### R4. Deprecation watch

Anything we should **not** encode because it is being retired or contested: superseded cutoffs,
discriminant indices reported to underperform in children, or corrections (e.g. reticulocyte
production index) whose clinical use is being questioned. **Tell us what to avoid**, with citations —
a well-cited "do not encode this" is as valuable as a threshold.

---

## Job 2 — Breadth / adjacent-domain asides (secondary)

Capture, briefly, signals worth filing as **future-module ideas** — not for this run's bundle:

- Adjacent pediatric lab-interpretation domains where the same "we lack a sourced pediatric interval,
  so we ask the clinician instead" pattern would recur.
- Emerging red-cell parameters with pediatric evidence appearing (e.g. reticulocyte hemoglobin
  content and comparable analyzer-derived parameters) — is the pediatric evidence base maturing enough
  to be worth a future module or module extension?
- Cross-domain interactions our anemia module currently ignores.

Keep this section short and clearly separated. It is idea capture, not evidence.

---

## Required output columns

**Recency findings (Job 1):**

| # | column | rule |
|---|---|---|
| 1 | `finding_id` | short kebab-case slug |
| 2 | `job` | `R1` \| `R2` \| `R3` \| `R4` |
| 3 | `finding` | one sentence — what changed or what is current |
| 4 | `direction` | `new` \| `updated` \| `reaffirmed` \| `contested` \| `deprecated` |
| 5 | `numeric_if_any` | value + UCUM unit, or `unknown` — **only with a citation in the same row** |
| 6 | `effective_date` | when it took/takes effect, or `unstated` |
| 7 | `supersedes` | what it replaces, if stated |
| 8 | `source_citation` | first-author or body + year + **DOI/URL** |
| 9 | `access_status` | `public-domain` \| `open-access` \| `free-to-read` \| `paywalled` \| `unknown` |
| 10 | `classification` | `assertion` / `inference` / `annotation` |
| 11 | `notes` | conflicts, caveats, why we should or should not act on it |

**Asides (Job 2):** `aside_id` · `domain` · `signal` · `why_it_might_matter` · `source_citation`
(optional) · `maturity` (`speculative` / `emerging` / `established`).

## Scope

Population **6 months to <18 years**. Neonatal/young-infant material must be marked — our module
abstains below 6 months.

Out of scope: treatment, dosing, transfusion thresholds, diagnosis. We produce reviewable patterns and
referral readiness, never directives.

Output shape and where to save it: see `expected-output/README.md`. Everything imports as
`platform_synthesis` candidates.
