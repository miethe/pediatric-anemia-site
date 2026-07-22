---
title: "Gates G0–G4 — External Blocked-State Tracking"
type: gates-status
doc_type: reference
status: reference
prd: evidence-foundry-e1
feature_slug: evidence-foundry-e1
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md
task_ref: P5-T5
created: '2026-07-22'
updated: '2026-07-22'
owner: platform-engineering (tracking-file maintenance only — clears no gate)
source_of_truth: docs/governance/gates-registry.md
---

# Gates G0–G4 — External Blocked-State Tracking

**This file is a tracking mirror, not the source of truth.** The authoritative enumeration of every
gate's owner-role, entry criteria, blocked artifacts/behaviors, and schema-forced-inert mechanism is
`docs/governance/gates-registry.md` (authored P1-T6). This file exists only so that progress tracking
under `.claude/progress/evidence-foundry-e1/` can *see* the five gates as externally-blocked states
without ever representing them as work items. **If this file and the registry ever disagree, the
registry wins — update this file to match, not the other way around.**

**Status: unvalidated research prototype.** Nothing below is, or may be read as, clinical validation,
regulatory clearance, or a substitute for a qualified human's judgment.

## Binding rule (restated from the gates registry, applies to every row below)

No gate listed here is a task. No gate is completable by any agent. No task in any phase-progress
file in this directory claims to clear, advance, or partially satisfy a gate, and no phase-completion
record may claim gate progress. Clearing a gate is always an external human act, evidenced by an
artifact this codebase can read (an ADR's `status` field, a roster entry, a signing-ceremony record,
a signed DUA, a signed release-authorization review record) — never one this codebase, or anything
running inside it, can produce, approve, or synthesize on a human's behalf. This mirrors the
`arc-clinical-council-adoption-v1` Phase 5 "owner-blocked" precedent
(`.claude/progress/arc-clinical-council-adoption-v1/phase-5-completion.md`): work that is genuinely
done stays recorded as done; work that only a named human can do stays recorded as blocked on that
human, not silently reframed as agent-completable.

Each entry below carries exactly the fields the P5-T5 acceptance criteria require: `status:
blocked-external`, `owner: human` (plus the specific named role, copied from the registry), `entry
criteria`, and `blocked artifacts/behaviors` — both copied verbatim in substance from the P1-T6 gates
registry, not re-derived.

---

## G0 — ADR ratification

- **status:** `blocked-external`
- **owner:** human — the ratifying authority named in each ADR's own `deciders` frontmatter
  (clinical-governance and platform-engineering leads for ADR-0004; the equivalent named
  platform/clinical-governance leads for ADR-0005 and ADR-0006). Never an agent, never this plan's
  authoring session, never an ARC/`rf`/`council-review` output.
- **entry criteria:** For each of ADR-0004, ADR-0005, and ADR-0006 independently, the ADR's `status`
  frontmatter field changes from `proposed` to `accepted` by an explicit, attributable human
  ratification decision recorded in the ADR file itself. Partial ratification is real — each ADR
  clears G0 on its own, not as a bundle.
- **blocked artifacts/behaviors:** Until an individual ADR clears G0: that ADR's design remains a
  recommendation only ("Recommended default," never "the decision this program has adopted"); no
  downstream artifact may describe the model that ADR proposes as ratified policy. E1's software
  machinery implementing each ADR's recommended default ships regardless of ADR status, but every
  real (non-synthetic) instance of that machinery stays inert via G1/G2/G3's own mechanisms — a
  separate, additional block layered on top of G0, not a substitute for it.
- **carries A2 (binding):** G0's ADR-0005 sub-entry records the SPIKE-006 reconciliation condition
  verbatim — "The signing custodian must be a distinct authority from the release author, and
  CI/agents never hold keys." Full reconciliation text: `docs/governance/gates-registry.md` §G0/A2.
- **registry ref:** `docs/governance/gates-registry.md` §"G0 — ADR ratification"

## G1 — Named credentialed reviewer roster

- **status:** `blocked-external`
- **owner:** human — the named clinical-governance/credentialing role responsible for out-of-band
  credential verification and roster administration, per ADR-0004's minimum-roles table (pediatric
  hematologist/subspecialist for clinical review 1, a second qualified pediatric clinician for
  clinical review 2, laboratory medicine/pathology for laboratory review, a named non-author
  adjudicator, authorized clinical and quality/release roles for release authorization). Never an
  agent, never ARC/`rf`/`council-review` output.
- **entry criteria:** For each real (non-synthetic) reviewer: a `governance/reviewer-roster.yaml`
  entry with `synthetic: false`, a populated `credentialRef`, an assigned `moduleScopes[]`, and a
  populated `verificationRef` recording the out-of-band credential-verification act itself, performed
  by the owner-role above — never auto-populated, never inferred from a hash, CI pass, or any
  automated check.
- **blocked artifacts/behaviors:** Any review-record signature being treated as backed by a
  credentialed identity for release purposes; any release-authorization transition (co-gated with
  G4); the roster containing anything other than synthetic dry-run personas.
