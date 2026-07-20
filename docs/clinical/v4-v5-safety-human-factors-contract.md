# V4 Silent-Mode and V5 Summative Human-Factors Dependency Contracts

**Status:** contract only. Nothing here is filled in, executed, adjudicated, or approved.
**Version:** 1.2.0.
**Plan:** `arc-clinical-council-adoption-v1`, task P4-T4 (fix cycle 2: P4-V1 second-round remediation). Acceptance criterion AC P4.1.
**Blocking open questions:** **OQ-4** (V4's live-data/dataset dimension shares OQ-4's data-partner
holder) **and OQ-6 — the authoritative approval/adjudication system — are OWNER-HELD and
UNRESOLVED for both gates.** Plan section 6 additionally lists "V4 silent-mode operations and V5
summative human-factors participation" as its own owner-held item, distinct from OQ-4/OQ-6.
**Machine-readable companion:** `docs/clinical/schemas/v4-v5-safety-human-factors-result.schema.json`
(co-located with, and cross-referencing, the V3 schema — see section 8).

---

## 0. What this document is, and what it is not

This document specifies **what must exist, signed and executed, before V4 (prospective silent mode)
and V5 (summative human-factors) can be satisfied for this candidate**. Like its V3 predecessor
(`docs/clinical/v3-diagnostic-accuracy-contract.md`, task P4-T3), it is a *dependency contract*: a
list of obligations, their acceptance rules, and the exact chain of records that must connect an
owner-frozen protocol to an owner-recorded decision — one chain for V4, a second, structurally
identical-shaped but content-distinct chain for V5.

