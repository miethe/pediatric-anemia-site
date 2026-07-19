---
title: "AOS asset index for the Pediatric CDS Platform program"
description: "Skimmable index of Agentic OS capabilities (rf, ARC, IntentTree, op) this program can reach today, what they have and haven't delivered, and when to use each during and after development."
audience: [platform-engineering, clinical-governance, evidence-governance, validation]
tags: [pediatric-cds, aos, research-foundry, arc, intenttree, governance]
created: 2026-07-19
updated: 2026-07-19
status: reference
---

# AOS asset index for the Pediatric CDS Platform program

## What this is

An index, not a design doc. It lists what the personal Agentic OS (`rf` / Research Foundry, ARC /
`agentic-research`, IntentTree, `op`) already provides to this program, with exact invocations, and
states honestly what each has and hasn't delivered. **The linked handoff docs are canonical for
depth** — this page exists so a future session doesn't have to re-read all of them to get oriented,
and doesn't have to re-derive facts that are already recorded elsewhere:

- `docs/project_plans/expansion/rf-handoff/README.md` and `rf-handoff/RESULTS.md` — Research Foundry.
- `docs/project_plans/expansion/03-arc-clinical-council-handoff.md` — the ARC pediatric council.
- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` — the Evidence Foundry
  design that eventually converts `rf` bundles into KB content.

## Capability table

| System | How invoked | Status | Where documented |
|---|---|---|---|
| `rf` evidence pipeline (capture→triage→plan→ingest→extract→claim-map→synthesize→verify→bundle) | `rf capture` / `rf triage` / `rf plan` / `rf ingest` / `rf extract` / `rf claim-map` / `rf synthesize` / `rf verify` / `rf bundle` | Shipped | `rf-handoff/README.md` |
| `rf` HTTP API on the agentic node | `GET http://10.42.10.76:7432/health`; `GET /api/runs` (Bearer `$RF_TOKEN_AGENT`) | Shipped, live | `rf-handoff/RESULTS.md` §2 |
| Shared evidence catalog (cross-run claim/source search) | `GET $RF_API_URL/api/catalog/search?q=...`; CLI `rf catalog` | Shipped | `rf-handoff/RESULTS.md` §2 |
| 7 pediatric evidence bundles (see below) | run data at `runs/<run_id>/evidence_bundle.yaml` | Shipped, verified | `rf-handoff/RESULTS.md` §1 |
| `pediatric_cds` evidence-card convention (population/assay/threshold+UCUM/lifecycle/classification) | driver `research-foundry/.claude/workflows/rf-pediatric-cds-run-execute.js` (modes `clinical`\|`regulatory`\|`backfill`) | Partial — driver-script convention, not a core `rf` schema | `rf-handoff/RESULTS.md` §3 |
| Exact-passage locator on every material claim | same 7 bundles; cross-model gpt-5.6 fidelity audit fixed 3 gaps | Shipped for the 7 existing runs; not yet a universal hard gate | `rf-handoff/RESULTS.md` §4 |
| Governed URL/PDF extraction adapter | `rf` core (RFUP-2) | Shipped | `rf` CHANGELOG |
| Exact-passage hard-gating inside `rf verify` | `rf` core (RFUP-3) | Shipped | `rf` CHANGELOG |
| Stable `rf` schema versioning | `rf` core (RFUP-4) | Shipped | `rf` CHANGELOG |
| `rf council` result normalization (approve/concern/block) | `rf council` CLI (RFUP-5) | Shipped | `rf --help` |
| Run immutability / lineage guarantee | `rf` core (RFUP-7) | Shipped | `rf` CHANGELOG |
| Native live-discovery model adapters (Claude SDK, GPT Researcher, PaperQA2, opencode, LiteLLM, `arc_council`) | `rf swarm run` | **Deferred, 0/6 live** (RFUP-6) | `rf-handoff/README.md` |
| Writeback approve & dispatch (governed write to MeatyWiki/SkillMeat/CCDash) | `POST $RF_API_URL/api/runs/{run_id}/writeback/approve` | Shipped | `rf` CHANGELOG |
| Reusable assertion ledger | `rf assertion backfill` | Shipped, default-off | `rf` CHANGELOG |
| Pediatric clinical evidence review council (8 voting seats + 2 non-voting) | `pediatric-anemia-clinical-review-council@0.1.0`, pinned `agentic-research@72ab6f69...` | Shipped (repository-ready) | `03-arc-clinical-council-handoff.md` |
| Evidence-source manifest for the council (15 sources, digest-bound) | `knowledge-packs/pediatric-anemia/source-manifest.yaml`, SHA-256 `f4c33c82...` | Shipped | `03-arc-clinical-council-handoff.md` |
| ARC run scaffold/validate CLI | `uv run arc run --spec <path> --dry-run`; `uv run arc validate runs/<dir> --json` | Shipped, local only | `03-arc-clinical-council-handoff.md` |
| Completed synthetic readiness audit of the whole program | `runs/2026-07-19-pediatric-expansion-arc-readiness/` | Shipped, **explicitly non-qualifying** | `03-arc-clinical-council-handoff.md` |
| Qualifying (SDK-dispatched) ARC runtime pilot | — | **Not built** | `03-arc-clinical-council-handoff.md` |
| AOS `op council` identifier-only correlation bridge | `op council` (pin `OP_HOME`) | Shipped, local-only commit `99d7ee03...`, not on `origin/main` | `03-arc-clinical-council-handoff.md` |
| IntentTree task graph for this program | `itt tree get/graph tree_01KXQ7WC1HQE2GKZSCNDVXA9G7` | Shipped, live, **known stale** (see below) | this doc, §Caveat |
| `council-review` skill (populate an ARC run skeleton) | `Skill(council-review)` | Shipped, invocable now | `03-arc-clinical-council-handoff.md` |
| MeatyWiki metadata-only adapter for ARC evidence manifests | — | Not built | ARC CHANGELOG |
| Portal structured authoring for clinical RunSpecs | `web/` Portal (general Portal/SAM machinery exists; clinical round-trip does not) | Not built for clinical fields | ARC Adoption plan P6 |

