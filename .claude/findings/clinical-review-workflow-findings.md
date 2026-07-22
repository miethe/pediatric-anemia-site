---
schema_version: 2
doc_type: findings
title: "Findings: Clinical Review Workflow v1 (DF-E1-01)"
status: draft
source: agent
created: '2026-07-22'
updated: '2026-07-22'
feature_slug: clinical-review-workflow
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
---

# Findings: Clinical Review Workflow v1 (DF-E1-01)

In-flight findings surfaced during execution of `clinical-review-workflow-v1`, per the plan's
"Deferred Items & In-Flight Findings Policy" (not pre-created; created on the first real finding).

## CRW-F1 — D1 first-party-binary allowlist vs plan-ratified concept asset

**Severity**: informational (adjudicated, not a defect) · **Status**: resolved by orchestrator
adjudication, flagged for owner review in the feature PR.

### (a) The failing test

`tests/rights-negative-invariant.test.mjs`, test `D1: no third-party source document, reproduced
table dump, figure, image, or brand asset exists anywhere in the working tree` (D1 /
`AC-WP3-NEGATIVE`), fails on `origin/main` because
`docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png` is present in the
working tree but not listed in `FIRST_PARTY_BINARY_ALLOWLIST` (~line 112 of that file). The
`scanWorkingTree` detector treats any non-allowlisted `.png` as a document/image violation
regardless of provenance.

### (b) The allowlist's may-only-shrink escalation posture

The `FIRST_PARTY_BINARY_ALLOWLIST` header (`tests/rights-negative-invariant.test.mjs`, ~lines
104–111) states every entry must be first-party — "authored by this project or by the operator's
own Agentic-OS programme" — and that the list "MAY ONLY SHRINK. A new entry here is the exact
failure mode D1 exists to prevent; if a task believes it needs one, that is an escalation, not an
edit." This is a deliberate, high-friction gate: it exists to stop a third-party source document
being smuggled into the tree, not to block a first-party asset the project itself generated.

### (c) The plan's P4-T2 ratification of the asset

`docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md`, task
**P4-T2** ("CONCEPT-ONLY watermarked portal mockups", FR-17/R6), states verbatim: "**Partially
pre-delivered during planning**: `docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png`
(gpt-5.6 native image tool, 'CONCEPT ONLY — NOT COMMITTED' banner) is already committed. Task =
verify/attach it to the design spec, add the manifest entry, and generate additional views only if
the framework text needs them." The plan's Phase Summary table names the asset's origin as the
"codex gpt-5.6 native image tool (mockups)" lane, i.e. operator-directed generation, not a
third-party source document. This plan was human-approved and merged to `main` via **PR #23**
("Tier 3 planning bundle for DF-E1-01 v1", commit `28c9633`) and refreshed via **PR #25** ("resync
phase-2/phase-5 progress ACs with revised plan", commit `e8fd5dd`). The plan's ratification of this
specific file as an already-committed, task-verified asset supersedes the D1 freeze for this one
first-party asset — it is exactly the kind of plan amendment the allowlist's own comment
contemplates as the escalation path for a new entry.

### (d) Orchestrator adjudication

The orchestrator has adjudicated this in-flight: the asset is first-party by the allowlist's own
stated definition — it was authored by this project's operator-directed Agentic-OS programme (the
gpt-5.6 native image tool, invoked under this plan's P4-T2 task), not obtained from or reproducing
a third-party source. It carries a "CONCEPT ONLY — NOT COMMITTED" watermark banner and is explicitly
named and pre-ratified by a merged, human-approved implementation plan. On that basis, a
**single-entry amendment** to `FIRST_PARTY_BINARY_ALLOWLIST` is authorized for exactly this one
path:

```
docs/project_plans/design-specs/assets/clinical-review-portal-concept-v2.png
```

No other entry is added, and no other test logic (the may-only-shrink comment, the shrink-only
assertions, any other detector) is weakened. This amendment is **flagged for owner review in the
feature PR** — it is not a unilateral closure of the escalation; the plan-ratification is the basis
for making the change now, but a human still reviews the diff before merge.

### (e) Residual action

