# Expected output — Gemini Deep Research / anemia RF-ANE-001

Save the Gemini Deep Research result into the `external_research_handoff/v1` packet layout below, then
hand the directory back for `rf intake external-report`. Everything imports as `platform_synthesis` →
**candidates only**; the rf verifier is the only path to `verified`.

> **⚠️ Layout-source assumption.** This layout and the `rf intake external-report` command come from
> the **draft, not-yet-implemented** PRD `external_research_handoff/v1`
> (`research-foundry/docs/project_plans/PRDs/enhancements/external-research-report-interchange-v1.md`,
> status: **draft**). As of authoring, no `templates/external_research_handoff/v1/`, no
> `schemas/external_research_*.yaml`, and no `rf intake external-report` command exist in the
> research-foundry checkout. Treat field names as the PRD's intended shape; reconcile against the
> shipped schema once the feature lands before running intake.

## Directory layout (PRD §6.1)

```text
external_research_handoff/v1/
├── handoff.yaml                 # required — packet metadata + member manifest
├── report.md                    # required — content_role: platform_synthesis (the narrative)
├── sources.yaml                 # required — sources cited by the findings
├── assertion_candidates.yaml    # required — the recency findings + asides
├── activity.yaml                # optional — trace only, non-authoritative
└── attachments/                 # optional — manifest-listed regular files only
```

### `handoff.yaml`
Declares: schema name/version (`external_research_handoff` / `v1`), **producer profile: `gemini`**,
research question/task context (recency + breadth pass for the pediatric red-cell index substrate,
module `anemia`, item **RF-ANE-001**, extending RF-EV-001), declared sensitivity, creation time,
content roles, sorted member inventory. No credentials/tokens/filesystem paths as remote identity.

### `report.md`
`content_role: platform_synthesis`. Gemini's narrative. Context only — **never parsed as a supported
claim.** State the recency window you searched and the date you ran it; a recency finding without a
search date cannot be re-checked.

### `assertion_candidates.yaml` — the primary deliverable

Two clearly separated groups.

**Group 1 — recency findings (Job 1).** One entry per finding, carrying `job` (`R1`–`R4`), `finding`,
`direction` (`new` | `updated` | `reaffirmed` | `contested` | `deprecated`), `numeric_if_any` (+ UCUM
unit, **never without a citation in the same entry**), `effective_date`, `supersedes`,
`source_citation` (resolving into `sources.yaml`), `access_status`, `classification`, `notes`.

- **`reaffirmed` and `deprecated` are first-class results.** "Body X restated hemoglobin-only anaemia
  definitions in <year>" and "index Y is reported to underperform in children" are exactly what this
  packet is for. Do not suppress them for being negative.
- **`contested` entries must keep both sides.** One entry per position, each with its own citation.
  Conflicts must survive to the bundle as conflicts — do not reconcile them.
- `classification` discipline: `assertion` when a source states it directly, `inference` when you
  derived it (inference feeds the implementation-proposal path only, never a supported claim),
  `annotation` otherwise. A trend you observe across sources is `inference` at best.

**Group 2 — asides (Job 2).** `aside_id`, `domain`, `signal`, `why_it_might_matter`, optional
`source_citation`, `maturity` (`speculative` | `emerging` | `established`). Tag every aside
`content_role: future_module_idea` in its namespaced extension object so it can be routed to idea
capture rather than into this run's bundle.

> **Gemini profile overlay (PRD §6.6):** map Gemini's grounding/citation exports into packet-local IDs.
> Every citation must resolve to a `sources.yaml` entry. **No API call or session scraping** — manual
> export only.

### `sources.yaml`
Every source cited by a finding: packet-local id, locator (DOI/URL), title, date/year, declared
metadata, **license/access status** (keep `free-to-read` distinct from `open-access`), optional
citation-tuple data, vendor fields in a namespaced extension object. Say `unknown` rather than
inventing.

### `activity.yaml` / `attachments/`
Optional; trace-only / manifest-listed bounded regular files. No path traversal, absolute paths,
symlinks, or unlisted content.

## Import command (PRD §6.6 / ERI-FR-9)

```bash
# <PACKET_DIR>       = path to the external_research_handoff/v1 directory you saved
# <rf_workspace_id>  = the target rf workspace (owner-supplied at import time)
# <ane_run_id>       = PLACEHOLDER — the RF-ANE-001 deepen run id assigned when Leg A launches.
#                      Base bundle run is rf_run_20260717_rf_ev_001_pediatric_cds_backfill.

rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <ane_run_id> --dry-run
rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <ane_run_id>
```

Omitting `--run` stages the import (staging-only). Import this packet **last** in the sequence
(perplexity → chatgpt-dr → gemini-dr), so recency findings land against an existing source pool and
extraction table and can flag them as superseded where applicable.

**Route the asides out of the bundle.** Group 2 entries are future-module idea capture, not evidence
for this run; they should not reach the verified bundle. Group 1 findings that mark an existing held
source as superseded are the highest-value output here — they prevent us grounding a rule to a
retired cutoff.
