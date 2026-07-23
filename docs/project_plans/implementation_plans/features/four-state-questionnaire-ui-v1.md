---
schema_version: 2
doc_type: implementation_plan
title: "Implementation Plan: Four-State Questionnaire UI — capture-fidelity control for the 59 booleanMap fields"
status: draft
created: 2026-07-23
updated: 2026-07-23
feature_slug: four-state-questionnaire-ui
feature_version: v1
prd_ref: docs/project_plans/PRDs/features/four-state-questionnaire-ui-v1.md
plan_ref: null
scope: "Convert the 59 booleanMap questionnaire fields (symptoms 14, history 40, exam 5) from two-state checkboxes to four-option selects that omit unanswered fields from the payload, fixing an existing round-trip data-loss defect — a wire-format-compatible, engine-output-unchanged UI change, not a rule or fact-model migration."
effort_estimate: 14
architecture_summary: "A new DOM-free src/facts/fieldState.js (mirroring src/facts/tristate.js) holds the pure four-clinician-state <-> three-wire-value mapping, with 'not-assessed' represented by control value '' mapping to an OMITTED payload key rather than a fourth wire literal. src/app.js's five affected functions (checked-family read, buildInput, setSimpleField, populateFromInput, and the safety-reviewed mutual-exclusion listener at :1637-1650) delegate to it. 59 <select> markup conversions land hand-edited in index.html, guarded by a registry<->markup parity test and a markup<->registry<->serialization seam test. A neutrality guard test (FR-9), written first in P0, re-verifies against the live rule corpus that no rule condition consumes the false-vs-unknown distinction, converting a future silent clinical-behavior change into a loud authoring-time failure. No engine, rule, or module-facts file is touched."
related_documents:
  - docs/project_plans/PRDs/features/four-state-questionnaire-ui-v1.md
  - .claude/worknotes/four-state-questionnaire-ui/decisions-block.md
  - .claude/worknotes/four-state-questionnaire-ui/spike-legA-semantics.md
  - .claude/worknotes/four-state-questionnaire-ui/spike-legB-verification.md
  - .claude/worknotes/four-state-questionnaire-ui/spike-legC-surface.md
  - .claude/worknotes/four-state-questionnaire-ui/spike-legD-empirical-probe.md
  - .claude/worknotes/four-state-questionnaire-ui/gate-baseline.md
  - docs/project_plans/SPIKEs/spike-010-four-state-questionnaire-ui.md
  - docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md
  - docs/project_plans/design-specs/tri-state-fact-model.md
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  - docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md
references:
  user_docs: []
  context: []
  specs:
    - schemas/patient-input.schema.json
    - docs/project_plans/design-specs/tri-state-fact-model.md
  related_prds: []
spike_ref: docs/project_plans/SPIKEs/spike-010-four-state-questionnaire-ui.md
adr_refs: []
deferred_items_spec_refs:
  - docs/project_plans/design-specs/non-booleanmap-four-state-treatment.md
findings_doc_ref: null
charter_ref: null
changelog_ref: null
changelog_required: true
test_plan_ref: null
plan_structure: unified
progress_init: auto
owner: null
contributors:
  - Opus orchestrator
  - implementation-planner
priority: medium
risk_level: medium
category: features
tags: [implementation, planning, phases, tasks, spa, tri-state, questionnaire, capture-fidelity]
milestone: null
commit_refs: []
pr_refs: []
files_affected:
  - index.html
  - styles.css
  - src/app.js
  - src/facts/fieldState.js
  - tests/field-state.test.mjs
  - tests/tristate-neutrality-guard.test.mjs
  - tests/questionnaire-registry-parity.test.mjs
  - docs/project_plans/design-specs/tri-state-fact-model.md
  - docs/project_plans/design-specs/non-booleanmap-four-state-treatment.md
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  - CLAUDE.md
  - CHANGELOG.md
---

# Implementation Plan: Four-State Questionnaire UI

**Plan ID**: `IMPL-2026-07-23-four-state-questionnaire-ui` · **Date**: 2026-07-23 · **Author**:
`implementation-planner`, expanding the Opus-authored decisions block
**Human Brief**: none authored separately for this Tier 3 feature — the decisions block
(`.claude/worknotes/four-state-questionnaire-ui/decisions-block.md`) carries the estimation basis
inline (§8) and is treated as authoritative in its place.
**Related Documents**:
- **PRD** (FR-1..FR-14, AC-1..AC-7, §8 verification ceiling, R1–R7, OQ-1..OQ-4):
  `docs/project_plans/PRDs/features/four-state-questionnaire-ui-v1.md`
