---
doc_type: design_spec
title: "Rights Release Gate"
status: draft
maturity: idea
created: 2026-07-21
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
---

# Rights Release Gate (DEF-R2)

## Problem / Context

The Research Foundry Rights Governance Spec v1.0's §20.2 describes a **hard release gate**: a
build/release step that blocks on rights clearance. Per D7 of this feature ("coverage gates only,
never clearance gates"), adopting §20.2 as specified would brick this repository's build today —
every seeded `rights_record.overall_status` is `UNKNOWN` and no clearance exists anywhere in the
project, so a gate that blocks on "is this cleared?" would block on everything, permanently, with
no path forward until a rights owner exists (DEF-R1, OQ-2).

`scripts/validate-rights.mjs` (EP-R0) ships four gates instead, and each is deliberately
**coverage- or consistency-shaped**: they check that a rights record exists and cross-links
correctly, never *which* clearance value it holds. A record at `overall_status: UNKNOWN` passes
every shipped gate exactly as one at `PROHIBITED` would (verified by
`tests/rights-gate-failsclosed.test.mjs`-class fixtures). §20.2's actual clearance-blocking
behavior is explicitly out of scope for this feature and is deferred here.

## Current State (what EP-R0 actually shipped)

- `scripts/validate-rights.mjs` GATES: `missing-assessment-coverage`,
  `blocking-status-enum-membership`, `open-failure-presence`, `release-context-containment` — none
  reads `overall_status` (or any other clearance-shaped field) to decide pass/fail on its *value*.
- `rights/rights-failures.json` entries carry a `release_gate` field (`BLOCK` / other enum members
  per `schemas/rights/rights_failure.schema.json`) — the field exists and is enum-validated
  (membership only, D7), but nothing in the current build pipeline reads it to actually block a
  release. It is data captured for a future consumer, not yet a live gate.
- No release/build step in this repository currently consults rights status at all beyond the four
  coverage/consistency gates above.

## Design Sketch

At an idea-stage level, a real release gate would need to:

1. **Define what "release" means for this gate.** Candidates: `npm run build` (too early — most
   development iteration runs this), a distinct `npm run check:release` step (there is prior art:
   `tests/kb-diff.test.mjs` already references a `check:release` concept for KB semantic-diff
   gating), or a deploy-time check outside `npm run check` entirely.
2. **Consume `rights_failure.release_gate` for real**, once DEF-R1's clearance workflow exists to
   populate meaningful values — reading `BLOCK` entries and failing the release step if any remain
   `open` and tied to content actually shipping in that release.
3. **Scope by what is actually shipping**, not by the whole rights tree — a gate that blocks a
   release because an *unrelated* source's rights record is still `UNKNOWN` would over-block; the
   gate needs to resolve which `rights_record`s the shipping KB content actually depends on (via
   `rights/rights-ledger.json`) before deciding relevance.
4. **Stay a positive, testable proof, not a values judgment left to a script.** Per D7, the gate's
   job is to correctly *apply* a clearance decision a human already made (DEF-R1) — never to make
   or infer one itself.

None of this is committed. Building this before DEF-R1 lands would have nothing real to gate on.

## Promotion Trigger

DEF-R1 (rights clearance workflow) resolved **and** a non-trivial number of `rights_record`s carry
a real clearance status (not `UNKNOWN`).

## Open Questions

- Is the gate a new `npm run` script wired into `check:release` (analogous to the KB semantic-diff
  gate), a CI-only step, or a deploy-pipeline check outside this repo's `npm run check` composition
  entirely?
- How does the gate resolve "what is shipping" — the full KB, or a diff against the previously
  released manifest (the signed-KB-manifest track, `docs/project_plans/design-specs/signed-kb-manifest.md`,
  is a plausible dependency here)?
- Does a single `open` + `release_gate: BLOCK` rights_failure block the whole release, or only the
  specific module/rule(s) it's cross-linked to (partial release)?
- Should this gate ever be *advisory* (warns, doesn't block) during a transition period while DEF-R1
  is still ramping up, or does it start hard from day one?
