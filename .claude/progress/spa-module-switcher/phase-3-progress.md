---
type: progress
schema_version: 2
doc_type: progress
prd: spa-module-switcher
feature_slug: spa-module-switcher
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
phase_detail_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-3-5-ui.md
execution_model: batch-parallel
phase: 3
title: "SPA Module Switcher \u2014 Phase 3: Selector UI + Status Banner + ?module=\
  \ URL State"
status: completed
created: '2026-07-22'
updated: '2026-07-22'
started: '2026-07-23T00:30:00Z'
completed: null
commit_refs: []
pr_refs: []
overall_progress: 88
completion_estimate: on-track
total_tasks: 8
completed_tasks: 7
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
integration_owner: phase-owner
seam_tasks:
- P4-06
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P3-01
  description: "index.html selector markup \u2014 persistent rail, two labelled structural\
    \ groups (FR-1, FR-2 / R-1). Add the module-selector container as a persistent\
    \ rail rendering all four registered modules from listModules()/MODULE_IDS \u2014\
    \ no registered module is hidden \u2014 in two labelled structural groups: selectable,\
    \ and not-selectable-with-reason. Panel header rendered verbatim from the vocabulary\
    \ constant: \"These modules are not peers. Read each row.\" Grouping is what stops\
    \ \"disabled\" reading as \"temporarily unavailable\" (SQ-1 \xA75) \u2014 structural,\
    \ not a footnote. index.html supplies only the static container and header; rows\
    \ are rendered by P3-03.\nD-7 REVISION (decisions-block.md \xA711, operator override\
    \ 2026-07-22): form factor is the HEADER DROPDOWN (mockup variant B), not the\
    \ sidebar rail this description names \u2014 see the phase file's revised P3 preamble\
    \ and this file's Completion Notes. All structural-grouping and honesty constraints\
    \ below carried over unchanged; only the layout container changed. Implemented:\
    \ `#module-switcher` in `.header-actions` \u2014 collapsed toggle button (active\
    \ title + verbatim status chip, always visible) + expanded panel with `#module-switcher-panel-header`\
    \ (PANEL_HEADER by identifier) and two `.module-switcher-group` containers (`#module-row-list-selectable`\
    \ / `#module-row-list-not-selectable`), rows rendered by src/app.js (P3-03). Zero\
    \ module names/statuses/counts hardcoded in index.html.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P2-03
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  acceptance_criteria: 'Container present; header text comes from src/moduleStatusVocabulary.js
    by identifier, not written inline in index.html; two group elements exist with
    distinct labels; markup contains zero module names, statuses or counts hardcoded
    (all injected at render).

    '
- id: P3-02
  description: "styles.css \u2014 group + inert-row treatment using existing :root\
    \ tokens only (FR-11). Style the rail, the two group headers, and the inert-row\
    \ treatment reusing existing :root tokens and the established .safety-banner /\
    \ .tab-nav visual language. There is no green / success / approved visual state\
    \ \u2014 integrity-recorded uses the SAME severity treatment as the scaffolds\
    \ (D-3, FR-11). Ineligible rows must be distinguishable by more than colour or\
    \ hatching: the reason text is part of the row. Introduce no new colour token\
    \ that reads as \"good\".\nIMPLEMENTED: styles.css new section (end of file) \u2014\
    \ literal hex colours only, never var(--success)/var(--success-soft) (real, saturated\
    \ green once site-overrides.css's :root applies) and never var(--brand) (hue ~189\xB0\
    , cyan-adjacent \u2014 avoided out of caution, not because it measured green).\
    \ `.status-chip` is ONE class for all four enum values (#fff8e8 bg / #8a5a00 text\
    \ / #e5c978 border) \u2014 zero per-status colour differentiation, so integrity-recorded\
    \ cannot read as \"better\" than the scaffolds. `.module-row--inert` conveys inertness\
    \ via `disabled` semantics + visible reason text (`.module-row-reason`), not opacity\
    \ (`.module-row--inert:disabled { opacity: 1; }` is explicit). 375px non-clipping\
    \ via a dedicated `@media (max-width: 400px)` block collapsing the toggle to full\
    \ width and the panel to `left:0; width:100%`.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P3-01
  estimated_effort: 1.0 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - styles.css
  acceptance_criteria: 'No new token is added whose name or value reads as success/green/approved;
    the integrity-recorded row and the unsigned-stub rows share the same severity
    treatment class; the inert state is conveyed by text + disabled semantics, never
    by colour alone; mobile at 375px width does not clip the rail (AC-1 visual evidence
    requirement).

    '
  post_review_fix_2: "(2026-07-23, P3-GATE CHANGES_REQUESTED, VISUAL \u2014 found\
    \ in rendered-page inspection of dist/ in Chrome): the expanded panel's NOT-SELECTABLE\
    \ rows used `.module-row { display: flex; }` (row axis, default) with `.module-row-main`\
    \ and `.module-row-meta` both `flex: 1 1 auto` as a two-column split. At the panel's\
    \ `min(420px, 92vw)` width, a long title (e.g. \"Pediatric CBC Suite\" + chip\
    \ + FR-10 subtitle, stacked inside module-row-main) wrapped onto multiple lines\
    \ that rendered underneath/overlapping module-row-meta's engineLabel/counts/limitation/reason\
    \ text in the second column. The selectable anemia row (short title, one line)\
    \ did not exhibit it. FIXED by making `.module-row` a STACKED column (`flex-direction:\
    \ column`) \u2014 title-block (module-row-main) above detail-block (module-row-meta),\
    \ full width, never side-by-side \u2014 which removes the possibility of the collision\
    \ independent of title length or panel width, rather than tuning a minmax split\
    \ a longer future title could re-break. `.module-row-lock` moved from a third\
    \ flex column to `position: absolute` in the row's top-right corner (`.module-row--inert`\
    \ gained `padding-right: 2.1rem` so title/meta text never runs under it). A now-stale\
    \ `@media (max-width: 560px) { .module-row { flex-wrap: wrap; } }` override (a\
    \ no-op once flex-direction is column) was removed. Severity/no-green constraints\
    \ unchanged \u2014 every colour value in this block is still the same literal,\
    \ non-green hex from the original P3-02 pass. Panel scrolling (content taller\
    \ than the panel's max-height) intentionally unchanged, per the reviewer's explicit\
    \ instruction not to touch it. Re-verified: `npm run build && npm run check:imports\
    \ && npm run smoke:browser && npm run smoke` all exit 0; the 3 targeted node --test\
    \ suites still 41/41; `npm test` still exactly the same 26 known failures (byte-identical\
    \ test-name diff against the pre-fix baseline), zero new.\n"
