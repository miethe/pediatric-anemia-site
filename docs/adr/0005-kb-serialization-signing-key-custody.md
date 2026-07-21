# ADR-5: KB canonical serialization, signing algorithm, key custody, and registry

**Status**: proposed | **Date**: 2026-07-21 | **Author**: documentation-writer (evidence-foundry-buildout, Phase 6)

## Problem

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §4.18 specifies a signed KB
release manifest — canonical JSON, content hash, `rfInputs[]` provenance, `approvedBy[]` clinical
sign-off, and a detached `signature` block (`{ algorithm, keyId, value }`) — and states as a hard
runtime rule (02 §4.18, restated): "Signing occurs only after canonical serialization. The assessment
runtime verifies signature, content hash, engine compatibility, and expiry before loading; any failure
produces 'no assessment produced.'" 02 §8.5 item 5 lists this exact bundle of concerns — canonical
serialization, signing algorithm, key custody, and registry — as one of the eight decisions E1 cannot
proceed without.

E0 (this feature) builds the *unsigned* half of that manifest only. `P5-T5` (Determinism double-run
proof, `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md`)
implements canonical serialization for `build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-manifest.unsigned.json`
and every other converter-emitted artifact: sorted keys, normalized newlines, no embedded timestamps
in hashed content, SHA-256 over the canonical bytes, and a test (`tests/ef-converter-determinism.test.mjs`)
proving two clean `propose` runs against byte-identical inputs produce byte-identical output for every
emitted file. That work is the substrate this ADR builds on — it establishes *what bytes get hashed and
signed*, not *how the hash gets signed, by whom, or with what key*. Those three questions — signing
algorithm, key custody, and a release registry to check signatures/withdrawals against — are undecided,
and 02 §4.18's manifest literally leaves the `signature.algorithm` and `signature.keyId` fields as
placeholders (`"<approved-signing-algorithm>"`, `"<release-key-id>"`).

This is a pre-E1 blocker, not an E0 task: E0 ships a proposal artifact with no release authority
(decisions block §1 — "output is a *proposal*, release authority none"); nothing produced by this
feature is signed, and nothing is described as clinically released (`no invented thresholds` /
`no autonomous... treatment` guardrails aside, the separate hard rule here is CLAUDE.md's "no AI-published
rule changes... signed release" language — signing is exactly the step that converts a proposal into a
release, and this feature does not perform it).

## Decision

