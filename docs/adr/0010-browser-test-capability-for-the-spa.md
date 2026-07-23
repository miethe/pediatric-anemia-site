---
title: "ADR-0010: Browser-test capability for the SPA"
status: proposed
date: 2026-07-23
deciders: [platform-engineering]
supersedes: []
superseded_by: []
unblocks: []
---

# ADR-0010: Browser-test capability for the SPA

## Status

**Proposed** — 2026-07-23. Not accepted. This ADR records a posture that today refuses to add a
browser-test capability as a side effect of a UI feature; it does not itself add one, nor does it
plan to. Shipping this ADR with `status: proposed` documents the refusal, names its concrete cost,
and states the trigger under which the refusal should be revisited. This follows the pattern
already established by ADR-0004/0005/0006/0009 in this repository, all of which ship `proposed`
without a governance-body ratification pass gating their adoption as software architecture.

## Context

`package.json` in this repository **declares no `dependencies` and no `devDependencies`.** Every
test in `tests/` runs on `node --test` alone; every gate in `npm run check` (`test`, `validate`,
`coverage:rules`, `build`, `verify:d4`, `check:imports`, `smoke:browser`, `smoke`) resolves through
built-in Node or repo-local scripts. The one gate whose name suggests a browser
(`scripts/smoke-browser-unit-rejection.mjs`) states its own posture verbatim at lines 4-15:

> This is a source-grepping smoke test. It deliberately has no browser automation dependency, no
> jsdom, no headless browser, no puppeteer, no playwright. It does not paint or inspect a real
> browser DOM.

That posture is **load-bearing**, not incidental. It is what lets this repository make and keep
the guardrail "no third-party runtime dependencies" (`docs/architecture.md` §9) honestly, including
for a research prototype whose entire public surface is "the browser assessment sends no patient
data anywhere; no third-party scripts, fonts, analytics" (`CLAUDE.md` under Hard guardrails).
Adding jsdom, a headless browser, or a test-runner-with-a-DOM as a `devDependency` — even one that
only exists in test — expands the code an operator has to audit before deploying and expands the
supply-chain surface a compromised transitive package can reach.

`spa-module-switcher-v1` is the feature that first paid the concrete cost of this posture. Its PRD
§11a discloses the ceiling in the product's own words:

> This repository has no browser automation and no test dependencies. Behavioral fail-closure,
> banner rendering and refusal-state transitions are established by source inspection plus one
> human review pass (P6-011), not by executed browser tests.

Its Phase 6 verification harness runs to what a source assertion or an executed non-DOM unit can
prove — the eligibility predicate, the module manifest map, the status vocabulary, the built
non-DOM engine graph all execute for real; every DOM-dependent surface (module row rendering,
banner placement, refusal-state DOM transitions, focus order, forced-activation refusal at runtime)
is either source-asserted (guard-in-source-before-call-site checks) or discharged to P6-011, a
task performed by a person, not an agent.

## Decision

**Do not add a browser-test capability to this repository at this time.** Concretely:

- Do not add jsdom, a headless browser (puppeteer, playwright, cypress, selenium), or any
  test-runner-with-a-DOM (vitest with `jsdom`/`happy-dom` environment, jest with `jsdom`, etc.)
  to `package.json`'s `dependencies` or `devDependencies`.
- Do not add a browser-test capability as a side effect of a UI feature. If a specific SPA feature
  would benefit from executed browser tests, that is not a sufficient reason to add the capability
  under the same PR — the capability itself is an architectural change whose cost this ADR is
  refusing.
- Do not rewrite `scripts/smoke-browser-unit-rejection.mjs` to invoke a browser. Its two-part shape
  (source-grepping over `src/app.js` + executed non-DOM assertions over the built
  `dist/src/` graph) is what it is by design; its `:4-15` boundary statement is the honest disclosure.

**Do disclose the ceiling every time a SPA feature relies on it.** Every feature whose UI behavior
is source-asserted-plus-human-reviewed rather than executed must carry a disclosure equivalent to
`spa-module-switcher-v1`'s PRD §11a, and no completion report, changelog entry, or design doc for
such a feature may describe DOM-dependent behavior as "tested", "verified in the browser",
"executed", or "end-to-end". This is not a wording preference — it is the accuracy discipline the
absence of the capability requires.

## Cost this decision refuses to pay (silently)

`spa-module-switcher-v1` measured the concrete cost that this decision now names openly:

- **Behavioral fail-closure is not executed.** The refusal state's DOM transition (a prior
  result cleared, audit download disabled, submit disabled, banner swapped) is source-asserted
  (`functionBody('showModuleRefusal')` shows the six FR-19 invariant statements in specified order)
  but never executed — no test opens the page, selects an ineligible module, and observes the
  refusal. The runtime half is discharged to P6-011, item 7 of that human task's procedure.
- **Banner placement is not executed.** The FR-13 honesty-boundary sentence and the FR-34
  staleness disclosure are referenced by identifier in `src/app.js` (P6-004), but whether they
  render in the panel rather than in a `title=` tooltip is a placement question no source
  assertion can settle. That placement is discharged to P6-011, item 2.
- **Forced-activation refusal is not executed at runtime.** P6-012 proves that the eligibility
  predicate sits inside each of the three entry handlers in source order; it does **not** prove
  that invoking the selection handler directly with `cbc_suite_v1` refuses at runtime, because
  `src/app.js` is DOM-dependent and `node --test` cannot import or execute it. The runtime half
  is discharged to P6-011, item 7.