- id: P3-03
  description: "src/app.js \u2014 render module rows from the frozen manifest map\
    \ (FR-3 / R-P2). Render each row from src/moduleManifests.js: manifest.title,\
    \ manifest.engineLabel verbatim, the module's own rule/candidate counts, and its\
    \ status chip (manifest.status verbatim, FR-7). Scaffold rows additionally show\
    \ the module's own limitations() notice text. No new prose is invented for any\
    \ module's capability. Group membership computed ONCE by the P2-03 predicate.\
    \ R-P2 handling: a module.json missing an optional envelope field renders required\
    \ fields only, never undefined/empty-label; a MODULE_IDS entry absent from the\
    \ manifest map renders in the not-selectable group with the FR-17 refusal reason,\
    \ never silently dropped.\nIMPLEMENTED: moduleRowMarkup() in src/app.js, driven\
    \ by getManifestView()'s D-6 allow-list (id/title/status/knowledgeBaseVersion/evidenceReviewedThrough/approvedByClause\
    \ only \u2014 every other manifest field, incl. clinicalContentHash/governanceHash/module_topic/etc.,\
    \ is structurally unreachable through it) and MODULE_IDS iteration (renderModuleSwitcherRows()).\
    \ engineLabel read from getModule(moduleId).manifest.engineLabel (module hooks,\
    \ not module.json) per the task's own wording. Counts come from a dedicated, side-effect-free\
    \ loadModuleRowCounts() using literal fetch() specifiers distinct from src/moduleKbLoaders.js#loadModuleKb\
    \ (which stays reserved for the active-module, selectable-only load path) \u2014\
    \ verified via `node -e` that all 4 modules' real rules.json/candidates.json counts\
    \ match (anemia 91/26, cbc_suite_v1 4/1, growth_suite_v1 0/0, kidney_suite_v1\
    \ 0/0). Scaffold limitations() text sourced via hooks.deriveFacts({})/hooks.limitations(facts)\
    \ (verified safe for all 4 modules \u2014 cbc_suite_v1 delegates to anemia's real\
    \ deriveFacts, which tolerates an empty input object without throwing). R-P2 resilience\
    \ implemented: missing view.title falls back to the literal moduleId; a MODULE_IDS\
    \ entry absent from MODULE_MANIFESTS renders in the not-selectable group with\
    \ an FR-17-shaped reason (dead code today \u2014 MODULE_MANIFESTS and MODULE_IDS\
    \ are both derived from the same 4 real packages \u2014 but not silently dropped\
    \ if it ever drifts). grep confirms no invented capability prose: every clinician-facing\
    \ string traces to src/moduleStatusVocabulary.js, MODULE_MANIFESTS, or a module's\
    \ own hooks.\nPOST-REVIEW FIX 1 (2026-07-23, P3-GATE CHANGES_REQUESTED, CRITICAL/honesty\
    \ defect): the first pass rendered the cbc_suite_v1 row's limitationText from\
    \ `hooks.limitations(hooks.deriveFacts ({}))` unconditionally for every non-selectable\
    \ module. Since modules/cbc_suite_v1/index.js: 35,38 delegates deriveFacts/limitations\
    \ straight to the anemia module (D-1/SQ-3 F9's own delegation, not a copy), this\
    \ rendered ANEMIA'S fact-shaped caveat (\"Built-in CBC reference intervals are\
    \ not validated for this age...\") under the CBC Suite label \u2014 a masquerade\
    \ reading as \"CBC evaluated something,\" the exact hazard D-1/FR-4 exists to\
    \ close. Fixed by adding moduleReportsNotYetImplemented(hooks) (mechanical, no\
    \ module-id literal; reused as-is for P4-03's FR-16 Case 2 detection): tier 1\
    \ reads a static `hooks.notYetImplemented === true` descriptor flag (reserved\
    \ for a future module, none declare it today); tier 2 falls back to `summarize(deriveFacts({}))`\
    \ and checks `notYetImplemented === true` (modules/growth_suite_v1/index.js:46-51)\
    \ or `status === 'not_yet_implemented'` (modules/kidney_suite_v1/index.js:37-42).\
    \ moduleRowMarkup() now renders limitationText ONLY when this helper returns true\
    \ for the module \u2014 cbc_suite_v1's delegated summarize() returns anemia's\
    \ real classification shape (neither marker), so its line is now suppressed; the\
    \ vocabulary status sentence (\"No assessment can be produced from this module\"\
    ) already carries the true statement for it. `modules/**` untouched. Verified\
    \ via `node -e` importing the real module hooks through src/modules/registry.js\
    \ + src/moduleEligibility.js and replicating moduleRowMarkup()'s exact gating\
    \ logic: anemia limitationText=\"\" (selectable, unaffected); cbc_suite_v1 limitationText=\"\
    \" (was previously anemia's caveat \u2014 now suppressed); kidney/growth unchanged,\
    \ each keeps its own self-authored not-yet-implemented text.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P3-01
  - P2-03
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: 'All 4 rows render with title, verbatim engineLabel, per-module
    counts and verbatim status chip; scaffold rows show their own limitations() text;
    a synthetic manifest missing an optional field renders without undefined/empty-label
    artifacts; a synthetic MODULE_IDS entry absent from the manifest map appears in
    the not-selectable group; grep confirms no capability prose was authored for any
    module.

    '
