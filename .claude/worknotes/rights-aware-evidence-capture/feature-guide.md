# Feature Guide — Rights-Aware Evidence Capture & Taxonomy

> Companion to `docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md`.
> Reader's orientation to what shipped, how to test it, and — critically — what it deliberately did not do.

## What Was Built

This feature makes the repo's **rights position machine-checkable** and rebuilds the evidence archive
as **addressable provenance rather than retained third-party text**. It ships governance *plumbing and
fails-closed tests*, and never a clearance, attestation, or grounded rule.

- A top-level **`rights/`** tree — `release-context.json` (`commercial: false`, internal-research
  scope), `rights-records.json`, `rights-failures.json`, and `rights-ledger.json` (the sole D4 join
  between clinical KB identifiers and rights records; no inline `extensions.rights` on any clinical
  JSON).
- The five governance spec schemas **vendored with a declared local amendment layer**
  (`schemas/rights/` + `VENDORING.md`), resolving the six RF-handoff §9 conflicts as annotated,
  checksum-tracked divergences — never silent edits.
- **`scripts/validate-rights.mjs`** — coverage/consistency gates (a record at `UNKNOWN` still passes),
  wired into `npm run validate`; `--as-of` for determinism (no `Date.now()`).
- **Derived-fact coverage (EP-R1):** `reference-ranges.json` (which feeds `deriveFacts()` → 91 rules)
  now carries a rights record and a bidirectional `KB_JSON_FILES` coverage gate.
- **Source rights metadata (EP-R2):** `$defs/source` gained structured `access_basis` / `license` /
  `terms` / `terms_snapshot` (a locator, never terms text); a source→rights-record coverage gate.
- **Three-axis evidence-item taxonomy (EP-R3):** `evidence_item_type` × `rights_component_class` ×
  epistemic-status-vs-legal-`overall_status`, as three separate required fields; exhaustive
  structured locators + `not_captured[]`; numerics re-captured as **per-value atoms with locators,
  never a reproduced table**; `derived_synthesis` as a first-class `candidate`-only type; a
  negative invariant (no new near-verbatim span) that lands first and allowlists the 11 pre-existing
  spans as a no-regression baseline.
- **Clean-room workflow (EP-R4):** a deterministic decision-brief generator
  (`scripts/rights/build-decision-brief.mjs`), a contamination guard (the brief summarises source
  guidance, never quotes it), and rights-decision ledger plumbing that **ships empty**.
- **Spec & doc truth (EP-R5):** governance-spec amendments (§15/§3.7/§16.2/§3.2, Appendix B, citation
  hygiene), corrected `CLAUDE.md` `npm run check` composition, `NOTICE.md` + `docs/architecture.md`
  §7, and 5 deferred-item design specs.
- **Integration:** `cbc_suite_v1` (merged concurrently) brought to rights compliance with triage-only
  `UNKNOWN`/`unassessed` values; `validateModule`'s rights gate made resilient to an absent `rights/`
  tree in synthetic test roots.

## Architecture Overview

```
clinical KB (modules/<id>/{evidence,reference-ranges}.json)
    │  each source / KB file joins via ↓  (D4 — no inline rights key)
rights/rights-ledger.json ──► rights/rights-records.json (all overall_status: UNKNOWN)
    │                                    │
scripts/validate-kb.mjs                  schemas/rights/*.schema.json  (vendored + amended)
  (bidirectional coverage,               schemas/rights/VENDORING.md   (declared divergences)
   source→record gate)                   │
scripts/validate-rights.mjs (coverage/consistency gates only — D7) ──► npm run validate
    │
schemas/evidence.schema.json  ($defs/source rights fields; $defs/passage 3 axes + locator + not_captured; derived_syntheses)
    │
scripts/rights/build-decision-brief.mjs  (deterministic; consumes taxonomy + locators)
    └► rights/rights-ledger.json rights_decisions[]  (EMPTY — for a rights owner who does not yet exist)
```

## How to Test

```bash
npm run check          # full gate: 1624/1624 tests, exit 0
node --test tests/rights-*.test.mjs tests/*rights*.test.mjs tests/notice-architecture-no-clearance.test.mjs
node scripts/validate-rights.mjs          # the 4 coverage/consistency gates
node scripts/validate-rights.mjs --as-of 2026-07-21   # determinism (byte-identical across wall-clock)
```

## Test Coverage Summary

23 rights-focused test suites covering: the substrate + release context; schema vendoring &
amendments (undeclared-divergence detection); the bidirectional + source→record coverage gates
(fails-closed on a missing record, passes at `UNKNOWN`); the three-axis separation (every pairwise
combination, no cross-axis inference); structured locators + `not_captured[]`; numeric re-capture;
`derived_synthesis` candidate-only + attribution; the negative invariant (allowlist may only shrink);
the decision-brief generator's determinism + contamination guard; the ledger-stays-empty / no
agent-authored-clearance invariants; consumer resilience (absent rights field renders "unassessed",
never "unrestricted"); and a no-clearance-language check over `NOTICE.md` / `docs/architecture.md`.

## Known Limitations (hard requirement — read this)

This feature made the rights position **measured, not improved.** Concretely:

- It **unblocked zero sources, wrote zero clearances, created zero attestations, and grounded zero of
  91 rules.** Every rights record ships at `overall_status: UNKNOWN`; the decision ledger is empty.
- The two binding bottlenecks are **not engineering tasks and remain unfilled**: a **credentialed
  clinician** (the measured-vs-judged determination per threshold family, OQ-1, routes to counsel;
  every item ships `judgment_basis: unassessed`) and a **named rights owner** (any actual clearance,
  OQ-2). No amount of code closes these.
- **Residual gap R-1 is open, not closed:** prohibited-excerpt (near-verbatim) detection is not
  deterministic. The negative invariant is a *no-regression* gate over an allowlist of 11 pre-existing
  spans (DEF-R5), not a proof that no prohibited text exists.
- `content_reuse_assessment.decision.status` retains a writable `CLEARED_*` enum (a declared,
  zero-instance amendment in `VENDORING.md`); a future phase that seeds those records must extend the
  D6 lock to it.
- Deferred: DEF-R1 (clearance workflow), DEF-R2 (release gate), DEF-R3 (single-source rule
  re-anchoring), DEF-R4 (first-party rights record for `derived_synthesis`), DEF-R5 (re-authoring the
  11 near-verbatim spans) — each has a design-spec stub, none is done here.

**Status remains: unvalidated research prototype.** This work proves software behaviour about rights
*metadata*; it asserts nothing about clinical validity, licensing clearance, or regulatory status.
