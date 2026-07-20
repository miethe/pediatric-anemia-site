# Phase 4 Completion Note — Executable dangerous-miss and V3-V5 dependencies

**Plan:** `docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md` (§4 P4, AC P4.1)
**Progress:** `.claude/progress/arc-clinical-council-adoption-v1/phase-4-progress.md`
**Isolation:** none — worked directly on `main` in PED. **ARC was not modified by P4.**

---

## Summary

Phase 4 **authored** the executable-safety and study-dependency contracts: ten non-patient synthetic
scenario specifications derived from the existing `DM-CBC-001`..`DM-WORKFLOW-010` catalog, a
machine-checkable hazard-to-control matrix with no unowned gap, and V3/V4/V5 dependency contracts
whose owner-held fields ship as explicit nulls.

The phase passed its gate only after **two reviewer FAILs and three fix cycles**. What it delivers is
contracts, schemas, and tests — not executed clinical evidence. Nothing here advances any release
state.

---

## What was AUTHORED vs what was EXECUTED

This distinction is the phase's central constraint; it is stated here without softening.

**AUTHORED (exists in the repo, nothing more):**
- Ten synthetic scenario specifications, one per DM-* hazard family.
- A ten-row hazard-to-control matrix binding each hazard to controls/tests/owner/release gate.
- V3 diagnostic-accuracy, V4 silent-mode, and V5 summative human-factors dependency contracts.

**EXECUTED:**
- Repository test suites only. PED `npm run check` 305/305; ARC `pytest` 1076 passed / 6 skipped /
  426 subtests; `arc validate .` clean.
- **Eight** of ten hazards execute against real engines in the repository test lane.
- **No clinical suite was executed.** No hazard has been clinically adjudicated. V3, V4, and V5 are
  `not_executed` / `not_executed_owner_held` and block their applicable release states.

Authoring ten fixtures is not executing them. The scenario schema pins `execution` to
`{state: not_executed, receipt: null, result: null, adjudication: null, ownerDecision: null}` by
`const`, so an authored fixture cannot be represented as an executed result.

---

## Tasks

- [x] **P4-T1** → python-backend-engineer — 10 synthetic scenario specs + schema + 46-subtest lane.
- [x] **P4-T2** → python-backend-engineer — hazard-to-control matrix + schema + 24 subtests.
- [x] **P4-T3** → general-purpose — V3 dependency contract + 5-record chain schema.
- [x] **P4-T4** → general-purpose — V4/V5 contracts + schema, `$ref`-bound to V3 primitives.
- [x] **P4-V1** → safety/human-factors + diagnostic-accuracy-methods + equity + task-completion-validator.

---

## Unmitigated hazards — carried, not closed

Two of the ten hazards have **no executable control in this repository**. Independently verified by
three reviewers, not taken on the implementer's word.

| Hazard | State | Finding | Owner role |
|---|---|---|---|
| `DM-EQUITY-009` | no control exists — no equity/subgroup evaluator | `PAC-P4T2-001` | equity-and-family-governance-owner |
| `DM-WORKFLOW-010` | no control exists — no alert-lifecycle/override/downtime/handoff/recovery engine | `PAC-P4T2-002` | pediatric-safety-human-factors-reviewer |

Both block **all eight** release states — three more than the mitigated hazards block
(`repository_ready`, `readiness_audit_complete`, `qualifying_runtime_pilot` additionally). The equity
lens judged this "more conservative than the other eight, which is the correct response to no
implemented control." Fixtures declare `engine: not_yet_implemented` with a required `blockedOnTask`;
a negative test forbids that value without a reason, so the honesty cannot silently regress.

---

## Owner-held gaps left open (OQ-4 / OQ-6 / OQ-2 / OQ-3)

No institution, individual, dataset, data partner, reference standard, endpoint threshold,
terminology server, interval value, participant count, usability threshold, operations-window date,
downtime-procedure owner, or equity protocol is named anywhere. Each ships as an explicit
null-carrying field with a named owner **role** and the authenticated evidence that would satisfy it.

- **V3 (OQ-4):** 14 gaps — intended use, regulatory classification, dataset/sample frame/data partner,
  reference standard + blinding, evidence-rights receipt, endpoint thresholds, uncertainty method,
  subgroup strata + minimum cell size, statistical analysis plan, adjudication system, owner decision,
  privacy/security approval, regulatory confirmation, equity review.
- **V4/V5:** 17 gaps — silent-mode operations window/site, live-EHR data partner, alert/work-item
  lifecycle, downtime procedure owner, V5 participants/recruitment, human-factors measure thresholds,
  equity governance protocol, adjudication system, owner decisions.
