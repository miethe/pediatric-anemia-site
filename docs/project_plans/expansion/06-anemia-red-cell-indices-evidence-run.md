# 06 — Anemia Red-Cell Indices Evidence Run (RF-ANE-001)

---
title: "RF-ANE-001 — pediatric red-cell indices & derived-index substrate evidence run"
description: "Design for a single-module rf deepen run on `anemia`, triggered by user feedback that the assessment accepts hemoglobin but not hematocrit. Scoped to the red-cell index substrate the engine lacks: Hct, MCHC, MCH, age/sex RBC intervals, and the corrected-reticulocyte/RPI denominators. Three legs (rf deepen · DR HITL packets · numerics hunt), mirroring 05."
status: approved
created: 2026-07-24
owner: Nick Miethe
project: pediatric-cds-platform
extends_bundle: RF-EV-001 (`rf_run_20260717_rf_ev_001_pediatric_cds_backfill`)
module: anemia
---

## 0. TL;DR

User feedback — *"the anemia guidelines you sent only had a hemoglobin entry place and not a
hematocrit"* — is correct, and the gap is **structural, not cosmetic**. Hematocrit is absent from the
input schema, the SPA, all 91 rules, and the reference-range tables. It cannot be added as a form
field because **there is no Hct threshold anywhere in the knowledge base for an entered value to be
evaluated against.**

Investigating that gap surfaced **five more instances of the same failure mode** (§1.2): wherever the
KB lacks a sourced pediatric numeric interval for a red-cell index, the engine substitutes a
**clinician-entered categorical dropdown** for a computed one. That is a defensible safety posture and
it is *why* the tool is honest — but it is also a bounded, researchable evidence gap.

**This run does not add a hematocrit field.** It produces the verified evidence substrate that would
make adding one legitimate. Rules remain downstream of the human attestation seam (§8).

| | |
|---|---|
| **Item** | RF-ANE-001 |
| **Module** | `anemia` (the only `status: integrity-recorded` module; 91 rules, 26 candidates, 6 sources) |
| **Extends** | RF-EV-001 bundle (`rf_run_20260717_rf_ev_001_pediatric_cds_backfill`) |
| **Structure** | Three legs, per [`05`](05-three-module-evidence-run-design.md) §2 — A: rf deepen · B: DR HITL packets · C: numerics hunt |
| **Gates** | P1 (anemia module depth); unblocks nothing on its own — see §8 |
| **Legal** | — (no REG leg; rights questions route to REG-002 as usual) |
| **Status** | **design-ready, NOT launched.** Launch commands in §10 are inert until briefs are approved. |

---

## 1. Ground truth this design is built on

### 1.1 The reported gap, measured from code (2026-07-24)

Hematocrit does not appear anywhere in the executable path:

| Layer | File | Finding |
|---|---|---|
| Input schema | `schemas/patient-input.schema.json` | `cbc` object exposes `hemoglobin`, `mcv`, `rdw`, `rbc`, `wbc`, `anc`, `platelets` — **no `hematocrit`**. `additionalProperties: false`, so `POST /api/v1/assess` **rejects** an `hematocrit` key outright. |
| SPA | `index.html:176` | Hemoglobin is `required`; no Hct input exists. Completion gate reads *"Enter age, hemoglobin, and MCV to assess."* (`index.html:443`) |
| Rules | `modules/anemia/rules.json` | 0 of 91 rules reference hematocrit. |
| Reference ranges | `modules/anemia/reference-ranges.json` | Bands carry `hbLower` / `mcvLower` / `mcvUpper` / `rdwUpper` only. **No Hct interval exists at any age.** |
| Facts | `modules/anemia/facts.anemia.js` | No Hct-derived fact; no MCHC; no MCH. |

