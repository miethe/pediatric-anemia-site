---
title: "Pediatric CDS Platform — Expansion Plan (master)"
description: "Executive synthesis of the two-track expansion: the phased product platform and the Evidence Foundry runtime powered by Research Foundry. Front door to docs 01 and 02."
status: proposed
created: 2026-07-17
owner: Nick Miethe
program_status: UNVALIDATED research prototype (v0.3.1) — software tests prove behavior, not clinical validity.
---

# Pediatric CDS Platform — Expansion Plan (master)

> **Read this first.** This is the executive synthesis and the front door. Depth lives in the two
> companion deep-dives:
> - **[01 — Platform Expansion Roadmap](01-platform-expansion-roadmap.md)** — the phased product /
>   clinical / engineering / validation plan (Phases P0→P6, per-phase research, gates, AOS wiring,
>   machine-readable seed). *(authored by Fable 5)*
> - **[02 — Evidence Foundry on Research Foundry](02-evidence-foundry-on-research-foundry.md)** — the
>   secondary track: how the "Evidence Foundry" evidence-to-executable-CDS pipeline is **built on our
>   `rf` control plane** rather than rebuilt (the seam, the per-module run template, the
>   `rf-bundle → kb-pack` converter, governance, gap register). *(authored by gpt-5.6-sol)*
>
> Source strategy package: `../pediatric-cds-expansion-dr.md` (deep-research strategy) and
> `../pediatric-cds-commercialization-package-2026-07-16/` (commercialization + current-app spec +
> the reusable Research Foundry module prompt).

## 1. The decision

**Do not commercialize the anemia calculator as a standalone endpoint.** Use it as the first public,
clinically validated module of a two-layer pediatric laboratory-interpretation platform:

1. **PedsLab Pathways** — a pediatric CBC/lab interpretation *suite* (pathways + longitudinal
   workspace + work queues + referral-readiness), not another calculator collection.
2. **Evidence Foundry runtime** — a governed research-to-executable-CDS pipeline that turns pediatric
   guideline/study churn into versioned, tested, signed rule packs.

**Strategic thesis (from the strategy docs):** *anemia is the wedge, CBC interpretation is the
product, and evidence-to-executable-CDS is the moat.* The paid value is EHR context, local reference
ranges, longitudinal state, referral/documentation outputs, validated modules, and accountable
evidence maintenance — **not** static medical facts (which CALIPER/PediTools already give away free).

**The Evidence Foundry is powered by Research Foundry (`rf`), not rebuilt.** `rf` already owns the
hard evidence-operations work (durable run folders, source/extraction cards, claim ledger with
contradiction/inference status, deterministic verification with governance exit codes, council
review, bundle lineage, writeback). The CDS platform owns only the clinical-safety half. The single
seam: **`rf` owns evidence → verified claim; the CDS platform owns verified claim → executable rule →
validated, signed release.** See doc 02 §1.

## 2. The plan at a glance

Two synchronized tracks. The **product track** (Phases P0–P6, doc 01) builds the platform and its
modules; the **Evidence Foundry track** (increments E0–E2, doc 02) supplies every module's clinical
content. E-increments run *continuously* from P1 onward — no module's rules are ever hand-authored or
AI-published; each is an `rf`-verified, clinician-reviewed, signed pack.

| Phase | Title | Wave | Depends on | Validation gate | Effort | Evidence Foundry |
|---|---|---|---|---|---|---|
| **P0** | Platform foundation refactor (module-agnostic runtime + per-module KB packages; anemia stays green) | 0 | — | V2 technical (byte-equivalent anemia output) | L | — |
| **P1** | Wave-0 safety & defensibility foundation (tri-state data, local range+unit service, exact-passage evidence, signed KB manifest + semantic diff, expanded validation corpus, review-portal contract) | 0 | P0 | V1 content + V2 technical | XL | **E0 wire-up** (`rf-bundle → kb-pack` on hand-seeded evidence) |
| **P2** | CBC Suite (neutropenia · leukocytosis/eosinophilia · platelets · pancytopenia · smear) — first new clinical content | 1 | P1 | V1 + V2 + V3 retrospective | XL | **E1 operate** (live discovery + council + dual clinical review) |
| **P3** | Longitudinal workspace + referral-readiness + SMART-on-FHIR / CDS Hooks (the monetizable layer; triggers server/PHI + HIPAA) | 2 | P2 | V2 + V4 silent-mode + V5 human-factors | XL | E1 continues |
| **P4** | Kidney / Urinalysis pathway (CKiD U25 eGFR, hematuria/proteinuria/BP) | 3 | P3 | V1 + V2 + V3 | L–XL | per-module `rf` runs |
| **P5** | Growth Faltering / Nutritional Deficiency pathway (z-score trajectory, adaptive staged testing) | 3 | P3 | V1 + V2 + V3 | L | per-module `rf` runs |
| **P6+** | Pilots (neonatal bilirubin, analyzer-augmented heme, personalized-baseline surveillance) + adjacent modules + enterprise/commercial layer | 4 | P2, P3 | track-specific (V4/V6) | XL, ongoing | **E2 maintain** (surveillance, impact analysis, signed updates, rollback) |

