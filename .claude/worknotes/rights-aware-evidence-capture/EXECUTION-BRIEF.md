# Execution Brief — Rights-Aware Evidence Capture & Taxonomy (binding)

> Every task agent executing this plan MUST read this file first. It is the compact form of the
> plan's binding constraints. Where this file and the plan disagree, **the plan wins** — but that
> disagreement is itself a defect worth reporting in your summary.

## Canonical documents

| What | Path |
|---|---|
| Plan (root) | `docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md` |
| Phase files | `docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1/phase-r<N>-*.md` |
| Progress files (task one-liners) | `.claude/progress/rights-aware-evidence-capture/phase-r<N>-progress.md` |
| Decisions block (binding) | `.claude/worknotes/rights-aware-evidence-capture/decisions-block.md` |
| PRD | `docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md` |

Your task's **authoritative** scope + acceptance criteria live in your **phase file**, keyed by your
task ID (e.g. `EPR3-T4`). Read that section before you edit anything. The progress-file frontmatter
carries the same task as a one-line summary — useful orientation, not a substitute.

## Scope discipline

Implement **only your task ID**. Do not start adjacent tasks even when they look trivial or when you
notice they are incomplete — another agent owns them and will run after you. If your task cannot be
completed as specified, stop and say so in your summary rather than substituting your own design.

## Hard rules (D1–D7) — violating any of these fails the phase

- **D6 — no agent-authored authority.** Never write a `CLEARED_*` status, a `clinicalApprovers[]`
  or `approvedBy[]` member, `counsel_approved`, or an authoritative `derived_synthesis`. These stay
  schema-forced empty / null / `candidate`. No clinical sign-off exists in this project and none may
  be manufactured. This is the single most important rule in the plan.
- **D1 — the archive is provenance, not text.** Never add third-party full text, tables, figures, or
  brand assets to the repo. Capture addressable provenance and structured locators, never retained
  third-party expression. Re-captured numerics are **per-value atoms with locators, never a
  reproduced table**. What you deliberately did not store is recorded explicitly in `not_captured[]`.
- **D7 — coverage gates only, never clearance gates.** Any gate you add is coverage- or
  consistency-shaped. A record at `overall_status: UNKNOWN` MUST still pass `npm run validate`.
  A gate that blocks the build for lack of a clearance is a defect, not a feature.
- **D2 — three axes, three fields.** `evidence_item_type` (measured vs. judged) ×
  `rights_component_class` × epistemic `status` vs. legal `overall_status`. No code path may infer
  one axis from another.
- **D4 — rights records live in the top-level `rights/` tree** with a join ledger. Inline
  `extensions.rights` on clinical JSON is explicitly rejected.
- **Determinism.** No `Date.now()`, no `new Date()` without an explicit argument, in any gate or
  generator. Two runs at different wall-clock times over unchanged input must be byte-identical.
  Date-dependent behaviour goes through an `--as-of` flag or env value.
- **No `format: "uri"`** in schemas — `json-schema-lite` silently ignores it. Use `pattern`.

## File-ownership barriers — do not cross

| File | Owner | Rule |
|---|---|---|
| `package.json` | **EP-R0 only** | All gate wiring lands once, in EP-R0. No other phase edits it. |
| `CLAUDE.md` | **EP-R5 only** | No other phase edits it. |
| `scripts/validate-rights.mjs` | `integration_owner` = **EP-R0** | EP-R0 creates the module and fixes its exported-gate contract (one pure function per gate, registered in a single exported gate list). EP-R1/R2/R3 **append** a gate + its unit test. Never rename a gate, restructure the module, or change an existing gate's signature. A needed shape change is an escalation, not an edit. |
| `scripts/validate-kb.mjs` | `integration_owner` = **EP-R1** | EP-R1 lands the ledger-resolution helper (EPR1-T2). EP-R2 (EPR2-T5) adds a call site and does **not** rewrite the helper. |
| `schemas/evidence.schema.json` | EP-R2 then EP-R3, strictly ordered | EP-R3 layers item-level axes onto EP-R2's source-level fields; it does not re-litigate them. |

## Vendored-schema posture

The five spec schemas vendored into `schemas/rights/` are **not usable as-is** — the RF handoff §9
records six conflicts. EP-R0 ships a **declared local amendment layer** plus
`schemas/rights/VENDORING.md`. Every divergence from the spec bundle's `checksums.sha256` is an
annotated, declared amendment — never a silent edit. See the plan's §"Vendored-schema amendment
posture" table for the six conflicts and their owning tasks.

## What this feature does NOT ship

Zero clearances. Zero attestations. Zero grounded rules. Zero clinical-meaning changes. Where a task
touches a clearance, attestation, or authoritative-synthesis surface, it ships **the plumbing and the
fails-closed test, and never the value**. If you find yourself about to populate one of those fields
with a real value, you have misread the task.

## Validation

- After your change: `npm run validate && npm test` must be green (Node ≥ 20).
- If you are the **final task of your phase**, run the full gate: `npm run check`
  (`npm test && npm run validate && npm run coverage:rules && npm run build && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke`).
- `package.json` is the authoritative composition of `npm run check`, **not** `CLAUDE.md` (stale
  until EPR5-T5 lands).

## Working agreement

- You are on an isolated worktree branch. **Commit your own task** as a logical unit when it is
  green. Do not push, merge, stash, rebase, or touch any other branch.
- You may dispatch the read-only `Explore` agent for codebase enumeration (EP-R3 in particular
  expects this before any edit). You perform the edits yourself.
- Return the structured result: `id`, `assigned_to: "general-purpose"`, `status`, `commit_sha`,
  and a `summary` that names what you changed and any constraint you had to stretch.