The only two traces of hematocrit in the whole repo are **acknowledgements of its absence**:
`data/algorithm-explainers.json:240` marks the corrected-reticulocyte formula
`corrected retic % = retic % × (patient Hct ÷ age-appropriate reference Hct)` as
**"Reference calculation—not executed … this prototype does not calculate it because hematocrit norms
and assay context vary"**, and `docs/clinical/local-profile-charter-contract.md:142` names hematocrit
only when explaining why unit codes are per-analyte.

**Consequence for the user who reported this:** because Hgb is `required`, a clinician working from a
report that leads with a spun crit cannot run the tool *at all*. It is a hard stop, not a degraded
result.

### 1.2 The gap class — "clinician-interpretation substitution" (the *anything else similar* sweep)

The Hct gap is one instance of a repeating pattern. **Where the KB has no sourced pediatric numeric
interval for a red-cell index, the engine asks the clinician for a categorical judgement instead of
computing one.** Six instances, all verified on disk:

| # | Gap | Present state | What it blocks | Needs |
|---|---|---|---|---|
| **G1** | **Hematocrit** | Absent from schema/UI/rules/ranges | Any Hct-led entry path; anemia detection for crit-first reports | Age/sex Hct reference intervals + Hct-based anemia cutoffs, UCUM-typed, with assay-method scoping |
| **G2** | **MCHC** | Not computed anywhere (`Hgb ÷ Hct × 100` — denominator unavailable) | The classic discriminator for the **hereditary-spherocytosis pattern the KB already ranks** (`modules/anemia/candidates.json:165`) | Pediatric MCHC intervals + the HS discriminator threshold + the analyzer-artifact caveats |
| **G3** | **MCH** | Absent from schema entirely | Thalassemia-trait vs IDA discrimination depth | Age/sex MCH intervals |
| **G4** | **RBC count by age** | `cbc.rbc` **is collected numerically**, but `reference-ranges.json` has no `rbcLower`/`rbcUpper` band. Engine derives `rbcRelativelyHigh` from a **clinician dropdown** `cbc.rbcInterpretation` (`facts.anemia.js:235`, `index.html:184`) | Computing the "RBC high-for-age" signal instead of asking for it | Age/sex RBC reference intervals |
| **G5** | **Reticulocyte response** | `reticulocytes.response` is a **clinician categorical** (`low`/`inappropriately-normal`/`appropriate`/`high`); corrected retic % and RPI are explicitly *not executed* | Computed marrow-response classification | Age-appropriate reference Hct (**depends on G1**) + maturation-correction factors + any defensible pediatric RPI cutoff |
| **G6** | **Discriminant indices** (Mentzer `MCV/RBC`, and relatives) | Not present under any name. Inputs (`mcv`, `rbc`) **are already collected** — only the sourced pediatric cutoff is missing | Automated IDA-vs-thalassemia-trait triage support | Pediatric-validated index cutoffs + explicit performance caveats |

Two observations that shape the run:

- **G4 and G6 are the cheapest wins.** Their *inputs are already in the schema*. Only the sourced
  interval/cutoff is missing — no schema change, no UI change, no new data collection burden.
- **G5 depends on G1.** Corrected retic cannot be executed until an age-appropriate reference Hct
  exists. One evidence gap is gating two features.

### 1.3 Prior art in the rf catalog — check before duplicating

Per [`CLAUDE.md`](../../../CLAUDE.md), the catalog was probed before this design was written
(`GET $RF_API_URL/api/catalog/search`). **Relevant material already exists and must be reused, not
rediscovered:**

| Existing run | What it holds that is relevant | What it does **not** hold |
|---|---|---|
| `rf_run_20260719_caliper_pediatric_cbc_reference_intervals_age` (published; 14 source cards, 90 claims / 76 supported) | **Structural** claims about pediatric CBC reference intervals incl. hematocrit and MCHC — e.g. *"Sex partitioning was required for 11 erythrocyte parameters, including RBC, hemoglobin, hematocrit, MCV, and MCHC"*; direction-of-change with age; which parameters need age partitions | **The numbers.** These are partition-structure and direction claims, not UCUM-typed interval values |
| `rf_run_20260717_rf_cbc_001_pediatric_cds_establish` (RF-CBC-001, verified) | The CALIPER bibliographic cards; same sex-partitioning claim | Same — CALIPER's numeric tables are recorded as **paywalled** (see `dr-packets/cbc/chatgpt-dr/attachments.md`) |

