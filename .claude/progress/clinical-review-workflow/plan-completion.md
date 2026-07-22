# Plan Completion Report — clinical-review-workflow-v1 (DF-E1-01)

**Plan**: `docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md` (Tier 3, 19 pts, 5 phases)
**Executed**: 2026-07-22, single background session (Opus-orchestrated, workflow-scripted waves)
**Base**: origin/main `e8fd5dd` → branch `worktree-exec-clinical-review-workflow`
**Final state**: all 5 phases `completed`, 0 phase-gate violations, `npm run check` green end-to-end (2417 tests, 8/8 sub-steps)

## Execution model

Per-wave embedded-graph wrappers over `.claude/workflows/execute-plan.js` (graphs built from the
phase progress YAMLs; validator gates in-workflow; karen + codex gpt-5.6-terra gates
orchestrator-side between waves). Routing per delegation-router RoutingRecords: ICA free-offload
eligible P1 tasks fell back in-session (shared-worktree safety, recorded per-task); P3-T3 runbook
drafted on ICA haiku then verified/rewritten in-session (2 draft bugs caught); codex lane used for
all second-opinion gates; no new mockup generation needed (P4-T2 committed asset verified +
manifested).

## Per-wave summary

| Wave | Phases | Agents | Validator | Codex gate | Karen | Fix commits |
|---|---|---|---|---|---|---|
| 1 | P1 (derived status & scaffold) | 6, 0 err | APPROVED (0 cycles) | FAIL: 3 MAJOR + 1 MINOR → all closed (1 refuted with verified evidence) | — | 5d0cb89, 6496236, def80ab |
| 2 | P2 (sign & cache) ∥ P4 (portal framework) | 9, 0 err | APPROVED ×2 (0 cycles) | FAIL: 3 BLOCKER + 1 MAJOR → all closed (B1 via 2 rounds incl. symlink vector; 1 residual race adjudicated out-of-threat-model, documented) | P4 milestone: **APPROVED** | 2b8674e, 05ae17a, 9ba97ce, 2b123d4, a0675ea, e20de0a, a3d177b |
| 3 | P3 (render queue & runbook) | 5, 0 err | APPROVED (0 cycles) | FAIL: 1 MAJOR + 1 MINOR (runbook accuracy) → both closed | — | f1f92f4 |
| 4 | P5 (hardening & docs) | 5, 0 err | APPROVED (1 non-blocking comment sweep) | Feature-end FAIL: 2 MAJOR + 1 MINOR → all closed (MIN2 mutation-proven) | Feature-end: **APPROVED** (self-ran full check) | 91427a9, 3750d92, 939d92b, d7476e0, 77d18ac |

Wall-clock: ~6.5 h first dispatch → final gate. ~30 workflow agents + 10 orchestrator-side
agents, 0 agent errors, 0 unresolved escalations, 0 Mode D triggers.

## Reviewer verdicts

- **task-completion-validator**: approved every phase, 0 fix cycles in-workflow.
- **karen** (P4 milestone + feature-end): APPROVED ×2; feature-end verdict rests on karen's own
  full `npm run check` run, 10-FR evidence sample, byte-for-byte guardrail checks.
- **codex gpt-5.6-terra** (every wave + feature-end): 4 FAIL verdicts → 13 substantive findings
  (3 BLOCKER / 7 MAJOR / 3 MINOR), all closed with re-pass confirmation. The validator missed
  every one of these — **the codex second-opinion gate remains load-bearing on this repo** (now
  2 runs of evidence: EF-E1's 9 findings + this run's 13).

## Scope deviations & findings (full log: `.claude/findings/clinical-review-workflow-findings.md`, CRW-F1..F12, status: accepted)

- Phase 1/3/4 progress YAMLs predated plan Revision 1 (only 2/5 resynced by PR #25); agents
  implemented the plan's canonical rows and logged the drift (CRW-F2/F3); the missed
  `scaffold --draft`/F5 scope was folded into P2-T1 and shipped.
- Batch_2 of P3 placed two tasks on the same files (plan's own parallelization flaw, CRW-F10);
  agents recovered via index-level hunk isolation; wave-plan authoring should verify batch
  file-disjointness from `target_surfaces`.
- One out-of-scope file touch: `tools/retro-validate/lib/discordance.mjs` (+`allowHistoricalSubject: true`,
  additive, keeps retro tests green after F5 hardening).
- CRW-F12: the plan's DF-CRW-03 trigger text is stale (DF-E1-04 harness already landed) —
  recorded, not silently corrected.

## Owner-review items (carried into the PR body)

1. D1 rights `FIRST_PARTY_BINARY_ALLOWLIST` +1 entry (concept PNG, CRW-F1) — frozen-allowlist
   escalation, adjudicated via plan ratification, needs owner ratification.
2. `ALLOWED_WRITE_FILE_CALLERS` +1 entry (`lib/validate-cache.mjs`, CRW-F9).
3. FR-26 governance-sensitive change to `lib/adjudication.mjs` (conditional adjudication
   completeness; ADR-0004 stays `proposed`, G0 uncleared).
4. CRW-F5: MAJOR governance defect (independence check not supersedes-aware) found and fixed
   mid-feature.
5. Post-G1 residual: real adjudication scaffolds will need `--allow-historical-subject` by design.

## Not done (by design)

- No CHANGELOG entry (plan OQ-5 decision). No feature-report HTML (plan's Wrap-Up section
  specifies feature-guide.md + PR; guide at `.claude/worknotes/clinical-review-workflow/feature-guide.md`).
- G0–G4 all uncleared; zero real reviewers; roster still 5 synthetic / 0 real;
  `clinicalApprovers[]`/`approvedBy[]` schema-forced empty. **Unvalidated research prototype** —
  every check above proves software behavior only.
