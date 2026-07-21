# P7-T16 — Full gate re-run + guardrail/non-goal cross-check

- **Task**: P7-T16 (`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-6-7-adrs-docs.md`, line 68)
- **Author**: documentation-writer (sonnet)
- **Date**: 2026-07-21
- **Purpose**: the prep pass `karen` (P7-GATE2) reviews before the plan's `status` may advance to
  `completed`. Both parts below were independently re-verified against the actual committed state
  at HEAD (`1bf8a88`) — not this plan's or any prior phase's description of it.

## 1. `npm run check` — full gate re-run

Ran unsandboxed from the repo root:

```
npm run check
# exit code: 0
```

Sub-command results (from the actual run, not summarized from memory):

| Sub-command | Result |
|---|---|
| `npm test` (`node --test`) | 1100/1100 pass, 0 fail, 0 cancelled, 0 skipped |
| `npm run validate` (`validate-kb.mjs` + `build-evidence-pack.mjs --check`) | Both modules valid — `anemia` (91 rules, 26 candidates, 6 evidence records, 41 passage records), `cbc_suite_v1` (4 rules, 1 candidate, 8 evidence records, 8 passage records, 19 evidence-assertions, 4 authoring-decisions, 4 rule-provenance entries); evidence pack `--check` matches regenerated output |
| `npm run coverage:rules` (via `check`'s validate step) | 91/91 rules witnessed (100.0%), zero unwitnessed rules |
| `npm run build` | Static site built; `cbc_suite_v1` correctly disclosed as evidence-staleness-not-enforced and manifest-not-servable (non-fatal, per its `unsigned-stub` status) |
| `npm run verify:d4` | OK — `clinicalApprovers[]` empty on all 95 built rules across 2 modules, checked post-build |
| `npm run check:imports` | OK — static and dynamic module-graph resolution clean under dev and `dist/` layouts |
| `npm run smoke:browser` | OK — SPA rejection wiring, built `dist` engine assessment, unit-rejection path all verified |
| `npm run smoke` | Passed — KB `0.1.0-2026-07-15`, 2 differential patterns returned |

**Result: GREEN.** `npm run check` is green at feature end, against the final diff.

## 2. CLAUDE.md hard guardrails — independently re-verified

| # | Guardrail | Verdict | Evidence |
|---|---|---|---|
| 1 | No generative model in the clinical decision path | **MET** | `grep -rE 'anthropic|openai|llm|chat.completions|model.generate' tools/rf-bundle-to-kb-pack/` — zero hits. `tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs` derives every rule/candidate deterministically by joining `modules/cbc_suite_v1/authoring-decisions.yaml` (human-authored) to claim IDs — no model call anywhere in the converter or the runtime engine (`src/engine.js`, `src/ruleEngine.js` untouched by this feature). |
| 2 | No autonomous diagnosis/treatment/dosing/transfusion directives | **MET** | `modules/cbc_suite_v1/module.json`'s `explicit_exclusions` names `transfusion_decision`, `hemodynamic_instability`, `active_major_bleeding`, `febrile_neutropenia_management` as out of scope; `intended_output` is limited to `reviewable_pattern`/`safety_caution`/`missing_information_question`/`confirmatory_next_step_option`/`referral_readiness`/`longitudinal_followup_state` — no directive output type exists. |
| 3 | No invented thresholds | **MET** | `schemas/evidence-assertions.schema.json` + `schemas/rule-provenance.schema.json` (wired into `scripts/validate-kb.mjs`) require every rule to resolve to a passage locator or an explicit `authoring-decisions.yaml` decision; `npm run validate` reports zero errors, and the plan's OQ-2/FR-16(c) resolution (decisions block) explicitly re-scoped FR-16(c) away from an unsupported iron-deficiency candidate rather than invent one. |
| 4 | No PHI in the public microsite | **MET** | `git diff <merge-base>..HEAD -- src/app.js server.mjs openapi.yaml index.html` shows zero changes to `src/app.js`, `openapi.yaml`, or `index.html`; the only `server.mjs` change (per-module manifest-verdict disclosure, non-fatal for non-default modules) adds no new patient-data field, endpoint, or third-party call — confirmed by direct read of the diff. |
| 5 | No AI-published rule changes | **MET** | `modules/cbc_suite_v1/module.json`: `"status": "unsigned-stub"`, `"approvedBy": []`, `"clinicalContentHash": null`, `"governanceHash": null`, `"validationRunId": null`, `"releasedAt": null` — every release/approval field explicitly null/empty, never defaulted to a truthy placeholder. `verify:d4` independently re-confirms `clinicalApprovers[]` empty on all 95 built rules post-build. `modules/anemia/` is byte-identical to the merge-base (`git diff --stat <merge-base>..HEAD -- modules/anemia/` is empty) — untouched except the already-scoped `src/evidence.js` unification. |
| 6 | Ranking score is an internal ordinal sort priority, not a probability/likelihood/performance metric | **MET** | `src/engine.js`'s `CORE_LIMITATIONS` (unchanged by this feature) still states verbatim: "The ranking is rule priority—not a calibrated probability, sensitivity, specificity, or risk score." No new scoring/ranking logic was introduced by this feature; `cbc_suite_v1`'s single migrated candidate reuses the same `assess()`/`runRules()` ranking path. |

## 3. PRD §7 non-goals (`02 §6.4`, restated verbatim) — independently re-verified

| # | Non-goal | Verdict | Evidence |
|---|---|---|---|
| 1 | A second evidence crawler or source-card database in the CDS repository | **MET** | `tools/rf-bundle-to-kb-pack/` only *reads* pre-existing `rf` source cards already present in a verified, read-only bundle directory (`loader.mjs`, `eligibility.mjs`); it contains no fetch/crawl/scrape logic and no new persistent source-card store — `grep -rE 'fetch\(|http\.request|https\.request|axios|execSync|spawn\('` over `tools/rf-bundle-to-kb-pack/` returns zero hits. |
| 2 | A generative rule-writing service that publishes to `data/rules.json` (current-tree equivalent: `modules/<module_id>/rules.json`) | **MET** | `propose.mjs` requires `--decisions <authoring-decisions.yaml>` (a human-authored file) and rejects with `UsageError` if it is missing or not the module's own file; no generative step exists between claim and rule — confirmed above under guardrail #1. |
| 3 | A patient-specific LLM inference path | **MET** | `src/engine.js`/`src/ruleEngine.js` (the only patient-facing inference path) are unmodified by this feature (confirmed via targeted diff — no hits in the 151-file changed-file list for either path outside test/fixture files); the converter operates entirely offline on `rf` bundles, never on a patient record. |
| 4 | A universal pediatric threshold service that ignores local methods and intervals | **MET** | `modules/cbc_suite_v1/index.js` explicitly delegates `deriveFacts` to `modules/anemia/facts.anemia.js`, which already resolves local-range overrides before built-in fallback intervals; `modules/cbc_suite_v1/reference-ranges.json` is a byte-identical copy of `modules/anemia/reference-ranges.json` and is deliberately *not* separately registered in `src/ranges/registry.js` — no parallel "universal" threshold path was created. |
| 5 | A converter that guesses LOINC/UCUM codes from labels | **MET** | `grep -rn 'LOINC\|UCUM' tools/rf-bundle-to-kb-pack/` returns zero hits; the only UCUM references in the diff are in `modules/cbc_suite_v1/units.json`, a static, human-authored unit-alias table (e.g., `um3`/`µm³` as alternate notations for the same declared unit), not code inference from free-text labels. |
| 6 | A release shortcut that treats `rf verify` or council approval as clinical validation | **MET** | `modules/cbc_suite_v1/module.json` keeps `status: "unsigned-stub"` and every approval/hash field null despite the fixture's `rf verify` exit-0 status; `rule-provenance.json` entries carry `reviewStatus: "draft"`; no artifact anywhere in the diff describes `cbc_suite_v1` content as validated, approved, or release-ready (re-confirmed via targeted grep, zero hits for that framing applied to `cbc_suite_v1`). |
| 7 | A single "confidence score" combining evidence confidence, rule points, and patient likelihood | **MET** | No new scoring field of this shape was introduced; `src/engine.js`'s existing ranking-is-not-a-probability disclaimer is unchanged and still applies uniformly to `cbc_suite_v1`'s one migrated candidate (guardrail #6 above). |

## 4. Disposition

All 6 CLAUDE.md hard guardrails and all 7 PRD §7 non-goals are independently re-verified **MET**
against the actual committed diff at HEAD, and `npm run check` is green end to end. No gap
requiring a new task was found. This checklist is the prep artifact for `karen`'s P7-GATE2 feature-end
review (which additionally re-confirms the deferred-items triage table's 11 rows are closed and that
nothing produced by this feature is described as clinically validated or release-ready).
