---
doc_type: design_spec
title: "Formal `schemas/module-manifest.schema.json`"
status: draft
maturity: idea
created: 2026-07-18
feature_slug: platform-foundation-p0
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
---

# Formal `schemas/module-manifest.schema.json` (DEF-5)

## Problem / Context

Every other structured data shape in this codebase has a companion JSON Schema in `schemas/`:
`rule.schema.json`, `candidate.schema.json`, `patient-input.schema.json`, `assessment-output.
schema.json`. The new per-module manifest file, `modules/<id>/module.json` (introduced in P0/P6,
see DEF-4), does not — its shape is enforced only by ad hoc field-presence checks inside `scripts/
validate-kb.mjs`, not by a schema the way `rule.schema.json` governs rules.

The Deferred Items Triage Table categorizes this as **scope-cut**, citing SPIKE-002 OQ-003: P0's
module-load test was scoped to use field-presence checks only, and authoring a formal schema was
explicitly not part of P0's deliverables. With exactly one registered module (`anemia`) and the
manifest's own signing fields still stubbed out (DEF-4), a formal schema now would be validating a
shape that is itself expected to gain new required fields (hash, approvals, validation run id) once
DEF-4 lands — authoring it before DEF-4 settles risks a near-immediate schema rewrite.

## Current State (what P0 actually shipped)

`modules/anemia/module.json` exists with a concrete field set (see DEF-4 spec for the full JSON),
but validation of it is entirely hand-written and narrow. In `scripts/validate-kb.mjs`:

```js
const manifest = await readJson(path.join(moduleDir, 'module.json'));
if (manifest.id !== moduleId) {
  errors.push(`${moduleId}/module.json: id "${manifest.id}" does not match directory name "${moduleId}"`);
}
if (manifest.knowledgeBaseVersion !== KNOWLEDGE_BASE_VERSION) {
  errors.push(/* ... */);
}
if (manifest.evidenceReviewedThrough !== REVIEWED_THROUGH) {
  errors.push(/* ... */);
}
```

This checks exactly three things: `id` matches the directory name, and two version-marker fields
byte-match `src/evidence.js`'s exports (the DEF-1 drift check). It does **not** check: that
`schemaVersion`, `status`, `title`, `engineLabel`, `supportedAgeMonths`, `clinicalContentHash`,
`approvedBy`, `validationRunId`, `supersedes`, or `releasedAt` are present, correctly typed, or
well-formed (e.g. `supportedAgeMonths.min < supportedAgeMonths.max`, `status` is one of an allowed
enum). A malformed or incomplete `module.json` — beyond the three checked fields — would pass
`npm run validate` silently today. This is the "field-presence checks only" state SPIKE-002 OQ-003
anticipated and the plan deliberately accepted for P0.

## Design Sketch

At an idea-stage level, a future `schemas/module-manifest.schema.json` would formalize:

- Required fields and types matching the current `module.json` shape (`id: string`, `title:
  string`, `schemaVersion: integer`, `status: enum[...]`, `knowledgeBaseVersion: string`,
  `evidenceReviewedThrough: string (date)`, `engineLabel: string`, `supportedAgeMonths: {min:
  integer, max: integer}`).
- The DEF-4 signing fields once their real shape is settled (`clinicalContentHash`, `approvedBy`,
  `validationRunId`, `supersedes`, `releasedAt`) — plausibly with conditional requirements (e.g.
  `clinicalContentHash` required when `status !== "unsigned-stub"`).
- `scripts/validate-kb.mjs` would swap its hand-written field checks for a schema-validator call
  (the codebase does not currently depend on a JSON Schema validation library at runtime for KB
  files — confirm whether one needs to be added, or whether the existing rule/candidate schemas
  are validated by a different mechanism worth reusing).

This spec intentionally does not commit to the schema's exact field list, because DEF-4's signing
fields are not yet settled — writing the schema now would need a near-term rewrite once DEF-4
lands.

## Promotion Trigger

Phase 1, or sooner if a P0-WP6 executor judges field-presence checks insufficient (per the Deferred
Items Triage Table) — i.e., this can be pulled forward opportunistically if the ad hoc checks in
`scripts/validate-kb.mjs` prove to let a real malformed manifest through in practice, without
waiting for the full Phase 1 kickoff.

## Open Questions

- Should this schema be authored before or after DEF-4 (signed manifest) settles its field shapes —
  authoring it first risks rework; waiting risks a second module being onboarded with an
  unvalidated manifest in the interim.
- Does `scripts/validate-kb.mjs` need a JSON Schema validation library dependency added, or is
  there a lighter-weight approach (continue hand-written checks, but generated from the schema as
  documentation only)?
- Should `status` be a closed enum (`unsigned-stub | signed | superseded | revoked`) decided now, or
  left open until DEF-4's signing lifecycle is designed?
- Does this schema live under `schemas/module-manifest.schema.json` as named in the triage table,
  or should it be namespaced per the eventual multi-module layout (e.g. if manifest shape ever
  diverges per module type)?
