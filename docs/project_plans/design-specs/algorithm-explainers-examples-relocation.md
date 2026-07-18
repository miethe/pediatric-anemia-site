---
doc_type: design_spec
title: "`data/algorithm-explainers.json` and `examples/` Relocation into `modules/anemia/`"
status: draft
maturity: shaping
created: 2026-07-18
feature_slug: platform-foundation-p0
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
---

# `data/algorithm-explainers.json` and `examples/` Relocation (DEF-7)

## Problem / Context

Platform Foundation P0 relocated the four KB-content files (`rules.json`, `candidates.json`,
`evidence.json`, `reference-ranges.json`) from top-level `data/` into `modules/anemia/` under the
new `modules/<id>/` package contract. Two other anemia-specific files were deliberately **left
behind**: `data/algorithm-explainers.json` (UI-facing algorithm-explainer content consumed by
`src/algorithmExplorer.js`) and the top-level `examples/` directory (sample patient-input JSON
files used by the SPA's example picker and by `tests/module-equivalence.test.mjs`'s golden-fixture
harness).

The Deferred Items Triage Table categorizes this as **scope-cut**: these files are not KB content
(they are UI/example content), so moving them was not required by P0's KB-relocation mandate — and
moving them prematurely risks colliding with a **per-module UI-content convention that does not yet
exist**. With only one module registered, there's no second data point to design that convention
against; guessing now risks picking a shape (e.g. `modules/anemia/explainers.json` vs. `modules/
anemia/ui/explainers.json` vs. keeping `examples/` split by module vs. flat) that a second module
immediately breaks or has to work around.

## Current State (what P0 actually shipped)

Both files remain exactly where they were before the refactor:

- `data/algorithm-explainers.json` — still at `data/`, still the sole file left in that directory
  after the four KB files moved out. Consumed by `src/algorithmExplorer.js`.
- `examples/*.json` (six files: `anemia-inflammation.json`, `beta-thalassemia-trait.json`,
  `hemolysis-hs.json`, `ida-toddler.json`, `lead-capillary.json`, and one more) — still at the
  top-level `examples/` directory, unmoved. These are the same six files `scripts/capture-golden.
  mjs` reads to produce `tests/golden/*.json`, and the same six the SPA's example picker (`src/
  app.js` fetch calls) loads at runtime.
- `modules/anemia/README.md` documents this explicitly: *"`data/algorithm-explainers.json` and the
  top-level `examples/` directory are **not** module KB content and intentionally remain outside
  this package for now (deferred item DEF-7 in the implementation plan above)."*
- `scripts/check-app-imports.mjs` (DEF-8's smoke check) resolves `src/app.js`'s `fetch()` calls to
  these files at their current top-level paths under both the dev and `dist/` layouts — any future
  relocation must update those fetch specifiers and this script's assumptions in lockstep.

## Design Sketch

At a shaping level, the relocation direction (once undertaken) most likely mirrors the existing
`modules/<id>/` package contract:

- `data/algorithm-explainers.json` → `modules/anemia/algorithm-explainers.json` (or a `ui/`
  subdirectory if UI content ends up needing more than one file per module, e.g. `modules/anemia/
  ui/algorithm-explainers.json`) — a pure path relocation, content-identical, following the same
  "relocate, never edit content" discipline P0 applied to the four KB files.
- `examples/*.json` → `modules/anemia/examples/*.json` — also a pure relocation, but with a wider
  blast radius than the explainers file: it touches `scripts/capture-golden.mjs`, `tests/module-
  equivalence.test.mjs`, `src/app.js`'s example-picker fetch calls, and `scripts/check-app-imports.
  mjs`'s DYNAMIC_IMPORT_TARGETS/APP_SURFACE_FILES resolution — all of which currently assume the
  top-level `examples/` path.
- The actual per-module UI-content convention this relocation should follow is the open design
  question — it should be decided when the second module (CBC/cytopenia suite) is scaffolded, so
  the convention is validated against two real modules rather than guessed from one.

This spec does not commit to a final path shape; it records that the natural direction is "mirror
the KB relocation pattern," pending the second module's actual needs.

## Promotion Trigger

Phase 2 (CBC suite), when a second module's UI content would otherwise collide with `data/
algorithm-explainers.json` and top-level `examples/` both being anemia-specific singular files/
directories with no module-scoping (per the Deferred Items Triage Table).

## Open Questions

- Does `examples/` become per-module (`modules/anemia/examples/`, `modules/cbc/examples/`) or stay
  a single flat directory with module-scoped filenames/subfolders — the golden-fixture harness's
  file-discovery logic (`scripts/capture-golden.mjs`) would need to change either way?
- Does `data/algorithm-explainers.json`'s relocation need its own UI-content schema convention, or
  does it just move path-for-path the way KB files did?
- What happens to the `data/` directory once both remaining files move — is it deleted entirely, or
  does it stay as a landing zone for genuinely cross-module (non-KB) content?
- Does this relocation need its own golden-fixture-equivalence-style proof (content byte-identity
  check) the way the P1 KB relocation did, or is a simpler "these are UI files, a visual/manual
  smoke check suffices" standard acceptable?
- How does this interact with DEF-8 (headless-browser runtime smoke check) — should the relocation
  and the browser-smoke-check spec be sequenced together, since both touch `src/app.js`'s fetch
  specifiers and `scripts/check-app-imports.mjs`'s resolution logic?
