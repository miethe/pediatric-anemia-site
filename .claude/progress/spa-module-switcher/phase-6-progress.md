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
phase: 6
title: "SPA Module Switcher — Phase 6: Gates & Test Harness (Verification Phase)"
status: in_progress
created: '2026-07-22'
updated: '2026-07-23'
started: '2026-07-23T00:00:00Z'
completed: null
commit_refs: []
pr_refs: []
overall_progress: 79
completion_estimate: on-track
total_tasks: 14
completed_tasks: 11
in_progress_tasks: 0
blocked_tasks: 3
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
- karen
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P6-001
  description: >
    Module inventory & grouping test (AC-1). Assert all four registered modules render, grouped
    by selectability: the row set comes from listModules()/MODULE_IDS; display fields come from
    the frozen src/moduleManifests.js map; group membership is computed once by the FR-4
    predicate; the verbatim panel header "These modules are not peers. Read each row." is present.
    Include AC-1 resilience: a manifest missing an optional envelope field renders without
    undefined/empty-label artifacts; a module in MODULE_IDS absent from the manifest map appears
    in the not-selectable group with the FR-17 reason, never dropped.
  status: completed
  completed_at: '2026-07-23T04:00:00Z'
  evidence: >
    tests/module-registry.test.mjs — 6 new source-asserted tests appended, named "…source
    declares…" per the D-6 forbidden-phrasing rule: row set from MODULE_IDS (not a hardcoded
    count); display fields from MODULE_MANIFESTS; group membership computed once via
    isModuleSelectable; PANEL_HEADER referenced by identifier, never inlined in src/app.js; both
    AC-1 resilience branches (optional-field omission guards in moduleRowMarkup; a
    MODULE_IDS-but-no-manifest id routed to not-selectable with an FR-17 reason, never dropped).
    All 6 pass. Ceiling: proves the source, not that four rows paint on screen (P6-011).
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-03, P5-06]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-registry.test.mjs
  acceptance_criteria: >
    TIER source-asserted. PROVES: the row-renderer source derives its row set from MODULE_IDS (not
    a hardcoded 4, so a fifth registered module fails rather than passing silently), references the
    panel header by identifier, computes group membership from the FR-4 predicate, and contains
    both resilience branches. DOES NOT PROVE that four rows paint or that the grouping is legible —
    P6-011 establishes that. Name the tests "…source declares…", never "…renders…".
  verifies_ac: [AC-1]
- id: P6-002
  description: >
    tests/module-switcher-eligibility.test.mjs — predicate is imported, never a literal (AC-2).
    Assert READY_STATUS is imported from src/kbVerify.js into the eligibility path, and that the
    literal 'integrity-recorded' appears NOWHERE in src/app.js, src/moduleEligibility.js or
    index.html. Assert the comparison target is moduleManifests[id].status.
  status: completed
  completed_at: '2026-07-23T04:15:00Z'
  evidence: >
    tests/module-switcher-eligibility.test.mjs (new file) — 4 tests: READY_STATUS imported from
    src/kbVerify.js (not hardcoded); 'integrity-recorded' literal absent from src/app.js,
    src/moduleEligibility.js and index.html (verified empty via grep before writing the test);
    the comparison target really is MODULE_MANIFESTS[id].status === READY_STATUS for every
    registered id (executed); strict === (not loose/substring) confirmed in source. All 4 pass.
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-03]
  estimated_effort: "0.25 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-eligibility.test.mjs
  acceptance_criteria: >
    Test passes; a seeded hardcoded 'integrity-recorded' literal in any of the three files makes
    it fail.
  verifies_ac: [AC-2]
- id: P6-003
  description: >
    Eligibility gating — only integrity-recorded reaches assess() (AC-2). REWRITTEN TO THE D-6
    CEILING: the original AC specified a spy, which is unwritable here (src/app.js is DOM-dependent;
    node cannot import or execute it, so no call-count instrumentation exists). Two halves.
    (a) EXECUTED: src/moduleEligibility.js is non-DOM, so run it for real — isModuleSelectable
    returns false for each of the three unsigned-stub ids and for a manifest whose status is absent
    or outside the closed enum (AC-2 resilience: ineligible, never eligible-by-default).
    (b) SOURCE-ASSERTED: functionBody() over src/app.js shows every MODULE_KB_LOADERS/assessModule/
    assess reference sits inside a body that evaluates the predicate first, and that no such
    reference exists elsewhere. The three entry paths (row selection, ?module= deep link, form
    submit) are checked individually.
  status: completed
  completed_at: '2026-07-23T04:20:00Z'
  evidence: >
    tests/module-switcher-eligibility.test.mjs — (a) EXECUTED: isModuleSelectable false for all
    three unsigned-stub ids and for a moduleId absent from MODULE_MANIFESTS (the executable proxy
    for "status absent" — no live manifest has a genuinely absent status field); "out-of-enum
    status" is proven by strict-equality construction (recorded as such, not implied executed —
    no real manifest sits outside the enum today). (b) SOURCE-ASSERTED: every loadModuleKb(...)/
    assessModule(...)/assessPediatricAnemia(...) call site in src/app.js falls inside one of
    {activateModule, loadActiveModuleKb, the submit handler, loadExample, the onUseCase callback}
    (verified by offset-range scan, not string search alone); each of the 3 entry paths (row
    selection via selectModule->activateModule; ?module= deep link via
    initialize->readModuleIdFromUrl->activateModule; form submit) individually shown to check the
    predicate before any assess call. 10 tests, all pass. Two halves recorded separately per the
    task's own instruction. DOES NOT PROVE assess() is unreachable at runtime — P6-011/P6-012 close
    that gap partially; a textually-present-but-unreachable guard would still pass this section.
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-03, P4-04]
  estimated_effort: "1.0 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-eligibility.test.mjs
  acceptance_criteria: >
    TIER executed + source-asserted. PROVES: (a) the predicate really returns false for all three
    stubs and for absent/out-of-enum status — a genuine behavioural result; (b) src/app.js contains
    NO unguarded call site for the loader or the engine. DOES NOT PROVE that assess() is not called
    at runtime — a guard textually present but unreachable would pass. That gap is closed by P6-011
    (deep-link an ineligible module and observe) and is why P6-012 exists. Record both halves
    separately in the phase note.
  verifies_ac: [AC-2]
- id: P6-004
  description: >
    tests/module-switcher-status-labels.test.mjs — doc-truth pin over the vocabulary (AC-3). The
    full doc-truth pin (P1-04 was the unit test; this is the surface pin). Assert: every
    closed-enum status maps to exactly one canonical sentence, byte-matching PRD §6.1.B-1; the
    panel header, the FR-13 honesty-boundary sentence and the FR-34 staleness disclosure are
    exported from src/moduleStatusVocabulary.js and referenced by identifier in src/app.js; no
    status text is written inline in index.html or src/app.js. Resilience case: a status value
    with no vocabulary entry fails the build. Pin the R-1 group headers here too.
  status: completed
  completed_at: '2026-07-23T04:35:00Z'
  evidence: >
    tests/module-switcher-status-labels.test.mjs (new file) — 9 tests for this task: enum
    coverage derived from schemas/module-manifest.schema.json (executed); every real registered
    module's status resolves to a real sentence (executed); missing-entry sentinel returns
    UNKNOWN_STATUS_SENTINEL, a Symbol, never a friendlier string (executed); PANEL_HEADER/
    HONESTY_BOUNDARY_DISCLOSURE/EVIDENCE_STALENESS_DISCLOSURE imported+referenced by identifier in
    src/app.js (source); no clinician-facing sentence text inlined in index.html or src/app.js —
    scanned for 7 distinguishing fragments (COMPLETE); both R-1 group-header labels present
    verbatim in index.html. FR-11 addendum: a real resolved-colour-VALUE scan over every
    module-row/status-chip/module-status(-banner) rule in styles.css, merging :root custom
    properties from BOTH styles.css and site-overrides.css (the latter overrides --success to a
    REAL green — confirmed as a test precondition so the merge is not vacuously safe) — passes
    clean today (0 green-band colours), PLUS two seeded mutation self-tests proving the checker
    genuinely fails on a green value behind an innocuously-named token and on a raw green hex
    literal. Comment states honestly: placement (panel vs. tooltip) is P6-011's alone — a tooltip
    implementation would pass every assertion here.
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P1-02, P3-04]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-status-labels.test.mjs
  acceptance_criteria: >
    TIER executed (vocabulary) + source-asserted (surfaces). PROVES by execution: enum coverage
    derived from schemas/module-manifest.schema.json (not hand-copied), each canonical sentence
    byte-matching PRD §6.1.B-1, the derived FR-9 clause, the missing-entry sentinel. PROVES by
    source: no inline status text in index.html/src/app.js; group headers present. DOES NOT PROVE
    that the honesty-boundary sentence and staleness disclosure render IN THE PANEL rather than a
    title= tooltip — a tooltip passes every assertion here; placement is established only by
    P6-011, and the test file must carry a comment saying so. FR-11 addendum (D-6 corollary): the
    no-green-state check resolves every custom property reachable from a module-row/status-chip/
    banner selector to its literal colour VALUE and rejects a green hue at meaningful saturation —
    a token named --stub-warn whose value is #2e7d32 must fail. Name-only checks are forbidden.
  verifies_ac: [AC-3]
- id: P6-005
  description: >
    Four refusal-case tests (AC-4). One test per SQ-3 §4 case: (1) evidence registry has no entry
    → refusal named; (2) hooks not-implemented, detected before render, renderClassification never
    invoked; (3) manifest status ≠ READY_STATUS, verbatim enum status shown, not downgraded to a
    warning; (4) KB fetch 404, rules/candidates reset to []/{} BEFORE the fetch. Every case
    asserts the FR-19 invariants and asserts NONE routes through INPUT_REJECTION_CODES or renders
    "Check the entered units". Include the AC-4 resilience case (prior result cleared before the
    refusal renders; audit download disabled in the same tick) — the P4-06 seam re-asserted at
    gate level.
  status: completed
  completed_at: '2026-07-23T04:50:00Z'
  evidence: >
    tests/module-switcher-eligibility.test.mjs — 7 tests: showModuleRefusal() textually distinct
    from showInputRejection() (body strings unequal) and from showFatalError(), never references
    INPUT_REJECTION_CODES, never contains "Check the entered units"; the six FR-19 invariants
    present IN THE SPECIFIED ORDER (index-order asserted, not just presence); Case 1 (evidence-
    registry miss) routed via isEvidenceRegistryMissError + deriveEvidenceUnavailableReason from
    BOTH loadExample and submit; Case 2 (not-yet-implemented) — exactly one renderClassification
    call site in the whole file (inside renderResult), reached only downstream of a
    notYetImplementedRefusalReason guard in all 4 call sites (activateModule/loadExample/submit/
    onUseCase); Case 3 (status != READY_STATUS) renders the verbatim moduleStatusReasonText, no
    "warning" wording; Case 4 reset-before-fetch order re-confirmed at this gate level; resilience
    test confirms the shared invariants + audit-disable all precede activateModule()'s only await,
    with no setTimeout/rAF/queueMicrotask boundary between them. All 7 pass. DOES NOT PROVE the DOM
    reaches this state — P6-011 alone establishes that.
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P4-01, P4-02, P4-03, P4-04, P4-05, P4-06, P4-07]
  estimated_effort: "1.25 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-eligibility.test.mjs
  acceptance_criteria: >
    TIER source-asserted. REWRITTEN — the original AC specified a spy on showInputRejection, which
    is unwritable (no DOM-capable runtime here). PROVES: functionBody('showModuleRefusal') contains
    the six FR-19 invariant statements IN THE SPECIFIED ORDER; the function is textually distinct
    from showInputRejection and references neither it nor INPUT_REJECTION_CODES; it never contains
    the heading "Check the entered units"; each of the four SQ-3 §4 cases has its own reason string
    sourced by identifier; no renderClassification call site exists outside a not-implemented-
    guarded branch; the reset-before-fetch order precedes the fetch in source order. DOES NOT
    PROVE that the DOM reaches the refusal state, that the prior result leaves the screen, that the
    audit download is disabled, or that no "undefined g/dL"/false Indeterminate reaches the page.
    Behavioral fail-closure is NOT established by this task — P6-011 is where a person confirms it.
  verifies_ac: [AC-4]
