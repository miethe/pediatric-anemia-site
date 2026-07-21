# ADR-0008: Path-B Workflow Hardening vs. Native Adapter Installation

## Status

`proposed` — 2026-07-21. Not accepted. This ADR is one of the 8 pre-E1 ADRs required by
`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` (`02`) §8.5 item 8 before
E1 planning may begin; it does not authorize any implementation in this feature (`evidence-foundry-buildout-v1`).

## Context

E0 (this plan) ships the deterministic seed lane only: `RF-CBC-001`'s pre-verified bundle is
converted through `tools/rf-bundle-to-kb-pack/` with zero live discovery. E1 is the first increment
that needs a *resourced, repeatable* discovery lane to run the full 12-angle CBC research operation
(`02` §3.8) for the CBC Suite's remaining modules — `DF-E1-02` in this plan's deferred-items triage
table names exactly this gap. Before E1 can be planned, the platform needs a decided-not-open answer
to which discovery lane E1 builds on.

`02` §3.4 ("Discovery lane choices") lists four lanes and their current limitation:

| Lane | Current limitation (verbatim, `02` §3.4) |
|---|---|
| E0 deterministic seed lane | "Source acquisition/screening is human-seeded; PDFs without extracted text can degrade to locator-only cards." |
| Native `rf swarm run` | "Today 0/6 live adapters are installed, so this is not the module-1 discovery path." |
| Claude Path-B workflow (`.claude/workflows/rf-run-execute.js`) | "It is not an `rf` CLI verb; current workflow has hard-coded RF/repo/TMP/stamp paths that must be parameterized before production scheduling." |
| LAN API scaffold (`POST http://10.42.10.76:7432/api/runs`) | "Scaffolds capture→triage→plan only; it does not drive discovery or the deterministic spine." |

