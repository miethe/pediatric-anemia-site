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

## Validator Verdict

**P4-V1: PASS**, after **FAIL → FAIL → PASS** on the methods lens and one **FAIL** from the validator.

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

## OPEN ITEM FOR THE ORCHESTRATOR — reviewer-count ambiguity

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

---

## Commits

- PED `main`: see `commit_refs` in the progress file.
- ARC: **no commit** — Phase 4 authored no ARC changes. Pre-existing unrelated uncommitted work in the
  ARC tree (owned by another agent) was left untouched and unstaged.