- **Hazard matrix:** `evidence.clinicalAdjudication.systemRef` null on all ten rows (OQ-6);
  `ownerBinding.name` null on all ten (OQ-2); candidate/profile binding null on the two no-control rows.

**Build state cannot satisfy study state**, enforced structurally rather than by prose:
`clinicalValidationComplete`, `silentModeValidationComplete`, and `summativeHumanFactorsComplete` are
each `const: false` — no schema-valid document in this repository can assert any of them true.

---

## Validator Verdict — SUPERSEDED, see "P4-V1 REOPENED" below

The verdict recorded in this section was reached with **four of the plan's eight specialty lenses
unrun**. It was subsequently withdrawn. It is retained unedited for audit trail; it is **not** the
phase's verdict.

**P4-V1 (first pass): PASS**, after **FAIL → FAIL → PASS** on the methods lens and one **FAIL** from
the validator.

| Lens | Verdict |
|---|---|
| `diagnostic-accuracy-methods-reviewer` | FAIL (cycle 1) → FAIL (cycle 2) → **PASS** (cycle 3) |
| `pediatric-safety-human-factors-reviewer` | PASS (cycle 1) → **PASS** (re-review, current tree) |
| `pediatric-equity-patient-family-reviewer` | **PASS** |
| `task-completion-validator` | FAIL → required fix performed → **PASS** |

### What the FAILs caught

**Methods cycle 1 (CRITICAL + HIGH).** `endpoints` was absent from V3's `protocol_frozen`
conditional and `endpointDefinition` had no `if/then` — a protocol could reach `protocol_frozen` with
a **null endpoint threshold**, the one field carrying the go/no-go criterion, while the contract's own
§2.2 claimed in prose that freeze required every section asserted. Plus nine locations where
`required` enforced key *presence* but not non-null *content*, so `status: asserted` meant "someone
flipped a status string." This is the P3-V1 defect class verbatim. Root cause: **zero test files
referenced either clinical schema** — both were unenforceable end-to-end.

**Methods cycle 2 (HIGH).** The implementer's claim that "a systematic pass found no additional
instances" was **false**. `datasetAndReferenceStandard.phiHandling` had `null` as a literal enum
member and was omitted from its section's `if/then` — a dataset section could be fully `asserted`,
and a protocol reach `protocol_frozen`, with PHI-handling posture null, directly against the
no-patient-data constraint and contradicting the §7 table titled "enforced by the schema itself." The
proof it was not systematic: the structurally identical V4 sibling `dataBoundaryPosture` *had* been
narrowed. Also `decidedAt` nullable on `go`/`conditional_go` owner decisions.

**Validator (HIGH).** The safety lens's PASS was from cycle 1, and two fix cycles then made material
edits inside its own domain (`goNoGoCriterion`, `humanFactorsMeasureDefinition`,
`equityAndAccessibilityPlan`, `operationsWindow`, V4/V5 owner decisions). Plan §5: "any material edit
invalidates approval." **This was an orchestration error on my part** — I carried a stale approval
forward across changes it never reviewed. Fixed by re-running that lens against the current tree.

### Fix cycles

1. **Cycle 1** — Finding 1 fixed at two locations; nine Finding-2 narrowings; `tests/clinical-contract-schemas.test.mjs`
   created, wiring both schemas into the suite for the first time. Caught a flaw in its own harness:
   an `assertRejected` wrapper treated a thrown exception as "rejected," masking the endpoints guard's
   real signal.
2. **Cycle 1b** — `json-schema-lite.mjs` omitted `exclusiveMinimum`/`exclusiveMaximum` while
   `uncertaintyPlan.confidenceLevel` used both, so the fail-closed keyword check threw and
   whole-document validation was impossible. Implemented (draft 2020-12 numeric form) with the
   fail-closed guard verifiably intact; the reviewer's reproductions now run against whole documents.
3. **Cycle 2** — `phiHandling` narrowed; `decidedAt` narrowed across all three OwnerDecision types;
   nine receipt/result/adjudication types narrowed against their own status (narrow chosen over exempt,
   with written rationale); `supersededBy` enforced on all three protocol types; V4 whole-document
   positive test added; `bundleV4V5Schema()` integration constraint documented.

---

## Validation evidence (independently executed by the validator, not self-reported)

| Command | Result |
|---|---|
| PED `npm run check` | **305 tests, 305 pass, 0 fail** (baseline 139 → 185 → 209 → 218 → 251 → 266 → 305) |
| ARC `uv run pytest` | **1076 passed, 6 skipped, 426 subtests passed**, exit 0 |
| ARC `arc validate .` | clean |
| `git diff --check` (both repos) | exit 0, no output |
| Discrimination proofs | **3/3 reproduced** — reverting `clinicalValidationComplete: const false`, the `endpoints` freeze gate, and the `phiHandling` narrowing each made the targeted tests fail; each file restored byte-identical by hash |

