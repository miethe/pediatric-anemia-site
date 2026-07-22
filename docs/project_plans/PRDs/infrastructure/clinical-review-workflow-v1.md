---
schema_version: 2
doc_type: prd
title: "Clinical Review Workflow v1 (DF-E1-01) \u2014 PRD"
status: draft
created: '2026-07-22'
updated: '2026-07-22'
feature_slug: clinical-review-workflow
feature_version: v1
prd_ref: null
plan_ref: null
related_documents:
- docs/adr/0004-clinical-approval-identity-adjudication.md
- docs/adr/0005-kb-serialization-signing-key-custody.md
- docs/project_plans/design-specs/clinical-review-portal-workflow.md
- docs/project_plans/design-specs/review-portal-design.md
- tools/review-record/README.md
- docs/governance/gates-registry.md
- schemas/review-record.schema.json
- schemas/reviewer-roster.schema.json
- .claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md
- .claude/worknotes/clinical-review-workflow/decisions-block.md
references:
  user_docs: []
  context: []
  specs:
  - schemas/review-record.schema.json
  - schemas/reviewer-roster.schema.json
  related_prds:
  - docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
  - docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
spike_ref: null
adr_refs:
- docs/adr/0004-clinical-approval-identity-adjudication.md
- docs/adr/0005-kb-serialization-signing-key-custody.md
charter_ref: null
changelog_ref: null
test_plan_ref: null
owner: nick
contributors:
- Opus orchestrator
- prd-writer
priority: high
risk_level: high
category: infrastructure
tags:
- prd
- clinical-review
- evidence-foundry
- df-e1-01
- workflow
milestone: null
commit_refs: []
pr_refs:
- https://github.com/miethe/pediatric-anemia-site/pull/23
files_affected:
- tools/review-record/cli.mjs
- tools/review-record/lib/**
- tools/review-record/README.md
- docs/governance/reviewer-runbook.md
- docs/architecture.md
- docs/project_plans/design-specs/clinical-review-portal-workflow.md
- docs/project_plans/design-specs/assets/**
- tests/**
- package.json
---

# Feature Brief & Metadata

**Feature Name:** Clinical Review Workflow v1 (DF-E1-01)

**Filepath Name:** `clinical-review-workflow-v1` (kebab-case)

**Date:** 2026-07-22

**Author:** prd-writer (dispatched from Opus orchestrator decisions block)

**Related Epic(s)/PRD ID(s):** DF-E1-01 (design-spec `clinical-review-portal-workflow.md`), successor
of `evidence-foundry-e1-v1` Phase 2 (which shipped the file substrate this feature layers on top of).

**Related Documents:** see frontmatter `related_documents`. **Load-bearing reads:**
`docs/adr/0004-clinical-approval-identity-adjudication.md` (v1 mechanism decision),
`tools/review-record/README.md` (already-shipped substrate),
`.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md` (five observations this PRD's Phases
1–3 answer point-for-point), and `.claude/worknotes/clinical-review-workflow/decisions-block.md`
(the orchestrator's phase/risk/OQ scaffolding this PRD elaborates).

---

## 1. Executive Summary

This feature is the **reviewer WORKFLOW layer** for the pediatric CDS clinical review process,
sitting on top of the append-only, git-signed review-record file substrate already shipped in
`tools/review-record/` by `evidence-foundry-e1-v1` Phase 2 (five CLI verbs, two schemas, roster,
Ed25519 lib, dry-run fixtures under `modules/cbc_suite_v1/reviews/`). ADR-0004 (`status: proposed`,
G0-gated) chose that file substrate as the v1 review mechanism and **explicitly declined a review
portal**; this PRD does not re-litigate that choice. It adds the ergonomic and derived-state surface
that the P2-T8 dry-run's five friction observations name (`scaffold` cannot produce a real-identity
file today; the five roles must share one `subjectContentHash` computed and pasted by hand;
`validate` recomputes module-wide on every call; the terminal structurally-non-qualifying state reads
as a bug; nothing surfaces whose-turn-is-next), plus the OQ-8 portal-promotion decision framework
that the design spec's own "Open Questions" section leaves as an explicit human call. It ships **no
portal**, **no real signing**, **no roster changes**, and **no gate clearances**.

**Status: unvalidated research prototype.** Every automated check this feature adds proves
*software behavior* only — schema shape, verb output stability, cache correctness, structural
independence, fail-closed refusal — never clinical validity, safety, diagnostic performance, or
regulatory status. The reviewer roster stays `synthetic`-only pre-G1; no clinical sign-off exists
today or after this feature ships; `clinicalApprovers[]`/`approvedBy[]` remain schema-forced empty
(`maxItems: 0`) and are not touched here.

**Priority:** HIGH (blocks any usable v1 review workflow for the first operational module, `cbc_suite_v1`).

**Key Outcomes:**
- Reviewer turn-state and derived review-state are readable from the CLI (`status` verb, human + `--json`)
  and from the existing read-only static HTML render — no server, no auth, no `<script>`.
- Scaffold ergonomics collapse the five-role coordination cost: `subjectContentHash` is auto-derived,
  and `scaffold` writes a record file for the real-identity kind (still `signature: null`, per the
  schema's own `allOf`, until G1/G2 clear).
- A gate-aware `sign` verb makes the synthetic (TESTKEY) path usable directly (not only inside
  `dry-run`) while refusing `synthetic: false` records fail-closed until G1/G2 clear. `sign`
  operates on a **staged draft file kept outside `reviews/`** (FR-25) — it never opens or rewrites
  an already-committed record; the record's first and only disk write happens through the
  existing single append-only write path (`lib/store.mjs`'s `writeNewReviewRecordFile`).
- Non-engineer clinician reviewers have a written runbook covering the five-role sequence, corrections
  via `supersedes`, and what the structurally-non-qualifying terminal state means.
- OQ-8 (portal-promotion decision) has a written framework: named decision owner, measurable
  friction metrics captured in a committed markdown observation log (zero network, zero telemetry),
  a threshold, and a decision-record template — plus concept-only mockups as design-spec assets so
  the future call is informed, not blind.

---

## 2. Context & Background

### Current State (what already exists)

**Do not rebuild.** The file substrate this PRD's requirements layer on top of is shipped:

- `tools/review-record/` — CLI dispatch (`cli.mjs`) and verbs `list`, `scaffold`, `validate`,
  `render`, `dry-run`, plus 11 `lib/*` modules (`store`, `chain`, `history`, `roster`,
  `independence`, `adjudication`, `signature`, `render`, `subject`, `wave0-migration`, `errors`).
- `schemas/review-record.schema.json` — canonical record shape (append-only, five roles, forced
  `signature: null` on `synthetic: false`).
- `schemas/reviewer-roster.schema.json` — roster shape (real entries require `verificationRef`;
  `synthetic: true` entries structurally cannot carry `verificationRef`).
- `governance/reviewer-roster.yaml` — 5 `synthetic: true` personas scoped to `cbc_suite_v1`, zero
  real entries.
- `modules/cbc_suite_v1/reviews/rr-0001-clinical-1.yaml` .. `rr-0005-release-auth.yaml` — the
  P2-T8 five-role synthetic dry-run, pinned by golden fixture at
  `tests/fixtures/ef-review-dryrun/golden/`.
- `docs/adr/0004-clinical-approval-identity-adjudication.md` — the v1-mechanism ADR, status
  `proposed`.
- `docs/governance/gates-registry.md` — G0–G4 external human gates, none cleared.

### Problem Space

The P2-T8 dry-run friction note (`.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md`)
records five mechanics-level frictions from one automated end-to-end pass. Any real reviewer will
hit them on their first attempt:

1. `scaffold` cannot produce a file for the only identity kind that currently exists — a "successful"
   `scaffold` invocation prints a preview instead of writing.
2. The five role-files must share one `subjectContentHash`, hand-computed once and pasted into five
   invocations; a transposed character does not fail loudly.
3. `validate` recomputes module-wide (chain, independence, authorship-union, release-authorization)
   on every invocation.
4. `validate`'s final `release-auth` violation on a `synthetic: true` set is the correct terminal
   state (FR-6) — but a by-hand user has no framing to distinguish that from a mistake.
5. Nothing surfaces cross-record turn-state (who has committed, whose role is next) other than by
   re-running `list` or `ls`-ing the reviews directory.

Independently, the design spec's Open Questions leave OQ-8 unanswered: "the actual friction
threshold (review count, reviewer complaint volume, calendar time) that triggers building
[a portal], and who is authorized to make that call." The dry-run note explicitly disclaims
answering it.

### Current Alternatives / Workarounds

- Users can chain `scaffold` (draft) → manually add signature → hand-commit → `validate`. This works
  and is exactly what P2-T8 demonstrated end to end, but is not a workflow non-engineer clinicians
  can be asked to run.
- The `dry-run` verb composes all steps but only for `synthetic: true` and only once per module
  (append-only; refuses on any existing record).
- No cross-record turn-state signal exists; coordination is out-of-band.

### Architectural Context

The substrate is deterministic, zero-network, zero-runtime-dependency, offline. This PRD preserves
every one of those constraints. Data flow this feature interacts with (unchanged shape):

```
governance/reviewer-roster.yaml        →  lib/roster.mjs (resolves reviewerId)
modules/<id>/reviews/rr-*-*.yaml       →  lib/store.mjs, lib/chain.mjs (append-only chain)
lib/subject.mjs (computeModuleContentHash) →  subjectContentHash (used by scaffold/status)
lib/signature.mjs (Ed25519 TESTKEY-only)   →  signs synthetic:true records
scripts/validate-kb.mjs                →  build-time schema + cross-file gate (unchanged)
```

Wave-0 safety substrate (`docs/architecture.md` §6/§7/§10):
`clinicalApprovers[]`/`approvedBy[]` are `maxItems: 0` and stay that way; `verify-d4-built.mjs` is
untouched by this feature.

---

## 3. Problem Statement

**User story:** "As a **prospective clinical reviewer** (post-G1 or a program owner exercising the
workflow pre-G1 with synthetic personas), when I try to complete a five-role review pass over a
module, I hit five documented frictions in the file+CLI substrate and I have no written guidance,
no cross-record turn-state, and no framework for anyone to decide whether/when to promote the
workflow to a portal — instead of a workable v1 reviewer surface that lets me complete a pass and
that carries a defensible, human-owned promotion criterion."

**Technical root cause (already characterized):**
- `scaffold` intentionally owns no signing capability; every roster identity today is
  `synthetic: true`, and the schema requires a `TESTKEY-` signature on `synthetic: true` records.
- `subjectContentHash` is a scaffold flag, not a scaffold derivation.
- `validate` is (correctly) module-wide; the cost of re-running module-wide checks is unshared
  across incremental invocations.
- No `status`/turn-state verb exists.
- No portal-promotion decision framework exists.
- **Corrected by adversarial review, 2026-07-22**: `evaluateReleaseAuthorization`
  (`lib/adjudication.mjs`) requires all five roles — including `adjudication` — present
  unconditionally; it does not yet implement ADR-0004 decision item 5's "adjudication only when
  reviewer-1 and reviewer-2 disagree" rule (FR-26 below reconciles this).
- **Corrected by adversarial review, 2026-07-22**: `writeNewReviewRecordFile` (`lib/store.mjs`) is
  append-only and refuses to write to an existing path — there is no in-place "sign an existing
  record" composition available on the current substrate (FR-25 below defines the staged-draft
  contract that makes `sign` possible without violating append-only).

**Files involved (v1 scope):** `tools/review-record/lib/verbs/*`, `tools/review-record/lib/*` (new
shared derived-state module), `tools/review-record/lib/render.mjs`, `tools/review-record/README.md`,
`docs/governance/reviewer-runbook.md` (new), `docs/architecture.md` §11 (new/updated),
`docs/project_plans/design-specs/clinical-review-portal-workflow.md`,
`docs/project_plans/design-specs/assets/` (new).

---

## 4. Goals & Success Metrics

### Primary Goals

**Goal 1: Turn-state legibility — redacted by default, fail-closed, never authorization-shaped.**
A reviewer or coordinator can read, from one CLI call and from the existing static HTML render,
which role acts have been committed for a module, which role is next-expected, and whether the
derived state is `not-started`, `in-progress`, `disputed`, `structurally-non-qualifying`,
`acts-complete-unauthorized` (FR-29; renamed from an earlier `release-ready-candidate` draft —
this label is explicitly **not** an authorization signal), or `invalid` (FR-28, whenever `validate`
would reject the same input). Sibling reviewer identity/decision/rationale are redacted by default
in every projection while independence still matters (FR-27); an explicit `--unredacted` flag
exists for an adjudicator/release-authorizer, with a printed warning banner. Measured by presence
of the `status` verb with a stable JSON schema, a queue/turn-state section in `render`'s output,
and negative tests proving no independence leak and no premature authorization-like label are
possible.

**Goal 2: Scaffold ergonomics without weakening independence.** `subjectContentHash` derives
automatically from the module's committed content (`lib/subject.mjs`); `scaffold` writes a record
file for the real-identity kind (still `signature: null`, per the schema's own `allOf`), so the CLI
verb name matches the observable outcome. Measured by (a) a `--subject` flag that becomes optional
with a default derivation, (b) a scaffold write path that fires for `synthetic: false` roster
entries (which cannot legitimately exist pre-G1 — the write path is correct-in-shape but inert),
and (c) FR-4 structural independence (`nextChainLink` single-file touch) unchanged.

**Goal 3: Gate-aware `sign` verb operating on a staged draft, never on a committed record.** A
general-purpose `sign` verb exists on the CLI, consuming ONLY a staged draft file `scaffold --draft`
produced outside `reviews/` (FR-25), exercised on the TESTKEY dry-run path and fail-closed against
any `synthetic: false` draft. Measured by verb presence, `--help` text naming it, a negative test
that confirms a `synthetic: false` draft refuses with a G1/G2 gate message, and a positive test that
no existing `modules/<id>/reviews/*.yaml` path is ever opened for writing by `sign`.

**Goal 4: Incremental `validate` with a fail-closed, composite-keyed, persistent cache.**
`validate --record` (and `--module`) paths reuse a cache keyed on the FULL composite of record
content hash, complete predecessor-set hashes, roster file hash, review-record schema hash,
validator-policy version, and history-mode flag (FR-8/FR-9) — not record-plus-immediate-predecessor
hash alone — so repeated invocations, including across separate CLI processes, do not recompute
unchanged inputs; any single-component miss or uncertainty falls back to full recomputation (no
fail-open). The cache lives outside the repository tree (OS temp/XDG cache dir). Measured by a
wall-time comparison on the committed `cbc_suite_v1` set across two separate process invocations,
and by five independent fresh-process invalidation tests (roster, schema, record, predecessor,
history-mode).

**Goal 5: Reviewer runbook for non-engineer clinicians.** A written, guided git-workflow document
covering all five roles end-to-end against the dry-run fixture, including corrections via
`supersedes` and explicit framing of the structurally-non-qualifying terminal state.

**Goal 6: OQ-8 portal-promotion framework.** A committed framework naming (a) friction metrics
captured as a committed markdown observation log (zero network/telemetry constraint upheld),
(b) an explicit promotion threshold, (c) an authorized human decision-owner role, and (d) a
decision-record template. Portal concept-only mockup images committed as design-spec assets to
inform, not commit, the future call.

### Success Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|--------------------|
| Verbs exposed on `tools/review-record/cli.mjs` | 5 (`list`, `scaffold`, `validate`, `render`, `dry-run`) | 7 (`+ status`, `+ sign`) | `--help` output, verb-registry test |
| Friction observations answered by shipped mechanics | 0 of 5 | 5 of 5 (#1 scaffold writes, #2 auto-derived subject, #3 incremental validate, #4 explicit terminal-state messaging + runbook framing, #5 turn-state in `status` + render) | Explicit AC-per-observation traceability in §11 |
| `validate` wall-time on `modules/cbc_suite_v1` five-record set, cache-warm, cross-process | Full recompute every call | Measurably less than the cache-cold baseline across two separate `node` invocations sharing the persistent cache dir (recorded via a repeatable microbenchmark script; strict fraction not fixed by this PRD, target chosen in the plan) | Microbenchmark test committed under `tests/` |
| Stale-cache fail-open incidents (composite key: record, predecessor-set, roster, schema, validator-policy version, history-mode) | 0 | 0 (mandatory) | 5 dedicated fresh-process adversarial tests, one per key component (FR-9) |
| Derived-state labels that read as release authorization pre-G0/G1/G2/G4 | 0 (must stay 0) | 0 (invariant) | `acts-complete-unauthorized` naming grep test (FR-29) + real-roster-fixture negative test |
| Portal-promotion framework artifacts | 0 | 4 (metric-log format, threshold, owner-role, decision-record template) | File presence + framework-checklist test |
| Real `synthetic: false` roster entries added | 0 | 0 (invariant) | `verify-d4-built.mjs` untouched; roster-diff test |
| `clinicalApprovers[]`/`approvedBy[]` non-empty occurrences | 0 | 0 (invariant) | Existing gates + `tests/ef-contract-forced-empty.test.mjs` remain green |

---

## 5. User Personas & Journeys

### Personas

**Primary: Program owner exercising the workflow with synthetic personas (today).** Runs
`scaffold --draft` → `sign --draft <path>` (TESTKEY) → `validate` → `status` → `render` against
`cbc_suite_v1` — `sign` consumes only the staged draft `scaffold --draft` produced outside
`reviews/`, never an already-committed record (FR-25). Reads the runbook to confirm it matches the
mechanics. Uses the friction observation log format to capture any new pain points that arise
beyond the five already recorded.

**Primary (future, gated): Non-engineer clinical reviewer post-G1.** Has a real roster entry
(`synthetic: false`, `verificationRef` populated by the owner as a G1 human act — **not** by this
feature). Follows the runbook. Files no signature on their record (the schema forces
`signature: null` on `synthetic: false` pre-G2) — the review-content commit is their attributable
act; the signing custodian at G2 produces the release-manifest signature separately per ADR-0005.

**Secondary: Coordinator / reviewing agent-on-owner's-behalf.** Reads `status --json` to see whose
role is next; opens the static HTML render to see the queue/turn-state section without running the
CLI.

**Secondary: Portal-decision owner (future).** Reads the friction observation log and the OQ-8
decision-record template; writes the record when/if the threshold clears; owns the promotion call.
Named by role in the framework (this PRD does not name a person).

### High-level Flow — the five review acts and derived states

The diagram encodes ADR-0004 decision items 1–6 plus the derived state machine `status` and `render`
compute over the append-only file chain. `clinicalApprovers[]`/`approvedBy[]` do not appear because
they are not populated by any state on this diagram (schema-forced-empty; see §7 Out of Scope).
**Corrected by adversarial review, 2026-07-22** (findings F1/F2/F4): `sign` never touches an
existing `reviews/` path (it consumes a staged draft — FR-25); the "adjudication skipped on
agreement" transition below requires a named `lib/adjudication.mjs` policy change (FR-26,
P1-T5) that does not exist in the substrate today; and the terminal all-real state is renamed
`acts-complete-unauthorized` (FR-29) and no longer claims a signature-verification gate the actual
evaluator never checks. (The mermaid state id below renders it as `acts_complete_unauthorized`
only because mermaid ids cannot contain hyphens — the canonical CLI/`--json`/render label is the
hyphenated `acts-complete-unauthorized`; there is exactly one state.)

```mermaid
stateDiagram-v2
    [*] --> not_started : no reviews/*.yaml present
    not_started --> in_progress_clinical_1 : scaffold --draft; sign --draft <path> (FR-25 — first & only write)
    in_progress_clinical_1 --> in_progress_clinical_2 : scaffold --draft; sign --draft <path> (independent, nextChainLink single-file touch; FR-27 redacts clinical-1 from this view)
    in_progress_clinical_2 --> in_progress_lab : scaffold --draft; sign --draft <path>
    in_progress_lab --> disputed : clinical-1.decision != clinical-2.decision
    in_progress_lab --> awaiting_release : clinical-1.decision == clinical-2.decision (adjudication role NOT required — FR-26, governance-sensitive lib/adjudication.mjs change, P1-T5)
    disputed --> in_progress_adjudication : scaffold --draft; sign --draft <path> (adjudicator not in authorship-union, FR-5)
    in_progress_adjudication --> awaiting_release : adjudication.decision recorded
    awaiting_release --> structurally_non_qualifying : any record.synthetic == true anywhere in the set (FR-6)
    awaiting_release --> acts_complete_unauthorized : scaffold --draft; sign --draft <path> for release-auth AND all records synthetic:false AND roster resolves AND chain valid AND FR-26's completeness rule satisfied (evaluateReleaseAuthorization violations == []) — FR-29: NOT an authorization signal
    acts_complete_unauthorized --> [*] : terminal short of authorization; a real cryptographic reviewer signature (schema-forced null pre-G2) and release authority (G4) both remain absent; no surface in this feature may relabel this state "release-ready"
    structurally_non_qualifying --> [*] : terminal (by design); no path to acts_complete_unauthorized exists for a synthetic set
    in_progress_clinical_1 --> corrected : scaffold --draft; sign --draft <path> for rr-YYYY-clinical-1 with supersedes: rr-XXXX-clinical-1
    corrected --> in_progress_clinical_1 : superseding record joins the chain (append-only; original never mutated)
```

Not shown above (an orthogonal fail-closed overlay, FR-28, F8): at ANY point in this diagram, if the
underlying record set is malformed, roster-invalid, signature-tampered, or (with `--history` active)
append-only-history-violated, both `status` and `validate` report an explicit `invalid` state
instead of the happy-path label above — never a false-positive next-role or terminal disposition.

Sequence view of one full pass (turn-state signals `status` surfaces at each step). Every command
below is the exact, frozen CLI invocation (FR-9, F9) — `--module`/`--root` are never implied:

```mermaid
sequenceDiagram
    autonumber
    participant Coord as Coordinator
    participant CLI as review-record CLI
    participant Draft as staged draft (outside reviews/)
    participant Store as reviews/*.yaml (append-only)
    participant Roster as reviewer-roster.yaml

    Coord->>CLI: status --module cbc_suite_v1 --json
    CLI-->>Coord: nextExpectedRole=clinical-1, derivedState=not-started
    Coord->>CLI: scaffold --module cbc_suite_v1 --role clinical-1 --subject <hash> --reviewer-id <id> --decision <d> --rationale <text> --draft --root <dir>
    CLI->>Roster: resolve reviewerId (D-4)
    CLI->>Draft: write staged draft file (never inside reviews/; FR-25)
    Coord->>CLI: sign --draft <path> --module cbc_suite_v1 --root <dir> (synthetic path only; refuses synthetic:false with a G1/G2 message)
    CLI->>Store: write rr-0001-clinical-1.yaml — the record's FIRST and ONLY write
    Coord->>CLI: validate --module cbc_suite_v1 --record rr-0001-clinical-1 (incremental, composite-cache-keyed, FR-8/FR-9)
    Note over CLI,Store: repeat for clinical-2 (status redacts clinical-1's identity/decision/rationale from this view, FR-27), lab, [adjudication only if disputed, FR-26], release-auth
    Coord->>CLI: status --module cbc_suite_v1
    CLI-->>Coord: derivedState=structurally-non-qualifying (synthetic set) OR acts-complete-unauthorized (all real, complete, chain-valid — NOT an authorization signal, FR-29) OR invalid (fail-closed, FR-28)
```

---

## 6. Requirements

### 6.1 Functional Requirements

Priorities: **Must** = v1 acceptance criterion; **Should** = strong intent, defer only with recorded
rationale; **Could** = nice-to-have.

| ID | Requirement | Priority | Notes |
|:--:|-------------|:--------:|-------|
| FR-1 | Add a `status` verb to `tools/review-record/cli.mjs` that computes derived review state and next-expected role from committed `reviews/*.yaml` files. `status` reads records the same way `validate`/`list` already do (needed to compute chain linkage and completeness), but per **FR-27** its DEFAULT human and `--json` output redacts a sibling record's `reviewerId`/`decision`/`rationale` while independence still matters, and per **FR-28** it exits non-zero with an explicit `invalid` state whenever `validate` would reject the same input. `--json` output validated by a stable, frozen JSON shape (see OQ-2) whose `derivedState` enum is `not-started` \| `in-progress` \| `disputed` \| `structurally-non-qualifying` \| `acts-complete-unauthorized` (**FR-29**) \| `invalid` (**FR-28**). | Must | target_surfaces: `tools/review-record/cli.mjs`, `tools/review-record/lib/verbs/status.mjs` (new), `tools/review-record/lib/derived-state.mjs` (new shared lib). |
| FR-2 | Define ONE structured, pure assessment function in a new `tools/review-record/lib/derived-state.mjs` — `computeDerivedReviewState(allModuleRecords, rosterVerifiedByReviewId, ...) -> { state, nextExpectedRole, eligibility, blockers: string[] }` (machine-readable `blockers`, not free-text-only) — that both `status` and `validate`'s release-authorization path consume. `validate` maps this function's `blockers`/`eligibility` onto its existing violation-string output; it does not compute a second, independently-shaped result. `evaluateReleaseAuthorization` (`lib/adjudication.mjs`) becomes this function's release-authorization-specific sub-check — its `violations[]` return maps 1:1 onto `blockers[]` entries — not a second, drift-prone code path `status` merely "agrees with" after the fact. | Must | Risk R2 mitigation. Supersedes the earlier draft's "extract... both consume" wording, which was not grounded in a structured-result shape (F6). target_surfaces: `tools/review-record/lib/derived-state.mjs`, `tools/review-record/lib/adjudication.mjs`, `tools/review-record/lib/verbs/validate.mjs`, `tools/review-record/lib/verbs/status.mjs`. |
| FR-3 | `scaffold`'s `--subject` flag becomes optional; when omitted, `subjectContentHash` is derived by `lib/subject.mjs`'s `computeModuleContentHash` (the same function `dry-run` already uses). When `--subject` IS supplied, `scaffold` (by default) additionally recomputes `computeModuleContentHash` for the target module and hard-fails (`UsageError`) on any mismatch — the existing `sha256:<64 hex>` pattern check alone cannot catch a transposed-but-pattern-valid hash pointing at the wrong content (F5). A deliberately named, separately tested `--allow-historical-subject` flag suppresses ONLY this comparison (never the pattern check) for the legitimate case of reviewing historical content that no longer matches the module's current on-disk bytes. | Must | Answers friction #2. Supersedes the earlier draft's "fails loudly at parse time" claim, which described only the unchanged pattern check, not a content-hash comparison (F5). target_surfaces: `tools/review-record/lib/verbs/scaffold.mjs`, `tools/review-record/README.md`. |
| FR-4 | `scaffold` writes a record file to disk for the real-identity (`synthetic: false`) case, producing a schema-valid record whose `signature` is `null` (per the schema's own `allOf`, non-negotiable pre-G2). Preview-only behavior remains for `synthetic: true` roster entries (which require a `TESTKEY-` signature that `scaffold` does not own). | Must | Answers friction #1 without introducing any pre-G2 signing capability. target_surfaces: `tools/review-record/lib/verbs/scaffold.mjs`, `tools/review-record/lib/store.mjs` (write path already exists). |
| FR-5 | FR-4's real-identity write path MUST be structurally inert today: `governance/reviewer-roster.yaml` ships zero `synthetic: false` entries and no task in this plan adds any (G1 is out of scope). The verb's disk write is exercised in tests against a fixture roster only, never the real roster. | Must | Risk R1/R7 mitigation. target_surfaces: `tests/fixtures/clinical-review-workflow/`, `tests/ef-review-workflow.test.mjs` (or a new sibling file). |
| FR-6 | Add a general-purpose `sign` verb per **FR-25**'s staged-draft lifecycle contract: `sign --draft <path> --module <id> --root <dir>` reads ONLY a staged draft file `scaffold --draft` produced (never an already-committed `reviews/` path); on a `synthetic: true` draft with `signature: null` it uses `lib/signature.mjs`'s `signRecordDryRun` (ephemeral in-memory Ed25519 keypair, `TESTKEY-` prefix, no key persisted) before performing the record's first and only committed write. | Must | Supersedes the earlier draft's `sign --record <review_id>` shape, which had no safe composition on the append-only substrate (F1). target_surfaces: `tools/review-record/cli.mjs`, `tools/review-record/lib/verbs/sign.mjs` (new). |
| FR-7 | The `sign` verb MUST fail-closed on a `synthetic: false` draft with an explicit gate message naming G1 (roster verification) and G2 (offline key custody + ceremony per ADR-0005), and MUST refuse to accept any `--keyfile`/`--key`/`--test-keys` flag path for the real case (there is no real-signing path in this feature). `sign` MUST NOT accept a `--record <review_id>` referring to an already-committed file — there is no code path in this feature that opens or rewrites an existing `reviews/*.yaml` path (**FR-25**). | Must | Risk R1 mitigation. target_surfaces: `tools/review-record/lib/verbs/sign.mjs`, `tests/ef-review-workflow.test.mjs`. |
| FR-8 | `validate` gains an incremental path keyed on a COMPOSITE cache key — `{record content hash, complete predecessor-set content hashes (not just the immediate predecessor), roster file hash, review-record schema hash, validator-policy version, history-mode flag}` — not the record-plus-immediate-predecessor-hash pair alone (F3). Previously computed per-record results (schema shape, roster resolution, signature verification, chain link check for that record) may be reused only when EVERY component of that composite key matches the cache entry; module-wide checks (authorship-union, independence heuristic, release-authorization evaluation) still run over the full set on any change to any component. | Must | Supersedes the earlier draft's two-hash key, which could not detect a roster/schema/policy change (F3). target_surfaces: `tools/review-record/lib/verbs/validate.mjs`, `tools/review-record/lib/validate-cache.mjs` (new). |
| FR-9 | The `validate` cache MUST be fail-closed on ANY key-component miss or read uncertainty (roster changed, schema changed, validator-policy version changed, history-mode flag changed, any record or predecessor hash changed, or the cache file itself is unreadable/corrupt) — full recompute, never a stale pass. The cache is a PERSISTENT, non-repo-tree store (OS temp/XDG cache dir, atomic write-then-rename) keyed by `{root, moduleId}` so cache-warmth survives across separate CLI invocations/processes — an in-memory-only cache cannot deliver FR-8's performance claim across process boundaries (F3). Five dedicated adversarial tests seed a stale cache and assert fresh-process invalidation independently for: a roster change, a schema change, a record-content change, a predecessor-content change, and a history-mode-flag change. | Must | Risk R5 mitigation. Supersedes the earlier draft's unspecified/in-memory cache lifecycle (F3). target_surfaces: `tools/review-record/lib/validate-cache.mjs`, `tests/ef-review-workflow.test.mjs`. |
| FR-10 | The `validate --history` git-history append-only check (P2-T3) interacts with the incremental path as a fail-closed union: `--history` results are never cached across invocations (git history is not part of FR-8's composite key and can change without any key component changing) — every `--history` call re-runs the git-log check regardless of the persistent cache's state for the record's other components. | Must | Answers OQ-6. target_surfaces: `tools/review-record/lib/verbs/validate.mjs`, `tools/review-record/lib/history.mjs`. |
| FR-11 | Add a queue/turn-state section to the read-only static HTML render (`lib/render.mjs`), listing the five roles in order with each role's committed record link (existing behavior) plus a `NEXT` or `TERMINAL` marker per the derived-state library's output. Per **FR-27**, this section redacts sibling reviewer identity/decision/rationale by default (a build-time `--unredacted` flag on the `render` verb lifts it, since render has no viewer-identity concept). No `<script>`, no `<a href>` (existing render constraint), no server. | Must | Answers friction #5. target_surfaces: `tools/review-record/lib/render.mjs`, `tools/review-record/lib/verbs/render.mjs`, render golden under `tests/fixtures/ef-review-render/`. |
| FR-12 | Terminal-state messaging: on the `structurally_non_qualifying` end state, both `validate` and `status` (and the render output) MUST include an explicit sentence naming that this is the correct, by-design terminus for any `synthetic: true` set and is not a defect (FR-6 from the substrate). | Must | Answers friction #4. target_surfaces: `tools/review-record/lib/verbs/validate.mjs`, `tools/review-record/lib/verbs/status.mjs`, `tools/review-record/lib/render.mjs`. |
| FR-13 | Author `docs/governance/reviewer-runbook.md` — a non-engineer clinician's guided walkthrough of the five-role sequence against the committed `cbc_suite_v1` dry-run fixture, corrections via `supersedes` (never in-place edits), what "structurally non-qualifying" means, and the honest boundary that this is an unvalidated research prototype (roster synthetic-only, no clinical sign-off exists). | Must | Answers OQ-3 (location); linked from `tools/review-record/README.md` and `docs/architecture.md` §11. target_surfaces: `docs/governance/reviewer-runbook.md`, `tools/review-record/README.md`, `docs/architecture.md`. |
| FR-14 | Runbook language MUST NOT imply clinical validity, real sign-off having occurred, or the roster containing real reviewers. Runbook is reviewed for honesty language before merge. | Must | Risk R4 mitigation. |
| FR-15 | Ship an OQ-8 portal-promotion decision framework as a section within `docs/project_plans/design-specs/clinical-review-portal-workflow.md` (or a linked sibling), naming: (a) friction-metric categories and the committed markdown observation-log format, (b) an explicit threshold, (c) the authorized human decision-owner role (never an agent, never `rf`/ARC output), (d) a decision-record template. | Must | Answers OQ-8. target_surfaces: `docs/project_plans/design-specs/clinical-review-portal-workflow.md`, potentially `.claude/worknotes/clinical-review-workflow/friction-observations.md` (framework prescribes location). |
| FR-16 | Friction observations are captured only as committed markdown files in this repository — **zero telemetry, zero network, zero third-party analytics**. The framework MUST explicitly restate this constraint. | Must | Answers OQ-4; restates CLAUDE.md's public-microsite / zero-third-party posture at the review-workflow boundary. |
| FR-17 | Ship portal **concept-only mockup images** under `docs/project_plans/design-specs/assets/` — each mockup file MUST carry a visible `CONCEPT ONLY — NOT A COMMITMENT` watermark or overlay, and the design-spec section that references them MUST stay `maturity: shaping`. | Should | Risk R6 mitigation. target_surfaces: `docs/project_plans/design-specs/assets/`, `docs/project_plans/design-specs/clinical-review-portal-workflow.md`. |
| FR-18 | Update `docs/architecture.md` with a new §11 (or updated existing §11) documenting the review-workflow layer: verbs, derived-state model, the runbook link, and the honesty boundary. | Must | target_surfaces: `docs/architecture.md`. |
| FR-19 | Update `tools/review-record/README.md` to name the new verbs (`status`, `sign`), the incremental `validate` path, the derived-state library, and to point at the runbook and portal-promotion framework. | Must | target_surfaces: `tools/review-record/README.md`. |
| FR-20 | Wire this feature's tests into `npm run check`. `npm test` is `node --test tests/*.test.mjs tests/witness/*.test.mjs` — two flat, NON-recursive globs (F10). Every new test file this feature adds MUST live directly under one of those two exact directories (no new nested test subdirectory); this feature does NOT change `package.json`'s `scripts.test` glob. Coverage-relevant paths must not degrade existing coverage floors. | Must | Supersedes the earlier draft's implied `tests/**` recursive-discovery assumption (F10). target_surfaces: `package.json`, `tests/*.test.mjs`, `tests/witness/*.test.mjs`. |
| FR-21 | `status --json` and `sign` are deterministic across invocations over identical committed inputs (no wall-clock timestamps in `status --json` bytes; `sign` remains ephemeral-key-per-invocation, so its `signature.value` differs by design — but its non-signature output fields are stable). | Should | target_surfaces: determinism tests under `tests/`. |
| FR-22 | The feature ships zero new runtime dependencies (Node-builtin `node:crypto`, `node:child_process` only, matching the substrate's zero-dep posture). | Must | target_surfaces: `package.json` (no additions), lint-style grep test similar to the existing `tests/ef-review-record-cli.test.mjs` pattern. |
| FR-23 | The `sign` verb MUST NOT accept or read any file that could be a real signing key (no `--keyfile`, no environment-variable key path, no reading from `~/.config/**`). Enforced by a static grep test analogous to the existing "no network" grep pattern. | Must | Risk R1 mitigation. target_surfaces: `tools/review-record/lib/verbs/sign.mjs`, `tests/ef-review-record-cli.test.mjs` (or sibling). |
| FR-24 | Reviewer-2 structural independence semantics (`nextChainLink` single-file touch) MUST remain unchanged. Existing independence tests (including the `chain_isolation_v1` fixture) stay green; no new code path in this feature reads a sibling record's parsed content during scaffold. | Must | Risk R3 mitigation. target_surfaces: existing `tests/ef-review-workflow.test.mjs` fixtures. |
| FR-25 | **(New, F1) Sign staged-draft lifecycle.** `scaffold --draft` writes a schema-shaped draft record (whatever its `synthetic` flag) to a staging location entirely outside `modules/<id>/reviews/` — `<root>/.review-drafts/<moduleId>/<review_id>.draft.yaml` (gitignored, transient) — and prints that path. `sign --draft <path> --module <id> --root <dir>` reads ONLY that staged draft file, attaches a signature (TESTKEY- for `synthetic:true`; fail-closed refusal per FR-7 for `synthetic:false`), and performs the record's FIRST and ONLY committed write via the existing `lib/store.mjs` `writeNewReviewRecordFile` append-only path. `sign` never opens, reads the parsed content of, or rewrites any path already inside `reviews/`; a bare `sign --record <review_id>` naming an already-committed file is not a supported invocation (no composition legitimately reopens a committed record). | Must | Risk R1/R12 mitigation. target_surfaces: `tools/review-record/lib/verbs/scaffold.mjs`, `tools/review-record/lib/verbs/sign.mjs`, `tests/ef-review-workflow.test.mjs`. |
| FR-26 | **(New, F2) Adjudication conditional-completeness (ADR-0004 reconciliation).** The shared derived-state assessment (FR-2) and `evaluateReleaseAuthorization` (`lib/adjudication.mjs`) are updated so a `release-auth` record's completeness check requires the `adjudication` role ONLY WHEN the resolved `clinical-1` and `clinical-2` records' `decision` fields disagree (the "resolved" record for a role = the **effective act**: the latest non-superseded record of that role for the `subjectContentHash` — any record named in another record's `supersedes` chain is excluded BEFORE the agree/disagree predicate is applied); on documented agreement, the four remaining roles (`clinical-1`, `clinical-2`, `lab`, `release-auth`) are sufficient for completeness. This is a **governance-sensitive behavior change** to `lib/adjudication.mjs`, implemented as its own named task (P1-T5), fixture-tested on BOTH the agree and the disagree paths, flagged for the validator gate and a codex per-wave review. It encodes ADR-0004 decision item 5 into code — it does NOT ratify ADR-0004 (`status` stays `proposed`, G0). | Must | Risk R2/R7 mitigation. target_surfaces: `tools/review-record/lib/adjudication.mjs`, `tools/review-record/lib/derived-state.mjs`, `tests/ef-review-adjudication.test.mjs`. |
| FR-27 | **(New, F7) Independence-preserving redaction.** `status`'s human and `--json` output, and `render`'s queue/turn-state section, REDACT any already-committed sibling record's `reviewerId`, `decision`, and `rationale` whenever that sibling's role could still bias a pending, not-yet-committed independent act for the same `subjectContentHash` (concretely: `clinical-1`'s already-committed record is redacted from any projection consulted before `clinical-2`'s own act is committed for that subject; the same logic extends to `lab`/`adjudication`). Redaction lifts automatically once the viewing role's own act is already committed for that subject, or once the record set reaches a terminal state (`structurally-non-qualifying` or `acts-complete-unauthorized`). Because the tool has no notion of who is running it, the DEFAULT output is always the redacted view; an explicit `--unredacted` flag exists for an adjudicator or release-authorizer who legitimately needs the full picture, and its use prints a visible warning banner naming the independence risk. | Must | Risk R3/R10 mitigation. Directly answers the ADR-0004 "reviewer 2 must review independently before seeing reviewer 1's vote" rule as it applies to tooling output, not only to the act of reviewing. target_surfaces: `tools/review-record/lib/verbs/status.mjs`, `tools/review-record/lib/render.mjs`. |
| FR-28 | **(New, F8) `status` fail-closed contract.** `status` MUST exit non-zero and emit an explicit, non-actionable `invalid` derived state whenever the same input would cause `validate` to reject it — malformed YAML, roster resolution failure, chain-link failure, signature tamper, or (when `--history` is passed to `status`) an append-only git-history failure. `status` documents explicitly that it does NOT run history validation by default (matching `validate`'s own opt-in default) and exposes an equivalent `--history` flag for parity. | Must | Risk R13 mitigation. target_surfaces: `tools/review-record/lib/verbs/status.mjs`, `tests/ef-review-workflow.test.mjs`. |
| FR-29 | **(New, F4) Non-authorizing derived-state naming.** The derived state previously drafted as `release-ready-candidate` is renamed `acts-complete-unauthorized` everywhere in this feature's user-visible surfaces (CLI human/`--json` output, render, docs). No derived-state label this feature emits may read as `release-ready`, `approved`, or `authorized` (or any synonym) pre-G0/G1/G2/G4 — `acts-complete-unauthorized` communicates only that the five-role act set (per FR-26's completeness rule) is structurally complete, chain-valid, and roster-verified; it makes NO claim about a real cryptographic reviewer signature (the schema still forces `signature: null` on every `synthetic:false` record pre-G2, and `evaluateReleaseAuthorization` never checks signature validity) or about G4 release authorization. | Must | Risk R11 mitigation. target_surfaces: `tools/review-record/lib/derived-state.mjs`, `tools/review-record/lib/verbs/status.mjs`, `tools/review-record/lib/render.mjs`, negative test against a real (`synthetic:false`) fixture roster. |

### 6.2 Non-Functional Requirements

**Performance:**
- Incremental `validate --record` invocation SHOULD be measurably faster than the current
  module-wide recompute on the committed `cbc_suite_v1` five-record set, per a repeatable
  microbenchmark committed under `tests/`, measured **across two separate process invocations**
  sharing the FR-9 persistent cache (a same-process microbenchmark alone cannot demonstrate the
  cross-invocation claim, F3). Absolute wall-time targets are not fixed by this PRD; the
  implementation plan picks a number and defends it against the microbenchmark.
- `status` returns in under 200 ms on the committed `cbc_suite_v1` set on a standard developer
  workstation. (Guideline; not a hard failure condition.)

**Security:**
- No new network egress from any file under `tools/review-record/` (existing grep test extended).
- No key material of any kind is read from disk, environment, or CLI flag by the `sign` verb.
- No PHI is introduced anywhere; nothing in this feature reads patient data.
- `verify-d4-built.mjs` remains untouched; ARC/council output remains structurally ineligible to
  populate any reviewer or approver field.

**Accessibility:**
- The render's queue/turn-state section preserves semantic HTML headings so a screen reader can
  navigate the five roles.

**Reliability:**
- Every fail-closed path (roster resolution, chain, history, signature, cache mismatch — per
  key component, FR-9 — gate refusal) has at least one dedicated negative test.
- `status` has an explicit, non-actionable `invalid` result for every input class `validate`
  rejects (FR-28) — it never silently reports a next-role or terminal disposition over an invalid
  record set.
- `sign` never opens or rewrites a path already inside `modules/<id>/reviews/` (FR-25) — a
  dedicated test proves no existing review-record path's mtime/bytes change across a `sign`
  invocation.
- Existing green tests stay green: `tests/ef-review-workflow.test.mjs`,
  `tests/ef-review-record-cli.test.mjs`, `tests/ef-contract-forced-empty.test.mjs`, and
  `verify-d4-built.mjs`.

**Observability:**
- The friction observation log format (FR-15/FR-16) is the ONLY observability surface. No
  OpenTelemetry, no structured logs, no trace IDs — this is a local, offline, single-user CLI.
- The template-repo's generic "OpenTelemetry spans / structured logs" NFRs are **explicitly not
  applicable** to this feature; the PRD template's boilerplate is overridden here to match this
  repo's zero-network posture.

**Honesty:**
- Every user-visible surface added by this feature (CLI human output, `status --json` documentation,
  render section, runbook, README, architecture §11) MUST carry, or link one hop to, the unvalidated
  research prototype boundary and the "roster synthetic-only, no clinical sign-off exists" statement.

---

## 7. Scope

### In Scope (v1)

- New CLI verbs: `status`, `sign`.
- `scaffold` ergonomics: auto-derived `subjectContentHash`; real-identity write path (structurally
  inert; roster ships zero real entries).
- Incremental `validate` with fail-closed content-hash-keyed caching.
- Queue/turn-state section in the existing read-only static HTML render.
- Shared derived-state library consumed by `status` and `validate`.
- Terminal-state messaging fix (FR-12).
- Reviewer runbook (`docs/governance/reviewer-runbook.md`).
- OQ-8 portal-promotion decision framework (friction log format, threshold, owner role,
  decision-record template).
- Portal concept-only mockup images (`docs/project_plans/design-specs/assets/`), watermarked.
- `docs/architecture.md` §11 update.
- `tools/review-record/README.md` update.
- Tests wired into `npm run check`.

### Out of Scope (hard, non-negotiable)

- **Portal application.** No web server, no auth, no database, no interactive UI, no `<script>`
  tag, no HTTP endpoint. Portal is DF-E1-01's follow-on and remains `maturity: shaping` after this
  feature. Concept mockups are static image assets only.
- **Real-reviewer signing** — no code path in this feature signs a `synthetic: false` record. The
  schema's `signature: null` forcing on `synthetic: false` is preserved.
- **Any `governance/reviewer-roster.yaml` entry with `synthetic: false`.** Adding a real reviewer
  is a G1 human act by the program owner, out of scope here.
- **ADR-0004 acceptance (G0).** No task in this plan may edit any ADR's `status` field.
- **Any change to `clinicalApprovers[]`/`approvedBy[]` schema-forced-empty (`maxItems: 0`).** These
  stay exactly as they are.
- **Any weakening of D-4** — ARC/council/`rf`/agent output remains structurally ineligible to
  populate reviewer/approver fields. `verify-d4-built.mjs` untouched.
- **Any weakening of reviewer-2 structural independence.** `nextChainLink` semantics
  (single-file touch, only immediate-predecessor bytes hashed) untouched.
- **`clinicalContentHash` promotion** or module-manifest `status` transitions from `unsigned-stub`
  toward `release-ready` — this remains G4-gated by a real `release-auth` record with a
  G2-custodian signature, none of which exist in this feature's scope.
- **Real signing key handling anywhere.** No `--keyfile`, no key env var, no read of any real key.
- **Telemetry/analytics** for friction observations or anything else.
- **DF-E1-04 (retrospective validation harness) linkage** — deferred; that harness depends on real
  reviewer identity + a signed release candidate, neither of which exists.
- **Non-CBC modules** — this feature exercises `cbc_suite_v1` only; adapting to other modules is
  a future concern.

---

## 8. Dependencies & Assumptions

### External Dependencies

None new. Existing runtime dependencies remain unchanged (Node ≥ 20 builtins only:
`node:crypto`, `node:child_process`, `node:fs`, `node:path`).

### Internal Dependencies

- **`tools/review-record/` substrate (shipped by `evidence-foundry-e1-v1` Phase 2).** This feature
  layers on top of `lib/store.mjs`, `lib/chain.mjs`, `lib/roster.mjs`, `lib/signature.mjs`,
  `lib/subject.mjs`, `lib/adjudication.mjs`, `lib/independence.mjs`, `lib/history.mjs`,
  `lib/render.mjs`, and the existing verb dispatch in `cli.mjs`.
- **`schemas/review-record.schema.json` and `schemas/reviewer-roster.schema.json`.** Unchanged by
  this feature; the schemas' `allOf` blocks are the load-bearing structural enforcement this PRD
  relies on (in particular, forced `signature: null` on `synthetic: false`).
- **`scripts/validate-kb.mjs`.** Build-time schema and cross-file gate; this feature's `validate`
  cache is additive and does not replace it.
- **`docs/architecture.md`, `tools/review-record/README.md`.** Updated in-place.
- **`docs/adr/0005-kb-serialization-signing-key-custody.md`.** Referenced by `sign` verb's gate
  message; not modified.

### Gate Dependencies (external human gates that this feature does NOT clear)

Enumerated in `docs/governance/gates-registry.md` — restated here so the boundary is explicit:

| Gate | This feature | Notes |
|------|--------------|-------|
| G0 (ADR ratification for ADR-0004 / ADR-0005) | Does not clear. | Feature ships regardless of ADR status; nothing describes ADR-0004 as "adopted policy." |
| G1 (named credentialed reviewer roster) | Does not clear. | `sign` refuses `synthetic: false` records with an explicit G1 message. |
| G2 (signing custodian + offline key ceremony) | Does not clear. | No real signing anywhere in this feature. |
| G3 (data-source SPIKE verdict + DUA) | Not relevant. | This feature does not touch retrospective validation data. |
| G4 (release authorizer) | Does not clear. | Module status transitions to `release-ready` remain schema-impossible pre-G1/G2/G4. |

### Assumptions

- The committed `modules/cbc_suite_v1/reviews/` five-file dry-run set remains the canonical
  fixture for this feature's tests (pinned by golden at `tests/fixtures/ef-review-dryrun/golden/`).
- `governance/reviewer-roster.yaml` continues to carry only `synthetic: true` entries through this
  feature's ship.
- `node:crypto` Ed25519 support remains stable across Node ≥ 20 (existing substrate assumption).

### Feature Flags

None. This feature ships behavior additions to a local CLI; there is no runtime flip to gate.

---

## 9. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|:------:|:----------:|------------|
| R1: `sign` verb creates a path to real signatures pre-G1/G2 | **High** | Med | Schema's `signature: null`-on-`synthetic:false` remains load-bearing; sign verb explicitly refuses; FR-7 + FR-23 negative tests are acceptance criteria; no key-file/keyring accepted anywhere in the code (grep test). |
| R2: `status` reimplements derived-state logic and drifts from `validate` | High | Med | FR-2: one shared `lib/derived-state.mjs`; drift test compares `status --json` derived disposition against `validate`'s release-authorization evaluator over the same committed inputs. |
| R3: Ergonomic changes weaken reviewer-2 structural independence | High | Low | FR-24: `nextChainLink` single-file-touch semantics unchanged; `chain_isolation_v1` fixture test stays green; explicit AC on every scaffold-touching change. |
| R4: Runbook/docs language implies clinical validity or real sign-off exists | Med | Med | FR-14: mandatory honesty pass; every user-visible surface links one hop to the boundary statement. |
| R5: Validate caching introduces stale-pass (fail-open) | Med | Med | FR-9: canonical-content-hash keying; on any mismatch or parse failure, full recompute; dedicated stale-cache adversarial test. `--history` results never cached (FR-10). |
| R6: Portal mockups read as a commitment or open a second trust boundary | Low | Med | FR-17: `CONCEPT ONLY — NOT A COMMITMENT` watermark; design spec's portal section stays `maturity: shaping`; no portal code in this feature. |
| R7: Plan tasks accidentally "accept" ADR-0004 or add roster entries | High | Low | Explicit non-goal in every phase; no task edits any ADR `status` field or `governance/reviewer-roster.yaml` real entries; task-completion-validator per phase, karen at feature end. |
| R8: `subjectContentHash` auto-derivation drifts from `dry-run`'s convention | Med | Low | Both callers use `lib/subject.mjs`'s `computeModuleContentHash` verbatim; a test asserts both entry points produce equal hashes on `cbc_suite_v1`. |
| R9: Incremental validate skips a check that only ran module-wide before | Med | Med | FR-8's per-record vs. module-wide split is explicit: module-wide checks (authorship-union, independence heuristic, release-authorization evaluation) always run on any change; per-record checks (schema shape, roster resolution, signature verification, chain link check for that record) are the only cache-eligible surface. |

---

## 10. Target State (Post-Implementation)

**User experience.** A program owner exercising the workflow with synthetic personas can run
`scaffold` → `sign` → `validate` → `status` → `render` end-to-end without hand-computing the
subject content hash or hand-composing the signing step, and can read turn-state at any time from
either `status --json` or the static HTML render. A prospective non-engineer clinical reviewer has
a written runbook covering the five-role sequence, corrections via `supersedes`, and the
structurally-non-qualifying terminal state. A portal-decision owner has a written framework
(metrics, threshold, owner role, decision-record template) and concept-only mockups to inform the
future OQ-8 call — never to preempt it.

**Technical architecture.** Two new verbs (`status`, `sign`) and a new shared derived-state library
(`lib/derived-state.mjs`) plus a new incremental-validate cache (`lib/validate-cache.mjs`). The
render gains one new templated section; the CLI dispatch gains two rows. The runbook and framework
are prose-only documents. No new schemas, no new module packages, no new services.

**Observable outcomes.**
- 7 verbs on `tools/review-record/cli.mjs` (was 5).
- 5 of 5 P2-T8 friction observations answered by shipped mechanics.
- `npm run check` passes with the new tests included.
- `governance/reviewer-roster.yaml` still contains 5 `synthetic: true` entries and 0 real entries.
- `modules/cbc_suite_v1/reviews/*.yaml` unchanged.
- `verify-d4-built.mjs` unchanged and green.
- `tests/ef-contract-forced-empty.test.mjs` unchanged and green.

---

## 11. Overall Acceptance Criteria (Definition of Done)

Every criterion below is testable by an existing or new automated check unless explicitly marked
as a human review criterion. Testable does not mean *clinically validated* — every check here proves
software behavior only.

### Functional Acceptance

- [ ] **AC-FR-1..24**: Each functional requirement in §6.1 has at least one committed test under
  `tests/` (or, for docs-only FRs, a docs-truth test that greps for required strings).
  target_surfaces: `tests/`, `tools/review-record/`, `docs/`.
- [ ] **AC-friction-#1**: `scaffold --module cbc_suite_v1 --role clinical-1 --reviewer <real-id>`
  against a fixture roster carrying one `synthetic: false` entry writes a schema-valid file to
  disk with `signature: null`. target_surfaces: `tests/fixtures/clinical-review-workflow/`,
  `tests/ef-review-workflow.test.mjs`.
- [ ] **AC-friction-#2**: `scaffold` without `--subject` produces the same `subjectContentHash` as
  `dry-run`'s auto-derived value for the same module. target_surfaces:
  `tools/review-record/lib/subject.mjs` consumers.
- [ ] **AC-friction-#3**: A cache-warm `validate --record <id>` invocation on `cbc_suite_v1` is
  measurably faster than a cache-cold invocation on the same input. target_surfaces:
  `tests/ef-review-workflow.test.mjs` (microbenchmark) or a dedicated `tests/*perf*.test.mjs`.
- [ ] **AC-friction-#4**: `validate` on the committed `cbc_suite_v1` synthetic set outputs an
  explicit sentence naming the terminal state as by-design, not a defect. target_surfaces:
  `tools/review-record/lib/verbs/validate.mjs` output, matching test.
- [ ] **AC-friction-#5**: `status --module cbc_suite_v1` and the static render's queue/turn-state
  section both name the next-expected role or the terminal state. target_surfaces:
  `tools/review-record/lib/verbs/status.mjs`, `tools/review-record/lib/render.mjs`, render golden.

### Technical / Guardrail Acceptance

- [ ] **AC-D4**: `verify-d4-built.mjs` remains untouched and green; ARC/council output is not
  populated into any reviewer or approver field anywhere in the repo diff. target_surfaces:
  `scripts/verify-d4-built.mjs`, repo-wide grep in the PR's CI.
- [ ] **AC-forced-empty**: `clinicalApprovers[]`/`approvedBy[]` `maxItems: 0` schema constraints
  unchanged; `tests/ef-contract-forced-empty.test.mjs` green. target_surfaces:
  `schemas/rule.schema.json`, `schemas/module-manifest.schema.json`.
- [ ] **AC-signature-null**: Every `synthetic: false` record any test in this feature writes
  carries `signature: null`; a positive assertion in the scaffold-write test. target_surfaces:
  `tests/fixtures/clinical-review-workflow/`, `tests/ef-review-workflow.test.mjs`.
- [ ] **AC-sign-refuses-real**: `sign` on a `synthetic: false` record exits non-zero with a
  gate-message containing both "G1" and "G2" (or their canonical registry names). target_surfaces:
  `tools/review-record/lib/verbs/sign.mjs`, sibling test.
- [ ] **AC-sign-no-keyfile**: No file under `tools/review-record/` reads a key from disk, env, or
  CLI flag; static grep test. target_surfaces: `tools/review-record/`, `tests/ef-review-record-cli.test.mjs`.
- [ ] **AC-independence-unchanged**: The `chain_isolation_v1` independence test remains green;
  `nextChainLink` is not modified. target_surfaces: `tools/review-record/lib/chain.mjs`,
  `tests/ef-review-workflow.test.mjs`.
- [ ] **AC-cache-fail-closed**: The stale-cache adversarial test (bit-flip in a cached input)
  triggers full recompute and a validation error rather than a stale pass. target_surfaces:
  `tools/review-record/lib/validate-cache.mjs`, dedicated test.
- [ ] **AC-history-uncached**: `validate --history` results are never cached across invocations;
  test asserts that a git-history mutation between two calls is caught on the second call.
  target_surfaces: `tools/review-record/lib/verbs/validate.mjs`, dedicated test.
- [ ] **AC-status-drift-guard**: `status --json` and `validate` both consume the SAME structured
  `computeDerivedReviewState` result (FR-2/FR-6); a test drives that one function over a matrix of
  every `derivedState` value × representative `blockers[]` combination (at minimum: not-started,
  in-progress, disputed, structurally-non-qualifying, acts-complete-unauthorized, invalid; plus
  chain-broken, roster-invalid, and signature-tamper blockers) and asserts `status`'s `--json`
  `derivedState`/`blockers` and `validate`'s violation-string mapping are both derived from it — not
  two independently-shaped outputs compared for coincidental equality (F6). target_surfaces:
  `tools/review-record/lib/derived-state.mjs`, `tests/ef-review-workflow.test.mjs`.
- [ ] **AC-zero-deps**: `package.json` has no new runtime dependencies; grep-test enforces.
  target_surfaces: `package.json`, `tests/ef-review-record-cli.test.mjs`.
- [ ] **AC-zero-network**: The existing "no network" grep pattern in
  `tests/ef-review-record-cli.test.mjs` continues to pass with the new files included. target_surfaces:
  `tests/ef-review-record-cli.test.mjs`.

### Documentation Acceptance

- [ ] **AC-runbook**: `docs/governance/reviewer-runbook.md` exists and covers all five roles end-to-end
  against the committed `cbc_suite_v1` dry-run set, includes the corrections-via-`supersedes` flow,
  explains the structurally-non-qualifying terminal state, and carries the honesty boundary.
  target_surfaces: `docs/governance/reviewer-runbook.md`, docs-truth test.
- [ ] **AC-architecture-§11**: `docs/architecture.md` §11 documents the review-workflow layer,
  names the verbs, links the runbook and framework. target_surfaces: `docs/architecture.md`.
- [ ] **AC-readme**: `tools/review-record/README.md` names `status` and `sign`, the incremental
  `validate` path, and links the runbook and framework. target_surfaces: `tools/review-record/README.md`.
- [ ] **AC-framework**: `docs/project_plans/design-specs/clinical-review-portal-workflow.md`
  contains an OQ-8 framework section naming: friction-metric categories, committed markdown
  observation-log format (zero network), threshold, decision-owner role, decision-record template.
  target_surfaces: `docs/project_plans/design-specs/clinical-review-portal-workflow.md`.
- [ ] **AC-mockup-watermark**: Every image file under `docs/project_plans/design-specs/assets/`
  produced by this feature carries a visible "CONCEPT ONLY — NOT A COMMITMENT" watermark, and the
  spec's portal section stays `maturity: shaping`. target_surfaces: `docs/project_plans/design-specs/assets/`,
  spec frontmatter grep.
- [ ] **AC-honesty-language**: A docs-truth test asserts that each user-visible surface (README,
  runbook, architecture §11, framework doc) contains at least one of the substring markers
  "unvalidated research prototype" / "roster is synthetic-only" / "no clinical sign-off exists"
  (or the spec-agreed equivalents). target_surfaces: docs-truth test file, all four docs above.

### Gate Acceptance

- [ ] **AC-check-gate**: `npm run check` is green with all new tests included. target_surfaces:
  `package.json`'s `scripts.check`, CI.
- [ ] **AC-karen-milestone**: Karen review runs at Phase 4 milestone and again at feature end,
  with both passes recorded. **Human review criterion.** target_surfaces: PR description /
  worknotes.
- [ ] **AC-second-opinion**: A codex `gpt-5.6-terra` read-only diff review runs per wave, per the
  decisions block's model-routing table. **Human review criterion.** target_surfaces: PR
  description / worknotes.

---

## 12. Assumptions & Open Questions

### Assumptions

- ADR-0004 remains `proposed` throughout this feature's lifetime; no task edits its `status`.
- `governance/reviewer-roster.yaml` remains synthetic-only.
- The `cbc_suite_v1` five-record dry-run fixture is stable and pinned by golden.
- `node:crypto` Ed25519 remains supported on the pinned Node runtime.

### Open Questions

The following six OQs are carried forward from
`.claude/worknotes/clinical-review-workflow/decisions-block.md` §7. Two additional OQs (OQ-7,
OQ-8) are surfaced by this PRD's authoring pass over the substrate.

- [ ] **OQ-1**: `sign` verb key source on the synthetic path — reuse the dry-run ephemeral
  TESTKEY flow verbatim, or accept a keyfile arg as a design seam for ADR-0005's future custody
  mechanism?
  - **A (planner intent, per decisions block)**: Default TESTKEY-only, ephemeral in memory, no
    `--keyfile` accepted. Real-signing seam remains a future-feature note, not code.
- [ ] **OQ-2**: `status --json` output schema — the minimal stable shape.
  - **A (planner intent, revised per F4/F6/F7)**: `{ moduleId, subjectContentHash, records: [{ role,
    review_id, reviewerId, decision, synthetic, supersedes, chainLinkage }] (reviewerId/decision on
    an independence-sensitive sibling REDACTED by default — FR-27), derivedState:
    "not-started" | "in-progress" | "disputed" | "structurally-non-qualifying" |
    "acts-complete-unauthorized" | "invalid", nextExpectedRole: "clinical-1" | ... | null,
    blockers: string[] (machine-readable, from computeDerivedReviewState — FR-2) }`. The
    `acts-complete-unauthorized` value replaces the earlier `release-ready-candidate` draft (FR-29);
    `invalid` is the FR-28 fail-closed state. Implementation plan freezes the exact shape.
- [ ] **OQ-3**: Runbook location — `docs/governance/reviewer-runbook.md` (preferred) vs.
  `tools/review-record/docs/reviewer-runbook.md`.
  - **A (this PRD)**: `docs/governance/reviewer-runbook.md`, per FR-13; linked from README and
    architecture §11.
- [ ] **OQ-4**: Friction-metric capture mechanism.
  - **A (this PRD)**: Committed markdown observation log under
    `.claude/worknotes/clinical-review-workflow/friction-observations.md` (or equivalent path the
    implementation plan freezes); zero network/telemetry; framework doc pins the format.
- [ ] **OQ-5**: `changelog_required` — is this feature required to ship a changelog entry?
  - **A (planner intent)**: Default false (internal tooling). Implementation plan may confirm.
- [ ] **OQ-6**: Interaction between `validate --history` and the incremental cache.
  - **A (this PRD via FR-10)**: Fail-closed union — `--history` results are never cached across
    invocations; each `--history` call re-runs the git-log check.
- [ ] **OQ-7**: How does the runbook handle the scaffold-writes-then-signs sequence for
  `synthetic: true` records without accidentally instructing a real reviewer (post-G1) to run
  `sign`? Real reviewers do not sign records; the signing custodian at G2 signs the release
  manifest per ADR-0005, separately.
  - **A (proposed)**: Runbook has two clearly-labeled tracks — "exercise (synthetic personas)"
    and "post-G1 real reviewer" — with the `sign` verb visible only on the exercise track. The
    post-G1 track ends at scaffold-writes-the-file; commit-attribution is the reviewer's
    attributable act.
- [ ] **OQ-8**: **Portal-promotion decision framework** — this PRD ships the framework (FR-15/16/17)
  but leaves the specific threshold value and the named owner-role to the framework document
  itself, not this PRD's body.
  - **A (this PRD)**: The framework doc names the metric categories, the log format, and the
    owner-role name (never a person). The threshold value is a first-cut proposal in the
    framework and is itself subject to human ratification before it can trigger any promotion
    action. This PRD explicitly does not commit the project to promoting to a portal.

---

## 13. Deferred Items

Recorded here so the implementation plan's deferred-items table can copy them:

| Item | Disposition | Cross-ref |
|------|-------------|-----------|
| **Portal application** (auth, hosting, second trust boundary + its security review) | Deferred to a future feature, gated on the OQ-8 framework's threshold clearing and the named human decision-owner's explicit ratification. Design spec `clinical-review-portal-workflow.md` stays `maturity: shaping`. No code in this feature. | ADR-0004 Option 2; `clinical-review-portal-workflow.md` "Open Questions"; this PRD FR-15/17. |
| **Real-reviewer onboarding (G1)** — populating `governance/reviewer-roster.yaml` with `synthetic: false` entries, out-of-band credential verification | Owner-blocked human act. Runbook prepares for it (FR-13) but the feature never performs it. Any real entry is a G1 clearance recorded in the roster with a populated `verificationRef`. | `docs/governance/gates-registry.md` G1; `schemas/reviewer-roster.schema.json` `verificationRef` requirement. |
| **DF-E1-04 retrospective-validation harness linkage** — real adjudicated case data + signed release candidate | Deferred; DF-E1-04's design spec (`retrospective-validation-harness.md`) depends on this feature's reviewer-identity model *plus* a data-source SPIKE (G3) and a G4 release-authorization. None exist. | ADR-0004 `unblocks: [DF-E1-01, DF-E1-04]`; `evidence-foundry-on-research-foundry.md` §7.3. |
| **Real signing (G2)** — offline key-custody ceremony, real Ed25519 keypair, non-`TESTKEY-` `keyId` | Deferred; ADR-0005 seeds the mechanism, custodian designation is a G2 human act. This feature explicitly rejects real signing at every seam. | ADR-0005; `docs/governance/gates-registry.md` G2; SPIKE-006 A2 reconciliation. |
| **ADR-0004 ratification (G0)** | Deferred human act. Feature ships with ADR-0004 remaining `proposed`. | `docs/governance/gates-registry.md` G0. |
| **Non-CBC modules** | Deferred; workflow shape is per-module-agnostic already, but this feature exercises only `cbc_suite_v1`. Adapting for future modules is a separate incremental scope decision. | — |

---

## 14. Appendices & References

### Related Documentation

- **ADRs**: `docs/adr/0004-clinical-approval-identity-adjudication.md`,
  `docs/adr/0005-kb-serialization-signing-key-custody.md`.
- **Design Specifications**: `docs/project_plans/design-specs/clinical-review-portal-workflow.md`,
  `docs/project_plans/design-specs/review-portal-design.md`.
- **Substrate**: `tools/review-record/README.md`, `schemas/review-record.schema.json`,
  `schemas/reviewer-roster.schema.json`.
- **Governance**: `docs/governance/gates-registry.md`.
- **Worknotes**: `.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md`,
  `.claude/worknotes/clinical-review-workflow/decisions-block.md`.

### Prior Art

- P2-T1..P2-T8 (`evidence-foundry-e1-v1` Phase 2) — the file+CLI substrate this PRD builds on.
- Wave-0 EP7-T1 → replaced-by-P1-T2 review-record shape lineage (see
  `.claude/worknotes/evidence-foundry-e1-v1/contracts-design.md` §(a)).

### Symbol References

Not applicable (this is a local CLI + docs feature; no HTTP API/UI symbols).

### Honesty Boundary (verbatim-in-spirit, restated for future readers)

**Status: unvalidated research prototype.** Automated checks prove *software behavior*, never
clinical validity, safety, diagnostic performance, or regulatory status. The reviewer roster is
synthetic-only. No clinical sign-off exists in this repository, before or after this feature ships.
`clinicalApprovers[]`/`approvedBy[]` remain schema-forced empty (`maxItems: 0`). ARC/council/`rf`/
any agent output is structurally ineligible to populate any reviewer or approver field, and this
feature does not weaken that structural rejection. The `sign` verb signs `synthetic: true` records
only, with an ephemeral, in-memory `TESTKEY-`-prefixed key that is discarded the instant the call
returns. Nothing in this feature clears any of gates G0–G4.

---

## 15. Revision History

- **Revision 1 (2026-07-22): applied 10 adversarial-review findings.** Respecified the `sign`
  lifecycle onto a staged-draft contract (FR-25, F1); reconciled ADR-0004's conditional-adjudication
  rule against `lib/adjudication.mjs` as a governance-sensitive change (FR-26, F2); widened the
  `validate` cache to a persistent, composite-keyed, fail-closed store (FR-8/FR-9, F3); renamed the
  terminal all-real state to the non-authorizing `acts-complete-unauthorized` (FR-29, F4); added a
  default `--subject`↔content-hash comparison with an `--allow-historical-subject` escape (FR-3, F5);
  grounded the shared derived-state extraction in one structured `{state, nextExpectedRole,
  eligibility, blockers[]}` result (FR-2, F6); added independence-preserving redaction to
  status/queue/render projections (FR-27, F7); gave `status` an explicit fail-closed `invalid` state
  (FR-28, F8); froze exact CLI command signatures across the flow (F9); and constrained new tests to
  the existing non-recursive discovery globs (FR-20, F10).

---

**Progress Tracking:** See `.claude/progress/clinical-review-workflow/` once the implementation
plan is authored.
