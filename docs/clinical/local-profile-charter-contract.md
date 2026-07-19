# Local Profile Charter — Contract

**Status:** contract only. Nothing here is filled in, approved, or activatable.
**Version:** 1.1.0 — see §9 for what the P3-V1 clinical-informatics review changed.
**Plan:** `arc-clinical-council-adoption-v1`, task P3-T1. Acceptance criterion AC P3.1.
**Blocking open question:** **OQ-3 — which institution and exact laboratory/terminology profile is
first — is OWNER-HELD and UNRESOLVED.**
**Additional owner-held clinical inputs:** **§2.7** records thirteen clinical dimensions this
contract deliberately does **not** model. They must be answered as part of OQ-3 resolution.

---

## 0. What this document is, and what it is not

This document specifies **what a real institution must supply and sign** before a local profile can
gate anything in this system. It is a *contract*: a list of obligations and their acceptance rules.

**It does not supply any of them.** No institution, laboratory director, designee, analyzer make or
model, measurement method, reference interval, or critical-value threshold is named or implied
anywhere in this repository, and none may be added by a repository agent. Those are owner-held
inputs under OQ-3. A plan or a test may *specify* an input; only authenticated owner evidence may
*satisfy* it.

Two further boundaries hold everywhere below:

- **Structural validity is not clinical validity.** A document that satisfies
  `schemas/reference-range.schema.json` has demonstrated that it is well-formed. It has demonstrated
  nothing about whether its intervals are correct, current, or applicable to any patient.
- **Nothing in this contract authorizes activation, release, or patient-affecting use.** Signing a
  charter is a precondition for consideration, not a grant of permission. Organizational release and
  production activation are separate owner-held decisions (plan §6).

---

## 1. The governing clinical principle

> **A published pediatric reference interval is never site-applicable by default.**

Anemia cutoffs and CBC reference intervals vary by population, age band, sex, altitude, specimen
type, analyzer, measurement method, and units. A hemoglobin value that is reported as normal on one
analyzer can be flagged on another. A capillary specimen and a venous specimen do not yield
interchangeable values. A neonatal interval and a school-age interval are different intervals, not
the same interval with a wider tolerance. `g/dL` and `g/L` differ by a factor of ten at exactly the
point where a cutoff is applied.

Because of this, **local applicability cannot be inferred**. It cannot be derived from a
publication, from a manufacturer's package insert, from another site's profile, or from the fact
that a document parsed successfully. It must be **asserted** by a named local laboratory authority
and **bound to an exact candidate version**.

The direct consequence, which the schemas and the evaluator enforce:

> Missing, conflicting, expired, superseded, unmapped, preliminary, stale, corrected, amended, and
> unknown states **fail closed and stay visible**. None of them is ever silently resolved to a
> default.

"Fail closed" means the system refuses and says why. A blocker that cannot be surfaced to a human is
indistinguishable from a crash, so every refusal carries a code, a field locator, and a reason.

---

## 2. Required charter fields

Each row is an obligation on the institution. **Acceptance rule** states what makes the field
satisfied; anything less leaves it unsatisfied and the profile fails closed. **Carrier** names the
schema field that holds it, so an unmet obligation has an exact address rather than a general
sense of incompleteness.

### 2.1 Identity and ownership

| # | Field | Acceptance rule | Carrier |
|---|---|---|---|
| 1 | Institution | Legal entity name of the laboratory asserting the profile. | `authority.institutionName` |
| 2 | Laboratory director | Named individual accountable for the assertion. Not a role, not a team, not a mailbox. | `authority.laboratoryDirectorName` |
| 3 | Director credential | The credential under which that individual is competent to assert reference intervals. | `authority.laboratoryDirectorCredential` |
| 4 | Designee | Named alternate authorised to assert in the director's absence, or explicitly none. | `authority.designeeName` |
| 5 | Assertion statement | Explicit signed statement of what is being asserted, for which population, and for which candidate version. | `authority.assertionStatement` |
| 6 | Assertion date | Date the assertion was made. | `authority.assertedOn` |
| 7 | Informatics owner | Named individual accountable for the terminology profile and its mappings. | `authority.informaticsOwnerName` (terminology profile) |

