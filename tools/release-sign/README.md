# `tools/release-sign` — signed-release manifest / registry / sign / verify tooling

**Status**: `manifest` (P3-T1), `sign` (P3-T2), `verify` (P3-T3), and `register` (P3-T4) are all
implemented — every verb in this tool's dispatch table now has a real implementation. `npm run
validate` now joins this tool's structural (non-cryptographic) checks (P3-T6) — see "Verifier
surface wired into `npm run validate`" below.
**Structural validity produced by this tool never implies clinical validity, safety, or release
authorization.** No signature
minted by this tool (dry-run or otherwise) confers clinical standing — see
`docs/adr/0005-kb-serialization-signing-key-custody.md` and
`docs/governance/signing-ceremony-runbook.md` (P3-T7).

## What this tool is, and is not

`tools/release-sign` is a **downstream, later-stage** tool. It never authors clinical content or
kb-pack artifacts itself — it only signs, registers, and verifies what E0's
`tools/rf-bundle-to-kb-pack` `propose` verb already produced
(`build/kb-pack/<moduleId>/<packVersion>/release-manifest.unsigned.json`, P5-T1). Nothing in this
tool builds or re-serializes a manifest's JSON content; the sole importable entry point into E0's
converter is `propose.mjs`'s exported `run`, called unmodified.

`node:crypto` only — **zero new crypto dependencies**, and this tool makes **zero network calls**
and invokes **no LLM/generative model** at any point (decisions block Risk 6, FR-10 analog).

## The "never re-implement E0's canonicalization" contract

ADR-0005 states this project's binding constraint plainly: *"signing anything other than the exact
canonical bytes already hashed for `release-manifest.unsigned.json` would silently reopen the
non-deterministic-serialization risk."* E0's `rf-bundle-to-kb-pack` `propose` verb
(`tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs`, P5-T1/P5-T5) is the **only** code in this
repository that builds and canonically serializes that file — deterministic field order, no
embedded timestamps in hashed content, written to disk as `` `${JSON.stringify(manifest, null,
2)}\n` `` — and P5-T5's own determinism suite already proves two clean `propose` runs against
identical inputs emit byte-identical output.

`tools/release-sign` therefore never re-parses, re-stringifies, or re-orders that manifest. Its
`manifest` verb either (a) reads an already-produced pack's `release-manifest.unsigned.json` bytes
back verbatim, or (b) imports and calls `propose.mjs`'s `run` directly to produce one fresh, then
reads the result back verbatim. Either path, the "canonical bytes" this tool reports are the exact
bytes E0's converter wrote — not a byte sequence this tool re-derived, so it is structurally
impossible for them to diverge from E0's output by convention alone.

## Module boundary

| Module | Verb | Responsibility |
|---|---|---|
| `lib/canonical-bytes.mjs` | *(shared, not a verb)* | Reads `<packDir>/release-manifest.unsigned.json` verbatim; computes its SHA-256 (`node:crypto`). The single place every other module gets the signing preimage from. Owns nothing about signing, registration, or verification. |
| `lib/pack-digest.mjs` | *(shared, not a verb)* | Computes `packDigest` — a SHA-256 over every file under a staged pack directory (relative path + content, sorted), distinct from `manifestDigest`'s single-file signing preimage. Used only by `register`. **Implemented in P3-T4.** |
| `lib/manifest.mjs` | `manifest` | Locates or builds a pack's manifest (delegating construction to E0's `propose` verb, never re-implementing it) and reports its canonical signing preimage as a small "release-candidate hash manifest" summary object. **Implemented in P3-T1.** |
| `lib/registry.mjs` | `register` | Appends a release candidate to the append-only `releases/registry.json` (FR-14, OQ-4). Re-derives `moduleId`/`packDigest`/`manifestDigest` from a fresh disk read (never trusts the candidate document), rejects a non-dry-run candidate carrying a populated signature, rejects a duplicate moduleId/version entry, and rejects any mutation/removal of an existing entry via a two-layer append-only check (in-process + git-history walk). **Implemented in P3-T4.** |
| `lib/sign.mjs` | `sign` | Detached Ed25519 signature over the manifest digest (FR-12/FR-15, ruling R3). Designed for human offline execution at signing-ceremony time (gate G2, real mode, never exercised by any automated check in E1); carries an OQ-6 `--dry-run` mode (ephemeral in-memory keypair, `TESTKEY-`-forced `keyId`, private key discarded at process exit) that is the only path any automated check may invoke. **Implemented in P3-T2.** |
| `lib/verify.mjs` | `verify` | Fail-closed verification of a signed/dry-run candidate against the registry, with a documented 5-class exit-code taxonomy (FR-13). The sole CI/agent-reachable surface of this tool — CI can never sign (ruling R3). **Implemented in P3-T3.** |
| `lib/errors.mjs` | *(shared, not a verb)* | `ReleaseSignError` taxonomy — `0` OK / `1` USAGE, plus `verify`'s own 5 documented failure-class codes `2`-`6` (P3-T3, FR-13; see "Exit codes" below). `GoldenDriftError` — a signing preimage disagreeing with a pinned golden-bytes fixture; never silently caught and re-baselined. `register`'s own distinctly-NAMED (but all `EXIT_USAGE`-coded) failure classes (P3-T4): `RegisterByteDriftError`, `RegisterRealCandidateSignedError`, `RegistrySchemaInvalidError`, `RegistryDuplicateEntryError`, `RegistryAppendOnlyViolationError`. `NotImplementedError` — the documented pattern for any future scaffolded-but-unimplemented verb (unused today; every verb in this tool is implemented). |

Every verb-handler module exports a single `run(options)` async function; `cli.mjs` is the sole
dispatcher (`manifest \| register \| sign \| verify` → the matching module's `run`), mirroring
`tools/rf-bundle-to-kb-pack/cli.mjs`'s own verb-dispatch convention byte-for-byte (kebab-case flag
parsing, a `ReleaseSignError`-aware top-level catch, `--help`/`-h` handled before verb lookup).

## `manifest` verb usage

```bash
# Read an already-built pack's canonical signing preimage (read-only):
node tools/release-sign/cli.mjs manifest --pack build/kb-pack/cbc_suite_v1/0.1.0-proposal

