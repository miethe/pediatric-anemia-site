---
schema_version: 2
doc_type: report
report_category: findings
title: "Findings — SPA Module Switcher execution (spa-module-switcher-v1)"
status: accepted
created: 2026-07-22
updated: 2026-07-23
feature_slug: spa-module-switcher
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
promoted_to: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
source: execution
tags: [findings, spa-module-switcher]
---

# Findings — SPA Module Switcher execution

> Lazy-created at the first execution-time finding (2026-07-22, execution start). P7-DOC-007
> appended the three planning-time-known findings (R-5 sign-kb hardcode; SQ-3 F9 cbc evidence IDs;
> the stale-tripwire comment overdue since commit `263120b`, actioned at P6-010) on 2026-07-23 and
> advanced `status: draft → accepted`. Execution-time findings E-1/E-2/E-3 are retained intact.

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

## Finding E-3 (execution-time, 2026-07-22) — algorithm explorer's hardcoded anemia dispatch persists by design (R-8); reviewed, bounded, deferred to DF-SMS-03

The gpt-5.6-terra adversarial review of the P4 slice confirmed `src/algorithmExplorer.js:621` (and
the "Use in assessment" path) hardcode `assessPediatricAnemia` — if `DEFAULT_MODULE_ID` ever became
a ready non-anemia module, explorer execution would still evaluate anemia under the other module's
label. This is the known R-8 boundary (the explorer is anemia-shaped end to end and this feature
must degrade, not generalize it): P4 gates explorer *initialization* on the selectable anemia module
being active, and P5-01 degrades the `#algorithm` tab for non-anemia modules. The generalization
itself — including this dispatch — is deferred item **DF-SMS-03**
(`docs/project_plans/design-specs/algorithm-explorer-module-generalization.md`, authored at
P7-DOC-006). Recorded so the DF-SMS-03 spec cites a measured, reviewer-confirmed anchor rather than
re-deriving it. The related latent TOCTOU findings from the same review (stale KB-load resolution;
loadExample's await between guard and assess) were **fixed in-phase** with a load-generation guard,
not deferred.

## Finding P-1 (planning-known, appended 2026-07-23 at P7-DOC-007) — R-5 / DF-SMS-01 — `scripts/sign-kb.mjs` anemia hardcode makes every module's `clinicalContentHash` a false attestation if surfaced

**Observed pre-feature; recorded here per the parent plan's "In-Flight Findings" policy.**
`scripts/sign-kb.mjs:58-73` hardcodes anemia's KB file list — `modules/anemia/rules.json`,
`modules/anemia/candidates.json`, `modules/anemia/evidence.json`,
`modules/anemia/reference-ranges.json`, plus `src/ranges.js` and `src/facts.anemia.js` as raw-byte
sources. `scripts/build-static.mjs:54-55` invokes it per-module with no module id, so every module's
`clinicalContentHash` is computed over **anemia's** files rather than the invoking module's own KB.
The defect is currently masked because the three non-anemia modules ship
`clinicalContentHash: null` and `src/kbVerify.js:240` short-circuits on `null`; anemia's own hash
happens to be over anemia's files and so is not itself misattributed.

**Attribution**: pre-existing, out of scope for `spa-module-switcher-v1` (PRD §7 non-goal). Kept
off-screen entirely by FR-31's renderer allow-list (P6-008): the row/banner renderer may not read
`clinicalContentHash`, `hashes`, `governanceHash`, or any hash-shaped manifest field, and cannot
emit them into any `data-*` attribute, `innerHTML`, or `textContent`. A future integrity-hash UI
must fix this defect before FR-31's prohibition can be relaxed.

**Deferral**: **DF-SMS-01**, spec at `docs/project_plans/design-specs/sign-kb-per-module-content-hashing.md`
(authored at P7-DOC-006). The spec's own trigger is "anyone proposes surfacing a hash,
`hashes.recomputed`, or per-module integrity status in a clinician-facing surface" — until then FR-31
is the guard, not the fix.

## Finding P-2 (planning-known, appended 2026-07-23 at P7-DOC-007) — SQ-3 F9 / DF-SMS-05 — `cbc_suite_v1`'s 7 rule evidence IDs resolve to nothing against the anemia-only evidence registry

**Observed pre-feature; recorded here per the parent plan's "In-Flight Findings" policy.** All
seven evidence identifiers cited by `modules/cbc_suite_v1/rules.json`'s current rule set —

- `HEMATOLREP2024_NEUTROPENIA_REVIEW`
- `CALIPER2020_HEMATOLOGY_I`
- `CALIPER2023_MINDRAY_79PARAM`
- `SCNIR2022_GCSF_OUTCOMES`
- `COH2015_ELANE_MUTATIONS`
- `JPEDS2023_DUFFY_NULL_NEUTROPENIA`
- `PEDS2020_ISOLATED_NEUTROPENIA_OUTCOMES`

— resolve to nothing when passed to `src/evidence.js:9,22`, which contains anemia's 6 evidence
records only and no other module's records. If `cbc_suite_v1` were ever rendered through the
clinician-facing evidence path, every rule citation on a fired CBC/cytopenia candidate would
silently vanish, breaching the CLAUDE.md guardrail that "every clinical statement ties to a source"
and this repository's hard rule that missingness is never treated as normal.

**Attribution**: pre-existing content-registration debt from `multi-bundle-conversion-e1`, out of
scope for `spa-module-switcher-v1`. Unreachable while `cbc_suite_v1.status: unsigned-stub` and D-1's
inert-with-status-shown treatment keeps `assess()`/`assessModule()` from ever being invoked against
it — the eligibility predicate (`src/moduleEligibility.js`) refuses it before the evidence path is
consulted. **A live bug the moment `cbc_suite_v1` becomes selectable** — its promotion trigger is
therefore identical to the DF-SMS-05 promotion trigger, and remediation (registering the seven
identifiers or amending the rules) is a hard prerequisite for that promotion.

**Deferral**: **DF-SMS-05** — no separate design spec; this finding record *is* the deferral, per
the parent plan's triage table. The DF-SMS-02 spec (`per-module-evidence-view.md`) covers the
related-but-distinct question of how a per-module `#evidence` view would be added; that spec cites
this finding for the evidence-registration prerequisite.

## Finding P-3 (planning-known, appended 2026-07-23 at P7-DOC-007) — stale tripwire comment in `tests/module-registry.test.mjs:20-24`, overdue since commit `263120b`, actioned at P6-010

**Observed pre-feature; **not** caused by `spa-module-switcher-v1`.** `tests/module-registry.test.mjs`
lines 20-24 carry a comment stating the assertion "must be updated/deleted the day a second module
registers", and the assertion itself asserts "today there is exactly one registered module". Four
modules have been registered under `modules/` since commit `263120b` (`multi-bundle-conversion-e1`
Phase 6, landed 2026-07-22): `anemia`, `cbc_suite_v1`, `growth_suite_v1`, `kidney_suite_v1`. The
trigger this comment named fired at that commit and went unactioned for a release; the comment has
been factually stale ever since, independent of whether `spa-module-switcher-v1` shipped or was
cancelled.

**Attribution**: pre-existing debt, closed by this feature at **P6-010** because the D-6 verification
harness needed to touch this file. The correction updates the comment to state the real module
count and records that the trigger had been unactioned since `263120b`; the commit message for
P6-010 was required to treat this tripwire (Tripwire A) as distinct from the *separate*
`src/modules/registry.js:39-50` tripwire (Tripwire B — a *client-selectable moduleId surface* trigger
that `spa-module-switcher-v1` did fire, decided per E1 FR-14/R-8 + ADR-0009).

**Deferral**: none — closed. Recorded here as a finding rather than a deferred item because the
correction was mechanical, not a design question; the design question (whether `DEFAULT_MODULE_ID`
should change from `'anemia'`) was answered by ADR-0009 and E1 FR-14/R-8 at P6-010, and does not
require a further spec.
