---
title: "Findings: Wave-0 EP-1 Tri-State Fact Model"
schema_version: 2
doc_type: report
report_category: findings
status: in_progress
created: 2026-07-20
updated: 2026-07-20
feature_slug: wave0-safety-foundation
phase: EP-1
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-1-tristate-fact-model.md
spike_ref: docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md
owner: pediatric-cds-program-owner
tags: [wave0, tri-state, safety, clinical-review, findings]
---

# Findings — Wave-0 EP-1 (Tri-State Fact Model)

Open items carried **out of** EP-1. The phase is code-complete and `npm run check` green, but it is
**not closed**: SC-6 (safety `council-review`) and SC-8 (independent sign-off) are human gates, and
the four `NEEDS-CLINICAL-REVIEW` items below require **named human clinicians**. Per `CLAUDE.md`,
no agent output can satisfy `clinicalApprovers[]` / `approvedBy[]`.

Filed because the EP1-T9 record's authorship pass found no standalone tickets existed for them.

## NEEDS-CLINICAL-REVIEW (blocking, human)

| ID | Item | Why it is open | Where it came from |
|---|---|---|---|
| NCR-1 | `TEC-001` exclusion-gate tightening + companion question rule | EP-1 migrated `TEC-001` **behavior-preservingly only** (positives → `is-present`; negations stay `not:{is-present}`). Tightening the three `exam.*` negations to strict `is-absent` — so an *unperformed* exam can no longer read as confirmed absence in a diagnosis of exclusion — is a real clinical behavior change with no sign-off. Also needs a companion `question` rule, otherwise the candidate silently vanishes with no explanation. Blocked further by a representation gap: `smear: []` cannot distinguish "reviewed, no blasts" from "not assessed". | SPIKE-003 Go/no-go; `ep1-migration-design.md` §B carve-outs |
| NCR-2 | `IRIDA-001` exclusion-gate tightening + companion question rule | Same shape: strict `history.ongoingBloodLossKnown is-absent` is a behavior change; unknown ongoing loss is not confirmed absence. Needs its companion question rule. | SPIKE-003 Go/no-go; `ep1-migration-design.md` §B carve-outs |
| NCR-3 | `statusIs()` / `hemolysisMarkerCount` latent missingness | A near-identical defect to the one EP-1 fixed, explicitly **out of** EP-1 scope. `src/facts/core.js` maps an *unknown* lab status and a *known non-matching* status to the same value, so missingness is still treated as normal on the categorical-lab surface. This is the one aggregate of nine that did **not** gain tri-state behavior. | SPIKE-003 Risks; `ep1-migration-design.md` §A row 1 |
| NCR-4 | Incomplete congenital-signal prompting | `marrow.congenitalSignalCount` is now a confirmed-present count paired with `congenitalSignalsFullyAssessed`. There is no approved question rule for `count === 0 && !fullyAssessed` — i.e. "no congenital signals found, but not all five were assessed". Whether such a prompt should exist, and its wording/priority/evidence, must not be inferred from the count. | `ep1-migration-design.md` §A row 9 |
| EP1-F6 | Browser submission collapses unassessed checkboxes to false (**severity: high**) | `checked()` returns `Boolean(element && … element.checked)` (`src/app.js:41-44`), so every unchecked checkbox is submitted as `false`, never `'unknown'`. `booleans()` submits that value for every symptom, history, and exam field, while the `cbc.localFlags` call sites do the same for all local cytopenia flags (`src/app.js:83-127`). The form can submit after only age/Hb/MCV are entered. On that primary clinician-facing surface, the tri-state model is inert: an untouched form manufactures three assessed-absent cytopenia facts and `isolatedAnemia = 'true'`, which can match `TEC-001` — the missingness defect EP-1 exists to remove, recreated one layer above the engine. This behavior is pre-existing and unchanged from `main`; fixing it properly needs explicit three-state controls or assessment-completeness markers, i.e. real UI design work outside EP-1 / DEF-8. It nevertheless blocks any claim that EP-1 delivers end-to-end missingness safety. Suggested disposition: a scoped follow-up phase for `buildInput()` unknown preservation plus browser round-trip tests. | Adversarial safety review; `src/app.js:41-44,83-127`; compare `main:src/app.js` |

