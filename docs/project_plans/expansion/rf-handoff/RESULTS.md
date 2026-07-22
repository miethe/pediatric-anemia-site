---
title: "Research Foundry handoff — RESULTS (all 7 pediatric-CDS evidence runs verified)"
description: "Completion record for the 7 rf evidence runs. All verified (rf verify exit 0, 0 unsupported), landed on the agentic node + runs-viewer, cross-model audited with gpt-5.6, and independently reconfirmed against the live RF API during P0 truth reconciliation (2026-07-19). Handoff to the CDS rf-bundle → kb-pack converter (EF-WP0)."
status: complete
created: 2026-07-18
updated: 2026-07-22
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

> **Provenance note (added 2026-07-19, P0 truth reconciliation; corrected 2026-07-19 after P0-V1
> independent review returned PASS-WITH-FINDINGS).** This file existed on disk since 2026-07-18 but
> was **untracked in git** until this reconciliation pass wrote it into
> `feat/arc-clinical-council-adoption-p0-p3`. Verification below is scoped per-section — an earlier
> version of this note over-claimed a single API pull as substantiating §1, §3, and §4 together; it
> does not, and has been corrected:
>
> - **§1 (per-run rows only, not the totals row):** independently re-pulled from the live Research
>   Foundry API (`GET http://10.42.10.76:7432/api/runs`, owner token) on 2026-07-19; the per-run
>   `claim_counts` (source_cards / claims_total / supported / inference / speculation / unsupported)
>   matched this table exactly for all 7 `run_id`s — that per-run breakdown is real, discriminating
>   data. The API's `status_derived` (`published`), `verification_passed` (`true`), and
>   `governance_verdict` (`true`) fields do **not** discriminate and are **not** cited as evidence of
>   completion: a full-store query on 2026-07-19 showed all three read identically across **all 48
>   runs** in the RF store (every project, not only this one's 7), while `status_raw` reads `planned`
>   for all 48 including these 7. The load-bearing, discriminating primary evidence for the
>   `planned → verified` upgrade is each run's on-disk `runs/<run_id>/reviews/verification.yaml`
>   (`passed: true`, `exit_code: 0`, `generated_at` timestamps between 2026-07-18T17:09:50-04:00 and
>   2026-07-18T20:27:34-04:00 — after the 2026-07-17 `planned` registration snapshot), read directly on
>   2026-07-19. The **totals row was not separately re-verified by any of the above and, on first
>   publication, was arithmetically wrong** (see the correction below the table) — a reminder that a
>   per-row match does not guarantee a correct aggregate.
> - **§3:** the `pediatric_cds` evidence-card extension's presence was independently confirmed by
>   reading the local run source-card files directly (`research-foundry/runs/<run_id>/sources/*.md`,
>   `pediatric_cds:` key) — 6/6 for RF-EV-001, 12/12 for each of the other six runs. The live-API
>   `/api/runs` endpoint carries no per-source-card data and cannot substantiate this on its own.
> - **§4:** `corroborated-by-artifact, no standalone audit record`. No separate gpt-5.6/Codex audit
>   report file exists anywhere in the run trees (checked). What exists, and was read directly, is the
>   evidence-layer fix documented in the affected source cards' own `trust.reliability_notes`
>   frontmatter and `## Limitations & conflicts` section — e.g.
>   `runs/rf_run_20260717_rf_cbc_002_pediatric_cds_establish/sources/src_20260718_rfcbc002_00.md`,
>   which records the Europe PMC JATS re-fetch against `PMC11331724`, the restored `× 10⁹/L` unit, and
>   the deliberately preserved `<7 g/L` source typo flagged (not silently corrected) as an intra-source
>   conflict. REG-004's CFR-enumeration fix is similarly present across its own source cards
>   (`runs/rf_run_20260717_reg_004_pediatric_cds_scope_the/sources/*.md`). Treat §4 as artifact-backed
>   narrative, not an independently reproducible audit trail.
>
> **Retracted correction (2026-07-19, third pass).** An earlier pass of this reconciliation claimed
> the original §2 "committed locally `4144634`" statement was false. **That refutation was itself
> wrong, and the original claim stands.** `4144634` is a real commit — `data: land 7 verified
> pediatric-CDS evidence bundles (RF-EV-001, REG-001/004, RF-CBC-001/002, RF-KID-001, RF-GRO-002)` —
> and all 7 pediatric runs (253 files) are tracked in it.
>
> The error came from checking the wrong set of repositories. The Research Foundry data plane
> (`runs/`, `ccdash/`, `registries/`, …) lives physically inside the `research-foundry` working tree
> but is tracked by a **separate dual git-dir** at `research-foundry/.git-data`, which pushes to the
> private `github.com/miethe/research-foundry-data` repo. The public project repo deliberately
> `.gitignore`s the data plane so it never ships this data. Both the reconciling pass and the
> independent review searched the four *project* repos and `research-foundry`'s public `.git`, found
> nothing, and concluded the SHA was fabricated — never considering the dual git-dir. Operate it with
> `research-foundry/scripts/rf-data <git-subcommand>`.
>
> So the accurate statement is the original one, with detail added: the run data **is**
> version-controlled, in the data-plane repo, at `4144634`; the live node + API remain the
> operational source of truth; and the push is genuinely deferred — `rf-data status` reports
> `main...origin/main [ahead 1, behind 2]`, matching the original note's "unrelated in-flight drift +
> is behind origin" precisely.
>
> This is recorded rather than quietly reverted because it is the same failure class this
> reconciliation exists to catch — a confident claim resting on evidence that could not support it —
> and here the unearned claim was a *refutation*, produced by this pipeline and ratified by its own
> reviewer. Absence of evidence in the repositories you thought to search is not evidence of absence.

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
| **Total** | | | **78** | **576 (485 / 60 / 31)** | **7/7 pass** | **7/7 verified** |

Totals check (2026-07-19 correction): supported 35+77+74+75+73+79+72=485; inference 8+6+8+8+10+10+10=**60**
(the original published totals row said 50 — an arithmetic error, corrected here); speculation
5+6+5+5+4+3+3=31; 485+60+31=576, matching the total-claims column and confirming the row now closes.
Source cards 6+12+12+12+12+12+12=78.

Every run's `rf verify` was re-run authoritatively (not trusting workflow self-reports): exit 0,
`passed: true`, `unsupported: 0`. The **per-run rows** were independently reconfirmed via a live API
pull on 2026-07-19 (see provenance note above) — `claim_counts` matched this table exactly, row for
row, for all 7 runs. The totals row is a manual sum of those rows, not a separate API-verified figure.

## 2. Where the deliverables live

**On the agentic node** (`rocket-fedora`, `10.42.10.76`), workspace `~/dev/research-foundry`:
- Per-run: `runs/<run_id>/evidence_bundle.yaml` · `reports/report_draft.md` · `claims/claim_ledger.yaml`
  · `sources/*.md` (source cards with the `pediatric_cds` extension) · `reviews/verification.yaml`.
- **Runs-viewer (live):** <http://10.42.10.76:3030> — all 7 show `status: published` with full claim graphs.
- **API:** `GET http://10.42.10.76:7432/api/runs` (owner token) — reads the same store; catalog imported
  (`rf catalog import`) so `/api/catalog/search` finds the claims/sources across all 7.
- **Local mirror + versioned checkpoint:** `research-foundry/runs/<run_id>/` (same tree structure as
  the node), committed locally at `4144634` in the **data-plane repo** — a separate dual git-dir at
  `research-foundry/.git-data` that tracks the data plane and pushes to the private
  `github.com/miethe/research-foundry-data`. The public `research-foundry` repo `.gitignore`s this
  path by design, so a plain `git log` there will not find the commit; operate it via
  `research-foundry/scripts/rf-data <git-subcommand>`. Push is deferred — `rf-data status` reports
  `ahead 1, behind 2` against origin (unrelated in-flight drift). The live node + API remain the
  operational source of truth.

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
Do not act on them as legal positioning until a qualified reviewer signs off. **Status remains
`not_executed_owner_held` as of 2026-07-19** — no owner legal sign-off is recorded anywhere in this
program's trackers.

## 6. Governance posture (unchanged)

No autonomous diagnosis/treatment/dosing/transfusion directives; no unsupported confidence %; missingness
never treated as normal. `rf` output is a **proposal** — it becomes a rule only after the CDS converter +
clinical-review portal + executable tests + dual clinical sign-off + signed release. The product remains an
**UNVALIDATED research prototype** until the V1–V6 gates pass per module. Evidence-bundle verification is a
Research Foundry structural/governance check, not clinical validation, and does not authorize CDS content
authoring, release, or activation on its own.

## 7. Next steps (owner)

> **Update (2026-07-22, `multi-bundle-conversion-e1` Phase 7, task P7-T7).** Item 1 below was last
> written 2026-07-19 as "not started." That is now out of date — but the corrected status is
> **partial, not "implemented,"** across a specific, load-bearing split. Do not read the update
> below as "EF-WP1 done for all 4 bundles"; it is not. See
> `.claude/findings/multi-bundle-conversion-e1-findings.md` for the full finding this update
> summarizes, and the **IntentTree caveat** at the end of this section before trusting `itt` state
> for this program.

1. **Converter (EF-WP0/EF-WP1): partially implemented — 1 of 4 bundles completes the pipeline, the
   other 3 do not.** The `multi-bundle-conversion-e1` feature (this repo, Phases 1-7) built the
   `rf-bundle → kb-pack` converter (`tools/rf-bundle-to-kb-pack/`) and ran it against all 4 clinical
   evidence bundles named in this handoff. The outcome is a hard split, by design (FR-14 module
   scoping) and Deferred Item **DF-E1-M1** (per-module `authoring-decisions.yaml` gap), not a bug:
   - **`RF-CBC-002` → `modules/cbc_suite_v1/` is the only bundle that completes `inspect → verify →
     propose` end to end.** It is the one module with a committed `authoring-decisions.yaml`, so it
     is the only one `propose.mjs` (hardwired to `cbc_suite_v1`'s own drafting content) can run
     against. Its `evidence.json`/`evidence-assertions.json` are genuine converter output,
     SHA-256-byte-identical across repeated runs (Phase 6, P6-T3).
   - **`RF-EV-001` → `modules/anemia/`, `RF-KID-001` → `modules/kidney_suite_v1/`, and `RF-GRO-002` →
     `modules/growth_suite_v1/` all halt at `inspect` with `DecisionsNotFoundError`** (no
     `authoring-decisions.yaml` exists for any of the three) and the converter emits nothing for
     them — no `rules.json`/`candidates.json` entries, by the same design constraint. The
     `evidence.json`/`evidence-assertions.json`/`unresolved.json` files committed for these three
     modules were **not produced by the converter**. They were hand-produced by bespoke, per-module
     one-off generator scripts written outside the converter pipeline; only one of the three
     generators (`modules/anemia/`'s) still exists anywhere in this repo, and it **is** committed,
     at `scripts/evidence/oneoff/gen-anemia-evidence-assertions.py` — the kidney/growth-suite
     generators are not present in the repo or its history at all. This is a real, currently
     unremediated provenance gap for the other two: **`kidney_suite_v1`'s and
     `growth_suite_v1`'s evidence-layer artifacts are not regenerable from committed code
     today** (anemia's are). Full detail, including the two named remediation
     options, is in `.claude/findings/multi-bundle-conversion-e1-findings.md`.
   - **`approvedBy` is `[]` and zero new rules were emitted to any module's `rules.json` by this
     feature** — evidence projected is never "module complete" or clinically ready,
     converter-produced or not. Module status is not uniform across the four: `anemia`'s
     `module.json.status` is `"integrity-recorded"` (`clinicalContentHash`/`governanceHash`
     populated and verified at server startup, per Wave-0/EP-5); `cbc_suite_v1`,
     `kidney_suite_v1`, and `growth_suite_v1` all stay `"unsigned-stub"`
     (`clinicalContentHash`/`governanceHash: null`). See `docs/architecture.md` §2a's module
     inventory for the full per-module breakdown.
   - **Status: EF-WP0/EF-WP1 partial — `cbc_suite_v1` only.** DF-E1-M1 (authoring-decisions for the
     other 3 modules) remains the open blocker to close this gap for `anemia`/`kidney_suite_v1`/
     `growth_suite_v1`; see `docs/project_plans/design-specs/rule-authoring-workflow-per-module.md`.
2. **Legal:** route REG-001 + REG-004 memos to legal review. **Status: `not_executed_owner_held`.**
3. **Data-plane push (optional):** the run data is already committed locally at `4144634` in the
   data-plane repo (`research-foundry/.git-data`, private remote `research-foundry-data`). Once that
   repo's unrelated in-flight drift is reconciled (`rf-data status` currently reports `ahead 1,
   behind 2`), run `./scripts/rf-data push` then `./scripts/rf-data pull` on the node to publish it.
   The runs are live on the node's working tree + viewer regardless.

> **IntentTree caveat (2026-07-22).** This repo's `CLAUDE.md` records that **IntentTree tree
> `tree_01KXQ7WC1HQE2GKZSCNDVXA9G7`'s node status is known-stale** — it still shows the merged P0
> work and all 7 verified `rf` runs as `not_started`. That staleness caveat applies here too: do not
> assume any `itt`-reported status for the `EF-WP0`/`EF-WP1` nodes (or any other node this program
> touches) reflects the partial-converter reality recorded above. Verify against this repo's git log
> and this file — starting with the commit that lands this update — before trusting `itt` state for
> this program, and reconcile the tree itself as a separate follow-up; that reconciliation is not
> performed by this update.

## 8. How they were driven (for reproducibility)

Path-B swarm (Claude discovery subagents author `pediatric_cds` source cards → deterministic `rf`
extract→claim-map→synthesize→verify→bundle tail), one run at a time (concurrency limit). Clinical runs used a
**PubMed MCP** discovery lane; regulatory runs used primary government sources (FDA / eCFR / HHS). The reusable,
parameterized driver is `research-foundry/.claude/workflows/rf-pediatric-cds-run-execute.js`
(modes: `clinical` | `regulatory` | `backfill`) — this also satisfies the `RFUP` "parameterize the Path-B
workflow" enhancement noted in [`README.md`](README.md) §6.