**Critical path:** `P0 → P1 → P2 → P3 → {P4 ∥ P5} → P6`. **The single most important sequencing rule
is *structure before safety before content*** (doc 01 §A.2): refactor to a module-agnostic runtime
(P0) and install the tri-state/exact-passage/signed-manifest safety contract (P1) **before** any
second clinical module — authoring CBC rules against today's boolean model and un-located evidence
would force a full rework. Schedule drivers (retrospective V3, silent-mode V4) gate *release*, not
*build*; every module's `rf` evidence runs have no code dependency and launch ~one phase ahead.

**Calendar anchoring (directional, from the DR roadmap):** 90 days ≈ P0 + most of P1 + E0. 12 months
≈ P2 + P3 (CBC + kidney beta, retrospective + silent mode, PEDSnet/CALIPER partnerships). 36 months ≈
P4/P5 + P6 (interventional studies, enterprise/API licensing).

## 3. The Evidence Foundry seam (why this is the moat, and how it plugs in)

The Evidence Foundry is a thin clinical compilation/release layer over `rf`. Per doc 02:

- **`rf` gives us free:** run lineage, source/extraction cards, claim ledger, deterministic
  synthesis, `verify` with exit-code governance (0 ok · 3 governance · 4 unsupported-claim · 7
  human-review), council, bundle, writeback. Do **not** build a second crawler or claim store.
- **We build in the CDS repo (net-new):** the `rf-bundle → kb-pack` converter (emits `data/evidence.json`
  assertions + `data/rules.json` proposals conforming to `schemas/rule.schema.json` + a test corpus +
  an unsigned manifest), typed facts/units registry, the rule DSL compiler, FHIR/terminology emitters,
  the retrospective/silent-mode validation harnesses, dual clinical-review records, and KB signing.
- **The invariant chain preserved end-to-end:** `source → passage → claim → decision → rule → test →
  output → release`, with "source-supported fact" vs. "implementation proposal" distinguishable
  everywhere, conflicts never silently collapsed, and missingness never read as normal.
- **Rollout:** **E0** wires the deterministic spine + converter for a hand-seeded CBC vertical slice
  (offline; the current 0/6 live adapters do *not* block it). **E1** adds live discovery via the
  hardened `rf` Path-B Claude workflow + council + dual clinical review → preclinical signed release
  candidate. **E2** adds guideline-change surveillance, claim-to-release impact analysis, semantic
  diff, signed updates, and rollback.

The per-module `rf` run template (doc 02 §3) operationalizes the reusable **Research Foundry module
prompt** (`../pediatric-cds-commercialization-package-2026-07-16/Pediatric_CDS_Module_Research_Foundry_Prompt.md`)
— capture → triage → plan → ingest → extract → claim-map → synthesize → verify → council → bundle,
with a required pediatric evidence-card extension and a converter-eligibility gate.

## 4. AOS scaffolding installed for this program

This repo is now wired into the Agentic OS (the "scaffold this project" half of the task). Everything
below is committed to the repo except the IntentTree graph, which lives on the persistent node.

