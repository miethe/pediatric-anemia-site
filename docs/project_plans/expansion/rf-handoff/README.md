---
title: "Research Foundry handoff — Pediatric CDS evidence runs"
description: "Local handoff so rf agents can plan and drive the pediatric-CDS evidence runs with full context. 7 runs registered on the agentic node; run_ids below. All 7 now verified — see RESULTS.md."
status: superseded-by-results
created: 2026-07-17
owner: Nick Miethe
project: pediatric-cds-platform
---

# Research Foundry handoff — Pediatric CDS evidence runs

> **Current status (2026-07-18, supersedes the §2 heading below): all 7 runs are `verified`, not
> merely `planned`.** See [`RESULTS.md`](RESULTS.md) for the authoritative completion record,
> verification numbers, and cross-model audit. The §2 table's *columns* (run IDs, IntentTree nodes,
> gates, legal flags, briefs) have no status field and stay accurate as reference data; the stale
> `planned` status lived in the §2 **section heading**, not in a table column — corrected below.
> Do not cite the RF API's `status_derived` field (`published`) as evidence of this upgrade: it, along
> with `verification_passed`/`governance_verdict`, reads identically for **every run in the RF store**
> (48/48, all repos and projects), including this program's, and does not distinguish a real
> completion from a default. The load-bearing evidence is each run's on-disk
> `runs/<run_id>/reviews/verification.yaml` (`passed: true`, `exit_code: 0`, dated 2026-07-18) — see
> `RESULTS.md` §1.

> **Purpose.** This is the durable, local handoff that makes the Research Foundry (`rf`) agents ready
> to **plan and drive** every evidence run the Pediatric CDS platform needs — with all relevant
> context in one place. The 7 runs below were **registered and `planned`** on the agentic node
> (`http://10.42.10.76:7432`, runs-viewer at `:3030`); each has a `research_brief.md`, `swarm_plan.yaml`,
> and `routing_decision.yaml`. The discovery swarm and deterministic tail have since been driven for
> all 7 (see `RESULTS.md`); what remains is the CDS-side `rf-bundle → kb-pack` converter.

## 1. The seam (read this first — it bounds every run)

```
rf owns:   idea → source → exact passage → extraction → claim → verify → council → bundle
CDS owns:  verified claim → executable rule → test → validated → signed release
```

- **`rf` stops at the verified evidence bundle.** Do **not** author rules, thresholds-as-logic, FHIR,
  or signed packs inside a run — that is the CDS repo's half (Evidence Foundry track, IntentTree
  work-area `EF`). rf produces *evidence and verified claims*; the CDS `rf-bundle → kb-pack` converter
  (node `EF-WP0`) turns those into rule *proposals*.
- **Every claim must stay classifiable** as *source-supported fact* vs *implementation proposal*, with
  conflicts never silently collapsed and **missingness never treated as normal**.
- **No invented thresholds.** Every clinical statement ties to an exact passage (page/section +
  verbatim quote) or is explicitly flagged a proposal for the CDS side to own.

Full spec: [`../02-evidence-foundry-on-research-foundry.md`](../02-evidence-foundry-on-research-foundry.md)
(§1 seam, §3 per-module run template, §6 gap register).

## 2. Run registry — registered `planned` on the node (2026-07-17); now `verified` (2026-07-18, see [`RESULTS.md`](RESULTS.md))

