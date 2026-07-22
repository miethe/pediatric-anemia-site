# P5-T2 — Honesty-language audit (FR-28)

**Task**: Phase 5, P5-T2. **Scope**: exactly the 9 target surfaces named in the task description
(R-P1 bounded audit — never an unbounded "everything" sweep). **Method**: full read of every file
under each surface, plus two keyword sweeps (clinical-validity/safety/regulatory/release-readiness
terms; softer terms — "proven"/"accurate"/"recommend"/"certif"/"qualif"/"guarantee"/"validated") over
the same file set, with every hit manually reviewed for context (negation vs. assertion).

**Result: 9/9 surfaces PASS on honesty language.** Zero instances found, anywhere in scope, of
language stating or implying clinical validity, safety, diagnostic performance, release-readiness,
or regulatory status as an actual (non-negated) claim. Every metric in `agreement-report.json` is
labeled `"software agreement"`. Every committed synthetic review record and every render-fixture
record carries an explicit `synthetic`/non-qualifying/non-credentialed label. Three **documentation
staleness** findings (not honesty-language violations) were found and fixed in place — see below.

## Pass/fail checklist (one line per surface, for karen / P5-GATE2)

| # | Surface | Files | Verdict |
|---|---|---|---|
| 1 | New schema description strings | `schemas/review-record.schema.json`, `schemas/reviewer-roster.schema.json`, `schemas/release-registry.schema.json`, `tools/retro-validate/schemas/{access-log-entry,discordance-record,fixture-corpus,protocol}.schema.json` | **PASS** — every top-level and field-level `description` that touches validity carries an explicit "structural claim only, never clinical validity/safety" disclaimer; `protocol.schema.json`'s threshold fields are `const: null` with description text stating software never invents a clinical threshold. |
| 2 | 3 tool READMEs + CLI help/output strings | `tools/review-record/README.md`, `tools/release-sign/README.md`, `tools/retro-validate/README.md`, all three `cli.mjs` `HELP_TEXT` blocks, every `process.stdout.write`/`process.stderr.write` call site under `tools/{review-record,release-sign,retro-validate}/lib/` | **PASS** (2 doc-staleness fixes applied — see below). Every verb's printed output and every README status banner state the "structural only / never clinical validity, safety, or release authorization" posture; no CLI output string implies release-readiness. |
| 3 | Render HTML template + banner copy | `tools/review-record/lib/render.mjs`, `tools/review-record/lib/verbs/render.mjs`, golden fixture `tests/fixtures/ef-review-render/golden/render_fixture_v1.html` | **PASS** — every rendered page carries `UNVALIDATED_PROTOTYPE_BANNER` (header + footer, verbatim-shared with `retro-validate`'s own banner) and every synthetic record card carries `NON_QUALIFYING_RECORD_LABEL`; zero `<script>`/`<a href>` in output. |
| 4 | `docs/governance/gates-registry.md` | full file | **PASS** — opens with the unvalidated-research-prototype banner, states it "does not grant, imply, or record clinical approval of anything," and every gate row's mechanism section is honest about what stays structurally inert until a named human act occurs. |
| 5 | `docs/governance/signing-ceremony-runbook.md` | full file | **PASS** (2 doc-staleness fixes applied — see below). States a valid signature "confers no clinical standing whatsoever" and clinical release authorization is a separate act (G4). |
| 6 | `docs/project_plans/SPIKEs/spike-007-retrospective-data-source.md` | full file | **PASS** — explicit "Honesty boundary" section states the charter contains no findings/partner selection/DUA terms and is never clinical validation, regulatory clearance, or IRB approval; frontmatter `status: chartered-not-run` matches body content exactly. |
| 7 | `agreement-report.json` headers + metric names | `build/retro-runs/e0-dangerous-miss-cbc-suite-v1/sha256-.../agreement-report.json` | **PASS** — all 3 banners present (`unvalidatedPrototype`, `softwareAgreementNegation`, `nonQualifyingProtocol`); every one of the 5 measures carries `"label": "software agreement"`; zero use of "sensitivity"/"specificity"/"clinical performance" outside the negation banner (grep-test-enforced per `tools/retro-validate/README.md`). |
| 8 | Committed dry-run artifacts under `modules/cbc_suite_v1/reviews/` | `rr-0001-clinical-1.yaml` .. `rr-0005-release-auth.yaml` | **PASS** — all 5 records carry `synthetic: true`, `TESTKEY-`-prefixed `signature.keyId`, and a `rationale` field explicitly stating "SYNTHETIC"/"NON-CREDENTIALED"/"not a clinical assessment" in every record; `rr-0005` additionally states it is "STRUCTURALLY NON-QUALIFYING for release authorization by design." |
| 9 | P5-T3/T4 architecture + CHANGELOG additions | `docs/architecture.md` §11–§13, `CHANGELOG.md` `[Unreleased]` → "Evidence Foundry E1: Clinical Governance Triad" entry | **PASS** — each of the 3 new architecture sections opens with "Status: unvalidated research prototype" plus a section-specific never-implies-clinical-X sentence; the CHANGELOG entry's header sentence restates "still an unvalidated research prototype... proves nothing about clinical validity, safety, diagnostic performance, or regulatory status" and every bullet uses "schema-forced inert"/"synthetic-only"/"human-gated" framing, never a capability claim. |

## Findings fixed in place (documentation staleness, not honesty-language violations)

None of these state or imply clinical validity/safety/release-readiness — they are factual
staleness (a doc describing tooling as "not yet implemented"/"forthcoming" when it has since
landed on this branch). Fixed because an inaccurate governance doc undermines the same honesty
posture this audit exists to protect, even where the specific inaccuracy is not itself a clinical
claim.

1. `tools/release-sign/README.md` (2 spots) — referred to `docs/governance/signing-ceremony-runbook.md`
   as "forthcoming" / "(P3-T7, not yet authored)"; the runbook has since landed (P3-T7, commits
   `3e1d926`/`668d1a9`). Updated both references to plain citations.
2. `docs/governance/signing-ceremony-runbook.md` §4.7/§4.8 — described `register` (P3-T4) and
   `verify` (P3-T3) as "not yet implemented," which was already false as of this runbook's own
   authoring commit (both verbs landed in earlier commits on this branch, `d38dfc8`/`930c430`).
   Re-worded both subsections to state the verbs are implemented, without changing the procedure
   they describe.
3. `tools/retro-validate/README.md` (2 spots) — (a) `tests/ef-retro-boundary.test.mjs`'s own
   coverage note still described `report`'s post-boundary behavior as "scaffold NotImplementedError
   (still P4-T4-pending)"; the test file itself proves `report` has real post-boundary logic since
   P4-T4 (verified by reading the test). (b) The "Version-pinned replay" section stated
   `releases/registry.json` "does not exist yet (P3-T4)"; it exists at the repo root today (seeded
   empty by P3-T4, verified by reading the file). Both corrected to reflect current repo state.

## Verification

- `node --test tests/ef-retro-boundary.test.mjs tests/ef-retro-determinism.test.mjs tests/ef-retro-metrics.test.mjs tests/ef-release-sign-verify.test.mjs tests/ef-release-no-keys.test.mjs tests/ef-review-workflow.test.mjs` — all green (documentation-only edits; no code touched).
- `npm run validate` — green (unaffected; no schema/fixture touched).
- No schema, fixture, or code file was modified by this task — only prose in 3 already-in-scope
  Markdown files (`tools/release-sign/README.md`, `docs/governance/signing-ceremony-runbook.md`,
  `tools/retro-validate/README.md`).
