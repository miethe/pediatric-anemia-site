---
title: "DR claim re-anchoring — fixing the quote-provenance mismatch without discarding the candidate pool"
description: "Why the P3 DR ingest produced 0 verified claims for reasons largely independent of retrieval (quotes are anchored to the provider report while rf binds passages against the acquired source), why the obvious fix violates the ERI contract, and the re-anchoring design that converts the 309-candidate pool from unusable transcription into a targeted acquisition worklist. Adversarially reviewed; corrections from that review are incorporated and marked."
status: proposal
created: 2026-07-30
owner: Nick Miethe
project: pediatric-cds-platform
refines_conclusion_in: "07-dr-packet-ingest-p3-execution-record.md §6"
related: "09-rf-eri-enhancement-spec.md"
review: "adversarial review by codex/gpt-5.6-terra 2026-07-30; verdict 'unsound' on the first draft's causal overclaim — §1, §1.1, §2, §4 and §5 corrected below"
---

# DR claim re-anchoring

> **Nothing in this document authorizes a rule, a threshold, or an attestation.** Re-anchoring at
> best proves that a *source contains a sentence*. It does not prove the sentence supports the claim,
> is clinically correct, applies to a population, or is safe to encode. Every clinical gate in
> `CLAUDE.md` stands unchanged, and §4.3 adds a hard boundary on what model-proposed spans may become.

## 1. The defect

The P3 ingest (`07-dr-packet-ingest-p3-execution-record.md`) recorded **2 of 309 candidates** reaching
`passage_resolved` and **0 verified**. The record attributes this to source retrievability. Retrieval
was *a* real blocker — a candidate is quarantined `citation_unresolved` before any span matching if
its source never resolved (`external_research_resolution.py:814-821`) — but it is not the whole story,
and it is not the part that will still be blocking after `09-rf-eri-enhancement-spec.md` lands.

There is a provenance mismatch between two documents:

| Stage | Document the quote is checked against |
|---|---|
| `tools/dr-packet/EXTRACTION-CONTRACT.md:14` — "Every `quote` must be a verbatim substring of **the report**" | the provider's DR report (`report.md`) |
| `rf` — `find_exact_passages(bound.source_key, normalized.quote)` (`external_research_resolution.py:845`) | the **acquired original publication** |

A deep-research report paraphrases and summarizes the literature it cites. Where it paraphrases, its
prose is not a substring of the underlying paper, and the candidate cannot bind no matter how well
acquisition works.

**Calibrated claim.** The first draft of this document asserted that 0 verified was "structurally
guaranteed independent of retrieval." That was an overclaim and adversarial review refuted it. The
defensible statement is:

> The current quote design **materially suppresses** exact-match yield by a mechanism independent of
> retrieval. Its independent contribution cannot be estimated from this run, because retrieval failure
> masked it for 84 of 120 sources. Measuring it is the point of §7 step 4.

**A second, independent structural cause.** For the two `anemia` packets, which imported staging-only
(no `--run`), `verified` is *categorically* unreachable by design — `target_run_id: None` means "no run
is created, no run-local projection is written, and `verified` is categorically unreachable"
(`external_research_import.py:349-352`). So for those packets the 0 is over-determined and carries no
information about quote quality at all.

### 1.1 What the 2 successful bindings actually were

Both are in `anemia/chatgpt`. I recovered their identity cryptographically — `rf` derives
`passage_id = "psg_" + sha256(f"{edition_id}:{sha256(quote)}:{index}")`
(`assertion_registry.py:717-745`), so recomputing that digest over the packet's quotes uniquely
identifies them:

| Candidate | Quote | Source |
|---|---|---|
| `ane_gpt_c40` | `>360 g/L` | `ane_gpt_s06` |
| `ane_gpt_c62` | "Hematocrit levels that are too low may be a sign of anemia." | `ane_gpt_s15` |

Neither is a bare numeral. They are exactly the case that refutes any "guaranteed zero" framing:
**where a DR report quotes its source verbatim rather than paraphrasing, the quote binds correctly.**
`ane_gpt_c62` is plainly a direct lift from a consumer-health page; `ane_gpt_c40` is a short threshold
string likely to appear as written.