Fields 1–7 are **owner-held**. Until an owner supplies them, `authority.assertion` is
`not_executed_owner_held` and every profile in this repository fails closed.

### 2.2 Applicability dimensions

Every dimension must be **positively asserted**. Each carrier is an object with an `assertion`
discriminator taking exactly one of `asserted`, `unknown`, or `not_supplied`. There is deliberately
no fourth state meaning "infer it" or "assume the usual". A single `unknown` dimension fails the
whole profile closed.

| # | Field | Acceptance rule | Carrier |
|---|---|---|---|
| 8 | Population | Identified population the intervals were derived in or validated against. | `applicability.population` |
| 9 | Age band | Explicit bounds and unit. Lower bound inclusive, upper bound exclusive. | `applicability.ageBand` |
| 10 | Sex | `female`, `male`, or `any`. `any` must be a deliberate assertion that the interval does not vary by sex in this band, not an omission. | `applicability.sex` |
| 11 | Specimen type | Coded specimen. Capillary, venous, and arterial are distinct. | `applicability.specimen` |
| 12 | Analyzer | Manufacturer and model. | `applicability.analyzer` |
| 13 | Method | Measurement method. Checked **independently** of analyzer: the same analyzer running a different method yields different intervals. | `applicability.analyzer.method` |
| 14 | Altitude | Altitude range of the served population. Hemoglobin intervals shift with altitude, so sea level is never assumed. **Both bounds must be non-null**; a null bound is not "any altitude". | `applicability.altitude` |
| 14a | Gestational age / corrected age | Whether corrected (postmenstrual) age is **required**, and the range of gestational ages at birth this profile applies to. See §2.2b. | `applicability.gestationalAge` |

#### 2.2a Age-band policy — obligation added after the P3-V1 review

Nothing previously constrained how the age axis could be divided, so a single band could span the
whole of childhood. Two owner-held inputs are now required:

| # | Field | Acceptance rule | Carrier |
|---|---|---|---|
| 14b | Maximum band width | The widest age band acceptable at each life stage. **Owner-held.** The mechanism enforces whatever is asserted; it does not choose the number. | `ageBandPolicy.maxBandWidthDays` |
| 14c | Mandatory boundaries | The ages at which a band **must** break because the underlying physiology changes across them, each with a written rationale. **Owner-held.** An empty list asserts the site declares none; it does not assert that none exist. | `ageBandPolicy.mandatoryBoundaries[]` |

Three structural rules are enforced without owner input, because they are true of any age axis:
an asserted band must be **fully bounded** (`high: null` previously meant "unbounded above", which
made one band match every child); `low` must be strictly below `high`; and the intervals for a given
analyte must **partition the profile's applicability band** with no gaps and no overlaps. A gap is
an age with no interval; an overlap is an age with two and no rule for choosing.

#### 2.2b Gestational age and corrected age — obligation added after the P3-V1 review

`ageValue`/`ageUnit` are **chronological only**, and there was previously nowhere to put corrected
age. For pediatric anemia this was the largest single omission in the contract: a four-week-old born
at 27 weeks and a four-week-old born at 40 weeks are not the same patient, because **anemia of
prematurity has a different nadir, a different depth, and a different timing**. Delivering a
term-derived interval to a preterm infant on the strength of matching chronological age is a
dangerous miss, and nothing in the model could even express the difference.

| # | Field | Acceptance rule | Carrier |
|---|---|---|---|
| 14d | Corrected age required | Whether a request **must** carry gestational age at birth. When true and the request omits it, the evaluation fails closed with `CORRECTED_AGE_REQUIRED_NOT_SUPPLIED`. **The age below which correction is required is owner-held.** | `applicability.gestationalAge.correctedAgeRequired` |
| 14e | Gestational-age applicability range | The gestational ages at birth over which this profile's intervals were derived or validated. **Owner-held.** | `.gestationalAgeWeeksLow` / `.gestationalAgeWeeksHigh` |
| 14f | Request-side gestational age | Supplied per evaluation. | `request.gestationalAgeAtBirthWeeks` |

**Still owner-held and NOT modelled:** postmenstrual age as a distinct computed axis, an explicit
preterm flag with its threshold, and birth weight (including small-for-gestational-age). These are
recorded in §2.7 rather than invented here.

### 2.3 Values