**It does not supply any of them.** No silent-mode operations window, institution, data partner,
participant count, recruitment criterion, usability threshold, SUS target, equity governance
protocol, or downtime-procedure owner is named or implied anywhere in this repository, and none may
be added by a repository agent. Those are owner-held inputs under plan section 6 (and, where they
overlap V3's data-partner dimension, OQ-4). A plan or a contract may *specify* an input; only
authenticated owner evidence may *satisfy* it.

The same two boundaries the V3 and P3 local-profile contracts establish hold here without
modification:

- **Structural validity is not clinical validity.** A record that satisfies
  `v4-v5-safety-human-factors-result.schema.json` has demonstrated that it is well-formed. It has
  demonstrated nothing about whether the silent-mode study or the human-factors study behind it is
  sound, sufficiently powered, or free of bias.
- **Nothing in this contract authorizes activation, release, or patient-affecting use.** Freezing a
  protocol is a precondition for consideration, not a grant of permission.

A third boundary is specific to V4/V5 and is this document's reason for existing, restated from
finding `PEDS-IMPL-001` in the ARC readiness run
(`agentic-research/runs/2026-07-19-pediatric-expansion-arc-readiness/findings.yaml`):

> "P3 requires V4 prospective silent mode and V5 human-factors evidence... but its machine-readable
> work packages stop at product and integration build tasks. A project tracker can therefore mark
> every P3 work package complete without scheduling, executing, or approving either implementation
> study."

That is the exact failure this contract exists to make structurally impossible: **build completion
must remain distinct from study completion**, for V4 and V5 exactly as it already is for V3.

---

## 1. The governing principle

> **Build state cannot satisfy study state.**

`01-platform-expansion-roadmap.md` defines V4 as **prospective silent mode** — "live EHR data, no
clinician-facing display, missing-data + override simulation" — with go criterion "no hidden
dangerous behavior; missingness never silently clears" (roadmap line 296). It defines V5 as
**summative human-factors** — "time-on-task, interpretation accuracy, trust calibration, alert
fatigue" on the referral packet and tri-state questionnaire, go criterion "comprehension +
appropriate-override metrics meet preset thresholds" (roadmap line 297). Both are named validation
gates for P3, **not build tasks**, and both are explicitly listed in plan section 6's owner-held
list, verbatim: "V4 silent-mode operations and V5 summative human-factors participation."

Neither can be inferred from repository state. A green `npm run check`, a passing dangerous-miss
fixture, or a fully-authored contract document proves nothing about whether a live silent-mode
deployment ran, whether real clinicians sat through a summative usability session, or what either
produced. Two further findings from the same ARC readiness run sharpen why this matters specifically
for alerts and workflow, not only for diagnostic accuracy:

- **`PEDS-HF-001`** ("P3 lacks an alert and work-queue lifecycle safety contract"): the roadmap names
  the work queue, transient CDS Hooks cards, override simulation, and alert-fatigue testing, but
  never defines acknowledgment, escalation, deferral, override rationale, duplicate suppression,
  downtime recovery, cross-shift handoff, or urgent-alert dominance. "Alerts can therefore be
  technically delivered without proving that the responsible clinician receives and resolves them
  under degraded or high-workload conditions."
- **`PEDS-HF-002`** ("dangerous-miss coverage is condition-centric and omits data and workflow
  failures"): alert override, downtime, handoff, and recovery failures can "escape despite
  condition-based tests passing" if they are never modeled as first-class hazards.

The direct consequence, mirroring the V3 contract's section 1 and enforced the same way — by the
companion schema, not by prose:

> Missing, unauthored, authored-but-unfrozen, unexecuted, digest-mismatched, unadjudicated, or
> undecided states **fail closed and stay visible**, for V4 and V5 independently. Neither is ever
> silently resolved to a pass, and neither upgrades the other — a completed V4 silent-mode run says
> nothing about V5 human comprehension, and vice versa.

---

## 2. The propagation chains

AC P4.1 requires the full chain to be explicit and traceable for every V3-V5 protocol: **exact
input/version -> expected behavior -> execution receipt -> result -> adjudication -> owner decision
-> release state.** V4 and V5 each get their own five-record chain plus a composed gate record, for
the same reason V3 keeps AUTHORED and EXECUTED as distinct record types (plan hard constraint 4):
conflating "the repository specified a protocol" with "a credentialed authority validated an
execution" is precisely the defect class `PEDS-IMPL-001` found.

### 2.1 Shared primitives — bound by reference, not duplicated

Per this task's constraint 5 ("bind by explicit reference rather than duplicating"), the companion
schema does not redefine the owner-held-status discriminator, the candidate-binding shape, the
reference-locator shape, the analysis-plan shape, the uncertainty-plan shape, the adjudication-system
binding, or the P2 authenticated-attachment signature placeholder. It **cross-file `$ref`s** them
directly from `v3-protocol-result.schema.json`'s `$defs` (verified in the delivery report: a
validator constructed against the V4/V5 schema resolves every such `$ref` against the co-located V3
file without error). A second, divergent copy of any of these primitives would itself be a defect —
exactly the risk this constraint calls out.

Two *new* primitives are introduced here because V3 has no equivalent, and — critically — each is
defined **once** and referenced identically by both the V4 and the V5 protocol record, so the two
gates are measured against the same lifecycle and the same equity plan rather than two documents that
can silently drift apart:

- **`alertWorkflowLifecycleBinding`** — the safety-owned alert/work-item state machine `PEDS-HF-001`
  calls for: acknowledgment and escalation SLA, deferral policy, override-rationale policy, duplicate
  suppression, downtime replay procedure and its named owner, cross-shift handoff procedure, urgent-
  dominance verification method, and incident linkage. V4 measures whether the *machine* behaves
  safely under this lifecycle while unobserved; V5 measures whether *clinicians* comprehend and
  correctly operate it. Referencing one `$def` twice, rather than authoring the lifecycle twice,
  means there is exactly one lifecycle definition to keep current.
- **`equityAndAccessibilityPlan`** — reuses V3's subgroup axes (`age_band`, `sex`, `site`,
  `analyzer_platform`) and adds the axes the ARC readiness run's watchlist finding `ARC-PEF-001`
  names as currently unspecified: access-mediated missingness, language, disability/accessibility
  need, health literacy, cost/follow-up burden, and caregiver/adolescent participation. As with V3's
  `endpointDefinition.endpointId`, naming a dimension is not the same as setting its target
  representation, and `equityGovernanceProtocolRef` stays a reference-only pointer — this repository
  must not invent an equity governance protocol (plan hard constraint 3; risk register
  `PAC-RISK-007`, owner `equity-and-family-governance-owner`).

### 2.2 V4 — prospective silent mode

