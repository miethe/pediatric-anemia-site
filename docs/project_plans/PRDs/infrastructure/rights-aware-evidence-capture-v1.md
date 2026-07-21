---
title: "PRD: Rights-Aware Evidence Capture & Taxonomy"
schema_version: 2
doc_type: prd
status: draft
created: 2026-07-21
updated: 2026-07-21
feature_slug: "rights-aware-evidence-capture"
feature_version: "v1"
prd_ref: null
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
related_documents:
  - .claude/worknotes/rights-aware-evidence-capture/decisions-block.md
  - .claude/findings/rights-governance-spec-v1.0-review-findings.md
  - .claude/findings/rf-ev-003-oa-substitute-findings.md
  - docs/project_plans/research/research-foundry-rights-entity-model-handoff-v1.md
  - docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.md
  - docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
  - docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md
  - docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md
references:
  user_docs:
    - NOTICE.md
  context:
    - .claude/worknotes/rights-aware-evidence-capture/decisions-block.md
    - .claude/findings/rights-governance-spec-v1.0-review-findings.md
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
charter_ref: null
changelog_ref: null
changelog_required: true
test_plan_ref: null
owner: nick
contributors: []
priority: high
risk_level: high
category: "infrastructure"
tags: [prd, rights, licensing, provenance, evidence, taxonomy, governance, infrastructure]
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
  - schemas/evidence.schema.json
  - scripts/validate-rights.mjs
  - scripts/validate-kb.mjs
  - scripts/evidence/build-evidence-pack.mjs
  - scripts/lib/json-schema-lite.mjs
  - modules/anemia/evidence.json
  - modules/anemia/reference-ranges.json
  - package.json
  - CLAUDE.md
  - NOTICE.md
  - docs/architecture.md
  - tests/rights-coverage.test.mjs
  - tests/rights-negative-invariant.test.mjs
  - tests/rights-axis-separation.test.mjs
tier: 3
estimated_points: 29
---

# Feature Brief & Metadata

**Feature Name:**

> Rights-Aware Evidence Capture & Taxonomy

**Filepath Name:**

> `rights-aware-evidence-capture-v1`

**Date:**

> 2026-07-21

**Author:**

> Nick Miethe (Opus decisions-block arbitration; PRD authored by a general-purpose agent)

**Related Epic(s)/PRD ID(s):**

> Follows `wave0-safety-foundation-v1` (EP-3/EP-4 evidence provenance + rule governance, merged).
> Feeds the Evidence Foundry track (`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md`).

**Related Documents:**

> - `.claude/worknotes/rights-aware-evidence-capture/decisions-block.md` — **binding.** D1–D7, phase
>   boundaries and points, waves, serialization barriers, risk hotspots, estimation anchors, OQ-1..OQ-4.
> - `.claude/findings/rights-governance-spec-v1.0-review-findings.md` — feasibility base (merged
>   `cd15b4a`); source of every current-state number quoted in this PRD.
> - `docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/` — the reviewed spec
>   (§5.1 component classes, §6 statuses, §9 clean-room roles, §20 release governance).
> - `docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md` — origin of the **D-4
>   discipline** (approval fields structurally ready, honestly empty) that this feature extends.
> - `CLAUDE.md` — hard guardrails, restated as binding constraints in §6.

---

## 1. Executive Summary

This feature makes the project's **rights position legible and machine-checkable**, and rebuilds the
evidence archive so that a future licence can be exercised mechanically rather than requiring the
research to be redone. It adds a top-level `rights/` tree with a total-coverage join ledger, gives
`evidence.schema.json`'s source records licence/access-basis/terms fields, and introduces an
`evidence_item_type` taxonomy that separates **measured** knowledge from **judged** knowledge —
the distinction the reviewed spec lacks and the findings identified as decisive.

**It ships zero clearances, zero attestations, and zero grounded rules.** It does not unblock any
source. It is the instrument that measures the debt, not the payment
(`.claude/findings/rights-governance-spec-v1.0-review-findings.md` §7).

**Priority:** HIGH

**Key Outcomes:**
- Outcome 1: every artifact this repo ships carries a rights record, and the absence of one fails the
  build — coverage, never clearance (D-7).
- Outcome 2: the numerics that rights-avoidance paraphrasing stripped out are re-captured as typed
  atoms with exhaustive locators, so a claim can be re-bound to its source mechanically when a
  licence exists.
- Outcome 3: three governance axes — epistemic kind, rights component class, legal clearance — become
  three separate fields that cannot silently agree by collapsing into one.

---

## 2. Context & Background

### Current State

Every number below is measured, and is cited from
`.claude/findings/rights-governance-spec-v1.0-review-findings.md` (merged `cd15b4a`). None are
estimates.

| Fact | Value | Source |
|---|---|---|
| Rules with a grounded (human-attested) binding | **0 of 91** | findings §3, project memory |
| Rules whose blocker is human attestation | **60** | findings §3 |
| Rules whose blocker is licensing/retrievability (`AAP2026_IDA`) | **31** | findings §3 |
| Passages bindable today (`source-supported`, empty `reviewFlags`, `paraphrase`) | **13** | findings §3 |
| Rules genuinely unblocked by adopting the spec (`CDC2025_LEAD`, U.S. federal public domain) | **7** | findings, Determination |
| Numeric values in `modules/anemia/reference-ranges.json` (AAP Table 1 derived) | **32** | findings §4 |
| Rules resting on a single *Blood* review article | **44** | findings §7 |
| Near-verbatim spans requiring re-authoring | **11** | findings §7 |
| Evidence sources / passage records in `modules/anemia/evidence.json` | 6 sources / 41 passages | repo |

Structurally: `schemas/evidence.schema.json`'s `$defs/source` records **no licence, access basis, or
terms at all** (findings §6). That `AAP2026_IDA` is unusable for reuse exists only as prose in
`.claude/findings/` and as a single hardcoded constant, `REG_002_CLEARED = false`
(`scripts/validate-kb.mjs:17`), which constrains `passageFidelity` to `paraphrase`/`withheld` and
gates nothing else. `tests/attestation-ledger-gate.test.mjs` asserts the attestation ledger is empty
("a non-empty ledger is a clinical claim") — the honesty tripwire, working as designed.

### Problem Space

Three distinct failures compound:

1. **The rights position is prose.** A rights re-review today changes a markdown file in
   `.claude/findings/`. Nothing in the build knows about it, so nothing can fail on it.
2. **The derived-fact channel is ungated.** `reference-ranges.json` → `deriveFacts()` → all 91 rules
   is not covered by the passage-level gating that catches the 32 AAP-citing rules. A rules-only
   rights sweep misses it entirely (findings §4 — "the single most actionable technical finding").
3. **Rights-avoidance destroyed evidence value without reducing exposure.** The passages carrying the
   actual thresholds (WHO Hb cutoffs, the elevation-adjustment quadratic, BSH G6PD values, AAP Table 1
   intervals) were quarantined `omits-source-numerics` — the numbers were stripped during paraphrasing
   (findings §3, qualification 3; `docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md`).
   Consequently, attesting the 13 survivors would ground rules to **thin framework claims rather than
   to the thresholds those rules actually encode.**

### Current Alternatives / Workarounds

- *Prose findings documents.* Legible to a human reading that file; invisible to `npm run check`, to a
  future agent, and to a release manifest.
- *One hardcoded boolean.* `REG_002_CLEARED` is a single global switch over one behaviour
  (`passageFidelity`); it cannot express per-source, per-component, or per-use decisions.
- *Strip the numerics.* Applied the wrong remedy to the right worry (D-1). A reported cutoff **is**
  the fact; the exposure was never in the digits, it was in reproducing expression and in the
  contract terms attached to access.
- *Store source text now, decide later.* The intuition behind "capture everything" is correct; this
  implementation of it is the one thing that must never happen (§6, D-1). It converts a copyright
  question (defensible) into a contract-breach question (not), and git history is unrecoverable.

### Prior Art — what the merged wave-0 work already gives this feature

- **RG-9 precedent:** the rule→passage attestation join was deliberately moved *out* of the clinical
  files into `evidence-packs/passage-attestations.json`; `scripts/validate-kb.mjs` already calls
  `loadAttestationLedger()` / `validateBindingsAgainstLedger()`. A rights ledger drops into that seam
  (findings §5).
- **The D-4 discipline** (`wave0-safety-foundation-v1` §6): `clinicalApprovers[]` / `approvedBy[]` are
  typed, `maxItems: 0`, test-enforced empty. This feature extends the same discipline to new object
  types rather than inventing a second mechanism.
