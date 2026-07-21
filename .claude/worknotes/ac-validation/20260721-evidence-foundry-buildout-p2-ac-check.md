validator: codex/gpt-5.6-terra

Note on method: Codex (gpt-5.6-terra, `--sandbox read-only`) drove the initial pass. Its read-only
sandbox denies temp-directory creation (`mkdtemp`/`mkdir` in `os.tmpdir()`), which most of these
tests use for isolated fixtures — Codex reported 33 spurious `EPERM` "NOT MET" results as a result.
Per task instructions, every Codex-reported failure below was cross-checked with a direct,
unsandboxed `node --test` / CLI run in this worktree. Unsandboxed: `node --test
tests/ef-converter-*.test.mjs` → **90/90 pass, 0 fail** (loader 9, hashing 5, eligibility 29,
error-taxonomy 11, inspect 6, verify 13, invariants 17 = 90). `npm run validate` → exit 0. All
corrections below are marked "(corrected from Codex's sandbox-EPERM false negative)".

## P2-T1 — Converter CLI scaffold + design

- [x] P2-T1-AC1: `node tools/rf-bundle-to-kb-pack/cli.mjs --help` lists inspect/verify/propose; propose exits non-zero "not yet implemented" — MET: direct run confirms `--help` exit 0 lists all 3 verbs; `propose` exits 1 with `UsageError: propose: not yet implemented — wired in Phase 3 (02 §4.5; ...)`.
- [x] P2-T1-AC2: README documents the module boundary (loader/hashing/eligibility/error-taxonomy/verb-handlers) for subsequent Phase 2/Phase 3 tasks — MET: `tools/rf-bundle-to-kb-pack/README.md` has a "Module boundary" table (loader/hashing/eligibility/verb handlers), a "Seam invariants (02 §2.3) — where each one is enforced" table (all 15), and a "Design decisions" section.

## P2-T2 — Read-only bundle loader

- [x] P2-T2-AC1: Loader resolves every artifact in `tests/fixtures/rf-cbc-001`'s `evidence_bundle.yaml.artifacts` — MET (corrected from Codex's sandbox-EPERM false negative): `node --test tests/ef-converter-loader.test.mjs` → 9/9 pass; direct `inspect` run against the real fixture (with a throwaway module/decisions pair) lists 33 artifacts (module.json, decisions, evidence_bundle.yaml, research_brief.md, swarm_plan.yaml, claim_ledger.yaml, report_draft.md, verification.yaml, ccdash_event.yaml, 12 source cards, 12 extraction cards).
- [x] P2-T2-AC2: Missing `authoring-decisions.yaml` produces a specific named fail-closed error, not a generic crash — MET: loader raises `DecisionsNotFoundError`; confirmed both by test suite and by a direct `inspect --module modules/cbc_suite_v1/module.json` run against the real (decisions-less) module, which exits 1 with the named error rather than an uncaught stack trace.
- [x] P2-T2-AC3: A test asserts the run directory's file mtimes/permissions are unchanged after a full loader pass — MET (corrected from Codex's sandbox-EPERM false negative): `ef-converter-loader.test.mjs` includes the mtimeMs/mode/size snapshot test; passes unsandboxed.

## P2-T3 — Hash pinning

