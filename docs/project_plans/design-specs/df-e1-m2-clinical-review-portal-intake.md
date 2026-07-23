---
schema_version: 2
doc_type: design_spec
title: "DF-E1-M2 (finish pass): Portal Intake of This Pass's rule-proposals.json, unresolved.json Carry-Forward, and Committed semantic-diff.json"
status: draft
maturity: idea
created: '2026-07-23'
updated: '2026-07-23'
feature_slug: "multi-bundle-conversion-e1-finish"
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1-finish.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1-finish.md
adr_refs:
  - docs/adr/0004-clinical-approval-identity-adjudication.md
related_documents:
  - docs/project_plans/design-specs/clinical-review-portal-intake-e1-artifacts.md
  - docs/project_plans/design-specs/clinical-review-portal-workflow.md
problem_statement: "This pass produced two artifact types the prior pass's clinical-review-portal-intake-e1-artifacts.md (DF-E1-M2) does not cover -- a live, empty, per-module rule-proposals.json now reachable through propose for all 4 modules, and a committed, per-module semantic-diff.json for the 3 non-cbc modules -- while leaving the prior pass's named conflict objects and unresolved.json entries entirely untouched (byte-identical). No portal, reviewer roster, or review-state model exists yet to receive any of it (ADR-0004 still status: proposed)."
open_questions: []
explored_alternatives: []
---

# DF-E1-M2 (finish pass): Portal Intake of This Pass's `rule-proposals.json`, `unresolved.json` Carry-Forward, and Committed `semantic-diff.json`

## What this document is, and is not

This is an **idea-maturity sketch**, not a portal design and not a committed data contract — same
maturity gate as the prior pass's own DF-E1-M2 spec,
`docs/project_plans/design-specs/clinical-review-portal-intake-e1-artifacts.md`, and blocked on the
same two prerequisites that spec names: **ADR-0004
(`docs/adr/0004-clinical-approval-identity-adjudication.md`, `status: proposed`) accepted**, and
**named credentialed reviewer roles**. Neither exists. Nothing here builds, schedules, or authorizes
a portal, a reviewer roster, or a review-state model.

**This document does not re-derive or duplicate the prior spec's content.** That document already
inventories the four artifact types this program's converter batch produces (named conflict
objects, deferred/unrouted claim entries, candidate scaffolds, in-evidence `conflictsWith[]`
annotations) as of the prior pass, and describes the intake-design sketch a future portal would need
for each. This document's scope is narrower and additive: **what changed, artifact-inventory-wise,
between the prior pass and this one**, and what a portal's intake layer would additionally need to
handle for the two new artifact surfaces this pass actually exercised live for the first time
(`rule-proposals.json` reachable for all 4 modules; `semantic-diff.json` committed for 3 of them).

## What did NOT change (carried forward unmodified from the prior spec's inventory)

Per this pass's own byte-identity invariants (`tests/ef-p4-t7*.test.mjs`,
`tests/ef-p4-t8-honesty-ac.test.mjs`), every artifact the prior DF-E1-M2 spec inventoried is
**unchanged**:

- The 2 named conflict objects (`kidney-proteinuria-nephrotic-cutoff-pediatric-vs-adult-001`,
  `conflict_who_vs_cdc_growth_standard`) — same files, same content, byte-identical.
- `modules/kidney_suite_v1/unresolved.json` (83 entries: 82 claim + 1 conflict) and
  `modules/growth_suite_v1/unresolved.json` (90 entries: 89 claim + 1 conflict) — same shape-drift
  the prior spec already flagged (`entryKind`/`disposition`/`relatedConflictId` for kidney vs.
  `kind`/`conflictRef` for growth) remains present and unresolved by this pass.
- Zero candidate scaffolds exist anywhere in the repo, same as the prior pass — this pass's
  `authoring-decisions.yaml` scaffolds (P3-T2) are a different artifact type (decision records, not
  candidate scaffolds) and do not change this count.

A future portal's intake layer can treat all of the above exactly as the prior DF-E1-M2 spec already
describes; this document adds nothing to that part of the picture.

## What DID change: two artifact surfaces this pass exercised live for the first time

### 1. `rule-proposals.json` — now live-reachable for all 4 modules, still inert for 3

Before this pass, `propose.mjs` halted at `inspect` with `DecisionsNotFoundError` for
`anemia`/`kidney_suite_v1`/`growth_suite_v1` — it never reached the point of writing
`rule-proposals.json` for them at all. This pass's Phase 1 (fail-closed emission gate) + Phase 2
(module-generic drafting substrate) + Phase 3 (non-approving decision scaffolds) + Phase 4 (live
4-of-4 `batch` run) together mean `propose` now reaches and writes `rule-proposals.json` for **every**
module — but the file's content differs starkly by module:

| Module | `rule-proposals.json` (staged, `build/kb-pack/<id>/0.1.0-proposal/`, gitignored) |
|---|---|
| `cbc_suite_v1` | Non-empty — 4 rule proposals drafted from the module's `approved_for_rule_draft` decisions |
| `anemia` | `{"schemaVersion":"1.0","moduleId":"anemia","rfProvenance":null,"proposals":[]}` — inert, empty, present |
| `kidney_suite_v1` | Same inert-empty shape, `moduleId: "kidney_suite_v1"` |
| `growth_suite_v1` | Same inert-empty shape, `moduleId: "growth_suite_v1"` |

