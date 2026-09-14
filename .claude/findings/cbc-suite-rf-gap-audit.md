---
title: "CBC Suite Research Foundry gap audit — catalog evidence and approval-safe handoff"
status: blocked_workflow_harness
created: 2026-08-11
scope: "Evidence discovery only; no patient data, clinical rules, candidates, module, UI, or release changes"
operator_run_id: op_run_20260812_025817_pediatric-cbc-suite-evid
rf_run_id: rf_run_20260811_pediatric_cbc_suite_evidence_gap_research
---

# CBC Suite Research Foundry gap audit

## Decision

Fresh Research Foundry work is justified only for the live-catalog gaps below. The existing
`RF-CBC-001` and `RF-CBC-002` bundles must not be duplicated. A bounded non-PHI evidence-only
request was submitted through the local Operator, its exact plan was owner-approved, and the
resulting RF scaffold was exercised through the documented Path-B entry point. The workflow
harness did not execute: the RF run has zero sources and claims, verification exits 2, and its
bundle receipt remains `draft`. Therefore this audit produced **no verified evidence bundle and
no clinical-content authorization**.

| Surface | Live catalog result | Existing evidence position | Action |
| --- | ---: | --- | --- |
| Neutropenia | 57 items | `RF-CBC-001` and `RF-CBC-002` | Exclude from fresh request. |
| Pancytopenia | 10 items | `RF-CBC-002` (plus `RF-EV-001` search results) | Exclude from fresh request. |
| Thrombocytopenia | 4 items | `RF-CBC-002` | Exclude from fresh request. |
| Leukocytosis | 0 items | No catalog hit | Include, bounded to pediatric evidence discovery. |
| Eosinophilia | 0 items | No catalog hit | Include, bounded to pediatric evidence discovery. |
| Thrombocytosis | 0 items | No catalog hit | Include as the isolated platelet-disorder threshold gap. |

`platelet` is not itself a gap determination: its 33-item catalog response includes several
existing runs (including CBC-001/002 and a CALIPER reference-interval run), while the specific
`thrombocytosis` query returned zero. This audit therefore does not infer that no relevant
evidence exists outside the catalog; it records only that the reusable catalog has no matching
indexed artifact today.

## Evidence inspected

1. `docs/project_plans/design-specs/cbc-12-angle-research-operation.md` defines the CBC research
   operation. Its angle 6 includes neutropenia, leukocytosis/lymphocytosis, eosinophilia, and
   infection-related CBC patterns; angle 7 includes thrombocytopenia/thrombocytosis and combined
   cytopenias. The document also says that a verified bundle is not a rule-authoring authorization.
2. `docs/project_plans/design-specs/cbc-suite-full-authoring.md` describes a still-shaping,
   uncommitted full-authoring workstream. It does not authorize module expansion or clinical
   content changes.
3. `docs/project_plans/expansion/rf-handoff/RESULTS.md` records seven verified historical bundles.
   The two CBC bundles are `RF-CBC-001` (12 source cards; 87 claims: 74 supported, 8 inference,
   5 speculation) and `RF-CBC-002` (12 source cards; 88 claims: 75 supported, 8 inference,
   5 speculation). These are structural/governance verification results, not clinical validation.
4. The committed fixture mirrors under `tests/fixtures/rf-cbc-001/` and
   `tests/fixtures/rf-cbc-002/` preserve provenance without exposing restricted passages. Their
   `HASH-PROVENANCE.md` files record that all 74/74 and 75/75 source passages respectively are
   rights-restricted for public output; committed fixtures retain hash plus selector, not the
   verbatim passage. Exact-passage review remains necessary in the controlled RF data plane.

## Live catalog evidence

On 2026-08-11 local project time, authenticated requests to
`GET $RF_API_URL/api/catalog/search?q=<term>` returned:

