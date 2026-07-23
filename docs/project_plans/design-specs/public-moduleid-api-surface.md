---
doc_type: design_spec
title: "Public `moduleId` API Surface"
status: draft
maturity: shaping
created: 2026-07-18
updated: 2026-07-22
feature_slug: platform-foundation-p0
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md
related_documents:
  - docs/project_plans/PRDs/features/spa-module-switcher-v1.md
---

# Public `moduleId` API Surface (DEF-6)

## Problem / Context

Platform Foundation P0 introduces `moduleId` as an internal concept throughout the codebase —
`src/modules/registry.js` (`MODULE_IDS`, `DEFAULT_MODULE_ID`, `getModule`, `isRegisteredModule`,
`loadModuleCode`), `src/facts/registry.js` (`deriveFacts(input, moduleId)`), `src/ranges/
registry.js` — but the module-selection value is never exposed as something a client (the browser
SPA, or an external API caller) can set. There is exactly one registered module (`anemia`), and
`DEFAULT_MODULE_ID = 'anemia'` is hardcoded with a comment calling it a "deliberate tripwire ...
revisit this the day a second module is registered."

The Deferred Items Triage Table categorizes this as **scope-cut**, citing two binding constraints:
the plan's zero-behavior-change guardrail (any new client-settable parameter is a public API
surface change, which P0's Acceptance Criteria AC-5 explicitly forbids), and a binding Open
Question resolution (Sequencing Note 6 / OQ-2) that a client-facing `moduleId` was deliberately
excluded from P0's scope. Building it now, with only one module ever registered, would also be
speculative — there's no second module yet to prove the query-param/body-field design against.

## Current State (what P0 actually shipped)

The `POST /api/v1/assess` endpoint (`server.mjs`) accepts no `moduleId` request parameter at all.
Server startup loads **every** registered module unconditionally:

```js
for (const moduleId of MODULE_IDS) {
  modulesById[moduleId] = await loadModuleData(moduleId);
}
```

and the comment directly above the knowledge-base listing construction states the guardrail
explicitly: `// present, not conditional on any request param (no moduleId request surface exists,
AC-5)`. The `/api/v1/knowledge-base` endpoint (per `modulesById`) advertises all loaded modules
unconditionally rather than accepting a selector. `assessPediatricAnemia(input, rules, candidates)`
— called from the assess handler — still takes `rules`/`candidates` directly, not a `moduleId`; the
server resolves which module's `rules`/`candidates` to pass in internally, not from client input.
`src/modules/registry.js`'s `MODULE_IDS = Object.freeze(['anemia'])` is the sole source of what
modules exist, and nothing reads a request-supplied value against it.

In short: `moduleId` is a fully wired *internal* dispatch key (registry lookups, fact derivation,
range derivation all take it as a parameter) but has zero external surface — no query param, no
body field, no header. This is a deliberate, documented gap, not an omission.

## Design Sketch

Once a second module is registered (the trigger below), the natural shape is additive to the
existing `POST /api/v1/assess` contract:

- Accept an optional `moduleId` field in the request body (defaulting to `DEFAULT_MODULE_ID` when
  absent, preserving today's single-module behavior for any caller that doesn't opt in — this
  keeps the change backward-compatible rather than breaking).
- Validate the supplied `moduleId` against `isRegisteredModule()` (already exported by `src/
  modules/registry.js`) and return a clear 4xx error for an unknown module, rather than the current
  internal `throw new Error('Unknown module: ' + id)` behavior in `getModule`/`loadModuleCode`,
  which is not currently reachable from any external input.
- `GET /api/v1/knowledge-base` would similarly need either a `moduleId` query param to scope the
  response to one module, or keep returning all modules and let the client select — this is a
  genuine design fork that needs the second module's actual UI-integration pattern to resolve
  sensibly (module picker UI vs. always-all-modules response).
- The browser SPA (`src/app.js`) would need a module-selection UI element wired to the new
  parameter — currently entirely absent since there is nothing to select.

This spec intentionally sketches direction only; the concrete shape (body field vs. query param vs.
URL path segment, e.g. `/api/v1/assess/:moduleId`) should be decided against the actual second
module's integration needs, not speculatively now.

## Promotion Trigger

