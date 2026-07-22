---
type: progress
schema_version: 2
doc_type: progress
prd: evidence-foundry-e1
feature_slug: evidence-foundry-e1
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md
execution_model: batch-parallel
phase: 2
title: 'Evidence Foundry E1 — Phase 2: Review Workflow Machinery'
status: pending
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 9
completed_tasks: 4
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- documentation-writer
- task-completion-validator
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P2-T1
  description: 'tools/review-record/ CLI scaffold + store layout, OQ-1/OQ-2/FR-1/FR-7:
    scaffold tools/review-record/ as a Node ESM CLI (cli.mjs verb dispatch: scaffold
    | validate | list | render | dry-run; pinned YAML parser + JSON Schema validator
    deps matching E0''s converter choices; README documenting the internal module
    boundary — store / chain / roster / signature / render). Implement OQ-2 store
    layout: records at modules/<module_id>/reviews/rr-<seq4>-<role>.yaml; list prints
    per-module review state. Offline, deterministic, no network, no generative model.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies: []
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
- id: P2-T2
  description: 'Role scaffolding + roster checks + reviewer-2 independence, FR-3/FR-4/FR-7:
    scaffold --module <id> --role <role> --subject <content-hash> creates a schema-valid
    draft for each of the 5 roles, requiring reviewerId to resolve against governance/reviewer-roster.yaml
    (unknown identity fails closed). Reviewer-2 independence (FR-4), enforced structurally:
    the clinical-2 scaffold flow must not read, print, or embed any clinical-1 decision
    content. Seeded-violation tests: (a) a hand-built clinical-2 record referencing
    reviewer-1 content is rejected by validate; (b) a record citing a non-roster reviewerId
    is rejected.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P2-T1
  estimated_effort: 1.25 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  evidence:
  - commit: 605cd40