## Non-clinical follow-ups (non-blocking)

| ID | Item | Notes |
|---|---|---|
| EP1-F1 | `history` open-passthrough asymmetry | `symptoms`/`exam` are closed whitelists; `history` alone is open via the `...history` spread (`facts.anemia.js:329`). No functional bug today — the 4 hidden fields work, just invisibly — and the `validate-kb.mjs` allow-list now mitigates the silent-typo risk, but the asymmetry itself is unclosed. SPIKE-003 deferred it as out of charter scope. |
| EP1-F2 | Dead `isTrue` helper | `src/facts/core.js:3` retains the now-unused `isTrue` helper; no migrated production caller remains. Residue, not a defect. |
| EP1-F3 | Invariant adverse-score arm is vacuous on the live KB | EP1-T6's behavioral arm keys on negative-point candidate rules, and the live KB currently has none. Its two synthetic negative controls prove detector **sensitivity**, not universal exclusion safety. A synthetic *positive*-point candidate using `not:{is-present}` would match unknown without entering the negative-score detector or tripping it; the test therefore does not detect this positive-candidate blind spot. The arm becomes load-bearing the moment a negative-point rule is authored — do not mistake it for current coverage. |
| EP1-F4 | Tri facts and evidence provenance (DEF-3 / P1-WP3) | Unresolved: whether a Tri fact needs its own provenance trace distinguishing "unknown because never sent" from "unknown because a computed comparison could not resolve". A P1-WP3 planning input, not an EP-1 defect. |
| EP1-F5 | KB lint for Tri truthiness hazards | Recommended but not built: a check flagging any `countTrue()`/`Boolean()`/`.filter(Boolean)` over a Tri-typed fact path, and forbidding `truthy`/`falsy` operators on registered Tri paths. `'unknown'` is JS-truthy, so this class of bug is silent. EP-1 audited the call sites by hand; nothing prevents reintroduction. |

## Corrected during EP-1 (recorded, not open)

| # | Finding | Disposition |
|---|---|---|
| EP1-C1 | Migration design told EP1-T5 to leave `TEC-001`/`IRIDA-001` untouched. `ruleEngine`'s `eq` is strict identity, so a surviving `{eq: true}` leaf against a now-Tri fact compares `'true' === true` and is permanently false — both rules would have **stopped firing with zero test failures**. | Fixed. Carve-out split: all 49 rows migrate behavior-preservingly; only the tightening defers (NCR-1/NCR-2). Adjudication recorded in `ep1-migration-design.md`. |
| EP1-C2 | Design aggregate row 2 specified plain `triAny([flagTri, numericTri])`, treating an absent **optional** `cbc.localFlags` override as missing data even when the numeric comparison definitively resolves the lineage. Suppressed `TEC-001` and `IMF-DBA-001`. | Fixed in `188d717` via the hybrid precedence SPIKE-003 §3 actually called for. Row 2 in the design doc is flagged superseded in place. |
| EP1-C3 | `is-unknown` matched `undefined` but not `null`/`''`, so a prompt-on-unknown question rule would silently fail to fire on an explicitly-nulled field. | Fixed in `bf1072e` — all four operators route through `toTri()`. |
| EP1-C4 | `schemas/rule.schema.json` enumerated only legacy operators, so post-migration the KB no longer validated against its own schema — and nothing caught it, because `validate-kb.mjs` never applied that schema. EP1-T5's acceptance criterion was thereby both false and unverifiable. | Fixed in `579c041` — enum extended, schema wired into `validate-kb.mjs`, regression test proves a bogus operator is rejected. |
| EP1-C5 | SPIKE-003's 49-row table carried a "not independently reproduced row-for-row" caveat. | Reproduced against the live `rules.json` during EP1-T3: 49 unique IDs confirmed (5 alerts, 3 notes, 34 candidates, 7 questions), no missing/extra IDs. SPIKE prose's "30 candidates" is an arithmetic slip; row labels are correct. |