| Artifact | What / where | Purpose |
|---|---|---|
| **Project starter + dev-loop artifacts** | `.claude/skills/{planning, dev-execution, council-review}`, `.claude/commands/{plan-feature, execute-plan, execute-phase, code-review, pr, pre-pr-validation, create-adr}` (via `skillmeat deploy`) | The `skillmeat-instance-starter` (planning skill + plan-feature command) plus the plan → execute → review → ship dev loop, available in-repo. |
| **AOS writeback hook** | `.claude/hooks/aos-writeback.sh` + `.claude/settings.json` (Stop event) | AARs / DECISIONS auto-flow to the node story-inbox + vault on session stop — no agent memory required. |
| **Project context** | `CLAUDE.md` | Orients any agent on the hard clinical guardrails, architecture, and AOS routing. |
| **Operator run record** | `.operator/runs/op_run_20260717_050047_pediatric-cds-platform-e/` (`op new --tier 3`) | Durable operator tracking of the expansion program. |
| **IntentTree task graph** | Tree **`tree_01KXQ7WC1HQE2GKZSCNDVXA9G7`** ("Pediatric CDS Platform Expansion") in the **Work** workspace (`ws_01KV8VMWXK05CTAZVHKT57HY0H`) — 1 pillar + **11 work-areas** (P0–P6 product phases + `EF` Evidence Foundry + `EVID` rf research runs + `RFUP` rf-upstream enhancements + `XC` cross-cutting) + **63 work-packages** + dependency links. Product phases seeded from doc 01 §E; the EF/EVID/RFUP/XC work-areas added 2026-07-17. | Live, navigable, delegatable program graph. `itt tree get tree_01KXQ7WC1HQE2GKZSCNDVXA9G7` / `itt today` to drive it. |
| **RF handoff package** | [`rf-handoff/`](rf-handoff/) — manifest + self-contained per-run briefs; the 7 evidence/regulatory `rf` runs registered on the agentic node with `run_id`s written back to their IntentTree nodes, and as of 2026-07-18 driven end-to-end to `verified` per each run's on-disk `reviews/verification.yaml` (see [`rf-handoff/RESULTS.md`](rf-handoff/RESULTS.md), which supersedes the `planned` status below). | Makes rf agents ready to plan + drive every evidence run with full context. |

> Tooling note: the graph was seeded via the REST API because the `itt tree create` CLI currently
> has a `title`/`name` field skew (a separate CLI↔API fix). Node/link creation via `itt` is fine.

## 5. Immediate next actions (do these first)

Ordered. The first block is the 90-day / P0–P1 + E0 wedge.

