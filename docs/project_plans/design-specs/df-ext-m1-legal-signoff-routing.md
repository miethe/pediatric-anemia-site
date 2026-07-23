---
schema_version: 2
doc_type: design_spec
title: "DF-EXT-M1: Legal Sign-off Routing for the 35 P0-Backfilled Sources and All Pre-Existing UNKNOWN-Status Sources"
status: draft
maturity: idea
category: policy
created: '2026-07-23'
updated: '2026-07-23'
feature_slug: "multi-bundle-conversion-e1-finish"
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
related_documents:
  - docs/project_plans/design-specs/reg-001-004-legal-signoff-routing.md
problem_statement: "This pass's Phase 0 minted 35 new rights-records.json entries at overall_status: UNKNOWN / review_status: agent_triage_only for 35 sources across cbc_suite_v1/kidney_suite_v1/growth_suite_v1 (SPIKE-009 Leg B gate-recovery). Combined with 15 pre-existing UNKNOWN-status records from earlier passes, 50 of this repository's rights records today carry no human or counsel-reviewed rights determination at all -- and no documented mechanism exists for routing any of them to one."
open_questions:
  - "Who is the qualified rights/legal reviewer of record for a CDS-evidence-source license/access-basis determination (distinct from the REG-001/REG-004 regulatory-memo sign-off the sibling spec covers), and where is that identity recorded?"
  - "Does routing proceed per-source (50 individual decision briefs) or per-module batch (cbc_suite_v1's 12, kidney_suite_v1's 12, growth_suite_v1's 11 backfilled this pass, plus each module's pre-existing UNKNOWN entries), given scripts/rights/build-decision-brief.mjs already operates per-item?"
  - "What evidentiary artifact constitutes a recorded rights determination for a source (a completed decision brief with a named reviewer's disposition, a signed license record, a ticket state transition), and how does it get written back into rights-records.json/rights-ledger.json without an agent asserting the determination itself?"
explored_alternatives: []
---

# DF-EXT-M1: Legal Sign-off Routing for the 35 P0-Backfilled Sources and All Pre-Existing `UNKNOWN`-Status Sources

## What this document is, and is not

This is a **design spec at `maturity: idea`** for Deferred Item `DF-EXT-M1`, target increment
**External (legal/owner)** — named in this feature's own PRD Deferred Items table
(`docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md`, row `DF-EXT-M1`).
It sketches **only the routing mechanism** — how a rights/legal reviewer's determination for a
source, once obtained, would be captured, verified, and written back into this repository's rights
records so the transition off `UNKNOWN` is deliberate and auditable. **It does not make, imply, or
approximate any rights determination itself, for any of the 50 sources it discusses.** No source's
`overall_status` changes because of this document; no license/access-basis judgment is offered,
suggested, or hinted at for any specific source, anywhere in this document.

**Binding statement, repeated for anyone who reads only this section: determining any source's
license/access-basis status is an owner/legal-team action. It is not engineering work this
repository, this program, or any agent operating in it can perform, schedule, or substitute for.**
No amount of `build-decision-brief.mjs` output, ARC/council review, or documentation authoring
changes that. See §5 below for the full non-substitution list.

This document is the **sibling**, not the successor or replacement, of
`docs/project_plans/design-specs/reg-001-004-legal-signoff-routing.md` (`DF-EXT-M1` from a prior
context, covering the `REG-001`/`REG-004` **regulatory memo** legal-review HOLD). That document
routes a different, narrower thing: sign-off on two specific `rf` runs' regulatory content, entirely
excluded from every clinical pathway. **This document routes something structurally different: the
rights/licensing status of 50 CDS-**evidence** sources already feeding (or scaffolded to feed) live
clinical modules** — a distinct legal question (copyright/license/access-basis on a source), not a
regulatory-content review. The two documents share a routing *pattern* (a sign-off record, once
obtained, updates a durable status and is never inferred or substituted for) but resolve different
underlying questions. This document does not duplicate that spec's REG-001/REG-004-specific content.

## Problem / Context

### What this pass minted (Phase 0, gate recovery, SPIKE-009 Leg B)