Phase 1+, when a second module needs client-selectable targeting (per the Deferred Items Triage
Table) — concretely, whenever the CBC/cytopenia suite (the next planned module per `docs/
project_plans/expansion/01-platform-expansion-roadmap.md`) is registered and a client needs to
choose between it and `anemia`.

## Open Questions

- Body field, query param, or URL path segment (`/api/v1/assess/:moduleId`) — does REST convention
  favor the path segment given `moduleId` identifies *which resource/engine* is being invoked, not
  a filter on a shared resource?
- Does `GET /api/v1/knowledge-base` stay "always all modules" (today's behavior, harmless to keep
  even with multiple modules) or does it need module-scoping too, and on what trigger?
- Does the SPA support single-module-at-a-time selection, or eventually a combined/multi-module
  assessment view — this affects whether `moduleId` should ever be an array in the request shape?
- What is the exact error contract for an invalid/unknown `moduleId` — HTTP status code, error body
  shape — and does it follow an existing error-response convention elsewhere in `server.mjs`, or
  does one need to be established?
- Does exposing `moduleId` publicly require updating `openapi.yaml`, and does that itself count as
  a "public API surface change" requiring the same review rigor as a rule/KB content change under
  CLAUDE.md's guardrails (it is not clinical content, but it is a contract change)?

## Deferral re-confirmation (EP-7, 2026-07-21)

**Verdict: still correctly deferred.** Re-checked against what Phases EP-0 through EP-6
(`wave0-safety-foundation`) actually shipped (`git log --oneline -25`; `.claude/progress/
wave0-safety-foundation/phase-{0,0.5,1,2,3,4,5,6}-progress.md`), not the plan's aspirations.

Concrete evidence, current repo state:

- `src/modules/registry.js` still derives `MODULE_IDS` from a single-entry source:
  `export const MODULE_IDS = Object.freeze([...REGISTRY.keys()]);`, and `src/facts/registry.js`'s
  backing `REGISTRY` `Map` has exactly one entry — `['anemia', deriveAnemiaFacts]`. No second
  module directory exists under `modules/`. **Corrected 2026-07-22 (SQ-4): this bullet was accurate
  on 2026-07-21 but is stale today — commit `263120b` (E1 multi-bundle conversion) registered three
  more module directories (`cbc_suite_v1`, `growth_suite_v1`, `kidney_suite_v1`) the day after this
  section was written. See the "Deferral re-confirmation (SQ-4, 2026-07-22)" section below for the
  current, re-checked disposition — the module-count premise this 2026-07-21 note rested on no
  longer holds, though the deferral verdict itself still stands, for a different reason.**
- `server.mjs` still carries the same explicit guardrail comment this spec quoted at Phase 0:
  `// present, not conditional on any request param (no moduleId request surface exists, AC-5)`,
  directly above the unconditional `MODULE_IDS.map(...)` knowledge-base listing.
- `POST /api/v1/assess` still accepts no `moduleId` request field; `assessPediatricAnemia(input,
  rules, candidates)` is still called with server-resolved `rules`/`candidates`, never a
  client-supplied module selector.
- None of EP-0 through EP-6 (tri-state facts, units/ranges, evidence provenance, rule governance,
  manifest/semantic-diff, adversarial validation corpus) registered, scaffolded, or even
  design-referenced a second module — every phase's `files_affected` stays inside `modules/anemia/`
  and shared engine/schema surfaces. The Phase 2 CBC-suite kickoff named as this spec's promotion
  trigger has not started.

Nothing in this program has moved the "one registered module" premise this deferral rests on.
The design sketch and open questions above remain the right shape to resolve once a second module
is actually being registered; there is still no second data point to design the concrete API
shape (body field vs. query param vs. path segment) against.

## Deferral re-confirmation (SQ-4, 2026-07-22)

**Verdict: still correctly deferred — but the 2026-07-21 re-confirmation above rested on a premise
that no longer holds, and the corrected reasoning is recorded here.**

This spec's Promotion Trigger (above) has two independent clauses: (1) a second module is
registered, and (2) a client needs to choose between it and `anemia` via the HTTP API. As of commit
`263120b` (E1 multi-bundle conversion, landed 2026-07-22, the day after the note above was written),
**clause (1) has fired**: `modules/` now contains four directories — `anemia`
(`status: integrity-recorded`), `cbc_suite_v1`, `growth_suite_v1`, and `kidney_suite_v1` (all three
`status: unsigned-stub`). The 2026-07-21 section's "no second module directory exists under
`modules/`" statement is therefore stale, and the correction is recorded in place above.

