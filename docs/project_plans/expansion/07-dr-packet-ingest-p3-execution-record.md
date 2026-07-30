---
title: "DR packet ingest — P3 execution record (import + audit)"
description: "What actually happened when the 7 returned owner-run deep-research reports were transformed into external_research_handoff/v1 packets and imported into Research Foundry: 429 actions, 38 resolved, 391 quarantined, 0 verified. Records the measured bottleneck (source retrievability + rights metadata, not extraction), the audit-caught contract defect that fragmented compound criteria, the confirmed anemia<->cbc duplicate-source merge defect, and why this run authors no rules."
status: complete
created: 2026-07-29
owner: Nick Miethe
project: pediatric-cds-platform
executes: "05-three-module-evidence-run-design.md §8 P3; 06-anemia-red-cell-indices-evidence-run.md §10 P3 (Leg B only)"
---

# DR packet ingest — P3 execution record

> **Scope honesty, first.** This run moved owner-supplied provider research into `rf` as
> **candidates**. It produced **zero verified claims, zero rules, zero attestations, and zero
> reference-range changes**, and it did not launch any `rf` discovery swarm. Every number below is
> read from an artifact on disk, not asserted. What this run actually bought is stated in §6, and it
> is narrower than "the modules now have evidence."

## 1. What ran

Leg B of designs 05/06: the 7 provider deep-research reports the owner had already run and returned
into `dr-packets/<module>/<provider>/expected-output/` were transformed into conformant
`external_research_handoff/v1` packets and imported via `rf intake external-report`.

| Module | Provider | Packet | Target run | Mode |
|---|---|---|---|---|
| anemia | chatgpt-dr | `anemia-chatgpt` | — | staging-only |
| anemia | perplexity | `anemia-perplexity` | — | staging-only |
| cbc | chatgpt-dr | `cbc-chatgpt` | `rf_run_20260717_rf_cbc_002_pediatric_cds_establish` | run-targeted |
| cbc | perplexity | `cbc-perplexity` | `rf_run_20260717_rf_cbc_002_pediatric_cds_establish` | run-targeted |
| growth | chatgpt-dr | `growth-chatgpt` | `rf_run_20260717_rf_gro_002_pediatric_cds_evidence` | run-targeted |
| kidney | chatgpt-dr | `kidney-chatgpt` | `rf_run_20260717_rf_kid_001_pediatric_cds_evidence` | run-targeted |
| kidney | perplexity | `kidney-perplexity` | `rf_run_20260717_rf_kid_001_pediatric_cds_evidence` | run-targeted |

The 3 `gemini-dr` packets have no returned output and were not touched. Growth has one provider
report only — see §5 on what that costs.

**Why anemia imported staging-only.** Design 06 defines **RF-ANE-001** as a *new* deepen run and
states its §10 launch commands are inert until the owner approves the §4 briefs. `rf intake` never
creates a run, so binding anemia's candidates to a run would have required either launching
RF-ANE-001 (owner-gated) or misfiling them into **RF-EV-001**, a different published bundle that
RF-ANE-001 is designed to *extend* rather than occupy. Staging-only keeps the receipts and the
resolution work while leaving that call to the owner. Nothing is lost: no candidate in any packet
reached a tier where run binding would have changed its outcome (§3).

## 2. How the packets were built (and how transcription was gated)

Provider reports are single markdown documents mixing prose and tables; none was in the handoff
layout. The transform is `report.md` + `sources.yaml` + `assertion_candidates.yaml` + a
digest-bearing `handoff.yaml`, built by tooling in `tools/dr-packet/`:

- **`EXTRACTION-CONTRACT.md`** — the authored spec every extraction delegate followed: transcribe and
  never compute, conflicts preserved unreconciled, uncitable rows kept as `annotation` with empty
  `source_refs` rather than given an invented citation, compound criteria kept atomic, and every
  interval bound carrying a `qualifier_band` that identifies what it bounds. (The last two clauses
  were added *after* the audit found their absence corrupting claims — see §3a.)
