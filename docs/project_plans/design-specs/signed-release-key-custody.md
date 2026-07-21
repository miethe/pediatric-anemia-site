---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry Buildout: Signed Release + Key Custody (DF-E1-06)"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-21
feature_slug: evidence-foundry-buildout
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
problem_statement: "Nothing in the codebase signs, verifies, or custodies keys for a KB release manifest, so a proposal artifact can never legitimately become a clinically released one."
open_questions:
  - "Is the recommended Ed25519 detached-signature scheme (ADR-5 option 1) ratified as-is at E1 planning, or does E1 planning revise the algorithm/custody model before implementation begins?"
  - "Who is the initial single signer/custodian role at E1, and what is the concrete offline/HSM ceremony (device, backup, recovery process) for that one keypair?"
  - "What is the exact key-rotation and compromise-response runbook, and who owns writing it — this design spec, a separate ops doc, or ADR-5 itself if it is revised?"
  - "Does `scripts/validate-kb.mjs` (or a new `scripts/verify-release.mjs`) become the canonical load-time verifier, and does the assessment runtime (`src/engine.js`/`server.mjs`) call it directly or only trust a pre-verified build artifact?"
  - "Does the flat, append-only `releases/registry.json` (or equivalent) live in this repository, or in a separate release-governance repository once more than one module/team is releasing?"
explored_alternatives:
  - "Ed25519 detached signatures over the canonical-serialized manifest bytes already produced by P5-T5, offline/HSM key custody, flat append-only git-tracked registry (ADR-5's recommended default) — lowest new-dependency surface, reuses the existing unsigned-manifest shape and SHA-256 digest, defers registry-service complexity to DF-E2-01."
  - "GPG/PGP detached signatures, web-of-trust or organizational keyring custody, registry embedded in git tags/releases (ADR-5 option 2, rejected as default) — mature tooling but a poor fit for a single-custodian clinical release authority, and harder for the runtime's pre-load check to verify programmatically than one JSON file."
  - "Keyless/transparency-log signing (Sigstore/cosign-style) with an external transparency log as the registry (ADR-5 option 3, rejected for E1) — removes long-lived key custody entirely but introduces a network/OIDC dependency this offline-first, zero-network-at-runtime feature does not otherwise have."
---

# Signed Release + Key Custody (DF-E1-06)

## Problem / Context

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §4.18 specifies a signed
KB release manifest — canonical JSON, content hash, `rfInputs[]` provenance, `approvedBy[]` clinical
sign-off, and a detached `signature` block (`{ algorithm, keyId, value }`) — and states as a hard
runtime rule: "Signing occurs only after canonical serialization. The assessment runtime verifies
signature, content hash, engine compatibility, and expiry before loading; any failure produces 'no
assessment produced.'" `02 §8.5` item 5 lists canonical serialization, signing algorithm, key
custody, and registry together as one of the eight decisions E1 cannot proceed without.

This feature (E0, `evidence-foundry-buildout`) builds only the *unsigned* half of that manifest.
`P5-T1` emits `build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-manifest.unsigned.json` with
`signature.algorithm`/`signature.keyId` as literal placeholder strings, and `P5-T5` proves canonical
serialization is deterministic (byte-identical output across two clean runs against identical
inputs) — but nothing signs those bytes, nothing custodies a key, and nothing verifies a signature
at load time. `ADR-5` (`docs/adr/0005-kb-serialization-signing-key-custody.md`, `status: proposed`)
is the pre-E1 decision record for this exact gap; this spec is the design-shaping continuation of
ADR-5's recommendation, per the deferred-items triage table row: "Signed release + key custody needs
ADR-5's signing/key-custody decision resolved before implementation" (trigger: "ADR-5 accepted").

This is a pre-E1 blocker, not E0 scope: E0 ships a proposal artifact with no release authority
(decisions block §1 — "output is a *proposal*, release authority none"). CLAUDE.md's hard guardrail
"No AI-published rule changes... signed release" is the binding constraint any option here must
satisfy — signing is exactly the step that converts a proposal into a release, and no code produced
by this feature performs it, describes it as performed, or is permitted to.

## Current State (what E0 actually shipped)

- `build/kb-pack/<module_id>/<pack_version>/release-manifest.unsigned.json` (P5-T1): the unsigned
  manifest shape, `signature.algorithm`/`signature.keyId` left as placeholder strings
  (`"<approved-signing-algorithm>"`, `"<release-key-id>"`), `approvedBy: []`.
- `tests/ef-converter-determinism.test.mjs` (P5-T5): proves the canonical-serialization substrate
  this spec's signing layer must sign — sorted keys, normalized newlines, no embedded timestamps in
  hashed content, SHA-256 over the canonical bytes.
