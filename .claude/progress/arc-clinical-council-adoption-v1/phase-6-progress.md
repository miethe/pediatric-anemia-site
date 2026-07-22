---
type: progress
schema_version: 2
doc_type: progress
prd: arc-clinical-council-adoption-v1
feature_slug: arc-clinical-council-adoption-v1
phase: 6
status: completed
created: '2026-07-19'
updated: '2026-07-21'
prd_ref: docs/project_plans/expansion/00-expansion-plan.md
plan_ref: docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
commit_refs:
- e42f6a6
pr_refs: []
execution_model: batch-parallel
plan_structure: unified
owners:
- portal-integration-engineer
contributors: []
tasks:
- id: P6-T1
  status: completed
  assigned_to:
  - ui-engineer-enhanced
  dependencies: []
  description: Add structured Portal authoring for every clinical RunSpec, source,
    safety, applicability, authority, and target-class field. YAML/JSON round trips
    byte/semantic exact with no flattening or silent defaults.
  evidence:
  - test: web/src/lib/runspec-codec.test.ts
  - test: tests/test_api_runs_clinical_fields.py
  - file: web/src/components/arc/RunSpecClinicalFields.tsx
  started: '2026-07-21T18:30:00Z'
  completed: '2026-07-21T19:50:00Z'
  verified_by:
  - P6-V1
- id: P6-T2
  status: completed
  assigned_to:
  - ui-engineer-enhanced
  dependencies:
  - P6-T1
  description: Add preview warnings for prohibited targets, missing receipts, owner-held
    gates, stale digests, and non-qualifying state. UI never presents repository validation
    as clinical approval.
  evidence:
  - test: web/src/components/arc/ClinicalPreviewWarnings.test.tsx
  - screenshot: runs/2026-07-21-arc-clinical-p6-portal/visual-evidence/03-clinical-warnings-panel.png
  - screenshot: runs/2026-07-21-arc-clinical-p6-portal/visual-evidence/13-round-trip-diff-real-edit.png
  started: '2026-07-21T20:00:00Z'
  completed: '2026-07-21T20:55:00Z'
  verified_by:
  - P6-V1
- id: P6-T3
  status: completed
  assigned_to:
  - python-backend-engineer
  dependencies: []
  description: 'Implement a read-only, metadata-only MeatyWiki adapter with ACL, vault
    allowlist, rights, freshness/retraction, and deterministic projection hashes.
    No raw body retrieved or sent to a provider; repository manifest stays runtime
    truth. OQ-5 owner-held: adapter ships disabled by default.'
  evidence:
  - test: tests/test_meatywiki_source_adapter.py
  - file: arc_cli/meatywiki_source_adapter.py
  started: '2026-07-21T18:30:00Z'
  completed: '2026-07-21T19:46:00Z'
  verified_by:
  - P6-V1
- id: P6-T4
  status: completed
  assigned_to:
  - python-backend-engineer
  dependencies:
  - P6-T2
  - P6-T3
  description: Add access-denied, stale, retracted, rights-mismatch, projection-change,
    injection, and round-trip negative tests. Failures are bounded and do not echo
    protected content.
  evidence:
  - test: tests/test_meatywiki_source_adapter_negative.py
  - test: tests/test_meatywiki_source_adapter.py
  started: '2026-07-21T21:00:00Z'
  completed: '2026-07-21T21:05:00Z'
  verified_by:
  - P6-V1
- id: P6-V1
  status: completed
  assigned_to:
  - security-identity-reviewer
  - ux-workflow-reviewer
  - task-completion-validator
  dependencies:
  - P6-T4
  description: Run security, rights, UX workflow, schema round-trip, and exact-tree
    review. Raw YAML remains a safe fallback and adapter disablement does not block
    P5.
  evidence:
  - review: security-identity-reviewer=PASS
  - review: mcp-tool-governance-reviewer=PASS
  - review: ux-workflow-reviewer=PASS(UXW-P6-01 closed fix-cycle-1)
  - review: task-completion-validator=PASS
  verified_by:
  - P6-V1
  started: '2026-07-21T21:10:00Z'
  completed: '2026-07-21T22:00:00Z'
parallelization:
  batch_1:
  - P6-T1
  - P6-T3
  batch_2:
  - P6-T2
  batch_3:
  - P6-T4
  batch_4:
  - P6-V1
total_tasks: 5
completed_tasks: 5
in_progress_tasks: 0
blocked_tasks: 0
progress: 100
---

# Phase 6 Progress — Governed Portal authoring and MeatyWiki metadata adapter

Governed authoring cannot weaken source or safety policy. Structured edits round-trip to the
authoritative contracts; MeatyWiki projects approved *metadata only* into the same manifest identity
with deterministic hashes.

Missing/unknown fields, access denial, stale/retracted sources, rights mismatch, or adapter outage
fail closed without changing the repository manifest or the qualifying state. Raw YAML stays the safe
fallback: turning the adapter off must never block P5.

Owner-held (OQ-5): approved MeatyWiki vault and ACL/rights policy. Until resolved the adapter is
disabled and metadata-only.
