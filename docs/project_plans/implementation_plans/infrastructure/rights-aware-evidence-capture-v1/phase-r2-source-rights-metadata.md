---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-R2: Source Rights Metadata"
status: draft
created: 2026-07-21
phase: EP-R2
phase_title: "Source Rights Metadata"
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
feature_slug: rights-aware-evidence-capture
entry_criteria: "EP-R0 merged (rights/ tree, amended vendored schemas, gates wired). EP-R1's scripts/validate-kb.mjs ledger-resolution helper available or landing in the same wave."
exit_criteria: "schemas/evidence.schema.json $defs/source carries required license/access_basis/terms and a locator-only terms_snapshot; all 6 sources validate in one commit; AAP2026_IDA and CDC2025_LEAD encoded machine-readably; every source resolves to a rights record; consumers do not throw on legacy records and render unassessed as unassessed; npm run check green."
planning_maturity: ready
---

# Phase EP-R2: Source Rights Metadata (WP2)

**Maps to PRD WP2.** **5 pts.** Wave 2, parallel with EP-R1.

The largest single safety gain on offer: `schemas/evidence.schema.json`'s `$defs/source` today records
**no licence, access basis, or terms at all**. That `AAP2026_IDA` is unusable for reuse exists only as
prose in `.claude/findings/` and as one hardcoded boolean.

**Dependencies**: EP-R0. Shares `scripts/validate-kb.mjs` with EP-R1 (EP-R1 owns it).
**Assigned Subagent(s)**: `general-purpose` (primary), model `sonnet`, effort `high` — atomic schema
migration under `additionalProperties: false`.
**Entry / exit criteria**: as frontmatter.

## Integration Ownership (R-P3)

Two barriers meet in this phase.

1. **`schemas/evidence.schema.json` — EP-R2 owns it first, EP-R3 second, strictly ordered.** EP-R3
   must branch from **EP-R2's merge commit**, not from its branch tip. EP-R2 adds *source*-level
   fields only; item-level axis fields are EP-R3's and must not be anticipated here.
2. **`scripts/validate-kb.mjs` — consumer side.** `integration_owner = EP-R1`. EPR2-T5 adds a call
   site to EP-R1's exported ledger-resolution helper. It does not restructure, rename, or re-signature
   the helper.

