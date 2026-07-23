---
title: "PRD: Four-State Questionnaire UI — capture-fidelity control for the 59 booleanMap fields"
schema_version: 2
doc_type: prd
status: draft
created: 2026-07-23
updated: 2026-07-23
feature_slug: "four-state-questionnaire-ui"
feature_version: "v1"
prd_ref: null
plan_ref: null
related_documents:
  - .claude/worknotes/four-state-questionnaire-ui/decisions-block.md
  - .claude/worknotes/four-state-questionnaire-ui/spike-legA-semantics.md
  - .claude/worknotes/four-state-questionnaire-ui/spike-legB-verification.md
  - .claude/worknotes/four-state-questionnaire-ui/spike-legC-surface.md
  - .claude/worknotes/four-state-questionnaire-ui/spike-legD-empirical-probe.md
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  - docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md
  - docs/project_plans/design-specs/tri-state-fact-model.md
references:
  user_docs: []
  context: []
  specs:
    - schemas/patient-input.schema.json
    - docs/project_plans/design-specs/tri-state-fact-model.md
  related_prds: []
spike_ref: docs/project_plans/SPIKEs/spike-010-four-state-questionnaire-ui.md
adr_refs: []
charter_ref: null
changelog_ref: null
changelog_required: true
test_plan_ref: null
owner: null
contributors: []
priority: medium
risk_level: medium
category: "features"
tags: [prd, planning, feature, spa, tri-state, questionnaire, capture-fidelity]
tier: 3
milestone: null
commit_refs: []
pr_refs: []
files_affected: [index.html, styles.css, src/app.js, src/facts/fieldState.js,
  tests/field-state.test.mjs, tests/tristate-neutrality-guard.test.mjs,
  tests/questionnaire-registry-parity.test.mjs, docs/project_plans/design-specs/tri-state-fact-model.md,
  docs/project_plans/expansion/01-platform-expansion-roadmap.md, CLAUDE.md]
---

# Feature Brief & Metadata

**Feature Name:** Four-State Questionnaire UI · **Filepath Name:** `four-state-questionnaire-ui-v1` ·
**Date:** 2026-07-23 · **Author:** `prd-writer` (Opus-scaffolded from SPIKE legs A–D + decisions block)

