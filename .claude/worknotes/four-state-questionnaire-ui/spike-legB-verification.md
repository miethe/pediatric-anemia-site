# SPIKE Leg B — verification ceiling for a four-state questionnaire control

## 1. `smoke-browser-unit-rejection.mjs` static-analysis technique

The script never imports `src/app.js` as a module. It `readFileSync`s the raw source text
(`scripts/smoke-browser-unit-rejection.mjs:145`) and runs a hand-written brace-depth scanner,
`functionBody(source, name)` (`scripts/smoke-browser-unit-rejection.mjs:45-104`):

- Finds `function <name>(` via regex (`:46`), then the first `{` after it (`:49`).
- Walks character-by-character from that `{`, tracking quote state (`'`/`"`/`` ` ``, with escape
  handling, `:72-81`), line comments (`:82-86`), block comments (`:87-91`), and brace `depth`
  (`:96-101`). When `depth` returns to 0 it slices and returns the function body as a **string**
  (`:99`).
- A sibling `eventHandlerBody(source, eventName)` (`:106-122`) does the same for
  `form.addEventListener('submit', ...)` bodies, keyed off the literal marker text (`:107`).

Every assertion downstream (`:182-261`) is then a `assert.match`/`assert.doesNotMatch` regex test
against that extracted **text**, e.g. `assert.match(rejectionBody, /currentAudit\s*=\s*null/)`
(`:185`). This is source-shape pinning, not execution — it proves the literal characters exist in
the right lexical scope, never that they run correctly against a live DOM.

**Extensibility to four-state serialization:** yes, mechanically — you could extract
`buildInput()`'s body text and regex-assert it still calls e.g. `triField('leukopenia')` instead
of `checked('leukopenia')`, the way `module-registry.test.mjs:80-163` and
`module-switcher-eligibility.test.mjs:29-34,126` already do this exact brace-scan against
`src/app.js` for other functions. But this only proves *the right identifier appears at the right
call site* — it cannot prove the four-state read/write logic itself is correct, because the logic
being checked is dead text to Node, never invoked. See §3 for the honest way to actually execute
that logic.

## 2. Test inventory — imports of `src/app.js`

`tests/*.mjs` grep hits on the string `src/app.js` (8 files) are **all static source-text reads**,
never `import`/`await import` of the module:

- `tests/module-registry.test.mjs:80` — `readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8')`,
  explicitly labelled `// TIER: source-asserted only. src/app.js is DOM-dependent and node cannot
  import or execute` (`:72`).
- `tests/module-switcher-eligibility.test.mjs:29,32` — same pattern, same caveat at `:9-10`:
  "`src/app.js` is DOM-dependent. Node cannot import or execute it."
- `tests/module-status-vocabulary.test.mjs:4` — comment referencing the future full doc-truth pin
  across `index.html`/`src/app.js`/`dist/`, not itself importing it.
- `tests/kb-diff.test.mjs:1029` — lists `src/app.js` as a file **declared out of diff scope**
  (`filesNotDiffed`), a "blind by construction" family, not something the test executes.

**Zero** test files `import`/`await import()` `src/app.js`. It is genuinely unimportable under
plain Node — confirmed by two concrete lines:

- `src/app.js:39` — `const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];`
  — `document` only appears as a default-parameter reference inside a function body, so this line
  alone would not throw at import time (default params are lazily evaluated).
- `src/app.js:40` — `const form = $('#assessment-form');` — this is a **top-level, module-scope**
  statement. It calls `$()` immediately at import time with no `root` argument, so `$()`'s default
  parameter `document` is evaluated *now*. Under Node, `document` is an unbound global →
  `ReferenceError: document is not defined`, thrown during module evaluation, before any test
  assertion can run. This one line makes the entire file non-importable in Node, full stop.

(A second, independent top-level DOM read exists at `src/app.js:46` —
`$('#example-select')?.innerHTML ?? ''` — but `:40` already fails first.)

## 3. Option A — extract pure serialization logic into a DOM-free module

**Precedent already exists in this exact shape.** `src/facts/tristate.js` is a zero-DOM,
zero-import pure module (`toTri`, `countPresent`, `anyUnknown`, `allAssessed`,
`src/facts/tristate.js:1-36`) that `src/app.js` already imports and calls
(`src/app.js:10` `import { toTri } from './facts/tristate.js'`), and it is fully round-trip tested
under plain Node with no shim: `tests/tristate-operators.test.mjs:1-4` imports it directly;
`tests/tristate-safety-invariant.test.mjs:30`; `tests/property.test.mjs:275`.

Auditing the four named functions against this precedent:

| function | app.js line | DOM-coupled? | why |
|---|---|---|---|
| `checked(name)` | `:102-105` | **Yes** | calls `field(name)` → `form.elements.namedItem(name)` (`:85-87`), a live `HTMLFormElement` API; reads `element.checked`, `instanceof RadioNodeList` (browser global). |
| `booleans(names)` | `:144-146` | **Yes** | pure `Object.fromEntries` shape, but maps every name through `checked()`, inheriting its DOM coupling. |
| `buildInput()` | `:148-220` | **Yes** | calls `numeric()`/`value()`/`checked()`/`booleans()`/`checkedValues()` for every field — every leaf read touches `field()` → `form.elements`. Not importable in isolation without dragging the whole DOM-coupled call chain. |
| `setSimpleField(name, val)` | `:1462-1468` | **Mostly yes, with one already-pure line** | `field(name)` (DOM) gates it, and it *writes* `element.checked`/`element.value` (DOM), but the decision line `element.checked = toTri(val) === 'true'` (`:1466`) is already a pure tri-state mapping delegated to `src/facts/tristate.js`. |

So none of the four named functions is pure today — all read or write live DOM nodes via `form`.
But the pattern this repo already validated with `tristate.js` is directly reusable: pull the
**decision logic** (given a stored/serialized value, what tri-state does it represent; given a
tri-state, what should the control's serialized value be) into a new module, e.g.
`src/facts/fieldState.js`, containing pure functions like `triFromControlValue(raw)` and
`controlValueFromTri(tri)` with **no** `document`/`form`/`RadioNodeList` reference anywhere in the
file. `checked()`/`setSimpleField()`/`buildInput()` would then call into that module instead of
inlining the mapping — mirroring exactly how `setSimpleField:1466` already calls `toTri()`.

**Cost:** low. This is a small, additive, well-precedented extraction — write the pure module (a
few functions, same shape as `tristate.js`'s ~35 lines), re-wire the 3-4 call sites in `app.js` to
import and use it, and write a `tests/field-state-*.test.mjs` that imports it directly and asserts
round-trip behavior the same way `tristate-operators.test.mjs` does. It does **not** make
`buildInput()`/`checked()`/`setSimpleField()` themselves importable — `form.elements.namedItem`
still gates every one of them — but it moves the actual four-state *logic* (the part with bugs
worth catching) into something Node can execute directly, which is the honest, maximal claim
available without a DOM.

## 4. Option B — hand-rolled `document` shim in the test file

**Verdict: dishonest, or at best proves nothing new.** A fake `{ querySelector, querySelectorAll,
getElementById }` object satisfies `app.js:39-40`'s syntax but not its semantics: real
`HTMLFormElement.elements`, `RadioNodeList` identity checks (`instanceof RadioNodeList` at
`:91,104,1465,1641`), `element.checked`/`element.value` getters/setters, `classList.toggle`
(`:271`), `style.width` (`:294`), and `innerHTML` parsing (`:311,46`) are all real browser
behavior with edge cases (e.g., does setting `.checked` on a synthetic object trigger the same
downstream reads as a real `<input>`?). A hand-shim can only encode the test author's own
assumptions about what the DOM does — it cannot catch a bug where those assumptions are wrong,
which is precisely the class of bug a real browser test exists to catch. It would let
`smoke-browser-unit-rejection.mjs`'s own boundary text (`:337`, "no browser automation dependency
is available") become quietly false in spirit while staying true in fact. If used, it must be
labelled in the plan as **"proves internal consistency with the shim's own model of the DOM, not
browser behavior."** Do not present it as a substitute for real DOM/browser verification.

## 5. Existing precedent for asserting on `index.html` content

Yes — `index.html` is already read as raw text and regex-checked, twice:

- `tests/module-switcher-eligibility.test.mjs:31,34` —
  `const indexHtmlPath = path.join(repoRoot, 'index.html'); const indexHtmlSource =
  readFileSync(indexHtmlPath, 'utf8');`
- Used at `tests/module-switcher-eligibility.test.mjs:223-230` (`P6-002` test: asserts the literal
  `'integrity-recorded'` string never appears in `index.html`) and again at `:535` (`P6-006`:
  asserts `index.html` never contains `localStorage`/`sessionStorage` patterns, FR-24).

This sets the honest ceiling precisely: **text-presence/absence assertions on markup are an
established, legitimate pattern here** — but they have never been used to assert on rendered DOM
state, computed styles, event wiring at runtime, or user-visible behavior. Every existing
`index.html` test is "does this string exist/not exist in the file," never "does this element
behave correctly when clicked."

## Recommendation

Do **both**, layered:

1. **Extract the tri-state read/write mapping into `src/facts/fieldState.js`** (Option A), a pure,
   zero-DOM module mirroring `src/facts/tristate.js`'s existing, already-tested pattern. Write
   `node --test` coverage against it directly — this is the only path that lets a Node test
   *execute* the actual four-state logic rather than merely grep for it.
2. **Add static source-shape pins** on `src/app.js` and `index.html` using the exact
   `functionBody`/regex technique from `smoke-browser-unit-rejection.mjs:45-104` and
   `module-switcher-eligibility.test.mjs` — e.g., assert `checked()`/`setSimpleField()` call the
   new `fieldState.js` functions, and assert `index.html`'s four-state markup contains the
   expected `data-*`/`aria-*` attributes as text. This catches drift between the wired-up UI and
   the tested logic without claiming to execute it.
3. Do **not** write a `document` shim (Option B) and present it as DOM verification — reject it
   outright, or if used for author-local sanity-checking only, exclude it from `npm run check` and
   label it in code comments as testing the shim's model, not the browser.
4. Every remaining claim below must be labelled "manually verified only" in the plan.

## Cannot Be Proven

By any automated check available in this repo (zero dependencies, no DOM, no browser automation):

- That the four-state control **renders** correctly in any browser (layout, visual state per
  state, focus rings, contrast).
- That **clicking/tapping/keyboard-navigating** the four-state control produces the correct next
  state (cycling order, ARIA state changes) — no test can dispatch a real event.
- That `checked()`/`setSimpleField()`/`buildInput()`/`populateFromInput()` correctly read from or
  write to a **live** `<input>`/custom-element instance — these functions stay DOM-gated
  (`field()` → `form.elements.namedItem`) even after the Option A extraction; only the pure
  decision logic inside them becomes testable, not the DOM read/write itself.
- That the control is **accessible** (screen-reader announcement of the fourth state, keyboard-only
  operability, focus order) — no automated check in this stack asserts accessibility semantics
  beyond the existing `role="note"` text-presence checks (`smoke-browser-unit-rejection.mjs:255`).
- That replacing 57+ checkboxes does not **visually break** the 655-line hand-written
  `index.html` layout (spacing, wrapping, mobile breakpoints).
- That `form.reset()` / browser autofill / paste interact correctly with the new control type.
- Any cross-browser behavioral difference (Safari vs. Chrome vs. Firefox rendering/handling of the
  new control markup).
