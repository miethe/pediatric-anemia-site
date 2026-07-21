---
type: progress
schema_version: 2
doc_type: progress
prd: rights-aware-evidence-capture
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
execution_model: sequential
phase: EP-R1
created: '2026-07-21'
title: 'EP-R1: Derived-Fact Coverage Gap (WP1)'
status: completed
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 5
completed_tasks: 5
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors: []
model_usage:
  primary: sonnet
  external: []
tasks:
- id: EPR1-T1
  description: 'Rights record for reference-ranges.json (FR-WP1-01): author a rights
    record for modules/anemia/reference-ranges.json itself, recording its AAP Table
    1 derivation, its 32 numeric values (4 age bands x 2 sexes x hbLower/mcvLower/mcvUpper/rdwUpper),
    that the file ships byte-identical to the browser SPA, and that AAP is a *redistributor*
    here (the table is credited to "(ref 42)"), introducing a third-party rightsholder
    beyond AAP.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP-R0
  estimated_effort: 0.75 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - commit: 513dcf1
- id: EPR1-T2
  description: 'Bidirectional coverage gate — seam owner (FR-WP1-02, FR-WP1-03): assert
    every file in scripts/sign-kb.mjs''s KB_JSON_FILES (rules.json, candidates.json,
    evidence.json, reference-ranges.json) resolves to a rights record through rights/rights-ledger.json,
    AND that every ledger entry resolves to an existing artifact path. Land the shared
    resolution helper in scripts/validate-kb.mjs (R-P3 owner side); gate logic lives
    in validate-rights.mjs.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR1-T1
  estimated_effort: 1.0 pt
  priority: critical
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - commit: 3949f9c
- id: EPR1-T3
  description: 'Fails-closed resilience tests (FR-WP0-06 discipline): tests/rights-coverage.test.mjs
    proves the gate fails on three seeded breakages — (a) delete any one of the 4
    rights records, (b) add a 5th path to KB_JSON_FILES without a record, (c) point
    a ledger entry at a deleted path. Plus a fourth test asserting a record at clearance_status
    UNKNOWN still passes (D7).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR1-T2
  estimated_effort: 0.75 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - commit: 7326717
- id: EPR1-T4
  description: 'No-clinical-change proof (FR-WP1-04): this phase changes no value
    in reference-ranges.json and does not alter deriveFacts() behaviour. Verify by
    golden-fixture equivalence across all 6 examples plus npm run coverage:rules (still
    91).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR1-T2
  estimated_effort: 0.25 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - commit: 4012f7d
- id: EPR1-T5
  description: 'Standalone degradation mode (FR-WP1-05, Should): the gate must be
    independently exercisable against a fixture directory containing only the reference-ranges.json
    record, so this phase can ship if EP-R0''s substrate stalls — no release-context.json
    and no vendored-schema amendment layer present.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR1-T3
  estimated_effort: 0.25 pts
  priority: medium
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - commit: PENDING
parallelization:
  batch_1:
  - EPR1-T1
  batch_2:
  - EPR1-T2
  batch_3:
  - EPR1-T3
  - EPR1-T4
  batch_4:
  - EPR1-T5
  critical_path:
  - EPR1-T1
  - EPR1-T2
  - EPR1-T3
  - EPR1-T5
  estimated_total_time: 2.75 pts (critical path)
blockers: []
success_criteria:
- id: SC-1
  description: reference-ranges.json has a rights record naming the 32 values and
    the AAP-as-redistributor fact (EPR1-T1)
  status: not_started
- id: SC-2
  description: All 4 KB_JSON_FILES entries resolve to a rights record, bidirectionally
    (EPR1-T2)
  status: not_started
- id: SC-3
  description: Gate fails on each of the 3 seeded breakages, with a specific message
    (EPR1-T3)
  status: not_started
- id: SC-4
  description: 'A record at clearance_status: UNKNOWN still passes — coverage-shaped,
    not clearance-shaped (EPR1-T3, D7)'
  status: not_started
- id: SC-5
  description: 'Zero clinical change: golden-fixture zero-diff across 6 examples;
    reference-ranges.json byte-unchanged (EPR1-T4)'
  status: not_started
- id: SC-6
  description: Gate runs standalone against a minimal fixture set (EPR1-T5)
  status: not_started
- id: SC-7
  description: scripts/validate-kb.mjs helper is exported and reusable by EPR2-T5
    without modification (R-P3)
  status: not_started
- id: SC-8
  description: package.json untouched by this phase (EP-R0 barrier); no CLEARED_*
    status, attestation, or approval value written
  status: not_started
- id: SC-9
  description: npm run check green
  status: not_started
- id: SC-10
  description: task-completion-validator sign-off
  status: not_started
files_modified:
- rights/rights-records.json
- rights/rights-ledger.json
- scripts/validate-kb.mjs
- scripts/validate-rights.mjs
- tests/rights-coverage.test.mjs
progress: 100
updated: '2026-07-21'
---

# rights-aware-evidence-capture - Phase EP-R1: Derived-Fact Coverage Gap

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/rights-aware-evidence-capture/phase-r1-progress.md -t EPR1-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Close the derived-fact blind spot the review findings named as the single most actionable technical
finding: the channel `modules/anemia/reference-ranges.json` → `deriveFacts()` → all 91 rules sits
outside the passage-level gating that catches the 32 AAP-citing rules. A rules-only rights sweep
misses it entirely. This phase gives `reference-ranges.json` its own rights record and installs a
**bidirectional** coverage gate over `KB_JSON_FILES`.

**Phase-level entry criteria**: EP-R0 merged (`rights/` tree, amended vendored schemas,
`validate-rights.mjs` and its `package.json` wiring in place). Degradation path: FR-WP1-05 allows this
phase to ship against a minimal record set if the substrate stalls.

