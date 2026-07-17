---
schema_version: 2
doc_type: progress
title: "Progress: platform-foundation-p0 Phase 4 — Reference-Range Registry"
status: pending
created: 2026-07-17
feature_slug: platform-foundation-p0
phase: 4
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
---

# Phase 4: Reference-Range Registry

**Overview**: Add `src/ranges/registry.js` with generic range primitives (`registerAnalyteBands`, `registerThresholdRule`, `getBuiltInAnalyteValue`, `getThreshold`). Register anemia's `hb`/`mcv`/`rdw` bands and ferritin threshold rule. `modules/anemia/ranges.js` exports composition wrapper reproducing today's `getEffectiveRanges()` shape verbatim. `src/referenceRanges.js` becomes a shim. Update `modules/anemia/facts.anemia.js` range import (deferred edit from P2-T2) to use composition wrapper. May run parallel to P5 (disjoint file ownership after P3).

**Entry Criteria**: P3 `getModule`/engine generalization green.

**Exit Criteria**: `npm run check` green; golden outputs identical; `src/referenceRanges.js` is a shim; `tests/engine.test.mjs` zero diff; **karen milestone review passed**.

## Task Tracking

| Task ID | Name | Assigned Subagent | Model/Effort | Status | Notes |
|---------|------|-------------------|--------------|--------|-------|
| P4-T1 | `src/ranges/registry.js` — generic primitives | — | sonnet/adaptive | pending | Per SPIKE-001 RQ4: `registerAnalyteBands(moduleId, analyte, bands)`, `registerThresholdRule(moduleId, analyte, rule)`, `getBuiltInAnalyteValue(moduleId, analyte, ageMonths, sexAtBirth)`, `getThreshold(moduleId, analyte, context)`. Unregistered `(moduleId, analyte)` returns `null`, never throws. |
| P4-T2 | `modules/anemia/ranges.js` — registration + composition wrapper | — | sonnet/adaptive | pending | Register `hb`/`mcv`/`rdw` bands from `modules/anemia/reference-ranges.json` and ferritin threshold rule via `registerAnalyteBands`/`registerThresholdRule`. Export composition wrapper reproducing `getEffectiveRanges()` shape verbatim with `provenance` field via local-override-then-AAP-fallback `pick()` logic, including `provenance` shape. |
| P4-T3 | `src/referenceRanges.js` shim + facts.anemia.js rewire | — | sonnet/adaptive | pending | `src/referenceRanges.js` becomes shim re-exporting `getBuiltInRange`/`getEffectiveRanges`/`getFerritinThreshold`/`REFERENCE_RANGE_SOURCE`/`BUILT_IN_RANGES` bound to `'anemia'`. Per Sequencing Note 3: update `modules/anemia/facts.anemia.js` range import from `../../src/referenceRanges.js` to composition wrapper. Re-run golden equivalence after rewire. |

## Exit Gate Checklist

- [ ] `npm run check` green + golden outputs byte-identical
- [ ] `src/referenceRanges.js` is a shim; `tests/engine.test.mjs` zero diff
- [ ] `modules/anemia/facts.anemia.js` imports the ranges composition wrapper, not the old shim path
- [ ] **karen milestone review**: phase-boundary sanity check on the H5 anchor delta (per estimation-sanity.md) and on parallel-phase (P4∥P5) file-ownership discipline
- [ ] task-completion-validator sign-off

## Quick Reference

- **P4-T1**: general-purpose — "src/ranges/registry.js — generic primitives — see plan §Phase 4, P4-T1"
- **P4-T2**: general-purpose — "modules/anemia/ranges.js — registration + composition wrapper — see plan §Phase 4, P4-T2"
- **P4-T3**: general-purpose — "src/referenceRanges.js shim + facts.anemia.js rewire — see plan §Phase 4, P4-T3 + Sequencing Note 3"
