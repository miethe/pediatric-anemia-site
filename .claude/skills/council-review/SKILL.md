---
name: council-review
description: >
  Run an Agent Review Council over a product, workflow, codebase, architecture,
  prompt, agent package, or GTM artifact. Produces evidence-backed structured findings,
  scorecard, risks, decision record, and validation plan.
version: 1.0
app_version: "2026-06-22"
updated: 2026-06-22
spec: ./SPEC.md
---

# Council Review Skill

Use this skill for full ARC runs that need coordinated evidence collection, independent
reviewer passes, adjudication, and schema-valid outputs. It **populates** a run skeleton;
it does not scaffold one.

## When To Use

- Populate an ARC run skeleton (the 11-artifact bundle under `runs/<date>-<slug>/`).
- Run independent specialist reviewers, then adjudicate and synthesize.
- Produce schema-valid findings, scorecard, risk register, decision record, validation plan.
- Review a run launched from an `intent.yaml` (treat `intent_id` + `objective` as authoritative).

## When NOT To Use

- Scaffolding a run skeleton, choosing/recommending a council, or authoring/editing
  council or reviewer-role YAML — use the **`council-run`** skill.
- Rendering `.claude/agents/<name>.md` companion stubs — `council-run`.
- Project binding, council resolution, SAM pull/publish — `council-run`.

## Confidence Anchor

- Run skeleton + artifacts live under `runs/<date>-<slug>/` (created by `arc run`).
- Close a run with `uv run arc validate runs/<date>-<slug>` (schema-valid gate).
- `arc run` is a scaffolder: it writes empty artifacts + a `next_steps` prompt and does
  NOT call an LLM. This skill is how a Claude Code agent populates the run in-session.

## Workflow

> **Intent-first context**: When reviewing a run launched from an `intent.yaml`, the
> `intent_id` and `objective` fields in the intent are the authoritative statement of
> what the run was trying to achieve. Reference these if the run's objective is ambiguous.

1. Confirm target, objective, council definition, constraints, and required outputs.
2. Read `references/run-workflow.md` for the end-to-end council procedure.
3. Read `references/output-contract.md` before creating or validating run artifacts.
4. Read `references/external-reviewers.md` only when the run includes Codex, GitHub,
   Copilot, LangGraph, or other non-Claude reviewers.
5. Write artifacts under `runs/<date>-<slug>/`.
6. Validate with `uv run arc validate runs/<date>-<slug>`.

## Ground Rules

- Findings without evidence are hypotheses.
- High-severity findings require strong evidence or explicit uncertainty.
- Run independent reviewer passes before synthesis.
- Preserve accepted, rejected, disputed, and watchlist findings.
- Do not create tickets or durable memory without approval.
- Keep final output concise, but preserve the structured artifacts.

## Do Not Say

- Do not say `arc run` executes the review or calls an LLM — it only scaffolds an
  empty run skeleton plus a `next_steps` prompt; this skill populates it in-session.
- Do not say the reviewer companion files (`.claude/agents/<name>.md`) are dispatched
  as separate agents or an agent-team at runtime — no per-reviewer-session dispatch
  exists yet (deferred to I-5); they are reference docs the single agent reads.
- Do not say this skill scaffolds runs, recommends councils, or authors council/role
  YAML — that is `council-run`.

## Key References

- `/Users/miethe/dev/homelab/development/agentic-research/.claude/skills/council-review/references/run-workflow.md`
- `/Users/miethe/dev/homelab/development/agentic-research/.claude/skills/council-review/references/output-contract.md`
- `/Users/miethe/dev/homelab/development/agentic-research/.claude/skills/council-review/references/external-reviewers.md`
- `/Users/miethe/dev/homelab/development/agentic-research/.claude/skills/council-review/SPEC.md`
