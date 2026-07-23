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
phase: 5
title: "SPA Module Switcher \u2014 Phase 5: Module-Scoped Tab Degradation, Nav Counts\
  \ & Page Copy"
status: completed
created: '2026-07-22'
updated: '2026-07-22'
started: '2026-07-23T03:00:00Z'
completed: null
commit_refs: []
pr_refs: []
overall_progress: 90
completion_estimate: on-track
total_tasks: 7
completed_tasks: 6
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P5-01
  description: "#algorithm tab degrades explicitly for non-anemia modules (FR-25 /\
    \ R-8). src/algorithmExplorer.js is anemia-shaped end to end (anemiaWalkthrough\
    \ :290-303; facts.cbc.hb/facts.retic.* :257-366; fetch('./data/algorithm-explainers.json')\
    \ :583) and will throw on stub facts. Hide or disable the #algorithm tab for non-anemia\
    \ modules with an explicit \"not available for this module\" state sourced from\
    \ the vocabulary constant. Do NOT generalize the explorer and do not touch its\
    \ internals.\nIMPLEMENTED (2026-07-23T03:15:00Z): src/moduleStatusVocabulary.js#deriveAlgorithmUnavailableReason\
    \ (new, pure derivation, module-title parameterized). src/app.js#moduleSupportsAlgorithmExplorer\
    \ (new) is the single predicate reused by BOTH the pre-existing init-time gate\
    \ (initializeAlgorithmExplorerIfEligible, refactored to call it instead of its\
    \ inline condition \u2014 no behavior change) and the new src/app.js#updateAlgorithmTabAvailability,\
    \ which sets a real disabled + aria-disabled on `.tab-button[data-tab=\"algorithm\"\
    ]`, hides #algorithm-layout, and shows the new #algorithm-unavailable panel (index.html)\
    \ with the derived reason text; if #algorithm was the active tab when a module\
    \ lacking support becomes active, it force-switches to #assessment. Called from\
    \ activateModule() on every activation (success or refusal), so switching modules\
    \ updates it live, not just at page load. src/algorithmExplorer.js is untouched\
    \ (`git diff src/algorithmExplorer.js` is empty \u2014 verified below). SOURCE-ASSERTED\
    \ (D-6): node cannot execute app.js, so \"the explorer never executes\" and \"\
    no throw reaches the console\" are proven by the init-time gate's unchanged logic\
    \ plus this task's own tab-level affordance, not by an observed DOM run \u2014\
    \ that observation is P6-011's.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  - src/app.js
  acceptance_criteria: 'Under a non-anemia module the #algorithm tab is hidden or
    disabled with explicit copy, and the explorer never executes; git diff src/algorithmExplorer.js
    shows no change to anemiaWalkthrough or any facts.* accessor; no throw reaches
    the console.

    '
