---
title: 'Implementation Plan: Rights-Aware Evidence Capture & Taxonomy'
schema_version: 2
doc_type: implementation_plan
status: completed
created: 2026-07-21
updated: '2026-07-22'
feature_slug: rights-aware-evidence-capture
feature_version: v1
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: null
scope: 'Make the repo''s rights position machine-checkable and rebuild the evidence
  archive as addressable provenance: a top-level rights/ tree with a join ledger,
  licence/access/terms on evidence sources, a three-axis evidence-item taxonomy with
  structured locators, re-capture of stripped numerics as per-value atoms, and a clean-room
  brief generator. Zero clearances, zero attestations, zero grounded rules, zero clinical-meaning
  changes.'
effort_estimate: 29 pts
architecture_summary: EP-R0 lays the rights/ substrate and lands all package.json
  gate wiring once, while EP-R5 (spec + doc truth) floats beside it; EP-R1 (derived-fact
  coverage) and EP-R2 (source rights metadata) parallelize on disjoint records but
  share scripts/validate-kb.mjs; EP-R3 (taxonomy, locators, numerics re-capture) branches
  strictly after EP-R2's schemas/evidence.schema.json migration merges; EP-R4 (clean-room
  workflow) consumes EP-R3's taxonomy and ships plumbing only.
related_documents:
- docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
- .claude/worknotes/rights-aware-evidence-capture/decisions-block.md
- .claude/findings/rights-governance-spec-v1.0-review-findings.md
- .claude/findings/rf-ev-003-oa-substitute-findings.md
- docs/project_plans/research/research-foundry-rights-entity-model-handoff-v1.md
- docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.md
- docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md
- docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
references:
  user_docs:
  - NOTICE.md
  context:
  - .claude/worknotes/rights-aware-evidence-capture/decisions-block.md
  - .claude/findings/rights-governance-spec-v1.0-review-findings.md
  - docs/project_plans/research/research-foundry-rights-entity-model-handoff-v1.md
  specs:
  - schemas/evidence.schema.json
  - schemas/reference-range.schema.json
  - schemas/module-manifest.schema.json
  - docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/schemas/rights_record.schema.json
  - docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/schemas/content_reuse_assessment.schema.json
  - docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/schemas/permission_record.schema.json
  - docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/schemas/rights_failure.schema.json
  - docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/schemas/rights_extension.schema.json
  related_prds:
  - docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
  - docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
