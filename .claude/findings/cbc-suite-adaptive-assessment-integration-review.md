---
title: "Pediatric CBC suite and four-state adaptive assessment — integration findings"
status: branch_local_incomplete
created: 2026-08-11
branch: feat/pediatric-cbc-suite-adaptive-assessment
delivery_class: branch_local
clinical_validation: false
clinical_signoff: false
---

# Integration finding

The visible four-state assessment slice is implemented and browser-verified. The requested CBC
suite is **not clinically or executably complete**: six bounded expansion ideas are preserved as
non-executable proposals, while the historical four-rule CBC runtime, canonical authoring decisions,
canonical rule provenance, and integrity-recorded anemia fact model remain byte-identical to `HEAD`.
This boundary is intentional because the fresh Research Foundry run produced zero evidence and every
new decision remains `drafted_pending_human_approval`.

## Delivered branch-local slice

- 73 clinician-state controls use the exact order `Present`, `Absent`, `Unknown`, `Not assessed`:
  59 booleanMap fields, 3 patient booleans, 6 specialized-lab booleans, 4 CBC local flags, and one
  capture-only smear-review state.
- `Present | Absent | Unknown` serialize to the existing three-value engine model. `Not assessed`
  omits the engine-input key. The exported audit separately records all four states under
  `questionnaire-capture/v1`, so deliberate not-assessment remains inspectable without creating a
  fourth rule-engine literal.
- Questionnaire groups adapt only from explicit assessed state and existing deterministic
  `nextQuestions[].section`/`priority`. The UI exposes the reason and states that it is not a
  probability, clinical score, or diagnosis. No new information-value score or clinical ranking was
  invented.
- WBC, ANC, and platelet copy explicitly requires compatible local context, identifies displayed
  units, and disclaims silent unit conversion and cross-analyzer interval reuse.
- Editing a form after assessment clears both the audit and visible stale result. Worked examples are
  normalized through the live form before their audit fingerprint is stored.
- `.mjs` files are served as JavaScript by the local server. Real Chrome had previously refused the
  application module graph under `X-Content-Type-Options: nosniff`; the HTTP smoke test now pins this
  MIME contract.
- Smear review is capture/workflow metadata only. It does not enable, disable, clear, gate, or alter
  the existing morphology checkboxes or engine input. Reviewed-normal clinical integration remains a
  pending proposal.

## CBC expansion posture

`modules/cbc_suite_v1/rule-proposals.cbc-suite-expansion.json` holds six schema-valid proposals:

1. missing age question;
2. compatible local-profile question;
3. neutropenia-context question;
4. platelet-context question;
5. pancytopenia scope-exit alert;
6. smear-review missingness question.

Each proposal resolves to its own decision in one of two proposal documents, and every decision is
`drafted_pending_human_approval`. Proposal IDs are disjoint from runtime rule IDs. The canonical
runtime remains four rules; canonical `authoring-decisions.yaml` and `rule-provenance.json` reference
only those executable rules. The CBC module-local fact wrapper adds only an internal fail-closed
`cbc.urgency.localProfileIncomplete` substrate and explicit `unknown` states for unsupported
leukocytosis/eosinophilia. It does not derive pancytopenia, a reviewed-normal smear fact, or a portable
count threshold, and it emits no new patient-facing rule.

## Delegation and routing receipts

The delegation-router selected and recorded five bounded tasks in
`.claude/logs/routing-decisions.jsonl`:

- ICA/Haiku exploration (`CBC-P2-DISCOVERY-ICA`), stopped after the external harness did not yield a
  usable repository-grounded deliverable;
- Codex/Terra UI implementation (`CBC-P2-UX-IMPLEMENTATION`);
- Codex/Terra CBC substrate/proposal implementation (`CBC-P2-ENGINE-IMPLEMENTATION`);
- Codex/Terra RF catalog/gap research (`CBC-P2-RF-GAP-RESEARCH`);
- Codex/Terra adversarial integration review (`CBC-P2-INTEGRATION-REVIEW`).

The integration reviewer initially returned `NEEDS_REVISION`. Findings and dispositions:

