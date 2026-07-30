# Extraction contract — provider DR report → `external_research_handoff/v1` packet

The input is one owner-run provider deep-research report (markdown prose + tables). The output is
one JSON file that `build_packet.py` turns into a conformant rf handoff packet. This file is the
whole contract; a delegate needs nothing else.

## Non-negotiable rules

1. **Transcribe, never compute, never infer, never improve.** Every number you emit must appear in
   the report's own bytes. Do not convert units, do not rescale (`1.5 ×10⁹/L` stays `1.5`, never
   `1500`), do not average, do not round, do not fill a blank cell from your own knowledge. A
   deterministic checker (`verify_fidelity.py`) rejects any value or quote that is not literally in
   the report, so an invented number fails the build — it does not slip through.
2. **Every `quote` must be a verbatim substring of the report**, copy-pasted. Whitespace and
   dash/quote variants are tolerated; a changed digit or word is not.
3. **A numeric with no source is a defect.** If a report row states a threshold but cites nothing,
   still emit it — with `"value"` set, `"source_refs": []`, and `"classification": "annotation"` —
   and put the report's own words about the missing citation in `statement`. Do not invent a citation
   to satisfy the schema. (The kidney report's two explicit `NO CITATION — do not use` rows are
   exactly this case and must survive as annotations.)
4. **Preserve conflicts; never reconcile them.** If the report gives two different values for the
   same concept, emit both as separate candidates and set `"relation": "contradicts"` on the one the
   report itself flags as conflicting. Never pick a winner.
5. **Preserve the report's own classification.** If the report marks a row `inference` (e.g. a
   threshold derived from a reference-interval boundary rather than stated as a disease cutoff), it
   is `"classification": "inference"`, not `assertion`.
6. **Do not restate numerics from a source the report marks paywalled** beyond what the report
   itself already prints. If the report printed it, transcribing it is faithful reporting of the
   report; if it did not, you must not supply it.

## Classification — pick exactly one

| Value | Use when |
|---|---|
| `assertion` | The report presents this as a claim a cited source directly states. |
| `inference` | The report itself says it derived//interpolated this, or marks it as derived from a reference-interval boundary rather than stated by the source. |
| `annotation` | A commentary, caveat, gap, scope note, deprecation warning, or a threshold with no citation. |

## `relation` — `supports` \| `contradicts` \| `context` \| `unknown` \| `null`

Use `contradicts` only where the report names a conflict. Use `context` for caveats and scope notes.

## `access_status` — exactly one of `open-access` \| `public-domain` \| `paywalled` \| `unknown`

Map the report's own words. A US federal government work → `public-domain`. "Freely accessible but
license unstated" → `unknown`, **not** `open-access` (free-to-read is not open-access; the anemia
perplexity report makes this distinction load-bearing). Only use `open-access` where the report says
open-access or names a license permitting reuse.

## Output JSON shape

```json
{
  "module": "anemia",
  "provider": "chatgpt",
  "producer_profile": "chatgpt",
  "declared_sensitivity": "personal",
  "created_at": "2026-07-29T00:00:00Z",
  "research_question": "<the report's own stated question, or the packet objective it answers>",
  "task_context": null,
  "vendor_reference": {},
  "sources": [
    {
      "source_id": "ane_gpt_s01",
      "title": "<as printed in the report>",
      "doi": "10.1093/ajcp/aqaa059",
      "url": "https://academic.oup.com/ajcp/article/154/3/330/5860205",
      "publication_year": 2020,
      "access_status": "paywalled",
      "authors": ["Tahmasebi H"],
      "publisher": null,
      "accessed_at": null,
      "extensions": {"report_label": "<the exact label/row id the report used>"}
    }
  ],
  "candidates": [
    {
      "candidate_id": "ane_gpt_c01",
      "statement": "<one sentence, in the report's own terms, of what this row claims>",
      "value": 35,
      "unit": "g/dL",
      "direction": "upper_threshold",
      "population": "pediatric >12 months",
      "qualifier_band": "MCHC discriminator for hereditary spherocytosis",
      "source_refs": ["ane_gpt_s01"],
      "relation": "supports",
      "classification": "assertion",
      "quote": "<verbatim substring of report.md carrying this number>",
      "selector_value": "<shorter verbatim anchor substring, or null>",
      "producer_confidence": null,
      "extensions": {"report_label": "<row id/label as printed>"}
    }
  ]
}
```