| # | Field | Acceptance rule | Carrier |
|---|---|---|---|
| 15 | Unit system | Coded unit system (UCUM), never free text. A free-text unit cannot be safely compared. **Profile-level.** | `unitSystem.system` |
| 15a | Unit code | **Per analyte, not per profile.** A complete blood count reports hemoglobin in g/dL, hematocrit in %, MCV in fL, RBC in 10*12/L, platelets in 10*9/L, and reticulocytes in %. A single profile-level unit code made a CBC inexpressible: any real profile covered exactly one analyte or self-blocked with a unit mismatch on every other. Every interval for one analyte must agree on its unit; different analytes need not. | `intervals[].unitCode` |
| 16 | Reference intervals | Per analyte, **its own age band**, and sex, with non-null ordered bounds and its own unit code. An analyte with no entry is **not covered**, and its absence must surface rather than fall back to a published interval. | `intervals[]` |
| 17 | Critical values | Per-analyte critical low/high thresholds covering every age in the applicability band, in the **same unit as that analyte's reference interval**. An empty array asserts that none are supplied — **not** that none exist — and the evaluator refuses to deliver an interval for an analyte whose panic threshold at the request age is unknown. An urgent alert must dominate routine interval logic. | `criticalValues[]` |
| 18 | Terminology server | Endpoint plus the `profileId` of the companion terminology profile governing codes, units, and statuses. | `terminologyServer` |

### 2.4 Lifecycle, supersession, and rollback

| # | Field | Acceptance rule | Carrier |
|---|---|---|---|
| 19 | Effective start | Date from which the profile is in force. | `lifecycle.effectiveStart` |
| 20 | Effective end | Scheduled end, or explicit null. **Null does not mean "never expires"** — the staleness check still applies. | `lifecycle.effectiveEnd` |
| 21 | Review state | Only `active` is eligible for applicability. | `lifecycle.reviewState` |
| 22 | Supersession policy | When `reviewState` is `superseded`, a resolvable successor (`profileId` + `profileVersion`) is **mandatory**. A superseded profile with no successor is a dangling authority chain and a hard failure. | `lifecycle.supersededBy` |
| 23 | Review cadence | Maximum age of the last review before the profile is stale. Unknown cadence fails closed; it is never read as "no review needed". | `lifecycle.reviewIntervalDays` |
| 24 | Last review date | Date of the most recent review. A profile can be stale while still nominally `active`. | `lifecycle.lastReviewedOn` |
| 25 | Rollback trigger | The named condition that withdraws this profile — at minimum analyzer replacement, method change, unit change, and recalibration. | `lifecycle.rollbackTrigger` |
| 26 | Rollback owner | Named individual who executes the rollback. | `lifecycle.rollbackOwner` |

### 2.5 Provenance and binding

| # | Field | Acceptance rule | Carrier |
|---|---|---|---|
| 27 | Source | Where the intervals came from. | `provenance.source` |
| 28 | Exact locator | Document identifier plus table, page, or section. A bare citation is not a locator. | `provenance.locator` |
| 29 | Derivation | One of local validation study, manufacturer insert, published reference, or transferred-unverified. `transferred_unverified` is representable so it stays visible, and it fails closed. | `provenance.derivation` |
| 30 | Candidate binding | Exact `candidateId`, `candidateVersion`, and content digest the profile is asserted against. Applicability does not carry over to a different candidate. | `boundCandidate` |

### 2.6 Terminology obligations

| # | Field | Acceptance rule | Carrier |
|---|---|---|---|
| 31 | Code systems | Each pinned to an **exact version**. An unversioned system is not interpretable. | `codeSystems[]` |
| 32 | Result status policy | Which lifecycle states are recognized and which may inform a decision. `preliminary` is excluded from decision use **by construction** — no site can configure its way past it. | `resultStatusPolicy` |
| 33 | Status lineage proof | Mandatory (`requireStatusLineage` is a const, not a toggle). The site must prove, per observation, that no correction or amendment was dropped in transit. | `resultStatusPolicy.requireStatusLineage` |
| 34 | Observation requirements | Effective time, issued time, specimen, and unit are all required; plus an explicit staleness limit. | `observationRequirements` |
| 35 | Local mappings | Local code ↔ standard code, each carrying **its own** version and named authority, plus non-null unit, specimen, and equivalence. Only `equivalent` supports decision use. Two entries for the same local code that disagree are a `MAPPING_CONFLICT` and are **never** resolved by declaration order. | `localMappings[]` |
| 36 | Resource type binding | The FHIR resource type the status value set is bound to. A status value set is meaningless unbound: `Observation.status` and `DiagnosticReport.status` are **different value sets**, and the earlier unbound list mixed them — `partial` and `appended` are DiagnosticReport statuses and are not valid Observation statuses at all. Only `Observation` is supported in this phase. | `resultStatusPolicy.resourceType` |

