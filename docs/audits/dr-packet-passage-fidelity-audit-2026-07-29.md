# DR packet passage-fidelity and numeric audit — 2026-07-29

The design 05 §5 gate ("second-opinion passage-fidelity audit — `codex` / gpt-5.6-terra"), run against
the 4 numerics-heavy DR extractions before bundle merge. Design 05 §8 P3 makes "audit clean" the
condition for advancing to merge.

**Gate result: NOT CLEAN. 13 high, 14 medium, 0 low across 4 packets. Merge into the bundles must not
proceed on the first-pass extractions.**

## Procedure (established here, because §5 does not specify one)

Design 05 §5 is a one-row routing-table entry naming the lane and model; it defines no procedure,
inputs, pass criteria, artifact, or output path. `rf-handoff/RESULTS.md` §4 further records that the
"gpt-5.6 caught 3 unit/enumeration gaps" precedent is *artifact-backed narrative, not an
independently reproducible audit trail* — there is no canonical audit script to imitate. This run
therefore establishes the procedure, shaped after the one real precedent
(`docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md`).

The audit is deliberately **complementary to, not overlapping with**, the deterministic gate. Before
it runs, `tools/dr-packet/verify_fidelity.py` has already proven for every record that each
`quote`/`selector` is a verbatim substring of the report, each `value` appears literally in it, each
DOI/URL appears in it, ids are well-formed and prefix-correct, and every `source_ref` resolves. The
auditor is told that set is settled and is scoped to the six defect classes a substring match cannot
detect:

1. semantic drift (modality strengthening, added claims, dropped qualifiers, scope widening)
2. unit / rescale errors (`1.5 ×10⁹/L` → `1500`, `mg/mg` vs `mg/mmol`, percent vs fraction)
3. misclassification (`assertion` vs `inference` vs `annotation`)
4. boundary pairing (mispaired, swapped, orphaned bounds; qualifier_band identity loss)
5. coverage (report rows/sources absent from the extraction)
6. conflict preservation (silently reconciled or collapsed conflicts)

- Lane: `codex` / `gpt-5.6-terra`, `model_reasoning_effort=high`, `--sandbox read-only`.
- Inputs: the extraction JSON and its source report. One audit per packet, run independently.
- Raw outputs: `build/audit/<packet>.audit.md`.
- Audit made no file changes.

## Verdicts

| Packet | High | Medium | Low |
|---|---:|---:|---:|
| `anemia-chatgpt` | 3 | 3 | 0 |
| `cbc-chatgpt` | 1 | 3 | 0 |
| `growth-chatgpt` | 3 | 5 | 0 |
| `kidney-chatgpt` | 6 | 3 | 0 |
| **Total** | **13** | **14** | **0** |

## The single most important finding: the defect was in the contract, not the extractions

Six of the 13 HIGH findings are one root cause, and it is a **defect in
`tools/dr-packet/EXTRACTION-CONTRACT.md` as originally written**, not delegate error. The contract
instructed that a range be split into two candidates (`lower_bound` / `upper_bound`) sharing a
`qualifier_band`. Applied to *compound* criteria, that rule destroys the criterion by detaching the
qualifying condition from its number:

| Report says | First-pass extraction produced |
|---|---|
| SCr increase `≥0.3 mg/dL` **within 48 h** | `0.3 mg/dL` threshold; the `48 h` window absent entirely |
| GFR `<60` **for ≥3 months** | `<60` and `≥3 months` as two records, both with blank `qualifier_band` |
| K `>6.0` **on 2 separate occasions** | `>6.0` and `2 occasions` as two records, unlinked |
| `≥95th percentile` **+ 12 mmHg** | `95` and `12` as detached standalone boundaries |
| Elevated BP `120/<80` to `129/<80` | four bounds all sharing `qualifier_band: "Elevated"` — which **permits the invalid 120–80 pairing**, a systolic paired with a diastolic |

A threshold stripped of its qualifying condition is not a weaker version of the source's claim; it is
a **different claim the source never made**. In a clinical KB that is the exact failure mode the
project's guardrails exist to prevent. It was caught here because a second, differently-scoped gate
looked for it — the deterministic checker could not, since every individual number was faithfully
transcribed.

Two durable fixes were made, so this class cannot recur silently:

1. **Contract**: bounds now require a non-empty `qualifier_band`; compound criteria must stay atomic;
   a one-sided threshold is `upper_threshold`, never half an interval; systolic and diastolic may
   never share a band; non-portability qualifiers (method/analyzer, chart family, serial-measurement
   requirements, companion criteria, fallback-only status) must be preserved.
2. **Mechanical gate**: `verify_fidelity.py` now emits HIGH
   `unpaired_bound_without_qualifier` for any `lower_bound`/`upper_bound` with a blank
   `qualifier_band`. Run against the first-pass extractions it flagged **13 records, all in
   `kidney-chatgpt`** — independently localizing the audit's finding to the same packet.

**And then the repair pass proved one gate is not enough.** Fixing the blank bands, it gave a 12-hour
urine-output bound the *stage-2 creatinine-multiplier* band — producing a "12 hours to 2 × baseline"
interval that the new gate did **not** catch, because both records now had non-empty bands. A *wrong*
band corrupts exactly as a blank one does. The gate was therefore extended with cross-record checks
(`band_unit_mismatch`, `band_duplicate_bound`, `band_bounds_inverted`, `band_orphan_bound`), which
caught that regression **and** a pre-existing defect neither this audit nor the first gate had found:
the KDIGO albuminuria `A2` band grouping `mg/g` and `mg/mmol` bounds into one nonsense interval
(`kid_gpt_c075–c078`, 2 lower and 2 upper bounds under a single band `"A2"`).

