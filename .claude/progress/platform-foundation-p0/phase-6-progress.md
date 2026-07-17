---
schema_version: 2
doc_type: progress
title: "Progress: platform-foundation-p0 Phase 6 — Module Manifest Stub"
status: pending
created: 2026-07-17
feature_slug: platform-foundation-p0
phase: 6
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
---

# Phase 6: Module Manifest Stub

**Overview**: Create `modules/anemia/module.json` with unsigned manifest stub per SPIKE-001 shape (`id`, `title`, `schemaVersion`, `status: "unsigned-stub"`, `knowledgeBaseVersion`, `evidenceReviewedThrough`, `engineLabel`, `supportedAgeMonths`, `clinicalContentHash: null`, `approvedBy: []`, `validationRunId: null`, `supersedes: null`, `releasedAt: null`). Ensure byte-match with `src/evidence.js` consts and P3-T2's `index.js` manifest literal. Add drift check to `validate-kb.mjs`. Extend `tests/module-registry.test.mjs` with manifest-shape assertion (deferred from P5).

**Entry Criteria**: P5 complete (scheduled after P5 to isolate version-metadata churn; formal hard dependency is P1 only).

**Exit Criteria**: `npm run check` green; golden outputs identical; three-way version-const consistency (`evidence.js`, `index.js` manifest literal, `module.json`) verified.

## Task Tracking

| Task ID | Name | Assigned Subagent | Model/Effort | Status | Notes |
|---------|------|-------------------|--------------|--------|-------|
| P6-T1 | `modules/anemia/module.json` | — | sonnet/adaptive | pending | Per SPIKE-001 RQ1 shape. Per Sequencing Note 4: `knowledgeBaseVersion`/`evidenceReviewedThrough`/`engineLabel` must byte-match both `src/evidence.js` exported consts and P3-T2's `modules/anemia/index.js` manifest literal. `src/evidence.js` keeps consts unchanged (browser sync access requirement) — mitigation of evidence dual-source problem, not resolution. |
| P6-T2 | `validate-kb.mjs` drift check | — | sonnet/adaptive | pending | Add check asserting `module.json`'s `knowledgeBaseVersion`/`evidenceReviewedThrough` byte-match `src/evidence.js`'s exported `KNOWLEDGE_BASE_VERSION`/`REVIEWED_THROUGH` consts (SPIKE-001 OQ-3 / SPIKE-002 OQ-001). Non-zero exit on mismatch. |
| P6-T3 | Extend `tests/module-registry.test.mjs` with manifest-shape assertion | — | sonnet/adaptive | pending | Per SPIKE-002 Q5 assertion 2 + Sequencing Note 5: for every id in `MODULE_IDS`, `modules/<id>/module.json` exists, parses, and `manifest.id === id`. Field-presence checks only — no formal schema yet (DEF-5). Completes all 5 SPIKE-002 Q5 assertions. |

## Exit Gate Checklist

- [ ] `npm run check` green + golden outputs byte-identical
- [ ] `module.json`/`evidence.js`/`index.js` manifest three-way consistency verified by the new drift check
- [ ] `tests/module-registry.test.mjs` complete (all 5 SPIKE-002 Q5 assertions present)
- [ ] task-completion-validator sign-off

## Quick Reference

- **P6-T1**: general-purpose — "modules/anemia/module.json — see plan §Phase 6, P6-T1 + Sequencing Note 4"
- **P6-T2**: general-purpose — "validate-kb.mjs drift check — see plan §Phase 6, P6-T2"
- **P6-T3**: general-purpose — "Extend tests/module-registry.test.mjs with manifest-shape assertion — see plan §Phase 6, P6-T3 + Sequencing Note 5"
