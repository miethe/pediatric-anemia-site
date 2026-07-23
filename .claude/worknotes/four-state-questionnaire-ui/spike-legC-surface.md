# SPIKE Leg C — Surface Strategy & Blast Radius (four-state questionnaire UI)

## 1. Markup pattern — uniform, with 3 cosmetic variants

Representative field (`index.html:220`, inside `.check-grid`):

```html
220:              <label><input name="hemodynamicInstability" type="checkbox"> Hemodynamic instability</label>
```

Census over all 84 checkboxes (`grep -n 'type="checkbox"' index.html`): **69** are the bare
`<label><input name="X" type="checkbox"> Text</label>` form inside a `.check-grid` wrapper div;
**3** add `class="check-label"` (`menstruating`/`recentTransfusion`/`highAltitude`,
`index.html:191-193`) because they sit inside a `.field-grid` alongside number/select inputs, not
a `.check-grid`; **1** adds `class="safety-clear"` and uses `id` instead of `name`
(`index.html:218`, the non-serialized safety-reviewed checkbox); **11** are `name="smear"
value="..."` multi-select checkboxes (`index.html:416-426`). No field has a nested fieldset,
conditional section, inline help text, or `data-` attribute — the 57 booleanMap fields are
markup-identical modulo the 2 cosmetic class variants above. This is good news for either surface
strategy: there is no per-field special-casing to preserve.

## 2. Declarative viability

Yes — `symptomNames`/`historyNames`/`examNames` (`src/app.js:111-131`) are already the exact
name-list a generator would need; they're also duplicated as literal `name="..."` markup, so the
registry and the DOM already have to stay in sync by hand today (a latent drift risk regardless of
which surface strategy wins). A runtime generator is mechanically trivial: `names.map(name =>
radiogroupMarkup(name, label))`.

What would be lost: (a) **static-HTML review-ability** — CLAUDE.md's guardrail model depends on a
human being able to read `index.html` and see every clinical field verbatim; runtime-generated
markup moves that review surface into `src/app.js` (a defensible move, not a loss, if reviewers
adapt — but it is a real change in *where* the review happens, not a neutral refactor). (b)
**no-JS fallback** — none exists today either (`server.mjs`/`build-static.mjs` ship a JS-required
SPA with no `<noscript>` path), so this is not a new regression. (c) **SEO** — irrelevant; this is
a clinician tool behind no public index. (d) A generator needs a **label source of truth**: today
the human-readable text ("Hemodynamic instability") lives only in the HTML, not in
`symptomNames`/`historyNames`/`examNames` (plain string arrays, no label field) — a declarative
approach must add a `{name, label}` registry, which is itself a schema change to `src/app.js:111-
131`, not a pure markup change.

## 3. Blast radius on `src/app.js` — 8 functions, ~35 call sites

| Function | Lines | Role |
|---|---|---|
| `checked(name)` | `102-105` | Reads one field's `.checked`; guards against `RadioNodeList` (radio groups already return a `RadioNodeList` from `form.elements.namedItem`, so this guard exists *because* radio groups are already a first-class case in this codebase) |
| `checkedValues(name)` | `107-109` | `querySelectorAll` for all `:checked` — the smear multi-select path |
| `booleans(names)` | `144-146` | Maps a name list through `checked()` — feeds `symptoms`/`history`/`exam` |
| `buildInput()` | `148-219` | 13 direct `checked('name')` calls (`153-155`, `176-179`, `204-210`) + 3 `booleans(...)` calls (`186-188`) + 1 `checkedValues('smear')` (`218`) |
| `anyChecked(names)` | `254-256` | `names.some(checked)` — used by workflow-step completion and depth scoring |
| `updateWorkflowState()` | `258-...` | `261` `$('#safety-reviewed-no-flags')?.checked`, `264-267` `checked(...)`/`anyChecked(...)`/`checkedValues('smear').length` |
| `updateCaseUi()` | `275-292` | `282` `immediateSafetyNames.filter(checked)`, `290` `anyChecked(...)`/`checkedValues('smear').length` (progress-bar depth heuristic) |
| `setSimpleField(name, val)` | `1462-1467` | Writes `element.checked = toTri(val) === 'true'` — the boolean-only write path (`1466`) |
| `populateFromInput()` | ~`1490-1507` | `1501` sets smear `element.checked = true` per value; `1506` sets safety-reviewed checkbox directly |
| module-switcher-adjacent inline listeners | `1634-1650` | `1638` `event.target.checked`, `1641` writes `element.checked = false` for every `immediateSafetyNames` field when safety-reviewed is ticked, `1649` reverse direction |