spike_ref: []
adr_refs: []
deferred_items_spec_refs:
- docs/project_plans/design-specs/rights-clearance-workflow.md
- docs/project_plans/design-specs/rights-release-gate.md
- docs/project_plans/design-specs/single-source-rule-reanchoring.md
- docs/project_plans/design-specs/first-party-rights-record.md
- docs/project_plans/design-specs/near-verbatim-span-reauthoring.md
findings_doc_ref: null
charter_ref: null
changelog_ref: null
changelog_required: true
test_plan_ref: null
plan_structure: unified
progress_init: auto
owner: nick
contributors: []
priority: high
risk_level: high
category: infrastructure
tags:
- implementation
- rights
- licensing
- provenance
- evidence
- taxonomy
- governance
- infrastructure
tier: 3
estimated_points: 29
milestone: null
commit_refs: []
pr_refs: []
files_affected:
- rights/release-context.json
- rights/rights-records.json
- rights/rights-failures.json
- rights/rights-ledger.json
- schemas/rights/rights_record.schema.json
- schemas/rights/content_reuse_assessment.schema.json
- schemas/rights/permission_record.schema.json
- schemas/rights/rights_failure.schema.json
- schemas/rights/rights_extension.schema.json
- schemas/rights/VENDORING.md
- schemas/evidence.schema.json
- scripts/validate-rights.mjs
- scripts/validate-kb.mjs
- scripts/evidence/build-evidence-pack.mjs
- scripts/rights/build-decision-brief.mjs
- modules/anemia/evidence.json
- modules/anemia/reference-ranges.json
- package.json
- CLAUDE.md
- NOTICE.md
- docs/architecture.md
- docs/workflows/clean-room-authoring.md
- tests/rights-coverage.test.mjs
- tests/rights-negative-invariant.test.mjs
- tests/rights-axis-separation.test.mjs
- tests/rights-gate-failsclosed.test.mjs
- tests/rights-brief-contamination.test.mjs
wave_plan:
  serialization_barriers:
  - schemas/evidence.schema.json
  - scripts/validate-kb.mjs
  - scripts/validate-rights.mjs
  - package.json
  - CLAUDE.md
  intra_wave_ordering:
  - wave: 2
    before: EPR1-T2
    after: EPR2-T5
    reason: EPR2-T5 consumes EPR1-T2's helper unchanged (R-P3). If EP-R2 reaches T5
      before EPR1-T2 has merged, it blocks rather than writing its own resolver.
  - wave: 1
    before: EP-R0
    after: EPR5-T7
    reason: "Only EPR5-T7 depends on EP-R0. Declaring the dependency at phase level\
      \ would serialize wave 1 and destroy the EP-R0 \u2225 EP-R5 parallelism; the\
      \ constraint is task-scoped \u2014 EP-R5 starts immediately and holds T7 until\
      \ EP-R0 merges."
  phases:
  - id: EP-R0
    depends_on: []
    isolation: shared
    parallelizable: true
  - id: EP-R5
    depends_on: []
    isolation: shared
    parallelizable: true
  - id: EP-R1
    depends_on:
    - EP-R0
    isolation: shared
    parallelizable: true
  - id: EP-R2
    depends_on:
    - EP-R0
    isolation: shared
    parallelizable: true
  - id: EP-R3
    depends_on:
    - EP-R2
    isolation: shared
    parallelizable: false
  - id: EP-R4
    depends_on:
    - EP-R3
    isolation: shared
    parallelizable: false
  waves:
  - - EP-R0
    - EP-R5
  - - EP-R1
    - EP-R2
  - - EP-R3
  - - EP-R4
---

# Implementation Plan: Rights-Aware Evidence Capture & Taxonomy

**Plan ID**: `IMPL-2026-07-21-rights-aware-evidence-capture`
**Date**: 2026-07-21
**Author**: general-purpose planning agent, expanding an Opus-authored decisions block
**Related Documents**:
- **PRD**: `docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md`
- **Decisions Block (binding)**: `.claude/worknotes/rights-aware-evidence-capture/decisions-block.md`
- **Feasibility base**: `.claude/findings/rights-governance-spec-v1.0-review-findings.md` (merged `cd15b4a`)
- **RF handoff (already authored)**: `docs/project_plans/research/research-foundry-rights-entity-model-handoff-v1.md`

**Complexity**: L (Tier 3). **Total Estimated Effort**: 29 pts. **SPIKE**: waived, decisions block §0.
**Provider**: claude primary throughout; no external-model legs.

## EP ↔ WP Mapping (read this before anything else)

This plan names execution phases **EP-R0 … EP-R5**. The PRD names the same scope as **WP0…WP5**.
The mapping is 1:1. Requirement IDs stay in PRD form (`FR-WP<N>-<nn>`) so tasks trace without
translation.

| Execution Phase | PRD Unit | Scope |
|---|---|---|
| **EP-R0** | WP0 | `rights/` tree, release context, vendored + locally-amended spec schemas, `validate-rights.mjs`, all `package.json` gate wiring |
| **EP-R1** | WP1 | `reference-ranges.json` rights record + bidirectional `KB_JSON_FILES` coverage gate |
| **EP-R2** | WP2 | `evidence.schema.json` `$defs/source` licence / access basis / terms + source→ledger gate |
| **EP-R3** | WP3 | Three-axis evidence-item taxonomy, structured locators, `derived_synthesis`, numerics re-capture, negative invariant |
| **EP-R4** | WP4 | Clean-room workflow doc, deterministic brief generator, rights-decision ledger plumbing |
| **EP-R5** | WP5 | Spec amendments (§15/§3.7/§16.2/§3.2, Appendix B, citation hygiene) + doc-truth corrections |
| **RF-HANDOFF** | `FR-RFH-01..04` | **Already delivered** — `docs/project_plans/research/research-foundry-rights-entity-model-handoff-v1.md`. Not a phase, not scheduled, not point-estimated. Referenced by EP-R0 and EP-R3. |

