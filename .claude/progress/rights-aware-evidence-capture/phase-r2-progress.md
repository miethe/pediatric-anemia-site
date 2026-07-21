---
type: progress
schema_version: 2
doc_type: progress
prd: rights-aware-evidence-capture
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
execution_model: sequential
phase: EP-R2
created: '2026-07-21'
title: 'EP-R2: Source Rights Metadata (WP2)'
status: pending
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 6
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
- id: EPR2-T1
  description: '$defs/source gains structured licence / access / terms (FR-WP2-01,
    FR-WP2-05): extend schemas/evidence.schema.json $defs/source with structured license,
    access_basis, and terms fields drawn from spec vocabulary, under the existing
    additionalProperties:false posture. Fields are required, not optional, with explicit
    typed unknown/null where genuinely unassessed. Use pattern for any URL-shaped
    field — never format:"uri" (FR-WP0-08).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP-R0
  estimated_effort: 1.25 pts
  priority: critical
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T16:40:00-04:00'
  completed: '2026-07-21T16:48:33-04:00'
  evidence:
  - commit: '9239762'
- id: EPR2-T2
  description: 'terms_snapshot — locator only, never text (FR-WP2-02, D1): add a terms_snapshot
    reference field recording what terms were observed and when, by locator and retrieval
    date. It records no terms prose; the schema must have no free-text body property
    capable of holding terms language.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR2-T1
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T16:48:33-04:00'
  completed: '2026-07-21T16:53:13-04:00'
  evidence:
  - commit: 61a2ea7
- id: EPR2-T3
  description: 'Atomic backfill of 6 sources; AAP block machine-readable (FR-WP2-03):
    backfill all 6 sources in the same commit as the schema change. Encode AAP2026_IDA''s
    access basis as subscription, its terms as barring altering/abridging/adapting
    and incorporating the Materials into other materials, and commercial_use: not_granted_by_subscription
    (findings §1, Appendix A). Restriction facts are transcribed from the recorded
    terms locator, not authored.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR2-T2
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - commit: 3225e63
- id: EPR2-T4
  description: 'CDC2025_LEAD — government *work* vs government-*funded* (FR-WP2-04):
    encode CDC2025_LEAD as a U.S. federal government work under 17 U.S.C. §105, and
    record the distinction the reviewed spec §3.7 conflates — government works are
    uncopyrightable; government-funded works by university authors are not (abundant
    in the PMC corpus). Records a statutory basis already in the findings; makes no
    new legal determination.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR2-T3
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - commit: f11530f
- id: EPR2-T5
  description: 'Source -> rights-record gate, seam consumer (FR-WP2-06): extend scripts/validate-kb.mjs
    so every evidence source resolves to a rights record in rights/rights-ledger.json,
    reusing EP-R1''s exported ledger-resolution helper unchanged — call site only,
    no restructure, rename, or re-signature.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR1-T2
  - EPR2-T4
  estimated_effort: 0.75 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T17:20:00-04:00'
  completed: '2026-07-21T17:36:59-04:00'
  evidence:
  - commit: 511269d
- id: EPR2-T6
  description: 'R-P2 / R-P4 — consumer resilience + browser smoke (FR-WP2-07): target_surfaces
    src/evidence.js, src/engine.js, src/app.js, scripts/evidence/build-evidence-pack.mjs
    must not throw on a legacy-shaped source record encountered mid-migration, and
    absent rights fields must render as "rights position unassessed", never "unrestricted".
    Carries the phase''s R-P4 runtime obligation (npm run smoke:browser + check:imports);
    src/app.js is the only browser surface any phase of this feature touches.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR2-T5
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: high
parallelization:
  batch_1:
  - EPR2-T1
  batch_2:
  - EPR2-T2
  batch_3:
  - EPR2-T3
  batch_4:
  - EPR2-T4
  batch_5:
  - EPR2-T5
  batch_6:
  - EPR2-T6
  critical_path:
  - EPR2-T1
  - EPR2-T2
  - EPR2-T3
  - EPR2-T4
  - EPR2-T5
  - EPR2-T6
  estimated_total_time: 5.0 pts (critical path)
blockers: []
success_criteria:
- id: SC-1
  description: $defs/source carries required license, access_basis, terms; omission
    fails, explicit unknown passes (EPR2-T1)
  status: not_started
- id: SC-2
  description: No format "uri" introduced anywhere; pattern used or the gap documented
    in-schema (EPR2-T1)
  status: not_started
- id: SC-3
  description: terms_snapshot is locator + date only; terms prose is structurally
    unstorable (EPR2-T2)
  status: not_started
- id: SC-4
  description: All 6 sources validate in the same commit as the schema change (EPR2-T3)
  status: not_started
- id: SC-5
  description: 'AAP block is machine-readable: subscription basis, non-incorporable,
    commercial_use not_granted_by_subscription (EPR2-T3)'
  status: not_started
- id: SC-6
  description: government_work and government_funded are distinct; funding alone cannot
    mark public domain (EPR2-T4)
  status: not_started