---

## 2.7 Required owner input — clinical dimensions this contract does NOT model

The P3-V1 clinical-informatics review identified the dimensions below as real gaps. **They are
recorded here rather than implemented, because each requires a laboratory director or clinical owner
to specify the model; a repository agent inventing one would be manufacturing clinical content.**
Each must be answered as part of OQ-3 resolution. Until then, any profile that depends on one of
these dimensions is outside the scope of what this contract can validate, and that limitation must
be stated to whoever activates it.

| Ref | Dimension | Why it matters clinically | What the owner must specify |
|---|---|---|---|
| C4 | Month/year age arithmetic at neonatal boundaries | Ages are converted to days with fixed factors (1 month = 30.4375 days, 1 year = 365.25). Across the neonatal period — where hemoglobin changes fastest — that approximation can place a patient in the wrong band near a boundary. | Whether age banding below some age must use exact calendar dates or completed days rather than converted months, and which boundaries are sensitive. |
| C5 | Sex-by-age-band constraints | Sex-specific intervals are clinically meaningful only after certain developmental stages; before them a sex-stratified band may be spurious, and after them an `any` band may be unsafe. Nothing currently constrains which bands may be sex-stratified. | The ages above/below which sex stratification is required, permitted, or forbidden. |
| C6 | Pregnancy status | Pregnancy substantially alters hemoglobin and iron-study interpretation and is directly relevant in adolescent patients, who are in scope for pediatric anemia. There is no representation for it at all. | Whether pregnancy status is a required applicability dimension, how it is coded, and how an unknown status must fail. |
| C7 | Race-based vs race-free stratification | Some historical hematology reference intervals are race-stratified. Whether to carry, refuse, or explicitly reject such stratification is a clinical and ethical policy decision with direct equity consequences, and it must not be made implicitly by a schema. | An explicit policy: race-free by construction, or represented with a stated justification and governance. |
| C8 | Capillary vs venous specimen structure | Capillary and venous specimens do not yield interchangeable values; the difference is clinically material at anemia cutoffs. The current model carries a single opaque specimen code, so the distinction depends entirely on the site's coding discipline. | Whether specimen must be structured (collection site, method, order-of-draw) rather than a single code, and which distinctions are decision-relevant. |
| C9 | Anticoagulant and time-to-analysis | Anticoagulant type and the delay between collection and analysis affect CBC indices, notably MCV. Neither is represented. | Which anticoagulants are acceptable, the maximum time-to-analysis, and how an unknown delay must fail. |
| C10 | Reagent lot, calibration, and QC state | An interval is only valid while the instrument is in a qualified state. A result produced under a failed or unknown QC state is not interpretable regardless of how well every other dimension matches. | Whether reagent lot, last calibration, and QC status are required per result, and what QC state blocks decision use. |
| C12 | Reference interval vs decision limit | A reference interval (a population distribution) and a decision limit (an action threshold) are different objects with different derivations. `intervals[]` currently conflates them, and an anemia cutoff is a decision limit, not a percentile. | Which analytes carry decision limits rather than reference intervals, and how the two are distinguished and derived. |
| C13 | UCUM validation | Unit codes are compared as opaque strings. Nothing verifies that a code is valid UCUM, so a typo produces a mismatch blocker rather than an invalid-unit blocker — and two spellings of the same unit would fail to match. | Whether UCUM codes must be validated against a UCUM service, and the canonical form required. |
| C14 | LOINC six-axis mapping | LOINC codes are compared as flat strings. LOINC is a six-axis code (component, property, time, system, scale, method); two codes can differ on an axis that changes the meaning of the result while looking like an ordinary mismatch. | Whether mappings must be validated axis-by-axis, and which axes must match exactly. |
| C15 | Altitude adjustment | Altitude is currently matched as a range, so a profile simply does not apply outside it. Real practice may require an altitude **adjustment** to hemoglobin rather than a refusal. | Whether adjustment is permitted at all, and if so the adjustment model, its bounds, and its authority. Refusing is the safe default and remains the current behaviour. |
| C16 | Request-side assertion discriminator | Profile-side dimensions carry a three-state `assertion` discriminator; the **request** side does not. A request can only say "absent", not "explicitly unknown", so the two are conflated at the point of evaluation. | Whether the request contract must carry the same discriminator, and how "explicitly unknown" must differ from "not supplied". |
| C17 | Downtime and recovery | There is no defined behaviour for laboratory or terminology-server downtime, or for reconciling results produced during it. Fail-closed is correct in the moment but does not describe recovery. | Downtime behaviour, how results produced during downtime are marked, and the reconciliation procedure on recovery. |

