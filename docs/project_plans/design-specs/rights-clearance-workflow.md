---
doc_type: design_spec
title: "Rights Clearance Workflow"
status: draft
maturity: idea
created: 2026-07-21
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
---

# Rights Clearance Workflow (DEF-R1)

## Problem / Context

The rights-aware-evidence-capture feature (EP-R0–EP-R5) ships the **substrate** for tracking
source-level rights — `rights/rights-records.json`, `rights/rights-failures.json`,
`rights/release-context.json`, joined via `rights/rights-ledger.json` — but ships **zero
clearances**. Every seeded `rights_record.overall_status` is `UNKNOWN`; no agent-writable path may
ever assign a `CLEARED_*` status (D6). This is deliberate: no named rights owner exists in this
project (OQ-2), and a clearance determination is a legal/business judgment, not a mechanical one.

That leaves an open question this feature explicitly does not answer: **who does the clearing, and
through what procedure?** This includes the seven CDC / public-domain-shaped rules the review
findings identify as the closest thing to "unblockable" today — even those still need a human to
walk through the workflow and record the result, because no code path in this repository is
permitted to make that call for them.

## Current State (what EP-R0–R5 actually shipped)

- `rights/rights-records.json` seeds 6 `rights_record` entries at `overall_status: UNKNOWN`,
  `review.review_status: agent_triage_only`, `review.human_reviewer: null`,
  `review.counsel_reviewer: null` (both schema-forced `null`).
- `schemas/rights/rights_record.schema.json` (vendored + amended, `schemas/rights/VENDORING.md`)
  defines the full `overall_status` enum, including every `CLEARED_*` member — the schema *can*
  represent a clearance; nothing in this feature writes one.
- `rights/rights-failures.json` cross-links the pre-existing open rights problems (REG-002
  content-rights review; the EP3-T5 near-verbatim-span and source-unretrievable findings) that a
  clearance workflow would need to resolve or route around.
- No human-facing workflow, form, or process document exists yet describing how a rights owner
  reviews a `rights_record`, what evidence they need, or how their determination gets written back.

## Design Sketch

At an idea-stage level, a future clearance workflow would need to:

1. **Name the rights owner role** (resolves OQ-2) — analogous to the credentialed-clinician gap for
   `clinicalApprovers[]`: a named, accountable human, never an agent, ARC/council-review output, or
   `rf` synthesis.
2. **Define the review unit.** Likely one `rights_record` per pass, surfaced with its
   `rights_failure_ids`, the KB passages it covers (via `rights/rights-ledger.json`), and the
   `access`/`copyright`/`contract` fields already captured — a clean-room-style brief (the EP-R4
   brief generator's plumbing is a plausible reuse target) rather than a raw JSON diff.
3. **Define the write path.** The only legitimate writer of `overall_status: CLEARED_*`,
   `review.human_reviewer`, or `review.counsel_reviewer` is the named rights owner, through a
   mechanism this workflow specifies (a signed PR review, an attestation file under
   `docs/attestations/` reusing the RG-9 ledger seam, or an equivalent) — never a direct hand-edit
   an agent could also make.
4. **Define the retry/re-triage loop.** `rights_failure.retry_trigger` already names the condition
   under which a failure should be re-examined (e.g. "REG-002 review completes"); the workflow
   should specify who monitors these triggers and re-opens the review.
5. **Prioritize the 7 CDC/public-domain-shaped sources first** — the review findings identify these
   as the lowest-friction clearance path (17 U.S.C. §105 territory, subject to the §3.7
   works-vs-funded distinction this feature's EP-R5 amendment now draws explicitly) — a template
   worth building the workflow against before generalizing to contract- or licensed-source rights.

None of this is committed. The central open question — what channel the rights owner actually
works in (a repo-native PR flow vs. an external ticketing/legal-review system) — is unresolved.

## Promotion Trigger

A named rights owner exists (OQ-2, decisions block §6).

## Open Questions

- Does the rights owner work inside this repo (PRs, attestation files) or through an external
  system this repo only records the outcome of?
- Does `content_reuse_assessment` (vendored, unseeded — `schemas/rights/content_reuse_assessment.schema.json`)
  become the review-request record, or does the workflow define its own request shape?
- How does the workflow interact with DEF-R2 (the release gate) — does clearing a `rights_record`
  automatically unblock its dependent rules, or is that a separate, later decision?
- Does the seven-source CDC/public-domain path need its own lighter-weight fast path, or does every
  source go through the same procedure regardless of apparent clearance difficulty?