**This is the single most important input to the design.** The partition *structure* for pediatric
red-cell indices is already evidenced; what is missing is the **numeric layer**, and it is missing for
a known reason: the CALIPER interval tables are paywalled. RF-ANE-001 must therefore be built as a
**numerics-first** run (§7), not a general discovery sweep — most of the framework-level ground is
already covered.

A catalog probe for **`rule of three` / Hgb↔Hct conversion** returned **no claim-level match** — only
run-title fallbacks. That is a genuine, uncovered question (§4, A6).

### 1.4 The numerics problem, restated for this run

From [`05`](05-three-module-evidence-run-design.md) §1.3 and
`.claude/findings/rights-governance-spec-v1.0-review-findings.md`: of the 13 passages bindable today
(BLOOD 5, WHO 3, CDC 2, BSH 2, FDA 1) **all are `passageFidelity: paraphrase` and numerics-light** —
threshold-bearing passages were quarantined `omits-source-numerics`. The anemia module's own Hgb
thresholds inherit this problem: they trace to `AAP2026_IDA`, whose 7 passages are quarantined
`source-not-independently-retrievable`.

**Design consequence, sharpened for red-cell indices:** an Hct interval that we cannot bind to a
retrievable numeric passage reproduces the exact defect we already have on hemoglobin. Every leg of
this run is optimized for **independently retrievable, UCUM-typed, numeric** passages — a
public-domain source carrying the actual number outranks an authoritative source that we can only
paraphrase.

---

## 2. Scope decision — why this is its own run, and how it deconflicts with `cbc_suite_v1`

**The tension.** Hct/MCHC/MCH/RBC are *CBC analytes*, and `cbc_suite_v1` already has a designed deepen
run ([`05`](05-three-module-evidence-run-design.md) §3.1) whose objective #3 explicitly targets
"CALIPER age-partitioned pediatric CBC reference intervals". Left alone, the two runs would
rediscover the same CALIPER numerics.

**The resolution — split by *consumer*, not by analyte:**

| | `cbc_suite_v1` deepen run (design 05) | **RF-ANE-001** (this run) |
|---|---|---|
| Owns | The **broad** CBC reference-interval sweep across all 11 erythrocyte + leukocyte + platelet parameters; cytopenia branches | The **red-cell-index derived-value substrate** the anemia engine consumes: Hct-based anemia definition, MCHC/MCH discriminators, corrected-retic denominators, discriminant indices |
| Angle overlap | CALIPER numerics hunt | **Consumes** cbc's CALIPER output — does **not** re-run it |
| Rule surface | `modules/cbc_suite_v1/` (unsigned-stub, 4 rules) | `modules/anemia/` (integrity-recorded, 91 rules) |

**Binding deconfliction rules (enforced at launch):**

1. RF-ANE-001 launches with `retrieval_policy: catalog_then_discovery`. The CALIPER structural claims
   from §1.3 must be **reused from the catalog**, never rediscovered.
2. If the `cbc_suite_v1` deepen run has not yet run, RF-ANE-001 **still does not own** the general
   CALIPER table hunt — it files the dependency and proceeds on the angles cbc does not cover (A2, A4,
   A5, A6, A7 in §4 are all anemia-specific).
3. Any interval RF-ANE-001 *does* surface for a shared analyte is written once, tagged for both
   modules. Duplicate claims are a merge defect, not a redundancy benefit.