- id: P5-02
  description: "#evidence tab degrades for modules without a registered evidence loader\
    \ (FR-26 / OQ-2). Every module has an evidence.json (cbc_suite_v1 20, growth_suite_v1\
    \ 11, kidney_suite_v1 12 sources), but src/evidence/registry.js:39-50 registers\
    \ loaders for anemia and cbc_suite_v1 only. Degrade the #evidence tab to an explicit\
    \ \"no evidence view for this module\" state \u2014 NOT an empty source list,\
    \ which would read as \"this module cites nothing\". A per-module evidence view\
    \ is Deferred Item DF-SMS-02.\nIMPLEMENTED (2026-07-23T03:15:00Z): src/moduleStatusVocabulary.js#deriveEvidenceViewUnavailableReason\
    \ (new). src/app.js#moduleHasEvidenceView(moduleId) \u2014 true only for `moduleId\
    \ === DEFAULT_MODULE_ID` ('anemia'), because src/evidence.js's EVIDENCE map is\
    \ the ONLY per-module evidence-source list reachable from this file; cbc_suite_v1's\
    \ src/evidence/registry.js entry supplies rule-audit PASSAGE accessors only (passageById/passagesFor/sourceRightsPositionById),\
    \ never a source-list export renderEvidence() could iterate \u2014 so this deliberately\
    \ degrades cbc_suite_v1 too, not only growth/kidney, closing the same masquerade\
    \ class of bug this phase exists to prevent (no per-module evidence view exists\
    \ for anyone but anemia; building one is DF-SMS-02). renderEvidence() now branches\
    \ on this predicate: non-anemia empties #evidence-list and shows the new #evidence-unavailable\
    \ paragraph (index.html) with the derived reason; anemia takes the ORIGINAL, untouched\
    \ code path \u2014 same EVIDENCE map, same sort, same template literal, same escapeHtml\
    \ calls \u2014 so anemia's evidence view is byte-identical in behavior. renderEvidence()\
    \ is now called from every rules/candidates-changing site inside activateModule()/loadActiveModuleKb()\
    \ (via the new refreshKnowledgeBaseDependentViews() wrapper, replacing each prior\
    \ narrower updateNavCounts()-only call), so it re-renders on every module switch,\
    \ not just once at page load.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  estimated_effort: 0.75 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  - src/app.js
  acceptance_criteria: 'Under growth_suite_v1/kidney_suite_v1 the tab shows the explicit
    unavailable state; the source list is never rendered empty-but-present; anemia''s
    evidence view is byte-unchanged in behaviour.

    '
- id: P5-03
  description: "#rules explicit empty state when rules.length === 0 (FR-27 / OQ-3).\
    \ The #rules tab is already module-generic \u2014 it reads module-loaded rules/candidates.\
    \ It needs only the empty-state wording, resolved in the parent plan and living\
    \ in src/moduleStatusVocabulary.js (P1-02): \"This module contains no rules. No\
    \ assessment can be produced from it.\" Do not author alternative copy: \"not\
    \ yet loaded\" implies a loading failure and \"not yet available\" implies a pipeline\
    \ toward release that gates-registry.md:130-132 makes schema-impossible.\nIMPLEMENTED\
    \ (2026-07-23T03:15:00Z): renderRules() (src/app.js) now early-returns, when `rules.length\
    \ === 0`, rendering `<p class=\"empty-state\">${escapeHtml(RULES_EMPTY_STATE)}</p>`\
    \ into #rule-list and clearing #rule-count \u2014 RULES_EMPTY_STATE imported by\
    \ identifier from src/moduleStatusVocabulary.js (already existed from P1-02; this\
    \ task only wires the render branch), no alternative phrasing anywhere. renderRules()\
    \ is called from every rules/candidates-changing site via the new refreshKnowledgeBaseDependentViews()\
    \ wrapper, so the empty state renders correctly for every non-anemia module (all\
    \ currently have rules.length === 0 whenever reached) as well as the file:// direct-open\
    \ failure mode.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  - P1-02
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - src/app.js
  acceptance_criteria: 'A module with zero rules renders the exact vocabulary string,
    not a blank panel; the string is referenced by identifier, not inlined; no alternative
    phrasing appears anywhere.

    '
