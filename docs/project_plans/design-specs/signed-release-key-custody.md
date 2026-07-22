---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry Buildout: Signed Release + Key Custody (DF-E1-06)"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-22
feature_slug: evidence-foundry-e1
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md
problem_statement: "E1 now ships the deterministic sign/verify/register machinery and a fail-closed exit-code taxonomy, but nothing in this codebase — and no task any agent can perform — designates a real signing custodian, runs an offline key ceremony, or ratifies ADR-0005. A proposal artifact still cannot legitimately become a clinically released one; only the software substrate that a future real signature would run through now exists."
open_questions:
  - "RESOLVED (E1, P3-T1/T2): Ed25519 detached-signature scheme is what E1's tooling implements as the sole supported algorithm (`tools/release-sign/lib/sign.mjs` hard-rejects any non-Ed25519 key) — but this remains E1's *software default*, not ADR-0005 ratification; G0 (ADR-0005 `status: accepted`) is still outstanding and is the act that would make this the program's adopted policy rather than its recommended one."
  - "OPEN — unchanged since E0: who is the initial named signing custodian at E1/E2, and what concrete offline/HSM ceremony (device, backup, recovery process) do they actually execute? `docs/governance/signing-ceremony-runbook.md` (P3-T7) now specifies the procedure a custodian would follow; it does not, and cannot, name that human or perform the ceremony — that is gate G2, an external human act."
  - "RESOLVED (E1, P3-T7): the key-rotation and compromise-response runbook is `docs/governance/signing-ceremony-runbook.md` §5–§6, owned by a named `platform-engineering` runbook-maintainer role whose responsibilities are explicitly bounded (keeps the procedure current; never clears G2; never names or removes a custodian)."
  - "RESOLVED (E1, P3-T3/P3-T6): the canonical load-time verifier is `tools/release-sign`'s `verify` verb — the sole CI/agent-reachable surface of the tool (ruling R3) — and `npm run validate` now joins its structural (non-cryptographic) checks. Still open: whether `src/engine.js`/`server.mjs` will one day call `verify` directly at runtime load time, or only ever trust a pre-verified build artifact — no runtime code path does either today; `verify` is a build/CI-time check only in E1."
  - "RESOLVED (E1, P3-T4): the flat, append-only `releases/registry.json` (root-level, git-tracked, `schemas/release-registry.schema.json`) lives in this repository for E1 — the separate-release-governance-repo alternative was not adopted. Still open: whether that remains true once more than one module/team is releasing, or once DF-E2-01's surveillance/registry engine exists."
  - "NEW (E1): does the registry this spec's `register` verb writes to remain the single artifact `DF-E2-01` (surveillance/update/registry engine) and `DF-E2-03` (withdraw/rollback machinery) extend in place, or does either later spec introduce a second, separate registry? `docs/project_plans/design-specs/withdraw-rollback-machinery.md` (updated alongside this spec, P5-T7) currently assumes extension-in-place of this same file."
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

E0 (`evidence-foundry-buildout`) built only the *unsigned* half of that manifest — `P5-T1` emitting
`build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-manifest.unsigned.json` with
`signature.algorithm`/`signature.keyId` as literal placeholder strings, and `P5-T5` proving canonical
serialization deterministic. E1 (`evidence-foundry-e1`, this plan) closed most of that gap: it ships
the full sign/register/verify software machinery downstream of E0's unsigned manifest, a documented
5-class fail-closed exit-code taxonomy (FR-13), a human-executed signing-ceremony runbook (FR-17),
and a registry seed (OQ-4/FR-14) — see "What E1 Actually Shipped" below. What E1 does **not**, and
structurally cannot, ship is a real signature: `ADR-0005`
(`docs/adr/0005-kb-serialization-signing-key-custody.md`, `status: proposed`) — the decision record
this spec continues to shape — remains unratified, and no named human signing custodian has run the
offline key ceremony this spec's design sketch describes. CLAUDE.md's hard guardrail "No AI-published
rule changes... signed release" is the binding constraint every option here must satisfy — signing is
exactly the step that converts a proposal into a release, and no task in E0 or E1 performs it,
describes it as performed, or is permitted to.

## What E1 Actually Shipped

**Tool: `tools/release-sign`** (`tools/release-sign/README.md`, `tools/release-sign/cli.mjs`) — a
verb-dispatch CLI following the E0 `tools/<name>/cli.mjs` convention, `node:crypto` only, zero new
crypto dependencies, zero network calls, no LLM/generative-model path (decisions block Risk 6). Four
verbs, all implemented:

- `manifest` (P3-T1) — reads back the exact canonical bytes E0's `rf-bundle-to-kb-pack propose`
  already wrote and reports their SHA-256 signing preimage; never re-serializes or re-derives the
  manifest itself (the "never re-implement E0's canonicalization" contract).
