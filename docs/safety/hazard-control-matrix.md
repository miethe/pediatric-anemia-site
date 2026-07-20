# Dangerous-Miss Hazard-to-Control Release-Dependency Manifest

**Status:** machine-checkable manifest, cross-verified against live repository state. This document is
a human-readable index into `docs/safety/hazard-control-matrix.json`; the JSON file, validated by
`schemas/hazard-control-matrix.schema.json` and cross-checked by `tests/hazard-control-matrix.test.mjs`,
is the source of truth. Nothing in this prose file is independently authoritative.

**P4-V1 remediation (gate reopened, three specialty lenses independently found blocking gaps):** this
revision adds two new structurally-enforced disclosures — `productIntegration` (§1a: is the control
actually reachable in the shipped product?) and `coverageFinding` (§1b: does a control_bound row's
control cover the *whole* hazard family, or only part of it?) — and a structural precondition-dependency
marker on `DM-WORKFLOW-010`'s finding (§1). See `.claude/findings/` for the full council record; this
file only carries what changed structurally and why.

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

## 1a. `productIntegration` — control_bound is not the same as "protects the deployed app" (P4-V1 R1)

**Found independently by the lab-medicine and general-pediatrics review lenses at P4-V1.** The original
manifest asserted `control_bound` for `DM-LAB-005`, `DM-RESULT-007`, and `DM-FHIR-008` (the three
`applicability_blocker` rows) with `evidence.technicalExecution.status: repository_test_executed` and no
signal anywhere that the bound function, `scripts/lib/local-applicability.mjs`, has **zero production
callers**: `src/app.js` (the entrypoint `index.html` loads) imports only `./engine.js`, `./evidence.js`,
and `./algorithmExplorer.js`; `src/engine.js` imports only `./ruleEngine.js` and
`./modules/registry.js`. Worse, `schemas/patient-input.schema.json` — the only input surface the shipped
app accepts — has no `specimen`, `analyzer`, `method`, or `unitCode` property at any level, so the gated
dimensions cannot even be entered through the shipped form. A release-readiness reader could otherwise
read "3 of 10 rows control_bound, verified by execution" as "the shipped tool protects against these
three hazard families today." That reading was false for all three.

Every row now carries a **required** `productIntegration` disclosure — a prose paragraph is explicitly
insufficient, because a paragraph is exactly what let this defect live outside AC P4.1's
`target_surfaces` in the first place:

| Field | Meaning |
|---|---|
| `status` | `reachable_in_shipped_product` \| `repository_only_not_reachable_by_deployed_app` \| `not_applicable_no_control_exists` (mirrors `controlBinding.status: no_control_exists`) |
| `productCallers` | File/function locators that actually invoke the control from `src/app.js`'s call graph; empty unless `reachable_in_shipped_product` |
| `inputSurfaceSupported` | true only if every input dimension the control needs is a declared property of `schemas/patient-input.schema.json` |
| `evidence` | The concrete grep/read evidence the status was verified against |
| `finding` | Non-null, owned, blocking exactly when `status: repository_only_not_reachable_by_deployed_app` (schema `if/then`, same pattern as §1) |

Result: `DM-CBC-001`, `DM-HEME-002`, `DM-AGE-003`, `DM-URGENT-004`, and `DM-IRON-006` (the five
`engine_rule` rows) are `reachable_in_shipped_product` — `src/app.js` really does call
`assessPediatricAnemia`, and every field those rows' rule(s) key off is on the shipped input schema.
`DM-LAB-005`, `DM-RESULT-007`, and `DM-FHIR-008` are now `repository_only_not_reachable_by_deployed_app`,
each carrying a new critical, owned finding (`PAC-P4T2-003`/`004`/`005`, `local-laboratory-director` /
`clinical-informatics-and-privacy-owner`). **Wiring the evaluator into the product is explicitly OUT OF
SCOPE for this repair** — it is product/engineering work, blocked on the same downstream task as every
other open finding in this matrix, not something a disclosure fix authorizes.

## 1b. `coverageFinding` — a control_bound row can still cover only PART of a hazard family (P4-V1 R2)

**Found by the hematology review lens at P4-V1.** `DM-HEME-002` is `control_bound` (`HEM-003`), and
`HEM-003` correctly covers the row's own P4-T1 fixture scenario. But the fixture scenario is not the
whole hazard family: hemolysis markers positive **with `reticulocytes.response: "low"` (not
`"unknown"`)** — the signature of an aplastic crisis (e.g. parvovirus B19 on hereditary spherocytosis or
sickle cell disease) — reaches **no rule at all** unless `history.knownChronicHemolyticDisease` AND
`history.recentViral` are both already known true (only `PARVO-001` reaches it). A first presentation, or
a known patient whose history was not captured this encounter, produces a silent empty differential and
no alert — indistinguishable from routine incomplete workup. `tests/dangerous-miss-scenarios.test.mjs`
now carries a permanent regression test (`DM-HEME-002 REGRESSION (P4-V1 R2)`) reproducing this against
the live engine.

`coverageFinding` is a new, required (nullable) field on every row, structurally identical in shape to
`finding`: null when the bound control(s) are understood to cover the hazard family as scoped, non-null
when a materially more dangerous branch has no control. `DM-HEME-002` carries `PAC-P4T2-006`
(`pediatric-safety-owner`). **Whether the engine should gain a history-independent aplastic-crisis safety
net rule is clinical content authority this repository task does not hold** — that is recorded as the
finding's `blockedOnTask`, not authored into `modules/anemia/rules.json`.