```text
leukocytosis       total=0   item_count=0
eosinophilia       total=0   item_count=0
thrombocytosis     total=0   item_count=0
neutropenia        total=57  run_ids=[rf_run_20260717_rf_cbc_001_pediatric_cds_establish,
                                      rf_run_20260717_rf_cbc_002_pediatric_cds_establish]
pancytopenia       total=10  run_ids=[rf_run_20260717_rf_cbc_002_pediatric_cds_establish,
                                      rf_run_20260717_rf_ev_001_pediatric_cds_backfill]
thrombocytopenia   total=4   run_ids=[rf_run_20260717_rf_cbc_002_pediatric_cds_establish]
```

The catalog query is discovery evidence, not a claim-level clinical conclusion. It does not prove
absence from the literature, coverage quality, threshold portability, or a safe executable rule.

## Operator and RF receipt

The approved-scope request was submitted with:

```bash
AOS_TARGET=local op --json --tier 2 research "Pediatric CBC Suite evidence-gap research only ..."
```

- Operator run: `op_run_20260812_025817_pediatric-cbc-suite-evid`
- AOS correlation UUID: `7a5681da-83fd-433a-8d09-7c2d7e2d3dee`
- Route/tier: `research` / `2`
- State: `completed` for the bounded capture/triage/plan dispatch only
- RF run scaffold: `rf_run_20260811_pediatric_cbc_suite_evidence_gap_research`
- RF verification: failed closed (`exit_code: 2`, no report); bundle status `draft`

The request is restricted to pediatric, non-PHI discovery for leukocytosis/lymphocytosis,
eosinophilia, and isolated thrombocytosis. It requests source-linked claims with age/local-range,
analyzer/method, units, infection-pattern boundaries, missing-data, dangerous-miss, passage-locator,
and rights constraints recorded. It explicitly excludes neutropenia, pancytopenia, and
thrombocytopenia duplication, and prohibits CDS rule/candidate/module/UI changes.

The timestamp difference is expected: the Operator receipt is recorded at
`2026-08-12T02:58:17Z`, while the audit was performed on 2026-08-11 in the project time zone.

## Implementation-safe handoff

1. The Operator plan was owner-approved and must not be re-submitted or bypassed. Resume only
   through an interactive Dynamic Workflow harness capable of running the recorded Path-B flow.
2. Retain the RF run ID and all eventual run artifacts: `research_brief.md`, source cards,
   extraction cards, `claims/claim_ledger.yaml`, report, `reviews/verification.yaml`, and
   `evidence_bundle.yaml`.
3. Treat supported claims as research evidence only. Preserve inference/speculation labels,
   disagreements, and unlocatable/rights-constrained material; never substitute a missing passage
   with an invented threshold.
4. Before any conversion consideration, evaluate each claim's exact-passage locator, pediatric
   population, assay/method, units, lifecycle, portability/local-reference constraints, and rights
   disposition. A successful `rf verify` is not clinical validation and is not a rule release.
5. Any future executable CDS proposal remains separately gated: deterministic authoring,
   independent credentialed clinical review, executable safety tests, signed release, and the
   program's validation ladder. No action from this audit changes `approvedBy: []` or module status.

## Commands and environment observations

```bash
# Catalog, credentials loaded without printing secrets
source /Users/miethe/.config/research-foundry/serve.env
curl -fsS --get "$RF_API_URL/api/catalog/search" \
  -H "Authorization: Bearer $RF_TOKEN_AGENT" --data-urlencode "q=<term>"

# AOS readiness checked before dispatch
aos-target show
aos-target doctor
AOS_TARGET=local op doctor --json

# Read-only gate confirmation
AOS_TARGET=local op show op_run_20260812_025817_pediatric-cbc-suite-evid
```

The Research Foundry source checkout was not used for writes: its public repo was
`main...origin/main [behind 1]` with unrelated dirty SkillMeat lock/deployment state, and its
separate data plane was `ahead 1, behind 2` with extensive unrelated modifications. Those states
must be preserved; the new work, if approved, should be owned by the Operator/RF flow rather than
inserted manually into either checkout.