| Item | rf `run_id` | IntentTree node | Gates | Legal | Brief |
|---|---|---|---|---|---|
| RF-EV-001 | `rf_run_20260717_rf_ev_001_pediatric_cds_backfill` | `node_01KXRTYH7YXQF4T6HDKST8RT20` | P1 | — | [§EV-001](run-briefs.md#rf-ev-001) |
| RF-CBC-001 | `rf_run_20260717_rf_cbc_001_pediatric_cds_establish` | `node_01KXRTYHHDGEWQR65ZX30D36JJ` | P2 | — | [§CBC-001](run-briefs.md#rf-cbc-001) |
| RF-CBC-002 | `rf_run_20260717_rf_cbc_002_pediatric_cds_establish` | `node_01KXRTYHVQQTSNY4ZKNV2Z4J1F` | P2 | — | [§CBC-002](run-briefs.md#rf-cbc-002) |
| RF-KID-001 | `rf_run_20260717_rf_kid_001_pediatric_cds_evidence` | `node_01KXRTYJ63NSH1B6RRCYSAVKVR` | P4 | — | [§KID-001](run-briefs.md#rf-kid-001) |
| RF-GRO-002 | `rf_run_20260717_rf_gro_002_pediatric_cds_evidence` | `node_01KXRTYJHB1SBTQGBWXGSD8XE0` | P5 | — | [§GRO-002](run-briefs.md#rf-gro-002) |
| REG-001 | `rf_run_20260717_reg_001_pediatric_cds_map_the` | `node_01KXRTYJWWGM2YJMARF942MTBA` | P0 | **yes** | [§REG-001](run-briefs.md#reg-001) |
| REG-004 | `rf_run_20260717_reg_004_pediatric_cds_scope_the` | `node_01KXRTYK9Q263P1514888SAFBZ` | P3 | **yes** | [§REG-004](run-briefs.md#reg-004) |

All 7 are tagged `pediatric-cds` + `evidence-foundry` and `project=pediatric-cds-platform`. The two
`REG-*` runs are **research input only — flag for legal review; not legal advice.**

**Priority order (P0-gating first):** RF-EV-001 and REG-001, then the long-lead RF-CBC-001 / RF-CBC-002,
then RF-KID-001 / RF-GRO-002, then REG-004.

## 3. Required output contract (per run — the converter-eligibility gate)

Every source card / claim must carry a **`pediatric_cds` evidence-card extension** or it is **not
converter-eligible** (CDS node `EF-WP1` enforces this; see spec 02 §3, §6 gap "Generic extraction schema"):

- **population** — age band, sex, gestational/postnatal age where relevant, clinical context.
- **assay / method** — analyzer/method dependence for any numeric threshold (method mismatch is a named risk).
- **threshold** — verbatim value + units (UCUM) + exact passage locator (page/section + quote).
- **lifecycle** — source effective/retire dates, guideline version, supersession.

Plus the invariant: exact-passage locator on every material claim; conflicts preserved as conflicts;
missing-data prompts, not normal-assumptions.

## 4. How rf agents proceed (per `run_id`)

The node API endpoint that registered these does **scaffold + register + plan only — it does not drive
discovery.** Drive each run out-of-band:

```bash
# Load owner token (local agents only — never hand to external delegates)
set -a; . ~/.config/research-foundry/serve.env; set +a

# 1. Read the planned brief + swarm plan (on the node, or via API)
curl -s "$RF_API_URL/api/runs" -H "Authorization: Bearer $RF_TOKEN_AGENT" \
  | python3 -c "import json,sys;[print(r['run_id'],r.get('status')) for r in json.load(sys.stdin) if 'pediatric' in json.dumps(r).lower()]"
#   on-node brief:  runs/<run_id>/research_brief.md · swarm_plan.yaml · routing_decision.yaml

# 2. Drive discovery (Path-B Claude workflow / Claude Code agents authoring source cards) against run_id.
#    0/6 native adapters are installed — Path-B is the live lane. Record every search query + screening.

# 3. Deterministic tail (on the node or local rf): extract → claim-map → synthesize → verify → council → bundle
#    rf verify exit codes are the contract: 0 ok · 3 governance · 4 unsupported-claim · 7 human-review-pause.

# 4. Handoff: the verified bundle is the input to the CDS rf-bundle → kb-pack converter (IntentTree EF-WP0).
```

Per-run objectives, source classes, screening/exclusion criteria, and acceptance gates are in
[`run-briefs.md`](run-briefs.md). The reusable module template these were built from:
[`../../pediatric-cds-commercialization-package-2026-07-16/Pediatric_CDS_Module_Research_Foundry_Prompt.md`](../../pediatric-cds-commercialization-package-2026-07-16/Pediatric_CDS_Module_Research_Foundry_Prompt.md).

## 5. Shared context index (everything a run may need)

| Context | Path |
|---|---|
| Master expansion plan (front door) | [`../00-expansion-plan.md`](../00-expansion-plan.md) |
| Platform roadmap + research backlog (§D) | [`../01-platform-expansion-roadmap.md`](../01-platform-expansion-roadmap.md) |
| Evidence Foundry seam + run template + gaps | [`../02-evidence-foundry-on-research-foundry.md`](../02-evidence-foundry-on-research-foundry.md) |
| Reusable rf module prompt | [`../../pediatric-cds-commercialization-package-2026-07-16/Pediatric_CDS_Module_Research_Foundry_Prompt.md`](../../pediatric-cds-commercialization-package-2026-07-16/Pediatric_CDS_Module_Research_Foundry_Prompt.md) |
| Source/deep-research strategy | [`../../pediatric-cds-expansion-dr.md`](../../pediatric-cds-expansion-dr.md) |
| Commercialization + current-app spec bundle | [`../../pediatric-cds-commercialization-package-2026-07-16/`](../../pediatric-cds-commercialization-package-2026-07-16/) |
| Rule schema the converter targets | [`../../../../schemas/rule.schema.json`](../../../../schemas/rule.schema.json) |
| Current KB (anemia, for RF-EV-001) | `data/evidence.json` · `data/rules.json` · `data/candidates.json` |
| Hard clinical guardrails | [`../../../../CLAUDE.md`](../../../../CLAUDE.md) §"Hard guardrails" |

## 6. Not rf runs — the rf *project* enhancement handoff (RFUP)

Seven enhancements are needed in the **`rf` project itself** (not this repo, not runs) to fully support
the seam — parameterize the Path-B workflow, a governed URL/PDF extraction adapter, upstream
exact-passage hard-gating, stable schema versioning + machine-contract, council result normalization,
native adapter install/eval, and run-immutability/lineage. They are filed as IntentTree work-area
**`RFUP`** (`node_01KXRTYKKW9ECTF9MCBQ8JV1EB`) and detailed in spec 02 §6.2 / §8.3. Route them into the
`rf` upstream (agentic_meta_dev) as `op story` / feature requests — keep them on the
evidence→verified-claim side of the seam.

## 7. Governance (non-negotiable, every run)

No autonomous diagnosis / treatment / dosing / transfusion directives. No unsupported confidence %.
Generative AI never makes the final patient-specific decision. No invented thresholds. Missingness is
never normal. `rf` output is a **proposal** — it becomes a rule only after the CDS converter + clinical
review portal + executable tests + dual clinical sign-off + signed release. The product stays an
**UNVALIDATED research prototype** until the V1–V6 gates pass for a given module.
