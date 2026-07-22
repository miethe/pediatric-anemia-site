---
type: progress
schema_version: 2
doc_type: progress
prd: spa-module-switcher
feature_slug: spa-module-switcher
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
phase_detail_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-6-7-gates-docs.md
execution_model: batch-parallel
phase: 7
title: "SPA Module Switcher — Phase 7: Documentation Finalization"
status: pending
created: '2026-07-22'
updated: '2026-07-22'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 10
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
- karen
model_usage:
  primary: haiku
  external: []
tasks:
- id: DOC-001
  description: >
    CHANGELOG [Unreleased] entry. changelog_required: true. Add an entry under [Unreleased] per
    Keep A Changelog and .claude/specs/changelog-spec.md. The entry must describe the honest
    outcome — an honest module inventory with one selectable module and three inert ones, and a
    fail-closed refusal replacing the misattributed unit-rejection — and must NOT describe any
    module as validated, verified, reviewed, approved or released. Set changelog_ref: CHANGELOG.md
    in the plan frontmatter.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P6-GATE]
  estimated_effort: "0.25 pts"
  priority: medium
  assigned_model: haiku
  model_effort: adaptive
  target_surfaces:
  - CHANGELOG.md
  acceptance_criteria: >
    Entry exists under [Unreleased] with correct categorization; contains no approval/release/
    validation claim; changelog_ref set.
- id: DOC-002
  description: >
    README evaluation. Evaluate whether the repository README's feature/version surface changed.
    If it describes the SPA's single-module scope, update it to the honest four-module inventory;
    otherwise record "N/A — README does not describe the SPA module surface" with the specific
    lines checked.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P6-GATE]
  estimated_effort: "0.25 pts"
  priority: low
  assigned_model: haiku
  model_effort: adaptive
  target_surfaces:
  - README.md
  acceptance_criteria: >
    README updated, or N/A recorded with the lines checked named explicitly.
- id: DOC-003
  description: >
    docs/architecture.md §2a / §6 / §10 (SQ-4 §5). §2a: add a subsection describing the
    client-facing module-selection control — a read-only consumer of listModules()/MODULE_IDS,
    introducing NO new registry. §6: one line noting the browser now surfaces manifest.status per
    module directly, and that the browser verifies nothing. §10: add a fail-closed entry —
    selecting a non-eligible module must show an explicit refusal, never a silent or broken
    partial render. §7 is NOT applicable — no rule-authoring change. Keep :385-391's staleness
    non-enforcement language intact and cross-reference it from §10.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P6-GATE]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: haiku
  model_effort: adaptive
  target_surfaces:
  - docs/architecture.md
  acceptance_criteria: >
    All three sections updated; §7 explicitly untouched; §2a states "no new registry"; §10's
    entry names the refusal state; doc-truth tests green.
- id: DOC-004
  description: >
    CLAUDE.md orientation diagram + KB bullet (SQ-4 §6). CLAUDE.md's Architecture-orientation
    diagram and KB bullet still say only modules/anemia/rules.json / 91 rules / 26 patterns,
    understating the four registered modules. Generalize to the deriveFacts(input, moduleId) /
    modules/<moduleId>/rules.json shape and cross-reference docs/architecture.md §2a's inventory
    table instead of restating anemia-only counts. Progressive-disclosure rule: pointer layer
    only, ≤3 lines per addition. Do NOT touch the scripts.check string — tests/claudemd-check-gate.test.mjs
    fails on drift and the string is copied verbatim from package.json.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [DOC-003]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: haiku
  model_effort: adaptive
  target_surfaces:
  - CLAUDE.md
  acceptance_criteria: >
    CLAUDE.md generalized with a cross-reference rather than restated counts;
    tests/claudemd-check-gate.test.mjs green; the npm run check string is byte-unchanged.
- id: DOC-005
  description: >
    Plan frontmatter finalization. Set status: completed, populate commit_refs, files_affected
    and updated; set changelog_ref; populate deferred_items_spec_refs from DOC-006 (FIVE paths now,
    including ADR-0010) and findings_doc_ref from DOC-007.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [DOC-001, DOC-002, DOC-003, DOC-004, DOC-006, DOC-007]
  estimated_effort: "0.25 pts"
  priority: medium
  assigned_model: haiku
  model_effort: adaptive
  target_surfaces:
  - docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
  acceptance_criteria: >
    Frontmatter complete per the lifecycle spec; deferred_items_spec_refs lists all five DOC-006
    paths; findings_doc_ref populated.