---

## 3. Result-status lifecycle: why `preliminary`, `corrected`, and `amended` are first-class

These three states are modelled as lifecycle states rather than annotations, because each
corresponds to a distinct way a decision can be wrong:

- **`preliminary`** — the value may still be revised. Treating it as final means acting on a number
  the laboratory has not stood behind. It is refused for decision use.
- **`corrected` / `amended`** — a superseding value exists. This is the most dangerous case in the
  whole contract, because the value in hand *reads as authoritative*: it says `final`, it has a
  timestamp, and nothing about it looks wrong. The only thing distinguishing it from a good result
  is information that lives elsewhere.

Therefore **silence is not accepted as evidence that nothing was corrected.** The site must supply a
positive proof of complete status lineage. Three distinct conditions each fail closed:

1. lineage absent or incomplete → the possibility of a dropped correction cannot be excluded;
2. lineage records a correction/amendment but the current status is `final` → the revision was lost
   in transit;
3. a correction is recorded but the superseding observation cannot be resolved → the state is
   ambiguous.

A lost or ambiguous corrected/amended state is a **hard failure, never a warning**. A warning is
something a caller may ignore, and this is not ignorable.

The direction of condition 3 matters and was previously inverted. The superseding observation is
required from the result that is **not** the revision — a `final` result with a correction recorded
downstream. A result whose own status is `corrected` and which is the latest version has **no**
superseding observation, and demanding one from it was wrong. For such a result, a resolvable
superseding reference means the opposite: something newer supersedes **it**, so it is not the latest
version either (`OBSERVATION_SUPERSEDED`). A reference pointing at the observation itself resolves
nothing while satisfying a presence check, and is refused (`SUPERSEDING_REFERENCE_SELF`).

Two further lineage obligations are enforced: the current `status` must actually **appear** in
`lineage.states` (otherwise the lineage describes some other observation), and the states must be
**ordered** in the Observation lifecycle (otherwise the lineage cannot establish which state is
current, which is the only thing it exists to prove).

### 3.1 Refusal visibility — one reason per code

A refusal that cannot tell a clinician *what to do next* is only half a refusal. A single
`RESULT_STATUS_BLOCKED` code previously covered five situations demanding **three different human
actions**, so the code is split:

| Code | Situation | What the human should do |
|---|---|---|
| `RESULT_NOT_YET_AVAILABLE` | `registered` — ordered, not yet resulted | **Wait.** |
| `RESULT_CANCELLED_NEVER_PERFORMED` | `cancelled` — never performed | **Re-order.** |
| `RESULT_RETRACTED_ENTERED_IN_ERROR` | `entered-in-error` — **retracted** | **Discard.** The value must not be displayed, retained, or interpreted — a materially stronger obligation than "do not decide on it". |
| `RESULT_STATUS_BLOCKING_STATE` | a state the site declared blocking (e.g. `preliminary`) | Await the final result. |
| `RESULT_STATUS_NOT_ACCEPTED_FOR_DECISION` | recognized, not blocking, but not accepted | Consult the site policy. |

### 3.2 Blocker severity

Blockers were an unordered flat list, so `PROFILE_STALE` and `CORRECTION_UNRESOLVED` read as peers.
They are not: one means the profile is overdue for review, the other means the number in hand has
been superseded. Every blocker now carries a severity and the list is ordered most-dangerous-first.

