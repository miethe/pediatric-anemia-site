---
doc_type: workflow
title: "Clean-Room Authoring Workflow"
status: draft
created: 2026-07-21
phase: EP-R4
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
spec_ref: docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.md
---

# Clean-Room Authoring Workflow (FR-WP4-01)

## What this document is

The Research Foundry and Evidence Foundry Source Reuse & Rights Governance Specification v1.0
(`spec_ref` above), §9, describes a five-role separation-of-duties pattern for authoring
high-risk guideline or knowledge-base content without copying a restricted source's expressive
structure into the implementation record. This document maps each of those five roles onto the
**real artifacts and gates that exist in this repository today**, and states plainly, per role,
whether a qualifying human currently performs it.

**Read this before reading it as reassurance.** It is an inventory, not a certification. Naming
the artifact a role *would* produce is not the same as the role having been performed by a
qualifying person. Every "human today: No" below is load-bearing.

## Binding framing (do not skip)

- **No role in this workflow is filled by an agent, ARC/`council-review` output, or an `rf`
  synthesis, and none of the mappings below should be read that way.** This project has an
  ARC (Agent Review Council) pediatric-clinical-council run with a completed synthetic readiness
  audit on file; that audit is **non-qualifying** — it is not clinical adjudication, not a rights
  review, and not a technical verification of anything shipped here. If a future reader is
  tempted to cite that ARC run, or any other agent/council output, as satisfying one of the five
  roles below, that reading is wrong and this paragraph is the correction.
- **D6 governs every role mapping here.** No code path in this repository may write a
  `CLEARED_*` status, a `clinicalApprovers[]` / `approvedBy[]` member, `counsel_approved`, or an
  authoritative `derived_synthesis`. Where a role's real artifact touches one of those surfaces,
  the artifact ships schema-forced empty/null, and the gate below proves that, not the opposite.
- **This document adds no new gate and changes no schema.** It is a map of what Phases EP-R0
  through EP-R3 (and the pre-existing wave-0 rule-authoring substrate) already shipped, read
  through the spec's five-role lens. Where this feature's own WP4 work (the brief generator, the
  contamination guard, the rights-decision ledger — EPR4-T2 through EPR4-T6) adds a *future*
  output artifact for a role, that is marked "not yet built" explicitly.

## The five roles

### 1. Research reviewer

**Spec responsibility:** lawfully access sources; extract atomic facts, methods, population
limits, and locators; never copy expressive structure into the implementation brief; record
rights constraints.

**Real artifact(s) in this repo:**
- `modules/anemia/evidence.json#sources[].passages[]` — each passage carries an independently
  worded `exactPassage` (paraphrase, never verbatim source wording), `passageFidelity`,
  `evidence_item_type`, a `structured_locator{}` object (section/table/row/column/assay/
  population/retrieved-at), and a `not_captured[]` array naming what was deliberately not stored
  and why (D1).
- `rights/rights-records.json` — one triage-only `rights_record` per cited source, recording
  access basis, copyright status, and component decisions as `unknown`.

**Gate(s):**
- `tests/rights-negative-invariant.test.mjs` — no third-party full text, table, figure, or brand
  asset anywhere in the tree (D1).
- `tests/rights-evidence-item-locator.test.mjs` and `scripts/validate-rights.mjs`'s
  `checkEvidenceItemLocatorCapture` — every `omits-source-numerics`-flagged passage carries either
  a complete structured locator or an explicit `not_captured` record.
- `tests/rights-evidence-numeric-recapture.test.mjs` / `checkNumericRecaptureResolution` —
  numerics are re-captured as per-value atoms with locators, never a reproduced table.

**Human today: No.** The atomic extraction and paraphrase work in `modules/anemia/evidence.json`
was performed by agents running the `scripts/evidence/*` backfill scripts, committed under
repo-maintainer review at PR time. Every seeded rights record for the sources those passages draw
on sits at `review.review_status: agent_triage_only` — that status itself is the honest record
that no qualifying research reviewer has signed off on the extraction or the rights-constraint
read. The agent output here is preparatory scaffolding a future research reviewer would inherit,
not a completed instance of the role.

### 2. Independent rule author

**Spec responsibility:** receive approved evidence atoms and clinical requirements; write the
deterministic rule, variable names, ordering, and explanations independently; never reuse copied
source tables, diagrams, or prose.