- id: P6-006
  description: >
    ?module= URL-state round-trip test (AC-5). Assert: ?module= is read on load and validated with
    isRegisteredModule(); absent → DEFAULT_MODULE_ID; selection writes it back via
    history.replaceState preserving the #tab hash; switchTab's replaceState (src/app.js:457)
    preserves the query string (R-7 — the specific regression this test exists for); unregistered
    or ineligible → explicit refusal naming the requested id, no silent substitution; and no
    localStorage/sessionStorage/cookie is read or written.
  status: completed
  completed_at: '2026-07-23T05:00:00Z'
  evidence: >
    tests/module-switcher-eligibility.test.mjs — 6 tests: COMPLETE grep of localStorage./
    sessionStorage./document.cookie across all 7 app-surface files + index.html returns zero API
    usages (comment mentions of the words don't count — checked for actual API-call patterns);
    switchTab() references location.search and the bare hash-only replaceState form is gone from
    actual code (comment-stripped check, since the OLD buggy form is quoted in the fix's own
    explanatory comment); readModuleIdFromUrl validates with isRegisteredModule(), falls back to
    DEFAULT_MODULE_ID only when the param is absent, never silently substitutes for an
    unregistered-but-present id; writeModuleUrlParam preserves the #tab hash;
    deriveUnregisteredModuleReason wired to the FR-21 refusal case, naming the requested id. All 6
    pass. PARTIAL per the task's own instruction: no real tab click was observed; P3-06 did not
    factor URL construction into a pure exported non-DOM helper, so no optional strengthening
    applied — recorded as a gap, not implied coverage.
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-05, P3-06, P4-07]
  estimated_effort: "0.5 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-eligibility.test.mjs
  acceptance_criteria: >
    TIER source-asserted, with one complete check. COMPLETE: the grep for localStorage/
    sessionStorage/document.cookie across app-surface files returns zero hits — absence in source
    IS absence, so this half is fully established. PARTIAL: functionBody('switchTab') shows the
    bare replaceState(null,'',`#${tab}`) form is gone and location.search is referenced; the load
    path calls isRegisteredModule(). DOES NOT PROVE that a real tab click preserves the query
    string. Optional strengthening, not mandated: if P3-06 factored the URL construction into a
    pure exported non-DOM helper, execute it here and the round-trip becomes genuinely behavioural;
    if not, record the gap rather than implying coverage.
  verifies_ac: [AC-5]
- id: P6-007
  description: >
    Module-scoped degradation & module-derived copy tests (AC-6, AC-7). AC-6: the active moduleId
    is the single input to the degradation decision for #algorithm (FR-25), #evidence (FR-26), the
    #rules empty state (FR-27) and the examples picker (FR-28); nav counts come from the loaded
    module's own rules/candidates and index.html:66's static 91/26 is neutralized (FR-29). AC-7:
    manifest.title drives document.title, <h1>, brand and footer; document.title must not carry
    anemia's KNOWLEDGE_BASE_VERSION under another module (F11); a missing manifest.title renders
    the moduleId verbatim, never a generic "Assessment".
  status: completed
  completed_at: '2026-07-23T05:10:00Z'
  evidence: >
    tests/module-switcher-status-labels.test.mjs — 10 tests: COMPLETE check that the
    #nav-rule-count/#nav-pattern-count elements carry no static digit fallback (scoped to the two
    exact elements, not a blind whole-file 91/26 scan — the file legitimately contains "91" in
    unrelated anemia-only marketing copy and "26" inside every 2026- date, so a blind scan would
    misfire); nav counts set from rules.length/candidates key count; #algorithm/#evidence/#rules
    each degrade via an identifier-sourced, moduleId-conditioned branch
    (moduleSupportsAlgorithmExplorer / moduleHasEvidenceView / rules.length === 0); examples picker
    emptied AND disabled ownership boundary confirmed in source comment; all 8 AC-7 copy sites
    wired to updateModuleDerivedPageCopy(); document.title reads view.knowledgeBaseVersion, never
    the anemia-only KNOWLEDGE_BASE_VERSION constant (confirmed absent from actual code, comment
    discussion of the old bug excluded from the scan); missing manifest.title falls back to
    moduleId verbatim, never "Assessment"; `git diff main -- src/algorithmExplorer.js` is empty
    (executed via execFileSync, asserted, not assumed). All 10 pass.
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P5-01, P5-02, P5-03, P5-04, P5-05, P5-06]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-status-labels.test.mjs
  acceptance_criteria: >
    TIER source-asserted, with one complete check. COMPLETE: index.html contains neither 91 nor 26
    as a count fallback — a whole-file scan fully establishes this. PARTIAL: each of the four
    degradation surfaces has a moduleId-conditioned branch in src/app.js, each empty/unavailable
    string is referenced by identifier, git diff src/algorithmExplorer.js shows no change to
    anemiaWalkthrough or any facts.* accessor, and all eight index.html copy sites read from
    manifest.title. DOES NOT PROVE what any tab renders under a scaffold module, that the explorer
    never executes (only that its invocation sits behind a branch), or what document.title says.
    P6-011 walks the tabs under each of the three scaffolds by hand.
  verifies_ac: [AC-6, AC-7]
- id: P6-008
  description: >
    ALLOW-LIST assertion — the renderer can emit only enumerated manifest fields (AC-8,
    FR-31/FR-32/FR-33). REWRITTEN per the D-2 corollary in D-6: the prohibited-TOKEN scan was
    bypassable — modules/anemia/module.json carries a real clinicalContentHash: sha256:97e65556…,
    D-2 imports that object into the browser graph BY DESIGN, and JSON.stringify(manifest) into a
    row or data-* attribute would emit it while passing a token scan of source text cleanly.
    (a) PRIMARY — allow-list: the row/banner renderer may read and emit ONLY id, title, status,
    knowledgeBaseVersion, evidenceReviewedThrough, approvedBy.length. (engineLabel and
    limitations() come from the hooks, not the manifest; FR-3 permits them separately.) Fail on any
    other manifest.<field> or destructured key inside the renderer's functionBody(), and fail
    outright on JSON.stringify(manifest), {...manifest}, Object.entries(manifest), or assignment of
    the manifest object (or an un-narrowed subset) into a data-*/dataset property, innerHTML or
    textContent. (b) SECONDARY — token scan retained as a weaker layer over index.html, src/app.js,
    src/moduleStatusVocabulary.js, styles.css. (c) dist/ half — CORRECTED TARGET: the old AC
    scanned dist/index.html for sha256:, which is VACUOUS (rows and banner are JS-rendered, so the
    built HTML contains no status output either way and the scan passes whether or not the defect
    exists). Run the allow-list assertion against dist/src/app.js instead, where the built renderer
    actually lives. Comment the test with scripts/sign-kb.mjs:58-73's anemia hardcode as the reason
    it cannot be relaxed.
  status: completed
  completed_at: '2026-07-23T05:25:00Z'
  evidence: >
    tests/module-switcher-status-labels.test.mjs — 10 tests. PRIMARY allow-list:
    getManifestView() (the sole function in src/app.js reading manifest.<field> off the raw
    MODULE_MANIFESTS[moduleId] object — confirmed via an offset scan that no other MODULE_MANIFESTS[
    read exists anywhere else in the file) reads/emits ONLY id/title/status/knowledgeBaseVersion/
    evidenceReviewedThrough, plus manifest.approvedBy solely as deriveApprovedByClause()'s argument
    (never rendered directly); no destructuring/JSON.stringify(manifest)/spread/Object.entries/
    Object.keys/dataset-innerHTML-textContent manifest assignment. THREE seeded mutation self-tests
    prove the allow-list genuinely fails on: a seeded manifest.clinicalContentHash read, a seeded
    JSON.stringify(manifest), and a seeded sha256: fragment. SECONDARY token scan (with exact
    negating-phrase carve-outs, including handling multi-line JS string concatenation so the
    canonical sentences match as a clinician would read them) over src/app.js and
    src/moduleStatusVocabulary.js, plus a styles.css class-name scan; a dedicated test proves the
    carve-outs are exact (the real FR-9 clause passes, a bare "approved" nearby does not). (c) dist/
    half — same three assertion layers run against dist/src/app.js (never the vacuous
    dist/index.html), citing scripts/sign-kb.mjs:58-73's anemia hardcode as the reason the allow-list
    cannot be relaxed to include clinicalContentHash. All 10 pass; requires `npm run build` to have
    populated dist/ first (documented in-repo, not a hidden precondition).
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P3-04, P5-06]
  estimated_effort: "0.75 pts"
  priority: high
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-status-labels.test.mjs
  - src/app.js
  - dist/src/app.js
  acceptance_criteria: >
    TIER source-asserted. PROVES: the renderer's source in src/app.js AND dist/src/app.js reads and
    emits only allow-listed fields, with no bulk-serialization construct present; a seeded
    manifest.clinicalContentHash read, a seeded JSON.stringify(manifest), and a seeded sha256:
    fragment each fail it; negating-phrase carve-outs are exact rather than substring-loose (so
    "approvedBy is empty: no credentialed clinician has reviewed or approved this module" passes
    while a bare "approved" fails). DOES NOT PROVE that no hash reaches the painted DOM — an
    injection path outside the scanned functionBody(), or a file not in target_surfaces, would
    escape. P6-011 reads the rendered banner and searches the live DOM for sha256: by hand.
  verifies_ac: [AC-8]
