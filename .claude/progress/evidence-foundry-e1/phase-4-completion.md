# Phase 4 Completion Note — Retrospective Validation Harness (2026-07-22)

- 9 tasks + gate complete (commits 3b5c739..536216a incl. SPIKE-007 doc). tools/retro-validate: fixtures-only corpus behind ADR-0006 boundary, deterministic byte-identical reports, discordance/agreement counts framed as fixture-exercise counts (never clinical performance).
- Validator gate: approved.
- Codex gpt-5.6-terra second-opinion 2 BLOCKERs: corpus schema accepted PHI-shaped prose + arbitrary input.patient fields. Fixed c7fb63e (additionalProperties:false whitelists mirroring patient-input.schema.json w/ drift test + recursive identifier denylist, 4 seeded violations). Codex re-review: CLOSED, denylist proven load-bearing.
