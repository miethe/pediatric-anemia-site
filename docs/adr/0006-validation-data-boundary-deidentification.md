---
type: adr
adr_id: ADR-0006
title: "Validation data boundary, de-identification, retention, and audit"
status: proposed
date: 2026-07-21
deciders: ["documentation-writer (draft)"]
supersedes: []
superseded_by: null
unblocks: ["DF-E1-04"]
source_refs:
  - "docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md §8.4 (PHI leakage into research)"
  - "docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md §8.5 item 6"
  - "CLAUDE.md — \"No PHI in the public microsite\" hard guardrail"
---

# ADR-0006: Validation data boundary, de-identification, retention, and audit

## Status

**proposed** — 2026-07-21. Not accepted. No implementation may proceed on the strength of this ADR
alone; acceptance requires an explicit follow-on decision, per the Phase 6 exit gate
(`.claude/progress/evidence-foundry-buildout/phase-6-progress.md`), which forbids marking any of the
eight pre-E1 ADRs `accepted` in this plan.

## Context

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §8.5 item 6 names this ADR
as required before E1: "ADR: validation data boundary, de-identification, retention, and audit." The
same document's §8.4 operational/governance risk table carries the row this ADR must resolve:

> **PHI leakage into research** — Failure mode: "Patient data enters public evidence run/writeback."
> Control: "Module runs contain no PHI; separate validation data boundary; sensitivity guard and
> secret/PHI scans."

The deferred item this ADR unblocks, `DF-E1-04` (retrospective validation harness), is the first place
in this program's roadmap where real, patient-derived case data would need to enter the system at all
— the harness's stated purpose is proving rule performance against actual clinical outcomes, which by
definition requires data that did not originate as public-domain guideline text. Every other artifact
this program has produced through E0 (rules, candidates, evidence records, test fixtures) is
guideline-derived or synthetic; none of it is patient-derived. `DF-E1-04`'s trigger for promotion is "a
signed E1 release candidate exists" (deferred-items triage table), meaning this ADR's decision does not
need to be implemented before E1, but it does need to exist in `proposed` form now so the `DF-E1-04`
design spec (Phase 7, `docs/project_plans/design-specs/retrospective-validation-harness.md`) has a
resolved architectural direction to seed from, rather than deferring the boundary question a second
time.

### Binding constraint (not one option among several)

CLAUDE.md's hard guardrails state, verbatim:

> **No PHI in the public microsite.** The browser assessment sends no patient data anywhere; no
> third-party scripts/fonts/analytics. Server/PHI modes require HIPAA controls and are separate.

This constraint is restated here as binding on every option this ADR considers: no option below may
place patient-identifiable data in the public clinician SPA, in any `rf` evidence run or writeback, in
this repository's committed content (rules, evidence, fixtures, build outputs), or in any artifact this
program's CI/build pipeline touches. An option that could only satisfy "retrospective validation" by
violating this guardrail is disqualified before comparison, not weighed against the others.

## Decision

Adopt a validation data boundary in which **no patient-identifiable data ever enters this repository,
its build outputs, or any `rf` run/writeback**, and where the first real retrospective-validation pass
is built against an externally governed, pre-de-identified dataset — with a synthetic/case-report
corpus used continuously as a complementary (not substitute) pre-retrospective regression harness. A
first-party HIPAA-controlled environment is explicitly named as a future option, not adopted now.

### Options considered

1. **External partner-governed, pre-de-identified dataset (recommended default).** Retrospective
   validation runs exclusively against data that has already been de-identified (Safe Harbor or Expert
   Determination) and released under a data-use agreement by an external partner (a health system's
   honest-broker pipeline, a public de-identified pediatric CBC dataset, or equivalent). Only
   de-identified, aggregate performance metrics — never row-level patient data — ever cross into this
   repository or any `rf` run.
   - **Pros**: Zero PHI custody burden on this codebase or team; the "no PHI in the public microsite"
     guarantee holds without qualification; no HIPAA Business Associate Agreement is needed for this
     program itself, since it never holds the identifiable data.
   - **Cons**: Depends on an external partner's cooperation, dataset availability, and licensing terms
     — outside this program's direct control; the harness must be designed against an interface
     contract for data it never directly possesses; cannot start until a data-use agreement is in
     place, which is slower than a first-party option.

