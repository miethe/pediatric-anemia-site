---
title: 'Findings: ARC Clinical Council Adoption v1'
schema_version: 2
doc_type: report
report_category: finding
status: completed
created: '2026-07-19'
updated: '2026-07-21'
feature_slug: arc-clinical-council-adoption-v1
plan_ref: docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
owner: pediatric-cds-program-owner
tags:
- arc
- clinical-review
- security
- findings
---

# Findings — ARC Clinical Council Adoption v1

In-flight findings from the independent reviewer gates for P0–P6. Each row records the gate that
produced it, the disposition, and where it landed. Findings that were **refuted** are kept, because a
refuted finding is evidence too.

Severity uses the reviewers' own scale. "Fixed" means a regression test exists.

> **Read P0-9 first.** The most instructive finding in this run was produced *by* this pipeline and ratified by its own independent reviewer: a confident refutation resting on a search of the wrong set of repositories. Absence of evidence where you thought to look is not evidence of absence. It is recorded rather than quietly reverted, on the same principle the rest of this document applies to everyone else's claims.

## P0-V1 — truth review (verdict: PASS-WITH-FINDINGS)

| # | Severity | Finding | Disposition |
|---|---|---|---|
| P0-1 | high | `RESULTS.md` totals row arithmetically false: `576 (485/50/31)`; 485+50+31=566, and the live inference sum is 60 | Fixed in `63e06a8` |
| P0-2 | high | Provenance note cited `GET /api/runs` as substantiating §3 and §4; that endpoint carries neither per-source-card data nor any audit record | Fixed — re-cited to local run artifacts; §4 marked `corroborated-by-artifact, no standalone audit record` |
| P0-3 | med-high | The `planned → verified` upgrade was cited to `status_derived: published`, which reads `published` for **all 48 runs** in the store while `status_raw` remains `planned` for all 48 — it would have read `published` on the day the docs correctly said "planned" | Fixed — re-cited to `runs/<id>/reviews/verification.yaml` (`passed: true`, `exit_code: 0`, 2026-07-18), with an explicit warning not to re-derive "verified" from the non-discriminating field |
| P0-4 | medium | `00-expansion-plan.md` cited a nonexistent `plan-completion.md` | Fixed — the real file was located under `.claude/progress/platform-foundation-p0/` |
| P0-5 | low | README referenced a "status column" that does not exist | Fixed |
| P0-6 | low | "entirely gitignored" overstated; `runs/.gitkeep` is tracked | Fixed |
| P0-9 | **high** | **Self-inflicted.** P0 "corrected" the original `committed locally 4144634` claim as fabricated, and P0-V1 independently ratified it. **Both were wrong — the original claim was true.** `4144634` is a real commit (`data: land 7 verified pediatric-CDS evidence bundles`) holding all 7 runs / 253 files. It lives in a **separate dual git-dir** at `research-foundry/.git-data`, which tracks the data plane and pushes to the private `research-foundry-data` remote; the public repo `.gitignore`s that path by design. Both passes searched the four project repos and the public `.git`, found nothing, and concluded fabrication — never considering a dual git-dir | **Retracted at merge** in the squash commit; RESULTS.md now states the original claim with the mechanism documented, and the retraction is kept visible rather than quietly reverted |
| P0-7 | low-med | Three absolute `cd /Users/…` paths in the handoff, plus a paragraph pre-authorizing them | Fixed in P1-T4 (`412fc37`) — now `cd "$ARC_REPO"`; the exemption paragraph is removed |
| P0-8 | low | Runs-viewer assertion unverified | Not upgraded; left unasserted |

Also closed at P0: IntentTree was queried and holds **no tree** for either repo, so this program has no
IntentTree binding and no program-graph state to reconcile.

## P1-V1 — adversarial security review of target resolution (verdict: PASS-WITH-FINDINGS)

All fixed in `f1a51c8` with a regression test each; ADR-0004 updated so design does not drift from code.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| F1 | high | Clean-tree gate failed open: only `dirty`/`untracked` were rejected, so `not_git` — no commit at all — passed. A missing git binary, `rev-parse` failure, timeout, and non-40-hex result **all** collapsed into `not_git`. A clinical run could resolve against fully mutable uncommitted bytes | Fixed — only `clean` accepted; indeterminate git state is a hard error. Pediatric fixtures now `git init` rather than the gate being weakened (every fixture was non-git, so the gate had never once been exercised) |
| F2 | high | Scan/hash TOCTOU: the prohibited-content scan ran on source bytes **before** hashing, proving hash→copy→verify but never scan→hash | Fixed — authoritative scan moved to the isolated copy after post-copy digest verification |
| F3/F3b | medium | Preview was a false green: `--dry-run` returned `ok:true` for unregistered alias, wrong digest, and absolute target `/etc/hosts`, and leaked the unresolved absolute path into AOS correlation | Fixed — preview resolves, fails closed, emits only canonical identifiers, stays side-effect-free |
| F4 | medium | New-format validation could be downgraded to legacy by deleting one manifest field | Fixed via durable provenance evidence. **One clause refuted**: "unconditionally reject absolute manifest targets" is unsatisfiable alongside byte-identical legacy validation, because an existing run legitimately records one. Residual accepted as ADR T15 |
| F5 | medium | Git pathspec magic could forge `clean`: a file named `*.md` matched every tracked `.md` | Fixed — `--literal-pathspecs`, and `ls-files` must cover exactly the requested path |
| F6 | medium | Registry accepted a relative root resolving against CWD; `runs/` exclusion enforced only in the CLI writer | Fixed at load time |
| F7 | medium | `arc validate` never checked that the recorded locator agreed with `root_alias` + `relative_path`, so it could print "target identity verified" for a file the locator never named | Fixed |
| F8 | low | Hardlinks bypassed every `is_symlink()`-only control | Fixed at scaffold, dispatch, and copy time |
| F9 | low | Non-regular files invisible to hash and scan; `copytree` would open a FIFO and hang dispatch indefinitely | Fixed — rejected at scaffold |
| F11 | low | HTTP API could not express `target_artifact_class`/`target_sha256` | Fixed; `openapi.json` regenerated (it was already stale) |
| F13 | low | Registry temp file created at ambient umask; no trust check on read | Fixed — `mkstemp` 0600 from first byte; refused if symlink, not owner-owned, or group/world-writable |
| F14 | info | Unknown class strings echoed; `..` pattern rejected legal `notes..md`; duplicate `verify_resolved_target` | All three fixed |
| F10, F12 | low | `artifact_class_defaulted` inert; `ARC_APPROVED_ROOTS` overrides the approval boundary | **Tracked, not fixed** |

## P2-V1 — adversarial review of authenticated authority (verdict: PASS-WITH-FINDINGS)

**The core claim survived**: no path was found by which a model-authored, hand-edited, or forged record
mints authority, given an uncompromised trust registry. Verified independently: no signing path exists
in `arc_cli/`, no `arc authority issue`, `credentialed_review_complete` is unreachable, and the signed
payload covers everything except the `signature` object itself (all schemas `additionalProperties:
false` at every level), so there is no unsigned-field-injection or signature-stripping surface.

What it found instead are **temporal and aggregation weaknesses that let a genuinely-signed record
assert more, later, and more broadly than it should** — plus one destructive side effect.

| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | high | `arc validate` pins the verification moment to `verified_at` — a field inside the summary whose truthfulness is being checked. An expired record re-derives as `verified` forever. Recorded `revocation_state` is reported but never cross-checked against the offline snapshot, which needs no network | Fixed in `50df81b` |
| F2 | high | `arc authority attach` on a completed run retroactively changes the expected signoff, making the existing honest receipt fail validation — satisfiable only by hand-editing the receipt to the **stronger** claim. The schema's "at receipt write time" semantics are unenforceable | Fixed in `50df81b` |
| F3 | medium | `any()` over gates: one satisfied authority of N (schema minimum 2) flips the receipt, and masks a sibling in `conflicted_records` — where the owner both approved and rejected. `satisfies_authority` is an unbound free string, and `binding["required_authorities"]` is hardcoded `None`, so the V3 check never runs | Fixed in `50df81b` |
| F4 | medium | A verified owner **rejection** falls through to `owner_held_not_executed` — indistinguishable from "the owner never acted." Refusal must be louder than absence | Fixed in `50df81b` |
| F5 | medium | The self-approval check is dead code: `initiator_subject` is read but never written by any ARC path. Separation of duties reduces to two booleans the issuer asserts about itself | Fixed in `50df81b` |
| F6 | medium | `max_age_hours` is optional, so an offline revocation snapshot of any age is accepted as authoritative `clear` — contradicting "stale ⇒ verification_unavailable" | Fixed in `50df81b` |
| F7 | medium | Online revocation accepts `http://` and an unsigned, unbound JSON body; anyone answering that host suppresses a revocation by returning `{}`. The offline path, by contrast, requires a fully verified signed snapshot | Fixed in `50df81b` |
| F8 | medium | `arc validate` **deletes** files: `verify_run_authority` unlinks on `prohibited_content`, and the scan false-positives on `metadata.owner: someone@example.org` — a required free-form field. An owner-signed record is irreversibly destroyed by a read-only command | Fixed in `50df81b` |
| F9 | medium | `metadata.*` is `additionalProperties: true`, and a shipped run already carries a hand-authored `review_execution` block using the exact D8 vocabulary — never re-derived, never schema-constrained. The mint boundary is airtight for validated carriers and open for the free-form neighbour that looks identical to a reader | Fixed in `50df81b` |
| F10 | low | `signature.key_id` sits outside the signed payload and is never reconciled with the signed `spec.signer.key_id` | Fixed in `50df81b` |
| F11 | low | Non-atomic, unlocked manifest/certification rewrite in `attach`; `summary()` can emit `"unknown"`, outside the schema enums | Fixed in `50df81b` |
| F12 | low | Unquoted RFC-3339 YAML timestamps canonicalize differently; the diagnostic is indistinguishable from tampering | Fixed in `50df81b` |
| H1 | hypothesis | Trust registry has no ownership/mode/symlink check on read, and `ARC_AUTHORITY_TRUST` is the human-approval boundary | Fixed in `50df81b` |
| H2 | hypothesis | `VerifiedRecord.spec` is not `repr=False`; no live leak found, but one careless log line from exposing `credential_ref` | Fixed in `50df81b` |

## Owner-held, unresolved (not findings — plan §6)

OQ-2 identity provider and credential authority; OQ-3 first institution, laboratory director,
analyzers, methods, units, intervals, critical values; OQ-4 V3 datasets and protocol; OQ-5 MeatyWiki
vault and ACL; OQ-6 authoritative approval and adjudication system. Until an operator runs
`arc authority trust add`, every authority gate remains `owner_held_not_executed` and runtime
behavior is unchanged.

## P3-V1 — clinical-informatics review of local applicability (verdict: **FAIL**, then remediated)

The only gate in this run to fail. Remediated in `9ebf240` (pediatric) and `fed4de5` (ARC); both
suites re-verified discriminating by deliberate mutation.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| F1 | critical | The pediatric activation gate had no verifier — `signatureState: "bound"` was self-declared, and the "additionally requires attachmentRef" text was prose, not a constraint. Four field edits promoted the shipped synthetic fixture to `applicable`, and the mutated document was schema-valid | Fixed — `bound` is unreachable by construction on that side; schema conditionals pin the authority and attestation blocks |
| F2 | critical | Each interval's own `ageBand` was required by schema and read by nothing: a 0-14-day interval was served for a 12-month-old with zero blockers | Fixed — matched, with `AGE_BAND_MISMATCH` scoped to `intervals[]` |
| F3 | critical | The assertion discriminator guarded only one key per container, so every secondary value was a silent wildcard when null — altitude became `±Infinity` (matching every altitude, in code whose comment says sea level is never assumed), `ageBand.high` unbounded, interval sex `any`, mapping unit/specimen skipped | Fixed. **Headline partly refuted**: `analyzer.method: null` *did* emit a blocker — but the wrong one (`METHOD_MISMATCH` when nothing was mismatched and the dimension was never asserted). Fixed as a diagnosis defect |
| F4 | high | Bound-less and inverted intervals were `applicable` | Fixed — `INTERVAL_BOUNDS_MISSING`, `INTERVAL_BOUNDS_INVALID` |
| F5 | high | Conflicting local mappings resolved silently by first match | Fixed — `MAPPING_CONFLICT` |
| F6 | high | `supersedingObservationRef: null` satisfied the correction check while the negative case used `"unset"` — **the suite proved the opposite of its claim**. Semantics were also inverted; self-reference, lineage membership, and ordering unchecked | Fixed, and the test corrected to exercise the real defect |
| F7 | high | `partial`/`appended` (DiagnosticReport statuses) accepted in an Observation policy with no `resourceType` discriminator; `entered-in-error` treated as merely non-decision-grade rather than a **retraction** | Fixed — discriminator added, value set corrected to FHIR ObservationStatus, retraction gets its own code |
| F8 | high | No drift detection: only a case count, against ARC's own vendored copy. An edited mutation upstream is undetectable | Fixed — SHA-256 per file plus upstream commit and data-model version pins. Verified at merge: byte-identical, pin equals pediatric HEAD |
| F9 | high | Nine confirmed JS↔Python semantic divergences on inputs outside the manifest — most dangerous, an unparseable evaluation time silently disabled expiry, not-yet-effective, and staleness together | All nine resolved and tested; two remain deliberate ARC-side strictness, flagged for upstreaming |
| F10-F18 | medium/low | Raw-Mapping path skipped the profile-digest filter; assertion identity never cross-checked against the document; containment levels not independent; summary dropped the locator; messages echoed owner values; candidate binding digest-only; supersession chain unresolved | All fixed in `fed4de5` |
| H4 | hypothesis | Separation of duties enforced at verification but defeatable at configuration — nothing stopped granting one issuer both rights | Fixed — refused at registration and verification |

### Clinically insufficient (distinct from incorrect)

The reviewer separated seventeen items that pass their own tests and would still be rejected by a
laboratory director. Three were treated as blocking and fixed, because they are structural rather
than matters of clinical judgment:

- **C1** — one unit per profile made a CBC inexpressible (hemoglobin g/dL, hematocrit %, MCV fL,
  platelets 10⁹/L all self-blocked). Unit moved to the analyte.
- **C11** — critical values were modelled, required, and **never once consulted** by either
  implementation, with no blocker codes. A panic threshold that is stored and never read.
- **C2** — no gestational or corrected age: a 4-week-old born at 27 weeks and one born at 40 weeks
  were the same patient, though anemia of prematurity differs in nadir, depth, and timing.