- id: P5-04
  description: "examples picker emptied/disabled for non-anemia modules (FR-28). examples/\
    \ holds 6 anemia cases; the <option> list is hardcoded in index.html:101-108,\
    \ loaded at src/app.js:525 and used by the explorer at :616. For non-anemia modules\
    \ the picker must be emptied and disabled, never left offering anemia cases under\
    \ another module's label. Per-module examples/ authoring is an explicit non-goal\
    \ (PRD \xA77).\nIMPLEMENTED (2026-07-23T03:15:00Z): the six anemia `<option>`\
    \ elements stay as literal HTML (unchanged) \u2014 `exampleSelectDefaultHtml`\
    \ (new module-scope const, src/app.js) snapshots `#example-select`'s innerHTML\
    \ once, at script load, before anything mutates it. src/app.js#moduleHasExampleCases(moduleId)\
    \ \u2014 true only for `moduleId === DEFAULT_MODULE_ID` (examples/ has anemia\
    \ cases only; per-module authoring is an explicit non-goal, PRD \xA77). The new\
    \ updateExampleOptionsForActiveModule() empties `#example-select` to zero options\
    \ (and resets `.value`) for a non-anemia module, and restores the captured markup\
    \ when anemia becomes active again; called from activateModule() on every activation.\
    \ The `disabled` state itself was already correctly handled by existing P4 code\
    \ (activateModule()'s unconditional top-of-function disable, updateAssessmentEnablement()'s\
    \ success-path re-enable, showModuleRefusal()'s explicit disable) \u2014 this\
    \ task's only job was the option-list CONTENT. \"Clears the loaded example on\
    \ switch\" was already guaranteed structurally by the pre-existing FR-19 invariants\
    \ (currentAudit=null; #results hidden; #results-placeholder shown), unconditional\
    \ at the top of every activateModule() call \u2014 no new code was needed for\
    \ that half of the AC.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  - src/app.js
  acceptance_criteria: 'Under a non-anemia module the picker has zero options and
    is disabled; selecting a non-anemia module after loading an anemia example clears
    the loaded example rather than leaving it applied; no anemia case label is visible
    under another module.

    '
- id: P5-05
  description: "Nav counts module-derived; neutralize the static 91/26 fallback (FR-29).\
    \ #nav-rule-count / #nav-pattern-count are already set dynamically at src/app.js:563-564;\
    \ only the hardcoded 91/26 HTML fallback at index.html:66 lies \u2014 it renders\
    \ anemia's counts before any module is loaded and under every module. Neutralize\
    \ the static fallback (empty or a neutral placeholder that cannot be read as a\
    \ count) and confirm the dynamic values are the loaded module's own.\nIMPLEMENTED\
    \ (2026-07-23T03:15:00Z): index.html's `#nav-rule-count`/`#nav-pattern-count`\
    \ spans changed from `>91<`/`>26<` to empty (`></span>`) \u2014 no numeral is\
    \ displayed before JS runs. updateNavCounts() (src/app.js, unchanged) already\
    \ sets both from the live `rules`/`candidates` arrays and is now invoked, via\
    \ the new refreshKnowledgeBaseDependentViews() wrapper, from every site that reassigns\
    \ those variables \u2014 so counts under each module equal that module's own rules/candidates\
    \ lengths, including the zero-count case for every non-anemia module.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  acceptance_criteria: 'index.html:66 no longer contains 91 or 26; counts under each
    module equal that module''s own rules/candidates lengths; before load, no numeral
    is displayed that could be mistaken for a count.

    '
