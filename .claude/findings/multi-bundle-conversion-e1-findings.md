---
schema_version: 2
doc_type: report
report_category: finding
title: "Findings: E1 Multi-Bundle Conversion Pass"
status: accepted
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

- **Unreproducible-provenance gap: 2 of 4 modules' committed evidence-layer artifacts have no
  producing script anywhere in this repository (a third, `anemia`, has since been remediated).**
  `scripts/evidence/` holds two committed projection generators today:
  `backfill-cbc-002-evidence.mjs` (P4-T5, `cbc_suite_v1`) and, as of commit `33bc6c5`,
  `scripts/evidence/oneoff/gen-anemia-evidence-assertions.py` (`anemia`). No sibling script exists
  for the other two modules whose evidence-layer files were nonetheless committed to the repo:
  - `modules/anemia/evidence-assertions.json` (commit `6f28cd2`, P4-T2) — **generator now committed**,
    see below.
  - `modules/kidney_suite_v1/evidence.json` + `evidence-assertions.json` + `unresolved.json`
    (commit `5ef190c`, P5-T1) — generator still missing.
  - `modules/growth_suite_v1/evidence-assertions.json` + `evidence.json` + `unresolved.json`
    (commit `5f8e753`, P5-T2) — generator still missing.

  All three commit messages self-report the same pattern: `propose.mjs` is hardwired (by design,
  P3-T7/FR-14) to `cbc_suite_v1`'s own hand-authored drafting content and cannot run generically
  against another module without also writing `rules.json`/`candidates.json`/`evidence.json` for
  it — exactly what each of these tasks' own ACs forbade — so each was produced instead by a
  bespoke one-off generator outside the converter. Only one of those three generators is still
  present on disk at all — the `modules/anemia/` producer — and it **is now committed**, at
  `scripts/evidence/oneoff/gen-anemia-evidence-assertions.py` (recovered from an untracked worktree
  scratch file per commit `33bc6c5`, after karen's P6-GATE2 review flagged the gap
  TIME-SENSITIVE/HIGH). The kidney/growth-suite generators are not present anywhere in the repo or
  its history at all — their commit messages describe the pattern but no script file accompanies
  either commit, and neither has ever been committed to any branch.

  **Plainly stated**: the evidence-layer artifacts for `modules/kidney_suite_v1/` and
  `modules/growth_suite_v1/` are **not regenerable from committed code today**;
  `modules/anemia/`'s is only regenerable via the committed generator above **run manually** — its
  committed form had a path-resolution bug (a wrong repo-root computation) that made every
  invocation fail; the bug has been fixed and the corrected script now reproduces
  `modules/anemia/evidence-assertions.json` byte-for-byte. If either remaining upstream fixture
  (`tests/fixtures/rf-kid-001/`, `rf-gro-002/`) changed and someone needed to re-derive the
  corresponding committed JSON, there is no checked-in tool that reproduces it. `cbc_suite_v1`'s
  evidence layer (via `backfill-cbc-002-evidence.mjs`) is covered by `npm run check` — its `run()`
  is imported and exercised by the test suite. `anemia`'s evidence layer (via
  `gen-anemia-evidence-assertions.py`) is **not**: it is a standalone script with zero test or
  `npm run check` coverage, so its reproducibility is not continuously enforced, only manually
  verified as of this pass. This is a real provenance/reproducibility gap in the delivered
  artifacts for the two remaining modules, distinct from (and in addition to) the
  already-documented DF-E1-M1 rule-authoring gap the parent plan and `batch.mjs` already track,
  and the anemia generator's lack of automated coverage remains a smaller, related gap of its own.

  **Recommended remediation** (either is sufficient; not decided here — this finding only surfaces
  the gap, per the in-flight-findings lifecycle's Step 3 boundary against prescribing new design
  work): (1) author and commit equivalent scripts for `kidney_suite_v1`/`growth_suite_v1`,
  following `backfill-cbc-002-evidence.mjs`'s (or `gen-anemia-evidence-assertions.py`'s) structure,
  so each module's evidence layer is at least manually regenerable the way `cbc_suite_v1`'s and
  `anemia`'s already are — and ideally wire the new scripts into `npm run check` from the start,
  which `anemia`'s currently is not; or (2) close DF-E1-M1 (per-module `authoring-decisions.yaml`) for these two modules
  so the committed `propose` verb can actually produce their evidence-layer output going forward,
  retiring the bespoke generators entirely. Either remediation should be scoped as its own
  follow-up task, not retrofitted into this phase's already-closed rows.

