---
type: progress
schema_version: 2
doc_type: progress
prd: four-state-questionnaire-ui
feature_slug: four-state-questionnaire-ui
prd_ref: docs/project_plans/PRDs/features/four-state-questionnaire-ui-v1.md
plan_ref: docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1.md
phase_detail_ref: docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1/phase-4-docs-and-honesty.md
execution_model: batch-parallel
phase: 4
title: "Four-State Questionnaire UI — Phase 4: Docs & Honesty Corrections"
status: not_started
created: '2026-07-23'
updated: '2026-07-23'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: not-started
total_tasks: 7
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
  primary: sonnet-5[1m]
  external: [ica]
tasks:
- id: P4-01
  description: >
    Cross-reference tri-state-fact-model.md + one-line CLAUDE.md pointer. (a) Add a section to
    docs/project_plans/design-specs/tri-state-fact-model.md cross-referencing this feature as the
    UI-layer consumer of the existing three-value model — explicitly stating no fourth wire state
    was added, the engine stays tri-state, and pointing to src/facts/fieldState.js as the
    client-side control-mapping module. Do not restate the SPIKE-003/SPIKE-010 findings; point to
    them. (b) Add a ≤3-line pointer to the root CLAUDE.md's Architecture orientation section
    naming src/facts/fieldState.js alongside the existing src/facts.js/src/facts/registry.js
    mention, per the repo's own "pointer layer only" convention for that file.
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P3-GATE]
  estimated_effort: "0.5 pts"
  priority: medium
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces:
  - docs/project_plans/design-specs/tri-state-fact-model.md
  - CLAUDE.md
  acceptance_criteria: >
    New section in tri-state-fact-model.md states plainly that no 4th wire state exists;
    CLAUDE.md gains ≤3 lines, pointer-only, no restated detail.
- id: P4-02
  description: >
    Correct roadmap title + depends_on (OQ-3, §5.3/§5.4), and move SPIKE-010's research_ids entry
    to the correct work package (karen K-1). Per PRD §5.3/§5.4 and decisions block §9 (OQ-3,
    "recommend yes"): edit docs/project_plans/expansion/01-platform-expansion-roadmap.md:288
    (the P3-WP7 title/description row, currently "Tri-state adaptive questionnaire UI — surface
    present/absent/unknown/not-assessed in the SPA … ordered by information value") to drop
    "adaptive" and the information-value-ordering clause (out of scope, §5.2) — e.g. retitle to
    "Four-option questionnaire UI — surface present/absent/unknown/not-assessed in the SPA,"
    recording that the ordering-by-information-value half is a separate, not-yet-evidence-backed
    work package (per P4-04's deferred-item spec). Also edit the JSON node at :545 ({"id":
    "P3-WP7", "title": "Tri-state adaptive questionnaire UI", "depends_on": ["P3-WP6","P1-WP1"],
    ...}) to match the corrected title and to remove "P3-WP6" from depends_on (PRD §5.4:
    src/fhir/mapping.js does not exist and nothing in this feature touches or is blocked by it —
    confirmed by repository search, not merely asserted). Retain "P1-WP1" in depends_on unless a
    separate check shows it too is not a real dependency (out of scope for this verification — do
    not silently drop it without the same confirmation standard applied to P3-WP6). karen's K-1,
    additionally: 01-platform-expansion-roadmap.md:542 currently lists "research_ids":
    ["SPIKE-010"] under P3-WP4 ("SMART App Launch + autofill") — the wrong work package;
    SPIKE-010 is this feature's own SPIKE
    (docs/project_plans/SPIKEs/spike-010-four-state-questionnaire-ui.md), which belongs to
    P3-WP7, whose research_ids at :545 is currently []. Move the ID: remove "SPIKE-010" from
    P3-WP4's research_ids (leaving it [], unless P3-WP4 has an independent claim to it — verify at
    implementation time, not assumed) and add it to P3-WP7's research_ids (["SPIKE-010"]).
    Re-verify these exact line numbers against the live file before editing — they may have
    shifted since this task was authored. Note in the commit/PR description that the IntentTree
    node title (node_01KXQ7XFBSFNEEAJA8XJM621PZ, currently also "Tri-state...") is a follow-up
    action for the human/orchestrator — this plan edits repository files only; it does not call
    itt/IntentTree tools.
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P4-01]
  estimated_effort: "0.5 pts"
  priority: medium
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces:
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  acceptance_criteria: >
    Roadmap :288 title dropped "adaptive" and the information-value clause; :545's JSON title
    matches; depends_on no longer lists "P3-WP6"; "P1-WP1" untouched; P3-WP4's research_ids no
    longer lists "SPIKE-010"; P3-WP7's research_ids now lists ["SPIKE-010"]; commit/PR notes the
    IntentTree title as a separate follow-up, not silently left stale without acknowledgment.
