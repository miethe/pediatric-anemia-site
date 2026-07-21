validator: codex/gpt-5.6-terra

# Phase 5 (Manifest & Traceability) — AC Validation

Source docs: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md`
(P5-T1..T5, P5-GATE1, P5-GATE2 rows + "Phase 5 Quality Gates" checklist) and
`.claude/progress/evidence-foundry-buildout/phase-5-progress.md` (`success_criteria` SC-1..SC-5).

Codex (`gpt-5.6-terra`, `--sandbox read-only`) drove the validation. Its sandbox denied `mkdtemp`
(EPERM) for 3 test-execution items, which it correctly flagged as sandbox-caused rather than silently
recording as real failures. Per harness instructions, all 3 were independently re-run unsandboxed
(direct `node --test` invocations, no sandbox flag) below and all **passed cleanly** — the corrected
verdict for each is MET, and the checklist below reflects the corrected status, not Codex's raw
sandboxed output.

## P5-T1 — release-manifest.unsigned.json + schema

- [x] Manifest emitted and validates against `schemas/release-manifest.schema.json` — MET: `tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs:634-644` builds/writes `release-manifest.unsigned.json`; `tests/release-manifest-schema.test.mjs:74-105` asserts a fixture-backed emission validates cleanly.
- [x] A fixture manifest missing `rfInputs[].bundleSha256` fails schema validation (R-P2 analog) — MET: `schemas/release-manifest.schema.json:43` requires `bundleSha256` in `$defs.rfInput`; `tests/release-manifest-schema.test.mjs:60-72` asserts the seeded-bad fixture at `tests/fixtures/invalid-release-manifest/` fails specifically for its absence.
- [x] `verify --pack ... --rule-schema schemas/rule.schema.json` now validates the manifest too, closing P2-T7's stub — MET: `tools/rf-bundle-to-kb-pack/lib/verbs/verify.mjs:230-262` parses and schema-validates a present release manifest (vacuous pass when absent); `tests/ef-converter-verify.test.mjs:244-304` carries dedicated P5-T1 cases.

## P5-T2 — conversion-report.json

- [x] Report is non-empty, structured JSON — MET: `buildConversionReport()` in `propose.mjs:491-520` returns structured report fields; `tests/ef-converter-conversion-report.test.mjs` shape tests pass.
- [x] Every claim P3-T4 excluded from rule evidence appears in the report with a named reason — MET: `propose.mjs:492-501` maps every `routingReport.rejected` claim to its `reasons`; the real-fixture test asserts all 60 exclusions (including all 5 speculation claims) appear with specific reasons.
- [x] A test asserts the report's exclusion count matches the routing logic's actual reject count — MET: `propose.mjs:507-516` derives `summary.claimsExcluded` from the same array; test asserts `summary.claimsExcluded === routingReport.rejected.length`.

## P5-T3 — semantic-diff.json (OQ-4)

- [x] Reports exactly 4 added rule IDs, 0 removed, 0 changed against `modules/anemia/rules.json` — MET: `propose.mjs:658-673` emits the diff; `tests/ef-converter-semantic-diff.test.mjs:175-202` asserts the exact 4/0/0 result.
- [x] Output is byte-identical across two runs with unchanged inputs — MET: `tools/rf-bundle-to-kb-pack/lib/semantic-diff.mjs:30-31,92-96` sorts deterministically; `tests/ef-converter-semantic-diff.test.mjs:219-235` contains the byte-identical two-run assertion.

## P5-T4 — Traceability index

- [x] Both `02 §4.16` bidirectional queries succeed with zero dangling edges for all 4 slice rules — MET: `tests/ef-converter-traceability-index.test.mjs:90-105,124-150` proves both `queryTraceabilityByOutput` and `queryTraceabilityBySource` succeed with zero dangling edges.
- [x] Index is a committed, inspectable artifact, not runtime-only — MET: `modules/cbc_suite_v1/traceability-index.json` exists on disk and is committed (`git log` shows it added in `9a538f1 wip(P5): P5-T2, P5-T3, P5-T4`).

## P5-T5 — Determinism double-run proof (FR-20)

- [x] Two clean `propose` runs produce byte-identical SHA-256 output for every emitted file (pack-provenance.json, evidence.json, evidence-assertions.json, candidates.json, rule-proposals.json, rules.json, rule-provenance.json, release-manifest.unsigned.json, conversion-report.json, semantic-diff.json) — MET (corrected): Codex's sandboxed run hit `mkdtemp` EPERM (2 pass / 3 fail); direct unsandboxed re-run — `node --test tests/ef-converter-determinism.test.mjs` — is **5/5 pass**, including the third-run cross-check and the traceability-index determinism check.
- [x] `tests/ef-converter-manifest.test.mjs` passes, covering P5-T1/P5-T2's schema + exclusion-reason ACs — MET (corrected): Codex's sandboxed run hit the same `mkdtemp` EPERM (0 pass / 4 fail); direct unsandboxed re-run — `node --test tests/ef-converter-manifest.test.mjs` — is **4/4 pass**.

## P5-GATE1 exit-gate criteria (task-completion-validator gate)

- [x] Manifest hash reproducible across two clean runs — MET (corrected): see P5-T5 above, confirmed unsandboxed.
- [x] Conversion report enumerates every exclusion with a specific reason — MET: see P5-T2 above.

## Phase 5 Quality Gates checklist

- [x] Manifest content-hash is reproducible across two clean runs (SHA-256 equality demonstrated) — MET (corrected, see P5-T5).
- [x] Conversion report enumerates every exclusion with a specific reason — MET.
- [x] Semantic diff reports exactly the 4 expected added rule IDs, deterministically — MET.
- [x] Both `02 §4.16` bidirectional traceability queries succeed with zero dangling edges — MET.
- [ ] `karen` E0-complete sign-off recorded — NOT MET: `.claude/progress/evidence-foundry-buildout/phase-5-progress.md:121` (`SC-5`) still records status `"pending"`; no Phase 5/E0 sign-off artifact exists under `.claude/worknotes/evidence-foundry-buildout/` (only the prior `karen-sign-off-phase-2-converter-core.md` is present). This is expected at this point in the pipeline: P5-GATE2 (karen milestone review) is the task immediately downstream of this gate (P5-GATE1) and has not yet run — it is out of scope for this validation pass, not a defect in P5-T1..T5.

## Supplementary checks (not individually-numbered ACs, run for corroboration)

- [x] `npm run validate` — MET: independently re-run, exit 0. Output: "Validated modules: anemia (91 rules, 26 candidates, 6 evidence records, 41 passage records), cbc_suite_v1 (4 rules, 1 candidates, 8 evidence records, 8 passage records, 19 evidence-assertions, 4 authoring-decisions, 4 rule-provenance entries)." `build-evidence-pack --check` also clean.
- [x] Full `node --test tests/ef-converter-*.test.mjs tests/ef-cbc_suite_v1-*.test.mjs` — MET (corrected): Codex's sandboxed run reported 161 pass / 59 fail (predominantly `mkdtemp` EPERM); direct unsandboxed re-run is **220/220 pass, 0 fail**.

## Summary

- Task-level ACs (P5-T1..T5): 12/12 MET.
- P5-GATE1 exit-gate criteria: 2/2 MET.
- Phase 5 Quality Gates checklist: 4/5 MET — the sole open item is the `karen` E0 sign-off, which is P5-GATE2's own job (downstream of this gate) and is correctly still `pending`.
- **Overall: 18/19 checklist lines MET**, 1 correctly NOT MET (karen sign-off, out of scope / not yet run).
- All Codex-reported sandbox-EPERM test failures (3 items) were cross-checked with direct unsandboxed `node --test` runs and confirmed spurious — corrected to MET above per the harness's EPERM cross-check instruction.