- id: SC-7
  description: Every source resolves to a rights record; EP-R1's helper unmodified
    (EPR2-T5, R-P3)
  status: not_started
- id: SC-8
  description: All 4 consumers survive a legacy record; unassessed never renders as
    unrestricted (EPR2-T6, R-P2)
  status: not_started
- id: SC-9
  description: npm run smoke:browser + check:imports pass (EPR2-T6, R-P4)
  status: not_started
- id: SC-10
  description: No CLEARED_* status, attestation, or approval value written; package.json
    untouched; schemas/evidence.schema.json merged before EP-R3 starts
  status: not_started
- id: SC-11
  description: npm run check green
  status: not_started
- id: SC-12
  description: task-completion-validator sign-off
  status: not_started
files_modified:
- schemas/evidence.schema.json
- modules/anemia/evidence.json
- scripts/validate-kb.mjs
- src/evidence.js
- src/engine.js
- src/app.js
- scripts/evidence/build-evidence-pack.mjs
progress: 83
updated: '2026-07-21'
---

# rights-aware-evidence-capture - Phase EP-R2: Source Rights Metadata

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/rights-aware-evidence-capture/phase-r2-progress.md -t EPR2-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

The largest single safety gain on offer: `schemas/evidence.schema.json`'s `$defs/source` today records
**no licence, access basis, or terms at all**. That `AAP2026_IDA` is unusable for reuse exists only as
prose in `.claude/findings/` and as one hardcoded boolean. This phase gives every source structured
licence / access-basis / terms fields, a locator-only `terms_snapshot`, and a source→rights-record
gate — and makes the AAP and CDC positions machine-checkable rather than narrative.

**Phase-level entry criteria**: EP-R0 merged (`rights/` tree, amended vendored schemas, gates wired).
EP-R1's `scripts/validate-kb.mjs` ledger-resolution helper available or landing in the same wave.

**Wave 2, parallel with EP-R1.**

---

## Implementation Notes

### Architectural Decisions

- **Two barriers meet here.** (1) `schemas/evidence.schema.json` — EP-R2 owns it **first**, EP-R3
  second, strictly ordered; EP-R3 branches from EP-R2's **merge commit**, not its branch tip. EP-R2
  adds *source*-level fields only; item-level axis fields belong to EP-R3 and must not be anticipated.
  (2) `scripts/validate-kb.mjs` — consumer side; `integration_owner = EP-R1`.
- New fields are **required with explicit typed `unknown`**, not optional. Omission and "unassessed"
  must be distinguishable; missingness is never treated as normal.
- The migration is atomic: schema change and the 6-source backfill land in **one commit**, reviewed as
  a generated-content diff.

### Patterns and Best Practices

- Restriction facts are **transcribed from the recorded terms locator**, never authored or summarised
  from memory.
- EPR2-T4 records a statutory basis already recorded in the findings — it makes **no new legal
  determination**. The schema's own field descriptions carry the works-vs-funded distinction so the
  next author cannot re-conflate them.
- R-P2 resilience is a first-class task, not a cleanup: absent rights fields render "rights position
  unassessed", **never** "unrestricted".

### Known Gotchas

- The authoritative `npm run check` composition lives in `package.json`, **not** `CLAUDE.md` (stale
  until EPR5-T5 lands): `test && validate && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`.
- No task may write a `CLEARED_*` status, an attestation, `clinicalApprovers[]`, `approvedBy[]`, or an
  authoritative `derived_synthesis`. Ship the plumbing and the fails-closed test, never the value.
- `json-schema-lite` silently ignores `format: "uri"` — use `pattern`.
- Date-dependent gates take `--as-of`/env, never `Date.now()` (byte-identical determinism).
- The legal axis (`overall_status`) lives on the rights record, joined via the ledger — not on the
  evidence item. Item-level axes are `evidence_item_type`, `judgment_basis`, `rights_component_class`.
- `additionalProperties: false` makes this a genuinely atomic migration — a schema change without the
  backfill in the same commit leaves the repo red between commits.
- EPR2-T5 must leave EP-R1's helper **byte-unchanged** (`git diff` proves it): call site only. A
  perceived shape problem is an escalation, not a refactor.
- `terms_snapshot` must be structurally incapable of holding prose — a fixture storing a paragraph of
  terms text has to fail validation, not merely be discouraged by convention.
- `package.json` is untouched (EP-R0 barrier). New checks go inside `validate-rights.mjs` or
  `validate-kb.mjs`, never as a new npm script.

### Development Setup

No new dependencies. `npm run smoke:browser` and `npm run check:imports` are part of this phase's exit
gate, not just the standing `check` — `src/app.js` is the only browser surface this feature touches.

---

## Completion Notes

_(Fill in when phase is complete: the landed `$defs/source` shape, the one-commit migration SHA, the
AAP and CDC encodings as shipped, and proof EP-R1's helper is unmodified.)_