- `sign` (P3-T2) — a detached Ed25519 signature over that preimage, with two structurally separate
  modes that are never blurred: `--dry-run` (OQ-6's ephemeral, in-memory-only keypair, `TESTKEY-`
  -forced `keyId`, private key discarded before the call returns — the **only** mode any automated
  check, test, or CI job may ever invoke) and real mode (human offline execution only, at gate G2's
  ceremony; hard-guarded so no automated check ever completes a real signature — `--key`/`--key-id`
  both required with no default, `--key-id` may never carry `TESTKEY-`, `--key` must resolve outside
  this repository's tree).
- `register` (P3-T4) — appends a release candidate to the append-only `releases/registry.json`
  (schema `schemas/release-registry.schema.json`, seed file `{"schemaVersion": 1, "entries": []}`),
  re-deriving `moduleId`/`packDigest`/`manifestDigest` from a fresh disk read rather than trusting
  the candidate document, and rejecting (by distinctly named error class) a non-dry-run candidate
  carrying a populated signature, a duplicate moduleId/version entry, or any mutation/removal of an
  existing entry (two-layer in-process + git-history append-only check).
- `verify` (P3-T3) — the **sole CI/agent-reachable surface** of this tool (ruling R3: CI can never
  sign); imports only read-only `node:crypto` primitives (`verify`/`createPublicKey`, never a signing
  primitive); produces zero stdout output on any non-zero exit. `npm run validate` now joins this
  tool's structural (non-cryptographic) checks (P3-T6).

**Exit-code taxonomy** (`tools/release-sign/README.md` § "Exit codes", FR-13) — the canonical,
complete contract for every verb, not only `verify`: `0` OK, `1` USAGE (malformed invocation across
all four verbs, including `manifest`'s golden-bytes-drift guard and every `register`-verb failure
class), and `verify`'s own five documented classes `2`–`6` (`BYTE_DRIFT`, `DIGEST_MISMATCH`,
`UNKNOWN_KEYID`, `REGISTRY_INCONSISTENCY`, `TESTKEY_ON_REAL`), plus two P3-laundering-fix classes `7`
`NESTED_MANIFEST_INVALID` and `8` `WRAPPER_MANIFEST_MISMATCH`. `cli.mjs`'s top-level catch forwards a
thrown error's own `exitCode` verbatim — no remapping. `tests/ef-release-sign-verify.test.mjs` proves
the zero-stdout-on-failure property per failure class, not just narratively.

**Runbook**: `docs/governance/signing-ceremony-runbook.md` (P3-T7) — a document deliverable, not a
performed ceremony. It specifies the procedure a named human signing custodian would follow (offline
key generation, taking custody, assigning a `keyId`, dry-run rehearsal, real signing, handing back the
signed candidate, registering, verifying), the rotation and compromise-response processes, and
restates G2's entry criteria as a checklist. Its own opening banner states plainly: "no signature
produced by following it... is or may be read as clinical validation... it confers no clinical
standing whatsoever." No task in E1 executes any step in it against a real key or a real candidate.

**Dry-run posture** (OQ-6, resolved) — the only manual signing path anywhere in this codebase is
`sign --dry-run`: ephemeral in-memory keypair generation, a structurally forced `TESTKEY-` `keyId`
prefix, and private-key discard before the call returns. No persistent test-key files, no
key-bearing CLI flag exists for real use, nothing for CI or an agent to hold. `tests/ef-release-no-keys.test.mjs`
(P3-T5) independently asserts no private-key material exists anywhere in this repository's tree and
that no automated check, script, or CLI default reads a signing key from the repo or an environment
variable.

**Registry seed** (OQ-4/FR-14) — `releases/registry.json` ships as the seed file
`{"schemaVersion": 1, "entries": []}`; `schemas/release-registry.schema.json` binds each future entry
to exactly ten fields (`version`, `moduleId`, `packDigest`, `manifestDigest`, `signature`, `signedAt`,
`supersedes`, `withdrawalState`, `withdrawnAt`, `withdrawalReason`), `additionalProperties: false`,
with `signature`/`signedAt`/`supersedes`/`withdrawnAt`/`withdrawalReason` typed `null` and
`withdrawalState` `const: "none"` under this schema version — no E1 code path can populate any of
them with a real value. See `docs/project_plans/design-specs/withdraw-rollback-machinery.md` (updated
alongside this spec) for the DF-E2-03 boundary this seed sets up.

## What Stays Gated (G0 + G2, per the A2 reconciliation)

Nothing above converts a proposal into a release. Two external human gates, both recorded in
`docs/governance/gates-registry.md`, remain fully outstanding and are never clearable by any task or
agent:

- **G0 — ADR-0005 ratification.** `docs/adr/0005-kb-serialization-signing-key-custody.md` is
  `status: proposed`. Until a named ratifying authority (per the ADR's own `deciders` frontmatter)
  flips that field to `accepted` in the ADR file itself, the Ed25519/offline-custody/flat-registry
  design this spec and `tools/release-sign` implement remains this program's *recommended default*,
  never "the decision this program has adopted" (gates registry § G0 verbatim). No task in this plan,
  and no script this plan ships, ever writes `status: accepted` into the ADR.
- **G2 — Signing custodian + offline key ceremony.** Bound by the **A2 reconciliation**, recorded
  under G0's ADR-0005 sub-entry and restated verbatim in the runbook's § 7: *"The signing custodian
  must be a distinct authority from the release author, and CI/agents never hold keys."* This is the
  direct fix for SPIKE-006's RQ1/RQ6 NO-GO finding (a single account authoring content, running CI,
  and holding the signing key is not a valid custody arrangement) and Amendment 2's rejection of
  server-only signing on the same collapse. G2 clears only when: a named custodian is designated,
  distinct from the release author; neither this repository's CI nor any agent ever holds, generates
  for persistent use, or has access to the real key; an offline key-generation/custody ceremony is
  performed and documented per the runbook's § 4; and the resulting public key is registered against a
  `keyId` this program's tooling can reference.

**Schema-forced-inert mechanism, unchanged by anything E1 shipped**:
`schemas/release-manifest.schema.json`'s `signature` slot is `const null` on every real candidate —
populated only when the manifest carries the structural dry-run marker, and even then only with a
`TESTKEY-`-prefixed `keyId`. `schemas/release-registry.schema.json` mirrors this: `signature: null`
and `signedAt: null` pre-G2, matching the `approvedBy[]`/`clinicalApprovers[]` `maxItems: 0`
forced-empty pattern already established elsewhere in this codebase. Raising either ceiling outside a
real G2 clearance is, per this plan's explicit framing, a defect — never a feature, never something a
task may do to make a build pass.

## Promotion Trigger

Unchanged in kind, restated more precisely now that the machinery exists to promote *into*: **G0
(ADR-0005 accepted) AND G2 (a named custodian designated, distinct from the release author, and an
offline key ceremony performed per the runbook)**, both independently and both required — G0 alone
ratifies the design; G2 alone, without ratification, would still be signing under an unaccepted
policy. Only once both clear does "produce a real signed release" become an implementation task this
spec's design sketch could authorize; nothing in E1 performs, simulates, or is permitted to shortcut
either.

## Open Questions

See frontmatter `open_questions` (most of E0's original list is now resolved by what E1 shipped; the
custodian-identity and rotation-cadence questions remain genuinely open, gated on G0/G2). In addition:

- How does this interact with `DF-E2-01` (surveillance/update/registry engine, also seeded from
  ADR-0005) and `DF-E2-03` (withdraw/rollback machinery) — is `releases/registry.json`, as E1 ships
  it, the same artifact those two later specs extend in place, or does either introduce a second,
  separate registry? (E1's own `register` verb and `withdraw-rollback-machinery.md`'s current design
  sketch both assume extension-in-place of this one file; neither is implemented.)
- Does the eventual clinical-approval identity/adjudication workflow (`DF-E1-01`, ADR-0004) need to be
  resolved before `approvedBy[]` entries in a signed manifest can be considered load-bearing, or can
  this spec's signing layer proceed independently and simply record whatever identity ADR-0004 later
  formalizes?

## References

- ADR: `docs/adr/0005-kb-serialization-signing-key-custody.md` (`status: proposed`) — the decision
  record this spec is seeded from; G0's ADR-0005 sub-entry carries the binding A2 reconciliation.
- Gates registry: `docs/governance/gates-registry.md` § G0 (incl. A2 reconciliation) and § G2 — the
  authoritative source for the gated boundary restated above.
- Tool: `tools/release-sign/README.md` — module boundary, verb usage, exit-code taxonomy (the
  machinery this spec describes as shipped).
- Runbook: `docs/governance/signing-ceremony-runbook.md` (P3-T7) — the human-executed ceremony
  procedure and G2 checklist.
- Design spec (parent domain): `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md`
  §4.18 (manifest shape), §2.3 invariant 13 (determinism), §8.3 (non-deterministic-serialization
  risk), §8.5 item 5.
- Implementation plan: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md`
  Deferred Items Triage Table, row `DF-E1-06`; External Human Gates section (A2 adjudication); Phase 1
  (`phase-1-contracts-gates.md`, P1-T5 schema, P1-T6 gates registry), Phase 3
  (`phase-2-4-workstreams.md`, P3-T1..T7).
- CLAUDE.md hard guardrail: "No AI-published rule changes... signed release" and the deterministic/
  offline converter and runtime constraint.
- Related design specs: `docs/project_plans/design-specs/signed-kb-manifest.md` (an earlier,
  `idea`-maturity spec from Platform Foundation P0 covering the same unsigned-manifest gap for the
  single-module `anemia` package; this spec supersedes it in scope for the multi-module Evidence
  Foundry release path, but does not delete or contradict it); `docs/project_plans/design-specs/withdraw-rollback-machinery.md`
  (`DF-E2-03`, updated alongside this spec — extends the registry seed this spec describes).
