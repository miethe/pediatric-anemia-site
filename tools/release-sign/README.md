# `tools/release-sign` — signed-release manifest / registry / sign / verify tooling

**Status**: `manifest` (P3-T1) and `sign` (P3-T2) are implemented; `register`/`verify` are
structurally dispatched but not yet implemented (P3-T3/T4). **Structural validity produced by
this tool never implies clinical validity, safety, or release authorization.** No signature
minted by this tool (dry-run or otherwise) confers clinical standing — see
`docs/adr/0005-kb-serialization-signing-key-custody.md` and the forthcoming
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
| `lib/manifest.mjs` | `manifest` | Locates or builds a pack's manifest (delegating construction to E0's `propose` verb, never re-implementing it) and reports its canonical signing preimage as a small "release-candidate hash manifest" summary object. **Implemented in P3-T1.** |
| `lib/registry.mjs` | `register` | Appends a release candidate to the append-only `releases/registry.json` (FR-14, OQ-4). Rejects any mutation/removal of an existing entry. **Not yet implemented — P3-T4.** |
| `lib/sign.mjs` | `sign` | Detached Ed25519 signature over the manifest digest (FR-12/FR-15, ruling R3). Designed for human offline execution at signing-ceremony time (gate G2, real mode, never exercised by any automated check in E1); carries an OQ-6 `--dry-run` mode (ephemeral in-memory keypair, `TESTKEY-`-forced `keyId`, private key discarded at process exit) that is the only path any automated check may invoke. **Implemented in P3-T2.** |
| `lib/verify.mjs` | `verify` | Fail-closed verification of a signed/dry-run candidate against the registry, with a documented 5-class exit-code taxonomy (FR-13). The sole CI/agent-reachable surface of this tool — CI can never sign (ruling R3). **Not yet implemented — P3-T3.** |
| `lib/errors.mjs` | *(shared, not a verb)* | `ReleaseSignError` taxonomy scaffold (`0` OK / `1` USAGE today; P3-T3 extends this with `verify`'s own 5 documented failure-class codes). `GoldenDriftError` — a signing preimage disagreeing with a pinned golden-bytes fixture; never silently caught and re-baselined. `NotImplementedError` — the P3-T2..T4 stub marker. |

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

## Exit codes (today)

| Code | Name | Meaning |
|---:|---|---|
| 0 | OK | Verb succeeded. |
| 1 | USAGE | Malformed invocation, missing pack/manifest, golden-bytes drift, a `sign`-verb usage/guard failure (missing/invalid `--key`/`--key-id`, `TESTKEY-` on a real keyId, in-repo `--key` path, `--dry-run`+`--key` combined), or an unimplemented verb (`register`/`verify` today). |

`verify`'s own documented 5-class exit-code taxonomy (FR-13) is defined and tested in P3-T3; this
table will be extended there, not narrowed.

## Related documents

- `docs/adr/0005-kb-serialization-signing-key-custody.md` — the canonicalization/signing/custody/
  registry decision this tool implements (Ed25519, `node:crypto`, flat append-only registry).
- `docs/project_plans/design-specs/signed-release-key-custody.md` — the pre-E1 design-spec stub
  ADR-0005 seeded.
- `docs/governance/signing-ceremony-runbook.md` (P3-T7, not yet authored) — the human-executed
  offline key-generation/custody/signing/rotation runbook and gate G2 entry criteria.
- `schemas/release-manifest.schema.json` (P1-T5) — the schema `release-manifest.unsigned.json`
  (and, once signed, its `signature`-populated form) validates against.
