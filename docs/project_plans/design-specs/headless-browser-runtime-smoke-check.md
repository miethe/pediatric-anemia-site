---
doc_type: design_spec
title: "Headless-Browser Runtime Smoke Check"
status: draft
maturity: shaping
created: 2026-07-18
updated: 2026-07-21
feature_slug: platform-foundation-p0
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
---

# Headless-Browser Runtime Smoke Check (DEF-8)

> **EP-7 re-confirmation note (2026-07-21).** This spec's own promotion trigger — "EP-1/EP-2
> substantively edit `src/app.js`/`algorithmExplorer.js` beyond today's shim boundary" — **has
> fired**. EP-2 added ~50 lines of new interactive DOM-rendering logic to `src/app.js`
> (`renderUnitAssumptions`, `showInputRejection`), and EP-5 extended the same code with further
> branching (`formatRejectionDetail`, `INPUT_REJECTION_CODES`) — this is not a "literal
> path-string swap." See "Deferral re-confirmation" below for the full evidence and verdict: the
> item stays **research-needed/deferred as a headless-browser-framework build task** (no
> Playwright/Puppeteer dependency exists yet, and EP-7 does not add one), but it should no longer
> be described as blocked purely on "nothing has touched `app.js` yet" — that premise is false as
> of EP-2. Promotion to an active work item is recommended at the next phase-planning gate.

## Problem / Context

`npm run check` (test + validate + build + smoke) never executes browser JavaScript. Platform
Foundation P0 restructured `src/facts.js`, `src/referenceRanges.js`, and `assessPediatricAnemia`
into 1-line shims over new registry modules, and the browser-facing surface — `src/app.js` and
`src/algorithmExplorer.js` — was touched only for literal path-string swaps (P1-T3). That shim
strategy makes real browser execution *acceptable to skip* for P0, but it does not make it *proven
safe*: a broken relative import or `fetch()` specifier in `app.js`/`algorithmExplorer.js` is
exactly the class of bug the module-boundary refactor could introduce, and no automated check in
this repo runs those files under an actual DOM/browser engine.

The Deferred Items Triage Table categorizes this as **research-needed**: no headless-browser/
runtime test framework (Playwright, Puppeteer, jsdom, etc.) exists in this repo today, and adding
one is a tooling decision with real cost (new dependency, CI runtime, maintenance) that P0's
zero-behavior-change structural mandate did not require solving.

## Current State (what P0 actually shipped)

P0 ships a **static + Node-dynamic** smoke check as a bridge, not the real thing:
`scripts/check-app-imports.mjs` (wired into `npm run check` per P7-T2). It runs two passes:

1. **Static specifier resolution** — parses every `import ... from '...'` and `fetch('...')`
   specifier out of `src/app.js` and `src/algorithmExplorer.js` via regex, resolves each relative
   path against both the dev (`src/`) and built (`dist/`) layouts, and fails on any unresolvable
   target. `fetch()` specifiers are resolved relative to the document base URI (root-relative,
   since `index.html` lives at the repo/dist root) — not module-relative like `import` — which the
   script's `checkFetchSpecifier` deliberately handles differently from `checkImportSpecifier`.
2. **Dynamic module-graph load under Node** — `await import()`s the non-DOM module graph
   (`src/engine.js`, `src/facts.js`, `src/modules/registry.js`, `modules/anemia/index.js`,
   `modules/anemia/ranges.js`) and fails if any throws.

This proves every static specifier resolves on disk and that the non-DOM module graph loads
without throwing under Node — but it explicitly **excludes** `app.js`/`algorithmExplorer.js`
themselves from the dynamic-load pass (they are DOM-dependent and cannot load under bare Node), and
it does not execute a single line of browser JavaScript in a real or headless browser engine. The
script's own header comment is explicit about this: *"This is NOT a headless-browser test ...
real browser-runtime execution stays out of scope for P0 (see DEF-8)."*

### Accepted browser-compatibility assumption (P4 karen milestone review)

`modules/anemia/ranges.js` imports its reference-range data with a **JSON import attribute**:

```js
import rangeData from './reference-ranges.json' with { type: 'json' };
```