**Total: ~35 source lines across 10 call sites/functions** read or write `.checked` directly or via
`checked()`/`checkedValues()`/`anyChecked()`. Every one of them assumes a **2-state DOM control**
(`element.checked` boolean) mapped onto the **3-state** wire model (`'true'|'false'|'unknown'`,
`src/facts/tristate.js:1-10`) — `setSimpleField:1466` collapses `'false'` and `'unknown'` to the
same unchecked visual state today. A move to a real 4-way (or 3-way) exclusive control changes
every one of these 10 sites' *read* semantics (`checked()` must become "get selected radio value,"
not "get boolean") but not their call-site *count* — `booleans()`/`anyChecked()`/`buildInput()`
keep the same shape, only `checked()`'s internals change, plus `setSimpleField`/`populateFromInput`
need a write-side equivalent for radios (`element.checked=true` → "check the matching radio by
value"). This concentrates the change in ~4 low-level functions (`checked`, `checkedValues`→same,
`setSimpleField`, `populateFromInput`'s smear/safety lines) rather than fanning out to all 10.

## 4. Module switcher interaction — no conflict, by construction

`activateModule()` (`src/app.js:1198-1198+`) never touches the questionnaire form's DOM. It only:
disables/enables `#run-assessment`/`#load-example`/`#example-select` (`src/app.js:1220-1222`),
clears `currentAudit`/toggles `#results`/`#results-placeholder` (`1218-1219`), and re-renders the
switcher/banner/example-options/algorithm-tab (`1223-1230`). `updateAssessmentEnablement()`
(`src/app.js:1025-1033`) is the same story — button/select `.disabled`, nothing form-internal.
Only one module (`anemia`) is currently selectable (`isModuleSelectable`,
`src/moduleEligibility.js`), so there is no existing "swap the field set per module" code path to
break — the questionnaire markup is static regardless of `activeModuleId`. Converting checkboxes
to radio groups therefore does **not** interact with the switcher: it operates one layer up (which
module's *rules* run) from where the surface change happens (which control renders *a field's
value*). The one adjacent behavioral coupling worth flagging is unrelated to the switcher: the
safety-reviewed checkbox mutual-exclusion logic at `src/app.js:1634-1650`, which directly sets
`.checked` on every `immediateSafetyNames` field — this WILL need rewriting for radios (setting a
"false"/"unknown" radio, not just unchecking a box).

## 5. Accessibility & density recommendation

Correct accessible markup for an exclusive 4-way choice is `<fieldset role="radiogroup">` (native
`<fieldset><legend>` already implies the grouping semantics assistive tech needs — no explicit
`role` required) wrapping 4 `<input type="radio" name="X" value="...">` + `<label>` pairs, OR a
`<select>` with 4 `<option>`s. There is no existing radiogroup idiom in `styles.css` — a new
`.tri-group`/`.quad-group` component is needed either way (fact given).

At 57×4 = 228 inputs on one page, a native `<select>` is the stronger default for clinician
throughput: it collapses each field to **one interactive element** in the tab order (228 radios
means 228 tab-stops + 228 arrow-key targets vs. 57 tab-stops for selects), keeps the existing
`.check-grid` 3-column density (a 4-radio fieldset needs roughly 3-4x the vertical/horizontal
space of a checkbox+label, wrecking the current 3-per-row grid), and clinicians are already fluent
with `<select>` idioms elsewhere in this exact form (`rbcInterpretation`, `ferritinStatus`,
`crpStatus`, etc. — 20+ status `<select>` fields already exist, `index.html:184-190, 296-336`
region). The counter-case for radios is scan-ability of *all 4 options at once* without opening a
dropdown — valuable for a true either/or clinical judgment call, but at this density (57 repeats)
that benefit is outweighed by page length and keyboard-navigation cost. **Recommendation: `<select>`
with 4 options (`Unknown` / `Not assessed` / `Present` / `Absent`, ordering TBD by Leg A/B), not a
radio group**, unless a later leg's user-research finds clinicians specifically need see-all-4
scanning for this field type.

## 6. Prior decisions found

No ADR or doc constrains SPA markup *style* (no "no runtime-generated markup" rule found in
`docs/` or git log). But **SPIKE-003** (`docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-
migration.md:579-584`, "Alternatives considered") explicitly **rejected** a 4th enum state
(`'not-assessed'` distinct from `'unknown'`) for the wire/fact model, on the grounds that "no
concrete rule or fact in the audited 91 needs to distinguish [it] ... operationalizing it as a 4th
enum value with no consumer would be speculative scope." The current wire model is 3-state
(`'true'|'false'|'unknown'`, `src/facts/tristate.js:4`). **This directly bears on the parent
plan's premise**: if "four-state" means a 4th distinct value, that conflicts with a recorded,
reasoned rejection from 5 days ago (2026-07-19) and would need new evidence to reopen, not just a
UI-layer decision — Leg A/B should confirm whether "four-state" means 4 *UI options* mapping onto
the *existing* 3 wire states (e.g., a UI-only "not assessed yet" default distinct from an explicit
"unknown/can't determine" answer, collapsing to the same wire value) or a genuine 4th wire state.
Separately, SPIKE-003 (`:271-278`) also found and recorded that `src/algorithmExplorer.js:308` is
the *only* other UI site reading a boolean-shaped fact — confirmed still true (not re-verified line
number in this leg, but no new render site was found in this leg's `src/app.js` sweep).

## 7. Tests/scripts that would break

- `tests/module-switcher-eligibility.test.mjs:227,535` — string-scans raw `index.html` text for
  absence of literal patterns (e.g. storage APIs) and for the literal string `'integrity-recorded'`
  (`:223-230`). A generator that emits equivalent HTML text would still pass these — they assert
  *absence* of forbidden substrings, not presence of the checkbox markup itself. Safe either way.
- `tests/module-switcher-eligibility.test.mjs` also uses a `functionBody(appSource, 'name')` helper
  (seen operating on `activateModule`/`switchTab`) that extracts a named function's source text and
  asserts on internal ordering/absence of tokens (`:500-513`). None of the extracted functions
  (`activateModule`, `switchTab`) overlap the checkbox-handling functions in §3 — **no direct hit**,
  but the *pattern* means any new/renamed function in this family (e.g. a new `setRadioField`)
  should expect similar literal-source-scanning tests to exist or be added.
- No test in `tests/*.mjs` asserts on `checked(`/`booleans(`/`buildInput` *source text*; the
  domain-level tests (`tests/boundary.test.mjs`, `tests/dangerous-miss-*.test.mjs`,
  `tests/property.test.mjs`) all call `assess()`/the engine directly with hand-built JS objects —
  they never touch the DOM or `index.html`, so they are wire-model tests, insulated from whichever
  surface strategy wins. **They would only break if the wire shape itself changes** (e.g. a real
  4th enum value), which is a data-model question (§6), not this leg's surface question.
- `scripts/build-static.mjs:13,114,122-123` copies `index.html` byte-for-byte into `dist/` and does
  a global asset-stamp regex replace on `<script>`/`<link>` tags — it does not parse or validate
  checkbox markup, so it is indifferent to either strategy.

## Recommendation

**Generate the 57 booleanMap fields' controls from a declarative registry at build time (a Node
script under `scripts/`, run as part of `npm run build`, emitting the `<select>`/radiogroup markup
into `index.html` from a `{name, label}` list) rather than either hand-editing 57 fields or
generating markup at runtime in the browser.** This keeps the review surface as static HTML (the
CLAUDE.md guardrail's concern in §2) while eliminating the current hand-sync risk between
`src/app.js:111-131`'s name arrays and the markup (already a latent bug source today), and touches
`src/app.js` in only the 4 functions identified in §3 (`checked`, `setSimpleField`,
`populateFromInput`'s smear/safety lines, and the `immediateSafetyNames` mutual-exclusion listener
at `1634-1650`) rather than 10.

**Rough per-field change cost**: near-zero incremental cost once the build-time generator and the
new `.tri-group`/`select` CSS component exist (est. 1 field ≈ 1 registry entry, seconds) — the cost
is almost entirely front-loaded into building the generator + the 4 shared functions once (est.
1-2 days), not multiplied by 57. Hand-editing instead is the reverse: near-zero setup cost, but
~57 repetitions of a multi-line markup change plus 57 chances for a copy-paste name/label mismatch,
with the same 4-function `src/app.js` cost either way.

**Strongest counter-argument**: a build-time generator is a **new build-step dependency** in a
repo whose CLAUDE.md orientation explicitly frames the SPA as zero-dependency/no-build-step for
itself (`scripts/build-static.mjs` today only copies/stamps files, it doesn't generate markup) —
introducing markup generation, even at build time and even review-friendly to output, is a bigger
architectural step than either of the two options this SPIKE was asked to weigh between, and a
reviewer could reasonably prefer hand-editing 57 fields specifically *to avoid* adding that
machinery, accepting the copy-paste risk as the lesser evil.
