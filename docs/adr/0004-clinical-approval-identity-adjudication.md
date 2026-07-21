---
title: "ADR-0004: Clinical approval identity, signature, and adjudication workflow"
status: proposed
date: 2026-07-21
deciders: [clinical-governance, platform-engineering]
supersedes: []
superseded_by: []
unblocks: ["DF-E1-01", "DF-E1-04"]
---

# ADR-0004: Clinical approval identity, signature, and adjudication workflow

## Status

**Proposed** — 2026-07-21. Not accepted. No clinical governance body has reviewed or ratified this
record; it is an architecture recommendation only, produced ahead of E1 planning per
`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §8.5 item 4.

## Context

The Evidence Foundry design spec's governance model (`02` §5.1 "Gate architecture") places
independent clinical review, laboratory review, and adjudication as distinct gates (`G5`) strictly
after evidence council (`G3`) and converter eligibility (`G4`), and strictly before executable
technical verification (`G6`) and signed release (`G8`). `02` §5.3 ("Council and clinical governance
are different gates") is explicit that `rf council`'s adversarial evidence review is not, and cannot
substitute for, clinical content review, laboratory review, or adjudication — `rf council` "can block
evidence handoff; cannot approve clinical release." §5.3 further specifies the minimum roles this
plan must eventually support:

| Review | Minimum roles | Authority |
|---|---|---|
| Clinical content review 1 | Subspecialist appropriate to module; pediatric hematologist for CBC | Independent vote |
| Clinical content review 2 | General pediatrician or second qualified pediatric clinician, per rule class | Independent vote; must not merely countersign reviewer 1 |
| Laboratory review | Laboratory medicine/pathology | Required for all lab-dependent rules |
| Adjudication | Named adjudicator not the sole original author; clinical governance chair as needed | Produces signed decision record |
| Release authorization | Authorized clinical and quality/release roles | Only gate that marks KB release-ready |

`02` §8.1's open-decisions table already carries a tentative answer to "Where does dual clinical
review live in E0?" (recommended default: "Append-only signed review files for E0; portal by E1"),
but that row is a design-spec recommendation, not a ratified decision, and it does not specify *who*
counts as a valid reviewer identity, what a "signature" cryptographically or procedurally means, or
how disagreement between reviewer 1 and reviewer 2 is adjudicated and recorded. This feature (E0,
`evidence-foundry-buildout-v1`) is scoped to deterministic wire-up only — per the plan's decisions
block §1, E0 ships **zero clinical review UI**, and per `CLAUDE.md`'s hard guardrails, "No
AI-published rule changes. Rule/KB edits require independent clinical review + executable tests +
signed release" is already binding. E0's converter output is explicitly a *proposal* — an unsigned,
`status: unsigned-stub` KB pack that no clinical reviewer has yet seen — precisely so that this
feature can exist without requiring the clinical review workflow this ADR addresses to be built or
even fully decided.

Two E1-scope deliverables cannot be designed until this decision is made:

- **DF-E1-01** — the clinical review portal/workflow (sized L in `02` §7.3) needs a review-state
  model and named, credentialed reviewer identities that do not exist yet; its design spec
  (`docs/project_plans/design-specs/clinical-review-portal-workflow.md`, authored in Phase 7 of this
  plan) is explicitly seeded from this ADR's options.
- **DF-E1-04** — the retrospective validation harness (sized L in `02` §7.3) requires real
  adjudicated case data and a signed release candidate; adjudication in the retrospective-validation
  sense depends on the same reviewer-identity and signature model this ADR resolves, plus a
  data-source SPIKE (PRD §12) that is independent of this decision.

Both spec stubs will assume this ADR's recommended default and its named alternatives as their
starting `explored_alternatives`.

## Decision

**Recommended default: append-only, git-signed review files for E0/E1 v1, explicitly deferring a
review portal to a later E1 iteration once volume or usability data justifies the build.**

Concretely, for the first operational module (CBC Suite, E1):

1. Each independent review (clinical content review 1, clinical content review 2, laboratory
   review, adjudication, release authorization) is recorded as a versioned, append-only YAML/Markdown
   file under source control (e.g. `modules/<module_id>/reviews/<review_id>.yaml`), never mutated
   in place — corrections are new files that supersede, never edits.
2. Reviewer identity is a named individual with an out-of-band-verified credential record (real
   name, license/credential reference, module-scope authorization) tracked in a reviewer roster —
   never an automated agent, never an ARC/council output (per this repo's CLAUDE.md: "ARC has a
   repository-ready pediatric clinical council... treating that ARC review as credentialed clinical
   sign-off is the other most likely mistake").
3. "Signature" means a cryptographic signature (the same key-custody mechanism ADR-0005 resolves for
   KB releases) binding the reviewer identity to the exact content hash of the rule/passage/test set
   under review — not merely a name typed into a file. This ties review authenticity to the same
   determinism/hash infrastructure this plan's Phase 5 (manifest & semantic diff) already builds.
4. Reviewer 2 MUST review independently before seeing reviewer 1's vote (procedural requirement in
   the review file schema: reviewer 2's file has no read dependency on reviewer 1's), matching §5.3's
   "must not merely countersign reviewer 1."
5. Adjudication is a distinct, separately signed file produced only when reviewer 1 and reviewer 2
   disagree; the adjudicator MUST be a named individual who is not the sole original author of the
   content under review.
6. Release authorization is the terminal, distinct signed file — its existence is what flips a KB
   pack from `unsigned-stub`/`review-pending` to `release-ready`; no other gate may set that state.

This is a process and data-model decision only. It does not require building a portal, a database,
or any new runtime component in E0 or early E1 — it is implementable as files in the existing
module package layout, consistent with this feature's "no new infrastructure, deterministic wire-up
only" scope.

### Options considered

1. **Append-only signed files in the module package (recommended).**
   - **Pros**: Zero new infrastructure; reuses the git history and hash/signature substrate this
     plan already builds (Phase 5 manifest, ADR-0005 signing); auditable by inspection; matches E0's
     already-shipped pattern of file-based artifacts; lowest implementation cost for E1 v1.
   - **Cons**: Poor reviewer ergonomics (no UI, no notification, no workflow state machine); does not
     scale past a handful of reviewers/modules without tooling; git literacy required of clinical
     reviewers, who are not engineers.
   - **Verdict**: Adopt for E1 v1; treat portal ergonomics as a follow-on need once review volume or
     reviewer feedback demonstrates the friction is load-bearing (this is exactly DF-E1-01's trigger
     condition: "E1 plan approved + reviewer roles named").

2. **Dedicated clinical review portal (web application).**
   - **Pros**: Purpose-built reviewer UX (queues, diffs, side-by-side passage/rule view,
     notifications); enforces the independent-review-before-disclosure rule at the application layer
     rather than by file-schema convention; a natural home for reviewer roster management and
     credential tracking.
   - **Cons**: New infrastructure (auth, hosting, a second application surface, its own security
     review) that this plan's scope (E0, deterministic wire-up, "no new infra") explicitly excludes;
     directly overlaps with the hard guardrail that "the browser assessment sends no patient
     data anywhere" — a portal is a different trust boundary than the public microsite and needs its
     own threat model; unjustified before reviewer volume exists.
   - **Verdict**: Reject for E0/E1 v1; this is DF-E1-01 itself — a full L-sized deliverable this ADR
     explicitly hands off, not something this ADR builds.

3. **Generic issue tracker (e.g., GitHub Issues/PRs) as the review record.**
   - **Pros**: Zero build cost; reviewers already may have GitHub access; supports comments/threads
     natively; PR review UI gives a built-in diff view.
   - **Cons**: Issue/PR state is mutable and force-pushable — violates the append-only, tamper-evident
     property clinical review records need; no native cryptographic signature binding a reviewer
     identity to a content hash; third-party platform dependency for a clinical governance record is
     a poor fit for long-term auditability and export; conflates engineering workflow tooling with
     clinical sign-off, risking exactly the "council approval confused with clinical release" risk
     `02` §8.4 names.
   - **Verdict**: Reject. Convenient but not tamper-evident or portable enough for a clinical release
     record that may need to survive platform migrations and regulatory audit.

## Consequences

### Positive

- E1 can implement dual clinical review, laboratory review, and adjudication using infrastructure
  this plan already builds (module package layout, hash/signature substrate), with no new service.
- The append-only, signed-file model is directly auditable and matches this repo's existing
  "no invented thresholds, everything traces to a record" discipline.
- Reviewer-2-independence and adjudicator-not-author rules are encoded as concrete file-schema/
  process rules, not left as prose intent — reduces "review theater" risk (`02` §8.4).

### Negative

- Reviewer ergonomics are poor at this stage (git-based, file-based); this will not scale past a
  small number of concurrent reviews/modules without portal tooling (DF-E1-01).
- Reviewer roster and credential tracking is not yet designed by this ADR — it names the requirement
  but leaves roster mechanics (where the roster file lives, how credentials are verified out-of-band)
  to DF-E1-01's design spec.

### Neutral

- This ADR does not decide the signing algorithm or key-custody mechanism — that is ADR-0005's scope;
  this ADR only requires that *a* signature mechanism exists and binds reviewer identity to content
  hash.

## Unblocks

- **DF-E1-01** (clinical review portal/workflow, `docs/project_plans/design-specs/clinical-review-portal-workflow.md`):
  seeded by this ADR's three options as its `explored_alternatives`; portal design work cannot start
  responsibly until reviewer roster/credential and signature semantics are at least proposed, which
  this ADR does.
- **DF-E1-04** (retrospective validation harness, `docs/project_plans/design-specs/retrospective-validation-harness.md`):
  needs named reviewer/adjudicator identity and a signed release candidate to generate real
  adjudicated case data; this ADR's reviewer-identity and signature model is a prerequisite input
  alongside the still-open data-source SPIKE (PRD §12).

## References

- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §5.1 (gate architecture),
  §5.3 (council vs. clinical governance), §8.1 (open decisions table), §8.5 item 4.
- `docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md` FR-22 (this ADR's
  acceptance criteria) and §8 Dependencies.
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`
  "Decisions & OQ Resolutions" and "Deferred Items & In-Flight Findings Policy" (DF-E1-01, DF-E1-04
  rows).
- `CLAUDE.md` hard guardrails: "No AI-published rule changes"; ARC clinical-council non-qualification
  note in the AOS-assets index.
- `docs/adr/0005-kb-serialization-signing-key-custody.md` (signing/key-custody mechanism this ADR's
  signature model depends on — informed-by, not superseded-by).
