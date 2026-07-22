---
title: "Gates Registry — G0–G4 External Human Gates"
status: reference
date: 2026-07-22
owner: platform-engineering (registry maintenance only — clears no gate)
source_refs:
  - "docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md (FR-27, gates G0–G4)"
  - "docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md § External Human Gates (rulings R2/R4, adjudications A1/A2)"
  - "docs/adr/0004-clinical-approval-identity-adjudication.md"
  - "docs/adr/0005-kb-serialization-signing-key-custody.md"
  - "docs/adr/0006-validation-data-boundary-deidentification.md"
  - "docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md"
  - "docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md §5.1, §5.3, §7.3"
---

# Gates Registry — G0–G4 External Human Gates

**Status: unvalidated research prototype.** Nothing in this registry, or in any artifact it
describes, is or may be read as clinical validation, regulatory clearance, or a substitute for a
qualified human's clinical judgment. This document does not grant, imply, or record clinical
approval of anything — it is an index of the human actions this program cannot legitimately take
for itself.

## Purpose

Evidence Foundry E1 models five points in the clinical-governance lifecycle where only a named,
accountable human — never a task, an agent, an AI system, or a plan — may act. This registry is the
single canonical enumeration of those five gates: what each one is, who (by role) may clear it, what
must be true before it is considered cleared, what stays structurally inert until it clears, and the
schema-forced mechanism that holds that inertness today, in the absence of any gate having cleared.

**Binding rule, stated once and applying to every row below: no gate in this registry is clearable
by any task, any agent, or any plan.** Clearing a gate is always an external human act, evidenced by
an artifact this codebase can read (an ADR's `status` field, a roster entry, a signing-ceremony
record, a signed DUA, a signed release-authorization review record) but never one this codebase, or
anything running inside it, can produce, approve, or synthesize on a human's behalf. Every task in
this plan is scoped so that its own exit criteria never depend on a gate having cleared
(`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md` § External Human
Gates). Progress tracking represents all five gates as externally-blocked states, not as completable
work items (P5-T5); this registry is the source those tracking entries copy from, not the reverse.

Each row below is intentionally short on prose and long on mechanism: "owner-role" names the human
authority, never a person, a team ticket, or an AI persona; "entry criteria" is the observable fact
that would make the gate cleared; "blocked artifacts/behaviors" is what stays unavailable while it is
not; "schema-forced-inert mechanism" is the concrete, testable artifact (a `const`, a `maxItems: 0`,
a structural rejection) that holds that unavailability today, independent of anyone remembering to
enforce it by convention.

---

## G0 — ADR ratification

| Field | Content |
|---|---|
| **Gate** | G0 — ADR ratification |
| **Owner-role (human)** | The ratifying authority named in each ADR's own `deciders` frontmatter — clinical-governance and platform-engineering leads for ADR-0004; the equivalent named platform/clinical-governance leads for ADR-0005 and ADR-0006. Never an agent, never this plan's authoring session, never an ARC/`rf`/`council-review` output. |
| **Entry criteria** | For each of ADR-0004, ADR-0005, and ADR-0006 independently: the ADR's `status` frontmatter field is changed from `proposed` to `accepted` by an explicit, attributable human ratification decision — recorded in the ADR file itself (not only in a session note, commit message, or plan doc). Partial ratification is real: each ADR clears G0 on its own, not as a bundle. |
| **Blocked artifacts/behaviors** | Until an individual ADR clears G0: (a) that ADR's design remains a recommendation only — "Recommended default," never "the decision this program has adopted"; (b) no downstream artifact may describe the model that ADR proposes (five-role review workflow for ADR-0004; Ed25519 signing + key custody + registry shape for ADR-0005; the external-partner validation-data boundary for ADR-0006) as ratified policy; (c) this plan (E1) builds the *software machinery* implementing each ADR's recommended default regardless of ADR status — per the plan's Executive Summary, that machinery ships now precisely so it exists once ratification happens — but every real (non-synthetic) instance of that machinery stays inert via G1/G2/G3's own mechanisms below, which is a separate, additional block layered on top of G0, not a substitute for it. |
| **Schema-forced-inert mechanism** | G0 itself is a process gate, not a data-shape gate — no JSON Schema field represents "this ADR is accepted." Its enforcement is: (1) no task in this plan, and no script this plan ships, ever writes `status: accepted` into any ADR file; (2) every phase exit gate in this plan includes an explicit ADR-delta check (Phase 1 exit-gate item, `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-1-contracts-gates.md`: "ADR-delta check: ADR-0004/0005/0006 unchanged since plan authoring — any human edit → escalate before wave 2") that fails the phase, rather than silently proceeding, the moment a human *does* touch ADR status; (3) the real work G0 gates is separately, independently blocked by G1/G2/G3's own schema-forced mechanisms below — so a mistaken or premature `accepted` flip on an ADR alone still cannot make any real reviewer, signature, or real-data input schema-valid. |

