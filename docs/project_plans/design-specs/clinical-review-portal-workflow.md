---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry Buildout: Clinical Review Portal/Workflow (DF-E1-01)"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-21
feature_slug: "evidence-foundry-buildout"
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
adr_ref: docs/adr/0004-clinical-approval-identity-adjudication.md
problem_statement: "E1 needs a clinical review portal/workflow that gives named clinical reviewers a review-state model, independent dual review, adjudication, and release authorization, none of which E0 built or was scoped to build."
open_questions: []
explored_alternatives:
  - "Append-only, git-signed review files in the module package layout — ADR-0004's recommended default for E1 v1; zero new infrastructure, reuses the hash/signature substrate this plan's Phase 5 manifest work and ADR-0005 already build, but has poor reviewer ergonomics (no UI, no notifications, git literacy required of non-engineer clinical reviewers)."
  - "Dedicated clinical review portal web application — this spec's own eventual subject; purpose-built reviewer UX (queues, diffs, side-by-side passage/rule view, roster/credential management), but is new infrastructure (auth, hosting, its own threat model as a second trust boundary distinct from the public microsite) that ADR-0004 explicitly hands off rather than builds."
  - "Generic issue tracker (e.g. GitHub Issues/PRs) as the review record — rejected in ADR-0004: mutable/force-pushable state is not tamper-evident, no native cryptographic binding of reviewer identity to content hash, and it conflates engineering workflow tooling with a clinical governance record."
---

# Evidence Foundry Buildout: Clinical Review Portal/Workflow (DF-E1-01)

## Problem / Context

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §5.1 places independent
clinical review, laboratory review, and adjudication as a distinct gate (`G5`) — strictly after
evidence council (`G3`) and converter eligibility (`G4`), strictly before executable technical
verification (`G6`) and signed release (`G8`). §5.3 is explicit that `rf council`'s adversarial
evidence review is not a substitute for clinical content review, laboratory review, or adjudication:
council "can block evidence handoff; cannot approve clinical release." §5.3 names five minimum roles
this gate must eventually support — clinical content review 1, clinical content review 2 (independent,
"must not merely countersign reviewer 1"), laboratory review, adjudication (named adjudicator, not the
sole original author), and release authorization (the only gate that marks a KB pack release-ready).

None of this exists today. This feature (E0, `evidence-foundry-buildout-v1`) is scoped to
deterministic wire-up only — per the plan's decisions block §1, E0 ships **zero clinical review UI**.
Every module package the converter produces (including `modules/cbc_suite_v1/`) carries
`status: "unsigned-stub"`, `clinicalContentHash: null`, `approvedBy: []` — a proposal no clinical
reviewer has yet seen, precisely so this feature can exist without the review workflow this spec
addresses being built or even fully decided. CLAUDE.md's hard guardrail — "No AI-published rule
changes. Rule/KB edits require independent clinical review + executable tests + signed release" — is
binding today with zero tooling behind it beyond human discipline.

## Current State (what E0 actually shipped)

E0 shipped the substrate this spec's eventual design will sit on top of, but nothing review-specific:

- A module package layout (`modules/<id>/module.json`, `rules.json`, `candidates.json`,
  `evidence.json`, `evidence-assertions.json`, `rule-provenance.json`) that a review record could
  reference by path and content hash.
- Phase 5's canonical-serialization/manifest work (determinism-proven), the substrate ADR-0005's
  signing decision — and by extension this spec's reviewer-signature model — builds on.
- Zero reviewer roster, zero review-state model, zero UI, zero notification mechanism, and no
  mechanism to bind a named reviewer's signature to a specific content hash. `approvedBy` is an
  empty array schema placeholder only (see `docs/project_plans/design-specs/signed-kb-manifest.md`,
  DEF-4) — nothing reads or writes it.

## Design Sketch

