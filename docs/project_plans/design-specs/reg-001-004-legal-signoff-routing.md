---
schema_version: 2
doc_type: design_spec
title: "E1 Multi-Bundle Conversion: REG-001/REG-004 Legal Sign-off Routing"
status: draft
maturity: idea
category: policy
created: 2026-07-22
updated: 2026-07-22
feature_slug: "multi-bundle-conversion-e1"
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
problem_statement: >-
  There is no recorded procedure for how a legal reviewer's sign-off on the REG-001/REG-004
  regulatory memos — if and when one is ever given — would be captured, verified, and acted upon
  by this program's engineering trackers, so that lifting the existing HOLD is deliberate and
  auditable rather than an ad hoc judgment call by whichever agent or engineer notices a status
  change.
open_questions:
  - "Who is the qualified legal reviewer of record, and where (external ticketing system,
     `rf-handoff` doc, IntentTree) is that identity itself recorded?"
  - "Does a sign-off apply per-run (REG-001 only, REG-004 only) or must both be cleared together
     before either may be used, given they were commissioned as a pair (P0 map + P3 scope)?"
  - "What evidentiary artifact constitutes 'affirmative, recorded' sign-off — a signed memo, an
     email, a ticket state transition, a countersigned form — and who verifies its authenticity
     before an engineering trigger fires?"
explored_alternatives: []
---

# E1 Multi-Bundle Conversion: REG-001/REG-004 Legal Sign-off Routing (DF-EXT-M1)

## 1. What this document is — and is not

