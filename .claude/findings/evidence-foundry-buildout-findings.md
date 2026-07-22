---
schema_version: 2
doc_type: report
report_category: finding
title: "Findings: Evidence Foundry Buildout"
status: accepted
source: agent
created: '2026-07-21'
updated: '2026-07-21'
feature_slug: "evidence-foundry-buildout"
promoted_to: /docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
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

## Phase 3 Findings (P3-T5)

### Plan / Reality Mismatches

- **Carrying forward P3-T1's own flagged discrepancy**: FR-16(c)/this plan's task tables name the
  third slice rule the "iron-deficiency-anemia candidate pattern," but the RF-CBC-001 fixture (this
  plan's binding OQ-2 evidentiary source) is scoped entirely to neutropenia/marrow-failure-risk
  evidence and contains zero ferritin/iron claims. P3-T1 already authored
  `dec_cbc_benign_neutropenia_differential_pattern_001` under its true evidentiary identity rather
  than mislabel neutropenia evidence as iron-deficiency evidence, and explicitly flagged this "for
  explicit resolution before Phase 3 (P3-T5) drafts a candidates.json entry." P3-T5 carries that
  resolution forward: `tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs` drafts the
  candidate as `benign-ethnic-neutropenia-differential-pattern` (label contains "pattern," not a
  diagnostic claim), joined to that same decision, not to an invented iron-deficiency identity. No
  design-spec is warranted — this is drafting-time honesty about which evidence a fixture actually
  contains, not a scope or architecture gap.

- **`schemas/rule.schema.json` field count has drifted from `02 §4.13`'s field-mapping table.**
  That table's premise ("the current `schemas/rule.schema.json` permits exactly `id`/`category`/
  `when`/`evidence`/`output`") is stale against the actual current-tree schema: post EP-3/EP-4
  governance hardening, the schema now REQUIRES 9 additional fields directly on the rule record
  (`version`, `effectiveDate`, `retireDate`, `owner`, `safetyClass`, `requiredTestCaseIds`,
  `changeRationale`, `sourcePassageId`, and a `clinicalApprovers`-named, always-empty
  credentialed-approver list), `additionalProperties: false`. P3-T6 ("strict runtime projection...
  matching `schemas/rule.schema.json` exactly") will need to reconcile this — either the strict
  projection must also emit those 9 fields (with values this task's rule-proposals.json already
  carries, except the approver-list field itself — see next item), or the schema needs a
  deliberate, reviewed relaxation for `cbc_suite_v1`. Not resolved here (out of P3-T5's scope);
  flagged for P3-T6's own execution.

- **Invariant 15** (`tests/ef-converter-invariants.test.mjs`, from the completed Phase 2 seam
  task) asserts no file under `tools/rf-bundle-to-kb-pack/` ever even names a clinical-approval
  field, in any form — not just that it never sets a non-empty value. P3-T5's first draft of
  `rule-candidate-drafts.mjs` carried a `clinicalApprovers: []` field (mirroring `02 §4.13`'s
  field-mapping table literally) and tripped this invariant; fixed by dropping that field from the
  converter's drafting tree entirely (the `changeRationale` prose states the same fact — "no
  credentialed clinician has approved this proposal" — without naming the schema's literal field).
  P3-T6/Phase 4 must add the real `clinicalApprovers: []` key only on the committed, strict rule
  record (`modules/cbc_suite_v1/rules.json`, matching `modules/anemia/rules.json`'s existing
  pattern) or the `rule-provenance.json` sidecar — never inside this converter's own source tree.

### Fact-Model Gap (relevant to Phase 4 migration, P4-T1..T4)

- OQ-1 states "all 4 slice rules consume exactly the fact shape `anemia` already derives
  (hemoglobin, ferritin, morphology, marrow-flag facts)." In practice, `modules/anemia/
  facts.anemia.js` (delegated to by `cbc_suite_v1/index.js`) does derive real, usable ANC/
  neutropenia facts (`cbc.anc`, `cbc.neutropenia` tri-state, `scope.neonatalOrYoungInfant`), so
  rules (a) and (d) map cleanly. But rules (b) and (c) reuse facts scoped to a DIFFERENT purpose
  than the evidence actually supports: rule (b)'s "local range or abstain" proposal reuses
  `scope.needsLocalRanges` (a hemoglobin/MCV/RDW-only fact, per `modules/anemia/ranges.js`) as the
  nearest available proxy for an ANC/analyzer-specific local-range-availability concept that does
  not yet exist; rule (c)'s benign-differential candidate cannot yet express the evidence's
  infection-history-absence or ancestry/Duffy-context discriminators as discrete facts. Each
  proposal's `authoringNotes` field in `tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs`
  names its specific gap. CBC-suite-specific fact derivation is already named an E1 build item
  (OQ-1, `02 §7.3` item 7) — this is not a new scope item, just a concrete pointer to which facts
  are missing, for whichever Phase 4 executor migrates these rules to confirm the proxy is
  acceptable for the E0 vertical slice or add the narrower fact before committing.

### Resolution Status (Phase 3)

All three items above are resolved or explicitly deferred to a named downstream task (P3-T6,
Phase 4) within this same plan — no new design-spec row is warranted.