## Executive Summary

This feature makes the rights position machine-checkable and rebuilds the evidence archive as
**addressable provenance rather than retained text** (decisions block D1). EP-R0 installs a top-level
`rights/` tree, a `commercial: false` release context, the five spec schemas vendored **with an
explicit local amendment layer**, and `scripts/validate-rights.mjs` wired into `npm run validate`.
EP-R1 closes the derived-fact blind spot the findings named as the single most actionable technical
finding: `reference-ranges.json` → `deriveFacts()` → 91 rules is not covered by passage-level gating.
EP-R2 gives `$defs/source` structured licence/access/terms so the AAP block becomes machine-checkable
instead of prose. EP-R3 — the largest phase and the largest payoff — installs the three orthogonal
axes, exhaustive structured locators, `derived_synthesis` with attribution modelled from day one, and
re-captures the numerics that rights-avoidance paraphrasing stripped, as **per-value atoms, never a
reproduced table**. EP-R4 ships a deterministic decision-brief generator and ledger plumbing for a
rights owner and clinician who do not yet exist. EP-R5 amends the reviewed spec and corrects the
project's own documentation, including `CLAUDE.md`'s stale `npm run check` composition.

**It ships zero clearances, zero attestations, zero grounded rules.** Every gate is coverage- and
consistency-shaped, never clearance-shaped (D7). Where a phase touches a clearance, attestation, or
authoritative-synthesis surface, it ships the plumbing and the fails-closed test and never the value.

## Implementation Strategy

### Architecture Sequence

This is a governance-metadata and provenance pipeline over an existing deterministic engine, not a
layered CRUD feature. The sequence follows the decisions block §2 phase boundaries: substrate →
coverage → source metadata → item taxonomy → human workflow, with documentation truth floating.

1. **Substrate** (EP-R0) — `rights/` tree, release context, vendored+amended schemas, validator
   skeleton, and **all** `package.json` gate wiring. Everything else depends on the substrate
   existing. Ships the `commercial: false` declaration, the cheapest guardrail in the program.
2. **Coverage** (EP-R1) ∥ **Source metadata** (EP-R2) — disjoint record sets, one shared file
   (`scripts/validate-kb.mjs`). EP-R1 is deliberately separable so it can ship if the substrate stalls
   (FR-WP1-05).
3. **Item taxonomy & capture** (EP-R3) — strictly after EP-R2 merges; both edit
   `schemas/evidence.schema.json` and EP-R3 layers item-level axes onto EP-R2's source-level fields.
4. **Clean-room workflow** (EP-R4) — consumes EP-R3's taxonomy and locators; a brief generator cannot
   be written before the atoms it summarises have a shape.
5. **Spec & doc truth** (EP-R5) — no code dependency; runs in W1 so the legal-citation and
   measured-vs-judged framing is corrected in the reference spec before EP-R3 builds the axis on it.

### Parallel Work Opportunities

- **EP-R0 ∥ EP-R5** (W1) — fully disjoint. EP-R0 touches `rights/`, `schemas/rights/`,
  `scripts/`, `package.json`; EP-R5 touches the reviewed spec markdown, `CLAUDE.md`, `NOTICE.md`,
  `docs/architecture.md`. `CLAUDE.md` is an EP-R5-only barrier; `package.json` is EP-R0-only.
- **EP-R1 ∥ EP-R2** (W2) — disjoint records (`reference-ranges.json`'s rights record vs. the 6 source
  records), one shared file: `scripts/validate-kb.mjs`. Per **R-P3**, `integration_owner = EP-R1`
  (it lands the ledger-resolution helper first); EP-R2 extends the helper's call sites and does not
  restructure it. Seam tasks: EPR1-T2 (owner), EPR2-T5 (consumer).
