---
type: progress
schema_version: 2
doc_type: progress
prd: "multi-bundle-conversion-e1"
feature_slug: "multi-bundle-conversion-e1"
phase: 4
title: "Existing-Module Projections (anemia backfill, cbc extension)"
status: "in_progress"
created: '2026-07-21'
updated: '2026-07-22'
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
phase_detail_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-3-4-scaffolds-and-backfill.md
commit_refs: ["0550947", "6f28cd2", "cc6528d", "87746d0", "b406649", "2d9c51a", "4c5c97c"]
pr_refs: []
execution_model: batch-parallel
plan_structure: independent
wave: 3
depends_on: ["P2", "P3-T3"]
integration_owner: "module-engineer"
seam_tasks: ["P4-T4", "P4-T7"]
risk_note: "Plan's single highest-risk phase (decisions block Risk 1 + Risk 2) — extended effort throughout."
owners: ["module-engineer"]
contributors: []

tasks:
  - id: "P4-T1"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "0.5 pts"
    dependencies: ["P2-GATE", "P3-T3"]
    description: "Pre-merge snapshot hash (baseline for byte-identity proof): before any propose run in this phase, record a SHA-256 hash of every file in modules/anemia/{evidence.json,rules.json,candidates.json} and every file in modules/cbc_suite_v1/** (rules.json, candidates.json, authoring-decisions.yaml, evidence.json, evidence-assertions.json, rule-provenance.json). Write the snapshot to a worknote or test fixture P4-T4/P4-T7 can compare against."
  - id: "P4-T2"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "0.75 pts"
    dependencies: ["P4-T1"]
    description: "RF-EV-001 -> modules/anemia/evidence-assertions.json additive backfill (FR-6 / OQ-1): run propose for RF-EV-001 against modules/anemia/, producing a NEW evidence-assertions.json matching cbc_suite_v1's established schema shape. MUST NOT write to, regenerate, or modify modules/anemia/evidence.json or rules.json in any way."
  - id: "P4-T3"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P4-T2"]
    description: "Anemia dual-pipeline reconciliation note (OQ-1): short in-repo note (modules/anemia/EVIDENCE-PROVENANCE-NOTE.md or README addendum) documenting evidence.json (EP-3/EP-4 pipeline, prior) and evidence-assertions.json (this pass, EF pipeline, new) as parallel provenance views of the same upstream bundle (RF-EV-001), neither superseding the other. Cross-references rf-handoff/RESULTS.md; links forward to Deferred Item DF-E1-M3 (P7-T4) once populated."
  - id: "P4-T4"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "0.75 pts"
    dependencies: ["P4-T2", "P4-T3"]
    description: "SEAM TASK (R-P3). Anemia rule->evidence reference integrity: run the full existing modules/anemia/ test suite (all 91-rule tests) plus a dedicated reference-integrity check — every evidenceId/evidenceRef cited by any of the 91 rules in rules.json still resolves inside evidence.json after P4-T2's backfill lands. Proves the additive backfill did not silently break the pre-existing rule<->evidence graph."
  - id: "P4-T5"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "1.0 pts"
    dependencies: ["P4-T1", "P2-GATE"]
    description: "RF-CBC-002 -> extend modules/cbc_suite_v1/ collision-safe merge (FR-7/FR-8, decisions block Risk 2 — riskiest cell): run propose for RF-CBC-002 against modules/cbc_suite_v1/, APPENDING (never recreating) evidence.json and evidence-assertions.json, including the pancytopenia-branch claims. Every new ID collision-checked against RF-CBC-001-derived content already present — a collision fails the batch closed, never silently overwrites. Merge/sort deterministically keyed on stable IDs, never array position. rules.json and authoring-decisions.yaml NOT touched."
  - id: "P4-T6"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P4-T5"]
    description: "cbc_suite_v1 merge idempotency test (FR-8): re-run propose for RF-CBC-002 a second time against the now-merged cbc_suite_v1 and assert zero duplicate records are created — the merge step is idempotent, not merely additive-once."
  - id: "P4-T7"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "extended"
    estimated_effort: "0.5 pts"
    dependencies: ["P4-T5", "P4-T6"]
    description: "SEAM TASK (R-P3). cbc_suite_v1 post-merge byte-identity: compare modules/cbc_suite_v1/{rules.json,authoring-decisions.yaml} and every RF-CBC-001-derived record inside evidence.json/evidence-assertions.json against P4-T1's pre-merge snapshot hash. The hard test gate the decisions block requires before Risk 2 is considered closed."
  - id: "P4-T8"
    status: "completed"
    assigned_to: ["general-purpose"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "0.5 pts"
    dependencies: ["P4-T4", "P4-T7"]
    description: >
      LOAD-BEARING honesty AC (decisions block Notes for implementation-planner; verbatim from the
      phase file): Explicitly assert and test: zero entries were added to modules/anemia/rules.json
      or modules/cbc_suite_v1/rules.json as a result of this phase; modules/anemia/module.json.approvedBy
      stays [] (was already []; confirm unchanged); modules/cbc_suite_v1/module.json.status stays
      "unsigned-stub", approvedBy: [], clinicalContentHash: null — unchanged by the merge (OQ-2:
      knowledgeBaseVersion also stays unchanged, per the parent plan's OQ-2 resolution). "Module
      complete" or "backfill succeeded" is never described anywhere in this phase's output as implying
      clinical readiness. AC: git diff of modules/anemia/rules.json and modules/cbc_suite_v1/rules.json
      shows zero lines changed; module.json.status/approvedBy/clinicalContentHash/knowledgeBaseVersion
      fields for both modules are byte-identical before/after this phase, test-enforced, not merely
      asserted in prose.
  - id: "P4-GATE"
    status: "not_started"
    assigned_to: ["task-completion-validator"]
    model: "sonnet"
    model_effort: "adaptive"
    estimated_effort: "—"
    dependencies: ["P4-T1", "P4-T2", "P4-T3", "P4-T4", "P4-T5", "P4-T6", "P4-T7", "P4-T8"]
    description: "Reviewer gate: verify exit criteria — npm run check green; anemia's 91 rules + existing tests unchanged in behavior; cbc_suite_v1's E0-era content byte-identical post-merge; determinism holds (local double-run of P4-T2/P4-T5; full determinism suite deferred to Phase 6); zero-new-rules AC (P4-T8) passes."

parallelization:
  batch_1: ["P4-T1"]
  batch_2: ["P4-T2", "P4-T5"]
  batch_3: ["P4-T3", "P4-T6"]
  batch_4: ["P4-T4", "P4-T7"]
  batch_5: ["P4-T8"]
  batch_6: ["P4-GATE"]

total_tasks: 9
completed_tasks: 8
in_progress_tasks: 0
blocked_tasks: 0
progress: 89
---

# Phase 4 Progress — Existing-Module Projections (anemia backfill, cbc extension)

**Wave**: 3 of 5 (parallel to Phase 5). **Depends on**: Phase 2 complete (batch runner + `EF-WP1`
gate); Phase 3's `P3-T3` (so `modules/cbc_suite_v1` registry state is stable).
**Assigned Subagent(s)**: module engineer (general-purpose, sonnet); task-completion-validator gate.
**Integration Owner** (R-P3): module engineer — owns both concerns in this phase (RF-EV-001 ->
`modules/anemia/`, RF-CBC-002 -> `modules/cbc_suite_v1/`) and the two seam tasks proving neither
mutation corrupted its target.

**This is the plan's single highest-risk phase** (decisions block Risk 1 + Risk 2) — extended effort
throughout.

## Objective

Project `RF-EV-001` additively into `modules/anemia/` (91 hand-authored rules untouched) and merge
`RF-CBC-002` collision-safely into the already-populated `modules/cbc_suite_v1/` — the two structural
paths E0's single-bundle slice never proved — while producing zero new clinical rules.

## Entry Criteria

- Phase 2 complete (`P2-GATE` passed).
- Phase 3's `P3-T3` landed (registry state stable for `cbc_suite_v1`'s neighbors).

## Exit Criteria (decisions block §1)

- `npm run check` green.
- Anemia's 91 rules + existing tests unchanged in behavior.
- Determinism holds.

## Reviewer Gate

- **P4-GATE** — `task-completion-validator`.

## LOAD-BEARING Honesty AC (P4-T8, verbatim)

> Explicitly assert and test: zero entries were added to `modules/anemia/rules.json` or
> `modules/cbc_suite_v1/rules.json` as a result of this phase; `modules/anemia/module.json.approvedBy`
> stays `[]` (was already `[]`; confirm unchanged); `modules/cbc_suite_v1/module.json.status` stays
> `"unsigned-stub"`, `approvedBy: []`, `clinicalContentHash: null` — unchanged by the merge (OQ-2:
> `knowledgeBaseVersion` also stays unchanged, per the parent plan's OQ-2 resolution). "Module complete"
> or "backfill succeeded" is never described anywhere in this phase's output as implying clinical
> readiness.
>
> AC: `git diff` of `modules/anemia/rules.json` and `modules/cbc_suite_v1/rules.json` shows zero lines
> changed; `module.json.status`/`approvedBy`/`clinicalContentHash`/`knowledgeBaseVersion` fields for
> both modules are byte-identical before/after this phase, test-enforced, not merely asserted in prose.

## Quality Gates

- [x] `npm run check` green (1367/1367 tests pass, verified while landing P4-T8; formal P4-GATE review still outstanding)
- [x] Anemia's 91 rules and their full existing test suite pass unchanged (P4-T4, `npm test` 1357 tests green)
- [x] `modules/anemia/evidence.json` and `rules.json` byte-identical to pre-phase snapshot (P4-T1, re-confirmed P4-T4/P4-T8)
- [x] `modules/cbc_suite_v1/rules.json` and `authoring-decisions.yaml` byte-identical to pre-phase snapshot (P4-T7, re-confirmed P4-T8)
- [x] `cbc_suite_v1`'s `RF-CBC-001`-derived evidence/assertion records unchanged, field-for-field (P4-T7)
- [x] A seeded ID collision between `RF-CBC-001`/`RF-CBC-002` fails the merge closed, no partial write (P4-T6/`tests/ef-cbc-002-backfill.test.mjs`)
- [x] **Zero new rules in `modules/anemia/rules.json` or `modules/cbc_suite_v1/rules.json`, test-enforced (P4-T8, `tests/ef-p4-t8-honesty-ac.test.mjs`)**
- [x] Both modules' `status`/`approvedBy`/`clinicalContentHash`/`knowledgeBaseVersion` unchanged (P4-T8, `tests/ef-p4-t8-honesty-ac.test.mjs`)

## Implementation Notes

### Known Gotchas

- P4-T2's converter `--out` target must be scoped to only emit the new assertions file — never touch
  `modules/anemia/evidence.json` or `rules.json`.
- P4-T5's merge must be keyed on stable IDs, never array position, to stay deterministic and idempotent.
- `knowledgeBaseVersion` does NOT bump (OQ-2) — a version bump with zero rule changes would misleadingly
  suggest clinical content changed.

## Completion Notes

P4-T1..T7 landed via commits 0550947/6f28cd2/cc6528d/87746d0/b406649/2d9c51a/4c5c97c (RF-EV-001 additive
backfill into `modules/anemia/`; RF-CBC-002 collision-safe merge into `modules/cbc_suite_v1/`; both seam
tasks green). P4-T8 (this entry) adds `tests/ef-p4-t8-honesty-ac.test.mjs`, the phase's own load-bearing
honesty gate: `modules/anemia/rules.json` and `modules/cbc_suite_v1/rules.json` are proven byte-identical
to the P4-T1 pre-merge baseline (the durable, git-diff-equivalent form of "zero lines changed" — a
literal `git diff` against a pinned commit SHA would not survive this branch's eventual squash-merge to
`main`, per the same reasoning `tests/ef-p5-t4-honesty-ac.test.mjs` documents for the sibling P5-T4 AC);
`modules/anemia/module.json.approvedBy` stays `[]`; `modules/cbc_suite_v1/module.json.status` stays
`"unsigned-stub"` with `approvedBy: []`, `clinicalContentHash: null`, and `knowledgeBaseVersion` unchanged
at `0.1.0-2026-07-21` (OQ-2 — no version bump for zero clinical-content change); and a language-honesty
scan confirms this phase's own tracked output (this file, the decisions-block worknote) never describes
either projection as "module complete" or "backfill succeeded" outside an explicit negation. Landing real
evidence into both modules is not clinical review: neither module's rule count moved, neither
`approvedBy` gained a name, and neither module is module complete, signed, or clinically ready.
`npm run check` verified green as part of landing this task. P4-GATE (task-completion-validator) remains
the outstanding reviewer-gate task for this phase.