The remaining thirteen (C4-C10, C12-C17 — neonatal boundary arithmetic, sex-by-age-band, pregnancy,
race-based vs race-free stratification, capillary vs venous, anticoagulant and time-to-analysis,
reagent lot and QC state, interval vs decision limit, UCUM, LOINC six axes, altitude adjustment,
request-side assertion discriminator, downtime and recovery) are recorded in
`docs/clinical/local-profile-charter-contract.md` §2.7 as **required owner input** with clinical
rationale and the exact question each owner must answer. They were deliberately **not invented**: an
agent authoring pediatric reference-interval semantics into a schema that gates clinical decision
support is precisely the failure this plan exists to prevent.

## P4-V1 — REOPENED: four additional specialty lenses (verdict: three FAILs, owner-held)

P4-V1's first pass (see above table) dispatched four of the "eight specialty lenses plus methods,
safety, human-factors, and equity" AC P4.1 names (`safety-human-factors`, `diagnostic-accuracy-methods`,
`equity-patient-family`, `task-completion-validator`) and PASSed — recorded by the phase owner as an
unresolved reviewer-count ambiguity (`.claude/progress/arc-clinical-council-adoption-v1/phase-4-completion.md`,
"OPEN ITEM FOR THE ORCHESTRATOR"). The gate was reopened to run the remaining four domain lenses
(`pediatric-hematology-reviewer`, `pediatric-laboratory-medicine-reviewer`,
`general-pediatrics-reviewer`, `clinical-informatics-interoperability-reviewer`) against the current
tree. Three returned FAIL. None is a repo-fixable defect on its own terms — each is a clinical-content
or scope decision this plan's own §6 reserves to an external owner. Two parallel agents are landing the
repo-side companion work in this same reopening under separate file ownership (hazard-matrix schema/
tests, clinical-contract schemas); their finding IDs are cross-referenced below, not duplicated here.

This register carries **only** the owner-held decision record for each finding. No rule, threshold,
severity, or hazard-family definition is proposed here — see plan §6 and the discipline note at the
top of this document's authoring instructions.

### Register

| ID | Severity | Source lens | Owner role | Blocks |
|---|---|---|---|---|
| R2(b) | **critical** | pediatric-hematology-reviewer | `pediatric-safety-owner` + credentialed pediatric-hematology reviewer | `credentialed_review_complete`, `clinical_validation_complete`, `certified_for_defined_scope`, `released`, `activated` |
| R4 | high | general-pediatrics-reviewer | `pediatric-safety-owner` + credentialed general-pediatrics/hematology reviewers | `credentialed_review_complete`, `clinical_validation_complete`, `certified_for_defined_scope`, `released`, `activated` |
| R5 | med-high | pediatric-hematology-reviewer | `clinical-informatics-owner` (schema-scope decision) + `pediatric-safety-owner` (clinical-risk sign-off) | `credentialed_review_complete`, `clinical_validation_complete`, `certified_for_defined_scope`, `released`, `activated` |
| R9 (proposed OQ-7) | low/med | clinical-informatics-interoperability-reviewer | program owner (to confirm into plan §7); `clinical-governance-owner` for the underlying crosswalk decision | live-EHR/CDS-Hooks integration claims only; does not block repository-only or synthetic-pilot states |
| R10 | low | clinical-informatics-interoperability-reviewer | informational — no owner action required to close; `pediatric-safety-owner` if scenario-level `candidateBinding` is later relied upon | none (note only) |
| R12 | abstention | general-pediatrics-reviewer | `pediatric-safety-owner` + credentialed general-pediatrics reviewer | `credentialed_review_complete`, `clinical_validation_complete`, `certified_for_defined_scope` |
| R13 (general-pediatrics F4; recovered late — see process note in its entry) | medium | general-pediatrics-reviewer | `pediatric-safety-owner` + credentialed general-pediatrics reviewer | `credentialed_review_complete`, `clinical_validation_complete`, `certified_for_defined_scope` |

Also produced in this reopening, owned by parallel agents, referenced not duplicated: **R1** (product-
integration disclosure), **R3** (`signatureRef` self-declared-signature enforcement), **R6** (critical-
value coverage boundary), **R7** (UCUM asserted-in-prose-only), **R8** (workflow precondition
dependency), **R11** (unreferenced `datStatus`) — see the hazard-matrix and clinical-contract findings
landed alongside this section.

### Reconciliation note (P4-V1 remediation, added post-landing)

**R-numbers** (`R1`, `R2(b)`, `R3`, `R4`, `R5`, `R6`, `R7`, `R8`, `R9`, `R10`, `R11`, `R12`) are
**reviewer-item labels** — the ordinal names this gate's four reopened specialty lenses assigned their
own findings during the P4-V1 review pass, used only within this register and the phase-4 completion
note. **`PAC-P4T2-*`** are the **canonical finding IDs** carried in the machine-readable
`docs/safety/hazard-control-matrix.json` (source of truth) and mirrored in
`docs/safety/hazard-control-matrix.md`. They are not two separate finding sets: every `PAC-P4T2-*` ID
below is the repo-side landing of an R-number this register already tracked; a reviewer should read
them as one finding under two labels, not as newly discovered defects. Verified directly against the
matrix JSON (not merely the summary that motivated this task) on 2026-07-19:

| Canonical ID | Row (`hazardId`) | Field | Severity | Owner role | R-number |
|---|---|---|---|---|---|
| `PAC-P4T2-001` | `DM-EQUITY-009` | `finding` | high | `equity-and-family-governance-owner` | pre-existing (not a P4-V1 R-item) |
| `PAC-P4T2-002` | `DM-WORKFLOW-010` | `finding` | high | `pediatric-safety-owner` | R8 (framing) |
| `PAC-P4T2-003` | `DM-LAB-005` | `productIntegration.finding` | critical | `local-laboratory-director` | R1 |
| `PAC-P4T2-004` | `DM-RESULT-007` | `productIntegration.finding` | critical | `clinical-informatics-and-privacy-owner` | R1 |
| `PAC-P4T2-005` | `DM-FHIR-008` | `productIntegration.finding` | critical | `clinical-informatics-and-privacy-owner` | R1 |
| `PAC-P4T2-006` | `DM-HEME-002` | `coverageFinding` | critical | `pediatric-safety-owner` | R2(b) |

All six IDs, rows, fields, severities, and owner roles matched the task's supplied table exactly
against the live JSON — no correction was needed to that table.

**R2(b) ↔ PAC-P4T2-006 split, stated plainly:** `PAC-P4T2-006` is the repo-side technical finding — it
records, with rule-tracing and a live-engine regression test, that `DM-HEME-002`'s bound control
(`HEM-003`) covers only the fixture's own missingness/abstention branch and that the aplastic-crisis
branch (hemolysis markers positive + `reticulocytes.response: "low"`) reaches no rule unless
`history.knownChronicHemolyticDisease` and `history.recentViral` are both already true. **R2(b) above**
is the owner-held clinical half of the *same* hazard: whether the engine should gain a
history-independent safety net for that branch is a clinical-content decision (threshold, alert
severity, false-positive risk) that this repository task does not have the authority to make. Closing
`PAC-P4T2-006` therefore requires the signed clinical-content decision R2(b) describes — the finding is
one hazard, disclosed once at the technical layer (`PAC-P4T2-006`, `blockedOnTask`) and once at the
governance layer (R2(b), `Owner role` / `Blocks`), not two independent problems.

