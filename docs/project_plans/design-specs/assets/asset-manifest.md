---
schema_version: 1
doc_type: asset_manifest
title: "Design-Spec Concept Assets Manifest — CONCEPT-ONLY Watermark Registry"
status: active
created: 2026-07-22
updated: 2026-07-22
feature_slug: clinical-review-workflow
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
design_spec_ref: docs/project_plans/design-specs/clinical-review-portal-workflow.md
---

# Design-Spec Concept Assets Manifest

This manifest is the companion, docs-truth-checkable record for every image file that lives under
`docs/project_plans/design-specs/assets/`. It exists because pixel-level OCR verification of a
rendered watermark banner is explicitly out of scope for this project's automated test suite (plan
`docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md`, task
**P4-T2**) — so instead of proving the watermark pixel-by-pixel, this manifest records the exact
watermark string per asset in a plain-text form a grep-style test can verify
(`tests/portal-concept-assets-manifest.test.mjs`).

## Binding rule (FR-17 / decisions-block risk R6)

Every image file in this directory is a **CONCEPT-ONLY informing artifact** for PRD open question
OQ-8 (the portal-promotion decision) — never a build commitment, never portal code, never evidence
that any portal has been authorized. Per FR-17 and risk R6, every asset MUST carry a visible
watermark banner baked into the rendered image itself, reading exactly:

> `CONCEPT ONLY — NOT COMMITTED`

The design spec's own portal section (`docs/project_plans/design-specs/clinical-review-portal-workflow.md`)
stays `maturity: shaping` regardless of anything shown in these mockups; see that spec's "Promotion
Trigger" section for the actual (human-owned, unresolved) portal-promotion decision.

## Assets

| File | Watermark string (verbatim, as rendered) | Generation lane | Origin task | Notes |
|---|---|---|---|---|
| `clinical-review-portal-concept-v2.png` | `CONCEPT ONLY — NOT COMMITTED` | codex gpt-5.6 native image tool (operator-directed, not a portal build) | P4-T2 (pre-delivered during planning; committed via PR #23, `28c9633`) | First-party AI-generated concept asset. Visually verified 2026-07-22 (P4-T2): a full-width orange banner across the top of the image reads the watermark string above; a second footer disclaimer reads "This is a conceptual user interface for a future state. Layout, content, and interactions are subject to change and are not committed for v1." D1 rights-allowlist single-entry amendment recorded in `.claude/findings/clinical-review-workflow-findings.md` (CRW-F1); flagged there for owner review in the feature PR. Depicts an illustrative review-queue + rule/evidence + decision UI for OQ-8 only — not a specification, not a schedule, not portal code. |

## Adding a new asset

Any future asset added to this directory MUST, before the change is considered complete:

1. Be generated on the operator-directed `codex gpt-5.6` native image lane named in the plan's Phase 4
   (never a screenshot of running portal code, and never a third-party image — see
   `tests/rights-negative-invariant.test.mjs`'s D1 first-party-binary allowlist, which this directory's
   entries must also satisfy).
2. Carry the exact watermark string `CONCEPT ONLY — NOT COMMITTED` baked visibly into the rendered
   image.
3. Get a new row above naming the exact watermark string — this is what
   `tests/portal-concept-assets-manifest.test.mjs` checks for every image file in this directory. The
   test fails closed on any image file with no matching manifest row, and on any manifest row missing
   the watermark string.

## Honesty boundary

This manifest, and every asset it describes, informs a future human decision (PRD OQ-8) about
whether to build a clinical review portal. It is not a specification, not a schedule, and not a
statement that any portal will be built. This project remains an **unvalidated research prototype**;
nothing here constitutes clinical validity, safety, or regulatory evidence.