## What is already delivered

**7 verified `rf` evidence bundles**, all `rf verify` exit 0 / 0 unsupported: RF-EV-001 (48 claims,
exact-passage backfill for 6 anemia sources), REG-001 (89 claims, FDA non-device CDS intended-use
memo), RF-CBC-001 and RF-CBC-002 (87/88 claims, CBC evidence), RF-KID-001 (87 claims, pediatric
kidney/renal evidence), RF-GRO-002 (92 claims, growth-standard evidence), REG-004 (85 claims, HIPAA
mapping). 576 claims total across 78 source cards. Full counts: `rf-handoff/RESULTS.md` §1.

**These are claims, not rules.** Nothing in this repo converts a verified `rf` bundle into
`modules/<id>/*.json` content yet. That conversion is the `rf`-bundle → KB-pack converter
(IntentTree work items `EF-WP0`/`EF-WP1`), and it has not started. Until it runs, the 7 bundles are
research inputs sitting outside the module package tree, not evidence records the engine reads.

## What is NOT delivered

- **RF-EV-002** (CALIPER/Bohn 2023 pediatric CBC reference intervals) and **REG-002** (content-rights
  / licensing review for reused guideline tables) — neither has been run. They do not appear in the
  7-bundle `RESULTS.md` table. Treat both as open research gaps, not completed work.
- **ARC qualifying runtime pilot: `false`.** The completed readiness audit
  (`arc-run-2026-07-19-pediatric-expansion-arc-readiness`) is a synthetic, non-qualifying review, not
  a clean exact-tree SDK-dispatched pilot.
- **Credentialed clinical review: `not_executed_owner_held`.** No named, credentialed human has
  approved anything. Same status applies to local-laboratory-director and legal/regulatory review of
  REG-001/REG-004.
