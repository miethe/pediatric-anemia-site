---
type: progress
schema_version: 2
doc_type: progress
prd: "arc-clinical-council-adoption-v1"
feature_slug: "arc-clinical-council-adoption-v1"
phase: 3
status: completed
created: 2026-07-19
updated: 2026-07-19
prd_ref: docs/project_plans/expansion/00-expansion-plan.md
plan_ref: docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
commit_refs: ["1fbc501", "8c4e8b5", "9ebf240", "fed4de5"]
pr_refs: []
execution_model: batch-parallel
plan_structure: unified
owners: ["lab-informatics-engineer"]
contributors: []

tasks:
  - id: "P3-T1"
    status: "completed"
    assigned_to: ["general-purpose"]
    dependencies: []
    description: "First-site charter contract: population, specimen, analyzer/method, unit, interval, critical-value, ownership requirements. Owner-held (OQ-3); repo ships the required-fields contract plus a clearly labeled synthetic reference site."
  - id: "P3-T2"
    status: "completed"
    assigned_to: ["python-backend-engineer"]
    dependencies: ["P3-T1"]
    description: "schemas/reference-range.schema.json and signed tenant/site profile schema with source, effective dates, supersession, signer, verification, rollback."
  - id: "P3-T3"
    status: "completed"
    assigned_to: ["python-backend-engineer"]
    dependencies: ["P3-T1"]
    description: "FHIR/terminology profile contracts: code system/version, status, effective/issued time, specimen, unit, local mapping, corrected/amended state, provenance."
  - id: "P3-T4"
    status: "completed"
    assigned_to: ["python-backend-engineer"]
    dependencies: ["P3-T2", "P3-T3"]
    description: "Import/validation plus fail-closed applicability matching in ARC and the pediatric test lane; unknown/incompatible dimensions force abstention or activation block."
  - id: "P3-V1"
    status: "completed"
    assigned_to: ["test-reviewer", "task-completion-validator"]
    dependencies: ["P3-T4"]
    description: "Local laboratory, terminology, privacy/security, correctness, and negative compatibility gates."

parallelization:
  batch_1: ["P3-T1"]
  batch_2: ["P3-T2", "P3-T3"]
  batch_3: ["P3-T4"]
  batch_4: ["P3-V1"]
---

# Phase 3 Progress — Signed local laboratory and terminology profiles

Local applicability cannot be inferred. Published pediatric reference intervals are never site-applicable
by default: a signed site profile binds population, specimen, method, units, interval, status, mapping,
owner, version, and candidate digest. Missing, conflicting, expired, superseded, unmapped, preliminary,
stale, corrected, or amended states fail closed and stay visible.

Owner-held (OQ-3): the real first institution, its analyzers/methods, and its laboratory director's
signature. The repository ships the contract and a labeled synthetic reference profile only; no
synthetic profile may satisfy an activation gate.

## Completion note

Status: **completed**, but only after a FAIL. Reviewer gate P3-V1 (clinical informatics) returned
**FAIL against AC P3.1** on the first pass. Remediated in `9ebf240` (pediatric) and `fed4de5` (ARC).

Three confirmed defects had let applicability be *inferred* — the one thing this phase exists to
prevent:
- Each interval's own `ageBand` was required by schema and read by nothing, so a 0-14-day interval
  was served for a 12-month-old with zero blockers.
- The assertion discriminator guarded only one key per container, so every secondary value was a
  silent wildcard when null — altitude bounds became +/-Infinity in code whose own comment says sea
  level is never assumed.
- The pediatric activation gate had no verifier: `signatureState: "bound"` was self-declared, and
  four field edits promoted the shipped synthetic fixture to `applicable`.

Two gaps were clinical rather than mechanical, and no amount of schema rigor would have surfaced
them: critical values were modelled, required, and never once consulted by either implementation;
and one unit per profile made a CBC inexpressible (hemoglobin g/dL, MCV fL, platelets 10*9/L all
self-blocking). Both fixed, along with gestational age — a 4-week-old born at 27 weeks and one born
at 40 weeks are not the same patient.

Thirteen further dimensions (C4-C10, C12-C17) are recorded in the charter as **required owner
input**, not invented. An agent authoring pediatric reference-interval semantics into a schema that
gates clinical decision support is exactly the failure this plan prevents.

The pediatric<->ARC seam is enforced rather than conventional: fixtures are pinned by SHA-256 plus
the upstream commit and data-model version, because a case count cannot detect an edited mutation.
Verified independently at merge: all three vendored files byte-identical to the pediatric source,
pin equal to pediatric HEAD.

ADR-0006's containment argument was rewritten rather than defended — its four "independent" levels
were three functions of one field plus a filename. The load-bearing control is the Ed25519 signature
plus the operator trust registry.

Evidence: pediatric `npm run check` green (139 tests, 91 negative cases); ARC pytest 1076 passed /
423 subtests; `arc validate` clean; A/B identical across all 106 run-level lines. Both suites
verified discriminating by deliberate mutation.

Owner-held (OQ-3): no institution, laboratory director, analyzer, method, terminology server, or
interval value is named anywhere. Each gap is carried by an explicit null field.