- **`critical`** — a wrong, superseded, or retracted **value** could reach a clinician.
- **`high`** — the profile or result is not trustworthy, but no specific wrong number follows.
- **`moderate`** — a required input is absent or unknown, so nothing can be judged at all.

**Severity orders presentation only.** Every blocker is equally fail-closed. There is still no
severity at which a blocker may be ignored, suppressed, or auto-dismissed, and `moderate` does not
mean "minor" — it means the evaluation could not even begin on that dimension.

---

## 4. Signature and attestation — deliberately out of scope here

The cryptographic signature and attestation envelope — signer identity, signature verification, and
revocation — is **not defined in this contract**. It is P2's authenticated-attachment primitive and
lands with P2, so that the laboratory contract and the attachment contract cannot diverge into two
incompatible notions of "signed".

Where a signature will attach, the schemas carry a named placeholder:

```
attestation.attachmentContract = "p2-authenticated-attachment"   (const)
attestation.signatureState     = "not_executed_owner_held" | "bound"
attestation.attachmentRef      = null until bound
```

**Unsigned profiles fail closed today** — and this is a property of the **mechanism**, not of the
documents that happen to be checked in.

That distinction is load-bearing, and the P3-V1 review found the claim was previously true only of
the fixtures. The gate read `signatureState !== 'bound'` and refused on it, which means a document
that simply *said* `"bound"` passed the signature check. A `signatureState` string is a
**self-declaration**. There is no attachment verifier anywhere in this repository — resolving,
verifying, and revoking an authenticated attachment is P2's primitive — so nothing here can tell a
real signature from a typed word.

Therefore:

> `evaluateActivationGate` emits `SIGNATURE_NOT_EXECUTED_OWNER_HELD` for **anything that is not a
> verified attachment resolved by a verifier it was handed.** Since no such verifier exists on this
> side, `bound` is **unreachable here by construction** — not merely absent from the current
> fixtures. A document declaring `"bound"` additionally raises
> `SIGNATURE_SELF_DECLARED_NOT_VERIFIED`, so the attempt is loud rather than silent.

The same correction applies to authority. `authority.assertion: "asserted"` with every identity
field still null was accepted, because "asserted requires every sibling to be non-null" was prose
rather than a constraint. **An assertion by nobody is not an assertion**: it is now a schema
conditional *and* an independent gate check (`AUTHORITY_INCOMPLETE`).

The placeholder documents a future binding; it does not soften a present requirement.

---

## 5. Activation gate

Applicability and activation are separate layers, and the separation is load-bearing.

- **Applicability** is a mechanical dimension check: do population, age band, sex, specimen,
  analyzer, method, altitude, units, and candidate digest all match? This layer can pass.
- **Activation** additionally requires authority and attestation. This layer **cannot pass today**,
  and must not be reachable by matching dimensions alone.

A profile passes the activation gate only when **all** of the following hold:

1. `profileClass` is `site_asserted` — never `synthetic_example`;
2. `authority.assertion` is `asserted`, with every identity field of §2.1 supplied by the real owner;
3. `attestation.signatureState` is `bound`, under the P2 attachment contract;
4. applicability was positively established for the exact candidate digest under evaluation.

Any unmet condition yields `not_executed_owner_held` and a visible blocker. **Absence is recorded as
`not_executed_owner_held`, never as synthetic approval.**

---

## 6. Synthetic profiles

The fixtures in `tests/fixtures/local-profile/` are **synthetic**. Their analytes, code systems,
analyzers, methods, units, and interval values are invented placeholders chosen so they cannot be
mistaken for laboratory values, and they name no real institution or individual.

A synthetic profile must never read as an approved site profile. This is enforced at three
independent levels, because any single level could be defeated by a copy-paste or a one-line edit:

1. **Filename** — every profile fixture is prefixed `SYNTHETIC-`, so a directory listing shows it
   before the content is opened;
2. **Content** — `profileClass: synthetic_example` plus a `syntheticDeclaration` block asserting
   `synthetic`, `notForClinicalUse`, and `notAnApprovedSiteProfile`;