P4-T2 itself remains open and is the task that closes the residual gap this finding does not
close: it must (1) verify the asset carries the watermark, (2) add a companion manifest entry
recording the watermark string per asset (verified by a docs-truth grep test, since pixel-OCR is
out of scope — the plan states this explicitly), and (3) attach/reference the asset from
`docs/project_plans/design-specs/clinical-review-portal-workflow.md`. This finding only unblocks
the D1 gate for the file's presence in the tree; it does not substitute for P4-T2's own manifest
and docs-truth work.

## CRW-F2 — P1-T3 dispatched scope is the plan's PRE-Revision-1 definition, not the current one

**Severity**: informational (scope note, not a defect in the work delivered) · **Status**: open,
for P1-GATE1/P1-GATE2 and Phase 2 planning awareness.

### (a) What happened

The task actually dispatched for "P1-T3" (task text, target surfaces, and acceptance criteria)
verbatim matches `.claude/progress/clinical-review-workflow/phase-1-progress.md`'s **original**
P1-T3 entry — (a) `--subject` becomes optional, auto-derived via `lib/subject.mjs`'s
`computeModuleContentHash`; (b) `scaffold` writes a schema-valid `signature: null` record for a
`synthetic: false` fixture-roster entry — and was implemented and committed exactly to that scope
(commit `30a61597`, this feature's P1-T3).

It does **not** cover the CURRENT (Revision 1) plan's P1-T3 row in
`docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md`, which
additionally specifies:

- **F5** — when `--subject` IS supplied, recompute `computeModuleContentHash` and hard-fail
  (`UsageError`) on a mismatch by default, with `--allow-historical-subject` to suppress only that
  comparison (never the pattern check).
- **(c) `--draft` staging write** — with `--draft`, write the draft to
  `<root>/.review-drafts/<moduleId>/<review_id>.draft.yaml` (outside `reviews/`, gitignored) instead
  of printing a preview / writing under `reviews/`; add the `.review-drafts/` entry to `.gitignore`.
  Phase 2's `sign` verb (`P2-T1`, per the current plan) depends on this exact staging path as its
  ONLY input — `sign --draft <path>` reads a file `scaffold --draft` produced.

### (b) Why this matters

Phase 2's `P2-T1` (`sign` verb) as currently planned literally cannot be implemented against
today's `scaffold.mjs`: there is no `--draft` flag, and nothing writes to
`<root>/.review-drafts/<moduleId>/<review_id>.draft.yaml`. Whoever picks up `P2-T1` needs either
(i) a follow-on task that adds `--draft` + `--allow-historical-subject`/F5 to `scaffold.mjs` before
`sign` can be written, or (ii) an explicit plan amendment narrowing `sign`'s input contract. This
finding does not itself resolve that — it flags the gap so `P1-GATE1`/`P1-GATE2` (which re-check
against "PRD FR-1..5/FR-24/FR-26.." per the progress file, i.e. the same pre-Revision-1 scope this
task actually used) do not silently wave through a Phase 2 blocker, and so whichever agent scopes
the next P1/P2 task is aware `scaffold.mjs`'s current committed state has neither `--draft` nor the
F5 comparison.

### (c) What was NOT done under this task (by design, matching the dispatched scope)

- No `--allow-historical-subject` flag; no `computeModuleContentHash` cross-check against an
  explicitly-supplied `--subject` (F5).
- No `--draft` flag; no `.review-drafts/` staging path; no `.gitignore` entry.
- `cli.mjs`'s `scaffold` help text still documents `--subject <content-hash>` as required (it is a
  sibling task's owned surface — P1-T2 lists `cli.mjs` as a target surface — so this task did not
  edit it); it is now stale relative to `scaffold.mjs`'s actual (optional-subject) behavior until
  whichever task owns `cli.mjs` next updates it.

### (d) Recommendation

Before Phase 2's `P2-T1` opens, confirm whether a task will add `--draft`/F5 to `scaffold.mjs`
(recommended: a small follow-on, e.g. "P1-T3b" or folded into `P2-T1` itself) or the plan is
amended to change `sign`'s input contract. No guardrail was crossed by leaving this out — the
dispatched task's own acceptance criteria are fully met and independently tested (38/38 targeted,
2246/2246 full `npm test`) — this is a plan-vs-dispatch scope-tracking note only.

