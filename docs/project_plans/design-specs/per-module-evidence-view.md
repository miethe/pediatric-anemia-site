---
schema_version: 2
doc_type: design_spec
title: "Per-module `#evidence` view — growth/kidney evidence loaders (DF-SMS-02)"
status: draft
maturity: shaping
created: 2026-07-23
updated: 2026-07-23
feature_slug: spa-module-switcher
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
related_documents:
  - .claude/findings/spa-module-switcher-findings.md
  - docs/architecture.md
open_questions:
  - "Does the evidence-registry entry per module need to be schema-validated the same way `modules/<id>/evidence.json` is validated against `schemas/evidence.schema.json`, or is registration a pure runtime dispatch concern?"
  - "How does the loader handle a module whose `evidence.json` records cite identifiers not resolvable inside the module — the pre-existing DF-SMS-05 hazard for `cbc_suite_v1` (7 rule evidence IDs resolving to nothing against `src/evidence.js:9,22`) — does the loader refuse to register, or does registration succeed and the runtime refuse per-citation, or does a separate resolution audit gate registration?"
  - "Does the `#evidence` tab need per-module UI variation (a growth module's evidence view may want reference-interval sources grouped differently from anemia's classification sources), or is the current anemia UI shape sufficient across modules?"
  - "What is the rule-registry ↔ evidence-registry coherence check — today `src/evidence/registry.js:39-50` has anemia + `cbc_suite_v1` (per verification against the file's current state at execution time); growth/kidney have `evidence.json` files but no loader registered; a coherence gate must verify that every module in `MODULE_IDS` with a non-empty `evidence.json` has a registered loader before a UI surface exposes an evidence view."
explored_alternatives:
  - "Register loaders per-module in `src/evidence/registry.js:39-50` — extend the existing dispatch table with entries for `growth_suite_v1` and `kidney_suite_v1`, each loading its own `modules/<id>/evidence.json`. Follows the shape `src/facts/registry.js` and `src/ranges/registry.js` already use for their per-module dispatch; keeps the runtime shape identical to today."
  - "Auto-register every module with an `evidence.json` file — walk `MODULE_IDS` at startup and register any module whose `modules/<id>/evidence.json` exists. Removes the manual registration step but hides the coherence-check surface; a module could ship with a partial/incorrect evidence file and be silently registered."
  - "Add an evidence-loader hook to the module package interface (`modules/<id>/index.js`) — each module exports its own `loadEvidence()` function, `src/evidence/registry.js` becomes a thin dispatcher. Cleanest separation but is a wider refactor than DF-SMS-02 strictly needs."
---

# Per-module `#evidence` view — growth/kidney evidence loaders (DF-SMS-02)

## Problem / Context

The SPA's `#evidence` tab renders per-module evidence records via `src/evidence/registry.js:39-50`
(a per-module loader dispatch table). Today only two of the four registered modules have a
registered loader: `anemia` and `cbc_suite_v1` (verify current state via the file at execution
time). The other two — `growth_suite_v1` and `kidney_suite_v1` — ship an `evidence.json` but no
loader entry.

Each module's `evidence.json` file today (source counts as of `multi-bundle-conversion-e1` Phase 7):

- `modules/cbc_suite_v1/evidence.json` — **20 sources** (drafted by the converter's `propose` verb
  against `RF-CBC-002`; see `docs/architecture.md` §2b).
- `modules/growth_suite_v1/evidence.json` — **11 sources** (bespoke evidence projection against
  `RF-GRO-002`; the generator is uncommitted per `docs/architecture.md` §2a's inventory table).
- `modules/kidney_suite_v1/evidence.json` — **12 sources** (bespoke evidence projection against
  `RF-KID-001`; the generator is uncommitted).

`spa-module-switcher-v1` P5-02 degrades the `#evidence` tab: for any module without a registered
loader, the tab renders an explicit "no evidence view for this module" empty state rather than an
empty source list. This is the correct degradation — it does not silently show anemia's evidence
under another module — but it hides the loader-registration gap from a clinician rather than closing
it. That gap is what this spec addresses.

## Design Sketch

Once a second module reaches `status: integrity-recorded` (see promotion trigger), the fix is:

1. **Register growth and kidney loaders in `src/evidence/registry.js:39-50`.** Add per-module
   entries following the shape the anemia and cbc_suite_v1 entries already use — each loader reads
   `modules/<id>/evidence.json` and returns the source list in the same shape the anemia loader
   already returns. No new schema is required; `schemas/evidence.schema.json` already governs the
   file shape and is already applied by `npm run validate` per-module.
2. **Add a coherence-check gate.** `scripts/validate-kb.mjs` (or a new sibling script) walks every
   module in `MODULE_IDS`, and for each module whose `evidence.json` is non-empty, asserts that
   `src/evidence/registry.js` has a registered loader for it. This closes the "silent
   loader-registration gap" surface: adding a new module without registering its loader would fail
   `npm run validate` rather than shipping an unsurfaceable evidence file.
3. **Address the rule-citation resolution surface separately.** DF-SMS-05 records that
   `cbc_suite_v1`'s 7 rule evidence IDs currently resolve to nothing against the anemia-only
   `src/evidence.js:9,22`. Registering the loader alone does not fix that — a CBC rule citing a
   CALIPER/HEMATOLREP identifier would still surface a nothing-resolves gap the moment the module
   became selectable. This spec's coherence-check gate should either subsume that resolution audit
   (fail on any unresolvable rule evidence identifier) or explicitly delegate to the DF-SMS-05
   finding as a separate blocker.

Do not build a per-module `#evidence` UI variation speculatively — the current anemia-shaped UI is
likely to be adequate for CBC/growth/kidney evidence records, and any variation should be decided
against a real second-module evidence surface rather than a hypothetical one.

## Prerequisite relationship

This spec is a **prerequisite** for surfacing evidence content under any module other than `anemia`
in the SPA. `spa-module-switcher-v1` P5-02 keeps the tab honest under that gap; relaxing the empty
state before this spec is executed would either surface a missing loader as a silent failure or
require ad-hoc per-module conditionals in `src/app.js` that the switcher's design explicitly
avoids.

## Promotion Trigger

A second module reaches `status: integrity-recorded`, **or** the evidence registry gains growth/
kidney loaders as prerequisite work for a different feature (e.g. a CBC integrity-hash preparation
pass, or a growth-module signing pass).

## Open Questions

(See frontmatter `open_questions`.)

## References

- `src/evidence/registry.js:39-50` — the per-module dispatch table this spec extends.
- `schemas/evidence.schema.json` — the schema every module's `evidence.json` is validated against
  by `npm run validate`.
- `modules/cbc_suite_v1/evidence.json`, `modules/growth_suite_v1/evidence.json`,
  `modules/kidney_suite_v1/evidence.json` — the three non-anemia evidence files (source counts 20,
  11, 12 respectively).
- `docs/project_plans/PRDs/features/spa-module-switcher-v1.md` §6 FR-26 — the module-scoped
  degradation contract this spec relaxes on execution.
- `.claude/findings/spa-module-switcher-findings.md` Finding P-2 — the DF-SMS-05 evidence-ID
  resolution gap for `cbc_suite_v1`; separate deferral, related surface.
