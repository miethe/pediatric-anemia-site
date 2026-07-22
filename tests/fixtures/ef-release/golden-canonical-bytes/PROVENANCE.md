# Provenance — golden-canonical-bytes fixture

**Task**: P3-T1 (evidence-foundry-e1, Phase 3 — Signed Release Machinery), FR-12, decisions block
Risk 6.
**File**: `release-manifest.unsigned.json` in this directory.
**Derived**: 2026-07-22.

## What this is

A byte-exact copy of the `release-manifest.unsigned.json` E0's `tools/rf-bundle-to-kb-pack propose`
verb (P5-T1/P5-T5) emits for the `cbc_suite_v1` module, run against:

- `--run-dir tests/fixtures/rf-cbc-001` (the committed `RF-CBC-001` fixture bundle)
- `--module modules/cbc_suite_v1/module.json`
- `--decisions modules/cbc_suite_v1/authoring-decisions.yaml`

This is E0's own P5-T5 canonical serialization — nothing in this fixture's *content* was authored
or hand-edited by `tools/release-sign`; it is a direct, unmodified copy of `propose`'s real output.

Pinned SHA-256 (over the file's exact bytes as committed):

```
sha256:1597e42bb01e1afe9b422146cc65931f4b2eb0e5e6eee46b0d580bb2fc3cbde7
```

## Determinism proof at derivation time

Before pinning, `propose` was run twice, into two separate clean output directories, against the
identical inputs above. `diff` between the two runs' `release-manifest.unsigned.json` reported
zero differences — consistent with P5-T5's own committed determinism suite
(`tests/ef-converter-determinism.test.mjs`, `tests/ef-converter-release-manifest.test.mjs`).

## How to regenerate (only for a deliberate, reviewed re-pin — never silently)

```bash
mkdir -p /tmp/ef-golden-regen   # any scratch dir outside the repo tree
node tools/rf-bundle-to-kb-pack/cli.mjs propose \
  --run-dir tests/fixtures/rf-cbc-001 \
  --module modules/cbc_suite_v1/module.json \
  --decisions modules/cbc_suite_v1/authoring-decisions.yaml \
  --out /tmp/ef-golden-regen
diff /tmp/ef-golden-regen/release-manifest.unsigned.json \
  tests/fixtures/ef-release/golden-canonical-bytes/release-manifest.unsigned.json
```

A non-empty `diff` means one of two things, and this file's own header comment in
`tools/release-sign/lib/errors.mjs`'s `GoldenDriftError` states the same rule for the test
codepath: (a) this pinned fixture is stale and E0's converter output legitimately changed (in
which case, replace this file with the new bytes **as its own reviewed commit**, with the reason
stated in that commit — never as a side effect of an unrelated change), or (b) something
introduced non-determinism into E0's converter (investigate and fix the converter; do not touch
this fixture). `tests/ef-release-manifest-canonical-bytes.test.mjs`'s golden-drift assertion exists
precisely so this disagreement is never silent.

## Non-goals

This fixture is a byte-identity regression pin for `tools/release-sign`'s signing preimage. It is
not itself a signed, reviewed, or clinically validated artifact — `release-manifest.unsigned.json`
is, by construction (its own schema description, `schemas/release-manifest.schema.json`), an
unsigned, unreviewed proposal stub.
