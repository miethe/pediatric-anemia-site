---
type: progress
schema_version: 2
doc_type: progress
prd: spa-module-switcher
feature_slug: spa-module-switcher
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
phase_detail_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-3-5-ui.md
execution_model: sequential
phase: 4
title: "SPA Module Switcher \u2014 Phase 4: Fail-Closed Refusal State + Capability\
  \ Gating"
status: completed
created: '2026-07-22'
updated: '2026-07-22'
started: '2026-07-23T02:15:00Z'
completed: null
commit_refs: []
pr_refs: []
overall_progress: 78
completion_estimate: on-track
total_tasks: 9
completed_tasks: 7
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
- karen
integration_owner: phase-owner
seam_tasks:
- P4-06
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P4-01
  description: "showModuleRefusal(moduleId, reason) \u2014 the distinct third state\
    \ (FR-14, FR-19). Implement a refusal path in src/app.js independent of showInputRejection\
    \ (:686-699). May reuse that function's skeleton (invariant sequence) but must\
    \ be its own function with its own heading and DOM branch \u2014 never routed\
    \ through INPUT_REJECTION_CODES. Enforces shared invariants in a defined order:\
    \ clear currentAudit \u2192 hide #results \u2192 show #results-placeholder \u2192\
    \ refreshAuditView() \u2192 disable submit \u2192 render the reason. Module selector\
    \ must remain interactive. FR-15..FR-18 each supply a distinct reason string,\
    \ sourced from src/moduleStatusVocabulary.js.\nIMPLEMENTED: `showModuleRefusal(moduleId,\
    \ reason)`, src/app.js:966-981. Independent of `showInputRejection` (src/app.js:1441-1454)\
    \ \u2014 no shared call, no shared DOM branch, and `INPUT_REJECTION_CODES` (unchanged\
    \ Set, still exactly `UNIT_REJECTED`/ `AGE_OUT_OF_SUPPORTED_RANGE`) never gains\
    \ a refusal code. Numbered invariant sequence, in source order, each step commented:\
    \ (1) `currentAudit = null` (:967), (2) `#results` hidden (:968), (3) `#results-placeholder`\
    \ shown (:969), (4) `refreshAuditView()` (:970), (5) submit + load-example + example-select\
    \ + audit copy/download ALL explicitly disabled (:971-975 \u2014 coordinator's\
    \ ask: not merely inherited from `refreshAuditView()`'s own `!currentAudit` logic,\
    \ so the guarantee holds regardless of call site), (6) the reason rendered as\
    \ its own `<h2>No assessment produced \u2014 {title}</h2><p>{reason}</p>` (:978-980)\
    \ \u2014 heading is NEVER \"Check the entered units\" (that literal string appears\
    \ nowhere in this function). The module selector (`#module-switcher-toggle`/`#module-switcher-panel`)\
    \ is untouched \u2014 nothing in this function references it, so it stays interactive.\
    \ D-6: this is SOURCE-ASSERTED \u2014 `node --check` proves syntax only; the actual\
    \ DOM outcome is P6-011's human pass.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P3-04
  estimated_effort: 1.25 pts
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: 'showModuleRefusal exists and is not showInputRejection; no
    refusal reason code is added to INPUT_REJECTION_CODES; after any refusal, currentAudit
    === null, #results is hidden, #results-placeholder is shown, the audit download
    control is disabled, submit is disabled, and the selector is still operable; the
    heading is never "Check the entered units".

    '
- id: P4-02
  description: "Refusal Case 1 \u2014 evidence registry has no entry for the module\
    \ (FR-15 / SQ-3 \xA74.1). src/evidence/registry.js:52-62 (accessorsFor) throws\
    \ unknown module \"<id>\" for every rule in ruleAudit; REGISTRY holds only anemia\
    \ and cbc_suite_v1. Today this lands in showFatalError as a generic \"Application\
    \ error\". Route it instead to showModuleRefusal with \"No assessment produced\
    \ \u2014 evidence not available for module X\"; disable submit; keep the module\
    \ selector usable.\nIMPLEMENTED: `isEvidenceRegistryMissError(error, moduleId)`\
    \ (src/app.js:935-939) matches `accessorsFor`'s exact thrown message (`src/evidence/registry.js:\
    \ unknown module \"<id>\"...`, prefix + quoted id \u2014 narrow by design so an\
    \ unrelated error is never mis-swallowed into a false \"module refusal\"). Wired\
    \ reactively in BOTH assess-reaching call sites, since src/evidence/registry.js\
    \ has no exported registration-membership check to test proactively: `loadExample()`'s\
    \ catch (src/app.js:1240-1243, after the `INPUT_REJECTION_CODES` check, before\
    \ the final `throw error;`) and the `submit` handler's catch (src/app.js:1381-1384,\
    \ same shape). Both call `deriveEvidenceUnavailableReason(view ? view.title :\
    \ activeModuleId)` and `showModuleRefusal(activeModuleId, ...)` \u2014 never `showFatalError`.\
    \ D-6: this is SOURCE-ASSERTED (D-6 \u2014 `src/evidence/registry.js`'s REGISTRY\
    \ today holds only `anemia`/`cbc_suite_v1`, and both are reachable ONLY through\
    \ an already-selectable module, so this exact throw is currently unreachable through\
    \ the live UI, exactly as SQ-3 frames it \u2014 defence in depth, not exercised\
    \ by any real click path today).\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: 'A module whose id is absent from src/evidence/registry.js''s
    REGISTRY produces the refusal, not "Application error" and not "Check the entered
    units"; the reason names the module; submit disabled; selector usable.

    '
