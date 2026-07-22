---
schema_version: 2
doc_type: findings
title: "Findings: Clinical Review Workflow v1 (DF-E1-01)"
status: draft
source: agent
created: '2026-07-22'
updated: '2026-07-22'
feature_slug: clinical-review-workflow
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
---

# Findings: Clinical Review Workflow v1 (DF-E1-01)

In-flight findings surfaced during execution of `clinical-review-workflow-v1`, per the plan's
"Deferred Items & In-Flight Findings Policy" (not pre-created; created on the first real finding).

## CRW-F1 — D1 first-party-binary allowlist vs plan-ratified concept asset

**Severity**: informational (adjudicated, not a defect) · **Status**: resolved by orchestrator
adjudication, flagged for owner review in the feature PR.

### (a) The failing test

`tests/rights-negative-invariant.test.mjs`, test `D1: no third-party source document, reproduced
table dump, figure, image, or brand asset exists anywhere in the working tree` (D1 /
`AC-WP3-NEGATIVE`), fails on `origin/main` because
`docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png` is present in the
working tree but not listed in `FIRST_PARTY_BINARY_ALLOWLIST` (~line 112 of that file). The
`scanWorkingTree` detector treats any non-allowlisted `.png` as a document/image violation
regardless of provenance.

### (b) The allowlist's may-only-shrink escalation posture

The `FIRST_PARTY_BINARY_ALLOWLIST` header (`tests/rights-negative-invariant.test.mjs`, ~lines
104–111) states every entry must be first-party — "authored by this project or by the operator's
own Agentic-OS programme" — and that the list "MAY ONLY SHRINK. A new entry here is the exact
failure mode D1 exists to prevent; if a task believes it needs one, that is an escalation, not an
edit." This is a deliberate, high-friction gate: it exists to stop a third-party source document
being smuggled into the tree, not to block a first-party asset the project itself generated.

### (c) The plan's P4-T2 ratification of the asset

`docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md`, task
**P4-T2** ("CONCEPT-ONLY watermarked portal mockups", FR-17/R6), states verbatim: "**Partially
pre-delivered during planning**: `docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png`
(gpt-5.6 native image tool, 'CONCEPT ONLY — NOT COMMITTED' banner) is already committed. Task =
verify/attach it to the design spec, add the manifest entry, and generate additional views only if
the framework text needs them." The plan's Phase Summary table names the asset's origin as the
"codex gpt-5.6 native image tool (mockups)" lane, i.e. operator-directed generation, not a
third-party source document. This plan was human-approved and merged to `main` via **PR #23**
("Tier 3 planning bundle for DF-E1-01 v1", commit `28c9633`) and refreshed via **PR #25** ("resync
phase-2/phase-5 progress ACs with revised plan", commit `e8fd5dd`). The plan's ratification of this
specific file as an already-committed, task-verified asset supersedes the D1 freeze for this one
first-party asset — it is exactly the kind of plan amendment the allowlist's own comment
contemplates as the escalation path for a new entry.

### (d) Orchestrator adjudication

The orchestrator has adjudicated this in-flight: the asset is first-party by the allowlist's own
stated definition — it was authored by this project's operator-directed Agentic-OS programme (the
gpt-5.6 native image tool, invoked under this plan's P4-T2 task), not obtained from or reproducing
a third-party source. It carries a "CONCEPT ONLY — NOT COMMITTED" watermark banner and is explicitly
named and pre-ratified by a merged, human-approved implementation plan. On that basis, a
**single-entry amendment** to `FIRST_PARTY_BINARY_ALLOWLIST` is authorized for exactly this one
path:

```
docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png
```

No other entry is added, and no other test logic (the may-only-shrink comment, the shrink-only
assertions, any other detector) is weakened. This amendment is **flagged for owner review in the
feature PR** — it is not a unilateral closure of the escalation; the plan-ratification is the basis
for making the change now, but a human still reviews the diff before merge.

### (e) Residual action

P4-T2 itself remains open and is the task that closes the residual gap this finding does not
close: it must (1) verify the asset carries the watermark, (2) add a companion manifest entry
recording the watermark string per asset (verified by a docs-truth grep test, since pixel-OCR is
out of scope — the plan states this explicitly), and (3) attach/reference the asset from
`docs/project_plans/design-specs/clinical-review-portal-workflow.md`. This finding only unblocks
the D1 gate for the file's presence in the tree; it does not substitute for P4-T2's own manifest
and docs-truth work.
