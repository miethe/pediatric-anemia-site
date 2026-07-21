---
type: progress
schema_version: 2
doc_type: progress
prd: wave0-safety-foundation
feature_slug: wave0-safety-foundation
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
execution_model: sequential
phase: 4
created: '2026-07-19'
title: 'EP-4: Rule Metadata for Governance'
status: completed
started: 2026-07-20T20:00Z
completed: '2026-07-21T05:00Z'
commit_refs:
- 545e666
- 8a6ddc7
- aabc24e
pr_refs: []
overall_progress: 100
completion_estimate: on-track
total_tasks: 4
completed_tasks: 4
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- artifact-validator
model_usage:
  primary: sonnet
  external: []
tasks:
- id: EP4-T1
  description: 'Extend rule.schema.json (additionalProperties: false, :7) with version,
    effectiveDate, retireDate, owner, safetyClass, requiredTestCaseIds[], changeRationale,
    sourcePassageId, clinicalApprovers[] — explicit typed nulls/empty-arrays so legitimate
    absence is schema-representable.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP-3 (passage IDs minted; see EP3-T2/T3)
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: medium
  started: 2026-07-21T00:00Z
  completed: 2026-07-21T03:00Z
  evidence:
  - commit: 545e666
  verified_by:
  - EP4-T2
  - EP4-T3
- id: EP4-T2
  description: Single-commit codemod over all 91 rules populating version/effectiveDate/owner/safetyClass/sourcePassageId/changeRationale;
    requiredTestCaseIds[] populated where an EP-6 fixture already exists, else explicit
    empty array. Explicitly cheap, mechanical, high-token, near-zero judgment work.
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP4-T1
  - EP3-T4
  estimated_effort: 2.5 pts
  priority: high
  assigned_model: haiku
  model_effort: medium
  started: 2026-07-21T00:00Z
  completed: 2026-07-21T03:00Z
  evidence:
  - commit: 545e666
  verified_by:
  - EP4-T3
  - EP4-T4
- id: EP4-T3
  description: 'D-4 structural test — clinicalApprovers[] empty (FR-WP4-03, AC-D4):
    dedicated node:test asserts clinicalApprovers is [] on all 91 rules, and fails
    if populated from any non-owner-attested source, including ARC council output.
    The single most important AC in this phase.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP4-T2
  estimated_effort: 1.0 pt
  priority: critical
  assigned_model: sonnet
  model_effort: high
  started: 2026-07-20T20:00Z
  completed: 2026-07-21T05:00Z
  evidence:
  - commit: 545e666
  - audit: docs/audits/ep3-ep4-reviewer-gate-final-2026-07-21.md
  note: D-4 is enforced at four layers and all reviewer-demonstrated bypasses are
    closed, but pass 5 reopened it once already; nothing in-phase verifies this verifier,
    so it stays partial until a reviewer gate passes.
  verified_by:
  - REVIEWER-GATE-2026-07-21
- id: EP4-T4
  description: 'R-P2 resilience — consumers handle absent governance fields (AC-WP4-RESIL):
    retireDate: null treated as ''active,'' clinicalApprovers: [] as ''no credentialed
    approval yet'' (never ''approved''), requiredTestCaseIds: [] as ''no test-case
    linkage yet'' (never ''exempt from testing'').'
  status: completed
  assigned_to:
  - artifact-validator
  dependencies:
  - EP4-T2
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  started: 2026-07-21T00:00Z
  completed: 2026-07-21T03:00Z
  evidence:
  - commit: 545e666
  verified_by:
  - EP4-T3
parallelization:
  batch_1:
  - EP4-T1
  batch_2:
  - EP4-T2
  batch_3:
  - EP4-T3
  - EP4-T4
  critical_path:
  - EP4-T1
  - EP4-T2
  - EP4-T3
  estimated_total_time: 4.5 pts (critical path)
blockers: []
success_criteria:
- id: SC-1
  description: All 91 rules validate against the extended rule.schema.json in one
    commit (EP4-T1/T2)
  status: completed
  note: All 91 rules validate against the extended schema; verified 0 behavioral diffs
    vs main after stripping the 9 governance fields, so the dangerous-miss/hazard-matrix
    digest rebinds are safe.
