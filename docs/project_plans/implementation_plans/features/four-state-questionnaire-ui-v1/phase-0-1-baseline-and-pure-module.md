# Phase 0-1: Baseline & Guard, Pure Logic Extraction

[Return to Parent Plan](../four-state-questionnaire-ui-v1.md)

**Column conventions** (apply to every task table below): `Estimate` is story points, **never**
Effort. `Model` values used in this plan: `sonnet-5[1m]` (ica-delegated Claude Sonnet 5) | `sonnet`
(primary Claude) | `haiku` | `gpt-5.6-terra` (codex cross-family review). `Effort` for any Claude-family
model (`sonnet-5[1m]`, `sonnet`, `haiku`) is `adaptive` | `extended`; for `gpt-5.6-terra` it is
`low` | `medium` | `high` | `xhigh`. `Provider` is `ica` for P0/P1 implementer tasks, `claude` for
gate/review rows. Gate and review rows carry `Estimate: —` — they are reviewer checkpoints, not
pointed build work.

**⚠ Build-before-test trap (gate-baseline.md).** Any executor running `npm test` before `npm run
build` in this worktree will see **10** failures, not the recorded 8 — two are `dist/`-dependent
artifacts of `dist/` not existing yet (P6-010(a), P6-008(c) in that baseline's numbering). Always run
`npm run build && npm test`, exactly as `npm run check` does. Do not "fix" the two extra failures —
they are not real; they disappear once `dist/` exists.

**Evidence base**: every file:line anchor below is taken directly from
`.claude/worknotes/four-state-questionnaire-ui/decisions-block.md`,
`docs/project_plans/PRDs/features/four-state-questionnaire-ui-v1.md`, and
`.claude/worknotes/four-state-questionnaire-ui/gate-baseline.md`. Do not re-derive them; re-verify
them against the live tree (P0-01) but do not recompute the 59-field census or the 28-rule-condition
finding from scratch.

---

## Phase 0: Baseline & Guard

**Duration**: ~0.25–0.5 engineer-day
**Dependencies**: None — first phase
**Assigned Subagent(s)**: general-purpose (ica, sonnet-5[1m]); `task-completion-validator` gate (claude, sonnet)
**Exit gate** (decisions block §6): FR-9 neutrality guard test green; baseline recorded.

### Why this phase is first, and why it is not negotiable

The neutrality precondition (PRD §4, decisions block §2) is the single highest-value deliverable
identified across all four SPIKE legs: it converts a future silent clinical-behavior change (a rule
author writing a condition using **any operator that can discriminate `'false'` from `'unknown'`** —
broadened per cross-family review F-3 to `eq`/`neq`, `missing`/`exists`, `truthy`/`falsy`, and all four
`is-*` spellings, not only `is-absent`/`is-unknown`/`is-not-assessed` — against one of the 14
`triAny`/`triAll`/`triNone`-derived aggregate facts in `modules/anemia/facts.anemia.js`) into a loud,
authoring-time test failure instead of a silent one. **The guard must exist before the payload change it
guards against ships** — writing it in P1 or later, after `buildInput()` already omits unanswered
fields, would mean the omission behavior ran unguarded for however long P1 took. This is R3 (High
severity) from the decisions block and PRD §9.

### Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Provider | Dependencies |
|---------|-----------|-------------|---------------------|---------:|-------------|-------|--------|----------|--------------|
| P0-01 | Re-verify the 8-failure gate baseline | Run `npm run build && npm test` at the start of this phase (per the build-before-test trap above) and diff the resulting failure list against the 8 recorded in `.claude/worknotes/four-state-questionnaire-ui/gate-baseline.md` (test IDs 336, 789, 814, 2132, 2133, 2138, 2363, 2364 — six byte-identity/baseline pins, two D1 rights-governance checks). Record the actual observed count and IDs in the phase progress note. If the observed set differs from the recorded 8 (more, fewer, or different IDs), **stop and escalate** — do not silently adopt a new baseline; the drift is main-branch state this feature does not own fixing, but this plan's own exit gate depends on knowing the correct starting point. | `npm run build && npm test` executed in that order; the observed failure list is recorded in the phase progress note; if it matches the recorded 8 exactly, proceed; if not, escalation is recorded and P0-GATE does not pass silently | 0.5 | general-purpose | sonnet-5[1m] | adaptive | ica | None |
| P0-02 | Author the FR-9 neutrality guard test (`tests/tristate-neutrality-guard.test.mjs`), **broadened per cross-family review F-3 to every discriminating operator** | Per PRD FR-9 / decisions block §2 / SPIKE-010 §"Empirical evidence", **as corrected by F-3 in `.claude/findings/four-state-questionnaire-ui-cross-family-review.md`**: write a new test that (a) programmatically derives the set of `triAny`/`triAll`/`triNone`/`allAssessed`-derived aggregate fact names from `modules/anemia/facts.anemia.js` (source-scan for `const <name> = tri(Any\|All\|None)(` and `const <name> = allAssessed(` assignments — the derivation sites cluster at `facts.anemia.js:149-392`, e.g. `multilineageCytopenia`(:149), `isolatedAnemia`(:150), `instability`(:152), `bleedingHistory`(:162), `ironRiskHistory`(:171), `chronicInflammation`(:183), `familyHemoglobinopathy`(:203), `knownChronicHemolyticDisease`(:209), `congenitalSignalsFullyAssessed`(:261), `jaundiceOrDarkUrine`(:379), `neurologicSymptoms`(:381), `renalSymptoms`(:385), `fatigueOrPallor`(:386), `petechiaeOrBruising`(:392) — **derive this list from source, do not hardcode it**, so a future rename or addition is picked up automatically rather than silently missed); (b) walks every rule condition (recursively through `all`/`any`/`not` combinators, `src/ruleEngine.js`'s own condition shape) in **all four** modules' `rules.json` (`modules/anemia/rules.json`, `modules/cbc_suite_v1/rules.json`, `modules/growth_suite_v1/rules.json`, `modules/kidney_suite_v1/rules.json` — scoped to all four per PRD AC-4, not anemia-only, so the guard covers future modules too); (c) asserts **zero** conditions reference one of the derived aggregate-fact paths with **any operator that can discriminate `'false'` from `'unknown'`** — not only `op: "is-absent"`, `"is-unknown"`, `"is-not-assessed"` (`src/ruleEngine.js:45-48`), but also `"is-present"` (the fourth `is-*` spelling), `"eq"`/`"neq"`, `"missing"`/`"exists"`, and `"truthy"`/`"falsy"` (`src/ruleEngine.js:27-48`'s full operator dispatch) — the three-`is-*`-only scope in the original task description was itself a gap F-3 found. **Scope precision, do not over-assert**: `modules/cbc_suite_v1/rules.json:38-41` (`CBC-NEUT-LOCALRANGE-001`) already has a live `is-unknown` condition against `cbc.neutropenia` — this is **not** one of the 14 derived aggregates (it is a raw local-range-derived scalar), so the guard must **not** flag it; a blanket "no discriminating operator anywhere" assertion would be wrong and would fail on day one. Include a comment naming this as the known, intentionally-excluded exception. **If any pre-existing condition already uses `eq`/`missing`/`exists` against one of the 14 aggregates** (the corpus has 164 `eq`, 3 `missing`, 1 `exists` uses overall — verify none target these 14 specifically), that is a genuine, currently-undetected neutrality gap this broadened guard is designed to surface, not a false positive to suppress — escalate it rather than carving out a silent exception. | Test passes today against the live rule corpus; the aggregate-fact-name list is derived from `facts.anemia.js` source text, not hand-copied (proven by a test-of-the-test: temporarily rename one derivation site and confirm the derived set changes); a deliberately seeded condition using **any** of the broadened operator set against one of the derived aggregates in a scratch copy of `rules.json` makes the test fail; `CBC-NEUT-LOCALRANGE-001`'s existing `is-unknown` on `cbc.neutropenia` does **not** trip the test | 2.0 | general-purpose | sonnet-5[1m] | extended | ica | None |
| P0-GATE | `task-completion-validator` gate | Verify the Phase 0 exit gate: the guard test exists, passes, derives its fact list from source (not hardcoded), covers the full broadened operator set (F-3), and does not false-positive on `CBC-NEUT-LOCALRANGE-001`; the gate-baseline re-verification (P0-01) is recorded and matches (or an escalation is recorded if not). **Reject if** the guard test hardcodes the 14-name list, checks only the original three `is-*` spellings instead of the full broadened set, flags the cbc_suite_v1 exception, or if the baseline was not re-run before test authoring. | All exit-gate criteria pass; recorded in phase progress note | — | task-completion-validator | sonnet | adaptive | claude | P0-01, P0-02 |
| P0-REVIEW | Cross-family adversarial diff review | `codex`/`gpt-5.6-terra` reviews the P0 diff read-only for fail-closed gaps — specifically whether the guard test's derivation logic could silently degrade to an empty set (which would make the test vacuously pass), whether the broadened operator set (F-3) is actually complete against `src/ruleEngine.js:27-48`'s full dispatch, or whether the cbc_suite_v1 exclusion is scoped narrowly enough to not also swallow a genuine future violation. | Review recorded; any finding either fixed in-phase or logged for P1 pickup | — | gpt-5.6-terra | codex | medium | codex | P0-02 |

**Phase 0 Quality Gates:**
- [ ] `npm run build && npm test` run in that order; observed failures match the recorded 8-failure baseline (or drift is escalated, not silently absorbed)
- [ ] `tests/tristate-neutrality-guard.test.mjs` exists and passes
- [ ] The 14-aggregate-fact-name list is derived from `modules/anemia/facts.anemia.js` source, never hardcoded
- [ ] The guard scans all four modules' `rules.json`, not anemia-only
- [ ] **The guard checks the full broadened discriminating-operator set (F-3)** — `eq`/`neq`, `missing`/`exists`, `truthy`/`falsy`, and all four `is-*` spellings — not only the three `is-absent`/`is-unknown`/`is-not-assessed` spellings originally scoped
- [ ] `CBC-NEUT-LOCALRANGE-001`'s pre-existing `is-unknown` on `cbc.neutropenia` does not trip the guard
- [ ] **Gate criterion**: `npm run check` shows exactly the 8 recorded baseline failures and no others

---

## Phase 1: Pure Logic Extraction

**Duration**: ~0.25–0.5 engineer-day
**Dependencies**: Phase 0 complete (the guard must exist first; P1 does not itself change behavior,
but ordering per decisions block §6 is strict: P0 before P1)
**Assigned Subagent(s)**: general-purpose (ica, sonnet-5[1m]); `task-completion-validator` gate (claude, sonnet)
**Exit gate** (decisions block §6): new module tested; `src/app.js` **not yet rewired** (that is P2).

### Ordering constraint (binding — do not reorder)

Per the plan's binding ordering constraint: **P1's pure module (including P1-03's `isPresent`/
`isAssessed` predicates) must exist and be tested before P2 rewires `src/app.js` to call it.** P2's five
originally-scoped rewritten call sites (`checked`, `buildInput`, `setSimpleField`, `populateFromInput`,
the safety-exclusion listener), **plus — per cross-family review F-1 — `anyChecked()`,
`updateWorkflowState()`, and `updateCaseUi()`'s booleanMap call sites (P2-07)**, all delegate their
state-mapping decisions to this module (FR-8, FR-16) — writing P2 first would mean inlining the mapping
logic directly into DOM-coupled functions, repeating the mistake `tristate.js` was extracted
specifically to avoid (leg B
§3).

### Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Provider | Dependencies |
|---------|-----------|-------------|---------------------|---------:|-------------|-------|--------|----------|--------------|
| P1-01 | `src/facts/fieldState.js` — pure four-state ↔ three-wire-value mapping (FR-7) | Create `src/facts/fieldState.js` mirroring the existing pattern in `src/facts/tristate.js:1-38` (a small, zero-DOM, zero-import module of pure functions with JSDoc). Export a pair of pure functions with **no** `document`/`form`/`RadioNodeList` reference anywhere in the file: (1) a function mapping a `<select>` control's raw string value to what should be serialized onto the wire — the four control values are `''` (the default, unselected/"not-assessed" option), `'unknown'`, `'true'`, `'false'`; the wire mapping is `'' → undefined` (meaning: **omit the key** from `symptoms`/`history`/`exam` — FR-4), `'unknown' → 'unknown'`, `'true' → 'true'`, `'false' → 'false'`; (2) the inverse function mapping a stored/serialized wire value (which may be `undefined`/absent, a bare boolean, or one of the three tri-state strings — the same input shape `toTri()` already accepts, `src/facts/tristate.js:6-11`) back to the control value that should be selected on repopulation — `undefined`/absent → `''`, `'unknown'`/`false`-collapsing-cases handled distinctly (this is the round-trip fix, FR-5): `'false'`/`false` → `'false'`, `'unknown'` → `'unknown'`, `'true'`/`true` → `'true'`, anything unrecognized → `''` (fail-safe: an unrecognized value must never silently resolve to `'true'`/Present). Naming is illustrative in FR-7 (`stateFromControlValue`/`controlValueFromState`) — implementer may choose exact names, but the four-way mapping and the fail-safe-to-not-assessed default on unrecognized input are binding. **Do not** reference `toTri()` from `tristate.js` internally if it would collapse `'false'`/`'unknown'` — the whole point of this module is to preserve the distinction `toTri()` doesn't need to (it's an engine-facing helper); a fresh, independent mapping is required, not a wrapper around `toTri()`. | File exists at `src/facts/fieldState.js`; zero references to `document`/`form`/`RadioNodeList`/`window` anywhere in the file (grep-verified); the four control-value ↔ wire-value pairs round-trip correctly in both directions; an unrecognized control value or wire value resolves to the not-assessed/omit case, never to Present; the module has no side effects on import | 1.0 | general-purpose | sonnet-5[1m] | adaptive | ica | P0-GATE |
| P1-02 | `tests/field-state.test.mjs` — direct `node --test` coverage | Author a new test file importing `src/facts/fieldState.js` directly (mirroring `tests/tristate-operators.test.mjs`'s pattern of importing `src/facts/tristate.js` directly, no shim, no DOM). Cover: all 4 control-value → wire-value mappings; all round-trip cases for the inverse function including `undefined`, a bare `true`/`false` boolean, and each of the 3 tri-state strings; the fail-safe behavior for an unrecognized input on both functions; and an explicit case proving `'false'` and `'unknown'` map to **two different** control values on repopulation (this is the round-trip defect fix, AC-3 — the test that would have caught the original `setSimpleField:1466` bug). | Test passes; executes the real module functions (no DOM shim, no mock); explicitly asserts `'false'` ≠ `'unknown'` on the control-value side, closing the historical collapse | 1.0 | general-purpose | sonnet-5[1m] | adaptive | ica | P1-01 |
| P1-03 | `isPresent`/`isAssessed` predicates in `fieldState.js` (F-1, FR-16) | Per cross-family review F-1 (`.claude/findings/four-state-questionnaire-ui-cross-family-review.md`): add two pure, zero-DOM predicate exports to `src/facts/fieldState.js` alongside P1-01's mapping functions — `isPresent(wireValue)` (true iff the stored/serialized value resolves to `'true'`) and `isAssessed(wireValue)` (true iff the value is anything other than absent/`undefined` — i.e., the field was actively touched, whether Present, Absent, or explicitly Unknown). These give P2's rewired `src/app.js` consumers (`anyChecked`/`updateWorkflowState`/`updateCaseUi`) a booleanMap-aware replacement for `checked()`'s plain-boolean read, which returns `false` for every `<select>`-backed field once converted. Naming is illustrative; the two-predicate coverage (present vs. assessed-at-all) and zero-DOM constraint are binding. Extend `tests/field-state.test.mjs` (or add a sibling file) with direct `node --test` coverage of both predicates over all four wire-value shapes (`undefined`, bare `true`/`false`, each of the 3 tri-state strings). | Both predicates exist in `src/facts/fieldState.js`, zero-DOM (grep-verified, same as P1-01); direct `node --test` coverage exists and passes for both predicates across all input shapes; `isPresent`/`isAssessed` are independently testable pure functions, not inlined into any `src/app.js` call site (that delegation is P2-07's job) | 1.0 | general-purpose | sonnet-5[1m] | adaptive | ica | P1-01 |
| P1-GATE | `task-completion-validator` gate | Verify the Phase 1 exit gate: `src/facts/fieldState.js` exists, is zero-DOM, and is directly tested by `tests/field-state.test.mjs` (including the P1-03 predicates); `src/app.js` has **not** been touched in this phase (P2's job, not P1's). **Reject if** any DOM reference exists in the new module, if the test uses a shim instead of a direct import, if `isPresent`/`isAssessed` are missing or untested, or if `src/app.js` shows any diff. | All exit-gate criteria pass; recorded in phase progress note | — | task-completion-validator | sonnet | adaptive | claude | P1-01, P1-02, P1-03 |
| P1-REVIEW | Cross-family adversarial diff review | `codex`/`gpt-5.6-terra` reviews the P1 diff read-only, specifically checking the fail-safe-to-not-assessed behavior on unrecognized input in both directions (a gap here would let a malformed payload silently read as Present), confirming zero DOM coupling, and confirming `isPresent`/`isAssessed` (P1-03) correctly distinguish all four wire-value cases. | Review recorded; any finding either fixed in-phase or logged for P2 pickup | — | gpt-5.6-terra | codex | low | codex | P1-01, P1-03 |

**Phase 1 Quality Gates:**
- [ ] `src/facts/fieldState.js` exists, zero-DOM (grep-verified: no `document`/`form`/`RadioNodeList`/`window`)
- [ ] `tests/field-state.test.mjs` imports the module directly and passes
- [ ] Round-trip test explicitly proves `'false'` and `'unknown'` resolve to distinct control values (AC-3 precondition)
- [ ] Unrecognized input on either function fails safe to not-assessed/omit, never to Present
- [ ] **`isPresent`/`isAssessed` predicates exist (P1-03, F-1) and are directly tested across all four wire-value shapes**
- [ ] `src/app.js` unmodified in this phase (P2's scope, not P1's)
- [ ] **Gate criterion**: `npm run check` shows exactly the 8 recorded baseline failures and no others

[Return to Parent Plan](../four-state-questionnaire-ui-v1.md)
