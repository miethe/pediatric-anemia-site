---
type: progress
schema_version: 2
doc_type: progress
prd: four-state-questionnaire-ui
feature_slug: four-state-questionnaire-ui
prd_ref: docs/project_plans/PRDs/features/four-state-questionnaire-ui-v1.md
plan_ref: docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1.md
phase_detail_ref: docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1/phase-2-spa-rewire.md
execution_model: batch-parallel
phase: 2
title: "Four-State Questionnaire UI — Phase 2: SPA Read/Write Rewire"
status: not_started
created: '2026-07-23'
updated: '2026-07-23'
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: not-started
total_tasks: 12
completed_tasks: 0
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
- karen
- gpt-5.6-terra
model_usage:
  primary: sonnet
  external: [codex]
tasks:
- id: P2-01
  description: >
    Rewrite checked()'s booleanMap read path to delegate to fieldState.js (FR-3, FR-8).
    checked(name) (src/app.js:102-105) today returns
    Boolean(element && !(element instanceof RadioNodeList) && element.checked) — a plain boolean,
    losing the four-way distinction. Add a sibling read function (e.g. fieldStateValue(name)) that
    reads field(name)?.value (the <select>'s selected option value) and passes it through
    fieldState.js's wire-value mapping function from P1-01, preserving the existing RadioNodeList
    guard (R1) even though a <select> never returns one — defense in depth, matching the existing
    style at :91/:104. checked() itself is retained unmodified for the non-booleanMap boolean
    fields that stay checkboxes (menstruating, recentTransfusion, highAltitude,
    cbc.localFlags.*, the labs.* booleans, hbBartNewbornScreen etc. — out of scope, §5.2/OQ-4) — do
    not repurpose checked() itself; add the new function alongside it so the 13 non-booleanMap
    boolean call sites in buildInput() (:153-155, :176-179, :204-210) are untouched.
  status: not_started
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P1-GATE]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    New read function exists, delegates to fieldState.js, retains the RadioNodeList guard;
    checked()'s existing 13 non-booleanMap call sites in buildInput() are byte-unchanged; a static
    source-shape pin (P2-06) proves the new function calls into fieldState.js rather than inlining
    the mapping.
- id: P2-02
  description: >
    Rewrite the three booleans(...) calls in buildInput() to omit unanswered keys (FR-4).
    buildInput()'s symptoms: booleans(symptomNames), history: booleans(historyNames),
    exam: booleans(examNames) (src/app.js:186-188) currently always emit all 14/40/5 keys with a
    boolean value. Add a booleanMap-specific serializer (e.g. triFields(names)) that, for each
    name, calls the new P2-01 read function and — using fieldState.js's control-value-to-wire-value
    mapping — omits the key entirely when the field is at its default not-assessed state (control
    value ''), instead of writing false. Wire the three buildInput() call sites to the new
    serializer. Scope precision: only symptomNames/historyNames/examNames (59 fields) change;
    patient/cbc.localFlags/labs booleans (13 fields, out of scope) keep using the existing
    booleans() and always emit a key.
  status: not_started
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-01]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    The three buildInput() call sites at (originally) :186-188 use the new serializer; a field
    left at "not assessed" is absent from the payload's symptoms/history/exam object (not present
    as false); patient/cbc.localFlags/labs payload shapes are byte-unchanged;
    tests/module-equivalence.test.mjs's 6 golden fixtures still produce identical assess() output
    (AC-2).
- id: P2-03
  description: >
    Rewrite setSimpleField() — fix the round-trip defect (FR-5, AC-3). setSimpleField(name, val)
    (src/app.js:1462-1468) currently writes element.checked = toTri(val) === 'true' for any
    checkbox (:1466), collapsing 'false' and 'unknown' (and absent) to the same unchecked visual
    state. Add a booleanMap-specific write path: when element.tagName === 'SELECT' (or another
    positive discriminator distinguishing the new four-option controls from the retained
    checkboxes), set element.value to the P1-01 wire-value-to-control-value mapping's result for
    val — so 'false', 'unknown', and undefined/absent each select a distinct option. The existing
    checkbox branch (element.type === 'checkbox') stays for the 13 out-of-scope boolean fields,
    unmodified. Retain the RadioNodeList guard at :1465 even though it is now structurally
    impossible for a <select> to trigger it — defense in depth (R1).
  status: not_started
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-01, P2-02]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    A <select>-tagged field receives a distinct selected option for each of
    'false'/'unknown'/absent — proven by tests/field-state.test.mjs's pure-function coverage
    (P1-02) plus a source-shape pin proving the delegation (P2-06); the pre-existing checkbox
    branch is unmodified; RadioNodeList guard retained.
