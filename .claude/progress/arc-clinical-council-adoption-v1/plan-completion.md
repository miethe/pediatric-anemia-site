---
type: report
schema_version: 2
doc_type: report
report_category: other
prd: arc-clinical-council-adoption-v1
feature_slug: arc-clinical-council-adoption-v1
plan_ref: docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
created: '2026-07-21'
updated: '2026-07-21'
source: agent
---

# Plan-level Completion Report — ARC Clinical Council Adoption v1

**Terminal state: REPOSITORY-COMPLETE, QUALIFICATION BLOCKED ON OWNER ACTION, RELEASE NOT AUTHORIZED.**

This is the designed fail-closed outcome, not an execution shortfall. Every repository-actionable
task across all eight phases is delivered and independently reviewed. The plan cannot advance past
`repository_ready` + `readiness_audit_complete` to `qualifying_runtime_pilot` and beyond without
owner-held inputs that a repository agent is forbidden to synthesize (plan §2 taxonomy, §6).

Execution slice for this run: **P5 → P6 → P7** (`--from-phase=5`). P0–P4 were already complete and
committed on entry. Sequential waves (no `wave_plan` in frontmatter); one squashed commit per repo
per phase, direct to `main`, pushed — no PR branches (operator directive "squash all to main").

## Per-phase outcome

| Phase | Status | Reviewer verdict | Landing |
|---|---|---|---|
| P0 Truth baseline | completed (pre-entry) | — | PED `e69d307` |
| P1 Portable target | completed (pre-entry) | — | ARC `80bb663` |
| P2 Rights & authority | completed (pre-entry) | — | ARC `80bb663` |
| P3 Local lab/terminology | completed (pre-entry) | P3-V1 caught 3 real FAILs | ARC `80bb663` |
| P4 Executable safety | completed (pre-entry) | P4-V1 reopened; caught 3 CRITICAL/HIGH | PED `7a73cb6` / `62b7f90` |
| **P5 Qualifying pilot** | **BLOCKED (owner action)** | P5-V1 clinical lens caught a CRITICAL the correctness lens missed twice | ARC `b5df293`+`afe3b98`, PED `cfa800f`→`9bf19b0` |
| **P6 Portal + adapter** | **completed** | P6-V1 PASS (1 MEDIUM closed, re-reviewed) | ARC `e42f6a6`, PED `00b7779` |
| **P7 Closeout** | **completed** | P7-V1: technical PASS + release owner-held | PED `0814684` (ARC unchanged) |

Delegation was resolved by running the `delegation-router` resolver against the global model
registry (`routing-record-p5-p7.md`): four legs hard MUST-stay-primary (orchestration / verdict /
council-review / cross-wave-merge); the two offload-eligible legs (implementation, docs) were kept
claude-primary — no `ica-executor` agentType is registered in-session, the capability bar for a
pediatric-CDS safety surface is the primary subscription, and ICA Sonnet is `shared_token_pool`
(not free). Orchestration + every reviewer gate ran on Opus; implementers on Sonnet.

## P5 — why it is blocked (not incomplete)

The qualifying pilot's reviewer execution (`execute_review`) is double-gated; both gates were
reproduced read-only three times:

1. **No SDK credential** — `authoring_status()` → `{available:false, reason:no_credential}`; it
   inspects `os.environ` only, so the machine's authenticated `claude` binary is unreachable by that
   path. Owner: `arc-runtime-owner`.
2. **No evidence-rights receipts** — all 15/15 `required:true` sources need owner approval for
   external-provider upload, and `~/.config/arc/authority-trust.yaml` is absent, so none could be
   *verified* even if presented. Owner: `evidence-rights-owner`.

What DID land for P5: the immutable pilot input freeze (55 locators / 66 digests) and a re-runnable
two-pass data-boundary scan (`all_clean:true`, 0 absolute-path hits) that supersedes the failed
2026-07-19 `prohibited_input_check`. Fix-cycle-4 truthfulness corrections applied post-disk-recovery
(ARC `afe3b98`): the HIGH `subgroup_or_access_failure=not_applicable` mislabel → `not_covered`
referencing open `PAC-P4T2-001`, plus C1–C3. The committed pilot is a **truthfully-labelled
skeleton**; runtime qualification is NOT achieved.

> A disk-full (`ENOSPC`) condition interrupted P5 mid-flight; disk recovered to ~30 GiB free and all
> delivered work was committed and pushed. The only casualties were re-runnable (re-applied on resume).