Three checks, three different defect classes, and the fix for the first created the second. That is
the durable lesson from this gate, more than any individual finding.

## What the audit confirmed as correct

Worth recording, because it says where the pipeline is trustworthy and where it is not:

- **Zero unit / rescale errors** in any packet — 118 kidney, 40 growth, 33 cbc and all anemia numeric
  records preserve the report's physical quantity and source-native unit, including `L/L` hematocrit,
  `g/L` vs `g/dL` MCHC, `×10⁹/L` counts, `mg/mg` vs `mg/mmol`, percentages and dimensionless indices.
- **Full coverage**: every candidate-table row and every literally-cited source is represented in all
  four packets (cbc 27/27 rows + 11 sources; growth 15 sources + 42 threshold components; kidney 41
  rows + 12 literal locators across 18 source records; anemia all Table 1/2 rows + 8 CDC cutoffs).
- **Derived rows stayed `inference`** where the report marked them derived — 11 CALIPER
  boundary-derived rows in cbc, 3 in kidney — rather than being promoted to `assertion`.
- **Named conflicts survived unreconciled** in cbc (both severe-eosinophilia thresholds) and kidney
  (eGFR screening vs persistent CKD; pediatric vs mixed-population nephrotic UPCR; uACR vs UPCR; the
  mirrored albuminuria-format conflict).
- **Anemia's 16 CALIPER intervals were correctly paired** with analyte, age band, sex and DxH 900
  method retained — the same construct kidney got wrong, done right, which is why the fix is a
  contract/gate change rather than a model swap.

## Findings

Verbatim per-packet findings, most severe first, are preserved in `build/audit/<packet>.audit.md`.
Summarized by class:

**HIGH (13)**

- *Compound-criterion fragmentation and bound-pairing loss* (kidney, 6): the five rows tabulated
  above plus sex-specific U25 eGFR coefficient bands (`kid_gpt_c003–c006`) all carrying blank
  `qualifier_band`, permitting male/female coefficient cross-pairing.
- *Dropped non-portability qualifiers* (anemia 1, cbc 1, growth 2): hereditary-spherocytosis MCHC/RDW
  thresholds losing their aperture-impedance method (`ane_gpt_c33–c37`); CALIPER interval records
  losing the DxH 900 analyzer, fallback-only status and local-range precedence
  (`cbc_gpt_c11–c17, c24–c25, c29–c32`); height-velocity thresholds losing "serial measurements ≥6
  months apart" (`gro_gpt_c09–c12`); malnutrition velocity deficits losing "two or more data points"
  (`gro_gpt_c36–c38`).
- *Sourced claim buried as annotation / conflict suppressed* (anemia 2): age-adjusted RPI's
  no-agreement finding (`ane_gpt_c49–c51`) and the cryoglobulin/hyper-WBC fail-closed claim
  (`ane_gpt_c42`) classified `annotation` where the report classifies them `assertion`.
- *Omitted alternate criterion* (growth 1, kidney 1): the `>2 SD` alternative to `>10 cm`
  (`gro_gpt_c05`); the "or symptomatic" disjunct on the `<130 mmol/L` hyponatremia trigger
  (`kid_gpt_c112`).

**MEDIUM (14)** — competing MCHC/RDW cutoffs and Mentzer performance estimates not marked
`contradicts` (anemia); an uncited NHANES companion source silently dropped (anemia); companion
criteria omitted so DIC/aplastic-anemia component thresholds read as self-sufficient, and monocytosis
scope widened to `population: "all"` despite a not-pediatric-specific caveat (cbc); a sourced
competing eosinophilia value classified `annotation` (cbc); parental-height prerequisites, UK-WHO
chart-space non-transferability, attained-measurement/chart-family constraints, OFC age/sex and
Nellhaus older-child chart selection, and BMI/chart age-band identifiers dropped (growth); remaining
blank-qualifier interval pairs, a `first-morning UPCR` qualifier attached to an unrelated eGFR
coefficient with the real threshold orphaned, and hyperkalemia's two-occasion requirement unlinked
(kidney).

## Disposition

The 13 HIGH findings were fed back as a bounded, report-grounded repair pass (same lane), then
re-checked deterministically; the residual 6 band assignments were set deterministically from the
report's own text rather than by a further model pass. **All 7 packets now pass the deterministic gate
with 0 HIGH findings**, and the corrected packets were re-imported (see the execution record §3a).
The 14 MEDIUM findings are recorded here for the merge step and are **not** resolved by this run.

This audit was not re-run against the repaired extractions, so "0 HIGH" is the *deterministic* gate's
verdict, not a second cross-model clearance. A re-audit before bundle merge is the honest next step.

**No finding in this audit affected a verified claim, a rule, a reference range, or an attestation** —
every record it concerns is a quarantined candidate in the interchange store (0 of 429 actions reached
`verified`; see `docs/project_plans/expansion/07-dr-packet-ingest-p3-execution-record.md` §3). The
audit's value is that it caught a claim-corrupting contract defect while the blast radius was still
zero.

VERDICT: DISCREPANCIES FOUND — 13 high, 14 medium, 0 low
Audit made no file changes.
