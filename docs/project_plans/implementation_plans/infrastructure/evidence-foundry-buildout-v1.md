---
title: 'Implementation Plan: Evidence Foundry Buildout (E0 + Pre-E1 ADRs)'
schema_version: 2
doc_type: implementation_plan
status: in_progress
created: 2026-07-19
updated: '2026-07-21'
feature_slug: evidence-foundry-buildout
feature_version: v1
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: null
scope: "Build the deterministic rf-bundle-to-kb-pack converter, migrate a 4-rule vertical\
  \ slice through it into a new cbc_suite_v1 module package, and draft the 8 pre-E1\
  \ ADRs \u2014 nothing signed, nothing clinically released."
effort_estimate: 42 pts
architecture_summary: tools/rf-bundle-to-kb-pack/ (new Node ESM CLI) reads a read-only,
  verified rf run + modules/cbc_suite_v1/authoring-decisions.yaml and stages a proposal
  kb-pack under build/kb-pack/ (gitignored); Phase 4 commits exactly 4 named rules
  from that proposal into a new modules/cbc_suite_v1/ package (module.json, index.js
  delegating deriveFacts/summarize/limitations to modules/anemia/facts.anemia.js,
  rules.json, candidates.json, evidence.json, evidence-assertions.json, rule-provenance.json)
  registered alongside modules/anemia/ in all three registries; modules/anemia/ itself
  is untouched except evidence-registry unification (src/evidence.js).
related_documents:
- docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md
- docs/project_plans/expansion/rf-handoff/RESULTS.md
- docs/project_plans/expansion/rf-handoff/README.md
- docs/project_plans/expansion/00-expansion-plan.md
- .claude/worknotes/evidence-foundry-buildout/decisions-block.md
- .claude/worknotes/evidence-foundry-buildout/estimation-sanity.md
- docs/project_plans/human-briefs/evidence-foundry-buildout.md
- .claude/findings/evidence-foundry-buildout-findings.md
references:
  user_docs: []
  context: []
  specs:
  - schemas/rule.schema.json
  - schemas/candidate.schema.json
  related_prds:
  - docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