- id: P2-04
  description: >
    Rewrite populateFromInput()'s symptoms/history/exam repopulation loops (FR-6).
    populateFromInput() (src/app.js:1470-1508) currently loops
    for (const [name, val] of Object.entries(input.symptoms ?? {})) setSimpleField(name, val);
    (and the same for history/exam, :1496-1498) — this only visits keys present in the payload.
    Under the new omit-on-default payload (P2-02), an omitted key is never visited at all, meaning
    the control's state after repopulation depends on form.reset() (:1472) having already reverted
    it to its markup default rather than on an explicit write. This is fragile — it works only if
    every <select>'s first/default <option> is the not-assessed value and nothing later in
    populateFromInput() touches that field. Make it explicit, not incidental: change the three
    loops to iterate over the full symptomNames/historyNames/examNames registries
    (src/app.js:111-131) rather than Object.entries of the payload subobject, calling
    setSimpleField(name, input.symptoms?.[name]) (etc.) for every name — so an absent key
    deterministically resolves to undefined, which P2-03's rewritten setSimpleField maps to the
    not-assessed control value explicitly, not by relying on form.reset() ordering.
  status: not_started
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-03]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    The three loops iterate the full name registries, not Object.entries of the (possibly
    key-omitting) payload; an omitted field's control ends at not-assessed deterministically, not
    merely because it happens to match the post-reset default — verified via the P2-06
    source-shape pin (static, not executed; karen K-2), since populateFromInput() cannot be
    exercised by an executed DOM test in this repository (leg B §2); form.reset() at :1472 remains
    but is no longer load-bearing for this correctness property per the source-shape reasoning,
    not per an executed test.
- id: P2-05
  description: >
    Rewrite the safety-reviewed mutual-exclusion listeners (R2, FR-10). Per decisions block R2
    (High severity, "its own task with its own review"): the listener pair at
    src/app.js:1637-1650 today (a) force-writes element.checked = false across every
    immediateSafetyNames field when #safety-reviewed-no-flags is ticked (:1638-1642), and (b)
    unchecks #safety-reviewed-no-flags when element.checked is read true on any
    immediateSafetyNames field (:1648-1650). Both assume a boolean .checked. Rewrite: (a) forward
    direction — instead of force-writing false, set each immediateSafetyNames field's control to
    the explicit Absent value via the P1-01 wire-value-to-control-value mapping (not Unknown, not
    not-assessed — the clinician is actively asserting these are absent by ticking the
    safety-reviewed box); (b) reverse direction — replace element.checked with a read that detects
    "not Absent and not not-assessed" (i.e., the field reads Present or Unknown) via the P2-01 read
    function, since a plain .checked read no longer reflects the four-way state. This is its own
    reviewed unit of work — do not fold it silently into P2-01/P2-03's general rewrite. Retain the
    RadioNodeList guard at :1641.
  status: not_started
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-01, P2-03]
  estimated_effort: "0.75 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    Forward direction sets an explicit Absent value on every immediateSafetyNames field (not a
    force-written false/unchecked visual collapse); reverse direction correctly unchecks
    #safety-reviewed-no-flags when any immediateSafetyNames field reads Present or Unknown (both,
    not just Present); a static source-shape pin (P2-06) isolates and names this listener rewrite
    as its own reviewed block, distinct from P2-01/03/04's general read/write rewrite;
    RadioNodeList guard retained at the equivalent line.
- id: P2-06
  description: >
    Static source-shape pins — delegation proof, no lingering plain .checked write (leg B
    technique), extended per F-1 to the FR-16 consumers. Using the exact functionBody(source,
    name) brace-scan technique already established at
    scripts/smoke-browser-unit-rejection.mjs:45-104 (and reused independently in
    tests/module-switcher-eligibility.test.mjs), extract the text of checked()/the new P2-01 read
    function, buildInput(), setSimpleField(), populateFromInput(), the safety-exclusion listener
    bodies, and — per cross-family review F-1 — anyChecked(), updateWorkflowState(), and
    updateCaseUi() from src/app.js, and regex-assert: (a) each references the
    src/facts/fieldState.js import (including the P1-03 isPresent/isAssessed predicates and
    P2-07's anyPresent()) rather than inlining a 'true'/'false'/'unknown' string-literal mapping;
    (b) no booleanMap field name (from symptomNames/historyNames/examNames) appears adjacent to a
    plain element.checked = assignment or a plain checked(name)/anyChecked(name) call anywhere in
    src/app.js post-rewrite — i.e., no leftover code path still treats a booleanMap field as a
    two-state checkbox, in either the serialization path or the workflow/depth/safety-count
    consumers F-1 found unaddressed. This is source-shape pinning, not execution (leg B's honest
    ceiling) — it proves the right identifiers appear at the right call sites, not that the DOM
    behaves correctly.
  status: not_started
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-01, P2-02, P2-03, P2-04, P2-05, P2-07]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    New test (or an addition to an existing source-assertion test file) passes; explicitly
    labeled in its own file/section header as source-asserted, not DOM-executed, per leg B §4's
    discipline; a deliberately reverted rewrite (reintroducing an inline mapping, or reintroducing
    checked()/anyChecked() against a booleanMap name in anyChecked/updateWorkflowState/
    updateCaseUi) makes the test fail.
