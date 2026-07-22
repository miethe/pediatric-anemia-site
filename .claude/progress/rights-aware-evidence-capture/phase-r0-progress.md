---
type: progress
schema_version: 2
doc_type: progress
prd: rights-aware-evidence-capture
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
execution_model: sequential
phase: EP-R0
created: '2026-07-21'
title: 'EP-R0: Rights Substrate (WP0)'
status: completed
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 100
completion_estimate: on-track
total_tasks: 6
completed_tasks: 6
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
- id: EPR0-T1
  description: '`rights/` tree + release context (FR-WP0-01, FR-WP0-02, D4): create top-level
    rights/ with release-context.json, rights-records.json, rights-failures.json, rights-ledger.json.
    release-context.json declares commercial:false, use_type:internal_research, plus territory
    and channel scope from spec §5.2. No rights data inline in any clinical JSON file.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies: []
  estimated_effort: 0.75 pts
  priority: high
  assigned_model: sonnet
  model_effort: medium
- id: EPR0-T2
  description: 'Vendor the 5 spec schemas with provenance (FR-WP0-03): copy rights_record,
    content_reuse_assessment, permission_record, rights_failure, rights_extension into
    schemas/rights/; record each file''s source path and spec-bundle checksum in schemas/rights/VENDORING.md.
    Precedent: openapi.yaml.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR0-T1
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: medium
- id: EPR0-T3
  description: 'Declared local amendment layer (handoff §9 + D6): the vendored schemas are
    not usable as published. Apply and annotate — §9.3 add `unknown` to access.basis (blocking);
    §9.4 one home per TDM/model-training restriction, duplicate marked deprecated-in-copy;
    §9.6 replace format:"uri" with pattern on license_url/terms_url and forbid the empty
    contract object; §9.2 declare the enum authoritative for rights_component_class; §9.5
    record that rights_record cannot describe first-party content (DEF-R4); D6 constrain
    approvals.clinical_owner / review.clinical_reviewer to null and approver arrays to maxItems:0.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR0-T2
  estimated_effort: 1.0 pt
  priority: critical
  assigned_model: sonnet
  model_effort: medium
- id: EPR0-T4
  description: 'Seed 6 triage-only rights records + failure cross-links (FR-WP0-04, FR-WP0-05):
    one rights_record per KB-cited source (6 records) from RF-EV-003 at status agent_triage_only;
    populate rights/rights-failures.json cross-linking known open failures (REG-002, EP3T5-F01,
    EP3T5-F02) to their existing identifiers.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR0-T3
  estimated_effort: 0.75 pts
  priority: critical
  assigned_model: sonnet
  model_effort: medium
- id: EPR0-T5
  description: 'scripts/validate-rights.mjs — 4 coverage/consistency gates (FR-WP0-06, FR-WP0-07,
    D7): pure exported functions plus a thin CLI. (a) bidirectional missing-assessment coverage,
    (b) blocking-status enum membership, (c) open-critical-failure presence, (d) use/territory/channel
    set-containment against release-context.json. Any date-sensitive check takes --as-of or
    an env value.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR0-T4
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: high
- id: EPR0-T6
  description: 'package.json gate wiring + fails-closed resilience suite (FR-WP0-09, serialization
    barrier): wire validate-rights.mjs into npm run validate and land ALL gate wiring this
    feature will need, in this task only. Add tests/rights-gate-failsclosed.test.mjs proving
    each EPR0-T5 gate fails when its precondition is unmet. Preserve the zero-dependency posture.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR0-T5
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: medium
parallelization:
  batch_1:
  - EPR0-T1
  batch_2:
  - EPR0-T2
  batch_3:
  - EPR0-T3
  batch_4:
  - EPR0-T4
  batch_5:
  - EPR0-T5
  batch_6:
  - EPR0-T6
  critical_path:
  - EPR0-T1
  - EPR0-T2
  - EPR0-T3
  - EPR0-T4
  - EPR0-T5
  - EPR0-T6
  estimated_total_time: 5.0 pts (critical path)
blockers: []
success_criteria:
- id: SC-1
  description: rights/ tree exists; no inline rights key in any clinical JSON file (EPR0-T1)
  status: not_started
- id: SC-2
  description: 'release-context.json declares commercial: false, use_type: internal_research
    (EPR0-T1)'
  status: not_started
- id: SC-3
  description: 5 schemas vendored with byte-traceable provenance; every divergence declared
    (EPR0-T2/T3)
  status: not_started
- id: SC-4
  description: All six handoff §9 conflicts addressed or explicitly recorded as deferred; D6
    null/maxItems:0 constraints ship with zero approver, reviewer, or clearance values written
    (EPR0-T3)
  status: not_started
- id: SC-5
  description: 6 rights records seeded at agent_triage_only; no CLEARED_ string under rights/
    (EPR0-T4)
  status: not_started
- id: SC-6
  description: '>= 4 coverage/consistency gates, each with a fails-closed test; a record at
    clearance_status UNKNOWN passes (EPR0-T5/T6)'
  status: not_started
