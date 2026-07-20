# V3 Diagnostic-Accuracy Dependency Contract

**Status:** contract only. Nothing here is filled in, executed, adjudicated, or approved.
**Version:** 1.2.0.
**Plan:** `arc-clinical-council-adoption-v1`, task P4-T3 (fix cycle 2: P4-V1 second-round remediation). Acceptance criterion AC P4.1.
**Blocking open questions:** **OQ-4 — intended use, candidate scope, dataset, reference standard,
endpoints, and analysis plan — is OWNER-HELD and UNRESOLVED.** **OQ-6 — the authoritative
approval/adjudication system — is OWNER-HELD and UNRESOLVED.**
**Machine-readable companion:** `docs/clinical/schemas/v3-protocol-result.schema.json` (see section
8 for why it lives outside `schemas/`).

---

## 0. What this document is, and what it is not

This document specifies **what must exist, signed and executed, before V3 can be satisfied for this
candidate**. It is a *dependency contract*: a list of obligations, their acceptance rules, and the
exact chain of records that must connect an owner-frozen protocol to an owner-recorded decision.

**It does not supply any of them.** No intended-use statement, dataset, institution, data partner,
reference standard, endpoint threshold, subgroup boundary, or adjudicator identity is named or
implied anywhere in this repository, and none may be added by a repository agent. Those are
owner-held inputs under OQ-4 and OQ-6 (plan section 6). A plan or a contract may *specify* an input;
only authenticated owner evidence may *satisfy* it.

Two boundaries hold everywhere below, restated from the companion P3 local-profile charter contract
because they apply identically here:

- **Structural validity is not clinical validity.** A record that satisfies
  `v3-protocol-result.schema.json` has demonstrated that it is well-formed. It has demonstrated
  nothing about whether the study behind it is sound, sufficiently powered, or free of bias.
- **Nothing in this contract authorizes activation, release, or patient-affecting use.** Freezing a
  protocol is a precondition for consideration, not a grant of permission. Clinical validation,
  certification, release, and production activation are separate owner-held decisions (plan
  section 6).

A third boundary is specific to V3 and is this document's reason for existing:

- **Passing repository tests is not V3 evidence.** `npm run check` going green, a dangerous-miss
  fixture executing correctly, or ARC's technical validation passing are all **V2** (technical)
  evidence at best. They prove the candidate behaves deterministically against synthetic inputs.
  They prove nothing about diagnostic accuracy against real, chart-adjudicated outcomes. Conflating
  the two is exactly the defect the ARC readiness run already flagged twice: finding `PEDS-DX-001`
  ("the execution graph cannot schedule or prove the required V3 diagnostic-validation gate") and
  `PEDS-DX-002` ("an explicitly illustrative estimate appears in an executable go/no-go string" —
  see section 4 below for why that specific mistake is now structurally blocked).

---

## 1. The governing principle

> **Build state cannot satisfy study state.**

`01-platform-expansion-roadmap.md` defines V3 as **retrospective**: "multisite structured data +
chart adjudication + subgroup analysis," gated separately from V1 (content) and V2 (technical), and
explicitly identifies V3 as "the long pole" that "gates release, not build." The roadmap's own
`validation_result` schema reference names two of the required endpoint dimensions
(`dangerous_miss_rate`, `referral_completeness_delta`) and illustrates a threshold (`0.008`) purely
as an example — the roadmap text itself calls it "an illustrative target," not a committed value.

Because of this, **V3 cannot be inferred from repository state**. It cannot be derived from a green
test suite, from a rule having exact source passages, from a dangerous-miss fixture executing as
expected, or from the fact that a protocol document parsed successfully. It must be **executed**
against real chart-adjudicated data by a named data partner, under a protocol **frozen before
unblinding**, and the result must be **adjudicated and owner-decided** through the authoritative
system named in OQ-6.

The direct consequence, which section 3's state machine and the companion schema enforce:

> Missing, unauthored, authored-but-unfrozen, unexecuted, digest-mismatched, unadjudicated, or
> undecided states **fail closed and stay visible**. None of them is ever silently resolved to a
> pass.

---

## 2. The propagation chain

AC P4.1 requires the full chain to be explicit and traceable: **exact input/version -> expected
behavior -> execution receipt -> result -> adjudication -> owner decision -> release state.** Each
link below is a distinct record type in the companion schema (`recordType` discriminator), because
conflating them is precisely how "the repository built it" becomes indistinguishable from "a
credentialed authority validated it" (plan hard constraint 4: **AUTHORED != EXECUTED**).

### 2.1 Exact input/version — candidate binding

Every record in the chain carries a `candidateBinding` (`candidateId`, `candidateVersion`,
`candidateDigest`, `sha256:` content digest). A record whose digest does not match the current
candidate under review does not apply to it. This reuses the exact field shape already established
in `schemas/reference-range.schema.json`'s `boundCandidate` for consistency across P3 and P4.

### 2.2 Expected behavior — the `v3ProtocolContract`