That is the mechanism working as intended, and it tells us the ceiling is not zero — it is "however
often the provider quoted instead of paraphrased," which in this corpus was 2 of 309 (0.6%).

**A separate latent hazard, not the explanation of these two.** 32 of 309 quotes (10%) are *purely
numeric* — `'323'`, `'350'`, `'2.90'` — and all 32 are in this same packet; 109 (35%) are ≤20
characters. A bare numeral is a legal passage selector in `rf` (§`09` G5) and a verbatim substring of
the report, so it passes both gates. It did not cause these two binds, but at scale against real
publications it is a false-positive generator: a three-digit number occurring exactly once in a
document would bind, carrying a `passage_resolved` tier with no semantic tie to the claim. §4.2
forbids it in re-anchored output.

## 2. Why not simply bind to the report

The tempting repair is to ingest `report.md` as a source edition. Quotes would bind perfectly — they
are verbatim from the report by construction, and `verify_fidelity.py` already guarantees it.

**As a route to `passage_resolved` or `verified`, this is wrong and must not be built.** `rf`'s ERI
contract states that `report.md` "stays non-authoritative `platform_synthesis`" and that every source
and candidate "is resolved through RF's own existing acquisition/passage/verification authorities"
(`cli_commands.py:1150-1158`). Binding claims to the report would manufacture `passage_resolved` at
scale while grounding pediatric thresholds in LLM prose — precisely what this project's first hard
guardrail forbids. A claim "verified" against the report is verified as *transcribed*, not as
*sourced*, yet would be indistinguishable in tooling from one checked against a journal article.

**But a narrower version is safe, and the first draft dismissed it too broadly.** A separately typed,
**non-promotable** record — `report_transcribed` / `platform_synthesis_anchor` — that pins what the
provider asserted and where, is legitimate and useful for auditability, extraction QA, and the
preservation goal in §6. Its constraints are absolute: it must **never** be a source edition, a source
card, a verified claim, a bundle input, an input to rule generation, an attestation aid, or displayed
anywhere as supporting clinical evidence. It is a provenance receipt, not evidence.

## 3. What the candidate pool actually is

The 309 candidates are **not evidence, and no operation on them alone can make them evidence.** They
are something else with real value:

> A structured, digest-pinned, deduplicated **acquisition worklist**: 120 source leads with, attached
> to each, the specific claims a provider asserts that source supports — including the numbers, units,
> populations, and qualifier bands to look for.

That is a *targeting function*. Ordinary `rf` discovery acquires broadly then hunts for claims; here we
already know which publication to fetch and what to look for in it. This is the "reverse operation":
normal research is *sources → claims → report*; we have *report → claims → now find them in the
sources*, with the claims driving retrieval.

## 4. The re-anchoring operation

For each candidate `C` whose cited source `S` has reached `source_resolved` (so `rf` holds acquired
text `T`):

```
input:  C.statement, C.value, C.unit, C.population, C.qualifier_band,
        C.quote_report   (verbatim from the DR report — a SEARCH HINT, never the anchor)
        T                (the acquired source text held by rf)

propose: a span of T that asserts C  ->  quote_source

gate 1 (mechanical): quote_source is a verbatim substring of T
gate 2 (mechanical): quote_source is contentful (§4.2)
gate 3 (human):      quote_source semantically supports C (§4.3)
```

Only after all three does `C'` become eligible for `passage_resolved` through `rf`'s existing,
unmodified verifier. No new authority is introduced and no promotion path is bypassed.

### 4.1 Outcome vocabulary

A four-outcome vocabulary (found / not-found / ambiguous / partial) is insufficient and forces wrong
answers. Adversarial review supplied the missing cases; the full set is:

| Outcome | Meaning |
|---|---|
| `reanchored_direct` | a single verbatim span in `T` states the claim |
| `multi_span_composite` | supported only across several passages, or prose + table/header/footnote |
| `structured_evidence_located` | a table cell, figure, or equation supports it; no literal prose span exists |
| `derived_or_converted` | the provider computed, rounded, interpolated, or unit-converted a source value |
| `semantic_support_unadjudicated` | a span was found; entailment and scope are not yet established |
| `edition_or_extraction_mismatch` | wrong edition/translation/supplement, or OCR/table/PDF extraction corruption |
| `source_partial` | `T` was truncated (`rf` caps extraction at 100 000 chars — `09` G8); absence is not evidence of absence |
| `not_present` | no supporting content found in a *complete, well-extracted* `T` |
| `ambiguous` | multiple distinct spans match |