**Why not simply fold this into the cbc run:** the anemia module is the only `integrity-recorded`
module and the only one with 91 live rules; its evidence lineage (RF-EV-001) is separately tracked and
its rules are the ones a clinician attestation would actually bind. Merging would blur which bundle a
future attestation covers.

---

## 3. Objectives

1. **Establish the pediatric red-cell index reference substrate** — age- and sex-partitioned
   intervals for hematocrit, MCHC, MCH and RBC count, UCUM-typed, with assay/method scoping, each
   bound to an exact retrievable passage.
2. **Establish whether a defensible Hct-based anemia definition exists** for pediatric ages — i.e.
   published Hct cutoffs parallel to the Hgb cutoffs the module already encodes — or evidence that no
   such cutoff is recommended (a **negative finding is a valid, valuable result** here).
3. **Resolve the Hgb↔Hct relationship question** — what the literature actually supports about
   deriving one from the other, and whether any derivation is admissible in a CDS threshold path
   (expected answer: **no** — see §11 R1).
4. **Ground the derived-index discriminators** — MCHC for the hereditary-spherocytosis pattern already
   in `candidates.json`; MCH and discriminant indices for thalassemia-trait triage — with their
   pediatric performance caveats preserved as conflicts, not smoothed.
5. **Capture the assay/method dependence** that makes a naive Hct field unsafe: measured/spun vs
   calculated (`MCV × RBC`) hematocrit, and the analyzer artifacts that spuriously move MCHC.
6. **Capture the corrected-retic/RPI denominators** (age-appropriate reference Hct + maturation
   correction) so G5 becomes executable-or-explicitly-refused rather than silently deferred.

**Explicit non-objectives.** No rules. No thresholds-as-logic. No schema change. No FHIR mapping. No
signed pack. `rf` stops at the verified bundle ([`README`](rf-handoff/README.md) §1).

---

## 4. Research angles

Ordered by value-to-the-reported-gap. Each angle must return numeric, UCUM-typed, retrievable
passages or a **documented evidence gap**.

- **A1 — Pediatric hematocrit reference intervals.** Age- and sex-partitioned, with the partition
  boundaries the source actually used (do not re-band). Units: `%` or `L/L` — record verbatim.
- **A2 — Hct-based anemia definition in pediatrics.** Does any authoritative body define pediatric
  anaemia by hematocrit (rather than only hemoglobin)? Cover WHO, CDC/US federal, AAP, and pediatric
  hematology societies. **A well-evidenced "no" is a deliverable**, and materially changes the product
  answer to the user's feedback.
- **A3 — Measured vs calculated hematocrit.** Spun/microhematocrit vs analyzer-calculated
  (`MCV × RBC`); plasma-trapping; the magnitude and direction of disagreement; whether reference
  intervals are method-specific. Feeds the required `assay/method` field.
- **A4 — MCHC in pediatrics.** Reference intervals; the hereditary-spherocytosis discriminator
  (including MCHC-based and MCHC/RDW-combined approaches) with reported performance; and the
  **spurious-MCHC** artifact list (cold agglutinins, lipemia, in-vitro hemolysis, hyperlipidemia) that
  any MCHC rule must fail closed on.
- **A5 — MCH and discriminant indices.** Pediatric MCH intervals; Mentzer and comparable indices for
  IDA vs thalassemia trait — **specifically their pediatric validation and their published failure
  rates**. Conflicting performance estimates must survive as conflicts.
- **A6 — The Hgb↔Hct relationship.** What is actually published about the "rule of three"
  (`Hct ≈ 3 × Hgb`) — its provenance, its stated validity conditions, where it fails (microcytosis,
  hemolysis, abnormal indices), and whether any body endorses it for interpretation as opposed to
  laboratory QC. Catalog probe found **nothing**; this is uncovered ground.
