---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-3+EP-4: Evidence Provenance & Rule Governance"
status: draft
created: 2026-07-19
phase: EP-3+EP-4
phase_title: "Evidence Provenance & Rule Governance"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
feature_slug: wave0-safety-foundation
entry_criteria: "EP-1 and EP-2 both closed and converged; DEF-1 already resolved in EP-0-T6."
exit_criteria: "Every one of 91 rules resolves to an exact evidence passage or an explicit implementation-proposal flag; clinicalApprovers[] ships empty and is test-enforced; npm run check green."
---

# Phase EP-3+EP-4: Evidence Provenance & Rule Governance (WP3 + WP4)

**Maps to roadmap/PRD WP3 (EP-3) and WP4 (EP-4).** Grouped in one file per a strict serial edge:
EP-4's `sourcePassageId` field must point at passage IDs that EP-3 mints — building EP-4 before EP-3
finalizes passage IDs means rework. **EP-3 = 10 pts, EP-4 = 5 pts, combined 15 pts.**

**Dependencies**: EP-1 and EP-2 both complete and converged (this phase is content-shaped, not
engine-shaped — it consumes the tri-state/unit substrate but does not re-touch it).
**Assigned Subagent(s)**: `general-purpose` (converter build, EP-3; codemod, EP-4);
`documentation-writer` (evidence content QA, EP-3); `artifact-validator` (secondary, EP-4).
**Entry criteria**: **DEF-1 is already resolved** (EP-0-T6, D-2) — `src/evidence.js` is no longer a
second hand-maintained copy of `modules/anemia/evidence.json`. This phase does not redo that work; it
extends the now-single evidence source.
**Exit criteria**: `scripts/validate-kb.mjs` reports 91/91 rules with a resolvable `sourcePassageId` or
explicit `implementation-proposal` flag; all 91 rules validate against the extended `rule.schema.json`
in one commit; `clinicalApprovers[]` is `[]` on all 91 rules and test-enforced (D-4); `npm run check`
green.

## EP-3: Exact-Passage Evidence Records (10 pts)

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EP3-T1 | `schemas/evidence.schema.json` | Per FR-WP3-02: new schema formalizing passage-level records — `sourceLocator` {page/section/table/figure}, `exactPassage`, `evidenceGrade`, `applicability` {age/sex/assay}, `reviewDate`, `supersedes`, `surveillanceQuery`, `status` (`source-supported`/`implementation-proposal`). | Schema validates a passage record for each of the 6 sources; a record with neither `exactPassage` nor `status: implementation-proposal` fails validation. | 1.5 pts | general-purpose | sonnet | high | Entry (DEF-1 resolved) |
| EP3-T2 | `rf`-bundle → KB-pack converter | Per FR-WP3-03 (OQ-2 resolved: lives in this repo, registers as satisfying `EF-WP0`): new, deterministic, re-runnable converter consuming the verified RF-EV-001 bundle (48 claims: 35 supported/8 inferred/5 speculation, `rf verify` exit 0). | Re-running the converter against unchanged input reproduces byte-identical output; the converter is the only path that mints passage records — no hand-authored passage bypasses it. | 3.0 pts | general-purpose | sonnet | high | EP3-T1 |
| EP3-T3 | Backfill passage records for all 6 evidence sources (FR-WP3-04, AC-WP3-ENUM) | Per **AC-WP3-ENUM** (target_surfaces: `modules/anemia/rules.json` grouped by cited source — `AAP2026_IDA` 32 citing rules, `BLOOD2022_PED_ANEMIA` 55, `WHO2024_HB` 8, `CDC2025_LEAD` 7, `BSH2020_G6PD` 6, `FDA2026_CDS` 0 citing rules/non-blocking; `modules/anemia/evidence.json` 6 source records): run EP3-T2's converter against RF-EV-001 to mint a passage-level record per source. **REG-002** (content-rights review, launched in EP-0-T8) gates verbatim-quote vs. paraphrase-only wording — paraphrase-only until REG-002 clears. | propagation_contract: converter mints records for each of the 6 sources; every record resolves either as `source-supported` (locatable passage) or `implementation-proposal` (explicit sentinel), never silent absence. resilience: n/a (content backfill). visual_evidence_required: false. verified_by: EP3-T4, EP4-T2. | 3.0 pts | general-purpose | sonnet | medium | EP3-T2 |
| EP3-T4 | Extend `scripts/validate-kb.mjs` for passage resolution | Per FR-WP3-05: every `rule.evidence[]`/`candidate.evidence[]` reference must resolve to a passage-level record or an explicit `implementation-proposal` flag. | `npm run validate` fails on any evidence reference resolving to neither; passes 91/91 once EP-4 wires `sourcePassageId`. | 1.0 pt | general-purpose | sonnet | high | EP3-T1, EP3-T3 |
| EP3-T5 | Passage-fidelity audit (cross-family lens) | Independent audit of EP3-T3's backfilled passages against the source RF-EV-001 bundle claims — proven pattern on this exact corpus (a prior gpt-5.6 audit caught 3 passage-fidelity gaps in the `rf` bundles). | Every backfilled passage is verified to trace correctly to its RF-EV-001 claim, or a discrepancy is filed and corrected before EP-4 references it. | 1.0 pt | general-purpose | gpt-5.6-terra (`codex exec`) | high | EP3-T3 |
| EP3-T6 | R-P2 resilience — consumers handle absent evidence fields (AC-WP3-RESIL) | target_surfaces: `src/engine.js` (provenance/ruleAudit assembly), `src/app.js` (citation rendering), `src/algorithmExplorer.js` (evidence display), `scripts/validate-kb.mjs`. propagation_contract: engine/UI code reads evidence records through the new accessor; a legacy-shape record encountered mid-migration must not throw. | resilience: absent `sourceLocator`/`exactPassage` renders as "locator pending" in UI and surfaces as a `validate-kb` warning, not a crash; absent `applicability` is treated as "unrestricted" only when `status: implementation-proposal`, otherwise validation fails. verified_by: EP3-T1, EP3-T4. | 0.5 pts | documentation-writer | sonnet | adaptive | EP3-T1, EP3-T4 |