- id: SC-2
  description: 'AC-D4 structural test passes: clinicalApprovers[] is [] on all 91
    rules, and the test fails on any non-owner-attested population (EP4-T3)'
  status: partial
  note: 'PARTIAL — reopened by reviewer pass 5, which showed the runtime layer still
    evaluated a malformed truthy non-array clinicalApprovers value; now strict (only
    an explicit empty array is evaluable). Hardened after the gate demonstrated three
    earlier live bypasses. Enforced at four layers: schema maxItems 0, source and
    built-artifact tests across all MODULE_IDS (derived from REGISTRY), a post-build
    verify:d4 gate ordered after npm run build, and a runtime refusal at the lowest
    exported evaluation entry point (ruleEngine.runRules).'
- id: SC-3
  description: 'AC-WP4-RESIL: absent governance fields never misread as errors or
    as exemptions (EP4-T4)'
  status: completed
  note: Semantics implemented in src/governance.js and now WIRED into a real path
    — engine.js attaches hasCredentialedClinicalApproval/isActive to provenance.ruleAudit
    (reviewer pass 2, FIX-F). The false anti-truthiness claim was retracted at both
    sites.
- id: SC-4
  description: npm run check green
  status: completed
  note: npm run check green, including the post-build verify:d4 gate. No exact test
    count is recorded here — it went stale twice across remediation rounds; read it
    from the latest commit. (Count updated per reviewer pass 5, which flagged the
    recorded figure as stale.)
- id: SC-5
  description: task-completion-validator sign-off
  status: completed
  note: 'Reviewer gate PASSED on the eighth pass (2026-07-21, gpt-5.6-sol adversarial gate): VERDICT APPROVE WITH FOLLOW-UPS, all eight structural invariants HOLD. Passes 1-7 each returned CHANGES REQUIRED and each found real defects. This is a SYNTHETIC adversarial review — it is not clinical validation, not credentialed clinical review, and confers no release authority. Report: docs/audits/ep3-ep4-reviewer-gate-final-2026-07-21.md.'
files_modified:
- schemas/rule.schema.json
- modules/anemia/rules.json
- src/ruleEngine.js
- src/engine.js
- scripts/validate-kb.mjs
progress: 100
updated: '2026-07-20'
---

# wave0-safety-foundation - Phase 4: Rule Metadata for Governance

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/wave0-safety-foundation/phase-4-progress.md -t EP4-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Install governed rule metadata (WP4): all 91 rules carry `version`/`effectiveDate`/`retireDate`/`owner`/`safetyClass`/`requiredTestCaseIds`/`changeRationale`/`sourcePassageId`, and `clinicalApprovers[]` ships built-but-empty per D-4. **Strict serial dependency**: this phase does not start until EP-3's passage IDs exist to reference. Grouped with EP-3 in the plan's phase file (`phase-3-4-evidence-and-governance.md`) but tracked here as its own progress file.

---

## Implementation Notes

### Architectural Decisions

- `rule.schema.json`'s `additionalProperties: false` means there is no incremental rollout path — EP4-T2 must be a single, atomic, all-91-rules commit, reviewed as a diff of *generated* content, not hand-edited rule by rule.
- EP4-T3 (D-4 structural test) is the single most important AC in this phase per the plan's own framing — it is a structural guarantee, not documentation, and its failure message must name the offending rule id(s).

### Patterns and Best Practices

- EP4-T2 is explicitly and deliberately routed to `haiku` — high-token, near-zero-judgment mechanical work. Do not escalate to a premium model "to be safe"; the risk in this task is process (atomicity, one commit) not reasoning.

### Known Gotchas

- Do not let EP4-T2's codemod run before EP3-T4 lands — EP4-T2 depends on both EP4-T1 (schema) and EP3-T4 (validate-kb extension), and `sourcePassageId` values must already be resolvable when the codemod populates them.
- Watch specifically for `clinicalApprovers[]` being populated from ARC council output during EP4-T2's codemod — the codemod must write an explicit empty array, never a reviewer-role placeholder.

### Development Setup

No new dependencies. Single-commit schema + codemod work against existing tooling.

---

## Completion Notes

_(Fill in when phase is complete: codemod commit SHA, D-4 test result, any rules requiring individual review beyond the mechanical pass.)_