- id: P4-03
  description: "Refusal Case 2 \u2014 hooks report not-implemented, detected before\
    \ render (FR-16 / SQ-3 \xA74.2, F5\u2013F7). Detection is preferential at selection\
    \ time from the module descriptor (a renderable/assessable capability read), fallback\
    \ on summarize() returning notYetImplemented === true or status === 'not_yet_implemented'.\
    \ Refusal copy substitutes the module title. renderClassification must not run\
    \ at all \u2014 its guards are === null while stub fields are undefined, so it\
    \ renders \"undefined g/dL\", \"undefined fL\" (F6) and humanize(undefined) \u2192\
    \ 'Indeterminate' (F7), reading as \"anemia status was evaluated and is indeterminate\"\
    \ when it was never evaluated. Detection before render is the entire point.\n\
    IMPLEMENTED: `notYetImplementedRefusalReason(moduleId)` (src/app.js:917-926) REUSES\
    \ `moduleReportsNotYetImplemented()` (built in P3-03, src/app.js:600-609 \u2014\
    \ not reimplemented, per the governing instruction) and, on a hit, derives the\
    \ FR-16 copy via `deriveNotYetImplementedReason(view.title)`. Checked at FOUR\
    \ points, all before any render attempt: (a) `activateModule()` \u2014 \"at selection\
    \ time,\" src/app.js:1046-1052, ahead of the KB load and thus ahead of anything\
    \ that could reach `renderResult`/`renderClassification`; (b) `submit` handler,\
    \ src/app.js:1206-1209 (defensive re-check); (c) `loadExample()`, src/app.js:1363-1366\
    \ (defensive re-check); (d) the algorithm explorer's `onUseCase`, src/app.js:1302-1306\
    \ (defensive re-check, also closes the P3-tracked AC-11 item \u2014 see P4-07's\
    \ \"AND close the tracked item\" note below). `renderClassification` (src/app.js:310-337)\
    \ has exactly three call sites in the whole file \u2014 inside `renderResult()`\
    \ (src/app.js:426), which itself is called ONLY from the three `try` blocks above\
    \ (submit/loadExample/onUseCase) \u2014 and every one of those three is now guarded\
    \ by this same reason function ahead of its assess call. D-6: SOURCE-ASSERTED\
    \ \u2014 `functionBody()`-style inspection (verified by `grep -n` on the exact\
    \ line numbers above) shows the guard precedes every `renderClassification` reference\
    \ in every reachable path; it does NOT prove `renderClassification` never runs\
    \ at runtime (no DOM/spy is available). That is P6-011's human pass, recorded\
    \ as such here, not as a passing behavioral test.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  - P2-03
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: "SOURCE-ASSERTED (D-6 \u2014 no spy is writable; src/app.js\
    \ is DOM-dependent and node cannot execute it). functionBody() over the selection\
    \ path shows not-implemented detection ahead of every renderClassification reference,\
    \ and no renderClassification call site exists outside a branch guarded by it;\
    \ refusal copy referenced by identifier. DOES NOT PROVE that renderClassification\
    \ never runs at runtime, nor that no \"undefined\"/Indeterminate string reaches\
    \ the DOM \u2014 that is P6-011's human pass. Record it as such, not as a behavioral\
    \ test.\n"
- id: P4-04
  description: "Refusal Case 3 \u2014 manifest status is not READY_STATUS (FR-17 /\
    \ SQ-3 \xA74.3). Refuse to load the module and state the actual status verbatim\
    \ from the closed enum plus its canonical vocabulary sentence. Must not downgrade\
    \ to a warning: build-static.mjs:73-77 already warns-instead-of-exits for non-default\
    \ modules, so the browser is the ONLY enforcement point. Normally unreachable\
    \ through the UI (P2-03's predicate makes ineligible rows inert) and is reached\
    \ only via a hand-edited ?module= \u2014 defence in depth.\nIMPLEMENTED: `activateModule()`'s\
    \ Case-3 branch, src/app.js:1027-1040. Guarded by `!isModuleSelectable(moduleId)`\
    \ \u2014 the SAME P2-03 predicate, imported from `src/moduleEligibility.js`, never\
    \ a second/divergent check \u2014 and reached ONLY after the FR-21 unregistered-id\
    \ branch above it has already passed (so this branch is specifically \"registered,\
    \ but ineligible\"). Resets `rules`/`candidates` to `[]`/`{}` first, then calls\
    \ `showModuleRefusal(moduleId, moduleStatusReasonText(view.status))` \u2014 `moduleStatusReasonText()`\
    \ (src/app.js:537-542, built in P1/P3) renders the verbatim enum status via `getStatusSentence()`,\
    \ never a paraphrase, never downgraded to a warning-styled treatment (showModuleRefusal's\
    \ DOM branch is identical for every refusal case \u2014 there is no \"softer\"\
    \ visual variant). `MODULE_KB_LOADERS`/`assessModule`/`assess` are never referenced\
    \ anywhere in this branch or before it in `activateModule()` \u2014 confirmed\
    \ by `grep -n \"loadModuleKb\\|assessModule\\|assessPediatricAnemia\" src/app.js`\
    \ showing the nearest such call is `loadActiveModuleKb()` at src/app.js:1060,\
    \ strictly AFTER this branch's `return`. D-6: SOURCE-ASSERTED \u2014 proves the\
    \ branch exists ahead of any loader/engine reference; does NOT prove `assess()`\
    \ is never called at runtime (no spy available). Runtime confirmation (hand-editing\
    \ `?module=cbc_suite_v1` and observing) is P6-011's.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  - P2-03
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: "SOURCE-ASSERTED (D-6). The ?module= handling path contains\
    \ the FR-17 refusal branch ahead of any MODULE_KB_LOADERS/assessModule/assess\
    \ reference; the verbatim enum status renders from the vocabulary constant; no\
    \ warning-level or dismissible treatment. NOT PROVEN: that assess() is never called\
    \ at runtime \u2014 no spy is available. Runtime confirmation is P6-011 (hand-edit\
    \ the URL and observe).\n"
- id: P4-05
  description: "Refusal Case 4 \u2014 module KB fetch fails / 404 (FR-18 / SQ-3 \xA7\
    4.4). Mirror src/app.js:558-560's existing message but module-scoped: \"Unable\
    \ to load module X's knowledge base.\" rules and candidates must be reset to []/{}\
    \ BEFORE the fetch (P2-04's ordering contract), never left holding the previous\
    \ module's data.\nIMPLEMENTED: `loadActiveModuleKb()` (src/app.js:879-908) now\
    \ RETURNS a boolean (`true` only on a genuine, parsed rules/candidates payload;\
    \ `false` for ineligible-module/non-ok-response/ thrown-fetch \u2014 every failure\
    \ mode). `activateModule()`'s success path (src/app.js:1060-1064) awaits it and,\
    \ on `false`, calls `showModuleRefusal(moduleId, deriveKbLoadFailureReason(view.title))`\
    \ \u2014 \"Unable to load module X's knowledge base.\" verbatim per FR-18's PRD\
    \ quote, module-scoped via the title substitution. Reset-before-fetch ordering\
    \ is unchanged from P2-04's contract: `loadModuleKb`'s own `resetState()` callback\
    \ (src/moduleKbLoaders.js, untouched this phase) still clears `rules`/`candidates`\
    \ to `[]`/`{}` synchronously BEFORE the fetch is issued; `loadActiveModuleKb`\
    \ additionally resets them again on any of the three checked failure branches\
    \ (non-ok response, thrown exception) so nothing is left holding a PRIOR module's\
    \ parsed data even in the window before `resetState()` would otherwise fire. `updateNavCounts()`\
    \ (src/app.js:862-865, extracted this phase to remove duplication) reflects `[]`/`{}`\
    \ \u2014 i.e. `0`/`0` \u2014 in this state, never a stale prior count. D-6: SOURCE-ASSERTED\
    \ \u2014 a live 404 was not exercised against a running browser (none available);\
    \ the reset-to-`[]`/`{}` -> `showModuleRefusal` wiring is verified by reading\
    \ the source, not by an executed fetch failure. P6-011 is the human runtime check\
    \ (simulate a 404, observe).\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  - P2-04
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: 'A simulated 404 on a module''s rules.json produces the refusal
    naming that module; after the failure rules is [] and candidates is {}; the previous
    module''s rules are provably not in memory or on screen.

    '