The frozen protocol. Carries seven independently-`status`-gated owner-held sections (`intendedUse`,
`datasetAndReferenceStandard`, `endpoints[]`, `uncertaintyPlan`, `subgroupPlan`, `analysisPlan`,
`adjudicationSystemBinding`), each gated by the codebase's established `asserted |
not_executed_owner_held` discriminator (`schemas/reference-range.schema.json`
`authority.assertion`, `attestation.signatureState`); PHI handling posture and the rights receipt
(table rows 3-4 below) are structural/reference sub-fields of `datasetAndReferenceStandard`, not
separately-asserted sections of their own:

| # | Section | Acceptance rule | Carrier |
|---|---|---|---|
| 1 | Intended use | Population, age/developmental partitions, setting, candidate scope statement, regulatory classification, and scope exits — all owner-supplied for **this study**, not inherited from planning-scope text elsewhere in the repository. | `intendedUse.*` |
| 2 | Dataset and reference standard | Dataset source, named data partner, sample frame (inclusion/exclusion, target size, justification, sites), reference-standard definition, and blinding of the reference standard to the candidate's output. | `datasetAndReferenceStandard.*` |
| 3 | PHI handling posture | Must resolve to one of two permitted values (deidentified before the repository boundary, or not applicable because the repository never receives records) **once `datasetAndReferenceStandard.status` is `asserted`** — enforced by `datasetAndReferenceStandard.if/then` (P4-V1 fix-cycle-2; before this fix `null` remained a valid third enum member all the way through `protocolStatus: protocol_frozen`, a real unfixed instance of the fix-cycle-1 Finding-2 defect class the second review round caught — see the revision-history entry below). `null` remains valid only as the honest not-yet-asserted default. Structural, not owner-held — see section 7. | `datasetAndReferenceStandard.phiHandling` |
| 4 | Rights receipt | Reference into the P2 evidence-rights receipt store covering this dataset's permitted use. | `datasetAndReferenceStandard.rightsReceiptRef` |
| 5 | Endpoints | One or more of `dangerous_miss_rate`, `referral_completeness_delta`, `sensitivity_by_branch`, `specificity_by_branch`, `pattern_match_agreement`, each with metric definition, threshold value, and go/no-go direction. **The threshold value is owner-held and must never be the roadmap's illustrative `0.008`.** Each `endpoints[]` entry carries its own owner-held-status discriminator and its own schema-level conditional (`endpointDefinition.if/then`): `status: asserted` requires `metric`/`thresholdValue`/`goNoGoDirection` to be non-null, and `protocolStatus: protocol_frozen` additionally requires every `endpoints[]` entry's status to be asserted (P4-V1 fix-cycle-1 remediation — see the revision-history entry below; before this fix, `endpoints` was absent from the freeze-time conditional entirely, so a protocol with a null go/no-go threshold could reach `protocol_frozen`). | `endpoints[]` |
| 6 | Uncertainty plan | Interval type, confidence level, estimation method. Every reported endpoint must carry an interval, not a bare point estimate. | `uncertaintyPlan.*` |
| 7 | Subgroup plan | Which of `age_band`, `sex`, `site`, `analyzer_platform` are analyzed (dimension names reused verbatim from the roadmap's own V3 definition — naming the dimension is not the same as setting its boundaries), strata definitions, minimum cell size, and pre-specification before unblinding. The `site`/`analyzer_platform` dimension must resolve to a P3 signed local-profile record — it cannot name an unvalidated site. | `subgroupPlan.*` |
| 8 | Analysis plan | Primary analysis method, missing-data handling, interim-analysis statement (null is a valid explicit answer), blinding, and the named diagnostic-accuracy/biostatistics authority. Must be signed and timestamped **before** unblinding — a plan authored after seeing results is not a protocol. | `analysisPlan.*` |
| 9 | Adjudication system binding | Which system is authoritative (OQ-6), named independent adjudicators (reference only), independence attestation, and discordance-resolution method. | `adjudicationSystemBinding.*` |

`protocolStatus` starts at `not_executed_owner_held` and can only reach `protocol_frozen` when every
section above is `asserted` **and every asserted section's owner-held content fields are non-null**
and `frozenAt`/`frozenBy` are populated by a real owner action — this is a schema-level conditional
(`v3ProtocolContract.if/then` in the companion schema), not prose. Only a `protocol_frozen` protocol
may validly authorize an execution. Symmetrically, `protocolStatus: superseded` can only validate when
`supersededBy` is populated with the successor `protocolId` — a second, independent schema-level
conditional (P4-V1 fix-cycle-2: `supersededBy`'s own description already said "Required when
protocolStatus is superseded," but nothing enforced it until this fix).

**A precision this document previously overstated (closed by the P4-V1 fix-cycle-1 remediation):**
JSON Schema `required` enforces key *presence*, not non-null *content*. Before this remediation,
several `then` blocks required a key without re-narrowing its type, so `status: "asserted"` could
validly coexist with `null` content for `datasetAndReferenceStandard.sampleFrame`,
`subgroupPlan.minimumCellSize`/`.strataDefinition`, `analysisPlan.missingDataHandling`/`.blinding`,
and `adjudicationSystemBinding.discordanceResolutionMethod` — meaning "asserted" meant only "the
owner flipped a status string," not "the owner supplied content," for those fields. Every one of
these is now narrowed by the companion schema's `then.properties` and covered by a permanent
regression test in `tests/clinical-contract-schemas.test.mjs`.

### 2.3 Execution receipt — the `v3ExecutionReceipt`

Records that an execution happened: who ran it, when, against which protocol, and the
`candidateBindingAtExecution`. If that digest differs from the protocol's own `candidateBinding`, the
receipt is `protocol_digest_mismatch` and cannot feed a valid result — the protocol itself moves to
`protocol_deviation`. Every receipt carries a structural `dataAccessAttestation` (both fields
constrained to `true`) asserting no patient data entered this repository, ARC, or AOS — see section 6.
Execution is explicitly **off-repository**: nothing in `npm run check`, ARC's test suite, or CI can
produce a `v3ExecutionReceipt`, because V3 requires patient-derived chart data this repository never
holds.

**P4-V1 fix-cycle-2 (new finding, MEDIUM, deliberate choice):** `executionReceiptStatus: executed`
previously coexisted with `executedAt: null`. A schema-level `if/then`
(`executionReceiptStatus: executed => executedAt` non-null) now closes this. This is a receipt for an
off-repository event this repository cannot itself verify happened or was reported truthfully;
narrowing cannot add authenticity, only internal coherence. The same limitation already applies to
every AUTHORED-side owner-held field this contract narrows (nothing stops a false `asserted` claim
either), so exempting the executed-side records from the same discipline would be the inconsistent
choice, not narrowing them. `executedBy` stays unnarrowed, consistent with every other
`referenceLocator` field in this schema (never narrowed regardless of status).

### 2.4 Result — the `v3ResultRecord`

Per-endpoint and per-subgroup point estimates, each with a mandatory interval and sample size.
Subgroup results carry an `analysisClass` (`confirmatory_prespecified`, `exploratory_post_hoc`, or
`underpowered_below_minimum_cell_size`) so a post-hoc finding cannot silently carry the same
decision weight as a pre-specified one. `resultStatus` tops out at `executed_unadjudicated` — a
result record can never self-approve.

**P4-V1 fix-cycle-2 (new finding, MEDIUM, same deliberate choice as 2.3):**
`resultStatus: executed_unadjudicated` previously coexisted with an empty `endpointResults` array. A
schema-level `if/then` now requires at least one entry when `resultStatus` is
`executed_unadjudicated`. `endpointResults[].pointEstimate` and `dangerousMissRateObserved` stay
nullable (a per-endpoint result may legitimately be unresolved; the latter is documented as a
convenience surface, not the authoritative record), and `subgroupResults` stays unconstrained (a
subgroup plan may legitimately be `not_executed_owner_held`).

### 2.5 Adjudication — the `v3AdjudicationRecord`

Reference-only pointer to the OQ-6 authoritative adjudication system's status for this result:
`not_executed_owner_held`, `adjudicated`, or `discordant_unresolved`. This repository never sets
`adjudicated` on its own authority — the value must reflect what the referenced external system
reports, never a locally synthesized conclusion (plan hard constraint 2).

**P4-V1 fix-cycle-2 (new finding, MEDIUM, same deliberate choice as 2.3):** an adjudication that has
actually reached a determination (`adjudicated` or `discordant_unresolved`, as distinct from the
default `not_executed_owner_held`) previously could carry no `adjudicationDecidedAt`. A schema-level
`if/then` now requires it non-null in both cases. `adjudicationSystemRef` and `discordanceRecords`
stay unnarrowed — the former is a `referenceLocator` (never narrowed anywhere in this schema), and
the latter is a reference-only summary this repository has no mechanism to verify regardless of
narrowing.

### 2.6 Owner decision — the `v3OwnerDecision`

`decision` is the single field in the entire chain that can authorize `clinical_validation_complete`
for this candidate digest: `go`, `no_go`, `conditional_go` (with every condition independently
tracked as satisfied or not), or `withdrawn`. Defaults to `not_executed_owner_held`. Carries the same
P2 authenticated-attachment placeholder already established in the P3 local-profile charter contract
(`attachmentContract: "p2-authenticated-attachment"`, `signatureState:
"not_executed_owner_held" | "bound"`) — signature verification is P2's primitive, not this
contract's.

**P4-V1 remediation R3 (HIGH, gate reopened — the P3 defect verbatim, reintroduced here):** the
paragraph above previously ended "`bound` is unreachable here by construction until P2 lands," with
no schema narrowing behind that claim — a fabricated `signatureState: "bound"` plus an invented,
never-verified `attachmentRef` validated cleanly, on the one field that directly authorizes
`clinical_validation_complete`. `signatureRef` now mirrors the P3 local-profile charter's own
`attestation` if/then/else (schemas/terminology-profile.schema.json:160-162): `bound` REQUIRES a
non-null, non-empty `attachmentRef`; `not_executed_owner_held` REQUIRES it to be null. This proves
only internal coherence, not authenticity — there is still no code-level backstop for
`v3OwnerDecision.signatureRef` equivalent to `evaluateActivationGate` (that function is scoped to
local-profile records only). Verifying a real attachment remains entirely P2's unbuilt primitive; a
schema-valid `bound` decision here is proof of nothing beyond internal consistency.

**P4-V1 fix-cycle-2 (new finding, MEDIUM):** the `go`/`conditional_go` gate previously narrowed only
`decidedBy.recordId`, leaving `decidedAt` nullable — the most consequential decision in the entire
chain could carry no timestamp. `decidedAt` is now narrowed to non-null `date-time` in the same
`if/then`, alongside `decidedBy.recordId`.

### 2.7 Release state — the `v3DependencyChain`

A composition record naming every link above by reference plus the derived gate. **This is where the
"BUILD STATE CANNOT SATISFY STUDY STATE" constraint becomes structural rather than a claim**: the
companion schema pins `clinicalValidationComplete` to the JSON Schema keyword `const: false` — there
is no schema-valid document in this repository where that field is `true`, because no evaluator
exists here that can walk the full digest-consistent chain end to end (protocol frozen -> execution
digest matches -> result matches receipt -> adjudicated by the referenced authority -> owner decision
`go`/`conditional_go` with every condition satisfied). `blockedReleaseStates` must always list
`clinical_validation_complete` while that field is `false` — as of the P4-V1 R3 sweep this is a
schema-enforced `contains` constraint, not prose alone (previously `minItems: 1` plus an unconstrained
enum allowed e.g. `["activated"]` to validate without naming `clinical_validation_complete` at all) —
and per the plan's own state taxonomy (section 2) and gate policy (section 5), blocking
`clinical_validation_complete` transitively blocks `certified_for_defined_scope`, `released`, and
`activated` for any scope declaring V3 applicable.

---

## 3. What is deliberately NOT shipped here, and why

This contract intentionally stops short of an **evaluator** — the code that would read a real
`v3DependencyChain` plus its five linked records and compute whether the chain is actually
digest-consistent end to end (the equivalent of `scripts/lib/local-applicability.mjs` for P3). Three
reasons:

1. **File ownership.** This task's surface is documents and contracts, not `schemas/` or `tests/` —
   those paths are owned by the concurrently-running P4-T1 task authoring dangerous-miss scenario
   fixtures. Placing an evaluator there would risk a write collision on shared files the plan
   explicitly reserves to one owner at a time (plan section 3: "Only one integration owner may edit
   shared ARC runtime/schema files at a time").
2. **Nothing to evaluate yet.** An evaluator over five owner-held record types that are all
   correctly `not_executed_owner_held` today would either be untestable dead code or would need
   synthetic stand-ins for owner-held clinical content — exactly the fabrication this contract exists
   to prevent (see the P3 precedent's own caution in its section 6: a self-declared `"bound"` string
   was accepted as a real signature until the P3-V1 review caught it as a mechanism defect, not a
   fixture defect).
3. **The P3 lesson applies here in advance.** P3-V1 failed on first pass specifically because
   claims in its contract document were true of the checked-in fixtures and false of the mechanism
   enforcing them. This document avoids repeating that: the `const: false` guard on
   `clinicalValidationComplete` and the `isIllustrative: false` guard on endpoint definitions (section
   4) are enforced by JSON Schema itself, verified against this exact schema file (see the validation
   evidence in the delivery report), not by prose claiming an absent mechanism will behave a
   particular way.

Building the evaluator, wiring `v3-protocol-result.schema.json` (or a copy of it) into `schemas/`,
and adding fixtures under `tests/` is future work — most naturally P4-T4 (which shares the "build
state cannot satisfy study state" mandate for V4/V5) or a P5 qualifying-pilot integration task. This
document is written so that work can proceed without re-deriving the propagation chain from scratch.

---

## 4. The illustrative-metric defect, and how it is now structurally blocked

`01-platform-expansion-roadmap.md`'s CBC gate reads: *"dangerous-miss rate <= preset threshold (DR
uses `0.008` as an illustrative target)."* The ARC readiness run's independent adjudication
(`agentic-research/runs/2026-07-19-pediatric-expansion-arc-readiness/adjudication_record.yaml`,
finding `PEDS-DX-002`) accepted a finding that this illustrative number had leaked into an
**executable go/no-go string** elsewhere in planning — i.e., a document written as if `0.008` were
already the frozen decision threshold rather than an example.

This contract closes that specific hole two ways:

- `endpointDefinition.thresholdValue` is documented as owner-held and **must not** be populated with
  `0.008` or any other document's illustrative figure (schema description, enforced by convention
  and by review — JSON Schema cannot itself distinguish "the real 0.008" from "a copied illustrative
  0.008" if an owner genuinely chose that value, so the guard is process, not type-level, for the
  number itself).
- `endpointDefinition.isIllustrative` is a JSON Schema `const: false`. A document cannot both carry a
  populated `thresholdValue` intended as illustrative and validate against this schema's endpoint
  definition — illustrative examples must live in separate, clearly non-normative material (such as
  the roadmap document itself), never inside a `v3ProtocolContract`. This was verified directly: a
  record with `thresholdValue: 0.008, isIllustrative: true` was constructed and confirmed to fail
  schema validation (see delivery report for the exact command and output).

---

## 5. Synthetic examples

No example, fixture, or illustrative instance of any record type in this contract exists anywhere in
this repository as of this writing. Should one be added later (e.g., to unit-test a future
evaluator), it must follow the same three-layer containment pattern already established for P3
(`docs/clinical/local-profile-charter-contract.md` section 6): a `SYNTHETIC-` filename prefix, an
explicit non-clinical declaration in content, and a schema-level conditional that pins owner-held
`status` fields to `not_executed_owner_held` for any document so declared — so a synthetic V3 record
can never be promoted to an approved one by editing a single field.

---

## 6. Owner-held gaps

Nothing in this section may be filled in by a repository agent. Each gap names the schema field that
carries it, which OWNER-HELD role from plan section 6 / the ARC readiness run's
`human_approval_gate.required_authorities` holds it, and what authenticated evidence would satisfy
it — never a repository-authored placeholder.

| Gap | Carrier | Who holds it | What would satisfy it | State |
|---|---|---|---|---|
| Intended use, candidate scope, regulatory classification (OQ-4) | `intendedUse.*` | diagnostic-methods-owner + pediatric-cds-program-owner (plan section 6: "exact intended use and regulatory classification") | A signed intended-use memo, bound to the exact candidate digest, naming population/age partitions/setting/scope exits and referencing a regulatory-classification decision from the regulatory/legal authority. | `not_executed_owner_held` |
| Dataset, sample frame, data partner (OQ-4) | `datasetAndReferenceStandard.datasetSource`, `.dataPartner`, `.sampleFrame` | diagnostic-methods-owner + named external data partner (plan section 6: "V3 datasets ... and data partner") | An executed data-use agreement naming the partner, dataset, and sample frame, referenced by ID — never the dataset itself entering this repository. | `not_executed_owner_held` |
| Reference standard definition and blinding (OQ-4) | `datasetAndReferenceStandard.referenceStandardDefinition`, `.referenceStandardBlinding` | diagnostic-methods-owner | A signed reference-standard definition document stating derivation method and blinding relative to the candidate's output. | `not_executed_owner_held` |
| Evidence-rights receipt for the dataset | `datasetAndReferenceStandard.rightsReceiptRef` | evidence-rights-owner (plan P2-T2) | An authenticated P2 rights receipt bound to the source IDs and candidate digest. | `not_executed_owner_held` |
| Endpoint definitions and threshold values (OQ-4) | `endpoints[].thresholdValue`, `.goNoGoDirection` | diagnostic-methods-owner + pediatric-safety-owner (dangerous-miss threshold co-signature) | A pre-registered statistical analysis plan naming the real threshold, signed and dated **before** unblinding. Never the roadmap's illustrative `0.008` (section 4). | `not_executed_owner_held` |
| Uncertainty/interval method (OQ-4) | `uncertaintyPlan.*` | diagnostic-methods-owner (biostatistics authority) | A signed statement of interval type, confidence level, and estimation method. | `not_executed_owner_held` |
| Subgroup strata boundaries and minimum cell size (OQ-4) | `subgroupPlan.strataDefinition`, `.minimumCellSize` | diagnostic-methods-owner + local-laboratory-owner (site/analyzer strata depend on P3 profiles) | A pre-specified subgroup table referencing P3 signed local-profile digests for the site/analyzer dimension. | `not_executed_owner_held` |
| Statistical analysis plan (OQ-4) | `analysisPlan.*` | diagnostic-methods-owner ("diagnostic accuracy and biostatistics authority" per the ARC readiness run's `human_approval_gate.required_authorities`) | A signed, version-pinned SAP document, timestamped strictly before result unblinding. | `not_executed_owner_held` |
| Adjudication system and adjudicators (OQ-6) | `adjudicationSystemBinding.*` | clinical-governance-owner | The named authoritative adjudication system plus a credentialed, independent adjudicator roster with conflict declarations — referenced by ID/status only, never synthesized here. | `not_executed_owner_held` |
| Owner decision (go/no-go/conditional) (OQ-6) | `v3OwnerDecision.decision`, `.decidedBy`, `.signatureRef` | clinical-governance-owner (+ diagnostic-methods-owner co-sign) | A signed decision record referencing the exact protocol version, result-record digest, and adjudication-record ID, under the P2 attachment contract once P2 lands. | `not_executed_owner_held` |
| Privacy/security approval for the data-ingestion boundary | not carried in this schema | clinical-informatics-and-privacy-owner (risk register `PAC-RISK-003`) | A threat/data-flow review sign-off for wherever chart data is analyzed, kept outside this repository's PHI boundary. | owner-held (plan section 6) |
| Regulatory/legal confirmation of non-device CDS posture for this study scope | `intendedUse.regulatoryClassification` | regulatory/legal authority (roadmap track C.1, REG-001 et seq.) | A signed regulatory memo confirming the study and candidate scope remain inside the non-device CDS envelope. | owner-held (plan section 6) |
| Equity and subgroup-harm review of the subgroup plan | not carried in this schema | equity-and-family-governance-owner (risk register `PAC-RISK-007`) | A signed review confirming the subgroup plan does not enable unsupported generalization or unequal benefit across strata. | owner-held (plan section 6) |
| Organizational release and production activation | not carried here | governance owner (plan section 6) | Separate organizational release/activation authorization, always downstream of `clinical_validation_complete`. | owner-held (plan section 6) |

---

## 7. Structural (non-owner-held) constraints

These are enforced by the schema itself, not awaiting owner input:

| Constraint | Mechanism |
|---|---|
| No patient data may enter this repository, ARC, or AOS | `v3ExecutionReceipt.dataAccessAttestation` — both fields are JSON Schema `const: true`; there is no other valid value. |
| PHI handling posture must be one of two safe postures once the dataset section is asserted | `datasetAndReferenceStandard.phiHandling` enum restricted to `deidentified_before_repository_boundary` or `not_applicable_repository_never_receives_records` when `status: asserted`, via `datasetAndReferenceStandard.if/then` (P4-V1 fix-cycle-2 — see section 2.2 row 3; `null` remains valid only as the honest not-yet-asserted default). |
| No illustrative metric can pose as a real gate | `endpointDefinition.isIllustrative` is `const: false` (section 4). |
| `clinical_validation_complete` cannot be asserted true anywhere in this schema | `v3DependencyChain.clinicalValidationComplete` is `const: false` (section 2.7). |
| A `v3ProtocolContract` cannot freeze with any owner-held section unasserted, including per-item `status` inside `endpoints[]` | `v3ProtocolContract.if/then`: `protocolStatus: protocol_frozen` requires every owner-held `status` field to be `asserted` (P4-V1 fix-cycle-1: `endpoints[]` was added to this gate; it was previously absent — see section 2.2). |
| An `endpoints[]` entry cannot be `asserted` while its `metric`/`thresholdValue`/`goNoGoDirection` are null | `endpointDefinition.if/then` (P4-V1 fix-cycle-1). |
| A `then`-narrowed owner-held field cannot be `asserted` while its content is null (`sampleFrame`, `subgroupPlan.minimumCellSize`/`.strataDefinition`, `analysisPlan.missingDataHandling`/`.blinding`, `adjudicationSystemBinding.discordanceResolutionMethod`, `datasetAndReferenceStandard.phiHandling`) | Per-field `then.properties` type narrowing, added P4-V1 fix-cycle-1 (extended to `phiHandling` in fix-cycle-2); `required` alone only enforces key presence, not non-null content — see section 2.2. |
| A `go`/`conditional_go` owner decision cannot carry a null timestamp | `v3OwnerDecision.if/then`: `decision: go\|conditional_go` requires `decidedAt` non-null alongside `decidedBy.recordId` (P4-V1 fix-cycle-2 — section 2.6). |
| An `executed` execution receipt, an `executed_unadjudicated` result, or a reached adjudication cannot carry null/empty content for the field that gives that status meaning | `v3ExecutionReceipt.if/then` (`executedAt`), `v3ResultRecord.if/then` (`endpointResults` non-empty), `v3AdjudicationRecord.if/then` (`adjudicationDecidedAt`) — all P4-V1 fix-cycle-2, a deliberate choice over exemption (sections 2.3-2.5). |
| A `superseded` protocol must name its successor | `v3ProtocolContract`'s second, independent `if/then` (an `allOf` entry): `protocolStatus: superseded` requires `supersededBy` non-null (P4-V1 fix-cycle-2 — section 2.2). |
| Executions and results can never self-adjudicate or self-approve | Adjudication (`v3AdjudicationRecord`) and owner decision (`v3OwnerDecision`) are separate record types from result (`v3ResultRecord`); no field on a result record can express an approval. |
| A result whose upstream digest doesn't match is void, not silently accepted | `v3ExecutionReceipt.executionReceiptStatus` includes `protocol_digest_mismatch`; `v3ResultRecord.resultStatus` includes `void_protocol_mismatch` / `void_receipt_missing`. |

---

## 8. Related artifacts and why this schema is not under `schemas/`

| Artifact | Path |
|---|---|
| V3 dependency-chain schema (this contract's machine-readable companion) | `docs/clinical/schemas/v3-protocol-result.schema.json` |
| Platform validation-tier definitions (V1–V6) | `docs/project_plans/expansion/01-platform-expansion-roadmap.md` (table near the top; CBC gate detail under Phase 2) |
| P3 precedent for owner-held contract structure | `docs/clinical/local-profile-charter-contract.md` |
| ARC readiness run findings this contract remediates | `agentic-research/runs/2026-07-19-pediatric-expansion-arc-readiness/{adjudication_record.yaml,validation_plan.md,risk_register.yaml,pediatric_clinical_review.json}` (read-only reference; ARC repository, not this one) |
| Plan owning this task | `docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md` (section 4, P4-T3; AC P4.1) |

This task's file-ownership boundary (set by the concurrently-running P4-T1 task) excludes writing to
`schemas/` in this repository. The companion schema therefore lives at `docs/clinical/schemas/`, a
new, distinct path, and is **not** referenced by any runtime importer today. It **is** referenced by
`tests/clinical-contract-schemas.test.mjs` as of the P4-V1 fix-cycle-1 remediation (the root cause of
the P4-V1 FAIL: zero tests referenced either clinical schema before that file existed) — that suite
is schema-conformance-only, does not import or execute anything under `schemas/`, and does not
change this section's file-ownership boundary. A future integration task (most naturally within
P4-T4, P4-V1, or P5) must decide whether to relocate the schema itself into `schemas/`, keep it
where it is and add a runtime importer, or supersede it once P4-T1's fixture schemas and P4-T2's
hazard-to-control matrix land and a combined release-dependency manifest shape is chosen for all of
V3/V4/V5 together.

**Known integration constraint (documented, not fixed, P4-V1 fix-cycle-2 item 6):** the V4/V5
companion schema cross-file `$ref`s several primitives out of this file's `$defs` (see the V4/V5
contract's section 2.1). `scripts/lib/json-schema-lite.mjs`'s `resolveRef` supports only local `#/`
refs by design, so whole-document validation of a V4/V5 record requires bundling those cross-file
refs into a local copy first — `bundleV4V5Schema()` in `tests/clinical-contract-schemas.test.mjs` is
the only thing doing this today, and it is unexported and test-only. A future runtime importer for
either schema will need to duplicate this bundling step (or a real implementation of cross-file
`$ref` resolution) rather than assume `validate()` can be called against the raw V4/V5 schema file
as-is. See the V4/V5 contract's section 8 for the full detail.