- id: P3-04
  description: "Status banner render \u2014 verbatim status, derived approvedBy clause,\
    \ honesty boundary, staleness disclosure (FR-7, FR-9, FR-13, FR-34). Render the\
    \ active module's status banner from src/moduleStatusVocabulary.js by identifier\
    \ \u2014 no status text written inline. Carries: the verbatim enum status chip;\
    \ the universal FR-9 clause for EVERY module including anemia, derived from approvedBy.length\
    \ === 0; the FR-13 honesty-boundary sentence IN THE PANEL, not a tooltip; the\
    \ FR-34 non-enforcement disclosure adjacent to evidenceReviewedThrough, not in\
    \ a tooltip. The FR-10 subtitle renders only where status === 'unsigned-stub'.\
    \ Prohibited (FR-31/FR-32): any hash, \"integrity verified\", \"content unmodified\"\
    , approval badge, checkmark, or \"verified\"/\"approved\"/\"released\" wording.\n\
    IMPLEMENTED: renderModuleStatusBanner() in src/app.js, targeting the new `#module-status-banner`\
    \ (role=\"alert\") placed inside `<main>`, OUTSIDE every `.tab-panel` \u2014 persists\
    \ across tab switches (main column, not the dropdown; mockup B is \"dropdown PLUS\
    \ banner\"). Renders: FR-7 verbatim status chip; FR-8 full canonical sentence\
    \ via getStatusSentence(status), referenced by identifier; FR-9 clause via a LIVE\
    \ call to deriveApprovedByClause(manifest.approvedBy) on every render (not baked-in\
    \ text) so the banner honestly reflects the actual approvedBy content, not merely\
    \ the common empty case; FR-10 subtitle toggled by `hidden` strictly on status\
    \ === 'unsigned-stub'; FR-13 HONESTY_BOUNDARY_DISCLOSURE and FR-34 EVIDENCE_STALENESS_DISCLOSURE\
    \ both rendered as plain paragraph text in the panel (no title=/tooltip attribute\
    \ anywhere in this file). grep of src/app.js/index.html for hash/\"integrity verified\"\
    /\"content unmodified\"/checkmark/ \"verified\"/\"approved\"/\"released\" tokens:\
    \ zero hits outside the vocabulary module's own negated/quoted usage (e.g. \"\
    has not verified it\").\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P3-01
  - P1-02
  estimated_effort: 1.25 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  - index.html
  acceptance_criteria: 'Banner renders correctly for all 4 statuses; every string
    is referenced by identifier from the vocabulary module; the FR-9 clause appears
    on the anemia banner too; the honesty-boundary sentence and staleness disclosure
    are in the panel/adjacent to the date, not in title=/tooltip attributes; the FR-10
    subtitle appears only under unsigned-stub; grep of rendered output and source
    for hash/approval/release tokens returns zero hits.

    '
- id: P3-05
  description: "?module=<id> URL state \u2014 read, validate, write (FR-20, FR-21,\
    \ FR-22). On load, read ?module= and validate with isRegisteredModule() (src/modules/registry.js:75).\
    \ Absent \u2192 DEFAULT_MODULE_ID. Selecting a module writes ?module=<id> via\
    \ history.replaceState, preserving the current #tab hash. A value that is unregistered\
    \ or ineligible produces an explicit refusal naming the requested id (implemented\
    \ in P4-07), never a silent substitution and never a silent fallback to anemia.\
    \ No localStorage/sessionStorage/cookie read or written (FR-24).\nIMPLEMENTED:\
    \ readModuleIdFromUrl() reads `?module=`; absent -> DEFAULT_MODULE_ID; present\
    \ -> explicitly validated via `isRegisteredModule(requested)` (src/modules/registry.js:75)\
    \ \u2014 the canonical, single source of registration truth; never a proxy for\
    \ it such as Object.hasOwn(MODULE_MANIFESTS, ...). Registered -> returned as-is\
    \ (still subject to isModuleSelectable() downstream, which may find it ineligible/inert\
    \ \u2014 that path is intentional). Unregistered -> ALSO returned as-is (a console.warn\
    \ records that the id failed isRegisteredModule()), never substituted with DEFAULT_MODULE_ID\
    \ (D-4 \"never a silent fallback to anemia\"). initialize() calls this before\
    \ loadActiveModuleKb(), so eligibility is decided from the manifest before any\
    \ KB fetch. writeModuleUrlParam() writes `?module=<id>` via history.replaceState\
    \ while preserving window.location.hash (the P3-06 pairing).\nPOST-REVIEW FIX\
    \ (2026-07-23, coordinator-flagged): the first implementation pass imported isRegisteredModule\
    \ but never called it \u2014 readModuleIdFromUrl relied only on the \"return requested,\
    \ never substitute\" invariant, and downstream rendering incidentally distinguished\
    \ registered/unregistered via Object.hasOwn(MODULE_MANIFESTS, ...) inside getManifestView(),\
    \ which is equivalent for today's 4 real modules (MODULE_MANIFESTS keys === MODULE_IDS,\
    \ pinned by tests/module-status-vocabulary.test.mjs) but is not the sanctioned\
    \ check P3-05's AC and P6-006 name. Fixed by wiring an explicit `if (isRegisteredModule\
    \ (requested)) return requested;` branch into readModuleIdFromUrl itself, with\
    \ the function's own comment corrected to describe that branch rather than merely\
    \ asserting it. Re-verified: `npm run build && npm run check:imports && npm run\
    \ smoke:browser && npm run smoke` all exit 0; the 3 targeted node --test suites\
    \ still 41/41 pass.\nDEVIATION (recorded, in-scope per this task's own AC \u2014\
    \ see reply): P3-05's own AC tests only the registered-ineligible case (selects\
    \ the row, banner shows its status, no assessment) and the absent case; it does\
    \ not test the truly-unregistered-id case. Per the explicit governing instruction\
    \ (\"Full refusal for unregistered/ineligible is Phase 4 \u2014 do not build it\
    \ yet, but never silently substitute a module\"), an unregistered id is kept verbatim\
    \ in activeModuleId (never rewritten to anemia) and rendered via a minimal, honest,\
    \ P3-scoped placeholder (\"Unregistered module: <id>\") in both the collapsed\
    \ control and the banner \u2014 explicitly NOT P4-07's full FR-21 refusal state\
    \ (no showModuleRefusal call, no results/audit invariant sequence), so as not\
    \ to collide with P4-01's seam. grep for localStorage/sessionStorage/ document.cookie\
    \ across src/app.js and index.html: zero hits.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P3-03
  - P2-03
  estimated_effort: 0.75 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: "?module=cbc_suite_v1 on load selects that row (inert) and\
    \ does not fall back to anemia; absent param \u2192 DEFAULT_MODULE_ID; selection\
    \ writes the param while the #tab hash survives; grep for localStorage/sessionStorage/document.cookie\
    \ across app-surface files returns zero hits.\n"