- id: P2-07
  description: >
    Rewire workflow/depth/count/safety consumers off checked()/anyChecked() (F-1, BLOCKER —
    cross-family review). Per .claude/findings/four-state-questionnaire-ui-cross-family-review.md
    F-1, confirmed by direct line inspection: a <select> has no .checked, so checked() returns
    false for every converted booleanMap field, and these consumers are not covered by
    P2-01..P2-05's rewrite: anyChecked(names) (src/app.js:254-256); updateWorkflowState()'s three
    call sites — :261 Boolean($('#safety-reviewed-no-flags')?.checked ||
    anyChecked(immediateSafetyNames)), :266 anyChecked(historyNames), :267
    anyChecked(examNames); and updateCaseUi()'s two call sites — :282
    immediateSafetyNames.filter((name) => checked(name)).length (safetyCount), :290
    anyChecked(historyNames) || anyChecked(examNames) (the 13% depth contribution). Unfixed, these
    silently break: safetyCount is permanently 0 (the safety banner can falsely report no immediate
    findings), step-safety/step-history/step-smear never complete from field input, and the depth
    score loses its 13% history/exam contribution. Add a booleanMap-aware anyPresent(names) to
    src/app.js that delegates per-name to the P1-03 isPresent predicate (via the P2-01 read
    function), and an isFieldAssessed(name) helper delegating to P1-03's isAssessed. Replace every
    booleanMap use of checked()/anyChecked() in the five sites above with the new predicates:
    anyChecked(names) itself becomes (or is replaced at each call site by) anyPresent(names) for
    booleanMap name lists; safetyCount uses isPresent, not checked. Leave the 13 non-booleanMap
    checkbox call sites untouched (buildInput()'s patient/cbc.localFlags/labs reads,
    :153-155/:176-179/:204-210, and updateWorkflowState()'s/updateCaseUi()'s non-booleanMap
    checked() calls on hbBartNewbornScreen etc. and checkedValues('smear') — these stay on
    checked()/checkedValues() since they are not booleanMap fields, per §5.2/OQ-4).
  status: not_started
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-01, P1-03]
  estimated_effort: "2.0 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    anyChecked(names), updateWorkflowState()'s three call sites, and updateCaseUi()'s two call
    sites no longer call checked()/anyChecked() against any booleanMap field name; each delegates
    to fieldState.js-backed isPresent/isAssessed/anyPresent(); the 13 non-booleanMap call sites are
    byte-unchanged; a static source-shape pin (P2-06, extended) proves the delegation and the
    absence of any leftover plain .checked read against a booleanMap name in these five sites.