- id: P5-06
  description: "Module-derived page copy (FR-30 / SQ-3 F10, F11). Derive module-identifying\
    \ copy from manifest.title: document.title, the <h1>Evaluate pediatric anemia</h1>,\
    \ brand and footer copy \u2014 index.html (:6,11,19,24,76,416,435,577). document.title\
    \ must not carry anemia's KNOWLEDGE_BASE_VERSION under another module (F11). meta.status\
    \ (src/engine.js:47) is a hardcoded literal and does NOT say unsigned-stub \u2014\
    \ do not repurpose it for the status chip (P3-04 owns that). R-P2 handling: if\
    \ manifest.title is missing (schema-impossible; defence in depth) the surface\
    \ renders the moduleId verbatim, never a generic \"Assessment\".\nIMPLEMENTED\
    \ (2026-07-23T03:15:00Z): resolved the 8 pre-P3 line numbers against the P2 (pre-P3)\
    \ index.html snapshot (`git show <pre-P3-commit>:index.html`) to their current\
    \ equivalents, since P3/P4 additions shifted every line after the header: :6 meta\
    \ description (id=\"page-description\" added) \u2192 :11 <title> (document.title,\
    \ no id needed) \u2192 :19 brand aria-label (id=\"brand-link\" added) \u2192 :24\
    \ brand <strong> (id=\"brand-title\" added) \u2192 :76 \u2192 current <h1 id=\"\
    assessment-title\"> (pre-existing id, no HTML change needed) \u2192 :416 \u2192\
    \ current output-preview <li> (id= \"output-preview-primary\" added) \u2192 :435\
    \ \u2192 current #algorithm <h2> (id=\"algorithm-heading-title\" added) \u2192\
    \ :577 \u2192 current footer <strong> (id=\"footer-brand-title\" added; footer's\
    \ \"Knowledge base reviewed through\" <span> also given id=\"footer-kb-reviewed\"\
    \ as the natural 9th/ paired site for evidenceReviewedThrough). New src/app.js#updateModuleDerivedPageCopy()\
    \ reads getManifestView(activeModuleId) (R-P2: falls back to activeModuleId verbatim,\
    \ never generic \"Assessment\", for a missing manifest/title) and sets all 8 sites\
    \ plus document.title from the ACTIVE module's OWN manifest.knowledgeBaseVersion/evidenceReviewedThrough\
    \ \u2014 never anemia's statically-imported src/evidence.js#KNOWLEDGE_BASE_VERSION\
    \ constant (F11). Removed the stale hardcoded `document.title = \\`Pediatric Anemia\
    \ Decision Support \u2014 KB ${KNOWLEDGE_BASE_VERSION}\\` ` line at the tail of\
    \ initialize() (and the now-unused KNOWLEDGE_BASE_VERSION import from src/evidence.js)\
    \ \u2014 that line ran on EVERY page load, AFTER activateModule() had already\
    \ set the correct module-derived title, and would have silently overwritten it\
    \ back to the anemia literal on every full page load, which is exactly the F11\
    \ bug this task exists to close. Called from activateModule() on every activation\
    \ (success or refusal), so switching modules updates page copy live. meta.status\
    \ (src/engine.js:47) is not read anywhere in this function or anywhere new added\
    \ this phase \u2014 confirmed by grep. For anemia specifically, 5 of the 8 derived\
    \ strings are byte-identical to their pre-phase originals by construction (manifest.title=\"\
    Pediatric Anemia\" composes exactly into the historical \"Pediatric Anemia CDS\"\
    /\"Pediatric Anemia Decision Support\"/ \"...home\"/document.title copy; evidenceReviewedThrough=\"\
    2026-07-15\" composes into the historical footer line) \u2014 verified by direct\
    \ string comparison, not merely asserted.\n"
  status: completed
  assigned_to:
  - general-purpose
  provider: claude
  dependencies:
  - P4-01
  - P3-03
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  target_surfaces:
  - index.html
  acceptance_criteria: 'All 8 named index.html sites are module-derived; document.title
    under a non-anemia module contains neither "anemia" nor anemia''s KNOWLEDGE_BASE_VERSION;
    a synthetic manifest with no title renders the moduleId, not a generic label;
    meta.status is unchanged and is not used as the status chip.

    '
- id: P5-GATE
  description: 'task-completion-validator gate. Verify the Phase 5 exit gate: no tab
    renders anemia data under a non-anemia module label. Walk #evidence, #rules, #algorithm
    and the examples picker under each of the three scaffolds. Reject if src/algorithmExplorer.js
    was generalized rather than degraded (R-8), if the examples picker still offers
    anemia cases, or if index.html:66 still carries 91/26.

    '
  status: pending
  assigned_to:
  - task-completion-validator
  provider: claude
  dependencies:
  - P5-01
  - P5-02
  - P5-03
  - P5-04
  - P5-05
  - P5-06
  estimated_effort: "\u2014"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  acceptance_criteria: All exit-gate criteria pass; recorded in phase progress note.
