validator: codex/gpt-5.6-terra

# Phase 5 (Manifest & Traceability) — AC Validation — P5-GATE1

Source docs: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md`
(P5-T1..T5, P5-GATE1, P5-GATE2 rows + "Phase 5 Quality Gates" checklist) and
`.claude/progress/evidence-foundry-buildout/phase-5-progress.md` (`success_criteria` SC-1..SC-5).

Codex (`gpt-5.6-terra`, `--sandbox read-only`) drove the initial validation pass. Its read-only
sandbox denied `mkdtemp` (EPERM) for every check that required a real `propose` run (7 of its 19
lines came back NOT MET, all citing the identical `EPERM: operation not permitted, mkdtemp ...`
stack trace), which it correctly flagged as sandbox-caused rather than silently passing over. Per
harness instructions, every one of those items was independently cross-checked with direct,
unsandboxed commands (real `node --test` runs and a real `propose`/`verify` CLI invocation against
the fixture) below. All cross-checks passed cleanly — corrected verdict is MET for all of them. The
checklist below reflects the corrected, unsandboxed-verified status, not Codex's raw sandboxed
output.

## P5-T1 — release-manifest.unsigned.json + schema

- [x] Manifest emitted and validates against `schemas/release-manifest.schema.json` — MET (corrected): Codex's sandboxed run reported NOT MET (`mkdtemp EPERM`, no manifest produced). Direct unsandboxed re-run: `node tools/rf-bundle-to-kb-pack/cli.mjs propose --run-dir tests/fixtures/rf-cbc-001 --module modules/cbc_suite_v1/module.json --decisions modules/cbc_suite_v1/authoring-decisions.yaml --out /tmp/p5-ac-clean-run-2` succeeds and writes `release-manifest.unsigned.json` (binds `rfInputs[].{runId,bundleSha256,claimLedgerSha256,verificationExitCode}`, `converter.{name,version,configSha256}`, `testCorpusHash`, `traceabilityHash`); `node --test tests/release-manifest-schema.test.mjs` and `tests/ef-converter-release-manifest.test.mjs` both pass, proving schema validation.
- [x] A fixture manifest missing `rfInputs[].bundleSha256` fails schema validation (R-P2 analog) — MET: `schemas/release-manifest.schema.json` requires `bundleSha256` in `$defs.rfInput` with `additionalProperties: false`; seeded-bad fixture at `tests/fixtures/invalid-release-manifest/SYNTHETIC-INVALID-MISSING-BUNDLESHA256-001.json.txt` exercised by `tests/release-manifest-schema.test.mjs`, which passed unsandboxed.
- [x] `verify --pack ... --rule-schema schemas/rule.schema.json` now validates the manifest too, closing P2-T7's stub — MET (corrected): direct unsandboxed CLI run — `node tools/rf-bundle-to-kb-pack/cli.mjs verify --pack /tmp/p5-ac-clean-run-2 --rule-schema schemas/rule.schema.json` — returns `"releaseManifest": {"present": true, "validated": true}` alongside `"rulesJson": {"present": true, "count": 4, "valid": true}`, proving the stub is closed and no longer vacuous when a manifest is present; `tests/ef-converter-verify.test.mjs` passes.

## P5-T2 — conversion-report.json

- [x] Report is non-empty, structured JSON — MET (corrected): the same clean `propose` run emits `conversion-report.json`; `tests/ef-converter-conversion-report.test.mjs` shape tests pass unsandboxed.
- [x] Every claim P3-T4 excluded from rule evidence appears in the report with a named reason — MET: real-fixture run reports `"routing": {"eligibleForRuleEvidence": 27, "conflictObjects": 0, "rejected": 60}`; the conversion-report test asserts all 60 exclusions (including all 5 speculation claims) appear with specific, non-empty reasons — verified passing directly (`node --test tests/ef-converter-conversion-report.test.mjs`).
- [x] A test asserts the report's exclusion count matches the routing logic's actual reject count — MET: same test file asserts `summary.claimsExcluded === routingReport.rejected.length` exactly (60 in the real fixture); passing unsandboxed.

## P5-T3 — semantic-diff.json (OQ-4)

- [x] Reports exactly 4 added rule IDs, 0 removed, 0 changed against `modules/anemia/rules.json` — MET (corrected): the clean `propose` run's `semantic-diff.json` reads exactly `"added": ["CBC-NEUT-BENIGNDIFF-001","CBC-NEUT-LOCALRANGE-001","CBC-NEUT-MARROWFLAG-001","CBC-NEUT-YOUNGINF-001"]`, `"removed": []`, `"changed": []`, `"summary": {"addedCount":4,"removedCount":0,"changedCount":0}` — confirmed by directly inspecting the emitted file.
- [x] Output is byte-identical across two runs with unchanged inputs — MET (corrected): ran `propose` twice into separate clean output dirs (`/tmp/p5-ac-clean-run-2`, `/tmp/p5-ac-clean-run-3`); `diff -rq` between the two directories reports zero differences (byte-identical) across all 10 emitted files, including `semantic-diff.json`. `tests/ef-converter-semantic-diff.test.mjs` passes unsandboxed.

## P5-T4 — Traceability index

- [x] Both `02 §4.16` bidirectional queries succeed with zero dangling edges for all 4 slice rules — MET: `node --test tests/ef-converter-traceability-index.test.mjs` passes 13/13 (no sandbox involvement needed — this test reads only committed files), proving both `queryTraceabilityByOutput` and `queryTraceabilityBySource` succeed with zero dangling edges across all 4 rules and all 8 evidence sources.
- [x] Index is a committed, inspectable artifact, not runtime-only — MET: `git ls-files modules/cbc_suite_v1/traceability-index.json` shows it tracked; `git log` shows it added in `9a538f1 wip(P5): P5-T2, P5-T3, P5-T4`.

## P5-T5 — Determinism double-run proof (FR-20)

- [x] Two clean `propose` runs produce byte-identical SHA-256 output for every emitted file (pack-provenance.json, evidence.json, evidence-assertions.json, candidates.json, rule-proposals.json, rules.json, rule-provenance.json, release-manifest.unsigned.json, conversion-report.json, semantic-diff.json) — MET (corrected): Codex's sandboxed run hit `mkdtemp EPERM` (2 pass / 7 fail across the combined determinism+manifest suite). Direct unsandboxed re-run — `node --test tests/ef-converter-determinism.test.mjs tests/ef-converter-manifest.test.mjs` — is **9/9 pass, 0 fail**. Independently corroborated by a manual double `propose` run (`/tmp/p5-ac-clean-run-2` vs `/tmp/p5-ac-clean-run-3`) whose `diff -rq` shows zero byte differences across all 10 files.
- [x] `tests/ef-converter-manifest.test.mjs` passes, covering P5-T1/P5-T2's schema + exclusion-reason ACs — MET (corrected): included in the same 9/9-pass unsandboxed run above.

## P5-GATE1 exit-gate criteria (this gate)

- [x] Manifest hash reproducible across two clean runs — MET (corrected): see P5-T5 above, confirmed unsandboxed and by manual double-run diff.
- [x] Conversion report enumerates every exclusion with a specific reason — MET: see P5-T2 above.

## Phase 5 Quality Gates checklist

- [x] Manifest content-hash is reproducible across two clean runs (SHA-256 equality demonstrated) — MET (corrected, see P5-T5).
- [x] Conversion report enumerates every exclusion with a specific reason — MET.
- [x] Semantic diff reports exactly the 4 expected added rule IDs, deterministically — MET (corrected, see P5-T3).
- [x] Both `02 §4.16` bidirectional traceability queries succeed with zero dangling edges — MET.
- [x] `karen` E0-complete sign-off recorded — MET: `.claude/worknotes/evidence-foundry-buildout/karen-sign-off-phase-5-e0-complete.md` exists, dated 2026-07-21, and its Disposition section states **"`karen` sign-off: PASS."**, re-verifying the full `02 §9.1` E0 checklist item-by-item (15/16 in-repo items MET, 1/16 correctly out-of-scope for this repo). `.claude/progress/evidence-foundry-buildout/phase-5-progress.md` frontmatter records `P5-GATE2` task `status: completed` with an `evidence` pointer to that same note (note: the separate `success_criteria` block's `SC-5.status` still literally reads `pending` in that file — a stale/unsynced field in the progress-tracking metadata, not a defect in the actual sign-off artifact, which is the thing this AC asks about).

## Supplementary cross-checks (not individually-numbered ACs, run for corroboration)

- [x] `npm run validate` — MET: re-run directly, exit 0. Output: "Validated modules: anemia (91 rules, 26 candidates, 6 evidence records, 41 passage records), cbc_suite_v1 (4 rules, 1 candidates, 8 evidence records, 8 passage records, 19 evidence-assertions, 4 authoring-decisions, 4 rule-provenance entries)." `build-evidence-pack --check` also clean.
- [x] Full `node --test tests/ef-converter-*.test.mjs tests/ef-cbc_suite_v1-*.test.mjs` — MET (corrected): Codex's sandboxed run reported 161 pass / 59 fail (all `mkdtemp` EPERM). Direct unsandboxed re-run is **220/220 pass, 0 fail**.

## Summary

- Task-level ACs (P5-T1..T5): 12/12 MET.
- P5-GATE1 exit-gate criteria: 2/2 MET.
- Phase 5 Quality Gates checklist: 5/5 MET.
- **Overall: 19/19 checklist lines MET.**
- All 7 Codex-reported sandbox-EPERM NOT-MET items were cross-checked with direct unsandboxed
  `node --test` runs and a real, manually-driven `propose`/`verify` CLI invocation against
  `tests/fixtures/rf-cbc-001`, and confirmed spurious — corrected to MET above per the harness's
  EPERM cross-check instruction. No repo file other than this artifact was modified; no git
  operations were performed.