- id: P4-03
  description: >
    CHANGELOG [Unreleased] entry. Add an entry under [Unreleased] per
    .claude/specs/changelog-spec.md conventions describing: the 59 booleanMap fields now render
    as 4-option controls (present/absent/unknown/not-assessed); the round-trip data-loss defect
    (false vs. unknown collapsing to the same unchecked state) is fixed; unanswered fields are now
    omitted from the payload rather than defaulted to false; and, per the cross-family review's
    F-1 fix, the safety-findings banner and workflow-step indicators were rewired to keep working
    correctly against the new control type. Must state plainly: this changes capture fidelity
    only — engine output is unchanged, supported by the structural 28-rule-condition proof
    (SPIKE-010 leg D) and the new executed transform test (P2-08), not by "all 6 golden fixtures
    identical" alone (per F-3, that fixture run is weak corroborating evidence, not the primary
    proof — do not restate it as if it were). Do not phrase this as an accuracy, safety, or
    diagnostic improvement.
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P3-GATE]
  estimated_effort: "0.25 pts"
  priority: medium
  assigned_model: haiku
  model_effort: adaptive
  target_surfaces:
  - CHANGELOG.md
  acceptance_criteria: >
    Entry exists under [Unreleased], correctly categorized; explicitly states engine output is
    unchanged without over-relying on the fixture-identity claim; contains no diagnostic/safety/
    accuracy claim.
- id: P4-04
  description: >
    Author OQ-4 deferred-item design spec. Per the Deferred Items policy (parent plan): author
    docs/project_plans/design-specs/non-booleanmap-four-state-treatment.md at maturity: idea
    (research/decision needed, not yet shaped) recording OQ-4 — whether the 13 non-booleanMap
    booleans (4 cbc.localFlags, 6 lab-result booleans, 3 patient booleans) eventually need the
    same present/absent/unknown/not-assessed treatment this feature gives the 59 booleanMap
    fields. Set prd_ref to this feature's PRD path. State plainly that this feature does not
    answer the question, only names it so it is not lost. Append the path to this plan's
    deferred_items_spec_refs frontmatter.
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P3-GATE]
  estimated_effort: "0.5 pts"
  priority: medium
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces:
  - docs/project_plans/design-specs/non-booleanmap-four-state-treatment.md
  acceptance_criteria: >
    Design spec exists at the exact path, maturity: idea, prd_ref set; deferred_items_spec_refs
    in the parent plan's frontmatter includes this path.