parallelization:
  batch_1:
  - P5-01
  batch_2:
  - P5-02
  batch_3:
  - P5-04
  batch_4:
  - P5-03
  - P5-05
  batch_5:
  - P5-06
  batch_6:
  - P5-GATE
  critical_path:
  - P5-01
  - P5-02
  - P5-04
  - P5-05
  - P5-06
  - P5-GATE
  estimated_total_time: "~1.5\u20132 engineer-days (5 pts)"
  serialization_constraint: "SHARED-FILE OWNERSHIP \u2014 do not re-merge these batches.\
    \ Six of this phase's seven tasks write index.html and/or src/app.js: P5-01, P5-02\
    \ and P5-04 write BOTH; P5-03 writes src/app.js only; P5-05 and P5-06 write index.html\
    \ only. The dev-execution rule is one agent per file, no parallel edits to the\
    \ same file, so batches 1, 2, 3 and 5 are single-task by construction. The ONLY\
    \ disjoint pair in this phase is batch_4 \u2014 P5-03 (src/app.js) alongside P5-05\
    \ (index.html). The earlier batch_1 grouping (P5-01..P5-05) put five agents on\
    \ the same two files at once. Do not restore it.\nEXECUTION NOTE (2026-07-23):\
    \ all six tasks were in fact implemented sequentially by a single session against\
    \ the shared src/app.js/index.html surface (rather than as six separate agent\
    \ dispatches), which trivially satisfies the \"no parallel edits to the same file\"\
    \ constraint \u2014 the batching plan above remains correct guidance for a multi-agent\
    \ dispatch, it was simply not the execution mode used this pass.\n"
blockers:
- id: BLOCKER-PHASE-DEP
  title: Phase 5 cannot open until Phase 4 exit gates (P4-GATE, P4-KAREN) both pass
  severity: medium
  blocking:
  - P5-01
  - P5-02
  - P5-03
  - P5-04
  - P5-05
  - P5-06
  resolution: 'Wait for .claude/progress/spa-module-switcher/phase-4-progress.md P4-GATE
    and P4-KAREN to both complete. Also depends on Phase 2 (loading seam), already
    satisfied by that phase''s own gates.

    '
  created: '2026-07-22'
  resolved: '2026-07-23'
success_criteria:
- id: SC-1
  description: '#algorithm hidden/disabled with explicit copy for non-anemia modules;
    explorer never executes; no generalization (R-8)'
  status: completed
- id: SC-2
  description: "#evidence shows an explicit unavailable state for growth/kidney \u2014\
    \ never an empty-but-present source list"
  status: completed
- id: SC-3
  description: '#rules renders the exact OQ-3 vocabulary string for zero-rule modules'
  status: completed
- id: SC-4
  description: Examples picker emptied and disabled for non-anemia modules; no anemia
    case visible under another label
  status: completed
- id: SC-5
  description: Nav counts module-derived; index.html:66's static 91/26 neutralized
  status: completed
- id: SC-6
  description: Page copy module-derived at all 8 index.html sites; document.title
    free of anemia's version under other modules
  status: completed
- id: SC-7
  description: Missing manifest.title renders the moduleId, never a generic 'Assessment'
  status: completed
- id: SC-8
  description: "Screenshots of #algorithm, #evidence and #rules under a non-anemia\
    \ module at \u22651440px (AC-6), plus header/footer (AC-7)"
  status: pending
files_modified:
- index.html
- src/app.js
- src/moduleStatusVocabulary.js
- styles.css
notes: "Wave 5 \u2014 depends on Phase 2 (loading seam, already satisfied) AND Phase\
  \ 4 (settled state machine); its own wave because it shares src/app.js/index.html\
  \ serialization barriers with P3/P4 but runs after P4 rather than in parallel. **Hard\
  \ boundary (R-8)**: this phase degrades; it does NOT generalize. Any change to anemiaWalkthrough\
  \ or the facts.anemia.*/facts.cbc.*/ facts.retic.* accessors is out of scope and\
  \ is held as Deferred Item DF-SMS-03 \u2014 confirmed unchanged: `git diff src/algorithmExplorer.js`\
  \ is empty. Per the critical path (P0\u2192P1\u2192P2\u2192P3\u2192P4\u2192P6\u2192\
  P7), P5 carries float (5 pts) against the P4\u2192P6 critical path and merges before\
  \ Phase 6 opens."