## Resolution Status (Phase 6)

The P6-T3 AC/reality mismatch is resolved in place (plan-detail doc amended). The shared-
mutable-state test hazard is explicitly NOT resolved here — it predates this phase, is out of its
authorship scope, and is recorded above as a tracked follow-up for whichever future pass touches
`tests/ef-converter-rule-candidate-drafting.test.mjs` / `tests/ef-converter-rule-provenance-projection.test.mjs`
next. The unreproducible-provenance gap is also NOT resolved here — recording committed generator
scripts or authoring-decisions files is out of P6's own scope and belongs to whichever future pass
picks up the recommended remediation above. Neither item is load-bearing enough to warrant a new
Deferred Items Triage Table row or design spec (Step 3 of the in-flight-findings lifecycle) — all
three are scoped, mechanical fixes (the unreproducible-provenance gap has two named, already-
understood remediation paths; the shared-mutable-state hazard has an already-proven fix pattern in
this same codebase), not new architecture/design decisions.

## Post-Execution Findings (Opus verification pass, 2026-07-22)

### Verified-good (independent re-derivation, not test-trusting)

- **"Zero new clinical rules" CONFIRMED by diff, not by prose.** `git diff 276aab8..HEAD -- modules/*/rules.json`:
  `modules/anemia/rules.json` and `modules/cbc_suite_v1/rules.json` byte-unchanged (91 and 4 rules);
  `modules/kidney_suite_v1/rules.json` and `modules/growth_suite_v1/rules.json` contain exactly `[]`.
  `modules/anemia/module.json` byte-identical to the pre-run baseline. `approvedBy: []` on all 4 modules.
  Note `modules/anemia/module.json.status` is `integrity-recorded` with a non-null `clinicalContentHash`
  — this PREDATES this pass (verified against the `276aab8` blob) and records Wave-0 content integrity,
  not clinical approval.

- **No fabricated provenance in the 3 hand-produced projections.** All 187 assertions
  (kidney 73 / growth 79 / anemia 35) were cross-checked against their source fixtures:
  0 assertions cite an `rfClaimId` absent from the fixture `claims/claim_ledger.yaml`;
  0 cite an `rfSourceCardId` that is not a real `sources/src_*.md` card; and every one of the 187
  `exactPassageSha256` values is present in its own fixture's committed bytes. `exactPassage` is
  null on all 187 — zero verbatim restricted text committed. The unreproducible-provenance gap
  recorded above is therefore a REPRODUCIBILITY gap, not an integrity or fabrication one: the
  content is faithful to the fixtures; what is missing is a committed regenerator for
  kidney_suite_v1 and growth_suite_v1.

### New finding

- **MEDIUM — P1-T7's stated acceptance criterion overstates the rights-leakage gate's actual
  coverage.** The AC (phase-1-2-vendoring-batch-orchestration.md, row P1-T7) says the gate "greps
  every committed byte ... for any string matching a source card's withheld/restricted verbatim
  passage" and that "a seeded mutation (temporarily inserting one restricted passage's text into a
  fixture file) is caught by the gate." Empirically, using a real 139-char restricted passage taken
  from the live RF-KID-001 run directory and appended to `tests/fixtures/rf-kid-001/reports/report_draft.md`:
    - inserted INSIDE a double-quoted span  -> gate exits 1 (CAUGHT, works as designed)
    - inserted as BARE UNQUOTED PROSE       -> gate exits 0 (NOT caught)
  Outside each fixture's `sources/` directory the gate decodes only double-quoted spans and hashes
  them against its placeholder-derived registry (see the script's own header, §2), so raw prose is
  never inspected. This is NOT a fabricated or cosmetic gate — it genuinely catches the realistic
  regression vector (a regeneration or bad merge restoring a `quote:`/`passage_locator:` construct),
  and `scripts/evidence/check-fixture-rights-leakage.mjs` documents its mechanism honestly. The
  defect is that the AC text claims byte-level coverage the implementation does not provide.
  **Recommended:** amend the P1-T7 AC to describe the real property (quoted-span + structural
  placeholder verification), or widen the scan to substring-match the hash registry against raw
  text. Do not let the current AC wording stand as-is — on a rights-governance gate, an AC that
  overstates coverage is the failure mode this repo exists to avoid.