This feature's own Phase 0 minted 35 new entries in `rights/rights-records.json`
(`RR-<sourceId>`-keyed, marker `assessed_by_agent: "multi-bundle-conversion-e1-finish-p0"`) plus
matching join rows in `rights/rights-ledger.json`, covering 35 sources across `cbc_suite_v1` (12),
`kidney_suite_v1` (12), and `growth_suite_v1` (11) that the new rights schema
(`schemas/evidence.schema.json`, from `main`'s prior PR #20) requires `license`/`access_basis`/
`terms`/`terms_snapshot` for, but which had none. Every one of the 35 was minted honestly at
`overall_status: "UNKNOWN"`, `review.review_status: "agent_triage_only"`,
`review.human_reviewer: null`, `review.counsel_reviewer: null` — a triage placeholder, never a
determination, per this pass's own FR-F2 (PRD) and CLAUDE.md's "no invented thresholds" / rights-
governance guardrails.

### The fuller picture: 50 sources total, not just this pass's 35

Verified directly against `rights/rights-records.json` (50 total records, all at
`overall_status: "UNKNOWN"`):

| `assessed_by_agent` marker | Count | Origin |
|---|---:|---|
| `multi-bundle-conversion-e1-finish-p0` | 35 | This pass's Phase 0 backfill |
| `cbc-suite-v1-rights-metadata-backfill` | 8 | Pre-existing (earlier pass) |
| `epr0-t4-triage-seed` | 6 | Pre-existing (earlier pass) |
| `epr1-t1-reference-ranges-rights-record` | 1 | Pre-existing (earlier pass) |
| **Total** | **50** | |

**Every one of these 50 records — this pass's 35 plus 15 pre-existing — carries no human or counsel
rights determination today.** This document's scope, per its title and this feature's PRD row
`DF-EXT-M1`, is deliberately the full 50, not only this pass's 35 — routing a mechanism for "the
sources this pass touched" while leaving the other 15 without a documented path would recreate the
exact gap this spec exists to close, just for a smaller set.

### Why this was not, and could not be, resolved by this pass

`license` and `access_basis` are legal determinations about a third-party source's rights posture;
`terms`/`terms_snapshot` require the actual terms text. None of these are mechanically derivable
from the source fixtures this program already holds — this is the same reasoning the prior pass's
own findings doc recorded when a full merge to `main` was blocked on exactly this gap (35 sources,
PR #20's new schema fields, no migration/backfill script shipped). Fabricating any of the 50
sources' determinations would be the same guardrail breach CLAUDE.md's "No AI-published rule
changes" exists to prevent, applied to rights governance rather than clinical rules — and is
precisely what `scripts/rights/build-decision-brief.mjs` (already committed, already the intended
tool) exists to route toward a human, not to substitute for.

## Cross-references (what this spec is anchored to)

- **`scripts/rights/build-decision-brief.mjs`** — the existing, committed tool this spec routes
  toward. Per item (`--item <evidence-item-id>`) or binding (`--binding <entityId> --entity-type
  <rule|candidate>`), it assembles a decision-ready brief — independently-worded atoms, structured
  locators, the item's scope/population, and the recorded rights position *as recorded, never
  asserted, inferred, or upgraded* — so a human spends their scarce review minutes on a summary, not
  raw JSON. This document does not modify that tool or its output shape; it sketches how its output
  would be routed to, and its result routed back from, a human rights reviewer at scale (50 sources,
  not one item at a time).
- **`rights/rights-records.json`** / **`rights/rights-ledger.json`** — the durable records this
  routing mechanism would eventually update, never bypass or hand-edit outside the documented
  workflow.
- **`schemas/evidence.schema.json`** (from `main` PR #20) — the schema whose `license`/
  `access_basis`/`terms`/`terms_snapshot` fields these 50 records currently leave `UNKNOWN`.
- **`docs/project_plans/design-specs/reg-001-004-legal-signoff-routing.md`** — the sibling spec for
  the categorically different REG-001/REG-004 regulatory-memo sign-off; shares this document's
  routing *pattern*, not its subject matter.
- This feature's PRD (`multi-bundle-conversion-e1-finish.md`), FR-F2 (the 35-record honest-triage
  requirement this spec routes onward from) and the `DF-EXT-M1` Deferred Items table row.

## Why this needs a routing procedure at all

Fifty records sitting at `UNKNOWN` is not itself dangerous — it is the honest, gate-passing state
CLAUDE.md's rights-honesty posture requires. The danger this spec's routing procedure exists to
prevent is a **quiet, undocumented status change**: a future engineer or agent, under time pressure,
manually flipping one or more of the 50 records' `overall_status` away from `UNKNOWN` without a
recorded, verifiable legal determination behind the change — exactly the failure mode
`review.assessed_by_agent`/`review_status: "agent_triage_only"` markers exist to make visible and
preventable today. Without a routing procedure:

- An engineer could reasonably (and wrongly) treat a partial answer — e.g., "legal looked at 10 of
  the 50 and said they're fine" — as license to update all 50, or to update the 10 without recording
  which 10 or on what authority.
- A future agent re-running `scripts/validate-rights.mjs` or `build-decision-brief.mjs` would have no
  single place to check "has anything changed since the last triage" short of diffing all 50 records
  by hand.
- There is no defined mapping from "a legal reviewer's decision brief output" to "a written-back
  `rights-records.json` update" — the brief generator exists, but nothing describes what happens to
  its output next.

## Sketch: what a recorded rights determination, and its routing, would need to look like

At `maturity: idea`, this is a sketch only — none of the below is implemented or authorized here.

1. **Batch decision-brief generation, not ad hoc single-item runs.** A routing pass would run
   `build-decision-brief.mjs` (or a new batch wrapper around it — not designed here) over all 50
   `UNKNOWN` sources (or a deliberately scoped subset, per Open Question 2), producing one
   decision-ready brief per source for the human reviewer, rather than the reviewer working from raw
   `rights-records.json` JSON.
2. **A named reviewer, a recorded disposition, per source — not a blanket status.** Mirroring this
   program's own existing rights-record shape (`review.human_reviewer`, `review.counsel_reviewer`),
   a routing mechanism should require a named reviewer identity and an explicit disposition **per
   source**, never a single blanket "approved" applied to all 50 at once — 50 independent legal
   judgments should not collapse into one undifferentiated status flip.
3. **Write-back is a distinct, reviewed step — never a silent field edit.** Once a determination
   exists, updating `rights-records.json`/`rights-ledger.json` should itself be a reviewable,
   auditable act (e.g., a signed commit citing the specific decision brief and reviewer, or a
   dedicated ingestion script that refuses to write a non-`UNKNOWN` status without a matching
   recorded-determination artifact) — not an in-place manual JSON edit indistinguishable from any
   other file change.
4. **A regression gate analogous to this repository's existing rights-honesty invariants.**
   `tests/rights-negative-invariant.test.mjs` and `scripts/validate-rights.mjs` already assert
   `overall_status: "UNKNOWN"` is honestly represented; a routing mechanism should be held to an
   equivalent standard — e.g., a test asserting that no `overall_status` transitions away from
   `UNKNOWN` without a corresponding `review.human_reviewer`/`review.counsel_reviewer` no longer
   being `null`, so an accidental or unauthorized status flip fails loudly rather than passing
   silently.
5. **Interaction with `DF-EXT-M1`'s REG-001/REG-004 sibling.** Both routing mechanisms should
   probably converge on a similar durable-record shape (per the sibling spec's own Open Question 3,
   "candidates include a new `docs/legal/` artifact... an IntentTree node/finding, or an Operator run
   gate") — this document does not resolve that convergence, only flags it as a shared open question
   worth resolving once, not twice, if a future pass designs both routing mechanisms concretely.

## Binding restatement — no substitute for a legal rights determination

Consistent with the sibling spec's own §5, none of the following — alone or in combination —
constitutes or substitutes for a qualified legal/rights reviewer's affirmative determination on any
of the 50 sources:

- Running `scripts/rights/build-decision-brief.mjs` (it assembles a brief for a human to decide; it
  renders no determination itself).
- `scripts/validate-rights.mjs` passing (it validates that `UNKNOWN` is honestly represented — it
  does not, and cannot, validate the underlying rights facts).
- ARC or any council review of a source's content.
- Any engineering re-triage, re-summarization, or re-categorization of a source.
- This design spec, or any future revision of it.
- Any status change made by an agent, automated workflow, or Operator run without a named, qualified
  reviewer's affirmative decision behind it.

**Obtaining these 50 determinations is the repository owner's and their legal/rights reviewer's
action, external to this program's engineering scope, with no engineering-controllable timeline.**
Until affirmatively recorded per source, every one of the 50 records' `overall_status: "UNKNOWN"`
remains in force without exception, and this spec's routing sketch remains unimplemented.

## What this document does not decide

- Does not name the qualified reviewer(s) (Open Question 1).
- Does not decide per-source vs. per-module batching (Open Question 2).
- Does not select the durable write-back mechanism or its exact schema (Open Question 3).
- Does not authorize any change to `rights/rights-records.json`, `rights/rights-ledger.json`,
  `scripts/rights/build-decision-brief.mjs`, or `scripts/validate-rights.mjs`.
- Does not render, suggest, or imply any rights determination for any of the 50 sources.

## Cross-references

- `scripts/rights/build-decision-brief.mjs` — the existing tool this spec routes toward.
- `docs/project_plans/design-specs/reg-001-004-legal-signoff-routing.md` — the sibling routing spec
  for the categorically different REG-001/REG-004 regulatory-memo sign-off.
- `rights/rights-records.json`, `rights/rights-ledger.json` — the durable records this routing
  mechanism would eventually update.
- `schemas/evidence.schema.json` — the schema whose fields these 50 records currently leave
  `UNKNOWN`.
- This feature's PRD, FR-F2 and the `DF-EXT-M1` Deferred Items table row.
- `.claude/findings/multi-bundle-conversion-e1-finish-findings.md` — the P0 gate-recovery context
  this spec's "what this pass minted" section is drawn from.
