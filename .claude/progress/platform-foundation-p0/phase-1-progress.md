---
schema_version: 2
doc_type: progress
title: 'Progress: platform-foundation-p0 Phase 1 — Equivalence Harness + Module Package
  Contract'
status: completed
created: 2026-07-17
feature_slug: platform-foundation-p0
phase: 1
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
updated: '2026-07-18'
---

# Phase 1: Equivalence Harness + Module Package Contract

**Overview**: Capture golden fixtures from unmodified `main` before any code moves (6 examples, scrub `meta.generatedAt`), define the `modules/<id>/` package contract, relocate anemia KB JSON files from `data/` to `modules/anemia/` with empty content diff, and perform a mechanical literal-path swap across 6 hard-coded consumer read-paths to keep `npm run check` green at the phase boundary.

**Entry Criteria**: `main` branch, `npm run check` green baseline confirmed.

**Exit Criteria**: `npm run check` green; `tests/golden/*.json` committed and matched by `tests/module-equivalence.test.mjs`; `git diff` on all 4 relocated KB JSON files is empty (content, not path); anemia loads correctly from `modules/anemia/`.

## Task Tracking

| Task ID | Name | Assigned Subagent | Model/Effort | Status | Notes |
|---------|------|-------------------|--------------|--------|-------|
| P1-T1 | Capture golden fixtures (pre-move) | — | sonnet/adaptive | pending | Run `assessPediatricAnemia(input, rules, candidates)` for each `examples/*.json`, scrub `meta.generatedAt`, write to `tests/golden/<example>.json`. Commit the script (`scripts/capture-golden.mjs`). |
| P1-T2 | Define `modules/<id>/` contract + relocate anemia KB JSON | — | sonnet/adaptive | pending | `git mv data/{rules,candidates,evidence,reference-ranges}.json` → `modules/anemia/`. Document contract in code comment. |
| P1-T3 | Mechanical literal-path swap (hard rule: relocate, never edit KB content) | — | sonnet/adaptive | pending | Update 6 hard-coded consumer read-paths from `data/x.json` to `modules/anemia/x.json`: `server.mjs` (2), `scripts/validate-kb.mjs` (2), `scripts/build-static.mjs` (3), `tests/engine.test.mjs` (2), `src/app.js` (2 `fetch()` calls), `scripts/smoke-test.mjs` (1). **Literal string swap only**, no registry/iteration logic. |
| P1-T4 | Add permanent `tests/module-equivalence.test.mjs` | — | sonnet/adaptive | pending | For each of 6 examples, call `assessPediatricAnemia(input, rules, candidates)`, scrub `generatedAt`, `assert.deepEqual` against `tests/golden/<example>.json`. Auto-discovered by `node --test tests/*.test.mjs` glob. |

## Exit Gate Checklist

- [ ] `npm run check` green (test + validate + build + smoke)
- [ ] `tests/golden/*.json` committed; `tests/module-equivalence.test.mjs` passing
- [ ] Empty content diff on all 4 relocated KB JSON files (`git diff` / `diff <(git show main:...)`)
- [ ] `data/algorithm-explainers.json` and `examples/` unmoved
- [ ] task-completion-validator sign-off

## Quick Reference

- **P1-T1**: general-purpose — "Capture golden fixtures (pre-move) — see plan §Phase 1, P1-T1"
- **P1-T2**: general-purpose — "Define modules/<id>/ contract + relocate anemia KB JSON — see plan §Phase 1, P1-T2"
- **P1-T3**: general-purpose — "Mechanical literal-path swap — see plan §Phase 1, P1-T3 + Sequencing Note 1"
- **P1-T4**: general-purpose — "Add permanent tests/module-equivalence.test.mjs — see plan §Phase 1, P1-T4"
