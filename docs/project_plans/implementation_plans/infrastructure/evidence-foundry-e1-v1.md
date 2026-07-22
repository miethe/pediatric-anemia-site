---
title: "Implementation Plan: Evidence Foundry E1 \u2014 Review Workflow, Signed Preclinical\
  \ Release, Retrospective Validation"
schema_version: 2
doc_type: implementation_plan
status: in_progress
created: '2026-07-21'
updated: '2026-07-21'
feature_slug: evidence-foundry-e1
feature_version: v1
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
plan_ref: null
scope: "Build the E1 clinical-governance triad as offline fail-closed machinery: append-only\
  \ five-role review-record workflow (ADR-0004), Ed25519 sign/verify + flat release\
  \ registry (ADR-0005), and a fixtures-only retrospective validation harness behind\
  \ the ADR-0006 boundary \u2014 every human act modeled as an external gate, never\
  \ a task."
effort_estimate: 35 pts
architecture_summary: "Three new offline Node ESM CLIs following E0's tools/<name>/cli.mjs\
  \ verb-dispatch convention \u2014 tools/review-record/, tools/release-sign/, tools/retro-validate/\
  \ \u2014 built on P1's unified schema contracts (canonical review-record model,\
  \ reviewer roster, release-manifest signature slot, releases/registry.json). All\
  \ signature/approver slots ship schema-forced empty; the anemia browser path's SPIKE-006\
  \ posture is untouched."
related_documents:
- docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
- .claude/worknotes/evidence-foundry-e1-v1/decisions-block.md
- .claude/worknotes/evidence-foundry-e1-v1/planning-brief.md
- docs/adr/0004-clinical-approval-identity-adjudication.md
- docs/adr/0005-kb-serialization-signing-key-custody.md
- docs/adr/0006-validation-data-boundary-deidentification.md
- docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md
- docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md
references:
  user_docs: []
  context: []
  specs:
  - schemas/review-record.schema.json
  - schemas/module-manifest.schema.json
  - schemas/release-manifest.schema.json
  - schemas/rule.schema.json
  related_prds:
  - docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
