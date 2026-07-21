---
schema_version: 2
doc_type: report
report_category: finding
title: "Findings: Evidence Foundry Buildout"
status: draft
source: agent
created: '2026-07-21'
updated: '2026-07-21'
feature_slug: "evidence-foundry-buildout"
promoted_to: null
related_plan: /docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
---

# Findings: Evidence Foundry Buildout

## Phase 1 Findings

### Discoveries

- **A single, systemic root cause surfaced across three separate files** while landing P1-T3
  (`modules/cbc_suite_v1/` package scaffold + registry wiring, OQ-1): `schemas/evidence.schema.json`,
  `server.mjs`, `scripts/build-static.mjs`, and `scripts/verify-d4-built.mjs` were all written when
  `anemia` was the *only* registered module — each one implicitly assumed "every registered module"
  and "the module actually served/shipped" were the same set. Registering a second, deliberately
  empty/unsigned `cbc_suite_v1` scaffold (exactly what OQ-1 calls for) broke that assumption in four
  independent places on first contact. This is worth naming as one root cause, not four unrelated
  bugs, in case a later phase (e.g. a third module) needs the same fix shape again.

### Plan / Reality Mismatches

- **`schemas/evidence.schema.json`'s `sources` array carried `minItems: 1`** (title: "Pediatric
  Anemia Evidence Document" — literally anemia-specific despite being applied module-agnostically
  by `scripts/validate-kb.mjs`'s per-module loop). The parent plan's P1-T3 row and the Phase 1
  progress worknote both describe `modules/cbc_suite_v1/evidence.json` as `{sources: []}`,
  "empty-but-valid" — that was not actually schema-valid against the current-tree schema. Fixed by
  relaxing `minItems` to `0` (widens what's legal; narrows nothing — every existing populated
  module already has ≥1 source) and generalizing the schema's title/description to be
  module-agnostic. No test asserted the old `minItems: 1` constraint (checked before changing it).

- **`server.mjs`'s startup loop and `scripts/build-static.mjs`'s pre-build gate were both fatal on
  ANY registered module's manifest-verification failure**, not just the module actually served
  (`DEFAULT_MODULE_ID`). `cbc_suite_v1`'s `module.json` is intentionally `status: "unsigned-stub"`
  with null hashes (P1-T2, correct per spec) — importing `server.mjs` (as
  `tests/server-manifest-failclosed.test.mjs` does) or running `npm run build` both crashed the
  moment `cbc_suite_v1` was registered in `src/modules/registry.js`. Fixed in both files: only
  `DEFAULT_MODULE_ID`'s manifest-verification failure is fatal; every other registered module's KB
  data and manifest verdict are still loaded and disclosed (loudly, via `console.warn`/`console.log`
  and the `/api/v1/knowledge-base` / `dist/build-info.json` per-module breakdown), never silently
  dropped and never fatal. This mirrors `scripts/smoke-test.mjs`'s own pre-existing comment ("proving
  the plumbing generalizes correctly if a second module were registered") — that smoke test's
  assertion (every `MODULE_IDS` entry must have a `modules[id]` summary entry) is what proved an
  earlier, narrower fix (excluding non-servable modules from the summary) was wrong; the final fix
  discloses every registered module unconditionally instead.

- **`scripts/verify-d4-built.mjs`'s non-vacuity guard treated ANY module with zero built rules as a
  gate failure** ("this gate would be vacuous"), written when a second, genuinely-still-empty module
  didn't exist yet. Fixed: an empty `rules.json` is now tolerated (logged, not an error) for any
  module OTHER than `DEFAULT_MODULE_ID`, plus a new overall `checkedRules === 0` guard across ALL
  modules so the gate can never become silently vacuous in aggregate.

- **R-P4's plan-compliance analysis** (parent plan, "Plan Generator Rule Compliance") states
  "`server.mjs`... [is] not touched by any task in this plan" and that the feature "makes zero
  changes to... any API response shape a client consumes." That statement is not accurate given the
  current tree's actual `server.mjs`/`scripts/build-static.mjs` code (see above) — P1-T3's own
  binding AC (`MODULE_IDS` includes both ids; `getModule('cbc_suite_v1')` resolves) is incompatible
  with leaving those files untouched. The `/api/v1/knowledge-base` response now additionally
  discloses a `cbc_suite_v1` entry (rule/candidate/evidence counts, all zero, plus its real
  `unsigned-stub` manifest status) — an additive, honest disclosure, not a change to any existing
  field's shape or the served `anemia` module's behavior.

### Bugs / Gotchas

- `server.mjs` and `scripts/build-static.mjs` both import `MODULE_IDS`/`DEFAULT_MODULE_ID` from
  `src/modules/registry.js` at module top level and run their manifest-verification loops as
  top-level side effects (not inside `if (isMain)`), so merely *importing* `server.mjs` (as a test
  file does) executes the full startup gate. Any future registered module must keep passing this
  gate for `DEFAULT_MODULE_ID` specifically, or every test that imports `server.mjs` breaks.

### Schema / Data Gaps

- None beyond the `evidence.schema.json` `minItems` relaxation recorded above.

## Resolution Status

All four items above are already fixed in the same commit/diff that registered `cbc_suite_v1`
(P1-T3) — none is deferred. No design-spec is warranted (Step 3 of the in-flight-findings
lifecycle): each is a scoped bug fix restoring a previously-true, previously-untested assumption
("only one module exists"), not new design work.