- [x] P2-T3-AC1: Every artifact in the fixture is SHA-256 hashed — MET (corrected): `node --test tests/ef-converter-hashing.test.mjs` → 5/5 pass; direct `inspect` output shows a `sha256` field on all 33 listed artifacts.
- [x] P2-T3-AC2: A one-byte post-pin mutation of a source card is detected as drift and fails closed — MET (corrected from Codex's sandbox-EPERM false negative): hashing test suite includes this exact case, raising `HashMismatchError`; passes unsandboxed.
- [x] P2-T3-AC3: A `../` path-escape attempt is rejected — MET (corrected): covered in `ef-converter-hashing.test.mjs` (rejected upstream by `loadBundle` before `pinArtifacts` runs); passes unsandboxed.

## P2-T4 — Eligibility + status reconciliation

- [x] P2-T4-AC1: A seeded non-`verified`-status bundle produces non-zero exit + zero output files — MET: `ef-converter-eligibility.test.mjs` covers `BundleNotVerifiedError`; 29/29 pass unsandboxed.
- [x] P2-T4-AC2: A seeded exit-code/verification-status mismatch is rejected with a specific named error — MET: `VerificationStateMismatchError` tests pass in the same file.

## P2-T5 — Fail-closed error taxonomy

- [x] P2-T5-AC1: Each of the 8 rf exit codes has a distinct named error class — MET: `lib/errors.mjs` defines `UsageError`(1)/`SchemaError`(2)/`GovernanceError`(3)/`UnsupportedError`(4)/`BudgetError`(5)/`AdapterError`(6)/`HumanReviewError`(7) plus a frozen `ERROR_CLASSES_BY_EXIT_CODE` registry and `isHaltingExitCode()`; `node --test tests/ef-converter-error-taxonomy.test.mjs` → 11/11 pass.
- [x] P2-T5-AC2: Exit 3 (governance) and exit 7 (human-review) specifically bypass the generic-error handler — MET: dedicated tests assert `dispatchVerb()` does not remap these to `EXIT_USAGE`; pass unsandboxed.

## P2-T6 — `inspect` verb

- [x] P2-T6-AC1: `inspect` against the fixture prints a structured, non-empty summary and emits no pack output — MET (corrected from Codex's sandbox-EPERM false negative + a misleading raw-fixture invocation): direct run `node tools/rf-bundle-to-kb-pack/cli.mjs inspect --run-dir tests/fixtures/rf-cbc-001 --module <temp module.json+authoring-decisions.yaml>` exits 0 with a structured JSON summary (33 artifacts, 87 claims, 82 eligible/5 rejected, `"packOutput": null`). Codex's "NOT MET" was caused by invoking `inspect` against the *real* `modules/cbc_suite_v1/module.json`, which has no `authoring-decisions.yaml` until P3-T1 by design (a documented known gotcha) — that path correctly fails closed with `DecisionsNotFoundError`; it is not a defect. `node --test tests/ef-converter-inspect.test.mjs` → 6/6 pass, using the same throwaway-module pattern.
- [x] P2-T6-AC2: A test asserts zero outbound network calls and zero model-invocation-hook calls during `inspect` — MET: covered in `ef-converter-inspect.test.mjs` (runtime spy) and a structural import scan; both pass unsandboxed.

## P2-T7 — `verify` verb

- [x] P2-T7-AC1: `verify` exits 0 against a structurally sound pack and non-zero against a seeded-malformed one — MET (corrected from Codex's sandbox-EPERM false negative): `node --test tests/ef-converter-verify.test.mjs` → 13/13 pass, including the seeded-malformed case using `tests/fixtures/invalid-rule/SYNTHETIC-INVALID-EXTRA-PROP-001.json.txt` (additionalProperties violation → `RulesJsonValidationError`, exit 2).
- [x] P2-T7-AC2: The release-manifest pack-output-validation path is explicitly marked as an incomplete P5-T1 stub, not silently incomplete — MET: `verify` reports `release-manifest.unsigned.json` presence with `"validated": false"` and names P5-T1 in the reason text (confirmed in source and test).

## P2-T8 — 15 seam-invariant test suite

- [x] P2-T8-AC1: All 15 seam invariants (02 §2.3) have ≥1 passing named test, verified by a test-name-to-invariant-number cross-check table in the file's header — MET (corrected from Codex's sandbox-EPERM false negative, which reported "9 pass / 8 fail"): `tests/ef-converter-invariants.test.mjs` header contains the full #1–#15 → test-name cross-check table; `node --test tests/ef-converter-invariants.test.mjs` → **17/17 pass** unsandboxed (15 named invariant tests + 2 cross-cutting zero-network/zero-LLM tests).
- [x] P2-T8-AC2: A zero-network/zero-LLM assertion runs across `inspect`, `verify`, AND the `propose` stub — MET: the same file's two summary tests explicitly exercise all three verbs (runtime spy + structural import scan); pass unsandboxed.

## Phase 2 Quality Gates checklist (docs/.../phase-1-2-foundation-converter.md, "Phase 2 Quality Gates")

**Scope note**: the plan document explicitly splits this checklist into two gates — 4 items
"Validated at P2-GATE1 (task-completion-validator; build-output scope)" and a separate 5th item
"Validated at P2-GATE2 (`karen` milestone review; runs after P2-GATE1 passes — out of P2-GATE1's own
scope)". This validation run **is** P2-GATE1, so only the 4 build-output items are in scope below;
the karen item is reported for completeness but is not scored as a P2-GATE1 AC.

- [x] PHASE2-GATE-AC1: All 15 seam invariants have ≥1 passing named test — MET (same evidence as P2-T8-AC1; corrected from Codex's sandbox-EPERM false negative).
- [x] PHASE2-GATE-AC2: A seeded non-`verified` bundle produces a non-zero exit and zero output files — MET (same evidence as P2-T4-AC1).
- [x] PHASE2-GATE-AC3: Zero network calls and zero generative-model calls occur in any verb (test-enforced) — MET (corrected from Codex's sandbox-EPERM false negative): confirmed across `inspect` (`ef-converter-inspect.test.mjs`), `verify` (`ef-converter-verify.test.mjs`), and `propose`+all three combined (`ef-converter-invariants.test.mjs`'s cross-cutting tests), all passing unsandboxed; plus a structural no-forbidden-import scan (`node:http`/`https`/`dgram`/fetch/AI-SDK) with zero hits anywhere under `tools/rf-bundle-to-kb-pack/`.
- [x] PHASE2-GATE-AC4: `runs/<RUN>/` is never mutated by any verb (test-enforced) — MET: `ef-converter-loader.test.mjs`'s mtime/mode/size snapshot test covers the only verb (`inspect`, via the loader) that takes `--run-dir`; `verify`/`propose` operate on `--pack`/are an inert stub respectively and never touch a run directory, so the invariant holds vacuously for them by construction (noted, not a gap). Independently reconfirmed via `git status`/`git diff --stat tests/fixtures/rf-cbc-001` staying clean after multiple manual CLI invocations against the fixture in this session.
- **(out of P2-GATE1 scope, informational only)** PHASE2-GATE-AC5: `karen` milestone sign-off recorded — recorded and PASS as of this validation: `.claude/worknotes/evidence-foundry-buildout/karen-sign-off-phase-2-converter-core.md` (2026-07-21) and `.claude/progress/evidence-foundry-buildout/phase-2-progress.md` Completion Notes both show P2-GATE2 completed/PASS. Not a P2-GATE1 finding either way — reported here only because the plan's Quality Gates checklist lists it in the same section.

## Consolidated evidence run

- `node --test tests/ef-converter-*.test.mjs` (unsandboxed, direct): **90 pass / 0 fail** (0 cancelled, 0 skipped) — loader 9, hashing 5, eligibility 29, error-taxonomy 11, inspect 6, verify 13, invariants 17.
- `npm test` (full `tests/*.test.mjs` + `tests/witness/*.test.mjs` glob, unsandboxed, direct): **942 pass / 0 fail** — no regressions.
- `npm run validate`: exit 0 (91/0/6/41 for `anemia`; 0/0/0/0 for `cbc_suite_v1`; evidence-pack `--check` matches regenerated output).
- `node tools/rf-bundle-to-kb-pack/cli.mjs --help` / `propose` / `inspect` (manual, unsandboxed): exit 0 / exit 1 / exit 0 as specified, including a manual `inspect` run producing a 25,169-byte structured JSON summary against the real fixture.

## Summary

**22/22 in-scope P2-GATE1 AC lines MET** — all 16 P2-T1..T8 task-level ACs plus all 4 P2-GATE1-scoped
Phase-2-Quality-Gates checklist items. The 5th Quality-Gates item (karen sign-off) is P2-GATE2's own
deliverable, explicitly out of P2-GATE1's scope per the plan document, and is reported informationally
only (already recorded and PASS). No genuine build defects were found; every Codex-reported failure
traced to the read-only sandbox's `EPERM` on temp-directory creation and was overturned by a direct
unsandboxed re-run in this worktree.