---

# spa-module-switcher — Phase 5: Module-Scoped Tab Degradation, Nav Counts & Page Copy

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/spa-module-switcher/phase-5-progress.md -t P5-01 -s completed
```

---

## Objective

Degrade every remaining anemia-shaped surface (`#algorithm`, `#evidence`, `#rules` empty state,
examples picker, nav counts, page copy) for non-anemia modules — explicitly, never silently, and
without generalizing `src/algorithmExplorer.js` (an explicit non-goal, R-8).

**Duration**: ~1.5 engineer-days · **Dependencies**: Phase 2 (loading seam) and Phase 4 (settled
state machine); own wave — shares `src/app.js`/`index.html` serialization barriers with P3/P4 ·
**Exit gate**: no tab renders anemia data under a non-anemia module label.

---

## Task Tracking

| Task ID | Name | Assigned Subagent(s) | Model/Effort | Provider | Status | Dependencies |
|---------|------|-----------------------|--------------|----------|--------|---------------|
| P5-01 | `#algorithm` tab degrades explicitly | general-purpose (frontend engineer¹) | sonnet/adaptive | claude | completed | P4-01 |
| P5-02 | `#evidence` tab degrades for modules without a loader | general-purpose | sonnet/adaptive | claude | completed | P4-01 |
| P5-03 | `#rules` explicit empty state (`rules.length === 0`) | general-purpose | sonnet/adaptive | claude | completed | P4-01, P1-02 |
| P5-04 | `examples` picker emptied/disabled | general-purpose | sonnet/adaptive | claude | completed | P4-01 |
| P5-05 | Nav counts module-derived; neutralize static `91`/`26` | general-purpose | sonnet/adaptive | claude | completed | P4-01 |
| P5-06 | Module-derived page copy | general-purpose | sonnet/adaptive | claude | completed | P4-01, P3-03 |
| P5-GATE | `task-completion-validator` gate | task-completion-validator | sonnet/adaptive | claude | pending | P5-01..P5-06 |

¹ **Agent-name substitution**: `frontend-developer` is not registered in this project; dispatched
as `general-purpose` with the role descriptor retained.

---

## Orchestration Quick Reference

> **Serialization constraint — shared-file ownership.** Six of this phase's seven tasks write
> `index.html` and/or `src/app.js`: `P5-01`, `P5-02`, `P5-04` write **both**; `P5-03` writes
> `src/app.js` only; `P5-05` and `P5-06` write `index.html` only. Executed this pass as a single
> sequential session against the shared surface rather than six separate agent dispatches — see
> the `parallelization.serialization_constraint` execution note above.

---

## Quality Gates

- [x] `#algorithm` hidden/disabled with explicit copy for non-anemia modules; explorer never executes; **no generalization** (R-8)
- [x] `#evidence` shows an explicit unavailable state for growth/kidney — never an empty-but-present source list
- [x] `#rules` renders the exact OQ-3 vocabulary string for zero-rule modules
- [x] Examples picker emptied and disabled for non-anemia modules; no anemia case visible under another label
- [x] Nav counts module-derived; `index.html:66`'s static `91`/`26` neutralized
- [x] Page copy module-derived at all 8 `index.html` sites; `document.title` free of anemia's version under other modules
- [x] Missing `manifest.title` renders the moduleId, never a generic "Assessment"
- [ ] Screenshots of `#algorithm`, `#evidence` and `#rules` under a non-anemia module at ≥1440px (AC-6), plus header/footer (AC-7) — **human task, P6-011, not automatable (D-6)**

---

## Implementation Notes

### Architectural Decisions