## P6 — completed and independently re-verified

Orchestrator re-ran the gates after the phase-owner's PASS (new static-analysis diagnostics had
questioned it — all resolved to stale mid-edit snapshots):

- MeatyWiki adapter: **59 pytest passed** (Pyright "unknown import symbol" is an analysis-env quirk;
  `uv run pytest` resolves `arc_cli` correctly).
- Web typecheck: **clean** (`tsc --noEmit`, exit 0); the flagged `ClinicalFieldsState` /
  `clinicalFieldsNonEmpty` exports exist.
- Web unit tests: **283 passed / 23 files**; full ARC suite: **1142 passed, 1 pre-existing red, 6 skipped**.

Hard invariants hold: MeatyWiki adapter ships **DISABLED / metadata-only / no-body** (OQ-5
owner-held); raw YAML stays authoritative and P5 is unaffected; the UI never presents repository
validation as clinical approval (Playwright desktop evidence captured); negative suite (46 tests)
fails closed without echoing protected content. A backend defect was closed en route: `create_run`
/ preview were silently dropping `authority_attachments` / `local_profiles` (pydantic
`extra="ignore"`) — fixed + regression-tested.

## Carried items (out of scope; NOT force-fixed)

| Item | Disposition | Owner |
|---|---|---|
| `test_certification_acceptance_passes_the_gate_when_verified` (ARC `tests/test_local_profiles.py`) | Pre-existing P1–P3 cert-gate red (unresolved lab-profile verification + hash bindings). Safety-adjacent — deliberately NOT force-greened. | ARC certification / local-profile owner (P3-scoped fix) |
| OQ-2 identity/credential/signing/revocation | Open, owner-held | governance |
| OQ-3 first-site lab/terminology profile | Open, owner-held | local laboratory director |
| OQ-4 V3 intended use / dataset / endpoints | Open, owner-held | methods / data partner |
| OQ-5 MeatyWiki vault + ACL/rights | Open — adapter stays disabled/metadata-only | knowledge integration owner |
| OQ-6 approvals / study adjudication authority | Open, owner-held | governance |
| V3 / V4 / V5 protocols | `not_executed_owner_held` — block their release states by construction | methods / human-factors / equity owners |

## Release disposition (kept SEPARATE from technical closeout — plan §4 P7-V1)

- **Technical closeout: PASS** (`task-completion-validator`, Opus) — diffs/trees verified, no
  overclaim, the one red run independently.
- **Release: NOT AUTHORIZED — owner-held** (`release-certification-reviewer`, Opus) — OQ-2…OQ-6 and
  V3/V4/V5 all open; none synthesized. This is the correct designed disposition, not a failure. 0 fix cycles.

ARC remains decision-support review infrastructure: it cannot diagnose, prescribe, establish clinical
validity, impersonate credentialed authorities, or authorize a patient-affecting release.

## Commit hygiene

Both repos received concurrent pushes from sibling agents throughout; every phase rebased onto
`origin/main` before push. The ARC working tree's unrelated uncommitted work (owned by another agent:
`.bob/`, `.claude/agent-memory/`, spike run dirs, `.gitignore`) was never staged and is byte-identical
before/after — explicit-path staging only, no `-A`, no stash, no restore.

## Next actions (owner, not repository agent)

1. `arc-runtime-owner`: provision an SDK credential reachable by `authoring_status()`; register the
   evidence-rights issuer in `~/.config/arc/authority-trust.yaml`.
2. `evidence-rights-owner`: sign an `EvidenceRightsReceipt` binding
   `knowledge-packs/pediatric-anemia/source-manifest.yaml` (sha256
   `f4c33c82fe4977a7d4db2633ab04d82b39bb7bf421d048aba5a5b37a51b711f6`, all 15 source IDs,
   `permitted_operation: external_provider_metadata_upload`).
3. With both present, re-run P5 (`execute_review` → adjudication → `arc validate` → P5-V1); P5-T2/T3/T4
   flip from `blocked`.
4. P3 owner: resolve the carried cert-gate red.

Once (1)–(3) land, this plan advances from `repository_ready` to `qualifying_runtime_pilot`; further
states (`credentialed_review_complete`, `clinical_validation_complete`, `certified_for_defined_scope`,
`released`/`activated`) remain external-authority gated.
