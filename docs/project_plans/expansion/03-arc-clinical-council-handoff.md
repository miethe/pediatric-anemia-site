---
title: "ARC pediatric clinical council handoff"
description: "Project-facing operating contract for evidence-bound, authority-limited pediatric CDS council reviews."
audience: [project-agents, clinical-governance, evidence-governance, platform-engineering, validation]
tags: [pediatric-cds, arc, clinical-safety, evidence-governance, council-review]
created: 2026-07-19
updated: 2026-07-21
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

### Two baselines — do not conflate them

This document pins two distinct things, and they answer different questions:

- **Readiness-audit run artifacts** — pinned to ARC `72ab6f69bcfd31f5221ff598f4649b21e2f0e06a` (the
  table above and "Canonical artifacts" below). This is the tree the completed, non-qualifying
  synthetic readiness audit (`arc-run-2026-07-19-pediatric-expansion-arc-readiness`) was reviewed
  against. Use this pin only when citing that specific audit's own artifacts — its scorecard,
  findings, decision record, and validation plan (see "Current pilot disposition" below). It is
  historical evidence, not a live workflow target.
- **Current adoption code baseline** — ARC `e42f6a6b1dd4c88a8cfbcda8b34fff6496195a3e` (`main`, pushed
  to `origin`; Phase 6 complete — governed Portal authoring plus the disabled-by-default MeatyWiki
  metadata adapter), built on ARC `afe3b98` (Phase 5's committed, truthfully-labelled qualifying-pilot
  skeleton — fix cycle 4 applied — itself built on `80bb663`, P1-P3). The pediatric repository `HEAD`
  tracks this same program. Use this baseline — not `72ab6f6` — for every live workflow action in this
  document: `arc run`, the Portal, `arc validate`, and any new qualifying-pilot attempt. The qualifying
  pilot itself has **not** run at this baseline (see "Current pilot disposition"); Phase 6's Portal and
  adapter work landed independently of Phase 5's blocker and did not remove it.

Re-verify both SHAs before relying on them — `git rev-parse HEAD` in the ARC checkout does not by
itself tell you which baseline you are reading about; check the commit message or `git log --oneline`
against the hashes above.

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

## Source and rights refresh schedule

The 15-source evidence manifest is not "verify once." Each source record already carries a
self-declared review floor (`spec.sources[].freshness.next_review_at`) and a retraction/rights state
that can change independently of any code or council change. This is the operational cadence for
keeping those fields — and, once one exists, the evidence-rights receipt — honest.

1. **Per-source mechanical floor.** Re-review a source no later than its own
   `freshness.next_review_at`, sooner if `review_status` is not already `current`. At the pinned
   manifest (`pediatric-anemia-evidence-sources@0.1.0`), 14 of 15 sources are due `2027-01-18`; one
   (`LAB-03`) is due sooner, `2026-10-18`, and already carries `review_status: unknown` — treat it as
   the next scheduled check, not the others.
2. **Manifest-level sweep.** Whenever any source's `next_review_at` passes, or at minimum every 6
   months (whichever is sooner), the evidence-rights owner — with the Evidence Quality Input seat for
   the mechanical read, and the clinical governance owner co-signing re-verification of the `CLIN-*`
   guideline sources — re-checks every source's `update_status`, `retraction_status`, `freshness`, and
   `license`/`handling_policy` fields against the live publisher, and records the result. This is a
   manual review; ARC has no automated freshness poller.
3. **Evidence-rights receipt cadence — not yet applicable.** No `EvidenceRightsReceipt` exists yet (see
   "Current pilot disposition" below). Once `evidence-rights-owner` signs one, re-verify it at minimum
   annually, or immediately on any manifest content, `license.status`, or `handling_policy` change,
   whichever comes first — a receipt binds a specific manifest digest, and any manifest edit
   invalidates it the same way a manifest edit invalidates a prior council review (above).
4. **Event-driven triggers, regardless of calendar:**
   - any edit to `knowledge-packs/pediatric-anemia/source-manifest.yaml` (recompute the SHA-256,
     update every RunSpec's `evidence_source_manifest_sha256`, and treat all prior reviews as bound to
     the old digest);
   - a retraction, correction, or errata notice on any source, however small;
   - a change to any source's `license.status` or `handling_policy`;
   - before any new qualifying-pilot attempt — re-verify the digest matches what that RunSpec
     asserts, per "Before every run" above.