Both clinical lenses disclosed they had **no shell** and marked their verdicts static traces. Every
count above comes from the validator's own execution.

---

## Files Changed (PED only)

| File | Task |
|---|---|
| `schemas/dangerous-miss-scenario.schema.json` | P4-T1 (+ `input.kind` discriminator hardening) |
| `tests/fixtures/dangerous-miss/SYNTHETIC-DM-*.json` (10) | P4-T1 |
| `tests/dangerous-miss-scenarios.test.mjs` | P4-T1 |
| `schemas/hazard-control-matrix.schema.json` | P4-T2 |
| `docs/safety/hazard-control-matrix.{json,md}` | P4-T2 |
| `tests/hazard-control-matrix.test.mjs` | P4-T2 |
| `docs/clinical/v3-diagnostic-accuracy-contract.md` | P4-T3 (v1.2.0) |
| `docs/clinical/schemas/v3-protocol-result.schema.json` | P4-T3 + fix cycles |
| `docs/clinical/v4-v5-safety-human-factors-contract.md` | P4-T4 (v1.2.0) |
| `docs/clinical/schemas/v4-v5-safety-human-factors-result.schema.json` | P4-T4 + fix cycles |
| `tests/clinical-contract-schemas.test.mjs` | fix cycle 1/1b/2 |
| `scripts/lib/json-schema-lite.mjs` | `default` (P4-T1), `exclusiveMinimum`/`exclusiveMaximum` (1b) |
| `tests/json-schema-lite.test.mjs` | 1b |

Pre-existing repo defect fixed as a side effect: `json-schema-lite.mjs` could not validate the repo's
own `schemas/patient-input.schema.json` (unsupported `default` annotation).

---

## Deviations & Risks

1. **The clinical contracts are inert.** V3/V4/V5 schemas are wired into tests but into **no runtime
   importer**. `bundleV4V5Schema()` — the only thing making whole-document validation possible, since
   `resolveRef()` supports only local `#/` refs — is unexported and test-only. A future runtime
   importer will throw unless it duplicates that bundler. Documented in contract §8.1.
2. **`decidedBy.recordId` narrowing** is real but the V3 §9 revision-history sentence claiming every
   `referenceLocator` field is "never narrowed" omits several fields and does not reconcile that
   exception. LOW, prose-precision only; no schema defect hides behind it (verified by two reviewers).
3. **Freeze gates require `minItems: 1`, not full enum coverage** (safety NEW-1, LOW). A protocol can
   reach `protocol_frozen` asserting one of two named V4 go-criteria — potentially omitting
   `missingness_never_silently_clears`, the criterion the contract centres. `contains`/`minContains`
   is already supported by the validator and would close it.
4. **`input` discriminator does not force the *selected* key non-null** (safety NEW-2, LOW). Not live
   across the current ten fixtures.
5. **Equity coverage is quarantined to one row** (equity MEDIUM, non-blocking). The eight implemented
   fixtures carry no subgroup dimension; the scenario schema has no subgroup field at all. Equity load
   plausibly sits inside DM-LAB-005 / DM-RESULT-007 / DM-FHIR-008 (fail-closed rates may differ by
   site-resourcing tier, a proxy correlated with access). Recommended for V3/V4 subgroup analysis.
6. **DM-HEME-002 covers only the missingness branch** of its hazard family, not the
   conflicting-evidence branch the catalog also names. In scope for AC P4.1 as written (one fixture
   per family); flagged rather than silently accepted as full-family coverage.

---

---

# P4-V1 REOPENED — the first PASS was wrong

The gate PASS above was **withdrawn by the coordinator**. The reviewer-count ambiguity flagged at the
bottom of this note was resolved **in favour of the plan**: AC P4.1 requires the eight specialty
lenses; the progress file named only three. The four missing lenses were then run against `7a73cb6`.

| Lens | Verdict |
|---|---|
| `pediatric-hematology-reviewer` | **FAIL** |
| `pediatric-laboratory-medicine-reviewer` | **FAIL** |
| `general-pediatrics-reviewer` | **FAIL** |
| `clinical-informatics-interoperability-reviewer` | PASS, one HIGH finding |

**Three of four additional lenses failed a phase I had already reported complete.** Running fewer
lenses than the AC required did not make the phase pass; it made the failures invisible. That is the
single most important fact in this note.

## What the FAILs caught