This is a **design spec at `maturity: idea`** for Deferred Item `DF-EXT-M1` ("`REG-001`/`REG-004`
legal sign-off routing", target increment **External (legal/owner)** — see the Deferred Items
table in `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md` §"Deferred Items").
It sketches how a legal sign-off, **once obtained**, would be routed into this program's trackers
so the existing HOLD is lifted deliberately and auditably. It is exploratory, not a committed
design: no implementation is authorized by this spec, and no target date is set, because the
triggering event (a qualified legal reviewer's decision) is entirely outside engineering's control.

**This document does not, and cannot, constitute or predict a legal sign-off.** It does not
perform legal review, does not render a legal opinion, and does not change the status of either
run. It is a routing sketch for engineering process, authored by an engineering documentation
pass, about an action that belongs entirely to the repository owner and whatever legal reviewer
the owner engages.

**Binding statement, repeated for anyone who reads only this section: obtaining legal sign-off
for `REG-001`/`REG-004` is an owner/legal-team action. It is not engineering work this repository,
this program, or any agent operating in it can perform, schedule, or substitute for.** No amount
of `rf verify` re-running, converter engineering, ARC/council review, or documentation authoring
changes that. See §5 below for the full non-substitution list.

## 2. Cross-references (what this spec is anchored to)

- **`docs/legal/reg-001-reg-004-hold.md`** (authored P6-T1, this same feature) is the binding HOLD
  record. It documents both runs' current status (`not_executed_owner_held`), the five-point
  exclusion (no fixture / no converter invocation / no module artifact / no clinical-drafting
  pathway / no upstream reads), and states in its own §5 ("What would lift this HOLD") that only
  an affirmative, recorded legal sign-off changes that posture — and names this document, by this
  same path, as "the forward-looking routing document for how that sign-off, once obtained, would
  be recorded and acted upon." This spec is written to satisfy that forward reference.
- **`docs/project_plans/expansion/rf-handoff/RESULTS.md` §5** ("⚠️ Legal review required — REG-001
  & REG-004") is the primary source of truth for both runs' status. It states both runs are
  "research input only — flagged for legal review; not legal advice," that their reports "carry
  the legal-review banner and frame all interpretive conclusions as inference/speculation/
  pending-review," that reviewers must "not act on them as legal positioning until a qualified
  reviewer signs off," and records: "Status remains `not_executed_owner_held` as of 2026-07-19 —
  no owner legal sign-off is recorded anywhere in this program's trackers." As of this spec's
  authoring date (2026-07-22), that remains true.
- **`docs/project_plans/expansion/rf-handoff/RESULTS.md` §7** ("Next steps (owner)") lists, as
  item 2, "route REG-001 + REG-004 memos to legal review" — an **owner** action item, open, with
  no completion date set.
- **`docs/project_plans/expansion/rf-handoff/README.md` §2** carries both runs' registered
  identity: `REG-001` = `rf_run_20260717_reg_001_pediatric_cds_map_the` (P0 gate); `REG-004` =
  `rf_run_20260717_reg_004_pediatric_cds_scope_the` (P3 gate).
- **PRD requirements**: `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md`
  FR-4 and FR-19 (the requirements the HOLD record satisfies) and the Deferred Items table entry
  for `DF-EXT-M1` this spec exists to stub out per FR-24.
- **Conversion status of the program's other artifacts**, for anyone reading this spec out of
  context: of the 4 clinical bundles this feature carries through `tools/rf-bundle-to-kb-pack/`,
  **only `rf-cbc-002` → `cbc_suite_v1` completes an end-to-end converter conversion** (`inspect` →
  `verify` → `propose`, per FR-14 module scoping). `rf-ev-001` → `anemia`, `rf-kid-001` →
  `kidney_suite_v1`, and `rf-gro-002` → `growth_suite_v1` carry **bespoke, standalone evidence
  projections** (not converter `propose` output) pending Deferred Item `DF-E1-M1`. `REG-001` and
  `REG-004` are categorically outside all of this: they are the program's only regulatory · LEGAL
  runs, are excluded from every fixture/converter/clinical-drafting pathway by the HOLD record, and
  are not evidence input to any module, converted or projected, clinical or otherwise.

## 3. Why this needs a routing procedure at all

A "sign-off happened, go ahead" moment is exactly the kind of quiet status change most likely to
be mis-recorded, mis-attributed, or acted on prematurely, for the same structural reasons this
program's CLAUDE.md already calls out for the ARC clinical council: a review artifact is not
automatically a credentialed decision, and there is a real difference between *someone said it's
fine* and *the record shows a named, qualified person signed off, on this specific content, on
this date, and that record is where an engineer would actually look*. Without a routing procedure:

- An engineer could reasonably (and wrongly) treat an informal verbal or Slack-style "legal's
  fine with it" as sufficient to lift the HOLD.
- A future agent, re-reading `rf-handoff/RESULTS.md` §5 or the HOLD record, would have no
  single place to check for a status change short of re-reading every tracker by hand.
- The HOLD record's own five-point exclusion (§4 of `reg-001-reg-004-hold.md`) has no defined
  *reversal* procedure — only a description of what must never happen while the HOLD is in force.

This spec exists to close that gap at the design-sketch level, not to close it operationally —
closing it operationally requires the sign-off to first exist, which is outside this repository's
control.

## 4. Sketch: what a recorded sign-off would need to look like

At `maturity: idea`, this is a sketch of the shape the routing would take, not a committed
mechanism. A future pass (a proper design/shaping-maturity spec, or a PRD amendment) would need to
resolve the open questions in this file's frontmatter before any of the below is implemented.

1. **Sign-off record, not sign-off announcement.** Per-run (or per-pair, if OQ-2 below resolves
   that both runs must clear together), a durable record naming: the qualified legal reviewer, the
   date, the specific run(s) covered (`REG-001` and/or `REG-004` by their registered `run_id`s),
   and the scope of what was cleared (e.g., "cleared for use as CDS-module evidence input" vs. a
   narrower clearance). This record would need to live somewhere durable and discoverable —
   candidates include a new `docs/legal/` artifact analogous to the HOLD record itself, an
   IntentTree node/finding, or an Operator run gate; this spec does not choose among them (see
   OQ-3).
2. **HOLD record update, not silent removal.** `docs/legal/reg-001-reg-004-hold.md` would be
   updated in place to reflect the lifted status for whichever run(s) are cleared — never deleted,
   since the record of the HOLD having existed and why is itself part of the audit trail. Its §5
   ("What would lift this HOLD") already anticipates this.
3. **Engineering re-enablement is a separate, later, engineering task.** Even after a sign-off
   record exists, using either run's content as CDS-module evidence input is new engineering work
   — extending `tools/rf-bundle-to-kb-pack/lib/batch.mjs`'s `BATCH_PAIRS` list, generating a
   fixture, running the converter or a bespoke projection, and passing every existing quality gate
   (schema validation, `npm run check`, evidence-linkage checks) exactly as `rf-cbc-002`,
   `rf-kid-001`, and `rf-gro-002` did in this feature's earlier phases. A sign-off record lifts the
   *exclusion*; it does not itself produce a module artifact.
4. **Regression test update.** `tests/ef-batch-reg-exclusion.test.mjs` currently asserts zero
   references to either run anywhere in `tests/fixtures/**`, `modules/**`, or `build/kb-pack/**`.
   That test would need a deliberate, reviewed edit — not a silent removal — once (and only once)
   a sign-off record for the corresponding run exists, so the test continues to fail loudly against
   any future attempt to use the *other* run before its own sign-off lands.

## 5. Binding restatement — no substitute for legal sign-off

Consistent with `docs/legal/reg-001-reg-004-hold.md` §5, none of the following — alone or in
combination — constitutes or substitutes for the legal sign-off this routing sketch describes:

- An `rf verify` pass (structural/governance check only, per `rf-handoff/RESULTS.md` §6).
- ARC or any council review of either run's content.
- Any engineering re-run, re-derivation, or re-summarization of either memo.
- This design spec, or any future revision of it.
- Any status change made by an agent, automated workflow, or Operator run without a named,
  qualified legal reviewer's affirmative decision behind it.

**Obtaining that sign-off is the repository owner's and the legal team's action, external to this
program's engineering scope, with no engineering-controllable timeline.** Until it is affirmatively
recorded, `docs/legal/reg-001-reg-004-hold.md`'s five-point exclusion remains in force without
exception, and this spec's §4 sketch remains unimplemented.

## 6. Non-goals of this spec

- Does not attempt legal review, legal analysis, or any interpretation of `REG-001`/`REG-004`'s
  substantive content.
- Does not select a durable-record mechanism (OQ-3) or resolve whether sign-off is per-run or
  per-pair (OQ-2) — both are left open pending an owner decision.
- Does not authorize any change to `tools/rf-bundle-to-kb-pack/lib/batch.mjs`,
  `tests/ef-batch-reg-exclusion.test.mjs`, or any `modules/**` content. Any such change remains
  blocked by the HOLD record until a sign-off record exists.
- Does not set a deadline or trigger a reminder cadence; the triggering event is entirely
  owner/legal-team-controlled.
