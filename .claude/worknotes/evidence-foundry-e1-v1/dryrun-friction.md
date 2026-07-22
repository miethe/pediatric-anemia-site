# P2-T8 dry-run friction observations

**Status**: observations only. This note is the first evidence feed for PRD OQ-8 ("Portal friction
trigger — what measurable friction threshold promotes DF-E1-01, and who calls it?"), per FR-11's own
requirement that the synthetic dry-run "emit the first friction observations." **It makes no
recommendation about whether, when, or how to build a review portal** — that threshold call is an
explicit human decision (OQ-8: "TBD, human decision, post-dry-run"), not this plan's and not this
task's to make. Nothing below should be read as advocating for DF-E1-01's promotion.

**Source**: exercising `tools/review-record`'s file-plus-CLI primitives (`scaffold`, `lib/signature.mjs`'s
`signRecordDryRun`, `validate`) end to end while building `dry-run` (P2-T8) — one full five-role pass
over the real `cbc_suite_v1` proposal. `dry-run` itself composes all of the steps below into a single
command; the observations are about the underlying MECHANICS that a human following the equivalent
by-hand workflow (`scaffold` → attach a signature → write the file → `validate`, repeated per role)
would encounter, not about `dry-run`'s own one-shot convenience.

## Observations

1. **`scaffold` cannot, by itself, produce a file for the only identity kind that currently exists.**
   Every `reviewerId` `governance/reviewer-roster.yaml` can currently resolve is `synthetic: true`
   (FR-3: the roster ships empty of real entries pre-G1), and `schemas/review-record.schema.json`
   requires a populated `TESTKEY-` signature on every `synthetic: true` record. `scaffold` owns no
   signing capability by design (see `lib/verbs/scaffold.mjs`'s own header) — so today, running
   `scaffold` prints a "DRAFT ONLY — NOT WRITTEN TO DISK" preview rather than creating a file. A human
   following the CLI's own `--help` text literally would reasonably expect a file to appear after a
   successful `scaffold` invocation with valid flags; a second step (signing) is required before
   anything lands on disk, and nothing in `scaffold`'s own output names which command performs that
   step (there is no `sign` verb exposed on this CLI at all — signing composition currently lives
   only inside `dry-run`, an E1-scoped, synthetic-only shortcut, not a general-purpose signing tool).

2. **The five roles must share one `subjectContentHash` value, computed and carried by hand across
   five separate invocations.** `scaffold --subject <hash>` takes the value as a flag, not something
   it derives — a human authoring five records for one proposal must compute (or be handed) the same
   hash once and paste it identically into five separate command lines. A single transposed
   character in any one of the five would not fail loudly at entry time (the flag only has to match
   `sha256:<64 hex>` shape) — it would only surface later, as a `release-authorization is not valid —
   incomplete record set` finding once someone finally runs `validate` and notices the mismatched
   record was silently excluded from its intended subject's set.

3. **`validate`'s module-wide checks (chain, reviewer-2 independence, authorship-union, release-
   authorization) all re-run over the WHOLE module's record set on every invocation, not just the
   newest record.** This is correct and intentional (chain integrity, for one, is not a per-record
   property) but means a human iterating role-by-role re-pays the same authorship-union git-history
   computation (`lib/adjudication.mjs`'s `computeAuthorshipUnion`, two `git log` invocations) on every
   single `validate` call, five times over one dry-run pass, rather than once. For `cbc_suite_v1`
   today this is fast; the cost model changes if a module's `authoring-decisions.yaml` history grows
   long enough for `git log --follow` to become noticeably slow.

4. **The terminal "structurally non-qualifying" state needs its own explanation to not read as a
   bug.** After all five records are committed, `validate` — correctly, by design (FR-6) — rejects
   the `release-auth` record: "a release-auth record is valid only over a ... NON-synthetic record
   set," and this entire set is `synthetic: true`. A human who just watched four consecutive clean
   `validate` passes, then sees the fifth throw `ValidationFailedError`, has no way to tell from that
   error alone whether they made a mistake or reached the intended, structural, by-design end state —
   `dry-run`'s own final stdout message exists specifically to close that gap (see
   `lib/verbs/dry-run.mjs`'s `isExpectedTerminalNonQualifyingViolations`), but a human running the
   five steps by hand via `scaffold`/`validate` alone would not see that framing anywhere.

5. **Nothing surfaces cross-record state (which roles are already committed, whose turn is next) other
   than manually running `list` or re-deriving it from `ls modules/<id>/reviews/`.** `list --module
   <id>` does report per-module state, but a human coordinating five separate review acts — plausibly
   five separate people once real (non-synthetic) reviewers exist post-G1 — has no notification, queue,
   or "your turn" signal; each participant has to know to run `list` (or be told) to find out whether
   they are next.

## What this note does NOT claim

- It does not measure REAL reviewer friction — every observation above comes from one automated,
  single-session dry-run pass by a tool-building agent, not from an independent human reviewer using
  the workflow for the first time. Per this plan's own stated assumption: "no claim about reviewer
  usability is made until real reviewers exist (that evidence feeds OQ-8)."
- It does not propose a friction threshold, a portal design, or a promotion decision for DF-E1-01.
  That call belongs to OQ-8's named human decision-maker, informed by this note plus whatever
  observations accumulate once real (non-synthetic, post-G1) reviewers exist.
- It is not a defect report against `tools/review-record` — every behavior described above is the
  tool working exactly as designed (FR-3/FR-6/FR-9's fail-closed, append-only, non-synthetic-only
  posture); "friction" here means "manual-coordination cost of the current files-plus-CLI shape,"
  not "something is broken."