- id: P3-06
  description: "Fix switchTab's history.replaceState to preserve the query string\
    \ (FR-23 / R-7). src/app.js:457 currently drops the query string via `history.replaceState(null,\
    \ '', \\`#${tab}\\`)`, silently discarding ?module=. Rewrite it to preserve window.location.search\
    \ while updating only the hash. Deliberately its own task because R-7's likelihood\
    \ is High and it is trivially missed inside a larger UI change.\nIMPLEMENTED:\
    \ `window.history.replaceState(null, '', \\`${window.location.search}#${resolvedTab}\\\
    `)` replaces the prior bare `` `#${resolvedTab}` `` form \u2014 query string now\
    \ preserved on every hash sync. Hash-routing logic (validTabs/resolvedTab/tab-button/tab-panel\
    \ toggling) unchanged.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P3-05
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: 'After selecting a non-default module and switching tabs, window.location.search
    still contains ?module=<id>; the hash still routes tabs exactly as before (existing
    hash-routing behaviour unchanged); P6-006 asserts the round-trip.

    '
- id: P3-07
  description: "FR-37 \u2014 programmatic inertness + reason-in-accessible-name (a11y,\
    \ role=\"alert\", keyboard nav). THIS IS NOW FR-37, not NFR prose: the karen gate\
    \ found the inertness mechanism had no requirement and no AC pointing at it. Status\
    \ banner uses the existing role=\"alert\" pattern (.safety-banner, index.html:41-43);\
    \ the module list is fully keyboard-navigable and focus is not trappable inside\
    \ an inert row; ineligible rows are programmatically disabled (a real disabled/aria-disabled\
    \ + non-activatable state, not merely dimmed) so assistive technology reports\
    \ them unavailable; each ineligible row's reason text is part of its accessible\
    \ name, never colour/opacity/hatching alone. Add a code comment recording that\
    \ `disabled` is a PRESENTATION guarantee, NOT the security boundary \u2014 a devtools\
    \ user can delete it; the gate that survives that is the FR-6 predicate inside\
    \ the handlers (AC-11 / P6-012).\nIMPLEMENTED: `#module-status-banner` reuses\
    \ `role=\"alert\"` (index.html, existing `.safety-banner` pattern). Every inert\
    \ row is a real `<button disabled aria-disabled=\"true\">` (non-focusable, non-activatable\
    \ \u2014 a11y tree reports it unavailable), never merely dimmed (`.module-row--inert:disabled\
    \ { opacity: 1; }` in styles.css makes this explicit). Reason text is BOTH visible\
    \ (`.module-row-reason` span, rendered text) AND in the accessible name (`aria-label`\
    \ on the button combines title + status + reason) \u2014 never colour/opacity/hatching\
    \ alone. Focus order is the natural DOM order of `.module-row` buttons inside\
    \ the two group containers (selectable group first) \u2014 disabled buttons are\
    \ natively skipped by the browser's tab sequence, which is standard, expected\
    \ behaviour, not a trap. Escape closes the expanded panel and returns focus to\
    \ the toggle button (`switcherRoot` keydown listener); a document click-outside\
    \ listener also closes it (additive, not a substitute). AC-11 GROUNDWORK: the\
    \ isModuleSelectable() predicate is re-checked inside selectModule(), the submit\
    \ handler, and loadExample() \u2014 not merely via the `disabled` attribute \u2014\
    \ each guard carries a code comment explicitly naming AC-11 and stating that `disabled`\
    \ is presentation only. Every inert-row branch of moduleRowMarkup() also carries\
    \ that same code comment.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P3-01
  - P3-03
  - P3-04
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  - src/app.js
  verifies_ac:
  - AC-1
  acceptance_criteria: 'Banner carries role="alert"; every row is keyboard-reachable
    and ineligible rows are announced as disabled; each ineligible row''s accessible
    name includes its reason text; no colour-only state conveyance; focus order is
    linear through the rail; a code comment records that `disabled` is not the gate
    and names AC-11.

    '
- id: P3-GATE
  description: "task-completion-validator gate. Verify the Phase 3 exit gate: banner\
    \ renders all 4 statuses; role=\"alert\" present; keyboard-navigable. Reject if\
    \ any status string is inline in index.html/src/app.js, if CBC Suite renders as\
    \ selectable (mockup divergence), if a green/approved state exists, or if switchTab\
    \ still drops the query string.\nVERDICT (2026-07-23): CHANGES_REQUESTED \u2014\
    \ 2 findings, both addressed this session (see the \"POST-REVIEW FIX 1\"/\"post_review_fix_2\"\
    \ notes on P3-03/P3-02 above): (1) CRITICAL \u2014 cbc_suite_v1 row rendered anemia's\
    \ delegated limitations() text under the CBC label (D-1/SQ-3 F9 masquerade hazard);\
    \ (2) VISUAL \u2014 not-selectable rows' two-column layout let a long title collide\
    \ with the detail column at the panel's 420px width. A third finding \u2014 src/app.js's\
    \ algorithm-explorer onUseCase callback (`assessPediatricAnemia` call, ~line 1027)\
    \ has no isModuleSelectable guard, the one remaining unguarded call site \u2014\
    \ was explicitly TRACKED FOR P4, not fixed here: P4-01/ AC-11 must close it (no\
    \ assess() call site outside a predicate-guarded body), and P5-01 additionally\
    \ degrades the #algorithm tab for non-anemia modules. Re-verified after both fixes:\
    \ build/check:imports/smoke:browser/smoke all exit 0; 3 targeted node --test suites\
    \ 41/41; npm test exactly the same 26 known failures, byte-identical test-name\
    \ diff, zero new.\n"
  status: pending
  assigned_to:
  - task-completion-validator
  provider: claude
  dependencies:
  - P3-01
  - P3-02
  - P3-03
  - P3-04
  - P3-05
  - P3-06
  - P3-07
  estimated_effort: "\u2014"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: All exit-gate criteria pass; recorded in phase progress note.
