# Expected output — ChatGPT Deep Research / cbc_suite_v1

Save the ChatGPT Deep Research result into the `external_research_handoff/v1` packet layout below,
then hand the directory back for `rf intake external-report`. Everything imports as
`platform_synthesis` → **candidates only**; the rf verifier is the only path to `verified`.

> **⚠️ Layout-source assumption.** This layout and the `rf intake external-report` command come from
> the **draft, not-yet-implemented** PRD `external_research_handoff/v1`
> (`research-foundry/docs/project_plans/PRDs/enhancements/external-research-report-interchange-v1.md`,
> status: **draft**). As of authoring, no `templates/external_research_handoff/v1/`, no
> `schemas/external_research_*.yaml`, and no `rf intake external-report` command exist in the
> research-foundry checkout — the contract is specified but unbuilt. Treat field names as the PRD's
> intended shape; reconcile against the shipped schema once the feature lands before running intake.

## Directory layout (PRD §6.1)

```text
external_research_handoff/v1/
├── handoff.yaml                 # required — packet metadata + member manifest
├── report.md                    # required — content_role: platform_synthesis (the narrative)
├── sources.yaml                 # required — sources cited by the candidate table
├── assertion_candidates.yaml    # required — the candidate-pattern table (this is the deliverable)
├── activity.yaml                # optional — trace only, non-authoritative
└── attachments/                 # optional — manifest-listed regular files only
```

### `handoff.yaml`
Declares: schema name/version (`external_research_handoff` / `v1`), **producer profile: `chatgpt`**,
research question/task context (net-new CBC candidate patterns for `cbc_suite_v1`, extending
RF-CBC-002), declared sensitivity, creation time, content roles, sorted member inventory. No
credentials/tokens/filesystem paths as remote identity.

### `report.md`
`content_role: platform_synthesis`. ChatGPT's narrative. Context only — **never parsed as a supported
claim.**

### `assertion_candidates.yaml` — the primary deliverable for this role
This is where the candidate-pattern table lands. One entry per candidate (one per threshold band).
Each carries: packet-local candidate id, candidate text (the condition → trigger → threshold pattern),
**classification (`assertion` | `inference` | `annotation`)**, relation, source/citation reference
(into `sources.yaml`), quoted text or selector when present, and producer confidence as a
**non-authoritative hint** only.

> **ChatGPT profile overlay (PRD §6.6):** *map ChatGPT's cited answer/source exports into packet-local
> IDs.* Every table row's `source_citation` must resolve to an entry in `sources.yaml` by packet-local
> id. **No OpenAI API call or session scraping** — manual export only.

Map the prompt's table columns as follows:
- `condition` / `trigger` / `threshold` (+UCUM) / `age_band` / `direction` → the candidate text +
  structured fields.
- `threshold` with UCUM unit → keep the unit token (`10*9/L`, `g/L`, `fL`); if no citable number,
  set the value to `unknown` (never invent).
- `classification` → `assertion` when the source states it directly, `inference` when you derived it
  (inference rows feed the implementation-proposal path only, never a supported claim), `annotation`
  otherwise.
- `retrievable_numeric` / `access_status` → keep as namespaced extension fields on the candidate or
  its source entry.

### `sources.yaml`
Every source cited by a candidate: packet-local id, locator (DOI/URL), title, date/year, declared
metadata, **license/access status**, optional citation-tuple data, vendor fields in a namespaced
extension object. Say `unknown` rather than inventing.

### `activity.yaml` / `attachments/`
Optional; trace-only / manifest-listed bounded regular files. No path traversal, absolute paths,
symlinks, or unlisted content.

## Import command (PRD §6.6 / ERI-FR-9)

```bash
# <PACKET_DIR>       = path to the external_research_handoff/v1 directory you saved
# <rf_workspace_id>  = the target rf workspace (owner-supplied at import time)
# <cbc_run_id>       = PLACEHOLDER — the cbc deepen run id assigned when Leg A launches in P2.
#                      Base bundle run is rf_run_20260717_rf_cbc_001_pediatric_cds_establish;
#                      the deepen run gets its own id. Leave as a placeholder until launch.

rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <cbc_run_id> --dry-run
rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <cbc_run_id>
```

Omitting `--run` stages the import (staging-only). The receipt reports per-candidate completeness tier
(`locator_only` → `source_resolved` → `passage_resolved` → `verified`) and quarantine reasons. A
candidate advances to `passage_resolved` only on an **exact unique passage match**; only the RF
verifier then assigns `verified`. **The table is candidate evidence, never a rule** — no threshold
here becomes a clinical cutoff without exact-passage binding and a credentialed human attestation
downstream.