**Recommended default: asymmetric detached-signature scheme (Ed25519) over the canonical-serialized
manifest bytes P5-T5 already produces, with keys held in an offline/HSM-backed custody model and a
flat, append-only, git-tracked release registry file as the E1 starting point** (promote to a service
only if file-backed proves insufficient at scale, matching the "promote to service only after
file-backed E1 proves need" pattern already used for the traceability graph, 02 §8.3 risk table).
This ADR does not accept this recommendation — it stays `proposed`; E1 planning must ratify or revise
it.

### Considered Alternatives

1. **Ed25519 detached signatures, offline/HSM key custody, flat append-only registry (recommended default)**
   - Pros: small, fast, widely supported (Node `node:crypto` has native Ed25519 support, no new
     runtime dependency); deterministic detached signatures pair naturally with P5-T5's canonical
     bytes (sign the same SHA-256 digest already computed, no re-serialization step); a flat
     registry file (`releases/registry.json` or similar, one entry per signed release: version,
     digest, signer, supersedes, withdrawal state) is inspectable, diffable, and git-history-audited
     without a database.
   - Cons: key custody discipline (rotation, revocation, HSM/offline-signing ceremony) is fully
     manual process, not tooling, until E2's registry/surveillance engine (DF-E2-01) exists; a flat
     file does not scale past a handful of releases per year without index tooling.
   - Decision: **recommended** — lowest new-dependency surface, directly compatible with the
     existing unsigned-manifest shape, and defers registry-service complexity to when DF-E2-01
     actually needs it.

2. **GPG/PGP detached signatures, web-of-trust or organizational keyring custody, registry embedded in git tags/releases**
   - Pros: mature tooling, widely understood by ops/security reviewers, integrates with existing
     git release conventions (signed tags) with no new artifact format.
   - Cons: GPG key management is heavier and more error-prone in practice than a single Ed25519
     keypair; web-of-trust model is a poor fit for a single-custodian clinical release authority
     (there is exactly one signer role at E1, not a trust network); embedding registry state in git
     tags makes programmatic verification (the runtime's pre-load signature check) harder than
     reading one JSON file.
   - Decision: rejected as the default — solves a trust-network problem this feature does not have,
     at higher operational cost than Ed25519.

3. **Keyless/transparency-log signing (Sigstore/cosign-style), external transparency log as the registry**
   - Pros: no long-lived private key to custody at all (short-lived keys bound to an OIDC identity);
     a public transparency log gives free tamper-evidence and audit trail; increasingly standard for
     software-supply-chain signing.
   - Cons: introduces an external dependency (transparency log service, OIDC identity provider) this
     offline-first, zero-network-at-runtime feature does not otherwise have (CLAUDE.md guardrail:
     the assessment runtime and converter are deterministic and offline); a public transparency log
     is a poor fit for a clinical-content release whose reviewer identities and approval metadata may
     not be intended for public disclosure by default.
   - Decision: rejected for E1 — reconsider only if a later increment explicitly adopts an
     internet-connected release/distribution pipeline (out of scope through E2 per 02 §7).

## Rationale

- P5-T5's canonical serialization is the load-bearing substrate: signing anything other than the
  exact canonical bytes already hashed for `release-manifest.unsigned.json` would silently reopen the
  "non-deterministic serialization" risk 02 §8.3 already names ("Same content gets new hash/signature").
  This ADR's signing-layer decision therefore composes on top of, and must never duplicate or diverge
  from, P5-T5's canonical-serialization implementation.
- Key custody and signing-algorithm choice are irreducibly human/process decisions (who holds the
  key, how rotation and compromise response work) — no option here is software the converter can
  build for itself; all three alternatives are equally "no code change to the deterministic converter,"
  which is why this is an ADR and not an E0 task.
- A registry is required before DF-E2-01 (surveillance/update/registry engine) or DF-E2-03
  (withdraw/rollback machinery) can be designed: both need something to register signed releases
  into and check state against. This ADR's registry-shape recommendation is the seed those two
  deferred items build on.

## Consequences

### Positive
- E1 can proceed straight to implementing the recommended Ed25519 + flat-registry design without a
  second architectural debate, unless E1 planning explicitly revises this ADR.
- The recommended design imposes zero new runtime dependency and zero new network call, preserving
  the "deterministic and offline" converter/runtime guardrail into the signing layer.
- The manifest shape in 02 §4.18 needs no structural change — `signature.algorithm` becomes a fixed
  literal (`"ed25519"`) and `signature.keyId` an identifier into the recommended registry, rather than
  open placeholders.

### Negative
- Manual key-custody process (HSM/offline ceremony, rotation, compromise response) is unimplemented
  and unspecified beyond this ADR's recommendation — it is real E1 scope, not free.
- A flat file registry does not scale indefinitely; DF-E2-01's registry engine is the point at which
  this ADR's file-backed default should be revisited, not before.

### Neutral
- Choosing Ed25519 over GPG/Sigstore is reversible before any release is actually signed — no
  production signature exists yet under any scheme, so switching costs before E1 implementation are
  low.

## Implementation

Not applicable at `proposed` status — no immediate actions are authorized by this ADR. Acceptance
(a future decision, not part of this feature) would trigger DF-E1-06 and DF-E2-01 implementation
planning.

## Deferred Items Unblocked

This ADR is the design input the deferred-items triage table (`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`
§ Deferred Items & In-Flight Findings Policy) names explicitly:

- **DF-E1-06** — Signed release + key custody: blocked on this ADR's signing/key-custody decision
  being `accepted` (triage table: "Signed release + key custody needs ADR-5's signing/key-custody
  decision resolved before implementation"). The corresponding design-spec stub
  (`docs/project_plans/design-specs/signed-release-key-custody.md`, authored in Phase 7 `P7-T8`) is
  seeded from this ADR's recommendation.
- **DF-E2-01** — Surveillance/update/registry engine: needs a signed-release registry to exist before
  it can surveil or re-run against anything (triage table: "needs a signed, registered E1 release to
  surveil and re-run against"). This ADR's flat-registry recommendation is the seed for the
  corresponding design-spec stub (`docs/project_plans/design-specs/surveillance-update-registry-engine.md`,
  `P7-T10`).

## References

- Design spec: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §4.18 (manifest
  shape), §2.3 invariant 13 (determinism), §8.3 (non-deterministic-serialization risk), §8.5 item 5.
- Implementation plan: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md`
  P5-T1 (`release-manifest.unsigned.json` + schema), P5-T5 (determinism double-run proof — the
  canonical-serialization substrate this ADR builds the signing layer on top of).
- Deferred items: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`
  Deferred Items Triage Table, rows DF-E1-06 and DF-E2-01.
- CLAUDE.md hard guardrail: "No AI-published rule changes... signed release" and the deterministic/
  offline converter constraint.

## Metadata

- **Author**: documentation-writer (evidence-foundry-buildout Phase 6, task P6-T5)
- **Reviewers**: pending (this ADR is `proposed`, not reviewed/accepted)
- **Epic/Story**: `evidence-foundry-buildout` Phase 6 (Pre-E1 ADRs)
- **Affected Components**: `build/kb-pack/<module_id>/<pack_version>/release-manifest.unsigned.json`
  (P5-T1 output, unaffected by this ADR at `proposed`), future E1 signing tooling, future E2
  surveillance/registry engine
- **Risk Level**: Medium (signing/custody is a governance-critical decision, but zero production
  signature exists yet, so the cost of revising this ADR before acceptance is low)
