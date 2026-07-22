---
title: "AOS to ARC invocation contract (identifier-only)"
description: "How the Agentic OS dispatches a pediatric ARC council review, and the exact field set it may and may not carry."
audience: [project-agents, platform-engineering, clinical-governance, evidence-governance]
tags: [pediatric-cds, arc, aos, correlation, identifier-only, clinical-safety]
created: 2026-07-19
updated: 2026-07-21
status: contract
---

# AOS to ARC invocation contract (identifier-only)

Companion to [`03-arc-clinical-council-handoff.md`](03-arc-clinical-council-handoff.md).
Implements P1-T4 of
[`../implementation_plans/enhancements/arc-clinical-council-adoption-v1.md`](../implementation_plans/enhancements/arc-clinical-council-adoption-v1.md)
against ARC ADR-0004 (`repo:agentic-research/docs/dev/architecture/adr-0004-portable-target-resolution.md`),
decisions D5 and D6.

## The rule in one sentence

When the Agentic OS (`agentic_meta_dev`) dispatches or observes a pediatric ARC
council review, **every field it carries in either direction is an identifier** —
a name, a version, a UUID, a locator, or a digest — and **never a body**.

AOS is a dispatcher and a correlation ledger. It is not an evidence channel, not
a clinical channel, and not an approval channel. Correlation is provenance; it
carries no clinical authority and confers no delivery state.

## Permitted field set (exhaustive)

AOS may carry only the fields below. Anything not on this list is not permitted
by default — see "Unknown fields" for the required behavior.

### Inbound (AOS to ARC, at dispatch)

| Field | Form | Notes |
|---|---|---|
| `council` | Council name | `pediatric-anemia-clinical-review-council`. Version is resolved by ARC from the council definition, not asserted by AOS. |
| `target` | `repo:<alias>/<relative-path>` | Portable locator only. Never a filesystem path, absolute or relative-to-anything-but-a-registered-root. |
| `target_artifact_class` | `repository_artifact` \| `synthetic_scenario_specification` | The only two executable classes. `unclassified` and `clinical_record_body` are structurally rejected by ARC's RunSpec schema. |
| `target_sha256` | 64 hex chars | Optional caller pin. ARC fails closed on mismatch. |
| `evidence_source_manifest` | ARC-repo-relative path | Metadata-only manifest path. Never manifest contents. |
| `evidence_source_manifest_sha256` | 64 hex chars | Digest binding only. |
| `objective`, `constraints`, `slug` | Short bounded text / string list | Review framing. Must contain no patient-directed text; ARC rejects patient-directed objectives even when `non_patient_artifact_confirmed=true`. |
| `parameters.non_patient_artifact_confirmed` | `true` | Required by the pediatric council. |
| `parameters.target_artifact_class` | as above | Must match `target_artifact_class` or ARC fails closed. |
| `aos_run_uuid`, `aos_session_uuid`, `aos_turn_uuid`, `aos_feature_uuid`, `aos_trace_uuid` | UUID | Correlation only. |

The approved-roots registry that resolves `repo:<alias>/...` is **operator-local
configuration on the machine running `arc`**. AOS never sends it, never reads it,
and never sends a root path in any form. This is what keeps the locator portable
and absolute-path-free.

**`authority_attachments` and `local_profiles`** — RunSpec fields added by ARC's P2/P3 authority and
local-profile work (ADR-0005/ADR-0006), after this contract was first authored — are deliberately
absent from the permitted set above, not an oversight verified stale at P7-T2. Both are arrays of
*paths* to owner-signed authority/profile record files (`EvidenceRightsReceipt`,
`CredentialedApprovalAttachment`, `LocalProfileAssertion`) that `arc` resolves and copies into the run
directory at scaffold time; ARC verifies and references these records but never mints them. They fall
under two prohibitions already stated below — "Approval bodies" (item 5) and "Absolute filesystem
paths, machine-local paths" (item 6) — for the same reason the approved-roots registry itself is never
sent: they identify owner-held authority material that lives on the operator's own machine. If a future
ARC or adapter change makes these fields carry pure repository-relative, non-authority-bearing
locators, that is a reviewed change to this contract and to ARC ADR-0004 D6, per "Unknown fields"
below — never a default inclusion.

### Outbound (ARC to AOS, as correlation)

ARC writes exactly this structure into `run_manifest.yaml`
`metadata.aos_correlation`; it is the complete set AOS may read back:

```yaml
status: unresolved
ids:
  aos_run_uuid: 3f2b1c8e-5d4a-4f6b-9c2e-1a7d8e0b3c45
  aos_session_uuid: 8c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f
aliases:
  arc_run_id: arc-run-2026-07-19-pediatric-local-profile-charter-contract
  arc_trace_id: trace-arc-run-2026-07-19-pediatric-local-profile-charter-contract
  arc_council: pediatric-anemia-clinical-review-council@0.1.0
  arc_reviewers: [pediatric-hematology-reviewer, ...]
  arc_target_locator: repo:pediatric-anemia-site/docs/clinical/local-profile-charter-contract.md
  arc_target_sha256: 96991fffa9eef772c486444244850d514b2015b2dbee10641bd96ad221320192
```

Every value above is a name, a UUID, a locator, or a digest. `arc_reviewers` is a
list of role names, not reviewer output. `status: unresolved` is a correlation
state, never a review verdict.

## Prohibited — AOS must never carry any of these

This list is explicit and non-negotiable. It applies to dispatch payloads,
correlation records, event streams, logs, retries, and error messages, in both
directions:

1. **Target bodies.** No file contents, no excerpt, no diff, no snippet of the
   reviewed artifact. The locator plus the digest is the entire identity.
2. **Evidence bodies.** No source full text, figures, tables, abstracts, or
   paywalled standards text; no evidence-manifest contents. Only the manifest
   path and its digest.
3. **Clinical findings.** No findings, no scorecard, no recommendation, no
   dissent, no abstention, no severity, no risk-register content, no validation
   plan text, no decision-record text. Read those from the ARC run directory.
4. **PHI, patient records, and patient-derived values.** None, in any field,
   synthetic-looking or not. No patient-directed requests.
5. **Approval bodies.** No credentialed-approver identity, signature, attestation,
   rights receipt, certification content, or release authorization. AOS cannot
   transport an approval and cannot represent one.
6. **Absolute filesystem paths**, machine-local paths, registry contents, root
   paths, secrets, credentials, or tokens.
7. **Any inference derived from the above** — a summary, a count of high-severity
   findings, a pass/fail flag, or a "looks safe" signal is a clinical finding in
   compressed form and is equally prohibited.

If a workflow appears to need one of these in AOS, the workflow is wrong: read
the artifact from the ARC run directory identified by `arc_run_id`.

## Unknown fields: fail closed, do not forward

When AOS encounters a field it does not recognize — in a dispatch request, a
correlation record, a callback, or an event — it **must fail closed**:

1. **Reject the operation.** Do not dispatch, do not record, do not emit.
2. **Do not forward the field** to ARC, to a provider, to a log sink, to a trace,
   or to another AOS subsystem — not even "pass-through" or "opaque blob"
   forwarding. An unrecognized field may be a body, and a forwarded body is a
   leak whether or not AOS understood it.
3. **Do not strip and continue.** Silently dropping the field hides a contract
   drift that a human must see. Stripping is not an approved recovery.
4. **Do not echo the field's value** in the error. Name the field key only.
5. **Surface it to a human** as a contract-drift condition. Widening the
   permitted set is a reviewed change to this document and to ARC ADR-0004 D6 —
   never a runtime decision, and never an agent's decision.

The same rule applies to a recognized field carrying an unrecognized *shape*
(for example a `target` that is not `repo:<alias>/<relative-path>`, or a digest
that is not 64 hex characters). Unknown never upgrades to permitted.

## Dispatch shape

The AOS ARC adapter (`repo:agentic_meta_dev/src/operator_core/adapters/arc.py`)
invokes ARC with the portable locator and never a filesystem path:

```bash
arc run --spec <runspec-path> \
  --aos-run-uuid <uuid> \
  --aos-session-uuid <uuid>
```

or, field-by-field:

```bash
arc run \
  --council pediatric-anemia-clinical-review-council \
  --target repo:pediatric-anemia-site/<relative-path> \
  --target-artifact-class repository_artifact \
  --target-sha256 <64-hex> \
  --evidence-source-manifest knowledge-packs/pediatric-anemia/source-manifest.yaml \
  --evidence-source-manifest-sha256 <64-hex> \
  --param non_patient_artifact_confirmed=true \
  --param target_artifact_class=repository_artifact \
  --aos-run-uuid <uuid>
```

The canonical RunSpecs live in this repository at
[`examples/arc-runspecs/`](../../../examples/arc-runspecs/); prefer `--spec` over
assembling flags, so the reviewed spec file is the thing dispatched.

## What AOS dispatch does not establish

- It does not execute reviewers. `arc run` creates an empty skeleton.
- It does not make a run qualifying, credentialed, validated, certified, or
  releasable. See the delivery-state table in the handoff.
- It does not grant ARC any authority it does not already have, and it does not
  let ARC borrow authority from AOS.
- A resolved locator and a matching digest prove **structural identity only** —
  never clinical validity, rights permission, or approval.