- **Decisions Block** (binding; phase boundaries, routing, estimates, R1–R7, OQ-1..OQ-4 not
  reopened below): `.claude/worknotes/four-state-questionnaire-ui/decisions-block.md`
- **SPIKE-010** (RQ-1..RQ-6, legs A–D): `docs/project_plans/SPIKEs/spike-010-four-state-questionnaire-ui.md`
- **Gate baseline** (the 8 pre-existing failures + the build-before-test trap):
  `.claude/worknotes/four-state-questionnaire-ui/gate-baseline.md`
- **Prior decision this plan does not reopen**:
  `docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md:579-584`

**Complexity**: Medium (Tier 3 floor, 13+) · **Total Estimated Effort**: **14 pts** (decisions block §8,
carried through unchanged — not re-derived here)
**Provider**: mixed — `ica` (Claude Sonnet 5, 1M context) for P0/P1/P3/P4; **`claude` primary for P2**,
the highest-risk seam (R1/R2), deliberately not delegated. Cross-family adversarial review on every
phase via `codex`/`gpt-5.6-terra`. Gates via `karen`/`task-completion-validator` on `claude` (primary,
non-negotiable).

## Executive Summary

The 59 booleanMap questionnaire fields (symptoms 14, history 40, exam 5 —
`src/app.js:111-131`) render today as two-state checkboxes mapped onto the SPA's existing
three-value wire model (`'true'|'false'|'unknown'`, `src/facts/tristate.js:4`). The mapping is lossy:
`setSimpleField()` (`src/app.js:1462-1468`) collapses `'false'` and `'unknown'` to the same unchecked
visual state on repopulation — an existing round-trip data-loss defect, independent of this feature.
This plan replaces each checkbox with a 4-option `<select>` (present/absent/unknown/not-assessed),
fixes that defect as a direct consequence, and changes the payload so an unanswered field is **omitted**
rather than defaulted to `false`. **The engine is empirically unchanged** (SPIKE-010 leg D: all 6
golden fixtures byte-identical) — this is a capture-fidelity improvement, not a diagnostic, safety, or
inference improvement, and no part of this plan claims otherwise.

**The premise this plan does not reopen.** The engine is tri-state, not four-state, and stays that way
(`src/ruleEngine.js:44-48`: `is-not-assessed` is a declared synonym of `is-unknown`). A four-state fact
type was explicitly considered and rejected on the record four days before this feature's evidence base
was assembled (`spike-003-tri-state-fact-model-migration.md:579-584`, status `completed`,
2026-07-19). This plan's architecture — four clinician-visible states over three wire values, with
"not assessed" represented by **key omission**, never a fourth stored literal — is the mechanism that
delivers the clinician-visible distinction without reopening that decision (decisions block §1).

Five phases run strictly sequentially — **P0 → P1 → P2 → P3 → P4**, 2+2+5+3+2 = 14 pts, no parallel
wave — because each phase's output gates the next: the neutrality guard (P0) must exist before any
behavior change; the pure logic module (P1) must exist before `src/app.js` is rewired to call it (P2);
the rewired read/write functions (P2) must exist before the markup that exercises them lands (P3); and
the scope-honesty corrections (P4) close out the feature once behavior is settled.

## Implementation Strategy

### Architecture Sequence

This is a browser-local, zero-dependency, no-build-step static SPA (`index.html` → native ESM
`src/app.js`, no bundler). The MeatyPrompts layered-architecture checklist (routers/services/
repositories/API) does not apply — there is no backend call anywhere in this feature's path (PRD §2).
The sequence that does apply:

1. **Guard first** (P0) — the FR-9 neutrality regression test must exist before anything it guards changes.
2. **Pure logic** (P1) — a DOM-free module holding the actual four-state mapping, the only part of this
   feature a Node test can execute directly (SPIKE-010 leg B).
