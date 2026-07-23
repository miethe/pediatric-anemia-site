---
schema_version: 2
doc_type: context
feature_slug: spa-module-switcher
created: 2026-07-23
updated: 2026-07-23
plan_ref: docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
prd_ref: docs/project_plans/PRDs/features/spa-module-switcher-v1.md
adr_refs:
  - docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md
  - docs/adr/0010-browser-test-capability-for-the-spa.md
findings_doc_ref: .claude/findings/spa-module-switcher-findings.md
---

# Feature Guide: SPA Module Switcher

## What it is

A header dropdown in the browser SPA (mockup **B**: header control + banner) that lists **all four
registered modules** — `anemia`, `cbc_suite_v1`, `growth_suite_v1`, `kidney_suite_v1` — instead of
silently running only `anemia`. The expanded panel renders two **labelled structural groups**
(selectable / not-selectable-with-reason), never four undifferentiated rows, with a pinned panel
header: *"These modules are not peers. Read each row."* The collapsed control keeps the active
module's title and verbatim status chip visible at all times, satisfying the in-session-reminder
requirement that ruled out a one-time interstitial picker.

Exactly **one** module is selectable (`anemia`, `status: integrity-recorded`). The other three ship
inert, with `module.json.status` shown **verbatim** — never a friendlier paraphrase, never hidden.
This is the same "never hide unservable state" disclosure precedent `GET /api/v1/knowledge-base`
already applies server-side (ADR-0009), now applied to a clinician-facing surface for the first time.
The feature signs nothing, flips no module's `status`, and adds no reviewer — it makes an existing,
already-module-agnostic runtime (`assess(input, moduleId, rules, candidates)`, `src/engine.js:19`)
perceivable for the first time.

## How it works

**Eligibility is decided before `assess()` is ever reachable.** `src/moduleEligibility.js` compares
`module.json.status` against `READY_STATUS`, the one runtime constant exported from
`src/kbVerify.js:43` (`'integrity-recorded'`) — never a hardcoded literal in any UI file (ADR-0009).
The predicate runs inside the module-selection, KB-load, and assessment-submit handlers, so a
devtools user who strips a row's `disabled` attribute and fires the handler still cannot reach
`assess()` against an ineligible module; `disabled` is a presentation guarantee, not the gate. A
manifest with an absent, malformed, or out-of-enum `status` is treated as ineligible — there is no
default-to-eligible path.

**The manifest map is the frozen truth source.** `src/moduleManifests.js` builds a frozen
`moduleId`-keyed map from four literal `import m from '../modules/<id>/module.json' with { type:
'json' }` statements. Nothing is verified: no content digest is recomputed, no schema is validated,
no check confirms the loaded rules are the rules that were signed — the browser reads
`manifest.status` as-published and nothing more. That gap is disclosed in the panel itself (never a
tooltip), verbatim: *"Status shown is read from this module's published manifest. The browser has
not verified it — no content digest was recomputed, no schema was validated, and no check confirms
the loaded rules are the rules that were signed."*

**A third, fail-closed state replaces a misattributed failure.** Before this feature, an ineligible
module reaching `assess()` threw `UnitRejectionError` at `src/units.js:167`, and `src/app.js`
rendered the generic **"Check the entered units"** heading — an unimplemented module masquerading as
a clinician data-entry mistake (`docs/architecture.md:391`, live prior to this feature). A new
`showModuleRefusal(moduleId, reason)` path now covers this distinctly from `showInputRejection`,
routed for four cases: (1) the evidence registry has no entry for the module, (2) the module's hooks
self-report not-yet-implemented, (3) `status` is not `READY_STATUS`, (4) the module's KB fetch 404s.
Every refusal clears any prior result, hides `#results` in favor of `#results-placeholder`, disables
the audit download and submit, and keeps the module selector interactive — never a silent fallback
to `anemia`.

**`?module=` drives URL state, nothing is persisted client-side.** Initial selection reads
`?module=<id>`; `history.replaceState` (fixed at `src/app.js:457`) now preserves the query string
across tab switches. Nothing is written to `localStorage`, `sessionStorage`, or a cookie — a stale
persisted module id would itself be a fail-closed hazard.

