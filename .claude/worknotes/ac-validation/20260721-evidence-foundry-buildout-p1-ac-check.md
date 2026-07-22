validator: codex/gpt-5.6-terra

# Evidence Foundry Buildout — Phase 1 (Foundation & Fixtures) — P1-GATE AC validation

Primary validation run by Codex (`codex exec -m gpt-5.6-terra --sandbox read-only`) against the
worktree at `.claude/worktrees/evidence-foundry-buildout`. Two of Codex's findings were cross-checked
directly (unsandboxed, per task instructions) because the sandbox can produce spurious failures;
both cross-checks reversed Codex's initial NOT MET verdict — see "Cross-check corrections" below.

**Supersedes a stale prior version of this file** that reported 12/18 MET with two named
regressions (a P1-T5 fixture colliding with `backfill-rule-governance.mjs`'s coverage-sweep glob,
and a missing envelope field-presence check in `scripts/validate-kb.mjs`). Both regressions were
already fixed by commit `2241fce` ("fix(P1): fixture off governance sweep glob; envelope
field-presence validation in validate-kb") before this validation pass ran; the fixture is now named
`tests/fixtures/invalid-rule/SYNTHETIC-INVALID-EXTRA-PROP-001.json.txt` (excluded from the sweep) and
`scripts/validate-kb.mjs:554-562` enforces envelope field presence for every non-legacy module. This
run re-verifies against the current tree/commit state, not the stale file's snapshot.

## P1-T1 — Path-mapping worknote

- [x] Worknote committed at `.claude/worknotes/evidence-foundry-buildout/path-mapping.md` — MET: `git log` shows it committed in `306af3a`; worktree clean.
- [x] Reconciles every stale-path row from `02-evidence-foundry-on-research-foundry.md` to current-tree equivalents — MET: `path-mapping.md:33-41` maps all seven specified paths (`data/rules.json`, `data/evidence.json`, `data/candidates.json`, `data/rule-provenance.json`, `data/evidence-assertions.json`, `data/questions.json`, `src/evidence.js`).
- [x] Explicit confirmation line that `npm test`'s glob is unaffected — MET: `path-mapping.md:81` confirms the actual glob (`tests/*.test.mjs tests/witness/*.test.mjs`) is untouched.

## P1-T2 — `modules/cbc_suite_v1/module.json` envelope

- [x] `module.json` parses; unsigned-stub shape present (id, status, clinicalContentHash: null, approvedBy: [], validationRunId: null, supersedes: null, releasedAt: null) — MET: `modules/cbc_suite_v1/module.json:2-18`.
- [x] All 8 envelope fields present (module_topic, intended_hcp_users, patient_population, intended_output, explicit_exclusions, jurisdictions, integration_targets, evidence_policy) — MET: `module.json:19-65`.
- [x] `scripts/validate-kb.mjs` checks field presence on the envelope block (not just stub shape), exempting legacy `anemia` — MET: `validate-kb.mjs:554-562` (landed in commit `2241fce`, after the stale prior version of this file was written).

## P1-T3 — `modules/cbc_suite_v1/` package scaffold + registry wiring (OQ-1)

- [x] `getModule('cbc_suite_v1')` resolves — MET: direct Node check returned `getModule=cbc_suite_v1`.
- [x] `MODULE_IDS` includes both `'anemia'` and `'cbc_suite_v1'` — MET: direct Node check returned `["anemia","cbc_suite_v1"]`.
- [x] `DEFAULT_MODULE_ID === 'anemia'`; existing tripwire assertion in `tests/module-registry.test.mjs` still passes — MET: direct check returned `default=anemia`; test passes.
- [x] Tripwire comment in `src/modules/registry.js` updated (not left stale) — MET: `registry.js:37` explains why `'anemia'` remains default now that a second module exists.
- [x] `deriveFacts(input, 'cbc_suite_v1')` identical to `deriveFacts(input, 'anemia')` for same input — MET: direct check returned `factsEqual=true`; `tests/module-equivalence.test.mjs` passes 6/6.

## P1-T4 — Evidence-registry unification

- [x] `src/evidence.js` no longer independently hand-maintains evidence content — MET: `evidence.js:10` imports `modules/anemia/evidence.json`; exports derive from it at `evidence.js:12`.
- [x] Existing callers (`scripts/validate-kb.mjs`, `src/app.js`, `server.mjs`) required zero edits — MET (Codex initially flagged NOT MET on a wrong-commit check; corrected below).
- [x] `npm run check` stays green — MET (Codex's sandbox reported spurious EPERM failures; corrected below).

## P1-T5 — Real JSON-Schema validation in `scripts/validate-kb.mjs`

- [x] Seeded-bad rule (extra property) fails `npm run validate` with a specific schema-violation message — MET: `tests/rule-schema-seeded-invalid.test.mjs:62` asserts `$.notAllowedExtraField ... additional property is not permitted`; test passes (4/4).
- [x] All 91 `modules/anemia/rules.json` entries and the empty `modules/cbc_suite_v1/rules.json` still pass — MET: `npm run validate` — anemia 91 rules, cbc_suite_v1 0 rules, both green. The fixture (`tests/fixtures/invalid-rule/SYNTHETIC-INVALID-EXTRA-PROP-001.json.txt`) is named `.json.txt` specifically so `backfill-rule-governance.mjs`'s `tests/fixtures` coverage sweep skips it — the mitigation confirmed present via commit `2241fce`, and `tests/rule-governance.test.mjs` passes 11/11.

## P1-T6 — Sanitized fixture bundle (OQ-2)

- [x] Fixture bundle committed under `tests/fixtures/rf-cbc-001/`, derived from RF-CBC-001 (not REG-001/REG-004) — MET: `git log -- tests/fixtures/rf-cbc-001` shows committed in `306af3a`/`2241fce`.
- [x] Hash-provenance note names RF-CBC-001 explicitly and states rights disposition per passage — MET: `HASH-PROVENANCE.md:4` names RF-CBC-001; lines 27-35 state 74/74 restricted hash+selector disposition.
- [x] No unredacted full-text quotes remain where rights disposition disallows it — MET: fixture `quote:` fields grep as redacted SHA-256 placeholders; sanitization method documented at `HASH-PROVENANCE.md:60`.

## P1-T7 — `.gitignore` — `build/` (OQ-6)

- [x] `.gitignore` contains a `build/` entry — MET: `.gitignore:8`.
- [x] Synthetic path under `build/` is ignored per `git check-ignore` — MET: `git check-ignore -v build/kb-pack/testfile.txt` returned `.gitignore:8:build/`.

## Phase 1 Quality Gates checklist

- [x] `npm run check` green — MET (corrected, see below).
- [x] `cbc_suite_v1` fixture/module loads via `getModule('cbc_suite_v1')` — MET (see P1-T3).
- [x] Seeded-bad-KB fixture fails `npm run validate` with a specific schema error — MET (see P1-T5).
- [x] `src/evidence.js` no longer independently hand-maintains evidence content — MET (see P1-T4).
- [x] Path-mapping worknote exists and is referenced by the parent plan — MET: referenced at `evidence-foundry-buildout-v1.md:119`.

## Phase 1 progress-file success criteria (SC-1..SC-5)

- [x] SC-1: `npm run check` green — MET (corrected, see below).
- [x] SC-2: `cbc_suite_v1` fixture/module loads via `getModule('cbc_suite_v1')` — MET.
- [x] SC-3: Seeded-bad-KB fixture fails `npm run validate` with a specific schema error — MET.
- [x] SC-4: `src/evidence.js` no longer independently hand-maintains evidence content — MET.
- [x] SC-5: Path-mapping worknote exists and is parent-referenced — MET.

## Cross-check corrections (per Mode A instruction: cross-check Codex sandbox failures against a direct unsandboxed run)

1. **`npm run check` green.** Codex's read-only sandbox reported `npm run check` exiting nonzero with
   5 `EPERM` filesystem-operation failures (spurious — the sandbox blocks writes the build/smoke
   scripts need). Direct unsandboxed run in this same worktree: `npm run check` exit code `0`; test
   summary `# tests 852 / # pass 852 / # fail 0`; build, `verify:d4`, `check:imports`,
   `smoke:browser`, and `smoke` steps all completed with `OK`/"passed" output and no failures. Codex's
   NOT MET verdict is a sandbox artifact — corrected to MET.
2. **P1-T4 caller-edits AC (`src/app.js` etc. need zero edits).** Codex reported NOT MET, citing
   `git diff 28c1487^ 28c1487 -- src/app.js` showing an edit to `src/app.js`. That commit
   (`28c1487`, "Phase EP-3+EP-4: Evidence Provenance & Rule Governance") is a pre-existing commit from
   an entirely separate, already-merged track that predates this branch's root commit (`eafd5bc`) —
   it is not part of this phase's P1-T4 work and was already flagged as such in P1-T1's worknote and
   the P1-T4 task summary. The actual P1-T4 work for this phase is commit `80c5906`
   ("wip(P1): P1-T4"), which touches only the progress-tracking file
   (`.claude/progress/evidence-foundry-buildout/phase-1-progress.md`) — `git show --stat 80c5906`
   confirms no `src/app.js` change, and `git diff eafd5bc..HEAD -- src/app.js` is empty. Corrected to
   MET.

## Result

31/31 acceptance criteria MET (all items across P1-T1..P1-T7, the Phase 1 Quality Gates checklist,
and the progress-file success criteria SC-1..SC-5). No NOT MET items remain after cross-check.
Phase 1 exit gate is satisfied: `npm run check` green (852/852, exit 0); `cbc_suite_v1` fixture/module
loads; seeded-bad-KB fixture fails `npm run validate` with a specific schema error; the sanitized
RF-CBC-001 fixture bundle loads/is committed with hash-provenance; the path-mapping worknote is
committed and referenced by the parent plan.