- id: DOC-006
  description: >
    Author a design spec for each deferred item (parent plan triage table). One artifact per row,
    maturity: shaping (or idea where research is needed), prd_ref set to the switcher PRD, path
    appended to deferred_items_spec_refs. DF-SMS-01 → sign-kb-per-module-content-hashing.md;
    DF-SMS-02 → per-module-evidence-view.md; DF-SMS-03 →
    algorithm-explorer-module-generalization.md; DF-SMS-04 → UPDATE the existing
    public-moduleid-api-surface.md (verify P0-03's dated re-confirmation section is present and
    accurate, append the switcher's shipped state as evidence). DF-SMS-06 → author
    docs/adr/0010-browser-test-capability-for-the-spa.md, status: proposed — an ADR, not a design
    spec, because it proposes changing a posture rather than a design. It must record: that
    package.json declares no dependencies and no devDependencies; that
    scripts/smoke-browser-unit-rejection.mjs:4-15 states the no-browser-automation posture
    deliberately; the concrete cost this feature measured — behavioral fail-closure, banner
    placement and refusal transitions are source-asserted plus human-reviewed, never executed (PRD
    §11a); and that D-6 REFUSED to add jsdom as a side effect of a UI feature. It must NOT claim
    the capability exists and must NOT be written as a plan to adopt one. Trigger: further
    safety-critical SPA UI, or a second selectable module.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P6-GATE]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: haiku
  model_effort: adaptive
  target_surfaces:
  - docs/project_plans/design-specs/sign-kb-per-module-content-hashing.md
  - docs/project_plans/design-specs/per-module-evidence-view.md
  - docs/project_plans/design-specs/algorithm-explorer-module-generalization.md
  - docs/project_plans/design-specs/public-moduleid-api-surface.md
  - docs/adr/0010-browser-test-capability-for-the-spa.md
  acceptance_criteria: >
    Three new design specs plus ADR-0010 exist with correct frontmatter; the fifth (DF-SMS-04)
    existing spec verified/updated; all five paths appended to deferred_items_spec_refs; ADR-0010 is
    status: proposed and claims no capability that does not exist; each artefact names its promotion
    trigger from the triage table.
- id: DOC-007
  description: >
    Create & finalize the findings doc — THREE findings are already known. Create
    .claude/findings/spa-module-switcher-findings.md (lazy-creation rule; not pre-created, but two
    findings are known at planning time and MUST be recorded regardless). Finding 1 (R-5/DF-SMS-01):
    scripts/sign-kb.mjs's anemia hardcode makes every module's clinicalContentHash a false
    attestation if surfaced; kept off-screen by FR-31. Finding 2 (SQ-3 F9/DF-SMS-05): all 7
    cbc_suite_v1 rule evidence IDs resolve to nothing against src/evidence.js (anemia's 6 only) —
    citations silently vanish, breaching the CLAUDE.md guardrail "every clinical statement ties to
    a source". Finding 3 (the stale tripwire comment): tests/module-registry.test.mjs:20-24 says
    the assertion "must be updated/deleted the day a second module registers" and still asserts
    "today there is exactly one registered module"; four have been registered since commit 263120b,
    so the trigger fired and went unactioned for a release. Record it as PRE-EXISTING DEBT this
    feature closed at P6-010 — not as something this feature caused, and not merged with the
    separate src/modules/registry.js:39-50 trigger. Advance status: draft → accepted, set
    promoted_to to this plan's path, set findings_doc_ref in the plan frontmatter.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [DOC-006]
  estimated_effort: "0.25 pts"
  priority: high
  assigned_model: haiku
  model_effort: adaptive
  target_surfaces:
  - .claude/findings/spa-module-switcher-findings.md
  acceptance_criteria: >
    Findings doc exists with all three known findings recorded (R-5 sign-kb; SQ-3 F9 cbc evidence IDs; the stale tests/module-registry.test.mjs:20-24 comment, overdue since 263120b) and any execution-time findings
    appended; status: accepted; promoted_to set; findings_doc_ref populated in the plan
    frontmatter and appended to related_documents.
- id: DOC-008
  description: >
    Project-level skill updates. Check .claude/specs/skills-index.md for any project-level
    custom skill whose domain this feature touches. Expected outcome: "N/A — no project-level
    skill domains affected" (this feature adds no CLI, no workflow and no new agent capability).
    Record the check, not just the conclusion.
  status: pending
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P6-GATE]
  estimated_effort: "0.25 pts"
  priority: low
  assigned_model: haiku
  model_effort: adaptive
  target_surfaces:
  - .claude/specs/skills-index.md
  acceptance_criteria: >
    Affected skills updated, or N/A recorded with the skills-index entries checked named
    explicitly.
