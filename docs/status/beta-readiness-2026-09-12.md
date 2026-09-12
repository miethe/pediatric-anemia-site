# CBC Suite Trusted-Beta Readiness — 2026-09-12

## Verdict

**No — the Pediatric CBC Suite is not ready for a trusted beta today.** It is a deliberately non-selectable, unsigned research-prototype module with no credentialed clinical review or signed content record. Its focused code slice works in isolation, but a clinician cannot use it from the SPA or REST API. The repository gate is also red, and a direct input-boundary probe accepted an impossible negative ANC and emitted a neutropenia pattern.

This is a beta-readiness review, not a public-release or clinical-validation claim. Passing tests would prove software behavior only; they would not establish clinical validity, safety, diagnostic performance, or regulatory status.

## Evidence reviewed

The requested branch is `feat/pediatric-cbc-suite-adaptive-assessment` at `f0f605e`; its committed diff from `main` is AOS-workflow-only. The CBC/adaptive slice is **25 uncommitted modified files plus new CBC facts, proposals, and focused tests** in the primary checkout. Review observations therefore refer to that working slice, not a reviewable branch/PR artifact.

| Probe | Result | What it establishes |
| --- | --- | --- |
| `npm run check` | **red**: 2,798 passed / 9 failed of 2,807 | The full delivery gate did not clear. See `/private/tmp/pediatric-cbc-beta-gate-20260912.log`; failures include tests 341, 794, 819, 2142, 2143, 2148, 2378, 2379, and 2577. |
| CBC-focused Node tests | 15/15 passed | Rule proposals remain non-executable; four-state capture and source/registry parity behave as tested. See `/private/tmp/pediatric-cbc-beta-slice-20260912.log`. |
| `npm run smoke` | passed in-process | Existing anemia server handler works; it is not evidence of a CBC API surface. See `/private/tmp/pediatric-cbc-beta-smoke-20260912.log`. |
| `npm run smoke:browser` | passed, with stated boundary | Built module eligibility rejects all unsigned stubs, including CBC; this is static/Node wiring, not a rendered-browser usability test. See `/private/tmp/pediatric-cbc-beta-browser-20260912.log`. |
| Direct `assess(..., 'cbc_suite_v1', ...)` malformed/boundary probe | negative ANC accepted; string ANC becomes unknown; negative age is rejected | The CBC engine has a material numeric validation gap. |

## User-facing beta inventory

| Surface | State | Evidence and limit |
| --- | --- | --- |
| Module selector | **Partial / CBC unavailable** | The selector truthfully lists CBC as `unsigned-stub`, no clinical review, and not servable; the built smoke proves it cannot be selected. |
| CBC assessment in the SPA | **Absent** | `isModuleSelectable()` blocks activation. The current assessment is anemia-only. No DOM/browser interaction test exists. |
| CBC REST assessment | **Absent** | `POST /api/v1/assess` calls `assessPediatricAnemia`; it has no `moduleId` selection surface. |
| CBC facts/rules in isolation | **Partial** | Four runtime rules and local-profile fail-closed behavior pass the focused tests, but six expansion rules are deliberately pending/non-executable. |
| Adaptive questionnaire/four-state capture | **Partial** | Registry/markup parity and serialization tests pass; the browser smoke explicitly does not render or interact with the DOM. |
| Evidence/provenance | **Partial** | Rule audit supports passage status, but CBC cannot produce a user-facing result and all four CBC runtime rules point to `implementation-proposal` passages. |
| Prototype/scope disclosure | **Works** | Visible header, safety banner, CBC help text, privacy note, and footer label this a research prototype/not clinically validated and prohibit diagnosis, prescribing, transfusion thresholds, and replacement of bedside assessment (`index.html`). |

## Claims, evidence, and reference data

The current copy avoids calling a CBC pattern a confirmed diagnosis and labels the marrow output as a referral trigger, not diagnosis/treatment. That restraint is necessary but does not make the content beta-supported: `module.json` is `unsigned-stub`, its hashes/validation run are null, `approvedBy` is empty, and every executable rule has `clinicalApprovers: []` plus an `implementation-proposal` passage pointer. The selector accurately discloses this; a beta cannot rely on the proposal as clinician-reviewed content.

CBC reference data is in `modules/cbc_suite_v1/reference-ranges.json`, a byte-identical AAP 2026 Hb/MCV/RDW fallback copy that the CBC facts actually resolve through the anemia range provider. WBC, ANC, and platelet status require a compatible local lower limit or a local-lab flag; the module does not supply a portable count threshold. The assessment UI says this, but the end user cannot enter CBC mode. Reference provenance is present in files and audit structures, not yet in a usable CBC result surface.

Malformed count strings fail closed to unknown in the direct probe, and age `-1` is refused by the scope check. However, `anc: -1` is accepted as below a local lower limit and emits `CBC-NEUT-BENIGNDIFF-001`; `anc: 999999` is also accepted. `patient-input.schema.json` documents minimums, but `server.mjs` does not validate requests against it and the engine checks units, not numeric plausibility. This is a beta blocker for any CBC input path.

## Ranked blockers and next actions

1. **P0 — CBC is intentionally not usable.** It is `unsigned-stub`, non-selectable, and the API is anemia-only. Next: complete the governed evidence-to-rule/review/signing path and then implement a separately tested selectable UI/API surface. **XL; requires credentialed human review and release authority.**
2. **P0 — CBC numeric input boundary is unsafe.** Negative and implausibly high counts are accepted in direct engine use; the negative count can generate a pattern. Next: enforce schema/plausibility validation at every UI/API/engine entry and add adversarial regression tests. **M.**
3. **P0 — Full gate is red.** Nine integrity/rights/canonical-byte checks fail; test 819 specifically finds the CBC release-sign preimage differs from its golden fixture. Next: reconcile the actual working-tree content against each pinned baseline/golden artifact; do not re-baseline blindly. **M.**
4. **P1 — No reviewable handoff artifact exists.** The CBC work is uncommitted in a shared dirty checkout, so the branch diff does not carry the feature and no PR can be reviewed. Next: isolate, commit the intended slice after the gate is green, then open a PR to the integration branch. **S.**

## Tracking and execution constraints

I attempted to file one IntentTree capture per blocker in the Pediatric CDS Work workspace using `itt capture add`; the configured client was denied network access (`Operation not permitted`), so no capture IDs were created. The supplied `Target-Node` resolves but is an unrelated `agentic_meta_dev` dispatch-wrapper finding, not this CBC review. Do not mark it complete for this work.

The intended linked worktree could not be created because `.git/refs` is read-only in this environment. This report instead lives in the isolated local clone at `.wt/cbc-beta-readiness-0912/`; no commit grant was available, so it is intentionally uncommitted.

## Assumptions

```json
[
  {
    "claim": "The uncommitted CBC/adaptive files in the primary checkout are the intended feature slice for this review.",
    "confidence": 0.87,
    "blast_radius": "med",
    "evidence_if_wrong": "The assigned branch's committed diff is AOS-only while the working tree contains the named CBC/UI/test changes."
  },
  {
    "claim": "The absence of a client-selectable CBC API surface is incompatible with the requested limited trusted CBC beta.",
    "confidence": 0.98,
    "blast_radius": "high",
    "evidence_if_wrong": "The explicit beta scope names CBC usage; current SPA and API both refuse or bypass CBC."
  }
]
```

