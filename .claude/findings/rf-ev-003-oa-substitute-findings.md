# Findings Register — RF-EV-003 (open-access rights-clear substitute discovery)

Date: 2026-07-21 · Run: `rf_run_20260721_rf_ev_003_pediatric_cds_identify` ·
Report: [`docs/project_plans/expansion/rf-handoff/rf-ev-003-oa-substitute-discovery.md`](../../docs/project_plans/expansion/rf-handoff/rf-ev-003-oa-substitute-discovery.md)

> **Honesty boundary.** This is a SYNTHETIC research output — 6 discovery legs plus an adversarial
> verification pass, all agent-run. It is not clinical validation and not credentialed clinical
> review. It may identify candidate sources and **de-claim** existing ones; it may never authorise a
> threshold change. Every re-anchoring it proposes needs clinical approver sign-off first.

## Why this run existed

EP-3/EP-4 closed with **0 of 91 rules and 0 of 26 candidates source-supported** (R-7 in
[[wave0-ep3-ep4-evidence-governance-findings]]). 32 of those rules cite `AAP2026_IDA`, whose full
text returns HTTP 403 / subscription-required. The question asked here was deliberately *different*
from REG-002's: not "can we get AAP?" but "can the underlying clinical content be anchored to
different sources entirely?"

## The finding that reframes the program

**Paywalled ≠ unlicensed, and buying access does not create a licence.**

The pre-run assumption — including in this session's own first recommendation — was that obtaining a
legitimate AAP full-text copy would unblock the 32 AAP-citing rules. **That is wrong.** A
subscription grants the right to *read*, not the right to *encode thresholds into a shipped
commercial CDS knowledge base*. The rules are ungrounded because there is no reuse grant, and no
amount of purchased access creates one. The required action, if AAP is to remain the anchor, is a
**negotiated reuse permission from AAP** — a business action, and not obviously the cheapest of the
three licence conversations now on the table.

Corollary that generalises: **"free to read" was the single largest failure class in this run** —
CALIPER (all-rights-reserved despite full PMC text), BSH 2022 (Wiley "Free Access" = read-only),
Mei 2021 (PMC deposit with no grant of any kind), NICE CKS (third-party content, scraping expressly
forbidden), RCH Melbourne (site terms explicitly prohibit derivative works). Any future evidence
work must treat retrievability and licensing as **two independent gates**.

## Coverage outcome (7 targets)

| | Targets |
|---|---|
| **Re-anchorable now** | T1 (authority-downgraded), T3 (children only), T4 (population-scope only) |
| **Readable but not cleared** | T2 (CALIPER all-rights-reserved; AJCP 2019 CC BY-NC), T7 (WHO 2024 CC BY-NC-SA) |
| **No substitute found** | T5 (sTfR index), T6 (three-way microcytic differentiation) |

Two of those gaps are **not sourcing problems**:

- **T5** — sTfR immunoassays are not harmonised (up to ~2.5× across measurement procedures); WHO
  explicitly declines to publish a cutoff; BSH recommends *against* the assay (2C). Nothing
  purchasable fixes this. Retire or assay-gate the sTfR rules.
- **T6** — **BSH 2023** ("such formulae are not likely to be reliable in children… their use is not
  recommended") and **WHO 2007** actively contradict discriminant-index use in children. This is a
  **clinical claim-validity problem before it is a sourcing problem.** If any Mentzer-style
  discriminant is currently encoded, escalate it to clinical approvers regardless of source choice.

## Overclaims caught by the adversarial pass — carry forward

The verify pass refuted 36 of 56 candidates. The instructive ones:

| # | Overclaim | Correction |
|---|---|---|
| 1 | WHO 2007 §3.4 quoted with a bracketed insertion `"[from thalassaemia]"` that **reversed the referent** — actual text says RDW fails to distinguish ID from *anaemia of inflammatory disorders*. The altered quote had been promoted to a program-level signal. | **Strike that finding.** |
| 2 | CDC 1998 race-based Hb adjustment attributed to CDC | It is the **Institute of Medicine's**; CDC's very next sentence declines to issue race-specific cutoffs. Encoding it would create a rule the source refuses to make. |
| 3 | A WebFetch **summariser** returned internally inconsistent numerics (identical values for Hb and RDW in one age band) | Caught only by re-parsing raw HTML. **Treat any summariser-produced clinical number as a lead, never a retrieval.** |
| 4 | `WHO/UCN/NCD/2024` cited as the 2024 guideline's reference number | **That number does not exist** in the document (zero grep hits); it is identified by ISBN only. |
| 5 | WHO haemoglobin values treated as g/dL | WHO publishes **g/L**. A units error here is a factor-of-ten clinical error — must be owned by the EP-2 units/range registry, never converted inline at ingest. |

Item 3 is the same defect shape as EP3T5's root cause and as RG-1: **a guarantee asserted where data
is produced rather than verified against the referent.** Three independent phases have now produced
it.

## Danger flagged

WHO Rec 1.3's **">150 µg/L in menstruating women" is an iron-OVERLOAD threshold.** The T3 claim area
as worded invites misreading it as a deficiency cutoff. Do not let it enter the KB in that role.

## Recommended next actions (none are engineering)

1. **Two licence conversations, in priority order** — both cheaper than further research:
   - **BSH/Wiley for `10.1111/bjh.17900`** — closest existing analogue to the AAP report, already
     free-to-read, single society, explicitly covers children. Highest value per unit of effort.
   - **OUP permissions for AJCP 2019 (CC BY-NC) and/or CALIPER (AJCP 2020)** — the only route to
     age- *and* sex-stratified pediatric Hb + MCV + RDW in one place; OUP names the contact in the
     licence itself.
2. **Escalate T5/T6/T7 as claim-retirement candidates**, not sourcing tasks.
3. **Do not silently re-point the 32 AAP-citing rules.** Re-anchoring is a *clinical re-decision*,
   not a citation find-and-replace: Mei 2023's 21.2 µg/L, CDC 1998's ≤15 µg/L, and the currently
   encoded AAP ≤20 ng/mL are three materially different thresholds.

## Status of the rf run itself

`rf_run_20260721_rf_ev_003_pediatric_cds_identify` is registered on the node but remains
**`status: planned`**. The `POST /api/runs` endpoint scaffolds and registers only — it does not drive
the discovery swarm. Discovery here was driven **out-of-band by Claude Code agents**, so the run
directory on the node does **not** contain these results; this repo is the artifact of record. Two
consequences worth recording:

- The run's auto-triage collapsed the seven substitution targets into a single generic question
  (`rq_001`, "What does the evidence say about RF-EV-003…"). The full objective survived in the brief
  body only. **Do not read that run's `questions` block as the research design.**
- Nothing here has passed `rf verify`. These findings carry no rf governance verdict.

## Related

- [[wave0-ep3-ep4-evidence-governance-findings]] — R-7 (0/91 grounding) is the gap this run addressed.
- REG-002 / RF-EV-002 (recorded in `.claude/progress/wave0-safety-foundation/phase-0-progress.md`
  SC-4) — established AAP inaccessibility and WHO's CC BY-NC-SA 3.0 IGO terms. This run does not
  supersede them; it routes around the question they answered.
