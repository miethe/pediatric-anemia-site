---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-R1: Derived-Fact Coverage Gap"
status: draft
created: 2026-07-21
phase: EP-R1
phase_title: "Derived-Fact Coverage Gap"
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
feature_slug: rights-aware-evidence-capture
entry_criteria: "EP-R0 merged: rights/ tree, amended vendored schemas, validate-rights.mjs and its package.json wiring in place. (Degradation path: FR-WP1-05 allows this phase to ship against a minimal record set if the substrate stalls.)"
exit_criteria: "modules/anemia/reference-ranges.json has a rights record; every KB_JSON_FILES entry resolves to a rights record bidirectionally; removing a record, adding a 5th covered file, or pointing a ledger entry at a deleted path each fail npm run validate; golden-fixture output unchanged; npm run check green."
planning_maturity: ready
---

# Phase EP-R1: Derived-Fact Coverage Gap (WP1)

**Maps to PRD WP1.** **3 pts.** Wave 2, parallel with EP-R2.

The findings' single most actionable technical finding: the derived-fact channel
(`modules/anemia/reference-ranges.json` → `deriveFacts()` → all 91 rules) sits outside the
passage-level gating that catches the 32 AAP-citing rules. A rules-only rights sweep misses it
entirely.

**Dependencies**: EP-R0 (substrate). Degrades to standalone per FR-WP1-05.
**Assigned Subagent(s)**: `general-purpose` (primary), model `sonnet`, effort `high` — small phase,
but it must fail closed, and a fail-open here is invisible.
**Entry / exit criteria**: as frontmatter.

## Integration Ownership (R-P3)

EP-R1 and EP-R2 both edit `scripts/validate-kb.mjs` in the same wave. **`integration_owner = EP-R1`.**
EP-R1 lands the ledger-resolution helper (EPR1-T2) that resolves a covered artifact path to a rights
record. EP-R2's EPR2-T5 is the consumer side: it adds a *call site* for evidence sources and does not
restructure, rename, or re-signature the helper. If EP-R2 finds the helper's shape wrong, that is an
escalation to the plan owner, not a unilateral refactor. `package.json` is untouched by this phase
(EP-R0 barrier).

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EPR1-T1 | Rights record for `reference-ranges.json` | Per FR-WP1-01: author a rights record for `modules/anemia/reference-ranges.json` itself, recording its AAP Table 1 derivation, its **32** numeric values (4 age bands × 2 sexes × `hbLower`/`mcvLower`/`mcvUpper`/`rdwUpper`), that the file ships byte-identical to the browser SPA, and that AAP is a *redistributor* here (the table is credited to "(ref 42)"), which introduces a third-party rightsholder beyond AAP. | The record exists, validates against the amended vendored schema, and names the derived-fact channel (`reference-ranges.json` → `deriveFacts()` → rules) explicitly. The redistributor fact is a structured field, not a free-text aside. **Negative criterion:** clearance status is `UNKNOWN` or an explicitly non-cleared triage value; no `CLEARED_*` value is written. | 0.75 pts | general-purpose | sonnet | high | EP-R0 |
| EPR1-T2 | Bidirectional coverage gate (seam owner) | Per FR-WP1-02 and FR-WP1-03: add a coverage gate asserting every file in `scripts/sign-kb.mjs`'s `KB_JSON_FILES` (`rules.json`, `candidates.json`, `evidence.json`, `reference-ranges.json`) resolves to a rights record through `rights/rights-ledger.json`, **and** that every ledger entry resolves to an existing artifact path. Land the shared resolution helper in `scripts/validate-kb.mjs` (R-P3 owner side); the gate logic itself lives in `validate-rights.mjs`. | All 4 `KB_JSON_FILES` entries resolve. The gate is coverage-shaped only: it asserts a record *exists*, never that it is cleared. The helper is exported and call-site-agnostic so EPR2-T5 can reuse it without modification. | 1.0 pt | general-purpose | sonnet | high | EPR1-T1 |
| EPR1-T3 | Fails-closed resilience tests | Per FR-WP0-06's fails-closed discipline: `tests/rights-coverage.test.mjs` proves the gate fails on each of three seeded breakages — (a) delete any one of the 4 rights records, (b) add a 5th path to `KB_JSON_FILES` without a record, (c) point a ledger entry at a deleted path. | Each of the three fixtures makes `npm run validate` exit non-zero, and each failure message names the specific artifact or ledger entry at fault. A fourth test asserts a record whose `clearance_status` is `UNKNOWN` still passes — the gate never fails on a clearance value (D7). | 0.75 pts | general-purpose | sonnet | high | EPR1-T2 |
| EPR1-T4 | No-clinical-change proof | Per FR-WP1-04: this phase changes no value in `reference-ranges.json` and does not alter `deriveFacts()` behaviour. Verify by golden-fixture equivalence across all 6 examples plus `npm run coverage:rules`. | Golden-fixture output shows zero diff across all 6 examples; `git diff` shows `modules/anemia/reference-ranges.json` unmodified; `modules/anemia/facts.anemia.js` unmodified; `npm run coverage:rules` still reports 91. | 0.25 pts | general-purpose | sonnet | high | EPR1-T2 |
| EPR1-T5 | Standalone degradation mode | Per FR-WP1-05 (Should): the gate must be independently exercisable against a fixture directory containing only the `reference-ranges.json` record, so this phase can ship if EP-R0's substrate stalls. | The gate's unit tests pass against a minimal fixture directory holding one rights record and one ledger entry, with no `release-context.json` and no vendored-schema amendment layer present. | 0.25 pts | general-purpose | sonnet | high | EPR1-T3 |

**Phase total: 3 pts.**

## Phase EP-R1 Quality Gates

- [ ] `reference-ranges.json` has a rights record naming the 32 values and the AAP-as-redistributor fact (EPR1-T1)
- [ ] All 4 `KB_JSON_FILES` entries resolve to a rights record, bidirectionally (EPR1-T2)
- [ ] Gate fails on each of the 3 seeded breakages, with a specific message (EPR1-T3)
- [ ] A record at `clearance_status: UNKNOWN` still passes — coverage-shaped, not clearance-shaped (EPR1-T3, D7)
- [ ] Zero clinical change: golden-fixture zero-diff across 6 examples; `reference-ranges.json` byte-unchanged (EPR1-T4)
- [ ] Gate runs standalone against a minimal fixture set (EPR1-T5)
- [ ] `scripts/validate-kb.mjs` helper is exported and reusable by EPR2-T5 without modification (R-P3)
- [ ] `package.json` untouched by this phase (EP-R0 barrier)
- [ ] No `CLEARED_*` status, attestation, or approval value written by this phase
- [ ] `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../rights-aware-evidence-capture-v1.md)
