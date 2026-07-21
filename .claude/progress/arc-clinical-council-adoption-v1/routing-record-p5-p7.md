# Delegation routing record — ARC clinical council adoption, P5–P7

Resolved 2026-07-21 by running the `delegation-router` **resolver** (`~/.claude/skills/delegation-router/resolver.js`)
against `~/.claude/config/model-registry.yaml`. Supersedes the P5–P7 rows of
`routing-record-p4-p7.md` (its P4 rows stand as executed history).

Plan `tier: 3`, `risk_level: critical`, pediatric clinical decision-support safety surface.

## Resolver output (verbatim `chosen_plugin_id` + `reason`)

| Leg | task_class | Resolved | agent_type_id | Resolver reason |
|---|---|---|---|---|
| Phase orchestration (P5/P6/P7 owners) | `orchestration` | `claude` / opus-4-8 | `claude` | MUST-stay-primary; non-claude providers rejected |
| Reviewer gates P5-V1 / P6-V1 / P7-V1 | `verdict` | `claude` / opus-4-8 | `claude` | MUST-stay-primary; non-claude providers rejected |
| Clinical council lenses | `council-review` | `claude` / opus-4-8 | `claude` | MUST-stay-primary; non-claude providers rejected |
| Cross-repo squash-merge sequencing | `cross-wave-merge` | `claude` / opus-4-8 | `claude` | MUST-stay-primary; non-claude providers rejected |
| Implementation (ARC runtime, portal, adapter) | `implementation` | `ica` / `claude-sonnet-5[1m]` | `ica-executor` | offload-eligible; `shared_token_pool`, **not free** |
| Documentation (P7-T1/T2 matrices, handoff) | `mechanical-tasks` | `ica` / `claude-sonnet-5[1m]` | `ica-executor` | offload-eligible; `shared_token_pool`, **not free** |

Four of six legs are hard MUST-stay-primary. Two resolved offload-eligible.

## Override on the two offload-eligible legs — kept claude-primary

Both are **deliberately not offloaded**. Three independent reasons, any one sufficient:

1. **No executor agentType is registered in this session.** The agent registry exposes no
   `ica-executor` / `codex-executor` / `gemini-executor`. A phase-owner cannot dispatch to a
   RoutingRecord-audited offload leg; the only path is hand-rolled `~/ica-claude.sh` Bash from
   inside a phase-owner, which escapes the audit log and violates "flat legs only" hygiene.
2. **Capability bar.** P3-V1 and P4-V1 each returned real FAILs on *plausible-looking* safety
   implementations — P4-V1 caught a false product-protection claim and a silently missed aplastic
   crisis that would otherwise have shipped into P5 as a qualifying input. The failure mode here is
   a confident-but-wrong safety contract; cost-shifting does not detect it. P5 is the certification
   artifact and P6-T3/T4 are fail-closed security surfaces (ACL, rights, injection, no-body-leak).
3. **No real saving.** ICA Sonnet 5 is `allowance: shared_token_pool`, not free. P7's docs legs —
   the only genuinely mechanical work — are 2 pts total; offload orchestration fragility exceeds
   the token shift.

Per MODEL-ROUTING §1.5: pick the highest-Cost model that clears the task's bar. For a pediatric CDS
certification surface the bar is the primary subscription.

**Resolved execution tier:** claude-primary, `sonnet-5` / `xhigh` for implementation legs,
`sonnet-5` / `high` for documentation legs, `opus-4-8` for orchestration and every reviewer gate.

## Invariants applied

- Owner-held gates (OQ-2 … OQ-6) are never synthesized regardless of provider.
- Flat legs only; no offloaded executor, so no cross-provider nesting question arises.
- Every reviewer verdict on a clinical-safety surface stays on the primary subscription.

## Wave plan (no `wave_plan` in plan frontmatter — derived from §3 dependency graph and §8)

Plan §3: critical path `P4 -> P5 -> P7`, with `P6` off the critical path (depends on P2 only).
P5 and P6 are **not** parallelized despite the graph permitting it — §3 states only one integration
owner may edit shared ARC runtime/schema files at a time, and both phases write
`agentic-research/schemas/` and `agentic-research/web/` in a single shared working tree that also
holds another agent's uncommitted work.

| Wave | Phase | Isolation | Repos touched | Landing |
|---|---|---|---|---|
| 1 | P5 | none (main) | ARC (primary), pediatric (tracking) | one squashed commit per repo, direct to `main`, pushed |
| 2 | P6 | none (main) | ARC (web/portal, adapters, knowledge-packs) | same |
| 3 | P7 | none (main) | both | same |

**Commit hygiene (hard rule, carried from P4).** The ARC working tree contains unrelated uncommitted
work owned by another agent (`.bob/`, `.claude/agent-memory/`, `.claude/agents/dev/`,
`runs/2026-07-19-spike-005-*`, `runs/2026-07-19-spike-006-*`). Phase-owners stage **explicit paths
only** — never `git add -A`, never `git add .`, never `git stash`, never `git checkout --` on a path
they did not create.
