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
| R-4 | **All 91** rules are grounded only by an `implementation-proposal` sentinel (was 76/91 before the reviewer gate removed the keyword-derived bindings — see RG-1). Superseded by R-7. | Correct and fail-safe today, but it quantifies how much of the KB is not source-grounded. Closing it needs retrievable, rights-cleared sources plus a human-attested mapping — a content and review problem, not an engineering one. |
| R-5 | The EP3-T5 audit itself is synthetic. No credentialed human has reviewed any passage. | `clinicalApprovers[]` is `[]` on all 91 rules and structurally enforced to stay that way (D-4, EP4-T3). |

## Reviewer-gate findings (2026-07-21, `gpt-5.6-sol`, verdict: CHANGES REQUIRED)

Report: `docs/audits/ep3-ep4-reviewer-gate-2026-07-21.md`. The gate ran **seven passes**. Every one
of the first six returned CHANGES REQUIRED, and each found real defects in the previous round's
remediation. Remediation landed across `8a6ddc7`, `aabc24e`, `7b62a90`, `7cf036c`, `34ebb4e`,
`a1b37d4`, `8075868`, `0d4eb51` and the seventh-pass fixes.

By pass 7 the substantive invariants held — clinical-approval enforcement, cross-source grounding,
the located-record biconditional, candidate resolution, the output contract, and module scoping —
and the remaining findings were containment hardening, wording that still over-claimed, and
tracker bookkeeping.

| ID | Sev | Finding | Disposition |
|---|---|---|---|
| RG-1 | high | `sourcePassageId` bound by raw substring matching produced false grounding — `Q-NORMO-LOW-001` bound to a marrow-replacement passage because the fact name appears in a **negated** condition (the rule fires when the finding is *absent*) | Matcher's authority **removed**, not improved. All 91 rules now bind to proposal sentinels; source-supported binding requires a human-attested `REVIEWED_RULE_PASSAGE_MAP`, currently empty |
| RG-2 | high | 22 records claimed `source-supported` while carrying audit flags, contradicting the schema's own definition | New `quarantined` status; `source-supported` now means located AND unflagged, enforced bidirectionally |
| RG-3 | high | Passage pointer discarded by `ruleEngine`/`engine`; validation only proved "the source has *some* passage" | Pointer propagated into `provenance.ruleAudit`; validator checks the actual pointer. Candidate-level pointers and UI rendering remain open (R-6) |
| RG-4 | high | D-4 was a single-file assertion, defeatable by a second module or a build-time transform | Schema `maxItems: 0`; test covers all `MODULE_IDS` and `dist/` artifacts |
| RG-5 | medium | `clinicalApprovalStatus()` was documented as making `if (approved)` safe — **false**, every label is truthy; the test asserted the truthy string while claiming truthiness was impossible | Claim retracted explicitly at both sites. This was our own over-claim, caught by the gate |
| RG-6 | medium | `isBindableAsSourceSupported` failed **open** on missing `reviewFlags` | Fails closed; mis-named test corrected |
| RG-7 | medium | Vendor stage had no `--check`, embedded the operator's absolute path, retained `localeCompare()` | All three fixed; `runId` replaces the absolute path |
| RG-8 | medium | Trackers claimed completion while success criteria were pending | SC-2 recorded as `deviated` with the reason; commit refs and timestamps recorded |

**RG-5 is the one worth remembering.** It was not an upstream defect or a delegate's error — it was
a safety claim written into this phase's own code and test, asserting a protection that did not
exist. It passed 622 tests and two prior self-reviews. Only the adversarial cross-family gate caught
it, which is the argument for keeping that gate mandatory rather than advisory.

### Later passes (the remediation kept being wrong)