### A2 (binding) — SPIKE-006 reconciliation, recorded in G0's ADR-0005 entry

G0's ADR-0005 sub-entry additionally carries the following condition, verbatim, as a binding
adjudication this program has already made and that any future ratification of ADR-0005 must be
consistent with — ratifying ADR-0005 without satisfying this condition is not a valid clearance of
G0 for that ADR:

> The signing custodian must be a distinct authority from the release author, and CI/agents never
> hold keys.

This condition reconciles ADR-0005's recommended Ed25519/offline-custody design with
`docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md`'s RQ1/RQ6 finding —
under the E0-era deployment model, a single GitHub account authored content, ran CI, and would have
held any signing key, which SPIKE-006 held was **not** a valid custody arrangement (RQ1: "if the same
person who authors KB content also holds the signing key and runs the release script on their own
machine or in CI under their own account..."; RQ6's NO-GO on cryptographic signing "in this exact
deployment model" turned on exactly this collapse; Amendment 2 subsequently rejected server-only
signing on the identical merits — "the deeper, non-circularity objection... applies with undiminished
force" — for the same reason: signer and author being the same actor, regardless of custody
mechanism). ADR-0005's E1-era design must not recreate that collapse: whoever holds the release
signing key at G2 must be a role distinct from whoever authors or proposes the release content, and
neither this repository's CI pipeline nor any agent running inside it may ever hold, generate for
persistent use, or have access to that key (satisfied structurally today by OQ-6's ephemeral,
in-memory-only test-key generation and by the total absence of any persisted key material in this
repository or its CI configuration — a fact P3-T5 asserts by test).

---

## G1 — Named credentialed reviewer roster

| Field | Content |
|---|---|
| **Gate** | G1 — Named credentialed reviewer roster |
| **Owner-role (human)** | The human(s) responsible for out-of-band credential verification and roster administration — a named clinical-governance/credentialing role, per ADR-0004's minimum-roles table (pediatric hematologist/subspecialist for clinical review 1, a second qualified pediatric clinician for clinical review 2, laboratory medicine/pathology for laboratory review, a named non-author adjudicator, authorized clinical and quality/release roles for release authorization). Never an agent, never ARC/`rf`/`council-review` output — this repo's own guardrails already name treating ARC/council output as credentialed clinical sign-off as a specific mistake to avoid. |
| **Entry criteria** | For each real (non-synthetic) reviewer: a `governance/reviewer-roster.yaml` entry with `synthetic: false`, a populated `credentialRef`, an assigned `moduleScopes[]`, and a populated `verificationRef` recording the out-of-band credential-verification act itself performed by the owner-role above — never auto-populated, never inferred from a hash, CI pass, or any automated check. |
| **Blocked artifacts/behaviors** | Any review-record signature being treated as backed by a credentialed identity for release purposes; any release-authorization transition (co-gated with G4, see below); the roster containing anything other than synthetic dry-run personas. |
| **Schema-forced-inert mechanism** | `schemas/reviewer-roster.schema.json` requires `verificationRef` whenever `synthetic: false` — a structural schema requirement, not a convention a task could skip. `governance/reviewer-roster.yaml` ships with zero entries (P1-T4). Synthetic entries are marked `synthetic: true` (const-checked where the schema allows) and, per the roster file's own header language, can never satisfy a release-authorization validity check regardless of how many are added. Combined with G4 below, the `unsigned-stub → release-ready` module-status transition stays schema-impossible while the roster is empty or synthetic-only (FR-6). |

---

## G2 — Signing custodian + offline key ceremony

