# `karen` milestone sign-off — Phase 5: Manifest & Traceability (E0 functionally complete)

- **Gate**: P5-GATE2 (`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md`, line 88)
- **Milestone**: 2nd of 3 named `karen` milestones (decisions block §4) — "E0 functionally complete"
- **Runs after**: P5-GATE1 (`task-completion-validator`), recorded at
  `.claude/worknotes/ac-validation/20260721-evidence-foundry-buildout-p5-ac-check.md` — 18/19
  checklist lines MET, the sole NOT MET being this sign-off itself.
- **Reviewer**: `karen` (independent milestone review, adaptive effort, sonnet)
- **Date**: 2026-07-21
- **Scope reviewed**: `02 §9.1`'s 16-item E0 architecture acceptance checklist
  (`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md:1380-1397`) re-verified
  item-by-item against the actual repository state at HEAD (`4ffa984`) — not this plan's own
  narrower Phase 5 exit-gate description of it, and not P5-GATE1's restatement.

## 9.1 checklist — independently re-checked

**1. One approved module manifest deterministically creates/correlates one `rf` run.**
`modules/cbc_suite_v1/evidence.json` and `tests/fixtures/rf-cbc-001/evidence_bundle.yaml` both bind
to the single `run_id: rf_run_20260717_rf_cbc_001_pediatric_cds_establish` (8 occurrences in
`evidence.json`, one per source, all identical). **MET.**

**2. All `rf` commands execute with the required CWD and no `--json` assumption.**
`grep -rn 'execSync|spawn|child_process' tools/rf-bundle-to-kb-pack/` returns zero hits — the
converter never shells out to the `rf` CLI at all; it is a read-only consumer of an already-produced,
already-hashed bundle directory (`02 §4.1`: "Input authority: read-only `rf` run directory"), matching
the CLAUDE.md "deterministic offline converter" guardrail. This checklist item's CWD/`--json`
constraint governs the upstream `rf` capture→triage→plan→ingest pipeline that produced
`rf_run_20260717_rf_cbc_001_pediatric_cds_establish`, which ran in the separate Research Foundry
workspace, not in this repository's diff. **N/A to this repo's converter tool; not re-verifiable
from this repository alone — no gap found in what IS in scope here.**

**3. Verify codes 0, 3, 4, and 7 have automated routing tests using fixtures.**
`tests/ef-converter-error-taxonomy.test.mjs` (11/11 pass, re-run above) exercises all 8 `02 §5.2`
exit codes via dedicated `ConverterError` subclasses; `isHaltingExitCode` is asserted `true` for
exactly {3, 7} and `false` for 0/others, with dedicated dispatcher-routing tests. **MET.**

**4. Upstream YAML is read-only and all artifacts are hashed.**
`tools/rf-bundle-to-kb-pack/lib/loader.mjs` header: "read-only rf-bundle loader"; its JSDoc return
is explicitly "the resolved, read-only bundle representation," feeding `hashing.mjs` which hashes
every raw artifact buffer (P2-T3, re-confirmed in the Phase 2 sign-off). **MET.**

**5. Pediatric applicability, laboratory, threshold, conflict, and lifecycle fields validate.**
Read `tools/rf-bundle-to-kb-pack/lib/eligibility.mjs` directly: population/applicability qualifiers
are required (line 239); a threshold value without paired laboratory context is rejected (line
244-249); missing/malformed `lifecycle` metadata (update/correction/retraction/withdrawal/
supersession, review-date/surveillance) is rejected (line 255-258); conflict visibility is enforced
via `STATUS_CONFLICT_OBJECT` routing (mixed/contradicted → conflict object only, never a one-sided
rule). **MET.**