## 1c. R6 — `DM-LAB-005`'s coverage boundary against the P3 critical-value lane

**Found by the lab-medicine review lens at P4-V1.** No P4 dangerous-miss scenario exercises any
`BLOCKER.CRITICAL_VALUE_*` code (`CRITICAL_VALUE_MISSING`, `CRITICAL_VALUE_CONFLICT`,
`CRITICAL_VALUE_NOT_ASSERTED`, `CRITICAL_VALUE_UNIT_MISMATCH`, `CRITICAL_VALUE_BOUNDS_MISSING`) —
that mechanism is real and independently tested, but only in the P3 lane
(`tests/local-applicability.test.mjs` + `tests/fixtures/local-profile/negative-cases.json`), never by a
P4 fixture. `DM-LAB-005`'s `controlBinding.rationale` now says so explicitly, cross-referencing that
lane, so the row's coverage claim reads as scoped to `SPECIMEN_MISMATCH` / `ANALYZER_MISMATCH` /
`METHOD_MISMATCH` / `UNIT_MISMATCH` only, not the whole `unit_specimen_method_or_range_mismatch` family.

## 1d. R8 — `DM-WORKFLOW-010`'s gap is a precondition dependency, not a sibling-scope gap

**Found by the general-pediatrics review lens at P4-V1.** The "8 of 10 hazards control_bound, 2 open" /
"two of ten carried, not closed" framing invites a downstream "80% mitigated" misreading. It is wrong:
`DM-WORKFLOW-010`'s missing alert-lifecycle control (acknowledgment, escalation, override, downtime
replay, handoff, recovery) is a **precondition** for every other hazard's alert having any practical
clinical effect, not a tenth sibling gap of equal scope. Generating a correct alert (what the other nine
rows' `controlBinding` covers) is not the same as that alert being seen, acted on, or not silently lost
to an unattended queue or a downtime gap. `DM-WORKFLOW-010`'s `finding.preconditionForHazardIds` — a new,
required, structurally-checkable array field on every `finding` — now lists all nine other hazard ids
explicitly, and `finding.description` states the PRECONDITION DEPENDENCY framing in full. Every other
finding in the matrix (`DM-EQUITY-009`'s, and the three new `productIntegration.finding`s, and
`DM-HEME-002`'s `coverageFinding`) carries an empty `preconditionForHazardIds` — the claim is scoped to
this one gap, not inflated.

## 1e. R11 — note only, nothing changed

`DM-HEME-002`'s fixture supplies `labs.datStatus: "unknown"`, which no rule in the engine references for
this row's own scenario (AIHA-001/HS-001 read `datStatus`, but neither is reachable from this fixture's
finding pattern). Non-blocking; recorded here per the P4-V1 general-pediatrics lens finding so it is not
re-discovered as if new. No field was added or changed for this item.

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

**1.1.0 — P4-V1 remediation: product-integration disclosure, coverage disclosure, precondition
dependency (gate reopened; three specialty lenses independently FAILed the 1.0.0 manifest).** Adds
`productIntegration` (required on every row; §1a) so `control_bound` can never again be silently read
as "protects the deployed app" — `DM-LAB-005`, `DM-RESULT-007`, `DM-FHIR-008` are re-labelled
`repository_only_not_reachable_by_deployed_app` with new critical findings `PAC-P4T2-003`/`004`/`005`
(R1, found independently by the lab-medicine and general-pediatrics lenses; `scripts/lib/local-
applicability.mjs` has zero production callers and `schemas/patient-input.schema.json` has no
specimen/analyzer/method/unitCode property). Adds `coverageFinding` (required nullable on every row;
§1b) so a `control_bound` row can disclose partial-family coverage — `DM-HEME-002` carries
`PAC-P4T2-006`, a critical finding that its bound control does not reach the aplastic-crisis
presentation (hemolysis markers + `reticulocytes.response: "low"` without prior known history), with a
permanent regression test in `tests/dangerous-miss-scenarios.test.mjs` reproducing the silent miss
against the live engine (R2, hematology lens). Cross-references the P3 `CRITICAL_VALUE_*` lane from
`DM-LAB-005`'s rationale so its coverage boundary is visible (R6, lab-medicine lens). Adds
`finding.preconditionForHazardIds` (required array on every finding) and populates it on
`DM-WORKFLOW-010`'s finding with all nine other hazard ids, making the PRECONDITION DEPENDENCY framing
structurally checkable rather than a prose caveat that invites an "80% mitigated" misreading (R8,
general-pediatrics lens). Notes, without changing anything, that `DM-HEME-002`'s fixture supplies an
unreferenced `datStatus: "unknown"` (R11, non-blocking). All three new required-field guards
(`productIntegration`, `coverageFinding`, `finding.preconditionForHazardIds`) are proven to discriminate
by `tests/hazard-control-matrix.test.mjs` NEGATIVE tests. No clinical content (rule, threshold,
severity, or hazard definition) was authored or modified — every gap this revision closes is a
disclosure/structural-enforcement gap; every gap it could not close is recorded as an explicit, owned,
blocking finding instead.