# Build one fresh, delegating construction to E0's propose verb, then report the preimage:
node tools/release-sign/cli.mjs manifest \
  --run-dir tests/fixtures/rf-cbc-001 \
  --module modules/cbc_suite_v1/module.json \
  --decisions modules/cbc_suite_v1/authoring-decisions.yaml \
  --out build/kb-pack/cbc_suite_v1/0.1.0-proposal
```

Output (the release-candidate hash manifest, printed to stdout):

```json
{
  "schemaVersion": "1.0",
  "packDir": "build/kb-pack/cbc_suite_v1/0.1.0-proposal",
  "manifestFile": "release-manifest.unsigned.json",
  "manifestPath": "build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-manifest.unsigned.json",
  "preimageSha256": "sha256:1597e42bb01e1afe9b422146cc65931f4b2eb0e5e6eee46b0d580bb2fc3cbde7",
  "preimageByteLength": 795
}
```

## `sign` verb usage (P3-T2)

`sign` computes a detached Ed25519 signature over the exact bytes `manifest`/`canonical-bytes.mjs`
already reports as the signing preimage — it never re-reads or re-derives that digest independently.
Two structurally separate modes, never blurred:

```bash
# --dry-run — the ONLY mode any automated check (test/CI/agent) may ever invoke (OQ-6). Generates a
# fresh, in-memory-only Ed25519 keypair, forces the keyId to carry the TESTKEY- prefix regardless of
# --key-id, and discards the private key when this call returns (well before process exit).
node tools/release-sign/cli.mjs sign \
  --candidate build/kb-pack/cbc_suite_v1/0.1.0-proposal \
  --dry-run \
  --key-id ef-release-p3t2-demo \
  --out build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-manifest.dryrun-signed.json \
  --out-public-key build/kb-pack/cbc_suite_v1/0.1.0-proposal/dryrun-signer-public-key.pem

# real (non-dry-run) — human offline execution ONLY, at gate G2's signing ceremony
# (docs/governance/signing-ceremony-runbook.md, P3-T7). Never invoked by any automated check in E1.
# --key MUST resolve outside this repository tree; --key-id MUST NOT carry the TESTKEY- prefix.
node tools/release-sign/cli.mjs sign \
  --candidate build/kb-pack/cbc_suite_v1/<real-version> \
  --key /path/outside/this/repo/custodian-ed25519-private-key.pem \
  --key-id release-custodian-2026 \
  --out /path/outside/this/repo/release-manifest.signed.json