---

## 9. Revision history

**1.2.0 — P4-V1 fix-cycle-2 remediation.** The P4-V1 reviewer FAILed a second time. Ground 1: an
independent sweep found a real unfixed instance of the fix-cycle-1 Finding-2 defect class —
`datasetAndReferenceStandard.phiHandling` stayed a valid `null` enum member all the way through
`protocolStatus: protocol_frozen`, even though its sibling `referenceStandardBlinding` and the V4
sibling `liveDataSourceBinding.dataBoundaryPosture` were already correctly narrowed. Ground 2: the
fix-cycle-1 claim that "a systematic pass found no additional instances" was false and should not
have been asserted without an auditable, field-by-field sweep. This revision closes five items:

1. **`phiHandling` narrowing (HIGH).** `datasetAndReferenceStandard.if/then` now excludes `null` for
   `phiHandling` when `status: asserted`, mirroring `referenceStandardBlinding`. See section 2.2 row
   3 and section 7. **Sweep performed this cycle (auditable):** every field across both companion
   schemas belonging to an object gated by the shared `ownerHeldStatus` discriminator was checked
   against its own `if/then` for whether it is (a) present in the base `required` array and (b)
   re-narrowed to exclude `null`/empty content in `then` — the same two-part check `phiHandling`
   failed. Specifically checked, by name: `intendedUse.{population, ageOrDevelopmentalPartitions,
   setting, candidateScopeStatement, regulatoryClassification, scopeExits}`;
   `datasetAndReferenceStandard.{datasetSource, dataPartner, sampleFrame,
   referenceStandardDefinition, referenceStandardBlinding, phiHandling, rightsReceiptRef}`;
   `endpointDefinition.{metric, thresholdValue, goNoGoDirection}`;
   `uncertaintyPlan.{intervalType, confidenceLevel, estimationMethod}`;
   `subgroupPlan.{dimensions, strataDefinition, minimumCellSize, prespecified}`;
   `analysisPlan.{primaryAnalysisMethod, missingDataHandling, interimAnalysis, blinding,
   statisticalAuthorityRef, prespecifiedBeforeUnblinding}`;
   `adjudicationSystemBinding.{systemRef, adjudicatorRefs, independenceAttestation,
   discordanceResolutionMethod}`; and, in the V4/V5 companion schema,
   `alertWorkflowLifecycleBinding.*` (all nine fields), `equityAndAccessibilityPlan.*`,
   `goNoGoCriterion.thresholdDescription`, `humanFactorsMeasureDefinition.{metric, thresholdValue,
   thresholdUnit}`, `v4SilentModeProtocol.operationsWindow.*`,
   `.liveDataSourceBinding.{dataPartner, ehrSystemRef, dataBoundaryPosture}`,
   `.missingnessMonitoringPlan.*`, `.wouldBeAlertCapturePlan.*`, `.overrideSimulationPlan.*`,
   `v5HumanFactorsProtocol.studyArtifactScope.candidateArtifacts`, and
   `.participantsAndRecruitment.*`. `phiHandling` was the only field among all of these where the
   gap existed. Two fields were flagged during this sweep as **not** matching the defect pattern and
   deliberately left unchanged: `intendedUse.candidateScopeStatement` and
   `analysisPlan.interimAnalysis` are both free-text/boolean-narrative fields that were never in
   their object's base `required` array to begin with (unlike `phiHandling`, which sat in a closed
   enum with `null` as an explicit third member alongside two safe values) — `interimAnalysis`'s own
   description states "Null is a valid answer meaning no interim analysis is planned," so narrowing
   it would be over-narrowing, not a fix. `candidateScopeStatement` may warrant its own review by an
   owner (should a V3 study always have to state a scope restriction, even if the answer is "no
   restriction"?) but that is a design question, not the schema/prose contradiction this remediation
   targets, and is flagged here for future attention rather than changed unilaterally. Every
   `referenceLocator`-typed field (`rightsReceiptRef`, `statisticalAuthorityRef`, `systemRef`,
   `frozenBy`, `downtimeProcedureOwnerRef`, `hazardMatrixRef`, `ehrSystemRef`,
   `equityGovernanceProtocolRef`, `dataPartnerOrSite`) was confirmed to follow one consistent
   convention across both schemas — never narrowed by any `then`, regardless of parent status — so
   none of those is a parity gap either.
2. **Owner-decision timestamp (MEDIUM, new finding).** `v3OwnerDecision.if/then` (`decision:
   go|conditional_go`) now also requires `decidedAt` non-null, alongside the pre-existing
   `decidedBy.recordId` narrowing. See section 2.6.
3. **Receipt/result/adjudication own-status narrowing (MEDIUM, new finding, deliberate choice).**
   `v3ExecutionReceipt`, `v3ResultRecord`, and `v3AdjudicationRecord` previously did not narrow
   against their own status fields at all (`executionReceiptStatus: executed` + `executedAt: null`;
   `resultStatus: executed_unadjudicated` + empty `endpointResults`). Chose to narrow rather than
   exempt, for consistency with the AUTHORED-side pattern this whole contract already establishes —
   see sections 2.3-2.5 for the full rationale, restated in each companion schema's own
   `description`.
4. **`supersededBy` enforcement (LOW).** `v3ProtocolContract` gained a second, independent
   `if/then` (an `allOf` entry): `protocolStatus: superseded` now requires `supersededBy` non-null,
   matching its own description's pre-existing claim. See section 2.2.
5. **Missing V4 whole-document `not_executed_owner_held` positive test (LOW).** V3 and V5 already had
   this pair in `tests/clinical-contract-schemas.test.mjs`; V4 did not. Added.

All five items were applied identically to the V4 (`v4SilentModeProtocol`/siblings) and V5
(`v5HumanFactorsProtocol`/siblings) record types in the companion contract
(`docs/clinical/v4-v5-safety-human-factors-contract.md`, same revision), not only to V3, because
leaving the same guard applied asymmetrically across sibling record types is the exact failure
pattern (`liveDataSourceBinding.dataBoundaryPosture` fixed, `phiHandling` missed) that caused this
fix cycle. No owner-held value was invented anywhere in this fix; every change makes a field
required-when-a-status-condition-holds, never supplies content. `npm run check` total went from
266/266 (fix-cycle-1 baseline) to 305/305 (39 new tests, all in
`tests/clinical-contract-schemas.test.mjs`); every new guard was individually reverted against a
temporary copy of the schema and its targeted regression test confirmed to fail, then the schema was
restored, before this revision was written up (see the delivery report for the exact harness and
output).

**1.1.0 — P4-V1 fix-cycle-1 remediation.** The P4-V1 diagnostic-accuracy-methods reviewer FAILed the
1.0.0 companion schema on two grounds, both closed here. **Finding 1 (CRITICAL):**
`v3ProtocolContract.if/then` omitted `endpoints` entirely, so a protocol could reach
`protocol_frozen` with a null go/no-go threshold — the exact field PEDS-DX-002 exists to protect.
Fixed by adding an `endpoints` entry to the freeze gate (requiring per-item `status: asserted`) and a
new `endpointDefinition.if/then` (requiring non-null `metric`/`thresholdValue`/`goNoGoDirection` when
asserted) — see section 2.2 and section 7. **Finding 2 (systemic):** several `then` blocks required a
key without re-narrowing its type, so `status: asserted` could coexist with `null` content —
`datasetAndReferenceStandard.sampleFrame`, `subgroupPlan.minimumCellSize`/`.strataDefinition`,
`analysisPlan.missingDataHandling`/`.blinding`, and `adjudicationSystemBinding.discordanceResolutionMethod`
are now narrowed identically to the already-correct `intendedUse`/`uncertaintyPlan` pattern. **Root
cause closed:** `tests/clinical-contract-schemas.test.mjs` now wires both this schema and its V4/V5
sibling into the test suite for the first time, with a permanent regression test per guard (each
proven to fail if its guard is reverted) and a permanent negative test reproducing the reviewer's
exact Finding-1 document. No owner-held value was invented anywhere in this fix; every change makes a
field required-when-asserted, never supplies one.

**1.0.0 — initial freeze of the V3 dependency contract (P4-T3).** Establishes the five-record chain
(protocol, execution receipt, result, adjudication, owner decision) plus the composed
`v3DependencyChain` gate record. All owner-held sections ship as `not_executed_owner_held`; no
intended use, dataset, reference standard, endpoint threshold, subgroup boundary, or adjudicator
identity is asserted anywhere in this repository. Structurally guards against the two defects the ARC
readiness run already found in adjacent planning text: an unschedulable V3 gate (`PEDS-DX-001`) and an
illustrative metric leaking into an executable go/no-go string (`PEDS-DX-002`).