1. ~~Kick off P0 (platform foundation refactor).~~ **Status (2026-07-18): complete and merged to
   `main`** as commit `ff4b519a160cbfa2a4d19337130cd031c9a7c12b` ("Platform foundation P0:
   `modules/<id>/` package contract", squash of a 7-phase Tier-3 execution). V2 gate AC-1..AC-6 passed
   — see `.claude/worknotes/platform-foundation-p0/v2-gate-results.md` and
   `.claude/progress/platform-foundation-p0/plan-completion.md` (per-wave commit trail + reviewer
   verdicts; note the two files live in different directories — `worknotes/` vs `progress/`).
   Zero clinical behavior change; byte-identical `assess()` output for all 6 worked examples is
   enforced by a permanent golden-fixture equivalence harness. **Current next action is P1 (Wave-0
   safety & defensibility foundation, doc 01 §Phase 1):** the PRD and Tier-3 implementation plan are
   authored on branch `worktree-wave0-safety-foundation`
   (`.claude/worktrees/wave0-safety-foundation/`, unmerged) but **implementation has not started** —
   do not treat the existence of that plan as executed Wave-0 safety work.
2. **Launch the P0-priority research runs in parallel** (no code dependency — doc 01 §D).
   **Status (2026-07-18): all 7 driven end-to-end and `verified`** — superseding the
   `registered + planned` (2026-07-17) status. Load-bearing evidence is each run's on-disk
   `runs/<run_id>/reviews/verification.yaml` (`passed: true`, `exit_code: 0`, `generated_at` between
   2026-07-18T17:09 and 20:27 — after the 2026-07-17 "planned" snapshot), not the RF API's
   `status_derived`/`verification_passed`/`governance_verdict` fields, which read identically
   (`published` / `true` / `true`) for **all 48 runs in the store** and so cannot by themselves
   distinguish this program's runs from any other. See [`rf-handoff/RESULTS.md`](rf-handoff/RESULTS.md)
   for the full verification table, cross-model audit, and the two runs still needing owner legal
   review (`REG-001`, `REG-004`). What remains is the CDS-side `rf-bundle → kb-pack` converter
   (`EF-WP0`, not yet built) that turns these verified evidence bundles into rule *proposals* — the
   bundles themselves are not rules and confer no clinical validity.
   - `RF-EV-001` exact-passage backfill for the 6 anemia sources → `rf` run. Verified.
   - `RF-CBC-001` (neutropenia scope-exits) and `RF-CBC-002` (pancytopenia marrow-failure exits) →
     `rf` runs, using the doc 02 §3 module template. These gate P2. Verified.
   - `REG-001` intended-use / non-device-CDS mapping memo → `rf` + flagged legal review. Verified
     as an evidence bundle; legal review itself remains `not_executed_owner_held`.
   - Also completed: `RF-KID-001` (P4), `RF-GRO-002` (P5), `REG-004` (P3 HIPAA, legal review
     `not_executed_owner_held`).
3. **Stand up E0 of the Evidence Foundry** (doc 02 §7.2): pick the CBC *vertical slice*, hand-seed
   its authoritative sources, run the offline `rf` deterministic spine, and build the first cut of the
   `rf-bundle → kb-pack` converter emitting proposals only (nothing release-ready). This proves the
   seam before P2 scales it.
4. **Convene the clinical advisory board + content-governance SOP** (COMM 90-day; cross-cutting C.3):
   pediatric heme, lab medicine, general peds, informatics. Nothing ships without dual sign-off.
5. **Start 20–30 buyer/design-partner interviews** (`MKT-001`; cross-cutting C.4) and secure at least
   one data partner for the eventual retrospective + silent-mode validation.
6. **Write the ADRs that unblock E1** (doc 02 §8.5): canonical authoring model + rule schema v2;
   exact-passage storage/licensing; terminology + local-profile ownership; clinical-approval identity;
   KB serialization/signing/key custody; validation data boundary; surveillance cadence; Path-B
   hardening vs. native adapter install. Use `/create-adr`.

## 6. Research backlog

Doc 01 §D consolidates ~60 research items, tagged **CE** (clinical-evidence → `rf` run) · **TS**
(technical spike) · **MK** (market) · **RG** (regulatory), each mapped to the phase it gates, a route
(`rf` / spike / council / interview / legal), and a priority (P0 = gates next phase start · P1 = gates
that phase's exit · P2 = derisks). The machine-readable seed (doc 01 §E) mirrors this into the
IntentTree graph. **The gating P0-priority items are:** `SPIKE-001/002` (P0 refactor design),
`RF-EV-001` (exact passages), `RF-CBC-001/002` (CBC scope-exits), `REG-001` (intended-use),
`SPIKE-003` (tri-state migration), `SPIKE-010/013` (SMART launch + minimal-PHI), `RF-KID-001` (CKiD
U25), `RF-GRO-002` (growth z-scores), `SPIKE-015` (calc-lib pattern), `REG-004` (HIPAA).

## 7. Hard guardrails (every phase, non-negotiable)

- No autonomous diagnosis. No patient-facing CDS. No unsupported confidence %. No treatment / dosing /
  transfusion directives. **Generative AI never makes the final patient-specific decision.**
- No invented thresholds: every clinical statement ties to a source; every rule cites an exact passage
  or is flagged an implementation proposal. **Missingness is never treated as normal.**
- No PHI in the public microsite (browser-only invariant). Server/PHI mode (P3) is a separate,
  HIPAA-controlled surface.
- No random calculator expansion. **No AI-published rule changes** — `rf` output is a *proposal* that
  passes the clinical-review portal + executable tests + signed release.
- The ranking score is an ordinal priority, **not** a probability or performance metric.
- **The product remains an UNVALIDATED research prototype until the V1–V6 gates for a given module are
  actually passed.** `npm run check` proves software behavior, not clinical validity.

## 8. Risks & strategy tripwires

- **Clinical (doc 02 §8.2):** invented/decontextualized thresholds, missingness collapse, local-method
  mismatch, conflict erasure, automation bias, dangerous distraction, stale evidence, scope creep into
  treatment. Each has a named control in doc 02.
- **Platform (doc 02 §8.3) & governance (§8.4):** two sources of KB truth, upstream `rf` schema drift,
  mutable upstream runs, CLI stdout parsing, exit-7 mishandling, review theater, retraction-response
  delay, PHI leakage into research, content-rights breach.
- **Strategy tripwires (doc 01 §C.5 / DR "what would change the strategy"):** a competitor ships true
  pediatric local-range longitudinal CDS with multisite validation; prospective trials show no
  referral/efficiency gain for CBC/renal; local-range variability proves too small to create
  enterprise value; host-response biomarker panels become standard/reimbursable; FDA interpretation
  narrows the non-device CDS space. Any of these → re-rank the portfolio.

## 9. How to work this program

- **Route non-trivial ideas through `op`.** Clinical/evidence questions are **`rf` runs**, never
  freehand medical claims. Track work in the **IntentTree** graph (§4). Adversarial/"pilot-vs-build"
  decisions → **`council-review`**.
- **Per phase:** `/plan-feature` → PRD + impl-plan (`planning`) · `council-review` gate on
  safety-critical designs · `/execute-plan` / `/execute-phase` under `dev-execution` (git-worktree →
  commit-per-phase → PR) · `/code-review` + `/pr` + `/pre-pr-validation` to ship. `npm run check` must
  be green on every commit; no rule ships without an exact passage + dual clinical sign-off.
- **Capture AARs** at the end of each phase — the Stop-event writeback hook flows them into the AOS
  story pipeline automatically.