**Clause (2) has not fired, and the reason is now different from the reason recorded in the
2026-07-21 note.** The `spa-module-switcher-v1` feature (PRD:
`docs/project_plans/PRDs/features/spa-module-switcher-v1.md`) adds the first clinician-facing
surface that lets a user choose among the four registered modules — but that surface is a
**browser-only** selection control. Verified directly against the SPA's source: every fetch call in
`src/app.js`, `src/algorithmExplorer.js`, and `src/evidence.js` is a relative path — `./modules/...`,
`./examples/...`, `./data/...` — and none of them calls `/api/*`. The browser switcher never sends a
`moduleId` (or anything else) to `server.mjs`. So while a client now *does* need to choose between
four registered modules, it makes that choice entirely client-side, without ever reaching the HTTP
API this spec's design sketch is about. The server-side `POST /api/v1/assess` and
`GET /api/v1/knowledge-base` contracts are unchanged by that feature — no `moduleId` request
parameter, no path-segment resource, no error-contract question is actually being exercised by any
real caller yet.

**Server-side `moduleId` therefore stays deferred, for a corrected reason: not "no second module
exists" (false as of `263120b`), but "no client reaches this API with a module selection to make"
(still true, verified against `spa-module-switcher-v1`'s own non-goals). The design sketch and open
questions in this spec remain the right shape to resolve if and when a client — server-side caller,
CDS Hooks integration, or a future non-browser consumer — actually needs to select a module over
HTTP. The browser switcher is not that trigger.

### `:93` answered

This spec's own Open Question at line 93 — "Does the SPA support single-module-at-a-time selection,
or eventually a combined/multi-module assessment view — this affects whether `moduleId` should ever
be an array in the request shape?" — is answered by `spa-module-switcher-v1`, not by this spec:
**single-module-at-a-time, never a combined view.** `src/engine.js`'s `assess(input, moduleId, ...)`
is single-module by design, and this platform's ranking score is an ordinal sort priority computed
per module (CLAUDE.md's hard guardrails) — merging two modules' candidate lists into one combined
view would compare priorities across incompatible per-module scales and misrepresent relative
ranking. Two of the four registered modules (`growth_suite_v1`, `kidney_suite_v1`) are
not-yet-implemented stubs today, which independently rules out a combined view rendering anything
coherent alongside the one real (`anemia`) assessment. This answer settles `:93` as "no,
`moduleId` is never an array in the request shape" for the browser surface; it does not settle
whether a future non-browser caller might one day want a batch/multi-module request shape — that
remains open if and when the server-side surface above is actually built.

### Prior art: PR #26

PR #26 (closed unmerged, branch `worktree-plan-module-switcher`) carries a full Tier-2 API-surface
PRD at `docs/project_plans/PRDs/features/module-switcher-v1.md` on that branch, produced in a parallel
planning pass before this feature's own PRD was authored. It should seed this spec's next iteration
if/when the server-side surface above is actually designed:

- An error contract — `400 UNKNOWN_MODULE` on the existing `{error, code?, details?}` response
  envelope — for an invalid or unregistered `moduleId`, answering this spec's open error-contract
  question with a concrete, schema-consistent shape rather than leaving it fully open.
- A validate-before-any-lookup path-injection guard on a client-supplied `moduleId`, closing a class
  of input-handling risk this spec's design sketch does not yet address.
- A registration-gap analysis (that PRD's FR-0) covering `src/units.js` and
  `src/evidence/registry.js`, identifying that not every registered module has a corresponding
  units/evidence registration — directly relevant groundwork for any future "all registered modules
  assessable" server-side premise.

That PRD's "all registered modules assessable" premise should be **re-based on ADR-0009's eligibility
mapping** before being reused: ADR-0009 (`docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md`)
establishes that only `status: integrity-recorded` modules are eligible for any assessment surface,
client- or server-side — a fact `spa-module-switcher-v1`'s own decisions block records at D-1, D-4,
and D-7 (`.claude/worknotes/spa-module-switcher/decisions-block.md`). A future server-side design
built on PR #26's prior art must gate on the same eligibility predicate the browser switcher uses,
not on "registered" alone.
