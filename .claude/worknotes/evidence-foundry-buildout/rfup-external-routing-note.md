# RFUP — consolidated external-routing note (DF-EXT-01)

**Author**: documentation-writer (P7-T13) · **Date**: 2026-07-21
**Feature slug**: `evidence-foundry-buildout`
**Deferred-items triage row**: `DF-EXT-01` (category `policy`) in
`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`
("Deferred Items Triage Table")
**Source docs**: `docs/project_plans/expansion/rf-handoff/README.md` §6 ("Not rf runs — the rf
*project* enhancement handoff (RFUP)"); `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md`
§6.2 (gap register) and §8.3 (platform risks); IntentTree work-area node
`node_01KXRTYKKW9ECTF9MCBQ8JV1EB` ("RFUP").

**This is not a design spec.** Per the parent plan's explicit instruction (decisions block §1, "External
(not tasks here)"; DF-EXT-01's "Target Spec Path" cell), the 7 items below get **one consolidated
routing note**, not 7 individual `docs/project_plans/design-specs/*.md` stubs, and this path is
**not** appended to `deferred_items_spec_refs` — that frontmatter field lists design-spec paths only
(exactly 10, from `DF-E1-01..07` / `DF-E2-01..03`).

## Why these are external, not implementation tasks here

`rf-handoff/README.md` §6 states plainly: these seven enhancements are needed in the **`rf` project
itself** — the `research-foundry` repository under `agentic_meta_dev` — not in this repository
(`pediatric-anemia-site`) and not as `rf` *runs*. They are filed as IntentTree work-area **`RFUP`**
(`node_01KXRTYKKW9ECTF9MCBQ8JV1EB`) and are routed upstream as `op story` submissions / feature
requests into the `rf` project, per the CLAUDE.md "Agentic Node" / `op` routing convention. No
Evidence Foundry buildout task — E0, the pre-E1 ADRs, or this Phase 7 closure — implements any of
them; the `rf-bundle-to-kb-pack` converter and `cbc_suite_v1` vertical slice were built to work
correctly against the `rf` capabilities that exist **today**, treating every item below as an
external dependency, not a blocker.

## The 7 RFUP enhancements

1. **Parameterize the Path-B workflow.** `rf-run-execute.js`'s RF/repo/TMP paths and run-date stamp
   are currently machine-specific and frozen (`02` §6.2 gap-register row "Path-B hard-coded
   paths/stamp"). Needed before Path-B can run unattended/scheduled (blocks E1's CBC 12-angle
   operation and any E2 surveillance cadence, not E0's seeded fixture path).

2. **A governed URL/PDF extraction adapter.** `rf` core's source-card service has no bundled PDF
   text extractor, so known URLs can degrade to locator-only (`02` §6.2 row "URL/PDF extraction can
   degrade"). Needed to reliably produce full-text renditions with precise locators at scale, rather
   than relying on curated local source renditions as E0 does.

3. **Upstream exact-passage hard-gating.** `rf verify` validates claims/source cards and warns on
   missing locators but does not hard-gate clinical passage precision for `threshold`-kind assertions
   (`02` §6.2 row "Exact passage not universally hard-gated"; §3.7's converter-eligibility rule is
   enforced downstream in this repo's converter only, per DF-E1-03's design spec at
   `docs/project_plans/design-specs/upstream-rf-validators-pediatric.md`). Blocks release-ready rules
   upstream of the converter, not a research-only bundle.

4. **Stable schema versioning + machine-contract.** `rf`'s evidence-card/claim schemas can add or
   change fields without a versioned contract the converter can check against (`02` §8.3 platform
   risk "Upstream schema drift" — "`rf` adds/changes fields and converter misreads them"). Needed so
   a downstream converter can validate the schema version and fail closed on unknown required
   semantics, instead of silently misreading a drifted bundle.

5. **Council result normalization.** `rf`'s ARC/council writeback can degrade to offline stubs
   locally, and council approval is a distinct governance gate from CDS clinical review (`02` §6.2
   row "IntentTree/ARC offline stubs"; §5.3 "Council and clinical governance are different gates";
   §8.4 risk "Unclear role authority" — "Council approval confused with clinical release"). Needed so
   a normalized, machine-readable council result can be consumed without a downstream system
   mistaking it for clinical sign-off.

6. **Native adapter install/eval.** 0 of 6 native swarm adapters (`claude_agent_sdk`,
   `gpt_researcher`, `paperqa2`, `opencode`, `litellm_router`, `arc_council`) are installed or
   evaluated (`02` §6.2 row "0/6 live adapters"). Needed before `rf swarm run` can be presented as
   real automated discovery rather than a degraded/hand-seeded path; installation is gated on a
   value/security evaluation this repository does not perform.

7. **Run-immutability/lineage.** An upstream `rf` run's bundle bytes are not currently guaranteed
   immutable after authoring begins (`02` §8.3 platform risk "Mutable upstream run" — "Bundle bytes
   change after authoring begins"). Needed so a downstream converter (or this repo's own
   `tools/rf-bundle-to-kb-pack/` hashing step) can trust that a `run_id` always resolves to the same
   bytes; today the converter's own input-hashing (P2-T3) is the only mitigation, and it operates
   entirely on this repo's side of the seam.

## Disposition

None of the 7 items above is implemented, scheduled, or scoped as a task in this repository or in
this plan. Each is tracked exclusively via the IntentTree `RFUP` work area
(`node_01KXRTYKKW9ECTF9MCBQ8JV1EB`) and reaches the `research-foundry` repository, if and when
prioritized, through an `op story` submission — never through a PR against
`pediatric-anemia-site`. Should any item land upstream, the corresponding gap-register row in
`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §6.2 is the place to record
that it closed; this note is not updated in place (it is a point-in-time routing record, not a live
tracker).
