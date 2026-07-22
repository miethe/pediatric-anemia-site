---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry: Retrospective Validation Harness"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-21
feature_slug: "evidence-foundry-buildout"
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
problem_statement: "No mechanism exists to measure rule/KB performance against real, adjudicated pediatric case outcomes before a release candidate can advance past the retrospective rung of the CLAUDE.md validation ladder."
open_questions:
  - "Data-source SPIKE (unresolved, independent of ADR-4/ADR-6): what real-world retrospective case corpus will actually serve as the E1 harness's validation input — an external health-system honest-broker pipeline, a public de-identified pediatric CBC dataset, or another partner-governed source — and under what data-use agreement? This SPIKE has not been run; it must complete before implementation planning for this item can begin (per PRD §12's open-question pattern and ADR-4's explicit note that this SPIKE is independent of the reviewer-identity decision)."
  - "Retention period and deletion trigger for whichever externally-held dataset is selected — ADR-6 explicitly defers naming both to this spec, and neither can be fixed before the data-source SPIKE resolves which external party (if any) governs the data."
  - "Replay/versioning mechanism: how are historical rule/KB signed-release versions pinned against historical cases so a validation result is attributable to a specific signed release rather than the current HEAD?"
  - "How does adjudication of a harness disagreement (harness-predicted pattern vs. clinical ground truth) map onto ADR-4's 'adjudicator not the sole original author' rule when the 'author' of a prediction is a deterministic rule set rather than a person?"
  - "Does the synthetic/case-report complement corpus (ADR-6 option 3, already partially served by this feature's E0 dangerous-miss/boundary test corpus) get promoted into the harness's continuous regression lane as-is, or does it need its own harness-specific extension?"
explored_alternatives:
  - "ADR-6 Option 1 (recommended default): external partner-governed, pre-de-identified dataset as the harness's real validation input; only de-identified aggregate metrics ever cross into this repository or any rf run/writeback. Depends entirely on the still-open data-source SPIKE to name the actual partner/dataset."
  - "ADR-6 Option 2: first-party HIPAA-controlled de-identification and validation environment operated by this program. Explicitly named by ADR-6 as a later fallback only, not adopted now — disproportionate operational burden for an unvalidated research prototype."
  - "ADR-6 Option 3: synthetic/published-case-report corpus only, run continuously as a pre-retrospective smoke/regression complement (not a substitute for the retrospective rung itself)."
  - "ADR-4 Option 1 (recommended default): append-only, git-signed review/adjudication files bind a named reviewer/adjudicator identity to a content hash — the same mechanism this harness's adjudication records would reuse for validation-outcome adjudication."
  - "ADR-4 Option 2: dedicated clinical review portal — rejected for E0/E1 v1 (this is DF-E1-01 itself, a separate deferred item, not built by this spec)."
  - "ADR-4 Option 3: generic issue tracker as the review/adjudication record — rejected as not tamper-evident or portable enough for a clinical governance record."
---

# Retrospective Validation Harness (DF-E1-04)

## Problem / Context

The CLAUDE.md validation ladder for this program is: content → technical → **retrospective** →
silent-mode → human-factors → interventional. Through the end of this feature
(`evidence-foundry-buildout-v1`, E0), only the content and technical rungs have any supporting
tooling (evidence-linked rules, executable test corpus, deterministic converter). Nothing in this
codebase measures rule/candidate performance against real, adjudicated pediatric case outcomes —
every artifact shipped through E0 (rules, candidates, evidence records, generated test fixtures) is
guideline-derived or synthetic, never patient-derived.

This item is sized **L** in the Evidence Foundry design spec (`docs/project_plans/expansion/
02-evidence-foundry-on-research-foundry.md` §6.1 "Retrospective validation harness", §7.3) and is
explicitly deferred out of this plan's scope (PRD §7 Deferred Items table; decisions block §1). It
cannot be implemented, or even fully designed, until two prerequisite decisions and one prerequisite
SPIKE resolve:

1. **Reviewer/adjudicator identity and signature model** — resolved (as `proposed`, not `accepted`)
   by `docs/adr/0004-clinical-approval-identity-adjudication.md`.
2. **Validation data boundary** (where real case data may live, de-identification requirements,
   retention/audit) — resolved (as `proposed`, not `accepted`) by `docs/adr/
   0006-validation-data-boundary-deidentification.md`.
3. **Data-source SPIKE** — *not yet run*. Independent of both ADRs above: which actual dataset or
   partner pipeline will supply the harness's real case corpus. See Open Questions below.

## Seeded From