5. **Owner.** Evidence-rights-owner triggers and executes the sweep; ARC platform engineer recomputes
   and republishes the digest on any content change; clinical governance owner co-signs `CLIN-*`
   re-verification. A missed or stale review does not silently pass: a stale digest fails closed at
   RunSpec validation (mismatched `evidence_source_manifest_sha256`), and a stale
   `freshness.review_status` is a finding the Evidence Quality Input seat is expected to raise on the
   next council run — it is not a condition ARC detects on its own between runs.

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

Two separate pilot-disposition records exist. Neither qualifies, certifies, validates, or releases
this CDS — read both before citing "pilot" anywhere in project material.

### Readiness-audit disposition (historical, pinned `72ab6f6`)

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

### Qualifying-pilot attempt disposition (Phase 5, 2026-07-21 — BLOCKED on owner action)

Phase 5 attempted the program's first actual qualifying runtime pilot, against a clean, immutable,
non-patient synthetic candidate (`SYNTHETIC-DM-CBC-001`, hazard `DM-CBC-001`) resolved through the P1
portable-target resolver and approved-roots registry. `arc_cli.agent.review.execute_review` did not
run. It is blocked on two independent, owner-held gates, both reproduced read-only by an Opus validator
on three separate occasions (full detail:
`.claude/progress/arc-clinical-council-adoption-v1/phase-5-completion.md`):

1. **SDK credential** (`arc-runtime-owner`) — `authoring_status()` returns
   `{available: false, reason: no_credential, auth_mode: null}`; no `CLAUDE_CODE_OAUTH_TOKEN` /
   `ANTHROPIC_API_KEY` is provisioned, and this path has no ambient/CLI-session fallback.
2. **Evidence-rights receipt** (`evidence-rights-owner`, plus `arc-runtime-owner` for the trust anchor)
   — all 15/15 sources in the council's evidence manifest declare
   `external_provider_upload: metadata_only_with_owner_rights_approval`; no `EvidenceRightsReceipt`
   exists, and `~/.config/arc/authority-trust.yaml` is absent, so none could be verified if presented.

Gate 1 clearing is necessary but not sufficient — Gate 2 is reached only once Gate 1 clears, and is a
general property of this council-plus-evidence-manifest pairing, not an artifact of the chosen
candidate. **No legitimate in-policy path exists** around either gate: routing through the ICA/`gateway`
auth shape is forbidden by this plan's routing record (clinical council lenses are MUST-stay-primary),
and relaxing the source manifest's `required: true`/rights terms to force Gate 2 open would itself be
the policy violation this plan exists to prevent.

Delivered instead: a truthfully-labelled pilot skeleton, committed at ARC `afe3b98` (fix cycle 4
applied — the `dangerous_miss_review` false `not_applicable` on `subgroup_or_access_failure` is now
`not_covered` against open HIGH `PAC-P4T2-001`, and the run's deterministic data-boundary scan re-runs
`all_clean: true`, 0 absolute-path hits in both passes). The pilot qualifies the **runtime resolution
path**, not the CDS — runtime qualification itself was not achieved.

- qualifying runtime pilot: `false` (SDK-credential- and evidence-rights-blocked, not
  attempted-and-failed);
- P5-V1 (exact-tree clinical-safety and correctness review): **not satisfied** — only
  `task-completion-validator` and `pediatric-clinical-adjudicator` ran; the other eight named AC P5.1
  lenses did not, so no seat has assessed any of the ten hazard families for this candidate;
- credentialed clinical and local-laboratory approvals: `not_executed_owner_held`;
- clinical release: blocked;
- resolution: owner action only — `arc-runtime-owner` provisions an SDK credential and registers a
  trust anchor; `evidence-rights-owner` signs an `EvidenceRightsReceipt` for the pinned manifest digest
  (`f4c33c82fe4977a7d4db2633ab04d82b39bb7bf421d048aba5a5b37a51b711f6`, all 15 source IDs). No
  repository work remains for Phase 5 — see "Rollback and runbook" below for how a failed vs.
  owner-held gate should be read.

