---
title: "Signing-Ceremony Runbook — Offline Key Generation, Custody, Signing, Rotation, Compromise Response"
status: "draft — recommended procedure; not binding until ADR-0005 clears G0 (see Status note below)"
date: 2026-07-22
owner: platform-engineering (runbook maintenance only — clears no gate; see Ownership Model)
source_refs:
  - "docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md (FR-17)"
  - "docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md § External Human Gates (rulings R2/R3/R4, adjudications A1/A2)"
  - "docs/adr/0005-kb-serialization-signing-key-custody.md"
  - "docs/governance/gates-registry.md (G2 row + A2 reconciliation)"
  - "docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md"
  - "tools/release-sign/README.md"
  - "governance/reviewer-roster.yaml (G1 precedent for the same 'synthetic can never satisfy the real gate' pattern)"
---

# Signing-Ceremony Runbook

**Status: unvalidated research prototype.** Nothing in this runbook, and no signature produced by
following it, is or may be read as clinical validation, regulatory clearance, safety certification,
or a substitute for a qualified human's clinical judgment. A valid Ed25519 signature over a release
manifest attests only that the named signing custodian, acting under the custody model below, signed
the exact canonical bytes recorded — it confers **no clinical standing whatsoever** on the content
those bytes describe. Clinical release authorization is a separate act, gate **G4**, performed by a
separate role (`docs/governance/gates-registry.md`), never implied by a signature alone.

## What this document is, and is not

This is a **document deliverable only** — the FR-17 requirement this task (P3-T7) satisfies. It
specifies a procedure a human signing custodian would follow. **It does not perform, simulate, or
stand in for the ceremony it describes.** The ceremony itself — a named custodian actually generating
an offline key, actually taking custody of it, and actually signing a real release candidate with it —
is gate **G2** (`docs/governance/gates-registry.md` § G2), an external human act this codebase, this
plan, and no task or agent running inside either can clear. No task in Evidence Foundry E1 executes
any step in this runbook against a real key or a real release candidate; every automated check that
touches `tools/release-sign`'s `sign` verb invokes it exclusively in `--dry-run` mode (OQ-6), which is
a structurally distinct code path from everything this runbook describes (see § 4).

This runbook may be **read, reviewed, and used to prepare** for a future G2 ceremony at any time —
authoring it does not require, and does not wait on, ADR-0005's ratification. But **following it does
not clear G2**, and **G2 does not clear until**:

1. ADR-0005 itself clears **G0** (its `status` frontmatter field changes from `proposed` to
   `accepted` by the named ratifying authority — `docs/governance/gates-registry.md` § G0). As of
   this runbook's authoring date, `docs/adr/0005-kb-serialization-signing-key-custody.md` is
   `status: proposed`. Everything below is this program's **recommended default procedure**, not yet
   ratified policy — the ADR's own "Decision" section is explicit that it "does not accept this
   recommendation... E1 planning must ratify or revise it."
2. A named signing custodian exists, satisfying the A2 reconciliation (§ 7 below).
3. The ceremony in § 4 is actually carried out by that custodian, offline, and the resulting public
   key is registered against a `keyId` this program's tooling references.

## 1. Ownership model