- id: P2-08
  description: >
    Executed transform test — explicit-false vs. omitted, per booleanMap field and aggregate
    group (F-3 fix). Per
    .claude/findings/four-state-questionnaire-ui-cross-family-review.md F-3: the plan's original
    "golden identity" gate ran tests/module-equivalence.test.mjs unmodified, reading inputs from
    examples/*.json — across all six of which there is exactly one explicit false in
    symptoms/history/exam, so it never exercises an omitted-key payload and cannot detect this
    feature's actual change. Author a new executed test that: for every booleanMap field (all 59)
    and for every one of the 14 triAny/triAll/triNone-derived all-negative aggregate groups
    (modules/anemia/facts.anemia.js:149-392), builds an input fixture pair — one with the
    field(s) set to explicit 'false', one with the key(s) omitted entirely — runs deriveFacts()
    and the rule engine (assessPediatricAnemia) on both, and deep-compares (a) the derived facts
    object and (b) the final assess() result. Assert the derived-facts comparison shows the
    expected difference at the aggregate-fact level where relevant (e.g. history.bleedingHistory:
    'false' → 'unknown', mirroring SPIKE-010 leg D's synthetic case) while the final assess()
    result is identical — i.e., this test proves the neutrality claim by execution, not by relying
    on the pre-existing examples/*.json fixtures to happen to cover it.
  status: not_started
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-02, P1-01]
  estimated_effort: "1.5 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces: []
  acceptance_criteria: >
    New test exists and passes, executes deriveFacts()/the real engine (not a source-shape pin);
    covers all 59 booleanMap fields and all 14 aggregate groups with an explicit-false-vs-omitted
    pair each; a deliberately seeded regression (e.g., a hypothetical rule change that would make
    omission behave differently) makes the test fail, proving it is not vacuous the way the
    original fixture-only gate was.
- id: P2-09
  description: >
    Fix the safety-review auto-assertion (F-4). Per
    .claude/findings/four-state-questionnaire-ui-cross-family-review.md F-4: populateFromInput()
    (src/app.js:1503-1506) sets #safety-reviewed-no-flags.checked = !hasImmediateFlag, where
    hasImmediateFlag is true iff some immediateSafetyNames field reads toTri(...) === 'true'. This
    is pre-existing (today's false behaves the same), but this feature's own change invalidates
    the premise: previously false meant "clinician actively asserted absent"; under the new
    omitted-key default, an omitted key means "never assessed." The same code would therefore
    auto-assert "safety screen reviewed" over fields nobody looked at. Rewrite so the
    auto-assertion never infers "reviewed" from missing data: require every immediateSafetyNames
    field to read explicitly Absent (via the P1-03 isPresent-adjacent / P2-01 read path — i.e.,
    isAssessed(val) && !isPresent(val) for each field, not merely !isPresent(val)) before
    auto-setting #safety-reviewed-no-flags, or require an explicit reviewed action instead of an
    inferred one if the "every field explicitly Absent" bar is judged too strict for usability
    (implementer's choice, but the never-infer-from-omission invariant is binding). Characterize
    this in code comments and the phase progress note as pre-existing-but-newly-incorrect, not as
    a defect this feature introduces from nothing.
  status: not_started
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-01, P1-03]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: >
    populateFromInput()'s auto-assertion no longer sets #safety-reviewed-no-flags to reviewed on
    the strength of an omitted immediateSafetyNames field; a fixture with all immediateSafetyNames
    fields omitted (not explicitly Absent) does not auto-set the reviewed state; a fixture with all
    fields explicitly Absent does; source-shape pin (P2-06) or a direct unit test over the
    extracted predicate proves the omitted-vs-Absent distinction is honored.
- id: P2-GATE
  description: >
    task-completion-validator gate. Verify the Phase 2 exit gate (decisions block §6, re-scoped
    per the cross-family review): the new executed transform test (P2-08) passes and the 6
    examples/*.json fixtures still produce byte-identical assess() output
    (tests/module-equivalence.test.mjs green — AC-2, understood per F-3 as weak corroborating
    evidence, not the primary proof); source-shape pins added and passing, including the P2-06
    extension covering the F-1 consumers; RadioNodeList guards retained in all three locations;
    the safety-exclusion rewrite (P2-05) is a distinct, separately-reviewed diff hunk, not folded
    into the general rewrite; P2-07's workflow/depth/safety-count rewrite touches only the five
    sites F-1 named and leaves the 13 non-booleanMap call sites byte-unchanged; P2-09's fix never
    infers "reviewed" from an omitted field. Reject if any golden fixture output changed, if the
    P2-08 transform test is missing or does not execute the real engine, if a RadioNodeList guard
    was dropped, if P2-05's diff is not separable from P2-01/03/04's, or if any booleanMap field
    name still reaches checked()/anyChecked() anywhere in src/app.js.
  status: not_started
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P2-01, P2-02, P2-03, P2-04, P2-05, P2-06, P2-07, P2-08, P2-09]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces: []
  acceptance_criteria: "All exit-gate criteria pass; recorded in phase progress note."
- id: P2-KAREN
  description: >
    karen milestone review. Independent review of the phase carrying the plan's genuine risk
    concentration (now including F-1/F-4). Specifically verify: (1) the RadioNodeList guard is
    retained at all three original locations, not merely "still passes tests" by coincidence; (2)
    the safety-reviewed rewrite's reverse-direction check correctly treats both Present and
    Unknown as "not cleared" (a common mistake is checking only for Present); (3)
    populateFromInput()'s repopulation is deterministic (P2-04) rather than incidentally correct
    via form.reset() ordering; (4) no engine, rule, or module-facts file was touched (hard
    constraint — src/ruleEngine.js, src/facts/tristate.js, modules/*/rules.json,
    modules/anemia/facts.anemia.js must be byte-unchanged); (5) P2-07 actually covers all five F-1
    call sites and none of the 13 non-booleanMap call sites were touched; (6) P2-09's fix genuinely
    requires explicit Absent (or an explicit reviewed action), not merely "not Present," before
    auto-setting the reviewed flag — this is the same class of mistake as (2), applied to F-4.
  status: not_started
  assigned_to: [karen]
  provider: claude
  dependencies: [P2-GATE]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces: []
  acceptance_criteria: "Milestone review recorded; any finding either fixed in-phase or logged to a findings doc."
- id: P2-REVIEW
  description: >
    Cross-family adversarial diff review. codex/gpt-5.6-terra reviews the full P2 diff read-only
    — the highest-value review pass in this plan given R1/R2/R8/R9's severity, and the pass that
    originally found F-1 in the pre-execution plan review. Specifically probe for: a RadioNodeList
    guard silently dropped during refactor; the reverse-direction safety check missing the Unknown
    case; any remaining plain .checked/checked()/anyChecked() call against a booleanMap field name
    anywhere in src/app.js that P2-06's pin might have missed (this is exactly the class of gap
    F-1 was); whether P2-08's transform test genuinely executes the engine rather than
    degenerating into another near-vacuous fixture check; and whether P2-09's fix has any
    remaining path where an omitted field is treated as "reviewed."
  status: not_started
  assigned_to: [gpt-5.6-terra]
  provider: codex
  dependencies: [P2-01, P2-02, P2-03, P2-04, P2-05, P2-06, P2-07, P2-08, P2-09]
  estimated_effort: "—"
  priority: critical
  assigned_model: gpt-5.6-terra
  model_effort: high
  target_surfaces: []
  acceptance_criteria: "Review recorded; any finding either fixed in-phase or logged for P3 pickup."
