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

## Finding E-2 (execution-time, 2026-07-22) — E1's diff-scope guard fails on any later branch that adds `src/` files (branch-local +1 over the inherited 25)

`tests/ef-release-registry-validate-wiring.test.mjs:234` ("diff-scope: src/, server.mjs,
openapi.yaml, and modules/anemia/module.json are byte-untouched relative to main across all of
evidence-foundry-e1") runs `git diff --name-only main...HEAD` and asserts the result is empty. That
guard was written to police the evidence-foundry-e1 branch but is **not scoped to it** — it fails on
any subsequent feature branch that legitimately commits `src/` work. On this branch it began failing
at the Phase 1 commit (`1a4c8b9`, which added `src/moduleManifests.js` +
`src/moduleStatusVocabulary.js`) and will keep matching more files as P2–P5 land. **Attribution
correction** (P2-GATE validator, superseding the phase-2 progress note's "inherited drift" label):
this is *branch-self-inflicted, by design of the guard* — not present in the inherited 25 at
`cd20427`, not caused by any defect in this feature's code.

**Disposition**: leave the guard untouched on this branch. It is main-scope-relative, so it
**self-resolves on squash-merge** (`main...HEAD` is empty on main itself); post-merge `main` returns
to exactly the inherited 25. The gate posture for this branch is therefore: inherited 25 + this one
known, mechanically-explained guard failure, and nothing else. Follow-up for the separate main-red
fix: rescope the guard to the E1 commit range (or retire it) so later feature branches stop
inheriting a false negative.
