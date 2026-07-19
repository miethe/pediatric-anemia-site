---
title: "Implementation Plan: Phase 1 — Wave-0 Safety & Defensibility Foundation"
schema_version: 2
doc_type: implementation_plan
status: draft
created: 2026-07-19
updated: 2026-07-19
feature_slug: "wave0-safety-foundation"
feature_version: "v1"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: null
scope: "Install the safety/provenance contract (tri-state facts, fail-closed units, exact-passage evidence, governed rule metadata, verifiable KB manifest + semantic diff, adversarial validation corpus) on the existing anemia module. Zero new clinical modules, zero new/retuned thresholds, zero new clinical claims."
effort_estimate: "68 pts"
architecture_summary: "EP-0 de-risks (4 SPIKEs + DEF-1 + CI hardening) before EP-1 (tri-state facts) and EP-2 (units/ranges) parallelize; EP-3+EP-4 (evidence provenance + rule governance) run serially on content already de-risked; EP-5 (manifest+diff) attests to EP-3/4's output; EP-6 (adversarial corpus) proves the whole substrate; EP-7 (review contract + docs) floats from EP-0 and seals last."
related_documents:
  - docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
  - .claude/worknotes/wave0-safety-foundation/decisions-block.md
  - .claude/worknotes/wave0-safety-foundation/repo-current-state.md
  - .claude/worknotes/wave0-safety-foundation/spike-charter-summary.md
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  - docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
  - docs/project_plans/design-specs/tri-state-fact-model.md
references:
  user_docs: []
  context:
    - .claude/worknotes/wave0-safety-foundation/decisions-block.md
    - .claude/worknotes/wave0-safety-foundation/repo-current-state.md
    - .claude/worknotes/wave0-safety-foundation/spike-charter-summary.md
  specs:
    - schemas/rule.schema.json
    - schemas/candidate.schema.json
    - schemas/patient-input.schema.json
    - schemas/assessment-output.schema.json
  related_prds:
    - docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
spike_ref:
  - docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md
  - docs/project_plans/SPIKEs/spike-004-ucum-unit-handling-mismatch-rejection.md
  - docs/project_plans/SPIKEs/spike-005-semantic-diff-classification.md
  - docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md
adr_refs: []
deferred_items_spec_refs: []
findings_doc_ref: null
charter_ref: null
changelog_ref: null
changelog_required: true
test_plan_ref: null
plan_structure: unified
progress_init: auto
owner: nick
contributors: []
priority: critical
risk_level: high
category: "infrastructure"
tags: [implementation, safety, provenance, tri-state, evidence, manifest, governance, wave-0, phase-1]
tier: 3
estimated_points: 68
milestone: null
commit_refs: []
pr_refs: []
files_affected:
  - schemas/patient-input.schema.json
  - schemas/rule.schema.json
  - schemas/evidence.schema.json
  - schemas/reference-range.schema.json
  - schemas/kb-manifest.schema.json
  - schemas/review-record.schema.json
  - src/ruleEngine.js
  - src/facts/core.js
  - src/units.js
  - src/ranges/registry.js
  - src/evidence.js
  - modules/anemia/facts.anemia.js
  - modules/anemia/rules.json
  - modules/anemia/evidence.json
  - modules/anemia/reference-ranges.json
  - modules/anemia/ranges.js
  - modules/anemia/module.json
  - server.mjs
  - scripts/validate-kb.mjs
  - scripts/sign-kb.mjs
  - scripts/kb-diff.mjs
  - scripts/mutation-run.mjs
  - tests/property.test.mjs
  - tests/boundary.test.mjs
  - tests/mutation.test.mjs
  - tests/dangerous-miss.test.mjs
  - .github/workflows/deploy-pages.yml
  - README.md
  - docs/clinical-algorithm.md
  - docs/architecture.md
  - CLAUDE.md