- **Strictly serial**: EP-R2 → EP-R3 → EP-R4. EP-R3 branches from EP-R2's **merge**, not from its
  branch tip, so the `schemas/evidence.schema.json` barrier is honoured by construction.
- **RF-HANDOFF is not scheduled** — it is authored and merged. EP-R0's vendoring and EP-R3's taxonomy
  both cite its §9 conflict list; neither waits on it.

### Critical Path

**EP-R0 → EP-R2 → EP-R3 → EP-R4** (5 + 5 + 8 + 5 = 23 of 29 pts). EP-R1 (3 pts) rejoins in W2
alongside EP-R2 and is off the critical path; EP-R5 (3 pts) floats in W1. EP-R3 is both the longest
phase and the one with the most sensitive content — if it exceeds 10 pts during decomposition, split
it at the **taxonomy / re-capture seam** (EPR3-T1..T5 vs. EPR3-T6..T9) rather than compressing the
re-capture (decisions block §5).

### Phase Summary

| Phase | Title | Estimate | Target Subagent(s) | Model(s) | Notes |
|-------|-------|---------:|--------------------|----------|-------|
| EP-R0 | Rights substrate | 5 pts | general-purpose | sonnet (medium) | Mechanical scaffolding + gate wiring; vendored schemas need a **declared local amendment layer** (handoff §9) |
| EP-R1 | Derived-fact coverage gap | 3 pts | general-purpose | sonnet (high) | Small but must fail closed; owns the `validate-kb.mjs` seam (R-P3) |
| EP-R2 | Source rights metadata | 5 pts | general-purpose | sonnet (high) | Atomic schema migration under `additionalProperties: false`; barrier holder |
| EP-R3 | Evidence taxonomy & archive capture | 8 pts | general-purpose, Explore | **opus** (high) | Largest phase; negative invariant lands **first**; per-value atoms, never tables |
| EP-R4 | Clean-room authoring workflow | 5 pts | general-purpose | sonnet (high) | Brief generator + ledger plumbing; **zero attestations** |
| EP-R5 | Spec amendments & doc truth | 3 pts | general-purpose | sonnet (medium) | Legal-citation care; `CLAUDE.md` barrier owner |
| **Total** | — | **29 pts** | — | — | — |

> Full task tables, per-task acceptance criteria, and model/effort routing live in the phase files
> linked below. Estimation anchors live in the decisions block §5; this plan carries the totals only.

## Binding Constraints (D1..D7) — not open for re-litigation

| Constraint | Statement | Verifying task(s) |
|---|---|---|
| **D1** | The archive is provenance, not text. Maximal capture = maximal addressable provenance; never retained third-party expression. What was deliberately not stored is recorded explicitly. | EPR3-T1 (negative invariant, lands first), EPR3-T4 (`not_captured[]`), EPR3-T6 |
| **D2** | Three axes, three fields. `evidence_item_type` (measured vs. judged) × `rights_component_class` × epistemic `status` vs. legal `overall_status`. Guidelines are captured, not avoided. | EPR3-T2, EPR3-T3 (axis-separation test), EPR3-T8 |
| **D3** | `derived_synthesis` ships now, as a first-class type with attribution-to-inputs modelled from day one, in a `candidate` state only. | EPR3-T7 |
| **D4** | Rights records live in a top-level `rights/` tree with a join ledger. Inline `extensions.rights` is explicitly rejected. Generic → Research Foundry, specific → here. | EPR0-T1, EPR0-T4, EPR4-T4 |
| **D5** | Clinician time is the binding constraint. The brief summarises source guidance; it never quotes it into the implementation record. | EPR4-T2, EPR4-T3 (contamination guard), EPR4-T6 |
| **D6** | The wave-0 D-4 discipline extends to every new object type: no agent-authored `CLEARED_*`, `clinicalApprovers[]`, `approvedBy[]`, `counsel_approved`, or authoritative `derived_synthesis`. | EPR0-T3 (null constraints in vendored copies), EPR0-T4, EPR3-T7, EPR4-T5 |
| **D7** | Coverage and consistency gates only, never clearance gates. A record at `overall_status: UNKNOWN` must pass the build. | EPR0-T5, EPR0-T6, EPR1-T3 |