```

Output (this tool's own reporting object, printed to stdout; **only its nested `manifest` field is
required to validate against `schemas/release-manifest.schema.json`** — the wrapper fields around
it, including `signerPublicKey`, deliberately are not, mirroring `manifest`'s own `candidate` object
convention of a tool-owned summary that is not itself the artifact being described):

```json
{
  "schemaVersion": "1.0",
  "packDir": "build/kb-pack/cbc_suite_v1/0.1.0-proposal",
  "manifestPath": "build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-manifest.unsigned.json",
  "preimageSha256": "sha256:1597e42bb01e1afe9b422146cc65931f4b2eb0e5e6eee46b0d580bb2fc3cbde7",
  "dryRun": true,
  "signature": { "algorithm": "ed25519", "keyId": "TESTKEY-ef-release-p3t2-demo", "value": "<base64>" },
  "signerPublicKey": { "algorithm": "ed25519", "format": "spki-pem", "value": "-----BEGIN PUBLIC KEY-----\n...\n" },
  "manifest": { "...": "the unsigned manifest's own fields, plus dryRun: true and the signature above" }
}
```

**Why a `signerPublicKey` travels with a dry-run signature at all**: there is no persistent
signing-key registry in E1, and for an ephemeral `TESTKEY-` candidate there deliberately never will
be (the private half is discarded on purpose, per OQ-6). Public keys are non-secret by definition —
carrying the public half in this tool's own reporting object (never inside the schema-validated
`manifest`/`signature` shape itself, which is `additionalProperties: false`) is what makes a later,
separate-process `verify` invocation (P3-T3) able to cryptographically check a signature that was
produced by a key nobody kept.

**Guards that keep `sign` from ever weakening the P1-T5 forced-empty signature slot**: real-mode
output is *deliberately* not expected to pass `npm run validate` in E1 — `schemas/release-manifest.
schema.json` has no branch admitting a populated `signature` on anything other than `dryRun: true`,
and `sign` never tries to route around that (no flag forces `dryRun: true` onto a real signature, no
flag suppresses the `signature` field, and `--dry-run`/`--key` are mutually exclusive). Additional
structural guards on the real-mode path (proven by tests using ONLY failure cases — no automated
check ever completes a real signature): `--key`/`--key-id` are both required with no default;
`--key-id` may never carry `TESTKEY-`; `--key` must resolve to a path outside this repository tree.

## `verify` verb usage (P3-T3, FR-13)

`verify` is the **sole CI/agent-reachable surface** of this tool (ruling R3 — CI can never sign):
it never imports a `node:crypto` signing primitive, only the read-only `verify`/`createPublicKey`
pair. It fails closed with a documented, distinctly-coded 5-class exit-code taxonomy — see "Exit
codes" below — and produces **zero stdout output on any non-zero exit** (the success result is the
only thing this verb ever prints, and only after every check has passed).

```bash
# 1. Sign a candidate, persisting THIS TOOL'S OWN FULL REPORTING OBJECT (not just --out's
#    schema-conformant manifest) — the self-contained shape verify consumes: signature +
#    signerPublicKey + manifest, alongside packDir/manifestPath/preimageSha256/dryRun.
node tools/release-sign/cli.mjs sign \
  --candidate build/kb-pack/cbc_suite_v1/0.1.0-proposal \
  --dry-run --key-id ef-release-demo \
  --out-candidate build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-candidate.dryrun.json

# 2. Verify it against a registry (releases/registry.json once P3-T4 seeds it; any
#    schemas/release-registry.schema.json-shaped file otherwise).
node tools/release-sign/cli.mjs verify \
  --candidate build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-candidate.dryrun.json \
  --registry releases/registry.json