**Non-anemia modules degrade tabs rather than fall back to anemia.** The active `moduleId` gates
`#algorithm` (the explorer is anemia-shaped end to end by design — `src/algorithmExplorer.js` is
never generalized here, R-8 — and is hidden, not silently executed, under another module's label),
`#evidence` (only modules with a registered evidence loader render one), the `#rules` empty state
(*"This module contains no rules. No assessment can be produced from it."*), and the examples
picker (empty and disabled, never offering anemia cases under a different module's name).
`manifest.title` drives `document.title`, `<h1>`, brand, and footer under whichever module is
active.

**The row/banner renderer is allow-listed, not just token-scanned.** It may read only an
enumerated subset of manifest fields (`id`, `title`, `status`, `knowledgeBaseVersion`,
`evidenceReviewedThrough`, `approvedBy.length`) — every other property, including
`clinicalContentHash` (which anemia's manifest legitimately carries), is structurally unreachable.
This closes a gap a plain prohibited-token scan would have missed: a `JSON.stringify(manifest)`
dumped into a row would pass a token scan while still emitting a hash.

## Where the strings live

**`src/moduleStatusVocabulary.js` is the only home for every clinician-facing module-status
string.** No component may hardcode a status sentence, the honesty-boundary disclosure, the
staleness disclosure, the panel header, or the empty-rules copy — every one of them is imported
from this one file. It is frozen, side-effect-free data plus pure derivation only (no DOM access,
no network call, no invocation of the rule-evaluation engine), pinned by a doc-truth test
(`tests/module-status-vocabulary.test.mjs`). It exports: `PANEL_HEADER`,
`HONESTY_BOUNDARY_DISCLOSURE`, `EVIDENCE_STALENESS_DISCLOSURE`, `UNSIGNED_STUB_SUBTITLE`,
`RULES_EMPTY_STATE`, `MODULE_STATUS_SENTENCES` (one sentence per closed schema-enum value, each
including the derived `approvedBy`-empty clause), `getStatusSentence()` (returns a distinct
`UNKNOWN_STATUS_SENTINEL` symbol — never a friendlier default string — for any out-of-enum status),
and the parameterized refusal/degradation reason functions (`deriveEvidenceUnavailableReason`,
`deriveNotYetImplementedReason`, `deriveKbLoadFailureReason`, `deriveUnregisteredModuleReason`,
`deriveAlgorithmUnavailableReason`, `deriveEvidenceViewUnavailableReason`).

`integrity-recorded`'s sentence reads *"content hashes recorded only"* — never "verified" — and is
styled identically to the three scaffold statuses. There is no green state.

## How it is guarded

**84 new gate tests** across `tests/module-switcher-*.test.mjs` and adjacent files (module registry,
manifest schema, KB loaders, equivalence) run to the ceiling this repository actually affords:
`node:test` over non-DOM modules (the eligibility predicate, the vocabulary map, the engine graph)
plus `functionBody()` + regex assertions over `src/app.js`, `index.html`, and `styles.css` for
source-order and identifier-reference facts.

`scripts/smoke-browser-unit-rejection.mjs` was **extended, never rewritten** — its five pre-existing
assertion sites and its own `:4-15` no-browser-automation boundary statement are retained verbatim.
A sibling assertion block was added for the module-refusal UI mirroring the existing
`AGE_OUT_OF_SUPPORTED_RANGE` block, and the executed half now also runs `assessModule('anemia', …)`
against the built non-DOM graph. `assessModule(moduleId, input, rules, candidates)` is exported from
`src/engine.js` alongside the retained `assessPediatricAnemia` export specifically so this
source-grepping gate keeps passing.

**Gate posture on this branch is delta-green, recorded, not hidden** (findings E-1/E-2). `main` was
already red at execution start — 25 pre-existing `npm test` failures plus `npm run validate` exit 1
in `modules/**` / rights-substrate content, unrelated to this feature and outside its diff by
design (FR-35). This feature's own gate discharge is: the failing set stays byte-identical to the
inherited 25 (zero new failures, all new tests pass), the `validate` failure output is
byte-identical to inherited, and every other `npm run check` sub-stage exits 0. A second,
branch-self-inflicted failure (E-2, a diff-scope guard written for a different feature branch that
was never rescoped) self-resolves on squash-merge and is not a defect in this feature's code. No
progress note describes the full `npm run check` as green.

## Known Limitations

- **One module is selectable; three are inert.** `anemia` is the only `status: integrity-recorded`
  module today. `cbc_suite_v1`, `growth_suite_v1`, and `kidney_suite_v1` are listed with their real
  status but cannot be selected or assessed through this UI.
- **The browser verifies nothing.** No content digest is recomputed, no schema is validated, and no
  check confirms the loaded rules are the rules that were signed. Status is read from the published
  manifest as-is.
- **The UI's behavior was established by source inspection plus one human review pass — not by
  executed browser tests.** This repository has no browser automation and no test dependencies
  (PRD §11a; ADR-0010, `status: proposed`). Behavioral fail-closure, banner placement, and
  refusal-state transitions are proven only to the extent a `functionBody()` + regex source
  assertion can prove them, plus a single named human review pass (P6-011) that walks the rendered
  page. **As of this writing, that human review pass (P6-011) is still pending its named
  signature** — screenshots have been captured, but the reviewer's recorded sign-off has not landed.
  A green `npm run check` does not mean the UI behaves correctly in a real browser.
- **Evidence-staleness expiry is not enforced.** No governance window has been set; the
  `evidenceReviewedThrough` date is declared by the module, not checked, and the panel discloses
  this adjacent to the date wherever it is shown.
- **No module is clinically validated, reviewed, or approved.** `approvedBy` is schema-forced empty
  (`maxItems: 0`) on every module, including `anemia`; the universal second clause on every status
  sentence states this explicitly, derived from `approvedBy.length === 0` rather than hardcoded.
