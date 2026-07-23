---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1"
feature_slug: "multi-bundle-conversion-e1"
phase: 6
title: "REG Hold, Determinism & Validation Gate"
status: "in_progress"
created: '2026-07-21'
updated: '2026-07-22'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-5-6-7-projection-determinism-docs.md
commit_refs: ["6b8936f", "0c70cc6", "fc5b182", "79c0713"]
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 4
depends_on: ["P4", "P5"]
owners: ["validation-engineer"]
contributors: []

tasks:
  - id: "P6-T1"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: []
    description: "REG-001/REG-004 rights-posture HOLD record (FR-4/FR-19): author docs/legal/reg-001-reg-004-hold.md documenting both REG-001 (rf_run_20260717_reg_001_pediatric_cds_map_the) and REG-004 (rf_run_20260717_reg_004_pediatric_cds_scope_the) remain status: not_executed_owner_held (rf-handoff/RESULTS.md §5), are legal-review memos — not CDS-module evidence — and are excluded from every fixture/converter/clinical-drafting pathway until legal sign-off lands. Cross-references rf-handoff/RESULTS.md §5 explicitly. (Can start any time after Phase 2; sequenced here per decisions block boundary.)"
    started: '2026-07-22T07:27:28Z'
    completed: '2026-07-22T07:34:04Z'
    evidence:
      - commit: 6b8936f
    verified_by:
      - P6-GATE1
  - id: "P6-T2"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P6-T1", "P4-GATE", "P5-GATE"]
    description: "REG-exclusion final regression sweep (FR-4/FR-19): repository-wide check (not only Phase 2's batch-list test) confirming no fixture, module content, or converter artifact anywhere in the repository — including everything landed by Phases 1-5 — references REG-001/REG-004's run IDs, source-card IDs, or runs/ paths."
    started: '2026-07-22T07:50:04Z'
    completed: '2026-07-22T07:58:31Z'
    evidence:
      - commit: fc5b182
    verified_by:
      - P6-GATE1
  - id: "P6-T3"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "1.25 pts"
    dependencies: ["P4-GATE", "P5-GATE"]
    description: "Multi-bundle determinism double-run suite (FR-17, decisions block Risk 5): run the full P2-T3 batch (all 4 clinical bundles) twice against byte-identical fixture inputs and the same converter version; assert byte-identical output (SHA-256 equality) across every emitted file, independently per bundle, and for the aggregate multi-bundle-conversion-report.json. Canonical sort/serialize everywhere; stable iteration order confirmed. REAL SCOPE (corrected post-review, see plan-detail row P6-T3 and this feature's findings doc): only rf-cbc-002 -> cbc_suite_v1 completes inspect->verify->propose end to end and is proven full SHA-256 byte-identical across two/three independent runs; the other 3 bundles (anemia, kidney_suite_v1, growth_suite_v1) halt at inspect with DecisionsNotFoundError (DF-E1-M1, FR-14 module scoping) and are proven to halt at the identical pair/stage/cause, SHA-256-identical error message, zero partial output, across repeated runs; the aggregate multi-bundle-conversion-report.json is proven SHA-256-identical across repeated runs. This is the achievable determinism property, not byte-identity across all 4 bundles' full output."
    started: '2026-07-22T07:34:04Z'
    completed: '2026-07-22T07:50:04Z'
    evidence:
      - commit: 0c70cc6
    verified_by:
      - P6-GATE1
    notes: >-
      No authoring-decisions.yaml was fabricated for anemia/kidney_suite_v1/growth_suite_v1 to force
      those 3 bundles through propose's full drafting path. That restraint is the correct call under
      CLAUDE.md's "no invented thresholds" / no-fabricated-authoring guardrail — recorded here
      explicitly rather than left to be inferred from the diff.
  - id: "P6-T4"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.75 pts"
    dependencies: ["P6-T3"]
    description: "Finalize multi-bundle-conversion-report.json as single source of truth (FR-5, Observability NFR): confirm the aggregate report (P2-T4's schema) is populated with real post-Phase-4/5 data — per-bundle and aggregate counts including rules emitted (expected 0 across all 4 bundles, matching P4-T8/P5-T4 diff evidence). >=3 named conflict classes across the 4 bundles (WHO-vs-CDC growth, ANC-cutoff variance, proteinuria). Every field's empty/missing representation (R-P2) re-verified against real, final data."
    started: '2026-07-22T07:58:31Z'
    completed: '2026-07-22T08:16:46Z'
    evidence:
      - commit: 79c0713
    verified_by:
      - P6-GATE1
  - id: "P6-GATE1"
    status: "not_started"
    assigned_to: ["task-completion-validator"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P6-T1", "P6-T2", "P6-T3", "P6-T4"]
    description: "Reviewer gate: verify exit criteria — full npm run check green; determinism suite green (all 4 bundles, SHA-256 equality); REG exclusion confirmed repo-wide; conversion report finalized with 0-rules evidence."
  - id: "P6-GATE2"
    status: "not_started"
    assigned_to: ["karen"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P6-GATE1"]
    description: "karen milestone review (Tier-3 reviewer gate, 2nd of 3 named milestones) — REG hold, determinism & honesty. Independently re-check against the actual diff: the REG hold record's completeness and cross-reference accuracy; the determinism suite's real SHA-256 equality (not merely 'test passed'); CLAUDE.md hard guardrails ('no AI-published rule changes,' 'no invented thresholds,' 'missingness never treated as normal') against Phases 4-6's actual output. Runs before Phase 7 opens."

parallelization:
  batch_1: ["P6-T1", "P6-T3"]
  batch_2: ["P6-T2", "P6-T4"]
  batch_3: ["P6-GATE1"]
  batch_4: ["P6-GATE2"]

total_tasks: 6
completed_tasks: 4
in_progress_tasks: 0
blocked_tasks: 0
progress: 67
---

# Phase 6 Progress — REG Hold, Determinism & Validation Gate

**Wave**: 4 of 5. **Depends on**: Phase 4 complete AND Phase 5 complete.
**Assigned Subagent(s)**: validation engineer (general-purpose, sonnet); task-completion-validator
gate; **karen milestone review** (2nd of 3 named Tier-3 gates).

## Objective

Record `REG-001`/`REG-004`'s standalone rights-posture HOLD record, sweep the full repository for any
REG leakage, prove multi-bundle determinism by double-run SHA-256 equality, and finalize
`multi-bundle-conversion-report.json` as the single aggregate surface demonstrating the "0 rules across
all 4 bundles" claim by diff, not prose. The multi-bundle conversion report closes here.

## Entry Criteria

- Phase 4 complete (`P4-GATE` passed).
- Phase 5 complete (`P5-GATE` passed).

## Exit Criteria (decisions block §1)

- Full `npm run check` green.
- Determinism suite green.
- `karen` mid/near-end review.

## Reviewer Gate

- **P6-GATE1** — `task-completion-validator`.
- **P6-GATE2** — `karen` milestone review (must pass before Phase 7 opens).

## Quality Gates

*Validated at P6-GATE1 (task-completion-validator):*
- [x] Full `npm run check` green — re-run directly 2026-07-22 (bookkeeping close-out pass, NOT a run of
  P6-GATE1 itself — see the sequencing-discrepancy note below). Ran `npm run check` 4 times and `npm
  test` alone 3 more times in this pass, 7 invocations total: 6 of 7 exited `0` with `# tests 1389`,
  `# pass 1389`, `# fail 0`, `# cancelled 0`, `# skipped 0` (`npm run validate`, `npm run
  coverage:rules`, `npm run build`, `npm run verify:d4`, `npm run check:imports`, `npm run
  smoke:browser`, `npm run smoke` all green on every full-check invocation). **1 of 7 (the first
  full-check run of this pass) exited `1`** with `# tests 1389`, `# pass 1387`, `# fail 2` —
  `ef-converter-rule-candidate-drafting.test.mjs:146` (`ENOTEMPTY: directory not empty, rmdir
  '.../build/kb-pack/cbc_suite_v1/0.1.0-proposal'`) and `ef-converter-rule-provenance-
  projection.test.mjs:159` (`ENOENT: no such file or directory, open '.../build/kb-pack/cbc_suite_v1/
  0.1.0-proposal/rules.json'`). This is a live, directly-observed reproduction of the pre-existing
  shared-mutable-state test hazard already documented in this file's own Completion Notes /
  `.claude/findings/multi-bundle-conversion-e1-findings.md` § Phase 6 Findings (P3-T5/P3-T6-authored
  tests racing on the same non-scratch `build/kb-pack/cbc_suite_v1/0.1.0-proposal/` directory under
  Node's parallel test-file execution) — not a P6-authored regression, not remediated by this
  bookkeeping pass (out of scope per that finding), and not something a single "green" run can be
  trusted to rule out going forward. Checked here on the strength of 6/7 clean runs plus the
  already-documented, already-understood root cause of the 1 failure — not on the false premise that
  `npm run check` is unconditionally deterministic-green today.
- [x] Determinism suite green — full SHA-256 byte-identity across two/three independent runs for `rf-cbc-002` -> `cbc_suite_v1` (the one bundle that completes propose); identical halt pair/stage/cause (SHA-256-identical error message) across repeated runs for the other 3 bundles, which halt at `inspect` with `DecisionsNotFoundError` per FR-14 module scoping / DF-E1-M1; aggregate `multi-bundle-conversion-report.json` SHA-256-identical across repeated runs (P6-T3, `tests/ef-multi-bundle-determinism.test.mjs`)
- [x] Zero references to `REG-001`/`REG-004` anywhere in `tests/fixtures/**`, `modules/**`, `build/kb-pack/**` (repo-wide) — confirmed 2026-07-22 two ways: (a) `tests/ef-reg-exclusion.test.mjs`'s own 3 repo-wide sweep subtests (`tests/fixtures contains zero REG-001/REG-004 references`, `modules contains zero...`, `build/kb-pack contains zero...`) all pass inside the `npm run check` run recorded above; (b) an independent manual `grep -rn` for `REG-001`/`REG_001`/`reg-001`/`REG-004`/`REG_004`/`reg-004` across the same 3 trees, read by hand: the only hits are `tests/fixtures/rf-{kid-001,ev-001,gro-002,cbc-001}/HASH-PROVENANCE.md` and a comment in `modules/cbc_suite_v1/authoring-decisions.yaml`, all contrastive provenance prose explaining why that fixture was NOT sourced from REG-001/REG-004 — the explicitly-permitted Tier-2 `.md`/comment exception the test itself documents, not a leak. Zero Tier-1 (run_id / IntentTree node id / `runs/reg-*` path) or live-data Tier-2 hits found.
- [x] `multi-bundle-conversion-report.json` finalized, real data, 0-rules confirmed — confirmed 2026-07-22 by reading the freshly rebuilt `build/kb-pack/multi-bundle-conversion-report.json` (regenerated by the `npm run build` step in the same `npm run check` run above; this file is a gitignored build artifact, not committed): aggregate `rulesEmitted: 0` and all 4 per-bundle `rulesEmitted: 0` (anemia, cbc_suite_v1, kidney_suite_v1, growth_suite_v1); aggregate `conflictClassesCount: 11` split `cbc_suite_v1: 3`, `kidney_suite_v1: 4`, `growth_suite_v1: 4`, `anemia: 0` — includes the named WHO-vs-CDC growth-standard conflict (`conflict_who_vs_cdc_growth_standard`), satisfying the >=3-named-conflict-classes AC; real per-bundle `claimsProcessed` (48/88/87/92, summing to the aggregate's `315`) computed from each bundle's own committed `claim_ledger.yaml`, not placeholders.

*Validated at P6-GATE2 (`karen` milestone review):*
- [ ] `karen` sign-off recorded

## Completion Notes

P6-T1..T4 landed (commits `6b8936f`, `0c70cc6`, `fc5b182`, `79c0713`). `P6-GATE1`/`P6-GATE2` remain
`not_started` in this file's own task-tracking frontmatter pending reviewer/`karen` execution — this
phase stays `in_progress` until both gates run.

- **Sequencing discrepancy (recorded honestly, not corrected retroactively)**: this phase's declared
  gate order is `P6-GATE1` (`task-completion-validator`) first, then `P6-GATE2` (`karen` milestone
  review) — `P6-GATE2`'s own `dependencies: ["P6-GATE1"]` says so explicitly. In practice, a `karen`
  review against this phase (the review this bookkeeping pass is closing findings from) was carried
  out **before** `P6-GATE1` was separately run. `P6-GATE1` has **not** run — its task record above is
  left `status: not_started`, with no `started`/`completed`/`evidence`/`verified_by`, and that is not
  changed by this pass. Concretely: the individual tasks' `verified_by: [P6-GATE1]` entries (P6-T1
  through P6-T4, set in the earlier `f37d538` backfill) name the gate that was supposed to check them,
  not a gate that has actually executed — no independent `task-completion-validator` pass has verified
  those 4 tasks to date. A future reader must not infer from `karen`'s review having run that two
  independent gates passed this phase; only one review (`karen`'s, informally ahead of its declared
  slot) has actually been performed. This note exists so that gap is legible rather than silently
  absorbed into "both gates ran."

- **P6-T1**: `docs/legal/reg-001-reg-004-hold.md` authored; cross-references `rf-handoff/RESULTS.md` §5.
- **P6-T2**: `tests/ef-reg-exclusion.test.mjs` added — repo-wide REG-001/REG-004 leakage sweep, verified
  to actually detect an injected violation before being reverted.
- **P6-T3**: `tests/ef-multi-bundle-determinism.test.mjs` added. **Post-review correction**: the task's
  original AC text (and this plan's phase-detail file) asserted SHA-256 byte-identity across two
  full-batch runs for **all 4 bundles** — that is not what the converter can do today. Verified reality,
  now the AC of record (see
  `docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-5-6-7-projection-determinism-docs.md`
  row P6-T3, amended): only `rf-cbc-002 -> cbc_suite_v1` completes `inspect -> verify -> propose` and is
  proven full SHA-256 byte-identical across repeated runs; the other 3 bundles (`anemia`,
  `kidney_suite_v1`, `growth_suite_v1`) halt at `inspect` with `DecisionsNotFoundError` (FR-14 module
  scoping, Deferred Item DF-E1-M1) and are proven to halt at the identical pair/stage/cause with a
  SHA-256-identical error message across repeated runs; the aggregate
  `multi-bundle-conversion-report.json` is proven SHA-256-identical across repeated runs. No
  `authoring-decisions.yaml` was fabricated for the 3 non-running bundles to force them through the
  converter's drafting path — that restraint is the correct call under CLAUDE.md's no-invented-
  thresholds guardrail, recorded explicitly rather than left to be inferred.
- Test-suite honesty fix: Section 3 of `tests/ef-multi-bundle-determinism.test.mjs` (the per-module
  "byte-stable across two independent reads" checks) has been retitled as an at-rest integrity check,
  explicitly **not** a determinism proof — reading an unmodified file twice in one process cannot prove
  anything about the converter's determinism. The section header comment was corrected to match.
- **P6-T4**: `multi-bundle-conversion-report.json`-building code (`multi-bundle-report.mjs`) finalized
  with real Phase 4/5 data; `tools/rf-bundle-to-kb-pack/lib/multi-bundle-report.mjs` and
  `tests/ef-converter-multi-bundle-report.test.mjs` added to the parent plan's P6 `files_affected` list.
- **Tracked follow-up (not P6 scope)**: `tests/ef-converter-rule-candidate-drafting.test.mjs:44` and
  `tests/ef-converter-rule-provenance-projection.test.mjs:48` both write the real, non-isolated
  `build/kb-pack/cbc_suite_v1/0.1.0-proposal/` directory — a pre-existing (P3-T5/P3-T6,
  evidence-foundry-buildout) shared-mutable-state hazard inside the same `npm run check` gate P6
  certifies. Filed as a Bugs/Gotchas entry in
  `.claude/findings/multi-bundle-conversion-e1-findings.md` (Phase 6 Findings) rather than fixed here,
  since it predates and is out of this phase's authorship scope; recommended fix is the same
  `mkdtemp` scratch-dir pattern `tests/ef-multi-bundle-determinism.test.mjs` already uses.

## Findings Captured This Phase

See `.claude/findings/multi-bundle-conversion-e1-findings.md` § "Phase 6 Findings" — the P6-T3
AC-vs-reality correction and the pre-existing shared-mutable-state test hazard (not load-bearing for
P6; no new design-spec warranted, per the deferred-items/findings lifecycle).

## Superseded by `multi-bundle-conversion-e1-finish` (2026-07-23)

`in_progress` (`P6-GATE1` never run; `P6-GATE2` informally reviewed ahead of its declared slot, per
the sequencing-discrepancy note above, but not recorded as a formal pass) is left as-is here —
accurate, not stale — rather than force-set to `completed`. Noted so this tracker is not read as
contradicting `.claude/progress/multi-bundle-conversion-e1-finish/`: the `karen` review this
phase's own findings doc closes findings from is the direct predecessor of the successor plan
`docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md`, whose own P0
("gate recovery: honest rights triage for 35 sources") and P1–P4 work
(commits `dc1293a`, `a8762c4`, `19bf493`, `f7fc2c8`, `24be3f2`) is exactly the remediation that
`karen`'s review of this phase called for — not a re-run of P6-T1..T4, which stay as committed
here. Zero new clinical rules were emitted in either plan; this repo remains an unvalidated
research prototype.