- id: SC-7
  description: No Date.now() in any gate; --as-of honoured; byte-identical across runs (EPR0-T5)
  status: not_started
- id: SC-8
  description: No format "uri" under schemas/rights/; pattern used instead (EPR0-T3)
  status: not_started
- id: SC-9
  description: package.json carries all feature gate wiring and zero new dependencies (EPR0-T6)
  status: not_started
- id: SC-10
  description: npm run check green
  status: not_started
- id: SC-11
  description: task-completion-validator sign-off
  status: not_started
files_modified:
- rights/release-context.json
- rights/rights-records.json
- rights/rights-failures.json
- rights/rights-ledger.json
- schemas/rights/rights_record.schema.json
- schemas/rights/content_reuse_assessment.schema.json
- schemas/rights/permission_record.schema.json
- schemas/rights/rights_failure.schema.json
- schemas/rights/rights_extension.schema.json
- schemas/rights/VENDORING.md
- scripts/validate-rights.mjs
- package.json
- tests/rights-gate-failsclosed.test.mjs
progress: 0
updated: '2026-07-21'
---

# rights-aware-evidence-capture - Phase EP-R0: Rights Substrate

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/rights-aware-evidence-capture/phase-r0-progress.md -t EPR0-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Install the rights substrate (WP0): a top-level `rights/` tree with a join ledger, a
`commercial: false` release context, the five spec schemas vendored **with a declared local amendment
layer**, `scripts/validate-rights.mjs` shipping at least four coverage/consistency gates, and **all**
`package.json` gate wiring the feature will ever need — landed once, here.

**Phase-level entry criteria**: `main` at `npm run check` green; the reviewed spec bundle and its
`checksums.sha256` present under `docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/`;
RF-HANDOFF §9 conflict list read.

**Wave 1, parallel with EP-R5.** EP-R0 owns `package.json` exclusively; EP-R5 owns `CLAUDE.md`
exclusively. The two file sets are disjoint, which is what makes the parallelism safe.

---

## Implementation Notes

### Architectural Decisions

- **D4**: rights records live in a top-level `rights/` tree joined by a ledger. Inline
  `extensions.rights` on clinical JSON is explicitly rejected — a test asserts no inline rights key
  appears in `rules.json`, `candidates.json`, `evidence.json`, or `reference-ranges.json`.
- **D7**: every gate is coverage- and consistency-shaped, never clearance-shaped. A record at
  `clearance_status: UNKNOWN` must pass `npm run validate`. Blocking-status checks test **enum
  membership**, not the value's meaning.
- The vendored schemas are **not usable as published** (handoff §9's six conflicts). They are vendored
  *and* amended, with every amendment a named, rationale-carrying entry in `schemas/rights/VENDORING.md`
  and detectable by the provenance test as *declared* — never a silent edit to the bundle checksum.

### Patterns and Best Practices

- Vendoring precedent is `openapi.yaml`: copy with recorded source path + checksum, never a live `$ref`.
- `validate-rights.mjs` follows the repo's existing validator shape: pure exported functions with unit
  tests, plus a thin CLI wrapper — not a monolithic script.
- Preserve the zero-dependency posture: `package.json` gains no `dependencies`/`devDependencies`.

### Known Gotchas

- The authoritative `npm run check` composition lives in `package.json`, **not** `CLAUDE.md` (stale
  until EPR5-T5 lands): `test && validate && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`.
- No task may write a `CLEARED_*` status, an attestation, `clinicalApprovers[]`, `approvedBy[]`, or an
  authoritative `derived_synthesis`. Ship the plumbing and the fails-closed test, never the value.
- `json-schema-lite` silently ignores `format: "uri"` — use `pattern`.
- Date-dependent gates take `--as-of`/env, never `Date.now()` (byte-identical determinism).
- The legal axis (`overall_status`) lives on the rights record, joined via the ledger — not on the
  evidence item. Item-level axes are `evidence_item_type`, `judgment_basis`, `rights_component_class`.
- `package.json` is an EP-R0-exclusive serialization barrier. If a later phase believes it needs a new
  npm script, that is an escalation to the plan owner, not a local edit — later phases add checks
  *inside* `scripts/validate-rights.mjs`.
- EP-R0 does not touch `scripts/validate-kb.mjs` (EP-R1/EP-R2 own it) or `schemas/evidence.schema.json`
  (EP-R2 then EP-R3 own it).
- A fails-closed test must prove the gate **fails when its precondition is unmet**, not merely that it
  passes on good input. Each of the four gates needs a distinct failing fixture.

### Development Setup

No new dependencies. Node >= 20. The spec bundle and its `checksums.sha256` must be present locally
before EPR0-T2 runs; provenance is recorded at the moment of vendoring.

---

## Completion Notes

_(Fill in when phase is complete: vendored-schema checksum record, the six §9 amendments as landed,
gate inventory with each fails-closed fixture, and confirmation that zero clearance/approver values
were written.)_