| Role | Who | Responsibility here | Never |
|---|---|---|---|
| **Signing custodian** | A named human, designated per the A2 reconciliation (§ 7) | Generates and holds the real Ed25519 private key; performs real (non-dry-run) signing at ceremony time; owns rotation and compromise-response decisions for keys under their custody | Authors or proposes the release content being signed; is this repository's CI pipeline; is an agent, task, or AI system |
| **Release author / content proposer** | Whoever authored or proposed the release candidate (`build/kb-pack/<moduleId>/<packVersion>/`) | Produces the unsigned manifest via E0's `tools/rf-bundle-to-kb-pack propose` verb; hands the resulting `release-manifest.unsigned.json` and its reported preimage digest to the signing custodian for signing | Holds, generates, or has access to the signing custodian's private key; signs their own release candidate |
| **Runbook maintainer** (`platform-engineering`, this document's `owner`) | Whoever keeps this document current | Keeps the procedure below accurate as `tools/release-sign` evolves; records rotation/compromise events that have already happened, after the fact | Clears G2; names or removes a custodian; performs any step in § 4 on the custodian's behalf |
| **G0 ratifying authority** | Per ADR-0005's own `deciders` frontmatter (once populated) | Accepts or revises ADR-0005, including this runbook's recommended custody model | Delegates that act to an agent, a task, or this plan's authoring session |

**Binding rule, restated from `docs/governance/gates-registry.md`:** no gate in this registry, including
G2, is clearable by any task, any agent, or any plan. This runbook's existence changes nothing about
that — it is preparation, not clearance.

## 2. Custody model

Recommended default per ADR-0005 (alternative 1, accepted-by-recommendation, not yet ratified):
**offline, single-custodian, Ed25519 asymmetric key custody**, with the following properties:

- **Algorithm**: Ed25519 only — `node:crypto`'s native support, zero new cryptographic dependency,
  matching `tools/release-sign`'s own zero-new-crypto-dependency posture (decisions block Risk 6).
  No other curve or algorithm is supported by this program's tooling; a non-Ed25519 key is rejected
  by `sign`'s real-mode path (`tools/release-sign/lib/sign.mjs`: `privateKey.asymmetricKeyType !==
  'ed25519'` → `UsageError`).
- **Single named custodian per key**: the recommended default is one accountable human holding the
  private key, not a web-of-trust or organizational keyring (ADR-0005 alternative 2, rejected: "a poor
  fit for a single-custodian clinical release authority"). A future revision to this runbook could
  adopt a dual-control / M-of-N scheme (e.g., a hardware security module requiring two custodians to
  release a signature) if ADR-0005 is revised to recommend one; nothing below assumes that today.
- **Offline / air-gapped**: the private key is generated on, and never leaves, a machine that is
  disconnected from any network during key generation and during every real signing operation. This
  program makes **zero network calls** anywhere in its tooling (`tools/release-sign` decisions block
  Risk 6 posture); the custody model extends that same offline discipline to the human process around
  the tooling, not only the tooling itself.
- **Never in this repository, never in CI, never held by an agent**: this is the load-bearing custody
  invariant (A2 reconciliation, § 7). `tests/ef-release-no-keys.test.mjs` (P3-T5) proves by test that
  no private-key material exists anywhere in this repository's tree and that no automated check,
  script, or CLI default reads a signing key from the repo or from an environment variable. This
  runbook's every step is written to preserve that invariant, not to work around it.
- **Storage**: the custodian stores the private-key PEM on removable, encrypted media (e.g., an
  encrypted USB drive, or a hardware security module / smart card if the custodian's organization
  provides one) kept in the custodian's own physical or organizational custody, never checked into any
  version-control system, never uploaded to any network-reachable storage, never emailed or messaged.
  A future HSM-backed option is explicitly left open by ADR-0005's "offline/HSM-backed custody model"
  language; this runbook does not mandate HSM hardware for E1 — a well-secured offline file is the
  minimum bar, HSM custody is a stronger option the custodian may choose.
- **Access log**: the custodian maintains their own out-of-band record of every occasion the key is
  used to sign (what candidate, when, from what machine) — this runbook does not prescribe a specific
  tool for that log; it is process, not code, per ADR-0005's own framing ("key custody discipline...
  is fully manual process, not tooling, until E2's registry/surveillance engine exists").

## 3. Prerequisites before scheduling a ceremony

Do not begin § 4 until **all** of the following are true:

1. ADR-0005 has cleared G0 (`status: accepted`, recorded in the ADR file itself by its named
   ratifying authority) — or the ratifying authority has explicitly authorized a ceremony to proceed
   under this runbook's recommended-default procedure ahead of formal ADR acceptance (a decision this
   runbook does not make for them).
2. A signing custodian has been named who satisfies § 7's A2 reconciliation (distinct authority from
   the release author; not this repository's CI; not an agent).
3. A release candidate exists and has passed every automated check available to it: `manifest`
   (P3-T1) reports a preimage digest; that digest is byte-identical to
   `build/kb-pack/<moduleId>/<packVersion>/release-manifest.unsigned.json`'s own canonical bytes
   (never re-derived independently — see `tools/release-sign/README.md`'s "never re-implement E0's
   canonicalization" contract); `npm run validate` passes against the unsigned candidate.
4. The release author has handed the signing custodian: (a) the exact `packDir` path, (b) the
   `manifest` verb's reported `preimageSha256`, and (c) enough context (module id, pack version, what
   upstream `rf` evidence bundles it traces to) for the custodian to independently confirm they are
   signing the candidate they believe they are signing — the custodian is expected to re-run `manifest`
   themselves against the same pack directory and confirm the digest matches before signing, not to
   trust the author's report of the digest alone.

## 4. The ceremony (human-executed, offline — this is gate G2)

**Every step in this section is designed for human execution on an air-gapped machine, by the signing
custodian only. No script in this repository automates any step below beyond the `sign --dry-run`
rehearsal path (§ 4.4); no task or agent may execute § 4.1–4.3 or § 4.5–4.7 against a real key.**

### 4.1 Offline key generation

Performed once per key (see § 7 for rotation triggers), on a machine with no network connectivity,
that is **not** the machine that ran this repository's CI or any automated build:

```bash
# On the air-gapped custodian machine, NOT inside this repository's checkout or CI runner:
openssl genpkey -algorithm ED25519 -out custodian-ed25519-private-key.pem
openssl pkey -in custodian-ed25519-private-key.pem -pubout -out custodian-ed25519-public-key.pem
```

OpenSSL's `genpkey` emits a PKCS8 PEM private key — the exact format `tools/release-sign/lib/sign.mjs`'s
real-mode path reads (`createPrivateKey({ key: pem, format: 'pem' })`, which auto-detects the Ed25519
key type and rejects any other curve). This program ships **no `genkey`/`keygen` verb** in
`tools/release-sign` by design (`sign.mjs`'s own header: "No verb in this CLI generates and persists a
key pair to disk... 'no key-generation verb writes anything to the tree' therefore holds trivially by
this tool's own verb table") — key generation is deliberately outside this repository's tooling
entirely, using a widely available, independently auditable tool (OpenSSL) rather than code this
program controls. An equivalent offline Node.js script using `node:crypto`'s
`generateKeyPairSync('ed25519', ...)` is an acceptable alternative if OpenSSL is unavailable, provided
it is run on the same air-gapped machine and the script itself is never committed to, or executed
from, this repository's checkout.

Immediately after generation: verify the private key never touched a network-connected filesystem,
and confirm the public key's algorithm before proceeding (`openssl pkey -in
custodian-ed25519-public-key.pem -pubin -noout -text` should report `ED25519`).

### 4.2 Taking custody

Move the private-key PEM to the encrypted removable media or HSM chosen under § 2's custody model.
Confirm no copy remains on the generating machine's disk (secure-delete the working copy if the
generating machine is not itself the permanent custody device). Record the key's creation date, the
custodian's identity, and a `keyId` the custodian will assign to this key (§ 4.3) in the custodian's
own out-of-band access log (§ 2).

### 4.3 Assigning a keyId

The custodian assigns a `keyId` string identifying this key — a deliberate, human-chosen identity,
never defaulted, never generated by tooling, and **never carrying the `TESTKEY-` prefix**
(`tools/release-sign/lib/sign.mjs`'s `TESTKEY_PREFIX` constant is reserved exclusively for OQ-6's
ephemeral dry-run keys; real-mode signing hard-rejects any `--key-id` that carries it — see
`tests/ef-release-no-keys.test.mjs` group (d), which proves a `TESTKEY-` keyId in a real registry
entry is rejected). A recommended convention is `<program>-release-custodian-<year>` (e.g.
`ef-e1-release-custodian-2026`), but any non-`TESTKEY-`-prefixed, unique identifier the custodian
chooses is acceptable.

### 4.4 Rehearsal: confirm the tooling behaves as expected, using dry-run only

Before ever touching the real key, the custodian (or the release author, on any machine, since this
step uses no real key material) should rehearse the exact command shape against a disposable
candidate using `--dry-run` — the only mode any automated check may invoke:

```bash
node tools/release-sign/cli.mjs sign \
  --candidate build/kb-pack/<moduleId>/<packVersion> \
  --dry-run \
  --key-id rehearsal \
  --out /tmp/rehearsal-signed.json
```

This confirms the `--candidate`, `--out`, and general invocation shape work against the real release
candidate's pack directory, without the real key ever being read, referenced, or at risk. The
`--dry-run` output's `signature.keyId` will read `TESTKEY-rehearsal` — confirming the OQ-6 forced
prefix is active and cannot be a real signature.

### 4.5 Real signing, over the canonical digest

On the air-gapped custody machine, with the release candidate's pack directory (or the
`release-manifest.unsigned.json` file it contains) transferred to that machine by the release
author via an out-of-band, offline channel (never a live network connection to this repository):

```bash
node tools/release-sign/cli.mjs sign \
  --candidate /path/on/custody/machine/<moduleId>/<packVersion> \
  --key /path/outside/this/repository/custodian-ed25519-private-key.pem \
  --key-id ef-e1-release-custodian-2026 \
  --out /path/outside/this/repository/release-manifest.signed.json \
  --out-public-key /path/outside/this/repository/custodian-ed25519-public-key.pem
```

`sign`'s real-mode path signs **exactly** the bytes `manifest`/`canonical-bytes.mjs` already reports
as the signing preimage — the same canonical bytes E0's P5-T5 determinism proof pins, never
re-derived or re-serialized by this tool (`tools/release-sign/README.md` § "never re-implement E0's
canonicalization"). Before running this command, the custodian must independently confirm (per § 3
item 4) that the preimage digest they are about to sign matches what the release author reported —
`sign` will refuse to run at all under several structural guards even if that confirmation is
skipped: `--key`/`--key-id` are both required with no default; `--key-id` may never carry
`TESTKEY-`; `--key` must resolve to a path outside this repository tree (`sign.mjs`'s
`signReal` guards, proven in tests using only failure cases — no automated check ever completes a
real signature).

**Structural fact worth stating plainly**: even after this step succeeds, the resulting signed
document does **not** validate against `schemas/release-manifest.schema.json` as shipped in E1 —
that schema has no branch admitting a populated `signature` on anything other than a `dryRun: true`
candidate (P1-T5). This is by design, not a defect this runbook or any future task should "fix": the
schema will not accept a real signature as a legitimately release-ready artifact until a **separate,
independently reviewed, post-G2** schema change deliberately raises that ceiling. This runbook
therefore does not attempt to make a real signed candidate schema-valid — that remains correctly,
deliberately impossible in E1.

### 4.6 Handing back the signed candidate

The custodian transfers the signed manifest (and, for the record, the public key PEM — non-secret by
definition) back to the release author or program record via the same offline, out-of-band channel
used in § 4.5. The private key itself never leaves the custody machine or its custody device.

### 4.7 Registering (once P3-T4's `register` verb exists)

Once `tools/release-sign`'s `register` verb (P3-T4) is implemented, the release author (not the
custodian — registration is a distinct, later step from signing) appends the signed candidate's
integrity record to `releases/registry.json` per that verb's documented usage. As of this runbook's
authoring, `register` is not yet implemented (`tools/release-sign/README.md` marks it "Not yet
implemented — P3-T4"); this runbook is written to describe the full intended flow rather than only
the steps implemented as of P3-T7, and will need no revision once P3-T4 lands, since it already
reflects `schemas/release-registry.schema.json`'s documented shape (append-only, `signature`/
`signedAt` fields on the registry entry itself always `null` — the real signature lives on the
manifest, never duplicated onto the registry row).

### 4.8 Verification (once P3-T3's `verify` verb exists)

Anyone — including CI or an agent, since `verify` is the sole CI/agent-reachable surface of this tool
(ruling R3) — can subsequently confirm the signed candidate's integrity via `tools/release-sign`'s
`verify` verb against `releases/registry.json`, without ever touching, needing, or being able to
reconstruct the private key. As of this runbook's authoring, `verify` is not yet implemented
(P3-T3 is a sibling task in this same phase); this runbook does not depend on it being complete to be
accurate about the intended procedure, and needs no revision once P3-T3 lands.

## 5. Rotation

**Ownership**: the signing custodian who holds the key being rotated, in coordination with the G0
ratifying authority (a rotation changes which `keyId` this program's tooling and registry reference
going forward — a decision with the same governance weight as the original custodian designation).

**Triggers** (any one is sufficient to initiate rotation):

- A scheduled cadence the custodian and ratifying authority agree on (this runbook recommends no
  specific interval for E1 — DF-E2-01's future surveillance/registry engine is the point at which an
  automated rotation-cadence policy becomes tooling rather than manual process, per ADR-0005's own
  framing of key custody as "fully manual process, not tooling, until E2").
- Suspected or confirmed key compromise (→ follow § 6 compromise response first, then rotate).
- Custodian role change (the named human custodian steps down, changes roles, or is replaced —
  rotation is mandatory in this case, not optional, since the A2 reconciliation binds a specific
  distinct-authority role, not merely "someone").
- Any event the custodian judges sufficient, at their discretion, per their own risk assessment.

**Procedure**: rotation is § 4.1–4.3 (offline key generation, taking custody, assigning a new
`keyId`) performed fresh, by the same or a newly designated custodian, producing a **new** key and a
**new** `keyId` — this program never reuses a `keyId` for a different key. The old key's public
material and `keyId` remain valid for verifying signatures it already produced (verification does not
depend on the private key still existing); the old private key should be securely destroyed by its
custodian once no further real signing under that `keyId` is expected, following the custodian's own
organization's key-destruction practice. There is no registry-level "current key" pointer in E1's flat
registry shape (`schemas/release-registry.schema.json`'s `registryEntry.signature` is always `null`,
by design — E1's registry records integrity facts about candidates, not a key-rotation history); a
future DF-E2-01 registry/surveillance engine is the appropriate place to add that indexing if it is
ever needed.

## 6. Compromise response

**Ownership**: the signing custodian whose key is suspected or known compromised has primary
responsibility to declare compromise and halt use of that key immediately; the G0 ratifying authority
(or, in that authority's absence, the same platform-engineering/clinical-governance leadership named
in ADR-0005's `deciders`) has responsibility to coordinate the response and communicate it to anyone
relying on releases signed under the affected `keyId`.

**Immediate steps, on suspected or confirmed compromise**:

1. The custodian stops using the key for any further signing immediately.
2. The custodian and ratifying authority jointly decide whether any release already signed under the
   compromised `keyId` needs to be treated as suspect. E1 ships no automated revocation or
   withdrawal machinery (`schemas/release-registry.schema.json`'s `withdrawalState` is `const:
   "none"` — E1 never sets any other value; DF-E2-03, "withdraw/rollback machinery," is explicitly
   out of scope for this plan and deferred to E2). A compromise affecting an E1-era release therefore
   requires a manual, out-of-band communication to anyone relying on that release — this runbook
   records the process gap honestly rather than inventing in-repo tooling this plan does not build.
3. Rotation (§ 5) is performed unconditionally following any confirmed compromise — a compromised key
   is never reused, under any circumstances, once compromise is confirmed.
4. The custodian's own out-of-band access log (§ 2) is updated with the compromise event, its
   suspected cause, and the response taken, for future audit.
5. If the compromise resulted from a process failure this runbook itself did not anticipate (e.g., a
   custody-device loss, a procedural gap in § 2's storage guidance), the runbook maintainer updates
   this document to close that gap for future custodians — a corrective action on the document, never
   a corrective action performed by, or attributed to, an agent or task.

**What compromise response does not do**: it does not, and cannot, retroactively alter this
program's honesty posture — a compromised key never having conferred clinical standing in the first
place (see this document's opening banner) means compromise response is a security/integrity matter,
not a clinical-safety reclassification of anything already shipped under CLAUDE.md's guardrails.

## 7. G2 entry criteria

Restated from `docs/governance/gates-registry.md` § G2, the authoritative source — this section
exists so a custodian or program lead reading only this runbook has the checklist in one place, not
to introduce a second, potentially divergent definition. If this section and the gates registry ever
disagree, the gates registry is the source of truth (per that document's own § Cross-references).

G2 clears only when **all** of the following are independently, verifiably true:

- [ ] **A named custodian is designated** — a specific, accountable human, not a role description
      alone, not a team, not an agent.
- [ ] **That custodian's authority is distinct from the release author's** — per the A2
      reconciliation (`docs/governance/gates-registry.md` § "A2 (binding) — SPIKE-006
      reconciliation"): "the signing custodian must be a distinct authority from the release author,
      and CI/agents never hold keys." This is the direct fix for SPIKE-006's RQ1/RQ6 NO-GO finding
      and Amendment 2's rejection of server-only signing — both turned on the same collapse (signer
      and author being the same actor); the custodian named here must not recreate it.
- [ ] **Neither this repository's CI pipeline nor any agent running inside it ever holds, generates
      for persistent use, or has access to the real key** — satisfied structurally today by OQ-6's
      ephemeral, in-memory-only dry-run key generation and by `tests/ef-release-no-keys.test.mjs`'s
      assertion that no key material exists anywhere in this repository or its CI configuration.
- [ ] **An offline key-generation/custody ceremony is performed and documented** per § 4 of this
      runbook.
- [ ] **The resulting public key is registered** against a `keyId` this program's tooling can
      reference (once P3-T4's `register` verb exists, per § 4.7).
- [ ] **No real signing key was ever generated by, or transited through, any automated process this
      repository runs** — the ceremony in § 4 is entirely human-executed, on an air-gapped machine,
      using tooling (OpenSSL, or an offline Node script) that is never part of this repository's own
      CI or automated build.

Until every box above is checked by an actual human act, `schemas/release-manifest.schema.json`'s
`signature` slot stays `const null` on every real candidate, and `schemas/release-registry.schema.json`'s
`signature`/`signedAt` fields stay `null` on every registry entry — both by schema enforcement, not by
anyone remembering to check this list.

## 8. Cross-references

- `docs/governance/gates-registry.md` — the canonical enumeration of G0–G4, including G2's own row
  and the binding A2 reconciliation this runbook's § 7 restates rather than diverges from.
- `docs/adr/0005-kb-serialization-signing-key-custody.md` — the design decision (Ed25519, offline/
  HSM-backed custody, flat append-only registry) this runbook operationalizes; `status: proposed` as
  of this runbook's authoring — see § "Status note" above.
- `docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md` — the finding this
  runbook's custody model is designed not to recreate (RQ1/RQ6, same-actor-signs-and-authors NO-GO).
- `tools/release-sign/README.md` — the tool this runbook's § 4 commands operate; module boundary,
  verb table, exit-code taxonomy, and the "never re-implement E0's canonicalization" contract.
- `tests/ef-release-no-keys.test.mjs` (P3-T5) — the automated proof that this repository, its CI, and
  any agent running inside it hold no key material, independent of this runbook being followed
  correctly.
- `governance/reviewer-roster.yaml` — the G1 precedent for the same shape of guarantee this runbook
  protects at G2: a schema/process boundary that synthetic or automated activity can never satisfy,
  only a real, out-of-band-verified human act can.
- `CLAUDE.md` hard guardrails — "No AI-published rule changes. Rule/KB edits require independent
  clinical review + executable tests + signed release," restated gate-by-gate across this program's
  governance documents; this runbook is the "signed release" half of that sentence, made concrete.
