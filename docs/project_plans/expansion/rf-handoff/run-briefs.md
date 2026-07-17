---
title: "Pediatric CDS — rf run briefs"
description: "Self-contained brief per registered rf run. Mirrors the text registered on the node so agents have full context without the repo."
created: 2026-07-17
---

# Pediatric CDS — rf run briefs

Each brief below is self-contained (it mirrors the `text` registered on the node, so an rf agent driving
the run has full context even without this repo). All runs share the **output contract** (`pediatric_cds`
evidence-card extension + exact-passage locators) and **governance** in
[`README.md`](README.md) §3 / §7. Do not re-derive those here — honor them everywhere.

Legend: **Gates** = the platform phase this evidence unblocks · **Route** = rf run (+ legal review where noted).

---

## RF-EV-001
**Run:** `rf_run_20260717_rf_ev_001_pediatric_cds_backfill` · **Gates:** P1 · **Priority:** P0 (gates next phase) · **Route:** rf

**Objective.** Backfill exact-passage locators (page/section + verbatim quote) for the **6 existing
pediatric anemia evidence sources** already in `data/evidence.json`, so every current anemia rule ties
to a verifiable passage. This is the lowest-risk run and de-risks Evidence Foundry E0 (it gives the
converter a known-good, fully-located vertical slice).

**Inputs.** `data/evidence.json` (6 records), `data/rules.json`, `data/candidates.json` — the current
anemia KB. The 6 sources are already chosen; this run does **not** discover new sources, it *locates and
verifies* the existing ones.

**Per-source output.** Authoritative citation · exact locator (page/section) · verbatim
threshold/statement text · `pediatric_cds` extension block (population, assay/method, threshold, lifecycle).

**Acceptance.** All 6 sources have exact-passage locators + verbatim text; every anemia rule's evidence
IDs resolve to a located passage; nothing marked source-supported that lacks a passage.

---

## RF-CBC-001
**Run:** `rf_run_20260717_rf_cbc_001_pediatric_cds_establish` · **Gates:** P2 (neutropenia branch) · **Priority:** P0 · **Route:** rf (module template)

**Objective.** Establish the **neutropenia scope-exit / red-flag** evidence base for the pediatric CBC
module: age-specific ANC thresholds, severe congenital neutropenia, malignancy and marrow-failure
referral triggers, and the safe scope boundary (what the module must **not** interpret). This is the
**longest-lead CBC item** — start early.

**Source classes.** Pediatric hematology guidelines / society statements, CALIPER-style pediatric
reference intervals, peer-reviewed pediatric neutropenia literature. Record required authoritative
sources searched + exclusions.

**Output.** Per-claim exact-passage locators + verbatim thresholds + `pediatric_cds` extension. Explicit
scope-exit list (referral triggers) distinguished from interpretive claims.

**Acceptance.** Neutropenia interpretation + scope exits fully evidence-backed; red-flag/referral
triggers enumerated with sources; conflicts preserved; no diagnosis/treatment/dosing content.

---

## RF-CBC-002
**Run:** `rf_run_20260717_rf_cbc_002_pediatric_cds_establish` · **Gates:** P2 (pancytopenia branch) · **Priority:** P0 · **Route:** rf (module template)

**Objective.** Establish **pancytopenia / multilineage marrow-failure** scope-exit evidence and
urgent-referral triggers: inherited marrow failure syndromes, aplastic anemia, marrow infiltration, and
the confirmatory/referral pathway.

**Source classes.** As RF-CBC-001, plus marrow-failure-syndrome references.

**Output & acceptance.** As RF-CBC-001, scoped to pancytopenia/multilineage. Emphasize urgent-referral
triggers and the boundary where the module hands off rather than interprets.

---

## RF-KID-001
**Run:** `rf_run_20260717_rf_kid_001_pediatric_cds_evidence` · **Gates:** P4 (kidney/urinalysis pathway) · **Route:** rf (module template)

**Objective.** Evidence base for the pediatric kidney/urinalysis pathway: **CKiD U25 creatinine** and
**combined creatinine + cystatin** eGFR equations, plus hematuria / proteinuria / blood-pressure
interpretation thresholds and scope exits (dialysis / transplant / AKI).

**Output.** Per-claim exact-passage locators + verbatim equations/thresholds (with units, UCUM) +
`pediatric_cds` extension. eGFR equations captured verbatim with their validity population.

**Acceptance.** Equations + thresholds fully located and population-scoped; scope exits enumerated;
method dependence recorded.

---

## RF-GRO-002
**Run:** `rf_run_20260717_rf_gro_002_pediatric_cds_evidence` · **Gates:** P5 (growth / nutrition pathway) · **Route:** rf (module template)

**Objective.** Evidence for the growth-faltering / nutritional-deficiency pathway: **WHO/CDC
anthropometric z-score trajectories**, thresholds for faltering, and adaptive staged nutritional-testing
logic.

**Output.** Per-claim exact-passage locators + verbatim z-score definitions/thresholds + `pediatric_cds`
extension. Growth-standard provenance (WHO vs CDC, age band) explicit.

**Acceptance.** z-score definitions + faltering thresholds located and standard-scoped; staged-testing
evidence captured as claims (not logic); conflicts between standards preserved.

---

## REG-001
**Run:** `rf_run_20260717_reg_001_pediatric_cds_map_the` · **Gates:** P0 (unblocks E1 posture) · **Priority:** P0 · **Route:** rf + **LEGAL REVIEW**

**Objective.** Map the platform against the **FDA non-device Clinical Decision Support** criteria (21st
Century Cures Act §3060 / FDA CDS guidance) and produce an **intended-use / non-device-CDS positioning
memo**. Output the four CDS criteria, how a deterministic evidence-linked pediatric lab-interpretation
module maps to each, and the boundary conditions that would make it a regulated device.

**Route note.** Research input only — **flag for legal review; not legal advice.** Cite regulatory
sources with exact locators.

**Acceptance.** Four criteria mapped with cited sources + exact locators; device-boundary conditions
enumerated; memo explicitly marked pending legal review.

---

## REG-004
**Run:** `rf_run_20260717_reg_004_pediatric_cds_scope_the` · **Gates:** P3 (server/PHI monetizable layer) · **Route:** rf + **LEGAL REVIEW**

**Objective.** Scope the **HIPAA controls** required for the P3 server/PHI surface (SMART App Launch,
longitudinal patient state, work queues): administrative / physical / technical safeguards,
minimum-necessary, BAA obligations, audit/logging, and the boundary that keeps the public microsite
PHI-free.

**Route note.** Research input only — **flag for legal review.** Cite regulatory sources with exact locators.

**Acceptance.** Controls checklist mapped to the P3 architecture with cited sources + exact locators;
public-microsite PHI-free boundary stated; marked pending legal review.