**None of the middle six may be collapsed into `not_present`.** A single verbatim span is the right
model only for directly-stated prose claims; clinical guidelines carry a large share of their content
in tables, which is exactly where our thresholds live.

**`not_present` is not proof of misattribution — and the first draft oversold it.** Benign reasons a
genuinely-supported claim fails a span search: paraphrase, synonymy, abbreviation, translation,
notation and math-symbol differences, table/figure/caption/footnote/supplement location, composite
claims, provider-side computation or rounding, version mismatch, incomplete HTML/PDF/OCR extraction,
and reviews that accurately point to underlying evidence without restating it.

So do not publish a raw `not_present` rate as "DR citation fidelity." Publish the **stratified**
result — direct-prose support, structured support, composite/derived support, extraction inadequate,
citation-target mismatch, adjudicated-unsupported — and treat only the last as evidence of
misattribution. That stratified table is still the most informative thing this program can produce
about the DR route, and it does not exist today.

### 4.2 Mechanical gates

- **Verbatim substring of `T`.** Same guarantee as the existing gate, pointed at the correct document.
- **Contentful span.** `quote_source` must express the claim, not merely contain its number: it must
  carry the claim's number **and** at least one of its unit, population, or qualifying term; purely
  numeric or punctuation-only spans are rejected outright; a minimum length applies. Without this,
  re-anchoring reproduces the §1.1 bare-numeral hazard against real publications, and false
  verifications are far more dangerous than the current honest zero.
- **Normalization must be solved first.** `rf` matches passages by **byte-exact SHA-256** with no
  normalization (`assertion_registry.py:479-499`; `09` G7). A correct span will still fail if it
  differs by one soft hyphen, en-dash vs hyphen, smart vs straight quote, non-breaking space,
  ligature, or a line-break-hyphenated word — all endemic to PDF text extraction. **Re-anchoring
  against PDF-derived text is not viable until `09` G7 is fixed.** Any normalized match must carry a
  distinct tier so audits can separate exact hits from normalized hits.
- **Compound criteria stay atomic.** A threshold re-anchored without its qualifying condition
  ("within 48 h", "for ≥3 months", "on 2 separate occasions") is a claim the source never made.
- **A non-empty field is not a correct field.** The P3 repair pass that filled blank `qualifier_band`s
  introduced a *wrong* one — `kid_gpt_c001` still carries `first-morning UPCR` on a creatinine-eGFR
  coefficient.

### 4.3 Hard boundary on model-proposed spans