**Real artifact(s) in this repo:**
- `modules/anemia/rules.json` (91 rules), each carrying `owner` (a schema-pattern-enforced
  `role:`/`team:` string, never a person's name), `changeRationale`, and `sourcePassageId`
  linking to one exact passage record rather than to a source table.

**Gate(s):**
- `schemas/rule.schema.json` — `additionalProperties: false`; `clinicalApprovers` is
  schema-forced to `maxItems: 0`.
- `tests/rule-governance.test.mjs`, `tests/rule-coverage.test.mjs`,
  `tests/rule-governance-resilience.test.mjs`.

**Human today: No qualifying (credentialed clinical) rule author exists.** The 91 rules were
engineer-authored as part of the pre-existing wave-0 safety substrate, independently of any
source table's row/column structure, but `docs/architecture.md` §7 records the honest state
directly: "No credentialed clinical approver has approved any rule in this knowledge base," and
`clinicalApprovers[]` ships schema-forced `[]`. Independent authorship (no copied tables) is
structurally true; independent *credentialed clinical* authorship is not established.

### 3. Clinical adjudicator

**Spec responsibility:** confirm clinical fidelity, scope, exclusions, and safety exits; document
expert judgment separately from source-stated evidence.

**Real artifact(s) in this repo:**
- `derived_synthesis` items in `schemas/evidence.schema.json` / a module's
  `evidence.json#derived_syntheses[]` — reachable only in a `candidate` state; `attestation_record`
  is the field this role would eventually fill (D3/D6).
- `evidence-packs/passage-attestations.json` — the attestation surface a clinical adjudicator
  would eventually write a rule/candidate-to-passage sign-off into, via
  `scripts/evidence/lib/attested-passage-map.mjs`.
- **Not yet built** (this same phase, later tasks): the decision-ready brief
  (`scripts/rights/build-decision-brief.mjs`, EPR4-T2/T6) this role would read from, one decision
  per screen, question first.

**Gate(s):**
- `tests/rights-derived-synthesis.test.mjs` — the committed KB ships **zero** `derived_synthesis`
  instances, and any that ever exist are `candidate`-only with input attribution, never
  authoritative.
- `tests/attestation-ledger-gate.test.mjs` — asserts the passage-attestation ledger is empty.

**Human today: No.** This is the "future credentialed clinician" persona named in the PRD (§5,
Tertiary) — does not exist yet. Zero adjudications have occurred against any passage or synthesis
candidate in this repository.

### 4. Rights reviewer

**Spec responsibility:** compare the proposed product output with the source components; assess
compilation similarity, market substitution, branding, contract constraints, and notices; assign
the release status.

**Real artifact(s) in this repo:**
- `rights/rights-records.json` — `overall_status` (currently `UNKNOWN` on every record) and
  `component_decisions[].decision` (currently `unknown` on every entry) are the fields this role
  would set.
- `rights/rights-failures.json` — cross-linked, pre-existing open rights problems (REG-002; the
  EP3-T5 near-verbatim-span and source-unretrievable findings) a rights reviewer would need to
  resolve or route around.
- `schemas/rights/content_reuse_assessment.schema.json` — vendored and amended, with zero live
  entries.

**Gate(s):**
- `scripts/validate-rights.mjs`'s four coverage/consistency gates —
  `checkMissingAssessmentCoverage`, `checkBlockingStatusEnumMembership`, `checkOpenFailurePresence`,
  and `runReleaseContextContainmentGate` — plus `tests/rights-coverage.test.mjs`,
  `tests/rights-validate-gates.test.mjs`, and `tests/rights-gate-failsclosed.test.mjs`. Every gate
  is coverage- or consistency-shaped only (D7): a record at `overall_status: UNKNOWN` passes
  exactly as one at any other status would.

**Human today: No.** This is the "future rights owner" persona named in the PRD (§5, Secondary;
open question OQ-2) — **does not exist yet, and naming that person is not an engineering task.**
Every seeded rights record sits at `review.review_status: agent_triage_only` /
`overall_status: UNKNOWN` precisely because no rights reviewer has assigned a real status; no code
path in this repository may write one (D6). `docs/project_plans/design-specs/rights-clearance-workflow.md`
sketches, at idea stage, what this role's future write path might look like; nothing there is
committed.

### 5. Technical verifier

**Spec responsibility:** confirm source-to-rule traceability; test boundaries, units, profiles,
missing data, and version differences; verify that only cleared content enters the release
package.

**Real artifact(s) in this repo:**
- `scripts/validate-kb.mjs` — bidirectional `KB_JSON_FILES` coverage, and (EPR2-T5) a
  source-to-rights-record coverage call site via `resolveRightsRecordsForIdentifier`.
- `scripts/validate-rights.mjs` and the boundary/unit/tristate suites (`tests/boundary.test.mjs`,
  `tests/units.test.mjs`, `tests/units-seam-ranges.test.mjs`,
  `tests/tristate-safety-invariant.test.mjs`, and related files).
- `scripts/evidence/lib/attested-passage-map.mjs`'s `loadAttestationLedger` /
  `validateBindingsAgainstLedger` (the RG-9 seam) — the sole mechanism in this codebase that could
  ever authorize a `source-supported` rule/candidate-to-passage binding, and it authorizes none
  today.
- The composed `npm run check` gate itself: `test && validate && coverage:rules && build &&
  verify:d4 && check:imports && smoke:browser && smoke`.

**Human today: Only in the weakest sense — do not read this as the role being filled.** A green
`npm run check` is a necessary automated proxy this role would lean on, and every change lands
through a human-reviewed PR per this repo's git workflow (branch off `main`, review, merge). But
there is no named, independent technical verifier distinct from the person who authored the
change, and no credential is checked at merge time. The automated gates are necessary scaffolding
for a future technical verifier's work, not a substitute for an independent verification pass.

## Summary table

| Role | Real output artifact | Gate | Qualifying human today? |
|---|---|---|---|
| Research reviewer | `evidence.json` passages (locator, `not_captured[]`, paraphrase); `rights/rights-records.json` | `rights-negative-invariant`, `rights-evidence-item-locator`, `rights-evidence-numeric-recapture` tests | **No** |
| Independent rule author | `rules.json` (91 rules), `owner`/`changeRationale`/`sourcePassageId` | `rule.schema.json` (`clinicalApprovers` maxItems:0), `rule-governance*` tests | **No** |
| Clinical adjudicator | `derived_synthesis` (`candidate`-only); `evidence-packs/passage-attestations.json` | `rights-derived-synthesis`, `attestation-ledger-gate` tests | **No** |
| Rights reviewer | `rights/rights-records.json` (`overall_status`, `component_decisions`) | `validate-rights.mjs`'s 4 gates; `rights-coverage`/`rights-validate-gates`/`rights-gate-failsclosed` tests | **No** |
| Technical verifier | `validate-kb.mjs`, `validate-rights.mjs`, boundary/unit/tristate suites, `attested-passage-map.mjs` seam | composed `npm run check` | **No** (green CI + PR review only; no named independent verifier) |

## Unfilled roles, named explicitly

Two staffing gaps recur across the table above and are **not engineering tasks**:

- **The rights owner (open question OQ-2).** Unfilled. Blocks all clearance work (the rights
  reviewer role); blocks nothing else in this feature. See
  `docs/project_plans/design-specs/rights-clearance-workflow.md` for the idea-stage sketch of what
  filling this role would look like.
- **The credentialed clinician.** Unfilled. Would fill both the independent-rule-author role's
  clinical-credential gap and the clinical-adjudicator role in full. `docs/architecture.md` §7 and
  `NOTICE.md` both state plainly that no credentialed clinical approver has approved any rule or
  synthesis in this knowledge base.

Naming a person for either role is a governance/staffing decision for the project owner, not
something an agent, ARC run, or `council-review` pass can resolve or substitute for.

## Cross-references

- Spec: §9 "Clean-room rule-authoring pattern" (`spec_ref` above).
- `docs/architecture.md` §7 "Rule-authoring model" and its "Rights and evidence provenance"
  subsection — the shipped substrate this document maps against.
- `NOTICE.md` — the repo-level honest-state statement this document is consistent with.
- `docs/project_plans/design-specs/rights-clearance-workflow.md` — idea-stage sketch of the rights
  reviewer's future write path (DEF-R1).
- `.claude/worknotes/rights-aware-evidence-capture/decisions-block.md` — D1-D7 and OQ-1..OQ-4.
- `docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md` §5 (Personas) and
  §14 (Open Questions) — OQ-2 and the credentialed-clinician persona as sourced here.