- **`verify_fidelity.py`** — the deterministic tripwire. Every `quote`/`selector` must be a verbatim
  substring of the report; every `value` must appear literally in it; every DOI/URL must appear in
  it; every `source_ref` must resolve; enums and id patterns must conform; ids must carry the
  packet's prefix (a foreign prefix means a record copied from another packet); and no interval bound
  may be unpairable or paired across incompatible units. This proves *transcription* faithfulness
  only — it says nothing about clinical correctness.
- **`build_packet.py`** — computes byte lengths and SHA-256 digests rather than trusting the
  extraction to declare them, so a wrong count fails at build time instead of at intake.
- **`check_cross_packet_duplicates.py`** — the §4 merge-defect gate.

**The gate caught a real defect class.** The three source-gathering extractions came back with 26
HIGH findings, every one a paraphrased `quote`/`selector` — the delegate had reworded passages
instead of copying them. Critically, **zero** `value_not_in_report` and **zero**
`locator_not_in_report` findings: the numbers and citations were faithful, only the passage anchors
were not. A bounded repair pass fixed exactly the flagged fields and all three then passed clean.
The four numerics-heavy structured extractions passed clean on the first attempt.

That asymmetry is the reusable lesson: **for verbatim-span transcription, do not assume a cheap
model's quotes are quotes.** The deterministic gate is what makes cheap extraction safe to use at
all — without it, 26 fabricated-looking passage anchors would have entered the packets silently.

A `handoff.yaml` cannot honestly declare its own SHA-256 (writing the digest changes the digest).
The upstream fixtures resolve this with an unverified placeholder — confirmed empirically:
`profiles/generic/handoff.yaml` declares `1044`/`28d3ce…` while the file is `1021`/`10fa7e…`, and its
other three members match byte-for-byte. Our builder makes the manifest's `byte_length` exact and
sets its self-digest to the reproducible digest of the zeroed-self-digest form. All non-manifest
members are exact.

## 3. What the import actually produced

429 actions across 7 packets, read from the effect files in the `rf` interchange store rather than
from the CLI summary. Figures are the **post-audit-repair (v2) import** (§3a); `build/ingest-summary.json`
is the machine-readable form.

| | Count | |
|---|---:|---|
| Source records declared | 120 | |
| Candidate records declared | 309 | |
| **Actions total** | **429** | |
| Completed | 38 | 36 sources at `source_resolved`, 2 candidates at `passage_resolved` |
| Quarantined | 391 | |
| **Verified** | **0** | unreachable in this path — see §6 |

Quarantine reasons, which are the substance of this run:

| Kind | Reason | Count | What it means |
|---|---|---:|---|
| source | `source_unavailable` | 57 | `rf` could not retrieve the cited artifact |
| source | `rights_metadata_missing` | 20 | the packet's access status was insufficient for rf's rights gate |
| source | `invalid_locator` | 7 | no DOI and no URL in the report itself |
| candidate | `citation_unresolved` | 289 | its cited source never resolved, so the candidate cannot bind |
| candidate | `basis_incomplete` | 18 | no `source_refs` at all — the report's own uncitable rows |

**Source resolution rate: 36/120 = 30%. Candidate passage-binding rate: 2/309 = 0.6%.**

Two cross-checks worth recording:

- The 7 `invalid_locator` sources are exactly the 7 the deterministic gate had already flagged MEDIUM
  as locator-less (1 in cbc, 6 in kidney). The pre-import gate predicted the intake outcome exactly.
- The 18 `basis_incomplete` candidates are the contract working as designed: the kidney report's two
  explicit `NO CITATION — do not use` rows and the reports' gap/conflict notes survived as
  citation-free annotations instead of being dropped or given a fabricated source.

**Dry-run counts are not predictive.** The dry-run pass reported 93 completed actions; the real
import produced 38. Dry-run plans optimistically at `locator_only` without attempting acquisition,
so it systematically over-reports what will resolve. Anyone using `--dry-run` as a capacity estimate
will be wrong by ~2.4× in the optimistic direction. Use it to prove *structural conformance* (which
it did, for all 7 packets: no `block_reason`), never to forecast yield.