### Field notes

- `source_id` / `candidate_id`: `^[A-Za-z0-9_.:-]+$`, ≤128 chars, unique within the packet. Use the
  prefix given in your task (e.g. `ane_gpt_`) so ids stay unique when packets are compared.
- `value`: a single JSON number, or `null`. **A range is two candidates**, one for the lower bound
  (`direction: "lower_bound"`) and one for the upper (`direction: "upper_bound"`), sharing an
  identical `qualifier_band` that names the analyte + age band + sex. Never put `"11.2-14.1"` in
  `value`.
  - **Every bound MUST carry a non-empty `qualifier_band`** — this is a hard, mechanically-checked
    gate. A bound with a blank band is unpairable: nothing records what it bounds, so two unrelated
    numbers can later be read as one interval. The first run of this pipeline produced exactly that
    failure, pairing a systolic `120` with a diastolic `80` into a nonsense "interval".
  - Bounds of *different* intervals must NOT share a band. In particular, never let a systolic and a
    diastolic value share one.
  - **A one-sided threshold is not half an interval.** Diastolic `<80` is
    `direction: "upper_threshold"`, not `upper_bound`.
- **Compound criteria stay atomic — do not split them into numeric fragments.** `SCr increase
  ≥0.3 mg/dL *within 48 h*`, `GFR <60 *for ≥3 months*`, `K >6.0 *on 2 separate occasions*`, and
  `≥95th percentile *+ 12 mmHg*` are each ONE criterion. Splitting the qualifying condition away from
  the number destroys the criterion — the threshold silently becomes something the source never said.
  Put the whole criterion in `statement` and name the condition in `qualifier_band`.
- **Never drop a qualifier that makes a threshold non-portable.** Measurement method or analyzer,
  chart family, age/sex scope, required serial measurements and their minimum interval, companion
  criteria that must accompany the finding, and "referral/review only" or "fallback only" status all
  belong in `statement` and/or `qualifier_band`. A velocity cutoff without its "two or more
  measurements ≥6 months apart" condition is not the source's claim.
- `unit`: transcribe the report's unit string as printed (`g/dL`, `10*9/L`, `mg/mmol`, `mL/min/1.73m2`).
  Do not normalize to UCUM if the report did not; do not drop it.
- `qualifier_band`: this is where analyte + age band + sex + method belong, e.g.
  `"RBC, 1-<14y, female, Beckman DxH900"`. For the anemia interval table the measurement method is
  required by design — if the report gives one, it must appear here.
- `direction`: free text hint. Useful values: `lower_bound`, `upper_bound`, `upper_threshold`,
  `lower_threshold`, `reference_range`, `cutoff`, `stage_boundary`, `coefficient`, `formula`.
- `population`: the report's population wording (`"pediatric"`, `"neonatal"`, `"0-<1y"`, …).
- Set `"producer_confidence"` to `null` unless the report prints an explicit numeric confidence.

## Coverage requirement

Emit **every** source the report tabulates and **every** row of **every** candidate/threshold/
interval/discriminator table, plus the report's own gap notes, conflict notes, deprecation notes and
"do not use" rows as `annotation` candidates. Under-extraction is a defect: the point of the packet
is that the report's full content becomes reviewable, not a sample of it. If the report has a
narrative paragraph carrying a threshold that never made it into a table, extract that too.

Output **only** the JSON object, no prose and no code fence.
