---
schema_version: 2
doc_type: report
report_category: finding
title: "Cross-family review of the four-state questionnaire UI plan — 2 blockers, 2 high, 1 medium"
status: accepted
source: agent
created: 2026-07-23
feature_slug: four-state-questionnaire-ui
prd_ref: docs/project_plans/PRDs/features/four-state-questionnaire-ui-v1.md
plan_ref: docs/project_plans/implementation_plans/features/four-state-questionnaire-ui-v1.md
---

# Cross-family review findings — `gpt-5.6-terra`, read-only

An independent cross-family (non-Claude) adversarial review of the completed planning bundle
returned **"Do not execute this plan as written."** Every checkable claim below was **verified
directly against source** before acceptance. All five findings are accepted; four are confirmed
exactly as reported, one required a correction to its characterization.

---

## F-1 — BLOCKER (CONFIRMED). The plan leaves live `.checked` consumers broken.

`<select>` elements have no meaningful `.checked`, so `checked()` (`src/app.js:102-105`) returns
`false` for every converted field. The plan's Phase 2 retains `checked()` for the out-of-scope
checkbox fields and adds a *sibling* read used only for serialization — but never rewires the
**workflow, depth, and safety consumers** that call `checked()`/`anyChecked()` on booleanMap fields:

| Site | Line | Consequence after conversion |
|---|---|---|
| `anyChecked(names)` | `src/app.js:254-256` | Returns `false` for all 59 converted fields |
| `updateWorkflowState()` | `:261` `anyChecked(immediateSafetyNames)` | `step-safety` never completes from findings |
| `updateWorkflowState()` | `:266` `anyChecked(historyNames)` | `step-history` never completes |
| `updateWorkflowState()` | `:267` `anyChecked(examNames)` | `step-smear` loses its exam contribution |
| `updateCaseUi()` | `:282` `immediateSafetyNames.filter(checked)` | **`safetyCount` is always 0 — the safety banner can falsely report no immediate findings** |
| `updateCaseUi()` | `:290` `anyChecked(historyNames)`/`anyChecked(examNames)` | The 13% depth contribution never applies |

`immediateSafetyNames` are `symptomNames` members, i.e. booleanMap fields — so this is squarely in
scope. Leg C enumerated these exact consumers (`spike-legC-surface.md:50-67`) and the plan then
concentrated the change elsewhere anyway.

**This is the most serious finding: it would ship a silently wrong safety banner.**

**Fix.** Introduce explicit `fieldState` / `isPresent` / `isAssessed` helpers and replace **every**
booleanMap use of `checked()`/`anyChecked()` in workflow, depth, count, and safety logic — not only
the serialization path. Static source pins cannot prove this correct; the pure-module tests must
cover the predicates, and the human-verification checklist must exercise the safety banner and
workflow steps.

---

## F-2 — BLOCKER (ACCEPTED). "Key absence preserves provenance" does not hold for a clinical audit.

The decisions block equates an omitted key with a deliberate "Not assessed" and calls that durable
provenance. It is durable **absence**, which is not the same thing. An older client, a partial
serializer, an API caller, schema evolution, a malformed import, or a field that never rendered all
produce a byte-identical payload, and `toTri()` (`src/facts/tristate.js:6-11`) collapses every one of
them to `'unknown'`. No audit consumer can recover the clinician's intent.

The rebuttal that defeats the original reasoning: **SPIKE-003 rejected a 4th enum only because no
rule or fact needed it at the time. This feature is itself a concrete audit/provenance consumer** —
so that rationale no longer disposes of the question. The prior decision was not wrong; its premise
simply no longer holds unchanged.

**Fix (recommended, not yet adopted — needs human decision).** Persist capture provenance in a
separate versioned envelope, e.g. `capture.booleanMap[field] = "not-assessed" | "unknown" |
"present" | "absent"`, while continuing to feed the unchanged three-value model to the engine.
**A fourth persisted *capture* enum does not require a fourth *rule-engine* enum** — which preserves
SPIKE-003's actual holding while giving the audit trail something unambiguous.

