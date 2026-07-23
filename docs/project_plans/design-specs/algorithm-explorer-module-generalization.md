---
schema_version: 2
doc_type: design_spec
title: "Algorithm-explorer module generalization (DF-SMS-03)"
status: draft
maturity: idea
created: 2026-07-23
updated: 2026-07-23
feature_slug: spa-module-switcher
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
related_documents:
  - .claude/findings/spa-module-switcher-findings.md
  - docs/architecture.md
open_questions:
  - "Does each module need its own hand-authored `<moduleId>Walkthrough` (anemia's shape lifted per-module), or should the walkthrough be generated from a module's rule categories and candidate IDs — and if generated, from what schema fields, since `schemas/rule.schema.json` does not today model 'walkthrough step'?"
  - "How does a module-generalized explorer handle `facts.*` accessors — today `src/algorithmExplorer.js:257-366` reads `facts.cbc.hb`, `facts.retic.*`, `facts.iron.ferritin`, etc.; other modules' derived facts have different shapes (CBC has `facts.cbc.wbc.neutrophils`; growth has `facts.anthropometry.*`; kidney has `facts.chemistry.creatinine`); does the explorer read a per-module fact schema, dispatch to per-module accessor functions, or something else?"
  - "Does the 'Use in assessment' path (currently hardcoded to `assessPediatricAnemia`; P4 references `src/algorithmExplorer.js:621` as the dispatch site — verify at execution time) become a `assessModule(moduleId, …)` call, and if so does it inherit the eligibility predicate from `src/moduleEligibility.js` or duplicate it?"
  - "Should the explorer's example-case picker be per-module (anemia has 6 worked examples; other modules have zero today) — is a module without worked examples permitted to show the explorer with an empty picker, or does the explorer degrade to unavailable under that condition?"
  - "Is the explorer's cost-of-generalization worth paying at all, or is a per-module explainer view a better fit for modules whose clinical algorithm has a fundamentally different structure than anemia's ordered candidate ranking (e.g. a growth module whose primary output is z-score bands rather than diagnostic patterns)?"
explored_alternatives:
  - "Lift-and-parameterize — treat the current anemia-shaped explorer as a template, add per-module hooks for `walkthrough`, `facts.*` accessors, and dispatch, and let each module supply its own hook contents. Preserves the current UI shape across modules but requires each module to author its own walkthrough content, which is a clinical-review-shaped authoring load DF-SMS-03 does not itself pay."
  - "Replace with per-module explainer views — instead of one generalized explorer, each module owns an `explainer` hook that renders its own tab content. Loses the shared UI shape but removes the schema-fitting problem and lets each module's algorithmic shape drive its own explainer design."
  - "Retire the explorer entirely and rely on `rules.json`/`candidates.json` browsing — the explorer's value is arguably duplicated by the `#rules` tab plus the `#evidence` tab; a future audit might conclude the explorer is not worth generalizing at all. Explicitly named as a legitimate outcome of this spec's execution."
---

# Algorithm-explorer module generalization (DF-SMS-03)

## Problem / Context

`src/algorithmExplorer.js` is anemia-shaped end to end:

- **Walkthrough content is anemia-specific.** `anemiaWalkthrough` (see approximately
  `src/algorithmExplorer.js:290-303` — verify anchor at execution time) hardcodes the ordered
  interpretive steps a clinician takes through pediatric anemia's algorithm (CBC reading →
  reticulocyte → morphology → confirmatory workup). No other module has an equivalent walkthrough
  authored.
- **Fact accessors are anemia-specific.** The explorer reads `facts.cbc.hb`, `facts.retic.*`,
  `facts.iron.ferritin`, `facts.smear.*` (see approximately
  `src/algorithmExplorer.js:257-366` — verify anchor at execution time). These paths exist under
  anemia's derived-facts shape; other modules produce different shapes via
  `src/facts/registry.js`.
- **Dispatch is hardcoded to `assessPediatricAnemia`.** The "Use in assessment" path (see
  approximately `src/algorithmExplorer.js:621` — verify anchor at execution time) invokes
  `assessPediatricAnemia` directly, bypassing the module-aware `assessModule(moduleId, …)`
  entry point added by `spa-module-switcher-v1` P2-02. This is the concrete finding **E-3** in
  `.claude/findings/spa-module-switcher-findings.md` — a gpt-5.6-terra adversarial review of the
  P4 slice confirmed the dispatch would still evaluate anemia even if `DEFAULT_MODULE_ID` ever
  became a ready non-anemia module. That finding was recorded, bounded, and deferred to this
  spec; the bounding gates are P4 (explorer initialization gated on the selectable anemia module
  being active) and P5-01 (the `#algorithm` tab is degraded for non-anemia modules).

