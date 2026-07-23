---
schema_version: 2
doc_type: report
report_category: findings
title: "Findings — SPA Module Switcher execution (spa-module-switcher-v1)"
status: draft
created: 2026-07-22
updated: 2026-07-22
feature_slug: spa-module-switcher
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
promoted_to: null
source: execution
tags: [findings, spa-module-switcher]
---

# Findings — SPA Module Switcher execution

> Lazy-created at the first execution-time finding (2026-07-22, execution start). P7-DOC-007
> appends the two planning-time-known findings (R-5 sign-kb hardcode; SQ-3 F9 cbc evidence IDs)
> plus the stale-tripwire finding, and advances `status: draft → accepted`.

## Finding E-1 (execution-time, 2026-07-22) — `main` is red before this feature's first commit: 25 test failures + `npm run validate` exit 1, all in `modules/**` / rights substrate

**Observed at execution start** (worktree branched from `main` @ `cd20427`), before any change of
this feature landed:

- `npm test`: **25 of 2,587 fail** (pre-change baseline run; identical 25 re-observed after P1's
  additive changes at 25 of 2,605 — the 18 new vocabulary tests all pass). The failing set spans
  `modules/cbc_suite_v1` validation/byte-identity baselines, growth/kidney `validateModule()`
  checks, RF-CBC-001 evidence baselines, and the rights-substrate gates.
- `npm run validate`: **exit 1** — `cbc/growth/kidney_suite_v1/evidence.json` passages missing
  now-required properties (`judgment_basis_attestation`, `rights_component_class`,
  `structured_locator`, `not_captured`) and evidence_source_ids with no `rights/rights-ledger.json`
  entry (FR-WP2-06).
- Consequence: `npm run check` (which is `npm test && npm run validate && …`) **cannot exit 0 on
  `main` today**, independent of this feature.

**Attribution**: this is the known schema-tightening / non-conforming-fixtures land-order failure
class previously observed on `main` (CRW × E1 parallel-PR interleaving; the 25-failure signature
matches). It is **not caused by, and not fixable within, this feature**: FR-35 / P0-04 /
FEATURE-KAREN hard-require that this feature's diff contains **zero `modules/**` changes** and
signs nothing — the failing fixtures are exactly `modules/**` + `rights/**` content.

**Gate posture adopted for this execution run (recorded, not hidden)**: every phase gate that says
"`npm run check` green" is discharged as **delta-green** — (a) the `npm test` failing set is
byte-identical to the inherited 25 (zero new failures, all new tests pass), (b) `npm run validate`'s
failure output is byte-identical to the inherited output, and (c) every other sub-stage
(`coverage:rules`, `build`, `verify:d4`, `check:imports`, `smoke:browser`, `smoke`) exits 0. No
progress note may describe the full check as green.

**Required follow-up (separate work, not this branch)**: a dedicated fix bringing
`modules/{cbc,growth,kidney}_suite_v1/evidence.json` + `rights/rights-ledger.json` into conformance
with the tightened `schemas/evidence.schema.json` — a clinical-adjacent content change requiring its
own review under the repo's guardrails ("no AI-published rule changes"; evidence edits tie to
sources).