3. **Seam rewire** (P2) — the five DOM-coupled `src/app.js` functions delegate to P1's module.
4. **Surface** (P3) — 59 hand-edited markup conversions, gated on P2's rewired read/write path existing.
5. **Honesty close-out** (P4) — docs, roadmap-framing correction, deferred items, human-verification
   checklist finalization.

### Ordering Constraints (binding — do not reorder or parallelize around these)

- **P0 before P1 is deliberate** (decisions block §6): the neutrality guard must exist *before* the
  payload-omission behavior it guards against ships, converting a future silent clinical-behavior
  change (a rule authored against `is-absent`/`is-unknown`/`is-not-assessed` on one of the 14
  `triAny`/`triAll`/`triNone`-derived aggregates in `modules/anemia/facts.anemia.js`) into a loud,
  authoring-time test failure instead of a silent one. This is R3 (High) and the single highest-value
  deliverable identified across all four SPIKE legs.
- **P1 lands before P2 rewires `src/app.js`.** P2's five rewritten call sites all delegate their
  state-mapping decision to `src/facts/fieldState.js` (FR-8) rather than inlining it — mirroring how
  `setSimpleField:1466` already delegates to `toTri()` today. Writing P2 first would repeat the mistake
  the `tristate.js` extraction was created specifically to avoid (SPIKE-010 leg B §3).
- **P3 depends on P2's rewritten read/write path existing** — the FR-11 parity test and the seam test
  (P3-05) assert against the option-value vocabulary `fieldState.js` expects, which P2 establishes.
- **OQ-1/OQ-2 (option ordering/wording) are a phase-entry precondition for P3, not an engineering task.**
  A named human must resolve both before any of the 59 hand-edits begin (phase-3 detail, P3-00) — these
  are clinical-usability calls the guardrails reserve for a human, not an agent-invented default.

### Critical Path