- **registry ref:** `docs/governance/gates-registry.md` §"G1 — Named credentialed reviewer roster"

## G2 — Signing custodian + offline key ceremony

- **status:** `blocked-external`
- **owner:** human — the named signing custodian, a role structurally distinct from the release
  author/content proposer per the A2 reconciliation under G0. Holds the real Ed25519 signing key
  offline; never this repository's CI, never an agent, never the person or role who authored or
  proposed the release content being signed.
- **entry criteria:** A named custodian is designated; an offline key-generation/custody ceremony is
  performed and documented per the signing-ceremony runbook (FR-17); the resulting public key is
  registered against a `keyId` this program's tooling can reference. No real signing key is ever
  generated by, or transits through, any automated process this repository runs.
- **blocked artifacts/behaviors:** Any real (non-dry-run) `release-manifest`'s `signature` object
  being populated; any `releases/registry.json` entry's `signature`/`signedAt` fields being populated
  for a real release; any claim that a release candidate has been cryptographically signed by a real
  custodian.
- **registry ref:** `docs/governance/gates-registry.md` §"G2 — Signing custodian + offline key ceremony"

## G3 — Data-source SPIKE verdict + data-partner DUA

- **status:** `blocked-external`
- **owner:** human — the named human(s) who own the data-source SPIKE's go/no-go verdict (per the
  SPIKE-006 precedent, an explicit human/orchestrator-directed decision, not an agent-authored
  recommendation standing alone) and the human(s) authorized to execute a data-use agreement with an
  external data partner on this program's behalf.
- **entry criteria:** Both, independently: (a) the data-source SPIKE charter (FR-25, authored at
  P4-T9) reaches a recorded, explicit GO/NO-GO verdict on real-data retrospective validation; (b) a
  data-use agreement is executed with an external data partner supplying already de-identified data,
  per ADR-0006's decision.
- **blocked artifacts/behaviors:** Any real, patient-derived case data entering
  `tools/retro-validate/`'s harness, this repository, its build outputs, or any `rf` run/writeback;
  the deferred item DF-E1-09 (real-data retrospective run); any retrospective-validation report being
  described as reflecting real-world data rather than synthetic/de-identified fixtures.
- **registry ref:** `docs/governance/gates-registry.md` §"G3 — Data-source SPIKE verdict + data-partner DUA"

## G4 — Release authorizer

- **status:** `blocked-external`
- **owner:** human — the authorized clinical and quality/release role named in ADR-0004's
  minimum-roles table, the only role whose signed review record may flip a module's status toward
  release-ready. Distinct from, and not satisfied by, any of the content-review, laboratory-review,
  or adjudication roles acting alone.
- **entry criteria:** A `release-auth` review record (`review_id` pattern `rr-<seq4>-release-auth`)
  exists, is signed by a roster reviewer (G1-cleared, real, in-scope for the module) with the
  release-authorization role, and was produced only after clinical review 1, clinical review 2,
  laboratory review (where applicable), and adjudication (where reviewer 1 and reviewer 2 disagreed)
  are all complete per ADR-0004's decision.
- **blocked artifacts/behaviors:** The `unsigned-stub`/`review-pending` → `release-ready`
  module-status transition (FR-6); any `releases/registry.json` entry being treated as an actual,
  authorized release rather than a signed-but-not-yet-authorized candidate; any claim that a
  knowledge-base module is clinically released.
- **registry ref:** `docs/governance/gates-registry.md` §"G4 — Release authorizer"

---

## Non-gate cross-reference — A1 (methodologist/skeptic council)

Not one of G0–G4. The methodologist/skeptic evidence council (design-spec §7.3 item 5) is an
**external upstream `rf`/ARC dependency**, tracked via the same RFUP routing pattern as this
program's other upstream `rf` needs — never an in-repo task, never a sixth gate this codebase clears.
Full text: `docs/governance/gates-registry.md` §"A1 (binding)".

---

## Cross-reference summary

| Gate | Status | Owner | Registry section |
|---|---|---|---|
| G0 | `blocked-external` | human (ADR ratifying authority) | `docs/governance/gates-registry.md` §G0 |
| G1 | `blocked-external` | human (credentialing/roster role) | `docs/governance/gates-registry.md` §G1 |
| G2 | `blocked-external` | human (signing custodian) | `docs/governance/gates-registry.md` §G2 |
| G3 | `blocked-external` | human (SPIKE verdict + DUA authority) | `docs/governance/gates-registry.md` §G3 |
| G4 | `blocked-external` | human (release authorizer) | `docs/governance/gates-registry.md` §G4 |

**5/5 gates present as `blocked-external` entries with `owner: human`.** None of these five rows
appears, or may ever be added, as a task row in `phase-1-progress.md` … `phase-5-progress.md`, any
`phase-N-completion.md` note, or any future progress file under this directory. `docs/governance/
gates-registry.md` is the canonical source these entries copy from; this file is the copy, not the
other way around.
