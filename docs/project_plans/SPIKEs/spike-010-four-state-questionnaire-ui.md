---
schema_version: 2
doc_type: spike
title: "SPIKE-010: Four-State Questionnaire UI"
status: completed
created: 2026-07-23
completed: 2026-07-23
feature_slug: four-state-questionnaire-ui
research_questions:
  - "RQ-1 — Does the engine's fact model or any of the 91 rules distinguish 'is-unknown' from 'is-not-assessed' today, and is a 4th persisted state architecturally viable without reopening a prior decision?"
  - "RQ-2 — What is the honest verification ceiling for a DOM-dependent, four-option questionnaire control in a zero-dependency, no-browser-automation repo?"
  - "RQ-3 — What is the markup/blast-radius cost of converting 57–59 checkbox fields to an exclusive 4-way control, and which surface strategy (hand-edit, runtime generator, build-time generator) fits this repo's architecture?"
  - "RQ-4 — Does omitting an unanswered questionnaire field (vs. sending it as an explicit 'false') change any golden-fixture assess() output today, and under what precondition does that neutrality hold?"
  - "RQ-5 — Is P3-WP7 actually blocked on P3-WP6 (FHIR resource mapping), as the roadmap's dependency graph states?"
  - "RQ-6 — Given the tri-state engine and the SPIKE-003 rejection of a 4th enum value, what architecture delivers four clinician-visible states without violating either constraint?"
complexity: L
estimated_research_time: "4 parallel legs + empirical probe"
prd_ref: null
plan_ref: null
related_documents:
  - .claude/worknotes/four-state-questionnaire-ui/spike-legA-semantics.md
  - .claude/worknotes/four-state-questionnaire-ui/spike-legB-verification.md
  - .claude/worknotes/four-state-questionnaire-ui/spike-legC-surface.md
  - .claude/worknotes/four-state-questionnaire-ui/spike-legD-empirical-probe.md
  - .claude/worknotes/four-state-questionnaire-ui/decisions-block.md
  - docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
---

# SPIKE-010: Four-State Questionnaire UI

> **Research record only.** This document reports what four parallel investigation legs plus an
> empirical probe found, and the design decisions those findings force. It authorizes no clinical
> content, no rule change, and no engine behavior change. `clinicalApprovers[]`/`approvedBy[]` remain
> exactly what they were before this SPIKE ran — empty, by design, for every module. This repo is an
> **unvalidated research prototype**; nothing here claims or implies improved diagnostic accuracy,
> safety, or clinical validity. The feature this SPIKE informs changes **capture fidelity** — what a
> clinician's answer preserves on the wire — not the engine's rule-derived output, which SPIKE
> evidence (leg D) shows is unchanged.

## Summary

**Premise correction — read this first.** The task framing that produced this SPIKE assumed "the
four-state fact model ships in the engine" and that the work is blocked on P3-WP6 (FHIR resource
mapping). Both are wrong, and four independent legs plus direct code reading agree on why:

- **The engine is tri-state, not four-state.** `src/facts/tristate.js` defines `toTri()` returning
  only `'true' | 'false' | 'unknown'`. `src/ruleEngine.js:44-48` implements `is-not-assessed` as a
  **declared synonym** of `is-unknown` — both branches call `toTri(actual) === 'unknown'`; there is no
  fourth branch to fall into:

  ```js
  case 'is-unknown':
  case 'is-not-assessed': return toTri(actual) === 'unknown';
  ```

  This is not an oversight to fix — it is a **deliberate, on-the-record architectural decision**.
  SPIKE-003 explicitly considered and rejected a genuine 4th enum value
  (`spike-003-tri-state-fact-model-migration.md:579-584`), four days before this SPIKE ran
  (2026-07-19), on the grounds that no rule in the audited 91-rule corpus needs to distinguish "raw
  field never sent" from "computed-indeterminate" as two different rule-matchable states.
- **P3-WP6/FHIR is not a blocker.** The roadmap's dependency graph
  (`01-platform-expansion-roadmap.md:545`) lists P3-WP7 as `depends_on: ["P3-WP6","P1-WP1"]`, but
  `src/fhir/mapping.js` does not exist and nothing in the schema, engine, or SPA references it
  (leg C §4). The dependency is aspirational sequencing in a roadmap table, not a real code coupling.
