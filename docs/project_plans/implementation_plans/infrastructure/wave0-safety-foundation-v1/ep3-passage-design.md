---
doc_type: design_record
title: "EP-3 Passage-Record Design + Converter Contract"
status: approved
created: 2026-07-20
phase: EP-3+EP-4
feature_slug: wave0-safety-foundation
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-3-4-evidence-and-governance.md
supersedes_sketch: docs/project_plans/design-specs/exact-passage-evidence-schema.md
---

# EP-3 Passage-Record Design + Converter Contract

This record pins the decisions the EP-3/EP-4 implementation must follow. It **supersedes the
idea-stage sketch** in `docs/project_plans/design-specs/exact-passage-evidence-schema.md` where the
two disagree (that sketch is `maturity: idea`, predates the phase plan, and proposed a different
rule-reference shape).

## D-EP3-1 — Rule evidence references stay source-level; passage linkage is a rule field

The sketch proposed upgrading `rule.evidence[]` from `["AAP2026_IDA"]` to
`[{source, passage}]` objects. **Rejected.** The phase plan (EP4-T1) instead specifies a rule-level
`sourcePassageId` field, which is far less invasive and does not force a breaking change on
`candidate.schema.json` and all 26 candidates.

**Decision:**
- `rule.evidence[]` keeps its current shape: an array of source-record ID strings.
- Rules gain `sourcePassageId` (EP-4): `string | null`, naming exactly one passage record.
- `additionalProperties: false` is preserved throughout.

## D-EP3-2 — Passage records live inside the existing single evidence source

DEF-1 unified evidence onto `modules/anemia/evidence.json` (`src/evidence.js` is now a thin
loader). Passage records must not reintroduce a second hand-maintained store.

**Decision:** each source record in `modules/anemia/evidence.json` gains a `passages[]` array. There
is no new evidence data file. `src/evidence.js` gains passage accessors over the same import.

## D-EP3-3 — Every rule resolves; absence is never silent

**Decision:** the passage record's `status` carries the source-supported/proposal distinction, and
every one of the 91 rules points at a real passage record.

- `status: "source-supported"` — the passage traces to a located passage in the cited source.
- `status: "implementation-proposal"` — an explicit, minted sentinel record. Each of the 6 sources
  gets exactly one proposal record (`<SOURCE_ID>#implementation-proposal`) so that a rule whose
  threshold is *not* mechanically traceable to a located passage still resolves to something
  explicit rather than to nothing.

Schema permits `sourcePassageId: null` (Risk 6 — legitimate absence must be schema-representable
for a newly authored, not-yet-backfilled rule). **`scripts/validate-kb.mjs` is stricter than the
schema and rejects null for the shipped KB.** Schema describes shape; the validator enforces policy.

## D-EP3-4 — Paraphrase-only, and the field says so

REG-002 has **not** cleared verbatim reuse of AAP/AAFP guideline text (it answered
CPT/SNOMED/LOINC/WHO vocabulary licensing; guideline-text reuse is its stated biggest gap). The RF
source cards *do* carry verbatim `quote:` fields; the WHO card itself declares
`allowed_for_public_output: false`.

**Decision:**
- `exactPassage` is populated from the RF extracted point's **`summary`** (paraphrase), never its
  `quote`.
- A required sibling field **`passageFidelity: "verbatim" | "paraphrase"`** states which it is. A
  field named `exactPassage` that silently holds a paraphrase would be exactly the kind of quiet
  over-claim this codebase's guardrails exist to prevent.
- The vendored converter input pack **must not contain the `quote:` fields at all**, so the rights
  question cannot be re-opened by accident downstream.

## D-EP3-5 — Determinism requires vendoring the RF input

The RF-EV-001 bundle lives outside this repo
(`~/dev/homelab/development/research-foundry/runs/rf_run_20260717_rf_ev_001_pediatric_cds_backfill/`).
A converter that reads it directly cannot be re-run in CI and cannot prove byte-identical output.

**Decision — two scripts, one of which is CI-safe:**

| Script | Runs | Reads | Writes |
|---|---|---|---|
| `scripts/evidence/vendor-rf-bundle.mjs` | manually, by an operator with the RF mirror | the live RF run dir (`--bundle <path>`) | `evidence-packs/rf-ev-001/pack.json` + `MANIFEST.json` |
| `scripts/evidence/build-evidence-pack.mjs` | in CI / `npm run` | the **vendored** `pack.json` only | `modules/anemia/evidence.json` `passages[]` |