- **Two-part digest:** `sign-kb.mjs`'s `KB_JSON_FILES` (`rules`, `candidates`, `evidence`,
  `reference-ranges`) exists precisely to keep governance axes separable — which is why rights records
  must not live inline (D-4 of the decisions block; findings §5).
- **`kb-diff.mjs` fails closed** on unknown change classes across a 1521-line normative classifier;
  a separate `rights/` tree costs zero classifier work.

### Architectural Context

```
rights/rights-records.json ──┐
rights/release-context.json ─┼─> scripts/validate-rights.mjs ─> npm run validate ─> npm run check
rights/rights-ledger.json ───┘        (coverage + consistency gates only, D-7)
                                            ▲
modules/anemia/evidence.json (sources+passages, + rights metadata, + evidence_item_type)
modules/anemia/reference-ranges.json (32 values, derived-fact channel)
        └─ both already covered by sign-kb.mjs KB_JSON_FILES
```

---

## 3. Problem Statement

The project's rights position is undocumented in code, its derived-fact channel is ungated, and its
evidence archive has been degraded by a rights-avoidance measure that reduced evidentiary value
without reducing legal exposure.

**User Story Format:**
> "As a maintainer, when I need to know whether a shipped artifact may lawfully be shipped, I read a
> prose findings document and reason from memory, instead of running a gate that answers it — and when
> a licence finally arrives, I cannot exercise it, because the locators needed to re-bind claims
> mechanically were never captured."

**Technical Root Cause:**
- `schemas/evidence.schema.json` `$defs/source` carries no licence/access-basis/terms fields.
- `scripts/validate-kb.mjs:17` — a single global `REG_002_CLEARED` boolean is the entire machine-
  readable rights model.
- No rights record exists for `modules/anemia/reference-ranges.json`, and no gate asserts one must
  (`scripts/sign-kb.mjs:41`, `KB_JSON_FILES`).
- Passage records carry `passageFidelity` and epistemic `status`, but no `evidence_item_type`, no
  `rights_component_class`, and no `overall_status` — three axes with two fields, which is a
  fail-open (findings §6).
- Numerics were removed from threshold-bearing passages (`omits-source-numerics` quarantine) with no
  structured locator retained in their place.

---

## 4. Goals & Success Metrics

> **Read this section as measurement, not progress toward clearance.** Every metric below counts
> records, gates, and coverage. None of them counts a cleared source, an attestation, or a grounded
> rule, because this feature produces none of those.

### Primary Goals

**Goal 1: Make the rights position machine-checkable.**
- Every file the release digest covers, and every source the KB cites, resolves to a rights record.
- Success criterion: `npm run validate` fails when a covered artifact has no rights record.

**Goal 2: Restore evidentiary value destroyed by rights-avoidance paraphrasing, lawfully.**
- Re-capture stripped numerics as independently-worded typed atoms with exhaustive structured
  locators, without retaining third-party expression.
- Success criterion: every `omits-source-numerics`-flagged passage either carries a re-captured typed
  atom set with a complete locator, or an explicit, reasoned record of what was deliberately not
  stored.

**Goal 3: Keep three governance axes separate, permanently and structurally.**
- Success criterion: a build in which `evidence_item_type`, `rights_component_class`, passage `status`
  and `overall_status` are conflated or derived from one another fails a dedicated test.

**Goal 4: Prevent a future agent from assuming commercial clearance.**
- `rights/release-context.json` declares `commercial: false`, `use_type: internal_research` — "the
  single highest-leverage artifact in the whole adoption" (findings §5).

### Success Metrics

| Metric | Baseline | Target | Measurement Method |
|---|---|---|---|
| `KB_JSON_FILES` entries with a rights record | 0 of 4 | 4 of 4 | `scripts/validate-rights.mjs` coverage gate |
| KB-cited sources with structured licence/access/terms metadata | 0 of 6 | 6 of 6 | `evidence.schema.json` required fields + validation |
| Passage records carrying an explicit `evidence_item_type` | 0 of 41 | 41 of 41 | schema validation |
| `omits-source-numerics` passages with a re-captured typed atom set **or** an explicit not-stored record | 0 | 100% | WP3 gate |
| Deterministic rights gates wired into `npm run validate` | 0 | ≥ 4 | `package.json` + gate tests |
| Third-party full-text assets in the repo | 0 | **0 (invariant)** | negative-invariant test (FR-WP3-09) |
| Rules grounded by this feature | 0 | **0 — unchanged, by design** | `tests/attestation-ledger-gate.test.mjs` still asserts an empty ledger |
| Sources cleared by this feature | 0 | **0 — unchanged, by design** | no `CLEARED_*` status may be written (D-6) |

---

## 5. Personas (internal — no clinician- or patient-facing surface changes)

**Primary: repo maintainer / future agent.** Needs to know, from the build rather than from memory,
whether a given artifact has an assessed rights position. Today gets prose and one boolean.

**Secondary: the future rights owner (does not exist yet — OQ-2).** The named human who will one day
assign clearance statuses. This feature builds the records they will fill and the ledger that will
show them their queue; it fills none of them. Their absence blocks all clearance work and blocks
nothing in WP0–WP5.

**Tertiary: the future credentialed clinician (does not exist yet).** Adjudicates `derived_synthesis`
candidates and passage attestations. WP4 ships the decision-ready brief that minimises their time
(D-5); it ships zero attestations.

**Quaternary: Research Foundry maintainer.** Consumer of the RF-HANDOFF spec — the generic half of
this model (licence/access-basis/terms fields, the `evidence_item_type` taxonomy, capture-time rights
triage, alternative-source discovery) belongs upstream, as a spec, not as code we write here (D-4).

---

## 6. Binding Constraints (D-1..D-7)

These seven decisions from `.claude/worknotes/rights-aware-evidence-capture/decisions-block.md` §1 are
not open for re-litigation. Each carries a testable acceptance criterion. They subsume `CLAUDE.md`'s
hard guardrails, which are restated here as they apply to this feature:

> **D-numbering map (read before citing a D-number).** The PRD's D-numbers diverge from the binding
> decisions block's for D-4 onward, because the PRD folds the block's two-repo split into its D-4 and
> renumbers the rest. Cite the block by *its* number and the PRD by *its* number; never assume they
> agree.
>
> | Decisions block | PRD | Subject |
> |---|---|---|
> | D1 | D-1 | The archive is provenance, not text |
> | D2 | D-2 | New item types on a measured-vs-judged axis |
> | D3 | D-3 | `derived_synthesis` is the strategic exit |
> | D4 | D-4 | Rights records live in a top-level `rights/` tree with a join ledger |
> | **D5** | **D-4** (second half) | Two-repo split: generic → Research Foundry, specific → here |
> | **D6** | **D-5** | Clinician time is the binding constraint |
> | D7 | D-7 | Do not turn on the hard release gate |
> | *(none — inherited)* | **D-6** | The wave-0 PRD's own **"D-4 discipline"** name, carried here as D-6 |
>
> The implementation plan and phase files use the **decisions-block** numbering (`D1..D7`).

> **Restated `CLAUDE.md` guardrails.** No generative model in the clinical decision path — nothing in
> this feature places one there. No autonomous diagnosis/treatment/dosing. **No invented thresholds** —
> WP3 re-captures values *reported by a source at a recorded locator*; it never authors, adjusts, or
> interpolates a clinical number. **No PHI** — no work package adds patient data collection. **No
> AI-published rule changes** — no rule's clinical meaning changes in this feature. The ranking score
> is untouched.

**D-1 — The archive is provenance, not text.** Maximal capture means maximal *addressable provenance*,
never retained third-party expression. The archive stores independently-worded atoms, exhaustive
structured locators, rights metadata, taxonomy, and appraisal — and records what it deliberately did
*not* store, so the gap is visible rather than mistaken for absence of evidence.

#### AC-D1: No third-party expression enters the repo, and the not-stored gap is explicit
- target_surfaces:
    - `modules/anemia/evidence.json`
    - `rights/` (all files)
    - repository working tree and any new asset directory
- propagation_contract: every capture WP3 performs produces (a) an independently-worded atom, (b) a
  structured locator sufficient to re-fetch and re-bind mechanically — source + edition + section +
  table + row + column + assay + population where each applies, and (c) an explicit
  `not_captured[]` record naming what was deliberately not stored and why.
- resilience: a passage whose locator is incomplete is *not* silently accepted as complete — it
  records the missing locator components explicitly. Missingness is never treated as normal.
- visual_evidence_required: false.
- verified_by: FR-WP3-04, FR-WP3-05, FR-WP3-09 (negative invariant).