- id: P6-009-smoke
  description: >
    EXTEND scripts/smoke-browser-unit-rejection.mjs — runtime smoke over every touched UI surface
    (AC-9, R-P4, R-3). Extend, do not rewrite. Retain :132, :134, :179, :188 and :216-223 by
    keeping assessPediatricAnemia exported with its anemia call shape (delivered in P2-02). Extend
    :179/:188 to also accept the module-generic assessModule(currentModuleId, input, rules,
    candidates) call. Add a sibling assertion block for the module-refusal UI mirroring the
    existing AGE_OUT_OF_SUPPORTED_RANGE block at :167-173. THE PREVIOUS CLAIM — that the smoke run
    "exercises default load, module switch, refusal render, and tab switch with ?module= present" —
    IS REMOVED, NOT SOFTENED: the script has no DOM, no page load and no event dispatch, and says
    so at :4-15. Keep its two-part shape instead. (a) SOURCE-ASSERTED half: functionBody() over
    src/app.js proves the refusal UI exists, is textually distinct from showInputRejection and
    showFatalError, and is wired to the selection and submit paths; plus dev/dist link resolution
    over the four new app-surface files. (b) EXECUTED half: import the built NON-DOM graph from
    dist/src/ and actually run it — assessModule('anemia', …) produces the same classification as
    assessPediatricAnemia(…), and isModuleSelectable() returns false for each unsigned-stub id.
    Resilience: the dist/ scan for unstamped fetch specifiers must pass against the FR-36 literal
    map. SCREENSHOTS ARE NOT CAPTURED HERE — they are P6-011's.
  status: completed
  completed_at: '2026-07-23T05:40:00Z'
  evidence: >
    scripts/smoke-browser-unit-rejection.mjs extended additively (git diff: +84/-0 lines — grep of
    the diff's removed-line hunks returns nothing; every pre-existing line survives byte-for-byte,
    including the :4-15 boundary comment). All five original assertion sites confirmed present by
    content-match after the edit (the two import-specifier regexes, the two
    assessPediatricAnemia(input, rules, candidates) call-shape asserts, and the dist classification
    ==='present' assert). Additions: (1) dev/dist resolution for the four new app-surface files; (2)
    a sibling assertion block for showModuleRefusal — distinct from showInputRejection AND
    showFatalError, no INPUT_REJECTION_CODES reference, no "Check the entered units", wired to both
    activateModule (selection/deep-link choke point) and the submit handler; (3) :179/:188 extended
    with an ADDITIONAL assessModule(moduleAtStart, input, rules, candidates) call-shape assert
    alongside (not replacing) the original assessPediatricAnemia assert; (4) an executed dist/src/
    half — assessModule('anemia', freshInput, rules, candidates).classification deep-equals
    assessPediatricAnemia(...)'s (a FRESH input, since the pre-existing rejection test had already
    mutated the shared `input` object); isModuleSelectable() false for all three unsigned-stub ids,
    loaded from the built dist/src/moduleEligibility.js. `npm run smoke:browser` exits 0. The
    unstamped-fetch scan (unchanged) still passes. The claim that the script "exercises default
    load, module switch, refusal render, tab switch" is NOT made anywhere in this extension.
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-02, P4-01, P5-06]
  estimated_effort: "1.25 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - scripts/smoke-browser-unit-rejection.mjs
  acceptance_criteria: >
    TIER executed + source-asserted. npm run smoke:browser green; git diff
    scripts/smoke-browser-unit-rejection.mjs shows ADDITIVE change only — no assertion at :132,
    :134, :179, :188 or :216-223 deleted or weakened, and the :4-15 boundary statement retained
    verbatim and extended, never removed. PROVES: the built non-DOM assessment graph behaves, and
    the app source contains the refusal wiring. DOES NOT PROVE default load, module switch, refusal
    render, or tab switch — none is executable here, and no progress note may describe them as
    exercised.
  verifies_ac: [AC-9]
- id: P6-010
  description: >
    Import verification for new surfaces + deliberate DEFAULT_MODULE_ID tripwire decision (AC-10,
    R-6). Two halves. (a) Confirm src/moduleManifests.js, src/moduleStatusVocabulary.js,
    src/moduleKbLoaders.js and src/moduleEligibility.js are all in APP_SURFACE_FILES, and that all
    8 MODULE_KB_LOADERS specifiers resolve in both dev and dist layouts and are ?v=-stamped.
    (b) Action TWO SEPARATE tripwire comments, which the plan previously merged. They have
    DIFFERENT trigger conditions and only one is about this feature.
    TRIPWIRE A — tests/module-registry.test.mjs:20-24: ALREADY OVERDUE, UNRELATED TO THIS FEATURE.
    Its own comment says the assertion "must be updated/deleted the day a SECOND MODULE REGISTERS",
    and it still asserts "today there is exactly one registered module". Four are registered. That
    trigger FIRED AT COMMIT 263120b AND WAS NEVER ACTIONED — the comment is stale today and would
    still be stale if this feature were cancelled. Correct it to state the count truthfully and
    record in the commit that it had been unactioned since 263120b. Do NOT present it as caused by
    this feature.
    TRIPWIRE B — src/modules/registry.js:39-50: FIRED BY THIS FEATURE. A different condition —
    "the day a CLIENT-SELECTABLE moduleId surface actually ships (a UI control, an API parameter, a
    CDS Hooks card selector) — that is the real trigger … not merely the count of registered
    modules." Decision: DEFAULT_MODULE_ID stays 'anemia' (now the INITIAL selection, not the ONLY
    one; no module status changed). Update this comment citing E1 FR-14/R-8 and ADR-0009
    explicitly. Governance decision, not a mechanical edit.
    The commit message must address A and B separately.
  status: completed
  completed_at: '2026-07-23T05:45:00Z'
  evidence: >
    (a) tests/module-registry.test.mjs — 2 new tests confirm APP_SURFACE_FILES (scripts/
    check-app-imports.mjs) lists all four new files, and all 8 MODULE_KB_LOADERS fetch specifiers
    resolve under both dev and dist/ layouts; `npm run check:imports` independently exits 0. (b)
    BOTH tripwires actioned SEPARATELY, never merged. TRIPWIRE A
    (tests/module-registry.test.mjs:20-24): comment corrected to state the real count (four
    registered modules today) and explicitly record that this trigger fired at commit `263120b`
    and sat unactioned since — pre-existing debt this feature's P6-010 task closed, NOT caused by
    this feature; a new assertion pins MODULE_IDS.length === 4. TRIPWIRE B
    (src/modules/registry.js:39-50): comment block extended (27 lines, purely additive — see git
    diff) recording that the DIFFERENT, client-selectable-surface trigger fired BY this feature
    (the header-dropdown switcher), that `DEFAULT_MODULE_ID` stays `'anemia'` as a deliberate
    decision (it is now the initial selection, not the only reachable module; no manifest status
    changed per FR-35, so nothing else is eligible), citing E1 FR-14/R-8 and ADR-0009 explicitly —
    quoting ADR-0009's own "The FR-14/R-8 lifting authority" section. Zero behavior change in
    registry.js — comment-only, confirmed by re-running the full test suite (delta-green
    unaffected) and `npm run check:imports`/`build` after the edit.
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P1-03, P2-01, P2-03, P2-05, P0-02]
  estimated_effort: "0.5 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - scripts/check-app-imports.mjs
  - tests/module-registry.test.mjs
  - src/modules/registry.js
  acceptance_criteria: >
    npm run check:imports exits 0 with all four new files covered and 8 specifiers verified
    dev+dist; tests/module-registry.test.mjs passes with a comment stating the real module count
    and noting the trigger had been unactioned since 263120b; src/modules/registry.js:39-50's
    comment records that the CLIENT-SELECTABLE-SURFACE trigger fired and how it was decided, citing
    E1 FR-14/R-8 and ADR-0009 by ID; the commit message treats A and B as distinct and does not
    attribute A to this feature.
  verifies_ac: [AC-10]
- id: P6-011
  description: >
    HUMAN VERIFICATION — visual evidence capture and review (AC-1, AC-3, AC-4, AC-6, AC-7, AC-8,
    AC-9, AC-11) AND the sole verifier of FR-37 (item 9). THIS TASK IS PERFORMED BY A PERSON, NOT
    AN AGENT, AND MUST NOT BE DISPATCHED TO ONE. It exists because visual_evidence_required appears on seven ACs and no task in this plan
    provisioned any capture mechanism — nothing in this repository can drive a browser (D-6).
    Without it P6-GATE is unpassable. PROCEDURE: serve the built site locally (npm run build, then
    any static server over dist/). At >=1440px capture (1) the module panel showing both groups and
    all four rows [AC-1]; (2) the banner under anemia (integrity-recorded) and under a scaffold
    (unsigned-stub), showing no green/approved state and BOTH DISCLOSURES IN THE PANEL, NOT ON
    HOVER — hover nothing and confirm no title= tooltip carries either sentence [AC-3, AC-8,
    FR-11]; (3) the refusal state for the scaffold case — no results panel, audit download
    disabled, no "Check the entered units", no "undefined" anywhere on screen [AC-4]; (4)
    #algorithm, #evidence and #rules under a non-anemia module [AC-6]; (5) header, footer and the
    browser tab title under a non-anemia module [AC-7]; (6) default load [AC-9]. At 375px capture
    the module panel again, confirming the rail does not clip [AC-1]. Then two non-screenshot
    checks: (7) FORCED-ACTIVATION CHECK [AC-11] — open devtools, delete the disabled attribute from
    an ineligible row, activate it, and record what happens; the expected result is the refusal
    state, never an assessment; (8) DOM HASH CHECK [AC-8] — search the live DOM, including every
    data-* attribute, for sha256: and record the result; (9) KEYBOARD / ACCESSIBLE-NAME CHECK
    [FR-37] — THIS IS FR-37'S ONLY VERIFIER. Nothing else in this plan checks it: AC-11 and P6-012
    explicitly disclaim it (they cover FR-6, the predicate inside the handlers, which is the
    security boundary — FR-37 is the separate PRESENTATION guarantee). Tab through the module rail
    from the top of the page. Confirm (a) focus order is linear through the rail with no trap
    inside an inert row; (b) every ineligible row is ANNOUNCED AS DISABLED by assistive technology
    (a real disabled/aria-disabled non-activatable state, not merely dimmed) — read it with a
    screen reader or the accessibility inspector, not by eye; (c) each ineligible row's ACCESSIBLE
    NAME CARRIES ITS REASON TEXT, so the reason is available without sight of colour, opacity or
    hatching; (d) the status banner is announced via role="alert". Record per-row what the
    accessible name actually said. RECORDING: store images under
    .claude/worknotes/spa-module-switcher/visual-evidence/ and append a dated block to this file
    listing, per AC, the file captured, the reviewer's NAME, and a plain-language pass/fail. Any
    problem goes to .claude/findings/spa-module-switcher-findings.md. HONESTY CONSTRAINT: record
    these as HUMAN OBSERVATIONS, never as test results, and never describe the feature as
    "verified" on their strength.
  status: pending
  assigned_to: [human]
  provider: none
  dependencies: [P6-001, P6-002, P6-003, P6-004, P6-005, P6-006, P6-007, P6-008, P6-009-smoke, P6-010]
  estimated_effort: "0.75 pts"
  priority: critical
  assigned_model: none
  model_effort: none
  target_surfaces:
  - .claude/worknotes/spa-module-switcher/visual-evidence/
  - .claude/progress/spa-module-switcher/phase-6-progress.md
  acceptance_criteria: >
    TIER human. All NINE items captured or performed; the images exist at the recorded paths; a
    NAMED PERSON (not an agent, not "the reviewer") is recorded against each; checks (7), (8) and
    (9) have written outcomes — item (9) must record, per ineligible row, the accessible name as
    actually announced, not a restatement of intent; this file carries the dated block. THIS TASK
    CANNOT BE MARKED COMPLETE BY AN AGENT ASSERTING IT WAS DONE — P6-KAREN verifies the artefacts
    exist and the name is a person's. Item (9) is FR-37's ONLY verifier; if it is skipped, FR-37
    ships unverified and P6-GATE must not pass.
  verifies_ac: [AC-1, AC-3, AC-4, AC-6, AC-7, AC-8, AC-9, AC-11]
  verifies_fr: [FR-37]
