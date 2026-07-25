# Expected output — ChatGPT Deep Research / anemia RF-ANE-001

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
├── sources.yaml                 # required — sources cited by the tables
├── assertion_candidates.yaml    # required — Tables 1/2/3 (this is the deliverable)
├── activity.yaml                # optional — trace only, non-authoritative
└── attachments/                 # optional — manifest-listed regular files only
```

### `handoff.yaml`
Declares: schema name/version (`external_research_handoff` / `v1`), **producer profile: `chatgpt`**,
research question/task context (pediatric red-cell index reference substrate for module `anemia`,
extending RF-EV-001, item **RF-ANE-001**), declared sensitivity, creation time, content roles, sorted
member inventory. No credentials/tokens/filesystem paths as remote identity.

### `report.md`
`content_role: platform_synthesis`. ChatGPT's narrative. Context only — **never parsed as a supported
claim.**

### `assertion_candidates.yaml` — the primary deliverable

All three tables land here, one entry per row. Each carries: packet-local candidate id, candidate text,
**classification (`assertion` | `inference` | `annotation`)**, relation, source reference (into
`sources.yaml`), quoted text or selector when present, and producer confidence as a
**non-authoritative hint** only.

> **ChatGPT profile overlay (PRD §6.6):** *map ChatGPT's cited answer/source exports into packet-local
> IDs.* Every row's `source_citation` must resolve to an entry in `sources.yaml` by packet-local id.
> **No OpenAI API call or session scraping** — manual export only.

Map the prompt's columns as follows:

**Table 1 (reference intervals)** — `analyte` / `age_band` / `sex` / `lower` / `upper` / `unit` /
`method` / `population` → candidate text + structured fields.
- Keep the **UCUM unit token** verbatim (`%`, `L/L`, `g/dL`, `g/L`, `pg`, `fL`, `10*12/L`). **Do not
  convert units** — `%` and `L/L` for hematocrit differ by a factor of 100 and the conversion is ours
  to make downstream, explicitly.
- `method` is a **required** namespaced extension field. `unstated` is an acceptable value; a guessed
  value is not.
- If either limit is uncitable, set it to `unknown` — never interpolate.
- `supersedes_paywalled: yes` on any hemoglobin/MCV/RDW row that cites an openly retrievable carrier
  of numbers we currently hold only from a paywalled source.

**Table 2 (discriminators/indices)** — `index_or_rule` / `formula` / `threshold` / `direction` /
`age_band` / `reported_performance` / `failure_modes`.
- `formula` verbatim with units.
- `reported_performance` **as published only** — a computed or estimated performance figure is an
  `inference` row at best and must say what it was inferred from.
- Conflicting performance estimates → **one row per source**. Do not reconcile; conflicts must survive
  to the bundle as conflicts.
- Spurious-MCHC artifacts belong in `failure_modes` — these become fail-closed conditions downstream.

**Table 3 (definition question)** — one entry per body, including the **negative** ones. A row reading
"defines anaemia by hemoglobin only" with a citation is a valid, wanted result.

**Classification discipline** — `assertion` when the source states it directly, `inference` when you
derived it (inference rows feed the implementation-proposal path only, **never** a supported claim),
`annotation` otherwise. A percentile derivable from public raw data but not published as an interval is
`annotation`, never `assertion`.

### `sources.yaml`
Every source cited by a row: packet-local id, locator (DOI/URL), title, date/year, declared metadata,
**license/access status**, optional citation-tuple data, vendor fields in a namespaced extension
object. Say `unknown` rather than inventing.

Flag paywalled numeric carriers explicitly — they route to the licensing track (**REG-002**) with a
locator, and are **never** paraphrased around.

### `activity.yaml` / `attachments/`
Optional; trace-only / manifest-listed bounded regular files. No path traversal, absolute paths,
symlinks, or unlisted content.

## Import command (PRD §6.6 / ERI-FR-9)

```bash
# <PACKET_DIR>       = path to the external_research_handoff/v1 directory you saved
# <rf_workspace_id>  = the target rf workspace (owner-supplied at import time)
# <ane_run_id>       = PLACEHOLDER — the RF-ANE-001 deepen run id assigned when Leg A launches.
#                      Base bundle run is rf_run_20260717_rf_ev_001_pediatric_cds_backfill;
#                      the deepen run gets its own id. Leave as a placeholder until launch.

rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <ane_run_id> --dry-run
rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <ane_run_id>
```

Omitting `--run` stages the import (staging-only). The receipt reports per-candidate completeness tier
(`locator_only` → `source_resolved` → `passage_resolved` → `verified`) and quarantine reasons. A
candidate advances to `passage_resolved` only on an **exact unique passage match**; only the RF
verifier then assigns `verified`.

**No interval here becomes a clinical threshold** without exact-passage binding and a named
credentialed human attestation downstream. In particular: **nothing in this packet authorizes deriving
hemoglobin from hematocrit** in the decision path — the relationship is researched here as a question,
not adopted as a conversion (design doc §11 R1).