**D-2 — New item types on an axis the reviewed spec does not have.** The spec's §5.1 component classes
are a *rights* taxonomy: necessary, insufficient. The decisive distinction is **measured vs. judged**
(findings §2.A: *CCC Information Services v. Maclean Hunter*, 44 F.3d 61 (2d Cir. 1994)). Guidelines
are **captured, not avoided** — that a named body recommends X, with a locator, is itself a fact and
is archivable; its *prose* is not.

**D-3 — `derived_synthesis` is the strategic exit and it starts now.** It ships as a first-class item
type in WP3 with attribution-to-inputs modelled from day one, even though few instances will exist.
Retrofitting provenance onto synthesis is impossible — you cannot reconstruct which inputs a claim
came from once it is written. A `derived_synthesis` item is a clinical claim: same human attestation
requirement as any binding (see D-6).

**D-4 — Rights records live in a top-level `rights/` tree with a join ledger.** Justified in findings
§5 against five repo conventions (RG-9 precedent, `sign-kb.mjs` digest churn, `kb-diff.mjs`
fail-closed classifier cost, fail-open risk of optional inline `extensions`, source-vs-module
scoping). **Explicitly rejected: inline `extensions.rights`.** Also binding here: the generic/specific
two-repo split — anything the CBC module would also need is Research Foundry's (RF-HANDOFF); the
`reference-ranges.json` derived-fact gate, `KB_JSON_FILES` coverage, module wiring,
`validate-rights.mjs`, and everything touching the anemia KB stays here.

**D-5 — Clinician time is the binding constraint; design around it.** The clean-room workflow (spec
§9) is optimised to minimise *clinician* time, not agent time. Agents prepare a decision-ready brief;
the clinician adjudicates. **The brief summarises source guidance and must never quote it into the
implementation record** — otherwise the clean-room is contaminated and the separation-of-duties
defence is lost.

