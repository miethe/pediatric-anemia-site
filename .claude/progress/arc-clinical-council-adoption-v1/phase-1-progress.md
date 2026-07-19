---
type: progress
schema_version: 2
doc_type: progress
prd: "arc-clinical-council-adoption-v1"
feature_slug: "arc-clinical-council-adoption-v1"
phase: 1
status: completed
created: 2026-07-19
updated: 2026-07-19
prd_ref: docs/project_plans/expansion/00-expansion-plan.md
plan_ref: docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
commit_refs: ["75ed6e9", "412fc37", "f1a51c8"]
pr_refs: []
execution_model: batch-parallel
plan_structure: unified
owners: ["arc-platform-engineer"]
contributors: ["project-integration-owner"]

tasks:
  - id: "P1-T1"
    status: "completed"
    assigned_to: ["architecture-reviewer"]
    dependencies: []
    description: "SPIKE managed-workspace registration vs immutable import vs AOS-resolved snapshot; ADR with threat model and negative cases (OQ-1)"
  - id: "P1-T2"
    status: "completed"
    assigned_to: ["python-backend-engineer"]
    dependencies: ["P1-T1"]
    description: "Content-addressed target materialization: repo root allowlist, commit/tree/path/digest, artifact class, source locator; reject escape/symlink/mutation/missing/unsupported-class pre-dispatch"
  - id: "P1-T3"
    status: "completed"
    assigned_to: ["python-backend-engineer"]
    dependencies: ["P1-T2"]
    description: "Bind target identity through run manifest, evidence pack, SkillBOM, trace, receipts, certification"
  - id: "P1-T4"
    status: "completed"
    assigned_to: ["general-purpose"]
    dependencies: ["P1-T1"]
    description: "Pediatric repo RunSpec fixtures + AOS invocation contract using identifiers only"
  - id: "P1-V1"
    status: "completed"
    assigned_to: ["test-reviewer", "task-completion-validator"]
    dependencies: ["P1-T2", "P1-T3", "P1-T4"]
    description: "Focused resolver/policy tests, full ARC validation, AOS adapter tests, exact-tree security/correctness review"

parallelization:
  batch_1: ["P1-T1"]
  batch_2: ["P1-T2", "P1-T4"]
  batch_3: ["P1-T3"]
  batch_4: ["P1-V1"]
---

# Phase 1 Progress — Portable target and evidence consumption

Write ownership: ARC platform engineer owns ARC target resolution/schemas/tests; project integration
owner owns pediatric RunSpec fixtures and AOS contract doc. Disjoint files only.

## Completion note

Status: **completed**. Reviewer gate P1-V1 (adversarial security): PASS-WITH-FINDINGS; all findings
remediated in `f1a51c8` with a regression test each.

Design: ADR-0004 chose managed-workspace registration. `repo:<alias>/<path>` resolves through an
operator-local approved-roots registry, with the SHA-256 digest — not the commit — as binding
identity, so no absolute path reaches a run artifact or AOS correlation.

Three latent defects were found and fixed that pre-dated this work:
- `(root / target)` discarded the repository root for an absolute target, so absolute targets
  silently escaped for every non-pediatric council.
- `sha256_path` returned an empty digest for a nonexistent path, so a run could bind to nothing.
- `sha256_path`'s tree-symlink branch referenced `os` with no module-level import — a latent
  NameError on a live path.

The two blocking review findings: the clean-tree gate accepted `not_git` (no commit at all) and
collapsed every git failure into it; and the prohibited-content scan ran on source bytes before
hashing, so scan→hash was never proven. Both closed. The pediatric fixtures that had masked the
first — all non-git, so the gate had never once been exercised — now `git init`.

Evidence: pytest 923 passed / 143 subtests at phase close; `arc validate` clean; an A/B harness
proved the 6 historical runs validate byte-identically under pre- and post-fix modules.
P1-T4 proved the dry run by execution and closed the absolute-path finding deferred from P0-V1.