**Related Epic(s)/PRD ID(s):** P3-WP7 in `01-platform-expansion-roadmap.md:288,545` ("Tri-state adaptive
questionnaire UI"). IntentTree node `node_01KXQ7XFBSFNEEAJA8XJM621PZ`.

**Related Documents:** see frontmatter `related_documents`. `decisions-block.md` is **authoritative** —
its decisions, scope, risks R1–R7, estimates, and open questions OQ-1..OQ-4 are binding on this PRD.

**Status honesty:** this is an unvalidated research prototype. Nothing in this PRD describes a
clinically validated capability, a diagnostic improvement, or a safety enhancement. This feature
changes **zero** engine output. No `approvedBy[]`/`clinicalApprovers[]` field is populated by this work.

---

## 0. Premise correction (read this first)

The work package this PRD implements is commonly described — including in its own roadmap title — as
adding a "four-state" or "tri-state adaptive" capability. Read literally, that framing is wrong on two
counts, both settled by prior investigation, not by this PRD:

1. **The engine is tri-state, not four-state, and stays that way.** `src/ruleEngine.js:44-48`:

   ```js
   case 'is-present': return toTri(actual) === 'true';
   case 'is-absent': return toTri(actual) === 'false';
   case 'is-unknown':
   case 'is-not-assessed': return toTri(actual) === 'unknown';
   ```

   `is-not-assessed` is a **declared synonym** of `is-unknown` — both branches resolve identically.
   `src/facts/tristate.js:6-11`'s `toTri()` recognizes exactly three values: `'true' | 'false' |
   'unknown'`. There is no fourth wire-level state anywhere in the engine today, and this PRD does not
   create one.

2. **A four-state fact type was explicitly considered and rejected on the record**, four days before
   this plan's evidence base was assembled — `spike-003-tri-state-fact-model-migration.md:579-584`
   (status `completed`, dated 2026-07-19):

   > "A four-state Tri type (adding a distinct `'not-assessed'` state alongside `'unknown'` to
   > literally match all 4 named RQ7 operators). Rejected: no concrete rule or fact in the audited 91
   > needs to distinguish 'raw field never sent' from 'computed-indeterminate from present-but-
   > borderline data' as two different *rule-matchable* states today ... operationalizing it as a 4th
   > enum value with no consumer would be speculative scope."

   **This PRD does not reopen that decision.** Reopening it would require new evidence of a concrete
   rule-engine consumer of the distinction, which does not exist (leg A §1–§2: `is-unknown` appears
   once in the entire rule corpus, `is-not-assessed` appears zero times, and the one `is-unknown` rule
   — `CBC-NEUT-LOCALRANGE-001` — has no case where telling "unknown" apart from "not-assessed" would
   change its output).

What this PRD actually delivers is a **four-option clinician-facing control that serializes onto the
existing three-value wire model**, with the fourth clinician-visible distinction preserved only by
*omitting the field from the payload* — never as a fourth stored literal. §3 gives the full mapping and
the reasoning for this specific design over the two more obvious alternatives.

**Roadmap naming correction recommended (OQ-3):** `01-platform-expansion-roadmap.md:288` and `:545`
both title this work package "**Tri**-state adaptive questionnaire UI." Given §0.1, "tri-state" is the
accurate word for the engine; "four-state" (the framing used to commission this PRD) describes the UI
control only. Recommend the roadmap/IntentTree title read "Four-option questionnaire UI" or similar,
dropping "adaptive" per §5.3. This PRD does not edit the roadmap title itself — that is a P4 doc task
(§10).

---

## 1. Executive Summary

The 59 booleanMap-backed questionnaire fields (symptoms 14 + history 40 + exam 5 — counts derived
programmatically from `src/app.js:111-131`, correcting an earlier pass's count of 57) are captured
today as HTML checkboxes. A checkbox is a two-state control (`checked`/`unchecked`) mapped onto the
SPA's existing three-value wire model (`'true'|'false'|'unknown'`, `src/facts/tristate.js:4`), and the
mapping is lossy: `setSimpleField()` (`src/app.js:1466`) writes `element.checked = toTri(val) ===
'true'`, so both `'false'` and `'unknown'` render as the same unchecked box on re-population — an
**existing round-trip data-loss defect**, independent of anything new. This feature replaces each
checkbox with a `<select>` offering four clinician-visible options, fixes that round-trip defect as a
direct consequence of doing so honestly, and changes the payload so an unanswered field is **omitted**
rather than defaulted to `'false'`.

**Priority:** MEDIUM

**Key Outcomes:**
- Clinicians can distinguish, on the interface, whether a symptom/history/exam item was **actively
  ruled out** ("Absent") from one that was **never assessed at all**. Both were previously indistinguishable
  ("unchecked").
- The existing `setSimpleField()`/`populateFromInput()` round-trip data-loss defect (false vs. unknown
  collapse to the same unchecked visual state) is fixed as a byproduct.
- **Engine output is unchanged.** This is empirically verified (leg D, §4), not assumed, and is stated
  here without qualification: this feature improves **capture fidelity**, not diagnosis, inference,
  accuracy, or safety. See §4 for why, and see the honesty caveat that follows it.

**What this PRD does not claim:** improved clinical inference, improved diagnostic accuracy, reduced
missed diagnoses, or any safety benefit. None of those follow from this change, and none are asserted.

---

## 2. Context & Background

### Current State

- The SPA's 59 booleanMap fields render as `<label><input type="checkbox" name="X"> Text</label>`
  inside `.check-grid` wrappers (`index.html:220` is representative; leg C §1 census: 69 of 84 total
  checkboxes on the page follow this exact pattern, with 3 cosmetic `.field-grid` variants and 11
  unrelated `smear` multi-select checkboxes — see §5 Out of Scope).
- `checked(name)` (`src/app.js:102-105`) reads `element.checked` as a plain boolean; `booleans(names)`
  (`:144-146`) maps a name list through it; `buildInput()` (`:148-220`) calls `booleans(symptomNames)`,
  `booleans(historyNames)`, `booleans(examNames)` to populate `symptoms`/`history`/`exam` in the
  assessment payload. Every unanswered field is submitted as an explicit `false`.
- `setSimpleField(name, val)` (`:1462-1468`) writes back on load/reset: `element.checked = toTri(val)
  === 'true'`. Both `'false'` and `'unknown'` collapse to `element.checked = false` — the round-trip
  defect this PRD fixes.
- The safety-reviewed mutual-exclusion listeners (`:1634-1650`) force-write `element.checked = false`
  across every `immediateSafetyNames` field when the safety-reviewed checkbox is ticked, and the
  reverse direction unchecks safety-reviewed when any immediate-safety field is checked. Both
  directions assume a boolean `.checked` write and must be rewritten for a value-bearing control (§6,
  R2).
- The schema already accepts the three wire values `booleanMap` expects (`schemas/patient-input.schema.json:131-138`):
  a bare JSON boolean or the strings `"true"`/`"false"`/`"unknown"`. No schema change is required by
  this feature.

### Problem Space

A checkbox cannot represent "I asked about this and the answer was no" separately from "I never asked."
Both currently submit (or default to) `false`. That collapses two clinically distinct facts — an
actively negative history item and an unassessed one — into a single wire value, and the repository's
own stated ethic ("missingness is never treated as normal," CLAUDE.md) is violated by the current UI
every time a clinician leaves a field unchecked rather than answers it.

### Current Alternatives / Workarounds

None exist in the UI. A clinician has no way to mark a field "not assessed" versus leaving it
unanswered; both look identical (unchecked) and submit identically (`false`).

### Architectural Context

This is a browser-local, zero-dependency, no-build-step static SPA (`index.html` → native ESM
`src/app.js`, no bundler). The MeatyPrompts layered-architecture checklist (routers/services/
repositories/cursor pagination/OpenTelemetry) does not apply — there is no backend call in this
feature's path. §6.2 substitutes the constraints that do apply; §8 states the verification ceiling
that follows from having no browser test dependency.

---

## 3. The design

**Four clinician-visible states, three wire values, "not assessed" represented by key omission.**

| Clinician sees (default order TBD, OQ-1) | Payload sent | What the rule engine sees | Provenance preserved? |
|---|---|---|---|
| *(never touched — the default state)* | key **omitted** from `symptoms`/`history`/`exam` | `'unknown'` (via `toTri()` on an absent path) | Yes — key-absence is durable across save/export/re-load of the JSON payload. |
| Unknown / can't determine | `'unknown'` | `'unknown'` | Yes. |
| Present | `'true'` | `'true'` | Yes. |
| Absent | `'false'` | `'false'` | Yes. |

The distinction between "never touched" and "actively marked unknown" is captured and durable in the
serialized payload (a clinician or reviewer reading the raw JSON can tell the two apart by key
presence), but it is **invisible to the rule engine** — `toTri()` treats an absent path exactly like
an explicit `'unknown'` (`src/facts/tristate.js:6-11`). This is deliberate: it is the mechanism that
lets the fourth clinician-visible state exist without adding a fourth wire-level literal.

### Why this and not the two more obvious alternatives

**Not a 4th persisted enum value (`'not-assessed'` as a distinct wire string).** This reopens
SPIKE-003's on-the-record rejection (§0.2) for no rule-corpus benefit — zero rules consume the
distinction today (leg A §1) — and its blast radius is roughly 13 files/areas including the schema
enum, `toTri()`, `ruleEngine.js`'s operator dispatch, every derived-fact call site in
`modules/anemia/facts.anemia.js` (25 occurrences), and the brittle byte-identity golden-fixture harness
(leg A §3). Rejected on cost/risk grounds with zero behavioral payoff.

**Not a 4th UI option that silently serializes to `'unknown'`** (leg A's own recommendation). This is
the option rejected on **guardrail grounds**, not engineering grounds: a clinician who selects "Not
assessed" would reasonably believe the system recorded that distinction. It would not — it would be
indistinguishable, at the byte level, from a clinician who separately investigated and could not
determine an answer. Silently collapsing two clinician-meaningful inputs into one stored value, in a
tool whose stated ethic is "missingness is never treated as normal" and whose value proposition is an
auditable trace, is precisely the quiet dishonesty the guardrails exist to prevent. (Leg A itself names
this as its own strongest counter-argument: permanent loss of clinical provenance, forcing a second
migration if a future rule ever needs to tell the two apart.)

**Key omission resolves the tension.** The distinction is captured and durable in the payload, while
remaining invisible to the rule engine — so SPIKE-003's decision stands unreversed, no engine operator
splits, and no golden fixture moves (§4 verifies this empirically).

### The honesty caveat this design carries

Key-omission is honest about *capture* — the clinician's four-way input is faithfully recorded. It must
not be presented as honest about *consequence*: selecting "Not assessed" versus "Unknown" changes
**nothing** in the engine's output today (§4). The UI copy must not imply otherwise, and no documentation
produced by this feature may imply improved inference, improved safety, or improved diagnostic
performance as a result of this distinction becoming capturable.

---

## 4. Empirically verified: engine output is unchanged (leg D)

Leg D ran the assessment engine (`assessPediatricAnemia` / `assess()` over `deriveFacts`) against all 6
golden fixtures in `tests/golden/`, with every explicit `false` key inside `symptoms`/`history`/`exam`
deleted (simulating the omit-unanswered payload this feature introduces). Method and result, verbatim
from the SPIKE leg:

- **All 6 fixture outputs were IDENTICAL**, byte-for-byte, original vs. variant. All 14
  `triAny`/`triAll`/`triNone`-derived aggregate facts were unchanged on all 6 fixtures.
- A synthetic all-negative bleeding-history case **did** flip an intermediate aggregate
  (`history.bleedingHistory: 'false' → 'unknown'`) — proving the omission mechanism genuinely reaches
  the facts layer — yet the final `assess()` output was still identical.
- **Why:** every one of the **28 rule conditions** that touch those 14 aggregates
  (`AINF-002/004`, `ALERT-001/004/006`, `HEM-002`, `ID-002/005/006`, `IMF-001`/`DBA-001`/`FANCONI-001`,
  `LOSS-001/002`, `MARROW-001/003`, `PARVO-001`, `Q-CYT-001`, `MICRO-005`, `NORMO-*`, `SMEAR-001`,
  `TEC-001`, `THAL-001`) uses `op: "is-present"`, which resolves to `toTri(actual) === 'true'`
  (`src/ruleEngine.js:45`) — a check that **cannot distinguish `'false'` from `'unknown'`**, because
  neither value is `'true'`. Zero of the 28 use `is-absent`, `is-unknown`, or `is-not-assessed`.
  `congenitalSignalsFullyAssessed` (`modules/anemia/facts.anemia.js:261`) is referenced by **zero
  rules** in the corpus today.

**Do not read this as "the UI improves nothing."** It improves capture fidelity for anyone reading the
raw payload — an auditor, a future rule author, a longitudinal record — even though today's rule corpus
cannot act on the distinction. That is the honest scope of this feature: engine behavior is unchanged,
capture fidelity is not.

### The neutrality precondition is conditional, not inherent — and must be pinned by a test

This neutrality holds **only because no rule currently distinguishes `'false'` from `'unknown'`**. It
ends the instant any rule author writes an `is-absent`, `is-unknown`, or `is-not-assessed` condition
against one of the 14 triAny/triAll/triNone-derived aggregates. At that point, omitting unanswered
fields becomes a genuine clinical behavior change, silently, unless something catches it. §6 (FR-9)
requires a guard test that asserts this precondition directly, so a future rule authored against these
aggregates fails loudly at authoring time instead of silently changing patient-facing output.

---

## 5. Scope

### 5.1 In Scope

- A four-option `<select>` control for each of the **59** booleanMap fields: symptoms (14, listed at
  `src/app.js:112-115`), history (40, `src/app.js:118-129`), exam (5, `src/app.js:131`).
- Payload change: `buildInput()` (`src/app.js:148-220`) omits a field's key entirely when its control is
  at the default "never touched" state, instead of submitting `false`.
- The round-trip fix: `setSimpleField()` (`src/app.js:1462-1468`) rewritten to write a value-bearing
  control state instead of collapsing `'false'`/`'unknown'` into the same unchecked boolean.
- A new pure, DOM-free logic module (`src/facts/fieldState.js`, mirroring the existing
  `src/facts/tristate.js` pattern) holding the read/write mapping between a control's stored value and
  its four-way clinician-facing state — the only part of this feature a Node test can execute directly
  (§8).
- The neutrality guard test (§4, FR-9).
- The registry-vs-markup parity test (§6, FR-11), closing a latent hand-sync drift risk that exists
  today regardless of this feature (`src/app.js:111-131`'s name arrays and `index.html`'s literal
  `name="..."` markup already have no automated check keeping them in sync).
- The safety-reviewed mutual-exclusion rewrite at `src/app.js:1634-1650` (§6, FR-13) — a safety-adjacent
  change treated as its own reviewed unit of work, not an incidental side effect.

### 5.2 Out of Scope

| Excluded | Why |
|---|---|
| A 4th persisted wire enum value | SPIKE-003's rejection stands (§0.2); no rule-corpus consumer exists (leg A §1). |
| Splitting the `is-unknown`/`is-not-assessed` engine operators into distinct branches | Same reasoning; this would be a clinical fact-semantics change requiring fresh audit + council-review, not a UI feature. |
| **"Ordered by information value" — the *adaptive* half of the roadmap's work-package title** (`01-platform-expansion-roadmap.md:288`) | No information-value research protocol exists. `02-evidence-foundry-on-research-foundry.md:113` assigns this research to a future track; it is unbuilt. Ranking questionnaire items by "information value" without a supporting evidence base would be an **invented ranking**, which CLAUDE.md's guardrails forbid outright ("no random calculator expansion... no unsupported confidence %"; the ranking score guardrail generalizes directly to ranking *questions*). This must ship as a separate, evidence-backed work package if it ships at all. |
| Authoring any rule that consumes the new false-vs-unknown distinction | AI may not author clinical rules; any such rule requires named-clinician review per CLAUDE.md. |
| P3-WP6 / FHIR Questionnaire resource mapping | Genuinely independent — see §5.4. Nothing in this feature touches it, and nothing in this feature is blocked by its absence. |
| The 11 `smear` multi-select checkboxes, 4 `cbc.localFlags` booleans, 6 lab-result booleans (`hbBartNewbornScreen` etc.), 3 `patient` booleans (`menstruating`/`recentTransfusion`/`highAltitude`), and 1 non-serialized safety-review checkbox (`#safety-reviewed-no-flags`) | Not booleanMap tri-state fields — different semantics, different (or absent) wire representation. Deferred and named so it is not lost (OQ-4). |

### 5.3 Scope-honesty correction: this work package is not "adaptive"

With the ordering/adaptive half removed (§5.2), the remaining scope is a **static four-option control
retrofit**, not an adaptive questionnaire. Recommend `01-platform-expansion-roadmap.md` and the
corresponding IntentTree node title drop "adaptive" — e.g. "Four-option questionnaire UI" — so the
roadmap does not describe a capability this work does not deliver. This PRD does not itself edit the
roadmap file's title; that correction is a P4 documentation task (§10).

### 5.4 P3-WP6/FHIR is explicitly not a dependency

The roadmap lists P3-WP7 (this work) as `depends_on: ["P3-WP6", "P1-WP1"]`
(`01-platform-expansion-roadmap.md:545`). That dependency does not hold for this PRD's scope:
`src/fhir/mapping.js` **does not exist** (confirmed by repository search — no `fhir` directory or file
under `src/`), and nothing in `schemas/`, `modules/`, or the SPA (`index.html`, `src/app.js`) references
it or any FHIR Questionnaire/QuestionnaireResponse resource. This feature is a pure client-side
serialization-and-markup change against the existing internal JSON wire format; it has no FHIR
dependency, in either direction. The roadmap's `depends_on` entry for P3-WP7 should be corrected
alongside the title fix in §5.3 (P4 documentation task).

---

## 6. Requirements

### 6.1 Functional Requirements

| ID | Requirement | Priority | Notes |
| :-: | ----------- | :------: | ----- |
| FR-1 | All 59 booleanMap fields (`symptomNames` 14, `historyNames` 40, `examNames` 5 — `src/app.js:111-131`) render as a 4-option `<select>` instead of a checkbox. | Must | Census and per-field markup uniformity: leg C §1. |
| FR-2 | The four `<select>` options are, in clinician-facing order (final wording/order per OQ-1/OQ-2): not-assessed (default), Unknown/can't determine, Present, Absent. No field varies this option set. | Must | Ordering and exact wording are open (OQ-1, OQ-2); this requirement fixes the four-option structure, not the copy. |
| FR-3 | `checked(name)` (`src/app.js:102-105`) is replaced (for booleanMap fields only) by a read that returns the control's selected value, delegating the interpretation to `src/facts/fieldState.js`. | Must | R1 applies: the replacement must not introduce a `RadioNodeList`-shaped control — a `<select>` is a single element, avoiding the guard-bypass risk radios would create. |
| FR-4 | `buildInput()` (`src/app.js:148-220`) omits a booleanMap field's key from `symptoms`/`history`/`exam` when the control is at its default "not-assessed" state, instead of emitting `false`. | Must | This is the payload change §3/§4 depend on. Does not change `patient`/`cbc.localFlags`/`labs` booleans (out of scope, §5.2). |
| FR-5 | `setSimpleField(name, val)` (`src/app.js:1462-1468`) is rewritten so that `'false'`, `'unknown'`, and an absent/undefined `val` each select a **distinct** control option on repopulation — fixing the existing round-trip defect where both collapse to the same unchecked state. | Must | This is an existing data-loss defect, not new scope created by this feature; fixing it is a direct consequence of the four-option control. |
| FR-6 | `populateFromInput()` (`src/app.js:1470` onward) correctly repopulates all 59 fields from a payload that may omit any of them, treating an omitted key as the "not-assessed" default state. | Must | |
| FR-7 | A new pure, zero-DOM module `src/facts/fieldState.js` exports the control-value ↔ four-way-state mapping functions (e.g. `stateFromControlValue`, `controlValueFromState`), containing no reference to `document`, `form`, or `RadioNodeList` anywhere in the file. | Must | Mirrors the existing, already-tested pattern in `src/facts/tristate.js:1-36`. This is the only part of the read/write logic a Node test can execute directly (leg B §3). |
| FR-8 | `checked()`/`booleans()`/`setSimpleField()`/`populateFromInput()` delegate their state-mapping decisions to `src/facts/fieldState.js` rather than inlining the mapping. | Must | Mirrors how `setSimpleField:1466` already delegates to `toTri()` from `src/facts/tristate.js`. |
| FR-9 | A neutrality guard test asserts that none of the 28 rule conditions currently reading the 14 triAny/triAll/triNone-derived aggregate facts uses `is-absent`, `is-unknown`, or `is-not-assessed` — i.e., it re-verifies the §4 precondition against the live rule corpus, not just against a point-in-time count. | Must | R3/leg D "load-bearing" recommendation. This must be written **before** any behavior change (P0 in the phase plan) so the precondition is pinned first. |
| FR-10 | The safety-reviewed mutual-exclusion listeners at `src/app.js:1634-1650` are rewritten to set an explicit "Absent"/"Unknown" state on every `immediateSafetyNames` field (forward direction) and to correctly detect a non-"not-assessed"/non-"Absent" state on the reverse direction, instead of force-writing a boolean `.checked`. | Must | R2 — safety-adjacent; the decisions block calls out this rewrite as its own task requiring its own review, not an incidental side effect of the control swap. |
| FR-11 | A registry-vs-markup parity test asserts that the field-name set in `index.html`'s `<select>` markup exactly matches the union of `symptomNames`/`historyNames`/`examNames` in `src/app.js:111-131` (both directions — no name in the registry missing from markup, and no markup name absent from the registry). | Must | Closes a latent hand-sync drift risk that exists today independent of this feature (leg C §2, §7). |
| FR-12 | The 59 field-to-`<select>` markup conversions in `index.html` are hand-edited, not generated by a build-time or runtime script. | Must | Decisions block §4: this repo's SPA is deliberately zero-dependency/no-build-step; introducing markup generation would be a larger architectural change than the feature itself and would move the clinical-review surface out of human-readable `index.html`. FR-11's parity test is the mitigation for the copy-paste risk this choice accepts. |
| FR-13 | No schema change is required or made: `schemas/patient-input.schema.json`'s `booleanMap` `$defs` entry (`:131-138`) already accepts a bare boolean or the strings `"true"`/`"false"`/`"unknown"`, and already tolerates key omission (fields are not individually `required`). | Must | Confirms §3's design needs zero schema fan-out, unlike the rejected 4th-enum-value alternative (leg A §3). |
| FR-14 | No engine, rule, or module-facts file (`src/ruleEngine.js`, `src/facts/tristate.js`, `modules/*/rules.json`, `modules/anemia/facts.anemia.js`) is modified by this feature. | Must | Enforces §0/§4: this is a UI-only, wire-format-compatible change. |

### 6.2 Non-Functional Requirements

**Performance:** no new network requests, no new dependency, no bundler step introduced. A `<select>`
per field is no heavier than the checkbox it replaces.

**Security / integrity:** no PHI leaves the browser; this feature makes no `/api/` calls and does not
touch `server.mjs`. New/changed files (`src/facts/fieldState.js`) should be added to
`scripts/check-app-imports.mjs`'s tracked surface if that script's allow-list applies to new `src/`
modules (verify at implementation time; not independently confirmed by this PRD).

**Accessibility:** each `<select>` must remain a single focusable, labelled element (native `<select>`
semantics carry this by default) — this is an explicit goal of choosing `<select>` over a 4-radio
fieldset (leg C §5: 59 fields × 4 radios = 236 inputs and ~236 tab stops vs. 59 for `<select>`, and no
existing radiogroup CSS idiom exists in this repo, while 20+ status `<select>` fields already exist as
a proven idiom, `index.html:184-190, 296-336`). Rendering/keyboard/screen-reader behavior is **manually
verified only** (§8) — no automated check in this repository can assert it.

**Reliability:** every one of the 59 fields must behave identically with respect to the four-way
mapping — no per-field special-casing exists in the current markup (leg C §1), so none should be
introduced.

**Observability:** none; none added. This SPA has no telemetry.

---

## 7. Dependencies & Assumptions

**External — none.** No new library, no new build step, no new test runner. `package.json` declares no
`dependencies`/`devDependencies`, unchanged by this feature.

**Internal:**
- `src/facts/tristate.js` (`toTri()`, `:6-11`) — read but not modified. The new `fieldState.js` module
  is additive alongside it, following its exact pattern.
- `schemas/patient-input.schema.json`'s `booleanMap` `$defs` entry — read but not modified (FR-13).
- `tests/golden/*.json` (6 files) and `tests/module-equivalence.test.mjs` — the byte-identity harness
  this feature must not perturb (§4, §8).

### Assumptions

- The 59-field count (symptoms 14 + history 40 + exam 5) is derived programmatically from
  `src/app.js:111-131` at the time these SPIKE legs ran; it should be re-confirmed against the same
  arrays at implementation time in case of drift.
- OQ-1 (option ordering) and OQ-2 (exact clinician-facing wording) are clinical-usability calls, not
  engineering calls, and are left open for a human decision before/at implementation (§9).
- P3-WP6/FHIR is not, and will not become, a dependency of this feature (§5.4); if that changes, it is
  new information requiring a new decision record, not a silent scope change here.

### Feature Flags — none. A flag would leave some sessions on the lossy checkbox mapping and some on
the fixed one, which is not a meaningfully safer rollout for a purely client-side, no-backend feature.

---

## 8. Verification — what can and cannot be automatically checked

**Read this before treating any requirement in §6 as "tested."** This repository has no browser
automation and no DOM test runner (`package.json` declares zero dependencies, by design). The following
states plainly what is CAN and CANNOT be established by `npm run check`, mirroring the honesty standard
set by `spa-module-switcher-v1.md`'s §11a.

### CAN be automatically verified

| What | How | Executes real logic? |
|---|---|---|
| The pure `src/facts/fieldState.js` mapping functions, incl. "omitted key → not-assessed" and "not-assessed → omit on serialize". | `tests/field-state.test.mjs` (new, `node --test`, direct import, no DOM). | Yes — same pattern as `tests/tristate-operators.test.mjs` against `src/facts/tristate.js`. |
| The neutrality precondition (FR-9): none of the 28 rule conditions over the 14 aggregates uses `is-absent`/`is-unknown`/`is-not-assessed`. | `tests/tristate-neutrality-guard.test.mjs` (new) — scans the live `modules/*/rules.json`. | Yes — reads and evaluates the actual rule JSON, not a cached count. |
| Golden-fixture identity: the payload change does not alter `assess()` output for the 6 golden fixtures. | `tests/module-equivalence.test.mjs` (existing, unmodified). | Yes — executes the real engine. |
| That `checked()`/`setSimpleField()`/`buildInput()`/`populateFromInput()` reference the new `fieldState.js` functions rather than inlining the mapping, and no booleanMap field still writes a plain `element.checked` boolean. | Static source-shape pin — the `functionBody()`/regex technique already used by `scripts/smoke-browser-unit-rejection.mjs:45-104` and `tests/module-switcher-eligibility.test.mjs`. | No — proves the right identifiers appear at the right call sites; does not execute `src/app.js` (DOM-dependent, not importable under Node — leg B §2). |
| Registry-vs-markup parity (FR-11): `index.html`'s field-name set matches `symptomNames ∪ historyNames ∪ examNames`. | `tests/questionnaire-registry-parity.test.mjs` (new) — reads both files as raw text (precedent: `tests/module-switcher-eligibility.test.mjs:29-34`). | Partially — a real set-equality check over extracted text, but the extraction is regex-based text parsing, not a DOM parse. |
| Schema acceptance: `booleanMap` still accepts the omit-key and three string-value shapes. | Existing schema suite (`tests/tristate-schema.test.mjs` et al.), unmodified — no schema change (FR-13). | Yes. |

### CANNOT be automatically verified — manually verified only

- **Rendering.** That the four-option `<select>` actually paints correctly in any browser — layout,
  spacing inside the existing `.check-grid`, focus ring, contrast.
- **Click/keyboard state transitions.** That selecting an option via mouse or keyboard actually updates
  the control's value and that the form submits the expected wire value. No test in this repository can
  dispatch a real DOM event against `src/app.js`, because it is not importable under Node
  (`src/app.js:40`'s top-level `$('#assessment-form')` call throws `ReferenceError: document is not
  defined` outside a browser — leg B §2).
- **Accessibility / screen-reader behavior.** That the four states are announced correctly, that
  keyboard-only operation reaches and selects each option, and that focus order across 59 fields remains
  sane.
- **Visual layout integrity.** That converting 59 checkboxes to 59 selects does not break the
  hand-written `index.html`'s existing `.check-grid` 3-column density, wrapping, or mobile breakpoints.
- **Cross-browser behavior.** Any Safari/Chrome/Firefox rendering or interaction difference for the new
  control markup.
- **`form.reset()` / browser autofill / paste interaction** with the new control type.

These six bullets must be captured by a person exercising the running SPA and recorded by name, the
same discipline `spa-module-switcher-v1.md` establishes with its P6-011 human-verification step. This
PRD does not name a specific task ID for that step; the implementation plan must add one.

### Explicitly forbidden verification approach

**A hand-rolled `document`/DOM shim inside a test file must not be written or presented as DOM
verification.** Per leg B §4: a fake `{ querySelector, querySelectorAll, getElementById }` object can
satisfy `src/app.js`'s import-time syntax but cannot reproduce real `HTMLFormElement.elements`
semantics, `RadioNodeList` identity checks, or `element.value`/`.checked` getter/setter behavior. Such a
shim can only encode the test author's own assumptions about DOM behavior — it cannot catch a bug where
those assumptions are wrong, which is exactly the class of defect a real browser test exists to catch.
If any such shim is ever written for local author sanity-checking, it must be excluded from `npm run
check` and labeled in its own file header as "tests internal consistency with this shim's model of the
DOM, not browser behavior" — never represented as proof the control works in a browser.

---

## 9. Risks & Mitigations

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | `RadioNodeList` guards in `src/app.js` (`checked()`/`checkedValues()`/`setSimpleField()`) bail out silently on a `RadioNodeList`. A radio-group implementation would silently break both read and write. | High | Would-be, if radios were chosen | Avoided structurally by choosing `<select>` (FR-1/FR-3) — always a single element, never a `RadioNodeList`. Verify explicitly during implementation, not just by design intent. |
| R2 | The safety-reviewed mutual-exclusion logic (`:1634-1650`) force-writes `.checked = false` across every `immediateSafetyNames` field — safety-adjacent code, must not be rewritten as an incidental side effect. | High | Certain — rewrite is required (FR-10) | Own task, own review in the implementation plan; not folded into the general read/write rewrite. |
| R3 | The neutrality precondition (§4) erodes silently the moment a future rule uses `is-absent`/`is-unknown`/`is-not-assessed` against one of the 14 aggregates. | High | Low near-term; failure mode is silent | The FR-9 guard test (§6, §8) — non-negotiable, written before any behavior change. |
| R4 | `tests/tristate-safety-invariant.test.mjs:270` hardcodes `TRI_VALUES = new Set(['true','false','unknown'])` (`:35`). | Medium | Low | No 4th wire value is added, so this stays green unmodified. **If it goes red, the design drifted from §3 — do not edit the test to match the code; stop and re-examine.** |
| R5 | Verification-ceiling overclaim: presenting a source-shape pin or a DOM shim as proof of rendering/click/keyboard/a11y correctness. | Medium | Medium without an explicit gate | §8 enumerates the ceiling and forbids the DOM-shim-as-verification pattern outright. |
| R6 | Survey fatigue: 59 dropdowns defaulting to "not assessed" may increase abandonment vs. 59 checkboxes. | Medium | Unknown — no data | Out of this PRD's power to measure; record as a human-factors validation item, not a claimed UX improvement. |
| R7 | `npm run check` is currently **RED on `main`** with 8 pre-existing failures (byte-identity baselines + D1 rights checks), unrelated to this work. | High (process) | Certain — already true | Gate criterion is **"no NEW failures vs. the recorded main baseline of 8"** (§11). This PRD does not own fixing the 8. |

---

## 10. Target State (Post-Implementation)

**User Experience:** each of the 59 booleanMap fields is a `<select>` with four options
(not-assessed/unknown/present/absent, default not-assessed) instead of a checkbox. A clinician can
explicitly record "I actively determined this is absent" separately from leaving a field untouched. No
part of the UI implies this changes what the engine concludes.

**Technical Architecture:** the wire payload for `symptoms`/`history`/`exam` omits any field left at its
default state instead of defaulting it to `false`; `src/facts/fieldState.js` holds the pure state
mapping; `src/app.js`'s five affected functions (`checked`, `booleans`, `buildInput`, `setSimpleField`,
`populateFromInput`) and the safety-reviewed mutual-exclusion listeners delegate to it. The engine,
rule schema, and all 6 golden fixtures are byte-identical to today.

**Observable Outcomes:** the round-trip data-loss defect at `setSimpleField:1466` is closed. A new
neutrality guard test exists and passes, re-verified against the live rule corpus. A new registry-vs-
markup parity test exists and passes, closing a latent hand-sync risk. `npm run check` shows **no new
failures** versus the recorded 8-failure main baseline (§11). Engine output is unchanged — this is a
verified fact (§4), not a target to hit.

---

## 11. Overall Acceptance Criteria (Definition of Done)

Per the planning skill's AC rules, any criterion using "across/all/everywhere/visible" carries an
explicit `target_surfaces` list.

### AC-1: All 59 booleanMap fields render as the four-option control
- target_surfaces: [index.html, src/app.js]
- Criterion: every field name in `symptomNames`/`historyNames`/`examNames` (`src/app.js:111-131`) has a
  corresponding `<select>` in `index.html` with exactly the four options from FR-2. Verified by the
  FR-11 parity test (source-asserted) plus a human visual pass (§8) — not claimed as behaviorally proven
  by the parity test alone.

### AC-2: Payload omits unanswered fields; engine output is unchanged
- target_surfaces: [src/app.js, tests/module-equivalence.test.mjs, tests/golden]
- Criterion: `buildInput()` omits a booleanMap key when its control is at "not-assessed"; all 6 golden
  fixtures in `tests/golden/` produce byte-identical `assess()` output before and after this feature
  ships. Verified by `tests/module-equivalence.test.mjs` (executed, unmodified).

### AC-3: The round-trip defect is fixed
- target_surfaces: [src/app.js]
- Criterion: `setSimpleField()`/`populateFromInput()` select a distinct control option for `'false'`
  versus `'unknown'` versus an omitted/undefined value — no two of the three collapse to the same
  visual state. Verified by `tests/field-state.test.mjs` (executed, pure-function) plus a human
  load/reload pass (§8) for the actual DOM behavior.

### AC-4: The neutrality precondition holds and is pinned
- target_surfaces: [modules/anemia/rules.json, modules/cbc_suite_v1/rules.json, modules/growth_suite_v1/rules.json, modules/kidney_suite_v1/rules.json, tests/tristate-neutrality-guard.test.mjs]
- Criterion: zero rule conditions over the 14 triAny/triAll/triNone-derived aggregate facts use
  `is-absent`/`is-unknown`/`is-not-assessed`. Verified by `tests/tristate-neutrality-guard.test.mjs`
  (executed, scans live rule JSON — a real re-check, not a cached count from the SPIKE legs).

### AC-5: The safety-reviewed mutual-exclusion rewrite preserves its invariant
- target_surfaces: [src/app.js]
- Criterion: ticking "safety-reviewed, no flags" still results in every `immediateSafetyNames` field
  reading as a non-present state, and any `immediateSafetyNames` field reading as present still
  unchecks "safety-reviewed." Source-asserted via a function-body pin on the rewritten listeners; the
  actual runtime behavior is **manually verified only** (§8) — no DOM execution is available.

### AC-6: Registry-vs-markup parity holds
- target_surfaces: [src/app.js, index.html, tests/questionnaire-registry-parity.test.mjs]
- Criterion: the field-name set in `index.html`'s new `<select>` markup exactly equals
  `symptomNames ∪ historyNames ∪ examNames`, both directions. Verified by
  `tests/questionnaire-registry-parity.test.mjs` (executed text-extraction + set-equality check).

### AC-7: No new gate failures versus the recorded main baseline
- target_surfaces: [package.json]
- Criterion: `npm run check` (build, test, validate, coverage:rules, verify:d4, check:imports,
  smoke:browser, smoke) produces **no failures beyond the 8 pre-existing ones already on `main`**
  (byte-identity baselines + D1 rights checks). This feature does not fix, and is not blocked by, those
  8. Any new failure is this feature's responsibility; the 8 are not.

### Documentation Acceptance
- [ ] `docs/project_plans/design-specs/tri-state-fact-model.md` updated to cross-reference this feature
      as the UI-layer consumer of the existing three-value model, without implying a fourth wire state
      was added.
- [ ] `01-platform-expansion-roadmap.md:288,545` — recommend title correction dropping "adaptive" (§5.3)
      and correcting the `depends_on: ["P3-WP6", ...]` entry (§5.4); recorded as a recommendation this
      PRD makes, not silently applied by this PRD's own authoring.
- [ ] CHANGELOG `[Unreleased]` entry (`changelog_required: true` — user-facing SPA change).

### Human-verification acceptance (not automatable — see §8)
- [ ] A named person has visually confirmed the four-option control renders correctly across the
      `.check-grid` layout at representative viewport widths.
- [ ] A named person has confirmed keyboard-only operation reaches and selects each of the four options
      for a representative sample of fields.
- [ ] A named person has confirmed the safety-reviewed mutual-exclusion behavior at runtime (AC-5).
- [ ] A named person has confirmed `form.reset()` behavior against the new controls.

---

## 12. Assumptions & Open Questions

### Open Questions (binding — from decisions-block.md §9)

| ID | Question | Status |
|:-:|---|---|
| OQ-1 | Ordering of the 4 `<select>` options. | Open — a clinical-usability call, not an engineering one. Must be resolved before/during implementation. |
| OQ-2 | Exact clinician-facing wording ("Not assessed" vs. "Not asked" vs. blank/placeholder). Must not imply the choice changes inference. | Open. |
| OQ-3 | Should the roadmap/IntentTree title be corrected to drop "adaptive"? | Recommend **yes** (§5.3); not applied by this PRD itself. |
| OQ-4 | Do the 13 non-booleanMap booleans (4 `localFlags` + 6 lab-result + 3 `patient` booleans) eventually need the same four-option treatment? | Deferred — named here so it is not lost, not answered by this feature. |

---

## 13. Appendices & References

### Related Documentation
- **Evidence base:** `.claude/worknotes/four-state-questionnaire-ui/decisions-block.md` (authoritative)
  and SPIKE legs A–D in the same directory.
- **Prior decision this PRD does not reopen:**
  `docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md:579-584`.
- **Design spec:** `docs/project_plans/design-specs/tri-state-fact-model.md`.
- **Roadmap entry this PRD corrects the framing of:**
  `docs/project_plans/expansion/01-platform-expansion-roadmap.md:288,545`.

### Prior Art
- `spa-module-switcher-v1.md` — same repo, same SPA surface, same Tier 3 shape, same verification-
  ceiling discipline (§11a there / §8 here). Used as the estimation anchor and house-style reference for
  this PRD.

---

## Implementation

Phase structure, agent/model routing, and estimation are owned by
`.claude/worknotes/four-state-questionnaire-ui/decisions-block.md` §6–§8. Orientation only (**14 pts**,
Tier 3, anchored against `spa-module-switcher-v1`):

| Phase | Name | Scope | Exit gate | Pts |
|---|---|---|---|---|
| P0 | Baseline & guard | Record the 8 pre-existing `main` failures (R7); write the FR-9 neutrality guard test **before** any behavior change | Guard test green; baseline recorded | 2 |
| P1 | Pure logic extraction | New `src/facts/fieldState.js`; direct `node --test` coverage | New module tested; `src/app.js` not yet rewired | 2 |
| P2 | SPA read/write rewire | `checked()`, `booleans()`, `setSimpleField()`, `populateFromInput()`, safety-exclusion listeners (R2/FR-10); omit-unanswered payload | Goldens still identical; source-shape pins added | 5 |
| P3 | Markup | 59 hand-edited `<select>` conversions in `index.html` + CSS; FR-11 parity test | Parity test green; human visual pass recorded | 3 |
| P4 | Docs & honesty corrections | Update design spec + roadmap-title/dependency recommendation (§5.3/§5.4); manual-verification checklist (§11) recorded | `npm run check` shows no new failures vs. the R7 baseline | 2 |

P0 precedes P1 deliberately: the neutrality guard must exist before the payload change it guards
against. Full phase/task detail, agent routing (delegation-router resolved), and the risk-hotspot table
are in the decisions block; this PRD does not duplicate them.

**Progress Tracking:** `.claude/progress/four-state-questionnaire-ui/` (per-phase files, once an
implementation plan is authored from this PRD).