## Execution continuation — approved Operator plan, Path-B attempt

The owner approved the exact bounded Operator plan. The Operator then created the RF scaffold
`rf_run_20260811_pediatric_cbc_suite_evidence_gap_research` and marked its routing hop successful
only for **capture → triage → plan**. Its own receipt says the full research pipeline is deferred
until adapters are available or `rf-run-execute.js` is run. This distinction matters: the
Operator's `status: completed` is not evidence that the RF research run completed.

### Preconditions and contract observed

- Local RF preflight passed: `rf guard check --profile personal`.
- `rf doctor` reported the workspace, schemas, governance policy, and model profiles healthy, with
  one of eight adapters available. No adapter was installed or enabled for this task.
- `.claude/workflows/rf-run-execute.js` contains the intended Path-B sequence: discovery → source
  cards → extract/claim-map → labeled analysis → synthesis → verify → bundle/writeback. It requires
  a Claude Code **Dynamic Workflow** runtime (`workflow('rf-run-execute', args)`), not plain Node;
  direct `node` execution is invalid because the script has workflow-runtime top-level returns and
  `agent`/`parallel` primitives.
- The RF workflow registry still labels `rf-run-execute` **`draft`** and says it has no dedicated
  workflow specification. The project AAR says this workflow harness runs in a primary interactive
  Claude Code session, not as a node/API executor.

### Exact attempt and result

An owner-scoped headless Claude invocation was made from the local RF checkout with these hard
constraints: use only `workflow('rf-run-execute', args)`; local `.venv/bin/rf`; a unique `/tmp/`
staging directory; at most ten sources across only leukocytosis/lymphocytosis, eosinophilia, and
isolated thrombocytosis; no adapter installation; no node shim; no broader CBC surfaces; no commits.
The first invocation was rejected by the Claude CLI before launch because streaming JSON requires
`--verbose`. The corrected non-streaming invocation returned no workflow result and produced no
Path-B phase artifacts:

```text
sources/:       absent
extractions/:   absent
claims/:        absent
reports/:       absent
telemetry:      only the original {"stage":"plan", ...} event
```

No source cards means the deterministic tail has no evidence input. A fresh authoritative local
verification recorded the resulting blocker precisely:

```text
rf verify rf_run_20260811_pediatric_cbc_suite_evidence_gap_research
exit_code: 2
failing check: report_has_frontmatter
detail: no report file found for run
```

`rf bundle <run> --verify` wrote an RF-generated **draft** record only, with `source_cards: 0`,
`claims_total: 0`, `claims_supported: 0`, `approved_for_writeback: false`, and no clinical content.
It is not a verified evidence bundle and must not be used as a converter input.

### Receipt position

- Operator receipt: `op_run_20260812_025817_pediatric-cbc-suite-evid`, `completed` for the RF
  scaffold dispatch, with a hop note that full execution is deferred. The receipt has no supported
  post-hoc status mutation for a workflow-harness failure.
- RF receipt: `runs/rf_run_20260811_pediatric_cbc_suite_evidence_gap_research/reviews/verification.yaml`
  now records `passed: false` and `exit_code: 2`; `evidence_bundle.yaml` records `status: draft`.
- `rf status push` supports only IntentTree milestone stages (`discovery_started`,
  `sources_ingested`, `verify_passed`, `bundle_written`). None occurred, so no inaccurate receipt
  update was sent.

## Blocker

**The approved research request is blocked on an executable interactive Dynamic Workflow harness,
not on evidence verification.** The current CLI attempt did not execute `rf-run-execute.js`, and
the authoritative verifier correctly refuses the empty run. Do not hand-author source cards,
claims, reports, or rules to make the green gate appear. Resume only in an interactive Claude Code
session that can invoke the registered Path-B workflow (or after separately authorized executor
work); then re-run authoritative local `rf verify <run>` and `rf bundle <run> --verify` before
claiming any verified bundle. No clinical claims have been authored in this repository.