`package.json` is untouched by this phase (EP-R0 barrier). New checks go inside `validate-rights.mjs`
or `validate-kb.mjs`, never as a new npm script.

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EPR2-T1 | `$defs/source` gains structured licence / access / terms | Per FR-WP2-01 and FR-WP2-05: extend `schemas/evidence.schema.json` `$defs/source` with structured `license`, `access_basis`, and `terms` fields drawn from spec vocabulary, under the existing `additionalProperties: false` posture. Fields are **required, not optional**, with explicit typed `unknown`/null values where genuinely unassessed. Use `pattern` for any URL-shaped field — never `format: "uri"`, which `scripts/lib/json-schema-lite.mjs` silently ignores (FR-WP0-08). | Omitting any new field fails validation; an explicit `unknown` passes and is counted as unassessed by EP-R0's coverage gate. No `format: "uri"` is introduced. A malformed URL is rejected by `pattern`, or the schema description states in-line that the field is unchecked. | 1.25 pts | general-purpose | sonnet | high | EP-R0 |
| EPR2-T2 | `terms_snapshot` — locator only, never text | Per FR-WP2-02 (D1): add a `terms_snapshot` reference field recording *what terms were observed and when* — by locator and retrieval date. It records **no terms prose**. | The field's schema admits a locator and a date and has no free-text body property capable of holding terms language. A fixture attempting to store a paragraph of terms text fails validation. EP-R3's negative invariant (EPR3-T1) covers this surface once it lands. | 0.5 pts | general-purpose | sonnet | high | EPR2-T1 |
| EPR2-T3 | Atomic backfill of 6 sources; AAP block machine-readable | Per FR-WP2-03: backfill all 6 sources in the same commit as the schema change. Encode `AAP2026_IDA`'s access basis as subscription, its terms as barring altering / abridging / adapting and *incorporating the Materials into other materials*, and `commercial_use: not_granted_by_subscription` (findings §1, Appendix A). This replaces the prose-only record. | All 6 sources validate in one commit; `npm run validate` exits 0. A test asserts the AAP source record encodes a non-commercial, non-incorporable access basis as **structured fields**, not a free-text note. The restriction facts are transcribed from the recorded terms locator, not authored. | 1.0 pt | general-purpose | sonnet | high | EPR2-T2 |
| EPR2-T4 | `CDC2025_LEAD` — government *work* vs government-*funded* | Per FR-WP2-04: encode `CDC2025_LEAD` as a U.S. federal government work under 17 U.S.C. §105, **and** record the distinction the reviewed spec §3.7 conflates — government *works* are uncopyrightable; government-*funded* works by university authors are not (abundant in the PMC corpus this project searches). | The schema's own field descriptions distinguish `government_work` from `government_funded`. A fixture marking a source public domain on *funding* grounds alone fails validation. This task records a statutory basis already recorded in the findings; it makes no new legal determination. | 0.5 pts | general-purpose | sonnet | high | EPR2-T3 |
| EPR2-T5 | Source → rights-record gate (seam consumer) | Per FR-WP2-06: extend `scripts/validate-kb.mjs` so every evidence source resolves to a rights record in `rights/rights-ledger.json`, reusing EP-R1's exported ledger-resolution helper unchanged. | A source with no ledger entry fails `npm run validate`, naming the source ID. All 6 sources resolve. `git diff` shows EP-R1's helper signature and body unmodified — this task adds a call site only. The gate is coverage-shaped: it never reads a clearance value. | 0.75 pts | general-purpose | sonnet | high | EPR1-T2, EPR2-T4 |
| EPR2-T6 | R-P2 / R-P4 — consumer resilience + browser smoke | Per FR-WP2-07: `src/evidence.js`, `src/engine.js`, `src/app.js`, and `scripts/evidence/build-evidence-pack.mjs` must not throw on a legacy-shaped source record encountered mid-migration, and absent rights fields must render as "rights position unassessed", **never** as "unrestricted". This is also the phase's R-P4 runtime obligation — `src/app.js` is the only browser surface any phase of this feature touches. | target_surfaces: `src/evidence.js`, `src/engine.js`, `src/app.js`, `scripts/evidence/build-evidence-pack.mjs`. A dedicated test feeds a legacy record through each of the four consumers without throwing and asserts the unassessed rendering string. `npm run smoke:browser` and `npm run check:imports` pass; the browser path shows no "unrestricted"/"cleared" wording for an unassessed source. | 1.0 pt | general-purpose | sonnet | high | EPR2-T5 |

**Phase total: 5 pts.**

## Phase EP-R2 Quality Gates

- [ ] `$defs/source` carries required `license`, `access_basis`, `terms`; omission fails, explicit `unknown` passes (EPR2-T1)
- [ ] No `format: "uri"` introduced anywhere; `pattern` used or the gap documented in-schema (EPR2-T1)
- [ ] `terms_snapshot` is locator + date only; terms prose is structurally unstorable (EPR2-T2)
- [ ] All 6 sources validate in the same commit as the schema change (EPR2-T3)
- [ ] AAP block is machine-readable: subscription basis, non-incorporable, `commercial_use: not_granted_by_subscription` (EPR2-T3)
- [ ] `government_work` and `government_funded` are distinct; funding alone cannot mark public domain (EPR2-T4)
- [ ] Every source resolves to a rights record; EP-R1's helper unmodified (EPR2-T5, R-P3)
- [ ] All 4 consumers survive a legacy record; unassessed never renders as unrestricted (EPR2-T6, R-P2)
- [ ] `npm run smoke:browser` + `check:imports` pass (EPR2-T6, R-P4)
- [ ] No `CLEARED_*` status, attestation, or approval value written by this phase
- [ ] `package.json` untouched (EP-R0 barrier); `schemas/evidence.schema.json` merged before EP-R3 starts
- [ ] `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../rights-aware-evidence-capture-v1.md)
