# Findings Register — Wave 0 EP-3 + EP-4 (Evidence Provenance & Rule Governance)

Phase: EP-3+EP-4 · Branch: `worktree-wave0-ep34-evidence-governance` · Date: 2026-07-20/21

Source of findings: the **EP3-T5 independent passage-fidelity audit** (`gpt-5.6-terra`, cross-family
lens), report at `docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md`, machine-readable at
`evidence-packs/rf-ev-001/fidelity-findings.json`.

> **Honesty boundary.** That audit is a SYNTHETIC ADVERSARIAL REVIEW. It is not clinical validation,
> not credentialed clinical review, and confers no release authority. It is used here only to
> **de-claim** — every finding below can suppress or withhold a claim, never add or strengthen one.

## Register

| ID | Severity | Flag | Affected | Disposition |
|---|---|---|---|---|
| EP3T5-F01 | high | `near-verbatim-span-pending-rights` | 11 passages across FDA/BSH/AAP/CDC | **Withheld** at vendor time; text never enters a committed file |
| EP3T5-F02 | high | `source-not-independently-retrievable` | `AAP2026_IDA#ev_001..007` (all 7) | Flagged, unbindable |
| EP3T5-F03 | high | `adds-claim-not-in-located-passage` | `AAP2026_IDA#ev_002` | Flagged, unbindable |
| EP3T5-F04 | high | `omits-source-numerics` | `WHO2024_HB#ev_001` | Flagged, unbindable |
| EP3T5-F05 | high | `omits-source-numerics` | `WHO2024_HB#ev_004` | Flagged, unbindable |
| EP3T5-F06 | high | `omits-source-numerics` | `BSH2020_G6PD#ev_006` | Flagged, unbindable |
| EP3T5-F07 | high | `adds-claim-not-in-located-passage` | `AAP2026_IDA#ev_007` | Flagged, unbindable |
| EP3T5-F08 | high | `overclaims-source-modality` | `WHO2024_HB#ev_003` | Flagged, unbindable |
| EP3T5-F09 | medium | `adds-claim-not-in-located-passage` | `AAP2026_IDA#ev_004` | Flagged, unbindable |
| EP3T5-F10 | medium | `overclaims-source-modality` | `CDC2025_LEAD#ev_002` | Flagged, unbindable |
| EP3T5-F11 | low | (determinism) | `build-evidence-pack.mjs` | Fixed — `localeCompare()` → codepoint comparator |

Outcome: **22 of 35** source-supported passages flagged and unbindable, **13** clean, **11** withheld.

## Root cause — this is the finding that matters most

Most of these defects **originate in the RF-EV-001 bundle's own `summary` fields**, which the
converter copied faithfully. They are upstream evidence-bundle content defects, not converter bugs.
Two are outright dangerous:

- **EP3T5-F07** — a transfusion statement appears in the passage that is absent from its located
  source passage. An unsourced transfusion claim in a pediatric CDS knowledge base is the single
  worst defect this audit found.
- **EP3T5-F08** — WHO's conditional "might need to be considered" was rendered as "must be
  considered", converting guidance into a directive.

**Programme implication:** an `rf` bundle marked `verified` with `rf verify` exit 0 is **not**
sufficient for direct promotion into clinical KB content. `rf` verification checks claim-to-source
linkage bookkeeping; it did not catch modality strengthening, added claims, or dropped numerics in
the human-readable summaries. Any future Evidence Foundry (EF-WP0/EF-WP1) conversion path must
include an independent cross-family fidelity audit as a **gate**, not as an optional review step.
This is the concrete evidence for the CLAUDE.md warning that treating an unconverted `rf` bundle as
production clinical evidence is the most likely mistake here.

## Corroboration of a pre-existing concern

**EP3T5-F02 independently reproduces the REG-002 / RF-EV-002 finding** that `AAP2026_IDA` is not
retrievable (HTTP 403 / subscription-required), reached from a different direction: the source card
carries only a publisher URL and a self-attestation, not a retrievable artifact.

Consequence, stated plainly: **`AAP2026_IDA` currently contributes zero bindable source-supported
passages, and all 32 rules citing it bind to its `implementation-proposal` sentinel.** AAP is the
second-most-cited source in the KB. This is the honest state of the evidence base, not a regression
introduced by this phase — the phase merely made it visible and machine-checkable.

## Residual gaps (open, not closed by this phase)

| ID | Gap | Why it is still open |
|---|---|---|
| R-1 | Paraphrase-only is enforced *structurally* (the `passageFidelity` field), not *semantically*. `validate-kb.mjs` cannot detect a near-verbatim span on its own; F01 was found by an external audit. | Semantic detection would need the restricted source text in-repo, which is the very thing REG-002 has not cleared. |
| R-2 | REG-002 has **not** cleared verbatim reuse of AAP/AAFP guideline text — it answered CPT/SNOMED/LOINC/WHO vocabulary licensing and named guideline-text reuse as its own biggest gap. | Blocked on an external content-rights determination. Flip `REG_002_CLEARED` (`scripts/validate-kb.mjs:16`) when it clears. |
| R-3 | `validateFidelityFindings` is wired only for `moduleId === 'anemia'`; it becomes a silent no-op the day a second module ships. | Flagged in-code; belongs to the multi-module work, not this phase. |
| R-4 | 76 of 91 rules are grounded only by an `implementation-proposal` sentinel. | Correct and fail-safe today, but it quantifies how much of the KB is not source-grounded. Closing it needs retrievable, rights-cleared sources — a content problem, not an engineering one. |
| R-5 | The EP3-T5 audit itself is synthetic. No credentialed human has reviewed any passage. | `clinicalApprovers[]` is `[]` on all 91 rules and structurally enforced to stay that way (D-4, EP4-T3). |

## Related

- `[[wave0-ep1-tristate-fact-model-findings]]` — prior phase register.
- Decisions D-EP3-1..D-EP3-6: `docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/ep3-passage-design.md`
