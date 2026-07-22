# Phase 6-7: Gates, Test Harness & Documentation Finalization

[Return to Parent Plan](../spa-module-switcher-v1.md)

**Column conventions**: `Estimate` is story points, **never** Effort. `Effort` (claude only):
`adaptive` | `extended`. `Provider` is `claude` on every task. Gate rows carry `Estimate: —`.

**Subagent naming**: implementer roles dispatch as `general-purpose` with the role descriptor
retained. `task-completion-validator` and `karen` are the two genuinely registered reviewer agents and
are named directly. See the parent plan's Phase Summary footnote ¹.

---

## Phase 6: Gates & Test Harness (Verification Phase)

**Estimate**: **9 pts** (was 5) · **Duration**: ~3 engineer-days + one human review session
**Dependencies**: Phase 4 and Phase 5 complete (wave 6)
**Assigned Subagent(s)**: `task-completion-validator` **drives**; frontend engineer (general-purpose,
sonnet) implements; **`karen` milestone review** at exit; **a named human owns P6-011**
**Effort**: `extended` — gate surgery on a source-grepping smoke test.
**Exit gate** (decisions block §1): full `npm run check` green **and** P6-011 recorded and signed.

**This phase owns every `verified_by` ID in PRD §11.** Task IDs use the PRD's own numbering verbatim
(`P6-001..P6-012`, `P6-009-smoke`) so the ACs' `verified_by` references resolve.

### The D-6 verification ceiling, stated once, binding on the whole phase

