---
schema_version: 2
doc_type: report
report_category: finding
title: "Findings: E1 Multi-Bundle Conversion Pass"
status: draft
source: agent
created: '2026-07-22'
updated: '2026-07-22'
feature_slug: "multi-bundle-conversion-e1"
promoted_to: null
related_plan: /docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
---

# Findings: E1 Multi-Bundle Conversion Pass

## Phase 6 Findings

### Bugs / Gotchas

- **Confirmed shared-mutable-state hazard (pre-existing, out of P6's authorship scope), inside the
  very gate P6 certifies.** `tests/ef-converter-rule-candidate-drafting.test.mjs:44` and
  `tests/ef-converter-rule-provenance-projection.test.mjs:48` both define
  `STAGED_PACK_DIR = path.join(REPO_ROOT, 'build', 'kb-pack', 'cbc_suite_v1', '0.1.0-proposal')` and
  write into that real, non-isolated, shared directory — `ef-converter-rule-candidate-drafting.test.mjs`
  even `rm()`s it first (line 147). Both files were authored in the P3-T5/P3-T6
  (`evidence-foundry-buildout`) pass, before `tests/ef-multi-bundle-determinism.test.mjs`'s P6-T3
  suite established the `mkdtemp`-scratch-dir pattern this repo now uses for exactly this class of
  hazard. Two `npm test` workers (or a future parallel test runner configuration) touching this
  shared path concurrently is a latent flake inside `npm run check`, the same gate P6 certifies as
  green. Not fixed here — pre-existing and out of this phase's authorship scope — but tracked
  explicitly rather than left to be discovered as a future flaky-test investigation.

  **Recommended fix** (future task, either `evidence-foundry-buildout` or a dedicated tech-debt
  pass): rewrite both tests to use `mkdtemp(path.join(os.tmpdir(), ...))` scratch directories, the
  same pattern `tests/ef-multi-bundle-determinism.test.mjs` and
  `tests/ef-converter-rule-provenance-projection.test.mjs`'s own *other* test (line 174,
  `writeStagedRulesAndProvenance({ outDir: tempDir })`) already use — the isolated path is already
  proven to work for this exact converter surface, it just isn't used by these two specific tests.

### Plan / Reality Mismatches

- **P6-T3's original acceptance criterion asserted SHA-256 byte-identity across two full-batch runs
  for ALL 4 bundles** (`docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-5-6-7-projection-determinism-docs.md`,
  row P6-T3, and the Phase 6 exit checkbox). Verified reality: only `rf-cbc-002` -> `cbc_suite_v1`
  completes `inspect -> verify -> propose`; the other 3 bundles halt at `inspect` with
  `DecisionsNotFoundError` (FR-14 module scoping — `propose.mjs` is hardwired to `cbc_suite_v1`'s own
  drafting content by design; Deferred Item DF-E1-M1 — no `authoring-decisions.yaml` exists yet for
  the other 3 modules) and emit nothing (`tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-30`). This was
  already known and documented at Phase 1/2 (Decisions Block Addendum A1 / DF-E1-M1), so the gap
  itself is not new — the mismatch is that P6-T3's own AC text still asserted the stronger,
  unachievable claim rather than the real, achievable one. **Resolved**: the plan-detail row, the
  Phase 6 exit checkbox, and P6-GATE1's own description were all amended in place (this is a durable
  plan-doc fix, not merely a handoff-message substitution) to state the real property: full SHA-256
  byte-identity for `cbc_suite_v1`; identical halt pair/stage/cause for the other three; aggregate
  report SHA-256-identical. No design-spec is warranted — this is an AC-wording correction against
  an already-documented, already-scoped constraint, not new design work.

## Resolution Status (Phase 6)

The P6-T3 AC/reality mismatch is resolved in place (plan-detail doc amended). The shared-
mutable-state test hazard is explicitly NOT resolved here — it predates this phase, is out of its
authorship scope, and is recorded above as a tracked follow-up for whichever future pass touches
`tests/ef-converter-rule-candidate-drafting.test.mjs` / `tests/ef-converter-rule-provenance-projection.test.mjs`
next. Neither item is load-bearing enough to warrant a new Deferred Items Triage Table row or design
spec (Step 3 of the in-flight-findings lifecycle) — both are scoped, mechanical fixes with an
already-proven fix pattern in this same codebase, not new architecture/design decisions.
