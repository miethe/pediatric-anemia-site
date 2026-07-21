# Plan Completion Report — Evidence Foundry Buildout (E0 + Pre-E1 ADRs)

**Plan**: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md` (Tier 3, 42 pts)
**Executed**: 2026-07-21, via workflow `wf_93d96035-d9f` (adapted execute-plan script, run from an isolated worktree `worktree-evidence-foundry-buildout`)
**Baseline**: `eafd5bc` → final worktree HEAD `8a4c893` (154 files, ~27.7K insertions)
**Result**: `status: complete` — all 7 phases, all gates approved.

## Per-wave summary

| Wave | Phases | Tasks | AC gate (codex gpt-5.6-terra) | Karen milestone (opus) | Fix cycles | Checkpoint |
|------|--------|------:|------|------|-----:|------|
| 1 | P1 Foundation & fixtures | 7 | APPROVED | — | 0* | `fba7282` |
| 2 | P2 Converter core | 8 | APPROVED | APPROVED | 2 | `04d2bc6` |
| 3 | P3 Projection ∥ P6 ADRs | 7 + 8 | APPROVED ×2 | — | 1 (P3) | `b0fc991` |
| 4 | P4 Vertical slice + corpus | 9 | APPROVED | — | 0 | `b09c9fd` |
| 5 | P5 Manifest & traceability | 5 | APPROVED | APPROVED | 1 | `fcbe2b7` |
| 6 | P7 Docs & deferral closure | 16 | APPROVED | APPROVED | 1 | `8a4c893` |

\* Wave 1's first pass escalated `needs_opus` (see Escalations); after Opus remediation the resumed gate approved with 0 in-workflow fix cycles.

## Feature-level reviewer gate (Tier 3)

**karen (real agent, end-to-end): APPROVED — no required fixes.** Verified: `npm run check` exit 0; exactly 4 rules in `modules/cbc_suite_v1/rules.json`, each provenance- and assertion-backed with zero invented thresholds (`#implementation-proposal` suffixes honestly marked); converter determinism proven empirically (double-run aggregate SHA `edfe72a4…` identical); 17 seam-invariant subtests pass (exceeds the 15 required); all 8 ADRs `proposed`, none accepted; `module.json` stays `unsigned-stub` / `approvedBy: []`; `modules/anemia/` diff empty; no clinical-validity overclaiming; `deferred_items_spec_refs` = exactly 10 existing paths; findings doc set and present.

Accepted-risk notes (non-blocking, for E1): (1) rule↔assertion linkage is indirect (via sourceId/rfClaimId/traceability-index) — a direct rule→assertion key would cheapen audits; (2) the invariants file proves 17 subtests, not 15 — do not propagate "15" as the count.

## Escalations & deviations

1. **Wave 1 `needs_opus` (reviewer_unresolved)** — two real defects found by the codex AC gate: the P1-T5 seeded-invalid fixture (plain `.json`) was swept by `backfill-rule-governance.mjs` breaking `tests/rule-governance.test.mjs`; and P1-T2's envelope field-presence validation was absent from `scripts/validate-kb.mjs`. Both fixed by an Opus-dispatched remediation agent (`2241fce`); 852/852 tests green after.
2. **Harness defect (worktree path resolution)** — agents instructed to act "from the repo root" resolved to the main checkout: per-batch commits silently no-opped and the Stage-B verdict reader missed the AC artifact, burning run-1's fix cycles on a phantom issue. Fixed by anchoring every Bash-instruction prompt to the absolute worktree path; run resumed from cache. One stray tracker edit in the main checkout was reverted.
3. **No Mode-D boundaries** — verified pre-flight; the stock heuristic's `/auth/i` false-positive on `authoring-decisions.yaml` was deliberately not applied (no auth/payments/migrations/deletion in scope).
4. **Registry adaptation** — the plan's named specialist agent types did not exist in the session registry at launch; tasks ran as `general-purpose` with role framing. (The real `karen`/`task-completion-validator` types became available mid-run and karen was used for the feature-level gate.)
5. **In-flight findings** — `.claude/findings/evidence-foundry-buildout-findings.md` (created P1-T3): pre-existing single-module assumptions in `schemas/evidence.schema.json`, `server.mjs`, `scripts/build-static.mjs`, `scripts/verify-d4-built.mjs` fixed fail-closed-preserving; `src/evidence.js` unification found already landed by EP-0 (P1-T4 verified rather than re-implemented).

## Delegation routing (per delegation-router audit log)

- Implementation waves → claude/sonnet (per plan decisions block §8). AC gates → **codex gpt-5.6-terra** two-stage (all 7 phases; fallback to claude never needed after run 1's path fix). Karen milestones + feature gate → claude/opus, MUST-stay primary. Mechanical commits/tracking → claude/haiku. ICA offload pre-resolved and logged as an option (`EF-BUILDOUT-doc-waves-ica-option`) but not exercised — the doc waves were already cached/in-flight on primary when the option was raised.

## Wall-clock & usage

Run 1: 61 min / 23 agents / ~1.56M subagent tokens (Wave 1 + escalation). Run 2 (resume): ~4.9 h / 133 agents / ~11.1M subagent tokens (Waves 1–6 with Wave 1 cache-replayed). Opus orchestration: pre-flight graph build, 1 escalation adjudication, 1 remediation dispatch, harness patch, feature-level karen dispatch.

## Honesty boundary (unchanged)

Everything produced is an **unsigned proposal**: `modules/cbc_suite_v1/module.json.status = "unsigned-stub"`, `approvedBy: []`, all 8 ADRs `proposed`. Nothing here is clinically validated, signed, or reachable from a patient-facing surface. Automated checks prove software behavior only.
