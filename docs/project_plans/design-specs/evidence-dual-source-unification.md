---
doc_type: design_spec
title: "Evidence Dual-Source Unification"
status: draft
maturity: idea
created: 2026-07-18
feature_slug: platform-foundation-p0
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
---

# Evidence Dual-Source Unification (DEF-1)

## Problem / Context

The pediatric-anemia knowledge base carries evidence metadata in **two independent places**:

- `src/evidence.js` — a hand-authored JS module exporting `EVIDENCE`, `KNOWLEDGE_BASE_VERSION`,
  and `REVIEWED_THROUGH` as frozen JS objects/consts, imported synchronously by the browser SPA
  (`src/app.js`) for citation rendering.
- `modules/anemia/evidence.json` — the module-package JSON file (`{ knowledgeBaseVersion,
  reviewedThrough, sources: [...] }`) consumed by `server.mjs`, `scripts/validate-kb.mjs`, and
  `scripts/build-static.mjs`.

These two sources are content-identical today by hand-maintained discipline, not by construction.
The Deferred Items Triage Table (plan §"Deferred Items Triage Table", DEF-1) explicitly deferred
unifying them: real unification needs a signed/loaded-manifest mechanism that does not exist yet
in this codebase. Building that mechanism was out of scope for a **zero-clinical-behavior-change**
structural refactor (Platform Foundation P0) — P0's mandate was to relocate and register code
paths, not to redesign how evidence is authored or loaded.

## Current State (what P0 shipped)

P0 does not unify the two sources. It ships a **drift check**, not a fix:

- `modules/anemia/module.json` is an explicit **unsigned stub** (`status: "unsigned-stub"`,
  `clinicalContentHash: null`, `approvedBy: []`, `validationRunId: null`) — see DEF-4. It carries
  `knowledgeBaseVersion` and `evidenceReviewedThrough` fields that must match `src/evidence.js`'s
  exported consts.
- `scripts/validate-kb.mjs` (P6-T2) reads `modules/anemia/evidence.json` directly (not through
  `src/evidence.js`) and separately imports `KNOWLEDGE_BASE_VERSION`/`REVIEWED_THROUGH` from
  `src/evidence.js`, then asserts `manifest.knowledgeBaseVersion === KNOWLEDGE_BASE_VERSION` and
  `manifest.evidenceReviewedThrough === REVIEWED_THROUGH`. A mismatch fails `npm run validate`
  (and therefore `npm run check`), catching version-string drift between the two sources at CI
  time — but the two `sources`/`EVIDENCE` record arrays themselves are never diffed record-by-
  record; only the two version-marker fields are checked.
- The browser SPA still reads `src/evidence.js` synchronously; the server/build/validate paths
  still read `modules/anemia/evidence.json`. Both files must still be hand-edited in lockstep for
  any evidence change.

This is a mitigation, not a resolution — it narrows the blast radius of drift (a wrong version
string fails the build) without removing the duplication.

## Design Sketch

Two candidate directions, both gated on a signed/loaded-manifest mechanism that does not exist
today:

1. **Single JSON source of truth, JS becomes a loader.** Delete the hand-authored `EVIDENCE`
   object from `src/evidence.js`; replace it with code that loads `modules/anemia/evidence.json`
   (via the same `with { type: 'json' }` import-attribute pattern `modules/anemia/ranges.js`
   already uses per DEF-8) and reshapes the `sources` array into the `EVIDENCE`-keyed-by-id object
   shape the SPA currently expects. Requires confirming the JSON-module import path is viable on
   the browser surface (ties to DEF-8's browser-runtime verification) before this becomes safe.
2. **Signed manifest as the sole authority, both consumers load from it.** Once the Phase 1
   signed-manifest work (promotion trigger below) exists, `modules/anemia/module.json` stops being
   a stub and becomes the actual signed record; evidence content is embedded or referenced from
   there, and both the SPA and server/build/validate paths load through one manifest-aware
   accessor. This is the more architecturally complete direction but has a larger blast radius —
   it is not just an evidence fix but the manifest-signing feature itself.

Either direction needs a SPIKE to decide the load path (build-time inlining vs. runtime
`fetch`/import) and to confirm no clinical-content edit sneaks into the migration — this spec
records the problem and options; it does not commit to one design.

## Promotion Trigger

Phase 1 signed-manifest work (per the Deferred Items Triage Table). Do not attempt unification
before the signing/loading mechanism exists — attempting it earlier would either re-introduce a
second stub manifest shape or bypass the eventual signature/approval gate.

## Open Questions

- Does the unified source live in JSON (loaded by both JS and server) or does `src/evidence.js`
  become generated/derived at build time from `modules/anemia/evidence.json`?
- Does unification need to be per-module (each module owns one evidence source) or is there a
  cross-module evidence registry once a second module exists?
- How does the `with { type: 'json' }` browser-compatibility constraint from DEF-8 interact with
  loading evidence JSON directly in `src/app.js`, which is not yet proven on real browsers?
- What is the record-level diff/equality check once both consumers read one source — is a runtime
  check still needed, or does single-sourcing make drift structurally impossible?
- Does this spec's SPIKE run standalone, or fold into the Phase 1 signed-manifest SPIKE that DEF-4
  also depends on?
