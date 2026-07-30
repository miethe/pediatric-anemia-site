---
title: "DR packet ingest — design implications for the app and module packages"
description: "The non-clinical, code-verified design consequences of the 7 returned DR reports: the shipped reference-range shape cannot express measurement method (which design 06 §9 makes a rejection criterion), compound clinical criteria must not be decomposed into numeric atoms, and conflicts need a first-class representation. No rule, threshold, or clinical judgment is proposed here."
status: complete
created: 2026-07-29
owner: Nick Miethe
project: pediatric-cds-platform
companion: "07-dr-packet-ingest-p3-execution-record.md"
---

# DR packet ingest — design implications

> **What this document is not.** It proposes no rule, no threshold, no clinical interpretation, and no
> change to any `modules/<id>/*.json`. Every item below is a *structural* finding about whether this
> codebase can faithfully hold the kind of evidence these reports contain — the sort of question that
> is answered by reading a schema, not by clinical judgment. Each is verified against current-tree
> code, cited inline.

## 1. The shipped reference-range shape cannot express measurement method

This is the most consequential finding, and it blocks the anemia work independently of evidence.

**What the evidence carries.** Design 06 §6 defines the anemia interval deliverable as *analyte → age
band → sex → lower/upper → UCUM unit → **method** → source*, and §9 makes the method a hard gate: "a
claim missing the method is **rejected, not downgraded**." The returned `anemia/chatgpt` report
delivers exactly that, method included (Beckman Coulter DxH 900 for the CALIPER intervals; aperture
impedance for the hereditary-spherocytosis MCHC thresholds).

**What the code can hold.** `schemas/reference-range.schema.json` is a `oneOf` over two branches:

| Branch | Can express method? | Used by |
|---|---|---|
| `$defs/builtInReferenceRanges` | **No** | `anemia`, `cbc_suite_v1`, `kidney_suite_v1`, `growth_suite_v1` — all 4 |
| `$defs/localReferenceIntervalProfile` | **Yes** (`applicability.analyzer.method`) | **zero modules** |

Verified: the only `method`/`analyzer` keys in the whole schema are at
`$defs/applicability/properties/analyzer[/properties/method]`, and the single `#/$defs/applicability`
reference is from `localReferenceIntervalProfile`. Every shipped module's `reference-ranges.json`
top-level keys are the built-in shape (`source`, `units`, `scope`, `ranges`), and its range items carry
only `minMonths`, `maxMonthsExclusive`, `label`, `units`, `female`, `male` — no method, no per-band
source pointer, no UCUM code.

**The bind.** The unused branch is the one that fits: `$defs/interval` requires exactly
`analyte, analyteCode, ageBand, sex, low, high, unitCode, assertion` — a near-perfect match for the DR
interval table, UCUM included. But `localReferenceIntervalProfile` also requires `attestation`,
`authority`, and `provenance`, so it is gated on the same human sign-off everything else is. Meanwhile
the branch actually in use would **silently drop the method** — turning a method-qualified interval
into a method-blind one, which is precisely what design 06 §9 says must be rejected rather than
downgraded, and what its risk **R4** names.

**Implication.** Landing RF-ANE-001's interval substrate is not only an evidence problem; it needs a
schema decision first: extend `builtInReferenceRanges` with a method (and ideally per-band source and
UCUM) field, or migrate the anemia module onto `localReferenceIntervalProfile` and accept its
attestation requirements. **Neither is an evidence task, and neither is blocked on the licensing
track** — this is available work today. Until it is done, a perfect RF-ANE-001 has nowhere faithful to
land.

Related, and worth pairing with any such change:
`.claude/findings/rights-governance-spec-v1.0-review-findings.md` §4 records that the
`reference-ranges.json → deriveFacts() → rules` channel is **not** covered by passage-level rights
gating at all, so a rules-only sweep misses it. Any reference-range schema work should close that gap
in the same pass.

## 2. Compound clinical criteria must not be decomposed into numeric atoms

The §5 audit (`docs/audits/dr-packet-passage-fidelity-audit-2026-07-29.md`) found that decomposing a
range into independent bound records destroys *compound* criteria — the ones where a qualifying
condition is part of the threshold:

- `SCr increase ≥0.3 mg/dL` **within 48 h**
- `GFR <60` **for ≥3 months**
- `K >6.0` **on 2 separate occasions**
- `≥95th percentile` **+ 12 mmHg**
- height velocity below a cutoff, **on two or more measurements ≥6 months apart**

