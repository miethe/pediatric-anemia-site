---
schema_version: 2
doc_type: report
report_category: investigations
title: "SPIKE leg SQ-1: module eligibility & non-peer presentation"
status: draft
created: 2026-07-22
feature_slug: spa-module-switcher
---

## SQ-1 — Module eligibility & non-peer presentation

### Corrections to seeded context (verified by execution)

1. **`src/evidence/registry.js` does not throw for growth/kidney.** The throw is unreachable: `engine.js:83` sits inside the `ruleAudit` map, and both modules have `rules.length === 0`, so the map never runs. The actual fail-closed point is **`src/units.js:160` → `:190`** — neither module is in `registeredUnitModules`, so `validateUnits` returns `{ok:false, reason:'unregistered-module'}` and `prepareUnitValidatedInput` throws `UnitRejectionError`.
2. **That error renders a false statement.** `UNIT_REJECTED` is in `src/app.js:20` `INPUT_REJECTION_CODES`, and `showInputRejection` (`src/app.js:691-693`) prints heading **"Check the entered units"** plus "Unit mismatch or unrecognized unit in patient input." A clinician selecting Growth would be told their units are wrong when the truth is the module has no logic. This is a live **`docs/architecture.md:391`** violation ("a clear 'no assessment produced'/refusal-to-start state") — the state is produced, but misattributed.
3. **`cbc_suite_v1` runs to completion and returns anemia's classification shape** under CBC branding. Verified: `classification` = `{anemiaStatus, hemoglobin, morphology, mcv, rdw, reticulocyteResponse, …}`, `meta.engine` = `"Pediatric CBC Suite Deterministic CDSS"`.
4. **A binding constraint the findings doc missed:** PRD `multi-bundle-conversion-e1.md:367` (**FR-14**) — "this pass adds no client-selectable `moduleId` surface"; `:527` (**R-8**) — "forbids any new client-selectable surface, **ahead of any UI/API decision to support it**." This is scope-bounded to E1, not a permanent ban, and `src/modules/registry.js:44-50` names the exact trigger ("the day a client-selectable moduleId surface actually ships"). This feature *is* that decision — but it must say so explicitly and flip the `tests/module-registry.test.mjs:24` tripwire deliberately.

### 1. Eligibility options

| | Shape | Risk | Rule violated |
|---|---|---|---|
| **(a) integrity-recorded only** | 1 selectable row (anemia). Others invisible. | Hides that 3 unassessable modules ship in `dist/`; contradicts `docs/architecture.md:38-39`'s "read each row" inventory by showing no rows. Not a rule violation — an honesty *omission*. | none |
| **(b) All listed, non-ready demoted** | 4 rows; 3 disabled, cannot run. | Low. Must not use soft words ("preview", "beta") that imply a maturity ladder toward release — `gates-registry.md:130` makes `unsigned-stub → release-ready` schema-impossible, so "preview" implies a transition that cannot occur. | none, if vocabulary is schema-literal |
| **(c) All selectable, banner-only** | 4 rows, all runnable. | **Unacceptable.** `schemas/module-manifest.schema.json:23`: `integrity-recorded` "is the only status the server/build/browser will serve" (`src/kbVerify.js:43` `READY_STATUS`). Running cbc/growth/kidney in the browser directly contradicts it. Also lands R-4 (`:523`) — scaffold misread as "kidney assessment works" — and re-triggers the false "Check the entered units" screen. | schema `:23`; `kbVerify.js:43`; arch `:391` |
| **(d) Tiered labelled groups** | (b) plus explicit group headers. | Low; strictly better than (b) — non-parity is structural, not a per-row footnote a clinician can skim past. | none |

### 2. The `cbc_suite_v1` problem

Not honest. `assess(input,'cbc_suite_v1',…)` derives facts via `modules/cbc_suite_v1/index.js:25` (`anemiaModule.deriveFacts`) yet labels output `"Pediatric CBC Suite Deterministic CDSS"` (`module.json.engineLabel`). No output field discloses the delegation — `limitations()` is anemia's, `meta` carries only the CBC label. A clinician would reasonably read "CBC Suite" as a broader-than-anemia analysis; it is strictly narrower (4 rules vs 91) and computed by anemia.