wave_plan:
  serialization_barriers:
    - modules/anemia/ranges.js       # line 42 seam: EP-1 owns writes, EP-2 verifies only
    - modules/anemia/rules.json      # touched by EP-1 and EP-4; separated by waves, no same-wave collision
  phases:
    - id: EP0
      depends_on: []
      isolation: shared
      parallelizable: false
    - id: EP1
      depends_on: [EP0]
      isolation: shared
      parallelizable: true
    - id: EP2
      depends_on: [EP0]
      isolation: shared
      parallelizable: true
    - id: EP3
      depends_on: [EP1, EP2]
      isolation: shared
    - id: EP4
      depends_on: [EP3]
      isolation: shared
    - id: EP5
      depends_on: [EP4]
      isolation: shared
    - id: EP6
      depends_on: [EP5]
      isolation: shared
    - id: EP7
      depends_on: [EP0]
      isolation: shared
  waves:
    - [EP0]
    - [EP1, EP2]
    - [EP3]
    - [EP4]
    - [EP5]
    - [EP6]
    - [EP7]
---

# Implementation Plan: Phase 1 — Wave-0 Safety & Defensibility Foundation

**Plan ID**: `IMPL-2026-07-19-wave0-safety-foundation`
**Date**: 2026-07-19
**Author**: implementation-planner agent (sonnet), expanding an Opus-authored decisions block
**Human Brief**: `docs/project_plans/human-briefs/wave0-safety-foundation.md` (qualifies: 68 pts, 8 phases, multi-plan coordination) — authored separately, not by this task.
**Related Documents**:
- **PRD**: `docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md`
- **Decisions Block**: `.claude/worknotes/wave0-safety-foundation/decisions-block.md` (binding phase boundaries, D-1..D-5, risk hotspots, model routing)
- **Repo current-state**: `.claude/worknotes/wave0-safety-foundation/repo-current-state.md`
- **SPIKE charters**: `docs/project_plans/SPIKEs/spike-00{3,4,5,6}-*.md` (executed in EP-0)

**Complexity**: XL (Tier 3). **Total Estimated Effort**: 68 pts. **Provider**: claude primary; `codex exec` (gpt-5.6 line) as cross-family adversarial/verification lens only; `fable` for two open-ended safety-reasoning tasks. No UI-design or web-research external models needed.

## EP ↔ WP Mapping (read this before anything else)

This plan names execution phases **EP-0 … EP-7**. The parent roadmap
(`docs/project_plans/expansion/01-platform-expansion-roadmap.md:150-231`) and PRD name the same
scope in units **WP1…WP7**. The mapping is 1:1 except EP-0, which has **no WP counterpart** — it is
a de-risking/prerequisite phase this plan adds ahead of WP1.

| Execution Phase | Roadmap/PRD Unit | Scope |
|---|---|---|
| **EP-0** | *(none — de-risk prerequisite)* | Execute SPIKE-003..006; resolve DEF-1 (D-2); resync IntentTree; launch RF-EV-002/REG-002; promote DEF-2; CI hardening (moved in, OQ-6) |
| **EP-1** | WP1 | Tri-state fact model |
| **EP-2** | WP2 | Local reference-range registry + unit service |
| **EP-3** | WP3 | Exact-passage evidence records |
| **EP-4** | WP4 | Rule metadata for governance |
| **EP-5** | WP5 | Signed KB manifest + semantic diff |
| **EP-6** | WP6 | Expanded validation corpus |
| **EP-7** | WP7 | Clinical-review portal — concept + data contract only |

**OQ-6 resolved**: CI hardening (`check:imports` wired into CI, PR-trigger job added) moves from EP-6
to EP-0 — the gate must exist *before* the risky migrations, not after. EP-0 gains ~1 pt; EP-6 loses
~1 pt. Phase-total sum is unchanged (68).

## Executive Summary

Phase 0 (commit `ff4b519`) proved the `modules/<id>/` package contract with zero clinical-content
change. This plan installs the safety and provenance contract every future rule must satisfy —
tri-state facts (EP-1), a fail-closed unit/range service (EP-2), exact-passage evidence (EP-3),
governed rule metadata (EP-4), a verifiable KB manifest with semantic diff (EP-5), and an adversarial
validation corpus (EP-6) — on the existing 91-rule anemia module, with a de-risking phase (EP-0)
executing the four Phase-1 SPIKEs before any code moves. **No new clinical module, no new or retuned
threshold, no new clinical claim.** EP-7 is a paper-design + documentation-truth-up phase that starts
early and seals last. Success is provenance- and behavior-based: every one of the 91 rules resolves
to an exact evidence passage or an honest `implementation-proposal` flag, `not-assessed` can never
satisfy a rule-out branch, the server fails closed on an unverifiable KB, and `clinicalApprovers[]`/
`approvedBy[]` ship structurally-ready but honestly empty (D-4).