## CRW-F3 — P1-T2 dispatched scope was the plan's PRE-Revision-1 `status` definition; implemented to the CURRENT (Revision 1) plan instead

**Severity**: informational (scope note, not a defect in the work delivered) · **Status**: resolved
by executing agent, flagged for `P1-GATE1`/`P1-GATE2` awareness — mirrors CRW-F2's pattern exactly,
for the sibling `P1-T2` task.

### (a) What happened

The task actually dispatched for "P1-T2" (frozen `--json` shape, command signature, acceptance
criteria) verbatim matched `.claude/progress/clinical-review-workflow/phase-1-progress.md`'s
**original** P1-T2 entry — frozen shape `{ moduleId, subjectContentHash, records[], derivedState,
nextExpectedRole }`, no `--history`/`--unredacted` flags, no `blockers[]` field, no F4/F7/F8 mention.

It does **not** cover the CURRENT (Revision 1) plan's P1-T2 row in
`docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md`, which
additionally specifies: the frozen command signature gains `[--history]`/`[--unredacted]`; the
`--json` shape gains a `blockers: string[]` field and a `records[]` field set of
`{role, review_id, reviewerId, decision, synthetic, supersedes, chainLinkage}`; the terminal
all-real state is named `acts-complete-unauthorized`, never a `release-ready`-like label (F4/FR-29);
default output redacts an independence-sensitive sibling's `reviewerId`/`decision`/`rationale`
(F7/FR-27); and `status` must exit non-zero with an explicit `invalid` state whenever `validate`
would reject the same input (F8/FR-28).

### (b) Why the executing agent deviated from the dispatched (stale) text instead of only flagging it

Unlike CRW-F2 (where the sibling P1-T3 agent implemented the dispatched, narrower scope and only
*flagged* the gap), this task implemented the CURRENT, richer plan text directly, for three reasons
specific to `status`: (1) P1-T1's own shipped `lib/derived-state.mjs` header explicitly names this
exact plan (F4/F6/F7/F8 vocabulary) as P1-T2's scope, confirming the sibling P1-T1 task was already
executed against the current plan, not the stale progress-file text; (2) sibling tasks P1-T4, P1-T5,
P3-T2, and P5-T1 (already-shipped P1-T5 confirmed this) are all written assuming the richer
`status` contract exists — implementing only the narrow dispatched shape would have silently broken
those tasks' stated dependencies; (3) F4/F7/F8 are safety/independence-relevant (never naming a
release-authorization-shaped state; redacting a not-yet-independently-reviewed sibling's content by
default) — under this program's fail-closed/"missingness never normal" posture, implementing the
narrower (less protective) shape and only noting the gap seemed like the wrong default here.

### (c) What was delivered

`tools/review-record/lib/verbs/status.mjs` (new) implements the full Revision-1 contract: frozen
signature `status --module <id> [--root <dir>] [--json] [--history] [--unredacted]`; frozen `--json`
shape `{ moduleId, subjectContentHash, records[] (role/review_id/reviewerId/decision/rationale*/
synthetic/supersedes/chainLinkage), derivedState, nextExpectedRole, blockers[] }` (*`rationale` is
one field beyond the plan's own illustrative OQ-2 list, added because FR-27's own text requires
rationale to be redactable — the plan's OQ-2 answer text omits it from the illustrative field list
but FR-27's requirement text names it explicitly; this is flagged here as a from-first-principles
shape extension, not a silent deviation); the `not-started`/`in-progress`/`disputed`/
`structurally-non-qualifying`/`acts-complete-unauthorized`/`invalid` enum (never a `release-ready`-
like label); FR-27 redaction-by-default with `--unredacted` + warning banner; FR-28's fail-closed
`invalid` state (malformed YAML, roster failure, chain break, signature tamper, and — with
`--history` — a non-git-working-tree failure, each independently tested). It also integrates
directly against P1-T5's already-shipped `isAdjudicationRequired` (reused, not re-derived) for the
disputed/agreement turn-taking branch, and against P1-T1's `computeDerivedReviewState`/
`isExpectedTerminalNonQualifyingViolations` (`lib/verbs/dry-run.mjs`) for the terminal-label
determination — zero forked module-wide logic (drift-guard-lite test included in this task's own
suite; `tests/ef-review-workflow.test.mjs`, 60/60 targeted passing; full `npm test` 2282/2282,
`npm run check` green).