parallelization:
  batch_1: [P2-01]
  batch_2: [P2-02]
  batch_3: [P2-03]
  batch_4: [P2-04, P2-05]
  batch_5: [P2-07, P2-08, P2-09]
  batch_6: [P2-06]
  batch_7: [P2-GATE]
  batch_8: [P2-KAREN, P2-REVIEW]
  critical_path: [P2-01, P2-02, P2-03, P2-04, P2-05, P2-07, P2-06, P2-GATE, P2-KAREN]
  estimated_total_time: "not stated in phase detail file — 9.5 pts, the plan's largest single phase"
blockers: []
success_criteria:
- id: SC-1
  description: "checked()'s 13 non-booleanMap call sites in buildInput() are byte-unchanged"
  status: pending
- id: SC-2
  description: "buildInput() omits a booleanMap key when its control is at not-assessed, for all 59 fields"
  status: pending
- id: SC-3
  description: "setSimpleField() selects a distinct control option for 'false'/'unknown'/absent (round-trip fix, AC-3)"
  status: pending
- id: SC-4
  description: "populateFromInput()'s three loops iterate the full name registries, not payload Object.entries — deterministic, not incidental"
  status: pending
- id: SC-5
  description: "Safety-exclusion forward direction writes explicit Absent (not force-unchecked); reverse direction detects Present or Unknown"
  status: pending
- id: SC-6
  description: "anyChecked(), updateWorkflowState()'s three call sites, and updateCaseUi()'s two call sites (F-1, P2-07) no longer call checked()/anyChecked() against any booleanMap field name — including safetyCount, which must reflect Present fields, not always read 0"
  status: pending
- id: SC-7
  description: "The safety-review auto-assertion (F-4, P2-09) never infers 'reviewed' from an omitted immediateSafetyNames field — only from an explicit Absent (or an explicit reviewed action)"
  status: pending
- id: SC-8
  description: "All three RadioNodeList guards (checked-family read, setSimpleField, safety listener) retained"
  status: pending
- id: SC-9
  description: "Source-shape pins (P2-06, extended per F-1) prove delegation to fieldState.js; no leftover plain .checked read/write against a booleanMap name anywhere in src/app.js"
  status: pending
- id: SC-10
  description: "A new executed transform test (F-3, P2-08) passes, covering every booleanMap field and all 14 all-negative aggregate groups with an explicit-false-vs-omitted fixture pair"
  status: pending
- id: SC-11
  description: "tests/module-equivalence.test.mjs 6/6 examples/*.json fixtures byte-identical (AC-2) — corroborating, not primary, evidence per F-3"
  status: pending
- id: SC-12
  description: "src/ruleEngine.js, src/facts/tristate.js, modules/*/rules.json, modules/anemia/facts.anemia.js byte-unchanged"
  status: pending
- id: SC-13
  description: "karen milestone review recorded"
  status: pending
- id: SC-14
  description: "Gate criterion: npm run check shows exactly the 8 recorded baseline failures and no others"
  status: pending