| Field | Content |
|---|---|
| **Gate** | G2 — Signing custodian + offline key ceremony |
| **Owner-role (human)** | The named signing custodian — a human role structurally distinct from the release author/content proposer, per the A2 reconciliation recorded under G0 above. Holds the real Ed25519 signing key offline; never this repository's CI, never an agent, never the person or role who authored or proposed the release content being signed. |
| **Entry criteria** | A named custodian is designated; an offline key-generation/custody ceremony is performed and documented per the signing-ceremony runbook (FR-17); the resulting public key is registered against a `keyId` this program's tooling can reference. No real signing key is ever generated by, or transits through, any automated process this repository runs. |
| **Blocked artifacts/behaviors** | Any real (non-dry-run) `release-manifest`'s `signature` object being populated; any `releases/registry.json` entry's `signature`/`signedAt` fields being populated for a real release; any claim that a release candidate has been cryptographically signed by a real custodian. |
| **Schema-forced-inert mechanism** | `schemas/release-manifest.schema.json`'s ADR-0005 `signature` slot (`{algorithm, keyId, value}`) is `const null` on every real candidate — populated only when the manifest carries the structural dry-run marker, and even then only with a `keyId` matching the `TESTKEY-` prefix (never a real custodian's key). `schemas/release-registry.schema.json` mirrors this: `signature: null` and `signedAt: null` pre-G2, matching the `approvedBy[]`/`clinicalApprovers[]` `maxItems: 0` forced-empty pattern already established elsewhere in this codebase. Raising either ceiling is, per this plan's explicit framing, a defect if it happens outside a real G2 clearance — never a feature, never something a task may do to make a build pass. |

---

## G3 — Data-source SPIKE verdict + data-partner DUA

| Field | Content |
|---|---|
| **Gate** | G3 — Data-source SPIKE verdict + data-partner DUA |
| **Owner-role (human)** | The named human(s) who own the data-source SPIKE's go/no-go verdict (per the SPIKE-006 precedent, an explicit human/orchestrator-directed decision, not an agent-authored recommendation standing alone) and the human(s) authorized to execute a data-use agreement with an external data partner on this program's behalf — per ADR-0006's recommended option 1, an external partner-governed, pre-de-identified dataset under a data-use agreement. |
| **Entry criteria** | Both of the following, independently: (a) the data-source SPIKE charter (FR-25, authored at P4-T9) reaches a recorded, explicit GO/NO-GO verdict on real-data retrospective validation, following the same discipline SPIKE-006 modeled — an honest recommendation that may be uncomfortable, routed through independent review before being treated as final; (b) a data-use agreement is executed with an external data partner supplying already de-identified data, per ADR-0006's decision (no first-party HIPAA environment is assumed or built by this plan; that remains a separate future ADR if ever pursued). |
| **Blocked artifacts/behaviors** | Any real, patient-derived case data entering `tools/retro-validate/`'s harness, this repository, its build outputs, or any `rf` run/writeback; the deferred item DF-E1-09 (real-data retrospective run); any retrospective-validation report being described as reflecting real-world data rather than synthetic/de-identified fixtures. |
| **Schema-forced-inert mechanism** | The retrospective-validation harness structurally rejects any fixture lacking a `synthetic`/de-identified provenance marker — enforced in code and by test (P4-T1/T2), not by convention or reviewer discretion. This is a structural rejection at the harness's input boundary, independent of whether a SPIKE verdict or DUA nominally exists; G3 clearing does not, by itself, flip this rejection off — that would require a further, separately reviewed implementation change this plan does not make (DF-E1-09 is itself a deferred item, gated on G3 clearing *and* protocol thresholds set by named humans, per the plan's deferred-items table). |

---

## G4 — Release authorizer