`02` §8.1's own recommended-default row for "Which adapter should be installed first?" already leans
toward Path-B first ("Stabilize/parameterize Path-B first because it is the proven live lane; install
one native discovery adapter only after measured gap"), but that row is a one-line summary. This ADR
is required to reconcile that summary against the actual `02` §6.2 gap register rather than merely
restating it, because the gap register carries the concrete engineering scope the summary elides:

- **"0/6 live adapters"** (`02` §6.2): "`claude_agent_sdk`, `gpt_researcher`, `paperqa2`, `opencode`,
  `litellm_router`, `arc_council` unavailable." Mitigation on file: "Use hand-seeded E0; use Path-B
  Claude workflow in E1; install adapters only after value/security evaluation." Blocks module #1?
  "No for E0; blocks native live discovery automation" — i.e., it blocks E1, not E0.
- **"Full web discovery outside core CLI"** (`02` §6.2): "Path-B `rf-run-execute.js` performs scouts
  and shells `rf`." Mitigation: "Treat as orchestrator, parameterize paths/date, record search
  queries/screening, preserve deterministic tail." Blocks module #1? "No for seeded module; yes for
  unattended E1 surveillance."
- **"Path-B hard-coded paths/stamp"** (`02` §6.2): "RF, repo, TMP, and date are machine-specific/
  frozen in current workflow." Mitigation: "Refactor to args/config and add run-date tests before
  production use." Blocks module #1? "No for E0; yes for scheduled E1/E2."
- **"Native swarm adapters unavailable"** (`02` §6.2): "`rf swarm run` would degrade with current
  adapter installation." Mitigation: "Do not present it as successful discovery; gate on `rf doctor`
  and source count/quality." Blocks module #1? "No for E0."

Read together, the gap register says something the §8.1 summary row does not spell out on its own:
Path-B is *already the live, human-verified lane behind the completed rf-handoff runs* (7/7 verified,
576 claims — per this feature's own decisions block §1 rationale), whereas every native adapter is at
0/6 installed with no measured evaluation on file. Hardening an already-working lane is a smaller,
better-understood unit of work than installing and securing a net-new adapter class. That asymmetry —
not just "Path-B first" as a preference — is the actual basis for this ADR's recommendation.

This ADR does not itself perform any hardening or adapter installation; `evidence-foundry-buildout-v1`
is scoped to E0 only (decisions block §1). It exists to make the E1-planning decision explicit and
reviewable now, while the E0 implementation is fresh, rather than leaving it as an unexamined one-line
preference for whoever plans E1.

## Decision

**Recommended default: harden Path-B first; do not install a native adapter in E1 planning's first
pass.** Treat `.claude/workflows/rf-run-execute.js` as the E1 discovery orchestrator, remediate its
three concretely-named gap-register defects (hard-coded RF/repo/TMP/stamp paths; unparameterized
scouts; no run-date tests), and defer native adapter installation until Path-B has run the full CBC
12-angle operation (`02` §3.8) at least once and a *measured* gap against it exists. This decision
stays `proposed`: it seeds the E1 plan's own scoping, it does not authorize E1 work under this
feature.

### Options considered

1. **Harden Path-B, defer native adapters (recommended default).**
   Parameterize `.claude/workflows/rf-run-execute.js`'s RF binary path, repo root, TMP directory, and
   date/stamp inputs as explicit config/args (per the gap register's own stated mitigation for
   "Path-B hard-coded paths/stamp"); add run-date and path-injection tests; keep search-query and
   screening-ledger records per-run (mitigation for "Full web discovery outside core CLI"); preserve
   the deterministic `rf` tail unchanged.
   - **Migration cost**: Small–Medium. No new adapter to evaluate, install, or security-review; the
     work is confined to one existing script plus its test harness. Rough order: 2-4 engineer-days
     (parameterization + tests), reusing the same deterministic spine (`extract`/`claim-map`/
     `synthesize`/`verify`) this plan already exercises end-to-end.
   - **Risk**: Path-B remains "not an `rf` CLI verb" (`02` §3.4) — it is a bespoke workflow runner,
     not a first-class `rf` capability, so its hardening does not reduce `rf`'s own adapter debt.
   - **Unblocks**: `DF-E1-02` (full CBC 12-angle live research operation) directly — Path-B is the
     only lane in the §3.4 table that supports "real web discovery with per-angle scouts" today.

2. **Install one native `rf` adapter first (e.g., `gpt_researcher` or `paperqa2`), defer Path-B
   hardening.**
   Bring one of the 0/6 unavailable adapters (`02` §6.2) to installed-and-configured status, then run
   `rf swarm run --adapters <adapter> --profile personal --execute` per `02` §3.4's native-lane row.
   - **Migration cost**: Medium–Large. Requires adapter provisioning/credentials, a security/value
     evaluation (the gap register's own mitigation: "install adapters only after value/security
     evaluation" — no such evaluation is on file for any of the 6), and new fixture/contract tests
     against a system this repo does not currently exercise at all. Unlike option 1, there is no
     existing working instance of this lane to harden — it starts from zero.
   - **Risk**: Repeats `02` §6.2's own explicit warning against "adapter false completeness" (a
     degraded swarm returning too few/locator-only sources must not be presented as successful
     discovery) — a first native adapter is more likely to hit this failure mode than the
     already-proven Path-B lane.
   - **Unblocks**: `DF-E1-02`, but with materially higher variance in delivery date and no measured
     evidence yet that any specific adapter clears the value/security bar.

3. **Harden Path-B and install a native adapter in the same E1 pass (dual-track).**
   - **Migration cost**: Large — sum of options 1 and 2, run concurrently, plus the additional
     integration cost of deciding which lane's output wins when both are live for the same module.
   - **Risk**: Violates this plan's own risk register concern (`decisions-block.md` §5: "Rule-schema
     v2 scope creep" and analogous over-scoping risk) by committing E1's first pass to two
     unproven-at-scale lanes simultaneously, with no fallback if both slip.
   - **Unblocks**: `DF-E1-02`, but is not recommended given options 1 and 2 individually already
     carry unresolved risk; stacking them does not reduce E1's critical-path risk, it doubles it.

4. **Defer the discovery-lane decision entirely to E1 planning (do nothing now).**
   - **Migration cost**: None now, but this is the option this ADR exists specifically to foreclose —
     `02` §8.5 lists this ADR as a **pre-E1** requirement precisely because leaving it open pushes an
     architectural decision with a Medium-plus migration-cost tail into E1's critical path instead of
     resolving it while E0's Path-B-adjacent context (the completed rf-handoff runs) is fresh.
   - **Unblocks**: nothing — this option is rejected.

## Consequences

### Positive
- E1 planning inherits a scoped, cost-estimated recommendation instead of an open question, shortening
  E1's own planning cycle.
- Hardening an already-proven lane (Path-B, behind 7/7 verified rf-handoff runs) is lower-risk than
  standing up a net-new native adapter with zero installed-and-evaluated instances today.
- Directly unblocks `DF-E1-02` (full CBC 12-angle live research operation) — the E1 deferred item this
  ADR exists to seed a design spec for (`docs/project_plans/design-specs/cbc-12-angle-research-operation.md`,
  Phase 7 task P7-T4).

### Negative
- Path-B remains outside `rf`'s own CLI verb surface (`02` §3.4: "It is not an `rf` CLI verb") even
  after hardening — this decision does not reduce `rf`'s own native-adapter debt, only defers it.
- Native adapter installation is pushed past E1's first pass, meaning `rf swarm run`'s "0/6 live
  adapters" state (`02` §6.2) persists at least through E1's initial planning window.

### Neutral
- This ADR does not change anything in the E0 build (`evidence-foundry-buildout-v1` remains scoped to
  the deterministic seed lane, per the decisions block §1); it is scoping input for E1 planning only.

## What this ADR unblocks

- **`DF-E1-02`** (full CBC 12-angle live research operation, this plan's deferred-items triage table) —
  E1 planning cannot size or schedule the live-discovery build without a decided lane; this ADR
  supplies that decision (option 1, recommended default) plus the migration-cost basis the E1 design
  spec (`docs/project_plans/design-specs/cbc-12-angle-research-operation.md`, authored in P7-T4) is
  seeded from.

## References

- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §3.4 (Discovery lane
  choices), §6.1 (capability ledger row "Full web discovery outside core CLI"), §6.2 (current `rf`
  gap register — rows: "0/6 live adapters," "Full web discovery outside core CLI," "Path-B
  hard-coded paths/stamp," "Native swarm adapters unavailable"), §8.1 (design decisions requiring
  confirmation — "Which adapter should be installed first?"), §8.5 item 8.
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md` — Deferred
  Items Triage Table, row `DF-E1-02`.
- `.claude/worknotes/evidence-foundry-buildout/decisions-block.md` §1 (scope decision — E0 only, E1
  deferred), §5 (risk hotspots).

## Metadata

- **Author**: documentation-writer (Claude, Sonnet 5), Phase 6 (`P6-T8`) of `evidence-foundry-buildout-v1`.
- **Reviewers**: none yet — `status: proposed` per this phase's exit gate (no ADR in this batch may be
  marked `accepted`).
- **Affected components**: E1 planning scope only; no code, schema, or KB content in this repository is
  changed by this ADR.
- **Risk level**: Medium (architectural direction for E1, not an implementation change).