### Vendored-schema amendment posture (handoff §9) — plan-level ruling

`docs/project_plans/research/research-foundry-rights-entity-model-handoff-v1.md` §9 records **six
conflicts** in the v1.0 pack's schemas. **The vendored copies are therefore not usable as-is**, and
this plan does not pretend otherwise. EP-R0 vendors them *and* ships a declared local amendment layer;
EP-R3's taxonomy is built on this repo's own fields, not on the spec's extension object.

| Handoff §9 conflict | Consequence for this plan | Owning task |
|---|---|---|
| §9.1 `rights_extension` cannot carry the taxonomy (`additionalProperties:false`, requires `clearance_status`/`release_gate`) | The taxonomy does **not** ride `extensions.rights`. `evidence_item_type` / `judgment_basis` are first-class fields in `schemas/evidence.schema.json`, per the handoff's stated preference (b). | EPR3-T2 |
| §9.2 §5.1 prose table ≠ `component_decisions.component_type` enum | `rights_component_class` values are taken from the **schema enum**, not the prose table, and the divergence is annotated in `schemas/rights/VENDORING.md`. | EPR0-T3, EPR3-T2 |
| §9.3 `access.basis` has no `unknown` member | Local amendment adds `unknown`, treated as blocking. Without it an unassessed source must record a false certainty. | EPR0-T3 |
| §9.4 TDM / model-training modelled twice with incompatible enums | Local amendment designates one home per restriction and annotates the other as deprecated-in-vendored-copy. | EPR0-T3 |
| §9.5 `rights_record` cannot describe first-party content — **blocks `derived_synthesis`** | `derived_synthesis` items are **not** given a `rights_record`. EP-R3 models first-party authorship on the evidence item itself and records the gap; re-homing waits on OQ-4. | EPR0-T3, EPR3-T7 |
| §9.6 `format: "uri"` unenforced; nullable `contract` with no required members | Local amendment replaces `format: "uri"` with `pattern` and forbids the empty `contract` object. | EPR0-T3, EPR0-T5 |

Every amendment is an **annotated, declared divergence** from the spec bundle's `checksums.sha256`
(FR-WP0-03), never a silent edit.

## Plan Generator Rule Compliance (R-P1..R-P4)

- **R-P1** (no bare "all X" without `target_surfaces`): every structured AC carried from the PRD
  (AC-D1, AC-D6, AC-WP3-AXES, AC-WP3-NUMERICS, AC-WP3-NEGATIVE) enumerates concrete file targets in
  its phase file. Population counts are stated concretely: 4 `KB_JSON_FILES` entries, 6 sources,
  41 passages, 32 reference-range values, 3 `omits-source-numerics`-flagged passages plus the audit's
  HIGH numeric-omission findings.
- **R-P2** (new field ⇒ "consumer handles absence" AC): every new field introduced in EP-R2 and EP-R3
  has a companion resilience task — EPR2-T6 (consumers do not throw on legacy records; absent rights
  fields render "unassessed", never "unrestricted") and EPR3-T5 (partial locator capture is
  representable and visible, never silently complete).
- **R-P3** (overlapping-owner phases ⇒ `integration_owner` + seam task): two overlaps exist.
  (i) EP-R1 ∥ EP-R2 overlap at `scripts/validate-kb.mjs`. `integration_owner = EP-R1`. Seam tasks:
  EPR1-T2 (owner, lands the ledger-resolution helper), EPR2-T5 (consumer, adds a call site, does not
  restructure) — recorded as an **intra-wave ordered dependency** (`EPR2-T5 ← EPR1-T2`) in
  `wave_plan.intra_wave_ordering`, because both sit in wave 2.
  (ii) **`scripts/validate-rights.mjs` is edited by EP-R0, EP-R1, EP-R2 and EP-R3**, two of which
  (EP-R1, EP-R2) share a wave. `integration_owner = EP-R0`: it creates the module and fixes the
  exported-gate contract (one pure function per gate, registered in a single exported gate list).
  Later phases **append** a gate and its unit test; none may restructure the module, rename a gate,
  or change an existing gate's signature. A shape change is an escalation to the plan owner, exactly
  as with the `validate-kb.mjs` helper.
