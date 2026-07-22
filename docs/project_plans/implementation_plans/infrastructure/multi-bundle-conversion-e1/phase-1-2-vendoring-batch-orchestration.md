# Phase 1-2: Vendoring & Batch Orchestration

[Return to Parent Plan](../multi-bundle-conversion-e1.md)

**Column conventions** (apply to every task table below): `Estimate` is story points, never Effort.
`Model` values: `sonnet` (this plan uses no other model). `Effort` values (claude only): `adaptive` \|
`extended`. See `.claude/skills/planning/references/multi-model-guidance.md`. Gate rows
(`task-completion-validator`, `karen`) carry `Estimate: —` — they are reviewer checkpoints, not
pointed build work.

---

## Phase 1: Rights-Aware Vendoring & Fixtures

**Duration**: ~2-3 engineer-days
**Dependencies**: None — first phase in the plan; runs in wave 1 alongside Phase 3
**Assigned Subagent(s)**: node-tooling engineer (general-purpose, sonnet); Explore (read
`scripts/evidence/vendor-rf-bundle.mjs` + `tests/fixtures/rf-cbc-001/` before building); task-completion-validator gate
**Exit gate** (decisions block §1, **scoped per Decisions Block Addendum A1**): `node
tools/rf-bundle-to-kb-pack/cli.mjs inspect` exits 0 for `tests/fixtures/rf-cbc-002` — the only one
of the 4 fixtures whose target module (`modules/cbc_suite_v1/`) currently carries an
`authoring-decisions.yaml`. For `rf-ev-001` (→ `modules/anemia`), `rf-kid-001` (→
`modules/kidney_suite_v1`), and `rf-gro-002` (→ `modules/growth_suite_v1`), `inspect` exits 1 with
`DecisionsNotFoundError` — pre-existing E0-era converter behavior (`lib/loader.mjs`), not a P1
regression, and NOT to be closed by authoring an `authoring-decisions.yaml` in this feature (see
line 190 below / Notes for implementation-planner). That gap is tracked as **Deferred Item
DF-E1-M1** (rule-authoring workflow per module). Vendor generator unit-tested.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|---------:|--------------|-------|--------|---------------|
| P1-T1 | Generalize `vendor-rf-bundle.mjs` into `scripts/evidence/generate-rf-fixture.mjs` | Per FR-1: extract the reusable mechanics from `scripts/evidence/vendor-rf-bundle.mjs` (hand-rolled YAML-subset parser, SHA-256 hashing, `usage`-block rights reading, restricted-quote withholding per ADR-0002/D-EP3-4/EP3-T5) into a new, converter-shaped, **bundle-parametrized** generator. The generator MUST take a run directory + target fixture slug as arguments (never hard-code a single bundle, unlike the legacy script's `DEFAULT_BUNDLE` constant) and emit an EF-shaped `tests/fixtures/rf-<slug>/` tree — `evidence_bundle.yaml`, `claims/claim_ledger.yaml`, `extractions/ext_*.yaml`, `sources/src_*.md`, `reviews/verification.yaml`, `reports/report_draft.md`, `swarm_plan.yaml`, `writebacks/*` — mirroring `tests/fixtures/rf-cbc-001/`'s exact shape, never the legacy flattened `evidence-packs/<bundle>/pack.json` shape. Default every passage to ADR-0002's hash+selector-only disposition unless a source's `usage` block positively confirms `allowed_for_public_output: true`; absence of a `usage` block is never read as permission. Fail closed (non-zero exit, named card/id) on any unmatched source card or unrecognized YAML construct — never silently skip. | `node scripts/evidence/generate-rf-fixture.mjs --run-dir <dir> --slug <slug>` produces a fixture tree matching `rf-cbc-001`'s file inventory exactly (same top-level dirs/files, none extra/missing); running it twice against the same run directory produces byte-identical output; a seeded run directory with one unmatched source card fails non-zero, naming the card | 1.5 | node-tooling engineer | sonnet | extended | None |
| P1-T2 | Fixture generator unit test | Per FR-20: the generator is new, reusable tooling, not a one-off script — it needs its own test, not only "it worked once by hand." Author `tests/ef-generate-rf-fixture.test.mjs` against a small, local synthetic sample run directory (never the live agentic node) proving: valid EF fixture shape produced, determinism (two runs → byte-identical), and the rights-disposition default (no positively-confirmed-clear passage ⇒ hash+selector-only, never full text). | Test passes; asserts zero network calls during generation; asserts the synthetic sample's one `allowed_for_public_output: true` passage (if seeded) is the only one NOT defaulted to hash+selector-only | 0.5 | node-tooling engineer | sonnet | adaptive | P1-T1 |
| P1-T3 | Generate + commit `tests/fixtures/rf-ev-001/` | Per FR-2/FR-3: run P1-T1's generator against `rf_run_20260717_rf_ev_001_pediatric_cds_backfill` (RF-EV-001, 6 source cards, 48 claims). Commit the fixture tree plus a `HASH-PROVENANCE.md` mirroring `tests/fixtures/rf-cbc-001/HASH-PROVENANCE.md`'s structure exactly: source `run_id`, bundle SHA-256, per-source-card rights-disposition table, passage-count summary (restricted vs. positively-confirmed-rights-clear). | `tests/fixtures/rf-ev-001/` committed; `HASH-PROVENANCE.md` present with all required sections; `node tools/rf-bundle-to-kb-pack/cli.mjs inspect --run-dir tests/fixtures/rf-ev-001` exits 0 once P2's `inspect` verb is available (cross-checked at P1-GATE against the existing E0 `inspect` verb, unchanged) | 0.75 | node-tooling engineer | sonnet | adaptive | P1-T1, P1-T2 |
| P1-T4 | Generate + commit `tests/fixtures/rf-cbc-002/` | Per FR-2/FR-3: run the generator against `rf_run_20260717_rf_cbc_002_pediatric_cds_establish` (RF-CBC-002, 12 source cards, 88 claims). Commit fixture tree + `HASH-PROVENANCE.md`, same structure as P1-T3. | `tests/fixtures/rf-cbc-002/` committed with `HASH-PROVENANCE.md`; `inspect` exits 0 against it | 0.5 | node-tooling engineer | sonnet | adaptive | P1-T1, P1-T2 |
| P1-T5 | Generate + commit `tests/fixtures/rf-kid-001/` | Per FR-2/FR-3: run the generator against `rf_run_20260717_rf_kid_001_pediatric_cds_evidence` (RF-KID-001, 12 source cards, 87 claims). Commit fixture tree + `HASH-PROVENANCE.md`. | `tests/fixtures/rf-kid-001/` committed with `HASH-PROVENANCE.md`; `inspect` exits 0 against it | 0.5 | node-tooling engineer | sonnet | adaptive | P1-T1, P1-T2 |
| P1-T6 | Generate + commit `tests/fixtures/rf-gro-002/` | Per FR-2/FR-3: run the generator against `rf_run_20260717_rf_gro_002_pediatric_cds_evidence` (RF-GRO-002, 12 source cards, 92 claims). Commit fixture tree + `HASH-PROVENANCE.md`. | `tests/fixtures/rf-gro-002/` committed with `HASH-PROVENANCE.md`; `inspect` exits 0 against it | 0.5 | node-tooling engineer | sonnet | adaptive | P1-T1, P1-T2 |
| P1-T7 | Rights-leakage grep gate across all 4 fixtures (R-4 mitigation) | Per FR-3 / decisions block Risk 4: add a CI-runnable check (`npm run check` step or a dedicated script invoked by it) that greps every committed byte under `tests/fixtures/rf-{ev-001,cbc-002,kid-001,gro-002}/` for any string matching a source card's withheld/restricted verbatim passage (cross-referenced against each fixture's `HASH-PROVENANCE.md` restricted-passage list). This closes decisions block Risk 4 structurally, not only by convention. | The grep gate runs as part of `npm run validate` (or an equivalent check task) and fails non-zero if a restricted passage's verbatim text is found in any committed fixture byte; a seeded mutation (temporarily inserting one restricted passage's text into a fixture file) is caught by the gate in a local dry run before being reverted | 0.75 | node-tooling engineer | sonnet | adaptive | P1-T3, P1-T4, P1-T5, P1-T6 |
| P1-GATE | `task-completion-validator` gate | Verify Phase 1 exit gate (scoped per Decisions Block Addendum A1): `inspect` exits 0 for `rf-cbc-002`; the other 3 fixtures' `DecisionsNotFoundError` exit is expected (DF-E1-M1), not a blocker; fixture generator is unit-tested; grep gate active and passing; no rights-restricted verbatim text in any committed fixture byte. | All exit-gate criteria pass (as scoped); recorded in phase progress note | — | task-completion-validator | sonnet | adaptive | P1-T1..T7 |