parallelization:
  batch_1:
  - P3-01
  batch_2:
  - P3-02
  - P3-03
  batch_3:
  - P3-04
  batch_4:
  - P3-05
  batch_5:
  - P3-06
  batch_6:
  - P3-07
  batch_7:
  - P3-GATE
  critical_path:
  - P3-01
  - P3-03
  - P3-04
  - P3-05
  - P3-06
  - P3-GATE
  estimated_total_time: "~2.5\u20133 engineer-days (8 pts)"
  serialization_constraint: "SHARED-FILE OWNERSHIP \u2014 do not re-merge these batches.\
    \ P3-03..P3-07 all write src/app.js (P3-04 and P3-07 also write index.html), and\
    \ the dev-execution rule is one agent per file, no parallel edits to the same\
    \ file. Batches 3\u20136 are therefore single-task by construction, not by oversight.\
    \ The only genuinely parallel pair in this phase is batch_2 (P3-02 \u2192 styles.css,\
    \ P3-03 \u2192 src/app.js), whose target_surfaces are disjoint. A future orchestrator\
    \ that \"optimizes\" batches 3\u20136 back into parallel Task() calls reintroduces\
    \ concurrent writes to src/app.js.\n"
blockers:
- id: BLOCKER-PHASE-DEP
  title: Phase 3 cannot open until Phase 2 exit gates (P2-GATE, P2-KAREN) both pass
  severity: high
  blocking:
  - P3-01
  resolution: 'Wait for .claude/progress/spa-module-switcher/phase-2-progress.md P2-GATE
    and P2-KAREN to both complete.

    '
  created: '2026-07-22'
success_criteria:
- id: SC-1
  description: All 4 modules render in two labelled structural groups under the verbatim
    panel header
  status: completed
- id: SC-2
  description: CBC Suite renders inert, superseding both mockups (D-1 / FR-4)
  status: completed
- id: SC-3
  description: Banner renders correctly for all 4 enum statuses; every string referenced
    by identifier from src/moduleStatusVocabulary.js
  status: completed
- id: SC-4
  description: FR-9 approvedBy clause renders on every module including anemia
  status: completed
- id: SC-5
  description: Honesty-boundary sentence and staleness disclosure are in-panel/adjacent,
    never tooltips
  status: completed
- id: SC-6
  description: Zero hash / 'integrity verified' / approval-badge / green-state surfaces
    (FR-31, FR-32, FR-11)
  status: completed
- id: SC-7
  description: ?module= round-trips and survives a tab switch (src/app.js:457 fixed)
  status: completed
- id: SC-8
  description: No localStorage/sessionStorage/cookie read or written
  status: completed
- id: SC-9
  description: "FR-37: role=\"alert\", keyboard-navigable, ineligible rows programmatically\
    \ disabled with the reason in the accessible name, plus a comment recording that\
    \ disabled is presentation and not the gate (AC-11). VERIFIED BY P6-011 item (9)\
    \ \u2014 the human keyboard/accessible-name pass \u2014 and by nothing else; AC-11/P6-012\
    \ cover FR-6 and explicitly disclaim FR-37"
  status: pending
  note: Implemented and self-reviewed this phase (see P3-07 task note); formal sign-off
    is P6-011's human step, not automatable here (D-6).
- id: SC-10
  description: "AC-1 screenshots (\u22651440px AND 375px, both groups, all four rows)\
    \ captured and reviewed BY A PERSON at P6-011 \u2014 no task here automates capture\
    \ (D-6 / PRD \xA711a)"
  status: pending
  note: "Not this phase's job by design \u2014 no task in Phase 3 automates capture;\
    \ deferred to P6-011."
files_modified:
- index.html
- styles.css
- src/app.js
notes: "Wave 3 \u2014 depends on Phase 2 complete (both P2-GATE and P2-KAREN). **`integration_owner:\
  \ phase-owner`** \u2014 declared jointly on this phase and Phase 4 because both\
  \ write src/app.js and index.html (rule R-P3). The seam task proving they do not\
  \ race is **P4-06** (in Phase 4's tracking file, not this one). Form factor (OQ-1)\
  \ \u2014 REVISED 2026-07-22 by decisions-block.md \xA711 (D-7 operator override),\
  \ superseding this note's original \"persistent sidebar rail, mockup variant A\"\
  \ resolution: implemented as the HEADER DROPDOWN (mockup variant B, variant-b-dropdown-plus-banner.png)\
  \ \u2014 a persistent collapsed toggle in `.header-actions` always showing the active\
  \ module's title + verbatim status chip, expanding to a panel with the two labelled\
  \ structural groups. Design mockups remain non-binding for behavior (PRD \xA714)\
  \ \u2014 two known divergences were NOT copied: CBC Suite renders inert like the\
  \ other two scaffolds (superseded by D-1/FR-4 \u2014 mockup B's own divergence,\
  \ per the D-7 note itself, is rendering CBC without the lock/inert affordance the\
  \ growth/kidney rows carry), and the unsigned-stub subtitle renders only where `status\
  \ === 'unsigned-stub'` (FR-10), never as a general device."
---

