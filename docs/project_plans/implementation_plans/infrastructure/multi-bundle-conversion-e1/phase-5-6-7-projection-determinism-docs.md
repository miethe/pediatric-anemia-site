# Phase 5-6-7: Greenfield Projections, Determinism Gate & Docs

[Return to Parent Plan](../multi-bundle-conversion-e1.md)

**Column conventions**: `Estimate` is story points, never Effort. `Model`: `sonnet` throughout.
`Effort`: `adaptive` \| `extended`. Gate rows carry `Estimate: —`.

---

## Phase 5: Greenfield Projections (kidney, growth)

**Duration**: ~1.5-2 engineer-days
**Dependencies**: Phase 2 complete (batch runner + `EF-WP1` gate) AND Phase 3 complete (scaffolds must
exist to project into)
**Assigned Subagent(s)**: module engineer (general-purpose, sonnet); task-completion-validator gate
**Exit gate** (decisions block §1): `npm run check` green; conflict objects present + validated; no
rule without an authoring decision.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|---------:|--------------|-------|--------|---------------|
| P5-T1 | RF-KID-001 → `modules/kidney_suite_v1/` projection | Per FR-9/FR-11/FR-12/FR-13 / OQ-3 (resolved: committed, not staging-only): project `RF-KID-001` into `modules/kidney_suite_v1/` (**AC corrected post-review**: `propose.mjs` is hardwired by design to `cbc_suite_v1`'s own drafting content — FR-14 module scoping, `tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40` — and halts at `inspect` with `DecisionsNotFoundError` for any module lacking an `authoring-decisions.yaml`, including this one, per Deferred Item DF-E1-M1; this task's actual producer is a bespoke, standalone projection step, never a `propose` CLI run), emitting `evidence.json` source records, `evidence-assertions.json` exact-passage projections (same schema shape as `cbc_suite_v1`'s, FR-21), and `unresolved.json` for every eligible-but-unrouted claim (joined by `claim_id` back to the fixture, with a specific rejection/deferral reason). The pediatric-vs-adult proteinuria cutoff conflict (named in PRD §1/§4) MUST land as an explicit, named conflict-visible object listing every contributing source — never averaged or resolved to one source. Zero entries emitted to `rules.json` or the strict `candidates.json` (no approved `authoring-decisions.yaml` exists for any `RF-KID-001` claim). A `candidate-scaffolds.json` (FR-10, OQ-5 resolved: hand-written structural check, no new JSON schema) MAY be emitted but stays staged under `build/kb-pack/kidney_suite_v1/<version>/` only — never committed, never merged into `candidates.json`. | `modules/kidney_suite_v1/evidence.json`, `evidence-assertions.json`, `unresolved.json` committed, schema-consistent with `cbc_suite_v1`'s shape; the proteinuria conflict resolves to a named conflict object listing all contributing sources when queried by claim ID; `modules/kidney_suite_v1/rules.json` and `candidates.json` remain byte-identical `[]` (unchanged from Phase 3) | 1.0 | module engineer | sonnet | adaptive | Phase 2 complete, Phase 3 complete |
| P5-T2 | RF-GRO-002 → `modules/growth_suite_v1/` projection | Per FR-9/FR-11/FR-12/FR-13 / OQ-3: identical structure to P5-T1 — including the same AC correction (bespoke, standalone projection step, never a `propose` CLI run; `modules/growth_suite_v1/` also lacks an `authoring-decisions.yaml`, DF-E1-M1) — for `RF-GRO-002` → `modules/growth_suite_v1/`. The WHO-vs-CDC growth-standard conflict (named in PRD §1/§4) MUST land as an explicit, named conflict-visible object listing every contributing source. Zero entries emitted to `rules.json`/`candidates.json`. | Same criteria as P5-T1, scoped to `growth_suite_v1`; WHO-vs-CDC conflict resolves to a named, multi-source conflict object | 1.0 | module engineer | sonnet | adaptive | Phase 2 complete, Phase 3 complete |
| P5-T3 | Conflict-object + `unresolved.json` consumer-handling test | **R-P2 AC.** Per FR-11/FR-12: a trace query over both named conflict classes (proteinuria, WHO-vs-CDC growth) resolves to a named conflict object with all contributing sources, for both modules. Additionally: assert a consumer reading `unresolved.json` for a module with zero unresolved claims sees an explicit `[]`, never a missing file or a missing key — and, per OQ-5, assert the hand-written `candidate-scaffolds.json` structural check (fields present: `scaffoldId`, `supportingClaimIds[]`, `moduleId`, `rationale`) rejects a malformed scaffold. | Trace query test passes for both conflict classes across both modules; empty-`unresolved.json` consumer test passes for whichever module (if either) produces zero unresolved claims; malformed candidate-scaffold fixture fails the structural check | 0.5 | module engineer | sonnet | adaptive | P5-T1, P5-T2 |
| P5-T4 | LOAD-BEARING honesty AC: zero new rules, unsigned-stub posture (kidney, growth) | **Load-bearing AC (decisions block Notes for implementation-planner).** Explicitly assert and test: `modules/kidney_suite_v1/rules.json` and `modules/growth_suite_v1/rules.json` stay byte-identical `[]` after this phase; both modules' `module.json.status` stays `"unsigned-stub"`, `approvedBy: []`, `clinicalContentHash: null` — unchanged by the projection landing real evidence. "Evidence projected" is never described anywhere in this phase's output as "module complete" or clinically ready. | `git diff` of both `rules.json` files shows zero lines changed from Phase 3's scaffold state; both modules' `status`/`approvedBy`/`clinicalContentHash` fields byte-identical before/after this phase, test-enforced | 0.5 | module engineer | sonnet | adaptive | P5-T1, P5-T2 |
| P5-GATE | `task-completion-validator` gate | Verify Phase 5 exit gate: `npm run check` green; both conflict classes present as named, multi-source objects; `unresolved.json` present and R-P2-compliant for both modules; zero-new-rules AC (P5-T4) passes. | All exit-gate criteria pass | — | task-completion-validator | sonnet | adaptive | P5-T1..T4 |

**Phase 5 Quality Gates:**
- [ ] `npm run check` green
- [ ] `modules/kidney_suite_v1/` and `modules/growth_suite_v1/` each carry committed `evidence.json`/`evidence-assertions.json`/`unresolved.json`
- [ ] Pediatric-vs-adult proteinuria conflict (kidney) and WHO-vs-CDC growth conflict (growth) each resolve to a named, multi-source conflict object
- [ ] `unresolved.json` present for both modules with an explicit empty-array representation when applicable
- [ ] Candidate scaffolds (if any) stay staged under `build/kb-pack/`, never committed, never merged into `candidates.json`
- [ ] **Zero new rules in either module's `rules.json`, test-enforced (P5-T4)**

---

## Phase 6: REG Hold, Determinism & Validation Gate

**Duration**: ~1.5-2 engineer-days
**Dependencies**: Phase 4 complete AND Phase 5 complete
**Assigned Subagent(s)**: validation engineer (general-purpose, sonnet); task-completion-validator
gate; **karen milestone review** (decisions block Tier-3 reviewer gate — 2nd of 3 named milestones)
**Exit gate** (decisions block §1): Full `npm run check` green; determinism suite green; karen
mid/near-end review.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|---------:|--------------|-------|--------|---------------|
| P6-T1 | `REG-001`/`REG-004` rights-posture HOLD record | Per FR-4/FR-19: author `docs/legal/reg-001-reg-004-hold.md` documenting both `REG-001` (`rf_run_20260717_reg_001_pediatric_cds_map_the`) and `REG-004` (`rf_run_20260717_reg_004_pediatric_cds_scope_the`) remain `status: not_executed_owner_held` (`rf-handoff/RESULTS.md` §5), are legal-review memos — not CDS-module evidence — and are excluded from every fixture/converter/clinical-drafting pathway in this and every future pass until legal sign-off lands. Cross-reference `rf-handoff/RESULTS.md` §5 explicitly. | `docs/legal/reg-001-reg-004-hold.md` exists, discoverable, cross-references `rf-handoff/RESULTS.md` §5, and states explicitly neither run may seed a fixture, module, or converter artifact until legal sign-off is recorded | 0.5 | validation engineer | sonnet | adaptive | None (can start any time after Phase 2, sequenced here per decisions block boundary) |
| P6-T2 | REG-exclusion final regression sweep | Per FR-4/FR-19: a repository-wide check (not only Phase 2's batch-list test) confirming no fixture, module content, or converter artifact anywhere in the repository — including everything landed by Phases 1-5 — references `REG-001`/`REG-004`'s run IDs, source-card IDs, or `runs/` paths. | Repo-wide grep/test confirms zero references to either REG run ID or its source-card prefixes in `tests/fixtures/**`, `modules/**`, or `build/kb-pack/**` | 0.5 | validation engineer | sonnet | adaptive | P6-T1, Phase 4 complete, Phase 5 complete |
| P6-T3 | Multi-bundle determinism double-run suite | Per FR-17 / decisions block Risk 5: run the full P2-T3 batch (all 4 clinical bundles) twice against byte-identical fixture inputs and the same converter version. **AC corrected post-review to match this converter's real, documented constraint (FR-14 module scoping; Deferred Item DF-E1-M1 — see `tools/rf-bundle-to-kb-pack/lib/batch.mjs`): only `rf-cbc-002` -> `cbc_suite_v1` completes `inspect -> verify -> propose` end to end; the other 3 bundles (`rf-ev-001` -> `anemia`, `rf-kid-001` -> `kidney_suite_v1`, `rf-gro-002` -> `growth_suite_v1`) halt at `inspect` with `DecisionsNotFoundError` and emit nothing.** Canonical sort/serialize everywhere; stable iteration order confirmed for whatever each pair actually emits. | Full SHA-256 byte-identity across two/three independent runs for `cbc_suite_v1`'s `evidence.json`/`evidence-assertions.json` (the one bundle that completes propose); for the other 3 bundles, identical halt pair/stage/cause and a SHA-256-identical error message across repeated runs, with zero partial output; the aggregate `multi-bundle-conversion-report.json` is SHA-256-identical across repeated runs; test is part of `npm run check` | 1.25 | validation engineer | sonnet | extended | Phase 4 complete, Phase 5 complete |
| P6-T4 | Finalize `multi-bundle-conversion-report.json` as single source of truth | Per FR-5 / Observability NFR: confirm the aggregate report (P2-T4's schema) is populated with real post-Phase-4/5 data — per-bundle and aggregate counts of claims processed, conflicts preserved (≥3 named conflict classes across the 4 bundles: WHO-vs-CDC growth, ANC-cutoff variance, proteinuria), unresolved items, candidate scaffolds, and rules emitted (expected: 0 across all 4 bundles, demonstrated by the report's own rule-count field matching the P4-T8/P5-T4 diff evidence). Every field's empty/missing representation (R-P2, established in P2-T4) is re-verified against the real, final data, not only the earlier synthetic test. | `multi-bundle-conversion-report.json` reflects real Phase 4/5 output; rule-count field reads `0` for all 4 bundles, matching the `git diff` evidence from P4-T8/P5-T4; ≥3 named conflict classes appear in the report | 0.75 | validation engineer | sonnet | adaptive | P6-T3 |
| P6-GATE1 | `task-completion-validator` gate | Verify Phase 6 exit gate: full `npm run check` green; determinism suite green (`cbc_suite_v1` full SHA-256 byte-identity; the other 3 bundles' identical halt pair/stage/cause; aggregate report SHA-256-identical); REG exclusion confirmed repo-wide; conversion report finalized with 0-rules evidence. | All exit-gate criteria pass | — | task-completion-validator | sonnet | adaptive | P6-T1..T4 |
| P6-GATE2 | `karen` milestone review — REG hold, determinism & honesty | Independently re-check, against the actual diff: the REG hold record's completeness and cross-reference accuracy; the determinism suite's real SHA-256 equality (not merely "test passed"); CLAUDE.md hard guardrails ("no AI-published rule changes," "no invented thresholds," "missingness never treated as normal") against Phases 4-6's actual output. Runs after P6-GATE1 passes, before Phase 7 opens. | `karen` sign-off recorded; any gap becomes a new task before Phase 7 opens | — | karen | sonnet | adaptive | P6-GATE1 |

**Phase 6 Quality Gates:**

*Validated at P6-GATE1 (task-completion-validator):*
- [ ] Full `npm run check` green
- [ ] Determinism suite green — full SHA-256 byte-identity across two/three independent runs for `rf-cbc-002` -> `cbc_suite_v1` (the one bundle that completes propose); identical halt pair/stage/cause (SHA-256-identical error message) across repeated runs for the other 3 bundles, which halt at `inspect` with `DecisionsNotFoundError` per FR-14 module scoping / DF-E1-M1; aggregate `multi-bundle-conversion-report.json` SHA-256-identical across repeated runs
- [ ] Zero references to `REG-001`/`REG-004` anywhere in `tests/fixtures/**`, `modules/**`, `build/kb-pack/**` (repo-wide)
- [ ] `multi-bundle-conversion-report.json` finalized, real data, 0-rules confirmed

*Validated at P6-GATE2 (`karen` milestone review):*
- [ ] `karen` sign-off recorded

---

## Phase 7: Docs & Deferred-Items Design Specs

**Duration**: ~1.5-2 engineer-days
**Dependencies**: Phase 6 complete
**Assigned Subagent(s)**: documentation writer (general-purpose, sonnet); task-completion-validator
gate; **karen end-of-feature review** (decisions block Tier-3 reviewer gate — final of 3 named milestones)

#### Overview

Every row in the parent plan's Deferred Items Triage Table gets one design-spec authoring task (DOC-006
style), plus CHANGELOG/architecture/RESULTS.md/IntentTree closure tasks. Docs stay concise and
usage-focused, matching the rest of this repository's documentation posture.

**Conversion-provenance constraint (added post-Phase-6 review — binding on every task below)**: of
the 4 bundles this plan covers, only `rf-cbc-002` → `cbc_suite_v1` completed the converter's
`inspect → verify → propose` pipeline end to end (FR-14 module scoping;
`tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40`). The other three (`rf-ev-001` → `modules/anemia/`,
`rf-kid-001` → `modules/kidney_suite_v1/`, `rf-gro-002` → `modules/growth_suite_v1/`) halted at
`inspect` with `DecisionsNotFoundError` (no `authoring-decisions.yaml` exists for any of the three,
Deferred Item DF-E1-M1) and were instead produced by bespoke, uncommitted, module-specific
evidence-projection scripts — never the converter's `propose` verb. **Every Phase 7 documentation
task in this section (`P7-T1`–`P7-T4` design specs, `P7-T5` CHANGELOG, `P7-T6` `architecture.md`,
`P7-T8` human brief) MUST preserve this distinction wherever it describes how any module's
evidence-layer artifacts came to exist**: only `rf-cbc-002` → `cbc_suite_v1` may be described as an
end-to-end converter conversion; `modules/anemia/`, `modules/kidney_suite_v1/`, and
`modules/growth_suite_v1/`'s evidence artifacts must be described as bespoke evidence projections
pending DF-E1-M1, never as the output of a converter `propose` run. This is a durable correction
against the same wrong framing already fixed in the Phase 4/5 plan-detail rows (P4-T2, P5-T1, P5-T2)
and the Phase 6 findings log — it must not silently reappear in this phase's public-facing docs.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|---------:|--------------|-------|--------|---------------|
| P7-T1 (DOC-006a) | Design spec: rule-authoring workflow per module | Author `docs/project_plans/design-specs/rule-authoring-workflow-per-module.md` (`maturity: idea` — needs ADR-0001 accepted first) for Deferred Item DF-E1-M1, `prd_ref` set to this feature's PRD. Append the path to this plan's `deferred_items_spec_refs` frontmatter. | Design spec exists at the target path with correct frontmatter (`doc_type: design_spec`, `prd_ref` set); `deferred_items_spec_refs` includes this path; spec describes only `rf-cbc-002` → `cbc_suite_v1` as an end-to-end converter conversion, and the other 3 bundles' evidence artifacts as bespoke evidence projections pending DF-E1-M1 | 0.5 | documentation writer | sonnet | adaptive | Phase 6 complete |
| P7-T2 (DOC-006b) | Design spec: clinical-review-portal intake of E1 artifacts | Author `docs/project_plans/design-specs/clinical-review-portal-intake-e1-artifacts.md` (`maturity: idea` — needs ADR-0004 accepted first) for Deferred Item DF-E1-M2, describing how a future portal would surface this pass's conflict objects, `unresolved.json`, and candidate scaffolds. `prd_ref` set. Append path to `deferred_items_spec_refs`. | Design spec exists, correctly cross-references the artifact types this pass produces (conflict objects, `unresolved.json`, candidate scaffolds) as the portal's future intake surface; spec describes only `rf-cbc-002` → `cbc_suite_v1` as an end-to-end converter conversion, and the other 3 bundles' artifacts as bespoke evidence projections pending DF-E1-M1 | 0.5 | documentation writer | sonnet | adaptive | Phase 6 complete |
| P7-T3 (DOC-006c) | Design spec: `REG-001`/`REG-004` legal sign-off routing | Author `docs/project_plans/design-specs/reg-001-004-legal-signoff-routing.md` (`maturity: idea`, `category: policy`-flavored) for Deferred Item DF-EXT-M1, cross-referencing P6-T1's HOLD record and `rf-handoff/RESULTS.md` §5. States explicitly this is an owner/legal-team action, not an engineering task. Append path to `deferred_items_spec_refs`. | Design spec exists, cross-references `docs/legal/reg-001-reg-004-hold.md` and `rf-handoff/RESULTS.md` §5; spec describes only `rf-cbc-002` → `cbc_suite_v1` as an end-to-end converter conversion wherever it characterizes any module's conversion status | 0.5 | documentation writer | sonnet | adaptive | Phase 6 complete |
| P7-T4 (DOC-006d) | Design spec: anemia backfill reconciliation procedure | Author `docs/project_plans/design-specs/anemia-backfill-reconciliation-procedure.md` (`maturity: idea`) for Deferred Item DF-E1-M3, expanding on P4-T3's in-repo seam note into the 3 candidate reconciliation options the PRD names (leave-parallel / generate-citations-from-assertions / deprecate-EP-3-pipeline-role) without deciding among them — that decision is out of scope for this design spec, which only structures the choice for a future pass. Append path to `deferred_items_spec_refs`; update P4-T3's note (`modules/anemia/EVIDENCE-PROVENANCE-NOTE.md` or equivalent) to link forward to this spec. | Design spec exists, enumerates the 3 candidate options from the PRD's OQ-1 without prematurely deciding; P4-T3's note is updated with a forward link to this spec's path; spec describes `modules/anemia/`'s evidence-assertions.json as a bespoke evidence projection pending DF-E1-M1, never as converter `propose` output | 0.75 | documentation writer | sonnet | adaptive | Phase 6 complete, P4-T3 (cross-reference) |
| P7-T5 | CHANGELOG `[Unreleased]` entry | Per FR-23 / `changelog_required: true`: add an entry under `[Unreleased]` describing the batch pass, the 2 new module scaffolds, and the explicit "zero new rules produced" outcome — never described as a content release or a step toward one. **The entry MUST describe only `rf-cbc-002` → `cbc_suite_v1` as an end-to-end converter conversion; `rf-ev-001`/`rf-kid-001`/`rf-gro-002`'s evidence artifacts MUST be described as bespoke evidence projections pending DF-E1-M1, never as converter output.** Categorize per the Keep-a-Changelog-style convention already followed throughout `CHANGELOG.md` (`### Added`/`### Changed`/`### Known issues` headings under `[Unreleased]`) — **note:** the AC below cites `.claude/specs/changelog-spec.md`, which does not exist in this repo or its git history (`.claude/specs/` is absent entirely, per the same dangling reference already recorded at `.claude/findings/wave0-ep7-review-contract-and-docs-findings.md` EP7-F004); do not treat that citation as verified against a real document. Set `changelog_ref: CHANGELOG.md` in plan frontmatter. | `CHANGELOG.md` `[Unreleased]` contains an entry matching this feature, correctly categorized, explicitly non-clinical in framing, and correctly distinguishes the one converter conversion from the 3 bespoke evidence projections | 0.25 | documentation writer | sonnet | adaptive | Phase 6 complete |
| P7-T6 | `docs/architecture.md` module inventory update | Per FR-23: update `docs/architecture.md` §2a's module inventory to list all 4 modules (`anemia`, `cbc_suite_v1`, `kidney_suite_v1`, `growth_suite_v1`) and note the `REG-001`/`REG-004` HOLD-record convention as the pattern for any future legal-review-flagged bundle. **The inventory MUST mark only `cbc_suite_v1` as converted end-to-end via the converter's `propose` verb; `anemia`, `kidney_suite_v1`, and `growth_suite_v1` MUST be marked as carrying bespoke evidence projections pending DF-E1-M1, not converter output.** | `docs/architecture.md` accurately reflects 4 registered modules, the REG-hold pattern, and the converter-vs-bespoke-projection distinction per module | 0.5 | documentation writer | sonnet | adaptive | Phase 6 complete |
| P7-T7 | `rf-handoff/RESULTS.md` §7 + IntentTree `EF-WP1` status update | Update `docs/project_plans/expansion/rf-handoff/RESULTS.md` §7 to reflect `EF-WP1` as implemented (was "not started" as of 2026-07-19) and this pass's 4-bundle conversion outcome; note in the same update that the IntentTree tree (`tree_01KXQ7WC1HQE2GKZSCNDVXA9G7`) status for the corresponding node(s) is known-stale per this repo's CLAUDE.md caveat and should be verified against this commit, not assumed current. | `RESULTS.md` §7 updated; a note flags the IntentTree staleness caveat explicitly rather than silently trusting `itt` state | 0.5 | documentation writer | sonnet | adaptive | Phase 6 complete |
| P7-T8 | Human brief close-out + plan frontmatter finalization | Update `docs/project_plans/human-briefs/multi-bundle-conversion-e1.md` §9 Running Log with a closing entry; set this plan's frontmatter `status: completed` (only after `karen` sign-off at P7-GATE), populate `commit_refs`, `pr_refs`, finalize `files_affected` against the actual diff, set `changelog_ref`. **The closing entry MUST describe only `rf-cbc-002` → `cbc_suite_v1` as an end-to-end converter conversion; the other 3 bundles' evidence artifacts MUST be described as bespoke evidence projections pending DF-E1-M1.** | Plan frontmatter fields populated per the lifecycle spec; human brief closing entry present and correctly distinguishes the one converter conversion from the 3 bespoke evidence projections | 0.5 | documentation writer | sonnet | adaptive | P7-T1..T7 |
| P7-GATE1 | `task-completion-validator` gate | Verify Phase 7 exit gate: all 4 design specs exist and are linked in `deferred_items_spec_refs`; CHANGELOG entry present; architecture/RESULTS.md docs updated; plan frontmatter finalized; every public-facing doc this phase touched (design specs, CHANGELOG, `architecture.md`, human brief) describes only `rf-cbc-002` → `cbc_suite_v1` as an end-to-end converter conversion and the other 3 bundles' artifacts as bespoke evidence projections pending DF-E1-M1. | All exit-gate criteria pass | — | task-completion-validator | sonnet | adaptive | P7-T1..T8 |
| P7-GATE2 | `karen` end-of-feature review | Independently re-check, against the full feature diff (Phases 1-7): every CLAUDE.md hard guardrail and every PRD §7 non-goal explicitly checked, not assumed compliant; the "zero new rules" outcome and both greenfield modules' "not yet implemented" labeling independently spot-checked by reading the emitted content, not only the test suite; all 4 deferred-item design specs exist and are correctly cross-referenced; `REG-001`/`REG-004` never touched by any converter artifact anywhere in the final diff. This is the feature's final gate — nothing merges without it. | `karen` sign-off recorded; feature is not considered complete until this passes | — | karen | sonnet | adaptive | P7-GATE1 |

**Phase 7 Quality Gates:**

*Validated at P7-GATE1 (task-completion-validator):*
- [ ] All 4 deferred-item design specs exist; `deferred_items_spec_refs` frontmatter populated with all 4 paths
- [ ] `CHANGELOG.md` `[Unreleased]` entry present, correctly categorized
- [ ] `docs/architecture.md` and `rf-handoff/RESULTS.md` §7 updated
- [ ] Plan frontmatter finalized (`commit_refs`, `pr_refs`, `files_affected`, `changelog_ref`)
- [ ] Every design spec, the CHANGELOG entry, `architecture.md`, and the human brief describe only
      `rf-cbc-002` → `cbc_suite_v1` as an end-to-end converter conversion, and `anemia`/
      `kidney_suite_v1`/`growth_suite_v1`'s evidence artifacts as bespoke evidence projections
      pending DF-E1-M1

*Validated at P7-GATE2 (`karen` end-of-feature review):*
- [ ] Every CLAUDE.md hard guardrail and PRD §7 non-goal explicitly checked against the actual diff
- [ ] "Zero new rules" outcome and "not yet implemented" labeling independently spot-checked by direct read
- [ ] `karen` sign-off recorded — feature considered complete only after this gate

[Return to Parent Plan](../multi-bundle-conversion-e1.md)