- **R-P4** (UI-touching phase ⇒ runtime smoke task): EP-R2 is the only phase whose fields reach a
  browser consumer (`src/app.js` renders evidence source metadata). EPR2-T6 carries the runtime smoke
  obligation via `npm run smoke:browser` plus `check:imports`. No other phase touches a UI surface.

## Quality Gates

`npm run check` green is a standing exit condition for **every** phase. The authoritative composition
is `package.json`'s, not `CLAUDE.md`'s (which is stale until EPR5-T5 lands):

```
npm test && npm run validate && npm run coverage:rules && npm run build \
  && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke
```

| Gate criterion | Closed by | Status at end of this plan |
|---|---|---|
| Every `KB_JSON_FILES` entry resolves to a rights record, bidirectionally | EP-R1 | Closeable |
| Every KB-cited source carries structured licence / access basis / terms | EP-R2 | Closeable |
| All 41 passage records carry three separate axis fields; no axis derived from another | EP-R3 | Closeable |
| No third-party full text, table, figure, or brand asset in the tree; **no new** near-verbatim span | EP-R3 (EPR3-T1, lands first) | Closeable as a **no-regression** gate, with residual gap R-1 recorded open and the 11 pre-existing spans allowlisted as DEF-R5 |
| Every new gate has a fails-closed resilience test | EP-R0, EP-R1, EP-R2, EP-R3 | Closeable |
| Determinism: two runs at different wall-clock times, unchanged input, byte-identical output | EP-R0 (`--as-of`), EP-R4 (brief generator) | Closeable |
| Zero clearances, zero attestations, zero grounded rules | every phase; asserted by test | **Closeable and must stay closed at zero** |
| A source or item is actually *cleared* | — | **Not closable, by design** — blocked on OQ-2 (no rights owner). Recorded, not attempted. |
| Measured-vs-judged determination per threshold family | — | **Not closable, by design** — OQ-1, routes to counsel. Every item ships `judgment_basis: unassessed`. |

## Deferred Items & In-Flight Findings Policy

### Deferred Items Triage Table

| Item ID | Category | Reason Deferred | Trigger for Promotion | Target Spec Path |
|---------|----------|------------------|------------------------|-------------------|
| DEF-R1 | blocked-external | Clearance decisions (`CLEARED_*` statuses) for any source, including the 7 CDC/public-domain rules the findings identify as unblockable. | A named rights owner exists (OQ-2). | `docs/project_plans/design-specs/rights-clearance-workflow.md` |
| DEF-R2 | blocked-external | Spec §20.2 hard release gate (clearance-shaped). | DEF-R1 resolved **and** a non-trivial number of records carry a real clearance status. | `docs/project_plans/design-specs/rights-release-gate.md` |
| DEF-R3 | research-needed | Re-anchoring the 44 rules resting on one *Blood* review article onto primary studies (OQ-3). | Product-strategy decision; real re-synthesis cost. | `docs/project_plans/design-specs/single-source-rule-reanchoring.md` |
| DEF-R4 | blocked-external | Re-homing `derived_synthesis` onto a first-party rights record (handoff §9.5). | Research Foundry answers OQ-4 with a first-party record scope. | `docs/project_plans/design-specs/first-party-rights-record.md` |
| DEF-R5 | scope-cut | Re-authoring the **11 pre-existing near-verbatim spans** enumerated in `docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md` (`FDA2026_CDS#ev_002`–`#ev_005`; `BSH2020_G6PD#ev_003`, `#ev_005`, `#ev_007`; the ~7-word spans in `AAP2026_IDA#ev_005`, `CDC2025_LEAD#ev_001`, `#ev_003`, `BSH2020_G6PD#ev_002`). No task in this feature re-words them, so EPR3-T1's invariant allowlists them as a **no-regression** baseline rather than failing on day one. | Either (a) a re-authoring pass is scheduled — the natural home is the EP-R3 re-capture seam, since re-wording touches the same passages — or (b) EPR3-T1's allowlist is observed to be non-shrinking across two consecutive phases, which promotes it from "known debt" to "accumulating debt". Each entry removed from the allowlist closes that fraction of DEF-R5; DEF-R5 closes when the allowlist is empty. | `docs/project_plans/design-specs/near-verbatim-span-reauthoring.md` |