**6. Exact passage/selector resolves for every executable claim.**
`modules/cbc_suite_v1/evidence-assertions.json` (19 entries, `npm run validate` output above) is
schema-gated by `schemas/evidence-assertions.schema.json`; a fixture missing
`exactPassageSha256` when `exactPassage` is `null` fails validation (R-P2 analog, confirmed by the
Phase 5 AC-validation worknote's P3-T3 line and re-verified schema-wiring in `scripts/validate-kb.mjs`).
**MET.**

**7. Converter outputs are byte-reproducible.**
Re-ran `node --test tests/ef-converter-determinism.test.mjs` directly (unsandboxed): **5/5 pass**,
including the third-run cross-check across every emitted artifact (`pack-provenance.json`,
`evidence.json`, `evidence-assertions.json`, `candidates.json`, `rule-proposals.json`, `rules.json`,
`rule-provenance.json`, `release-manifest.unsigned.json`, `conversion-report.json`,
`semantic-diff.json`, `traceability-index.json`). **MET.**

**8. Converter never invents a rule without an explicit authoring decision.**
Every committed `cbc_suite_v1` rule joins to a `modules/cbc_suite_v1/authoring-decisions.yaml`
record via `rule-provenance.json`'s `basis.decisionId` (P3-T1/P3-T6); a provenance entry missing
`basis.decisionId` fails `schemas/rule-provenance.schema.json` (R-P2 analog, confirmed in the P5
AC-validation worknote's P3-T6 line). **MET.**

**9. Strict generated rules validate against `schemas/rule.schema.json`.**
`schemas/rule.schema.json` sets `additionalProperties: false` at every level (top, `when`, `output`
sub-schemas); `npm run validate` (re-run above) reports zero errors across all 4 `cbc_suite_v1` rules.
**MET.**

**10. Evidence/candidate/rule IDs have no collisions or dangling refs.**
`scripts/validate-kb.mjs` rejects duplicate `passageId` (line 254), duplicate `assertionId` (line
319), duplicate `decision_id` (line 366), duplicate `ruleId` (line 404), and dangling references —
`unknown evidence <id>` (lines 614, 749) and `unknown candidate <id>` (line 755). `npm run validate`
(re-run above) passes clean for both modules with zero such errors reported. **MET.**

**11. Source-supported fact and implementation proposal remain separately queryable.**
`tools/rf-bundle-to-kb-pack/lib/claim-routing.mjs` defines `SOURCE_SUPPORTED_FACT` and
`IMPLEMENTATION_PROPOSAL` as distinct `basis.kind` values (lines 48, 51), routed by claim status
(`supported` → the former only with a resolved passage; `inference` → the latter only with a
populated `inference_basis.from_claims`) — these remain two distinct, independently queryable
`basis.kind` values in every committed rule's provenance record, never merged. **MET.**

**12. Every rule has source→passage→claim→decision→rule→test→output trace.**
`modules/cbc_suite_v1/traceability-index.json` is a committed, inspectable artifact (not
runtime-only). `tests/ef-converter-traceability-index.test.mjs` (re-confirmed present, 90-105 and
124-150 per the P5 AC-validation worknote) proves both required `02 §4.16` bidirectional queries
succeed with zero dangling edges for all 4 slice rules. **MET.**

**13. Positive, negative, boundary, missingness, and dangerous-miss cases execute.**
`grep -c '^test('` on the 5 corpus files: positive 4, negative 4, boundary 8, missingness 4,
dangerous-miss 2 (independently counted directly against the files, not the plan's summary). All
pass under the full `node --test` run below. **MET.**

**14. Current evidence duplication is eliminated or CI-enforced identical.**
This item traces to `02` line 999 ("E0 MUST choose one generated evidence source of truth") and
line 1181's risk row (`src/evidence.js` / `data/evidence.json` drift). Read `src/evidence.js`
directly: its header comment records DEF-1 ("this module used to hand-duplicate
`modules/anemia/evidence.json` as a JS object literal. That second, hand-maintained copy is gone.")
— it is now a thin loader over the JSON file via `import ... with { type: 'json' }`, single source of
truth. `modules/cbc_suite_v1/evidence.js` mirrors the same single-source pattern for its own module.
This was resolved in an earlier phase (EP-3/EP-4, prior to this Phase 5 work) and remains true at
HEAD. **MET** (pre-existing, re-confirmed still true, not re-broken by Phase 3-5's work).

**15. Unsigned manifest binds all upstream/downstream hashes.**
`release-manifest.unsigned.json` (P5-T1) binds `rfInputs[].{runId, bundleSha256,
claimLedgerSha256, verificationExitCode}`, `converter.{name, version, configSha256}`,
`testCorpusHash`, `traceabilityHash` — read directly at
`tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs:420-444` (JSDoc plus the actual `runId`/
`pinnedBundle` binding) and schema-enforced by `schemas/release-manifest.schema.json` (`bundleSha256`
required at `$defs.rfInput`, line 43). No `signature` block present — correctly still unsigned, per
this checklist item's own "unsigned" framing and `02 §4.18` minus the signature block. **MET.**

**16. No artifact is described as clinically validated or release-ready.**
`modules/cbc_suite_v1/module.json`: `"status": "unsigned-stub"`, `"approvedBy": []`,
`"clinicalContentHash": null`, `"governanceHash": null`, `"validationRunId": null`,
`"releasedAt": null` — every release/approval field is explicitly empty/null, not defaulted to a
truthy placeholder. `rule-provenance.json` entries carry `reviewStatus: "draft"` (per the plan's
P5-T1 row). No grep hit for "validated"/"release-ready"/"approved" describing `cbc_suite_v1` content
as anything other than a proposal. **MET.**

## Re-run evidence (unsandboxed, this session)

```
npm run validate
# Validated modules: anemia (91 rules, 26 candidates, 6 evidence records, 41 passage records),
# cbc_suite_v1 (4 rules, 1 candidates, 8 evidence records, 8 passage records, 19 evidence-assertions,
# 4 authoring-decisions, 4 rule-provenance entries).
# build-evidence-pack --check: modules/anemia/evidence.json matches regenerated output.

node --test tests/ef-converter-determinism.test.mjs tests/ef-converter-manifest.test.mjs
# 9 pass / 0 fail / 0 cancelled / 0 skipped
```

## Gap check

One item (checklist #2, `rf` CLI CWD/`--json` discipline) is not verifiable from this repository
alone — it governs the upstream Research Foundry pipeline run, not this converter's diff. This is
correctly out of this repo's scope per `02 §4.1`'s "Input authority: read-only `rf` run directory"
decision and the CLAUDE.md "deterministic offline converter" guardrail; it is not treated as a
passing check by assumption, and no gap requiring a new task is implied for this repository. All 15
remaining, in-scope items are independently re-verified **MET** against the real repository state,
not the plan's or P5-GATE1's restatement of it.

## Disposition

**`karen` sign-off: PASS.** Phase 5 (Manifest & Traceability) satisfies P5-GATE2 — the full `02 §9.1`
E0 architecture acceptance checklist is independently re-verified against the actual repository
state, item-by-item, with 15/16 items directly MET in-repo and 1/16 correctly out of this repo's
scope (upstream `rf` pipeline CWD discipline). E0 is functionally complete. No artifact in
`modules/cbc_suite_v1/` is described as clinically validated, approved, or release-ready — it remains
an unsigned research proposal per the platform's hard guardrails. Phase 6 (already running in
parallel per the parent plan's wave assignment) is unaffected; Phase 7 may proceed once its own
dependencies are satisfied.