This import sits directly on the live browser path — `modules/anemia/ranges.js` is reachable from
`src/app.js`'s runtime module graph, not merely from Node-side tooling. The P4 karen milestone
review explicitly reviewed and **accepted** this as a browser-compatibility assumption rather than
a defect: `import ... with { type: 'json' }` requires evergreen browsers — **Chrome/Edge 123+,
Safari 17.2+, Firefox 138+** — and is not supported on older engines. `scripts/check-app-imports.
mjs`'s dynamic-load pass exercises this import successfully, but only **under Node**, which has
supported the `with { type: 'json' }` syntax since Node 20.10/21.x — Node's support says nothing
about whether the same syntax parses and executes correctly in an actual browser's module loader.
**Browser execution of this import remains unverified** until this spec (or an equivalent headless-
browser check) is implemented. This is the concrete, load-bearing case this spec's future
implementation must cover: proving `modules/anemia/ranges.js`'s JSON-import-attribute path actually
works under a real (or headless) evergreen browser engine, not merely under Node.

## Design Sketch

At a shaping level, the two realistic directions:

1. **Headless-browser test framework** (Playwright or Puppeteer) — launch a real Chromium/WebKit/
   Firefox engine headlessly, load `index.html` (or `dist/index.html`), assert the page reaches a
   ready state (e.g. the assessment form renders, no uncaught console errors), and run at least one
   assessment end-to-end through the actual DOM/`fetch` path, exercising `modules/anemia/ranges.js`'
   `with { type: 'json' }` import under real browser module resolution rather than Node's. This is
   the more complete answer and directly retires the open browser-compatibility assumption above.
2. **jsdom-based smoke test** — a lighter-weight `node --test` addition using `jsdom` to simulate
   just enough DOM for `app.js` to load and run without throwing. Cheaper to add and CI-cheap, but
   jsdom does not implement real browser module-loading semantics for `with { type: 'json' }` import
   attributes in the same way a real browser engine does — it would not fully retire the DEF-8
   assumption, only partially narrow it (proves DOM-adjacent code paths, not the JSON-import-
   attribute browser-compatibility question specifically).

Given the specific unresolved risk is the JSON-import-attribute browser-engine behavior, direction
1 (a real or headless real-engine check) is the stronger candidate — a SPIKE should confirm
Playwright/Puppeteer's headless engine versions actually satisfy the Chrome/Edge 123+ / Safari
17.2+ / Firefox 138+ floor before committing.

## Promotion Trigger

Whichever phase next substantively edits `app.js`/`algorithmExplorer.js` — likely Phase 2 (CBC
client wiring), per the Deferred Items Triage Table. Should also be pulled forward immediately if
any evidence surfaces that a targeted browser version below the stated floor (Chrome/Edge <123,
Safari <17.2, Firefox <138) is in the supported-browser matrix for this product, since that would
turn the accepted assumption into an active defect.

## Open Questions

- Playwright vs. Puppeteer — does either already have precedent/preference elsewhere in this
  organization's tooling, and which more cheaply satisfies "headless Chromium/WebKit/Firefox at the
  Chrome123+/Safari17.2+/Firefox138+ floor"?
- Does the check run in CI on every `npm run check`, or as a separate, less-frequent gate (browser
  launches are slower/heavier than the rest of the current check suite)?
- Does this check need to cover only the JSON-import-attribute path (the specific accepted
  assumption), or the full DOM interaction surface (form fill, submit, result render) — the former
  is a much smaller, faster-to-ship first version.
- Should the supported-browser floor (Chrome/Edge 123+, Safari 17.2+, Firefox 138+) be published
  anywhere user-facing (a browser-support note in the SPA or its docs), given it is currently only
  documented in code comments (`modules/anemia/ranges.js`, `scripts/check-app-imports.mjs`) and this
  spec?
- Does relocating `examples/`/`data/algorithm-explainers.json` (DEF-7) need to land before or after
  this check, since both touch `app.js`'s fetch specifiers and would otherwise require updating the
  same test twice?

## Deferral re-confirmation (EP-7, 2026-07-21)

**Verdict: trigger has fired — recommend reopening / promoting at the next phase-planning gate.**
This is not a rubber stamp: re-checking this spec's own named trigger against what EP-1 through
EP-6 actually shipped (`git log --oneline -25`; `scripts/smoke-browser-unit-rejection.mjs`;
`src/facts.js`; `.claude/progress/wave0-safety-foundation/phase-{1,2}-progress.md`) shows the
premise this deferral rested on is no longer accurate.

**What "the Phase-0 shim boundary" meant, and whether EP-1/EP-2 stayed inside it:**

- `src/facts.js` remains the pure 1-line shim this spec (and `tri-state-fact-model.md`) describes:
  `deriveFacts(input)` calls `deriveFactsForModule(input, 'anemia')`. Fact-derivation logic itself
  never entered `app.js`/`algorithmExplorer.js` — that boundary held.
- **EP-1** (`e1dea8e`, tri-state facts) touched `app.js`/`algorithmExplorer.js` for only 7
  insertions/2 deletions total (`git show e1dea8e --stat`) — genuinely inside the shim boundary,
  no new rendering logic.