```

Output on success (printed to stdout ONLY after every check below has passed):

```json
{
  "schemaVersion": "1.0",
  "candidatePath": "build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-candidate.dryrun.json",
  "registryPath": "releases/registry.json",
  "moduleId": "cbc_suite_v1",
  "packVersion": "0.1.0-proposal",
  "preimageSha256": "sha256:1597e42bb01e1afe9b422146cc65931f4b2eb0e5e6eee46b0d580bb2fc3cbde7",
  "dryRun": true,
  "keyId": "TESTKEY-ef-release-demo",
  "verified": true
}
```

### What `verify` checks, in order (FR-13's own 5-class enumeration, plus classes 6/7 below)

1. **Byte drift vs canonical bytes** — the candidate's own recorded `preimageSha256` must agree
   with a FRESH re-read of its `packDir`'s current `release-manifest.unsigned.json` bytes (via
   `./lib/canonical-bytes.mjs#readCanonicalManifestBytes` — never re-derived). Catches a pack whose
   canonical manifest changed (or was hand-edited) since it was signed.
6. **Nested-manifest schema validity** [P3 laundering fix] — `candidate.manifest`, the NESTED,
   embedded manifest document the wrapper carries, must itself validate against
   `schemas/release-manifest.schema.json`. Checked BEFORE any cryptographic check runs. Closes a
   Codex second-opinion review finding: classes (1)-(5) all check the WRAPPER's own top-level
   fields against fresh bytes, but nothing previously inspected `candidate.manifest` itself — a
   genuinely valid, TESTKEY--marked wrapper could embed an arbitrary nested manifest, including a
   populated, non-TESTKEY- `signature` slot nothing else in this verb ever checked.
7. **Wrapper/manifest binding** [P3 laundering fix] — even a nested manifest that IS individually
   schema-valid must still be EXACTLY the document this wrapper's own already-verified top-level
   `signature` was produced alongside: `verify` reconstructs the expected nested manifest from a
   FRESH re-read of the pack's own bytes merged with the wrapper's own `dryRun`/`signature`, and
   compares canonical (sorted-key) digests. Any disagreement — a swapped `moduleId`, a different
   `testCorpusHash`, anything — is refused as a laundering attempt: a well-formed-looking but
   unrelated (or hand-edited) manifest riding along inside an otherwise-genuine wrapper.