## 3a. The audit → repair → re-import loop, and what it caught

The design 05 §5 gate ran after the first import and did **not** pass: **13 high, 14 medium** across
the 4 numerics-heavy packets (`docs/audits/dr-packet-passage-fidelity-audit-2026-07-29.md`). Because
"audit clean" is design 05 §8's condition for advancing to merge, the first-pass extractions were
repaired and re-imported rather than merged.

The audit's central finding was that **the ingest contract itself was defective**, not merely the
extractions: its "split a range into two bound candidates" rule, applied to *compound* criteria,
detached qualifying conditions from their numbers — `≥0.3 mg/dL` lost "within 48 h", `<60` lost "for
≥3 months", `>6.0` lost "on 2 separate occasions", `≥95th percentile` lost "+ 12 mmHg" — and let a
systolic `120` share a qualifier band with a diastolic `80`. A threshold stripped of its qualifying
condition is not a weaker claim; it is a claim the source never made.

Three things came out of the loop, and the third is the most useful:

1. The contract was corrected (compound criteria stay atomic; bounds require a non-empty
   `qualifier_band`; one-sided limits are `*_threshold`, not bound halves; non-portability qualifiers
   such as analyzer/method, chart family and serial-measurement requirements must be preserved).
2. `verify_fidelity.py` gained mechanical gates for the class, so it cannot recur silently:
   `unpaired_bound_without_qualifier` flagged 13 records — **all in `kidney-chatgpt`**, independently
   localizing the audit's finding to the same packet.
3. **The repair pass introduced a new defect of the same family, and the first version of the gate
   missed it.** Fixing the blank bands, it gave a 12-hour urine-output bound the *stage-2 creatinine
   multiplier* band, creating a "12 hours to 2 × baseline" interval. A non-empty band is necessary but
   not sufficient — a *wrong* band corrupts exactly as a blank one does. The gate was extended with
   cross-record checks (`band_unit_mismatch`, `band_duplicate_bound`, `band_bounds_inverted`,
   `band_orphan_bound`), which then also caught a pre-existing defect neither the audit nor the first
   gate had found: the KDIGO albuminuria `A2` band grouping `mg/g` **and** `mg/mmol` bounds into one
   nonsense interval.

The residual 6 band assignments were then set deterministically from the report's own text (persistent
hematuria `>4–6 weeks`; stage 1 SCr `1.5–1.9 ×`; stage 1 urine output `6–12 h`; stage 2 SCr
`2.0–2.9 ×`; first-morning UPCR `≤0.2` reclassified as a one-sided threshold; `A2` split by unit
system), rather than by another nondeterministic pass. **All 7 packets now pass the deterministic gate
with 0 HIGH findings.** The 14 MEDIUM audit findings are recorded for the merge step and are not
resolved.

The lesson worth carrying: a cheap deterministic gate and an expensive cross-model gate caught
*different* defect classes, and the repair for one gate's findings created a defect only a
*third* check could see. One gate would have shipped corrupted candidates either way.

**Replay determinism held.** On re-import the 3 packets that needed no repair
(`anemia-perplexity`, `cbc-perplexity`, `kidney-perplexity`) returned `replayed: true` against their
unchanged packet digests; the 4 repaired packets minted new digests and new receipts. Nothing was
silently overwritten or merged.

## 4. The anemia ↔ cbc duplicate-source merge defect — confirmed, with specifics

Design 06 §2 rule 3 makes a duplicate claim across the RF-ANE-001 and `cbc_suite_v1` bundles a merge
*defect*, and warns the failure is silent. It is real, and the check found it:

1. **Tahmasebi 2020 (CALIPER Hematology Reference Standards I), cited two ways.**
   `anemia/chatgpt` `ane_gpt_s01` carries the AJCP article URL
   (`academic.oup.com/ajcp/article/154/3/330/5860205`) with no DOI; `cbc/chatgpt` `cbc_gpt_s06`
   carries `doi:10.1093/ajcp/aqaa059` with no URL. **Same paper, disjoint identifiers** — neither an
   exact DOI match nor an exact URL match can detect it. Only title similarity (1.00) caught it.
   This is the textbook instance of the silent defect the design predicted.
2. **The CALIPER reference-interval database**, `caliperproject.ca/caliper/database`, imported under
   two packet-local ids with two different titles: "CALIPER Reference Interval Database"
   (`ane_ppx_s15`) and "CALIPER Database" (`cbc_ppx_s01`).
3. A third cross-module hit at similarity 0.60 is a **false positive of the heuristic** and should
   not be reconciled: `ane_ppx_s03` (Beaumont Laboratory pediatric reference ranges) and
   `cbc_ppx_s02` (University of Iowa pediatric normals) are genuinely different sources that share
   the generic title "Pediatric Reference Ranges".

Within-module, 4 groups need ordinary dedupe at merge, including a genuine same-DOI pair in kidney
(`10.1681/asn.2008030287`, Schwartz 2009, cited by both kidney providers).

**Action required at merge, not now:** items 1 and 2 must be reconciled to a single source record
tagged for both module consumers before either bundle is extended. The check is now mechanical
(`check_cross_packet_duplicates.py`) rather than a thing someone has to remember.

## 5. Per-module state after this run

- **cbc** — 2 providers. 47 + 27 actions. The one module whose `authoring-decisions.yaml` is
  `approved_for_rule_draft`, so it is the only one where the converter would draft rules at all. Its
  chatgpt packet resolved **0** sources on the real import (10 in dry-run).
- **kidney** — 2 providers, and by far the largest candidate yield (129 + 7 declared; 147 + 20
  actions). Also the most locator-poor: 6 sources are the report's own aggregate "KDIGO-based
  summaries" citations with no single DOI/URL. Its reports carry 3 explicitly-flagged conflicts that
  must survive unreconciled, including nephrotic-range spot UPCR at **>350 mg/mmol** (chatgpt, from a
  paywalled review) versus **>200 mg/mmol** (perplexity, Ashford NHS) — two providers, one concept,
  two numbers, no reconciliation attempted or permitted.
- **growth** — **1 provider only.** No source-gathering pass exists to triangulate its 47 candidates,
  and its own report admits 4 gaps. Every other module got a second provider that surfaced real
  numeric conflicts; growth got neither the second pass nor the conflict check. Treat its yield as
  single-sourced.
- **anemia** — 2 providers, staging-only (§1). Holds the only 2 candidates in the entire run that
  reached `passage_resolved`.

## 6. Why this run authors no rules — the measured chain

The request behind this work included rule creation. It is blocked, and the block is now quantified
rather than assumed:

```
DR reports → conformant packets → rf ERI staging store        ← this run ends HERE
   ⇥ blocked: 70% of sources unretrievable or rights-incomplete; 99.4% of candidates unbindable
→ verified claim (rf verifier, exact-passage binding only)
→ verified bundle
→ tools/rf-bundle-to-kb-pack (reads a verified bundle from a run dir — NOT the ERI store)
→ staged kb-pack proposal in build/kb-pack/
→ clinician decisions (authoring-decisions.yaml: approved_for_rule_draft)
→ rules, then a named credentialed clinician attesting each rule to a passage
```

Three independent reasons no rule can follow from this run, each verified:

1. **Nothing is verified.** 0 of 429 actions reached `verified`. Design 05 §1.4: only rf's own
   verifier assigns `verified`, via exact-passage binding — provider prose is `platform_synthesis`
   and yields candidates only. No agent may promote.
2. **The converter cannot see this content.** `rf-bundle-to-kb-pack` reads a verified bundle from a
   run directory; the DR candidates are in `external_research_interchange/`, a different substrate.
   Verified by running `inspect` against the cbc bundle after the import: 87 claims, 82 eligible, 5
   rejected — **identical to before**, because the import contributed nothing to the bundle.
