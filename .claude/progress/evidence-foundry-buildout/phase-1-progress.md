---
type: progress
schema_version: 2
doc_type: progress
prd: evidence-foundry-buildout
feature_slug: evidence-foundry-buildout
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
execution_model: batch-parallel
phase: 1
title: 'Evidence Foundry Buildout — Phase 1: Foundation & Fixtures'
status: completed
started: 2026-07-21
completed: 2026-07-21
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 8
completed_tasks: 8
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P1-T1
  description: 'Path-mapping worknote (blocking, FR-5): write .claude/worknotes/evidence-foundry-buildout/path-mapping.md
    reconciling every 02-evidence-foundry-on-research-foundry.md stale path (data/rules.json,
    data/evidence.json, data/candidates.json, src/evidence.js) to its current-tree
    equivalent (modules/anemia/{rules,candidates,evidence}.json). Confirm npm test''s
    tests/*.test.mjs glob is unaffected (OQ-5). Hard blocker for every Phase 2+ task.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies: []
  estimated_effort: 0.5 pts
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
- id: P1-T2
  description: 'modules/cbc_suite_v1/module.json envelope (FR-1, 02 §3.2, 02 §7.2
    item 1): create the unsigned-stub module.json matching modules/anemia/module.json''s
    shape plus the 8 §3.2 module-variable-envelope fields (module_topic, intended_hcp_users,
    patient_population, intended_output, explicit_exclusions, jurisdictions, integration_targets,
    evidence_policy). Field-presence validation only, no new schema file.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T1
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  evidence:
  - node --test tests/module-manifest-schema.test.mjs tests/module-registry.test.mjs tests/module-equivalence.test.mjs: '23/23
      pass; npm run validate: green (cbc_suite_v1 unregistered until P1-T3); npm test:
      848/848 pass'
- id: P1-T3
  description: 'modules/cbc_suite_v1/ package scaffold + registry wiring (OQ-1): create
    index.js delegating deriveFacts/summarize/limitations to modules/anemia/facts.anemia.js;
    byte-identical reference-ranges.json copy; empty-but-valid rules.json/candidates.json/evidence.json.
    Register cbc_suite_v1 in src/modules/registry.js and src/facts/registry.js (not
    src/ranges/registry.js). DEFAULT_MODULE_ID stays ''anemia''; update the tripwire
    comment to record why.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T2
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
- id: P1-T4
  description: 'Evidence-registry unification (FR-2, 02 §4.19): eliminate the src/evidence.js
    / modules/anemia/evidence.json dual-source-of-truth (PRD §8.3 risk) by generating
    src/evidence.js''s exports from modules/anemia/evidence.json (or replacing both
    with a single injected immutable registry). Existing callers (scripts/validate-kb.mjs,
    src/app.js, server.mjs) need zero edits.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T3
  estimated_effort: 1.0 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  note: 'Verified pre-existing implementation (Direction 1 of docs/project_plans/design-specs/evidence-dual-source-unification.md,
    landed in commit 306af3a) — src/evidence.js now imports modules/anemia/evidence.json
    via the `with { type: "json" }` attribute (same pattern as modules/anemia/ranges.js)
    and reshapes evidenceData.sources into the EVIDENCE id-keyed object; no hand-authored
    evidence content remains in src/evidence.js. scripts/validate-kb.mjs''s old drift
    check (comparing module.json version fields to src/evidence.js''s exported consts)
    was removed as no-longer-needed rather than left vacuously passing. src/app.js
    received zero edits; scripts/validate-kb.mjs and server.mjs changes present in
    the same commit range are attributable to P1-T2/P1-T3, not this unification.'
  evidence:
  - test: node --test tests/evidence-registry.test.mjs tests/evidence-resilience.test.mjs
      tests/evidence-fidelity-flags.test.mjs tests/attested-passage-map.test.mjs tests/attestation-ledger-gate.test.mjs
      tests/server-manifest-failclosed.test.mjs (67/67 pass)
  - test: 'npm run validate (green: anemia 6 evidence records/41 passages, cbc_suite_v1
      0 evidence records; build-evidence-pack --check matches regenerated output)'
  - test: npm test (852/852 pass)
- id: P1-T5
  description: 'Real JSON-Schema validation in scripts/validate-kb.mjs (FR-3): add
    actual JSON Schema (draft 2020-12) validation of every module''s rules.json against
    schemas/rule.schema.json. Seed one intentionally-invalid rule fixture under tests/fixtures/
    (extra property, additionalProperties: false) and assert npm run validate fails
    on it.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T4
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  note: Real JSON Schema (draft 2020-12) validation of rule.schema.json already existed
    in scripts/validate-kb.mjs (validateModule's per-rule validate() loop, landed
    by prior EP-3/EP-4 waves) — this task's remaining gap was the missing seeded-bad-KB
    proof. Added tests/fixtures/invalid-rule/SYNTHETIC-INVALID-EXTRA-PROP-001.json.txt
    (one illegal additionalProperties violation; named .json.txt so backfill-rule-governance.mjs's
    tests/fixtures *.json coverage sweep skips it, same mitigation as P1-T6's ledger)
    and tests/rule-schema-seeded-invalid.test.mjs, which asserts both the standalone
    schema check and validateModule() (the exact function npm run validate's CLI entrypoint
    calls per module) fail closed on it with a specific '$.notAllowedExtraField ...
    additional property is not permitted' message.
  evidence:
  - test: tests/rule-schema-seeded-invalid.test.mjs (4/4 pass)
  - test: 'npm run validate (green: anemia 91 rules, cbc_suite_v1 0 rules)'
- id: P1-T6
  description: 'Sanitized fixture bundle (FR-4, OQ-2): derive one sanitized, in-repo
    fixture bundle from the RF-CBC-001 verified rf run (not REG-001/REG-004, both
    legal-review-flagged per PRD §8). Default to rights-restricted fallback (02 §4.10):
    hash + selector, not full text, unless positively confirmed rights-clear. Write
    a hash-provenance note under tests/fixtures/ naming RF-CBC-001 and the rights
    disposition per passage.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P1-T1
  estimated_effort: 0.75 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
- id: P1-T7
  description: '.gitignore — build/ (OQ-6): add build/ to .gitignore. build/kb-pack/
    converter output is generated, never committed; committed golden/fixture outputs
    for converter tests live under tests/fixtures/ instead.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies: []
  estimated_effort: 0.25 pts
  priority: low
  assigned_model: sonnet
  model_effort: adaptive
- id: P1-GATE
  description: 'task-completion-validator gate: verify Phase 1 exit gate — npm run
    check green; getModule(''cbc_suite_v1'') resolves; seeded-bad-KB fixture fails
    npm run validate; fixture bundle loads. All 4 exit-gate criteria pass, recorded
    in phase progress note.'
  status: completed
  assigned_to:
  - task-completion-validator
  dependencies:
  - P1-T1
  - P1-T2
  - P1-T3
  - P1-T4
  - P1-T5
  - P1-T6
  - P1-T7
  estimated_effort: —
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
parallelization:
  batch_1:
  - P1-T1
  - P1-T7
  batch_2:
  - P1-T2
  - P1-T6
  batch_3:
  - P1-T3
  batch_4:
  - P1-T4
  batch_5:
  - P1-T5
  batch_6:
  - P1-GATE
  critical_path:
  - P1-T1
  - P1-T2
  - P1-T3
  - P1-T4
  - P1-T5
  - P1-GATE
  estimated_total_time: 4.0 pts critical path; 5.0 pts total phase
blockers: []
success_criteria:
- id: SC-1
  description: npm run check green
  status: met
- id: SC-2
  description: cbc_suite_v1 fixture/module loads via getModule('cbc_suite_v1')
  status: met
- id: SC-3
  description: Seeded-bad-KB fixture fails npm run validate with a specific schema
    error
  status: met
- id: SC-4
  description: src/evidence.js no longer independently hand-maintains evidence content
  status: met
- id: SC-5
  description: Path-mapping worknote exists and is referenced by the parent plan
  status: met
files_modified:
- modules/cbc_suite_v1/module.json
- modules/cbc_suite_v1/index.js
- modules/cbc_suite_v1/rules.json
- modules/cbc_suite_v1/candidates.json
- modules/cbc_suite_v1/evidence.json
- modules/cbc_suite_v1/reference-ranges.json
- src/modules/registry.js
- src/facts/registry.js
- src/evidence.js
- scripts/validate-kb.mjs
- tests/fixtures/**
- .gitignore
- .claude/worknotes/evidence-foundry-buildout/path-mapping.md
progress: 100
updated: '2026-07-21'
---

# evidence-foundry-buildout - Phase 1: Foundation & Fixtures

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Update progress via CLI:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/evidence-foundry-buildout/phase-1-progress.md -t TASK-X -s completed
```

---

## Objective

First phase in the plan (no dependencies). Stands up the `modules/cbc_suite_v1/` package envelope,
unifies the evidence registry, wires real JSON-Schema validation into `scripts/validate-kb.mjs`,
derives a sanitized fixture bundle from the `RF-CBC-001` rf run, and writes the blocking path-mapping
worknote every later phase depends on. Duration ~2-3 engineer-days.

**Exit gate** (decisions block §3): `npm run check` green; fixture loads; validator rejects a
seeded-bad KB.

---

## Implementation Notes

### Architectural Decisions

- **OQ-1** (module identity): the 4-rule vertical slice lands in `modules/cbc_suite_v1/`, not
  `modules/anemia/`. `index.js` delegates `deriveFacts`/`summarize`/`limitations` to
  `modules/anemia/facts.anemia.js` — explicit cross-module delegation, not duplication or a stub.
  `cbc_suite_v1` is registered in `src/modules/registry.js` and `src/facts/registry.js` but **not**
  `src/ranges/registry.js`. `DEFAULT_MODULE_ID` stays `'anemia'`.
- **OQ-2** (fixture-seeding run): `RF-CBC-001` (12 source cards, 87 claims), not `REG-001`/`REG-004`
  (both legal-review-flagged per PRD §8). Defaults to hash+selector-only unless passages are positively
  confirmed rights-clear.

### Known Gotchas

- P1-T1's path-mapping worknote is a hard blocker — no Phase 2+ task may start before it lands.
- P1-T3's tripwire comment update is a real acceptance criterion, not optional cleanup: registering a
  second module trips `src/modules/registry.js`'s existing tripwire comment; it must be updated to
  record why `'anemia'` remains the correct `DEFAULT_MODULE_ID` (no client-selectable moduleId surface
  is added in E0).
- P1-T5's schema validator must be pinned to draft 2020-12 to match `schemas/rule.schema.json`'s
  `$schema`.

### Development Setup

Node ≥ 20. Gate before proceeding to Phase 2: `npm run check` (test + validate + build + check:imports
+ smoke).

---

## Completion Notes

Fill in when Phase 1 is complete: what was built, key learnings, unexpected challenges, recommendations
for Phase 2.