Detaching the condition does not weaken the claim; it produces **a different claim the source never
made**. In the first pass this also allowed a systolic `120` and a diastolic `80` to share a
qualifier band, i.e. to be read as one interval.

This was a defect in the ingest contract, now fixed in two places
(`tools/dr-packet/EXTRACTION-CONTRACT.md`, plus a mechanical
`unpaired_bound_without_qualifier` gate in `verify_fidelity.py`). But the lesson generalizes past this
tool, and is the design-relevant part:

**Implication for the rule DSL and any future converter drafting.** The existing `when` DSL
(`all`/`any`/`not` over `{fact, op, value}`, per `schemas/rule.schema.json`) *can* express these
compounds — `all: [{SCr delta ≥0.3}, {window ≤48h}]` — so the DSL is not the limitation. The risk is
upstream, at the point where evidence becomes a candidate: any pipeline that stores a threshold
number separately from its qualifying condition will hand the rule author a number that looks
self-sufficient and is not. Whatever eventually converts verified claims into rule proposals must
carry the qualifying condition **in the same record as the number**, and should refuse a numeric
candidate whose qualifying condition is unbound. The 18 `basis_incomplete` quarantines in this run
show rf already fails closed on a candidate with no basis; the analogous check for *partial* basis
does not exist.

## 3. Conflicts need a first-class representation, not a note

The reports carry genuine, deliberately unreconciled numeric conflicts that must survive into any
downstream artifact:

- Nephrotic-range spot UPCR: **>350 mg/mmol** (chatgpt, paywalled review) vs **>200 mg/mmol**
  (perplexity, Ashford NHS) — two providers, one concept, two numbers.
- Severe eosinophilia: **>4.5 ×10⁹/L** vs **≥5.0 ×10⁹/L**.
- MCHC hereditary-spherocytosis cutoffs: a cluster of **>35 g/dL**, **34.5 g/dL**, **≥36.0 g/dL**,
  **>355 g/L**, **>360 g/L** across cohorts and methods.
- Pediatric eGFR `<90` screening flag vs `<60 for ≥3 months` chronic-CKD criterion — the kidney report
  says explicitly "do not collapse", in both directions.

Design 05 §7 already states the intended seam behavior (`mixed`/`contradicted` claims become
*conflict-visible objects only*, never a single fact), and the converter enforces a
conflict-visibility guard (seam invariant 8 — `propose` fails closed if a drafted rule proposal is
grounded solely by a mixed/contradicted claim). The interchange layer's `relation: contradicts` field
carries the signal in.

**Implication.** The representation exists at the two ends but there is no *module-package* shape for
"this threshold is contested, here are the competing values and their scopes." `candidates.json`
entries have `summary` and `defaultNextSteps` prose; nothing structural. Since the platform's honesty
posture depends on never silently picking a winner, a contested-threshold shape is worth designing
before the first contested threshold reaches a module — not after.

## 4. Access status is not license, and the distinction is load-bearing

The `anemia/perplexity` report is the only one that reports access status and license as separate
columns, and it flags the distinction as the single most load-bearing one in its brief:
**free-to-read ≠ open-access**. The interchange schema only has `access_status`
(`open-access | public-domain | paywalled | unknown`) with no license field, so "freely accessible,
license unstated" has to map to `unknown` — and 20 of 120 source records quarantined at
`rights_metadata_missing` on import, the second-largest quarantine reason.

By contrast, this repo's own `schemas/evidence.schema.json` *does* model the distinction properly:
`license.status` (6 values incl. `us_federal_government_work`), `access_basis` (13 values), and a
`terms` object with per-right permissions.

**Implication.** The richer model is downstream of the lossier one. When a DR-sourced claim eventually
reaches `evidence.json`, its license fields cannot be recovered from the interchange record — they
must come from the report or from rf's own rights work. Worth capturing the license string in the
packet's `extensions` at extraction time rather than discovering it is gone later. (This run did not
do so; it is a recommended contract addition, not a defect in the imported data.)

## 5. What these reports say about the app surface — deliberately, nothing yet

Design 06 §8 is explicit that "a perfect RF-ANE-001 does **not** ship a hematocrit field. It removes
the evidence blocker." That holds after this run, and more strongly than before: the anemia interval
substrate is not verified (§3 of the execution record), and even if it were, item 1 above says there
is no faithful place to put it.

So there is **no app-surface change proposed by this run** — no new input field, no new panel, no new
output. Any UI work claiming to be "addressing hematocrit" on the strength of this ingest would be
misrepresenting it, which is design 06's own risk **R6**.