| Field | Content |
|---|---|
| **Gate** | G4 — Release authorizer |
| **Owner-role (human)** | The authorized clinical and quality/release role named in ADR-0004's minimum-roles table — "Authorized clinical and quality/release roles," the only role whose signed review record may flip a module's status toward release-ready. Distinct from, and not satisfied by, any of the content-review, laboratory-review, or adjudication roles acting alone. |
| **Entry criteria** | A `release-auth` review record (`review_id` pattern `rr-<seq4>-release-auth`) exists, is signed by a roster reviewer (G1-cleared, real, in-scope for the module) with the release-authorization role, and was produced only after clinical review 1, clinical review 2, laboratory review (where applicable), and adjudication (where reviewer 1 and reviewer 2 disagreed) are all complete per ADR-0004's decision. Per ADR-0004 decision item 6, this is the *only* review type that may flip a module's status. |
| **Blocked artifacts/behaviors** | The `unsigned-stub`/`review-pending` → `release-ready` module-status transition (FR-6); any `releases/registry.json` entry being treated as an actual, authorized release rather than a signed-but-not-yet-authorized candidate; any claim that a knowledge-base module is clinically released. |
| **Schema-forced-inert mechanism** | `schemas/module-manifest.schema.json`'s `approvedBy` field is `maxItems: 0` — a populated approver list is a hard schema violation, not merely a test failure — mirroring `schemas/rule.schema.json`'s `clinicalApprovers` field exactly. Combined with G1's empty/synthetic-only roster, the `unsigned-stub → release-ready` transition is schema-impossible pre-G1/G4 (FR-6): there is no schema-legal way, today, to produce a release-record whose reviewer resolves to a real, roster-verified release-authorization identity, because no such roster entry can exist until G1 clears, and no such transition is wired to occur from anything other than a real `release-auth` review record. Raising `maxItems` on `approvedBy` is, per this codebase's standing convention, "the deliberate, reviewable act by which this project would first claim clinical sign-off; it must never be done to make a build pass." |

---

## A1 (binding) — Methodologist/skeptic evidence council is an external upstream dependency, not an in-repo gate or task

Design-spec item `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` § 7.3
item 5 ("Run methodologist/skeptic council with consensus policy") describes an `rf council` pass —
roles `methodologist,skeptic`, consensus vote — that the design spec itself is explicit is **not**,
and cannot substitute for, clinical content review, laboratory review, or adjudication (§5.3: "council
approval confused with clinical release" is a named risk; "`rf council` can block evidence handoff;
cannot approve clinical release"). This registry records that council pass as follows, per the plan's
binding orchestrator adjudication A1:

- The methodologist/skeptic evidence council is an **external upstream `rf`/ARC dependency**,
  produced (if and when it runs) entirely outside this repository, by the `rf` control plane's
  `council` capability — never by an in-repo task, an in-repo agent, or anything this plan builds.
- Routing for this dependency follows the same **RFUP** (Research Foundry Upstream) pattern this
  program already uses for its seven other upstream `rf` enhancement needs
  (`.claude/worknotes/evidence-foundry-buildout/rfup-external-routing-note.md`): a routing note, not
  an in-repo implementation task, tracks the need and its status.
- This plan (Evidence Foundry E1) contains **zero** in-repo tasks that build, simulate, or stand in
  for a methodologist/skeptic council. No task's completion criteria depend on a council pass having
  run, and no artifact this plan produces may describe a council pass (run or not) as clinical
  sign-off, clinical review, or a substitute for G1's named credentialed reviewers or G4's release
  authorizer. Where the design spec's own language is unambiguous, this registry repeats it rather
  than paraphrasing it: council output "provides adversarial evidence review without pretending to be
  clinical signoff."

The methodologist/skeptic council is not itself one of G0–G4 — it is an input a future evidence run
may produce upstream of this program's own gates, tracked as a dependency, never modeled as a sixth
gate this codebase clears.

---

## Cross-references

- Progress tracking mirrors this registry's owner-role, entry-criteria, and blocked-artifact content
  for each gate as an externally-blocked (`blocked-external`, owner=human) state — never as a
  completable task row (`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1/phase-5-integration-docs.md`
  P5-T5). If those two documents ever disagree, this registry is the source of truth; the progress
  file is a copy.
- `scripts/validate-kb.mjs` enforces the schema-forced-inert mechanisms listed above at build/CI time
  (P1-T7); the seeded-violation fixtures under `tests/fixtures/ef-contract-violations/` and
  `tests/ef-contract-forced-empty.test.mjs` prove each mechanism fails closed rather than silently
  passing.
- `CLAUDE.md`'s hard guardrails ("No AI-published rule changes. Rule/KB edits require independent
  clinical review + executable tests + signed release," "No autonomous diagnosis, treatment, dosing,
  or transfusion directives") are the repository-wide restatement of the same posture this registry
  encodes gate-by-gate: every human act this program cannot legitimately take for itself stays an
  external gate, never a task.