**EP-3 subtotal: 10 pts.**

## EP-4: Rule Metadata for Governance (5 pts)

**Strict serial dependency**: EP-4 does not start until EP-3's passage IDs exist to reference.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EP4-T1 | Extend `rule.schema.json` with governance fields | Per FR-WP4-01: extend the `additionalProperties: false` schema (`:7`) with `version`, `effectiveDate`, `retireDate`, `owner`, `safetyClass`, `requiredTestCaseIds[]`, `changeRationale`, `sourcePassageId`, `clinicalApprovers[]` — explicit typed nulls/empty-arrays so legitimate absence is schema-representable (Risk 6). | Schema accepts explicit `null`/`[]`; omission of a required field still fails; this is a single, reviewable schema diff, not an incremental rollout (no incremental path exists under `additionalProperties: false`). | 1.0 pt | general-purpose | sonnet | medium | EP-3 (passage IDs minted) |
| EP4-T2 | Single-commit codemod over all 91 rules | Per FR-WP4-02: populate `version`/`effectiveDate`/`owner`/`safetyClass`/`sourcePassageId`/`changeRationale` on all 91 rules in one commit; `requiredTestCaseIds[]` populated where an EP-6 fixture already exists, else an explicit empty array. Explicitly cheap, mechanical, high-token, near-zero judgment work — never route to a premium model. | All 91 rules validate against the extended schema in one commit; `npm run validate` exits 0; the diff is mechanically generated and reviewed as a diff of *generated* content. | 2.5 pts | general-purpose | haiku | medium | EP4-T1, EP3-T4 |
| EP4-T3 | **D-4 structural test — `clinicalApprovers[]` empty (FR-WP4-03, AC-D4)** | Per **D-4/AC-D4** (target_surfaces: `schemas/rule.schema.json`, `modules/anemia/rules.json`): a dedicated `node:test` asserts `clinicalApprovers` is `[]` on all 91 rules, and **fails** if it is populated from any non-owner-attested source — including ARC council output. This is the single most important AC in this phase; it is a structural guarantee, not documentation. | Test fails if any rule's `clinicalApprovers[]` is non-empty in any build this phase produces; passes today; the test's failure message names the offending rule id(s), not a generic assertion failure. | 1.0 pt | general-purpose | sonnet | high | EP4-T2 |
| EP4-T4 | R-P2 resilience — consumers handle absent governance fields (FR-WP4-04, AC-WP4-RESIL) | target_surfaces: `modules/anemia/rules.json`, `src/ruleEngine.js`, `src/engine.js` (provenance assembly), `scripts/validate-kb.mjs`. propagation_contract: code reading the 9 new fields must treat `retireDate: null` as "active," `clinicalApprovers: []` as "no credentialed approval yet" (never "approved"), and `requiredTestCaseIds: []` as "no test-case linkage yet" (never "exempt from testing"). | resilience: `version`/`effectiveDate`/`owner`/`safetyClass`/`sourcePassageId` missing is a schema validation failure (not optional); `retireDate`/`clinicalApprovers`/`supersedes`-style fields are legitimately null/empty and must never be treated as errors. verified_by: EP4-T1, EP4-T2. | 0.5 pts | artifact-validator | sonnet | adaptive | EP4-T2 |

**EP-4 subtotal: 5 pts.**

**Combined phase total: 15 pts.**

## Phase EP-3+EP-4 Quality Gates

- [ ] 91/91 rules resolve `sourcePassageId` to a passage record or an explicit `implementation-proposal`
      flag (EP3-T4, cross-checked by EP4-T2)
- [ ] Passage-fidelity audit clears with zero unresolved discrepancies (EP3-T5)
- [ ] AC-WP3-RESIL: absent evidence fields degrade to "locator pending," never a crash (EP3-T6)
- [ ] All 91 rules validate against the extended `rule.schema.json` in one commit (EP4-T1/T2)
- [ ] **AC-D4 structural test passes: `clinicalApprovers[]` is `[]` on all 91 rules, and the test fails
      on any non-owner-attested population** (EP4-T3)
- [ ] AC-WP4-RESIL: absent governance fields never misread as errors or as exemptions (EP4-T4)
- [ ] `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../wave0-safety-foundation-v1.md)
