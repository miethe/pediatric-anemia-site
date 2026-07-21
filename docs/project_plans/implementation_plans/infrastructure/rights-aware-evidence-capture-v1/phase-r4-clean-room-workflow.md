---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-R4: Clean-Room Authoring Workflow"
status: draft
created: 2026-07-21
phase: EP-R4
phase_title: "Clean-Room Authoring Workflow"
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
feature_slug: rights-aware-evidence-capture
entry_criteria: "EP-R3 merged: the three axis fields, structured locators, not_captured[], and derived_synthesis candidate type exist, so a brief has atoms with a stable shape to summarise."
exit_criteria: "Clean-room workflow doc maps spec §9's five roles onto real artifacts and names the unfilled ones; a deterministic brief generator produces byte-identical output on unchanged input; a contamination guard test fails a quoting brief; rights-decision ledger validates bidirectionally on the RG-9 seam; the positive credential/attestation checks exist and are fixture-exercised while the live ledger is empty and a test asserts it; npm run check green."
planning_maturity: ready
---

# Phase EP-R4: Clean-Room Authoring Workflow (WP4)

**Maps to PRD WP4.** **5 pts.** Wave 4, alone. Ships the **brief generator** and the **ledger
plumbing**; it ships **zero attestations**.

Clinician time is the binding constraint (D5). This phase optimises for *clinician* minutes, not agent
minutes: agents prepare a decision-ready brief, a human adjudicates. The brief summarises source
guidance and must never quote it into the implementation record — otherwise the clean room is
contaminated and the separation-of-duties defence is lost.

**Dependencies**: EP-R3 (taxonomy, locators, `derived_synthesis` shape).
**Assigned Subagent(s)**: `general-purpose` (primary), model `sonnet`, effort `high` — D5/D6
discipline is the whole point of the phase.
**Entry / exit criteria**: as frontmatter.

## Integration Ownership (R-P3)

This phase has **no file overlap with any other phase** — it adds `docs/workflows/clean-room-authoring.md`,
`scripts/rights/build-decision-brief.mjs`, and new tests, and extends
`rights/rights-ledger.json`'s shape.

It reuses, rather than duplicates, the RG-9 attestation seam: `loadAttestationLedger` /
`validateBindingsAgainstLedger` in `scripts/evidence/lib/attested-passage-map.mjs`. **It does not
create a second validator** and does not modify `tests/attestation-ledger-gate.test.mjs`, which must
continue to assert an empty attestation ledger, unmodified and passing.