3. **The human gates are untouched and must stay so.** `clinicalApprovers` is `maxItems: 0` in
   `schemas/rule.schema.json`; `evidence-packs/passage-attestations.json` ships empty with a test
   asserting it stays empty; 3 of 4 modules' decisions are `drafted_pending_human_approval`. This run
   changed none of them, and no automated output substitutes for a named credentialed clinician.

**So what did this buy?** A reviewable, digest-pinned, reproducible candidate pool of 120 sources and
308 candidates that previously existed only as prose in 7 markdown files — plus, more usefully, a
*measurement*: the binding constraint on this evidence route is **source retrievability and rights
metadata (84 of 120 sources), not extraction or authoring capacity.** The project's recorded blocking
picture (0/91 rules grounded, ~2/3 attestation-shaped, ~1/3 licensing-shaped) is unchanged by this
run, and now has independent corroboration from a second, disjoint evidence route hitting the same
two walls.

## 7. Artifacts

Reproducible, all under `build/` (git-ignored) except the tooling and this record:

| Artifact | Path |
|---|---|
| Tooling + contract | `tools/dr-packet/` |
| Extraction JSONs (7) | `build/extractions/<module>-<provider>.json` |
| Materialized packets (7) | `build/packets/<module>-<provider>/` |
| Import receipts — first pass | `build/receipts/<module>-<provider>.receipt.json` |
| Import receipts — post-repair | `build/receipts-v2/<module>-<provider>.receipt.json` |
| Machine-readable rollup | `build/ingest-summary.json` |
| Raw per-packet audit output | `build/audit/<packet>.audit.md` |
| Fidelity audit (§5 gate) | `docs/audits/dr-packet-passage-fidelity-audit-2026-07-29.md` |
| Design implications | `08-dr-packet-design-implications.md` |
| rf interchange store | `research-foundry/external_research_interchange/` (staged packets, receipts, per-action effects) |

The converter was also exercised to confirm the negative result in §6: `propose` against the cbc
bundle emits a full staged pack (27 claims eligible for rule evidence, 60 rejected, rule emission
permitted) drafting the **same 4 rules already committed** — unchanged by this import, because its
input is a verified bundle and the DR content is not in one.

> **Operational gotcha found the hard way.** The converter's `--out` directory name is load-bearing:
> `scripts/validate-kb.mjs` walks `build/kb-pack/` and fails if a pack's own `packVersion` does not
> equal its containing directory name. Running `propose --out build/kb-pack/cbc_suite_v1/<any-label>`
> therefore turns `npm run validate` red with
> `release-manifest.unsigned.json: packVersion "0.1.0-proposal" does not match its own
> build/kb-pack/ pack-version directory "<label>"` — even though `build/` is git-ignored and the
> stray pack is nobody's input. Use the pack's real version as the directory name, or write
> diagnostic runs outside `build/kb-pack/`.

The rf-side store is **uncommitted in the research-foundry repo** — it is that repo's state, and
whether it is committed is its owner's call, not this repo's.

## 8. Next actions, and who owns them

| # | Action | Owner |
|---|---|---|
| 1 | Reconcile the 2 confirmed cross-module duplicate sources (§4 items 1–2) before extending either bundle | merge step |
| 2 | Decide whether to launch **RF-ANE-001** (design 06 §10, gated on §4 brief approval); anemia's candidates then bind to it | owner |
| 3 | Attack the measured bottleneck: 57 `source_unavailable` + 20 `rights_metadata_missing`. This is the REG-002 / licensing track, not a research-capacity problem | owner |
| 4 | Get growth a second provider pass, or record its single-sourcing as an accepted limitation | owner |
| 5 | Run the 3 unreturned `gemini-dr` packets, or retire them | owner |
| 6 | Nothing here advances attestation. That remains a named credentialed clinician's act, per rule, and no part of this run brings it closer | clinician |
