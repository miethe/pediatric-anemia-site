---
type: progress
schema_version: 2
doc_type: progress
prd: evidence-foundry-e1
feature_slug: evidence-foundry-e1
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md
execution_model: batch-parallel
phase: 1
title: 'Evidence Foundry E1 — Phase 1: Contracts & Gates'
status: pending
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 9
completed_tasks: 1
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- backend-architect
- general-purpose
contributors:
- task-completion-validator
- karen
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P1-T1
  description: 'Contracts design note (R5 unification + OQ encodings), FR-2: author
    .claude/worknotes/evidence-foundry-e1-v1/contracts-design.md fixing, before any
    schema is written: (a) canonical ADR-0004 five-role review-record model + field-by-field
    mapping of wave0''s 5-state schemas/review-record.schema.json contract onto it,
    every wave0 field mapped or documented drop-with-reason; (b) OQ-2 store layout
    + signature-object shape (detached-Ed25519, TESTKEY- marker, schema-forced-empty
    on non-synthetic); (c) PRD OQ-5 authorship-union definition (FR-5/FR-23); (d)
    OQ-4 registry entry shape (FR-14 fields only, inert withdrawal consts); (e) every
    wave0-schema consumer found by grep across scripts/tests/src with disposition.
    Design only — no schema files change.'
  status: pending
  assigned_to:
  - backend-architect
  dependencies: []
  estimated_effort: 1.0 pts
  priority: critical
  assigned_model: sonnet
  model_effort: extended
- id: P1-T2
  description: 'Canonical review-record schema v1, FR-1/FR-2/FR-3: replace wave0 contents
    of schemas/review-record.schema.json with the canonical five-role model (clinical-1,
    clinical-2, lab, adjudication, release-auth) from P1-T1 — same file path, ONE
    canonical schema. Preserve D-4: reviewerType "human" const, attestedHuman true
    const, approver arrays byte-compatible with module-manifest/rule schemas. Fields
    per OQ-2: review_id (rr-<seq4>-<role>), moduleId, subjectContentHash, previousRecordHash,
    supersedes (nullable), reviewerId, synthetic (required bool), signature object
    forced null unless synthetic true (then keyId must match TESTKEY-).'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T1
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
- id: P1-T3
  description: 'Wave0 → canonical mapping migration test, FR-2: implement tests/ef-review-record-migration.test.mjs
    proving P1-T1''s mapping — a pure mapping function (tools/review-record/lib/,
    import-safe standalone) maps a representative wave0-shaped fixture for each of
    the 5 wave0 states onto the P1-T2 canonical schema with D-4 guarantees intact.
    Update every wave0-schema consumer identified in P1-T1(e) so npm run check stays
    green. AC: migration test green for all 5 wave0 states; unmappable fixture fails
    closed; zero remaining wave0 5-state references outside the migration helper/fixtures.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T2
  estimated_effort: 0.75 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
- id: P1-T4
  description: 'Reviewer roster schema + empty roster, PRD OQ-1/FR-3: create schemas/reviewer-roster.schema.json
    and empty governance/reviewer-roster.yaml. Entry shape: reviewerId, name, credentialRef,
    moduleScopes[], synthetic (required bool); real entries (synthetic false) additionally
    require verificationRef (out-of-band credential verification, a G1 human act,
    never performed by this plan). Roster ships with zero entries; header states real
    entries require gate G1 and synthetic entries can never satisfy release-authorization.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T1
  estimated_effort: 0.5 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P1-T5
  description: 'Release-manifest signature slot + registry schema, OQ-4/FR-14/FR-16:
    (a) extend schemas/release-manifest.schema.json with the ADR-0005 signature slot
    ({algorithm, keyId, value}) schema-forced empty on any real candidate (const null
    unless dry-run marker present, then keyId must match TESTKEY-); mirror clinicalApprovers[]
    maxItems:0 pattern. (b) author schemas/release-registry.schema.json for releases/registry.json
    with exactly the OQ-4 entry shape (version, moduleId, packDigest, manifestDigest,
    signature null pre-G2, signedAt null, supersedes null, withdrawalState const "none",
    withdrawnAt/withdrawalReason const null); top-level schemaVersion; no surveillance/cadence
    fields. Registry seed file itself ships in P3-T4 — this task ships schemas + fixtures
    only.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T1
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P1-T6
  description: 'Gates registry — G0–G4 (A1 + A2 encodings), FR-27: author docs/governance/gates-registry.md
    enumerating all five external human gates — G0 ADR ratification, G1 named credentialed
    reviewer roster, G2 signing custodian + offline key ceremony, G3 data-source SPIKE
    verdict + data-partner DUA, G4 release authorizer — each with owner-role (human),
    entry criteria, blocked artifacts/behaviors, and the schema-forced-inert mechanism
    holding pre-gate. A2 (binding): G0''s ADR-0005 entry must record the SPIKE-006
    reconciliation condition — signing custodian distinct authority from release author,
    CI/agents never hold keys. A1 (binding): record design-spec §7.3 item 5 (methodologist/skeptic
    evidence council) as an external upstream rf/ARC dependency (RFUP routing), zero
    in-repo council tasks. State no gate is clearable by any task, agent, or plan.'
  status: completed
  assigned_to:
  - general-purpose
  - documentation-writer
  dependencies:
  - P1-T1
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  started: 2026-07-22T00:00Z
  completed: 2026-07-22T00:30Z
  evidence:
  - commit: 31a7bf5
  - doc: docs/governance/gates-registry.md
