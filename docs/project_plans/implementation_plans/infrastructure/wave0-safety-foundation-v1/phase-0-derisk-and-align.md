---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-0: De-Risk & Align"
status: draft
created: 2026-07-19
phase: EP-0
phase_title: "De-Risk & Align"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
feature_slug: wave0-safety-foundation
entry_criteria: "Phase 0 (platform-foundation-p0) green; npm run check green on main."
exit_criteria: "4 SPIKE findings docs recorded with decisions; DEF-1 resolved (single evidence source); IntentTree resynced to real state; RF-EV-002/REG-002 launched; DEF-2 promoted; CI hardened. npm run check green throughout."
---

# Phase EP-0: De-Risk & Align

**No WP counterpart** (see the plan's EP↔WP Mapping table) — this phase exists to retire the
uncertainty that would otherwise cause rework across EP-1/EP-2/EP-5.

**Dependencies**: None (first phase; formal prerequisite is Phase 0 / `platform-foundation-p0` green).
**Assigned Subagent(s)**: `general-purpose` (SPIKE execution, one per SPIKE, parallel where independent);
`backend-architect` (DEF-1 refactor); `artifact-tracker` (IntentTree resync).
**Entry criteria**: `npm run check` green baseline confirmed; the 4 SPIKE charters
(`docs/project_plans/SPIKEs/spike-00{3,4,5,6}-*.md`) exist and are `status: draft`.
**Exit criteria**: every task below closed; `npm run check` green; no golden output changed by the
DEF-1 refactor.

## OQ-6 Resolution (CI hardening moved in from EP-6)

The roadmap originally placed CI hardening (`check:imports` wired into CI, PR-trigger job) in WP6.
**OQ-6 resolved**: the gate must exist *before* the risky EP-1/EP-2/EP-5 migrations land, not after —
moved here as EP-0-T9. EP-6's phase total drops ~1 pt to compensate; the plan's total (68) is
unchanged.

## Task Table

**Column conventions**: `Estimate` is points. `Model`/`Effort` per `.claude/skills/planning/references/multi-model-guidance.md` — claude uses `adaptive`/`extended`; `gpt-5.6-sol`/`gpt-5.6-terra` (via `codex exec`) use `none`/`low`/`medium`/`high`/`xhigh`; `fable` uses `adaptive`/`extended`/`max` per its own routing convention (this repo's decisions block reserves `max` for its two open-ended safety-reasoning tasks).

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EP0-T1 | Execute SPIKE-003 (tri-state fact model migration) | Run the charter at `docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md`: re-run the field/rule/countTrue census, build the throwaway prototype, produce RQ1–RQ7 decisions including the full 33-rule migration table (or a documented partial + follow-up per the charter's timebox pivot). | All 7 RQs have a recorded decision/artifact per the charter's exit criteria; the 33-rule migration table is complete or explicitly partial with a named follow-up; a go/no-go statement exists for whether EP-1 can start coding directly. | 1.5 pts | general-purpose | sonnet | high | None |
| EP0-T2 | Execute SPIKE-004 (UCUM unit handling & mismatch rejection) | Run the charter at `docs/project_plans/SPIKEs/spike-004-ucum-unit-handling-mismatch-rejection.md`: decide the closed unit table shape, the dependency-vs-hand-roll call (D-5), and the fail-closed rejection boundary (API + browser) including the missing-unit policy (OQ-5). | A recorded decision on unit representation, D-5 rationale (hand-roll vs. dependency), and the missing-unit policy (reject vs. `unitAssumed` flag), each with a stated rationale, not an assertion. | 1.5 pts | general-purpose | sonnet | high | None |
| EP0-T3 | Execute SPIKE-005 (semantic diff classification) — design | Run the charter at `docs/project_plans/SPIKEs/spike-005-semantic-diff-classification.md`: enumerate change classes for `kb-diff.mjs`, explicitly hunt the false-negative under-reporting mode, and produce the seeded-mutation-corpus design that EP-5 implements against. Hardest reasoning in the phase — a missed insight here becomes a blind spot EP-5's classifier inherits. | A change-class taxonomy exists; a non-negotiable minimum deliverable (a behavioral dangerous-miss backstop independent of the structural classifier) is specified; a seeded corpus of known-safety-relevant mutations is enumerated for EP-5-T4 to consume. | 1.25 pts | general-purpose | fable | max | None |
| EP0-T4 | SPIKE-005 adversarial second lens | Cross-family review of EP0-T3's output, tasked explicitly with "find a safety-relevant change this classifier misses." Precedent: a prior gpt-5.6 cross-model audit caught 3 passage-fidelity gaps in the `rf` bundles — same adversarial posture applied here. | At least one candidate under-reporting scenario is either surfaced (and folded into the seeded corpus) or the reviewer records an explicit "none found, here is what I tried" statement — silence is not an acceptable output. | 0.5 pts | general-purpose | gpt-5.6-sol (`codex exec`) | xhigh | EP0-T3 |
| EP0-T5 | Execute SPIKE-006 (KB signing key custody & browser-side verification) | Run the charter at `docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md`. Explicit threat-modeling deliverable: is real cryptographic signing warranted at this trust boundary (single-maintainer, statically-deployed, unvalidated research prototype), or does `clinicalContentHash` + `supersedes` manifest chain suffice? Must be willing to conclude "signing is theater here." | RQ6's go/no-go on real signing vs. hash+chain is explicitly recorded with rationale (feeds the EP-5 SPIKE-006 contingency branch); RQ3's hashing-scope dependency on DEF-1 is confirmed resolved before this SPIKE's recommendation is finalized. | 1.0 pt | general-purpose | gpt-5.6-sol (`codex exec`) | xhigh | EP0-T6 (RQ3 needs DEF-1 resolved first) |
| EP0-T6 | Resolve DEF-1 — evidence dual-source unification (D-2 prerequisite, FR-WP3-01) | `src/evidence.js` stops hand-duplicating `modules/anemia/evidence.json`; it loads from (or is generated from) the single JSON source, per `docs/project_plans/design-specs/evidence-dual-source-unification.md`. **Must land before EP-3 extends the evidence shape** — this is D-2, binding. | Golden-fixture equivalence (`tests/module-equivalence.test.mjs`) proves the de-dup alone changed no output; `scripts/validate-kb.mjs`'s existing version-drift check against the two sources becomes structurally impossible to fail (no second source exists to drift). | 1.5 pts | backend-architect | sonnet | medium | None |
| EP0-T7 | Promote DEF-2 (tri-state-fact-model.md) from `shaping` to `ready`/committed | Using EP0-T1's SPIKE-003 output (migration table, aggregate decisions, operator semantics), update `docs/project_plans/design-specs/tri-state-fact-model.md`'s frontmatter `maturity` field and body to reflect the now-settled audit, per SPIKE-003's own recommendation (RQ6). SPIKE-003 is **reduce-not-merge** against DEF-2: DEF-2 keeps owning the type-shape direction; SPIKE-003 supplies the audit DEF-2 explicitly never attempted. | `maturity: ready` (or `committed`) set; body updated to reference the migration table instead of restating open questions SPIKE-003 already closed; no duplicate/drifting document pair remains. | 0.25 pts | general-purpose | sonnet | adaptive | EP0-T1 |
| EP0-T8 | Resync IntentTree tracker + launch RF-EV-002/REG-002 | Per repo-current-state.md §A and the AOS asset inventory: the tracker shows merged Phase-0 work and all verified `rf` runs as `not_started`. Verify node status against git log and `rf-handoff/RESULTS.md`; update the tracker to reality. Separately, launch **RF-EV-002** (CALIPER/Bohn 2023 pediatric CBC reference intervals) and **REG-002** (content-rights/licensing review) — external `rf` runs with no code dependency, needed before EP-2/EP-7 respectively. | IntentTree `wave0-safety-foundation` work_area reflects actual git/rf state (no node shows `not_started` for completed work); both `rf` runs are launched (visible via `rf status` or the RF API) before this phase closes. | 0.5 pts | artifact-tracker | haiku | low | None |
| EP0-T9 | CI hardening (FR-WP6-05, moved in from EP-6 per OQ-6) | Add `npm run check:imports` as a step in `.github/workflows/deploy-pages.yml` (present locally in `npm run check` since Phase 0, absent from CI). Add a PR-trigger job (today only `push: [main]` + `workflow_dispatch`) so the gate runs on branches/PRs, not only `main` push. | CI runs `check:imports`; a job triggers on `pull_request` events and gates merge (not merely informational); existing `push`/`workflow_dispatch` triggers remain intact. | 1.0 pt | general-purpose | haiku | low | None |

**Phase total: 9 pts** (8 original decisions-block anchor + 1 moved in from EP-6 per OQ-6).

## Notes on Model Routing

- `fable` (EP0-T3) is one of exactly two uses of `fable` in this plan — reserved for SPIKE-005's
  open-ended semantic-diff reasoning because a missed insight here becomes a blind spot the whole
  substrate inherits (the diff tool *certifies* changes as safe or not).
- `gpt-5.6-sol` (EP0-T4, EP0-T5) is used strictly as a cross-family adversarial/verification lens, never
  as primary author.
- `haiku` (EP0-T8, EP0-T9) carries the token-heavy mechanical work — tracker sync and CI YAML — never
  routed to a premium model.
- Orchestration and any `council-review` invocation stay on primary Claude (opus); not itemized as a
  task row here because no council gate is required inside EP-0 itself (the safety `council-review`
  gates land at the EP-1/EP-2 convergence, per D-1/D-3).

## Phase EP-0 Quality Gates

- [ ] All 4 SPIKE charters closed with recorded decisions (EP0-T1, T2, T3+T4, T5)
- [ ] DEF-1 resolved; golden-fixture equivalence holds (EP0-T6)
- [ ] DEF-2 promoted from `shaping` (EP0-T7)
- [ ] IntentTree resynced; RF-EV-002 and REG-002 launched (EP0-T8)
- [ ] CI runs `check:imports` and gates on PR events (EP0-T9)
- [ ] `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../wave0-safety-foundation-v1.md)