- **DOM hash search is not executable.** AC-8's allow-list assertion proves the renderer's
  source in `src/app.js` and `dist/src/app.js` reads only enumerated manifest fields; it cannot
  prove that no hash reaches the painted DOM through a path outside the scanned `functionBody()`
  or a file not in `target_surfaces`. A search of the live DOM for `sha256:` is P6-011, item 8.

Each of the above discharges a real behavioral question to a human observation recorded by a named
reviewer in `.claude/worknotes/spa-module-switcher/visual-evidence/` — an observation, not a test
result. This ADR records that this is the actual cost of the current posture, not a hypothetical
one.

## Options considered

1. **Add jsdom as a `devDependency` for SPA unit tests (rejected).** Would let `node --test`
   import and execute `src/app.js` under a synthetic DOM. Concrete disadvantages: adds a
   third-party dependency (with its own transitive graph) to a repository that today has none;
   normalizes future dependency additions once the "no `devDependencies` at all" line is crossed;
   and jsdom's DOM implementation is not the browser's — behavioral fail-closure that passes
   under jsdom would still not prove behavior in the browser.
2. **Add a headless browser (puppeteer/playwright) as a `devDependency` (rejected).** More
   accurate than jsdom (an actual browser engine) but strictly worse on supply-chain and audit
   cost — a headless browser is a larger dependency graph than jsdom and pulls binary
   distributions per platform. Also requires a running browser during `npm run check`, which
   changes the "you can run every gate offline on a fresh clone" property that today holds.
3. **Adopt a hosted browser-testing service (rejected).** Adds a network dependency to
   `npm run check`. Violates "you can run every gate offline" more strongly than option 2.
4. **Keep the zero-dependency posture; discharge behavioral questions to a named human
   reviewer per feature (adopted).** Honestly bounded by PRD §11a-style disclosures on any
   feature whose UI behavior is not executed. Preserves the guardrail that today makes "no
   third-party runtime dependencies" honest.

## Consequences

- Any SPA feature after `spa-module-switcher-v1` that touches behavioral fail-closure, banner
  rendering, refusal state transitions, focus order, or a devtools-vector question must include
  a named human review task in its plan and a §11a-style disclosure in its PRD. There is no
  "executed browser test" path available under this posture; that constraint applies to every
  such feature until this ADR is superseded.
- `scripts/smoke-browser-unit-rejection.mjs` stays a source-grepping smoke test. Any future
  extension to it must extend the two-part shape (source-asserted + executed non-DOM), never
  rewrite it into a browser-runtime harness.
- The absence of `dependencies` and `devDependencies` in `package.json` is a **checked
  invariant**, not merely a current state. Any PR that adds either violates this ADR and must
  first supersede it (see promotion trigger below).
- This ADR **does not claim a browser-test capability exists.** Reading it as "we have a
  browser-test capability but choose not to use it for this feature" would be exactly wrong.
- This ADR does not itself change any module's `status`, sign anything, or claim any clinical
  review has occurred. No `approvedBy` entry, no hash, no governance-state change results from
  it.

## Promotion Trigger

Revisit this ADR — either supersede it with an accepting one, or reaffirm this refusal — when
**either** of the following occurs:

1. **The SPA gains further safety-critical UI whose behavioral fail-closure cannot honestly be
   discharged to a single human review pass.** Concrete examples: a rule-authoring UI that a
   clinician uses to modify what fires; a real assess-input path that reaches server-side rather
   than staying browser-local; a workflow that persists patient data across tabs. Any of these
   makes the "one named-human review pass per feature" mechanism structurally inadequate.
2. **A second module becomes selectable** (`status: integrity-recorded`). Two selectable modules
   multiply the switcher's state space beyond what a single human review pass can plausibly
   cover manually — the number of module × tab × refusal-case combinations to check grows
   super-linearly with additional modules. When it does, the cost of an unexecuted behavioral
   assertion likely exceeds the cost of the dependency.

Do **not** revisit this ADR because a specific unit test would be easier to write with jsdom.
That is not a sufficient trigger — the source-assertion + human-review discipline was chosen for
its architectural cost, not its ergonomic cost.

## What this ADR is not

- **Not** a plan to adopt browser-test capability under some future condition. If a future ADR
  supersedes this one, that ADR authors its own plan; this one refuses.
- **Not** a claim that the current posture is optimal for all research-prototype software. It is
  a claim about **this** repository's specific guardrails, specific supply-chain posture, and
  specific stage of prototype maturity.
- **Not** a claim that source assertions and one human review pass together *prove* behavioral
  fail-closure. They do not; every feature discharging behavioral questions this way must say
  so.

## References

- `package.json` — the shipping-state evidence that no `dependencies` and no `devDependencies`
  are declared.
- `scripts/smoke-browser-unit-rejection.mjs:4-15` — the verbatim boundary statement this ADR
  makes durable.
- `docs/project_plans/PRDs/features/spa-module-switcher-v1.md` §11a — the feature-level
  disclosure this ADR generalizes.
- `docs/project_plans/implementation_plans/features/spa-module-switcher-v1/phase-6-7-gates-docs.md`
  — the P6-011 human-verification task specification whose existence is a direct consequence of
  this posture.
- `docs/architecture.md` §9 — the "no third-party runtime dependencies" guardrail this ADR
  keeps honest.
- `CLAUDE.md` under Hard guardrails — the "no third-party scripts, fonts, analytics" line the
  same posture enforces at the browser side.