## Implementation Strategy

### Architecture Sequence

This is a deterministic, evidence-linked pipeline, not a layered CRUD feature — no routers/services/
repositories/DTOs apply. The sequence follows the phase boundaries in the decisions block (§1):
de-risk → semantics (tri-state, units) → provenance → governance → attestation → adversarial
validation → contract/docs.

1. **De-risk & align** (EP-0) — must resolve before any WP1/WP2/WP5 design is finalized.
2. **Tri-state facts** (EP-1) ∥ **Units & ranges** (EP-2) — disjoint files, one shared seam line, one
   converged safety `council-review` gate before EP-3.
3. **Evidence provenance** (EP-3) → **Rule governance** (EP-4) — strict serial edge: EP-4's
   `sourcePassageId` references passage IDs EP-3 mints.
4. **Manifest & semantic diff** (EP-5) — attests to EP-3+EP-4's output; signing an unfinished KB is
   meaningless.
5. **Adversarial validation corpus** (EP-6) — proves the substrate against a manifest-verified KB.
6. **Review contract & docs** (EP-7) — paper design starts in EP-0, docs finish after EP-6.

### Parallel Work Opportunities

- **EP-1 ∥ EP-2** — disjoint file ownership (`ruleEngine.js`/`facts.anemia.js`/`patient-input.schema.json`
  vs. `units.js`/`ranges/registry.js`/`reference-range.schema.json`). One shared touchpoint:
  `modules/anemia/ranges.js:42` (`menstruating === true`). Per **R-P3**, `integration_owner = EP-1`'s
  executor; EP-2 verifies but never edits that line — see EP-1-T7/EP-2-T5 (seam tasks) in the phase
  files.
- **EP-7 ∥ everything** — paper design (review-record contract) and doc updates have no code
  dependency. Formally depends only on EP-0; starts there and finishes after EP-6 once the shipped
  truth is known (scheduled last in the wave list to avoid re-touching docs mid-flight).
- **EP-0's `rf` runs (RF-EV-002, REG-002) ∥ everything** — external research, no code dependency;
  launched in EP-0 so results land before EP-2 (ranges) and EP-7 (rights review) need them.
- **Strictly serial**: EP-3 → EP-4 → EP-5 → EP-6. Each consumes the prior's output artifact.

### Critical Path

**EP-0 → EP-1 → EP-3 → EP-4 → EP-5 → EP-6.** EP-2 rejoins before EP-3 (parallel with EP-1, same
convergence gate). EP-7 floats (starts EP-0, seals after EP-6). See the dependency map in the
decisions block §5 for the full mermaid graph; the Phase Summary table below is this plan's
canonical orchestration index.

### Phase Summary

| Phase | Title | Estimate | Target Subagent(s) | Model(s) | Notes |
|-------|-------|---------:|--------------------|----------|-------|
| EP-0 | De-risk & align | 9 pts | general-purpose, backend-architect, artifact-tracker | sonnet, fable, gpt-5.6-sol (codex exec), haiku | 4 SPIKEs + DEF-1 (D-2) + CI hardening (OQ-6, moved in) + DEF-2 promotion |
| EP-1 | Tri-state fact model | 13 pts | backend-architect, general-purpose, code-reviewer | opus (design), sonnet (execution) | Parallel with EP-2; owns the EP-1/EP-2 seam (R-P3) |
| EP-2 | Units & range registry | 8 pts | backend-architect, code-reviewer | sonnet | Parallel with EP-1; R-P4 runtime smoke (browser unit-rejection) |
| EP-3+EP-4 | Evidence provenance + rule governance | 15 pts | general-purpose, documentation-writer, artifact-validator | sonnet, haiku (codemod), gpt-5.6-terra (audit) | Strict serial edge (sourcePassageId) |
| EP-5 | Manifest & semantic diff | 10 pts | backend-architect, code-reviewer | sonnet, gpt-5.6-sol (adversarial) | SPIKE-006 signing branch documented |
| EP-6 | Adversarial validation corpus | 9 pts | general-purpose, adversarial reviewer | sonnet, fable (dangerous-miss review) | Consumes ARC's 10 DM-* families |
| EP-7 | Review contract & docs | 4 pts | documentation-writer, artifact-tracker | sonnet (contract), haiku (docs) | Fixes stale `data/*.json` refs + test count |
| **Total** | — | **68 pts** | — | — | — |