| ID | Sev | Finding | Disposition |
|---|---|---|---|
| RG-9 | high | The attestation gate lived only in the generator scripts, so a hand-edited `rules.json` pointing at a clean source-supported passage passed `validate-kb` with exit 0 — and could bind cross-source | Ledger moved to committed `evidence-packs/passage-attestations.json`, read by the validator; cross-source bindings rejected |
| RG-10 | high | The validator matched ledger ids **without validating entry shape**, so `{ruleId, passageId}` with no attester — or one attested by `GPT-5 review agent` — authorised a binding | Ledger shape validated in the validator path; a malformed ledger authorises nothing. **Reopened by pass 5** (`OpenAI o3` evaded the deny-list) and closed by RG-14 |
| RG-11 | high | Cross-source enforcement **failed open** on `evidence: []` — the case with the least provenance was the one skipped | Fails closed; `candidate.schema.json` now requires `minItems: 1` |
| RG-12 | medium | `runRules()` is exported and evaluated poisoned rules without throwing, so "every evaluation path crosses the D-4 guard" was false | Guard moved to `runRules`, the lowest exported evaluation entry point |
| RG-14 | high | The automated-identifier **deny-list** was defeated by `attestedBy: "OpenAI o3"`, and calling it "requires a human identifier" was itself an over-claim — a deny-list of model names is unbounded and permanently incomplete | Replaced with POSITIVE checks: a recognised clinical credential from a closed list, an `attestationRef` that must resolve to a file existing under `docs/attestations/`, and an ISO date. The deny-list is retained and broadened but relabelled a tripwire. `docs/attestations/README.md` states plainly that the gate **cannot** verify humanity — that rests on the out-of-band artifact and the humans reviewing the commit |
| RG-15 | medium | The D-4 runtime guard rejected non-empty arrays but evaluated `clinicalApprovers: "approved"` — a malformed truthy claim | Strict form: only an explicit empty array is evaluable, matching the static detector exactly |
| RG-16 | high | `attestationRef` containment used a lexical `path.resolve` + `startsWith` prefix test, so `docs/attestations/../../README.md` and `docs/attestations/.` escaped it; a later pass escaped again through a **symlinked intermediate directory**, which `path.resolve` cannot see through and `lstat` (leaf-only) missed | Containment now checked on canonical `realpath`s, with every path component rejected if it is a symlink, and the target required to be a regular file |
| RG-17 | medium | `attestedOn` validated ISO *shape* but not calendar validity, so `2026-99-99` authorised a binding | Round-tripped through `Date`; `2026-02-30` and `2026-13-01` rejected too |
| RG-18 | medium | Code comments and the ledger still said the gate "requires a human attestation" while the README correctly said code cannot establish that | Wording corrected at both sites to "structurally valid attestation record" |
| RG-19 | medium | Phase-4 frontmatter was invalid YAML (an unescaped quote in a note written during an earlier remediation), so the file declared as source of truth could not be parsed by its own validators; both trackers also used an unsupported status and claimed completion timestamps and 100% progress against partial task sets | Both trackers parse, use the supported `partial` status, carry reconciled progress figures, and pass `validate_artifact.py` and `validate-phase-completion.py` |
| RG-13 | low | The `source-supported ⇔ empty reviewFlags` claim was overstated globally — the 6 sentinels carry empty flags without being source-supported | Claim scoped to *located* records in the schema and pinned by a test |

**The pattern across passes is the finding.** Six consecutive rounds of remediation each introduced
or left a fail-open path, and every one shared a shape: a guarantee asserted at the place data is
*produced*, or over the *happy path*, rather than over the data and entry points that actually
exist. Each was caught only by an adversarial reviewer that executed the bypass instead of reading
the code. The last three were pure *string-versus-referent* errors: checking that a path string
starts with a prefix rather than that the file it denotes is contained; checking that a date is
ISO-shaped rather than that it exists; checking a name against a deny-list and calling the result
"human". For a repository whose core discipline is not over-claiming, "we enforce X" written in a
comment above a check that does not enforce X is the highest-frequency defect observed in this
phase — including several written by the orchestrator rather than by a delegate.

## Residual gaps added by the reviewer gate

| ID | Gap |
|---|---|
| R-6 | **Candidate exact pointers are now CLOSED** (all 26 candidates carry a real `sourcePassageId`, validated against the actual pointer — reviewer pass 2, FIX-C). What remains open is UI only: the SPA and algorithm explorer still render source-ID chips with no passage/status awareness. Deliberately out of scope, not half-done. |
| R-7 | **0 of 91 rules have source-supported grounding.** Every rule binds to an implementation-proposal sentinel. Closing this needs a human-attested rule to passage mapping — it cannot be produced mechanically, which is precisely what RG-1 demonstrated. |

## Related

- `[[wave0-ep1-tristate-fact-model-findings]]` — prior phase register.
- Decisions D-EP3-1..D-EP3-6: `docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/ep3-passage-design.md`