**R1 [CRITICAL] — found independently by laboratory-medicine AND general-pediatrics.**
The matrix asserted `control_bound` + `repository_test_executed` + `finding: null` for three hazards
whose control **cannot fire in the shipped product**. `scripts/lib/local-applicability.mjs` has zero
production callers (`src/engine.js`, the function `src/app.js` invokes, never imports it), and
`schemas/patient-input.schema.json` — the only input surface the real app accepts — has no specimen,
analyzer, method, or unitCode property, so the gated dimensions cannot even be entered. The labels
were true of an isolated function and materially misleading about the product: a P5 or release reader
would conclude the shipped tool protects against 8 of 10 dangerous-miss families. For DM-LAB-005,
DM-RESULT-007 and DM-FHIR-008 that was false.

**This one was mine to catch and I did not.** This note's own "Deviations & Risks" §1 disclosed
exactly this inert-artifact problem for V3/V4/V5, and said nothing about it on the hazard matrix —
the surface where it actually misleads. I documented the pattern in one place and missed it in the
adjacent one.

**R2 [CRITICAL] — hematology.** DM-HEME-002 claimed `control_bound` / `finding: null`, but its more
dangerous branch has no engine control. Hemolysis markers positive with `reticulocytes.response:
"low"` — the aplastic-crisis signature (parvovirus B19 on hereditary spherocytosis or sickle cell
disease) — produces **no candidate and no alert** unless `knownChronicHemolyticDisease` AND
`recentViral` are both already captured. A first presentation, or a known patient whose history
wasn't taken this encounter, falls through silently: an empty differential indistinguishable from a
routine incomplete workup. Reproduced against the live engine before any fix (`anemiaStatus:
"present"`, `alerts: []`, `rankedDifferential: []`, only `Q-005` matched) and landed as a permanent
regression test.

**R3 [HIGH] — clinical informatics.** `v3OwnerDecision.signatureRef` *described itself* as making
`signatureState: "bound"` unreachable, with nothing enforcing it and no code backstop. A fabricated
authenticated go-decision validated cleanly against the one field documented as directly authorizing
`clinical_validation_complete`. **This is the P3 defect verbatim — self-declared signature state read
as proof — reintroduced in a schema written after P3 caught it.**

## What was fixed, and what was deliberately not

Disclosure and structural-enforcement fixes landed. Clinical content did not — it is recorded as
owned, blocking, null-carrying findings.

