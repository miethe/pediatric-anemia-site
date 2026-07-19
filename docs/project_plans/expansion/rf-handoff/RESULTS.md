---
title: "Research Foundry handoff — RESULTS (all 7 pediatric-CDS evidence runs verified)"
description: "Completion record for the 7 rf evidence runs. All verified (rf verify exit 0, 0 unsupported), landed on the agentic node + runs-viewer, cross-model audited with gpt-5.6. Handoff to the CDS rf-bundle → kb-pack converter (EF-WP0)."
status: complete
created: 2026-07-18
owner: Nick Miethe
project: pediatric-cds-platform
supersedes_status_of: README.md §2 (runs were `planned`; now `verified`)
---

# Research Foundry handoff — RESULTS

All **7** evidence runs registered in [`README.md`](README.md) have been **driven end-to-end and
verified**. Each produced a governed evidence bundle honoring the `pediatric_cds` output contract
(population / assay-method / threshold+UCUM / lifecycle + **verbatim exact-passage locators**) and
the governance guardrails. `rf` stopped at the verified bundle per the seam — no rules, thresholds-as-logic,
FHIR, or signed packs were authored. **The bundles are the input to the CDS `rf-bundle → kb-pack`
converter (IntentTree `EF-WP0`).**

## 1. Status — all 7 `verified`

| Item | Gate | Mode | Source cards | Claims (supp / inf / spec) | `rf verify` | Bundle |
|---|---|---|---|---|---|---|
| RF-EV-001 | P1 | backfill | 6 | 48 (35 / 8 / 5) | ✅ exit 0, 0 unsupported | verified |
| REG-001 | P0 | regulatory · **LEGAL** | 12 | 89 (77 / 6 / 6) | ✅ exit 0, 0 unsupported | verified |
| RF-CBC-001 | P2 | clinical | 12 | 87 (74 / 8 / 5) | ✅ exit 0, 0 unsupported | verified |
| RF-CBC-002 | P2 | clinical | 12 | 88 (75 / 8 / 5) | ✅ exit 0, 0 unsupported | verified |
| RF-KID-001 | P4 | clinical | 12 | 87 (73 / 10 / 4) | ✅ exit 0, 0 unsupported | verified |
| RF-GRO-002 | P5 | clinical | 12 | 92 (79 / 10 / 3) | ✅ exit 0, 0 unsupported | verified |
| REG-004 | P3 | regulatory · **LEGAL** | 12 | 85 (72 / 10 / 3) | ✅ exit 0, 0 unsupported | verified |
| **Total** | | | **78** | **576 (485 / 50 / 31)** | **7/7 pass** | **7/7 verified** |

Every run's `rf verify` was re-run authoritatively (not trusting workflow self-reports): exit 0,
`passed: true`, `unsupported: 0`.

## 2. Where the deliverables live

**On the agentic node** (`rocket-fedora`, `10.42.10.76`), workspace `~/dev/research-foundry`:
- Per-run: `runs/<run_id>/evidence_bundle.yaml` · `reports/report_draft.md` · `claims/claim_ledger.yaml`
  · `sources/*.md` (source cards with the `pediatric_cds` extension) · `reviews/verification.yaml`.
- **Runs-viewer (live):** <http://10.42.10.76:3030> — all 7 show `status: published` with full claim graphs.
- **API:** `GET http://10.42.10.76:7432/api/runs` (owner token) — reads the same store; catalog imported
  (`rf catalog import`) so `/api/catalog/search` finds the claims/sources across all 7.
- **Local mirror + versioned checkpoint:** `research-foundry/runs/<run_id>/` (data-plane repo, committed
  locally `4144634`; push deferred — the shared data repo has unrelated in-flight drift + is behind origin).

The `run_id`s are exactly those in [`README.md`](README.md) §2.

## 3. Output-contract adherence (converter-eligibility)

Every source card carries the **`pediatric_cds` evidence-card extension** per evidence point:
`population` · `assay_method` · `threshold {value, units_ucum (UCUM), passage_locator}` · `lifecycle`
`{effective, retire, guideline_version, supersedes}` · `classification` (source_supported_fact vs
implementation_proposal). Invariants honored:

- **Exact-passage locator on every material claim** — each threshold/equation carries a verbatim quote +
  page/section locator; unlocatable numbers were recorded as **GAPS / Open questions**, never fabricated
  (missingness ≠ normal).
- **Conflicts preserved** — e.g. WHO vs CDC growth standards (GRO-002), differing ANC cutoffs (CBC-001),
  pediatric vs adult proteinuria (KID-001) are kept as explicit conflicts, never averaged.
- **Proposals flagged** — implementation boundaries (scope-exits, referral triggers) are inference/speculation,
  distinct from source-supported facts.

## 4. Cross-model assurance (gpt-5.6) + fixes applied

An independent **gpt-5.6 (Codex)** passage-fidelity audit ran over all 7 bundles (routed via
`delegation-router`, task_class `second-opinion`). It caught three fidelity gaps that `rf verify`
structurally cannot (verify checks tag/label *structure*, not whether a quote's text contains the asserted
number) — **all three were fixed at the evidence layer and re-verified (exit 0)**:

1. **RF-CBC-001 / RF-CBC-002 — ANC/count units.** The PMC HTML rendering had stripped the superscript-9
   (`×10⁹/L` → `×10/L`) in several verbatim quotes. Fixed by re-fetching the intact verbatim from the
   **publisher JATS full-text via Europe PMC** (PMC9278291, PMC12395045, PMC11331724) — claims stay
   `supported`, units restored, artifact documented (not silently corrected). One genuine source typo
   (`<7 g/L`) was correctly preserved and flagged.
2. **REG-004 — CFR enumerations.** Two claims asserted fuller enumerations than their stored quotes showed;
   fixed by adding the **verbatim eCFR / Cornell-LII text** (45 CFR 164.308(a)(1)(ii)(A)–(D); 164.514(b)(1)/(b)(2)).
3. **RF-CBC-001 labels** — flagged inference tags were confirmed to be genuine Open-question interrogatives (no change needed).

Clean on first audit: RF-EV-001, REG-001, RF-KID-001, RF-GRO-002.

## 5. ⚠️ Legal review required — REG-001 & REG-004

Both regulatory runs are **research input only — flagged for legal review; not legal advice.** Their reports
carry the legal-review banner and frame all interpretive conclusions as inference/speculation/pending-review.
Do not act on them as legal positioning until a qualified reviewer signs off.

## 6. Governance posture (unchanged)

No autonomous diagnosis/treatment/dosing/transfusion directives; no unsupported confidence %; missingness
never treated as normal. `rf` output is a **proposal** — it becomes a rule only after the CDS converter +
clinical-review portal + executable tests + dual clinical sign-off + signed release. The product remains an
**UNVALIDATED research prototype** until the V1–V6 gates pass per module.

## 7. Next steps (owner)

1. **Converter (EF-WP0):** run each `evidence_bundle.yaml` through the CDS `rf-bundle → kb-pack` converter to
   emit rule *proposals*; `EF-WP1` enforces the `pediatric_cds` extension is present (it is, on every card).
2. **Legal:** route REG-001 + REG-004 memos to legal review.
3. **Data-plane push (optional):** once the shared `research-foundry-data` repo's unrelated drift is reconciled,
   `./scripts/rf-data push` then `./scripts/rf-data pull` on the node to version the run data in the private repo
   (the runs are already live on the node's working tree + viewer regardless).

## 8. How they were driven (for reproducibility)

Path-B swarm (Claude discovery subagents author `pediatric_cds` source cards → deterministic `rf`
extract→claim-map→synthesize→verify→bundle tail), one run at a time (concurrency limit). Clinical runs used a
**PubMed MCP** discovery lane; regulatory runs used primary government sources (FDA / eCFR / HHS). The reusable,
parameterized driver is `research-foundry/.claude/workflows/rf-pediatric-cds-run-execute.js`
(modes: `clinical` | `regulatory` | `backfill`) — this also satisfies the `RFUP` "parameterize the Path-B
workflow" enhancement noted in [`README.md`](README.md) §6.