**Recommendation: non-selectable.** Independent of the delegation, `status: unsigned-stub` already disqualifies it under `schemas/module-manifest.schema.json:23`. Selectable-with-disclosure would require a disclosure ("this CBC assessment is computed by the anemia module") that no code path currently emits — inventing UI-only prose for a runtime relationship is exactly the `no invented thresholds` failure mode in CLAUDE.md's guardrails. Make it inert; state the delegation as a fact in its row.

### 3. The scaffold problem

Listing a scaffold and refusing to run **satisfies** `architecture.md:391` *only if the refusal is emitted before `assess()` is called*. If the SPA calls `assess()` and catches, the user gets "Check the entered units" — a refusal, but a misattributed one, which is worse than silence. So: **eligibility must be gated on `manifest.status` in the UI layer**, never on catching an engine throw. Growth/kidney should appear, be unselectable, and their row should state their own `engineLabel` — which already reads `"… (not yet implemented)"` — plus the `limitations()` notice text from `modules/growth_suite_v1/index.js`. Both are existing repo strings; no new prose.

### 4. Vocabulary

**Reject "unsigned proposal · not clinically reviewed."** "unsigned proposal" is not in the closed enum (`schemas/module-manifest.schema.json:22`); it invents a fifth token and reads as a stage in a pipeline the schema forbids (`gates-registry.md:130`). Render the enum value **verbatim**, and derive the second clause from `approvedBy` (`maxItems: 0`, schema `:5` — "Structural validity here never implies clinical validity … or that a named human clinician reviewed anything").

Literal strings (each traceable: `{status}` ← `module.json.status`; second sentence ← `approvedBy: []`):

- **`integrity-recorded`** — `Manifest status: integrity-recorded — content hashes verified only. approvedBy is empty: no credentialed clinician has reviewed or approved this module. Unvalidated research prototype; not for clinical use.`
- **`unsigned-stub`** — `Manifest status: unsigned-stub — no content hash recorded; not servable. approvedBy is empty: no credentialed clinician has reviewed or approved this module. No assessment can be produced from this module.`
- **`superseded`** — `Manifest status: superseded — replaced by a later module release; retained for audit only. approvedBy is empty: no credentialed clinician has reviewed or approved this module. No assessment can be produced from this module.`
- **`revoked`** — `Manifest status: revoked — withdrawn; retained for audit only. approvedBy is empty: no credentialed clinician has reviewed or approved this module. No assessment can be produced from this module.`
- **Panel header (all statuses):** `These modules are not peers. Read each row.` (paraphrase-free echo of `docs/architecture.md:38-39`.)

"content hashes verified **only**" is the load-bearing word for anemia: it stays alarming because the sentence that follows is identical to the scaffolds'.

### 5. Recommendation

**Option (d): tiered listing, `status === 'integrity-recorded'` is the sole selectability predicate, evaluated in the UI before any `assess()` call.** Today that yields 1 selectable + 3 inert rows. Ship it: the deliverable is the honest inventory, not the choice.

Why the alternatives fail:

- **(c)** violates `schemas/module-manifest.schema.json:23` / `src/kbVerify.js:43` (only `integrity-recorded` is servable) and realizes R-4 (`multi-bundle-conversion-e1.md:523`).
- **(a)** is defensible but forfeits the feature's only present-day value and leaves `docs/architecture.md:38-39`'s non-parity invisible to the clinician.
- **(b)** is (d) minus the structural grouping; grouping is what stops "disabled" reading as "temporarily unavailable."

Required side-effects: reuse `src/kbVerify.js:43` `READY_STATUS` as the predicate (never a hardcoded string); source rows from `dist/build-info.json` (`build-static.mjs:184-192`, already carries per-module `status`/`approvedBy`/`validationRunId`); update `src/modules/registry.js:38-50` and `tests/module-registry.test.mjs:24` explicitly, citing FR-14/R-8 as scope-bounded to E1; and add a test pinning the five banner strings — `.claude/worknotes/…/exploration-findings.md:104` confirms no such harness exists. Fix or document the `sign-kb.mjs:58-73` anemia-hardcode defect before surfacing per-module integrity status, since the switcher makes it user-visible.
