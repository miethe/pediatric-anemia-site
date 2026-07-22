---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry: Retrospective Validation Harness"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-22
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

## E1 State (Phase 5, 2026-07-22) — DF-E1-04 landed; DF-E1-09 remains deferred

**This spec now serves two deferred items.** It was originally seeded for `DF-E1-04` (build the
harness), whose promotion trigger — "a signed E1 release candidate exists" — is satisfied: the
`evidence-foundry-e1-v1` plan's Phase 4 built the harness machinery for real, as
`tools/retro-validate` (`cli.mjs` verbs `check-fixtures`/`run`/`report`). It enforces the
fixtures-only boundary this spec's Design Sketch called for as a two-layer gate (schema shape +
procedural identifier-denylist scan, `lib/boundary.mjs`), replays a version-pinned candidate build
resolved exclusively via a `releases/registry.json` digest match (never "current tree",
`lib/replay.mjs`, FR-19), computes exactly the five OQ-5 **software-agreement** measures (never
sensitivity/specificity/clinical-performance framing, `lib/metrics.mjs`, FR-21), bridges disagreeing
cases into `tools/review-record`'s adjudication scaffold (`lib/discordance.mjs`, FR-23), and
access-logs every invocation (`lib/access-log.mjs`, FR-22). Every one of the Design Sketch bullets
below is now built, not merely sketched, for the **synthetic/de-identified fixture** case — see
`tools/retro-validate/README.md` for the authoritative as-built description.

What the harness still cannot do — and structurally refuses to do — is run against real,
patient-derived case data. That is `DF-E1-09` (real-data retrospective run), a *separate* deferred
item this spec now also tracks. Per Ruling R6 (`evidence-foundry-e1-v1` PRD) and gate **G3**
(`docs/governance/gates-registry.md` — "G3: Data-source SPIKE verdict + data-partner DUA"),
`DF-E1-09`'s remaining scope is exactly:

1. **Gate G3 clearance** — both, independently: (a) the data-source SPIKE
   (`docs/project_plans/SPIKEs/spike-007-retrospective-data-source.md`, "SPIKE-007") reaching a
   recorded, explicit GO/NO-GO verdict — the charter is authored but the SPIKE has **not been run**;
   and (b) an executed data-use agreement (DUA) with an external data partner supplying
   already-de-identified data. Neither is a task any agent in this plan performs; both are named-human
   acts.
2. **Human-set protocol thresholds** (FR-24) — `tools/retro-validate report --protocol <doc>` accepts
   only a document conforming to `schemas/protocol.schema.json`, whose every leaf threshold
   (`dangerousMissRateThreshold`, `utilityMeasures`, per-stratum values) is `const: null` in this
   plan: software never invents or defaults a clinical threshold. Populating a real threshold, and
   deciding whether any report is honored against one, is a human governance act entirely outside
   this schema and this tool — `lib/metrics.mjs#evaluateProtocolQualification` never returns
   `qualifying: true` regardless of the schema's own gate, so every `agreement-report.json` carries
   the FR-24 "non-qualifying — protocol not prespecified by humans" banner unconditionally.
3. **Retention period and deletion trigger — flagged must-fix per ADR-0006.** ADR-0006 explicitly
   declines to name either value (`docs/adr/0006-validation-data-boundary-deidentification.md`) and
   this spec's own "Retention & Audit" section below has carried that gap open since it was authored.
   It is **not resolved by Phase 4's harness build** — the harness's fixture-corpus schema and
   identifier-denylist scan enforce the input *boundary* (synthetic/de-identified only), which is a
   different concern from how long an externally-held real dataset may be retained and what triggers
   its deletion once one exists. SPIKE-007's RQ3 is where the concrete framework and (once a partner
   is named) concrete values get produced; until then, this remains an open must-fix, not a design
   choice deferred by convenience.

None of the above changes this spec's `maturity: shaping` — `DF-E1-09` cannot enter implementation
planning until G3 clears and thresholds are set, exactly as this section states.

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
- `tools/retro-validate/README.md` — the as-built harness (Phase 4 of `evidence-foundry-e1-v1`):
  `check-fixtures`/`run`/`report` verbs, the two-layer fixtures-only boundary, version-pinned replay,
  software-agreement metrics, discordance/adjudication bridge, access log, and the FR-24 human-only
  protocol schema.
- `docs/project_plans/SPIKEs/spike-007-retrospective-data-source.md` ("SPIKE-007") — the chartered,
  not-yet-run data-source SPIKE that `DF-E1-09`'s G3 clearance and this spec's open retention/
  deletion-trigger question both resolve into.
- `docs/governance/gates-registry.md` — gate **G3** ("Data-source SPIKE verdict + data-partner DUA"),
  the external human-blocked state gating `DF-E1-09`.
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md` Deferred Items
  Triage Table, row `DF-E1-09` (this row points back to this spec for the real-data-run update).