- `docs/adr/0005-kb-serialization-signing-key-custody.md` (P6-T5): `status: proposed`, recommends
  (but does not ratify) Ed25519 detached signatures + offline/HSM custody + flat append-only
  registry.
- Nothing signs, verifies, custodies a key, or maintains a release registry anywhere in this
  repository. `modules/anemia/module.json`'s existing `status: "unsigned-stub"` pattern (the same
  placeholder convention `ADR-5` and the `cbc_suite_v1` scaffold both use) is the only precedent for
  the "explicitly unsigned, not silently absent" convention this spec's eventual manifest states must
  preserve.

## Design Sketch

Seeded from ADR-5's recommended default; not yet ratified, so this remains `shaping`, not an
implementation commitment:

1. **Signing algorithm.** Ed25519 detached signature over the SHA-256 digest of the canonical bytes
   P5-T5 already produces (no re-serialization step, no new hash algorithm). `node:crypto`'s native
   Ed25519 support avoids a new runtime dependency, preserving the deterministic/offline converter
   and runtime guardrail.
2. **Key custody.** Offline/HSM-backed custody for a single initial signer/custodian role at E1 (not
   a web-of-trust or multi-signer scheme — ADR-5 rejected GPG's web-of-trust model as a poor fit for
   a single-custodian clinical release authority). Rotation, revocation, and compromise-response are
   manual process, not tooling, until DF-E2-01 exists.
3. **Registry.** A flat, append-only, git-tracked file (e.g. `releases/registry.json`), one entry per
   signed release: version, canonical-bytes digest, signer identity, `supersedes` pointer, withdrawal
   state. Promote to a service only if file-backed proves insufficient at scale (the same pattern
   already used for the traceability graph per `02 §8.3`'s risk table).
4. **Load-time verification.** The assessment runtime (and any build/validate script that currently
   reads `release-manifest.unsigned.json`) recomputes the digest and verifies the Ed25519 signature
   against the registry-recorded key before trusting content; any failure produces "no assessment
   produced," matching `02 §4.18`'s hard runtime rule. `status` flips from `"unsigned-stub"`/
   `"<placeholder>"` to a real signed state only once every required field — digest, signer,
   signature — is populated and verifies.
5. **Manifest shape.** No structural change to `02 §4.18`'s manifest — `signature.algorithm` becomes
   the fixed literal `"ed25519"` and `signature.keyId` an identifier into the registry, rather than
   open placeholders.

None of this is implemented by E0 or committed by this spec; ADR-5 remains `proposed`, and E1
planning must ratify or revise it before any of the above becomes an implementation task.

## Promotion Trigger

ADR-5 accepted (per the deferred-items triage table). E1 implementation planning is the earliest
point this spec's design sketch can become an implementation task — not before.

## Open Questions

See frontmatter `open_questions`. In addition:

- How does this interact with `DF-E2-01` (surveillance/update/registry engine, also seeded from
  ADR-5) and `DF-E2-03` (withdraw/rollback machinery) — is the registry this spec sketches the same
  artifact those two later specs extend, or does registry ownership split between "record a signed
  release" (this spec) and "surveil/roll back a registered release" (DF-E2-01/DF-E2-03)?
- Does the eventual clinical-approval identity/adjudication workflow (`DF-E1-01`, ADR-4) need to be
  resolved before `approvedBy[]` entries in a signed manifest can be considered load-bearing, or can
  this spec's signing layer proceed independently and simply record whatever identity ADR-4 later
  formalizes?

## References

- ADR: `docs/adr/0005-kb-serialization-signing-key-custody.md` (`status: proposed`) — the decision
  record this spec is seeded from.
- Design spec (parent domain): `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md`
  §4.18 (manifest shape), §2.3 invariant 13 (determinism), §8.3 (non-deterministic-serialization
  risk), §8.5 item 5.
- Implementation plan: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`
  Deferred Items Triage Table, row `DF-E1-06`; `phase-3-5-projection-slice-manifest.md` P5-T1
  (unsigned manifest) and P5-T5 (determinism proof).
- CLAUDE.md hard guardrail: "No AI-published rule changes... signed release" and the deterministic/
  offline converter and runtime constraint.
- Related design specs: `docs/project_plans/design-specs/signed-kb-manifest.md` (an earlier,
  `idea`-maturity spec from Platform Foundation P0 covering the same unsigned-manifest gap for the
  single-module `anemia` package; this spec supersedes it in scope for the multi-module Evidence
  Foundry release path, but does not delete or contradict it).