- Every task in this phase **degrades**; none generalizes. `src/algorithmExplorer.js`'s internals
  (`anemiaWalkthrough`, `facts.*` accessors) are explicitly out of scope (R-8) — held as Deferred
  Item **DF-SMS-03**. `git diff src/algorithmExplorer.js` is empty at completion.
- `src/evidence/registry.js` growth/kidney loader gap is degraded here, not fixed — a per-module
  evidence view is Deferred Item **DF-SMS-02**. P5-02 also degrades `cbc_suite_v1`'s evidence tab
  (not only growth/kidney): `src/evidence.js`'s `EVIDENCE` map is the only per-module evidence-
  source list reachable from `src/app.js`, and it is anemia's; `cbc_suite_v1`'s
  `src/evidence/registry.js` entry supplies rule-audit passage accessors only, never a source list
  `renderEvidence()` could render — so degrading only growth/kidney would have left cbc_suite_v1
  rendering anemia's evidence list under the CBC label, the exact masquerade this phase exists to
  close.
- P5-06's 8 `index.html` sites were resolved from the plan's pre-P3 line numbers against the P2
  (pre-P3) git snapshot of `index.html`, since P3/P4's header/banner additions shifted every line
  number after the header by ~50 lines. Current-file anchors used instead of line numbers: meta
  `#page-description`, `#brand-link`/`#brand-title`, `#assessment-title` (pre-existing id),
  `#output-preview-primary`, `#algorithm-heading-title`, `#footer-brand-title`,
  `#footer-kb-reviewed`.