Generalizing the explorer is an **explicit non-goal** of `spa-module-switcher-v1` (PRD §7 R-8):
"The explorer is anemia-shaped end to end and this feature must degrade, not generalize it." The
switcher discharges its obligation by hiding the tab under any module that is not `anemia`, so no
clinician-facing surface today executes the explorer against a non-anemia module.

This spec scopes the generalization; it does not perform it.

## Why the switcher degrades rather than generalizes

Two reasons stated by the PRD (§7 non-goals and R-8):

1. **Clinical-review-shaped authoring load.** Each module's walkthrough is a clinician-authored
   interpretation of that module's algorithm. Generating walkthroughs mechanically from
   `rules.json` would produce something that reads like a rule list, not a walkthrough; and this
   repository's guardrails forbid AI-authored clinical content. Adding a walkthrough per module is
   therefore per-module clinical authoring work, not engineering work.
2. **Schema shape divergence.** The explorer's `facts.*` accessors are per-module. Adjusting the
   accessors module-by-module means either the explorer becomes conditional on `moduleId` at every
   access site (which is what the switcher explicitly rejected via `src/moduleEligibility.js`'s
   single-predicate design) or each module supplies its own accessor hooks (which is a wider
   module-interface change).

Either path is larger than a UI-feature-sized scope and blocks on decisions that a switcher-scale
pass cannot make.

## Design Sketch

Once a second module becomes selectable (see promotion trigger), the shape most likely to fit is
**option (b) from `explored_alternatives`: per-module explainer views**, not one generalized
explorer. Justification:

- Each of the currently-registered non-anemia modules has a fundamentally different clinical shape
  than anemia's ordered-candidate ranking:
  - `cbc_suite_v1` is cytopenia interpretation over a full CBC panel — its explanation surface is
    more like a decision tree over neutrophil/platelet/hemoglobin abnormalities than a linear
    walkthrough.
  - `growth_suite_v1` is anthropometry z-score band interpretation — its explanation surface is
    per-measurement (weight, height, BMI, head circumference) rather than ordered.
  - `kidney_suite_v1` is chemistry-based renal function interpretation — creatinine, eGFR, urine
    protein/creatinine — again a different interpretive shape.
- Forcing anemia's ordered-walkthrough shape onto any of these would misrepresent how the module's
  clinical algorithm actually reads.

The concrete design (an `explainer` hook on `modules/<id>/index.js`, or a per-module walkthrough
file at `modules/<id>/walkthrough.json` interpreted by a generic renderer, or an entirely
module-owned React-style component pattern) should be decided against a real second-module
explainer authoring pass, not speculatively now.

## What this spec is **not**

- **Not** a plan to author non-anemia walkthroughs (that is clinical-review-shaped work, not
  design-spec-shaped).
- **Not** a decision that the explorer must exist for every module (option (c) from
  `explored_alternatives` — retiring the explorer — is a legitimate outcome).
- **Not** a lift of the P5-01 degradation (the switcher's `#algorithm` tab hiding stands until this
  spec is executed).

## Promotion Trigger

A second module becomes `status: integrity-recorded` **and** needs an explainer surface — i.e. a
clinician-facing view beyond `#rules` and `#evidence` for that module. Registration alone is not
enough; the trigger requires an explicit product decision to build an explainer for that specific
module.

## Open Questions

(See frontmatter `open_questions`.)

## References

- `src/algorithmExplorer.js` — the anemia-shaped surface this spec generalizes (line anchors above
  are approximate; verify at execution time before editing).
- `docs/project_plans/PRDs/features/spa-module-switcher-v1.md` §7 R-8 — the non-goal that produced
  this deferral.
- `.claude/findings/spa-module-switcher-findings.md` Finding E-3 — the execution-time finding that
  measured the dispatch hardcode.
- `src/moduleEligibility.js` — the single-predicate eligibility design this spec must not fight.
- `docs/architecture.md` §2a — the module-inventory table naming the four modules whose different
  clinical shapes this spec's design must account for.