**D-6 — The D-4 discipline extends to every new object type.** (Named `D-4` in
`wave0-safety-foundation-v1` §6; carried here as this feature's D-6. Same rule, new objects.)

#### AC-D6: No agent-authored approval, clearance, or authoritative synthesis
- target_surfaces:
    - `schemas/rights/*.schema.json` (vendored copies)
    - `rights/rights-records.json`, `rights/rights-ledger.json`
    - `modules/anemia/evidence.json` (`derived_synthesis` items)
    - `evidence-packs/passage-attestations.json`
- propagation_contract: no artifact produced by this feature may contain a populated
  `clinicalApprovers[]`, a populated `approvedBy[]`, any `CLEARED_*` clearance status, a
  `review_status` of `counsel_approved`, a populated human/counsel/clinical reviewer field, or a
  `derived_synthesis` item marked authoritative. **The constraints are applied to the field paths
  that actually exist in the vendored v1.0 schemas** (verified against the schema files, not against
  the spec's prose templates):
    - `rights_record.review.human_reviewer` — constrained to `null`
    - `rights_record.review.counsel_reviewer` — constrained to `null`
    - `rights_record.review.review_status` — must not be `counsel_approved`
    - `rights_record.overall_status` — must not be any `CLEARED_*` value
    - `content_reuse_assessment.review.clinical_reviewer` — constrained to `null`
    - `rights_failure.review.reviewed_by` — `maxItems: 0`

  There is **no** `approvals.clinical_owner` field and **no** approver array in `rights_record`;
  `approvals.clinical_owner` appears only in the bundle's non-vendored markdown template, and
  `review.clinical_reviewer` exists only on `content_reuse_assessment`. Naming a non-existent path in
  a constraint is a silent no-op, which is why each path above is enumerated explicitly. (findings §6,
  hazard 1 — the bundle's own examples put the agent identifier `rights-governance-agent` in
  `examples/aap_rights_failure.example.json`'s `review.reviewed_by[]`, and a reviewer identifier in
  `examples/facts_only_reuse_assessment.example.json`'s `review.clinical_reviewer`, actively inviting
  the mistake. The `rights_record` examples are correct — they use `assessed_by_agent`.)
- resilience: `derived_synthesis` items may exist only in a `candidate` state; the authoritative state
  is unreachable without a human attestation record that this feature does not create. Absence of an
  attestation is never read as approval.
- visual_evidence_required: false.
- verified_by: FR-WP0-06, FR-WP3-07, FR-WP4-05, and a dedicated fails-closed test per the D-4
  precedent.

**D-7 — Do not turn on the hard release gate.** Adopting spec §20.2's clearance gate before there is
anywhere to record answers bricks the build for no safety gain. **Every gate this feature ships is
coverage- and consistency-shaped** — *does every shipped artifact have a rights record? do the axes
agree?* — never clearance-shaped — *is this cleared?*
- AC: no gate introduced by this feature reads an `overall_status` value and fails on its *value*;
  gates may fail on the *absence* of the field. A dedicated test asserts a record whose
  `overall_status` is `UNKNOWN` still passes `npm run validate`.

---

## 7. Requirements by Work Package

Point estimates are the decisions-block §2 anchors (EP-R0..EP-R5 map 1:1 onto WP0..WP5).
Waves: **W1** = [WP0, WP5] · **W2** = [WP1, WP2] · **W3** = [WP3] · **W4** = [WP4].
RF-HANDOFF is **not in any wave** — it is already delivered (see the RF-HANDOFF block below).

Serialization barriers (files two work packages would both edit): `schemas/evidence.schema.json` —
WP2 **then** WP3, strictly ordered; `scripts/validate-kb.mjs` — WP1, WP2; `scripts/validate-rights.mjs`
— WP0, WP1, WP2, WP3 (WP0 owns the module and its exported-gate contract; later WPs append gates
only); `package.json` — WP0 only (all gate wiring lands once); `CLAUDE.md` — WP5 only.

### WP0 — Rights substrate (5 pts)

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP0-01 | Create the top-level `rights/` tree (D-4): `release-context.json`, `rights-records.json`, `rights-failures.json`, `rights-ledger.json`. No rights data is written inline into any clinical JSON file. | Must | A test asserts no `extensions.rights` (or equivalent inline rights key) exists in `rules.json`, `candidates.json`, `evidence.json`, or `reference-ranges.json`. |
| FR-WP0-02 | `rights/release-context.json` declares at minimum `commercial: false`, `use_type: internal_research`, plus territory and channel scope, using spec §5.2 intended-use vocabulary. | Must | File validates against the vendored context/manifest shape; a build asserting commercial use against this context fails. |
| FR-WP0-03 | Vendor the 5 spec schemas verbatim under `schemas/rights/` as an interop contract (precedent: `openapi.yaml`) — `rights_record`, `content_reuse_assessment`, `permission_record`, `rights_failure`, `rights_extension`. Vendored copies are byte-traceable to the spec bundle's `checksums.sha256` except for the D-6 null-constraint edits, which are individually annotated. | Must | A test recomputes each vendored file's provenance and fails on an undeclared divergence from the spec bundle. |
| FR-WP0-04 | Seed 6 `rights_records` from RF-EV-003 — one per KB-cited source. `agent_triage_only` is a **`review.review_status`** value, not an `overall_status` value; the two fields are set independently. Each record therefore carries `review.review_status: agent_triage_only` **and** `overall_status: UNKNOWN`. No `CLEARED_*` status is written. | Must | 6 records exist; a test asserts **both** (a) every record's `review.review_status === 'agent_triage_only'` and (b) every record's `overall_status === 'UNKNOWN'`. Asserting only one of the two leaves the other field unchecked and is not sufficient. |
| FR-WP0-05 | `rights/rights-failures.json` cross-links the known open failures to their existing identifiers (REG-002, EP3T5-F01, EP3T5-F02). | Must | Every referenced identifier resolves to an existing record/audit; a dangling reference fails validation. |
| FR-WP0-06 | New `scripts/validate-rights.mjs` — pure exported functions plus a thin CLI, wired into `npm run validate`. Ships ≥ 4 deterministic **coverage/consistency** gates (D-7): (a) bidirectional missing-assessment coverage, (b) blocking-status enum membership (membership, not value-judgement), (c) open-critical-failure presence check, (d) use/territory/channel set-containment against `release-context.json`. | Must | Each gate has a fails-closed resilience test; `npm run validate` exits non-zero when any gate's precondition is unmet. |
| FR-WP0-07 | Any date-sensitive check (e.g. permission expiry) takes `--as-of` or an env value, **never `Date.now()`** — byte-identical determinism, per AC EP3-T2. | Must | Two runs at different wall-clock times against unchanged input produce identical output. |
| FR-WP0-08 | Do not rely on `format: "uri"` — `scripts/lib/json-schema-lite.mjs` silently ignores it (only `date`/`date-time` are checked). Use `pattern`, or record the gap in the schema's own description. | Must | A malformed URI in a rights record is either rejected by a `pattern`, or the schema documents that it is unchecked; silent acceptance with an unannotated `format: "uri"` fails review. |
| FR-WP0-09 | All gate wiring for the entire feature lands in `package.json` in this WP (serialization barrier); later WPs add checks inside `validate-rights.mjs`, not new npm scripts. | Must | `package.json` is untouched by WP1–WP5. |

### WP1 — Derived-fact coverage gap (3 pts)

The findings' single most actionable technical finding: the derived-fact channel
(`reference-ranges.json` → `deriveFacts()` → all 91 rules) is not covered by the passage-level gating
that catches the 32 AAP-citing rules. A rules-only rights sweep misses it entirely (findings §4).

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP1-01 | Author a rights record for `modules/anemia/reference-ranges.json` itself, recording its AAP Table 1 derivation, its **32** numeric values (4 age bands × 2 sexes × `hbLower`/`mcvLower`/`mcvUpper`/`rdwUpper`), that it ships byte-identical to the browser SPA, and — per findings §4 — that AAP is a *redistributor* here (the table is credited to "(ref 42)"), which adds a third-party rightsholder. | Must | Record exists, validates, and names the derived-fact channel explicitly; clearance status stays non-cleared. |
| FR-WP1-02 | Coverage gate: every file in `sign-kb.mjs`'s `KB_JSON_FILES` (`rules.json`, `candidates.json`, `evidence.json`, `reference-ranges.json`) resolves to a rights record via the ledger. | Must | Removing any one of the 4 records fails `npm run validate`; adding a 5th file to `KB_JSON_FILES` without a record also fails. |
| FR-WP1-03 | The gate is bidirectional: a rights record referencing a non-existent artifact also fails. | Must | A ledger entry pointing at a deleted path fails validation. |
| FR-WP1-04 | This WP changes **no** clinical value in `reference-ranges.json` and does not alter `deriveFacts()` behaviour. | Must | Golden-fixture equivalence across all 6 examples shows zero output diff. |
| FR-WP1-05 | WP1 must be independently shippable if WP0's substrate stalls — its gate degrades to a standalone check reading a minimal record set. | Should | The gate's unit tests pass against a fixture directory containing only the `reference-ranges.json` record. |

### WP2 — Source rights metadata (5 pts)

**Serialization barrier: WP2 edits `schemas/evidence.schema.json` before WP3 does.** This is the
largest real safety gain on offer (findings §6): `$defs/source` today records no licence, access
basis, or terms at all.

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP2-01 | Extend `schemas/evidence.schema.json` `$defs/source` with structured `license`, `access_basis`, and `terms` fields using spec vocabulary, under the existing `additionalProperties: false` posture. | Must | Schema migration is atomic — all 6 sources validate in one commit; `npm run validate` exits 0. |
| FR-WP2-02 | Add a `terms_snapshot` reference field recording *what terms were observed and when*, by locator and retrieval date — **never the terms text itself** (D-1). | Must | A source record with a terms snapshot contains no third-party terms prose; FR-WP3-09's invariant covers it. |
| FR-WP2-03 | Encode the AAP block machine-readably: `AAP2026_IDA`'s access basis is subscription, its terms bar altering/abridging/adapting and *incorporating the Materials into other materials*, and `commercial_use: not_granted_by_subscription` (findings §1, Appendix A). This replaces the prose-only record. | Must | A test asserts the AAP source record encodes a non-commercial, non-incorporable access basis; the record is machine-readable, not a free-text note. |
| FR-WP2-04 | Encode `CDC2025_LEAD` as U.S. federal government work under 17 U.S.C. §105 — **and** record the §3.7 distinction the spec conflates: government *works* are uncopyrightable; government-*funded* works by university authors are not (findings §2.B). | Must | The schema's own field descriptions distinguish `government_work` from `government_funded`; a source cannot be marked public domain on funding grounds alone. |
| FR-WP2-05 | New fields must be required (not optional) for every source, with explicit typed `unknown`/null values where genuinely unassessed — an optional field means an unassessed source is silently unassessed, which is the fail-open findings §5 names. | Must | Omitting the field fails validation; an explicit `unknown` passes and is counted as unassessed by the WP0 coverage gate. |
| FR-WP2-06 | Extend `scripts/validate-kb.mjs` so every evidence source resolves to a rights record in the ledger. | Must | A source with no ledger entry fails `npm run validate`. |
| FR-WP2-07 | Resilience: consumers (`src/evidence.js`, `src/engine.js`, `src/app.js`, `scripts/evidence/build-evidence-pack.mjs`) must not throw on a legacy-shaped record encountered mid-migration; absent rights fields render as "rights position unassessed", never as "unrestricted". | Must | A dedicated test feeds a legacy record through each consumer without throwing, and asserts the unassessed rendering. |

### WP3 — Evidence item taxonomy & archive capture (8 pts)

**This is the heart of the feature and the largest payoff.** It carries the measured-vs-judged axis,
`derived_synthesis`, locator enrichment, and re-capture of numerics that rights-avoidance paraphrasing
previously stripped. Depends on WP2's schema landing first.

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP3-01 | Add a required `evidence_item_type` field to every evidence item, with the closed enumeration: `observed_finding`, `reference_interval_value`, `equation_or_method`, `guideline_recommendation`, `instrument_or_questionnaire`, `bibliographic_metadata`, `derived_synthesis` (decisions-block D2). | Must | All 41 passage records carry a value; an unrecognised value fails validation; the enum is closed. |
| FR-WP3-02 | Add a required `judgment_basis` field per item, defaulting to `unassessed` (OQ-1). It records whether the value is measured/observed or committee-judged. **No agent may set it to anything other than `unassessed`** — the determination is legal and routes to counsel. | Must | A test asserts every item this feature produces carries `judgment_basis: unassessed`; a non-`unassessed` value without a human-attested reference fails. |
| FR-WP3-03 | Add a required `rights_component_class` field per item, valued from spec §5.1's component classes. It is **orthogonal** to `evidence_item_type` and must not be derived from it. | Must | See AC-WP3-AXES. |
| FR-WP3-04 | Locator enrichment: every item carries a structured locator with each applicable component individually addressable — source, edition/version, section, table, row, column, assay/method, population/scope — plus retrieval date. Free-text locators are not acceptable where a structured component applies. | Must | A locator that collapses table/row/column into one prose string fails validation for a `reference_interval_value` or table-derived item. |
| FR-WP3-05 | Re-capture numerics. **Scope is the union of two partially overlapping sets** (matching EPR3-T6): (a) the passages carrying an `omits-source-numerics` entry in `reviewFlags` in **`modules/anemia/evidence.json`** — today `WHO2024_HB#ev_001`, `WHO2024_HB#ev_004`, `BSH2020_G6PD#ev_006` — and (b) the HIGH numeric-omission findings in **`docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md`**, which additionally names `AAP2026_IDA#ev_002`. The flag lives in the evidence file; the audit names an overlapping but not identical set, so neither artifact alone is the authoritative scope. For every in-scope passage, capture the reported values as **per-value typed atoms** with full locators — never as a reproduced table (risk hotspot). Each atom is independently worded; the value is the source's *reported* value, transcribed, never authored, adjusted, or interpolated. | Must | See AC-WP3-NUMERICS. |
| FR-WP3-06 | Every item carries a `not_captured[]` record naming what was deliberately not stored (prose, table structure, figures, visual layout) and why. Absence of capture is never left implicit. | Must | An item derived from a table with an empty `not_captured[]` and no rationale fails review; the gap is visible, not inferred. |
| FR-WP3-07 | `derived_synthesis` ships as a first-class item type with attribution-to-inputs modelled from day one: an ordered list of contributing item IDs, the synthesis rationale, and an authorship record. It exists only in a `candidate` state (D-3, D-6). | Must | See AC-D6. A `derived_synthesis` item with no input attribution fails validation; an authoritative-state item is unrepresentable. |
| FR-WP3-08 | `guideline_recommendation` items capture **the fact of the recommendation** — named body, recommendation restated independently, scope/population, locator — and never the recommendation's prose (D-2: "captured, not avoided"). | Must | A `guideline_recommendation` item containing a verbatim span from the source fails FR-WP3-09's invariant. |
| FR-WP3-09 | **Negative invariant (critical risk):** no third-party full text may enter the repository. A dedicated test asserts no captured field contains a verbatim span from a restricted source beyond the length/fidelity policy already enforced by `passageFidelity`, and that no new asset directory holds source documents, tables, figures, or images. **It is a no-regression gate:** the 11 pre-existing near-verbatim spans the audit already records are carried on a named allowlist that may only shrink (deferred as `DEF-R5`, §9); any *new* span fails. | Must | See AC-WP3-NEGATIVE. |
| FR-WP3-10 | `REG_002_CLEARED` stays `false`, and `passageFidelity` stays constrained to `paraphrase`/`withheld`. Numerics re-capture does not touch this constant. | Must | A test asserts `scripts/validate-kb.mjs`'s `REG_002_CLEARED === false` after this WP. |
| FR-WP3-11 | Do not hard-couple the taxonomy to Research Foundry's entity model until OQ-4 is answered — the field names and shapes are defined here and mapped to RF's model through the handoff spec, not by importing it. | Must | No WP3 artifact imports or `$ref`s an RF-owned schema at runtime. |
| FR-WP3-12 | This WP changes no rule, no candidate, and no clinical threshold used by the engine. | Must | Golden-fixture equivalence across all 6 examples shows zero output diff; `npm run check` green. |

#### AC-WP3-AXES: Three axes stay three fields
- target_surfaces:
    - `schemas/evidence.schema.json`
    - `modules/anemia/evidence.json`
    - `rights/rights-records.json`
    - `tests/rights-axis-separation.test.mjs`
- propagation_contract: `evidence_item_type` (epistemic kind) × `rights_component_class` (spec §5.1,
  kind of protected thing) × passage `status` (epistemic) vs `overall_status` (legal) are four
  distinct fields on three orthogonal axes. No field may be computed from, defaulted from, or
  validated as a function of another. A passage may be `source-supported` **and**
  `CONTRACT_RESTRICTED` simultaneously — that is exactly the AAP case (findings §6).
  **Where each axis physically lives:** the three *item-level* axes are `evidence_item_type`,
  `judgment_basis`, and `rights_component_class`, carried on the evidence item in
  `schemas/evidence.schema.json`. The **legal** axis is **not** a field on the item at all — it is
  `overall_status` on the **rights record** (`rights_record.schema.json`), joined to the evidence
  item through `rights/rights-ledger.json`. Any test or gate reading the legal axis resolves it
  through the ledger; an item-level clearance field must never be introduced.
- resilience: `passageFidelity` is **not** duplicated by a `verbatim_excerpt_allowed`-style field;
  two fields that can disagree is a fail-open (findings §6).
- visual_evidence_required: false.
- verified_by: a test that constructs each pairwise combination of axis values, asserts all are
  representable, and asserts no code path infers one axis from another.

#### AC-WP3-NUMERICS: Stripped values return as atoms, not as tables
- target_surfaces:
    - `modules/anemia/evidence.json` (passages whose `reviewFlags` carry `omits-source-numerics` —
      today 3: `WHO2024_HB#ev_001`, `WHO2024_HB#ev_004`, `BSH2020_G6PD#ev_006`)
    - `docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md` (HIGH numeric-omission findings —
      the same three plus `AAP2026_IDA#ev_002`)
    - scope is the **union** of the two; neither artifact alone is authoritative
- propagation_contract: each in-scope passage is resolved to one of exactly two states — (a) a set of
  per-value typed atoms, each with an independently-worded statement, a complete structured locator,
  an `evidence_item_type`, a `rights_component_class`, and `judgment_basis: unassessed`; or (b) an
  explicit not-captured record stating why the values were not re-captured.
- resilience: partial capture is representable and visible — an atom set covering 3 of 5 reported
  values records the 2 uncaptured ones in `not_captured[]`. Silent partial capture fails.
- visual_evidence_required: false.
- verified_by: FR-WP3-05, FR-WP3-06, FR-WP3-09.

#### AC-WP3-NEGATIVE: No third-party full text, ever
- target_surfaces:
    - the entire repository working tree, including any new directory
    - `modules/anemia/evidence.json`, `rights/`, `evidence-packs/`
- propagation_contract: the repo holds locators and independently-worded atoms. It holds no source
  document, no reproduced table, no figure, no image, no brand asset, and no span of restricted prose
  beyond the existing `passageFidelity` policy. **Zone 1 (controlled source vault) must never live in
  this repo** (findings §5).
- resilience: the test is a *positive* structural check over the tree, not a reviewer's assurance.
  Prohibited-excerpt detection is not fully deterministic (residual gap R-1, findings §5) — the
  substitute is the `passageFidelity !== 'verbatim'` check plus a negative asset check, and the
  residual gap is recorded rather than claimed closed. The span check is **no-regression, not
  clean-slate**: the 11 spans the audit already records are on a frozen allowlist (`DEF-R5`) that may
  only shrink; a test asserts every allowlist entry still resolves to a live passage, so a
  re-authored span must be deleted from the list rather than left stale.
- visual_evidence_required: false.
- verified_by: `tests/rights-negative-invariant.test.mjs`; git history is unrecoverable, so this test
  must land before any capture work in FR-WP3-05.

### WP4 — Clean-room authoring workflow (5 pts)

Ships the **brief generator** and the **ledger plumbing**. It ships **zero attestations** (D-5, D-6).

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP4-01 | Author the clean-room workflow doc mapping spec §9's five roles — research reviewer, independent rule author, clinical adjudicator, rights reviewer, technical verifier — onto this repo's actual artifacts and gates, naming which roles are currently unfilled (rights owner OQ-2; credentialed clinician). | Must | Doc exists; every role names its output artifact and states whether a qualifying human exists today. |
| FR-WP4-02 | Deterministic brief generator: given an item or binding, emits a decision-ready brief containing independently-worded atoms, locators, scope/population, rights position, and the specific question the human must answer. | Must | Re-running the generator against unchanged input reproduces byte-identical output. |
| FR-WP4-03 | **Clean-room contamination guard:** the brief summarises source guidance and never quotes it into the implementation record. | Must | A test asserts no generated brief contains a verbatim span from a restricted source; contaminating a brief fails the gate, not merely a review. |
| FR-WP4-04 | Ledger plumbing: a rights-decision ledger entry shape that a future rights owner fills, joined bidirectionally to rights records and evidence items — reusing the RG-9 attestation-ledger seam (`loadAttestationLedger` / `validateBindingsAgainstLedger`) rather than a second validator. | Must | Ledger validates bidirectionally; a dangling entry in either direction fails. |
| FR-WP4-05 | Any future `counsel_approved` / clearance entry must pass the same *positive* checks as RG-14/16/17 — closed credential list, realpath-canonical `attestationRef` under `docs/attestations/`, calendar-valid date — reusing `attested-passage-map.mjs`. This WP ships the check; it ships no entry. | Must | The check exists and is exercised by a fixture; the live ledger is empty and a test asserts it. |
| FR-WP4-06 | The generator may **prepare** `derived_synthesis` candidates. It may never mark one authoritative, and it may never write an attestation, an approval, or a clearance. | Must | See AC-D6. |
| FR-WP4-07 | Design for clinician minutes, not agent minutes (D-5): the brief is one screen per decision, with the question stated first. | Should | Each generated brief states its decision question in the first block and fits a single reviewable unit per decision. |

### WP5 — Spec amendments & doc truth (3 pts)

Parallelizable throughout (W1). **`CLAUDE.md` is edited only by this WP** (serialization barrier).

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP5-01 | Amend the vendored/reference spec §15: split the single "numeric threshold" row into *measured/observed value* vs *consensus/judgment-derived recommendation*, routing the latter to `LEGAL_REVIEW_REQUIRED` rather than facts-only candidate (findings §2.A). | Must | §15 contains both rows with distinct routing; the amendment is recorded as an amendment, not a silent edit. |
| FR-WP5-02 | Add *Feist*, *CCC Information Services v. Maclean Hunter* (44 F.3d 61 (2d Cir. 1994)), and *ADA v. Delta Dental Plans Ass'n* (126 F.3d 977 (7th Cir. 1997)) to the spec's Appendix B. | Must | All three appear with correct citation; each is cited from the body, not only listed. |
| FR-WP5-03 | Fix §3.7's conflation of government *works* (uncopyrightable, 17 U.S.C. §105) with government-*funded* works (copyrighted; abundant in the PMC corpus this project searches). | Must | §3.7 draws the line explicitly and flags the PMC trap. |
| FR-WP5-04 | Re-attach §16.1's contract caveat to §16.2 — re-wording does not defeat a contractual prohibition on *incorporating the Materials into other materials*; copyright and contract are separate questions (findings §2.D). | Must | §16.2 carries the caveat inline, not by cross-reference alone. |
| FR-WP5-05 | Scope §3.2's EU sui generis database-right discussion: note territorial scoping (irrelevant to a US-only product) and the CJEU *British Horseracing Board* / *Fixtures Marketing* carve-out excluding investment in **creating** data (findings §2.C). | Should | §3.2 records both qualifications; the section no longer discourages a viable path unconditionally. |
| FR-WP5-06 | Citation hygiene (findings §2.E): cite or remove `[S7]`; de-overload `[S1]`/`[S14]`; correct `[S11]`'s pin-cite; use the ELI permalink for `[S13]`; annotate that `[S5]`/`[S6]`/`[S7]` AAP URLs 403 to automated clients so the "Verified" stamps are not machine-reproducible; pin `[S15]` FDA CDS guidance to **January 29, 2026** if an exact date is given. | Must | Each item is resolved or explicitly annotated as an accepted limitation. |
| FR-WP5-07 | **Fix `CLAUDE.md`'s stale `npm run check` composition.** `CLAUDE.md:50-51` states `npm test + npm run validate + npm run build + npm run check:imports + npm run smoke`. The authoritative composition in `package.json` is: `test && validate && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`. | Must | `CLAUDE.md` matches `package.json` exactly; a doc-truth check (or reviewer step) compares the two strings. |
| FR-WP5-08 | Record in `CLAUDE.md` / project memory the corrected picture: the 0/91 gap is ~2/3 attestation-shaped (60 rules) and ~1/3 licensing-shaped (31 rules) — **not wholly licensing-shaped** — and **13 bindable passages exist today**, a fact currently recorded nowhere (findings §3, §7 recommended actions 3–4). | Must | Both statements appear with their counts and their source citation. |
| FR-WP5-09 | Update `NOTICE.md` and `docs/architecture.md` §7 to describe the `rights/` tree, the release context, and the coverage-only gate posture. | Must | Both documents describe the shipped artifacts; neither implies any clearance exists. |
| FR-WP5-10 | Record the residual gap R-1 (prohibited-excerpt detection is not deterministic) explicitly, rather than implying the negative invariant is complete. | Must | The gap is named in `docs/architecture.md` §7 and in the closeout record. |

### RF-HANDOFF — Research Foundry spec handoff (**delivered**; no repo code)

> **Status: already authored and committed** —
> `docs/project_plans/research/research-foundry-rights-entity-model-handoff-v1.md`. It is **not**
> scheduled work, not a phase, and not point-estimated: it produced a spec document for an upstream
> repo, not code here (decisions-block §2). The `FR-RFH-*` requirements below are therefore recorded
> **retrospectively**, as the acceptance criteria the delivered document is measured against — not as
> work W1 will perform. The implementation plan reflects this: EP-R0's vendoring and EP-R3's taxonomy
> both cite the delivered document's §9 conflict list; neither waits on it.

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-RFH-01 | The handoff spec proposed, for Research Foundry, the generic half of this model (D-4): licence / access-basis / terms fields on source and evidence entities; the `evidence_item_type` taxonomy and the measured-vs-judged axis; **`derived_synthesis` as a first-class item type with attribution-to-inputs and an agent-unwritable attestation state**; capture-time rights triage and terms snapshotting; alternative-source discovery when a source is restricted. | Must | **Met.** The delivered spec covers all five capability areas (its §2–§5 plus §7's spec amendments) and is a spec, not code written into `research-foundry`. |
| FR-RFH-02 | Apply the boundary rule explicitly: **if the CBC module would need it too, it is Research Foundry's.** The spec states why the requested scope is generic. | Must | **Met.** Genericity is argued **per capability**, not per field — the delivered §1.2 states the boundary test and applies it to each capability area. A per-field rationale was neither delivered nor required; per-capability is the criterion. |
| FR-RFH-03 | Delivered before WP3 begins, so the two-repo line is drawn before the taxonomy is built. | Must | **Met.** The document is authored and committed ahead of every phase in this plan; EP-R3's phase file cites it (handoff §9.1, §9.5). |
| FR-RFH-04 | Record OQ-4 as open: RF may counter-propose a different entity model. The spec must not assume acceptance. | Must | **Met.** The delivered §9 lists six conflicts explicitly "for RF to adjudicate", and §10 carries the open questions; FR-WP3-11 keeps this repo decoupled meanwhile. |

---

## 8. Non-Functional Requirements

**Axis separation (structural, not documentary).** `evidence_item_type` (epistemic kind) ×
`rights_component_class` (spec §5.1) × passage `status` (epistemic) vs `overall_status` (legal) are
three orthogonal axes carried in four separate fields. None may be derived from, defaulted from, or
validated as a function of another. Conflation is a fail-open and was flagged as such by the findings
(§6). Enforced by AC-WP3-AXES.

**Coverage gates only, never clearance gates (D-7).** Every gate this feature ships answers "does
every shipped artifact have a rights record / do the axes agree?" It never answers "is this cleared?"
A record whose `overall_status` is `UNKNOWN` must pass the build.

**No new clinical claims.** No rule, candidate, threshold, or reference-range value changes in
clinical meaning. WP3 transcribes values *reported by sources at recorded locators*; it authors none.
Golden-fixture equivalence across the 6 examples is zero-diff at every WP boundary.

**Determinism.** Every gate and generator is deterministic and offline. Date-sensitive checks take
`--as-of`/env, never `Date.now()` (AC EP3-T2). Re-running any generator against unchanged input
reproduces byte-identical output.

**Fail-closed by default.** New fields are required with explicit typed `unknown` values rather than
optional — an optional field means an unassessed artifact is silently unassessed. Coverage is
validated bidirectionally.

**Zero-runtime-dependency posture preserved.** `package.json` gains no `dependencies` or
`devDependencies` without a written rationale (the wave-0 D-5 posture). `json-schema-lite`'s
`format: "uri"` blind spot is worked around with `pattern`, not with a new validator library.

**No PHI, no third-party assets.** The browser assessment continues to send no patient data anywhere.
No third-party fonts, scripts, source documents, tables, figures, or brand assets enter the repo.

**Digest-axis separability.** Rights data lives outside the clinical files so that a rights re-review
does not mutate `clinicalContentHash` and force a new signed release (findings §5).

**No generative model in the clinical decision path.** Nothing in this feature places one there. The
brief generator produces a human-facing decision aid; it makes no patient-specific decision and
publishes nothing.

---

## 9. Scope

### In Scope

- WP0–WP5 as specified in §7. The RF-HANDOFF spec deliverable is **already delivered**, so it is
  recorded in §7 for traceability rather than scheduled as in-scope work.
- The anemia module only; `rights/` is source-scoped and will serve future modules without
  duplication, but no other module is registered in this feature.
- Amendments to the reviewed rights spec (WP5) and the doc-truth corrections it carries.

### Out of Scope

- **Any clearance decision.** No `CLEARED_OPEN_LICENSE`, `CLEARED_PUBLIC_DOMAIN`,
  `CLEARED_FACTS_ONLY`, or `CLEARED_PERMISSION` status is written by this feature — including for the
  7 CDC/public-domain rules the findings identify as genuinely unblockable. Writing them requires the
  rights owner who does not yet exist (OQ-2).
- **Any attestation.** `tests/attestation-ledger-gate.test.mjs` continues to assert an empty ledger,
  and this feature does not modify that assertion.
- **Any grounded rule.** 0 of 91 before, 0 of 91 after.
- **Spec §20.2's hard release gate** (D-7) — deferred until there is somewhere to record answers.
- **Per-component reuse assessments, permission records, counsel review, Zone 0–5 enforcement,
  surveillance** — findings §5 "Deferred (do not attempt)".
- **Zone 1 controlled source vault** — must never live in this repo (findings §5).
- **Re-authoring the 11 pre-existing near-verbatim spans (deferred as `DEF-R5`).** The audit
  (`docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md`) records ~11 spans of 7–13 words sitting
  under `passageFidelity: paraphrase` — `FDA2026_CDS#ev_002`–`#ev_005`; `BSH2020_G6PD#ev_003`,
  `#ev_005`, `#ev_007`; and the shorter spans in `AAP2026_IDA#ev_005`, `CDC2025_LEAD#ev_001`,
  `#ev_003`, `BSH2020_G6PD#ev_002`. No requirement in this feature re-words them, so **FR-WP3-09's
  invariant is a no-regression gate**: it allowlists exactly those spans, the allowlist may only
  shrink, and any *new* near-verbatim span fails the build. **Promotion trigger:** either a
  re-authoring pass is scheduled (naturally at the EP-R3 re-capture seam, which touches the same
  passages), or the allowlist is observed non-shrinking across two consecutive phases — at which
  point the debt is accumulating and DEF-R5 promotes to scheduled work. DEF-R5 closes when the
  allowlist is empty. Tracked in the implementation plan's Deferred Items triage table.
- **`rightsHash` / `KB_JSON_FILES` membership changes** — normative under SPIKE-006 Amendment 1.
- **Re-anchoring the 44 single-review-article rules onto primary studies** (OQ-3) — real re-synthesis
  cost, not decided in this feature.
- **Answering the measured-vs-judged question** (OQ-1) — a legal determination; every item ships
  `judgment_basis: unassessed`.
- **Writing code into `research-foundry`** — RF-HANDOFF is a spec, not an implementation (D-4).
- **Any AAP licence negotiation.** Buying more AAP *access* makes the rights position worse, not
  better (findings §7).

---

## 10. Dependencies & Assumptions

### SPIKE waiver

**`spike_ref: []` — waived deliberately**, per `.claude/worknotes/rights-aware-evidence-capture/decisions-block.md`
§0. Tier 3 normally requires a SPIKE; the feasibility work is already done and merged (`cd15b4a`):
four investigation legs plus three adversarial verifiers established the current blocking state, the
source-by-source delta, the citation verification, and the integration cost. Authoring a SPIKE now
would restate merged findings. The one genuinely unresolved question — measured vs. committee-judged
(OQ-1) — is a legal determination that no SPIKE can close; it routes to counsel and is an explicit
non-blocker for every WP here.

### Internal Dependencies

- **Merged wave-0 EP-3/EP-4/EP-5 work** — `schemas/evidence.schema.json`'s passage records,
  `scripts/evidence/build-evidence-pack.mjs`, `scripts/validate-kb.mjs`'s ledger seam,
  `scripts/sign-kb.mjs`'s `KB_JSON_FILES`, and `scripts/kb-diff.mjs`. All present; this feature
  extends rather than replaces them.
- **RF-EV-003** (`.claude/findings/rf-ev-003-oa-substitute-findings.md`) — the seed for WP0's 6
  `rights_records` at `agent_triage_only`.
- **`docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md`** — the authoritative enumeration of
  `omits-source-numerics`-flagged passages that WP3's re-capture must resolve.
- **The reviewed spec bundle** (`docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/`)
  — 5 JSON Schemas vendored by WP0, amended by WP5.
- **WP2 → WP3 schema ordering** is a hard serialization barrier on `schemas/evidence.schema.json`.
- **`json-schema-lite`** silently ignores `format: "uri"` — a known limitation, worked around in
  FR-WP0-08.

### External / Human Dependencies (neither is an engineering task)

- **A named rights owner (OQ-2)** — does not exist. Blocks all clearance work; blocks **nothing** in
  WP0–WP5.
- **A credentialed clinician** — does not exist for this program. Blocks all attestation and all
  authoritative `derived_synthesis`; blocks nothing in WP0–WP5.
- **Counsel (OQ-1)** — the measured-vs-judged determination. Blocks nothing here.

### Assumptions

- Node ≥ 20 remains the floor; `npm run check` remains the commit gate.
- The zero-dependency posture holds.
- `REG_002_CLEARED` stays `false` for the duration of this feature.
- Agent routing uses **registered agent types only** (`general-purpose`, `Explore`, `Plan`); the
  implementation plan must not name `codebase-explorer`, `senior-code-reviewer`,
  `implementation-planner`, or `prd-writer`, which are not registered in this environment
  (decisions-block §3).
- The estimate anchors against merged work: wave-0 EP-3+EP-4 shipped at ~8 pts, EP-5 at ~5. WP3 is
  anchored **above** EP-3+EP-4 (taxonomy design plus data re-capture across 41 passages); WP1 below
  EP-5 (one record plus one loop). **If WP3 exceeds 10 points during execution, split it at the
  taxonomy / re-capture seam rather than compressing the re-capture** (decisions-block §5).

### Feature Flags

None. `REG_002_CLEARED` is an existing constant this feature does not flip.

---

## 11. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|:-:|---|
| An agent writes a `CLEARED_*` status, `clinicalApprovers[]`, `approvedBy[]`, `counsel_approved`, or an authoritative `derived_synthesis`. | **Critical** | D-6 / AC-D6. Schema-level `maxItems: 0` / null-constraints in the vendored copies, on the real field paths enumerated in AC-D6 (the bundle's `examples/aap_rights_failure.example.json` sets `review.reviewed_by: ["rights-governance-agent"]`, and `examples/facts_only_reuse_assessment.example.json` sets `review.clinical_reviewer: "pediatric-hematology-reviewer"` — the two places an identifier lands in a human-reviewer field, actively inviting this; the `rights_record` examples themselves correctly use `assessed_by_agent`); a fails-closed test per the D-4 precedent; the authoritative `derived_synthesis` state is structurally unrepresentable. |
| Restricted source text enters the repo "for the archive". | **Critical** | D-1 boundary; FR-WP3-09 negative-invariant test landed **before** any capture work; no Zone 1 vault in this repo; git history is unrecoverable, so prevention is the only control. |
| Numerics re-capture (WP3) reintroduces verbatim table structure. | High | Per-value atoms with locators, never a reproduced table (FR-WP3-05); `not_captured[]` records the structure deliberately omitted; `REG_002_CLEARED` stays `false`. |
| Adopting spec §20.2's clearance gate bricks the build. | High | D-7 — coverage and consistency gates only; a test asserts an `UNKNOWN` clearance still passes `npm run validate`. |
| Three axes get collapsed into one status field. | High | Separate fields enforced by schema; AC-WP3-AXES constructs every pairwise combination; no `verbatim_excerpt_allowed` field duplicating `passageFidelity`. |
| The archive is mistaken for evidence of clearance — "we have rights records, therefore we have rights". | High (reputational) | §13 Honesty criteria; `release-context.json` declares `commercial: false`; the closeout record states zero clearances explicitly. |
| Two-repo drift: this repo implements what Research Foundry should own. | Medium | D-4 boundary rule; RF-HANDOFF authored in W1 before WP3; FR-WP3-11 forbids hard coupling until OQ-4 resolves. |
| `json-schema-lite` silently ignores `format: "uri"`, so a malformed locator validates. | Medium | FR-WP0-08 — use `pattern`, or document the gap in the schema description. |
| WP2/WP3 both edit `schemas/evidence.schema.json` and collide. | Medium | Declared serialization barrier: WP2 lands first, strictly ordered; WP3 branches from WP2's merge. |
| Atomic schema migration under `additionalProperties: false` (all 6 sources, all 41 passages at once). | Medium | Schema-first, then a mechanical backfill, then validate, in one commit, reviewed as a diff of generated content; explicit typed `unknown` rather than omission. |
| Prohibited-excerpt detection is not deterministic (residual gap R-1). | Medium | Substitute the `passageFidelity !== 'verbatim'` check plus a negative asset check; **record the gap** (FR-WP5-10) rather than claiming it closed. |
| Clinician time is consumed by badly-shaped briefs. | Medium | D-5; FR-WP4-02/07 — deterministic, one decision per brief, question first; contamination guard (FR-WP4-03) prevents a rework loop. |

---

## 12. Target State (Post-Implementation)

**Rights substrate:** a top-level `rights/` tree exists with a release context declaring
`commercial: false`, 6 seeded source rights records at `agent_triage_only`, a cross-linked failures
file, and a bidirectional join ledger. No rights data lives inline in any clinical JSON file, so a
rights re-review does not churn `clinicalContentHash`.

**Coverage:** all 4 `KB_JSON_FILES` entries and all 6 KB-cited sources resolve to rights records.
Removing a record, or adding a covered artifact without one, fails `npm run validate`. The
derived-fact channel — `reference-ranges.json`'s 32 values → `deriveFacts()` → all 91 rules — is
inside the gate for the first time.

**Source metadata:** `evidence.schema.json`'s `$defs/source` carries structured licence, access basis,
and terms with a locator-only terms snapshot. The AAP block is machine-checkable rather than prose;
`CDC2025_LEAD`'s public-domain basis is recorded as a government *work*, distinguished from
government-*funded*.

**Taxonomy:** all 41 passage records carry `evidence_item_type`, `rights_component_class`, and
`judgment_basis: unassessed` on three orthogonal axes, alongside the existing epistemic `status` and
`passageFidelity`. `derived_synthesis` exists as a first-class candidate type with modelled
attribution-to-inputs and no reachable authoritative state.

**Archive:** every `omits-source-numerics` passage resolves to per-value typed atoms with exhaustive
structured locators, or to an explicit not-captured record. The repo contains no third-party full
text, table, figure, or brand asset, and a test enforces it.

**Workflow:** a deterministic brief generator plus ledger plumbing exists for a rights owner and a
clinician who do not yet exist. Both queues are empty and visibly so.

**Observable outcomes:** `npm run check` green throughout; `CLAUDE.md` matches `package.json`; the
project's own record of its blocking state is corrected to 60 attestation-shaped / 31
licensing-shaped with 13 bindable passages.

**What has not changed:** 0 of 91 rules grounded. 0 sources cleared. 0 attestations. The attestation
ledger is still empty and the test still asserts it. `REG_002_CLEARED` is still `false`.

---

## 13. Overall Acceptance Criteria (Definition of Done)

### Functional
- [ ] FR-WP0-01 through FR-WP5-10 implemented; each stated acceptance criterion passes.
      (FR-RFH-01..04 are already met by the delivered handoff spec — verify, do not re-author.)
- [ ] AC-D1, AC-D6, AC-WP3-AXES, AC-WP3-NUMERICS, AC-WP3-NEGATIVE all pass as tests, not as review
      assertions.
- [ ] All 4 `KB_JSON_FILES` entries and all 6 KB-cited sources resolve to rights records, verified
      bidirectionally.
- [ ] All 41 passage records carry the three new axis fields.

### Technical
- [ ] `npm run check` green at every WP boundary, using the authoritative composition
      (`test && validate && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`).
- [ ] Zero new runtime or build dependencies, or exactly one with a recorded rationale.
- [ ] Schema migrations land atomically — all records validate in the same commit as the schema change.
- [ ] Every gate and generator is deterministic: two runs against unchanged input produce byte-identical
      output; no `Date.now()` in any gate.
- [ ] Golden-fixture equivalence across all 6 examples shows zero output diff; no rule, candidate, or
      reference-range value changed in clinical meaning.
- [ ] `WP2` merged before `WP3` begins (serialization barrier on `schemas/evidence.schema.json`).

### Honesty (this feature's own hard guardrail)
- [ ] **This feature ships zero clearances.** No `CLEARED_*` status exists in any artifact it produces
      — including for the 7 CDC/public-domain rules the findings identify as unblockable. A test
      asserts it.
- [ ] **This feature ships zero attestations.** `tests/attestation-ledger-gate.test.mjs` still asserts
      an empty ledger, unmodified, and still passes.
- [ ] **This feature grounds zero rules.** 0 of 91 before, 0 of 91 after; no rule's binding strength
      changes.
- [ ] No artifact produced by this feature populates `clinicalApprovers[]`, `approvedBy[]`,
      `rights_record.review.review_status: counsel_approved`, `rights_record.review.human_reviewer`,
      `rights_record.review.counsel_reviewer`, `content_reuse_assessment.review.clinical_reviewer`, or
      `rights_failure.review.reviewed_by[]` from any source — including agent, ARC, or council output.
- [ ] Every `derived_synthesis` item is a candidate; no authoritative one exists, and the authoritative
      state is structurally unreachable without a human attestation this feature does not create.
- [ ] Every item ships `judgment_basis: unassessed`; the measured-vs-judged determination (OQ-1) is
      recorded as open and routed to counsel, never inferred by an agent.
- [ ] No gate introduced by this feature fails on the *value* of an `overall_status` (D-7); a record
      at `UNKNOWN` passes the build, and a test proves it.
- [ ] The closeout record states plainly that the rights position is now **measured, not improved** —
      that this feature unblocked no source, and that the two named bottlenecks (a credentialed
      clinician, a named rights owner) remain unfilled and are not engineering tasks.
- [ ] Residual gap R-1 (prohibited-excerpt detection is not deterministic) is recorded as open, not
      implied closed.
- [ ] Every current-state number quoted in shipped documentation cites
      `.claude/findings/rights-governance-spec-v1.0-review-findings.md`; no new number is invented.

### Quality
- [ ] The negative-invariant test (FR-WP3-09) lands **before** any WP3 capture work.
- [ ] Every new gate has a fails-closed resilience test proving it fails when its precondition is unmet,
      not only that it passes on good input.
- [ ] Consumer resilience tests (FR-WP2-07) prove no consumer throws on a legacy-shaped record and none
      renders an unassessed rights position as unrestricted.
- [ ] `CLAUDE.md`'s `npm run check` string is byte-identical to `package.json`'s.

---

## 14. Open Questions

Carried from the decisions block §6. Each is binding scope for whatever it gates until resolved; none
blocks WP0–WP5.

- [ ] **OQ-1 (counsel; blocks nothing here):** For each threshold family, is the value measured/observed
      or committee-judged? Drives `evidence_item_type` and, later, clearance. **A:** recorded per-item as
      `judgment_basis: unassessed` until answered. No agent may resolve it.
- [ ] **OQ-2 (rights owner):** Who holds the role? **A:** unfilled. Blocks all clearance work; blocks
      nothing in WP0–WP5. Not an engineering task.
- [ ] **OQ-3 (product strategy):** Re-anchor the 44 rules resting on one *Blood* review article onto
      primary studies? Strengthens the facts-only position and removes single-source dependency, at real
      re-synthesis cost. **A:** not decided in this feature.
- [ ] **OQ-4 (Research Foundry):** Does RF accept the handoff spec as-authored, or counter-propose a
      different entity model? **A:** open. WP3 must avoid hard-coupling to RF's shape until answered
      (FR-WP3-11).

---

## 15. Appendices & References

### Related Documentation
- Decisions block (binding): `.claude/worknotes/rights-aware-evidence-capture/decisions-block.md`.
- Feasibility base: `.claude/findings/rights-governance-spec-v1.0-review-findings.md` (merged
  `cd15b4a`) — the source of every current-state number in this PRD.
- Reviewed spec: `docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.md`
  — §5.1 component classes, §5.2 intended-use classes, §6 decision statuses, §9 clean-room roles,
  §15 decision matrix, §16 AAP guidance, §20 release governance, §21 sourcing strategy.
- RF-EV-003 substitute discovery: `.claude/findings/rf-ev-003-oa-substitute-findings.md`.
- Passage fidelity audit: `docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md`.
- Prior PRD (D-4 discipline origin): `docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md`.
- Evidence Foundry track: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md`.
- Guardrails: `CLAUDE.md`; notices: `NOTICE.md`; architecture: `docs/architecture.md` §7.

### Symbol References
- `KB_JSON_FILES` / `KB_SOURCE_FILES` (`scripts/sign-kb.mjs:41-42`) — the coverage set WP1 gates against.
- `REG_002_CLEARED` (`scripts/validate-kb.mjs:17`) — stays `false`; the constant this feature does not flip.
- `loadAttestationLedger` / `validateBindingsAgainstLedger` (`scripts/evidence/lib/attested-passage-map.mjs`)
  — the RG-9 seam WP4's ledger plumbing reuses rather than duplicating.
- `isBindableAsSourceSupported` (`src/evidence.js`) — the epistemic-axis predicate that must stay
  independent of the legal axis.
- `validate` (`scripts/lib/json-schema-lite.mjs`) — checks only `date`/`date-time` formats; `format: "uri"`
  is silently ignored (FR-WP0-08).
- `deriveFacts` (`modules/anemia/facts.anemia.js`) — consumer of `reference-ranges.json`'s 32 values;
  the derived-fact channel WP1 brings inside the gate.

### Prior Art
- Commit `cd15b4a` — the merged review findings this feature implements.
- Merged wave-0 phases EP-3+EP-4 (evidence provenance + rule governance, ~8 pts) and EP-5 (manifest +
  semantic diff, ~5 pts) — the estimation anchors for WP3 and WP1 respectively.
- RG-1 (the mechanical binder that produced provably wrong bindings and was removed, not fixed) — the
  precedent for why an agent-authored `CLEARED_*` status is unacceptable.

### Legal authorities referenced (as spec-amendment scope, not as legal advice)
- *Feist Publications v. Rural Telephone Service*, 499 U.S. 340 (1991) — the fact/expression line.
- *CCC Information Services v. Maclean Hunter Market Reports*, 44 F.3d 61 (2d Cir. 1994) — editorial
  judgment as protected expression.
- *ADA v. Delta Dental Plans Ass'n*, 126 F.3d 977 (7th Cir. 1997) — taxonomy copyrightability.
- 17 U.S.C. §105 — U.S. federal-government works.
- Directive 96/9/EC Art. 7(1) and the CJEU *British Horseracing Board* / *Fixtures Marketing* line —
  EU sui generis database right and the creation-vs-obtaining distinction.

> Nothing in this PRD is legal advice or clinical sign-off. Automated checks introduced here prove
> *software behavior* — that records exist, that axes are separate, that no third-party text is
> present — never clinical validity, never rights clearance.

---

**Progress Tracking:**

See progress tracking once the implementation plan is authored:
`.claude/progress/rights-aware-evidence-capture/all-phases-progress.md`