2. **Digest mismatch vs manifest** — the embedded detached Ed25519 signature must cryptographically
   verify (`node:crypto`'s `verify`) against those SAME fresh bytes, using the candidate's own
   embedded (non-secret) `signerPublicKey`.
3. **Unknown `keyId`** — E1 has no signing-custodian key roster (gate G2 has not happened): the
   ONLY identity `verify` can ever recognize as known is a dry-run candidate's structurally
   `TESTKEY-`-prefixed `keyId`. A dry-run `keyId` lacking that marker, or ANY non-dry-run `keyId`
   at all, is "unknown" — by design, not a gap. This means `verify` structurally can never certify
   a non-dry-run candidate as verified in E1.
4. **Registry inconsistency** — the registry document must itself validate against
   `schemas/release-registry.schema.json`, must carry EXACTLY ONE entry for the candidate's
   `moduleId`/`packVersion` (its own `manifest.moduleId`/`manifest.packVersion`, matched against a
   registry entry's `moduleId`/`version`), and that entry's `manifestDigest` must agree with the
   candidate's own `preimageSha256`.
5. **`TESTKEY-` identity on a non-dry-run candidate** — the release-path test-key leak: a candidate
   whose `dryRun` is not `true` but whose `signature.keyId` still carries the `TESTKEY-` marker.
   Checked as part of the same keyId-classification step as class (3) above, but raised as its own
   distinctly-coded, more specific error (a `TESTKEY-` leak is a different, more actionable failure
   than a merely-unrecognized identity).

Execution order (fail-closed, first violation wins, zero stdout on any of them): (1) → (6) → (7) →
(2) → (3)/(5) → (4) — classes (6)/(7) run strictly BEFORE (2), the one cryptographic check this verb
performs, per this fix's own acceptance criteria ("before any cryptographic check").

`keyId` is signature METADATA, not signed content — none of classes (3)/(5) ever require a fresh
signature to construct a tamper fixture; only `dryRun`/`signature.keyId` need to change, and the
embedded signature stays cryptographically valid throughout (`tests/ef-release-sign-verify.test.mjs`
exploits exactly this to build every class-(3)/(5) fixture from one genuinely-signed base candidate).

### `--out-candidate` (P3-T3 addition to `sign`)

`sign --out-candidate <path>` persists this tool's own full reporting object — the exact shape
`verify --candidate` consumes — distinct from `--out`, which persists ONLY the schema-conformant
`manifest` field (no `signerPublicKey`, no top-level `packDir`/`manifestPath`). Without a persistent
signing-key registry in E1, carrying the (non-secret) public key alongside the signature in one
self-contained document is what lets a later, separate `verify` process check a signature produced
by a key nobody kept (see `signerPublicKey`'s own note above).

## `register` verb usage (P3-T4, FR-14/OQ-4)

`register` appends exactly one entry to the append-only `releases/registry.json` (the seed file
this task ships at repo root: `{ "schemaVersion": 1, "entries": [] }`). It never creates or
overwrites the registry file's own existence — `--registry` must already point at a valid,
schema-conformant document.

```bash
# 1. Register a dry-run signed candidate — the typical E1 flow (sign --dry-run --out-candidate
#    produces the self-contained document register reads):
node tools/release-sign/cli.mjs sign \
  --candidate build/kb-pack/cbc_suite_v1/0.1.0-proposal \
  --dry-run --key-id ef-release-demo \
  --out-candidate build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-candidate.dryrun.json

node tools/release-sign/cli.mjs register \
  --candidate build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-candidate.dryrun.json \
  --registry releases/registry.json

# 2. Or register a fully unsigned, pre-G2 real candidate straight from "manifest" (no sign step
#    at all — E1 never actually signs for real; see docs/governance/signing-ceremony-runbook.md):
node tools/release-sign/cli.mjs manifest \
  --pack build/kb-pack/cbc_suite_v1/0.1.0-proposal \
  > /tmp/manifest-candidate.json

node tools/release-sign/cli.mjs register \
  --candidate /tmp/manifest-candidate.json \
  --registry releases/registry.json

# 3. Then verify (P3-T3) against the same registry — "register the candidate first" is exactly
#    what step 1/2 above did:
node tools/release-sign/cli.mjs verify \
  --candidate build/kb-pack/cbc_suite_v1/0.1.0-proposal/release-candidate.dryrun.json \
  --registry releases/registry.json
```

Output (printed to stdout only after the registry file has been written successfully):

```json
{
  "schemaVersion": "1.0",
  "registryPath": "/abs/path/releases/registry.json",
  "candidatePath": "/abs/path/release-candidate.dryrun.json",
  "dryRun": true,
  "entry": {
    "version": "0.1.0-proposal",
    "moduleId": "cbc_suite_v1",
    "packDigest": "sha256:<64 hex>",
    "manifestDigest": "sha256:<64 hex>",
    "signature": null,
    "signedAt": null,
    "supersedes": null,
    "withdrawalState": "none",
    "withdrawnAt": null,
    "withdrawalReason": null
  },
  "entryIndex": 0,
  "totalEntries": 1
}
```

**Never trusts the candidate document.** Like `verify`, `register` re-reads `<packDir>/release-
manifest.unsigned.json` fresh (`./lib/canonical-bytes.mjs#readCanonicalManifestBytes`) and
independently recomputes both digests — `manifestDigest` from those fresh bytes, `packDigest`
(`./lib/pack-digest.mjs`) over every file in the pack directory. `moduleId`/`version` come from
that same fresh read, never from a candidate document's own (possibly stale or hand-edited)
claims. A candidate whose recorded `preimageSha256` disagrees with the fresh re-read fails closed
(`RegisterByteDriftError`).

**The appended entry's own `signature` is always `null`** — regardless of whether the candidate
was dry-run signed (`TESTKEY-` keyId) or fully unsigned (no `sign` step run at all): see
`schemas/release-registry.schema.json`'s own top-level description for why the registry never
bears a real signature (that lives on the release-manifest's own `signature` slot once gate G2
clears). A non-dry-run candidate that DOES carry a populated signature is rejected outright
(`RegisterRealCandidateSignedError`) — E1 has no gate-G2 signing-custodian authority yet, so
`register` refuses to build an entry from one rather than silently discarding it.

**Rejected outright, always fail-closed, no partial write:**
- a malformed/unreadable `--candidate` or `--registry` (`UsageError`);
- a candidate whose `preimageSha256` disagrees with a fresh re-read (`RegisterByteDriftError`);
- a non-dry-run candidate with a populated signature (`RegisterRealCandidateSignedError`);
- a `--registry` document that is already schema-invalid (`RegistrySchemaInvalidError`);
- a duplicate `moduleId`/`version` entry already present (`RegistryDuplicateEntryError`);
- any attempt to mutate, remove, or reorder an existing entry, or to change `schemaVersion`, in
  the document about to be written (`RegistryAppendOnlyViolationError`, layer 1 of 2 below).

### Append-only enforcement — two layers

Mirrors `tools/review-record`'s OQ-2 append-only design (a `previousRecordHash` chain checked
in-process, plus a git-history validator) applied to a flat, single-document registry instead of
one-file-per-record:

1. **In-process (every `register` call)** — `assertRegisterAppendsExactlyOne` compares the
   registry document `register` just read against the one it is about to write: every existing
   entry must be present, unchanged, at the same index, with exactly one new entry appended and
   `schemaVersion` unchanged.
2. **Git-history walk (`checkRegistryHistoryAppendOnly`, exported, not called by `register`
   itself)** — walks every git-committed revision of a registry file (`git log`/`git show`, read-
   only, no network) and asserts each is entry-prefix-compatible with its predecessor. This is the
   layer that would catch a hand-edited, directly-committed mutation that never went through
   `register` at all — something an in-process, working-tree-only check cannot see. **Wired into
   `npm run validate` (P3-T6)** by `scripts/validate-kb.mjs#loadAndValidateReleaseRegistry` —
   see "Verifier surface wired into `npm run validate`" below; `register` itself still only enforces
   layer 1 at write time, and `tests/ef-release-registry.test.mjs` exercises layer 2 directly
   against a throwaway git repo. Deliberately does **not** pass `--follow` to `git log` (a P3-T6
   fix): `--follow`'s content-similarity rename detection can misattribute an unrelated older file
   as this path's "ancestor" (concretely, it once misattributed
   `schemas/release-registry.schema.json`, added by P1-T5 before `releases/registry.json` itself
   existed, as a rename source for this repo's own registry — a tooling false positive, not an
   append-only violation, that would have broken this wiring on the real, untampered repo). See
   `lib/registry.mjs#checkRegistryHistoryAppendOnly`'s own header for the full explanation.

Both layers reduce to one comparison primitive, `assertEntriesPrefixPreserving` (structural,
key-order-independent equality via a self-contained `stableStringify` — not a cross-tool import of
`tools/review-record/lib/chain.mjs`'s own copy, which owns a disjoint file set in this same wave).

## Verifier surface wired into `npm run validate` (P3-T6, FR-18, PRD OQ-2)

**The decision.** `npm run validate` (`scripts/validate-kb.mjs`) joins exactly two of this tool's
checks, both structural and both already covered above — **never** a cryptographic operation:

1. **Registry schema-validity** (`validateReleaseRegistryDocument` / `loadAndValidateReleaseRegistry`,
   P1-T7) — `releases/registry.json` validates against `schemas/release-registry.schema.json`.
   This is also where **forced-empty/TESTKEY-leak protection** lives: the schema pins every real
   registry entry's `signature` to `type: "null"` (never an object, so a `TESTKEY-` `keyId` — or
   any signature at all — cannot exist in a persisted registry entry in the first place;
   `tests/ef-contract-release-registry.test.mjs` and `tests/ef-release-no-keys.test.mjs` group (d)
   already prove this fail-closed) and `withdrawalState` to `const: "none"`.
2. **Append-only shape** (`checkRegistryHistoryAppendOnly`, P3-T4/P3-T6) — the git-history walk
   documented above, run whenever the tree `npm run validate` is checking is itself git-tracked (a
   `.git` entry exists at its root — always true for this repository's own real invocations; a
   synthetic, non-git-initialized fixture tree used by an unrelated schema-shape test degrades to
   "nothing to compare," not a spurious failure).

**What is deliberately NOT wired in: full cryptographic `verify`.** `tools/release-sign`'s `verify`
verb (Ed25519 signature verification, `node:crypto`, FR-13's own 5-class fail-closed taxonomy) stays
exactly what it already was — a `tools/release-sign` CLI verb, exercised only by this tool's own
tests (`tests/ef-release-sign-verify.test.mjs`). `verify` is deliberately never wired into
`scripts/validate-kb.mjs`, is deliberately never wired into the anemia SPA/API runtime (`src/`,
`server.mjs`), and this task adds no new npm script — `manifest`/`register`/`sign`/`verify` stay
exactly the four `node tools/release-sign/cli.mjs <verb>` invocations OQ-1 already established;
`npm run validate` grows no new command-line surface, only two new function calls inside its
existing `scripts/validate-kb.mjs` entrypoint.

**Why.** `npm run validate` is a fast, offline, KB-authoring structural gate — it runs on every
`modules/`/`schemas/`/`governance/` change, has no reason to expect a signed (or even a fully-built)
release candidate to exist on disk, and existed long before this tool did. Cryptographic
verification is inherently about a *specific candidate document* (`verify --candidate <path>
--registry <path>`) that `npm run validate` has no candidate to point at — there is nothing for it
to verify against by default, only the committed KB source tree and the always-present
`releases/registry.json`. Folding `verify` in here would also blur ruling R3's own boundary ("CI can
never sign, and CI's *default* checks stay narrowly scoped to what they can prove without a
candidate in hand") and would give `npm run validate` a reason to eventually import `node:crypto`
signing/verification primitives it does not need for its actual job of proving the KB source tree
and its append-only integrity records are internally consistent. A real release candidate's
signature is verified by running `verify` directly (see "`verify` verb usage" above), a deliberate,
separate, later-stage step — not a side effect of every `npm run validate` invocation.

**Byte-untouched elsewhere.** This decision — and this task's whole change — touches exactly
`scripts/validate-kb.mjs` (the sole post-P1 barrier-file change in this wave, per this plan's own
scope note) plus this tool's own `lib/registry.mjs` (the `--follow` fix above) and this README. It
makes **no** change to `src/`, `server.mjs`, `openapi.yaml`, or `modules/anemia/module.json` — the
anemia browser deployment's SPIKE-006 posture (two-part digest, fail-closed,
`unsigned-stub -> integrity-recorded -> superseded/revoked` enum, `src/kbVerify.js`) stays
byte-untouched, proven by a diff-scope test
(`tests/ef-release-registry-validate-wiring.test.mjs`).

## Golden-bytes regression pin (P3-T1)

`tests/fixtures/ef-release/golden-canonical-bytes/release-manifest.unsigned.json` is a byte-exact
copy of the `release-manifest.unsigned.json` a real `rf-bundle-to-kb-pack propose` run emits for
the `cbc_suite_v1` module against the committed `tests/fixtures/rf-cbc-001` bundle
(`modules/cbc_suite_v1/module.json` + `authoring-decisions.yaml`) — E0's P5-T5 canonical
serialization, pinned. `tests/ef-release-manifest-canonical-bytes.test.mjs` asserts:

1. this tool's `manifest` verb, run against that same fixture, produces a signing preimage
   byte-identical (and SHA-256-identical) to the pinned golden fixture;
2. that preimage is also byte-identical to a *direct*, independent `rf-bundle-to-kb-pack propose`
   run against the same inputs (proving `manifest`'s delegation path introduces no divergence of
   its own);
3. a seeded one-byte mutation of the golden fixture is rejected by `assertGoldenBytesMatch` /
   `GoldenDriftError` — golden drift **fails closed**, and this fixture is never silently
   re-baselined by test or tool code. Updating it requires a deliberate, reviewed commit that
   replaces the fixture file itself, with the reason for the change stated in that commit.

See `tests/fixtures/ef-release/golden-canonical-bytes/PROVENANCE.md` for exactly how the fixture
was derived and how to regenerate it if a deliberate re-pin is ever warranted.

## Zero-new-crypto-dependency and zero-network/zero-generative-model posture

`tests/ef-release-manifest-canonical-bytes.test.mjs` includes structural (grep-style) assertions
that:

- no file under `tools/release-sign/` imports any crypto module other than `node:crypto`
  (`package.json` carries no `dependencies` block at all — this tool adds none);
- no file under `tools/release-sign/` imports a network module (`node:http`/`node:https`/
  `node:dgram`) or an AI/model-SDK package, and no file calls `fetch(...)`.

These mirror `tests/ef-converter-invariants.test.mjs`'s equivalent checks for
`tools/rf-bundle-to-kb-pack/` (P2-T5) — the same posture, applied to this tool.

## Exit codes (FR-13's documented taxonomy)

This table is the canonical, complete exit-code contract for `tools/release-sign/cli.mjs` — every
verb, not just `verify`. `cli.mjs`'s top-level catch forwards a thrown `ReleaseSignError`'s own
`exitCode` verbatim; it never remaps a distinctly-coded failure into a different number. A non-zero
exit from `verify` always produces **zero stdout output** — the success result is the only thing it
ever prints, and only once every check has passed (`tests/ef-release-sign-verify.test.mjs` proves
this per failure class, not just narratively).

| Code | Name | Meaning | Verbs that can raise it |
|---:|---|---|---|
| 0 | OK | Verb succeeded. | all |
| 1 | USAGE | Malformed invocation — missing/unreadable pack or manifest, golden-bytes drift (`manifest`), a `sign`-verb usage/guard failure (missing/invalid `--key`/`--key-id`, `TESTKEY-` on a real keyId, in-repo `--key` path, `--dry-run`+`--key` combined), a `verify`-verb malformed invocation (missing/unreadable `--candidate`/`--registry` path, unparseable JSON, a candidate document missing a field this tool's own shape contract requires), or any `register`-verb failure (P3-T4: malformed candidate/registry, byte drift against a fresh re-read, a non-dry-run candidate carrying a populated signature, an already-invalid registry document, a duplicate moduleId/version entry, or an append-only violation — see "register verb usage" above; distinctly NAMED errors, not distinctly CODED — `register` is not part of FR-13's 5-class taxonomy). | `manifest`, `sign`, `verify`, `register` |
| 2 | BYTE_DRIFT | `verify` class (1): the candidate's recorded preimage digest disagrees with a fresh re-read of its own canonical manifest bytes off disk. | `verify` |
| 3 | DIGEST_MISMATCH | `verify` class (2): the embedded signature does not cryptographically verify against those fresh canonical bytes. | `verify` |
| 4 | UNKNOWN_KEYID | `verify` class (3): the signature's `keyId` is not an identity this tool recognizes in E1 — a dry-run `keyId` lacking the `TESTKEY-` marker, or ANY non-dry-run `keyId` (no signing-custodian roster exists pre-gate-G2). | `verify` |
| 5 | REGISTRY_INCONSISTENCY | `verify` class (4): the registry document is schema-invalid, carries no entry (or more than one) for the candidate's moduleId/packVersion, or that entry's `manifestDigest` disagrees with the candidate's own digest. | `verify` |
| 6 | TESTKEY_ON_REAL | `verify` class (5): a non-dry-run candidate's `keyId` carries the `TESTKEY-` marker — the release-path test-key leak. | `verify` |
| 7 | NESTED_MANIFEST_INVALID | `verify` class (6) [P3 laundering fix]: `candidate.manifest` (the nested, embedded manifest document) does not itself validate against `schemas/release-manifest.schema.json` — checked before any cryptographic check runs. | `verify` |
| 8 | WRAPPER_MANIFEST_MISMATCH | `verify` class (7) [P3 laundering fix]: a schema-valid nested manifest whose canonical digest disagrees with what the wrapper's own already-verified top-level signature/preimageSha256 implies it should carry. | `verify` |

See `tools/release-sign/lib/errors.mjs`'s own header for the machine-readable mirror of this same
table (kept in sync by convention, not by generation) and each error class's exact throw sites.

## Related documents

- `docs/adr/0005-kb-serialization-signing-key-custody.md` — the canonicalization/signing/custody/
  registry decision this tool implements (Ed25519, `node:crypto`, flat append-only registry).
- `docs/project_plans/design-specs/signed-release-key-custody.md` — the pre-E1 design-spec stub
  ADR-0005 seeded.
- `docs/governance/signing-ceremony-runbook.md` (P3-T7) — the human-executed offline
  key-generation/custody/signing/rotation runbook and gate G2 entry criteria.
- `schemas/release-manifest.schema.json` (P1-T5) — the schema `release-manifest.unsigned.json`
  (and, once signed, its `signature`-populated form) validates against.