**Phase 1 Quality Gates:**
- [ ] `node tools/rf-bundle-to-kb-pack/cli.mjs inspect` exits 0 against `tests/fixtures/rf-cbc-002`
  (the only new fixture whose target module carries `authoring-decisions.yaml`); the other 3
  fixtures' `DecisionsNotFoundError` exit is expected and out of scope for P1 (Decisions Block
  Addendum A1 / Deferred Item DF-E1-M1), not a regression to fix here
- [ ] Fixture generator (`scripts/evidence/generate-rf-fixture.mjs`) is unit-tested and deterministic
- [ ] All 4 `HASH-PROVENANCE.md` files exist and mirror `rf-cbc-001`'s structure
- [ ] Rights-leakage grep gate is active in `npm run check`/`npm run validate` and passes
- [ ] Zero network calls during fixture generation (test-enforced)

> **Note on per-task ACs above**: P1-T3/P1-T5/P1-T6's Acceptance Criteria columns say `inspect`
> "exits 0 against it" for their respective fixtures. Per Addendum A1, this holds for `rf-cbc-002`
> (P1-T4) only; `rf-ev-001` (P1-T3), `rf-kid-001` (P1-T5), and `rf-gro-002` (P1-T6) exit 1 with
> `DecisionsNotFoundError` (no `authoring-decisions.yaml` on their target modules — DF-E1-M1),
> which does not block those tasks' completion — their ACs are otherwise fully met (fixture
> committed, `HASH-PROVENANCE.md` present).