- **Native live-discovery adapters: 0/6 installed** (RFUP-6, deferred). All 7 bundles were produced by
  the Path-B swarm pattern (Claude discovery subagents → deterministic `rf` tail), not native adapters.

## During development: when to reach for what

| Situation | Reach for | Why |
|---|---|---|
| A clinical/evidence question needs sourcing | Check the catalog **first**: `GET $RF_API_URL/api/catalog/search?q=...` | A verified claim may already exist; don't re-research it. Launch a new `rf` run only if the catalog search comes up empty. |
| Adversarial critique of a design, architecture, or non-clinical artifact | `council-review` skill | General-purpose ARC review mechanism, invocable today. |
| Review of a non-patient CDS artifact (evidence pack, rule set, dangerous-miss spec) against the pediatric clinical council | The ARC scaffold → populate → validate → read-scorecard sequence in `03-arc-clinical-council-handoff.md` | No single CLI verb exists; skipping a step (especially "read the real verdict," not just `arc validate`) risks mistaking an empty-scores skeleton for a pass. |
| Tracking multi-phase work | IntentTree (`itt tree get` / `itt today`) | Verify node status against git log and `rf-handoff/RESULTS.md` first — see the staleness caveat below. |
| Any non-trivial idea worth a durable run record | `op` | Classifies route × tier and dispatches to the right subsystem instead of freehanding it. |

## Once operational: recurring cadences

- **Evidence surveillance.** Each evidence record's `surveillanceQuery` field is meant to be re-run
  **monthly** via scheduled `rf` runs against named authorities, with **quarterly human review** and
  an **immediate** triggered run on retraction, correction, safety notice, or guideline supersession.
  Not built yet (Evidence Foundry `EF-WP3`, not started) — the mechanism is the same pipeline already
  proven on the 7 bundles, only scheduling/parameterization remains.
- **Re-review on digest change.** The ARC handoff is explicit: "an approval or audit attached to an
  older digest is stale." Any material change to a target/evidence-manifest/council/policy/reviewer
  requires a fresh `arc run` against the new digest — not a reuse of a prior verdict.
- **KB re-signing.** Every content change to a KB pack produces a **new** signed manifest; the active
  version is never rewritten in place. This mirrors the repo's own "no AI-published rule changes...
  signed release" guardrail.
- **Council re-approval per release candidate.** Council review is not a one-time gate — it reruns
  against the exact digest of each new KB manifest, not against the original module.
- **IntentTree hygiene.** Update node status whenever `rf`/git state changes (a merged PR, a newly
  verified `rf` run) so the tracker doesn't drift further from reality than it already has.

## Honesty boundaries

- **ARC review is not credentialed clinical sign-off.** The pediatric council's readiness audit is a
  synthetic, non-qualifying review. It can author hazards, dissent, and validation plans; it cannot
  authorize a clinical release.
- **`rf` bundles are not validated clinical content.** A verified `rf` run means *internally
  consistent and passage-traceable* — every claim ties to a locatable source passage and `rf verify`
  passed structurally. It does not mean *clinically correct*, current, or reviewed by a clinician.
- **`clinicalApprovers[]` / `approvedBy[]` require real named humans.** Populating either field from
  ARC output, or treating a verified `rf` bundle as satisfying a clinical-approval gate, would
  manufacture false assurance. Build these fields structurally ready for a real credentialed identity;
  leave them empty until one exists.

## Caveat: IntentTree drift

IntentTree node status for this program is **known stale**. Merged P0 work
(`ff4b519` — module package contract) and all 7 verified `rf` runs still show `not_started` in
`itt tree get tree_01KXQ7WC1HQE2GKZSCNDVXA9G7`. Verify any node's status against `git log` and
`docs/project_plans/expansion/rf-handoff/RESULTS.md` before trusting it, especially for P0/P1/EF/RF/REG
nodes.