- id: P1-T7
  description: 'Validator wiring + seeded forced-empty violations (seam task), FR-6/FR-16/R-P3:
    wire the P1-T2/T4/T5 schemas into scripts/validate-kb.mjs — validate modules/<id>/reviews/*.yaml
    against the canonical review-record schema, governance/reviewer-roster.yaml against
    the roster schema, and (once it exists) releases/registry.json against the registry
    schema (absent file = pass with explicit note, never a crash). Preserve approvedBy[]/clinicalApprovers[]
    maxItems:0 enforcement and the anemia browser path''s SPIKE-006 posture byte-untouched
    (assert via existing tests). Commit seeded-violation fixtures under tests/fixtures/ef-contract-violations/
    (populated approvedBy[], populated real-candidate signature, non-synthetic roster
    entry sans verificationRef, unsigned-stub → release-ready manifest transition)
    and tests/ef-contract-forced-empty.test.mjs asserting each fails npm run validate
    fail-closed. Backend-architect integration-owner sign-off recorded before P1-GATE1.'
  status: pending
  assigned_to:
  - general-purpose
  - backend-architect
  dependencies:
  - P1-T2
  - P1-T3
  - P1-T4
  - P1-T5
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
- id: P1-GATE1
  description: 'task-completion-validator gate: verify Phase 1 exit gate — all schemas
    validate their fixtures; migration test green (5/5 wave0 states); gates registry
    enumerates G0–G4 with owner=human and contains the A2 + A1 encodings; 4/4 seeded
    forced-empty violations rejected; npm run check green. Scope note: karen milestone
    sign-off (P1-GATE2) is a separate subsequent gate, not in this gate''s scope.'
  status: pending
  assigned_to:
  - task-completion-validator
  dependencies:
  - P1-T1
  - P1-T2
  - P1-T3
  - P1-T4
  - P1-T5
  - P1-T6
  - P1-T7
  estimated_effort: —
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
- id: P1-GATE2
  description: 'karen milestone review — contract sanity (P1 exit), decisions block
    §2''s first named milestone: independently re-check against the actual diff —
    (1) exactly ONE canonical review-record schema exists, wave0 mapped not parallel
    (R5); (2) every forced-empty ceiling (approvedBy[], clinicalApprovers[], signature
    slots) intact, no ceiling raised; (3) gates registry models G0–G4 as human-only
    external gates with the A2 SPIKE-006 reconciliation recorded and zero council
    tasks anywhere in this plan (A1); (4) no schema description or doc implies clinical
    validity. Runs only after P1-GATE1 passes; any gap becomes a new task before wave
    2 (P2/P3/P4) opens.'
  status: pending
  assigned_to:
  - karen
  dependencies:
  - P1-GATE1
  estimated_effort: —
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
parallelization:
  batch_1:
  - P1-T1
  batch_2:
  - P1-T2
  - P1-T4
  - P1-T5
  - P1-T6
  batch_3:
  - P1-T3
  batch_4:
  - P1-T7
  batch_5:
  - P1-GATE1
  batch_6:
  - P1-GATE2
  critical_path:
  - P1-T1
  - P1-T2
  - P1-T3
  - P1-T7
  - P1-GATE1
  - P1-GATE2
  estimated_total_time: 3.25 pts critical path; 5.0 pts total phase
blockers: []
success_criteria:
- id: SC-1
  description: npm run check green (quality gate; task-completion-validator)
  status: pending
- id: SC-2
  description: One canonical review-record schema; migration test green for all 5
    wave0 states
  status: pending
- id: SC-3
  description: Roster, registry, and manifest-signature schemas reject all seeded
    missing-field and forced-empty violations
  status: pending
- id: SC-4
  description: Gates registry enumerates G0–G4, each owner=human; A2 reconciliation
    + A1 external-council note present
  status: pending
- id: SC-5
  description: Anemia browser path's SPIKE-006 posture byte-untouched
  status: pending
- id: SC-6
  description: 'ADR-delta check: ADR-0004/0005/0006 unchanged since plan authoring
    (any human edit → escalate before wave 2)'
  status: pending
- id: SC-7
  description: karen contract-sanity sign-off recorded (P1-GATE2) — hard prerequisite
    for opening P2/P3/P4
  status: pending
files_modified:
- schemas/review-record.schema.json
- schemas/reviewer-roster.schema.json
- schemas/release-manifest.schema.json
- schemas/release-registry.schema.json
- governance/reviewer-roster.yaml
- docs/governance/gates-registry.md
- scripts/validate-kb.mjs
- tests/ef-review-record-migration.test.mjs
- tests/ef-contract-forced-empty.test.mjs
- tests/fixtures/**
- .claude/worknotes/evidence-foundry-e1-v1/contracts-design.md
progress: 11
updated: '2026-07-22'
---

# evidence-foundry-e1 - Phase 1: Contracts & Gates

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Update progress via CLI:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/evidence-foundry-e1/phase-1-progress.md -t TASK-X -s completed
```

---

## Objective

First phase in the plan (no dependencies) — P2/P3/P4 all consume its contracts. Lands the canonical
ADR-0004 five-role review-record schema (mapping wave0's model, not parallel to it), the reviewer
roster schema, the release-manifest signature slot + release-registry schema, and the G0–G4 gates
registry. Duration ~2-3 engineer-days.

**Exit gate** (decisions block §1): all schemas validate; migration test green; gates registry
enumerates every human gate with owner=human; `npm run check` green + task-completion-validator, then
a `karen` contract-sanity milestone review before wave 2 (P2 ∥ P3 ∥ P4) may open.

---

## Implementation Notes

### Architectural Decisions

- **R5** (model unification): the canonical review-record schema absorbs the wave0 5-state model via
  an explicit field mapping (P1-T1) and a migration test (P1-T3) — one schema file, no parallel
  contract.
- **Seam task** (R-P3): P1-T7 is the explicit join point proving P1-T1's design and P1-T2..T5's
  schema builds agree at `scripts/validate-kb.mjs`; backend-architect is integration owner for the
  shared `schemas/*` + `scripts/validate-kb.mjs` surface.
- **A2 (binding)**: G0's ADR-0005 gates-registry entry must record the SPIKE-006 reconciliation —
  signing custodian distinct authority from release author, CI/agents never hold keys.
- **A1 (binding)**: the methodologist/skeptic evidence council (design-spec §7.3 item 5) is recorded
  as an external upstream `rf`/ARC dependency (RFUP routing) — zero in-repo council tasks anywhere in
  this plan.

### Known Gotchas

- P1-T1's contracts-design worknote is a hard blocker for every other Phase 1 task — land it first.
- Every gated behavior must ship schema-forced inert from the start: `approvedBy[]`/`clinicalApprovers[]`
  stay `maxItems: 0`, signature slots stay const-null pre-G2, roster entries synthetic-only pre-G1.
  Raising any of these ceilings in this phase is a defect, not a feature.
- P1-GATE2 (`karen`) is a hard prerequisite for opening P2/P3/P4 — do not start wave 2 on P1-GATE1
  alone.

### Development Setup

Node ≥ 20. Gate before Phase 2/3/4 open: `npm run check` (test + validate + build + check:imports +
smoke) green, plus `task-completion-validator` and `karen` sign-off.

---

## Completion Notes

Fill in when Phase 1 is complete: what was built, key learnings, unexpected challenges, recommendations
for the parallel wave (Phases 2–4).