# spa-module-switcher — Phase 3: Selector UI + Status Banner + `?module=` URL State

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-3-progress.md -t P3-01 -s completed
```

---

## Objective

Build the persistent-rail selector UI, the per-module status banner, and `?module=` URL state —
the presentation layer over Phase 2's seams. Renders all four modules in two labelled structural
groups, with every clinician-facing string sourced from `src/moduleStatusVocabulary.js` by
identifier, never written inline.

**Duration**: ~2–2.5 engineer-days · **Dependencies**: Phase 2 complete (wave 3) ·
**`integration_owner`**: `phase-owner` (shared with Phase 4 — both write `src/app.js` and
`index.html`) · **Exit gate**: banner renders all 4 statuses; a11y `role="alert"`;
keyboard-navigable.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P3-01 | `index.html` selector markup — header dropdown, two groups (D-7) | general-purpose (UI engineer¹) | sonnet/adaptive | claude | completed | P2-03 |
| P3-02 | `styles.css` — group + inert-row treatment | general-purpose (UI designer¹ + UI engineer¹) | sonnet/adaptive | claude | completed | P3-01 |
| P3-03 | `src/app.js` — render module rows from frozen manifest map | general-purpose (UI engineer¹) | sonnet/adaptive | claude | completed | P3-01, P2-03 |
| P3-04 | Status banner render | general-purpose | sonnet/adaptive | claude | completed | P3-01, P1-02 |
| P3-05 | `?module=<id>` URL state — read, validate, write | general-purpose | sonnet/adaptive | claude | completed | P3-03, P2-03 |
| P3-06 | Fix `switchTab`'s `history.replaceState` (R-7) | general-purpose | sonnet/adaptive | claude | completed | P3-05 |
| P3-07 | Accessibility — `role="alert"`, keyboard nav | general-purpose | sonnet/adaptive | claude | completed | P3-01, P3-03, P3-04 |
| P3-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | pending | P3-01..P3-07 |

¹ **Agent-name substitution**: `ui-engineer-enhanced`/`ui-designer` are not registered in this
project; dispatched as `general-purpose` with the role descriptor retained.

---

## Orchestration Quick Reference

### Batch 1 (after Phase 2 gates)

```
Task("general-purpose", "P3-01: index.html selector markup — persistent rail, two labelled
structural groups (FR-1/FR-2/R-1). Render all four registered modules from
listModules()/MODULE_IDS in two groups: selectable, and not-selectable-with-reason. Verbatim
panel header from the vocabulary constant. index.html supplies only the static container/header
— rows render in P3-03. See plan §Phase 3, P3-01.")
```

### Batch 2 (after P3-01)

```
Task("general-purpose", "P3-02: styles.css group + inert-row treatment using existing :root
tokens only (FR-11). No green/success/approved visual state anywhere —
integrity-recorded shares the same severity class as the scaffolds. Ineligible rows
distinguishable by text, not colour alone. No clipping at 375px. See plan §Phase 3, P3-02.")

Task("general-purpose", "P3-03: src/app.js — render module rows from src/moduleManifests.js
(FR-3/R-P2). manifest.title, engineLabel verbatim, per-module counts, status chip verbatim;
scaffold rows show limitations() text. No new capability prose invented. R-P2 resilience:
missing optional field renders required-only, no undefined; MODULE_IDS entry absent from
manifest map renders not-selectable with FR-17 reason. See plan §Phase 3, P3-03.")
```

> **Serialization constraint — shared-file ownership.** `P3-03`..`P3-07` all write `src/app.js`
> (`P3-04`/`P3-07` also write `index.html`). The dev-execution rule is **one agent per file, no
> parallel edits to the same file**, so batches 3–6 each carry exactly one `Task()` call **by
> construction, not by oversight**. Only `batch_2` is genuinely parallel (`styles.css` vs.
> `src/app.js` — disjoint `target_surfaces`). Do not merge batches 3–6 back into parallel dispatch.

### Batch 3 (after P3-01/P3-03) — single task, `src/app.js`

```
Task("general-purpose", "P3-04: Status banner render (FR-7/FR-9/FR-13/FR-34). Every string by
identifier from src/moduleStatusVocabulary.js. FR-9 clause on EVERY module including anemia.
Honesty-boundary sentence in the panel, not a tooltip. Staleness disclosure adjacent to the
date. FR-10 subtitle only under unsigned-stub. Zero hash/approval/release wording. See plan
§Phase 3, P3-04.")
```

### Batch 4 (after P3-04) — single task, `src/app.js`

```
Task("general-purpose", "P3-05: ?module=<id> URL state — read/validate/write (FR-20/21/22). Read
on load, validate with isRegisteredModule(); absent → DEFAULT_MODULE_ID. Write via
history.replaceState preserving #tab hash. Unregistered/ineligible → explicit refusal (P4-07
implements the render). No localStorage/sessionStorage/cookie. See plan §Phase 3, P3-05.")
```

### Batch 5 (after P3-05) — single task, `src/app.js`

```
Task("general-purpose", "P3-06: Fix switchTab's history.replaceState to preserve the query
string (FR-23/R-7). src/app.js:457 currently drops ?module= on tab switch. Rewrite to preserve
window.location.search while updating only the hash. See plan §Phase 3, P3-06.")
```

### Batch 6 (after P3-06) — single task, `src/app.js` + `index.html`

```
Task("general-purpose", "P3-07: Accessibility — role=\"alert\", keyboard nav, programmatic
disabling. Banner carries role=\"alert\"; module list fully keyboard-navigable; ineligible rows
programmatically disabled with reason in the accessible name, not colour-only. No focus traps.
See plan §Phase 3, P3-07.")
```

### Gate (after all tasks complete)

```
Task("task-completion-validator", "P3-GATE: Verify Phase 3 exit gate for spa-module-switcher —
banner renders all 4 statuses; role=\"alert\" present; keyboard-navigable. Reject if any status
string is inline, if CBC Suite renders selectable, if a green/approved state exists, or if
switchTab still drops the query string.")
```

---

## Quality Gates

- [x] All 4 modules render in two labelled structural groups under the verbatim panel header
- [x] CBC Suite renders **inert**, superseding both mockups (D-1 / FR-4)
- [x] Banner renders correctly for all 4 enum statuses; every string referenced by identifier from `src/moduleStatusVocabulary.js`
- [x] FR-9 approvedBy clause renders on **every** module including `anemia`
- [x] Honesty-boundary sentence and staleness disclosure are in-panel/adjacent, never tooltips
- [x] Zero hash / "integrity verified" / approval-badge / green-state surfaces (FR-31, FR-32, FR-11)
- [x] `?module=` round-trips and survives a tab switch (`src/app.js:457` fixed)
- [x] No `localStorage`/`sessionStorage`/cookie read or written
- [x] **FR-37**: `role="alert"`, keyboard-navigable, ineligible rows programmatically disabled with the reason in the accessible name, plus a code comment recording that `disabled` is presentation and not the gate (AC-11) — implemented and self-reviewed this phase; formal **verification is `P6-011` item (9)** (human keyboard/accessible-name pass) and by nothing else; `AC-11`/`P6-012` cover FR-6 and disclaim FR-37
- [ ] AC-1 screenshots (≥1440px **and** 375px, both groups, all four rows) captured and reviewed **by a person** at **P6-011** — no task here automates capture (D-6 / PRD §11a); **not this phase's job by design**

---

## Implementation Notes

### Architectural Decisions

- **`integration_owner: phase-owner`** carries both this phase's banner/selection state and Phase
  4's refusal state, so no one hands off a half-built state machine. The seam task proving the two
  halves don't race is **P4-06**.
- **Form factor (OQ-1) — REVISED by D-7 (decisions-block.md §11, operator override, 2026-07-22):**
  header dropdown (mockup variant B), superseding this note's original "persistent sidebar rail,
  mockup variant A." Implemented as `#module-switcher` in the header's `.header-actions`: a
  collapsed toggle button that always shows the active module's title + verbatim status chip
  (the FR-30/AC-7 in-session reminder), expanding to `#module-switcher-panel` with the verbatim
  `PANEL_HEADER` and the two labelled structural groups. See the reply/Completion Notes for the
  full mapping.
- **The status banner (P3-04) lives inside `<main>`, outside every `.tab-panel`** — a deliberate
  choice beyond the phase file's literal wording ("stays in the main column"): placing it outside
  the tab sections means a clinician sees the active module's status regardless of which tab
  (`#algorithm`/`#evidence`/`#rules`/`#audit`) is open, not only on `#assessment`. This reads as
  the more honest interpretation of "main column, not dropdown" and does not conflict with mockup
  B's "dropdown PLUS banner" framing (the mockup itself is layout-only, non-binding for placement
  scope).
- **AC-11 groundwork implemented as real guards, not documentation-only.** `isModuleSelectable
  (activeModuleId)` is re-checked inside `selectModule()`, the `submit` handler, and `loadExample()`
  — each guard sits ahead of any `assessPediatricAnemia`/KB-load call and carries a code comment
  naming AC-11 and stating that the `disabled` attribute is presentation only. This intentionally
  goes beyond "groundwork" into functioning fail-closed behavior for the current single-selectable-
  module state, without building P4's named `showModuleRefusal` function or its FR-19 invariant
  sequence — Phase 4 owns that.

### Deviations from the phase-file task prose (recorded, in-scope)

1. **P3-05's unregistered-`?module=` interim behavior.** The phase file's task table cites the
   general PRD FR-21 language ("unregistered or ineligible → explicit refusal naming the id");
   the governing task instruction for this execution explicitly scoped that OUT of Phase 3 ("do
   not build it yet") while also prohibiting a silent fallback to `anemia`. Resolution: an
   unregistered id is kept verbatim in `activeModuleId` and rendered through a minimal, honest,
   clearly-commented placeholder ("Unregistered module: `<id>`") in both the collapsed control and
   the banner — never `showModuleRefusal` (that name/shape belongs to P4-01), never a fallback to
   `anemia`. P3-05's own AC only tests the registered-ineligible and absent-param cases; the
   unregistered case is not covered by that AC and is explicitly P4-07's.
2. **Row rule/candidate counts use a dedicated fetch path, not `loadModuleKb`.** The governing
   instructions restrict `loadModuleKb`/`assessModule`/`assess` to modules passing
   `isModuleSelectable`. Since FR-3 requires all 4 rows (including the 3 inert ones) to show their
   own counts, a separate, side-effect-free `loadModuleRowCounts()` fetches all 8 files with
   literal specifiers (verified stamped with `?v=` in `dist/` — same `build-static.mjs:148` regex
   coverage `moduleKbLoaders.js` gets) and only ever writes to a local display cache, never to
   `rules`/`candidates`.
3. **`--brand` avoided in module-row/status-chip selectors even though it likely isn't green.**
   `--brand`'s resolved value (`#0b7285` under `site-overrides.css`'s `:root`) computes to hue
   ≈189° (cyan, past the green band), which should clear a reasonable green-hue-band check — but
   since P6-004/P6-008's exact hue-band definition isn't available to this phase, the selectable
   row's accent uses a hardcoded, unambiguously-blue literal (`#245b8a` / `#edf5fc` / `#b9d3e9`,
   hue ≈207°) instead, at zero functional cost.

### Known Gotchas

- Design mockups (`docs/dev/designs/mockups/spa-module-switcher/`) are exploratory/layout-only —
  **non-binding for behavior**. Mockup B's own divergence (not the superseded A/C divergence) was
  the one to guard against here: it renders the CBC Suite row without the lock/inert affordance
  the growth/kidney rows carry. Implemented: all three non-`integrity-recorded` rows (including
  CBC Suite) are inert, `disabled`, and carry the lock glyph + reason text identically.
- P3-06 exists as its own task specifically because R-7's likelihood is **High** and is trivially
  missed inside a larger UI change — implemented as a single-line fix
  (`` `${window.location.search}#${resolvedTab}` ``) paired with `writeModuleUrlParam()`'s
  symmetric `` `${url.search}${window.location.hash}` ``.
- P3 and Phase 4 both write `src/app.js`/`index.html` — coordinate through the shared
  `integration_owner`, not by racing edits.

### Development Setup

Node ≥ 20. Gate before Phase 4 opens: `task-completion-validator` sign-off on this phase's
`P3-GATE`.

---

## Completion Notes

**What was built:** the header-dropdown module switcher (`#module-switcher`, D-7/mockup B), the
main-column status banner (`#module-status-banner`, persistent across tabs), `?module=` URL
read/write with the `switchTab` query-preservation fix, and AC-11-groundwork predicate guards
inside `selectModule()`/`submit`/`loadExample()`. Files touched: `index.html`, `styles.css`,
`src/app.js` (no other file). `modules/**` and `scripts/smoke-browser-unit-rejection.mjs`
untouched, as required.

**Mockup-B mapping (D-7):** collapsed toggle = active `manifest.title` + verbatim `status-chip`,
always visible in the header, matching the mockup's "CLINICAL MODULE" control. Expanded panel =
`PANEL_HEADER` (verbatim, by identifier) + two labelled `.module-switcher-group` containers
(`Selectable` / `Not selectable — read the reason`), each holding `.module-row` buttons rendered
by `moduleRowMarkup()`. Unlike the mockup, every non-`integrity-recorded` row (including CBC
Suite) carries the lock glyph and `disabled`/`aria-disabled` state — the mockup's own CBC
divergence was deliberately not copied (D-1/FR-4, per the phase file's explicit instruction). The
mockup's elaborate in-page banner prose (bulleted "0 of 91 rules attested…" lines) was NOT copied
either — every banner string here traces to an FR (7/8/9/10/13/34) and its vocabulary constant;
nothing was invented to match the mockup's visual density.

**Key implementation choices, restated from Implementation Notes:** banner placed outside every
`.tab-panel` for cross-tab persistence; row counts fetched through a dedicated, non-`loadModuleKb`
path; unregistered-`?module=` given a minimal interim placeholder rather than P4's full refusal
shape; `--brand` avoided in new selectors out of caution on the green-hue gate.

**Verification performed this phase:** `npm run build`, `npm run verify:d4`, `npm run
check:imports`, `npm run smoke:browser`, `npm run smoke` all exit 0; `node --test
tests/module-status-vocabulary.test.mjs tests/module-eligibility.test.mjs
tests/module-kb-loaders.test.mjs` — 41/41 pass; `npm test` — 26 failures, byte-identical test-name
set to the pre-Phase-3 baseline (Finding E-1/E-2 pre-existing failures + the
`ef-release-registry-validate-wiring.test.mjs` diff-scope guard), **zero new failures**. Manually
verified (via `node -e`) that all 4 modules' real rule/candidate counts match what the row
renderer will display (anemia 91/26, cbc_suite_v1 4/1, growth_suite_v1 0/0, kidney_suite_v1 0/0)
and that `deriveFacts({})`/`limitations(facts)` does not throw for any of the 4 modules' hooks.
`dist/src/app.js` confirmed to carry `?v=`-stamped versions of the new count-fetch specifiers.

**Post-review fix re-verification (2026-07-23):** after wiring `isRegisteredModule(requested)`
explicitly into `readModuleIdFromUrl()` (see the P3-05 task's "POST-REVIEW FIX" note above),
re-ran `npm run build && npm run check:imports && npm run smoke:browser && npm run smoke` — all
exit 0 — and `node --test tests/module-status-vocabulary.test.mjs tests/module-eligibility.test.mjs
tests/module-kb-loaders.test.mjs` — still 41/41 pass. `grep -n isRegisteredModule src/app.js` now
shows the import plus a real call site inside `readModuleIdFromUrl()`.

**Recommendations for Phase 4:** `activeModuleId`, `loadActiveModuleKb()`, and the
`isModuleSelectable` guards already inside `selectModule()`/`submit`/`loadExample()` are the state
Phase 4 should build `showModuleRefusal()` and the four SQ-3 §4 cases on top of — do not
reintroduce a second, divergent eligibility check. The P3-05 unregistered-id interim placeholder
(`renderModuleSwitcherCollapsedControl()`/`renderModuleStatusBanner()`'s `!view` branches) is
explicitly meant to be replaced by P4-07's named refusal, not extended in place. No stale result
can currently be on screen when an inert module becomes active (the only path to an inert active
module today is initial `?module=` load, before any assessment has run) — P4-06's atomicity seam
still needs its own explicit ordering once P4-01's `showModuleRefusal` exists, since Phase 4 adds
the first code paths where a *prior* result could be on screen when a refusal fires.

**P3-GATE tracked item, explicitly deferred to P4 (not fixed this session):** the algorithm
explorer's `onUseCase` callback (`initializeAlgorithmExplorer({ ..., onUseCase: (input) => { ...
assessPediatricAnemia(input, rules, candidates) ... } })`, `src/app.js` ~line 1027) is the one
remaining `assessPediatricAnemia` call site with no `isModuleSelectable(activeModuleId)` guard —
every other call site (`submit`, `loadExample()`) now has one (AC-11 groundwork). It was left
unguarded here deliberately: P3's scope is the selector/banner/URL surface, not the algorithm
explorer's internals (P5-01's explicit non-goal boundary — "do not touch its internals" — governs
this file too), and today it is unreachable in practice (the explorer only initializes real
worked-example cases against the loaded, active module's own `rules`/`candidates`, and no UI path
currently lets a clinician reach it while an inert module is active). **P4 must close it**:
AC-11/P6-012 require zero `assess()`-family call sites outside a predicate-guarded body, with no
exception carved out for this one. P5-01 separately hides/disables the `#algorithm` tab for
non-anemia modules, which is a second, independent closure of the same gap — P4 should not treat
P5's later work as a substitute for its own guard, since P4 lands first.
