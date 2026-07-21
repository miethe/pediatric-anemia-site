validator: codex/gpt-5.6-terra

# Evidence Foundry Buildout — Phase 1 (Foundation & Fixtures) AC Validation

Driven via `codex exec -m gpt-5.6-terra --sandbox read-only` against the repo working tree
(prompt at the AC list below; full raw output preserved out-of-band). Codex's own read-only
sandbox blocked several tests' `mkdtemp`/temp-file/symlink writes, producing 5 spurious
EPERM-style failures (`npm test` → 846/852 under Codex's sandbox). The harness (this driver)
cross-checked every finding with a direct, unsandboxed `node --test tests/*.test.mjs
tests/witness/*.test.mjs` run, which is authoritative: **851/852 pass, exactly 1 real
failure** (`tests/rule-governance.test.mjs`, "backfill-rule-governance.mjs --check exits 0
against the committed rules.json"), reproduced in isolation
(`node --test tests/rule-governance.test.mjs` → 10/11, same failure). The other 5 tests Codex's
sandbox reported as failing (`tests/xxx.test.mjs` lines 39, 605, 606, 629, 646 in its raw
transcript) all pass under an unsandboxed run and are recorded here as sandbox artifacts, not
findings.

**Interpretation note on the word "committed" in several AC lines below**: this project's
documented git workflow (CLAUDE.md: "branch off main, `npm run check` green, commit per phase,
PR to the parent branch") commits *after* the exit gate goes green, not before. Per
`git status --porcelain`, every Phase-1-authored artifact (`.claude/worknotes/.../path-mapping.md`,
`modules/cbc_suite_v1/`, `tests/fixtures/rf-cbc-001/`, `tests/fixtures/invalid-rule/`,
`tests/rule-schema-seeded-invalid.test.mjs`) is currently untracked (`??`) — expected at this
point in the workflow, not a functional defect. MET/NOT MET calls below are based on content and
behavior, not git-tracking state; the untracked state is recorded as a standing caveat and does
not by itself flip a line to NOT MET.

## Per-task Acceptance Criteria (phase-1-2-foundation-converter.md, Phase 1 table)

- [x] [P1-T1] Worknote committed; every stale-path row present with its current-tree equivalent; explicit npm-test-glob confirmation line — MET: `.claude/worknotes/evidence-foundry-buildout/path-mapping.md` contains all 7 stale-path rows (`data/rules.json`, `data/evidence.json`, `data/candidates.json`, `data/rule-provenance.json`, `data/evidence-assertions.json`, `data/questions.json`, `src/evidence.js`) each mapped to its current-tree equivalent, an explicit "§3. `npm test` glob confirmation (OQ-5)" section, and is cross-referenced from the parent plan (`evidence-foundry-buildout-v1.md` lines 119/374/452). (Untracked in git — see interpretation note above.)
- [ ] [P1-T2] `module.json` parses; unsigned-stub shape + all 8 envelope fields present; `scripts/validate-kb.mjs` checks field presence on the envelope block — NOT MET: `modules/cbc_suite_v1/module.json` parses and contains all 21 expected keys (13 stub-shape + `module_topic`/`intended_hcp_users`/`patient_population`/`intended_output`/`explicit_exclusions`/`jurisdictions`/`integration_targets`/`evidence_policy`, verified via `node -e "require(...)"`) — but `grep -nE "module_topic|intended_hcp_users|patient_population|intended_output|explicit_exclusions|jurisdictions|integration_targets|evidence_policy" scripts/validate-kb.mjs` returns zero matches. The AC's specific "checks field presence on the envelope block" clause has no implementation anywhere in the validator.
- [x] [P1-T3] `getModule('cbc_suite_v1')` resolves; `MODULE_IDS` has both ids; `DEFAULT_MODULE_ID==='anemia'` tripwire still passes; tripwire comment updated; `deriveFacts` identical for both modules — MET: `tests/module-registry.test.mjs`, `tests/module-equivalence.test.mjs`, `tests/module-manifest-schema.test.mjs` all pass under both Codex's run and the harness's direct unsandboxed run (none of these 3 files appear among the 1 real failing test); `src/modules/registry.js`'s tripwire comment is updated to explain the two-module state (confirmed by direct read), not left stale.
- [ ] [P1-T4] `src/evidence.js` no longer hand-maintains evidence content; existing callers need zero edits; `npm run check` stays green — NOT MET on the full AC: `src/evidence.js` is confirmed a thin `with { type: 'json' }` loader over `modules/anemia/evidence.json` (read directly — the `EVIDENCE`/`KNOWLEDGE_BASE_VERSION`/`REVIEWED_THROUGH` exports are all derived from the JSON import, no hand-authored duplicate object), and `scripts/validate-kb.mjs`/`src/app.js`/`server.mjs` needed no edits for this — but `npm run check` is not green: direct `node --test tests/*.test.mjs tests/witness/*.test.mjs` shows 851/852 pass, 1 real failure (see P1-T5 below), so the compound AC's "stays green" clause fails, even though the evidence-unification behavior itself is correct.
- [ ] [P1-T5] Seeded-bad rule fails validate with a specific schema-violation message; all 91 anemia + empty cbc rules still pass — NOT MET on the compound AC (narrow schema-validation behavior alone is MET): `node --test tests/rule-schema-seeded-invalid.test.mjs` passes 4/4 with the exact `$.notAllowedExtraField ... additional property is not permitted` message, and `npm run validate` is green (anemia 91/26/6, cbc_suite_v1 0/0/0, confirmed by direct run). However this task's fixture placement is a genuine, currently-reproduced regression: `tests/fixtures/invalid-rule/SYNTHETIC-INVALID-EXTRA-PROP-001.json` (a plain `.json` file) falls inside `scripts/evidence/backfill-rule-governance.mjs`'s swept `fixtureDirs: ['tests/witness', 'tests/fixtures']` coverage-regeneration glob, so the regenerated `witnessFixtures` list for rule `NEUTRO-001`'s ordering diverges from the committed `modules/anemia/rules.json`, and `tests/rule-governance.test.mjs`'s "`backfill-rule-governance.mjs --check exits 0`" subtest fails (reproduced in isolation: `node --test tests/rule-governance.test.mjs` → 10/11, exact diff shows the fixture-path insertion shifting subsequent array entries). P1-T6 avoided this exact trap for its own ledger file by naming it `.json.txt`; P1-T5 did not apply the same mitigation.
- [x] [P1-T6] Fixture bundle committed under `tests/fixtures/`; hash-provenance note names `RF-CBC-001` + rights disposition per passage; loadable — MET: `tests/fixtures/rf-cbc-001/` exists with all expected subdirectories (`claims/`, `evidence_bundle.yaml`, `extractions/`, `HASH-PROVENANCE.md`, `passage-hash-ledger.json.txt`, `reports/`, `research_brief.md`, `reviews/`, `sources/`, `swarm_plan.yaml`, `writebacks/`); `HASH-PROVENANCE.md` explicitly names `RF-CBC-001` (run id `rf_run_20260717_rf_cbc_001_pediatric_cds_establish`) in 5 places and states the per-passage rights disposition (all 12 source cards `usage.allowed_for_public_output=false`, hence hash-only redaction across 198 passages). Load-through by P2's loader is not yet testable (Phase 2 hasn't started) — per the AC's own "once it exists" qualifier, not-yet-applicable rather than a failure. (Untracked in git — see interpretation note above.)
- [x] [P1-T7] `.gitignore` has a `build/` entry; converter output ignored not untracked — MET: `.gitignore` line 8 is exactly `build/`, confirmed via direct grep. The "git status after a local propose run" clause is not yet testable (P3/`propose` doesn't exist) — not-yet-applicable, not a failure.
- [ ] [P1-GATE] All 4 exit-gate criteria pass; recorded in phase progress note — NOT MET: `npm run check`'s `test && validate && build && check:imports && smoke` chain short-circuits on the real `npm test` failure (test 625, root-caused above), so `npm run check` currently exits non-zero (confirmed: `npm run validate` alone is green in isolation, but the full chain never reaches it in a real `npm run check` invocation). `.claude/progress/evidence-foundry-buildout/phase-1-progress.md` frontmatter also still shows `status: pending`, `completed_tasks: 2`, all 5 `success_criteria` `pending` — the progress doc has not been synced past P1-T2/P1-T5, a separate tracking gap from the functional regression.

## Phase 1 Quality Gates checklist

- [ ] `npm run check` green — NOT MET: direct unsandboxed `node --test tests/*.test.mjs tests/witness/*.test.mjs` → 851/852 pass, 1 real failure (`tests/rule-governance.test.mjs`, root-caused to P1-T5's fixture placement above); `npm run check`'s `&&` chain short-circuits on this before `validate`/`build`/`check:imports`/`smoke` even run.
- [x] `cbc_suite_v1` fixture/module loads via `getModule('cbc_suite_v1')` — MET (same evidence as P1-T3 above; independently confirmed, unaffected by the unrelated regression).
- [x] Seeded-bad-KB fixture fails `npm run validate` with a specific schema error — MET (same narrow evidence as P1-T5 above: the schema-violation behavior itself is correct and independently verified).
- [x] `src/evidence.js` no longer independently hand-maintains evidence content — MET (same evidence as P1-T4 above; this line asserts a fact about `src/evidence.js` specifically, which is independently true regardless of the unrelated `npm run check` regression).
- [x] Path-mapping worknote exists and is referenced by this plan — MET (same evidence as P1-T1 above: content complete, cross-referenced from the parent plan).

## Phase 1 progress `success_criteria` (phase-1-progress.md frontmatter)

- [ ] [SC-1] `npm run check` green — NOT MET (same evidence as the Quality Gates line above; frontmatter also still marks this `pending`).
- [x] [SC-2] `cbc_suite_v1` fixture/module loads via `getModule('cbc_suite_v1')` — MET (same evidence as P1-T3).
- [x] [SC-3] Seeded-bad-KB fixture fails `npm run validate` with a specific schema error — MET (same evidence as P1-T5's narrow schema behavior).
- [x] [SC-4] `src/evidence.js` no longer independently hand-maintains evidence content — MET (same evidence as P1-T4's evidence-unification clause).
- [x] [SC-5] Path-mapping worknote exists and is referenced by the parent plan — MET (same evidence as P1-T1).

## Summary

**Met: 12 / 18.**

One real, currently-reproduced root cause explains every remaining gap that blocks the Phase 1
exit gate itself:

1. **P1-T5's seeded-invalid-rule fixture regresses rule governance.** `tests/fixtures/invalid-rule/SYNTHETIC-INVALID-EXTRA-PROP-001.json` sits inside `scripts/evidence/backfill-rule-governance.mjs`'s swept `fixtureDirs: ['tests/witness', 'tests/fixtures']` coverage tree. Regenerating governance coverage against the current tree produces a `witnessFixtures` ordering for `NEUTRO-001` that differs from the committed `modules/anemia/rules.json`, failing `tests/rule-governance.test.mjs`'s `--check` subtest (1/852 `npm test` failures, reproduced in isolation). This is the single blocker for `npm run check` green (P1-GATE, SC-1, Quality-Gates "`npm run check` green"). **Fix**: rename/relocate the fixture off the `.json` coverage-sweep glob — e.g. `tests/fixtures/invalid-rule/SYNTHETIC-INVALID-EXTRA-PROP-001.json.txt` plus a JSON.parse in the test — the same mitigation P1-T6 already applied to its own ledger file, or explicitly exclude `tests/fixtures/invalid-rule/` from `backfill-rule-governance.mjs`'s `fixtureDirs` sweep.
2. **P1-T2's field-presence gap is a genuine, standalone finding, independent of #1**: `scripts/validate-kb.mjs` has zero references to any of the 8 module-variable-envelope field names — the fields exist correctly in `modules/cbc_suite_v1/module.json` and are schema-optional by design, but nothing validates their presence anywhere, as the AC requires.

All artifacts authored in Phase 1 (`path-mapping.md`, `modules/cbc_suite_v1/`, `tests/fixtures/rf-cbc-001/`, `tests/fixtures/invalid-rule/`, `tests/rule-schema-seeded-invalid.test.mjs`) are currently untracked in git (`git status --porcelain` shows `??`) — consistent with this project's "commit after `npm run check` is green" workflow, not counted as a functional defect on its own, but noted since it means none of Phase 1 has actually been committed yet.

Every MET/NOT MET call above was cross-checked directly by the harness (`node --test`, `grep`, `node -e`, direct file reads) rather than taken from Codex's sandboxed transcript at face value; 5 of Codex's own reported test failures were sandbox artifacts (read-only sandbox blocking `mkdtemp`/symlink/temp-file writes) and are excluded from the findings above.