ADR-0004 (`docs/adr/0004-clinical-approval-identity-adjudication.md`, `status: proposed`) resolves the
process/data-model question this spec would otherwise have to re-litigate from scratch: its
recommended default is **append-only, git-signed review files in the module package for E0/E1 v1**,
explicitly deferring the portal build below. Concretely, for the first operational module (CBC
Suite, E1):

1. Each independent review (clinical content review 1, clinical content review 2, laboratory review,
   adjudication, release authorization) is a versioned, append-only YAML/Markdown file under source
   control (e.g. `modules/<module_id>/reviews/<review_id>.yaml`), never mutated in place.
2. Reviewer identity is a named individual with an out-of-band-verified credential record tracked in
   a reviewer roster — never an automated agent, never an ARC/council output.
3. "Signature" is a cryptographic signature (the ADR-0005 key-custody mechanism) binding reviewer
   identity to the exact content hash of the material under review.
4. Reviewer 2 reviews independently, with no read dependency on reviewer 1's file.
5. Adjudication is a distinct signed file, produced only on disagreement, by a named adjudicator who
   is not the sole original author.
6. Release authorization is the terminal signed file; only its existence flips a KB pack from
   `unsigned-stub`/`review-pending` to `release-ready`.

This spec's own subject — Option 2 in ADR-0004's options (a dedicated review portal web application)
— is the follow-on this ADR names but declines to build: purpose-built reviewer UX (queues, diffs,
side-by-side passage/rule view), roster and credential management surfaced in-app, and enforcement of
the independent-review-before-disclosure rule at the application layer rather than by file-schema
convention alone. ADR-0004's stated trigger for promoting this from "append-only files" to "portal" is
review volume or reviewer feedback demonstrating the git-based workflow's friction is load-bearing —
not a fixed date or review count.

Building the portal also requires resolving its own trust boundary: a clinical review surface that
displays real evidence content and (once real reviewers use it) real reviewer identities is a
different threat model than the public, PHI-free microsite CLAUDE.md governs — it needs its own
security review before design work here can commit to an architecture, which is why this spec starts
at `maturity: shaping` rather than `committed`.

## Promotion Trigger

Per ADR-0004: E1 plan approved, reviewer roles named, and either (a) review volume across modules
makes the append-only-file workflow demonstrably unworkable, or (b) reviewer feedback identifies the
git-based friction as load-bearing. Do not build a portal preemptively — E1 v1 uses ADR-0004's
append-only file model first.

## Open Questions

Recorded here in prose (frontmatter `open_questions` intentionally left empty at this shaping stage,
per this feature's Phase 7 task instruction — these are the questions a `committed`-maturity revision
of this spec will need to resolve):

- Where does the reviewer roster live, and how are credentials verified out-of-band before a reviewer
  is added to it? ADR-0004 names the requirement but explicitly leaves roster mechanics to this spec.
- Does the portal read the same append-only review files ADR-0004 defines as its backing store (portal
  as a UI layer over the file model), or does it own its own database once built — and if the latter,
  how does that reconcile with the append-only, tamper-evident property clinical review records need?
- What is the actual friction threshold (review count, reviewer complaint volume, calendar time) that
  triggers building this, and who is authorized to make that call?
- How does the portal's authentication/authorization model interact with the reviewer-credential
  verification ADR-0004 requires — does the portal itself verify credentials, or only display a
  roster verified elsewhere?

## References

- `docs/adr/0004-clinical-approval-identity-adjudication.md` — this spec's seed ADR; recommended
  default and all three `explored_alternatives` above are drawn directly from its Options section.
- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §5.1, §5.3, §8.1.
- `docs/project_plans/design-specs/signed-kb-manifest.md` (DEF-4) — the manifest fields
  (`approvedBy`, `clinicalContentHash`) this review model populates.
- `docs/project_plans/design-specs/retrospective-validation-harness.md` (DF-E1-04) — depends on this
  spec's reviewer-identity/signature model plus an independent data-source SPIKE.
- CLAUDE.md hard guardrails: "No AI-published rule changes"; ARC clinical-council non-qualification
  note in the AOS-assets index.
