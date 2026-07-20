# Delegation routing record — ARC clinical council adoption, P4–P7

Resolved once for the whole P4–P7 execution slice (2026-07-19) via `delegation-router`.
Plan `risk_level: critical`, `tier: 3`, clinical decision-support safety surface.

| Leg | task_class | Provider | Model / effort | Rationale |
|---|---|---|---|---|
| Session + phase-owner orchestration | `orchestration` | claude (primary) | opus-4-8 | MUST-stay-primary. Not routable. |
| Wave/merge sequencing, cross-repo commit | `cross-wave-merge` | claude (primary) | opus-4-8 | MUST-stay-primary. |
| Reviewer gates P4-V1 / P5-V1 / P6-V1 / P7-V1 | `verdict`, `council-review` | claude (primary) | opus-4-8 | MUST-stay-primary ×2. A clinical-safety verdict is never offloaded. |
| Implementation legs (schemas, ARC runtime, fixtures, portal) | `implementation` | claude (primary) | sonnet-5 / xhigh | **Deliberately not offloaded.** P3-V1 returned a real FAIL on three defects that let local applicability be *inferred* — each survived a plausible-looking implementation. Free-tier offload is below the bar for artifacts that gate pediatric CDS. |
| Pure-documentation legs (P7-T1/T2 gate matrices, handoff refresh) | `mechanical-tasks` | claude (primary) | sonnet-5 / high | Offload-eligible in principle; kept primary because they encode owner-authority boundaries and are cheap. |

## Invariants applied

- **Free-first is overridden by the capability bar.** ICA Sonnet 5 (`shared_token_pool`, not free) and
  Codex `gpt-5.6-terra` were both considered and rejected for implementation legs: the failure mode
  here is a confident-but-wrong safety contract, which cost-shifting does not detect.
- **Flat legs only.** No offloaded executor is used, so no cross-provider nesting question arises.
- **Owner-held gates are never synthesized** regardless of provider (OQ-4, OQ-5, OQ-6 remain open).

## Wave plan (no `wave_plan` in plan frontmatter — derived from §3 dependency graph and §8)

Plan §3 critical path is `P4 -> P5 -> P7` with `P6` off the critical path, and §8 orders the slice
6→7→8→9 as P4, P5, P6, P7. P4 and P6 were **not** parallelized despite the graph permitting it: §3
states only one integration owner may edit shared ARC runtime/schema files at a time, and both
phases write `agentic-research/schemas/` and `agentic-research/tests/` in a single shared working
tree. Sequential execution, one squashed commit per repo per phase, directly on `main` (matching the
P0–P3 precedent: `e69d307` pediatric, `80bb663` ARC).

| Wave | Phase | Isolation | Repos touched |
|---|---|---|---|
| 1 | P4 | none (main) | pediatric (primary), ARC (tests/fixtures) |
| 2 | P5 | none (main) | ARC (primary), pediatric (tracking) |
| 3 | P6 | none (main) | ARC (portal, adapters, knowledge-packs) |
| 4 | P7 | none (main) | both |
