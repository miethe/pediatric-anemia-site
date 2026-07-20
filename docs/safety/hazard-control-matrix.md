# Dangerous-Miss Hazard-to-Control Release-Dependency Manifest

**Status:** machine-checkable manifest, cross-verified against live repository state. This document is
a human-readable index into `docs/safety/hazard-control-matrix.json`; the JSON file, validated by
`schemas/hazard-control-matrix.schema.json` and cross-checked by `tests/hazard-control-matrix.test.mjs`,
is the source of truth. Nothing in this prose file is independently authoritative.

**Plan:** `arc-clinical-council-adoption-v1`, task P4-T2. Acceptance criterion AC P4.1.
**Predecessor:** P4-T1 (`schemas/dangerous-miss-scenario.schema.json`,
`tests/fixtures/dangerous-miss/SYNTHETIC-DM-*.json`, `tests/dangerous-miss-scenarios.test.mjs`).
**Sibling:** P4-T3/P4-T4 (`docs/clinical/v3-diagnostic-accuracy-contract.md`,
`docs/clinical/v4-v5-safety-human-factors-contract.md`) — those contracts note this matrix as the
binding target for `v4SilentModeProtocol.wouldBeAlertCapturePlan` ("a capture method plus a resolved
reference to plan task P4-T2's hazard-to-control matrix"). This file is that reference target.

---

## 0. What this is, and what it is not

This manifest binds each of the ten `DM-CBC-001`..`DM-WORKFLOW-010` hazards (catalog:
`agentic-research/runs/2026-07-19-pediatric-expansion-arc-readiness/validation_plan.md`) to:

1. the rule/control id(s) that mitigate it (or an explicit, owned finding when none exists);
2. the required test(s) that exercise it;
3. the candidate/rule (or local-profile) version it is bound to;
4. evidence, kept in two structurally distinct fields — `technicalExecution` (repository-level,
   synthetic, at best V2-class evidence) and `clinicalAdjudication` (owner-held, OQ-6, always
   `not_executed_owner_held` in this repository); and
5. a named owner role and the release gate(s) it blocks.

It does **not** execute a study, adjudicate a hazard, approve a candidate, or authorize any release
state. `releaseDependencyManifest.clinicalValidationComplete` and `.credentialedReviewComplete` are
schema-pinned `const: false` for the same reason `docs/clinical/v3-diagnostic-accuracy-contract.md`'s
`v3DependencyChain.clinicalValidationComplete` is: no evaluator in this repository can prove the full
chain end to end, and none is added here.

## 1. NO UNOWNED GAP

Eight of the ten hazards have an implemented, executable control: the anemia-assessment engine
(`src/engine.js`) or the P3 local-applicability evaluator (`scripts/lib/local-applicability.mjs`).
**Two do not, and this is recorded as an explicit, owned finding rather than papered over:**

| Hazard | Family | Why no control exists | Owner (release gate) | Finding |
|---|---|---|---|---|
| `DM-EQUITY-009` | `subgroup_or_access_failure` | No subgroup/equity evaluator exists anywhere in this codebase; `assessPediatricAnemia` does not accept or reason over any subgroup/access dimension. | `equity-and-family-governance-owner` | `PAC-P4T2-001` |
| `DM-WORKFLOW-010` | `alert_override_downtime_handoff_or_recovery_failure` | No alert-lifecycle/work-queue state machine (acknowledgment, escalation, override, downtime replay, handoff, recovery) exists; `assessPediatricAnemia` is a stateless pure function evaluated once per run. | `pediatric-safety-owner` | `PAC-P4T2-002` |

Both findings carry `blockedOnTask` pointing at P4-T4 (V4/V5 protocol-through-adjudication contracts),
verified byte-for-byte against the P4-T1 fixture's own `executionBinding.blockedOnTask`
(`tests/hazard-control-matrix.test.mjs`, "the two no_control_exists hazards independently verify
against the live P4-T1 fixture"). Both additionally block `repository_ready`,
`readiness_audit_complete`, and `qualifying_runtime_pilot` — not only the credentialed/clinical/release
states every other hazard also blocks — because there is no implemented control to claim repository
readiness for.

The schema enforces this structurally (`hazardControlBinding.if/then/else` in
`schemas/hazard-control-matrix.schema.json`): a row with `controlBinding.status: no_control_exists`
**must** carry a non-null `finding` with a named `ownerRole` and a non-empty `blockedOnTask`, and
**cannot** carry any `controlIds`. A row with `controlBinding.status: control_bound` **must** carry at
least one control id and **cannot** carry a `finding`. `tests/hazard-control-matrix.test.mjs` proves
this is enforced, not decorative, with three NEGATIVE tests: blanking a `no_control_exists` row's
`finding` to `null`, dropping `ownerRole` from an open finding, and emptying `controlIds` on a
`control_bound` row are all confirmed schema-invalid.

## 2. The ten-row summary

| Hazard | Control type | Control id(s) | Test coverage | Version binding | Reviewer role | Release-gate owner |
|---|---|---|---|---|---|---|
| `DM-CBC-001` | engine rule | `ALERT-004`, `ALERT-005`, `ALERT-009`, `MARROW-001/002/003` | positive + negative | `modules/anemia/{rules,candidates,module}.json` | `pediatric-safety-human-factors-reviewer` | `pediatric-safety-owner` |
| `DM-HEME-002` | engine rule | `HEM-003` | positive + negative | `modules/anemia/{rules,candidates,module}.json` | `pediatric-hematology-reviewer` | `pediatric-safety-owner` |
| `DM-AGE-003` | engine rule | `SCOPE-001`, `SCOPE-003` | positive + negative | `modules/anemia/{rules,candidates,module}.json` | `general-pediatrics-reviewer` | `pediatric-safety-owner` |
| `DM-URGENT-004` | engine rule | `ALERT-001`, `ALERT-009` | positive + negative | `modules/anemia/{rules,candidates,module}.json` | `pediatric-safety-human-factors-reviewer` | `pediatric-safety-owner` |
| `DM-IRON-006` | engine rule | `Q-MICRO-001`, `Q-MICRO-005` | positive + negative | `modules/anemia/{rules,candidates,module}.json` | `pediatric-hematology-reviewer` | `pediatric-safety-owner` |
| `DM-LAB-005` | applicability blocker | `SPECIMEN_MISMATCH`, `ANALYZER_MISMATCH`, `METHOD_MISMATCH`, `UNIT_MISMATCH` | positive + negative | `SYNTHETIC-reference-interval-profile` | `pediatric-laboratory-medicine-reviewer` | `local-laboratory-director` |
| `DM-RESULT-007` | applicability blocker | `CORRECTION_UNRESOLVED`, `SUPERSEDING_REFERENCE_UNRESOLVABLE` | positive + negative | `SYNTHETIC-terminology-profile` | `clinical-informatics-interoperability-reviewer` | `clinical-informatics-and-privacy-owner` |
| `DM-FHIR-008` | applicability blocker | `UNMAPPED_LOCAL_CODE` | positive + negative | `SYNTHETIC-terminology-profile` | `clinical-informatics-interoperability-reviewer` | `clinical-informatics-and-privacy-owner` |
| `DM-EQUITY-009` | **none** | — | honesty-guard only | none available | `pediatric-equity-patient-family-reviewer` | `equity-and-family-governance-owner` |
| `DM-WORKFLOW-010` | **none** | — | honesty-guard only | none available | `pediatric-safety-human-factors-reviewer` | `pediatric-safety-owner` |

Owner-role attribution for the eight implemented rows follows the decisions-block risk register
(`.claude/worknotes/arc-clinical-council-adoption-v1/decisions-block.md` section 6): `DM-LAB-005`
maps to `local-laboratory-director` (`PAC-RISK-002`); `DM-RESULT-007`/`DM-FHIR-008` map to
`clinical-informatics-and-privacy-owner` (`PAC-RISK-003`, matching `validation_plan.md`'s
`PEDS-INFO-001`/`PEDS-INFO-002` "Clinical informatics + privacy/security" validation owner); the
remaining dangerous-miss hazards map to `pediatric-safety-owner` (`PAC-RISK-004`, the DM catalog's own
risk-register owner); `DM-EQUITY-009` maps to `equity-and-family-governance-owner` (`PAC-RISK-007`).

## 3. AUTHORED vs EXECUTED (plan hard constraint 4)

Every row's `evidence` field keeps two facts structurally separate:

- **`technicalExecution`** — for the eight implemented hazards, `repository_test_executed`: their
  positive and negative assertions run against the live engine/applicability evaluator as part of
  `npm run check` (185/185 passing at the P4-T1 baseline; 209/209 after this task adds 24 more
  subtests). This is repository-level, synthetic, technical evidence only — **never** clinical
  adjudication or owner approval. For the two unimplemented hazards, `not_executed`: the only tests
  that run are the honesty-guard tests proving the fixture declares `not_yet_implemented` rather than
  fabricating coverage.
- **`clinicalAdjudication`** — `not_executed_owner_held` for all ten rows, unconditionally. OQ-6 (the
  authoritative approval/adjudication system) is unresolved; this repository never sets `adjudicated`
  on its own authority (plan hard constraint 2), and the schema enforces that `systemRef` stays `null`
  unless `status` is `adjudicated`.

## 4. Release states blocked (BUILD STATE CANNOT SATISFY STUDY STATE)

Every one of the ten hazards blocks `credentialed_review_complete`, `clinical_validation_complete`,
`certified_for_defined_scope`, `released`, and `activated` — no credentialed human approval (P2-T3),
V3/V4/V5 execution (P4-T3/P4-T4 protocols remain `not_executed_owner_held`), or qualifying pilot
(P5) has happened for any hazard in this matrix. The two unimplemented hazards additionally block
`repository_ready`, `readiness_audit_complete`, and `qualifying_runtime_pilot`, because there is no
implemented control to claim technical readiness for. The eight implemented hazards do **not** assert
those three states as achieved — their absence from `blockedReleaseStates` means "not blocked by this
specific hazard," never "this state is achieved." `readiness_audit_complete` for the *program* (not
per-hazard) remains gated on P4-V1 (the eight-lens council coordinator review), which has not yet run.

## 5. Owner-held gaps

Nothing below may be filled in by a repository agent.

| Gap | Carrier | Who holds it | What would satisfy it | State |
|---|---|---|---|---|
| Subgroup/equity control for `DM-EQUITY-009` | `hazardControlBinding[DM-EQUITY-009].controlBinding` | `equity-and-family-governance-owner` + implementation | A signed equity/subgroup evaluator design and its implementation, bound by digest, plus an owner-approved V5 equity protocol (see `docs/clinical/v4-v5-safety-human-factors-contract.md` `equityAndAccessibilityPlan`). | `not_executed_owner_held` |
| Alert-lifecycle control for `DM-WORKFLOW-010` | `hazardControlBinding[DM-WORKFLOW-010].controlBinding` | `pediatric-safety-owner` + implementation | A signed alert/work-item state-machine design and its implementation (see `docs/clinical/v4-v5-safety-human-factors-contract.md` `alertWorkflowLifecycleBinding`), bound by digest. | `not_executed_owner_held` |
| Credentialed human approval for every hazard | `evidence.clinicalAdjudication` | `clinical-governance-owner` (+ per-row `ownerBinding.releaseGateOwnerRole` co-sign) | Named credentialed review bound to the exact candidate digest and this matrix's version (plan section 6, P2-T3/P5-T4). | `not_executed_owner_held` |
| Authoritative adjudication/approval system (OQ-6) | `evidence.clinicalAdjudication.systemRef` | `clinical-governance-owner` | A governance ADR naming the system; this repository stores a reference/status only. | owner-held (OQ-6) |
| Program-level `readiness_audit_complete` | not carried in this schema | council coordinator (P4-V1) | Execution of P4-V1: the eight specialty lenses plus methods, safety, human-factors, and equity review over this matrix and the P4-T1 fixtures. | pending (P4-V1 not yet run) |

## 6. Related artifacts

| Artifact | Path |
|---|---|
| Machine-readable manifest (source of truth) | `docs/safety/hazard-control-matrix.json` |
| Schema | `schemas/hazard-control-matrix.schema.json` |
| Cross-verification test lane | `tests/hazard-control-matrix.test.mjs` |
| P4-T1 dangerous-miss scenario schema and fixtures | `schemas/dangerous-miss-scenario.schema.json`, `tests/fixtures/dangerous-miss/SYNTHETIC-DM-*.json` |
| P4-T1 execution test lane | `tests/dangerous-miss-scenarios.test.mjs` |
| V3 dependency contract (sibling, P4-T3) | `docs/clinical/v3-diagnostic-accuracy-contract.md` |
| V4/V5 dependency contracts (sibling, P4-T4; binds this matrix by reference for `wouldBeAlertCapturePlan`) | `docs/clinical/v4-v5-safety-human-factors-contract.md` |
| DM hazard catalog (source of truth for the ten hazards) | `agentic-research/runs/2026-07-19-pediatric-expansion-arc-readiness/validation_plan.md` (read-only reference; ARC repository, not this one) |
| Risk register (owner-role attribution source) | `agentic-research/runs/2026-07-19-pediatric-expansion-arc-readiness/risk_register.yaml` (read-only reference) |
| Plan owning this task | `docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md` (section 4, P4-T2; AC P4.1) |

---

## 7. Revision history

**1.0.0 — initial hazard-to-control release-dependency manifest (P4-T2).** Binds all ten
`DM-CBC-001`..`DM-WORKFLOW-010` hazards to control ids (or an owned finding), required tests,
candidate/profile version, evidence, owner, and blocked release gates. Independently re-verifies
P4-T1's claim that `DM-EQUITY-009` and `DM-WORKFLOW-010` have no executable engine, rather than
trusting it. Enforces NO UNOWNED GAP structurally via schema `if/then`, proven by three NEGATIVE
tests. Keeps `technicalExecution` and `clinicalAdjudication` as separate fields so a green `npm run
check` can never be read as clinical adjudication (plan hard constraint 4).