- **A7 — Corrected reticulocyte / RPI denominators.** Age-appropriate reference Hct values used in the
  correction; published maturation-correction factors; whether any pediatric RPI cutoff has support.
  Directly targets the `data/algorithm-explainers.json` "not executed" admission.
- **A8 — Age/sex RBC count intervals** (closes G4 — inputs already collected).
- **A9 — Local-range precedence and unit normalization** for these analytes, mirroring the
  `cbc_suite_v1` committed decision — `%` vs `L/L` for Hct is a real unit trap.
- **A10 — Rights/retrievability status** of every numeric carrier found (feeds §7 and REG-002).

---

## 5. Leg A — rf deepen run

Mechanism per [`05`](05-three-module-evidence-run-design.md) §2 Leg A. Deltas specific to RF-ANE-001:

- **Base bundle:** RF-EV-001 (`rf_run_20260717_rf_ev_001_pediatric_cds_backfill`). RF-EV-001 was a
  *locator backfill* over the 6 existing anemia sources — it discovered nothing new, so unlike the CBC
  case there is **little existing anemia discovery to reuse**; the reuse leverage here is the CALIPER
  material in §1.3, which lives under other runs. Launch with `retrieval_policy:
  catalog_then_discovery` **and an explicit cross-run catalog scope**, or the CALIPER reuse will not
  happen.
- **Card contract:** every source card carries the `pediatric_cds` extension
  (population / assay+method / threshold+UCUM / lifecycle) — the **EF-WP1** converter-eligibility gate.
  For this run the **assay/method field is load-bearing, not ceremonial** (A3): an Hct interval without
  its measurement method is not usable.
- **Population discipline:** the anemia module's scope is 6 months to <18 years. Intervals for
  neonates/young infants are **captured and scope-flagged**, never silently applied.
- **Output:** an extended verified bundle on the RF-EV-001 lineage.

---

## 6. Leg B — DR HITL packets (owner-run)

Three packets under [`dr-packets/anemia/`](dr-packets/anemia/), following the established division of
labor and trust invariants in [`dr-packets/README.md`](dr-packets/README.md):

| Provider | Role | Primary deliverable for RF-ANE-001 |
|---|---|---|
| **perplexity** | SOURCE-GATHERING | Ranked citation list of pediatric red-cell-index reference-interval carriers, **DOI/URL + year + license/access status**, prioritizing openly-retrievable numeric carriers |
| **chatgpt-dr** | STRUCTURED EXTRACTION | The **interval table**: analyte → age band → sex → lower/upper → UCUM unit → method → source. Plus the discriminator rows (MCHC/HS, MCH, indices) |
| **gemini-dr** | RECENCY + BREADTH | Newest guideline movement on anaemia definitions (incl. whether any body has moved on Hct), and adjacent-domain signals for future modules |

Trust invariant, unchanged and absolute: **provider prose is `platform_synthesis` → candidates only,
never verified evidence.** Only rf's verifier assigns `verified`, via exact-passage binding.

---

## 7. Leg C — numerics / retrievability hunt

The decisive leg for this run, because §1.3 shows the framework layer is largely covered and the
**numbers** are what is missing. Ranked by license, per [`05`](05-three-module-evidence-run-design.md)
§2 Leg C:

1. **Public-domain first (US federal / WHO).** US federal publications carrying pediatric hematology
   cutoffs — CDC iron-deficiency recommendations and NHANES-derived hematology references are the
   highest-value leads for **Hct cutoffs specifically**, because US federal work is public domain and
   historically reported Hct alongside Hgb. **These are leads to verify, not established facts** —
   the run must confirm what each actually contains and at what ages.
2. **Open-license next.** Open-access pediatric reference-interval papers (including the open-access
   pediatric RI work already surfaced in the catalog), PMC-deposited versions, open CALIPER
   supplements or the public CALIPER database if the numeric tables are reachable there.