`MANIFEST.json` records the sha256 of each upstream RF file plus the run id, so the vendored pack's
provenance is checkable. `build-evidence-pack.mjs --check` regenerates in memory and fails if the
committed `modules/anemia/evidence.json` differs — that is the byte-identical guarantee (AC EP3-T2),
and it is wired into `npm run validate`.

## Passage record shape (`schemas/evidence.schema.json`)

```jsonc
{
  "id": "WHO2024_HB#ev_001",          // "<sourceId>#<rf evidence_id>"; proposal sentinel uses
                                       // "<sourceId>#implementation-proposal"
  "sourceId": "WHO2024_HB",
  "status": "source-supported",       // | "implementation-proposal"
  "sourceLocator": {                   // all members nullable; free-text `raw` always present
    "raw": "Executive summary, p.xi, Table 2 (Haemoglobin cutoffs ...)",
    "page": "xi", "section": "Executive summary", "table": "Table 2", "figure": null
  },
  "exactPassage": "WHO 2024 defines anaemia with age/population-specific haemoglobin cutoffs ...",
  "passageFidelity": "paraphrase",    // | "verbatim"  (see D-EP3-4)
  "evidenceGrade": "source-supported-fact",
  "applicability": { "age": "...", "sex": "...", "assay": "..." },  // members nullable
  "reviewDate": "2026-07-18",
  "supersedes": "WHO 2011 ... and prior WHO documents (1968-2005)",  // nullable
  "surveillanceQuery": "WHO haemoglobin cutoffs anaemia guideline update after 2024",
  "provenance": { "runId": "rf_run_20260717_rf_ev_001_pediatric_cds_backfill",
                  "sourceCardId": "src_20260718_rfev001_01", "evidenceId": "ev_001" }
}
```

**Validation invariant (AC EP3-T1):** a record with neither a non-empty `exactPassage` nor
`status: "implementation-proposal"` fails validation. The proposal sentinel is the *only* way to
have an empty passage.

### RF extracted-point → passage-record field map

| Passage field | RF source |
|---|---|
| `id` | `<kbSourceId>#<extracted_points[].evidence_id>` |
| `sourceLocator.raw` | `extracted_points[].locator` |
| `sourceLocator.{page,section,table,figure}` | parsed from `locator` by documented regexes; unparsed → `null` |
| `exactPassage` | `extracted_points[].summary` (**never** `.quote`) |
| `evidenceGrade` | `pediatric_cds.classification` (`source_supported_fact` → `source-supported-fact`) |
| `applicability.age` | `pediatric_cds.population` |
| `applicability.assay` | `pediatric_cds.assay_method` |
| `applicability.sex` | parsed from `population` when it names a sex, else `null` |
| `supersedes` | `pediatric_cds.lifecycle.supersedes` |
| `status` | `source_supported_fact` → `source-supported`; anything else → `implementation-proposal` |

### Source-card → KB-source mapping (1:1, 35 extracted points total)

| RF source card | KB source id | points |
|---|---|---|
| `src_20260718_rfev001_00` | `AAP2026_IDA` | 7 |
| `src_20260718_rfev001_01` | `WHO2024_HB` | 6 |
| `src_20260718_rfev001_02` | `BLOOD2022_PED_ANEMIA` | 5 |
| `src_20260718_rfev001_03` | `CDC2025_LEAD` | 5 |
| `src_20260718_rfev001_04` | `FDA2026_CDS` | 5 |
| `src_20260718_rfev001_05` | `BSH2020_G6PD` | 7 |

The mapping is asserted explicitly in the vendor script (not inferred at build time) and fails
loudly if a card or a KB id is unmatched.

## D-EP3-6 — Rule→passage assignment is fail-safe, not optimistic (governs EP4-T2)

EP4-T2 must stay mechanical. Assigning a *source-supported* passage to a rule is a clinical-grounding
claim, so the codemod must not guess.

**Decision:** a rule's `sourcePassageId` resolves to a source-supported passage **only** when the
mapping is unambiguous under the documented, deterministic matching rule (rule's first cited source
+ an explicit threshold/topic key match recorded in the pack). **Every other rule falls back to that
source's `implementation-proposal` record.** The direction of error is toward *"we do not claim this
is source-backed."* The generated mapping table is committed so the EP3-T5 audit and any future
clinical reviewer can see exactly which rules claim source support and why.

## Known fidelity risk to probe (EP3-T5)

RF-EV-002 / REG-002 recorded that the **shipped `AAP2026_IDA` thresholds are unverified against
their own source** (HTTP 403 / subscription-required), yet the RF-EV-001 AAP source card marks all 7
of its extracted points `source_supported_fact`. The passage-fidelity audit must specifically test
whether the AAP card's points are genuinely locatable or are downstream of an inaccessible source.