Each item gets a spec-refresh task in EP-R5 (EPR5-T7). `deferred_items_spec_refs` populates as
EPR5-T7 lands.

### In-Flight Findings

Lazy-creation rule applies: `.claude/findings/rights-aware-evidence-capture-findings.md` is **not**
pre-created. Create only on the first real plan/reality mismatch; on creation, set `findings_doc_ref`,
append to `related_documents`, and add a doc-refresh row in EP-R5.

### Quality Gate

EP-R5 cannot be sealed until all 5 deferred items have a design-spec path in
`deferred_items_spec_refs` and, if `findings_doc_ref` is populated, the findings doc is finalized.

## Risk Summary

Condensed from decisions block §4; each row names the owning phase.

| Risk | Severity | Owning Phase | Mitigation |
|---|:-:|---|---|
| An agent writes a `CLEARED_*`, `clinicalApprovers[]`, `approvedBy[]`, `counsel_approved`, or an authoritative `derived_synthesis` | **Critical** | EP-R0, EP-R3, EP-R4 | D6; null-constraints / `maxItems: 0` in the vendored copies, on the paths EPR0-T3 enumerates (the bundle's `examples/aap_rights_failure.example.json` sets `review.reviewed_by: ["rights-governance-agent"]` and `examples/facts_only_reuse_assessment.example.json` sets `review.clinical_reviewer: "pediatric-hematology-reviewer"` — the two examples that land an identifier in a human-reviewer field; the `rights_record` examples correctly use `assessed_by_agent`); a fails-closed test per phase; the authoritative `derived_synthesis` state is structurally unrepresentable. |
| Restricted source text enters the repo "for the archive" | **Critical** | EP-R3 | D1; EPR3-T1 negative-invariant test lands **before** any capture task; no Zone 1 vault here; git history is unrecoverable, so prevention is the only control. |
| Numerics re-capture reintroduces verbatim table structure | High | EP-R3 | Per-value atoms with locators, never a reproduced table; `not_captured[]` records the omitted structure; `REG_002_CLEARED` stays `false`. |
| Adopting §20.2 clearance gating bricks the build | High | EP-R0 | D7 — coverage/consistency gates only; a test asserts a record at `UNKNOWN` still passes `npm run validate`. |
| Three axes collapse into one status field | High | EP-R3 | Separate fields enforced by schema; EPR3-T3 constructs every pairwise combination and asserts no code path infers one axis from another. |
| Vendored schemas assumed usable as-is despite handoff §9's six conflicts | High | EP-R0 | The plan-level ruling table above; EPR0-T3 ships the amendment layer and `schemas/rights/VENDORING.md`; a test fails on an *undeclared* divergence. |
| Two-repo drift: this repo implements what RF should own | Medium | EP-R3 | D4 boundary rule; RF-HANDOFF already merged; FR-WP3-11 forbids runtime `$ref` to an RF-owned schema until OQ-4 resolves. |
| Atomic schema migration under `additionalProperties: false` | Medium | EP-R2, EP-R3 | Schema-first → mechanical backfill → validate, in one commit, reviewed as a generated-content diff; explicit typed `unknown` rather than omission. |
| `json-schema-lite` silently ignores `format: "uri"` | Medium | EP-R0 | Use `pattern`; never `format: "uri"`. Any remaining unchecked field is documented in the schema's own description. |
| A date-dependent gate breaks byte-identical determinism | Medium | EP-R0 | `--as-of` flag or env value; `Date.now()` is forbidden in any gate or generator. |
| Clinician time consumed by badly-shaped briefs | Medium | EP-R4 | D5; one decision per brief, question first; contamination guard prevents a rework loop. |

## Model Routing Notes

Per decisions block §3. **Registered agent types only** — this environment has `general-purpose`,
`Explore`, `Plan`, `artifact-tracker`, `artifact-validator`, `claude`, `phase-owner`, `pr-workflow`.
`codebase-explorer`, `senior-code-reviewer`, `implementation-planner`, and `prd-writer` are **not**
registered and must never be named; the `/explore` workflow already failed on exactly that.

- **`general-purpose` is the primary executor for all six phases.** `Explore` is used read-only in
  EP-R3 to enumerate flagged passages and candidate verbatim spans before any edit.
- **`opus` is used for EP-R3 only** — taxonomy design judgment plus evidence-sensitive numerics
  re-capture. Every other phase runs `sonnet`.
- **Effort**: `medium` for EP-R0 and EP-R5 (mechanical scaffolding, doc edits); `high` for EP-R1
  (small but must fail closed), EP-R2 (schema migration under `additionalProperties: false`), EP-R3,
  and EP-R4 (D5/D6 discipline critical).
- **No external-model legs.** No `codex`, `gemini`, or ICA offload: every phase touches rights,
  clearance, or clinical-evidence surfaces where the D6 discipline is the point.
- Two-failure escalation: if a model fails the same task twice, escalate up the intelligence column
  rather than retrying at tier.

## Phase Files

- [Phase EP-R0: Rights Substrate](./rights-aware-evidence-capture-v1/phase-r0-rights-substrate.md)
- [Phase EP-R1: Derived-Fact Coverage Gap](./rights-aware-evidence-capture-v1/phase-r1-derived-fact-coverage.md)
- [Phase EP-R2: Source Rights Metadata](./rights-aware-evidence-capture-v1/phase-r2-source-rights-metadata.md)
- [Phase EP-R3: Evidence Taxonomy & Archive Capture](./rights-aware-evidence-capture-v1/phase-r3-evidence-taxonomy.md)
- [Phase EP-R4: Clean-Room Authoring Workflow](./rights-aware-evidence-capture-v1/phase-r4-clean-room-workflow.md)
- [Phase EP-R5: Spec Amendments & Doc Truth](./rights-aware-evidence-capture-v1/phase-r5-spec-amendments.md)

## Wrap-Up: Feature Guide & PR

Triggered after EP-R4 seals and EP-R5's deferred-item gate passes. Delegate to `general-purpose`
(sonnet, medium) to create `.claude/worknotes/rights-aware-evidence-capture/feature-guide.md` per the
template in `.claude/skills/planning/templates/implementation-plan-template.md` §Wrap-Up. Required
sections (≤200 lines): What Was Built; Architecture Overview (`rights/` tree + ledger, source
licence/access/terms, three-axis item taxonomy, structured locators, brief generator); How to Test
(`npm run check`; targeted `node --test` for the new rights suites); Test Coverage Summary; Known
Limitations.

**The Known Limitations section is a hard requirement, not a courtesy.** It must state plainly that
this feature made the rights position **measured, not improved**: it unblocked zero sources, wrote
zero clearances, created zero attestations, and grounded zero of 91 rules; that the two named
bottlenecks (a credentialed clinician, a named rights owner) remain unfilled and are not engineering
tasks; and that residual gap R-1 — prohibited-excerpt detection is not deterministic — is open, not
closed.

Commit per this repo's git workflow (`CLAUDE.md`): branch off `main`, `npm run check` green, commit
per phase, PR to the parent branch, `Co-Authored-By` trailer.

---

**Implementation Plan Version**: 1.0
**Last Updated**: 2026-07-21
