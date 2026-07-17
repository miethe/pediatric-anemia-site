---
schema_version: 2
doc_type: skill_spec
skill_name: council-review
skill_version: "1.0.0"
status: stable
created: 2026-06-22
updated: 2026-06-22
owner: nick
source_docs:
  - CLAUDE.md
  - .claude/skills/council-review/references/run-workflow.md
  - .claude/skills/council-review/references/output-contract.md
related_skills:
  - council-run
affects_commands:
  - arc run
  - arc validate
---

<!-- Convention reference: skillmeat/.claude/context/key-context/spec-backed-skills-convention.md -->

# council-review — Skill Specification

> **Reading this file**: This is the versioned capability contract for the `council-review` skill.
> For invocation-time routing, see `SKILL.md` in this same directory.

---

## 1. Purpose & Scope

**Mission**: Populate an ARC run skeleton end-to-end — collect evidence, run independent
specialist reviewers, adjudicate, and emit the schema-valid artifact bundle — so a run
created by `arc run` becomes a complete, validated review.

A Claude Code agent runs this skill **in its own session** to do the actual reviewing;
`arc run` only scaffolds and emits a `next_steps` prompt (it does not call an LLM).

**In scope**:
- Building the evidence pack for a run
- Independent specialist reviewer passes (Claude and external reviewers)
- Adjudication that preserves accepted / rejected / disputed / watchlist findings
- Writing the schema-valid artifact bundle under `runs/<date>-<slug>/`
- Producing scorecard, risk register, decision record, and validation plan
- Closing a run with `arc validate`

**Out of scope**:
- Scaffolding a run, recommending/choosing a council, authoring council/role YAML,
  project binding, SAM pull/publish, agent-stub rendering — all `council-run`.
- Creating tickets or durable memory without explicit approval.

---

## 2. Capability Coverage

| Intent | Workflow / Section | Canonical Doc |
|--------|-------------------|---------------|
| "Run a council on this target" | `references/run-workflow.md` | CLAUDE.md § default council behavior |
| "What artifacts must a run produce / how do I validate them" | `references/output-contract.md` | `arc validate` surface |
| "Include a non-Claude reviewer (Codex, GitHub, Copilot, LangGraph)" | `references/external-reviewers.md` | `references/external-reviewers.md` |
| "Close / validate the run" | SKILL.md § Workflow step 6 | `uv run arc validate runs/<date>-<slug>` |
| "Scaffold a run / pick a council / author YAML" | [delegated] | `council-run` skill |

> Canonical command syntax is the `arc --help` surface; agents consult that, not this table, for exact flags.

---

## 3. Invariants & Constraints

1. **Populate-only boundary**: this skill populates an already-scaffolded run. It does
   not scaffold runs, recommend councils, or author council/role YAML — those are
   `council-run`. _Source_: CLAUDE.md, `SKILL.md`.

2. **Evidence-gated findings**: findings without evidence are hypotheses; high-severity
   findings require strong evidence or explicit stated uncertainty.

3. **Independence before synthesis**: run independent reviewer passes before adjudicating;
   do not let one reviewer's output contaminate another's.

4. **Preserve disagreement**: accepted, rejected, disputed, and watchlist findings are all
   retained in the artifacts — adjudication never silently drops a dissent.

5. **Schema-valid outputs**: every required artifact under `runs/<date>-<slug>/` must pass
   `arc validate` before the run is considered closed.

6. **No durable side effects without approval**: do not create tickets or write durable
   memory without explicit human approval.

---

## 4. Enhancement Backlog

- **[BL-1] Parallel reviewer dispatch (agent-teams)**: Run each reviewer seat as its own
  Claude session rather than one orchestrating agent.
  _Status_: deferred
  _Rationale_: No per-reviewer-session / agent-teams dispatch exists yet; tracked under
  I-5 multi-provider dispatch. Today a single agent runs all seats in-session, or the
  optional server executor (`POST /api/runs/{id}/execute`) runs one bounded agent.

- **[BL-2] Evidence-pack reuse across runs**: Cache and reuse evidence packs for repeat
  reviews of the same target.
  _Status_: candidate
  _Rationale_: Not yet specified; would need a freshness/invalidation policy.

---

## 5. Changelog

### v1.0.0 — 2026-06-22
- Initial SPEC.md drafted to the spec-backed-skills convention (7 required sections).
- Captures the scaffold (`council-run`) vs populate (`council-review`) boundary and the
  ARC execution model (in-session population; optional server executor; no agent-teams yet).
- Status: stable.

---

## 6. Integration Points

| Agent / Command | Invocation Pattern | Notes |
|-----------------|--------------------|-------|
| operator / human | `Skill("council-review")` | Run a full council over a scaffolded run |
| `council-coordinator` agent | coordinates reviewer seats during a run | Loads council/role defs authored via `council-run` |
| reviewer-role agents (`.claude/agents/<name>.md`) | read as reference during the run | Rendered by `council-run`; reference docs, not runtime dispatch targets |
| `POST /api/runs/{id}/execute` (optional) | server-side bounded executor | Runs one Agent-SDK agent (OAuth via `CLAUDE_CODE_OAUTH_TOKEN`), 60 turns / 30 min cap |

**Co-loaded with**: `council-run` (scaffolds the run this skill populates).

---

## 7. Success Signals

- A scaffolded run becomes a complete, `arc validate`-passing artifact bundle without the
  agent re-scaffolding or re-authoring council YAML.
- Findings carry evidence locators; high-severity findings are never bare assertions.
- Disputed and rejected findings survive adjudication in the artifacts.
- Agents correctly route scaffolding/authoring requests to `council-run` instead of
  attempting them here.
- When an `intent.yaml` drove the run, the review's framing traces to its `objective` / `intent_id`.