**Wave 2, parallel with EP-R2.**

---

## Implementation Notes

### Architectural Decisions

- **R-P3 integration ownership**: EP-R1 and EP-R2 both edit `scripts/validate-kb.mjs` in the same
  wave. `integration_owner = EP-R1`. EPR1-T2 lands the ledger-resolution helper that maps a covered
  artifact path to a rights record; EPR2-T5 is the consumer and adds a **call site only**.
- The helper must be exported and call-site-agnostic so EPR2-T5 can reuse it **unmodified**. If EP-R2
  finds the helper's shape wrong, that is an escalation to the plan owner, not a unilateral refactor.
- The gate is coverage-shaped: it asserts a record *exists*, never that it is cleared (D7).

### Patterns and Best Practices

- Bidirectionality is the point: file→record **and** record→file. A one-way check fails open the
  moment a ledger entry outlives its artifact.
- Failure messages must name the specific artifact or ledger entry at fault — a generic "coverage
  failed" is not actionable in a validator that runs inside `npm run check`.
- No-clinical-change proof uses the existing golden-fixture harness over the 6 examples plus
  `npm run coverage:rules`; `git diff` on `reference-ranges.json` and `facts.anemia.js` must be empty.

### Known Gotchas

- The authoritative `npm run check` composition lives in `package.json`, **not** `CLAUDE.md` (stale
  until EPR5-T5 lands): `test && validate && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`.
- No task may write a `CLEARED_*` status, an attestation, `clinicalApprovers[]`, `approvedBy[]`, or an
  authoritative `derived_synthesis`. Ship the plumbing and the fails-closed test, never the value.
- `json-schema-lite` silently ignores `format: "uri"` — use `pattern`.
- Date-dependent gates take `--as-of`/env, never `Date.now()` (byte-identical determinism).
- The legal axis (`overall_status`) lives on the rights record, joined via the ledger — not on the
  evidence item. Item-level axes are `evidence_item_type`, `judgment_basis`, `rights_component_class`.
- `package.json` is untouched by this phase (EP-R0 barrier). New checks go **inside**
  `validate-rights.mjs` / `validate-kb.mjs`, never as a new npm script.
- This is a small phase where a **fail-open is invisible** — hence effort `high`. Every one of the
  three seeded breakages must actually make `npm run validate` exit non-zero; a test that only proves
  the happy path is worthless here.
- The AAP-as-redistributor fact must be a **structured field**, not a free-text aside: the table is
  credited to "(ref 42)", so a third-party rightsholder exists beyond AAP.

### Development Setup

No new dependencies. The minimal fixture directory for EPR1-T5 holds one rights record and one ledger
entry only — deliberately without `release-context.json` or the amendment layer, so the gate's
standalone mode is genuinely exercised.

---

## Completion Notes

Phase EP-R1 complete. All 5 tasks landed; `npm run check` (test → validate → coverage:rules → build
→ verify:d4 → check:imports → smoke:browser → smoke) is green on this branch.

- **Helper signature (EPR1-T2, R-P3 seam)**: `resolveRightsRecordsForIdentifier(identifierType,
  identifierId, { rightsLedger, rightsRecords }) -> { recordIds: string[], errors: string[] }`,
  exported unmodified from `scripts/validate-kb.mjs` — the exact shape EP-R2's EPR2-T5 is expected
  to reuse as a call site.
- **Gate (e)**: `checkKbJsonFileCoverage(context)` appended to `scripts/validate-rights.mjs`'s
  `GATES` list (5th entry); the 4 EP-R0 gates' bodies/signatures untouched.
- **Three breakage fixtures (EPR1-T3, `tests/rights-coverage.test.mjs`)**: (a) delete
  `RR-AAP2026_IDA-REFERENCE-RANGES` from `rights/rights-records.json`, (b) add a 5th
  `KB_JSON_FILES` path with no ledger coverage, (c) repoint a `kb_json_file_path` ledger entry at a
  deleted artifact path — each drives the real CLI (`node scripts/validate-rights.mjs`) to a
  non-zero exit with a failure message naming the specific artifact/entry at fault. A 4th,
  D7-shaped control proves the unmutated substrate — every seeded record at `overall_status:
  "UNKNOWN"` — still passes with exit 0.
- **No-clinical-change proof (EPR1-T4)**: golden-fixture output is zero-diff across all 6 examples,
  `npm run coverage:rules` still reports 91/91, and `git diff` on both
  `modules/anemia/reference-ranges.json` and `modules/anemia/facts.anemia.js` is empty across the
  whole phase.
- **Standalone degradation mode (EPR1-T5)**: `tests/rights-standalone-degradation.test.mjs` proves
  `checkKbJsonFileCoverage` — the gate `scripts/validate-rights.mjs` registers for this phase — has
  no structural dependency on `rights/release-context.json` or the `schemas/rights/` amendment
  layer. It is exercised directly (not through `loadRightsContext`) against a hand-built, on-disk
  fixture directory holding only one `rights/rights-records.json` record and one
  `rights/rights-ledger.json` entry, both in its passing and its fails-closed shape, plus a D7
  control at `overall_status: "UNKNOWN"`.
- **No agent-authored authority (D6)**: no `CLEARED_*` status, `clinicalApprovers[]`/`approvedBy[]`
  member, or authoritative `derived_synthesis` was written anywhere in this phase; every rights
  record seeded or added stays at `overall_status: "UNKNOWN"` / `review_status:
  "agent_triage_only"`.
- **File-ownership barriers held**: `package.json` untouched by this phase (EP-R0 barrier);
  `scripts/validate-kb.mjs`'s helper and `scripts/validate-rights.mjs`'s `GATES` module contract
  were extended additively only, never restructured.