spike_ref: null
adr_refs: []
deferred_items_spec_refs: []
findings_doc_ref: .claude/findings/evidence-foundry-buildout-findings.md
charter_ref: null
changelog_ref: null
changelog_required: true
test_plan_ref: null
plan_structure: independent
progress_init: auto
owner: Nick Miethe
contributors:
- Opus orchestrator
- implementation-planner
priority: high
risk_level: high
category: infrastructure
tags:
- implementation
- evidence-foundry
- research-foundry
- kb-pipeline
- converter
- infrastructure
milestone: null
commit_refs: []
pr_refs: []
files_affected:
- tools/rf-bundle-to-kb-pack/**
- modules/cbc_suite_v1/module.json
- modules/cbc_suite_v1/index.js
- modules/cbc_suite_v1/authoring-decisions.yaml
- modules/cbc_suite_v1/evidence.json
- modules/cbc_suite_v1/evidence-assertions.json
- modules/cbc_suite_v1/candidates.json
- modules/cbc_suite_v1/rules.json
- modules/cbc_suite_v1/rule-provenance.json
- modules/cbc_suite_v1/reference-ranges.json
- modules/anemia/evidence.json
- src/evidence.js
- src/modules/registry.js
- src/facts/registry.js
- scripts/validate-kb.mjs
- schemas/rule.schema.json
- schemas/evidence-assertions.schema.json
- schemas/rule-provenance.schema.json
- schemas/authoring-decisions.schema.json
- schemas/release-manifest.schema.json
- tests/*.test.mjs
- tests/fixtures/**
- .gitignore
- docs/architecture.md
- docs/adr/*.md
- docs/project_plans/design-specs/*.md
- CHANGELOG.md
wave_plan:
  serialization_barriers: []
  phases:
  - id: P1
    depends_on: []
    isolation: shared
    parallelizable: false
    provider: claude
    model: sonnet
    effort: adaptive
    files_affected:
    - modules/cbc_suite_v1/module.json
    - modules/cbc_suite_v1/index.js
    - modules/cbc_suite_v1/rules.json
    - modules/cbc_suite_v1/candidates.json
    - modules/cbc_suite_v1/evidence.json
    - modules/cbc_suite_v1/reference-ranges.json
    - src/modules/registry.js
    - src/facts/registry.js
    - src/evidence.js
    - scripts/validate-kb.mjs
    - tests/fixtures/**
    - .gitignore
    - .claude/worknotes/evidence-foundry-buildout/path-mapping.md
  - id: P2
    depends_on:
    - P1
    isolation: shared
    provider: claude
    model: sonnet
    effort: adaptive
    owner_skills: []
    files_affected:
    - tools/rf-bundle-to-kb-pack/**
    - tests/ef-converter-invariants.test.mjs
  - id: P3
    depends_on:
    - P2
    isolation: shared
    provider: claude
    model: sonnet
    effort: adaptive
    files_affected:
    - tools/rf-bundle-to-kb-pack/**
    - modules/cbc_suite_v1/authoring-decisions.yaml
    - schemas/evidence-assertions.schema.json
    - schemas/rule-provenance.schema.json
    - schemas/authoring-decisions.schema.json
    - tests/ef-converter-propose.test.mjs
  - id: P4
    depends_on:
    - P3
    isolation: shared
    provider: claude
    model: sonnet
    effort: adaptive
    files_affected:
    - modules/cbc_suite_v1/rules.json
    - modules/cbc_suite_v1/candidates.json
    - modules/cbc_suite_v1/evidence.json
    - modules/cbc_suite_v1/evidence-assertions.json
    - modules/cbc_suite_v1/rule-provenance.json
    - tests/ef-cbc_suite_v1-positive.test.mjs
    - tests/ef-cbc_suite_v1-negative.test.mjs
    - tests/ef-cbc_suite_v1-boundary.test.mjs
    - tests/ef-cbc_suite_v1-missingness.test.mjs
    - tests/ef-cbc_suite_v1-dangerous-miss.test.mjs
  - id: P5
    depends_on:
    - P4
    isolation: shared
    provider: claude
    model: sonnet
    effort: adaptive
    files_affected:
    - tools/rf-bundle-to-kb-pack/**
    - schemas/release-manifest.schema.json
    - scripts/validate-kb.mjs
    - tests/ef-converter-determinism.test.mjs
    - tests/ef-converter-manifest.test.mjs
  - id: P6
    depends_on:
    - P2
    isolation: shared
    provider: claude
    model: sonnet
    effort: adaptive
    owner_skills:
    - create-adr
    files_affected:
    - docs/adr/0001-canonical-authoring-model-rule-schema-v2.md
    - docs/adr/0002-exact-passage-storage-licensing.md
    - docs/adr/0003-terminology-local-lab-profile-ownership.md
    - docs/adr/0004-clinical-approval-identity-adjudication.md
    - docs/adr/0005-kb-serialization-signing-key-custody.md
    - docs/adr/0006-validation-data-boundary-deidentification.md
    - docs/adr/0007-surveillance-cadence-materiality-classes.md
    - docs/adr/0008-pathb-hardening-vs-native-adapter.md
  - id: P7
    depends_on:
    - P5
    - P6
    isolation: shared
    provider: claude
    model: haiku
    effort: adaptive
    files_affected:
    - CHANGELOG.md
    - docs/architecture.md
    - docs/project_plans/design-specs/*.md
    - .claude/worknotes/evidence-foundry-buildout/rfup-external-routing-note.md
  waves:
  - - P1
  - - P2
  - - P3
    - P6
  - - P4
  - - P5
  - - P7
---

# Implementation Plan: Evidence Foundry Buildout (E0 + Pre-E1 ADRs)

**Plan ID**: `IMPL-2026-07-19-evidence-foundry-buildout`
**Date**: 2026-07-19
**Author**: `implementation-planner` agent (sonnet), expanding an Opus-authored decisions block
**Human Brief**: `docs/project_plans/human-briefs/evidence-foundry-buildout.md` (Tier 3, required — not yet authored; this pointer is load-bearing for the next authoring pass). Its §2 Estimation Sanity Check is pre-staged at `.claude/worknotes/evidence-foundry-buildout/estimation-sanity.md` — migrate that content verbatim when the brief is created.
**Related Documents**:
- **PRD**: `docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md` (FR-1..FR-25, OQ-1..OQ-7)
- **Decisions Block** (binding, not contradicted below): `.claude/worknotes/evidence-foundry-buildout/decisions-block.md`
- **Design spec**: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` — every task below cites a section anchor (`02 §N.N`)
- **ADRs**: none exist yet; Phase 6 authors all 8 at `status: proposed` (see Phase 6 file)

**Complexity**: Large (new converter tool + new module package + 8 ADRs; zero clinical release)
**Total Estimated Effort**: 42 pts
**Provider**: `claude` for every task — offline deterministic build tooling, no UI, no image generation, no web research (decisions block §8).

## Executive Summary

This plan builds `tools/rf-bundle-to-kb-pack/`, a deterministic, offline Node ESM converter that turns
one verified Research Foundry evidence bundle into a schema-valid, traceable KB-pack proposal, and
proves it end to end by migrating exactly 4 named rules into a new `modules/cbc_suite_v1/` module
package with a full generated test corpus. In parallel with the projection/slice/manifest work it drafts
the 8 pre-E1 ADRs the design spec (`02 §8.5`) requires before E1 can be planned. Seven phases run on a
mostly-linear critical path (P1→P2→P3→P4→P5→P7), with Phase 6 (ADRs, docs-only) branching off Phase 2
and rejoining before Phase 7. Nothing produced here is clinically released, signed, or reachable from
any patient-facing surface: the converter's entire output is an unsigned proposal (`module.json.status:
"unsigned-stub"`), and every numeric constant in the 4 migrated rules must resolve to an exact source
passage or an explicit, reviewed `authoring-decisions.yaml` record.

## Implementation Strategy

### Architecture Sequence

This is a content-build-pipeline feature, not a layered CRUD feature. The sequence follows the data flow
the converter itself defines (`02 §4.6`'s 11 phases, compressed into this plan's 7):

1. **Foundation & fixtures** (P1) — module envelope, evidence-registry unification, schema wiring, the
   sanitized fixture bundle, and the path-mapping worknote every later task depends on.
2. **Converter core** (P2) — the CLI scaffold, hash pinning, eligibility checks, `inspect`/`verify`
   verbs, and the 15 seam-invariant tests that gate everything downstream.
3. **Projection & drafting** (P3) — evidence projections, claim-ledger eligibility routing, the
   `propose` verb, and the authoring-decisions records that make rule drafting reviewable rather than
   generative.
4. **Vertical slice + test corpus** (P4) — the 4 named rules land in `modules/cbc_suite_v1/`, with a
   full positive/negative/boundary/missingness/dangerous-miss corpus.
5. **Manifest & traceability** (P5) — unsigned manifest, conversion report, minimal semantic diff, and
   the determinism double-run proof.
6. **Pre-E1 ADRs** (P6) — parallel lane, docs-only, unblocked as soon as P2 lands (does not need P3-P5's
   output; it documents decisions those phases *deliberately deferred*, not decisions they made).
7. **Docs & deferral closure** (P7) — CHANGELOG, `docs/architecture.md`, and one design-spec stub per
   deferred item.

### Parallel Work Opportunities

**P6 ∥ P3-P5**, starting once P2 completes: Phase 6 is 8 independent Markdown ADR files under
`docs/adr/`; it shares zero files with Phases 3-5's `tools/rf-bundle-to-kb-pack/**` and
`modules/cbc_suite_v1/**` work. No serialization barrier applies (verified: no file appears in both
Phase 6's and any of Phases 3-5's `files_affected`). Within Phase 3, the evidence-projection tasks
(P3-T2, P3-T3) and the claim-ledger/candidate-drafting tasks (P3-T4, P3-T5) touch disjoint output files
and may be worked in either order by the same executor, but are not split into separate waves here
because they share the same `tools/rf-bundle-to-kb-pack/**` source tree (a real, not merely
file-listing, coupling) — see the Phase 1-2 / 3-5 files for per-task sequencing notes.

### Critical Path

**P1 → P2 → P3 → P4 → P5 → P7** (34 of 42 pts). P6 (5 pts, ADRs) is off the critical path — it starts
after P2 and must only complete before P7 opens, giving it the full P3+P4+P5 duration (21 pts) of slack.

### Phase Summary

| Phase | Title | Estimate | Target Subagent(s) | Model(s) | Provider | Profile | Notes |
|-------|-------|---------:|---------------------|----------|----------|---------|-------|
| 1 | Foundation & fixtures | 5 pts | general-purpose executor; task-completion-validator gate | sonnet | claude | — | Blocking path-mapping worknote (FR-5) is P1-T1; everything downstream cites current-tree paths only |
| 2 | Converter core (EF-WP0) | 8 pts | backend-architect (design), general-purpose executor (build); task-completion-validator gate; **karen milestone review** | sonnet | claude | — | Integration owner: backend-architect. Seam task: P2-T8 (15 invariant tests) |
| 3 | Projection & drafting | 8 pts | general-purpose executor; task-completion-validator gate | sonnet | claude | — | Runs after P2; parallel lane P6 opens alongside it |
| 4 | Vertical slice + test corpus | 8 pts | general-purpose executor (rules), testing specialist (test corpus); task-completion-validator gate | sonnet | claude | — | Integration owner: general-purpose executor. Seam task: P4-T9 |
| 5 | Manifest & traceability | 5 pts | general-purpose executor; task-completion-validator gate; **karen milestone review** | sonnet | claude | — | E0 functionally complete at this gate |
| 6 | Pre-E1 ADRs | 5 pts | documentation-writer; task-completion-validator gate | sonnet | claude | — | Parallel lane; opens after P2, must close before P7 |
| 7 | Docs & deferral closure | 3 pts | documentation-writer; task-completion-validator gate; **karen milestone review** | haiku (CHANGELOG/pointers), sonnet (design-spec stubs) | claude | — | Feature-end gate; deferred-items triage table sealed here |
| **Total** | — | **42 pts** | — | — | — | — | Matches decisions block §6 H4 floor exactly (±0%) |

**Model column conventions**: Claude-only phases list the single model; Phase 7 lists both because the
decisions block routes CHANGELOG/pointer tasks to haiku and design-spec-stub tasks to sonnet within the
same phase (per-task `Model` column in the Phase 6-7 file is authoritative).

> Estimation rationale (H1-H6, bottom-up sums, anchor comparison) lives in
> `.claude/worknotes/evidence-foundry-buildout/estimation-sanity.md` — this plan retains only per-task
> point estimates.

### Phase Detail Files

Full task tables, acceptance criteria, and per-task Model/Effort assignments live in the phase files
(this parent stays under the 800-line guideline per `file-structure.md`):

- **[Phase 1-2: Foundation & Converter Core](./evidence-foundry-buildout-v1/phase-1-2-foundation-converter.md)**
- **[Phase 3-5: Projection, Slice & Manifest](./evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md)**
- **[Phase 6-7: ADRs & Docs](./evidence-foundry-buildout-v1/phase-6-7-adrs-docs.md)**

## Decisions & OQ Resolutions

The decisions block (§9, §11) leaves OQ-1 through OQ-4 for this plan to resolve and rules OQ-5 through
OQ-7 directly (encoded as tasks below, not re-litigated). All four resolutions below are **binding** —
phase executors must not reopen them without an explicit new decisions block entry.

**OQ-1 — Module identity for the slice.** The 4-rule vertical slice lands inside `modules/cbc_suite_v1/`,
**not** `modules/anemia/` (matches the PRD's own FR-6/FR-15/FR-21 file paths and the CLAUDE.md "anemia is
the wedge, CBC/cytopenia suite is the product" framing). `modules/anemia/` stays untouched — it is both
the migration source (read-only) and the FR-21 semantic-diff baseline. Per `docs/architecture.md` §2a,
a module's `index.js` hook descriptor must export a real (not stub) `deriveFacts`/`summarize`/
`limitations` triple. Resolution: `modules/cbc_suite_v1/index.js` implements this by **explicit
cross-module delegation** — it imports and calls `modules/anemia/facts.anemia.js`'s `deriveFacts` (and
the equivalent `summarize`/`limitations` logic) directly, rather than duplicating or stubbing it. This is
deliberate, not a placeholder: all 4 slice rules consume exactly the fact shape `anemia` already derives
(hemoglobin, ferritin, morphology, marrow-flag facts); CBC-Suite-specific fact derivation is out of scope
for E0 and is one of E1's build items (`02 §7.3` item 7). `modules/cbc_suite_v1/reference-ranges.json`
is created as a byte-identical copy of `modules/anemia/reference-ranges.json` to satisfy the module
package-shape contract, but `cbc_suite_v1` is **not** separately registered in `src/ranges/registry.js`
in E0 — the delegated `deriveFacts` call already resolves ranges through `anemia`'s existing
registration. `cbc_suite_v1` **is** registered in `src/modules/registry.js` and `src/facts/registry.js`
(so `scripts/validate-kb.mjs` and the module package contract treat it as a real, loadable module).
`DEFAULT_MODULE_ID` in `src/modules/registry.js` stays `'anemia'` — registering a second module trips
that file's existing tripwire comment ("the day a second module is registered... it must become a real
selection decision"), and P1-T3's acceptance criteria requires updating that comment to record *why*
`'anemia'` remains correct: E0 adds zero client-selectable moduleId surface (R-P4/PRD §6.1 confirms no
UI/API change), so there is still nothing to select between.

**OQ-2 — Fixture-seeding run.** `RF-CBC-001`, not `REG-001`. The PRD's own §8 Dependencies section
already forecloses `REG-001`/`REG-004`: both carry an unresolved legal-review flag and "neither may seed
a clinical-rule fixture until that review clears" — which rules out the decisions block §9's tentative
"prefer REG-001-class" framing now that the PRD has surfaced this constraint. `RF-CBC-001` (12 source
cards, 87 claims) is the only remaining candidate capable of seeding FR-16's real 4-rule migration.
Its content-rights status for verbatim passage commitment is not yet confirmed, so P1-T6's fixture
task defaults to the design spec's rights-restricted fallback (`02 §4.10`): immutable passage hash +
precise selector, not full text, unless the specific passages selected for the 4 slice rules are
positively confirmed rights-clear during fixture creation.

**OQ-3 — Landing path for `evidence-assertions.json` / `rule-provenance.json`.** `modules/cbc_suite_v1/`
(not `data/`, not a pack-only location) — confirmed against `docs/architecture.md` §2a: each module is
"a self-contained package... holding rules.json, candidates.json, evidence.json,
reference-ranges.json, module.json..., and index.js," and `scripts/validate-kb.mjs` already resolves
all per-module content exclusively under `modules/<id>/`, never `data/`. The new artifact types are
package-shape extensions of that same contract, not a parallel system. `rule-provenance.json` lands at
`modules/cbc_suite_v1/rule-provenance.json`, joined to `rules.json` by rule `id` (FR-15).

**OQ-4 — Semantic-diff minimal scope.** Confirmed: rule-`id`-level added/removed/changed detection only,
comparing the `cbc_suite_v1` proposal against `modules/anemia/rules.json` — exactly as FR-21 already
states; no impact-graph traversal. Because `cbc_suite_v1` is a brand-new module, this yields a trivially
correct "4 added, 0 removed, 0 changed" result for E0. That triviality is expected and acceptable: the
E0 deliverable is the semantic-diff.json **schema and plumbing** (deterministic, sorted, content-hash
comparable), not a materially interesting diff — E1 is where a second proposal round against an
*existing* `cbc_suite_v1/rules.json` would produce a non-trivial result. This boundary is confirmed
sufficient for FR-19's conversion-report enumeration; if Phase 5 execution finds it insufficient, escalate
rather than silently expanding scope (per the PRD's own OQ-4 instruction).

**OQ-5, OQ-6, OQ-7 (decisions block §11, binding — encoded as tasks, not re-decided here)**: generated
tests land flat under `tests/` as `ef-<module>-<category>.test.mjs` (Phase 4) and `ef-converter-<aspect>.test.mjs`
(Phases 2, 3, 5) — the `npm test` glob (`tests/*.test.mjs`) is never touched (P1-T1 confirms this in the
path-mapping worknote). `build/` is added to `.gitignore` in P1-T7; `build/kb-pack/` output is generated,
never committed; committed golden/fixture outputs for converter tests live under `tests/fixtures/`
instead. Four new schema files are authored and wired into `scripts/validate-kb.mjs`:
`schemas/evidence-assertions.schema.json`, `schemas/rule-provenance.schema.json`,
`schemas/authoring-decisions.schema.json` (all P3), and `schemas/release-manifest.schema.json` (P5, gated
on `build/kb-pack/` existing since that directory is gitignored/ephemeral). `module.json`'s new §3.2
envelope fields get field-presence validation only (matching the existing pattern for
`modules/anemia/module.json`), not a fifth JSON-Schema file — the decisions block's OQ-7 ruling names
exactly four new schema types, and this plan does not expand that set.

## Deferred Items & In-Flight Findings Policy

### Deferred Items Triage Table

Every row below gets exactly one Phase 7 task authoring its `Target Spec Path` (full task table in the
Phase 6-7 file). Categories per `deferred-items-and-findings.md`: `research` \| `prereq` \| `design` \|
`tech-debt` \| `policy`.

| Item ID | Category | Reason Deferred | Trigger for Promotion | Target Spec Path |
|---------|----------|------------------|------------------------|-------------------|
| DF-E1-01 | prereq | Clinical review portal/workflow (L) needs named credentialed reviewers and a review-state model that don't exist until E1 planning | E1 plan approved + reviewer roles named | `docs/project_plans/design-specs/clinical-review-portal-workflow.md` |
| DF-E1-02 | prereq | Full CBC 12-angle live research operation needs a resourced discovery lane (Path-B hardening or native adapter) this plan does not build | ADR-8 resolved + E1 plan approved | `docs/project_plans/design-specs/cbc-12-angle-research-operation.md` |
| DF-E1-03 | prereq | Upstream `rf` validators (pediatric extraction-completeness, exact-passage hard-gate) are changes to the `rf` repo, outside this repo's scope | RFUP routing yields an accepted upstream change | `docs/project_plans/design-specs/upstream-rf-validators-pediatric.md` |
| DF-E1-04 | prereq | Retrospective validation harness (L) needs a signed release and real adjudicated case data this feature does not produce | Signed E1 release candidate exists | `docs/project_plans/design-specs/retrospective-validation-harness.md` |
| DF-E1-05 | design | FHIR/terminology emitters (L) need ADR-3's terminology-ownership decision resolved (currently `proposed`, not `accepted`) before a mapping contract can be designed | ADR-3 accepted | `docs/project_plans/design-specs/fhir-terminology-emitters.md` |
| DF-E1-06 | design | Signed release + key custody needs ADR-5's signing/key-custody decision resolved before implementation | ADR-5 accepted | `docs/project_plans/design-specs/signed-release-key-custody.md` |
| DF-E1-07 | tech-debt | Property/mutation/semantic-diff CI expansion hardens what E0 ships as a minimal id-level diff (OQ-4) and 15-invariant test set; expansion is follow-on hardening, not new capability | E1 rule-schema v2 migration begins | `docs/project_plans/design-specs/property-mutation-semantic-diff-ci.md` |
| DF-E2-01 | prereq | Surveillance/update/registry engine needs a signed, registered E1 release to surveil and re-run against | E1 signed release + registry exist | `docs/project_plans/design-specs/surveillance-update-registry-engine.md` |
| DF-E2-02 | prereq | Production monitoring needs a live deployment; E0/E1 produce no deployed release to monitor | First E1 release activated | `docs/project_plans/design-specs/production-monitoring-telemetry.md` |
| DF-E2-03 | prereq | Withdraw/rollback machinery needs a registry of signed releases to roll back between; none exists before E1 | E1 signed release registry exists | `docs/project_plans/design-specs/withdraw-rollback-machinery.md` |
| DF-EXT-01 | policy | 7 RFUP upstream-`rf` enhancements are governance/routing decisions for the `agentic_meta_dev`/`research-foundry` repos, not implementation work in this repository (`rf-handoff/README.md` §6) | N/A — routed via `op story`, tracked externally | `.claude/worknotes/evidence-foundry-buildout/rfup-external-routing-note.md` (consolidated routing note, not a design-spec — per this plan's explicit instruction) |

### In-Flight Findings

Not pre-created. `findings_doc_ref` stays `null` until the first real execution-time finding, per the
lazy-creation rule in `deferred-items-and-findings.md`. If one occurs, the executing agent creates
`.claude/findings/evidence-foundry-buildout-findings.md`, sets this plan's `findings_doc_ref`, and — if
load-bearing — adds a new Phase 7 design-spec task and appends the resulting path to
`deferred_items_spec_refs`.

### Quality Gate

Phase 7 (see Phase 6-7 file, P7-GATE2 `karen` milestone) cannot close until: every row above has its
`Target Spec Path` authored (or the RFUP row's consolidated note, per its explicit exception);
`deferred_items_spec_refs` frontmatter lists all 10 spec paths; `findings_doc_ref` is either `null` (no
findings) or finalized at `status: accepted`.

## Plan Generator Rule Compliance (R-P1..R-P4)

- **R-P1** (no vague "all/across"): every phase task table (phase files) enumerates concrete file paths,
  rule names (the 4 named slice rules), and bounded lists (8 ADRs, 11 deferred-item tasks) — no
  unbounded "all rules" / "across the KB" phrasing appears anywhere in this plan, matching the PRD.
- **R-P2 analog** (new artifact type → "validator handles missing/absent field" AC): applied to every
  task that introduces a new schema-validated artifact type. `schemas/evidence-assertions.schema.json`,
  `schemas/rule-provenance.schema.json`, and `schemas/authoring-decisions.schema.json` (Phase 3), and
  `schemas/release-manifest.schema.json` (Phase 5) each carry an explicit AC that a fixture missing a
  required field is rejected (non-zero exit / validation error), never silently accepted. See the
  per-task ACs in the Phase 1-2 and Phase 3-5 files.
- **R-P3** (≥2 owner specialties + overlapping `files_affected` → `integration_owner` + seam task):
  applied to **Phase 2** (integration owner: backend-architect; seam task P2-T8, the 15-invariant test
  suite, is the explicit join point between P2-T1's design and P2-T2..T7's builds) and **Phase 4**
  (integration owner: general-purpose executor; seam task P4-T9 runs the full engine-test suite proving
  the engineer-committed rules and the testing-specialist-generated corpus agree). See the Phase 1-2 and
  Phase 3-5 files for both.
- **R-P4** (UI-touching phases need a runtime-smoke task): **not applicable**. No `*.tsx`/`*.jsx`/HTML
  template file appears in any phase's `files_affected`; this feature makes zero changes to the
  clinician SPA (`src/app.js` is not touched by any task in this plan) or any API response shape a
  client consumes (`server.mjs`, `openapi.yaml` are not touched). Confirmed against the PRD's own R-P4
  "does not apply" note.

## Risk Mitigation

Expanded from decisions block §5; per-phase mitigations also appear in each phase's Quality Gates.

| Risk | Impact | Likelihood | Mitigation Strategy |
|------|:------:|:----------:|----------------------|
| Seam-invariant regression (converter silently accepts bad input) | High | Medium | Phase 2 exit gate requires 1 executable test per each of the 15 seam invariants (`02 §2.3`, P2-T8); fail-closed default in the error taxonomy (P2-T5); tests assert zero network/zero LLM calls occur |
| Invented-threshold leak via drafting phases | High | Medium | Every numeric in a generated rule must carry a passage locator resolvable in `evidence-assertions.json` (P3-T3); Phase 4's slice-migration ACs reject any rule with an unresolved evidence reference |
| Stale design-spec paths executed literally | Medium | Medium | P1-T1's path-mapping worknote is the first task in the plan and is a hard blocker for every Phase 2+ task; every task row below already cites current-tree paths, not `data/*` |
| Fixture provenance / content-rights exposure | Medium | Low | OQ-2's resolution defaults to hash+selector-only unless rights are positively confirmed (P1-T6); any restricted passage routes to ADR-2 rather than being committed |
| Rule-schema v2 scope creep into E0 | Medium | Low | Every generated `rules.json` projection validates against the existing strict 5-field `schemas/rule.schema.json`, `additionalProperties: false` (P1-T5, P4 ACs); v2 lives only in ADR-1 and its deferred spec (DF-E1-07-adjacent) |
| Determinism drift (hashes differ across runs/machines) | Medium | Low | P5-T5's double-run reproducibility gate; sorted serialization, normalized newlines, pinned Node ≥20, no timestamps in hashed content |
| Guardrail breach (autonomous clinical output, confidence framing) | High | Low | CLAUDE.md hard guardrails and the PRD's §7 non-goals are explicit `karen` milestone checks at the end of Phases 2, 5, and 7 — not assumed compliant |
| Second-module registration trips the `DEFAULT_MODULE_ID` tripwire silently | Low | Medium | OQ-1 resolution requires P1-T3 to update the tripwire comment with an explicit rationale, not leave it stale |

## Model, Provider & Profile Assignment

All tasks in the phase files carry **Model**, **Effort**, **Provider**, and **Profile** columns.
Reference: `.claude/skills/planning/references/multi-model-guidance.md` (Canonical Effort Vocabulary) and
`.claude/specs/provider-routing-spec.md §3` for the authoritative assignment procedure.

- **Model defaults**: `sonnet` for every implementation, converter, and test-authoring task; `haiku` only
  for Phase 7's CHANGELOG/pointer tasks; `sonnet` for Phase 7's design-spec-stub tasks (decisions block
  §8 — ADRs and design specs "carry architectural judgment; do not route to haiku").
- **Effort**: `adaptive` throughout, with `extended` on the small set of tasks adjacent to the two High
  risk hotspots above (seam-invariant design/tests in Phase 2; the determinism double-run gate in
  Phase 5) — see per-task `Effort` column.
- **Provider**: `claude` for all 42 pts. No external model routing — this is offline deterministic
  tooling with no UI design, no image generation, and no web-research component (decisions block §8).

## Wrap-Up: Feature Guide & PR

Triggered automatically after Phase 7 is sealed (all quality gates pass, `karen` milestone review
passed). Delegate to `documentation-writer` (haiku) to create
`.claude/worknotes/evidence-foundry-buildout/feature-guide.md` per the standard template (What Was
Built / Architecture Overview / How to Test / Test Coverage Summary / Known Limitations, ≤200 lines).
Commit the feature guide before opening the PR. PR title should name the converter and the module
scaffold, not "Evidence Foundry" generically (e.g., "Add rf-bundle-to-kb-pack converter + cbc_suite_v1
vertical slice (E0)"); derive the PR summary from this plan's Executive Summary and the CHANGELOG entry
authored in P7-T1.

---

**Progress Tracking**: `.claude/progress/evidence-foundry-buildout/` (one file per phase, created via the
`artifact-tracking` skill during execution — `progress_init: auto`).

---

**Implementation Plan Version**: 1.0
**Last Updated**: 2026-07-19