`package.json` is untouched (EP-R0 barrier); the brief generator is invoked through the wiring EP-R0
already landed.

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EPR4-T1 | Clean-room workflow doc | Per FR-WP4-01: author `docs/workflows/clean-room-authoring.md` mapping spec §9's five roles — research reviewer, independent rule author, clinical adjudicator, rights reviewer, technical verifier — onto this repo's actual artifacts and gates, and naming which roles are currently **unfilled**. | Every one of the five roles names its output artifact and its gate, and states whether a qualifying human exists today. The rights owner (OQ-2) and the credentialed clinician are named as **unfilled**, with a note that neither is an engineering task. The doc claims no role is filled by an agent, ARC, or council output. | 1.0 pt | general-purpose | sonnet | high | EP-R3 |
| EPR4-T2 | Deterministic decision-brief generator | Per FR-WP4-02: `scripts/rights/build-decision-brief.mjs` — given an item or binding, emits a decision-ready brief containing independently-worded atoms, structured locators, scope/population, the recorded rights position, and the specific question the human must answer. Fully offline and deterministic; any date input arrives via `--as-of` or env, never `Date.now()`. | Re-running the generator against unchanged input reproduces **byte-identical** output, verified by two runs at different wall-clock times. `grep` finds no `Date.now()` in the file. The brief states the recorded rights position as recorded — it never asserts, infers, or upgrades a clearance. | 1.5 pts | general-purpose | sonnet | high | EPR4-T1 |
| EPR4-T3 | Clean-room contamination guard | Per FR-WP4-03 (D5): `tests/rights-brief-contamination.test.mjs` asserts no generated brief contains a verbatim span from a restricted source. Contaminating a brief fails the **gate**, not merely a review. | A seeded fixture whose atom carries a verbatim span from a restricted source makes the gate exit non-zero. A clean brief passes. The check runs over generator *output*, not over reviewer assurance. Residual gap R-1 applies here too and is referenced, not claimed closed. | 0.75 pts | general-purpose | sonnet | high | EPR4-T2 |
| EPR4-T4 | Rights-decision ledger plumbing on the RG-9 seam | Per FR-WP4-04 (D4): define a rights-decision ledger entry shape that a future rights owner fills, joined **bidirectionally** to rights records and evidence items, reusing `loadAttestationLedger` / `validateBindingsAgainstLedger` rather than adding a second validator. | The ledger validates bidirectionally: an entry pointing at a non-existent record or item fails, and a record with a malformed back-reference fails. `scripts/evidence/lib/attested-passage-map.mjs` is reused, not duplicated — `git diff` shows no second ledger-validation implementation. The live rights-decision ledger ships **empty**. | 1.0 pt | general-purpose | sonnet | high | EPR4-T3 |
| EPR4-T5 | Positive checks for future clearance entries; ledger stays empty | Per FR-WP4-05 and FR-WP4-06 (D6): any future `counsel_approved` / clearance entry must pass the same *positive* checks as RG-14/16/17 — closed credential list, realpath-canonical `attestationRef` under `docs/attestations/`, calendar-valid date — reusing `attested-passage-map.mjs`. This task ships the check; it ships no entry. | The check exists and is exercised by a **fixture** entry, proving it accepts a well-formed entry and rejects a malformed credential, a non-canonical path, and an invalid date. **Negative criterion:** the live ledger is empty and a test asserts it; no `counsel_approved`, `clinicalApprovers[]`, `approvedBy[]`, `approvals.clinical_owner`, `review.clinical_reviewer`, or `CLEARED_*` value is written by this task or any task in this phase. `tests/attestation-ledger-gate.test.mjs` is unmodified and still passes. | 0.5 pts | general-purpose | sonnet | high | EPR4-T4 |
| EPR4-T6 | Brief shape for clinician minutes | Per FR-WP4-07 (Should, D5): the brief is one screen per decision, with the decision question stated **first**, followed by the atoms and locators needed to answer it. The generator may **prepare** `derived_synthesis` candidates and may never mark one authoritative. | Each generated brief states its decision question in the first block and covers exactly one decision. **Negative criterion:** a fixture asking the generator to emit an authoritative `derived_synthesis` fails; the generator's only reachable synthesis output is a `candidate`. | 0.25 pts | general-purpose | sonnet | high | EPR4-T5 |

**Phase total: 5 pts.**

## Phase EP-R4 Quality Gates

- [ ] All five spec §9 roles mapped to a real artifact and gate; unfilled roles named as unfilled (EPR4-T1)
- [ ] Brief generator is deterministic and offline; byte-identical across runs; no `Date.now()` (EPR4-T2)
- [ ] Contamination guard fails a quoting brief as a gate, not a review note (EPR4-T3, D5)
- [ ] Rights-decision ledger validates bidirectionally on the reused RG-9 seam; no second validator (EPR4-T4)
- [ ] Positive credential/path/date checks exist and are fixture-exercised (EPR4-T5)
- [ ] **Live ledgers are empty; a test asserts it. Zero attestations, zero approvals, zero clearances shipped** (EPR4-T5, D6)
- [ ] `tests/attestation-ledger-gate.test.mjs` unmodified and still passing (EPR4-T5)
- [ ] Generator can prepare `derived_synthesis` candidates only; authoritative output unreachable (EPR4-T6, D3/D6)
- [ ] One decision per brief, question first (EPR4-T6, D5)
- [ ] `package.json` untouched (EP-R0 barrier)
- [ ] `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../rights-aware-evidence-capture-v1.md)
