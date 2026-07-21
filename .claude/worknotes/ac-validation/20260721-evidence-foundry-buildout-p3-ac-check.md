validator: codex/gpt-5.6-terra

# Phase 3 (Projection & Drafting) — AC Validation, P3-GATE

Source docs (current tree, post FR-16(c) re-scope): `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md`
(P3-T1..T7 AC columns + Phase 3 Quality Gates), `.claude/progress/evidence-foundry-buildout/phase-3-progress.md`
(SC-1/SC-2/SC-3, which mirror the Quality Gates 1:1).

Codex (gpt-5.6-terra, `--sandbox read-only`) ran the full checklist first. It reported 3 items NOT MET.
Per the harness instructions, each was cross-checked with a direct unsandboxed run before being recorded
here — all 3 turned out to be sandbox artifacts (stale leftover `build/` output from an earlier partial
task run, and a read-only-sandbox `EPERM` on temp-file writes), not real defects. Corrected verdicts and
reproducing evidence are below.

**Note on a stale prior worknote**: this file path already contained content from an earlier attempt at
this same gate, written against an older revision of the plan that still framed P3-T5's candidate as an
unresolved "iron-deficiency-anemia pattern" gap. The manifest as it exists in this tree today already
bakes in the re-scope resolution ("benign-ethnic/Duffy-null neutropenia differential pattern... re-scoped
from FR-16(c)'s original 'iron-deficiency-anemia pattern' naming — see the parent plan's binding
'FR-16(c) candidate identity' resolution"), so that item is evaluated below against the current AC text,
not the superseded framing.

**Result: 10/10 MET** (7/7 task-level ACs, 3/3 Phase 3 Quality Gates).

## P3-T1 — authoring-decisions.yaml

- [x] 4 decision records exist, one per slice rule; each cites ≥1 real claim ID from the fixture's
  `claim_ledger.yaml`; all `review.*` fields are `pending`; schema-valid per `authoring-decisions.schema.json`
  — MET: `modules/cbc_suite_v1/authoring-decisions.yaml` has exactly 4 `dec_*` records; every cited
  `rf_claim_ids` entry resolves against `tests/fixtures/rf-cbc-001/claims/claim_ledger.yaml`;
  `node --test tests/authoring-decisions-schema.test.mjs` passes (8/8), including the all-`pending`
  and schema-validity assertions.

## P3-T2 — evidence.json enrichment

- [x] ≥1 source per slice-rule-supporting claim; every 02 §4.9-required field present; no `journal`
  synthesized from `title`/`publisher` — MET: `node --test tests/ef-converter-evidence-projection.test.mjs`
  passes (4/4); `npm run validate` reports `cbc_suite_v1` with 8 evidence records / 8 passage records;
  every `authoring-decisions.yaml` `basis.rf_claim_id` resolves to a projected source.

## P3-T3 — evidence-assertions.json + schema

- [x] ≥1 assertion per slice-rule-supporting claim, each resolving to a real fixture passage; a fixture
  assertion missing `exactPassageSha256` when `exactPassage` is null fails schema validation; schema wired
  into `scripts/validate-kb.mjs` with a passing + a seeded-failing case — MET: 19 assertions committed in
  `modules/cbc_suite_v1/evidence-assertions.json`; `node --test tests/evidence-assertions-schema.test.mjs`
  passes (10/10), including the seeded-bad fixture
  `tests/fixtures/invalid-evidence-assertions/SYNTHETIC-INVALID-MISSING-SHA256-001.json.txt` (produces
  exactly one `required property is missing` error at `$.assertions[0].exactPassageSha256`) and both
  directions of `validateModule()` existence-gating.

## P3-T4 — claim-ledger routing + authoring-decisions.schema.json

- [x] a `mixed`-status stub claim → conflict-visible object, never a rule proposal; a `speculation`-status
  stub claim → zero rule-evidence output; an `authoring-decisions.yaml` record missing `basis.reasoning`
  fails schema validation — MET: `node --test tests/ef-converter-claim-routing.test.mjs` passes (17/17)
  covering every routing-table branch; `tests/authoring-decisions-schema.test.mjs`'s seeded-bad
  missing-`basis.reasoning` fixture fails validation as expected.

## P3-T5 — candidate + rule-proposal drafting

- [x] `rule-proposals.json` has exactly 4 entries, each joined to a decision record by `decisionId`; the
  benign-ethnic/Duffy-null neutropenia differential candidate's `label` contains "pattern," not a
  diagnostic assertion; no candidate or rule anywhere in the pack is named or evidenced as
  "iron-deficiency"; a test confirms ≥1 proposal rule references the candidate — MET: a live, unsandboxed
  `propose` run (see P3-T7 below) writes `rule-proposals.json` with exactly 4 entries, each `decisionId`
  resolving in `authoring-decisions.yaml`; the candidate's `id`/`label` is
  `benign-ethnic-neutropenia-differential-pattern` (contains "pattern"); `grep -ri iron` across the staged
  pack and `modules/cbc_suite_v1/` returns nothing; `node --test tests/ef-converter-rule-candidate-drafting.test.mjs`
  passes and confirms `CBC-NEUT-BENIGNDIFF-001` references the candidate. (This candidate identity is the
  current, re-scoped AC text — see the note above on the superseded "iron-deficiency" framing.)

## P3-T6 — strict runtime projection + rule-provenance.json + schema

- [x] each staged rule validates against `schemas/rule.schema.json` with zero errors; every field the
  strict schema rejects appears in `rule-provenance.json` instead; a `rule-provenance.json` entry missing
  `basis.decisionId` fails schema validation — MET (Codex initially reported this NOT MET after inspecting
  the repo's stale, gitignored `build/kb-pack/cbc_suite_v1/0.1.0-proposal/` directory, which held only 2 of
  7 pack files left over from an earlier task's partial run, and separately flagged that
  `schemas/rule.schema.json` requires 9 fields rather than the plan's illustrative "5-field" language).
  Cross-check: a fresh unsandboxed `propose` run (below) regenerates all 7 pack files including
  `rules.json`/`rule-provenance.json`; `verify --pack <dir> --rule-schema schemas/rule.schema.json` reports
  `rulesJson: { count: 4, valid: true }`. `rule.schema.json`'s 9-required-field shape (an already-hardened
  EP-4 governance extension, not something newly authored in Phase 3) is correctly carried directly on
  each staged rule, while everything that schema's `additionalProperties: false` actually rejects
  (`basis.*`, `missingness`, `localProfileRequirement`, `testIds`, `reviewStatus`, `reviewBy`, `supersedes`,
  `authoringNotes`) is exactly what `rule-provenance.json` carries instead — nothing is silently dropped.
  This stale-plan-language vs. current-schema-shape mismatch was already flagged in P3-T5/P3-T6's own
  completion notes as a documentation-drift item, not a functional gap.
  `node --test tests/ef-converter-rule-provenance-projection.test.mjs` passes (12/12), including the
  seeded-missing-`basis.decisionId` case.

## P3-T7 — propose verb + conflict-visibility test

- [x] `propose` run against the fixture succeeds and every emitted file validates against its schema; the
  conflict-visibility test fails if a `mixed` claim is ever the sole basis for a generated rule — MET
  (Codex reported this NOT MET; its read-only sandbox hit `EPERM` writing the test's temp output
  directory — a sandbox artifact, not a real failure). Reproduced directly, unsandboxed:
  ```
  node tools/rf-bundle-to-kb-pack/cli.mjs propose \
    --run-dir tests/fixtures/rf-cbc-001 \
    --module modules/cbc_suite_v1/module.json \
    --decisions modules/cbc_suite_v1/authoring-decisions.yaml \
    --out /tmp/p3-verify-out
  ```
  exited 0 and wrote all 7 files (`pack-provenance.json`, `evidence.json`, `evidence-assertions.json`,
  `candidates.json`, `rule-proposals.json`, `rules.json`, `rule-provenance.json`); routing summary reported
  `eligibleForRuleEvidence: 27, conflictObjects: 0, rejected: 60`.
  `node tools/rf-bundle-to-kb-pack/cli.mjs verify --pack /tmp/p3-verify-out --rule-schema schemas/rule.schema.json`
  exited 0 with `rulesJson: { present: true, count: 4, valid: true }`.
  `node --test tests/ef-converter-propose.test.mjs` passes (13/13) unsandboxed, including the
  `assertNoSoleConflictedBasis` suite (throws on mixed-only, throws on mixed+contradicted combined, does
  not throw with a real supported anchor, does not throw for the real `RULE_PROPOSALS` against the real
  fixture's routing report).

## Phase 3 Quality Gates

- [x] `propose` run against the fixture produces a schema-valid pack under `build/kb-pack/` (never
  committed) — MET (corrected sandbox artifact, see P3-T7 above). Reproduced live; `build/` is listed in
  `.gitignore`; `git status --short` on the worktree is clean.
- [x] Zero rule proposal has a mixed/contradicted claim as its sole positive basis — MET: the live
  `propose` run's routing summary reports `conflictObjects: 0`, and `tests/ef-converter-propose.test.mjs`'s
  seam-invariant-8 (`assertNoSoleConflictedBasis`) suite passes against both synthetic stub cases and the
  real fixture.
- [x] All 4 new/extended schemas (`evidence-assertions`, `authoring-decisions`, `rule-provenance`) reject a
  fixture missing a required field — MET (Codex initially checked the wrong fixture for the 4th schema —
  `tests/fixtures/invalid-rule/SYNTHETIC-INVALID-EXTRA-PROP-001.json.txt` is a pre-existing P1-T5 fixture
  that seeds an `additionalProperties` violation, not a missing-required-field one, so it does not itself
  satisfy this AC for `rule.schema.json`). Cross-check confirms all 3 Phase-3-authored schemas each have
  their own committed seeded-bad-fixture test proving fail-closed missing-field rejection:
  `evidence-assertions.schema.json` (missing `exactPassageSha256`,
  `tests/evidence-assertions-schema.test.mjs`), `authoring-decisions.schema.json` (missing
  `basis.reasoning`, `tests/authoring-decisions-schema.test.mjs`), `rule-provenance.schema.json` (missing
  `basis.decisionId`, in-test mutation in `tests/ef-converter-rule-provenance-projection.test.mjs`) — all
  pass. `rule.schema.json`'s own missing-required-field rejection (distinct from the P1-T5
  additionalProperties fixture) is separately proven by the pre-existing
  `tests/rule-governance.test.mjs`'s "a rule missing a required governance field is rejected" test, which
  loops every governance field and passes (11/11 in that file).

## Cross-check evidence (full-suite green)

- `npm run validate` (unsandboxed): clean — `cbc_suite_v1 (0 rules, 0 candidates, 8 evidence records, 8
  passage records, 19 evidence-assertions, 4 authoring-decisions)` (rules/candidates correctly still 0 in
  the *committed* module tree — P3-T5's AC explicitly requires drafting output stay in `build/kb-pack/`
  and not yet land in `modules/cbc_suite_v1/`; that migration is Phase 4's job).
- `npm test` (unsandboxed): 1012/1012 pass.
