# Phase 3 Completion Note — Signed Release Machinery (2026-07-22)

- 7 tasks + gate complete (commits 8b107c5..956850c). tools/release-sign: Ed25519 sign/verify, no-keys-shipped fail-closed posture, TESTKEY- dry-run only, releases/registry.json seeded inert (signature/signedAt null, withdrawalState none), signing-ceremony runbook (human G2 acts only).
- Validator gate: approved after 1 fix cycle (PEM-header-shaped string in bogus-env fixture + test failure; fixed e8c51e8).
- Codex gpt-5.6-terra second-opinion MAJOR: verify didn't bind wrapper→nested manifest (TESTKEY laundering path). Fixed 5ab5a2b (nested-manifest schema validation + canonical-digest binding pre-crypto; 9 laundering tests). Codex re-review: CLOSED.