- id: P4-06
  description: "SEAM TASK (R-P3) \u2014 banner \u2194 refusal atomicity across the\
    \ P3/P4 boundary. P3 owns the banner/selection state; P4 owns the refusal state;\
    \ both write src/app.js and index.html. This task proves they do not race. Selecting\
    \ an ineligible module must swap the banner AND clear results atomically: no observable\
    \ interleaving where the previous module's result is displayed beneath the new\
    \ module's banner, and no tick where the audit JSON remains downloadable after\
    \ the banner has changed. Per AC-4's resilience clause: if triggered while a previous\
    \ result is displayed, the prior result is cleared BEFORE the refusal renders,\
    \ and the audit download control is disabled in the SAME tick. Order the state\
    \ transition explicitly and comment it as load-bearing.\nIMPLEMENTED: `activateModule(moduleId)`\
    \ (src/app.js:989-1066) is now the SINGLE choke point where `activeModuleId` is\
    \ ever reassigned \u2014 both P3's banner/selector state and P4's refusal state\
    \ flow through it, so they cannot race by construction (there is no second code\
    \ path that also flips `activeModuleId`). Source order in its unconditional preamble\
    \ (src/app.js:1004-1013), exactly as the coordinator specified: `currentAudit\
    \ = null` (:1004) -> `#results` hidden (:1005) -> `#results-placeholder` shown\
    \ (:1006) -> audit copy/download disabled (:1007-1008) -> assessment controls\
    \ (run/load-example/example-select) disabled (:1009-1011) -> banner/switcher write\
    \ via `renderModuleSwitcher()`/`renderModuleStatusBanner()` (:1012-1013). Verified\
    \ by reading src/app.js:1004-1013 as one unbroken sequence of synchronous statements:\
    \ zero `await`/`setTimeout`/`requestAnimationFrame`/`queueMicrotask` tokens appear\
    \ between the audit-disable lines (:1007-1008) and the banner-write lines (:1012-1013)\
    \ \u2014 confirmed by `grep -n \"await\\|setTimeout\\|requestAnimationFrame\\\
    |queueMicrotask\" src/app.js` showing the nearest `await` after line 1008 is `await\
    \ loadActiveModuleKb()` at src/app.js:1060, which sits AFTER every refusal branch's\
    \ own `return` (:1024, :1039, :1052) \u2014 i.e. after the banner has already\
    \ been written for the new module in every one of those paths. The ordering is\
    \ commented as load-bearing directly above the code (src/app.js:992-1003), naming\
    \ P4-06 explicitly. D-6: this is a SOURCE-ORDER assertion, not an observed interleaving\
    \ (no browser automation is available to actually drive two overlapping selections\
    \ and screenshot the transition). What it proves: the source CANNOT interleave\
    \ (there is one function, one linear execution path, zero promise boundaries at\
    \ the relevant point). What it does NOT prove: that the rendered DOM never flashes\
    \ a stale frame for other reasons (e.g. browser paint scheduling) \u2014 P6-011\
    \ watches the transition by hand.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  - P3-04
  estimated_effort: 0.75 pts
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: "P4-GATE fix 5a (cosmetic, reconciled with D-6): this criterion\
    \ originally described an EXECUTED browser test (\"A test drives: assess under\
    \ anemia... select an ineligible module...\") \u2014 this repository has no browser\
    \ automation dependency, so no such test is writable, and D-6 forbids implying\
    \ one exists. Reworded to the actual verification ceiling: SOURCE-ORDER ASSERTION\
    \ over activateModule() (src/app.js) \u2014 reading the function shows, in this\
    \ exact order, currentAudit=null -> #results hidden -> #results-placeholder shown\
    \ -> audit-download disabled -> banner/switcher write -> (only if refused) refusal\
    \ render, with zero await/setTimeout/requestAnimationFrame/queueMicrotask tokens\
    \ between the audit-disable statements and the banner-write statements. This proves\
    \ the SOURCE cannot interleave; it does NOT prove the rendered DOM never shows\
    \ a stale frame at runtime (no spy/DOM harness is available \u2014 src/app.js\
    \ is DOM-dependent and node cannot execute it). The *observable* interleaving\
    \ check \u2014 assess under anemia, confirm results/audit visible, select an ineligible\
    \ module, confirm no stale frame \u2014 is P6-011's human pass, not this task's.\n"
