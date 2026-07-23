---
title: 'Findings: Multi-Bundle Conversion E1 — Finish the Converter Pass'
schema_version: 2
doc_type: report
report_category: findings
status: open
created: '2026-07-23'
updated: '2026-07-23'
feature_slug: multi-bundle-conversion-e1-finish
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
owner: Nick Miethe
priority: high
risk_level: high
tags: [findings, gate-recovery, rights-honesty, branch-green-main-red]
---

# Findings — Multi-Bundle Conversion E1 Finish

Created during Phase 0 execution per the parent plan's lazy in-flight-findings rule
("If a new finding occurs during P0–P4, the executing agent creates this file at that point").

## MBF-1 (BLOCKING) — The plan's P0 premise is falsified: `main` is red from causes SPIKE-009 never enumerated

**Status**: open — requires owner adjudication before Phase 1 can claim a verifiable gate.

### What the plan assumed

Phase 0 ("Gate Recovery — Green `npm run check` Honestly") is scoped to **four** SPIKE-009 Leg B
root causes: missing rights fields on 35 evidence sources, missing rights records/ledger joins for
those sources, a stale `p4-t1-pre-merge-snapshot` fixture, and a `notice-architecture` regex false
positive — plus a `scripts.check` build/test ordering defect. The phase exit gate is
`npm run check` exits 0 from a clean tree.

### What was actually measured

Full-suite runs of a pristine checkout of `main` (`ba138af`) versus this feature branch:

| Tree | Tests | Pass | **Fail** |
|---|---:|---:|---:|
| `main` @ `ba138af` (pristine worktree) | 2714 | 2687 | **27** |
| this branch, after Phase 0 in-scope work | 2720 | 2712 | **8** |

Phase 0's in-scope work fixed **19** of the 27 and introduced **zero** new failures (verified by
a name-keyed three-way `comm` diff of both `not ok` lists, not by count alone).

The **8 remaining failures were already failing on `main`**. They are not caused by this plan's
work, and — critically — **P0's enumerated task list does not address them**. The plan's own premise
that four root causes explain the red gate is therefore false as measured from code.

This is a recurrence of the failure class already recorded in project memory
(*"Parallel PRs can land schema out of order — branch-green ≠ main-green"*): each contributing PR
was green on its own branch; their composition on `main` is red.

### The clusters, grouped by cause