**Alternative, cheaper, also honest:** keep key-absence but **drop the provenance claim entirely** —
state that "not assessed" is a UI-affordance only, not a recorded distinction. This is internally
consistent, just less valuable.

---

## F-3 — HIGH (CONFIRMED). The empirical claim was mischaracterized, and the planned gate cannot detect the change.

Two distinct errors:

1. **Wrong input source.** Leg D described operating on `tests/golden/*.json`. Those are assessment
   **outputs** (`meta`/`classification`/`alerts`/…) and contain no `symptoms`/`history`/`exam`.
   `tests/module-equivalence.test.mjs:28-34` reads inputs from `examples/`.
2. **Near-vacuous coverage.** Verified by direct count: across all six `examples/*.json` there is
   **exactly ONE** explicit `false` in `symptoms`/`history`/`exam`. Five of six exercised **no
   transformation at all**, so "all 6 identical" was not meaningful evidence.

Additionally, the plan's "golden identity" gate runs the **existing unmodified test**, which never
submits an omitted-key payload — so it cannot detect the very change it is meant to guard.

**What survives:** the structural argument — all 28 conditions over these aggregates use
`is-present`, which cannot distinguish `'false'` from `'unknown'`. That is corpus-derived and still
supports the conclusion. The fixture evidence does not.

**Fix.** Add an **executed transform test** over input fixtures: explicit-`false` vs omitted for
every booleanMap field and every all-negative aggregate group, deep-comparing both derived facts and
final results. Also **broaden the FR-9 guard** to reject every *discriminating* operator the engine
supports — `eq`/`neq`, `missing`/`exists`, truthiness, and all four `is-*` — not just the three
`is-*` spellings (`src/ruleEngine.js:27-48`).

`spike-legD-empirical-probe.md` has been corrected in place with a prominent correction banner.

---

## F-4 — HIGH (CONFIRMED, with a correction to its framing).

`populateFromInput()` (`src/app.js:1503-1506`) sets `#safety-reviewed-no-flags`:

```js
const hasImmediateFlag = immediateSafetyNames.some(
  (name) => toTri(input.symptoms?.[name]) === 'true',
);
if ($('#safety-reviewed-no-flags')) $('#safety-reviewed-no-flags').checked = !hasImmediateFlag;
```

Loading an example with no immediate flags auto-asserts "Safety screen reviewed."

**Correction to the reviewer's framing:** this is **pre-existing**, not introduced by this feature —
today an unchecked box sends `false`, `toTri('false') !== 'true'`, and the checkbox is auto-set
identically. The code path is unchanged by our work.

**But the finding stands, and matters:** today the auto-assert is at least *defensible*, because
`false` meant a clinician actively asserted absence. Under the new default, an omitted key means
**never assessed** — so the same code would auto-assert "safety screen reviewed" over fields nobody
ever looked at. **Our change invalidates the premise that made the existing behavior acceptable.**
That makes fixing it in-scope rather than optional.

**Fix.** Never infer the review attestation from missing data. Require an explicit reviewed action,
or at minimum require every `immediateSafetyNames` field to be explicitly **Absent** before
auto-setting it.

---

## F-5 — MEDIUM (ACCEPTED). The 14-point estimate is optimistic.

It excludes the F-1 workflow/depth/safety rewrite, the F-2 provenance design decision, the F-3
executed transform test, and the F-4 attestation fix. The "5-point highest-risk seam" (P2) is
materially incomplete as scoped.

---

## Disposition

The plan is **not executable as written**. F-1 and F-4 are concrete defects in the SPA's
safety-relevant behavior; F-3 undermines the stated verification; F-2 is a design decision that must
go back to a human because it trades audit integrity against scope.

This is precisely the value the cross-family review exists to provide — the findings survived
verification against source, and a same-family reviewer had already passed the bundle.