| Finding | Disposition |
| --- | --- |
| Pending RF-CBC-002 decisions were wired to executable rules. | Reverted. All six expansion rules are in an explicitly non-executable proposal pack; canonical runtime/provenance are unchanged. |
| New questions reused decisions authorizing different output types. | Replaced with distinct pending decisions; no canonical authoring decision was broadened. |
| A sidecar provenance document was not part of canonical validation. | Deleted; canonical `rule-provenance.json` remains unchanged. |
| Unchecked local flags serialized false and bypassed missing-local-profile behavior. | Local flags now use four states; untouched values are omitted; schema and fixture-corpus parity are tested. |
| Patient and specialized-lab booleans still defaulted false. | All 13 moved to the shared four-state control and tri-state-compatible schema. |
| Pancytopenia/smear pending facts leaked into runtime output. | Removed. No pancytopenia or smear-required fact/classification is exposed. |
| Reviewed-normal smear was indistinguishable from not assessed. | Added an explicit capture-envelope state, but kept it outside the signed clinical fact model pending approval. |
| The new smear state gated existing morphology engine input. | Fixed after final exact-tree review: morphology serialization is unconditional and independent of the capture-only state. |
| Stale audit clearing left stale result HTML visible; sparse examples mismatched normalized form state. | Result and audit now clear together; examples store the normalized live-form snapshot. |
| Adaptive DOM reordering could disrupt focused controls and overstate information value. | Reordering is suppressed while focus remains inside an adaptive group; visible rationale uses only existing deterministic follow-up sections/priorities and disclaims score/probability semantics. |
| Local-unit limitations were not sufficiently visible. | Patient/CBC copy now names local-range, analyzer, unit, and no-silent-conversion limitations. |

After these dispositions and the final exact-tree rerun, the delegated reviewer returned `APPROVE`
for the bounded branch-local implementation with no blocking feature findings. That verdict does not
approve clinical release or the six pending CBC proposals.

## Research Foundry and Operator receipt

The live RF catalog returned 57 neutropenia items, 10 pancytopenia items, and 4 thrombocytopenia
items, but zero indexed matches for leukocytosis, eosinophilia, or thrombocytosis. The owner-approved,
bounded non-PHI Operator request created:

- Operator run `op_run_20260812_025817_pediatric-cbc-suite-evid`;
- correlation `7a5681da-83fd-433a-8d09-7c2d7e2d3dee`;
- RF scaffold `rf_run_20260811_pediatric_cbc_suite_evidence_gap_research`.

The documented Path-B workflow did not execute under the available headless harness. `rf verify`
exited 2 because no report exists; the RF bundle contains zero source cards and zero claims, remains
`draft`, and has `approved_for_writeback: false`. Resume only through an interactive Dynamic Workflow
harness. No source card, claim, report, clinical threshold, or rule was hand-authored to bypass this
failure. Full detail is in `.claude/findings/cbc-suite-rf-gap-audit.md`.

## ARC receipt

ARC was used only through the maintained pediatric council path. The definition
`pediatric-anemia-clinical-review-council` version `0.1.0` linted valid and retains the required
tri-state missingness, local-range/unit/method, dangerous-miss, abstention, and credentialed-human
approval gates. No council verdict was requested or claimed because the target is not a clean commit.
Additional preflight blockers are external to this branch: the approved `dev` root resolves to the
node path `/home/miethe/dev`, not this Mac checkout; the ARC repository currently has unrelated dirty
state; and `arc validate . --json` reports a pre-existing target-artifact provenance-digest mismatch
for `2026-08-05-agent-dock-shared-transcript-viewer`. ARC output is not clinical sign-off.

## IntentTree receipt

Tree `tree_01KXQ7WC1HQE2GKZSCNDVXA9G7` now records the branch, decisions, validation, RF failure,
ARC preflight, and per-surface delivery posture. Evidence was attached to P3-WP7, the P2 CBC work
area, and P2-WP1 through P2-WP6. CBC nodes remain `in_progress`; none was marked complete because
evidence, human approval, validation-ladder, and signed-release gates remain open.

## Verification

- Focused engine/schema/UI suite: 62/62 passing.
- `npm run build`: passing; anemia clinical-content integrity record verifies.
- `npm run validate`: passing; CBC validator still reports exactly 4 rules and 4 provenance entries.
- `npm run coverage:rules`: 91/91 anemia rules witnessed.
- `npm run verify:d4`, `npm run check:imports`, `npm run smoke:browser`, `npm run smoke`: passing.
- Real system Chrome, desktop and 390×844 mobile: 73 unique controls, exact option order, distinct
  state affordances, keyboard-native select behavior, capture envelope present after assessment,
  workflow rationale visible, stale result cleared on edit, morphology independent of smear-review
  state, no horizontal overflow, no console errors, and no bad MIME responses. Screenshots are kept
  outside the repository at `/tmp/pediatric-cbc-four-state-desktop.png` and
  `/tmp/pediatric-cbc-four-state-mobile.png`.
- `git diff --check`: passing.
- Canonical diff check for anemia facts, CBC runtime rules, CBC canonical decisions, and CBC canonical
  provenance: zero diff.

The final exact-tree `npm test` run reached 2,807 tests: 2,799 passed and eight failed. All eight failure
names match the pre-existing pinned-byte/rights baseline recorded before this branch (anemia baseline
pins, CBC signing-preimage pin, RF-CBC-001 record/source pins, and D1 rights checks); no
feature-induced failure remains. Per the repository gate, no commit, push, PR, release, or deployment
is permitted while `npm run check` is red.