files_modified:
- src/app.js
notes: >
  This phase stays on primary (claude/sonnet), not delegated to ica, per decisions block §7
  ("highest-risk seam") and risk hotspots R1/R2, now joined by R8/R9 from the cross-family review
  (F-1/F-4). This phase touches the RadioNodeList guard boundary (R1), rewrites safety-adjacent
  mutual-exclusion logic (R2) that force-writes across every immediateSafetyNames field, rewires
  the workflow/depth/safety-count consumers that a checkbox-only conversion would silently break
  (R8/F-1 — the review's confirmed BLOCKER, missed by the same-family review pass), and fixes a
  safety-review auto-assertion whose premise this feature invalidates (R9/F-4). This is the plan's
  genuine risk concentration — 9.5 of 20 total points, re-estimated up from 5 of 14 — and is
  deliberately not delegated. Ordering constraint (binding): this phase requires
  src/facts/fieldState.js (Phase 1, including P1-03's isPresent/isAssessed predicates) to exist
  and be tested before any of the rewrites below begin. Hard constraint: no task in this plan
  modifies src/ruleEngine.js, src/facts/tristate.js, modules/*/rules.json, or
  modules/anemia/facts.anemia.js (PRD FR-14) — P2-GATE and P2-KAREN both check this explicitly.
  Every prompt-embedded shell command dispatched to an executor must use the absolute worktree
  path
  (/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui).
---

# four-state-questionnaire-ui — Phase 2: SPA Read/Write Rewire

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/four-state-questionnaire-ui/phase-2-progress.md -t P2-01 -s completed
```

---

## Objective

Rewire `src/app.js`'s DOM-coupled read/write functions — `checked()`'s booleanMap path,
`buildInput()`, `setSimpleField()`, `populateFromInput()`, the safety-reviewed mutual-exclusion
listeners, **plus, per cross-family review F-1, `anyChecked()`, `updateWorkflowState()`, and
`updateCaseUi()`'s booleanMap call sites** — to delegate their state-mapping decisions to
`src/facts/fieldState.js` (Phase 1). Fixes the round-trip data-loss defect (AC-3), the F-1 safety
banner/workflow-step BLOCKER, and the F-4 safety-review auto-assertion premise invalidation. This
is the plan's genuine risk concentration — **9.5 of 20 total points**.

**Dependencies**: Phase 1 complete (`P1-GATE` passed — `src/facts/fieldState.js` exists and is
tested) ·
**Entry criteria**: `src/facts/fieldState.js` exists, is zero-DOM, and is directly tested,
including the P1-03 `isPresent`/`isAssessed` predicates ·
**Exit gate** (decisions block §6, re-scoped per cross-family review): the executed transform test
(P2-08) passes; the 6 `examples/*.json` fixtures remain byte-identical (AC-2, corroborating
evidence only per F-3); source-shape pins (P2-06, extended) pass; all three `RadioNodeList` guards
retained; the safety-exclusion rewrite is a distinct, separately-reviewed diff hunk; P2-07's
rewire covers exactly the five F-1 sites; P2-09 never infers "reviewed" from an omitted field.

**Why this phase stays on primary, not ica.** A regression here is not a markup typo — it is a
functional read/write defect in code paths that gate an immediate-safety-screen checkbox and the
safety banner itself.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P2-01 | Rewrite `checked()`'s booleanMap read path (FR-3, FR-8) | general-purpose | sonnet/adaptive | claude | not-started | Phase 1 complete |
| P2-02 | Rewrite `buildInput()`'s 3 `booleans(...)` calls to omit unanswered keys (FR-4) | general-purpose | sonnet/adaptive | claude | not-started | P2-01 |
| P2-03 | Rewrite `setSimpleField()` — round-trip fix (FR-5, AC-3) | general-purpose | sonnet/adaptive | claude | not-started | P2-01, P2-02 |
| P2-04 | Rewrite `populateFromInput()`'s repopulation loops (FR-6) | general-purpose | sonnet/adaptive | claude | not-started | P2-03 |
| P2-05 | Rewrite safety-reviewed mutual-exclusion listeners (R2, FR-10) | general-purpose | sonnet/extended | claude | not-started | P2-01, P2-03 |
| P2-06 | Static source-shape pins (extended per F-1) | general-purpose | sonnet/adaptive | claude | not-started | P2-01..P2-05, P2-07 |
| P2-07 | Rewire workflow/depth/safety-count consumers (F-1, BLOCKER) | general-purpose | sonnet/extended | claude | not-started | P2-01, P1-03 |
| P2-08 | Executed transform test (F-3 fix) | general-purpose | sonnet/extended | claude | not-started | P2-02, P1-01 |
| P2-09 | Fix the safety-review auto-assertion (F-4) | general-purpose | sonnet/adaptive | claude | not-started | P2-01, P1-03 |
| P2-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | not-started | P2-01..P2-09 |
| P2-KAREN | `karen` milestone review | karen | sonnet/adaptive | claude | not-started | P2-GATE |
| P2-REVIEW | Cross-family adversarial diff review | gpt-5.6-terra | gpt-5.6-terra/high | codex | not-started | P2-01..P2-09 |

---

## Orchestration Quick Reference

**WORKING ROOT (absolute; do NOT use the parent checkout):**
`/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui`

### Batch 1 (after Phase 1 complete)

```
Task("general-purpose", "WORKING ROOT (absolute — do NOT use the parent checkout):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-01: Rewrite checked()'s booleanMap read path to delegate to fieldState.js (FR-3, FR-8). Add a
sibling read function (e.g. fieldStateValue(name)) reading field(name)?.value through
fieldState.js's wire-value mapping, preserving the existing RadioNodeList guard (defense in
depth). Retain checked() unmodified for the 13 non-booleanMap boolean fields — do not repurpose
it. See plan §Phase 2, P2-01 (phase-2-spa-rewire.md).")
```

### Batch 2 (after P2-01)

```
Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-02: Rewrite buildInput()'s three booleans(...) calls (symptoms/history/exam) to a
booleanMap-specific serializer that OMITS the key when the field is not-assessed, instead of
writing false. Only symptomNames/historyNames/examNames change; patient/cbc.localFlags/labs stay
on booleans(). Verify tests/module-equivalence.test.mjs's 6 golden fixtures still produce
identical assess() output. See plan §Phase 2, P2-02.")
```

### Batch 3 (after P2-02)

```
Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-03: Rewrite setSimpleField() to fix the round-trip defect (FR-5, AC-3). Add a booleanMap-
specific write path (discriminate on element.tagName === 'SELECT') that sets element.value via
P1-01's wire-value-to-control-value mapping, so 'false'/'unknown'/absent each select a distinct
option. Leave the existing checkbox branch unmodified. Retain the RadioNodeList guard at :1465
(defense in depth). See plan §Phase 2, P2-03.")
```

### Batch 4 (after P2-03)

```
Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-04: Rewrite populateFromInput()'s symptoms/history/exam loops to iterate the FULL
symptomNames/historyNames/examNames registries (not Object.entries of the payload), calling
setSimpleField(name, input.symptoms?.[name]) for every name — so an omitted key deterministically
resolves via P2-03's rewritten setSimpleField, not via form.reset() ordering. See plan §Phase 2,
P2-04.")

Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-05: Rewrite the safety-reviewed mutual-exclusion listener pair at src/app.js:1637-1650 (R2,
FR-10) as its OWN reviewed diff hunk — forward direction sets explicit Absent (via P1-01's
mapping) on every immediateSafetyNames field instead of force-writing false; reverse direction
detects Present OR Unknown via the P2-01 read function instead of a plain .checked read. Retain
the RadioNodeList guard at :1641. Do not fold this into P2-01/03's general rewrite. See plan
§Phase 2, P2-05.")
```

### Batch 5 (after P2-01 + P1-03 / P2-02 + P1-01, per-task deps)

```
Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-07 (F-1, BLOCKER): Add anyPresent(names) and isFieldAssessed(name) to src/app.js delegating to
the P1-03 isPresent/isAssessed predicates via the P2-01 read function. Replace EVERY booleanMap
use of checked()/anyChecked() in these five sites: anyChecked(names) (:254-256);
updateWorkflowState()'s three call sites (:261, :266, :267); updateCaseUi()'s two call sites
(:282 safetyCount, :290 depth). Leave the 13 non-booleanMap checkbox call sites (patient/
cbc.localFlags/labs reads, hbBartNewbornScreen, checkedValues('smear')) untouched. Unfixed, the
safety banner can falsely report zero immediate findings. See plan §Phase 2, P2-07.")

Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-08 (F-3 fix): Author a new EXECUTED transform test — for every booleanMap field (59) and every
one of the 14 triAny/triAll/triNone-derived aggregate groups (facts.anemia.js:149-392), build an
explicit-'false'-vs-omitted-key fixture pair, run deriveFacts()/assessPediatricAnemia() on both,
deep-compare derived facts and final assess() output. Assert the expected derived-fact difference
(e.g. history.bleedingHistory: 'false' -> 'unknown') while assess() output is identical. Must
execute the real engine — not a source-shape pin, not the existing examples/*.json-based fixture
run (which exercises no transformation in 5 of 6 fixtures). See plan §Phase 2, P2-08.")

Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-09 (F-4 fix): Fix populateFromInput()'s safety-review auto-assertion (:1503-1506) so it never
infers 'reviewed' from missing data. Require every immediateSafetyNames field to read explicitly
Absent (isAssessed(val) && !isPresent(val)) — not merely !isPresent(val) — before auto-setting
#safety-reviewed-no-flags, or require an explicit reviewed action. Characterize as
pre-existing-but-newly-incorrect in code comments. See plan §Phase 2, P2-09.")
```

### Batch 6 (after P2-01..P2-05, P2-07)

```
Task("general-purpose", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-06: Using the functionBody(source, name) brace-scan technique from
scripts/smoke-browser-unit-rejection.mjs:45-104, extract checked()/the P2-01 read function,
buildInput(), setSimpleField(), populateFromInput(), the safety-exclusion listener bodies, AND
(per F-1) anyChecked(), updateWorkflowState(), updateCaseUi() from src/app.js. Regex-assert each
references src/facts/fieldState.js (including isPresent/isAssessed/anyPresent()) rather than
inlining a string-literal mapping, and that no booleanMap field name appears adjacent to a plain
element.checked = or checked(name)/anyChecked(name) call anywhere post-rewrite. Label explicitly
as source-asserted, not DOM-executed. See plan §Phase 2, P2-06.")
```

### Batch 7 (after P2-01..P2-09)

```
Task("task-completion-validator", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-GATE: Verify Phase 2 exit gate for four-state-questionnaire-ui. Reject if any golden fixture
output changed, if the P2-08 transform test is missing or does not execute the real engine, if a
RadioNodeList guard was dropped, if P2-05's diff is not separable from P2-01/03/04's, or if any
booleanMap field name still reaches checked()/anyChecked() anywhere in src/app.js.")
```

### Batch 8 (after P2-GATE / after P2-01..P2-09)

```
Task("karen", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-KAREN: Milestone review of Phase 2's risk concentration (F-1/F-4 included). Verify: (1)
RadioNodeList guard retained at all 3 original locations; (2) safety-reviewed reverse-direction
check treats BOTH Present and Unknown as not-cleared; (3) populateFromInput() repopulation is
deterministic, not incidentally correct via form.reset(); (4) src/ruleEngine.js,
src/facts/tristate.js, modules/*/rules.json, modules/anemia/facts.anemia.js byte-unchanged; (5)
P2-07 covers all 5 F-1 sites, none of the 13 non-booleanMap sites touched; (6) P2-09 requires
explicit Absent, not merely not-Present, before auto-setting reviewed.")

Task("gpt-5.6-terra", "WORKING ROOT (absolute):
/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui

P2-REVIEW: Cross-family adversarial diff review (high effort) of the full P2 diff, read-only —
the highest-value review pass in this plan. Probe for a dropped RadioNodeList guard, a
reverse-direction safety check missing the Unknown case, any remaining plain .checked/checked()/
anyChecked() call against a booleanMap name P2-06's pin might have missed, whether P2-08 genuinely
executes the engine, and whether P2-09 has any remaining omitted-treated-as-reviewed path.")
```

---

## Quality Gates

- [ ] `checked()`'s 13 non-booleanMap call sites in `buildInput()` are byte-unchanged
- [ ] `buildInput()` omits a booleanMap key when its control is at not-assessed, for all 59 fields
- [ ] `setSimpleField()` selects a distinct control option for `'false'`/`'unknown'`/absent (round-trip fix, AC-3)
- [ ] `populateFromInput()`'s three loops iterate the full name registries, not payload `Object.entries` — deterministic, not incidental
- [ ] Safety-exclusion forward direction writes explicit Absent (not force-unchecked); reverse direction detects Present **or** Unknown
- [ ] **`anyChecked()`, `updateWorkflowState()`'s three call sites, and `updateCaseUi()`'s two call sites (F-1, P2-07) no longer call `checked()`/`anyChecked()` against any booleanMap field name — including `safetyCount`, which must reflect Present fields, not always read 0**
- [ ] **The safety-review auto-assertion (F-4, P2-09) never infers "reviewed" from an omitted `immediateSafetyNames` field — only from an explicit Absent (or an explicit reviewed action)**
- [ ] All three `RadioNodeList` guards (`checked`-family read, `setSimpleField`, safety listener) retained
- [ ] Source-shape pins (P2-06, extended per F-1) prove delegation to `fieldState.js`; no leftover plain `.checked` read/write against a booleanMap name anywhere in `src/app.js`
- [ ] **A new executed transform test (F-3, P2-08) passes, covering every booleanMap field and all 14 all-negative aggregate groups with an explicit-`false`-vs-omitted fixture pair**
- [ ] `tests/module-equivalence.test.mjs` 6/6 `examples/*.json` fixtures byte-identical (AC-2) — understood as corroborating, not primary, evidence per F-3
- [ ] `src/ruleEngine.js`, `src/facts/tristate.js`, `modules/*/rules.json`, `modules/anemia/facts.anemia.js` byte-unchanged
- [ ] `karen` milestone review recorded
- [ ] **Gate criterion**: `npm run check` (= `npm run build && npm test && npm run validate && npm run coverage:rules && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke`) shows **exactly** the 8 recorded baseline failures (test IDs 336, 789, 814, 2132, 2133, 2138, 2363, 2364) and **no others**.

**⚠ Build-before-test trap.** Bare `npm test` in a fresh worktree falsely reports **10** failures
(two extra `dist/`-dependent artifacts). Always `npm run build && npm test`, exactly as `npm run
check` does.

---

## Implementation Notes

### Architectural Decisions

- `<select>` was chosen over radio groups specifically because it is always a single element,
  never a `RadioNodeList` (decisions block §4) — R1's three guard sites are retained as defense in
  depth even though a `<select>` structurally cannot trigger them.
- The safety-exclusion rewrite (P2-05) and the F-1 workflow/depth/safety-count rewrite (P2-07) are
  each **separately reviewed units of work**, not folded into the general read/write rewrite —
  this separability is itself part of the exit gate.

### Known Gotchas

- **F-1 was missed by the same-family (`karen`) reviewer and caught only by the cross-family
  (`gpt-5.6-terra`) pass** — this is the second recorded instance of that pattern in this
  repository (project memory: `codex-second-opinion-catches-real-gaps`). Do not treat `karen`
  sign-off alone as sufficient; `P2-REVIEW` is load-bearing, not a formality.
- P2-08's transform test is the primary proof the engine is unchanged — the 6 golden fixtures
  (`tests/module-equivalence.test.mjs`) are weak corroborating evidence only (F-3): only 1 of 6
  contains an explicit `false` inside `symptoms`/`history`/`exam`.
- No task in this phase touches `src/ruleEngine.js`, `src/facts/tristate.js`,
  `modules/*/rules.json`, or `modules/anemia/facts.anemia.js` (PRD FR-14 hard constraint).

### Development Setup

Node ≥ 20. Gate before Phase 3 opens: `task-completion-validator` sign-off on `P2-GATE` **and**
`karen` sign-off on `P2-KAREN` — both required.

---

## Completion Notes

Fill in when Phase 2 is complete: confirmation that all three `RadioNodeList` guards survived,
the P2-08 transform test's actual coverage results, and any finding from `P2-KAREN`/`P2-REVIEW`
fixed in-phase or logged for Phase 3 pickup.
