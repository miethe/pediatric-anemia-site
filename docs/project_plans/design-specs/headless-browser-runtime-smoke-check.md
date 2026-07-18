---
doc_type: design_spec
title: "Headless-Browser Runtime Smoke Check"
status: draft
maturity: shaping
created: 2026-07-18
feature_slug: platform-foundation-p0
prd_ref: docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
---

# Headless-Browser Runtime Smoke Check (DEF-8)

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
