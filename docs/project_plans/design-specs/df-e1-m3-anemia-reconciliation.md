---
schema_version: 2
doc_type: design_spec
title: "DF-E1-M3 (finish pass): Anemia Evidence-Layer Reconciliation, Now Informed by P4-T6's Empirical Semantic-Diff"
status: draft
maturity: idea
created: '2026-07-23'
updated: '2026-07-23'
feature_slug: "multi-bundle-conversion-e1-finish"
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
related_documents:
  - docs/project_plans/design-specs/anemia-backfill-reconciliation-procedure.md
  - modules/anemia/EVIDENCE-PROVENANCE-NOTE.md
  - .claude/findings/multi-bundle-conversion-e1-finish-findings.md
problem_statement: "The prior pass's anemia-backfill-reconciliation-procedure.md (DF-E1-M3) structured the evidence.json-vs-evidence-assertions.json reconciliation choice as three research-category options without empirical data on whether the converter's propose output for anemia diverges from the committed evidence-assertions.json at all; this pass's P4-T4/T5/T6 now supplies that empirical result -- it does not resolve the reconciliation, but it does close one previously-open question (does the converter path even produce a divergent view worth reconciling)."
open_questions:
  - "Given the semantic-diff is empty by construction (a self-comparison), does the anemia reconciliation question (option a/b/c from the prior spec) even have a converter-derived signal to draw on yet, or does resolving it still require a future propose run that genuinely re-derives assertions independently rather than carrying them through verbatim?"
  - "Does closing DF-E1-M1's promotion gap for anemia specifically (see df-e1-m1-rule-authoring-workflow.md) change which of the prior spec's three options becomes preferable, given a promoted anemia decision's basis would need to cite one of the two evidence-layer files as authoritative?"
  - "Should a future pass modify propose.mjs so that a non-cbc module's evidence projection is independently re-derived from the fixture rather than carrying the committed file through verbatim, specifically so semantic-diff.json becomes a meaningful comparison instead of a structurally-guaranteed-empty one?"
explored_alternatives: []
---

# DF-E1-M3 (finish pass): Anemia Evidence-Layer Reconciliation, Now Informed by P4-T6's Empirical Result

## What this document is, and is not

This is a **narrow, idea-maturity follow-on** to
`docs/project_plans/design-specs/anemia-backfill-reconciliation-procedure.md` (the prior pass's
`DF-E1-M3` spec, still `maturity: idea`, still unresolved among its three named options). **This
document does not re-derive, duplicate, or resolve that spec's option (a)/(b)/(c) reconciliation
question.** It exists solely to fold in one new, empirical fact this pass's Phase 4 produced —
`modules/anemia/semantic-diff.json`'s actual `added`/`removed`/`changed` counts — and to state
plainly what that fact does, and does **not**, tell a future reader trying to resolve the prior
spec's still-open question.

Read the prior spec first for the full problem statement (the two-pipeline shape comparison table,
the three candidate options, the trigger condition). This document assumes that context and adds
only the new information.

## The new empirical input: P4-T4/T5/T6's actual semantic-diff result for anemia

This pass's Phase 4 (P4-T4, extending `tools/rf-bundle-to-kb-pack/lib/semantic-diff.mjs` with
`diffEvidenceAssertions()`; P4-T5, committing the result) produced and committed
`modules/anemia/semantic-diff.json`, comparing a real `propose` run's freshly-produced
`evidence-assertions.json` against `modules/anemia/`'s own currently-committed
`evidence-assertions.json`. The real, measured result:

| added | removed | changed |
|---:|---:|---:|
| 0 | 0 | 0 (35 assertions on both sides) |

**What this DOES establish (stated honestly, per P4-T6's adjudication —
`.claude/findings/multi-bundle-conversion-e1-finish-findings.md`, "P4-T6" section, whose exact
framing this document reuses without alteration):**

- `diffEvidenceAssertions()` now exists as a committed, pure, unit-tested function, wired into
  `propose`'s emission path for `anemia` (and the other two non-cbc modules). The comparison
  capability the prior spec's option (b)/(c) discussion would eventually need ("a deterministic
  mapping" between the two evidence shapes, or a regression-proofing mechanism) is now instrumented
  for the `evidence-assertions.json` surface specifically.
- The committed bespoke `modules/anemia/evidence-assertions.json` remains untouched and authoritative
  (R-3's fail-closed default) — proven, not merely asserted, by a test that `git diff` on that file
  is empty after this pass's `propose` runs (`tests/ef-multi-bundle-determinism.test.mjs`, P4-T5's own
  AC).

**What this does NOT establish — the honesty boundary this document exists to hold the line on:**