spike_ref: docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md
adr_refs:
- docs/adr/0001-canonical-authoring-model-rule-schema-v2.md
- docs/adr/0004-clinical-approval-identity-adjudication.md
- docs/adr/0005-kb-serialization-signing-key-custody.md
- docs/adr/0006-validation-data-boundary-deidentification.md
deferred_items_spec_refs: []
findings_doc_ref: null
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
- clinical-review
- signed-release
- retrospective-validation
- infrastructure
milestone: null
commit_refs: []
pr_refs:
- '#19'
files_affected:
- tools/review-record/**
- tools/release-sign/**
- tools/retro-validate/**
- modules/cbc_suite_v1/reviews/**
- governance/reviewer-roster.yaml
- releases/registry.json
- schemas/review-record.schema.json
- schemas/reviewer-roster.schema.json
- schemas/release-manifest.schema.json
- schemas/release-registry.schema.json
- scripts/validate-kb.mjs
- docs/governance/gates-registry.md
- docs/governance/signing-ceremony-runbook.md
- docs/project_plans/SPIKEs/spike-007-retrospective-data-source.md
- tests/ef-*.test.mjs
- tests/fixtures/**
- docs/architecture.md
- docs/project_plans/design-specs/*.md
- CHANGELOG.md
wave_plan:
  serialization_barriers:
  - scripts/validate-kb.mjs
  - CHANGELOG.md
  - docs/architecture.md
  phases:
  - id: P1
    depends_on: []
    isolation: shared
    parallelizable: false
    provider: claude
    model: sonnet
    effort: adaptive
    files_affected:
    - schemas/review-record.schema.json
    - schemas/reviewer-roster.schema.json
    - schemas/release-manifest.schema.json
    - schemas/release-registry.schema.json
    - governance/reviewer-roster.yaml
    - docs/governance/gates-registry.md
    - scripts/validate-kb.mjs
    - tests/ef-review-record-migration.test.mjs
    - tests/ef-contract-forced-empty.test.mjs
    - tests/fixtures/**
    - .claude/worknotes/evidence-foundry-e1-v1/contracts-design.md
  - id: P2
    depends_on:
    - P1
    isolation: shared
    provider: claude
    model: sonnet
    effort: adaptive
    files_affected:
    - tools/review-record/**
    - modules/cbc_suite_v1/reviews/**
    - tests/ef-review-workflow.test.mjs
    - tests/ef-review-appendonly.test.mjs
    - tests/ef-review-render-smoke.test.mjs
    - tests/fixtures/ef-review-render/**
  - id: P3
    depends_on:
    - P1
    isolation: shared
    provider: claude
    model: sonnet
    effort: adaptive
    files_affected:
    - tools/release-sign/**
    - releases/registry.json
    - scripts/validate-kb.mjs
    - docs/governance/signing-ceremony-runbook.md
    - tests/ef-release-sign-verify.test.mjs
    - tests/ef-release-registry.test.mjs
    - tests/ef-release-no-keys.test.mjs
    - tests/fixtures/ef-release/**
  - id: P4
    depends_on:
    - P1
    isolation: shared
    provider: claude
    model: sonnet
    effort: adaptive
    files_affected:
    - tools/retro-validate/**
    - tests/ef-retro-boundary.test.mjs
    - tests/ef-retro-determinism.test.mjs
    - tests/ef-retro-corpus.test.mjs
    - tests/fixtures/ef-retro/**
    - docs/project_plans/SPIKEs/spike-007-retrospective-data-source.md
  - id: P5
    depends_on:
    - P2
    - P3
    - P4
    isolation: shared
    provider: claude
    model: sonnet
    effort: adaptive
    files_affected:
    - tests/ef-e2e-dryrun.test.mjs
    - docs/architecture.md
    - CHANGELOG.md
    - docs/project_plans/design-specs/*.md
    - .claude/progress/evidence-foundry-e1/**
  waves:
  - - P1
  - - P2
    - P3
    - P4
  - - P5
---

# Implementation Plan: Evidence Foundry E1 (Review Workflow · Signed Release · Retrospective Validation)

**Plan ID**: `IMPL-2026-07-21-evidence-foundry-e1`
**Date**: 2026-07-21
**Author**: `implementation-planner` agent (sonnet), expanding the Opus decisions block
**Human Brief**: `docs/project_plans/human-briefs/evidence-foundry-e1.md` (Tier 3, required — not yet
authored; must migrate PRD §6.0's gate table and §12's tensions/open questions into its owner-action
ledger)
**Related Documents**:
- **PRD**: `docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md` (FR-1..FR-31, gates G0–G4)
- **Decisions Block** (binding, not contradicted below): `.claude/worknotes/evidence-foundry-e1-v1/decisions-block.md`
- **ADRs**: ADR-0004 / ADR-0005 / ADR-0006 — all `proposed`, none accepted (gate G0)

**Complexity**: Large (three parallel workstreams over one contract phase; zero clinical release)
**Total Estimated Effort**: 35 pts (task-level sum; decisions block H4 floor = 34)
**Provider**: `claude` for every task — offline deterministic governance tooling, no UI beyond a
static render, no web research, no image generation (decisions block §6).

## Executive Summary

This plan delivers the software machinery for the E1 clinical-governance triad: (a) ADR-0004's
five-role append-only review-record workflow as files + CLI + read-only static render — no portal;
(b) ADR-0005's Ed25519 detached sign/verify tooling over E0's proven P5-T5 canonical bytes plus a
flat append-only `releases/registry.json`, with signing itself reserved to a human offline act;
(c) ADR-0006's retrospective validation harness replaying a registry-pinned candidate against
synthetic + de-identified fixtures only, emitting **software-agreement** metrics (never clinical
performance). P1 unifies all contracts (canonical review-record schema absorbing the wave0 model,
roster format, registry/manifest schemas, and the G0–G4 gates registry); P2/P3/P4 then run as three
file-disjoint parallel workstreams; P5 closes with a cross-workstream dry-run, an honesty-language
audit, docs, and deferred-item spec closure. **Nothing this plan ships is, or may be described as,
clinically validated, safe, or release-ready**: every approver/signature slot stays schema-forced
empty, every synthetic artifact is structurally marked non-qualifying, and every human act (ADR
acceptance, roster, custodian + ceremony, DUA, release authorization) is an external gate — never a
task, and never a task's exit criterion.

## Implementation Strategy

### Architecture Sequence

Not a layered web feature — a governance-contracts-first pipeline:

1. **Contracts & Gates** (P1) — one canonical review-record schema (wave0 model mapped in, migration
   test), roster schema, release-manifest signature-slot + registry schemas, seeded forced-empty
   violation fixtures, and the gates registry documenting G0–G4 (including the A2 SPIKE-006
   reconciliation record in G0's ADR-0005 entry).
2. **Three parallel workstreams** (P2 ∥ P3 ∥ P4, disjoint file ownership) — review CLI/store/render/
   dry-run (`tools/review-record/`); sign/verify/registry/runbook (`tools/release-sign/`,
   `releases/`); harness/boundary/metrics/charter (`tools/retro-validate/`).
3. **Integration, honesty audit, docs** (P5) — end-to-end dry-run (review cycle → test-key release
   candidate → pinned harness replay), honesty-language audit, architecture/CHANGELOG, deferred-item
   design-spec updates, feature-end `karen`.

### Parallel Work Opportunities

**P2 ∥ P3 ∥ P4 after P1 exit.** File ownership is disjoint by construction: `tools/review-record/` +
`modules/cbc_suite_v1/reviews/` (P2) vs `tools/release-sign/` + `releases/` (P3) vs
`tools/retro-validate/` (P4). The only shared surface — `schemas/*` + `scripts/validate-kb.mjs` — is
owned entirely by P1 (integration owner: backend-architect); the single post-P1 validator change
(P3-T6, verifier-surface wiring) is the declared seam task, and P4's harness-local schemas live under
`tools/retro-validate/schemas/` precisely so no second phase touches the barrier file in wave 2.
Each parallel phase has its own `task-completion-validator` gate, so a lagging workstream does not
block the others' review.

### Critical Path

**P1 → max(P2, P3, P4) → P5** = 5 + 9 + 5 = **19 pts of serialized depth** against 35 total. P2 and P3
are 8 pts and P4 is 9 pts, so all three lanes are co-critical; any one slipping delays P5.

### Phase Summary

| Phase | Title | Estimate | Target Subagent(s) | Model(s) | Provider | Profile | Notes |
|-------|-------|---------:|---------------------|----------|----------|---------|-------|
| 1 | Contracts & Gates | 5 pts | backend-architect (design, integration owner), general-purpose (build); task-completion-validator gate; **karen milestone review (P1 exit)** | sonnet | claude | — | R5 model unification lands here, before any machinery; seam task P1-T7 |
| 2 | Review workflow machinery | 8 pts | general-purpose (Node CLI), documentation-writer (banner copy); task-completion-validator gate | sonnet | claude | — | Parallel wave 2; includes FR-8 static render + R-P4 smoke (P2-T7) |
| 3 | Signed release machinery | 8 pts | general-purpose (Node crypto); task-completion-validator gate | sonnet | claude | — | Parallel wave 2; `extended` effort on crypto/determinism tasks; owns the sole post-P1 validate-kb.mjs change (P3-T6 seam) |
| 4 | Retrospective validation harness | 9 pts | general-purpose (harness), spike-writer (charter); task-completion-validator gate | sonnet | claude | — | Parallel wave 2; fixtures-only, boundary schema-enforced; SPIKE-007 charter authored here |
| 5 | Integration, honesty audit, docs | 5 pts | general-purpose (integration), documentation-writer (docs/specs); task-completion-validator gate; **karen feature-end review** | sonnet (haiku for CHANGELOG/pointer tasks) | claude | — | Cross-workstream dry-run is the R-P3 join seam; deferred-items table sealed here |
| **Total** | — | **35 pts** | — | — | — | — | Task-level sum (P4 table sums to 9); decisions block §4 estimated 34 — treat 34 as the floor (H4) |

**Model column conventions**: Claude-only throughout; Phase 5 lists both models because CHANGELOG/
frontmatter mechanics route to haiku and design-spec/audit work to sonnet (per-task `Model` column in
the phase file is authoritative).

> Estimation rationale (anchors H1–H6, E0 −20% delta) lives in the decisions block §4 and will
> migrate into the Human Brief's Estimation Sanity Check; this plan retains per-task points only.

### Phase Detail Files

Full task tables, acceptance criteria, and per-task Model/Effort assignments live in the phase files
(this parent stays under the 800-line guideline):

- **[Phase 1: Contracts & Gates](./evidence-foundry-e1-v1/phase-1-contracts-gates.md)**
- **[Phases 2–4: Review · Release · Retro Workstreams](./evidence-foundry-e1-v1/phase-2-4-workstreams.md)**
- **[Phase 5: Integration, Honesty Audit & Docs](./evidence-foundry-e1-v1/phase-5-integration-docs.md)**

## External Human Gates (G0–G4 — gates, never tasks)

Binding (PRD §6.0 + decisions block §5, rulings R2/R4). The five gates are **external
human-blocked states**: G0 ADR ratification; G1 named credentialed reviewer roster; G2 signing
custodian + offline key ceremony; G3 data-source SPIKE verdict + data-partner DUA; G4 release
authorizer. Rules encoded across this plan:

- No task below claims to clear, advance, or partially satisfy a gate. No task's exit criteria
  depend on a gate being cleared. Progress tracking represents G0–G4 as externally-blocked states
  (P5-T5), mirroring the P5 "owner-blocked" precedent.
- Every gated behavior ships **schema-forced inert**: `approvedBy[]`/`clinicalApprovers[]` stay
  `maxItems: 0`; the release-candidate `signature` slot is const/forced-empty pre-G2; roster entries
  are synthetic-only (`synthetic: true` const) pre-G1; real-data harness input is structurally
  rejected pre-G3; `unsigned-stub → release-ready` remains schema-impossible pre-G1/G4.
- **A2 (binding orchestrator adjudication)**: the P1 gates-registry task (P1-T6) must record, in
  gate G0's ADR-0005 entry, the SPIKE-006 reconciliation condition — the signing custodian must be a
  distinct authority from the release author, and CI/agents never hold keys.
- **A1 (binding orchestrator adjudication)**: design-spec §7.3 item 5 (methodologist/skeptic
  evidence council with consensus policy) is an **external upstream rf/ARC dependency** (RFUP
  routing). This plan contains **zero** in-repo council tasks; the gates registry records it as an
  external dependency only.

## Decisions & OQ Resolutions

Binding for phase executors; do not reopen without a new decisions-block entry. Resolves the
decisions block's OQ-1..OQ-6 and the PRD's plan-decision OQs (PRD OQ-1/OQ-2/OQ-5/OQ-6).

**OQ-1 — CLI shape (decisions block): per-workstream tool dirs, E0 convention.** E0's actual
tooling layout is one directory per capability under `tools/<name>/` containing a Node ESM `cli.mjs`
with verb dispatch (`node tools/rf-bundle-to-kb-pack/cli.mjs inspect|verify|propose`), pinned deps,
and a README documenting the internal module boundary — no umbrella binary, no npm script per verb.
E1 matches it exactly: `tools/review-record/cli.mjs` (verbs `scaffold` · `validate` · `list` ·
`render` · `dry-run`), `tools/release-sign/cli.mjs` (verbs `manifest` · `register` · `sign` ·
`verify`), `tools/retro-validate/cli.mjs` (verbs `check-fixtures` · `run` · `report`). No new npm
scripts; structural validation joins the existing `npm run validate` chain via `scripts/validate-kb.mjs`
(P1-T7, P3-T6 only). This also answers the E0-conventions question the decisions block delegated.

**OQ-2 — Review-record store layout and signature form.** Layout per ADR-0004 §Decision item 1:
one append-only YAML file per review act at `modules/<module_id>/reviews/<review_id>.yaml`, with
`review_id = rr-<seq4>-<role>` (role ∈ `clinical-1` | `clinical-2` | `lab` | `adjudication` |
`release-auth`), e.g. `modules/cbc_suite_v1/reviews/rr-0001-clinical-1.yaml`. Corrections are new
superseding records (`supersedes: <review_id>`), never edits. Append-only is enforced two ways:
a `previousRecordHash` hash-chain field validated by the CLI, plus a git-history validator that
rejects any mutation/deletion of an existing record path (P2-T3). **Signature form: detached
Ed25519 semantics embedded as a `signature` object** (`{algorithm: "ed25519", keyId, value}`) over
the canonicalized record bytes minus the signature object — the same ADR-0005 mechanism, satisfying
ADR-0004's "signature binds reviewer identity to content hash." Git commit signatures are explicitly
**not** the review signature: the committer is the platform owner (author-in-effect), which would
recreate SPIKE-006's signer=author collapse and cannot express five distinct reviewer identities.
Interim semantics pre-G1/G2 (PRD OQ-2 second half): synthetic dry-run records carry throwaway
test-key signatures whose `keyId` has the structural `TESTKEY-` marker; real (non-synthetic) records
have the signature slot schema-forced empty until G1/G2 clear.

**OQ-3 — Static render target: `build/review-render/` (gitignored), goldens under
`tests/fixtures/ef-review-render/`.** E0 already gitignores `build/`; render output is generated,
never committed, never deployed — not `docs/` (would commit generated HTML into the docs tree) and
never the SPA build. The `render` verb reads only committed artifacts, emits self-contained static
HTML (no server, no scripts, no third-party assets, no network), stamps the unvalidated-prototype
banner on every page, and respects FR-31 (rights-restricted passages render as hash + selector
references, never inline text). A committed golden snapshot provides render regression (P2-T6/T7).

**OQ-4 — `releases/registry.json` E2-seed fields: exactly the FR-14 list, nothing more.** Entry
shape: `{version, moduleId, packDigest, manifestDigest, signature: null (forced pre-G2), signedAt:
null, supersedes: null, withdrawalState: "none" (const in E1), withdrawnAt: null (const),
withdrawalReason: null (const)}` plus top-level `schemaVersion`. The withdrawal-state field family is
included as inert consts because FR-14 names it and DF-E2-03 extends it; surveillance hooks
(re-verify cadence, materiality class) are **omitted entirely** — they belong to ADR-0007's
unaccepted taxonomy, and seeding them would speculate ahead of G0. E1 never sets withdrawal state.

**OQ-5 — Retrospective metrics set and report format.** The harness reports, all explicitly labeled
**software agreement** (never sensitivity/specificity/performance): (1) case-level exact-agreement
rate (engine output set vs adjudicated reference labels); (2) per-candidate-pattern agreement/
disagreement counts by pattern id; (3) dangerous-miss discordance count (reference-flagged dangerous
cases where the engine emitted no corresponding flag — a software-agreement measure against fixture
labels, not a clinical miss rate); (4) safety-flag agreement coverage; (5) missing-data-prompt
agreement rate. Format: canonically-serialized `agreement-report.json` (sorted keys, no timestamps
in hashed bytes — byte-identical across runs per FR-19) plus a `run-provenance.json` sidecar
carrying FR-21's provenance (corpus id, harness version, candidate registry digest, run timestamp);
the determinism comparison covers the report, the provenance sidecar carries the sole timestamp.
An unpopulated protocol (FR-24) renders every report header "non-qualifying — protocol not
prespecified by humans."

**OQ-6 — Throwaway-key ergonomics: ephemeral in-memory generation, no `--test-keys` flag.** Tests
generate keypairs per run via `node:crypto` `generateKeyPairSync` in test setup, never written to the
tree. The one manual path — the synthetic dry-runs (P2-T8, P3's sign dry-run) — uses a `dry-run`
mode that generates an ephemeral keypair internally, emits only the public key + signature with the
forced `TESTKEY-` keyId prefix, and discards the private key at process exit. No persistent test-key
files, no key-bearing CLI flag, nothing for CI or an agent to hold — satisfying Risk 1 mitigations
and FR-15 structurally.

**PRD OQ-1 — Reviewer roster location/format.** `governance/reviewer-roster.yaml` (new top-level
machine-readable governance path; human-facing governance docs live under `docs/governance/`),
validated by new `schemas/reviewer-roster.schema.json`. Entry: `{reviewerId, name, credentialRef,
moduleScopes[], synthetic: <bool>}`; real entries additionally require an out-of-band verification
reference field that only a human can populate (G1). The roster ships **empty**; synthetic dry-run
personas are added with `synthetic: true` (const-checked) and can never satisfy a
release-authorization validity check. The credential-verification procedure itself is a G1 human act
documented in the gates registry, not implemented. Location revisitable at G0.

**PRD OQ-5 — Adjudicator ≠ author semantics for converter-produced rule sets.** The "author" of a
converter-produced pack is the **union of**: (a) every human identity recorded in the pack's
`authoring-decisions.yaml` decision records, and (b) the git author of record of the commit that
introduced the proposal pack. The converter tool is never an identity. This union is materialized as
a machine-readable `authorship` block computed by `tools/review-record validate` (P2-T4), and the
adjudication/release-auth validators reject any adjudicator whose roster `reviewerId` maps to any
identity in that union. FR-5 and FR-23 both consume this single definition.

**PRD OQ-6 — E0 dangerous-miss corpus: promote via adapter, do not re-derive.** A deterministic
adapter (P4-T8) wraps E0's existing dangerous-miss fixtures in the harness fixture-schema envelope
(provenance marker `synthetic`, no content mutation), keeping one source of truth and avoiding
content drift; a test pins adapter-output stability. Re-derivation would fork the corpus and invite
silent divergence from the E0 slice tests.

## FR/NFR → Task Coverage

Every PRD requirement maps to ≥1 task (task detail in phase files):

| Requirement | Task(s) |
|---|---|
| FR-1 five-role file model | P1-T2, P2-T1, P2-T2 |
| FR-2 model unification + migration test | P1-T1, P1-T2, P1-T3 |
| FR-3 roster format/validator, synthetic-only | P1-T4, P2-T2 |
| FR-4 reviewer-2 independence | P2-T2 |
| FR-5 adjudicator ≠ author | P2-T4 (semantics per PRD OQ-5 above) |
| FR-6 release-auth sole transition, schema-impossible pre-G1 | P1-T7, P2-T4 |
| FR-7 review CLI | P2-T1, P2-T2 |
| FR-8 read-only rendering (not a portal) | P2-T6, P2-T7 |
| FR-9 append-only enforcement | P2-T3 |
| FR-10 record signature binding (test keys only) | P2-T5 |
| FR-11 five-role synthetic dry-run | P2-T8 |
| FR-12 Ed25519 over P5-T5 bytes, byte-identity test | P3-T1, P3-T2 |
| FR-13 fail-closed verify + exit-code taxonomy | P3-T3 |
| FR-14 registry + schema + validator | P1-T5, P3-T4 |
| FR-15 no agent/CI keys ever | P3-T2, P3-T5 (+ OQ-6 resolution) |
| FR-16 signature slot schema-forced empty pre-G2 | P1-T5, P1-T7, P3-T5 |
| FR-17 signing-ceremony runbook | P3-T7 |
| FR-18 verifier surface (PRD OQ-2) | P3-T6 |
| FR-19 version-pinned deterministic replay | P4-T3 |
| FR-20 structural de-identification boundary | P4-T1, P4-T2 |
| FR-21 aggregate metrics + provenance only | P4-T4 |
| FR-22 distinct validation-data access log | P4-T7 |
| FR-23 discordance/adjudication model | P4-T5 |
| FR-24 protocol shape, human-only thresholds | P4-T6 |
| FR-25 data-source SPIKE charter | P4-T9 |
| FR-26 dangerous-miss corpus decision | P4-T8 |
| FR-27 gates encoded as external blocked states | P1-T6, P5-T5 |
| FR-28 honesty posture on every artifact | Every task's ACs + P5-T2 audit + karen gates |
| FR-29 architecture.md + CHANGELOG | P5-T3, P5-T4 |
| FR-30 deferred-item spec stubs one-to-one | P5-T6..T9 |
| FR-31 rights posture in rendering | P2-T6 |
| NFR determinism/offline/zero-network/zero-genAI | P2-T7, P3-T1..T3, P4-T3 (test-enforced per tool) |
| NFR no key material in repo/CI/agent context | P3-T5 |
| NFR fail-closed everywhere | Seeded-violation ACs in P1-T7, P2-T2..T5, P3-T3..T5, P4-T2/T6 |
| NFR compatibility (`npm run check`, flat test glob, browser posture untouched) | Every phase gate; P3-T6 |
| NFR observability (structured audit artifacts) | P2-T3, P3-T4, P4-T4/T7 |

## Deferred Items & In-Flight Findings Policy

### Deferred Items Triage Table

Every row maps to exactly one Phase 5 design-spec task (P5-T6..T9; task detail in the Phase 5 file).
Most target specs already exist from E0's P7 — the task is an **update with E1 learnings**, not
re-authoring; only DF-E1-08 gets a new stub. Categories: `research` | `prereq` | `design` |
`tech-debt` | `policy`.

| Item ID | Category | Reason Deferred | Trigger for Promotion | Target Spec Path | P5 Task |
|---------|----------|------------------|------------------------|-------------------|---------|
| DF-E1-01 | prereq | Interactive review portal — v1 is files + CLI (R1); portal only on demonstrated friction | Documented friction threshold met + reviewer roles named (PRD OQ-8; P2-T8 emits first observations) | `docs/project_plans/design-specs/clinical-review-portal-workflow.md` (update) | P5-T6 |
| DF-E1-02 | prereq | CBC 12-angle live research op — sibling workstream, independent blockers (ADR-0008) | ADR-0008 resolved + own plan approved | `docs/project_plans/design-specs/cbc-12-angle-research-operation.md` (update) | P5-T9 |
| DF-E1-03 | prereq | Upstream `rf` validators — live in the `rf` repo, not here | RFUP accepted upstream | `docs/project_plans/design-specs/upstream-rf-validators-pediatric.md` (update) | P5-T9 |
| DF-E1-05 | design | FHIR/terminology emitters — sibling workstream | ADR-0003 accepted (G0-class) | `docs/project_plans/design-specs/fhir-terminology-emitters.md` (update) | P5-T9 |
| DF-E1-06 | design | Production signing posture (custodian, HSM, real keys) — machinery only until custodian + ADR-0005 acceptance | G0 (ADR-0005 accepted) + G2 (custodian + ceremony) | `docs/project_plans/design-specs/signed-release-key-custody.md` (update) | P5-T7 |
| DF-E1-07 | tech-debt | Property/mutation/semantic-diff CI expansion — coupled to rule-schema v2 | Rule-schema v2 migration begins (PRD OQ-7, orchestrator ruling pending) | `docs/project_plans/design-specs/property-mutation-semantic-diff-ci.md` (update) | P5-T9 |
| DF-E1-08 | design | Full CBC Suite ontology / typed facts / rule authoring — sibling L workstream | Own plan approved + OQ-7 trigger reading decided | `docs/project_plans/design-specs/cbc-suite-full-authoring.md` (**new stub**) | P5-T9 |
| DF-E1-09 | prereq | Real-data retrospective run — gated on DUA + data-source SPIKE verdict (R6) | G3 cleared + protocol thresholds set by named humans | `docs/project_plans/design-specs/retrospective-validation-harness.md` (update) | P5-T8 |
| DF-E2-01 | prereq | Surveillance/update/registry engine — E1 ships only the registry seed | E2 planning | `docs/project_plans/design-specs/surveillance-update-registry-engine.md` (update) | P5-T8 |
| DF-E2-02 | prereq | Production monitoring — no deployed release exists | First E1 release activated | `docs/project_plans/design-specs/production-monitoring-telemetry.md` (update) | P5-T8 |
| DF-E2-03 | prereq | Withdraw/rollback machinery — E1 ships only the inert withdrawal-state seed (OQ-4) | E2 planning | `docs/project_plans/design-specs/withdraw-rollback-machinery.md` (update) | P5-T7 |
| DF-EXT-01 | policy | 7 RFUP upstream `rf` enhancements — external repos, routed via `op story` | N/A — external, never tasks here | N/A — consolidated routing note already exists (`.claude/worknotes/evidence-foundry-buildout/rfup-external-routing-note.md`, E0 P7-T13); P5-T10 confirms currency, no spec authored | P5-T10 |

### In-Flight Findings

Not pre-created. `findings_doc_ref` stays `null` until the first real execution-time finding. On
creation: `.claude/findings/evidence-foundry-e1-findings.md`, set frontmatter ref, and — if
load-bearing — add a Phase 5 design-spec task and append the path to `deferred_items_spec_refs`.

### Quality Gate

Phase 5 cannot close until every triage row's spec is authored/updated (or explicitly N/A with
rationale — DF-EXT-01 only), `deferred_items_spec_refs` lists all 11 spec paths (12 triage rows
minus the DF-EXT-01 N/A), and `findings_doc_ref` is `null` or finalized at `status: accepted`.

## Plan Generator Rule Compliance (R-P1..R-P4)

- **R-P1** (no unbounded "all/across"): every "all/every" AC is expanded to enumerated target
  surfaces — the 5 record roles, the 5 seeded review violations (mutation, reviewer-2 dependence,
  adjudicator=author, non-roster identity, populated approver), the 5 seeded verify failures (byte
  drift, digest mismatch, unknown keyId, registry inconsistency, TESTKEY on real candidate), the 5
  agreement metrics (OQ-5), the 12 deferred items, and the honesty audit's bounded target_surfaces
  list (P5-T2 enumerates: new schema `description` strings, 3 tool READMEs + CLI output strings,
  render HTML template, gates registry, runbook, SPIKE charter, agreement-report headers,
  architecture.md sections, CHANGELOG entry).
- **R-P2 analog** (new schema → missing-field rejection AC): every new/extended schema — canonical
  review-record, reviewer-roster, release-registry, release-manifest signature slot, harness fixture
  corpus, discordance record, protocol shape, access log — carries an explicit AC that a seeded
  fixture missing a required field (and, where applicable, bearing a forbidden field) is rejected
  fail-closed, never silently accepted. See P1-T2/T4/T5/T7, P4-T1/T5/T6/T7.
- **R-P3** (multi-owner overlap → integration_owner + seam task): **P1** — backend-architect is
  integration owner for the shared `schemas/*` + `scripts/validate-kb.mjs` surface; seam task
  **P1-T7** proves the design (P1-T1) and the schema builds (P1-T2..T5) agree at the validator.
  **P3-T6** is the declared seam for the sole post-P1 validator change. **P5** — general-purpose
  integrator is integration owner; seam task **P5-T1** (cross-workstream dry-run) is the explicit
  join point of P2/P3/P4 outputs.
- **R-P4** (UI-touching → runtime smoke): the FR-8 static render is the only UI-adjacent surface.
  **P2-T7** is the runtime smoke task: render from committed artifacts, assert the
  unvalidated-prototype banner is present, output is self-contained (no scripts/remote assets), and
  zero network calls occur. No `*.tsx`/SPA/API file is touched by any task (deployed surfaces
  untouched, PRD §2 Architectural Context).

## Risk Mitigation

Expanded from decisions block §3; per-phase mitigations also appear in phase quality gates.

| Risk | Impact | Likelihood | Mitigation Strategy |
|------|:------:|:----------:|----------------------|
| Signing custody misdesign (SPIKE-006 NO-GO recreated) | High | Low | Verify-only in CI; OQ-6 ephemeral keys (nothing persistable); P3-T5 asserts zero key material in repo/CI env; signature slots schema-forced empty (P1-T5/T7); A2 reconciliation recorded in gates registry (P1-T6) |
| Implied clinical validity leakage | High | Medium | Honesty AC on every artifact-producing task (FR-28); metrics named software-agreement only (OQ-5); synthetic marked non-credentialed (`synthetic: true` const); P5-T2 audit + karen feature-end gate |
| Dual review-record models diverge | Medium | Medium | P1 lands canonical schema + migration test (P1-T2/T3) before any P2 machinery; ADR-0004 canonical per R5; wave0 consumers updated in the same P1 tasks |
| ADR churn (all 8 ADRs `proposed`) | Medium | Medium | G0 recorded in gates registry at P1; explicit schema versions everywhere; each phase gate includes an ADR-delta check; acceptance-triggered items stay gated (DF-E1-06) |
| Harness scope creep toward real data | Medium | Medium | Provenance-marker rejection enforced in code + test (P4-T1/T2); real-data run is DF-E1-09, gated G3; SPIKE charter (P4-T9) channels the pressure into the gated path |
| E0 canonical-bytes interface drift | Medium | Low | P3-T1 pins a golden-bytes regression fixture from E0 output; drift fails the phase, never silently re-baselines |
| Synthetic dry-run artifacts mistaken for real review (the known likely future-session mistake) | High | Medium | `synthetic: true` const + non-qualifying language on every dry-run artifact (P2-T8); release-auth validator rejects synthetic chains (P2-T4); P5-T2 audit |
| Gates stall the feature | Medium | High | All software + dry-run work is gate-independent by construction; gates tracked as external blocked states (P5-T5); SPIKE charter authored now so G3 can start early |

## Model, Provider & Profile Assignment

Reference: `.claude/skills/planning/references/multi-model-guidance.md` (Canonical Effort
Vocabulary). Claude only; Effort values are `adaptive` | `extended` exclusively.

- **Model defaults**: `sonnet` for every schema, CLI, crypto, harness, test, audit, and design-spec
  task; `haiku` only for P5's CHANGELOG/frontmatter/pointer mechanics.
- **Effort**: `adaptive` default; `extended` on the risk-hotspot tasks — P1-T1 (contract
  unification design, the R5 call), P2-T3 (append-only enforcement), P3-T1/T2/T3 (crypto +
  determinism, correctness over speed per decisions block §6), P4-T3 (pinned deterministic replay).
- **Provider**: `claude` for all 35 pts — offline deterministic tooling, no external routing.
- **Reviewers**: `task-completion-validator` (sonnet) per phase; `karen` (sonnet) at the P1-exit
  milestone and feature end (Tier 3 cadence, decisions block §2). Phase quality gate everywhere =
  `npm run check` green + task-completion-validator pass.

## Wrap-Up: Feature Guide & PR

Triggered automatically after Phase 5 is sealed (all gates pass, karen feature-end sign-off).
Delegate to `documentation-writer` (haiku) to create
`.claude/worknotes/evidence-foundry-e1-v1/feature-guide.md` per the standard template (What Was
Built / Architecture Overview / How to Test / Test Coverage Summary / Known Limitations, ≤200
lines — Known Limitations must restate the G0–G4 gate posture and the unvalidated-research-prototype
status verbatim). Commit the guide before opening the PR. PR title names the machinery, not clinical
standing (e.g., "Evidence Foundry E1: review-record workflow, sign/verify + registry seed,
retrospective harness (all human-gated)"); summary derives from this plan's Executive Summary and
the P5-T4 CHANGELOG entry.

---

**Progress Tracking**: `.claude/progress/evidence-foundry-e1/` (one file per phase, created via the
`artifact-tracking` skill during execution — `progress_init: auto`; gates G0–G4 tracked as external
blocked states per P5-T5, mirroring the P5 owner-blocked precedent).

---

**Implementation Plan Version**: 1.0
**Last Updated**: 2026-07-21
