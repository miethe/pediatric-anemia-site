---
type: progress
schema_version: 2
doc_type: progress
prd: "arc-clinical-council-adoption-v1"
feature_slug: "arc-clinical-council-adoption-v1"
phase: 2
status: completed
created: 2026-07-19
updated: 2026-07-19
prd_ref: docs/project_plans/expansion/00-expansion-plan.md
plan_ref: docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
commit_refs: ["95508e3", "99585d6", "50df81b"]
pr_refs: []
execution_model: batch-parallel
plan_structure: unified
owners: ["security-governance-engineer"]
contributors: []

tasks:
  - id: "P2-T1"
    status: "completed"
    assigned_to: ["general-purpose"]
    dependencies: []
    description: "Identity provider, credential authority, signature, conflict, independence, expiry, revocation contracts — governance decision doc; owner-held systems remain authoritative (OQ-2/OQ-6)"
  - id: "P2-T2"
    status: "completed"
    assigned_to: ["python-backend-engineer"]
    dependencies: ["P2-T1"]
    description: "Evidence-rights receipts bound to source IDs, manifest digest, permitted operation/provider/storage, signer, expiry, revocation"
  - id: "P2-T3"
    status: "completed"
    assigned_to: ["python-backend-engineer"]
    dependencies: ["P2-T1"]
    description: "Credentialed-human approval attachments bound to candidate digest, scope, role, institution, independence, conflicts, decision"
  - id: "P2-T4"
    status: "completed"
    assigned_to: ["python-backend-engineer"]
    dependencies: ["P2-T2", "P2-T3"]
    description: "Negative tests: missing, duplicated, stale, conflicted, unauthorized, revoked, wrong-scope, wrong-digest — all fail closed without echoing credentials"
  - id: "P2-V1"
    status: "completed"
    assigned_to: ["security-governance-reviewer", "task-completion-validator"]
    dependencies: ["P2-T4"]
    description: "Security red team, clinical-governance review, rights review, full ARC validation, exact-tree rereview"

parallelization:
  batch_1: ["P2-T1"]
  batch_2: ["P2-T2", "P2-T3"]
  batch_3: ["P2-T4"]
  batch_4: ["P2-V1"]
---

# Phase 2 Progress — Authenticated authority and rights attachments

No ARC-only or synthetic record may mint owner-held authority. Real identity/credential systems are
owner-held (OQ-2); repository scope defines contracts + verification; affirmative authority remains
`not_executed_owner_held` until authenticated owner evidence exists.

## Completion note

Status: **completed**. Reviewer gate P2-V1 (adversarial security/governance): PASS-WITH-FINDINGS;
all 14 findings remediated in `50df81b` with a regression test each.

Design: ADR-0005 established a two-plane trust model. The authority plane is owner-held — ARC holds
no private keys, creates no identities, and has no `arc authority issue` (a test asserts the parser
rejects it). ARC verifies and references only.

The review confirmed the core claim: no forged, hand-edited, or model-authored record can mint
authority given an uncompromised trust registry; `credentialed_review_complete` is structurally
unreachable; and the signed payload covers everything except the signature object itself, with all
record schemas `additionalProperties: false` at every level, leaving no unsigned-field-injection or
signature-stripping surface. `schemas/pediatric-clinical-review.schema.json` is untouched, so its
const pins remain physically incapable of expressing approval.

What it found were temporal and aggregation weaknesses letting a genuinely signed record assert
more, later, and more broadly than it should — plus one data-loss bug: `arc validate`, a read-only
command, could irreversibly delete an owner-signed record after a false positive on `metadata.owner`.
The same unconditional-unlink defect was then found independently in the profile plane.

Evidence: pytest 1035 passed / 187 subtests at phase close; `arc validate` output byte-identical to
baseline including the one run whose manifest was corrected for reserved vocabulary.

Owner-held (OQ-2/OQ-6): until an operator runs `arc authority trust add`, every gate remains
`owner_held_not_executed` and runtime behavior is unchanged.