- The diff is empty **by construction, not by independent agreement.** `propose.mjs`'s evidence
  projection for a non-cbc module (anemia included) is a **byte-verbatim copy** of that module's own
  committed `evidence-assertions.json` — the converter does not independently re-derive anemia's
  evidence layer from `tests/fixtures/rf-ev-001/` at all; it carries the committed file through
  unchanged. The semantic-diff is therefore a **self-comparison**, empty for any input, not a
  cross-check between two independently-produced views.
- **This is not new information about the prior spec's actual reconciliation question.** The prior
  spec's problem is `evidence.json` (EP-3/EP-4 pipeline) vs. `evidence-assertions.json` (bespoke
  projection) — two files with genuinely different shapes and origins. P4-T4/T5/T6's semantic-diff
  compares `evidence-assertions.json` against **itself** (via a verbatim-copy round-trip through
  `propose`), not against `evidence.json`. It supplies **zero** empirical signal on the actual
  `evidence.json`-vs-`evidence-assertions.json` question the prior spec's three options address.
- **This document does not claim the converter regenerates, reproduces, or replaces anemia's bespoke
  evidence.** That specific phrasing is deliberately avoided throughout this program's Phase 4/5
  documentation (per the findings doc's own instruction) because it would overstate what a
  verbatim-copy-then-self-compare operation does.
- Consequently: **the prior spec's three options (leave-parallel / generate-citations-from-assertions
  / deprecate-EP-3-pipeline-role) remain exactly as unresolved as before this pass.** This pass adds a
  capability (`diffEvidenceAssertions()`) that *could* eventually inform option (b)'s "deterministic
  mapping" work, but it has not yet been pointed at the actual `evidence.json` shape, and doing so is
  explicitly out of this document's scope (see below).

## What would need to happen before this new capability actually informs the reconciliation

None of the below is designed or committed here — it is recorded so a future pass does not assume
`diffEvidenceAssertions()` already solves, or is trivially adaptable to solve, the prior spec's
question:

1. A future pass would need to either (a) extend `diffEvidenceAssertions()` (or write a sibling
   function) to compare `evidence.json`'s `sources[].passages[]` shape against
   `evidence-assertions.json`'s `assertions[]` shape directly — a non-trivial schema transform, per
   the prior spec's own option (b) write-up — or (b) change `propose.mjs` so a non-cbc module's
   evidence projection is genuinely independently re-derived from its fixture rather than carried
   through verbatim, so the *existing* `diffEvidenceAssertions()` comparison becomes meaningful
   against a second, independently-produced `evidence-assertions.json` rather than a verbatim copy of
   the first.
2. Either path is new engineering work, not something this document authorizes or schedules.
3. Whichever path is taken, any change touching `evidence.json`'s citation surface (which 91 live
   `anemia` rules depend on) still requires this repository's ordinary rule/KB-edit guardrail —
   independent clinical review + executable tests + signed release — exactly as the prior spec's own
   "Trigger for promotion" section already states.

## What this document does not decide

- Does not select among the prior spec's three options.
- Does not extend `diffEvidenceAssertions()` to compare against `evidence.json`.
- Does not change `propose.mjs`'s verbatim-copy behavior for any module.
- Does not promote the prior spec, or itself, beyond `maturity: idea`.

## Promotion trigger

Same trigger as the prior spec (`anemia-backfill-reconciliation-procedure.md`): "Reconciliation
procedure prioritized in a later E1 iteration," per the parent (prior) plan's Deferred Items Triage
Table, `DF-E1-M3` row. This document does not introduce a new or earlier trigger — it only records
that this pass's semantic-diff work, while real and committed, does not itself constitute that
trigger having occurred.

## Cross-references

- `docs/project_plans/design-specs/anemia-backfill-reconciliation-procedure.md` — the full problem
  statement, three-option structure, and reconciliation trigger this document narrowly extends; read
  it first.
- `modules/anemia/EVIDENCE-PROVENANCE-NOTE.md` — the P4-T3 (prior pass) seam note this pass's
  semantic-diff work does not alter.
- `modules/anemia/semantic-diff.json` — the concrete, committed artifact this document is written
  against.
- `.claude/findings/multi-bundle-conversion-e1-finish-findings.md`, "P4-T6" section — the adjudication
  this document's honesty framing is drawn from verbatim in substance.
- `docs/architecture.md` §2a — this pass's own module-inventory update, which states the same
  instrumented-not-resolved distinction for all 3 non-cbc modules, not anemia alone.
- `docs/project_plans/design-specs/df-e1-m1-rule-authoring-workflow.md` — the sibling deferred-item
  document (promotion-workflow gap) whose Open Question 5 names this same dual-pipeline interaction
  for anemia from the promotion side.
