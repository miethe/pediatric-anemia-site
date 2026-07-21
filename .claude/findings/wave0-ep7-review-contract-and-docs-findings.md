---
title: "Findings: Wave 0 EP-7 Review Contract & Docs"
schema_version: 2
doc_type: report
report_category: finding
status: accepted
created: 2026-07-21
updated: 2026-07-21
feature_slug: wave0-safety-foundation
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-7-review-contract-and-docs.md
owner: pediatric-cds-program-owner
tags: [review-record, d-4, deferred-items, doc-truth-up, findings]
---

# Findings — Phase EP-7 (Review Contract & Docs)

Findings surfaced while executing EP7-T1..T7 and during the `karen` end-of-feature review of the
full Wave-0 diff.

**Honesty boundary**: EP-7 is a documentation and paper-data-contract phase. It shipped no clinical
content, no rule/threshold change, and no application. The `karen` pass below was an automated
adversarial review — it is *not* clinical validation, not credentialed clinical sign-off, and
confers no release authority. Nothing here may populate `approvedBy[]` or `clinicalApprovers[]`.

## Disposition summary

| ID | Severity | Confirmed | Disposition |
|---|---|---|---|
| EP7-F001 | high | executed | FILED — DEF-8 deferral trigger has fired; needs next-phase planning decision |
| EP7-F002 | medium | executed | FIXED in EP-7 — schema-example fixture perturbed governance coverage |
| EP7-F003 | medium | executed | FIXED in EP-7 — two stale automated-check counts, one newly introduced |
| EP7-F004 | low | n/a | FILED — referenced changelog spec does not exist |
| EP7-F005 | low | n/a | FILED — phase-plan exit criterion says "4 workflow states"; shipped contract has 5 |

---

## EP7-F001 — DEF-8's deferral rationale no longer holds (high)

`docs/project_plans/design-specs/headless-browser-runtime-smoke-check.md` was deferred on the
premise that EP-1/EP-2 would stay inside the Phase-0 shim boundary — a "literal path-string swap"
with no new browser-executed behavior.

**That premise is now false.** EP-2 (`23e5ef8`) added ~53 lines of genuinely new interactive
DOM-rendering logic to `src/app.js` (`renderUnitAssumptions()`, `showInputRejection()`), and EP-5
(`9a6a73a`) extended it further (`formatRejectionDetail()`, `INPUT_REJECTION_CODES`).

A compensating control exists — `scripts/smoke-browser-unit-rejection.mjs` — but that script's own
printed output disclaims the relevant coverage: it "does not execute DOM-dependent
app.js/algorithmExplorer.js in a browser, render the rejection HTML, or verify visual/accessibility
behavior." The specific named risk in the original spec — the `with { type: 'json' }` import in
`modules/anemia/ranges.js` under a real browser engine — remains **completely unverified**.

**Disposition**: FILED, deliberately not auto-fixed. Re-confirmation recorded in the spec itself
rather than reasserting the original "nothing has changed" framing. Needs a human planning decision
at next-phase planning: promote DEF-8, or accept the residual risk explicitly.

DEF-6 (`public-moduleid-api-surface`) and DEF-7 (`algorithm-explainers-examples-relocation`) were
re-checked against shipped state and **remain correctly deferred** — the module registry still holds
exactly one entry (`anemia`), and no second module exists to force either decision.

## EP7-F002 — Schema-example fixture perturbed rule-governance coverage (medium)

EP7-T1's hand-authored example initially landed at `tests/fixtures/review-record.example.json`.
`scripts/evidence/backfill-rule-governance.mjs` deliberately scans `fixtureDirs: ['tests/witness',
'tests/fixtures']` (FR-WP4-02) as its governance coverage corpus, so the new file was swept into a
governance-tracked list and made `tests/rule-governance.test.mjs` fail — the regenerated
`modules/anemia/rules.json` no longer matched the committed one.

The tempting fix — regenerating `rules.json` — would have mutated clinical knowledge-base content
during a docs-only phase, violating the "no AI-published rule changes" guardrail.

**Disposition**: FIXED correctly. The example was relocated to `schemas/examples/`, next to the
contract it exemplifies; it is a schema example, not an engine/assessment fixture, and never belonged
in the coverage corpus. `modules/anemia/rules.json` is byte-identical to `main`. A comment in
`tests/review-record-schema.test.mjs` records why the path must stay outside those two trees.

**Generalizable lesson**: `tests/fixtures/` and `tests/witness/` are governance-load-bearing in this
repo. Adding any `.json` to either silently changes `rules.json` coverage metadata.

## EP7-F003 — Two stale automated-check counts, one introduced by this phase (medium)

EP7-T5 exists to correct a stale test-count claim, so shipping a fresh wrong one would have been
self-defeating.

- `README.md:96` — pre-existing claim of "10 automated engine tests" (badly stale).
- `CHANGELOG.md:44` — claimed `npm run check` runs **848** automated checks. This number was
  inherited from EP-6-era records and was already wrong when written; it also attributed the count to
  `npm run check` rather than `npm test`.

**Verified ground truth at EP-7 seal**: `npm test` → 967 passing subtests, 0 failing, across 45
`node --test` files (42 in `tests/` + 3 in `tests/witness/`). Both claims corrected to that figure
and independently re-verified by the `karen` reviewer.

## EP7-F004 — `.claude/specs/changelog-spec.md` does not exist (low)

EP7-T6's task row requires the CHANGELOG entry be authored "per `.claude/specs/changelog-spec.md`".
That file does not exist in this worktree, any sibling worktree, or anywhere in git history — the
`.claude/specs/` directory is absent entirely. The entry was authored against the existing
`CHANGELOG.md`'s established style instead.

**Disposition**: FILED. Either write the spec or drop the reference from planning templates; a plan
that cites a non-existent normative spec will keep producing this ambiguity.

## EP7-F005 — Phase-plan exit criterion undercounts workflow states (low)

`phase-7-review-contract-and-docs.md` frontmatter (`exit_criteria`, line 13) and quality gate SC-1
say the schema must round-trip "all **4** workflow states." The shipped `workflowState` enum — and
the EP7-T2 task row in the same file — define **five**: `proposed`, `under-review`, `disputed`,
`approved`, `rejected`. The "4" appears to refer to workflow *transitions*
(change-proposal → dual-review → conflict-resolution → approval), not states.

**Disposition**: FILED, not silently reconciled. The shipped work **exceeds** the stated bar (5 states
covered, with per-state gates tested), so this is a plan-artifact wording inconsistency rather than a
shortfall. Left uncorrected deliberately: editing an exit criterion to match the outcome after the
fact is exactly the kind of retroactive goalpost-move this program's honesty guardrails exist to
prevent. Worth a human correcting in the plan template.