**R1 ↔ `PAC-P4T2-003`/`004`/`005`:** R1 (product-integration disclosure, listed above as referenced-not-
duplicated) is the same finding as these three IDs: `scripts/lib/local-applicability.mjs`'s
`evaluateReferenceIntervalApplicability`/`evaluateTerminologyApplicability` have zero production
callers, and `schemas/patient-input.schema.json` — the only input surface the shipped app accepts — has
no specimen/analyzer/method/unitCode or FHIR/terminology-observation property, so `DM-LAB-005`,
`DM-RESULT-007`, and `DM-FHIR-008`'s `control_bound` status does not protect the deployed product today.
Landed as the `productIntegration.status: repository_only_not_reachable_by_deployed_app` re-label plus
the three `productIntegration.finding` entries in `docs/safety/hazard-control-matrix.json`, narrated in
`docs/safety/hazard-control-matrix.md` §1a.

**Repo-side landing locations for R3/R6/R7/R8/R10/R11** (so a reader can find each without re-deriving
it):

- **R3** (`signatureRef` self-declared-signature enforcement) — `docs/clinical/schemas/v3-protocol-
  result.schema.json`, `v3OwnerDecision.signatureRef` if/then/else (`signatureState: "bound"` now
  requires a non-null `attachmentRef`; any other state requires it null). Propagates by `$ref` into
  `docs/clinical/schemas/v4-v5-safety-human-factors-result.schema.json`'s `v4OwnerDecision`/
  `v5OwnerDecision.signatureRef`. Narrated in `docs/clinical/v3-diagnostic-accuracy-contract.md` and
  `docs/clinical/v4-v5-safety-human-factors-contract.md`; regression-tested in
  `tests/clinical-contract-schemas.test.mjs`.
- **R6** (`DM-LAB-005` coverage boundary against the P3 critical-value lane) — no P4 dangerous-miss
  fixture exercises any `BLOCKER.CRITICAL_VALUE_*` code; that mechanism is real but tested only in the
  P3 lane (`tests/local-applicability.test.mjs` + `tests/fixtures/local-profile/negative-cases.json`).
  Landed as an explicit cross-reference in `DM-LAB-005`'s `controlBinding.rationale` in
  `docs/safety/hazard-control-matrix.json`, narrated in `docs/safety/hazard-control-matrix.md` §1c.
- **R7** (UCUM asserted-in-prose-only) — **RESOLVED; the earlier "no repo-side landing location was
  found" flag above was a search miss, corrected here.** CONFIRMED, branch (a), fixed by prose
  correction. The overclaim lived in JSON Schema `description` fields —
  `schemas/terminology-profile.schema.json:314` and `schemas/reference-range.schema.json:443`/`448`
  (the latter previously asserted "Free-text units are not accepted," which was **false** against the
  actual unconstrained-string type) — not in the markdown docs the prior repo-side search covered,
  which is why that search returned a false negative. `docs/validation-regulatory.md:42`'s hazard
  table also overclaimed "strict schema/UCUM, reject ambiguous units" as an existing Primary control;
  corrected to describe the actual mechanism (exact-string-equality, fail-closed).
  `docs/clinical/local-profile-charter-contract.md` §2.7 **C13** (pre-existing, landed in the P0-P3
  squash commit `e69d307`, predating this reopening) was already accurate and remains the canonical
  owner-held-gap record; items 15/15a cross-reference it. Verified against
  `scripts/lib/local-applicability.mjs` (lines 906-944, 1480-1487): only exact-string unit equality is
  enforced (`analyteUnit !== requestUnit`, `observation.unitCode !== mapping.unitCode`); no UCUM-syntax
  validation exists anywhere in the repo. No document now claims unit-code validation the code does not
  perform.

  **Correcting this register's own earlier claim:** the prior search-miss entry stated that a grep of
  `local-profile-charter-contract.md` found zero UCUM matches. That was incorrect — C13 was present in
  that file the whole time; the earlier pass searched it and still missed the match, a search error,
  not an absent record.

  **Process finding (orchestration, not implementation):** R7 was **missed in the first remediation
  dispatch** — it was listed for cross-reference in the register but never assigned as a fix to any
  agent — and was caught only by the cross-lane finding-ID reconciliation step that produced the
  "Repo-side landing locations" section above. This is a phase-owner orchestration error: R7 should
  have been dispatched alongside R3/R6/R8/R10/R11 in the same remediation pass and was not. It is
  recorded plainly, and not attributed to any subagent, because the same reconciliation step is the
  mechanism that would catch a recurrence of this class of error.