- id: P7-GATE
  description: >
    task-completion-validator gate. Verify the Phase 7 exit gate: doc-truth tests green;
    tests/claudemd-check-gate.test.mjs green; all five deferred-item spec paths (incl. ADR-0010) in
    deferred_items_spec_refs; findings_doc_ref populated and the doc at status: accepted. Reject
    if CLAUDE.md restates anemia-only counts instead of cross-referencing §2a, or if the npm run
    check string drifted.
  status: pending
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [DOC-001, DOC-002, DOC-003, DOC-004, DOC-005, DOC-006, DOC-007, DOC-008]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: FEATURE-KAREN
  description: >
    karen end-of-feature review. Final review across the WHOLE feature, not just P7. Verify: (1)
    NO artifact delivered by this feature is described as validated, verified, clinically
    reviewed, approved or released — in code, tests, docs, CHANGELOG or the feature guide; (2) NO
    module manifest status changed and nothing was signed (FR-35) — re-run P0-04's check against
    the full feature diff; (3) the delivered UI shows one selectable module and three inert ones,
    and says so honestly; (4) the browser-verifies-nothing disclosure is present in the panel, not
    a tooltip; (5) every deferred item has a spec or a recorded finding.
  status: pending
  assigned_to: [karen]
  provider: claude
  dependencies: [P7-GATE]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: >
    End-of-feature review recorded; blocking findings resolved before the PR is opened.
parallelization:
  batch_1: [DOC-001, DOC-002, DOC-003, DOC-006, DOC-008]
  batch_2: [DOC-004, DOC-007]
  batch_3: [DOC-005]
  batch_4: [P7-GATE]
  batch_5: [FEATURE-KAREN]
  critical_path: [DOC-003, DOC-004, DOC-005, P7-GATE, FEATURE-KAREN]
  estimated_total_time: "~0.5–1 engineer-day"
blockers:
- id: BLOCKER-PHASE-DEP
  title: "Phase 7 cannot open until Phase 6 exit gates (P6-GATE, P6-KAREN) both pass"
  severity: high
  blocking: [DOC-001, DOC-002, DOC-003, DOC-006, DOC-008]
  resolution: >
    Wait for .claude/progress/spa-module-switcher/phase-6-progress.md P6-GATE and P6-KAREN to
    both complete.
  created: '2026-07-22'
success_criteria:
- id: SC-1
  description: "CHANGELOG [Unreleased] entry present, with no approval/release/validation claim"
  status: pending
- id: SC-2
  description: "docs/architecture.md §2a/§6/§10 updated; §7 untouched"
  status: pending
- id: SC-3
  description: "CLAUDE.md generalized, cross-referencing §2a rather than restating counts; tests/claudemd-check-gate.test.mjs green"
  status: pending
- id: SC-4
  description: "Three new deferred-item design specs + ADR-0010 (proposed, DF-SMS-06) authored, public-moduleid-api-surface.md verified; all five paths in deferred_items_spec_refs; ADR-0010 claims no capability that does not exist"
  status: pending
- id: SC-5
  description: ".claude/findings/spa-module-switcher-findings.md created with all three known findings (R-5 sign-kb; SQ-3 F9 cbc evidence IDs; the stale tests/module-registry.test.mjs:20-24 comment overdue since 263120b), status: accepted, findings_doc_ref set"
  status: pending
- id: SC-6
  description: "README and project-skill checks completed or explicitly recorded N/A with what was checked"
  status: pending
- id: SC-7
  description: "Plan frontmatter finalized (status: completed, commit_refs, files_affected, updated)"
  status: pending
- id: SC-8
  description: "karen end-of-feature review recorded and blocking findings resolved"
  status: pending
files_modified:
- CHANGELOG.md
- README.md
- docs/architecture.md
- CLAUDE.md
- docs/project_plans/design-specs/sign-kb-per-module-content-hashing.md
- docs/project_plans/design-specs/per-module-evidence-view.md
- docs/project_plans/design-specs/algorithm-explorer-module-generalization.md
- docs/project_plans/design-specs/public-moduleid-api-surface.md
- .claude/findings/spa-module-switcher-findings.md
notes: >
  Wave 7 — depends on Phase 6 complete (both gates). **Provider pin — load-bearing**:
  `provider: claude` on EVERY task. `task_class: documentation` resolves to free-tier Haiku
  regardless of the requested model (decisions block §6 routing finding); without the explicit
  pin these tasks silently land on a free-tier route. Model is `haiku` for this phase (mechanical
  doc edits) — the only phase not using `sonnet` as primary. This is the final phase; on
  `FEATURE-KAREN` passing, trigger the Wrap-Up: delegate to a documentation writer
  (general-purpose, sonnet) to create `.claude/worknotes/spa-module-switcher/feature-guide.md`
  (≤200 lines, standard template) before opening the PR. Its Known Limitations section must state
  plainly that one module is selectable, three are inert, and the browser verifies nothing.