A cheap model selecting a substring plus a deterministic substring test **can create a false
source-to-claim link.** `ane_gpt_c62` is the demonstration: its quote ("Hematocrit levels that are too
low may be a sign of anemia.") is genuinely present in its source and genuinely bound — yet it cannot
establish the candidate's actual assertion about pediatric hematocrit cutoffs. Substring presence is
not entailment, and no contentful-span rule fixes that.

Therefore, non-negotiably:

- Model output may **propose** spans only. Its result stays `semantic_support_unadjudicated`.
- No automatic promotion; no use as bundle input; no input to rule generation; no use as an
  attestation aid; no display as supporting clinical evidence — until a human independently
  adjudicates claim, population, units, qualifiers, and directness.
- This is what upholds the no-invented-thresholds and no-AI-published-rule-changes guardrails.

## 5. Eligibility and honest yield

Re-anchoring is possible only where the source resolved. Today: 36 of 120.

| State | Sources | Notes |
|---|---:|---|
| Resolved today | 36 | eligible now |
| DOI-only, recoverable by `09` G1 (returns 2xx via `doi.org`) | 15 | incl. KDIGO AKI, Schwartz 2009 |
| DOI-only, still blocked after G1 (403 at `doi.org`) | 14 | needs `09` G4/G9/G10 |
| URL present, HTTP GET failed (largely anti-bot) | 28 | partly recoverable via `09` G4/G9/G10 |
| Declared `paywalled` | 20 | rights decision, not technical; see `09` G11 (local-asset path) |
| No locator in the report | 7 | terminal |
| **Total** | **120** | |

**Terminal cases.** The 7 locator-less records (`cbc_gpt_s11` "another 2023 pediatric series";
`kid_gpt_s10–s15` "KDIGO-based summaries" and similar) can never be re-anchored, and the **28
candidates that cite only those records** are therefore terminal — 27 in `kidney/chatgpt` plus
`cbc_gpt_c36`. They must be re-sourced by a human to a real publication or retired. They must not be
carried forward as if pending.

No yield forecast is offered. `--dry-run` over-forecast the P3 import by ~2.4×, the `not_present`
stratification is unmeasured, and the 15/28 split above is inferred from independent HTTP probing
rather than from `rf` receipts — `rf` does not preserve an HTTP status (`09` G2/G15), so it cannot be
confirmed from the run's own artifacts.

## 6. Data preservation — a loss already occurred

The execution record's §7 lists six artifact classes under `build/`. **All six are absent** —
`build/` is `.gitignore`d (`.gitignore:8`) and was cleaned. Surviving counterparts exist elsewhere,
but they are not the `build/` artifacts §7 points at:

| §7 artifact | Status | Surviving counterpart |
|---|---|---|
| `build/extractions/` | gone | the 7 `extraction.json` committed under `dr-packets/*/expected-output/` |
| `build/packets/` | gone | rebuildable from those via `tools/dr-packet/build_packet.py` (digests deterministic) |
| `build/receipts/`, `build/receipts-v2/` | gone | the `rf` interchange store — **uncommitted, in the `research-foundry` repo** |
| `build/ingest-summary.json` | gone | regenerable from the receipts |
| `build/audit/<packet>.audit.md` | gone | **none** — raw cross-model audit output is unrecoverable; only the summarized `docs/audits/…` survives |

The digest-pinned design mostly held: everything except the raw audit output can be reconstructed.
But §7 as written is currently false.

**Position:**

1. The committed `extraction.json` files are the canonical artifact and are safe. Treat them as the
   pool of record.
2. Correct §7 to describe what actually persists; stop listing `build/` paths as artifacts.
3. The `rf` interchange store holds the only surviving receipts and lives uncommitted in another repo.
   Commit it there or export a portable snapshot here — until then a single `git clean` in
   `research-foundry` destroys the run's audit trail.
4. Re-anchoring outputs must be committed, never written to `build/`.

## 7. Sequenced way forward

| # | Step | Depends on | Gate |
|---|---|---|---|
| 1 | Preserve the receipts (§6 item 3); correct §7 of the execution record | — | audit trail survives a `git clean` |
| 2 | Land `09` **G1** (DOI resolution) upstream, or expand DOIs to `https://doi.org/<doi>` in `build_packet.py` locally | — | source resolution ≥ 42% |
| 3 | Land `09` **G7** (passage normalization) | — | a correct span is not defeated by a smart quote |
| 4 | Build the re-anchoring pass over resolved sources, with the §4.1 vocabulary and §4.2 gates | 2, 3 | every `quote_source` mechanically verified verbatim + contentful |
| 5 | **Publish the stratified §4.1 outcome table** | 4 | a real, defensible number for DR-route citation fidelity |
| 6 | Decide on that table whether the DR route earns further investment | 5 | owner |
| 7 | Adjudicate the 28 terminal candidates and 7 pseudo-sources | — | re-sourced or retired, never left pending |
| 8 | Fix `kid_gpt_c001`'s band | — | — |

Steps 1 and 8 are unblocked today. Step 5 is the decision point the program currently lacks: it turns
"the DR route disappointed us" into a measured, stratified fidelity result that can be argued about.

## 8. What this does not change

- No rule, threshold, or reference range is authored, proposed, or modified.
- `clinicalApprovers[]` / `approvedBy[]` stay schema-forced empty;
  `evidence-packs/passage-attestations.json` stays empty.
- A re-anchored, `passage_resolved`, even `verified` claim is **still not attested**. Attestation
  remains a named credentialed clinician's act, per rule, and nothing here brings it closer.
- `rf`'s `verified` tier means "an exact passage in an acquired source supports this string." It has
  never meant clinically validated, and re-anchoring does not change that.