| Link | Record type | What it proves | What it does NOT prove |
|---|---|---|---|
| Expected behavior | `v4SilentModeProtocol` | A silent-mode operations window, live-data-source binding, alert lifecycle, missingness-monitoring plan, would-be-alert capture plan, override-simulation plan, go/no-go criteria, and equity plan were specified and (once every owner-held section is `asserted`) frozen. | Whether the operations window, data partner, or thresholds are clinically sound, or whether any silent-mode run has happened. |
| Execution receipt | `v4ExecutionReceipt` | An execution happened, against which frozen protocol, with two **structural** (`const: true`) attestations: `clinicianFacingDisplayAttestation.noDisplayDuringSilentMode` (silent mode is defined by the absence of clinician-facing display — a receipt claiming display occurred cannot validly describe a silent-mode run) and `dataBoundaryAttestation` (no patient data entered this repository, ARC, or AOS — same shape and same guard as V3's `dataAccessAttestation`). | That the execution was safe, complete, or clinically meaningful. |
| Result | `v4ResultRecord` | Per-event-class counts (would-be alerts, missing-data events, override-simulation events, downtime events, handoff events, duplicate-suppressed events, urgent-dominance events), a direct `missingnessNeverClearedObserved` surface of the roadmap go-criterion, and subgroup/equity results with `analysisClass`. `resultStatus` tops out at `executed_unadjudicated`. | That any observed behavior has been judged acceptable — that is adjudication's and the owner decision's job, never this record's. |
| Adjudication | `v4AdjudicationRecord` | A reference-only pointer to the OQ-6 authoritative system's adjudication status. | An ARC- or repository-synthesized conclusion — `adjudicationStatus: adjudicated` must reflect what the referenced external system reports (plan hard constraint 2). |
| Owner decision | `v4OwnerDecision` | The single field (`decision`) that can authorize this candidate's V4 gate, reusing the P2 authenticated-attachment placeholder verbatim via `$ref` into V3's schema. | Anything — `bound` is unreachable by construction until P2 lands, exactly as in V3. |
| Release state | `v4DependencyChain` | Composition record naming every link plus `silentModeValidationComplete`, pinned `const: false` for the same reason as V3's `clinicalValidationComplete`: no evaluator exists in this repository. | — |

### 2.3 V5 — summative human-factors

| Link | Record type | What it proves | What it does NOT prove |
|---|---|---|---|
| Expected behavior | `v5HumanFactorsProtocol` | A summative-scope study (`studyType` is a structural `const: "summative_human_factors"` — see section 4) with a positively bound artifact scope, participants/recruitment plan, measure definitions, the same shared alert lifecycle and equity plan as V4, and a reused (`$ref`) analysis/uncertainty plan, were specified and (once frozen) locked before any session ran. | Whether recruitment, comprehension thresholds, or equity coverage are scientifically sound, or whether any session has happened. |
| Execution receipt | `v5ExecutionReceipt` | A study session happened, against which frozen protocol, with the same shared `dataBoundaryAttestation` V4 uses — no real patient record entered this repository, ARC, or AOS, and none was used as study stimulus material. | That the session was well-run or produced meaningful data. |
| Result | `v5ResultRecord` | Per-measure point estimates with mandatory intervals and `n` (same uncertainty requirement as V3's `endpointResults`), plus subgroup/equity results with `analysisClass`. Tops out at `executed_unadjudicated`. | That any measured value clears its threshold — thresholds live in the protocol and pass/fail is the owner decision's job. |
| Adjudication | `v5AdjudicationRecord` | Reference-only pointer into the OQ-6 system, identical shape to V4's. | A synthesized conclusion. |
| Owner decision | `v5OwnerDecision` | Same `decision`/P2-placeholder shape as V4's. | Anything until P2 lands. |
| Release state | `v5DependencyChain` | `summativeHumanFactorsComplete`, pinned `const: false`. | — |

---

## 3. What is deliberately NOT shipped here, and why

Exactly the same three reasons the V3 contract's section 3 gives, restated for V4/V5:

1. **File ownership.** This task's surface is `docs/clinical/`, not `schemas/` or `tests/` — those
   remain P4-T1's concurrent surface.
2. **Nothing to evaluate yet.** Every owner-held section in both new record types is correctly
   `not_executed_owner_held` today; an evaluator over content that does not exist would either be
   dead code or would require synthetic clinical/study content — exactly what this contract exists to
   prevent.
3. **The P3 and V3 lessons apply here in advance.** The P3-V1 review found a self-declared
   `signatureState: "bound"` string accepted as a real signature, and the same class of hole — an
   assertion trusted because it was typed, not because it was verified — is exactly what section 4's
   structural (`const`) guards below close mechanically for V4/V5, verified empirically rather than
   claimed (see the delivery report).

Building the evaluator, and deciding whether these schemas relocate into `schemas/`, remain future
work — most naturally P4-V1, a P5 pilot task, or a combined V3/V4/V5 release-dependency manifest once
P4-T1's fixtures and P4-T2's hazard-to-control matrix land (same open item V3's section 8 left, now
resolved for the type-reuse question specifically — see section 8 below).

---

## 4. Structural (non-owner-held) constraints specific to V4/V5

These are enforced by the schema itself and were each verified directly against the schema file (see
the delivery report for the exact commands and outputs — every row below was constructed as an
attack document and confirmed rejected).

| Constraint | Mechanism | Verified |
|---|---|---|
| `silentModeValidationComplete` cannot be asserted true anywhere in this schema | `v4DependencyChain.silentModeValidationComplete` is `const: false`. | A document with it set `true` was constructed and confirmed schema-invalid. |
| `summativeHumanFactorsComplete` cannot be asserted true anywhere in this schema | `v5DependencyChain.summativeHumanFactorsComplete` is `const: false`. | Same, for V5. |
| A silent-mode receipt cannot claim execution while also claiming a clinician-facing display occurred | `v4ExecutionReceipt.clinicianFacingDisplayAttestation.noDisplayDuringSilentMode` is `const: true`. | A receipt with it set `false` was constructed and confirmed schema-invalid — such a document is not describing silent mode at all. |
| No patient data may enter this repository, ARC, or AOS, for either gate | `dataBoundaryAttestation` (shared `$def`, both fields `const: true`) on `v4ExecutionReceipt` and `v5ExecutionReceipt`. | A receipt with `noPatientDataEnteredRepository: false` was constructed and confirmed schema-invalid. |
| No illustrative metric can pose as a real V4 go/no-go bar | `goNoGoCriterion.isIllustrative` is `const: false`, mirroring V3's `endpointDefinition.isIllustrative` (the `PEDS-DX-002` defect class). | A criterion carrying `thresholdDescription: "0.008 illustrative"` and `isIllustrative: true` was constructed and confirmed schema-invalid. |
| No illustrative usability threshold or SUS target can pose as a real V5 measure bar | `humanFactorsMeasureDefinition.isIllustrative` is `const: false`. | A measure carrying `thresholdValue: 68, thresholdUnit: "SUS", isIllustrative: true` was constructed and confirmed schema-invalid. |
| A `v5HumanFactorsProtocol` cannot be relabeled from a formative study | `studyType` is `const: "summative_human_factors"`. | A document with `studyType: "formative_human_factors"` was constructed and confirmed schema-invalid — see section 8 on why formative testing is out of this task's scope rather than folded in. |
| A protocol cannot freeze with any owner-held section unasserted, for either gate | `v4SilentModeProtocol.if/then` and `v5HumanFactorsProtocol.if/then` require every owner-held section's `status` to be `asserted` (including per-item `status` inside `goNoGoCriteria[]` and `humanFactorsMeasures[]`) before `protocolStatus: protocol_frozen` validates. | A document claiming `protocol_frozen` with every section left `not_executed_owner_held` was constructed for both V4 and V5 and confirmed schema-invalid in both cases. |
| An asserted section's owner-held content fields cannot be null (P4-V1 fix-cycle-1 remediation) | `goNoGoCriterion.if/then` and `humanFactorsMeasureDefinition.if/then` (both previously had NO if/then at all — `status: asserted` coexisted with a null `thresholdDescription`/`metric`/`thresholdValue`/`thresholdUnit`); `equityAndAccessibilityPlan.then.minimumRepresentation`, `v4SilentModeProtocol.operationsWindow.then.startDate`/`.endDate`, and `v5HumanFactorsProtocol.participantsAndRecruitment.then.participantRoles` are now narrowed the same way `alertWorkflowLifecycleBinding` already was; JSON Schema's `required` keyword alone only enforces key presence, not non-null content — this is the same defect class as V3 Finding 2, applied here. | Each guard is covered by a permanent regression test in `tests/clinical-contract-schemas.test.mjs`, proven to fail if reverted. |
| A `go`/`conditional_go` owner decision cannot carry a null timestamp, for either gate (P4-V1 fix-cycle-2) | `v4OwnerDecision.if/then` / `v5OwnerDecision.if/then`: `decision: go\|conditional_go` requires `decidedAt` non-null alongside `decidedBy.recordId`. Mirrors `v3OwnerDecision`. | Covered by a permanent regression test per gate. |
| An `executed` execution receipt, an `executed_unadjudicated` result, or a reached adjudication cannot carry null/empty content for the field that gives that status meaning, for either gate (P4-V1 fix-cycle-2, deliberate choice over exemption) | `v4ExecutionReceipt`/`v5ExecutionReceipt.if/then` (`executedAt`); `v4ResultRecord.if/then` (`silentModeEventResults` non-empty); `v5ResultRecord.if/then` (`measureResults` non-empty); `v4AdjudicationRecord`/`v5AdjudicationRecord.if/then` (`adjudicationDecidedAt`). Mirrors the V3 siblings; see the V3 contract sections 2.3-2.5 for the full narrow-vs-exempt rationale, restated in each schema `description`. | Covered by a permanent regression test per record type. |
| A `superseded` protocol must name its successor, for either gate (P4-V1 fix-cycle-2) | `v4SilentModeProtocol` / `v5HumanFactorsProtocol` each gained a second, independent `if/then` (an `allOf` entry): `protocolStatus: superseded` requires `supersededBy` non-null. Applied for parity with the V3 sibling this cycle fixed — see section 9. | Covered by a permanent regression test per gate. |
| Executions and results can never self-adjudicate or self-approve, for either gate | Adjudication and owner-decision are separate record types from result, same as V3. | Structural by type separation; no field on either result record can express an approval. |
| A result whose upstream digest doesn't match is void, not silently accepted | `executionReceiptStatus` includes `protocol_digest_mismatch`; `resultStatus` includes `void_protocol_mismatch` / `void_receipt_missing`, for both V4 and V5. | Same enum-closure argument as V3; no additional value exists to accept a mismatch silently. |

---

## 5. Synthetic examples

No example, fixture, or illustrative instance of any record type in this contract exists anywhere in
this repository as of this writing. Should one be added later, it must follow the same three-layer
containment pattern already established for P3 and V3: a `SYNTHETIC-` filename or identifier prefix,
an explicit non-clinical declaration in content, and reliance on the same schema-level conditionals
above — so a synthetic V4 or V5 record can never be promoted to an approved one by editing a single
field. The attack documents constructed to verify section 4 all carry a `SYNTHETIC-` identifier
prefix and were discarded after verification; none is checked into this repository.

---

## 6. Owner-held gaps

Nothing in this section may be filled in by a repository agent. Each gap names the schema field, the
plan-section-6 / ARC-readiness-run role that holds it, and what authenticated evidence would satisfy
it — never a repository-authored placeholder.

| Gap | Carrier | Who holds it | What would satisfy it | State |
|---|---|---|---|---|
| Silent-mode operations window (site, dates, duration) | `v4SilentModeProtocol.operationsWindow.*` | pediatric-cds-implementation-science (`PEDS-IMPL-001` ownership) + local-laboratory-director for the site (P3 dependency) | A signed operations-window memo bound to the exact candidate digest, naming the site (resolving to a P3 signed local-profile), start/end dates, and environment. | `not_executed_owner_held` |
| Live-EHR data partner and boundary posture | `v4SilentModeProtocol.liveDataSourceBinding.*` | diagnostic-methods-owner + named external data partner (plan section 6: shares OQ-4's "data partner" holder) | An executed data-use/shadow-access agreement naming the partner and EHR system, referenced by ID — never the live feed itself entering this repository. | `not_executed_owner_held` |
| Alert/work-item lifecycle definition (shared V4+V5) | `alertWorkflowLifecycleBinding.*` (referenced from both protocols) | pediatric-safety-owner (risk register `PAC-RISK-004`; ownership field on findings `PEDS-HF-001`/`PEDS-HF-002`: `pediatric-cds-clinical-safety`) | A signed safety-owned state-machine document covering acknowledgment/escalation SLA, deferral, override rationale, duplicate suppression, downtime replay, cross-shift handoff, urgent dominance, and incident linkage. | `not_executed_owner_held` |
| Downtime procedure owner | `alertWorkflowLifecycleBinding.downtimeProcedureOwnerRef` | pediatric-safety-owner | A named, authenticated individual/role accountable for downtime recovery execution — never a repository-invented name (plan hard constraint 3 names this explicitly). | `not_executed_owner_held` |
| Missingness-never-clears and no-hidden-dangerous-behavior verification methods | `v4SilentModeProtocol.missingnessMonitoringPlan.*`, `goNoGoCriteria[].thresholdDescription` | diagnostic-methods-owner + pediatric-safety-owner | A pre-registered monitoring/analysis method and the real pass/fail bar, signed before execution. Never the roadmap's own illustrative language treated as an executable number. | `not_executed_owner_held` |
| Would-be-alert capture method and hazard-matrix binding | `v4SilentModeProtocol.wouldBeAlertCapturePlan.*` | pediatric-safety-owner | A capture method plus a resolved reference to plan task P4-T2's hazard-to-control matrix (bind by reference, not a second invented list). | `not_executed_owner_held` |
| Override-simulation scenarios | `v4SilentModeProtocol.overrideSimulationPlan.*` | pediatric-safety-owner + human-factors authority | A signed scenario set and method. | `not_executed_owner_held` |
| V5 candidate artifact scope | `v5HumanFactorsProtocol.studyArtifactScope.*` | pediatric-cds-implementation-science + diagnostic-methods-owner | A signed statement binding the exact artifact set (e.g. the referral packet and tri-state questionnaire the roadmap names) and version to this candidate digest — inheriting the roadmap's general text is not binding. | `not_executed_owner_held` |
| Participants and recruitment | `v5HumanFactorsProtocol.participantsAndRecruitment.*` | human factors and implementation science authority (ARC readiness run `human_approval_gate.required_authorities`) | A signed recruitment/consent plan naming criteria, target count, and roles. Never a repository-invented participant count (plan hard constraint 3 names this explicitly). | `not_executed_owner_held` |
| Human-factors measure definitions and thresholds | `v5HumanFactorsProtocol.humanFactorsMeasures[].thresholdValue`/`.thresholdUnit` | human factors and implementation science authority | A pre-registered operationalization and the real pass/fail bar for each of time-on-task, interpretation accuracy, trust calibration, alert fatigue, comprehension, and appropriate override. Never an invented SUS score or percentage target. | `not_executed_owner_held` |
| Equity and accessibility plan (shared V4+V5) | `equityAndAccessibilityPlan.*` (referenced from both protocols) | equity-and-family-governance-owner (risk register `PAC-RISK-007`) | A pre-specified subgroup/accessibility table and a reference to an owner-authenticated equity governance protocol — never a repository-authored protocol. | `not_executed_owner_held` |
| V4/V5 statistical/analysis plan | `v5HumanFactorsProtocol.analysisPlan.*` (reused `$ref` from V3) | diagnostic-methods-owner / human-factors authority | A signed, version-pinned analysis plan, timestamped before study execution — same discipline as V3's SAP. | `not_executed_owner_held` |
| Adjudication system and adjudicators (OQ-6, shared with V3) | `adjudicationSystemBinding.*` (reused `$ref` from V3) | clinical-governance-owner | The named authoritative adjudication system plus a credentialed, independent adjudicator roster — referenced by ID/status only. | `not_executed_owner_held` |
| Owner decisions (go/no-go/conditional) | `v4OwnerDecision.decision`/`v5OwnerDecision.decision` | clinical-governance-owner (+ pediatric-safety-owner / human-factors authority co-sign) | A signed decision record referencing the exact protocol version, result-record digest, and adjudication-record ID, under the P2 attachment contract once P2 lands. | `not_executed_owner_held` |
| Privacy/security approval for the live-EHR silent-mode boundary | not carried in this schema | clinical-informatics-and-privacy-owner (risk register `PAC-RISK-003`) | A threat/data-flow review sign-off for the silent-mode data path, kept outside this repository's PHI boundary. | owner-held (plan section 6) |
| Organizational release and production activation | not carried here | governance owner (plan section 6) | Separate organizational release/activation authorization, always downstream of `clinical_validation_complete`. | owner-held (plan section 6) |

---

## 7. Structural (non-owner-held) constraints

See section 4 for the V4/V5-specific structural table with verification evidence. The general
constraints already established by V3 (candidate-digest binding, PHI-handling posture restriction,
non-self-adjudication, digest-mismatch voiding) apply here unmodified because they are reused by
`$ref`, not restated — restating them would itself risk a divergent second copy (plan hard
constraint 5).

---

## 8. Related artifacts, and the V3-reuse-vs-own-types decision

The V3 contract's section 8 left one integration question open for this task: **do V4/V5 reuse V3's
record types, or define their own?**

**Resolution: V4 and V5 define their own record types (`v4SilentModeProtocol` /
`v5HumanFactorsProtocol` and their four downstream siblings each), but do not duplicate any
structural primitive V3 already defines — those are cross-file `$ref`s into
`v3-protocol-result.schema.json`.**

Rationale:

- **Content divergence is real, not cosmetic.** V3 is retrospective, chart-adjudicated, and centers
  on a reference standard and dataset that do not exist for V4 (a live silent-mode deployment with no
  reference standard — the comparison is "what the candidate would have surfaced" versus "what
  actually happened," not versus a chart-adjudicated ground truth) or for V5 (a human-factors study
  with participants, tasks, and comprehension measures, not patients or diagnostic accuracy). Forcing
  V4/V5 content into `v3ProtocolContract`'s shape would require either bloating that record with
  fields irrelevant to V3, or leaving most of a shared schema's fields permanently null for whichever
  gate is not in play — a worse defect than three distinct, purpose-fit record types, because a
  reader could no longer tell from the schema alone which fields a given gate actually requires.
- **The discriminator must differ.** `recordType` is exactly how a reader (human or evaluator)
  distinguishes "this is V3 evidence" from "this is V4 evidence" from "this is V5 evidence." If V4/V5
  results reused `v3ResultRecord`'s `recordType` const, a V4 silent-mode event count could be mistaken
  for a V3 diagnostic-accuracy endpoint result — precisely the kind of state conflation plan hard
  constraint 4 (AUTHORED != EXECUTED) and the ARC readiness run's adjudicated findings exist to
  prevent.
- **But the primitives that do not depend on content — owner-held-status, candidate binding,
  reference-locator, analysis-plan shape, uncertainty-plan shape, adjudication-system binding, and the
  P2 signature placeholder — are identical in meaning across V3/V4/V5.** These are `$ref`ed directly
  from V3's `$defs`, verified to resolve (see the delivery report), so there is exactly one
  definition of each in this repository, not three. This is the literal mechanism satisfying this
  task's constraint 5 ("bind by explicit reference rather than duplicating... a divergent second copy
  of the chain is itself a defect") — applied to the schema primitives, since V4/V5 do not have a
  runtime *chain* dependency on V3's *content* (a V4 silent-mode run is not gated on V3 diagnostic
  accuracy having completed; both are named independently as P3's stage-gate: "V2 Technical + V4
  Silent mode + V5 Human factors begin," roadmap line 294).
- **Two genuinely new primitives were required and are shared, not duplicated, between V4 and V5
  themselves:** `alertWorkflowLifecycleBinding` and `equityAndAccessibilityPlan` are each a single
  `$def`, referenced twice (once from `v4SilentModeProtocol`, once from `v5HumanFactorsProtocol`).
  This directly prevents the failure mode this task's constraint 5 warns about applying *within*
  V4/V5, not only *between* V4/V5 and V3.
- **Explicit binding to the P3 signed-site-profile machinery**, per this task's constraint 5:
  `v4SilentModeProtocol.localProfileRef` is a `referenceLocator` that must resolve to a P3 signed
  local-profile record for the live-EHR site — it does not re-describe P3's applicability dimensions
  (population, specimen, analyzer, units, intervals) inline, because P3's local-profile-charter
  contract already owns that content and a second copy would drift from it exactly as P3-V1 warned.
- **Formative human-factors testing is deliberately out of scope, not folded in.** Finding
  `PEDS-IMPL-001` recommends a work package sequence that includes "formative testing" before the
  summative study. This task's brief and plan section 6 name only "V5 summative human-factors
  participation" as the owner-held item; `v5HumanFactorsProtocol.studyType` is therefore a structural
  `const: "summative_human_factors"` rather than an open enum that could silently accept a formative
  study under the same record type (verified: a document with `studyType: "formative_human_factors"`
  was constructed and confirmed schema-invalid). A future task may add a sibling
  `v5FormativeHumanFactorsProtocol` record type reusing the same shared primitives; it must not be
  retrofitted into this one.

### 8.1 Known integration constraint: whole-document validation requires bundling (documented, not fixed — P4-V1 fix-cycle-2 item 6)

Section 2.1 above establishes that this schema cross-file `$ref`s seven primitives out of
`v3-protocol-result.schema.json`'s `$defs` rather than duplicating them. That is correct schema
design, but it has a runtime consequence worth stating plainly: **`scripts/lib/json-schema-lite.mjs`'s
`resolveRef` supports only local `#/` refs by design** (its own header comment states this). Handed
the raw `v4-v5-safety-human-factors-result.schema.json` file as-is, any `validate()` call that reaches
one of the seven cross-file `$ref`s throws `unresolvable ref`, rather than returning an errors array.

The only thing in this repository that makes whole-document `validate()` calls against a
`v4SilentModeProtocol` or `v5HumanFactorsProtocol` document work today is `bundleV4V5Schema()` in
`tests/clinical-contract-schemas.test.mjs` — a small function that deep-clones the V4/V5 schema and
overwrites each of the seven aliased `$defs` entries with the real V3 definition before validating.
It is **unexported and test-only**. A future runtime importer (the evaluator sections 3 of both
contracts describe as future work, or any other code that wants to call `validate()` against this
schema outside a test file) will hit the same `unresolvable ref` throw unless it either (a)
duplicates an equivalent bundling step, or (b) `scripts/lib/json-schema-lite.mjs` gains real
cross-file `$ref` resolution — a change outside this task's file-ownership boundary (`scripts/lib/`
belongs to the concurrent P4-T1/P4-T2 surface, not `docs/clinical/`). This is recorded here as a
known constraint for whoever picks up that future work, not fixed in this remediation.

| Artifact | Path |
|---|---|
| V4/V5 dependency-chain schema (this contract's machine-readable companion) | `docs/clinical/schemas/v4-v5-safety-human-factors-result.schema.json` |
| V3 dependency-chain schema (cross-referenced by `$ref`, not duplicated) | `docs/clinical/schemas/v3-protocol-result.schema.json` |
| V3 dependency contract (predecessor, P4-T3) | `docs/clinical/v3-diagnostic-accuracy-contract.md` |
| P3 local-profile charter contract (source of `localProfileRef`'s target shape) | `docs/clinical/local-profile-charter-contract.md` |
| Platform validation-tier definitions (V1-V6), V4/V5 gate language | `docs/project_plans/expansion/01-platform-expansion-roadmap.md` (table near the top; P3 stage-gate detail around line 294-297; machine-readable P3 work-package graph around line 532-543) |
| ARC readiness run findings this contract remediates | `agentic-research/runs/2026-07-19-pediatric-expansion-arc-readiness/{findings.yaml (PEDS-HF-001, PEDS-HF-002, PEDS-IMPL-001, ARC-PEF-001), risk_register.yaml (PAC-RISK-004, PAC-RISK-007), validation_plan.md, pediatric_clinical_review.json (human_approval_gate.required_authorities)}` (read-only reference; ARC repository, not this one) |
| Plan owning this task | `docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md` (section 4, P4-T4; AC P4.1; section 6 owner-held list) |

---

## 9. Revision history

**1.2.0 — P4-V1 fix-cycle-2 remediation.** Companion to the V3 contract's 1.2.0 remediation, same
review cycle (the P4-V1 reviewer's second FAIL). Applied identically to V4 and V5 for parity with V3,
because leaving the same guard asymmetric across sibling record types is the exact failure pattern
that caused this fix cycle in the first place: **1.** `v4OwnerDecision`/`v5OwnerDecision.if/then` now
also requires `decidedAt` non-null for `go`/`conditional_go`, alongside the pre-existing
`decidedBy.recordId` narrowing. **2.** `v4ExecutionReceipt`/`v5ExecutionReceipt`,
`v4ResultRecord`/`v5ResultRecord`, and `v4AdjudicationRecord`/`v5AdjudicationRecord` gained own-status
narrowing (`executedAt` on `executed`; non-empty `silentModeEventResults`/`measureResults` on
`executed_unadjudicated`; `adjudicationDecidedAt` on `adjudicated`/`discordant_unresolved`) — a
deliberate choice over exemption, see section 4 and the V3 contract sections 2.3-2.5. **3.**
`v4SilentModeProtocol`/`v5HumanFactorsProtocol` gained the same `supersededBy`-required-when-superseded
enforcement as the V3 sibling (neither had a prose claim of enforcement the way V3's description did,
but leaving the same latent gap unfixed here once V3 was fixed would itself have been the asymmetry
this cycle exists to close). **4.** Section 8.1 above newly documents the `bundleV4V5Schema()`
integration constraint prominently (previously only in the test file's own header comment) —
documentation only, not a code change, per this fix cycle's file-ownership boundary. This revision
does **not** touch `datasetAndReferenceStandard.phiHandling` (V3-only field, fixed in the V3 schema)
or add any new record-shape changes beyond the five items above. No owner-held value was invented
anywhere in this fix. See the V3 contract's 1.2.0 entry for the full auditable field-by-field sweep
performed for item 1, which covered every `ownerHeldStatus`-gated field in both companion schemas
(including every field listed in this file), not only the ones ultimately changed.

**1.1.0 — P4-V1 fix-cycle-1 remediation.** Companion to the V3 contract's 1.1.0 remediation, same
review cycle. Closed Finding 2 (systemic, HIGH) as it applied to this schema: `goNoGoCriterion` and
`humanFactorsMeasureDefinition` had NO `if/then` at all, so `status: asserted` could coexist with a
null `thresholdDescription`/`metric`/`thresholdValue`/`thresholdUnit` — now narrowed to mirror
`alertWorkflowLifecycleBinding`'s already-correct pattern. `equityAndAccessibilityPlan.minimumRepresentation`,
`v4SilentModeProtocol.operationsWindow.startDate`/`.endDate`, and
`v5HumanFactorsProtocol.participantsAndRecruitment.participantRoles` had the same required-key-without-
content-narrowing gap and are fixed the same way. Root cause closed jointly with the V3 remediation:
`tests/clinical-contract-schemas.test.mjs` wires this schema into the test suite for the first time,
bundling its seven cross-file `$ref`s into V3's `$defs` (`resolveRef` only supports local `#/` refs)
so both schemas can be validated together; every guard is covered by a permanent regression test
proven to fail if reverted. No owner-held value was invented anywhere in this fix. See also: this
remediation surfaced a pre-existing, out-of-scope gap in `scripts/lib/json-schema-lite.mjs` (no
`exclusiveMinimum`/`exclusiveMaximum` support, affecting the shared `uncertaintyPlan.confidenceLevel`
field) that blocks whole-document validation of `v5HumanFactorsProtocol` through that validator;
documented in the test file's header, not fixed here (out of this task's file-ownership boundary).

**1.0.0 — initial freeze of the V4/V5 dependency contracts (P4-T4).** Establishes two five-record
chains (protocol, execution receipt, result, adjudication, owner decision) plus their composed
`v4DependencyChain`/`v5DependencyChain` gate records, mirroring the P4-T3 V3 pattern. All owner-held
sections ship as `not_executed_owner_held`; no silent-mode operations window, institution,
participant count, recruitment criterion, usability threshold, SUS target, equity governance
protocol, or downtime-procedure owner is asserted anywhere in this repository. Introduces two shared
primitives (`alertWorkflowLifecycleBinding`, `equityAndAccessibilityPlan`) referenced identically by
both gates to close the specific drift risk this task's constraint 5 warns about. Resolves the V3
contract's section 8 open integration question: distinct record types per gate, shared structural
primitives by cross-file `$ref`. Structurally guards against the two defects the ARC readiness run
found for alerts/workflow and implementation tracking: an unowned alert lifecycle (`PEDS-HF-001`,
`PEDS-HF-002`) and build-state-as-study-state conflation (`PEDS-IMPL-001`).