3. **Raw public data — with a hard caveat.** NHANES public microdata could support *deriving*
   percentiles. **A percentile we compute ourselves is an implementation proposal, never a
   source-supported threshold**, and must be classified as such. Recording this route as a fallback is
   in scope; treating its output as evidence is not.
4. **Quarantine, don't paraphrase around.** Paywalled threshold tables (CALIPER commercial versions,
   AAP subscription content) get an `evidence-assertion` with `exactPassage: null` +
   `exactPassageSha256` + precise locator, flagged to the licensing track (**REG-002**) — *not*
   re-paraphrased into a numerics-stripped survivor. This is the specific mistake that produced the
   current 0/91 state.

---

## 8. What comes back — and what it does *not* unblock

```
RF-ANE-001 verified bundle
        │
        │  rf STOPS HERE  ────────────────────────────── the seam
        ▼
authoring-decisions.yaml (anemia)   ← human clinician decisions, out of this run's scope
        ▼
rf-bundle-to-kb-pack converter → rule *proposals* + tests
        ▼
named credentialed clinician attests each rule to an exact passage   ← the real gate
        ▼
schema/UI change (an Hct field) + signed release
```

**State this plainly to anyone tracking the user's feedback:** a perfect RF-ANE-001 does **not** ship a
hematocrit field. It removes the *evidence* blocker. The remaining blockers are the ones
[`CLAUDE.md`](../../../CLAUDE.md) already names — `modules/anemia/authoring-decisions.yaml` decisions
are `drafted_pending_human_approval`, `approvedBy[]` is schema-forced empty, and binding requires a
named credentialed human per rule. No AI output, including this run's, substitutes for that.

**Interim product action, independent of this run** (does not need evidence, should not wait for it):
the completion gate at `index.html:443` should say *why* hemoglobin specifically is required and state
that hematocrit is not yet supported, instead of silently refusing. Tracked separately from RF-ANE-001.

---

## 9. Acceptance gates

Inherits [`02`](02-evidence-foundry-on-research-foundry.md) §3.9 in full. RF-ANE-001-specific additions:

- [ ] Every interval claim carries **analyte + age band + sex + value + UCUM unit + measurement
      method** — a claim missing the method is rejected, not downgraded (A3).
- [ ] Objective #2 (A2) returns either sourced pediatric Hct anaemia cutoffs **or an explicit,
      sourced negative finding**. "Not found" without a documented search is not acceptance.
- [ ] Objective #3 (A6) returns a sourced position on Hgb↔Hct derivation, explicitly classified
      `assertion` vs `inference`.
- [ ] No claim derived by our own computation over raw data is marked source-supported (§7 item 3).
- [ ] CALIPER structural claims from §1.3 are **referenced from the catalog**, not re-extracted as new
      claims (§2 deconfliction rule 1).
- [ ] Every quarantined paywalled numeric carrier has locator + SHA + REG-002 flag, and **zero**
      numerics-stripped paraphrase survivors were created (§7 item 4).
- [ ] `verification.yaml.passed: true`, `exit_code: 0`, no unsupported material claims.
- [ ] Conflicts (e.g. competing discriminant-index performance estimates) remain conflicts at handoff.

---

## 10. Sequencing & launch commands

**DO NOT run until the briefs in §4 are approved.**