**This repository has no browser automation and no test dependencies.** `package.json` declares no
`dependencies` and no `devDependencies` at all; `scripts/smoke-browser-unit-rejection.mjs:4-15` states
the posture verbatim (*"deliberately has no browser automation dependency… It does not claim to paint
or inspect a real browser DOM"*). Per **D-6** this is **accepted, not worked around** — do **not** add
jsdom, a headless browser, or any test runner. The escalation path is ADR-0010 (`proposed`, DF-SMS-06,
authored at DOC-006), not a line item here.

Every task below is therefore written to one of three tiers, and **must say which**:

| Tier | Technique | Proves | Does not prove |
|---|---|---|---|
| **Executed** | `node:test` over non-DOM modules (`src/moduleStatusVocabulary.js`, `src/moduleEligibility.js`, `src/engine.js`) and the built graph under `dist/src/` | Real behaviour of pure functions | Anything touching `src/app.js`, `index.html`, the DOM, events, focus, paint or CSS resolution |
| **Source-asserted** | `functionBody()` + regex over `src/app.js`, `index.html`, `styles.css` and their `dist/` copies | That the source *contains* the right guard, in the right order, by the right identifier; that a prohibited construct is *absent from source* | That the state machine **behaves** — that the guard is reached, the branch taken, the DOM updated |
| **Human** | **P6-011** — a person drives the page, captures the screenshots, reviews them, and signs | Rendering, placement (panel vs. tooltip), focus order, the devtools forced-activation check | Regression protection — nothing re-runs it |

**Forbidden phrasings in this phase's ACs and in any progress note**: "spy", "call count", "renders",
"executes", "the smoke run exercises …", for anything DOM-dependent. If a claim cannot be written as
an executed non-DOM assertion or a source assertion, it belongs to **P6-011** and must be recorded as
a human observation — never as a passing test. PRD §11a is the disclosure this phase must not
contradict.

### The R-3 constraint, stated once, binding on the whole phase

`scripts/smoke-browser-unit-rejection.mjs` **greps `src/app.js` source text**. Its breaking
assertions are: `:132` (`import { assessPediatricAnemia } from './engine.js'` in `src/app.js`),
`:134` (same against `src/algorithmExplorer.js`), `:179` (`assessPediatricAnemia(input, rules,
candidates)` inside the load-example body), `:188` (same inside the submit body), and `:216-223`
(imports `assessPediatricAnemia` from `dist/src/engine.js` and asserts
`classification.anemiaStatus === 'present'`). **Extend, never rewrite.** The lowest-friction path,
already taken in P2-02, is to keep `assessPediatricAnemia` exported and its anemia call shape intact,
then extend `:179`/`:188` to *also* accept the module-generic call and add a **sibling** assertion
block for the module-refusal UI mirroring the existing `AGE_OUT_OF_SUPPORTED_RANGE` block at
`:167-173`. Rewriting the script would delete the only regression guard the SPA has.

`npm run check` is authoritative and copied verbatim from `package.json`'s `scripts.check`:
`npm test && npm run validate && npm run coverage:rules && npm run build && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke`.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Provider | Dependencies |
|---------|-----------|-------------|---------------------|---------:|-------------|-------|--------|----------|--------------|
| P6-001 | Module inventory & grouping test (**AC-1**) | Assert all four registered modules render, grouped by selectability: the row set comes from `listModules()`/`MODULE_IDS`; display fields come from the frozen `src/moduleManifests.js` map; group membership is computed once by the FR-4 predicate; the verbatim panel header `These modules are not peers. Read each row.` is present. Include the AC-1 resilience cases: a manifest missing an optional envelope field renders without `undefined`/empty-label artifacts; a module in `MODULE_IDS` absent from the manifest map appears in the not-selectable group with the FR-17 reason, never dropped. | **Tier: source-asserted.** PROVES: the row-renderer source derives its row set from `MODULE_IDS` (not a hardcoded `4`, so a fifth registered module fails rather than passing silently), references the panel header by identifier, computes group membership from the FR-4 predicate, and contains both resilience branches. DOES NOT PROVE: that four rows paint, that the grouping is visually legible, or that the header is visible — P6-011 establishes those. Phrase the test names accordingly (`…source declares…`, not `…renders…`) | 0.75 | frontend engineer | sonnet | extended | claude | P3-03, P5-06 |
| P6-002 | `tests/module-switcher-eligibility.test.mjs` — predicate is imported, never a literal (**AC-2**) | Assert `READY_STATUS` is imported from `src/kbVerify.js` into the eligibility path, and that the literal `'integrity-recorded'` appears **nowhere** in `src/app.js`, `src/moduleEligibility.js` or `index.html`. Assert the comparison target is `moduleManifests[id].status`. | Test passes; a seeded hardcoded `'integrity-recorded'` literal in any of the three files makes it fail | 0.25 | frontend engineer | sonnet | extended | claude | P2-03 |
| P6-003 | Eligibility gating — only `integrity-recorded` reaches `assess()` (**AC-2**) | **Rewritten to the D-6 ceiling — the original AC specified a spy, which is unwritable here** (`src/app.js` is DOM-dependent; node cannot import or execute it, so no call-count instrumentation is possible). Two halves. **(a) Executed**: `src/moduleEligibility.js` is a non-DOM module, so run it for real — `isModuleSelectable` returns `false` for each of the three `unsigned-stub` ids, and for a manifest whose `status` is **absent** or **outside the closed enum** (AC-2 resilience: ineligible, never eligible-by-default). **(b) Source-asserted**: `functionBody()` over `src/app.js` shows that every `MODULE_KB_LOADERS`, `assessModule` and `assess` reference sits inside a body that evaluates the predicate first, and that no such reference exists elsewhere in the file. The three entry paths — row selection, `?module=` deep link, form submit — are each checked individually. | **Tier: executed + source-asserted.** PROVES: (a) the predicate really returns false for all three stubs and for absent/out-of-enum status — a genuine behavioural result; (b) the source of `src/app.js` contains **no unguarded call site** for the loader or the engine. DOES NOT PROVE: that `assess()` is not called at runtime. A guard that is textually present but unreachable, or a call added via a path the extractor does not see, would pass. That gap is closed by **P6-011** (deep-link an ineligible module and observe) and is the reason **P6-012** exists. Record the two halves separately in the phase note | 1.0 | frontend engineer | sonnet | extended | claude | P2-03, P4-04 |
| P6-004 | `tests/module-switcher-status-labels.test.mjs` — doc-truth pin over the vocabulary (**AC-3**) | The full doc-truth pin (P1-04 was the unit test; this is the surface pin). Assert: every closed-enum status maps to exactly one canonical sentence, byte-matching PRD §6.1.B-1 (`integrity-recorded` reads "content hashes **recorded** only"); the panel header, the FR-13 honesty-boundary sentence and the FR-34 staleness disclosure are exported from `src/moduleStatusVocabulary.js` and referenced **by identifier** in `src/app.js`; **no status text is written inline** in `index.html` or `src/app.js`. Resilience case: a status value with no vocabulary entry renders the not-selectable refusal plus the raw enum value **and the test fails the build** — a missing entry must never fall back to friendlier text. Pin the R-1 group headers here too, so the structural grouping cannot silently become a footnote. | **Tier: executed (vocabulary) + source-asserted (surfaces).** PROVES, by execution: enum coverage derived from `schemas/module-manifest.schema.json` (not a hand-copied list), each canonical sentence byte-matching PRD §6.1.B-1, the derived FR-9 clause, and the missing-entry sentinel. PROVES, by source: no inline status text in `index.html`/`src/app.js`; the group headers are present. **DOES NOT PROVE that the honesty-boundary sentence and the staleness disclosure render in the panel rather than in a `title=` tooltip** — a tooltip implementation passes every assertion here. Placement is established **only** by P6-011, and the test file must carry a comment saying so. **FR-11 addendum (D-6 corollary):** the no-green-state check resolves every custom property reachable from a module-row/status-chip/banner selector to its literal colour **value** and rejects a green hue at meaningful saturation — a token *named* `--stub-warn` whose value is `#2e7d32` must fail. Name-only checks are forbidden | 0.75 | frontend engineer | sonnet | extended | claude | P1-02, P3-04 |
| P6-005 | Four refusal-case tests (**AC-4**) | One test per SQ-3 §4 case: (1) evidence registry has no entry → "No assessment produced — evidence not available for module X"; (2) hooks not-implemented, detected before render, `renderClassification` never invoked; (3) manifest status ≠ `READY_STATUS`, verbatim enum status shown, not downgraded to a warning; (4) KB fetch 404, `rules`/`candidates` reset to `[]`/`{}` **before** the fetch. Every case asserts the FR-19 invariants (`currentAudit === null`, `#results` hidden, `#results-placeholder` shown, `refreshAuditView()` called, submit disabled, selector still usable) and asserts **none** routes through `INPUT_REJECTION_CODES` or renders the heading "Check the entered units". Include the AC-4 resilience case (prior result cleared before the refusal renders; audit download disabled in the same tick) — this is the P4-06 seam, re-asserted at gate level. | **Tier: source-asserted. Rewritten — the original AC specified a spy on `showInputRejection`, which is unwritable** (no DOM-capable runtime here). PROVES: `functionBody('showModuleRefusal')` contains the six FR-19 invariant statements **in the specified order**; the function is textually distinct from `showInputRejection` and does not reference it or `INPUT_REJECTION_CODES`; it never contains the heading "Check the entered units"; each of the four SQ-3 §4 cases has its own reason string, sourced by identifier from the vocabulary; no `renderClassification` call site exists outside a not-implemented-guarded branch; the reset-before-fetch order (P2-04) precedes the fetch in source order. DOES NOT PROVE: that the DOM reaches the refusal state, that the prior result leaves the screen, that the audit download is actually disabled, or that no `"undefined g/dL"`/false `Indeterminate` reaches the page. **Behavioral fail-closure is not established by this task** — P6-011 is where a person confirms it. Say so in the phase note; do not report it as covered | 1.25 | frontend engineer | sonnet | extended | claude | P4-01..P4-07 |
| P6-006 | `?module=` URL-state round-trip test (**AC-5**) | Assert: `?module=` is read on load and validated with `isRegisteredModule()`; absent → `DEFAULT_MODULE_ID`; selection writes it back via `history.replaceState` preserving the `#tab` hash; **`switchTab`'s `replaceState` (`src/app.js:457`) preserves the query string** (R-7 — the specific regression this test exists for); unregistered or ineligible → explicit refusal naming the requested id, no silent substitution; and no `localStorage`/`sessionStorage`/cookie is read or written. | **Tier: source-asserted, with one complete check.** COMPLETE: the grep for `localStorage`/`sessionStorage`/`document.cookie` across app-surface files returns zero hits — absence in source *is* absence, so this half is fully established. PARTIAL: `functionBody('switchTab')` shows the bare `` replaceState(null,'',`#${tab}`) `` form is gone and `location.search` is referenced; the load path calls `isRegisteredModule()`. DOES NOT PROVE: that a real tab click preserves the query string. **Optional strengthening, not mandated** — if P3-06 factored the URL construction into a pure exported helper in a non-DOM module, execute that helper here and the round-trip becomes a genuine behavioural assertion; if it did not, record the gap rather than implying coverage | 0.5 | frontend engineer | sonnet | extended | claude | P3-05, P3-06, P4-07 |
| P6-007 | Module-scoped degradation & module-derived copy tests (**AC-6**, **AC-7**) | AC-6: the active moduleId is the single input to the degradation decision for `#algorithm` (FR-25), `#evidence` (FR-26), the `#rules` empty state (FR-27) and the examples picker (FR-28); nav counts come from the loaded module's own rules/candidates and `index.html:66`'s static `91`/`26` is neutralized (FR-29). Resilience: zero-rule module → explicit empty state, not a blank panel; no evidence loader → "no evidence view for this module", not an empty source list; examples picker empty **and** disabled rather than offering anemia cases. AC-7: `manifest.title` drives `document.title`, `<h1>`, brand and footer (`index.html:6,11,19,24,76,416,435,577`); `document.title` must not carry anemia's `KNOWLEDGE_BASE_VERSION` under another module (F11); a missing `manifest.title` renders the moduleId verbatim, never a generic "Assessment". | **Tier: source-asserted, with one complete check.** COMPLETE: `index.html` contains neither `91` nor `26` as a count fallback — a whole-file scan fully establishes this. PARTIAL: each of the four degradation surfaces has a moduleId-conditioned branch in `src/app.js`, each empty/unavailable string is referenced by identifier, `git diff src/algorithmExplorer.js` shows no change to `anemiaWalkthrough` or any `facts.*` accessor, and all eight `index.html` copy sites read from `manifest.title`. DOES NOT PROVE: what any tab renders under a scaffold module, that the explorer never executes (only that its invocation sits behind a branch), or what `document.title` actually says. P6-011 walks the tabs under each of the three scaffolds by hand | 0.75 | frontend engineer | sonnet | extended | claude | P5-01..P5-06 |
| P6-008 | **Allow-list assertion** — the renderer can emit only enumerated manifest fields (**AC-8**, FR-31/FR-32/FR-33) | **Rewritten per the D-2 corollary in D-6.** The prohibited-*token* scan was bypassable: `modules/anemia/module.json` carries a real `clinicalContentHash: sha256:97e65556a42dbd7a…`, D-2 imports that object into the browser graph **by design**, and a renderer doing `JSON.stringify(manifest)` into a row or a `data-*` attribute would emit the hash while passing a token scan of source text cleanly. **(a) Primary — allow-list.** Enumerate the manifest properties the row/banner renderer may read and emit: `id`, `title`, `status`, `knowledgeBaseVersion`, `evidenceReviewedThrough`, `approvedBy.length` — and nothing else. (`engineLabel` and `limitations()` come from the module hooks, not the manifest; FR-3 permits them separately.) Fail on any other `manifest.<field>` or destructured key inside the renderer's `functionBody()`, and fail outright on `JSON.stringify(manifest)`, `{...manifest}`, `Object.entries(manifest)`, or assignment of the manifest object (or an un-narrowed subset) into a `data-*`/`dataset` property, `innerHTML` or `textContent`. **(b) Secondary — token scan**, retained as a weaker layer over `index.html`, `src/app.js`, `src/moduleStatusVocabulary.js`, `styles.css`: `sha256:`, `hashes.recomputed`, "integrity verified", "content unmodified", "approved" outside the negating FR-9 phrase, "clinically reviewed" outside a negating phrase, "released", "validated" outside "not clinically validated", any success/green class. **(c) `dist/` half — corrected target.** The old AC scanned `dist/index.html` for `sha256:`; that clause was **vacuous** — the rows and banner are JS-rendered, so the built HTML contains no status output either way and the scan passes whether or not the defect exists. Run the allow-list assertion against **`dist/src/app.js`** instead, where the built renderer actually lives. Comment the test with `scripts/sign-kb.mjs:58-73`'s anemia hardcode as the reason it cannot be relaxed. | **Tier: source-asserted.** PROVES: the renderer's source in `src/app.js` **and** `dist/src/app.js` reads and emits only allow-listed fields, and no bulk-serialization construct is present; a seeded `manifest.clinicalContentHash` read, a seeded `JSON.stringify(manifest)`, or a seeded `sha256:` fragment each fail it; the negating-phrase carve-outs are exact rather than substring-loose (so "approvedBy is empty: no credentialed clinician has reviewed or approved this module" passes while a bare "approved" fails). DOES NOT PROVE: that no hash reaches the painted DOM — an injection path outside the scanned `functionBody()`, or a file not in `target_surfaces`, would escape. P6-011 reads the rendered banner and inspects the DOM for `sha256:` by hand | 0.75 | frontend engineer | sonnet | extended | claude | P3-04, P5-06 |
| P6-009-smoke | **Extend** `scripts/smoke-browser-unit-rejection.mjs` — runtime smoke over every touched UI surface (**AC-9**, R-P4, R-3) | **Extend, do not rewrite** (see the R-3 constraint above). Retain `:132`, `:134`, `:179`, `:188` and `:216-223` by keeping `assessPediatricAnemia` exported with its anemia call shape (delivered in P2-02). Extend `:179`/`:188` to also accept the module-generic `assessModule(currentModuleId, input, rules, candidates)` call. Add a **sibling** assertion block for the module-refusal UI, mirroring the existing `AGE_OUT_OF_SUPPORTED_RANGE` block at `:167-173`, so the third fail-closed state is pinned the same way input-rejection already is. **The previous AC claimed the smoke run "exercises default load, module switch, refusal render, and tab switch with `?module=` present". It cannot, and that claim is removed rather than softened** — the script has no DOM, no page load and no event dispatch, and says so at `:4-15`. Keep its existing two-part shape instead. **(a) Source-asserted half**: `functionBody()` over `src/app.js` proves the refusal UI exists, is textually distinct from `showInputRejection` and `showFatalError`, and is wired to the selection and submit paths; plus dev/dist link resolution over the four new app-surface files. **(b) Executed half**: import the built **non-DOM** graph from `dist/src/` and actually run it — `assessModule('anemia', input, rules, candidates)` produces the same classification as `assessPediatricAnemia(input, rules, candidates)`, and `isModuleSelectable()` returns `false` for each of the three `unsigned-stub` ids. Those are real executions because none of those modules touches the DOM. Resilience: the `dist/` scan for unstamped fetch specifiers (`:139-153`, `:149-153`) must pass against the FR-36 literal map — `?v=` stamping breaks its `` [^'"`?]+ `` class (SQ-3 §6). **Screenshots are NOT captured here** — they are P6-011's. | **Tier: executed + source-asserted.** `npm run smoke:browser` green; `git diff scripts/smoke-browser-unit-rejection.mjs` shows **additive** change only — no assertion at `:132`, `:134`, `:179`, `:188` or `:216-223` deleted or weakened; the boundary statement at `:4-15` is **retained verbatim and extended**, never removed. PROVES: the built non-DOM assessment graph behaves, and the app source contains the refusal wiring. DOES NOT PROVE: default load, module switch, refusal render, or tab switch — none of those is executable here, and no progress note may describe them as exercised | 1.25 | frontend engineer | sonnet | extended | claude | P2-02, P4-01, P5-06 |
| P6-010 | Import verification for new surfaces + **deliberate** `DEFAULT_MODULE_ID` tripwire decision (**AC-10**, R-6) | Two halves. (a) Confirm `src/moduleManifests.js`, `src/moduleStatusVocabulary.js`, `src/moduleKbLoaders.js` and `src/moduleEligibility.js` are all in `APP_SURFACE_FILES` (`scripts/check-app-imports.mjs:48`) — pass (a) is non-transitive, so an unregistered new file goes unchecked — and that all 8 `MODULE_KB_LOADERS` specifiers resolve in **both** dev and dist layouts and are `?v=`-stamped; if any of the 8 fails dev-or-dist resolution, `check:imports` must exit non-zero (the prefix-only path for template fetches must be unreachable from this feature). (b) Action **two separate tripwire comments**, which the plan previously merged. They have **different trigger conditions** and only one of them is about this feature.

**Tripwire A — `tests/module-registry.test.mjs:20-24`: already overdue, unrelated to this feature.** Its own comment says the assertion "must be updated/deleted **the day a second module registers**", and it still asserts "today there is exactly one registered module". **Four modules are registered.** That trigger **fired at commit `263120b` and was never actioned** — the comment is factually stale *today*, and would still be stale if this feature were cancelled. Correct the comment to state the count truthfully, and record in the commit message that the trigger had been unactioned since `263120b`. Do **not** present this as something this feature caused.

**Tripwire B — `src/modules/registry.js:39-50`: fired by this feature.** A different condition: *"the day a client-selectable moduleId surface actually ships (a UI control, an API parameter, a CDS Hooks card selector, etc.) — that is the real trigger … not merely the count of registered modules."* This feature ships exactly that. The decision to record: `DEFAULT_MODULE_ID` **stays `'anemia'`** — it is now the *initial* selection, not the *only* one, and no module status changed, so no other module is eligible to be the default. Update this comment to record that the trigger fired and how it was decided, citing **E1 FR-14/R-8 and ADR-0009** explicitly. This is a governance decision, not a mechanical edit (R-6).

The **commit message must address both separately** and cite E1 FR-14/R-8 + ADR-0009 for B. | `npm run check:imports` exits 0 with all four new files covered and 8 specifiers verified dev+dist; `tests/module-registry.test.mjs` passes with a comment that states the real module count and notes the trigger had been unactioned since `263120b`; `src/modules/registry.js:39-50`'s comment records that the *client-selectable-surface* trigger fired and how it was decided, citing E1 FR-14/R-8 and ADR-0009 by ID; the commit message treats A and B as distinct and does not attribute A to this feature | 0.5 | frontend engineer | sonnet | extended | claude | P1-03, P2-01, P2-03, P2-05, P0-02 |
| P6-011 | **HUMAN VERIFICATION — visual evidence capture and review** (**AC-1, AC-3, AC-4, AC-6, AC-7, AC-8, AC-9, AC-11**) | **This task is performed by a person, not an agent, and must not be dispatched to one.** It exists because `visual_evidence_required` appears on seven ACs and **no task in this plan provisions any capture mechanism** — nothing in this repository can drive a browser (D-6). Without it P6-GATE is unpassable. **Procedure.** Serve the built site locally (`npm run build`, then any static server over `dist/`). At **≥1440px** capture: (1) the module panel showing both groups and all four rows [AC-1]; (2) the banner under `anemia` (`integrity-recorded`) and under a scaffold (`unsigned-stub`), showing no green/approved state and both disclosures **in the panel, not on hover** — hover nothing, and confirm no `title=` tooltip is carrying either sentence [AC-3, AC-8, FR-11]; (3) the refusal state for the scaffold case — no results panel, audit download disabled, no "Check the entered units", no `undefined` anywhere on screen [AC-4]; (4) `#algorithm`, `#evidence`, `#rules` under a non-anemia module [AC-6]; (5) header, footer and the browser tab title under a non-anemia module [AC-7]; (6) default load [AC-9]. At **375px** capture the module panel again, confirming the rail does not clip [AC-1]. Then perform **two non-screenshot checks**: (7) **the forced-activation check [AC-11]** — open devtools, delete the `disabled` attribute from an ineligible row, activate it, and record what happens; the expected result is the refusal state, never an assessment; (8) **the DOM hash check [AC-8]** — search the live DOM (including every `data-*` attribute) for `sha256:` and record the result. **Recording.** Store the images under `.claude/worknotes/spa-module-switcher/visual-evidence/` and append a dated block to `.claude/progress/spa-module-switcher/phase-6-progress.md` listing, per AC, the file captured, the reviewer's **name**, and a plain-language pass/fail. A finding goes to `.claude/findings/spa-module-switcher-findings.md`. **Honesty constraint:** record these as *human observations*, never as test results, and never describe the feature as "verified" on their strength. | **Tier: human.** All eight items captured or performed; the images exist at the recorded paths; a **named person** (not an agent, not "the reviewer") is recorded against each; checks (7) and (8) have written outcomes; the phase progress note carries the dated block. **This task cannot be marked complete by an agent asserting it was done** — P6-KAREN verifies the artefacts exist and the name is a person's | 0.75 | **human (named)** | — | — | — | P6-001..P6-010 |
| P6-012 | **Forced-activation coverage — the predicate gates inside the handlers, not via `disabled`** (**AC-11**, FR-6 / FR-37) | The devtools vector. FR-37's programmatic disabling is a **presentation** guarantee: a user with devtools, a script, or an extension can delete the attribute and invoke the handler directly. This task proves the refusal survives that — that eligibility is decided **inside** the selection and KB-load handlers, not by reading DOM state. Assert, via `functionBody()` over `src/app.js`: (1) the **module-selection handler**, (2) the **KB-load function** (the P2-04 reset-before-fetch call site) and (3) the **assessment submit handler** each contain the FR-6 predicate call ahead of every `MODULE_KB_LOADERS` / `assessModule` / `assess` reference, with no early-return path that skips it; (4) **no** call site of those three symbols exists anywhere in `src/app.js` outside those guarded bodies; (5) none of the three reads eligibility from DOM state (`.disabled`, `aria-disabled`, `dataset.*`, a CSS class) — the predicate's input must be `moduleManifests[id].status`. Additionally, **execute** `src/moduleEligibility.js` (non-DOM) and confirm `isModuleSelectable('cbc_suite_v1') === false`, likewise for the other two stubs and for absent/out-of-enum status. | **Tier: source-asserted (+ executed predicate).** PROVES: no unguarded call site exists **in source**, the guard precedes the loader/engine reference in each of the three handlers, and eligibility is never read from DOM state; and the predicate itself really returns false for all three stubs. **DOES NOT PROVE** — and this is the load-bearing limitation — that invoking the selection handler directly with `cbc_suite_v1` refuses **at runtime**: `src/app.js` is DOM-dependent and node can neither import nor execute it, so no direct-invocation test is writable. The runtime half is closed **only** by P6-011 item (7), a human devtools check. Record it as such; a seeded eligibility read from `el.disabled` must fail this test | 0.5 | frontend engineer | sonnet | extended | claude | P2-03, P3-07, P4-01, P4-04 |
| P6-GATE | `task-completion-validator` gate | Verify the Phase 6 exit gate. **(1)** Full `npm run check` green (all 8 sub-gates). **(2)** Every PRD §11 `verified_by` ID exists and passes: `P6-001`..`P6-010`, `P6-009-smoke`, `P6-011`, `P6-012`. **(3) `visual_evidence_required` is satisfied by P6-011's record, not by an automated artefact** — confirm the images exist at the recorded paths, that a **named person** is recorded against each AC, and that items (7) forced-activation and (8) DOM hash search have written outcomes. This clause is what makes the gate passable at all; before P6-011 existed, no task provisioned any capture mechanism and the gate could not be met. **(4)** Confirm no AC, test name, or progress-note sentence describes a DOM-dependent behaviour as executed, spied, or "rendered" (D-6). **Reject if**: `smoke-browser-unit-rejection.mjs` was rewritten rather than extended; any pre-existing assertion was weakened to make a new one pass; its `:4-15` boundary statement was removed; the visual evidence is claimed without files and a human name; or a jsdom/headless-browser/test-runner dependency was added to `package.json`. | All four exit-gate clauses pass; recorded in the phase progress note, with the P6-011 reviewer named | — | task-completion-validator | sonnet | adaptive | claude | P6-001..P6-012 |
| P6-KAREN | **`karen` milestone review (Milestone 3)** | Independent review of the verification phase. Verify: **(1)** the smoke gate was **extended, not rewritten** — diff-check that all five original assertion sites and the `:4-15` boundary statement survive intact. **(2) Both tripwires were actioned, separately and correctly.** `tests/module-registry.test.mjs:20-24` — its "second module registers" trigger fired at `263120b` and had gone unactioned; confirm the comment now states the real count and that the commit does **not** attribute this to the present feature. `src/modules/registry.js:39-50` — a *different* trigger ("a client-selectable moduleId surface actually ships") which this feature does fire; confirm E1 FR-14/R-8 and ADR-0009 are cited in the comment and the commit (R-6). Reject a review that treats the two as one event. **(3)** No test was made to pass by weakening a prior assertion. **(4)** AC-8 is an **allow-list**, not a token scan, and runs against `dist/src/app.js` rather than the vacuous `dist/index.html`; carve-outs are exact, so a bare "approved" cannot slip through. **(5) P6-011 actually happened**: the screenshots exist, a **named human** signed them, and the forced-activation and DOM-hash checks have written outcomes. An assumed or agent-asserted P6-011 is a blocking finding. **(6)** Nothing in the phase's tests, ACs or progress notes describes a DOM-dependent behaviour as executed, spied or rendered, and no test dependency was added (D-6). | Milestone review recorded; findings fixed in-phase or logged to `.claude/findings/spa-module-switcher-findings.md` | — | karen | sonnet | extended | claude | P6-GATE, P6-011 |

**Phase 6 Quality Gates:**
- [ ] Full `npm run check` green (test, validate, coverage:rules, build, verify:d4, check:imports, smoke:browser, smoke)
- [ ] Every PRD §11 `verified_by` ID exists and passes: `P6-001`..`P6-010`, `P6-009-smoke`, `P6-011`, `P6-012`
- [ ] `smoke-browser-unit-rejection.mjs` **extended, not rewritten**; all five original assertion sites **and** its `:4-15` boundary statement intact (R-3)
- [ ] **Source** contains no `assess()`/`assessModule()`/`MODULE_KB_LOADERS` call site outside a body that evaluates the eligibility predicate first, in each of the three entry handlers (P6-012). *Not a runtime call-count — no spy is writable here (D-6).*
- [ ] `isModuleSelectable` **executed** and returns false for all three `unsigned-stub` ids and for absent/out-of-enum status
- [ ] Doc-truth test pins the vocabulary, panel header, honesty boundary, staleness disclosure and group headers; the no-green-state check asserts **resolved colour values**, not token names
- [ ] AC-8 is an **allow-list** over the renderer's emittable manifest fields (`id`, `title`, `status`, `knowledgeBaseVersion`, `evidenceReviewedThrough`, `approvedBy.length`), run against `src/app.js` **and `dist/src/app.js`**; the token scan is the secondary layer; carve-outs exact
- [ ] All four new app-surface files in `APP_SURFACE_FILES`; all 8 specifiers verified dev+dist and `?v=`-stamped
- [ ] **Both** tripwires actioned separately: `tests/module-registry.test.mjs:20-24` (overdue since `263120b`, not caused by this feature) and `src/modules/registry.js:39-50` (fired by this feature; cites E1 FR-14/R-8 + ADR-0009 in comment and commit)
- [ ] **P6-011 complete**: screenshots at ≥1440px (and 375px for AC-1) exist at the recorded paths, **signed by a named person**, with written outcomes for the forced-activation and DOM-hash checks
- [ ] No AC, test name or progress note describes a DOM-dependent behaviour as executed/spied/rendered; `package.json` still declares no `dependencies` and no `devDependencies`
- [ ] `karen` Milestone 3 review recorded

---

## Phase 7: Documentation Finalization

**Duration**: ~0.5–1 engineer-day
**Dependencies**: Phase 6 complete (wave 7)
**Assigned Subagent(s)**: documentation writer (general-purpose, haiku); `task-completion-validator`
gate; **`karen` end-of-feature review**
**Provider pin — load-bearing**: `provider: claude` on **every** task. `task_class: documentation`
resolves to free-tier Haiku regardless of the requested model (decisions block §6 routing finding);
without the explicit pin these tasks silently land on a free-tier route.
**Exit gate** (decisions block §1): doc-truth tests green; `tests/claudemd-check-gate.test.mjs` green.

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Provider | Dependencies |
|---------|-----------|-------------|---------------------|---------:|-------------|-------|--------|----------|--------------|
| DOC-001 | CHANGELOG `[Unreleased]` entry | `changelog_required: true`. Add an entry under `[Unreleased]` per Keep A Changelog and `.claude/specs/changelog-spec.md`. The entry must describe the honest outcome — an honest module inventory with one selectable module and three inert ones, and a fail-closed refusal replacing the misattributed unit-rejection — and must **not** describe any module as validated, verified, reviewed, approved or released. **It must also not imply browser-tested behavior** — this feature's UI behavior was established by source inspection plus one human review pass (PRD §11a), and words like "tested", "verified in the browser" or "end-to-end" would over-claim it. | Entry exists under `[Unreleased]` with correct categorization; contains no approval/release/validation claim and no implication of executed browser testing; `changelog_ref` set | 0.25 | documentation writer | haiku | adaptive | claude | P6-GATE |
| DOC-002 | README evaluation | Evaluate whether the repository README's feature/version surface changed. If it describes the SPA's single-module scope, update it to the honest four-module inventory; otherwise record **"N/A — README does not describe the SPA module surface"** with the specific lines checked. | README updated, or N/A recorded with the lines checked named explicitly | 0.25 | documentation writer | haiku | adaptive | claude | P6-GATE |
| DOC-003 | `docs/architecture.md` §2a / §6 / §10 (SQ-4 §5) | **§2a**: add a subsection describing the client-facing module-selection control — a **read-only consumer** of `listModules()`/`MODULE_IDS`, introducing **no new registry**. **§6**: one line noting the browser now surfaces `manifest.status` per module directly (previously only via the server response and `dist/build-info.json`), and that the browser verifies nothing. **§10**: add a fail-closed entry — selecting a non-eligible module (stub, or unregistered in the evidence registry) must show an explicit refusal, never a silent or broken partial render; today `src/evidence/registry.js` throws on an unknown id, and the switcher catches rather than crashes. **The §10 entry must state the verification ceiling in the same breath**: this refusal behavior is established by source inspection plus human review, not by an executed browser test (PRD §11a, ADR-0010) — an architecture doc that records the behavior without the ceiling would over-claim it. **§7 is not applicable** — no rule-authoring change. Keep `docs/architecture.md:385-391`'s staleness non-enforcement language intact and cross-reference it from §10. | All three sections updated; §7 explicitly untouched; §2a states "no new registry"; §10's entry names the refusal state; doc-truth tests green | 0.5 | documentation writer | haiku | adaptive | claude | P6-GATE |
| DOC-004 | `CLAUDE.md` orientation diagram + KB bullet (SQ-4 §6) | `CLAUDE.md`'s Architecture-orientation diagram and KB bullet still say only `modules/anemia/rules.json` / 91 rules / 26 patterns, understating the four registered modules. Generalize to the `deriveFacts(input, moduleId)` / `modules/<moduleId>/rules.json` shape and **cross-reference `docs/architecture.md` §2a's inventory table instead of restating anemia-only counts**. Follow the progressive-disclosure rule: pointer layer only, ≤3 lines per addition. **Do not touch** the `scripts.check` string — `tests/claudemd-check-gate.test.mjs` fails on drift and the string is copied verbatim from `package.json`. | `CLAUDE.md` generalized with a cross-reference rather than restated counts; `tests/claudemd-check-gate.test.mjs` green; the `npm run check` string is byte-unchanged | 0.5 | documentation writer | haiku | adaptive | claude | DOC-003 |
| DOC-005 | Plan frontmatter finalization | Set `status: completed`, populate `commit_refs`, `files_affected` and `updated`; set `changelog_ref`; populate `deferred_items_spec_refs` from DOC-006 (**five** paths now, incl. ADR-0010) and `findings_doc_ref` from DOC-007. | Frontmatter complete per the lifecycle spec; `deferred_items_spec_refs` lists all five DOC-006 paths; `findings_doc_ref` populated | 0.25 | documentation writer | haiku | adaptive | claude | DOC-001..DOC-004, DOC-006, DOC-007 |
| DOC-006 | **Author a design spec for each deferred item** (parent plan triage table) | One artifact per row, `maturity: shaping` (or `idea` where research is needed), `prd_ref` set to the switcher PRD, path appended to `deferred_items_spec_refs`. **DF-SMS-01** → `docs/project_plans/design-specs/sign-kb-per-module-content-hashing.md`: `scripts/sign-kb.mjs:58-73` hardcodes anemia's file list and `build-static.mjs:54-55` calls it per-module with no module id, so every module's `clinicalContentHash` is computed over anemia's files (currently masked because non-anemia hashes are `null` and `kbVerify.js:240` short-circuits); the spec must state that this is a **prerequisite for any integrity-hash UI** and that FR-31's prohibition stands until it is fixed. **DF-SMS-02** → `docs/project_plans/design-specs/per-module-evidence-view.md`: needs growth/kidney loaders in `src/evidence/registry.js:39-50`; note each module's existing `evidence.json` source counts (cbc 20, growth 11, kidney 12). **DF-SMS-03** → `docs/project_plans/design-specs/algorithm-explorer-module-generalization.md`: `anemiaWalkthrough` (`:290-303`) and the `facts.*` accessors (`:257-366`) are anemia-shaped; scope the generalization, do not perform it. **DF-SMS-04** → **update the existing** `docs/project_plans/design-specs/public-moduleid-api-surface.md` — verify P0-03's dated re-confirmation section is present and accurate, and append the switcher's shipped state as evidence that the "client needs to choose via the HTTP API" clause still has not fired. **DF-SMS-06** → author **`docs/adr/0010-browser-test-capability-for-the-spa.md`, `status: proposed`** (an ADR, not a design spec — it proposes changing a posture, not a design). It must record: that `package.json` declares no `dependencies` and no `devDependencies`; that `scripts/smoke-browser-unit-rejection.mjs:4-15` states the no-browser-automation posture deliberately; the concrete cost measured by this feature — behavioral fail-closure, banner placement and refusal transitions are source-asserted plus human-reviewed, never executed (PRD §11a); and that D-6 **refused** to add jsdom as a side effect of a UI feature. It must **not** claim the capability exists, must **not** be written as a plan to adopt one, and must state its own trigger: further safety-critical SPA UI, or a second selectable module. | Three new design specs plus ADR-0010 exist with correct frontmatter; the fifth (DF-SMS-04) existing spec verified/updated; all five paths appended to `deferred_items_spec_refs`; ADR-0010 is `proposed` and claims no capability; each artefact names its promotion trigger | 0.75 | documentation writer | haiku | adaptive | claude | P6-GATE |
| DOC-007 | Create & finalize the findings doc — **two findings are already known** | Create `.claude/findings/spa-module-switcher-findings.md` (lazy-creation rule; not pre-created, but two findings are known at planning time and **must** be recorded regardless). **Finding 1 (R-5 / DF-SMS-01)**: `scripts/sign-kb.mjs`'s anemia hardcode makes every module's `clinicalContentHash` a false attestation if surfaced; kept off-screen by FR-31; cross-reference the DOC-006 spec. **Finding 3 — the stale tripwire comment.** `tests/module-registry.test.mjs:20-24` says the assertion "must be updated/deleted the day a second module registers" and still asserts "today there is exactly one registered module"; four have been registered since commit `263120b`, so the trigger fired and went unactioned for a release. Record it as pre-existing debt this feature closed at P6-010 — **not** as something this feature caused, and not merged with the separate `src/modules/registry.js:39-50` trigger. **Finding 2 (SQ-3 F9 / DF-SMS-05)**: all 7 `cbc_suite_v1` rule evidence IDs (`HEMATOLREP2024_NEUTROPENIA_REVIEW`, `CALIPER2020_HEMATOLOGY_I`, `CALIPER2023_MINDRAY_79PARAM`, `SCNIR2022_GCSF_OUTCOMES`, `COH2015_ELANE_MUTATIONS`, `JPEDS2023_DUFFY_NULL_NEUTROPENIA`, `PEDS2020_ISOLATED_NEUTROPENIA_OUTCOMES`) resolve to nothing against `src/evidence.js:9,22` (anemia's 6 only) — citations silently vanish, breaching the CLAUDE.md guardrail "every clinical statement ties to a source". Unreachable while CBC is inert under D-1; a live bug the moment it becomes selectable. Add any execution-time findings. Advance `status: draft → accepted`, set `promoted_to` to this plan's path, and set `findings_doc_ref` in the plan frontmatter. | Findings doc exists with both known findings recorded and any execution-time findings appended; `status: accepted`; `promoted_to` set; `findings_doc_ref` populated in the plan frontmatter and appended to `related_documents` | 0.25 | documentation writer | haiku | adaptive | claude | DOC-006 |
| DOC-008 | Project-level skill updates | Check `.claude/specs/skills-index.md` for any project-level custom skill whose domain this feature touches. Expected outcome: **"N/A — no project-level skill domains affected"** (this feature adds no CLI, no workflow and no new agent capability). Record the check, not just the conclusion. | Affected skills updated, or N/A recorded with the skills-index entries checked named explicitly | 0.25 | documentation writer | haiku | adaptive | claude | P6-GATE |
| P7-GATE | `task-completion-validator` gate | Verify the Phase 7 exit gate: doc-truth tests green; `tests/claudemd-check-gate.test.mjs` green; all four deferred-item spec paths in `deferred_items_spec_refs`; `findings_doc_ref` populated and the doc at `status: accepted`. **Reject if** `CLAUDE.md` restates anemia-only counts instead of cross-referencing §2a, or if the `npm run check` string drifted. | All exit-gate criteria pass; recorded in phase progress note | — | task-completion-validator | sonnet | adaptive | claude | DOC-001..DOC-008 |
| FEATURE-KAREN | **`karen` end-of-feature review** | Final review across the whole feature, not just P7. Verify: (1) **no** artifact delivered by this feature is described as validated, verified, clinically reviewed, approved or released — in code, tests, docs, CHANGELOG or the feature guide; (2) **no** module manifest status changed and nothing was signed (FR-35) — re-run P0-04's check against the full feature diff; (3) the delivered UI shows one selectable module and three inert ones, and says so honestly; (4) the browser-verifies-nothing disclosure is present **in the panel, not a tooltip** — confirmed against P6-011's screenshots, since no test establishes placement; (5) every deferred item has a spec, an ADR, or a recorded finding; (6) **nothing in the feature — code, tests, docs, CHANGELOG, feature guide or PR body — describes DOM-dependent behavior as tested, executed or verified in a browser**, and PRD §11a survives intact and unsoftened. | End-of-feature review recorded; blocking findings resolved before the PR is opened | — | karen | sonnet | adaptive | claude | P7-GATE |

**Phase 7 Quality Gates:**
- [ ] CHANGELOG `[Unreleased]` entry present, with no approval/release/validation claim and no implication of executed browser testing
- [ ] `docs/architecture.md` §2a (read-only selection control, no new registry), §6 (browser surfaces `manifest.status`, verifies nothing), §10 (fail-closed refusal entry) updated; §7 untouched
- [ ] `CLAUDE.md` generalized to `deriveFacts(input, moduleId)` / `modules/<moduleId>/rules.json`, cross-referencing §2a rather than restating counts
- [ ] `tests/claudemd-check-gate.test.mjs` green; the `npm run check` string byte-unchanged
- [ ] Three new deferred-item design specs **+ ADR-0010 (`proposed`, DF-SMS-06)** authored, `public-moduleid-api-surface.md` verified; all five paths in `deferred_items_spec_refs`
- [ ] ADR-0010 records the ceiling and the D-6 refusal, and **claims no capability that does not exist**
- [ ] `.claude/findings/spa-module-switcher-findings.md` created with **all three** known findings (R-5 sign-kb; SQ-3 F9 cbc evidence IDs; the stale `tests/module-registry.test.mjs:20-24` comment, overdue since `263120b`), `status: accepted`, `findings_doc_ref` set
- [ ] README and project-skill checks completed or explicitly recorded N/A with what was checked
- [ ] Plan frontmatter finalized (`status: completed`, `commit_refs`, `files_affected`, `updated`)
- [ ] `karen` end-of-feature review recorded and blocking findings resolved

---

## Acceptance-criteria contracts (AC-1..AC-11)

Moved here from PRD §11 so the PRD stays inside its length budget while §11a's honesty disclosure
stays complete. **The PRD remains authoritative for each AC's statement, `target_surfaces`,
`verification_ceiling`, `visual_evidence_required` and `verified_by`** — this section holds only the
`propagation_contract` and `resilience` clauses. Read every contract below against **PRD §11a**: where
a contract says "renders" or "sets", it describes the behaviour the implementation must have, not a
behaviour any automated check in this phase establishes. The tier that actually establishes each one
is in the AC's `verification_ceiling` field and in the task rows above.

#### AC-1 — propagation contract & resilience

- propagation_contract: >
    `listModules()`/`MODULE_IDS` supplies the row set; display fields come from the frozen map in
    src/moduleManifests.js; group membership is computed once by the FR-4 predicate and passed to the
    row renderer in src/app.js; index.html supplies only the static container and the verbatim panel
    header; styles.css supplies the group and inert-row treatment from existing `:root` tokens.
- resilience: >
    A module.json missing an optional envelope field renders the required fields and omits the
    optional line — never an empty label, `undefined`, or a placeholder that could read as a value. A
    module in MODULE_IDS but absent from the manifest map lands in the not-selectable group with the
    FR-17 reason, never dropped.

#### AC-2 — propagation contract & resilience

- propagation_contract: >
    `READY_STATUS` is imported from src/kbVerify.js and compared against `moduleManifests[id].status`.
    That comparison is the sole gate on (a) row activatability and (b) whether MODULE_KB_LOADERS and
    assess() are ever invoked. The literal `'integrity-recorded'` appears in none of src/app.js,
    src/moduleEligibility.js, index.html.
- resilience: >
    A manifest whose `status` is absent or outside the closed enum is ineligible and routes to the
    FR-17 refusal — never defaulted to eligible.

#### AC-3 — propagation contract & resilience

- propagation_contract: >
    Every clinician-facing status string, the panel header, the FR-13 honesty-boundary sentence and
    the FR-34 staleness disclosure are exported from src/moduleStatusVocabulary.js and referenced by
    identifier in src/app.js. No status text is written inline in index.html or src/app.js.
- resilience: >
    A status value with no vocabulary entry yields the refusal sentinel plus the raw enum value, and
    fails the build — a missing entry must never fall back to friendlier text.

#### AC-4 — propagation contract & resilience

- propagation_contract: >
    A `showModuleRefusal(moduleId, reason)` path independent of `showInputRejection` sets
    currentAudit = null, hides #results, shows #results-placeholder, calls refreshAuditView(), and
    disables submit while leaving the module selector interactive. Each of FR-15..FR-18 supplies a
    distinct reason string; none is added to INPUT_REJECTION_CODES.
- resilience: >
    If refusal fires while a previous module's result is displayed, the prior result is cleared
    before the refusal renders and the audit download is disabled in the same tick; rules/candidates
    are reset to []/{} before any new fetch (FR-18).

#### AC-5 — propagation contract & resilience

- propagation_contract: >
    On load `?module=` is read, validated with isRegisteredModule(), and drives initial selection;
    selection writes it back with history.replaceState preserving the `#tab` hash; switchTab's
    replaceState (app.js:457) is rewritten to preserve the query string.
- resilience: >
    Absent param → DEFAULT_MODULE_ID. Unregistered or ineligible param → explicit refusal naming the
    requested id (FR-21); no silent substitution. No localStorage/sessionStorage/cookie read or
    written (FR-24).

#### AC-6 — propagation contract & resilience

- propagation_contract: >
    The active moduleId is the single input to the degradation decision for #algorithm (FR-25),
    #evidence (FR-26), the #rules empty state (FR-27) and the examples picker (FR-28). Nav counts are
    set from the loaded module's own rules/candidates and index.html's static 91/26 fallback is
    neutralized (FR-29).
- resilience: >
    Zero-rule module → explicit #rules empty state, not a blank panel. No registered evidence loader
    → "no evidence view for this module", not an empty source list. Examples picker empty **and**
    disabled, never offering anemia cases.

#### AC-7 — propagation contract & resilience

- propagation_contract: >
    `manifest.title` drives document.title, the <h1>, brand and footer copy (index.html
    :6,11,19,24,76,416,435,577). document.title must not carry anemia's KNOWLEDGE_BASE_VERSION under
    another module (SQ-3 F11).
- resilience: >
    If manifest.title is missing (schema-impossible; defence in depth) the surface renders the
    moduleId verbatim, never a generic "Assessment" that hides which module is active.

#### AC-8 — propagation contract & resilience

- propagation_contract: >
    **Allow-list, not token scan (D-6 corollary).** The row/banner renderer may read and emit ONLY:
    `id`, `title`, `status`, `knowledgeBaseVersion`, `evidenceReviewedThrough`, `approvedBy.length`.
    (`engineLabel` and the module's own `limitations()` text come from the hooks, not the manifest,
    and are separately permitted by FR-3.) Every other manifest property — `clinicalContentHash`,
    `hashes`, `validationRunId`, `clinicalApprovers`, `approvedBy` as a value, and anything a future
    schema version adds — is **structurally unreachable**, not merely forbidden. The assertion
    enumerates permitted property reads inside the renderer's functionBody() and fails on any other
    `manifest.<field>` or destructured key, and fails outright on `JSON.stringify(manifest)`,
    `{...manifest}`, `Object.entries(manifest)`, or assignment of the manifest object (or any
    un-narrowed subset) into a `data-*`/`dataset` property, `innerHTML` or `textContent`.
    **Why primary:** `modules/anemia/module.json` carries a real `clinicalContentHash: sha256:97e65556…`,
    D-2 imports it into the browser graph by design, and `JSON.stringify(manifest)` into a row would
    emit it while passing a prohibited-token scan cleanly.
    The token scan is **retained as a weaker second layer** over src/app.js, index.html,
    src/moduleStatusVocabulary.js and styles.css: `sha256:`, `hashes.recomputed`, "integrity
    verified", "content unmodified", "approved" outside the negating FR-9 phrase, "clinically
    reviewed" outside a negating phrase, "released", "validated" outside "not clinically validated",
    and any success/green status class.
    **The dist clause is corrected.** The old contract scanned `dist/index.html` for `sha256:`; that
    is **vacuous** — rows and banner are JS-rendered, so the built HTML contains no status output
    either way and the scan passes whether or not the defect exists. The dist half now runs the same
    allow-list assertion against `dist/src/app.js`, where the built renderer actually lives.
- resilience: >
    A future manifest field carrying a hash still cannot be emitted: the allow-list enumerates what
    MAY be read, not what MUST NOT. A new schema field needs an explicit, reviewed addition here.

#### AC-9 — propagation contract & resilience

- propagation_contract: >
    `scripts/smoke-browser-unit-rejection.mjs` is **extended, not rewritten** (R-3): it retains the
    existing assertions at :132,:134,:179,:188,:216-223 by keeping assessPediatricAnemia exported and
    its call shape intact, and adds sibling assertions for the assessModule call shape and for the
    module-refusal UI, mirroring the existing AGE_OUT_OF_SUPPORTED_RANGE block. The extension keeps
    the script's own two-part shape (`:4-15`): **(a) source-asserted half** — functionBody() over
    src/app.js proves the refusal UI is present, is textually distinct from showInputRejection and
    showFatalError, and is wired to the selection and submit paths, plus dev/dist link resolution over
    the new app-surface files; **(b) executed half** — the built NON-DOM graph is imported from
    dist/src/ and actually run: `assessModule('anemia', …)` yields the same classification as
    `assessPediatricAnemia(…)`, and `isModuleSelectable()` returns false for each unsigned-stub id.
    Those are real executions because none of those modules touches the DOM.
- resilience: >
    The dist/ scan for unstamped fetch specifiers must pass against the FR-36 literal map
    (`?v=` stamping breaks the scan's `[^'"`?]+` class, as verified in SQ-3 §6).

#### AC-10 — propagation contract & resilience

- propagation_contract: >
    src/moduleManifests.js and src/moduleStatusVocabulary.js are added to APP_SURFACE_FILES
    (check-app-imports.mjs:48) — pass (a) is non-transitive, so an unregistered new file goes
    unchecked. All 8 MODULE_KB_LOADERS specifiers resolve in both dev and dist layouts and are
    `?v=`-stamped. The tests/module-registry.test.mjs:24 DEFAULT_MODULE_ID tripwire is decided
    deliberately, with E1 FR-14/R-8 and ADR-0009 cited in both the test comment and the commit.
- resilience: >
    If any of the 8 specifiers fails dev-or-dist resolution, check:imports exits non-zero — the
    prefix-only path for template fetches must not be reachable from this feature.

#### AC-11 — propagation contract & resilience

- propagation_contract: >
    **The devtools vector.** FR-37's `disabled` attribute is a presentation guarantee, not a gate — a
    user with devtools (or a script, or an extension) can delete it and fire the handler directly.
    The FR-6 predicate must therefore be evaluated INSIDE the handlers, so invoking the selection
    handler directly with `cbc_suite_v1` still refuses. Each of these three bodies must contain the
    eligibility check ahead of any MODULE_KB_LOADERS / assessModule / assess reference, with no
    early-return path that skips it: (1) the module-selection handler, (2) the KB-load function (the
    P2-04 reset-before-fetch call site), (3) the assessment submit handler. No call site of those
    three symbols may exist anywhere in src/app.js outside those guarded bodies.
- resilience: >
    A handler reading eligibility from DOM state (`el.disabled`, `aria-disabled`, `dataset.*`, a CSS
    class) instead of from the manifest predicate FAILS this AC — DOM state is user-editable and is
    not the source of truth. The predicate's input is `moduleManifests[id].status` (AC-2).

[Return to Parent Plan](../spa-module-switcher-v1.md)