Full finding-level detail (RR-1, C1-C3, RR-2, RR-4, RF-1..7, DIS-1) is in
`.claude/findings/arc-clinical-council-adoption-v1-findings.md` §P5-V1.

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

## Recurring council gate matrix (product phases P1–P6 and the Evidence Foundry promotion boundary)

The pediatric clinical council is not a one-time audit; run it again at every point below, against
`01-platform-expansion-roadmap.md` §B's product phase ladder, and — for every module whose evidence
flows through `rf` — at the promotion boundary defined in
[`02-evidence-foundry-on-research-foundry.md`](02-evidence-foundry-on-research-foundry.md) §4 ("The
handoff contract: `rf` bundle to CDS KB pack") and gate `G4 converter eligibility` in that document's
§5.1. Every row's "Owner" is a role already named in `arc-clinical-council-adoption-v1.md` (this plan
owns the roles; this table owns when they convene). "Disposition" is the highest state taxonomy tier
(plan §2) the gate can reach on its own — never higher, regardless of a clean ARC run.

| Phase | Trigger | Inputs | Outputs | Disposition | Owner |
|---|---|---|---|---|---|
| **P1** — Wave-0 safety & defensibility foundation | The tri-state fact model, local-range/unit service, exact-passage evidence schema, signed-manifest design, or review-portal contract reaches a candidate digest — before merge, and again before any P2 content is authored against it. | Design/spec artifact digest; evidence-source manifest digest; `pediatric-anemia-clinical-review-council@0.1.0` RunSpec; no patient data. | `findings.yaml`, `pediatric_clinical_review.json`, `validation_plan.md`, `arc_certification.yaml` (`pending`). | `readiness_audit_complete` at most; blocks P2 content authoring until dangerous-miss and abstention findings in the design close. | Trigger: program owner. Run: ARC platform engineer. Accepted-finding sign-off: clinical governance owner. |
| **P2** — CBC Suite (neutropenia, leukocytosis/eosinophilia, platelets, pancytopenia, smear) | Each candidate CBC rule/threshold/dangerous-miss set reaches a digest — before an `rf`-derived proposal is merged, and again before V1/V3 execution. | Candidate rule set + evidence manifest digest + `DM-CBC-*` dangerous-miss synthetic scenarios; local laboratory profile if range-dependent. | Same required artifacts; scorecard must show executed reviewer passes (not a skeleton placeholder). | `qualifying_runtime_pilot` at most until credentialed hematology + local-laboratory approvals land; `clinical_validation_complete` stays blocked pending V1/V3. | Trigger: council coordinator. Run: Pediatric Hematology + Pediatric Laboratory Medicine seats. Accepted-finding sign-off: clinical governance owner (hematology) and local laboratory director (laboratory). |
| **P3** — Longitudinal workspace + referral-readiness + SMART-on-FHIR | Any workflow, alert-lifecycle, FHIR/CDS-Hooks, or PHI-boundary design reaches a digest — before the server/PHI surface is built, and again before V4 silent-mode scheduling. | Workflow/alert spec digest; FHIR/terminology profile contracts; privacy/security threat model; no PHI in any input. | Same artifacts plus explicit `not_executed`/pending flags for privacy/security and human-factors gates. | Repository-ready at most; `qualifying_runtime_pilot` additionally requires this plan's P2 (rights/authority) and P3 (local profiles) work to be closed. | Trigger: Portal/integration engineer. Run: Clinical Informatics and Interoperability seat. Accepted-finding sign-off: privacy/security owner and clinical informatics owner. |
| **P4** — Kidney / Urinalysis pathway (CKiD U25 eGFR, hematuria/proteinuria/BP) | New module candidate reaches a digest — before merge, and again before V1/V3. | Candidate rule set + evidence manifest digest + module-specific dangerous-miss scenarios. | Same required artifacts as P2. | `qualifying_runtime_pilot` at most until the applicable credentialed and local-laboratory approvals land. | Trigger: council coordinator. Run: Pediatric Laboratory Medicine + Diagnostic-Accuracy Methods seats. Accepted-finding sign-off: local laboratory director (laboratory) and diagnostic methods owner (methods). |
| **P5** — Growth Faltering / Nutritional Deficiency pathway | New module candidate reaches a digest — before merge, and again before V1/V3. | Candidate rule set + evidence manifest digest + module-specific dangerous-miss scenarios. | Same required artifacts as P2. | `qualifying_runtime_pilot` at most until the applicable credentialed approvals land. | Trigger: council coordinator. Run: General Pediatrics + Equity and Patient-Family Impact seats. Accepted-finding sign-off: clinical governance owner (general pediatrics) and equity/patient-family governance owner (equity). |
| **P6+** — Pilots (neonatal bilirubin, analyzer-augmented heme, personalized-baseline surveillance) + adjacent modules + enterprise/commercial layer | Any pilot protocol, surveillance/change-impact design, or customer-facing/enterprise data-sharing surface reaches a digest — before pilot start, and before any commercial claim is made. | Pilot protocol digest; surveillance/change-impact spec; evidence manifest digest; no PHI or customer-confidential data. | Same required artifacts; `arc_certification.yaml` stays `pending` until pilot-specific owner gates close. | Repository-ready at most; release/activation stays blocked per plan §2 regardless of pilot outcome. | Trigger: program owner. Run: full eight-seat council. Accepted-finding sign-off: routes per seat through "Who owns each accepted pilot finding" below (clinical governance owner, local laboratory director, clinical informatics owner, diagnostic methods owner, pediatric safety owner, and equity/patient-family governance owner as applicable); adjudication outputs route through the program integration owner. |
| **Evidence Foundry promotion boundary** — `rf` bundle → CDS KB pack (cross-cutting: applies to P2, P4, P5, and any later `rf`-sourced module) | A module's `rf` evidence bundle satisfies converter-eligibility (`02-evidence-foundry-on-research-foundry.md` §3.7 field checks, §3.9 run-acceptance-before-handoff checklist) and reaches gate `G4 converter eligibility` in that document's §5.1 — before the `rf-bundle-to-kb-pack` converter's `propose` step (§4.5–4.6) drafts `rule-proposals.json`, `candidates.json`, or dangerous-miss tests into a staged `build/kb-pack/<module_id>/<pack_version>/` pack, and again after any material bundle, authoring-decision, or profile change before re-promotion. | `evidence_bundle.yaml` content-hash digest (§4.6 Phase 1 "Pin"); evidence-source manifest digest (`pediatric-anemia-evidence-sources@0.1.0`); `pediatric-anemia-clinical-review-council@0.1.0` RunSpec targeting the candidate evidence/rule set as a `repository_artifact` or `synthetic_scenario_specification`; no PHI, no raw source bodies beyond the manifest's permitted exact-passage projections (§4.9–4.10), no full copyrighted text. | Same required artifacts as every row above; scorecard must show executed reviewer passes, not a skeleton placeholder. | `qualifying_runtime_pilot` at most, and only from an executed run against the exact `evidence_bundle.yaml` digest — bounded by whichever module-specific cap applies from that module's P2/P4/P5 row above. Promotion into `build/kb-pack/...` is a staged proposal, never a release event: §4.1 fixes converter release authority at `None`, and §5.7's release state machine keeps `rule_proposed` upstream of `clinical_review`. This gate cannot advance `certified_for_defined_scope`, `clinical_validation_complete`, or `released`/`activated` regardless of a clean ARC run, a clean `rf verify`, or a clean `rf council` pass — those remain separate gates (§5.1 `G2`/`G3` upstream, `G5`–`G8` downstream). | Trigger: council coordinator (same trigger owner as the module's P2/P4/P5 row). Run: the module-appropriate voting seats already named in that module's row above, plus Evidence Quality Input (non-voting; evaluates this same bundle's source rights, freshness, retraction, and lineage) for every module. Accepted-finding sign-off: routes through that module's row above (e.g., clinical governance owner plus local laboratory director for CBC per P2) plus the evidence-rights owner for Evidence Quality Input findings, per "Who owns each accepted pilot finding" below. `rf council`'s own methodologist/skeptic review (§5.3, gate `G3`) is a separate, earlier gate this row does not repeat or supersede. |

### Corrections applied in P7-T1

Reconciling the table above against "Who owns each accepted pilot finding" below surfaced four
accepted-finding sign-off cells that vested a seat's finding in an owner different from the one this
document already names for that seat elsewhere — a duplicate-authority defect, not a stylistic
inconsistency, because it left two different answers to "who owns this decision" live in the same
document. All four are corrected in place rather than carried forward:

- **P6+** named "release-governance owner" — a role not defined anywhere in
  `arc-clinical-council-adoption-v1.md` or elsewhere in this handoff, i.e. an invented authority.
  Replaced with an explicit per-seat route through "Who owns each accepted pilot finding" plus the
  program integration owner for adjudication outputs, matching how every other multi-seat row in this
  table already routes findings.
- **P4** named only "clinical governance owner" for a run of the Pediatric Laboratory Medicine and
  Diagnostic-Accuracy Methods seats. "Who owns each accepted pilot finding" vests those seats'
  findings in the local laboratory director and the diagnostic methods owner respectively — neither of
  which is the clinical governance owner. Corrected to name both, following the two-seat pattern
  already used in P2.
- **P5** named only "clinical governance owner" for a run of the General Pediatrics and Equity and
  Patient-Family Impact seats. The equity seat's findings belong to the equity/patient-family
  governance owner. Corrected to name both.
- **P3** named "privacy/security owner and clinical governance owner" for a run of the Clinical
  Informatics and Interoperability seat, but that seat's findings belong to the clinical informatics
  owner. Privacy/security owner is retained — P3's trigger is explicitly a PHI-boundary design review
  — but clinical governance owner is replaced with clinical informatics owner.

No seat, review authority, or accepted-finding owner was added, removed, or reassigned beyond aligning
these four cells with the per-seat routing already established in "Who owns each accepted pilot
finding" and in P2's two-seat pattern. The new Evidence Foundry promotion-boundary row does not
introduce a fifth: it explicitly defers to each module's P2/P4/P5 row and to the table below rather
than asserting its own owner set.

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

## Rollback and runbook

Operational reference for running the gate, understanding the MeatyWiki adapter's default posture,
rolling back a promotion, and reading a failed or owner-held gate correctly. This section introduces
no new authority or state; it points at mechanisms already described above.

### Running the council gate

Follow "Exact scaffold → populate → validate → read-verdict workflow" above, against the **current
adoption code baseline** (see "Two baselines" under "Pinned baseline"), not the historical
readiness-audit pin. In short: author/scaffold a RunSpec (`arc run --spec ... --dry-run`, then without
`--dry-run`), populate the skeleton with the `council-review` skill, `arc validate runs/<date>-<slug>`,
then read `scorecard.json`/`findings.yaml`/`pediatric_clinical_review.json` — never trust a scorecard
whose `scores` is empty or whose summary says review was not executed.

The Governed Portal (Phase 6) is an alternative authoring surface for the same RunSpec and
evidence-source manifest — structured forms with byte/semantic-exact round-trip codecs, preview
WARNINGS for all five blocking classes (prohibited target, missing receipt, owner-held gate, stale
digest, non-qualifying state), and a persistent "not clinical approval / not release authorization"
disclaimer on every green state. It never bypasses `arc run`/`arc validate`, and it never presents
portal-side validation as clinical approval. The evidence-source-manifest editor in the Portal is
**download-only** — it has no backend `PUT` — so the raw YAML in
`knowledge-packs/pediatric-anemia/source-manifest.yaml` stays the sole authoritative copy; the Portal
serializes byte-exact YAML plus SHA-256 for an operator to commit by hand.

### MeatyWiki adapter — disabled by default

`arc_cli/meatywiki_source_adapter.py` (shipped in Phase 6) is a standalone, inbound, read-only,
metadata-only adapter, **disabled by default behind two independent owner-held environment gates**. It
is not imported by, and not reachable from, any run-execution path — its disablement cannot block
Phase 5 or any council run, and its enablement cannot itself weaken source/safety policy (strict
allowlist projection; no source body is ever fetched, hashed, or logged; every negative class —
access-denied, stale, retracted, rights-mismatch, projection-change, injection, round-trip — fails
closed with no echo of the protected payload). Do not enable it, and do not treat its mere presence in
the codebase as source access being available: OQ-5 (which MeatyWiki vault and ACL/rights policy are
approved) is unresolved, and enabling the adapter without that owner decision is exactly the policy
weakening this plan is structured to prevent. It is distinct from, and not entangled with, the
pre-existing *outbound* finding-filer `arc_cli/server/meatywiki.py`.

### Rolling back a promotion

Two separate things can be rolled back, and they roll back differently:

- **A `rf`-bundle-to-KB-pack promotion** (the Evidence Foundry promotion boundary row in the "Recurring
  council gate matrix" above) is a **staged proposal, never a release event** — the converter's release
  authority is fixed at `None`, and the release state machine keeps `rule_proposed` upstream of
  `clinical_review`. Rollback is therefore: do not merge the staged
  `build/kb-pack/<module_id>/<pack_version>/` directory, or `git revert` the specific commit that
  merged it, then re-run the pediatric council against the corrected candidate digest before attempting
  promotion again. Nothing downstream of `rule_proposed` needs unwinding, because nothing downstream
  was ever reached.
- **A Portal-authored RunSpec/council/role/seat write** goes through the same validated-YAML,
  on-disk-system-of-record path as the CLI/API (this repository's `CLAUDE.md` "Authoring surfaces").
  Rollback is a normal `git revert` of the commit that landed the write — there is no separate
  portal-side "apply" step to undo.

### Reading a failed or owner-held gate

- **`FAIL`** (a reviewer lens returns a verdict, not silence) means a real defect or unmitigated hazard
  was found on the reviewed tree. Fix the finding, then re-run only the lens(es) whose domain the fix
  touched — per the gate-staleness rule Phase 6 followed (only `ux-workflow-reviewer` was re-run after
  its fix cycle; the unrelated security/tool-governance/backend PASSes stood on their unchanged
  domains). Never treat a narrower re-run as re-validating a domain the fix did not touch.
- **`owner_held` / `not_executed_owner_held`** means the gate genuinely cannot be executed or approved
  by a repository agent — no amount of repository work closes it. Record it as exactly that literal
  (plan §5), never as a synthetic pass, and never mark it complete from repository evidence alone (plan
  §6; "Ordered continuation" below). OQ-2 through OQ-6 and V3/V4/V5 are all currently in this state;
  Phase 5 itself is blocked in this state (see "Current pilot disposition").
- **A reviewer `FAIL` followed by a later `PASS-WITH-FINDINGS`** (as Phase 5's
  `pediatric-clinical-adjudicator` went FAIL → FAIL → PASS-WITH-FINDINGS across three cycles) does not
  mean the residual findings are closed — read the residual severity and owner from
  `.claude/findings/arc-clinical-council-adoption-v1-findings.md`, not just the verdict word.
- **A related cross-repo schema/literal conflict** exists between this plan's mandated
  `not_executed_owner_held` literal (plan §5) and ARC's `_RESERVED_AUTHORITY_STATE_TOKENS` hard-error
  (rejects that exact token anywhere under `metadata.*` outside `authority_attachments`/
  `local_profiles`) — the literal is unwritable in a run manifest's free-form metadata as a result.
  Currently handled by disclosed synonym substitution; full detail and owner in
  `.claude/findings/arc-clinical-council-adoption-v1-findings.md` §P5-V1.
- **One pre-existing, out-of-scope RED test** carries across every phase from P1-P3 forward:
  `tests/test_local_profiles.py::DispatchAndCertificationGates::test_certification_acceptance_passes_the_gate_when_verified`
  fails at ARC HEAD (confirmed still the only pytest failure through Phase 6). Root cause: a
  wall-clock time-bomb (fixture `NOW = 2026-07-19`, a 24-hour snapshot max-age, and
  `custom_outputs.py`'s date handling omitting `now=`). This is inherited debt from P1-P3 (`80bb663`),
  not a Phase 5, 6, or 7 regression — do not attempt to fix it as part of this program's closeout, and
  do not let its presence block an otherwise-green suite read. Owner: ARC certification /
  local-profile owner (P3-scoped).

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
These are the **readiness-audit run's own artifacts** — see "Two baselines" under "Pinned baseline"
above. They stay pinned to that historical commit deliberately, because they document what that
specific completed audit produced; they are not a pointer to the current adoption code baseline
(ARC `e42f6a6`).

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