No parallel wave exists in this plan — 14 pts run as a single sequential chain, matching the
decisions block's own phase-boundary table (§6), which does not identify a legal parallel slice at
this scale (contrast `spa-module-switcher-v1`'s 41-pt plan, which had a genuine P0∥P1 wave). Splitting
P3's markup work from P2's rewire would violate the ordering constraint above; splitting P4 out early
would violate "P4 closes the loop after behavior is settled."

```mermaid
graph LR
  P0["P0: Baseline & Guard (2)"] --> P1["P1: Pure Logic Extraction (2)"]
  P1 --> P2["P2: SPA Read/Write Rewire (5)"]
  P2 --> P3["P3: Markup Conversion (3)"]
  P3 --> P4["P4: Docs & Honesty (2)"]
```

### Phase Summary

Canonical orchestration index — the decisions block §7 routing table, carried through verbatim.

| Phase | Title | Estimate | Target Subagent(s) | Model(s) | Provider | Effort | Notes |
|-------|-------|---------:|--------------------|----------|----------|--------|-------|
| P0 | Baseline & Guard | 2 pts | general-purpose | sonnet-5[1m] | ica | adaptive/extended | FR-9 neutrality guard test **must** exist before any behavior change. Bounded test authoring. |
| P1 | Pure Logic Extraction | 2 pts | general-purpose | sonnet-5[1m] | ica | adaptive | New DOM-free `src/facts/fieldState.js`; `tristate.js` is a direct template — well-precedented. |
| P2 | SPA Read/Write Rewire | 5 pts | general-purpose | **sonnet** | **claude (primary)** | adaptive/extended | **Highest-risk seam (R1/R2) — kept on primary, not delegated.** The plan's genuine risk concentration. |
| P3 | Markup Conversion | 3 pts | general-purpose | sonnet-5[1m] | ica | adaptive | 59 mechanical, uniform edits. `integration_owner` for the seam task is the P2 (primary) executor. |
| P4 | Docs & Honesty | 2 pts | general-purpose (documentation) | haiku / sonnet-5[1m] | ica | adaptive | Doc-only; also applies the OQ-3 roadmap-framing correction. |
| **Total** | — | **14 pts** | — | — | — | — | 2+2+5+3+2 = 14, matching the decisions block §8 estimate unchanged. |

Every phase additionally carries: a **`codex`/`gpt-5.6-terra` cross-family adversarial diff review**
(per-wave, `claude`-independent — project memory records this catches real fail-closed gaps
validators approve) and a **`task-completion-validator` exit gate** on `claude`/`sonnet`. P2 and P4
additionally carry a **`karen` milestone review** — P2 for the risk concentration, P4 as the
end-of-feature review. Gates and reviewers are **MUST-stay-primary** (`claude`) regardless of which
provider executes the phase's build tasks.

**Known trap (decisions block §7)**: `execute-plan` silently skips review when reviewer agents are
unregistered — probe before launching. **Every prompt-embedded shell command dispatched to an
executor must use the absolute worktree path**
(`/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui`)
— workflow agents otherwise resolve "repo root" to the main checkout (project memory:
`workflow-agents-resolve-repo-root-to-main-checkout`).

### Phase Detail Files

Full task tables, per-task Model/Effort/Provider assignments, and phase-specific rationale live in the
phase files (this parent stays under the house-style line guideline):

- **[Phase 0-1: Baseline & Guard, Pure Logic Extraction](./four-state-questionnaire-ui-v1/phase-0-1-baseline-and-pure-module.md)**
- **[Phase 2: SPA Read/Write Rewire](./four-state-questionnaire-ui-v1/phase-2-spa-rewire.md)** — the risk-concentration phase
- **[Phase 3: Markup Conversion](./four-state-questionnaire-ui-v1/phase-3-markup-conversion.md)** — includes the OQ-1/OQ-2 phase-entry precondition
- **[Phase 4: Docs & Honesty Corrections](./four-state-questionnaire-ui-v1/phase-4-docs-and-honesty.md)** — includes the OQ-3/OQ-4 close-out and the human-verification checklist

## Gate Criterion — binding on every phase (do not soften)

Per PRD §11 AC-7 and the gate-baseline record: **the gate is RED on `main` before this feature starts.**
`.claude/worknotes/four-state-questionnaire-ui/gate-baseline.md` records **8 pre-existing failures**
(six byte-identity/baseline pins — test IDs 336, 789, 814, 2132, 2133, 2138 — and two D1
rights-governance checks — 2363, 2364), measured at commit `8c59db1`, unrelated to this feature and
not owned by it (R7, High/process severity). **Every phase's exit criterion, stated once here and
repeated in each phase file, is:**

> `npm run check` (= `npm run build && npm test && npm run validate && npm run coverage:rules && npm
> run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke`) shows **exactly
> these 8 failures and no others.** A run showing more, fewer, or different failures is a FAIL for this
> work package.

**⚠ Build-before-test trap.** Running bare `npm test` in a **fresh worktree** reports **10** failures,
not 8 — two extra (test IDs 2029, 2125 in the baseline doc's numbering) are `dist/`-dependent artifacts
of `dist/` not existing yet. **Always run `npm run build` before `npm test`**, exactly as `npm run
check` does. An executor who runs bare `npm test` first will believe they broke two tests they did not
touch — do not "fix" them; they are not real, and they disappear once `dist/` exists. P0-01 re-verifies
this baseline against the live tree before any other work begins.

## Verification Honesty — what this feature can and cannot prove

This repository has no browser automation and no DOM test runner (`package.json` declares zero
dependencies, by design). Reproducing SPIKE-010 leg B's split and PRD §8, stated plainly so no later
report overclaims what a green `npm run check` means.

### CAN be automatically verified (executed, real logic)

| What | How | Executes real logic? |
|---|---|---|
| The pure `src/facts/fieldState.js` mapping, incl. omitted-key↔not-assessed and the `'false'`≠`'unknown'` round-trip fix | `tests/field-state.test.mjs` — direct `node --test` import, no DOM | Yes — same pattern as `tests/tristate-operators.test.mjs` against `src/facts/tristate.js` |
| The neutrality precondition (FR-9): no rule condition over the 14 derived aggregates uses `is-absent`/`is-unknown`/`is-not-assessed` | `tests/tristate-neutrality-guard.test.mjs` — scans the live `modules/*/rules.json`, all four modules | Yes — reads and evaluates the actual rule JSON, not a cached count |
| Golden-fixture identity: the payload change does not alter `assess()` output for the 6 golden fixtures | `tests/module-equivalence.test.mjs` (existing, unmodified) | Yes — executes the real engine |
| That `checked`/`buildInput`/`setSimpleField`/`populateFromInput`/the safety listener delegate to `fieldState.js` rather than inlining the mapping, and no booleanMap field still writes a plain `element.checked` boolean | Static source-shape pin — the `functionBody()`/regex brace-scan technique from `scripts/smoke-browser-unit-rejection.mjs:45-104` | No — proves the right identifiers appear at the right call sites; does not execute `src/app.js` (DOM-dependent, unimportable under Node — leg B §2) |
| Registry↔markup parity (FR-11) and the markup↔registry↔serialization option-value seam | `tests/questionnaire-registry-parity.test.mjs` — raw-text read + set/string equality (precedent: `tests/module-switcher-eligibility.test.mjs:29-34`) | Partially — real set/string-equality checks over extracted text, not a DOM parse |
| Schema acceptance: `booleanMap` still accepts the omit-key and three string-value shapes | Existing schema suite, unmodified (no schema change, FR-13) | Yes |

### CANNOT be automatically verified — manually verified only

- **Rendering** — the four-option `<select>` actually paints correctly in any browser (layout,
  spacing inside `.check-grid`, focus ring, contrast).
- **Click/keyboard state transitions** — selecting an option via mouse or keyboard actually updates the
  control's value and the form submits the expected wire value. No test can dispatch a real DOM event
  against `src/app.js` (`src/app.js:40`'s top-level `$('#assessment-form')` call throws
  `ReferenceError: document is not defined` outside a browser — leg B §2).
- **Accessibility / screen-reader behavior** — announcement of the fourth state, keyboard-only
  operability, focus order across 59 fields.
- **Visual layout integrity** — that 59 checkbox→select conversions don't break `index.html`'s existing
  `.check-grid` density, wrapping, or mobile breakpoints.
- **Cross-browser behavior** — any Safari/Chrome/Firefox rendering or interaction difference.
- **`form.reset()` / browser autofill / paste interaction** with the new control type.

These six items must be captured by a named person exercising the running SPA — the same discipline
`spa-module-switcher-v1.md`'s P6-011 established. This plan assigns them concretely: P3-06 (visual
layout, the first item) and P4-05 (the remaining three: keyboard, safety-reviewed runtime, `form.reset`)
— each requires a named signer and date, not a checkbox ticked without one.

### Explicitly forbidden verification approach

**A hand-rolled `document`/DOM shim inside a test file must not be written or presented as DOM
verification.** Per leg B §4: a fake `{ querySelector, querySelectorAll, getElementById }` object can
satisfy `src/app.js`'s import-time syntax but cannot reproduce real `HTMLFormElement.elements`
semantics, `RadioNodeList` identity checks, or `element.value`/`.checked` getter/setter behavior — it
can only encode the test author's own assumptions about DOM behavior, which is exactly the class of
defect a real browser test exists to catch. If any such shim is ever written for local author
sanity-checking, it must be excluded from `npm run check` and labeled in its own file header as
"tests internal consistency with this shim's model of the DOM, not browser behavior" — never
represented as proof the control works in a browser. No task in this plan authors one.

## Deferred Items & In-Flight Findings Policy

### Deferred Items Triage Table

Every one of decisions block §9's OQ-1..OQ-4 appears below, per the plan-generator rule that no open
question may be silently lost.

| Item ID | Category | Reason Deferred | Trigger for Promotion | Target Spec Path |
|---------|----------|-----------------|-----------------------|-----------------|
| OQ-1 | dependency-blocked | 4-`<select>`-option ordering is a clinical-usability call, not an engineering one. **Not deferred past this feature** — it is a blocking phase-entry precondition for P3 (P3-00), resolved by a named human before any markup edit lands. | Resolved at P3-00, before P3-01 | N/A — resolution recorded inline (P3-00) and durably captured at P4-05, not a design spec |
| OQ-2 | dependency-blocked | Exact clinician-facing wording, same reasoning as OQ-1; must not imply the choice changes inference (honesty caveat, PRD §3). | Resolved at P3-00, before P3-01 | N/A — same as OQ-1 |
| OQ-3 | scope-cut, resolved-in-plan | Roadmap/IntentTree title overstates this work as "adaptive" and lists a non-dependency (P3-WP6/FHIR). **Not deferred** — corrected directly by P4-02 (roadmap file) with the IntentTree title correction flagged as a separate human/orchestrator follow-up (this plan edits repository files only). | Applied at P4-02 | N/A — applied directly, not deferred; see P4-02 |
| OQ-4 | research-needed | Whether the 13 non-booleanMap booleans (4 `cbc.localFlags`, 6 lab-result, 3 `patient`) eventually need the same four-state treatment. Genuinely deferred — no decision made by this feature. | A future feature proposes extending four-state capture beyond the 59 booleanMap fields | `docs/project_plans/design-specs/non-booleanmap-four-state-treatment.md` (authored at P4-04, `maturity: idea`) |

**Rule applied**: every row above either has a `Target Spec Path` (OQ-4) or is marked N/A with an
explicit rationale (OQ-1/OQ-2/OQ-3) — none is silently dropped.

### In-Flight Findings

Not pre-created; `findings_doc_ref` stays `null` until the first execution-time finding, per the
lazy-creation rule. If P2's rewrite (the risk-concentration phase) surfaces an unexpected coupling —
e.g., a call site to `checked()`/`setSimpleField()` this plan's file-reading did not find — record it
at `.claude/findings/four-state-questionnaire-ui-findings.md` and set `findings_doc_ref` accordingly;
if load-bearing, add a design-spec task to P4 and append the path to `deferred_items_spec_refs`.

### Quality Gate

P4 cannot close until: OQ-4's design spec exists at its target path and is appended to
`deferred_items_spec_refs`; OQ-1/OQ-2/OQ-3 are each recorded as resolved/applied per the table above;
and, if `findings_doc_ref` is populated, that findings doc is finalized (`draft` → `accepted`).

## Risk Mitigation

Carried from decisions block §5 / PRD §9 (R1–R7), each mapped to the phase that owns its mitigation.

| # | Risk | Severity | Owning Phase | Mitigation |
|---|---|:---:|:---:|---|
| R1 | `RadioNodeList` guards (`value()`:90/91, `checked()`:102-105, `setSimpleField()`:1465) all bail out on `RadioNodeList`. A radio-group approach would silently break read+write. | High | P2, P3 | `<select>` chosen over radio groups specifically because it is always a single element, never a `RadioNodeList` (decisions block §4). P2 explicitly retains all three guards as defense in depth (P2-01/03/05); P2-GATE rejects if any guard is dropped. |
| R2 | Safety-reviewed mutual exclusion (`src/app.js:1637-1650`) force-writes `.checked = false` across every `immediateSafetyNames` field. | High | P2 | Rewritten as its own reviewed unit of work (P2-05), not folded into the general read/write rewrite; forward direction sets explicit Absent, reverse direction detects Present-or-Unknown. `karen` P2 milestone review specifically checks the reverse-direction Unknown case. |
| R3 | Neutrality precondition erodes silently the moment a future rule uses `is-absent`/`is-unknown`/`is-not-assessed` against one of the 14 aggregates. | High | P0 | The FR-9 guard test (P0-02), written **before** any behavior change, deriving its aggregate-fact list from source rather than hardcoding it. Non-negotiable — this is why P0 precedes P1. |
| R4 | `tests/tristate-safety-invariant.test.mjs:35`'s `TRI_VALUES` is hardcoded to 3 values. | Medium | P2 (monitoring), all phases (non-action) | No 4th wire value is added anywhere in this plan, so this test should stay green unmodified. **If it goes red, that is a signal the design drifted from decisions block §1 — do not edit the test to match the code; stop and escalate.** No task in this plan touches this test. |
| R5 | Verification-ceiling overclaim — presenting a source-shape pin or a hand-rolled DOM shim as proof of rendering/click/keyboard/a11y correctness. | Medium | All phases | The Verification Honesty section above enumerates the ceiling explicitly and forbids the DOM-shim pattern outright; every phase file repeats the CAN/CANNOT split so no phase executor can plausibly miss it. |
| R6 | Survey fatigue — 59 dropdowns defaulting to "not assessed" may increase clinician abandonment versus 59 checkboxes. | Medium | Out of this plan's power | Not measurable by any task here. Recorded as a human-factors validation item in the PRD (§9) and not claimed as a UX improvement anywhere in this plan's documentation tasks (P4-03's CHANGENLOG entry explicitly avoids this claim). |
| R7 | Gate is RED on `main` for 8 pre-existing, unrelated failures. | High (process) | P0 (baseline recorded), all phases (gate criterion) | P0-01 re-verifies the baseline before work begins; every phase's exit gate is "exactly 8 failures, no others" — see Gate Criterion section above. This plan does not absorb ownership of the 8. |

## Estimation Sanity Check

**Anchor**: `spa-module-switcher-v1` (`docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md`)
— same repo, same SPA surface, same Tier 3 shape, also SPIKE-backed, and the house-style reference for
this plan's format. That plan landed at 41 pts after a `karen`-gate re-estimation from a back-fitted 34;
its own lesson (project memory: `karen-as-planning-gate-catches-unbuildable-verification`) is why this
plan's phase estimates are carried through from the decisions block **unmodified** rather than
re-derived or fitted to a target total. This feature's bottom-up total (P0=2, P1=2, P2=5, P3=3, P4=2 =
**14**) sits at the Tier 3 floor (13+), is materially smaller in scope than the 41-pt module-switcher
plan (one new pure module + a rewrite of 5 existing functions + 59 mechanical markup edits, versus a
new selector UI, a fail-closed refusal state, and a governance ADR), and is trusted over the roadmap's
prior top-down "effort: M" estimate, which predates the discovery that the engine is tri-state, not
four-state.

## Model, Provider & Profile Assignment

Per decisions block §7 (`delegation-router` resolved). All tasks carry Model/Effort/Provider columns in
the phase files.

- **Model/Provider**: `sonnet-5[1m]` on `ica` for P0, P1, P3, P4 (bounded, well-precedented, or
  mechanical work); **`sonnet` on `claude` (primary) for P2** — the highest-risk seam (R1/R2) is
  deliberately kept off the free-tier delegate.
- **Effort**: `adaptive` by default; **`extended`** on P0-02 (the single highest-value guard test) and
  on P2's R1/R2-adjacent tasks (P2-05, and P2 overall per the decisions block).
- **Review**: `codex`/`gpt-5.6-terra` cross-family adversarial diff review on every phase, `effort`
  scaled to risk — `high` on P2, `medium` on P0/P3, `low`/`medium` on P1/P4.
- **Gates**: `karen`/`task-completion-validator`, always `claude`/`sonnet`, **MUST-stay-primary**
  regardless of which provider executed the phase's build tasks. `karen` milestone reviews land at the
  end of P2 (risk concentration) and P4 (end-of-feature).

## Hard Constraints Carried Through (do not violate in execution)

- **No task modifies `src/ruleEngine.js`, `src/facts/tristate.js`, `modules/*/rules.json`, or
  `modules/anemia/facts.anemia.js`** (PRD FR-14). P2-GATE and P2-KAREN both check this explicitly.
- **No clinical claim.** This is an unvalidated research prototype. No task populates
  `approvedBy[]`/`clinicalApprovers[]`. No documentation task (P4-01, P4-03) may state or imply improved
  diagnostic accuracy, safety, or clinical validity — only capture fidelity.
- **No invented thresholds or rankings.** The information-value/adaptive-ordering half of the original
  work-package title is explicitly out of scope (decisions block §3, PRD §5.2) — no task in this plan
  authors it.
- **Absolute worktree paths only** in any prompt-embedded shell command dispatched to an executor —
  `/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/plan-four-state-questionnaire-ui`.

## Wrap-Up: Feature Guide & PR

Once P4 is sealed and FEATURE-KAREN passes, delegate to a documentation writer (`general-purpose`,
`sonnet-5[1m]`/`ica`) to create `.claude/worknotes/four-state-questionnaire-ui/feature-guide.md`
(≤200 lines). Its **Known Limitations** section must state plainly: this feature changes capture
fidelity only, engine output is empirically unchanged (all 6 golden fixtures byte-identical), the
information-value/adaptive-ordering half of the original work-package title was never in scope, and
the four human-verification items were verified by a named person, not by any executed browser test.
Commit the feature guide before opening the PR; the PR title should name the honesty outcome
("capture-fidelity control," not "adaptive questionnaire").

**Progress Tracking**: `.claude/progress/four-state-questionnaire-ui/` — `context.md` + one file per
phase (`phase-0-progress.md` .. `phase-4-progress.md`).

**Plan Version**: 1.0 · **Last Updated**: 2026-07-23