> Full task tables, per-task ACs, and model/effort routing live in the phase files linked below.
> Estimation rationale (H1–H6) lives in the decisions block §4; this plan carries per-phase anchors
> only.

## Binding Constraints (D-1..D-5) — not open for re-litigation

These five decisions from the decisions block constrain every phase. Each has a testable AC and at
least one verifying task, per phase file.

| Constraint | Statement | Verifying task(s) |
|---|---|---|
| **D-1** | No new clinical claims; only provenance metadata + honest missingness change. Any behavior change outside AC-D3's enumeration is a no-go. | EP-1-T9 (golden-diff classification) |
| **D-2** | Evidence must be single-source before signing; DEF-1 resolution is an EP-0 prerequisite, not an EP-5 cleanup. | EP-0-T6 |
| **D-3** | Golden-output equivalence is a review gate: every diff enumerated, classified, rationalized; a diff clearing a differential on `not-assessed` is an automatic no-go. | EP-1-T6 (invariant test), EP-1-T9 (classification) |
| **D-4** | ARC output may never populate `clinicalApprovers[]`/`approvedBy[]`. **Requires a test, not a note.** | **EP-4-T3** (dedicated structural test), reinforced by EP-5-T1/T7 |
| **D-5** | Zero-runtime-dependency default; any build-time dependency requires a written rationale, never silent. | EP-2-T1 (units), EP-6-T1/T3 (property/mutation) |

## Cross-Plan Dependency: ARC Dangerous-Miss Fixtures

`docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md` **P4-T1**
converts ARC's `DM-CBC-001..DM-WORKFLOW-010` into non-patient synthetic scenario specs. This plan's
**EP-6-T4** converts the same 10 families into this repo's own executable `node:test` fixtures. **This
plan owns the executable-fixture conversion** (EP-6 is where they must actually run); the ARC Adoption
plan's P4-T1 **consumes EP-6's fixtures rather than re-deriving them**. Both plans record this edge in
`related_documents` (Risk 5 in the decisions block).

## SPIKE-003 / DEF-2 Relationship

SPIKE-003 (tri-state fact model migration, executed in EP-0-T1) is **reduce-not-merge** against
design spec DEF-2 (`docs/project_plans/design-specs/tri-state-fact-model.md`): DEF-2 already settles
the type shape (`Tri` enum, `src/facts/tristate.js` location) and rule-engine contract direction.
SPIKE-003 owns the 56-field audit, the 9 `countTrue` re-expressions, and the golden-fixture proof —
work DEF-2 explicitly does not do. **EP-0-T7** promotes DEF-2 from `maturity: shaping` to
`ready`/committed using SPIKE-003's output (migration table, aggregate decisions, operator semantics).

## SPIKE-006 Contingency (EP-5 signing scope)

SPIKE-006's charter (`docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md`)
leans toward recommending **deferral of real cryptographic signing** in favor of
`clinicalContentHash` + a `supersedes` manifest chain — expected, not guaranteed. EP-5's phase file
documents this as an explicit branch on EP-5-T1 (Branch A: hash+chain, signing deferred, expected;
Branch B: real asymmetric signing, contingent, +~3 pts) rather than assuming the outcome silently.
This plan's `estimated_points: 68` carries the Branch-A default; if SPIKE-006 recommends Branch B,
re-baseline EP-5's estimate (and this plan's total) before EP-5 proceeds.

## Plan Generator Rule Compliance (R-P1..R-P4)

- **R-P1** (no bare "all X"/"every rule" without `target_surfaces`): every structured AC carried from
  the PRD (AC-D3, AC-D4, AC-SEAM, AC-WP3-ENUM, AC-WP3-RESIL, AC-WP4-RESIL, AC-FAILCLOSED,
  AC-WP5-RESIL) enumerates concrete file/rule targets in its phase file — see EP-1/EP-3+4/EP-5.