---

## Phase 2: EF-WP1 Eligibility Gate & Batch Orchestration

**Duration**: ~2-3 engineer-days
**Dependencies**: Phase 1 complete
**Assigned Subagent(s)**: node-tooling engineer (general-purpose, sonnet); task-completion-validator gate
**Exit gate** (decisions block §1, **scoped per Decisions Block Addendum A2**): the batch-
orchestration machinery (literal `BATCH_PAIRS` enumeration, fixed `inspect → verify → propose`
per-pair pipeline, fail-closed halt-on-first-failure, per-pair output isolation, run-to-run
determinism, and `aggregate`'s explicit 0/`[]`/`not_available` field semantics) is proven green via
`tests/ef-converter-batch.test.mjs` / `tests/ef-batch-runner.test.mjs` — **not** that `node
cli.mjs batch` exits 0 end-to-end over all 5 fixtures today. As of this writing it does not: `batch`
halts at pair 0 (`rf-ev-001`) with `DecisionsNotFoundError` (the same Addendum A1 / DF-E1-M1 gap),
and `aggregate` reports `bundlesNotAvailable: 4`, `bundlesReported: 0`. Only `rf-cbc-002 →
cbc_suite_v1` (the fixture with an `authoring-decisions.yaml`) completes `propose` end to end when
invoked directly. The **`rf-cbc-001` regression check** clause is satisfied by the pre-existing
E0-era `rf-cbc-001` test coverage (`tests/ef-converter-*.test.mjs`) continuing to pass under `npm
run check` (confirmed 1302/1302 green) — none of the 6 new P2 tests reference `rf-cbc-001`
directly; see `lib/batch.mjs`'s header and Addendum A2 for the full linkage. `EF-WP1` test passes
(unaffected by this scoping — a per-bundle structural gate, independent of
`authoring-decisions.yaml`).

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|---------:|--------------|-------|--------|---------------|
| P2-T1 | `EF-WP1` eligibility pre-flight (OQ resolution: lives in the converter, not standalone) | Per FR-16: extend `tools/rf-bundle-to-kb-pack/lib/eligibility.mjs` (not a new standalone validator — this keeps the check inside the same fail-closed pipeline `inspect`/`verify`/`propose` already share, consistent with `lib/eligibility.mjs`'s existing per-claim `02 §3.7` role) with a structural check: every source card in a bundle must carry the `pediatric_cds` evidence-card extension block before the bundle is treated as converter-eligible at all. A bundle missing the extension on any source card is rejected, non-zero exit, before any `propose` output is written for it — reported with the specific card ID(s) missing the extension, not a generic failure. | `getEligibility`/equivalent function rejects a bundle with ≥1 source card missing `pediatric_cds`, naming the card ID(s); all 4 new fixtures (and `rf-cbc-001`) pass the gate (each already confirmed 6/6 or 12/12 per `rf-handoff/RESULTS.md` §1 provenance note) | 1.0 | node-tooling engineer | sonnet | extended | Phase 1 complete |
| P2-T2 | `EF-WP1` fail-closed test | Per FR-16: seed a synthetic fixture card missing the `pediatric_cds` extension block and assert the eligibility gate rejects it before any `propose` output is written (no partial pack directory created). | Seeded fixture fails closed, non-zero exit, names the missing card; zero files written under `build/kb-pack/` for the rejected bundle | 0.5 | node-tooling engineer | sonnet | adaptive | P2-T1 |
| P2-T3 | Batch runner: named `{fixture, module}` list, ordered `inspect → verify → propose` | Per FR-5: add `tools/rf-bundle-to-kb-pack/lib/batch.mjs` (invoked via a new `cli.mjs` `batch` verb or equivalent) that runs `inspect → verify → propose` sequentially over an **explicit, named, ordered list** of `{fixture, module}` pairs — `{tests/fixtures/rf-ev-001, modules/anemia}`, `{tests/fixtures/rf-cbc-002, modules/cbc_suite_v1}`, `{tests/fixtures/rf-kid-001, modules/kidney_suite_v1}`, `{tests/fixtures/rf-gro-002, modules/growth_suite_v1}` — **never a directory glob or a "process everything under `runs/`" pattern** (R-7 mitigation). Each bundle produces its own `build/kb-pack/<module_id>/<pack_version>/conversion-report.json`. | Batch runner processes all 4 named pairs in the declared order; a test asserts the runner's bundle list is a literal, enumerated array (not derived from a glob/`readdir` over an external directory); running the batch twice with no source changes is idempotent (R-7/R-5 evidence) | 1.5 | node-tooling engineer | sonnet | extended | P2-T1, Phase 1 complete |
| P2-T4 | `multi-bundle-conversion-report.json` aggregation schema | Per FR-5: aggregate the 4 per-bundle `conversion-report.json` files into one top-level `multi-bundle-conversion-report.json` (staged under `build/kb-pack/`, gitignored) with per-bundle and aggregate counts: claims processed, conflicts preserved, unresolved items, candidate scaffolds, rules emitted (expected: 0 across all 4). Every field the report introduces must have a defined "0/empty" representation — a consumer reading the report when a bundle produced zero conflicts or zero unresolved items must see an explicit `0`/`[]`, never a missing key. | Report schema documented (inline comment or short README section) with every field's missing/empty representation stated; a test asserts a bundle producing zero unresolved claims still emits `"unresolved": []` (not an absent key) in its section of the report | 1.0 | node-tooling engineer | sonnet | adaptive | P2-T3 |
| P2-T5 | Fail-closed partial-batch-failure test (R-6 mitigation) | Per the PRD's Reliability NFR: seed a mid-batch failure (e.g., a corrupted 3rd-of-4 fixture) and assert the batch runner names the failing bundle explicitly, halts without partially writing that bundle's output, and leaves already-succeeded bundles' output unaffected — no shared mutable state between bundles. | Seeded 3rd-bundle failure: bundles 1-2's output is present and unaffected; bundle 3 has zero partial output under `build/kb-pack/`; bundle 4 is never attempted; the runner's error message names bundle 3 specifically | 0.5 | node-tooling engineer | sonnet | adaptive | P2-T3 |
| P2-T6 | REG-exclusion regression test (R-7 mitigation) | Per FR-4/FR-19: assert no script this pass adds (`generate-rf-fixture.mjs`, `lib/batch.mjs`, `cli.mjs`) ever reads `REG-001`'s or `REG-004`'s `runs/` directory, and that neither appears in P2-T3's named `{fixture, module}` list. | A test asserts the batch runner's literal bundle list contains exactly 4 entries, none referencing `reg-001`/`reg-004`/`REG-001`/`REG-004` in any form (path, run\_id substring, or module target) | 0.5 | node-tooling engineer | sonnet | adaptive | P2-T3 |
| P2-GATE | `task-completion-validator` gate | Verify Phase 2 exit gate (scoped per Decisions Block Addendum A2): batch-orchestration machinery (literal enumeration, fixed pipeline, fail-closed halt, per-pair isolation, determinism, `aggregate` field semantics) is proven green by test, not that `batch` exits 0 over all 5 fixtures — it halts at pair 0 (`rf-ev-001`) on the same Addendum A1/DF-E1-M1 gap, expected and not a blocker; `rf-cbc-001` regression check is satisfied by the pre-existing E0-era suite staying green under `npm run check` (1302/1302); `EF-WP1` fail-closed test passes; partial-failure and REG-exclusion tests pass. | All exit-gate criteria pass (as scoped); recorded in phase progress note | — | task-completion-validator | sonnet | adaptive | P2-T1..T6 |

**Phase 2 Quality Gates** (scoped per Decisions Block Addendum A2):
- [x] Batch runner (`inspect → verify → propose`) machinery — literal enumeration, fixed per-pair
  pipeline, fail-closed halt, per-pair isolation, determinism — is proven green by test
  (`tests/ef-converter-batch.test.mjs`, `tests/ef-batch-runner.test.mjs`). `node cli.mjs batch` does
  **not** currently exit 0 over all 5 fixtures — it halts at pair 0 (`rf-ev-001`) with
  `DecisionsNotFoundError`, the same Addendum A1 / DF-E1-M1 gap, which is expected and not a P2
  regression. Only `rf-cbc-002` completes `propose` end to end when run directly (outside the
  batch, since the batch never reaches it today).
- [x] The `rf-cbc-001` regression check is satisfied by the pre-existing E0-era `rf-cbc-001` test
  coverage continuing to pass under `npm run check` (confirmed 1302/1302 green) — stated explicitly
  here and in `lib/batch.mjs`'s header, not left implicit; none of the 6 new P2 commits/tests
  reference `rf-cbc-001` directly.
- [x] `EF-WP1` (`pediatric_cds` extension) is enforced structurally, fail-closed, before any `propose` output
- [x] `multi-bundle-conversion-report.json` schema defines an explicit empty/zero representation for every field
- [x] A seeded mid-batch failure halts cleanly, names the failing bundle, and does not corrupt other bundles' output
- [x] Batch bundle list is a literal, enumerated array — never a glob — and never references `REG-001`/`REG-004`

> **Note on per-task ACs above**: P2-T3's Acceptance Criteria column says "Batch runner processes
> all 4 named pairs in the declared order". Per Addendum A2, this is proven true for the
> orchestration *machinery* (a synthetic 4-pair batch in `tests/ef-batch-runner.test.mjs` runs all 4
> pairs end to end), but the *live* `node cli.mjs batch` invocation over the real 4 fixtures halts at
> pair 0 (`rf-ev-001`) with `DecisionsNotFoundError` and never reaches pairs 1-3 — the same
> Addendum A1 / DF-E1-M1 gap. This does not block P2-T3's completion — the runner's fail-closed
> halt-on-first-failure behavior (naming the failing pair, leaving no partial output) is exactly the
> contract required, and is exercised directly by test. P2-T4's aggregation AC is similarly satisfied
> by the report's schema/field-semantics correctness, not by a live 4/4 `bundlesReported` count — the
> real `aggregate` run today reports `bundlesReported: 0`, `bundlesNotAvailable: 4`, each with the
> explicit zero/empty representation the AC requires.

[Return to Parent Plan](../multi-bundle-conversion-e1.md)