2. **First-party HIPAA-controlled de-identification and validation environment.** Patient-derived data
   is de-identified by a keyed pipeline this program operates, hosted in a private, access-controlled
   server environment fully separate from the public microsite (consistent with CLAUDE.md's "Server/PHI
   modes require HIPAA controls and are separate" carve-out). Retrospective validation and its audit
   trail live entirely inside that private environment; only de-identified aggregate metrics cross into
   the public repository.
   - **Pros**: Full control over de-identification method, cohort size, and audit trail; not dependent
     on any external partner's timeline or licensing terms; scales better for repeated validation runs
     over time.
   - **Cons**: Requires this program to stand up real HIPAA technical, administrative, and physical
     controls (BAA, encrypted storage, access logging, breach-response plan, retention policy) —
     a significant new operational surface area disproportionate to this program's current
     unvalidated-research-prototype status; highest implementation cost of the three options.

3. **Synthetic / published-case-report corpus only.** No real patient data ever enters retrospective
   validation. Cases are synthetically generated or drawn from published, already-de-identified case
   reports/vignettes with explicit provenance, calibrated to approximate real-world prevalence and
   edge-case distributions.
   - **Pros**: Zero PHI risk by construction; fastest to start; requires no new infrastructure and
     stays entirely within this repository's existing guardrail without any external dependency.
   - **Cons**: Cannot, by itself, satisfy the "retrospective" rung of CLAUDE.md's validation ladder
     (content → technical → **retrospective** → silent-mode → human-factors → interventional) in the
     sense that ladder intends — a synthetic-only corpus risks understating the real-world data
     messiness (missingness patterns, transcription noise, method/analyzer drift) that retrospective
     validation exists specifically to surface.

### Recommended default

Option 1 for the program's first real retrospective-validation pass, with Option 3's synthetic/
case-report corpus run continuously as a pre-retrospective smoke and regression harness (already
partially served today by the dangerous-miss/boundary test corpus this program's E0 slice generates).
Option 2 (first-party HIPAA environment) is explicitly named as a later option, to be revisited only if
partner-governed data proves insufficient (cohort too small, licensing lapses, no partner available) and
the program is ready to take on real HIPAA operational custody — that revisit decision belongs to a
future ADR, not this one.

Rationale: Option 1 is the only option that satisfies the CLAUDE.md guardrail with the least new
operational surface area while still enabling a genuine retrospective-validation gate. Option 2's cost
is disproportionate to an unvalidated research prototype's current stage. Option 3 alone cannot carry
the retrospective rung of the validation ladder, so it is retained as a complement rather than the
answer.

## Retention and audit (partially resolved — flagged for `DF-E1-04`'s design spec)

- **Provenance**: any de-identified aggregate metric or dataset-derived figure entering this repository
  must carry a provenance record (source dataset identity/version, de-identification method, date,
  approving authority) analogous to the existing evidence-record pattern (`modules/*/evidence.json`) —
  no metric enters without a traceable source, consistent with the "no invented thresholds" guardrail.
- **Retention**: this repository never becomes a system of record for retained patient-derived data
  under any option considered. Retention of the underlying (non-public) dataset is owned by whichever
  party holds it — the external partner under Option 1, or this program's own HIPAA environment under
  Option 2 — and a specific retention period and deletion trigger are out of scope for this ADR to fix;
  the `DF-E1-04` design spec must name both explicitly before implementation begins.
- **Audit**: every access to validation data, even fully de-identified, must be logged with actor
  identity, timestamp, and purpose. Per `02` §5.3's separation of council approval from clinical
  release, this validation-data access log is a distinct audit trail from the rule/evidence review
  audit trail (see ADR-4) and must not be conflated with it.

## Consequences

### Positive

- Preserves the CLAUDE.md "no PHI in the public microsite" guarantee without qualification or
  exception.
- Unblocks the `DF-E1-04` design spec with a resolved architectural direction (external
  partner-governed data + synthetic complement) rather than a re-deferred open question.
- Keeps this program's operational burden proportionate to its current unvalidated-research-prototype
  status (CLAUDE.md: "Status: unvalidated research prototype").

### Negative

- Real progress on the retrospective rung of the validation ladder is now gated on an external
  dependency (a partner data-use agreement) outside this program's direct control.
- The synthetic-corpus complement cannot, alone, satisfy that rung — so the program has no fallback
  path to a genuine retrospective-validation claim if no partner dataset materializes, short of later
  adopting Option 2.

### Neutral

- This ADR does not name a specific partner or dataset — that identity remains a `DF-E1-04`-time
  decision, consistent with `02` §8.1's general pattern of deferring implementation specifics to E1.

## Unblocks

- **`DF-E1-04`** (retrospective validation harness) — primary. The harness cannot be designed until the
  data-boundary question this ADR addresses is at least `proposed`; `DF-E1-04`'s design spec
  (`docs/project_plans/design-specs/retrospective-validation-harness.md`) is seeded from this ADR (and
  from ADR-4, which separately resolves reviewer identity for adjudicating validation outcomes).

## References

- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §8.4 (PHI leakage into
  research risk row), §8.2 (clinical risks depending on retrospective validation), §5.3 (council vs.
  clinical governance are different gates), §8.5 item 6 (this ADR's charter).
- CLAUDE.md hard guardrails ("No PHI in the public microsite").
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md` — Deferred
  Items Triage Table, row `DF-E1-04`.
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-6-7-adrs-docs.md`
  — task `P6-T6`.