**A future portal's intake layer needs to distinguish "the file exists and is empty because this
module has zero approved decisions" from "the file is missing/absent."** Per FR-F11's binding
resolution (this pass's PRD), an empty-but-present `rule-proposals.json` is deliberate and testable
(`proposals.length === 0 && moduleId === <target>`), never an accidental omission — a portal that
treats "empty" and "absent" identically would lose that signal. **None of these 3 modules' empty
`rule-proposals.json` files are committed anywhere in `modules/**` — they exist only as ephemeral,
gitignored `build/kb-pack/` staging output, regenerated fresh on each `propose` run.** A portal
intending to surface this state durably would need to either re-run `propose` on demand or have some
other durable record of "this module's last `propose` run produced zero proposals," since the
staging file itself is not committed and not guaranteed to persist between runs.

### 2. `semantic-diff.json` — now committed, per non-cbc module, for the first time

Unlike `rule-proposals.json`, `modules/{anemia,kidney_suite_v1,growth_suite_v1}/semantic-diff.json`
**are** committed, durable, on-disk artifacts as of this pass (P4-T5). Each records an
`added`/`removed`/`changed` comparison of that module's evidence-assertions.json against itself
through `propose`'s verbatim-copy behavior — all three are currently `0`/`0`/`0` (empty by
construction; see `docs/architecture.md` §2a and
`docs/project_plans/design-specs/df-e1-m3-anemia-reconciliation.md` for the full "instrumented, not
resolved" framing this document does not repeat).

**A future portal's intake layer would need to surface this artifact honestly, not as a clean
bill of health.** A naive portal view showing "0 added / 0 removed / 0 changed" next to a green
checkmark would misrepresent what this file currently proves — it is a structurally-guaranteed-empty
self-comparison, not an independent verification that the module's evidence layer is unchanged from
some external source of truth. Any future portal surfacing `semantic-diff.json` per module should
carry the same caveat this pass's documentation carries: this diff would become meaningful the day a
module's evidence projection stops being a verbatim copy, and is not itself evidence of anything
beyond "the converter carried the committed file through unchanged" today.

## Design sketch: additive intake requirements (idea-level, non-binding)

Building on, not replacing, the prior spec's own 5-point sketch ("Ingest by artifact type," "Surface
provenance as a first-class column," etc.):

1. **A "reachability" column distinct from "rule-bearing."** Before this pass, "does this module
   reach `propose`" and "does this module emit rules" were the same question for 3 of 4 modules
   (both no). After this pass they diverge: all 4 modules reach `propose`'s emission gate, but only
   `cbc_suite_v1` emits non-empty `rule-proposals.json`. A portal's module-status view should track
   these as two independent booleans, not one.
2. **Staged-vs-committed provenance tagging, extended.** The prior spec's provenance column
   (converter-derived vs. hand-derived-projection) still applies, but this pass adds a third
   distinction within "converter-derived": whether an artifact is committed (`semantic-diff.json`,
   durable) or staged-only (`rule-proposals.json` for the 3 empty cases, ephemeral, regenerated per
   run, never committed). A reviewer trusting a committed artifact is trusting something that
   persists and is re-verifiable from git history; a reviewer looking at a staged artifact is
   looking at a snapshot from whenever `propose` was last run.
3. **`semantic-diff.json`'s "instrumented, not resolved" caveat as a required portal annotation.**
   Per the honesty framing above, any portal surface displaying a module's semantic-diff result
   should render the caveat, not just the numeric counts — a bare "0/0/0" without context invites
   exactly the overstatement this program's guardrails exist to prevent.

## What this document does not decide

- Does not design a concrete portal schema for either new artifact surface.
- Does not resolve the prior spec's still-open questions (field-name normalization between kidney's
  and growth's `unresolved.json`, candidate-scaffold schema location, etc.) — those remain exactly as
  open as the prior spec left them.
- Does not authorize building any portal, reviewer roster, or review-state model.

## Promotion trigger

Same as the prior pass's spec: promote toward `maturity: shaping`/`committed` only after ADR-0004 is
accepted and named credentialed reviewer roles exist — this document does not shorten or bypass that
trigger.

## Cross-references

- `docs/project_plans/design-specs/clinical-review-portal-intake-e1-artifacts.md` — the prior pass's
  full artifact inventory and intake-design sketch; this document is additive to it, not a
  replacement.
- `docs/project_plans/design-specs/clinical-review-portal-workflow.md` (`DF-E1-01`) — the review-state
  machine and role vocabulary neither this document nor the prior one re-derives.
- `docs/adr/0004-clinical-approval-identity-adjudication.md` — `status: proposed`; both this
  document's and the prior spec's shared promotion prerequisite.
- `docs/architecture.md` §2a and
  `docs/project_plans/design-specs/df-e1-m3-anemia-reconciliation.md` — the full "instrumented, not
  resolved" semantic-diff framing this document references rather than restates.
- `modules/{anemia,kidney_suite_v1,growth_suite_v1}/semantic-diff.json` — the concrete, committed
  artifacts this document's §2 is written against.
- `build/kb-pack/{anemia,kidney_suite_v1,growth_suite_v1}/0.1.0-proposal/rule-proposals.json` — the
  staged, gitignored, empty-but-present artifacts this document's §1 is written against (regenerate
  via `node cli.mjs propose` per `tools/rf-bundle-to-kb-pack/README.md` to reproduce).
