---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-2: Units & Range Registry"
status: draft
created: 2026-07-19
phase: EP-2
phase_title: "Units & Range Registry"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
feature_slug: wave0-safety-foundation
entry_criteria: "EP-0 closed: SPIKE-004 decisions recorded, npm run check green."
exit_criteria: "Unit mismatch rejects rather than converts; missing-unit policy implemented per SPIKE-004; browser SPA runtime smoke passes; npm run check green."
---

# Phase EP-2: Units & Range Registry (WP2)

**Maps to roadmap/PRD WP2.** **8 pts.** Parallel with EP-1 (disjoint files; one shared seam line, owned
by EP-1).

**Dependencies**: EP-0 complete (SPIKE-004 decisions).
**Assigned Subagent(s)**: `backend-architect` (primary); `code-reviewer` (secondary). Greenfield work —
no refactor risk, but the fail-closed boundary decision comes from SPIKE-004.
**Entry criteria**: EP-0's SPIKE-004 output (unit table shape, D-5 hand-roll/dependency decision,
missing-unit policy per OQ-5) available.
**Exit criteria**: registered-band unit mismatch is rejected at the API + browser boundary; an
unregistered `(module, analyte)` pair still returns `null`, never throws; `npm run check` green
including the new runtime smoke task.

## Integration Ownership (R-P3) — consumer side

`modules/anemia/ranges.js:42` is owned by EP-1 (`integration_owner = EP-1`). **EP-2 does not edit this
line.** EP-2-T5 below is the consumer-side half of AC-SEAM: it verifies (after EP-1 lands) that the
unit-checked lookup this phase builds still composes correctly with EP-1's tri-state-aware
`menstruating` read.

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EP2-T1 | `src/units.js` — closed UCUM unit table | Per FR-WP2-01 and D-5: new, hand-rolled (no dependency by default) closed unit table covering the ~10 numeric lab fields (hemoglobin, mcv, rdw, rbc, wbc, anc, platelets, ferritin, stfrFerritinIndex, bloodLeadLevel) whose units are today unenforced JSON-Schema doc-strings. If SPIKE-004 recommended a dependency, its written rationale is recorded here, not assumed. | Every numeric lab field carries an enforced unit; an unrecognized unit string is rejected; `package.json` shows either zero new dependencies or exactly one with a recorded rationale (D-5). | 2.0 pts | backend-architect | sonnet | high | EP-0 (SPIKE-004) |
| EP2-T2 | `schemas/reference-range.schema.json` | Per FR-WP2-02: new schema formalizing band/threshold shape with an explicit unit tag per band/threshold. | Schema validates today's `reference-ranges.json` shape plus the new unit tag; a band/threshold missing its unit tag fails validation. | 1.0 pt | backend-architect | sonnet | high | EP2-T1 |
| EP2-T3 | Formalize unit-checked range lookup | Per FR-WP2-03: extend `src/ranges/registry.js` + `modules/anemia/ranges.js` to validate the request unit against the registered band/threshold unit before lookup, preserving today's AAP-fallback + local-override precedence and the existing tolerant-null behavior for an *unregistered* `(module, analyte)` pair. | Registered-band unit mismatch is rejected (feeds EP2-T4); an unregistered pair still returns `null`, never throws — matches today's tolerant lookup contract exactly. | 2.0 pts | backend-architect | sonnet | high | EP2-T1, EP2-T2 |
| EP2-T4 | Fail-closed unit-mismatch rejection at API + browser boundary | Per FR-WP2-04 and ARCH §8/§10: wire the rejection at the decided boundary per SPIKE-004's missing-unit policy (OQ-5 — reject vs. accept-with-`unitAssumed` flag). Applied consistently; never silent either way. | Unit mismatch rejects at both the `POST /api/v1/assess` API boundary and the browser-only path; the missing-unit policy is applied identically at both surfaces, matching SPIKE-004's recorded decision. | 1.5 pts | backend-architect | sonnet | high | EP2-T3 |
| EP2-T5 | Seam task (consumer) — verify `ranges.js:42` composes with unit checks (FR-WP2-05) | Per **AC-SEAM** (target_surfaces: `modules/anemia/ranges.js:42`), consumer side: after EP-1 lands, verify the unit-checked lookup (EP2-T3) composes correctly with EP-1's tri-state-aware `menstruating` read at the ferritin-threshold gate. Verification only — no edit to line 42. | Ferritin-threshold lookup resolves correctly for `menstruating` present/absent/unknown/not-assessed *and* the correct/incorrect unit, for every combination; no edit made to `ranges.js:42` itself. | 0.5 pts | code-reviewer | sonnet | adaptive | EP1-T7 (EP-1's seam task), EP2-T4 |
| EP2-T6 | R-P2 resilience — consumers handle absent/unset unit metadata | Companion resilience AC for the new unit/range fields this phase introduces: a legacy-shape range record encountered mid-migration (unit tag absent) must not throw. | Absent unit tag on an unregistered analyte still returns `null` per today's tolerant contract; absent unit tag on a *registered* band fails schema validation (not silently accepted) — missingness is never treated as normal. | 0.5 pts | code-reviewer | sonnet | adaptive | EP2-T2, EP2-T3 |
| EP2-T7 | Runtime smoke — browser SPA surfaces unit-rejection errors (R-P4) | Per **R-P4**: this phase touches `src/app.js` (browser unit-rejection surface). Add a runtime smoke task exercising the rejection path end to end in the browser-only mode, referencing every `target_surfaces` entry this phase touches. | target_surfaces: `src/app.js`, `src/algorithmExplorer.js`. A unit mismatch submitted through the browser SPA displays the rejection message (not a silent conversion or a crash); covered by `scripts/check-app-imports.mjs`-style static verification plus a manual/scripted browser-mode assertion. | 0.5 pts | code-reviewer | sonnet | adaptive | EP2-T4 |

**Phase total: 8 pts.**

## Phase EP-2 Quality Gates

- [ ] `src/units.js` enforces units on all ~10 numeric lab fields (EP2-T1)
- [ ] Registered-band unit mismatch rejects; unregistered pair returns `null`, never throws (EP2-T3/T4)
- [ ] AC-SEAM consumer-side verification passes (EP2-T5)
- [ ] R-P2 resilience: absent unit metadata never silently accepted on a registered band (EP2-T6)
- [ ] R-P4 runtime smoke: browser SPA surfaces the rejection, doesn't crash or silently convert (EP2-T7)
- [ ] Zero new dependencies, or exactly one recorded per D-5
- [ ] `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../wave0-safety-foundation-v1.md)