---

# spa-module-switcher — Phase 7: Documentation Finalization

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-7-progress.md -t DOC-001 -s completed
```

---

## Objective

Close the loop on documentation truth: CHANGELOG, `docs/architecture.md` §2a/§6/§10, `CLAUDE.md`'s
orientation diagram, five deferred-item artefacts (three new design specs, one updated spec, and ADR-0010), the findings doc
(two known findings), and the plan's own frontmatter finalization — followed by the feature's final
`karen` end-of-feature review.

**Duration**: ~0.5–1 engineer-day · **Dependencies**: Phase 6 complete (wave 7) ·
**Provider pin — load-bearing**: `provider: claude` on **every** task (`task_class: documentation`
otherwise resolves to free-tier Haiku regardless of requested model) · **Exit gate**: doc-truth
tests green; `tests/claudemd-check-gate.test.mjs` green.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| DOC-001 | CHANGELOG `[Unreleased]` entry | general-purpose (documentation writer¹) | haiku/adaptive | claude | pending | P6-GATE |
| DOC-002 | README evaluation | general-purpose | haiku/adaptive | claude | pending | P6-GATE |
| DOC-003 | `docs/architecture.md` §2a/§6/§10 | general-purpose | haiku/adaptive | claude | pending | P6-GATE |
| DOC-004 | `CLAUDE.md` orientation diagram + KB bullet | general-purpose | haiku/adaptive | claude | pending | DOC-003 |
| DOC-005 | Plan frontmatter finalization | general-purpose | haiku/adaptive | claude | pending | DOC-001..004, DOC-006, DOC-007 |
| DOC-006 | Author a design spec per deferred item | general-purpose | haiku/adaptive | claude | pending | P6-GATE |
| DOC-007 | Create & finalize the findings doc | general-purpose | haiku/adaptive | claude | pending | DOC-006 |
| DOC-008 | Project-level skill updates | general-purpose | haiku/adaptive | claude | pending | P6-GATE |
| P7-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | pending | DOC-001..008 |
| FEATURE-KAREN | **`karen` end-of-feature review** | karen | sonnet/adaptive | claude | pending | P7-GATE |

¹ **Agent-name substitution**: `documentation-writer` is not registered in this project;
dispatched as `general-purpose` with the role descriptor retained.

---

## Orchestration Quick Reference

### Batch 1 (after Phase 6 gates)

```
Task("general-purpose", "DOC-001: CHANGELOG [Unreleased] entry (changelog_required: true).
Describe the honest outcome — four-module inventory, one selectable, three inert, fail-closed
refusal replacing misattributed unit-rejection. No approval/release/validation claim. Set
changelog_ref: CHANGELOG.md. See plan §Phase 7, DOC-001.")

Task("general-purpose", "DOC-002: README evaluation. Check whether README describes the SPA's
single-module scope; update to the four-module inventory, or record N/A with lines checked. See
plan §Phase 7, DOC-002.")

Task("general-purpose", "DOC-003: docs/architecture.md §2a/§6/§10 (SQ-4 §5). §2a: read-only
selection control, no new registry. §6: browser surfaces manifest.status, verifies nothing. §10:
fail-closed refusal entry. §7 explicitly untouched. See plan §Phase 7, DOC-003.")

Task("general-purpose", "DOC-006: Author design specs for deferred items DF-SMS-01..04. Three
new specs (sign-kb hashing, per-module evidence view, algorithm-explorer generalization) plus one
UPDATE (public-moduleid-api-surface.md), plus ADR-0010 browser-test-capability (proposed, DF-SMS-06 — records the D-6 ceiling honestly and claims no capability). Append all five paths to deferred_items_spec_refs. See
plan §Phase 7, DOC-006.")

Task("general-purpose", "DOC-008: Project-level skill updates. Check
.claude/specs/skills-index.md for affected skill domains. Expected: N/A — record the check
explicitly. See plan §Phase 7, DOC-008.")
```

### Batch 2 (after DOC-003, DOC-006)

```
Task("general-purpose", "DOC-004: CLAUDE.md orientation diagram + KB bullet (SQ-4 §6).
Generalize to deriveFacts(input, moduleId)/modules/<moduleId>/rules.json, cross-referencing
docs/architecture.md §2a instead of restating anemia-only counts. Do NOT touch the scripts.check
string. See plan §Phase 7, DOC-004.")

Task("general-purpose", "DOC-007: Create .claude/findings/spa-module-switcher-findings.md with
BOTH known findings — R-5/DF-SMS-01 (sign-kb anemia hardcode) and SQ-3 F9/DF-SMS-05 (cbc evidence
ID resolution gap). status: accepted, promoted_to set. See plan §Phase 7, DOC-007.")
```

### Batch 3 (after all doc tasks)

```
Task("general-purpose", "DOC-005: Plan frontmatter finalization. status: completed;
commit_refs/files_affected/updated populated; changelog_ref set; deferred_items_spec_refs from
DOC-006; findings_doc_ref from DOC-007. See plan §Phase 7, DOC-005.")
```

### Gate + Feature-End Review

```
Task("task-completion-validator", "P7-GATE: Verify Phase 7 exit gate for spa-module-switcher —
doc-truth tests green; tests/claudemd-check-gate.test.mjs green; all five deferred-item spec
paths present; findings_doc_ref populated at status: accepted. Reject if CLAUDE.md restates
anemia-only counts or if the npm run check string drifted.")

Task("karen", "FEATURE-KAREN: End-of-feature review across the WHOLE spa-module-switcher
feature. Verify: (1) no artifact anywhere claims validated/verified/clinically
reviewed/approved/released; (2) no module manifest status changed, nothing signed — re-run
P0-04's check against the full feature diff; (3) UI honestly shows 1 selectable + 3 inert
modules; (4) browser-verifies-nothing disclosure in the panel, not a tooltip; (5) every deferred
item has a spec or recorded finding.")
```

---

## Quality Gates

- [ ] CHANGELOG `[Unreleased]` entry present, with no approval/release/validation claim and no implication of executed browser testing (PRD §11a)
- [ ] `docs/architecture.md` §2a (read-only selection control, no new registry), §6 (browser surfaces `manifest.status`, verifies nothing), §10 (fail-closed refusal entry) updated; §7 untouched
- [ ] `CLAUDE.md` generalized to `deriveFacts(input, moduleId)` / `modules/<moduleId>/rules.json`, cross-referencing §2a rather than restating counts
- [ ] `tests/claudemd-check-gate.test.mjs` green; the `npm run check` string byte-unchanged
- [ ] Three new deferred-item design specs **+ ADR-0010 (`proposed`, DF-SMS-06)** authored, `public-moduleid-api-surface.md` verified; all five paths in `deferred_items_spec_refs`; ADR-0010 records the ceiling and claims no capability that does not exist
- [ ] `.claude/findings/spa-module-switcher-findings.md` created with **all three** known findings (R-5 sign-kb; SQ-3 F9 cbc evidence IDs; the stale `tests/module-registry.test.mjs:20-24` comment, overdue since `263120b`), `status: accepted`, `findings_doc_ref` set
- [ ] README and project-skill checks completed or explicitly recorded N/A with what was checked
- [ ] Plan frontmatter finalized (`status: completed`, `commit_refs`, `files_affected`, `updated`)
- [ ] `karen` end-of-feature review recorded and blocking findings resolved

---

## Implementation Notes

### Architectural Decisions

- Both known deferred findings (R-5 `sign-kb.mjs` hardcode; SQ-3 F9 cbc evidence-ID resolution
  gap) are recorded **regardless of whether any new execution-time finding appears** — they were
  already known at planning time and are non-negotiable inclusions in `DOC-007`.

### Known Gotchas

- **Provider pin is load-bearing on every task in this phase** — same routing hazard as Phase 0
  (`task_class: documentation` → free-tier Haiku unless `provider: claude` is pinned explicitly).
- `DOC-004` must **not** touch the `scripts.check` string — `tests/claudemd-check-gate.test.mjs`
  fails on drift, and the string is copied verbatim from `package.json`.
- `FEATURE-KAREN` reviews the **whole feature**, not just this phase's docs — it re-runs `P0-04`'s
  zero-status-change check against the full feature diff, not just Phase 7's files.

### Development Setup

Node ≥ 20. Gate before PR: `task-completion-validator` sign-off (`P7-GATE`) + `karen`
end-of-feature sign-off (`FEATURE-KAREN`) — **both** required before the Wrap-Up (feature-guide +
PR) triggers.

---

## Completion Notes

Fill in when Phase 7 is complete: what was authored, key learnings, unexpected challenges, and
confirmation that the Wrap-Up (feature-guide + PR) was triggered on `FEATURE-KAREN` passing.