3. **Schema** — a conditional pins `authority.assertion` and `attestation.signatureState` to
   `not_executed_owner_held` for any `synthetic_example` document, and forbids a `site_asserted`
   document from carrying a `syntheticDeclaration`. Promoting a synthetic profile by editing one
   field is a *structural* violation, not a permitted change.

No `site_asserted` profile exists anywhere in this repository, and a test asserts that none appears.

---

## 7. Owner-held gaps

Nothing in this section may be filled in by a repository agent. Each gap names the schema field that
carries it, so its absence has an exact address.

| Gap | Carrier | State |
|---|---|---|
| First institution (OQ-3) | `authority.institutionName` | `not_executed_owner_held` |
| Laboratory director, credential, designee (OQ-3) | `authority.laboratoryDirectorName`, `.laboratoryDirectorCredential`, `.designeeName` | `not_executed_owner_held` |
| Informatics owner (OQ-3) | `authority.informaticsOwnerName` | `not_executed_owner_held` |
| Signed assertion statement and date | `authority.assertionStatement`, `.assertedOn` | `not_executed_owner_held` |
| Analyzer make, model, method (OQ-3) | `applicability.analyzer.*` | placeholder only |
| Population definition and age bands (OQ-3) | `applicability.population`, `.ageBand` | placeholder only |
| Specimen type, units, intervals, critical values (OQ-3) | `applicability.specimen`, `units`, `intervals[]`, `criticalValues[]` | placeholder only |
| Terminology server and code system versions (OQ-3) | `terminologyServer`, `codeSystems[]` | placeholder only |
| Local code mappings and mapping authority (OQ-3) | `localMappings[]` | placeholder only |
| Age-band maximum width and mandatory boundaries (OQ-3) | `ageBandPolicy.maxBandWidthDays`, `.mandatoryBoundaries[]` | placeholder only |
| Corrected-age policy and gestational-age applicability range (OQ-3) | `applicability.gestationalAge.*` | placeholder only |
| Postmenstrual age axis, preterm flag and threshold, birth weight | not carried here | **owner-held (§2.7 C2 residual)** |
| Signature envelope, signer identity, revocation | `attestation.*` | deferred to P2 |
| Attachment **verifier** (nothing here can verify a signature) | not carried here | deferred to P2 |
| Thirteen unmodelled clinical dimensions (C4–C10, C12–C17) | not carried here | **owner-held — see §2.7** |
| Privacy/security approval for any FHIR or PHI boundary | not carried here | owner-held (plan §6) |
| Organizational release and production activation | not carried here | owner-held (plan §6) |

---

## 8. Related artifacts

| Artifact | Path |
|---|---|
| Reference interval schema (`schemaVersion` **1.1.0**) | `schemas/reference-range.schema.json` |
| Terminology applicability schema (`schemaVersion` **1.1.0**) | `schemas/terminology-profile.schema.json` |
| Fail-closed evaluator | `scripts/lib/local-applicability.mjs` |
| Schema validator (fails closed on unknown keywords) | `scripts/lib/json-schema-lite.mjs` |
| Synthetic fixtures and negative-case manifest | `tests/fixtures/local-profile/` |
| Failure-mode tests | `tests/local-applicability.test.mjs` |
| Synthetic containment tests (repository-wide scan) | `tests/synthetic-profile-containment.test.mjs` |
| Schema-validator tests | `tests/json-schema-lite.test.mjs` |

---

## 9. Revision history

**1.1.0 — remediation of the P3-V1 clinical-informatics review (FAIL against AC P3.1).**

The review's core finding was that **applicability was inferable**: four field edits promoted the
shipped synthetic fixture to `{decision: "applicable", blockers: []}`. Several claims in this
document were true of the fixtures checked in and false of the mechanism enforcing them. The
mechanism has been changed to match the claims, not the reverse.

Structural changes worth restating: the unit code moved from the profile to the **analyte** (§2.3),
so a complete blood count is expressible; **critical values are now evaluated** rather than merely
modelled (§2.3 #17); **gestational/corrected age** is represented (§2.2b); **age-band width,
placement, and partitioning** are constrained (§2.2a); the status value set is **bound to a resource
type** (§2.6 #36); and refusal codes are **split by required human action** and **ordered by
severity** (§3.1, §3.2). Thirteen clinical dimensions the review identified are recorded as
required owner input in **§2.7** rather than invented here.
