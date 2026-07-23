# Plan Completion Report — spa-module-switcher-v1

**Run**: /execute-plan, background session, 2026-07-22 → 2026-07-23 (wall-clock ≈ 7.5 h from first
dispatch to FEATURE-KAREN dispatch). **Branch**: `worktree-spa-module-switcher-exec` off `main`
@ `cd20427`. **Execution model**: manual wave-driven loop (orchestrator-held; waves per the plan's
`wave_plan`), delegation routed through delegation-router (9 audit-logged legs, operator directive:
ICA for leafs, gpt-5.6 for second opinions).

## Status at report time

**All 8 build phases complete and committed; feature is `in_review`, NOT complete.** Outstanding:
1. **P6-011** — the named-human visual pass. Agent-captured evidence packet (8 screenshots +
   observations + sign-off block) at `.claude/worknotes/spa-module-switcher/visual-evidence/`;
   gaps owed by the human: true-375px capture, hover sweep, AT check, signature.
2. **Final squash-merge to main** — authorized by the dispatch prompt ("Squash to main when
   complete"), held until P6-011 is signed (P6-GATE/P6-KAREN/FEATURE-KAREN are all conditional on it).

## Per-wave summary

| Wave | Phases | Executor (routing leg) | Reviewer verdicts | Fix cycles | Commit |
|---|---|---|---|---|---|
| — | Governance pre-flight | orchestrator | — (D-7 operator override recorded: OQ-1 → mockup B dropdown) | — | a42dbda |
| 1 | P0 ∥ P1 | ICA Sonnet 5 ×2 (E-P0, E-P1) | P0-GATE APPROVED; P1-GATE APPROVED | 0 | 70b3bc4, 1a4c8b9 |
| 2 | P2 | primary Sonnet (E-P2) | P2-GATE APPROVED (incl. 26th-failure investigation → Finding E-2); P2-KAREN APPROVED; codex found 3 real fail-closed gaps | 1 (3 codex findings fixed w/ pollution-regression proofs) | cfce8e1 |
| 3 | P3 | primary Sonnet (E-P3), integration owner shared w/ P4 | P3-GATE CHANGES_REQUESTED → APPROVED | 2 (isRegisteredModule wiring; CBC limitations misattribution + rendered CSS collision found by orchestrator browser pass) | db3d336 |
| 4 | P4 | same owner (E-P4, extended) | P4-KAREN APPROVED; P4-GATE CHANGES_REQUESTED → APPROVED; codex found TOCTOU + explorer-init leak; orchestrator browser pass found forced-activation no-op | 1 (5 items) | f103df2 |
| 5 | P5 | ICA Sonnet 5 (E-P5) | P5-GATE APPROVED (ruled the cbc evidence-tab widening effectively mandatory) | 0 | bb798c8 |
| 6 | P6 | primary Sonnet (E-P6, extended) | P6-GATE CHANGES_REQUESTED → **CONDITIONAL APPROVED pending P6-011**; P6-KAREN **CONDITIONAL APPROVED pending P6-011**; codex found 5 harness-narrowness gaps | 2 (6 honesty-phrasing + 5 hardening + 2 dead identifiers) | 04aa713 |
| 7 | P7 | ICA Sonnet 5 (E-P7) | P7-GATE APPROVED | 0 | 090dec9 |
| — | FEATURE-KAREN + feature guide | in flight at report time | conditional expected | — | — |

Checkpoints: `.wave-1..7-checkpoint` in this directory.

## Gate posture (recorded honestly)

`npm run check` **cannot exit 0 on this branch or on main**: main was red at branch time
(25 test failures + `validate` exit 1, all `modules/**`/rights-substrate conformance — Finding
E-1), plus one branch-local diff-scope guard failure that self-resolves on squash-merge (Finding
E-2). Every phase gated **delta-green**: zero new failures (byte-identical failing-name sets,
stash-verified repeatedly), all other stages exit 0. Total tests grew 2587 → 2688 passing
(+131 new, all green); zero dependencies added.

## Scope deviations (all recorded at decision time)

- **D-7 operator override** (decisions block §11): selector form factor revised from rail (A) to
  header dropdown (B) per the dispatch instruction; all honesty constraints carried over.
- **Provider routing override**: plan pinned `provider: claude` everywhere; the dispatch directed
  delegation-router usage — P0/P1/P5/P7 ran on ICA Sonnet 5, per-milestone second opinions on
  codex gpt-5.6-terra, spine/safety-critical phases stayed primary. 9 RoutingRecords audit-logged.
- **P5-02 widening**: cbc evidence tab degraded too (gate-ruled mandatory — undegraded it would
  render anemia's sources under CBC's label).
- **P1 plan-citation correction**: `evidenceStalenessPolicy.js:11-14` does not export the FR-34
  string (plan text stale); pinned against the PRD with a drift-visibility test.
- **Plan status set to `in_review`, not `completed`** at DOC-005 — P6-011 and final reviews open.

## Reviewer-caught defects worth remembering (all fixed pre-merge)

1. Prototype-pollution fail-open in the eligibility predicate + loader map (codex, P2).
2. CBC row rendering anemia's delegated `limitations()` under CBC's label (validator, P3) — the
   exact D-1 masquerade the feature exists to close.
3. Rendered inert-row column collision (orchestrator's live browser pass, P3) — invisible to every
   source assertion.
4. Forced-activation silent no-op instead of the documented refusal state (orchestrator, P4).
5. Explorer init running an anemia assessment under an ineligible active module (codex, P4).
6. Latent stale-load TOCTOU family (codex + karen, P4) — generation-guard fix.
7. Harness narrowness: comment-decoy extraction, allow-list bracket/alias escapes, green-hue
   blind spots, DOM-scan gaps (codex, P6) — hardened with seeded self-tests.

## Follow-ups outside this feature

- **Fix main's inherited red** (Finding E-1): `modules/{cbc,growth,kidney}_suite_v1/evidence.json`
  + rights-ledger conformance to the tightened schema — clinical-adjacent, needs its own reviewed PR.
- **Rescope the E1 diff-scope guard** (Finding E-2) so feature branches stop false-failing.
- Deferred items DF-SMS-01..06: specs/ADR-0010 authored; promotion triggers named therein.
