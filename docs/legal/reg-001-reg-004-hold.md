---
title: "REG-001 / REG-004 rights-posture HOLD record"
status: active
doc_type: legal_hold
created: 2026-07-22
updated: 2026-07-22
owner: Nick Miethe
project: pediatric-cds-platform
task_ref: "multi-bundle-conversion-e1, Phase 6, row P6-T1 (FR-4/FR-19)"
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-5-6-7-projection-determinism-docs.md
cross_ref: docs/project_plans/expansion/rf-handoff/RESULTS.md §5
---

# REG-001 / REG-004 rights-posture HOLD record

## 1. What this document is

This is a **HOLD record**, not a legal opinion and not clinical evidence documentation. It exists
solely to make one fact impossible to miss across every past and future pass of this program:
**`REG-001` and `REG-004` are legal-review memos, not CDS-module evidence, and neither may be used
to seed a fixture, a module, or any converter artifact until a qualified legal reviewer signs off.**

This record satisfies PRD `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md`
FR-4 and FR-19, and plan row P6-T1 of
`docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-5-6-7-projection-determinism-docs.md`.

## 2. The two runs

| Item | `run_id` | Gate | Mode | Status |
|---|---|---|---|---|
| `REG-001` | `rf_run_20260717_reg_001_pediatric_cds_map_the` | P0 | regulatory · **LEGAL** | `not_executed_owner_held` |
| `REG-004` | `rf_run_20260717_reg_004_pediatric_cds_scope_the` | P3 | regulatory · **LEGAL** | `not_executed_owner_held` |

Both runs are `rf verify`-passed (exit 0, 0 unsupported claims) as Research Foundry evidence
bundles — that is a **structural/governance** verification, not a legal or clinical sign-off. Per
**`docs/project_plans/expansion/rf-handoff/RESULTS.md` §5** ("⚠️ Legal review required — REG-001 &
REG-004"), both runs are "research input only — flagged for legal review; not legal advice," their
reports "carry the legal-review banner and frame all interpretive conclusions as
inference/speculation/pending-review," and reviewers must "not act on them as legal positioning
until a qualified reviewer signs off." That same section records: **"Status remains
`not_executed_owner_held` as of 2026-07-19 — no owner legal sign-off is recorded anywhere in this
program's trackers."**

As of this HOLD record's authoring date (2026-07-22), that status is **unchanged**: no legal
sign-off for either run has been recorded anywhere in this program's trackers (IntentTree,
Operator run log, `rf-handoff/RESULTS.md`, or this repository). `rf-handoff/RESULTS.md` §7 ("Next
steps (owner)") lists "route REG-001 + REG-004 memos to legal review" as an **owner** action item,
still open.

## 3. Why these two are categorically different from the other 5 verified runs

`rf-handoff/RESULTS.md` §1 lists **7** verified pediatric-CDS evidence runs. Five of them
(`RF-EV-001`, `RF-CBC-001`, `RF-CBC-002`, `RF-KID-001`, `RF-GRO-002`) are **clinical** runs and are
this program's legitimate converter targets (the 4 clinical bundles carried through
`multi-bundle-conversion-e1` Phases 1–5, plus the earlier anemia backfill). `REG-001` and `REG-004`
are the program's only **regulatory · LEGAL** runs — their subject matter is regulatory/legal
posture (e.g., HIPAA/CFR provisions), not clinical thresholds, and their own generated reports
self-flag as pending legal review. Treating an `rf`-verified regulatory memo as if it were
clinical evidence ready for rule authoring would be the same category of mistake this repository's
`CLAUDE.md` already calls out for the ARC clinical council: a review artifact is not a credentialed
sign-off. Here: **a legal-review memo is not a legal sign-off**, and it is also not clinical
evidence of any kind.

## 4. Binding exclusion — applies to this pass and every future pass

Until legal sign-off for `REG-001` and/or `REG-004` is affirmatively recorded (see §5 for what that
would look like), the following holds without exception:

1. **No fixture.** Neither run may be vendored into `tests/fixtures/` (there is no
   `tests/fixtures/rf-reg-001*` or `tests/fixtures/rf-reg-004*` directory, and none may ever be
   created against these two runs while this HOLD is in force).
2. **No converter invocation.** No script, batch list, or CLI invocation in
   `tools/rf-bundle-to-kb-pack/**` may name either run, its `run_id`, or any of its source-card IDs
   as a conversion target. The batch runner's literal `{fixture, module}` list
   (`tools/rf-bundle-to-kb-pack/lib/batch.mjs`, `BATCH_PAIRS`) must continue to name exactly the 4
   clinical bundles and never these two.
3. **No module artifact.** No `modules/<id>/evidence.json`, `evidence-assertions.json`,
   `unresolved.json`, `rules.json`, or `candidates.json` anywhere in this repository may be seeded,
   even partially, from either run's content.
4. **No clinical-drafting pathway.** Neither run's content may enter any clinical rule-authoring,
   evidence-assertion, or candidate-scaffold pathway, staged or committed, under `build/kb-pack/**`
   or anywhere else.
5. **No upstream reads.** Per the parent PRD's FR-4 and Risk R-7, no script this program adds may
   ever read either run's `runs/` directory on the Research Foundry node or its local mirror.

This exclusion is **repo-wide** and is independently regression-tested (not only asserted here):
`tests/ef-batch-reg-exclusion.test.mjs` asserts the batch runner's `BATCH_PAIRS` list contains
exactly 4 entries with no `REG-001`/`REG-004` reference in any form (path, `run_id` substring, or
module target), scans the converter scripts' live code (comments stripped) for either run's
identifiers, and confirms no `tests/fixtures/rf-reg-*` directory was ever committed. Plan row
P6-T2 (same phase as this record) runs the repository-wide regression sweep confirming this holds
across everything landed by Phases 1–5, not only the batch runner's own list.

## 5. What would lift this HOLD

Only an affirmative, recorded legal sign-off — from a qualified legal reviewer, on the record in
this program's trackers — that either run's content is cleared for use as CDS-module input would
change this posture, and only for the specific run(s) so cleared. No engineering action, `rf verify`
re-run, or ARC/council review can substitute for that sign-off. Design-spec
`docs/project_plans/design-specs/reg-001-004-legal-signoff-routing.md` (Phase 7, DOC-006c) is the
forward-looking routing document for how that sign-off, once obtained, would be recorded and acted
upon — it does not itself constitute or predict that sign-off, and as of this HOLD record it may
not yet exist depending on read order (Phase 7 follows Phase 6).

## 6. Cross-references

- **Primary source of truth for both runs' status**:
  `docs/project_plans/expansion/rf-handoff/RESULTS.md` §5 ("⚠️ Legal review required — REG-001 &
  REG-004") and §7 ("Next steps (owner)", item 2).
- **Run identity**: `docs/project_plans/expansion/rf-handoff/README.md` §2 (registered run list;
  `run_id`s reproduced verbatim in §2 of this record).
- **PRD requirements this record satisfies**: FR-4, FR-19 in
  `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md`.
- **Regression test enforcing the exclusion in code**: `tests/ef-batch-reg-exclusion.test.mjs`.
- **Batch runner's own documentation of the exclusion**: `tools/rf-bundle-to-kb-pack/lib/batch.mjs`
  (header comment, lines ~13+).
