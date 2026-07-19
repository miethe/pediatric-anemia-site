---
title: "ARC pediatric clinical council handoff"
description: "Project-facing operating contract for evidence-bound, authority-limited pediatric CDS council reviews."
audience: [project-agents, clinical-governance, evidence-governance, platform-engineering, validation]
tags: [pediatric-cds, arc, clinical-safety, evidence-governance, council-review]
created: 2026-07-19
updated: 2026-07-19
status: repository-ready-with-owner-held-gates
---

# ARC pediatric clinical council handoff

## Read this first

The Agent Review Council (ARC) repository now contains a reusable pediatric clinical evidence-review council and a completed readiness audit of this program. The council is an evidence-first review and validation-planning mechanism for **non-patient artifacts**. It can identify hazards, dissent, applicability limits, abstentions, release blockers, and required validation. It cannot diagnose, prescribe, establish medical validity, replace credentialed reviewers, or authorize a clinical release.

Two implementation states are pinned for this handoff:

| Component | Pinned commit | What the pin establishes |
|---|---|---|
| ARC / `agentic-research` | [`72ab6f69bcfd31f5221ff598f4649b21e2f0e06a`](https://github.com/miethe/agentic-research/commit/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a) | Council definition, roles, evidence-manifest contract, clinical output schemas, policy enforcement, examples, tests, and the completed readiness-audit bundle. |
| AOS / `agentic_meta_dev` | `99d7ee03d2a8c8e584115cf44106b195c3222210` (local `main`; not yet on `origin/main`) | `op council` preserves identifier-only AOS run/session/turn/feature/trace correlation when dispatching ARC. It does not add clinical authority or carry clinical content. Publish or otherwise make this exact commit available before a remote consumer relies on it. |

Repository-ready means the review infrastructure at those commits is implemented and validated. It does **not** mean this pediatric CDS is clinically validated or releasable.

## Pinned baseline

Everything a project agent needs to identify the exact reviewable baseline, in repo-relative /
`repo:<name>/...` form — no absolute runtime path required:

| Field | Value |
|---|---|
| ARC commit (full) | `repo:agentic-research@72ab6f69bcfd31f5221ff598f4649b21e2f0e06a` |
| AOS commit (full) | `repo:agentic_meta_dev@99d7ee03d2a8c8e584115cf44106b195c3222210` — **local `main`; not on `origin/main`** as of 2026-07-19. Treat any remote consumer's reliance on this commit as `unresolved` until it is published. |
| Council name + version | `pediatric-anemia-clinical-review-council@0.1.0` — `repo:agentic-research/councils/pediatric-anemia-clinical-review-council.yaml` (`metadata.version: 0.1.0`) |
| Evidence manifest | `repo:agentic-research/knowledge-packs/pediatric-anemia/source-manifest.yaml` — id `pediatric-anemia-evidence-sources@0.1.0`, 15 sources |
| Evidence manifest SHA-256 | `f4c33c82fe4977a7d4db2633ab04d82b39bb7bf421d048aba5a5b37a51b711f6` (recomputed and confirmed against the pinned ARC commit during P0 reconciliation, 2026-07-19) |
| Project target policy | Council `parameters.target_artifact_class` accepts **only** `repository_artifact` and `synthetic_scenario_specification`. `unclassified` (the schema default) and `clinical_record_body` are rejected at preview, creation, validation, and execution — `repo:agentic-research/councils/pediatric-anemia-clinical-review-council.yaml` (`spec.runConfig.parameters`). |
| Canonical run location | `repo:agentic-research/runs/<date>-<slug>/` — ARC run records always live in the `agentic-research` checkout, even when the bounded target is a file in this repository. There is no canonical run location inside this repo. |
| Pediatric repo commit at pin time | `repo:pediatric-anemia-site@4241cbbf8342175fa4e8d491e6849d9d82bcb78e` |

Re-verify the ARC/AOS SHAs and the manifest digest before relying on this table — `git rev-parse HEAD`
in each checkout and `shasum -a 256` on the manifest path above (see "Evidence-manifest and digest
contract" for the exact commands).

### Checkout variables used by every command below

Every shell block in this document is written against two variables so that no
absolute machine-local path appears in this handoff or in any command copied out
of it. Define them once per shell, pointing at your own checkouts:

```bash
export ARC_REPO="${ARC_REPO:?path to your agentic-research checkout}"
export PEDIATRIC_REPO="${PEDIATRIC_REPO:?path to your pediatric-anemia-site checkout}"
```

Both are operator-local shell configuration on your own machine — the same
category as the ARC approved-roots registry. They are never committed, never
placed in a RunSpec, and never carried in AOS correlation.

## Delivery-state vocabulary

Use these states separately in plans, trackers, PRs, and reports:

| State | Meaning | Current status |
|---|---|---|
| **Repository-ready** | ARC council, roles, schemas, policies, tests, and AOS correlation bridge are implemented at the pinned commits. | Yes, for the pinned ARC/AOS scope. |
| **Readiness-audit complete** | A schema-valid synthetic council review exists and its findings, dissent, abstentions, and validation work are recorded. | Yes, but it is explicitly non-qualifying. |
| **Qualifying runtime pilot** | The exact target is runtime-resolvable, the prohibited-input scan is clean, provider/rights policy is satisfied, reviewers actually execute through the qualifying path, and outputs validate. | No. |
| **Credentialed review** | Named, appropriately credentialed and independent humans approve the exact candidate digest within their authority. | `not_executed_owner_held`. |
| **Clinical validation** | Applicable technical, retrospective, silent-mode, human-factors, and later validation protocols are executed and adjudicated. | `not_executed`. |
| **Release** | All applicable evidence, clinical, laboratory, technical, privacy/security, legal/regulatory, identity/signature, and validation gates pass for the exact release digest. | Blocked. |

Passing `arc validate`, repository tests, or an ARC recommendation never promotes an artifact across the later states automatically.

## What to review, and when

Use `pediatric-anemia-clinical-review-council@0.1.0` before acting on a material pediatric clinician-facing CDS artifact, especially:

- evidence or claim packages and evidence-to-claim projections;
- intended-use, population, exclusions, scope-exit, or abstention contracts;
- deterministic rule, threshold, candidate-pattern, or alert specifications;
- claim-to-rule-to-test traces and dangerous-miss scenario specifications;
- laboratory profile, unit, specimen, analyzer/method, reference-interval, or critical-value contracts;
- FHIR, terminology, provenance, result-status, time, workflow, and failure-behavior mappings;
- retrospective, silent-mode, human-factors, or implementation-study protocols;
- clinical content change sets, KB candidates, release manifests, rollback plans, and surveillance/change-impact packages.

Run it before implementation for safety-critical designs, again against the exact implementation candidate before human approval, and again after any material target, evidence-manifest, council, policy, or reviewer change. An approval or audit attached to an older digest is stale.

Allowed target classes in v1 are:

1. `repository_artifact` — an exact versioned repository file or tree containing no patient record; or
2. `synthetic_scenario_specification` — a non-PHI specification of a scenario and its expected safety behavior.

Set `parameters.non_patient_artifact_confirmed: true` and choose one of those classes explicitly. `unclassified`, `clinical_record_body`, patient records, and synthetic clinical record bodies are rejected. Clinical fixture bodies require a future owner-held deidentification-attestation adapter and are not executable through the v1 SDK path.

Do **not** put any of the following in a RunSpec, target bundle, prompt, evidence pack, run artifact, AOS correlation field, or provider payload:

- PHI, regulated personal data, patient-specific records, or direct-care requests;
- production secrets, credentials, customer-confidential data, or access tokens;
- full copyrighted source text, figures, tables, or paywalled standards text;
- raw MeatyWiki bodies or unrestricted knowledge-vault exports;
- treatment, dosing, transfusion, or autonomous diagnostic instructions;
- absolute machine-local paths in the runtime input set for a qualifying pilot.

Use metadata, canonical identifiers, exact locators, scoped paraphrases, repository-relative locators, and synthetic scenario specifications instead.

## Council seats and authority boundaries

The council runs independent specialist passes, then separate adjudication. Eight seats vote; evidence coordination and adjudication do not.

| Seat | Vote | Review authority | Explicit boundary |
|---|---:|---|---|
| Pediatric Hematology | Yes | Clinical scope, developmental applicability, alternative explanations, dangerous misses, specialty escalation. | Synthetic review is not credentialed hematology sign-off and does not authorize a patient-affecting conclusion. |
| Pediatric Laboratory Medicine | Yes | Specimen, analyzer/method, units, local intervals, critical values, and portability. | Published evidence cannot substitute for a local laboratory director's approval. |
| General Pediatrics | Yes | Whole-child context, primary-care workflow, follow-up feasibility, communication, safe escalation. | Does not issue diagnosis, treatment, or release approval. |
| Clinical Informatics and Interoperability | Yes | FHIR, terminology, provenance, status, time, missingness, mappings, and integration failures. | Standards conformance does not establish clinical validity, privacy readiness, or local mapping approval. |
| Diagnostic-Accuracy Methods | Yes | Intended use, reference standards, bias, thresholds, indeterminate results, estimands, and applicability. | Does not substitute for an approved protocol, dataset, analysis, or biostatistical adjudication. |
| Prediction and Implementation Evaluation | Yes | Reporting, bias, dataset shift, calibration, subgroup performance, human-system interaction, and monitoring. | Does not claim executed retrospective, silent-mode, human-factors, or interventional validation. |
| Patient Safety and Human Factors | Yes | Hazard analysis, dangerous misses, alert burden, fail-safe behavior, override, downtime, recovery, usability, and escalation. | Authored hazards are not executed safety evidence. |
| Equity and Patient-Family Impact | Yes | Subgroup harm, proxies, access-mediated missingness, accessibility, communication burden, caregiver/adolescent participation. | Synthetic review does not replace owner-approved patient/family or community participation. |
| Evidence Quality Input | No | Source locators, rights, status, corrections, freshness, lineage, and manifest quality. | Cannot upgrade evidence strength, clinical authority, or source rights. |
| Pediatric Clinical Adjudicator and Validation Planner | No | Merge duplicates, preserve dissent and abstentions, calibrate findings, and define validation. | Cannot erase critical dissent, cast a clinical vote, self-approve, or authorize release. |

ARC's collective authority stops at evidence-linked decision support and validation planning. Named human approvers remain responsible for their licensed, organizational, legal, regulatory, laboratory, security/privacy, and release authorities.

## Evidence-manifest and digest contract

Every clinical council run must bind a schema-valid metadata-only `EvidenceSourceManifest` by both repository-relative path and SHA-256. At the pinned ARC commit, the canonical pediatric manifest is:

- path: `knowledge-packs/pediatric-anemia/source-manifest.yaml`
- manifest ID/version: `pediatric-anemia-evidence-sources@0.1.0`
- source count: 15
- SHA-256: `f4c33c82fe4977a7d4db2633ab04d82b39bb7bf421d048aba5a5b37a51b711f6`

Each source record carries a stable source ID, canonical identifier, version, retrieval/update state, retraction state, evidence class, population/setting/specimen/method/unit/intended-user applicability, freshness, sensitivity, license/attribution/usage constraints, storage/upload policy, exact locator, and optional AOS artifact IDs. Source bodies and excerpts do not belong in the manifest.

Before every run:

```bash
cd "$ARC_REPO"
test "$(git rev-parse HEAD)" = "72ab6f69bcfd31f5221ff598f4649b21e2f0e06a"
shasum -a 256 knowledge-packs/pediatric-anemia/source-manifest.yaml
uv run arc run --spec examples/pediatric-clinical-council/run-spec.yaml --dry-run
```

The computed digest must equal the RunSpec's `evidence_source_manifest_sha256`. If the manifest changes, review the change, recompute the digest, update the RunSpec, and treat all prior reviews as evidence-bound to the old manifest. A matching digest proves integrity only; it does not prove currency, applicability, licensing permission, or clinical authority.

## Exact scaffold → populate → validate → read-verdict workflow

ARC has no single CLI verb that performs the full review. Run records live in `agentic-research/runs/`, even when the bounded target is in this repository.

### 1. Scaffold

Start from the pinned ARC checkout. Author a RunSpec based on the canonical example, using the exact council name, constraints, manifest path/digest, a repository-relative or registered target locator, and explicit target-class parameters. Preview first, then create the empty skeleton:

```yaml
apiVersion: arc/v1alpha1
kind: CouncilRunSpec
council: pediatric-anemia-clinical-review-council
target: <registered-repository-relative-non-patient-target>
objective: Review the exact pediatric clinician-facing CDS artifact for evidence support, applicability, dangerous misses, safe abstention, dissent, and required human validation.
constraints:
  - read_only
  - decision_support_only
  - no_patient_specific_advice
  - no_phi_or_copyrighted_full_text
  - metadata_only_evidence
  - credentialed_clinician_approval_required
evidence_source_manifest: knowledge-packs/pediatric-anemia/source-manifest.yaml
evidence_source_manifest_sha256: f4c33c82fe4977a7d4db2633ab04d82b39bb7bf421d048aba5a5b37a51b711f6
parameters:
  non_patient_artifact_confirmed: true
  target_artifact_class: repository_artifact
slug: <date-independent-short-slug>
```

```bash
cd "$ARC_REPO"

uv run arc run --spec path/to/reviewed-run-spec.yaml --dry-run
uv run arc run --spec path/to/reviewed-run-spec.yaml
```

`--spec` is resolved relative to the ARC repository root. To dispatch a RunSpec
that lives in this repository without changing directory, run `arc` against the
ARC project while staying in the pediatric checkout — `--project` keeps your
working directory, unlike `--directory`:

```bash
cd "$PEDIATRIC_REPO"
uv run --project "$ARC_REPO" arc run \
  --spec examples/arc-runspecs/local-profile-charter-repository-artifact.runspec.yaml --dry-run
```

`arc run` only creates an empty run skeleton. Its initial `scorecard.json` is a placeholder; no reviewer has run yet.

### 2. Populate

Give the exact run directory to an agent using the `council-review` skill. The agent must write into the existing skeleton and preserve read-only target handling, independent passes, dissent, abstentions, and evidence locators.

Copy-paste preamble:

```text
Use the council-review skill to populate the existing ARC run skeleton.
Council: pediatric-anemia-clinical-review-council@0.1.0
Target: <exact registered non-patient repository artifact or synthetic scenario specification>
Target digest/tree: <sha256 or git tree>
Run directory: runs/<date>-<slug>/
Objective: Review the exact pediatric clinician-facing CDS artifact for evidence support, applicability, dangerous misses, safe abstention, dissent, and required owner-held validation.
Constraints: read_only; decision_support_only; no_patient_specific_advice; no_phi_or_copyrighted_full_text; metadata_only_evidence; credentialed_clinician_approval_required.
Evidence manifest: knowledge-packs/pediatric-anemia/source-manifest.yaml
Evidence manifest SHA-256: f4c33c82fe4977a7d4db2633ab04d82b39bb7bf421d048aba5a5b37a51b711f6
Required behavior: run independent seat reviews, adjudicate separately, preserve accepted/rejected/disputed/watchlist/abstained/out-of-scope states, populate every required artifact, and do not claim credentialed review, clinical validation, or release.
```

### 3. Validate

```bash
cd "$ARC_REPO"
uv run arc validate runs/<date>-<slug> --json
```

Exit `0` is clean, `1` is warnings-only, and `2` means errors. Validation proves schema and structural integrity; it does not contain or endorse the verdict.

### 4. Read the real verdict

```bash
jq '{recommendation, scores, summary}' runs/<date>-<slug>/scorecard.json
```

Read accepted/rejected/disputed/watchlist findings from `findings.yaml`, abstentions and release status from `pediatric_clinical_review.json`, and required work from `validation_plan.md` and `decision_record.md`. Treat the scorecard as a non-result if `scores` is empty and its summary says the run skeleton was created but review was not executed. `pause_and_validate` can be either a real verdict or the placeholder, so the liveness check is mandatory.

## Reproduce the dry run end to end

This is the full path from a clean shell to a resolved target, using the P1-T4
fixtures in this repository. It contains no absolute path; it uses the two
checkout variables defined above. Requires ARC at `75ed6e93` or later (ADR-0004
portable target resolution).

```bash
# 0. Checkout variables (see "Checkout variables used by every command below")
export ARC_REPO="${ARC_REPO:?path to your agentic-research checkout}"
export PEDIATRIC_REPO="${PEDIATRIC_REPO:?path to your pediatric-anemia-site checkout}"

# 1. Approve this repository as a resolvable root, once per machine.
#    The registry defaults to ~/.config/arc/approved-roots.yaml. When you are only
#    testing, point ARC_APPROVED_ROOTS at a scratch file first so you leave your
#    real operator config alone:
#      export ARC_APPROVED_ROOTS="$(mktemp -d)/approved-roots.yaml"
uv run --project "$ARC_REPO" arc roots add pediatric-anemia-site "$PEDIATRIC_REPO"
uv run --project "$ARC_REPO" arc roots list

# 2. Confirm the evidence-manifest digest still matches the RunSpec binding.
shasum -a 256 "$ARC_REPO/knowledge-packs/pediatric-anemia/source-manifest.yaml"

# 3. Preview the spec (schema + council + manifest resolution).
cd "$PEDIATRIC_REPO"
uv run --project "$ARC_REPO" arc run \
  --spec examples/arc-runspecs/local-profile-charter-repository-artifact.runspec.yaml --dry-run

# 4. Resolve the target for real. Skeleton creation is where fail-closed target
#    resolution runs. Send it to a scratch directory to avoid creating a run record.
uv run --project "$ARC_REPO" arc run \
  --spec examples/arc-runspecs/local-profile-charter-repository-artifact.runspec.yaml \
  --output "$(mktemp -d)/arc-target-resolution-check"
```

Step 4 prints the created skeleton path and writes a `run_manifest.yaml` whose
`metadata.target_resolution` records the resolved identity — locator, root alias,
relative path, kind, SHA-256, artifact class, source commit, and tree state — with
no absolute path in any run artifact.

**A green `--dry-run` does not mean the target resolves.** Preview does not call
the resolver: an unregistered alias, a mismatched `target_sha256`, and an absolute
target all still report `ok: true` at `--dry-run`. Only skeleton creation enforces
them, and it does so before any run directory is committed. The fail-closed cases,
verified against these fixtures:

| Injected fault | Error at skeleton creation |
|---|---|
| Registry file missing or invalid | `approved-roots registry is unavailable or invalid` |
| Alias not in a valid registry | `target root alias 'not-registered' is not registered in the approved-roots registry` |
| `--target-sha256` mismatch | `target bytes do not match the expected digest (expected sha256:…, resolved sha256:…)` |
| Absolute target | `Pediatric clinical council runs reject absolute sensitive local target paths; use a relative locator inside this ARC repository` |
| `..` traversal in the locator | `target locator must resolve inside its registered root` |

None of these create a run directory.

Two further constraints worth knowing before you author a new fixture:

- The pediatric council is `councilType: pediatric-clinical-safety`, so ARC
  requires `source_tree_state == clean` — **the target must be committed** in the
  registered root. An uncommitted or dirty target is rejected with
  `clinical review targets must be committed (clean tree) in the registered root`.
- `repo:` targets must declare `target_artifact_class` explicitly; there is no
  default, and only `repository_artifact` and `synthetic_scenario_specification`
  are executable.

A resolved target and a matching digest prove structural identity only. A dry run
and a skeleton creation both execute **zero** reviewers, produce no finding, and
confer no clinical, laboratory, credentialed-review, validation, or certification
state.

## Cross-repository, SDK, rights, and AOS limitations

- ARC is repo-rooted to the `agentic-research` checkout. Its catalogs, schemas, and default run directory come from that tree.
- The completed audit used the alias `repo:pediatric-anemia-site/...` in a user-authorized in-session review, at a time when that external-repository alias was **not resolvable at all**. As of ARC `75ed6e93` (ADR-0004) the alias resolves at **scaffold** time through the approved-roots registry, proven by the P1-T4 fixtures above. Dispatch-time (Agent SDK) resolution of an external alias has **not** been executed here — do not claim direct external-repository SDK execution works until a dispatch is run and recorded.
- The inspected context also contained absolute machine-local paths, so the completed run failed the qualifying-pilot prohibited-input condition. The P1-T4 fixtures and their run artifacts are absolute-path-free; the one absolute path still emitted anywhere on this path is `plan.path` in `--dry-run` preview JSON, which is operator-local CLI output — not a RunSpec field and not a retained run artifact.
- The 15-source manifest includes restricted or unknown rights states. External-provider upload requires owner-rights approval. ARC v1 has no authenticated verifier for that receipt, so server-side model execution fails closed for this manifest.
- Safe current operation is the local, read-only, metadata-only `council-review` workflow. Do not weaken the manifest or run policy to make SDK dispatch pass.
- A future qualifying SDK pilot needs a registered/repository-relative target resolver, a clean prohibited-input scan, an authenticated digest-bound owner-rights receipt, and policy-clean provider execution receipts.
- The AOS commit forwards UUID correlation fields only, now joined by the target locator and target digest (both identifiers). AOS correlation is provenance, not evidence, clinical content, approval, or release state. The exhaustive permitted/prohibited field set and the fail-closed rule for unrecognized fields are in [`04-aos-arc-invocation-contract.md`](04-aos-arc-invocation-contract.md). Pin `OP_HOME` and run `op council` from the `agentic_meta_dev` repository when operator routing is used; direct ARC use remains valid without AOS.

## Current pilot disposition

The canonical run is `arc-run-2026-07-19-pediatric-expansion-arc-readiness`. It reviewed target digest `c8a8fc204f8562b9852f39e04a26b1bf92fc78611184c11a8d081638280e9d56` at pediatric repository commit `ff4b519a160cbfa2a4d19337130cd031c9a7c12b` plus observed untracked context. That mixed context is historical audit evidence, not a clean exact-tree runtime pilot and not an approval of the current tree.

Disposition:

- recommendation: `proceed_with_conditions` for research, protocol, evidence, and implementation planning;
- findings: 12 accepted high-severity findings, 1 watchlist finding, no rejected findings, and 2 recorded duplicate merges;
- certification: `pending`;
- qualifying runtime pilot: `false`;
- credentialed clinical and local-laboratory approvals: `not_executed_owner_held`;
- retrospective, silent-mode, human-factors, legal/regulatory, and production PHI/FHIR validation: not executed;
- clinical release: blocked.

The audit found program/evidence-state drift, unresolved rights and approval identity, dangerous-miss gate drift, missing local laboratory authority, incomplete result-state/provenance and P3 PHI contracts, absent V3/V4/V5 execution work, alert-lifecycle gaps, cross-domain dangerous-miss coverage gaps, and equity/patient-family protocol omissions. These are project validation tasks, not proof that the CDS is clinically unsafe or safe.

## Owner-held release gates

No patient-affecting release may proceed until owners bind approvals and evidence to the exact candidate digest, including as applicable:

1. two independent, named, credentialed pediatric clinical approvals and specialty escalation authority;
2. local laboratory director approval of specimen, analyzer/method, units, intervals, critical values, and mappings;
3. clinical informatics/terminology approval of FHIR profiles, result state/time/provenance, local codes, and fail-closed behavior;
4. privacy/security approval for any separate server/PHI boundary, including threat model, access, audit, downtime, recovery, and minimum-necessary data flow;
5. diagnostic-methods/biostatistics approval of intended use, protocol, reference standard, estimands, uncertainty, subgroup analysis, and decision thresholds;
6. patient-safety/human-factors approval of executable dangerous-miss, alert/override, downtime, handoff, recovery, and usability evidence;
7. equity and patient/family governance review of subgroup, access, language, literacy, disability, caregiver, and adolescent participation assumptions;
8. evidence-rights receipts and legal/regulatory review for the exact sources, provider/storage path, intended use, and release class;
9. completed technical, retrospective, silent-mode, human-factors, and any required interventional validation with independent adjudication;
10. release-identity, independence, signature, revocation, signed-manifest, rollback, surveillance, and change-impact controls.

ARC cannot mint any of these approvals.

## Recurring council gate matrix (product phases P1–P6)

The pediatric clinical council is not a one-time audit; run it again at every point below, against
`01-platform-expansion-roadmap.md` §B's product phase ladder. Every row's "Owner" is a role already
named in `arc-clinical-council-adoption-v1.md` (this plan owns the roles; this table owns when they
convene). "Disposition" is the highest state taxonomy tier (plan §2) the gate can reach on its own —
never higher, regardless of a clean ARC run.

| Phase | Trigger | Inputs | Outputs | Disposition | Owner |
|---|---|---|---|---|---|
| **P1** — Wave-0 safety & defensibility foundation | The tri-state fact model, local-range/unit service, exact-passage evidence schema, signed-manifest design, or review-portal contract reaches a candidate digest — before merge, and again before any P2 content is authored against it. | Design/spec artifact digest; evidence-source manifest digest; `pediatric-anemia-clinical-review-council@0.1.0` RunSpec; no patient data. | `findings.yaml`, `pediatric_clinical_review.json`, `validation_plan.md`, `arc_certification.yaml` (`pending`). | `readiness_audit_complete` at most; blocks P2 content authoring until dangerous-miss and abstention findings in the design close. | Trigger: program owner. Run: ARC platform engineer. Accepted-finding sign-off: clinical governance owner. |
| **P2** — CBC Suite (neutropenia, leukocytosis/eosinophilia, platelets, pancytopenia, smear) | Each candidate CBC rule/threshold/dangerous-miss set reaches a digest — before an `rf`-derived proposal is merged, and again before V1/V3 execution. | Candidate rule set + evidence manifest digest + `DM-CBC-*` dangerous-miss synthetic scenarios; local laboratory profile if range-dependent. | Same required artifacts; scorecard must show executed reviewer passes (not a skeleton placeholder). | `qualifying_runtime_pilot` at most until credentialed hematology + local-laboratory approvals land; `clinical_validation_complete` stays blocked pending V1/V3. | Trigger: council coordinator. Run: Pediatric Hematology + Pediatric Laboratory Medicine seats. Accepted-finding sign-off: clinical governance owner (hematology) and local laboratory director (laboratory). |
| **P3** — Longitudinal workspace + referral-readiness + SMART-on-FHIR | Any workflow, alert-lifecycle, FHIR/CDS-Hooks, or PHI-boundary design reaches a digest — before the server/PHI surface is built, and again before V4 silent-mode scheduling. | Workflow/alert spec digest; FHIR/terminology profile contracts; privacy/security threat model; no PHI in any input. | Same artifacts plus explicit `not_executed`/pending flags for privacy/security and human-factors gates. | Repository-ready at most; `qualifying_runtime_pilot` additionally requires this plan's P2 (rights/authority) and P3 (local profiles) work to be closed. | Trigger: Portal/integration engineer. Run: Clinical Informatics and Interoperability seat. Accepted-finding sign-off: privacy/security owner and clinical governance owner. |
| **P4** — Kidney / Urinalysis pathway (CKiD U25 eGFR, hematuria/proteinuria/BP) | New module candidate reaches a digest — before merge, and again before V1/V3. | Candidate rule set + evidence manifest digest + module-specific dangerous-miss scenarios. | Same required artifacts as P2. | `qualifying_runtime_pilot` at most until the applicable credentialed and local-laboratory approvals land. | Trigger: council coordinator. Run: Pediatric Laboratory Medicine + Diagnostic-Accuracy Methods seats. Accepted-finding sign-off: clinical governance owner. |
| **P5** — Growth Faltering / Nutritional Deficiency pathway | New module candidate reaches a digest — before merge, and again before V1/V3. | Candidate rule set + evidence manifest digest + module-specific dangerous-miss scenarios. | Same required artifacts as P2. | `qualifying_runtime_pilot` at most until the applicable credentialed approvals land. | Trigger: council coordinator. Run: General Pediatrics + Equity and Patient-Family Impact seats. Accepted-finding sign-off: clinical governance owner. |
| **P6+** — Pilots (neonatal bilirubin, analyzer-augmented heme, personalized-baseline surveillance) + adjacent modules + enterprise/commercial layer | Any pilot protocol, surveillance/change-impact design, or customer-facing/enterprise data-sharing surface reaches a digest — before pilot start, and before any commercial claim is made. | Pilot protocol digest; surveillance/change-impact spec; evidence manifest digest; no PHI or customer-confidential data. | Same required artifacts; `arc_certification.yaml` stays `pending` until pilot-specific owner gates close. | Repository-ready at most; release/activation stays blocked per plan §2 regardless of pilot outcome. | Trigger: program owner. Run: full eight-seat council. Accepted-finding sign-off: governance owner and release-governance owner. |

### Who owns each accepted pilot finding

An "accepted" finding from any run above is not self-executing — it routes to exactly one named owner
role for disposition, never to ARC or the adjudicator:

| Finding category (council seat) | Accepted-finding owner |
|---|---|
| Pediatric Hematology | Clinical governance owner (named, credentialed pediatric hematology reviewer) |
| Pediatric Laboratory Medicine | Local laboratory director |
| General Pediatrics | Clinical governance owner (named, credentialed general pediatrics reviewer) |
| Clinical Informatics and Interoperability | Clinical informatics owner |
| Diagnostic-Accuracy Methods | Diagnostic methods owner |
| Prediction and Implementation Evaluation | ARC platform engineer routes to clinical governance owner for clinical-impact findings |
| Patient Safety and Human Factors | Pediatric safety owner |
| Equity and Patient-Family Impact | Equity/patient-family governance owner |
| Evidence Quality Input (non-voting) | Evidence-rights owner |
| Adjudication outputs (merged findings, preserved dissent, validation plan) | Program integration owner routes each item to the applicable named owner above; the adjudicator cannot self-approve or close a finding. |

If a finding does not map cleanly to one row, the program integration owner assigns it explicitly and
records the assignment — a finding never stays unowned by default.

## Ordered continuation

The project-native execution package belongs at the planned canonical path [`../implementation_plans/enhancements/arc-clinical-council-adoption-v1.md`](../implementation_plans/enhancements/arc-clinical-council-adoption-v1.md). Keep that plan evidence-linked to this handoff and do not mark its owner-held gates complete from repository evidence alone.

1. Reconcile `00-expansion-plan.md`, the RF handoff registry/results, git state, and authoritative node/run state in one reviewed commit.
2. ~~Register a portable pediatric project target/profile so ARC can resolve exact repository-relative targets without absolute paths or an unimplemented external alias.~~ **Done at scaffold** (ARC ADR-0004 / `75ed6e93`; fixtures in [`examples/arc-runspecs/`](../../../examples/arc-runspecs/); see "Reproduce the dry run end to end"). Dispatch-time resolution remains unexecuted.
3. Design and implement an authenticated, digest-bound owner-rights receipt and provider-policy gate; keep restricted-source content metadata-only until it passes.
4. Freeze the clinical approval identity/independence/signature/revocation contract and the local laboratory profile authority contract.
5. Turn `DM-CBC-001` through `DM-WORKFLOW-010` into executable synthetic tests with exact fixtures, expected alert/abstention, traces, owners, and rollback signals.
6. Freeze P3 PHI/FHIR, terminology, result-status/provenance, alert lifecycle, downtime, recovery, and security boundaries before any server/PHI scheduling.
7. Encode V3 retrospective, V4 silent-mode, and V5 human-factors protocols through independent adjudication as explicit release dependencies; remove illustrative metrics from executable go/no-go gates.
8. Run a policy-clean, qualifying runtime pilot against one exact non-patient target digest and a clean input manifest; validate the run and read the real scorecard verdict.
9. Obtain owner-held credentialed clinical, laboratory, rights, legal/regulatory, privacy/security, methods, safety/human-factors, equity, and patient/family reviews bound to the same candidate digest.
10. Only after all applicable evidence and validation gates pass, run final exact-tree ARC review plus separate release certification and owner authorization. Any material edit invalidates prior exact-tree approvals.

## Canonical artifacts

All ARC links below are commit-pinned to `72ab6f69...`; the AOS contract is pinned to `99d7ee03...`.

- [Pediatric clinical council definition](https://github.com/miethe/agentic-research/blob/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/councils/pediatric-anemia-clinical-review-council.yaml)
- [Council operator example and warnings](https://github.com/miethe/agentic-research/blob/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/examples/pediatric-clinical-council/README.md)
- [Canonical pediatric RunSpec example](https://github.com/miethe/agentic-research/blob/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/examples/pediatric-clinical-council/run-spec.yaml)
- [Evidence source manifest](https://github.com/miethe/agentic-research/blob/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/knowledge-packs/pediatric-anemia/source-manifest.yaml) and [manifest schema](https://github.com/miethe/agentic-research/blob/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/schemas/evidence-source-manifest.schema.json)
- [Pediatric clinical review schema](https://github.com/miethe/agentic-research/blob/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/schemas/pediatric-clinical-review.schema.json)
- [Run workflow guide](https://github.com/miethe/agentic-research/blob/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/docs/run-a-council.md)
- [Completed readiness-audit run](https://github.com/miethe/agentic-research/tree/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/runs/2026-07-19-pediatric-expansion-arc-readiness), including the [decision record](https://github.com/miethe/agentic-research/blob/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/runs/2026-07-19-pediatric-expansion-arc-readiness/decision_record.md), [scorecard](https://github.com/miethe/agentic-research/blob/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/runs/2026-07-19-pediatric-expansion-arc-readiness/scorecard.json), [findings](https://github.com/miethe/agentic-research/blob/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/runs/2026-07-19-pediatric-expansion-arc-readiness/findings.yaml), and [validation plan](https://github.com/miethe/agentic-research/blob/72ab6f69bcfd31f5221ff598f4649b21e2f0e06a/runs/2026-07-19-pediatric-expansion-arc-readiness/validation_plan.md)
- AOS ARC adapter contract: `agentic_meta_dev@99d7ee03d2a8c8e584115cf44106b195c3222210:docs/agentic-operator/contracts/arc.md` (currently local-only)
- Project-side AOS invocation contract (identifier-only field set, fail-closed unknown-field rule): [`04-aos-arc-invocation-contract.md`](04-aos-arc-invocation-contract.md)
- Project-side RunSpec fixtures: [`examples/arc-runspecs/`](../../../examples/arc-runspecs/) — one `repository_artifact` and one `synthetic_scenario_specification` spec, both portable-locator and absolute-path-free
- ARC portable target resolution: `repo:agentic-research/docs/dev/architecture/adr-0004-portable-target-resolution.md` at `75ed6e93`
- Project continuation plan (planned): [`../implementation_plans/enhancements/arc-clinical-council-adoption-v1.md`](../implementation_plans/enhancements/arc-clinical-council-adoption-v1.md)