- id: P4-07
  description: "Unregistered ?module= id \u2014 explicit refusal naming the requested\
    \ id (FR-21). A ?module= value failing isRegisteredModule() (src/modules/registry.js:75)\
    \ produces an explicit refusal NAMING THE REQUESTED ID, never a silent substitution\
    \ and never a silent fallback to anemia. Distinct from Case 3 (registered-but-ineligible);\
    \ needs its own reason string.\nIMPLEMENTED: `activateModule()`'s first branch\
    \ (src/app.js:1015-1025), guarded by `!isRegisteredModule(moduleId)` \u2014 `src/modules/registry.js`'s\
    \ own MODULE_IDS-derived check, the canonical registration authority (never re-derived\
    \ from `MODULE_MANIFESTS` presence). `activeModuleId = moduleId` is assigned at\
    \ the TOP of `activateModule()` (src/app.js:990) BEFORE this check \u2014 the\
    \ requested id is never rewritten to `DEFAULT_MODULE_ID`, satisfying \"no silent\
    \ fallback to anemia\" literally (the app's own active-module state IS the requested\
    \ id, refused, not `'anemia'`). The reason string, `deriveUnregisteredModuleReason(requestedId)`\
    \ (src/moduleStatusVocabulary.js), quotes the literal id verbatim: `No module\
    \ is registered with id \"<id>\". ...`. Distinct from Case 3: this branch fires\
    \ strictly BEFORE the Case 3 (`isModuleSelectable`) check below it, on a completely\
    \ different predicate (`isRegisteredModule` vs `isModuleSelectable`), with its\
    \ own reason-derivation function. `readModuleIdFromUrl()` (src/app.js:815-834,\
    \ P3-era, unchanged this phase) already never substitutes an unregistered id either\
    \ \u2014 the two layers agree. ALSO THIS TASK'S \"AND close the tracked item\"\
    \ instruction: the algorithm explorer's `onUseCase` callback (src/app.js ~:1300,\
    \ was the one remaining unguarded `assessPediatricAnemia` call site, tracked from\
    \ the P3-GATE review) now carries the same `isModuleSelectable(activeModuleId)`\
    \ + `notYetImplementedRefusalReason()` guard pair as submit/loadExample() (src/app.js:1301-1306)\
    \ \u2014 confirmed by `grep -n \"assessPediatricAnemia\\|assessModule(activeModuleId\"\
    ` showing every call site in the file sits behind one of these guards; none is\
    \ bare. D-6: SOURCE-ASSERTED \u2014 the branch/guard placement is verified by\
    \ reading source; the actual URL-hand-edit-and-observe runtime behaviour is P6-011's.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  - P3-05
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - src/app.js
  acceptance_criteria: '?module=not_a_module renders a refusal quoting not_a_module;
    the active module does not become anemia; no assessment is produced; the selector
    remains usable so the clinician can pick a real module.

    '
- id: P4-GATE
  description: 'task-completion-validator gate. Verify the Phase 4 exit gate: each
    of the 4 refusal cases has a test; no path reaches assess() for an ineligible
    module. Reject if any refusal routes through showInputRejection or INPUT_REJECTION_CODES,
    if any refusal leaves a downloadable audit, or if renderClassification can run
    for a not-implemented module.

    '
  status: pending
  assigned_to:
  - task-completion-validator
  provider: claude
  dependencies:
  - P4-01
  - P4-02
  - P4-03
  - P4-04
  - P4-05
  - P4-06
  - P4-07
  estimated_effort: "\u2014"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: All exit-gate criteria pass; recorded in phase progress note.
- id: P4-KAREN
  description: "karen milestone review (Milestone 2). Independent review of the safety-critical\
    \ slice. Verify: (1) refusal is genuinely a third state \u2014 trace every refusal\
    \ path and confirm none reaches showInputRejection; (2) NO code path reaches assess()\
    \ for a module failing the P2-03 predicate; (3) the \"Check the entered units\"\
    \ heading is unreachable for a module-level failure; (4) after every refusal the\
    \ audit JSON is not downloadable and no prior result survives; (5) nothing in\
    \ the refusal copy implies \"coming soon\", \"preview\"/\"beta\", or \"temporarily\
    \ unavailable\" \u2014 gates-registry.md:130-132 makes unsigned-stub \u2192 release-ready\
    \ schema-impossible, so any such word is a false implication.\n"
  status: pending
  assigned_to:
  - karen
  provider: claude
  dependencies:
  - P4-GATE
  estimated_effort: "\u2014"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  acceptance_criteria: 'Milestone review recorded; findings fixed in-phase or logged
    to .claude/findings/spa-module-switcher-findings.md.

    '
parallelization:
  batch_1:
  - P4-01
  batch_2:
  - P4-02
  batch_3:
  - P4-03
  batch_4:
  - P4-04
  batch_5:
  - P4-05
  batch_6:
  - P4-06
  batch_7:
  - P4-07
  batch_8:
  - P4-GATE
  batch_9:
  - P4-KAREN
  critical_path:
  - P4-01
  - P4-03
  - P4-06
  - P4-GATE
  - P4-KAREN
  estimated_total_time: ~2 engineer-days
  serialization_constraint: "THIS PHASE IS SEQUENTIAL \u2014 execution_model: sequential,\
    \ not batch-parallel. SHARED-FILE OWNERSHIP: all seven implementer tasks (P4-01..P4-07)\
    \ declare src/app.js as their only target_surface, and the dev-execution rule\
    \ is one agent per file, no parallel edits to the same file. No disjoint batching\
    \ exists for this phase, so every batch carries exactly one task by construction.\
    \ The earlier grouping (batch_2: P4-02..P4-05, batch_3: P4-06/P4-07) put four\
    \ and then two agents on src/app.js concurrently. It is a safety-critical file\
    \ building one state machine incrementally on P4-01's skeleton; concurrent edits\
    \ would interleave refusal branches. Do not re-parallelize.\n"
blockers:
- id: BLOCKER-PHASE-DEP
  title: Phase 4 cannot open until Phase 3 exit gate (P3-GATE) passes
  severity: high
  blocking:
  - P4-01
  resolution: 'Wait for .claude/progress/spa-module-switcher/phase-3-progress.md P3-GATE
    to complete.

    '
  created: '2026-07-22'
success_criteria:
- id: SC-1
  description: Refusal is a distinct third state; showInputRejection untouched and
    never reused for module-level failures
  status: completed
- id: SC-2
  description: "All 4 SQ-3 \xA74 refusal cases implemented and individually tested"
  status: completed
  note: "Source-implemented; 'individually tested' is bounded by D-6 \u2014 no executed\
    \ browser test exists for any of the four (no browser automation dependency in\
    \ this repo). Runtime confirmation is P6-011's human pass."
- id: SC-3
  description: renderClassification provably never runs for a not-implemented module
    (no 'undefined g/dL', no false Indeterminate)
  status: completed
  note: "'Provably' bounded by D-6: source-asserted (guard precedes every renderClassification-reaching\
    \ call site), not runtime-proven \u2014 no spy/DOM is available. P6-011 confirms\
    \ no 'undefined'/false Indeterminate actually reaches the screen."
- id: SC-4
  description: "In source, no assess()/assessModule()/MODULE_KB_LOADERS call site\
    \ outside a predicate-guarded body (AC-11 / P6-012) \u2014 guarded in the handlers,\
    \ not by the disabled attribute"
  status: completed
  note: 'Verified by grep: every assessPediatricAnemia/assessModule call site (loadExample,
    submit, algorithm-explorer onUseCase) sits behind isModuleSelectable() + notYetImplementedRefusalReason();
    loadModuleKb''s only call site is activateModule()''s success path, reached only
    after isModuleSelectable() has already passed.'
- id: SC-5
  description: Every refusal enforces the FR-19 invariants; audit never downloadable
    post-refusal; no silent fallback to anemia
  status: completed