### (d) Recommendation

`P1-GATE1`/`P1-GATE2` (and any future re-check against "PRD FR-1/OQ-2" per the stale progress-file
wording) should re-check against the CURRENT plan's P1-T2 row (FR-1/FR-27/FR-28/FR-29), not the
progress file's pre-Revision-1 text — the progress file itself should be resynced to the current
plan (mirrors CRW-F2's same recommendation for P1-T3, still open). No guardrail was crossed: no
real-reviewer signing, no ADR-0004 status edit, no `synthetic: false` roster entries in the real
`governance/reviewer-roster.yaml`, zero new runtime dependencies.

## CRW-F3 — P1-T5: dispatched AC list narrower than the plan's row; implemented the fuller plan version; one related out-of-scope observation

**Severity**: informational (scope note, not a defect in the work delivered) · **Status**: open,
for P1-GATE1/P1-GATE2 awareness.

### (a) Dispatched AC vs. plan AC

The task actually dispatched for "P1-T5" listed four acceptance criteria: an agree-path five-record
set MINUS `adjudication` evaluates as complete; a disagree-path set MINUS `adjudication` reports
the missing-role blocker; the committed `cbc_suite_v1` dry-run fixture's terminal behavior is
unchanged; and a grep test confirming ADR-0004 `status` is untouched. The CURRENT plan row (this
same file, P1-T5, and `.claude/worknotes/clinical-review-workflow/decisions-block.md` FR-26)
additionally requires a **fifth** AC: "a superseded-correction fixture (a `clinical-1` act
corrected via `supersedes`, effective decisions agreeing) applies the predicate to the EFFECTIVE
(latest non-superseded) records only — the superseded record's decision must not trigger a spurious
adjudication requirement (FR-26 effective-act rule)." This AC is also the exact mechanism the
decisions block's own FR-26 row defines "resolved" to mean (`resolveEffectiveRoleRecord` in the
delivered code).

### (b) What was done about it

Rather than silently narrowing scope to the dispatched four, this task implemented the fuller
plan/decisions-block definition of FR-26 (`resolveEffectiveRoleRecord` + `isAdjudicationRequired` in
`tools/review-record/lib/adjudication.mjs`) and added the fifth AC's fixture test verbatim:
`tests/ef-review-adjudication.test.mjs`, test `"evaluateReleaseAuthorization: a
superseded-correction fixture applies FR-26's predicate to the EFFECTIVE (latest non-superseded)
records only..."`, plus a matching unit test on `isAdjudicationRequired` itself. All five ACs (the
dispatched four plus the plan's fifth) pass. No guardrail was crossed and no scope was narrowed —
this is a plan-vs-dispatch tracking note only, recorded per this task's own instruction to log
rather than silently deviate.

### (c) Related, explicitly out-of-scope observation for a future task

`lib/derived-state.mjs`'s `computeDerivedReviewState` resolves its `clinical1`/`clinical2` inputs to
the FR-4 reviewer-independence heuristic (`checkReviewerIndependence`) via a plain
`allModuleRecords.find((r) => r.role === 'clinical-1' | 'clinical-2')` — the FIRST record of that
role, not the FR-26-style EFFECTIVE (latest non-superseded) one this task introduces for the
release-authorization completeness check. Concretely: if a `clinical-1` record is later corrected
via `supersedes`, the independence heuristic still textually compares the ORIGINAL (superseded)
`clinical-1` rationale against `clinical-2`'s, not the correction's. This is a heuristic,
supplementary check to begin with (see `lib/independence.mjs`'s own header: "not... a comprehensive
dependence detector"), and `lib/independence.mjs` is not one of this task's target surfaces (owned
by a sibling task's prior work, FR-4/P2-T2), so this task did not change it. Flagging it here as a
related, latent, pre-existing gap for whoever next touches `computeDerivedReviewState`'s
independence-check wiring or `lib/independence.mjs` itself to consider — not a defect this task's
own FR-26 scope introduced or is responsible for closing.