- **R8** (`DM-WORKFLOW-010` precondition dependency, not a sibling-scope gap) — landed as the new,
  required `finding.preconditionForHazardIds` array field (populated with all nine other hazard IDs on
  `DM-WORKFLOW-010`'s `finding`, empty elsewhere) plus updated `finding.description` framing in
  `docs/safety/hazard-control-matrix.json`, narrated in `docs/safety/hazard-control-matrix.md` §1d.
- **R10** (scenario-level `candidateBinding` inert for terminology-kind hazards) — **no repo-side fix
  landed, and none is needed.** This register's own R10 entry above already dispositions it as
  "note only... nothing to fix"; confirmed no `candidateBinding`-related change appears in the current
  `git diff` for any schema or matrix file. Recorded here only so the absence isn't mistaken for a
  missed cross-link.
- **R11** (`DM-HEME-002`'s unreferenced `labs.datStatus`) — **no field was added or changed**, matching
  this register's own R12-style "note only" framing. Landed as prose acknowledgment in
  `docs/safety/hazard-control-matrix.md` §1e ("No field was added or changed for this item").

**R2(b) blocked-release-state cross-check (task step 4):** `docs/safety/hazard-control-matrix.json`
row `DM-HEME-002.blockedReleaseStates` = `["credentialed_review_complete", "clinical_validation_complete",
"certified_for_defined_scope", "released", "activated"]`, `controlBinding.status: "control_bound"` —
i.e. one of the eight *implemented* hazards, not one of the two `no_control_exists` hazards. Per
`docs/safety/hazard-control-matrix.md` §4, only the two unimplemented hazards additionally block
`repository_ready`, `readiness_audit_complete`, and `qualifying_runtime_pilot`. This matches R2(b)'s
`Blocks` line above (same five states; explicit "does not block `repository_ready`,
`readiness_audit_complete`, or `qualifying_runtime_pilot`") exactly. **No discrepancy found** — the two
records agree.

### R2(b) [CRITICAL, hematology] — owner-held clinical decision: aplastic-crisis signature has no engine control

**Location:** `tests/fixtures/dangerous-miss/SYNTHETIC-DM-HEME-002.json` (hazard `DM-HEME-002`,
`hazardFamily: hemolysis_blood_loss_or_marrow_production_mismatch`); rule identifiers `HEM-001`/
`HEM-002`/`HEM-003` and `PARVO-001` in `modules/anemia/rules.json`; the corresponding fixture-scope
note in `.claude/progress/arc-clinical-council-adoption-v1/phase-4-completion.md` §"Deviations & Risks"
item 6 ("DM-HEME-002 covers only the missingness branch of its hazard family").

**What is true (verified 2026-07-19):** The shipped `DM-HEME-002` fixture exercises
`reticulocytes.response: "unknown"` — a conflicting/incomplete-evidence branch, correctly resolved to
abstention (HEM-003, `supported`, never `meets-defined-pattern`/`strongly-supported`). It does **not**
exercise `reticulocytes.response: "low"` combined with two-or-more positive hemolysis markers (high
indirect bilirubin / high LDH / low haptoglobin) — the aplastic-crisis signature associated with
parvovirus B19 infection superimposed on hereditary spherocytosis or sickle cell disease. `PARVO-001`,
`knownChronicHemolyticDisease`, and `recentViral` all appear in `modules/anemia/rules.json`, confirming
a rule path exists, but by the fixture's own account (progress-file item 6) that path is reached only
when `history.knownChronicHemolyticDisease` **and** `history.recentViral` are both already true in the
input. A first presentation of hemolytic disease, or a returning patient whose history was not
recaptured this encounter, has neither flag set and this branch does not fire.

**What is NOT known:** Whether the product should carry a history-independent safety net for this
specific lab-pattern (biochemical hemolysis markers positive + low retic response, irrespective of
`history.*`) is a clinical-content decision — what threshold, what alert severity, whether it
differentiates from other marrow-suppression causes, and whether it risks false-positive alert fatigue
in a pediatric population where transient reticulocytopenia has many causes. No finding here proposes
an answer.

**What authenticated evidence would satisfy it:** A signed clinical-content decision from the owner
role below, either (a) approving a specific history-independent rule/alert design with defined
threshold and severity, entered through the normal rules/candidates authoring path and re-verified by
`DM-HEME-002` or a sibling fixture, or (b) an explicit, signed decision that the current
history-gated design is clinically acceptable as scoped, with rationale.

**Owner role:** `pediatric-safety-owner` + credentialed pediatric-hematology reviewer. Not an
individual.

**Blocks:** `credentialed_review_complete`, `clinical_validation_complete`, `certified_for_defined_scope`,
`released`, `activated`. Does not block `repository_ready`, `readiness_audit_complete`, or
`qualifying_runtime_pilot` — those states describe implemented/executed repository behavior, not
clinical sufficiency, and the current fixture's own branch executes and passes correctly.

### R4 [HIGH, general pediatrics] — candidate hazard family DM-HISTORY-011 (catalog-scope gap, not a P4 authoring defect)

**Location:** all ten fixtures under `tests/fixtures/dangerous-miss/SYNTHETIC-DM-*.json`
(`patientInput.history` verified `{}` in every fixture that carries a `patientInput` block:
`DM-AGE-003`, `DM-CBC-001`, `DM-HEME-002`, `DM-IRON-006`, `DM-URGENT-004`); `historyNames` array in
`src/app.js` (33 named fields solicited by the product form, more than the "~18" cited when this
finding was assigned — line 55 onward); `rules.json` gates on many of them. Ages present across the
set: 2, 30, 48, 60, 96 months (verified) — no fixture patient exceeds 96 months (8 years).

**What is true:** No fixture exercises comorbidity, nutrition, growth, bleeding/menstrual, or social
context as the variable that changes expected engine behavior. No fixture patient is old enough for
`menstruating`/`heavyMenstrualBleeding` interplay to be exercised (all `menstruating: false`, none
above 96 months). This is catalog-scope carryover: the ten-family `DM-*` hazard catalog these fixtures
implement predates P4 (it originates in the earlier readiness-audit/validation-plan work) and never
named a comorbidity/history-context family. P4 authored one fixture per named family exactly as scoped
by AC P4.1 ("one fixture per family"); it did not omit a family the catalog already named.

**What is NOT known:** Whether a comorbidity/nutrition/growth/bleeding/social-context hazard family
belongs in the catalog at all, and if so its exact scope, name, and expected-behavior contract, is a
clinical-content authoring decision this plan reserves to credentialed reviewers plus the safety owner.
It is not inferable from the existing nine other families by pattern-matching.

**What authenticated evidence would satisfy it:** A signed decision from the owner role below either
defining the `DM-HISTORY-011` (or renamed) hazard family with its expected-behavior contract — through
the same authoring path P4-T1 used for the other ten — or explicitly declining to add it with recorded
clinical rationale.

**Owner role:** `pediatric-safety-owner` + credentialed general-pediatrics/hematology reviewers. Not an
individual.

**Blocked on task:** unscheduled, owner-held. Plan §4 P4-T4 scopes only "V4 silent-mode and V5
human-factors protocol-through-adjudication contracts, including alert lifecycle, override, downtime,
handoff, recovery, and equity" (owner: implementation/human-factors owners) — verified 2026-07-19
against `docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md`
§4. That is V4/V5 study-protocol work, not the hazard-family/catalog-scope decision this finding
concerns, and must not be read as covering it. No task ID in this plan defines "decide whether a new
hazard family belongs in the catalog"; the deferred/open-question table in §7 and the owner-held list
in §6 do not name one either. This entry therefore carries no task-ID pointer, correctly-scoped or
otherwise — the marker above is the explicit alternative.

**Routing-pointer note (added during final cleanup, this cycle):** this entry previously carried no
task-ID pointer at all. Separately, `docs/safety/hazard-control-matrix.json`'s `DM-HEME-002` row
(`PAC-P4T2-006`, **this register's R2(b) above, not R4**) cites `blockedOnTask` text naming P4-T4 for
its own clinical-content decision (whether the engine needs a history-independent aplastic-crisis
rule) — that is also mis-scoped against the same P4-T4 definition, for the same reason, and is a
different finding on a different surface being corrected separately by the agent who owns
`docs/safety/**`. Recorded here only so the two corrections are not conflated: R4's fix is the
"unscheduled, owner-held" marker added above; R2(b)/`PAC-P4T2-006`'s fix is on the matrix JSON, not in
this file.

**Blocks:** `credentialed_review_complete`, `clinical_validation_complete`, `certified_for_defined_scope`,
`released`, `activated` — as an unnamed gap in hazard coverage, it cannot be certified against by any
process that treats the ten-family catalog as complete. Does not block `repository_ready` or
`qualifying_runtime_pilot`, which certify only against the catalog as currently scoped.

### R5 [MED-HIGH, hematology] — gestational/corrected age unrepresentable on the product input surface

**Location:** `schemas/patient-input.schema.json` — `patient` object (verified: `ageMonths` is the
only age field; no `gestationalAge*`/`correctedAge*` property exists anywhere in the file, and
`additionalProperties: false` on `patient` means one cannot be added without a schema change).
Contrast: `schemas/reference-range.schema.json` — `$defs/gestationalAge` (lines ~319-345) and
`schemas/terminology-profile.schema.json` both carry gestational-age fields, but these are the
**local-profile/reference-range applicability schema**, not the CDSS request/product-input schema that
`src/app.js` and `assessPediatricAnemia` consume.

**Verification of the P3-scope claim (performed as instructed, read-only):** Confirmed as stated.
`.claude/progress/arc-clinical-council-adoption-v1/phase-3-progress.md` records "gestational age" as
fixed during P3-V1 remediation ("Two gaps were clinical rather than mechanical... Both fixed, along
with gestational age"). The actual fix landed in `schemas/reference-range.schema.json`'s
`gestationalAge` object (`correctedAgeRequired`, `gestationalAgeWeeksLow/High`, fail-closed
`CORRECTED_AGE_REQUIRED_NOT_SUPPLIED` per `docs/clinical/local-profile-charter-contract.md` §2.2b) —
this governs whether a **local reference-interval profile** applies, not whether the **product's own
patient-input surface** can capture or act on a patient's gestational age at birth. Searching the
codebase for `gestationalAgeAtBirthWeeks` (the request-side field named in the charter, table row 14f)
finds it only inside `tests/fixtures/local-profile/*.json` and
`tests/fixtures/dangerous-miss/SYNTHETIC-DM-LAB-005.json` — test fixtures, not a schema that
`src/app.js` reads from or writes to. **P3 closed the local-profile side of this gap and did not
address the product-input side**; the phase-3-progress.md prose does not distinguish the two, which is
why this reads as fully addressed on a shallow read.

**What is true:** A former 30-weeker at 8 months chronological age is, on the current product input
surface, indistinguishable from a full-term 8-month-old born at 40 weeks. `ageMonths` is chronological
only. There is no field through which corrected age, or gestational age at birth, reaches
`assessPediatricAnemia`. If a local reference-range profile with `correctedAgeRequired: true` is ever
wired to this product's evaluation path, it would have no request-side field to read — the more
dangerous of the two failure modes (silent collapse to the wrong interval, not visible abstention),
per this finding's own framing.

**What is NOT known:** Whether closing this gap belongs in the product input schema (add a
`gestationalAgeWeeks`/`correctedAgeMonths` field plus an abstention floor when required-but-missing) or
should instead be an explicit, machine-checkable out-of-scope declaration in the release-dependency
manifest (i.e., the product declares itself inapplicable to any patient requiring corrected-age
evaluation until a future phase). This is a scope decision, not a mechanical fix — deciding it
unilaterally is exactly what this finding is recorded to prevent.

**What authenticated evidence would satisfy it:** A signed scope decision from the owner role below
selecting one of the two options above (or a third option this register does not anticipate), with
rationale, entered through the normal plan-owner path.

**Owner role:** `clinical-informatics-owner` (schema/scope-surface decision) + `pediatric-safety-owner`
(clinical-risk sign-off on whichever option is chosen). Not an individual.

**Blocks:** `credentialed_review_complete`, `clinical_validation_complete`, `certified_for_defined_scope`,
`released`, `activated`.

### R9 — proposed OQ-7 (informatics; coordinator to confirm into plan §7)

No CDS Hooks (or equivalent) integration crosswalk exists anywhere in this repository or ARC for the
internal alert/severity taxonomy (`dangerous-miss-scenario.schema.json` `expectedBehavior`/
`expectedAlerts`, `docs/safety/hazard-control-matrix.json` severities), and it is not tracked as an
open question in plan §7 — the exact gap OQ-1..OQ-6 exist to force explicit before it is assumed away
by implication. This finding **proposes** the row below for the coordinator to confirm into the plan;
this document does not edit §7 itself.

**Proposed OQ-7 row (verbatim, matching §7's table format):**

| ID | Question | Phase | Disposition |
|---|---|---|---|
| OQ-7 | Which CDS Hooks (or equivalent) integration crosswalk maps the internal alert/severity taxonomy (dangerous-miss scenario `expectedBehavior`/`expectedAlerts`, hazard-control-matrix severities) to a consuming EHR's decision-support hook contract? | P4/P6 | Owner-held; no crosswalk exists and none is scheduled by any phase of this plan. Blocks any live-EHR/CDS-Hooks integration claim; does not block repository-only or synthetic-pilot release states. |

**Owner role:** program owner to confirm the row into the plan; `clinical-governance-owner` for the
underlying crosswalk decision if and when integration is pursued.

### R10 [LOW, informatics] — scenario-level candidateBinding is present-but-inert for terminology-kind hazards

**Location:** `schemas/dangerous-miss-scenario.schema.json` `$defs/candidateBinding` (top-level,
required on every scenario) records `knowledgeBaseVersion`/`rulesFileDigest`/`candidatesFileDigest`/
`moduleFileDigest` — bindings for the anemia rules engine. For hazard kind
`local-applicability-terminology` (`input.kind: terminologyObservation`), the load-bearing binding is
instead the **observation-level** `candidateDigest` inside the assertion object defined in
`schemas/reference-range.schema.json` (lines ~117-134) and `schemas/terminology-profile.schema.json`
(line ~99-103) — a separate `sha256:` digest scoped to the specific candidate an observation asserts
against. The scenario-level `candidateBinding` is schema-required and populated on every fixture, but
for terminology-kind scenarios it binds the wrong artifact family to answer "does this scenario apply
to the current candidate" — that question is answered by the observation-level digest instead.

**Note only** — not a defect requiring a fix decision at this time; no fixture currently relies on the
scenario-level binding to gate a terminology-kind hazard's applicability, so nothing is silently
wrong today. Recorded so a future author does not assume scenario-level `candidateBinding` is the
terminology-hazard integrity check.

**Owner role:** none required to close. If a future change makes scenario-level `candidateBinding`
load-bearing for terminology hazards, `pediatric-safety-owner` should confirm the digest scope is
correct before it ships.

**Blocks:** nothing at present.

### R12 [ABSTENTION, general pediatrics] — DM-AGE-003 severity tier is a clinical-judgment call, not a mechanical one

**Location:** `tests/fixtures/dangerous-miss/SYNTHETIC-DM-AGE-003.json` — `expectedBehavior` expects
`SCOPE-001`/`SCOPE-003` at severity `important` for a 2-month-old age-scope exit
(`patient.ageMonths: 2`, below the product's stated 6-24-month scope floor).

**What is true:** The fixture is internally consistent and passes its own test as authored — `important`
is what the current expected-behavior contract asserts and what the engine returns.

**What is NOT known:** Whether `important` is the clinically correct severity tier for this scope-exit
case, versus `urgent` (or another tier), is credentialed clinical judgment about how forcefully a
2-month-old outside the tool's validated age range should be flagged to a clinician. This register
takes no position and changes nothing about the fixture.

**Owner role:** `pediatric-safety-owner` + credentialed general-pediatrics reviewer. Not an individual.

**Blocks:** `credentialed_review_complete`, `clinical_validation_complete`, `certified_for_defined_scope`
— pending confirmation that the authored severity is clinically correct, not merely internally
consistent. Does not block `repository_ready` or `qualifying_runtime_pilot`.

### R13 [MEDIUM, general pediatrics] — DM-URGENT-004/DM-CBC-001 test alert-dominance for an already-overt emergency, not detection of a non-obvious presentation (general-pediatrics F4; recovered late)

**Location:** `tests/fixtures/dangerous-miss/SYNTHETIC-DM-URGENT-004.json` (`hazardId: DM-URGENT-004`,
`hazardFamily: severe_or_unstable_presentation`, `input.patientInput.symptoms.hemodynamicInstability:
true`) and `tests/fixtures/dangerous-miss/SYNTHETIC-DM-CBC-001.json` (`hazardId: DM-CBC-001`,
`hazardFamily: cross_lineage_cbc_abnormality`, `input.patientInput.smear: ["blasts", "teardrops"]`
already present on input). Both fixtures declare `expectedBehavior.type: "alert_dominance"`.

**What is true (verified 2026-07-19, direct read of both fixture files):** Both fixtures assert an
emergency signal — hemodynamic instability for DM-URGENT-004, blasts already on the reported smear for
DM-CBC-001 — as a value present in the fixture's own input at the moment it is evaluated. Both
fixtures' `requiredSignal`/`forbiddenSignals` test only that the engine's alert ranking does not bury
an already-overt emergency beneath ordinary differential content (DM-URGENT-004's forbidden signal:
"...producing zero alerts"; DM-CBC-001's: "...whose top entry is an isolated single-lineage diagnosis
... rather than marrow-failure-infiltration"). That is a real safety property — alert-dominance-over-
ranking for a presentation that is already overt — and both fixtures test exactly that, correctly.

**What is NOT known / NOT tested:** Neither of these two fixtures, nor any other fixture in the
ten-family catalog, tests whether the engine surfaces an emergency-severity presentation when the
initiating signal has **not yet** declared itself as a flagged input field — i.e., detection of an
initially non-obvious presentation, where recognizing the danger would depend on the engine (or a
reading clinician) inferring it from a subtler combination of values rather than an already-set
instability/blasts flag. A reader who takes "dangerous miss" in these two hazard families' names to
mean coverage of non-obvious-presentation detection will not find that coverage here; what exists is
alert-ranking discipline once the emergency has already declared itself in the input.

**What authenticated evidence would satisfy it:** A signed decision from the owner role below on
whether a non-obvious-presentation fixture belongs in this catalog for either or both hazard families
and, if so, what specific presentation and expected-behavior contract it should assert — through the
same authoring path P4-T1 used for the existing ten. This register defines no subtle-presentation
fixture, proposes no rule logic, and takes no position on what a non-obvious presentation would be;
that is clinical-content authority it does not hold.

**Owner role:** `pediatric-safety-owner` + credentialed general-pediatrics reviewer. Not an individual.

**Blocks:** `credentialed_review_complete`, `clinical_validation_complete`, `certified_for_defined_scope`
— as an unverified claim about what class of "dangerous miss" these two named hazard families cover,
it cannot be certified against by any process that reads their names as implying non-obvious-
presentation detection. Does not block `repository_ready` or `qualifying_runtime_pilot`, which certify
only against what the fixtures actually assert (alert-dominance-over-ranking), not against a broader
reading of the hazard family name.

**Process finding (orchestration, not implementation):** general-pediatrics-reviewer raised this as its
own F4 in the same P4-V1 reopening pass that produced R4 and R12 (also general-pediatrics-reviewer,
per the Register table above) — but, unlike every other finding that lens raised, F4 was never carried
into this register's R-numbering, never assigned to any agent as a fix, never recorded anywhere, and is
absent from the register entirely until this entry. It surfaced only during this final cleanup pass. It
is the **third** finding this cycle to fall out of cross-referencing discipline, after **R7** (listed
for cross-reference but never dispatched as a fix — see the R7 process note earlier in this document)
and the **destroyed-uncommitted-file incident** recorded in the phase-4 completion note's "Two process
failures in this cycle, both mine" section. The routing gap that dropped F4 was the phase-owner's, not
any subagent's, exactly as the phase owner recorded for R7 and the destroyed file.

## P5-V1 — qualifying-pilot phase findings (pilot BLOCKED on owner action; reviewed findings carried below)

P5-V1 itself was **not satisfied** — the qualifying pilot never executed. Full narrative:
`.claude/progress/arc-clinical-council-adoption-v1/phase-5-completion.md`. Three review cycles ran
against the committed pilot skeleton instead: `task-completion-validator` (FIX-REQUIRED → PASS →
FIX-REQUIRED, 3 items) and `pediatric-clinical-adjudicator` (FAIL, 1 CRITICAL/3 HIGH → FAIL, 3 HIGH/3
MED/5 LOW → PASS-WITH-FINDINGS, 1 HIGH residual). The other eight named AC P5.1 lenses
(`pediatric-hematology-reviewer`, `pediatric-laboratory-medicine-reviewer`,
`general-pediatrics-reviewer`, `clinical-informatics-interoperability-reviewer`,
`diagnostic-accuracy-methods-reviewer`, `prediction-implementation-evaluation-reviewer`,
`pediatric-safety-human-factors-reviewer`, `pediatric-equity-patient-family-reviewer`,
`evidence-quality-scribe`, `correctness-reviewer`) did not run — no seat has assessed any of the ten
hazard families for this candidate. Fix cycle 4 (below) is applied and committed at ARC `afe3b98`; it
corrects the skeleton's own labels and does not, and cannot, close the phase, which remains blocked on
two independent owner-held gates (SDK credential; evidence-rights receipt plus trust anchor) — see
`03-arc-clinical-council-handoff.md` "Current pilot disposition" for the full gate description.

| # | Severity | Finding | Owner role | Status |
|---|---|---|---|---|
| RR-1 | HIGH — FIXED (ARC `afe3b98`) | `dangerous_miss_review.families[subgroup_or_access_failure]` asserted `not_applicable` with empty `finding_refs` while PED `DM-EQUITY-009` is `no_control_exists` with open HIGH `PAC-P4T2-001`. Now corrected to `not_covered` with the finding reference, mirroring the five already-corrected families | `equity-and-family-governance-owner` | Artifact label fixed; the hazard itself stays wholly unmitigated and owner-held |
| C1 | MEDIUM — FIXED (ARC `afe3b98`) | `adjudication_record.yaml` `decided_at_disclosure` rewritten to state the schema truth (`decided_at` is bare `{"type":"string"}`; emptiness is not schema-enforced) | `arc-runtime-owner` | Fixed |
| C2 | LOW — FIXED (ARC `afe3b98`) | `data_boundary_scan_adjudication.md` corrected to "19 files carry `possible_full_text`" (one also carries `patient_name_context`); an anchor was added so the 18 existing allowlist links stay resolvable | `arc-runtime-owner` | Fixed |
| C3 | LOW — FIXED (ARC `afe3b98`) | `data_boundary_scan_allowlist.yaml` `metadata.fix_cycle` bumped `1 → 4`; the two self-scan `expected_sha256` entries for the edited adjudication file refreshed so the scan stays `all_clean` | `arc-runtime-owner` | Fixed |
| RR-2 | MEDIUM | `not_covered` now carries materially different states in one array (unassessed / not-reachable-in-product ×3 / open-critical-coverage-finding / no-control-exists) | `arc-schema-owner` | Open |
| RR-4 | LOW | `local_approvals_required`'s causal claim that alert-dominance depends on derived `localFlags` is unhedged; PED's cited test exercises a different path | `arc-runtime-owner` | Open |
| RF-1 | — | `council_recommendation` enum has no "never executed" value; `abstained` is used as a proxy | `arc-schema-owner` | Open |
| RF-2 | — | `dangerousMissFamily.status` enum has no `not_assessed`, so a skeleton must assert something untrue | `arc-schema-owner` | Open |
| RF-3 | — | `DM-CBC-001` is an n=1 sample from the best-case stratum (the cleanest matrix row, and within it the most overt clinical picture). Latent now; live the moment P5-T2 executes | `pediatric-safety-owner` | Open (latent) |
| RF-4 | — | `unresolved_critical_count` cannot express "unknown"; artifact-vs-knowledge-base scope undefined. Value `4` kept as a fail-closed floor | `arc-schema-owner` | Open |
| RF-5 | — | `dissentRecord.reviewer_roles` `minItems: 2` forces a second name with no way to mark it unheld | `arc-schema-owner` | Open |
| RF-6 | — | Synthetic seat identity and human approval authority share one unnamespaced string space. CRITICAL-vs-HIGH severity disagreement preserved | `clinical-governance-owner` | Open |
| RF-7 | — | SkillBOM `reviewer.skills` overloaded to encode voting/non-voting seat class | `arc-schema-owner` | Open |
| DIS-1 | open | `blocked` vs `human_review_pending` unresolved; only the adjudicator lens holds a position | `clinical-governance-owner` / `pediatric-safety-owner` | Open — dissent preserved, not adjudicated away |

### Cross-repo and pre-existing items disclosed by P5 (owner-held, not P5 defects)

- **`_RESERVED_AUTHORITY_STATE_TOKENS` cross-repo defect (recurs at P5-T4/P6/P7 — fix once).** This
  plan's §5 mandates the literal `not_executed_owner_held`; ARC's `arc_cli/__main__.py`
  `_RESERVED_AUTHORITY_STATE_TOKENS` (line ~1150) hard-errors (exit 2) on that exact token anywhere
  under `metadata.*` outside `authority_attachments`/`local_profiles`, so the literal is unwritable in
  a run manifest's free-form metadata. Currently handled by disclosed synonym substitution; the plan
  literal is still used verbatim in the two artifacts `arc validate` does not govern. Owner:
  `arc-schema-owner` / `arc-runtime-owner`.
- **Pre-existing ARC RED, out of P5 (and P6, P7) scope.**
  `tests/test_local_profiles.py::DispatchAndCertificationGates::test_certification_acceptance_passes_the_gate_when_verified`
  fails at ARC HEAD, confirmed the *only* pytest failure through Phase 6 (`e42f6a6`; 1142 passed / 1
  failed). Root-caused as a wall-clock time-bomb: fixture `NOW = 2026-07-19`, a 24-hour snapshot
  max-age, and `custom_outputs.py:1334` omitting `now=`. Inherited from P1-P3 (`80bb663`); do not
  attribute to P5, P6, or P7, and do not fix it as part of this program's closeout. Owner: ARC
  certification / local-profile owner (P3-scoped).
- **Out-of-repo mutation, disclosed:** `~/.config/arc/approved-roots.yaml` was rewritten via
  `arc roots add --force` during P5-T1. Disclosed in `pilot_input_manifest.yaml`; not reverted. Owner:
  `arc-runtime-owner` (operator-local config, informational only).

## P6-V1 — governed Portal authoring + MeatyWiki metadata adapter (verdict: PASS, 4 lenses)

All four AC P6.1 reviewer lenses PASSed on the reviewed tree (ARC base `afe3b98`, web tree advanced by
the UXW-P6-01 fix and re-validated post-fix). Full narrative:
`.claude/progress/arc-clinical-council-adoption-v1/phase-6-completion.md`.

| Lens | Verdict | Notes |
|---|---|---|
| `task-completion-validator` | PASS | `uv run pytest` 1142 passed / 1 failed (the pre-existing time-bomb above, confirmed the only failure); `arc validate .` PASS; `uv build` PASS; `git diff --check` clean; web typecheck + test (280→283 post-fix) + build PASS; `git diff` on `schemas/`/`councils/`/`knowledge-packs/` EMPTY (no source/safety-policy mutation) |
| `security-identity-reviewer` | PASS | all 5 invariants hold: disabled-by-default, metadata-only strict allowlist, fail-closed no-echo, no authority forgery via `app.py`, adapter inert/unwired |
| `mcp-tool-governance-reviewer` | PASS | injection resilience, source-rights enforcement, permission scope, auditability; no negative test merely names a class without asserting the boundary |
| `ux-workflow-reviewer` | PASS (after fix cycle 1) | raised UXW-P6-01 (MEDIUM); re-reviewed after fix → PASS, closed |

### UXW-P6-01 [MEDIUM] — FIXED and CLOSED

Review-step "Create review" CTA stayed enabled while the preview showed "(blocks this run)." Fixed: the
CTA is now gated on affirmative `previewData.ok === false` (no over-block on null/pending state) plus
an inline hint. Re-reviewed by `ux-workflow-reviewer` → PASS, closed. Owner:
`portal-integration-engineer` (fix landed at Phase 6; no further action).

### Non-blocking follow-ups (reviewers PASSed with these open — not findings that block AC P6.1)

| ID | Severity | Finding | Owner role |
|---|---|---|---|
| tool-governance F1 | low/info | `_assert_no_echo` docstring overclaims (checks `str(exc)` + `str(__cause__)`, not `repr`/`__context__`) — doc drift, no real coverage hole | `arc-runtime-owner` |
| tool-governance F2 | low | Add one nested arbitrary-extra-key injection test; defense already exists via schema `additionalProperties:false`, just not directly asserted | `arc-runtime-owner` |
| tool-governance F3 / security OBS-2 | low | `fetch_source_metadata` doesn't cross-check returned `source_id` vs requested; the per-vault `base_url` in the allowlist is parsed but not consumed — bounded, no SSRF | `arc-runtime-owner` |
| security OBS-1 | low | HTTP-supplied `authority_attachments`/`local_profiles` admission accepts absolute out-of-repo paths (schema-valid-record + symlink/registry-rejected + offline verify) — PRE-EXISTING since ADR-0005/0006, not introduced by P6; consider repo-root-constraining as defense-in-depth | `arc-runtime-owner` |
| UXW-P6-02 | low | Manifest digest byte-exactness caution copy could be clearer | `portal-integration-engineer` |
| UXW-P6-03 | low | Disclaimer over-disclaims on non-clinical previews | `portal-integration-engineer` |
| UXW-P6-04 | low | Round-trip "Exact match" relies on a sibling disclaimer rather than standing alone | `portal-integration-engineer` |
| `derive.ts` type-contract drift | info (defensive fix landed) | Live API returns structured `council.gates` objects but the TS type said `string[]`, crashing (`g.trim is not a function`) whenever the pediatric council was selected — fixed defensively in `web/src/lib/arcade/derive.ts`; flagged as real API/type-contract drift needing a proper backend/type fix | `portal-integration-engineer` (web fix) / `arc-schema-owner` (contract fix) |
| `notes` RunSpec field | info | No persistence path in `core.create_run` at all — not a forwarding gap, no parameter exists. Needs a design decision on where it lands | `arc-schema-owner` |

### Evidence-source-manifest editor is download-only (accepted, not a gap)

Both the UI and backend specialists independently concluded a write endpoint (`PUT`) for the
evidence-source manifest would be a materially larger trust boundary than any existing `PUT` precedent
(arbitrary caller-chosen repo path vs. fixed council/role directories). Accepted as satisfying "raw
YAML stays the authoritative fallback": the form serializes byte-exact YAML plus SHA-256 for the
operator to commit. No owner action required unless a future write path is explicitly requested.

### Pre-existing ARC RED, confirmed again at Phase 6 (owner-held, not a P6 regression)

`tests/test_local_profiles.py::DispatchAndCertificationGates::test_certification_acceptance_passes_the_gate_when_verified`
fails at ARC HEAD — the P1-P3 wall-clock time-bomb (same finding as recorded under P5-V1 above).
Confirmed by the Phase 6 validator as the ONLY pytest failure (1142 passed / 1 failed). Owner: ARC
certification / local-profile owner (P3-scoped).