- id: P6-012
  description: >
    Forced-activation coverage — the predicate gates INSIDE the handlers, not via disabled (AC-11,
    FR-6 / FR-37). The devtools vector: FR-37's programmatic disabling is a PRESENTATION guarantee;
    a user with devtools, a script or an extension can delete the attribute and invoke the handler
    directly. This task proves the refusal survives that. Assert via functionBody() over src/app.js
    that (1) the module-selection handler, (2) the KB-load function (the P2-04 reset-before-fetch
    call site) and (3) the assessment submit handler each contain the FR-6 predicate call ahead of
    every MODULE_KB_LOADERS/assessModule/assess reference, with no early-return path that skips it;
    (4) NO call site of those three symbols exists anywhere in src/app.js outside those guarded
    bodies; (5) none of the three reads eligibility from DOM state (.disabled, aria-disabled,
    dataset.*, a CSS class) — the predicate's input must be moduleManifests[id].status.
    Additionally EXECUTE src/moduleEligibility.js (non-DOM) and confirm
    isModuleSelectable('cbc_suite_v1') === false, likewise for the other two stubs and for
    absent/out-of-enum status.
  status: completed
  completed_at: '2026-07-23T05:55:00Z'
  evidence: >
    tests/module-switcher-eligibility.test.mjs — 4 tests. EXECUTED: isModuleSelectable() ===
    false for all three unsigned-stub ids and for an unregistered/absent/undefined/empty id.
    SOURCE-ASSERTED: (1) the module-selection choke point (activateModule(), reached identically
    by row selection via selectModule() and by the ?module= deep link — established in the P6-003
    section) checks isModuleSelectable(moduleId) before loadActiveModuleKb(), with every early
    return before that point shown to follow one of the three synchronous refusal checks, never a
    bare skip; (2) loadActiveModuleKb() (the P2-04 reset-before-fetch call site) checks eligibility
    as its literal first statement; (3) the submit handler checks isModuleSelectable(activeModuleId)
    before every assess call. (4) no loadModuleKb(/assessModule(/assessPediatricAnemia( call site
    exists anywhere in src/app.js outside {activateModule, loadActiveModuleKb, the submit handler,
    loadExample, onUseCase} (offset-range scan, not string search). (5) none of the three reads
    eligibility from DOM state — a write-vs-read-aware regex distinguishes `.disabled = true`
    (FR-37 presentation, written inside activateModule's own invariant block) from a bare `.disabled`
    READ (none found); the click listener's own `row.disabled` early-return is explicitly carved out
    of scope and documented as a UI convenience, not one of the three named handlers, because
    activateModule() re-derives eligibility unconditionally for any moduleId regardless of that
    check's outcome. A seeded mutation self-test proves the DOM-state scan genuinely throws against
    an injected `el?.disabled` eligibility read. LOAD-BEARING LIMITATION recorded verbatim in test
    comments: none of this proves invoking the selection handler with cbc_suite_v1 refuses AT
    RUNTIME — that is closed only by P6-011 item (7), a human devtools check.
  assigned_to: [general-purpose]
  provider: claude
  dependencies: [P2-03, P3-07, P4-01, P4-04]
  estimated_effort: "0.5 pts"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  target_surfaces:
  - tests/module-switcher-eligibility.test.mjs
  - src/app.js
  - src/moduleEligibility.js
  acceptance_criteria: >
    TIER source-asserted (+ executed predicate). PROVES: no unguarded call site exists IN SOURCE,
    the guard precedes the loader/engine reference in each of the three handlers, eligibility is
    never read from DOM state, and the predicate really returns false for all three stubs. DOES NOT
    PROVE — and this is the load-bearing limitation — that invoking the selection handler directly
    with cbc_suite_v1 refuses AT RUNTIME: src/app.js is DOM-dependent and node can neither import
    nor execute it, so no direct-invocation test is writable. The runtime half is closed ONLY by
    P6-011 item (7), a human devtools check. A seeded eligibility read from el.disabled must fail
    this test.
  verifies_ac: [AC-2, AC-11]
- id: P6-GATE
  description: >
    task-completion-validator gate. (1) FULL npm run check green (all 8 sub-gates). (2) Every PRD
    §11 verified_by ID exists and passes: P6-001..P6-010, P6-009-smoke, P6-011, P6-012.
    (3) visual_evidence_required is satisfied BY P6-011's RECORD, not by an automated artefact —
    confirm the images exist at the recorded paths, a NAMED PERSON is recorded against each AC, and
    items (7) forced-activation, (8) DOM hash search and (9) the FR-37 keyboard/accessible-name pass
    have written outcomes. This clause is what makes the gate passable at all; before P6-011 existed
    no task provisioned any capture mechanism and the gate could not be met. BLOCKER-P6-011-HUMAN
    blocks this gate mechanically: if it is still open, STOP — do not pass the gate and do not treat
    an undispatchable human task as complete. FR-37 has no other verifier; item (9) missing means
    FR-37 ships unverified and the gate fails. (4) Confirm no AC, test name or progress-note sentence describes
    a DOM-dependent behaviour as executed, spied or "rendered" (D-6). REJECT IF:
    smoke-browser-unit-rejection.mjs was rewritten rather than extended; any pre-existing assertion
    was weakened to make a new one pass; its :4-15 boundary statement was removed; visual evidence
    is claimed without files and a human name; or a jsdom/headless-browser/test-runner dependency
    was added to package.json.
  status: pending
  assigned_to: [task-completion-validator]
  provider: claude
  dependencies: [P6-001, P6-002, P6-003, P6-004, P6-005, P6-006, P6-007, P6-008, P6-009-smoke, P6-010, P6-011, P6-012]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: "All four exit-gate clauses pass; recorded in the phase progress note, with the P6-011 reviewer named."
- id: P6-KAREN
  description: >
    karen milestone review (Milestone 3). Verify: (1) the smoke gate was EXTENDED, not rewritten —
    all five original assertion sites AND the :4-15 boundary statement intact. (2) BOTH tripwires
    actioned, separately and correctly: tests/module-registry.test.mjs:20-24 (its "second module
    registers" trigger fired at 263120b and had gone unactioned — confirm the comment now states
    the real count and the commit does NOT attribute it to this feature) and
    src/modules/registry.js:39-50 (a DIFFERENT trigger, "a client-selectable moduleId surface
    actually ships", which this feature does fire — confirm E1 FR-14/R-8 and ADR-0009 cited in the
    comment and commit). Reject a review that treats the two as one event. (3) No test was made to
    pass by weakening a prior assertion. (4) AC-8 is an ALLOW-LIST, not a token scan, and runs
    against dist/src/app.js rather than the vacuous dist/index.html; carve-outs exact. (5) P6-011
    ACTUALLY HAPPENED: screenshots exist, a NAMED HUMAN signed them, and the forced-activation,
    DOM-hash and FR-37 keyboard/accessible-name checks (items 7, 8, 9) have written outcomes — item
    (9) must record the accessible name as actually announced, per ineligible row, because it is
    FR-37's ONLY verifier. An assumed or agent-asserted P6-011 is a blocking finding, as is a
    BLOCKER-P6-011-HUMAN cleared without a signed human record. (6) Nothing in the phase's tests, ACs or progress notes describes a DOM-dependent
    behaviour as executed, spied or rendered, and no test dependency was added (D-6).
  status: pending
  assigned_to: [karen]
  provider: claude
  dependencies: [P6-GATE, P6-011]
  estimated_effort: "—"
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  acceptance_criteria: >
    Milestone review recorded; findings fixed in-phase or logged to
    .claude/findings/spa-module-switcher-findings.md.
parallelization:
  batch_1: [P6-001, P6-002, P6-004, P6-009-smoke]
  batch_2: [P6-003, P6-007, P6-010]
  batch_3: [P6-005, P6-008]
  batch_4: [P6-006]
  batch_5: [P6-012]
  batch_6: [P6-011]
  batch_7: [P6-GATE]
  batch_8: [P6-KAREN]
  critical_path: [P6-005, P6-009-smoke, P6-011, P6-GATE, P6-KAREN]
  estimated_total_time: "~3 engineer-days (9 pts) + one human review session (P6-011)"
  serialization_constraint: >
    SHARED-FILE OWNERSHIP — batches are grouped by disjoint target_surfaces, not by dependency
    depth. Do not re-merge them. Five tasks write tests/module-switcher-eligibility.test.mjs
    (P6-002, P6-003, P6-005, P6-006, P6-012), three write
    tests/module-switcher-status-labels.test.mjs (P6-004, P6-007, P6-008), and two write
    tests/module-registry.test.mjs (P6-001, P6-010); P6-008 and P6-012 both additionally read/write
    src/app.js. The dev-execution rule is one agent per file, no parallel edits to the same file,
    so the eligibility-test group alone forces five batches — that is what sets the batch count
    here. Within each batch every task owns a different file. The earlier grouping collided
    P6-002/P6-006 and P6-004/P6-008 in batch_1 and P6-003/P6-005/P6-012 three ways in batch_2.
blockers:
- id: BLOCKER-PHASE-DEP
  title: "Phase 6 cannot open until Phase 4 (P4-GATE, P4-KAREN) AND Phase 5 (P5-GATE) exit gates all pass"
  severity: high
  blocking: [P6-005, P6-009-smoke]
  resolution: >
    Wait for .claude/progress/spa-module-switcher/phase-4-progress.md P4-GATE + P4-KAREN and
    .claude/progress/spa-module-switcher/phase-5-progress.md P5-GATE to all complete.
  created: '2026-07-22'
- id: BLOCKER-P6-011-HUMAN
  title: "P6-GATE is BLOCKED until a named human completes and signs P6-011 — this must halt, not silently skip"
  severity: critical
  blocking: [P6-GATE]
  resolution: >
    A NAMED PERSON performs P6-011 (nine items: eight captures/checks plus item (9), the FR-37
    keyboard/accessible-name pass), stores the images under
    .claude/worknotes/spa-module-switcher/visual-evidence/, and appends the dated signed block to
    this file. Only then may this blocker be cleared and P6-GATE run. THIS BLOCKER IS MECHANICAL ON
    PURPOSE. P6-011 is assigned_to: [human] with provider: none and sits alone in batch_6; prose
    alone does not stop an orchestrator. This repository has a recorded failure of exactly this
    shape — an unregistered agent inside parallel() returned null and the wave "passed" with zero
    review. An orchestrator that finds no dispatchable agent for P6-011 must STOP and surface this
    blocker, never treat the batch as complete. Clearing it on an agent's assertion that the work
    was done is a P6-KAREN blocking finding.
  created: '2026-07-22'
success_criteria:
- id: SC-1
  description: "Full npm run check green (test, validate, coverage:rules, build, verify:d4, check:imports, smoke:browser, smoke)"
  status: pending
- id: SC-2
  description: "Every PRD §11 verified_by ID exists and passes: P6-001..P6-010, P6-009-smoke, P6-011, P6-012"
  status: pending
- id: SC-3
  description: "smoke-browser-unit-rejection.mjs extended, not rewritten; all five original assertion sites AND its :4-15 boundary statement intact (R-3)"
  status: pending
- id: SC-4
  description: "In SOURCE, no assess()/assessModule()/MODULE_KB_LOADERS call site exists outside a predicate-guarded body in each of the three entry handlers (P6-012). Not a runtime call-count — no spy is writable here (D-6)"
  status: pending
- id: SC-5
  description: "isModuleSelectable EXECUTED and returns false for all three unsigned-stub ids and for absent/out-of-enum status"
  status: pending
- id: SC-6
  description: "Doc-truth test pins the vocabulary, panel header, honesty boundary, staleness disclosure and group headers; the no-green-state check asserts RESOLVED COLOUR VALUES, not token names"
  status: pending
- id: SC-7
  description: "AC-8 is an ALLOW-LIST over the renderer's emittable manifest fields (id, title, status, knowledgeBaseVersion, evidenceReviewedThrough, approvedBy.length), run against src/app.js AND dist/src/app.js; the token scan is the secondary layer; carve-outs exact"
  status: pending
- id: SC-8
  description: "All four new app-surface files in APP_SURFACE_FILES; all 8 specifiers verified dev+dist and ?v=-stamped"
  status: pending
- id: SC-9
  description: "BOTH tripwires actioned separately: tests/module-registry.test.mjs:20-24 (overdue since 263120b, NOT caused by this feature) and src/modules/registry.js:39-50 (fired by this feature; cites E1 FR-14/R-8 + ADR-0009 in comment and commit)"
  status: pending
- id: SC-10
  description: "P6-011 COMPLETE — all NINE items: screenshots at >=1440px (and 375px for AC-1) exist at the recorded paths, SIGNED BY A NAMED PERSON, with written outcomes for the forced-activation check (7), the DOM-hash check (8) and the FR-37 keyboard/accessible-name check (9)"
  status: pending
- id: SC-13
  description: "FR-37 is verified — by P6-011 item (9) and nothing else. AC-11/P6-012 disclaim it (they cover FR-6). If item (9) has no written per-row accessible-name outcome, FR-37 is unverified and P6-GATE fails"
  status: pending
- id: SC-11
  description: "No AC, test name or progress note describes a DOM-dependent behaviour as executed/spied/rendered; package.json still declares no dependencies and no devDependencies"
  status: pending
- id: SC-12
  description: "karen Milestone 3 review recorded"
  status: pending
files_modified:
- tests/module-switcher-status-labels.test.mjs
- tests/module-switcher-eligibility.test.mjs
- tests/module-registry.test.mjs
- scripts/smoke-browser-unit-rejection.mjs
- scripts/check-app-imports.mjs
notes: >
  Wave 6 — depends on Phase 4 (both gates) AND Phase 5. This phase owns EVERY `verified_by` ID in
  PRD §11 — task IDs use the PRD's own P6-001..P6-010 / P6-009-smoke numbering verbatim so the
  ACs' verified_by references resolve. **The R-3 constraint, binding on the whole phase**:
  scripts/smoke-browser-unit-rejection.mjs greps src/app.js source text at :132,:134,:179,:188,
  :216-223 — extend, never rewrite. `npm run check` is authoritative and copied verbatim from
  package.json's scripts.check: `npm test && npm run validate && npm run coverage:rules && npm
  run build && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run
  smoke`. Effort is `extended` on every implementer task — gate surgery on a source-grepping
  smoke test.
---

# spa-module-switcher — Phase 6: Gates & Test Harness (Verification Phase)

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-6-progress.md -t P6-001 -s completed
```

---

## Objective

Own every `verified_by` ID in PRD §11: eleven automated tasks (`P6-001`..`P6-010`, `P6-012`) plus
the extended smoke (`P6-009-smoke`) and **one human verification pass (`P6-011`)** covering
AC-1..AC-11. Milestone 3 of 3 named `karen` reviews, and the phase where `npm run check` goes green.

**Estimate**: **9 pts** (was 5) · **Duration**: ~3 engineer-days + one human review session ·
**Dependencies**: Phase 4 and Phase 5 complete (wave 6) · **Assigned**: `task-completion-validator`
drives; frontend engineer implements; **a named human owns P6-011**; **`karen`** at exit ·
**Effort**: `extended` · **Exit gate**: full `npm run check` green **and** P6-011 recorded and signed.

### The D-6 verification ceiling, binding on the whole phase

**This repository has no browser automation and no test dependencies.** `package.json` declares no
`dependencies` and no `devDependencies` at all; `scripts/smoke-browser-unit-rejection.mjs:4-15` states
the posture verbatim. Per **D-6** the ceiling is **accepted, not worked around** — do **not** add
jsdom, a headless browser, or any test runner (the escalation path is ADR-0010, authored at DOC-006).

| Tier | Technique | Proves | Does not prove |
|---|---|---|---|
| **Executed** | `node:test` over non-DOM modules and the built `dist/src/` graph | Real behaviour of pure functions | Anything touching `src/app.js`, `index.html`, the DOM, events, focus, paint or CSS |
| **Source-asserted** | `functionBody()` + regex over the app surfaces and their `dist/` copies | That the source *contains* the right guard, in order, by identifier; that a construct is *absent from source* | That the state machine **behaves** |
| **Human** | **P6-011** — a person drives the page, captures, reviews, signs | Rendering, panel-vs-tooltip placement, focus order, the devtools forced-activation check | Regression protection — nothing re-runs it |

**Forbidden in this phase's ACs and in any progress note**: "spy", "call count", "renders",
"executes", "the smoke run exercises …", for anything DOM-dependent. If a claim is not an executed
non-DOM assertion or a source assertion, it belongs to **P6-011** as a human observation — never a
passing test. PRD §11a is the disclosure this phase must not contradict.

### The R-3 constraint, stated once, binding on the whole phase

`scripts/smoke-browser-unit-rejection.mjs` **greps `src/app.js` source text**. Breaking assertions:
`:132` (`import { assessPediatricAnemia } from './engine.js'`), `:134` (same against
`algorithmExplorer.js`), `:179`/`:188` (`assessPediatricAnemia(input, rules, candidates)` call
shape), `:216-223` (dist import + classification assertion). **Extend, never rewrite** — and retain
its `:4-15` boundary statement verbatim.

---

## Task Tracking

| Task ID | Name | AC | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|----|-----------------------|--------------|----------|--------|---------------|
| P6-001 | Module inventory & grouping test | AC-1 | general-purpose (frontend engineer¹) | sonnet/extended | claude | completed | P3-03, P5-06 |
| P6-002 | Eligibility predicate imported, never literal | AC-2 | general-purpose | sonnet/extended | claude | completed | P2-03 |
| P6-003 | Eligibility gating — only integrity-recorded reaches `assess()` | AC-2 | general-purpose | sonnet/extended | claude | completed | P2-03, P4-04 |
| P6-004 | Status-labels doc-truth pin | AC-3 | general-purpose | sonnet/extended | claude | completed | P1-02, P3-04 |
| P6-005 | Four refusal-case tests | AC-4 | general-purpose | sonnet/extended | claude | completed | P4-01..P4-07 |
| P6-006 | `?module=` URL-state round-trip test | AC-5 | general-purpose | sonnet/extended | claude | completed | P3-05, P3-06, P4-07 |
| P6-007 | Module-scoped degradation + module-derived copy tests | AC-6, AC-7 | general-purpose | sonnet/extended | claude | completed | P5-01..P5-06 |
| P6-008 | Negative-assertion test (no integrity/approval/release claim) | AC-8 | general-purpose | sonnet/extended | claude | completed | P3-04, P5-06 |
| P6-009-smoke | **Extend** `smoke-browser-unit-rejection.mjs` | AC-9 | general-purpose | sonnet/extended | claude | completed | P2-02, P4-01, P5-06 |
| P6-010 | Import verification + **two** deliberate tripwire decisions | AC-10 | general-purpose | sonnet/extended | claude | completed | P1-03, P2-01, P2-03, P2-05, P0-02 |
| **P6-011** | **HUMAN visual-evidence capture & review** (9 items; item 9 is **FR-37**'s only verifier) | AC-1, 3, 4, 6, 7, 8, 9, 11 + **FR-37** | **human (named)** | — | — | pending (BLOCKER-P6-011-HUMAN) | P6-001..P6-010 |
| P6-012 | Forced-activation coverage (predicate gates inside the handlers) | AC-2, AC-11 | general-purpose | sonnet/extended | claude | completed | P2-03, P3-07, P4-01, P4-04 |
| P6-GATE | `task-completion-validator` gate | — | task-completion-validator | sonnet/adaptive | claude | pending | P6-001..P6-012 |
| P6-KAREN | **`karen` milestone review (Milestone 3)** | — | karen | sonnet/extended | claude | pending | P6-GATE, P6-011 |

¹ **Agent-name substitution**: `frontend-developer` is not registered in this project; dispatched
as `general-purpose` with the role descriptor retained.

---

## Orchestration Quick Reference

> **Serialization constraint — shared-file ownership.** These batches are grouped by **disjoint
> `target_surfaces`**, not by dependency depth. Five tasks write
> `tests/module-switcher-eligibility.test.mjs` (`P6-002`, `P6-003`, `P6-005`, `P6-006`, `P6-012`),
> three write `tests/module-switcher-status-labels.test.mjs` (`P6-004`, `P6-007`, `P6-008`), and two
> write `tests/module-registry.test.mjs` (`P6-001`, `P6-010`); `P6-008` and `P6-012` additionally
> touch `src/app.js`. The dev-execution rule is **one agent per file, no parallel edits to the same
> file**, so the eligibility-test group alone forces **five** batches — that, not dependency order,
> is what sets the batch count. Within every batch below each task owns a different file. **Do not
> re-merge these batches.**

### Batch 1 (after Phase 4 + Phase 5 gates) — `module-registry.test` ∥ `eligibility.test` ∥ `status-labels.test` ∥ smoke script

```
Task("general-purpose", "P6-001: Module inventory & grouping test (AC-1). Row set from
listModules()/MODULE_IDS (derived, not hardcoded 4); display fields from frozen
src/moduleManifests.js; group membership from FR-4 predicate; verbatim panel header present.
Resilience: missing optional field → no undefined; MODULE_IDS entry absent from manifest map →
not-selectable group with FR-17 reason. SOURCE-ASSERTED tier — name the tests '…source
declares…', never '…renders…'; that four rows paint is P6-011's. See plan §Phase 6, P6-001.")

Task("general-purpose", "P6-002: tests/module-switcher-eligibility.test.mjs — predicate
imported, never literal (AC-2). Assert READY_STATUS imported from src/kbVerify.js; zero
'integrity-recorded' literal hits across src/app.js, src/moduleEligibility.js, index.html. See
plan §Phase 6, P6-002.")

Task("general-purpose", "P6-004: tests/module-switcher-status-labels.test.mjs — doc-truth pin
(AC-3). Every closed-enum status → exactly one canonical sentence byte-matching PRD §6.1.B-1; no
inline status text; missing vocabulary entry fails the build. Pin R-1 group headers too. FR-11
addendum: the no-green-state check must resolve every custom property reachable from a module-row/
status-chip/banner selector to its literal colour VALUE and reject a green hue at meaningful
saturation — a token named --stub-warn whose value is #2e7d32 must FAIL. Name-only checks are
forbidden. Carry a comment stating that panel-vs-tooltip placement is NOT established here — a
title= tooltip passes every assertion in this file; P6-011 establishes placement. See plan §Phase
6, P6-004.")

Task("general-purpose", "P6-009-smoke: EXTEND scripts/smoke-browser-unit-rejection.mjs (AC-9,
R-P4, R-3). Retain :132,:134,:179,:188,:216-223 verbatim and retain its :4-15 boundary statement
verbatim. Extend :179/:188 for the assessModule call shape. Add a sibling refusal-UI assertion
block mirroring AGE_OUT_OF_SUPPORTED_RANGE. TWO HALVES ONLY: (a) source-asserted — functionBody()
over src/app.js proves the refusal UI exists, is textually distinct from showInputRejection and
showFatalError, and is wired to the selection and submit paths, plus dev/dist link resolution over
the four new app-surface files; (b) executed — import the built NON-DOM graph from dist/src/ and
run it (assessModule('anemia', …) matches assessPediatricAnemia(…); isModuleSelectable() false for
each unsigned-stub id). DO NOT claim the script exercises default load, module switch, refusal
render or tab switch — it has no DOM, no page load and no event dispatch, and that claim is
REMOVED, not softened. SCREENSHOTS ARE NOT CAPTURED HERE — they are P6-011's. git diff must be
additive-only. See plan §Phase 6, P6-009-smoke.")
```

### Batch 2 (after batch 1) — `eligibility.test` ∥ `status-labels.test` ∥ `check-app-imports`/`module-registry.test`/`registry.js`

```
Task("general-purpose", "P6-003: Eligibility gating — only integrity-recorded reaches assess()
(AC-2). TWO HALVES, no spy — src/app.js is DOM-dependent and node can neither import nor execute
it, so no call-count instrumentation exists. (a) EXECUTED: run src/moduleEligibility.js for real —
isModuleSelectable returns false for each of the three unsigned-stub ids and for a manifest whose
status is absent or outside the closed enum (ineligible, never eligible-by-default). (b)
SOURCE-ASSERTED: functionBody() over src/app.js shows every MODULE_KB_LOADERS/assessModule/assess
reference sits inside a body that evaluates the predicate first and that no such reference exists
elsewhere; check the three entry paths (row selection, ?module= deep link, form submit)
individually. Record both halves separately; state that a textually-present-but-unreachable guard
would pass, and that the runtime half is P6-011. See plan §Phase 6, P6-003.")

Task("general-purpose", "P6-007: Module-scoped degradation + module-derived copy tests (AC-6,
AC-7). SOURCE-ASSERTED with one complete check. COMPLETE: index.html contains neither 91 nor 26 as
a count fallback. PARTIAL: each of the four degradation surfaces has a moduleId-conditioned branch
in src/app.js, each empty/unavailable string is referenced by identifier, git diff
src/algorithmExplorer.js shows no change to anemiaWalkthrough or any facts.* accessor, and all
eight index.html copy sites read from manifest.title. DOES NOT PROVE what any tab renders under a
scaffold, that the explorer never executes, or what document.title says — P6-011 walks the tabs by
hand. See plan §Phase 6, P6-007.")

Task("general-purpose", "P6-010: Import verification + TWO SEPARATE tripwire decisions (AC-10,
R-6). (a) Confirm the 4 new files are in APP_SURFACE_FILES and all 8 specifiers resolve dev+dist
and are ?v=-stamped. (b) Action BOTH tripwires separately — they have different triggers.
TRIPWIRE A (tests/module-registry.test.mjs:20-24): its 'second module registers' trigger FIRED AT
263120b and went unactioned; correct the comment to state the real count and record in the commit
that it had been unactioned since 263120b. Do NOT attribute it to this feature. TRIPWIRE B
(src/modules/registry.js:39-50): a DIFFERENT trigger — 'a client-selectable moduleId surface
actually ships' — which this feature does fire; DEFAULT_MODULE_ID stays 'anemia' (now the INITIAL
selection, not the ONLY one), citing E1 FR-14/R-8 and ADR-0009 by ID in the comment and commit.
The commit message must address A and B separately. Governance decision, not a mechanical
pass-the-assertion edit. See plan §Phase 6, P6-010.")
```

### Batch 3 (after batch 2) — `eligibility.test` ∥ `status-labels.test`/`src/app.js`/`dist/src/app.js`

```
Task("general-purpose", "P6-005: Four refusal-case tests (AC-4). SOURCE-ASSERTED — there is no
spy on showInputRejection and none is writable here (no DOM-capable runtime). PROVES:
functionBody('showModuleRefusal') contains the six FR-19 invariant statements IN THE SPECIFIED
ORDER; the function is textually distinct from showInputRejection and references neither it nor
INPUT_REJECTION_CODES; it never contains the heading 'Check the entered units'; each of the four
SQ-3 §4 cases has its own reason string sourced by identifier; no renderClassification call site
exists outside a not-implemented-guarded branch; the reset-before-fetch order precedes the fetch in
source order. Re-assert the P4-06 seam at gate level (prior result cleared before the refusal
renders; audit download disabled in the same tick) AS A SOURCE-ORDER ASSERTION. DOES NOT PROVE
that the DOM reaches the refusal state or that the audit download is disabled — behavioral
fail-closure is P6-011's. See plan §Phase 6, P6-005.")

Task("general-purpose", "P6-008: ALLOW-LIST assertion — the renderer may emit only enumerated
manifest fields (AC-8, FR-31/FR-32/FR-33). NOT a prohibited-token scan: that was bypassable,
because modules/anemia/module.json carries a real clinicalContentHash, D-2 imports it into the
browser graph BY DESIGN, and JSON.stringify(manifest) into a row or data-* attribute would emit it
while passing a token scan cleanly. (a) PRIMARY — allow-list: the row/banner renderer may read and
emit ONLY id, title, status, knowledgeBaseVersion, evidenceReviewedThrough, approvedBy.length.
Fail on any other manifest.<field> or destructured key inside the renderer's functionBody(), and
fail outright on JSON.stringify(manifest), {...manifest}, Object.entries(manifest), or assignment
of the manifest object (or an un-narrowed subset) into a data-*/dataset property, innerHTML or
textContent. (b) SECONDARY — the token scan is retained only as a weaker layer over index.html,
src/app.js, src/moduleStatusVocabulary.js, styles.css, with EXACT negating-phrase carve-outs (so
'approvedBy is empty: no credentialed clinician has reviewed or approved this module' passes while
a bare 'approved' fails). (c) dist/ half — run the ALLOW-LIST against dist/src/app.js, where the
built renderer actually lives. Do NOT scan dist/index.html for sha256: — the rows and banner are
JS-rendered, so that scan is VACUOUS and passes whether or not the defect exists. Comment the test
with scripts/sign-kb.mjs:58-73's anemia hardcode as the reason it cannot be relaxed. See plan
§Phase 6, P6-008.")
```

### Batch 4 (after batch 3) — single task, `eligibility.test`

```
Task("general-purpose", "P6-006: ?module= URL-state round-trip test (AC-5). SOURCE-ASSERTED with
one complete check. COMPLETE: the grep for localStorage/sessionStorage/document.cookie across
app-surface files returns zero hits — absence in source IS absence. PARTIAL:
functionBody('switchTab') shows the bare replaceState(null,'',`#${tab}`) form is gone and
location.search is referenced; the load path calls isRegisteredModule(); unregistered/ineligible
routes to an explicit refusal naming the requested id. DOES NOT PROVE that a real tab click
preserves the query string. Optional, not mandated: if P3-06 factored URL construction into a pure
exported non-DOM helper, execute it here and the round-trip becomes genuinely behavioural; if not,
record the gap rather than implying coverage. See plan §Phase 6, P6-006.")
```

### Batch 5 (after batch 4) — single task, `eligibility.test` + `src/app.js` + `src/moduleEligibility.js`

```
Task("general-purpose", "P6-012: Forced-activation coverage (AC-2, AC-11, FR-6/FR-37).
functionBody() over src/app.js: the selection handler, the KB-load function and the submit handler
each evaluate the FR-6 predicate ahead of every MODULE_KB_LOADERS/assessModule/assess reference,
with no early-return path that skips it; no unguarded call site exists anywhere in the file; and
none reads eligibility from DOM state (.disabled, aria-disabled, dataset.*, a class) — the
predicate's input must be moduleManifests[id].status. Plus EXECUTE src/moduleEligibility.js and
confirm false for all three stubs and for absent/out-of-enum status. A seeded eligibility read from
el.disabled must fail this test. State in the test file that the runtime half — invoking the
selection handler directly with cbc_suite_v1 — is NOT writable here and is closed only by P6-011
item (7), a human devtools check. See plan §Phase 6, P6-012.")
```

### Batch 6 — HUMAN, not an agent

`P6-011` is **not dispatched**. A person serves `dist/`, captures the eight items listed in the task
description, performs the devtools forced-activation check and the live-DOM `sha256:` search, stores
the images under `.claude/worknotes/spa-module-switcher/visual-evidence/`, and appends a dated block
to this file naming themselves against each AC. **Do not write a `Task(...)` call for it**, and do
not mark it complete on an agent's assertion — `P6-KAREN` verifies the artefacts and the name.
`P6-011` also carries a `blockers:` entry (`BLOCKER-P6-011-HUMAN`) blocking `P6-GATE`, so the wave
**halts** here rather than silently skipping a human task that no agent can satisfy.

### Gate + Milestone (after all tasks complete)

```
Task("task-completion-validator", "P6-GATE: Verify Phase 6 exit gate for spa-module-switcher —
FULL npm run check green (all 8 sub-gates); every PRD §11 verified_by ID passes including P6-011
and P6-012; visual_evidence_required is satisfied by P6-011's RECORD (images at the recorded paths,
a NAMED PERSON per AC, written outcomes for the forced-activation and DOM-hash checks); and no AC,
test name or note describes a DOM-dependent behaviour as executed/spied/rendered. Reject if the
smoke script was rewritten rather than extended, if its :4-15 boundary statement was removed, if a
pre-existing assertion was weakened, if visual evidence is claimed without files and a human name,
or if any test dependency was added to package.json.")

Task("karen", "P6-KAREN: Milestone 3 review of the verification phase for spa-module-switcher.
Verify: (1) smoke gate extended not rewritten — all five original sites AND the :4-15 boundary
statement intact; (2) BOTH tripwires actioned separately — tests/module-registry.test.mjs:20-24
(trigger 'a second module registers' fired at 263120b and went unactioned; the comment must now
state the real count and the commit must NOT attribute it to this feature) and
src/modules/registry.js:39-50 (a different trigger, 'a client-selectable moduleId surface ships',
which this feature does fire; cite E1 FR-14/R-8 + ADR-0009). Reject a review that merges them.
(3) no test passed by weakening a prior assertion; (4) AC-8 is an allow-list run against
dist/src/app.js, not a token scan of the vacuous dist/index.html, carve-outs exact; (5) P6-011
ACTUALLY HAPPENED — screenshots exist, a NAMED HUMAN signed them, forced-activation and DOM-hash
checks have written outcomes; an assumed P6-011 is a blocking finding; (6) nothing describes
DOM-dependent behaviour as executed/spied/rendered and no test dependency was added (D-6).")
```

---

## Quality Gates

- [ ] Full `npm run check` green (test, validate, coverage:rules, build, verify:d4, check:imports, smoke:browser, smoke)
- [ ] Every PRD §11 `verified_by` ID exists and passes: `P6-001`..`P6-010`, `P6-009-smoke`, `P6-011`, `P6-012`
- [ ] `smoke-browser-unit-rejection.mjs` **extended, not rewritten**; all five original assertion sites **and** its `:4-15` boundary statement intact (R-3)
- [ ] **In source**, no `assess()`/`assessModule()`/`MODULE_KB_LOADERS` call site outside a predicate-guarded body in each of the three entry handlers (P6-012). *Not a runtime call-count — no spy is writable here (D-6).*
- [ ] `isModuleSelectable` **executed**, returning false for all three `unsigned-stub` ids and for absent/out-of-enum status
- [ ] Doc-truth test pins the vocabulary, panel header, honesty boundary, staleness disclosure and group headers; the no-green-state check asserts **resolved colour values**, not token names
- [ ] AC-8 is an **allow-list** over the renderer's emittable manifest fields, run against `src/app.js` **and `dist/src/app.js`**; the token scan is the secondary layer; carve-outs exact
- [ ] All four new app-surface files in `APP_SURFACE_FILES`; all 8 specifiers verified dev+dist and `?v=`-stamped
- [ ] **Both** tripwires actioned separately: `tests/module-registry.test.mjs:20-24` (overdue since `263120b`, not caused by this feature) and `src/modules/registry.js:39-50` (fired by this feature; cites E1 FR-14/R-8 + ADR-0009)
- [ ] **P6-011 complete — all nine items**: screenshots at ≥1440px (and 375px for AC-1) exist at the recorded paths, **signed by a named person**, with written outcomes for (7) forced-activation, (8) DOM-hash search and (9) the FR-37 keyboard/accessible-name pass
- [ ] **FR-37 verified by P6-011 item (9) and nothing else** — AC-11/P6-012 disclaim it (they cover FR-6, the security boundary). No per-row accessible-name outcome recorded ⇒ FR-37 unverified ⇒ gate fails
- [ ] **`BLOCKER-P6-011-HUMAN` is cleared by a signed human record, not by an orchestrator skipping an undispatchable task** — an unregistered/undispatchable agent returning null must halt the wave, never let it "pass"
- [ ] No AC, test name or progress note describes a DOM-dependent behaviour as executed/spied/rendered; `package.json` still declares no `dependencies` and no `devDependencies`
- [ ] `karen` Milestone 3 review recorded

---

## Implementation Notes

### Architectural Decisions

- This phase's task IDs are pinned to the PRD's own numbering (`P6-001`..`P6-010`,
  `P6-009-smoke`) so every `verified_by` reference in PRD §11 resolves without translation.
- `P6-010`'s `DEFAULT_MODULE_ID` decision is a **governance decision**, not a mechanical edit — it
  must cite ADR-0009 (Phase 0) and E1 FR-14/R-8 in three separate places (test comment, registry
  comment, commit message).

### Known Gotchas

- **R-3 is the single highest-likelihood risk in the whole plan** — a refactor of
  `smoke-browser-unit-rejection.mjs` that "simplifies" or rewrites it silently deletes the SPA's
  only regression guard. `P6-009-smoke`'s diff must be additive-only.
- **R-9 — a green gate read as behavioral coverage.** Nothing in this phase clicks anything.
  `npm run check` green means the source says the right things and the non-DOM units do the right
  things; behavioral fail-closure, banner placement and refusal transitions rest on **P6-011, a
  single human pass that does not re-run**. Any note saying "tested", "verified in the browser",
  "end-to-end" or "spy confirms" is the over-claim this feature exists to prevent, committed about
  the feature itself.
- **P6-011 is a human task with no agent.** It exists because seven ACs carry
  `visual_evidence_required` and nothing here can drive a browser — before it, P6-GATE was
  literally unpassable. Its non-dispatch is enforced **mechanically** by `BLOCKER-P6-011-HUMAN`
  (`blocking: [P6-GATE]`), not by prose alone: this repository has a recorded failure of exactly
  this shape — an unregistered agent inside `parallel()` returned `null` and the wave "passed" with
  zero review. An orchestrator finding nothing dispatchable for `P6-011` must **halt**.
- **`P6-011` item (9) is FR-37's only verifier.** FR-37 (programmatic disabling + reason in the
  accessible name) was promoted out of NFR prose precisely because nothing verified it. `AC-11` and
  `P6-012` cover **FR-6** — the predicate inside the handlers, the security boundary — and both
  explicitly disclaim FR-37. Skipping item (9) ships FR-37 unverified.
- Do not let `P6-010`'s tripwire decision become a rubber-stamp — `karen`'s Milestone 3 review
  exists specifically because "it is easy to just make the assertion pass" (R-6).
- The negative-assertion test (`P6-008`) needs **exact** negating-phrase carve-outs — a
  substring-loose match would let a bare "approved" slip through inside unrelated prose.

### Development Setup

Node ≥ 20, and **no new dependency** — `package.json` must still declare no `dependencies` and no
`devDependencies` when the phase closes (D-6). Gate before Phase 7 opens: the signed **P6-011**
record + `task-completion-validator` sign-off (`P6-GATE`) + `karen` Milestone 3 sign-off
(`P6-KAREN`) — **all three** required.

---

## Completion Notes

### 2026-07-23 — automated verification session (P6-001..P6-010, P6-009-smoke, P6-012)

**Scope of this session**: the eleven automated Phase 6 tasks. **P6-011 was NOT performed, NOT
marked, and is not implied complete by anything below** — it remains a pending human task per its
own `blockers: BLOCKER-P6-011-HUMAN` entry. (Note for the record: this session found pre-existing,
dated files under `.claude/worknotes/spa-module-switcher/visual-evidence/` — apparently a P6-011
evidence packet prepared separately by/for the coordinator. This session did not create, read the
contents of, or rely on those files in any way, and does not report P6-011 as complete on their
strength; only a person appending a signed, dated block to this progress note — naming themselves —
can do that.) P6-GATE and P6-KAREN also remain pending, both blocked on P6-011.

**Files touched** (exactly the set the task authorized — nothing else):
- `tests/module-registry.test.mjs` — tripwire-A comment corrected (P6-010) + 8 new tests (P6-001, P6-010a)
- `tests/module-switcher-eligibility.test.mjs` (new) — 32 tests (P6-002, P6-003, P6-005, P6-006, P6-012)
- `tests/module-switcher-status-labels.test.mjs` (new) — 29 tests (P6-004, P6-007, P6-008)
- `scripts/smoke-browser-unit-rejection.mjs` — extended additively (P6-009-smoke)
- `src/modules/registry.js` — comment block only, zero behavior change (P6-010 tripwire B)
- `.claude/progress/spa-module-switcher/phase-6-progress.md` — this file

**Delta-green posture — record this explicitly, per the task's honesty rules; `npm run check`
CANNOT go fully green today (main is red — Finding E-1/E-2,
`.claude/findings/spa-module-switcher-findings.md`)**:

| Stage | Result | Note |
|---|---|---|
| `npm test` | **26 known pre-existing failures, 0 new** | Baseline failure-name set captured before this session and diffed byte-for-byte against the post-session set — identical. All 26 are unrelated pre-existing EF/rights-substrate/CBC-evidence-fixture failures (see the findings doc); zero involve `tests/module-registry.test.mjs`, `tests/module-switcher-*.test.mjs`, or anything this session touched. 2677 passing (up from 2604 baseline passing — +73 new tests, all green). |
| `npm run validate` | **exit 1, byte-identical output** | Diffed byte-for-byte against a `git stash`-isolated pre-session run of the same command — identical stdout+stderr, identical exit code. This session touches nothing `validate` reads. |
| `npm run coverage:rules` | exit 0 (91/91, 100%) | |
| `npm run build` | exit 0 | |
| `npm run verify:d4` | exit 0 | |
| `npm run check:imports` | exit 0 | |
| `npm run smoke:browser` | exit 0 | Extended script; see P6-009-smoke evidence above |
| `npm run smoke` | exit 0 | |

**No test name or progress-text sentence in this session's output uses "renders"/"executes"/
"spies"/"exercises" for DOM-dependent behavior.** Every source-asserted test states its ceiling in
an inline comment (and, for several sections, a dedicated "DOES NOT PROVE" test or comment block).
Package.json still declares zero `dependencies` and zero `devDependencies` — confirmed by direct
inspection after this session's edits.

**Smoke-script extension — before/after assertion counts, and every place it was extended (never
rewritten)**:
- Line count: 254 → ~296 (git diff: +84 insertions, **0 deletions** — confirmed via
  `git diff scripts/smoke-browser-unit-rejection.mjs | grep '^-' | grep -v '^---'` returning empty).
- All five original breaking-assertion sites (the two `import { assessPediatricAnemia }` specifier
  regexes, the two `assessPediatricAnemia(input, rules, candidates)` call-shape asserts in
  `loadExampleBody`/`submitBody`, and the dist `classification.anemiaStatus === 'present'` assert)
  confirmed present, unmodified, by content match after the edit.
- The `:4-15` header boundary comment confirmed byte-identical (`sed -n '4,15p'` before/after
  compared).
- Five extension points, each additive:
  1. A new paragraph appended immediately after the `:4-15` boundary comment (not inside it),
     describing the extension's own scope — the original text is untouched above it.
  2. Four new `assertRelativeModuleResolves(...)` calls for the four new app-surface files,
     appended after the pre-existing three.
  3. A new ~15-line sibling assertion block for `showModuleRefusal()`, inserted between the
     existing rejection-UI assertions and the `loadExampleBody` section.
  4. One new `assert.match` line appended after each of the two pre-existing
     `assessPediatricAnemia(input, rules, candidates)` asserts (in `loadExampleBody` and
     `submitBody`), checking the `assessModule(moduleAtStart, ...)` shape ALSO exists — the
     original asserts are untouched, not replaced.
  5. A new "built module-switcher graph" section appended after the existing rejection-catch test,
     importing `assessModule`/`isModuleSelectable` from the built `dist/src/` graph and running
     them for real, plus a second, separate boundary print statement (the original final
     `BROWSER-MODE BOUNDARY` print line is untouched, byte-identical, immediately below the new one
     — not replaced).

**Per-task summary**: see each task's `evidence:` field in the YAML frontmatter above
(`P6-001`..`P6-010`, `P6-009-smoke`, `P6-012`) for the specific tests written, what tier each is
(executed / source-asserted, per D-6), and what each explicitly does NOT prove.

**Both P6-010 tripwires actioned, kept strictly separate**: Tripwire A
(`tests/module-registry.test.mjs:20-24`, "a second module registers") fired at commit `263120b` and
sat unactioned since — corrected as pre-existing debt this session's P6-010 task closed, explicitly
NOT attributed to the spa-module-switcher-v1 feature. Tripwire B (`src/modules/registry.js:39-50`,
"a client-selectable moduleId surface actually ships") is fired BY this feature; the decision
(`DEFAULT_MODULE_ID` stays `'anemia'`) is recorded with E1 FR-14/R-8 and ADR-0009 cited by ID,
quoting ADR-0009's "The FR-14/R-8 lifting authority" section.

**Next steps**: a named human must perform P6-011 (all nine items) and append a signed, dated block
to this file before `P6-GATE` (task-completion-validator) and then `P6-KAREN` (karen Milestone 3)
can run. Neither gate is self-certifiable by this session.

### POST-REVIEW FIXES — response to P6-GATE CHANGES_REQUESTED + gpt-5.6-terra adversarial pass

P6-GATE (task-completion-validator) returned CHANGES_REQUESTED on phrasing-honesty grounds; a
gpt-5.6-terra adversarial pass separately found the harness narrower than it claimed in five
places. All eight items fixed below, same file boundaries as the original session (no new files,
no git operations). Files touched: `tests/module-switcher-eligibility.test.mjs`,
`tests/module-switcher-status-labels.test.mjs`. `tests/module-registry.test.mjs`,
`scripts/smoke-browser-unit-rejection.mjs`, `src/modules/registry.js` — untouched this pass (no
findings against them).

**Validator items (blocking) — all fixed:**

1. **Three DOM-behavior test-name renames.** `tests/module-switcher-eligibility.test.mjs` (P6-005
   Case 3): "…activateModule() renders the verbatim enum-sourced sentence…" →
   "…activateModule() source calls showModuleRefusal with the verbatim enum-sourced sentence…".
   `tests/module-switcher-status-labels.test.mjs` (P6-007 AC-6 #rules): "…renders an explicit
   empty state…" → "…source declares an explicit empty state…". (P6-007 AC-7 resilience): "…a
   missing manifest.title renders the moduleId…" → "…source declares that a missing
   manifest.title falls back to the moduleId…". Re-grepped both files' `test('...')` names for
   `renders|executes` (case-insensitive) after the renames: zero remaining hits.
2. **Self-certification headers verified true.** Eligibility file's own header claim ("Forbidden
   phrasing … is not used anywhere below") and status-labels' ("No test name uses
   'renders'/'executes' for DOM behavior") — both confirmed accurate by the same grep above,
   post-rename. No edit to the header text itself was needed; the renames made the pre-existing
   claim true rather than aspirational.
3. **Four dead imports removed + one overclaiming comment corrected.**
   `DEFAULT_MODULE_ID` (eligibility) was imported but only ever appeared inside regex/string
   literals, never as a live binding — removed from the import statement (`MODULE_IDS` alone
   remains, genuinely used). `PANEL_HEADER`, `HONESTY_BOUNDARY_DISCLOSURE`,
   `EVIDENCE_STALENESS_DISCLOSURE`, `MODULE_IDS` (status-labels) — same pattern, all four removed;
   `MODULE_STATUS_SENTENCES`/`getStatusSentence`/`UNKNOWN_STATUS_SENTINEL` confirmed genuinely
   used and kept. The comment above the "every real registered module's manifest status resolves"
   test claimed "MODULE_IDS + schema enum coverage above is the load-bearing claim" — factually
   wrong (the test iterates `schema.properties.status.enum`, never `MODULE_IDS`, which was never
   imported into that test's scope) — corrected to state plainly that the test iterates the
   schema enum only.

**Codex hardening items — all addressed; each with a seeded mutation self-test proving the
mechanism is not vacuous, per this phase's own standing rule:**

4. **Comment-decoy resistance for the source-location extractors.** Both files'
   `namedFunctionRange()`/`markerRange()` searched raw source text for a `function <name>(`/marker
   string, so a block- or line-comment decoy containing that exact text earlier in the file would
   have been matched instead of the real declaration. Added `stripCommentsPreservingOffsets()` (a
   same-length comment-blanking pass that never touches string/template contents) to both files;
   declaration/marker location is now found against the stripped copy, while the returned `body`
   still slices from the original source at the same offsets. Four new seeded-decoy self-tests (3
   in eligibility, 1 in status-labels) prove the real declaration is found and the decoy is never
   extracted as the body.
5. **Ordering coverage widened to all five `guardedRanges()` bodies.** The P6-012 ordering test
   previously asserted predicate-precedes-call ordering for only 3 of the 5 guarded bodies
   (activateModule, loadActiveModuleKb, the submit handler). Extended the SAME test to also assert
   it for `loadExample` and `onUseCase`, so all five bodies the file's own `guardedRanges()`
   enumerates carry an explicit ordering check in one place (loadExample's ordering was already
   separately proven in the P6-003(b) section; this closes the gap that P6-012 itself didn't
   individually cover it, and adds `onUseCase` coverage that existed nowhere before).
6. **AC-8 allow-list hardened against bracket/template access and MODULE_MANIFESTS aliasing.**
   `assertAllowListedManifestReads()` now also scans for `manifest[...]` bracket/template property
   access of any form — a literal-string key must be one of the allow-listed field names (bracket
   access to `approvedBy` is never sanctioned, dot-notation only); any dynamic/interpolated key
   fails outright. `assertGetManifestViewIsTheSoleManifestReader()` was widened from scanning only
   the literal substring `MODULE_MANIFESTS[` to scanning every bare occurrence of the
   `MODULE_MANIFESTS` identifier (comment-stripped) — an alias assignment
   (`const m = MODULE_MANIFESTS`) or a direct dot-notation field read
   (`MODULE_MANIFESTS.anemia.clinicalContentHash`) outside `getManifestView()` now fails; neither
   contained the literal text the old check looked for. Four new seeded self-tests (non-allow-
   listed bracket key, dynamic bracket key, bracket-form `approvedBy`, alias assignment, direct
   dot-notation read) prove each bypass is caught.
7. **FR-11 green-hue check widened on four axes.** (a) Space-form `rgb()`/`hsl()` (e.g.
   `rgb(46 125 50)`) were previously silently MIS-parsed as a single NaN component by a
   comma-only splitter — a real false-negative (a space-form green would have passed silently);
   rewrote the component parser to handle both forms identically (regression-guard test included),
   and added a small curated named-green keyword list (green, seagreen, forestgreen, limegreen,
   lime, springgreen, olivedrab, darkgreen, and 11 more). (b) An unresolved colour value (an
   undefined `var()`, or `color-mix()`/`currentColor`, both context-dependent and unresolvable
   statically) previously fell through `extractResolvedColors()`'s `unresolved` array UNCHECKED —
   `assertNoGreenState()` never looked at it, so an unresolvable colour silently passed. Now
   FAIL-CLOSED: any unresolved value in a color-bearing property is a hard failure. Making this
   safe required scoping colour extraction to an explicit `COLOR_BEARING_PROPERTIES` list
   (`color`/`background`/`border*`/`box-shadow`/etc.) — the un-scoped version would have
   false-failed on legitimate non-colour `var()` usage the widened selector set now also reaches
   (e.g. `border-radius: var(--radius)`, `box-shadow: var(--shadow)` — the latter's value is a
   composite offset+blur+colour definition, not a bare colour; the fix recursively resolves `var()`
   text and re-scans it for an embedded real colour, e.g. the `rgba(...)` inside `--shadow`'s own
   value, rather than requiring the WHOLE resolved value to itself be one hex/rgb token). (c)
   `site-overrides.css` is now scanned alongside `styles.css` (empty for these selectors today,
   confirmed by a separate grep, but the scan no longer silently depends on that staying true). (d)
   The selector filter was a hardcoded `/module-row|status-chip|module-status/` guess; replaced
   with `extractAppliedClassNames()`, which derives the actual class list from every literal
   `module-`/`status-`-prefixed class name found in `src/app.js` (static `class="..."` strings and
   `classList.add/toggle/contains(...)` calls) and `index.html` — tied to the real markup, not an
   author's guess at which selectors mattered. A sanity assertion confirms the derived set is
   substantial (≥15 classes) and contains the two classes the old hardcoded regex was built
   around, so the derivation itself can't silently degrade to near-empty. Five new seeded
   mutation self-tests cover: space-form rgb, space- and comma-form hsl, a bare named-green
   keyword, `color-mix()`, `currentColor`, and an undefined `var()` reference — each individually
   proven to fail the check. A CEILING comment records the explicit, honest scope limit: ~19 named
   greens (not all 148 CSS named colours — the other ~130 are non-green, so their omission isn't a
   green-hiding gap), and no `hwb()`/`lab()`/`lch()`/`oklch()` support (none appear in this
   codebase's stylesheets today).
8. **P6-012 DOM-state scan widened to 5 bodies and 4 more patterns, with an exact allow-list.**
   Previously scanned only 3 bodies (activateModule, loadActiveModuleKb, the submit handler)
   against a 4-pattern set. Now scans 5 (adding `selectModule()` — the literal "module-selection
   handler" by name — and the panel click listener, the actual DOM entry point) against an
   8-pattern set (added `.closest(`, `.matches(`, `.className`, `getAttribute(` — the last flagged
   for ANY argument, with no built-in exception, forcing a human to explicitly allow-list any
   future legitimate use the same way the three lines below are). The click listener legitimately
   touches DOM state on three lines (id extraction via `.closest()`, the FR-37(a) `row.disabled`
   presentation short-circuit, and `row.dataset.moduleId` forwarding) — each is now allow-listed
   by EXACT, byte-for-byte line content with its own comment explaining why it's safe (none of the
   three DECIDE eligibility; `activateModule()` re-derives it unconditionally downstream
   regardless), so any edit to those three lines OR any new DOM-state touch anywhere else in the
   listener fails. Two new seeded self-tests: one proves the four new patterns
   (getAttribute/closest/matches/className) are genuinely caught; one proves the allow-list itself
   is exact (a one-character change to an allow-listed line is detected as stale, not silently
   passed through). A CEILING comment states plainly that a constructed/dynamic attribute name
   (`el[computedName]`, `el.getAttribute('data-' + x)`) defeats regex-based scanning by design —
   this mechanism guards accidental regression and unsophisticated decoys, not a determined
   adversary rewriting `src/app.js` specifically to evade this test file.

**Re-verification after all fixes (delta-green posture unchanged):**

| Stage | Result |
|---|---|
| `npm test` | 26 known pre-existing failures (byte-identical name-set to the original session's baseline), 0 new. 2688 passing (up from 2677 — +11 net new tests across the two edited files after the hardening pass: several items added multiple seeded self-tests each). |
| `npm run validate` | exit 1, byte-identical output (re-diffed against the same `git stash`-isolated pre-session baseline) |
| `npm run build` | exit 0 |
| `npm run verify:d4` | exit 0 |
| `npm run check:imports` | exit 0 |
| `npm run smoke:browser` | exit 0 (script untouched this pass — no findings against it) |
| `npm run smoke` | exit 0 |

`tests/module-switcher-eligibility.test.mjs`: 38 tests (was 32). `tests/module-switcher-status-
labels.test.mjs`: 34 tests (was 29). `tests/module-registry.test.mjs`: unchanged at 12. All three
files green in isolation and in the full suite. No test name anywhere in either edited file uses
"renders"/"executes"/"spies"/"exercises" for DOM-dependent behavior (re-verified by grep after
every edit in this pass, not just once at the end).

Fill in when Phase 6 is fully complete (after P6-011/P6-GATE/P6-KAREN): key learnings, unexpected
challenges, recommendations for Phase 7 (documentation finalization).