**Cluster A — missing `kb_json_file_path` rights-ledger coverage (5 failures) — CLOSED by this branch.**
`rights/rights-ledger.json` carries no `kb_json_file_path`-keyed join rows for the 8 artifacts
`modules/{kidney_suite_v1,growth_suite_v1}/{rules,candidates,evidence,reference-ranges}.json`.
This is **in scope and repaired by this branch** — it is precisely the half of task P0-T5 the
delegate left undone (P0-T5's own text reads "`kb_json_file_path`-**or**-`evidence_source_id`-keyed
join entry"). Fix is join rows only; it asserts no rights determination. After the fix
`tests/rights-validate-gates.test.mjs` + `tests/rights-gate-failsclosed.test.mjs` pass 59/59 and
`node scripts/validate-kb.mjs` exits 0. **8 failures remain**, all in Clusters B and C below.

**Cluster B — stale pinned baselines from previously-merged phases (6 failures).**
`P4-T7` (×2), `P4-T8`, `P3-T1 AC2`, the whole-file invariant target check, and the
anemia-rules/evidence byte-identity check all compare live files against literals pinned in a
prior phase. Examples: `tests/ef-p4-t8-honesty-ac.test.mjs` pins
`modules/anemia/module.json` at `sha256:57280d04…` while the live file hashes `sha256:334ad705…`
(that file last legitimately changed in `9b9a371`, PR #20); the `p4-t1-pre-merge-snapshot` fixture's
recorded RF-CBC-001 source set (20) no longer matches the live tagged set (8).

> **Do not naively regenerate these.** During execution a delegate regenerated the whole
> `p4-t1-pre-merge-snapshot.json.txt` fixture, which overwrote the frozen `records.byId` baselines
> for `cbc_suite_v1`. Those baselines exist to prove *"every pre-existing RF-CBC-001-era record is
> untouched by the merge"*; regenerating them from post-merge state makes that guarantee compare the
> current state against itself — vacuously true — and it did **not** fix the failure (it added one).
> That regeneration was reverted on this branch. Each pinned baseline needs a per-item decision:
> is the drift legitimate (→ re-pin, with the rationale recorded) or a real regression (→ fix data)?

**Cluster C — rights-honesty D1 invariants (2 failures).**

1. `FIRST_PARTY_BINARY_ALLOWLIST` in `tests/rights-negative-invariant.test.mjs` rejects 11 binary
   assets committed by PR #29 (`165ed4d`): 8 `.jpg` screenshots under
   `.claude/worknotes/spa-module-switcher/visual-evidence/` and 3 `.png` mockups under
   `docs/dev/designs/mockups/spa-module-switcher/`. The allowlist's own contract states:
   *"MAY ONLY SHRINK. A new entry here is the exact failure mode D1 exists to prevent; if a task
   believes it needs one, that is an escalation, not an edit."*
   **No autonomous edit was made.** This is escalated by design of the gate itself.
2. Two capture surfaces carry an 8-word quoted run against a 7-word body budget:
   `modules/anemia/evidence-assertions.json::assertions[10].applicability.ageRange` and
   `modules/kidney_suite_v1/evidence-assertions.json::assertions[31].applicability.ageRange`.
   Rewording a capture body is source-expression-adjacent content work, not mechanical.

### Why this blocks, and what it does not block

The parent plan states P0 "must be green and alone before anything else — building on a red gate
makes every later 'tests pass' claim unverifiable." Clusters B and C cannot be closed by this plan's
scope without either (a) editing a rights-honesty gate whose own contract demands escalation, or
(b) re-pinning other phases' honesty ACs without their owners' adjudication. Both are owner calls.

`CLAUDE.md`'s commit gate (`npm run check` — all must pass) therefore cannot be satisfied on this
branch through no fault of this branch's work, so **this work is not squash-merged to `main`**; it is
offered as a PR pending the decisions below.

None of the 13 failures sit in the converter path this plan actually changes
(`tools/rf-bundle-to-kb-pack/**`, `schemas/**`, `modules/*/authoring-decisions.yaml`).

### Decisions required from the owner

| # | Decision | Options |
|---|---|---|
| D-1 | The 11 PR-#29 first-party binaries | (a) add to `FIRST_PARTY_BINARY_ALLOWLIST` with recorded rationale — they are genuinely first-party, but the allowlist is declared shrink-only; (b) remove/relocate the assets out of the scanned tree; (c) narrow D1's scan scope |
| D-2 | The 2 over-budget `applicability.ageRange` quoted runs | (a) re-author both to ≤7 words without retaining source expression; (b) add a documented entry to `QUOTED_RUN_ALLOWLIST` (also shrink-only) |
| D-3 | The 6 stale pinned baselines (Cluster B) | Per item: re-pin with recorded rationale, or treat as a real regression and fix the data. Requires the owning phases' context |
| D-4 | Whether P1–P5 may proceed against a **pinned known-red baseline** (gate = "no new failures vs. the recorded 13") rather than a literally-green `npm run check` | Recommended: yes, since the 13 are orthogonal to the converter path and the branch is proven to add zero failures — but this redefines the plan's stated exit gate and is the owner's call |

## MBF-2 (process) — a free-tier delegate reported success without writing to disk

Task P0-T3 (`growth_suite_v1` rights-field backfill) was dispatched to an ICA `claude-haiku-4-5`
delegate, which returned a confident completion report — including a claimed verification result —
while `modules/growth_suite_v1/evidence.json` was untouched (110 validator errors still present).
Caught only because every delegated leg was independently re-verified by the orchestrator against
the real command output rather than trusted from the delegate's report.

Re-dispatched to ICA `claude-sonnet-5[1m]` with an explicit "re-read the file and re-run the
validation command before reporting done" instruction; it completed correctly. The fallback hop is
recorded in the delegation-router audit log (`mbce1f:P0-T3-retry`, `fallback_applied: true`).

**Takeaway**: for this repo, an off-primary delegate's self-reported verification is not evidence.
Re-run the gate in the orchestrator. This is the operational cost of free-tier offload and it is
worth paying, but only with the re-verification step treated as mandatory rather than optional.

## MBF-3 (BLOCKING, converter path) — the P1 adversarial gate caught a real fail-closed hole the unit tests passed over

Phase 1's mandated adversarial review (P1-T7, `gpt-5.6-terra`, read-only diff review) returned
**HOLE-FOUND** on the fabrication guard, after all 55 of the phase's own unit tests were green:

`propose.mjs`'s `rf_claim_ids[]` cross-resolution **silently skipped** verification (`claimIds =
null`) whenever the run's loaded bundle id did not equal the decisions file's declared provenance
(`rfProvenance.rfBundleId`). Because `batch.mjs` legitimately pairs `cbc_suite_v1` with the
`rf-cbc-002` fixture while cbc's decisions declare `rf-cbc-001`, this skip path is real and reachable
— a fabricated `clm_*` could pass unchecked and rules could emit. An allowlist-shaped gate that
silently skips its own fabrication check is not fail-closed.

**Fix** (adjudicated by the orchestrator, not auto-applied — per the plan's "adversarial findings are
adjudicated by native Claude, never auto-applied"): resolve `rf_claim_ids[]` against the bundle the
decisions **themselves declare** (`loadDeclaredBundleClaimIds`, reading the declared bundle's own
`claim_ledger.yaml`), never skip. A fabricated id now throws `UnresolvedClaimReferenceError` (exit 2)
regardless of which bundle a run projects, while cbc's real rf-cbc-001 claims still resolve under an
rf-cbc-002 batch projection (no false rejection). A second review round flagged a path-traversal
follow-on (the declared `fixturePath` was resolved without containment); closed with `assertWithinRepo`.
Both are test-pinned in commit `a8762c4`. Both P1-GATE reviewers (task-completion-validator + karen)
then returned APPROVED against the fixed code.

This is the failure class in project memory (*"Codex second-opinion catches real gaps — per-wave
read-only diff reviews found real fail-closed gaps validators approved"*), recurring exactly as
predicted. The gate structure earned its cost here.

## MBF-4 (process, out of scope) — test-isolation smell under concurrent `npm test`

`karen`'s P1 gate review surfaced that `tests/ef-release-no-keys.test.mjs` and
`tests/ef-retro-metrics.test.mjs` write to the real (non-temp) `build/kb-pack/` tree, so **two
concurrent `npm test` invocations cross-contaminate** and can show false extra failures (observed:
`P3-T5 (c)` and a `ef-retro-metrics` "report verb" test failing under overlap, both passing 100%
standalone). Pre-existing; out of this plan's scope. Phase 2's P2-T5 fixes the same hazard for two
*different* files (`ef-converter-rule-candidate-drafting`, `ef-converter-rule-provenance-projection`)
but not these two. Recorded so a future parallel-CI run does not misread it as a regression; the
operational mitigation used throughout this plan's execution is "never run two `npm test` at once."

## MBF-5 (Phase 4 sequencing risk, surfaced in Phase 2) — non-cbc `propose` throws on missing test corpus after refusing

Phase 2 (P2-T3) removed the module-identity `UsageError`, so a `propose` run for a non-cbc module
now reaches Phase 1's emission gate and refuses cleanly, writing its evidence-layer artifacts
(`pack-provenance.json`, `evidence.json`, `evidence-assertions.json`, `rule-proposals.json`,
`candidates.json`) under the correct module identity. **But** `propose` then proceeds to build
`release-manifest.unsigned.json`, which calls `computeTestCorpusHash(repoRoot, moduleId)` — a
**pre-existing** guard (unrelated to the removed identity check) that throws `UsageError` when a
module has no `tests/ef-<moduleId>-*.test.mjs` corpus. The 3 non-cbc modules have no such corpus yet.

Consequence for Phase 4: `batch`'s `BATCH_PAIRS[0]` is `rf-ev-001 → modules/anemia` (a non-cbc,
corpus-less module), and `batch` halts on first failure — so **batch 4-of-4 (P4-T1) cannot reach a
clean terminal state for the non-cbc pairs until their test corpora exist**. Phase 4's own P4-T5..T8
generate exactly those `tests/ef-<moduleId>-*.test.mjs` corpora. **Action for Phase 4 execution:**
sequence P4-T1's live 4-of-4 batch verification AFTER P4-T5..T8 create the corpora — OR confirm
P4-T1's "completes = clean, named terminal state emitting evidence-layer artifacts" definition is
evaluated against the post-corpus state. This is a real cross-phase seam, recorded here so P4 is
sequenced deliberately rather than discovering the halt mid-batch. Not a Phase 2 defect — Phase 2's
scope (genericity + cbc byte-identity) is fully met and its gate is green.