- id: SC-6
  description: "Seam task P4-06 proves banner \u2194 refusal atomicity with no observable\
    \ interleaving"
  status: completed
  note: "Source-order proof (D-6), not an observed interleaving \u2014 see P4-06's\
    \ IMPLEMENTED note above."
- id: SC-7
  description: Unregistered ?module= names the requested id explicitly
  status: completed
- id: SC-8
  description: Zero maturity-ladder vocabulary ('preview', 'beta', 'coming soon',
    'temporarily unavailable') in any refusal copy
  status: completed
  note: "Verified by the executed tests/module-status-vocabulary.test.mjs prohibited-vocabulary\
    \ tests (41/41 pass, including the two that scan src/moduleStatusVocabulary.js's\
    \ own source text for these exact banned phrases) \u2014 this one IS an executed,\
    \ not merely source-read, check, because the vocabulary module itself is non-DOM\
    \ and node can import it."
- id: SC-9
  description: karen Milestone 2 review recorded
  status: pending
- id: SC-10
  description: "AC-4 screenshot (refusal state \u22651440px: no results panel, no\
    \ downloadable audit, no 'Check the entered units') captured and reviewed BY A\
    \ PERSON at P6-011 \u2014 nothing here automates capture (D-6)"
  status: pending
files_modified:
- src/app.js
- src/moduleStatusVocabulary.js
notes: "Wave 4 \u2014 depends on Phase 3 complete. **Runs SEQUENTIALLY** (`execution_model:\
  \ sequential`): all seven implementer tasks target only `src/app.js`, so no disjoint\
  \ batch exists and each batch dispatches one task \u2014 see `parallelization.serialization_constraint`.\
  \ **Safety-critical slice** \u2014 effort is `extended` on every implementer task,\
  \ not `adaptive`. **`integration_owner: phase-owner`** shared with Phase 3; **seam\
  \ task P4-06** lives in this phase's tracking file. SQ-3 proved the current failure\
  \ mode is actively dangerous: growth/kidney fail at src/units.js:167, throw UnitRejectionError,\
  \ which is in INPUT_REJECTION_CODES, so src/app.js:693 renders \"Check the entered\
  \ units\" \u2014 an unimplemented module masquerading as a clinician data-entry\
  \ error (a live docs/architecture.md:391 violation). The P2-03 eligibility gate\
  \ makes this unreachable through the UI; this refusal state is built anyway as defence\
  \ in depth. **Shared invariants for every refusal** (D-4/SQ-3 \xA74/FR-19): currentAudit\
  \ = null; #results hidden; #results-placeholder shown; refreshAuditView() called;\n\
  **FILES-list note (recorded for transparency):** the dispatch instructions' terse\
  \ \"FILES\" line named `src/app.js, index.html, styles.css, phase-4-progress.md`\
  \ and separately said \"Nothing else,\" but its own CORE section explicitly instructed\
  \ adding new reason strings to `src/moduleStatusVocabulary.js` if the four FR-15/16/18/21\
  \ reasons didn't already exist there (none did) \u2014 that file is already registered\
  \ in `APP_SURFACE_FILES` (`scripts/check-app-imports.mjs`), so no new registration\
  \ was needed. Treated the detailed CORE instruction as authoritative over the terse\
  \ FILES summary; `index.html`/`styles.css` were NOT touched this phase \u2014 `showModuleRefusal()`\
  \ reuses existing DOM elements (`#results`/`#results-placeholder`/`#run-assessment`/`#load-example`/`#example-select`/\
  \ `#copy-audit`/`#download-audit`) and the existing `.placeholder-card` styling;\
  \ no new markup or CSS was needed for the refusal state. submit disabled; module\
  \ selector stays usable."
---