- **ADR-4** (`docs/adr/0004-clinical-approval-identity-adjudication.md`): recommends append-only,
  git-signed review/adjudication files, reviewer-2-independence, and a named adjudicator who is not
  the sole original author. This harness's adjudication records (harness prediction vs. clinical
  ground truth) are expected to reuse the same signed-file/content-hash substrate, not invent a
  parallel mechanism.
- **ADR-6** (`docs/adr/0006-validation-data-boundary-deidentification.md`): recommends an external
  partner-governed, pre-de-identified dataset as the primary validation input, with a synthetic/
  case-report corpus run continuously as a complementary (not substitute) pre-retrospective
  regression harness. Names this spec as the place retention period and deletion trigger must be
  fixed, once the data-source SPIKE below identifies the actual dataset/partner.

## Design Sketch (non-committal — awaiting data-source SPIKE)

The harness's shape, at a minimum, needs:

- **Input**: a versioned, adjudicated case corpus meeting ADR-6's data-boundary constraint (no
  patient-identifiable data enters this repository, its build outputs, or any `rf` run/writeback).
- **Replay target**: a specific signed KB release candidate (once `ADR-5`'s signing mechanism and
  `DF-E1-06` exist) — not the current working tree — so a validation result is reproducibly
  attributable to one release.
- **Adjudication records**: reuse ADR-4's append-only, signed-file model to record whether the
  harness's rule/candidate output matched, missed, or over-triggered relative to the case's
  clinical ground truth, with a named adjudicator.
- **Continuous complement**: the synthetic/case-report corpus (ADR-6 option 3) already has a partial
  analog in this feature's E0 dangerous-miss/boundary test corpus (Phase 4) — the harness should
  extend, not duplicate, that pattern for its regression lane.
- **Reporting**: aggregate, de-identified performance metrics only (sensitivity/specificity/positive-
  predictive-value framing per pattern, never a single blended "confidence score" — see this
  program's non-goal: "A single 'confidence score' combining evidence confidence, rule points, and
  patient likelihood").

None of the above is a committed design — each bullet depends on the data-source SPIKE resolving
which real corpus is available, which in turn determines feasible replay/adjudication mechanics.

## Promotion Trigger

Per the deferred-items triage table: **a signed E1 release candidate exists** (this harness validates
a release candidate, so a signable candidate must exist first — see `DF-E1-06`, signed release + key
custody). The data-source SPIKE above is a separate, non-blocking prerequisite that can run in
parallel with E1 signing work, but implementation planning for this item cannot begin until it
completes.

## Retention & Audit (flagged open per ADR-6)

ADR-6 explicitly declines to fix a retention period or deletion trigger for the underlying
(non-public) dataset, deferring both to this spec. Neither can be named responsibly until the
data-source SPIKE identifies the actual external partner or dataset (Option 1) or confirms no
partner is available and Option 2 (first-party HIPAA environment) must be revisited — that revisit
decision itself belongs to a future ADR, not this spec. Every de-identified aggregate metric or
dataset-derived figure that does enter this repository must carry a provenance record (source
dataset identity/version, de-identification method, date, approving authority), consistent with
this program's "no invented thresholds" guardrail and the existing evidence-record pattern
(`modules/*/evidence.json`). Validation-data access is logged separately from the rule/evidence
review audit trail (ADR-4) per ADR-6's explicit instruction not to conflate the two.

## Non-Goals (this spec, and this feature)

- This spec does not implement any harness code, dataset connector, or adjudication tooling — E0
  ships zero retrospective-validation artifacts.
- No patient-identifiable data may enter this repository, its build outputs, or any `rf` run/
  writeback under any option this spec or ADR-6 considers.
- This spec does not select a specific external partner or dataset — that identity is named at
  data-source-SPIKE time, not here.
- Nothing produced by this spec, or by the E0 feature it belongs to, constitutes clinical validation,
  retrospective validation, or release-readiness — the program remains an unvalidated research
  prototype until the actual validation gates in CLAUDE.md are passed.

## References

- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §6.1, §7.3 (item sizing
  and capability description), §8.4 (PHI leakage risk row).
- `docs/adr/0004-clinical-approval-identity-adjudication.md` (reviewer/adjudicator identity, signature
  model).
- `docs/adr/0006-validation-data-boundary-deidentification.md` (data boundary, retention/audit —
  the primary decision this spec is seeded from).
- `docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md` §7 Deferred Items, §12
  Open Questions.
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md` Deferred
  Items Triage Table, row `DF-E1-04`.
- CLAUDE.md validation ladder (content → technical → retrospective → silent-mode → human-factors →
  interventional) and "No PHI in the public microsite" hard guardrail.