- id: P4-05
  description: >
    Record OQ-1/OQ-2/OQ-5 resolution; finalize the manual-verification checklist (+1 item per
    F-1). (a) Confirm the P3-00 phase-entry record (who resolved OQ-1/OQ-2 and where) is durably
    captured — either as an addendum to
    .claude/worknotes/four-state-questionnaire-ui/decisions-block.md or a dedicated note
    referenced from this plan's progress file; if it is not yet durably recorded, do so now
    rather than letting it live only in a chat transcript. (a2) Confirm OQ-5 (cross-family review
    F-2) is also durably recorded — which of the three PRD §12 options (version stamp / separate
    capture envelope / drop the claim) a named human chose, and where that choice is reflected
    (e.g. in tri-state-fact-model.md's P4-01 cross-reference, or a dedicated addendum) — this was
    a blocking P3-00 phase-entry precondition alongside OQ-1/OQ-2 and must not be silently absent
    from the final record. (b) Execute and record the remaining four items of the PRD §11
    Human-verification acceptance checklist (P3-06 already recorded item 1, visual layout): a
    named person confirms keyboard-only operation reaches and selects each of the four options for
    a representative sample of fields; a named person confirms the safety-reviewed
    mutual-exclusion behavior at runtime (AC-5 — both directions: ticking safety-reviewed sets
    every immediateSafetyNames field to Absent, and marking any one of them Present or Unknown
    unchecks safety-reviewed); a named person confirms form.reset() behavior against the new
    controls; and — per cross-family review F-1 — a named person confirms the safety-findings
    banner's count (safetyCount) accurately reflects fields marked Present, and that
    step-safety/step-history/step-smear actually complete when corresponding field data is
    entered, since neither can be proven by any executed test (P2-06's source-shape pin proves
    delegation, not runtime rendering).
  status: not_started
  assigned_to: [general-purpose]
  provider: ica
  dependencies: [P4-01, P4-02, P4-03, P4-04]
  estimated_effort: "0.25 pts"
  priority: high
  assigned_model: sonnet-5[1m]
  model_effort: adaptive
  target_surfaces: []
  acceptance_criteria: >
    OQ-1/OQ-2/OQ-5 resolution durably recorded with a pointer; all four remaining
    human-verification checklist items (keyboard, safety-reviewed runtime, form.reset,
    safety-banner/workflow-step) have a named signer + date recorded; none is marked done without
    an actual name attached.
- id: P4-GATE
  description: >
    task-completion-validator gate. Verify the Phase 4 exit gate (decisions block §6): npm run
    check shows no new failures versus the 8-failure baseline. Also verify: CHANGELOG entry
    exists and makes no overclaim; roadmap correction applied at both cited lines and the
    SPIKE-010 research_ids move is applied (K-1); OQ-4 spec authored and referenced in
    frontmatter; OQ-5 resolution durably recorded (not silently absent); all 5
    human-verification checklist items (P3-06 + P4-05's four) have named signers. Reject if any
    documentation task implies a diagnostic/safety/accuracy improvement, if the roadmap edit left
    "P3-WP6" in depends_on or left "SPIKE-010" under P3-WP4, if OQ-5's resolution is missing, or
    if any human-verification item lacks a name.
  status: not_started
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P4-01, P4-02, P4-03, P4-04, P4-05]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces: []
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: FEATURE-KAREN
  description: >
    karen end-of-feature review. End-of-feature review per project convention
    (spa-module-switcher-v1 precedent). Verifies: no artifact in the delivered feature is
    described as validated, verified, reviewed, approved, or released; approvedBy[]/
    clinicalApprovers[] remain schema-forced empty everywhere; the honesty caveat (engine output
    unchanged, capture fidelity only, and — per F-3 — supported by the structural 28-condition
    proof rather than the near-vacuous fixture run) is stated plainly in every doc surface this
    phase touched, not softened or dropped; OQ-5's resolution is recorded, not silently dropped;
    this review is the same reviewer whose earlier pass on this plan (Review History, parent
    plan) missed F-1 — this pass specifically re-checks that the F-1/F-3/F-4 fixes actually
    shipped, not merely that they were planned.
  status: not_started
  assigned_to: [karen]
  provider: claude
  dependencies: [P4-GATE]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces: []
  acceptance_criteria: "Review recorded; any finding either fixed before sign-off or logged."
parallelization:
  batch_1: [P4-01, P4-03, P4-04]
  batch_2: [P4-02]
  batch_3: [P4-05]
  batch_4: [P4-GATE]
  batch_5: [FEATURE-KAREN]
  critical_path: [P4-01, P4-02, P4-05, P4-GATE, FEATURE-KAREN]
  estimated_total_time: "not stated in phase detail file — 2 pts total"
blockers: []
success_criteria:
- id: SC-1
  description: "tri-state-fact-model.md cross-references this feature; states no 4th wire state was added"
  status: pending
- id: SC-2
  description: "CLAUDE.md pointer added (≤3 lines)"
  status: pending
- id: SC-3
  description: "Roadmap :288 title dropped 'adaptive'/information-value clause; :545 JSON title matches; depends_on no longer lists 'P3-WP6'"
  status: pending
- id: SC-4
  description: "'SPIKE-010' moved from P3-WP4's research_ids to P3-WP7's (karen K-1)"
  status: pending
- id: SC-5
  description: "IntentTree node-title correction explicitly flagged as a human/orchestrator follow-up, not silently left stale"
  status: pending
- id: SC-6
  description: "CHANGELOG [Unreleased] entry exists, makes no diagnostic/safety/accuracy claim"
  status: pending
- id: SC-7
  description: "OQ-4 design spec authored at maturity: idea; path appended to deferred_items_spec_refs"
  status: pending
- id: SC-8
  description: "OQ-1/OQ-2 resolution durably recorded, not left only in a chat transcript"
  status: pending
- id: SC-9
  description: "OQ-5 resolution durably recorded — which of the three PRD §12 options was chosen, by whom, and where that's reflected (cross-family review F-2)"
  status: pending
- id: SC-10
  description: "All 5 human-verification checklist items (visual, keyboard, safety-runtime, form.reset(), safety-banner/workflow-step) have named signers + dates"
  status: pending
- id: SC-11
  description: "karen end-of-feature review recorded"
  status: pending
- id: SC-12
  description: "Gate criterion: npm run check shows exactly the 8 recorded baseline failures and no others — this is the feature's final, binding exit condition"
  status: pending
files_modified:
- docs/project_plans/design-specs/tri-state-fact-model.md
- CLAUDE.md
- docs/project_plans/expansion/01-platform-expansion-roadmap.md
- CHANGELOG.md
- docs/project_plans/design-specs/non-booleanmap-four-state-treatment.md
notes: >
  This phase closes the loop on scope-honesty: the PRD (§0, §5.3) and SPIKE-010 both recommend
  correcting the roadmap's framing of this work package ("adaptive," a FHIR dependency) rather
  than letting a shipped feature sit under a title that overstates it. It also durably records
  OQ-5 — the cross-family review's F-2 finding that "provenance preserved" is durable-but-not-
  unambiguous — and applies karen's K-1 roadmap research_ids correction. Hard constraint: no
  documentation task may state or imply improved diagnostic accuracy, safety, or clinical
  validity — only capture fidelity. No task populates approvedBy[]/clinicalApprovers[]. Once P4 is
  sealed and FEATURE-KAREN passes, a documentation writer creates
  .claude/worknotes/four-state-questionnaire-ui/feature-guide.md (≤200 lines) before the PR is
  opened. Every prompt-embedded shell command dispatched to an executor must use the absolute
  worktree path
  (/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui).
---

# four-state-questionnaire-ui — Phase 4: Docs & Honesty Corrections

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/four-state-questionnaire-ui/phase-4-progress.md -t P4-01 -s completed
```

---

## Objective

Close the feature out on scope-honesty: cross-reference the tri-state fact model, correct the
roadmap's "adaptive"/FHIR-dependency framing (OQ-3) and karen's K-1 `research_ids` misplacement,
add the CHANGELOG entry, author the OQ-4 deferred-item design spec, and durably record the
resolutions of OQ-1/OQ-2/OQ-5 plus the full PRD §11 human-verification checklist (5 items,
including the F-1 safety-banner/workflow-step item).

**Dependencies**: Phase 3 complete (`P3-GATE` passed) ·
**Entry criteria**: All 59 booleanMap fields converted and parity/seam tests green; `P3-06`'s
visual-check signer recorded ·
**Exit gate** (decisions block §6): `npm run check` shows no new failures versus the 8-failure
baseline; CHANGELOG entry, roadmap correction, OQ-4 spec, OQ-5 recording, and all 5
human-verification signers all present.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P4-01 | Cross-reference `tri-state-fact-model.md` + `CLAUDE.md` pointer | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | Phase 3 complete |
| P4-02 | Correct roadmap title + `depends_on` (OQ-3); move `SPIKE-010` `research_ids` (K-1) | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | P4-01 |
| P4-03 | CHANGELOG `[Unreleased]` entry | general-purpose | haiku/adaptive | ica | not-started | Phase 3 complete |
| P4-04 | Author OQ-4 deferred-item design spec | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | Phase 3 complete |
| P4-05 | Record OQ-1/OQ-2/OQ-5 resolution; finalize human-verification checklist | general-purpose | sonnet-5[1m]/adaptive | ica | not-started | P4-01..P4-04 |
| P4-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | not-started | P4-01..P4-05 |
| FEATURE-KAREN | `karen` end-of-feature review | karen | sonnet/adaptive | claude | not-started | P4-GATE |

---

## Orchestration Quick Reference

**WORKING ROOT (absolute; do NOT use the parent checkout):**
`/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui`

### Batch 1 (after Phase 3 complete)

```
Task("general-purpose", "WORKING ROOT (absolute — do NOT use the parent checkout):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P4-01: (a) Add a section to docs/project_plans/design-specs/tri-state-fact-model.md
cross-referencing this feature as the UI-layer consumer of the existing three-value model —
state plainly no fourth wire state was added, point to src/facts/fieldState.js. Do not restate
SPIKE-003/SPIKE-010 findings, point to them. (b) Add a <=3-line pointer to root CLAUDE.md's
Architecture orientation section naming src/facts/fieldState.js alongside the existing
src/facts.js/src/facts/registry.js mention. See plan §Phase 4, P4-01
(phase-4-docs-and-honesty.md).")

Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P4-03: Add a CHANGELOG [Unreleased] entry per .claude/specs/changelog-spec.md describing the
4-option control conversion, the round-trip fix, the omit-vs-false payload change, and the F-1
safety-banner/workflow-step rewire. Must state plainly this is capture-fidelity only — engine
output unchanged, supported by the structural 28-condition proof and P2-08's executed transform
test, NOT by the 6-golden-fixture claim alone (F-3). No diagnostic/safety/accuracy claim
anywhere. See plan §Phase 4, P4-03.")

Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P4-04: Author docs/project_plans/design-specs/non-booleanmap-four-state-treatment.md at
maturity: idea, prd_ref set to this feature's PRD path, recording OQ-4 (whether the 13
non-booleanMap booleans eventually need the same four-state treatment). State plainly this
feature does not answer the question. Append the path to the parent plan's
deferred_items_spec_refs frontmatter. See plan §Phase 4, P4-04.")
```

### Batch 2 (after P4-01)

```
Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P4-02 (OQ-3 + karen K-1): Re-verify line numbers against the live file, then edit
docs/project_plans/expansion/01-platform-expansion-roadmap.md — drop 'adaptive' and the
information-value-ordering clause from the P3-WP7 title/description (originally :288); update
the JSON node (originally :545) to match and remove 'P3-WP6' from depends_on (confirm
src/fhir/mapping.js does not exist by repository search first), retaining 'P1-WP1'. Also move
'SPIKE-010' from P3-WP4's research_ids (originally :542) to P3-WP7's research_ids (K-1). Note in
the commit/PR description that the IntentTree node title correction is a human/orchestrator
follow-up — this task edits repository files only. See plan §Phase 4, P4-02.")
```

### Batch 3 (after P4-01..P4-04)

```
Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P4-05: (a) Confirm the P3-00 OQ-1/OQ-2 resolution record is durable (addendum to
decisions-block.md or a dedicated note); author it now if it is not. (a2) Confirm OQ-5's
resolution (which of the 3 PRD §12 options was chosen) is durably recorded, e.g. in
tri-state-fact-model.md's P4-01 cross-reference or a dedicated addendum. (b) Execute and record
the remaining 4 PRD §11 human-verification checklist items with named signers + dates: keyboard-
only operation across a representative field sample; the safety-reviewed mutual-exclusion runtime
behavior (AC-5, both directions); form.reset() behavior; and (F-1) the safety-banner
safetyCount/step-safety/step-history/step-smear runtime behavior. None marked done without an
actual name. See plan §Phase 4, P4-05.")
```

### Batch 4 (after P4-01..P4-05)

```
Task("task-completion-validator", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P4-GATE: Verify Phase 4 exit gate for four-state-questionnaire-ui — npm run check shows no new
failures versus the 8-failure baseline; CHANGELOG entry makes no overclaim; roadmap correction
applied at both cited lines and the SPIKE-010 research_ids move applied; OQ-4 spec authored and
referenced in frontmatter; OQ-5 resolution durably recorded; all 5 human-verification checklist
items have named signers. Reject if any documentation task implies a diagnostic/safety/accuracy
improvement, if the roadmap edit left 'P3-WP6' in depends_on or left 'SPIKE-010' under P3-WP4, if
OQ-5's resolution is missing, or if any human-verification item lacks a name.")
```

### Batch 5 (after P4-GATE)

```
Task("karen", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

FEATURE-KAREN: End-of-feature review. Verify no artifact describes the feature as validated/
verified/reviewed/approved/released; approvedBy[]/clinicalApprovers[] remain schema-forced empty
everywhere; the honesty caveat (engine unchanged, capture fidelity only, supported by the
structural proof not the fixture claim) is stated plainly in every doc surface this phase
touched; OQ-5's resolution is recorded, not silently dropped. Specifically re-check that the
F-1/F-3/F-4 fixes actually shipped, not merely that they were planned — this is the same
reviewer whose earlier pass on this plan missed F-1.")
```

---

## Quality Gates

- [ ] `tri-state-fact-model.md` cross-references this feature; states no 4th wire state was added
- [ ] `CLAUDE.md` pointer added (≤3 lines)
- [ ] Roadmap `:288` title dropped "adaptive"/information-value clause; `:545` JSON title matches; `depends_on` no longer lists `"P3-WP6"`
- [ ] **`"SPIKE-010"` moved from P3-WP4's `research_ids` to P3-WP7's (karen K-1)**
- [ ] IntentTree node-title correction explicitly flagged as a human/orchestrator follow-up, not silently left stale
- [ ] CHANGELOG `[Unreleased]` entry exists, makes no diagnostic/safety/accuracy claim
- [ ] OQ-4 design spec authored at `maturity: idea`; path appended to `deferred_items_spec_refs`
- [ ] OQ-1/OQ-2 resolution durably recorded, not left only in a chat transcript
- [ ] **OQ-5 resolution durably recorded — which of the three PRD §12 options was chosen, by whom, and where that's reflected (cross-family review F-2)**
- [ ] All 5 human-verification checklist items (visual, keyboard, safety-runtime, `form.reset()`, **safety-banner/workflow-step**) have named signers + dates
- [ ] `karen` end-of-feature review recorded
- [ ] **Gate criterion**: `npm run check` (= `npm run build && npm test && npm run validate && npm run coverage:rules && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke`) shows **exactly** the 8 recorded baseline failures (test IDs 336, 789, 814, 2132, 2133, 2138, 2363, 2364) and **no others** — this is the feature's final, binding exit condition.

**⚠ Build-before-test trap.** Bare `npm test` in a fresh worktree falsely reports **10** failures
(two extra `dist/`-dependent artifacts). Always `npm run build && npm test`, exactly as `npm run
check` does.

---

## Implementation Notes

### Architectural Decisions

- This phase applies scope-honesty corrections rather than merely restating them — the roadmap's
  "adaptive"/FHIR-dependency framing and karen's K-1 `research_ids` misplacement are actually
  edited here, not just flagged.

### Known Gotchas

- Re-verify every cited line number (`:288`, `:542`, `:545`) against the live
  `01-platform-expansion-roadmap.md` before editing — they may have shifted since plan authoring.
- Do not silently drop `"P1-WP1"` from `depends_on` without the same confirmation standard applied
  to `"P3-WP6"`.
- No documentation task in this phase (or anywhere in this plan) may imply a diagnostic, safety,
  or clinical-validity improvement — only capture fidelity. No task populates
  `approvedBy[]`/`clinicalApprovers[]`.
- This plan edits repository files only — it does not call `itt`/IntentTree tools; the IntentTree
  node-title correction is a human/orchestrator follow-up, noted but not executed here.

### Development Setup

Node ≥ 20. Final gate for the whole feature: `task-completion-validator` sign-off on `P4-GATE`
**and** `karen` sign-off on `FEATURE-KAREN` — both required before the feature guide/PR.

---

## Completion Notes

Fill in when Phase 4 is complete: the durable pointers for the OQ-1/OQ-2/OQ-5 resolutions, the
five named human-verification signers + dates, and confirmation that `FEATURE-KAREN` found the
F-1/F-3/F-4 fixes actually shipped.