- **R-P2** (new field ⇒ "consumer handles absence" AC): every new evidence/rule-governance/manifest
  field introduced in EP-3/EP-4/EP-5 has a companion resilience AC and task (AC-WP3-RESIL,
  AC-WP4-RESIL, AC-WP5-RESIL).
- **R-P3** (overlapping-owner phases ⇒ `integration_owner` + seam task): EP-1 ∥ EP-2 overlap at
  `modules/anemia/ranges.js:42`. `integration_owner = EP-1`. Seam tasks: EP-1-T7 (owner, writes),
  EP-2-T5 (consumer, verifies only).
- **R-P4** (UI-touching phase ⇒ runtime smoke task): EP-2 touches `src/app.js` (browser surfaces
  unit-rejection errors). EP-2-T7 is the runtime smoke task, referencing `src/app.js` and
  `src/algorithmExplorer.js`.

## Quality Gates Mapped to Roadmap Validation Ladder

Roadmap gate (`01-platform-expansion-roadmap.md:222-225`): **V1 Content + V2 Technical.**

| Gate criterion | Closed by | Status at end of this plan |
|---|---|---|
| V1: every anemia rule has an exact source passage or explicit `implementation-proposal` flag | EP-3 (passages) + EP-4 (`sourcePassageId` wiring) | **Closeable** — measurable via `validate-kb.mjs` |
| V1: dangerous-miss review by a clinical advisor signs off | EP-6-T5 (adversarial review, `fable`) | **Not closable this phase** — recorded `not_executed_owner_held` (D-4); ARC's synthetic council is not a qualifying source |
| V2: property/boundary/mutation/dangerous-miss suites green, mutation baseline defined | EP-6 | Closeable |
| V2: manifest verifies + fail-closed paths tested | EP-5 | Closeable |
| V2: semantic diff produces correct change report on a seeded change | EP-5-T3/T4 | Closeable |

Each phase file's Quality Gates section restates its own exit criteria; `npm run check` green is a
standing exit condition for every phase from EP-1 onward.

## Deferred Items & In-Flight Findings Policy

### Deferred Items Triage Table