- id: P2-T3
  description: 'Append-only enforcement (hash chain + git history), FR-9/OQ-2: two-layer
    validator — (a) previousRecordHash chain: each record after the first for a module
    carries the SHA-256 of the prior record''s canonical bytes; validate recomputes
    and fails closed on any break; (b) git-history check (validate --history) rejects
    any commit-visible mutation/deletion of an existing modules/<id>/reviews/*.yaml
    path — corrections must be new superseding records (supersedes field). Seeded-mutation
    tests: one-byte mutation of a committed fixture fails chain validation; a simulated
    history rewrite fails the history validator. Chain state is a structured audit
    artifact.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P2-T2
  estimated_effort: 1.25 pts
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  note: 'Two-layer FR-9/OQ-2 append-only enforcement landed: previousRecordHash chain
    (always) + opt-in validate --history git-history check (lib/history.mjs). 18 new
    tests (tests/ef-review-appendonly.test.mjs): seeded one-byte chain mutation +
    simulated history rewrite both fail closed; valid superseding record passes; broken_chain_v1
    now rejected by validate itself (not just list); both layers deterministic.'
  started: '2026-07-22T05:00:00Z'
  completed: '2026-07-22T06:15:00Z'
  evidence:
  - commit: 48d3fd2
- id: P2-T4
  description: 'Adjudication + release-authorization validators, PRD OQ-5/FR-5/FR-6:
    implement the authorship-union computation (identities in authoring-decisions.yaml
    decision records ∪ git author of the proposal-introducing commit; the converter
    is never an identity) as a machine-readable authorship block, and enforce adjudicator
    ∉ authorship-union in validate. Release-authorization chain validation: a release-auth
    record is valid only over a complete, chain-valid, roster-verified, non-synthetic
    record set — unsigned-stub → release-ready stays schema-impossible (P1-T7''s enforcement
    re-asserted by test, not weakened). Seeded violations: adjudicator = authorship-union
    identity rejected; release-auth over a chain containing any synthetic:true record
    structurally non-qualifying.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P2-T2
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
- id: P2-T5
  description: 'Record signature binding (test keys only), FR-10/OQ-2/OQ-6: implement
    the record signature object — Ed25519 (node:crypto only) over the canonicalized
    record bytes minus the signature object, binding reviewerId to subjectContentHash.
    E1 signing exists only in synthetic dry-run mode: ephemeral in-memory keypair
    per invocation (never written to disk, no --test-keys flag), keyId forced to TESTKEY-
    prefix, writable only onto synthetic:true records. validate verifies present signatures
    and fails closed on tamper.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P2-T3
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  started: '2026-07-22T06:00:00Z'
  completed: '2026-07-22T07:00:00Z'
  evidence:
  - commit: 969223e
  - test: tests/ef-review-signature.test.mjs
- id: P2-T6
  description: 'Read-only static render, FR-8/FR-31/OQ-3: render --module <id> [--record
    <review_id>] emits self-contained static HTML to build/review-render/ (gitignored)
    showing the passage → decision → rule → test chain from committed artifacts only
    — NOT a portal: no server, database, write path, auth, scripts, or third-party/remote
    assets. Every page carries the unvalidated-research-prototype banner (documentation-writer
    copy) and per-record non-qualifying labels for synthetic content. Rights posture
    (FR-31): rights-restricted passages render as hash + selector reference blocks,
    never inline text. Commit one golden render under tests/fixtures/ef-review-render/.'
  status: pending
  assigned_to:
  - general-purpose
  - documentation-writer
  dependencies:
  - P2-T4
  estimated_effort: 1.0 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P2-T7
  description: 'Render runtime smoke (R-P4), the only UI-adjacent surface: tests/ef-review-render-smoke.test.mjs
    renders from committed fixture artifacts end to end and asserts: output file exists
    and is non-empty well-formed HTML; unvalidated-prototype banner and synthetic
    non-qualifying labels present; zero network calls occur during render; output
    under build/ is ignored by git (E0 P1-T7 precedent).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P2-T6
  estimated_effort: 0.5 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  started: '2026-07-22T07:00:00Z'
  completed: '2026-07-22T07:30:00Z'
  evidence:
  - test: tests/ef-review-render-smoke.test.mjs
- id: P2-T8
  description: 'Five-role synthetic dry-run, FR-11 (ruling R4): execute one full end-to-end
    dry-run via cli.mjs dry-run — scaffold → sign (TESTKEY, P2-T5) → chain-validate
    all five roles in sequence (clinical-1, clinical-2, lab, adjudication, release-auth)
    over the cbc_suite_v1 proposal''s subjectContentHash, using labeled synthetic
    personas (roster entries synthetic:true, names like "SYNTHETIC — NOT A CREDENTIALED
    REVIEWER"). Commit the record set to modules/cbc_suite_v1/reviews/ with goldens
    under tests/fixtures/. Dry-run populates zero approver/clinicalApprovers fields
    (schema-proven). Emit a friction-observations note (.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md)
    — first evidence feed for PRD OQ-8''s portal trigger (a human decision, not this
    plan''s).'
  status: pending
  assigned_to:
  - general-purpose
  - documentation-writer
  dependencies:
  - P2-T5
  - P2-T6
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
- id: P2-GATE
  description: 'task-completion-validator gate: verify Phase 2 exit gate — five-role
    dry-run committed and chain-valid; both append-only layers reject seeded mutations;
    reviewer-2 independence and adjudicator≠author violations rejected; render smoke
    green with banner; zero approver fields populated; npm run check green; ADR-delta
    check (ADR-0004 unchanged, else escalate).'
  status: pending
  assigned_to:
  - task-completion-validator
  dependencies:
  - P2-T1
  - P2-T2
  - P2-T3
  - P2-T4
  - P2-T5
  - P2-T6
  - P2-T7
  - P2-T8
  estimated_effort: —
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
parallelization:
  batch_1:
  - P2-T1
  batch_2:
  - P2-T2
  batch_3:
  - P2-T3
  - P2-T4
  batch_4:
  - P2-T5
  - P2-T6
  batch_5:
  - P2-T7
  - P2-T8
  batch_6:
  - P2-GATE
  critical_path:
  - P2-T1
  - P2-T2
  - P2-T3
  - P2-T5
  - P2-T8
  - P2-GATE
  estimated_total_time: 5.5 pts critical path; 8.0 pts total phase
blockers:
- id: BLOCKER-PHASE-DEP
  title: Phase 2 cannot open until Phase 1 exit gate (P1-GATE2, karen) passes
  severity: high
  blocking:
  - P2-T1
  resolution: Wait for .claude/progress/evidence-foundry-e1/phase-1-progress.md P1-GATE2
    to complete
  created: '2026-07-21'
success_criteria:
- id: SC-1
  description: npm run check green (quality gate; task-completion-validator)
  status: pending
- id: SC-2
  description: Full five-role cycle executable; all synthetic artifacts structurally
    marked non-credentialed
  status: pending
- id: SC-3
  description: Seeded violations (mutation x2, reviewer-2 dependence, adjudicator=author,
    non-roster identity) — 5/5 rejected fail-closed
  status: pending
- id: SC-4
  description: Render self-contained, banner-stamped, rights-respecting; smoke test
    green
  status: pending
- id: SC-5
  description: Zero approver/signature fields populated on any non-synthetic artifact
    (schema-proven)
  status: pending
files_modified:
- tools/review-record/**
- modules/cbc_suite_v1/reviews/**
- tests/ef-review-workflow.test.mjs
- tests/ef-review-appendonly.test.mjs
- tests/ef-review-render-smoke.test.mjs
- tests/fixtures/ef-review-render/**
- .claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md
progress: 44
updated: '2026-07-22'
---

# evidence-foundry-e1 - Phase 2: Review Workflow Machinery

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Update progress via CLI:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/evidence-foundry-e1/phase-2-progress.md -t TASK-X -s completed
```

---

## Objective

First of three parallel wave-2 workstreams (P2 ∥ P3 ∥ P4, disjoint file ownership: `tools/review-record/`
+ `modules/cbc_suite_v1/reviews/`). Builds the review-record CLI, append-only enforcement (hash chain
+ git history), adjudication/release-authorization validators, test-key-only signature binding, a
read-only static render, and one committed five-role synthetic dry-run. Duration ~4-5 engineer-days.

**Dependencies**: Phase 1 complete (P1-GATE2 `karen` passed). Runs in parallel with Phase 3 and
Phase 4 — file ownership is disjoint by construction, so this phase does not block on or wait for
either sibling workstream.

**Exit gate** (decisions block §1): full five-role cycle executable with synthetic identities clearly
marked non-credentialed; append-only enforced by tests; render output carries the unvalidated-prototype
banner; `npm run check` + task-completion-validator.

---

## Implementation Notes

### Architectural Decisions

- **OQ-2 store layout**: one append-only YAML file per review act at
  `modules/<module_id>/reviews/rr-<seq4>-<role>.yaml`; corrections are new superseding records
  (`supersedes: <review_id>`), never edits.
- **FR-4 reviewer-2 independence** is enforced structurally in the CLI (P2-T2), not by convention —
  the `clinical-2` scaffold flow is mechanically incapable of surfacing `clinical-1` content.
- **OQ-6 ephemeral keys**: dry-run signing (P2-T5, P2-T8) generates an in-memory keypair per
  invocation, discards the private key at process exit, and forces the `TESTKEY-` `keyId` prefix —
  never a persistent test-key file, never a CLI flag holding key material.
- **OQ-3 render target**: `build/review-render/` (gitignored); goldens live under
  `tests/fixtures/ef-review-render/`. Never `docs/`, never the SPA build.

### Known Gotchas

- P2-T3 (append-only enforcement) is the risk-hotspot task in this phase — `extended` effort, not
  `adaptive`. Correctness over speed.
- P2-T8's committed dry-run records are real files under `modules/cbc_suite_v1/reviews/` that must
  each carry `synthetic: true` and non-qualifying language — mistaking these for real review activity
  is the single most likely honesty-posture failure in this phase (flagged in the parent plan's risk
  table).
- The render surface (P2-T6/T7) is the only UI-adjacent output in the whole E1 plan — it gets its own
  runtime smoke test (R-P4) rather than being waved through on unit tests alone.

### Development Setup

Node ≥ 20. Gate before Phase 5 integration: `npm run check` green + `task-completion-validator` on
this phase's P2-GATE, independently of Phase 3/4's gates.

---

## Completion Notes

Fill in when Phase 2 is complete: what was built, key learnings, unexpected challenges, recommendations
for Phase 5 (cross-workstream integration dry-run, honesty audit).