| Item | Disposition |
|---|---|
| R1 | `productIntegration` now a **required, schema-enforced** field on every row (prose was insufficient — the defect was truth living outside AC P4.1's `target_surfaces`). Three rows reclassified `repository_only_not_reachable_by_deployed_app` with blocking findings `PAC-P4T2-003/004/005`. **The evaluator was deliberately NOT wired into the product** — that is not a P4 decision. |
| R2(a) | DM-HEME-002 carries `coverageFinding` `PAC-P4T2-006` (`pediatric-safety-owner`) via a new required field. |
| R2(b) | **Owner-held.** Whether the engine gains a history-independent safety net is clinical content authority nobody here holds. `modules/anemia/rules.json` and `src/` are byte-identical across all of P4 — verified by diff. |
| R3 | Enforced via `if/then/else` mirroring `terminology-profile.schema.json`, propagated to V4/V5 by `$ref`, with positive and negative tests. A description-vs-enforcement sweep found and fixed **five further instances** of the same class. |
| R4 | **Owner-held.** Candidate hazard family `DM-HISTORY-011`: all ten fixtures carry `history: {}` though `src/app.js` solicits 33 such fields. Catalog-scope carryover, not a P4 authoring defect. The family definition was not invented. |
| R5 | **Owner-held.** Gestational/corrected age is unrepresentable on the product input surface; a former 30-weeker is silently treated as full-term — collapsed rather than abstained. P3's "gestational age fixed" claim resolves to the reference-range profile, **not** the product's input surface. Verified. |
| R6, R8, R11 | Disclosure fixes landed. R8 is structural: `finding.preconditionForHazardIds` makes DM-WORKFLOW-010's precondition relationship machine-readable, so "8 of 10 mitigated" has something to trip over. |
| R7 | Real, and worse than reported: `reference-range.schema.json` asserted *"Free-text units are not accepted"* — false against an unconstrained string. Corrected; only exact-string equality is enforced. |
| R9, R10, R12 | Recorded. OQ-7 (CDS Hooks crosswalk) drafted for the coordinator to confirm into plan §7; the plan body was not edited. |

Findings register: `.claude/findings/arc-clinical-council-adoption-v1-findings.md`.

## Two process failures in this cycle, both mine

1. **R7 was never dispatched.** It appeared in my cross-reference list but was assigned to no agent as
   a fix. It surfaced only because the cross-lane finding-ID reconciliation went looking for its
   landing site and found none. Without that reconciliation step it would have shipped unfixed while
   the register implied otherwise.
2. **Uncommitted work was destroyed.** A validation agent ran `git checkout --` on
   `schemas/hazard-control-matrix.schema.json` to undo its own temporary edit; the file carried a
   legitimate unstaged remediation diff, which was discarded with no recovery path. It was
   reconstructed from the intact data file and test file as spec, and all three restored guards
   re-proven to discriminate. **Root cause is mine**: I held a full remediation round uncommitted
   through a validation cycle, against my own durability contract. Remediation is now committed
   before validation, and every agent touching files with unstaged diffs is instructed to `cp`-backup
   rather than use destructive git commands.

## Validation after remediation (independently executed, not self-reported)

| Command | Result |
|---|---|
| PED `npm run check` | **407 tests, 407 pass, 0 fail**; `coverage:rules` **91/91** |
| ARC `uv run pytest` | **1076 passed, 6 skipped**, 0 failed |
| ARC `arc validate .` | exit 0, 260 `ok:` lines, 0 errors |
| `git diff --check` both repos | clean |
| Discrimination proofs | **4/4 reproduced** via `cp`-backup/restore, each restored byte-identical by SHA-256 |
| Reconstruction integrity | diff `7a73cb6`→`347384c` on the rebuilt schema is **purely additive**; no prior guard dropped or weakened |
| Cross-document consistency | all six `PAC-P4T2-*` IDs, rows, severities, owners agree between register and matrix |

## Gate status

**OPEN.** The coordinator re-runs `pediatric-hematology-reviewer`,
`pediatric-laboratory-medicine-reviewer` and `general-pediatrics-reviewer` for the verdict. I do not
self-certify this gate, and no prior lens approval is reused across a fix cycle that touched that
lens's domain.

## Still true, and unchanged by this remediation

Ten scenarios were **authored**; no clinical suite was executed and no hazard clinically adjudicated.
V3/V4/V5 remain `not_executed_owner_held`. Two hazards remain wholly unmitigated (DM-EQUITY-009,
DM-WORKFLOW-010) and three more are now disclosed as **not reachable in the shipped product**. On the
deployed application, the number of dangerous-miss families with a control that can actually fire is
**five of ten** — not eight.

---

## OPEN ITEM (RESOLVED) — reviewer-count ambiguity

**AC P4.1's P4-V1 row requires "the eight specialty lenses plus methods, safety, human-factors, and
equity review." The progress file's `assigned_to` names three reviewers.** I was instructed to
dispatch the specialists in `assigned_to`, and did — then added the equity lens because AC P4.1 names
it explicitly and DM-EQUITY-009 is a live unmitigated hazard.

**Four lenses ran. Up to four of the plan's eight specialty lenses did not**
(`pediatric-hematology-reviewer`, `pediatric-laboratory-medicine-reviewer`,
`general-pediatrics-reviewer`, `clinical-informatics-interoperability-reviewer` are available in ARC
and were not dispatched). The task-completion-validator raised this as a secondary gap it could not
resolve.

**I am not resolving this unilaterally.** Either the progress file's `assigned_to` is authoritative
and P4-V1 is complete, or AC P4.1 is authoritative and P4-V1 is partially satisfied pending four more
lenses. Opus should decide before P5 consumes this phase's output as a qualifying input.

**RESOLUTION (coordinator):** the plan wins — AC P4.1's eight specialty lenses are authoritative; the
progress file's three-reviewer `assigned_to` was incomplete. The four missing lenses were run and
three failed. Escalating this rather than deciding it was correct; **had I resolved it the other way,
three CRITICAL/HIGH findings — including a false product-protection claim and a silently missed
aplastic crisis — would have shipped into P5 as a qualifying input.**

---

## Commits

- PED `main`: **`7a73cb6`** — P4 work (rebased onto `origin/main` after PRs #5/#6 landed mid-phase;
  zero file overlap, clean rebase). Traceability follow-up commit records the ref.
- **Post-rebase re-validation:** the 305/305 evidence predated the two remote commits, so the combined
  tree was re-validated before push — `npm run check` **373/373 pass, 0 fail**, `coverage:rules`
  91/91, all four P4 lanes and all three newly-arrived lanes green individually, no cross-change-set
  interaction failure.
- ARC: **no commit** — Phase 4 authored no ARC changes. Pre-existing unrelated uncommitted work in the
  ARC tree (owned by another agent) was left untouched and unstaged.