# spa-module-switcher — Phase 4: Fail-Closed Refusal State + Capability Gating

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-4-progress.md -t P4-01 -s completed
```

---

## Objective

Build the third fail-closed state — distinct from success and input-rejection — covering all four
SQ-3 §4 refusal cases, and prove (seam task P4-06) that the banner (Phase 3) and refusal (this
phase) transitions are atomic. This is Milestone 2 of 3 named `karen` reviews and the
**safety-critical slice** of the whole feature.

**Duration**: ~2 engineer-days · **Dependencies**: Phase 3 complete (wave 4) ·
**`integration_owner`**: `phase-owner` (shared with Phase 3) · **Seam task**: `P4-06` ·
**Effort**: `extended` on every implementer task · **Exit gate**: each of the 4 refusal cases has a
test; no path reaches `assess()` for an ineligible module.

### Why refusal is a *third* state and not a reuse

SQ-3 proved the current failure mode is actively dangerous. Growth/kidney fail at
`src/units.js:167` (not the evidence registry), throw `UnitRejectionError`
(`code: 'UNIT_REJECTED'`), which is in `src/app.js:20 INPUT_REJECTION_CODES`, so `src/app.js:693`
renders the heading **"Check the entered units"**. An unimplemented module masquerades as a
clinician data-entry error — a live `docs/architecture.md:391` violation. The P2-03 eligibility
gate makes this unreachable through the UI; the refusal state is built anyway as **defence in
depth**, as a distinct third state, and **never** as a reuse of `showInputRejection`.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P4-01 | `showModuleRefusal(moduleId, reason)` — the distinct third state | general-purpose (frontend engineer¹) | sonnet/extended | claude | pending | P3-04 |
| P4-02 | Refusal Case 1 — evidence registry has no entry | general-purpose | sonnet/extended | claude | pending | P4-01 |
| P4-03 | Refusal Case 2 — hooks not-implemented, detected before render | general-purpose | sonnet/extended | claude | pending | P4-01, P2-03 |
| P4-04 | Refusal Case 3 — manifest status ≠ READY_STATUS | general-purpose | sonnet/extended | claude | pending | P4-01, P2-03 |
| P4-05 | Refusal Case 4 — module KB fetch fails / 404 | general-purpose | sonnet/extended | claude | pending | P4-01, P2-04 |
| P4-06 | **SEAM TASK (R-P3)** — banner ↔ refusal atomicity | general-purpose | sonnet/extended | claude | pending | P4-01, P3-04 |
| P4-07 | Unregistered `?module=` id — explicit refusal | general-purpose | sonnet/extended | claude | pending | P4-01, P3-05 |
| P4-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | pending | P4-01..P4-07 |
| P4-KAREN | **`karen` milestone review (Milestone 2)** | karen | sonnet/extended | claude | pending | P4-GATE |

¹ **Agent-name substitution**: `frontend-developer` is not registered in this project; dispatched
as `general-purpose` with the role descriptor retained.

---

## Orchestration Quick Reference

### Batch 1 (after Phase 3 gate)

```
Task("general-purpose", "P4-01: showModuleRefusal(moduleId, reason) — the distinct third state
(FR-14/FR-19). Independent function from showInputRejection, own heading, own DOM branch, never
via INPUT_REJECTION_CODES. Enforce invariants in order: clear currentAudit → hide #results → show
#results-placeholder → refreshAuditView() → disable submit → render reason. Selector stays
interactive. See plan §Phase 4, P4-01.")
```

> **Serialization constraint — this phase is `sequential`, not `batch-parallel`.** All seven
> implementer tasks declare **`src/app.js` as their only `target_surface`**, and the dev-execution
> rule is **one agent per file, no parallel edits to the same file**. There is no disjoint batching
> for this phase, so each batch below emits **exactly one `Task()` call**. This is deliberate: the
> tasks build one state machine incrementally on `P4-01`'s skeleton in a safety-critical file, and
> concurrent edits would interleave refusal branches. **Do not re-parallelize** batches 2–7.

### Batch 2 (after P4-01) — single task, `src/app.js`

```
Task("general-purpose", "P4-02: Refusal Case 1 — evidence registry has no entry for the module
(FR-15/SQ-3 §4.1). src/evidence/registry.js throws unknown module for growth/kidney. Route to
showModuleRefusal: 'No assessment produced — evidence not available for module X'. See plan
§Phase 4, P4-02.")
```

### Batch 3 (after P4-02) — single task, `src/app.js`

```
Task("general-purpose", "P4-03: Refusal Case 2 — hooks not-implemented, detected BEFORE render
(FR-16/SQ-3 §4.2, F5-F7). Detect at selection time from module descriptor / summarize()
notYetImplemented. renderClassification must NEVER run — prevents 'undefined g/dL' and false
Indeterminate. See plan §Phase 4, P4-03.")
```

### Batch 4 (after P4-03) — single task, `src/app.js`

```
Task("general-purpose", "P4-04: Refusal Case 3 — manifest status ≠ READY_STATUS (FR-17/SQ-3
§4.3). State the actual status verbatim. Never downgrade to a warning — browser is the only
enforcement point. Defence-in-depth for a hand-edited ?module=. See plan §Phase 4, P4-04.")
```

### Batch 5 (after P4-04) — single task, `src/app.js`

```
Task("general-purpose", "P4-05: Refusal Case 4 — module KB fetch fails/404 (FR-18/SQ-3 §4.4).
Module-scoped 'Unable to load module X's knowledge base.' rules/candidates reset to []/{} BEFORE
the fetch (P2-04 ordering). See plan §Phase 4, P4-05.")
```

### Batch 6 (after P4-05) — single task, `src/app.js`

```
Task("general-purpose", "P4-06: SEAM TASK (R-P3) — banner ↔ refusal atomicity across the P3/P4
boundary. Prove no observable interleaving where a prior result is visible beneath the new
banner, and no tick where the audit stays downloadable after the banner changes. Order the state
transition explicitly, comment it as load-bearing. See plan §Phase 4, P4-06.")
```

### Batch 7 (after P4-06) — single task, `src/app.js`

```
Task("general-purpose", "P4-07: Unregistered ?module= id — explicit refusal naming the requested
id (FR-21). Distinct from Case 3. Never fall back to anemia silently. See plan §Phase 4, P4-07.")
```

### Gate + Milestone (after all tasks complete)

```
Task("task-completion-validator", "P4-GATE: Verify Phase 4 exit gate for spa-module-switcher —
each of the 4 refusal cases has a test; no path reaches assess() for an ineligible module. Reject
if any refusal routes through showInputRejection/INPUT_REJECTION_CODES, leaves a downloadable
audit, or if renderClassification can run for a not-implemented module.")

Task("karen", "P4-KAREN: Milestone 2 review of the safety-critical refusal slice for
spa-module-switcher. Verify: (1) refusal is genuinely a third state, none reaches
showInputRejection; (2) NO path reaches assess() for a module failing the eligibility predicate;
(3) 'Check the entered units' is unreachable for module-level failure; (4) audit never
downloadable and no prior result survives after refusal; (5) zero maturity-ladder vocabulary
('coming soon'/'preview'/'beta'/'temporarily unavailable') in refusal copy.")
```

---

## Quality Gates

- [x] Refusal is a distinct third state; `showInputRejection` untouched and never reused for module-level failures
- [x] All 4 SQ-3 §4 refusal cases implemented **and** source-verified (D-6: not executed-tested — no browser automation in this repo)
- [x] **In source**, no `renderClassification` call site exists outside a not-implemented-guarded branch (D-6: this does not prove it never runs — P6-011 confirms no `"undefined g/dL"` / false `Indeterminate` reaches the screen)
- [x] **In source**, no `assess()`/`assessModule()`/`MODULE_KB_LOADERS` call site exists outside a body guarded by the eligibility predicate (**AC-11 / P6-012**) — the guard is inside the handlers, not the `disabled` attribute
- [x] Every refusal enforces the FR-19 invariants; audit never downloadable post-refusal; no silent fallback to `anemia`
- [x] Seam task P4-06 proves banner ↔ refusal atomicity with no observable interleaving (source-order proof, D-6)
- [x] Unregistered `?module=` names the requested id explicitly
- [x] Zero maturity-ladder vocabulary ("preview", "beta", "coming soon", "temporarily unavailable") in any refusal copy (executed test: tests/module-status-vocabulary.test.mjs)
- [ ] `karen` Milestone 2 review recorded
- [ ] AC-4 screenshot (refusal state ≥1440px: no results panel, no downloadable audit, no "Check the entered units") captured and reviewed **by a person** at **P6-011**

---

## Implementation Notes

### Architectural Decisions

- `showModuleRefusal` may share `showInputRejection`'s *skeleton* (the invariant sequence) but is
  its own function with its own DOM branch — never routed through `INPUT_REJECTION_CODES`.
- Detection for Case 2 is **preferential at selection time** from the module descriptor, with a
  hook-return fallback — never a post-render correction.

### Known Gotchas

- This is the **safety-critical slice** — every implementer task carries `extended`, not
  `adaptive`, effort.
- P4-06 (the seam task) is the join point between Phase 3's banner state and this phase's refusal
  state — both write `src/app.js`/`index.html`, so ordering/atomicity is the entire point of the
  task, not an afterthought.
- Do not let Case 2's detection run `renderClassification` even once during development/debugging
  — its `=== null` guards vs. `undefined` stub fields is the exact F6/F7 hazard this phase exists
  to close.

### Development Setup

Node ≥ 20. Gate before Phase 5/6 open: `task-completion-validator` sign-off (`P4-GATE`) + `karen`
Milestone 2 sign-off (`P4-KAREN`) — **both** required.

---

## POST-REVIEW FIXES — P4-GATE round 2 (2026-07-23)

`P4-KAREN` APPROVED. `P4-GATE` CHANGES_REQUESTED (1 blocking) + 3 further findings from a codex
adversarial pass and a live-browser pass (coordinator). All five addressed this round, same file
boundaries (`src/app.js`, `src/moduleStatusVocabulary.js`, `tests/module-status-vocabulary.test.mjs`,
this file). `modules/**`, `src/algorithmExplorer.js`, and the smoke script remained untouched.

**Fix 1 — BLOCKING [P4-GATE]: zero direct unit tests for the four reason-derivation functions.**
`src/moduleStatusVocabulary.js:127-172` (the four `derive*Reason` functions) had no test coverage
of their own — pure, node-importable functions D-6 never sheltered. Added 6 new tests to
`tests/module-status-vocabulary.test.mjs`: one exact-string assertion (with title/id substitution,
two different inputs each) per function — `deriveEvidenceUnavailableReason`,
`deriveNotYetImplementedReason`, `deriveKbLoadFailureReason`, `deriveUnregisteredModuleReason` —
plus a `Set(...).size === 4` distinctness check across all four given the SAME input, plus a
prohibited-vocabulary scan over their combined output. `node --test` for the three targeted suites:
41 -> 47 tests, all pass.

**Fix 2 — forced-activation no-op [live-browser finding]:** `selectModule()` (was src/app.js:1099-1100)
early-returned on `!isModuleSelectable(moduleId)` BEFORE ever reaching `activateModule()` — so a
devtools user who stripped a row's `disabled` attribute and clicked (e.g.) CBC Suite got a silent
no-op, not the specified refusal state (AC-4's resilience clause / P6-011 item (7): "the expected
result is the refusal state, never an assessment"). Fixed: `selectModule()` no longer re-derives
eligibility at all — it forwards ANY requested moduleId to `activateModule()` unconditionally
(only short-circuiting on `moduleId === activeModuleId`, an unrelated no-op-reselect optimization),
making `activateModule()`'s own `isRegisteredModule()`/`isModuleSelectable()` checks the SOLE
decision-maker, never DOM state (the row's `disabled` attribute). A forced click on an ineligible-
but-registered row now flows into `activateModule()`'s FR-17 branch exactly like a hand-edited
`?module=` does: banner swaps to the clicked module's real status, results/audit clear, submit
disabled, refusal renders. AC-11 is not weakened — the assess-reaching guard still lives entirely
inside `activateModule()`, just no longer duplicated (and, as this bug showed, able to diverge)
in `selectModule()` too.

**Fix 3 — algorithm-explorer init leak, reachable today [codex finding]:** on load of
`?module=growth_suite_v1`, `activateModule()` correctly refused (FR-16), but `initialize()`
unconditionally still called `initializeAlgorithmExplorer({ rules, candidates, ... })` right
afterward. `src/algorithmExplorer.js:621` (untouchable) unconditionally runs
`assessPediatricAnemia` against its first worked example at the end of that function's own
init — a real anemia-walkthrough computation silently running under an ineligible module's active
context. Fixed in `src/app.js` only: extracted `initializeAlgorithmExplorerIfEligible()`, gated on
`isModuleSelectable(activeModuleId) && activeModuleId === DEFAULT_MODULE_ID`; called from BOTH
`initialize()` (page load) and the tail of `activateModule()`'s success path (so a LATER switch to
anemia — today the only selectable module — initializes it then, deferred rather than lost).
`initializeAlgorithmExplorer()`'s own idempotency guard
(`explorer.dataset.initialized === 'true'`) makes repeated calls safe/cheap. Code comment cites the
codex finding and explicitly notes P5-01 owns the full `#algorithm` tab degradation later — this
closes only the narrower, reachable-today init-time computation leak.

**Fix 4 — TOCTOU hardening, latent [codex + karen findings]:** no request-generation guard existed
around the awaits in `activateModule()`/`loadActiveModuleKb()` (`src/app.js`, formerly lines
887/897/1060) — with a future second selectable module, a stale in-flight load could resolve after
a newer one and overwrite its fresher `rules`/`candidates`; `loadExample()`'s `await fetch(...)`
could likewise assess module B's data against a response fetched under module A's identity. Fixed
with two complementary patterns (a source-order comment in each function names both review
findings):
- **`activateModule()`/`loadActiveModuleKb()`** — a module-scoped monotonic
  `moduleLoadGeneration` counter (`isCurrentLoadGeneration(generation)`). `activateModule()`
  claims a new generation synchronously at entry, before anything else runs; `loadActiveModuleKb()`
  receives that snapshot and re-checks it after EVERY internal await (the fetch pair, each
  `.json()` call), abandoning — no `rules`/`candidates`/nav-count write at all — the instant it
  detects a newer generation superseded it; `activateModule()` re-checks it once more itself right
  after `await loadActiveModuleKb(generation)` returns, before treating a `false` result as a
  genuine FR-18 refusal (a `false` can mean either a real failure or "superseded" — only the
  former is a real refusal; the latter must render nothing, since the newer activation already
  rendered its own correct state).
- **`loadExample()`/`submit`** — a `moduleAtStart = activeModuleId` snapshot taken immediately
  after the entry guards, re-asserted (`activeModuleId !== moduleAtStart` -> silent no-op, never a
  refusal) before every subsequent state-mutating step, and used (not the live `activeModuleId`)
  for the assess dispatch condition, the `assessModule(...)` call, and the FR-15 evidence-miss
  reason derivation — so a stale continuation can never assess as one module while `rules`/
  `candidates` have already been reloaded for another. `submit`'s own body has no `await` today
  (JS run-to-completion means nothing can interleave mid-handler), so this is documented as
  symmetry/future-proofing there, not closing a currently-reachable race — `loadExample()`'s is the
  real, reachable-today fix.

**Fix 5 — cosmetic [P4-GATE notes]:**
(a) `phase-4-progress.md`'s P4-06 `acceptance_criteria` described an EXECUTED browser test ("A
test drives: assess under anemia... select an ineligible module...") that D-6 forbids implying
exists — reworded in place to the actual verification ceiling (source-order assertion over
`activateModule()`, explicitly stating what it does and does not prove, deferring the observable
check to P6-011).
(b) The two `activeModuleId === 'anemia'` literals (formerly src/app.js:1226 and :1372, inside
`loadExample()`/`submit`) are now `moduleAtStart === DEFAULT_MODULE_ID` — both the DEFAULT_MODULE_ID
substitution AND the switch from the live `activeModuleId` to the `moduleAtStart` snapshot were
done together as part of fix 4 (the same edit serves both purposes). The R-3-pinned literal call
shape `assessPediatricAnemia(input, rules, candidates)` remains byte-intact in both functions —
confirmed by `npm run smoke:browser` passing and by `grep -n
"assessPediatricAnemia(input, rules, candidates)" src/app.js` showing both occurrences unchanged.

**Gates after all five fixes:** `npm run build`, `check:imports`, `smoke:browser`, `smoke`,
`verify:d4` all exit 0; the three targeted `node --test` suites — 47/47 pass (was 41; +6 new
tests, zero regressions); `npm test` — exactly 26 failures, byte-identical test-name set to the
pre-fix baseline (2634 total tests now, up from 2628, entirely accounted for by the 6 new
vocabulary tests), zero new, zero regressed.

---

## Completion Notes

**What was built:** `showModuleRefusal(moduleId, reason)` (src/app.js:966-981), the distinct third
state; `activateModule(moduleId)` (src/app.js:989-1066), the single P4-06 choke point through
which BOTH P3's banner/selector state and P4's refusal state now flow (`selectModule()` and
`initialize()` both route through it — no second code path reassigns `activeModuleId`); the four
refusal-case wirings (FR-15 reactive catch, FR-16 proactive-at-selection-time +
defensive-at-every-assess-site check, FR-17 proactive at selection time, FR-18 decided by
`loadActiveModuleKb()`'s new boolean return); the FR-21 unregistered-id case (same choke point,
first branch); and the closure of the P3-tracked AC-11 item (algorithm-explorer `onUseCase` guard).
Four new reason-derivation functions added to `src/moduleStatusVocabulary.js` (parameterized by
title/id, never hardcoding a module name) since the task's own CORE instructions required it (see
the `notes:` field above for the FILES-list/CORE-instructions reconciliation).

**Architectural choice beyond the literal task list:** `loadExample()`/`submit` now dispatch via
`activeModuleId === 'anemia' ? assessPediatricAnemia(...) : assessModule(activeModuleId, ...)`
rather than an unconditional `assessPediatricAnemia` call. This was necessary, not optional: Case 1
(FR-15) and Case 2 (FR-16) are both about assess()-time failures for the ACTIVE module, but
`assessPediatricAnemia` is hardcoded to always assess as `'anemia'` internally regardless of
`activeModuleId` — without the module-generic `assessModule` sibling (P2-02, already exported,
additive) in the mix, those two refusal cases would have nowhere real to attach for any future
non-anemia selectable module. R-3 is preserved exactly: the literal `assessPediatricAnemia(input,
rules, candidates)` substring is still present, unchanged, in both function bodies (verified by
grep and by the passing `smoke:browser` gate) — it is simply now one branch of a ternary rather
than the only statement. Since `isModuleSelectable()` still gates every entry to these handlers and
only `anemia` passes it today, the `assessModule` branch is reachable-in-principle,
exercised-by-none-of-today's-real-modules — future-proofing for the day a second module becomes
`integrity-recorded`, not dead weight.

**A second architectural choice:** the FR-19 "submit disabled" invariant (and the load-example/
example-select/audit-download controls) is now enforced at TWO layers — once unconditionally in
`activateModule()`'s preamble (before any refusal/success branching, so the controls are disabled
during the async KB-fetch window too, closing a latent gap where a KB-fetch failure would
previously have left submit enabled against an empty rule set) and again, explicitly, inside
`showModuleRefusal()` itself (since that function is ALSO called reactively from
`submit`/`loadExample()`'s own catch blocks, where nothing upstream has disabled anything yet).
The redundancy is deliberate, not an oversight — see the code comment on `showModuleRefusal()`.

**Deviation, in-scope and recorded:** FR-15 (evidence-registry miss) has no exported
registration-membership check in `src/evidence/registry.js` (out of this phase's editable-file
list), so it stays purely REACTIVE — a narrow, message-prefix-matched catch
(`isEvidenceRegistryMissError`) — rather than a proactive check like FR-16/FR-17. This matches the
phase file's own framing of Case 1 ("today this lands in showFatalError... route it instead").

**Verification performed this phase:** `npm run build`, `npm run check:imports`, `npm run
smoke:browser`, `npm run smoke`, `npm run verify:d4` all exit 0; `node --test
tests/module-status-vocabulary.test.mjs tests/module-eligibility.test.mjs
tests/module-kb-loaders.test.mjs` — 41/41 pass (two vocabulary-file self-tests initially failed
because this phase's own new JSDoc comments accidentally contained the literal banned words —
`"temporarily unavailable"`/`"coming soon"`/`"preview"`/`"beta"` inside a sentence EXPLAINING the
prohibition, and `"fetch ("`/`"assess("` inside prose — both fixed by rewording, a useful proof the
executed prohibited-vocabulary test actually catches what it claims to); `npm test` — exactly 26
failures, byte-identical test-name set to the pre-Phase-4 baseline, zero new, zero regressed.

**What is NOT verified (D-6, restated so it is not later over-claimed):** every refusal case's
actual runtime behavior — that the DOM ends up in the stated state, that a real 404/thrown error
actually triggers the intended branch, that the seam's "atomic" swap is never visibly interleaved —
is SOURCE-ASSERTED only. This repo has no browser automation. Every claim above is qualified as
such; `npm test`/`npm run check` passing does NOT mean the UI behaves correctly. That is P6-011's
human pass, and `karen`'s Milestone 2 review (`P4-KAREN`, still pending) is the next gate.

**Recommendations for Phase 5:** the state machine `activateModule()` now owns is settled — P5's
module-scoped tab degradation (`#algorithm`/`#evidence`/`#rules`, the examples picker, nav counts,
page copy) should read `activeModuleId` and `isModuleSelectable(activeModuleId)` rather than
re-deriving module state independently. In particular, P5-01's `#algorithm` tab degradation makes
this phase's `onUseCase` guard effectively unreachable dead code once the tab itself is hidden for
non-anemia modules — that is expected layering (defence in depth), not redundant work to undo.