Carried forward from Phase 0 (not this plan's own scope) — explicitly not silently dropped.

| Item ID | Category | Reason Deferred | Trigger for Promotion | Target Spec Path |
|---------|----------|------------------|------------------------|-------------------|
| DEF-6 | scope-cut | Public `moduleId` API surface — no second module registers in this phase. | Phase 2 CBC-suite kickoff | `docs/project_plans/design-specs/public-moduleid-api-surface.md` |
| DEF-7 | scope-cut | Algorithm-explainer/examples relocation — UI/static-asset concern, no WP here touches it. | When a second module's examples would collide | `docs/project_plans/design-specs/algorithm-explainers-examples-relocation.md` |
| DEF-8 | research-needed | Headless-browser runtime smoke check — EP-1/EP-2 reuse the Phase-0 shim/registry strategy that made this acceptable. | If EP-1/EP-2 substantively edit `src/app.js`/`algorithmExplorer.js` beyond today's shim boundary | `docs/project_plans/design-specs/headless-browser-runtime-smoke-check.md` |

Each item gets a DOC-006 spec-refresh task in EP-7 (EP-7-T3). `deferred_items_spec_refs` populates as
EP-7-T3 lands.

### In-Flight Findings

Lazy-creation rule applies: `.claude/findings/wave0-safety-foundation-findings.md` is **not**
pre-created. Create only on the first real plan/reality mismatch; on creation, set
`findings_doc_ref`, append to `related_documents`, and if load-bearing, add a DOC-006 row in EP-7.

### Quality Gate

EP-7 cannot be sealed until all 3 deferred items have a design-spec path in
`deferred_items_spec_refs` and, if `findings_doc_ref` is populated, the findings doc is finalized.

## Risk Summary

Full detail (rationale + mitigation) lives in the decisions block §3; condensed here with the phase
that owns each mitigation.

| Risk | Severity | Owning Phase | Mitigation |
|---|:-:|---|---|
| Tri-state migration silently changes clinical behavior | High | EP-1 | SPIKE-003 pre-decides aggregate semantics; migration table before codemod; AC-D3 gate; invariant test; safety `council-review`. |
| Semantic diff under-reports a safety-relevant change | High | EP-5 | SPIKE-005 hunts under-reporting; seeded adversarial corpus; cross-family (`gpt-5.6-sol`) adversarial pass. |
| Evidence dual-source drift defeats manifest integrity | High | EP-0 (D-2) | DEF-1 resolved before EP-3; golden-equivalence proof; `validate-kb` assertion against recurrence. |
| Overclaiming clinical approval | High | EP-4/EP-5 | D-4 binding; `clinicalApprovers[]`/`approvedBy[]` structurally empty; dedicated test (EP-4-T3). |
| Duplicated dangerous-miss work with ARC Adoption plan | Medium | EP-6 | This plan owns fixture conversion (EP-6-T4); ARC plan consumes, doesn't re-derive. |
| Atomic 91-rule schema migration | Medium | EP-4 | Schema-first → codemod → validate, single commit, explicit nulls not omission. |
| First external dependency in a zero-dep repo | Medium | EP-2, EP-6 | D-5: hand-roll by default; any dependency needs written rationale. |
| Stale IntentTree misleads execution | Low-Medium | EP-0 | Resync tracker to real state (EP-0-T8) before any build task. |

## Model Routing Notes

Full per-task routing lives in each phase file. Summary discipline (decisions block §6):
- **`fable` used exactly twice**: SPIKE-005 design (EP-0-T3) and the dangerous-miss adversarial review
  (EP-6-T5) — both open-ended safety reasoning with clinical consequence and no verifier downstream.
- **`gpt-5.6` (via `codex exec`) used as a cross-family adversarial/verification lens only**, never as
  primary author: SPIKE-005 second lens, SPIKE-006, EP-3's passage-fidelity audit, EP-5's seeded
  adversarial diff pass.
- **`haiku` carries the token-heavy mechanical load**: the 91-rule codemod (EP-4-T2), CI hardening
  (EP-0-T9), IntentTree sync (EP-0-T8), and EP-7's doc tasks — never routed to a premium model.
- **Orchestration, verdicts, and `council-review` stay on primary Claude** (opus) — never offloaded.
- Two-failure escalation: if a model fails the same leg twice, escalate up the intelligence column
  rather than retrying at tier.

## Phase Files

- [Phase 0: De-Risk & Align](./wave0-safety-foundation-v1/phase-0-derisk-and-align.md)
- [Phase 1: Tri-State Fact Model](./wave0-safety-foundation-v1/phase-1-tristate-fact-model.md)
- [Phase 2: Units & Range Registry](./wave0-safety-foundation-v1/phase-2-units-and-ranges.md)
- [Phase 3+4: Evidence Provenance & Rule Governance](./wave0-safety-foundation-v1/phase-3-4-evidence-and-governance.md)
- [Phase 5: Manifest & Semantic Diff](./wave0-safety-foundation-v1/phase-5-manifest-and-diff.md)
- [Phase 6: Adversarial Validation Corpus](./wave0-safety-foundation-v1/phase-6-validation-corpus.md)
- [Phase 7: Review Contract & Docs](./wave0-safety-foundation-v1/phase-7-review-contract-and-docs.md)

## Wrap-Up: Feature Guide & PR

Triggered automatically after EP-7 seals (all EP-7 quality gates pass). Delegate to
`documentation-writer` (haiku) to create `.claude/worknotes/wave0-safety-foundation/feature-guide.md`
per the template in `.claude/skills/planning/templates/implementation-plan-template.md` §Wrap-Up.
Required sections (≤200 lines): What Was Built; Architecture Overview (tri-state facts, fail-closed
units, exact-passage evidence, governed rules, verified manifest, adversarial corpus); How to Test
(`npm run check`; targeted `node --test` invocations for the 4 new suites); Test Coverage Summary;
Known Limitations (point to the honest `not_executed_owner_held` V1 clinical-sign-off state and the 3
deferred-item specs). Commit before opening the PR, following this repo's git workflow (`CLAUDE.md`):
branch off `main`, `npm run check` green, commit per phase, PR to `main`, `Co-Authored-By` trailer.

---

**Implementation Plan Version**: 1.0
**Last Updated**: 2026-07-19
