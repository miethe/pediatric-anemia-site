# `tests/fixtures/ef-review-dryrun/`

Golden pin for **P2-T8** (Evidence Foundry E1 Phase 2, FR-11, ruling R4) — the five-role synthetic
dry-run.

`golden/modules/cbc_suite_v1/reviews/*.yaml` is a **byte-for-byte frozen copy** of the real,
committed `modules/cbc_suite_v1/reviews/*.yaml` files this task produced by running
`node tools/review-record/cli.mjs dry-run --module cbc_suite_v1` once, for real, against this
repository. `tests/ef-review-dryrun.test.mjs`'s golden-pin test asserts the two trees stay
byte-identical — it exists to catch any FUTURE accidental modification of that committed, append-
only history (the real files are never meant to change again; a correction would be a new
`supersedes`-linked record, never an edit).

This directory does **not** stand in for a live `dry-run` invocation the way
`tests/fixtures/ef-review-record-cli/` or `tests/fixtures/ef-review-render/input/` do for their
own tasks — `dry-run`'s own end-to-end MECHANISM is exercised instead against throwaway,
dynamically-created git fixtures inside `tests/ef-review-dryrun.test.mjs` (mirroring
`tests/ef-review-adjudication.test.mjs`'s own `makeGitFixture()` pattern), because `dry-run` is a
one-time, append-only act — it cannot legitimately be re-run over the real, already-populated
`modules/cbc_suite_v1/reviews/` a second time, and every dry-run signature is ephemeral (a fresh
Ed25519 keypair per invocation, OQ-6), so two independent dry-run passes over identical input can
never be expected to produce byte-identical signature bytes.

Every record here is `synthetic: true` and carries explicit "SYNTHETIC" / "NOT A CREDENTIALED
REVIEWER" language — see `schemas/review-record.schema.json`'s own top-level description for the
standing caveat every review-record artifact in this repository carries: structural validity here
never implies clinical validity, safety, or that a named human clinician reviewed anything.