- **The roadmap's own name for this work is "tri-state," not "four-state."** `01-platform-expansion-
  roadmap.md:288` titles the work package "**Tri**-state adaptive questionnaire UI," and its
  IntentTree node carries the same title. The "four-state" framing in the task that spawned this SPIKE
  does not match the roadmap it cites.

The real constraint governing this work is not FHIR — it is **SPIKE-003's recorded, reasoned rejection
of a 4th persisted state.** This plan must not silently overturn that decision. Overturning it would
require new evidence of a concrete rule consumer; none exists (confirmed again in leg A §1–2 and
empirically in leg D). The architecture this SPIKE settles on (§3) delivers four states to the
*clinician* while leaving the *engine* at three, so SPIKE-003 stands unreversed.

---

## Research questions & answers

### RQ-1 / Leg A — Semantics: is a 4th persisted state viable, or is "not-assessed" UI-only?

**Leg report:** `.claude/worknotes/four-state-questionnaire-ui/spike-legA-semantics.md`

**Method.** Grepped `is-unknown`/`is-not-assessed`/`is-present`/`is-absent` usage across all four
modules' `rules.json`. Read the engine's operator dispatch and the tri-state helper module directly.
Enumerated the full blast radius for both a persisted 4th state and a UI-only 4th option.

**Findings.**

- Across all four modules, `is-unknown` appears **1 time** (`modules/cbc_suite_v1/rules.json:38-41`,
  rule `CBC-NEUT-LOCALRANGE-001`) and `is-not-assessed` appears **0 times**. `is-present` appears 83
  times; `is-absent` 0 times. Nothing today reads the two synonym spellings as different things,
  because the engine (`src/ruleEngine.js:47-48`) makes that structurally impossible.
- Question-emission (`"op": "missing"`, the only op driving `"type": "question"` output) targets raw
  scalar facts (`patient.ageMonths`, `cbc.hb`, `thresholds.hbLower`), never a booleanMap tri-state
  field — so the "not-assessed should re-prompt" behavior SPIKE-003 already specified
  (`spike-003-...md:310`) has no live rule to exercise it either way.
- **Blast radius, persisted 4th literal:** ≈13 files/areas, including `schemas/patient-input.schema.json`,
  `schemas/rule.schema.json`, `src/facts/tristate.js`, `src/ruleEngine.js`, every derived-fact call site
  in `modules/anemia/facts.anemia.js` (25+ occurrences), the byte-identity golden-fixture harness (6
  files), 73 fixture files, and 48 witness files. This is a fact-semantics change — the exact category
  SPIKE-003's DEF-2 places outside a zero-clinical-behavior-change mandate.
- **Blast radius, UI-only 4th option serializing to `'unknown'`:** 1–2 files (`src/app.js`, optionally
  `styles.css`). No schema, engine, rule, module-facts, or golden-fixture change.
- The roadmap's own line already scopes this narrowly: P3-WP7 (`01-platform-expansion-roadmap.md:288`)
  says "surface present/absent/unknown/not-assessed **in the SPA**" — its own words put the four states
  in the UI, not the persisted fact model.

**Leg A's recommendation:** keep "not-assessed" UI-only, serializing to the wire value `'unknown'`.
**The orchestrator's verdict overrides this** — see §3.

### RQ-2 / Leg B — Verification ceiling for a four-state control

**Leg report:** `.claude/worknotes/four-state-questionnaire-ui/spike-legB-verification.md`

**Method.** Read `scripts/smoke-browser-unit-rejection.mjs`'s brace-depth source-scanning technique
line by line. Grepped all `tests/*.mjs` for `src/app.js` imports vs. static-text reads. Traced why
`src/app.js` cannot be imported under Node. Audited the four candidate serialization functions for DOM
coupling. Evaluated a hand-rolled `document` shim as an alternative.

**Findings.**

- `src/app.js` is genuinely unimportable under plain Node: `src/app.js:40`
  (`const form = $('#assessment-form');`) is a top-level, module-scope statement that evaluates `$()`'s
  default parameter `document` immediately at import time, throwing `ReferenceError: document is not
  defined` before any assertion can run. **Zero** test files in the repo `import`/`await import()`
  `src/app.js` — all 8 files that reference it do so via `readFileSync` + regex/brace-scan
  (`tests/module-registry.test.mjs:72`, `:80`; `tests/module-switcher-eligibility.test.mjs:9-10`, `:29,32`).
- Of the four serialization functions audited (`checked`, `booleans`, `buildInput`, `setSimpleField`),
  **none is pure today** — all read or write live DOM nodes via `form.elements.namedItem`. But
  `src/facts/tristate.js` (`toTri`, `countPresent`, `anyUnknown`, `allAssessed`) is a proven, already-
  shipped precedent for extracting the pure decision logic into a zero-DOM module that Node can
  `import` and test directly — `setSimpleField:1466`'s tri-state write decision already delegates to
  it.
- A hand-rolled `document` shim in a test file was evaluated and **rejected outright**: it can only
  encode the test author's own assumptions about DOM behavior (`RadioNodeList` identity,
  `element.checked` semantics, `classList.toggle`), so it cannot catch the class of bug a real browser
  test exists to catch. It would make `smoke-browser-unit-rejection.mjs`'s own stated boundary ("no
  browser automation dependency is available," `:337`) quietly false in spirit while staying true in
  fact.
- Text-presence/absence assertions on raw `index.html` **are** an established, legitimate pattern here
  (`tests/module-switcher-eligibility.test.mjs:223-230`, `:535`) — but every existing use asserts "does
  this string exist," never "does this element behave correctly when clicked."

**Leg B's recommendation, adopted:** (1) extract the pure tri-state read/write mapping into a new
DOM-free module mirroring `src/facts/tristate.js`, with direct `node --test` coverage; (2) add static
source-shape pins on `src/app.js`/`index.html` using the existing brace-scan technique to catch drift
between wiring and tested logic; (3) never present a hand-rolled `document` shim as DOM verification.
See "Cannot Be Proven" below for what stays out of reach regardless.

### RQ-3 / Leg C — Surface strategy & blast radius

**Leg report:** `.claude/worknotes/four-state-questionnaire-ui/spike-legC-surface.md`

**Method.** Censused all `type="checkbox"` markup in `index.html`. Evaluated declarative/generated
markup viability against the existing name-array registries in `src/app.js`. Mapped every `.checked`
read/write call site in `src/app.js`. Checked module-switcher interaction. Compared `<select>` vs.
radio-group density and accessibility. Searched for prior ADRs constraining SPA markup style. Checked
which existing tests would break.

**Findings.**

- 84 checkboxes censused; **69** are the uniform `<label><input name="X" type="checkbox"> Text</label>`
  form inside `.check-grid`; 3 add `class="check-label"`; 1 (the non-serialized safety-reviewed
  checkbox) uses `id` not `name`; 11 are the `name="smear" value="..."` multi-select group. The 57–59
  booleanMap fields are markup-identical modulo two cosmetic class variants — no per-field
  special-casing to preserve.
- `checked()`, `checkedValues()`, `booleans()`, `buildInput()`, `anyChecked()`, `updateWorkflowState()`,
  `updateCaseUi()`, `setSimpleField()`, `populateFromInput()`, and the safety-exclusion listener at
  `src/app.js:1634-1650` collectively make ~35 direct `.checked` reads/writes across 10
  call-sites/functions — but a exclusive-control conversion concentrates the real change in **4**
  low-level functions (`checked`, `setSimpleField`, `populateFromInput`'s smear/safety lines, and the
  safety-exclusion listener), not all 10.
- `activateModule()` never touches the questionnaire form's DOM (`src/app.js:1220-1230`) — the module
  switcher and this feature operate on independent layers (which module's rules run vs. which control
  renders a field's value). No conflict, by construction.
- Accessibility/density: at 57–59 fields × 4 options, a native `<select>` collapses each field to one
  tab-stop (vs. ~4 per radio group, ~228-236 total) and preserves the existing `.check-grid` density;
  the form already uses 20+ status `<select>`s elsewhere (`rbcInterpretation`, `ferritinStatus`,
  `crpStatus`), so `<select>` is an existing idiom, not a new one. Radio groups would need ~3-4x the
  vertical/horizontal space per field and wreck the current 3-per-row grid.
- No ADR or doc constrains SPA markup style. SPIKE-003 (`spike-003-...md:579-584`) is the only prior
  decision directly on point, and it constrains the **wire model**, not markup — it rejected a 4th
  wire-level enum value, which bears directly on whether "four-state" can mean a genuine 4th persisted
  value (it cannot, without new evidence) versus 4 UI options mapping onto the existing 3 wire states
  (the question this SPIKE resolves in §3).
- `tests/module-switcher-eligibility.test.mjs` string-scans for *absence* of forbidden substrings —
  unaffected either way. Domain-level tests (`boundary.test.mjs`, `dangerous-miss-*.test.mjs`,
  `property.test.mjs`) call `assess()` directly with hand-built objects and never touch the DOM — they
  break only if the wire shape itself changes, which is a data-model question, not a surface one.

**Leg C's recommendation:** generate the 57–59 fields' controls from a declarative `{name, label}`
registry at **build time** (a new Node script under `scripts/`, run as part of `npm run build`), citing
the existing hand-sync drift risk between `src/app.js`'s name arrays and hand-authored markup as
justification. **The orchestrator's verdict overrides this** — see §3.

### RQ-4 / Leg D — Empirical probe: does omitting a field change engine output?

**Leg report:** `.claude/worknotes/four-state-questionnaire-ui/spike-legD-empirical-probe.md`

**Method.** A throwaway script (outside the repo, no repo file modified) imported `assessPediatricAnemia`
and `deriveFacts` (moduleId `anemia`). For each of the 6 golden fixtures, every explicit
`false`/`'false'` key inside `symptoms`/`history`/`exam` was deleted, simulating a UI that omits
unanswered fields rather than sending `false`. Baseline sanity: `node --test
tests/module-equivalence.test.mjs` → 6/6 pass before the probe.

**Findings.**

| Fixture | `false` keys removed | `assess()` output |
|---|---|---|
| anemia-inflammation | 1 (`history.heavyMenstrualBleeding`) | IDENTICAL |
| beta-thalassemia-trait | 0 | IDENTICAL |
| hemolysis-hs | 0 | IDENTICAL |
| ida-toddler | 0 | IDENTICAL |
| lead-capillary | 0 | IDENTICAL |
| marrow-red-flags | 0 | IDENTICAL |

All 14 `triAny`/`triAll`/`triNone`-derived aggregate facts were unchanged, original vs. variant, on
all 6 fixtures. **Incidental finding:** 5 of 6 goldens contain zero explicit `false` values anywhere in
`symptoms`/`history`/`exam` — the corpus is already authored "true-or-absent," so it barely exercises
the explicit-negative scenario.

Because of that gap, a synthetic variant of `ida-toddler.json` set all 6 bleeding-related fields
explicitly `false`, then applied the omission transform. The aggregate **flip is real**:
`history.bleedingHistory: "false" -> "unknown"`. But `assess()`'s final output was **still IDENTICAL**.

**Why it does not surface.** All 28 rule conditions touching those 14 aggregates
(`AINF-002/004`, `ALERT-001/004/006`, `HEM-002`, `ID-002/005/006`,
`IMF-001/DBA-001/FANCONI-001`, `LOSS-001/002`, `MARROW-001/003`, `PARVO-001`, `Q-CYT-001`,
`MICRO-005`, `NORMO-*`, `SMEAR-001`, `TEC-001`, `THAL-001`) use `op: "is-present"` exclusively. Zero
use `is-absent`, `is-unknown`, or `is-not-assessed`. `src/ruleEngine.js:45-48`'s `is-present` tests only
`toTri(actual) === 'true'`, so `'false'` and `'unknown'` are indistinguishable to every rule in the
anemia corpus. `marrow.congenitalSignalCount` is built with `countPresent()`, which counts only
explicit `'true'`. `congenitalSignalsFullyAssessed` is referenced by **zero rules** — dead output
today.

**Verdict: no.** Omitting unanswered questionnaire fields does not change the engine's rule-derived
output (candidates, alerts, questions, notes, ranks) for any golden fixture, and the same holds
structurally across the anemia corpus.

**The neutrality precondition (load-bearing).** This neutrality is **conditional, not inherent** — it
holds *because* no rule distinguishes `'false'` from `'unknown'` today. It ends the moment any rule
author writes an `is-absent`, `is-unknown`, or `is-not-assessed` condition against one of these
aggregates, at which point omitting unanswered fields becomes a genuine clinical behavior change. This
precondition must be pinned by a regression test asserting no such consumer exists, so the assumption
fails loudly at authoring time rather than silently changing patient-facing output later. This is the
single highest-value deliverable identified across all four legs.

### RQ-5 / RQ-6 — Is FHIR the blocker, and what architecture resolves the tri-state/four-state tension?

Answered directly in the Summary and §3: FHIR is not a blocker (nothing in schema/engine/SPA depends
on `src/fhir/mapping.js`, which does not exist); the architecture that resolves the tension is four
clinician-visible states over three wire values, with "not assessed" represented by key absence rather
than a value at all.

---

## The decision

**Four clinician-visible states. Three wire values. "Not assessed" is represented by key absence, not
a value.**

| Clinician selects | Payload | Engine sees | Provenance preserved? |
|---|---|---|---|
| (never answered — default) | key **omitted** | `'unknown'` | Yes — key absence is durable in saved/exported JSON |
| Unknown / can't determine | `'unknown'` | `'unknown'` | Yes |
| Present | `'true'` | `'true'` | Yes |
| Absent | `'false'` | `'false'` | Yes |

**Why this, and not either of the two obvious alternatives the legs surfaced:**

- **Not a 4th persisted enum value.** Leg A's blast-radius audit (§ RQ-1) shows this reopens SPIKE-003's
  on-the-record rejection, touches ~13 files/areas including the brittle golden-fixture harness, splits
  an engine operator pair that is currently a deliberate synonym, and — per leg D — delivers **zero**
  behavior change, because no rule consumes it. The cost/benefit is wildly disproportionate.
- **Not leg A's own recommendation — a 4th UI option that serializes to `'unknown'`.** This is rejected
  on guardrail grounds, not architectural ones. A clinician who selects "Not assessed" would reasonably
  believe the system recorded that they did not assess the field. It would not — both "Not assessed"
  and "Unknown" would collapse to the identical stored value `'unknown'`. In a tool whose stated ethic
  is "missingness is never treated as normal" and whose value proposition is an auditable trace,
  silently collapsing two clinician-meaningful inputs into one stored value is precisely the quiet
  dishonesty the guardrails exist to prevent. Leg A itself names this as its own strongest
  counter-argument: it is a permanent loss of clinical provenance that would force a second migration
  if a future rule (e.g., P3-WP1's longitudinal/follow-up logic) ever needs to distinguish "affirmatively
  unknown" from "never asked."

Key-absence resolves the tension between the two rejected options: the distinction between "never
answered" and "answered unknown" is **captured and durable** in the payload — a re-opened assessment
or an export can see that a key was never present — while remaining **invisible to the rule engine**,
which continues to see exactly three tri-state values. SPIKE-003's decision stands unreversed, no
operator splits, no golden fixture moves, and no clinical provenance is thrown away at the point of
capture.

**The honesty caveat this decision carries.** Key-absence is honest about *capture* but the UI must not
overclaim *consequence*. Per leg D, selecting "Not assessed" vs. "Unknown" changes **nothing** in the
engine's output today. The UI must not imply otherwise, and any downstream PRD must state this plainly
rather than implying improved inference or diagnostic value.

---

## Empirical evidence

Leg D's method and per-fixture table are reproduced in full under RQ-4 above; the essential facts:

- All 6 golden fixtures produced **byte-identical** `assess()` output when every explicit `false` in
  `symptoms`/`history`/`exam` was deleted (simulating omission-on-capture).
- 5 of the 6 goldens contain zero explicit `false` values in those sections to begin with, so the
  corpus under-exercises the scenario by construction — this is recorded as an incidental finding, not
  papered over.
- A synthetic all-negative-bleeding-history variant of `ida-toddler.json` proved the underlying
  mechanism is real (`triAll` flips a definite `'false'` aggregate to `'unknown'` the instant one
  member becomes unassessed) — but the flip still did not reach final output, because **all 28** rule
  conditions touching the 14 `triAny`/`triAll`/`triNone` aggregates use `op: "is-present"` exclusively,
  which is blind to the difference between `'false'` and `'unknown'`.
- **The neutrality precondition must be treated as a load-bearing invariant, not a one-time finding.**
  It holds today because of an absence (no `is-absent`/`is-unknown`/`is-not-assessed` consumer of these
  aggregates), and absences are exactly the kind of fact that erodes silently as rules are added over
  time. A regression test asserting the precondition itself — not just today's outputs — is the
  mechanism that converts a future silent clinical-behavior change into a loud, authoring-time test
  failure. Any implementation plan that omits this test has not actually captured leg D's finding.

---

## Verification ceiling

Leg B's audit establishes, concretely, what can and cannot be proven by any automated check available
in this zero-dependency, no-browser-automation repo. The two things that **can** be done honestly:

1. Extract the pure tri-state read/write mapping into a new DOM-free module (e.g.
   `src/facts/fieldState.js`), mirroring the already-shipped, already-tested pattern in
   `src/facts/tristate.js`. This is the *only* path by which a Node test can *execute* the actual
   four-state logic rather than merely grep for its presence.
2. Add static source-shape pins on `src/app.js` and `index.html`, using the exact
   `functionBody`/regex brace-scanning technique already established in
   `scripts/smoke-browser-unit-rejection.mjs:45-104` and `tests/module-switcher-eligibility.test.mjs` —
   proving the right identifiers appear at the right call sites, catching drift between wiring and
   tested logic, without claiming to execute either.

**Cannot be proven, by any automated check in this stack — manually verified only:**

- That the four-state control **renders** correctly in any browser (layout, visual state per state,
  focus rings, contrast).
- That **clicking/tapping/keyboard-navigating** the control produces the correct next state (cycling
  order, ARIA state changes) — no test in this repo can dispatch a real DOM event.
- That `checked()`/`setSimpleField()`/`buildInput()`/`populateFromInput()` correctly read from or write
  to a **live** control instance — these functions stay DOM-gated via `form.elements.namedItem` even
  after the pure-logic extraction; only the decision logic inside them becomes testable, never the DOM
  read/write itself.
- That the control is **accessible** — screen-reader announcement of the fourth state, keyboard-only
  operability, correct focus order. No automated check in this stack asserts accessibility semantics
  beyond existing text-presence checks on `role="note"`.
- That replacing 57–59 checkboxes does not **visually break** the hand-written `index.html` layout
  (spacing, wrapping, mobile breakpoints).
- That `form.reset()`, browser autofill, or paste interact correctly with the new control type.
- Any cross-browser behavioral difference (Safari vs. Chrome vs. Firefox rendering or handling of the
  new markup).

**A hand-rolled `document` shim is rejected outright** as a substitute for any of the above. It encodes
only the test author's own assumptions about DOM behavior and cannot catch the class of bug a real
browser exists to expose. If ever used for author-local sanity-checking, it must be excluded from
`npm run check` and labelled in code as testing the shim's model of the DOM, not the browser.

---

## Alternatives considered

### Alternative 1 — A 4th persisted enum value (`'not-assessed'` distinct from `'unknown'`)

**What it was:** add a literal 4th string to the wire-level tri-state type, split
`is-unknown`/`is-not-assessed` into two real engine branches, and let every consuming layer
(schema, `toTri()`, derived facts, rules) treat "never asked" and "asked, indeterminate" as genuinely
different states.

**Why rejected:** SPIKE-003 already ran this exact analysis four days earlier and rejected it on the
same grounds this SPIKE reconfirms — zero concrete rule consumer exists in the audited 91-rule corpus
(leg A §1–2; leg D's empirical probe independently confirms no behavioral difference would result even
if it existed). The blast radius (~13 files/areas, including the brittle golden-fixture byte-identity
harness) is disproportionate to a change with no behavioral payoff. Reopening it requires new evidence
of a concrete consumer; this SPIKE found none.

**Steelman:** SPIKE-003 itself calls the underlying distinction — "raw field never sent" vs.
"computed-indeterminate from present-but-borderline data" — "a real conceptual one," not a false
distinction; it rejected the enum value only for lack of a *current* consumer, explicitly leaving the
door open to future evidence. If P3-WP1's longitudinal/follow-up logic, or some future safety rule,
ever needs "affirmatively ruled out as indeterminate" to trigger different downstream behavior than
"we forgot to ask," a real 4th wire state would eventually be the correct architecture, and building it
now (while the corpus is small) could be cheaper than migrating to it later once 91 rules have grown
further. This SPIKE's decision (§3, key-absence) is explicitly designed to keep that door open without
paying the cost today.

### Alternative 2 — A 4th UI option that serializes to `'unknown'` (leg A's own recommendation)

**What it was:** add a 4th radio/select option in the SPA labelled "Not assessed," but map it to the
existing wire value `'unknown'` on submit — no schema, engine, or fact-layer change at all. This is the
smallest possible blast radius (1–2 files) of any option considered.

**Why rejected:** it is dishonest by construction. A clinician selecting "Not assessed" would
reasonably believe the system recorded that distinction; it does not — "Not assessed" and "Unknown"
become byte-identical in storage. This violates the repo's own stated ethic that missingness is never
treated as normal, and it discards clinical provenance permanently at the point of capture rather than
merely deferring a decision.

**Steelman:** it is the cheapest correct-shaped answer to the literal roadmap ask ("surface
present/absent/unknown/not-assessed **in the SPA**," `01-platform-expansion-roadmap.md:288`, which
scopes this explicitly as a UI concern), it touches no fixture or schema, and — per leg D — it produces
*zero* difference in engine behavior versus the key-absence design this SPIKE actually chose, because
neither design's distinction is consumed by any rule today. If the only goal were satisfying the
roadmap line's literal words at minimum engineering cost, this alternative would suffice. It loses
specifically because "minimum engineering cost" is not the deciding criterion here — honesty about what
was captured is.

### Alternative 3 — Radio groups instead of `<select>`

**What it was:** an exclusive `<fieldset role="radiogroup">` of 4 `<input type="radio">` options per
field, the textbook-accessible pattern for a small exclusive choice set.

**Why rejected:** at 57–59 fields × 4 options, this is 228–236 individual inputs and roughly that many
tab-stops, versus 57–59 for a `<select>`. It also needs roughly 3–4x the per-field footprint, which
would wreck the existing 3-column `.check-grid` layout density. The form already uses 20+ status
`<select>` fields elsewhere, so `<select>` is the existing idiom clinicians are already fluent with;
radio groups would be a new, denser, and slower-to-navigate pattern introduced at scale.

**Steelman:** radio groups let a clinician see all 4 options at once without opening a dropdown —
genuinely valuable for a true either/or clinical judgment call, and the more conventional accessible
pattern for a small mutually-exclusive set in isolation. At a smaller field count, or for a subset of
fields where the choice is unusually consequential and scan-ability matters more than page density,
radio groups would be the better default. The rejection is a density argument specific to this form's
scale (57–59 repeats on one page), not a claim that radio groups are categorically wrong.

### Alternative 4 — Build-time markup generator (leg C's own recommendation)

**What it was:** a new Node script under `scripts/`, run as part of `npm run build`, that emits the
57–59 fields' `<select>`/radiogroup markup into `index.html` from a declarative `{name, label}`
registry — eliminating hand-edit repetition and the latent hand-sync drift risk that already exists
today between `src/app.js`'s name arrays and the hand-authored markup.

**Why rejected:** this repo's SPA is deliberately zero-dependency and no-build-step for itself —
`scripts/build-static.mjs` today only copies and stamps files; it does not generate markup. Introducing
a markup generator is a larger architectural change than the feature it would serve, and it moves the
clinical-content review surface out of human-readable `index.html` and into JavaScript. In a repo whose
guardrail model depends on a human being able to read `index.html` and see every clinical field
verbatim, that is a real loss, not a neutral refactor. Hand-editing 57–59 uniform, markup-identical
fields is mechanical, diff-reviewable, and bounded.

**Steelman:** leg C is correct that the per-field marginal cost of a generator, once built, is
near-zero, while hand-editing pays a real per-field cost 57–59 times over and carries a real
copy-paste/name-label-mismatch risk each time (mitigated, but not eliminated, by a registry↔markup
parity test). A generator also directly fixes the pre-existing hand-sync drift between
`src/app.js:111-131`'s name arrays and the markup — a latent bug source today regardless of which
option wins. If this feature required frequent future field-set churn, or if the field count were an
order of magnitude larger, the generator's fixed cost would clearly be worth paying. At 57–59 one-time
conversions in a form whose field set has been stable, it is not.

---

## Risks & open questions

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **`RadioNodeList` guards.** `value()`, `checked()`, `setSimpleField()` all bail out on `RadioNodeList`. A radio-group approach would silently break read+write. | High | `<select>` avoids this entirely — a select is a single element, never a `RadioNodeList`. Explicitly verify. |
| R2 | **Safety-reviewed mutual exclusion** (`src/app.js:1634-1650`) force-writes `.checked = false` across every `immediateSafetyNames` field. | High | Must be rewritten to set an explicit value rather than unchecking a box. Safety-adjacent UI — treat as its own task with its own review. |
| R3 | **Neutrality precondition erodes silently** when a future rule uses `is-absent`/`is-unknown`/`is-not-assessed` against one of the 14 aggregates. | High | The guard test from leg D is non-negotiable and must exist before any behavior change ships. |
| R4 | **Existing safety test breaks by design if the architecture drifts.** `tests/tristate-safety-invariant.test.mjs` asserts all absence spellings normalize to unknown; its `TRI_VALUES` constant is hardcoded to 3. | Medium | This SPIKE's decision adds no 4th wire value, so this test should stay green. If it goes red, treat that as a signal the implementation has drifted from this decision — do not edit the test to match the code. |
| R5 | **Verification ceiling overclaim.** Nothing in this stack can assert rendering, click/keyboard transitions, accessibility, or visual integrity. | Medium | Enumerate "manually verified only" explicitly in any downstream plan. Forbid a hand-rolled DOM shim presented as DOM verification. |
| R6 | **Survey fatigue.** 57–59 dropdowns defaulting to "not assessed" may increase clinician abandonment versus 57–59 checkboxes. | Medium | Not measurable by this SPIKE. Record as a human-factors validation item; do not claim a UX improvement without that validation. |
| R7 | **Gate is red on `main` for reasons unrelated to this work** — pre-existing failures (byte-identity baselines and rights-governance checks) predate this SPIKE. | High (process) | Any downstream plan must not absorb these into its own scope. State the gate criterion as "no *new* failures versus the recorded main baseline," and record the pre-existing count explicitly rather than silently inheriting it. |
| OQ-1 | Ordering of the 4 `<select>` options is a clinical-usability call, not an engineering one — undecided by this SPIKE. |
| OQ-2 | Exact clinician-facing wording ("Not assessed" vs. "Not asked" vs. a blank default) is undecided. Whatever is chosen must not imply the choice changes inference (per §3's honesty caveat). |
| OQ-3 | Whether the roadmap/IntentTree title for this work package should be corrected to drop "adaptive," given that the adaptive half is out of scope (see below). Not decided here — flagged for the PRD. |
| OQ-4 | Whether the 13 non-booleanMap booleans (`localFlags`, lab booleans, patient booleans) eventually need the same four-state treatment. Deliberately deferred; named here so it is not lost. |

---

## Out of scope

- **A 4th persisted wire/enum value.** SPIKE-003's rejection stands; no new consumer evidence exists
  (Alternative 1).
- **Splitting the `is-unknown`/`is-not-assessed` operator pair** into two distinct engine branches. Same
  reasoning — this would be a clinical rule-semantics change, which requires independent clinical
  review and executable tests, not a UI-driven data-model edit.
- **"Ordered by information value"** — the *adaptive* half of the roadmap's own work-package title
  (`01-platform-expansion-roadmap.md:288`, "Tri-state adaptive questionnaire UI ... ordered by
  information value"). **Excluded because no information-value research protocol exists.** That
  research is assigned elsewhere in the program's own tracking and is unbuilt today. Ranking
  questionnaire fields by "information value" without an evidence-backed protocol for computing that
  value would be an **invented ranking** — a category of output the repo's guardrails explicitly
  forbid ("no random calculator expansion," "no invented thresholds," and the broader prohibition on
  presenting unsupported clinical judgments as though they were evidence-derived). If this half of the
  work package is pursued, it must be its own separate, evidence-backed work package, not folded
  silently into this one.
- **Authoring any rule that consumes the "never asked" vs. "answered unknown" distinction.** This
  SPIKE's architecture makes that distinction *capturable*; deciding whether and how a rule should ever
  read it is clinical rule authorship, which this repo's guardrails reserve for a named, credentialed
  human clinician with independent review — never an AI-authored rule change.
- **P3-WP6 / FHIR Questionnaire resource mapping.** Confirmed genuinely independent (Summary); nothing
  in this SPIKE's architecture couples to it.
- **The 11 `smear` multi-select checkboxes, 4 `localFlags`, 6 lab booleans, 3 patient booleans, and the
  1 non-serialized safety-reviewed checkbox.** These are not booleanMap tri-state fields and carry
  different semantics; converting them is a separate decision (OQ-4).
- **Any `sign-kb.mjs` per-module hardcode fix, `src/algorithmExplorer.js` generalization beyond graceful
  degradation, or module-status changes.** None of these are touched by, or required by, this feature.