- A single new function, `updateModuleDerivedPageCopy()`, owns all 8 P5-06 sites plus
  `document.title`; a single new function, `updateAlgorithmTabAvailability()`, owns the P5-01 tab
  affordance (reusing the new `moduleSupportsAlgorithmExplorer()` predicate that also replaces the
  init-gate's inline condition, so the two can never diverge); a single new function,
  `updateExampleOptionsForActiveModule()`, owns the P5-04 picker-option content. All three are
  called from `activateModule()` right after `renderModuleStatusBanner()` — synchronous,
  unconditional, before this function's only `await` — so the P4-06 seam ordering guarantee is
  unaffected. A new `refreshKnowledgeBaseDependentViews()` wrapper (`updateNavCounts()` +
  `renderRules()` + `renderEvidence()`) replaces every prior, narrower `updateNavCounts()`-only
  call site inside `loadActiveModuleKb()`/`activateModule()`'s refusal branches, so P5-02/P5-03/
  P5-05 all re-render on every module switch through one call site rather than three independently
  maintained ones.
- Removed the stale, anemia-hardcoded `document.title` assignment at the tail of `initialize()`
  (and the now-unused `KNOWLEDGE_BASE_VERSION` import from `src/evidence.js`) — it ran on every
  page load AFTER `activateModule()` had already set the correct module-derived title, silently
  overwriting it back to the anemia literal. This was the concrete F11 mechanism.

### Known Gotchas

- `meta.status` (`src/engine.js:47`) is a hardcoded literal `'Research prototype—not clinically
  validated'` and does **not** say `unsigned-stub` — not read anywhere added this phase (confirmed
  by grep); the module status chip remains Phase 3's (`P3-04`) job.
- `git diff src/algorithmExplorer.js` is **empty** — verified via `git diff --quiet` after
  implementation.
- P5-06 ended up touching only `index.html` (adding `id` attributes) plus `src/app.js` (the new
  render function) — no change to `src/moduleManifests.js` or manifest content was needed.

### Development Setup

Node ≥ 20. Gate before Phase 6 opens (jointly with Phase 4): `task-completion-validator`
sign-off on this phase's `P5-GATE` — **still pending**, not run by this implementation pass.

---

## Completion Notes

**Files changed**: `index.html`, `src/app.js`, `src/moduleStatusVocabulary.js`, `styles.css`.
`src/algorithmExplorer.js` untouched (`git diff --quiet` confirms empty diff).

**Gate results** (all green, run 2026-07-23):
- `npm run build` — OK (91/26/6 counts unchanged; asset-stamp applied).
- `npm run verify:d4` — OK, `clinicalApprovers[]` empty on all 95 built rules across 4 modules.
- `npm run check:imports` — OK, both static-specifier and dynamic-module-graph passes.
- `npm run smoke:browser` — OK.
- `npm run smoke` — OK, KB 0.1.0-2026-07-15, 2 differential patterns.
- `node --test tests/module-status-vocabulary.test.mjs tests/module-eligibility.test.mjs
  tests/module-kb-loaders.test.mjs` — **47/47 pass**.
- `npm test` (full suite, run once at the end) — **2608 pass / 26 fail**, exactly the known
  baseline (25 inherited pre-existing `main` failures per finding E-1 + the E-2 diff-scope guard
  test) — failing test names cross-checked byte-for-byte against
  `.claude/findings/spa-module-switcher-findings.md` §E-1/E-2; **zero new failures**.

**Per-task AC status**: P5-01 through P5-06 all pass their stated AC (see each task's `IMPLEMENTED`
note above for the specific evidence). P5-GATE (task-completion-validator) has not been run by this
pass — it is a separate, dedicated verification step per the plan and is left `pending`.

**D-6 boundary honesty**: every claim above about `src/app.js` runtime DOM behavior (tab
hiding/disabling, panel swapping, live copy updates) is a **source-assertion** — grep/read
verification that the code is *wired correctly*, not an observed browser execution. Node cannot
import/execute `src/app.js` (DOM-dependent). The actual rendered-DOM confirmation, including the
AC-6/AC-7 screenshots (SC-8, left pending above), is `P6-011`'s human pass, per the plan.

**Deviations from the plan, with rationale**:
1. **P5-02 scope widened beyond growth/kidney to include `cbc_suite_v1`.** The task description's
   parenthetical ("anemia + cbc_suite_v1 only have loaders") only describes
   `src/evidence/registry.js`'s REGISTRY contents; it does not mean `cbc_suite_v1` has a real
   evidence-source list to render. Its `evidence.js` exports passage-lookup accessors only, not an
   `EVIDENCE`-shaped map. Rendering anemia's real list under the CBC label to avoid the "growth/
   kidney only" reading would have reintroduced exactly the D-1-shaped masquerade this whole
   feature exists to prevent, and DF-SMS-02 explicitly defers a per-module view for every module
   besides anemia — including cbc_suite_v1. Degrading it too is the conservative, defensible
   reading and does not contradict the stated AC (which only asserts what growth/kidney and
   anemia must each do).
2. **Execution mode was a single sequential session, not six parallel/batched agent dispatches.**
   The plan's `parallelization` block describes a multi-agent dispatch strategy for a
   `dev-execution`/`phase-owner` orchestration flow; this pass implemented all six tasks directly
   in one session against the same shared `src/app.js`/`index.html` surface, which trivially
   satisfies the "no parallel edits to the same file" rule the batching exists to enforce. No
   task's substance changed as a result.
3. **`renderEvidence()` is now called defensively on every `rules`/`candidates`-changing event**,
   even though its own gating condition (`moduleHasEvidenceView`) depends only on
   `activeModuleId`, not on `rules`/`candidates`. This was a deliberate simplification (one
   `refreshKnowledgeBaseDependentViews()` call site covering P5-02/P5-03/P5-05 together) rather
   than three independently-triggered re-renders; the extra calls are cheap and idempotent.

**Recommendation for Phase 6**: the D-6 boundary above (no observed DOM execution) is the main
residual risk surface for this phase specifically around the new `#algorithm-unavailable`/
`#evidence-unavailable` panels and the disabled-tab-button visual treatment — P6-011's human pass
should explicitly walk all three non-anemia scaffolds through `#algorithm`, `#evidence`, `#rules`,
and the examples picker, plus a hard-reload on each to confirm `document.title`/`<h1>`/brand/footer
copy at first paint (not just after a live module switch).