```bash
# Source rf API creds (read; never inline the token; never hand to external delegates)
set -a; . ~/.config/research-foundry/serve.env; set +a

# P0 — catalog probe (re-run at launch; §1.3 was probed 2026-07-24)
for q in "pediatric hematocrit reference interval" "MCHC hereditary spherocytosis" \
         "mean corpuscular hemoglobin pediatric" "reticulocyte production index pediatric"; do
  curl -s "$RF_API_URL/api/catalog/search?q=$(printf '%s' "$q" | tr ' ' '+')" \
    -H "Authorization: Bearer $RF_TOKEN_AGENT"
done

# P1 — launch Leg A via op (classify → plan gate → dispatch to rf). Bounded deepen pass, route
#      research, tier T2. POST /api/runs scaffolds only (capture→triage→plan); the Path-B discovery
#      swarm is driven by rf-run-execute.js with
#      cwd=/Users/miethe/dev/homelab/development/research-foundry.
op research "RF-ANE-001: pediatric red-cell index reference substrate (hematocrit, MCHC, MCH, RBC
  intervals, corrected-retic denominators) for the anemia module; deepen RF-EV-001;
  retrieval_policy=catalog_then_discovery; numerics-first, retrievability-ranked" --tier 2

# P2 — owner runs the 3 DR packets, returns external_research_handoff/v1 directories
#   rf intake external-report docs/project_plans/expansion/dr-packets/anemia/<provider> \
#     --workspace <rf_workspace_id> --run <ane_run_id>     # → platform_synthesis, candidates only

# P3 — gpt-5.6-terra passage-fidelity / numeric audit (design 05 §5) BEFORE bundle merge
```

**Order:** P0 probe → P1 Leg A launch **concurrent with** P2 packet hand-off (Legs A/B/C run
concurrently and converge at bundle merge) → numeric audit → `rf verify` → bundle.

**Dependency to file at launch:** if the `cbc_suite_v1` deepen run is still pending, record RF-ANE-001's
consumption of its CALIPER numerics output as an open dependency rather than absorbing that hunt (§2).

---

## 11. Risks & known traps

- **R1 — The "rule of three" temptation.** The single most likely bad outcome is that this run returns
  `Hct ≈ 3 × Hgb` and someone implements an Hct input that back-calculates hemoglobin. That would put
  an **estimated** value into a threshold path, defeating the entire evidence-linkage premise, and it
  fails precisely in the anemic microcytic populations the module exists to triage. The relationship is
  in scope **as a research question** (A6); its use as a conversion in the decision path is
  out of scope by design.
- **R2 — Re-creating the paraphrase defect.** Paraphrasing a paywalled interval table into a
  numerics-light survivor is how 0/91 happened. §7 item 4 is non-negotiable.
- **R3 — Duplicate discovery with `cbc_suite_v1`.** Mitigated by §2's three binding rules; the failure
  mode is silent (two bundles, same claim, divergent phrasing), so check at merge.
- **R4 — Method-blind intervals.** An Hct interval without its measurement method (A3) is worse than
  no interval, because it looks usable. Gate in §9 rejects rather than downgrades.
- **R5 — Scope creep into `cbc_suite_v1` territory.** The cytopenia branches belong to the CBC runs.
  RF-ANE-001 stops at red-cell indices.
- **R6 — Mistaking this run for a fix.** §8 exists to prevent the report of "hematocrit is being
  addressed" being read as "hematocrit is coming". The evidence blocker and the attestation blocker are
  separate, and only the first is in scope here.

---

## Appendix — cross-references

| Context | Path |
|---|---|
| Three-module run design (structure this mirrors) | [`05-three-module-evidence-run-design.md`](05-three-module-evidence-run-design.md) |
| Evidence Foundry seam, run template, output contract | [`02-evidence-foundry-on-research-foundry.md`](02-evidence-foundry-on-research-foundry.md) |
| rf handoff — registry, output contract §3, governance §7 | [`rf-handoff/README.md`](rf-handoff/README.md) |
| rf handoff — completion record for the 7 verified runs | [`rf-handoff/RESULTS.md`](rf-handoff/RESULTS.md) |
| DR packet spec + trust invariants | [`dr-packets/README.md`](dr-packets/README.md) |
| Rights/grounding findings (the 13 bindable passages) | `.claude/findings/rights-governance-spec-v1.0-review-findings.md` |
| Hard clinical guardrails | [`../../../CLAUDE.md`](../../../CLAUDE.md) |
| Anemia module KB | `modules/anemia/{rules,candidates,evidence,reference-ranges}.json` |