- **EP-2** (`23e5ef8`, Units & Range Registry) did **not** stay inside that boundary: 53
  insertions/16 deletions in `src/app.js` alone (`git show 23e5ef8 --stat`), adding two new
  functions with real conditional rendering behavior — `renderUnitAssumptions()` (a new
  `<aside>` notice block wired into `renderResult()`) and `showInputRejection()` (a new
  "Check the entered units" placeholder state, replacing the results view on a caught
  `UNIT_REJECTED` error, with per-field detail rendering). Both are genuine new
  DOM-construction logic, not path-string swaps.
- **EP-5** (`9a6a73a`) extended the same code further: `INPUT_REJECTION_CODES`, a second error
  branch (`AGE_OUT_OF_SUPPORTED_RANGE`), and `formatRejectionDetail()`, which renders a
  differently-shaped `<li>` per error code — 27 insertions in `src/app.js` on top of EP-2's.
- **EP-3+EP-4** (`28c1487`) also touched `algorithmExplorer.js` (15 lines) for evidence-passage
  rendering, a third substantive edit beyond path swaps.

So the spec's own trigger — *"If EP-1/EP-2 substantively edit `src/app.js`/`algorithmExplorer.js`
beyond today's shim boundary"* — is satisfied by EP-2 alone, and reinforced by EP-3/4/EP-5. This
was not silently missed: EP-2's own progress file names it explicitly — `.claude/progress/
wave0-safety-foundation/phase-2-progress.md` describes its runtime-smoke task as "R-P4 runtime
smoke: browser SPA surfaces the rejection, doesn't crash," and EP-1's progress file flags the
one pre-existing UI consumer as "DEF-8 territory if verification finds a break." The team
recognized the boundary was being crossed and added a compensating control rather than a real
headless-browser check:

- `scripts/smoke-browser-unit-rejection.mjs` (added at EP-2, wired into `npm run check`) statically
  parses `src/app.js`'s new function bodies (`renderUnitAssumptions`, `showInputRejection`,
  the `submit`/`loadExample` handlers) via a hand-rolled brace-matching source scanner, and
  asserts specific regex/structural properties — e.g. that `showInputRejection` does not call
  `form.reset()`, that `renderUnitAssumptions` includes `role="note"` and never the words
  `error`/`reject`. Separately, it `import()`s the **built `dist/` non-DOM module graph**
  (`assessPediatricAnemia`, `UnitRejectionError`) under Node and exercises a real
  valid-then-wrong-unit assessment end-to-end.
- The script is explicit about its own limit, in its final line of output: *"BROWSER-MODE
  BOUNDARY: this check proves static SPA wiring, dev/dist module resolution, and valid/rejected
  assessments through the built dist module graph under Node. It does not execute DOM-dependent
  app.js/algorithmExplorer.js in a browser, render the rejection HTML, or verify visual/
  accessibility behavior; no browser automation dependency is available in this zero-dependency
  repository."*
- `scripts/check-app-imports.mjs`'s own header comment is unchanged and still accurate: *"This is
  NOT a headless-browser test ... real browser-runtime execution stays out of scope for P0 (see
  DEF-8)."*

**Net assessment.** The concrete risk this spec named as unresolved — `modules/anemia/ranges.js`'s
`import ... with { type: 'json' }` attribute actually parsing and executing under a real browser
module loader (Chrome/Edge 123+, Safari 17.2+, Firefox 138+), not just under Node — remains
**completely unverified in any browser engine**, exactly as before. What has changed is the size
and nature of the never-DOM-tested surface: it is no longer "a shim with unchanged UI," it is now
several hundred lines of new, safety-adjacent rejection/disclosure UI (unit mismatches, age-out-
of-range refusals, assumed-unit notices) that has never rendered in an actual DOM. The static
source-inspection compensating control is real and well-targeted, but it checks *that the source
text has certain properties*, not that a browser *renders or behaves* as those properties imply.

This item should stay categorized `research-needed` (no headless-browser tooling decision has
been made or should be made unilaterally here), but it should **not** be re-filed as "still
deferred, nothing changed" — that would be dishonest given the evidence above. The honest
disposition is: the promotion trigger has fired; the team's interim response (stronger static/
Node smoke coverage) is a reasonable bridge, not a substitute; and this item should be surfaced
for an explicit reopen/promote decision at the next phase-planning gate (Phase 2 CBC kickoff, or
sooner if `app.js`/`algorithmExplorer.js` gain more browser-only-verifiable logic before then).
